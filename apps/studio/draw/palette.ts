/**
 * @file       draw/palette.ts — Phase 25 geometry-engine color layer
 * @scope      apps/studio/draw/palette.ts
 * @purpose    Color correctness the draw-agent verifies from SOURCE, never from
 *             the vision model (VLMs misread color confidently):
 *               • WCAG 2.1 relative-luminance + contrast ratio (4.5 / 3 / 7);
 *               • OKLCH → sRGB conversion (Björn Ottosson constants) so ramps
 *                 are generated in a perceptually uniform space;
 *               • evenly-spaced lightness ramps (rubric check 16);
 *               • 60-30-10 area-distribution check (accent ≤ ~15%).
 *             Pure + deterministic; React-free (DDR-067).
 */

export const CURRENT_COLOR = 'currentColor';

export interface Rgb {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  /** Lightness 0–1. */
  l: number;
  /** Chroma (≈0–0.4). */
  c: number;
  /** Hue in degrees. */
  h: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a hex (`#rgb`, `#rrggbb`, `#rrggbbaa`) or `rgb()/rgba()` string to
 * 0–255 channels. Throws on anything else (use {@link oklchToRgb} for OKLCH).
 */
export function parseColor(input: string): Rgb {
  const s = input.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    if (hex.length !== 6 && hex.length !== 8) throw new Error(`parseColor: bad hex "${input}"`);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) throw new Error(`parseColor: bad hex "${input}"`);
    return { r, g, b };
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  throw new Error(`parseColor: unsupported color "${input}" (hex or rgb() only)`);
}

