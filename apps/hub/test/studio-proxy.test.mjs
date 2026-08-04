// Cloud Phase 27 A2/A3/A4 — the proxy is the authority, and it fails closed.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { mintRenderToken, verifyRenderToken } from '../src/render-token.mjs';
import {
  createStudioProxy,
  INJECTED_HEADER_PREFIX,
  sessionKeyFor,
  upstreamHeaders,
} from '../src/studio-proxy.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

function fakeResponse() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    headersSent: false,
    // Set BEFORE writeHead and merged by Node at write time — how the canvas
    // origin plants its capability cookie on the shell document without
    // reaching into the forwarder.
    preset: {},
    setHeader(name, value) {
      this.preset[String(name).toLowerCase()] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(body) {
      if (body) this.body = body;
    },
    destroy() {
      this.destroyed = true;
    },
  };
}

function makeProxy({ ok = true, port = 4399, ...rest } = {}) {
  const forwarded = [];
  const proxy = createStudioProxy({
    upstream: () => ({ ok, port }),
    canvasUpstream: () => ({ ok, port: port + 1 }),
    publicUrl: 'https://alligators.cloud.maude.sh',
    hash: sha,
    forward: async (args) => {
      forwarded.push(args);
      args.response.writeHead(200, {});
      args.response.end('ok');
    },
    forwardUpgrade: (args) => forwarded.push({ upgrade: true, ...args }),
    ...rest,
  });
  return { proxy, forwarded };
}

// ---------------------------------------------------------------- A4: closed

test('no session refuses before it reveals anything about the route table', async () => {
  const { proxy, forwarded } = makeProxy();
  const response = fakeResponse();
  await proxy.handle({
    request: { headers: {}, url: '/_config' },
    response,
    pathname: '/_config',
    method: 'GET',
    session: null,
  });
  assert.equal(response.statusCode, 401);
  assert.equal(forwarded.length, 0);
  // Same answer for a route that does not exist — an unauthenticated caller
  // must not be able to tell the difference.
  const r2 = fakeResponse();
  await proxy.handle({
    request: { headers: {}, url: '/_api/nope' },
    response: r2,
    pathname: '/_api/nope',
    method: 'GET',
    session: null,
  });
  assert.equal(r2.statusCode, 401);
});

test('a session with no role is not a session', async () => {
  const { proxy } = makeProxy();
  const response = fakeResponse();
  await proxy.handle({
    request: { headers: {}, url: '/_config' },
    response,
    pathname: '/_config',
    method: 'GET',
    session: { email: 'a@b.c' },
  });
  assert.equal(response.statusCode, 401);
});

test('every mutating route 403s for a viewer, with the promised sentence', async () => {
  const { proxy, forwarded } = makeProxy();
  for (const [method, path] of [
    ['POST', '/_api/edit-text'],
    ['POST', '/_api/insert-element'],
    ['PUT', '/_api/annotations'],
    ['POST', '/_api/git/commit'],
    ['POST', '/_api/asset'],
  ]) {
    const response = fakeResponse();
    await proxy.handle({
      request: { headers: {}, url: path },
      response,
      pathname: path,
      method,
      session: { email: 'v@b.c', role: 'viewer' },
    });
    assert.equal(response.statusCode, 403, `${method} ${path} was not refused`);
    assert.match(JSON.parse(response.body).error, /look at this project, comment and download/);
  }
  assert.equal(forwarded.length, 0);
});

test('an unclassified route is 404, not 403 — a refusal is a map', async () => {
  const { proxy } = makeProxy();
  const response = fakeResponse();
  await proxy.handle({
    request: { headers: {}, url: '/_api/next-phases-route' },
    response,
    pathname: '/_api/next-phases-route',
    method: 'POST',
    session: { email: 'o@b.c', role: 'owner' },
  });
  assert.equal(response.statusCode, 404);
});

