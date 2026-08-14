// Deleted-document tombstones — the "absence" half of the sync protocol.
//
// WHY THIS EXISTS. Sync had lanes for content and none for absence. Deleting a
// canvas was a purely local file move (`studio api.ts deleteCanvas` → `_trash/`),
// nothing told the hub, and `remote-docs.ts` treats any document ON the hub as
// authority to materialise a real file. So a delete was refilled by the peer on
// the next discovery tick: the canvas vanished for a moment and came back. The
// v0.60.3 continuous-discovery change did not cause that — it removed the delay
// (previously a whole runtime cycle) that was hiding it.
//
// `removed` in `diffCanvasSet` cannot carry this. It means "this machine no
// longer offers it", which is indistinguishable from "this machine has not
// discovered it yet" — and the ambiguity has to resolve toward restoring, or a
// peer that is still booting would delete the project. Absence therefore needs
// to be STATED, once, by the peer that meant it. That statement is a tombstone.
//
// SQLite layout (<dataDir>/tombstones.db):
//   tombstones(
//     name       TEXT PRIMARY KEY,   -- document name, as the sync uses it
//     deleted_at INTEGER NOT NULL    -- epoch ms
//   )
//
// A SEPARATE DB, NOT A TABLE IN hub.db. `hub.db` is the Hocuspocus SQLite
// extension's own store; its schema is the extension's to migrate and ours to
// read. Parking our table inside it would make an upstream migration our
// problem. The delete route still removes the extension's `documents` row —
// that is a documented, stable one-table shape — but our bookkeeping lives here.
//
// RETENTION. A tombstone answers "was this deleted after I last looked", so it
// only has to outlive the longest plausible peer absence, not live forever. It
// is pruned after TOMBSTONE_TTL_MS. A peer that was offline longer than that
// re-uploads the canvas from its own disk, which is the same thing that happens
// today and is recoverable — the failure mode is a resurrected canvas, never a
// destroyed one.
//
// RE-CREATING A NAME CLEARS ITS TOMBSTONE. Otherwise the graveyard would fight
// a deliberate re-create for the whole retention window. `clearTombstone` is
// called on the write path, so "delete then make it again" behaves the way
// anyone would expect.

import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// better-sqlite3 is a runtime-external native binding (see build.ts). Loading
// it lazily keeps the import graph clean for the bundler.
const Database = require('better-sqlite3');

/** How long a tombstone is kept before it is pruned. 30 days. */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Same charset the sync + `listCanvases` enforce on a document name. */
const DOCUMENT_NAME_REGEX = /^[A-Za-z0-9._/-]{1,256}$/;

/**
 * A name fit to be stored AND handed back to a peer as an instruction.
 *
 * The charset above allows both `.` and `/`, so `../../etc/passwd` is
 * charset-clean — harmless where a name is only a SQLite key, not harmless here,
 * because a peer acts on a tombstone by removing a local file. The peer applies
 * its own containment; this is the same lock on the store side, so a row that
 * could never be legitimate cannot be written in the first place. No real canvas
 * is named `..`.
 */
function isStorableName(name) {
  return (
    typeof name === 'string' && DOCUMENT_NAME_REGEX.test(name) && !name.split('/').includes('..')
  );
}

/** One open Database handle per dataDir. Native init is expensive; cache it. */
const dbCache = new Map();

/** Compute the path to the tombstone store for a given data directory. */
export function tombstonesDbPath(dataDir) {
  return join(dataDir, 'tombstones.db');
}

/** Open (creating on first touch) the tombstone DB for `dataDir`. */
function db(dataDir) {
  const cached = dbCache.get(dataDir);
  if (cached?.open) return cached;

  // Default rollback journal (not WAL), matching tokens.mjs: single-process,
  // low write volume, one file on disk.
  const handle = new Database(tombstonesDbPath(dataDir));
  handle.exec(
    `CREATE TABLE IF NOT EXISTS tombstones (
       name       TEXT PRIMARY KEY,
       deleted_at INTEGER NOT NULL
     )`
  );
  dbCache.set(dataDir, handle);
  return handle;
}

/** Close + forget the cached handle (tests, shutdown). */
export function closeTombstones(dataDir) {
  const cached = dbCache.get(dataDir);
  try {
    cached?.close();
  } catch {
    /* already closed */
  }
  dbCache.delete(dataDir);
}

/** Drop tombstones past their retention. Cheap; runs on every write. */
function prune(handle, now) {
  handle.prepare('DELETE FROM tombstones WHERE deleted_at <= ?').run(now - TOMBSTONE_TTL_MS);
}

/**
 * Record that `name` was deleted. Idempotent — a repeated delete refreshes the
 * timestamp rather than erroring, so a peer retrying after a network failure
 * does not need to care whether the first attempt landed.
 *
 * Returns false for a name that is not regex-clean: a tombstone is consumed by
 * peers as an instruction to trash a local file, so the shape gate applies at
 * the WRITE boundary too, not only at the read.
 */
export function recordTombstone(dataDir, name, { now = Date.now() } = {}) {
  if (!isStorableName(name)) return false;
  const handle = db(dataDir);
  prune(handle, now);
  handle
    .prepare(
      `INSERT INTO tombstones (name, deleted_at) VALUES (?, ?)
       ON CONFLICT(name) DO UPDATE SET deleted_at = excluded.deleted_at`
    )
    .run(name, now);
  return true;
}

/**
 * Forget the tombstone for `name` — called when the name is created again, so a
 * deliberate re-create is not fought by its own gravestone.
 */
export function clearTombstone(dataDir, name) {
  if (typeof name !== 'string' || !name) return false;
  const handle = db(dataDir);
  return handle.prepare('DELETE FROM tombstones WHERE name = ?').run(name).changes > 0;
}

/** Is this name currently tombstoned? */
export function isTombstoned(dataDir, name, { now = Date.now() } = {}) {
  if (typeof name !== 'string' || !name) return false;
  const row = db(dataDir).prepare('SELECT deleted_at FROM tombstones WHERE name = ?').get(name);
  if (!row) return false;
  return Number(row.deleted_at) > now - TOMBSTONE_TTL_MS;
}

/**
 * Every live tombstone, oldest first.
 *
 * Never throws: a store that cannot be opened (missing native binding, locked
 * file, a read-only volume) reports "no deletions", which degrades to exactly
 * today's behaviour rather than failing the listing a peer needs to sync at all.
 */
export function listTombstones(dataDir, { now = Date.now() } = {}) {
  try {
    const rows = db(dataDir)
      .prepare('SELECT name, deleted_at FROM tombstones WHERE deleted_at > ? ORDER BY deleted_at')
      .all(now - TOMBSTONE_TTL_MS);
    return rows
      .filter((r) => isStorableName(String(r.name)))
      .map((r) => ({ name: String(r.name), deletedAt: Number(r.deleted_at) }));
  } catch {
    return [];
  }
}
