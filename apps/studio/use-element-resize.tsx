/**
 * @file       use-element-resize.tsx — feature-element-editing-robustness Stage D
 * @scope      apps/studio/use-element-resize.tsx
 * @purpose    On-canvas drag-resize for the single selected CANVAS ELEMENT
 *             (an `[data-cd-id]` node in an artboard), the DOM counterpart of
 *             `use-annotation-resize.tsx` (which targets the SVG annotation
 *             model). Renders 8 screen-space handles (4 corner + 4 edge) that
 *             stay a constant 8 px at any zoom, with FigJam modifier grammar:
 *             Shift = lock aspect ratio, Alt = resize from center. On release it
 *             commits `width`/`height` (+ `left`/`top` for a top/left-edge drag
 *             on an out-of-flow element) through the SAME `reposition-request`-
 *             style lane the coordinate drag uses (untrusted canvas REQUESTS,
 *             main-origin shell WRITES via `/_api/edit-css` — DDR-054).
 *
 *             Composition with ReorderDrag: the handles are `position:fixed`
 *             overlay divs OUTSIDE the artboard, so ReorderDrag's `el.contains
 *             (target)` gate (canvas-shell) never fires for a handle pointerdown
 *             — a body drag still moves via reorder/reposition, a handle drag
 *             resizes.
 *
 *             In-flow elements resize by writing explicit `width`/`height` only
 *             (NEVER convert-to-absolute — out of scope); an out-of-flow
 *             (absolute/fixed) element additionally moves `left`/`top` when the
 *             top/left edge is dragged, so the resize feels origin-correct.
 */

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { resolveSelectionEl } from './dom-selection.ts';
import { useSelectionSet } from './use-selection-set.tsx';
import { useToolMode } from './use-tool-mode.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Handle CSS — mirrors the `.dc-annot-resize-handle` recipe (DS `.sel-handle`:
// accent square, accent-fg hairline border, radius-xs). Kept as its own class so
// it doesn't depend on the annotation overlay being mounted. Comment must stay
// backtick-free — it lives inside the template literal.

const EL_RESIZE_CSS = `
.dc-el-resize-handle {
  position: fixed;
  width: 8px;
  height: 8px;
  background: var(--maude-hud-accent, oklch(0.680 0.180 268));
  border: 1px solid var(--maude-hud-accent-fg, oklch(0.180 0.030 268));
  border-radius: 3px;
  z-index: 6;
  pointer-events: auto;
  touch-action: none;
}
.dc-el-resize-handle[data-corner="nw"], .dc-el-resize-handle[data-corner="se"] { cursor: nwse-resize !important; }
.dc-el-resize-handle[data-corner="ne"], .dc-el-resize-handle[data-corner="sw"] { cursor: nesw-resize !important; }
.dc-el-resize-handle[data-corner="n"], .dc-el-resize-handle[data-corner="s"] { cursor: ns-resize !important; width: 14px; height: 6px; }
.dc-el-resize-handle[data-corner="e"], .dc-el-resize-handle[data-corner="w"] { cursor: ew-resize !important; width: 6px; height: 14px; }
.dc-el-resize-handle[data-corner="rotate"] {
  cursor: grab !important;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--maude-hud-accent-fg, oklch(0.180 0.030 268));
  border: 1.5px solid var(--maude-hud-accent, oklch(0.680 0.180 268));
}
`.trim();

function ensureElementResizeStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-el-resize-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-el-resize-css';
  s.textContent = EL_RESIZE_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure resize math — unit-tested without a DOM.

