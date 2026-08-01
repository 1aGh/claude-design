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
import { cellEnv, deriveSecret, fetchTenantConfig, isValidTenantId } from './cell-config.mjs';

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
