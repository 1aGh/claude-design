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

import { bundleRepo, REPO_BUNDLE, restoreRepo } from './repo-checkpoint.mjs';
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
 * Namespace every key of a target under `prefix`.
 *
 * TENANT ISOLATION, and it is not optional. Cells share one bucket, so without
 * this every cell writes its generations to the same `backups/` keys and each
 * tenant's backup silently overwrites the last one to run — with `restoreLatest`
 * then rehydrating one tenant's cell from another tenant's documents. The cell
 * entrypoint has exported MAUDE_BACKUP_PREFIX since Phase 5; nothing read it
 * until Cloud Phase 15, which means the isolation the comment describes did not
 * exist.
 *
 * `list` strips the prefix back off, so callers keep working in unprefixed
 * key-space and the whole thing is invisible above this line.
 */
export function prefixedTarget(target, prefix) {
  const clean = String(prefix).replace(/^\/+|\/+$/g, '');
  if (!clean) return target;
  const at = (key) => `${clean}/${key}`;
  return {
    describe: `${target.describe} [${clean}/]`,
    put: (key, body) => target.put(at(key), body),
    get: (key) => target.get(at(key)),
    remove: (key) => target.remove(at(key)),
    list: async (p) =>
      (await target.list(at(p))).map((o) => ({ ...o, key: o.key.slice(clean.length + 1) })),
  };
}

/**
 * Resolve the configured target, or null when the operator configured none.
 * `MAUDE_BACKUP_TARGET=file:///var/backups/maude` or a full S3 env set.
 *
 * `MAUDE_BACKUP_PREFIX` scopes it to one tenant (see prefixedTarget).
 */
export function targetFromEnv(env = process.env) {
  return targetFromConfig(env, s3ConfigFromEnv(env));
}

/**
 * Same resolution, but with the S3 credentials supplied by the caller —
 * Cloud Phase 25 A-1. In a platform cell the credentials are temporary and
 * refreshed by `s3-creds.mjs`, so the scheduler resolves its target per tick
 * through this instead of pinning boot-time values.
 */
export function targetFromConfig(env = process.env, s3 = null) {
  const explicit = env.MAUDE_BACKUP_TARGET;
  const base = explicit?.startsWith('file://') ? fileTarget(explicit) : s3 ? s3Target(s3) : null;
  if (!base) return null;
  return env.MAUDE_BACKUP_PREFIX ? prefixedTarget(base, env.MAUDE_BACKUP_PREFIX) : base;
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
export async function runBackup({
  dataDir,
  target,
  now = new Date(),
  keep = DEFAULT_KEEP,
  repoDir = null,
  run = null,
}) {
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

  // Cloud Phase 15 — the checkout rides in the SAME generation as the
  // databases. Documents from 03:00 restored beside a checkout from 02:00
  // would give a workspace whose documents reference canvases the checkout
  // does not have; consistency between the two is why this is not a separate
  // schedule. A cell with no commits yet contributes nothing, which is a
  // normal state and not a failure.
  let repo = null;
  if (repoDir && run) {
    const bundled = await bundleRepo(repoDir, run);
    if (bundled.state === 'ok') {
      await target.put(`${prefix}/${REPO_BUNDLE}`, bundled.bytes);
      repo = { name: REPO_BUNDLE, bytes: bundled.bytes.length };
    } else if (bundled.state === 'failed') {
      // Loud, but the databases are already up and a partial generation with
      // no manifest is ignorable. Throwing here would discard a good document
      // backup because the checkout lane had a bad day.
      console.error(`[backup] the checkout was NOT included: ${bundled.reason}`);
    }
  }

  const manifest = {
    version: 1,
    createdAt: now.toISOString(),
    files,
    ...(repo ? { repo } : {}),
  };
  await target.put(`${prefix}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)));

  const pruned = await pruneOldBackups({ target, keep });
  return { prefix, files, manifest, repo, pruned };
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
export async function restoreLatest({
  target,
  destDir,
  force = false,
  which,
  repoDir = null,
  run = null,
}) {
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

  // The checkout lane. Only when the caller asked for it AND the generation
  // carries one — an older generation predating Cloud Phase 15 has none, and
  // that must restore the databases rather than fail.
  let repo = null;
  if (repoDir && run && manifest.repo) {
    const bytes = await target.get(`${latest}/${manifest.repo.name}`);
    if (!bytes) throw new Error(`restoreLatest: ${latest}/${manifest.repo.name} missing`);
    repo = await restoreRepo(repoDir, bytes, run, { force });
    if (repo.state === 'failed') {
      throw new Error(`restoreLatest: the checkout could not be restored — ${repo.reason}`);
    }
  }
  return { generation: latest, restored, manifest, repo };
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
  repoDir = null,
  run = null,
}) {
  if (!target || !intervalMs || intervalMs <= 0) return () => {};
  const timer = setInterval(async () => {
    // A-1: `target` may be an async FACTORY — in a platform cell the storage
    // credentials are temporary, so each tick resolves the target against the
    // credentials that are valid NOW rather than the ones from boot.
    let resolved;
    try {
      resolved = typeof target === 'function' ? await target() : target;
    } catch (err) {
      log.error?.(`[hub] backup target unavailable: ${err.message}`);
      return;
    }
    if (!resolved) return;
    runBackup({ dataDir, target: resolved, keep, repoDir, run })
      .then((r) =>
        log.log?.(
          `[hub] backup ${r.prefix} (${r.files.length} file(s)${r.repo ? ' + checkout' : ''})`
        )
      )
      .catch((err) => log.error?.(`[hub] backup FAILED: ${err.message}`));
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
