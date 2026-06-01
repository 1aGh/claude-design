/**
 * @file       draw/geometry.ts — Phase 25 geometry-engine math layer
 * @scope      plugins/design/dev-server/draw/geometry.ts
 * @purpose    Pure, deterministic geometry the LLM must NOT free-hand:
 *               • PCHIP monotone-cubic interpolation (overshoot-free curves —
 *                 the whole point vs LLM-guessed Béziers, which wobble);
 *               • A* obstacle-aware connector routing with chamfered corners
 *                 (diagram edges that never cross nodes, never gap);
 *               • polygon centroid + convex hull (optical centering);
 *               • optical-correction constants (circle ≈ +12.84% equal-area,
 *                 overshoot ratios, centroid-centering).
 *             No `Math.random`, no `Date.now` — same input ⇒ same output, so
 *             every helper is unit-testable and canvases are reproducible.
 *
 *             Mirrors `canvas-arrowheads.ts#shaftPath`/`arrowHeadPoints` (pure
 *             trig returning geometry). React-free (DDR-067).
 */

import type { Point } from './primitives.ts';

// ─────────────────────────────────────────────────────────────────────────────
// PCHIP — monotone piecewise cubic Hermite (Fritsch–Carlson)
// ─────────────────────────────────────────────────────────────────────────────

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/**
 * Fritsch–Carlson slopes that guarantee the interpolant is monotone on every
 * interval where the data is monotone — i.e. no overshoot. Endpoints use the
 * standard non-centered three-point formula, clamped so they can't introduce
 * overshoot either.
 *
 * @param xs strictly increasing knot positions
 * @param ys knot values
 */
