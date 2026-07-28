// Persistent sliding-window rate limiter — Cloud Phase 2 Task 2.
//
// The in-memory buckets in server.mjs reset on every restart, so "crash the
// hub, keep guessing" was a free way to clear a brute-force counter — and a
// hub that restarts on deploy did it for you. This backs the same window with
// SQLite so the budget survives a restart.
//
// Sliding, not fixed-window: a fixed window lets an attacker spend the whole
// budget at 59s and the whole budget again at 61s. One row per hit makes the
// window genuinely rolling. Volume is tiny (auth attempts and admin calls, not
// document traffic), so per-hit rows are affordable.
//
// SINGLE PROCESS. Horizontal scale remains DDR-052's extension-redis story;
// this is not a distributed limiter and does not pretend to be.

import { chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** Hard ceiling on rows kept per key — a flood must not grow the file unbounded. */
const MAX_ROWS_PER_KEY = 10_000;

/**
 * Open (or create) the rate-limit store for a data directory.
 *
 * Falls back to an in-memory implementation with the SAME semantics when
 * better-sqlite3 is unavailable or the directory is read-only. Rate limiting
 * degrading to non-persistent is strictly better than the hub refusing to boot.
 *
 * @param {string} dataDir
 * @returns {{ check(key: string, max: number, windowMs: number, now?: number): boolean,
 *             count(key: string, windowMs: number, now?: number): number,
 *             reset(key?: string): void,
 *             persistent: boolean,
 *             close(): void }}
 */
export function createRateStore(dataDir, { warn = (m) => console.warn(m) } = {}) {
  let handle = null;
  try {
    const Database = require('better-sqlite3');
    const path = join(dataDir, 'ratelimit.db');
    handle = new Database(path);
    handle.exec(
      `CREATE TABLE IF NOT EXISTS hits (
         key TEXT NOT NULL,
         at  INTEGER NOT NULL
       )`
    );
    handle.exec('CREATE INDEX IF NOT EXISTS hits_key_at ON hits (key, at)');
    try {
      chmodSync(path, 0o600);
    } catch {
      /* best effort */
    }
  } catch (err) {
    warn(`[hub] rate-limit store falling back to memory: ${err.message}`);
    handle = null;
  }

  if (!handle) return memoryStore();

  const insert = handle.prepare('INSERT INTO hits (key, at) VALUES (?, ?)');
  const prune = handle.prepare('DELETE FROM hits WHERE key = ? AND at <= ?');
  const countIn = handle.prepare('SELECT COUNT(*) AS n FROM hits WHERE key = ? AND at > ?');
  const trim = handle.prepare(
    'DELETE FROM hits WHERE rowid IN (SELECT rowid FROM hits WHERE key = ? ORDER BY at DESC LIMIT -1 OFFSET ?)'
  );
  const pruneAll = handle.prepare('DELETE FROM hits WHERE at <= ?');

  let sinceSweep = 0;

  function check(key, max, windowMs, now = Date.now()) {
    const cutoff = now - windowMs;
    prune.run(key, cutoff);
    const used = countIn.get(key, cutoff).n;
    // Record the attempt whether or not it is admitted: a rejected attempt is
    // still an attempt, and not counting it would let a caller sit exactly at
    // the ceiling forever.
    insert.run(key, now);
    if (used + 1 > MAX_ROWS_PER_KEY) trim.run(key, MAX_ROWS_PER_KEY);
    // Opportunistic global sweep so keys that go quiet don't linger.
    if (++sinceSweep >= 500) {
      sinceSweep = 0;
      pruneAll.run(now - Math.max(windowMs, 3600_000));
    }
    return used < max;
  }

  return {
    check,
    count(key, windowMs, now = Date.now()) {
      return countIn.get(key, now - windowMs).n;
    },
    reset(key) {
      if (key === undefined) handle.exec('DELETE FROM hits');
      else handle.prepare('DELETE FROM hits WHERE key = ?').run(key);
    },
    persistent: true,
    close() {
      try {
        handle.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Same semantics, no durability. Used when SQLite is unavailable. */
function memoryStore() {
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  return {
    check(key, max, windowMs, now = Date.now()) {
      const cutoff = now - windowMs;
      const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
      const used = list.length;
      list.push(now);
      if (list.length > MAX_ROWS_PER_KEY) list.splice(0, list.length - MAX_ROWS_PER_KEY);
      hits.set(key, list);
      return used < max;
    },
    count(key, windowMs, now = Date.now()) {
      const cutoff = now - windowMs;
      return (hits.get(key) ?? []).filter((t) => t > cutoff).length;
    },
    reset(key) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
    persistent: false,
    close() {
      hits.clear();
    },
  };
}
