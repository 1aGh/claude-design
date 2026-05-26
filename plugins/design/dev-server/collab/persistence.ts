// DDR-051 persistence wiring — bridges Room callbacks to the existing JSON
// snapshots (Phase 6 _comments/<slug>.json) + the new `.ydoc.bin` cache under
// _state/<slug>.ydoc.bin.
//
// Task 1 lays the framework in place but is still empty: the Y.Doc has no
// shared types yet. Task 3 fills `applyJsonSeed` / `serializeJson` for the
// `comments` Y.Array. Task 5 will add `annotations`. Keeping the framework
// here means Task 3/5 implementations stay focused on the projection logic.

import path from 'node:path';

import * as Y from 'yjs';

import type { Api } from '../api.ts';
import type { Context } from '../context.ts';
import { ensureStateDir, type RoomCallbacks } from './room.ts';

/**
 * Y.Doc shared-type names. Frozen on Task 1 so client + server agree even
 * before they're populated.
 */
export const Y_TYPES = {
  comments: 'comments',
  annotations: 'annotations',
  presentation: 'presentation',
} as const;

export interface PersistenceDeps {
  ctx: Context;
  api: Api;
  /**
   * Resolve a canvas slug back to the repo-relative `file` path the comments
   * API expects. The collab WS sends slugs (URL-safe), the comments path
   * round-trips through Api.fileSlug. We invert by scanning loadAllComments
   * once per cold open — sufficient for Task 1; Task 3 cache by slug.
   */
  fileForSlug: (slug: string) => Promise<string | null>;
}

/**
 * Build the RoomCallbacks the registry plugs into createRoom().
 *
 * Each call to persistJson serializes the live Y.Doc into the existing JSON
 * file format. Each call to persistBinary writes the binary Y state to
 * `<designRoot>/_state/<slug>.ydoc.bin`.
 *
 * Seed order per DDR-051 §2:
 *   1. Try `.ydoc.bin` → Y.applyUpdate → done.
 *   2. Else read JSON snapshots → seed Y.Doc transactionally → done.
 *   3. Else empty Y.Doc.
 */
export function createPersistence(deps: PersistenceDeps): RoomCallbacks {
  const { ctx, api, fileForSlug } = deps;
  const stateDir = ensureStateDir(ctx.paths.designRoot);

  function ydocBinPath(slug: string): string {
    return path.join(stateDir, `${slug}.ydoc.bin`);
  }

  async function readBinary(slug: string): Promise<Uint8Array | null> {
    try {
      const file = Bun.file(ydocBinPath(slug));
      if (!(await file.exists())) return null;
      const buf = await file.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }

  async function seed(slug: string, doc: Y.Doc): Promise<void> {
    // Step 1 — try the binary cache.
    const binary = await readBinary(slug);
    if (binary && binary.byteLength > 0) {
      Y.applyUpdate(doc, binary);
      return;
    }

    // Step 2 — try JSON snapshots. Task 1 wires only the comments path; Task 3
    // populates the Y.Array projection. Until then the Y.Doc starts empty
    // intentionally and the JSON file remains the source of truth that the
    // legacy REST endpoints serve from.
    const file = await fileForSlug(slug);
    if (!file) return;

    const comments = await api.loadCommentsForFile(file);
    if (!comments.length) return;

    // Seed inside a transaction so the doc.on('update') handler emits a single
    // initial update. Origin tagged 'seed' to suppress broadcast back to
    // anyone (the room's broadcaster ignores non-RoomConn origins).
    doc.transact(() => {
      const arr = doc.getArray<unknown>(Y_TYPES.comments);
      // Push the existing JSON rows verbatim. Comments are pure data; Y.Array
      // of plain objects is the right shape per Task 3.
      arr.push(comments);
    }, 'seed');
  }

  async function persistJson(slug: string, doc: Y.Doc): Promise<void> {
    // Task 1 placeholder — Task 3 fills this with the comments-array
    // projection that writes back through api.saveCommentsForFile(). Until
    // then we no-op so an in-flight Y.Doc doesn't clobber the on-disk JSON
    // that legacy REST writes still own.
    const file = await fileForSlug(slug);
    if (!file) return;
    const arr = doc.getArray(Y_TYPES.comments);
    if (arr.length === 0) return;
    // Comments stored as plain objects; toJSON yields the snapshot.
    const list = arr.toArray() as Parameters<Api['saveCommentsForFile']>[1];
    await api.saveCommentsForFile(file, list);
  }

  async function persistBinary(slug: string, state: Uint8Array): Promise<void> {
    await Bun.write(ydocBinPath(slug), state);
  }

  return { seed, persistJson, persistBinary };
}
