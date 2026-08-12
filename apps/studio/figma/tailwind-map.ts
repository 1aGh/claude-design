/**
 * @file       figma/tailwind-map.ts — Tailwind utility → JSX style object.
 * @scope      apps/studio/figma/tailwind-map.ts
 * @purpose    The half of the codegen route that is genuinely small: turn the
 *             class list Figma's generator emits into inline style declarations
 *             a Maude canvas renders natively.
 *
 * @rationale  Sized by a spike on a real 375×812 screen (`425:2939`, DDR-219
 *             § Spike): **1 276 class tokens · 129 distinct · 64 families**, and
 *             a throwaway mapper reached **129/129 with zero unmapped in ~155
 *             lines**. The plan's fear that "the arbitrary-value syntax is where
 *             it will get long" is real and FINITE. Every family in the table
 *             below was observed in that measurement; nothing here is
 *             speculative Tailwind coverage.
 *
 * @invariant  EVERY EMITTED VALUE PASSES `codegen-values.ts` FIRST. A utility
 *             whose value fails its grammar is DROPPED and REPORTED
 *             (`codegen-utility-unmapped`), never "cleaned up", never partially
 *             applied. This matters more here than in `import-tokens`: these
 *             declarations render live in the canvas iframe.
 *
 * @invariant  KEYS ARE camelCase, ALWAYS. These land in a JSX style OBJECT,
 *             where a hyphenated key is a syntax error that takes the whole
 *             canvas down — one gradient emitted as `background-image` was
 *             enough to make a whole page unparseable (DDR-216 D12's autopsy).
 *
 * @invariant  AN UNMAPPED UTILITY IS REPORTED, NEVER SILENTLY DROPPED. That is
 *             an acceptance criterion of this phase, and it is also the only way
 *             the table's coverage stays measurable as Figma's generator moves.
 *
 * @invariant  `Object.create(null)` FOR EVERY MAP INDEXED BY A PARSED STRING
 *             (D5 rule 5). A plain object literal returns a FUNCTION for the key
 *             `constructor`, which then stringifies into an emitted style value
 *             — the exact shape review F11 found in `style-map.ts`.
 *
 * @invariant  DEPENDENCY-FREE beyond `codegen-values.ts`, `codegen-fonts.ts` and
 *             `style-map.ts`'s pure `resolveColor`.
 */

import {
  type FontToken,
  resolveFontFamily,
  splitFamilyAndStyle,
  styleToWeight,
} from './codegen-fonts.ts';
import {
  cssPropToCamel,
  isAllowedArbitraryProperty,
  isCodegenColor,
  isCodegenKeyword,
  isCodegenLength,
  isCodegenLengthList,
  isCodegenNumber,
  isCodegenShortValueList,
  MAX_VALUE_LEN,
  normalizeCalc,
  unescapeArbitrary,
} from './codegen-values.ts';
import { type DsToken, resolveColor } from './style-map.ts';

/** A class list longer than this is not a design, it is a payload. */
export const MAX_CLASSES_PER_ELEMENT = 64;

export interface TailwindContext {
  /** DS colour tokens, so a bare hex can snap onto the project's palette. */
  tokens?: readonly DsToken[];
  /** DS type tokens, so a family resolves to the project's own stack. */
  fontTokens?: readonly FontToken[];
  threshold?: number;
}

export interface MappedClasses {
  /** camelCase CSS property → validated value. */
  declarations: Record<string, string>;
  /** Utilities this table does not know, or whose value failed its grammar. */
  unmapped: string[];
  /** Font families that did not survive the copy, for the T18 report. */
  substitutedFonts: string[];
}

/** Exact-match utilities. Keys are literals, so a plain frozen record is fine —
 *  the `Object.create(null)` rule bites on maps INDEXED by a parsed string, and
 *  this one is only ever probed with `Object.hasOwn`. */
