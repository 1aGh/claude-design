// DDR-217 + the 2026-08-11 addendum — the desktop→cell asset push, both
// classes. Properties under test: the sweep finds top-level content-addressed
// assets AND nested DS/brand assets under system/*/assets/; each routes to the
// right hub endpoint (bucket `/assets/` vs checkout `/_asset-file/`); non-asset
// files (.photo.json) and junk are filtered; the sweep is HEAD-first; the
// credential is read at call time; a failure is reported, never thrown.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { listPushableAssets, pushAssets } from '../sync/asset-push.ts';

function scratchDesignRoot(): string {
  return mkdtempSync(join(tmpdir(), 'asset-push-'));
}

describe('listPushableAssets — every assets/ dir, asset extensions only', () => {
  test('finds top-level content-addressed AND nested DS/brand assets', () => {
    const designRoot = scratchDesignRoot();
    // Class 1 — top-level content-addressed uploads (+ a .photo.json sidecar).
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/a1b2c3d4.png'), 'x');
    writeFileSync(join(designRoot, 'assets/a1b2c3d4.photo.json'), '{}'); // metadata, not an asset
    // Class 2 — DS/brand assets under system/<ds>/assets/ (the ones that stayed grey).
    mkdirSync(join(designRoot, 'system/alligators/assets/logos'), { recursive: true });
    mkdirSync(join(designRoot, 'system/alligators/assets/fonts'), { recursive: true });
    mkdirSync(join(designRoot, 'system/alligators/assets/photos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/alligators/assets/logos/horizontal-green.svg'), 'x');
    writeFileSync(join(designRoot, 'system/alligators/assets/fonts/Gators-Bold.woff2'), 'x');
    writeFileSync(join(designRoot, 'system/alligators/assets/photos/P1020428.JPG'), 'x'); // uppercase ext
    // Not under any assets/ dir → never swept.
    mkdirSync(join(designRoot, 'system/alligators/preview'), { recursive: true });
    writeFileSync(join(designRoot, 'system/alligators/preview/logo.tsx'), 'x');
    // Runtime state is skipped.
    mkdirSync(join(designRoot, '_history/assets'), { recursive: true });
    writeFileSync(join(designRoot, '_history/assets/old.png'), 'x');

    expect(listPushableAssets(designRoot)).toEqual([
      'assets/a1b2c3d4.png',
      'system/alligators/assets/fonts/Gators-Bold.woff2',
      'system/alligators/assets/logos/horizontal-green.svg',
      'system/alligators/assets/photos/P1020428.JPG',
    ]);
  });

  test('non-asset extensions and dotfiles are filtered; missing root is []', () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/notes.txt'), 'x');
    writeFileSync(join(designRoot, 'assets/data.json'), 'x');
    writeFileSync(join(designRoot, 'assets/.hidden'), 'x');
    expect(listPushableAssets(designRoot)).toEqual([]);
    expect(listPushableAssets(join(designRoot, 'nope'))).toEqual([]);
  });

  test('depth beyond the hub 8-segment cap is skipped', () => {
    const designRoot = scratchDesignRoot();
    // assets/a/b/c/d/e/f/g/x.png = 9 segments > 8 → skipped.
    mkdirSync(join(designRoot, 'assets/a/b/c/d/e/f/g'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/a/b/c/d/e/f/g/x.png'), 'x');
    expect(listPushableAssets(designRoot)).toEqual([]);
  });
});

describe('pushAssets — routes each class to the right hub endpoint', () => {
  test('top-level → /assets/, DS → /_asset-file/, HEAD-first, live token', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/aaaaaaaa.png'), 'top-level');
    mkdirSync(join(designRoot, 'system/ds/assets/logos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/ds/assets/logos/mark.svg'), 'brand-bytes');

    const calls: Array<{ method: string; url: string; auth: string }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ method, url, auth: String(headers.authorization) });
      if (method === 'HEAD') return new Response(null, { status: 404 }); // nothing there yet
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;

    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://alligators.cloud.maude.sh/',
      token: () => 'mau_tok',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });

    expect(r.failed).toEqual([]);
    expect(r.pushed.sort()).toEqual(['assets/aaaaaaaa.png', 'system/ds/assets/logos/mark.svg']);
    // Top-level → bucket route; DS → checkout route.
    const puts = calls.filter((c) => c.method === 'PUT').map((c) => c.url);
    expect(puts).toContain('https://alligators.cloud.maude.sh/assets/aaaaaaaa.png');
    expect(puts).toContain(
      'https://alligators.cloud.maude.sh/_asset-file/system/ds/assets/logos/mark.svg'
    );
    expect(calls.every((c) => c.auth === 'Bearer mau_tok')).toBe(true);
  });

  test('skips what the cloud already holds (HEAD 200)', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'system/ds/assets/logos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/ds/assets/logos/there.svg'), 'x');
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: init?.method === 'HEAD' ? 200 : 500 })) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });
    expect(r.skipped).toBe(1);
    expect(r.pushed).toEqual([]);
  });

  test('a refused upload is reported, not thrown', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'system/ds/assets/logos'), { recursive: true });
    writeFileSync(join(designRoot, 'system/ds/assets/logos/x.svg'), 'x');
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: init?.method === 'HEAD' ? 404 : 413 })) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });
    expect(r.pushed).toEqual([]);
    expect(r.failed).toEqual([{ key: 'system/ds/assets/logos/x.svg', reason: 'HTTP 413' }]);
  });

  test('no assets dir → zero network calls', async () => {
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

describe('pushAssets — 429 pacing, 5xx retry, honest failure reasons (RCA 2026-08-11)', () => {
  /** One asset, and a fetch that answers HEAD 404 (nothing on the cloud yet). */
  function oneAsset(): string {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/one.png'), 'bytes');
    return designRoot;
  }

  test('a 429 with Retry-After is waited out once, then the asset lands', async () => {
    const designRoot = oneAsset();
    const slept: number[] = [];
    let puts = 0;
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      puts += 1;
      return puts === 1
        ? new Response('{"error":"rate limit exceeded"}', {
            status: 429,
            headers: { 'retry-after': '30' },
          })
        : new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;

    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(r.pushed).toEqual(['assets/one.png']);
    expect(r.failed).toEqual([]);
    expect(slept).toEqual([30_000]); // the hub's own number, not a guess
    expect(puts).toBe(2);
  });

  test('an absent Retry-After falls back to the 60 s window; a huge one is clamped', async () => {
    for (const [header, expected] of [
      [null, 60_000],
      ['9999', 60_000],
      ['bogus', 60_000],
    ] as const) {
      const designRoot = oneAsset();
      const slept: number[] = [];
      let puts = 0;
      const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'HEAD') return new Response(null, { status: 404 });
        puts += 1;
        return puts === 1
          ? new Response(null, { status: 429, headers: header ? { 'retry-after': header } : {} })
          : new Response(null, { status: 200 });
      }) as typeof fetch;
      const r = await pushAssets({
        designRoot,
        hubUrl: 'https://x.example',
        token: () => 't',
        fetchImpl,
        log: { log: () => {}, warn: () => {} },
        sleep: async (ms) => {
          slept.push(ms);
        },
      });
      expect(slept).toEqual([expected]);
      expect(r.pushed).toEqual(['assets/one.png']);
    }
  });

  test('a second 429 fails the asset and the sweep keeps going', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/a-limited.png'), 'x');
    writeFileSync(join(designRoot, 'assets/b-fine.png'), 'x');
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      return String(input).includes('a-limited')
        ? new Response('{"error":"rate limit exceeded"}', {
            status: 429,
            headers: { 'retry-after': '1' },
          })
        : new Response(null, { status: 200 });
    }) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async () => {},
    });
    expect(r.pushed).toEqual(['assets/b-fine.png']);
    expect(r.failed).toEqual([
      { key: 'assets/a-limited.png', reason: 'HTTP 429 — {"error":"rate limit exceeded"}' },
    ]);
  });

  test('a 5xx gets one immediate retry — no wait, no whole new boot', async () => {
    const designRoot = oneAsset();
    const slept: number[] = [];
    let puts = 0;
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      puts += 1;
      return new Response(null, { status: puts === 1 ? 503 : 200 });
    }) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(r.pushed).toEqual(['assets/one.png']);
    expect(puts).toBe(2);
    expect(slept).toEqual([]);
  });

  test('a 4xx that is not 429 is final — one attempt, reported as-is', async () => {
    const designRoot = oneAsset();
    let puts = 0;
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      puts += 1;
      return new Response(null, { status: 413 });
    }) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async () => {},
    });
    expect(puts).toBe(1);
    expect(r.failed).toEqual([{ key: 'assets/one.png', reason: 'HTTP 413' }]);
  });

  test('the failure reason carries the body — a Cloudflare page is not our 429', async () => {
    const designRoot = oneAsset();
    const page = `<html>\n  <head><title>503 Service Unavailable</title></head>\n  <body>error 1016 — origin DNS error, and a great deal more text than we keep</body>\n</html>`;
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      return new Response(page, { status: 503 });
    }) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async () => {},
    });
    const reason = r.failed[0].reason;
    expect(reason.startsWith('HTTP 503 — <html> <head><title>503 Service Unavailable')).toBe(true);
    expect(reason.includes('\n')).toBe(false); // collapsed, never multi-line in the panel
    expect(reason.length).toBeLessThanOrEqual('HTTP 503 — '.length + 80);
  });

  test('every PUT carries an explicit Content-Length (the .mov chunked-503 probe)', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/sized.png'), 'twelve bytes');
    const lengths: string[] = [];
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 404 });
      const sent = (init?.headers ?? {}) as Record<string, string>;
      lengths.push(String(sent['content-length']));
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
    });
    expect(lengths).toEqual([String('twelve bytes'.length)]);
  });

  test('the per-sweep backoff budget is finite — a 429 wall stops costing time', async () => {
    // 10 assets, every one 429 with a 60 s Retry-After: the 5-minute sweep
    // budget buys 5 paced retries, the rest fail fast for the next boot.
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    for (let i = 0; i < 10; i++) writeFileSync(join(designRoot, `assets/a${i}.png`), 'x');
    const slept: number[] = [];
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'HEAD'
        ? new Response(null, { status: 404 })
        : new Response(null, { status: 429, headers: { 'retry-after': '60' } })) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(r.failed).toHaveLength(10);
    expect(slept).toEqual([60_000, 60_000, 60_000, 60_000, 60_000]);
  });
});

