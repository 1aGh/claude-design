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
