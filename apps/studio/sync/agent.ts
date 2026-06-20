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
//
// Cold-start resolution (DDR-102, supersedes the v1.1 "always hub-wins"):
// reconcile() feeds the journal-aware decision table in cold-start.ts. A
// hub-wins overwrite of local disk happens ONLY on a clean fast-forward
// (local hash == journal hash); genuine divergence snapshots BOTH versions
// to `_history/<slug>/` and resolves newest-wins (doc syncMeta.bodyEditAt vs
// local file mtime; unknown/tie → hub). Comments union-merge by id.

import { existsSync, readFileSync, statSync } from 'node:fs';

import type * as Y from 'yjs';

import { atomicWrite } from './atomic-write.ts';
import {
  annotationsFromDoc,
  applyAnnotationsToDoc,
  applyCommentsToDoc,
  applyCssToDoc,
  applyHtmlToDoc,
  applyMetaToDoc,
  bodyEditAtFromDoc,
  commentsFromDoc,
  cssFromDoc,
  htmlFromDoc,
  markSeeded,
  mergeSharedMetaIntoLocal,
  metaFromDoc,
  seededByFromDoc,
  stampBodyEdit,
  Y_SYNC_TYPES,
} from './codec.ts';
import { decideColdStart, isExactRepeat, unionCommentsById } from './cold-start.ts';
import { type EchoGuard, hashBytes } from './echo-guard.ts';
import type { SyncJournal } from './journal.ts';

export const DOC_FLUSH_MS = 800;

/**
 * Window after a `seed-local-up` during which this agent will repair a
 * concurrent-seed duplication (F1). Bounded so the repair only ever fires for
 * the cold-start race — a genuine peer edit that arrives minutes later is NEVER
 * collapsed back to our original seed. Generous relative to the hub sync RTT.
 */
