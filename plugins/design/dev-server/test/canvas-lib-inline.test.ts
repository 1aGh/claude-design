// canvas-lib-inline — Phase 3.6.1 Task 9. Inline used canvas-lib exports
// (+ transitive deps) into a handoff drop.

import { describe, expect, test } from 'bun:test';

import { buildLibMap, inlineUsedExports, type LibMap } from '../canvas-lib-inline.ts';

const LIB_PATH = '/virtual/_lib/canvas-lib.tsx';

const SAMPLE_LIB =
  `import type { ReactNode } from "react";\n` +
  '\n' +
  '/** Root wrapper. */\n' +
  'export function DesignCanvas({ children }: { children: ReactNode }) {\n' +
  `  return <div className="dc-canvas">{children}</div>;\n` +
  '}\n' +
  '\n' +
  'export function DCArtboard({ children }: { children: ReactNode }) {\n' +
  `  return <article className="dc-artboard">{children}</article>;\n` +
  '}\n' +
  '\n' +
  'function internalHelper(name: string): string {\n' +
  '  return name.toUpperCase();\n' +
  '}\n' +
  '\n' +
  'export function TokenChip({ name }: { name: string }) {\n' +
  '  return <code>{internalHelper(name)}</code>;\n' +
  '}\n' +
  '\n' +
  'export function ColorSwatch({ token }: { token: string }) {\n' +
  '  return <div><TokenChip name={token} /></div>;\n' +
  '}\n';

function map(): LibMap {
  return buildLibMap(LIB_PATH, SAMPLE_LIB);
}

describe('canvas-lib-inline / buildLibMap', () => {
  test('records every named export', () => {
    const m = map();
    expect(m.has('DesignCanvas')).toBe(true);
    expect(m.has('DCArtboard')).toBe(true);
    expect(m.has('TokenChip')).toBe(true);
    expect(m.has('ColorSwatch')).toBe(true);
  });

  test('also records internal helpers (reachable for transitive resolution)', () => {
    const m = map();
    expect(m.has('internalHelper')).toBe(true);
  });

  test('captures dep edges (ColorSwatch → TokenChip)', () => {
    const m = map();
    expect(m.get('ColorSwatch')?.deps).toContain('TokenChip');
  });

  test('captures dep edges (TokenChip → internalHelper)', () => {
    const m = map();
    expect(m.get('TokenChip')?.deps).toContain('internalHelper');
  });

  test('captures leading JSDoc comment', () => {
    const m = map();
    expect(m.get('DesignCanvas')?.source).toContain('Root wrapper');
  });

  test('strips leading `export` token from inlined source', () => {
    const m = map();
    expect(m.get('DesignCanvas')?.source).not.toMatch(/^export\s+/);
  });
});

describe('canvas-lib-inline / inlineUsedExports', () => {
  test('no-op when canvas has no @maude/canvas-lib import', () => {
    const canvas = 'export default function X() { return <button>x</button>; }\n';
    const r = inlineUsedExports(canvas, map());
    expect(r.droppedImport).toBe(false);
    expect(r.content).toBe(canvas);
    expect(r.inlined).toEqual([]);
  });

  test('inlines a single export + strips import line', () => {
    const canvas =
      `import { DesignCanvas } from "@maude/canvas-lib";\n` +
      'export default function X() { return <DesignCanvas>hi</DesignCanvas>; }\n';
    const r = inlineUsedExports(canvas, map());
    expect(r.droppedImport).toBe(true);
    expect(r.inlined).toEqual(['DesignCanvas']);
    expect(r.content).not.toContain('@maude/canvas-lib');
    expect(r.content).toContain('function DesignCanvas');
  });

  test('inlines transitive internal deps (ColorSwatch → TokenChip → internalHelper)', () => {
    const canvas =
      `import { ColorSwatch } from "@maude/canvas-lib";\n` +
      `export default function X() { return <ColorSwatch token="--accent" />; }\n`;
    const r = inlineUsedExports(canvas, map());
    expect(r.inlined.sort()).toEqual(['ColorSwatch', 'TokenChip', 'internalHelper']);
    expect(r.content).toContain('function ColorSwatch');
    expect(r.content).toContain('function TokenChip');
    expect(r.content).toContain('function internalHelper');
  });

  test('handles multi-line import with trailing commas', () => {
    const canvas =
      `import {\n  DesignCanvas,\n  DCArtboard,\n} from "@maude/canvas-lib";\n` +
      'export default function X() { return <DesignCanvas><DCArtboard /></DesignCanvas>; }\n';
    const r = inlineUsedExports(canvas, map());
    expect(r.inlined.sort()).toEqual(['DCArtboard', 'DesignCanvas']);
    expect(r.content).not.toMatch(/from\s*["']@maude\/canvas-lib["']/);
  });

  test('throws when canvas imports an unknown export', () => {
    const canvas =
      `import { DoesNotExist } from "@maude/canvas-lib";\n` +
      'export default function X() { return <DoesNotExist />; }\n';
    expect(() => inlineUsedExports(canvas, map())).toThrow(/no such export/);
  });

  test('inlined content keeps the canvas default export at the top', () => {
    const canvas =
      `import { DesignCanvas } from "@maude/canvas-lib";\n` +
      'export default function X() { return <DesignCanvas>x</DesignCanvas>; }\n';
    const r = inlineUsedExports(canvas, map());
    const defaultIdx = r.content.indexOf('export default');
    const helperIdx = r.content.indexOf('function DesignCanvas');
    expect(defaultIdx).toBeGreaterThan(-1);
    expect(helperIdx).toBeGreaterThan(defaultIdx);
  });

  test('zero @maude references remain in output', () => {
    const canvas =
      `import { DesignCanvas, ColorSwatch } from "@maude/canvas-lib";\n` +
      `export default function X() { return <DesignCanvas><ColorSwatch token="--x"/></DesignCanvas>; }\n`;
    const r = inlineUsedExports(canvas, map());
    expect(r.content.match(/@maude/g)).toBeNull();
  });

  test('result is at least as large as the original canvas (helpers added)', () => {
    const canvas =
      `import { DesignCanvas } from "@maude/canvas-lib";\n` +
      'export default function X() { return <DesignCanvas>x</DesignCanvas>; }\n';
    const r = inlineUsedExports(canvas, map());
    expect(r.content.length).toBeGreaterThan(canvas.length);
  });
});
