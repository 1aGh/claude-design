/**
 * @file       figma/codegen-values.ts — the CODEGEN LANE's value grammar (DDR-219 D5 rule 7).
 * @scope      apps/studio/figma/codegen-values.ts
 * @purpose    Decide what a Tailwind arbitrary value is allowed to become in an
 *             emitted style object — for THIS lane only.
 *
 * @invariant  NOTHING SHARED IS WIDENED. `style-map.ts`'s `VAR_RE` rejects a
 *             `var()` with a fallback — i.e. every `var(--black,#0f161e)` this
 *             route exists to preserve. The fix is NOT to loosen it: that
 *             constant is shared with the tree translator AND with DDR-172's
 *             token importer, and "widen a shared grammar to satisfy a new
 *             caller" is verbatim the root pattern the DDR-216 review named
 *             twice. This module COMPOSES the exported predicates
 *             (`isValidColorValue`, `isValidDimension`) and adds the lane's own
 *             admissions on top.
 *
 * @invariant  A FALLBACK-BEARING `var()` IS ADMITTED, DELIBERATELY. It is the
 *             fidelity this route exists for — Figma resolves its own design
 *             variables and hands them over with a literal fallback. Admitted
 *             under a strict shape: the custom-property NAME is charset-bounded
 *             and the FALLBACK must itself pass the colour grammar.
 *
 * @invariant  ReDoS DISCIPLINE (DDR-172 Decision 4, carried into this lane by
 *             D5 rule 6): printable-ASCII pre-filter first, no `m`/`s` flags,
 *             bounded quantifiers, and no construct where two adjacent parts can
 *             match the same empty input. Tailwind's bracket syntax is unbounded
 *             free-text capture wearing a utility name, so the pre-filter and
 *             the length bound do most of the work before any grammar runs.
 *
 * @invariant  MAGNITUDE, NOT ONLY SHAPE. A grammar-valid `99999999px` is a
 *             live-render hang vector in a canvas iframe even though its shape
 *             is fine — every numeric admission is paired with a bound.
 *
 * @invariant  DEPENDENCY-FREE beyond `style-map.ts`'s pure predicates.
 */

import { isValidColorValue, isValidDimension } from './style-map.ts';

/** Longest arbitrary value we will even look at. Measured longest real one is
 *  `inset-[37.5%_18.75%_26.56%_18.75%]` at 33 chars; 160 is generous. */
export const MAX_VALUE_LEN = 160;

const PRINTABLE_ASCII_RE = /^[\x20-\x7E]*$/;

/** A CSS custom-property name. Same charset the shared `VAR_RE` uses — the
 *  difference here is only that a FALLBACK may follow, never a looser name. */
const CUSTOM_PROP_RE = /^--[a-z0-9-]{1,64}$/;

/** `1 0 0`, `max-content`, `min-content`, `auto`, `none`, `normal`, `break-word`… */
const KEYWORD_RE = /^[a-z][a-z-]{0,31}$/;

/** Bounds. Layout numbers in a canvas are px-scale; nothing legitimate is huge. */
const DIM_MAX = 8192;
const UNITLESS_MAX = 10_000;

function printableAscii(v: string): boolean {
  return v.length <= MAX_VALUE_LEN && PRINTABLE_ASCII_RE.test(v);
}

/**
 * Tailwind escapes a space as `_` inside an arbitrary value, so
 * `inset-[0_4.17%]` is `inset: 0 4.17%` and `font-['SF_Pro:Bold']` is
 * `SF Pro:Bold`. `\_` is a literal underscore and is preserved.
 */
export function unescapeArbitrary(raw: string): string {
  // ONE pass with a replacer rather than a sentinel round-trip: a sentinel is a
  // character that must be impossible in the input, and "impossible" is the kind
  // of assumption this lane is not allowed to make about a third-party string.
  return raw.replace(/\\_|_/g, (m) => (m === '\\_' ? '_' : ' '));
}

