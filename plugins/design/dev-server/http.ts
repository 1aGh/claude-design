// HTTP layer for Bun.serve.
//
// Designed for extension — Phase 3.6 adds /ui/:slug + /_bun_hmr by appending to
// the route table without rewriting this module. The `fetch` export is the
// top-level fall-through for paths Bun's `routes` field doesn't cover.

import { watch } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Api } from './api.ts';
import { buildCanvasModule } from './canvas-build.ts';
import { canvasLibPath } from './canvas-lib-resolver.ts';
import { TranspileError } from './canvas-pipeline.ts';
import type { Context } from './context.ts';
import type { Inspect } from './inspect.ts';
import { canvasSlug, writeLocator } from './locator.ts';
import { RUNTIME_PACKAGES, getRuntimeBundle, packageForSlug, slugFor } from './runtime-bundle.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

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
}

export function createHttp(ctx: Context, api: Api, inspect: Inspect): Http {
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

    '/_config': () => Response.json(ctx.cfg),

    '/_index-data': async () =>
      Response.json(await api.buildIndexData(), { headers: { 'Cache-Control': 'no-store' } }),

    '/_system-data': async () =>
      Response.json(await api.buildSystemData(), { headers: { 'Cache-Control': 'no-store' } }),

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
        const shellHtml = await Bun.file(join(TEMPLATES_DIR, '_shell.html')).text();
        // Inject inspector overlay — Cmd+Click selection + Shift/C+Click
        // add-comment flow. Without this, TSX canvases mount fine but lose
        // every interactive devtool.
        const injected = inspect.injectInspector(shellHtml);
        return new Response(injected, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
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

  return { routes, fetch };
}
