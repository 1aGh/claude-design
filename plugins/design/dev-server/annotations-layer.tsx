/**
 * @file       annotations-layer.tsx — FigJam-style annotation overlay
 * @scope      plugins/design/dev-server/annotations-layer.tsx
 * @purpose    Portal-rendered draw layer. Strokes live in world coords and
 *             render INSIDE `.dc-world` via `createPortal`, so CSS `zoom` +
 *             `translate` on the world move them in lockstep with artboards
 *             with zero frame lag. A separate transparent input overlay
 *             (also portal-mounted inside the host) captures pointerdown
 *             only for draw / erase tools; viewport gestures (space-pan,
 *             middle-mouse, wheel/pinch) bypass us and reach
 *             `useViewportController` directly.
 *
 * Schema (back-compatible with Phase 5):
 *   - pen     → <path data-tool="pen" d="M.. L..">
 *   - rect    → <rect data-tool="rect" x= y= width= height= [fill=]>
 *   - ellipse → <ellipse data-tool="ellipse" cx= cy= rx= ry= [fill=]>   NEW
 *   - arrow   → <g data-tool="arrow"><line/><polyline/></g>
 *   - text    → <text data-tool="text" data-anchor-id= x= y= fill= …>    NEW
 *
 * Persists to `<designRoot>/<slug>.annotations.svg` via PUT /_api/annotations
 * on commit, debounced 200 ms.
 */

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { AnnotationContextToolbar } from './annotations-context-toolbar.tsx';
import {
  ARROW_HEADS,
  type ArrowHead,
  type ArrowLineType,
  type SvgPrimitive,
  arrowPrimitives,
} from './canvas-arrowheads.ts';
import { IconLineThick, IconLineThin } from './canvas-icons.tsx';
import { useViewportControllerContext, useWorldRefContext } from './canvas-lib.tsx';
import { buildAnnotationStrokesRecord } from './commands/annotation-strokes-command.ts';
import { type Tool, crossedDragThreshold } from './input-router.tsx';
import { AnnotationResizeOverlay } from './use-annotation-resize.tsx';
import { useAnnotationSelectionOptional } from './use-annotation-selection.tsx';
import { useAnnotationsVisibility } from './use-annotations-visibility.tsx';
import { useCollab } from './use-collab.tsx';
import { useSelectionSetOptional } from './use-selection-set.tsx';
import { type ShapeKind, useToolMode } from './use-tool-mode.tsx';
import { useUndoSinks, useUndoStackOptional } from './use-undo-stack.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types

type WorldPoint = readonly [number, number];

// Phase 24 — arrow style enums are OWNED by canvas-arrowheads.ts (so that
// module imports nothing back from here — no cycle, see DDR-067) and re-exported
// here for back-compat (context-toolbar etc. import them from this module).
export type { ArrowHead, ArrowLineType } from './canvas-arrowheads.ts';
/** Phase 24 — polygon shape primitives (diamond + the two triangle pointings). */
export type PolygonShape = 'diamond' | 'triangle' | 'triangle-down';
/** Phase 24 — horizontal alignment for text + sticky bodies. */
export type TextAlign = 'left' | 'center' | 'right';

/** Phase 24 — cursor-following ghost placeholder descriptor (pure chrome). */
type GhostDescriptor =
  | { kind: 'text'; x: number; y: number; color: string }
  | { kind: 'sticky'; x: number; y: number; color: string }
  | { kind: 'shape'; x: number; y: number; shapeKind: ShapeKind; color: string };

export interface PenStroke {
  id: string;
  tool: 'pen';
  color: string;
  width: number;
  points: WorldPoint[];
}
export interface RectStroke {
  id: string;
  tool: 'rect';
  color: string;
  width: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string | null;
  /** Phase 21 — corner radius (rx/ry). Absent / 0 = sharp 90° corners (back-compat). */
  cornerRadius?: number;
}
export interface EllipseStroke {
  id: string;
  tool: 'ellipse';
  color: string;
  width: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill?: string | null;
}
/**
 * Phase 24 — diamond / triangle / triangle-down primitives. Stored as a bbox
 * (x/y/w/h, exactly like a rect) + a `shape` discriminant; the actual SVG
 * points are derived from the bbox at serialize + render time. Brand-new on
 * disk (`<polygon data-tool="polygon" data-shape="…">`), so no back-compat
 * constraint — only idempotent round-trip.
 */
export interface PolygonStroke {
  id: string;
  tool: 'polygon';
  shape: PolygonShape;
  color: string;
  width: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string | null;
  /** Dashed outline (stroke-dasharray). Absent / false = solid. */
  dashed?: boolean;
}
export interface ArrowStroke {
  id: string;
  tool: 'arrow';
  color: string;
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Head on the (x1,y1) start. Absent = 'none' (back-compat). Phase 24 widened the enum. */
  startHead?: ArrowHead;
  /** Head on the (x2,y2) end. Absent = 'triangle' (back-compat). Phase 24 widened the enum. */
  endHead?: ArrowHead;
  /** Phase 21 — dashed shaft (stroke-dasharray). Absent / false = solid. */
  dashed?: boolean;
  /** Phase 24 — shaft routing. Absent = 'straight' (back-compat). */
  lineType?: ArrowLineType;
}
export interface TextStroke {
  id: string;
  tool: 'text';
  color: string;
  fontSize: number;
  text: string;
  /**
   * Host shape id for anchored text (double-click a rect/ellipse). Phase 21
   * relaxed this to optional: standalone text (the `text` tool) carries no
   * anchor and renders at its own world `(x, y)` instead.
   */
  anchorId?: string;
  /** Phase 21 — world coords for standalone (unanchored) text. */
  x?: number;
  y?: number;
  /** Phase 24 — bold weight. Absent / false = normal (back-compat). */
  bold?: boolean;
  /** Phase 24 — strikethrough. Absent / false = none (back-compat). */
  strike?: boolean;
  /**
   * Phase 24 — horizontal alignment. Absent default differs by kind: anchored
   * text = 'center' (legacy, byte-identical), standalone = 'left'.
   */
  align?: TextAlign;
}
/** Phase 21 — sticky note: a paper-tone card with its own word-wrapped text. */
export interface StickyStroke {
  id: string;
  tool: 'sticky';
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  /** Corner radius; defaults to STICKY_CORNER_RADIUS (8 = soft). */
  cornerRadius?: number;
  /** Phase 24 — bold body weight. Absent / false = normal. */
  bold?: boolean;
  /** Phase 24 — strikethrough body. Absent / false = none. */
  strike?: boolean;
  /** Phase 24 — body alignment. Absent = 'left' (FigJam sticky default). */
  align?: TextAlign;
}
export type Stroke =
  | PenStroke
  | RectStroke
  | EllipseStroke
  | PolygonStroke
  | ArrowStroke
  | TextStroke
  | StickyStroke;

/**
 * Phase 21 — what the inline editor is currently bound to. `anchored` edits
 * the text hosted by a rect/ellipse; `sticky` edits a card body; `standalone`
 * re-edits a free text node; `pending` is a not-yet-born text caret (no stroke
 * exists until real text is committed).
 */
type EditingTarget =
  | { kind: 'anchored'; anchorId: string; host: RectStroke | EllipseStroke }
  | { kind: 'sticky'; sticky: StickyStroke }
  | { kind: 'standalone'; text: TextStroke }
  | { kind: 'pending'; x: number; y: number }
  | null;

// Phase 21 colour system — a single coherent hue family used everywhere.
// FigJam model: stroke (saturated ink) is INDEPENDENT of fill, and fills are
// light TINTS of the same hue (index-paired with STROKE_PALETTE). Stickies use
// their own lightened paper set (STICKY_PALETTE). Exported so the draw-time
// chrome AND the per-selection context toolbar share ONE palette instead of
// drifting apart.
export const STROKE_PALETTE = [
  '#e5484d', // red (default — markup ink)
  '#f2762a', // orange
  '#e0a500', // amber
  '#30a46c', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#e93d82', // pink
  '#7c7c7c', // gray
  '#1f1f1f', // ink
] as const;
type PaletteColor = (typeof STROKE_PALETTE)[number];
// Phase 24 — default markup ink is BLACK (the `#1f1f1f` ink swatch, slot 8) for
// EVERY ink tool (pen / shape / arrow / text). It's a palette member so the
// draw chrome + per-selection toolbar highlight it as the active swatch; the
// other hues stay one click away. (Stickies keep their warm-paper default —
// DEFAULT_STICKY_COLOR — they're paper, not ink.)
const DEFAULT_COLOR: PaletteColor = STROKE_PALETTE[8];

// Light tints, index-paired to STROKE_PALETTE — picking "blue fill" gives a
// pale blue wash under a saturated stroke, exactly like FigJam shapes.
export const FILL_PALETTE = [
  '#fbe0e1', // red tint
  '#fce6d6', // orange tint
  '#fbeec2', // amber tint
  '#d9f1e2', // green tint
  '#e0ebfd', // blue tint
  '#ebe3fc', // purple tint
  '#fbdfeb', // pink tint
  '#ededed', // gray tint
  '#e7e7e7', // ink tint
] as const;

const STROKE_WIDTH_THIN = 3;
const STROKE_WIDTH_THICK = 6;
type Thickness = typeof STROKE_WIDTH_THIN | typeof STROKE_WIDTH_THICK;

const FONT_SIZE_MEDIUM = 14;
const DEFAULT_FONT_SIZE = FONT_SIZE_MEDIUM;

// Phase 24 — sticky-note paper tints. A muted/desaturated FigJam-style set
// (Image #2): a warm paper yellow default, then white/grey + soft pastels.
// Wholly separate from the stroke ink PALETTE and the translucent FILL_PALETTE
// so stickies read as "paper", not "ink". Slot 0 (yellow) is the default.
// Existing stickies keep their stored hex; only NEW stickies pick up the new
// default tint.
export const STICKY_PALETTE = [
  '#fce8a6', // muted yellow (default — warm paper)
  '#ffffff', // white
  '#e6e4e0', // light grey
  '#f7c5c0', // salmon
  '#f8d2a6', // peach
  '#bfe3c0', // mint
  '#a9dbdb', // aqua
  '#bcd2f0', // light blue
  '#cfc4ec', // lavender
  '#f3c4dd', // light pink
] as const;
const DEFAULT_STICKY_COLOR = STICKY_PALETTE[0];
const STICKY_CORNER_RADIUS = 8;
// Phase 24 — stickies are 1:1; the default tap size is a square.
const STICKY_DEFAULT_W = 200;
const STICKY_DEFAULT_H = 200;
const STICKY_MIN_SIZE = 40;
// Phase 24 — a bare tap with the Shape tool drops a default-sized shape at the
// tap point (FigJam parity: click commits, drag sizes). Square aspect.
const SHAPE_DEFAULT_SIZE = 120;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers — exported for unit tests.

