// Doc-store backup + restore — Cloud Phase 2 Task 3.
//
// What is backed up: `hub.db` (the Hocuspocus document store — the actual
// designs), `tokens.db`, `users.db`. Snapshots are taken with SQLite's
// `VACUUM INTO`, which produces a consistent copy of a LIVE database without
// stopping the hub. Copying the file with `cp` while a write is in flight
// yields a torn database that restores as corruption, and you find out at the
// worst possible moment — which is the entire reason a restore DRILL exists
// rather than just a backup job.
//
// SQLite stays the primary store. Hocuspocus' `extension-s3` is deliberately
// NOT swapped in (DDR-052 keeps it a named option, unproven here).
//
// Yjs updates are stored VERBATIM as the binary blobs Hocuspocus wrote. The
// phase-9.2 anti-pattern is round-tripping them through JSON: it loses
// information the CRDT needs and cannot be undone later.
//
// Targets are pluggable so the drill is testable without standing up MinIO:
//   file://<absolute-path>   local directory (dev, and a perfectly good
//                            destination for a self-hoster with a mounted disk)
//   s3://                    any S3-compatible endpoint, R2 included

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { deleteObject, getObject, listObjects, putObject, s3ConfigFromEnv } from './s3.mjs';

const require = createRequire(import.meta.url);

/** The databases a hub must be able to come back from. */
export const BACKUP_DATABASES = ['hub.db', 'tokens.db', 'users.db'];

/** Default retention: keep this many snapshot generations. */
const DEFAULT_KEEP = 14;

// ------------------------------------------------------------------- targets

/**
 * A backup target is four functions. Keeping the interface this small is what
 * makes the local-directory target a first-class destination rather than a
 * test fixture — a self-hoster backing up to a mounted volume is a real
 * deployment, not a lesser one.
 *
 * @typedef {object} BackupTarget
 * @property {(key: string, body: Buffer) => Promise<unknown>} put
 * @property {(key: string) => Promise<Buffer|null>} get
 * @property {(prefix: string) => Promise<Array<{key: string, size: number}>>} list
 * @property {(key: string) => Promise<unknown>} remove
 * @property {string} describe
 */

/** @returns {BackupTarget} */
export function fileTarget(root) {
  const base = root.replace(/^file:\/\//, '');
  return {
    describe: `file://${base}`,
    async put(key, body) {
      const full = join(base, key);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body);
      return { key, bytes: body.length };
    },
    async get(key) {
      const full = join(base, key);
      return existsSync(full) ? readFileSync(full) : null;
    },
    async list(prefix) {
      const out = [];
      const walk = (dir, rel) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const childRel = rel ? `${rel}/${entry.name}` : entry.name;
          const childAbs = join(dir, entry.name);
          if (entry.isDirectory()) walk(childAbs, childRel);
          else if (childRel.startsWith(prefix)) {
            out.push({ key: childRel, size: statSync(childAbs).size });
          }
        }
      };
      walk(base, '');
      return out.sort((a, b) => a.key.localeCompare(b.key));
    },
    async remove(key) {
      rmSync(join(base, key), { force: true });
    },
  };
}

/** @returns {BackupTarget} */
export function s3Target(cfg) {
  return {
    describe: `s3://${cfg.bucket} @ ${cfg.endpoint}`,
    put: (key, body) => putObject(cfg, key, body),
    get: (key) => getObject(cfg, key),
    list: (prefix) => listObjects(cfg, prefix),
    remove: (key) => deleteObject(cfg, key),
  };
}

/**
 * Resolve the configured target, or null when the operator configured none.
 * `MAUDE_BACKUP_TARGET=file:///var/backups/maude` or a full S3 env set.
 */
export function targetFromEnv(env = process.env) {
  const explicit = env.MAUDE_BACKUP_TARGET;
  if (explicit?.startsWith('file://')) return fileTarget(explicit);
  const s3 = s3ConfigFromEnv(env);
  return s3 ? s3Target(s3) : null;
}

// ------------------------------------------------------------------ snapshot

/**
 * `VACUUM INTO` one database and return the gzipped bytes.
 *
 * Returns null when the file doesn't exist — a hub that has never minted a
 * user has no users.db, and that is not a backup failure.
 */
