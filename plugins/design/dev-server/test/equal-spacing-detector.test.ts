// equal-spacing-detector — T27 (Wave 3). Pure detector fixtures.

import { describe, expect, test } from 'bun:test';

import { detectEqualSpacing } from '../equal-spacing-detector.ts';
import type { Rect } from '../use-snap-guides.tsx';

const r = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });

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
    expect(out!.axis).toBe('x');
    expect(out!.gapPx).toBe(20);
    expect(out!.midpoints).toHaveLength(2);
    expect(out!.midpoints[0]).toEqual({ x: 110, y: 30 });
    expect(out!.midpoints[1]).toEqual({ x: 230, y: 30 });
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
    expect(out!.gapPx).toBeGreaterThanOrEqual(20);
    expect(out!.gapPx).toBeLessThanOrEqual(21);
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
    expect(out!.gapPx).toBe(20);
  });
});

describe('detectEqualSpacing / vertical axis', () => {
  test('3 rects stacked, equal gap 30 → detects', () => {
    // y: 0..60, 90..150, 180..240 — gap 30
    const out = detectEqualSpacing([r(0, 0), r(0, 90), r(0, 180)], 'y');
    expect(out).not.toBeNull();
    expect(out!.axis).toBe('y');
    expect(out!.gapPx).toBe(30);
    expect(out!.midpoints).toHaveLength(2);
    expect(out!.midpoints[0]?.y).toBe(75); // 60 + 30/2
    expect(out!.midpoints[1]?.y).toBe(165);
  });
});

describe('detectEqualSpacing / 4+ rects', () => {
  test('4 rects equally distributed → 3 midpoints', () => {
    // gaps 20, 20, 20
    const out = detectEqualSpacing(
      [r(0, 0), r(120, 0), r(240, 0), r(360, 0)],
      'x'
    );
    expect(out).not.toBeNull();
    expect(out!.midpoints).toHaveLength(3);
    expect(out!.gapPx).toBe(20);
  });

  test('one bad gap in a 4-rect set → null', () => {
    // gaps 20, 50, 20
    const out = detectEqualSpacing(
      [r(0, 0), r(120, 0), r(270, 0), r(390, 0)],
      'x'
    );
    expect(out).toBeNull();
  });
});
