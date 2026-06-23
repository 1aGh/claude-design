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

import { hostname } from 'node:os';

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
  /** The canvas's sibling `.css` (e.g. `Kanban App.css`), as opaque Y.Text.
   *  Edited via files (design:edit), not a live browser surface, so it mirrors
   *  wholesale like the body — no per-user keys, no room-clobber. Phase 9.1
   *  Gap 3. */
  css: 'css',
  /** The canvas `.meta.json` SHARED subset (layout/artboards/structure) as an
   *  opaque canonical-JSON Y.Text. Per-user keys (viewport pan/zoom) + the
   *  security opt-in (syncable) are stripped before sync — see META_LOCAL_KEYS
   *  + sharedMetaCanonical. Phase 9.1 Gap 2. */
  meta: 'meta',
  /** Doc-side sync bookkeeping (Y.Map, DDR-102): `bodyEditAt` ms-epoch stamp
   *  written by every peer that applies a LOCAL body into the doc, + `by` (a
   *  short peer label). The cold-start newest-wins decision compares it to the
   *  local file mtime. Deliberately a dedicated lane: `.meta.json`'s
   *  `last_modified` is in META_LOCAL_KEYS (per-machine, never syncs), so the
   *  meta codec CANNOT carry this. Never materialized to disk. */
  syncMeta: 'syncMeta',
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
export const MAX_META_BYTES = 1 * 1024 * 1024;
export const MAX_CSS_BYTES = 4 * 1024 * 1024;

function byteLengthUtf8(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

// DDR-054 §2g — strip dangerous keys at parse time so a hostile hub-pushed (or
// planted-commit) payload can't seed `__proto__` / `constructor` / `prototype`
// own-properties that yjs then serializes to other peers / writes to disk that
// Claude reads. Mirrors the agent's comments reviver; applied to the `.meta.json`
// parse paths (Phase D security re-audit finding A3 — the reviver had been
// applied only to the comments lane, not the symmetric meta lane).
function parseJsonSafe(s: string): unknown {
  return JSON.parse(s, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  });
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

/* ---------------------------------------------------------------- meta */

/**
 * Keys of a canvas `.meta.json` that are PER-MACHINE and MUST NOT cross the hub:
 *   - `viewport`      — this user's pan/zoom; syncing it would yank a
 *                        collaborator's camera around on every pan.
 *   - `last_modified` — a local write timestamp; syncing it churns with no signal.
 *   - `syncable`      — the security opt-in (DDR-054). A peer/hub must NEVER be
 *                        able to flip another repo's sync gate, so it stays local
 *                        and human-edited — same rationale that keeps it out of
 *                        the /_api/canvas-meta PATCH whitelist.
 * Everything else (title, sections/artboards, `layout` rects, css_mode, …) is
 * shared canvas structure and DOES sync — that's how an artboard move on one
 * machine reaches the other's disk.
 */
export const META_LOCAL_KEYS = ['viewport', 'last_modified', 'syncable'] as const;

/** Canonical JSON of the SHARED subset of a parsed meta object: local keys
 *  dropped, remaining keys sorted so equal content always serializes byte-equal
 *  (stable → the no-op guards stay quiet and sync doesn't churn). */
function sharedMetaCanonical(meta: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(meta).sort()) {
    if ((META_LOCAL_KEYS as readonly string[]).includes(k)) continue;
    out[k] = meta[k];
  }
  return JSON.stringify(out);
}

/** The synced shared-meta JSON string held in the doc, or null when unset. */
export function metaFromDoc(doc: Y.Doc): string | null {
  const s = doc.getText(Y_SYNC_TYPES.meta).toString();
  return s.length > 0 ? s : null;
}

/**
 * Apply a FULL `.meta.json` string to the doc as its shared subset: parse, strip
 * per-user/security keys, store the canonical shared JSON in a Y.Text. Returns
 * false on parse error / over-cap / no change.
 */
