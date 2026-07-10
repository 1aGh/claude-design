/**
 * @file       photo/pipeline.ts — browser-only pixi.js REALIZER (Stage B, Task 5)
 * @scope      apps/studio/photo/pipeline.ts
 * @purpose    Turn the pure `planPhotoPipeline()` steps into a live WebGL render.
 *             Owns the one-`Application`-per-photo lifecycle, texture load, the
 *             realization of each step into real pixi objects (ColorMatrixFilter /
 *             the custom duotone Filter / NoiseFilter / TilingSprite overlay /
 *             alpha mask), and a single static render (no ticker — reduced-motion
 *             safe, Task 6).
 *
 * @browser    This is the ONLY photo/* module that imports `pixi.js`. It is
 *             imported exclusively by the canvas-lib `<PhotoLayer>` (client), so
 *             pixi resolves through the per-iframe runtime bundle (importmap →
 *             /_canvas-runtime/pixi.js.js). It MUST NOT be imported by any server
 *             module — the server bundle must never pull in a WebGL lib
 *             (schema.ts / filters.ts stay pixi-free for that reason).
 *
 * @testing    pixi filters build a GlProgram in their constructor → touch
 *             `document`, so the render path can't run in headless `bun test`.
 *             The PURE decision logic (`adjustmentCalls`, `resolveSourceUrl`) is
 *             exported and unit-tested headlessly; the actual render is verified
 *             via the `maude design screenshot` proof path (Task 6) + desktop
 *             dogfooding (Task 25). Importing this module does ZERO pixi
 *             construction at load time, so the pure tests are safe.
 */

// pixi.js is loaded via a RUNTIME dynamic import (see `loadPixi()`), NEVER a
// static import. This is load-bearing for the lazy-bundle guarantee: the canvas
// bundler runs with `splitting: false`, so a static `import 'pixi.js'` here would
// be HOISTED to eager even when <PhotoLayer> only dynamic-imports this module —
// making every canvas fetch the ~500 KB pixi runtime. Empirically verified
// (test/photo-canvas-bundle.test.ts). Types are `import type` (fully erased).
import type { Application, Filter } from 'pixi.js';

/** The pixi.js module, loaded once and threaded into the realizers. */
type Pixi = typeof import('pixi.js');
let pixiModule: Pixi | null = null;
async function loadPixi(): Promise<Pixi> {
  if (!pixiModule) pixiModule = await import('pixi.js');
  return pixiModule;
}

import type { AdjustmentsStep, GrainStep, MaskStep, PatternStep } from './filters.ts';
import {
  DUOTONE_FRAG_SOURCE,
  DUOTONE_VERT_SOURCE,
  hexToRgb01,
  planPhotoPipeline,
} from './filters.ts';
import type { PatternType } from './schema.ts';
import { isDefaultEdit, type PhotoEdit } from './schema.ts';

// ── Pure decision logic (headless-testable — NO pixi construction) ───────────

/** A single pixi `ColorMatrixFilter` method call. `isolateAlpha` (set for sepia
 *  / invert, which pixi exposes only as toggles) means "apply this on its OWN
 *  filter blended at this alpha" so the 0…1 amount is honored. */
