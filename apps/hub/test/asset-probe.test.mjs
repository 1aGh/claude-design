// `POST /_asset-probe` — the batch presence probe (RCA 2026-08-11 part 2).
//
// It exists because a HEAD does not reach a cell as a HEAD, so the sweep's
// per-file skip-probe could never answer "already there". The properties that
// matter are: it answers for BOTH asset classes from the right store, it never
// admits a path the write routes would refuse, and it is gated exactly like the
// writes it replaces.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { handleAssetProbeRoute } from '../src/assets.mjs';
import { addToken } from '../src/tokens.mjs';

let dataDir;
let designRoot;
let store;
let s3server;
let s3;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-probe-'));
  designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-probe-root-'));
  store = new Map();
  s3server = createServer((req, res) => {
    const key = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace('/bucket/', ''));
    const body = store.get(key);
    if (!body) return void res.writeHead(404).end();
    res
      .writeHead(200, { 'Content-Length': body.length })
      .end(req.method === 'HEAD' ? undefined : body);
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
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(designRoot, { recursive: true, force: true });
});

/** Drive the probe with a fake req/res pair; `paths` becomes the JSON body. */
async function probe({ paths, token, method = 'POST', withS3 = true, root = designRoot, ...rest }) {
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
  const raw = rest.rawBody ?? JSON.stringify({ paths });
  const handled = await handleAssetProbeRoute({
    request: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(raw);
      },
    },
    response,
    pathname: rest.pathname ?? '/_asset-probe',
    method,
    dataDir,
    secret: '',
    s3: withS3 ? s3 : null,
    designRoot: root,
    checkRateLimit: rest.checkRateLimit,
    checkWriteRateLimit: rest.checkWriteRateLimit,
  });
  return { handled, ...captured, json: captured.body ? JSON.parse(captured.body) : null };
}

function dsAsset(rel, body = 'x') {
  const abs = join(designRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}

test('one request answers for both asset classes, from the right store', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  // Class 1 lives in the bucket AND is mirrored into the checkout — a canvas
  // reaches it either way (`/assets/<key>` or `/.design/assets/<key>`), so a
  // complete push is what "present" means.
  store.set('assets/deadbeef.png', Buffer.from('bytes'));
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  writeFileSync(join(designRoot, 'assets/deadbeef.png'), 'bytes');
  // …class 2 in the checkout.
  dsAsset('system/ds/assets/logos/there.svg');

  const res = await probe({
    token: minted.value,
    paths: [
      'assets/deadbeef.png', // bucket, present
      'assets/00000000.png', // bucket, absent
      'system/ds/assets/logos/there.svg', // checkout, present
      'system/ds/assets/logos/nope.svg', // checkout, absent
    ],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.present, ['assets/deadbeef.png', 'system/ds/assets/logos/there.svg']);
});

// The live failure, 2026-08-13 (alligators): a restarted cell had every
// `assets/*` in its bucket and none in its checkout, the probe answered
// "present" for all 90, the sweep skipped them, and every canvas that
// references `/.design/assets/<key>` — the checkout form — rendered a grey box
// that no later boot would ever repair.
test('a bucket-only asset is ABSENT — the canvas can reference the checkout form', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  store.set('assets/deadbeef.png', Buffer.from('bytes')); // bucket has it…
  // …and the checkout does NOT (a cell restart drops the container's disk).
  const res = await probe({ token: minted.value, paths: ['assets/deadbeef.png'] });
  assert.deepEqual(res.json.present, [], 'skipping this leaves a permanent grey box');
});

test('present only when BOTH stores hold it', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  store.set('assets/deadbeef.png', Buffer.from('bytes'));
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  writeFileSync(join(designRoot, 'assets/deadbeef.png'), 'bytes');
  const res = await probe({ token: minted.value, paths: ['assets/deadbeef.png'] });
  assert.deepEqual(res.json.present, ['assets/deadbeef.png']);
});

test('a checkout-only asset is absent too — the bucket is what survives a restart', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  mkdirSync(join(designRoot, 'assets'), { recursive: true });
  writeFileSync(join(designRoot, 'assets/deadbeef.png'), 'bytes');
  const res = await probe({ token: minted.value, paths: ['assets/deadbeef.png'] });
  assert.deepEqual(res.json.present, []);
});

