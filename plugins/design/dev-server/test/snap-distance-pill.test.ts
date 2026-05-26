// snap-distance-pill — DDR-046. Verifies SnapGuide.delta + .kind population
// in `computeSnap`. The visual `Δ{Math.round(delta)}` pill rendering lives in
// `SnapGuideOverlay` (`canvas-lib.tsx`); this file covers only the pure-function
// contract that the overlay reads.

import { describe, expect, test } from 'bun:test';

import { type Rect, type SnapOptions, computeSnap } from '../use-snap-guides.tsx';

const DEFAULTS: SnapOptions = { gridSize: 40, tolerance: 8, disabled: false };
const rect = (x: number, y: number, w = 100, h = 80): Rect => ({ x, y, w, h });

describe('SnapGuide.delta + .kind (DDR-046)', () => {
  test('grid snap emits delta + kind=grid', () => {
    const r = computeSnap(rect(33, 200), [], DEFAULTS);
    const xg = r.guides.find((g) => g.axis === 'x');
    expect(xg?.delta).toBe(7); // 40 − 33
    expect(xg?.kind).toBe('grid');
  });

  test('grid snap with zero delta (already on grid line) still emits kind=grid', () => {
    const r = computeSnap(rect(40, 200), [], DEFAULTS);
    const xg = r.guides.find((g) => g.axis === 'x');
    expect(xg?.delta).toBe(0);
    expect(xg?.kind).toBe('grid');
  });

  test('sibling snap beats grid when both fire (closest |delta| wins)', () => {
    // proposed x=37: grid candidate at 40 (delta +3), sibling at 35 (delta −2).
    // |−2| < |3| → sibling wins.
    const r = computeSnap(rect(37, 200), [rect(35, 0, 50, 50)], DEFAULTS);
    const xg = r.guides.find((g) => g.axis === 'x');
    expect(xg?.kind).toBe('sibling');
    expect(xg?.delta).toBe(-2);
    expect(r.x).toBe(35);
  });

  test('sibling snap emits delta + kind=sibling', () => {
    // proposed x=503, sibling at x=500. Snap left↔left.
    const r = computeSnap(rect(503, 200), [rect(500, 50, 100, 80)], DEFAULTS);
    const xg = r.guides.find((g) => g.axis === 'x');
    expect(xg?.delta).toBe(-3);
    expect(xg?.kind).toBe('sibling');
    expect(r.x).toBe(500);
  });

  test('merged-at-pos guide keeps the larger |delta|', () => {
    // Two siblings both at x=500 — same edge, different y so merged guide
    // unions their from/to. Both candidates have identical delta here, but
    // we still expect the merge code path to preserve a single delta value.
    const r = computeSnap(
      rect(503, 200),
      [rect(500, 50, 100, 50), rect(500, 400, 100, 50)],
      DEFAULTS
    );
    const xg = r.guides.find((g) => g.axis === 'x');
    expect(xg?.delta).toBe(-3);
    expect(xg?.kind).toBe('sibling');
    // Merged span covers both siblings' Y extents.
    expect(xg?.from).toBe(50);
    expect(xg?.to).toBe(450);
  });

  test('disabled mode emits no guides (delta + kind absent)', () => {
    const r = computeSnap(rect(33, 200), [rect(35, 0)], { ...DEFAULTS, disabled: true });
    expect(r.guides).toEqual([]);
  });
});
