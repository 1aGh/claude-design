/**
 * @file       draw/morph.ts — deterministic shape-morph producer for the IR
 * @scope      apps/studio/draw/morph.ts
 * @purpose    Turn ONE base `d` path into an animatable `d`-morph {@link Track}
 *             of VERTEX ARRAYS — the cross-renderer interpolable form. Every
 *             keyframe shares an identical command template + a fixed vertex
 *             count, which is the hard constraint that lets web (SMIL/motion)
 *             AND Lottie tween the morph without reparsing geometry per frame.
 *
 *             This is the engine replacement for the studyfi-v3 "Python
 *             perturbation outside the engine" anti-pattern (DDR-094 Findings):
 *             `morphVariants(base, { n, jitter, seed })` is PURE + deterministic
 *             (a seeded LCG, no `Math.random`), so a morph is reproducible and
 *             reviewable as code.
 *
 *             Constraint: morph paths must use ABSOLUTE, pair-coordinate
 *             commands only (`M L C S Q T Z`). `H`/`V`/`A` and relative commands
 *             throw — they break the "fixed vertex count" interpolability
 *             invariant. The engine's `blobPath` (M…C…Z) already conforms.
 *
 *             React-free (DDR-067); depends only on `animate.ts` + the `Point`
 *             type.
 */

import type { CubicBezierHandles, Keyframe, Track } from './animate.ts';
import type { Point } from './primitives.ts';

/** One command of a parsed morph path + how many (x,y) pairs it consumes. */
export interface MorphCommand {
  cmd: 'M' | 'L' | 'C' | 'S' | 'Q' | 'T' | 'Z';
  /** Number of (x,y) vertex pairs this command consumes (`Z` = 0). */
  nPairs: number;
}

/** A shared path template: the command skeleton every morph keyframe reuses. */
export interface PathTemplate {
  commands: MorphCommand[];
  /** Total vertex count = Σ nPairs. The fixed-length morph invariant. */
  vertexCount: number;
}

/** A parsed morph path: the reusable template + its base vertex array. */
export interface ParsedMorph {
  template: PathTemplate;
  vertices: Point[];
}

const PAIRS_PER_CMD: Record<MorphCommand['cmd'], number> = {
  M: 1,
  L: 1,
  C: 3,
  S: 2,
  Q: 2,
  T: 1,
  Z: 0,
};

const NUM_RE = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/**
 * Parse an absolute, pair-coordinate `d` path into a {@link PathTemplate} plus
 * its flat vertex array (vertices in document order). Throws on relative or
 * `H`/`V`/`A` commands — they violate the fixed-vertex-count morph constraint.
 */
export function parseMorphPath(d: string): ParsedMorph {
  const commands: MorphCommand[] = [];
  const vertices: Point[] = [];
  // Split on PATH-command letters only — NOT every letter — so the `e`/`E` of an
  // exponent (`2e1`) stays inside its number rather than being read as a command.
  const re = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let m: RegExpExecArray | null = re.exec(d);
  for (; m !== null; m = re.exec(d)) {
    const letter = m[1];
    if (letter === 'z' || letter === 'Z') {
      commands.push({ cmd: 'Z', nPairs: 0 });
      continue;
    }
    if (!(letter in PAIRS_PER_CMD)) {
      throw new Error(
        `parseMorphPath: command "${letter}" is not morph-safe — use only ` +
          'absolute pair-coordinate commands (M L C S Q T Z); the blobPath form conforms'
      );
    }
    const cmd = letter as MorphCommand['cmd'];
    const nPairs = PAIRS_PER_CMD[cmd];
    const nums = (m[2].match(NUM_RE) ?? []).map(Number);
    if (nums.length !== nPairs * 2) {
      throw new Error(
        `parseMorphPath: command "${cmd}" expected ${nPairs * 2} numbers, got ${nums.length} ` +
          '(repeated/implicit commands are not supported — emit one explicit command per segment)'
      );
    }
    commands.push({ cmd, nPairs });
    for (let i = 0; i < nums.length; i += 2) vertices.push({ x: nums[i], y: nums[i + 1] });
  }
  return { template: { commands, vertexCount: vertices.length }, vertices };
}

