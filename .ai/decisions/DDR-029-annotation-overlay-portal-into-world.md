# DDR-029: Annotations render via React portal into `.dc-world`, with explicit large SVG dimensions

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** design, canvas-lib, annotations, phase-5.1, react, portal, css-zoom, runtime-bundle
- **Related:** [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md) (CSS zoom drives world scale), [DDR-026](./DDR-026-universal-canvas-input-grammar.md), [Phase 5.1](../plans/archive/phase-5.1-annotations-figjam.md)

## Context

Phase 5 shipped annotations as a `position: fixed` SVG sibling of `.dc-canvas`, with strokes drawn in world coords and a per-tick `<g transform>` projecting world → screen. The math works, but it has two real costs:

1. **Stutter under pan/zoom.** The world's transform lives in a synchronous DOM write (controller `applyViewport` → `worldRef.current.style.transform`). The annotation projection lives in React state (`vp` from `useViewportControllerContext`) which publishes every ~16 ms via `setViewportPublished`. The two are out of phase. Result: when the user drags, the artboard moves in lockstep with the cursor but the strokes lag by one publish tick — a ~16 ms shimmer that's invisible alone but obvious when you're trying to circle an element.
2. **Coordinate-math footprint.** Every stroke renders inside a `<g transform="translate(vp.x vp.y) scale(vp.zoom)">`. Editing the math (e.g. for the Phase 5.1 selection halos and marquee) means re-deriving screen coords twice.

Phase 5.1 had to fix the stutter AND add a stack of new primitives (selection halos, marquee, contextual toolbar anchor, text-in-shape `<foreignObject>` editor). Doing all of them on the screen-projection pipeline meant N more bits of math drift to keep in sync.

The cleaner shape is to make the SVG live **inside** `.dc-world`, so the world's CSS `zoom` + `translate(...)` propagate to the SVG natively. Strokes in world coords render at world coords. `vector-effect="non-scaling-stroke"` keeps the stroke 1 px regardless of zoom (DDR-024 already verified CSS zoom + non-scaling-stroke survives Chromium / Safari / Firefox).

But "render inside `.dc-world`" hits two non-obvious snags:

### Snag 1 — `react-dom` does not export `createPortal` in the existing runtime bundle

The dev-server pre-builds React + ReactDOM as `/_canvas-runtime/<pkg>.js` bundles, with an importmap routing every `import "react-dom"` and `import "react-dom/client"` to the same bundle. The synthetic entry re-exports the keys of `react-dom/client` only — which is `createRoot` + `hydrateRoot`, NOT `createPortal`. `createPortal` lives in the top-level `react-dom` package.

Importing it (`import { createPortal } from 'react-dom'`) at runtime throws `SyntaxError: The requested module 'react-dom' does not provide an export named 'createPortal'`. The bundle silently lacked the surface.

### Snag 2 — an SVG with `width:100% height:100%` inside `.dc-world` is 0×0

`.dc-world` is a `position: absolute; top: 0; left: 0` div with **no intrinsic width or height** — its job is to anchor a coordinate origin and host artboards via absolute positioning. There is no "world canvas" the way a `<canvas>` element would be sized; the world is conceptually infinite.

A child SVG with `width: 100%; height: 100%; overflow: visible` resolves to **0 × 0 px**. With `overflow: visible`, individual paths at non-zero coords *do* compute a `getBoundingClientRect()` and the browser will report them as laid out — but Chromium silently won't paint them, even though spec says it should. Verified live: `path.getBoundingClientRect()` returned `{x: 600, y: 300, w: 100, h: 100}` while the visible canvas showed nothing.

## Decision

**(1)** Render annotations via `react-dom`'s `createPortal` into two host elements:

- A transparent input overlay (`.dc-annot-input` div) portaled into `worldRef.current.parentElement` (= `.dc-canvas`). Receives pointer events for draw / erase tools; passes them through (no `stopPropagation`) so viewport gestures (middle-mouse, space-pan, wheel/pinch) coexist with draw mode.
- A presentational SVG (`.dc-annot-svg`) portaled into `worldRef.current` (= `.dc-world`). Strokes draw in world coords. CSS zoom + transform on the parent carries them in lockstep with artboards. `vector-effect="non-scaling-stroke"` keeps stroke px-constant at any zoom.

