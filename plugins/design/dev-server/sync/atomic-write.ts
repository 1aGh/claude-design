// Atomic file writes for the bidirectional file sync agent (Phase 9 Task 4).
//
// fs.watch on macOS/Linux fires on rename, so a non-atomic write (open →
// truncate → write chunks → close) emits multiple watch events with partial
// content. The agent's echo guard hashes the final content, so a partial-write
// event would miss the hash match and incorrectly bubble the (truncated) state
// up to Y.Doc — corrupting the live state.
//
// Pattern: write to `<path>.tmp.<random>`, then `renameSync` to the final
// path. POSIX rename is atomic when source + destination are on the same
// filesystem; the watch sees the final-content-already-present rename event
// rather than a stream of in-flight chunks.
//
// Windows note: rename of a file the watcher has open returns EBUSY. The
// plan's Task 4 step 4 acknowledges this as a known minor risk for v1.1;
// the agent treats EBUSY as a transient error and retries once after a 25ms
// jitter.

import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const RETRY_DELAY_MS = 25;

/**
 * Write `bytes` to `path` atomically. Returns the absolute path written
 * (same as input — convenience for chaining).
 *
 * Bytes are written via Node's synchronous `writeFileSync` to a sibling
 * `.tmp.<random>` file, then `renameSync` moves it into place. On POSIX the
 * rename is atomic; on Windows there is a small window where the watcher may
 * see a brief gap, retried once on EBUSY.
 *
 * `bytes` accepts string (UTF-8 encoded) or Uint8Array (written verbatim).
 */
export function atomicWrite(path: string, bytes: string | Uint8Array): string {
  // Ensure the parent directory exists. Cheap (mkdirSync recursive is a no-op
  // when present) and removes the per-canvas burden of creating _comments/
  // before the agent's first flush.
  mkdirSync(dirname(path), { recursive: true });
  const suffix = randomBytes(4).toString('hex');
  const tmp = `${path}.tmp.${suffix}`;
  try {
    writeFileSync(tmp, bytes);
    try {
      renameSync(tmp, path);
    } catch (err) {
      if (isWindowsBusy(err)) {
        // Brief retry — Windows watcher may hold a handle while reading the
        // pre-rename target. 25ms is short enough to be invisible to the user
        // and long enough to clear the typical fs.watch poll interval.
        const start = Date.now();
        while (Date.now() - start < RETRY_DELAY_MS) {
          // Tight loop is OK for 25ms — keeps the call synchronous so callers
          // can record the echo-guard hash before any fs event fires.
        }
        renameSync(tmp, path);
      } else {
        throw err;
      }
    }
  } catch (err) {
    // Best-effort cleanup of the .tmp on failure — don't mask the original
    // exception with a cleanup error.
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
  return path;
}

function isWindowsBusy(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}