/** Format a number the way the rest of the engine does (no float noise). */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e4) / 1e4);
}

/**
 * Reassemble a `d` string from a template + a vertex array (the inverse of
 * {@link parseMorphPath}). Throws if the vertex count doesn't match the
 * template — the morph invariant, checked at the seam.
 */
export function templateToPath(template: PathTemplate, vertices: Point[]): string {
  if (vertices.length !== template.vertexCount) {
    throw new Error(
      `templateToPath: vertex count ${vertices.length} ≠ template ${template.vertexCount}`
    );
  }
  const parts: string[] = [];
  let vi = 0;
  for (const c of template.commands) {
    if (c.cmd === 'Z') {
      parts.push('Z');
      continue;
    }
    const coords: string[] = [];
    for (let p = 0; p < c.nPairs; p++) {
      const v = vertices[vi++];
      coords.push(`${fmt(v.x)} ${fmt(v.y)}`);
    }
    parts.push(`${c.cmd}${coords.join(' ')}`);
  }
  return parts.join('');
}

/** Deterministic LCG in [0,1) — same generator the geometry layer uses. */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface MorphVariantsOpts {
  /** Number of distinct jittered variants between the base endpoints (default 3). */
  n?: number;
  /** Max per-vertex displacement in user units (default 2). 0 ⇒ no motion. */
  jitter?: number;
  /** Integer seed for the deterministic jitter (default 1). */
  seed?: number;
  /** Total morph duration in seconds (default 1). */
  dur?: number;
  /** Per-segment easing (default linear). */
  ease?: CubicBezierHandles;
  /** Node id this track drives. */
  target?: string;
  /**
   * Close the loop by returning to the base shape on the final keyframe
   * (default true) — a seamless `repeat` morph.
   */
  loop?: boolean;
}

/** The morph producer's output: the IR track + the template to render it. */
export interface MorphResult {
  track: Track<Point[]>;
  template: PathTemplate;
  /** Render any keyframe's vertex array back to a `d` string. */
  toPath: (vertices: Point[]) => string;
}

/**
 * Produce a deterministic `d`-morph track from a base path. Every keyframe is a
 * vertex array of the SAME length (the base's), jittered by a seeded LCG, evenly
 * spaced over `dur`. With `loop` (default) the last keyframe is the base again,
 * so a repeating timeline morphs seamlessly. Pure + reproducible — the engine
 * replacement for ad-hoc out-of-engine perturbation.
 */
export function morphVariants(basePath: string, opts: MorphVariantsOpts = {}): MorphResult {
  const n = Math.max(1, opts.n ?? 3);
  const jitter = opts.jitter ?? 2;
  const dur = opts.dur ?? 1;
  const loop = opts.loop ?? true;
  const { template, vertices: base } = parseMorphPath(basePath);
  const rnd = lcg(opts.seed ?? 1);

  // Keyframe times: base at 0, n jittered variants, optional base again at dur.
  const stops = loop ? n + 2 : n + 1; // includes the base endpoint(s)
  const keyframes: Keyframe<Point[]>[] = [];
  for (let k = 0; k < stops; k++) {
    const t = (k / (stops - 1)) * dur;
    const isBase = k === 0 || (loop && k === stops - 1);
    const value: Point[] = isBase
      ? base.map((p) => ({ ...p }))
      : base.map((p) => ({
          x: p.x + (rnd() * 2 - 1) * jitter,
          y: p.y + (rnd() * 2 - 1) * jitter,
        }));
    const kf: Keyframe<Point[]> = { t, value };
    if (opts.ease && k < stops - 1) kf.ease = opts.ease;
    keyframes.push(kf);
  }

  const track: Track<Point[]> = { property: 'd', keyframes };
  if (opts.target !== undefined) track.target = opts.target;
  return { track, template, toPath: (v) => templateToPath(template, v) };
}
