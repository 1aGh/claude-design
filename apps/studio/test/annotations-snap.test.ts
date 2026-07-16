// annotations-snap — FigJam v3 drag snapping + smart guides (pure, DOM-free).

import { describe, expect, test } from 'bun:test';

import {
  computeSnap,
  GRID_PITCH_PX,
  type GuideLineCandidate,
  SNAP_THRESHOLD_PX,
  type SnapBox,
} from '../annotations-snap.ts';

const box = (x: number, y: number, w = 100, h = 100): SnapBox => ({ x, y, w, h });

describe('computeSnap', () => {
  test('snaps left edge to a candidate left edge within the threshold', () => {
    const res = computeSnap(box(104, 300), [box(100, 0)], SNAP_THRESHOLD_PX);
    expect(res.dx).toBe(-4);
    expect(res.dy).toBe(0);
    expect(res.guides).toHaveLength(1);
    const guide = res.guides[0];
    expect(guide?.axis).toBe('x');
    expect(guide?.at).toBe(100);
    // The guide spans from the candidate to the (snapped) moving box.
    expect(guide?.from).toBe(0);
    expect(guide?.to).toBe(400);
  });

  test('centers participate — center-to-center snap', () => {
    // moving center x = 153, candidate center x = 150 → dx -3.
    const res = computeSnap(box(103, 0), [box(100, 300)], SNAP_THRESHOLD_PX);
    expect(res.dx).toBe(-3);
  });

  test('axes resolve independently against different candidates', () => {
    const res = computeSnap(box(104, 203), [box(100, 500), box(500, 200)], SNAP_THRESHOLD_PX);
    expect(res.dx).toBe(-4); // left edge → first candidate
    expect(res.dy).toBe(-3); // top edge → second candidate
    expect(res.guides).toHaveLength(2);
  });

  test('nearest line wins; outside the threshold = no snap', () => {
    const res = computeSnap(box(104, 0), [box(100, 0), box(105, 0)], SNAP_THRESHOLD_PX);
    expect(res.dx).toBe(1); // 105 is 1 away vs 100 being 4 away
    const none = computeSnap(box(120, 0), [box(100, 300)], SNAP_THRESHOLD_PX);
    expect(none.dx).toBe(0);
    expect(none.guides).toHaveLength(0);
  });

  test('empty candidates / zero threshold → no snap', () => {
    expect(computeSnap(box(0, 0), [], SNAP_THRESHOLD_PX).guides).toHaveLength(0);
    expect(computeSnap(box(101, 0), [box(100, 0)], 0).dx).toBe(0);
  });

  test('grid fallback — leading edge snaps to the 24px lattice with no candidates', () => {
    // x=98 → nearest grid line 96 (4·24), 2 away; y=50 → nearest 48, 2 away.
    const res = computeSnap(box(98, 50), [], SNAP_THRESHOLD_PX, { grid: GRID_PITCH_PX });
    expect(res.dx).toBe(-2);
    expect(res.dy).toBe(-2);
    // Grid snap is silent — the dots themselves are the visual, no guide lines.
    expect(res.guides).toHaveLength(0);
  });

  test('grid fallback is per-axis — a smart-guide axis keeps its candidate snap', () => {
    // x snaps to the candidate edge (dx -4 → x=100, NOT the 96 grid line);
    // y has no candidate within reach → grid line 48 wins (dy -2).
    const res = computeSnap(box(104, 50), [box(100, 500)], SNAP_THRESHOLD_PX, {
      grid: GRID_PITCH_PX,
    });
    expect(res.dx).toBe(-4);
    expect(res.dy).toBe(-2);
  });

  test('grid outside the threshold → no correction', () => {
    // x=84 sits 12 from both 72 and 96 — beyond the 6px threshold.
    const res = computeSnap(box(84, 84), [], SNAP_THRESHOLD_PX, { grid: GRID_PITCH_PX });
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(0);
  });
});

// feature-1-artboard-kinds-foundation, T7 — generic-layout-guide lines feed
// the same candidate pool as stroke/artboard bboxes.
describe('computeSnap / guide lines (T7)', () => {
  test('leading edge snaps to a guide line within threshold', () => {
    const guideLines: GuideLineCandidate[] = [{ axis: 'x', at: 100, from: 0, to: 1000 }];
    const res = computeSnap(box(104, 300), [], SNAP_THRESHOLD_PX, { guideLines });
    expect(res.dx).toBe(-4);
    expect(res.guides).toHaveLength(1);
    expect(res.guides[0]).toMatchObject({ axis: 'x', at: 100, from: 0, to: 1000 });
  });

  test('center also tests against a guide line', () => {
    // moving center x = 153, guide at 150 → dx -3.
    const guideLines: GuideLineCandidate[] = [{ axis: 'y', at: 350, from: 0, to: 1000 }];
    const res = computeSnap(box(103, 300), [], SNAP_THRESHOLD_PX, { guideLines });
    // center y = 350, guide at 350 → dy 0 (exact), still emits a guide.
    expect(res.dy).toBe(0);
    expect(res.guides.find((g) => g.axis === 'y')).toMatchObject({ at: 350 });
  });

  test('nearest-wins applies across BOTH sources — a closer guide beats a farther candidate', () => {
    const guideLines: GuideLineCandidate[] = [{ axis: 'x', at: 105, from: 0, to: 1000 }];
    const res = computeSnap(box(104, 300), [box(100, 0)], SNAP_THRESHOLD_PX, { guideLines });
    // candidate edge (100) is 4 away; guide (105) is 1 away — guide wins.
    expect(res.dx).toBe(1);
  });

  test('a closer stroke/artboard candidate beats a farther guide line', () => {
    // candidate edge (100) is 4 away from x=104; guide (110) is 6 away — the
    // candidate is strictly closer, so it wins even though the guide is
    // still within the 6px threshold.
    const guideLines: GuideLineCandidate[] = [{ axis: 'x', at: 110, from: 0, to: 1000 }];
    const res = computeSnap(box(104, 300), [box(100, 0)], SNAP_THRESHOLD_PX, { guideLines });
    expect(res.dx).toBe(-4);
  });

  test('outside threshold, a guide line is ignored', () => {
    const guideLines: GuideLineCandidate[] = [{ axis: 'x', at: 500, from: 0, to: 1000 }];
    const res = computeSnap(box(104, 300), [], SNAP_THRESHOLD_PX, { guideLines });
    expect(res.dx).toBe(0);
    expect(res.guides).toHaveLength(0);
  });

  test('guide-line snap composes with the grid fallback on the OTHER axis', () => {
    // x snaps to the guide line; y has no candidate → grid fallback fires.
    const guideLines: GuideLineCandidate[] = [{ axis: 'x', at: 100, from: 0, to: 1000 }];
    const res = computeSnap(box(104, 50), [], SNAP_THRESHOLD_PX, {
      guideLines,
      grid: GRID_PITCH_PX,
    });
    expect(res.dx).toBe(-4);
    expect(res.dy).toBe(-2);
  });
});
