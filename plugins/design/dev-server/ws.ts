// Bun.serve native WebSocket handlers — replaces server.mjs's hand-rolled
// RFC-6455 upgrade. Per-connection state lives on ws.data (Bun's typed slot).

import type { ServerWebSocket, WebSocketHandler } from 'bun';

import type { Api } from './api.ts';
import type { Context } from './context.ts';
import type { Inspect } from './inspect.ts';

export interface WsData {
  id: string;
  remote: string;
}

export interface Ws {
  handler: WebSocketHandler<WsData>;
  broadcast(payload: unknown): void;
  clientCount(): number;
}

export function createWs(ctx: Context, api: Api, inspect: Inspect): Ws {
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
    for (const ws of clients) send(ws, msg);
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

  const handler: WebSocketHandler<WsData> = {
    open(ws) {
      clients.add(ws);
      send(ws, { type: 'snapshot', state: inspect.state });
    },
    close(ws) {
      clients.delete(ws);
    },
    async message(ws, raw) {
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
