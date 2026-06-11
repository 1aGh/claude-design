// annotations-align — FigJam v3 align + distribute (pure bbox math, DOM-free).

import { describe, expect, test } from 'bun:test';

import { alignStrokes, distributeStrokes } from '../annotations-align.ts';
import type { RectStroke, Stroke } from '../annotations-model.ts';

function rect(
  id: string,
  x: number,
  y: number,
  w = 50,
  h = 50,
  extra: Partial<RectStroke> = {}
): RectStroke {
  return { id, tool: 'rect', color: '#1f1f1f', width: 3, x, y, w, h, ...extra };
}

const byId = (strokes: readonly Stroke[], id: string): RectStroke =>
  strokes.find((s) => s.id === id) as RectStroke;

describe('alignStrokes', () => {
  test('align left snaps every unit to the selection bbox left edge', () => {
    const strokes = [rect('a', 0, 0), rect('b', 100, 80), rect('c', 40, 200)];
    const out = alignStrokes(strokes, ['a', 'b', 'c'], 'left');
    expect(byId(out, 'a').x).toBe(0);
    expect(byId(out, 'b').x).toBe(0);
    expect(byId(out, 'c').x).toBe(0);
    // y untouched by a horizontal align
    expect(byId(out, 'b').y).toBe(80);
  });

  test('align h-center / right / bottom', () => {
    const strokes = [rect('a', 0, 0, 100, 100), rect('b', 200, 50, 20, 20)];
    const centered = alignStrokes(strokes, ['a', 'b'], 'h-center');
    // Selection spans x:0..220 → center 110; b (w20) → x=100.
    expect(byId(centered, 'b').x).toBe(100);
    const right = alignStrokes(strokes, ['a', 'b'], 'right');
    expect(byId(right, 'a').x).toBe(120);
    const bottom = alignStrokes(strokes, ['a', 'b'], 'bottom');
    expect(byId(bottom, 'b').y).toBe(80);
  });

  test('a group aligns as ONE unit — members keep their relative offsets', () => {
    const strokes = [
      rect('g1', 100, 0, 50, 50, { groupIds: ['g'] }),
      rect('g2', 160, 30, 50, 50, { groupIds: ['g'] }),
      rect('solo', 0, 200),
    ];
    const out = alignStrokes(strokes, ['g1', 'solo'], 'left');
    // Group bbox spans x:100..210; aligning left moves the group by -100.
    expect(byId(out, 'g1').x).toBe(0);
    expect(byId(out, 'g2').x).toBe(60);
    expect(byId(out, 'solo').x).toBe(0);
  });

  test('fewer than two units → referential no-op', () => {
    const strokes = [
      rect('a', 0, 0),
      rect('b', 10, 10, 50, 50, { groupIds: ['g'] }),
      rect('c', 70, 10, 50, 50, { groupIds: ['g'] }),
    ];
    expect(alignStrokes(strokes, ['b'], 'left')).toBe(strokes);
  });
});

describe('distributeStrokes', () => {
  test('equalizes gaps, pinning the first and last unit', () => {
    // a: 0..50, b: 60..110, c: 200..250 → span 250, total 150, gap = 50.
    const strokes = [rect('a', 0, 0), rect('b', 60, 0), rect('c', 200, 0)];
    const out = distributeStrokes(strokes, ['a', 'b', 'c'], 'h');
    expect(byId(out, 'a').x).toBe(0);
    expect(byId(out, 'b').x).toBe(100);
    expect(byId(out, 'c').x).toBe(200);
  });

  test('vertical distribute', () => {
    // a: 0..50, b: 55..105, c: 300..350 → span 350, total 150, gap = 100.
    const strokes = [rect('a', 0, 0), rect('b', 0, 55), rect('c', 0, 300)];
    const out = distributeStrokes(strokes, ['a', 'b', 'c'], 'v');
    expect(byId(out, 'b').y).toBe(150);
  });

  test('fewer than three units → referential no-op', () => {
    const strokes = [rect('a', 0, 0), rect('b', 100, 0)];
    expect(distributeStrokes(strokes, ['a', 'b'], 'h')).toBe(strokes);
  });
});
