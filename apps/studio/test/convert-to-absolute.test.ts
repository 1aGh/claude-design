// convert-to-absolute — feature-4 T8 (DDR-188). The pure AST batch writer behind
// the context-menu "Convert children to absolute position" (Figma's "Remove auto
// layout"): rewrite each stamped child to position:absolute with the frozen box,
// set the container position:relative, all in ONE MagicString pass (→ one undo
// seq). Mirrors canvas-edit.test.ts: raw source → transpile-computed ids → apply.

import { describe, expect, test } from 'bun:test';

import { applyConvertToAbsolute, CanvasEditError } from '../canvas-edit.ts';
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

describe('canvas-edit / applyConvertToAbsolute', () => {
  test('converts flow children to absolute + sets container relative (one pass)', () => {
    const src = `function Demo() { return <div className="hero"><h1>Title</h1><button>Go</button></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: true,
      children: [
        { id: ids.h1 as string, left: 10, top: 20, width: 100, height: 30 },
        { id: ids.button as string, left: 12, top: 60, width: 80, height: 40 },
      ],
    });
    // Container relative (new style attr is inserted right after the tag name).
    expect(out.source).toContain('<div style={{ position: "relative" }} className="hero">');
    // Each child: absolute + frozen border-box + box-sizing.
    expect(out.source).toContain(
      '<h1 style={{ position: "absolute", left: "10px", top: "20px", width: "100px", height: "30px", "box-sizing": "border-box" }}>'
    );
    expect(out.source).toContain(
      '<button style={{ position: "absolute", left: "12px", top: "60px", width: "80px", height: "40px", "box-sizing": "border-box" }}>'
    );
    // Exactly ONE style attr per element (no duplicate-insert bug).
    expect((out.source.match(/style=\{\{/g) || []).length).toBe(3);
  });

  test('containerSetRelative=false leaves the container untouched', () => {
    const src = `function Demo() { return <div className="hero"><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: false,
      children: [{ id: ids.h1 as string, left: 0, top: 0, width: 50, height: 20 }],
    });
    expect(out.source).toContain('<div className="hero">');
    expect(out.source).not.toContain('position: "relative"');
    expect(out.source).toContain('position: "absolute"');
  });

  test('merges into a child that already has an inline style (no duplicate style attr)', () => {
    const src = `function Demo() { return <div><h1 style={{ color: "red" }}>T</h1></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: true,
      children: [{ id: ids.h1 as string, left: 5, top: 6, width: 10, height: 12 }],
    });
    // The h1 keeps color AND gains the absolute props — ONE style attribute.
    expect((out.source.match(/<h1 style=\{\{/g) || []).length).toBe(1);
    expect(out.source).toContain('color: "red"');
    expect(out.source).toContain('position: "absolute"');
    expect(out.source).toContain('left: "5px"');
  });

  test('throws when a child id is not found', () => {
    const src = `function Demo() { return <div><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [{ id: 'deadbeef', left: 0, top: 0, width: 1, height: 1 }],
      })
    ).toThrow(CanvasEditError);
  });

  test('throws when there are no children to convert', () => {
    const src = `function Demo() { return <div><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [],
      })
    ).toThrow(CanvasEditError);
  });

  test('a child that resolves to a shared component instance is refused', () => {
    // Two <Card/> usages → the inner element's cd-id maps to a component; passing
    // an idIndex makes resolveUsageId route to a <Card/> usage (id changes) →
    // the shared-instance abort fires.
    const src = `
      function Card() { return <article className="card"><h2>Hi</h2></article>; }
      function Demo() { return <div><Card /><Card /></div>; }
    `;
    const ids = idsOf(src);
    // The inner <h2> is the shared element; with an occurrence index it resolves
    // to a <Card/> usage.
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [{ id: ids.h2 as string, idIndex: 0, left: 0, top: 0, width: 1, height: 1 }],
      })
    ).toThrow(CanvasEditError);
  });
});
