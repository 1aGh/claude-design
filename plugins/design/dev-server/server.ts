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
import { createAiActivity } from './collab/ai-activity.ts';
import { createGitLifecycle } from './collab/git-lifecycle.ts';
import { createCollab } from './collab/index.ts';
import { createContext } from './context.ts';
import { createFsWatch } from './fs-watch.ts';
import { createHttp } from './http.ts';
import { createInspect } from './inspect.ts';
import { startHeapWatch } from './mem.ts';
import { createSyncRuntime } from './sync/index.ts';
import { type WsData, createWs, isLoopbackHost, parseCollabSlug } from './ws.ts';

// Phase 19 / DDR-044 — covers the marketplace-cache-install gap where
// node_modules/ ships empty (git clone honors .gitignore). Auto-installs +
// builds on first boot; opt out with MAUDE_NO_AUTOBUILD=1.
await bootSelfHeal();

const ctx = createContext();

// Forward-declared so the api.commentsAdd/patch/delete/addReply callback can
// reach into the collab registry (Phase 8 Task 3 bridge). collab is initialized
// synchronously below; the callback only fires at runtime, by which point the
// binding is set.
let collab: ReturnType<typeof createCollab> | null = null;

const api = createApi(ctx, {
  onCommentsChanged: async (file) => {
    // After every comments mutation, re-broadcast the updated list.
    const comments = await api.loadCommentsForFile(file);
    ctx.bus.emit('comments', { file, comments });
    // Phase 8 Task 3 — bridge into the live Y.Array so collab peers see the
    // change without waiting for cold-open re-seeding. No-op when no room is
    // live for this canvas slug.
    if (collab) {
      collab.registry.syncRoomFromComments(api.fileSlug(file), comments);
    }
  },
  // Phase 8 Task 5 — same bridge for annotations. PUT /_api/annotations writes
  // the SVG blob to disk; we mirror it into the live Y.Map for collab peers.
  onAnnotationsChanged: (file, svg) => {
    if (collab) {
      collab.registry.syncRoomFromAnnotations(api.fileSlug(file), svg);
    }
  },
});

const inspect = createInspect(ctx, (file) => api.loadCommentsForFile(file));
await inspect.load();

collab = createCollab(ctx, api);
const aiActivity = createAiActivity(ctx);
const gitLifecycle = createGitLifecycle(ctx, collab.registry);
const ws = createWs(ctx, api, inspect, collab);
const http = createHttp(ctx, api, inspect, aiActivity);
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

