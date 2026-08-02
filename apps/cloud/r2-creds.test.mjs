// Cloud Phase 25 A-1 — per-tenant temporary R2 credentials.
//
// The invariant under test: the bucket-wide key never leaves the control
// plane. A cell gets credentials scoped to its OWN `tenants/<id>/` prefix,
// TTL-bounded, or it gets a refusal — never a shared value.

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { deriveCellSecret } from './cell-token.mjs';
import { d1FromSqlite } from './db.mjs';
import { applySchema } from './migrate.mjs';
import {
  DEFAULT_TTL_SECONDS,
  mintTenantCredentials,
  mintingConfigured,
  tenantPrefix,
} from './r2-creds.mjs';
import { SCHEMA_SQL } from './schema.mjs';
import worker from './worker.mjs';

const CONFIGURED = {
  CF_ACCOUNT_ID: 'acct123',
  R2_CREDS_TOKEN: 'cf-api-token',
  R2_PARENT_ACCESS_KEY_ID: 'parent-key-id',
  MAUDE_R2_BUCKET: 'maude-cloud-assets',
};

function cfOk(result) {
  return new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('minting scopes to the tenant prefix, one bucket, object-read-write', async () => {
  let seen = null;
  const fetchImpl = async (url, init) => {
    seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return cfOk({ accessKeyId: 'tmp-id', secretAccessKey: 'tmp-secret', sessionToken: 'tok' });
  };
  const out = await mintTenantCredentials({
    env: CONFIGURED,
    tenantId: 'alligators',
    fetchImpl,
    now: 1_000_000,
  });
  assert.equal(out.ok, true);
  assert.equal(seen.url, 'https://api.cloudflare.com/client/v4/accounts/acct123/r2/temp-access-credentials');
  assert.equal(seen.auth, 'Bearer cf-api-token');
  assert.equal(seen.body.bucket, 'maude-cloud-assets');
  assert.equal(seen.body.parentAccessKeyId, 'parent-key-id');
  assert.equal(seen.body.permission, 'object-read-write');
  // THE ISOLATION: exactly one prefix, exactly this tenant's.
  assert.deepEqual(seen.body.prefixes, ['tenants/alligators/']);
  assert.equal(seen.body.ttlSeconds, DEFAULT_TTL_SECONDS);
  assert.equal(out.credentials.accessKeyId, 'tmp-id');
  assert.equal(out.credentials.sessionToken, 'tok');
  assert.equal(out.credentials.bucket, 'maude-cloud-assets');
  assert.equal(out.credentials.endpoint, 'https://acct123.r2.cloudflarestorage.com');
  assert.equal(out.credentials.expiresAt, 1_000_000 + DEFAULT_TTL_SECONDS * 1000);
  assert.equal(out.credentials.prefix, tenantPrefix('alligators'));
});

test('unconfigured minting fails CLOSED — a 503, never a shared key', async () => {
  assert.equal(mintingConfigured({}), false);
  const out = await mintTenantCredentials({
    env: {},
    tenantId: 'alligators',
    fetchImpl: () => {
      throw new Error('must not be called');
    },
  });
  assert.equal(out.ok, false);
  assert.equal(out.status, 503);
});

test('a Cloudflare refusal surfaces as 502 with the message, not as credentials', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ success: false, errors: [{ code: 10000, message: 'no permission' }] }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  const out = await mintTenantCredentials({ env: CONFIGURED, tenantId: 't1', fetchImpl });
  assert.equal(out.ok, false);
  assert.equal(out.status, 502);
  assert.match(out.error, /no permission/);
});

// ── the Worker route ────────────────────────────────────────────────────────

async function freshEnv(extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const DB = d1FromSqlite(sqlite);
  await applySchema(DB, SCHEMA_SQL);
  return { env: { DB, CELL_SECRET_MASTER: 'master', ...CONFIGURED, ...extra }, sqlite };
}

function addProject(sqlite, id, state = 'active') {
  sqlite
    .prepare(
      "INSERT INTO accounts (id, email, password_hash, created_at) VALUES ('acc1', 'o@example.com', 'x', 1) ON CONFLICT(id) DO NOTHING"
    )
    .run();
  sqlite
    .prepare(
      'INSERT INTO projects (id, account_id, name, state, state_since, created_at) VALUES (?, ?, ?, ?, 1, 1)'
    )
    .run(id, 'acc1', id, state);
}

async function callRoute(env, tenant, secret) {
  return worker.fetch(
    new Request(`https://cloud.test/internal/cell-r2-credentials?tenant=${tenant}`, {
      headers: { authorization: `Bearer ${secret}` },
    }),
    env
  );
}

test('route: the derived secret for tenant A cannot mint for tenant B', async () => {
  const { env, sqlite } = await freshEnv();
  addProject(sqlite, 'tenant-a');
  addProject(sqlite, 'tenant-b');
  const secretA = await deriveCellSecret('master', 'tenant-a');
  const res = await callRoute(env, 'tenant-b', secretA);
  assert.equal(res.status, 401);
});

test('route: unknown and purged tenants get no credentials', async () => {
  const { env, sqlite } = await freshEnv();
  addProject(sqlite, 'gone-tenant', 'purged');
  const ghost = await callRoute(env, 'ghost', await deriveCellSecret('master', 'ghost'));
  assert.equal(ghost.status, 404);
  const purged = await callRoute(
    env,
    'gone-tenant',
    await deriveCellSecret('master', 'gone-tenant')
  );
  assert.equal(purged.status, 404);
});

test('route: a known tenant with the right secret gets scoped credentials', async () => {
  const { env, sqlite } = await freshEnv();
  addProject(sqlite, 'alligators');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('temp-access-credentials')) {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.prefixes, ['tenants/alligators/']);
      return cfOk({ accessKeyId: 'id1', secretAccessKey: 's1', sessionToken: 'tok1' });
    }
    return realFetch(url, init);
  };
  try {
    const res = await callRoute(
      env,
      'alligators',
      await deriveCellSecret('master', 'alligators')
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.accessKeyId, 'id1');
    assert.equal(body.sessionToken, 'tok1');
    assert.equal(body.prefix, 'tenants/alligators/');
    assert.ok(body.expiresAt > Date.now());
  } finally {
    globalThis.fetch = realFetch;
  }
});
