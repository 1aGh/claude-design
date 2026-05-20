// canvas-lib-resolver — virtual specifier `@maude/canvas-lib` → the dev-server-
// bundled canvas-lib (Phase 3.6.1 Task 2; relocated to dev-server in Phase
// 4.0.5 per DDR-025).

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { buildCanvasModule } from '../canvas-build.ts';
import {
  CANVAS_LIB_SPECIFIER,
  canvasLibPath,
  readCanvasLibSource,
} from '../canvas-lib-resolver.ts';

const TMP = `/tmp/canvas-lib-resolver-${Math.random().toString(36).slice(2, 8)}`;
const DESIGN_ROOT = path.join(TMP, 'designRoot');

beforeAll(async () => {
  await mkdir(DESIGN_ROOT, { recursive: true });
});

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe('canvas-lib-resolver / canvasLibPath', () => {
  test('returns the dev-server-internal canvas-lib.tsx path', () => {
    const p = canvasLibPath();
    expect(p.endsWith('plugins/design/dev-server/canvas-lib.tsx')).toBe(true);
    expect(existsSync(p)).toBe(true);
  });

  test('ignores the legacy designRoot argument (back-compat shim)', () => {
    expect(canvasLibPath('/foo/bar')).toBe(canvasLibPath());
  });

  test('CANVAS_LIB_SPECIFIER is `@maude/canvas-lib`', () => {
    expect(CANVAS_LIB_SPECIFIER).toBe('@maude/canvas-lib');
  });
});

describe('canvas-lib-resolver / canvasLibResolver plugin', () => {
  test('resolves @maude/canvas-lib through Bun.build', async () => {
    const canvasPath = path.join(DESIGN_ROOT, 'ui', 'Resolves.tsx');
    await mkdir(path.dirname(canvasPath), { recursive: true });
    const canvasSource =
      `import { DesignCanvas, DCArtboard } from "@maude/canvas-lib";\n` +
      'export default function Demo() {\n' +
      '  return <DesignCanvas><DCArtboard>hi</DCArtboard></DesignCanvas>;\n' +
      '}\n';
    await writeFile(canvasPath, canvasSource);
    const r = await buildCanvasModule(canvasPath, canvasSource, {
      designRoot: DESIGN_ROOT,
    });
    // The bundled output should contain the resolved lib's function bodies.
    expect(r.js).toContain('dc-canvas');
    expect(r.js).toContain('dc-artboard');
    // The bare specifier should NOT survive as an import.
    expect(r.js).not.toMatch(/from\s*["']@maude\/canvas-lib["']/);
  });

  test('does not interfere with canvases that never import the lib', async () => {
    const canvasPath = path.join(DESIGN_ROOT, 'ui', 'PlainNoLib.tsx');
    await mkdir(path.dirname(canvasPath), { recursive: true });
    const canvasSource = 'export default function Y() { return <button>hi</button>; }\n';
    await writeFile(canvasPath, canvasSource);
    const r = await buildCanvasModule(canvasPath, canvasSource, {
      designRoot: DESIGN_ROOT,
    });
    expect(r.js).toContain('button');
  });
});

describe('canvas-lib-resolver / readCanvasLibSource', () => {
  test('reads the dev-server-bundled lib source', async () => {
    const src = await readCanvasLibSource();
    // Real bundled lib — assert a stable export name shows up.
    expect(src).toContain('DesignCanvas');
  });

  test('ignores the legacy designRoot argument', async () => {
    const src = await readCanvasLibSource('/non-existent-design-root');
    expect(src).toContain('DesignCanvas');
  });
});

describe('canvas-lib-resolver / legacy deprecation guard', () => {
  test('legacy <designRoot>/_lib/canvas-lib.tsx is ignored — dev-server bundled lib wins', async () => {
    const projRoot = path.join(TMP, 'legacy-project');
    const legacyLibDir = path.join(projRoot, '_lib');
    await mkdir(legacyLibDir, { recursive: true });
    // Plant a syntactically-bogus legacy file. If the resolver were still
    // reading from `<designRoot>/_lib/canvas-lib.tsx` this would explode at
    // bundle time; with the dev-server-bundled lib it must be a no-op.
    await writeFile(
      path.join(legacyLibDir, 'canvas-lib.tsx'),
      '// LEGACY — should be ignored\nexport const SHOULD_NOT_APPEAR = true;\n'
    );
    const canvasPath = path.join(projRoot, 'ui', 'Legacy.tsx');
    await mkdir(path.dirname(canvasPath), { recursive: true });
    const canvasSource =
      `import { DesignCanvas } from "@maude/canvas-lib";\n` +
      'export default function L() { return <DesignCanvas>hi</DesignCanvas>; }\n';
    await writeFile(canvasPath, canvasSource);
    const r = await buildCanvasModule(canvasPath, canvasSource, { designRoot: projRoot });
    expect(r.js).toContain('dc-canvas');
    expect(r.js).not.toContain('SHOULD_NOT_APPEAR');
  });
});
