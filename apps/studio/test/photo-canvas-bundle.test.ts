// photo-canvas-bundle.test.ts — the automated guard for the lazy-bundle
// acceptance criterion + BUILDER's flagged top risk (feature-photo-editor).
//
// A canvas that uses <PhotoLayer> with a NEUTRAL edit must pay ZERO pixi.js cost:
// the ~500 KB pixi runtime must stay behind a LAZY runtime `import("pixi.js")`,
// never an eager top-level `import ... from "pixi.js"`. Canvas builds run with
// `splitting: false`, so this is fragile — a future refactor that turns the
// compositor's pixi import back into a static import (or statically imports
// pipeline.ts from canvas-lib) would silently re-break it. This test bundles a
// real canvas via the actual dev-server pipeline and inspects the output.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildCanvasModule } from '../canvas-build.ts';

const CANVAS = `
import { DesignCanvas, DCArtboard, PhotoLayer } from '@maude/canvas-lib';
export default function C() {
  return (
    <DesignCanvas>
      <DCArtboard id="a" width={200} height={200}>
        <PhotoLayer source="assets/aaaa1111.png" edit={{}} width={120} height={120} alt="photo" />
      </DCArtboard>
    </DesignCanvas>
  );
}
`;

async function buildCanvas(source: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'maude-photo-bundle-'));
  const abs = join(dir, 'probe.tsx');
  writeFileSync(abs, source);
  try {
    const { js } = await buildCanvasModule(abs, source, {});
    return js;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('lazy-bundle guarantee — <PhotoLayer> keeps pixi out of the eager graph', () => {
  test('an unedited PhotoLayer canvas has NO eager `from "pixi.js"` import', async () => {
    const js = await buildCanvas(CANVAS);
    const eager = [...js.matchAll(/import\s[^;]*?from\s*["']pixi\.js["']/g)];
    expect(eager.length).toBe(0);
  });

  test('pixi is reachable only via a lazy runtime import("pixi.js")', async () => {
    const js = await buildCanvas(CANVAS);
    expect(/import\(\s*["']pixi\.js["']\s*\)/.test(js)).toBe(true);
  });

  test('the canvas still bundles PhotoLayer itself (sanity — the import resolved)', async () => {
    const js = await buildCanvas(CANVAS);
    // isDefaultEdit is the schema helper <PhotoLayer> calls on the render path.
    expect(js.includes('isDefaultEdit') || js.includes('PhotoLayer')).toBe(true);
  });
});

describe('lazy-bundle guarantee — the export-capture bridge keeps dom-to-svg out of the eager graph', () => {
  // DDR-231: every canvas mounts useExportCaptureBridge (via DesignCanvas), so
  // an EAGER dom-to-svg import would tax every canvas load with the ~110 KB
  // bundle. Same fragility as pixi: canvas builds run `splitting: false`, and
  // a refactor that turns the bridge's `await import('dom-to-svg')` static
  // silently re-breaks this.
  test('a plain canvas has NO eager `from "dom-to-svg"` import', async () => {
    const js = await buildCanvas(CANVAS);
    const eager = [...js.matchAll(/import\s[^;]*?from\s*["']dom-to-svg["']/g)];
    expect(eager.length).toBe(0);
  });

  test('dom-to-svg is reachable only via a lazy runtime import("dom-to-svg")', async () => {
    const js = await buildCanvas(CANVAS);
    expect(/import\(\s*["']dom-to-svg["']\s*\)/.test(js)).toBe(true);
  });
});