export function applyMetaToDoc(doc: Y.Doc, fullMetaJson: string, origin?: unknown): boolean {
  let obj: unknown;
  try {
    obj = parseJsonSafe(fullMetaJson);
  } catch {
    return false;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const shared = sharedMetaCanonical(obj as Record<string, unknown>);
  if (byteLengthUtf8(shared) > MAX_META_BYTES) {
    console.warn(
      `[sync/codec] refusing meta apply > ${MAX_META_BYTES} bytes (got ${byteLengthUtf8(shared)}). DDR-054 §2d.`
    );
    return false;
  }
  const t = doc.getText(Y_SYNC_TYPES.meta);
  if (t.toString() === shared) return false;
  doc.transact(() => {
    if (t.length > 0) t.delete(0, t.length);
    t.insert(0, shared);
  }, origin);
  return true;
}

/**
 * Merge the synced shared-meta into a local `.meta.json` string, PRESERVING the
 * local per-user/security keys (META_LOCAL_KEYS). Shared keys become exactly
 * what the doc holds (so a deletion on the source propagates); the local keys
 * are layered back on top. Returns the merged JSON (2-space, trailing newline)
 * ready to write, or null when the shared payload is unparseable.
 */
export function mergeSharedMetaIntoLocal(
  localMetaJson: string | null,
  sharedJson: string
): string | null {
  let shared: unknown;
  try {
    shared = parseJsonSafe(sharedJson);
  } catch {
    return null;
  }
  if (!shared || typeof shared !== 'object' || Array.isArray(shared)) return null;
  let local: Record<string, unknown> = {};
  if (localMetaJson) {
    try {
      const parsed = parseJsonSafe(localMetaJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        local = parsed as Record<string, unknown>;
      }
    } catch {
      /* unparseable local meta — treat as empty; the shared subset becomes the base */
    }
  }
  const merged: Record<string, unknown> = { ...(shared as Record<string, unknown>) };
  for (const k of META_LOCAL_KEYS) {
    if (k in local) merged[k] = local[k];
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

/* ---------------------------------------------------------------- syncMeta */

/** Short peer label for `syncMeta.by` — os.hostname() truncated. Informational
 *  only (status surfaces); never trusted for decisions. */
const PEER_LABEL_MAX = 32;
function peerLabel(): string {
  try {
    return hostname().slice(0, PEER_LABEL_MAX);
  } catch {
    return 'unknown';
  }
}

/**
 * Stamp `syncMeta.bodyEditAt` (+ `by`) on the doc. Call this in the SAME
 * transaction + origin as every local→doc body apply (agent applyFromFs html
 * branch, reconcile seed-up, migrate-seed adopt, projection file→doc body
 * import) so peers receive ONE update and origin-filtering stays intact.
 * yjs nests transactions — wrapping `applyHtmlToDoc` + `stampBodyEdit` in an
 * outer `doc.transact(fn, origin)` produces a single update.
 */
export function stampBodyEdit(doc: Y.Doc, origin?: unknown, nowMs?: number): void {
  const map = doc.getMap<unknown>(Y_SYNC_TYPES.syncMeta);
  doc.transact(() => {
    map.set('bodyEditAt', nowMs ?? Date.now());
    map.set('by', peerLabel());
  }, origin);
}

/** The doc-side body-edit stamp, or null when no peer ever stamped (older
 *  peers don't write syncMeta → callers fall back to hub-wins, interop-safe). */
export function bodyEditAtFromDoc(doc: Y.Doc): number | null {
  const v = doc.getMap<unknown>(Y_SYNC_TYPES.syncMeta).get('bodyEditAt');
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Record THIS doc's clientID as the seeder in `syncMeta.seededBy` (F1). Call it
 * in the SAME transaction + origin as a `seed-local-up` body apply. The value is
 * a Yjs clientID, so when two peers seed the same empty hub simultaneously and
 * their maps merge, Y.Map's deterministic last-writer-wins resolution converges
 * `seededBy` to ONE clientID on EVERY peer — that elected peer is the
 * single-writer that performs the de-duplication repair, so the collapse op is
 * never emitted twice. Informational/bookkeeping only; never materialized to
 * disk (syncMeta is a sync-internal lane).
 */
export function markSeeded(doc: Y.Doc, origin?: unknown): void {
  const map = doc.getMap<unknown>(Y_SYNC_TYPES.syncMeta);
  doc.transact(() => {
    map.set('seededBy', doc.clientID);
  }, origin);
}

/** The elected seeder's clientID (`syncMeta.seededBy`), or null when no peer
 *  ever seeded through the marker path (older peers / non-seed canvases). */
export function seededByFromDoc(doc: Y.Doc): number | null {
  const v = doc.getMap<unknown>(Y_SYNC_TYPES.syncMeta).get('seededBy');
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* ---------------------------------------------------------------- css */

/** The synced canvas CSS string held in the doc, or null when unset/empty. */
export function cssFromDoc(doc: Y.Doc): string | null {
  const s = doc.getText(Y_SYNC_TYPES.css).toString();
  return s.length > 0 ? s : null;
}

/**
 * Apply the canvas's `.css` to the doc as opaque Y.Text (wholesale replace).
 * CSS round-trips byte-identically (we write exactly the doc string back), so a
 * wholesale delete+insert can't churn; the equality short-circuit keeps it quiet
 * when unchanged. Returns false on over-cap / no change.
 */
export function applyCssToDoc(doc: Y.Doc, next: string, origin?: unknown): boolean {
  if (byteLengthUtf8(next) > MAX_CSS_BYTES) {
    console.warn(
      `[sync/codec] refusing CSS apply > ${MAX_CSS_BYTES} bytes (got ${byteLengthUtf8(next)}). DDR-054 §2d.`
    );
    return false;
  }
  const t = doc.getText(Y_SYNC_TYPES.css);
  if (t.toString() === next) return false;
  doc.transact(() => {
    if (t.length > 0) t.delete(0, t.length);
    t.insert(0, next);
  }, origin);
  return true;
}
