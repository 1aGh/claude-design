// figma/assets.ts — batching, caps, and the fail-closed composition (T8).

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyRewrites,
  batchIds,
  FIGMA_ASSET_HOSTS,
  FIGMA_ASSET_MAX_BYTES,
  FIGMA_SVG_MAX_BYTES,
  MAX_ASSETS_PER_IMPORT,
  renderKey,
  resolveAssets,
  type AssetRequest,
  type ResolveDeps,
} from './assets.ts';
import { ImportReport } from './sanitize.ts';

const KEY = 'dGNzRC2kmrmGnOxaBa0RI7';
let keysDir: string;
let realFetch: typeof fetch;
let imageCalls: URL[] = [];

beforeEach(() => {
  keysDir = mkdtempSync(join(tmpdir(), 'maude-figma-assets-keys-'));
  const keysPath = join(keysDir, 'keys.json');
  writeFileSync(keysPath, JSON.stringify({ keys: { figma: 'figd_x'.padEnd(24, 'y') } }), {
    mode: 0o600,
  });
  process.env.MAUDE_GEN_KEYS_PATH = keysPath;
  imageCalls = [];
  realFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rmSync(keysDir, { recursive: true, force: true });
  delete process.env.MAUDE_GEN_KEYS_PATH;
});

/** Stub `/v1/images` — answers a URL for every requested id. */
function stubImages(answer: (id: string) => string | null = (id) => `https://figma.com/r/${id}`) {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    imageCalls.push(url);
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    const images: Record<string, string | null> = {};
    for (const id of ids) images[id] = answer(id);
    return new Response(JSON.stringify({ images }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

interface Recorder {
  staged: string[];
  discarded: string[];
  promoted: string[];
  caps: number[];
}

function makeDeps(over: Partial<ResolveDeps> = {}): { deps: ResolveDeps; rec: Recorder } {
  const rec: Recorder = { staged: [], discarded: [], promoted: [], caps: [] };
  const deps: ResolveDeps = {
    stagingPath: (nodeId, ext) => `/outside/staging/${nodeId.replace(/:/g, '-')}.${ext}`,
    stage: async (_url, outPath, maxBytes) => {
      rec.staged.push(outPath);
      rec.caps.push(maxBytes);
      return { bytes: 1000, ext: outPath.endsWith('.svg') ? 'svg' : 'png' };
    },
    promote: async (stagedPath) => {
      rec.promoted.push(stagedPath);
      return { ref: `/assets/${stagedPath.split('/').pop()?.slice(0, 8)}.png` };
    },
    discard: (p) => rec.discarded.push(p),
    ...over,
  };
  return { deps, rec };
}

const req = (nodeId: string, format: 'svg' | 'png' = 'png'): AssetRequest => ({
  nodeId,
  format,
  placeholder: `/assets/pending-${nodeId.replace(/:/g, '-')}.${format}`,
});

describe('batching — never one call per node', () => {
  test('splits into endpoint-sized batches', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `1:${i}`);
    const batches = batchIds(ids);
    expect(batches.length).toBe(3);
    expect(batches[0].length).toBe(100);
    expect(batches[2].length).toBe(50);
  });

  test('120 assets cost 2 image calls, not 120', async () => {
    stubImages();
    const { deps } = makeDeps();
    const requests = Array.from({ length: 120 }, (_, i) => req(`1:${i}`));
    await resolveAssets(KEY, requests, deps, new ImportReport());
    expect(imageCalls.length).toBe(2);
  });

  test('svg and png are requested separately (format is per-call)', async () => {
    stubImages();
    const { deps } = makeDeps();
    await resolveAssets(KEY, [req('1:1', 'svg'), req('1:2', 'png')], deps, new ImportReport());
    const formats = imageCalls.map((u) => u.searchParams.get('format')).sort();
    expect(formats).toEqual(['png', 'svg']);
  });

  test('no requests means no network call at all', async () => {
    stubImages();
    const { deps } = makeDeps();
    const out = await resolveAssets(KEY, [], deps, new ImportReport());
    expect(imageCalls.length).toBe(0);
    expect(out.resolved).toEqual([]);
  });
});

describe('caps are reported degradations, never silent', () => {
  test('past the asset ceiling the extras are reported, not dropped quietly', async () => {
    stubImages();
    const { deps } = makeDeps();
    const report = new ImportReport();
    const requests = Array.from({ length: MAX_ASSETS_PER_IMPORT + 5 }, (_, i) => req(`1:${i}`));
    await resolveAssets(KEY, requests, deps, report);
    expect(report.count('asset-cap-reached')).toBe(5);
  });

  test('the lane pins a byte cap far below the shared 10 MB default', async () => {
    stubImages();
    const { deps, rec } = makeDeps();
    await resolveAssets(KEY, [req('1:1', 'png'), req('1:2', 'svg')], deps, new ImportReport());
    expect(rec.caps).toContain(FIGMA_ASSET_MAX_BYTES);
    expect(rec.caps).toContain(FIGMA_SVG_MAX_BYTES);
    for (const cap of rec.caps) expect(cap).toBeLessThan(10 * 1024 * 1024);
  });

  test('a node Figma declines to render is reported as skipped', async () => {
    stubImages((id) => (id === '1:2' ? null : `https://figma.com/r/${id}`));
    const { deps } = makeDeps();
    const report = new ImportReport();
    await resolveAssets(KEY, [req('1:1'), req('1:2')], deps, report);
    expect(report.count('asset-skipped')).toBe(1);
  });
});

describe('fail closed — a failure never leaves usable bytes behind', () => {
  test('a download failure discards the staged file and reports', async () => {
    stubImages();
    const { deps, rec } = makeDeps({
      stage: async () => {
        throw new Error('network down');
      },
    });
    const report = new ImportReport();
    const out = await resolveAssets(KEY, [req('1:1')], deps, report);
    expect(out.resolved).toEqual([]);
    expect(rec.discarded.length).toBe(1);
    expect(report.count('asset-skipped')).toBe(1);
  });

  test('a MISSING SANITIZER discards the bytes — the DDR-177 packaged-app case', async () => {
    // The natural (and wrong) recovery is "we already have the bytes". This is
    // the test that pins the right one.
    stubImages();
    const { deps, rec } = makeDeps({
      promote: async () => {
        throw new Error('bun required: happy-dom not bundled');
      },
    });
    const report = new ImportReport();
    const out = await resolveAssets(KEY, [req('1:1', 'svg')], deps, report);
    expect(out.resolved).toEqual([]);
    expect(out.rewrites.size).toBe(0);
    expect(rec.discarded.length).toBe(1);
    expect(report.count('asset-skipped')).toBe(1);
  });

  test('a format mismatch is refused rather than promoted', async () => {
    // We asked for a png and got something that sniffs as svg — the response is
    // not what the request implied, so it must not reach a versioned tree.
    stubImages();
    const { deps, rec } = makeDeps({
      stage: async (_u, out) => {
        rec.staged.push(out);
        return { bytes: 100, ext: 'svg' };
      },
    });
    const report = new ImportReport();
    await resolveAssets(KEY, [req('1:1', 'png')], deps, report);
    expect(rec.promoted).toEqual([]);
    expect(rec.discarded.length).toBe(1);
    expect(report.count('asset-skipped')).toBe(1);
  });

  test('staging happens OUTSIDE the design root', async () => {
    stubImages();
    const { deps, rec } = makeDeps();
    await resolveAssets(KEY, [req('1:1')], deps, new ImportReport());
    for (const p of rec.staged) {
      expect(p).not.toContain('.design');
      expect(p).not.toContain('_history');
    }
  });
});

describe('rewrites', () => {
  test('a resolved asset replaces its placeholder in the emitted source', async () => {
    stubImages();
    const { deps } = makeDeps();
    const request = req('2:1', 'svg');
    const out = await resolveAssets(KEY, [request], deps, new ImportReport());
    const src = `<img src="${request.placeholder}" />`;
    const rewritten = applyRewrites(src, out.rewrites);
    expect(rewritten).not.toContain('pending-');
    expect(rewritten).toContain('/assets/');
  });

  test('an UNRESOLVED placeholder is left in place — a visible break beats a silent gap', async () => {
    stubImages(() => null);
    const { deps } = makeDeps();
    const request = req('2:1', 'svg');
    const out = await resolveAssets(KEY, [request], deps, new ImportReport());
    const src = `<img src="${request.placeholder}" />`;
    expect(applyRewrites(src, out.rewrites)).toBe(src);
  });
});

describe('the host allowlist is frozen and exact', () => {
  test('it names figma.com and the render bucket, and nothing wildcard', () => {
    expect([...FIGMA_ASSET_HOSTS]).toEqual([
      'figma.com',
      'figma-alpha-api.s3.us-west-2.amazonaws.com',
    ]);
    for (const h of FIGMA_ASSET_HOSTS) expect(h).not.toContain('*');
    expect(Object.isFrozen(FIGMA_ASSET_HOSTS)).toBe(true);
  });
});

describe('dedupe by render key — an instance renders as its component', () => {
  test('instance-scoped ids collapse to the component', () => {
    // Figma scopes a node inside an instance as `I<instancePath>;<compId>`.
    expect(renderKey('I2:796;2:794')).toBe('2:794');
    expect(renderKey('I6:799;2:794')).toBe('2:794');
    expect(renderKey('I24:454;103:731')).toBe('103:731');
    // A plain node keys as itself.
    expect(renderKey('2:794')).toBe('2:794');
  });

  test('40 placements of one icon cost ONE render and ONE download', async () => {
    stubImages();
    const { deps, rec } = makeDeps();
    const requests = Array.from({ length: 40 }, (_, i) => ({
      nodeId: `I${i}:1;2:794`,
      format: 'svg' as const,
      placeholder: `/assets/pending-${i}.svg`,
    }));
    const out = await resolveAssets(KEY, requests, deps, new ImportReport());
    expect(imageCalls.length).toBe(1);
    expect(rec.staged.length).toBe(1);
    expect(rec.promoted.length).toBe(1);
    // …and every placement still gets rewritten to that one asset.
    expect(out.rewrites.size).toBe(40);
    expect(new Set(out.rewrites.values()).size).toBe(1);
  });

  test('the cap bounds DISTINCT artwork, not repeated placements', async () => {
    stubImages();
    const { deps } = makeDeps();
    const report = new ImportReport();
    // 400 placements of 3 icons — well under the cap once deduped.
    const requests = Array.from({ length: 400 }, (_, i) => ({
      nodeId: `I${i}:1;9:${i % 3}`,
      format: 'svg' as const,
      placeholder: `/assets/pending-${i}.svg`,
    }));
    await resolveAssets(KEY, requests, deps, report);
    expect(report.count('asset-cap-reached')).toBe(0);
  });

  test('distinct components still each count against the cap', async () => {
    stubImages();
    const { deps } = makeDeps();
    const report = new ImportReport();
    const requests = Array.from({ length: MAX_ASSETS_PER_IMPORT + 7 }, (_, i) => ({
      nodeId: `I1:1;9:${i}`,
      format: 'svg' as const,
      placeholder: `/assets/pending-${i}.svg`,
    }));
    await resolveAssets(KEY, requests, deps, report);
    expect(report.count('asset-cap-reached')).toBe(7);
  });
});

describe('SVG promotes are batched — the canary is a browser launch each', () => {
  test('every staged svg goes through ONE batch call, not N promotes', async () => {
    stubImages();
    const batches: string[][] = [];
    const { deps, rec } = makeDeps({
      promoteSvgBatch: async (paths) => {
        batches.push([...paths]);
        return paths.map((p) => `/assets/${p.split('/').pop()}`);
      },
    });
    const requests = Array.from({ length: 12 }, (_, i) => req(`9:${i}`, 'svg'));
    const out = await resolveAssets(KEY, requests, deps, new ImportReport());
    expect(batches.length).toBe(1);
    expect(batches[0].length).toBe(12);
    expect(rec.promoted).toEqual([]); // the per-file path is not used
    expect(out.rewrites.size).toBe(12);
  });

  test('rasters still take the per-file path', async () => {
    stubImages();
    const batches: string[][] = [];
    const { deps, rec } = makeDeps({
      promoteSvgBatch: async (paths) => {
        batches.push([...paths]);
        return paths.map(() => '/assets/x.svg');
      },
    });
    await resolveAssets(KEY, [req('9:1', 'png')], deps, new ImportReport());
    expect(batches.length).toBe(0);
    expect(rec.promoted.length).toBe(1);
  });

  test('a batch that THROWS fails closed for every file in it', async () => {
    stubImages();
    const { deps, rec } = makeDeps({
      promoteSvgBatch: async () => {
        throw new Error('bun required: happy-dom not bundled');
      },
    });
    const report = new ImportReport();
    const out = await resolveAssets(KEY, [req('9:1', 'svg'), req('9:2', 'svg')], deps, report);
    expect(out.rewrites.size).toBe(0);
    expect(rec.discarded.length).toBe(2);
    expect(report.count('asset-skipped')).toBe(2);
  });

  test('one refused file in a batch does not sink the others', async () => {
    stubImages();
    const { deps, rec } = makeDeps({
      promoteSvgBatch: async (paths) =>
        paths.map((p, i) => (i === 1 ? null : `/assets/ok${i}.svg`)),
    });
    const report = new ImportReport();
    const out = await resolveAssets(
      KEY,
      [req('9:1', 'svg'), req('9:2', 'svg'), req('9:3', 'svg')],
      deps,
      report
    );
    expect(out.rewrites.size).toBe(2);
    expect(rec.discarded.length).toBe(1);
    expect(report.count('asset-skipped')).toBe(1);
  });

  test('a caller without promoteSvgBatch still works (per-file fallback)', async () => {
    stubImages();
    const { deps, rec } = makeDeps();
    const out = await resolveAssets(KEY, [req('9:1', 'svg')], deps, new ImportReport());
    expect(rec.promoted.length).toBe(1);
    expect(out.rewrites.size).toBe(1);
  });
});
