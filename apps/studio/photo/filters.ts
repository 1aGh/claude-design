/**
 * @file       photo/filters.ts — pure photo-pipeline PLANNER (Stage B, Task 4)
 * @scope      apps/studio/photo/filters.ts
 * @purpose    Turn a `PhotoEdit` into an ordered, plain-data description of the
 *             compositing stack — `planPhotoPipeline(edit) → PhotoPipelineStep[]`.
 *             This is the deterministic, testable core: it decides WHAT filters/
 *             overlays/masks apply and in WHAT order, without ever touching a GPU.
 *
 * @invariant  DEPENDENCY-FREE — like `schema.ts`, this file MUST NOT import
 *             `pixi.js`. The pixi realization (constructing real
 *             `PIXI.ColorMatrixFilter` / `NoiseFilter` / the duotone shader /
 *             `TilingSprite` / `Graphics` mask objects) lives in `pipeline.ts`,
 *             which is browser-only.
 *
 *             WHY the split (deviation from the plan's single
 *             `buildFilterGraph(): PIXI.Filter[]`): pixi v8 eagerly compiles a
 *             `GlProgram` in every filter's constructor, which calls
 *             `document.createElement('canvas')` — so constructing a filter in a
 *             headless `bun test` throws `ReferenceError: document is not
 *             defined`. Returning plain-data STEP specs keeps the plan's stated
 *             Task-4 validation ("assert filter count/order, not pixel output")
 *             genuinely runnable, and mirrors how `draw/serialize.ts` produces a
 *             browser-free description of a render. `pipeline.ts` re-exports a
 *             `buildFilterGraph(edit)` that realizes these steps into pixi objects.
 *
 * @order      Fixed, load-bearing pipeline order (filters are NOT commutative) —
 *             `PHOTO_PIPELINE_ORDER` from schema.ts:
 *               adjustments → duotone → grain → pattern → mask
 *             The adjustment SUB-order (within the single color-matrix step) is
 *             also fixed: brightness → exposure → contrast → saturation → hue →
 *             sepia → grayscale → invert (color-matrix ops compose, so order
 *             changes the result). Both orders are asserted by the unit tests.
 */

import type {
  MaskPreset,
  PatternBlend,
  PatternType,
  PhotoAdjustments,
  PhotoEdit,
} from './schema.ts';
import { PHOTO_PIPELINE_ORDER } from './schema.ts';

// ── Step vocabulary (plain data — the realizer in pipeline.ts consumes these) ──

/** One color-matrix operation, with a NORMALIZED value (see schema.ts ranges).
 *  The realizer maps each op onto the corresponding pixi ColorMatrixFilter call. */
export type AdjustOpKind =
  | 'brightness'
  | 'exposure'
  | 'contrast'
  | 'saturation'
  | 'hue'
  | 'sepia'
  | 'grayscale'
  | 'invert';

export interface AdjustOp {
  op: AdjustOpKind;
  /** Normalized value straight from PhotoEdit.adjustments (−1…1, deg, or 0…1). */
  value: number;
}

/** Adjustments compile to ONE color-matrix filter carrying an ordered op list. */
export interface AdjustmentsStep {
  stage: 'adjustments';
  kind: 'colorMatrix';
  ops: AdjustOp[];
}

export interface DuotoneStep {
  stage: 'duotone';
  kind: 'duotone';
  /** `#rrggbb` shadow color. */
  colorA: string;
  /** `#rrggbb` highlight color. */
  colorB: string;
  /** 0…1 crossfade between original and full duotone. */
  intensity: number;
}

export interface GrainStep {
  stage: 'grain';
  kind: 'noise';
  amount: number;
  size: number;
}

export interface PatternStep {
  stage: 'pattern';
  kind: 'pattern';
  type: PatternType;
  scale: number;
  opacity: number;
  blend: PatternBlend;
  /** `#rrggbb` ink color for the pattern tile. */
  color: string;
}

export interface MaskStep {
  stage: 'mask';
  kind: 'mask';
  /** 'none' never reaches here — an unmasked edit omits the step entirely. */
  preset: Exclude<MaskPreset, 'none'>;
  strength: number;
}

export type PhotoPipelineStep = AdjustmentsStep | DuotoneStep | GrainStep | PatternStep | MaskStep;

// ── Sensible visual defaults (used when a section is enabled but a field unset) ─

const DUOTONE_DEFAULT_A = '#111111';
const DUOTONE_DEFAULT_B = '#ffffff';
const DUOTONE_DEFAULT_INTENSITY = 1;
const GRAIN_DEFAULT_AMOUNT = 0.4;
const GRAIN_DEFAULT_SIZE = 1;
const PATTERN_DEFAULT_TYPE: PatternType = 'dots';
const PATTERN_DEFAULT_SCALE = 1;
const PATTERN_DEFAULT_OPACITY = 0.5;
const PATTERN_DEFAULT_BLEND: PatternBlend = 'normal';
const PATTERN_DEFAULT_COLOR = '#ffffff';
const MASK_DEFAULT_STRENGTH = 0.6;

const EPS = 1e-6;
const isSet = (v: number | undefined, origin = 0): boolean =>
  v != null && Math.abs(v - origin) > EPS;

