// component-map — feature-4 T7a. The Layers panel's purple-instance source:
// `componentMapForCanvas` reports every element that renders through an
// INSTANTIATED component (`<Card/>` referenced as JSX in the file), keyed by
// cd-id. The top-level canvas component (exported/mounted, never referenced as
// JSX here) must NOT mark its elements as instances.

import { describe, expect, test } from 'bun:test';

import { componentMapForCanvas } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

function idsOf(source: string): Record<string, string> {
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const out: Record<string, string> = {};
  for (const m of withIds.matchAll(/<(\w+)([^>]*?)data-cd-id="([0-9a-f]{8})"/g)) {
    if (!out[m[1] as string]) out[m[1] as string] = m[3] as string;
  }
  return out;
}

describe('canvas-edit / componentMapForCanvas', () => {
  test('elements of an instantiated component are instances; the canvas root is not', () => {
    const src = `
      function Card() { return <article className="card"><h2>Hi</h2></article>; }
      function Demo() { return <div><Card /><Card /><p>plain</p></div>; }
    `;
    const ids = idsOf(src);
    const map = componentMapForCanvas(CANVAS, src);
    // Card's own elements → instances of Card (2 usages); article is the root.
    expect(map[ids.article as string]).toEqual({ component: 'Card', root: true, usages: 2 });
    expect(map[ids.h2 as string]).toEqual({ component: 'Card', root: false, usages: 2 });
    // Demo (the canvas component, never referenced as JSX) → NOT in the map.
    expect(map[ids.div as string]).toBeUndefined();
    expect(map[ids.p as string]).toBeUndefined();
  });

  test('no components → empty map', () => {
    const src = `function Demo() { return <div><h1>T</h1></div>; }`;
    const map = componentMapForCanvas(CANVAS, src);
    expect(Object.keys(map)).toHaveLength(0);
  });

  test('unparsable source → empty map (no throw)', () => {
    expect(componentMapForCanvas(CANVAS, 'function {{{')).toEqual({});
  });
});
