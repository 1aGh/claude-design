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
  /**
   * Phase 30 — project an agent's "editing" activity onto this room's awareness
   * using the room's own (otherwise-unused) local awareness slot, so the soft
   * editing-presence crosses the hub to remote peers (the loopback `ai-activity`
   * bus event does not). `null` clears it. Idempotent — a re-set of the same
   * `{name, since}` is a no-op (ai-activity heartbeats re-emit every 10 s).
   * NOT a lock; never blocks a peer.
   */
  setAgentEditing(state: { name: string; since: number } | null): void;
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
  // clientID → owning conn.id, learned from the origin of each awareness update.
  // Server-authoritative: we do NOT trust a client-supplied `__connId` (awareness
  // is attacker-influenceable through a semi-trusted hub — DDR-054). On disconnect
  // we remove exactly the clientIDs this conn published so other peers drop the
  // avatar immediately, instead of waiting out the ~30s awareness timeout (which
  // let phantom peers pile up on rapid reconnects — the cross-origin repro that
  // surfaced this latent bug).
  const connByClient = new Map<number, string>();
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
      // Learn which clientIDs belong to which conn from the update origin, so
      // disconnect() can evict them precisely.
      if (except) {
        for (const id of added) connByClient.set(id, except.id);
        for (const id of updated) connByClient.set(id, except.id);
        for (const id of removed) connByClient.delete(id);
      }
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
    // Remove the awareness states this conn published (tracked by update origin
    // in connByClient) so other peers' cursor renderers drop the avatar now,
    // not after the ~30s awareness timeout.
    const stale: number[] = [];
    for (const [clientId, connId] of connByClient) {
      if (connId === conn.id) stale.push(clientId);
    }
    for (const clientId of stale) connByClient.delete(clientId);
    if (stale.length) removeAwarenessStates(awareness, stale, conn);
  }

  function receive(conn: RoomConn, payload: Uint8Array): void {
    const reply = handleMessage(payload, doc, awareness, conn);
    if (reply) conn.send(reply);
  }

  // Phase 30 — agent editing-presence projected onto the room's own awareness
  // slot. The key short-circuits redundant re-sets (ai-activity heartbeats
  // re-emit the same entry every 10 s). The awareness `update` handler above
  // broadcasts the change to local conns AND relays it to the hub via
  // bridgeAwareness, so a remote peer's overlay attributes the edit.
  let agentEditingKey: string | null = null;
  function setAgentEditing(state: { name: string; since: number } | null): void {
    if (destroyed) return;
    const key = state ? `${state.name} ${state.since}` : null;
    if (key === agentEditingKey) return;
    agentEditingKey = key;
    if (state === null) {
      awareness.setLocalState(null);
      return;
    }
    awareness.setLocalState({
      name: state.name,
      color: '', // re-derived client-side from name; wire value is discarded
      cursor: null,
      selection: null,
      annotationSelection: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      editing: { since: state.since },
    });
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
    setAgentEditing,
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
