// Phase 23 B2/B6 — removals reach live sessions; strict retires local doors.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { handleAuthRoutes } from '../src/auth-routes.mjs';
import { fetchRevocations, scheduleRevocationSweep } from '../src/cell-ops.mjs';
import { addToken, listTokensForOwner } from '../src/tokens.mjs';

const scratch = [];
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function dataDir() {
  const dir = mkdtempSync(join(tmpdir(), 'revocation-'));
  scratch.push(dir);
  return dir;
}

const CP_ENV = {
  MAUDE_CONTROL_PLANE_URL: 'https://cloud.test',
  MAUDE_TENANT_ID: 'alligators',
  HUB_SECRET: 'derived-secret',
};

test('the sweep revokes a removed member’s tokens and kicks their sockets', async () => {
  const dir = dataDir();
  const { revokeTokensForOwner } = await import('../src/tokens.mjs');
  addToken(dir, { label: 'u-aaaaaaaaaaaa', scope: '*', owner: 'gone@example.com' });
  addToken(dir, { label: 'u-bbbbbbbbbbbb', scope: '*', owner: 'stays@example.com' });

  const kicked = [];
  const fetchImpl = async (url) => {
    assert.match(String(url), /\/internal\/revocations\?tenant=alligators&since=\d+/);
    return new Response(
      JSON.stringify({ revocations: [{ email: 'Gone@Example.com', at: Date.now() }] }),
      { headers: { 'content-type': 'application/json' } }
    );
  };
  const sweep = scheduleRevocationSweep({
    dataDir: dir,
    revokeForOwner: revokeTokensForOwner,
    kickLabel: (label) => kicked.push(label),
    env: CP_ENV,
    fetchImpl,
    log: { log() {}, error() {} },
  });
  assert.equal(sweep.enabled, true);
  const result = await sweep.tick();
  sweep.stop();

  assert.deepEqual(result, { seen: 1, revoked: 1 });
  assert.deepEqual(kicked, ['u-aaaaaaaaaaaa']);
  assert.equal(listTokensForOwner(dir, 'gone@example.com').length, 0, 'removed member has none');
  assert.equal(listTokensForOwner(dir, 'stays@example.com').length, 1, 'nobody else touched');

  // Idempotent: the same answer again revokes nothing further.
  const again = await sweep.tick();
  assert.deepEqual(again, { seen: 1, revoked: 0 });
});

test('a self-hosted hub (no control plane) never ticks', () => {
  const sweep = scheduleRevocationSweep({
    dataDir: dataDir(),
    revokeForOwner: () => [],
    env: {},
  });
  assert.equal(sweep.enabled, false);
});

test('fetchRevocations swallows outages into an empty sweep', async () => {
  const out = await fetchRevocations(
    { controlPlaneUrl: 'https://cloud.test', tenantId: 'x', cellSecret: 's', since: 0 },
    {
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    }
  );
  assert.deepEqual(out.revocations, []);
});

// ---- B6: strict cloud identity retires the hub-local doors ----------------

async function callAuth(dir, { method, path, body }) {
  const out = {};
  const handled = await handleAuthRoutes({
    request: { headers: {} },
    response: {},
    path,
    method,
    dataDir: dir,
    secret: 'hub-secret',
    respondJson: (status, payload) => {
      out.status = status;
      out.payload = payload;
    },
    readJsonBody: async () => body ?? {},
    kickLabel: () => 0,
    pushActivity: () => {},
  });
  return { handled, ...out };
}

test('strict: /join answers with directions to the dashboard, never a redemption', async () => {
  const dir = dataDir();
  process.env.MAUDE_CLOUD_IDENTITY = 'strict';
  process.env.MAUDE_TENANT_ID = 'alligators';
  try {
    for (const [method, path] of [
      ['GET', '/join/some-invite-value'],
      ['POST', '/join'],
    ]) {
      const res = await callAuth(dir, { method, path, body: { token: 'x' } });
      assert.equal(res.handled, true);
      assert.equal(res.status, 410);
      assert.match(res.payload.error, /Maude Cloud dashboard/);
    }
  } finally {
    delete process.env.MAUDE_CLOUD_IDENTITY;
    delete process.env.MAUDE_TENANT_ID;
  }
});

test('hybrid: /join keeps working — retirement is strict-only', async () => {
  const dir = dataDir();
  process.env.MAUDE_CLOUD_IDENTITY = '1';
  process.env.MAUDE_TENANT_ID = 'alligators';
  try {
    const res = await callAuth(dir, { method: 'GET', path: '/join/nonsense-value' });
    assert.equal(res.handled, true);
    // A bad invite is refused as a bad INVITE (410 with an invite reason), not
    // as a retired door.
    assert.equal(res.status, 410);
    assert.doesNotMatch(res.payload.error ?? '', /dashboard/);
  } finally {
    delete process.env.MAUDE_CLOUD_IDENTITY;
    delete process.env.MAUDE_TENANT_ID;
  }
});
