/**
 * @file       canvas-arrowheads.ts — Phase 24 arrow shaft + head geometry
 * @scope      apps/studio/canvas-arrowheads.ts
 * @purpose    Single source of truth for arrow rendering. An ArrowStroke is
 *             reduced to an ordered list of `SvgPrimitive`s (the shaft, then
 *             the start head, then the end head). The serializer formats each
 *             primitive into the persisted `.annotations.svg` string; the live
 *             `StrokeNode` maps the SAME primitives to JSX — so the on-disk and
 *             on-canvas forms can never drift.
 *
 *             Back-compat invariant (DDR-067): a default arrow (lineType
 *             'straight', startHead 'none', endHead 'triangle', solid) MUST
 *             reduce to exactly `[<line>, <polyline fill=color>]` — the
 *             byte-identical Phase-5.1 form the canary fixtures freeze.
 *             `arrowHeadPoints` lives here (moved from annotations-layer, which
 *             re-exports it). This module owns the arrow style enums + a
 *             structural geometry input and imports NOTHING from
 *             annotations-layer — keeping the dependency one-way
 *             (annotations-layer → canvas-arrowheads) so there is no module
 *             cycle. (A `.ts` root in a re-export cycle with a react `.tsx`
 *             breaks @types/react's global `JSX` namespace project-wide under
 *             this tsconfig's `types: ["bun-types"]` — see DDR-067.)
 */

/**
 * Phase 24 — full FigJam arrowhead vocabulary, selectable per end. `none` =
 * bare end; `line` = open chevron; `triangle` = the legacy filled head
 * (default end); `triangle-outline` = unfilled triangle; `circle` / `diamond`
 * = filled markers. annotations-layer re-exports this type.
 */
export type ArrowHead = 'none' | 'line' | 'triangle' | 'triangle-outline' | 'circle' | 'diamond';
/** The valid `ArrowHead` vocabulary as a runtime set — `svgToStrokes` clamps a
 *  parsed `data-*-head` against this so a poisoned/out-of-vocab value can't be
 *  cast through unchecked (Phase 24 security review, DDR-067). */
export const ARROW_HEADS: ReadonlySet<string> = new Set<ArrowHead>([
  'none',
  'line',
  'triangle',
  'triangle-outline',
  'circle',
  'diamond',
]);
/** Phase 24 — arrow shaft routing. `straight` is the default + legacy form. */
export type ArrowLineType = 'straight' | 'curved' | 'elbow';

/**
 * Structural geometry input for {@link arrowPrimitives}. `ArrowStroke` (defined
 * in annotations-layer) is assignable to this, so we depend on the shape, not
 * the named type — no import back, no cycle.
 */
export interface ArrowGeom {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  startHead?: ArrowHead;
  endHead?: ArrowHead;
  dashed?: boolean;
  lineType?: ArrowLineType;
}

/**
 * The filled-triangle head outline as an SVG `points` string. Three points —
 * `wingA, tip, wingB` — drawn as a <polyline> (filled = solid triangle, the
 * implicit close; unfilled = open chevron) or a <polygon> (closed outline).
 * Parameterized by the tip + the point the shaft arrives FROM, exactly as in
 * Phase 5.1, so the legacy serialization is byte-identical.
 */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 12 + width * 2;
  const wing = Math.PI / 7;
  const ax = x2 - Math.cos(angle - wing) * len;
  const ay = y2 - Math.sin(angle - wing) * len;
  const bx = x2 - Math.cos(angle + wing) * len;
  const by = y2 - Math.sin(angle + wing) * len;
  return `${ax},${ay} ${x2},${y2} ${bx},${by}`;
}

/** A small diamond head centered on the tip, one axis along the shaft. */
function diamondHeadPoints(
  fromX: number,
  fromY: number,
  tipX: number,
  tipY: number,
  width: number
): string {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const half = 5 + width;
  const ax = Math.cos(angle);
  const ay = Math.sin(angle);
  const px = -ay;
  const py = ax;
  const p = (dx: number, dy: number) => `${tipX + dx},${tipY + dy}`;
  return `${p(ax * half, ay * half)} ${p(px * half, py * half)} ${p(-ax * half, -ay * half)} ${p(
    -px * half,
    -py * half
  )}`;
}

