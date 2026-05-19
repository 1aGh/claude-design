/**
 * @file       canvas-lib.tsx — dev-server-bundled canvas library
 * @scope      plugins/design/dev-server/canvas-lib.tsx
 *             Ships with the dev-server install; resolved at canvas build time
 *             via the `@mdcc/canvas-lib` virtual specifier. Per DDR-025, this
 *             is the single source of truth — no project-side copy.
 * @purpose    Shared primitives + helpers + hooks for every TSX canvas
 *             (UI mocks + DS specimens). Imported via the virtual module
 *             specifier `@mdcc/canvas-lib`, which the dev-server's Bun.build
 *             resolver maps to this file. On /design:handoff the used exports
 *             are AST-inlined into the emitted registry-item so the consumer
 *             never sees the `@mdcc/canvas-lib` specifier.
 *
 * Exports (cold-reader cheat sheet):
 *
 *   Frame envelope ─────────────────────────────────────────────────────────
 *   DesignCanvas       Root wrapper. <div class="dc-canvas"> holding a
 *                      transformable <div class="dc-world"> world plane.
 *                      DCArtboard children inside the world are absolutely
 *                      positioned in world coords; pan/zoom (Phase 4 T2)
 *                      applies a single transform to the world plane.
 *   DCSection          Group label. Inside DesignCanvas it collapses to a
 *                      transparent wrapper (DCArtboard children take their
 *                      own world coords); standalone it keeps the legacy
 *                      <section>/<header><h2> chrome for specimens.
 *   DCArtboard         Bordered artboard with SKU strip header. Inside
 *                      DesignCanvas it absolutely-positions itself in world
 *                      coords resolved from meta.layout (or default grid).
 *                      Standalone it renders a fixed-size block at its given
 *                      width/height (specimens / legacy uses).
 *   DCPostIt           <aside class="dc-postit"> — sticky-note annotation.
 *
 *   Specimen helpers ───────────────────────────────────────────────────────
 *   SpecimenHeader     The .specimen-hd row (sku + crumbs + ThemeToggle).
 *   SpecimenMeta       <dl class="specimen-meta"> ladder from entries[].
 *   KbdHint            <kbd> chrome.
 *   TokenChip          Inline visualiser for a var(--*) value.
 *   ColorSwatch        Square + label for a color token.
 *   TypeScaleRow       One row of a type-ladder specimen.
 *   ThemeToggle        Light/dark <button> group writing data-theme on <html>.
 *
 *   Hooks ──────────────────────────────────────────────────────────────────
 *   useTokens(prefix?) Resolves CSS custom properties from <html> computed style.
 *   useTheme()         Current theme + setter, syncs to <html data-theme>.
 *   useArtboardBounds(ref) ResizeObserver wrapper returning {width,height}.
 *
 * Authoring vocabulary. Lift these before re-implementing equivalents. The
 * surface intentionally mirrors the .html-era specimen idioms one-for-one
 * (`.specimen-hd`, `.specimen-meta`, `.sku`, `.swatch`, `.stamp`) so existing
 * `_components.css` rules still target them.
 *
 * data-cd-id IDs are injected by canvas-pipeline.ts pass 1 — including on the
 * primitives below. That's fine; pipeline IDs change every time the lib
 * changes. Don't pin lib-internal IDs in tests.
 *
 * Phase 4 (2026-05-19) — DesignCanvas became a transformable world plane.
 * The engine is always on; a single-artboard canvas just defaults to
 * fit-to-screen and looks identical to pre-Phase 4. Layout + viewport state
 * live in `<file>.meta.json` via `window.__canvas_meta__` (T5 wiring).
 *
 * Phase 4.0.5 (2026-05-19) — relocated from `<designRoot>/_lib/canvas-lib.tsx`
 * per DDR-025; single source in dev-server. No project-side copy is scaffolded
 * anymore; legacy `_lib/` directories in downstream projects get a one-cycle
 * deprecation log at dev-server boot.
 */

import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Module constants

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4.0;
const ZOOM_STEP_IN = 1.2;
const ZOOM_STEP_OUT = 1 / 1.2;
const WHEEL_ZOOM_K = 0.0015; // larger = more sensitive wheel
const SETTLE_MS = 500;
const PUBLISH_MS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Engine CSS (Phase 4) — injected once per iframe inside DesignCanvas's mount.
// The visual chrome of `.dc-artboard` (borders, label strip, SKU type) still
// lives in the DS's _components.css. Engine CSS ONLY covers positioning + the
// world transform. Idempotent via the `dc-engine-css` id check.

const ENGINE_CSS = `
.dc-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  outline: none;
  background-color: var(--bg-1, #f4f1ea);
  background-image:
    linear-gradient(var(--border-subtle, rgba(0,0,0,0.08)) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle, rgba(0,0,0,0.08)) 1px, transparent 1px);
  background-size: 24px 24px;
}
.dc-canvas:focus { outline: none; }
.dc-world {
  position: absolute;
  top: 0;
  left: 0;
  /* CSS zoom drives the scale; transform handles pan. transform-origin is
     irrelevant under zoom (zoom anchors top-left of the box). will-change
     hints to the compositor that this layer changes often. */
  will-change: transform;
}
.dc-section-collapsed { display: contents; }

.dc-canvas .dc-artboard {
  background: var(--bg-0, #ffffff);
  color: var(--fg-0, #2a2520);
  border: 1px solid var(--fg-0, #2a2520);
  box-shadow: 6px 6px 0 var(--fg-0, #2a2520);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dc-canvas .dc-artboard.dc-positioned { position: absolute; }
.dc-canvas .dc-artboard-label {
  flex-shrink: 0;
  background: var(--bg-2, #e8e3d8);
  border-bottom: 1px solid var(--fg-0, #2a2520);
  padding: 6px 14px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-1, #4a3f30);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.dc-canvas .dc-artboard-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}
button.dc-artboard-label {
  appearance: none;
  border-width: 0 0 1px 0;
  font: inherit;
  cursor: pointer;
  text-align: left;
  display: block;
  width: 100%;
}
button.dc-artboard-label:focus-visible { outline: 2px solid var(--accent, #d63b1f); outline-offset: -2px; }
.dc-canvas .dc-artboard[aria-current="true"] { box-shadow: 6px 6px 0 var(--fg-0, #2a2520), 0 0 0 2px var(--accent, #d63b1f); }
`.trim();

function ensureEngineStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("dc-engine-css")) return;
  const s = document.createElement("style");
  s.id = "dc-engine-css";
  s.textContent = ENGINE_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// World context — published by DesignCanvas. Consumed by DCArtboard (for
// world-coord positioning) and by DCSection (which collapses inside the
// canvas) and by future T3 components (MiniMap, ZoomToolbar).

export interface ArtboardRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface WorldContextValue {
  /** Look up a DCArtboard's world-coord rect by its `id` prop. */
  rectFor: (id: string) => ArtboardRect | null;
  /** All artboards in render order, with resolved world-coord positions. */
  artboards: ArtboardRect[];
  /** Current pan/zoom state. `null` until the first useLayoutEffect runs. */
  viewport: ViewportState | null;
  /** id of the artboard closest to the viewport center (recomputed on settle). */
  activeArtboardId: string | null;
  /** The fixed-bleed `.dc-canvas` host (visible iframe area). */
  hostRef: RefObject<HTMLDivElement | null>;
  /** The transformable `.dc-world` element. */
  worldRef: RefObject<HTMLDivElement | null>;
}

const WorldContext = createContext<WorldContextValue | null>(null);

function useWorldContext(): WorldContextValue | null {
  return useContext(WorldContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout synthesis. Default grid + fit-to-screen compute. Phase 4 T2 will
// replace the "always re-fit on resize" useLayoutEffect with the
// useViewportController hook; for T1 we hold the world at fit-to-screen
// (or at meta.viewport if seeded) and don't yet expose pan/zoom inputs.

const VP_GRID = { cols: 3, w: 1280, h: 820, gutter: 80 } as const;

interface ArtboardSeed {
  id: string;
  w: number;
  h: number;
}

/**
 * Walk a children subtree harvesting DCArtboard descriptors in render order.
 * DCSection (and any other wrapper) is traversed but doesn't appear in the
 * harvest. Identity-matches against the DCArtboard reference so renamed
 * imports don't trip it; falls back to displayName for minified builds.
 */
function harvestArtboards(children: ReactNode): ArtboardSeed[] {
  const out: ArtboardSeed[] = [];
  let auto = 0;
  function visit(node: ReactNode): void {
    if (node == null || typeof node === "boolean") return;
    if (Array.isArray(node)) {
      for (const c of node) visit(c);
      return;
    }
    if (!isValidElement(node)) return;
    const type = node.type;
    const isArtboard =
      type === DCArtboard ||
      (typeof type === "function" &&
        (type as { displayName?: string }).displayName === "DCArtboard");
    if (isArtboard) {
      const props = node.props as { id?: string; width?: number; height?: number };
      out.push({
        id: typeof props.id === "string" && props.id.length > 0 ? props.id : `__ab_${auto}`,
        w: typeof props.width === "number" ? props.width : VP_GRID.w,
        h: typeof props.height === "number" ? props.height : VP_GRID.h,
      });
      auto++;
      return;
    }
    const childProp = (node.props as { children?: ReactNode } | null | undefined)?.children;
    if (childProp != null) visit(childProp);
  }
  visit(children);
  return out;
}

function synthDefaultGrid(seeds: ArtboardSeed[]): ArtboardRect[] {
  // Render order (the order DCArtboards appear in JSX), not alphabetical —
  // authors label artboards DS-01 / DS-02 / CV-01 etc. and expect that
  // numeric order to show top-left → bottom-right, but their ids are usually
  // semantic (`landing`, `docs-article`, `cmd-k`, `about`) which would
  // shuffle the numeric order.
  // Column / row size come from the largest artboard so canvases with mixed
  // dimensions (width=1440 on Docs Site, width=1280 elsewhere) don't bleed
  // past a 1280-step grid.
  if (seeds.length === 0) return [];
  const cellW = seeds.reduce((m, s) => Math.max(m, s.w), 0) || VP_GRID.w;
  const cellH = seeds.reduce((m, s) => Math.max(m, s.h), 0) || VP_GRID.h;
  return seeds.map((seed, i) => {
    const col = i % VP_GRID.cols;
    const row = Math.floor(i / VP_GRID.cols);
    return {
      id: seed.id,
      x: col * (cellW + VP_GRID.gutter),
      y: row * (cellH + VP_GRID.gutter),
      w: seed.w,
      h: seed.h,
    };
  });
}

function computeFit(
  rects: ArtboardRect[],
  hostEl: HTMLElement,
  pad = 24
): ViewportState {
  if (rects.length === 0) return { x: 0, y: 0, zoom: 1 };
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.x < xMin) xMin = r.x;
    if (r.y < yMin) yMin = r.y;
    if (r.x + r.w > xMax) xMax = r.x + r.w;
    if (r.y + r.h > yMax) yMax = r.y + r.h;
  }
  const bw = xMax - xMin;
  const bh = yMax - yMin;
  const vw = hostEl.clientWidth;
  const vh = hostEl.clientHeight;
  if (!vw || !vh || bw <= 0 || bh <= 0) return { x: 0, y: 0, zoom: 1 };
  const zoom = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh, 1.0);
  const x = (vw - bw * zoom) / 2 - xMin * zoom;
  const y = (vh - bh * zoom) / 2 - yMin * zoom;
  return { x, y, zoom };
}

/**
 * Read the canvas-meta sidecar that the dev-server's `_shell.html` injects
 * on `window.__canvas_meta__` (Phase 4 T5). Returns undefined if the canvas
 * is mounted outside the shell (specimens / unit tests).
 */
function readCanvasMeta(): {
  layout?: { artboards?: ArtboardRect[] };
  viewport?: ViewportState;
} | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    __canvas_meta__?: {
      layout?: { artboards?: ArtboardRect[] };
      viewport?: ViewportState;
    };
  };
  return w.__canvas_meta__;
}

