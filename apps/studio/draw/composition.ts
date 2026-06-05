/**
 * @file       draw/composition.ts — Phase 25.1 compositional scaffolding layer
 * @scope      apps/studio/draw/composition.ts
 * @purpose    The missing answer to "blob soup": deterministic COMPOSITION.
 *             Random placement is empirically catastrophic — only ~3–12% of
 *             randomly-placed multi-element layouts even avoid overlap (Shiripour
 *             et al., ACM EICS 2021). The fix is to place elements ON a
 *             constructed armature, not scatter-then-hope.
 *
 *             Grounded in the Phase-25.1 deep research (recorded in DDR-070 +
 *             the rubric's "Phase-25.1 corrections" section):
 *               • rule-of-thirds power points + rabatment lines + golden points
 *                 + dynamic-symmetry "eyes" — REAL, exact, encodable focal
 *                 scaffolds (place focal elements on the construction points).
 *               • VME visual balance as moment-equilibrium (nine-grid weight +
 *                 Manhattan distance; net moment → 0 = balanced).
 *               • φ / root-N are OPTIONAL aspect/scaffold choices, NEVER a
 *                 mandatory constraint — the golden-ratio "secret formula" is a
 *                 debunked myth (Naini 2024; Markowsky 1992).
 *
 *             CRITICAL: armatures are a GENERATION tool only. "Does it align to
 *             a grid?" is mathematically non-discriminating (a dense enough
 *             armature fits ANY image — Blake 1921), so it is USELESS as a critic
 *             gate. The critic uses discriminating metrics (balance moment,
 *             value range, hue-harmony distance) — see palette.ts + the rubric.
 *
 *             React-free (DDR-067); pure + deterministic (no Math.random).
 */

import type { Rect } from './geometry.ts';
import type { Point } from './primitives.ts';

const PHI = 1.618033988749895;

export type ArmatureKind = 'thirds' | 'golden' | 'rabatment' | 'dynamic-symmetry' | 'quad';

export interface Armature {
  kind: ArmatureKind;
  box: Rect;
  /** Construction lines (for an optional debug overlay). */
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  /** The focal "power points" / "eyes" — snap dominant elements here. */
  focals: Point[];
  /** The composition's visual center (canvas center; slightly-high reads better but center is the neutral default). */
  center: Point;
}

function corners(b: Rect) {
  return {
    tl: { x: b.x, y: b.y },
    tr: { x: b.x + b.width, y: b.y },
    bl: { x: b.x, y: b.y + b.height },
    br: { x: b.x + b.width, y: b.y + b.height },
  };
}