export function rid(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function penPathD(points: readonly WorldPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points as readonly WorldPoint[];
  if (!first) return '';
  let d = `M${first[0]} ${first[1]}`;
  for (const p of rest) d += ` L${p[0]} ${p[1]}`;
  return d;
}

// Phase 24 — moved to canvas-arrowheads.ts (single source for shaft + heads).
// Re-exported so the existing test import (`from '../annotations-layer.tsx'`)
// and the byte-identical canary keep working.
export { arrowHeadPoints } from './canvas-arrowheads.ts';

/**
 * Phase 24 — polygon vertices derived from the bbox. `diamond` = the four
 * edge-midpoints; `triangle` = apex-up; `triangle-down` = apex-down. Every
 * shape's vertices span the FULL bbox, so a parse-back via the points' min/max
 * recovers x/y/w/h exactly (idempotent round-trip).
 */
export function polygonVertices(
  shape: PolygonShape,
  x: number,
  y: number,
  w: number,
  h: number
): Array<[number, number]> {
  if (shape === 'diamond') {
    return [
      [x + w / 2, y],
      [x + w, y + h / 2],
      [x + w / 2, y + h],
      [x, y + h / 2],
    ];
  }
  if (shape === 'triangle') {
    return [
      [x + w / 2, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  // triangle-down — apex at the bottom.
  return [
    [x, y],
    [x + w, y],
    [x + w / 2, y + h],
  ];
}

/** Vertices as an SVG `points` string. */
export function polygonPoints(
  shape: PolygonShape,
  x: number,
  y: number,
  w: number,
  h: number
): string {
  return polygonVertices(shape, x, y, w, h)
    .map(([px, py]) => `${px},${py}`)
    .join(' ');
}

/** Even-odd ray-cast point-in-polygon test. */
function pointInPolygon(px: number, py: number, pts: ReadonlyArray<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Parse a polygon `points` string back into its bounding box. */
function polygonBBox(points: string): { x: number; y: number; w: number; h: number } | null {
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const pair of points.trim().split(/\s+/)) {
    const [px, py] = pair.split(',').map((n) => Number.parseFloat(n));
    if (px == null || py == null || Number.isNaN(px) || Number.isNaN(py)) continue;
    if (px < xMin) xMin = px;
    if (px > xMax) xMax = px;
    if (py < yMin) yMin = py;
    if (py > yMax) yMax = py;
  }
  if (!Number.isFinite(xMin)) return null;
  return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
}

function strokeToSvgEl(s: Stroke): string {
  if (s.tool === 'text') {
    // Phase 21 — anchored text keeps the byte-identical Phase 5.1 form;
    // standalone text (no anchorId) writes its own world x/y and omits
    // data-anchor-id (so the parser routes it back to the standalone branch).
    // Phase 24 — bold/strike/align serialize ONLY for non-default values, so a
    // legacy text node stays byte-identical (weight/deco/alignAttr are empty).
    const weight = s.bold ? ' font-weight="700"' : '';
    const deco = s.strike ? ' text-decoration="line-through"' : '';
    if (s.anchorId != null && s.anchorId !== '') {
      const align = s.align ?? 'center'; // anchored default = centre (legacy)
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const alignAttr = align !== 'center' ? ` data-align="${align}"` : '';
      return `<text data-id="${esc(s.id)}" data-tool="text" data-anchor-id="${esc(
        s.anchorId
      )}" data-font-size="${s.fontSize}" fill="${esc(
        s.color
      )}"${weight}${deco} text-anchor="${anchor}" dominant-baseline="middle"${alignAttr}>${esc(
        s.text
      )}</text>`;
    }
    const tx = s.x ?? 0;
    const ty = s.y ?? 0;
    const align = s.align ?? 'left'; // standalone default = left
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const alignAttr = align !== 'left' ? ` data-align="${align}"` : '';
    return `<text data-id="${esc(s.id)}" data-tool="text" x="${tx}" y="${ty}" data-font-size="${
      s.fontSize
    }" fill="${esc(
      s.color
    )}"${weight}${deco} text-anchor="${anchor}" dominant-baseline="hanging"${alignAttr}>${esc(
      s.text
    )}</text>`;
  }
  if (s.tool === 'sticky') {
    // Phase 21 — sticky body lives in an allowlisted <text> child so it
    // survives sanitizeAnnotationSvg (which strips <foreignObject>, DDR-060
    // F1). The live canvas re-renders this stroke with a foreignObject so the
    // text word-wraps; the persisted <text> is the inert, sanitizer-safe form.
    const r = s.cornerRadius ?? STICKY_CORNER_RADIUS;
    const w = Math.max(0, s.w);
    const h = Math.max(0, s.h);
    // Phase 24 — bold/strike/align on the <g> data-attrs, emitted ONLY for
    // non-default values (sticky default align = left) so Phase-21 stickies
    // serialize byte-identically.
    const align = s.align ?? 'left';
    const styleAttrs =
      (s.bold ? ' data-bold="1"' : '') +
      (s.strike ? ' data-strike="1"' : '') +
      (align !== 'left' ? ` data-align="${align}"` : '');
    return `<g data-id="${esc(s.id)}" data-tool="sticky" data-r="${r}" data-fs="${
      s.fontSize
    }" fill="${esc(s.color)}"${styleAttrs}><rect x="${s.x}" y="${
      s.y
    }" width="${w}" height="${h}" rx="${r}" ry="${r}"/><text data-sticky-body="1" x="${
      s.x + 12
    }" y="${s.y + 12}" font-size="${
      s.fontSize
    }" fill="#1a1a1a" dominant-baseline="hanging">${esc(s.text)}</text></g>`;
  }
  const common = `data-id="${esc(s.id)}" data-tool="${s.tool}" stroke="${esc(s.color)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  if (s.tool === 'pen') {
    return `<path ${common} fill="none" d="${penPathD(s.points)}" pointer-events="stroke"/>`;
  }
  if (s.tool === 'rect') {
    const fill = s.fill ? esc(s.fill) : 'none';
    // Phase 21 — corner radius: append rx/ry/data-r ONLY when > 0 so legacy
    // sharp-corner rects serialize byte-identically (Task 10 canary).
    const r = s.cornerRadius ?? 0;
    const round = r > 0 ? ` rx="${r}" ry="${r}" data-r="${r}"` : '';
    return `<rect ${common} fill="${fill}" x="${s.x}" y="${s.y}" width="${Math.max(
      0,
      s.w
    )}" height="${Math.max(0, s.h)}"${round}/>`;
  }
  if (s.tool === 'ellipse') {
    const fill = s.fill ? esc(s.fill) : 'none';
    return `<ellipse ${common} fill="${fill}" cx="${s.cx}" cy="${s.cy}" rx="${Math.max(
      0,
      s.rx
    )}" ry="${Math.max(0, s.ry)}"/>`;
  }
  if (s.tool === 'polygon') {
    // Phase 24 — bbox-derived points + data-shape. Normalize the bbox so a
    // negative-extent (mid-flip) stroke serializes idempotently.
    const nx = Math.min(s.x, s.x + s.w);
    const ny = Math.min(s.y, s.y + s.h);
    const nw = Math.abs(s.w);
    const nh = Math.abs(s.h);
    const fill = s.fill ? esc(s.fill) : 'none';
    const dash = s.dashed ? ' stroke-dasharray="6 4"' : '';
    const dashAttr = s.dashed ? ' data-dash="1"' : '';
    return `<polygon ${common} fill="${fill}" data-shape="${s.shape}" points="${polygonPoints(
      s.shape,
      nx,
      ny,
      nw,
      nh
    )}"${dash}${dashAttr}/>`;
  }
  // arrow — Phase 24 reduces to ordered SVG primitives (canvas-arrowheads), the
  // same primitives StrokeNode renders. Defaults (startHead 'none', endHead
  // 'triangle', lineType 'straight', solid) reduce to exactly
  // [<line>, <polyline fill=color>] → the byte-identical Phase 5.1 form. data-*
  // attrs appear only for non-default values.
  const startHead = s.startHead ?? 'none';
  const endHead = s.endHead ?? 'triangle';
  const lineType = s.lineType ?? 'straight';
  const dashed = s.dashed ?? false;
  // esc() every interpolated value (defence-in-depth, Phase 24 security review
  // DDR-067) — heads are clamped on parse, but a value reaching serialize must
  // never be able to break out of the attribute.
  const dataAttrs =
    (startHead !== 'none' ? ` data-start-head="${esc(startHead)}"` : '') +
    (endHead !== 'triangle' ? ` data-end-head="${esc(endHead)}"` : '') +
    (lineType !== 'straight' ? ` data-line-type="${esc(lineType)}"` : '') +
    (dashed ? ' data-dash="1"' : '');
  const body = arrowPrimitives(s).map(svgPrimitiveToString).join('');
  return `<g ${common} fill="none"${dataAttrs}>${body}</g>`;
}

/** Format one arrow SVG primitive for the persisted string (byte-identical to
 *  the Phase-5.1 `<line>`/`<polyline>` forms for the legacy default arrow). */
function svgPrimitiveToString(p: SvgPrimitive): string {
  const dash = 'dash' in p && p.dash ? ' stroke-dasharray="6 4"' : '';
  switch (p.el) {
    case 'line':
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"${dash}/>`;
    case 'path':
      return `<path d="${p.d}"${dash}/>`;
    case 'polyline':
      return `<polyline points="${p.points}" fill="${esc(p.fill)}"/>`;
    case 'polygon':
      return `<polygon points="${p.points}" fill="${esc(p.fill)}"/>`;
    case 'circle':
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${esc(p.fill)}"/>`;
  }
}

export function strokesToSvg(strokes: readonly Stroke[]): string {
  const header = '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">';
  if (strokes.length === 0) return `${header}</svg>`;
  const body = strokes.map(strokeToSvgEl).join('');
  return `${header}${body}</svg>`;
}

function parsePathD(d: string): WorldPoint[] {
  const out: WorldPoint[] = [];
  const re = /[ML]\s*(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = re.exec(d)) !== null) {
    const [, x = '0', y = '0'] = m;
    out.push([Number.parseFloat(x), Number.parseFloat(y)]);
  }
  return out;
}

function parseFill(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent') return null;
  return raw;
}

/**
 * Phase 24 — recover an arrow's two endpoints from its shaft. A straight arrow
 * persists a `<line>`; a curved/elbow arrow persists a `<path>` whose first and
 * last coordinate pairs are the endpoints (the bow control / elbow corner sit
 * between them, so first-pair = start, last-pair = end recovers the ends
 * exactly → idempotent re-serialize).
 */
function arrowEndpoints(el: Element): { x1: number; y1: number; x2: number; y2: number } | null {
  const line = el.querySelector('line');
  if (line) {
    return {
      x1: Number.parseFloat(line.getAttribute('x1') || '0'),
      y1: Number.parseFloat(line.getAttribute('y1') || '0'),
      x2: Number.parseFloat(line.getAttribute('x2') || '0'),
      y2: Number.parseFloat(line.getAttribute('y2') || '0'),
    };
  }
  const path = el.querySelector('path');
  if (path) {
    const nums = (path.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g);
    if (nums && nums.length >= 4) {
      return {
        x1: Number.parseFloat(nums[0] as string),
        y1: Number.parseFloat(nums[1] as string),
        x2: Number.parseFloat(nums[nums.length - 2] as string),
        y2: Number.parseFloat(nums[nums.length - 1] as string),
      };
    }
  }
  return null;
}

