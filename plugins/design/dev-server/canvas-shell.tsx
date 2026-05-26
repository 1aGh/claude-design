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
import {
  SnapGuideOverlay,
  type ViewportControllerHandle,
  useViewportControllerContext,
} from './canvas-lib.tsx';
import { CommentsOverlay } from './comments-overlay.tsx';
import {
  ContextMenuProvider,
  type ContextRegistry,
  type ContextTarget,
  type ContextTargetKind,
  type MenuItem,
  useContextMenu,
} from './context-menu.tsx';
import { ExportDialogProvider } from './export-dialog.tsx';
import { type HoverTarget, resolveHoverTarget, useInputRouter } from './input-router.tsx';
import { ToolPalette } from './tool-palette.tsx';
import {
  AnnotationSelectionProvider,
  useAnnotationSelection,
} from './use-annotation-selection.tsx';
import { AnnotationsVisibilityProvider } from './use-annotations-visibility.tsx';
import { type Selection, SelectionSetProvider, useSelectionSet } from './use-selection-set.tsx';
import { useToolMode } from './use-tool-mode.tsx';

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
/* Selected (member of multi-selection) — 1px solid 50%-tinted outline.
   No ring, no ticks. The GroupBbox carries the loud signal. */
.dc-cv-halo--selected-member {
  border: 1px solid color-mix(in oklab, var(--accent, #0d99ff) 50%, transparent);
}
/* Group bbox — 1px solid (NOT dashed; dashed reserved for none — DDR-046).
   50%-tinted accent so it reads as scaffolding rather than chrome. */
.dc-cv-group-bbox {
  position: fixed;
  pointer-events: none;
  z-index: 5;
  border: 1px solid color-mix(in oklab, var(--accent, #0d99ff) 50%, transparent);
  border-radius: 2px;
}
/*
 * Active-artboard indicator — the artboard whose center sits closest to the
 * viewport midpoint after pan settles is "active" (DesignCanvas tracks this
 * for keyboard jumps + the /design:edit context anchor). DDR-046 — ring sits
 * OUTSIDE the hard drop-shadow so it's visible at any pan distance / zoom.
 * 120 ms ease-out so activation is felt, not invisible.
 */
.dc-canvas .dc-artboard[aria-current="true"] {
  box-shadow:
    0 0 0 3px var(--accent, #0d99ff),
    6px 6px 0 var(--fg-0, #2a2520);
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
/* DDR-046 — Brand wordmark watermark. Subtle top-left mark that gives the
   canvas a "this is maude-design-server" identity without competing with
   user content. Position absolute inside .dc-canvas so it stays anchored to
   the viewport corner (NOT inside .dc-world — wouldn't make sense per
   canvas). Pointer-events:none so it never intercepts clicks. Opacity fades
   when artboards exist (user content takes the focus). */
.dc-canvas-brand {
  position: absolute;
  top: 20px;
  left: 28px;
  pointer-events: none;
  user-select: none;
  z-index: 4;
  font-family: var(--font-display, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace));
  color: var(--fg-0, #1c1917);
  opacity: 0.18;
  transition: opacity 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dc-canvas-brand .dc-canvas-brand-mark {
  display: block;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}
.dc-canvas-brand .dc-canvas-brand-sub {
  margin-top: 8px;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-1, var(--fg-0, #1c1917));
  opacity: 0.85;
}
/* Empty state — pop a bit louder when there's no user content competing. */
.dc-canvas:not(:has(.dc-artboard)) .dc-canvas-brand { opacity: 0.45; }
@media (prefers-reduced-motion: reduce) {
  .dc-canvas-brand { transition: none !important; }
}
/*
 * Force tool cursor across the canvas tree in comment / hand modes. Without
 * !important on every descendant, buttons and links with their own cursor
 * declaration would flip the cursor away from the tool affordance the moment
 * the user hovers an interactive element — wrong signal when native
 * interactions are suppressed by the router anyway.
 */
.dc-canvas[data-active-tool="comment"],
.dc-canvas[data-active-tool="comment"] *,
.dc-canvas[data-active-tool="pen"],
.dc-canvas[data-active-tool="pen"] *,
.dc-canvas[data-active-tool="rect"],
.dc-canvas[data-active-tool="rect"] *,
.dc-canvas[data-active-tool="ellipse"],
.dc-canvas[data-active-tool="ellipse"] *,
.dc-canvas[data-active-tool="arrow"],
.dc-canvas[data-active-tool="arrow"] * {
  cursor: crosshair !important;
}
.dc-canvas[data-active-tool="hand"],
.dc-canvas[data-active-tool="hand"] * {
  cursor: grab !important;
}
.dc-canvas[data-active-tool="eraser"],
.dc-canvas[data-active-tool="eraser"] * {
  cursor: cell !important;
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

  const registry = useMemo<ContextRegistry>(
    () => buildRegistry({ controller, clearSelection: selSet.clear }),
    [controller, selSet.clear]
  );

  return (
    <ExportDialogProvider>
      <ContextMenuProvider registry={registry}>
        <CanvasRouter hostRef={hostRef}>{children}</CanvasRouter>
      </ContextMenuProvider>
    </ExportDialogProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry builder — closes over controller + clear callback.

function buildRegistry(deps: {
  controller: ViewportControllerHandle | null;
  clearSelection: () => void;
}): ContextRegistry {
  const { controller, clearSelection } = deps;

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
            if (!controller || !target.artboardId) return;
            // controller exposes jumpTo(rect) — DCArtboard.onFocus uses the
            // same pattern. The artboard label button already wires to
            // onFocus; dispatch a synthetic click as the simplest bridge.
            const btn = (target.el ?? document)
              .closest?.('[data-dc-screen]')
              ?.querySelector('button.dc-artboard-label');
            (btn as HTMLButtonElement | null)?.click();
          },
        },
        fitItem,
        resetItem,
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
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const { tool, setTool } = useToolMode();
  const selSet = useSelectionSet();
  const annotSel = useAnnotationSelection();
  const ctxMenu = useContextMenu();

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
          // Cmd-click on dead space (canvas chrome, label strip, empty world):
          // clear for `replace`, leave the set alone for `add`.
          if (mode === 'replace') selSet.clear();
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
      onEscape: () => {
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
      <BrandWordmark />
      <CommentsOverlay />
      <AnnotationsLayer />
      <ToolPalette />
      <HoverHalo el={hoverEl} />
      <SelectionHalos />
      <GroupBbox />
      <SnapGuideOverlay />
    </>
  );
}

// DDR-046 — Subtle top-left brand watermark. Reads file from window.location
// to derive the canvas slug for the sub-line. Renders inside the canvas iframe,
// pointer-events:none, never competes with user content.
function BrandWordmark() {
  const sub = useMemo(() => {
    if (typeof window === 'undefined') return 'CANVAS';
    try {
      const file = deriveFile() ?? '';
      const name = file.split('/').pop()?.replace(/\.(tsx|html?|jsx)$/i, '') ?? '';
      return name ? `CANVAS · ${name}` : 'CANVAS';
    } catch {
      return 'CANVAS';
    }
  }, []);
  return (
    <div className="dc-canvas-brand" aria-hidden="true">
      <span className="dc-canvas-brand-mark">maude</span>
      <div className="dc-canvas-brand-sub">{sub}</div>
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
  return <div ref={ref} className="dc-cv-group-bbox" aria-hidden="true" />;
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
  return {
    file: typeof window !== 'undefined' ? deriveFile() : undefined,
    id: cdId ?? undefined,
    selector: cdId ? `[data-cd-id="${cdId}"]` : cssPath(el),
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
