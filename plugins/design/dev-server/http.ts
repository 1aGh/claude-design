// HTTP layer for Bun.serve.
//
// Designed for extension — Phase 3.6 adds /ui/:slug + /_bun_hmr by appending to
// the route table without rewriting this module. The `fetch` export is the
// top-level fall-through for paths Bun's `routes` field doesn't cover.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, watch } from 'node:fs';
import { join, posix } from 'node:path';

import type { Api } from './api.ts';
import { buildCanvasModule } from './canvas-build.ts';
import { canvasLibPath } from './canvas-lib-resolver.ts';
import { TranspileError } from './canvas-pipeline.ts';
import type { AiActivity } from './collab/ai-activity.ts';
import type { Context } from './context.ts';
import { isFormat, isScope, runExport } from './exporters/index.ts';
import type { ActiveJsonShape } from './exporters/scope.ts';
import type { Inspect } from './inspect.ts';
import { canvasSlug, writeLocator } from './locator.ts';
import { DEV_SERVER_ROOT } from './paths.ts';
import { RUNTIME_PACKAGES, getRuntimeBundle, packageForSlug, slugFor } from './runtime-bundle.ts';

// Real disk install root — never the virtual `/$bunfs/root` of compiled bins.
// See paths.ts for the resolution logic + Phase 19.1 / v0.18.1 rationale.
const HERE = DEV_SERVER_ROOT;

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function ext(p: string): string {
  const i = p.lastIndexOf('.');
  return i === -1 ? '' : p.slice(i).toLowerCase();
}

/**
 * T2 (9.1-A) — build the strict CSP for the canvas-content shell. Every inline
 * `<script>` (importmap, module bootstrap, inspector) is allowlisted by sha256
 * hash so we never resort to `'unsafe-inline'`. `connect-src 'self'` is locked
 * to the document's own origin so hub-pushed JSX can't beacon out / hit IMDS /
 * LAN — and `'self'` covers same-origin `ws:`/`wss:` (CSP3), so the HMR + collab
 * sockets (which connect to the canvas origin the iframe loads from) still work
 * while `ws://attacker` / `wss://attacker` exfil is refused. `style-src
 * 'unsafe-inline'` is intentional —
 * specimens use `style={{…}}` attributes + injected `<style>`; style injection
 * is not the F1 RCE vector (script + connect are). No `'unsafe-eval'` — the
 * POC verifies the runtime (motion/pixi/Bun.build output) doesn't need it.
 *
 * `webrtc 'block'` (A6, DDR-060 F1 re-audit) — `connect-src` governs only
 * fetch/XHR/WebSocket/sendBeacon; WebRTC does NOT flow through Fetch, so an
 * `RTCPeerConnection` with an attacker STUN/TURN hostname smuggles bytes out via
 * ICE DNS/STUN even under `connect-src 'self'`. The dedicated `webrtc` directive
 * is the only CSP control for it. The canvas runtime uses zero WebRTC (presence
 * rides the same-origin collab WS), so blocking it is free.
 *
 * `frame-ancestors` (A6) — restricts who may embed the canvas document. The
 * legit embedder is the main dev-server origin, so we allowlist exactly that
 * (`mainOrigin`) plus `'self'`; an arbitrary external page can no longer reframe
 * the canvas. When `mainOrigin` is unknown (tests / pre-boot) the directive is
 * OMITTED rather than set to `'self'` — `'self'` alone would forbid the legit
 * cross-origin embed and blank the canvas.
 */
