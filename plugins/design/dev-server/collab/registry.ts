// Per-server registry of active collab rooms.
//
// Rooms are lazy: created on first connection for a given slug, retained while
// any peer is connected, torn down (with a final flush) when the last peer
// disconnects. The registry is also the surface the git-lifecycle handler will
// call into (Phase 8 Task 7) to force-snapshot every dirty room before a reload
// prompt — see DDR-051 §3.

import { Y_TYPES } from './persistence.ts';
import type { Room, RoomCallbacks } from './room.ts';
import { createRoom } from './room.ts';

export interface Registry {
  /** Get-or-create. Reuses an existing room for the same slug. */
  get(slug: string): Room;
  /** Existence check — returns the live room if any, else null. NEVER creates. */
  peek(slug: string): Room | null;
  /**
   * Phase 8 Task 3 bridge — inspector-channel writes (REST `/_api/comments*`
   * or the legacy WS comments-add path) call this so the live Y.Array sees
   * the change and broadcasts it to collab peers. No-op when no room is
   * live; the next cold open will seed from the freshly-written JSON anyway.
   *
   * `comments` is the post-mutation JSON list (the same shape persistJson
   * writes back). We replace the Y.Array contents wholesale inside a
   * transaction tagged `'inspector-write'` so the doc.update broadcaster
   * downstreams it to peers but skips the in-flight debounce loop.
   */
  syncRoomFromComments(slug: string, comments: readonly unknown[]): void;
  /** Flush every dirty room synchronously. DDR-051 branch-switch path. */
  flushAll(): Promise<void>;
  /** Tear down everything (e.g. on server shutdown). */
  destroyAll(): Promise<void>;
  /** Tear down a single room when its last peer leaves. */
  drop(slug: string): Promise<void>;
  /** Test/introspection. */
  size(): number;
}

export function createRegistry(callbacks: RoomCallbacks): Registry {
  const rooms = new Map<string, Room>();

  function get(slug: string): Room {
    let room = rooms.get(slug);
    if (!room) {
      room = createRoom(slug, callbacks);
      rooms.set(slug, room);
    }
    return room;
  }

  function peek(slug: string): Room | null {
    return rooms.get(slug) ?? null;
  }

  function syncRoomFromComments(slug: string, comments: readonly unknown[]): void {
    const room = rooms.get(slug);
    if (!room) return;
    room.doc.transact(() => {
      const arr = room.doc.getArray<unknown>(Y_TYPES.comments);
      if (arr.length > 0) arr.delete(0, arr.length);
      if (comments.length > 0) arr.push(comments as unknown[]);
    }, 'inspector-write');
  }

  async function flushAll(): Promise<void> {
    await Promise.all(Array.from(rooms.values(), (r) => r.flush()));
  }

  async function drop(slug: string): Promise<void> {
    const room = rooms.get(slug);
    if (!room) return;
    if (room.size() > 0) return; // still active, leave it
    rooms.delete(slug);
    await room.destroy();
  }

  async function destroyAll(): Promise<void> {
    const all = Array.from(rooms.values());
    rooms.clear();
    await Promise.all(all.map((r) => r.destroy()));
  }

  return { get, peek, syncRoomFromComments, flushAll, destroyAll, drop, size: () => rooms.size };
}