test('a dead upstream is 503 with a retry, never a 500', async () => {
  const { proxy } = makeProxy({ ok: false });
  const response = fakeResponse();
  await proxy.handle({
    request: { headers: {}, url: '/_config' },
    response,
    pathname: '/_config',
    method: 'GET',
    session: { email: 'o@b.c', role: 'owner' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['retry-after'], '2');
  assert.match(JSON.parse(response.body).error, /Your work is safe/);
});

// ------------------------------------------------------- A3: the role travels

test('the vouched role is injected on every forwarded request', async () => {
  const { proxy, forwarded } = makeProxy();
  await proxy.handle({
    request: { headers: {}, url: '/_config' },
    response: fakeResponse(),
    pathname: '/_config',
    method: 'GET',
    session: { email: 'm@b.c', role: 'member', sessionKey: 'abc123' },
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'member');
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}user`], 'm@b.c');
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}session`], 'abc123');
});

test('a client CANNOT speak the injected headers', () => {
  const out = upstreamHeaders(
    {
      'x-maude-role': 'owner',
      'X-Maude-Role': 'owner',
      'x-maude-session': 'someone-elses',
      'x-maude-user': 'ceo@company.com',
      accept: 'text/html',
    },
    { role: 'viewer', user: 'v@b.c', sessionKey: 'mine', publicUrl: 'https://p.example' }
  );
  assert.equal(out['x-maude-role'], 'viewer');
  assert.equal(out['x-maude-user'], 'v@b.c');
  assert.equal(out['x-maude-session'], 'mine');
  assert.equal(out.accept, 'text/html');
  // Nothing survived with an owner value under any casing.
  assert.equal(Object.entries(out).filter(([, v]) => v === 'owner').length, 0);
});

test('hop-by-hop headers are not forwarded', () => {
  const out = upstreamHeaders(
    {
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      'content-type': 'application/json',
    },
    { role: 'owner', publicUrl: null }
  );
  assert.equal(out.connection, undefined);
  assert.equal(out['transfer-encoding'], undefined);
  assert.equal(out['content-type'], 'application/json');
});

// --------------------------------------------------------- D4: public identity

test('the Host the studio sees comes from configuration, not from the request', () => {
  const out = upstreamHeaders(
    { host: 'internal-tunnel-7f3a.cfargotunnel.com' },
    { role: 'owner', publicUrl: 'https://alligators.cloud.maude.sh' }
  );
  assert.equal(out.host, 'alligators.cloud.maude.sh');
});

test('a foreign Host header cannot reach the studio even unconfigured', () => {
  const out = upstreamHeaders({ host: 'evil.example' }, { role: 'owner', publicUrl: null });
  assert.equal(out.host, undefined);
});

// ------------------------------------------------------------ D3: the session

test('the session key is stable, per-member, and says nothing', () => {
  const a = sessionKeyFor('alligators', 'a@b.c', sha);
  const b = sessionKeyFor('alligators', 'other@b.c', sha);
  assert.equal(a, sessionKeyFor('alligators', 'a@b.c', sha));
  assert.notEqual(a, b);
  assert.equal(a.length, 16);
  assert.ok(!a.includes('@'), 'a filename-bound key must not carry an address');
});

// -------------------------------------------------------- the canvas lane

test('the canvas lane is read-only and capability-gated', async () => {
  const { proxy, forwarded } = makeProxy();
  const post = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html' },
    response: post,
    pathname: '/_canvas-shell.html',
    method: 'POST',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(post.statusCode, 405);

  const bad = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html' },
    response: bad,
    pathname: '/_canvas-shell.html',
    method: 'GET',
    verifyToken: () => ({ ok: false }),
  });
  assert.equal(bad.statusCode, 401);
  assert.equal(forwarded.length, 0);

  const good = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html?t=x' },
    response: good,
    pathname: '/_canvas-shell.html',
    method: 'GET',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'viewer');
});

