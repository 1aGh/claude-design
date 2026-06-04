/**
 * @file       use-annotation-resize.tsx — Task 23 (Wave 2, G4)
 * @scope      plugins/design/dev-server/use-annotation-resize.tsx
 * @purpose    Screen-space corner / endpoint handles for the selected
 *             annotation. Per-tool resize math with FigJam resize modifiers:
 *             Shift = lock aspect ratio (45° angle snap for arrows), Alt =
 *             scale from center, Shift+Alt = both. Modifiers update live on
 *             keydown/keyup mid-drag (re-applied at the last pointer position).
 *
 *             Handles are `position: fixed` DOM siblings of the canvas (the
 *             same pattern element selection uses) — they stay 8 × 8 CSS px
 *             at any zoom and never get caught in the SVG `vector-effect`
 *             gymnastics.
 *
 *             Mounts the overlay element exactly once via `AnnotationResizeOverlay`.
 *             The hook does the math + persistence; the overlay component
 *             owns the rAF loop that follows pan/zoom + pointer drags.
 */

import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type ArrowStroke,
  type EllipseStroke,
  type ImageStroke,
  type LinkStroke,
  type PenStroke,
  type PolygonStroke,
  type RectStroke,
  type StickyStroke,
  type Stroke,
  type StrokesStoreValue,
  strokeBBox,
} from './annotations-layer.tsx';
import { useViewportControllerContext } from './canvas-lib.tsx';
import { useAnnotationSelection } from './use-annotation-selection.tsx';

const RESIZE_CSS = `
.dc-annot-resize-handle {
  position: fixed;
  width: 8px;
  height: 8px;
  background: var(--maude-hud-accent, #d63b1f);
  border: 1px solid var(--bg-0, #ffffff);
  border-radius: 1px;
  box-shadow: 0 0 0 0.5px color-mix(in oklab, var(--fg-0, #1c1917) 30%, transparent);
  z-index: 6;
  pointer-events: auto;
  touch-action: none;
}
/* Phase 24 — '!important' so the scale/move affordance beats use-tool-mode's
   blanket '* { cursor: <tool> !important }' (move mode). Without it the move
   glyph clobbered the resize cursors and the user saw no scale affordance over
   a handle. Specificity already wins ('.class[attr]' > '*'); the '!important'
   is what lets it through against the other '!important' rule. See DDR-067.
   NOTE: keep this comment backtick-free — it lives inside the RESIZE_CSS
   template literal and a stray backtick closes it (bun parse fail, §6). */
.dc-annot-resize-handle[data-corner="nw"], .dc-annot-resize-handle[data-corner="se"] { cursor: nwse-resize !important; }
.dc-annot-resize-handle[data-corner="ne"], .dc-annot-resize-handle[data-corner="sw"] { cursor: nesw-resize !important; }
.dc-annot-resize-handle[data-corner="ep1"], .dc-annot-resize-handle[data-corner="ep2"] { cursor: move !important; }
`.trim();

function ensureResizeStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-annot-resize-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-annot-resize-css';
  s.textContent = RESIZE_CSS;
  document.head.appendChild(s);
}

type Corner = 'nw' | 'ne' | 'sw' | 'se' | 'ep1' | 'ep2';

/** Stroke types that expose resize handles. Text inherits its anchor bbox. */
function isResizable(
  s: Stroke
): s is
  | RectStroke
  | EllipseStroke
  | PolygonStroke
  | ArrowStroke
  | PenStroke
  | StickyStroke
  | ImageStroke
  | LinkStroke {
  return (
    s.tool === 'rect' ||
    s.tool === 'ellipse' ||
    s.tool === 'polygon' ||
    s.tool === 'arrow' ||
    s.tool === 'pen' ||
    s.tool === 'sticky' ||
    s.tool === 'image' ||
    s.tool === 'link'
  );
}

/**
 * Resize modifiers (FigJam-parity). Held during a handle drag:
 *   • `shift` — lock to the start aspect ratio (45° angle snap for arrows;
 *               always-1:1 stickies ignore it — they're square regardless).
 *   • `alt`   — scale symmetrically around the stroke's center / midpoint.
 * Both together combine (ratio-locked AND center-anchored). With neither held
 * the result is byte-identical to the pre-modifier behaviour.
 */
export interface ResizeMods {
  shift: boolean;
  alt: boolean;
}

const NO_MODS: ResizeMods = { shift: false, alt: false };