export function svgToStrokes(svgText: string): Stroke[] {
  const text = (svgText ?? '').trim();
  if (!text) return [];
  if (typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return [];
    const out: Stroke[] = [];
    for (const el of Array.from(doc.querySelectorAll('[data-tool]'))) {
      const tool = el.getAttribute('data-tool');
      const id = el.getAttribute('data-id') || rid();
      const color = el.getAttribute('stroke') || el.getAttribute('fill') || DEFAULT_COLOR;
      const width = Number.parseFloat(el.getAttribute('stroke-width') || '2') || 2;
      if (tool === 'pen') {
        const d = el.getAttribute('d') || '';
        const points = parsePathD(d);
        if (points.length) out.push({ id, tool: 'pen', color, width, points });
        continue;
      }
      if (tool === 'sticky') {
        // Phase 21 — sticky reads geometry off its <rect> child, paper tint
        // off the group fill, body text off the inner <text>.
        const rectEl = el.querySelector('rect');
        const x = Number.parseFloat(rectEl?.getAttribute('x') || '0');
        const y = Number.parseFloat(rectEl?.getAttribute('y') || '0');
        const w = Number.parseFloat(rectEl?.getAttribute('width') || '0');
        const h = Number.parseFloat(rectEl?.getAttribute('height') || '0');
        const cornerRadius =
          Number.parseFloat(el.getAttribute('data-r') || String(STICKY_CORNER_RADIUS)) || 0;
        const fontSize =
          Number.parseFloat(el.getAttribute('data-fs') || String(DEFAULT_FONT_SIZE)) ||
          DEFAULT_FONT_SIZE;
        const stickyColor = el.getAttribute('fill') || DEFAULT_STICKY_COLOR;
        const body = el.querySelector('text');
        const sticky: StickyStroke = {
          id,
          tool: 'sticky',
          color: stickyColor,
          x,
          y,
          w,
          h,
          text: body?.textContent ?? '',
          fontSize,
          cornerRadius,
        };
        // Phase 24 — style attrs; absent ⇒ defaults (normal / left), left unset.
        if (el.getAttribute('data-bold') === '1') sticky.bold = true;
        if (el.getAttribute('data-strike') === '1') sticky.strike = true;
        const sticAlign = el.getAttribute('data-align');
        if (sticAlign === 'left' || sticAlign === 'center' || sticAlign === 'right') {
          sticky.align = sticAlign;
        }
        out.push(sticky);
        continue;
      }
      if (tool === 'rect') {
        const x = Number.parseFloat(el.getAttribute('x') || '0');
        const y = Number.parseFloat(el.getAttribute('y') || '0');
        const w = Number.parseFloat(el.getAttribute('width') || '0');
        const h = Number.parseFloat(el.getAttribute('height') || '0');
        const fill = parseFill(el.getAttribute('fill'));
        // Phase 21 — corner radius; absent ⇒ 0 (sharp, back-compat).
        const cornerRadius = Number.parseFloat(el.getAttribute('data-r') || '0') || 0;
        out.push({ id, tool: 'rect', color, width, x, y, w, h, fill, cornerRadius });
        continue;
      }
      if (tool === 'ellipse') {
        const cx = Number.parseFloat(el.getAttribute('cx') || '0');
        const cy = Number.parseFloat(el.getAttribute('cy') || '0');
        const rx = Number.parseFloat(el.getAttribute('rx') || '0');
        const ry = Number.parseFloat(el.getAttribute('ry') || '0');
        const fill = parseFill(el.getAttribute('fill'));
        out.push({ id, tool: 'ellipse', color, width, cx, cy, rx, ry, fill });
        continue;
      }
      if (tool === 'polygon') {
        // Phase 24 — recover the bbox from the points; shape from data-shape.
        const shapeRaw = el.getAttribute('data-shape');
        const shape: PolygonShape =
          shapeRaw === 'triangle' || shapeRaw === 'triangle-down' ? shapeRaw : 'diamond';
        const bb = polygonBBox(el.getAttribute('points') || '');
        if (bb) {
          const fill = parseFill(el.getAttribute('fill'));
          const poly: PolygonStroke = {
            id,
            tool: 'polygon',
            shape,
            color,
            width,
            x: bb.x,
            y: bb.y,
            w: bb.w,
            h: bb.h,
            fill,
          };
          const dashRaw = el.getAttribute('data-dash');
          if (dashRaw === '1' || dashRaw === 'true') poly.dashed = true;
          out.push(poly);
        }
        continue;
      }
      if (tool === 'arrow') {
        // Phase 24 — shaft is a <line> (straight) OR a <path> (curved/elbow).
        // Recover the two endpoints from whichever is present.
        const ends = arrowEndpoints(el);
        if (ends) {
          const arrow: ArrowStroke = {
            id,
            tool: 'arrow',
            color,
            width,
            x1: ends.x1,
            y1: ends.y1,
            x2: ends.x2,
            y2: ends.y2,
          };
          // Heads + dash + line-type. The serializer writes a data-* attribute
          // only for a NON-default value, so a legacy arrow carries none of
          // these and stays { startHead/endHead/dashed/lineType: undefined } →
          // defaults on re-serialize (byte-identical, canary). Phase 24 widened
          // the head enum, so read the literal value rather than match a single
          // string.
          // Clamp to the known head vocabulary — an out-of-vocab / poisoned
          // value (hub-pushed SVG) is rejected, never cast through unchecked
          // (Phase 24 security review, DDR-067).
          const sh = el.getAttribute('data-start-head');
          if (sh && ARROW_HEADS.has(sh)) arrow.startHead = sh as ArrowHead;
          const eh = el.getAttribute('data-end-head');
          if (eh && ARROW_HEADS.has(eh)) arrow.endHead = eh as ArrowHead;
          const lt = el.getAttribute('data-line-type');
          if (lt === 'curved' || lt === 'elbow' || lt === 'straight') arrow.lineType = lt;
          const dashRaw = el.getAttribute('data-dash');
          if (dashRaw === '1' || dashRaw === 'true') arrow.dashed = true;
          out.push(arrow);
        }
        continue;
      }
      if (tool === 'text') {
        const rawAnchor = el.getAttribute('data-anchor-id');
        const fontSize =
          Number.parseFloat(el.getAttribute('data-font-size') || String(DEFAULT_FONT_SIZE)) ||
          DEFAULT_FONT_SIZE;
        const inkColor = el.getAttribute('fill') || color;
        const body = (el.textContent || '').trim();
        // Phase 24 — bold / strike / align. `data-align` is the round-trip
        // source of truth (text-anchor is derived from it). Absent ⇒ default
        // (normal / per-kind align), left unset so legacy nodes round-trip.
        const isBold = el.getAttribute('font-weight') === '700';
        const isStrike = (el.getAttribute('text-decoration') || '').includes('line-through');
        const da = el.getAttribute('data-align');
        const align: TextAlign | undefined =
          da === 'left' || da === 'center' || da === 'right' ? da : undefined;
        // Phase 21 — standalone text (no data-anchor-id) carries world x/y
        // instead of a host id.
        if (!rawAnchor) {
          const t: TextStroke = {
            id,
            tool: 'text',
            color: inkColor,
            fontSize,
            text: body,
            x: Number.parseFloat(el.getAttribute('x') || '0'),
            y: Number.parseFloat(el.getAttribute('y') || '0'),
          };
          if (isBold) t.bold = true;
          if (isStrike) t.strike = true;
          if (align) t.align = align;
          out.push(t);
          continue;
        }
        const t: TextStroke = {
          id,
          tool: 'text',
          color: inkColor,
          fontSize,
          text: body,
          anchorId: rawAnchor,
        };
        if (isBold) t.bold = true;
        if (isStrike) t.strike = true;
        if (align) t.align = align;
        out.push(t);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function pointSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeHitTest(s: Stroke, wx: number, wy: number, tol: number): boolean {
  if (s.tool === 'text') {
    // Anchored text isn't independently hit-testable (it inherits its host).
    // Standalone text (Phase 21) uses its synthetic bbox so the eraser can
    // reach it.
    if (s.anchorId != null && s.anchorId !== '') return false;
    const bb = strokeBBox(s);
    if (!bb) return false;
    return (
      wx >= bb.x - tol && wx <= bb.x + bb.w + tol && wy >= bb.y - tol && wy <= bb.y + bb.h + tol
    );
  }
  const t = Math.max(tol, 'width' in s ? s.width : 2);
  if (s.tool === 'sticky') {
    // Sticky is a solid paper card — filled-rect hit anywhere inside.
    const xMin = Math.min(s.x, s.x + s.w);
    const xMax = Math.max(s.x, s.x + s.w);
    const yMin = Math.min(s.y, s.y + s.h);
    const yMax = Math.max(s.y, s.y + s.h);
    return wx >= xMin - t && wx <= xMax + t && wy >= yMin - t && wy <= yMax + t;
  }
  if (s.tool === 'pen') {
    if (s.points.length === 1) {
      const p = s.points[0] as WorldPoint;
      return Math.hypot(wx - p[0], wy - p[1]) <= t;
    }
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1] as WorldPoint;
      const b = s.points[i] as WorldPoint;
      if (pointSegmentDist(wx, wy, a[0], a[1], b[0], b[1]) <= t) return true;
    }
    return false;
  }
  if (s.tool === 'arrow') {
    return pointSegmentDist(wx, wy, s.x1, s.y1, s.x2, s.y2) <= t;
  }
  if (s.tool === 'ellipse') {
    // Inside-ellipse hit when filled; on the perimeter otherwise.
    if (s.rx <= 0 || s.ry <= 0) return false;
    const nx = (wx - s.cx) / s.rx;
    const ny = (wy - s.cy) / s.ry;
    const d = nx * nx + ny * ny;
    if (s.fill) return d <= 1.0 + t / Math.max(s.rx, s.ry);
    // Stroke-only: hit if normalized distance is within a band around 1.
    const band = t / Math.max(s.rx, s.ry);
    const dist = Math.abs(Math.sqrt(d) - 1);
    return dist <= band;
  }
  if (s.tool === 'polygon') {
    const nx = Math.min(s.x, s.x + s.w);
    const ny = Math.min(s.y, s.y + s.h);
    const pts = polygonVertices(s.shape, nx, ny, Math.abs(s.w), Math.abs(s.h));
    // Filled → inside-hit; always allow an edge-proximity hit (covers the
    // stroke-only outline + a tolerance band on a filled shape).
    if (s.fill && pointInPolygon(wx, wy, pts)) return true;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i] as [number, number];
      const b = pts[(i + 1) % pts.length] as [number, number];
      if (pointSegmentDist(wx, wy, a[0], a[1], b[0], b[1]) <= t) return true;
    }
    return false;
  }
  // rect — inside when filled, edge-only otherwise.
  const x = s.x;
  const y = s.y;
  const x2 = x + s.w;
  const y2 = y + s.h;
  const xMin = Math.min(x, x2);
  const xMax = Math.max(x, x2);
  const yMin = Math.min(y, y2);
  const yMax = Math.max(y, y2);
  if (s.fill) {
    return wx >= xMin - t && wx <= xMax + t && wy >= yMin - t && wy <= yMax + t;
  }
  if (wx < xMin - t || wx > xMax + t) return false;
  if (wy < yMin - t || wy > yMax + t) return false;
  const onLeft = Math.abs(wx - x) <= t;
  const onRight = Math.abs(wx - x2) <= t;
  const onTop = Math.abs(wy - y) <= t;
  const onBottom = Math.abs(wy - y2) <= t;
  return onLeft || onRight || onTop || onBottom;
}

