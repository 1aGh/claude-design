// Echo prevention for the bidirectional file sync agent (Phase 9 Task 4).
//
// Problem: when the sync agent writes a file from a remote Y.Doc update, the
// local fs.watch fires immediately afterwards. Naively, that watch event would
// be interpreted as a user edit, get pushed back to the Y.Doc, broadcast back
// to every peer (including ourselves), and trigger another write — an infinite
// echo loop.
//
// Solution: before writing a file from a remote-origin update, the agent
// records `sha256(bytes)` in a small TTL map. When the fs.watch fires for that
// path, the agent computes sha256 of the on-disk bytes and asks the guard
// `consume(path, hash)`. If the hash matches a pending entry that hasn't
// expired, the event is dropped (it's our own write echoing back). If no
// match, the event is treated as a real user/Claude edit and pushed up to the
// Y.Doc.
//
// Inspired by Syncthing's "weak hash + sequence number" approach (plan Task 4
// "Pattern" bullet). The expiry window is intentionally short — 1500ms covers
// realistic fs.watch debounce on macOS / Linux / Windows without holding state
// long enough to falsely silence genuine user edits that happen to produce the
// same hash (e.g. typing the same character back).

import { createHash } from 'node:crypto';

export const ECHO_TTL_MS = 1500;

/**
 * Compute a hex SHA-256 of the given bytes. Stable across platforms; the agent
 * uses this as the echo-detection fingerprint.
 */
export function hashBytes(bytes: Uint8Array | string): string {
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

interface PendingEcho {
  hash: string;
  expiresAt: number;
}

export interface EchoGuard {
  /**
   * Record that we just wrote `hash` to `path` from a remote-origin update.
   * The next fs.watch event for that path within ECHO_TTL_MS with a matching
   * hash will be treated as an echo and dropped.
   *
   * Multiple writes to the same path stack as a small per-path queue — useful
   * when remote updates fire in rapid succession and the fs.watch coalesces
   * them. consume() pops the oldest matching entry.
   */
  record(path: string, hash: string, now?: number): void;

  /**
   * Returns true if `hash` matches a pending entry for `path` (i.e. this
   * fs.watch event is the echo of our own write). Pops the entry on match so
   * a later, genuine user edit producing the same bytes still goes through.
   */
  consume(path: string, hash: string, now?: number): boolean;

  /** Drop expired entries. Idempotent. */
  sweep(now?: number): void;

  /** Test/inspection: count of currently pending entries across all paths. */
  size(): number;
}

export function createEchoGuard(ttlMs: number = ECHO_TTL_MS): EchoGuard {
  const pending = new Map<string, PendingEcho[]>();

  function sweep(now: number = Date.now()): void {
    for (const [path, queue] of pending) {
      const alive = queue.filter((e) => e.expiresAt > now);
      if (alive.length === 0) pending.delete(path);
      else if (alive.length !== queue.length) pending.set(path, alive);
    }
  }

  return {
    record(path, hash, now = Date.now()) {
      sweep(now);
      const expiresAt = now + ttlMs;
      const queue = pending.get(path) ?? [];
      queue.push({ hash, expiresAt });
      pending.set(path, queue);
    },

    consume(path, hash, now = Date.now()) {
      sweep(now);
      const queue = pending.get(path);
      if (!queue || queue.length === 0) return false;
      const idx = queue.findIndex((e) => e.hash === hash);
      if (idx === -1) return false;
      queue.splice(idx, 1);
      if (queue.length === 0) pending.delete(path);
      else pending.set(path, queue);
      return true;
    },

    sweep,

    size() {
      let n = 0;
      for (const queue of pending.values()) n += queue.length;
      return n;
    },
  };
}
