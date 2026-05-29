// Per-server registry of active collab rooms.
//
// Rooms are lazy: created on first connection for a given slug, retained while
// any peer is connected, torn down (with a final flush) when the last peer
// disconnects. The registry is also the surface the git-lifecycle handler will
// call into (Phase 8 Task 7) to force-snapshot every dirty room before a reload
// prompt — see DDR-051 §3.

import type { Awareness } from 'y-protocols/awareness';

import { bridgeAwareness } from './awareness-bridge.ts';
import { Y_TYPES } from './persistence.ts';
import type { Room, RoomCallbacks } from './room.ts';
import { createRoom } from './room.ts';

/** Structural equality via canonical JSON — used by the syncRoomFrom* no-op
 *  guards. Comment lists are small; stringify is cheap + dependency-free. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  /**
   * Phase 8 Task 5 bridge — same shape as syncRoomFromComments but for the
   * `annotations` Y.Map. The PUT /_api/annotations endpoint passes the
   * post-write SVG; the room replaces `Y.Map.svg` so collab peers see the
   * updated stroke set without waiting for a cold-open re-seed.
   */
  syncRoomFromAnnotations(slug: string, svg: string): void;
  /**
   * Phase 9 Task 5 — attach the hub-side Awareness (from a sync provider) for
   * a slug so the Room's Awareness (browser peers) is bridged bidirectionally
   * to the hub. While attached, cursors / selections / viewport relay
   * cross-machine through Hocuspocus. Idempotent per slug; returns a detach
   * fn. If a room is already live the bridge wires immediately, otherwise it
   * wires when the room is next created. Awareness is ephemeral — this writes
   * no files (see awareness-bridge.ts on why F14 is untouched).
   */
  attachHubAwareness(slug: string, awareness: Awareness): () => void;
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
  // Hub-side Awareness per slug (lives as long as the sync provider). Rooms
  // churn as browser tabs come and go; the bridge is re-wired each time a room
  // is (re)created for a slug that has an attached hub Awareness.
  const hubAwareness = new Map<string, Awareness>();
  const bridges = new Map<string, () => void>();

  function wireBridge(slug: string, room: Room): void {
    if (bridges.has(slug)) return;
    const hub = hubAwareness.get(slug);
    if (!hub) return;
    bridges.set(slug, bridgeAwareness(room.awareness, hub));
  }

  function teardownBridge(slug: string): void {
    const detach = bridges.get(slug);
    if (detach) {
      detach();
      bridges.delete(slug);
    }
  }

  function get(slug: string): Room {
    let room = rooms.get(slug);
    if (!room) {
      room = createRoom(slug, callbacks);
      rooms.set(slug, room);
      wireBridge(slug, room);
    }
    return room;
  }

  function attachHubAwareness(slug: string, awareness: Awareness): () => void {
    hubAwareness.set(slug, awareness);
    const room = rooms.get(slug);
    if (room) wireBridge(slug, room);
    return () => {
      teardownBridge(slug);
      if (hubAwareness.get(slug) === awareness) hubAwareness.delete(slug);
    };
  }

  function peek(slug: string): Room | null {
    return rooms.get(slug) ?? null;
  }

  function syncRoomFromComments(slug: string, comments: readonly unknown[]): void {
    const room = rooms.get(slug);
    if (!room) return;
    const arr = room.doc.getArray<unknown>(Y_TYPES.comments);
    // No-op guard (load-bearing): skip when the room already holds this exact
    // list. The wholesale delete+push always emits a doc update, which schedules
    // a persist → file write → fs event → re-seed … so without this equality
    // short-circuit, re-seeding the live room from a disk change (sync-agent or
    // design:edit write — see createCollab's fs hook) would spin an 800ms
    // persist storm. Equality breaks the loop after a single convergence.
    if (jsonEqual(arr.toArray(), comments)) return;
    room.doc.transact(() => {
      if (arr.length > 0) arr.delete(0, arr.length);
      if (comments.length > 0) arr.push(comments as unknown[]);
    }, 'inspector-write');
  }

  function syncRoomFromAnnotations(slug: string, svg: string): void {
    const room = rooms.get(slug);
    if (!room) return;
    const map = room.doc.getMap<string>(Y_TYPES.annotations);
    if (map.get('svg') === svg) return; // no-op guard — same rationale as comments
    room.doc.transact(() => {
      map.set('svg', svg);
    }, 'inspector-write');
  }

  async function flushAll(): Promise<void> {
    await Promise.all(Array.from(rooms.values(), (r) => r.flush()));
  }

  async function drop(slug: string): Promise<void> {
    const room = rooms.get(slug);
    if (!room) return;
    if (room.size() > 0) return; // still active, leave it
    // Tear the bridge down before room.destroy() runs awareness.destroy() —
    // a late relay must not fire against a dead Awareness. The hub Awareness
    // stays registered, so a reconnecting browser re-wires via get().
    teardownBridge(slug);
    rooms.delete(slug);
    await room.destroy();
  }

  async function destroyAll(): Promise<void> {
    for (const slug of Array.from(bridges.keys())) teardownBridge(slug);
    hubAwareness.clear();
    const all = Array.from(rooms.values());
    rooms.clear();
    await Promise.all(all.map((r) => r.destroy()));
  }

  return {
    get,
    peek,
    syncRoomFromComments,
    syncRoomFromAnnotations,
    attachHubAwareness,
    flushAll,
    destroyAll,
    drop,
    size: () => rooms.size,
  };
}
