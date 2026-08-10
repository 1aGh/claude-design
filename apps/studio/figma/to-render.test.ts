// figma/to-render.ts — the render-first page → canvas path.
//
// The rules here are the ones the JSX path got wrong on a real 6-page file, so
// each test names the observed failure rather than the abstract behaviour.

import { describe, expect, test } from 'bun:test';

import { ImportReport } from './sanitize.ts';
import { classifyPageChildren, toRenderCanvas } from './to-render.ts';
import { normalizeDocument } from './types.ts';

const KEY = 'dGNzRC2kmrmGnOxaBa0RI7';
const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function pageDoc(children: unknown[]) {
  const doc = normalizeDocument(
    { id: '0:0', name: 'Page', type: 'CANVAS', children },
    { fileKey: KEY, surface: 'design' }
  );
  return { doc, page: doc.root };
}

const frame = (id: string, name = id, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  type: 'FRAME',
  visible: true,
  absoluteBoundingBox: box(0, 0, 375, 812),
  ...extra,
});

describe('classification (the split-personality bug)', () => {
  test('a SECTION contributes its frames as artboards AND itself as a region', () => {
    // Observed: the section landed on the annotation layer while the frames
    // inside it landed as artboards, so the page read as half-migrated.
    const { page } = pageDoc([
      {
        id: '1:1',
        name: 'Flow A',
        type: 'SECTION',
        visible: true,
        absoluteBoundingBox: box(0, 0, 1200, 900),
        children: [frame('1:2', 'Screen 1'), frame('1:3', 'Screen 2')],
      },
    ]);
    const report = new ImportReport();
    const { frames, annotations } = classifyPageChildren(page, report);

    expect(frames.map((f) => f.id)).toEqual(['1:2', '1:3']);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe('1:1');
    // The region travels WITHOUT its contents — they are artboards now.
    expect(annotations[0].children ?? []).toHaveLength(0);
  });

  test('FigJam furniture stays on the annotation layer even in a design file', () => {
    // A flow diagram drawn in CONNECTORs inside a design file is the common case.
    const { page } = pageDoc([
      frame('1:2'),
      { id: '1:9', name: 'note', type: 'STICKY', visible: true, absoluteBoundingBox: box(0, 0, 240, 240) },
      { id: '1:10', name: 'link', type: 'CONNECTOR', visible: true, absoluteBoundingBox: box(0, 0, 100, 10) },
    ]);
    const { frames, annotations } = classifyPageChildren(page, new ImportReport());
    expect(frames.map((f) => f.id)).toEqual(['1:2']);
    expect(annotations.map((a) => a.id).sort()).toEqual(['1:10', '1:9']);
  });

  test('loose page content is never dropped', () => {
    // Silent content loss is this importer's worst failure mode; a stray text
    // node has to land SOMEWHERE.
    const { page } = pageDoc([
      frame('1:2'),
      { id: '1:5', name: 'label', type: 'TEXT', visible: true, absoluteBoundingBox: box(9, 9, 80, 20) },
    ]);
    const { annotations } = classifyPageChildren(page, new ImportReport());
    expect(annotations.map((a) => a.id)).toEqual(['1:5']);
  });

  test('an invisible node contributes nothing at all', () => {
    const { page } = pageDoc([frame('1:2'), frame('1:3', 'hidden', { visible: false })]);
    const { frames, annotations } = classifyPageChildren(page, new ImportReport());
    expect(frames.map((f) => f.id)).toEqual(['1:2']);
    expect(annotations).toHaveLength(0);
  });
});

describe('emission', () => {
  test('every artboard references a render placeholder, never inlined markup', () => {
    // The `<img>` reference IS the containment: an SVG in an <img> cannot run
    // script or fetch a subresource.
    const { doc, page } = pageDoc([frame('1:2', 'Screen')]);
    const out = toRenderCanvas(doc, page);

    expect(out.artboardCount).toBe(1);
    expect(out.pendingRenders).toHaveLength(1);
    expect(out.pendingRenders[0].node.id).toBe('1:2');
    expect(out.tsx).toContain('<img');
    expect(out.tsx).toContain(out.pendingRenders[0].placeholder);
    expect(out.tsx).not.toContain('<svg');
  });

  test('artboard positions normalize to the page origin', () => {
    // A page living at x=12000 in Figma still opens at the canvas origin.
    const { doc, page } = pageDoc([
      frame('1:2', 'a', { absoluteBoundingBox: box(12000, 500, 375, 812) }),
      frame('1:3', 'b', { absoluteBoundingBox: box(12500, 500, 375, 812) }),
    ]);
    const out = toRenderCanvas(doc, page);
    const xs = (out.meta.layout as { artboards: Array<{ x: number }> }).artboards.map((a) => a.x);
    expect(xs).toEqual([0, 500]);
    expect(out.origin).toEqual({ x: 12000, y: 500 });
  });

  test("the frame's own fill backs the render", () => {
    // Without this a transparent render shows the canvas ground through, which
    // is how white Figma screens arrived black in a dark-themed project.
    const { doc, page } = pageDoc([
      frame('1:2', 'white', {
        fills: [{ type: 'SOLID', visible: true, color: { r: 1, g: 1, b: 1, a: 1 } }],
      }),
    ]);
    expect(toRenderCanvas(doc, page).tsx).toContain('background="#ffffff"');
  });

  test('a page with no frames renders whole rather than importing empty', () => {
    // Regression: a scratch page of loose content produced ZERO artboards, so
    // the canvas opened blank and the page looked like it had not imported.
    const { doc, page } = pageDoc([
      { id: '1:5', name: 'note', type: 'TEXT', visible: true, absoluteBoundingBox: box(10, 20, 80, 20) },
      { id: '1:6', name: 'box', type: 'RECTANGLE', visible: true, absoluteBoundingBox: box(30, 40, 100, 60) },
    ]);
    const out = toRenderCanvas(doc, page);

    expect(out.artboardCount).toBe(1);
    // Figma renders a CANVAS node, so the page's own id is the render target.
    expect(out.pendingRenders[0].node.id).toBe('0:0');
    // Its content is inside that render — emitting it again would double it.
    expect(out.annotations).toHaveLength(0);
  });

  test('meta keeps every frame node id so one artboard can be exploded later', () => {
    const { doc, page } = pageDoc([frame('1:2', 'Screen'), frame('1:3', 'Other')]);
    const meta = toRenderCanvas(doc, page).meta as {
      mode: string;
      figma: { frames: Array<{ nodeId: string }> };
    };
    expect(meta.mode).toBe('render');
    expect(meta.figma.frames.map((f) => f.nodeId)).toEqual(['1:2', '1:3']);
  });
});
