// The authenticating reverse proxy — Cloud Phase 27 A2/A3/A4, under DDR-209.
//
// The hub stops rendering UI. It terminates the session, resolves the role,
// checks the deny-by-default manifest, and forwards to the real studio on
// loopback. Everything a member sees is served by the same code the desktop
// runs, which is the entire point of the phase.
//
// THREE PROPERTIES THIS FILE EXISTS TO HOLD.
//
// 1. THE ROLE IS PER SESSION, NOT PER PROCESS. The studio's own gate reads a
//    per-PROCESS config file — one role per hub URL. Correct for a desktop with
//    one user; wrong for one cell serving an owner and a viewer at the same
//    time. So the proxy owns the role and INJECTS it per request. The studio's
//    gate stays as defence in depth, never as the authority (A3).
//
// 2. AN INBOUND `x-maude-*` HEADER IS AN ATTACK. The whole scheme is "the proxy
//    tells the studio who this is", so a client that can set that header is a
//    client that can be anyone. Every such header is STRIPPED before the
//    manifest is consulted, not after, and not conditionally.
//
// 3. FAIL CLOSED (A4). No session, no role, no manifest entry, no upstream —
//    each of those refuses. `isHubReadOnly()` returning `false` from its `catch`
//    is correct for a local tool and is the whole ballgame on the internet; this
//    proxy inverts that default and a test asserts it.

import { request as httpRequest } from 'node:http';
import { connect as netConnect } from 'node:net';

import { RENDER_TOKEN_TTL_MS } from './render-token.mjs';
import { isReadOnlyRole } from './role-matrix.mjs';
import { decide } from './studio-manifest.mjs';

/** Headers a client must never be able to speak. See property 2 above. */
export const INJECTED_HEADER_PREFIX = 'x-maude-';

/**
 * The canvas origin's capability, as a cookie ON THE CANVAS ORIGIN.
 *
 * WHY A COOKIE AFTER ALL, HAVING SAID NO TO ONE.
 *
 * The capability travels in the URL because the canvas origin is separate and
 * a separate origin sends no cookie. That is true of the URLs the SHELL builds
 * — the iframe, the module, the design system's CSS — and it is exactly false
 * of the ones it does not build. Canvas code is the tenant's own source, and
 * the tenant's own source says `<img src="/.design/system/x/assets/logo.svg">`.
 * That URL is emitted by the browser with no query string, because nothing in
 * the request path ever passes through code we wrote. Every asset, every font,
 * every photograph: 401. The page rendered and was empty of everything that
 * makes it a design.
 *
 * The shell cannot fix this. Rewriting the tenant's source to append a token
 * to every URL means parsing and rewriting arbitrary JSX, CSS `url()`, inline
 * styles and anything computed at runtime — the last of which is not solvable
 * at all. So the capability has to be ambient on that origin, which means a
 * cookie, which is the thing DDR-054 refused.
 *
 * WHAT MAKES IT DIFFERENT FROM THE ONE DDR-054 REFUSED. That objection was
 * about the SHELL's session cookie being scoped wide enough to reach the
 * canvas origin — the untrusted origin borrowing the trusted one's identity.
 * This is the opposite direction and a different credential:
 *
 *   · It is host-scoped to `canvas-<project>.<zone>`, an origin that exists per
 *     project (Phase 27) and serves one read-only allowlist. It is not sent to
 *     the shell, to another tenant, or to the control plane.
 *   · It IS the render token — same HMAC, same fifteen-minute life, same
 *     read-only grant. Nothing new is authorised; the same capability simply
 *     survives a URL the shell did not write.
 *   · `HttpOnly`, so the canvas's own scripts cannot read it — the canvas is
 *     untrusted code and must not be able to exfiltrate its own capability.
 *
 * `SameSite=Lax` is deliberate and sufficient: the shell and the canvas origin
 * are the same SITE (both under the registrable domain), so the iframe's
 * subresource requests are same-site and carry it, while a genuinely foreign
 * page gets nothing. The `Secure` flag is set unless the deployment is plain
 * HTTP on loopback, which is the local harness.
 */
export const CANVAS_CAPABILITY_COOKIE = 'maude_canvas';

