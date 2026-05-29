import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  check,
  clear,
  getOrCompute,
  list,
  resolveCacheRoot,
  sha8,
  stats,
  write,
} from './cache.mjs';

function tmpCache() {
  const dir = mkdtempSync(join(tmpdir(), 'maude-cache-'));
  return { cacheDir: dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('write then check returns the same payload', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('research/domain', 'finance.abc12345', { mood: ['calm'], n: 3 }, {}, { cacheDir });
    const hit = check('research/domain', 'finance.abc12345', { cacheDir });
    assert.ok(hit);
    assert.deepEqual(hit.value, { mood: ['calm'], n: 3 });
    assert.equal(typeof hit.ageMs, 'number');
    assert.ok(hit.ageMs >= 0);
  } finally {
    cleanup();
  }
});

test('first write drops a README documenting the invalidation policy', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('research/domain', 'k', { x: 1 }, {}, { cacheDir });
    const readme = readFileSync(join(cacheDir, 'README.md'), 'utf8');
    assert.match(readme, /Invalidation policy/);
    assert.match(readme, /research\/domain/);
  } finally {
    cleanup();
  }
});

test('check returns null on miss', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    assert.equal(check('research/domain', 'nope', { cacheDir }), null);
  } finally {
    cleanup();
  }
});

test('check returns null on corrupt entry', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    const { path } = write('codebase-intelligence', 'deadbeef', { x: 1 }, {}, { cacheDir });
    writeFileSync(path, '{ this is not json', 'utf8');
    assert.equal(check('codebase-intelligence', 'deadbeef', { cacheDir }), null);
  } finally {
    cleanup();
  }
});

test('getOrCompute serves fresh cache without calling compute', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('design-context', 'ds/tok1', { tokens: 12 }, {}, { cacheDir });
    let called = false;
    const v = await getOrCompute({
      cacheDir,
      layer: 'design-context',
      key: 'ds/tok1',
      ttlMs: 60_000,
      compute: () => {
        called = true;
        return { tokens: 999 };
      },
    });
    assert.deepEqual(v, { tokens: 12 });
    assert.equal(called, false, 'compute must not run on a fresh hit');
  } finally {
    cleanup();
  }
});

test('getOrCompute runs compute on miss and caches the result', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    let calls = 0;
    const opts = {
      cacheDir,
      layer: 'codebase-intelligence',
      key: 'sha-aaa',
      ttlMs: 60_000,
      compute: () => {
        calls += 1;
        return { files: calls };
      },
    };
    const first = await getOrCompute(opts);
    const second = await getOrCompute(opts);
    assert.deepEqual(first, { files: 1 });
    assert.deepEqual(second, { files: 1 }, 'second call must read cache, not recompute');
    assert.equal(calls, 1);
  } finally {
    cleanup();
  }
});

test('getOrCompute recomputes past the ttl window', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    const { path } = write('security', 'head1', { audit: 'old' }, {}, { cacheDir });
    // Backdate the stored writtenAt to 2 h ago (past a 1 h ttl).
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    stored.writtenAt = Date.now() - 2 * 60 * 60 * 1000;
    writeFileSync(path, JSON.stringify(stored), 'utf8');
    const v = await getOrCompute({
      cacheDir,
      layer: 'security',
      key: 'head1',
      ttlMs: 60 * 60 * 1000,
      compute: () => ({ audit: 'fresh' }),
    });
    assert.deepEqual(v, { audit: 'fresh' });
  } finally {
    cleanup();
  }
});

test('getOrCompute force bypasses a fresh hit', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('research/domain', 'x', { v: 'cached' }, {}, { cacheDir });
    const v = await getOrCompute({
      cacheDir,
      layer: 'research/domain',
      key: 'x',
      ttlMs: 60_000,
      force: true,
      compute: () => ({ v: 'recomputed' }),
    });
    assert.deepEqual(v, { v: 'recomputed' });
  } finally {
    cleanup();
  }
});

test('getOrCompute serves a stale entry when compute throws (within maxAge)', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    const { path } = write('research/domain', 'stale', { v: 'old-but-usable' }, {}, { cacheDir });
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    stored.writtenAt = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days old
    writeFileSync(path, JSON.stringify(stored), 'utf8');
    const v = await getOrCompute({
      cacheDir,
      layer: 'research/domain',
      key: 'stale',
      ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 day fresh window → stale
      maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 day ceiling → still usable
      compute: () => {
        throw new Error('websearch down');
      },
    });
    assert.deepEqual(v, { v: 'old-but-usable' });
  } finally {
    cleanup();
  }
});

