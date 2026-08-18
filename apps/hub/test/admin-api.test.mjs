// /admin/api/* JSON routes — auth (Bearer + ?secret + bootstrap key),
// status, tokens (list / generate / rotate), peers, bootstrap (claim).

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { readAdminSecret } from '../src/admin-auth.mjs';
import { issueBootstrap } from '../src/bootstrap.mjs';
import { createHub } from '../src/server.mjs';

// Each test allocates BASE_PORT + counter. Range 14600–14699 keeps us clear
// of cli/commands/design-link.test.mjs (14396) + cli/commands/hub.test.mjs.
const BASE_PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14600', 10);
const SECRET = 'test-admin-secret';

let hub;
let dataDir;
let PORT;
let portCounter = 0;

beforeEach(async () => {
  // Each test gets its own port so fetch's keep-alive pool can't carry a
  // stale socket from the previous hub instance into the next one
  // (ECONNRESET symptom when re-using BASE_PORT across afterEach/beforeEach).
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-admin-api-'));
  const built = createHub({
    port: PORT,
    dataDir,
    secret: SECRET,
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

function api(path, init = {}) {
  return fetch(`http://127.0.0.1:${PORT}/admin/api${path}`, init);
}

function auth(extra = {}) {
  return { Authorization: `Bearer ${SECRET}`, ...extra };
}

// --------------------------------------------------------------------- auth

test('GET /admin/api/status without auth returns 401', async () => {
  const res = await api('/status');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'unauthorized');
});

test('GET /admin/api/status with Bearer token returns the payload', async () => {
  const res = await api('/status', { headers: auth() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.port, PORT);
  assert.equal(body.authMode, 'env-secret');
  assert.equal(body.peersCount, 0);
});

test('?secret=... query string is REJECTED (DDR-053 §1 — Bearer-only)', async () => {
  const res = await api(`/status?secret=${encodeURIComponent(SECRET)}`);
  assert.equal(res.status, 401);
});

test('wrong Bearer token returns 401', async () => {
  const res = await api('/status', { headers: { Authorization: 'Bearer wrong' } });
  assert.equal(res.status, 401);
});

// ------------------------------------------------------------------- tokens

test('POST /admin/api/token mints a token + returns ready-to-paste command', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.label, 'alice');
  assert.match(body.token, /^mau_[0-9a-f]{32}$/);
  assert.equal(
    body.command,
    `maude design link https://hub.example.com:${PORT} --token=${body.token}`
  );
});

test('POST /admin/api/token rejects empty label with 400', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: '' }),
  });
  assert.equal(res.status, 400);
});

test('GET /admin/api/tokens lists labels + metadata, never raw values', async () => {
  await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'bob' }),
  });
  const res = await api('/tokens', { headers: auth() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tokens.length, 2);
  for (const t of body.tokens) {
    assert.ok(t.label);
    assert.equal(typeof t.createdAt, 'number');
    assert.equal(t.lastUsedAt, null);
    assert.equal(t.value, undefined, 'token value must never appear in /tokens list');
  }
});

test('POST /admin/api/token/rotate replaces the value but keeps the label', async () => {
  const first = await (
    await api('/token', {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'alice' }),
    })
  ).json();

  const rotated = await (
    await api('/token/rotate', {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'alice' }),
    })
  ).json();

  assert.equal(rotated.label, 'alice');
  assert.notEqual(rotated.token, first.token);
});

test('POST /admin/api/token/rotate for unknown label returns 404', async () => {
  const res = await api('/token/rotate', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'never-existed' }),
  });
  assert.equal(res.status, 404);
});

// -------------------------------------------------------------------- peers

test('GET /admin/api/peers returns empty list initially', async () => {
  const res = await api('/peers', { headers: auth() });
  const body = await res.json();
  assert.deepEqual(body, { peers: [] });
});

// ---------------------------------------------------------------- bootstrap

test('POST /admin/api/bootstrap consumes a valid key + returns admin secret', async () => {
  const rec = issueBootstrap(dataDir);
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: rec.key }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.secret, /^[0-9a-f]{64}$/);
  // Side-effect: admin.json now exists with the returned secret.
  assert.equal(readAdminSecret(dataDir), body.secret);
});