/** Foot of the perpendicular from point `p` onto the line through `a`→`b`. */
function perpFoot(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/**
 * Build a compositional armature for a canvas. The returned `focals` are the
 * snap targets for the dominant element(s); `lines` are the construction lines.
 * `golden` is offered for completeness but the research shows it has no special
 * status — prefer `thirds` / `rabatment` / `dynamic-symmetry`.
 */
export function armature(box: Rect, kind: ArmatureKind = 'thirds'): Armature {
  const { x, y, width: W, height: H } = box;
  const center = { x: x + W / 2, y: y + H / 2 };
  const lines: Armature['lines'] = [];
  let focals: Point[] = [];

  if (kind === 'thirds' || kind === 'golden') {
    const fx = kind === 'golden' ? [W / PHI, W - W / PHI] : [W / 3, (2 * W) / 3];
    const fy = kind === 'golden' ? [H / PHI, H - H / PHI] : [H / 3, (2 * H) / 3];
    for (const vx of fx) lines.push({ x1: x + vx, y1: y, x2: x + vx, y2: y + H });
    for (const hy of fy) lines.push({ x1: x, y1: y + hy, x2: x + W, y2: y + hy });
    for (const hy of fy) for (const vx of fx) focals.push({ x: x + vx, y: y + hy });
  } else if (kind === 'rabatment') {
    // Implied squares folded from each short side. Landscape → vertical lines at
    // x = H and x = W−H; portrait → horizontal lines at y = W and y = H−W. Focal
    // y (landscape) taken at the thirds heights (the verified rabatment geometry
    // governs the dominant axis; thirds fills the minor axis).
    if (W >= H) {
      const vx = [H, W - H];
      const hy = [H / 3, (2 * H) / 3];
      for (const v of vx) lines.push({ x1: x + v, y1: y, x2: x + v, y2: y + H });
      for (const h of hy) for (const v of vx) focals.push({ x: x + v, y: y + h });
    } else {
      const hy = [W, H - W];
      const vx = [W / 3, (2 * W) / 3];
      for (const h of hy) lines.push({ x1: x, y1: y + h, x2: x + W, y2: y + h });
      for (const h of hy) for (const v of vx) focals.push({ x: x + v, y: y + h });
    }
  } else if (kind === 'dynamic-symmetry') {
    const c = corners(box);
    // Main diagonals.
    lines.push({ x1: c.tl.x, y1: c.tl.y, x2: c.br.x, y2: c.br.y });
    lines.push({ x1: c.tr.x, y1: c.tr.y, x2: c.bl.x, y2: c.bl.y });
    // "Eyes" = feet of perpendiculars from the off-diagonal corners onto each main.
    const e1 = perpFoot(c.tr, c.tl, c.br);
    const e2 = perpFoot(c.bl, c.tl, c.br);
    const e3 = perpFoot(c.tl, c.tr, c.bl);
    const e4 = perpFoot(c.br, c.tr, c.bl);
    focals = [e1, e2, e3, e4];
    // Reciprocal segments (corner → its eye) for the overlay.
    lines.push({ x1: c.tr.x, y1: c.tr.y, x2: e1.x, y2: e1.y });
    lines.push({ x1: c.bl.x, y1: c.bl.y, x2: e2.x, y2: e2.y });
    lines.push({ x1: c.tl.x, y1: c.tl.y, x2: e3.x, y2: e3.y });
    lines.push({ x1: c.br.x, y1: c.br.y, x2: e4.x, y2: e4.y });
  } else {
    // quad — the four quarter-centers (a simple, balanced fallback grid).
    for (const qy of [0.25, 0.75])
      for (const qx of [0.25, 0.75]) focals.push({ x: x + W * qx, y: y + H * qy });
  }

  return { kind, box, lines, focals, center };
}

/** Nearest focal point on an armature to `p` (snap target). */
export function snapToFocal(p: Point, arm: Armature): Point {
  let best = arm.focals[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const f of arm.focals) {
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/**
 * Assign `n` elements to distinct composition slots. The first (dominant) gets a
 * strong focal point; the rest fill the remaining focals, then a jittered grid —
 * but NEVER pure random scatter. Deterministic given the armature.
 */
export function assignSlots(n: number, arm: Armature): Point[] {
  const out: Point[] = [];
  const focals = [...arm.focals];
  for (let i = 0; i < n; i++) {
    if (i < focals.length) {
      out.push(focals[i]);
    } else {
      // Beyond the focals, lay a calm grid inside the box (rows of ~√extra).
      const extra = i - focals.length;
      const cols = Math.max(2, Math.ceil(Math.sqrt(n - focals.length)));
      const r = Math.floor(extra / cols);
      const c = extra % cols;
      const rows = Math.ceil((n - focals.length) / cols);
      out.push({
        x: arm.box.x + arm.box.width * ((c + 1) / (cols + 1)),
        y: arm.box.y + arm.box.height * ((r + 1) / (rows + 1)),
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// VME visual balance — moment equilibrium (nine-grid weight + Manhattan)
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightedBox {
  bbox: Rect;
  /** Optional explicit visual weight; defaults to bbox area. */
  weight?: number;
}

export interface BalanceResult {
  /** Net moment vector about the visual center, normalized to [-1,1] per axis. */
  moment: Point;
  /** 0 (wildly off-balance) … 1 (perfectly balanced). */
  score: number;
}

function boxCentroid(b: Rect): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Visual balance as moment equilibrium (VME). Each element exerts a moment about
 * the canvas visual center proportional to its weight × Manhattan offset; a
 * balanced composition has a net moment near zero. Returns the normalized net
 * moment + a [0,1] balance score (the discriminating critic metric for balance).
 */
export function balanceMoment(elements: WeightedBox[], box: Rect): BalanceResult {
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const halfW = box.width / 2 || 1;
  const halfH = box.height / 2 || 1;
  let mx = 0;
  let my = 0;
  let totalW = 0;
  for (const el of elements) {
    const w = el.weight ?? Math.max(0, el.bbox.width * el.bbox.height);
    const c = boxCentroid(el.bbox);
    mx += w * (c.x - center.x);
    my += w * (c.y - center.y);
    totalW += w;
  }
  if (totalW === 0) return { moment: { x: 0, y: 0 }, score: 1 };
  const nx = mx / (totalW * halfW);
  const ny = my / (totalW * halfH);
  // Manhattan-style aggregate imbalance (matches VME's non-Euclidean weighting).
  const imbalance = Math.min(1, (Math.abs(nx) + Math.abs(ny)) / 2);
  return { moment: { x: nx, y: ny }, score: Math.max(0, 1 - imbalance) };
}

/**
 * Dominance check: does the composition have ONE clear focal element? Returns the
 * size ratio of the largest element's visual weight to the next-largest. A ratio
 * well above 1 means a single element commands attention; ~1 means competing
 * foci (the "everything is equally loud" failure). Threshold tuning is the
 * critic's job — this just reports the measurable ratio.
 */
export function dominanceRatio(elements: WeightedBox[]): number {
  const weights = elements
    .map((e) => e.weight ?? Math.max(0, e.bbox.width * e.bbox.height))
    .sort((a, b) => b - a);
  if (weights.length === 0) return 0;
  if (weights.length === 1) return Number.POSITIVE_INFINITY;
  return weights[1] > 0 ? weights[0] / weights[1] : Number.POSITIVE_INFINITY;
}
