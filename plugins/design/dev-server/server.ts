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
import { bootSelfHeal } from './boot-self-heal.ts';
import { createCollab } from './collab/index.ts';
import { createContext } from './context.ts';
import { createFsWatch } from './fs-watch.ts';
import { createHttp } from './http.ts';
import { createInspect } from './inspect.ts';
import { startHeapWatch } from './mem.ts';
import { createWs, isLoopbackHost, parseCollabSlug, type WsData } from './ws.ts';

// Phase 19 / DDR-044 — covers the marketplace-cache-install gap where
// node_modules/ ships empty (git clone honors .gitignore). Auto-installs +
// builds on first boot; opt out with MAUDE_NO_AUTOBUILD=1.
await bootSelfHeal();

const ctx = createContext();

const api = createApi(ctx, async (file) => {
  // After every comments mutation, re-broadcast the updated list.
  const comments = await api.loadCommentsForFile(file);
  ctx.bus.emit('comments', { file, comments });
});

const inspect = createInspect(ctx, (file) => api.loadCommentsForFile(file));
await inspect.load();

const collab = createCollab(ctx, api);
const ws = createWs(ctx, api, inspect, collab);
const http = createHttp(ctx, api, inspect);
const fsWatch = createFsWatch(ctx);

// Port: --port arg > $PORT > $MDCC_DEV_PORT > 4399.
// When the port wasn't explicitly chosen and the default is busy (another
// project's dev-server is running on the same machine), walk up to 4408 before
// giving up. Explicit ports stay fatal so users notice their own collisions.
function resolvePort(): { port: number; explicit: boolean } {
  const i = process.argv.indexOf('--port');
  if (i !== -1 && process.argv[i + 1]) return { port: Number(process.argv[i + 1]), explicit: true };
  const env = process.env.PORT ?? process.env.MDCC_DEV_PORT;
  if (env) return { port: Number(env), explicit: true };
  return { port: 4399, explicit: false };
}

const { port: BASE_PORT, explicit: PORT_EXPLICIT } = resolvePort();

type BunServer = ReturnType<typeof Bun.serve<WsData, never>>;

function startServer(port: number): BunServer {
  return Bun.serve<WsData, never>({
    port,
    hostname: '127.0.0.1',
    development: process.env.NODE_ENV !== 'production',
    routes: http.routes,
    async fetch(req, srv) {
      const pathname = new URL(req.url).pathname;

      // Phase 8 — collab WS, binary y-websocket protocol. Loopback-only;
      // DDR-047 makes cross-machine collab a Phase 9 hub-deploy story, not
      // a `--bind 0.0.0.0` flag on this server.
      const collabSlug = parseCollabSlug(pathname);
      if (collabSlug !== null) {
        if (!isLoopbackHost(req.headers.get('host'))) {
          return new Response('cross-machine collab requires Phase 9 hub deploy', {
            status: 403,
          });
        }
        const ok = srv.upgrade(req, {
          data: {
            id: crypto.randomUUID(),
            remote: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
            kind: 'collab',
            slug: collabSlug,
          },
        });
        if (ok) return undefined as unknown as Response;
        return new Response('Upgrade failed', { status: 400 });
      }

      // Legacy inspector WS — JSON frames, designer-facing live tab state.
      if (pathname.startsWith('/_ws')) {
        const ok = srv.upgrade(req, {
          data: {
            id: crypto.randomUUID(),
            remote: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
            kind: 'inspector',
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
}

function isAddrInUse(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; errno?: number };
  return err.code === 'EADDRINUSE';
}

let server: BunServer;
{
  const MAX_TRIES = PORT_EXPLICIT ? 1 : 10;
  let lastErr: unknown;
  let bound: BunServer | null = null;
  for (let i = 0; i < MAX_TRIES; i++) {
    const tryPort = BASE_PORT + i;
    try {
      bound = startServer(tryPort);
      if (i > 0) {
        console.log(`[port] ${BASE_PORT} busy, using ${tryPort} instead.`);
      }
      break;
    } catch (e) {
      lastErr = e;
      if (!isAddrInUse(e)) throw e;
    }
  }
  if (!bound) {
    if (PORT_EXPLICIT) {
      console.error(
        `\n  Port ${BASE_PORT} is in use. Pick a different one with --port <N> or $PORT.\n`
      );
    } else {
      console.error(
        `\n  Ports ${BASE_PORT}-${BASE_PORT + MAX_TRIES - 1} are all in use. Stop a running dev-server or pass --port <N>.\n`
      );
    }
    throw lastErr;
  }
  server = bound;
}

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
    await collab.registry.destroyAll();
  } catch {
    /* best-effort flush; the JSON snapshot is the ground truth anyway */
  }
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
