/**
 * @file       draw/animate.ts — draw animation IR (keyframe timeline)
 * @scope      apps/studio/draw/animate.ts
 * @purpose    The cross-platform ANIMATION source of truth. Where `primitives.ts`
 *             names *shape*, this module names *time*: a keyframe `Timeline` of
 *             property `Track`s on any node. It extends the DDR-067 single-source
 *             invariant from static geometry to motion — one IR feeds the web
 *             authoring serializers (SMIL + motion/JSX, `serialize.ts`) AND the
 *             production `toLottie()` emitter (DDR-094).
 *
 *             Vocabulary:
 *               Keyframe  — { t, value, ease? } at an ABSOLUTE time (seconds).
 *               Track     — keyframes on one property of one node (`d` morph as a
 *                           vertex array, `transform`, `opacity`, gradient stops).
 *               Timeline  — { dur, begin?, repeat?, tracks, stagger? }.
 *
 *             Choreography ("animate sequences of anything, scalable") is built
 *             from pure combinators — `sequence` (in series), `parallel` (at
 *             once), `stagger` (offset each track by index·delay). Easing is
 *             per-segment CSS `cubic-bezier`, evaluated with a Newton-Raphson
 *             solver so authoring tokens (incl. overshoot, `y>1`) round-trip
 *             exactly into SMIL `keySplines` / Lottie `i`/`o` handles.
 *
 *             DEPENDENCY RULE (DDR-067): React-free root. Imports only the pure
 *             `Point` type from `primitives.ts`; nothing from react or a `.tsx`.
 */

import type { Point } from './primitives.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Easing — CSS cubic-bezier(x1,y1,x2,y2) timing function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four control-point handles of a CSS `cubic-bezier(x1,y1,x2,y2)` easing.
 * `x` components are clamped to [0,1] (CSS constraint); `y` may exceed [0,1]
 * to express overshoot/anticipation (`--ease-out (0.34,1.42,…)` "snap").
 */
export type CubicBezierHandles = readonly [x1: number, y1: number, x2: number, y2: number];

/** `linear` — the identity timing function. */
export const LINEAR: CubicBezierHandles = [0, 0, 1, 1];

/** One axis of a cubic Bézier with P0=0, P3=1: B(t) = 3(1-t)²t·c1 + 3(1-t)t²·c2 + t³. */
function bezierAxis(t: number, c1: number, c2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t;
}

/** dB/dt for the same axis — used by the Newton-Raphson x→t solve. */
function bezierAxisDeriv(t: number, c1: number, c2: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * c1 + 6 * mt * t * (c2 - c1) + 3 * t * t * (1 - c2);
}

/**
 * Evaluate a CSS cubic-bezier easing: given progress `x` ∈ [0,1] along the
 * timeline, return the eased output `y`. Solves `bezierX(t) = x` for the curve
 * parameter `t` (Newton-Raphson, bisection fallback), then returns `bezierY(t)`.
 * `linear` short-circuits. Output `y` is NOT clamped — overshoot is preserved.
 */
export function easeBezier(handles: CubicBezierHandles, x: number): number {
  const [x1, y1, x2, y2] = handles;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Linear fast-path (both handles on the diagonal).
  if (x1 === y1 && x2 === y2) return x;

  // Solve bezierX(t) = x for t.
  let t = x;
  for (let i = 0; i < 8; i++) {
    const xe = bezierAxis(t, x1, x2) - x;
    if (Math.abs(xe) < 1e-7) break;
    const dx = bezierAxisDeriv(t, x1, x2);
    if (Math.abs(dx) < 1e-7) break;
    t -= xe / dx;
  }
  // Bisection fallback if Newton left the [0,1] domain or stalled.
  if (t < 0 || t > 1 || Number.isNaN(t)) {
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 32; i++) {
      t = (lo + hi) / 2;
      const xe = bezierAxis(t, x1, x2);
      if (Math.abs(xe - x) < 1e-7) break;
      if (xe < x) lo = t;
      else hi = t;
    }
  }
  return bezierAxis(t, y1, y2);
}

