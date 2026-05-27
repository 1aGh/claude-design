// Bun.serve native WebSocket handlers — replaces server.mjs's hand-rolled
// RFC-6455 upgrade. Per-connection state lives on ws.data (Bun's typed slot).

import type { ServerWebSocket, WebSocketHandler } from 'bun';

import type { Api } from './api.ts';
import type { Collab, RoomConn } from './collab/index.ts';
import type { Context } from './context.ts';
import { createHmrBroadcaster } from './hmr-broadcast.ts';
import type { Inspect } from './inspect.ts';

/**
 * Per-connection state. `kind` discriminates between the legacy JSON
 * inspector channel (`/_ws`) and the Phase 8 binary collab channel
 * (`/_ws/collab/:slug`). server.ts sets this at upgrade time.
 */
export type WsData =
  | {
      id: string;
      remote: string;
      kind: 'inspector';
    }
  | {
      id: string;
      remote: string;
      kind: 'collab';
      slug: string;
    };

/**
 * Match the collab URL pattern and return the slug, or `null` if the path
 * isn't a collab endpoint. Exported so server.ts owns the routing decision.
 *
 * Slug grammar matches `api.fileSlug` output: `[a-z0-9_-]+`. URL-encoded chars
 * are rejected here — the legacy inspector path stays the catch-all.
 */
export function parseCollabSlug(pathname: string): string | null {
  const m = pathname.match(/^\/_ws\/collab\/([a-z0-9_-]+)$/i);
  return m ? (m[1] ?? null) : null;
}

/**
 * DDR-047 — collab WS upgrades MUST come from a loopback host. The header
 * carries `<host>:<port>` (or `<host>` if default-port); strip the port and
 * compare against the loopback aliases. Anything else returns false → server.ts
 * answers 403.
 */
export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  // Strip port. `[::1]:4399` keeps the `::1` bracketed; handle both shapes.
  let h = host.trim().toLowerCase();
  if (h.startsWith('[')) {
    const close = h.indexOf(']');
    if (close === -1) return false;
    h = h.slice(1, close);
  } else {
    const colon = h.lastIndexOf(':');
    if (colon !== -1) h = h.slice(0, colon);
  }
  return h === '127.0.0.1' || h === '::1' || h === 'localhost';
}

export interface Ws {
  handler: WebSocketHandler<WsData>;
  broadcast(payload: unknown): void;
  clientCount(): number;
}

