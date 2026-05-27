// Per-canvas Y.Doc room — registry, connection set, persistence schedule.
//
// One Room per canvas slug. Holds the Y.Doc + Awareness + the set of connected
// peers, broadcasts updates, debounces JSON snapshot writes to disk
// (DDR-051 — JSON is canonical, `.ydoc.bin` is a cache).
//
// The Room is transport-agnostic — it accepts CollabConn objects from the WS
// layer (ws.ts). Tests construct rooms directly without booting Bun.serve.

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';

import {
  type CollabConn,
  encodeAwarenessFrame,
  encodeHandshake,
  encodeSyncUpdate,
  handleMessage,
} from './protocol.ts';

export interface RoomConn extends CollabConn {
  /** Stable id for this connection (UUID from ws.data.id). */
  id: string;
}

export interface RoomCallbacks {
  /**
   * Persist the JSON projection of `doc` for this slug. Called debounced — the
   * Room batches Y.Doc updates within 800 ms windows and fires this once at
   * quiescence. Implementations MUST be idempotent.
   */
  persistJson(slug: string, doc: Y.Doc): Promise<void> | void;

  /**
   * Persist the binary Y.Doc state cache (`.ydoc.bin`). Called on the same
   * debounce schedule as persistJson. Separate hook so tests can stub one
   * without the other.
   */
  persistBinary(slug: string, state: Uint8Array): Promise<void> | void;

  /**
   * Seed the Y.Doc from on-disk persistence — `.ydoc.bin` first, JSON
   * snapshots second. Called once at room construction. MUST be synchronous
   * with respect to the Y.Doc passed in so the first peer's handshake sees
   * the seeded state.
   */
  seed(slug: string, doc: Y.Doc): Promise<void> | void;
}

export interface Room {
  readonly slug: string;
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  connect(conn: RoomConn): Promise<void>;
  disconnect(conn: RoomConn): void;
  receive(conn: RoomConn, payload: Uint8Array): void;
  /** Force the debounced flush to fire now. DDR-051 §3 (branch-switch). */
  flush(): Promise<void>;
  /** Tear down — clears timers + removes awareness. */
  destroy(): Promise<void>;
  /** Test/inspection: connection count. */
  size(): number;
}

const DEBOUNCE_MS = 800;

export function createRoom(slug: string, callbacks: RoomCallbacks): Room {
  const doc = new Y.Doc();
  // Awareness needs a clientID; reuse the Y.Doc's so peers can attribute updates.
  const awareness = new Awareness(doc);

  const conns = new Map<string, RoomConn>();
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let seedPromise: Promise<void> | null = null;

  function scheduleFlush() {
    dirty = true;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, DEBOUNCE_MS);
  }

  async function flush(): Promise<void> {
    if (!dirty || destroyed) return;
    dirty = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    try {
      await callbacks.persistJson(slug, doc);
      await callbacks.persistBinary(slug, Y.encodeStateAsUpdate(doc));
    } catch (err) {
      // Re-arm so the next mutation retries. Loud-log; persistence loss is a
      // user-visible bug if it stays silent.
      dirty = true;
      console.error(`[collab/${slug}] flush failed:`, err);
    }
  }

  function broadcast(payload: Uint8Array, except?: RoomConn) {
    for (const c of conns.values()) {
      if (except && c.id === except.id) continue;
      try {
        c.send(payload);
      } catch {
        /* close handler will clean up dead sockets */
      }
    }
  }

  // Y.Doc update -> broadcast to all peers + schedule debounced flush.
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (destroyed) return;
    // Don't echo back to the origin — they already have it; reduces noise.
    const except =
      origin && typeof origin === 'object' && 'id' in origin ? (origin as RoomConn) : undefined;
    broadcast(encodeSyncUpdate(update), except);
    scheduleFlush();
  });

  // Awareness changes -> broadcast (NOT persisted; ephemeral by design).
  awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (destroyed) return;
      const changed = added.concat(updated, removed);
      if (changed.length === 0) return;
      const except =
        origin && typeof origin === 'object' && 'id' in origin ? (origin as RoomConn) : undefined;
      broadcast(encodeAwarenessFrame(awareness, changed), except);
    }
  );

  function getOrStartSeed(): Promise<void> {
    if (!seedPromise) {
      const result = callbacks.seed(slug, doc);
      seedPromise = Promise.resolve(result).catch((err) => {
        console.error(`[collab/${slug}] seed failed:`, err);
      });
    }
    return seedPromise;
  }

  async function connect(conn: RoomConn): Promise<void> {
    await getOrStartSeed();
    conns.set(conn.id, conn);
    const frames = encodeHandshake(doc, awareness);
    for (const frame of frames) conn.send(frame);
  }

  function disconnect(conn: RoomConn): void {
    conns.delete(conn.id);
    // Awareness states keyed by the conn token; clean them up so other peers'
    // cursor renderers can drop the avatar.
    const states = awareness.getStates();
    const stale: number[] = [];
    for (const clientId of states.keys()) {
      // Bridge: our Awareness state setters tag the state with `__connId`
      // matching conn.id; remove states whose owning conn just left.
      const state = states.get(clientId) as { __connId?: string } | undefined;
      if (state && state.__connId === conn.id) stale.push(clientId);
    }
    if (stale.length) removeAwarenessStates(awareness, stale, conn);
  }

  function receive(conn: RoomConn, payload: Uint8Array): void {
    const reply = handleMessage(payload, doc, awareness, conn);
    if (reply) conn.send(reply);
  }

  async function destroy(): Promise<void> {
    destroyed = true;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (dirty) await flush();
    conns.clear();
    awareness.destroy();
    doc.destroy();
  }

  return {
    slug,
    doc,
    awareness,
    connect,
    disconnect,
    receive,
    flush,
    destroy,
    size: () => conns.size,
  };
}

/**
 * Ensure `<designRoot>/_state/` exists. Idempotent; safe to call on every
 * room construction (mkdir recursive returns the path or noop).
 */
export function ensureStateDir(designRoot: string): string {
  const dir = path.join(designRoot, '_state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
