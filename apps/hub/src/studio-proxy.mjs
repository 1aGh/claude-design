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

import { isReadOnlyRole } from './role-matrix.mjs';
import { decide } from './studio-manifest.mjs';

/** Headers a client must never be able to speak. See property 2 above. */
export const INJECTED_HEADER_PREFIX = 'x-maude-';

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
    const verdict = isVendorRuntime ? { ok: true } : verifyToken(url.searchParams.get('t'));
    if (!verdict?.ok) {
      refuse(response, 401, { error: 'this canvas link has expired — reload the project' });
      return true;
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
