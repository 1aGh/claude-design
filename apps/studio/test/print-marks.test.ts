// feature-2-print-artboards T5 — print/marks.ts pure geometry unit tests.

import { describe, expect, test } from 'bun:test';

import { computeMarksGeometry, MARK_STROKE_PT, requiredSlugPt } from '../print/marks.ts';
import { mmToPt } from '../print/units.ts';

const PAGE_W = 600; // pt, arbitrary
const PAGE_H = 800;
const BLEED = mmToPt(3);

describe('print/marks — requiredSlugPt', () => {
  test('neither crop nor registration → 0', () => {
    expect(requiredSlugPt({})).toBe(0);
  });

  test('crop only → the mark length', () => {
    expect(requiredSlugPt({ crop: true })).toBeCloseTo(mmToPt(3.5), 6);
  });

  test('registration reaches further than crop alone', () => {
    const cropOnly = requiredSlugPt({ crop: true });
    const both = requiredSlugPt({ crop: true, registration: true });
    expect(both).toBeGreaterThan(cropOnly);
  });
});

describe('print/marks — computeMarksGeometry', () => {
  test('crop:false, registration:false → both arrays empty', () => {
    const g = computeMarksGeometry({ pageWidthPt: PAGE_W, pageHeightPt: PAGE_H, bleedPt: BLEED });
    expect(g.cropMarks).toEqual([]);
    expect(g.registrationMarks).toEqual([]);
  });

  test('crop:true → exactly 8 segments (2 per corner × 4 corners)', () => {
    const g = computeMarksGeometry({
      pageWidthPt: PAGE_W,
      pageHeightPt: PAGE_H,
      bleedPt: BLEED,
      crop: true,
    });
    expect(g.cropMarks.length).toBe(8);
  });

  test('every crop-mark segment lies OUTSIDE the bleed box (page) bounds', () => {
    const g = computeMarksGeometry({
      pageWidthPt: PAGE_W,
      pageHeightPt: PAGE_H,
      bleedPt: BLEED,
      crop: true,
    });
    for (const seg of g.cropMarks) {
      const outside = (x: number, y: number) => x < 0 || x > PAGE_W || y < 0 || y > PAGE_H;
      // At least one endpoint of every mark segment must be outside the page —
      // the whole point of a crop mark is to be visible in the bleed/slug area.
      expect(outside(seg.x1, seg.y1) || outside(seg.x2, seg.y2)).toBe(true);
    }
  });

  test('crop-mark segments align to the trim line (bleed inset)', () => {
    const g = computeMarksGeometry({
      pageWidthPt: PAGE_W,
      pageHeightPt: PAGE_H,
      bleedPt: BLEED,
      crop: true,
    });
    const trimX0 = BLEED;
    const trimX1 = PAGE_W - BLEED;
    const trimY0 = BLEED;
    const trimY1 = PAGE_H - BLEED;
    const xs = g.cropMarks.filter((s) => s.x1 === s.x2).map((s) => s.x1);
    const ys = g.cropMarks.filter((s) => s.y1 === s.y2).map((s) => s.y1);
    expect(new Set(xs)).toEqual(new Set([trimX0, trimX1]));
    expect(new Set(ys)).toEqual(new Set([trimY0, trimY1]));
  });

  test('registration:true → 4 marks, each a circle + 2-segment crosshair', () => {
    const g = computeMarksGeometry({
      pageWidthPt: PAGE_W,
      pageHeightPt: PAGE_H,
      bleedPt: BLEED,
      registration: true,
    });
    expect(g.registrationMarks.length).toBe(4);
    for (const m of g.registrationMarks) {
      expect(m.crosshair.length).toBe(2);
      expect(m.circle.r).toBeGreaterThan(0);
    }
  });

  test('registration marks sit beyond the crop marks (no visual collision)', () => {
    const g = computeMarksGeometry({
      pageWidthPt: PAGE_W,
      pageHeightPt: PAGE_H,
      bleedPt: BLEED,
      crop: true,
      registration: true,
    });
    const topCenterReg = g.registrationMarks.find((m) => m.circle.cy > PAGE_H);
    expect(topCenterReg).toBeDefined();
    const topCropTip = Math.max(
      ...g.cropMarks.filter((s) => s.y1 > PAGE_H || s.y2 > PAGE_H).map((s) => Math.max(s.y1, s.y2))
    );
    expect((topCenterReg?.circle.cy ?? 0) - (topCenterReg?.circle.r ?? 0)).toBeGreaterThan(
      topCropTip
    );
  });
});

test('MARK_STROKE_PT is a small positive value (0.25mm)', () => {
  expect(MARK_STROKE_PT).toBeCloseTo(mmToPt(0.25), 6);
  expect(MARK_STROKE_PT).toBeGreaterThan(0);
});