test('getOrCompute propagates the error when no usable stale entry exists', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    await assert.rejects(
      getOrCompute({
        cacheDir,
        layer: 'research/domain',
        key: 'missing',
        compute: () => {
          throw new Error('boom');
        },
      }),
      /boom/
    );
  } finally {
    cleanup();
  }
});

test('concurrent writes to the same key never corrupt the file', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        Promise.resolve().then(() =>
          write('codebase-intelligence', 'race', { i }, {}, { cacheDir })
        )
      )
    );
    const hit = check('codebase-intelligence', 'race', { cacheDir });
    assert.ok(hit, 'entry must be readable after concurrent writes');
    assert.equal(typeof hit.value.i, 'number');
    assert.ok(hit.value.i >= 0 && hit.value.i < 25);
  } finally {
    cleanup();
  }
});

test('path traversal in layer or key is rejected', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    assert.throws(() => write('../escape', 'k', {}, {}, { cacheDir }), /escapes cache root/);
    assert.throws(() => check('research', '../../etc/passwd', { cacheDir }), /escapes cache root/);
  } finally {
    cleanup();
  }
});

test('clear(layer) removes only that layer; clear() wipes all but README', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('research/domain', 'a', { x: 1 }, {}, { cacheDir });
    write('research/domain', 'b', { x: 2 }, {}, { cacheDir });
    write('codebase-intelligence', 'c', { x: 3 }, {}, { cacheDir });
    writeFileSync(join(cacheDir, 'README.md'), '# cache', 'utf8');

    clear('research/domain', undefined, { cacheDir });
    assert.equal(check('research/domain', 'a', { cacheDir }), null);
    assert.ok(check('codebase-intelligence', 'c', { cacheDir }), 'other layer survives');

    clear(undefined, undefined, { cacheDir });
    assert.equal(check('codebase-intelligence', 'c', { cacheDir }), null);
    assert.equal(readFileSync(join(cacheDir, 'README.md'), 'utf8'), '# cache', 'README preserved');
  } finally {
    cleanup();
  }
});

test('list reports layers with entry counts and bytes', () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    write('research/domain', 'a', { x: 1 }, {}, { cacheDir });
    write('research/domain', 'b', { x: 2 }, {}, { cacheDir });
    write('design-context', 'ds/t', { x: 3 }, {}, { cacheDir });
    const layers = list({ cacheDir });
    const byName = Object.fromEntries(layers.map((l) => [l.layer, l]));
    assert.equal(byName.research.entries, 2);
    assert.equal(byName['design-context'].entries, 1);
    assert.ok(byName.research.bytes > 0);
  } finally {
    cleanup();
  }
});

test('stats accumulate hits and misses per layer', async () => {
  const { cacheDir, cleanup } = tmpCache();
  try {
    const base = {
      cacheDir,
      layer: 'research/domain',
      key: 'k',
      ttlMs: 60_000,
      compute: () => ({ v: 1 }),
    };
    await getOrCompute(base); // miss
    await getOrCompute(base); // hit
    await getOrCompute(base); // hit
    const s = stats({ cacheDir });
    assert.equal(s.misses['research/domain'], 1);
    assert.equal(s.hits['research/domain'], 2);
  } finally {
    cleanup();
  }
});

test('resolveCacheRoot honors MAUDE_CACHE_DIR then CLAUDE_PROJECT_DIR', () => {
  const prev = { m: process.env.MAUDE_CACHE_DIR, c: process.env.CLAUDE_PROJECT_DIR };
  try {
    process.env.MAUDE_CACHE_DIR = '/tmp/explicit-cache';
    assert.equal(resolveCacheRoot(), '/tmp/explicit-cache');
    Reflect.deleteProperty(process.env, 'MAUDE_CACHE_DIR');
    process.env.CLAUDE_PROJECT_DIR = '/tmp/proj';
    assert.equal(resolveCacheRoot(), join('/tmp/proj', '.ai/cache'));
  } finally {
    if (prev.m === undefined) Reflect.deleteProperty(process.env, 'MAUDE_CACHE_DIR');
    else process.env.MAUDE_CACHE_DIR = prev.m;
    if (prev.c === undefined) Reflect.deleteProperty(process.env, 'CLAUDE_PROJECT_DIR');
    else process.env.CLAUDE_PROJECT_DIR = prev.c;
  }
});

test('sha8 is stable and 8 hex chars', () => {
  const a = sha8('finance dashboard');
  const b = sha8('finance dashboard');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(sha8('finance dashboard'), sha8('ecommerce checkout'));
});
