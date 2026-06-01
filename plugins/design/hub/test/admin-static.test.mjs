// /admin static asset serving — shell HTML + CSS + JS.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { createHub } from '../src/server.mjs';

const PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14598', 10);

let hub;
let dataDir;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-admin-static-'));
  const built = createHub({ port: PORT, dataDir, secret: 'test-secret', verbose: false });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('GET /admin returns the admin HTML shell', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
  const body = await res.text();
  assert.match(body, /<title>Maude Hub · Admin<\/title>/);
  assert.match(body, /id="invite-form"/);
  assert.match(body, /id="bootstrap-form"/);
});

test('GET /admin?key=... still returns the shell (key is consumed client-side)', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin?key=anything`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
});

test('GET /admin/ canonicalizes to /admin (301, relative Location)', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/`, { redirect: 'manual' });
  assert.equal(res.status, 301);
  // Relative Location so the redirect survives a path-stripping reverse proxy
  // (../admin resolves to <prefix>/admin from the browser's <prefix>/admin/).
  assert.equal(res.headers.get('location'), '../admin');
  // Sanity: the browser resolves it to the canonical no-slash path at the root.
  assert.equal(new URL(res.headers.get('location'), 'http://h/admin/').pathname, '/admin');
});

test('GET /admin/style.css returns CSS', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/style.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/css/);
  const body = await res.text();
  assert.match(body, /--accent:/);
});

test('GET /admin/app.js returns JavaScript', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/app.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/javascript/);
  const body = await res.text();
  assert.match(body, /maude-hub-secret/);
});
