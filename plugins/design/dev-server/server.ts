#!/usr/bin/env bun
// Dev-server entry. Bun.serve + native WebSocket + per-platform standalone
// binary distribution (DDR-009, DDR-013, DDR-015).
//
// Process layout:
//   createContext()  -> repo root, config, paths, pub/sub bus
//   createApi(ctx)   -> comments / canvas-state / index / system data
//   createInspect()  -> active-canvas tracking + HTML injection
//   createWs()       -> Bun.serve native WS handler
//   createHttp()     -> route table + fall-through fetch
//   createFsWatch()  -> recursive fs.watch -> bus -> WS broadcast
//
// Single Bun.serve instance owns both HTTP routes and the WS upgrade. Nothing
// else binds to a port. The orchestrator (slash commands) reads _server.json
// to detect a live instance and avoid duplicate boots.

import { spawn } from 'node:child_process';

import { createApi } from './api.ts';
import { createContext } from './context.ts';
import { createFsWatch } from './fs-watch.ts';
import { createHttp } from './http.ts';
import { createInspect } from './inspect.ts';
import { startHeapWatch } from './mem.ts';
import { createWs } from './ws.ts';

const ctx = createContext();

const api = createApi(ctx, async (file) => {
  // After every comments mutation, re-broadcast the updated list.
  const comments = await api.loadCommentsForFile(file);
  ctx.bus.emit('comments', { file, comments });
});

const inspect = createInspect(ctx, (file) => api.loadCommentsForFile(file));
await inspect.load();

const ws = createWs(ctx, api, inspect);
const http = createHttp(ctx, api, inspect);
const fsWatch = createFsWatch(ctx);

// Port: --port arg > $PORT > $MDCC_DEV_PORT > 4399.
function resolvePort(): number {
  const i = process.argv.indexOf('--port');
  if (i !== -1 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  const env = process.env.PORT ?? process.env.MDCC_DEV_PORT;
  if (env) return Number(env);
  return 4399;
}

const PORT = resolvePort();

const server = Bun.serve<{ id: string; remote: string }, never>({
  port: PORT,
  hostname: '127.0.0.1',
  development: process.env.NODE_ENV !== 'production',
  routes: http.routes,
  async fetch(req, srv) {
    // WebSocket upgrade.
    if (new URL(req.url).pathname.startsWith('/_ws')) {
      const ok = srv.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
          remote: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
        },
      });
      if (ok) return undefined as unknown as Response;
      return new Response('Upgrade failed', { status: 400 });
    }
    return http.fetch(req);
  },
  websocket: ws.handler,
  error(e) {
    console.error('[bun.serve error]', e);
    return new Response('Server error', { status: 500 });
  },
});

await Bun.write(
  ctx.paths.serverInfoFile,
  JSON.stringify(
    {
      pid: process.pid,
      port: server.port,
      url: `http://localhost:${server.port}`,
      started: new Date().toISOString(),
      project: ctx.cfg.name,
      config_source: ctx.cfg._source,
    },
    null,
    2
  )
);

fsWatch.start();
startHeapWatch();

const url = `http://localhost:${server.port}`;
console.log(`\n  ${ctx.projectLabel} — local browser`);
console.log('  ─────────────────────────────');
console.log(`  ${url}`);
console.log(`  Project:   ${ctx.cfg.name}`);
console.log(`  Config:    ${ctx.cfg._source}`);
console.log(`  Design:    ${ctx.paths.designRoot}`);
console.log(`  Active:    ${ctx.paths.activeFile}`);
console.log('  Press Ctrl+C to stop.\n');

if (!process.env.NO_OPEN) {
  if (process.platform === 'darwin')
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  else if (process.platform === 'linux')
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

async function shutdown() {
  console.log('\n  Stopping…');
  fsWatch.stop();
  try {
    await Bun.write(ctx.paths.serverInfoFile, '').catch(() => {});
    // Remove the file by writing empty then unlinking.
    const fs = await import('node:fs/promises');
    await fs.unlink(ctx.paths.serverInfoFile).catch(() => {});
  } catch {
    /* ignore */
  }
  server.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
