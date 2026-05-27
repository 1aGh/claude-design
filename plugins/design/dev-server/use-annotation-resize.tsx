/**
 * @file       use-annotation-resize.tsx — Task 23 (Wave 2, G4)
 * @scope      plugins/design/dev-server/use-annotation-resize.tsx
 * @purpose    Screen-space corner / endpoint handles for the selected
 *             annotation. Per-tool resize math; modifier semantics (Shift
 *             aspect-lock, Alt scale-from-center) are deferred to a follow-up.
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
  type PenStroke,
  type RectStroke,
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
.dc-annot-resize-handle[data-corner="nw"], .dc-annot-resize-handle[data-corner="se"] { cursor: nwse-resize; }
.dc-annot-resize-handle[data-corner="ne"], .dc-annot-resize-handle[data-corner="sw"] { cursor: nesw-resize; }
.dc-annot-resize-handle[data-corner="ep1"], .dc-annot-resize-handle[data-corner="ep2"] { cursor: move; }
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

/** Stroke types that expose resize handles in v1. Text inherits anchor bbox. */
function isResizable(s: Stroke): s is RectStroke | EllipseStroke | ArrowStroke | PenStroke {
  return s.tool === 'rect' || s.tool === 'ellipse' || s.tool === 'arrow' || s.tool === 'pen';
}

/**
 * Per-tool resize math. Given a stroke + the moved corner + the new world
 * coords for that corner, returns a patched stroke. `start` is the stroke at
 * the moment the drag began (used as the source-of-truth for scaling math —
 * avoids drift from rounding successive deltas).
 */
function resizeStroke(
  start: Stroke,
  corner: Corner,
  wx: number,
  wy: number
): Partial<Stroke> | null {
  if (start.tool === 'rect') {
    const bbox = { x: start.x, y: start.y, w: start.w, h: start.h };
    const left = corner === 'nw' || corner === 'sw' ? wx : bbox.x;
    const right = corner === 'ne' || corner === 'se' ? wx : bbox.x + bbox.w;
    const top = corner === 'nw' || corner === 'ne' ? wy : bbox.y;
    const bottom = corner === 'sw' || corner === 'se' ? wy : bbox.y + bbox.h;
    return {
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      w: Math.abs(right - left),
      h: Math.abs(bottom - top),
    } as Partial<RectStroke>;
  }
  if (start.tool === 'ellipse') {
    // Treat the four corners as the bbox of the ellipse. Drag any corner →
    // recompute the AABB and derive cx/cy/rx/ry from the diagonal anchor.
    const bbox = {
      x: start.cx - start.rx,
      y: start.cy - start.ry,
      w: start.rx * 2,
      h: start.ry * 2,
    };
    const left = corner === 'nw' || corner === 'sw' ? wx : bbox.x;
    const right = corner === 'ne' || corner === 'se' ? wx : bbox.x + bbox.w;
    const top = corner === 'nw' || corner === 'ne' ? wy : bbox.y;
    const bottom = corner === 'sw' || corner === 'se' ? wy : bbox.y + bbox.h;
    const nx = Math.min(left, right);
    const ny = Math.min(top, bottom);
    const nw = Math.abs(right - left);
    const nh = Math.abs(bottom - top);
    return {
      cx: nx + nw / 2,
      cy: ny + nh / 2,
      rx: Math.max(1, nw / 2),
      ry: Math.max(1, nh / 2),
    } as Partial<EllipseStroke>;
  }
  if (start.tool === 'arrow') {
    if (corner === 'ep1') return { x1: wx, y1: wy } as Partial<ArrowStroke>;
    if (corner === 'ep2') return { x2: wx, y2: wy } as Partial<ArrowStroke>;
    return null;
  }
  if (start.tool === 'pen') {
    // Scale all points by (newW / oldW, newH / oldH) around the opposite
    // corner anchor. When the drag-start bbox has 0 width/height on an axis
    // (single-point pen stroke) we skip that axis to avoid div-by-zero.
    const bb = strokeBBox(start);
    if (!bb) return null;
    const anchorX = corner === 'nw' || corner === 'sw' ? bb.x + bb.w : bb.x;
    const anchorY = corner === 'nw' || corner === 'ne' ? bb.y + bb.h : bb.y;
    const newLeft = corner === 'nw' || corner === 'sw' ? wx : bb.x;
    const newTop = corner === 'nw' || corner === 'ne' ? wy : bb.y;
    const newRight = corner === 'ne' || corner === 'se' ? wx : bb.x + bb.w;
    const newBottom = corner === 'sw' || corner === 'se' ? wy : bb.y + bb.h;
    const sx = bb.w === 0 ? 1 : (newRight - newLeft) / bb.w;
    const sy = bb.h === 0 ? 1 : (newBottom - newTop) / bb.h;
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

export function AnnotationResizeOverlay({
  store,
}: {
  store: StrokesStoreValue | null;
}): ReactNode {
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
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!store) return;
      const [wx, wy] = screenToWorld(e.clientX, e.clientY);
      const patch = resizeStroke(d.startStroke, d.corner, wx, wy);
      if (patch) store.updateStroke(d.startStroke.id, patch);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
    };
    c.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [selectedStroke, store, screenToWorld]);

  // Only render when there's exactly one resizable stroke selected. Multi
  // resize is undefined for v1 (no canonical UX); text inherits anchor bbox.
  if (!selectedStroke || !isResizable(selectedStroke)) return null;
  return <div ref={containerRef} aria-hidden="true" />;
}