test('the canvas lane strips the prefix its ORIGIN carries, and refuses another', async () => {
  // The fleet's shared `canvas.<zone>` hostname puts the tenant in the path.
  const { proxy, forwarded } = makeProxy();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/alligators/_canvas-runtime/react.js?t=x' },
    response: fakeResponse(),
    pathname: '/alligators/_canvas-runtime/react.js',
    method: 'GET',
    pathPrefix: '/alligators',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(forwarded.at(-1).path, '/_canvas-runtime/react.js?t=x');

  const foreign = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/someone-else/_canvas-shell.html?t=x' },
    response: foreign,
    pathname: '/someone-else/_canvas-shell.html',
    method: 'GET',
    pathPrefix: '/alligators',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(foreign.statusCode, 404);
});

test('a per-tenant canvas origin has NO path prefix, and is not made to have one', async () => {
  // The regression this pins: deriving the prefix from MAUDE_TENANT_ID, which
  // exists in BOTH deployment shapes. It made every canvas request 404 on a
  // per-tenant origin — the shell, the module, the runtime and every asset —
  // i.e. exactly the grey boxes this phase exists to fix.
  const { proxy, forwarded } = makeProxy({ env: { MAUDE_TENANT_ID: 'alligators' } });
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html?t=x' },
    response: fakeResponse(),
    pathname: '/_canvas-shell.html',
    method: 'GET',
    pathPrefix: '',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(forwarded.at(-1).path, '/_canvas-shell.html?t=x');
});

// ------------------------------------------------------------- WS upgrades

test('an unauthenticated upgrade is closed, not upgraded', () => {
  const { proxy, forwarded } = makeProxy();
  const written = [];
  const socket = { write: (s) => written.push(s), destroy() {}, on() {} };
  proxy.handleUpgrade({ request: { headers: {}, url: '/_ws' }, socket, head: null, session: null });
  assert.match(written.join(''), /401/);
  assert.equal(forwarded.length, 0);
});

test('an authenticated upgrade carries the role', () => {
  const { proxy, forwarded } = makeProxy();
  proxy.handleUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/_ws' },
    socket: { write() {}, destroy() {}, on() {} },
    head: null,
    session: { email: 'm@b.c', role: 'member', sessionKey: 'k' },
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'member');
});

test('vendor runtime bundles need no capability; tenant content always does', async () => {
  // The importmap that names them is static and must precede any module load,
  // so there is no moment at which a token could be appended. They are our own
  // React/motion builds, identical for every tenant.
  const { proxy, forwarded } = makeProxy();
  const ok = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-runtime/react.js' },
    response: ok,
    pathname: '/_canvas-runtime/react.js',
    method: 'GET',
    verifyToken: () => ({ ok: false }),
  });
  assert.equal(forwarded.length, 1, 'a vendor bundle must serve without a capability');

  // …and nothing else gets that exemption.
  for (const p of ['/_canvas-shell.html', '/.design/ui/Home.tsx', '/assets/deadbeef.png']) {
    const r = fakeResponse();
    await proxy.handleCanvas({
      request: { headers: {}, url: p },
      response: r,
      pathname: p,
      method: 'GET',
      verifyToken: () => ({ ok: false }),
    });
    assert.equal(r.statusCode, 401, `${p} must require a capability`);
  }
});