/** Ordered SVG primitives — the shaft + heads. The renderer/serializer format these. */
export type SvgPrimitive =
  | { el: 'line'; x1: number; y1: number; x2: number; y2: number; dash: boolean }
  | { el: 'path'; d: string; dash: boolean }
  | { el: 'polyline'; points: string; fill: string }
  | { el: 'polygon'; points: string; fill: string }
  | { el: 'circle'; cx: number; cy: number; r: number; fill: string };

/**
 * Shaft path for a non-straight arrow + the control point each head orients
 * toward (its tangent source). Straight arrows never call this — they use a
 * bare <line> so the legacy bytes are preserved.
 */
function shaftPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineType: Exclude<ArrowLineType, 'straight'>
): { d: string; startFrom: [number, number]; endFrom: [number, number] } {
  if (lineType === 'curved') {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular bow — 22% of the chord, consistent side so curve is stable.
    const off = len * 0.22;
    const cx = mx + (-dy / len) * off;
    const cy = my + (dx / len) * off;
    return { d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, startFrom: [cx, cy], endFrom: [cx, cy] };
  }
  // elbow — one orthogonal bend, along the dominant axis first.
  const corner: [number, number] = Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? [x2, y1] : [x1, y2];
  return {
    d: `M${x1} ${y1} L${corner[0]} ${corner[1]} L${x2} ${y2}`,
    startFrom: corner,
    endFrom: corner,
  };
}

function headPrimitives(
  head: ArrowHead,
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  width: number,
  color: string
): SvgPrimitive[] {
  switch (head) {
    case 'none':
      return [];
    case 'triangle':
      // Legacy filled head — byte-identical to Phase 5.1.
      return [
        { el: 'polyline', points: arrowHeadPoints(fromX, fromY, tipX, tipY, width), fill: color },
      ];
    case 'line':
      // Open chevron — same 3 points, unfilled (no implicit close).
      return [
        { el: 'polyline', points: arrowHeadPoints(fromX, fromY, tipX, tipY, width), fill: 'none' },
      ];
    case 'triangle-outline':
      // Closed triangle outline — polygon auto-closes the third edge.
      return [
        { el: 'polygon', points: arrowHeadPoints(fromX, fromY, tipX, tipY, width), fill: 'none' },
      ];
    case 'diamond':
      return [
        { el: 'polygon', points: diamondHeadPoints(fromX, fromY, tipX, tipY, width), fill: color },
      ];
    case 'circle':
      return [{ el: 'circle', cx: tipX, cy: tipY, r: 4 + width, fill: color }];
    default:
      // Defensive: an out-of-vocabulary head (e.g. a poisoned hub-pushed value
      // that slipped past the parse-clamp) renders NOTHING rather than throwing
      // a TypeError mid-render — no per-stroke render DoS (Phase 24 security
      // review, DDR-067). Parse-clamp + serialize-esc are the primary controls.
      return [];
  }
}

/**
 * Reduce an arrow to its ordered SVG primitives: shaft, then start head, then
 * end head (matching the legacy serialization order). Defaults: start 'none',
 * end 'triangle', lineType 'straight', solid.
 */
export function arrowPrimitives(s: ArrowGeom): SvgPrimitive[] {
  const startHead = s.startHead ?? 'none';
  const endHead = s.endHead ?? 'triangle';
  const dashed = s.dashed ?? false;
  const lineType = s.lineType ?? 'straight';
  const out: SvgPrimitive[] = [];

  // Default tangent sources (straight): each head points away from the far end.
  let startFrom: [number, number] = [s.x2, s.y2];
  let endFrom: [number, number] = [s.x1, s.y1];

  if (lineType === 'straight') {
    out.push({ el: 'line', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, dash: dashed });
  } else {
    const shaft = shaftPath(s.x1, s.y1, s.x2, s.y2, lineType);
    out.push({ el: 'path', d: shaft.d, dash: dashed });
    startFrom = shaft.startFrom;
    endFrom = shaft.endFrom;
  }

  out.push(...headPrimitives(startHead, s.x1, s.y1, startFrom[0], startFrom[1], s.width, s.color));
  out.push(...headPrimitives(endHead, s.x2, s.y2, endFrom[0], endFrom[1], s.width, s.color));
  return out;
}
