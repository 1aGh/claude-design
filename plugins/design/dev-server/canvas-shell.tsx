/**
 * @file       canvas-shell.tsx — universal input-grammar wrapper for TSX canvases
 * @scope      plugins/design/dev-server/canvas-shell.tsx
 * @purpose    Mounted by `DesignCanvas` for every canvas. Stacks
 *             SelectionSetProvider + ContextMenuProvider, wires the input
 *             router to provider actions, and renders the floating chrome
 *             (ToolPalette, hover halo, selection halos, group bbox).
 *
 * Input grammar (V0.16+ universal — there's no opt-out flag):
 *
 *   Move tool (V)
 *     bare hover / click  → passes through (native interactions work)
 *     Cmd + hover         → preview halo on deepest element under cursor
 *     Cmd + click         → replace selection with deepest element
 *     Cmd + Shift + click → add deepest to selection (multi)
 *     right-click         → context menu
 *
 *   Hand tool (H)         pan-on-drag, no Space required; no selection
 *   Comment tool (C)      hover paints halo, click drops comment pin;
 *                         native interactions on artboard children fully
 *                         suppressed via capture-phase preventDefault
 *
 *   keydown V / H / C / Esc → tool switch (Esc also clears selection + menu)
 *
 * Wheel / pinch / space-pan / Cmd+0/1/+/- stay with `useViewportController`
 * (canvas-lib.tsx). The router consumes a strict non-overlapping subset.
 */

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AnnotationsLayer } from './annotations-layer.tsx';
import { ArtboardMarqueeOverlay } from './artboard-marquee.tsx';
import {
  type ArtboardRect,
  SnapGuideOverlay,
  type ViewportControllerHandle,
  useArtboardsContext,
  useDragStateContext,
  useViewportControllerContext,
} from './canvas-lib.tsx';
import { type AlignMode, alignLabel, equalSpacingLabel } from './commands/equal-spacing-command.ts';
import { CommentsOverlay } from './comments-overlay.tsx';
import {
  ContextMenuProvider,
  type ContextRegistry,
  type ContextTarget,
  type ContextTargetKind,
  type MenuItem,
  useContextMenu,
} from './context-menu.tsx';
import { ContextualToolbar } from './contextual-toolbar.tsx';
import { CursorsOverlay } from './cursors-overlay.tsx';
import { EqualSpacingHandles } from './equal-spacing-handles.tsx';
import { ExportDialogProvider } from './export-dialog.tsx';
import { type HoverTarget, resolveHoverTarget, useInputRouter } from './input-router.tsx';
import { ElementMarqueeOverlay } from './marquee-overlay.tsx';
import { ToolPalette } from './tool-palette.tsx';
import { UndoHud } from './undo-hud.tsx';
import {
  AnnotationSelectionProvider,
  useAnnotationSelection,
} from './use-annotation-selection.tsx';
import { AnnotationsVisibilityProvider } from './use-annotations-visibility.tsx';
import { useCollab } from './use-collab.tsx';
import { useCursorModifiers } from './use-cursor-modifiers.tsx';
import { useKeyboardDiscipline } from './use-keyboard-discipline.tsx';
import { type Selection, SelectionSetProvider, useSelectionSet } from './use-selection-set.tsx';
import { useToolMode } from './use-tool-mode.tsx';
import { useUndoStack } from './use-undo-stack.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Styles — halos render as `position: fixed` siblings of the canvas. Reading
// element bounds via getBoundingClientRect (screen coords) keeps the 2 px
// border thickness consistent across zoom levels — CSS `zoom` on the world
// plane would otherwise scale a 2 px outline to 0.84 px at 42 % zoom (subpixel
// = invisible). No per-element class stamping is used.

