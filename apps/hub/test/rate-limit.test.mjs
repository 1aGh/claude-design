// DDR-053 §6 — per-IP rate limit on /admin/api/* (5 req / 60s).

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { createHub } from '../src/server.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14800', 10);

let hub;
let dataDir;
let PORT;
let portCounter = 0;

beforeEach(async () => {
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-ratelimit-'));
  const built = createHub({
    port: PORT,
    dataDir,
    secret: 'rl-secret',
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
    rateLimit: true,
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('5 rapid 401s on /admin/api/* trip the limiter on the 6th request', async () => {
  // Use a non-bootstrap path so we measure the 401-burst limiter.
  // First 5 requests: 401 (wrong auth). 6th: 429 (limited).
  let last;
  for (let i = 0; i < 6; i++) {
    last = await fetch(`http://127.0.0.1:${PORT}/admin/api/status`, {
      headers: { Authorization: 'Bearer wrong-secret' },
    });
  }
  assert.equal(last.status, 429, '6th 401-attempt must be rate-limited');
  assert.equal(last.headers.get('retry-after'), '60');
});

test('rapid bootstrap POSTs trip the limiter', async () => {
  let last;
  for (let i = 0; i < 6; i++) {
    last = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'wrong-key' }),
    });
  }
  assert.equal(last.status, 429);
});

test('successful authenticated requests do not trip the limiter', async () => {
  // 10 successful auth requests in a row should all return 200.
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/status`, {
      headers: { Authorization: 'Bearer rl-secret' },
    });
    assert.equal(res.status, 200, `request #${i + 1} should not be rate-limited`);
  }
});
