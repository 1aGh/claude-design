// The only code path that destroys customer data — Cloud Phase 24 B4.
//
// A prefix bug here deletes the wrong customer, so the prefix rule gets tests
// of its own rather than being covered incidentally by the delete round trip.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ownsKey, purgeTenantObjects, tenantPrefix } from './purge.mjs';

/** An in-memory R2 binding — list (paged) + delete over a Map. */
function fakeBucket(keys = []) {
  const store = new Set(keys);
  const calls = { deletes: [] };
  return {
    store,
    calls,
    async list({ prefix, limit = 1000, cursor }) {
      const all = [...store].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? all.indexOf(cursor) + 1 : 0;
      const page = all.slice(from, from + limit);
      const last = page.at(-1);
      const truncated = from + page.length < all.length;
      return { objects: page.map((key) => ({ key, size: 1 })), truncated, cursor: last };
    },
    async delete(keys) {
      calls.deletes.push(keys);
      for (const k of keys) store.delete(k);
    },
  };
}

test('the prefix carries a trailing slash, so "a" never matches "ab"', () => {
  assert.equal(tenantPrefix('alligators'), 'tenants/alligators/');
  assert.equal(ownsKey('tenants/alligators/repo', 'alligators'), true);
  assert.equal(ownsKey('tenants/alligators-2/repo', 'alligators'), false);
  assert.equal(ownsKey('tenants/other/repo', 'alligators'), false);
  // The prefix itself is not an object, and neither is anything above it.
  assert.equal(ownsKey('tenants/alligators/', 'alligators'), false);
  assert.equal(ownsKey('tenants/', 'alligators'), false);
});

test('a tenant id that could escape its namespace never becomes a prefix', () => {
  for (const bad of ['', '../other', 'a/b', 'UPPER', 'a'.repeat(64), null]) {
    assert.throws(() => tenantPrefix(bad), /refusing to build a storage prefix/);
  }
});

test('purge deletes everything this tenant holds and nothing anybody else does', async () => {
  const bucket = fakeBucket([
    'tenants/alligators/repo.bundle',
    'tenants/alligators/assets/a.png',
    'tenants/alligators/exports/20260730T120000Z/repo.bundle',
    'tenants/alligators-reserve/repo.bundle',
    'tenants/other-club/repo.bundle',
  ]);
  const res = await purgeTenantObjects(bucket, 'alligators');
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 3);
  assert.deepEqual([...bucket.store].sort(), [
    'tenants/alligators-reserve/repo.bundle',
    'tenants/other-club/repo.bundle',
  ]);
});

test('the prepared exports go too — there is no second copy left behind', async () => {
  const bucket = fakeBucket(['tenants/alligators/exports/20260730T120000Z/repo.bundle']);
  await purgeTenantObjects(bucket, 'alligators');
  assert.equal(bucket.store.size, 0);
});

test('a listing longer than one page is fully drained', async () => {
  const keys = Array.from(
    { length: 512 },
    (_, i) => `tenants/alligators/a${String(i).padStart(4, '0')}`
  );
  const bucket = fakeBucket(keys);
  const res = await purgeTenantObjects(bucket, 'alligators', { batch: 100 });
  assert.equal(res.ok, true);
  assert.equal(res.deleted, 512);
  assert.equal(bucket.store.size, 0);
  assert.equal(bucket.calls.deletes.length, 6);
});

test('purging an already-purged project is harmless — it is re-runnable', async () => {
  const bucket = fakeBucket([]);
  const res = await purgeTenantObjects(bucket, 'alligators');
  assert.deepEqual(res, { ok: true, deleted: 0 });
  assert.equal(bucket.calls.deletes.length, 0);
});

test('a storage failure REPORTS rather than throws — the row must not lie about it', async () => {
  const bucket = {
    async list() {
      throw new Error('R2 is unreachable');
    },
  };
  const res = await purgeTenantObjects(bucket, 'alligators');
  assert.equal(res.ok, false);
  assert.match(res.reason, /unreachable/);
});

test('no bucket bound is a reported failure, never a silent success', async () => {
  const res = await purgeTenantObjects(null, 'alligators');
  assert.equal(res.ok, false);
  assert.equal(res.deleted, 0);
});
