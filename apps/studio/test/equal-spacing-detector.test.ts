// equal-spacing-detector — T27 (Wave 3). Pure detector fixtures.

import { describe, expect, test } from 'bun:test';

import {
  computeAlign,
  computeDistribute,
  computePairGap,
  computeTidyGrid,
  detectEqualSpacing,
  type KeyedRect,
} from '../equal-spacing-detector.ts';
import type { Rect } from '../use-snap-guides.tsx';

const r = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });
const kr = (key: string, x: number, y: number, w = 100, h = 60): KeyedRect => ({
  key,
  x,
  y,
  w,
  h,
});

describe('detectEqualSpacing / preconditions', () => {
  test('fewer than 3 rects → null', () => {
    expect(detectEqualSpacing([], 'x')).toBeNull();
    expect(detectEqualSpacing([r(0, 0)], 'x')).toBeNull();
    expect(detectEqualSpacing([r(0, 0), r(200, 0)], 'x')).toBeNull();
  });

  test('overlapping rects → null (gap < 0)', () => {
    // r1 spans 0..100, r2 starts at 90 (overlap by 10)
    expect(detectEqualSpacing([r(0, 0), r(90, 0), r(220, 0)], 'x')).toBeNull();
  });
});

describe('detectEqualSpacing / horizontal axis', () => {
  test('3 rects, equal gap 20 → detects with gap=20 + 2 midpoints', () => {
    // 0..100, 120..220, 240..340 — gap = 20
    const out = detectEqualSpacing([r(0, 0), r(120, 0), r(240, 0)], 'x');
    expect(out).not.toBeNull();
    expect(out?.axis).toBe('x');
    expect(out?.gapPx).toBe(20);
    expect(out?.midpoints).toHaveLength(2);
    expect(out?.midpoints[0]).toEqual({ x: 110, y: 30 });
    expect(out?.midpoints[1]).toEqual({ x: 230, y: 30 });
  });

  test('uneven gaps outside tolerance → null', () => {
    // gaps: 20, 30
    const out = detectEqualSpacing([r(0, 0), r(120, 0), r(250, 0)], 'x');
    expect(out).toBeNull();
  });

  test('within 1 px tolerance is accepted', () => {
    // gaps: 20, 21 — within default tolerance of 1
    const out = detectEqualSpacing([r(0, 0), r(120, 0), r(241, 0)], 'x');
    expect(out).not.toBeNull();
    expect(out?.gapPx).toBeGreaterThanOrEqual(20);
    expect(out?.gapPx).toBeLessThanOrEqual(21);
  });

  test('explicit tolerance allows wider band', () => {
    // gaps: 20, 25
    const tightFail = detectEqualSpacing([r(0, 0), r(120, 0), r(245, 0)], 'x');
    expect(tightFail).toBeNull();
    const loosePass = detectEqualSpacing([r(0, 0), r(120, 0), r(245, 0)], 'x', {
      tolerancePx: 5,
    });
    expect(loosePass).not.toBeNull();
  });

  test('rects passed in random order → sorted internally', () => {
    const out = detectEqualSpacing([r(240, 0), r(0, 0), r(120, 0)], 'x');
    expect(out).not.toBeNull();
    expect(out?.gapPx).toBe(20);
  });
});

describe('detectEqualSpacing / vertical axis', () => {
  test('3 rects stacked, equal gap 30 → detects', () => {
    // y: 0..60, 90..150, 180..240 — gap 30
    const out = detectEqualSpacing([r(0, 0), r(0, 90), r(0, 180)], 'y');
    expect(out).not.toBeNull();
    expect(out?.axis).toBe('y');
    expect(out?.gapPx).toBe(30);
    expect(out?.midpoints).toHaveLength(2);
    expect(out?.midpoints[0]?.y).toBe(75); // 60 + 30/2
    expect(out?.midpoints[1]?.y).toBe(165);
  });
});

