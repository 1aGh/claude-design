// canvas-rects.test.ts — feature-whiteboard-ai-toolkit. Unit + fixture
// coverage for the STATIC (no-browser) fallback shim behind
// `maude design canvas-rects`. The LIVE lane (window.__maudeCanvasRects,
// canvas-lib.tsx) is verified via a real render (agent-browser), not here —
// this file covers the deterministic offline path: JSX seed harvesting, the
// default-grid layout, and the meta.json position merge, which together must
// mirror DesignCanvasInner's `initialArtboards()` (canvas-lib.tsx) exactly so
// the static fallback never disagrees with what the browser would compute.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { harvestSeeds, resolveArtboards, synthDefaultGrid } from '../bin/_canvas-rects-static.mjs';

describe('harvestSeeds', () => {
  test('extracts id/width/height in document order', () => {
    const source = `
      <DCArtboard id="hero" label="Hero" width={1200} height={800}>x</DCArtboard>
      <DCArtboard id="footer" label="Footer" width={1200} height={400}>y</DCArtboard>
    `;
    expect(harvestSeeds(source)).toEqual([
      { id: 'hero', w: 1200, h: 800 },
      { id: 'footer', w: 1200, h: 400 },
    ]);
  });

  test('defaults width/height to VP_GRID (1280x820) when absent', () => {
    const source = `<DCArtboard id="bare" label="Bare">x</DCArtboard>`;
    expect(harvestSeeds(source)).toEqual([{ id: 'bare', w: 1280, h: 820 }]);
  });

  test('mints __ab_N when id is missing', () => {
    const source = `<DCArtboard label="No id" width={100} height={100}>x</DCArtboard>`;
    expect(harvestSeeds(source)).toEqual([{ id: '__ab_0', w: 100, h: 100 }]);
  });

  test('is robust to attribute order', () => {
    const source = `<DCArtboard height={500} width={900} id="reordered">x</DCArtboard>`;
    expect(harvestSeeds(source)).toEqual([{ id: 'reordered', w: 900, h: 500 }]);
  });

  test('empty source yields no seeds', () => {
    expect(harvestSeeds('')).toEqual([]);
  });
});

describe('synthDefaultGrid', () => {
  test('mirrors canvas-lib.tsx VP_GRID (3 cols, 80px gutter, cell = max dims)', () => {
    const seeds = [
      { id: 'a', w: 1200, h: 800 },
      { id: 'b', w: 1440, h: 900 }, // largest — sets the cell size
      { id: 'c', w: 1200, h: 800 },
      { id: 'd', w: 1200, h: 800 }, // wraps to row 1 (col 0)
    ];
    const rects = synthDefaultGrid(seeds);
    expect(rects).toEqual([
      { id: 'a', x: 0, y: 0, w: 1200, h: 800 },
      { id: 'b', x: 1440 + 80, y: 0, w: 1440, h: 900 },
      { id: 'c', x: (1440 + 80) * 2, y: 0, w: 1200, h: 800 },
      { id: 'd', x: 0, y: 900 + 80, w: 1200, h: 800 },
    ]);
  });

  test('empty seeds yields no rects', () => {
    expect(synthDefaultGrid([])).toEqual([]);
  });
});

describe('resolveArtboards', () => {
  const source = `
    <DCArtboard id="a" label="A" width={1200} height={800}>x</DCArtboard>
    <DCArtboard id="b" label="B" width={1200} height={800}>y</DCArtboard>
  `;

  test('no meta layout — falls back to the default grid entirely', () => {
    expect(resolveArtboards(source, [])).toEqual([
      { id: 'a', x: 0, y: 0, w: 1200, h: 800 },
      { id: 'b', x: 1280, w: 1200, h: 800, y: 0 },
    ]);
  });

  test('meta layout overrides x/y but JSX width/height stays authoritative (DDR-027)', () => {
    const layout = [{ id: 'a', x: 5000, y: 3000 }];
    const out = resolveArtboards(source, layout);
    expect(out[0]).toEqual({ id: 'a', x: 5000, y: 3000, w: 1200, h: 800 });
    // 'b' has no matching layout entry — stays on the default grid.
    expect(out[1]).toEqual({ id: 'b', x: 1280, y: 0, w: 1200, h: 800 });
  });

  test('a legacy meta w/h wins over the JSX default (back-compat tolerance)', () => {
    const layout = [{ id: 'a', x: 10, y: 20, w: 999, h: 555 }];
    expect(resolveArtboards(source, layout)[0]).toEqual({ id: 'a', x: 10, y: 20, w: 999, h: 555 });
  });

  test('non-finite / zero meta values fall back to the default', () => {
    const layout = [{ id: 'a', x: Number.NaN, y: 20, w: 0, h: -5 }];
    expect(resolveArtboards(source, layout)[0]).toEqual({ id: 'a', x: 0, y: 20, w: 1200, h: 800 });
  });
});

