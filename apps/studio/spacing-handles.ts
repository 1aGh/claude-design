/**
 * @file       spacing-handles.ts — Stage J (feature-element-editing-robustness)
 * @purpose    Pure geometry + value math for the on-canvas padding + gap drag
 *             overlay. Framework-free (unit-testable without a DOM), mirroring
 *             `equal-spacing-detector.ts`'s screen-coordinate midpoint shape so
 *             the two spacing affordances (read-only equal-spacing dots vs this
 *             draggable padding/gap overlay) share a visual vocabulary.
 *
 *             Padding: 4 edge lines inset from the element's screen border-box by
 *             its resolved padding × zoom, one per side, each carrying a drag axis
 *             (top/bottom = vertical, left/right = horizontal).
 *             Gap: midpoints between consecutive DIRECT children along the flex
 *             main axis (row → x, column → y) — flex-only in v1; CSS-Grid gap
 *             editing is deferred to `feature-grid-track-editor.md` (Stage M3).
 */

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PaddingSide = 'top' | 'right' | 'bottom' | 'left';

export interface PaddingLine {
  side: PaddingSide;
  /** Drag axis: top/bottom edges scrub vertically, left/right horizontally. */
  axis: 'x' | 'y';
  /** Line midpoint in screen coords (the handle's paint position). */
  x: number;
  y: number;
  /** Line length in screen px (spans the box's inner width/height on that side). */
  length: number;
}

/**
 * Compute the 4 padding-edge handle positions from the element's screen
 * border-box rect + its resolved padding (WORLD px, pre-zoom) + the render
 * zoom. A handle sits at the midpoint of its edge, INSET from the border by
 * `padding × zoom` — i.e. right on the padding/content boundary, so dragging it
 * outward (toward the border) shrinks padding, inward (toward center) grows it.
 */
export function computePaddingLines(
  rect: ScreenRect,
  padding: { top: number; right: number; bottom: number; left: number },
  zoom: number
): PaddingLine[] {
  const z = zoom > 0 ? zoom : 1;
  const pt = padding.top * z;
  const pr = padding.right * z;
  const pb = padding.bottom * z;
  const pl = padding.left * z;
  return [
    { side: 'top', axis: 'y', x: rect.x + rect.w / 2, y: rect.y + pt, length: rect.w - pl - pr },
    {
      side: 'right',
      axis: 'x',
      x: rect.x + rect.w - pr,
      y: rect.y + rect.h / 2,
      length: rect.h - pt - pb,
    },
    {
      side: 'bottom',
      axis: 'y',
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h - pb,
      length: rect.w - pl - pr,
    },
    { side: 'left', axis: 'x', x: rect.x + pl, y: rect.y + rect.h / 2, length: rect.h - pt - pb },
  ];
}

/**
 * New padding value (WORLD px, clamped ≥ 0) for a drag on `side`, given the
 * screen-space cursor delta and the render zoom. Top/bottom respond to
 * vertical delta, left/right to horizontal — and the SIGN flips for
 * bottom/right (dragging toward the element's center — up for bottom, left for
 * right — GROWS that side's padding, mirroring how top/left already grow when
 * dragged down/right).
 */
export function computePaddingDrag(
  side: PaddingSide,
  startValue: number,
  dxScreen: number,
  dyScreen: number,
  zoom: number
): number {
  const z = zoom > 0 ? zoom : 1;
  const d = side === 'top' || side === 'bottom' ? dyScreen / z : dxScreen / z;
  const signed = side === 'bottom' || side === 'right' ? -d : d;
  return Math.max(0, round2(startValue + signed));
}

export type FlexAxis = 'x' | 'y';

/** Row/row-reverse → x (horizontal main axis); column/column-reverse → y. */
export function flexMainAxis(flexDirection: string | null | undefined): FlexAxis {
  const dir = (flexDirection || 'row').trim();
  return dir.startsWith('column') ? 'y' : 'x';
}

/**
 * Midpoints between consecutive DIRECT children's screen rects, along `axis`.
 * Mirrors `detectEqualSpacing`'s midpoint shape but needs no equal-spacing
 * DETECTION (there's exactly one `gap` value to visualize, not several to
 * confirm) — just the geometric midpoint of each adjacent pair's facing edges.
 * Fewer than 2 children → no gaps to show.
 */
export function computeGapMidpoints(
  childRects: ScreenRect[],
  axis: FlexAxis
): Array<{ x: number; y: number }> {
  if (childRects.length < 2) return [];
  const sorted = [...childRects].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] as ScreenRect;
    const b = sorted[i + 1] as ScreenRect;
    if (axis === 'x') {
      out.push({ x: (a.x + a.w + b.x) / 2, y: a.y + a.h / 2 });
    } else {
      out.push({ x: a.x + a.w / 2, y: (a.y + a.h + b.y) / 2 });
    }
  }
  return out;
}

/** New `gap` value (WORLD px, clamped ≥ 0) for a drag along `axis`. Gap is a
 *  single shared CSS value, so every handle drags the SAME number 1:1 with the
 *  cursor (no doubling/halving — dragging a handle N screen px outward should
 *  feel like N world px of extra breathing room). */
export function computeGapDrag(
  axis: FlexAxis,
  startValue: number,
  dxScreen: number,
  dyScreen: number,
  zoom: number
): number {
  const z = zoom > 0 ? zoom : 1;
  const d = axis === 'x' ? dxScreen / z : dyScreen / z;
  return Math.max(0, round2(startValue + d));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Which padding sides a drag on `side` touches, given the held modifiers —
 * matches the CSS-panel box-model widget's OWN scrub grammar exactly (`side()`
 * in `client/app.jsx`, `title="drag to scrub · alt = symmetric · alt+shift =
 * all sides"`): plain drag = just this side; Alt = the symmetric axis PAIR
 * (top+bottom, or left+right); Alt+Shift = all four. Every touched side is set
 * to the SAME value (not each grown by its own delta) — same semantics as the
 * panel's `sidesFor`/`last` write.
 */
export function paddingSideSet(
  side: PaddingSide,
  altKey: boolean,
  shiftKey: boolean
): PaddingSide[] {
  if (altKey && shiftKey) return ['top', 'right', 'bottom', 'left'];
  if (altKey) return side === 'top' || side === 'bottom' ? ['top', 'bottom'] : ['left', 'right'];
  return [side];
}
