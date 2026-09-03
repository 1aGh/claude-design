// Low-level transcript file IO — the primitives that must never load a whole
// `<designRoot>/_chat/<chatId>.jsonl` into memory, plus the writer-side blob
// sanitizer that keeps those files small in the first place.
//
// WHY THIS MODULE EXISTS (issue #119). Transcripts are append-only and were
// never capped, rotated, or pruned, and `appendTranscript` persisted every ACP
// session update VERBATIM — including base64 image payloads from tool results
// (a `maude design screenshot`, a `Read` of a PNG). A dogfood project reached
// 554 MB across 24 transcripts, the largest 177 MB in 1733 lines, of which
// 66–76% was base64 that NOTHING ever reads back (`readChatMessages` projects
// tool calls down to `{ toolName, done }` and discards `content` entirely).
//
// Every reader then did `readFileSync(utf8).split('\n').map(JSON.parse)` over
// the whole file, and `listChats()` did it for EVERY transcript in the
// directory — on a code path the client fires at every turn end. Measured
// under Bun against that project: 661 ms of fully synchronous, event-loop-
// blocking work and 1.29 GB peak RSS per call, climbing to ~1.9 GB retained.
// That is one defect presenting as two symptoms: the RSS is the churn, and the
// "stuck chat" is the same single-threaded loop that serves the ACP socket
// being blocked by it.
//
// The rule this module enforces: a transcript's SIZE must not be able to
// determine the cost of reading it. Every function here is bounded — by a
// reusable buffer, a prefix cap, or a tail cap — regardless of file size.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** Chunk size for the streaming line counter. One reused buffer, never a
 *  string — the whole point is not to materialize the file. */
const COUNT_CHUNK_BYTES = 64 * 1024;

const NEWLINE = 0x0a;

/**
 * Raw non-empty line count of a transcript, read in bounded chunks.
 *
 * **This is THE single implementation of the re-attach seam's counter.**
 * `transcript.ts`'s `chatTranscriptSeq` and `bridge.ts`'s
 * `countTranscriptLines` both delegate here. They used to be two hand-copied
 * bodies kept in agreement by a comment ("The two MUST count identically...");
 * the invariant is now structural, which is the only way it stays true. The
 * bridge's original objection to sharing — that importing the transcript
 * READER would drag `designRoot`/`chatId` path conventions into a module that
 * knows only an absolute path — is respected: this module takes a path and
 * nothing else.
 *
 * Semantics are byte-identical to the string form it replaces,
 * `readFileSync(f, 'utf8').split('\n').filter(Boolean).length`:
 *   - segments are split on `\n` ONLY, so a lone `\r` (a CRLF file) is a
 *     non-empty segment and IS counted, exactly as `filter(Boolean)` counts it;
 *   - a trailing newline does not add a segment;
 *   - a final line with no trailing newline DOES count.
 * Splitting on a single byte is also why chunking is safe for UTF-8: 0x0A can
 * never occur inside a multi-byte sequence, so a chunk boundary can never
 * split a character in a way that changes the count.
 *
 * A missing/unreadable file is `0` — "no transcript yet", the first turn of a
 * chat — never a throw. Callers treat the seam's seed as best-effort.
 */
export function countTranscriptLinesAt(path: string): number {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return 0;
  }
  try {
    const buf = Buffer.allocUnsafe(COUNT_CHUNK_BYTES);
    let count = 0;
    let segmentBytes = 0;
    for (;;) {
      const read = readSync(fd, buf, 0, COUNT_CHUNK_BYTES, null);
      if (read <= 0) break;
      for (let i = 0; i < read; i++) {
        if (buf[i] === NEWLINE) {
          if (segmentBytes > 0) count++;
          segmentBytes = 0;
        } else {
          segmentBytes++;
        }
      }
    }
    // A final line with no trailing newline is still a line.
    if (segmentBytes > 0) count++;
    return count;
  } catch {
    return 0;
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* already closed / never opened cleanly — nothing to salvage */
    }
  }
}

/** How much of a transcript's HEAD `readChatHead` will look at. The first
 *  user line is structurally near the top (at most a `role:'bootstrap'` brief
 *  precedes it), so this is generous by orders of magnitude — it exists to cap
 *  the pathological case, not to trim the normal one. */
export const HEAD_SCAN_BYTES = 1024 * 1024;

/** How much of a transcript's TAIL `readTranscriptTail` will hydrate. Bounds
 *  the one reader that genuinely needs entry CONTENT. Historical transcripts
 *  bloated by inline blobs (pre-#119) exceed this; the newest ~8 MB is the part
 *  a user can still meaningfully scroll, and the client's seq-based replay
 *  (`readChatLinesAfter`) covers anything appended after hydration. */
export const TAIL_HYDRATE_BYTES = 8 * 1024 * 1024;

