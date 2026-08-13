// Bucket → checkout hydration — the direction that did not exist.
//
// THE INCIDENT THIS PINS. A cell's checkout is ephemeral: the platform migrates
// instances whenever it likes, and `rehydrate.mjs` restores the working set from
// the newest BACKUP GENERATION — so every asset that reached the bucket after
// that generation is simply absent on the next wake. `sweepAssets` mirrors
// checkout → bucket and there was no reverse, so those bytes existed in exactly
// one place the cell could not read. The studio serves the checkout, so canvas
// photographs became grey boxes.
//
// Measured on Brno Alligators (2026-08-13): 53–58 of ~95 bucket-class assets
// 404 in the checkout and 200 in the bucket, immediately after a rollout, three
// times in one afternoon. The only repair anyone had was re-uploading ~388 MB
// from a laptop — a client fixing a server's disk, for bytes the server had.
//
// The two properties that make this safe to run on every boot are asserted
// hardest: it never overwrites, and a hostile key never becomes a path.

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { assetNameFromKey, hydrateAssets, missingFromCheckout } from '../src/asset-lane.mjs';

const dirs = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'hub-hydrate-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const silent = () => ({ log: () => {}, warn: () => {}, error: () => {} });

/** A bucket: keys → bytes, behind the two deps hydrateAssets injects. */
function bucket(objects) {
  const store = new Map(Object.entries(objects));
  const gets = [];
  return {
    gets,
    deps: {
      listObjects: async (_c, prefix) =>
        [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })),
      getObject: async (_c, key) => {
        gets.push(key);
        const v = store.get(key);
        return v === undefined ? null : Buffer.from(v);
      },
    },
  };
}

describe('missingFromCheckout (pure)', () => {
  it('is the set difference, deduped and sorted', () => {
    assert.deepEqual(
      missingFromCheckout(['bbbbbbbb.png', 'aaaaaaaa.png', 'bbbbbbbb.png'], new Set()),
      ['aaaaaaaa.png', 'bbbbbbbb.png']
    );
  });

  it('a file already on disk is not missing', () => {
    assert.deepEqual(
      missingFromCheckout(['aaaaaaaa.png', 'bbbbbbbb.png'], new Set(['aaaaaaaa.png'])),
      ['bbbbbbbb.png']
    );
  });

  it('what the proxy will not serve is never written to disk either', () => {
    // Same `servable()` gate the upload sweep asks. A key the proxy would 404
    // is not worth materialising, and the two rules having one home is the
    // reason the upload side stopped carrying its own regex.
    for (const bad of ['../escape.png', '/abs.png', 'back\\slash.png', 'a'.repeat(400)]) {
      assert.deepEqual(missingFromCheckout([bad], new Set()), [], bad);
    }
  });
});

describe('assetNameFromKey', () => {
  it('strips the scope a tenant asked for', () => {
    assert.equal(assetNameFromKey('t-abc/assets/x.png', 't-abc'), 'x.png');
    assert.equal(assetNameFromKey('assets/x.png', ''), 'x.png');
    assert.equal(assetNameFromKey('assets/graphics/camo.png', ''), 'graphics/camo.png');
  });

  it('refuses a key from outside the scope rather than trimming it', () => {
    // "close enough" is how one tenant's media lands in another's checkout.
    assert.equal(assetNameFromKey('t-other/assets/x.png', 't-abc'), null);
    assert.equal(assetNameFromKey('assets/x.png', 't-abc'), null);
    assert.equal(assetNameFromKey('t-abcd/assets/x.png', 't-abc'), null);
  });
});