test('the capability survives a URL the shell did not write', async () => {
  // THE BUG. Canvas code is the TENANT's source, and it says
  // `<img src="/.design/system/x/assets/logo.svg">`. That request leaves the
  // browser with no query string, because nothing in its path passes through
  // code we wrote — so every asset, font and photograph on a rendered canvas
  // came back 401 and the design was a page of empty boxes. The shell cannot
  // fix it: appending a token to an arbitrary tenant's runtime-computed URLs
  // is not a thing that can be done.
  //
  // So the shell DOCUMENT plants the same capability as a host-scoped cookie,
  // and the assets ride it. Same token, same expiry, same read-only grant —
  // the only thing that changes is which part of the request carries it.
  const valid = (t) => (t === 'cap' ? { ok: true } : { ok: false });

  // 1. The shell document, reached with a token in the URL, sets the cookie.
  const { proxy, forwarded } = makeProxy();
  const shell = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html?t=cap' },
    response: shell,
    pathname: '/_canvas-shell.html',
    method: 'GET',
    verifyToken: valid,
  });
  assert.equal(forwarded.length, 1);
  const cookie = String(shell.preset['set-cookie']);
  assert.match(cookie, /maude_canvas=cap/);
  assert.match(cookie, /HttpOnly/, 'the untrusted canvas must not be able to read it');
  assert.match(cookie, /SameSite=Strict/); // see the dedicated test below for why not Lax

  // 2. An asset with NO query string is served on the strength of that cookie.
  const asset = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: { cookie: 'maude_canvas=cap' }, url: '/.design/system/x/assets/logo.svg' },
    response: asset,
    pathname: '/.design/system/x/assets/logo.svg',
    method: 'GET',
    verifyToken: valid,
  });
  assert.equal(forwarded.length, 2, 'the asset must be forwarded, not refused');
  assert.equal(asset.statusCode, 200);

  // 3. …and a WRONG cookie is still a refusal. The cookie is not an exemption,
  //    it is a second place to present the same signed capability.
  const forged = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: { cookie: 'maude_canvas=nope' }, url: '/.design/ui/Home.tsx' },
    response: forged,
    pathname: '/.design/ui/Home.tsx',
    method: 'GET',
    verifyToken: valid,
  });
  assert.equal(forged.statusCode, 401);
});

test('only the shell document mints the cookie', async () => {
  // The narrower the surface that hands out an ambient credential, the easier
  // it is to say what holds it. Every other response on this origin is a
  // subresource of a shell that already planted one.
  const { proxy } = makeProxy();
  const asset = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/.design/ui/Home.tsx?t=cap' },
    response: asset,
    pathname: '/.design/ui/Home.tsx',
    method: 'GET',
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(asset.preset['set-cookie'], undefined);
});

// -------------------------------------- the canvas origin's live sockets
// (RCA issue-cloud-live-collaboration-dead — the lane whose absence kept
// cloud cursors, annotations and live sync dead.)

function fakeSocket() {
  const written = [];
  return {
    written,
    destroyed: false,
    write: (s) => written.push(s),
    destroy() {
      this.destroyed = true;
    },
    on() {},
  };
}

test('a canvas upgrade without a capability is closed 401, never forwarded', () => {
  const { proxy, forwarded } = makeProxy();
  const socket = fakeSocket();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/_ws/collab/ui-home' },
    socket,
    head: null,
    verifyToken: () => ({ ok: false, reason: 'missing' }),
  });
  assert.match(socket.written.join(''), /401/);
  assert.equal(socket.destroyed, true);
  assert.equal(forwarded.length, 0);
});

test('a capability in the URL opens the collab socket at the token role, canvas realm', () => {
  const { proxy, forwarded } = makeProxy();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/_ws/collab/ui-home?t=cap' },
    socket: fakeSocket(),
    head: null,
    verifyToken: (t) =>
      t === 'cap' ? { ok: true, subject: 'o@b.c', role: 'owner' } : { ok: false },
  });
  assert.equal(forwarded.length, 1);
  const f = forwarded[0];
  assert.equal(f.upgrade, true);
  // Forwarded to the CANVAS upstream, not the main studio listener.
  assert.equal(f.port, 4400);
  assert.equal(f.path, '/_ws/collab/ui-home?t=cap');
  assert.equal(f.headers[`${INJECTED_HEADER_PREFIX}role`], 'owner');
  // An owner's collab socket is writable — annotations are the point…
  assert.equal(f.headers[`${INJECTED_HEADER_PREFIX}readonly`], '0');
  assert.equal(f.headers[`${INJECTED_HEADER_PREFIX}user`], 'o@b.c');
  // …but it is still marked canvas-realm, so body lanes stay unwritable.
  assert.equal(f.headers[`${INJECTED_HEADER_PREFIX}collab-realm`], 'canvas');
});

