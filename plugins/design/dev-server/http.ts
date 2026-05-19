// HTTP layer for Bun.serve.
//
// Designed for extension — Phase 3.6 adds /ui/:slug + /_bun_hmr by appending to
// the route table without rewriting this module. The `fetch` export is the
// top-level fall-through for paths Bun's `routes` field doesn't cover.

import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Api } from './api.ts';
import { buildCanvasModule } from './canvas-build.ts';
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
const RUNTIME_DIR = join(HERE, 'runtime');
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

      if (pathname.startsWith('/_runtime/')) {
        const rel = decodeURIComponent(pathname.slice('/_runtime/'.length));
        if (rel.includes('..')) return new Response('Forbidden', { status: 403 });
        return serveFile(join(RUNTIME_DIR, rel));
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
        // Inject inspector overlay — same Cmd+Click selection + Shift/C+Click
        // add-comment flow the legacy .html canvases got. Without this, TSX
        // canvases mount fine but lose every interactive devtool.
        const injected = inspect.injectInspectorOnly(shellHtml);
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
      // .html under designRoot gets inspector + runtime injection.
      if (e === '.html' && underDesignRoot) {
        const html = await file.text();
        const injected = inspect.injectInto(html);
        return new Response(injected, {
          headers: { 'Content-Type': MIME['.html'] ?? 'text/html', 'Cache-Control': 'no-store' },
        });
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
