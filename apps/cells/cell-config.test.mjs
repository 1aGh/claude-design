// The tenant mapping — Cloud Phase 24 B1.
//
// `cellEnv` is where a mistake means one tenant reading another's data, and
// until this phase it had no tests at all. It also had the platform's worst
// latent bug: the project's name, its seed repository and its first admin
// address were read from the cells-Worker's own environment — one set of
// values for the whole fleet — so customer number two's FIRST boot could clone
// customer number one's repository.
//
// Everything here runs without a container, which is the point of `cellEnv`
// being pure (DDR-196 §1).

import assert from 'node:assert/strict';
import { test } from 'node:test';

// From `cell-config.mjs`, not `cell-do.mjs`: the latter imports
// `@cloudflare/containers`, which does not resolve under plain Node. Splitting
// the decidable half out is what makes this file possible at all.
import {
  canvasOriginTenant,
  cellEnv,
  deriveSecret,
  fetchTenantConfig,
  isValidTenantId,
} from './cell-config.mjs';

const MASTER = 'a-platform-master-secret';
const baseEnv = { CELL_SECRET_MASTER: MASTER, CONTROL_PLANE_URL: 'https://cloud.test' };

function memoryStorage(initial = new Map()) {
  return {
    async get(k) {
      return initial.get(k);
    },
    async put(k, v) {
      initial.set(k, v);
    },
    _map: initial,
  };
}

// --------------------------------------------------------------- tenant ids

test('a tenant id is a hostname label, and nothing that could escape one', () => {
  assert.equal(isValidTenantId('alligators'), true);
  assert.equal(isValidTenantId('brno-alligators'), true);
  for (const bad of ['', 'UPPER', 'a_b', '-lead', 'trail-', 'a--b', '../etc', 'a'.repeat(64)]) {
    assert.equal(isValidTenantId(bad), false, `"${bad}" must not be a tenant id`);
  }
});

test('cellEnv refuses an invalid tenant rather than composing a key prefix from it', async () => {
  await assert.rejects(
    () => cellEnv({ tenantId: '../other', env: baseEnv, hostname: 'x.cloud.maude.sh' }),
    /invalid tenant id/
  );
});

// ------------------------------------------------------- per-tenant secrets

test('every tenant gets a different operator credential from one master', async () => {
  const a = await deriveSecret(MASTER, 'alligators');
  const b = await deriveSecret(MASTER, 'other-club');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  // …and a different one per purpose, so the admin bearer is not also the
  // project-token verification key.
  assert.notEqual(a, await deriveSecret(MASTER, 'alligators', 'project-token'));
});

// ------------------------------------------------- B1: nothing tenant-global

test('the seed repo comes from THIS tenant, never from a fleet-wide variable', async () => {
  const env = {
    ...baseEnv,
    // The shape of the old bug: a global that used to win for every tenant.
    MAUDE_SEED_REPO: 'https://github.com/someone-else/their-project.git',
    PROJECT_NAME: 'Somebody Else',
    PILOT_ADMIN_EMAIL: 'pilot@example.com',
  };
  const vars = await cellEnv({
    tenantId: 'second-customer',
    env,
    hostname: 'second-customer.cloud.maude.sh',
    config: { projectName: null, seedRepo: null, adminEmail: null },
  });
  assert.equal(vars.MAUDE_SEED_REPO, undefined, 'a new tenant must not clone the pilot');
  assert.equal(vars.MAUDE_PROJECT_NAME, undefined);
  assert.equal(vars.MAUDE_ADMIN_EMAIL, undefined);
  assert.equal(vars.MAUDE_TENANT_ID, 'second-customer');
});

test('with its own config, a cell gets exactly its own values', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: baseEnv,
    hostname: 'alligators.cloud.maude.sh',
    config: {
      projectName: 'Brno Alligators',
      seedRepo: 'https://github.com/1aGh/alligators.git',
      adminEmail: 'owner@example.com',
    },
  });
  assert.equal(vars.MAUDE_PROJECT_NAME, 'Brno Alligators');
  assert.equal(vars.MAUDE_SEED_REPO, 'https://github.com/1aGh/alligators.git');
  assert.equal(vars.MAUDE_ADMIN_EMAIL, 'owner@example.com');
  assert.equal(
    vars.MAUDE_ADMIN_PASSWORD,
    await deriveSecret(MASTER, 'alligators', 'initial-admin-password')
  );
  assert.equal(vars.HUB_SECRET, await deriveSecret(MASTER, 'alligators'));
  assert.equal(vars.HUB_PUBLIC_URL, 'https://alligators.cloud.maude.sh');
});

test('under strict identity no local admin is seeded, config or not', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: { ...baseEnv, CELL_IDENTITY_MODE: 'strict' },
    hostname: 'alligators.cloud.maude.sh',
    config: { projectName: 'Brno Alligators', seedRepo: null, adminEmail: 'owner@example.com' },
  });
  assert.equal(vars.MAUDE_ADMIN_EMAIL, undefined);
  assert.equal(vars.MAUDE_ADMIN_PASSWORD, undefined);
  assert.equal(vars.MAUDE_CLOUD_IDENTITY, 'strict');
});

