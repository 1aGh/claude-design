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

// ------------------------------------------------------------ method routing

test('unknown /admin/api path returns 404 (auth still required)', async () => {
  const res = await api('/totally-unknown', { headers: auth() });
  assert.equal(res.status, 404);
});

test('/health remains reachable independent of admin auth', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(res.status, 200);
});