test('the HttpOnly capability cookie opens the socket too — the WS URL carries no token', () => {
  // use-collab.tsx builds `wss://<canvas-origin>/_ws/collab/<slug>` with no
  // query string; the same-site WS connect carries the cookie the shell
  // document planted. This is the vehicle production actually rides.
  //
  // The `Origin` is now part of that vehicle, not decoration: a cookie-only
  // handshake with no Origin is refused (see the CSWSH tests below), because
  // a WS handshake bypasses the same-origin policy and carries cookies anyway.
  // A real browser always sends it, so the production path is unchanged.
  const { proxy, forwarded } = makeProxy();
  proxy.handleCanvasUpgrade({
    request: {
      headers: {
        upgrade: 'websocket',
        cookie: 'maude_canvas=cap',
        origin: 'https://alligators.cloud.maude.sh',
      },
      url: '/_ws/collab/ui-home',
    },
    socket: fakeSocket(),
    head: null,
    verifyToken: (t) =>
      t === 'cap' ? { ok: true, subject: 'v@b.c', role: 'viewer' } : { ok: false },
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'viewer');
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}readonly`], '1');
});

test('a token without a role claim opens at the viewer floor', () => {
  const { proxy, forwarded } = makeProxy();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/_ws/collab/ui-home?t=old' },
    socket: fakeSocket(),
    head: null,
    // An older token — verifyRenderToken yields role: null for it.
    verifyToken: () => ({ ok: true, subject: 'm@b.c', role: null }),
  });
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'viewer');
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}readonly`], '1');
});

test('the HMR socket (/_ws) rides the same lane; anything else on the origin is 404', () => {
  const { proxy, forwarded } = makeProxy();
  proxy.handleCanvasUpgrade({
    request: {
      headers: {
        upgrade: 'websocket',
        cookie: 'maude_canvas=cap',
        origin: 'https://alligators.cloud.maude.sh',
      },
      url: '/_ws',
    },
    socket: fakeSocket(),
    head: null,
    verifyToken: (t) =>
      t === 'cap' ? { ok: true, subject: 'v@b.c', role: 'viewer' } : { ok: false },
  });
  assert.equal(forwarded.length, 1);

  const socket = fakeSocket();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket', cookie: 'maude_canvas=cap' }, url: '/_api/asset' },
    socket,
    head: null,
    verifyToken: () => ({ ok: true }),
  });
  assert.match(socket.written.join(''), /404/);
  assert.equal(forwarded.length, 1);
});

test('the upgrade lane strips the shared-origin prefix, and refuses another tenant´s', () => {
  const { proxy, forwarded } = makeProxy();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/alligators/_ws/collab/ui-home?t=cap' },
    socket: fakeSocket(),
    head: null,
    pathPrefix: '/alligators',
    verifyToken: () => ({ ok: true, subject: 'o@b.c', role: 'owner' }),
  });
  assert.equal(forwarded.at(-1).path, '/_ws/collab/ui-home?t=cap');

  const socket = fakeSocket();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/someone-else/_ws/collab/x?t=cap' },
    socket,
    head: null,
    pathPrefix: '/alligators',
    verifyToken: () => ({ ok: true }),
  });
  assert.match(socket.written.join(''), /404/);
});

test('a dead canvas upstream closes the upgrade 503', () => {
  const { proxy } = makeProxy({ canvasUpstream: () => ({ ok: false, port: null }) });
  const socket = fakeSocket();
  proxy.handleCanvasUpgrade({
    request: { headers: { upgrade: 'websocket' }, url: '/_ws/collab/x?t=cap' },
    socket,
    head: null,
    verifyToken: () => ({ ok: true, subject: 'o@b.c', role: 'owner' }),
  });
  assert.match(socket.written.join(''), /503/);
});