// -------------------------------------------------------- fetching that config

test('a cell can only ask about ITSELF — the bearer is derived from the tenant asked for', async () => {
  let seen = null;
  const config = await fetchTenantConfig({
    tenantId: 'alligators',
    env: baseEnv,
    fetchImpl: async (url, init) => {
      seen = { url: String(url), auth: init.headers.authorization };
      return Response.json({ projectName: 'Brno Alligators', seedRepo: 's', adminEmail: 'o@e.c' });
    },
  });
  assert.equal(seen.url, 'https://cloud.test/internal/cell-config?tenant=alligators');
  assert.equal(seen.auth, `Bearer ${await deriveSecret(MASTER, 'alligators')}`);
  assert.equal(config.projectName, 'Brno Alligators');
});

test('an unreachable control plane falls back to THIS cell’s cache, never to a shared value', async () => {
  const storage = memoryStorage();
  await fetchTenantConfig({
    tenantId: 'alligators',
    env: baseEnv,
    storage,
    fetchImpl: async () => Response.json({ projectName: 'Brno Alligators', seedRepo: 'r' }),
  });
  const offline = await fetchTenantConfig({
    tenantId: 'alligators',
    env: baseEnv,
    storage,
    fetchImpl: async () => {
      throw new Error('control plane is down');
    },
  });
  assert.equal(offline.projectName, 'Brno Alligators');
  assert.equal(offline.seedRepo, 'r');
});

test('the offline cache is bound to its tenant — a rebound DO cannot inherit it', async () => {
  // cell-do.mjs carries a branch that rebinds a DO's tenant id. `idFromName()`
  // makes it unreachable today, but an unkeyed cache would hand the NEW tenant
  // the OLD tenant's seedRepo during a control-plane outage — B1's exact bug,
  // re-entering through the fallback that exists to be safe.
  const storage = memoryStorage();
  await fetchTenantConfig({
    tenantId: 'alligators',
    env: baseEnv,
    storage,
    fetchImpl: async () => Response.json({ projectName: 'Brno Alligators', seedRepo: 'theirs' }),
  });
  const other = await fetchTenantConfig({
    tenantId: 'second-customer',
    env: baseEnv,
    storage,
    fetchImpl: async () => {
      throw new Error('control plane is down');
    },
  });
  assert.deepEqual(other, { projectName: null, seedRepo: null, adminEmail: null });
});

test('no cache and no control plane is EMPTY — fail closed, because the fallback was the bug', async () => {
  const config = await fetchTenantConfig({
    tenantId: 'brand-new',
    env: baseEnv,
    storage: memoryStorage(),
    fetchImpl: async () => new Response('nope', { status: 503 }),
  });
  assert.deepEqual(config, { projectName: null, seedRepo: null, adminEmail: null });
});

test('an unconfigured master asks nobody anything', async () => {
  let called = false;
  const config = await fetchTenantConfig({
    tenantId: 'alligators',
    env: { CONTROL_PLANE_URL: 'https://cloud.test' },
    fetchImpl: async () => {
      called = true;
      return Response.json({});
    },
  });
  assert.equal(called, false);
  assert.deepEqual(config, { projectName: null, seedRepo: null, adminEmail: null });
});

// ------------------------------------------------------- the rest of the map

test('storage is scoped to the tenant and the checkpoint cadence is explicit', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: { ...baseEnv, MAUDE_R2_BUCKET: 'maude-cloud-assets' },
    hostname: 'alligators.cloud.maude.sh',
  });
  assert.equal(vars.MAUDE_TENANT_ID, 'alligators');
  assert.equal(vars.MAUDE_S3_BUCKET, 'maude-cloud-assets');
  assert.equal(vars.MAUDE_BACKUP_INTERVAL_MS, String(10 * 60 * 1000));
  // The image's own ENV is REPLACED, not merged — anything the cell needs is
  // listed explicitly or it is absent.
  assert.equal(vars.MAUDE_REPO_DIR, '/repo');
  assert.equal(vars.HUB_WORKSPACE_MODE, '1');
});

// ---------------------------------------------- per-tenant R2 creds (25 A-1)