/**
 * Returns the repo-relative path the shell stashed alongside the meta so
 * onSettle PATCHes know which sidecar to write back to.
 */
function readCanvasMetaFile(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __canvas_meta_file__?: string };
  return typeof w.__canvas_meta_file__ === "string" ? w.__canvas_meta_file__ : null;
}

/**
 * PATCH the canvas-meta sidecar with `{ viewport }` or `{ layout }`. Best-effort
 * fire-and-forget — failures are logged but don't disrupt the canvas.
 */
function patchCanvasMeta(patch: { viewport?: ViewportState; layout?: { artboards: ArtboardRect[] } }): void {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  const file = readCanvasMetaFile();
  if (!file) return;
  fetch("/_api/canvas-meta", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file, patch }),
  }).catch((err) => {
    console.warn("[canvas-lib] persist viewport failed:", err);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useViewportController (Phase 4 T2)
//
// Owns the canvas's pan/zoom/pinch/spacebar-drag/middle-mouse-drag/Cmd shortcuts.
// Scoped to the canvas iframe via hostRef — no shell-level keyboard leaks.
// While the user is actively gesturing, the hook writes the world transform
// straight to `worldRef.current.style.transform` for a 60 fps path; React state
// publishes on a 50 ms throttle so MiniMap + ZoomToolbar consumers re-render
// at a comfortable cadence. `onSettle` fires 500 ms after the last input so
// T5 can persist the viewport without flooding writes during a drag.

export interface ViewportControllerOptions {
  hostRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  /** Computes a fit-to-screen viewport for the current artboard set. */
  computeFit: () => ViewportState;
  /**
   * Initial viewport. Read once at mount. Return `null` to defer until the
   * host has a measured size (the hook will re-init on the first ResizeObserver
   * tick that produces a non-zero host).
   */
  getInitial: () => ViewportState | null;
  /** Called debounced ~500 ms after the last input. */
  onSettle?: (v: ViewportState) => void;
  /**
   * Jump-target rects (in world coords) for Cmd+Option+1..9. The N-th entry
   * fits that rect inside the host. Provided by DesignCanvas which has the
   * artboard list. Optional — keyboard jumps no-op when omitted.
   */
  jumpTargets?: ArtboardRect[];
}

export interface ViewportControllerHandle {
  /** Current viewport state. Throttled — for tight render loops use the ref. */
  viewport: ViewportState;
  /** Snap to an arbitrary viewport (used by MiniMap drag, T3). */
  setViewport: (v: ViewportState) => void;
  /** Pan by (dx, dy) screen px. */
  panBy: (dx: number, dy: number) => void;
  /** Multiply zoom by factor, preserving (cx, cy) screen px under the cursor. */
  zoomAt: (factor: number, cx: number, cy: number) => void;
  /** Cmd+0 — fit-to-screen on the artboard union. */
  fit: () => void;
  /** Cmd+1 — actual size (zoom = 1.0), recentered on viewport midpoint. */
  reset: () => void;
  /** Cmd+= — zoom in 1.2× at host center. */
  zoomIn: () => void;
  /** Cmd+- — zoom out at host center. */
  zoomOut: () => void;
  /** Jump to the rect at `index` with smooth fit (used by T4 click-to-focus). */
  jumpTo: (rect: ArtboardRect) => void;
  /** Animate to a target viewport over `durationMs` (reduced-motion = instant). */
  animateTo: (target: ViewportState, durationMs?: number) => void;
  /** True while the user is actively gesturing (drag / wheel run). */
  isInteracting: boolean;
}

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function fitRectIntoHost(rect: ArtboardRect, hostEl: HTMLElement, pad = 24): ViewportState {
  return computeFit([rect], hostEl, pad);
}

export function useViewportController(
  opts: ViewportControllerOptions
): ViewportControllerHandle {
  const { hostRef, worldRef, computeFit: computeFitFn, getInitial, onSettle, jumpTargets } = opts;

  // Canonical viewport in a ref — synchronous, drives the world transform.
  const vpRef = useRef<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const [viewport, setViewportPublished] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const [isInteracting, setIsInteracting] = useState(false);
  const interactingRef = useRef(false);
  const isInteractingStateRef = useRef(false);

  // Throttle / settle timers.
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs to options that may change between renders.
  const computeFitRef = useRef(computeFitFn);
  computeFitRef.current = computeFitFn;
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const jumpTargetsRef = useRef(jumpTargets);
  jumpTargetsRef.current = jumpTargets;

  // worldRef is stable across renders — read inside callbacks lazily, no dep.
  // Use CSS `zoom` (not `transform: scale`) for the scale dimension. `zoom`
  // re-flows layout at the new size so the browser re-rasterizes text at the
  // target resolution — text stays crisp at any zoom level. `transform: scale`
  // upscales a cached layer, which produces the pixelation users see at
  // zoom > ~1.5. CSS `zoom` is supported in Chrome / Safari / Edge (always)
  // and Firefox 126+; for a dev-server design tool that's full coverage.
  //
  // ! Subtle: CSS `zoom: N` makes `transform: translate(Xpx, Ypx)` translate by
  // ! N×X / N×Y screen pixels (translate is in the *pre-zoom* coord space, then
  // ! the whole layer is zoomed). Our controller's `vpRef` holds the translate
  // ! in *screen* pixels (the same convention as `transform: scale(N)
  // ! translate(...)` had), so we divide by zoom at write time to convert into
  // ! the CSS-zoom world. The data model stays simple and pan/zoom math (in
  // ! particular zoom-around-cursor) keeps using screen-px throughout.
  const writeTransform = useCallback((v: ViewportState) => {
    const el = worldRef.current;
    if (!el) return;
    const z = v.zoom || 1;
    el.style.transform = `translate(${v.x / z}px, ${v.y / z}px)`;
    el.style.zoom = String(z);
    el.style.visibility = "visible";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulePublish = useCallback(() => {
    if (publishTimerRef.current != null) return;
    publishTimerRef.current = setTimeout(() => {
      publishTimerRef.current = null;
      setViewportPublished({ ...vpRef.current });
    }, PUBLISH_MS);
  }, []);

  const scheduleSettle = useCallback(() => {
    if (settleTimerRef.current != null) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      const cb = onSettleRef.current;
      if (cb) cb({ ...vpRef.current });
    }, SETTLE_MS);
  }, []);

  // Read the interacting flag from a ref so this callback identity stays
  // stable across renders — otherwise applyViewport (and the listeners that
  // close over it) get torn down on every state update, eating mid-gesture
  // pointer events.
  const markInteracting = useCallback(() => {
    interactingRef.current = true;
    if (!isInteractingStateRef.current) {
      isInteractingStateRef.current = true;
      setIsInteracting(true);
    }
    if (interactEndTimerRef.current != null) clearTimeout(interactEndTimerRef.current);
    interactEndTimerRef.current = setTimeout(() => {
      interactingRef.current = false;
      isInteractingStateRef.current = false;
      setIsInteracting(false);
      interactEndTimerRef.current = null;
    }, 220);
  }, []);

  const applyViewport = useCallback((next: ViewportState) => {
    const clamped: ViewportState = {
      x: Number.isFinite(next.x) ? next.x : 0,
      y: Number.isFinite(next.y) ? next.y : 0,
      zoom: clampZoom(next.zoom),
    };
    vpRef.current = clamped;
    writeTransform(clamped);
    schedulePublish();
    scheduleSettle();
    markInteracting();
  }, [writeTransform, schedulePublish, scheduleSettle, markInteracting]);

  // Imperative API ------------------------------------------------------------

  const setViewport = useCallback((v: ViewportState) => applyViewport(v), [applyViewport]);

  const panBy = useCallback((dx: number, dy: number) => {
    const v = vpRef.current;
    applyViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom });
  }, [applyViewport]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    const v = vpRef.current;
    const newZoom = clampZoom(v.zoom * factor);
    // World coord under (cx, cy) before the zoom change.
    const wx = (cx - v.x) / v.zoom;
    const wy = (cy - v.y) / v.zoom;
    const next: ViewportState = {
      x: cx - wx * newZoom,
      y: cy - wy * newZoom,
      zoom: newZoom,
    };
    applyViewport(next);
  }, [applyViewport]);

  const fit = useCallback(() => {
    const next = computeFitRef.current();
    applyViewport(next);
  }, [applyViewport]);

  const reset = useCallback(() => {
    const host = hostRef.current;
    if (!host) {
      applyViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const cx = host.clientWidth / 2;
    const cy = host.clientHeight / 2;
    zoomAt(1 / vpRef.current.zoom, cx, cy);
  }, [hostRef, applyViewport, zoomAt]);

  const zoomIn = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    zoomAt(ZOOM_STEP_IN, host.clientWidth / 2, host.clientHeight / 2);
  }, [hostRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    zoomAt(ZOOM_STEP_OUT, host.clientWidth / 2, host.clientHeight / 2);
  }, [hostRef, zoomAt]);

  // Animation — rAF-driven ease-out cubic, falls through to apply on each
  // frame so MiniMap / ZoomToolbar follow the trajectory live.
  const animationRef = useRef<number | null>(null);

  const animateTo = useCallback(
    (target: ViewportState, durationMs = 240) => {
      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      const dur = prefersReducedMotion() ? 0 : Math.max(0, durationMs);
      if (dur === 0) {
        applyViewport(target);
        return;
      }
      const start: ViewportState = { ...vpRef.current };
      const t0 =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = 1 - (1 - t) ** 3; // ease-out cubic
        applyViewport({
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          zoom: clampZoom(start.zoom + (target.zoom - start.zoom) * e),
        });
        if (t < 1) {
          animationRef.current = requestAnimationFrame(tick);
        } else {
          animationRef.current = null;
        }
      };
      animationRef.current = requestAnimationFrame(tick);
    },
    [applyViewport]
  );

  const jumpTo = useCallback(
    (rect: ArtboardRect) => {
      const host = hostRef.current;
      if (!host) return;
      animateTo(fitRectIntoHost(rect, host));
    },
    [hostRef, animateTo]
  );

  // Mount / event wiring ------------------------------------------------------

  // Initial viewport.
  useLayoutEffect(() => {
    const initial = getInitial();
    if (initial) {
      vpRef.current = { ...initial };
      writeTransform(vpRef.current);
      setViewportPublished({ ...vpRef.current });
    }
    // If host has no size yet, refit when ResizeObserver delivers one.
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let hadSize = host.clientWidth > 0 && host.clientHeight > 0;
    const ro = new ResizeObserver(() => {
      if (interactingRef.current) return; // never re-fit during a gesture
      if (!hadSize && host.clientWidth > 0 && host.clientHeight > 0) {
        hadSize = true;
        const refit = computeFitRef.current();
        vpRef.current = { ...refit };
        writeTransform(vpRef.current);
        setViewportPublished({ ...vpRef.current });
      }
    });
    ro.observe(host);
    return () => ro.disconnect();
    // intentionally one-shot — caller drives re-fit via the `fit()` handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer + wheel + key listeners — all scoped to hostRef so the shell
  // keyboard and other iframes stay quiet.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Auto-focus on pointer enter — without this, keyboard shortcuts (Space
    // for pan, Cmd+0/1/+/-) silently fail until the user clicks inside the
    // iframe. Focusing the host element pulls keyboard focus into this
    // iframe's contentWindow so the window-scoped keydown listener below
    // receives events natively.
    const onPointerEnter = () => {
      try {
        if (typeof window !== "undefined" && document.activeElement !== host) {
          host.focus({ preventScroll: true });
        }
      } catch {
        /* ignore */
      }
    };

    const spaceHeld = { current: false };
    const panState: {
      active: boolean;
      pointerId: number;
      lastX: number;
      lastY: number;
    } = { active: false, pointerId: -1, lastX: 0, lastY: 0 };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Mac trackpad pinch fires wheel with ctrlKey:true automatically, even
      // without a physical Ctrl press — so the same branch covers both
      // Ctrl+wheel (mouse) and pinch-zoom (trackpad).
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_K);
        zoomAt(factor, cx, cy);
        return;
      }
      // Shift+wheel → horizontal pan. Some browsers / OSes auto-swap
      // deltaX↔deltaY when shift is held (Chromium on Linux does, macOS
      // doesn't, Safari sometimes does); some don't. Read whichever axis
      // actually carries energy so the gesture lands horizontally either way.
      if (e.shiftKey) {
        const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        panBy(-d, 0);
        return;
      }
      // Default: trackpad two-finger scroll → 2D pan. The negation keeps the
      // "content follows your fingers" mapping (Mac natural scroll). Mouse
      // wheels with only deltaY pan vertically.
      panBy(-e.deltaX, -e.deltaY);
    };

    const onPointerDown = (e: PointerEvent) => {
      const isMiddle = e.button === 1;
      const isLeftWithSpace = e.button === 0 && spaceHeld.current;
      if (!isMiddle && !isLeftWithSpace) return;
      e.preventDefault();
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      panState.active = true;
      panState.pointerId = e.pointerId;
      panState.lastX = e.clientX;
      panState.lastY = e.clientY;
      host.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panState.active || e.pointerId !== panState.pointerId) return;
      const dx = e.clientX - panState.lastX;
      const dy = e.clientY - panState.lastY;
      panState.lastX = e.clientX;
      panState.lastY = e.clientY;
      panBy(dx, dy);
    };

    const endPan = (e: PointerEvent) => {
      if (!panState.active || e.pointerId !== panState.pointerId) return;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      panState.active = false;
      panState.pointerId = -1;
      host.style.cursor = spaceHeld.current ? "grab" : "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Spacebar pan affordance — only when no input is focused.
      if (e.code === "Space" && !isEditableTarget(e.target)) {
        spaceHeld.current = true;
        host.style.cursor = panState.active ? "grabbing" : "grab";
        e.preventDefault();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // Cmd+Option+1..9 → jump to artboard N (Option avoids Chrome's
      // Cmd+1..9 tab-switching shortcut).
      if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
        const n = Number(e.code.slice(-1));
        const target = jumpTargetsRef.current?.[n - 1];
        if (target) {
          e.preventDefault();
          jumpTo(target);
        }
        return;
      }
      if (e.altKey) return;
      switch (e.key) {
        case "0":
          e.preventDefault();
          fit();
          return;
        case "1":
          e.preventDefault();
          reset();
          return;
        case "=":
        case "+":
          e.preventDefault();
          zoomIn();
          return;
        case "-":
          e.preventDefault();
          zoomOut();
          return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        host.style.cursor = panState.active ? "grabbing" : "";
      }
    };

    host.tabIndex = host.tabIndex >= 0 ? host.tabIndex : 0; // focusable for kbd

    // Wheel listener lives on the document at the CAPTURE phase. Bubble-phase
    // on `host` is too late — an inner scrollable element (e.g. CSS
    // `overflow: auto` somewhere in an artboard's content tree) consumes the
    // wheel first and the bubble never reaches us, which is why
    // shift+wheel-for-horizontal-pan would silently drop on some pages.
    // We still check the event target is inside this canvas before acting,
    // so wheels happening in shell chrome or another iframe pass through.
    const doc = host.ownerDocument || document;
    const captureWheel = (e: WheelEvent) => {
      if (!host.contains(e.target as Node)) return;
      onWheel(e);
    };
    const captureKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keyboard events from input fields anywhere.
      if (isEditableTarget(e.target)) return;
      onKeyDown(e);
    };
    const captureKeyUp = (e: KeyboardEvent) => onKeyUp(e);

    doc.addEventListener("wheel", captureWheel, { passive: false, capture: true });
    doc.addEventListener("keydown", captureKeyDown, { capture: true });
    doc.addEventListener("keyup", captureKeyUp, { capture: true });
    host.addEventListener("pointerenter", onPointerEnter);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", endPan);
    host.addEventListener("pointercancel", endPan);

    return () => {
      doc.removeEventListener("wheel", captureWheel, { capture: true } as EventListenerOptions);
      doc.removeEventListener("keydown", captureKeyDown, { capture: true } as EventListenerOptions);
      doc.removeEventListener("keyup", captureKeyUp, { capture: true } as EventListenerOptions);
      host.removeEventListener("pointerenter", onPointerEnter);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", endPan);
      host.removeEventListener("pointercancel", endPan);
    };
  }, [hostRef]);

  // Final settle on unmount — drop pending timers, flush onSettle synchronously
  // so persistence-on-close (T5) still records the last viewport.
  useEffect(() => {
    return () => {
      if (publishTimerRef.current != null) clearTimeout(publishTimerRef.current);
      if (settleTimerRef.current != null) {
        clearTimeout(settleTimerRef.current);
        const cb = onSettleRef.current;
        if (cb) cb({ ...vpRef.current });
      }
      if (interactEndTimerRef.current != null) clearTimeout(interactEndTimerRef.current);
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return {
    viewport,
    setViewport,
    panBy,
    zoomAt,
    fit,
    reset,
    zoomIn,
    zoomOut,
    jumpTo,
    animateTo,
    isInteracting,
  };
}

// Helper — true when the event target is an editable input (so spacebar
// pan doesn't fight typing inside a canvas-embedded textarea).
function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t as HTMLElement).tagName) return false;
  const el = t as HTMLElement;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

