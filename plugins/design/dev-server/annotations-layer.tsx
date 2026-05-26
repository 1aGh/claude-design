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
import { useViewportControllerContext, useWorldRefContext } from './canvas-lib.tsx';
import { createAnnotationStrokesCommand } from './commands/annotation-strokes-command.ts';
import { crossedDragThreshold } from './input-router.tsx';
import { AnnotationResizeOverlay } from './use-annotation-resize.tsx';
import { useAnnotationSelectionOptional } from './use-annotation-selection.tsx';
import { useAnnotationsVisibility } from './use-annotations-visibility.tsx';
import { useSelectionSetOptional } from './use-selection-set.tsx';
import { useToolMode } from './use-tool-mode.tsx';
import { useUndoStackOptional } from './use-undo-stack.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types

type WorldPoint = readonly [number, number];

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
export interface ArrowStroke {
  id: string;
  tool: 'arrow';
  color: string;
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface TextStroke {
  id: string;
  tool: 'text';
  color: string;
  fontSize: number;
  text: string;
  anchorId: string;
}
export type Stroke = PenStroke | RectStroke | EllipseStroke | ArrowStroke | TextStroke;

const PALETTE = [
  '#d63b1f', // accent red — first slot mirrors the default DS accent
  '#f5a623', // amber
  '#1a8f3e', // green
  '#1d6cf0', // blue
  '#7a4ad3', // purple
  '#1a1a1a', // ink
] as const;
type PaletteColor = (typeof PALETTE)[number];
const DEFAULT_COLOR: PaletteColor = PALETTE[0];

const FILL_PALETTE = [
  '#fff4d6', // amber tint
  '#e6f4ea', // green tint
  '#e3edff', // blue tint
  '#f0e8fb', // purple tint
  '#ffe5e0', // red tint
  '#f4f1ee', // paper
] as const;

const STROKE_WIDTH_THIN = 3;
const STROKE_WIDTH_THICK = 6;
type Thickness = typeof STROKE_WIDTH_THIN | typeof STROKE_WIDTH_THICK;

const FONT_SIZE_MEDIUM = 14;
const DEFAULT_FONT_SIZE = FONT_SIZE_MEDIUM;

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

export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = 12 + width * 2;
  const wing = Math.PI / 7;
  const ax = x2 - Math.cos(angle - wing) * len;
  const ay = y2 - Math.sin(angle - wing) * len;
  const bx = x2 - Math.cos(angle + wing) * len;
  const by = y2 - Math.sin(angle + wing) * len;
  return `${ax},${ay} ${x2},${y2} ${bx},${by}`;
}