test('minted credentials replace the fleet-wide key, session token included', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    // The legacy fleet-wide key is STILL in env — the point is that minted
    // credentials win, so deleting the legacy secrets is a no-op later.
    env: { ...baseEnv, MAUDE_R2_ACCESS_KEY_ID: 'shared', MAUDE_R2_SECRET_ACCESS_KEY: 'shared' },
    hostname: 'alligators.cloud.maude.sh',
    s3Creds: {
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      bucket: 'maude-cloud-assets',
      accessKeyId: 'tmp-id',
      secretAccessKey: 'tmp-secret',
      sessionToken: 'tok',
      expiresAt: 1234567890,
    },
  });
  assert.equal(vars.MAUDE_S3_ACCESS_KEY_ID, 'tmp-id');
  assert.equal(vars.MAUDE_S3_SECRET_ACCESS_KEY, 'tmp-secret');
  assert.equal(vars.MAUDE_S3_SESSION_TOKEN, 'tok');
  assert.equal(vars.MAUDE_S3_ENDPOINT, 'https://acct.r2.cloudflarestorage.com');
  assert.equal(vars.MAUDE_S3_CREDS_EXPIRES_AT, '1234567890');
  // The hub can refresh itself: the URL carries THIS tenant, nobody else's.
  assert.equal(
    vars.MAUDE_S3_CREDS_URL,
    'https://cloud.test/internal/cell-r2-credentials?tenant=alligators'
  );
});

test('without minted credentials the legacy branch still works (migration window)', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: {
      ...baseEnv,
      MAUDE_R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      MAUDE_R2_ACCESS_KEY_ID: 'shared-id',
      MAUDE_R2_SECRET_ACCESS_KEY: 'shared-secret',
    },
    hostname: 'alligators.cloud.maude.sh',
  });
  assert.equal(vars.MAUDE_S3_ACCESS_KEY_ID, 'shared-id');
  assert.equal(vars.MAUDE_S3_SESSION_TOKEN, undefined);
  assert.equal(vars.MAUDE_S3_CREDS_URL, undefined);
});

test('fetchTenantS3Credentials asks with the tenant-derived secret and fails closed', async () => {
  const { fetchTenantS3Credentials } = await import('./cell-config.mjs');
  let seen = null;
  const good = {
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    bucket: 'maude-cloud-assets',
    accessKeyId: 'tmp',
    secretAccessKey: 's',
    sessionToken: 't',
    expiresAt: Date.now() + 1000,
  };
  const creds = await fetchTenantS3Credentials({
    tenantId: 'alligators',
    env: baseEnv,
    fetchImpl: async (url, init) => {
      seen = { url: String(url), auth: init.headers.authorization };
      return new Response(JSON.stringify(good), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(seen.url, 'https://cloud.test/internal/cell-r2-credentials?tenant=alligators');
  assert.equal(seen.auth, `Bearer ${await deriveSecret(MASTER, 'alligators')}`);
  assert.equal(creds.accessKeyId, 'tmp');

  // A refusal (or outage) is null — the CALLER decides that a cell without
  // storage must not start; there is no cached fallback for credentials.
  const refused = await fetchTenantS3Credentials({
    tenantId: 'alligators',
    env: baseEnv,
    fetchImpl: async () => new Response('no', { status: 503 }),
  });
  assert.equal(refused, null);
});

// Cloud Phase 27 (DDR-209) — the cell runs the real studio, and the studio's
// client builds every canvas iframe URL from what it is TOLD its canvas origin
// is. Getting this wrong is not a subtle degradation: every canvas 404s.

test('a cell is told the browser-reachable canvas origin, with its tenant in the path', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: { ...baseEnv, CELL_ZONE: 'cloud.maude.sh' },
    hostname: 'alligators.cloud.maude.sh',
  });
  assert.equal(vars.MAUDE_PUBLIC_CANVAS_ORIGIN, 'https://canvas.cloud.maude.sh/alligators');
  // NOT the project hostname — the whole point of DDR-054 is that canvas
  // content executes on an origin the shell's cookie cannot reach.
  assert.ok(!vars.MAUDE_PUBLIC_CANVAS_ORIGIN.startsWith('https://alligators.'));
});

test('the tenant segment the WORKER strips is the one the BROWSER needs', async () => {
  // worker.mjs rewrites `canvas.<zone>/<tenant>/x` to `/x` before the cell sees
  // it, so these two must stay in agreement: the segment appears in the URL the
  // client builds and is gone from the path the cell parses. This test and
  // `canvas-origin.test.mjs` are the two halves of that contract.
  const vars = await cellEnv({
    tenantId: 'second-customer',
    env: { ...baseEnv, CELL_ZONE: 'cloud.maude.sh' },
    hostname: 'second-customer.cloud.maude.sh',
  });
  const { pathname } = new URL(vars.MAUDE_PUBLIC_CANVAS_ORIGIN);
  assert.equal(pathname, '/second-customer');
  assert.deepEqual(
    canvasOriginTenant(
      new URL(`${vars.MAUDE_PUBLIC_CANVAS_ORIGIN}/_canvas-shell.html?c=1`),
      'cloud.maude.sh'
    ),
    { tenant: 'second-customer', rest: '/_canvas-shell.html' }
  );
});

test('a hub with no zone gets no canvas origin rather than a wrong one', async () => {
  const vars = await cellEnv({
    tenantId: 'alligators',
    env: baseEnv,
    hostname: 'alligators.cloud.maude.sh',
  });
  assert.equal(vars.MAUDE_PUBLIC_CANVAS_ORIGIN, undefined);
});
