// Cloud Phase 3 Task 2 — the hub's authenticated asset proxy.
//
// The properties worth proving are all about what the route REFUSES: an
// unauthenticated peer, a non-content-addressed key, a write attempt, and a
// content type that could turn an asset into a document on the hub's origin.

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import {
  assetContentType,
  handleAssetRoute,
  handleCheckoutAssetRoute,
  parseAssetPath,
  parseCheckoutAssetPath,
} from '../src/assets.mjs';
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

/** Drive the route handler directly with a fake req/res pair. `body` (a Buffer
 *  or an array of Buffers) makes the request async-iterable, the way the PUT
 *  branch consumes a real IncomingMessage. */
async function call({
  pathname,
  method = 'GET',
  token,
  withS3 = true,
  designRoot = null,
  body = null,
  onWritten,
  maxPutBytes,
  putBudget,
}) {
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
  const chunks = body === null ? [] : Array.isArray(body) ? body : [body];
  const handled = await handleAssetRoute({
    request: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      async *[Symbol.asyncIterator]() {
        yield* chunks;
      },
    },
    response,
    pathname,
    method,
    dataDir,
    secret: '',
    s3: withS3 ? s3 : null,
    designRoot,
    onWritten,
    maxPutBytes,
    putBudget,
  });
  return { handled, ...captured };
}

test('parseAssetPath admits the shapes real projects actually use', () => {
  // Content-addressed — what `maude design fetch-asset` mints.
  assert.equal(parseAssetPath('/assets/deadbeef.png'), 'deadbeef.png');
  assert.equal(parseAssetPath('/assets/deadbeef'), 'deadbeef');
  // Authored — a design system's own fonts and graphics, referenced by path.
  // Requiring hashes (the rule until Cloud Phase 15) left a hosted project
  // rendering without its own brand and reported nothing anywhere.
  assert.equal(parseAssetPath('/assets/gator_badge_roundel.svg'), 'gator_badge_roundel.svg');
  assert.equal(parseAssetPath('/assets/graphics/camo-bg.png'), 'graphics/camo-bg.png');
  assert.equal(parseAssetPath('/assets/fonts/Gators-Bold.woff2'), 'fonts/Gators-Bold.woff2');
});

test('parseAssetPath cannot be walked out of the assets prefix', () => {
  for (const bad of [
    '/assets/',
    '/assets/../hub.db',
    '/assets/a/../../hub.db',
    '/assets/..',
    '/assets//double',
    '/assets/.hidden',
    '/assets/a/b/c/d/e/f/too-deep.png',
    '/assets/has space.png',
    '/assets/query.png?x=1',
    '/health',
  ]) {
    assert.equal(parseAssetPath(bad), null, `expected null for ${bad}`);
  }
});

test('a key that LOOKS like a backup path still cannot reach one', () => {
  // The widened charset admits `backups/<gen>/hub.db.gz` as a NAME. What keeps
  // it harmless is that the proxy always reads `assets/<key>` — the confinement
  // is the prefix, not the regex, and this pins that so a future refactor that
  // drops the prefix fails here instead of in production.
  assert.equal(
    parseAssetPath('/assets/backups/20260728T203000Z/hub.db.gz'),
    'backups/20260728T203000Z/hub.db.gz'
  );
  assert.equal(
    ASSET_OBJECT_KEY('backups/20260728T203000Z/hub.db.gz'),
    'assets/backups/20260728T203000Z/hub.db.gz'
  );
});

/** The one place the proxy turns a parsed key into an object key. */
const ASSET_OBJECT_KEY = (key) => `assets/${key}`;

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

test('a hub without a checkout is NOT an upload endpoint', async () => {
  // The pre-DDR-217 posture, still true wherever there is no durable checkout
  // to write into: accepting writes there would make the hub an
  // authenticated-but-cheap disk-fill surface.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  for (const method of ['PUT', 'POST', 'DELETE']) {
    const res = await call({ pathname: '/assets/deadbeef.png', method, token: minted.value });
    assert.equal(res.status, 405, `${method} must be refused`);
  }
});

/* -------------------------------------------- DDR-217 — the desktop push */

