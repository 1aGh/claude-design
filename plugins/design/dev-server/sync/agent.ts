// Per-canvas bidirectional sync agent — Phase 9 Task 4.
//
// Wires together the Y.Doc the HocuspocusProvider keeps in sync with the hub
// and the local on-disk files Claude Code reads + writes:
//
//   `.design/<slug>.html`           ←→ Y.Text  (Y_SYNC_TYPES.html)
//   `.design/_comments/<slug>.json` ←→ Y.Array (Y_TYPES.comments)
//   `.design/<slug>.annotations.svg`←→ Y.Map.svg (Y_TYPES.annotations)
//
// Provider is INJECTED — the agent doesn't import @hocuspocus/provider. This
// keeps the orchestration testable with an in-memory pair of Y.Docs (no hub
// process required) and makes the wiring layer (sync/index.ts) responsible
// for the HocuspocusProvider lifecycle.
//
// Flow A — local edit (Claude `Write`, designer ⌘S) → hub:
//   1. fs.watch fires → fs-mirror debounces 250ms → onRead({bytes, hash})
//   2. echoGuard.consume(path, hash) returns false (genuine edit)
//   3. applyHtmlToDoc(doc, str, agentOrigin) — emits Y op
//   4. HocuspocusProvider broadcasts the op to hub → other peers
//
// Flow B — hub broadcasts other peer's edit → us:
//   1. Provider applies update to doc with NON-agent origin
//   2. doc.on('update') schedules a 800ms-debounced flush
//   3. On flush: htmlFromDoc(doc) → echoGuard.record(path, hash) → atomicWrite
//   4. fs.watch fires → fs-mirror reads → onRead matches the recorded echo
//      → echoGuard.consume returns true → event dropped (no infinite loop)
//
// 800ms quiescence matches the existing Phase 8 collab room flush (DDR-051).

import { existsSync, readFileSync } from 'node:fs';

import type * as Y from 'yjs';

import { atomicWrite } from './atomic-write.ts';
import {
  Y_SYNC_TYPES,
  annotationsFromDoc,
  applyAnnotationsToDoc,
  applyCommentsToDoc,
  applyCssToDoc,
  applyHtmlToDoc,
  applyMetaToDoc,
  commentsFromDoc,
  cssFromDoc,
  htmlFromDoc,
  mergeSharedMetaIntoLocal,
  metaFromDoc,
} from './codec.ts';
import { type EchoGuard, hashBytes } from './echo-guard.ts';

export const DOC_FLUSH_MS = 800;

export interface CanvasSyncPaths {
  /** Absolute path to <designRoot>/<canvas>.html. */
  html: string;
  /** Absolute path to <designRoot>/_comments/<slug>.json. */
  comments: string;
  /** Absolute path to <designRoot>/<slug>.annotations.svg. */
  annotations: string;
  /** Absolute path to the canvas `.meta.json` (sibling of the body). Optional:
   *  when set (always, in production wiring), shared meta keys (layout/artboards)
   *  sync while per-user viewport stays local (Phase 9.1 Gap 2). Omitted in
   *  older test constructions → meta sync is simply inert. */
  meta?: string;
  /** Absolute path to the canvas's sibling `.css` (Phase 9.1 Gap 3). Optional —
   *  inline-CSS canvases have none; omitted/absent → css sync is inert. */
  css?: string;
}

export interface CanvasSyncAgentOptions {
  slug: string;
  doc: Y.Doc;
  paths: CanvasSyncPaths;
  echoGuard: EchoGuard;
  /** When true, the first reconcile() pushes local disk state up to the doc
   *  instead of overwriting disk with the doc state. Cleared after first run. */
  adopt?: boolean;
  /** Override the 800ms flush. Tests use 0 to flush synchronously. */
  flushMs?: number;
  /** Injected for tests — defaults to atomicWrite. */
  writer?: (path: string, bytes: string | Uint8Array) => void;
  /**
   * Called when a non-adopt reconcile (cold-start / post-git-pull) overwrites
   * differing, non-empty local content with hub state — i.e. the local peer
   * had divergent work that hub-wins discarded. Lets the runtime surface a
   * "hub overwrote your local changes" notification (Phase 9 Task 8). v1.1
   * resolution is always hub-wins; the interactive 3-way prompt is deferred.
   */
  onConflict?: (info: { slug: string; kind: 'cold-start-hub-wins' }) => void;
}

