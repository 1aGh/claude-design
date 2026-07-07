/**
 * @file sizing-mode.ts
 * @purpose Pure Fixed / Hug / Fill sizing-mode logic for the CssKnobs Size
 *          control (feature-element-editing-robustness Stage M1). Kept framework-
 *          free + in a .ts file so it's unit-testable (app.jsx is bundled JSX).
 *
 * Figma auto-layout parity: a per-axis Fixed / Hug / Fill mode is the single
 * biggest source of layout-behaviour clarity for React/flexbox mockups.
 *   - Fixed = an explicit width/height value.
 *   - Hug   = shrink to children (`fit-content`).
 *   - Fill  = stretch to fill the parent — and the CORRECT CSS depends on the
 *             parent's layout: a flex child fills its MAIN axis via `flex-grow`,
 *             its CROSS axis via `align-self: stretch`; a block/grid child fills
 *             via `width/height: 100%`. So the mode must know the parent context
 *             (captured at selection time in Selection.parentDisplay /
 *             .parentFlexDirection — the shell can't reach the iframe later).
 */

export type SizeAxis = 'width' | 'height';
export type SizeMode = 'fixed' | 'hug' | 'fill';

export interface ParentLayout {
  display?: string;
  flexDirection?: string;
}

const HUG_VALUES = new Set(['fit-content', 'max-content', 'min-content']);
const FILL_VALUES = new Set(['100%', 'fill', '-webkit-fill-available', 'stretch']);

function parentIsFlex(p: ParentLayout | undefined): boolean {
  const d = (p?.display || '').trim();
  return d === 'flex' || d === 'inline-flex';
}

/** True when `axis` is the flex MAIN axis of the parent (row → width, column → height). */
export function isMainAxis(axis: SizeAxis, p: ParentLayout | undefined): boolean {
  const dir = (p?.flexDirection || 'row').trim();
  const rowMain = dir.startsWith('row'); // row / row-reverse
  return rowMain ? axis === 'width' : axis === 'height';
}

/**
 * Best-effort classification of the current sizing mode for the segmented
 * control's active-state highlight. Reads AUTHORED values first (what the user
 * set), so a value the panel wrote round-trips; defaults to `fixed`. Detection is
 * advisory — the WRITE side (`sizingModePatch`) is what must be deterministic.
 */
export function sizingModeOf(
  axis: SizeAxis,
  authored: Record<string, string> = {},
  _computed: Record<string, string> = {},
  parent?: ParentLayout
): SizeMode {
  const a = (authored[axis] || '').trim().toLowerCase();
  if (HUG_VALUES.has(a)) return 'hug';
  if (FILL_VALUES.has(a)) return 'fill';
  if (parentIsFlex(parent)) {
    const main = isMainAxis(axis, parent);
    if (main && Number.parseFloat(authored['flex-grow'] || '0') >= 1) return 'fill';
    if (!main && (authored['align-self'] || '').trim() === 'stretch') return 'fill';
  }
  // A numeric authored value (px/rem/%…) or nothing authored → Fixed.
  return 'fixed';
}

export interface SizingPatch {
  /** Properties to write (in order), each `[prop, value]`. */
  set: Array<[string, string]>;
  /** Fill-specific properties to REMOVE so a prior Fill doesn't linger. */
  reset: string[];
}

/**
 * The deterministic CSS writes for switching `axis` to `mode`. `currentPx` seeds
 * the Fixed value (the element's current rendered size). Fill is context-aware:
 * a flex child fills its main axis via `flex-grow:1` + `flex-basis:0%`, its cross
 * axis via `align-self:stretch`; a block/grid child via `<axis>: 100%`.
 */
export function sizingModePatch(
  axis: SizeAxis,
  mode: SizeMode,
  parent: ParentLayout | undefined,
  currentPx: number
): SizingPatch {
  const flex = parentIsFlex(parent);
  const main = isMainAxis(axis, parent);
  // Which fill-specific props a non-fill mode must clear so the old Fill doesn't linger.
  const fillProps = flex ? (main ? ['flex-grow', 'flex-basis'] : ['align-self']) : [];
  if (mode === 'fixed') {
    const px = Number.isFinite(currentPx) && currentPx > 0 ? Math.round(currentPx) : 0;
    return { set: [[axis, `${px}px`]], reset: fillProps };
  }
  if (mode === 'hug') {
    return { set: [[axis, 'fit-content']], reset: fillProps };
  }
  // fill
  if (flex) {
    if (main) {
      return {
        set: [
          ['flex-grow', '1'],
          ['flex-basis', '0%'],
          [axis, 'auto'],
        ],
        reset: [],
      };
    }
    return {
      set: [
        ['align-self', 'stretch'],
        [axis, 'auto'],
      ],
      reset: [],
    };
  }
  return { set: [[axis, '100%']], reset: [] };
}