test('POST /admin/api/bootstrap rejects an invalid key with 401', async () => {
  issueBootstrap(dataDir);
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'wrong' }),
  });
  assert.equal(res.status, 401);
});

test('POST /admin/api/bootstrap replay (consumed key) returns 401', async () => {
  const rec = issueBootstrap(dataDir);
  await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: rec.key }),
  });
  const replay = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: rec.key }),
  });
  assert.equal(replay.status, 401);
});

test('admin.json secret authenticates /admin/api/* (no env HUB_SECRET needed)', async () => {
  // The default beforeEach hub uses HUB_SECRET. Drive admin.json directly
  // and verify the file-based secret also unlocks the routes.
  const rec = issueBootstrap(dataDir);
  const claim = await (
    await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: rec.key }),
    })
  ).json();

  const res = await api('/status', { headers: { Authorization: `Bearer ${claim.secret}` } });
  assert.equal(res.status, 200);
});

// ----------------------------------------------------------------- canvases

test('GET /admin/api/canvases without auth returns 401', async () => {
  const res = await api('/canvases');
  assert.equal(res.status, 401);
});

test('GET /admin/api/canvases returns a (flat) canvases list — empty initially', async () => {
  const res = await api('/canvases', { headers: auth() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.canvases), 'canvases must be an array');
  assert.equal(body.canvases.length, 0);
});

// ----------------------------------------------------------------- activity

test('GET /admin/api/activity without auth returns 401', async () => {
  const res = await api('/activity');
  assert.equal(res.status, 401);
});

test('GET /admin/api/activity reflects a token-generate event — and never leaks the token value', async () => {
  const minted = await (
    await api('/token', {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'carol', scope: '*' }),
    })
  ).json();

  const res = await api('/activity', { headers: auth() });
  assert.equal(res.status, 200);
  const raw = JSON.stringify(await res.clone().json());
  const body = await res.json();
  assert.ok(Array.isArray(body.activity));
  const tokenEvent = body.activity.find((e) => e.type === 'token');
  assert.ok(tokenEvent, 'expected a token-generate activity event');
  assert.equal(tokenEvent.user, 'carol');
  // No-secret-leak: the minted token value must NOT appear anywhere in the feed.
  assert.ok(!raw.includes(minted.token), 'activity feed must not contain the token value');
});

test('GET /admin/api/activity reflects a rotate event with the kicked-session count', async () => {
  await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  await api('/token/rotate', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'alice' }),
  });
  const body = await (await api('/activity', { headers: auth() })).json();
  const warn = body.activity.find((e) => e.type === 'warn' && /rotated/.test(e.doc));
  assert.ok(warn, 'expected a rotate activity event');
  assert.match(warn.doc, /0 sessions kicked/);
});

// ----------------------------------------------------------------- settings

test('GET /admin/api/settings without auth returns 401', async () => {
  const res = await api('/settings');
  assert.equal(res.status, 401);
});

test('GET /admin/api/settings returns identity defaults', async () => {
  const res = await api('/settings', { headers: auth() });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Studio Hub');
  assert.equal(body.publicUrl, `https://hub.example.com:${PORT}`);
  assert.equal(typeof body.dataDir, 'string');
  assert.equal(typeof body.version, 'string');
});

test('POST /admin/api/settings round-trips name + description', async () => {
  const res = await api('/settings', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Acme Hub', description: 'team sync' }),
  });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.ok, true);
  assert.equal(saved.name, 'Acme Hub');
  // Persisted: a subsequent GET reflects it.
  const after = await (await api('/settings', { headers: auth() })).json();
  assert.equal(after.name, 'Acme Hub');
  assert.equal(after.description, 'team sync');
});

test('POST /admin/api/settings rejects an invalid hub name with 400', async () => {
  const res = await api('/settings', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '<script>alert(1)</script>' }),
  });
  assert.equal(res.status, 400);
});

// ------------------------------------------------------ admin-secret rotate

