// DDR-217 (fix 6, sync RCA 2026-08-10) — the desktop→cell asset push.
// The properties under test: the listing mirrors the hub's key shape (junk
// stays off the wire), the sweep is HEAD-first (upload only what the cloud
// lacks), the credential is read at call time (silent renewal), and a failed
// upload is reported, never thrown.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listPushableAssets, pushAssets } from '../sync/asset-push.ts';

function scratchDesignRoot(): string {
  return mkdtempSync(join(tmpdir(), 'asset-push-'));
}

describe('listPushableAssets — the courtesy filter mirrors the hub ASSET_KEY', () => {
  test('admits the shapes real projects use, refuses what the hub would', () => {
    const designRoot = scratchDesignRoot();
    const assets = join(designRoot, 'assets');
    mkdirSync(join(assets, 'graphics'), { recursive: true });
    mkdirSync(join(assets, 'fonts'), { recursive: true });
    writeFileSync(join(assets, 'a1b2c3d4.png'), 'x');
    writeFileSync(join(assets, 'gator_badge_roundel.svg'), 'x');
    writeFileSync(join(assets, 'graphics/camo-bg.png'), 'x');
    writeFileSync(join(assets, 'fonts/Gators-Bold.woff2'), 'x');
    writeFileSync(join(assets, '.hidden'), 'x'); // dotfile — fails leading-alnum

    expect(listPushableAssets(designRoot)).toEqual([
      'a1b2c3d4.png',
      'fonts/Gators-Bold.woff2',
      'gator_badge_roundel.svg',
      'graphics/camo-bg.png',
    ]);
  });

  test('depth beyond the hub cap is skipped; a missing assets dir is []', () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets/a/b/c/d/e'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/a/b/c/d/e/too-deep.png'), 'x');
    expect(listPushableAssets(designRoot)).toEqual([]);
    expect(listPushableAssets(join(designRoot, 'nope'))).toEqual([]);
  });
});

describe('pushAssets — HEAD-first, upload the misses, never throw', () => {
  test('skips what the cloud has, PUTs the rest, streams the file bytes', async () => {
    const designRoot = scratchDesignRoot();
    const assets = join(designRoot, 'assets');
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, 'aaaaaaaa.png'), 'already-there');
    writeFileSync(join(assets, 'bbbbbbbb.png'), 'missing-bytes');

    const calls: Array<{ method: string; url: string; auth: string }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ method, url, auth: String(headers.authorization) });
      if (method === 'HEAD')
        return new Response(null, { status: url.includes('aaaa') ? 200 : 404 });
      // The PUT body is the real file — prove the bytes went along.
      const body = await new Response(init?.body as BodyInit).text();
      expect(body).toBe('missing-bytes');
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;

    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://alligators.cloud.maude.sh/',
      token: () => 'mau_tok',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });

    expect(r.skipped).toBe(1);
    expect(r.pushed).toEqual(['bbbbbbbb.png']);
    expect(r.failed).toEqual([]);
    // Trailing slash folded; every call authenticated with the live token.
    expect(calls.every((c) => c.url.startsWith('https://alligators.cloud.maude.sh/assets/'))).toBe(
      true
    );
    expect(calls.every((c) => c.auth === 'Bearer mau_tok')).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'HEAD', 'PUT']);
  });

  test('a refused upload lands in failed — reported, not thrown', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/cccccccc.png'), 'x');

    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: init?.method === 'HEAD' ? 404 : 413 })) as typeof fetch;

    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });
    expect(r.pushed).toEqual([]);
    expect(r.failed).toEqual([{ key: 'cccccccc.png', reason: 'HTTP 413' }]);
  });

  test('a project with no assets dir makes zero network calls', async () => {
    const designRoot = scratchDesignRoot();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });
    expect(calls).toBe(0);
    expect(r).toEqual({ pushed: [], skipped: 0, failed: [] });
  });
});
