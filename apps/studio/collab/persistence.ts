// DDR-051 persistence wiring — bridges Room callbacks to the existing JSON
// snapshots (Phase 6 _comments/<slug>.json) + Phase 5 annotations.svg + the
// new `.ydoc.bin` cache under _state/<slug>.ydoc.bin.

import path from 'node:path';

import * as Y from 'yjs';

import type { Api } from '../api.ts';
import type { Context } from '../context.ts';
// From the LEAF, never from `sync/codec.ts` — codec imports `Y_TYPES` from this
// file, so reaching for it here would close a cycle (see sync/limits.ts).
import { commentKey } from '../sync/comment-identity.ts';
import { MAX_ANNOTATIONS_BYTES, MAX_COMMENTS_BYTES, withinByteCap } from '../sync/limits.ts';
import { ensureStateDir, type RoomCallbacks } from './room.ts';

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
  /**
   * Phase 9.2 (DDR-064) — when this returns false for a slug, `seed` is a no-op
   * for it. The shared-doc path passes a predicate that returns false for
   * pinned (provider-attached) slugs, so the local file-seed can't push fresh
   * Y.Array items that would DUPLICATE the hub's canonical items on merge
   * (Risk 1). The migrate-seed + provider own initial population for those
   * slugs. Absent → always seed (flag-OFF behavior, unchanged).
   */
  shouldSeed?: (slug: string) => boolean;
}

/**
 * Build the RoomCallbacks the registry plugs into createRoom().
 *
 * persistJson now serializes BOTH `comments` (Y.Array) and `annotations`
 * (Y.Map → `svg` string) back to their existing on-disk formats. Each is
 * skipped when the Y type is empty / unset — the JSON file stays whatever
 * the prior legacy write produced.
 */
/**
 * DDR-064 pre-cutover checklist — cap the doc→disk lane for comments and
 * annotations.
 *
 * The codec's `MAX_*_BYTES` guard the FILE→DOC direction. This is the other
 * one, and until shared-doc it barely mattered: the room's doc was populated
 * only by browsers on this machine. Under a shared doc it is populated by the
 * hub, so an oversized array pushed by a peer (or by a hostile hub — DDR-054's
 * threat model, §2d) would be materialized to this disk unbounded. Same ceiling
 * as the import lane, so a value that could never be imported can never be
 * written either.
 *
 * Refuses the WRITE, not the sync: the doc keeps the value and the peers keep
 * converging. What is withheld is turning somebody else's blob into our disk.
 * Shared with `sync/projection.ts`'s equivalent guard via `sync/limits.ts`.
 */
function withinCap(slug: string, lane: string, value: string, max: number): boolean {
  return withinByteCap(`collab/${slug}`, lane, Buffer.byteLength(value, 'utf8'), max);
}

export function createPersistence(deps: PersistenceDeps): RoomCallbacks {
  const { ctx, api, fileForSlug } = deps;
  const stateDir = ensureStateDir(ctx.paths.designRoot);

  // Per-slug latch: have we ever projected a NON-empty comments array for this
  // canvas? We write an empty `[]` to disk only AFTER content has been seen — a
  // genuine delete-all — never from a doc that was never populated (cold start
  // before seed/migrate completes), which would clobber a non-empty local file.
  // This closes the receiving-peer gap where a delete-all on one peer left
  // stragglers on the other: the old `arr.length > 0` guard skipped the write
  // when the array emptied, so the deletion never reached the peer's JSON file
  // (the file the sidebar reads), even though the Y.Doc had converged (DDR-064).
  const seenComments = new Set<string>();

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
    // Phase 9.2 (DDR-064) — under sharedDoc the migrate-seed + hub provider own
    // initial population for a pinned slug; a local file-seed here would push
    // fresh Y.Array items that DUPLICATE the hub's canonical items on merge
    // (Risk 1). Skip seeding when the predicate says so. Flag-OFF / unpinned →
    // always seeds (predicate absent or returns true).
    if (deps.shouldSeed && !deps.shouldSeed(slug)) return;

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
        // Push only what the array does not already hold (issue #112). This was
        // an unconditional `arr.push(comments)`, which concatenates whenever the
        // doc is NOT empty at seed time — the DDR-064 Risk 1 window that
        // `shouldSeed`/`isPinned` closes only when the pin already exists, i.e.
        // not when a room is mounted a beat before the hub provider attaches.
        // The identity rule is `commentKey`, shared with the codec's diff and
        // the cold-start union; the leaf import is deliberate — this file owns
        // `Y_TYPES`, so it can never import `sync/codec.ts` back (see above).
        const present = new Set(arr.toArray().map(commentKey));
        const missing = comments.filter((c) => {
          const k = commentKey(c);
          if (present.has(k)) return false;
          present.add(k);
          return true;
        });
        if (missing.length > 0) arr.push(missing);
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

    // Comments — Y.Array projection back to JSON. Write whenever the doc holds
    // comments, OR when it just emptied after previously holding some (so a
    // delete-all materializes on EVERY peer's disk, not just the originator's).
    // The seenComments latch keeps a never-populated doc (cold start) from
    // clobbering a non-empty local file with [].
    const arr = doc.getArray(Y_TYPES.comments);
    const list = arr.toArray() as Parameters<Api['saveCommentsForFile']>[1];
    if (list.length > 0) seenComments.add(slug);
    if (list.length > 0 || seenComments.has(slug)) {
      if (withinCap(slug, 'comments', JSON.stringify(list), MAX_COMMENTS_BYTES)) {
        await api.saveCommentsForFile(file, list);
      }
    }

    // Annotations — Y.Map.svg → annotations.svg file. Task 5.
    const map = doc.getMap<unknown>(Y_TYPES.annotations);
    const svg = map.get('svg');
    if (typeof svg === 'string' && svg) {
      if (withinCap(slug, 'annotations', svg, MAX_ANNOTATIONS_BYTES)) {
        await api.saveAnnotations(file, svg);
      }
    }
  }

  async function persistBinary(slug: string, state: Uint8Array): Promise<void> {
    await Bun.write(ydocBinPath(slug), state);
  }

  return { seed, persistJson, persistBinary };
}