export function cspForCanvasShell(html: string, mainOrigin?: string): string {
  const hashes: string[] = [];
  // Match inline <script> blocks only (no src=). `[^>]*` excludes any with src.
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop.
  while ((m = re.exec(html)) !== null) {
    const body = m[1] ?? '';
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  const scriptSrc = ["'self'", ...hashes].join(' ');
  const directives = [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    "connect-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "webrtc 'block'",
  ];
  if (mainOrigin) directives.push(`frame-ancestors 'self' ${mainOrigin}`);
  return directives.join('; ');
}

function safePathUnderRoot(reqUrl: string, repoRoot: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(reqUrl, 'http://x').pathname);
  } catch {
    return null;
  }
  const sep = '/';
  const normalized = posix.normalize(posix.join(repoRoot, pathname));
  if (normalized !== repoRoot && !normalized.startsWith(repoRoot + sep)) return null;
  return normalized;
}

// `dist/` lives next to server.ts when running source-mode (bun run server.ts)
// and inside the standalone binary's embedded FS in --compile mode.
const DIST_DIR = join(HERE, 'dist');
const CLIENT_DIR = join(HERE, 'client');
const TEMPLATES_DIR = join(HERE, '..', 'templates');

// In-memory transpile cache. Key = absolute canvas path; value = the last
// transpile keyed by mtime. Repeat GETs against an unchanged source skip the
// parse + ID-injection + Bun.Transpiler entirely.
interface CanvasCacheEntry {
  mtimeMs: number;
  etag: string;
  js: string;
}
const canvasCache = new Map<string, CanvasCacheEntry>();

