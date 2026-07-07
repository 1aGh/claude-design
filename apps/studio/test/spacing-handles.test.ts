// spacing-handles.ts — Stage J (feature-element-editing-robustness). Pure
// geometry for the on-canvas padding + gap drag overlay: padding-edge handle
// placement + drag math, and flex gap-midpoint placement + drag math.

import { describe, expect, test } from 'bun:test';

import {
  computeGapDrag,
  computeGapMidpoints,
  computePaddingDrag,
  computePaddingLines,
  flexMainAxis,
} from '../spacing-handles.ts';

const RECT = { x: 100, y: 200, w: 300, h: 150 };

describe('spacing-handles / computePaddingLines', () => {
  test('places all 4 edges at the padding/content boundary, zoom 1', () => {
    const lines = computePaddingLines(RECT, { top: 10, right: 20, bottom: 30, left: 40 }, 1);
    const bySide = Object.fromEntries(lines.map((l) => [l.side, l]));
    expect(bySide.top).toEqual({ side: 'top', axis: 'y', x: 250, y: 210, length: 240 }); // w-40-20
    expect(bySide.bottom).toEqual({ side: 'bottom', axis: 'y', x: 250, y: 320, length: 240 });
    expect(bySide.left).toEqual({ side: 'left', axis: 'x', x: 140, y: 275, length: 110 }); // h-10-30
    expect(bySide.right).toEqual({ side: 'right', axis: 'x', x: 380, y: 275, length: 110 });
  });

  test('scales the inset by zoom', () => {
    const lines = computePaddingLines(RECT, { top: 10, right: 0, bottom: 0, left: 0 }, 2);
    const top = lines.find((l) => l.side === 'top');
    expect(top?.y).toBe(220); // rect.y + 10*2
  });

  test('a non-positive zoom falls back to 1x', () => {
    const lines = computePaddingLines(RECT, { top: 10, right: 0, bottom: 0, left: 0 }, 0);
    expect(lines.find((l) => l.side === 'top')?.y).toBe(210);
  });
});

describe('spacing-handles / computePaddingDrag', () => {
  test('top grows when dragged DOWN (positive dy)', () => {
    expect(computePaddingDrag('top', 10, 0, 6, 1)).toBe(16);
  });
  test('top shrinks when dragged UP (negative dy)', () => {
    expect(computePaddingDrag('top', 10, 0, -4, 1)).toBe(6);
  });
  test('left grows when dragged RIGHT (positive dx)', () => {
    expect(computePaddingDrag('left', 8, 5, 0, 1)).toBe(13);
  });
  test('bottom grows when dragged UP (sign flips vs top)', () => {
    expect(computePaddingDrag('bottom', 10, 0, -6, 1)).toBe(16);
  });
  test('right grows when dragged LEFT (sign flips vs left)', () => {
    expect(computePaddingDrag('right', 8, -5, 0, 1)).toBe(13);
  });
  test('clamps at 0 — never goes negative', () => {
    expect(computePaddingDrag('top', 4, 0, -100, 1)).toBe(0);
  });
  test('divides the screen delta by zoom (world units)', () => {
    expect(computePaddingDrag('top', 10, 0, 20, 2)).toBe(20); // 20/2 = +10
  });
});

describe('spacing-handles / flexMainAxis', () => {
  test('row / row-reverse → x', () => {
    expect(flexMainAxis('row')).toBe('x');
    expect(flexMainAxis('row-reverse')).toBe('x');
  });
  test('column / column-reverse → y', () => {
    expect(flexMainAxis('column')).toBe('y');
    expect(flexMainAxis('column-reverse')).toBe('y');
  });
  test('missing/empty defaults to row → x', () => {
    expect(flexMainAxis(null)).toBe('x');
    expect(flexMainAxis('')).toBe('x');
  });
});

describe('spacing-handles / computeGapMidpoints', () => {
  test('no gaps for < 2 children', () => {
    expect(computeGapMidpoints([], 'x')).toEqual([]);
    expect(computeGapMidpoints([RECT], 'x')).toEqual([]);
  });

  test('one midpoint between 2 children on the X axis, sorted by position', () => {
    const a = { x: 0, y: 0, w: 100, h: 50 };
    const b = { x: 120, y: 0, w: 100, h: 50 };
    // Pass out of order — must sort by x before pairing.
    expect(computeGapMidpoints([b, a], 'x')).toEqual([{ x: 110, y: 25 }]);
  });

  test('N-1 midpoints for N children, Y axis (column)', () => {
    const a = { x: 0, y: 0, w: 80, h: 40 };
    const b = { x: 0, y: 60, w: 80, h: 40 };
    const c = { x: 0, y: 120, w: 80, h: 40 };
    expect(computeGapMidpoints([a, b, c], 'y')).toEqual([
      { x: 40, y: 50 },
      { x: 40, y: 110 },
    ]);
  });
});

describe('spacing-handles / computeGapDrag', () => {
  test('1:1 with cursor delta on the X axis (no doubling)', () => {
    expect(computeGapDrag('x', 12, 8, 0, 1)).toBe(20);
  });
  test('1:1 with cursor delta on the Y axis', () => {
    expect(computeGapDrag('y', 12, 0, -8, 1)).toBe(4);
  });
  test('clamps at 0', () => {
    expect(computeGapDrag('x', 4, -100, 0, 1)).toBe(0);
  });
  test('divides by zoom', () => {
    expect(computeGapDrag('x', 10, 20, 0, 2)).toBe(20); // 20/2 = +10
  });
});
