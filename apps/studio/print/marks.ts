// feature-2-print-artboards T1/T5 — pure crop/registration-mark geometry.
//
// Consumed by the pdf-lib post-pass (T5) to draw vector marks, and reusable
// by a future on-canvas marks preview (T3 left that optional — see the plan).
// Coordinates are PDF POINTS in the BLEED-BOX-origin space: x ∈ [0, pageWidthPt],
// y ∈ [0, pageHeightPt] is the rendered page itself (Chromium's page.pdf()
// output, unchanged); marks live OUTSIDE that box, at negative coordinates or
// beyond pageWidthPt/pageHeightPt. The pdf-lib post-pass enlarges MediaBox
// with a negative origin to make room for them without moving page content.

import { MARK_LENGTH_MM, MARK_STROKE_MM, mmToPt } from './units.ts';

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface RegistrationMark {
  circle: Circle;
  crosshair: LineSegment[];
}

export interface MarksGeometry {
  cropMarks: LineSegment[];
  registrationMarks: RegistrationMark[];
}

const REG_RADIUS_MM = 1.5;
const REG_GAP_MM = 1;

/**
 * The extra margin MediaBox must extend beyond the bleed box on every side to
 * fit the requested marks without clipping. Callers ask for this BEFORE
 * calling computeMarksGeometry, to size the enlarged MediaBox first.
 */
export function requiredSlugPt(args: { crop?: boolean; registration?: boolean }): number {
  const markLen = mmToPt(MARK_LENGTH_MM);
  let slug = 0;
  if (args.crop) slug = Math.max(slug, markLen);
  if (args.registration) {
    slug = Math.max(slug, markLen + mmToPt(REG_GAP_MM) + 2 * mmToPt(REG_RADIUS_MM));
  }
  return slug;
}

/**
 * Compute crop-mark (8 segments, 2 per corner) and registration-mark (4,
 * side-midpoints) geometry for a page of the given size + bleed. Crop marks
 * are aligned to the TRIM line but drawn starting exactly at the bleed-box
 * edge (T1's "offset = bleed"), extending outward by `MARK_LENGTH_MM`.
 * Registration marks sit just beyond the crop marks' reach.
 */
export function computeMarksGeometry(args: {
  pageWidthPt: number;
  pageHeightPt: number;
  bleedPt: number;
  crop?: boolean;
  registration?: boolean;
}): MarksGeometry {
  const { pageWidthPt, pageHeightPt, bleedPt } = args;
  const markLen = mmToPt(MARK_LENGTH_MM);
  const trimX0 = bleedPt;
  const trimY0 = bleedPt;
  const trimX1 = pageWidthPt - bleedPt;
  const trimY1 = pageHeightPt - bleedPt;

  const cropMarks: LineSegment[] = [];
  if (args.crop) {
    // Bottom-left
    cropMarks.push({ x1: trimX0, y1: 0, x2: trimX0, y2: -markLen });
    cropMarks.push({ x1: 0, y1: trimY0, x2: -markLen, y2: trimY0 });
    // Bottom-right
    cropMarks.push({ x1: trimX1, y1: 0, x2: trimX1, y2: -markLen });
    cropMarks.push({ x1: pageWidthPt, y1: trimY0, x2: pageWidthPt + markLen, y2: trimY0 });
    // Top-left
    cropMarks.push({ x1: trimX0, y1: pageHeightPt, x2: trimX0, y2: pageHeightPt + markLen });
    cropMarks.push({ x1: 0, y1: trimY1, x2: -markLen, y2: trimY1 });
    // Top-right
    cropMarks.push({ x1: trimX1, y1: pageHeightPt, x2: trimX1, y2: pageHeightPt + markLen });
    cropMarks.push({ x1: pageWidthPt, y1: trimY1, x2: pageWidthPt + markLen, y2: trimY1 });
  }

  const registrationMarks: RegistrationMark[] = [];
  if (args.registration) {
    const regR = mmToPt(REG_RADIUS_MM);
    const offset = markLen + mmToPt(REG_GAP_MM) + regR;
    const mk = (cx: number, cy: number): RegistrationMark => ({
      circle: { cx, cy, r: regR },
      crosshair: [
        { x1: cx - regR, y1: cy, x2: cx + regR, y2: cy },
        { x1: cx, y1: cy - regR, x2: cx, y2: cy + regR },
      ],
    });
    registrationMarks.push(
      mk(pageWidthPt / 2, pageHeightPt + offset), // top-center
      mk(pageWidthPt / 2, -offset), // bottom-center
      mk(-offset, pageHeightPt / 2), // left-center
      mk(pageWidthPt + offset, pageHeightPt / 2) // right-center
    );
  }

  return { cropMarks, registrationMarks };
}

export const MARK_STROKE_PT = mmToPt(MARK_STROKE_MM);
