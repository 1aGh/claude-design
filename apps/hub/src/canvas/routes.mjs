// The browser door's HTTP surface — Cloud Phase 25 A1/A3/A4 + B3/B4/B6/B7.
//
// TWO ORIGINS, TWO JOBS (DDR-054, A4):
//
//   the SHELL origin (`<project>.cloud.maude.sh`)  — cookie-authenticated.
//     The studio page, the canvas list, the structured mutations, export.
//     Never serves a byte of tenant-authored code.
//   the CANVAS origin (`canvas.cloud.maude.sh/<tenant>/…`) — capability-
//     authenticated (render-token.mjs), READ ONLY. The shell, the built
//     module, the runtime bundles, the design system's CSS and images.
//     Nothing here can change the project, so a canvas that gets loose
//     inside its own iframe has nothing to reach.
//
// A self-hosted hub with one hostname keeps both on the same origin — the
// separation is a defence for the MULTI-TENANT case, and a self-hoster's cell
// holds only their own work. It is a documented degradation, not an oversight:
// `canvasOriginFor()` returns the same origin and says so.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

import { buildCanvas, buildStats } from './build.mjs';
import {
  addComment,
  commentCounts,
  readComments,
  replyToComment,
  setCommentStatus,
} from './comments.mjs';
import { applyEditOp, checkEditOp } from './edits.mjs';
import {
  canvasMeta,
  designRootFor,
  firstDesignSystem,
  listCanvases,
  stylesheetsFor,
} from './project.mjs';
import { mintRenderToken, verifyRenderToken } from './render-token.mjs';
import { renderCanvasShell } from './shell.mjs';
import { renderStudioPage } from './studio-page.mjs';

/** Where the pre-built runtime bundles live in the image (and in a checkout). */
function runtimeDir(env = process.env) {
  const candidates = [
    env.MAUDE_CANVAS_RUNTIME_DIR,
    join(process.cwd(), 'dist', 'canvas-runtime'),
    join(process.cwd(), '..', 'studio', 'dist', 'runtime'),
  ].filter(Boolean);
  for (const dir of candidates) if (existsSync(dir)) return dir;
  return null;
}

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

/**
 * THE KILL SWITCH (A3).
 *
 * Per-tenant, not fleet-wide: an incident in one project must not take
 * everybody's door off its hinges, and a switch that costs everyone is a
 * switch nobody dares use. Two ways to throw it, because the two hands that
 * reach for it are different:
 *
 *   MAUDE_RENDER_DISABLED=1        the cell's own env (operator, needs a restart)
 *   <designRoot>/../.render-off     a file in the tenant's volume (on-call, instant)
 *
 * Reading a file per request is deliberate: during an incident the person
 * needs it to take effect NOW, not after a container restart they then have to
 * wait out.
 */
export function renderDisabled(env = process.env) {
  if (env.MAUDE_RENDER_DISABLED === '1') return 'operator';
  const repoDir = env.MAUDE_REPO_DIR;
  if (repoDir && existsSync(join(repoDir, '..', '.render-off'))) return 'on-call';
  if (repoDir && existsSync(join(repoDir, '.render-off'))) return 'on-call';
  return null;
}

/** The origin the canvas iframe loads from. */
export function canvasOriginFor(request, env = process.env) {
  const explicit = env.MAUDE_CANVAS_ORIGIN;
  if (explicit) return { origin: explicit.replace(/\/+$/, ''), separate: true, prefix: '' };
  const host = request.headers?.host ?? '';
  const zone = env.CELL_ZONE;
  const tenant = env.MAUDE_TENANT_ID;
  if (zone && tenant && host.endsWith(`.${zone}`)) {
    // ONE shared canvas hostname for the whole fleet, tenant in the path.
    // A per-tenant canvas hostname would be a second custom domain to
    // provision, delete and reconcile for every project — more moving parts
    // for the same origin boundary.
    return { origin: `https://canvas.${zone}`, separate: true, prefix: `/${tenant}` };
  }
  return { origin: '', separate: false, prefix: '' };
}

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(payload);
}

