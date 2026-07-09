// HTTP layer for Bun.serve.
//
// Designed for extension — Phase 3.6 adds /ui/:slug + /_bun_hmr by appending to
// the route table without rewriting this module. The `fetch` export is the
// top-level fall-through for paths Bun's `routes` field doesn't cover.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, watch } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';

import { probeAcpAvailability } from './acp/probe.ts';
import { deleteChat, listChats, readChatMessages } from './acp/transcript.ts';
import { type Api, ASSET_MAX_BYTES, ASSET_MAX_VIDEO_BYTES } from './api.ts';
import { buildCanvasModule } from './canvas-build.ts';
import { canvasLibPath } from './canvas-lib-resolver.ts';
import { TranspileError } from './canvas-pipeline.ts';
import type { AiActivity } from './collab/ai-activity.ts';
import type { Context } from './context.ts';
import { type Format, isFormat, isScope, type Scope } from './exporters/index.ts';
import { type ExportJobQueue, ExportQueueFullError } from './exporters/jobs.ts';
import type { ActiveJsonShape } from './exporters/scope.ts';
import { createGitEndpoints } from './git/endpoints.ts';
import { gitShowFile } from './git/service.ts';
import { createGitHubEndpoints } from './github/endpoints.ts';
import type { Inspect } from './inspect.ts';
import { canvasSlug, writeLocator } from './locator.ts';
import { DEV_SERVER_ROOT, STICKERS_DIR } from './paths.ts';
import { probeReadiness } from './readiness.ts';
import { getRuntimeBundle, packageForSlug } from './runtime-bundle.ts';
import { linkHub } from './sync/hub-link.ts';
import { loadWhatsNew } from './whats-new.ts';
import { isLoopbackHost } from './ws.ts';

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
  // DDR-148 — video/audio media referenced by a video-comp `<Video>`/`<Audio>`.
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
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
 * ICE DNS/STUN even under `connect-src 'self'`. ⚠️ This directive is specified
 * (CSP3) but UNIMPLEMENTED in shipping Chrome/Firefox as of 2026 (Chromium
 * #40188662, Firefox bug 1783489) — currently a NO-OP. The enforceable control
 * today is the RTC-constructor lockout in `templates/_shell.html`; this directive
 * is kept for when browsers honor it. WebRTC + self-navigation exfil remain
 * DOCUMENTED residuals of opt-in linked mode (the reachable data is collab
 * metadata, not repo files — traversal is closed). Do NOT treat this as a closed
 * exfil lane. The canvas runtime itself uses zero WebRTC.
 *
 * `frame-ancestors` (A6) — restricts who may embed the canvas document. The
 * legit embedder is the main dev-server origin, so we allowlist exactly that
 * (`mainOrigin` — a space-separated source list; server.ts advertises both
 * loopback spellings, `localhost` + `127.0.0.1`) plus `'self'`; an arbitrary
 * external page can no longer reframe the canvas. When `mainOrigin` is unknown
 * (tests / pre-boot) the directive is OMITTED rather than set to `'self'` —
 * `'self'` alone would forbid the legit cross-origin embed and blank the canvas.
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
    // DDR-148 — a video-comp's <Video>/<Audio> loads media from the canvas
    // origin's own designRoot (assets/). Same inert-bytes trust as img-src
    // 'self'; without it default-src 'none' blocks all media (black video, no
    // sound). `blob:` covers Remotion's processed-media URLs.
    "media-src 'self' blob:",
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

/**
 * CSP for the EXPORT/CAPTURE render (DDR-148 security, attacker F1). The export
 * renders the (untrusted, DDR-054) canvas on the MAIN origin — where the normal
 * shell CSP is env-gated off — and the capture shim ACTIVELY primes+seeks every
 * `<video>`, so a canvas with `<Video src="http://169.254.169.254/…">` or comp
 * JS doing `fetch(internal)` would turn ⌘E into read-SSRF + exfil-via-artifact.
 *
 * The comp is arbitrary JS by design and the in-page encoder is injected via
 * `addScriptTag`, so restricting SCRIPT execution is neither possible nor the
 * threat — the threat is NETWORK EGRESS. This CSP therefore locks every network
 * sink to `'self'` (media/img/connect/font, no frames/objects/form posts) while
 * leaving script permissive. Legit designRoot media is same-origin → still
 * loads; every off-origin fetch/media/beacon is refused.
 */
export function cspForCapture(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "webrtc 'block'",
  ].join('; ');
}

/**
 * CSRF guard for the main-origin source-write routes (edit-css / edit-text /
 * edit-attr / reorder). Those routes are reachable only from the shell, which is
 * same-origin — but `readJson` enforces no `Content-Type`, so a cross-site page
 * could otherwise forge a `text/plain` CORS *simple-request* POST to
 * `http://localhost:<port>/_api/edit-*` (no preflight) and drive a write into
 * the user's source `.tsx`. The browser stamps every cross-origin POST with an
 * unspoofable `Origin` header, so we reject any request whose Origin is PRESENT
 * and ≠ the server's own origin. A request with NO Origin (bun:test, curl,
 * non-browser programmatic clients — none of which are the CSRF threat, which
 * requires a browser executing attacker markup that always sends Origin on a
 * cross-origin POST) is allowed through. This is layered on top of the DDR-054
 * origin-split (which blocks the untrusted canvas *iframe*); it closes the
 * *other* untrusted origin — a malicious top-level page in another tab.
 * Deliberately NOT applied to `/_api/asset` (that route is canvas-origin
 * reachable by design — drag-drop/paste upload runs inside the iframe). See
 * DDR-105. Exported for unit testing (the decision is a pure function of `req`).
 */