async function serveCanvasTsx(
  absPath: string,
  req: Request,
  ctx: Context,
  locatorAbsPath: string
): Promise<Response> {
  const file = Bun.file(absPath);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });

  // `stat` via Bun.file().lastModified — falls back to 0 if unavailable.
  const mtimeMs = typeof file.lastModified === 'number' ? file.lastModified : 0;
  let cached = canvasCache.get(absPath);

  if (!cached || cached.mtimeMs !== mtimeMs) {
    const source = await file.text();
    let result: Awaited<ReturnType<typeof buildCanvasModule>>;
    try {
      result = await buildCanvasModule(absPath, source, {
        designRoot: ctx.paths.designRoot,
      });
    } catch (err) {
      if (err instanceof TranspileError) {
        return new Response(`Transpile error: ${err.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Canvas build error: ${msg}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    cached = { mtimeMs, etag: result.etag, js: result.js };
    canvasCache.set(absPath, cached);
    // Persist the locator map. Awaited so the inspector / Phase-12 layers
    // panel sees a consistent (cdId -> source) view by the time the canvas
    // mounts. Per-path mutex inside writeLocator() makes concurrent transpiles
    // safe.
    await writeLocator(locatorAbsPath, canvasSlug(absPath, ctx.paths.designRoot), result.locator);
  }

  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch === cached.etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: cached.etag, 'Cache-Control': 'no-cache' },
    });
  }
  return new Response(cached.js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      ETag: cached.etag,
      'Cache-Control': 'no-cache',
    },
  });
}

async function serveFile(absPath: string, headers: Record<string, string> = {}): Promise<Response> {
  const file = Bun.file(absPath);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });
  const e = ext(absPath);
  return new Response(file, {
    headers: {
      'Content-Type': MIME[e] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export interface Http {
  routes: Record<string, (req: Request) => Response | Promise<Response>>;
  fetch(req: Request): Promise<Response>;
  /**
   * T2 (9.1-A) — build the canvas mount-harness response. `applyCsp` adds the
   * strict CSP (always on for the segregated canvas origin; the legacy main
   * origin keeps it env-gated for the POC). Shared so both listeners produce
   * byte-identical HTML.
   */
  serveCanvasShell(applyCsp: boolean): Promise<Response>;
  /**
   * T2 (9.1-A) — allowlist gate for the segregated canvas origin. Returns true
   * only for the routes the canvas runtime legitimately needs (shell, runtime
   * bundles, comment-mount, transpiled .tsx + CSS/assets under designRoot,
   * git-user, canvas-meta, health). Everything else is 403'd at the door so
   * hub-pushed JSX can't reach /_api/export, /_config, /_sync-status, comments,
   * the app shell, or arbitrary repo files. WS upgrades are gated in server.ts.
   */
  isCanvasSafeRoute(pathname: string): boolean;
}

export function createHttp(ctx: Context, api: Api, inspect: Inspect, ai: AiActivity): Http {
  // Cache invalidation — when canvas-lib changes, every cached canvas bundle
  // is stale because canvas-lib is inlined into each one via the resolver
  // plugin. Drop the whole cache so the next request rebuilds with the fresh
  // lib. Without this, the HMR "hard reload" message reaches the browser but
  // the iframe re-fetches a stale-but-fresh-mtime bundle and the change never
  // takes effect.
  //
  // Per DDR-025 canvas-lib ships with the dev-server, so we watch the
  // dev-server-internal file directly instead of relying on the project-side
  // fs:any watcher. The synthetic `_lib/canvas-lib.tsx` rel-path lets the
  // existing hmr-broadcast classifier emit a hard reload without bespoke
  // wiring. The legacy `fs:any` _lib/ listener stays for downstream projects
  // still carrying a pre-4.0.5 `<designRoot>/_lib/`, but that file is now
  // ignored at build time — clearing the cache here is harmless.
  ctx.bus.on('fs:any', (rel: string) => {
    if (rel.startsWith('_lib/')) {
      canvasCache.clear();
    }
  });

  let libWatcher: ReturnType<typeof watch> | null = null;
  try {
    libWatcher = watch(canvasLibPath(), () => {
      canvasCache.clear();
      ctx.bus.emit('fs:any', '_lib/canvas-lib.tsx');
    });
  } catch (err) {
    console.warn(
      '[canvas-lib] failed to watch dev-server canvas-lib:',
      err instanceof Error ? err.message : err
    );
  }
  void libWatcher;

  // G7v2 — canvas-lib.tsx transitively imports many dev-server siblings
  // (canvas-shell, contextual-toolbar, equal-spacing-handles, ...). Editing
  // any of them invalidates the bundled canvas output. Without watching them
  // the mtime-keyed `canvasCache` keeps serving the stale bundle and the
  // user sees pre-edit behaviour even after a hard iframe reload.
  //
  // Recursive watch over DEV_SERVER_ROOT, filtered to .tsx — server-only .ts
  // (api / http / context / etc.) doesn't reach the canvas. Test files
  // (`test/`) and built output (`dist/`, `client/`) also skipped.
  let devSrcWatcher: ReturnType<typeof watch> | null = null;
  try {
    devSrcWatcher = watch(DEV_SERVER_ROOT, { recursive: true }, (_evt, filename) => {
      if (!filename) return;
      if (!filename.endsWith('.tsx')) return;
      if (filename.startsWith('test/') || filename.startsWith('test\\')) return;
      if (filename.startsWith('dist/') || filename.startsWith('client/')) return;
      canvasCache.clear();
      ctx.bus.emit('fs:any', `_lib/${filename}`);
    });
  } catch (err) {
    console.warn(
      '[dev-server-src] failed to watch source tree:',
      err instanceof Error ? err.message : err
    );
  }
  void devSrcWatcher;

  async function readJson<T = unknown>(req: Request, max = 256 * 1024): Promise<T | null> {
    try {
      const text = await req.text();
      if (text.length > max) throw new Error('body too large');
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  const routes = {
    '/_health': () =>
      Response.json({
        ok: true,
        app: 'design',
        project: ctx.cfg.name,
        pid: process.pid,
      }),

    '/_active': () => Response.json(inspect.state),

    // Phase 9 Task 8 — offline-mode banner poll fallback. The linked-mode sync
    // runtime writes `_sync.json`; browser tabs also get live pushes over the
    // WS ('sync:status'). Returns `{ linked: false }` in solo mode.
    '/_sync-status': () => {
      const file = join(ctx.paths.designRoot, '_sync.json');
      if (!existsSync(file)) {
        return Response.json({ linked: false }, { headers: { 'Cache-Control': 'no-store' } });
      }
      try {
        return Response.json(JSON.parse(readFileSync(file, 'utf8')), {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch {
        return Response.json({ linked: false }, { headers: { 'Cache-Control': 'no-store' } });
      }
    },

    '/_config': () => Response.json({ ...ctx.cfg, canvasOrigin: ctx.canvasOrigin }),

    '/_index-data': async () =>
      Response.json(await api.buildIndexData(), { headers: { 'Cache-Control': 'no-store' } }),

    '/_system-data': async (req: Request) => {
      // DDR-048 — `?ds=<name>` scopes to one design system (per-DS tokens,
      // per-DS preview gallery). Omitted = legacy top-level scan for
      // backwards compat with single-DS projects.
      const dsName = new URL(req.url).searchParams.get('ds');
      const data = await api.buildSystemData(dsName);
      if (data === null) {
        return Response.json(
          { error: 'unknown design system', ds: dsName },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_comments-all': async () =>
      Response.json(await api.loadAllComments(), { headers: { 'Cache-Control': 'no-store' } }),

    '/_comments': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const file = new URL(req.url).searchParams.get('file');
      if (!file) return new Response('file query param required', { status: 400 });
      const comments = await api.loadCommentsForFile(file);
      return Response.json({ file, comments }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/canvas-meta': async (req: Request) => {
      // Phase 4 T5 — sibling `<canvas>.meta.json` read / merge.
      // GET ?file=<repo-relative-canvas-path>            → full meta or {}
      // PATCH (or POST) body { file, patch: {...} }      → shallow-merged meta
      const url = new URL(req.url);
      if (req.method === 'GET') {
        const file = url.searchParams.get('file');
        if (!file) return new Response('file query param required', { status: 400 });
        const meta = await api.loadCanvasMeta(file);
        return Response.json(meta ?? {}, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (req.method === 'PATCH' || req.method === 'POST') {
        const body = await readJson<{ file?: string; patch?: Record<string, unknown> }>(req);
        if (!body || typeof body.file !== 'string' || !body.file) {
          return new Response('body must include { file, patch }', { status: 400 });
        }
        if (!body.patch || typeof body.patch !== 'object') {
          return new Response('body.patch must be an object', { status: 400 });
        }
        const next = await api.patchCanvasMeta(body.file, body.patch);
        if (!next) return new Response('Not found or rejected', { status: 404 });
        return Response.json(next, { headers: { 'Cache-Control': 'no-store' } });
      }
      return new Response('Method not allowed', { status: 405 });
    },

    '/_api/git-committers': async (req: Request) => {
      // Phase 6 — feed for the @mention autocomplete in composer + reply box.
      // GET → top-20 committers on HEAD (`git shortlog -sne | head -20`)
      // already cached server-side for 60 s.
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const committers = await api.gitCommitters();
      return Response.json({ committers }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/git-user': async (req: Request) => {
      // Phase 8 — local `git config user.name` for the collab Awareness peer
      // identity. Color-hash derives from this; falls back to anonymous-<pid>
      // client-side when empty.
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const name = await api.gitCurrentUser();
      return Response.json({ name }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/ai': async (req: Request) => {
      // Phase 8 Task 4 — read-only snapshot of the current AI activity map.
      // GET → { entries: [{ file, author, startedAt, lastHeartbeat }, …] }
      // Clients use this on mount to backfill the banner state without
      // waiting for the next bus event.
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      return Response.json({ entries: ai.list() }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/ai/start': async (req: Request) => {
      // Phase 8 Task 4 — `/design:edit` (or any external slash command driving
      // Claude work) POSTs here when work begins. body = { file, author }.
      // Replaces any prior entry for the file.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{ file?: string; author?: string }>(req);
      if (!body || typeof body.file !== 'string' || !body.file.trim()) {
        return new Response('body.file required', { status: 400 });
      }
      const author =
        typeof body.author === 'string' && body.author.trim()
          ? body.author.trim().slice(0, 120)
          : 'Claude';
      const entry = ai.start(body.file.trim(), author);
      return Response.json(entry, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/ai/heartbeat': async (req: Request) => {
      // Refresh the lastHeartbeat. Returns 404 if no entry — slash command
      // can treat that as "the server bounced; re-issue /start".
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{ file?: string }>(req);
      if (!body || typeof body.file !== 'string' || !body.file.trim()) {
        return new Response('body.file required', { status: 400 });
      }
      const entry = ai.heartbeat(body.file.trim());
      if (!entry) return new Response('no active entry', { status: 404 });
      return Response.json(entry, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/ai/end': async (req: Request) => {
      // Explicit completion (normal or error). Banner clears immediately.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{ file?: string }>(req);
      if (!body || typeof body.file !== 'string' || !body.file.trim()) {
        return new Response('body.file required', { status: 400 });
      }
      const cleared = ai.end(body.file.trim());
      return Response.json(
        { cleared },
        { status: cleared ? 200 : 404, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/annotations': async (req: Request) => {
      // Phase 5 — `<designRoot>/<slug>.annotations.svg` read / overwrite.
      // GET ?file=<repo-relative-canvas-path>           → SVG text (empty if absent)
      // PUT body { file, svg }                          → 204 on write, 4xx otherwise
      const url = new URL(req.url);
      if (req.method === 'GET') {
        const file = url.searchParams.get('file');
        if (!file) return new Response('file query param required', { status: 400 });
        const svg = await api.loadAnnotations(file);
        return new Response(svg ?? '', {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readJson<{ file?: string; svg?: string }>(req, 1024 * 1024 + 1024);
        if (!body || typeof body.file !== 'string' || !body.file) {
          return new Response('body must include { file, svg }', { status: 400 });
        }
        if (typeof body.svg !== 'string') {
          return new Response('body.svg must be a string', { status: 400 });
        }
        const ok = await api.saveAnnotations(body.file, body.svg);
        if (!ok) return new Response('rejected', { status: 400 });
        return new Response(null, { status: 204 });
      }
      return new Response('Method not allowed', { status: 405 });
    },

    '/_api/export-history': async (req: Request) => {
      // Phase 6.5 T10 — read-only recent-exports feed for the dialog's
      // Recent tab. Writes happen as a side-effect of `/_api/export`.
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const history = await api.loadExportHistory();
      return Response.json({ history }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/export': async (req: Request) => {
      // Phase 6.5 — single dispatch endpoint for the export pipeline.
      // POST body { format, scope, options? } → binary stream with
      // Content-Disposition + Content-Type set by the adapter.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{
        format?: unknown;
        scope?: unknown;
        options?: Record<string, unknown>;
      }>(req, 64 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      if (!isFormat(body.format)) return new Response('unknown or missing format', { status: 400 });
      if (!isScope(body.scope)) return new Response('unknown or missing scope', { status: 400 });
      // `inspect.state` is the live `_active.json` — readers narrow to the
      // resolver's subset locally so the export pipeline doesn't pin the
      // wider ActiveState interface.
      const activeJson = inspect.state as unknown as ActiveJsonShape;
      try {
        const result = await runExport({
          format: body.format,
          scope: body.scope,
          options: body.options ?? {},
          resolve: { activeJson, designRoot: ctx.paths.designRoot, repoRoot: ctx.paths.repoRoot },
          ctx: {
            designRoot: ctx.paths.designRoot,
            repoRoot: ctx.paths.repoRoot,
            // Adapters reach back into the server via this origin only when
            // they need Playwright rendering (PNG / PDF / SVG / HTML). The
            // host that received this request is, by definition, the one
            // serving the canvas.
            serverOrigin: new URL(req.url).origin,
            // Mirror `client/app.jsx:85` — the per-DS tokensCssRel wins over
            // the legacy top-level default (which still points at the pre-
            // multi-DS layout `system/colors_and_type.css`). Without the
            // per-DS path, the standalone `_canvas-shell.html` 404s on the
            // tokens link and the rendered DOM uses `var(--bg-0)` unresolved
            // → screenshots come out blank. See canvasShellUrl().
            tokensCssRel: ctx.cfg.designSystems?.[0]?.tokensCssRel ?? ctx.cfg.tokensCssRel,
          },
        });
        // Fire-and-forget history append — failure here doesn't block the
        // download. Synchronous await keeps the order: history reflects the
        // export the moment the client sees a 200.
        try {
          await api.appendExportHistory({
            format: body.format,
            scope: body.scope,
            options: body.options ?? {},
            filename: result.filename,
            at: new Date().toISOString(),
          });
        } catch {
          /* ignore — history is best-effort */
        }
        // Bun.serve accepts Uint8Array directly; the cast satisfies the
        // SharedArrayBuffer-strict BodyInit narrowing on @types/bun.
        return new Response(result.body as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(`export failed: ${msg}`, { status: 500 });
      }
    },

    '/_canvas-state': async (req: Request) => {
      const url = new URL(req.url);
      if (req.method === 'GET') {
        const file = url.searchParams.get('file');
        if (!file) return new Response('file query param required', { status: 400 });
        const state = await api.loadCanvasState(file);
        return Response.json(state ?? {}, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (req.method === 'POST') {
        const body = await readJson<{ file?: string }>(req);
        if (!body || typeof body.file !== 'string' || !body.file) {
          return new Response('body must include file (string)', { status: 400 });
        }
        await api.saveCanvasState(body.file, body as Record<string, unknown>);
        return new Response(null, { status: 204 });
      }
      return new Response('Method not allowed', { status: 405 });
    },

    '/_hmr': async (req: Request) => {
      // Hint endpoint — the build:watch process POSTs `{ type, path, hash }`
      // after a rebuild; we forward it to all WS clients. Body is opaque; we
      // just emit on the bus and ws.ts handles broadcast.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{ type: string; path?: string; hash?: number }>(req);
      if (!body || typeof body.type !== 'string') return new Response('bad body', { status: 400 });
      ctx.bus.emit('hmr', body);
      return new Response(null, { status: 204 });
    },

    '/': () => serveFile(join(CLIENT_DIR, 'index.html')),
    '/index.html': () => serveFile(join(CLIENT_DIR, 'index.html')),
  } satisfies Record<string, (req: Request) => Response | Promise<Response>>;

  async function fetch(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // Phase 6 — POST /_api/comments/<id>/reply. Dynamic path, so it lives in
      // the fall-through instead of the static `routes` map. `<id>` is the
      // c_<hex> id of the parent comment; body is `{ body, author? }`. Bodies
      // share the same 4000-char cap as a top-level comment.
      const replyMatch = pathname.match(/^\/_api\/comments\/([A-Za-z0-9_]+)\/reply$/);
      if (replyMatch) {
        if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
        const id = replyMatch[1] ?? '';
        const body = await readJson<{ body?: string; author?: string }>(req);
        if (!body || typeof body.body !== 'string' || !body.body.trim()) {
          return new Response('body.body required', { status: 400 });
        }
        const next = await api.commentsAddReply(id, {
          body: body.body,
          author: typeof body.author === 'string' ? body.author : undefined,
        });
        if (!next) return new Response('Not found', { status: 404 });
        return Response.json(next, { headers: { 'Cache-Control': 'no-store' } });
      }

      // Bundled client assets (preferred path — bundle from dist/).
      if (pathname.startsWith('/_client/')) {
        const rel = decodeURIComponent(pathname.slice('/_client/'.length));
        if (rel.includes('..')) return new Response('Forbidden', { status: 403 });
        // Try dist/ first (built bundle + styles), fall back to client/ (raw source files).
        const distHit = join(DIST_DIR, rel);
        if (await Bun.file(distHit).exists()) return serveFile(distHit);
        const srcHit = join(CLIENT_DIR, rel);
        return serveFile(srcHit);
      }

      // React 19 runtime bundles for TSX canvases. The browser pulls these
      // through the importmap in _canvas-shell.html — each bundle is a single
      // package (react, react-dom/client, jsx-runtime, jsx-dev-runtime),
      // built once on first request, cached in-process for the session.
      if (pathname.startsWith('/_canvas-runtime/')) {
        const slugWithExt = decodeURIComponent(pathname.slice('/_canvas-runtime/'.length));
        const pkg = packageForSlug(slugWithExt);
        if (!pkg) return new Response('Not found', { status: 404 });
        try {
          const bundle = await getRuntimeBundle(pkg);
          const ifNoneMatch = req.headers.get('if-none-match');
          if (ifNoneMatch === bundle.etag) {
            return new Response(null, {
              status: 304,
              headers: { ETag: bundle.etag, 'Cache-Control': 'no-cache' },
            });
          }
          return new Response(bundle.js, {
            status: 200,
            headers: {
              'Content-Type': 'application/javascript; charset=utf-8',
              ETag: bundle.etag,
              'Cache-Control': 'no-cache',
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(`Runtime bundle error: ${msg}`, { status: 500 });
        }
      }

      // Canvas mount harness — served for iframes pointing at a .tsx canvas.
      // Static template ships under plugins/design/templates/_shell.html.
      // Query parameter ?canvas=<path-relative-to-designRoot> tells the shell
      // which canvas to import + mount. See plugins/design/templates/_shell.html.
      if (pathname === '/_canvas-shell.html' || pathname === '/_canvas-shell') {
        // The segregated canvas origin (server.ts) calls serveCanvasShell(true)
        // directly with CSP always on; on the legacy main origin the CSP stays
        // env-gated (MAUDE_CSP_POC) for the POC / backwards-compat.
        return serveCanvasShell(process.env.MAUDE_CSP_POC === '1');
      }

      // Fall-through: serve user repo files (designRoot + everything under repoRoot).
      const fp = safePathUnderRoot(req.url, ctx.paths.repoRoot);
      if (!fp) return new Response('Forbidden', { status: 403 });

      const file = Bun.file(fp);
      const exists = await file.exists();
      if (!exists) return new Response('Not found', { status: 404 });

      const e = ext(fp);
      const underDesignRoot = `${fp}/`.startsWith(`${ctx.paths.designRoot}/`);
      // .tsx under designRoot is a canvas — transpile + emit locator, return JS.
      if (e === '.tsx' && underDesignRoot) {
        return serveCanvasTsx(fp, req, ctx, join(ctx.paths.designRoot, '_locator.json'));
      }
      // Bun.file streams transparently for binary content.
      return new Response(file, {
        headers: {
          'Content-Type': MIME[e] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Server error: ${msg}`, { status: 500 });
    }
  }

  async function serveCanvasShell(applyCsp: boolean): Promise<Response> {
    const shellHtml = await Bun.file(join(TEMPLATES_DIR, '_shell.html')).text();
    // Inject inspector overlay — Cmd+Click selection + add-comment flow.
    const injected = inspect.injectInspector(shellHtml);
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    if (applyCsp) headers['Content-Security-Policy'] = cspForCanvasShell(injected, ctx.mainOrigin);
    return new Response(injected, { headers });
  }

  // Canvas assets the segregated origin may serve out of designRoot. Excludes
  // `.json` so no `*.meta.json` / `config.json` / `_comments/*.json` leaks via
  // the static lane (canvas-meta goes through the gated /_api route instead).
  const CANVAS_ASSET_EXTS = new Set([
    '.tsx',
    '.css',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
  ]);

  // Exact API paths the canvas iframe needs (collab + display data). See
  // isCanvasSafeRoute for the trust rationale. Mutations are limited to inert
  // collab data (annotations SVG, comment replies via the dynamic route).
  const CANVAS_SAFE_API = new Set([
    '/_api/git-user', // presence display name
    '/_api/canvas-meta', // layout/viewport sidecar (GET + PATCH)
    '/_api/annotations', // annotation SVG (GET + PUT) — drives the collab bridge
    '/_api/git-committers', // @mention autocomplete
    '/_api/ai', // AI-activity banner
    '/_comments', // per-file comment list (renders pins)
  ]);

  function isCanvasSafeRoute(pathname: string): boolean {
    // A1/A2 (DDR-060 F1 re-audit, phase-9.1-t2-f1-cross-origin-reaudit.md) —
    // DECODE + NORMALIZE before gating. `URL.pathname` preserves `%2f` (it does
    // NOT decode it to `/`), so a raw allowlist check on the encoded path is
    // fooled: `/.design/..%2fsite%2fx.css` reads as ONE opaque segment under the
    // designRoot with an asset ext (the `_`-segment + ext checks see no literal
    // slash to split on), yet `safePathUnderRoot` later DECODES the same `%2f`,
    // turns `..%2f` into a real `../`, and climbs out of the designRoot — re-
    // confined only to repoRoot. That decode mismatch let a hub-pushed canvas
    // read any repo `.tsx`/`.css`/`.svg`/font + `_history` snapshots. Decoding
    // here makes the gate agree with the resolver: `..%2f` → `../`, normalize
    // collapses it, and the path no longer matches designPrefix → 403. A
    // malformed escape (`%ZZ`) throws → reject. This gate runs ONLY on the
    // segregated canvas origin (server.ts), so the main origin is untouched.
    let safe: string;
    try {
      safe = posix.normalize(decodeURIComponent(pathname));
    } catch {
      return false;
    }
    if (safe === '/_canvas-shell.html' || safe === '/_canvas-shell') return true;
    if (safe === '/_health') return true;
    if (safe === '/_client/comment-mount.js') return true;
    // Canvas-chrome stylesheets (composer / thread / pin / cursor CSS). Inert
    // static assets from the dev-server distribution — no secrets, no code
    // exec, no repo content. Without this the cross-origin canvas 403s e.g.
    // `/_client/comments-overlay.css`, so the in-iframe comment composer renders
    // unstyled and, missing `position: fixed`, collapses to the top-left (0,0).
    // Allowed by pattern (not per-file) so future chrome CSS can't silently
    // regress the same way.
    if (safe.startsWith('/_client/') && ext(safe) === '.css') return true;
    if (safe.startsWith('/_canvas-runtime/')) return true;
    // Collab + display-data endpoints the canvas runtime legitimately calls from
    // inside the iframe. All are reads or inert collab writes (annotations SVG,
    // comment replies) — the "safe to sync" set per DDR-054. None expose code
    // execution, secrets, export, /_config, /_sync-status, or files outside
    // designRoot/annotations; the canvas origin's CSP `connect-src 'self'` still
    // confines the iframe so hub-pushed JSX can't reach IMDS/LAN/main-origin.
    if (CANVAS_SAFE_API.has(safe)) return true;
    // POST /_api/comments/<id>/reply — dynamic path (fetch-handled).
    if (/^\/_api\/comments\/[A-Za-z0-9_]+\/reply$/.test(safe)) return true;
    const designPrefix = `/${ctx.paths.designRel.replace(/^\/+|\/+$/g, '')}/`;
    if (safe.startsWith(designPrefix)) {
      const rest = safe.slice(designPrefix.length);
      // Reject runtime/state dirs+files (_comments, _sync.json, _history, …).
      if (rest.split('/').some((seg) => seg.startsWith('_'))) return false;
      return CANVAS_ASSET_EXTS.has(ext(safe));
    }
    return false;
  }

  return { routes, fetch, serveCanvasShell, isCanvasSafeRoute };
}
