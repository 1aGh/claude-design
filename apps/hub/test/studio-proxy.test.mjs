// Cloud Phase 27 A2/A3/A4 — the proxy is the authority, and it fails closed.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

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