const STATIC: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  // display
  flex: { display: 'flex' },
  'inline-flex': { display: 'inline-flex' },
  grid: { display: 'grid' },
  'inline-grid': { display: 'inline-grid' },
  block: { display: 'block' },
  'inline-block': { display: 'inline-block' },
  inline: { display: 'inline' },
  hidden: { display: 'none' },
  contents: { display: 'contents' },

  // flex / grid alignment
  'flex-col': { flexDirection: 'column' },
  'flex-row': { flexDirection: 'row' },
  'flex-wrap': { flexWrap: 'wrap' },
  'flex-nowrap': { flexWrap: 'nowrap' },
  'items-start': { alignItems: 'flex-start' },
  'items-center': { alignItems: 'center' },
  'items-end': { alignItems: 'flex-end' },
  'items-stretch': { alignItems: 'stretch' },
  'items-baseline': { alignItems: 'baseline' },
  'justify-start': { justifyContent: 'flex-start' },
  'justify-center': { justifyContent: 'center' },
  'justify-end': { justifyContent: 'flex-end' },
  'justify-between': { justifyContent: 'space-between' },
  'justify-around': { justifyContent: 'space-around' },
  'justify-evenly': { justifyContent: 'space-evenly' },
  // `content-stretch` is Figma's most-emitted class after `relative`.
  'content-stretch': { alignContent: 'stretch' },
  'content-start': { alignContent: 'flex-start' },
  'content-center': { alignContent: 'center' },
  'content-between': { alignContent: 'space-between' },
  'place-items-start': { placeItems: 'start' },
  'place-items-center': { placeItems: 'center' },
  'place-items-end': { placeItems: 'end' },
  'self-stretch': { alignSelf: 'stretch' },
  'self-start': { alignSelf: 'flex-start' },
  'self-center': { alignSelf: 'center' },
  'self-end': { alignSelf: 'flex-end' },
  'self-auto': { alignSelf: 'auto' },
  'shrink-0': { flexShrink: '0' },
  shrink: { flexShrink: '1' },
  'grow-0': { flexGrow: '0' },
  grow: { flexGrow: '1' },

  // position
  relative: { position: 'relative' },
  absolute: { position: 'absolute' },
  fixed: { position: 'fixed' },
  sticky: { position: 'sticky' },
  static: { position: 'static' },
  'inset-0': { inset: '0px' },

  // sizing
  'size-full': { width: '100%', height: '100%' },
  'w-full': { width: '100%' },
  'h-full': { height: '100%' },
  'w-auto': { width: 'auto' },
  'h-auto': { height: 'auto' },
  'w-0': { width: '0px' },
  'h-0': { height: '0px' },
  'max-w-none': { maxWidth: 'none' },
  'max-h-none': { maxHeight: 'none' },
  'max-w-full': { maxWidth: '100%' },
  'min-w-px': { minWidth: '1px' },
  'min-w-0': { minWidth: '0px' },
  'min-h-0': { minHeight: '0px' },

  // spacing shorthands Tailwind spells without a value
  'p-px': { padding: '1px' },
  'gap-px': { gap: '1px' },
  'mt-px': { marginTop: '1px' },
  'm-0': { margin: '0px' },
  'mt-0': { marginTop: '0px' },
  'mr-0': { marginRight: '0px' },
  'mb-0': { marginBottom: '0px' },
  'ml-0': { marginLeft: '0px' },
  'p-0': { padding: '0px' },

  // border
  border: { borderWidth: '1px', borderStyle: 'solid' },
  'border-0': { borderWidth: '0px' },
  'border-2': { borderWidth: '2px', borderStyle: 'solid' },
  'border-t': { borderTopWidth: '1px', borderTopStyle: 'solid' },
  'border-r': { borderRightWidth: '1px', borderRightStyle: 'solid' },
  'border-b': { borderBottomWidth: '1px', borderBottomStyle: 'solid' },
  'border-l': { borderLeftWidth: '1px', borderLeftStyle: 'solid' },
  'border-solid': { borderStyle: 'solid' },
  'border-dashed': { borderStyle: 'dashed' },
  'border-dotted': { borderStyle: 'dotted' },
  'border-none': { borderStyle: 'none' },
  'rounded-full': { borderRadius: '9999px' },
  'rounded-none': { borderRadius: '0px' },

  // overflow
  'overflow-clip': { overflow: 'clip' },
  'overflow-hidden': { overflow: 'hidden' },
  'overflow-auto': { overflow: 'auto' },
  'overflow-scroll': { overflow: 'scroll' },
  'overflow-visible': { overflow: 'visible' },

  // typography
  'text-left': { textAlign: 'left' },
  'text-center': { textAlign: 'center' },
  'text-right': { textAlign: 'right' },
  'text-justify': { textAlign: 'justify' },
  italic: { fontStyle: 'italic' },
  'not-italic': { fontStyle: 'normal' },
  'font-thin': { fontWeight: '100' },
  'font-extralight': { fontWeight: '200' },
  'font-light': { fontWeight: '300' },
  'font-normal': { fontWeight: '400' },
  'font-medium': { fontWeight: '500' },
  'font-semibold': { fontWeight: '600' },
  'font-bold': { fontWeight: '700' },
  'font-extrabold': { fontWeight: '800' },
  'font-black': { fontWeight: '900' },
  'whitespace-nowrap': { whiteSpace: 'nowrap' },
  'whitespace-normal': { whiteSpace: 'normal' },
  'whitespace-pre': { whiteSpace: 'pre' },
  'whitespace-pre-wrap': { whiteSpace: 'pre-wrap' },
  underline: { textDecoration: 'underline' },
  'line-through': { textDecoration: 'line-through' },
  'no-underline': { textDecoration: 'none' },
  uppercase: { textTransform: 'uppercase' },
  lowercase: { textTransform: 'lowercase' },
  capitalize: { textTransform: 'capitalize' },
  'normal-case': { textTransform: 'none' },
  'leading-normal': { lineHeight: 'normal' },
  'leading-none': { lineHeight: '1' },
  truncate: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // half-position shorthands
  'top-1/2': { top: '50%' },
  'left-1/2': { left: '50%' },
  'right-1/2': { right: '50%' },
  'bottom-1/2': { bottom: '50%' },

  // named colours Figma reaches for
  'bg-white': { background: '#ffffff' },
  'bg-black': { background: '#000000' },
  'bg-transparent': { background: 'transparent' },
  'text-white': { color: '#ffffff' },
  'text-black': { color: '#000000' },
  'border-white': { borderColor: '#ffffff' },
  'border-black': { borderColor: '#000000' },
});

