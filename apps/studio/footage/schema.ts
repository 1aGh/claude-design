/**
 * @file       footage/schema.ts — Footage-analysis + EDL sidecar data model
 *             (feature-footage-analysis-director, Task 1).
 * @scope      apps/studio/footage/schema.ts
 * @purpose    The single source of truth for the two artifacts the footage
 *             "director" pipeline persists (DDR-115 taxonomy: both VERSIONED,
 *             alongside the footage they describe — same bucket as `.photo.json`
 *             / `.meta.json` / `.annotations.svg`):
 *
 *               1. `assets/<sha8>.footage.json` — a `FootageAnalysis`: what the
 *                  `footage-analyst` agent SAW when it watched the keyframes of
 *                  one clip (shots, good-moment ranges, tags, a summary). Per-clip.
 *               2. `<designRoot>/<slug>.edl.json` — an `Edl`: what the
 *                  `footage-director` agent decided (an ordered beat list — the
 *                  cut). Per-project-cut.
 *
 *             Both are *metadata only* — never pixels, never re-encoded video.
 *             The `/design:reel` codegen reads the `Edl` and emits a
 *             Timeline-parseable `<TransitionSeries>` video-comp TSX (video-comp
 *             SKILL.md is the authoring contract).
 *
 * @invariant  DEPENDENCY-FREE. Imported by BOTH the server (`footage-store.ts`,
 *             the `/_api/footage` route) and any client/agent surface. MUST NOT
 *             import any browser / native / heavy lib. Pure TS types + plain
 *             helpers + a hand-rolled structural validator (no Ajv) — the exact
 *             house style of `photo/schema.ts`.
 *
 * @time-model Footage time is in **SECONDS** (source-relative), NOT frames: an
 *             HTML5 `<video>` (the probe surface) can report `duration` but not a
 *             reliable native fps, and the analyst reasons about seconds. The
 *             `Edl` composes at a chosen OUTPUT fps and lengths there ARE in
 *             frames (Remotion's clock); the director converts source-seconds →
 *             output-frames at codegen. Keeping the two clocks separate is
 *             deliberate — see the plan's Task-1 note.
 */

/** Schema version of a `FootageAnalysis`. Bump on an incompatible shape change. */
export const FOOTAGE_ANALYSIS_VERSION = 1 as const;
/** Schema version of an `Edl`. */
export const EDL_VERSION = 1 as const;

/**
 * The six transition presentations Maude bundles from `@remotion/transitions`
 * (video-comp SKILL.md — the ONLY ones that resolve on an end-user install).
 * `none` is a hard cut. The director may only choose from these.
 */
export type TransitionPresentation = 'none' | 'fade' | 'slide' | 'wipe' | 'flip' | 'clock-wipe';
export const TRANSITION_PRESENTATIONS: readonly TransitionPresentation[] = [
  'none',
  'fade',
  'slide',
  'wipe',
  'flip',
  'clock-wipe',
];

/** Coarse shot vocabulary the analyst tags each segment with (advisory). */
export type ShotKind =
  | 'wide'
  | 'medium'
  | 'close'
  | 'detail'
  | 'establishing'
  | 'action'
  | 'portrait'
  | 'product'
  | 'transition'
  | 'other';
export const SHOT_KINDS: readonly ShotKind[] = [
  'wide',
  'medium',
  'close',
  'detail',
  'establishing',
  'action',
  'portrait',
  'product',
  'transition',
  'other',
];

/** Dominant camera/subject motion the analyst reads across the keyframe run. */
export type MotionKind =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'push-in'
  | 'pull-out'
  | 'handheld'
  | 'tracking'
  | 'fast'
  | 'other';
export const MOTION_KINDS: readonly MotionKind[] = [
  'static',
  'pan',
  'tilt',
  'push-in',
  'pull-out',
  'handheld',
  'tracking',
  'fast',
  'other',
];

/**
 * One shot the analyst found inside a clip. `start`/`end` are SECONDS in the
 * SOURCE clip (0 ≤ start < end ≤ clip duration). `quality` is the analyst's
 * 0..1 confidence that this is a *usable, good* moment; `usable` is the boolean
 * gate the director filters on first.
 */