function html(response, status, body, { canvasOrigin = null } = {}) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    // The studio page frames the canvas origin and nothing frames the studio.
    'content-security-policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      `frame-src ${canvasOrigin || "'self'"}`,
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join('; '),
  });
  response.end(body);
}

/** The canvas origin's CSP: it may run the tenant's module and reach nothing else. */
function canvasHtml(response, status, body, { selfOrigin }) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': [
      "default-src 'none'",
      `script-src 'unsafe-inline' 'unsafe-eval' blob: ${selfOrigin}`,
      `style-src 'unsafe-inline' ${selfOrigin}`,
      `img-src data: blob: ${selfOrigin}`,
      `media-src data: blob: ${selfOrigin}`,
      `font-src data: ${selfOrigin}`,
      `connect-src blob: ${selfOrigin}`,
      'frame-ancestors *',
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '),
  });
  response.end(body);
}

function corsForCanvas(response, origin) {
  // The canvas origin fetches its module + assets from here. Explicit origin,
  // no credentials — the capability is in the URL, never a cookie.
  if (origin) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('vary', 'origin');
}

function relFromQuery(designRoot, raw) {
  const rel = String(raw ?? '');
  if (!rel || rel.includes('\0') || rel.length > 512) return null;
  const abs = resolve(designRoot, rel);
  const root = resolve(designRoot);
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  // Runtime state is never served (DDR-115).
  if (rel.split('/').some((seg) => seg.startsWith('_'))) return null;
  return { rel, abs };
}

/**
 * Route the browser door.
 *
 * @returns {Promise<boolean>} true when handled.
 */
