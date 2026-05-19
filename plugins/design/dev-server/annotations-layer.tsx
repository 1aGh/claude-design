/**
 * @file       annotations-layer.tsx — Phase 5 draw / annotation overlay
 * @scope      plugins/design/dev-server/annotations-layer.tsx
 * @purpose    Transparent SVG overlay for pen / rect / arrow / eraser strokes.
 *             Strokes are stored in WORLD coords (so they pan/zoom with the
 *             canvas) and rendered through a `<g transform>` derived from the
 *             live viewport published by `useViewportControllerContext`. The
 *             overlay only claims pointer events while an annotation tool is
 *             active; otherwise pointer-events: none so move/comment/hand
 *             interactions pass through to the canvas. Presentation toggle
 *             (Shift+P) hides the SVG without persisting; the in-canvas help
 *             sheet (Cmd+/) lists every shortcut. Strokes persist to
 *             `<designRoot>/<slug>.annotations.svg` via PUT /_api/annotations
 *             on commit, debounced 200 ms.
 */

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useViewportControllerContext } from './canvas-lib.tsx';
import { useToolMode } from './use-tool-mode.tsx';

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
export type Stroke = PenStroke | RectStroke | ArrowStroke;

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
  const common = `data-id="${esc(s.id)}" data-tool="${s.tool}" stroke="${esc(s.color)}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  if (s.tool === 'pen') {
    return `<path ${common} d="${penPathD(s.points)}" pointer-events="stroke"/>`;
  }
  if (s.tool === 'rect') {
    return `<rect ${common} x="${s.x}" y="${s.y}" width="${Math.max(
      0,
      s.w
    )}" height="${Math.max(0, s.h)}"/>`;
  }
  const head = arrowHeadPoints(s.x1, s.y1, s.x2, s.y2, s.width);
  return `<g ${common}><line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/><polyline points="${head}" fill="${esc(s.color)}"/></g>`;
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
      const color = el.getAttribute('stroke') || DEFAULT_COLOR;
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
        out.push({ id, tool: 'rect', color, width, x, y, w, h });
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
  const t = Math.max(tol, s.width);
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
  // rect — hit on any of the 4 edges (open rectangle).
  const x = s.x;
  const y = s.y;
  const x2 = x + s.w;
  const y2 = y + s.h;
  if (wx < Math.min(x, x2) - t || wx > Math.max(x, x2) + t) return false;
  if (wy < Math.min(y, y2) - t || wy > Math.max(y, y2) + t) return false;
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
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 4;
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
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.94);
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  padding: 6px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgba(40,30,20,0.85);
  z-index: 6;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
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
/*
 * Native <dialog> opened via .showModal() — the browser positions it centered
 * in the top layer above all stacking contexts. We strip the UA border/padding
 * so the inner card is the only visible chrome, and use ::backdrop for the
 * scrim instead of a wrapping div with background-color.
 */
.dc-annot-help {
  border: 0;
  padding: 0;
  background: transparent;
  max-width: none;
  max-height: none;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.dc-annot-help::backdrop {
  background: rgba(20,16,12,0.55);
}
.dc-annot-help-card {
  background: var(--bg-0, #fff);
  color: var(--fg-0, #1a1a1a);
  border-radius: 8px;
  padding: 24px 28px;
  min-width: 320px;
  max-width: 480px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
}
.dc-annot-help-card h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.dc-annot-help-card dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 16px;
  row-gap: 6px;
  margin: 0;
  font-size: 13px;
}
.dc-annot-help-card kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  background: rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 3px;
  padding: 1px 6px;
}
.dc-annot-help-card .dc-annot-help-foot {
  margin-top: 16px;
  font-size: 11px;
  opacity: 0.65;
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
// Component

export function AnnotationsLayer() {
  ensureAnnotStyles();
  const { tool } = useToolMode();
  const controller = useViewportControllerContext();
  const vp = controller?.viewport ?? null;

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [visible, setVisible] = useState<boolean>(true);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  const fileRef = useRef<string | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  drawingRef.current = drawing;

  const isDraw = tool === 'pen' || tool === 'rect' || tool === 'arrow';
  const isErase = tool === 'eraser';
  const isActive = isDraw || isErase;

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
        if (loaded.length) setStrokes(loaded);
      })
      .catch(() => {
        /* network blip — start with an empty annotation set */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleSave = useCallback((next: readonly Stroke[]) => {
    const file = fileRef.current;
    if (!file) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const svg = strokesToSvg(next);
      void fetch('/_api/annotations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, svg }),
      }).catch(() => {
        /* swallow — the user will see uncommitted state until the next stroke */
      });
    }, 200);
  }, []);

  // Document-level toggles: Shift+P (presentation), Cmd+/ (help sheet), Esc
  // (close help). Esc clearing drawing tool is owned by input-router → setTool.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === 'P' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setVisible((v) => !v);
        return;
      }
      if (e.key === '/' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && helpOpen) {
        setHelpOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [helpOpen]);

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
      setStrokes((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const candidate = prev[i];
          if (candidate && strokeHitTest(candidate, wx, wy, tol)) {
            const next = prev.slice(0, i).concat(prev.slice(i + 1));
            scheduleSave(next);
            return next;
          }
        }
        return prev;
      });
    },
    [vp, scheduleSave]
  );

  const beginStroke = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!isActive || !visible) return;
      if (e.button !== 0) return;
      // Cmd/Ctrl held — escape hatch into router's selection model.
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers reject capture on synthetic events */
      }
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      if (isErase) {
        eraseAt(wx, wy);
        return;
      }
      const id = rid();
      if (tool === 'pen') {
        setDrawing({ id, tool: 'pen', color, width: 2, points: [[wx, wy]] });
      } else if (tool === 'rect') {
        setDrawing({ id, tool: 'rect', color, width: 2, x: wx, y: wy, w: 0, h: 0 });
      } else if (tool === 'arrow') {
        setDrawing({
          id,
          tool: 'arrow',
          color,
          width: 2,
          x1: wx,
          y1: wy,
          x2: wx,
          y2: wy,
        });
      }
    },
    [tool, color, isActive, isErase, visible, screenToWorld, eraseAt]
  );

  const moveStroke = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
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
        return { ...cur, x2: wx, y2: wy };
      });
    },
    [isActive, isErase, visible, screenToWorld, eraseAt]
  );

  const endStroke = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!isActive || !visible) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* not captured */
      }
      if (isErase) return;
      const cur = drawingRef.current;
      if (!cur) return;
      let final: Stroke | null = cur;
      if (cur.tool === 'rect') final = normalizeRect(cur);
      if (final && !isStrokeMeaningful(final)) final = null;
      if (final) {
        const committed = final;
        setStrokes((prev) => {
          const next = [...prev, committed];
          scheduleSave(next);
          return next;
        });
      }
      setDrawing(null);
    },
    [isActive, isErase, visible, scheduleSave]
  );

  const transform = vp ? `translate(${vp.x} ${vp.y}) scale(${vp.zoom})` : 'translate(0 0) scale(1)';
  const renderStrokes = useMemo(
    () => (drawing ? [...strokes, drawing] : strokes),
    [strokes, drawing]
  );

  return (
    <>
      <svg
        className="dc-annot-svg"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: isActive && visible ? 'auto' : 'none',
          zIndex: 4,
          display: visible ? 'block' : 'none',
        }}
        onPointerDown={beginStroke}
        onPointerMove={moveStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        <g transform={transform}>
          {renderStrokes.map((s) => (
            <StrokeNode key={s.id} stroke={s} />
          ))}
        </g>
      </svg>
      {isActive ? (
        <AnnotationsChrome
          color={color}
          setColor={setColor}
          visible={visible}
          setVisible={setVisible}
          onOpenHelp={() => setHelpOpen(true)}
        />
      ) : null}
      {helpOpen ? <HelpSheet onClose={() => setHelpOpen(false)} /> : null}
    </>
  );
}
AnnotationsLayer.displayName = 'AnnotationsLayer';