export interface FootageShot {
  /** Source in-point, seconds. */
  start: number;
  /** Source out-point, seconds (> start). */
  end: number;
  kind?: ShotKind;
  motion?: MotionKind;
  /** Free-text: who/what is on screen ("drone push over the river"). */
  subject?: string;
  /** Free-text lighting note ("golden hour, backlit"). */
  lighting?: string;
  /** Free-text mood ("calm, aspirational"). */
  mood?: string;
  /** 0..1 — how strong a shot this is for a reel. */
  quality?: number;
  /** The director only considers `usable !== false` shots. */
  usable?: boolean;
  /** One-line director-facing note ("hero shot; hold on the logo reveal"). */
  note?: string;
}

/**
 * The full analysis of one clip. `asset` is the `assets/<sha8>.<ext>` it
 * describes (redundant with the sidecar filename, but self-describing for the
 * director + audit). `durationSec` / `width` / `height` come from the probe
 * (`<video>` metadata). `keyframes` is the count of frames the analyst actually
 * watched (provenance — so a downstream reader knows the sampling density).
 */
export interface FootageAnalysis {
  version?: number;
  /** `assets/<sha8>.<ext>` — the source this analysis targets. */
  asset?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  /** How many keyframes were sampled to produce this analysis. */
  keyframes?: number;
  shots?: FootageShot[];
  /** One-paragraph character-of-the-clip summary. */
  summary?: string;
  /** Cross-cutting tags ("rebrand", "exterior", "people"). */
  tags?: string[];
}

/** An optional graphic overlay laid over a beat (title card / lower-third / logo). */
export interface EdlOverlay {
  kind: 'title' | 'lower-third' | 'caption' | 'logo';
  /** Display text (absent for a bare logo). */
  text?: string;
}

/** The transition BETWEEN this beat and the previous one (null on beat 0 / hard cut). */
export interface EdlTransition {
  presentation: TransitionPresentation;
  /** Overlap length in OUTPUT frames. */
  frames: number;
}

/**
 * One beat of the cut. `clip` is the `assets/<sha8>.<ext>` it draws from;
 * `startSec` is the SOURCE in-point (seconds), `durationFrames` the beat length
 * in OUTPUT frames (at the Edl's `fps`). Two beats may share one `clip` with
 * different `startSec` — pulling multiple shots from one clip is first-class.
 */
export interface EdlBeat {
  /** `assets/<sha8>.<ext>` — the clip this beat draws from. */
  clip: string;
  /** Source in-point, seconds. */
  startSec: number;
  /** Beat length in OUTPUT frames. */
  durationFrames: number;
  /** Why this shot, here — the director's reasoning (audit + regen). */
  why?: string;
  /** Transition INTO this beat from the previous one (null ⇒ hard cut). */
  transition?: EdlTransition | null;
  /** Optional graphic over the beat. */
  overlay?: EdlOverlay | null;
  /** Stable Timeline identity ("beat-1", "hero", "logo"). */
  name?: string;
}

/** A plain user-dropped music bed laid under the whole cut (NOT analysis — see the plan's scope note). */
export interface EdlMusic {
  /** `assets/<sha8>.<ext>` audio track. */
  asset: string;
  /** Fade the bed out over the last N output frames. */
  fadeOutFrames?: number;
}

/**
 * The edit decision list — the director's output, one per cut. `beats` is the
 * ordered timeline; the composition's total length = sum(durationFrames) −
 * sum(transition overlaps).
 */
export interface Edl {
  version?: number;
  title?: string;
  /** Output composition fps (default 30). */
  fps?: number;
  /** Output composition dimensions. */
  width?: number;
  height?: number;
  beats?: EdlBeat[];
  music?: EdlMusic | null;
}

// ── shared helpers ───────────────────────────────────────────────────────────

const ASSET_REL_RE = /^assets\/[0-9a-f]{8,}[A-Za-z0-9._-]*$/;
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** True when the analysis has nothing usable in it (no shots, or none usable). */
export function isEmptyAnalysis(a?: FootageAnalysis | null): boolean {
  if (!a || !a.shots || a.shots.length === 0) return true;
  return !a.shots.some((s) => s.usable !== false);
}

/** A fresh, empty analysis for `asset`. */
export function emptyFootageAnalysis(asset?: string): FootageAnalysis {
  return { version: FOOTAGE_ANALYSIS_VERSION, ...(asset ? { asset } : {}), shots: [] };
}