/**
 * Figma emits `calc(50%-32.5px)` — no spaces. That is INVALID CSS (a `-` with no
 * surrounding whitespace is part of the number, not an operator), so a
 * pass-through would silently produce a declaration the browser drops. Tailwind's
 * own pipeline re-spaces it; so do we, before the grammar runs.
 *
 * Only a `+`/`-` that sits BETWEEN two operands is touched — a leading sign is
 * left alone.
 */
export function normalizeCalc(v: string): string {
  if (!v.includes('calc(')) return v;
  // A LINEAR SCAN, not a regex. The naive `(?<=[\w%)])([-+])(?=[\d.(])` version
  // was wrong in a way that only showed up on a real value: it rewrote
  // `var(--black-10,…)` into `var(--black - 10,…)`, because a hyphen inside a
  // custom-property NAME looks exactly like a subtraction operator. The fix is
  // context, and context is a stack — which is also ReDoS-free by construction.
  const out: string[] = [];
  /** Innermost function name, so `var(` nested inside `calc(` is left alone. */
  const fnStack: string[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const ch = v[i];
    if (ch === '(') {
      const m = /([a-z-]{1,16})$/i.exec(v.slice(0, i));
      fnStack.push(m ? m[1].toLowerCase() : '');
      out.push(ch);
      continue;
    }
    if (ch === ')') {
      fnStack.pop();
      out.push(ch);
      continue;
    }
    const inCalc = fnStack[fnStack.length - 1] === 'calc';
    if (inCalc && (ch === '-' || ch === '+')) {
      const prev = v[i - 1] ?? '';
      const next = v[i + 1] ?? '';
      // An operator sits between two operands. A leading sign has no operand to
      // its left; `e` is excluded so `1e-5` keeps its exponent.
      const prevIsOperand = /[\d%)a-df-z]/i.test(prev);
      if (prevIsOperand && /[\d.(]/.test(next)) {
        out.push(' ', ch, ' ');
        continue;
      }
    }
    out.push(ch);
  }
  return out.join('');
}

/** One `calc()` term: an optionally-signed bounded number with an optional unit. */
const CALC_TERM = '-?\\d{1,7}(?:\\.\\d{1,6})?(?:px|%|rem|em|vw|vh)?';
/** `calc(a op b op c …)`, at most 8 terms. Written so no two adjacent parts can
 *  match empty — the property that keeps a bounded quantifier from backtracking. */
const CALC_RE = new RegExp(`^calc\\(\\s*${CALC_TERM}(?:\\s*[-+*/]\\s*${CALC_TERM}){0,7}\\s*\\)$`);

/** A single length: what the shared grammar admits, plus viewport units and calc. */
export function isCodegenLength(v: string, max = DIM_MAX): boolean {
  if (!printableAscii(v)) return false;
  if (v === '0' || v === 'auto' || v === 'none') return true;
  if (isValidDimension(v, max)) return true;
  const vw = /^(-?\d{1,7}(?:\.\d{1,6})?)(vw|vh)$/.exec(v);
  if (vw) return Math.abs(Number.parseFloat(vw[1])) <= max;
  return CALC_RE.test(v);
}

/**
 * A shorthand of 1–4 lengths (`inset`, `padding`, `margin`). Split-then-validate
 * rather than one composite regex: the parts are already bounded individually,
 * and a composite would be the exact nested-quantifier shape D5 rule 6 bans.
 */
export function isCodegenLengthList(v: string, max = DIM_MAX): boolean {
  if (!printableAscii(v)) return false;
  const parts = v.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 4) return false;
  return parts.every((p) => isCodegenLength(p, max));
}

/**
 * Split `var(--name, fallback)` without a nested-quantifier regex: find the
 * first comma at depth 1. Returns `null` when the string is not a `var()` at all.
 */
export function splitVar(v: string): { name: string; fallback: string | null } | null {
  if (!v.startsWith('var(') || !v.endsWith(')')) return null;
  const inner = v.slice(4, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      return { name: inner.slice(0, i).trim(), fallback: inner.slice(i + 1).trim() };
    }
  }
  return { name: inner.trim(), fallback: null };
}

