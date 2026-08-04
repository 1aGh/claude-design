// /health endpoint returns the documented JSON shape.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { createHub, gitLockState, STALE_GIT_LOCK_MS } from '../src/server.mjs';
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
  // dataDir is a server filesystem path — deliberately OMITTED from the
  // unauthenticated /health payload (recon over-share; security review).
  // It stays in the authenticated /admin/api/status response.
  assert.equal(body.dataDir, undefined);
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

// ------------------------------------------------ D5: the stuck git lock

test('a stale index.lock is reported as a fact, and does not take the cell down', () => {
  // `index.lock` left behind by a killed git process means every subsequent
  // commit fails: the cell keeps serving, the customer keeps working, and
  // nothing is being SAVED. The tell is age — a lock a second old is a commit
  // happening, a lock ten minutes old is a commit that never will.
  const repo = mkdtempSync(join(tmpdir(), 'maude-hub-lock-'));
  try {
    assert.deepEqual(gitLockState(repo), { present: false });

    mkdirSync(join(repo, '.git'), { recursive: true });
    writeFileSync(join(repo, '.git', 'index.lock'), '');

    const fresh = gitLockState(repo);
    assert.equal(fresh.present, true);
    assert.equal(fresh.stale, false, 'a lock written just now is an operation in flight');

    const old = gitLockState(repo, { now: () => Date.now() + STALE_GIT_LOCK_MS + 1000 });
    assert.equal(old.stale, true);
    assert.ok(old.ageMs > STALE_GIT_LOCK_MS);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