// Controller context — published by DesignCanvas so DCMiniMap + DCZoomToolbar
// can issue pan/zoom operations.
const ControllerContext = createContext<ViewportControllerHandle | null>(null);

function useViewportControllerContext(): ViewportControllerHandle | null {
  return useContext(ControllerContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame envelope

interface DesignCanvasProps {
  children: ReactNode;
  /** Per-overlay opt-out. `false` hides it; omit or `true` shows it. */
  controls?: { minimap?: boolean; toolbar?: boolean };
}

export function DesignCanvas({ children, controls }: DesignCanvasProps) {
  ensureEngineStyles();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const seeds = useMemo(() => harvestArtboards(children), [children]);

  const artboards = useMemo<ArtboardRect[]>(() => {
    const meta = readCanvasMeta();
    const defaults = synthDefaultGrid(seeds);
    const metaLayout = meta?.layout?.artboards;
    if (!Array.isArray(metaLayout) || metaLayout.length === 0) return defaults;
    const byId = new Map<string, ArtboardRect>();
    for (const r of metaLayout) {
      if (r && typeof r.id === "string") byId.set(r.id, r);
    }
    return defaults.map((d) => byId.get(d.id) ?? d);
  }, [seeds]);

  // Stable refs so the controller's callbacks always see the latest values.
  const artboardsRef = useRef(artboards);
  artboardsRef.current = artboards;

  const computeFitForArtboards = useCallback((): ViewportState => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0, zoom: 1 };
    return computeFit(artboardsRef.current, host);
  }, []);

  const getInitial = useCallback((): ViewportState | null => {
    const meta = readCanvasMeta();
    const v = meta?.viewport;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom)) {
      return { x: v.x, y: v.y, zoom: v.zoom };
    }
    const host = hostRef.current;
    if (!host) return null;
    return computeFit(artboardsRef.current, host);
  }, []);

  const onSettle = useCallback((v: ViewportState) => {
    patchCanvasMeta({ viewport: v });
  }, []);

  const controller = useViewportController({
    hostRef,
    worldRef,
    computeFit: computeFitForArtboards,
    getInitial,
    onSettle,
    jumpTargets: artboards,
  });

  const rectById = useMemo(() => {
    const m = new Map<string, ArtboardRect>();
    for (const r of artboards) m.set(r.id, r);
    return m;
  }, [artboards]);

  const rectFor = useCallback((id: string) => rectById.get(id) ?? null, [rectById]);

  // Active artboard — the one whose center sits closest to the viewport
  // center after pan settles. Recomputed on every viewport publish (~50 ms).
  const activeArtboardId = useMemo<string | null>(() => {
    if (artboards.length === 0) return null;
    const host = hostRef.current;
    if (!host) return artboards[0]?.id ?? null;
    const vp = controller.viewport;
    const cx = (host.clientWidth / 2 - vp.x) / vp.zoom;
    const cy = (host.clientHeight / 2 - vp.y) / vp.zoom;
    let bestId: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const r of artboards) {
      const ax = r.x + r.w / 2;
      const ay = r.y + r.h / 2;
      const d = (ax - cx) ** 2 + (ay - cy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestId = r.id;
      }
    }
    return bestId;
  }, [artboards, controller.viewport]);

  // The world's transform is owned by useViewportController (writes straight
  // to `worldRef.current.style.transform`). Rendering the transform from
  // React state instead would race: between React's commit and the
  // controller's next synchronous write, the world would snap back to a
  // stale published value. We start hidden and the controller's
  // useLayoutEffect writes the initial transform before first paint.
  const worldStyle: CSSProperties = { visibility: "hidden" };

  const ctxValue = useMemo<WorldContextValue>(
    () => ({
      rectFor,
      artboards,
      viewport: controller.viewport,
      activeArtboardId,
      hostRef,
      worldRef,
    }),
    [rectFor, artboards, controller.viewport, activeArtboardId]
  );

  const showMiniMap = controls?.minimap !== false;
  const showToolbar = controls?.toolbar !== false;

  return (
    <WorldContext.Provider value={ctxValue}>
      <ControllerContext.Provider value={controller}>
        <div className="dc-canvas" ref={hostRef}>
          <div className="dc-world" ref={worldRef} style={worldStyle}>
            {children}
          </div>
          {showMiniMap ? <DCMiniMap /> : null}
          {showToolbar ? <DCZoomToolbar /> : null}
        </div>
      </ControllerContext.Provider>
    </WorldContext.Provider>
  );
}
DesignCanvas.displayName = "DesignCanvas";