/**
 * Read at most `maxBytes` from the START of a file and return whole lines.
 *
 * A truncated trailing line is DROPPED rather than handed back for parsing —
 * a half-line is not a record, and `JSON.parse` on it would throw on every
 * call. `complete` reports whether the whole file fit, so a caller can tell
 * "no user line in this chat" from "no user line in the part I looked at".
 */
export function readHeadLines(
  path: string,
  maxBytes: number = HEAD_SCAN_BYTES
): { lines: string[]; complete: boolean } {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return { lines: [], complete: true };
  }
  try {
    // `fstatSync(fd)` — NOT `statSync(path)`. The descriptor is already open,
    // so sizing from the path re-resolves a name that may no longer be the
    // file we hold (security review F5). Same reason every read below is
    // positional on `fd`.
    const size = fstatSync(fd).size;
    const want = Math.min(size, maxBytes);
    const buf = Buffer.allocUnsafe(want);
    let filled = 0;
    while (filled < want) {
      const read = readSync(fd, buf, filled, want - filled, filled);
      if (read <= 0) break;
      filled += read;
    }
    const complete = filled >= size;
    let text = buf.subarray(0, filled).toString('utf8');
    if (!complete) {
      // Drop the partial tail line — everything after the last newline.
      const cut = text.lastIndexOf('\n');
      text = cut === -1 ? '' : text.slice(0, cut);
    }
    return { lines: text.split('\n').filter(Boolean), complete };
  } catch {
    return { lines: [], complete: true };
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* nothing to salvage */
    }
  }
}

/**
 * Read at most `maxBytes` from the END of a file and return whole lines.
 *
 * The leading partial line is dropped by slicing at the first newline INSIDE
 * the buffer, before decoding — which is also what makes the tail read
 * UTF-8-safe: cutting at a 0x0A byte can never land mid-character, whereas
 * decoding the raw window first could corrupt the boundary character.
 *
 * `truncated` tells the caller some older history was skipped.
 */
export function readTailLines(
  path: string,
  maxBytes: number = TAIL_HYDRATE_BYTES
): { lines: string[]; truncated: boolean } {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return { lines: [], truncated: false };
  }
  try {
    const size = fstatSync(fd).size;
    if (size <= maxBytes) {
      const buf = Buffer.allocUnsafe(size);
      let filled = 0;
      while (filled < size) {
        const read = readSync(fd, buf, filled, size - filled, filled);
        if (read <= 0) break;
        filled += read;
      }
      return {
        lines: buf.subarray(0, filled).toString('utf8').split('\n').filter(Boolean),
        truncated: false,
      };
    }
    const start = size - maxBytes;
    const buf = Buffer.allocUnsafe(maxBytes);
    let filled = 0;
    while (filled < maxBytes) {
      const read = readSync(fd, buf, filled, maxBytes - filled, start + filled);
      if (read <= 0) break;
      filled += read;
    }
    const window = buf.subarray(0, filled);
    const nl = window.indexOf(NEWLINE);
    // No newline in an 8 MB window means one absurd line; hydrate nothing
    // rather than hand back a fragment that cannot parse.
    const whole = nl === -1 ? Buffer.alloc(0) : window.subarray(nl + 1);
    return { lines: whole.toString('utf8').split('\n').filter(Boolean), truncated: true };
  } catch {
    return { lines: [], truncated: false };
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* nothing to salvage */
    }
  }
}

/**
 * The tail window AND its absolute line offset, resolved from ONE size
 * snapshot on ONE descriptor.
 *
 * WHY THIS EXISTS RATHER THAN CALLING THE TWO READERS IN SEQUENCE (security
 * review F4). `readChatLinesAfter` used to do `countTranscriptLinesAt(file)`
 * and then `readTailLines(file)` as separate passes. The bridge appends to
 * this exact file continuously during a live turn, so lines landing between
 * the two passes left `total` stale-low while `tail.length` was fresh-high:
 * `offset = total - tail.length` under-counted (and could go negative) and
 * every emitted `seq` shifted with it. That is precisely the permanent
 * re-attach desync — replaying content the client already has, or skipping
 * content it never got — that the seam exists to prevent, reintroduced by the
 * fix for #119 rather than by the bug.
 *
 * Both passes here are bounded by the same `size`, so anything appended
 * mid-read is invisible to BOTH and the arithmetic stays self-consistent. The
 * client picks those newer lines up on its next attach, which is exactly what
 * the seq marker is for.
 */
export function readTailWithSeq(
  path: string,
  maxBytes: number = TAIL_HYDRATE_BYTES
): { lines: string[]; offset: number; total: number } {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return { lines: [], offset: 0, total: 0 };
  }
  try {
    const size = fstatSync(fd).size;
    const total = countLinesInRange(fd, size);
    const lines = readTailInRange(fd, size, maxBytes);
    // `total` counts every non-empty line in [0, size); `lines` counts those
    // wholly inside the window. The difference is the prefix we skipped —
    // including the partial line the window dropped, which IS a whole line in
    // the file and so is correctly counted by `total`.
    return { lines, offset: Math.max(0, total - lines.length), total };
  } catch {
    return { lines: [], offset: 0, total: 0 };
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* nothing to salvage */
    }
  }
}

