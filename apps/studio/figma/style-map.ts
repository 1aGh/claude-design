/**
 * @file       figma/style-map.ts — Figma paint/effect/typeStyle → CSS.
 * @scope      apps/studio/figma/style-map.ts
 * @purpose    Turn a node's visual properties into CSS declarations, resolving
 *             every colour to the NEAREST active-DS token rather than baking a
 *             hex into an imported canvas.
 *
 * @invariant  IMPORTED FRAMES MUST NOT HARDCODE HEX. A canvas whose colours are
 *             literals is off-brand the moment the DS moves, and it defeats the
 *             point of importing INTO a design system. Every paint resolves to
 *             `var(--token)` inside a configurable ΔE threshold; outside it, the
 *             literal ships WITH a `/* figma: no near token *​/` marker so the
 *             drift is auditable rather than silent. Threshold and fallback are
 *             per-import flags, never hidden constants.
 *
 * @invariant  EVERY EMITTED VALUE IS GRAMMAR-VALIDATED FIRST (DDR-216 D6, which
 *             reuses DDR-172 Decision 4 verbatim): printable-ASCII pre-filter,
 *             no `m`/`s` regex flags, shape AND magnitude bounds, no unbounded
 *             free-text capture. A value that fails is DROPPED and reported —
 *             never "cleaned up" and never partially applied. This matters more
 *             here than in `import-tokens`: a canvas stylesheet is rendered live
 *             in the canvas iframe.
 *
 * @invariant  DEPENDENCY-FREE beyond `draw/palette.ts` (the colorspace helpers
 *             `import-tokens` already reuses). No fs, no network.
 */

import { parseColor, rgbToOklch } from '../draw/palette.ts';
import type { FigmaColor, FigmaEffect, FigmaNode, FigmaPaint, FigmaTypeStyle } from './types.ts';

/** Default perceptual distance under which a paint snaps to a DS token. */
export const DEFAULT_TOKEN_THRESHOLD = 0.08;

/** The marker that makes an un-snapped literal auditable rather than silent. */
export const NO_TOKEN_MARKER = '/* figma: no near token */';

export interface DsToken {
  /** e.g. `--accent` — the name only, never a value the caller invented. */
  name: string;
  /** Resolved hex for distance comparison. */
  hex: string;
}

// ── Value grammars (DDR-172 Decision 4, reused verbatim per DDR-216 D6) ─────
//
// Deliberately NO unbounded free-text capture anywhere, and every numeric
// grammar is paired with a magnitude bound: a grammar-valid `99999999px` is a
// live-render hang vector even though its SHAPE is fine.

const PRINTABLE_ASCII_RE = /^[\x20-\x7E]*$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_RE = /^rgba?\( ?[\d.]+[ ,]+[\d.]+[ ,]+[\d.]+(?: ?[,/] ?[\d.]+%?)? ?\)$/;
const VAR_RE = /^var\(--[a-z0-9-]{1,64}\)$/;
const DIM_MAX = 4096;
const FONT_SIZE_MAX = 512;

/** True when a string is safe to place in a CSS value position at all. */
function printableAscii(v: string): boolean {
  // Checked BEFORE any grammar regex, and no grammar here uses `m`/`s` — an
  // anchor is only as strong as the flags it runs under, and a multiline value
  // would otherwise match just its first line.
  return PRINTABLE_ASCII_RE.test(v);
}

export function isValidColorValue(v: string): boolean {
  if (!printableAscii(v)) return false;
  return HEX_RE.test(v) || RGBA_RE.test(v) || VAR_RE.test(v);
}

export function isValidDimension(v: string, max = DIM_MAX): boolean {
  if (!printableAscii(v)) return false;
  if (v === '0') return true;
  const m = /^(-?[\d.]{1,7})(px|rem|em|%)$/.exec(v);
  if (!m) return false;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) && Math.abs(n) <= max;
}

// ── Colour ──────────────────────────────────────────────────────────────────

function figmaColorToHex(c: FigmaColor): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