/** Transform utilities compose into ONE `transform`, so they are collected
 *  rather than written straight into the declaration map. */
const TRANSFORMS: Readonly<Record<string, string>> = Object.freeze({
  '-translate-x-1/2': 'translateX(-50%)',
  '-translate-y-1/2': 'translateY(-50%)',
  'translate-x-1/2': 'translateX(50%)',
  'translate-y-1/2': 'translateY(50%)',
  '-rotate-180': 'rotate(-180deg)',
  'rotate-180': 'rotate(180deg)',
  '-scale-x-100': 'scaleX(-1)',
  '-scale-y-100': 'scaleY(-1)',
});

/** `p`/`px`/`m`/`gap`/… → the property (or properties) they set. */
const SPACING_PROPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  p: ['padding'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  pt: ['paddingTop'],
  pr: ['paddingRight'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
  m: ['margin'],
  mx: ['marginLeft', 'marginRight'],
  my: ['marginTop', 'marginBottom'],
  mt: ['marginTop'],
  mr: ['marginRight'],
  mb: ['marginBottom'],
  ml: ['marginLeft'],
  gap: ['gap'],
  'gap-x': ['columnGap'],
  'gap-y': ['rowGap'],
  top: ['top'],
  right: ['right'],
  bottom: ['bottom'],
  left: ['left'],
  w: ['width'],
  h: ['height'],
  'min-w': ['minWidth'],
  'min-h': ['minHeight'],
  'max-w': ['maxWidth'],
  'max-h': ['maxHeight'],
  'inset-x': ['left', 'right'],
  'inset-y': ['top', 'bottom'],
});

/** Tailwind's spacing scale step, for the numeric (non-arbitrary) forms. */
const SCALE_REM = 0.25;

/**
 * Pull `family-name:` / `color:` / `length:` off an arbitrary value. Tailwind
 * uses these hints to disambiguate exactly what we have to disambiguate.
 */
function splitHint(value: string): { hint: string | null; value: string } {
  const m = /^([a-z-]{1,16}):([\s\S]*)$/.exec(value);
  // A bare `var(--x)` and a `data:` URL both contain a colon; only a KNOWN hint
  // counts, everything else is part of the value.
  if (m && (m[1] === 'color' || m[1] === 'family-name' || m[1] === 'length')) {
    return { hint: m[1], value: m[2] };
  }
  return { hint: null, value };
}

/** A colour that snaps onto the DS palette when it is a bare literal. */
function colorValue(raw: string, ctx: TailwindContext): string | null {
  if (!isCodegenColor(raw)) return null;
  // Only a LITERAL hex is a candidate for snapping. A `var()` Figma resolved for
  // us is already the design's own variable — replacing it with our nearest
  // token would be a downgrade, not a normalization.
  if (/^#[0-9a-fA-F]{6}$/.test(raw) && ctx.tokens && ctx.tokens.length > 0) {
    const resolved = resolveColor(raw.toLowerCase(), ctx.tokens, ctx.threshold);
    return resolved.value;
  }
  return raw;
}

