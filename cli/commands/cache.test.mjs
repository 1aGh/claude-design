// `maude cache` CLI end-to-end via spawnSync — seeds a temp cache dir through
// the cache lib, then exercises list / stats / inspect / clear over the bin.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getOrCompute, write } from '../lib/cache.mjs';

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'maude.mjs');

function runCli(args, cacheDir) {
  return spawnSync(process.execPath, [BIN, 'cache', ...args], {
    encoding: 'utf8',
    env: { ...process.env, MAUDE_CACHE_DIR: cacheDir },
  });
}

async function withCache(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'maude-cli-cache-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('cache help prints subcommand summary', async () => {
  await withCache((dir) => {
    const res = runCli(['help'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /maude cache <get\|put\|list\|stats\|inspect\|clear>/);
  });
});

test('cache list reports "empty" before any writes', async () => {
  await withCache((dir) => {
    const res = runCli(['list'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /cache is empty/);
  });
});

test('cache list shows seeded layers with entry counts', async () => {
  await withCache((dir) => {
    write('research/domain', 'finance.aaa', { mood: 1 }, {}, { cacheDir: dir });
    write('research/domain', 'finance.bbb', { mood: 2 }, {}, { cacheDir: dir });
    write('codebase-intelligence', 'sha123', { files: 9 }, {}, { cacheDir: dir });
    const res = runCli(['list'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /research\s+2/);
    assert.match(res.stdout, /codebase-intelligence\s+1/);
  });
});

test('cache stats reports hit-rate after getOrCompute activity', async () => {
  await withCache(async (dir) => {
    const base = {
      cacheDir: dir,
      layer: 'codebase-intelligence',
      key: 'k',
      ttlMs: 60_000,
      compute: () => ({ v: 1 }),
    };
    await getOrCompute(base); // miss
    await getOrCompute(base); // hit
    const res = runCli(['stats'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /codebase-intelligence/);
    assert.match(res.stdout, /50%/);
  });
});

test('cache inspect lists entries, and prints one entry by key', async () => {
  await withCache((dir) => {
    write('design-context', 'ds/tok1', { tokens: 42 }, { dsName: 'ds' }, { cacheDir: dir });
    const listRes = runCli(['inspect', 'design-context'], dir);
    assert.equal(listRes.status, 0, listRes.stderr);
    assert.match(listRes.stdout, /ds\/tok1/);

    const oneRes = runCli(['inspect', 'design-context', 'ds/tok1'], dir);
    assert.equal(oneRes.status, 0, oneRes.stderr);
    assert.match(oneRes.stdout, /"tokens": 42/);
  });
});

test('cache clear <layer> wipes only that layer', async () => {
  await withCache((dir) => {
    write('research/domain', 'a', { x: 1 }, {}, { cacheDir: dir });
    write('codebase-intelligence', 'b', { x: 2 }, {}, { cacheDir: dir });
    const res = runCli(['clear', 'research/domain'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /cleared layer "research\/domain"/);
    assert.ok(!existsSync(join(dir, 'research', 'domain')));
    assert.ok(existsSync(join(dir, 'codebase-intelligence')));
  });
});

test('cache clear with no args wipes everything', async () => {
  await withCache((dir) => {
    write('research/domain', 'a', { x: 1 }, {}, { cacheDir: dir });
    const res = runCli(['clear'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /cleared entire cache/);
    assert.ok(!existsSync(join(dir, 'research')));
  });
});

test('get prints compact JSON on a fresh hit (exit 0), nothing on miss (exit 1)', async () => {
  await withCache((dir) => {
    write('codebase-intelligence', 'sha9', { files: 142 }, {}, { cacheDir: dir });
    const hit = runCli(['get', 'codebase-intelligence', 'sha9'], dir);
    assert.equal(hit.status, 0, hit.stderr);
    assert.equal(hit.stdout.trim(), '{"files":142}');

    const miss = runCli(['get', 'codebase-intelligence', 'absent'], dir);
    assert.equal(miss.status, 1);
    assert.equal(miss.stdout, '');
  });
});

test('get treats a past-TTL entry as a miss (exit 1)', async () => {
  await withCache((dir) => {
    const { path } = write('security', 'head1', { verdict: 'PASS' }, {}, { cacheDir: dir });
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    stored.writtenAt = Date.now() - 2 * 60 * 60 * 1000; // 2 h old
    writeFileSync(path, JSON.stringify(stored), 'utf8');
    const res = runCli(['get', 'security', 'head1', '--ttl-ms', String(60 * 60 * 1000)], dir);
    assert.equal(res.status, 1, 'past-TTL must be a miss');
  });
});

test('get feeds maude cache stats (hit + miss counters)', async () => {
  await withCache((dir) => {
    write('research/domain', 'k', { v: 1 }, {}, { cacheDir: dir });
    runCli(['get', 'research/domain', 'k'], dir); // hit
    runCli(['get', 'research/domain', 'absent'], dir); // miss
    const res = runCli(['stats'], dir);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /research\/domain/);
    assert.match(res.stdout, /50%/);
  });
});

test('put writes a value (from file) that get then reads back', async () => {
  await withCache((dir) => {
    const f = join(dir, 'payload.json');
    writeFileSync(f, JSON.stringify({ mood: ['calm'], queries: 7 }), 'utf8');
    const put = runCli(['put', 'research/domain', 'finance--discovery', f], dir);
    assert.equal(put.status, 0, put.stderr);
    const get = runCli(['get', 'research/domain', 'finance--discovery'], dir);
    assert.equal(get.status, 0);
    assert.deepEqual(JSON.parse(get.stdout), { mood: ['calm'], queries: 7 });
  });
});

test('unknown subcommand exits non-zero', async () => {
  await withCache((dir) => {
    const res = runCli(['frobnicate'], dir);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /unknown subcommand/);
  });
});
