/**
 * @file       draw/palette.ts — Phase 25 geometry-engine color layer
 * @scope      plugins/design/dev-server/draw/palette.ts
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