/** Flip a negative-extent box so x/y is the top-left and w/h are positive. */
function normalizeBox<T extends { x: number; y: number; w: number; h: number }>(r: T): T {
  if (r.w >= 0 && r.h >= 0) return r;
  return {
    ...r,
    x: Math.min(r.x, r.x + r.w),
    y: Math.min(r.y, r.y + r.h),
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

/**
 * Phase 24 — draw-time resize modifiers (FigJam parity, mirror of the
 * `use-annotation-resize.tsx` set so create + resize feel identical):
 *   • `shift` — lock to 1:1 (square / circle); the larger drag axis sets the
 *               side, each axis keeps its own sign so the drag direction holds.
 *   • `alt`   — grow from the pointer-down point as CENTER (symmetric).
 * With neither held the box is `{ x: down, w: cursor − down }` — byte-identical
 * to the previous corner-drag math.
 */
export interface DrawMods {
  shift: boolean;
  alt: boolean;
}

/** Constrain a draw drag (`ax,ay` = pointer-down anchor; `wx,wy` = cursor). */
export function constrainDrawBox(
  ax: number,
  ay: number,
  wx: number,
  wy: number,
  mods: DrawMods
): { x: number; y: number; w: number; h: number } {
  let dx = wx - ax;
  let dy = wy - ay;
  if (mods.shift) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  if (mods.alt) {
    // Anchor is the center → span ±|d| on each axis around it.
    return { x: ax - dx, y: ay - dy, w: 2 * dx, h: 2 * dy };
  }
  return { x: ax, y: ay, w: dx, h: dy };
}

/**
 * Apply the draw-time modifiers to the in-progress stroke. Shared by the
 * pointer-move handler and the live keydown/keyup re-apply, so holding Shift /
 * Alt updates the draft even without moving the cursor. `anchor` is the
 * pointer-down point; pen / text carry no box so they pass through unchanged.
 */
export function applyDrawModifiers(
  cur: Stroke,
  anchor: { x: number; y: number },
  wx: number,
  wy: number,
  mods: DrawMods
): Stroke {
  if (cur.tool === 'rect' || cur.tool === 'polygon') {
    const b = constrainDrawBox(anchor.x, anchor.y, wx, wy, mods);
    return { ...cur, x: b.x, y: b.y, w: b.w, h: b.h };
  }
  if (cur.tool === 'ellipse') {
    const b = constrainDrawBox(anchor.x, anchor.y, wx, wy, mods);
    return {
      ...cur,
      cx: b.x + b.w / 2,
      cy: b.y + b.h / 2,
      rx: Math.abs(b.w) / 2,
      ry: Math.abs(b.h) / 2,
    };
  }
  if (cur.tool === 'sticky') {
    // Stickies are always 1:1 — force the square constraint; Alt still centers.
    const b = constrainDrawBox(anchor.x, anchor.y, wx, wy, { shift: true, alt: mods.alt });
    return { ...cur, x: b.x, y: b.y, w: b.w, h: b.h };
  }
  if (cur.tool === 'arrow') {
    let x2 = wx;
    let y2 = wy;
    if (mods.shift) {
      // Snap the shaft to the nearest 45° around the anchor (its midpoint
      // under Alt), keeping the cursor's distance.
      const dx = wx - anchor.x;
      const dy = wy - anchor.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.PI / 4;
      const ang = Math.round(Math.atan2(dy, dx) / step) * step;
      x2 = anchor.x + Math.cos(ang) * dist;
      y2 = anchor.y + Math.sin(ang) * dist;
    }
    if (mods.alt) {
      // Anchor is the midpoint → the start end mirrors the dragged end.
      return { ...cur, x1: 2 * anchor.x - x2, y1: 2 * anchor.y - y2, x2, y2 };
    }
    return { ...cur, x1: anchor.x, y1: anchor.y, x2, y2 };
  }
  return cur;
}

function normalizeRect(r: RectStroke): RectStroke {
  return normalizeBox(r);
}

// Phase 21 — sticky shares rect's drag-to-create flip (x = min, w = abs(w)).
function normalizeSticky(s: StickyStroke): StickyStroke {
  return normalizeBox(s);
}

function isStrokeMeaningful(s: Stroke): boolean {
  if (s.tool === 'pen') return s.points.length >= 2;
  if (s.tool === 'rect') return Math.abs(s.w) >= 4 && Math.abs(s.h) >= 4;
  if (s.tool === 'polygon') return Math.abs(s.w) >= 4 && Math.abs(s.h) >= 4;
  if (s.tool === 'ellipse') return s.rx >= 2 && s.ry >= 2;
  if (s.tool === 'text') return s.text.trim().length > 0;
  // Sticky below a readable floor is discarded like a 2×2 rect.
  if (s.tool === 'sticky')
    return Math.abs(s.w) >= STICKY_MIN_SIZE && Math.abs(s.h) >= STICKY_MIN_SIZE;
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 4;
}

export function strokeBBox(
  s: Stroke,
  anchors?: Map<string, RectStroke | EllipseStroke>
): { x: number; y: number; w: number; h: number } | null {
  if (s.tool === 'pen') {
    if (!s.points.length) return null;
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const [px, py] of s.points) {
      if (px < xMin) xMin = px;
      if (px > xMax) xMax = px;
      if (py < yMin) yMin = py;
      if (py > yMax) yMax = py;
    }
    return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
  }
  if (s.tool === 'rect' || s.tool === 'polygon') {
    return {
      x: Math.min(s.x, s.x + s.w),
      y: Math.min(s.y, s.y + s.h),
      w: Math.abs(s.w),
      h: Math.abs(s.h),
    };
  }
  if (s.tool === 'ellipse') {
    return { x: s.cx - s.rx, y: s.cy - s.ry, w: s.rx * 2, h: s.ry * 2 };
  }
  if (s.tool === 'arrow') {
    return {
      x: Math.min(s.x1, s.x2),
      y: Math.min(s.y1, s.y2),
      w: Math.abs(s.x2 - s.x1),
      h: Math.abs(s.y2 - s.y1),
    };
  }
  if (s.tool === 'sticky') {
    return {
      x: Math.min(s.x, s.x + s.w),
      y: Math.min(s.y, s.y + s.h),
      w: Math.abs(s.w),
      h: Math.abs(s.h),
    };
  }
  // text — anchored inherits its host's bbox; standalone (Phase 21) gets a
  // synthetic bbox from its world (x, y) so it's selectable and the context
  // toolbar can position against it.
  if (s.anchorId != null && s.anchorId !== '') {
    const host = anchors?.get(s.anchorId);
    return host ? strokeBBox(host) : null;
  }
  const tx = s.x ?? 0;
  const ty = s.y ?? 0;
  return {
    x: tx,
    y: ty,
    w: Math.max(8, s.text.length * s.fontSize * 0.55),
    h: s.fontSize * 1.2,
  };
}

function isEditable(t: EventTarget | null): boolean {
  if (!t || !(t as HTMLElement).tagName) return false;
  const el = t as HTMLElement;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function deriveFile(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const p = window.location.pathname;
    if (p === '/_canvas-shell.html' || p === '/_canvas-shell') {
      const qs = new URLSearchParams(window.location.search);
      const canvas = qs.get('canvas') ?? '';
      const designRel = (qs.get('designRel') ?? '.design').replace(/^\/+|\/+$/g, '');
      return `${designRel}/${canvas}`;
    }
    return decodeURIComponent(p).replace(/^\//, '');
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles

const ANNOT_CSS = `
.dc-annot-chrome {
  /* Stacks directly above the centered tool toolbar (which is bottom:16px,
     32px tall → top edge ~ bottom:48px). 8 px gap → chrome at bottom:60px.
     Phase 21 — dark "marker tray" matching the FigJam selection bar. */
  position: absolute;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  background: #26262b;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 5px 8px;
  font-family: var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  color: rgba(255,255,255,0.85);
  z-index: 6;
  box-shadow: 0 8px 28px rgba(0,0,0,0.34), 0 2px 6px rgba(0,0,0,0.22);
  user-select: none;
}
.dc-annot-chrome .dc-annot-swatches { display: flex; align-items: center; gap: 1px; }
.dc-annot-chrome .dc-annot-sw {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.16);
  cursor: pointer;
  padding: 0;
  appearance: none;
  transition: transform 80ms ease;
}
.dc-annot-chrome .dc-annot-sw:hover { transform: scale(1.1); }
.dc-annot-chrome .dc-annot-sw[aria-pressed="true"] {
  box-shadow: 0 0 0 2px #26262b, 0 0 0 3px rgba(255,255,255,0.92);
  border-color: transparent;
}
.dc-annot-chrome .dc-annot-sw:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}
.dc-annot-chrome .dc-annot-sep {
  width: 1px;
  height: 16px;
  align-self: center;
  background: rgba(255,255,255,0.09);
  margin: 0 4px;
}
.dc-annot-chrome .dc-annot-fill {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.16);
  cursor: pointer;
  padding: 0;
  appearance: none;
  position: relative;
  transition: transform 80ms ease;
}
.dc-annot-chrome .dc-annot-fill:hover { transform: scale(1.1); }
.dc-annot-chrome .dc-annot-fill:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}
.dc-annot-chrome .dc-annot-fill--none {
  background: #3a3a40;
}
.dc-annot-chrome .dc-annot-fill--none::after {
  content: "";
  position: absolute; inset: 4px;
  border-radius: 50%;
  background:
    linear-gradient(135deg, transparent 44%, rgba(255,255,255,0.55) 44%, rgba(255,255,255,0.55) 56%, transparent 56%);
}
.dc-annot-chrome .dc-annot-fill[aria-pressed="true"] {
  box-shadow: 0 0 0 2px #26262b, 0 0 0 3px rgba(255,255,255,0.92);
  border-color: transparent;
}
/* Phase 21 — icon buttons (light glyph on dark, white-tint active). */
.dc-annot-chrome .dc-annot-ibtn {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.78);
  cursor: pointer;
  padding: 0;
  transition: background-color 80ms linear, color 80ms linear;
}
.dc-annot-chrome .dc-annot-ibtn:hover {
  background: rgba(255,255,255,0.1);
  color: #ffffff;
}
.dc-annot-chrome .dc-annot-ibtn[aria-pressed="true"] {
  background: rgba(255,255,255,0.18);
  color: #ffffff;
}
.dc-annot-chrome .dc-annot-ibtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .dc-annot-chrome .dc-annot-ibtn, .dc-annot-chrome .dc-annot-sw, .dc-annot-chrome .dc-annot-fill { transition: none; }
}
.dc-annot-input {
  position: absolute;
  inset: 0;
  z-index: 4;
}
.dc-annot-svg {
  position: absolute;
  left: 0;
  top: 0;
  /*
   * .dc-world has no intrinsic dimensions — its children render via absolute
   * positioning. An SVG inside with width:100%/height:100% resolves to 0 px
   * and Chrome clips children even under overflow:visible. We hardcode a
   * very large width/height instead so the SVG viewport easily covers any
   * world-coord stroke. vector-effect="non-scaling-stroke" on every stroke
   * keeps thickness px-constant under CSS zoom; overflow:visible covers the
   * rare edge case of a stroke straying outside this 200k box.
   */
  width: 200000px;
  height: 200000px;
  overflow: visible;
  pointer-events: none;
}
/* Drag-select marquee — rendered while user is dragging to select strokes. */
.dc-annot-marquee {
  pointer-events: none;
  fill: color-mix(in oklab, var(--maude-hud-accent, #d63b1f) 8%, transparent);
  stroke: var(--maude-hud-accent, #d63b1f);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
/* Phase 24 — sticky-note body. Word-wrapped multi-line text inside the card's
   foreignObject. Text sits TOP-LEFT (FigJam parity); the editor contentEditable
   mirrors the same box metrics so the read-edit swap doesn't shift the text.
   text-align is overridden inline per-sticky when align is not left. */
.dc-sticky-body {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
  color: #2a2a28;
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
}
/* Phase 24 — while editing an annotation's text (a text label OR a sticky body,
   both carry the dc-annot-editor class), force the I-beam. The important flag
   plus the class selector beat use-tool-mode's blanket star-cursor rule (you
   usually open the editor from MOVE mode, whose move glyph would otherwise sit
   over the text you're typing into). The element's inline text cursor can't win
   that fight on its own — a non-important inline style loses to !important.
   See DDR-067. (No backticks in this comment: the whole block is a JS template
   literal, so a backtick here would terminate the string.) */
.dc-annot-editor, .dc-annot-editor * { cursor: text !important; }
`.trim();

function ensureAnnotStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-annot-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-annot-css';
  s.textContent = ANNOT_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Strokes store — lifted out of the layer so the contextual toolbar (Phase 5.1
// Task 8) can mutate strokes without prop-drilling.

export interface StrokesStoreValue {
  strokes: Stroke[];
  setStrokes: (next: Stroke[]) => void;
  updateStroke: (id: string, patch: Partial<Stroke>) => void;
  deleteStrokes: (ids: string[]) => void;
  translateStrokes: (ids: string[], dx: number, dy: number) => void;
}

const StrokesStoreContext = createContext<StrokesStoreValue | null>(null);

export function useStrokesStore(): StrokesStoreValue | null {
  return useContext(StrokesStoreContext);
}

function translateOne(s: Stroke, dx: number, dy: number): Stroke {
  if (s.tool === 'pen') {
    return { ...s, points: s.points.map(([x, y]) => [x + dx, y + dy] as WorldPoint) };
  }
  if (s.tool === 'rect' || s.tool === 'polygon') return { ...s, x: s.x + dx, y: s.y + dy };
  if (s.tool === 'ellipse') return { ...s, cx: s.cx + dx, cy: s.cy + dy };
  if (s.tool === 'arrow')
    return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
  if (s.tool === 'sticky') return { ...s, x: s.x + dx, y: s.y + dy };
  // text — anchored inherits its host's bbox (moves with the host); standalone
  // (Phase 21) carries its own world (x, y) and translates directly.
  if (s.anchorId != null && s.anchorId !== '') return s;
  return { ...s, x: (s.x ?? 0) + dx, y: (s.y ?? 0) + dy };
}

/**
 * Reference-equal stroke comparison — true when the two arrays carry the same
 * stroke object references in the same order. Used by the annotation drag
 * onPointerUp to skip pushing an undo record when the gesture didn't actually
 * move anything (zero movement OR snapshot mapped through a no-op translate
 * back to the original references — `translateOne` short-circuits when dx=dy=0
 * because new objects are still created, so we compare references defensively).
 */
export function strokesShallowEqual(a: readonly Stroke[], b: readonly Stroke[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Annotations visibility now lives in use-annotations-visibility.tsx so the
// ToolPalette (a sibling under CanvasRouter, not a descendant of this layer)
// can read the same state. Re-exported here for back-compat.
export { useAnnotationsVisibility } from './use-annotations-visibility.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Component

export function AnnotationsLayer() {
  ensureAnnotStyles();
  const { tool, setTool, sticky, tools, shapeKind } = useToolMode();
  const controller = useViewportControllerContext();
  const vp = controller?.viewport ?? null;
  const worldRef = useWorldRefContext();
  const annotSel = useAnnotationSelectionOptional();
  const elementSel = useSelectionSetOptional();

  const [strokes, setStrokesState] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [fill, setFill] = useState<string | null>(null);
  const [thickness, setThickness] = useState<Thickness>(STROKE_WIDTH_THIN);
  // Phase 21 — draw-time paper tint for the sticky tool (recolor-after via the
  // context toolbar). Separate from `color` (ink for pen/rect/text/arrow).
  const [stickyColor, setStickyColor] = useState<string>(DEFAULT_STICKY_COLOR);
  // Phase 21 — a standalone-text caret waiting for its first keystroke. No
  // stroke exists yet (mirrors anchored text: the stroke is born on commit,
  // so an abandoned empty caret leaves nothing behind / no undo record).
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  // Phase 24 — ghost placeholder: world coords the cursor is hovering while a
  // shape/sticky/text tool is armed and nothing is being drawn yet. Pure chrome
  // (low-opacity, pointer-events:none) — never selectable, hit-tested, or saved.
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const visibilityCtx = useAnnotationsVisibility();
  const visible = visibilityCtx?.visible ?? true;
  const setVisible = useCallback(
    (next: boolean | ((cur: boolean) => boolean)) => {
      if (!visibilityCtx) return;
      const v =
        typeof next === 'function'
          ? (next as (cur: boolean) => boolean)(visibilityCtx.visible)
          : next;
      visibilityCtx.setVisible(v);
    },
    [visibilityCtx]
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileRef = useRef<string | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  drawingRef.current = drawing;
  // Phase 24 — pointer-down anchor + last cursor (world coords) for the active
  // draw, so the resize modifiers (Shift 1:1 / Alt from-center) can re-constrain
  // the draft on a bare keydown/keyup, not just on pointer-move.
  const drawAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Phase 20 — latest strokes mirror so command builders can read the
   * pre-mutation snapshot synchronously (React state isn't refreshed
   * between rapid taps in the same tick).
   */
  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const isDraw =
    tool === 'pen' || tool === 'shape' || tool === 'arrow' || tool === 'sticky' || tool === 'text';
  const isErase = tool === 'eraser';
  const isActive = isDraw || isErase;
  // T20 / Phase 24 — every shape primitive carries stroke weight (FigJam ships
  // thickness on all of them). The annotation toolbar reads supportsThickness
  // to decide whether to render the Thin / Thick chips.
  const supportsThickness = tool === 'pen' || tool === 'arrow' || tool === 'shape';
  const supportsFill = tool === 'shape';
  // Phase 24 — tools that show a cursor-following ghost placeholder.
  const ghostCapable = tool === 'shape' || tool === 'sticky' || tool === 'text';

  // Clear the ghost when the active tool stops being ghost-capable (or
  // visibility toggles) so a stale ghost never lingers after a tool change.
  useEffect(() => {
    if (!ghostCapable || !visible) setGhost(null);
  }, [ghostCapable, visible]);

  // Load existing annotations on mount.
  // Phase 8 Task 5 — seed lastAppliedSvgRef so the first Y.Map observe (when
  // collab connects shortly after this fetch lands) doesn't re-apply the
  // same content we just hydrated from REST.
  const lastAppliedSvgRef = useRef<string>('');
  useEffect(() => {
    const file = deriveFile();
    fileRef.current = file;
    if (!file) return;
    let cancelled = false;
    void fetch(`/_api/annotations?file=${encodeURIComponent(file)}`, {
      headers: { Accept: 'image/svg+xml' },
    })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (cancelled) return;
        const loaded = svgToStrokes(text);
        if (loaded.length) {
          setStrokesState(loaded);
          lastAppliedSvgRef.current = text;
        }
      })
      .catch(() => {
        /* network blip — start with an empty annotation set */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Phase 8 Task 5 — observe the Y.Map.annotations for live updates from
  // other tabs. Bail when the incoming SVG STRING is identical to the one
  // we last applied (covers the local echo round-trip without missing real
  // foreign changes). The prior length+first/last-id check was wrong: a
  // resize / move keeps the same id list, so all three predicates matched
  // even though geometry changed — foreign edits silently disappeared.
  const collab = useCollab();
  useEffect(() => {
    if (!collab) return;
    const map = collab.doc.getMap<string>('annotations');
    const apply = () => {
      const svg = map.get('svg');
      if (typeof svg !== 'string' || !svg) return;
      if (svg === lastAppliedSvgRef.current) return;
      lastAppliedSvgRef.current = svg;
      setStrokesState(svgToStrokes(svg));
    };
    apply();
    map.observe(apply);
    return () => {
      try {
        map.unobserve(apply);
      } catch {
        /* doc destroyed before unmount */
      }
    };
  }, [collab]);

  const undoStack = useUndoStackOptional();
  const undoSinks = useUndoSinks();
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  /**
   * Apply a `Stroke[]` snapshot: update local React state AND fire-and-forget
   * PUT to the server. Used as the `putFn` injected into the
   * `AnnotationStrokesCommand` — both the initial push AND every undo/redo
   * replay route through here, so the iframe's `strokes` state always
   * tracks the server. (Without the setStrokesState here, Cmd+Z would
   * silently PUT the prior SVG but the canvas would keep painting the
   * post-edit strokes until the user reloaded.)
   *
   * The 200 ms scheduled-save debounce (legacy path) is cleared the moment
   * we push a command, so the server only sees one PUT per edit instead
   * of two-step racing.
   */
  const putStrokes = useCallback((next: readonly Stroke[]) => {
    setStrokesState(next as Stroke[]);
    const file = fileRef.current;
    if (!file) return Promise.resolve();
    const svg = strokesToSvg(next);
    // Phase 8 Task 5 — record the SVG we just authored locally so the
    // server-broadcast echo (PUT → onAnnotationsChanged → syncRoom* →
    // Y.Map.observe) doesn't trigger a redundant setStrokesState.
    lastAppliedSvgRef.current = svg;
    return fetch('/_api/annotations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, svg }),
    })
      .then(() => undefined)
      .catch(() => {
        /* swallow — user sees uncommitted state until the next stroke */
      });
  }, []);

  // Register the strokes put sink with the undo provider so the rebuilt
  // AnnotationStrokesCommand (after a canvas switch + return) routes through
  // THIS iframe's React state, not the gone iframe's stale closures.
  useEffect(() => {
    undoSinks.setSink('strokesPutFn', putStrokes);
    return () => undoSinks.setSink('strokesPutFn', undefined);
  }, [undoSinks, putStrokes]);

  /**
   * Single entry point for every stroke mutation. Builds an undo record
   * and pushes onto the stack — `push()` rebuilds the command via the
   * registered `strokesPutFn` sink and calls `cmd.do() = putStrokes(next)`,
   * which both updates local state and PUTs. Cancels any pending debounced
   * save first — DDR-050 gotcha: a queued auto-save flushing AFTER our PUT
   * would race the stack into a stale state.
   */
  const commitStrokes = useCallback(
    (prev: readonly Stroke[], next: readonly Stroke[], label?: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const record = buildAnnotationStrokesRecord({
        before: prev,
        after: next,
        ...(label ? { label } : {}),
      });
      void undoStackRef.current.push(record);
    },
    []
  );

  const setStrokes = useCallback(
    (next: Stroke[]) => {
      const prev = strokesRef.current;
      commitStrokes(prev, next);
    },
    [commitStrokes]
  );

  const strokesStore = useMemo<StrokesStoreValue>(() => {
    const updateStroke = (id: string, patch: Partial<Stroke>): void => {
      const prev = strokesRef.current;
      const next = prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Stroke) : s));
      commitStrokes(prev, next);
    };
    const deleteStrokes = (ids: string[]): void => {
      const set = new Set(ids);
      const prev = strokesRef.current;
      const next = prev.filter(
        (s) => !set.has(s.id) && !(s.tool === 'text' && s.anchorId != null && set.has(s.anchorId))
      );
      if (next.length === prev.length) return;
      commitStrokes(prev, next);
    };
    const translateStrokes = (ids: string[], dx: number, dy: number): void => {
      const set = new Set(ids);
      const prev = strokesRef.current;
      const next = prev.map((s) => (set.has(s.id) ? translateOne(s, dx, dy) : s));
      commitStrokes(prev, next, `move ${ids.length} stroke${ids.length === 1 ? '' : 's'}`);
    };
    return {
      strokes,
      setStrokes,
      updateStroke,
      deleteStrokes,
      translateStrokes,
    };
  }, [strokes, setStrokes, commitStrokes]);

  // Menubar bridge (Phase 5.1 Task 10) — listen for postMessages from the
  // dev-server shell. `selection-clear` + `tool-set` live in canvas-shell
  // (those providers are above us); we own visibility + annotation-select-all
  // because they read this layer's local state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { dgn?: string; visible?: boolean } | null;
      if (!m || typeof m !== 'object' || !m.dgn) return;
      if (m.dgn === 'view-annotations') {
        if (typeof m.visible === 'boolean') setVisible(m.visible);
        return;
      }
      if (m.dgn === 'annotation-select-all') {
        if (annotSel) annotSel.replace(strokes.map((s) => s.id));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [annotSel, strokes, setVisible]);

  // Document-level toggle: Shift+P (presentation). Annotation-shortcut help is
  // owned by the dev-server menubar (Help button); we no longer ship an
  // in-canvas help dialog from this layer.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === 'P' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [setVisible]);

  const screenToWorld = useCallback(
    (cx: number, cy: number): [number, number] => {
      const v = vp ?? { x: 0, y: 0, zoom: 1 };
      const z = v.zoom || 1;
      return [(cx - v.x) / z, (cy - v.y) / z];
    },
    [vp]
  );

  const eraseAt = useCallback(
    (wx: number, wy: number) => {
      const zoom = vp?.zoom || 1;
      const tol = 8 / zoom;
      const prev = strokesRef.current;
      for (let i = prev.length - 1; i >= 0; i--) {
        const candidate = prev[i];
        if (candidate && strokeHitTest(candidate, wx, wy, tol)) {
          const removedId = candidate.id;
          const next = prev
            .slice(0, i)
            .concat(prev.slice(i + 1))
            .filter((s) => !(s.tool === 'text' && s.anchorId === removedId));
          commitStrokes(prev, next, 'erase 1 stroke');
          return;
        }
      }
    },
    [vp, commitStrokes]
  );

  const beginStroke = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, spaceHeld: boolean) => {
      if (!isActive || !visible) return false;
      if (e.button !== 0) return false;
      if (spaceHeld) return false;
      if (e.metaKey || e.ctrlKey) return false;
      // We do NOT stopPropagation — viewport-controller listens on the host
      // ancestor and never claims a bare-left/no-space pointerdown anyway.
      e.preventDefault();
      setGhost(null); // a draw is starting — the ghost placeholder is done
      try {
        (e.target as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
          e.pointerId
        );
      } catch {
        /* some browsers reject capture on synthetic events */
      }
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      drawAnchorRef.current = { x: wx, y: wy };
      lastDrawPointRef.current = { x: wx, y: wy };
      if (isErase) {
        eraseAt(wx, wy);
        return true;
      }
      const id = rid();
      const width: number = supportsThickness ? thickness : STROKE_WIDTH_THIN;
      const activeFill = supportsFill ? fill : null;
      if (tool === 'pen') {
        setDrawing({ id, tool: 'pen', color, width, points: [[wx, wy]] });
      } else if (tool === 'shape') {
        // Phase 24 — the single Shape tool maps its kind onto a stroke type:
        // circle → ellipse; square/rounded → rect (cornerRadius 0 / 8);
        // diamond/triangle/triangle-down → polygon.
        if (shapeKind === 'circle') {
          setDrawing({
            id,
            tool: 'ellipse',
            color,
            width,
            cx: wx,
            cy: wy,
            rx: 0,
            ry: 0,
            fill: activeFill,
          });
        } else if (shapeKind === 'square' || shapeKind === 'rounded') {
          setDrawing({
            id,
            tool: 'rect',
            color,
            width,
            x: wx,
            y: wy,
            w: 0,
            h: 0,
            fill: activeFill,
            cornerRadius: shapeKind === 'rounded' ? 8 : 0,
          });
        } else {
          setDrawing({
            id,
            tool: 'polygon',
            shape: shapeKind,
            color,
            width,
            x: wx,
            y: wy,
            w: 0,
            h: 0,
            fill: activeFill,
          });
        }
      } else if (tool === 'arrow') {
        setDrawing({
          id,
          tool: 'arrow',
          color,
          width,
          x1: wx,
          y1: wy,
          x2: wx,
          y2: wy,
        });
      } else if (tool === 'sticky') {
        // Phase 21 — drag-create a paper card. Default size if the user just
        // taps (no drag) is applied in endStroke.
        setDrawing({
          id,
          tool: 'sticky',
          color: stickyColor,
          x: wx,
          y: wy,
          w: 0,
          h: 0,
          text: '',
          fontSize: DEFAULT_FONT_SIZE,
          cornerRadius: STICKY_CORNER_RADIUS,
        });
      } else if (tool === 'text') {
        // Phase 21 — single click drops an editable caret at the click point.
        // No stroke is created until the user commits real text (mirrors the
        // anchored double-click flow), so an empty caret leaves nothing behind.
        setPendingText({ x: wx, y: wy });
        if (annotSel) annotSel.clear();
        const stickyOnText = sticky.locked && sticky.tool === 'text';
        if (!stickyOnText) setTool('move');
        return true;
      }
      return true;
    },
    [
      tool,
      shapeKind,
      color,
      fill,
      thickness,
      stickyColor,
      supportsThickness,
      supportsFill,
      isActive,
      isErase,
      visible,
      screenToWorld,
      eraseAt,
      annotSel,
      sticky,
      setTool,
    ]
  );

  const moveStroke = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isActive || !visible) return;
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      if (isErase) {
        if ((e.buttons & 1) === 0) return;
        eraseAt(wx, wy);
        return;
      }
      // Phase 24 — ghost placeholder. While nothing is being drawn, track the
      // cursor so a translucent preview can follow it; an active draw hides it.
      if (drawingRef.current == null) {
        if (ghostCapable) setGhost({ x: wx, y: wy });
        return;
      }
      setGhost(null);
      lastDrawPointRef.current = { x: wx, y: wy };
      const anchor = drawAnchorRef.current;
      const mods: DrawMods = { shift: e.shiftKey, alt: e.altKey };
      setDrawing((cur) => {
        if (!cur) return cur;
        if (cur.tool === 'pen') {
          const last = cur.points[cur.points.length - 1] as WorldPoint | undefined;
          if (last && Math.hypot(wx - last[0], wy - last[1]) < 1) return cur;
          return { ...cur, points: [...cur.points, [wx, wy] as WorldPoint] };
        }
        // Phase 24 — Shift (1:1) / Alt (from-center) apply to every box + arrow
        // shape, mirroring the resize handles. The anchor is the pointer-down
        // point; without it (shouldn't happen mid-draw) fall back to no change.
        if (!anchor) return cur;
        return applyDrawModifiers(cur, anchor, wx, wy, mods);
      });
    },
    [isActive, isErase, visible, screenToWorld, eraseAt, ghostCapable]
  );

  const endStroke = useCallback(() => {
    if (!isActive || !visible) return;
    if (isErase) return;
    const cur = drawingRef.current;
    if (!cur) return;
    let final: Stroke | null = cur;
    // Phase 24 — a bare tap (both axes below the drag threshold) drops a
    // default-sized shape at the tap point so "click to place" works like
    // FigJam; a real drag sizes it. A thin/degenerate drag still gets discarded
    // by isStrokeMeaningful below.
    const isTap = (w: number, h: number) => Math.abs(w) < 4 && Math.abs(h) < 4;
    if (cur.tool === 'rect') {
      const norm = normalizeRect(cur);
      final = isTap(norm.w, norm.h)
        ? { ...norm, x: cur.x, y: cur.y, w: SHAPE_DEFAULT_SIZE, h: SHAPE_DEFAULT_SIZE }
        : norm;
    } else if (cur.tool === 'polygon') {
      const norm = normalizeBox(cur);
      final = isTap(norm.w, norm.h)
        ? { ...norm, x: cur.x, y: cur.y, w: SHAPE_DEFAULT_SIZE, h: SHAPE_DEFAULT_SIZE }
        : norm;
    } else if (cur.tool === 'ellipse') {
      final =
        cur.rx < 2 && cur.ry < 2
          ? { ...cur, rx: SHAPE_DEFAULT_SIZE / 2, ry: SHAPE_DEFAULT_SIZE / 2 }
          : cur;
    } else if (cur.tool === 'sticky') {
      const norm = normalizeSticky(cur);
      // A bare tap (or a drag too small to be a usable card) drops a
      // default-sized note at the tap point — FigJam parity.
      final =
        Math.abs(norm.w) < STICKY_MIN_SIZE || Math.abs(norm.h) < STICKY_MIN_SIZE
          ? { ...norm, w: STICKY_DEFAULT_W, h: STICKY_DEFAULT_H }
          : norm;
    }
    if (final && !isStrokeMeaningful(final)) final = null;
    if (final) {
      const committed = final;
      const prev = strokesRef.current;
      const next = [...prev, committed];
      commitStrokes(prev, next, `draw ${committed.tool}`);
      // T18 — auto-select the freshly drawn shape so the user can immediately
      // see + adjust it. annotSel is optional (some test harnesses mount
      // AnnotationsLayer without the provider), so guard the call.
      if (annotSel) annotSel.replace(committed.id);
      // Phase 21 — a fresh sticky opens in edit mode (FigJam parity: drop a
      // note, type immediately). Only meaningful deviation from rect/ellipse.
      if (committed.tool === 'sticky') setEditingId(committed.id);
    }
    // T18 / T19 — flip the tool back to Move after every commit UNLESS sticky
    // mode is locked on this tool. Sticky lets the user draw many shapes in a
    // row (canonical pattern: tldraw double-click to lock). Eraser stays
    // armed by default — that tool is destructive, not constructive.
    const toolJustUsed = cur.tool;
    if (toolJustUsed !== 'eraser') {
      const stickyOnThis = sticky.locked && sticky.tool === toolJustUsed;
      if (!stickyOnThis) setTool('move');
    }
    drawAnchorRef.current = null;
    lastDrawPointRef.current = null;
    setDrawing(null);
  }, [isActive, isErase, visible, commitStrokes, annotSel, setTool, sticky]);

  // T21 — abort a mid-stroke draw without committing. Dispatched by the
  // canvas-shell Esc handler (`maude:cancel-stroke`). Safe to call when
  // nothing is being drawn — the early-return on drawingRef keeps it
  // a no-op.
  const cancelStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawAnchorRef.current = null;
    lastDrawPointRef.current = null;
    setDrawing(null);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onCancel = () => cancelStroke();
    document.addEventListener('maude:cancel-stroke', onCancel);
    return () => document.removeEventListener('maude:cancel-stroke', onCancel);
  }, [cancelStroke]);

  // Phase 24 — holding/releasing Shift or Alt mid-draw re-constrains the draft
  // at the last cursor position (FigJam: the modifier engages while held, no
  // pointer-move needed). Pen / text carry no box, so they're skipped.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const cur = drawingRef.current;
      const anchor = drawAnchorRef.current;
      const p = lastDrawPointRef.current;
      if (!cur || !anchor || !p) return;
      if (e.key !== 'Shift' && e.key !== 'Alt') return;
      if (cur.tool === 'pen' || cur.tool === 'text') return;
      e.preventDefault();
      const mods: DrawMods = { shift: e.shiftKey, alt: e.altKey };
      setDrawing((c) => (c ? applyDrawModifiers(c, anchor, p.x, p.y, mods) : c));
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
    };
  }, []);

  const renderStrokes = useMemo(
    () => (drawing ? [...strokes, drawing] : strokes),
    [strokes, drawing]
  );

  // Phase 24 — the ghost descriptor handed to the SVG layer. Suppressed while a
  // draw is in progress (the real preview takes over) so the two never overlap.
  const ghostPreview = useMemo<GhostDescriptor | null>(() => {
    if (!ghost || !ghostCapable || drawing) return null;
    if (tool === 'text') return { kind: 'text', x: ghost.x, y: ghost.y, color };
    if (tool === 'sticky') return { kind: 'sticky', x: ghost.x, y: ghost.y, color: stickyColor };
    return { kind: 'shape', x: ghost.x, y: ghost.y, shapeKind, color };
  }, [ghost, ghostCapable, drawing, tool, shapeKind, color, stickyColor]);

  const anchorsById = useMemo(() => {
    const map = new Map<string, RectStroke | EllipseStroke>();
    for (const s of strokes) {
      if (s.tool === 'rect' || s.tool === 'ellipse') map.set(s.id, s);
    }
    return map;
  }, [strokes]);

  const strokesById = useMemo(() => {
    const map = new Map<string, Stroke>();
    for (const s of strokes) map.set(s.id, s);
    return map;
  }, [strokes]);

  // ──────────────────────────────────────────────────────────────────────────
  // Move-tool selection + drag (Phase 5.1 Tasks 6 + 7). Single doc-level
  // capture pointerdown listener:
  //   - target is a stroke → select (replace, or add with Shift)
  //   - bare click on empty world → clear annotation selection
  //   - Cmd / Cmd+Shift falls through to element-selection (we bail).
  // Once a stroke is selected, clicking inside its bbox starts a drag.

  /**
   * Annotation drag state. Snapshot of strokes captured at pointerdown so the
   * whole gesture (pointermove × N → pointerup) commits as ONE undo record at
   * release time. Without the snapshot, each pointermove tick became its own
   * `translateStrokes` call and each call became its own undo record — Cmd+Z
   * had to be pressed dozens of times to walk back a single drag.
   */
  const dragStateRef = useRef<{
    pointerId: number;
    startWX: number;
    startWY: number;
    movedIds: string[];
    snapshot: Stroke[];
  } | null>(null);

  // Drag-select marquee state. World-coord rectangle (anchor + cursor); the
  // cursor end animates with pointermove. `null` = no marquee active.
  const [marquee, setMarquee] = useState<{
    ax: number;
    ay: number;
    bx: number;
    by: number;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: commitStrokes/strokesStore are stable refs from parent context; manual dep list reflects effect-trigger semantics, not internal callbacks
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (tool !== 'move') return;
    if (!annotSel) return;

    const findStrokeId = (el: Element | null): string | null => {
      const node = el?.closest?.('[data-id][data-tool]') ?? null;
      const id = node?.getAttribute('data-id') ?? null;
      const t = node?.getAttribute('data-tool') ?? null;
      if (
        id &&
        t &&
        (t === 'pen' ||
          t === 'rect' ||
          t === 'ellipse' ||
          t === 'polygon' ||
          t === 'arrow' ||
          t === 'text' ||
          t === 'sticky')
      ) {
        return id;
      }
      return null;
    };

    // Chrome elements never deselect. Includes the per-shape context toolbar,
    // the main tool palette, the in-canvas draw chrome, the minimap, and the
    // right-click menu. Clicks on these route to their own handlers.
    const CHROME_SELECTOR =
      '.dc-annot-ctx, .dc-tool-palette, .dc-annot-chrome, .dc-mm, .dc-context-menu, .dc-tp-popover, .dc-multi-artboard-tb, .dc-elem-ctx-tb, .dc-cv-eq-spacing-layer, .cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, .dc-annot-resize-handle, .dc-annot-editor';

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey) return; // escape hatch into element-selection
      const target = e.target as Element | null;
      if (target?.closest?.(CHROME_SELECTOR)) return; // chrome owns its clicks
      const strokeId = findStrokeId(target);
      // When pointerdown lands inside an artboard but not on a stroke, the
      // gesture belongs to artboard-drag / element-marquee — not the
      // annotation marquee. Bailing here keeps the annotation marquee from
      // racing the artboard drag (post-Wave-3 user grievance G5).
      if (!strokeId && target?.closest?.('[data-dc-screen]')) return;
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      // Stroke hit — select + start drag-translate of the group ─────────
      if (strokeId) {
        e.preventDefault();
        e.stopImmediatePropagation();
        elementSel?.clear();
        let ids: string[];
        if (e.shiftKey) {
          annotSel.add(strokeId);
          ids = annotSel.contains(strokeId)
            ? annotSel.selectedIds
            : [...annotSel.selectedIds, strokeId];
        } else if (annotSel.contains(strokeId)) {
          ids = annotSel.selectedIds;
        } else {
          annotSel.replace(strokeId);
          ids = [strokeId];
        }
        // Capture a snapshot of all strokes at drag start. Every pointermove
        // re-translates FROM the snapshot using the cumulative cursor delta
        // (NOT a delta-from-last-frame mutation), so dragging back to origin
        // restores positions exactly. Optimistic state-only updates during
        // the move; ONE undo record + ONE server PUT fires on pointerup.
        const dragSnapshot = strokesRef.current.slice();
        dragStateRef.current = {
          pointerId: e.pointerId,
          startWX: wx,
          startWY: wy,
          movedIds: ids,
          snapshot: dragSnapshot,
        };
        const movedSet = new Set(ids);
        const onMove = (mv: PointerEvent) => {
          const st = dragStateRef.current;
          if (!st || mv.pointerId !== st.pointerId) return;
          const [cwx, cwy] = screenToWorld(mv.clientX, mv.clientY);
          const dx = cwx - st.startWX;
          const dy = cwy - st.startWY;
          // Drag-back-to-origin: restore exact references so the pointerup
          // shallow-equality check skips committing a no-op record.
          const next =
            dx === 0 && dy === 0
              ? st.snapshot
              : st.snapshot.map((s) => (movedSet.has(s.id) ? translateOne(s, dx, dy) : s));
          // Local React state only. No commitStrokes — no PUT, no undo push.
          setStrokesState(next);
        };
        const onUp = (up: PointerEvent) => {
          const st = dragStateRef.current;
          if (!st || up.pointerId !== st.pointerId) return;
          dragStateRef.current = null;
          document.removeEventListener('pointermove', onMove, true);
          document.removeEventListener('pointerup', onUp, true);
          document.removeEventListener('pointercancel', onUp, true);
          // Commit the gesture as ONE record. Skip on zero-movement
          // (click without drag past threshold or drag back to origin).
          const final = strokesRef.current;
          if (strokesShallowEqual(st.snapshot, final)) return;
          commitStrokes(
            st.snapshot,
            final,
            `move ${st.movedIds.length} stroke${st.movedIds.length === 1 ? '' : 's'}`
          );
        };
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onUp, true);
        return;
      }

      // Empty world — start a drag-select gesture. A bare click without
      // moving clears annotation selection (post-Wave-3 feedback: click-to-
      // deselect is back; Esc also still works).
      const addToSelection = e.shiftKey;
      let moved = false;
      const onMove = (mv: PointerEvent) => {
        if (!moved && !crossedDragThreshold(startClientX, startClientY, mv.clientX, mv.clientY)) {
          return;
        }
        moved = true;
        const [cwx, cwy] = screenToWorld(mv.clientX, mv.clientY);
        setMarquee({ ax: wx, ay: wy, bx: cwx, by: cwy });
      };
      const onUp = (_up: PointerEvent) => {
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        if (!moved) {
          // Click without movement on empty world → clear annotation
          // selection (post-Wave-3 user feedback). Shift-click preserves
          // existing selection for additive-mode workflows.
          if (!addToSelection) annotSel.clear();
          return;
        }
        const final = marqueeRef.current;
        setMarquee(null);
        if (!final) return;
        const xMin = Math.min(final.ax, final.bx);
        const xMax = Math.max(final.ax, final.bx);
        const yMin = Math.min(final.ay, final.by);
        const yMax = Math.max(final.ay, final.by);
        const hits: string[] = [];
        for (const s of strokesStoreRef.current.strokes) {
          // Anchored text inherits its host's bbox (selected with the host);
          // standalone text (Phase 21) has its own synthetic bbox and IS
          // marquee-selectable.
          if (s.tool === 'text' && s.anchorId != null && s.anchorId !== '') continue;
          const bb = strokeBBox(s);
          if (!bb) continue;
          if (bb.x + bb.w >= xMin && bb.x <= xMax && bb.y + bb.h >= yMin && bb.y <= yMax) {
            hits.push(s.id);
          }
        }
        // Marquee that captured no strokes — preserve existing selection.
        if (hits.length === 0) return;
        if (addToSelection) annotSel.add(hits);
        else annotSel.replace(hits);
      };
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    };

    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
    // commitStrokes is included defensively (it is a stable useCallback([]) ref,
    // so this never re-binds the listener) to remove the latent stale-closure
    // trap flagged in the Phase 24 frontend review.
  }, [tool, annotSel, elementSel, screenToWorld, strokesStore, commitStrokes]);

  // Latest marquee + strokes refs for the doc-level pointerup callback
  // (avoids re-binding the listener on every state tick).
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;
  const strokesStoreRef = useRef(strokesStore);
  strokesStoreRef.current = strokesStore;

  // Double-click enters text-edit mode: rect/ellipse (anchored text), sticky
  // (its own body), or a standalone text node (re-edit in place). Anchored text
  // nodes are edited via their host, so a data-anchor-id text node is skipped.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (tool !== 'move') return;
    const onDbl = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const node = target?.closest?.('[data-id][data-tool]');
      if (!node) return;
      const id = node.getAttribute('data-id');
      const t = node.getAttribute('data-tool');
      if (!id) return;
      if (t === 'rect' || t === 'ellipse' || t === 'sticky') {
        e.preventDefault();
        setEditingId(id);
        return;
      }
      if (t === 'text' && !node.getAttribute('data-anchor-id')) {
        e.preventDefault();
        setEditingId(id);
      }
    };
    document.addEventListener('dblclick', onDbl, true);
    return () => document.removeEventListener('dblclick', onDbl, true);
  }, [tool]);

  const commitText = useCallback(
    (anchorId: string, text: string) => {
      const trimmed = text.trim();
      const prev = strokesRef.current;
      const existing = prev.find((s) => s.tool === 'text' && s.anchorId === anchorId) as
        | TextStroke
        | undefined;
      let next: Stroke[];
      let label = 'edit text';
      if (trimmed.length === 0) {
        if (!existing) return; // nothing to do
        next = prev.filter((s) => s.id !== existing.id);
        label = 'delete text';
      } else if (existing) {
        if (existing.text === trimmed) return; // identity edit
        next = prev.map((s) => (s.id === existing.id ? { ...existing, text: trimmed } : s));
      } else {
        next = [
          ...prev,
          {
            id: rid(),
            tool: 'text',
            color: '#1a1a1a',
            fontSize: DEFAULT_FONT_SIZE,
            text: trimmed,
            anchorId,
          } as TextStroke,
        ];
        label = 'add text';
      }
      commitStrokes(prev, next, label);
    },
    [commitStrokes]
  );

  // Phase 21 — sticky body edit. Sticky text is freeform (newlines preserved,
  // no trim) and the card persists even when blank, so this only updates text.
  const commitStickyText = useCallback(
    (id: string, text: string) => {
      const prev = strokesRef.current;
      const existing = prev.find((s) => s.id === id && s.tool === 'sticky') as
        | StickyStroke
        | undefined;
      if (!existing || existing.text === text) return;
      const next = prev.map((s) => (s.id === id ? { ...existing, text } : s));
      commitStrokes(prev, next, 'edit sticky');
    },
    [commitStrokes]
  );

  // Phase 21 — re-edit an EXISTING standalone text node. Empty text deletes it
  // (same rule as anchored text).
  const commitStandaloneText = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim();
      const prev = strokesRef.current;
      const existing = prev.find((s) => s.id === id && s.tool === 'text') as TextStroke | undefined;
      if (!existing) return;
      if (trimmed.length === 0) {
        commitStrokes(
          prev,
          prev.filter((s) => s.id !== id),
          'delete text'
        );
        return;
      }
      if (existing.text === trimmed) return;
      commitStrokes(
        prev,
        prev.map((s) => (s.id === id ? { ...existing, text: trimmed } : s)),
        'edit text'
      );
    },
    [commitStrokes]
  );

  // Phase 21 — born-on-commit standalone text (from the text-tool caret). An
  // empty caret persists nothing — ONE undo record only when real text lands.
  const createStandaloneText = useCallback(
    (x: number, y: number, text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      const prev = strokesRef.current;
      const id = rid();
      const next: Stroke[] = [
        ...prev,
        { id, tool: 'text', color, fontSize: DEFAULT_FONT_SIZE, text: trimmed, x, y },
      ];
      commitStrokes(prev, next, 'add text');
      if (annotSel) annotSel.replace(id);
    },
    [commitStrokes, color, annotSel]
  );

  // Phase 21 — resolve what (if anything) is being edited, and route a single
  // commit call to the right writer. `editingId` doubles as the host id
  // (anchored) OR the sticky/standalone stroke id; `pendingText` is the
  // not-yet-born text caret.
  const editingTarget = useMemo<EditingTarget>(() => {
    if (pendingText) return { kind: 'pending', x: pendingText.x, y: pendingText.y };
    if (!editingId) return null;
    const host = anchorsById.get(editingId);
    if (host) return { kind: 'anchored', anchorId: editingId, host };
    const s = strokesById.get(editingId);
    if (s?.tool === 'sticky') return { kind: 'sticky', sticky: s };
    if (s?.tool === 'text' && (s.anchorId == null || s.anchorId === ''))
      return { kind: 'standalone', text: s };
    return null;
  }, [pendingText, editingId, anchorsById, strokesById]);

  const editingTargetRef = useRef(editingTarget);
  editingTargetRef.current = editingTarget;

  const commitEditing = useCallback(
    (text: string) => {
      const target = editingTargetRef.current;
      setEditingId(null);
      setPendingText(null);
      if (!target) return;
      if (target.kind === 'anchored') commitText(target.anchorId, text);
      else if (target.kind === 'sticky') commitStickyText(target.sticky.id, text);
      else if (target.kind === 'standalone') commitStandaloneText(target.text.id, text);
      else if (target.kind === 'pending') createStandaloneText(target.x, target.y, text);
    },
    [commitText, commitStickyText, commitStandaloneText, createStandaloneText]
  );

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setPendingText(null);
  }, []);

  // Keyboard: arrow nudge + Backspace/Delete remove selected strokes.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!annotSel) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (annotSel.selectedIds.length === 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        strokesStore.translateStrokes(annotSel.selectedIds, -step, 0);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        strokesStore.translateStrokes(annotSel.selectedIds, step, 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        strokesStore.translateStrokes(annotSel.selectedIds, 0, -step);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        strokesStore.translateStrokes(annotSel.selectedIds, 0, step);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        strokesStore.deleteStrokes(annotSel.selectedIds);
        annotSel.clear();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [annotSel, strokesStore]);

  // Selected stroke halos — bboxes in world coords, vector-effect non-scaling-stroke.
  const selectedStrokes = useMemo(() => {
    if (!annotSel || annotSel.selectedIds.length === 0) return [] as Stroke[];
    const out: Stroke[] = [];
    for (const id of annotSel.selectedIds) {
      const s = strokesById.get(id);
      if (s) out.push(s);
    }
    return out;
  }, [annotSel, strokesById]);

  return (
    <StrokesStoreContext.Provider value={strokesStore}>
      <>
        <AnnotationsInput
          isActive={isActive}
          visible={visible}
          cursor={tools.find((t) => t.id === tool)?.cursor ?? 'crosshair'}
          beginStroke={beginStroke}
          moveStroke={moveStroke}
          endStroke={endStroke}
          onLeave={() => setGhost(null)}
        />
        {visible ? (
          <AnnotationsSvg
            worldRef={worldRef}
            strokes={renderStrokes}
            anchorsById={anchorsById}
            selectMode={tool === 'move'}
            selectedStrokes={selectedStrokes}
            marquee={marquee}
            ghost={ghostPreview}
            editingTarget={editingTarget}
            onCommitEdit={commitEditing}
            onCancelEdit={cancelEditing}
          />
        ) : null}
        <AnnotationContextToolbar />
        {visible && tool === 'move' ? <AnnotationResizeOverlay store={strokesStore} /> : null}
        {isActive ? (
          <AnnotationsChrome
            tool={tool}
            color={color}
            setColor={setColor}
            stickyColor={stickyColor}
            setStickyColor={setStickyColor}
            supportsFill={supportsFill}
            fill={fill}
            setFill={setFill}
            supportsThickness={supportsThickness}
            thickness={thickness}
            setThickness={setThickness}
          />
        ) : null}
      </>
    </StrokesStoreContext.Provider>
  );
}
AnnotationsLayer.displayName = 'AnnotationsLayer';