export interface CmfCall {
  method: 'brightness' | 'contrast' | 'saturate' | 'hue' | 'grayscale' | 'sepia' | 'negative';
  args: number[];
  isolateAlpha?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Map the planner's normalized adjustment ops onto concrete pixi
 * ColorMatrixFilter calls, preserving sub-order. Pure — returns a description,
 * constructs nothing. This is the load-bearing normalized→pixi mapping, so it's
 * unit-tested directly.
 *
 * Neutral references (pixi v8 semantics):
 *   brightness(b): b=1 neutral, 0=black, 2=2× — map delta d → 1+d.
 *   exposure: no pixi method; photographic — map d → brightness(2^d).
 *   contrast(a): a∈0..1, 0.5=normal — map d → 0.5 + d*0.5.
 *   saturate(a): a∈−1..1, 0 neutral — pass through.
 *   hue(deg): degrees — pass through.
 *   grayscale(s): s∈0..1 intensity — pass through.
 *   sepia()/negative(): toggles — isolate + alpha=amount.
 */
export function adjustmentCalls(step: AdjustmentsStep): CmfCall[] {
  const calls: CmfCall[] = [];
  for (const { op, value } of step.ops) {
    switch (op) {
      case 'brightness':
        calls.push({ method: 'brightness', args: [1 + value] });
        break;
      case 'exposure':
        calls.push({ method: 'brightness', args: [2 ** value] });
        break;
      case 'contrast':
        calls.push({ method: 'contrast', args: [clamp01(0.5 + value * 0.5)] });
        break;
      case 'saturation':
        calls.push({ method: 'saturate', args: [value] });
        break;
      case 'hue':
        calls.push({ method: 'hue', args: [value] });
        break;
      case 'grayscale':
        calls.push({ method: 'grayscale', args: [clamp01(value)] });
        break;
      case 'sepia':
        calls.push({ method: 'sepia', args: [], isolateAlpha: clamp01(value) });
        break;
      case 'invert':
        calls.push({ method: 'negative', args: [], isolateAlpha: clamp01(value) });
        break;
    }
  }
  return calls;
}

/**
 * Which URL the compositor should actually texture. When background removal is
 * active, the content-addressed cutout matte REPLACES the original (the matte is
 * the subject on transparency); otherwise the original source. Pure. Both inputs
 * are already-validated relative `assets/…` paths (schema.ts).
 */
export function resolveSourceUrl(edit: PhotoEdit | null | undefined, source: string): string {
  if (edit?.backgroundRemoved?.enabled && edit.backgroundRemoved.maskAsset)
    return edit.backgroundRemoved.maskAsset;
  return source;
}

// ── pixi realization (browser-only — every constructor is threaded the loaded
//    pixi module `pixi`, never a static import; see `loadPixi()` above) ─────────

function realizeAdjustments(pixi: Pixi, step: AdjustmentsStep): Filter[] {
  const out: Filter[] = [];
  let current: InstanceType<Pixi['ColorMatrixFilter']> | null = null;
  const flush = () => {
    if (current) {
      out.push(current);
      current = null;
    }
  };
  for (const call of adjustmentCalls(step)) {
    if (call.isolateAlpha != null) {
      flush();
      const cmf = new pixi.ColorMatrixFilter();
      // biome-ignore lint/suspicious/noExplicitAny: pixi method dispatch by name
      (cmf as any)[call.method](...call.args, false);
      cmf.alpha = call.isolateAlpha;
      out.push(cmf);
    } else {
      if (!current) current = new pixi.ColorMatrixFilter();
      // biome-ignore lint/suspicious/noExplicitAny: pixi method dispatch by name
      (current as any)[call.method](...call.args, true);
    }
  }
  flush();
  return out;
}

let duotoneProgram: InstanceType<Pixi['GlProgram']> | null = null;
function realizeDuotone(pixi: Pixi, colorA: string, colorB: string, intensity: number): Filter {
  if (!duotoneProgram)
    duotoneProgram = pixi.GlProgram.from({
      vertex: DUOTONE_VERT_SOURCE,
      fragment: DUOTONE_FRAG_SOURCE,
    });
  return new pixi.Filter({
    glProgram: duotoneProgram,
    resources: {
      duotoneUniforms: {
        uColorA: { value: hexToRgb01(colorA), type: 'vec3<f32>' },
        uColorB: { value: hexToRgb01(colorB), type: 'vec3<f32>' },
        uIntensity: { value: clamp01(intensity), type: 'f32' },
      },
    },
  });
}

/**
 * Realize the FILTER portion of the pipeline (adjustments → duotone → grain).
 * Pattern + mask are display-object overlays realized against the sprite box by
 * the renderer, so they're returned separately. Honors the plan's
 * `buildFilterGraph` name for the filter list. Takes the loaded pixi module.
 */
export function buildFilterGraph(
  pixi: Pixi,
  edit: PhotoEdit
): {
  filters: Filter[];
  grain: GrainStep | null;
  pattern: PatternStep | null;
  mask: MaskStep | null;
} {
  const filters: Filter[] = [];
  let grain: GrainStep | null = null;
  let pattern: PatternStep | null = null;
  let mask: MaskStep | null = null;
  for (const step of planPhotoPipeline(edit)) {
    switch (step.stage) {
      case 'adjustments':
        filters.push(...realizeAdjustments(pixi, step));
        break;
      case 'duotone':
        filters.push(realizeDuotone(pixi, step.colorA, step.colorB, step.intensity));
        break;
      // Grain is realized as a monochrome-noise OVERLAY (below), not pixi's
      // `NoiseFilter` — the filter is per-pixel with NO grain-SIZE concept, so the
      // `size` knob did nothing. A noise texture drawn at 1/size resolution and
      // nearest-scaled up gives real, size-controllable film grain.
      case 'grain':
        grain = step;
        break;
      case 'pattern':
        pattern = step;
        break;
      case 'mask':
        mask = step;
        break;
    }
  }
  return { filters, grain, pattern, mask };
}

// ── Procedural pattern + mask textures (2D-canvas — reliable, no pixi Graphics) ─

function drawPatternTile(type: PatternType, scale: number, color: string): HTMLCanvasElement {
  const size = Math.max(4, Math.round(16 * scale));
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, size / 16);
  const half = size / 2;
  switch (type) {
    case 'dots':
      ctx.beginPath();
      ctx.arc(half, half, Math.max(1, size / 6), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'grid':
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      break;
    case 'lines':
      ctx.beginPath();
      ctx.moveTo(0, half);
      ctx.lineTo(size, half);
      ctx.stroke();
      break;
    case 'diagonal':
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.stroke();
      break;
    case 'crosshatch':
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.stroke();
      break;
  }
  return c;
}

/** Radial (vignette / radial-reveal) or linear (edge-fade) alpha mask texture. */
function drawMaskCanvas(width: number, height: number, step: MaskStep): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const s = clamp01(step.strength);
  const cx = c.width / 2;
  const cy = c.height / 2;
  const r = Math.hypot(cx, cy);
  if (step.preset === 'edge-fade') {
    const inset = (0.5 * s * Math.min(c.width, c.height)) / 2;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(clamp01(inset / c.height), 'rgba(255,255,255,1)');
    g.addColorStop(clamp01(1 - inset / c.height), 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }
  // vignette (dark edges → visible center) and radial-reveal (visible center → transparent edge)
  const inner = step.preset === 'radial-reveal' ? r * (1 - s) * 0.4 : r * (1 - s);
  const g = ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Monochrome film-grain tile drawn at 1/size resolution — nearest-scaled up to
 * the sprite it gives `size`-px grain cells (size=1 → per-pixel, size=8 → coarse).
 * Centered on mid-gray so a `soft-light`/`overlay` composite adds symmetric
 * light+dark speckle instead of only darkening.
 */
function drawGrainCanvas(width: number, height: number, size: number): HTMLCanvasElement {
  const cell = Math.max(1, Math.round(size));
  const w = Math.max(1, Math.ceil(width / cell));
  const h = Math.max(1, Math.ceil(height / cell));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    // Mid-gray ± spread — symmetric grain under soft-light.
    const v = (128 + (Math.random() * 2 - 1) * 127) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Vignette = a DARKENING overlay (transparent center → black edges), NOT an alpha
 * mask. The earlier "vignette" fed the alpha mask, which CLIPPED the edges to
 * transparency (they vanished) instead of darkening them. `strength` grows both
 * the dark ring's reach and its opacity.
 */
function drawVignetteCanvas(width: number, height: number, strength: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const s = clamp01(strength);
  const cx = c.width / 2;
  const cy = c.height / 2;
  const r = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, r * (1 - s) * 0.5, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${(0.35 + 0.6 * s).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// pixi v8 blend-mode strings map 1:1 from our PatternBlend union.
const BLEND_MAP: Record<string, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
};

export interface PhotoRendererOptions {
  canvas: HTMLCanvasElement;
  source: string;
  edit: PhotoEdit;
  width: number;
  height: number;
  /** Resolve a relative `assets/…` path to a fetchable URL (canvas-lib supplies). */
  resolveUrl?: (rel: string) => string;
}

/**
 * One pixi Application per edited photo (never a shared global renderer — pixi
 * v8 guidance; avoids cross-photo state bleed). Static render only.
 */
export class PhotoRenderer {
  private app: Application | null = null;
  private pixi: Pixi | null = null;
  private opts: PhotoRendererOptions;
  private destroyed = false;

  private constructor(opts: PhotoRendererOptions) {
    this.opts = opts;
  }

  static async create(opts: PhotoRendererOptions): Promise<PhotoRenderer> {
    const r = new PhotoRenderer(opts);
    await r.init();
    return r;
  }

  private resolve(rel: string): string {
    return this.opts.resolveUrl ? this.opts.resolveUrl(rel) : rel;
  }

  private async init(): Promise<void> {
    const pixi = await loadPixi(); // the ONLY pixi fetch — lazy, deferred to here.
    if (this.destroyed) return;
    this.pixi = pixi;
    const { canvas, width, height } = this.opts;
    const app = new pixi.Application();
    await app.init({
      canvas,
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      backgroundAlpha: 0,
      antialias: true,
      preference: 'webgl', // WKWebView WebGPU is partial (Task 25); pin WebGL.
      autoStart: false, // static render — no per-frame ticker (reduced-motion safe).
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    await this.render();
  }

  /** Re-composite with a new edit (live preview / knob scrub). */
  async update(edit: PhotoEdit): Promise<void> {
    this.opts.edit = edit;
    if (this.app && !this.destroyed) await this.render();
  }

  private async render(): Promise<void> {
    const app = this.app;
    const pixi = this.pixi;
    if (!app || !pixi || this.destroyed) return;
    app.stage.removeChildren();

    const { edit, source, width, height } = this.opts;
    const srcUrl = this.resolve(resolveSourceUrl(edit, source));
    // Decode the source on the MAIN thread via an <img> element. pixi's
    // `Assets.load` decodes off-thread in a Web Worker (+ createImageBitmap),
    // which the split-origin canvas CSP (DDR-054) silently blocks — `worker-src`
    // falls back to `default-src 'none'`, so the worker never spawns, the texture
    // never arrives, and the sprite renders blank (the live preview "does
    // nothing", with no console error). An <img> respects `img-src` and needs no
    // worker; the asset is same-origin to the canvas iframe, so the WebGL upload
    // isn't tainted. (feature-photo-editor.)
    let texture: InstanceType<Pixi['Texture']>;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = srcUrl;
      if (typeof img.decode === 'function') await img.decode();
      else
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error(`image load failed: ${srcUrl}`));
        });
      texture = pixi.Texture.from(img);
    } catch {
      texture = pixi.Texture.from(srcUrl);
    }
    if (this.destroyed || this.app !== app) return;

    const sprite = new pixi.Sprite(texture);
    sprite.width = Math.max(1, Math.round(width));
    sprite.height = Math.max(1, Math.round(height));

    const { filters, grain, pattern, mask } = buildFilterGraph(pixi, edit);
    if (filters.length) sprite.filters = filters;
    app.stage.addChild(sprite);

    // Grain — a nearest-scaled mid-gray noise overlay (soft-light) so `size`
    // actually changes the grain cell (pixi's NoiseFilter had no size concept).
    if (grain) {
      const gTex = pixi.Texture.from(drawGrainCanvas(sprite.width, sprite.height, grain.size));
      // biome-ignore lint/suspicious/noExplicitAny: pixi v8 scaleMode is a string union
      if (gTex.source) (gTex.source as any).scaleMode = 'nearest';
      const gSprite = new pixi.Sprite(gTex);
      gSprite.width = sprite.width;
      gSprite.height = sprite.height;
      gSprite.alpha = clamp01(grain.amount);
      // biome-ignore lint/suspicious/noExplicitAny: pixi v8 blendMode is a string union
      (gSprite as any).blendMode = 'soft-light';
      app.stage.addChild(gSprite);
    }

    if (pattern) {
      const tile = pixi.Texture.from(drawPatternTile(pattern.type, pattern.scale, pattern.color));
      const tiling = new pixi.TilingSprite({
        texture: tile,
        width: sprite.width,
        height: sprite.height,
      });
      tiling.alpha = clamp01(pattern.opacity);
      // biome-ignore lint/suspicious/noExplicitAny: pixi v8 blendMode is a string union
      (tiling as any).blendMode = BLEND_MAP[pattern.blend] ?? 'normal';
      app.stage.addChild(tiling);
    }

    if (mask) {
      if (mask.preset === 'vignette') {
        // Vignette DARKENS the edges (overlay) — it does not clip them.
        const vig = new pixi.Sprite(
          pixi.Texture.from(drawVignetteCanvas(sprite.width, sprite.height, mask.strength))
        );
        vig.width = sprite.width;
        vig.height = sprite.height;
        app.stage.addChild(vig);
        app.stage.mask = null;
      } else {
        // radial-reveal / edge-fade → an alpha mask (fade to transparent).
        const maskSprite = new pixi.Sprite(
          pixi.Texture.from(drawMaskCanvas(sprite.width, sprite.height, mask))
        );
        maskSprite.width = sprite.width;
        maskSprite.height = sprite.height;
        app.stage.addChild(maskSprite);
        app.stage.mask = maskSprite;
      }
    } else {
      app.stage.mask = null;
    }

    app.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }
}

/** Convenience: true when the edit needs pixi at all (else render the plain img). */
export function needsCompositor(edit: PhotoEdit | null | undefined): boolean {
  return !isDefaultEdit(edit);
}