// ─────────────────────────────────────────────────────────────────────────────
// Stroke renderer

function StrokeNode({ stroke }: { stroke: Stroke }) {
  const common = {
    'data-id': stroke.id,
    'data-tool': stroke.tool,
    stroke: stroke.color,
    strokeWidth: stroke.width,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  if (stroke.tool === 'pen') {
    return <path {...common} d={penPathD(stroke.points)} pointerEvents="stroke" />;
  }
  if (stroke.tool === 'rect') {
    const x = Math.min(stroke.x, stroke.x + stroke.w);
    const y = Math.min(stroke.y, stroke.y + stroke.h);
    return <rect {...common} x={x} y={y} width={Math.abs(stroke.w)} height={Math.abs(stroke.h)} />;
  }
  const head = arrowHeadPoints(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.width);
  return (
    <g {...common}>
      <line x1={stroke.x1} y1={stroke.y1} x2={stroke.x2} y2={stroke.y2} />
      <polyline points={head} fill={stroke.color} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome — color swatches + presentation toggle + help button. Renders only
// while an annotation tool is active; the existing ToolPalette already exposes
// the tool buttons (B/R/A/E/V) so we don't duplicate those here.

function AnnotationsChrome({
  color,
  setColor,
  visible,
  setVisible,
  onOpenHelp,
}: {
  color: string;
  setColor: (c: string) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
  onOpenHelp: () => void;
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
      <button
        type="button"
        className="dc-annot-btn"
        aria-pressed={!visible}
        title="Presentation (Shift+P)"
        onClick={() => setVisible(!visible)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
      <button type="button" className="dc-annot-btn" title="Shortcuts (⌘/)" onClick={onOpenHelp}>
        ?
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Help sheet — modal overlay listing every annotation shortcut.

function HelpSheet({ onClose }: { onClose: () => void }) {
  // Native <dialog> handles aria-modal + focus trap for free and dodges the
  // need to hand-roll role="dialog" + key-handler shims. Esc-to-close is also
  // wired at the document level in AnnotationsLayer; the dialog's own onClose
  // fires for native Esc and for `.close()`.
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showModal === 'function') el.showModal();
    return () => {
      try {
        el.close();
      } catch {
        /* already closed */
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dc-annot-help"
      aria-label="Annotation shortcuts"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="dc-annot-help-card">
        <h2>Annotation shortcuts</h2>
        <dl>
          <dt>
            <kbd>B</kbd>
          </dt>
          <dd>Pen</dd>
          <dt>
            <kbd>R</kbd>
          </dt>
          <dd>Rectangle</dd>
          <dt>
            <kbd>A</kbd>
          </dt>
          <dd>Arrow</dd>
          <dt>
            <kbd>E</kbd>
          </dt>
          <dd>Eraser</dd>
          <dt>
            <kbd>V</kbd>
          </dt>
          <dd>Select (exit draw)</dd>
          <dt>
            <kbd>Esc</kbd>
          </dt>
          <dd>Exit draw mode</dd>
          <dt>
            <kbd>Shift</kbd> + <kbd>P</kbd>
          </dt>
          <dd>Presentation (hide annotations)</dd>
          <dt>
            <kbd>⌘</kbd> + <kbd>/</kbd>
          </dt>
          <dd>Toggle this sheet</dd>
        </dl>
        <p className="dc-annot-help-foot">
          Strokes persist to <code>.annotations.svg</code> per canvas.
        </p>
      </div>
    </dialog>
  );
}
