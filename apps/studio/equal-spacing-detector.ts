/**
 * @file       equal-spacing-detector.ts — T27 (Wave 3)
 * @scope      apps/studio/equal-spacing-detector.ts
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

// ─────────────────────────────────────────────────────────────────────────────
// Task L7 — Alt-hover distance measurement between exactly TWO rects (the
// selected element + whatever's hovered). Same pairwise-gap formula as
// `detectEqualSpacing`'s loop body, but without its 3-rect / equal-tolerance
// preconditions, and shaped for line-painting rather than midpoint dots.

export interface PairGap {
  axis: SpacingAxis;
  /** The gap between the two rects' facing edges, in the caller's coord space. */
  gap: number;
  /** Leading edge of the gap span — `left` for an x-axis line, `top` for y. */
  from: number;
  /** Perpendicular-axis center of the pair — `top` for an x-axis line
   *  (vertically centers it between the two rects), `left` for y. */
  cross: number;
}

/**
 * Distance between two rects along one axis. Returns `null` when they
 * overlap on that axis (no meaningful gap — e.g. two rects stacked only on
 * y have no x-axis gap to show).
 */
export function computePairGap(a: Rect, b: Rect, axis: SpacingAxis): PairGap | null {
  const [first, second] =
    axis === 'x' ? (a.x <= b.x ? [a, b] : [b, a]) : a.y <= b.y ? [a, b] : [b, a];
  if (axis === 'x') {
    const gap = second.x - (first.x + first.w);
    if (gap <= 0) return null;
    return {
      axis,
      gap,
      from: first.x + first.w,
      cross: (first.y + first.h / 2 + second.y + second.h / 2) / 2,
    };
  }
  const gap = second.y - (first.y + first.h);
  if (gap <= 0) return null;
  return {
    axis,
    gap,
    from: first.y + first.h,
    cross: (first.x + first.w / 2 + second.x + second.w / 2) / 2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task L5 — distribute / align / tidy-up for a multi-selection of ELEMENTS.
//
// These mirror the artboard `distributeArtboards`/`alignArtboards` algorithms
// in canvas-shell.tsx verbatim, generalized from `ArtboardRect` to any rect
// set. Kept pure/DOM-free like `detectEqualSpacing` above — the caller
// resolves DOM rects, calls these, then posts one `reposition-request` per
// moved rect through the existing element-drag write lane (no new endpoint).
//
// `key` is an OPAQUE caller-supplied correlation token (not a `data-cd-id`) —
// a shared-component instance's cd-id can repeat across selections
// (disambiguated only by occurrence index), so matching results back to the
// caller's own bookkeeping by `id` would collide. Callers pass e.g. the
// selection's array index as `key` and zip the result back themselves.

export interface KeyedRect extends Rect {
  key: string;
}

export type AlignAxisMode = 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y';

export interface MovedRect {
  key: string;
  x: number;
  y: number;
}

/**
 * Align 2+ rects to a common edge/midline of their union bbox. Returns only
 * the rects whose position actually changes (rounded-equal = no-op, skipped).
 */
export function computeAlign(rects: KeyedRect[], mode: AlignAxisMode): MovedRect[] {
  if (rects.length < 2) return [];
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.x < xMin) xMin = r.x;
    if (r.y < yMin) yMin = r.y;
    if (r.x + r.w > xMax) xMax = r.x + r.w;
    if (r.y + r.h > yMax) yMax = r.y + r.h;
  }
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const moved: MovedRect[] = [];
  for (const r of rects) {
    let nx = r.x;
    let ny = r.y;
    switch (mode) {
      case 'left':
        nx = xMin;
        break;
      case 'right':
        nx = xMax - r.w;
        break;
      case 'center-x':
        nx = cx - r.w / 2;
        break;
      case 'top':
        ny = yMin;
        break;
      case 'bottom':
        ny = yMax - r.h;
        break;
      case 'center-y':
        ny = cy - r.h / 2;
        break;
    }
    if (Math.round(nx) === Math.round(r.x) && Math.round(ny) === Math.round(r.y)) continue;
    moved.push({ key: r.key, x: Math.round(nx), y: Math.round(ny) });
  }
  return moved;
}

/**
 * Distribute 3+ rects with equal gaps on one axis. Sorts by leading edge,
 * holds the first + last fixed, redistributes the middle ones so the trailing
 * → next-leading gap is equal everywhere.
 */
export function computeDistribute(rects: KeyedRect[], axis: SpacingAxis): MovedRect[] {
  if (rects.length < 3) return [];
  const sorted = [...rects].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const sideLen = (r: KeyedRect) => (axis === 'x' ? r.w : r.h);
  const totalSides = sorted.reduce((acc, r) => acc + sideLen(r), 0);
  const span = (axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y) - totalSides;
  const gap = span / (sorted.length - 1);
  const moved: MovedRect[] = [];
  let cursor = axis === 'x' ? first.x + first.w + gap : first.y + first.h + gap;
  for (let i = 1; i < sorted.length - 1; i++) {
    const r = sorted[i];
    if (!r) continue;
    if (axis === 'x') {
      moved.push({ key: r.key, x: Math.round(cursor), y: Math.round(r.y) });
      cursor += r.w + gap;
    } else {
      moved.push({ key: r.key, x: Math.round(r.x), y: Math.round(cursor) });
      cursor += r.h + gap;
    }
  }
  return moved;
}

export interface TidyOptions {
  /** Pixel gap between grid cells, both axes. Default 16. */
  gap?: number;
  /** Column count. Default: near-square (`round(sqrt(n))`). */
  columns?: number;
}

/**
 * Snap 2+ rects into a clean grid: reading-order sort (top-to-bottom, then
 * left-to-right), laid out at a fixed gap from the union bbox's top-left,
 * each column/row sized to its widest/tallest member so nothing overlaps.
 */
export function computeTidyGrid(rects: KeyedRect[], opts: TidyOptions = {}): MovedRect[] {
  const n = rects.length;
  if (n < 2) return [];
  const gap = opts.gap ?? 16;
  const columns = Math.max(1, Math.min(n, opts.columns ?? Math.round(Math.sqrt(n))));
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const originX = Math.min(...rects.map((r) => r.x));
  const originY = Math.min(...rects.map((r) => r.y));
  const rows = Math.ceil(n / columns);
  const colWidths: number[] = new Array(columns).fill(0);
  const rowHeights: number[] = new Array(rows).fill(0);
  sorted.forEach((r, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;
    colWidths[col] = Math.max(colWidths[col] ?? 0, r.w);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, r.h);
  });
  const colX: number[] = [];
  {
    let cursor = originX;
    for (let c = 0; c < columns; c++) {
      colX.push(cursor);
      cursor += (colWidths[c] ?? 0) + gap;
    }
  }
  const rowY: number[] = [];
  {
    let cursor = originY;
    for (let r = 0; r < rows; r++) {
      rowY.push(cursor);
      cursor += (rowHeights[r] ?? 0) + gap;
    }
  }
  return sorted.map((r, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const nx = colX[col] ?? r.x;
    const ny = rowY[row] ?? r.y;
    return { key: r.key, x: Math.round(nx), y: Math.round(ny) };
  });
}