test('the canvas HTTP lane vouches the member for presence, at the viewer floor', async () => {
  // /_api/git-user on the canvas listener answers with x-maude-user in a cell —
  // without this every cloud peer introduced itself as `anonymous-…`.
  const { proxy, forwarded } = makeProxy();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_api/git-user?t=cap' },
    response: fakeResponse(),
    pathname: '/_api/git-user',
    method: 'GET',
    verifyToken: (t) =>
      t === 'cap' ? { ok: true, subject: 'm@b.c', role: 'member' } : { ok: false },
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}user`], 'm@b.c');
  // The HTTP lane ignores the role claim — read-only by construction.
  assert.equal(forwarded[0].headers[`${INJECTED_HEADER_PREFIX}role`], 'viewer');
});

// ------------------------------------------------- the role claim round-trip

test('the render token carries the role; an older token verifies to role null', () => {
  const secret = 'test-secret';
  const withRole = mintRenderToken({ secret, project: 'p', subject: 'o@b.c', role: 'owner' });
  const verdict = verifyRenderToken({ secret, token: withRole, project: 'p' });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.role, 'owner');
  assert.equal(verdict.subject, 'o@b.c');

  const without = mintRenderToken({ secret, project: 'p', subject: 'v@b.c' });
  const old = verifyRenderToken({ secret, token: without, project: 'p' });
  assert.equal(old.ok, true);
  assert.equal(old.role, null);
});

test('Secure comes OFF only for a deployment that declared itself plaintext', async () => {
  // The first version derived Secure from `MAUDE_PUBLIC_CANVAS_ORIGIN`
  // starting with `https://`, so a missing / empty / scheme-less / misspelled
  // value silently dropped the flag — fail-OPEN on exactly the input whose
  // absence should fail closed. The default is now ON, and it comes off only
  // for a positively-declared plaintext deployment (the local harness, which
  // would otherwise never store the cookie and revert the whole lane to 401s).
  for (const [env, expected] of [
    [{ MAUDE_PUBLIC_CANVAS_ORIGIN: 'https://canvas-alligators.cloud.maude.sh' }, true],
    [{ MAUDE_PUBLIC_CANVAS_ORIGIN: 'http://localhost:18501' }, false],
    [{ HUB_INSECURE_HTTP: '1' }, false],
    // The fail-open cases: nothing configured, empty, or scheme-less.
    [{}, true],
    [{ MAUDE_PUBLIC_CANVAS_ORIGIN: '' }, true],
    [{ MAUDE_PUBLIC_CANVAS_ORIGIN: 'canvas-alligators.cloud.maude.sh' }, true],
  ]) {
    const { proxy } = makeProxy({ env });
    const r = fakeResponse();
    await proxy.handleCanvas({
      request: { headers: {}, url: '/_canvas-shell.html?t=cap' },
      response: r,
      pathname: '/_canvas-shell.html',
      method: 'GET',
      verifyToken: () => ({ ok: true }),
    });
    assert.equal(/; Secure/.test(String(r.preset['set-cookie'])), expected, JSON.stringify(env));
  }
});