export function DCSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const ctx = useWorldContext();
  if (ctx) {
    // Inside DesignCanvas: DCSection is purely metadata. Its title + subtitle
    // are stashed as data-* on a `display: contents` wrapper so inspector
    // selectors still resolve, but the wrapper imposes no layout — DCArtboard
    // children take their own world-coord positions.
    return (
      <div
        className="dc-section dc-section-collapsed"
        data-dc-section={id}
        data-dc-section-title={title}
        data-dc-section-subtitle={subtitle ?? ""}
      >
        {children}
      </div>
    );
  }
  return (
    <section className="dc-section" data-dc-section={id}>
      <header>
        <h2>{title}</h2>
        {subtitle ? <p className="sku">{subtitle}</p> : null}
      </header>
      <div className="dc-section-body">{children}</div>
    </section>
  );
}
DCSection.displayName = "DCSection";

/**
 * Bordered artboard with a SKU-strip header. Inside DesignCanvas its world
 * position comes from meta.layout (or the synthesized default grid); the
 * given `width` + `height` props are honored only as a fallback when the
 * layout has no matching id. Outside DesignCanvas (DS specimens, legacy
 * uses) it renders a plain fixed-size block.
 */
export function DCArtboard({
  id,
  label,
  width,
  height,
  children,
}: {
  id: string;
  label: string;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const ctx = useWorldContext();
  const controller = useViewportControllerContext();
  const rect = ctx ? ctx.rectFor(id) : null;
  if (!ctx || !rect) {
    return (
      <article
        className="dc-artboard"
        data-dc-screen={id}
        style={{ width, height }}
      >
        <header className="dc-artboard-label sku">{label}</header>
        <div className="dc-artboard-body">{children}</div>
      </article>
    );
  }
  const isActive = ctx.activeArtboardId === id;
  const onFocus = () => {
    if (controller) controller.jumpTo(rect);
  };
  return (
    <article
      className="dc-artboard dc-positioned"
      data-dc-screen={id}
      aria-current={isActive ? "true" : undefined}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <button
        type="button"
        className="dc-artboard-label sku"
        onClick={onFocus}
        aria-label={`Focus artboard ${label}`}
      >
        {label}
      </button>
      <div className="dc-artboard-body">{children}</div>
    </article>
  );
}
DCArtboard.displayName = "DCArtboard";

export function DCPostIt({ children }: { children: ReactNode }) {
  return <aside className="dc-postit">{children}</aside>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating overlays (Phase 4 T3) — outside `.dc-world`, so they stay fixed
// to the canvas iframe chrome while the world pans/zooms underneath. Mounted
// by DesignCanvas; consumers opt out per-overlay via `<DesignCanvas controls>`.
// Styling lives inline so the engine drops into ANY DS without requiring
// `.dc-mm` / `.dc-zoom-tb` rules in `_components.css`. CV-01 references the
// same vocabulary; if a DS wants to restyle, it can target `.dc-mm` /
// `.dc-zoom-tb` directly.

const OVERLAY_CSS = `
.dc-mm {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 196px;
  height: 132px;
  background: rgba(255,255,255,0.92);
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: rgba(40,30,20,0.7);
  z-index: 6;
  user-select: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.dc-mm-hd {
  padding: 5px 8px 4px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 9px;
}
.dc-mm-body {
  position: relative;
  width: 100%;
  height: calc(100% - 22px);
  overflow: hidden;
  cursor: pointer;
}
.dc-mm-rect {
  position: absolute;
  background: rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.18);
}
.dc-mm-vp {
  position: absolute;
  border: 2px solid #d63b1f;
  pointer-events: none;
}
.dc-zoom-tb {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: stretch;
  background: rgba(255,255,255,0.94);
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgba(40,30,20,0.85);
  z-index: 6;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.dc-zoom-tb button {
  appearance: none;
  background: transparent;
  border: 0;
  border-right: 1px solid rgba(0,0,0,0.08);
  padding: 7px 12px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  min-width: 36px;
  text-align: center;
}
.dc-zoom-tb button:last-child { border-right: 0; }
.dc-zoom-tb button:hover { background: rgba(0,0,0,0.04); }
.dc-zoom-tb button:focus-visible { outline: 2px solid #d63b1f; outline-offset: -2px; }
.dc-zoom-tb-pct { font-variant-numeric: tabular-nums; min-width: 52px; }
`.trim();

function ensureOverlayStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("dc-overlay-css")) return;
  const s = document.createElement("style");
  s.id = "dc-overlay-css";
  s.textContent = OVERLAY_CSS;
  document.head.appendChild(s);
}

