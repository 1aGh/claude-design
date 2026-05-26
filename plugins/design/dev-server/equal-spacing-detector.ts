/**
 * @file       equal-spacing-detector.ts — T27 (Wave 3)
 * @scope      plugins/design/dev-server/equal-spacing-detector.ts
 * @purpose    Pure detector for Figma "Smart Selection" pink-dot affordance
 *             (Rasmus Andersson 2018). Given 3+ rects on a single axis,
 *             returns the equal gap + the screen-coord midpoints between
 *             adjacent pairs IF all pairwise gaps are within `tolerancePx`
 *             of each other. Returns `null` when the rects are not equally
 *             distributed.
 *
 *             Pure / DOM-free / framework-free — same convention as
 *             `computeSnap` in `use-snap-guides.tsx`. The overlay layer
 *             consumes the result and paints the pink dots.
 *
 *             Coordinate space is the caller's choice — pass screen-space
 *             rects for live overlay rendering, or world-space rects for
 *             distribute-command verification. The math is uniform either
 *             way; only the unit of `tolerancePx` differs.
 */

import type { Rect } from './use-snap-guides.tsx';

export type SpacingAxis = 'x' | 'y';

export interface EqualSpacingResult {
  axis: SpacingAxis;
  /** The gap measured between adjacent rects (post-sort by leading edge).
   *  Caller renders this in the distance pill above each pink dot. */
  gapPx: number;
  /** Midpoint coords between consecutive rects. Length = rects.length - 1.
   *  Each entry is in caller's coord space; renderers anchor pink dots here. */
  midpoints: Array<{ x: number; y: number }>;
}

interface DetectOptions {
  /** How close gaps must be to count as "equal", in caller's unit (default 1). */
  tolerancePx?: number;
}

/**
 * Detect equal spacing along one axis. Returns `null` when:
 *   - fewer than 3 rects (2 rects trivially have "equal" spacing — undefined).
 *   - any pairwise gap differs from the median by more than `tolerancePx`.
 *   - rects overlap on the spacing axis (gap < 0 anywhere).
 *
 * The midpoint y (for axis='x') or x (for axis='y') is the average of the
 * adjacent rects' center on the perpendicular axis — this places the pink
 * dot vertically centered between the two siblings, which is where the
 * distance pill anchors above.
 */
export function detectEqualSpacing(
  rects: Rect[],
  axis: SpacingAxis,
  opts: DetectOptions = {}
): EqualSpacingResult | null {
  if (rects.length < 3) return null;
  const tol = opts.tolerancePx ?? 1;

  // Sort by leading edge on the spacing axis.
  const sorted = [...rects].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));

  // Compute pairwise gaps + midpoints.
  const gaps: number[] = [];
  const midpoints: Array<{ x: number; y: number }> = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev || !cur) return null;
    if (axis === 'x') {
      const gap = cur.x - (prev.x + prev.w);
      if (gap < 0) return null; // overlap; not a distributed set
      gaps.push(gap);
      midpoints.push({
        x: prev.x + prev.w + gap / 2,
        y: (prev.y + prev.h / 2 + (cur.y + cur.h / 2)) / 2,
      });
    } else {
      const gap = cur.y - (prev.y + prev.h);
      if (gap < 0) return null;
      gaps.push(gap);
      midpoints.push({
        x: (prev.x + prev.w / 2 + (cur.x + cur.w / 2)) / 2,
        y: prev.y + prev.h + gap / 2,
      });
    }
  }

  // All gaps must be within tolerance of each other. Use the median as anchor
  // to be robust against a single outlier — though if any gap is outside the
  // band we return null, so median vs mean is academic here.
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0;
  for (const g of gaps) {
    if (Math.abs(g - median) > tol) return null;
  }

  return { axis, gapPx: median, midpoints };
}
