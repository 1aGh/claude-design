// One-time authoritative seed for the shared-doc cutover — Phase 9.2 (DDR-064
// Task 9). The fix for Risk 1 (the duplication-on-merge trap).
//
// The trap (dmonad-confirmed, discuss.yjs.dev/t/.../2538): if a shared doc is
// populated from TWO independent sources — the local file-seed (room.seed
// pushing `_comments/<slug>.json` as fresh Y.Array items) AND the hub provider
// (syncing the hub's canonical items) — the two item-sets have different client
// IDs, so the CRDT merge CONCATENATES them: comment "c1" appears twice. You
// cannot fix this with `applyUpdate` of two docs; you must pick ONE authoritative
// source and build the doc from it.
//
// This module is that decision, run ONCE per canvas at cutover, AFTER the
// provider's first sync (so the doc already holds hub state if the hub had any):
//
//   - hub HAD state (doc non-empty)  → HUB WINS. Leave the doc; the projection
//     materializes hub state to disk. Local divergent files are snapshotted to
//     `_history/` first (rollback) then overwritten by the room persist.
//   - hub was EMPTY (doc empty)      → ADOPT. Clear+rebuild the doc from the
//     local files inside `transact(fn, MIGRATION)` (the apply* codecs already
//     delete-then-insert, so this is a true rebuild, not an append). The
//     provider then pushes it up as the canonical first version.
//
// Idempotent: re-running with hub state present is a no-op (doc already holds
// it); re-running an adopt rebuilds from the same files → byte-identical, no
// duplicate items. The companion guard is the room's seed being disabled for
// pinned (provider-attached) slugs under sharedDoc (see collab/index.ts
// `shouldSeed`), so the file-seed can never re-introduce duplicate items after
// this runs.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type * as Y from 'yjs';

import { Y_TYPES } from '../collab/persistence.ts';
import {
  applyAnnotationsToDoc,
  applyCommentsToDoc,
  applyCssToDoc,
  applyHtmlToDoc,
  applyMetaToDoc,
  Y_SYNC_TYPES,
} from './codec.ts';
import { ORIGINS } from './origins.ts';

export interface MigrateSeedPaths {
  html: string;
  comments: string;
  annotations: string;
  meta?: string;
  css?: string;
}

export interface MigrateSeedOptions {
  slug: string;
  doc: Y.Doc;
  paths: MigrateSeedPaths;
  /** `_history/<slug>/` (or any dir) — when set, local files are snapshotted
   *  here before a hub-wins overwrite, for rollback. Best-effort. */
  historyDir?: string;
}

export type MigrateSeedResult = 'hub-wins' | 'local-adopt' | 'empty';

/** True when the shared doc holds no synced content for any of the five types. */
export function docIsEmpty(doc: Y.Doc): boolean {
  if (doc.getText(Y_SYNC_TYPES.html).length > 0) return false;
  if (doc.getText(Y_SYNC_TYPES.css).length > 0) return false;
  if (doc.getText(Y_SYNC_TYPES.meta).length > 0) return false;
  if (doc.getArray(Y_TYPES.comments).length > 0) return false;
  const svg = doc.getMap<unknown>(Y_TYPES.annotations).get('svg');
  if (typeof svg === 'string' && svg.length > 0) return false;
  return true;
}

/**
 * Run the one-time authoritative seed. Returns which source won so the caller
 * can log / surface a conflict. Safe to call on every boot (idempotent).
 */
export function migrateSeed(opts: MigrateSeedOptions): MigrateSeedResult {
  const { doc, paths } = opts;

  // Hub had canonical state → it wins. The doc already holds it; the projection
  // will materialize it to disk. Snapshot any divergent local files first so the
  // overwrite is recoverable.
  if (!docIsEmpty(doc)) {
    snapshotLocal(opts);
    return 'hub-wins';
  }

  // Hub was empty → adopt local. Build the doc from the local files ONCE, inside
  // a single MIGRATION transaction. The apply* codecs delete-then-insert, so
  // this is a clear+rebuild (re-running is a no-op once content matches).
  const localHtml = readLocal(paths.html);
  const localComments = readLocal(paths.comments);
  const localAnnotations = readLocal(paths.annotations);
  const localMeta = paths.meta ? readLocal(paths.meta) : null;
  const localCss = paths.css ? readLocal(paths.css) : null;

  const hasLocal =
    !!localHtml || !!localComments || !!localAnnotations || !!localMeta || !!localCss;
  if (!hasLocal) return 'empty';

  doc.transact(() => {
    if (localHtml) applyHtmlToDoc(doc, localHtml, ORIGINS.MIGRATION);
    if (localComments) {
      const parsed = tryParseJsonArray(localComments);
      if (parsed) applyCommentsToDoc(doc, parsed, ORIGINS.MIGRATION);
    }
    if (localAnnotations) applyAnnotationsToDoc(doc, localAnnotations, ORIGINS.MIGRATION);
    if (paths.meta && localMeta) applyMetaToDoc(doc, localMeta, ORIGINS.MIGRATION);
    if (paths.css && localCss) applyCssToDoc(doc, localCss, ORIGINS.MIGRATION);
  }, ORIGINS.MIGRATION);

  return 'local-adopt';
}

/* ---------------------------------------------------------------- helpers */

function snapshotLocal(opts: MigrateSeedOptions): void {
  if (!opts.historyDir) return;
  try {
    const dir = path.join(opts.historyDir, 'pre-shared-doc-migration');
    mkdirSync(dir, { recursive: true });
    for (const p of [
      opts.paths.html,
      opts.paths.comments,
      opts.paths.annotations,
      opts.paths.meta,
      opts.paths.css,
    ]) {
      if (p && existsSync(p)) {
        copyFileSync(p, path.join(dir, path.basename(p)));
      }
    }
  } catch {
    /* best-effort — a snapshot failure must not block the cutover */
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

// Proto-pollution-safe (DDR-054 §2g), mirroring the agent + projection comments
// parse — a planted local `_comments/<slug>.json` must not seed dangerous keys
// during adopt.
function tryParseJsonArray(s: string): unknown[] | null {
  try {
    const parsed = JSON.parse(s, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
      return value;
    });
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
