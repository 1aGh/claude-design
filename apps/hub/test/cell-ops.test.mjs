// Platform-facing cell operations — Cloud Phase 20 (export) + 19 (mirror).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { fetchMirrorConfig, handleExportRoute, scheduleMirror } from '../src/cell-ops.mjs';
import { accessClaims, signAccessToken } from '../src/cloud-identity.mjs';
import { createGitRunner } from '../src/git-runner.mjs';

const SECRET = 'derived-cell-secret';
const TENANT = 'alligators';

const scratch = [];
after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

/** A real repo with one commit — the export refuses an empty one by design. */
function repoWithHistory() {
  const dir = mkdtempSync(join(tmpdir(), 'cell-ops-'));
  scratch.push(dir);
  const git = (...args) =>
    execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  git('add', '.');
  git('commit', '-m', 'first');
  return dir;
}

function ownerToken(role = 'owner') {
  return signAccessToken(accessClaims({ email: 'o@example.com', project: TENANT, role }), SECRET);
}

function jsonSink() {
  const out = {};
  return {
    out,
    respondJson: (status, payload) => {
      out.status = status;
      out.payload = payload;
    },
  };
}

const ENV = {
  MAUDE_TENANT_ID: TENANT,
  HUB_SECRET: SECRET,
  MAUDE_S3_ENDPOINT: 'https://r2.example.com',
  MAUDE_S3_BUCKET: 'bucket',
  MAUDE_S3_ACCESS_KEY_ID: 'key',
  MAUDE_S3_SECRET_ACCESS_KEY: 'secret',
  MAUDE_S3_REGION: 'auto',
};

test('the export refuses everyone but the owner — member, viewer, garbage, absent', async () => {
  for (const auth of [ownerToken('member'), ownerToken('viewer'), 'nonsense', '']) {
    const sink = jsonSink();
    const handled = await handleExportRoute({
      path: '/api/export',
      method: 'POST',
      request: { headers: { authorization: auth ? `Bearer ${auth}` : '' } },
      repoDir: null,
      run: null,
      env: ENV,
      respondJson: sink.respondJson,
    });
    assert.equal(handled, true);
    assert.equal(sink.out.status, 401);
  }
});

test('an owner gets a verified bundle stored under the export prefix', async () => {
  const repoDir = repoWithHistory();
  const puts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    puts.push({ url: String(url), method: init?.method });
    return new Response('', { status: 200 });
  };
  try {
    const sink = jsonSink();
    await handleExportRoute({
      path: '/api/export',
      method: 'POST',
      request: { headers: { authorization: `Bearer ${ownerToken()}` } },
      repoDir,
      run: createGitRunner(),
      env: ENV,
      respondJson: sink.respondJson,
    });
    assert.equal(sink.out.status, 200, JSON.stringify(sink.out.payload));
    const names = sink.out.payload.files.map((f) => f.name).sort();
    assert.deepEqual(names, ['MANIFEST.md', 'assets.json', 'repo.bundle']);
    assert.match(sink.out.payload.prefix, new RegExp(`^tenants/${TENANT}/exports/`));
    assert.equal(puts.length, 3, 'each file was stored');
    for (const f of sink.out.payload.files) {
      assert.ok(f.key.startsWith(sink.out.payload.prefix));
      assert.ok(f.bytes > 0);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a storage failure yields an error, never a partial export offer', async () => {
  const repoDir = repoWithHistory();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  try {
    const sink = jsonSink();
    await handleExportRoute({
      path: '/api/export',
      method: 'POST',
      request: { headers: { authorization: `Bearer ${ownerToken()}` } },
      repoDir,
      run: createGitRunner(),
      env: ENV,
      respondJson: sink.respondJson,
    });
    assert.equal(sink.out.status, 502);
    assert.ok(!sink.out.payload.files, 'no file list on failure');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------------------------------------------------------- the mirror

test('the mirror clock stays off without a control plane — a self-hosted hub never ticks', () => {
  const handle = scheduleMirror({ repoDir: '/tmp/x', run: () => {}, env: {} });
  assert.equal(handle.enabled, false);
});

test('a tick asks the control plane, then pushes with the minted credential', async () => {
  const calls = [];
  const fetchImpl = async (url, _init) => {
    calls.push(String(url));
    if (String(url).includes('/internal/mirror-config')) {
      return Response.json({ repository: '1aGh/alligators-mirror', branch: 'main' });
    }
    if (String(url).includes('/internal/mirror-token')) {
      return Response.json({ token: 'ghs_abc', expiresAt: Date.now() + 3600_000 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const pushes = [];
  const run = async (args) => {
    pushes.push(args);
    return { code: 0, stdout: '', stderr: '' };
  };
  const handle = scheduleMirror({
    repoDir: '/repo',
    run,
    env: {
      MAUDE_CONTROL_PLANE_URL: 'https://cloud.test',
      MAUDE_TENANT_ID: TENANT,
      HUB_SECRET: SECRET,
    },
    fetchImpl,
    firstDelayMs: 10_000_000, // the test drives the tick itself
    intervalMs: 10_000_000,
  });
  assert.equal(handle.enabled, true);
  const outcome = await handle.tick();
  handle.stop();
  assert.equal(outcome.state, 'pushed');
  assert.equal(pushes.length, 1);
  const argv = pushes[0].join(' ');
  assert.match(argv, /x-access-token:ghs_abc@github\.com\/1aGh\/alligators-mirror\.git/);
  assert.ok(!/--force/.test(argv), 'append-only, always');
});

test('a cell with no mirror configured costs one lookup and does nothing', async () => {
  let pushAsked = false;
  const fetchImpl = async (url) => {
    if (String(url).includes('/internal/mirror-config')) return Response.json({ repository: null });
    pushAsked = true;
    throw new Error('should not be called');
  };
  const handle = scheduleMirror({
    repoDir: '/repo',
    run: async () => ({ code: 0, stdout: '', stderr: '' }),
    env: {
      MAUDE_CONTROL_PLANE_URL: 'https://cloud.test',
      MAUDE_TENANT_ID: TENANT,
      HUB_SECRET: SECRET,
    },
    fetchImpl,
    firstDelayMs: 10_000_000,
    intervalMs: 10_000_000,
  });
  const outcome = await handle.tick();
  handle.stop();
  assert.equal(outcome, null);
  assert.equal(pushAsked, false);
});

test('fetchMirrorConfig treats an unreachable control plane as "no mirror", never a throw', async () => {
  const out = await fetchMirrorConfig(
    { controlPlaneUrl: 'https://cloud.test', tenantId: TENANT, cellSecret: SECRET },
    {
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    }
  );
  assert.equal(out.repository, null);
});
