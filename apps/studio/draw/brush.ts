/**
 * @file       draw/brush.ts — Phase 25.2 brush layer
 * @scope      plugins/design/dev-server/draw/brush.ts
 * @purpose    "Brush" expression for a pure-vector engine, three levels:
 *               L1  roughenFilter()  — feTurbulence → feDisplacementMap edge
 *                   texture (dry-brush / ink / charcoal roughness) you apply to
 *                   any stroke or shape via `filter: 'url(#id)'`.
 *               L2  brushStroke()    — a VARIABLE-WIDTH / tapering stroke. SVG
 *                   `stroke` is uniform-width, so a real brush/calligraphic mark
 *                   is built as a FILLED outline: a smooth centerline offset by a
 *                   width profile on both sides → closed path → fill. Tapered ends
 *                   give the pointed brush look.
 *               L3  scatterAlong()   — a scatter/spray brush: stamp a primitive
 *                   repeatedly along a path with seeded (deterministic) jitter in
 *                   position / scale / rotation, optionally aligned to the tangent.
 *
 *             True raster/bristle brushes are deliberately out of scope (they'd
 *             need a raster pipeline; this engine stays crisp-vector, single-source
 *             SVG↔JSX). See DDR-074-adjacent note.
 *
 *             Pure + deterministic (seeded LCG, no `Math.random`); React-free.
 */

import type { Rect } from './geometry.ts';
import {
  circle,
  type DrawPrimitive,
  type DrawStyle,
  fe,
  filter,
  group,
  line,
  type Point,
  path,
} from './primitives.ts';

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// L1 — edge-texture filter (dry-brush / ink / charcoal roughness)
// ─────────────────────────────────────────────────────────────────────────────

export interface RoughenOpts {
  /** Displacement magnitude in px — higher = rougher/more broken edge (default 4). */
  scale?: number;
  /** Turbulence base frequency — higher = finer texture (default 0.018). */
  frequency?: number;
  /** Octaves of detail (default 2). */
  detail?: number;
  /** Deterministic turbulence seed (default 0). */
  seed?: number;
}

/**
 * A roughening filter: fractal turbulence drives a displacement map that breaks
 * up the edge of whatever it's applied to — the dry-brush / inked / charcoal
 * look. Put it in `defs([...])` and apply with `filter: 'url(#id)'` on a
 * `brushStroke` (or any shape). Pair with a higher `scale` for chalk, a low
 * `frequency` for big rips, a high `frequency` for grain.
 */