**(2)** Add `react-dom` (top-level package) as its own entry in `RUNTIME_PACKAGES` alongside `react-dom/client`. The importmap routes `react-dom` to its own bundle that re-exports the full surface (incl. `createPortal`, `flushSync`, `preload*`). `react-dom/client` keeps its own bundle (still the canonical home for `createRoot`).

**(3)** Hardcode `width: 200000px; height: 200000px` on `.dc-annot-svg`. Combined with `overflow: visible` and `position: absolute; left:0; top:0`, the SVG's effective viewport easily covers any world-coord stroke the user can plausibly draw on a single canvas. Strokes outside the 200k box (vanishingly unlikely — that's 200k world units, or ~6000 artboard widths) still render via `overflow: visible`.

## Why not the alternatives

| Alternative | Why rejected |
|---|---|
| Keep `position: fixed` SVG, fix stutter by writing the transform synchronously alongside the controller | Possible but invasive: it would tie the annotation layer to the controller's internal writeTransform timing. Every new annotation primitive (selection halo, marquee, toolbar anchor) would re-implement the same screen-projection math. Portal architecture is one-time cost, then all primitives compose. |
| `width: 100%` + an outer wrapper sized via `width: 200000px` (so the SVG inherits a real `100%`) | One extra wrapper div for no behavioral difference vs. setting width on the SVG directly. Rejected on Occam's razor. |
| Give `.dc-world` real dimensions (`width: 200000px; height: 200000px`) | Tempting, but `.dc-world` is the rendering plane for *all* canvases — anything reading `clientWidth` on the world (minimap geometry, fit-to-screen math) would have to grow a "the world is conceptually infinite, ignore my reported size" caveat. Cheaper to scope the giant box to just the annotation SVG that needs it. |
| Use SVG `viewBox` to create a coordinate system independent of pixel dimensions | viewBox introduces a second scaling pipeline (viewBox → SVG pixel → CSS zoom). Reasoning about combined zoom + dpi gets thorny. Plain `width:200000px` with the same coordinate system as the world keeps the mental model flat. |
| Reuse the existing `react-dom/client` bundle for `createPortal` | The bundle is built from `Object.keys(await import('react-dom/client'))`. `createPortal` is not in those keys. Adding it manually defeats the auto-discovery and makes future React minor bumps brittle. A second bundle entry for `react-dom` is the durable answer. |

## Consequences

**Wins:**
- Strokes pan/zoom synchronously with artboards. The Phase 5 shimmer is gone.
- New annotation primitives (Phase 5.1's halos, marquee, in-shape text) reuse the same world-coord render path — no projection math per primitive.
- `react-dom`'s full export surface is now reachable (`flushSync`, `preload*`, `preconnect` — useful for any future canvas runtime that wants them).

**Trade-offs:**
- One extra runtime bundle (~9 KB gzipped) served at `/_canvas-runtime/react-dom.js`. Lazy-built on first request, cached per content-hash; the cost is one cold compile per dev-server boot.
- The 200000 px SVG is a real DOM node with real bounding rect math. Chrome reports it as the largest element on the page in DevTools Performance Layers. No measurable paint cost (the SVG is opaque to compositing because every child has `vector-effect: non-scaling-stroke`), but it's an awkward number to see in a debugger. Documented inline in `annotations-layer.tsx` ANNOT_CSS so future readers don't think it's a typo.
- The doc-level pointerdown handler for Move-mode stroke selection now has to bail on chrome elements (`.dc-annot-ctx, .dc-tool-palette, .dc-annot-chrome, .dc-mm, .dc-context-menu, .dc-tp-popover`) so clicking a context-toolbar button doesn't deselect the stroke. That's a maintenance touch-point: every new floating chrome element under `.dc-canvas` has to be added to the bail selector. Caught + fixed during live testing.

**Carry-forward:**
- The portal pattern (mount into host vs. world depending on coord space) is now the canonical answer for "I want this thing to feel like it lives in the world." Future work — Phase 6 presentation mode overlays, layers panel anchors, real-time cursors — should reach for the same shape.
- If Firefox ever stops respecting CSS zoom on portaled SVG children (current behavior verified Firefox 126+), fall back to wrapping the SVG in a `transform: scale()` div anchored to the world's transform — same lockstep, slightly less crisp text. Don't return to the per-tick projection path.