/** Parse an `oklch(L C H)` string (L as `%` or 0–1) into an {@link Oklch}. */
export function parseOklch(input: string): Oklch {
  const m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i.exec(input.trim());
  if (!m) throw new Error(`parseOklch: bad oklch "${input}"`);
  const lraw = m[1];
  const l = lraw.endsWith('%') ? Number(lraw.slice(0, -1)) / 100 : Number(lraw);
  return { l, c: Number(m[2]), h: Number(m[3]) };
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WCAG contrast
// ─────────────────────────────────────────────────────────────────────────────

function srgbToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white). */
export function relativeLuminance(color: Rgb | string): number {
  const { r, g, b } = typeof color === 'string' ? parseColor(color) : color;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors (1–21). Order-independent. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = 'AA' | 'AAA';

/**
 * Does `ratio` clear the WCAG bar? `large` = ≥18.66px bold / ≥24px regular
 * (3:1 at AA). `nonText` = UI components / graphical objects (always 3:1).
 */
export function meetsWcag(
  ratio: number,
  opts: { level?: WcagLevel; large?: boolean; nonText?: boolean } = {}
): boolean {
  const { level = 'AA', large = false, nonText = false } = opts;
  if (nonText) return ratio >= 3;
  if (level === 'AAA') return ratio >= (large ? 4.5 : 7);
  return ratio >= (large ? 3 : 4.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// OKLCH → sRGB (Björn Ottosson)
// ─────────────────────────────────────────────────────────────────────────────

function linearToSrgb8(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/** Convert OKLCH (L 0–1, C, H°) to clamped sRGB 0–255. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  const rLin = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const gLin = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bLin = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return { r: linearToSrgb8(rLin), g: linearToSrgb8(gLin), b: linearToSrgb8(bLin) };
}

export function oklchToHex(o: Oklch): string {
  return toHex(oklchToRgb(o));
}

function srgb8ToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Convert clamped sRGB 0–255 to OKLCH — the exact inverse of {@link oklchToRgb}
 * (same Björn Ottosson constants). Used by DDR-172's token importer to
 * normalize hex/rgb() input colors into a DS's declared `oklch` colorSpace.
 */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const rLin = srgb8ToLinear(r);
  const gLin = srgb8ToLinear(g);
  const bLin = srgb8ToLinear(b);

  const lc = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const mc = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const sc = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  const l_ = Math.cbrt(lc);
  const m_ = Math.cbrt(mc);
  const s_ = Math.cbrt(sc);

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bComp = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(a * a + bComp * bComp);
  let h = (Math.atan2(bComp, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l, c, h };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ramp generation
// ─────────────────────────────────────────────────────────────────────────────

export interface RampOpts {
  hue: number;
  chroma: number;
  /** Number of tiers (default 5). */
  count?: number;
  /** Lightest / darkest tier lightness (default 0.95 / 0.2). */
  lMax?: number;
  lMin?: number;
}

/**
 * An OKLCH tonal ramp with evenly spaced lightness — perceptually uniform by
 * construction (rubric check 16). Each tier holds chroma + hue constant; only
 * lightness steps, lightest first. Returns OKLCH tiers (convert with
 * {@link oklchToHex} as needed).
 */
export function oklchRamp(opts: RampOpts): Oklch[] {
  const { hue, chroma, count = 5, lMax = 0.95, lMin = 0.2 } = opts;
  if (count < 1) return [];
  if (count === 1) return [{ l: (lMax + lMin) / 2, c: chroma, h: hue }];
  const step = (lMax - lMin) / (count - 1);
  const out: Oklch[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ l: lMax - step * i, c: chroma, h: hue });
  }
  return out;
}

/**
 * Are the lightness values of a ramp evenly spaced (within `tol`)? The
 * machine-checkable form of "perceptually even ramp". Needs ≥3 tiers.
 */
export function isPerceptuallyEven(ramp: Oklch[], tol = 0.01): boolean {
  if (ramp.length < 3) return true;
  const deltas: number[] = [];
  for (let i = 1; i < ramp.length; i++) deltas.push(ramp[i].l - ramp[i - 1].l);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return deltas.every((d) => Math.abs(d - mean) <= tol);
}

// ─────────────────────────────────────────────────────────────────────────────
// 60-30-10 distribution
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaShare {
  role: string;
  area: number;
}

export interface DistributionResult {
  byRole: Record<string, number>;
  accentRatio: number;
  dominantRole: string | null;
  /** True when an accent role exists and stays ≤ 15% of total area. */
  ok: boolean;
}

/**
 * Check a composition's color area distribution against the 60-30-10 guideline.
 * Roles whose name contains `accent` are summed as the accent budget; the check
 * passes when that budget is ≤ 15% of the total painted area (rubric check 14).
 */
export function colorDistribution(shares: AreaShare[]): DistributionResult {
  const total = shares.reduce((a, s) => a + Math.max(0, s.area), 0);
  const byRole: Record<string, number> = {};
  let accent = 0;
  let dominantRole: string | null = null;
  let dominantArea = -1;
  for (const s of shares) {
    const ratio = total > 0 ? s.area / total : 0;
    byRole[s.role] = (byRole[s.role] ?? 0) + ratio;
    if (/accent/i.test(s.role)) accent += ratio;
    if (s.area > dominantArea) {
      dominantArea = s.area;
      dominantRole = s.role;
    }
  }
  return { byRole, accentRatio: accent, dominantRole, ok: accent > 0 && accent <= 0.15 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Color harmony — Cohen-Or et al. eight hue-wheel templates (SIGGRAPH 2006)
// ─────────────────────────────────────────────────────────────────────────────

/** One wedge of a harmonic template: a sector centered at `center`° (relative to
 *  the template's rotation) spanning `arc`° of the hue wheel. */
export interface HarmonyWedge {
  center: number;
  arc: number;
}

/**
 * The eight Cohen-Or harmonic templates (`i V L I T Y X` + achromatic `N`),
 * expressed as hue-wheel wedges relative to a rotation. These encode the classic
 * schemes: `i` = monochromatic, `I` = complementary, `V`/`Y` = analogous /
 * split, `X` = double-complementary, `T` = a 180° span. Used BOTH to generate a
 * harmonious palette (snap hues into the wedges) AND to score harmony (distance
 * of a palette's hues to the nearest template).
 */
export const HARMONY_TEMPLATES: Record<string, HarmonyWedge[]> = {
  i: [{ center: 0, arc: 18 }],
  V: [{ center: 0, arc: 93.6 }],
  L: [
    { center: 0, arc: 18 },
    { center: 90, arc: 79.2 },
  ],
  I: [
    { center: 0, arc: 18 },
    { center: 180, arc: 18 },
  ],
  T: [{ center: 0, arc: 180 }],
  Y: [
    { center: 0, arc: 93.6 },
    { center: 180, arc: 18 },
  ],
  X: [
    { center: 0, arc: 93.6 },
    { center: 180, arc: 93.6 },
  ],
};

/** Smallest absolute angular difference between two hues (degrees, 0–180). */
export function hueDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** Angular distance from hue `h` to the nearest edge of a wedge (0 if inside). */
function distToWedge(h: number, w: HarmonyWedge, rotation: number): number {
  const d = hueDelta(h, w.center + rotation);
  return Math.max(0, d - w.arc / 2);
}

function minDistToTemplate(h: number, tmpl: HarmonyWedge[], rotation: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const w of tmpl) best = Math.min(best, distToWedge(h, w, rotation));
  return best;
}

/**
 * Saturation-weighted distance of a hue set to a harmonic template at a given
 * rotation — the Cohen-Or harmony metric. 0 = every hue inside a wedge
 * (harmonious); larger = more disharmony. `sats` (0–1, default 1) weight vivid
 * colors more (a gray hue barely matters).
 */
export function harmonyDistance(
  hues: number[],
  template: keyof typeof HARMONY_TEMPLATES,
  rotation: number,
  sats?: number[]
): number {
  const tmpl = HARMONY_TEMPLATES[template];
  let sum = 0;
  for (let i = 0; i < hues.length; i++) {
    const s = sats?.[i] ?? 1;
    sum += s * minDistToTemplate(hues[i], tmpl, rotation);
  }
  return sum;
}

export interface HarmonyFit {
  template: keyof typeof HARMONY_TEMPLATES;
  rotation: number;
  distance: number;
}

/**
 * Find the best-fitting harmonic template + rotation for a hue set (brute search
 * over templates × rotations at 2° steps). The returned `distance` is the
 * discriminating critic metric: ≈0 = harmonious, large = "fighting colors".
 */
export function bestHarmony(hues: number[], sats?: number[]): HarmonyFit {
  let best: HarmonyFit = { template: 'i', rotation: 0, distance: Number.POSITIVE_INFINITY };
  for (const template of Object.keys(HARMONY_TEMPLATES) as (keyof typeof HARMONY_TEMPLATES)[]) {
    for (let rotation = 0; rotation < 360; rotation += 2) {
      const distance = harmonyDistance(hues, template, rotation, sats);
      if (distance < best.distance) best = { template, rotation, distance };
    }
  }
  return best;
}

/**
 * Snap each hue into the nearest wedge of a template (rotated) — generation-side
 * harmonization. Hues already inside a wedge are unchanged; outliers clamp to the
 * nearest wedge edge. Returns the harmonized hues (use these to build the palette).
 */
export function harmonize(
  hues: number[],
  template: keyof typeof HARMONY_TEMPLATES,
  rotation = 0
): number[] {
  const tmpl = HARMONY_TEMPLATES[template];
  return hues.map((h) => {
    let best = h;
    let bestD = Number.POSITIVE_INFINITY;
    for (const w of tmpl) {
      const lo = w.center + rotation - w.arc / 2;
      const hi = w.center + rotation + w.arc / 2;
      const inside = distToWedge(h, w, rotation) === 0;
      if (inside) return ((h % 360) + 360) % 360;
      // distance to each edge; clamp to the closer one
      const dLo = hueDelta(h, lo);
      const dHi = hueDelta(h, hi);
      const edge = dLo < dHi ? lo : hi;
      const d = Math.min(dLo, dHi);
      if (d < bestD) {
        bestD = d;
        best = edge;
      }
    }
    return ((best % 360) + 360) % 360;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Value / contrast — value does the work, color gets the credit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The WCAG-luminance value range (max − min) across a color set, 0–1. The
 * "muddy / washed-out" detector: a composition whose colors differ in hue but
 * cluster in a narrow value band reads as flat soup (exactly the failure that
 * sank the pastel + the neon-overlap backgrounds). A premium composition needs a
 * value range that actually spans (rule of thumb: ≥ ~0.35 for a scene with depth).
 */
export function valueRange(colors: Array<Rgb | string>): number {
  if (colors.length === 0) return 0;
  const ls = colors.map((c) => relativeLuminance(c));
  return Math.max(...ls) - Math.min(...ls);
}

function apcaLum(color: Rgb | string): number {
  const { r, g, b } = typeof color === 'string' ? parseColor(color) : color;
  // APCA uses a straight 2.4 power (not the WCAG piecewise linearization).
  const y = 0.2126 * (r / 255) ** 2.4 + 0.7152 * (g / 255) ** 2.4 + 0.0722 * (b / 255) ** 2.4;
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: APCA-0.98G blkClmp exponent (1.414) for the 0.022 black-soft-clamp — a defined spec constant, NOT √2.
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/**
 * APCA lightness contrast (Lc) between text and background — the perceptual
 * contrast metric WCAG 3 is built on (value does the perceptual work). Returns
 * |Lc| 0–~108. Thresholds (text): Lc 90 body-preferred, 75 body-min, 60 content,
 * 45 large/heavy; Lc 15 is the floor for ANY visible element. Implements the
 * APCA-0.98G constants; pin the version before treating a number as standard.
 */
export function apcaLc(text: Rgb | string, bg: Rgb | string): number {
  const ytxt = apcaLum(text);
  const ybg = apcaLum(bg);
  let sapc: number;
  let out: number;
  if (ybg > ytxt) {
    sapc = (ybg ** 0.56 - ytxt ** 0.57) * 1.14;
    out = sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  } else {
    sapc = (ybg ** 0.65 - ytxt ** 0.62) * 1.14;
    out = sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
  }
  return Math.abs(out);
}