// ── structural validation (dependency-free — no Ajv) ─────────────────────────
// Mirrors photo/schema.ts: the `/_api/footage` route validates untrusted JSON
// with these before persisting. Unknown keys / wrong types / out-of-range
// numbers / non-relative asset paths all fail — no crafted field round-trips.

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function num(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  lo: number,
  hi: number,
  where: string
) {
  if (!(key in obj) || obj[key] == null) return;
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${where}.${key}: must be a finite number`);
    return;
  }
  if (v < lo || v > hi) errors.push(`${where}.${key}: ${v} out of range [${lo}, ${hi}]`);
}

function intGe(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  lo: number,
  where: string
) {
  if (!(key in obj) || obj[key] == null) return;
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < lo)
    errors.push(`${where}.${key}: must be an integer ≥ ${lo}`);
}

function bool(errors: string[], obj: Record<string, unknown>, key: string, where: string) {
  if (key in obj && obj[key] != null && typeof obj[key] !== 'boolean')
    errors.push(`${where}.${key}: must be a boolean`);
}

function str(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  maxLen: number,
  where: string
) {
  if (!(key in obj) || obj[key] == null) return;
  const v = obj[key];
  if (typeof v !== 'string') errors.push(`${where}.${key}: must be a string`);
  else if (v.length > maxLen) errors.push(`${where}.${key}: exceeds ${maxLen} chars`);
}

function assetRel(errors: string[], obj: Record<string, unknown>, key: string, where: string) {
  if (!(key in obj) || obj[key] == null) return;
  const v = obj[key];
  if (typeof v !== 'string' || !ASSET_REL_RE.test(v))
    errors.push(`${where}.${key}: must be a relative assets/<sha8>.<ext> path`);
}

function assertKeys(
  errors: string[],
  obj: Record<string, unknown>,
  allowed: string[],
  where: string
) {
  for (const k of Object.keys(obj))
    if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}"`);
}

function strArray(
  errors: string[],
  obj: Record<string, unknown>,
  key: string,
  maxItems: number,
  where: string
) {
  if (!(key in obj) || obj[key] == null) return;
  const v = obj[key];
  if (!Array.isArray(v)) {
    errors.push(`${where}.${key}: must be an array`);
    return;
  }
  if (v.length > maxItems) errors.push(`${where}.${key}: more than ${maxItems} items`);
  for (const s of v)
    if (typeof s !== 'string') errors.push(`${where}.${key}: items must be strings`);
}

/** Structurally validate an untrusted value as a `FootageAnalysis`. */
export function validateFootageAnalysis(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['root: must be an object'] };

  assertKeys(
    errors,
    input,
    ['version', 'asset', 'durationSec', 'width', 'height', 'keyframes', 'shots', 'summary', 'tags'],
    'root'
  );
  if ('version' in input && input.version != null && typeof input.version !== 'number')
    errors.push('version: must be a number');
  assetRel(errors, input, 'asset', 'root');
  num(errors, input, 'durationSec', 0, 24 * 3600, 'root');
  num(errors, input, 'width', 0, 100000, 'root');
  num(errors, input, 'height', 0, 100000, 'root');
  intGe(errors, input, 'keyframes', 0, 'root');
  str(errors, input, 'summary', 4000, 'root');
  strArray(errors, input, 'tags', 64, 'root');

  const dur = typeof input.durationSec === 'number' ? input.durationSec : Infinity;
  if ('shots' in input && input.shots != null) {
    if (!Array.isArray(input.shots)) errors.push('shots: must be an array');
    else if (input.shots.length > 512) errors.push('shots: more than 512 items');
    else
      input.shots.forEach((raw, i) => {
        const where = `shots[${i}]`;
        if (!isPlainObject(raw)) {
          errors.push(`${where}: must be an object`);
          return;
        }
        assertKeys(
          errors,
          raw,
          [
            'start',
            'end',
            'kind',
            'motion',
            'subject',
            'lighting',
            'mood',
            'quality',
            'usable',
            'note',
          ],
          where
        );
        num(errors, raw, 'start', 0, 24 * 3600, where);
        num(errors, raw, 'end', 0, 24 * 3600, where);
        if (typeof raw.start === 'number' && typeof raw.end === 'number' && !(raw.end > raw.start))
          errors.push(`${where}: end must be > start`);
        if (typeof raw.end === 'number' && raw.end > dur + 0.5)
          errors.push(`${where}: end ${raw.end}s exceeds clip duration ${dur}s`);
        if ('kind' in raw && raw.kind != null && !SHOT_KINDS.includes(raw.kind as ShotKind))
          errors.push(`${where}.kind: must be one of ${SHOT_KINDS.join(', ')}`);
        if (
          'motion' in raw &&
          raw.motion != null &&
          !MOTION_KINDS.includes(raw.motion as MotionKind)
        )
          errors.push(`${where}.motion: must be one of ${MOTION_KINDS.join(', ')}`);
        str(errors, raw, 'subject', 500, where);
        str(errors, raw, 'lighting', 500, where);
        str(errors, raw, 'mood', 500, where);
        str(errors, raw, 'note', 1000, where);
        num(errors, raw, 'quality', 0, 1, where);
        bool(errors, raw, 'usable', where);
      });
  }

  return { ok: errors.length === 0, errors };
}