export function snapshotDatabase(dataDir, name, { tmpDir } = {}) {
  const source = join(dataDir, name);
  if (!existsSync(source)) return null;
  const Database = require('better-sqlite3');
  const scratchDir = tmpDir ?? dataDir;
  const scratch = join(scratchDir, `.backup-${name}-${process.pid}-${Date.now()}`);
  rmSync(scratch, { force: true });
  const db = new Database(source, { readonly: true });
  try {
    // Parameter binding is not available for VACUUM INTO, so the path is
    // interpolated — it is ours (never user input) and single quotes are
    // escaped anyway rather than trusting that to stay true.
    db.exec(`VACUUM INTO '${scratch.replace(/'/g, "''")}'`);
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
  try {
    return gzipSync(readFileSync(scratch));
  } finally {
    rmSync(scratch, { force: true });
  }
}

/** `backups/20260728T203000Z/hub.db.gz` — sortable, so "latest" is lexical. */
export function snapshotPrefix(now = new Date()) {
  return `backups/${now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')}`;
}

/**
 * Take one full snapshot generation and write it to the target.
 *
 * A manifest is written LAST, on purpose: its presence is what marks a
 * generation complete. A crash mid-upload leaves an unlisted, ignorable partial
 * rather than a directory that looks restorable and isn't.
 */
export async function runBackup({ dataDir, target, now = new Date(), keep = DEFAULT_KEEP }) {
  if (!target) throw new Error('runBackup: no target configured');
  const prefix = snapshotPrefix(now);
  const files = [];
  for (const name of BACKUP_DATABASES) {
    const gz = snapshotDatabase(dataDir, name);
    if (!gz) continue;
    await target.put(`${prefix}/${name}.gz`, gz);
    files.push({ name, bytes: gz.length });
  }
  if (files.length === 0) throw new Error('runBackup: nothing to back up (no databases found)');

  const manifest = {
    version: 1,
    createdAt: now.toISOString(),
    files,
  };
  await target.put(`${prefix}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)));

  const pruned = await pruneOldBackups({ target, keep });
  return { prefix, files, manifest, pruned };
}

/** List complete generations (those that have a manifest), oldest first. */
export async function listBackups(target) {
  const objects = await target.list('backups/');
  const complete = objects
    .filter((o) => o.key.endsWith('/manifest.json'))
    .map((o) => o.key.slice(0, -'/manifest.json'.length));
  return complete.sort();
}

export async function pruneOldBackups({ target, keep = DEFAULT_KEEP }) {
  const generations = await listBackups(target);
  if (generations.length <= keep) return [];
  const doomed = generations.slice(0, generations.length - keep);
  const objects = await target.list('backups/');
  for (const gen of doomed) {
    for (const o of objects) {
      if (o.key.startsWith(`${gen}/`)) await target.remove(o.key);
    }
  }
  return doomed;
}

/**
 * Restore the newest complete generation into `destDir`.
 *
 * Refuses to overwrite existing databases unless `force` — a restore run
 * against a live data directory by mistake is the one operation that can lose
 * more than it recovers.
 */
export async function restoreLatest({ target, destDir, force = false, which }) {
  const generations = await listBackups(target);
  const latest = which ?? generations[generations.length - 1];
  if (!latest) throw new Error('restoreLatest: no complete backup generation found');

  const manifestRaw = await target.get(`${latest}/manifest.json`);
  if (!manifestRaw) throw new Error(`restoreLatest: manifest missing for ${latest}`);
  const manifest = JSON.parse(manifestRaw.toString('utf8'));

  mkdirSync(destDir, { recursive: true });
  const restored = [];
  for (const file of manifest.files) {
    const dest = join(destDir, file.name);
    if (existsSync(dest) && !force) {
      throw new Error(
        `restoreLatest: ${dest} already exists. Restore into an empty directory, ` +
          'or pass force to overwrite deliberately.'
      );
    }
    const gz = await target.get(`${latest}/${file.name}.gz`);
    if (!gz) throw new Error(`restoreLatest: ${latest}/${file.name}.gz missing`);
    writeFileSync(dest, gunzipSync(gz));
    restored.push(file.name);
  }
  return { generation: latest, restored, manifest };
}

// --------------------------------------------------------------- the drill

/**
 * Verify a restored data directory is actually usable.
 *
 * This is the part that makes a backup real. It opens the restored `hub.db`,
 * runs SQLite's own integrity check, counts documents, and — when a sentinel
 * document name is given — asserts that document is present with a non-empty
 * binary payload. A backup that restores to a readable-but-empty database is
 * indistinguishable from a working one until the day you need it.
 *
 * @returns {{ ok: boolean, integrity: string, documents: number,
 *             sentinel: null | { name: string, present: boolean, bytes: number },
 *             problems: string[] }}
 */
export function verifyRestored(destDir, { sentinel } = {}) {
  const problems = [];
  const hubDb = join(destDir, 'hub.db');
  if (!existsSync(hubDb)) {
    return {
      ok: false,
      integrity: 'missing',
      documents: 0,
      sentinel: null,
      problems: ['hub.db is absent from the restored directory'],
    };
  }
  const Database = require('better-sqlite3');
  const db = new Database(hubDb, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
    if (integrity !== 'ok') problems.push(`SQLite integrity_check returned "${integrity}"`);

    const documents = db.prepare('SELECT COUNT(*) AS n FROM "documents"').get().n;
    if (documents === 0) problems.push('restored hub.db contains zero documents');

    let sentinelResult = null;
    if (sentinel) {
      const row = db
        .prepare('SELECT length(data) AS bytes FROM "documents" WHERE name = ?')
        .get(sentinel);
      const bytes = row?.bytes ?? 0;
      sentinelResult = { name: sentinel, present: !!row, bytes };
      if (!row) problems.push(`sentinel document "${sentinel}" is absent`);
      else if (bytes === 0) problems.push(`sentinel document "${sentinel}" restored with 0 bytes`);
    }

    return { ok: problems.length === 0, integrity, documents, sentinel: sentinelResult, problems };
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * The full drill: restore the newest generation into a throwaway directory and
 * verify it. Never touches the live data directory.
 */
export async function restoreDrill({ target, scratchDir, sentinel, which }) {
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(scratchDir, { recursive: true });
  const restored = await restoreLatest({ target, destDir: scratchDir, which });
  const verdict = verifyRestored(scratchDir, { sentinel });
  return { ...verdict, generation: restored.generation, restored: restored.restored };
}

// ------------------------------------------------------------------ schedule

/**
 * Run `runBackup` on an interval. Returns a stop function.
 *
 * A failed backup logs loudly and does NOT stop the schedule — a transient
 * network error must not silently end all future backups, which is exactly how
 * "we had backups" becomes "we had backups until March".
 */
export function scheduleBackups({
  dataDir,
  target,
  intervalMs,
  keep = DEFAULT_KEEP,
  log = console,
}) {
  if (!target || !intervalMs || intervalMs <= 0) return () => {};
  const timer = setInterval(() => {
    runBackup({ dataDir, target, keep })
      .then((r) => log.log?.(`[hub] backup ${r.prefix} (${r.files.length} file(s))`))
      .catch((err) => log.error?.(`[hub] backup FAILED: ${err.message}`));
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