export type ElResizeCorner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** The 8 handles in a stable render order. */
export const EL_RESIZE_CORNERS: ElResizeCorner[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface ElResizeStart {
  /** World-px border-box dimensions at drag start. */
  w: number;
  h: number;
  /** Authored inline `left`/`top` (world px), or NaN when not present. */
  left: number;
  top: number;
}

export interface ElResizeMods {
  aspect: boolean; // Shift → lock start ratio
  center: boolean; // Alt → resize from center
}

export interface ElResizeFlags {
  /** True only for an out-of-flow element with an inline `left` — so a west-edge
   *  drag may move the origin. In-flow elements resize from their layout origin
   *  (width/height only), never moving left/top. */
  canMoveLeft: boolean;
  canMoveTop: boolean;
}

export interface ElResizeResult {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

function edgeFlags(corner: ElResizeCorner) {
  return {
    movesLeft: corner === 'nw' || corner === 'w' || corner === 'sw',
    movesRight: corner === 'ne' || corner === 'e' || corner === 'se',
    movesTop: corner === 'nw' || corner === 'n' || corner === 'ne',
    movesBottom: corner === 'sw' || corner === 's' || corner === 'se',
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
const MIN_SIZE = 1;

/**
 * Compute the target box for a resize drag. `dxW`/`dyW` are the cursor deltas in
 * WORLD units (screen delta ÷ the element's own render zoom). The result carries
 * `left`/`top` ONLY when the corresponding edge moved AND the flag permits it
 * (out-of-flow with an inline value) — so an in-flow element never gets a left/
 * top write. Left/top are derived by holding the OPPOSITE edge fixed (Figma
 * grammar), which is exact for both plain and aspect-locked resizes.
 */
export function computeElementResize(
  corner: ElResizeCorner,
  start: ElResizeStart,
  dxW: number,
  dyW: number,
  mods: ElResizeMods,
  flags: ElResizeFlags
): ElResizeResult {
  const { movesLeft, movesRight, movesTop, movesBottom } = edgeFlags(corner);
  const center = mods.center;

  let width = start.w;
  let height = start.h;
  if (movesRight) width = start.w + (center ? 2 * dxW : dxW);
  else if (movesLeft) width = start.w - (center ? 2 * dxW : dxW);
  if (movesBottom) height = start.h + (center ? 2 * dyW : dyW);
  else if (movesTop) height = start.h - (center ? 2 * dyW : dyW);

  // Aspect lock (Shift): keep the start ratio. Corner → drive by the axis with
  // the larger relative change; single edge → scale the other dimension.
  if (mods.aspect && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
    if (isCorner) {
      const relW = Math.abs(width - start.w) / start.w;
      const relH = Math.abs(height - start.h) / start.h;
      if (relW >= relH) height = width / ratio;
      else width = height * ratio;
    } else if (movesLeft || movesRight) {
      height = width / ratio;
    } else if (movesTop || movesBottom) {
      width = height * ratio;
    }
  }

  if (width < MIN_SIZE) width = MIN_SIZE;
  if (height < MIN_SIZE) height = MIN_SIZE;

  const result: ElResizeResult = { width: round(width), height: round(height) };
  // Derive left/top from the FINAL size by holding the opposite edge fixed.
  if (center) {
    if (flags.canMoveLeft && (movesLeft || movesRight))
      result.left = round(start.left + (start.w - width) / 2);
    if (flags.canMoveTop && (movesTop || movesBottom))
      result.top = round(start.top + (start.h - height) / 2);
  } else {
    if (flags.canMoveLeft && movesLeft) result.left = round(start.left + start.w - width);
    if (flags.canMoveTop && movesTop) result.top = round(start.top + start.h - height);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation math (Task L8) — free-hand rotate handle. All pure, unit-tested.

/** Rotation angle (deg) from a CSS `transform` matrix (`none`/`matrix(...)`). */
export function rotationDegFromMatrix(transform: string | null | undefined): number {
  if (!transform || transform === 'none') return 0;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m) return 0;
  const parts = m[1].split(',').map(Number);
  const a = parts[0] ?? 1;
  const b = parts[1] ?? 0;
  return Math.round(Math.atan2(b, a) * (180 / Math.PI) * 100) / 100;
}

/** Uniform scale from a CSS `transform` matrix (the `.dc-world` zoom). 1 when none. */
export function scaleFromMatrix(transform: string | null | undefined): number {
  if (!transform || transform === 'none') return 1;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m) return 1;
  const parts = m[1].split(',').map(Number);
  const a = parts[0] ?? 1;
  const b = parts[1] ?? 0;
  const s = Math.hypot(a, b);
  return s > 0 ? s : 1;
}

/** Rotate a local offset (dx,dy) by `deg` — screen y is down, positive = CW. */
export function rotatePointDeg(dx: number, dy: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/**
 * Element rotation (deg) so its TOP (local -Y) points toward the pointer — the
 * rotate handle sits above top-center, so the angle from the element center to
 * the pointer, +90°. Snaps to 15° while Shift is held. Normalized to (-180,180].
 */
export function rotateDragDeg(
  cx: number,
  cy: number,
  px: number,
  py: number,
  snap: boolean
): number {
  let deg = Math.atan2(py - cy, px - cx) * (180 / Math.PI) + 90;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  if (snap) deg = Math.round(deg / 15) * 15;
  return Math.round(deg * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay component — mounted once in CanvasShell alongside SelectionHalos.

interface ElResizeDrag {
  pointerId: number;
  corner: ElResizeCorner | 'rotate';
  el: HTMLElement;
  cdId: string;
  startClientX: number;
  startClientY: number;
  elZoom: number; // rect.width / offsetWidth — the element's own render scale
  /** Element rotation (deg) at drag start — resize deltas are un-rotated by it. */
  angle: number;
  /** Screen center of the element — the pivot for a rotate drag. */
  cx: number;
  cy: number;
  start: ElResizeStart;
  flags: ElResizeFlags;
  /** Inline style values BEFORE the drag — the undo `before` + failure restore. */
  before: {
    width: string | null;
    height: string | null;
    left: string | null;
    top: string | null;
    transform: string | null;
  };
  lastResult: ElResizeResult | null;
  /** Last previewed `transform` (rotate drag) — the commit value. */
  lastTransform: string | null;
}

/** Post the committed resize to the main-origin shell. Split out so the message
 *  shape stays in one place. `null` before = the prop was unset (reset on undo). */
function postResizeRequest(drag: ElResizeDrag, r: ElResizeResult): void {
  const patch: Record<string, string> = {
    width: `${r.width}px`,
    height: `${r.height}px`,
  };
  if (typeof r.left === 'number') patch.left = `${r.left}px`;
  if (typeof r.top === 'number') patch.top = `${r.top}px`;
  try {
    window.parent.postMessage(
      { dgn: 'resize-request', id: drag.cdId, patch, before: drag.before },
      '*'
    );
  } catch {
    /* detached / cross-origin teardown */
  }
}

/** Post a committed rotate (Task L8) — a `transform` patch on the same lane. */
function postRotateRequest(drag: ElResizeDrag, transform: string): void {
  try {
    window.parent.postMessage(
      { dgn: 'resize-request', id: drag.cdId, patch: { transform }, before: drag.before },
      '*'
    );
  } catch {
    /* detached / cross-origin teardown */
  }
}

export function ElementResizeOverlay(): ReactNode {
  ensureElementResizeStyles();
  const { selected } = useSelectionSet();
  const { tool } = useToolMode();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<ElResizeDrag | null>(null);
  // Last committed { el, before } — restored if the shell reports the write
  // failed (dgn:'resize-failed'), so a rejected resize doesn't leave a phantom
  // inline box that the (suppressed / absent) HMR reload never corrects.
  const lastCommitRef = useRef<{ el: HTMLElement; before: ElResizeDrag['before'] } | null>(null);

  const one = selected.length === 1 ? selected[0] : null;
  const cdId = one && typeof one.id === 'string' ? one.id : null;
  // Only a real element selection with the move tool active gets handles.
  const active = tool === 'move' && !!cdId;

  // rAF loop — follow the selected element's screen box (pan/zoom + layout).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const hideAll = () => {
      for (const child of Array.from(c.children)) (child as HTMLElement).style.display = 'none';
    };
    if (!active || !one) {
      hideAll();
      return;
    }
    const tick = () => {
      rafRef.current = null;
      const el = resolveSelectionEl(document, one) as HTMLElement | null;
      // Skip inline text runs where width/height are meaningless (no explicit box).
      if (!el) {
        hideAll();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) {
        hideAll();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // 8 resize handles + 1 rotate handle.
      const TOTAL = EL_RESIZE_CORNERS.length + 1;
      while (c.children.length < TOTAL) c.appendChild(document.createElement('div'));
      while (c.children.length > TOTAL) c.lastChild && c.removeChild(c.lastChild);

      // Rotation-aware placement (Task L8): the element's AABB center is its true
      // center (default transform-origin), so handles ride the ROTATED box. Read
      // the element's own rotation + the .dc-world zoom from computed style (DOM
      // reads — the overlay stays camera-agnostic, no viewport controller).
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = rotationDegFromMatrix(getComputedStyle(el).transform);
      const world = el.closest('.dc-world') as HTMLElement | null;
      const zoom = world ? scaleFromMatrix(getComputedStyle(world).transform) : 1;
      const hw = (el.offsetWidth * zoom) / 2;
      const hh = (el.offsetHeight * zoom) / 2;
      const ROT_OFFSET = 22; // px above top-center for the rotate handle
      const localOffset: Record<string, [number, number]> = {
        nw: [-hw, -hh],
        n: [0, -hh],
        ne: [hw, -hh],
        e: [hw, 0],
        se: [hw, hh],
        s: [0, hh],
        sw: [-hw, hh],
        w: [-hw, 0],
        rotate: [0, -hh - ROT_OFFSET],
      };
      const handles = [...EL_RESIZE_CORNERS, 'rotate'];
      for (let i = 0; i < handles.length; i++) {
        const corner = handles[i];
        const handle = c.children[i] as HTMLElement;
        const [ox, oy] = localOffset[corner] ?? [0, 0];
        const [rx, ry] = rotatePointDeg(ox, oy, deg);
        const ax = cx + rx;
        const ay = cy + ry;
        const isRot = corner === 'rotate';
        const ns = corner === 'n' || corner === 's';
        const ew = corner === 'e' || corner === 'w';
        const halfW = isRot ? 6 : ns ? 7 : ew ? 3 : 4;
        const halfH = isRot ? 6 : ns ? 3 : ew ? 7 : 4;
        handle.className = 'dc-el-resize-handle';
        handle.dataset.corner = corner;
        handle.style.display = 'block';
        handle.style.left = `${Math.round(ax - halfW)}px`;
        handle.style.top = `${Math.round(ay - halfH)}px`;
        // Orient the edge pills with the element; the rotate circle stays upright.
        handle.style.transform = isRot ? '' : `rotate(${deg}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, one]);

  // Live-apply a resize result to the element's inline style (instant preview,
  // no source write). Commit on release.
  const applyPreview = useCallback((d: ElResizeDrag, r: ElResizeResult) => {
    d.el.style.width = `${r.width}px`;
    d.el.style.height = `${r.height}px`;
    if (typeof r.left === 'number') d.el.style.left = `${r.left}px`;
    if (typeof r.top === 'number') d.el.style.top = `${r.top}px`;
    d.lastResult = r;
  }, []);

  // Pointer handling — pointerdown on a handle starts the drag.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;

    const computeFromEvent = (d: ElResizeDrag, ev: PointerEvent): ElResizeResult => {
      // Un-rotate the screen delta into the element's LOCAL frame (so dragging a
      // handle resizes along the element's own axes on a rotated element), then
      // ÷ render zoom → world units.
      const [ldx, ldy] = rotatePointDeg(
        ev.clientX - d.startClientX,
        ev.clientY - d.startClientY,
        -d.angle
      );
      return computeElementResize(
        d.corner as ElResizeCorner,
        d.start,
        ldx / d.elZoom,
        ldy / d.elZoom,
        { aspect: !!ev.shiftKey, center: !!ev.altKey },
        d.flags
      );
    };

    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.classList.contains('dc-el-resize-handle')) return;
      const corner = t.dataset.corner as ElResizeCorner | 'rotate' | undefined;
      if (!corner || !one || typeof one.id !== 'string') return;
      const el = resolveSelectionEl(document, one) as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const elZoom = el.offsetWidth ? rect.width / el.offsetWidth : 1;
      const cs = getComputedStyle(el);
      const outOfFlow = cs.position === 'absolute' || cs.position === 'fixed';
      const startLeft = Number.parseFloat(el.style.left);
      const startTop = Number.parseFloat(el.style.top);
      const angle = rotationDegFromMatrix(cs.transform);
      const z = elZoom > 0 ? elZoom : 1;
      const drag: ElResizeDrag = {
        pointerId: e.pointerId,
        corner,
        el,
        cdId: one.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        elZoom: z,
        angle,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        start: {
          // World-px border box. rect is the AABB; for a rotated element that
          // over-states w/h, so derive from offset dims when rotated.
          w: (angle ? el.offsetWidth : rect.width / z) || rect.width / z,
          h: (angle ? el.offsetHeight : rect.height / z) || rect.height / z,
          left: startLeft,
          top: startTop,
        },
        flags: {
          canMoveLeft: outOfFlow && Number.isFinite(startLeft),
          canMoveTop: outOfFlow && Number.isFinite(startTop),
        },
        before: {
          width: el.style.width || null,
          height: el.style.height || null,
          left: el.style.left || null,
          top: el.style.top || null,
          transform: el.style.transform || null,
        },
        lastResult: null,
        lastTransform: null,
      };
      dragRef.current = drag;
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events may reject capture */
      }
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.preventDefault();
      if (d.corner === 'rotate') {
        // Rotate about the element center toward the pointer; Shift snaps to 15°.
        const deg = rotateDragDeg(d.cx, d.cy, e.clientX, e.clientY, !!e.shiftKey);
        const tf = `rotate(${deg}deg)`;
        d.el.style.transform = tf;
        d.lastTransform = tf;
        return;
      }
      applyPreview(d, computeFromEvent(d, e));
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      if (d.corner === 'rotate') {
        const tf = d.lastTransform;
        if (!tf || tf === d.before.transform) return; // no-op
        lastCommitRef.current = { el: d.el, before: d.before };
        postRotateRequest(d, tf);
        return;
      }
      const r = d.lastResult ?? computeFromEvent(d, e);
      // No-op guard: nothing changed → don't churn a source write / undo entry.
      const changed =
        `${r.width}px` !== d.before.width ||
        `${r.height}px` !== d.before.height ||
        (typeof r.left === 'number' && `${r.left}px` !== d.before.left) ||
        (typeof r.top === 'number' && `${r.top}px` !== d.before.top);
      if (!changed) return;
      lastCommitRef.current = { el: d.el, before: d.before };
      postResizeRequest(d, r);
    };

    // Restore the pre-drag inline box if the shell reports the write failed.
    const onFail = (e: MessageEvent) => {
      const m = e.data as { dgn?: string } | null;
      if (m?.dgn !== 'resize-failed') return;
      if (e.source !== window.parent) return; // only the parent shell (DDR-054)
      const last = lastCommitRef.current;
      if (!last) return;
      last.el.style.width = last.before.width ?? '';
      last.el.style.height = last.before.height ?? '';
      if (last.before.left !== null || last.el.style.left)
        last.el.style.left = last.before.left ?? '';
      if (last.before.top !== null || last.el.style.top) last.el.style.top = last.before.top ?? '';
      if (last.before.transform !== null || last.el.style.transform)
        last.el.style.transform = last.before.transform ?? '';
      lastCommitRef.current = null;
    };

    c.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('message', onFail);
    return () => {
      c.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('message', onFail);
    };
  }, [one, applyPreview]);

  return <div ref={containerRef} aria-hidden="true" />;
}