export interface CanvasSyncAgent {
  readonly slug: string;
  /** Set up the doc.on('update') listener. Idempotent. */
  start(): void;
  /**
   * Reconcile disk ↔ doc once. In adopt mode, disk wins; otherwise doc
   * (= hub) wins. Call this AFTER the provider's `synced` event.
   */
  reconcile(): Promise<void>;
  /** Apply an fs event (from fs-mirror) to the doc, honoring echo guard. */
  applyFromFs(evt: { path: string; bytes: Uint8Array; hash: string }): boolean;
  /** Force the pending flush timer immediately. */
  flush(): Promise<void>;
  /** Stop all timers + listeners. */
  stop(): void;
  /** Test/inspection: the origin tag used on agent-applied transactions. */
  readonly origin: object;
}

export function createCanvasSyncAgent(opts: CanvasSyncAgentOptions): CanvasSyncAgent {
  const { slug, doc, paths, echoGuard } = opts;
  const flushMs = opts.flushMs ?? DOC_FLUSH_MS;
  const writer = opts.writer ?? atomicWrite;
  let adopt = !!opts.adopt;

  const origin = Object.freeze({ agent: 'sync', slug });

  let started = false;
  let stopped = false;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Tracks the last-written contents for each path so we don't issue redundant
  // disk writes when a flush fires but the projection hasn't changed.
  let lastHtml: string | null = null;
  let lastComments: string | null = null;
  let lastAnnotations: string | null = null;
  let lastMeta: string | null = null;
  let lastCss: string | null = null;

  function onDocUpdate(_update: Uint8Array, updateOrigin: unknown): void {
    if (stopped) return;
    // Self-applied (we just synced from disk) — disk is already current.
    if (updateOrigin === origin) return;
    scheduleFlush();
  }

  function scheduleFlush(): void {
    dirty = true;
    if (flushMs === 0) {
      // Synchronous mode for tests — fire on next microtask so the doc
      // observer has fully run.
      queueMicrotask(() => {
        void flush();
      });
      return;
    }
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, flushMs);
  }

  async function flush(): Promise<void> {
    if (!dirty || stopped) return;
    dirty = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    try {
      writeHtmlIfChanged();
      writeCommentsIfChanged();
      writeAnnotationsIfChanged();
      writeMetaIfChanged();
      writeCssIfChanged();
    } catch (err) {
      dirty = true;
      console.error(`[sync/${slug}] flush failed:`, err);
    }
  }

  function writeHtmlIfChanged(): void {
    const next = htmlFromDoc(doc);
    if (next === lastHtml) return;
    const hash = hashBytes(next);
    echoGuard.record(paths.html, hash);
    writer(paths.html, next);
    lastHtml = next;
  }

  function writeCommentsIfChanged(): void {
    const next = commentsFromDoc(doc);
    const serialized = next.length > 0 ? `${JSON.stringify(next, null, 2)}\n` : '';
    if (serialized === lastComments) return;
    if (serialized === '') {
      // Empty comments — don't create an empty file; just remember the state.
      lastComments = serialized;
      return;
    }
    const hash = hashBytes(serialized);
    echoGuard.record(paths.comments, hash);
    writer(paths.comments, serialized);
    lastComments = serialized;
  }

  function writeAnnotationsIfChanged(): void {
    const next = annotationsFromDoc(doc);
    const value = next ?? '';
    if (value === lastAnnotations) return;
    if (value === '') {
      // Empty annotations — same handling as comments.
      lastAnnotations = value;
      return;
    }
    const hash = hashBytes(value);
    echoGuard.record(paths.annotations, hash);
    writer(paths.annotations, value);
    lastAnnotations = value;
  }

  function writeMetaIfChanged(): void {
    if (!paths.meta) return;
    const shared = metaFromDoc(doc);
    if (shared === lastMeta) return;
    lastMeta = shared;
    if (shared === null) return; // doc carries no shared meta yet — nothing to merge down
    const local = readLocal(paths.meta);
    const merged = mergeSharedMetaIntoLocal(local, shared);
    if (merged === null || merged === local) return; // unparseable, or disk already matches
    const hash = hashBytes(merged);
    echoGuard.record(paths.meta, hash);
    writer(paths.meta, merged);
  }

  function writeCssIfChanged(): void {
    if (!paths.css) return;
    const next = cssFromDoc(doc);
    if (next === lastCss) return;
    lastCss = next;
    if (next === null) return; // doc carries no css yet — nothing to write
    const hash = hashBytes(next);
    echoGuard.record(paths.css, hash);
    writer(paths.css, next);
  }

  function applyFromFs(evt: { path: string; bytes: Uint8Array; hash: string }): boolean {
    if (stopped) return false;
    // Echo of our own atomicWrite — drop.
    if (echoGuard.consume(evt.path, evt.hash)) return false;

    const str = bytesToString(evt.bytes);
    if (evt.path === paths.html) {
      const changed = applyHtmlToDoc(doc, str, origin);
      if (changed) lastHtml = htmlFromDoc(doc);
      return changed;
    }
    if (evt.path === paths.comments) {
      const parsed = tryParseJsonArray(str);
      if (parsed === null) return false;
      const changed = applyCommentsToDoc(doc, parsed, origin);
      if (changed) lastComments = str;
      return changed;
    }
    if (evt.path === paths.annotations) {
      const changed = applyAnnotationsToDoc(doc, str, origin);
      if (changed) lastAnnotations = str;
      return changed;
    }
    if (paths.meta && evt.path === paths.meta) {
      // Local meta changed (canvas-meta PATCH / design:edit) → push its SHARED
      // subset (layout/artboards, minus per-user viewport) into the doc.
      const changed = applyMetaToDoc(doc, str, origin);
      if (changed) lastMeta = metaFromDoc(doc);
      return changed;
    }
    if (paths.css && evt.path === paths.css) {
      const changed = applyCssToDoc(doc, str, origin);
      if (changed) lastCss = str;
      return changed;
    }
    return false;
  }

  async function reconcile(): Promise<void> {
    if (stopped) return;
    const localHtml = readLocal(paths.html);
    const localComments = readLocal(paths.comments);
    const localAnnotations = readLocal(paths.annotations);
    const localMeta = paths.meta ? readLocal(paths.meta) : null;
    const localCss = paths.css ? readLocal(paths.css) : null;

    const docHtml = htmlFromDoc(doc);
    const docComments = commentsFromDoc(doc);
    const docCommentsStr =
      docComments.length > 0 ? `${JSON.stringify(docComments, null, 2)}\n` : '';
    const docAnnotations = annotationsFromDoc(doc) ?? '';
    const docMeta = metaFromDoc(doc);
    const docCss = cssFromDoc(doc);

    if (adopt) {
      // Push local up: doc takes its values from disk. Hub becomes our
      // canonical view of this canvas. One-shot.
      if (localHtml !== null) applyHtmlToDoc(doc, localHtml, origin);
      if (localComments !== null) {
        const parsed = tryParseJsonArray(localComments);
        if (parsed !== null) applyCommentsToDoc(doc, parsed, origin);
      }
      if (localAnnotations !== null) applyAnnotationsToDoc(doc, localAnnotations, origin);
      if (paths.meta && localMeta !== null) applyMetaToDoc(doc, localMeta, origin);
      if (paths.css && localCss !== null) applyCssToDoc(doc, localCss, origin);
      lastHtml = localHtml ?? '';
      lastComments = localComments ?? '';
      lastAnnotations = localAnnotations ?? '';
      lastMeta = metaFromDoc(doc);
      lastCss = cssFromDoc(doc);
      adopt = false;
      return;
    }

    // Hub-wins (default): overwrite disk from doc when they differ.
    lastHtml = docHtml;
    lastComments = docCommentsStr;
    lastAnnotations = docAnnotations;
    lastMeta = docMeta;
    lastCss = docCss;
    if (localHtml !== docHtml) {
      // DATA-LOSS GUARD: an EMPTY hub doc at cold-start means the hub holds no
      // body for this slug yet (fresh / never-seeded hub) — NOT an authoritative
      // "this canvas is blank". Overwriting a non-empty local body with it would
      // silently destroy the canvas (observed in the wild: a fresh hub emptied
      // every local .tsx on first connect). The comments/annotations/meta/css
      // branches below already skip empty-doc writes, and the shared-doc
      // projection path documents the same "never clobber non-empty local with
      // an empty doc value" rule — the HTML body was the one branch missing it.
      // Resolution: seed the doc FROM local instead, so the body survives AND
      // the hub gets our content (local→doc, exactly like a first-sync seed).
      if (docHtml === '' && localHtml !== null && localHtml.trim() !== '') {
        applyHtmlToDoc(doc, localHtml, origin);
        lastHtml = localHtml;
      } else {
        // Local had divergent, non-empty content that hub-wins is discarding —
        // notify so the user knows their local edits were overwritten (Task 8).
        // An absent/empty local file is a clean first-sync, not a conflict.
        if (localHtml !== null && localHtml.trim() !== '') {
          opts.onConflict?.({ slug, kind: 'cold-start-hub-wins' });
        }
        const hash = hashBytes(docHtml);
        echoGuard.record(paths.html, hash);
        writer(paths.html, docHtml);
      }
    }
    if (docCommentsStr !== '' && localComments !== docCommentsStr) {
      const hash = hashBytes(docCommentsStr);
      echoGuard.record(paths.comments, hash);
      writer(paths.comments, docCommentsStr);
    }
    if (docAnnotations !== '' && localAnnotations !== docAnnotations) {
      const hash = hashBytes(docAnnotations);
      echoGuard.record(paths.annotations, hash);
      writer(paths.annotations, docAnnotations);
    }
    // Meta: merge the doc's shared subset (layout/artboards) into local,
    // preserving this machine's viewport + syncable. Only writes when the merge
    // actually changes the file (a fresh peer with no local viewport, or an
    // artboard layout the hub carries that local lacks).
    if (paths.meta && docMeta !== null) {
      const merged = mergeSharedMetaIntoLocal(localMeta, docMeta);
      if (merged !== null && merged !== localMeta) {
        const hash = hashBytes(merged);
        echoGuard.record(paths.meta, hash);
        writer(paths.meta, merged);
      }
    }
    if (paths.css && docCss !== null && localCss !== docCss) {
      const hash = hashBytes(docCss);
      echoGuard.record(paths.css, hash);
      writer(paths.css, docCss);
    }
  }

  return {
    slug,
    origin,
    start() {
      if (started) return;
      doc.on('update', onDocUpdate);
      started = true;
    },
    reconcile,
    applyFromFs,
    flush,
    stop() {
      stopped = true;
      doc.off('update', onDocUpdate);
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    },
  };
}

/* ---------------------------------------------------------------- helpers */

function readLocal(p: string): string | null {
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Reviver strips dangerous keys at parse time so a malicious hub-pushed
// payload (or a planted commit) can't seed `__proto__` / `constructor` /
// `prototype` own-properties into the comment objects yjs subsequently
// serializes to other peers. Modern V8/Bun block direct Object.prototype
// pollution at parse, but the reviver also closes the cross-machine
// propagation surface where an unsafe `for…in` on a peer would re-pollute.
// DDR-054 §2g (defender M2).
function tryParseJsonArray(s: string): unknown[] | null {
  try {
    const parsed = JSON.parse(s, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Re-export for the wiring layer to know which shared type holds HTML.
export { Y_SYNC_TYPES };
