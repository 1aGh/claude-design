// /health endpoint returns the documented JSON shape.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { createHub } from '../src/server.mjs';
import { addToken } from '../src/tokens.mjs';

const PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14392', 10);

let hub;
let dataDir;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-health-'));
  const built = createHub({ port: PORT, dataDir, secret: '', verbose: false });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('GET /health returns JSON with expected fields', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');

  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.version, 'string');
  assert.equal(typeof body.uptimeMs, 'number');
  assert.ok(body.uptimeMs >= 0);
  assert.equal(body.port, PORT);
  assert.equal(body.dataDir, dataDir);
  assert.equal(body.tokenCount, 0);
  assert.equal(body.authMode, 'dev');
});

test('tokenCount + authMode reflect token store state', async () => {
  addToken(dataDir, { label: 'alice' });
  addToken(dataDir, { label: 'bob' });

  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  const body = await res.json();
  assert.equal(body.tokenCount, 2);
  assert.equal(body.authMode, 'tokens');
});

test('uptimeMs grows monotonically across two probes', async () => {
  const a = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  await new Promise((r) => setTimeout(r, 25));
  const b = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  assert.ok(b.uptimeMs > a.uptimeMs, `expected ${b.uptimeMs} > ${a.uptimeMs}`);
});