export function pchipSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n !== ys.length) throw new Error('pchipSlopes: xs and ys length mismatch');
  if (n < 2) return new Array(n).fill(0);

  const h: number[] = [];
  const delta: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const dx = xs[k + 1] - xs[k];
    if (dx <= 0) throw new Error('pchipSlopes: xs must be strictly increasing');
    h.push(dx);
    delta.push((ys[k + 1] - ys[k]) / dx);
  }

  const m = new Array<number>(n).fill(0);

  // Interior slopes: 0 at local extrema; weighted harmonic mean otherwise.
  for (let k = 1; k < n - 1; k++) {
    if (sign(delta[k - 1]) * sign(delta[k]) <= 0) {
      m[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      m[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
    }
  }

  // Endpoint slopes (shape-preserving, clamped).
  m[0] = endpointSlope(h[0], h[1] ?? h[0], delta[0], delta[1] ?? delta[0]);
  m[n - 1] = endpointSlope(
    h[n - 2],
    h[n - 3] ?? h[n - 2],
    delta[n - 2],
    delta[n - 3] ?? delta[n - 2]
  );
  return m;
}

function endpointSlope(h0: number, h1: number, d0: number, d1: number): number {
  let m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (sign(m) !== sign(d0)) {
    m = 0;
  } else if (sign(d0) !== sign(d1) && Math.abs(m) > 3 * Math.abs(d0)) {
    m = 3 * d0;
  }
  return m;
}

/** Evaluate the PCHIP interpolant at `x` (clamped to the data domain). */
export function pchipEval(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (n === 0) throw new Error('pchipEval: empty data');
  if (n === 1) return ys[0];
  const m = pchipSlopes(xs, ys);
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  // Locate segment k with xs[k] <= x < xs[k+1].
  let k = 0;
  while (k < n - 2 && x >= xs[k + 1]) k++;
  const hK = xs[k + 1] - xs[k];
  const t = (x - xs[k]) / hK;
  const t2 = t * t;
  const t3 = t2 * t;
  // Hermite basis.
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * ys[k] + h10 * hK * m[k] + h01 * ys[k + 1] + h11 * hK * m[k + 1];
}

/**
 * A smooth, overshoot-free SVG path through `points` as cubic Béziers derived
 * from the PCHIP slopes. Points are sorted by x first (a function-graph curve).
 * Returns an `M … C … C …` `d` string suitable for `path({ d })`.
 */
export function pchipPath(points: Point[]): string {
  if (points.length === 0) return '';
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length === 1) return `M${fmt(sorted[0].x)} ${fmt(sorted[0].y)}`;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);
  const m = pchipSlopes(xs, ys);
  let d = `M${fmt(xs[0])} ${fmt(ys[0])}`;
  for (let k = 0; k < sorted.length - 1; k++) {
    const h = xs[k + 1] - xs[k];
    const c1x = xs[k] + h / 3;
    const c1y = ys[k] + (m[k] * h) / 3;
    const c2x = xs[k + 1] - h / 3;
    const c2y = ys[k + 1] - (m[k + 1] * h) / 3;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(xs[k + 1])} ${fmt(ys[k + 1])}`;
  }
  return d;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e3) / 1e3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Polygon helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Signed area (shoelace). Positive = counter-clockwise in SVG's y-down space. */
export function polygonArea(points: Point[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Area centroid of a (simple) polygon. Falls back to the vertex average for
 * degenerate / near-zero-area inputs so it never returns NaN.
 */
export function centroid(points: Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n < 3) return vertexMean(points);
  const a = polygonArea(points);
  if (Math.abs(a) < 1e-9) return vertexMean(points);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  const f = 1 / (6 * a);
  return { x: cx * f, y: cy * f };
}

function vertexMean(points: Point[]): Point {
  const s = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}

/** Convex hull (Andrew's monotone chain), returned counter-clockwise, no dup endpoint. */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const n = pts.length;
  if (n < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ─────────────────────────────────────────────────────────────────────────────
// Optical corrections
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The factor by which a circle's *diameter* must exceed a square's *side* for
 * the two to read as the same visual size — equal-area: `2/√π ≈ 1.1284`
 * (≈ +12.84%). The canonical Bjango optical-adjustment number.
 */
export const EQUAL_AREA_CIRCLE_SCALE = 2 / Math.sqrt(Math.PI);

/** Circle diameter that visually matches a square of side `squareSide`. */
export function equalWeightCircleDiameter(squareSide: number): number {
  return squareSide * EQUAL_AREA_CIRCLE_SCALE;
}

/**
 * Grow an extent by an overshoot ratio so curved/pointed forms appear to align
 * with flat edges. Typical ratio 0.01–0.03 (cap-line overshoot) up to the
 * equal-area circle factor for round counters.
 */
export function overshoot(extent: number, ratio = 0.02): number {
  return extent * (1 + ratio);
}

/**
 * Translation needed to move a polygon's *area centroid* onto a target point.
 * Triangles and play-glyphs must be centroid-centered, not bounding-box
 * centered, or they read as offset toward the wide side (rubric check 22).
 */
export function centroidCenter(
  points: Point[],
  targetCx: number,
  targetCy: number
): { dx: number; dy: number } {
  const c = centroid(points);
  return { dx: targetCx - c.x, dy: targetCy - c.y };
}

// ─────────────────────────────────────────────────────────────────────────────
// A* connector routing (obstacle-aware, chamfered corners)
// ─────────────────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteOpts {
  /** Grid cell size in user units (default 10). Smaller = finer, slower. */
  grid?: number;
  /** Inflate every obstacle by this many units before routing (default 0). */
  padding?: number;
  /** Search bounds; defaults to the inputs' bounding box + margin. */
  bounds?: Rect;
  /** Extra cost per 90° turn so routes prefer straight runs (default 2). */
  turnPenalty?: number;
  /** Corner chamfer radius; 0 leaves sharp orthogonal corners (default 0). */
  chamfer?: number;
}

interface HeapItem {
  f: number;
  seq: number;
  key: string;
  gx: number;
  gy: number;
  dir: number;
}

/**
 * Route an orthogonal connector from `start` to `goal` around `obstacles` using
 * A* on a uniform grid. Returns waypoints (world coords) including endpoints.
 * Falls back to a straight `[start, goal]` if the grid is fully blocked — a
 * drawing tool should degrade, not throw.
 */
export function routeConnector(
  start: Point,
  goal: Point,
  obstacles: Rect[] = [],
  opts: RouteOpts = {}
): Point[] {
  const cell = opts.grid ?? 10;
  const pad = opts.padding ?? 0;
  const turnPenalty = opts.turnPenalty ?? 2;

  const inflated = obstacles.map((o) => ({
    x: o.x - pad,
    y: o.y - pad,
    width: o.width + 2 * pad,
    height: o.height + 2 * pad,
  }));

  const bounds = opts.bounds ?? computeBounds(start, goal, inflated, cell * 2);
  const cols = Math.max(1, Math.ceil(bounds.width / cell)) + 1;
  const rows = Math.max(1, Math.ceil(bounds.height / cell)) + 1;

  const toGrid = (p: Point) => ({
    gx: clamp(Math.round((p.x - bounds.x) / cell), 0, cols - 1),
    gy: clamp(Math.round((p.y - bounds.y) / cell), 0, rows - 1),
  });
  const toWorld = (gx: number, gy: number): Point => ({
    x: bounds.x + gx * cell,
    y: bounds.y + gy * cell,
  });

  const s = toGrid(start);
  const g = toGrid(goal);

  const blocked = (gx: number, gy: number): boolean => {
    if (gx === s.gx && gy === s.gy) return false;
    if (gx === g.gx && gy === g.gy) return false;
    const p = toWorld(gx, gy);
    for (const o of inflated) {
      if (p.x >= o.x && p.x <= o.x + o.width && p.y >= o.y && p.y <= o.y + o.height) return true;
    }
    return false;
  };

  // Directions: 1:+x 2:-x 3:+y 4:-y (0 = start, no incoming direction).
  const DIRS = [
    { dx: 1, dy: 0, dir: 1 },
    { dx: -1, dy: 0, dir: 2 },
    { dx: 0, dy: 1, dir: 3 },
    { dx: 0, dy: -1, dir: 4 },
  ];

  const heap = new MinHeap();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  let seq = 0;

  const startKey = stateKey(s.gx, s.gy, 0);
  gScore.set(startKey, 0);
  heap.push({ f: heuristic(s.gx, s.gy, g), seq: seq++, key: startKey, gx: s.gx, gy: s.gy, dir: 0 });

  let goalKey: string | null = null;

  while (!heap.isEmpty()) {
    const cur = heap.pop() as HeapItem;
    if (cur.gx === g.gx && cur.gy === g.gy) {
      goalKey = cur.key;
      break;
    }
    const curG = gScore.get(cur.key) ?? Number.POSITIVE_INFINITY;
    for (const d of DIRS) {
      const nx = cur.gx + d.dx;
      const ny = cur.gy + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (blocked(nx, ny)) continue;
      const turn = cur.dir !== 0 && cur.dir !== d.dir ? turnPenalty : 0;
      const tentative = curG + 1 + turn;
      const nKey = stateKey(nx, ny, d.dir);
      if (tentative < (gScore.get(nKey) ?? Number.POSITIVE_INFINITY)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, cur.key);
        heap.push({
          f: tentative + heuristic(nx, ny, g),
          seq: seq++,
          key: nKey,
          gx: nx,
          gy: ny,
          dir: d.dir,
        });
      }
    }
  }

  if (goalKey === null) return [start, goal];

  // Reconstruct grid path.
  const gridPath: Point[] = [];
  let k: string | undefined = goalKey;
  while (k !== undefined) {
    const [gx, gy] = k.split(',').map(Number);
    gridPath.push(toWorld(gx, gy));
    k = cameFrom.get(k);
  }
  gridPath.reverse();

  // Snap real endpoints back in (grid-rounding may have nudged them).
  gridPath[0] = start;
  gridPath[gridPath.length - 1] = goal;

  const simplified = simplifyCollinear(gridPath);
  return opts.chamfer && opts.chamfer > 0 ? chamferCorners(simplified, opts.chamfer) : simplified;
}

function heuristic(gx: number, gy: number, goal: { gx: number; gy: number }): number {
  return Math.abs(gx - goal.gx) + Math.abs(gy - goal.gy);
}

function stateKey(gx: number, gy: number, dir: number): string {
  return `${gx},${gy},${dir}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function computeBounds(start: Point, goal: Point, obstacles: Rect[], margin: number): Rect {
  let minX = Math.min(start.x, goal.x);
  let minY = Math.min(start.y, goal.y);
  let maxX = Math.max(start.x, goal.x);
  let maxY = Math.max(start.y, goal.y);
  for (const o of obstacles) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + 2 * margin,
    height: maxY - minY + 2 * margin,
  };
}