test('a bucket-only hub (no checkout) still answers from the store it has', async () => {
  // Requiring a mirror a deployment never writes would re-upload the world
  // on every boot — the failure this probe exists to end.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  store.set('assets/deadbeef.png', Buffer.from('bytes'));
  const res = await probe({ token: minted.value, paths: ['assets/deadbeef.png'], root: '' });
  assert.deepEqual(res.json.present, ['assets/deadbeef.png']);
});

test('a path the WRITE route would refuse is reported absent, never an error', async () => {
  // The probe must not become an oracle for a surface that does not exist — and
  // must not leak WHY it refused, which would map the filesystem.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  dsAsset('system/ds/assets/logos/real.svg');
  const res = await probe({
    token: minted.value,
    paths: [
      '../../../etc/passwd',
      '/etc/passwd',
      'system/ds/assets/../../../escape.svg',
      'config.json', // no assets/ segment
      'system/ds/assets/logos/app.tsx', // not a binary asset extension
      'system/ds/assets/logos/real.svg', // the one good path
      42,
      null,
    ],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.present, ['system/ds/assets/logos/real.svg']);
});

test('a symlink landing where the writer would refuse is absent, like it is unwritable', async () => {
  // feature-sync-file-plane: probe and writer share ONE decision
  // (`resolveCheckoutFileWrite`), judged on the REAL landing path. A link
  // onto runtime state answers absent; a link onto a legitimate plane
  // location answers like the real path itself would.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  mkdirSync(join(designRoot, '_history'), { recursive: true });
  writeFileSync(join(designRoot, '_history/welcome.png'), 'x');
  symlinkSync(join(designRoot, '_history'), join(designRoot, 'media'));
  const res = await probe({
    token: minted.value,
    paths: ['media/welcome.png'],
  });
  assert.deepEqual(res.json.present, []);
});

test('unauthenticated is 401, and the tight per-IP bucket still guards that path', async () => {
  const open = await probe({ paths: ['assets/deadbeef.png'] });
  assert.equal(open.status, 401);
  const limited = await probe({ paths: ['assets/deadbeef.png'], checkRateLimit: () => false });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['Retry-After'], '60');
});

test('an authenticated probe consumes the same per-label bucket as the writes', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const seen = [];
  const over = await probe({
    token: minted.value,
    paths: ['assets/deadbeef.png'],
    checkWriteRateLimit: (label) => {
      seen.push(label);
      return false;
    },
  });
  assert.equal(over.status, 429);
  assert.deepEqual(seen, ['peer-a'], 'metered by token label, not by IP');
});

test('the list and the body are both bounded', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const tooMany = await probe({
    token: minted.value,
    paths: Array.from({ length: 1001 }, (_, i) => `assets/${i}.png`),
  });
  assert.equal(tooMany.status, 413);

  const huge = await probe({
    token: minted.value,
    rawBody: `{"paths":["${'a'.repeat(800 * 1024)}"]}`,
  });
  assert.equal(huge.status, 413, 'an oversized body is abandoned, never buffered whole');
});

test('a malformed body is a 400, and a non-POST is a 405', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  assert.equal((await probe({ token: minted.value, rawBody: 'not json' })).status, 400);
  assert.equal((await probe({ token: minted.value, rawBody: '{"paths":"nope"}' })).status, 400);
  assert.equal((await probe({ token: minted.value, paths: [], method: 'GET' })).status, 405);
});

test('a hub with no bucket still answers for the checkout class', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  dsAsset('system/ds/assets/logos/there.svg');
  const res = await probe({
    token: minted.value,
    withS3: false,
    paths: ['assets/deadbeef.png', 'system/ds/assets/logos/there.svg'],
  });
  assert.deepEqual(res.json.present, ['system/ds/assets/logos/there.svg']);
});

test('a different path is not handled at all (the router keeps dispatching)', async () => {
  const res = await probe({ paths: [], pathname: '/_asset-probey' });
  assert.equal(res.handled, false);
});