/**
 * A colour for this lane: everything the shared grammar admits, PLUS a `var()`
 * carrying a fallback, PLUS the handful of bare keywords Tailwind emits.
 *
 * The fallback is validated as a colour in its own right, so
 * `var(--x,url(https://attacker/))` is rejected here rather than relying on the
 * canvas CSP to refuse the fetch. (The CSP — `default-src 'none'`,
 * `img-src 'self' data: blob:` — WOULD block it, which is why the blast radius
 * of a grammar gap in this lane is spoofing rather than beaconing. That bounds
 * the damage; it does not make the grammar sound, so the grammar is sound.)
 */
export function isCodegenColor(v: string, depth = 0): boolean {
  // A `var()` fallback may itself be a `var()`. Bounded explicitly rather than
  // relying on the 160-char length cap to run out first — a recursion whose
  // termination is an accident of another constant is one edit from unbounded.
  if (depth > 4) return false;
  if (!printableAscii(v)) return false;
  if (v === 'transparent' || v === 'currentColor' || v === 'inherit') return true;
  if (isValidColorValue(v)) return true;
  const parsed = splitVar(v);
  if (!parsed) return NAMED_COLOR_SET.has(v);
  if (!CUSTOM_PROP_RE.test(parsed.name)) return false;
  if (parsed.fallback === null) return true;
  return isCodegenColor(parsed.fallback, depth + 1);
}

/**
 * The CSS named colours Figma's generator actually reaches for. Deliberately a
 * short allowlist rather than the full 148-name table: a name is a value
 * position, and the shorter the admitted vocabulary the smaller the surface.
 */
const NAMED_COLOR_SET: ReadonlySet<string> = new Set([
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'silver',
  'transparent',
]);

/** A unitless number (`opacity`, `z-index`, `flex-grow`, `line-height`). */
export function isCodegenNumber(v: string, max = UNITLESS_MAX): boolean {
  if (!printableAscii(v)) return false;
  if (!/^-?\d{1,7}(?:\.\d{1,6})?$/.test(v)) return false;
  return Math.abs(Number.parseFloat(v)) <= max;
}

/** A bare keyword value (`max-content`, `break-word`, `nowrap`, `normal`). */
export function isCodegenKeyword(v: string): boolean {
  return printableAscii(v) && KEYWORD_RE.test(v);
}

/**
 * `flex: 1 0 0`, `grid-template-columns: max-content`, and friends: a short
 * sequence of numbers, lengths and keywords. Never a `url()`, never a function
 * this module has not admitted by name.
 */
export function isCodegenShortValueList(v: string): boolean {
  if (!printableAscii(v)) return false;
  const parts = v.trim().split(/\s+/);
  if (parts.length === 0 || parts.length > 6) return false;
  return parts.every(
    (p) => isCodegenNumber(p) || isCodegenLength(p) || isCodegenKeyword(p) || /^\d+fr$/.test(p)
  );
}

/**
 * Properties an ARBITRARY-PROPERTY utility (`[word-break:break-word]`) may set.
 *
 * An allowlist, never a denylist (D5 rule 3): the bracket syntax is a hole
 * straight into the style object, and a denylist has to remember `behavior`,
 * `-moz-binding`, `content` and whatever the next engine ships.
 */
const ARBITRARY_PROPERTY_ALLOWLIST: ReadonlySet<string> = new Set([
  'word-break',
  'overflow-wrap',
  'white-space',
  'text-wrap',
  'font-variation-settings',
  'font-feature-settings',
  'text-overflow',
  'letter-spacing',
  'line-height',
  'vertical-align',
  'mix-blend-mode',
  'object-fit',
  'object-position',
  'aspect-ratio',
]);

export function isAllowedArbitraryProperty(prop: string): boolean {
  return ARBITRARY_PROPERTY_ALLOWLIST.has(prop);
}

/** `word-break` → `wordBreak`. Emitted style objects are JSX, and a hyphenated
 *  key in a style OBJECT is a syntax error that takes the whole canvas down —
 *  the exact defect that made one gradient unparse a whole page (DDR-216 D12). */
export function cssPropToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