describe('detectEqualSpacing / 4+ rects', () => {
  test('4 rects equally distributed → 3 midpoints', () => {
    // gaps 20, 20, 20
    const out = detectEqualSpacing([r(0, 0), r(120, 0), r(240, 0), r(360, 0)], 'x');
    expect(out).not.toBeNull();
    expect(out?.midpoints).toHaveLength(3);
    expect(out?.gapPx).toBe(20);
  });

  test('one bad gap in a 4-rect set → null', () => {
    // gaps 20, 50, 20
    const out = detectEqualSpacing([r(0, 0), r(120, 0), r(270, 0), r(390, 0)], 'x');
    expect(out).toBeNull();
  });
});

// Task L7 — Alt-hover measurement pairwise gap.

describe('computePairGap', () => {
  test('measures the x-axis gap regardless of argument order', () => {
    const a = r(0, 0, 100, 50);
    const b = r(150, 20, 80, 50);
    const fwd = computePairGap(a, b, 'x');
    const rev = computePairGap(b, a, 'x');
    expect(fwd).toEqual({ axis: 'x', gap: 50, from: 100, cross: 35 });
    expect(rev).toEqual(fwd);
  });

  test('measures the y-axis gap', () => {
    const a = r(0, 0, 50, 60);
    const b = r(10, 150, 50, 60);
    const out = computePairGap(a, b, 'y');
    expect(out).toEqual({ axis: 'y', gap: 90, from: 60, cross: 30 });
  });

  test('overlapping on the axis → null (no gap to show)', () => {
    const a = r(0, 0, 100, 50);
    const b = r(50, 0, 100, 50); // overlaps a on x
    expect(computePairGap(a, b, 'x')).toBeNull();
  });

  test('touching (gap === 0) → null', () => {
    const a = r(0, 0, 100, 50);
    const b = r(100, 0, 100, 50);
    expect(computePairGap(a, b, 'x')).toBeNull();
  });
});

// Task L5 — distribute / align / tidy-up pure math.

describe('computeAlign', () => {
  test('fewer than 2 rects → []', () => {
    expect(computeAlign([], 'left')).toEqual([]);
    expect(computeAlign([kr('a', 0, 0)], 'left')).toEqual([]);
  });

  test('left/right/top/bottom hold the union-bbox edge', () => {
    const rects = [kr('a', 0, 0, 100, 50), kr('b', 40, 100, 60, 50), kr('c', 200, 30, 100, 50)];
    const left = computeAlign(rects, 'left');
    // union xMin = 0 → 'a' already at x=0 is a no-op (skipped); b/c move.
    expect(left).toEqual(
      expect.arrayContaining([
        { key: 'b', x: 0, y: 100 },
        { key: 'c', x: 0, y: 30 },
      ])
    );
    expect(left.find((m) => m.key === 'a')).toBeUndefined();

    const right = computeAlign(rects, 'right');
    // union xMax = 300 (c: 200+100)
    expect(right.find((m) => m.key === 'a')).toEqual({ key: 'a', x: 200, y: 0 });
    expect(right.find((m) => m.key === 'b')).toEqual({ key: 'b', x: 240, y: 100 });
    expect(right.find((m) => m.key === 'c')).toBeUndefined(); // already at right edge

    const top = computeAlign(rects, 'top');
    expect(top.find((m) => m.key === 'a')).toBeUndefined(); // already yMin=0
    expect(top.find((m) => m.key === 'b')).toEqual({ key: 'b', x: 40, y: 0 });
    expect(top.find((m) => m.key === 'c')).toEqual({ key: 'c', x: 200, y: 0 });
  });

  test('center-x / center-y align to the union-bbox midpoint', () => {
    const rects = [kr('a', 0, 0, 100, 100), kr('b', 300, 0, 100, 100)];
    // union bbox x: 0..400, cx=200
    const centerX = computeAlign(rects, 'center-x');
    expect(centerX).toEqual(
      expect.arrayContaining([
        { key: 'a', x: 150, y: 0 },
        { key: 'b', x: 150, y: 0 },
      ])
    );
  });

  test('no-op rects (already aligned) are omitted from the result', () => {
    const rects = [kr('a', 0, 0), kr('b', 0, 50)];
    expect(computeAlign(rects, 'left')).toEqual([]);
  });
});