// ─────────────────────────────────────────────────────────────────────────────
// Input — transparent overlay portaled into the host (.dc-canvas). Receives
// pointer events for draw / erase ONLY; viewport gestures (middle-mouse,
// space-pan, wheel) reach `useViewportController` because we never call
// stopPropagation and the controller listens at the host level alongside us.

function AnnotationsInput({
  isActive,
  visible,
  cursor,
  beginStroke,
  moveStroke,
  endStroke,
  onLeave,
}: {
  isActive: boolean;
  visible: boolean;
  /** Active-tool cursor (crosshair / text / cell) — applied to the capture
   *  overlay so the affordance shows over the whole canvas while drawing. */
  cursor: string;
  beginStroke: (e: ReactPointerEvent<HTMLDivElement>, spaceHeld: boolean) => boolean;
  moveStroke: (e: ReactPointerEvent<HTMLDivElement>) => void;
  endStroke: () => void;
  /** Phase 24 — clear the ghost placeholder when the pointer leaves the canvas. */
  onLeave: () => void;
}) {
  const worldRef = useWorldRefContext();
  const host = worldRef?.current?.parentElement ?? null;
  const [, force] = useState({});
  // Host may not be attached on first commit; nudge a re-render once it is.
  useEffect(() => {
    if (host) return;
    const id = setTimeout(() => force({}), 0);
    return () => clearTimeout(id);
  }, [host]);

  const spaceHeldRef = useRef(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditable(e.target)) spaceHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    document.addEventListener('keydown', down, true);
    document.addEventListener('keyup', up, true);
    return () => {
      document.removeEventListener('keydown', down, true);
      document.removeEventListener('keyup', up, true);
    };
  }, []);

  if (!host) return null;
  const interactive = isActive && visible;
  return createPortal(
    <div
      className="dc-annot-input"
      aria-hidden="true"
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? cursor : 'default',
      }}
      onPointerDown={(e) => {
        beginStroke(e, spaceHeldRef.current);
      }}
      onPointerMove={moveStroke}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={onLeave}
    />,
    host
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG — portaled INTO `.dc-world` so the world's CSS zoom + translate apply
// natively. `vector-effect="non-scaling-stroke"` keeps stroke px-thick at any
// zoom level. `pointer-events: none` on the container — strokes are decorative
// for now (Phase 5.1 Task 6 will reintroduce hit-test via the selection store).

