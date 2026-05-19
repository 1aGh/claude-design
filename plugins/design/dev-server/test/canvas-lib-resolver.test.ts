// canvas-lib-resolver — virtual specifier `@mdcc/canvas-lib` → on-disk
// `<designRoot>/_lib/canvas-lib.tsx`. Phase 3.6.1 Task 2.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { buildCanvasModule } from '../canvas-build.ts';
import {
  CANVAS_LIB_SPECIFIER,
  canvasLibPath,
  canvasLibResolver,
  readCanvasLibSource,
} from '../canvas-lib-resolver.ts';

const TMP = `/tmp/canvas-lib-resolver-${Math.random().toString(36).slice(2, 8)}`;
const DESIGN_ROOT = path.join(TMP, 'designRoot');
const LIB_DIR = path.join(DESIGN_ROOT, '_lib');
const LIB_PATH = path.join(LIB_DIR, 'canvas-lib.tsx');

const LIB_SOURCE =
  `import type { ReactNode } from "react";\n` +
  'export function DesignCanvas({ children }: { children: ReactNode }) {\n' +
  `  return <div className="dc-canvas">{children}</div>;\n` +
  '}\n' +
  'export function DCArtboard({ children }: { children: ReactNode }) {\n' +
  `  return <article className="dc-artboard">{children}</article>;\n` +
  '}\n';

beforeAll(async () => {
  await mkdir(LIB_DIR, { recursive: true });
  await writeFile(LIB_PATH, LIB_SOURCE);
});

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

describe('canvas-lib-resolver / canvasLibPath', () => {
  test('joins designRoot + _lib + canvas-lib.tsx', () => {
    expect(canvasLibPath('/foo/bar')).toBe('/foo/bar/_lib/canvas-lib.tsx');
  });

  test('CANVAS_LIB_SPECIFIER is `@mdcc/canvas-lib`', () => {
    expect(CANVAS_LIB_SPECIFIER).toBe('@mdcc/canvas-lib');
  });
});

describe('canvas-lib-resolver / canvasLibResolver plugin', () => {
  test('resolves @mdcc/canvas-lib through Bun.build', async () => {
    const canvasPath = path.join(DESIGN_ROOT, 'ui', 'Resolves.tsx');
    await mkdir(path.dirname(canvasPath), { recursive: true });
    const canvasSource =
      `import { DesignCanvas, DCArtboard } from "@mdcc/canvas-lib";\n` +
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
    expect(r.js).not.toMatch(/from\s*["']@mdcc\/canvas-lib["']/);
  });

  test('fails loud when @mdcc/canvas-lib is imported but lib missing', async () => {
    const emptyRoot = path.join(TMP, 'empty');
    await mkdir(emptyRoot, { recursive: true });
    const canvasPath = path.join(emptyRoot, 'Missing.tsx');
    const canvasSource =
      `import { DesignCanvas } from "@mdcc/canvas-lib";\n` +
      'export default function X() { return <DesignCanvas>x</DesignCanvas>; }\n';
    await writeFile(canvasPath, canvasSource);
    await expect(
      buildCanvasModule(canvasPath, canvasSource, { designRoot: emptyRoot })
    ).rejects.toThrow(/@mdcc\/canvas-lib/);
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
  test('reads the on-disk lib source', async () => {
    const src = await readCanvasLibSource(DESIGN_ROOT);
    expect(src).toContain('export function DesignCanvas');
  });

  test('throws on missing lib', async () => {
    const empty = path.join(TMP, 'empty-read');
    await mkdir(empty, { recursive: true });
    await expect(readCanvasLibSource(empty)).rejects.toThrow(/canvas library missing/);
  });
});