export function sameOriginWrite(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser / same-origin omitting Origin → allow
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
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
// Templates stayed under the design *plugin* (plugins/design/templates) when the
// dev-server moved to apps/studio (DDR-095) — both ship in the npm tarball, so
// from DEV_SERVER_ROOT (apps/studio) reach across with ../../plugins/design.
const TEMPLATES_DIR = join(HERE, '..', '..', 'plugins', 'design', 'templates');

// In-memory transpile cache. Key = absolute canvas path. Repeat GETs against an
// unchanged source skip the parse + ID-injection + Bun.Transpiler + Bun.build
// entirely.
interface CanvasCacheEntry {
  /** Freshness signature over the .tsx AND every directly-imported sibling/
   *  relative `.css` it inlines (Bun.build extracts `import "./x.css"` into a
   *  `<style>` tag — there is no `<link>`). Rebuild when ANY of them changes.
   *  A prior version keyed only on the .tsx mtime, so editing a sibling
   *  `<canvas>.css` was a cache HIT: the HMR reload (mode:'module') re-served the
   *  stale inlined CSS and the edit only showed once the .tsx itself changed.
   *  (DDR-064 collab dogfooding finding, 2026-05-29.) */
  sig: string;
  etag: string;
  js: string;
  /** Absolute paths of the relative imports inlined into this build (`.css` +
   *  local `.tsx/.ts` modules, incl. unresolved extensionless candidates) —
   *  re-statted each request to recompute `sig` without re-reading the source. */
  deps: string[];
}
const canvasCache = new Map<string, CanvasCacheEntry>();

// Per-process boot id, folded into every canvas ETag. The canvas transpile
// BUNDLES the shared chrome (canvas-lib → tool-palette / annotations-layer /
// use-tool-mode / canvas-cursors / …), but the freshness sig + base etag only
// track the canvas file + its inlined CSS — NOT those chrome sources. So a
// chrome edit left the etag unchanged → the browser's `If-None-Match` matched →
// 304 → the user kept getting the STALE transpile even after a server restart
// (the recurring "my cursor / chrome change didn't show up" bug). Folding the
// boot id in means a restart — the expected workflow after a dev-server source
// edit (see CLAUDE.md) — changes every canvas etag, so a normal reload re-fetches
// fresh chrome. (DDR-067.)
const RUNTIME_BOOT_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Bumped by the chrome source watchers (below) on every canvas-lib / dev-server
// `.tsx`/`.ts` edit. Folded into the canvas ETag so a LIVE chrome edit (no
// restart) also changes the etag — otherwise clearing `canvasCache` re-transpiles
// fresh on the server, but the unchanged canvas SOURCE yields the same
// `result.etag`, the browser's `If-None-Match` matches → 304 → the user still
// gets the stale bundle even after the HMR hard-reload. (DDR-067.)
let CHROME_EPOCH = 0;

/** Relative import specifiers in a canvas source → absolute paths (the files
 *  Bun.build inlines): sibling `.css`, and — RC6 of
 *  rca/issue-canvas-hmr-optimistic-update-consistency — imported local
 *  `.tsx/.ts/.jsx/.js` modules, which are inlined exactly like CSS (only
 *  RUNTIME_PACKAGES stay external, canvas-build.ts), so an edit to an imported
 *  sibling must bust the mtime-keyed cache the same way. Extensionless
 *  specifiers contribute EVERY resolution candidate (`.tsx`, `.ts`, …,
 *  `index.tsx`); missing candidates stat as 0, so a dep file APPEARING later
 *  also changes the signature. One level only — no transitive graph (the
 *  import-graph HMR re-emit is a tracked follow-up). Bare / virtual specifiers
 *  (`@maude/…`, npm) are skipped. Resolved paths are clamped to `designRoot`:
 *  a canvas source is attacker-influenced under linked mode (DDR-054), and
 *  these paths are `stat`-ed for mtime, so a `../../../etc/…` specifier must
 *  not let the freshness probe reach outside the design tree. Legit DS imports
 *  (`../../system/<ds>/…`) stay inside designRoot. */
export function localDepsFromSource(
  source: string,
  canvasAbsPath: string,
  designRoot: string
): string[] {
  const dir = dirname(canvasAbsPath);
  const root = resolve(designRoot);
  const deps: string[] = [];
  const seen = new Set<string>();
  const push = (abs: string) => {
    if (abs !== root && !abs.startsWith(root + sep)) return; // clamp (DDR-054)
    if (seen.has(abs)) return;
    seen.add(abs);
    deps.push(abs);
  };
  const specRes = [
    /\bimport\s+["']([^"']+)["']/g, // side-effect: import './x.css'
    /\bfrom\s+["']([^"']+)["']/g, // import … from / export … from
    /\bimport\(\s*["']([^"']+)["']\s*\)/g, // dynamic import('./x')
  ];
  for (const re of specRes) {
    for (let m = re.exec(source); m !== null; m = re.exec(source)) {
      const spec = m[1];
      if (!spec?.startsWith('.')) continue;
      const base = resolve(dir, spec);
      if (/\.(css|tsx|ts|jsx|js)$/i.test(spec)) {
        push(base);
      } else {
        for (const cand of [
          `${base}.tsx`,
          `${base}.ts`,
          `${base}.jsx`,
          `${base}.js`,
          resolve(base, 'index.tsx'),
          resolve(base, 'index.ts'),
        ])
          push(cand);
      }
    }
  }
  return deps;
}

/** mtime signature over the .tsx + every inlined relative dep (`.css` + local
 *  modules). A missing/unreadable file contributes 0 — a delete is itself a
 *  change (and a later create too), so the signature differs. */
function canvasFreshnessSig(tsxAbsPath: string, deps: string[]): string {
  const parts: string[] = [];
  for (const p of [tsxAbsPath, ...deps]) {
    const mt = Bun.file(p).lastModified;
    parts.push(`${p}@${Number.isFinite(mt) ? mt : 0}`);
  }
  return parts.join('|');
}

async function serveCanvasTsx(
  absPath: string,
  req: Request,
  ctx: Context,
  locatorAbsPath: string
): Promise<Response> {
  // Phase 27 (E2) — DiffView "before" pane. `?sha=<ref>` builds the canvas from
  // its source AT a past version (git show) instead of the working-tree file, so
  // the rendered before/after is real. Isolated additive branch — the normal
  // (no-sha) serve below is byte-identical to before. The historical build still
  // resolves sibling imports against the CURRENT on-disk files (an accepted
  // approximation: the canvas code at the sha, with today's DS/lib).
  const shaParam = new URL(req.url).searchParams.get('sha');
  if (shaParam) return serveHistoricalCanvas(absPath, shaParam, req, ctx);

  const file = Bun.file(absPath);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });

  // Freshness = the .tsx mtime AND every inlined sibling `.css` mtime. Keying on
  // the .tsx alone meant a direct edit to `<canvas>.css` was a cache HIT, so the
  // HMR reload (mode:'module') re-served the stale inlined CSS — the edit only
  // surfaced once the .tsx itself changed (DDR-064 dogfooding finding).
  let cached = canvasCache.get(absPath);
  const sig = canvasFreshnessSig(absPath, cached?.deps ?? []);

  if (!cached || cached.sig !== sig) {
    const source = await file.text();
    const deps = localDepsFromSource(source, absPath, ctx.paths.designRoot);
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
    // Recompute the signature against the freshly-parsed deps — this very edit
    // may have added or removed a `.css` import.
    cached = {
      sig: canvasFreshnessSig(absPath, deps),
      // Fold in the boot id (restart) + chrome epoch (live edit) so a chrome
      // change busts the browser's cached transpile even when the canvas source
      // (hence result.etag) is unchanged. See RUNTIME_BOOT_ID / CHROME_EPOCH.
      etag: `${result.etag}-${RUNTIME_BOOT_ID}-${CHROME_EPOCH}`,
      js: result.js,
      deps,
    };
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

// Phase 27 (E2) — build + serve a canvas at a past git ref. Immutable per
// (path, sha) — historical content never changes, so the cache lives for the
// process (folding the boot id + chrome epoch into the etag so a chrome change
// still busts the browser copy, since the build inlines today's chrome).
// LRU-capped so a flood of distinct ?sha values (each minting a permanent entry)
// can't grow the heap unbounded — the route is reachable from the UNTRUSTED
// canvas origin (it's on the canvas-serve path), so a hub-pushed canvas could
// otherwise OOM the sidecar (security review — ethical-hacker, Finding 1).
const historicalCanvasCache = new Map<string, { js: string; etag: string }>();
const HIST_MAX_CACHE = 96;
// Rate-limit the EXPENSIVE miss path (git show + Bun.build, or a non-resolving
// git lookup) so a distinct-sha spray from the canvas origin can't starve the
// event loop. Cache HITS are free; only a NEW (path,sha) build consumes budget.
// Legit use (DiffView opens ~1–2 historical iframes per compare) is far under.
//
// TWO LOAD-BEARING INVARIANTS (security re-review — do not "optimize" away):
//   1. The limiter is DELIBERATELY GLOBAL, not per-origin/per-key — the attacker
//      controls the canvas (hence any origin/key), so a keyed limiter is
//      trivially defeated. The cost (a legit user 429s during an active flood) is
//      accepted; it only bites under attack.
//   2. `historicalBuildAllowed()` MUST stay ABOVE `gitShowFile` so the
//      non-resolving-sha spray (cheap git lookup, no build) is capped too —
//      moving it below would re-open the CPU vector. Guarded by the
//      "rate-limited — DoS guard" test in test/git-api.test.ts.
const HIST_WINDOW_MS = 10_000;
const HIST_MAX_BUILDS = 24;
let histWindowStart = Date.now();
let histBuilds = 0;
function historicalBuildAllowed(): boolean {
  const now = Date.now();
  if (now - histWindowStart >= HIST_WINDOW_MS) {
    histWindowStart = now;
    histBuilds = 0;
  }
  if (histBuilds >= HIST_MAX_BUILDS) return false;
  histBuilds++;
  return true;
}
async function serveHistoricalCanvas(
  absPath: string,
  sha: string,
  req: Request,
  ctx: Context
): Promise<Response> {
  const repoRel = relative(ctx.paths.repoRoot, absPath).replace(/\\/g, '/');
  const key = `${absPath}\0${sha}\0${RUNTIME_BOOT_ID}\0${CHROME_EPOCH}`;
  let cached = historicalCanvasCache.get(key);
  if (cached) {
    // LRU touch — re-insert so the hot entry isn't the next eviction victim.
    historicalCanvasCache.delete(key);
    historicalCanvasCache.set(key, cached);
  } else {
    if (!historicalBuildAllowed()) {
      return new Response('Too many version previews — try again in a moment.', {
        status: 429,
        headers: { 'Retry-After': '10', 'Cache-Control': 'no-store' },
      });
    }
    const source = await gitShowFile(ctx.paths.repoRoot, sha, repoRel);
    if (source == null) return new Response('No saved version of this canvas', { status: 404 });
    try {
      const result = await buildCanvasModule(absPath, source, { designRoot: ctx.paths.designRoot });
      cached = {
        js: result.js,
        etag: `${result.etag}-${sha}-${RUNTIME_BOOT_ID}-${CHROME_EPOCH}`,
      };
      historicalCanvasCache.set(key, cached);
      if (historicalCanvasCache.size > HIST_MAX_CACHE) {
        const oldest = historicalCanvasCache.keys().next().value;
        if (oldest !== undefined) historicalCanvasCache.delete(oldest);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Canvas build error: ${msg}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
  if (req.headers.get('if-none-match') === cached.etag) {
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

/** Media (video/audio) extensions that get HTTP Range support when served. */
const RANGE_MEDIA_EXTS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mp3', '.wav', '.m4a', '.ogg']);

/**
 * DDR-150 dogfood (team finding) — serve a media file with HTTP Range support.
 * The plain `new Response(Bun.file(..))` lane answered `Range:` requests with a
 * 200 + full body: Chrome copes for small clips (buffers everything) but large
 * MP4s scrub terribly, and WKWebView (the native desktop app) can refuse to
 * play media from servers without Range support at all. Single-range only
 * (`bytes=a-b`, suffix `bytes=-n`, open `bytes=a-`); malformed ranges fall back
 * to a full 200; an unsatisfiable one gets an honest 416.
 */
async function serveMediaFile(
  absPath: string,
  req: Request,
  headers: Record<string, string> = {}
): Promise<Response> {
  const file = Bun.file(absPath);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });
  const size = file.size;
  const base = {
    'Content-Type': MIME[ext(absPath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    ...headers,
  };
  const range = req.headers.get('range');
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2]) && size > 0) {
    const start = m[1]
      ? Number.parseInt(m[1], 10)
      : Math.max(0, size - Number.parseInt(m[2] as string, 10));
    const end = m[1] && m[2] ? Math.min(Number.parseInt(m[2], 10), size - 1) : size - 1;
    if (Number.isFinite(start) && start >= 0 && start <= end && start < size) {
      return new Response(file.slice(start, end + 1), {
        status: 206,
        headers: {
          ...base,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': String(end - start + 1),
        },
      });
    }
    return new Response(null, {
      status: 416,
      headers: { ...base, 'Content-Range': `bytes */${size}` },
    });
  }
  return new Response(file, { headers: base });
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
  serveCanvasShell(applyCsp: boolean, capture?: boolean): Promise<Response>;
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

export function createHttp(
  ctx: Context,
  api: Api,
  inspect: Inspect,
  ai: AiActivity,
  exportJobs: ExportJobQueue
): Http {
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
      CHROME_EPOCH++;
    }
  });

  let libWatcher: ReturnType<typeof watch> | null = null;
  try {
    libWatcher = watch(canvasLibPath(), () => {
      canvasCache.clear();
      CHROME_EPOCH++;
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
  // (canvas-shell, contextual-toolbar, equal-spacing-handles, tool-palette,
  // use-tool-mode, ...). Editing any of them invalidates the bundled canvas
  // output. Without watching them the mtime-keyed `canvasCache` keeps serving
  // the stale bundle and the user sees pre-edit behaviour even after a hard
  // iframe reload.
  //
  // Recursive watch over DEV_SERVER_ROOT, filtered to .tsx AND .ts: the chrome
  // graph includes plain `.ts` modules that DO reach the canvas
  // (`canvas-cursors.ts`, `canvas-arrowheads.ts`) — the prior `.tsx`-only filter
  // skipped them, so cursor edits never busted the cache (the recurring stale-
  // cursor bug, DDR-067). Server-only `.ts` (api / http / context) also clears
  // here, which is harmless (a needless rebuild, not a stale serve). Test files
  // (`test/`), built output (`dist/`, `client/`), and node_modules are skipped.
  let devSrcWatcher: ReturnType<typeof watch> | null = null;
  try {
    devSrcWatcher = watch(DEV_SERVER_ROOT, { recursive: true }, (_evt, filename) => {
      if (!filename) return;
      if (!filename.endsWith('.tsx') && !filename.endsWith('.ts')) return;
      if (filename.startsWith('test/') || filename.startsWith('test\\')) return;
      if (filename.startsWith('dist/') || filename.startsWith('client/')) return;
      if (filename.includes('node_modules')) return;
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
      // DDR-148 security (attacker F2): the global maxRequestBodySize is raised
      // to ~108 MB so the STREAMING /_api/asset route can accept large videos —
      // but a JSON route must never buffer that. `req.text()` would materialize
      // the whole body BEFORE the length check (a 107 MB body from the untrusted
      // canvas origin = memory-amplification DoS, reverting DDR-088). So: honest
      // content-length fast-reject, then read the stream and ABORT past `max`,
      // buffering at most ~max + one chunk.
      const cl = Number(req.headers.get('content-length'));
      if (Number.isFinite(cl) && cl > max) return null;
      const body = req.body;
      if (!body) return null;
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        size += value.byteLength;
        if (size > max) {
          try {
            await reader.cancel();
          } catch {
            /* stream already closing */
          }
          return null;
        }
        chunks.push(value);
      }
      if (size === 0) return null;
      const buf = new Uint8Array(size);
      let off = 0;
      for (const c of chunks) {
        buf.set(c, off);
        off += c.byteLength;
      }
      const text = new TextDecoder().decode(buf);
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  // Phase 27 (E2) — `/_api/git/*` orchestration. MAIN-ORIGIN ONLY: every git
  // route is intentionally absent from CANVAS_SAFE_API + startCanvasServer's
  // `routes` map (the dual-allowlist rule), so the untrusted canvas iframe origin
  // can never reach status/commit/publish/get-latest. http.ts owns the gating;
  // git/endpoints.ts owns the orchestration.
  const gitApi = createGitEndpoints(ctx);
  // Phase 28 (E3) — `/_api/github/*`. Same dual-allowlist rule: main-origin only,
  // and every route is token-bearing (server-held keychain token via the loopback
  // bridge), so all four also carry a loopback-Host check.
  const githubApi = createGitHubEndpoints(ctx);
  const gitJson = (r: { status: number; json: unknown }) =>
    Response.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } });

  // Shared by /_api/export and /_api/export-jobs — build the exportJobs.enqueue()
  // args from a validated request body. `inspect.state` is the live `_active.json`;
  // readers narrow to the resolver's subset locally so the export pipeline doesn't
  // pin the wider ActiveState interface.
  function buildExportArgs(
    req: Request,
    body: { format: Format; scope: Scope; options?: Record<string, unknown> }
  ) {
    const activeJson = inspect.state as unknown as ActiveJsonShape;
    return {
      format: body.format,
      scope: body.scope,
      options: body.options ?? {},
      resolve: { activeJson, designRoot: ctx.paths.designRoot, repoRoot: ctx.paths.repoRoot },
      ctx: {
        designRoot: ctx.paths.designRoot,
        repoRoot: ctx.paths.repoRoot,
        // Adapters reach back into the server via this origin only when they
        // need Playwright rendering (PNG / PDF / SVG / HTML). The host that
        // received this request is, by definition, the one serving the canvas.
        serverOrigin: new URL(req.url).origin,
        // Mirror `client/app.jsx:85` — the per-DS tokensCssRel wins over the
        // legacy top-level default (which still points at the pre-multi-DS
        // layout `system/colors_and_type.css`). Without the per-DS path, the
        // standalone `_canvas-shell.html` 404s on the tokens link and the
        // rendered DOM uses `var(--bg-0)` unresolved → screenshots come out
        // blank. See canvasShellUrl().
        tokensCssRel: ctx.cfg.designSystems?.[0]?.tokensCssRel ?? ctx.cfg.tokensCssRel,
      },
    };
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

    // Phase 31 (DDR-123) — ACP chat readiness. Cheap, side-effect-free probe
    // (is the adapter present + is `claude` on PATH); no subprocess spawned.
    // MAIN-ORIGIN ONLY — absent from CANVAS_SAFE_API + startCanvasServer routes,
    // so the untrusted canvas iframe is 403'd. The native shell reads this to
    // decide between the enabled panel and the not-connected explainer.
    '/_api/acp/status': () =>
      Response.json(probeAcpAvailability(), { headers: { 'Cache-Control': 'no-store' } }),

    // DDR-128 — first-open AI-editing readiness. Read-only probe of the AI-editing
    // dependency chain (claude CLI · maude CLI · maude marketplace + plugins in the
    // paired Claude Code · optional agent-browser) with per-item remediation; it
    // installs/mutates nothing. MAIN-ORIGIN ONLY — absent from CANVAS_SAFE_API +
    // startCanvasServer routes, so the untrusted canvas iframe is 403'd. The probe
    // can shell out (login-shell fallback), so a cross-origin Origin-reject also
    // fronts it — a drive-by page can't fire the loopback endpoint to spawn-storm
    // the dev-server (DDR-128 hardening). The onboarding readiness card + the
    // ChatPanel not-connected explainer + the Help-menu modal read this.
    '/_api/preflight': async (req: Request) => {
      if (!sameOriginWrite(req)) return new Response('cross-origin rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      return Response.json(await probeReadiness(), { headers: { 'Cache-Control': 'no-store' } });
    },

    // Phase 31 (DDR-123) — `/design:chat` focus hook. `maude design chat-open`
    // POSTs here; we emit a bus event the shell turns into "open the Assistant
    // panel" (app.jsx, native-only). MAIN-ORIGIN ONLY (off the canvas allowlist).
    '/_api/acp/focus': (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      // CSRF parity with the other POST routes — the loopback `maude design
      // chat-open` driver omits Origin (allowed); a browser drive-by can't forge it.
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      ctx.bus.emit('acp-focus', {});
      return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    },

    // Phase 31 — repo-level chat list + history (for the chat switcher +
    // hydration). MAIN-ORIGIN ONLY. Read-only; ids are sanitized before disk.
    '/_api/acp/chats': () =>
      Response.json(listChats(ctx.paths.designRoot), {
        headers: { 'Cache-Control': 'no-store' },
      }),
    '/_api/acp/chat': (req: Request) => {
      const id = (new URL(req.url).searchParams.get('id') ?? '')
        .replace(/[^a-z0-9_-]/gi, '')
        .slice(0, 64);
      if (req.method === 'DELETE') {
        const removed = id ? deleteChat(ctx.paths.designRoot, id) : false;
        return Response.json({ ok: removed }, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (!id) return Response.json([], { headers: { 'Cache-Control': 'no-store' } });
      return Response.json(readChatMessages(ctx.paths.designRoot, id), {
        headers: { 'Cache-Control': 'no-store' },
      });
    },

    // Phase 31 follow-up — persist an image pasted straight into the ACP composer
    // (a clipboard screenshot has no path), returning an absolute path the chip
    // expands to so Claude can Read it. MAIN-ORIGIN ONLY: sameOriginWrite CSRF gate
    // on POST + deliberately absent from CANVAS_SAFE_API + startCanvasServer routes,
    // so the untrusted canvas iframe is 403'd. The disk caps live in
    // api.saveChatAttachment (magic-byte sniff / ASSET_MAX_BYTES / content-
    // addressed name / session write budget).
    //
    // GET ?name=<sha8>.<ext> serves the pasted image back to the chat feed
    // (thumbnail + lightbox). The name is regex-allowlisted in
    // api.resolveChatAttachment — content-addressed, never a caller path, so
    // traversal-proof by construction; content-addressed ⇒ immutable cache. No
    // CSRF gate on GET (sameOriginWrite is the POST/CSRF boundary) — the
    // main-origin posture above is what keeps the canvas origin out.
    '/_api/acp/attachment': async (req: Request) => {
      if (req.method === 'GET') {
        const name = new URL(req.url).searchParams.get('name');
        const abs = await api.resolveChatAttachment(name);
        if (!abs) return new Response('Not found', { status: 404 });
        return serveFile(abs, {
          'Cache-Control': 'public, max-age=31536000, immutable',
          // Uploaded bytes on the privileged main origin — never let the browser
          // MIME-sniff a polyglot into a richer type (mirrors the DDR-088 static
          // lane; the sniff/allowlist on write is the primary gate).
          'X-Content-Type-Options': 'nosniff',
        });
      }
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const declared = Number(req.headers.get('content-length') || '0');
      if (Number.isFinite(declared) && declared > ASSET_MAX_BYTES) {
        return Response.json(
          {
            ok: false,
            error: `attachment exceeds the ${Math.round(ASSET_MAX_BYTES / (1024 * 1024))} MB cap`,
          },
          { status: 413, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await req.arrayBuffer());
      } catch {
        return new Response('could not read request body', { status: 400 });
      }
      const result = await api.saveChatAttachment(bytes);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status ?? 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { path: result.path },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    },

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

    // What's New feed (DDR-A) — read-only product-update list surfaced in the
    // Maude UI chrome. Main-origin only by omission from the canvas-origin
    // allowlist below (the untrusted canvas iframe never needs it).
    '/_api/whats-new': () =>
      Response.json(loadWhatsNew(), { headers: { 'Cache-Control': 'no-store' } }),

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

    '/_api/canvas-source': async (req: Request) => {
      // DDR-148 — read-only raw .tsx source for the Timeline panel's sequence/
      // keyframe parser. GET ?file=<canvas rel or slug> → { source }.
      // MAIN-ORIGIN ONLY: intentionally absent from CANVAS_SAFE_API +
      // startCanvasServer's routes (dual-allowlist, DDR-054) — the untrusted
      // canvas iframe must never read arbitrary project source. Containment via
      // api.loadCanvasSource → resolveCanvasAbs (stays under designRoot).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // DNS-rebinding guard — a GET read of project source is CORS-readable once
      // a rebound page shares this origin; the dev-server always binds 127.0.0.1,
      // so a real browser (Host: localhost:<port>) passes and only a rebound
      // foreign hostname 403s. (No sameOriginWrite here — GET.)
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const file = new URL(req.url).searchParams.get('file');
      const r = await api.loadCanvasSource(file);
      if (!r.ok) {
        return Response.json(
          { ok: false, error: r.error },
          { status: r.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, source: r.source },
        { headers: { 'Cache-Control': 'no-store' } }
      );
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
      // CSRF guard: phase-30 bridges ai-activity onto room awareness, which
      // crosses the hub — a forged cross-origin POST would inject a fake
      // "<x> is editing <file>" presence to every connected peer. The loopback
      // slash-command driver omits Origin (→ allowed); a browser drive-by can't.
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
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
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
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
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
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

    '/_api/canvas': async (req: Request) => {
      // Phase 22 — create + soft-delete a canvas from the browser file tree.
      // POST   body { name, kind?: "brief-board", group? } → 201 { file, rel, slug }
      // DELETE ?file=<rel>                                 → 200 { rel, slug, trashed[] }
      // MAIN ORIGIN ONLY: this route is intentionally absent from
      // startCanvasServer's allowlist (DDR-054) — the untrusted canvas iframe
      // origin must never reach a file-write/-delete endpoint. Validation lives in
      // api.createCanvas / api.deleteCanvas (containment + group allowlist).
      // DDR-150 P4 Task 12 — this route creates/deletes source `.tsx` (the
      // video-comp assemble writes real comp source), so it's CSRF-gated like the
      // other source-write routes: a cross-origin top-level page is rejected (the
      // DDR-054 split only blocks the canvas iframe). No-Origin (curl/tests) + the
      // same-origin shell pass. Closes a pre-existing gap on create/delete.
      if (req.method === 'DELETE' || req.method === 'POST') {
        if (!sameOriginWrite(req))
          return new Response('cross-origin write rejected', { status: 403 });
        if (!isLoopbackHost(req.headers.get('host')))
          return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      }
      if (req.method === 'DELETE') {
        const file = new URL(req.url).searchParams.get('file');
        const result = await api.deleteCanvas({ file });
        if (!result.ok) {
          return Response.json(
            { ok: false, error: result.error },
            { status: result.status, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        return Response.json(
          {
            ok: true,
            rel: result.rel,
            slug: result.slug,
            trashed: result.trashed,
            trashDir: result.trashDir,
          },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const body = await readJson<{
        name?: unknown;
        kind?: unknown;
        group?: unknown;
        clips?: unknown;
        fps?: unknown;
        width?: unknown;
        height?: unknown;
      }>(
        req,
        // DDR-150 P4 Task 12 — a video-comp assemble carries a clips[] array;
        // widen the read cap accordingly (still bounded well under abuse).
        64 * 1024
      );
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.createCanvas(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, file: result.file, rel: result.rel, slug: result.slug },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    // ── Phase 27 (E2) — in-UI git layer. Save version / Publish / Get latest /
    // History / visual diff. All MAIN-ORIGIN ONLY (see gitApi comment above).
    // POST routes add the sameOriginWrite CSRF guard (cross-site forged POST);
    // the token-bearing publish/get-latest routes add a loopback Host check so a
    // request carrying a GitHub token can only originate on this machine.
    '/_api/git/status': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // Local status only — fast, no network, no credentials. The remote
      // ahead/behind probe (the "Get latest" nudge) needs a token, which a GET
      // query string must NOT carry (it leaks via logs / Referer / history —
      // security review A3). That probe lands in phase-28 over the server-held
      // keychain token (server-side, never client-supplied), not here.
      const checkRemote = new URL(req.url).searchParams.get('remote') === '1';
      return gitJson(await gitApi.status({ checkRemote }));
    },

    '/_api/git/log': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // Optional `?path=` scopes History to one canvas (phase-27.1). MAIN-ORIGIN
      // ONLY (this route is absent from CANVAS_SAFE_API) — the path is
      // containment-validated in the endpoint before it reaches git.
      const u = new URL(req.url).searchParams;
      return gitJson(await gitApi.log(u.get('limit'), u.get('path')));
    },

    '/_api/git/diff': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      return gitJson(await gitApi.diff(new URL(req.url).searchParams.get('sha')));
    },

    // ── Phase 29 (E4) — drafts (branches). MAIN-ORIGIN ONLY (absent from
    // CANVAS_SAFE_API + startCanvasServer routes); branch + checkout are POST/CSRF-
    // gated source mutations. Switching a draft moves HEAD, which the git-lifecycle
    // watcher turns into a Yjs flush + reload (DDR-051) — no logic duplicated here.
    '/_api/git/branches': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      return gitJson(await gitApi.branches());
    },

    '/_api/git/branch': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.createBranch(body));
    },

    '/_api/git/checkout': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.checkout(body));
    },

    // "Add this draft to the Shared version" — merges + PUBLISHES, so it is token-
    // bearing: same main-origin + loopback gate as /_api/git/push.
    '/_api/git/fold': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('adding a draft requires a local request', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.fold(body));
    },

    // "Refresh drafts" — token-bearing fetch (all remote heads) so a teammate's
    // new draft surfaces. Same main-origin + loopback gate as /_api/git/pull.
    '/_api/git/fetch': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('refresh requires a local request', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.fetchRemote(body));
    },

    '/_api/git/commit': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<unknown>(req, 256 * 1024);
      return gitJson(await gitApi.commit(body));
    },

    '/_api/git/discard': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<unknown>(req, 256 * 1024);
      return gitJson(await gitApi.discard(body));
    },

    '/_api/git/push': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      // Token-bearing: refuse anything not from a loopback Host (the server binds
      // 127.0.0.1, so this is belt-and-suspenders against a forwarded/rebound Host).
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('publish requires a local request', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.push(body));
    },

    '/_api/git/pull': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('get latest requires a local request', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.pull(body));
    },

    // Finish a Get-latest merge that hit a conflict (DiffView "Keep mine/theirs/
    // both"). Token-bearing (server-held; resolve completes the two-parent merge
    // commit) → same main-origin + loopback gate as pull. MAIN-ORIGIN ONLY:
    // absent from CANVAS_SAFE_API + startCanvasServer routes (dual-allowlist).
    '/_api/git/resolve': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('resolve requires a local request', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await gitApi.resolve(body));
    },

    // ── Phase 28 (E3) — GitHub identity & remote. Sign-in/out + keychain live in
    // the Tauri shell (oauth.rs/keychain.rs commands); these endpoints use the
    // server-held token (loopback bridge → token.ts) for the REST calls. MAIN-ORIGIN
    // ONLY (absent from CANVAS_SAFE_API + startCanvasServer) and loopback-Host gated
    // since every one is token-bearing. (Sign-out is the `github_sign_out` Tauri
    // command — the dev-server can't touch the OS keychain — so there is no
    // DELETE /_api/github/identity here; see DDR-114.)
    '/_api/github/identity': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      return gitJson(await githubApi.identity());
    },

    '/_api/github/repos': async (req: Request) => {
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      return gitJson(await githubApi.repos());
    },

    '/_api/github/create-repo': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.createRepo(body));
    },

    '/_api/github/invite': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.invite(body));
    },

    '/_api/github/clone': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.clone(body));
    },

    '/_api/github/create-project': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.createProject(body));
    },

    // Create a NEW *local-only* project: mkdir + git init + .design scaffold, NO
    // GitHub / no token (the "just local git, no remote" path). Same main-origin +
    // loopback + POST CSRF gate as create-project, and MAIN-ORIGIN ONLY — absent
    // from CANVAS_SAFE_API + startCanvasServer routes (dual-allowlist), so the
    // untrusted canvas iframe can't drive disk writes.
    '/_api/project/create-local': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.createLocalProject(body));
    },

    // Scaffold a bootable .design/ into an existing folder (the "open a non-Maude
    // repo → set it up?" fallback). No token / no GitHub — local FS only, but still
    // main-origin + loopback gated (it writes to disk).
    '/_api/design/init': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await githubApi.initDesign(body));
    },

    // Phase 29 (E4) Door C — connect to a team hub: validate + probe + save the hub
    // credential to the global ~/.config/maude/hubs.json (sync/hub-link.ts). MAIN
    // ORIGIN ONLY (omitted from CANVAS_SAFE_API + startCanvasServer routes) + loopback
    // + POST CSRF, mirroring /_api/github/*. The lean in-app counterpart to the CLI
    // `maude design link`; the in-UI Connect is the explicit trust grant (DDR-054 F2).
    '/_api/hub/link': async (req: Request) => {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required', { status: 403 });
      const body = await readJson<unknown>(req, 8 * 1024);
      return gitJson(await linkHub(body));
    },

    '/_api/edit-css': async (req: Request) => {
      // Phase 12 (DDR-103) — single-property inline CSS edit. POST body
      // { canvas, id, property, value } → writes one key into the element's
      // inline `style={{}}` object via api.editCss → editAttribute. MAIN ORIGIN
      // ONLY: intentionally absent from CANVAS_SAFE_API + startCanvasServer's
      // route allowlist (DDR-054) — the untrusted canvas iframe origin must never
      // reach a source-write endpoint. The CSS-knob UI lives in the shell (main
      // origin) and calls it directly.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        id?: unknown;
        property?: unknown;
        value?: unknown;
        reset?: unknown;
        idIndex?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.editCss(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, delta: result.delta },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/edit-text': async (req: Request) => {
      // Phase 12 (DDR-103) — inline element text-content edit. POST body
      // { canvas, id, text } → overwrites the element's single JSXText child
      // (JSX-escaped) via api.editText → editText. Same MAIN-ORIGIN-ONLY trust
      // boundary as /_api/edit-css + /_api/canvas. The inline contenteditable
      // editor reaches it via the dgn:* bus → shell relay (never the iframe).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{ canvas?: unknown; id?: unknown; text?: unknown }>(
        req,
        16 * 1024
      );
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.editText(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, delta: result.delta },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/edit-attr': async (req: Request) => {
      // Phase 12.2 (DDR-104) — the CSS panel's "custom HTML attribute" escape
      // hatch. POST body { canvas, id, attr, value } → writes a plain JSX
      // attribute (data-*, aria-*, role, …) via api.editAttr → editAttribute's
      // non-`style.` path. Same MAIN-ORIGIN-ONLY trust boundary as
      // /_api/edit-css + /_api/edit-text (absent from CANVAS_SAFE_API +
      // startCanvasServer's route map; the untrusted iframe can never reach it).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        id?: unknown;
        attr?: unknown;
        value?: unknown;
        reset?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.editAttr(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, delta: result.delta, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/reorder': async (req: Request) => {
      // Phase 12.1 (DDR-138) — node-move reorder. POST body
      // { canvas, id, refId, position } → moves the element with data-cd-id `id`
      // to `position` ('before'|'after'|'inside-start'|'inside-end') relative to
      // `refId` (reparent-capable) via api.reorder → moveElement. Snapshots the
      // pre-move source for /design:rollback. Same MAIN-ORIGIN-ONLY trust boundary
      // as /_api/edit-css + /_api/edit-text + /_api/edit-attr: intentionally absent
      // from CANVAS_SAFE_API + startCanvasServer's route allowlist (DDR-054) — the
      // untrusted canvas iframe requests a reorder over the dgn:* bus and the shell
      // (main origin) performs this privileged write.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        id?: unknown;
        refId?: unknown;
        position?: unknown;
        idIndex?: unknown;
        refIndex?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.reorder(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        {
          ok: true,
          delta: result.delta,
          movedId: result.movedId,
          semanticId: result.semanticId,
          seq: result.seq,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/retime-sequence': async (req: Request) => {
      // DDR-148 — Timeline drag-to-retime. POST { canvas, index, durationInFrames?,
      // from? } → rewrites the index-th sequence's timing (const-preferring so a
      // derived total updates too). Same MAIN-ORIGIN-ONLY trust boundary as
      // /_api/reorder + /_api/edit-css (absent from CANVAS_SAFE_API +
      // startCanvasServer routes, DDR-054) — the source write is privileged; the
      // untrusted canvas iframe can only request it over the dgn:* bus.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        stableId?: unknown;
        artboardId?: unknown;
        contentHash?: unknown;
        index?: unknown;
        durationInFrames?: unknown;
        from?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.retimeSequenceOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/remove-sequence': async (req: Request) => {
      // DDR-150 P3 — remove a clip. POST { canvas, stableId, artboardId?,
      // contentHash? } → removeClip (fingerprint + semantic gate; refuses the
      // only clip; drops an adjacent transition in a series). Snapshots pre-remove
      // for /design:rollback. Same MAIN-ORIGIN-ONLY trust boundary as the other
      // source-writes (absent from CANVAS_SAFE_API + startCanvasServer routes).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        stableId?: unknown;
        artboardId?: unknown;
        contentHash?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.removeSequenceOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/insert-sequence': async (req: Request) => {
      // DDR-150 P4 — insert a clip. POST { canvas, artboardId, from,
      // durationInFrames, mediaTag?, src? } → insertClip (appends after the
      // comp's last clip; refuses TransitionSeries + empty comps; src contained).
      // MAIN-ORIGIN-ONLY (absent from CANVAS_SAFE_API + startCanvasServer routes).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        artboardId?: unknown;
        from?: unknown;
        durationInFrames?: unknown;
        mediaTag?: unknown;
        src?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.insertSequenceOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, stableId: result.stableId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/reorder-sequence': async (req: Request) => {
      // DDR-150 P5 — z-order reorder. POST { canvas, artboardId, stableId,
      // contentHash, refStableId, refContentHash, position } → reorderClip
      // (moves a standalone <Sequence> before/after a sibling via moveElement +
      // semantic gate; both clips fingerprint-checked; refuses TransitionSeries
      // clips + self-move). MAIN-ORIGIN-ONLY (absent from CANVAS_SAFE_API +
      // startCanvasServer routes — same dual-allowlist as the other clip writes).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        artboardId?: unknown;
        stableId?: unknown;
        contentHash?: unknown;
        refStableId?: unknown;
        refContentHash?: unknown;
        position?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.reorderSequenceOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, stableId: result.stableId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/toggle-hide': async (req: Request) => {
      // DDR-150 dogfood — hide/show a clip (gates its body behind {false && …};
      // the tag + time slot + TransitionSeries alternation stay). MAIN-ORIGIN-ONLY
      // + CSRF-gated like the other source writes.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        stableId?: unknown;
        artboardId?: unknown;
        contentHash?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.toggleHideOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, hidden: result.hidden, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/edit-array-src': async (req: Request) => {
      // DDR-150 dogfood — replace a media src stored in an array literal (the
      // showreel `const CLIPS = [{ src }, …]` fed via `<ClipShot clip={CLIPS[i]}>`),
      // addressed by the enumerator's mediaArrayRef. MAIN-ORIGIN-ONLY + CSRF-gated
      // (same dual-allowlist as the other source writes); value contained under
      // assets/ in the engine.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        arrayName?: unknown;
        index?: unknown;
        field?: unknown;
        value?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.editArraySrcOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/comp-clips': async (req: Request) => {
      // DDR-150 P2 — the single authoritative clip enumerator for a video-comp.
      // GET ?canvas=<rel>&artboardId=<id> → { ok, compName, clips:[{ stableId,
      // from, durationInFrames, mediaTag, mediaSrc, mediaCdId, contentHash }] }.
      // The Timeline addresses every clip op by the returned stableId (never a
      // regex document-order index — the multi-comp mis-hit defect). Read-only +
      // MAIN-ORIGIN-ONLY: absent from CANVAS_SAFE_API + the startCanvasServer
      // route map, so the untrusted canvas iframe can never reach it (DDR-054).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // DNS-rebinding guard — this GET echoes project source structure; loopback-
      // only Host (real browser passes, rebound hostname 403s). No sameOriginWrite (GET).
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const u = new URL(req.url);
      const result = await api.compClips({
        canvas: u.searchParams.get('canvas'),
        artboardId: u.searchParams.get('artboardId') ?? undefined,
      });
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/reorder-revert': async (req: Request) => {
      // Phase 12.1 follow-up — Cmd+Z / Cmd+Shift+Z for a reorder. POST body
      // { canvas, seq, dir:'undo'|'redo' } → api.reorderRevert swaps the whole
      // file back to the logged {before|after} content (id-churn-proof; refuses
      // 409 when the canvas changed since). Same MAIN-ORIGIN-ONLY boundary as
      // /_api/reorder — NOT in CANVAS_SAFE_API nor startCanvasServer's routes;
      // the canvas undo stack requests it over the dgn bus, the shell writes.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{ canvas?: unknown; seq?: unknown; dir?: unknown }>(
        req,
        8 * 1024
      );
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.reorderRevert(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, dir: result.dir },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/delete-element': async (req: Request) => {
      // Stage I (feature-element-editing-robustness) — delete an element by
      // data-cd-id. POST { canvas, id, idIndex? } → api.deleteElementOp (reparse
      // gate; reused-component instance via idIndex). Logs a whole-file undo seq
      // (Cmd+Z via /_api/reorder-revert — a structural edit churns positional
      // ids so an inverse descriptor goes stale). Same MAIN-ORIGIN-ONLY trust
      // boundary as /_api/reorder: absent from CANVAS_SAFE_API + startCanvasServer
      // routes (DDR-054); sameOriginWrite CSRF + loopback-Host (DNS-rebinding) gated.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{ canvas?: unknown; id?: unknown; idIndex?: unknown }>(
        req,
        8 * 1024
      );
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.deleteElementOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, deletedId: result.deletedId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/insert-element': async (req: Request) => {
      // Stage I — insert a synthesized div/text/image relative to `refId`, OR —
      // empty-artboard fallback — as a direct child of `artboardId` (exactly one
      // of the two). POST { canvas, refId|artboardId, position, kind, src?,
      // refIndex? } → api.insertElementOp. Returns the new element's
      // post-transpile id so the shell can select it.
      // Whole-file undo seq. MAIN-ORIGIN ONLY (absent from both allowlists);
      // sameOriginWrite + loopback-Host gated. An `image` src is contained to
      // assets/ in the engine (no remote hotlink / ../ / scheme).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        refId?: unknown;
        artboardId?: unknown;
        position?: unknown;
        kind?: unknown;
        src?: unknown;
        refIndex?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.insertElementOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, newId: result.newId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/duplicate-element': async (req: Request) => {
      // Cmd+D (Task L3) — duplicate an element (a copy as the next sibling). POST
      // { canvas, id, idIndex? } → api.duplicateElementOp. Whole-file undo seq.
      // MAIN-ORIGIN ONLY; sameOriginWrite + loopback-Host gated (dual-allowlist).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{ canvas?: unknown; id?: unknown; idIndex?: unknown }>(
        req,
        8 * 1024
      );
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.duplicateElementOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, newId: result.newId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/insert-artboard': async (req: Request) => {
      // Stage I4 — insert a new EMPTY artboard from a screen-size preset. POST
      // { canvas, id, label, width, height } → api.insertArtboardOp (appends a
      // <DCArtboard id label width height></DCArtboard> after the last artboard;
      // size JSX-authoritative per DDR-027). Whole-file undo seq. MAIN-ORIGIN
      // ONLY (absent from both allowlists); sameOriginWrite + loopback-Host gated.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        id?: unknown;
        label?: unknown;
        width?: unknown;
        height?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.insertArtboardOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, artboardId: result.artboardId, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/assets': async (req: Request) => {
      // Stage F1 (feature-element-editing-robustness) — list content-addressed
      // image/video assets under <designRoot>/assets/ for the AssetPicker (Replace
      // image / insert image). GET → { assets:[{path,name,ext,kind,size,mtimeMs}] }.
      // MAIN-ORIGIN ONLY: the picker is a shell dialog; absent from CANVAS_SAFE_API
      // + startCanvasServer routes (dual-allowlist, DDR-054). Loopback-Host gated
      // (DNS-rebinding); read-only, so no sameOriginWrite (GET).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const r = await api.listAssets();
      return Response.json(
        { ok: true, assets: r.assets },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/stickers': async (req: Request) => {
      // Phase 4 (feature-whiteboard-annotation-improvements) — the bundled
      // sticker catalogue for the StickerPicker. GET → { packs:[{slug, name,
      // author, attributionUrl, license, stickers:[{file,keywords,url}]}] }.
      // MAIN-ORIGIN ONLY: the picker is a shell dialog, same posture as
      // /_api/assets above — absent from CANVAS_SAFE_API + startCanvasServer
      // routes (dual-allowlist, DDR-054). Loopback-Host gated (DNS-rebinding);
      // read-only, so no sameOriginWrite (GET).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const r = await api.listStickers();
      return Response.json(
        { ok: true, packs: r.packs },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/edit-scope': async (req: Request) => {
      // Stage H (feature-element-editing-robustness) — the INV-3 predictability
      // verdict. GET ?canvas&id&rendered → { ok, scope:'local'|'shared',
      // componentName, affects, reason }. READ-only (a parse the shell runs on
      // selection to render the Local/Shared badge). MAIN-ORIGIN ONLY: absent
      // from CANVAS_SAFE_API + startCanvasServer routes (dual-allowlist, DDR-054);
      // loopback-Host gated (DNS-rebinding); no sameOriginWrite (GET).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const url = new URL(req.url);
      const result = await api.editScopeOp({
        canvas: url.searchParams.get('canvas') ?? undefined,
        id: url.searchParams.get('id') ?? undefined,
        rendered: url.searchParams.get('rendered') ?? undefined,
      });
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/resize-artboard': async (req: Request) => {
      // Stage D4 — free-hand artboard resize. POST { canvas, artboardId, width?,
      // height? } → api.resizeArtboardOp (writes the NUMERIC width/height props on
      // the <DCArtboard id="…">, addressed by its `id` prop since the rendered
      // <article data-dc-screen> carries no data-cd-id; DDR-027). Whole-file undo
      // seq. MAIN-ORIGIN ONLY; sameOriginWrite + loopback-Host gated.
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        canvas?: unknown;
        artboardId?: unknown;
        width?: unknown;
        height?: unknown;
      }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.resizeArtboardOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/delete-artboard': async (req: Request) => {
      // Delete an artboard by its `id` prop (Backspace / context-menu on a frame).
      // POST { canvas, artboardId } → api.deleteArtboardOp (removes the
      // <DCArtboard id="…"> span; refuses the last one). Whole-file undo seq.
      // MAIN-ORIGIN ONLY; sameOriginWrite + loopback-Host gated (dual-allowlist).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{ canvas?: unknown; artboardId?: unknown }>(req, 8 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      const result = await api.deleteArtboardOp(body);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { ok: true, seq: result.seq },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/asset': async (req: Request) => {
      // Phase 23 / DDR-148 — binary media upload from the canvas (drag-drop /
      // paste). POST raw bytes → content-addressed write under
      // <designRoot>/assets/<sha8>.<ext>, returns 201 { path }. This route is on
      // the canvas-origin allowlist (CANVAS_SAFE_API below) — a bigger grant than
      // the inert annotation-SVG write (binary, disk) — so the caps in
      // api.saveAssetFromStream (magic-byte sniff, per-category ceiling, content-
      // addressed name, traversal guard, no-SVG/script, dedupe, session budget)
      // are the load-bearing trust mitigation, NOT optional. DDR-088 + DDR-148:
      // the body is STREAMED to disk (no full-buffer of a 100 MB clip in RAM).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      // Early reject on a declared oversize body (the streamed per-category cap in
      // saveAssetFromStream is the authoritative gate — Content-Length can be
      // omitted/lied; this only trims an obvious oversize before we open a temp).
      const declared = Number(req.headers.get('content-length') || '0');
      if (Number.isFinite(declared) && declared > ASSET_MAX_VIDEO_BYTES) {
        const mb = Math.round(ASSET_MAX_VIDEO_BYTES / (1024 * 1024));
        return Response.json(
          { ok: false, error: `media exceeds the ${mb} MB cap` },
          { status: 413, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (!req.body) return new Response('empty body', { status: 400 });
      const result = await api.saveAssetFromStream(req.body as ReadableStream<Uint8Array>);
      if (!result.ok) {
        return Response.json(
          { ok: false, error: result.error },
          { status: result.status ?? 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return Response.json(
        { path: result.path },
        { status: 201, headers: { 'Cache-Control': 'no-store' } }
      );
    },

    '/_api/export-history': async (req: Request) => {
      // Phase 6.5 T10 — read-only recent-exports feed for the dialog's
      // Recent tab. Writes happen as a side-effect of job completion
      // (exporters/jobs.ts persistAndEvict) rather than this handler.
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const history = exportJobs.loadHistory();
      return Response.json({ history }, { headers: { 'Cache-Control': 'no-store' } });
    },

    '/_api/export': async (req: Request) => {
      // feature-background-export-notification-center — thin wrapper over the
      // job queue: enqueue() then await the SAME job's result. Byte-for-byte
      // identical external contract to the old synchronous handler, so
      // `/design:export` (CLI) and any other blocking caller need zero changes.
      // sameOriginWrite CSRF + loopback-Host (DNS-rebinding) gated, matching
      // the write-route convention elsewhere in this file (e.g.
      // /_api/delete-element) — closed as part of the /flow:done security
      // fan-out (defender finding: this POST now has a disk-write + queue-
      // growth consequence a bare cross-origin form-POST could trigger).
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const body = await readJson<{
        format?: unknown;
        scope?: unknown;
        options?: Record<string, unknown>;
      }>(req, 64 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      if (!isFormat(body.format)) return new Response('unknown or missing format', { status: 400 });
      if (!isScope(body.scope)) return new Response('unknown or missing scope', { status: 400 });
      const format = body.format;
      const scope = body.scope;
      try {
        const { result } = exportJobs.enqueue(
          buildExportArgs(req, { format, scope, options: body.options })
        );
        const finished = await result;
        // Bun.serve accepts Uint8Array directly; the cast satisfies the
        // SharedArrayBuffer-strict BodyInit narrowing on @types/bun.
        return new Response(finished.body as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': finished.contentType,
            'Content-Disposition': `attachment; filename="${finished.filename}"`,
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        if (err instanceof ExportQueueFullError) {
          return new Response(err.message, { status: 429 });
        }
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(`export failed: ${msg}`, { status: 500 });
      }
    },

    '/_api/export-jobs': async (req: Request) => {
      // feature-background-export-notification-center — the non-blocking
      // sibling of /_api/export: same body, returns 202 { jobId } immediately
      // without awaiting the render. MAIN-ORIGIN ONLY (absent from
      // CANVAS_SAFE_API + startCanvasServer routes, same trust boundary as
      // /_api/export today — DDR-060). loopback-Host gated on every method;
      // the mutating POST is additionally sameOriginWrite CSRF gated (same
      // /flow:done security fan-out fix as /_api/export above).
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      if (req.method === 'GET') {
        return Response.json(
          { jobs: exportJobs.list() },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (!sameOriginWrite(req))
        return new Response('cross-origin write rejected', { status: 403 });
      const body = await readJson<{
        format?: unknown;
        scope?: unknown;
        options?: Record<string, unknown>;
      }>(req, 64 * 1024);
      if (!body) return new Response('body required', { status: 400 });
      if (!isFormat(body.format)) return new Response('unknown or missing format', { status: 400 });
      if (!isScope(body.scope)) return new Response('unknown or missing scope', { status: 400 });
      try {
        const { id, result } = exportJobs.enqueue(
          buildExportArgs(req, { format: body.format, scope: body.scope, options: body.options })
        );
        // This route deliberately doesn't await the render — the job's own
        // status (surfaced via GET /_api/export-jobs + the export:job WS
        // push) is the completion signal. A render failure still needs a
        // handler here or it's an unhandled rejection on every failed/timed-
        // out background job (security fan-out finding, /flow:done) — the
        // failure is already recorded on the job record, so this is a no-op.
        result.catch(() => {});
        return Response.json(
          { jobId: id },
          { status: 202, headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (err) {
        if (err instanceof ExportQueueFullError) {
          return new Response(err.message, { status: 429 });
        }
        throw err;
      }
    },

    '/_api/export-jobs/download': async (req: Request) => {
      // MAIN-ORIGIN ONLY, same boundary as /_api/export-jobs above.
      // loopback-Host gated (read-only — no sameOriginWrite needed — but an
      // unguessable job-scoped UUID plus this guard closes the DNS-rebinding
      // angle the /flow:done security fan-out checked for).
      if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      if (!isLoopbackHost(req.headers.get('host')))
        return new Response('local request required (DNS-rebinding guard)', { status: 403 });
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return new Response('id query param required', { status: 400 });
      const dl = await exportJobs.getBytes(id);
      if (!dl.ok) {
        return new Response(dl.reason === 'not-done' ? 'job not finished' : 'Not found', {
          status: dl.reason === 'not-done' ? 409 : 404,
        });
      }
      return new Response(dl.bytes as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': dl.contentType,
          'Content-Disposition': `attachment; filename="${dl.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
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
        // env-gated (MAUDE_CSP_POC) for the POC / backwards-compat. A capture
        // render (?hide-chrome=1 — ⌘E export / screenshot shim) ALWAYS gets the
        // network-locked capture CSP so it can't SSRF/exfil (attacker F1).
        const capture = url.searchParams.get('hide-chrome') === '1';
        return serveCanvasShell(process.env.MAUDE_CSP_POC === '1', capture);
      }

      // DDR-150 dogfood — canvas-relative assets alias. A comp's
      // `<Video src="assets/x.mp4">` resolves against the iframe root →
      // `/assets/x.mp4`; serve `designRoot/assets/x.mp4` (flat sha8-named
      // uploads, media extensions only — mirrors isCanvasSafeRoute's gate on
      // the canvas origin). Without this, every src the timeline insert /
      // replace / assemble writers emit 404'd in the Player.
      if (pathname.startsWith('/assets/')) {
        let name = '';
        try {
          name = decodeURIComponent(pathname.slice('/assets/'.length));
        } catch {
          return new Response('Bad request', { status: 400 });
        }
        if (
          name &&
          !name.includes('/') &&
          !name.includes('\\') &&
          !name.includes('..') &&
          !name.startsWith('_') &&
          CANVAS_ASSET_EXTS.has(ext(name))
        ) {
          const abs = join(ctx.paths.designRoot, 'assets', name);
          // Range-aware for video/audio (scrubbing + WKWebView compat).
          if (RANGE_MEDIA_EXTS.has(ext(name))) {
            return serveMediaFile(abs, req, { 'X-Content-Type-Options': 'nosniff' });
          }
          const f = Bun.file(abs);
          if (await f.exists()) {
            return new Response(f, {
              headers: {
                'Content-Type': MIME[ext(name)] || 'application/octet-stream',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
              },
            });
          }
          return new Response('Not found', { status: 404 });
        }
      }

      // Phase 4 (feature-whiteboard-annotation-improvements) — bundled sticker
      // PNGs, served from MAUDE's OWN STICKERS_DIR (paths.ts, DDR-045), never
      // the served project's designRoot (unlike /assets/ above). MAIN-ORIGIN
      // ONLY: absent from CANVAS_SAFE_API + startCanvasServer's own routes
      // object (server.ts) — a canvas-origin request 404s via isCanvasSafeRoute
      // before ever reaching here (dual-allowlist, DDR-054/DDR-088).
      if (pathname.startsWith('/_stickers/')) {
        const rest = pathname.slice('/_stickers/'.length);
        let decoded = '';
        try {
          decoded = decodeURIComponent(rest);
        } catch {
          return new Response('Bad request', { status: 400 });
        }
        const parts = decoded.split('/');
        const [pack, name] = parts;
        if (
          parts.length === 2 &&
          pack &&
          name &&
          /^[a-z0-9-]+$/.test(pack) &&
          !name.includes('..') &&
          !name.includes('/') &&
          !name.includes('\\') &&
          ext(name) === '.png'
        ) {
          const abs = join(STICKERS_DIR, pack, name);
          const f = Bun.file(abs);
          if (await f.exists()) {
            return new Response(f, {
              headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable', // bundled with this maude version, never changes at this URL
                'X-Content-Type-Options': 'nosniff',
              },
            });
          }
          return new Response('Not found', { status: 404 });
        }
        return new Response('Not found', { status: 404 });
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
      // Video/audio get Range support (scrubbing + WKWebView compat) — the
      // `/.design/assets/…` form comps reference goes through here.
      if (RANGE_MEDIA_EXTS.has(e)) {
        return serveMediaFile(fp, req, { 'X-Content-Type-Options': 'nosniff' });
      }
      // Bun.file streams transparently for binary content.
      return new Response(file, {
        headers: {
          'Content-Type': MIME[e] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          // DDR-088 follow-up — never let a browser MIME-sniff a served file
          // (e.g. an uploaded GIF/WEBP polyglot) into a richer type. Assets are
          // only referenced via <image href> + the canvas CSP blocks script, so
          // this is defense-in-depth on the static lane.
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`Server error: ${msg}`, { status: 500 });
    }
  }

  async function serveCanvasShell(applyCsp: boolean, capture = false): Promise<Response> {
    const shellHtml = await Bun.file(join(TEMPLATES_DIR, '_shell.html')).text();
    // Inject inspector overlay — Cmd+Click selection + add-comment flow.
    const injected = inspect.injectInspector(shellHtml);
    const headers: Record<string, string> = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    // A capture render (⌘E export / screenshot) ALWAYS carries the network-locked
    // capture CSP, even on the main origin where the normal shell CSP is off —
    // this is the SSRF/exfil boundary the export otherwise lacked (attacker F1).
    if (capture) headers['Content-Security-Policy'] = cspForCapture();
    else if (applyCsp)
      headers['Content-Security-Policy'] = cspForCanvasShell(injected, ctx.mainOrigin);
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
    // DDR-148 — video/audio media a video-comp `<Video>`/`<Audio>` loads from
    // assets/. Served like images (inert static bytes, `nosniff`, no script
    // execution under the canvas CSP) — the same read grant, widened for media.
    '.mp4',
    '.m4v',
    '.mov',
    '.webm',
    '.mp3',
    '.wav',
    '.m4a',
    '.ogg',
  ]);

  // Exact API paths the canvas iframe needs (collab + display data). See
  // isCanvasSafeRoute for the trust rationale. Mutations are limited to inert
  // collab data (annotations SVG, comment replies via the dynamic route).
  const CANVAS_SAFE_API = new Set([
    '/_api/git-user', // presence display name
    '/_api/canvas-meta', // layout/viewport sidecar (GET + PATCH)
    '/_api/annotations', // annotation SVG (GET + PUT) — drives the collab bridge
    '/_api/asset', // Phase 23 — capped binary image upload (sniff+category cap+sha8 name+no-SVG)
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
    // DDR-150 dogfood — `/assets/<file>`: the canvas-RELATIVE form every writer
    // emits (`<Video src="assets/x.mp4">` from timeline insert / replace /
    // assemble, and what the video-comp skill teaches). It aliases to
    // `designRoot/assets/<file>` — flat single segment (uploads are sha8-named),
    // media/image extensions only, no `_` names. Same read-only trust class as
    // the designRel static lane above (DDR-088 widened media grant).
    if (safe.startsWith('/assets/')) {
      const rest = safe.slice('/assets/'.length);
      if (!rest || rest.includes('/') || rest.startsWith('_')) return false;
      return CANVAS_ASSET_EXTS.has(ext(safe));
    }
    return false;
  }

  return { routes, fetch, serveCanvasShell, isCanvasSafeRoute };
}