function AnnotationsSvg({
  worldRef,
  strokes,
  anchorsById,
  selectMode,
  selectedStrokes,
  marquee,
  ghost,
  editingTarget,
  onCommitEdit,
  onCancelEdit,
}: {
  worldRef: ReturnType<typeof useWorldRefContext>;
  strokes: readonly Stroke[];
  anchorsById: Map<string, RectStroke | EllipseStroke>;
  selectMode: boolean;
  selectedStrokes: readonly Stroke[];
  marquee: { ax: number; ay: number; bx: number; by: number } | null;
  ghost: GhostDescriptor | null;
  editingTarget: EditingTarget;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
}) {
  const [, force] = useState({});
  useEffect(() => {
    if (worldRef?.current) return;
    const id = setTimeout(() => force({}), 0);
    return () => clearTimeout(id);
  }, [worldRef]);
  const target = worldRef?.current ?? null;
  if (!target) return null;
  // A sticky whose body is being edited hides its read-only text so the
  // editor textarea (rendered below at the same bbox) isn't double-painted.
  const editingStickyId = editingTarget?.kind === 'sticky' ? editingTarget.sticky.id : null;
  const anchoredExisting =
    editingTarget?.kind === 'anchored'
      ? (strokes.find((s) => s.tool === 'text' && s.anchorId === editingTarget.anchorId) as
          | TextStroke
          | undefined)
      : undefined;
  return createPortal(
    <svg className="dc-annot-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Phase 21 — soft "lifted paper" drop shadow for sticky notes. */}
        <filter id="dc-sticky-shadow" x="-25%" y="-25%" width="150%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.28" />
        </filter>
      </defs>
      {strokes.map((s) => (
        <StrokeNode
          key={s.id}
          stroke={s}
          anchorsById={anchorsById}
          interactive={selectMode}
          editing={s.id === editingStickyId}
        />
      ))}
      {selectedStrokes.map((s) => (
        <SelectionHalo
          key={`halo-${s.id}`}
          stroke={s}
          anchorsById={anchorsById}
          multi={selectedStrokes.length > 1}
        />
      ))}
      <AnnotGroupBbox selectedStrokes={selectedStrokes} anchorsById={anchorsById} />
      {marquee ? (
        <rect
          className="dc-annot-marquee"
          x={Math.min(marquee.ax, marquee.bx)}
          y={Math.min(marquee.ay, marquee.by)}
          width={Math.abs(marquee.bx - marquee.ax)}
          height={Math.abs(marquee.by - marquee.ay)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {ghost ? <GhostPreview ghost={ghost} /> : null}
      {editingTarget?.kind === 'anchored' ? (
        <TextEditor
          anchorId={editingTarget.anchorId}
          host={editingTarget.host}
          existing={anchoredExisting}
          onCommit={(_anchorId, text) => onCommitEdit(text)}
          onCancel={onCancelEdit}
        />
      ) : null}
      {editingTarget?.kind === 'sticky' ? (
        <StickyEditor
          sticky={editingTarget.sticky}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : null}
      {editingTarget?.kind === 'standalone' ? (
        <StandaloneTextEditor
          x={editingTarget.text.x ?? 0}
          y={editingTarget.text.y ?? 0}
          fontSize={editingTarget.text.fontSize}
          color={editingTarget.text.color}
          initialText={editingTarget.text.text}
          bold={editingTarget.text.bold}
          strike={editingTarget.text.strike}
          align={editingTarget.text.align ?? 'left'}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : null}
      {editingTarget?.kind === 'pending' ? (
        <StandaloneTextEditor
          x={editingTarget.x}
          y={editingTarget.y}
          fontSize={DEFAULT_FONT_SIZE}
          color={DEFAULT_COLOR}
          initialText=""
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
        />
      ) : null}
    </svg>,
    target
  );
}

function TextEditor({
  anchorId,
  host,
  existing,
  onCommit,
  onCancel,
}: {
  anchorId: string;
  host: RectStroke | EllipseStroke | null;
  existing: TextStroke | undefined;
  onCommit: (anchorId: string, text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const initial = existing?.text ?? '';
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select all so a re-edit replaces existing text easily.
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } catch {
      /* selection API blocked */
    }
  }, []);

  // Commit on outside click; cancel-on-Esc handled in onKeyDown below.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onCommit(anchorId, el.innerText || '');
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [anchorId, onCommit]);

  if (!host) return null;
  const bbox = strokeBBox(host);
  if (!bbox) return null;
  const fontSize = existing?.fontSize ?? DEFAULT_FONT_SIZE;
  // Phase 24 — match the committed render's bold / strike / align (anchored
  // default align = centre).
  const align = existing?.align ?? 'center';
  return (
    <foreignObject x={bbox.x} y={bbox.y} width={Math.max(20, bbox.w)} height={Math.max(20, bbox.h)}>
      <div
        ref={ref}
        className="dc-annot-editor"
        contentEditable
        suppressContentEditableWarning
        aria-label="Edit annotation text"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
          padding: '0 8px',
          boxSizing: 'border-box',
          textAlign: align,
          color: existing?.color ?? '#1a1a1a',
          fontSize: `${fontSize}px`,
          fontFamily: 'var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontWeight: existing?.bold ? 700 : undefined,
          textDecoration: existing?.strike ? 'line-through' : undefined,
          lineHeight: 1.25,
          outline: 'none',
          background: 'transparent',
          cursor: 'text',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const el = ref.current;
            onCommit(anchorId, el?.innerText || '');
          }
        }}
      >
        {initial}
      </div>
    </foreignObject>
  );
}