const isWestCorner = (c: Corner): boolean => c === 'nw' || c === 'sw';
const isNorthCorner = (c: Corner): boolean => c === 'nw' || c === 'ne';

/**
 * Shared bbox resize for rect / polygon / sticky / ellipse. Returns the new
 * axis-aligned box for the dragged `corner` moving to world (wx, wy):
 *   • normal  — the diagonally-opposite corner is the fixed anchor.
 *   • Alt     — the box's center is the fixed anchor (symmetric scale).
 *   • Shift   — keep the start aspect ratio (the dominant axis drives scale).
 *   • square  — force 1:1 regardless of Shift (sticky notes).
 * The no-modifier branch is algebraically identical to the previous
 * min/max corner math (verified against the resize round-trip tests).
 */
function bboxResize(
  bbox: { x: number; y: number; w: number; h: number },
  corner: Corner,
  wx: number,
  wy: number,
  mods: ResizeMods,
  square: boolean
): { x: number; y: number; w: number; h: number } {
  const { x, y, w, h } = bbox;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const isW = isWestCorner(corner);
  const isN = isNorthCorner(corner);
  const anchorX = isW ? x + w : x;
  const anchorY = isN ? y + h : y;

  // Raw extents from the dragged corner — center-relative under Alt.
  let nw = mods.alt ? 2 * Math.abs(wx - cx) : Math.abs(wx - anchorX);
  let nh = mods.alt ? 2 * Math.abs(wy - cy) : Math.abs(wy - anchorY);

  if (square) {
    const side = Math.max(nw, nh, 1);
    nw = side;
    nh = side;
  } else if (mods.shift && w > 0 && h > 0) {
    const s = Math.max(nw / w, nh / h);
    nw = w * s;
    nh = h * s;
  }
  nw = Math.max(1, nw);
  nh = Math.max(1, nh);

  let nx: number;
  let ny: number;
  if (mods.alt) {
    nx = cx - nw / 2;
    ny = cy - nh / 2;
  } else {
    // Grow away from the anchor toward the cursor's side (handles flips).
    nx = wx < anchorX ? anchorX - nw : anchorX;
    ny = wy < anchorY ? anchorY - nh : anchorY;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Per-tool resize math. Given a stroke + the moved corner + the new world
 * coords for that corner, returns a patched stroke. `start` is the stroke at
 * the moment the drag began (used as the source-of-truth for scaling math —
 * avoids drift from rounding successive deltas). `mods` carries the live
 * FigJam resize modifiers (Shift aspect-lock, Alt scale-from-center).
 */
export function resizeStroke(
  start: Stroke,
  corner: Corner,
  wx: number,
  wy: number,
  mods: ResizeMods = NO_MODS
): Partial<Stroke> | null {
  if (
    start.tool === 'rect' ||
    start.tool === 'sticky' ||
    start.tool === 'polygon' ||
    start.tool === 'link'
  ) {
    // Rect / polygon / sticky / link all resize via their shared x / y / w / h
    // bbox. Text re-wraps inside the foreignObject automatically. Sticky stays
    // 1:1; the link card free-resizes (Shift still locks its current ratio).
    const box = bboxResize(
      { x: start.x, y: start.y, w: start.w, h: start.h },
      corner,
      wx,
      wy,
      mods,
      start.tool === 'sticky'
    );
    return box as Partial<RectStroke | StickyStroke | PolygonStroke | LinkStroke>;
  }
  if (start.tool === 'image') {
    // Phase 23 — images aspect-LOCK by default and free-resize with Shift held
    // (the inverse of the shape tools — Figma/FigJam image behaviour). Invert
    // the Shift flag into bboxResize, which keeps the START ratio when shift is
    // set; the start ratio IS the image's intrinsic aspect.
    const box = bboxResize(
      { x: start.x, y: start.y, w: start.w, h: start.h },
      corner,
      wx,
      wy,
      { shift: !mods.shift, alt: mods.alt },
      false
    );
    return box as Partial<ImageStroke>;
  }
  if (start.tool === 'ellipse') {
    // Treat the four corners as the bbox of the ellipse, then derive cx/cy/rx/ry.
    const box = bboxResize(
      { x: start.cx - start.rx, y: start.cy - start.ry, w: start.rx * 2, h: start.ry * 2 },
      corner,
      wx,
      wy,
      mods,
      false
    );
    return {
      cx: box.x + box.w / 2,
      cy: box.y + box.h / 2,
      rx: Math.max(1, box.w / 2),
      ry: Math.max(1, box.h / 2),
    } as Partial<EllipseStroke>;
  }
  if (start.tool === 'arrow') {
    if (corner !== 'ep1' && corner !== 'ep2') return null;
    const otherX = corner === 'ep1' ? start.x2 : start.x1;
    const otherY = corner === 'ep1' ? start.y2 : start.y1;
    const midX = (start.x1 + start.x2) / 2;
    const midY = (start.y1 + start.y2) / 2;
    // Alt pins the midpoint (both ends mirror); otherwise the far end is fixed.
    const refX = mods.alt ? midX : otherX;
    const refY = mods.alt ? midY : otherY;
    let dragX = wx;
    let dragY = wy;
    if (mods.shift) {
      // Snap the shaft angle (relative to the reference) to 45° increments.
      const dx = wx - refX;
      const dy = wy - refY;
      const dist = Math.hypot(dx, dy);
      const step = Math.PI / 4;
      const ang = Math.round(Math.atan2(dy, dx) / step) * step;
      dragX = refX + Math.cos(ang) * dist;
      dragY = refY + Math.sin(ang) * dist;
    }
    if (mods.alt) {
      const mirrorX = 2 * midX - dragX;
      const mirrorY = 2 * midY - dragY;
      return corner === 'ep1'
        ? ({ x1: dragX, y1: dragY, x2: mirrorX, y2: mirrorY } as Partial<ArrowStroke>)
        : ({ x2: dragX, y2: dragY, x1: mirrorX, y1: mirrorY } as Partial<ArrowStroke>);
    }
    return corner === 'ep1'
      ? ({ x1: dragX, y1: dragY } as Partial<ArrowStroke>)
      : ({ x2: dragX, y2: dragY } as Partial<ArrowStroke>);
  }
  if (start.tool === 'pen') {
    // Scale all points around an anchor — the opposite corner (normal) or the
    // bbox center (Alt). Shift forces a uniform scale (dominant axis wins).
    // A 0-extent axis (single-point pen stroke) keeps scale 1 (no div-by-zero).
    const bb = strokeBBox(start);
    if (!bb) return null;
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;
    const isW = isWestCorner(corner);
    const isN = isNorthCorner(corner);
    let anchorX: number;
    let anchorY: number;
    let sx: number;
    let sy: number;
    if (mods.alt) {
      anchorX = cx;
      anchorY = cy;
      sx = bb.w === 0 ? 1 : (wx - cx) / (isW ? -bb.w / 2 : bb.w / 2);
      sy = bb.h === 0 ? 1 : (wy - cy) / (isN ? -bb.h / 2 : bb.h / 2);
    } else {
      anchorX = isW ? bb.x + bb.w : bb.x;
      anchorY = isN ? bb.y + bb.h : bb.y;
      const newLeft = isW ? wx : bb.x;
      const newTop = isN ? wy : bb.y;
      const newRight = isW ? bb.x + bb.w : wx;
      const newBottom = isN ? bb.y + bb.h : wy;
      sx = bb.w === 0 ? 1 : (newRight - newLeft) / bb.w;
      sy = bb.h === 0 ? 1 : (newBottom - newTop) / bb.h;
    }
    if (mods.shift) {
      const s = Math.max(Math.abs(sx), Math.abs(sy));
      sx = (sx < 0 ? -1 : 1) * s;
      sy = (sy < 0 ? -1 : 1) * s;
    }
    const scaled = start.points.map(
      ([px, py]) =>
        [anchorX + (px - anchorX) * sx, anchorY + (py - anchorY) * sy] as [number, number]
    );
    return { points: scaled } as Partial<PenStroke>;
  }
  return null;
}

/**
 * Returns the four corners (or two endpoints, for arrow) of the selected
 * stroke in world coordinates. Used by the overlay component to position
 * the screen-space handle divs each rAF tick.
 */
function handlePositions(s: Stroke): Array<{ corner: Corner; x: number; y: number }> {
  if (s.tool === 'arrow') {
    return [
      { corner: 'ep1', x: s.x1, y: s.y1 },
      { corner: 'ep2', x: s.x2, y: s.y2 },
    ];
  }
  const bb = strokeBBox(s);
  if (!bb) return [];
  return [
    { corner: 'nw', x: bb.x, y: bb.y },
    { corner: 'ne', x: bb.x + bb.w, y: bb.y },
    { corner: 'sw', x: bb.x, y: bb.y + bb.h },
    { corner: 'se', x: bb.x + bb.w, y: bb.y + bb.h },
  ];
}

export function AnnotationResizeOverlay({ store }: { store: StrokesStoreValue | null }): ReactNode {
  ensureResizeStyles();
  const annotSel = useAnnotationSelection();
  const controller = useViewportControllerContext();
  const vp = controller?.viewport ?? null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startStroke: Stroke;
    corner: Corner;
  } | null>(null);
  // Last pointer position (client coords) during a drag — lets a mid-drag
  // Shift/Alt keydown re-apply the resize without waiting for a pointermove.
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const selectedId = annotSel.selectedIds.length === 1 ? (annotSel.selectedIds[0] ?? null) : null;
  const selectedStroke: Stroke | null = useMemo(() => {
    if (!selectedId || !store) return null;
    return store.strokes.find((s) => s.id === selectedId) ?? null;
  }, [selectedId, store]);

  const screenToWorld = useCallback(
    (cx: number, cy: number): [number, number] => {
      const v = vp ?? { x: 0, y: 0, zoom: 1 };
      const z = v.zoom || 1;
      return [(cx - v.x) / z, (cy - v.y) / z];
    },
    [vp]
  );

  // rAF loop — repositions handles on every frame while a single resizable
  // stroke is selected. Cheaper than wiring pan/zoom observers because the
  // halo overlays already follow the same pattern.
  useEffect(() => {
    if (!selectedStroke || !isResizable(selectedStroke)) {
      const c = containerRef.current;
      if (c) {
        for (const child of Array.from(c.children)) {
          (child as HTMLElement).style.display = 'none';
        }
      }
      return;
    }
    const tick = () => {
      rafRef.current = null;
      const c = containerRef.current;
      if (!c) return;
      const positions = handlePositions(selectedStroke);
      const v = vp ?? { x: 0, y: 0, zoom: 1 };
      const z = v.zoom || 1;
      // Ensure enough handle children exist (each corner = one absolutely-
      // positioned div). 4 for rect/ellipse/pen; 2 for arrow.
      while (c.children.length < positions.length) {
        const handle = document.createElement('div');
        handle.className = 'dc-annot-resize-handle';
        c.appendChild(handle);
      }
      while (c.children.length > positions.length) {
        c.lastChild && c.removeChild(c.lastChild);
      }
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const handle = c.children[i] as HTMLElement | undefined;
        if (!pos || !handle) continue;
        const sx = pos.x * z + v.x;
        const sy = pos.y * z + v.y;
        handle.style.display = 'block';
        handle.style.left = `${Math.round(sx - 4)}px`;
        handle.style.top = `${Math.round(sy - 4)}px`;
        handle.dataset.corner = pos.corner;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedStroke, vp]);

  // Pointer handling — pointerdown on a handle starts a drag; pointermove
  // patches the stroke via `store.updateStroke`; pointerup commits.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.classList.contains('dc-annot-resize-handle')) return;
      if (!selectedStroke || !store) return;
      const corner = t.dataset.corner as Corner | undefined;
      if (!corner) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { pointerId: e.pointerId, startStroke: selectedStroke, corner };
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers reject capture on synthetic events */
      }
    };
    const applyResize = (clientX: number, clientY: number, mods: ResizeMods) => {
      const d = dragRef.current;
      if (!d || !store) return;
      const [wx, wy] = screenToWorld(clientX, clientY);
      const patch = resizeStroke(d.startStroke, d.corner, wx, wy, mods);
      if (patch) store.updateStroke(d.startStroke.id, patch);
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      applyResize(e.clientX, e.clientY, { shift: e.shiftKey, alt: e.altKey });
    };
    // Holding/releasing Shift or Alt mid-drag re-runs the resize at the last
    // known pointer position so the constraint flips live, FigJam-style.
    const onKey = (e: KeyboardEvent) => {
      if (!dragRef.current) return;
      if (e.key !== 'Shift' && e.key !== 'Alt') return;
      const p = lastPointRef.current;
      if (!p) return;
      e.preventDefault();
      applyResize(p.x, p.y, { shift: e.shiftKey, alt: e.altKey });
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      lastPointRef.current = null;
    };
    c.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
    };
  }, [selectedStroke, store, screenToWorld]);

  // Only render when there's exactly one resizable stroke selected. Multi
  // resize is undefined for v1 (no canonical UX); text inherits anchor bbox.
  if (!selectedStroke || !isResizable(selectedStroke)) return null;
  return <div ref={containerRef} aria-hidden="true" />;
}