/**
 * The cookie outlives the token by design, and that grants nothing.
 *
 * The signature carries its own expiry, so a stale cookie fails verification
 * exactly when a stale URL would. The extra window only avoids the browser
 * dropping a cookie moments before the shell reloads and replaces it — a
 * refresh is what re-mints, and a canvas left open all afternoon should meet
 * one clean 401 rather than an intermittent one.
 */
const canvasCookieMaxAge = Math.floor((RENDER_TOKEN_TTL_MS * 2) / 1000);

/** Read one cookie from a Node request without pulling in a parser. */
function cookieFrom(request, name) {
  const raw = request?.headers?.cookie;
  if (!raw) return null;
  for (const part of String(raw).split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** The shell document — the one response allowed to plant the cookie. */
function isCanvasShellPath(rest) {
  return rest === '/_canvas-shell.html' || rest === '/_canvas-shell';
}

/** Hop-by-hop headers — meaningless to forward, actively harmful to copy. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * The headers we send upstream: the client's, minus anything hop-by-hop, minus
 * anything it could have used to impersonate the proxy — plus the truth.
 */
export function upstreamHeaders(incoming, { role, user, sessionKey, publicUrl, canvasToken }) {
  const out = {};
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;
    if (key.startsWith(INJECTED_HEADER_PREFIX)) continue; // property 2
    if (key === 'host') continue; // D4 — identity comes from configuration
    out[k] = v;
  }
  // D4 again: the studio must not learn its own address from a header a tunnel
  // rewrote. It is told, once, what it is.
  if (publicUrl) out.host = new URL(publicUrl).host;
  out[`${INJECTED_HEADER_PREFIX}role`] = role;
  // The DERIVED capability, not just the label. The studio must not re-derive
  // what `viewer` means — that would be a second copy of the role model, in
  // another language, in a package that ships to end users on npm. One table
  // (`role-matrix.mjs`), one authority; everything else mirrors its answer.
  out[`${INJECTED_HEADER_PREFIX}readonly`] = isReadOnlyRole(role) ? '1' : '0';
  if (user) out[`${INJECTED_HEADER_PREFIX}user`] = user;
  // The capability that opens the cookieless canvas origin. The client appends
  // it to every canvas iframe URL; minting it here keeps the signing secret in
  // the process that already holds it.
  if (canvasToken) out[`${INJECTED_HEADER_PREFIX}canvas-token`] = canvasToken;
  // D3 — the session dimension. `_active.json` and `<slug>.view.json` are
  // per-machine singletons by design (DDR-115); in one cell serving two members
  // that means they clobber each other's selection and camera, silently, and it
  // reads as flakiness rather than as a bug. The studio partitions its runtime
  // state by this key.
  if (sessionKey) out[`${INJECTED_HEADER_PREFIX}session`] = sessionKey;
  return out;
}

/**
 * A stable, non-identifying per-session key.
 *
 * The email would work and is a worse choice: it would end up in file names on
 * disk, in a directory a support engineer might read, for a person who did not
 * agree to that. A hash of (project, email) is stable across reconnects, unique
 * per member, and says nothing.
 */
export function sessionKeyFor(project, email, hash) {
  return hash(`${project}\0${email}`).slice(0, 16);
}

function refuse(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(payload);
}

/** The sentence a refusal says. One wording, everywhere, matching the promise
 *  the People page makes — a viewer who is told something different by two
 *  surfaces concludes one of them is broken. */
export const READ_ONLY_MESSAGE =
  'You can look at this project, comment and download it, but not change it.';

/**
 * Build the proxy.
 *
 * @param {object} deps
 * @param {() => ({ ok: boolean, port: number })} deps.upstream  the supervised child's status
 * @param {() => ({ ok: boolean, port: number|null })} [deps.canvasUpstream]
 * @param {string} [deps.publicUrl]
 */
export function createStudioProxy({
  upstream,
  canvasUpstream = null,
  publicUrl = null,
  env = process.env,
  /** Mint the canvas origin's capability for this session. Injected so the
   *  signing secret never leaves the process that owns it. */
  mintCanvasToken = null,
  forward = defaultForward,
  forwardUpgrade = defaultForwardUpgrade,
} = {}) {
  /**
   * Handle one HTTP request destined for the studio.
   *
   * @returns {Promise<boolean>} true when this proxy answered (or forwarded).
   */
  async function handle({ request, response, pathname, method, session }) {
    // ---- A4: fail closed -------------------------------------------------
    //
    // Order matters. The session check comes BEFORE the manifest so an
    // unauthenticated request never learns which routes exist, and the upstream
    // check comes last so a signed-in member gets "starting up", not "sign in".
    if (!session?.role) {
      refuse(response, 401, { error: 'sign in to open this project', reason: 'no-session' });
      return true;
    }

    const verdict = decide(method, pathname, session.role);
    if (!verdict.allow) {
      if (verdict.reason === 'method') {
        refuse(response, 405, { error: 'method not allowed' });
        return true;
      }
      if (verdict.reason === 'unclassified' || verdict.reason === 'refused') {
        // 404, not 403. A cell should look like it never had the feature rather
        // than like it is refusing one — the same posture the containment
        // fall-through takes, and for the same reason: a refusal is a map.
        refuse(response, 404, { error: 'not found' });
        return true;
      }
      refuse(response, 403, {
        error: READ_ONLY_MESSAGE,
        reason: 'read-only',
        capability: verdict.capability,
      });
      return true;
    }

    const up = upstream();
    if (!up?.ok) {
      // 503 + Retry-After, because this is genuinely transient: the supervisor
      // is restarting the child and will succeed. Saying 500 here would make an
      // ordinary restart look like data loss to whoever is watching.
      response.writeHead(503, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '2',
      });
      response.end(
        JSON.stringify({
          error: 'This project is starting up. Your work is safe — try again in a moment.',
          reason: 'upstream-starting',
        })
      );
      return true;
    }

    await forward({
      request,
      response,
      port: up.port,
      headers: upstreamHeaders(request.headers, {
        role: session.role,
        user: session.email,
        sessionKey: session.sessionKey,
        publicUrl,
        canvasToken: mintCanvasToken?.(session) ?? null,
      }),
    });
    return true;
  }

  /**
   * The CANVAS origin lane.
   *
   * A different hostname, no cookie, and that is deliberate: a cookie scoped
   * widely enough to cover `canvas.<zone>` would be readable by the untrusted
   * canvas origin, which defeats the DDR-054 split entirely. So the capability
   * lives in the URL (`?t=<render token>`), it is READ ONLY, and it reaches the
   * studio's segregated canvas listener rather than its main one.
   */
  async function handleCanvas({
    request,
    response,
    pathname,
    method,
    verifyToken,
    /** The path prefix THIS deployment's canvas origin carries, from
     *  `canvasOriginFor()` — `/alligators` on the fleet's shared
     *  `canvas.<zone>` hostname, and `''` when the tenant has an origin of its
     *  own. Passed in rather than derived from MAUDE_TENANT_ID: the tenant id
     *  exists in BOTH shapes, so assuming it meant a path prefix made every
     *  canvas request 404 on a per-tenant origin. The prefix belongs to the
     *  ORIGIN, so it comes from whatever decided the origin. */
    pathPrefix = '',
  }) {
    if (method !== 'GET' && method !== 'HEAD') {
      refuse(response, 405, { error: 'method not allowed' });
      return true;
    }
    const url = new URL(request.url, 'http://cell.invalid');
    // Strip the prefix before forwarding — the studio serves one project and
    // knows nothing about tenants.
    let rest = pathname;
    if (pathPrefix) {
      if (rest === pathPrefix || rest.startsWith(`${pathPrefix}/`)) {
        rest = rest.slice(pathPrefix.length) || '/';
      } else {
        refuse(response, 404, { error: 'not found' });
        return true;
      }
    }
    // The VENDOR runtime bundles need no capability.
    //
    // They are our own React/motion builds, byte-identical for every tenant, and
    // they are named in a STATIC `<script type="importmap">` that has to be in
    // the document before any module loads — so there is no moment at which the
    // shell could append a token to them. Requiring one would mean rewriting the
    // importmap server-side and re-deriving the CSP script hashes over it, to
    // protect bytes that reveal nothing about anybody's project.
    //
    // Everything tenant-specific — the shell, the built module, the design
    // system's CSS, every asset — still requires the capability below.
    const isVendorRuntime = rest.startsWith('/_canvas-runtime/');
    // The capability, from the URL the shell wrote or — for the URLs the shell
    // did NOT write, which is every asset the tenant's own canvas references —
    // from the host-scoped cookie the shell document planted. See
    // CANVAS_CAPABILITY_COOKIE for why the second one exists.
    const urlToken = url.searchParams.get('t');
    const verdict = isVendorRuntime ? { ok: true } : (verifyToken(urlToken) ?? { ok: false });
    const cookieVerdict =
      !isVendorRuntime && !verdict?.ok
        ? verifyToken(cookieFrom(request, CANVAS_CAPABILITY_COOKIE))
        : null;
    if (!verdict?.ok && !cookieVerdict?.ok) {
      refuse(response, 401, { error: 'this canvas link has expired — reload the project' });
      return true;
    }
    // Plant it on the shell document, and only there. Every other response on
    // this origin is a subresource of a shell that already carries one, so a
    // Set-Cookie on any of them would be noise — and the narrower the surface
    // that mints an ambient credential, the easier it is to reason about.
    if (!isVendorRuntime && verdict?.ok && urlToken && isCanvasShellPath(rest)) {
      const secure = (env.MAUDE_PUBLIC_CANVAS_ORIGIN ?? '').startsWith('https://');
      response.setHeader('set-cookie', [
        `${CANVAS_CAPABILITY_COOKIE}=${encodeURIComponent(urlToken)}; Path=/; HttpOnly; ` +
          `SameSite=Lax; Max-Age=${canvasCookieMaxAge}${secure ? '; Secure' : ''}`,
      ]);
    }
    const up = canvasUpstream?.();
    if (!up?.ok || !up.port) {
      response.writeHead(503, { 'cache-control': 'no-store', 'retry-after': '2' });
      response.end();
      return true;
    }
    await forward({
      request,
      response,
      port: up.port,
      path: `${rest}${url.search}`,
      headers: upstreamHeaders(request.headers, {
        // The canvas origin is READ ONLY by construction — the studio's own
        // canvas listener serves a hard allowlist and nothing on it writes. The
        // role travels anyway so the studio's gate has the same answer at both
        // doors; `viewer` is the floor, whoever is looking.
        role: 'viewer',
        user: null,
        sessionKey: null,
        publicUrl: env.MAUDE_PUBLIC_CANVAS_ORIGIN ?? null,
      }),
    });
    return true;
  }

  /**
   * WebSocket upgrades.
   *
   * The studio's live surfaces — the inspector feed and the per-canvas collab
   * rooms — are WebSockets, so a proxy that only speaks HTTP delivers a studio
   * whose panels never update. Same gate: session first, manifest second.
   */
  function handleUpgrade({ request, socket, head, session }) {
    if (!session?.role) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }
    const up = upstream();
    if (!up?.ok) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }
    forwardUpgrade({
      request,
      socket,
      head,
      port: up.port,
      headers: upstreamHeaders(request.headers, {
        role: session.role,
        user: session.email,
        sessionKey: session.sessionKey,
        publicUrl,
      }),
    });
    return true;
  }

  return { handle, handleCanvas, handleUpgrade };
}

