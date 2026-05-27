// Y.Doc ↔ disk codecs for the bidirectional file sync agent (Phase 9 Task 4).
//
// The agent shuttles three classes of files between disk and the Y.Doc the
// HocuspocusProvider holds:
//
//   `.design/<canvas>.html`             -> Y.Text     (Y_SYNC_TYPES.html)
//   `.design/_comments/<slug>.json`     -> Y.Array    (Y_TYPES.comments  — Phase 6)
//   `.design/<slug>.annotations.svg`    -> Y.Map.svg  (Y_TYPES.annotations — Phase 5)
//
// v1.1 design decision (plan §"Key insight"): HTML body is treated as opaque
// Y.Text rather than structured Y.XmlFragment. Round-trip drift would
// otherwise cause infinite sync churn — every time we serialize the structured
// CRDT back to HTML the formatting whitespace would shift and re-enter the
// system as a new mutation. Structured CRDT (true element-level co-editing) is
// Phase 10 / v1.2.
//
// The "diff-aware" applyHtmlToDoc replaces the Y.Text contents using a
// longest-common-prefix + suffix elimination so other peers see a minimal
// op (e.g. "user changed character 42 only"). This isn't a true textual diff
// (no LCS), but it's drastically cheaper for typical edits than `delete-all +
// insert-all`, and crucially preserves cursor positions other peers may have
// in the unchanged regions.

import type * as Y from 'yjs';

import { Y_TYPES } from '../collab/persistence.ts';

/**
 * Y.Doc shared-type names introduced by Task 4. Distinct namespace from
 * Y_TYPES so existing comments / annotations stay untouched; new fields
 * land here.
 */
export const Y_SYNC_TYPES = {
  /** The canvas HTML body, as opaque Y.Text. */
  html: 'html',
} as const;

/**
 * Hard caps on hub-pushed content (DDR-054 §2d — closes attacker F7). yjs
 * has no upstream-enforced size cap; the codec is the consumer's guard.
 * Mirrors the existing /_api/annotations 1 MB cap (api.ts) so the sync path
 * doesn't bypass the HTTP-layer guard.
 */
export const MAX_HTML_BYTES = 4 * 1024 * 1024;
export const MAX_COMMENTS_BYTES = 1 * 1024 * 1024;
export const MAX_ANNOTATIONS_BYTES = 1 * 1024 * 1024;

function byteLengthUtf8(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

/* ---------------------------------------------------------------- HTML */

export function htmlFromDoc(doc: Y.Doc): string {
  return doc.getText(Y_SYNC_TYPES.html).toString();
}

/**
 * Apply `next` to the Y.Text inside `doc`. Uses a minimal common-prefix /
 * common-suffix replace so peers see a small op rather than a full replace.
 *
 * Pass `origin` as the transaction origin so a downstream observer can
 * distinguish self-originated updates from peer/remote ones.
 */
export function applyHtmlToDoc(doc: Y.Doc, next: string, origin?: unknown): boolean {
  if (byteLengthUtf8(next) > MAX_HTML_BYTES) {
    console.warn(
      `[sync/codec] refusing HTML apply > ${MAX_HTML_BYTES} bytes (got ${byteLengthUtf8(next)}). DDR-054 §2d.`
    );
    return false;
  }
  const yText = doc.getText(Y_SYNC_TYPES.html);
  const current = yText.toString();
  if (current === next) return false;

  // Find longest common prefix.
  let prefix = 0;
  const maxPrefix = Math.min(current.length, next.length);
  while (prefix < maxPrefix && current.charCodeAt(prefix) === next.charCodeAt(prefix)) {
    prefix++;
  }
  // Find longest common suffix that doesn't overlap the prefix.
  let suffix = 0;
  const maxSuffix = Math.min(current.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    current.charCodeAt(current.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix++;
  }

  const deleteLen = current.length - prefix - suffix;
  const insertStr = next.slice(prefix, next.length - suffix);

  doc.transact(() => {
    if (deleteLen > 0) yText.delete(prefix, deleteLen);
    if (insertStr.length > 0) yText.insert(prefix, insertStr);
  }, origin);

  return true;
}

/* ---------------------------------------------------------------- comments */

/**
 * Comments JSON payload — opaque to the codec, just the array of objects the
 * Y.Array holds.
 */
export type CommentsSnapshot = unknown[];

export function commentsFromDoc(doc: Y.Doc): CommentsSnapshot {
  const arr = doc.getArray(Y_TYPES.comments);
  return arr.toArray();
}

export function applyCommentsToDoc(doc: Y.Doc, next: CommentsSnapshot, origin?: unknown): boolean {
  const arr = doc.getArray(Y_TYPES.comments);
  // Comments are LWW on the JSON file (the snapshot is the source of truth);
  // collapse Y.Array to the new state. For v1.1 we just replace wholesale —
  // structural comment-level merge is deferred along with structured HTML.
  // Check whether anything actually changed to avoid no-op transactions
  // (transactions still fire `update` events, which would re-enter the loop).
  const before = JSON.stringify(arr.toArray());
  const after = JSON.stringify(next);
  if (byteLengthUtf8(after) > MAX_COMMENTS_BYTES) {
    console.warn(
      `[sync/codec] refusing comments apply > ${MAX_COMMENTS_BYTES} bytes (got ${byteLengthUtf8(after)}). DDR-054 §2d.`
    );
    return false;
  }
  if (before === after) return false;

  doc.transact(() => {
    if (arr.length > 0) arr.delete(0, arr.length);
    if (next.length > 0) arr.push(next);
  }, origin);
  return true;
}

/* ---------------------------------------------------------------- annotations */

/** Returns the annotations SVG string, or null if unset. */
export function annotationsFromDoc(doc: Y.Doc): string | null {
  const map = doc.getMap<unknown>(Y_TYPES.annotations);
  const svg = map.get('svg');
  return typeof svg === 'string' ? svg : null;
}

export function applyAnnotationsToDoc(doc: Y.Doc, next: string | null, origin?: unknown): boolean {
  if (next !== null && byteLengthUtf8(next) > MAX_ANNOTATIONS_BYTES) {
    console.warn(
      `[sync/codec] refusing annotations apply > ${MAX_ANNOTATIONS_BYTES} bytes (got ${byteLengthUtf8(next)}). DDR-054 §2d.`
    );
    return false;
  }
  const map = doc.getMap<unknown>(Y_TYPES.annotations);
  const current = map.get('svg');
  const currentStr = typeof current === 'string' ? current : null;
  if (currentStr === next) return false;

  doc.transact(() => {
    if (next === null || next === '') {
      map.delete('svg');
    } else {
      map.set('svg', next);
    }
  }, origin);
  return true;
}