/** Drop interior points that lie on the straight line between their neighbors. */
export function simplifyCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Replace each interior corner with a two-point chamfer of the given radius. */
export function chamferCorners(points: Point[], radius: number): Point[] {
  if (points.length <= 2 || radius <= 0) return [...points];
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const v = points[i];
    const a = points[i - 1];
    const b = points[i + 1];
    const da = dist(v, a);
    const db = dist(v, b);
    const r = Math.min(radius, da / 2, db / 2);
    if (r <= 0) {
      out.push(v);
      continue;
    }
    out.push({ x: v.x + ((a.x - v.x) / da) * r, y: v.y + ((a.y - v.y) / da) * r });
    out.push({ x: v.x + ((b.x - v.x) / db) * r, y: v.y + ((b.y - v.y) / db) * r });
  }
  out.push(points[points.length - 1]);
  return out;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Minimal binary min-heap keyed by `f` with a deterministic `seq` tiebreaker. */
class MinHeap {
  private items: HeapItem[] = [];

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(item: HeapItem): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(a[i], a[parent])) {
        [a[i], a[parent]] = [a[parent], a[i]];
        i = parent;
      } else break;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop() as HeapItem;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.less(a[l], a[smallest])) smallest = l;
        if (r < n && this.less(a[r], a[smallest])) smallest = r;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }

  private less(x: HeapItem, y: HeapItem): boolean {
    return x.f < y.f || (x.f === y.f && x.seq < y.seq);
  }
}
