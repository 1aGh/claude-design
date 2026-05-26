// Public surface of the collab module. Bundles the registry + persistence
// wiring so ws.ts + server.ts don't need to know about the internal split.

import type { Api } from '../api.ts';
import type { Context } from '../context.ts';

import { createPersistence, Y_TYPES } from './persistence.ts';
import { createRegistry, type Registry } from './registry.ts';

export { Y_TYPES };
export type { Registry } from './registry.ts';
export type { Room, RoomConn } from './room.ts';
export type { CollabConn } from './protocol.ts';

export interface Collab {
  registry: Registry;
}

/**
 * Build the collab subsystem for this server instance. One registry +
 * persistence binding per dev-server boot. The registry is also the surface
 * the git-lifecycle path will call to force-snapshot dirty rooms (Phase 8
 * Task 7).
 */
export function createCollab(ctx: Context, api: Api): Collab {
  // Inverse of api.fileSlug — we have the URL slug, need the canonical
  // repo-relative path the api expects. The current fileSlug() is destructive
  // (loses the extension + the designRel prefix), so we round-trip by
  // scanning loadAllComments — cheap enough at room-open time, and a fresh
  // canvas with no comments yet just returns null (an empty Y.Doc is correct
  // in that case).
  //
  // Task 3 will tighten this to a slug -> file lookup table maintained from
  // the index/file-tree state so we don't need to read every JSON file.
  async function fileForSlug(slug: string): Promise<string | null> {
    const all = await api.loadAllComments();
    for (const [file] of Object.entries(all)) {
      if (api.fileSlug(file) === slug) return file;
    }
    return null;
  }

  const persistence = createPersistence({ ctx, api, fileForSlug });
  const registry = createRegistry(persistence);

  return { registry };
}