export const SEED_REPAIR_WINDOW_MS = 10_000;

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
   * Per-machine sync journal (DDR-102) — the divergence detector. Every
   * successful disk↔doc traversal checkpoints the content hash here; the
   * cold-start decision allows a hub-wins overwrite ONLY when local matches
   * the journal (clean fast-forward). Optional — older test constructions
   * without it simply degrade to the conservative conflict path.
   */
  journal?: SyncJournal;
  /**
   * Snapshot writer (DDR-102 conflict protocol) — persists a body version to
   * `_history/<slug>/` and resolves with the snapshot's ISO ts (null on
   * failure). The runtime wires this to history.ts `writeSnapshot`. Optional —
   * without it the conflict path still resolves newest-wins, just without the
   * recovery snapshots (test-only constructions).
   */
  snapshot?: (content: string, reason: 'pre-sync-local' | 'pre-sync-hub') => Promise<string | null>;
  /**
   * Called when a non-adopt reconcile (cold-start / post-git-pull) found
   * divergent non-empty content on both sides (DDR-102). `winner` is the side
   * newest-wins kept; `snapshots` carries the `_history/` ISO timestamps of
   * the pre-resolution versions (when the snapshot writer is wired). The
   * legacy `cold-start-hub-wins` kind stays in the union for old readers.
   */
  onConflict?: (info: {
    slug: string;
    kind: 'cold-start-hub-wins' | 'cold-start-diverged';
    winner?: 'local' | 'hub';
    snapshots?: { local?: string; hub?: string };
    /** DDR-102 fail-closed (F1): the local snapshot didn't land, so the
     *  hub-wins overwrite was refused and local kept instead. */
    snapshotFailed?: boolean;
  }) => void;
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

  // F1 — the body this agent pushed on `seed-local-up`, plus the deadline past
  // which the de-dup repair stops firing. Set on seed; nulled only when the
  // window lapses (after convergence the repair is a cheap no-op — the
  // `body === seedInfo.body` guard short-circuits, so we don't bother clearing).
  // Null = this agent never seeded (so it never repairs).
  let seedInfo: { body: string; until: number } | null = null;

  function onDocUpdate(_update: Uint8Array, updateOrigin: unknown): void {
    if (stopped) return;
    // Self-applied (we just synced from disk) — disk is already current.
    if (updateOrigin === origin) return;
    // F1 — a remote update during the seed window may have concatenated a
    // concurrent peer's identical seed onto ours. Collapse it (single elected
    // writer) BEFORE the flush below can mirror a doubled body to disk.
    maybeRepairSeedDuplication();
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

  /**
   * F1 — collapse a concurrent cold-seed duplication. When two peers
   * `seed-local-up` the SAME body into an empty hub at the same instant, the
   * merged Y.Text holds both insertions (`BODY` × N — un-buildable). This runs
   * on every remote update inside the seed window and, on the single peer the
   * `seededBy` Y.Map LWW elected, re-applies the canonical body so
   * `applyHtmlToDoc`'s diff deletes the trailing duplicate(s). Only the elected
   * owner repairs → the collapse op is emitted once and converges across peers
   * (a non-owner just receives the delete). Restricted to an EXACT repeat of our
   * seed: a divergent edit carries genuine bytes, so we DON'T touch it here —
   * silently collapsing it would discard content. NOTE: that leaves the rare
   * "two DIFFERENT bodies seeded into one empty hub at the same instant" case
   * un-buildable until the NEXT boot, when `decideColdStart` routes it through
   * the conflict path (dual snapshot + newest-wins). This live repair only
   * covers the identical-seed race (the F1 RCA's scenario); the divergent
   * variant is an accepted follow-up, not handled in-flight.
   */
  function maybeRepairSeedDuplication(): void {
    if (!seedInfo) return;
    if (Date.now() > seedInfo.until) {
      seedInfo = null;
      return;
    }
    const owner = seededByFromDoc(doc);
    if (owner === null || owner !== doc.clientID) return; // not the elected writer
    const body = htmlFromDoc(doc);
    if (body === seedInfo.body) return; // already a single copy
    if (!isExactRepeat(body, seedInfo.body)) return; // divergent edit → conflict path owns it
    const canonical = seedInfo.body;
    doc.transact(() => {
      if (applyHtmlToDoc(doc, canonical, origin)) stampBodyEdit(doc, origin);
    }, origin);
    lastHtml = canonical;
    opts.journal?.record(slug, { bodyHash: hashBytes(canonical) });
    console.warn(
      `[sync/${slug}] concurrent cold-seed duplication detected — collapsed to one copy (F1).`
    );
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
    // DDR-102 — a successful doc→disk body flush is a journal checkpoint:
    // disk now holds exactly what the hub holds.
    opts.journal?.record(slug, { bodyHash: hash });
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
    opts.journal?.record(slug, { cssHash: hash }); // DDR-102 checkpoint
  }

  function applyFromFs(evt: { path: string; bytes: Uint8Array; hash: string }): boolean {
    if (stopped) return false;
    // Echo of our own atomicWrite — drop.
    if (echoGuard.consume(evt.path, evt.hash)) return false;

    const str = bytesToString(evt.bytes);
    if (evt.path === paths.html) {
      // Body apply + syncMeta stamp in ONE transaction (same origin) so peers
      // receive a single update and the newest-wins stamp rides the body edit.
      let changed = false;
      doc.transact(() => {
        changed = applyHtmlToDoc(doc, str, origin);
        if (changed) stampBodyEdit(doc, origin);
      }, origin);
      if (changed) {
        lastHtml = htmlFromDoc(doc);
        // DDR-102 — a successful disk→doc body apply is a journal checkpoint.
        opts.journal?.record(slug, { bodyHash: evt.hash });
      }
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
      if (changed) {
        lastCss = str;
        opts.journal?.record(slug, { cssHash: evt.hash }); // DDR-102 checkpoint
      }
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
      if (localHtml !== null) {
        doc.transact(() => {
          if (applyHtmlToDoc(doc, localHtml, origin)) stampBodyEdit(doc, origin);
          // F1 — adopt is also a "seed local up" (first link / fresh hub); claim
          // it + arm the repair window so two peers adopting the same draft into
          // one hub at once self-heal the same way the decision-table seed does.
          markSeeded(doc, origin);
        }, origin);
        seedInfo = { body: localHtml, until: Date.now() + SEED_REPAIR_WINDOW_MS };
      }
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
      // DDR-102 — adopt is a disk→doc traversal: checkpoint it so the next
      // boot fast-forwards instead of re-entering the conflict path.
      if (localHtml !== null) {
        opts.journal?.record(slug, {
          bodyHash: hashBytes(localHtml),
          ...(localCss !== null ? { cssHash: hashBytes(localCss) } : {}),
        });
      }
      return;
    }

    // ---- body: cold-start decision table (DDR-102; replaces v1.1 hub-wins) --
    const decision = decideColdStart({
      localBody: localHtml,
      docBody: docHtml,
      journalHash: opts.journal?.get(slug)?.bodyHash ?? null,
      localMtimeMs: localMtimeMs(paths.html),
      docBodyEditAtMs: bodyEditAtFromDoc(doc),
    });

    // Which side owns the visually-coupled lanes (annotations/css) below.
    let bodyWinner: 'local' | 'hub' = 'hub';

    const writeBodyFromDoc = (): void => {
      const hash = hashBytes(docHtml);
      echoGuard.record(paths.html, hash);
      writer(paths.html, docHtml);
      lastHtml = docHtml;
      opts.journal?.record(slug, { bodyHash: hash });
    };
    const seedBodyUp = (body: string): void => {
      doc.transact(() => {
        if (applyHtmlToDoc(doc, body, origin)) stampBodyEdit(doc, origin);
        // F1 — claim the seed (clientID marker) in the SAME update so a
        // concurrent second seeder's merge resolves a single elected writer.
        markSeeded(doc, origin);
      }, origin);
      lastHtml = body;
      // Arm the de-dup repair window: if another peer seeded the same body at the
      // same instant, the merged Y.Text will double — maybeRepairSeedDuplication
      // (on the elected owner) collapses it back during this window.
      seedInfo = { body, until: Date.now() + SEED_REPAIR_WINDOW_MS };
      opts.journal?.record(slug, { bodyHash: hashBytes(body) });
    };

    switch (decision.action) {
      case 'noop':
        lastHtml = docHtml;
        // Identical non-empty sides: checkpoint so the next boot fast-forwards.
        if (localHtml !== null && localHtml === docHtml && docHtml !== '') {
          opts.journal?.record(slug, { bodyHash: hashBytes(docHtml) });
        }
        break;
      case 'materialize-hub':
      case 'fast-forward-hub':
        writeBodyFromDoc();
        break;
      case 'seed-local-up':
        // The DDR-064 empty-hub guard as a named decision row: an empty hub doc
        // means the hub holds no body for this slug yet — NOT an authoritative
        // "this canvas is blank". Seed the doc FROM local so the body survives
        // AND the hub gets our content.
        seedBodyUp(localHtml as string);
        bodyWinner = 'local';
        break;
      case 'recover-seed-dup':
        // F1 — booting against a hub whose body is our local body repeated (a
        // concurrent cold-seed that already duplicated). Re-apply local so the
        // diff deletes the extra copy/copies; the content equals local, so the
        // visually-coupled lanes follow local too. Idempotent across peers.
        seedBodyUp(localHtml as string);
        bodyWinner = 'local';
        break;
      case 'conflict': {
        // Divergence: snapshot BOTH versions to `_history/<slug>/` BEFORE any
        // write, then apply the newest-wins winner. Even a wrong pick costs
        // one /design:rollback (the incident's class of loss is closed).
        const snapshots: { local?: string; hub?: string } = {};
        let snapshotAttempted = false;
        if (opts.snapshot) {
          snapshotAttempted = true;
          try {
            const localTs = await opts.snapshot(localHtml as string, 'pre-sync-local');
            if (localTs) snapshots.local = localTs;
            const hubTs = await opts.snapshot(docHtml, 'pre-sync-hub');
            if (hubTs) snapshots.hub = hubTs;
          } catch {
            /* swallowed below — the missing snapshot ref drives the fail-closed guard */
          }
        }
        // DDR-102 fail-closed (security F1): the whole guarantee is "the loser is
        // recoverable from _history". A hub-wins resolution OVERWRITES local — so
        // if we asked for a snapshot but the local one did NOT land (full disk,
        // read-only `_history/`, a Bun.write error), refuse the destructive
        // overwrite. Keep local on disk and seed it UP instead, so nothing is
        // lost on either side (local survives; the hub still gets our content).
        // `snapshotAttempted` gates this to production wiring — a test/standalone
        // agent with no snapshot fn keeps the plain newest-wins behavior.
        const localSnapshotMissing = snapshotAttempted && !snapshots.local;
        let winner = decision.winner;
        if (winner === 'hub' && localSnapshotMissing) {
          winner = 'local';
          console.error(
            `[sync/${slug}] cold-start divergence: hub won newest-wins but the local snapshot FAILED — REFUSING to overwrite local (DDR-102 fail-closed). Keeping local + pushing it up; resolve the _history/ write failure (disk full / read-only?) to restore newest-wins.`
          );
        }
        if (winner === 'local') {
          seedBodyUp(localHtml as string);
          bodyWinner = 'local';
        } else {
          writeBodyFromDoc();
        }
        console.warn(`[sync/${slug}] cold-start divergence — ${decision.reason}`);
        opts.onConflict?.({
          slug,
          kind: 'cold-start-diverged',
          winner,
          ...(snapshots.local || snapshots.hub ? { snapshots } : {}),
          ...(localSnapshotMissing ? { snapshotFailed: true } : {}),
        });
        break;
      }
    }

    // ---- comments: id-union merge (DDR-102 — union loses nothing) ----------
    const localParsedComments = localComments !== null ? tryParseJsonArray(localComments) : null;
    if (localParsedComments !== null && localParsedComments.length > 0) {
      const merged = unionCommentsById(docComments, localParsedComments);
      const mergedStr = merged.length > 0 ? `${JSON.stringify(merged, null, 2)}\n` : '';
      applyCommentsToDoc(doc, merged, origin); // no-ops when equal
      if (mergedStr !== '' && mergedStr !== localComments) {
        const hash = hashBytes(mergedStr);
        echoGuard.record(paths.comments, hash);
        writer(paths.comments, mergedStr);
      }
      lastComments = mergedStr;
    } else {
      // No (parseable) local comments — hub state materializes as before.
      lastComments = docCommentsStr;
      if (docCommentsStr !== '' && localComments !== docCommentsStr) {
        const hash = hashBytes(docCommentsStr);
        echoGuard.record(paths.comments, hash);
        writer(paths.comments, docCommentsStr);
      }
    }

    // ---- annotations + css: follow the body winner (visually coupled) ------
    if (bodyWinner === 'local') {
      if (localAnnotations !== null && localAnnotations !== docAnnotations) {
        applyAnnotationsToDoc(doc, localAnnotations, origin);
        lastAnnotations = localAnnotations;
      } else {
        lastAnnotations = docAnnotations;
      }
      if (paths.css && localCss !== null && localCss !== docCss) {
        applyCssToDoc(doc, localCss, origin);
        lastCss = localCss;
        opts.journal?.record(slug, { cssHash: hashBytes(localCss) });
      } else {
        lastCss = docCss;
      }
    } else {
      lastAnnotations = docAnnotations;
      if (docAnnotations !== '' && localAnnotations !== docAnnotations) {
        const hash = hashBytes(docAnnotations);
        echoGuard.record(paths.annotations, hash);
        writer(paths.annotations, docAnnotations);
      }
      lastCss = docCss;
      if (paths.css && docCss !== null && localCss !== docCss) {
        const hash = hashBytes(docCss);
        echoGuard.record(paths.css, hash);
        writer(paths.css, docCss);
        opts.journal?.record(slug, { cssHash: hash });
      }
    }

    // ---- meta: shared-subset merge, unchanged in all cases -----------------
    lastMeta = docMeta;
    if (paths.meta && docMeta !== null) {
      const merged = mergeSharedMetaIntoLocal(localMeta, docMeta);
      if (merged !== null && merged !== localMeta) {
        const hash = hashBytes(merged);
        echoGuard.record(paths.meta, hash);
        writer(paths.meta, merged);
      }
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

function localMtimeMs(p: string): number | null {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

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