test('POST /admin/api/admin-secret/rotate invalidates the old admin.json secret', async () => {
  // Claim via bootstrap to mint an admin.json secret we can watch get rotated.
  const rec = issueBootstrap(dataDir);
  const claim = await (
    await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: rec.key }),
    })
  ).json();
  const oldSecret = claim.secret;
  // It works before the rotate.
  assert.equal(
    (await api('/status', { headers: { Authorization: `Bearer ${oldSecret}` } })).status,
    200
  );

  // Rotate (authenticated with the env HUB_SECRET).
  const rotated = await api('/admin-secret/rotate', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(rotated.status, 200);
  const rotBody = await rotated.json();
  assert.equal(rotBody.ok, true);
  // The new secret is deliberately NOT echoed back.
  assert.equal(rotBody.secret, undefined);

  // The old admin.json secret no longer authenticates; the env secret still does.
  assert.equal(
    (await api('/status', { headers: { Authorization: `Bearer ${oldSecret}` } })).status,
    401
  );
  assert.equal((await api('/status', { headers: auth() })).status, 200);
});

// -------------------------------------------------------- token delete + kick

test('POST /admin/api/token/delete removes the token permanently', async () => {
  await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'temp' }),
  });
  const del = await api('/token/delete', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'temp' }),
  });
  assert.equal(del.status, 200);
  assert.equal((await del.json()).ok, true);
  // Gone from the listing.
  const list = await (await api('/tokens', { headers: auth() })).json();
  assert.ok(!list.tokens.some((t) => t.label === 'temp'), 'deleted token must not be listed');
});

test('POST /admin/api/token/delete for unknown label returns 404', async () => {
  const res = await api('/token/delete', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'never-existed' }),
  });
  assert.equal(res.status, 404);
});

test('POST /admin/api/token/delete without auth returns 401', async () => {
  const res = await api('/token/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'x' }),
  });
  assert.equal(res.status, 401);
});

test('POST /admin/api/peers/kick for an unknown socketId returns 404', async () => {
  const res = await api('/peers/kick', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ socketId: 'nope' }),
  });
  assert.equal(res.status, 404);
});

test('POST /admin/api/peers/kick without auth returns 401', async () => {
  const res = await api('/peers/kick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ socketId: 'x' }),
  });
  assert.equal(res.status, 401);
});

// ------------------------------------------------------------- root landing

test('GET / serves the minimal landing (not the Hocuspocus default)', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
  const body = await res.text();
  assert.match(body, /Open admin console/);
  assert.doesNotMatch(body, /Welcome to Hocuspocus/);
});

// ------------------------------------------------------------ method routing

test('unknown /admin/api path returns 404 (auth still required)', async () => {
  const res = await api('/totally-unknown', { headers: auth() });
  assert.equal(res.status, 404);
});

test('/health remains reachable independent of admin auth', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(res.status, 200);
});

// ---------------------------------------------------- OIDC linking dispatch

test('POST /admin/api/oidc/link REACHES the handler (not a 404)', async () => {
  // The B1-b regression: /oidc/* must be dispatched into handleUserAdminRoutes.
  // It 404'd once because server.mjs only routed /users and /invites there,
  // which left linking unreachable and strict un-bootable. A 400 (no such user)
  // proves the handler ran; a 404 is the bug.
  const create = await api('/users', {
    method: 'POST',
    headers: auth({ 'content-type': 'application/json' }),
    body: JSON.stringify({ email: 'alice@acme.com', password: 'correct horse battery' }),
  });
  assert.equal(create.status, 201);

  const link = await api('/oidc/link', {
    method: 'POST',
    headers: auth({ 'content-type': 'application/json' }),
    body: JSON.stringify({ email: 'alice@acme.com', sub: 'auth0|alice' }),
  });
  assert.notEqual(link.status, 404, 'the /oidc/link route is not dispatched');
  assert.equal(link.status, 200);

  const pending = await api('/oidc/pending', { headers: auth() });
  assert.equal(pending.status, 200);
});

test('the OIDC admin routes still require the bearer', async () => {
  const res = await api('/oidc/pending');
  assert.equal(res.status, 401);
});
