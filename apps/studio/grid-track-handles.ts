/**
 * @file       grid-track-handles.ts — feature-3-web-artboards T5 (absorbed
 *             feature-grid-track-editor stub).
 * @purpose    Pure geometry + value math for the on-canvas grid gutter
 *             drag-resize overlay. Framework-free (unit-testable without a
 *             DOM), mirroring `spacing-handles.ts`'s shape exactly — this is
 *             the CSS-Grid sibling of that flex/box-model module, deferred
 *             there in a doc comment ("CSS-Grid gap editing is out of v1
 *             scope — grid tracks are a separate follow-up plan").
 *
 *             Track SIZING math is a two-layer split, same idiom as the
 *             padding/gap overlay: geometry (gutter positions) reads the
 *             browser's RESOLVED px sizes (the caller reads
 *             `getComputedStyle(el).gridTemplateColumns` — the browser
 *             already ran the grid-sizing algorithm, resolving `fr`/`auto`/
 *             `%` tracks to concrete px, so this module never re-implements
 *             that algorithm); DRAG math re-derives a new AUTHORED value
 *             (the JSX-authored unit — px/%/fr/em — read from the element's
 *             inline style, since these on-canvas tools only edit inline-
 *             style-authored values, same constraint as every other curated
 *             knob) from the ratio between the target resolved size and the
 *             track's CURRENT resolved size.
 */

export type GridTrackUnit = 'px' | '%' | 'fr' | 'em' | 'auto' | 'min-content' | 'max-content';

export const GRID_KEYWORD_UNITS: ReadonlySet<GridTrackUnit> = new Set([
  'auto',
  'min-content',
  'max-content',
]);

export interface GridTrack {
  /** Numeric value; 0 (ignored) for keyword-only units. */
  value: number;
  unit: GridTrackUnit;
}

const NUMERIC_TRACK_RE = /^(-?[\d.]+)(px|%|fr|em)$/;

/**
 * Parse a `grid-template-columns`/`grid-template-rows` value into a track
 * list. Handles a plain space-separated list of numeric (px/%/fr/em) and
 * keyword (auto/min-content/max-content) tracks. Returns `[]` for an empty
 * string OR anything it can't parse token-for-token (e.g. `repeat(...)`,
 * `minmax(...)`, `subgrid`) — the caller treats an empty parse as "no
 * drag-editable tracks", falling back to the Inspector's raw-value field
 * rather than guessing at a lossy round-trip.
 */
export function parseTrackList(raw: string | null | undefined): GridTrack[] {
  const s = (raw ?? '').trim();
  if (!s) return [];
  const parts = s.split(/\s+/);
  const out: GridTrack[] = [];
  for (const part of parts) {
    if (GRID_KEYWORD_UNITS.has(part as GridTrackUnit)) {
      out.push({ value: 0, unit: part as GridTrackUnit });
      continue;
    }
    const m = NUMERIC_TRACK_RE.exec(part);
    if (!m) return [];
    out.push({ value: Number(m[1]), unit: m[2] as GridTrackUnit });
  }
  return out;
}

/** Serialize a track list back to a `grid-template-columns`/`-rows` value —
 *  the inverse of `parseTrackList`. `fr` (and every other unit) round-trips
 *  byte-for-byte modulo the `round2` value rounding applied during drag. */
export function serializeTrackList(tracks: GridTrack[]): string {
  return tracks
    .map((t) => (GRID_KEYWORD_UNITS.has(t.unit) ? t.unit : `${round2(t.value)}${t.unit}`))
    .join(' ');
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GutterLine {
  /** Index of the track BEFORE this gutter; track `index + 1` is after it. */
  index: number;
  axis: 'x' | 'y';
  x: number;
  y: number;
}

/**
 * Compute gutter handle positions from a grid container's screen rect, each
 * track's RESOLVED size in screen px (already zoom-scaled — same convention
 * as `computePaddingLines`'s `padding` argument), and the resolved gap
 * between tracks. One gutter per adjacent pair, positioned at the gap's
 * midpoint. Fewer than 2 tracks → no gutters.
 */
export function computeGutterLines(
  rect: ScreenRect,
  resolvedSizesPx: number[],
  gapPx: number,
  axis: 'col' | 'row'
): GutterLine[] {
  if (resolvedSizesPx.length < 2) return [];
  const out: GutterLine[] = [];
  let cum = axis === 'col' ? rect.x : rect.y;
  for (let i = 0; i < resolvedSizesPx.length - 1; i++) {
    cum += resolvedSizesPx[i] as number;
    const mid = cum + gapPx / 2;
    if (axis === 'col') {
      out.push({ index: i, axis: 'x', x: mid, y: rect.y + rect.h / 2 });
    } else {
      out.push({ index: i, axis: 'y', x: rect.x + rect.w / 2, y: mid });
    }
    cum += gapPx;
  }
  return out;
}

/**
 * New AUTHORED value for one track being dragged, given the screen-px delta
 * (world units — the caller already divides by zoom, same convention as
 * `computePaddingDrag`/`computeGapDrag`... actually this one takes the RAW
 * screen delta + zoom together, dividing internally, to match those two
 * functions' own signature exactly) and the track's CURRENT resolved px size.
 *
 * - `px` / `em` — additive: 1 world px of drag = 1 unit (em is treated as a
 *   px-equivalent for drag purposes — a precise em→px conversion would need
 *   the element's own font-size; this is a disclosed simplification, same
 *   spirit as the rest of this drag lane favoring predictable math over
 *   pixel-perfect unit fidelity mid-drag).
 * - `fr` / `%` — proportional SHARE units, not absolute sizes: the new value
 *   is the OLD value scaled by (targetResolvedPx / currentResolvedPx) — the
 *   same "re-derive the ratio" approach a flex-grow-style drag uses. Clamped
 *   to a small positive floor so a track never collapses to (or past) zero
 *   share.
 * - keyword tracks (auto/min-content/max-content) have no numeric value —
 *   returns the track unchanged; the caller must not offer this as a
 *   drag target (see `gutterTrackIndices` — the hook filters keyword-only
 *   tracks out of the touched set before calling this).
 */
export function computeTrackDrag(
  track: GridTrack,
  resolvedPx: number,
  dxScreen: number,
  dyScreen: number,
  zoom: number,
  axis: 'x' | 'y'
): number {
  if (GRID_KEYWORD_UNITS.has(track.unit)) return track.value;
  const z = zoom > 0 ? zoom : 1;
  const d = (axis === 'x' ? dxScreen : dyScreen) / z;
  if (track.unit === 'px' || track.unit === 'em') {
    return Math.max(0, round2(track.value + d));
  }
  const targetPx = Math.max(1, resolvedPx + d);
  if (resolvedPx <= 0) return track.value; // no ratio to derive from — no-op
  const ratio = targetPx / resolvedPx;
  const floor = track.unit === '%' ? 1 : 0.1;
  return Math.max(floor, round2(track.value * ratio));
}

/**
 * Which track indices a gutter drag touches, given the Shift modifier —
 * mirrors `paddingSideSet`'s Alt/Shift convention: plain drag touches only
 * the track BEFORE the gutter; Shift touches BOTH neighbors (each driven to
 * its own new value from the SAME cursor delta — "symmetric" in this
 * codebase's established vocabulary means both move together, not an
 * inversely-linked splitter, matching how `paddingSideSet`'s Alt sets both
 * opposite padding sides to the identical dragged value rather than trading
 * space between them).
 */
export function gutterTrackIndices(gutterIndex: number, shiftKey: boolean): number[] {
  return shiftKey ? [gutterIndex, gutterIndex + 1] : [gutterIndex];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