function validateOverlay(errors: string[], raw: unknown, where: string) {
  if (raw == null) return;
  if (!isPlainObject(raw)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  assertKeys(errors, raw, ['kind', 'text'], where);
  const kinds = ['title', 'lower-third', 'caption', 'logo'];
  if (!kinds.includes(raw.kind as string))
    errors.push(`${where}.kind: must be one of ${kinds.join(', ')}`);
  str(errors, raw, 'text', 500, where);
}

function validateTransition(errors: string[], raw: unknown, where: string) {
  if (raw == null) return;
  if (!isPlainObject(raw)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  assertKeys(errors, raw, ['presentation', 'frames'], where);
  if (!TRANSITION_PRESENTATIONS.includes(raw.presentation as TransitionPresentation))
    errors.push(`${where}.presentation: must be one of ${TRANSITION_PRESENTATIONS.join(', ')}`);
  intGe(errors, raw, 'frames', 0, where);
}

/** Structurally validate an untrusted value as an `Edl`. */
export function validateEdl(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(input)) return { ok: false, errors: ['root: must be an object'] };

  assertKeys(
    errors,
    input,
    ['version', 'title', 'fps', 'width', 'height', 'beats', 'music'],
    'root'
  );
  if ('version' in input && input.version != null && typeof input.version !== 'number')
    errors.push('version: must be a number');
  str(errors, input, 'title', 300, 'root');
  num(errors, input, 'fps', 1, 120, 'root');
  num(errors, input, 'width', 1, 100000, 'root');
  num(errors, input, 'height', 1, 100000, 'root');

  if ('beats' in input && input.beats != null) {
    if (!Array.isArray(input.beats)) errors.push('beats: must be an array');
    else if (input.beats.length > 512) errors.push('beats: more than 512 items');
    else
      input.beats.forEach((raw, i) => {
        const where = `beats[${i}]`;
        if (!isPlainObject(raw)) {
          errors.push(`${where}: must be an object`);
          return;
        }
        assertKeys(
          errors,
          raw,
          ['clip', 'startSec', 'durationFrames', 'why', 'transition', 'overlay', 'name'],
          where
        );
        assetRel(errors, raw, 'clip', where);
        if (!('clip' in raw) || raw.clip == null) errors.push(`${where}.clip: required`);
        num(errors, raw, 'startSec', 0, 24 * 3600, where);
        intGe(errors, raw, 'durationFrames', 1, where);
        str(errors, raw, 'why', 1000, where);
        str(errors, raw, 'name', 120, where);
        if ('transition' in raw) validateTransition(errors, raw.transition, `${where}.transition`);
        if ('overlay' in raw) validateOverlay(errors, raw.overlay, `${where}.overlay`);
      });
  }

  if ('music' in input && input.music != null) {
    const m = input.music;
    if (!isPlainObject(m)) errors.push('music: must be an object');
    else {
      assertKeys(errors, m, ['asset', 'fadeOutFrames'], 'music');
      assetRel(errors, m, 'asset', 'music');
      if (!('asset' in m) || m.asset == null) errors.push('music.asset: required');
      intGe(errors, m, 'fadeOutFrames', 0, 'music');
    }
  }

  return { ok: errors.length === 0, errors };
}