describe('pushAssets — incremental progress (feature-sync-progress-modal)', () => {
  test('emits a first, per-failure and final progress; the final has finished:true', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/ok.png'), 'x');
    writeFileSync(join(designRoot, 'assets/skipme.png'), 'x');
    writeFileSync(join(designRoot, 'assets/zz-bad.png'), 'x');
    // HEAD: only skipme.png is already there. PUT: zz-bad.png fails.
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'HEAD')
        return new Response(null, { status: url.includes('skipme') ? 200 : 404 });
      return new Response(null, { status: url.includes('zz-bad') ? 500 : 200 });
    }) as typeof fetch;
    const emits: import('../sync/asset-push.ts').AssetPushProgress[] = [];
    let t = 0;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      onProgress: (p) => emits.push(p),
      now: () => (t += 1), // 1ms apart — inside the throttle window
    });
    expect(r.pushed).toEqual(['assets/ok.png']);
    // First emit fires before anything settles (total known, push visible).
    expect(emits[0]).toMatchObject({ total: 3, done: 0, finished: false });
    // The failure force-emits through the throttle.
    expect(emits.some((p) => p.failedCount === 1 && !p.finished)).toBe(true);
    // Final emit always fires, with the full tally and no active file.
    const last = emits[emits.length - 1];
    expect(last).toEqual({
      total: 3,
      done: 3,
      pushed: 1,
      skipped: 1,
      failedCount: 1,
      failures: [{ key: 'assets/zz-bad.png', reason: 'HTTP 500' }],
      active: null,
      finished: true,
    });
  });

  test('mid-flight emits are throttled; a slow clock lets them through', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    for (let i = 0; i < 5; i++) writeFileSync(join(designRoot, `assets/a${i}.png`), 'x');
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 })) as typeof fetch;
    // Fast clock: everything inside 200ms → first + final only.
    const fast: number[] = [];
    await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      onProgress: (p) => fast.push(p.done),
      now: () => 1,
    });
    expect(fast).toHaveLength(2);
    // Slow clock: 300ms between files → every per-file emit passes.
    let t = 0;
    const slow: number[] = [];
    await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      onProgress: (p) => slow.push(p.done),
      now: () => (t += 300),
    });
    expect(slow.length).toBeGreaterThanOrEqual(6);
  });

  test('no assets → no progress emits at all (no empty section in the panel)', async () => {
    const designRoot = scratchDesignRoot();
    const emits: unknown[] = [];
    await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl: (async () => new Response(null, { status: 200 })) as typeof fetch,
      log: { log: () => {}, warn: () => {} },
      onProgress: (p) => emits.push(p),
    });
    expect(emits).toEqual([]);
  });

  test('a throwing progress listener never breaks the push', async () => {
    const designRoot = scratchDesignRoot();
    mkdirSync(join(designRoot, 'assets'), { recursive: true });
    writeFileSync(join(designRoot, 'assets/ok.png'), 'x');
    const fetchImpl = (async (_i: RequestInfo | URL, init?: RequestInit) =>
      new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 })) as typeof fetch;
    const r = await pushAssets({
      designRoot,
      hubUrl: 'https://x.example',
      token: () => 't',
      fetchImpl,
      log: { log: () => {}, warn: () => {} },
      onProgress: () => {
        throw new Error('boom');
      },
    });
    expect(r.pushed).toEqual(['assets/ok.png']);
  });
});