export async function handleCanvasRoutes(ctx) {
  const {
    request,
    response,
    pathname,
    method,
    env = process.env,
    session, // { email, role, readOnly } | null — resolved by the caller
    secret,
    projectName,
  } = ctx;

  const designRoot = designRootFor(env);
  const canvasOrigin = canvasOriginFor(request, env);
  const isCanvasRoute = pathname.startsWith('/_canvas/');
  const isStudioRoute = pathname === '/studio' || pathname.startsWith('/studio/');
  const isStudioApi = pathname.startsWith('/api/studio/');
  if (!isCanvasRoute && !isStudioRoute && !isStudioApi) return false;

  if (!designRoot || !existsSync(designRoot)) {
    json(response, 503, { error: 'this workspace has no design project yet' });
    return true;
  }

  // ---- the kill switch, before anything reads tenant source ---------------
  const off = renderDisabled(env);
  if (off) {
    const message =
      'Rendering is paused for this project while we look into something. ' +
      'Your work is safe and nothing has been changed. Maude Desktop still opens it normally.';
    if (isStudioRoute) html(response, 503, servicePage('Paused', message), { canvasOrigin: null });
    else json(response, 503, { error: message, reason: 'render-disabled', by: off });
    return true;
  }

  // ---- the CANVAS origin: capability-authenticated reads ------------------
  if (isCanvasRoute) {
    const url = new URL(request.url, 'http://cell.invalid');
    const token = url.searchParams.get('t');
    const verdict = verifyRenderToken({
      secret,
      token,
      project: env.MAUDE_TENANT_ID ?? null,
    });
    if (!verdict.ok) {
      json(response, 401, { error: 'this canvas link has expired — reload the project' });
      return true;
    }
    corsForCanvas(response, canvasOrigin.separate ? canvasOrigin.origin : null);

    if (pathname === '/_canvas/shell') {
      const target = relFromQuery(designRoot, url.searchParams.get('canvas'));
      if (!target || !existsSync(target.abs)) {
        canvasHtml(response, 404, '<!doctype html><p>That canvas is not here.</p>', {
          selfOrigin: "'self'",
        });
        return true;
      }
      const base = canvasOrigin.separate ? `${canvasOrigin.origin}${canvasOrigin.prefix}` : '';
      canvasHtml(
        response,
        200,
        renderCanvasShell({
          canvasRel: target.rel,
          token,
          base,
          meta: canvasMeta(designRoot, target.rel),
          css: stylesheetsFor(designRoot, target.rel),
          readOnly: url.searchParams.get('ro') === '1',
        }),
        { selfOrigin: canvasOrigin.separate ? canvasOrigin.origin : "'self'" }
      );
      return true;
    }

    if (pathname === '/_canvas/module') {
      const target = relFromQuery(designRoot, url.searchParams.get('canvas'));
      if (!target || !existsSync(target.abs)) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('That canvas is not here.');
        return true;
      }
      const built = await buildCanvas({ designRoot, canvasAbs: target.abs, env });
      if (!built.ok) {
        // 200-with-a-message would be a lie to the fetch; the shell reads the
        // body either way and shows the sentence.
        response.writeHead(422, {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(built.error);
        return true;
      }
      response.writeHead(200, {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store',
        etag: `"${built.etag}"`,
        'x-content-type-options': 'nosniff',
      });
      response.end(built.js);
      return true;
    }

    if (pathname.startsWith('/_canvas/runtime/')) {
      const dir = runtimeDir(env);
      const slug = pathname.slice('/_canvas/runtime/'.length);
      if (!dir || !/^[A-Za-z0-9@_.-]+\.js$/.test(slug)) {
        response.writeHead(404).end();
        return true;
      }
      const file = join(dir, slug);
      if (!existsSync(file)) {
        response.writeHead(404).end();
        return true;
      }
      const body = readFileSync(file);
      response.writeHead(200, {
        'content-type': 'application/javascript; charset=utf-8',
        // Content-addressed by build, not by URL — but these change only with
        // a release, so a long cache with revalidation is honest.
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      });
      response.end(body);
      return true;
    }

    if (pathname === '/_canvas/asset') {
      const target = relFromQuery(designRoot, url.searchParams.get('path'));
      const ext = target ? extname(target.abs).toLowerCase() : '';
      if (!target || !MIME[ext] || !existsSync(target.abs)) {
        response.writeHead(404).end();
        return true;
      }
      const stat = statSync(target.abs);
      if (!stat.isFile() || stat.size > 64 * 1024 * 1024) {
        response.writeHead(404).end();
        return true;
      }
      response.writeHead(200, {
        'content-type': MIME[ext],
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      response.end(readFileSync(target.abs));
      return true;
    }

    json(response, 404, { error: 'not found' });
    return true;
  }

  // ---- the SHELL origin: a signed-in member only -------------------------
  if (!session) {
    if (isStudioRoute) {
      // B1 — the browser door's sign-in is the Maude account, at the control
      // plane. Nothing to type here; the cell has no password of its own in
      // cloud mode (DDR-204).
      const dashboard = env.HUB_DASHBOARD_URL ?? 'https://cloud.maude.sh';
      const tenant = env.MAUDE_TENANT_ID;
      // The address the CUSTOMER is at — never the Host header. Behind the
      // outbound tunnel (Phase 25, 2026-08-03) the Host is the tunnel's
      // internal hostname, so a Host-derived return URL sent the member to an
      // address that is not their project's. HUB_PUBLIC_URL is what cellEnv
      // sets to the customer-facing name; the header is only a fallback for a
      // hub that has none.
      const publicBase = (env.HUB_PUBLIC_URL ?? '').replace(/\/+$/, '');
      const back = `${publicBase || `https://${request.headers?.host ?? ''}`}/auth/browser`;
      response.writeHead(302, {
        // Platform: the Maude account, at the control plane. Self-hosted (E2):
        // this hub's own users, at its own sign-in — one door each, one studio.
        location: tenant
          ? `${dashboard}/projects/${encodeURIComponent(tenant)}/browser?return=${encodeURIComponent(back)}`
          : '/studio/signin',
        'cache-control': 'no-store',
      });
      response.end();
      return true;
    }
    json(response, 401, { error: 'sign in to open this project' });
    return true;
  }

  if (pathname === '/studio') {
    const canvases = listCanvases(designRoot);
    const renderToken = mintRenderToken({
      secret,
      project: env.MAUDE_TENANT_ID ?? 'local',
      subject: session.email,
    });
    html(
      response,
      200,
      renderStudioPage({
        projectName: projectName ?? env.MAUDE_PROJECT_NAME ?? env.MAUDE_TENANT_ID ?? 'Project',
        canvases,
        session,
        renderToken,
        canvasBase: canvasOrigin.separate ? `${canvasOrigin.origin}${canvasOrigin.prefix}` : '',
        designSystem: firstDesignSystem(designRoot),
        dashboardUrl: env.HUB_DASHBOARD_URL ?? null,
      }),
      { canvasOrigin: canvasOrigin.separate ? canvasOrigin.origin : null }
    );
    return true;
  }

  if (pathname === '/api/studio/canvases' && method === 'GET') {
    json(response, 200, {
      canvases: listCanvases(designRoot),
      comments: commentCounts(designRoot),
    });
    return true;
  }

  // ---- comments (B5) — the one write a viewer holds --------------------
  if (pathname === '/api/studio/comments') {
    const url = new URL(request.url, 'http://cell.invalid');
    if (method === 'GET') {
      const target = relFromQuery(designRoot, url.searchParams.get('canvas'));
      if (!target) {
        json(response, 400, { error: 'that canvas is not in this project' });
        return true;
      }
      json(response, 200, { comments: readComments(designRoot, target.rel) });
      return true;
    }
    if (method === 'POST') {
      let body = null;
      try {
        body = await readJsonBody(request);
      } catch {
        json(response, 400, { error: 'that request could not be read' });
        return true;
      }
      const target = relFromQuery(designRoot, body?.canvas);
      if (!target) {
        json(response, 400, { error: 'that canvas is not in this project' });
        return true;
      }
      // The AUTHOR is the session, never the payload. A comment that can claim
      // to be from someone else is worse than no comment.
      const author = session.email;
      let result;
      if (body.action === 'reply') {
        result = replyToComment(designRoot, target.rel, String(body.id ?? ''), {
          body: body.body,
          author,
        });
      } else if (body.action === 'status') {
        result = setCommentStatus(designRoot, target.rel, String(body.id ?? ''), body.status);
      } else {
        result = addComment(designRoot, target.rel, {
          text: body.text,
          selector: body.selector,
          index: body.index,
          tag: body.tag,
          author,
        });
      }
      json(response, result.ok ? 200 : 400, result);
      return true;
    }
    json(response, 405, { error: 'method not allowed' });
    return true;
  }

  if (pathname === '/api/studio/render-token' && method === 'GET') {
    json(response, 200, {
      token: mintRenderToken({
        secret,
        project: env.MAUDE_TENANT_ID ?? 'local',
        subject: session.email,
      }),
    });
    return true;
  }

  if (pathname === '/api/studio/stats' && method === 'GET') {
    json(response, 200, buildStats());
    return true;
  }

  if (pathname === '/api/studio/edit' && method === 'POST') {
    // C3: the role means the same thing here as everywhere. The cell's global
    // read-only gate has already refused this request for a viewer; the check
    // is repeated because "someone upstream checked" is how a permission model
    // rots (and this route is the one that writes source).
    if (session.readOnly) {
      json(response, 403, {
        error: 'You can look at this project, comment and download it, but not change it.',
        reason: 'read-only',
      });
      return true;
    }
    let body = null;
    try {
      body = await readJsonBody(request);
    } catch {
      json(response, 400, { error: 'that request could not be read' });
      return true;
    }
    const checked = checkEditOp(body, { designRoot });
    if (!checked.ok) {
      json(response, 400, { error: checked.error });
      return true;
    }
    const applied = await applyEditOp(checked.op, { env });
    json(response, applied.ok ? 200 : 400, applied);
    return true;
  }

  json(response, 404, { error: 'not found' });
  return true;
}

async function readJsonBody(request, max = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw new Error('too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** A plain page for the states that are not the studio. */
export function servicePage(title, message, { action = null } = {}) {
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         font:15px/1.6 -apple-system, system-ui, sans-serif; background:#0e1014; color:#e8eaf0; }
  main { max-width:30rem; text-align:center; }
  h1 { font-size:1.35rem; margin:0 0 .5rem; }
  p { color:#a2a9b8; margin:0 0 1rem; }
  a { display:inline-block; margin-top:.5rem; padding:9px 16px; border-radius:9px;
      background:#6d5ef5; color:#fff; text-decoration:none; font-weight:600; }
</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p>${
    action ? `<a href="${esc(action.href)}">${esc(action.label)}</a>` : ''
  }</main></body></html>`;
}