function strokeToSvgEl(s: Stroke): string {
  if (s.tool === 'text') {
    return `<text data-id="${esc(s.id)}" data-tool="text" data-anchor-id="${esc(
      s.anchorId
    )}" data-font-size="${s.fontSize}" fill="${esc(
      s.color
    )}" text-anchor="middle" dominant-baseline="middle">${esc(s.text)}</text>`;
  }
  const common = `data-id="${esc(s.id)}" data-tool="${s.tool}" stroke="${esc(s.color)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  if (s.tool === 'pen') {
    return `<path ${common} fill="none" d="${penPathD(s.points)}" pointer-events="stroke"/>`;
  }
  if (s.tool === 'rect') {
    const fill = s.fill ? esc(s.fill) : 'none';
    return `<rect ${common} fill="${fill}" x="${s.x}" y="${s.y}" width="${Math.max(
      0,
      s.w
    )}" height="${Math.max(0, s.h)}"/>`;
  }
  if (s.tool === 'ellipse') {
    const fill = s.fill ? esc(s.fill) : 'none';
    return `<ellipse ${common} fill="${fill}" cx="${s.cx}" cy="${s.cy}" rx="${Math.max(
      0,
      s.rx
    )}" ry="${Math.max(0, s.ry)}"/>`;
  }
  const head = arrowHeadPoints(s.x1, s.y1, s.x2, s.y2, s.width);
  return `<g ${common} fill="none"><line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/><polyline points="${head}" fill="${esc(s.color)}"/></g>`;
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
      if (tool === 'rect') {
        const x = Number.parseFloat(el.getAttribute('x') || '0');
        const y = Number.parseFloat(el.getAttribute('y') || '0');
        const w = Number.parseFloat(el.getAttribute('width') || '0');
        const h = Number.parseFloat(el.getAttribute('height') || '0');
        const fill = parseFill(el.getAttribute('fill'));
        out.push({ id, tool: 'rect', color, width, x, y, w, h, fill });
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
      if (tool === 'arrow') {
        const line = el.querySelector('line');
        if (line) {
          out.push({
            id,
            tool: 'arrow',
            color,
            width,
            x1: Number.parseFloat(line.getAttribute('x1') || '0'),
            y1: Number.parseFloat(line.getAttribute('y1') || '0'),
            x2: Number.parseFloat(line.getAttribute('x2') || '0'),
            y2: Number.parseFloat(line.getAttribute('y2') || '0'),
          });
        }
        continue;
      }
      if (tool === 'text') {
        const anchorId = el.getAttribute('data-anchor-id') || '';
        const fontSize =
          Number.parseFloat(el.getAttribute('data-font-size') || String(DEFAULT_FONT_SIZE)) ||
          DEFAULT_FONT_SIZE;
        const inkColor = el.getAttribute('fill') || color;
        out.push({
          id,
          tool: 'text',
          color: inkColor,
          fontSize,
          text: (el.textContent || '').trim(),
          anchorId,
        });
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
  if (s.tool === 'text') return false;
  const t = Math.max(tol, 'width' in s ? s.width : 2);
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

function normalizeRect(r: RectStroke): RectStroke {
  if (r.w >= 0 && r.h >= 0) return r;
  return {
    ...r,
    x: Math.min(r.x, r.x + r.w),
    y: Math.min(r.y, r.y + r.h),
    w: Math.abs(r.w),
    h: Math.abs(r.h),
  };
}

function isStrokeMeaningful(s: Stroke): boolean {
  if (s.tool === 'pen') return s.points.length >= 2;
  if (s.tool === 'rect') return Math.abs(s.w) >= 4 && Math.abs(s.h) >= 4;
  if (s.tool === 'ellipse') return s.rx >= 2 && s.ry >= 2;
  if (s.tool === 'text') return s.text.trim().length > 0;
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
  if (s.tool === 'rect') {
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
  // text → inherit from anchor
  const host = anchors?.get(s.anchorId);
  return host ? strokeBBox(host) : null;
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
     32px tall → top edge ~ bottom:48px). 8 px gap → chrome at bottom:60px. */
  position: absolute;
  left: 50%;
  bottom: 60px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--u-bg-0, var(--bg-0, rgba(255,255,255,0.98)));
  border: 1px solid var(--u-fg-0, #1c1917);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  color: var(--u-fg-0, rgba(40,30,20,0.85));
  z-index: 6;
  box-shadow: 0 6px 24px color-mix(in oklab, var(--u-fg-0, #1c1917) 10%, transparent);
  user-select: none;
}
.dc-annot-chrome .dc-annot-swatches { display: flex; gap: 4px; }
.dc-annot-chrome .dc-annot-sw {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  cursor: pointer;
  padding: 0;
  appearance: none;
}
.dc-annot-chrome .dc-annot-sw[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--accent, #d63b1f);
  border-color: transparent;
}
.dc-annot-chrome .dc-annot-sw:focus-visible {
  outline: 2px solid var(--accent, #d63b1f);
  outline-offset: 2px;
}
.dc-annot-chrome .dc-annot-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(0,0,0,0.08);
  margin: 0 2px;
}
.dc-annot-chrome .dc-annot-fill {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.18);
  cursor: pointer;
  padding: 0;
  appearance: none;
  position: relative;
}
.dc-annot-chrome .dc-annot-fill--none {
  background: #fff;
}
.dc-annot-chrome .dc-annot-fill--none::after {
  content: "";
  position: absolute; inset: 2px;
  background:
    linear-gradient(135deg, transparent 47%, #d63b1f 47%, #d63b1f 53%, transparent 53%);
}
.dc-annot-chrome .dc-annot-fill[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--accent, #d63b1f);
  border-color: transparent;
}
.dc-annot-chrome .dc-annot-btn {
  appearance: none;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 3px;
  padding: 4px 8px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dc-annot-chrome .dc-annot-btn[aria-pressed="true"] {
  background: var(--accent, #d63b1f);
  color: var(--accent-fg, #fff);
  border-color: transparent;
}
.dc-annot-chrome .dc-annot-btn:hover { background: rgba(0,0,0,0.04); }
.dc-annot-chrome .dc-annot-btn:focus-visible {
  outline: 2px solid var(--accent, #d63b1f);
  outline-offset: 2px;
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
  fill: color-mix(in oklab, var(--accent, #d63b1f) 8%, transparent);
  stroke: var(--accent, #d63b1f);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
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
  if (s.tool === 'rect') return { ...s, x: s.x + dx, y: s.y + dy };
  if (s.tool === 'ellipse') return { ...s, cx: s.cx + dx, cy: s.cy + dy };
  if (s.tool === 'arrow')
    return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
  return s; // text inherits its host's bbox
}

// Annotations visibility now lives in use-annotations-visibility.tsx so the
// ToolPalette (a sibling under CanvasRouter, not a descendant of this layer)
// can read the same state. Re-exported here for back-compat.
export { useAnnotationsVisibility } from './use-annotations-visibility.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Component

export function AnnotationsLayer() {
  ensureAnnotStyles();
  const { tool, setTool, sticky } = useToolMode();
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
  /**
   * Phase 20 — latest strokes mirror so command builders can read the
   * pre-mutation snapshot synchronously (React state isn't refreshed
   * between rapid taps in the same tick).
   */
  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  const isDraw = tool === 'pen' || tool === 'rect' || tool === 'arrow' || tool === 'ellipse';
  const isErase = tool === 'eraser';
  const isActive = isDraw || isErase;
  // T20 — rect + ellipse expose stroke weight too (FigJam ships thickness on
  // every shape). The annotation toolbar reads supportsThickness to decide
  // whether to render the Thin / Thick chips.
  const supportsThickness =
    tool === 'pen' || tool === 'arrow' || tool === 'rect' || tool === 'ellipse';
  const supportsFill = tool === 'rect' || tool === 'ellipse';

  // Load existing annotations on mount.
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
        if (loaded.length) setStrokesState(loaded);
      })
      .catch(() => {
        /* network blip — start with an empty annotation set */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const undoStack = useUndoStackOptional();
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;

  /**
   * Direct fire-and-forget PUT — used as the `putFn` injected into
   * `AnnotationStrokesCommand`. The 200 ms scheduled-save debounce
   * (legacy path) is cleared the moment we push a command, so the
   * server only sees one PUT per edit instead of two-step racing.
   */
  const putStrokes = useCallback((next: readonly Stroke[]) => {
    const file = fileRef.current;
    if (!file) return Promise.resolve();
    const svg = strokesToSvg(next);
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

  /**
   * Single entry point for every stroke mutation. Builds an undo command,
   * applies optimistic React state, and pushes onto the stack (which calls
   * the command's `do()` to PUT). Cancels any pending debounced save first
   * — DDR-049 gotcha: a queued auto-save flushing AFTER our PUT would race
   * the stack into a stale state.
   */
  const commitStrokes = useCallback(
    (prev: readonly Stroke[], next: readonly Stroke[], label?: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const cmd = createAnnotationStrokesCommand({
        before: prev,
        after: next,
        putFn: putStrokes,
        ...(label ? { label } : {}),
      });
      // Optimistic local apply happens here; command.do() inside push() also
      // calls putStrokes(next) so the server sees the same payload.
      setStrokesState(next as Stroke[]);
      void undoStackRef.current.push(cmd);
    },
    [putStrokes]
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
        (s) => !set.has(s.id) && !(s.tool === 'text' && set.has(s.anchorId))
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
      try {
        (e.target as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
          e.pointerId
        );
      } catch {
        /* some browsers reject capture on synthetic events */
      }
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      if (isErase) {
        eraseAt(wx, wy);
        return true;
      }
      const id = rid();
      const width: number = supportsThickness ? thickness : STROKE_WIDTH_THIN;
      const activeFill = supportsFill ? fill : null;
      if (tool === 'pen') {
        setDrawing({ id, tool: 'pen', color, width, points: [[wx, wy]] });
      } else if (tool === 'rect') {
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
        });
      } else if (tool === 'ellipse') {
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
      }
      return true;
    },
    [
      tool,
      color,
      fill,
      thickness,
      supportsThickness,
      supportsFill,
      isActive,
      isErase,
      visible,
      screenToWorld,
      eraseAt,
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
      setDrawing((cur) => {
        if (!cur) return cur;
        if (cur.tool === 'pen') {
          const last = cur.points[cur.points.length - 1] as WorldPoint | undefined;
          if (last && Math.hypot(wx - last[0], wy - last[1]) < 1) return cur;
          return { ...cur, points: [...cur.points, [wx, wy] as WorldPoint] };
        }
        if (cur.tool === 'rect') {
          return { ...cur, w: wx - cur.x, h: wy - cur.y };
        }
        if (cur.tool === 'ellipse') {
          const rx = Math.abs(wx - cur.cx);
          const ry = Math.abs(wy - cur.cy);
          return { ...cur, rx, ry };
        }
        if (cur.tool === 'arrow') {
          return { ...cur, x2: wx, y2: wy };
        }
        return cur;
      });
    },
    [isActive, isErase, visible, screenToWorld, eraseAt]
  );

  const endStroke = useCallback(() => {
    if (!isActive || !visible) return;
    if (isErase) return;
    const cur = drawingRef.current;
    if (!cur) return;
    let final: Stroke | null = cur;
    if (cur.tool === 'rect') final = normalizeRect(cur);
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
    setDrawing(null);
  }, [isActive, isErase, visible, commitStrokes, annotSel, setTool, sticky]);

  // T21 — abort a mid-stroke draw without committing. Dispatched by the
  // canvas-shell Esc handler (`maude:cancel-stroke`). Safe to call when
  // nothing is being drawn — the early-return on drawingRef keeps it
  // a no-op.
  const cancelStroke = useCallback(() => {
    if (!drawingRef.current) return;
    setDrawing(null);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onCancel = () => cancelStroke();
    document.addEventListener('maude:cancel-stroke', onCancel);
    return () => document.removeEventListener('maude:cancel-stroke', onCancel);
  }, [cancelStroke]);

  const renderStrokes = useMemo(
    () => (drawing ? [...strokes, drawing] : strokes),
    [strokes, drawing]
  );

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

  const dragStateRef = useRef<{
    pointerId: number;
    startWX: number;
    startWY: number;
    movedIds: string[];
  } | null>(null);

  // Drag-select marquee state. World-coord rectangle (anchor + cursor); the
  // cursor end animates with pointermove. `null` = no marquee active.
  const [marquee, setMarquee] = useState<{
    ax: number;
    ay: number;
    bx: number;
    by: number;
  } | null>(null);

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
        (t === 'pen' || t === 'rect' || t === 'ellipse' || t === 'arrow' || t === 'text')
      ) {
        return id;
      }
      return null;
    };

    // Chrome elements never deselect. Includes the per-shape context toolbar,
    // the main tool palette, the in-canvas draw chrome, the minimap, and the
    // right-click menu. Clicks on these route to their own handlers.
    const CHROME_SELECTOR =
      '.dc-annot-ctx, .dc-tool-palette, .dc-annot-chrome, .dc-mm, .dc-context-menu, .dc-tp-popover, .dc-multi-artboard-tb, .dc-elem-ctx-tb, .dc-cv-eq-spacing-layer, .cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, .dc-annot-resize-handle';

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
        dragStateRef.current = {
          pointerId: e.pointerId,
          startWX: wx,
          startWY: wy,
          movedIds: ids,
        };
        const onMove = (mv: PointerEvent) => {
          const st = dragStateRef.current;
          if (!st || mv.pointerId !== st.pointerId) return;
          const [cwx, cwy] = screenToWorld(mv.clientX, mv.clientY);
          const dx = cwx - st.startWX;
          const dy = cwy - st.startWY;
          if (dx === 0 && dy === 0) return;
          strokesStore.translateStrokes(st.movedIds, dx, dy);
          st.startWX = cwx;
          st.startWY = cwy;
        };
        const onUp = (up: PointerEvent) => {
          if (up.pointerId !== dragStateRef.current?.pointerId) return;
          dragStateRef.current = null;
          document.removeEventListener('pointermove', onMove, true);
          document.removeEventListener('pointerup', onUp, true);
          document.removeEventListener('pointercancel', onUp, true);
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
          if (s.tool === 'text') continue; // text inherits its host's bbox
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
  }, [tool, annotSel, elementSel, screenToWorld, strokesStore]);

  // Latest marquee + strokes refs for the doc-level pointerup callback
  // (avoids re-binding the listener on every state tick).
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;
  const strokesStoreRef = useRef(strokesStore);
  strokesStoreRef.current = strokesStore;

  // Double-click on a selected rect/ellipse enters text-edit mode.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (tool !== 'move') return;
    const onDbl = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const node = target?.closest?.('[data-id][data-tool]');
      if (!node) return;
      const id = node.getAttribute('data-id');
      const t = node.getAttribute('data-tool');
      if (id && (t === 'rect' || t === 'ellipse')) {
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
          beginStroke={beginStroke}
          moveStroke={moveStroke}
          endStroke={endStroke}
        />
        {visible ? (
          <AnnotationsSvg
            worldRef={worldRef}
            strokes={renderStrokes}
            anchorsById={anchorsById}
            selectMode={tool === 'move'}
            selectedStrokes={selectedStrokes}
            marquee={marquee}
            editingId={editingId}
            existingTextFor={(anchorId) =>
              strokes.find((s) => s.tool === 'text' && s.anchorId === anchorId) as
                | TextStroke
                | undefined
            }
            onCommitText={(anchorId, text) => {
              commitText(anchorId, text);
              setEditingId(null);
            }}
            onCancelEdit={() => setEditingId(null)}
          />
        ) : null}
        <AnnotationContextToolbar />
        {visible && tool === 'move' ? <AnnotationResizeOverlay store={strokesStore} /> : null}
        {isActive ? (
          <AnnotationsChrome
            color={color}
            setColor={setColor}
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
  beginStroke,
  moveStroke,
  endStroke,
}: {
  isActive: boolean;
  visible: boolean;
  beginStroke: (e: ReactPointerEvent<HTMLDivElement>, spaceHeld: boolean) => boolean;
  moveStroke: (e: ReactPointerEvent<HTMLDivElement>) => void;
  endStroke: () => void;
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
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onPointerDown={(e) => {
        beginStroke(e, spaceHeldRef.current);
      }}
      onPointerMove={moveStroke}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
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
  editingId,
  existingTextFor,
  onCommitText,
  onCancelEdit,
}: {
  worldRef: ReturnType<typeof useWorldRefContext>;
  strokes: readonly Stroke[];
  anchorsById: Map<string, RectStroke | EllipseStroke>;
  selectMode: boolean;
  selectedStrokes: readonly Stroke[];
  marquee: { ax: number; ay: number; bx: number; by: number } | null;
  editingId: string | null;
  existingTextFor: (anchorId: string) => TextStroke | undefined;
  onCommitText: (anchorId: string, text: string) => void;
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
  return createPortal(
    <svg className="dc-annot-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {strokes.map((s) => (
        <StrokeNode key={s.id} stroke={s} anchorsById={anchorsById} interactive={selectMode} />
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
      {editingId ? (
        <TextEditor
          anchorId={editingId}
          host={anchorsById.get(editingId) ?? null}
          existing={existingTextFor(editingId)}
          onCommit={onCommitText}
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
  return (
    <foreignObject x={bbox.x} y={bbox.y} width={Math.max(20, bbox.w)} height={Math.max(20, bbox.h)}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        aria-label="Edit annotation text"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          boxSizing: 'border-box',
          textAlign: 'center',
          color: existing?.color ?? '#1a1a1a',
          fontSize: `${fontSize}px`,
          fontFamily: 'var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
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
      stroke="var(--accent, #d63b1f)"
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
        stroke="var(--accent, #d63b1f)"
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
          fill="var(--accent, #d63b1f)"
          stroke="var(--bg-0, #ffffff)"
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

function StrokeNode({
  stroke,
  anchorsById,
  interactive,
}: {
  stroke: Stroke;
  anchorsById: Map<string, RectStroke | EllipseStroke>;
  interactive: boolean;
}) {
  // In Move mode, individual stroke nodes claim pointer events so we can
  // hit-test them from the doc-level capture listener. In draw mode the
  // overlay above handles input, so the strokes themselves stay inert.
  const hitMode = interactive ? 'visiblePainted' : ('none' as const);
  const strokeHit = interactive ? 'stroke' : ('none' as const);
  if (stroke.tool === 'text') {
    const host = anchorsById.get(stroke.anchorId);
    const bbox = host ? strokeBBox(host) : null;
    if (!bbox) return null;
    const cx = bbox.x + bbox.w / 2;
    const cy = bbox.y + bbox.h / 2;
    return (
      <text
        data-id={stroke.id}
        data-tool="text"
        data-anchor-id={stroke.anchorId}
        data-font-size={stroke.fontSize}
        x={cx}
        y={cy}
        fill={stroke.color}
        fontSize={stroke.fontSize}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: 'var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
      >
        {stroke.text}
      </text>
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
    return (
      <rect
        {...common}
        fill={stroke.fill ?? 'none'}
        x={x}
        y={y}
        width={Math.abs(stroke.w)}
        height={Math.abs(stroke.h)}
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
  const head = arrowHeadPoints(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.width);
  return (
    <g {...common} fill="none" pointerEvents={hitMode}>
      <line x1={stroke.x1} y1={stroke.y1} x2={stroke.x2} y2={stroke.y2} />
      <polyline points={head} fill={stroke.color} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome — color swatches + (optional fill picker) + (optional thickness chip)
// + presentation toggle + help button.

function AnnotationsChrome({
  color,
  setColor,
  supportsFill,
  fill,
  setFill,
  supportsThickness,
  thickness,
  setThickness,
}: {
  color: string;
  setColor: (c: string) => void;
  supportsFill: boolean;
  fill: string | null;
  setFill: (f: string | null) => void;
  supportsThickness: boolean;
  thickness: Thickness;
  setThickness: (t: Thickness) => void;
}) {
  return (
    <div className="dc-annot-chrome" role="toolbar" aria-label="Annotation tools">
      <div className="dc-annot-swatches" role="radiogroup" aria-label="Stroke color">
        {PALETTE.map((c) => (
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
            className="dc-annot-btn"
            aria-pressed={thickness === STROKE_WIDTH_THIN}
            title="Thin (3px)"
            onClick={() => setThickness(STROKE_WIDTH_THIN)}
          >
            Thin
          </button>
          <button
            type="button"
            className="dc-annot-btn"
            aria-pressed={thickness === STROKE_WIDTH_THICK}
            title="Thick (6px)"
            onClick={() => setThickness(STROKE_WIDTH_THICK)}
          >
            Thick
          </button>
        </>
      ) : null}
    </div>
  );
}
