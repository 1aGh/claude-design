/**
 * @file       annotations-bindings.ts — FigJam v3 connector binding
 * @scope      apps/studio/annotations-bindings.ts
 * @purpose    Pure helpers (no React, no DOM) for arrow ↔ shape magnetic
 *             binding. Semantics follow Excalidraw's binding system + FigJam's
 *             connector magnets: bind on proximity (~15 px at 100 % zoom,
 *             callers scale by 1/zoom), anchors snap to the {0, 0.5, 1} ×
 *             {0, 0.5, 1} magnet grid over the host bbox, bound endpoints are
 *             DERIVED from the host on every mutation (`recomputeBoundArrows`),
 *             and deleting a host strips the bind but keeps the arrow with the
 *             endpoint frozen in place (Excalidraw `fixBindingsAfterDeletion`).
 */

import {
  type ArrowBind,
  type ArrowStroke,
  rotatePoint,
  type Stroke,
  strokeBBox,
  strokeRotation,
} from './annotations-model.ts';

/** Hosts an arrow endpoint can attach to (shapes + cards, FigJam set). */
export function isBindable(s: Stroke): boolean {
  return (
    s.tool === 'rect' ||
    s.tool === 'ellipse' ||
    s.tool === 'polygon' ||
    s.tool === 'sticky' ||
    s.tool === 'image'
  );
}

/** Bind proximity threshold in world px at zoom 1 (Excalidraw's 15 px). */
export const BIND_THRESHOLD_PX = 15;

const MAGNETS = [0, 0.5, 1] as const;

function snapMagnet(v: number): number {
  let best: number = MAGNETS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const m of MAGNETS) {
    const d = Math.abs(v - m);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Topmost bindable host within `threshold` of the world point, with the anchor
 * snapped to the nearest side/center magnet. `excludeIds` keeps an arrow from
 * binding to a host that is itself part of the current gesture.
 */
export function bindCandidate(
  wx: number,
  wy: number,
  strokes: readonly Stroke[],
  threshold: number,
  excludeIds?: ReadonlySet<string>
): ArrowBind | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (!s || !isBindable(s) || excludeIds?.has(s.id)) continue;
    const bb = strokeBBox(s);
    if (!bb || bb.w <= 0 || bb.h <= 0) continue;
    if (
      wx < bb.x - threshold ||
      wx > bb.x + bb.w + threshold ||
      wy < bb.y - threshold ||
      wy > bb.y + bb.h + threshold
    ) {
      continue;
    }
    return {
      hostId: s.id,
      nx: snapMagnet(clamp01((wx - bb.x) / bb.w)),
      ny: snapMagnet(clamp01((wy - bb.y) / bb.h)),
    };
  }
  return null;
}

/** World position of a normalized anchor over the host's bbox. A rotated host
 *  carries its magnets with it (the anchor rotates around the bbox center). */
export function anchorPoint(host: Stroke, nx: number, ny: number): [number, number] | null {
  const bb = strokeBBox(host);
  if (!bb) return null;
  const px = bb.x + nx * bb.w;
  const py = bb.y + ny * bb.h;
  const rot = strokeRotation(host);
  if (rot === 0) return [px, py];
  return rotatePoint(px, py, bb.x + bb.w / 2, bb.y + bb.h / 2, rot);
}

/**
 * Re-derive every bound arrow endpoint from its host. Idempotent — an endpoint
 * already at its anchor is left referentially untouched, and the ORIGINAL
 * array is returned when nothing changed (so the drag-commit no-op checks keep
 * working). A bind whose host no longer exists (or stopped being bindable) is
 * stripped with the endpoint frozen in place — the arrow survives unbound.
 *
 * FigJam v3 auto-routing: an AUTO (non-pinned) bind re-picks the side magnet
 * FACING the arrow's other end on every recompute, so a connector keeps a
 * sensible direction as the shapes move around each other. A `pinned` bind
 * (explicit user re-anchor) keeps its magnet.
 */
export function recomputeBoundArrows(strokes: readonly Stroke[]): Stroke[] {
  const byId = new Map<string, Stroke>();
  for (const s of strokes) byId.set(s.id, s);
  let mutated = false;
  const out = strokes.map((s) => {
    if (s.tool !== 'arrow' || (!s.startBind && !s.endBind)) return s;
    let next: ArrowStroke = s;
    // Opposite-end reference points for the facing computation. When both
    // ends are bound, face the OTHER HOST's center (stable under endpoint
    // churn); a free end is its literal coordinate.
    const startHost = s.startBind ? byId.get(s.startBind.hostId) : undefined;
    const endHost = s.endBind ? byId.get(s.endBind.hostId) : undefined;
    const centerOf = (host: Stroke | undefined): [number, number] | null => {
      if (!host) return null;
      const bb = strokeBBox(host);
      return bb ? [bb.x + bb.w / 2, bb.y + bb.h / 2] : null;
    };
    const startRef: [number, number] = centerOf(endHost) ?? [s.x2, s.y2];
    const endRef: [number, number] = centerOf(startHost) ?? [s.x1, s.y1];
    const applyEnd = (
      bind: ArrowBind | undefined,
      end: 'start' | 'end',
      ref: [number, number]
    ): void => {
      if (!bind) return;
      const host = byId.get(bind.hostId);
      if (!host || !isBindable(host)) {
        const copy: ArrowStroke = { ...next };
        delete copy[end === 'start' ? 'startBind' : 'endBind'];
        next = copy;
        mutated = true;
        return;
      }
      let effective = bind;
      if (!bind.pinned) {
        const facing = facingAnchor(host, ref[0], ref[1]);
        if (facing && (facing.nx !== bind.nx || facing.ny !== bind.ny)) {
          effective = { ...bind, nx: facing.nx, ny: facing.ny };
          next =
            end === 'start' ? { ...next, startBind: effective } : { ...next, endBind: effective };
          mutated = true;
        }
      }
      const pt = anchorPoint(host, effective.nx, effective.ny);
      if (!pt) return;
      if (end === 'start') {
        if (next.x1 !== pt[0] || next.y1 !== pt[1]) {
          next = { ...next, x1: pt[0], y1: pt[1] };
          mutated = true;
        }
      } else if (next.x2 !== pt[0] || next.y2 !== pt[1]) {
        next = { ...next, x2: pt[0], y2: pt[1] };
        mutated = true;
      }
    };
    applyEnd(s.startBind, 'start', startRef);
    applyEnd(next.endBind, 'end', endRef);
    return next;
  });
  return mutated ? out : (strokes as Stroke[]);
}

/**
 * Side-magnet anchor on `host` facing the world point `(tx, ty)` — used by the
 * AI annotate verb + quick-create to pick a sensible attachment side without a
 * pointer position: the dominant axis of the direction vector decides the
 * side, the cross axis centers.
 */
export function facingAnchor(host: Stroke, tx: number, ty: number): ArrowBind | null {
  const bb = strokeBBox(host);
  if (!bb || bb.w <= 0 || bb.h <= 0) return null;
  const cx = bb.x + bb.w / 2;
  const cy = bb.y + bb.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  // Normalize by the half-extents so a wide-but-short card still picks the
  // side the target visually faces.
  const rx = Math.abs(dx) / Math.max(1, bb.w / 2);
  const ry = Math.abs(dy) / Math.max(1, bb.h / 2);
  if (rx >= ry) {
    return { hostId: host.id, nx: dx >= 0 ? 1 : 0, ny: 0.5 };
  }
  return { hostId: host.id, nx: 0.5, ny: dy >= 0 ? 1 : 0 };
}