// DDR-046 — Three-state halo language. Each state has its own border weight,
// color treatment, and geometric idiom so 8+ semantic states (hover / selected
// / member-of-multi / group / snap-sibling / snap-grid / marquee / annotation
// / active-artboard) stay visually distinct. Painting one with another's
// idiom is a regression.
const HALO_CSS = `
.dc-cv-halo {
  position: fixed;
  pointer-events: none;
  z-index: 5;
  box-sizing: border-box;
  border-radius: 2px;
  transition: opacity 60ms linear;
}
/* Hover — lighter 1.5px tinted line + white inner ring for contrast on dark
   elements. NO ring, NO ticks. Synchronous paint (no debounce). */
.dc-cv-halo--hover {
  border: 1.5px solid color-mix(in oklab, var(--accent, #0d99ff) 60%, transparent);
  box-shadow: inset 0 0 0 1px var(--bg-0, #ffffff);
}
/* Selected (single) — 2px solid + 18% ring halo + 4 filled corner ticks.
   Ticks are <i class="tick tick-*"> children at inset:-3px, 8x8, accent fill. */
.dc-cv-halo--selected {
  border: 2px solid var(--accent, #0d99ff);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent, #0d99ff) 18%, transparent);
}
.dc-cv-halo--selected .tick {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--accent, #0d99ff);
  border-radius: 1px;
  box-shadow: 0 0 0 1px var(--bg-0, #ffffff);
}
.dc-cv-halo--selected .tick-tl { top: -3px; left: -3px; }
.dc-cv-halo--selected .tick-tr { top: -3px; right: -3px; }
.dc-cv-halo--selected .tick-bl { bottom: -3px; left: -3px; }
.dc-cv-halo--selected .tick-br { bottom: -3px; right: -3px; }
/* Selected (member of multi-selection) — 1.5 px solid full-accent outline.
   No ring, no ticks (the group bbox above carries the container signal).
   T16 / DDR-046 rev 2 — full opacity instead of 50%-tinted: tinted lines read
   as "draft / placeholder" and members would melt away inside artboards once
   the artboard border itself is 22%-tinted (T15). */
.dc-cv-halo--selected-member {
  border: 1.5px solid var(--accent, #0d99ff);
}
/* Group bbox — 1 px DASHED full accent + four 6 × 6 square corner handles.
   T16 / DDR-046 rev 2 — dashed is the canonical group-container affordance
   (Figma group bbox, FigJam Section drag-state, Photoshop marching ants).
   Dashed reads "ambient binding" without claiming subject-ness; the loud
   solid outlines on each MEMBER carry the active-selection signal. Corner
   handles are 6 × 6 (vs single-select's 8 × 8 ticks) so the group idiom
   reads as "thinner authority" than single-select. */
.dc-cv-group-bbox {
  position: fixed;
  pointer-events: none;
  z-index: 5;
  border: 1px dashed var(--accent, #0d99ff);
  border-radius: 2px;
}
.dc-cv-group-bbox .tick {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--accent, #0d99ff);
  border-radius: 1px;
  box-shadow: 0 0 0 1px var(--bg-0, #ffffff);
}
.dc-cv-group-bbox .tick-tl { top: -3px; left: -3px; }
.dc-cv-group-bbox .tick-tr { top: -3px; right: -3px; }
.dc-cv-group-bbox .tick-bl { bottom: -3px; left: -3px; }
.dc-cv-group-bbox .tick-br { bottom: -3px; right: -3px; }
/*
 * Active-artboard indicator — the artboard whose center sits closest to the
 * viewport midpoint after pan settles is "active" (DesignCanvas tracks this
 * for keyboard jumps + the /design:edit context anchor). DDR-046 — ring sits
 * OUTSIDE the hard drop-shadow so it's visible at any pan distance / zoom.
 * 120 ms ease-out so activation is felt, not invisible.
 */
.dc-canvas .dc-artboard[aria-current="true"] {
  /* T15 — quiet frame, single 2 px accent ring. The previous double-shadow
     (3 px ring + hard 6×6×0 offset) was readable but visually expensive once
     the frame itself lost its brutalist treatment. A 2 px ring on a 22 %
     tinted hairline reads unambiguous without claiming subject-ness. */
  box-shadow: 0 0 0 2px var(--accent, #0d99ff);
  transition: box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* Respect prefers-reduced-motion across all chrome transitions. */
@media (prefers-reduced-motion: reduce) {
  .dc-cv-halo,
  .dc-cv-group-bbox,
  .dc-canvas .dc-artboard[aria-current="true"] {
    transition: none !important;
  }
}
/*
 * Force tool cursor across the canvas tree in comment / hand modes. Without
 * !important on every descendant, buttons and links with their own cursor
 * declaration would flip the cursor away from the tool affordance the moment
 * the user hovers an interactive element — wrong signal when native
 * interactions are suppressed by the router anyway.
 */
/* T22 — per-tool SVG cursors. Each cursor is a 16 × 16 SVG data-URI with a
   declared hotspot. The crosshair / cell / grab fallbacks remain in the
   chain so older browsers still get a recognisable affordance. SVGs are
   utf-8 encoded inline (Chromium / Safari 16+ / Firefox 117+ all accept). */
.dc-canvas {
  --cursor-pen: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M14 1.5 L9 6.5 L2.5 13.5 L1.5 14.5 L2 13 L8.5 6 L13.5 1.5 Z' fill='%23111' stroke='white' stroke-width='0.7' stroke-linejoin='round'/></svg>") 2 14;
  --cursor-rect: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><line x1='0.5' y1='8' x2='15.5' y2='8' stroke='%23111' stroke-width='1'/><line x1='8' y1='0.5' x2='8' y2='15.5' stroke='%23111' stroke-width='1'/><rect x='10.5' y='10.5' width='4' height='3' fill='white' stroke='%23111' stroke-width='1'/></svg>") 8 8;
  --cursor-ellipse: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><line x1='0.5' y1='8' x2='15.5' y2='8' stroke='%23111' stroke-width='1'/><line x1='8' y1='0.5' x2='8' y2='15.5' stroke='%23111' stroke-width='1'/><ellipse cx='12.5' cy='12' rx='2.5' ry='1.5' fill='white' stroke='%23111' stroke-width='1'/></svg>") 8 8;
  --cursor-arrow: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><line x1='0.5' y1='8' x2='15.5' y2='8' stroke='%23111' stroke-width='1'/><line x1='8' y1='0.5' x2='8' y2='15.5' stroke='%23111' stroke-width='1'/><path d='M10 13 L15 13 M12.5 11 L15 13 L12.5 15' fill='none' stroke='%23111' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'/></svg>") 8 8;
  --cursor-eraser: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><rect x='3' y='9' width='8' height='5' rx='1' fill='%23ffb3da' stroke='%23111' stroke-width='1' transform='rotate(-20 7 11.5)'/><rect x='3' y='9' width='8' height='2' fill='%23d63b6e' transform='rotate(-20 7 10)' opacity='0.6'/></svg>") 8 14;
  --cursor-comment: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M3 3 L14 3 L14 11 L8 11 L4 14 L4 11 L3 11 Z' fill='white' stroke='%23111' stroke-width='1' stroke-linejoin='round'/></svg>") 4 4;
}
.dc-canvas[data-active-tool="comment"],
.dc-canvas[data-active-tool="comment"] * {
  cursor: var(--cursor-comment), crosshair !important;
}
.dc-canvas[data-active-tool="pen"],
.dc-canvas[data-active-tool="pen"] * {
  cursor: var(--cursor-pen), crosshair !important;
}
.dc-canvas[data-active-tool="rect"],
.dc-canvas[data-active-tool="rect"] * {
  cursor: var(--cursor-rect), crosshair !important;
}
.dc-canvas[data-active-tool="ellipse"],
.dc-canvas[data-active-tool="ellipse"] * {
  cursor: var(--cursor-ellipse), crosshair !important;
}
.dc-canvas[data-active-tool="arrow"],
.dc-canvas[data-active-tool="arrow"] * {
  cursor: var(--cursor-arrow), crosshair !important;
}
.dc-canvas[data-active-tool="hand"],
.dc-canvas[data-active-tool="hand"] * {
  cursor: grab !important;
}
.dc-canvas[data-active-tool="eraser"],
.dc-canvas[data-active-tool="eraser"] * {
  cursor: var(--cursor-eraser), cell !important;
}

/* T31 — Level of detail. Below 0.35 zoom we hide pre-attentive chrome that
   becomes visual noise (corner ticks, distance pills, active-artboard ring,
   snap pills). Above 4.0 we coax the browser into crisper text rendering.
   The "normal" band 0.35..4.0 carries the full chrome. */
.dc-canvas[data-cv-zoom-lod="low"] .dc-cv-halo .tick,
.dc-canvas[data-cv-zoom-lod="low"] .dc-cv-group-bbox .tick {
  display: none;
}
.dc-canvas[data-cv-zoom-lod="low"] .dc-snap-pill,
.dc-canvas[data-cv-zoom-lod="low"] .dc-cv-eq-pill {
  display: none;
}
.dc-canvas[data-cv-zoom-lod="low"] .dc-artboard[aria-current="true"] {
  box-shadow: none;
}
.dc-canvas[data-cv-zoom-lod="crisp"] {
  -webkit-font-smoothing: subpixel-antialiased;
  font-smooth: always;
}
`.trim();

function ensureHaloStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-cv-halo-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-cv-halo-css';
  s.textContent = HALO_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell

