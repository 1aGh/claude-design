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

const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

function lines(b: SnapBox, axis: 'x' | 'y'): [number, number, number] {
  return axis === 'x' ? [b.x, b.x + b.w / 2, b.x + b.w] : [b.y, b.y + b.h / 2, b.y + b.h];
}

/**
 * Best snap correction for the moving bbox against the candidates. The two
 * axes resolve independently (FigJam: a drag can snap horizontally to one
 * neighbour and vertically to another). Edges AND centers participate.
 */
export function computeSnap(
  moving: SnapBox,
  candidates: readonly SnapBox[],
  threshold: number
): SnapResult {
  if (threshold <= 0 || candidates.length === 0) return NO_SNAP;
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
  if (!bestX && !bestY) return NO_SNAP;
  const dx = bestX?.d ?? 0;
  const dy = bestY?.d ?? 0;
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
