// DDR-051 persistence wiring — bridges Room callbacks to the existing JSON
// snapshots (Phase 6 _comments/<slug>.json) + Phase 5 annotations.svg + the
// new `.ydoc.bin` cache under _state/<slug>.ydoc.bin.

import path from 'node:path';

import * as Y from 'yjs';

import type { Api } from '../api.ts';
import type { Context } from '../context.ts';
import { type RoomCallbacks, ensureStateDir } from './room.ts';

/**
 * Y.Doc shared-type names. Frozen on Task 1 so client + server agree even
 * before they're populated. Task 3 added `comments`; Task 5 adds `annotations`
 * (a Y.Map holding the SVG string under the `svg` key — LWW shape, mirrors
 * the current /_api/annotations PUT semantics).
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
   * Resolve a canvas slug back to the repo-relative `file` path the api
   * expects. The collab WS sends slugs (URL-safe), the comments path
   * round-trips through Api.fileSlug. Persistence callers may also call
   * `noteFile(file)` to populate the lookup table — server-side write paths
   * (comments + annotations) call this so the room can locate the canvas
   * even when no prior JSON file existed.
   */
  fileForSlug: (slug: string) => Promise<string | null>;
  /** Best-effort cache primer — see fileForSlug above. */
  noteFile?: (file: string) => void;
}

/**
 * Build the RoomCallbacks the registry plugs into createRoom().
 *
 * persistJson now serializes BOTH `comments` (Y.Array) and `annotations`
 * (Y.Map → `svg` string) back to their existing on-disk formats. Each is
 * skipped when the Y type is empty / unset — the JSON file stays whatever
 * the prior legacy write produced.
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

    // Step 2 — seed each Y type from its existing on-disk source.
    const file = await fileForSlug(slug);
    if (!file) return;

    const [comments, svg] = await Promise.all([
      api.loadCommentsForFile(file),
      api.loadAnnotations(file),
    ]);

    if (comments.length === 0 && !svg) return;

    doc.transact(() => {
      if (comments.length > 0) {
        const arr = doc.getArray<unknown>(Y_TYPES.comments);
        arr.push(comments);
      }
      if (svg && typeof svg === 'string') {
        const map = doc.getMap<string>(Y_TYPES.annotations);
        map.set('svg', svg);
      }
    }, 'seed');
  }

  async function persistJson(slug: string, doc: Y.Doc): Promise<void> {
    const file = await fileForSlug(slug);
    if (!file) return;

    // Comments — Y.Array projection back to JSON.
    const arr = doc.getArray(Y_TYPES.comments);
    if (arr.length > 0) {
      const list = arr.toArray() as Parameters<Api['saveCommentsForFile']>[1];
      await api.saveCommentsForFile(file, list);
    }

    // Annotations — Y.Map.svg → annotations.svg file. Task 5.
    const map = doc.getMap<unknown>(Y_TYPES.annotations);
    const svg = map.get('svg');
    if (typeof svg === 'string' && svg) {
      await api.saveAnnotations(file, svg);
    }
  }

  async function persistBinary(slug: string, state: Uint8Array): Promise<void> {
    await Bun.write(ydocBinPath(slug), state);
  }

  return { seed, persistJson, persistBinary };
}