export function CanvasShell({
  hostRef,
  children,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  ensureHaloStyles();
  // ToolProvider is mounted by DesignCanvas one level up (so the viewport
  // controller's `isPanDragActive` predicate can read the live tool state).
  return (
    <SelectionSetProvider>
      <AnnotationSelectionProvider>
        <AnnotationsVisibilityProvider>
          <CanvasCore hostRef={hostRef}>{children}</CanvasCore>
        </AnnotationsVisibilityProvider>
      </AnnotationSelectionProvider>
    </SelectionSetProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CanvasCore — sits inside SelectionSetProvider, builds the menu registry
// against the live viewport controller + selection set, then mounts
// ContextMenuProvider + CanvasRouter.

function CanvasCore({
  hostRef,
  children,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const controller = useViewportControllerContext();
  const selSet = useSelectionSet();
  const { tool } = useToolMode();

  // Project active tool to `.dc-canvas[data-active-tool]` so the cursor
  // override CSS rules (HALO_CSS) can force the tool cursor across every
  // descendant — buttons / links with their own cursor declaration get
  // overridden when in comment / hand modes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.setAttribute('data-active-tool', tool);
    return () => {
      host.removeAttribute('data-active-tool');
    };
  }, [hostRef, tool]);

  // T28 — modifier-aware cursor (Alt → copy on cd-id, Shift → crosshair on
  // body padding). CSS-driven once data-mod-* is reflected on the host.
  useCursorModifiers(hostRef);
  // T29 — arrow nudge (artboards) + Cmd+A select-all (active artboard).
  // Cmd+D duplicate deferred; no live duplicate channel for either artboards
  // or stamped elements yet.
  useKeyboardDiscipline();

  const artboardsCtx = useArtboardsContext();
  const dragBus = useDragStateContext();

  // T33 — programmatic-zoom easing via double-click on empty world only.
  // Per post-Wave-3 user feedback, dblclick-on-artboard auto-zoom was
  // surprising (interfered with native dblclick text-select inside chrome
  // and felt magnetic). We keep the dblclick-empty → `fit()` path because
  // it's a discoverable "back to overview" gesture; artboard zoom is still
  // reachable via Cmd+1 and the zoom HUD.
  useEffect(() => {
    if (!controller) return;
    const host = hostRef.current;
    if (!host) return;
    const onDbl = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || !t.closest) return;
      // Floating chrome / overlays / drawn user content / any artboard
      // surface → leave alone. Only dblclick that lands on the canvas
      // background outside every artboard triggers `fit()`.
      if (
        t.closest(
          '.dc-mm, .dc-zoom-tb, .dc-tool-palette, .dc-context-menu, .dc-annot-svg, .dc-annot-ctx, .cm-composer, .cm-thread, .cm-mention-popup, .cm-pin'
        )
      ) {
        return;
      }
      if (t.closest('[data-dc-screen]')) return; // any part of an artboard
      e.preventDefault();
      controller.fit();
    };
    host.addEventListener('dblclick', onDbl);
    return () => host.removeEventListener('dblclick', onDbl);
  }, [controller, hostRef]);

  // T31 — level-of-detail attribute on `.dc-canvas`. CSS rules hide
  // pre-attentive chrome (ticks, distance pills, accent ring) below 0.35
  // zoom and sharpen text above 4.0. tldraw's textShadowLod = 0.35 is the
  // canonical threshold. Reads the published viewport (settle-cadence) so
  // the LOD doesn't flicker between bands mid-zoom — chrome should settle
  // once per gesture, not on every frame.
  const publishedZoom = artboardsCtx?.viewport?.zoom ?? 1;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const lod = publishedZoom < 0.35 ? 'low' : publishedZoom > 4 ? 'crisp' : 'normal';
    host.setAttribute('data-cv-zoom-lod', lod);
    return () => host.removeAttribute('data-cv-zoom-lod');
  }, [hostRef, publishedZoom]);

  // Phase 8 — publish local cursor (world coords) + viewport to Awareness
  // so foreign peers can render our cursor on their CursorsOverlay. The
  // collab.publishAwareness call is already throttled to ~30 Hz internally
  // (use-collab.tsx) — we just need to compute screen → world per move.
  const collab = useCollab();
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !collab || !controller) return;
    const onMove = (e: MouseEvent) => {
      const v = controller.viewport;
      // screen → world: world = (screen - viewport.{x,y}) / zoom.
      const worldX = (e.clientX - v.x) / Math.max(v.zoom, 0.0001);
      const worldY = (e.clientY - v.y) / Math.max(v.zoom, 0.0001);
      collab.publishAwareness({ cursor: { x: worldX, y: worldY } });
    };
    const onLeave = () => {
      collab.publishAwareness({ cursor: null });
    };
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    return () => {
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
    };
  }, [hostRef, collab, controller]);

  // Phase 8 — publish viewport when it settles. The CursorsOverlay only
  // needs the LOCAL viewport (to transform foreign world coords back to
  // screen), but exposing ours over Awareness sets up Task 6's follow-mode.
  useEffect(() => {
    if (!collab || !controller) return;
    collab.publishAwareness({ viewport: controller.viewport });
  }, [collab, controller, controller?.viewport.x, controller?.viewport.y, controller?.viewport.zoom]);

  /**
   * T24 — distribute the currently-selected artboards evenly on the given
   * axis. Requires ≥ 3 selected artboards. Sort by leading edge, hold the
   * first + last in place, and reposition the middle artboards so the gaps
   * between trailing edge → next leading edge are equal.
   */
  const distributeArtboards = useCallback(
    (axis: 'x' | 'y') => {
      if (!artboardsCtx || !dragBus) return;
      const ids = new Set(
        selSet.selected.filter((s) => !!s.artboardId).map((s) => s.artboardId as string)
      );
      if (ids.size < 3) return;
      const targets: ArtboardRect[] = artboardsCtx.artboards.filter((r) => ids.has(r.id));
      if (targets.length < 3) return;
      const sorted = [...targets].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last) return;
      // Total content extent (sum of side-lengths on the axis) + the span
      // between first leading edge and last trailing edge gives us the gap
      // budget to divide equally between (n-1) inter-artboard slots.
      const sideLen = (r: ArtboardRect) => (axis === 'x' ? r.w : r.h);
      const totalSides = sorted.reduce((acc, r) => acc + sideLen(r), 0);
      const span =
        (axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y) - totalSides;
      const gap = span / (sorted.length - 1);
      const moved: { id: string; x: number; y: number }[] = [];
      let cursor = axis === 'x' ? first.x + first.w + gap : first.y + first.h + gap;
      for (let i = 1; i < sorted.length - 1; i++) {
        const r = sorted[i];
        if (!r) continue;
        if (axis === 'x') {
          moved.push({ id: r.id, x: Math.round(cursor), y: r.y });
          cursor += r.w + gap;
        } else {
          moved.push({ id: r.id, x: r.x, y: Math.round(cursor) });
          cursor += r.h + gap;
        }
      }
      if (moved.length === 0) return;
      dragBus.commitPositions(moved, { label: equalSpacingLabel(sorted.length) });
    },
    [artboardsCtx, dragBus, selSet.selected]
  );

  /**
   * G7 — align selected artboards to a common edge / midline. Requires ≥ 2
   * selected artboards. Six modes:
   *   - 'left'      → all artboards share the minimum x of the set
   *   - 'right'     → all artboards share the maximum (x + w) edge
   *   - 'center-x'  → all artboards share the midpoint of the set's x extent
   *   - 'top'       → all artboards share the minimum y
   *   - 'bottom'    → all artboards share the maximum (y + h) edge
   *   - 'center-y'  → all artboards share the midpoint of the set's y extent
   *
   * Holds the reference edge constant; only the perpendicular axis stays as
   * each artboard already was (alignment doesn't relocate on the orthogonal
   * axis). This matches Figma / Sketch / FigJam align semantics.
   */
  const alignArtboards = useCallback(
    (mode: AlignMode) => {
      if (!artboardsCtx || !dragBus) return;
      const ids = new Set(
        selSet.selected.filter((s) => !!s.artboardId).map((s) => s.artboardId as string)
      );
      if (ids.size < 2) return;
      const targets: ArtboardRect[] = artboardsCtx.artboards.filter((r) => ids.has(r.id));
      if (targets.length < 2) return;

      // Union bbox for center modes.
      let xMin = Number.POSITIVE_INFINITY;
      let yMin = Number.POSITIVE_INFINITY;
      let xMax = Number.NEGATIVE_INFINITY;
      let yMax = Number.NEGATIVE_INFINITY;
      for (const r of targets) {
        if (r.x < xMin) xMin = r.x;
        if (r.y < yMin) yMin = r.y;
        if (r.x + r.w > xMax) xMax = r.x + r.w;
        if (r.y + r.h > yMax) yMax = r.y + r.h;
      }
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;

      const moved: { id: string; x: number; y: number }[] = [];
      for (const r of targets) {
        let nx = r.x;
        let ny = r.y;
        switch (mode) {
          case 'left':
            nx = xMin;
            break;
          case 'right':
            nx = xMax - r.w;
            break;
          case 'center-x':
            nx = cx - r.w / 2;
            break;
          case 'top':
            ny = yMin;
            break;
          case 'bottom':
            ny = yMax - r.h;
            break;
          case 'center-y':
            ny = cy - r.h / 2;
            break;
        }
        if (Math.round(nx) === r.x && Math.round(ny) === r.y) continue;
        moved.push({ id: r.id, x: Math.round(nx), y: Math.round(ny) });
      }
      if (moved.length === 0) return;
      dragBus.commitPositions(moved, { label: alignLabel(mode, targets.length) });
    },
    [artboardsCtx, dragBus, selSet.selected]
  );

  /**
   * G2v2 — "Fit just this artboard" context-menu entry previously bridged
   * via a synthetic click on the label button (which used to call
   * controller.jumpTo). Now that the label is purely a11y, the menu entry
   * needs a direct path: look the rect up from the live artboards list and
   * call jumpTo straight on the controller.
   */
  const focusArtboard = useCallback(
    (artboardId: string) => {
      if (!controller || !artboardsCtx) return;
      const rect = artboardsCtx.artboards.find((r) => r.id === artboardId);
      if (rect) controller.jumpTo(rect);
    },
    [controller, artboardsCtx]
  );

  const registry = useMemo<ContextRegistry>(
    () =>
      buildRegistry({
        controller,
        clearSelection: selSet.clear,
        selSet,
        distributeArtboards,
        alignArtboards,
        focusArtboard,
      }),
    [controller, selSet, distributeArtboards, alignArtboards, focusArtboard]
  );

  // Distribute is reached via the MultiArtboardToolbar (floating chrome
  // anchored above the group bbox) + context menu. No keyboard shortcut —
  // user feedback (post-Wave-2) preferred the toolbar over global hotkeys.

  return (
    <ExportDialogProvider>
      <ContextMenuProvider registry={registry}>
        <CanvasRouter
          hostRef={hostRef}
          distributeArtboards={distributeArtboards}
          alignArtboards={alignArtboards}
        >
          {children}
        </CanvasRouter>
      </ContextMenuProvider>
    </ExportDialogProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry builder — closes over controller + clear callback.

function buildRegistry(deps: {
  controller: ViewportControllerHandle | null;
  clearSelection: () => void;
  selSet: { selected: Selection[] };
  distributeArtboards: (axis: 'x' | 'y') => void;
  alignArtboards: (mode: 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y') => void;
  focusArtboard: (artboardId: string) => void;
}): ContextRegistry {
  const { controller, clearSelection, selSet, distributeArtboards, alignArtboards, focusArtboard } =
    deps;

  // T24 — distribute commands are only enabled when ≥ 3 artboards are
  // selected. Below that, the menu items render as `disabled` so the user
  // sees the affordance but understands the precondition.
  // G7 — align commands are enabled at ≥ 2 (alignment is well-defined with 2).
  const selectedArtboardCount = selSet.selected.filter((s) => !!s.artboardId).length;
  const distributeEnabled = selectedArtboardCount >= 3;
  const alignEnabled = selectedArtboardCount >= 2;

  const copy = (text: string): void => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).catch(() => {
      /* clipboard blocked */
    });
  };

  const postComposeForTarget = (target: ContextTarget): void => {
    if (typeof window === 'undefined') return;
    const sel: Selection | null = target.el
      ? {
          file: deriveFile(),
          id: target.cdId ?? undefined,
          selector: target.cdId ? `[data-cd-id="${target.cdId}"]` : cssPath(target.el),
          artboardId: target.artboardId,
          tag: target.el.tagName.toLowerCase(),
          classes: realClasses(target.el),
          text: shortText(target.el, 240),
          dom_path: domPath(target.el),
          bounds: (target.el as HTMLElement).getBoundingClientRect
            ? boundsOf(target.el as HTMLElement)
            : null,
          html: (target.el.outerHTML ?? '').slice(0, 4000),
        }
      : null;
    try {
      window.parent.postMessage({ dgn: 'comment-compose', selection: sel }, '*');
    } catch {
      /* ignore */
    }
  };

  const fitItem: MenuItem = {
    id: 'fit-view',
    label: 'Fit to view',
    shortcut: '1',
    onSelect: () => controller?.fit(),
  };
  const resetItem: MenuItem = {
    id: 'reset-view',
    label: 'Reset view',
    shortcut: '⌘0',
    onSelect: () => controller?.reset(),
  };

  // Phase 6.5 — context-menu → ExportDialog. Each entry dispatches a custom
  // event the dialog provider listens for; this avoids prop-drilling the
  // dialog handle through every menu callback. The scope arg prefills the
  // dialog's scope dropdown so the user lands on the right resolution.
  const exportItem = (id: string, label: string, scope: string, shortcut?: string): MenuItem => ({
    id,
    label,
    shortcut,
    onSelect: () => {
      try {
        window.dispatchEvent(new CustomEvent('maude:open-export', { detail: { scope } }));
      } catch {
        /* non-window environments */
      }
    },
  });

  return {
    element: [
      [
        {
          id: 'add-comment',
          label: 'Add comment',
          shortcut: 'C',
          onSelect: postComposeForTarget,
        },
        {
          id: 'copy-css',
          label: 'Copy CSS',
          shortcut: '⌘⇧C',
          onSelect: (target) => {
            if (!target.el) return;
            copy(cssPath(target.el));
          },
        },
        {
          id: 'copy-id',
          label: 'Copy data-cd-id',
          onSelect: (target) => {
            if (target.cdId) copy(target.cdId);
          },
        },
        {
          id: 'inspect',
          label: 'Inspect',
          shortcut: '⌥I',
          disabled: true,
          onSelect: () => {
            console.warn('[context-menu] TODO: tweaks panel for TSX canvases');
          },
        },
      ],
      [exportItem('export-selection', 'Export selection…', 'selection', '⌘E')],
      [
        {
          id: 'hide',
          label: 'Hide',
          shortcut: '⌘⇧H',
          onSelect: (target) => {
            if (target.el) (target.el as HTMLElement).style.visibility = 'hidden';
          },
        },
        {
          id: 'deselect',
          label: 'Deselect',
          shortcut: 'Esc',
          onSelect: () => clearSelection(),
        },
      ],
    ],
    'artboard-chrome': [
      [
        {
          id: 'fit-one',
          label: 'Fit just this artboard',
          onSelect: (target) => {
            if (!target.artboardId) return;
            focusArtboard(target.artboardId);
          },
        },
        fitItem,
        resetItem,
      ],
      [
        // G7 — align commands. Six modes; gated on ≥ 2 selected artboards
        // (alignment is well-defined with 2). Primary surface is the
        // MultiArtboardToolbar; menu entries are discoverability backup.
        {
          id: 'align-left',
          label: 'Align left',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('left'),
        },
        {
          id: 'align-center-x',
          label: 'Align center (horizontal)',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('center-x'),
        },
        {
          id: 'align-right',
          label: 'Align right',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('right'),
        },
        {
          id: 'align-top',
          label: 'Align top',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('top'),
        },
        {
          id: 'align-center-y',
          label: 'Align center (vertical)',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('center-y'),
        },
        {
          id: 'align-bottom',
          label: 'Align bottom',
          disabled: !alignEnabled,
          onSelect: () => alignArtboards('bottom'),
        },
      ],
      [
        // T24 — distribute commands. Primary surface is the floating
        // MultiArtboardToolbar above the group bbox; the menu entries are
        // a discoverability backup. Disabled when fewer than 3 artboards
        // are selected.
        {
          id: 'distribute-h',
          label: 'Distribute horizontally',
          disabled: !distributeEnabled,
          onSelect: () => distributeArtboards('x'),
        },
        {
          id: 'distribute-v',
          label: 'Distribute vertically',
          disabled: !distributeEnabled,
          onSelect: () => distributeArtboards('y'),
        },
      ],
      [exportItem('export-artboard', 'Export this artboard…', 'artboard')],
    ],
    world: [
      [fitItem, resetItem],
      [
        exportItem('export-canvas', 'Export canvas as separate…', 'canvas-as-separate'),
        exportItem('export-project', 'Export project (ZIP)…', 'project-raw'),
      ],
    ],
    overlay: [],
  };
}

function boundsOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Router wire-up

function CanvasRouter({
  hostRef,
  children,
  distributeArtboards,
  alignArtboards,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  distributeArtboards: (axis: 'x' | 'y') => void;
  alignArtboards: (mode: 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y') => void;
}) {
  const { tool, setTool, clearSticky } = useToolMode();
  const selSet = useSelectionSet();
  const annotSel = useAnnotationSelection();
  const ctxMenu = useContextMenu();
  const undoStack = useUndoStack();

  // Hover state drives the floating .dc-cv-halo--hover overlay. The overlay
  // itself reads getBoundingClientRect on every rAF tick to follow pan/zoom.
  const [hoverEl, setHoverEl] = useState<Element | null>(null);

  // rAF-coalesced hover dispatcher. `pointermove` fires hundreds of times/sec
  // under trackpad input — collapse to one elementFromPoint per frame.
  const pendingHoverRef = useRef<{ deep: boolean; x: number; y: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  const getActiveTool = useCallback(() => tool, [tool]);

  const applyHover = useCallback(() => {
    hoverRafRef.current = null;
    const pending = pendingHoverRef.current;
    pendingHoverRef.current = null;
    if (!pending) return;
    const target = resolveHoverTarget(document, pending.x, pending.y, {
      deep: pending.deep,
    });
    const nextEl = target?.el ?? null;
    setHoverEl((prev) => (prev === nextEl ? prev : nextEl));
  }, []);

  // Clear hover when switching to hand mode mid-stream.
  useEffect(() => {
    if (tool === 'hand') setHoverEl(null);
  }, [tool]);

  // Listen for `dgn: 'force-clear'` from the shell — the comment composer
  // posts it on submit / cancel / Esc so the selection halo clears when the
  // user closes the composer.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { dgn?: string } | null;
      if (!m || typeof m !== 'object' || !m.dgn) return;
      if (m.dgn === 'force-clear' || m.dgn === 'select-clear' || m.dgn === 'selection-clear') {
        selSet.clear();
        annotSel.clear();
        setHoverEl(null);
        return;
      }
      if (m.dgn === 'tool-set') {
        const t = (m as { tool?: string }).tool;
        if (typeof t === 'string') setTool(t as never);
        return;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [selSet, annotSel, setTool]);

  // Cleanup any pending rAF on unmount.
  useEffect(
    () => () => {
      if (hoverRafRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(hoverRafRef.current);
      }
    },
    []
  );

  useInputRouter({
    hostRef,
    getActiveTool,
    callbacks: {
      onHover: ({ deep, clientX, clientY }) => {
        pendingHoverRef.current = { deep, x: clientX, y: clientY };
        if (hoverRafRef.current == null && typeof requestAnimationFrame !== 'undefined') {
          hoverRafRef.current = requestAnimationFrame(applyHover);
        }
      },
      onSelect: ({ mode, deep, clientX, clientY }) => {
        const target = resolveHoverTarget(document, clientX, clientY, { deep });
        if (!target) {
          // No-target click (canvas chrome / dead space) — DO NOT auto-clear
          // the selection. Esc is the canonical deselect gesture; click-to-
          // clear loses the user's selection on accidental misses. The empty
          // marquee path (artboard-marquee.tsx) likewise never clears unless
          // it actually captured something.
          return;
        }
        const sel = hoverTargetToSelection(target);
        if (mode === 'replace') selSet.replace(sel);
        else selSet.add(sel);
      },
      onContextMenu: ({ clientX, clientY }) => {
        const target = resolveHoverTarget(document, clientX, clientY, { deep: true });
        const kind = classifyContextKind(target);
        const ctxTarget: ContextTarget = {
          kind,
          el: target?.el ?? null,
          cdId: target?.cdId ?? null,
          artboardId: target?.artboardId ?? null,
          clientX,
          clientY,
        };
        ctxMenu.open(ctxTarget);
      },
      onTool: ({ tool: t }) => setTool(t),
      onUndo: () => {
        void undoStack.undo();
      },
      onRedo: () => {
        void undoStack.redo();
      },
      onEscape: () => {
        // T21 — abort any mid-stroke draw FIRST. The annotations layer
        // listens for `maude:cancel-stroke` and drops the in-progress
        // shape without committing.
        try {
          document.dispatchEvent(new CustomEvent('maude:cancel-stroke'));
        } catch {
          /* non-DOM env */
        }
        // T19 — clear sticky-tool lock + flip back to Move. Esc is the
        // canonical "back to default state" gesture across canvas apps.
        clearSticky();
        if (tool !== 'move') setTool('move');
        ctxMenu.close();
        selSet.clear();
        annotSel.clear();
        setHoverEl(null);
      },
      onDropComment: ({ clientX, clientY }) => {
        // First try deep mode — preferred when the user clicks exactly on
        // a stamped element. When the deep hit lands on an element with
        // `pointer-events: none` (decorative <svg> children, overlay icons),
        // elementFromPoint propagates past it and `resolveHoverTarget`
        // returns null because the next-closest hit is `.dc-artboard-body`
        // itself.
        let target = resolveHoverTarget(document, clientX, clientY, { deep: true });
        if (!target) target = resolveHoverTarget(document, clientX, clientY, { deep: false });
        // Phase 6 fallback — when both resolveHoverTarget passes bail (the
        // `hit === bodyEl` early-exit triggers on `pointer-events: none`
        // decorations), enumerate every element under the click point and
        // climb the first one that has `data-cd-id`. This is how clicks on
        // SVG logos / icon glyphs land on the actual stamped wrapper.
        if (!target && typeof document.elementsFromPoint === 'function') {
          const stack = document.elementsFromPoint(clientX, clientY);
          for (const candidate of stack) {
            const stamped = (candidate as Element).closest?.('[data-cd-id]') as HTMLElement | null;
            if (!stamped) continue;
            if (!stamped.closest('.dc-artboard-body')) continue;
            const artboardEl = stamped.closest('[data-dc-screen]');
            target = {
              el: stamped,
              cdId: stamped.getAttribute('data-cd-id'),
              artboardId: artboardEl?.getAttribute('data-dc-screen') ?? null,
            };
            break;
          }
        }
        if (!target) {
          // Floating comment fallback — no element anchor, just a click
          // point. The overlay still renders a pin at the stored bounds.
          if (typeof window === 'undefined' || typeof document === 'undefined') return;
          const floatingSel: Selection = {
            file: deriveFile(),
            id: undefined,
            selector: '',
            artboardId: null,
            tag: '',
            classes: '',
            text: '',
            dom_path: [],
            bounds: { x: clientX - 12, y: clientY - 12, w: 24, h: 24 },
            html: '',
          };
          try {
            document.dispatchEvent(
              new CustomEvent('cm:open-composer', {
                detail: { selection: floatingSel, clientX, clientY },
              })
            );
          } catch {
            /* ignore */
          }
          try {
            window.parent.postMessage({ dgn: 'comment-compose', selection: floatingSel }, '*');
          } catch {
            /* parent detached */
          }
          return;
        }
        const sel = hoverTargetToSelection(target);
        // Commit the target to the selection set so the halo persists while
        // the composer is open. The user clears by:
        //   - submit / cancel on the composer (overlay dispatches force-clear)
        //   - pressing Esc inside the canvas (router's onEscape → clear)
        //   - clicking another element in comment mode (this handler runs
        //     again and replaces)
        selSet.replace(sel);
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        // Phase 6 — open the in-place composer inside the iframe at the click
        // point. Custom event is iframe-local so the overlay can subscribe
        // without round-tripping through the parent shell.
        try {
          document.dispatchEvent(
            new CustomEvent('cm:open-composer', {
              detail: { selection: sel, clientX, clientY },
            })
          );
        } catch {
          /* CustomEvent absent — fall through to legacy parent path */
        }
        // Still post to parent for back-compat with any legacy `.html` mocks
        // whose inspector script consumes `comment-compose`.
        try {
          window.parent.postMessage({ dgn: 'comment-compose', selection: sel }, '*');
        } catch {
          /* parent detached */
        }
      },
    },
  });

  return (
    <>
      {children}
      <CommentsOverlay />
      <AnnotationsLayer />
      <ToolPalette />
      <ArtboardMarqueeOverlay />
      <ElementMarqueeOverlay />
      <HoverHalo el={hoverEl} />
      <SelectionHalos />
      <GroupBbox />
      <EqualSpacingHandles />
      <ContextualToolbar />
      <MultiArtboardToolbar
        distributeArtboards={distributeArtboards}
        alignArtboards={alignArtboards}
      />
      <SnapGuideOverlay />
      <UndoHud />
      <CursorsOverlay />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MultiArtboardToolbar — floating chrome anchored above the group bbox when
// ≥ 2 artboards are multi-selected. Primary surface for the distribute
// commands (post-Wave-2 feedback preferred this over global ⌘⌥H / ⌘⌥V
// hotkeys). Disabled state when fewer than 3 artboards are selected — the
// math is undefined for 2.

const MULTI_TOOLBAR_CSS = `
.dc-multi-artboard-tb {
  position: fixed;
  pointer-events: auto;
  z-index: 6;
  display: none;
  align-items: stretch;
  gap: 2px;
  padding: 4px;
  background: var(--u-bg-0, var(--bg-0, #ffffff));
  border: 1px solid var(--u-fg-0, #1c1917);
  border-radius: 8px;
  box-shadow: 0 6px 24px color-mix(in oklab, var(--u-fg-0, #1c1917) 10%, transparent);
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--u-fg-0, #1a1a1a);
  user-select: none;
}
.dc-multi-artboard-tb button {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 80ms linear;
}
.dc-multi-artboard-tb button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--accent, #d63b1f) 8%, transparent);
}
.dc-multi-artboard-tb button:disabled {
  cursor: default;
  opacity: 0.4;
}
.dc-multi-artboard-tb .dc-mab-count {
  padding: 4px 8px 4px 10px;
  color: var(--fg-1, rgba(40,30,20,0.7));
  border-right: 1px solid var(--u-border-subtle, rgba(0,0,0,0.08));
  margin-right: 2px;
  font-variant-numeric: tabular-nums;
}
.dc-multi-artboard-tb .dc-mab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dc-multi-artboard-tb .dc-mab-divider {
  width: 1px;
  align-self: stretch;
  background: var(--u-border-subtle, rgba(0,0,0,0.10));
  margin: 0 4px;
}
@media (prefers-reduced-motion: reduce) {
  .dc-multi-artboard-tb button { transition: none; }
}
`.trim();

function ensureMultiToolbarStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-multi-artboard-tb-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-multi-artboard-tb-css';
  s.textContent = MULTI_TOOLBAR_CSS;
  document.head.appendChild(s);
}

function MultiArtboardToolbar({
  distributeArtboards,
  alignArtboards,
}: {
  distributeArtboards: (axis: 'x' | 'y') => void;
  alignArtboards: (mode: 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y') => void;
}) {
  ensureMultiToolbarStyles();
  const { selected } = useSelectionSet();
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const artboardSelections = useMemo(() => selected.filter((s) => !!s.artboardId), [selected]);
  const artboardCount = artboardSelections.length;
  const distributeOk = artboardCount >= 3;
  const alignOk = artboardCount >= 2;

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    if (artboardCount < 2) {
      div.style.display = 'none';
      return;
    }
    // Track the screen-coord union bbox of all selected artboards each
    // frame. Anchor toolbar centered horizontally above the bbox top
    // edge with a 14 px gap; flip BELOW if the top edge is < 60 px from
    // the viewport top.
    const tick = () => {
      rafRef.current = null;
      let xMin = Number.POSITIVE_INFINITY;
      let yMin = Number.POSITIVE_INFINITY;
      let xMax = Number.NEGATIVE_INFINITY;
      let yMax = Number.NEGATIVE_INFINITY;
      let any = false;
      for (const sel of artboardSelections) {
        const el = document.querySelector(`[data-dc-screen="${sel.artboardId}"]`);
        if (!el) continue;
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        any = true;
        if (r.left < xMin) xMin = r.left;
        if (r.top < yMin) yMin = r.top;
        if (r.right > xMax) xMax = r.right;
        if (r.bottom > yMax) yMax = r.bottom;
      }
      if (!any) {
        div.style.display = 'none';
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // Make the toolbar visible OFFSCREEN first to measure its own
      // width, then move it to the anchor. (Cheap: only re-anchors on
      // every frame after the first.)
      div.style.display = 'flex';
      const tw = div.offsetWidth || 0;
      const centerX = (xMin + xMax) / 2;
      const top = yMin;
      const gap = 14;
      let anchorY = top - div.offsetHeight - gap;
      if (anchorY < 60) anchorY = yMax + gap; // flip below
      div.style.left = `${Math.round(centerX - tw / 2)}px`;
      div.style.top = `${Math.round(anchorY)}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [artboardCount, artboardSelections]);

  if (artboardCount < 2) {
    return <div ref={ref} className="dc-multi-artboard-tb" aria-hidden="true" />;
  }

  return (
    <div
      ref={ref}
      className="dc-multi-artboard-tb"
      role="toolbar"
      aria-label="Multi-artboard actions"
    >
      <span className="dc-mab-count">{artboardCount} artboards</span>
      {/* G7 — align cluster. Icon-only to keep the toolbar narrow; full
          label lives in the tooltip + the right-click menu. Enabled at ≥ 2
          artboards (alignment is well-defined with 2). */}
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align left' : 'Select at least 2 artboards to align'}
        aria-label="Align left"
        onClick={() => alignArtboards('left')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="0.5" y1="0.5" x2="0.5" y2="13.5" stroke="currentColor" />
            <rect x="1" y="2" width="7" height="3" fill="currentColor" />
            <rect x="1" y="9" width="11" height="3" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align center (horizontal)' : 'Select at least 2 artboards to align'}
        aria-label="Align center horizontally"
        onClick={() => alignArtboards('center-x')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="7" y1="0.5" x2="7" y2="13.5" stroke="currentColor" />
            <rect x="3.5" y="2" width="7" height="3" fill="currentColor" />
            <rect x="1.5" y="9" width="11" height="3" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align right' : 'Select at least 2 artboards to align'}
        aria-label="Align right"
        onClick={() => alignArtboards('right')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="13.5" y1="0.5" x2="13.5" y2="13.5" stroke="currentColor" />
            <rect x="6" y="2" width="7" height="3" fill="currentColor" />
            <rect x="2" y="9" width="11" height="3" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align top' : 'Select at least 2 artboards to align'}
        aria-label="Align top"
        onClick={() => alignArtboards('top')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="0.5" y1="0.5" x2="13.5" y2="0.5" stroke="currentColor" />
            <rect x="2" y="1" width="3" height="7" fill="currentColor" />
            <rect x="9" y="1" width="3" height="11" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align center (vertical)' : 'Select at least 2 artboards to align'}
        aria-label="Align center vertically"
        onClick={() => alignArtboards('center-y')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="0.5" y1="7" x2="13.5" y2="7" stroke="currentColor" />
            <rect x="2" y="3.5" width="3" height="7" fill="currentColor" />
            <rect x="9" y="1.5" width="3" height="11" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!alignOk}
        title={alignOk ? 'Align bottom' : 'Select at least 2 artboards to align'}
        aria-label="Align bottom"
        onClick={() => alignArtboards('bottom')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="0.5" y1="13.5" x2="13.5" y2="13.5" stroke="currentColor" />
            <rect x="2" y="6" width="3" height="7" fill="currentColor" />
            <rect x="9" y="2" width="3" height="11" fill="currentColor" />
          </svg>
        </span>
      </button>
      <span className="dc-mab-divider" aria-hidden="true" />
      <button
        type="button"
        disabled={!distributeOk}
        title={
          distributeOk
            ? 'Distribute horizontally — equal gaps between artboards'
            : 'Select at least 3 artboards to distribute'
        }
        aria-label="Distribute horizontally"
        onClick={() => distributeArtboards('x')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="0.5" y="3" width="3" height="8" fill="currentColor" />
            <rect x="5.5" y="3" width="3" height="8" fill="currentColor" />
            <rect x="10.5" y="3" width="3" height="8" fill="currentColor" />
          </svg>
        </span>
      </button>
      <button
        type="button"
        disabled={!distributeOk}
        title={
          distributeOk
            ? 'Distribute vertically — equal gaps between artboards'
            : 'Select at least 3 artboards to distribute'
        }
        aria-label="Distribute vertically"
        onClick={() => distributeArtboards('y')}
      >
        <span className="dc-mab-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="3" y="0.5" width="8" height="3" fill="currentColor" />
            <rect x="3" y="5.5" width="8" height="3" fill="currentColor" />
            <rect x="3" y="10.5" width="8" height="3" fill="currentColor" />
          </svg>
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HoverHalo — single floating overlay tracking the hovered element's screen
// bounds. Updates on every animation frame while mounted. Position: fixed so
// CSS `zoom` on the world plane never affects the 2 px border thickness.

function HoverHalo({ el }: { el: Element | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<Element | null>(el);
  targetRef.current = el;

  useEffect(() => {
    if (!el) {
      if (ref.current) ref.current.style.display = 'none';
      return;
    }
    const tick = () => {
      rafRef.current = null;
      const div = ref.current;
      const t = targetRef.current;
      if (!div || !t || !t.isConnected) {
        if (div) div.style.display = 'none';
        return;
      }
      const r = (t as HTMLElement).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        div.style.display = 'none';
      } else {
        div.style.display = 'block';
        div.style.left = `${Math.round(r.left)}px`;
        div.style.top = `${Math.round(r.top)}px`;
        div.style.width = `${Math.round(r.width)}px`;
        div.style.height = `${Math.round(r.height)}px`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [el]);

  if (!el) return null;
  return <div ref={ref} className="dc-cv-halo dc-cv-halo--hover" aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectionHalos — N floating overlays, one per selected element. Resolves
// elements by `data-cd-id` when present, falling back to the selector path.

// DDR-046 — single-select halo carries 4 corner ticks; multi-select members get
// the lighter 1px tinted outline (no ticks). The GroupBbox renders the loud
// signal when selected.length > 1.
const TICK_CLASSES = ['tick-tl', 'tick-tr', 'tick-bl', 'tick-br'] as const;

function makeSelectedNode(withTicks: boolean): HTMLDivElement {
  const child = document.createElement('div');
  child.className = withTicks
    ? 'dc-cv-halo dc-cv-halo--selected'
    : 'dc-cv-halo dc-cv-halo--selected-member';
  child.setAttribute('aria-hidden', 'true');
  if (withTicks) {
    for (const cls of TICK_CLASSES) {
      const tick = document.createElement('i');
      tick.className = `tick ${cls}`;
      child.appendChild(tick);
    }
  }
  return child;
}

function SelectionHalos() {
  const { selected } = useSelectionSet();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (selected.length === 0) {
      const c = containerRef.current;
      if (c) c.innerHTML = '';
      return;
    }
    const tick = () => {
      rafRef.current = null;
      const c = containerRef.current;
      if (!c) return;
      const wantsTicks = selected.length === 1;
      const wantClass = wantsTicks
        ? 'dc-cv-halo dc-cv-halo--selected'
        : 'dc-cv-halo dc-cv-halo--selected-member';
      // Match rendered halo count to selected.length; reuse DOM nodes.
      while (c.children.length < selected.length) {
        c.appendChild(makeSelectedNode(wantsTicks));
      }
      while (c.children.length > selected.length) {
        c.removeChild(c.lastChild as Node);
      }
      // When selection size crosses 1↔N+, swap class + tick children on each
      // existing node so reused nodes adopt the new visual idiom.
      for (let i = 0; i < c.children.length; i++) {
        const child = c.children[i] as HTMLDivElement;
        if (child.className !== wantClass) {
          child.className = wantClass;
          // Strip any existing ticks, then re-append if needed.
          while (child.firstChild) child.removeChild(child.firstChild);
          if (wantsTicks) {
            for (const cls of TICK_CLASSES) {
              const t = document.createElement('i');
              t.className = `tick ${cls}`;
              child.appendChild(t);
            }
          }
        }
      }
      for (let i = 0; i < selected.length; i++) {
        const sel = selected[i];
        const child = c.children[i] as HTMLDivElement;
        const el = sel?.id
          ? document.querySelector(`[data-cd-id="${cssEscape(sel.id)}"]`)
          : sel
            ? safeQuery(sel.selector)
            : null;
        if (!el) {
          child.style.display = 'none';
          continue;
        }
        // Post-Wave-2: artboard drag is now direct (article updates its own
        // `left/top` in real-time), so the halo can follow via
        // getBoundingClientRect — no special drag suppression needed.
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          child.style.display = 'none';
        } else {
          child.style.display = 'block';
          child.style.left = `${Math.round(r.left)}px`;
          child.style.top = `${Math.round(r.top)}px`;
          child.style.width = `${Math.round(r.width)}px`;
          child.style.height = `${Math.round(r.height)}px`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [selected]);

  return <div ref={containerRef} aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupBbox — dashed outline around the union of selected elements when N > 1.

function GroupBbox() {
  const { selected } = useSelectionSet();
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (selected.length < 2) {
      if (ref.current) ref.current.style.display = 'none';
      return;
    }
    const tick = () => {
      rafRef.current = null;
      const div = ref.current;
      if (!div) return;
      let xMin = Number.POSITIVE_INFINITY;
      let yMin = Number.POSITIVE_INFINITY;
      let xMax = Number.NEGATIVE_INFINITY;
      let yMax = Number.NEGATIVE_INFINITY;
      let anyHit = false;
      for (const sel of selected) {
        const el = sel.id
          ? document.querySelector(`[data-cd-id="${cssEscape(sel.id)}"]`)
          : safeQuery(sel.selector);
        if (!el) continue;
        // Post-Wave-2: direct artboard drag — the article updates its own
        // `left/top` during drag, so the group bbox just follows via
        // getBoundingClientRect with no special-casing.
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        anyHit = true;
        if (r.left < xMin) xMin = r.left;
        if (r.top < yMin) yMin = r.top;
        if (r.right > xMax) xMax = r.right;
        if (r.bottom > yMax) yMax = r.bottom;
      }
      if (!anyHit) {
        div.style.display = 'none';
        return;
      }
      const pad = 4;
      div.style.display = 'block';
      div.style.left = `${Math.round(xMin - pad)}px`;
      div.style.top = `${Math.round(yMin - pad)}px`;
      div.style.width = `${Math.round(xMax - xMin + pad * 2)}px`;
      div.style.height = `${Math.round(yMax - yMin + pad * 2)}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [selected]);

  if (selected.length < 2) return null;
  return (
    <div ref={ref} className="dc-cv-group-bbox" aria-hidden="true">
      {TICK_CLASSES.map((cls) => (
        <i key={cls} className={`tick ${cls}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function classifyContextKind(target: HoverTarget | null): ContextTargetKind {
  if (!target) return 'world';
  const el = target.el;
  if (!el) return 'world';
  if (el.closest?.('.dc-mm, .dc-zoom-tb, .dc-tool-palette, .dc-context-menu')) {
    return 'overlay';
  }
  if (target.cdId) return 'element';
  if (target.artboardId) return 'artboard-chrome';
  return 'world';
}

function hoverTargetToSelection(target: HoverTarget): Selection {
  const el = target.el;
  const rect =
    el && (el as HTMLElement).getBoundingClientRect
      ? (el as HTMLElement).getBoundingClientRect()
      : null;
  // `cdId` is the hit element's OWN data-cd-id (deep mode); resolver never
  // climbs to an ancestor. Falls back to cssPath of the hit when no stable
  // anchor exists.
  const cdId = target.cdId;
  // Selector resolution order:
  //   1. data-cd-id anchor — stable pipeline-stamped id (preferred).
  //   2. data-dc-screen — chrome click promoted to whole-artboard select
  //      (T24.5 G8 multi-artboard gesture).
  //   3. cssPath of the hit — last-resort path string.
  const selector = cdId
    ? `[data-cd-id="${cdId}"]`
    : !cdId && target.artboardId
      ? `[data-dc-screen="${target.artboardId}"]`
      : cssPath(el);
  return {
    file: typeof window !== 'undefined' ? deriveFile() : undefined,
    id: cdId ?? undefined,
    selector,
    artboardId: target.artboardId,
    tag: el?.tagName.toLowerCase() ?? '',
    classes: realClasses(el),
    text: shortText(el, 240),
    dom_path: domPath(el),
    bounds: rect
      ? {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        }
      : null,
    html: el ? (el.outerHTML ?? '').slice(0, 4000) : '',
  };
}

function deriveFile(): string | undefined {
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

function realClasses(el: Element | null): string {
  if (!el) return '';
  return (el.getAttribute('class') ?? '')
    .trim()
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('dgn-') && !c.startsWith('dc-cv-'))
    .join(' ');
}

function shortText(el: Element | null, max: number): string {
  if (!el) return '';
  const t = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function cssPath(el: Element | null): string {
  if (!el) return '';
  const path: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && path.length < 8) {
    const dscEl = cur.getAttribute?.('data-dc-element');
    if (dscEl) {
      path.unshift(`[data-dc-element="${dscEl}"]`);
      break;
    }
    const dscSc = cur.getAttribute?.('data-dc-screen');
    if (dscSc) {
      path.unshift(`[data-dc-screen="${dscSc}"]`);
      break;
    }
    let sel = cur.nodeName.toLowerCase();
    if (cur.id) {
      sel = `#${cur.id}`;
      path.unshift(sel);
      break;
    }
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) sel += `.${cls.join('.')}`;
    let sib = 1;
    let n: Element | null = cur.previousElementSibling;
    while (n) {
      sib++;
      n = n.previousElementSibling;
    }
    sel += `:nth-child(${sib})`;
    path.unshift(sel);
    cur = cur.parentElement;
  }
  return path.join(' > ');
}

function domPath(el: Element | null): string[] {
  const hops: string[] = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && hops.length < 8) {
    let label = cur.nodeName.toLowerCase();
    const dEl = cur.getAttribute?.('data-dc-element');
    const dSc = cur.getAttribute?.('data-dc-screen');
    if (dEl) label += `[data-dc-element="${dEl}"]`;
    else if (dSc) label += `[data-dc-screen="${dSc}"]`;
    else if (cur.id) label += `#${cur.id}`;
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length && !dEl && !dSc) label += `.${cls.join('.')}`;
    hops.unshift(label);
    cur = cur.parentElement;
  }
  return hops;
}

function cssEscape(s: string): string {
  // Minimal CSS.escape polyfill — only handles chars actually present in
  // pipeline-stamped IDs (alphanumerics + `-` + `_`).
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function safeQuery(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