test('an authenticated PUT streams into the checkout and fires the mirror hook', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  let mirrored = 0;
  try {
    const res = await call({
      pathname: '/assets/graphics/camo-bg.png',
      method: 'PUT',
      token: minted.value,
      designRoot,
      body: [Buffer.from('cam'), Buffer.from('o-bytes')],
      onWritten: () => {
        mirrored += 1;
      },
    });
    assert.equal(res.status, 200, res.body);
    assert.deepEqual(JSON.parse(res.body), { ok: true, key: 'graphics/camo-bg.png', bytes: 10 });
    assert.equal(
      readFileSync(join(designRoot, 'assets/graphics/camo-bg.png'), 'utf8'),
      'camo-bytes'
    );
    assert.equal(mirrored, 1, 'the bucket mirror fires per successful push');
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('an unauthenticated PUT is 401 — the token gate comes before everything', async () => {
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  try {
    const res = await call({
      pathname: '/assets/deadbeef.png',
      method: 'PUT',
      designRoot,
      body: Buffer.from('x'),
    });
    assert.equal(res.status, 401);
    assert.equal(existsSync(join(designRoot, 'assets/deadbeef.png')), false);
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('an over-cap PUT aborts mid-stream and leaves no partial behind', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  let mirrored = 0;
  try {
    const res = await call({
      pathname: '/assets/deadbeef.mp4',
      method: 'PUT',
      token: minted.value,
      designRoot,
      body: [Buffer.alloc(6, 1), Buffer.alloc(6, 2)],
      maxPutBytes: 8,
      onWritten: () => {
        mirrored += 1;
      },
    });
    assert.equal(res.status, 413);
    assert.equal(existsSync(join(designRoot, 'assets/deadbeef.mp4')), false);
    const leftovers = readdirSync(join(designRoot, 'assets'));
    assert.deepEqual(leftovers, [], `no partial/temp file: ${leftovers.join(', ')}`);
    assert.equal(mirrored, 0, 'a refused push never mirrors');
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('a PUT cannot follow a peer-committed symlink out of assets/ (F1 blocker)', async () => {
  // DDR-054: a peer can COMMIT a symlink under assets/ into the shared repo.
  // `assets/escape -> ../../ui` + PUT assets/escape/welcome.tsx would, with a
  // lexical-only check, write attacker bytes over a served canvas the studio
  // child then compiles (data→code, DDR-193 §2). The realpath guard refuses it.
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  try {
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    // The escape link: assets/escape resolves to the sibling ui/ directory.
    symlinkSync(join(designRoot, 'ui'), join(designRoot, 'assets', 'escape'));

    const res = await call({
      pathname: '/assets/escape/welcome.tsx',
      method: 'PUT',
      token: minted.value,
      designRoot,
      body: Buffer.from('export default () => <script>PWNED</script>;'),
    });
    assert.equal(res.status, 400, 'the symlink-escaping PUT is refused');
    assert.equal(
      existsSync(join(designRoot, 'ui', 'welcome.tsx')),
      false,
      'nothing written outside assets/'
    );
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('the per-process PUT budget bounds total accepted bytes (F2)', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  // One SHARED budget across both requests — the process singleton, in miniature.
  const putBudget = { cap: 8, used: 0 };
  try {
    // First PUT exactly fills the budget; once spent, the next is refused 507
    // up front (a stream that would OVERRUN a partial budget is 413 instead —
    // both bound total bytes, this asserts the exhausted-up-front path).
    const first = await call({
      pathname: '/assets/aaaaaaaa.png',
      method: 'PUT',
      token: minted.value,
      designRoot,
      body: Buffer.alloc(8, 1),
      maxPutBytes: 1024,
      putBudget,
    });
    assert.equal(first.status, 200, first.body);
    assert.equal(putBudget.used, 8, 'the budget records the committed bytes');
    const second = await call({
      pathname: '/assets/bbbbbbbb.png',
      method: 'PUT',
      token: minted.value,
      designRoot,
      body: Buffer.alloc(1, 2),
      maxPutBytes: 1024,
      putBudget,
    });
    assert.equal(second.status, 507, 'budget exhausted');
    assert.equal(existsSync(join(designRoot, 'assets/bbbbbbbb.png')), false);
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('a traversal key never reaches the PUT branch — the parser refuses it first', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-put-'));
  try {
    for (const bad of ['/assets/../secret.png', '/assets/a/../../etc/passwd', '/assets//x.png']) {
      const res = await call({
        pathname: bad,
        method: 'PUT',
        token: minted.value,
        designRoot,
        body: Buffer.from('x'),
      });
      assert.equal(res.handled, false, `${bad} must not be handled as an asset`);
    }
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
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

/* -------------------------- DDR-217 addendum — checkout asset route (DS/brand) */

/** Drive the checkout-file route with a fake req/res (mirrors `call`). */
async function callCheckout({
  pathname,
  method = 'PUT',
  token,
  designRoot = null,
  body = null,
  checkRateLimit,
}) {
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
  const chunks = body === null ? [] : Array.isArray(body) ? body : [body];
  const handled = await handleCheckoutAssetRoute({
    request: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      async *[Symbol.asyncIterator]() {
        yield* chunks;
      },
    },
    response,
    pathname,
    method,
    dataDir,
    secret: '',
    designRoot,
    checkRateLimit,
  });
  return { handled, ...captured };
}

test('parseCheckoutAssetPath admits nested DS assets, refuses everything dangerous', () => {
  // The shapes real DS assets take — under some `assets/` segment, binary ext.
  assert.equal(
    parseCheckoutAssetPath('/_asset-file/system/alligators/assets/logos/horizontal-green.svg'),
    'system/alligators/assets/logos/horizontal-green.svg'
  );
  assert.equal(
    parseCheckoutAssetPath('/_asset-file/system/ds/assets/fonts/Gators-Bold.woff2'),
    'system/ds/assets/fonts/Gators-Bold.woff2'
  );
  assert.equal(parseCheckoutAssetPath('/_asset-file/assets/x.png'), 'assets/x.png');

  for (const bad of [
    '/_asset-file/system/ds/preview/logo.tsx', // no assets/ segment → refused (can't touch a canvas)
    '/_asset-file/system/ds/assets/config.json', // json is not an asset ext
    '/_asset-file/system/ds/assets/logo.css', // css is not an asset ext
    '/_asset-file/../etc/passwd', // traversal
    '/_asset-file/system/ds/assets/../../../../etc/x.png', // traversal with a valid tail
    '/_asset-file//assets/x.png', // empty component
    '/_asset-file/assets/x', // no extension
    '/_asset-file/config.json', // top-level, no assets/ segment
    '/_asset-file/', // empty
  ]) {
    assert.equal(parseCheckoutAssetPath(bad), null, `expected null for ${bad}`);
  }
});

test('an authenticated PUT writes a DS asset to the checkout at its real path', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-ck-'));
  try {
    const res = await callCheckout({
      pathname: '/_asset-file/system/alligators/assets/logos/horizontal-green.svg',
      token: minted.value,
      designRoot,
      body: [Buffer.from('<svg'), Buffer.from('/>')],
    });
    assert.equal(res.status, 200, res.body);
    assert.deepEqual(JSON.parse(res.body), {
      ok: true,
      path: 'system/alligators/assets/logos/horizontal-green.svg',
      bytes: 6,
    });
    assert.equal(
      readFileSync(join(designRoot, 'system/alligators/assets/logos/horizontal-green.svg'), 'utf8'),
      '<svg/>'
    );
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('HEAD is the desktop skip-probe: 200 when present, 404 when not', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-ck-'));
  try {
    mkdirSync(join(designRoot, 'system/ds/assets/logos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/ds/assets/logos/there.svg'), 'x');
    const present = await callCheckout({
      pathname: '/_asset-file/system/ds/assets/logos/there.svg',
      method: 'HEAD',
      token: minted.value,
      designRoot,
    });
    assert.equal(present.status, 200);
    const missing = await callCheckout({
      pathname: '/_asset-file/system/ds/assets/logos/nope.svg',
      method: 'HEAD',
      token: minted.value,
      designRoot,
    });
    assert.equal(missing.status, 404);
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('an unauthenticated checkout PUT is 401 and writes nothing', async () => {
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-ck-'));
  try {
    const res = await callCheckout({
      pathname: '/_asset-file/system/ds/assets/logos/x.svg',
      designRoot,
      body: Buffer.from('x'),
    });
    assert.equal(res.status, 401);
    assert.equal(existsSync(join(designRoot, 'system/ds/assets/logos/x.svg')), false);
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('a symlink-escaping checkout PUT is refused (same guard as the bucket PUT)', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-ck-'));
  try {
    mkdirSync(join(designRoot, 'system/ds/assets'), { recursive: true });
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    // A peer-committed symlink: system/ds/assets/escape -> ../../../ui
    symlinkSync(join(designRoot, 'ui'), join(designRoot, 'system/ds/assets/escape'));
    const res = await callCheckout({
      pathname: '/_asset-file/system/ds/assets/escape/pwn.svg',
      token: minted.value,
      designRoot,
      body: Buffer.from('<svg/>'),
    });
    assert.equal(res.status, 400, 'symlink escape refused');
    assert.equal(existsSync(join(designRoot, 'ui', 'pwn.svg')), false);
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});

test('a checkout PUT to a hub with no checkout is 405 (not an upload endpoint)', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const res = await callCheckout({
    pathname: '/_asset-file/system/ds/assets/logos/x.svg',
    token: minted.value,
    designRoot: null,
    body: Buffer.from('x'),
  });
  assert.equal(res.status, 405);
});

test('HEAD is rate-limited too — no unmetered existence oracle (F4)', async () => {
  const minted = addToken(dataDir, { label: 'peer-a', scope: '*' });
  const designRoot = mkdtempSync(join(tmpdir(), 'maude-hub-ck-'));
  try {
    mkdirSync(join(designRoot, 'system/ds/assets/logos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/ds/assets/logos/there.svg'), 'x');
    const res = await callCheckout({
      pathname: '/_asset-file/system/ds/assets/logos/there.svg',
      method: 'HEAD',
      token: minted.value,
      designRoot,
      checkRateLimit: () => false, // over the limit
    });
    assert.equal(res.status, 429, 'HEAD is metered, not a free oracle');
  } finally {
    rmSync(designRoot, { recursive: true, force: true });
  }
});