/** Non-empty line count over `[0, size)` of an already-open descriptor. */
function countLinesInRange(fd: number, size: number): number {
  const buf = Buffer.allocUnsafe(COUNT_CHUNK_BYTES);
  let count = 0;
  let segmentBytes = 0;
  let pos = 0;
  while (pos < size) {
    const read = readSync(fd, buf, 0, Math.min(COUNT_CHUNK_BYTES, size - pos), pos);
    if (read <= 0) break;
    for (let i = 0; i < read; i++) {
      if (buf[i] === NEWLINE) {
        if (segmentBytes > 0) count++;
        segmentBytes = 0;
      } else {
        segmentBytes++;
      }
    }
    pos += read;
  }
  if (segmentBytes > 0) count++;
  return count;
}

/** Whole lines from the last `maxBytes` of `[0, size)` on an open descriptor. */
function readTailInRange(fd: number, size: number, maxBytes: number): string[] {
  const want = Math.min(size, maxBytes);
  const start = size - want;
  const buf = Buffer.allocUnsafe(want);
  let filled = 0;
  while (filled < want) {
    const read = readSync(fd, buf, filled, want - filled, start + filled);
    if (read <= 0) break;
    filled += read;
  }
  const window = buf.subarray(0, filled);
  if (start === 0) return window.toString('utf8').split('\n').filter(Boolean);
  const nl = window.indexOf(NEWLINE);
  const whole = nl === -1 ? Buffer.alloc(0) : window.subarray(nl + 1);
  return whole.toString('utf8').split('\n').filter(Boolean);
}

// ── Writer-side blob sanitizer ───────────────────────────────────────────────

/**
 * Inline payloads at or above this size are elided from the persisted line.
 * Well above any real text chunk (agent message chunks are hundreds of bytes),
 * well below the megabyte-scale base64 that caused #119.
 */
export const INLINE_BLOB_MAX_BYTES = 4096;

/** Keys whose STRING value carries an inline binary payload in the ACP content
 *  vocabulary. `data` is the base64 field on image/audio content blocks; `uri`
 *  can carry a `data:` URL of the same magnitude; `blob` is MCP's
 *  `EmbeddedResource` carrier (security review F2 — the likeliest real-world
 *  way a megabyte payload would otherwise still reach disk).
 *
 *  NOT exhaustive by construction: an array-of-byte-numbers encoding
 *  (`data: [65, 65, …]`) passes straight through, as does any key we have not
 *  named. This is a SIZE control, not a security boundary — do not treat it
 *  as one. */
const BLOB_KEYS = new Set(['data', 'uri', 'blob']);

/** Marker left in place of an elided payload, so a reader (or a human reading
 *  the jsonl as the audit record it is) sees that something was dropped and how
 *  big it was, rather than a silently absent field. */
export interface ElidedBlob {
  _maudeElided: 'inline-blob';
  bytes: number;
}

function isElidableBlob(key: string, value: unknown): value is string {
  return BLOB_KEYS.has(key) && typeof value === 'string' && value.length >= INLINE_BLOB_MAX_BYTES;
}

/**
 * Structural clone of a transcript entry with inline binary payloads replaced
 * by a size marker.
 *
 * This is a WRITE-path guard, and it is safe precisely because the read path
 * never wanted these bytes: `readChatMessages` keeps only a tool call's name
 * and done-flag. Eliding them changes nothing a user can see, and removes
 * 66–76% of the bytes of a screenshot-heavy transcript.
 *
 * Deliberately conservative — it rewrites only `data`/`uri` strings at or over
 * `INLINE_BLOB_MAX_BYTES`. Prose, tool arguments, diffs and file contents are
 * untouched: they are the audit record of what steered an auto-approving
 * agent, and that record is load-bearing (see the note on `stripContextBlock`
 * in `transcript.ts`).
 *
 * A `data:` URI is elided whole rather than kept as a truncated prefix — half a
 * base64 payload is not more useful than none, and a truncated `data:` URI that
 * still LOOKS like a URI is worse than an honest marker.
 */
export function stripInlineBlobs<T>(value: T): T {
  return clone(value) as T;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = isElidableBlob(k, v)
      ? ({ _maudeElided: 'inline-blob', bytes: v.length } satisfies ElidedBlob)
      : clone(v);
    if (k === '__proto__') {
      // `JSON.parse` makes `__proto__` an OWN property, but plain assignment
      // hits the `Object.prototype.__proto__` setter and swaps the clone's
      // prototype instead of storing a key — so the field vanishes from the
      // serialized line (security review F6). It cannot pollute
      // `Object.prototype` here, but silently dropping a key WOULD dent the
      // audit record this sanitizer otherwise takes care to preserve.
      Object.defineProperty(out, k, {
        value: next,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      continue;
    }
    out[k] = next;
  }
  return out;
}