describe('computeDistribute', () => {
  test('fewer than 3 rects → []', () => {
    expect(computeDistribute([kr('a', 0, 0), kr('b', 200, 0)], 'x')).toEqual([]);
  });

  test('holds first + last, spaces the middle evenly on x', () => {
    // 0..100, then a bunched pair at 110/130, then 300..400 — total span
    // first.x(0) to last.x+w(400) = 400, minus side-lengths(100+80+90+100=370) = 30 → gap 10
    const rects = [
      kr('a', 0, 0, 100, 50),
      kr('b', 110, 0, 80, 50),
      kr('c', 130, 0, 90, 50),
      kr('d', 300, 0, 100, 50),
    ];
    const out = computeDistribute(rects, 'x');
    expect(out).toHaveLength(2); // only the 2 middle rects move
    expect(out.find((m) => m.key === 'b')).toEqual({ key: 'b', x: 110, y: 0 });
    expect(out.find((m) => m.key === 'c')).toEqual({ key: 'c', x: 200, y: 0 });
  });

  test('already-equal gaps still returns the (unchanged) middle positions', () => {
    const rects = [kr('a', 0, 0), kr('b', 120, 0), kr('c', 240, 0)];
    const out = computeDistribute(rects, 'x');
    expect(out).toEqual([{ key: 'b', x: 120, y: 0 }]);
  });

  test('distributes on y', () => {
    // y: 0..60, 90..150, 300..360 — total sides 180, span 360-180=180, gap 90
    const rects = [kr('a', 0, 0, 50, 60), kr('b', 0, 90, 50, 60), kr('c', 0, 300, 50, 60)];
    const out = computeDistribute(rects, 'y');
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ key: 'b', x: 0, y: 150 });
  });
});

describe('computeTidyGrid', () => {
  test('fewer than 2 rects → []', () => {
    expect(computeTidyGrid([kr('a', 5, 5)])).toEqual([]);
  });

  test('4 rects → 2×2 grid, reading-order sorted, from the union-bbox origin', () => {
    // scattered, deliberately out of reading order
    const rects = [
      kr('br', 500, 500, 50, 50),
      kr('tl', 0, 0, 50, 50),
      kr('tr', 400, 10, 50, 50),
      kr('bl', 20, 490, 50, 50),
    ];
    const out = computeTidyGrid(rects, { gap: 10 });
    expect(out).toHaveLength(4);
    const byKey = Object.fromEntries(out.map((m) => [m.key, m]));
    // reading order (y then x): tl(0,0) → tr(400,10) → bl(20,490) → br(500,500)
    // columns = round(sqrt(4)) = 2 → row0: tl,tr · row1: bl,br
    expect(byKey.tl).toEqual({ key: 'tl', x: 0, y: 0 });
    expect(byKey.tr).toEqual({ key: 'tr', x: 60, y: 0 }); // col0 width 50 + gap 10
    expect(byKey.bl).toEqual({ key: 'bl', x: 0, y: 60 });
    expect(byKey.br).toEqual({ key: 'br', x: 60, y: 60 });
  });

  test('honors an explicit column count', () => {
    const rects = [kr('a', 0, 0, 40, 20), kr('b', 0, 0, 40, 20), kr('c', 0, 0, 40, 20)];
    const out = computeTidyGrid(rects, { gap: 5, columns: 1 });
    // 1 column → stacked vertically
    expect(out.map((m) => m.x)).toEqual([0, 0, 0]);
    expect(out.map((m) => m.y)).toEqual([0, 25, 50]);
  });
});