/** Straight byte pipe to loopback. Streams both ways — the asset lane moves
 *  100 MB clips and buffering them here would put a tenant's video in the
 *  proxy's heap. */
function defaultForward({ request, response, port, path, headers }) {
  return new Promise((resolve) => {
    const upstreamReq = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: request.method,
        path: path ?? request.url,
        headers,
      },
      (upstreamRes) => {
        response.writeHead(
          upstreamRes.statusCode ?? 502,
          filterResponseHeaders(upstreamRes.headers)
        );
        upstreamRes.pipe(response);
        upstreamRes.on('end', resolve);
        upstreamRes.on('error', () => {
          response.destroy();
          resolve();
        });
      }
    );
    upstreamReq.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'the project server is not answering' }));
      } else {
        response.destroy();
      }
      resolve();
    });
    request.pipe(upstreamReq);
    request.on('error', () => {
      upstreamReq.destroy();
      resolve();
    });
  });
}

function filterResponseHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

/** Raw socket splice for the WS handshake. */
function defaultForwardUpgrade({ request, socket, head, port, headers }) {
  const upstreamSocket = netConnect(port, '127.0.0.1', () => {
    const lines = [`GET ${request.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
    // Re-add the hop-by-hop headers the handshake IS.
    lines.push('Connection: Upgrade');
    lines.push(`Upgrade: ${request.headers.upgrade ?? 'websocket'}`);
    upstreamSocket.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  upstreamSocket.on('error', () => socket.destroy());
  socket.on('error', () => upstreamSocket.destroy());
}