// ─────────────────────────────────────────────────────────────────────────────
// IR types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A value a track can interpolate:
 *   • `number`     — opacity, scalar scale/rotate, a single stop offset.
 *   • `number[]`   — element-wise (gradient stop offsets/opacities, a transform
 *                    decomposed into [tx,ty,scale,rotate], …).
 *   • `Point[]`    — a `d` shape morph as a vertex array (the cross-renderer
 *                    interpolable form; see {@link lerpVertices}).
 *   • `string`     — a discrete value (a `transform` string, a color); NOT
 *                    numerically interpolated — held until the next keyframe.
 */
export type TrackValue = number | number[] | Point[] | string;

/** A single keyframe at an ABSOLUTE time `t` (seconds from the track's begin). */
export interface Keyframe<V extends TrackValue = TrackValue> {
  /** Absolute time in seconds. */
  t: number;
  value: V;
  /**
   * Easing of the segment STARTING at this keyframe (→ the next one), mirroring
   * SMIL `keySplines` (one spline per interval) and Lottie out/in tangents.
   * Omit for `linear`. Ignored on the final keyframe.
   */
  ease?: CubicBezierHandles;
}

/** Animatable property names the serializers understand. Open for extension. */
export type TrackProperty =
  | 'd'
  | 'transform'
  | 'opacity'
  | 'fill'
  | 'stroke'
  | 'gradientStops'
  | (string & {});

/** Keyframes on one property of one node. */
export interface Track<V extends TrackValue = TrackValue> {
  /** The animated property (`d`, `opacity`, `transform`, …). */
  property: TrackProperty;
  /** `id` of the node this track drives (the serializer targets it). */
  target?: string;
  /** Keyframes, kept sorted ascending by `t` (constructors enforce this). */
  keyframes: Keyframe<V>[];
}

/** Repeat policy. `'indefinite'` ⇒ SMIL `indefinite` / Lottie loop. */
export type Repeat = number | 'indefinite';

/** A timeline: a bundle of property tracks sharing a clock. */
export interface Timeline {
  /** Total wall-clock duration in seconds (the choreography envelope). */
  dur: number;
  /** Start offset in seconds (default 0). */
  begin?: number;
  /** Repeat count or `'indefinite'`. */
  repeat?: Repeat;
  tracks: Track[];
  /**
   * If set, each track's keyframes are offset by `index · stagger` seconds at
   * resolve time (see {@link resolveStagger}). A declarative shorthand for
   * {@link stagger}; resolved (baked into keyframe `t`) before serialization.
   */
  stagger?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructors
// ─────────────────────────────────────────────────────────────────────────────

/** Build a track, sorting keyframes by time (defensive — callers may be loose). */
export function track<V extends TrackValue>(
  property: TrackProperty,
  keyframes: Keyframe<V>[],
  target?: string
): Track<V> {
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const out: Track<V> = { property, keyframes: sorted };
  if (target !== undefined) out.target = target;
  return out;
}

/** Build a timeline; `dur` defaults to the latest keyframe time across tracks. */
export function timeline(o: {
  tracks: Track[];
  dur?: number;
  begin?: number;
  repeat?: Repeat;
  stagger?: number;
}): Timeline {
  const dur = o.dur ?? trackSpan(o.tracks);
  const out: Timeline = { dur, tracks: o.tracks };
  if (o.begin !== undefined) out.begin = o.begin;
  if (o.repeat !== undefined) out.repeat = o.repeat;
  if (o.stagger !== undefined) out.stagger = o.stagger;
  return out;
}

/** The latest keyframe time across a set of tracks (0 if none). */
export function trackSpan(tracks: Track[]): number {
  let max = 0;
  for (const tr of tracks) {
    const last = tr.keyframes[tr.keyframes.length - 1];
    if (last && last.t > max) max = last.t;
  }
  return max;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vertex-array interpolation for `d` morphs. REQUIRES equal length — the
 * cross-renderer interpolability constraint (an identical command template /
 * fixed vertex count). Throws on mismatch so a bad morph fails loud at author
 * time rather than producing a degenerate tween.
 */
export function lerpVertices(a: Point[], b: Point[], u: number): Point[] {
  if (a.length !== b.length) {
    throw new Error(
      `lerpVertices: vertex count mismatch (${a.length} vs ${b.length}); ` +
        'morph endpoints must share a fixed vertex count'
    );
  }
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * u, y: p.y + (b[i].y - p.y) * u }));
}

