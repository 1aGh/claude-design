import { describe, expect, test } from 'bun:test';
import type { Rect } from '../geometry.ts';
import { type LabelItem, diagram, modularScale, placeLabels, snapToGrid } from '../layout.ts';
import type { Point } from '../primitives.ts';

describe('grid + modular scale', () => {
  test('snapToGrid', () => {
    expect(snapToGrid({ x: 13, y: 7 }, 8)).toEqual({ x: 16, y: 8 });
  });
  test('modularScale builds a ratio ladder', () => {
    expect(modularScale(16, 1.5, 3)).toEqual([16, 24, 36]);
    expect(modularScale(16, 1.25, 4)[0]).toBe(16);
  });
});

describe('constraint-based label placement', () => {
  test('places N labels around spread anchors with no overlap', () => {
    const items: LabelItem[] = [
      { id: 'a', anchor: { x: 0, y: 0 }, width: 30, height: 12 },
      { id: 'b', anchor: { x: 200, y: 0 }, width: 30, height: 12 },
      { id: 'c', anchor: { x: 0, y: 200 }, width: 30, height: 12 },
      { id: 'd', anchor: { x: 200, y: 200 }, width: 30, height: 12 },
    ];
    const placements = placeLabels(items, { gap: 6 });
    expect(placements).toHaveLength(4);
    // No two placed boxes overlap (plenty of room → solver should find 0 overlap).
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(ox * oy).toBe(0);
      }
    }
  });
  test('is deterministic', () => {
    const items: LabelItem[] = [
      { id: 'x', anchor: { x: 10, y: 10 }, width: 20, height: 10 },
      { id: 'y', anchor: { x: 14, y: 12 }, width: 20, height: 10 },
    ];
    expect(placeLabels(items)).toEqual(placeLabels(items));
  });
  test('returns placements in input order', () => {
    const items: LabelItem[] = [
      { id: 'z', anchor: { x: 0, y: 0 }, width: 10, height: 10 },
      { id: 'a', anchor: { x: 100, y: 0 }, width: 10, height: 10 },
    ];
    expect(placeLabels(items).map((p) => p.id)).toEqual(['z', 'a']);
  });
});

describe('diagram()', () => {
  const nodes = [
    { id: 'n1', rect: { x: 0, y: 0, width: 60, height: 30 } as Rect, label: 'A' },
    { id: 'n2', rect: { x: 200, y: 0, width: 60, height: 30 } as Rect, label: 'B' },
    { id: 'n3', rect: { x: 0, y: 150, width: 60, height: 30 } as Rect, label: 'C' },
    { id: 'n4', rect: { x: 200, y: 150, width: 60, height: 30 } as Rect, label: 'D' },
  ];
  const edges = [
    { from: 'n1', to: 'n2' },
    { from: 'n1', to: 'n4' },
    { from: 'n3', to: 'n4' },
  ];

  test('emits an edges group and a nodes group', () => {
    const prims = diagram(nodes, edges, { grid: 10 });
    expect(prims).toHaveLength(2);
    expect(prims[0]).toMatchObject({ el: 'group', id: 'edges' });
    expect(prims[1]).toMatchObject({ el: 'group', id: 'nodes' });
  });

  test('renders one rect + one label per node', () => {
    const prims = diagram(nodes, edges, { grid: 10 }) as Array<{ children: Array<{ el: string }> }>;
    const nodeChildren = prims[1].children;
    expect(nodeChildren.filter((c) => c.el === 'rect')).toHaveLength(4);
    expect(nodeChildren.filter((c) => c.el === 'text')).toHaveLength(4);
  });

  test('routes edges around NON-endpoint node boxes (never crosses a third node)', () => {
    const prims = diagram(nodes, edges, { grid: 10, padding: 4 }) as Array<{
      children: Array<{ el: string; points?: Point[] }>;
    }>;
    const edgePolys = prims[0].children.filter((c) => c.el === 'polyline');
    expect(edgePolys.length).toBe(3);
    const inside = (p: Point, r: Rect) =>
      p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
    // Endpoints sit at node CENTERS (inside from/to boxes by construction); the
    // guarantee is that waypoints never enter a node that isn't this edge's
    // own endpoint.
    edges.forEach((e, i) => {
      const obstacles = nodes.filter((n) => n.id !== e.from && n.id !== e.to);
      for (const pt of edgePolys[i].points ?? []) {
        for (const n of obstacles) {
          expect(inside(pt, n.rect)).toBe(false);
        }
      }
    });
  });
});

describe('index barrel', () => {
  test('re-exports the full public surface', async () => {
    const m = await import('../index.ts');
    for (const name of [
      'rect',
      'circle',
      'place',
      'toSvg',
      'toJsx',
      'optimizeSvg',
      'diagram',
      'contrastRatio',
      'routeConnector',
      'oklchToRgb',
    ]) {
      expect(typeof (m as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