// Fixed adjustment sub-order. See @order above.
const ADJUST_FIELD_ORDER: readonly AdjustOpKind[] = [
  'brightness',
  'exposure',
  'contrast',
  'saturation',
  'hue',
  'sepia',
  'grayscale',
  'invert',
];

function planAdjustments(a: PhotoAdjustments | undefined): AdjustmentsStep | null {
  if (!a) return null;
  const ops: AdjustOp[] = [];
  for (const field of ADJUST_FIELD_ORDER) {
    const v = a[field];
    if (isSet(v)) ops.push({ op: field, value: v as number });
  }
  return ops.length ? { stage: 'adjustments', kind: 'colorMatrix', ops } : null;
}

/**
 * The single source of truth for "what does this edit do." Returns the ordered
 * list of pipeline steps — a neutral/empty edit returns `[]` (the compositor
 * then skips pixi entirely, preserving the lazy-bundle guarantee). Steps always
 * appear in `PHOTO_PIPELINE_ORDER`.
 */
export function planPhotoPipeline(edit: PhotoEdit | null | undefined): PhotoPipelineStep[] {
  if (!edit) return [];
  const byStage: Record<string, PhotoPipelineStep | null> = {
    adjustments: planAdjustments(edit.adjustments),
    duotone: null,
    grain: null,
    pattern: null,
    mask: null,
  };

  const d = edit.duotone;
  if (d?.enabled && (d.intensity ?? DUOTONE_DEFAULT_INTENSITY) > EPS) {
    byStage.duotone = {
      stage: 'duotone',
      kind: 'duotone',
      colorA: d.colorA ?? DUOTONE_DEFAULT_A,
      colorB: d.colorB ?? DUOTONE_DEFAULT_B,
      intensity: d.intensity ?? DUOTONE_DEFAULT_INTENSITY,
    };
  }

  const g = edit.grain;
  if (g?.enabled && (g.amount ?? GRAIN_DEFAULT_AMOUNT) > EPS) {
    byStage.grain = {
      stage: 'grain',
      kind: 'noise',
      amount: g.amount ?? GRAIN_DEFAULT_AMOUNT,
      size: g.size ?? GRAIN_DEFAULT_SIZE,
    };
  }

  const p = edit.pattern;
  if (p?.enabled && (p.opacity ?? PATTERN_DEFAULT_OPACITY) > EPS) {
    byStage.pattern = {
      stage: 'pattern',
      kind: 'pattern',
      type: p.type ?? PATTERN_DEFAULT_TYPE,
      scale: p.scale ?? PATTERN_DEFAULT_SCALE,
      opacity: p.opacity ?? PATTERN_DEFAULT_OPACITY,
      blend: p.blend ?? PATTERN_DEFAULT_BLEND,
      color: p.color ?? PATTERN_DEFAULT_COLOR,
    };
  }

  const m = edit.mask;
  if (m?.preset && m.preset !== 'none' && (m.strength ?? MASK_DEFAULT_STRENGTH) > EPS) {
    byStage.mask = {
      stage: 'mask',
      kind: 'mask',
      preset: m.preset,
      strength: m.strength ?? MASK_DEFAULT_STRENGTH,
    };
  }

  // Emit in the canonical, fixed order.
  const out: PhotoPipelineStep[] = [];
  for (const stage of PHOTO_PIPELINE_ORDER) {
    const step = byStage[stage];
    if (step) out.push(step);
  }
  return out;
}

// ── Pure color helper (shared by the realizer + tests) ───────────────────────

/**
 * `#rrggbb` → normalized `[r, g, b]` in 0…1. Throws on malformed input (the
 * validator in schema.ts already rejects bad colors before persistence, so this
 * is a belt-and-braces guard for the realizer). Kept here (pure, no pixi) so the
 * duotone realization and its tests share one parser.
 */
export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`hexToRgb01: not a #rrggbb color: ${hex}`);
  const int = Number.parseInt(m[1], 16);
  return [((int >> 16) & 0xff) / 255, ((int >> 8) & 0xff) / 255, (int & 0xff) / 255];
}

// ── GLSL for the custom duotone filter (a string — no pixi dependency) ────────
// Duotone is a per-pixel luminance → two-color gradient-map lerp, which a linear
// `ColorMatrixFilter` affine transform cannot express, so it needs its own
// fragment shader. `pipeline.ts` compiles these into a `PIXI.Filter` via
// `GlProgram.from({ vertex, fragment })`. WebGL (GLSL ES 1.00-ish, pixi v8
// high-precision) only — the Application is pinned to `preference: 'webgl'` so
// the WebGPU program is unnecessary (and WKWebView WebGPU is partial — Task 25).

export const DUOTONE_VERT_SOURCE = /* glsl */ `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

export const DUOTONE_FRAG_SOURCE = /* glsl */ `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform vec3 uColorA;     // shadow color (0..1)
  uniform vec3 uColorB;     // highlight color (0..1)
  uniform float uIntensity; // 0..1 crossfade with the original

  void main(void) {
    vec4 src = texture(uTexture, vTextureCoord);
    // Rec. 601 luma over UN-premultiplied color.
    vec3 rgb = src.a > 0.0 ? src.rgb / src.a : src.rgb;
    float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
    vec3 duo = mix(uColorA, uColorB, luma);
    vec3 outRgb = mix(rgb, duo, uIntensity);
    finalColor = vec4(outRgb * src.a, src.a); // re-premultiply
  }
`;