interface MiniMapGeometry {
  scale: number;
  offsetX: number;
  offsetY: number;
  bbox: { x: number; y: number; w: number; h: number };
}

function computeMiniMapGeometry(
  artboards: ArtboardRect[],
  mapW: number,
  mapH: number,
  pad = 6
): MiniMapGeometry {
  if (artboards.length === 0) {
    return { scale: 1, offsetX: 0, offsetY: 0, bbox: { x: 0, y: 0, w: 0, h: 0 } };
  }
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const r of artboards) {
    if (r.x < xMin) xMin = r.x;
    if (r.y < yMin) yMin = r.y;
    if (r.x + r.w > xMax) xMax = r.x + r.w;
    if (r.y + r.h > yMax) yMax = r.y + r.h;
  }
  const bw = Math.max(1, xMax - xMin);
  const bh = Math.max(1, yMax - yMin);
  const scale = Math.min((mapW - pad * 2) / bw, (mapH - pad * 2) / bh);
  const offsetX = pad + (mapW - pad * 2 - bw * scale) / 2 - xMin * scale;
  const offsetY = pad + (mapH - pad * 2 - bh * scale) / 2 - yMin * scale;
  return { scale, offsetX, offsetY, bbox: { x: xMin, y: yMin, w: bw, h: bh } };
}