// T2 (9.1-A) — the segregated canvas-content origin. A second Bun.serve on its
// own (OS-assigned) port, sharing this process's ctx / api / inspect / collab /
// ws. Canvas iframes load from here; hub-pushed JSX that executes in a canvas
// can therefore only reach THIS origin (locked further by the CSP on the shell
// + an iframe sandbox), never the main origin's /_api/export, /_config,
// /_sync-status, /_comments, or arbitrary repo files. Routes are a hard
// allowlist: Bun matches `routes` before `fetch`, so we expose ONLY the two
// gated API endpoints the runtime needs here and 403 everything else in fetch.
function startCanvasServer(port: number): BunServer {
  return Bun.serve<WsData, never>({
    port,
    hostname: '127.0.0.1',
    development: process.env.NODE_ENV !== 'production',
    // Hard allowlist of route-table endpoints (Bun matches `routes` before
    // `fetch`). Only the collab/display-data endpoints the canvas runtime needs
    // — see http.isCanvasSafeRoute for the trust rationale. The dynamic
    // /_api/comments/<id>/reply POST is fetch-handled + gated there.
    routes: {
      '/_health': http.routes['/_health'],
      '/_api/git-user': http.routes['/_api/git-user'],
      '/_api/canvas-meta': http.routes['/_api/canvas-meta'],
      '/_api/annotations': http.routes['/_api/annotations'],
      '/_api/git-committers': http.routes['/_api/git-committers'],
      '/_api/ai': http.routes['/_api/ai'],
      '/_comments': http.routes['/_comments'],
    },
    async fetch(req, srv) {
      const pathname = new URL(req.url).pathname;

      // Collab WS — shared registry, loopback-only (same gate as the main origin).
      const collabSlug = parseCollabSlug(pathname);
      if (collabSlug !== null) {
        if (!isLoopbackHost(req.headers.get('host'))) {
          return new Response('cross-machine collab requires Phase 9 hub deploy', { status: 403 });
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

      // HMR-only socket — canvas iframes listen for `canvas-hmr` here. Carries
      // NO privileged inspector feed and ignores inbound messages (ws.ts).
      if (pathname.startsWith('/_ws')) {
        const ok = srv.upgrade(req, {
          data: {
            id: crypto.randomUUID(),
            remote: req.headers.get('x-forwarded-for') ?? '127.0.0.1',
            kind: 'canvas-hmr',
          },
        });
        if (ok) return undefined as unknown as Response;
        return new Response('Upgrade failed', { status: 400 });
      }

      // Canvas mount harness with the strict CSP ALWAYS on (F1 gate).
      if (pathname === '/_canvas-shell.html' || pathname === '/_canvas-shell') {
        return http.serveCanvasShell(true);
      }

      // Allowlist gate — runtime bundles, comment-mount, transpiled .tsx + CSS/
      // assets under designRoot. Everything else is refused at the door.
      if (!http.isCanvasSafeRoute(pathname)) {
        return new Response('Forbidden (canvas origin)', { status: 403 });
      }
      return http.fetch(req);
    },
    websocket: ws.handler,
    error(e) {
      console.error('[bun.serve canvas-origin error]', e);
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

// T2 (9.1-A) — advertise the main origin so the canvas origin's CSP can
// allowlist it in `frame-ancestors` (the legit embedder). Must be set before
// the canvas listener serves its first shell.
ctx.mainOrigin = `http://localhost:${server.port}`;

// T2 (9.1-A) — segregated canvas-content origin. ON BY DEFAULT (opt-OUT) since
// phase-9.1: a second listener binds an OS-assigned free port, advertised as
// `canvasOrigin`, and the client loads canvas iframes cross-origin under the
// strict CSP + sandbox + route-allowlist (the F1 containment). This is purely
// protective — for a solo user it sandboxes their OWN canvas code (no untrusted
// content, no exfil concern), and interactive-feature parity (selection,
// comments, presence, motion) is verified. It does NOT by itself enable
// untrusted `.tsx` sync — that still requires the per-canvas `syncable` opt-in
// (sync/index.ts), so the WebRTC/self-nav exfil residual only applies to a
// canvas explicitly opted into syncing (DDR-060 + the F1 re-audit report).
// Set `MAUDE_CANVAS_ORIGIN_SPLIT=0` (or false/off/no) to fall back to the legacy
// same-origin path.
const CANVAS_ORIGIN_SPLIT = !/^(0|false|off|no)$/i.test(
  process.env.MAUDE_CANVAS_ORIGIN_SPLIT ?? ''
);
const canvasServer = CANVAS_ORIGIN_SPLIT ? startCanvasServer(0) : null;
const canvasOrigin = canvasServer ? `http://localhost:${canvasServer.port}` : undefined;
if (canvasOrigin) ctx.canvasOrigin = canvasOrigin;

await Bun.write(
  ctx.paths.serverInfoFile,
  JSON.stringify(
    {
      pid: process.pid,
      port: server.port,
      url: `http://localhost:${server.port}`,
      ...(canvasOrigin ? { canvasOrigin } : {}),
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

// Phase 9 Task 4 — bidirectional sync agent. No-op when the project isn't
// linked to a hub (`.design/config.json` has no `linkedHub` field). Kicked
// off after fsWatch so the agent's bus subscription receives every fs event.
const syncRuntime = createSyncRuntime(ctx, collab ? { registry: collab.registry } : {});
if (syncRuntime) {
  try {
    await syncRuntime.start();
  } catch (err) {
    console.error('[sync] startup failed — continuing in solo mode:', err);
  }
}

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
    if (syncRuntime) await syncRuntime.stop();
  } catch {
    /* best-effort — provider sockets will be closed by process exit anyway */
  }
  try {
    if (collab) {
      collab.dispose();
      await collab.registry.destroyAll();
    }
  } catch {
    /* best-effort flush; the JSON snapshot is the ground truth anyway */
  }
  try {
    aiActivity.stop();
  } catch {
    /* janitor cleanup is best-effort */
  }
  try {
    gitLifecycle.stop();
  } catch {
    /* watcher cleanup is best-effort */
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
  try {
    canvasServer?.stop();
  } catch {
    /* best-effort */
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
