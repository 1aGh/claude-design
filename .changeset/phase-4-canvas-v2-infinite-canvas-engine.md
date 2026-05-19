---
"@1agh/md-claude": minor
---

**Design plugin — Phase 4: canvas v2 infinite-canvas engine.**

Every `.tsx` canvas under `<designRoot>/ui/` becomes a transformable world plane — `DCArtboard` children are absolutely positioned in world coords, the whole scene pans and zooms behind a single transform. Pan/zoom state survives reloads. The dev-server shell stays editor-style (one canvas active at a time, file-tab toggle); the infinite-canvas engine lives **inside** each canvas runtime, not at the shell level.

- **`DesignCanvas` is now a world plane.** Internal `.dc-canvas` + `.dc-world` structure, render-order default grid (3 cols × max-cell-width × max-cell-height, 80 px gutter), per-cell sizing so canvases with mixed-width artboards tile cleanly. Single-artboard canvases default to fit-to-screen — visually identical to pre-Phase 4 until the user pans / zooms.
- **`useViewportController` hook** — wheel = 2D pan (Mac trackpad gives both axes), Shift+wheel = horizontal pan (axis-swap robust across browsers/OSes), Ctrl/Cmd+wheel and pinch = zoom around cursor (mathematically exact — the world coord under the cursor stays fixed). Space-hold + drag and middle-mouse drag both pan. Cmd+0 fit, Cmd+1 actual size, Cmd+= / Cmd+- zoom in/out, Cmd+Option+1..9 jump-to-artboard N. Reduced-motion respected.
- **`DCMiniMap` + `DCZoomToolbar`** — bottom-right 196×132 floating map with click-drag pan; bottom-center −/%/+/fit/1:1 toolbar. Mounted by default; opt-out via `<DesignCanvas controls={{minimap:false, toolbar:false}}>`.
- **`DCArtboard` label is a focusable `<button>`** — click smooth-pans + zooms to fit just that artboard in 240 ms (rAF ease-out cubic; reduced-motion = instant). Active-artboard indicator (`aria-current="true"` + accent ring) tracks the artboard closest to viewport center.
- **`<file>.meta.json` persistence** — `canvas-meta.schema.json` extended with optional `layout` + `viewport`. New `/_api/canvas-meta` GET/PATCH endpoint shallow-merges blocks (clamps zoom, rejects non-finite, refuses paths escaping repoRoot). `_shell.html` injects `window.__canvas_meta__`. `onSettle` PATCHes back 500 ms after the last input. 5 new tests pin the contract.
- **Handoff stays clean.** `applyHandoffStaticOverrides()` in `handoff.ts` swaps `DesignCanvas` / `DCSection` / `DCArtboard` for minimal static-frame variants in the libMap before the canvas-lib BFS — engine code (`useViewportController`, `DCMiniMap`, `DCZoomToolbar`, `WorldContext`, harvest+grid+fit helpers) never reaches the emitted registry item. 4 dedicated tests pin the contract.
- **Crisp text at any zoom.** The world uses CSS `zoom: N` (layout-level re-flow → text re-rasterizes at target resolution) instead of `transform: scale(N)` (which upsamples a cached layer and produces visible pixelation past zoom ~1.5). Pan velocity stays constant in screen px regardless of zoom.
- **Pixi.js v8 added to the canvas runtime importmap.** Lazy-bundled at `/_canvas-runtime/pixi-js.js` (1.7 MB, only fetched by canvases that `import 'pixi.js'`). Reserved for the DDR-024-deferred snapshot-to-texture path and high-end designer overlays — current canvases don't need it because CSS `zoom` solves the crispness problem.
- **DDR-024** captures the perf-gate methodology (`.design/_lab/perf-100-artboards.tsx` reference workload, idle / 5s pan / 10s zoom on M1 MBA, ≥ 20 % uplift over CSS to authorize Pixi.js engine swap). Pixi.js bundle stays deferred until a user-side bench fills the Measurements block.
- **`_lib/` HMR cache invalidation fix.** When `_lib/canvas-lib.tsx` changes, the in-memory canvas bundle cache is cleared so the iframe reload picks up the fresh build. Without this, the HMR hard-reload message reached the browser but served stale-mtime-keyed bundles.
- **Slug round-trip fix** in `runtime-bundle.ts`: package names with `.` (like `pixi.js`) now map to slugs with `-` (`pixi-js`) so the URL extension stays unambiguous.

`bun test`: 123 baseline → 139 with 16 new Phase 4 tests, all green.