/**
 * Map ONE utility. Returns `null` when the table does not know it or its value
 * fails a grammar — the caller reports that, it is never swallowed here.
 */
function mapOne(
  cls: string,
  ctx: TailwindContext,
  out: Record<string, string>,
  transforms: string[],
  fonts: string[]
): boolean {
  if (Object.hasOwn(STATIC, cls)) {
    Object.assign(out, STATIC[cls]);
    return true;
  }
  if (Object.hasOwn(TRANSFORMS, cls)) {
    transforms.push(TRANSFORMS[cls]);
    return true;
  }

  // ── Arbitrary PROPERTY: `[word-break:break-word]` ──
  if (cls.startsWith('[') && cls.endsWith(']')) {
    const body = unescapeArbitrary(cls.slice(1, -1));
    const colon = body.indexOf(':');
    if (colon < 0) return false;
    const prop = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();
    if (!isAllowedArbitraryProperty(prop)) return false;
    if (
      !isCodegenKeyword(value) &&
      !isCodegenLength(value) &&
      !isCodegenNumber(value) &&
      !isCodegenShortValueList(value)
    ) {
      return false;
    }
    out[cssPropToCamel(prop)] = value;
    return true;
  }

  const bracket = /^(-?[a-z-]{1,16})-\[([\s\S]{1,240})\]$/.exec(cls);
  const arbitrary = bracket
    ? { family: bracket[1], raw: normalizeCalc(unescapeArbitrary(bracket[2])) }
    : null;
  if (arbitrary && arbitrary.raw.length > MAX_VALUE_LEN) return false;

  const plain = /^(-?[a-z-]{1,16})-([a-z0-9./]{1,24})$/.exec(cls);
  const family = arbitrary?.family ?? plain?.[1] ?? null;
  if (!family) return false;

  // ── Families whose value is a COLOUR ──
  if (family === 'bg' || family === 'text' || family === 'border' || family === 'fill') {
    const { hint, value } = splitHint(arbitrary?.raw ?? plain?.[2] ?? '');
    // `text-[16px]` is a FONT SIZE and `text-[#0f161e]` is a COLOUR — the same
    // family, disambiguated by the value. Tailwind's own `color:` hint wins when
    // present, which is what Figma emits for `text-[color:var(--black,#0f161e)]`.
    if (family === 'text' && hint !== 'color' && isCodegenLength(value, 512)) {
      out.fontSize = value;
      return true;
    }
    if (family === 'border' && hint !== 'color' && isCodegenLength(value, 64)) {
      out.borderWidth = value;
      out.borderStyle ??= 'solid';
      return true;
    }
    const resolved = colorValue(value, ctx);
    if (resolved === null) return false;
    if (family === 'bg') out.background = resolved;
    else if (family === 'text') out.color = resolved;
    else if (family === 'fill') out.fill = resolved;
    else out.borderColor = resolved;
    return true;
  }

  // ── FONT FAMILY (T18) ──
  if (family === 'font' && arbitrary) {
    const { value } = splitHint(arbitrary.raw);
    // Figma wraps the family in quotes inside the bracket and may hand it to us
    // through a `var()` with the literal as the fallback.
    const inner = /^var\(--[a-z0-9-]{1,64},\s*'?([^')]{1,64})'?\)$/.exec(value);
    const literal = (inner ? inner[1] : value).replace(/^['"]|['"]$/g, '');
    const res = resolveFontFamily(literal, ctx.fontTokens ?? []);
    out.fontFamily = res.css;
    // Figma packs the WEIGHT into the family (`SF_Pro:Bold`) and *usually* also
    // emits `font-bold` alongside it. Only fill the gap — an explicit weight
    // utility, before or after, must win, because it is the one Figma computed.
    const weight = styleToWeight(splitFamilyAndStyle(literal).style);
    if (weight !== null && out.fontWeight === undefined) out.fontWeight = String(weight);
    if (res.substituted) fonts.push(res.requested);
    return true;
  }

  // ── Everything measured that takes a length / list / number ──
  const value = arbitrary?.raw ?? null;
  // `-ml-[26px]` — Tailwind spells a negative utility with a LEADING hyphen, so
  // the sign lives on the family, not on the value.
  const negative = family.startsWith('-');
  const bare = negative ? family.slice(1) : family;
  if (Object.hasOwn(SPACING_PROPS, bare)) {
    const props = SPACING_PROPS[bare];
    if (value !== null) {
      if (!isCodegenLength(value)) return false;
      for (const p of props) out[p] = negative ? `-${value}` : value;
      return true;
    }
    const n = Number.parseFloat(plain?.[2] ?? '');
    if (!Number.isFinite(n) || Math.abs(n) > 400) return false;
    for (const p of props) out[p] = `${(negative ? -n : n) * SCALE_REM}rem`;
    return true;
  }

  if (family === 'size' && value !== null) {
    if (!isCodegenLength(value)) return false;
    out.width = value;
    out.height = value;
    return true;
  }
  if (family === 'inset' && value !== null) {
    if (!isCodegenLengthList(value)) return false;
    out.inset = value;
    return true;
  }
  if (family === 'rounded' && value !== null) {
    // 9999, not 512: `rounded-[999px]` is the pill idiom and it is everywhere in
    // real files. A radius cannot hang a layout the way a width can, so the
    // bound here is about absurdity, not about safety.
    if (!isCodegenLengthList(value, 9999)) return false;
    out.borderRadius = value;
    return true;
  }
  if (family === 'leading') {
    const v = value ?? plain?.[2] ?? '';
    if (isCodegenNumber(v, 1000)) {
      // `leading-[0]` is Figma's "the line box is the glyph box" idiom. Emitted
      // verbatim it collapses the line to zero height and the text disappears —
      // measured, and exactly the invisible-content class D6b exists to close.
      out.lineHeight = v === '0' ? 'normal' : v;
      return true;
    }
    if (isCodegenLength(v, 512) || isCodegenKeyword(v)) {
      out.lineHeight = v;
      return true;
    }
    return false;
  }
  if (family === 'tracking' && value !== null) {
    if (!isCodegenLength(value, 64)) return false;
    out.letterSpacing = value;
    return true;
  }
  if (family === 'flex' && value !== null) {
    if (!isCodegenShortValueList(value)) return false;
    out.flex = value;
    return true;
  }
  if ((family === 'grid-cols' || family === 'grid-rows') && value !== null) {
    if (!isCodegenShortValueList(value)) return false;
    out[family === 'grid-cols' ? 'gridTemplateColumns' : 'gridTemplateRows'] = value;
    return true;
  }
  if (family === 'col' || family === 'row') {
    const v = value ?? plain?.[2] ?? '';
    if (!isCodegenNumber(v, 64) && !isCodegenKeyword(v)) return false;
    out[family === 'col' ? 'gridColumn' : 'gridRow'] = v;
    return true;
  }
  if (family === 'opacity') {
    const v = value ?? plain?.[2] ?? '';
    if (!isCodegenNumber(v, 100)) return false;
    const n = Number.parseFloat(v);
    // D6b's spirit: an opacity low enough to hide the subtree is a hiding
    // mechanism, not a design. Clamped rather than reproduced.
    out.opacity = String(Math.max(0.15, value !== null ? n : n / 100));
    return true;
  }
  if (family === 'z') {
    const v = value ?? plain?.[2] ?? '';
    if (!isCodegenNumber(v, 9999)) return false;
    out.zIndex = v;
    return true;
  }
  if (family === 'aspect' && value !== null) {
    if (!isCodegenShortValueList(value)) return false;
    out.aspectRatio = value;
    return true;
  }
  return false;
}

/**
 * Map a whole `className` string.
 *
 * Order matters only for `transform`, which composes; everything else is
 * last-wins, which is also how the cascade would have resolved it.
 */
export function mapClassName(classList: string, ctx: TailwindContext = {}): MappedClasses {
  const declarations: Record<string, string> = {};
  const unmapped: string[] = [];
  const substitutedFonts: string[] = [];
  const transforms: string[] = [];

  const classes = classList.trim().split(/\s+/).filter(Boolean);
  for (const cls of classes.slice(0, MAX_CLASSES_PER_ELEMENT)) {
    if (cls.length > MAX_VALUE_LEN + 32) {
      unmapped.push('oversized');
      continue;
    }
    if (!mapOne(cls, ctx, declarations, transforms, substitutedFonts)) unmapped.push(cls);
  }
  if (classes.length > MAX_CLASSES_PER_ELEMENT) unmapped.push('class-cap-reached');
  if (transforms.length > 0) declarations.transform = transforms.join(' ');

  return { declarations, unmapped, substitutedFonts };
}