/** Interpolate two same-shaped {@link TrackValue}s by `u` ∈ [0,1]. */
export function lerpValue(a: TrackValue, b: TrackValue, u: number): TrackValue {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
  if (typeof a === 'string' || typeof b === 'string') return u < 1 ? a : b; // discrete hold
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      throw new Error(`lerpValue: array length mismatch (${a.length} vs ${b.length})`);
    }
    if (a.length === 0) return [];
    // Point[] (vertex array) vs number[].
    if (typeof a[0] === 'object') return lerpVertices(a as Point[], b as Point[], u);
    return (a as number[]).map((n, i) => n + ((b as number[])[i] - n) * u);
  }
  throw new Error('lerpValue: incompatible value kinds');
}

/**
 * Sample a track at absolute time `tSec`. Clamps outside the keyframe span
 * (hold first / hold last). Applies the per-segment easing of the leading
 * keyframe, then interpolates. Returns `undefined` for an empty track.
 */
export function sampleTrack(tr: Track, tSec: number): TrackValue | undefined {
  const kfs = tr.keyframes;
  if (kfs.length === 0) return undefined;
  if (kfs.length === 1 || tSec <= kfs[0].t) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (tSec >= last.t) return last.value;

  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].t <= tSec) i++;
  const a = kfs[i];
  const b = kfs[i + 1];
  const span = b.t - a.t;
  const x = span > 0 ? (tSec - a.t) / span : 0;
  const u = a.ease ? easeBezier(a.ease, x) : x;
  return lerpValue(a.value, b.value, u);
}

// ─────────────────────────────────────────────────────────────────────────────
// Choreography combinators (pure)
// ─────────────────────────────────────────────────────────────────────────────

/** Shift every keyframe in a track by `dt` seconds (immutable). */
export function shiftTrack(tr: Track, dt: number): Track {
  if (dt === 0) return tr;
  const out: Track = {
    property: tr.property,
    keyframes: tr.keyframes.map((k) => ({ ...k, t: k.t + dt })),
  };
  if (tr.target !== undefined) out.target = tr.target;
  return out;
}

/**
 * Bake a timeline's declarative `stagger` field into its tracks (keyframe `t`
 * += index·stagger), clearing the field and growing `dur` to fit. A no-op when
 * `stagger` is unset/zero. Idempotent on an already-resolved timeline.
 */
export function resolveStagger(tl: Timeline): Timeline {
  if (!tl.stagger) return tl;
  const tracks = tl.tracks.map((tr, i) => shiftTrack(tr, i * (tl.stagger as number)));
  const out: Timeline = { dur: Math.max(tl.dur, trackSpan(tracks)), tracks };
  if (tl.begin !== undefined) out.begin = tl.begin;
  if (tl.repeat !== undefined) out.repeat = tl.repeat;
  return out;
}

/**
 * Stagger a list of tracks: track `i` is offset by `i · delay` seconds. The
 * imperative form of {@link Timeline.stagger}. Returns the offset tracks (sort
 * order preserved).
 */
export function stagger(tracks: Track[], delay: number): Track[] {
  return tracks.map((tr, i) => shiftTrack(tr, i * delay));
}

/**
 * Compose timelines IN PARALLEL — all start together; the result's tracks are
 * the union (each first resolved for its own `stagger`/`begin`). `dur` is the
 * max. The shape for "these things animate at once".
 */
export function parallel(...timelines: Timeline[]): Timeline {
  const tracks: Track[] = [];
  let dur = 0;
  for (const raw of timelines) {
    const tl = resolveStagger(raw);
    const b = tl.begin ?? 0;
    for (const tr of tl.tracks) tracks.push(shiftTrack(tr, b));
    dur = Math.max(dur, b + tl.dur);
  }
  return { dur, tracks };
}

/**
 * Compose timelines IN SERIES — each starts where the previous ended (its own
 * `begin` adds extra gap). The shape for "first this, then that". Durations
 * sum (plus gaps); tracks are shifted onto the shared clock.
 */
export function sequence(...timelines: Timeline[]): Timeline {
  const tracks: Track[] = [];
  let cursor = 0;
  for (const raw of timelines) {
    const tl = resolveStagger(raw);
    const start = cursor + (tl.begin ?? 0);
    for (const tr of tl.tracks) tracks.push(shiftTrack(tr, start));
    cursor = start + tl.dur;
  }
  return { dur: cursor, tracks };
}