export function roughenFilter(id: string, opts: RoughenOpts = {}): DrawPrimitive {
  const { scale = 4, frequency = 0.018, detail = 2, seed = 0 } = opts;
  return filter(
    id,
    [
      fe('feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: frequency,
        numOctaves: detail,
        seed,
        result: 'noise',
      }),
      fe('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'noise',
        scale,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
      }),
    ],
    { x: '-20%', y: '-20%', width: '140%', height: '140%' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// L2 — variable-width / tapering brush stroke (centerline → filled outline)
// ─────────────────────────────────────────────────────────────────────────────

export type BrushTaper = 'both' | 'start' | 'end' | 'none';

export interface BrushStrokeOpts extends DrawStyle {
  /** Max stroke width in px (the fattest point). Default 12. */
  width?: number;
  /** Where the stroke tapers to a point (default 'both' — a calligraphic mark). */
  taper?: BrushTaper;
  /**
   * Custom pressure profile: arc-length `t` (0–1) → half-width multiplier (0–1).
   * Overrides `taper` when given (model real pen pressure).
   */
  profile?: (t: number) => number;
  /** Catmull-Rom samples per input segment for the smooth centerline (default 16). */
  samples?: number;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function len(p: Point): number {
  return Math.hypot(p.x, p.y) || 1;
}

/** Catmull-Rom resample of an OPEN polyline into a dense smooth point list. */
function smoothCenterline(pts: Point[], perSeg: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function taperProfile(taper: BrushTaper): (t: number) => number {
  switch (taper) {
    case 'start':
      return (t) => t ** 0.8; // thin → thick
    case 'end':
      return (t) => (1 - t) ** 0.8; // thick → thin
    case 'none':
      return () => 1;
    default:
      return (t) => Math.sin(Math.PI * t) ** 0.62; // both — fat middle, pointed ends
  }
}

/** Smooth closed path through a loop of points (Catmull-Rom → cubic Bézier). */
function closedSmoothPath(pts: Point[]): string {
  const n = pts.length;
  if (n < 3) return '';
  const P = (i: number) => pts[((i % n) + n) % n];
  let d = `M${fmt(P(0).x)} ${fmt(P(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return `${d} Z`;
}

/**
 * A variable-width brush/calligraphic stroke following `centerline`, rendered as
 * a single FILLED path (not an SVG stroke — SVG stroke can't taper). The
 * centerline is smoothed (Catmull-Rom), offset on both sides by the width
 * profile, and closed into a tapered outline. Fill defaults to `currentColor`.
 * Apply a {@link roughenFilter} via `filter` for a dry-brush edge.
 */
export function brushStroke(centerline: Point[], opts: BrushStrokeOpts = {}): DrawPrimitive {
  const { width = 12, taper = 'both', profile, samples = 16, ...style } = opts;
  const prof = profile ?? taperProfile(taper);
  const half = width / 2;

  const C = smoothCenterline(centerline, samples);
  const m = C.length;
  if (m < 2) return path({ d: '', ...style });

  // arc-length parameterization → t per vertex
  const cum: number[] = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + len(sub(C[i], C[i - 1])));
  const total = cum[m - 1] || 1;

  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < m; i++) {
    // tangent via central difference
    const a = C[Math.max(0, i - 1)];
    const b = C[Math.min(m - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const hw = half * Math.max(0, prof(cum[i] / total));
    left.push({ x: C[i].x + nx * hw, y: C[i].y + ny * hw });
    right.push({ x: C[i].x - nx * hw, y: C[i].y - ny * hw });
  }

  // outline: left forward + right backward → closed, smoothed
  const outline = left.concat(right.reverse());
  return path({
    d: closedSmoothPath(outline),
    fill: style.fill ?? 'currentColor',
    ...stripFill(style),
  });
}

function stripFill(s: DrawStyle): DrawStyle {
  const { fill: _drop, ...rest } = s;
  return rest;
}

// ─────────────────────────────────────────────────────────────────────────────
// L3 — scatter / spray brush (stamp a primitive along a path)
// ─────────────────────────────────────────────────────────────────────────────

export interface StampCtx {
  index: number;
  /** Arc-length position 0–1 along the path. */
  t: number;
  /** Tangent angle in degrees (for aligning the stamp). */
  angle: number;
  /** A deterministic [0,1) random for this stamp (seeded). */
  rnd: number;
}

export interface ScatterOpts {
  /** Number of stamps along the path (default 24). */
  count?: number;
  /** Max position jitter perpendicular+along the path, px (default 0). */
  jitter?: number;
  /** Scale variance 0–1 (default 0 = uniform). Each stamp scaled in [1−v, 1+v]. */
  scaleVar?: number;
  /** Extra random rotation ± this many degrees (default 0). */
  rotateVar?: number;
  /** Rotate each stamp to the path tangent (default false). */
  align?: boolean;
  /** Deterministic seed (default 1). */
  seed?: number;
}

/**
 * Stamp a primitive repeatedly along `centerline` — a scatter/spray brush. The
 * `makeStamp` factory authors the unit stamp AT THE ORIGIN (0,0); scatter places
 * each via a `translate → rotate → scale` group with seeded jitter. Deterministic
 * for a given seed. Returns one group containing all stamps.
 */
export function scatterAlong(
  centerline: Point[],
  makeStamp: (ctx: StampCtx) => DrawPrimitive | DrawPrimitive[],
  opts: ScatterOpts = {}
): DrawPrimitive {
  const { count = 24, jitter = 0, scaleVar = 0, rotateVar = 0, align = false, seed = 1 } = opts;
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const C = smoothCenterline(centerline, 16);
  const m = C.length;
  const cum: number[] = [0];
  for (let i = 1; i < m; i++) cum.push(cum[i - 1] + len(sub(C[i], C[i - 1])));
  const total = cum[m - 1] || 1;

  // sample point at arc-length fraction f via linear interpolation on C
  const at = (f: number): { p: Point; angle: number } => {
    const target = f * total;
    let i = 1;
    while (i < m && cum[i] < target) i++;
    const i0 = Math.max(0, i - 1);
    const seg = cum[i] - cum[i0] || 1;
    const u = (target - cum[i0]) / seg;
    const p = { x: C[i0].x + (C[i].x - C[i0].x) * u, y: C[i0].y + (C[i].y - C[i0].y) * u };
    const angle = (Math.atan2(C[i].y - C[i0].y, C[i].x - C[i0].x) * 180) / Math.PI;
    return { p, angle };
  };

  const stamps: DrawPrimitive[] = [];
  for (let k = 0; k < count; k++) {
    const f = count === 1 ? 0.5 : k / (count - 1);
    const { p, angle } = at(f);
    const r1 = rnd();
    const r2 = rnd();
    const r3 = rnd();
    const x = p.x + (r1 * 2 - 1) * jitter;
    const y = p.y + (r2 * 2 - 1) * jitter;
    const sc = 1 + (r3 * 2 - 1) * scaleVar;
    const rot = (align ? angle : 0) + (rnd() * 2 - 1) * rotateVar;
    const made = makeStamp({ index: k, t: f, angle, rnd: r1 });
    const kids = Array.isArray(made) ? made : [made];
    const parts: string[] = [`translate(${fmt(x)} ${fmt(y)})`];
    if (rot) parts.push(`rotate(${fmt(rot)})`);
    if (sc !== 1) parts.push(`scale(${fmt(sc)})`);
    stamps.push(group(kids, { transform: parts.join(' ') }));
  }
  return group(stamps, { id: 'scatter' });
}

// ─────────────────────────────────────────────────────────────────────────────
// L4 — engraving hatching (the grave-etcher look: dense directional line shading)
// ─────────────────────────────────────────────────────────────────────────────

export interface HatchOpts {
  /** Line angle in degrees (default 45). */
  angle?: number;
  /** Gap between lines in px — smaller = darker tone (default 6). */
  spacing?: number;
  /** Line weight (default 0.8). Engraving stays fine. */
  weight?: number;
  /** Stroke color (default currentColor). */
  color?: string;
  /**
   * Burin swell: alternate lines thicken by ±this fraction (default 0) — the
   * engine-turned / banknote shimmer. 0.6 ≈ a strong copperplate swell.
   */
  weightVar?: number;
  /** Round the line ends (default true — softer engraving terminals). */
  round?: boolean;
}

/**
 * A field of parallel engraving lines covering `region`'s bounding box at
 * `angle` / `spacing`. Clip it to a shape (`group([hatch(...)], { clipPath:
 * 'url(#id)' })`) to shade that shape; overlay a second hatch at another angle
 * (or {@link crossHatch}) for the darker tones. Spacing IS the tone — tighter
 * spacing reads darker, exactly as in real line engraving.
 */
export function hatch(region: Rect, opts: HatchOpts = {}): DrawPrimitive {
  const {
    angle = 45,
    spacing = 6,
    weight = 0.8,
    color = 'currentColor',
    weightVar = 0,
    round = true,
  } = opts;
  const cx = region.x + region.width / 2;
  const cy = region.y + region.height / 2;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;
  const half = Math.hypot(region.width, region.height) / 2 + spacing;
  const lines: DrawPrimitive[] = [];
  let i = 0;
  for (let p = -half; p <= half; p += spacing) {
    const mx = cx + nx * p;
    const my = cy + ny * p;
    const w = weightVar ? weight * (1 + (i % 2 ? weightVar : -weightVar)) : weight;
    lines.push(
      line({
        x1: mx - dx * half,
        y1: my - dy * half,
        x2: mx + dx * half,
        y2: my + dy * half,
        stroke: color,
        strokeWidth: Math.max(0.15, w),
        strokeLinecap: round ? 'round' : 'butt',
      })
    );
    i++;
  }
  return group(lines, { id: `hatch-${Math.round(angle)}` });
}

export interface CrossHatchOpts extends HatchOpts {
  /** Second angle (default angle + 90). */
  angle2?: number;
}

/** Two crossed hatch fields → the deepest engraving tone. Clip to a shape. */
export function crossHatch(region: Rect, opts: CrossHatchOpts = {}): DrawPrimitive {
  const a1 = opts.angle ?? 45;
  const a2 = opts.angle2 ?? a1 + 90;
  return group([hatch(region, { ...opts, angle: a1 }), hatch(region, { ...opts, angle: a2 })], {
    id: 'crosshatch',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// L5 — contour engraving lines ("multiple engraving lines from one stroke") +
//      graded stipple (the grave-etcher / Sailor-Jerry soul: lines that FOLLOW
//      the form, and stipple that grades into tone)
// ─────────────────────────────────────────────────────────────────────────────

/** Open smooth path (Catmull-Rom → cubic Bézier) through points — no close. */
function openSmoothPath(pts: Point[]): string {
  if (pts.length < 2) return '';
  const P = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

export interface ContourOpts {
  /** Explicit normal offsets per line (caller controls density grading). */
  offsets?: number[];
  /** Or: `count` lines auto-spaced by `spacing` and centered on the stroke. */
  count?: number;
  spacing?: number;
  /** Per-line end trim 0–0.45 (fraction off EACH end) → organic fading lines. */
  lengthProfile?: (k: number, n: number) => number;
  weight?: number;
  /** Burin swell — alternate lines ±this fraction (default 0). */
  weightVar?: number;
  color?: string;
  round?: boolean;
}

/**
 * The grave-etcher mechanic: from ONE centerline stroke, emit a family of
 * offset copies that FOLLOW the form (each line is the stroke pushed along its
 * per-point normal). This is what wraps a skull / bottle / muscle in engraving
 * lines and reads as volume — the thing flat bbox-hatch can't do. Grade density
 * (pass `offsets` bunched toward the shadow edge) and trim line lengths
 * (`lengthProfile`) for the hand-engraved fade.
 */
export function contourLines(centerline: Point[], opts: ContourOpts = {}): DrawPrimitive {
  const {
    count = 8,
    spacing = 4,
    lengthProfile,
    weight = 0.7,
    weightVar = 0,
    color = 'currentColor',
    round = true,
  } = opts;
  const offsets =
    opts.offsets ?? Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * spacing);
  const C = smoothCenterline(centerline, 16);
  const m = C.length;
  const N: Point[] = [];
  for (let i = 0; i < m; i++) {
    const a = C[Math.max(0, i - 1)];
    const b = C[Math.min(m - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    N.push({ x: -ty / tl, y: tx / tl });
  }
  const lines: DrawPrimitive[] = [];
  offsets.forEach((off, k) => {
    const trim = lengthProfile ? Math.max(0, Math.min(0.45, lengthProfile(k, offsets.length))) : 0;
    const i0 = Math.round(trim * (m - 1));
    const i1 = m - 1 - i0;
    const pts: Point[] = [];
    for (let i = i0; i <= i1; i++) pts.push({ x: C[i].x + N[i].x * off, y: C[i].y + N[i].y * off });
    if (pts.length >= 2) {
      lines.push(
        path({
          d: openSmoothPath(pts),
          fill: 'none',
          stroke: color,
          strokeWidth: Math.max(
            0.15,
            weightVar ? weight * (1 + (k % 2 ? weightVar : -weightVar)) : weight
          ),
          strokeLinecap: round ? 'round' : 'butt',
          strokeLinejoin: 'round',
        })
      );
    }
  });
  return group(lines, { id: 'contour' });
}

export interface StippleOpts {
  /** Candidate dot count (default 500). Actual count depends on `density`. */
  dots?: number;
  dotR?: number;
  color?: string;
  seed?: number;
  /**
   * Tonal gradient: normalized (nx, ny) in [0,1]² → keep-probability 0–1. Dense
   * where it returns ~1, sparse where ~0 → graded tone (stipple shading). Clip
   * the result to a shape for stippled volume.
   */
  density?: (nx: number, ny: number) => number;
}

/**
 * Graded stipple fill over a region — the stipple shader. Unlike a flat dot
 * cluster, `density(nx,ny)` makes dots thin out toward the light, giving real
 * tonal volume (the Sailor-Jerry / dotwork look). Clip to a shape via
 * `group([stippleFill(...)], { clipPath })`. Deterministic (seeded).
 */
export function stippleFill(region: Rect, opts: StippleOpts = {}): DrawPrimitive {
  const { dots = 500, dotR = 1.2, color = 'currentColor', seed = 1, density } = opts;
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: DrawPrimitive[] = [];
  for (let i = 0; i < dots; i++) {
    const nx = rnd();
    const ny = rnd();
    const keep = density ? density(nx, ny) : 1;
    if (rnd() <= keep) {
      out.push(
        circle({
          cx: region.x + nx * region.width,
          cy: region.y + ny * region.height,
          r: dotR * (0.6 + rnd() * 0.8),
          fill: color,
        })
      );
    }
  }
  return group(out, { id: 'stipple' });
}

// ─────────────────────────────────────────────────────────────────────────────
// L6 — organic engrave lines: every line tapers to points (burin lift), carries
//      its own subtle wobble + jittered weight/length/spacing. NO global filter
//      (a uniform displacement reads as "filtered", not hand-drawn). This is what
//      gives engraving its organic, drawn-by-hand soul.
// ─────────────────────────────────────────────────────────────────────────────

export interface EngraveOpts {
  /** Explicit normal offsets per line (caller grades density). */
  offsets?: number[];
  /** Or auto: `count` lines `spacing` apart, centered on the stroke. */
  count?: number;
  spacing?: number;
  /** Random ± fraction added to each offset (default 0.18) — uneven, hand spacing. */
  spacingJitter?: number;
  /** Base line weight at its thickest (default 1.4). Each line tapers to 0 at ends. */
  weight?: number;
  /** ± weight fraction per line (default 0.4) — no two lines identical. */
  weightJitter?: number;
  /** Perpendicular wobble amplitude px (default 1.1) — the hand-waver. */
  wobble?: number;
  /** Wobble cycles along the line (default 1.6). */
  wobbleFreq?: number;
  /** Random end-trim fraction per end, 0–0.4 (default 0.12) — staggered organic ends. */
  lengthJitter?: number;
  color?: string;
  seed?: number;
}

/**
 * Organic engraving lines from one centerline stroke. Unlike {@link contourLines}
 * (clean offsets) every line here is an independent hand-drawn mark: a tapered
 * `brushStroke` (thin → thick → thin = burin lift) on a slightly wobbled,
 * length-jittered, weight-jittered, unevenly-spaced offset of the stroke. The
 * result reads as drawn, not computed. Clip to a shape for shaded volume.
 */
export function engraveLines(centerline: Point[], opts: EngraveOpts = {}): DrawPrimitive {
  const {
    count = 10,
    spacing = 5,
    spacingJitter = 0.18,
    weight = 1.4,
    weightJitter = 0.4,
    wobble = 1.1,
    wobbleFreq = 1.6,
    lengthJitter = 0.12,
    color = 'currentColor',
    seed = 1,
  } = opts;
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const base =
    opts.offsets ?? Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * spacing);
  const C = smoothCenterline(centerline, 14);
  const m = C.length;
  const N: Point[] = [];
  for (let i = 0; i < m; i++) {
    const a = C[Math.max(0, i - 1)];
    const b = C[Math.min(m - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    N.push({ x: -ty / tl, y: tx / tl });
  }

  const lines: DrawPrimitive[] = [];
  for (let k = 0; k < base.length; k++) {
    const off = base[k] + (rnd() * 2 - 1) * spacing * spacingJitter;
    const t0 = rnd() * lengthJitter;
    const t1 = 1 - rnd() * lengthJitter;
    const i0 = Math.round(t0 * (m - 1));
    const i1 = Math.round(t1 * (m - 1));
    if (i1 - i0 < 2) continue;
    const phase = rnd() * Math.PI * 2;
    const pts: Point[] = [];
    for (let i = i0; i <= i1; i++) {
      const lt = (i - i0) / (i1 - i0);
      const env = Math.sin(Math.PI * lt); // wobble fades to 0 at the ends
      const w = wobble * Math.sin(wobbleFreq * 2 * Math.PI * lt + phase) * env;
      const d = off + w;
      pts.push({ x: C[i].x + N[i].x * d, y: C[i].y + N[i].y * d });
    }
    // resample to a handful of control points so brushStroke smooths, not bloats
    const ctrl: Point[] = [];
    const step = Math.max(1, Math.floor(pts.length / 9));
    for (let i = 0; i < pts.length; i += step) ctrl.push(pts[i]);
    ctrl.push(pts[pts.length - 1]);
    const lw = Math.max(0.4, weight * (1 + (rnd() * 2 - 1) * weightJitter));
    lines.push(brushStroke(ctrl, { width: lw, taper: 'both', fill: color, samples: 6 }));
  }
  return group(lines, { id: 'engrave' });
}