export function createWs(ctx: Context, api: Api, inspect: Inspect, collab: Collab): Ws {
  const clients = new Set<ServerWebSocket<WsData>>();

  function send(ws: ServerWebSocket<WsData>, payload: unknown) {
    try {
      ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    } catch {
      /* dead socket — close handler will clean up */
    }
  }

  function broadcast(payload: unknown) {
    const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.data.kind !== 'inspector') continue;
      send(ws, msg);
    }
  }

  // Wire bus -> WS broadcasts. inspect.ts emits 'selected' / 'active' after every
  // state write; fs-watch.ts emits 'fs:*' on every save.
  ctx.bus.on('selected', (sel) => broadcast({ type: 'selected', selected: sel }));
  ctx.bus.on('active', (file) => broadcast({ type: 'active', file }));
  ctx.bus.on('fs:html', (file) => broadcast({ type: 'fs:html', file }));
  ctx.bus.on('fs:css', (file) => broadcast({ type: 'fs:css', file }));
  ctx.bus.on('fs:json', (file) => broadcast({ type: 'fs:json', file }));
  ctx.bus.on('comments', ({ file, comments }: { file: string; comments: unknown[] }) =>
    broadcast({ type: 'comments', file, comments })
  );
  // Phase 8 Task 4 — AI activity banner. `entry` is null on clear / explicit
  // end / heartbeat-grace expiry; non-null carries { file, author, …timestamps }.
  ctx.bus.on('ai-activity', ({ file, entry }: { file: string; entry: unknown }) =>
    broadcast({ type: 'ai-activity', file, entry })
  );
  // Phase 8 Task 7 — git lifecycle. `.git/HEAD` watcher emits this AFTER
  // registry.flushAll() so any in-flight Y.Doc state is already on disk by
  // the time the client renders the reload prompt. Inspector clients +
  // canvas iframes both subscribe.
  ctx.bus.on('git-lifecycle', (payload: unknown) => broadcast({ type: 'git-lifecycle', payload }));

  // HMR broadcaster — turns fs:any change events into `canvas-hmr` messages.
  // The iframe-side client (in _shell.html) decides reload strategy from `mode`.
  createHmrBroadcaster(ctx, (msg) => broadcast(msg));

  // Bind a connection to its room. Stored per-socket so close() can find the
  // right room to disconnect from. Multiplexed via ws.data.id.
  const collabConns = new Map<string, { roomSlug: string; conn: RoomConn }>();

  function bindCollab(ws: ServerWebSocket<WsData>, slug: string): RoomConn {
    const conn: RoomConn = {
      id: ws.data.id,
      send(payload: Uint8Array) {
        try {
          // Bun's ws.send accepts Uint8Array directly as binary.
          ws.send(payload);
        } catch {
          /* close handler will clean up */
        }
      },
    };
    collabConns.set(ws.data.id, { roomSlug: slug, conn });
    return conn;
  }

  const handler: WebSocketHandler<WsData> = {
    async open(ws) {
      if (ws.data.kind === 'collab') {
        const room = collab.registry.get(ws.data.slug);
        const conn = bindCollab(ws, ws.data.slug);
        await room.connect(conn);
        return;
      }
      clients.add(ws);
      send(ws, { type: 'snapshot', state: inspect.state });
    },
    async close(ws) {
      if (ws.data.kind === 'collab') {
        const binding = collabConns.get(ws.data.id);
        if (binding) {
          collabConns.delete(ws.data.id);
          const room = collab.registry.get(binding.roomSlug);
          room.disconnect(binding.conn);
          if (room.size() === 0) {
            // Drop the room when the last peer leaves so memory doesn't grow
            // unbounded across canvases over a long session.
            await collab.registry.drop(binding.roomSlug);
          }
        }
        return;
      }
      clients.delete(ws);
    },
    async message(ws, raw) {
      if (ws.data.kind === 'collab') {
        const binding = collabConns.get(ws.data.id);
        if (!binding) return;
        // y-websocket frames are always binary. Coerce whatever Bun handed us.
        const bytes =
          typeof raw === 'string'
            ? new TextEncoder().encode(raw)
            : raw instanceof Uint8Array
              ? raw
              : new Uint8Array(raw as ArrayBufferLike);
        const room = collab.registry.get(binding.roomSlug);
        room.receive(binding.conn, bytes);
        return;
      }

      // Inspector channel — legacy JSON message protocol.
      // biome-ignore lint/suspicious/noExplicitAny: JSON.parse result; narrowed by runtime discriminator checks below.
      let msg: any;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      try {
        if (msg.type === 'active' && typeof msg.file === 'string') inspect.setActive(msg.file);
        else if (msg.type === 'tabs' && Array.isArray(msg.tabs)) inspect.setOpenTabs(msg.tabs);
        else if (msg.type === 'select' && msg.selection) inspect.setSelected(msg.selection);
        else if (msg.type === 'clear-select') inspect.setSelected(null);
        else if (msg.type === 'comments-add' && msg.payload) await api.commentsAdd(msg.payload);
        else if (msg.type === 'comments-patch' && msg.id)
          await api.commentsPatch(msg.id, msg.patch || {});
        else if (msg.type === 'comments-delete' && msg.id) await api.commentsDelete(msg.id);
        else if (msg.type === 'comments-request' && typeof msg.file === 'string') {
          const comments = await api.loadCommentsForFile(msg.file);
          send(ws, { type: 'comments', file: msg.file, comments });
        }
      } catch (err) {
        console.error('[ws] message handler threw:', err);
      }
    },
  };

  return { handler, broadcast, clientCount: () => clients.size };
}