test('the capability cookie is SameSite=Strict, and Lax is a regression', async () => {
  // WHY THIS TEST EXISTS. `Lax` shipped on the reasoning that "a genuinely
  // foreign page gets nothing" — true, and not the threat. `Lax` IS sent on a
  // cross-site top-level GET navigation, which is precisely the request class
  // the canvas origin serves, so any page anywhere could `window.open` a
  // canvas URL and the capability rode along. And "same site" is computed at
  // the REGISTRABLE DOMAIN, so on a multi-tenant `*.<zone>` platform every
  // tenant's origins, the control plane and the marketing site are all
  // same-site with each other — `SameSite` never expressed the tenant boundary
  // at all. `Strict` costs nothing: the legitimate flow is an iframe inside a
  // top-level document on the project's own shell origin, which is same-site.
  const { proxy } = makeProxy({
    env: { MAUDE_PUBLIC_CANVAS_ORIGIN: 'https://canvas-alligators.cloud.maude.sh' },
  });
  const r = fakeResponse();
  await proxy.handleCanvas({
    request: { headers: {}, url: '/_canvas-shell.html?t=cap' },
    response: r,
    pathname: '/_canvas-shell.html',
    method: 'GET',
    verifyToken: () => ({ ok: true }),
  });
  const cookie = String(r.preset['set-cookie']);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /SameSite=Lax/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\//);
});

test('the canvas collab socket refuses a foreign origin', async () => {
  // CROSS-SITE WEBSOCKET HIJACKING. A WS handshake bypasses the same-origin
  // policy and carries cookies, so the moment this lane accepts the ambient
  // capability cookie, "you cannot guess the URL" stops being the protection.
  // `SameSite` cannot express the tenant boundary — "site" is the registrable
  // domain, so every tenant, the control plane and the marketing site are
  // mutually same-site. Only an Origin check separates them.
  const env = {
    MAUDE_PUBLIC_CANVAS_ORIGIN: 'https://canvas-alligators.cloud.maude.sh',
  };
  const cases = [
    // The two legitimate origins: the canvas origin, and the tab it lives in.
    ['https://canvas-alligators.cloud.maude.sh', true],
    ['https://alligators.cloud.maude.sh', true],
    // A DIFFERENT TENANT — same site under `maude.sh`, and the whole point.
    ['https://canvas-someone-else.cloud.maude.sh', false],
    ['https://someone-else.cloud.maude.sh', false],
    // The control plane and the marketing site are same-site too.
    ['https://cloud.maude.sh', false],
    ['https://maude.sh', false],
    // Plainly foreign, and a sandboxed frame's opaque origin.
    ['https://evil.example', false],
    ['null', false],
  ];
  for (const [origin, allowed] of cases) {
    const { proxy, forwarded } = makeProxy({ env });
    const writes = [];
    const socket = { write: (s) => writes.push(String(s)), destroy() {} };
    proxy.handleCanvasUpgrade({
      request: { headers: { origin, cookie: 'maude_canvas=cap' }, url: '/_ws/collab/x' },
      socket,
      head: null,
      verifyToken: () => ({ ok: true, subject: 'v@b.c' }),
    });
    if (allowed) {
      assert.equal(forwarded.length, 1, `${origin} should have been forwarded`);
    } else {
      assert.equal(forwarded.length, 0, `${origin} must NOT reach the studio`);
      assert.match(writes.join(''), /403 Forbidden/, origin);
    }
  }
});

test('a non-browser client may omit Origin, but must then present ?t=', async () => {
  // Browsers always send Origin on a WS handshake; a CLI does not. Letting a
  // missing Origin through on the strength of a COOKIE would reopen the hole
  // by omission — a URL token is proof of intent in a way an ambient cookie
  // never is.
  const { proxy, forwarded } = makeProxy();
  const writes = [];
  proxy.handleCanvasUpgrade({
    request: { headers: { cookie: 'maude_canvas=cap' }, url: '/_ws/collab/x' },
    socket: { write: (s) => writes.push(String(s)), destroy() {} },
    head: null,
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(forwarded.length, 0, 'cookie-only, no Origin: must be refused');
  assert.match(writes.join(''), /401 Unauthorized/);

  const ok = makeProxy();
  ok.proxy.handleCanvasUpgrade({
    request: { headers: {}, url: '/_ws/collab/x?t=cap' },
    socket: { write() {}, destroy() {} },
    head: null,
    verifyToken: () => ({ ok: true }),
  });
  assert.equal(ok.forwarded.length, 1, 'explicit ?t= with no Origin: allowed');
});
