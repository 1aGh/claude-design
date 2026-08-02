// Cloud Phase 25 A-1 — the hub's refreshing credential source.
//
// Self-hosted hubs keep static keys and never refresh; platform cells carry
// temporary credentials plus a refresh URL, and every consumer asks the
// source per operation instead of pinning boot-time values.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createS3ConfigSource, REFRESH_MARGIN_MS } from '../src/s3-creds.mjs';

const STATIC_ENV = {
  MAUDE_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  MAUDE_S3_BUCKET: 'bucket',
  MAUDE_S3_ACCESS_KEY_ID: 'static-id',
  MAUDE_S3_SECRET_ACCESS_KEY: 'static-secret',
};

test('static keys: no refresh URL means the config is stable and never fetched', async () => {
  const source = createS3ConfigSource(STATIC_ENV, {
    fetchImpl: () => {
      throw new Error('must not fetch');
    },
  });
  assert.equal(source.configured, true);
  const cfg = await source.config();
  assert.equal(cfg.accessKeyId, 'static-id');
  assert.equal(await source.config(), cfg);
});

test('unconfigured: no keys, no URL — configured=false, config()=null', async () => {
  const source = createS3ConfigSource({});
  assert.equal(source.configured, false);
  assert.equal(await source.config(), null);
});

test('temporary creds refresh before expiry, with the HUB_SECRET bearer', async () => {
  const soon = Date.now() + REFRESH_MARGIN_MS / 2; // inside the refresh margin
  let calls = 0;
  let auth = null;
  const source = createS3ConfigSource(
    {
      ...STATIC_ENV,
      MAUDE_S3_SESSION_TOKEN: 'old-tok',
      MAUDE_S3_CREDS_URL: 'https://cloud.test/internal/cell-r2-credentials?tenant=alligators',
      MAUDE_S3_CREDS_EXPIRES_AT: String(soon),
      HUB_SECRET: 'derived-secret',
    },
    {
      fetchImpl: async (_url, init) => {
        calls++;
        auth = init.headers.authorization;
        return new Response(
          JSON.stringify({
            endpoint: 'https://acct.r2.cloudflarestorage.com',
            bucket: 'bucket',
            accessKeyId: 'fresh-id',
            secretAccessKey: 'fresh-secret',
            sessionToken: 'fresh-tok',
            expiresAt: Date.now() + 12 * 3600_000,
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      },
      log: { log() {}, error() {} },
    }
  );
  const cfg = await source.config();
  assert.equal(cfg.accessKeyId, 'fresh-id');
  assert.equal(cfg.sessionToken, 'fresh-tok');
  assert.equal(auth, 'Bearer derived-secret');
  // Fresh creds pushed the expiry out — the next call must NOT refetch.
  await source.config();
  assert.equal(calls, 1);
});

test('a failed refresh KEEPS the current credentials and does not throw', async () => {
  const source = createS3ConfigSource(
    {
      ...STATIC_ENV,
      MAUDE_S3_CREDS_URL: 'https://cloud.test/internal/cell-r2-credentials?tenant=t',
      MAUDE_S3_CREDS_EXPIRES_AT: String(Date.now() - 1000), // already stale
      HUB_SECRET: 's',
    },
    {
      fetchImpl: async () => new Response('down', { status: 503 }),
      log: { log() {}, error() {} },
    }
  );
  const cfg = await source.config();
  assert.equal(cfg.accessKeyId, 'static-id'); // the boot-time creds survive
});
