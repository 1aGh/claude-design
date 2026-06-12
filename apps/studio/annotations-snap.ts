/**
 * @file       annotations-snap.ts — FigJam v3 drag snapping + smart guides
 * @scope      apps/studio/annotations-snap.ts
 * @purpose    Pure math (no React, no DOM) for edge/center snapping while
 *             dragging annotation strokes. Candidates are the bboxes of the
 *             non-moved strokes plus the artboard rects; per axis the nearest
 *             candidate line within the threshold wins and contributes one
 *             guide line for the overlay to paint. Hold ⌘ to suppress
 *             (handled by the caller — Figma/FigJam convention).
 */

export interface SnapBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  /** `x` = a vertical guide at x=`at`; `y` = a horizontal guide at y=`at`. */
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/** Snap threshold in world px at zoom 1 (callers scale by 1/zoom). */
export const SNAP_THRESHOLD_PX = 6;

/** Dot-grid pitch in world px — mirrors the DS `--canvas-grid` token (24px). */
export const GRID_PITCH_PX = 24;

const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

function lines(b: SnapBox, axis: 'x' | 'y'): [number, number, number] {
  return axis === 'x' ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h];
}

/**
 * Nearest grid-line correction for one axis position. The dot grid is a
 * world-space lattice at `pitch`; the stroke's leading edge snaps to it.
 */
function gridDelta(pos: number, pitch: number, threshold: number): number | null {
  const nearest = Math.round(pos / pitch) * pitch;
  const d = nearest - pos;
  return Math.abs(d) <= threshold ? d : null;
}

/**
 * Best snap correction for the moving bbox against the candidates. The two
 * axes resolve independently (FigJam: a drag can snap horizontally to one
 * neighbour and vertically to another). Edges AND centers participate.
 *
 * Grid snapping (`opts.grid`): when an axis finds NO stroke/artboard snap, its
 * leading edge falls back to the canvas dot grid — weaker than smart guides
 * (geometry alignment wins over the lattice) and silent (no guide line, the
 * dots themselves are the visual). ⌘ suppresses both via the caller.
 */
export function computeSnap(
  moving: SnapBox,
  candidates: readonly SnapBox[],
  threshold: number,
  opts?: { grid?: number }
): SnapResult {
  const grid = opts?.grid ?? 0;
  if (threshold <= 0 || (candidates.length === 0 && grid <= 0)) return NO_SNAP;
  let bestX: { d: number; at: number; cand: SnapBox } | null = null;
  let bestY: { d: number; at: number; cand: SnapBox } | null = null;
  const mx = lines(moving, 'x');
  const my = lines(moving, 'y');
  for (const c of candidates) {
    const cx = lines(c, 'x');
    const cy = lines(c, 'y');
    for (const m of mx) {
      for (const v of cx) {
        const d = v - m;
        if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
          bestX = { d, at: v, cand: c };
        }
      }
    }
    for (const m of my) {
      for (const v of cy) {
        const d = v - m;
        if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
          bestY = { d, at: v, cand: c };
        }
      }
    }
  }
  // Grid fallback per axis — only where no smart-guide candidate won.
  let gridDx: number | null = null;
  let gridDy: number | null = null;
  if (grid > 0) {
    if (!bestX) gridDx = gridDelta(moving.x, grid, threshold);
    if (!bestY) gridDy = gridDelta(moving.y, grid, threshold);
  }
  if (!bestX && !bestY && gridDx == null && gridDy == null) return NO_SNAP;
  const dx = bestX?.d ?? gridDx ?? 0;
  const dy = bestY?.d ?? gridDy ?? 0;
  const guides: SnapGuide[] = [];
  if (bestX) {
    guides.push({
      axis: 'x',
      at: bestX.at,
      from: Math.min(moving.y + dy, bestX.cand.y),
      to: Math.max(moving.y + moving.h + dy, bestX.cand.y + bestX.cand.h),
    });
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      at: bestY.at,
      from: Math.min(moving.x + dx, bestY.cand.x),
      to: Math.max(moving.x + moving.w + dx, bestY.cand.x + bestY.cand.w),
    });
  }
  return { dx, dy, guides };
}