describe('canvas-rects.sh static fallback (fixture, no browser)', () => {
  test('emits a manifest matching the canvas fixture, elements always empty', () => {
    const root = mkdtempSync(join(tmpdir(), 'maude-canvas-rects-fixture-'));
    try {
      mkdirSync(join(root, '.design', 'ui'), { recursive: true });
      writeFileSync(
        join(root, '.design', 'ui', 'Fixture.tsx'),
        `export default function Fixture() {
  return (
    <DesignCanvas>
      <DCArtboard id="one" label="One" width={1000} height={600} />
    </DesignCanvas>
  );
}
`
      );
      writeFileSync(
        join(root, '.design', 'ui', 'Fixture.meta.json'),
        JSON.stringify({ layout: { artboards: [{ id: 'one', x: 42, y: 7 }] } })
      );

      const proc = Bun.spawnSync([
        'node',
        new URL('../bin/_canvas-rects-static.mjs', import.meta.url).pathname,
        '--rel',
        'ui/Fixture.tsx',
        '--root',
        root,
      ]);
      const manifest = JSON.parse(proc.stdout.toString().trim());
      expect(manifest).toEqual({
        artboards: [{ id: 'one', x: 42, y: 7, w: 1000, h: 600 }],
        elements: [],
        elementsTruncated: false,
      });
      expect(proc.stderr.toString()).toMatch(/no live dev server/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a missing canvas file emits an empty manifest, not an error', () => {
    const root = mkdtempSync(join(tmpdir(), 'maude-canvas-rects-fixture-'));
    try {
      mkdirSync(join(root, '.design'), { recursive: true });
      const proc = Bun.spawnSync([
        'node',
        new URL('../bin/_canvas-rects-static.mjs', import.meta.url).pathname,
        '--rel',
        'ui/Nope.tsx',
        '--root',
        root,
      ]);
      expect(JSON.parse(proc.stdout.toString().trim())).toEqual({
        artboards: [],
        elements: [],
        elementsTruncated: false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // Security regression (feature-whiteboard-ai-toolkit review, F-path-traversal):
  // --rel used to be joined straight into designRoot with no containment
  // check — a `../` value could read anything readable by the process,
  // unlike the sibling read-annotations.mjs/annotate.mjs lookups (which
  // route the same rel-path shape through fileSlug() flattening). --rel here
  // must stay a real nested path (it locates the actual .tsx on disk), so
  // the fix is a resolve()+startsWith() containment assert instead.
  test('--rel that resolves outside designRoot is rejected, not read', () => {
    const root = mkdtempSync(join(tmpdir(), 'maude-canvas-rects-traversal-'));
    try {
      mkdirSync(join(root, '.design', 'ui'), { recursive: true });
      // A secret OUTSIDE .design that a traversal would try to reach.
      writeFileSync(join(root, 'secret.tsx'), 'export default function Secret(){return null}');

      const proc = Bun.spawnSync([
        'node',
        new URL('../bin/_canvas-rects-static.mjs', import.meta.url).pathname,
        '--rel',
        '../secret.tsx',
        '--root',
        root,
      ]);
      expect(JSON.parse(proc.stdout.toString().trim())).toEqual({
        artboards: [],
        elements: [],
        elementsTruncated: false,
      });
      expect(proc.stderr.toString()).toMatch(/escapes designRoot/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