// Phase 21 — sticky body editor. A textarea hosted in a foreignObject at the
// card's bbox, so it word-wraps + moves with CSS zoom natively. Commit on blur,
// cancel on Esc; Enter inserts a newline (sticky is multi-line).
function StickyEditor({
  sticky,
  onCommit,
  onCancel,
}: {
  sticky: StickyStroke;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  // A flex-centered contentEditable (NOT a textarea) so the edit view matches
  // the committed `.dc-sticky-body` exactly — text stays centered, no jump on
  // commit. Multi-line: Enter inserts a line break; Esc cancels; blur commits.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } catch {
      /* selection API blocked */
    }
  }, []);
  const x = Math.min(sticky.x, sticky.x + sticky.w);
  const y = Math.min(sticky.y, sticky.y + sticky.h);
  const w = Math.abs(sticky.w);
  const h = Math.abs(sticky.h);
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        ref={ref}
        className="dc-annot-editor dc-sticky-body"
        contentEditable
        suppressContentEditableWarning
        aria-label="Edit sticky note text"
        style={{ ...stickyBodyStyle(sticky), outline: 'none', cursor: 'text' }}
        onBlur={() => onCommit(ref.current?.innerText ?? '')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      >
        {sticky.text}
      </div>
    </foreignObject>
  );
}

// Phase 21 — standalone text editor. A single-line contentEditable box anchored
// at the world (x, y). Enter / blur / outside-click commit; Esc cancels.
function StandaloneTextEditor({
  x,
  y,
  fontSize,
  color,
  initialText,
  bold,
  strike,
  align,
  onCommit,
  onCancel,
}: {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  initialText: string;
  bold?: boolean;
  strike?: boolean;
  align?: TextAlign;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } catch {
      /* selection API blocked */
    }
  }, []);
  // Commit on outside click.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onCommit(el.innerText || '');
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onCommit]);
  return (
    <foreignObject x={x} y={y} width={600} height={Math.max(24, fontSize * 1.6)}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        ref={ref}
        className="dc-annot-editor"
        contentEditable
        suppressContentEditableWarning
        aria-label="Edit text"
        style={{
          display: 'inline-block',
          minWidth: '8px',
          whiteSpace: 'pre',
          padding: '0 2px',
          color,
          fontSize: `${fontSize}px`,
          fontFamily: 'var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontWeight: bold ? 700 : undefined,
          textDecoration: strike ? 'line-through' : undefined,
          textAlign: align ?? 'left',
          lineHeight: 1.2,
          outline: 'none',
          background: 'transparent',
          cursor: 'text',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(ref.current?.innerText || '');
          }
        }}
      >
        {initialText}
      </div>
    </foreignObject>
  );
}

function SelectionHalo({
  stroke,
  anchorsById,
  multi,
}: {
  stroke: Stroke;
  anchorsById: Map<string, RectStroke | EllipseStroke>;
  multi: boolean;
}) {
  const bbox = strokeBBox(stroke, anchorsById);
  if (!bbox) return null;
  // T17 + post-Wave-2 fix — annotation halo idioms:
  //   * Single select → 2 px solid border, NO ring, NO corner ticks.
  //     The resize overlay (T23) renders the corner handles in screen-space,
  //     so painting SVG ticks here too would duplicate them. The element
  //     halo uses CSS box-shadow for the 18% ring; the SVG equivalent (a
  //     second outline rect) reads as "double frame" rather than a halo —
  //     user feedback flagged this immediately. Solid 2 px is enough signal
  //     once the resize handles claim the corners.
  //   * Multi member → 1.5 px solid full accent, no ring, no ticks (group
  //     bbox above carries the container affordance).
  // Marquee STAYS dashed (drawn elsewhere) — dashed is reserved for the
  // ambient group-container + active-gesture idioms per DDR-046 rev 2.
  const pad = 4;
  return (
    <rect
      x={bbox.x - pad}
      y={bbox.y - pad}
      width={bbox.w + pad * 2}
      height={bbox.h + pad * 2}
      fill="none"
      stroke="var(--maude-hud-accent, #d63b1f)"
      strokeWidth={multi ? 1.5 : 2}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      rx={2}
    />
  );
}

