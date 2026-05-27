// Debounced file reader for the bidirectional file sync agent (Phase 9 Task 4).
//
// The dev-server already has a recursive fs.watch (fs-watch.ts) firing
// `fs:html` / `fs:json` / `fs:any` bus events with ~50ms debounce. That's
// great for HMR (the browser wants the freshest possible reload), but
// the sync agent needs a stricter quiet-window: when a user edit drops onto
// disk in a flurry (Vim's atomic save: rename twice; or a codemod hammering
// 100 writes in 10ms), we want to react ONCE per quiescent path so the
// resulting Y.Doc op is the final state, not 100 intermediate ones.
//
// FsReader is that layer. Subscribe via `notify(path)`; after the configured
// quiet window (default 250ms per plan Task 4 step 2) the reader reads bytes
// from disk, computes a SHA-256, and invokes the per-path handler.
//
// Stateless beyond per-path timers — no fs.watch of its own. The agent wires
// `ctx.bus.on('fs:any', (path) => reader.notify(path))` once at boot.

import { readFile } from 'node:fs/promises';
import { isAbsolute, join as nodeJoin, resolve as nodeResolve, sep as pathSep } from 'node:path';

import { hashBytes } from './echo-guard.ts';

export const DEFAULT_QUIET_MS = 250;

export interface FsReadEvent {
  /** Path relative to designRoot — same shape the bus emits. */
  path: string;
  /** Raw bytes on disk after the quiet window. */
  bytes: Uint8Array;
  /** sha256(bytes), hex. Same fingerprint the echo guard records. */
  hash: string;
}

export type FsReaderHandler = (evt: FsReadEvent) => void | Promise<void>;

export interface FsReader {
  /**
   * Record an fs event for `relPath`. Resets the per-path quiet timer; the
   * handler fires after `quietMs` of no further notify() calls for the same
   * path. Passing an absolute path is fine — the reader uses it verbatim when
   * resolving against the read root.
   */
  notify(relPath: string): void;

  /** Number of paths currently waiting on a debounce timer. Test only. */
  pending(): number;

  /** Force-fire all pending timers immediately. Test only. */
  flush(): Promise<void>;

  /** Cancel all pending timers and drop subscriptions. */
  stop(): void;
}

export interface FsReaderOptions {
  /** Absolute path the relPath should be resolved against. */
  rootDir: string;
  /** Per-path quiet window. Defaults to DEFAULT_QUIET_MS. */
  quietMs?: number;
  /** Predicate — if false, the path is ignored. Used by the agent to filter
   *  to just the file types the sync layer cares about (.html, .json, .svg). */
  accept: (relPath: string) => boolean;
  /** Called once per quiescence with bytes + hash. */
  onRead: FsReaderHandler;
  /** Called when a file disappeared during the quiet window. */
  onDeleted?: (relPath: string) => void;
  /** Path join helper (injected for tests). Defaults to node:path.join. */
  joinPath?: (a: string, b: string) => string;
}

export function createFsReader(opts: FsReaderOptions): FsReader {
  const quiet = opts.quietMs ?? DEFAULT_QUIET_MS;
  const join = opts.joinPath ?? defaultJoin;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopped = false;

  async function fire(relPath: string): Promise<void> {
    timers.delete(relPath);
    if (stopped) return;
    const abs = join(opts.rootDir, relPath);
    // Defense-in-depth — confirm the joined path stays under rootDir. The agent's
    // absolute-path equality check in applyFromFs already constrains the impact,
    // but adding the guard prevents future-refactor regressions from re-opening
    // the surface. DDR-054 §2f (defender M1 + attacker F12).
    const safeRoot = nodeResolve(opts.rootDir);
    const norm = nodeResolve(abs);
    if (norm !== safeRoot && !norm.startsWith(safeRoot + pathSep)) {
      // Silent drop — never read out-of-tree files.
      return;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(abs);
    } catch (err) {
      if (isNotFound(err)) {
        opts.onDeleted?.(relPath);
        return;
      }
      // Best-effort — log and skip; another fs.watch event will re-fire.
      console.warn('[sync/fs-mirror] read failed for', relPath, '-', describeErr(err));
      return;
    }
    const u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const hash = hashBytes(u8);
    try {
      await opts.onRead({ path: relPath, bytes: u8, hash });
    } catch (err) {
      console.error('[sync/fs-mirror] handler threw for', relPath, '-', describeErr(err));
    }
  }

  return {
    notify(relPath) {
      if (stopped) return;
      // Reject obvious traversal attempts before the timer is even armed.
      // DDR-054 §2f (defender M1 + attacker F12).
      if (relPath.includes('..') || isAbsolute(relPath)) return;
      if (!opts.accept(relPath)) return;
      const prev = timers.get(relPath);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        void fire(relPath);
      }, quiet);
      timers.set(relPath, t);
    },

    pending() {
      return timers.size;
    },

    async flush() {
      const paths = Array.from(timers.keys());
      for (const p of paths) {
        const t = timers.get(p);
        if (t) clearTimeout(t);
      }
      await Promise.all(paths.map((p) => fire(p)));
    },

    stop() {
      stopped = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}

function defaultJoin(a: string, b: string): string {
  return nodeJoin(a, b);
}

function isNotFound(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT';
}

function describeErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