/**
 * Bottom-right floating world map. Renders every DCArtboard rect scaled-to-fit
 * plus a red viewport indicator. Click-drag inside the map pans the main view;
 * click outside the viewport rect recenters on that point. Decorative for
 * accessibility — SR users navigate via DCArtboard label buttons (T4).
 */
export function DCMiniMap() {
  ensureOverlayStyles();
  const world = useWorldContext();
  const controller = useViewportControllerContext();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // 132 - 22 (header) = 110 body height; width matches the chrome.
  const MAP_W = 196;
  const MAP_BODY_H = 110;
  const dragRef = useRef<{ active: boolean; pointerId: number }>({
    active: false,
    pointerId: -1,
  });

  if (!world || !controller) return null;

  const geometry = computeMiniMapGeometry(world.artboards, MAP_W, MAP_BODY_H);
  const host = world.hostRef.current;
  const vp = controller.viewport;

  // Visible-area rect in world coords, then projected into map coords.
  let vpRect: { left: number; top: number; w: number; h: number } | null = null;
  if (host && Number.isFinite(vp.zoom) && vp.zoom > 0) {
    const wLeft = -vp.x / vp.zoom;
    const wTop = -vp.y / vp.zoom;
    const wW = host.clientWidth / vp.zoom;
    const wH = host.clientHeight / vp.zoom;
    vpRect = {
      left: wLeft * geometry.scale + geometry.offsetX,
      top: wTop * geometry.scale + geometry.offsetY,
      w: wW * geometry.scale,
      h: wH * geometry.scale,
    };
  }

  function mapToWorld(mx: number, my: number): { x: number; y: number } {
    return {
      x: (mx - geometry.offsetX) / geometry.scale,
      y: (my - geometry.offsetY) / geometry.scale,
    };
  }

  function centerOnWorld(wx: number, wy: number) {
    const h = world?.hostRef.current;
    const c = controller;
    if (!h || !c) return;
    const cur = c.viewport;
    c.setViewport({
      x: h.clientWidth / 2 - wx * cur.zoom,
      y: h.clientHeight / 2 - wy * cur.zoom,
      zoom: cur.zoom,
    });
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) return;
    const r = body.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const w = mapToWorld(mx, my);
    centerOnWorld(w.x, w.y);
    try {
      body.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;
    const body = bodyRef.current;
    if (!body) return;
    const r = body.getBoundingClientRect();
    const w = mapToWorld(e.clientX - r.left, e.clientY - r.top);
    centerOnWorld(w.x, w.y);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      bodyRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="dc-mm" aria-hidden="true">
      <div className="dc-mm-hd">
        WORLD MAP · {world.artboards.length}/{world.artboards.length}
      </div>
      <div
        className="dc-mm-body"
        ref={bodyRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {world.artboards.map((r) => (
          <div
            key={r.id}
            className="dc-mm-rect"
            style={{
              left: r.x * geometry.scale + geometry.offsetX,
              top: r.y * geometry.scale + geometry.offsetY,
              width: r.w * geometry.scale,
              height: r.h * geometry.scale,
            }}
          />
        ))}
        {vpRect ? (
          <div
            className="dc-mm-vp"
            style={{ left: vpRect.left, top: vpRect.top, width: vpRect.w, height: vpRect.h }}
          />
        ) : null}
      </div>
    </div>
  );
}
DCMiniMap.displayName = "DCMiniMap";

/**
 * Bottom-center floating toolbar — zoom out · current % · zoom in · fit · 1:1.
 * Clicking the % indicator resets to 100 %.
 */
export function DCZoomToolbar() {
  ensureOverlayStyles();
  const controller = useViewportControllerContext();
  if (!controller) return null;
  const pct = Math.round(controller.viewport.zoom * 100);
  return (
    <div className="dc-zoom-tb" role="toolbar" aria-label="Zoom">
      <button type="button" onClick={controller.zoomOut} aria-label="Zoom out">−</button>
      <button
        type="button"
        className="dc-zoom-tb-pct"
        onClick={controller.reset}
        aria-label={`Zoom ${pct}%, click to reset to 100%`}
      >
        {pct}%
      </button>
      <button type="button" onClick={controller.zoomIn} aria-label="Zoom in">+</button>
      <button type="button" onClick={controller.fit} aria-label="Fit to screen">[ ]</button>
      <button type="button" onClick={controller.reset} aria-label="Actual size">1:1</button>
    </div>
  );
}
DCZoomToolbar.displayName = "DCZoomToolbar";

// ─────────────────────────────────────────────────────────────────────────────
// Specimen helpers

/** SKU + breadcrumb trail + optional ThemeToggle. Maps to `.specimen-hd`. */
export function SpecimenHeader({
  sku,
  crumbs,
  showThemeToggle = true,
}: {
  sku: string;
  crumbs: string[];
  showThemeToggle?: boolean;
}) {
  return (
    <header className="specimen-hd">
      <span className="sku">{sku}</span>
      <span className="crumbs">
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`}>{c}</span>
        ))}
      </span>
      {showThemeToggle ? <ThemeToggle /> : null}
    </header>
  );
}

/** `<dl class="specimen-meta">` ladder. */
export function SpecimenMeta({
  entries,
}: {
  entries: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="specimen-meta">
      {entries.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** <kbd> chrome — keyboard hint. */
export function KbdHint({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

/** Inline `var(--name)` value visualiser — small chip + token name. */
export function TokenChip({
  name,
  swatch,
}: {
  name: string;
  swatch?: boolean;
}) {
  return (
    <span className="token-chip" data-token={name}>
      {swatch ? (
        <span className="token-chip-swatch" style={{ background: `var(${name})` }} />
      ) : null}
      <code>{name}</code>
    </span>
  );
}

/** Color swatch — square + token label + optional caption. */
export function ColorSwatch({
  token,
  caption,
  height = 96,
}: {
  token: string;
  caption?: ReactNode;
  height?: number;
}) {
  return (
    <div className="swatch">
      <div className="chip" style={{ background: `var(${token})`, height }} />
      <div className="meta">
        <strong>{token}</strong>
        {caption ? <span className="oklch">{caption}</span> : null}
      </div>
    </div>
  );
}

/** Single row of a type-ladder specimen — label + sample at given token. */
export function TypeScaleRow({
  token,
  label,
  sample,
}: {
  token: string;
  label: string;
  sample?: string;
}) {
  return (
    <div className="type-row" data-token={token}>
      <span className="sku">{label}</span>
      <span className="type-sample" style={{ fontSize: `var(${token})` }}>
        {sample ?? "The quick brown fox jumps over the lazy dog"}
      </span>
    </div>
  );
}

/** Light/dark toggle. Writes `data-theme` on `<html>` and persists to memory. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <span className="theme-toggle" role="tablist" aria-label="Theme">
      <button
        type="button"
        data-theme="light"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
      >
        LIGHT
      </button>
      <button
        type="button"
        data-theme="dark"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        DARK
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks

/**
 * Read resolved CSS custom property values from `<html>`. Returns the full set
 * when prefix is omitted; otherwise filters to vars beginning with `--<prefix>`.
 * Re-resolves on `data-theme` mutation.
 */
export function useTokens(prefix?: string): Record<string, string> {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    function read() {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const out: Record<string, string> = {};
      const len = cs.length;
      for (let i = 0; i < len; i++) {
        const name = cs.item(i);
        if (!name.startsWith("--")) continue;
        if (prefix && !name.startsWith(`--${prefix}`)) continue;
        out[name] = cs.getPropertyValue(name).trim();
      }
      setTokens(out);
    }
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [prefix]);
  return tokens;
}

/**
 * Current theme + setter. Mirrors the `data-theme` attribute on `<html>`.
 * Defaults to whatever attribute is already set (or "light"). No persistence
 * to localStorage — canvases are ephemeral; specimens reset per-load.
 */
export function useTheme(): { theme: string; setTheme: (t: string) => void } {
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme ?? "light";
  });
  const setTheme = useCallback((t: string) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = t;
    }
    setThemeState(t);
  }, []);
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => {
      const t = document.documentElement.dataset.theme ?? "light";
      setThemeState(t);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
}

/**
 * ResizeObserver wrapper. Pass a ref to any element (typically the active
 * artboard); returns its current `{ width, height }` in CSS pixels.
 */
export function useArtboardBounds(
  ref: RefObject<HTMLElement | null>
): { width: number; height: number } {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const r = e.contentRect;
      setBounds({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return bounds;
}

// Re-export `useRef` so `useArtboardBounds` consumers can keep a single
// import line from `@mdcc/canvas-lib`.
export { useRef };