// T17 — group bbox dashed rect for multi-stroke annotation selection. Mirrors
// the element-side GroupBbox idiom (1 px dashed accent + 6 × 6 corner handles).
function AnnotGroupBbox({
  selectedStrokes,
  anchorsById,
}: {
  selectedStrokes: readonly Stroke[];
  anchorsById: Map<string, RectStroke | EllipseStroke>;
}) {
  if (selectedStrokes.length < 2) return null;
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const s of selectedStrokes) {
    const b = strokeBBox(s, anchorsById);
    if (!b) continue;
    any = true;
    if (b.x < xMin) xMin = b.x;
    if (b.y < yMin) yMin = b.y;
    if (b.x + b.w > xMax) xMax = b.x + b.w;
    if (b.y + b.h > yMax) yMax = b.y + b.h;
  }
  if (!any) return null;
  const pad = 6;
  const x = xMin - pad;
  const y = yMin - pad;
  const w = xMax - xMin + pad * 2;
  const h = yMax - yMin + pad * 2;
  const handle = 6;
  const inset = 3;
  const handles = [
    { corner: 'nw', x: x - inset, y: y - inset },
    { corner: 'ne', x: x + w - handle + inset, y: y - inset },
    { corner: 'sw', x: x - inset, y: y + h - handle + inset },
    { corner: 'se', x: x + w - handle + inset, y: y + h - handle + inset },
  ];
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke="var(--maude-hud-accent, #d63b1f)"
        strokeWidth={1}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
        rx={2}
      />
      {handles.map((c) => (
        <rect
          key={c.corner}
          x={c.x}
          y={c.y}
          width={handle}
          height={handle}
          fill="var(--maude-hud-accent, #d63b1f)"
          stroke="var(--maude-chrome-bg-0, #ffffff)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          rx={1}
        />
      ))}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stroke renderer

/**
 * Phase 24 — inline style for a sticky body (read view + editor share it so the
 * read↔edit swap doesn't shift). Applies bold / strike / align atop the
 * `.dc-sticky-body` defaults (top-left).
 */
function stickyBodyStyle(s: StickyStroke): CSSProperties {
  const align = s.align ?? 'left';
  return {
    fontSize: `${s.fontSize}px`,
    fontWeight: s.bold ? 700 : undefined,
    textDecoration: s.strike ? 'line-through' : undefined,
    textAlign: align,
    justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
  };
}

/**
 * Phase 24 — the translucent cursor-following ghost placeholder. Pure chrome:
 * `pointer-events:none`, never added to `strokes`, so it can't be selected,
 * hit-tested, erased, or persisted. Static (no animation) — reduced-motion safe.
 * Geometry mirrors what a click/tap would create at the cursor (shape +
 * SHAPE_DEFAULT_SIZE top-left at cursor; sticky default square; text I-beam).
 */
function GhostPreview({ ghost }: { ghost: GhostDescriptor }) {
  const { x, y } = ghost;
  if (ghost.kind === 'text') {
    const h = 22;
    return (
      <path
        d={`M${x - 4} ${y}H${x + 4}M${x} ${y}V${y + h}M${x - 4} ${y + h}H${x + 4}`}
        stroke={ghost.color}
        strokeWidth={1.5}
        strokeOpacity={0.5}
        fill="none"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
  }
  if (ghost.kind === 'sticky') {
    const s = STICKY_DEFAULT_W;
    return (
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={STICKY_CORNER_RADIUS}
        ry={STICKY_CORNER_RADIUS}
        fill={ghost.color}
        fillOpacity={0.32}
        stroke={ghost.color}
        strokeOpacity={0.55}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    );
  }
  // shape — dashed outline of the default-sized primitive at the cursor.
  const sz = SHAPE_DEFAULT_SIZE;
  const common = {
    fill: 'none',
    stroke: ghost.color,
    strokeWidth: 2,
    strokeOpacity: 0.5,
    strokeDasharray: '6 5',
    vectorEffect: 'non-scaling-stroke' as const,
    pointerEvents: 'none' as const,
  };
  if (ghost.shapeKind === 'circle') {
    return <ellipse cx={x + sz / 2} cy={y + sz / 2} rx={sz / 2} ry={sz / 2} {...common} />;
  }
  if (ghost.shapeKind === 'square' || ghost.shapeKind === 'rounded') {
    const r = ghost.shapeKind === 'rounded' ? 8 : 0;
    return <rect x={x} y={y} width={sz} height={sz} rx={r} ry={r} {...common} />;
  }
  return <polygon points={polygonPoints(ghost.shapeKind, x, y, sz, sz)} {...common} />;
}

function StrokeNode({
  stroke,
  anchorsById,
  interactive,
  editing = false,
}: {
  stroke: Stroke;
  anchorsById: Map<string, RectStroke | EllipseStroke>;
  interactive: boolean;
  /** Phase 21 — sticky-only: hide the read-only body while its editor is up. */
  editing?: boolean;
}) {
  // In Move mode, individual stroke nodes claim pointer events so we can
  // hit-test them from the doc-level capture listener. In draw mode the
  // overlay above handles input, so the strokes themselves stay inert.
  const hitMode = interactive ? 'visiblePainted' : ('none' as const);
  const strokeHit = interactive ? 'stroke' : ('none' as const);
  if (stroke.tool === 'text') {
    // Anchored text renders centered in its host; standalone (Phase 21) renders
    // top-left-anchored at its own world (x, y).
    // Phase 24 — bold / strike / align applied to the rendered <text>.
    const textStyle = {
      fontFamily: 'var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      fontWeight: stroke.bold ? 700 : undefined,
      textDecoration: stroke.strike ? 'line-through' : undefined,
    } as const;
    if (stroke.anchorId != null && stroke.anchorId !== '') {
      const host = anchorsById.get(stroke.anchorId);
      const bbox = host ? strokeBBox(host) : null;
      if (!bbox) return null;
      const cy = bbox.y + bbox.h / 2;
      const align = stroke.align ?? 'center';
      const pad = 8;
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const tx =
        align === 'left'
          ? bbox.x + pad
          : align === 'right'
            ? bbox.x + bbox.w - pad
            : bbox.x + bbox.w / 2;
      return (
        <text
          data-id={stroke.id}
          data-tool="text"
          data-anchor-id={stroke.anchorId}
          data-font-size={stroke.fontSize}
          x={tx}
          y={cy}
          fill={stroke.color}
          fontSize={stroke.fontSize}
          textAnchor={anchor}
          dominantBaseline="middle"
          style={textStyle}
        >
          {stroke.text}
        </text>
      );
    }
    const align = stroke.align ?? 'left';
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    return (
      <text
        data-id={stroke.id}
        data-tool="text"
        data-font-size={stroke.fontSize}
        x={stroke.x ?? 0}
        y={stroke.y ?? 0}
        fill={stroke.color}
        fontSize={stroke.fontSize}
        textAnchor={anchor}
        dominantBaseline="hanging"
        pointerEvents={interactive ? 'visiblePainted' : 'none'}
        style={textStyle}
      >
        {stroke.text}
      </text>
    );
  }
  if (stroke.tool === 'sticky') {
    const x = Math.min(stroke.x, stroke.x + stroke.w);
    const y = Math.min(stroke.y, stroke.y + stroke.h);
    const w = Math.abs(stroke.w);
    const h = Math.abs(stroke.h);
    const r = stroke.cornerRadius ?? STICKY_CORNER_RADIUS;
    return (
      <g data-id={stroke.id} data-tool="sticky" pointerEvents={hitMode}>
        {/* Paper card: soft drop shadow + hairline edge so it reads as a
            lifted sticky, not a flat colored box (FigJam-style). */}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill={stroke.color}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          filter="url(#dc-sticky-shadow)"
        />
        {editing ? null : (
          <foreignObject x={x} y={y} width={w} height={h} pointerEvents="none">
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              className="dc-sticky-body"
              style={stickyBodyStyle(stroke)}
            >
              {stroke.text}
            </div>
          </foreignObject>
        )}
      </g>
    );
  }
  const common = {
    'data-id': stroke.id,
    'data-tool': stroke.tool,
    stroke: stroke.color,
    strokeWidth: stroke.width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  if (stroke.tool === 'pen') {
    return <path {...common} fill="none" d={penPathD(stroke.points)} pointerEvents={strokeHit} />;
  }
  if (stroke.tool === 'rect') {
    const x = Math.min(stroke.x, stroke.x + stroke.w);
    const y = Math.min(stroke.y, stroke.y + stroke.h);
    const r = stroke.cornerRadius ?? 0;
    return (
      <rect
        {...common}
        fill={stroke.fill ?? 'none'}
        x={x}
        y={y}
        width={Math.abs(stroke.w)}
        height={Math.abs(stroke.h)}
        rx={r}
        ry={r}
        pointerEvents={hitMode}
      />
    );
  }
  if (stroke.tool === 'ellipse') {
    return (
      <ellipse
        {...common}
        fill={stroke.fill ?? 'none'}
        cx={stroke.cx}
        cy={stroke.cy}
        rx={Math.max(0, stroke.rx)}
        ry={Math.max(0, stroke.ry)}
        pointerEvents={hitMode}
      />
    );
  }
  if (stroke.tool === 'polygon') {
    const nx = Math.min(stroke.x, stroke.x + stroke.w);
    const ny = Math.min(stroke.y, stroke.y + stroke.h);
    return (
      <polygon
        {...common}
        data-shape={stroke.shape}
        fill={stroke.fill ?? 'none'}
        points={polygonPoints(stroke.shape, nx, ny, Math.abs(stroke.w), Math.abs(stroke.h))}
        strokeDasharray={stroke.dashed ? '6 4' : undefined}
        pointerEvents={hitMode}
      />
    );
  }
  // arrow — Phase 24 renders the SAME ordered primitives the serializer emits
  // (canvas-arrowheads), so the on-canvas and persisted forms can never drift.
  return (
    <g {...common} fill="none" pointerEvents={hitMode}>
      {arrowPrimitives(stroke).map((p, i) => renderArrowPrimitive(p, i))}
    </g>
  );
}

/** Map one arrow primitive to JSX (heads inherit stroke from the parent <g>). */
function renderArrowPrimitive(p: SvgPrimitive, key: number): JSX.Element {
  switch (p.el) {
    case 'line':
      return (
        <line
          key={key}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          strokeDasharray={p.dash ? '6 4' : undefined}
        />
      );
    case 'path':
      return <path key={key} d={p.d} strokeDasharray={p.dash ? '6 4' : undefined} />;
    case 'polyline':
      return <polyline key={key} points={p.points} fill={p.fill} />;
    case 'polygon':
      return <polygon key={key} points={p.points} fill={p.fill} />;
    case 'circle':
      return <circle key={key} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome — color swatches + (optional fill picker) + (optional thickness chip)
// + presentation toggle + help button.

function AnnotationsChrome({
  tool,
  color,
  setColor,
  stickyColor,
  setStickyColor,
  supportsFill,
  fill,
  setFill,
  supportsThickness,
  thickness,
  setThickness,
}: {
  tool: Tool;
  color: string;
  setColor: (c: string) => void;
  stickyColor: string;
  setStickyColor: (c: string) => void;
  supportsFill: boolean;
  fill: string | null;
  setFill: (f: string | null) => void;
  supportsThickness: boolean;
  thickness: Thickness;
  setThickness: (t: Thickness) => void;
}) {
  // Sticky tool picks a paper tint (its own palette); every other draw tool
  // picks ink from the stroke PALETTE.
  if (tool === 'sticky') {
    return (
      <div className="dc-annot-chrome" role="toolbar" aria-label="Sticky note tools">
        <div className="dc-annot-swatches" role="radiogroup" aria-label="Sticky color">
          {STICKY_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className="dc-annot-sw"
              aria-pressed={c === stickyColor}
              aria-label={`Sticky color ${c}`}
              title={`Sticky color ${c}`}
              style={{ background: c }}
              onClick={() => setStickyColor(c)}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="dc-annot-chrome" role="toolbar" aria-label="Annotation tools">
      <div className="dc-annot-swatches" role="radiogroup" aria-label="Stroke color">
        {STROKE_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className="dc-annot-sw"
            aria-pressed={c === color}
            aria-label={`Color ${c}`}
            title={`Color ${c}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      {supportsFill ? (
        <>
          <div className="dc-annot-sep" />
          <div className="dc-annot-swatches" role="radiogroup" aria-label="Fill color">
            <button
              type="button"
              className="dc-annot-fill dc-annot-fill--none"
              aria-pressed={fill == null}
              aria-label="No fill"
              title="No fill"
              onClick={() => setFill(null)}
            />
            {FILL_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className="dc-annot-fill"
                aria-pressed={c === fill}
                aria-label={`Fill ${c}`}
                title={`Fill ${c}`}
                style={{ background: c }}
                onClick={() => setFill(c)}
              />
            ))}
          </div>
        </>
      ) : null}
      {supportsThickness ? (
        <>
          <div className="dc-annot-sep" />
          <button
            type="button"
            className="dc-annot-ibtn"
            aria-label="Thin stroke"
            aria-pressed={thickness === STROKE_WIDTH_THIN}
            title="Thin (3px)"
            onClick={() => setThickness(STROKE_WIDTH_THIN)}
          >
            <IconLineThin />
          </button>
          <button
            type="button"
            className="dc-annot-ibtn"
            aria-label="Thick stroke"
            aria-pressed={thickness === STROKE_WIDTH_THICK}
            title="Thick (6px)"
            onClick={() => setThickness(STROKE_WIDTH_THICK)}
          >
            <IconLineThick />
          </button>
        </>
      ) : null}
    </div>
  );
}