describe('hydrateAssets', () => {
  it('restores what the bucket has and the checkout lost', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const b = bucket({
      'assets/aaaaaaaa.png': 'photo-one',
      'assets/bbbbbbbb.png': 'photo-two',
    });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, ['aaaaaaaa.png', 'bbbbbbbb.png']);
    assert.equal(readFileSync(join(dir, 'assets', 'aaaaaaaa.png'), 'utf8'), 'photo-one');
    assert.equal(readFileSync(join(dir, 'assets', 'bbbbbbbb.png'), 'utf8'), 'photo-two');
  });

  it('NEVER overwrites a file the checkout already has', async () => {
    // The bucket is a backup of this checkout, not an authority over it. A
    // path-addressed name (`graphics/camo-bg.png`) can legitimately be NEWER on
    // disk — a local edit not swept up yet — and overwriting is how that edit
    // is lost. Filling gaps is the whole job.
    const dir = tmp();
    mkdirSync(join(dir, 'assets', 'graphics'), { recursive: true });
    writeFileSync(join(dir, 'assets', 'graphics', 'camo.png'), 'LOCAL-AND-NEWER');
    const b = bucket({ 'assets/graphics/camo.png': 'stale-copy' });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, []);
    assert.equal(r.present, 1);
    assert.deepEqual(b.gets, [], 'it does not even pay to download what it will not write');
    assert.equal(
      readFileSync(join(dir, 'assets', 'graphics', 'camo.png'), 'utf8'),
      'LOCAL-AND-NEWER'
    );
  });

  it('creates the assets directory tree it needs', async () => {
    const dir = tmp(); // no `assets/` at all — the post-migration cold case
    const b = bucket({ 'assets/fonts/Gators-Bold.woff2': 'font-bytes' });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, ['fonts/Gators-Bold.woff2']);
    assert.equal(
      readFileSync(join(dir, 'assets', 'fonts', 'Gators-Bold.woff2'), 'utf8'),
      'font-bytes'
    );
  });

  it('a hostile key never becomes a path outside the assets directory', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const b = bucket({
      'assets/../../../etc/passwd': 'pwned',
      'assets/../escape.png': 'pwned',
      'assets/ok.png': 'fine',
    });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, ['ok.png']);
    assert.equal(existsSync(join(dir, 'escape.png')), false);
    assert.equal(existsSync(join(tmpdir(), '..', 'etc', 'passwd-maude-test')), false);
  });

  it('a SYMLINK under assets/ is not a way out of it', async () => {
    // Lexical containment is not containment. `resolve()` never follows a link
    // and `mkdirSync(recursive:true)` happily traverses one that already
    // exists — and the checkout is a clone of a repository the TENANT controls,
    // so a committed symlink here is a write-outside primitive inside the cell.
    // The sibling receiver (`sync/remote-docs.ts`) injects a realpath for
    // exactly this; the first version of this function did not.
    const dir = tmp();
    const outside = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    symlinkSync(outside, join(dir, 'assets', 'escape'));
    const b = bucket({
      'assets/escape/pwned.png': 'should never land',
      'assets/ok.png': 'fine',
    });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, ['ok.png']);
    assert.equal(existsSync(join(outside, 'pwned.png')), false);
    assert.match(r.failed.find((f) => f.key === 'escape/pwned.png')?.reason ?? '', /symlink/);
  });

  it('only reads its own tenant scope', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const b = bucket({
      't-mine/assets/mine.png': 'mine',
      't-other/assets/theirs.png': 'theirs',
    });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: 't-mine',
      log: silent(),
      deps: b.deps,
    });
    assert.deepEqual(r.restored, ['mine.png']);
    assert.equal(existsSync(join(dir, 'assets', 'theirs.png')), false);
  });

  it('a failed download does not abort the restore', async () => {
    // A cell that refuses to boot because one GET 502'd is worse than a cell
    // with one missing image, and the next boot retries for free.
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: {
        listObjects: async () => [{ key: 'assets/aaaaaaaa.png' }, { key: 'assets/bbbbbbbb.png' }],
        getObject: async (_c, key) => {
          if (key.includes('aaaa')) throw new Error('502');
          return Buffer.from('two');
        },
      },
    });
    assert.deepEqual(r.restored, ['bbbbbbbb.png']);
    assert.equal(r.failed.length, 1);
  });

  it('an unreachable bucket is reported, never thrown', async () => {
    const dir = tmp();
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: {
        listObjects: async () => {
          throw new Error('network');
        },
      },
    });
    assert.deepEqual(r.restored, []);
    assert.equal(r.listed, 0);
  });

  it('no storage configured is a clean no-op', async () => {
    const r = await hydrateAssets({ designRoot: tmp(), s3: null, log: silent() });
    assert.deepEqual(r.restored, []);
  });

  it('leaves no temp file behind on success', async () => {
    // Temp + rename, so a crash mid-restore cannot leave a truncated image that
    // every later reader treats as a real asset.
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const b = bucket({ 'assets/aaaaaaaa.png': 'bytes' });
    await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: b.deps,
    });
    const { readdirSync } = await import('node:fs');
    assert.deepEqual(readdirSync(join(dir, 'assets')), ['aaaaaaaa.png']);
  });

  it('a listing that vanishes between LIST and GET is a reported miss, not a crash', async () => {
    const dir = tmp();
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const r = await hydrateAssets({
      designRoot: dir,
      s3: { bucket: 'x' },
      prefix: '',
      log: silent(),
      deps: {
        listObjects: async () => [{ key: 'assets/aaaaaaaa.png' }],
        getObject: async () => null,
      },
    });
    assert.deepEqual(r.restored, []);
    assert.equal(r.failed[0].reason, 'not found in the bucket');
  });
});
