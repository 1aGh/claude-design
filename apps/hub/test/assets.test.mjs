// Cloud Phase 3 Task 2 — the hub's authenticated asset proxy.
//
// The properties worth proving are all about what the route REFUSES: an
// unauthenticated peer, a non-content-addressed key, a write attempt, and a
// content type that could turn an asset into a document on the hub's origin.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { assetContentType, handleAssetRoute, parseAssetPath } from '../src/assets.mjs';
import { addToken } from '../src/tokens.mjs';

let dataDir;
let store;
let s3server;
let s3;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-assets-'));
  store = new Map();
  s3server = createServer((req, res) => {
    const key = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace('/bucket/', ''));
    const body = store.get(key);
    if (req.method === 'HEAD') {
      if (!body) return void res.writeHead(404).end();
      return void res.writeHead(200, { 'Content-Length': body.length }).end();
    }
    if (req.method === 'GET') {
      if (!body) return void res.writeHead(404).end();
      return void res.writeHead(200).end(body);
    }
    res.writeHead(405).end();
  });
  await new Promise((resolve) => s3server.listen(0, '127.0.0.1', resolve));
  s3 = {
    endpoint: `http://127.0.0.1:${s3server.address().port}`,
    bucket: 'bucket',
    accessKeyId: 'AKIA',
    secretAccessKey: 'secret',
    region: 'auto',
  };
});

afterEach(async () => {
  await new Promise((resolve) => s3server.close(resolve));
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

/** Drive the route handler directly with a fake req/res pair. */
async function call({ pathname, method = 'GET', token, withS3 = true }) {
  const captured = { status: 0, headers: {}, body: null };
  const response = {
    writeHead(status, headers) {
      captured.status = status;
      captured.headers = headers ?? {};
      return this;
    },
    end(body) {
      captured.body = body ?? null;
      return this;
    },
  };
  const handled = await handleAssetRoute({
    request: { headers: token ? { authorization: `Bearer ${token}` } : {} },
    response,
    pathname,
    method,
    dataDir,
    secret: '',
    s3: withS3 ? s3 : null,
  });
  return { handled, ...captured };
}

test('parseAssetPath admits only content-addressed keys', () => {
  assert.equal(parseAssetPath('/assets/deadbeef.png'), 'deadbeef.png');
  assert.equal(parseAssetPath('/assets/deadbeef'), 'deadbeef');
  // Everything a hostile peer might try to reach the rest of the bucket with.
  for (const bad of [
    '/assets/',
    '/assets/../hub.db',
    '/assets/backups/20260728T203000Z/hub.db.gz',
    '/assets/deadbeef.png/extra',
    '/assets/DEADBEEF.png',
    '/assets/deadbeef.reallylongextension',
    '/assets/not-a-hash.png',
    '/health',
  ]) {
    assert.equal(parseAssetPath(bad), null, `expected null for ${bad}`);
  }
});

test('content types are chosen from the extension and never text/html', () => {
  assert.equal(assetContentType('deadbeef.png'), 'image/png');
  assert.equal(assetContentType('deadbeef.mp4'), 'video/mp4');
  assert.equal(assetContentType('deadbeef'), 'application/octet-stream');
  assert.equal(assetContentType('deadbeef.html'), 'application/octet-stream');
  assert.equal(assetContentType('deadbeef.js'), 'application/octet-stream');
});

test('an unauthenticated request is 401 and never touches the bucket', async () => {
  store.set('assets/deadbeef.png', Buffer.from('image bytes'));
  const res = await call({ pathname: '/assets/deadbeef.png' });
  assert.equal(res.handled, true);
  assert.equal(res.status, 401);
  assert.match(res.body, /unauthorized/);
});

test('an invalid token is 401', async () => {
  store.set('assets/deadbeef.png', Buffer.from('image bytes'));
  const res = await call({ pathname: '/assets/deadbeef.png', token: 'mau_not_a_real_token' });
  assert.equal(res.status, 401);
});

test('a valid peer token streams the bytes with immutable, sniff-proof headers', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  store.set('assets/deadbeef.png', Buffer.from('image bytes'));

  const res = await call({ pathname: '/assets/deadbeef.png', token: minted.value });
  assert.equal(res.status, 200);
  assert.equal(res.body.toString(), 'image bytes');
  assert.equal(res.headers['Content-Type'], 'image/png');
  // Content-addressed ⇒ the bytes under a key never change ⇒ cache forever.
  assert.match(res.headers['Cache-Control'], /immutable/);
  // An asset must not be able to become a document on the hub's own origin.
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(res.headers['Content-Security-Policy'], /sandbox/);
});

test('HEAD reports size without downloading the object', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  store.set('assets/deadbeef.mp4', Buffer.alloc(1024, 7));
  const res = await call({ pathname: '/assets/deadbeef.mp4', method: 'HEAD', token: minted.value });
  assert.equal(res.status, 200);
  assert.equal(res.headers['Content-Length'], 1024);
  assert.equal(res.body, null);
});

test('a missing object is 404', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const res = await call({ pathname: '/assets/00000000.png', token: minted.value });
  assert.equal(res.status, 404);
});

test('the hub is NOT an upload endpoint', async () => {
  // Accepting writes here would make the hub an authenticated-but-cheap
  // disk-fill surface. Assets are minted by the peer that has the bytes.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  for (const method of ['PUT', 'POST', 'DELETE']) {
    const res = await call({ pathname: '/assets/deadbeef.png', method, token: minted.value });
    assert.equal(res.status, 405, `${method} must be refused`);
  }
});

test('a hub with no asset store says so rather than failing obscurely', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const res = await call({ pathname: '/assets/deadbeef.png', token: minted.value, withS3: false });
  assert.equal(res.status, 503);
  assert.match(res.body, /no asset store configured/);
});

test('a non-asset path is not handled at all (the router keeps dispatching)', async () => {
  const res = await call({ pathname: '/health' });
  assert.equal(res.handled, false);
  assert.equal(res.status, 0);
});
