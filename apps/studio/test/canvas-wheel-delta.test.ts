// canvas-wheel-delta — issue #94 dogfood report: mouse-wheel panning in the
// canvas is very slow. Root cause: `onWheel` fed raw `WheelEvent.deltaX`/
// `deltaY` straight into `panBy` as CSS pixels, but the Wheel Events spec
// lets a browser report deltas in pixel/line/page units (`deltaMode`).
// Physical mice on Firefox (and some browser/OS combos elsewhere) report
// LINE-mode deltas — a single integer like 3 per notch — which, read as
// pixels, panned the canvas only a few px per wheel notch. Trackpads report
// pixel-mode deltas already, so trackpad panning felt fine while mouse-wheel
// panning felt frozen. See .ai/logs/rca/issue-94-wheel-pan-slow.md.
//
// `wheelDeltaToPixels` is a pure function (no DOM needed) so this test
// doesn't need happy-dom, unlike canvas-zoom-floor.test.ts's computeFit case.

import { describe, expect, test } from 'bun:test';

import { wheelDeltaToPixels } from '../canvas-lib.tsx';

describe('wheelDeltaToPixels — normalizes WheelEvent units (issue #94)', () => {
  test('pixel mode (deltaMode 0) passes the value through unchanged', () => {
    expect(wheelDeltaToPixels(100, 0, 800)).toBe(100);
    expect(wheelDeltaToPixels(-42.5, 0, 800)).toBe(-42.5);
  });

  test('line mode (deltaMode 1) scales a small per-notch delta up to a pixel-range step', () => {
    // The regression: before the fix, `onWheel` fed the raw delta straight
    // into `panBy`, so a line-mode notch of 3 panned only 3 CSS pixels —
    // reproducing the "very slow" mouse-wheel report. This asserts the FIXED
    // behavior: scaled up to a magnitude comparable to a trackpad's
    // pixel-mode delta (~100 per gesture step). Pre-fix, `wheelDeltaToPixels`
    // didn't exist and `onWheel` used the raw `3` — this assertion fails
    // against that old code path (3 !== 48).
    const raw = 3;
    const scaled = wheelDeltaToPixels(raw, 1, 800);
    expect(scaled).toBe(48);
    expect(scaled).not.toBe(raw);
  });

  test('page mode (deltaMode 2) scales by the supplied page size', () => {
    expect(wheelDeltaToPixels(1, 2, 800)).toBe(800);
    expect(wheelDeltaToPixels(-2, 2, 600)).toBe(-1200);
  });
});