/** Perceptual distance in OKLCH — the same space `import-tokens` compares in. */
export function perceptualDistance(aHex: string, bHex: string): number {
  try {
    const a = rgbToOklch(parseColor(aHex));
    const b = rgbToOklch(parseColor(bHex));
    // Chroma/hue folded into a Cartesian pair so a hue difference at low chroma
    // (where hue is perceptually meaningless) doesn't dominate the distance.
    const aa = a.c * Math.cos((a.h * Math.PI) / 180);
    const ab = a.c * Math.sin((a.h * Math.PI) / 180);
    const ba = b.c * Math.cos((b.h * Math.PI) / 180);
    const bb = b.c * Math.sin((b.h * Math.PI) / 180);
    return Math.hypot(a.l - b.l, aa - ba, ab - bb);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export interface ResolvedColor {
  /** The CSS value to emit — `var(--token)` or a literal hex. */
  value: string;
  /** Set when no token was near enough; the caller emits it as a comment. */
  marker?: string;
  /** Which token matched, for the report. */
  token?: string;
}

/**
 * Resolve a hex to the nearest DS token, or fall back to the literal WITH a
 * marker. Never invents a token name and never silently ships a hex.
 */
export function resolveColor(
  hex: string,
  tokens: readonly DsToken[],
  threshold = DEFAULT_TOKEN_THRESHOLD
): ResolvedColor {
  let best: DsToken | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const t of tokens) {
    const d = perceptualDistance(hex, t.hex);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best && bestDist <= threshold) {
    return { value: `var(${best.name})`, token: best.name };
  }
  return { value: hex, marker: NO_TOKEN_MARKER };
}

// ── Paints / effects / type ─────────────────────────────────────────────────

export interface StyleMapOptions {
  tokens: readonly DsToken[];
  threshold?: number;
}

export interface MappedStyle {
  /** CSS property → value. Every value has already passed its grammar. */
  declarations: Record<string, string>;
  /** Properties dropped because a value failed its grammar (reported). */
  rejected: string[];
  /** Properties that shipped a literal because no token was near (reported). */
  unTokenized: string[];
}

function emptyStyle(): MappedStyle {
  return { declarations: {}, rejected: [], unTokenized: [] };
}

function firstVisible<T extends { visible: boolean }>(list: readonly T[] | undefined): T | null {
  for (const p of list ?? []) if (p.visible) return p;
  return null;
}

/** A linear gradient → the CSS equivalent. Angle is derived from the handles. */
function gradientCss(paint: FigmaPaint, opts: StyleMapOptions, out: MappedStyle): string | null {
  const stops = paint.gradientStops;
  if (!stops || stops.length < 2) return null;
  const parts: string[] = [];
  for (const s of stops) {
    const resolved = resolveColor(figmaColorToHex(s.color), opts.tokens, opts.threshold);
    if (!isValidColorValue(resolved.value)) return null;
    if (resolved.marker) out.unTokenized.push('background-image');
    const pct = Math.max(0, Math.min(100, Math.round(s.position * 100)));
    parts.push(`${resolved.value} ${pct}%`);
  }
  const handles = paint.gradientHandlePositions;
  let angle = 180;
  if (handles && handles.length >= 2) {
    const dx = handles[1].x - handles[0].x;
    const dy = handles[1].y - handles[0].y;
    angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
  }
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
}

/** Effects → `box-shadow`. Every layer is strict-numeric; no free-text capture. */
function shadowCss(effects: readonly FigmaEffect[], opts: StyleMapOptions): string | null {
  const layers: string[] = [];
  for (const e of effects) {
    if (!e.visible) continue;
    if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') continue;
    const c = e.color ? figmaColorToHex(e.color) : '#000000';
    const resolved = resolveColor(c, opts.tokens, opts.threshold);
    if (!isValidColorValue(resolved.value)) continue;
    const x = Math.round(e.offset?.x ?? 0);
    const y = Math.round(e.offset?.y ?? 0);
    const blur = Math.round(e.radius ?? 0);
    const spread = Math.round(e.spread ?? 0);
    if ([x, y, blur, spread].some((n) => !Number.isFinite(n) || Math.abs(n) > 512)) continue;
    const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
    layers.push(`${inset}${x}px ${y}px ${blur}px ${spread}px ${resolved.value}`);
  }
  return layers.length ? layers.join(', ') : null;
}

/** A node's fills/strokes/effects/corner radius → CSS declarations. */
export function mapNodeStyle(node: FigmaNode, opts: StyleMapOptions): MappedStyle {
  const out = emptyStyle();
  const set = (prop: string, value: string, validator: (v: string) => boolean) => {
    if (!validator(value)) {
      out.rejected.push(prop);
      return;
    }
    out.declarations[prop] = value;
  };

  const fill = firstVisible(node.fills);
  if (fill) {
    if (fill.type === 'SOLID' && fill.color) {
      const resolved = resolveColor(figmaColorToHex(fill.color), opts.tokens, opts.threshold);
      if (resolved.marker) out.unTokenized.push('background');
      set('background', resolved.value, isValidColorValue);
    } else if (fill.type.startsWith('GRADIENT')) {
      const css = gradientCss(fill, opts, out);
      // A gradient is not a colour value — it has its own (bounded) shape,
      // built entirely from already-validated colour values plus integers.
      // camelCase, NOT `background-image`: these declarations are emitted into
      // a JSX style OBJECT, where a hyphenated key is a syntax error that takes
      // the whole canvas down. One gradient anywhere on a page was enough to
      // make the file unparseable.
      if (css) out.declarations.backgroundImage = css;
      else out.rejected.push('background-image');
    }
  }

  const stroke = firstVisible(node.strokes);
  if (stroke?.type === 'SOLID' && stroke.color) {
    const resolved = resolveColor(figmaColorToHex(stroke.color), opts.tokens, opts.threshold);
    if (resolved.marker) out.unTokenized.push('border-color');
    const w = Math.round(node.strokeWeight ?? 1);
    if (Number.isFinite(w) && w > 0 && w <= 64 && isValidColorValue(resolved.value)) {
      out.declarations.border = `${w}px solid ${resolved.value}`;
    } else {
      out.rejected.push('border');
    }
  }

  if (node.cornerRadius !== undefined) {
    set('borderRadius', `${Math.round(node.cornerRadius)}px`, (v) => isValidDimension(v, 512));
  }

  if (node.effects?.length) {
    const css = shadowCss(node.effects, opts);
    if (css) out.declarations.boxShadow = css;
  }

  // Node opacity is carried ONLY when it is not a hiding mechanism. D6b makes
  // the translator guarantee visibility, so an opacity that would render the
  // subtree effectively invisible is dropped rather than reproduced.
  if (node.opacity !== undefined && node.opacity < 1) {
    if (node.opacity >= 0.15) out.declarations.opacity = String(Number(node.opacity.toFixed(3)));
    else out.rejected.push('opacity');
  }

  return out;
}

/** A TEXT node's `style` block → CSS declarations. */
export function mapTypeStyle(
  style: FigmaTypeStyle | undefined,
  opts: StyleMapOptions
): MappedStyle {
  const out = emptyStyle();
  if (!style) return out;

  if (style.fontSize !== undefined) {
    const v = `${Math.round(style.fontSize)}px`;
    if (isValidDimension(v, FONT_SIZE_MAX)) out.declarations.fontSize = v;
    else out.rejected.push('fontSize');
  }
  if (style.fontWeight !== undefined) {
    const w = Math.round(style.fontWeight);
    if (w >= 100 && w <= 1000) out.declarations.fontWeight = String(w);
    else out.rejected.push('fontWeight');
  }
  if (style.lineHeightPx !== undefined) {
    const v = `${Math.round(style.lineHeightPx)}px`;
    if (isValidDimension(v, FONT_SIZE_MAX)) out.declarations.lineHeight = v;
    else out.rejected.push('lineHeight');
  }
  if (style.letterSpacing !== undefined && style.letterSpacing !== 0) {
    const v = `${style.letterSpacing.toFixed(2)}px`;
    if (isValidDimension(v, 64)) out.declarations.letterSpacing = v;
    else out.rejected.push('letterSpacing');
  }
  if (style.textAlignHorizontal) {
    const align = style.textAlignHorizontal.toLowerCase();
    if (['left', 'center', 'right', 'justified'].includes(align)) {
      out.declarations.textAlign = align === 'justified' ? 'justify' : align;
    }
  }
  if (style.textCase === 'UPPER') out.declarations.textTransform = 'uppercase';
  if (style.textCase === 'LOWER') out.declarations.textTransform = 'lowercase';
  if (style.textDecoration === 'UNDERLINE') out.declarations.textDecoration = 'underline';
  if (style.textDecoration === 'STRIKETHROUGH') out.declarations.textDecoration = 'line-through';

  // FONT FAMILY IS DELIBERATELY NOT CARRIED. A Figma font name is free text
  // from the document, and DDR-172 Decision 4's font grammar exists precisely
  // because a family value reaches a live stylesheet. An imported canvas
  // inherits the DS's own type stack instead — which is also the editability
  // choice: an imported frame should look like it belongs to the project.

  return out;
}

/** Auto-layout → flex. The thing that makes the handle surfaces work at all. */
export function mapAutoLayout(node: FigmaNode): Record<string, string> {
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return {};
  const out: Record<string, string> = {
    display: 'flex',
    flexDirection: node.layoutMode === 'HORIZONTAL' ? 'row' : 'column',
  };
  if (node.itemSpacing) out.gap = `${Math.round(node.itemSpacing)}px`;
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
  if (pad.some((p) => p !== undefined && p !== 0)) {
    out.padding = pad.map((p) => `${Math.round(p ?? 0)}px`).join(' ');
  }
  // `Object.create(null)`: these are indexed by DOCUMENT-CONTROLLED strings, so a
  // plain literal returns `Object.prototype.constructor` (a FUNCTION) for
  // `primaryAxisAlignItems: "constructor"`, which then stringifies into an
  // emitted style value (review F11). D5 mandates this shape for exactly this.
  const MAIN: Record<string, string> = Object.assign(Object.create(null), {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
    SPACE_BETWEEN: 'space-between',
  });
  const CROSS: Record<string, string> = Object.assign(Object.create(null), {
    MIN: 'flex-start',
    CENTER: 'center',
    MAX: 'flex-end',
    BASELINE: 'baseline',
  });
  if (node.primaryAxisAlignItems && MAIN[node.primaryAxisAlignItems]) {
    out.justifyContent = MAIN[node.primaryAxisAlignItems];
  }
  if (node.counterAxisAlignItems && CROSS[node.counterAxisAlignItems]) {
    out.alignItems = CROSS[node.counterAxisAlignItems];
  }
  if (node.layoutWrap === 'WRAP') out.flexWrap = 'wrap';
  return out;
}
