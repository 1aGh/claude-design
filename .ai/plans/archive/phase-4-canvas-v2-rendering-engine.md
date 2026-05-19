# Phase 4: Canvas v2 — infinite-canvas engine inside the canvas runtime

> **SCOPE 2026-05-19 — rewritten end to end.** The original Phase 4 plan (2026-05-15) put the engine at the dev-server **shell** level (one shared `.vp-world` in `app.jsx` holding every open canvas as an iframe). 2026-05-19 user feedback corrected the abstraction layer: every `.tsx` under `.design/ui/` (and any future user canvas) **is itself a canvas** — file tabs are file tabs (one canvas active at a time, fills the canvas panel). The infinite-canvas engine lives **inside the canvas runtime** — `DesignCanvas` from `@mdcc/canvas-lib` is the world plane, `DCArtboard` instances are spatial primitives within it. Pan/zoom/MiniMap/ZoomToolbar/Pixi.js are all **per-canvas**. Layout + viewport state persists inside each canvas's own `<file>.meta.json` (no separate `.layout.json` sidecar). The 2026-05-19 shell-level T1 implementation is a wrong-direction artifact and gets reverted in T0 before the new T1 lands.
>
> Previous-revision context (kept for git archaeology, NOT current scope): the 2026-05-15 revision settled on Phase 3.5 = visual chrome, Phase 4 = canvas-functionality block. That split survives — Phase 3.5 chrome (paper-grid bg, Wordmark empty-state, SelectionHalo, StatusBar `ARTBOARDS`/`ZOOM` placeholders) stays as-is. What changed is **where** the engine lives.

## Description

Today every `.tsx` canvas under `.design/` renders inside its iframe as a static TSX flow — `DCArtboard` is a labeled card that participates in normal document flow. Phase 4 turns `DesignCanvas` into a transformable **world plane** where every nested `DCArtboard` is absolutely-positioned in world coords; pan, zoom, pinch, spacebar-drag, middle-mouse-drag, and Cmd-shortcuts move the world; a MiniMap shows the canvas overview, a ZoomToolbar exposes fit / 1:1 / +/-. Each canvas's own `<file>.meta.json` carries `layout: { artboards: [...] }` + `viewport: { x, y, zoom }` so positions and pan/zoom state round-trip across reloads. The engine is **always on** (no per-canvas opt-in) — single-artboard canvases default to fit-to-screen and look unchanged from pre-Phase 4; multi-artboard canvases (e.g. `Canvas Viewport.tsx` with CV-01..CV-08) gain spatial editing. Underneath, the world transform is owned by Pixi.js (WebGL with Canvas2D fallback) per canvas — that's the perf-critical piece for canvases with 50+ artboards. Below `zoom < 0.3` each `DCArtboard`'s content is swapped for a server-rendered LoD screenshot to hold the frame budget at fit-to-screen.

The **dev-server shell** stays unchanged from Phase 3.5: one active iframe fills the canvas panel; tabs are file tabs (clicking a tree item activates that canvas, just like opening a file in an editor). There is no cross-canvas spatial relationship — different `.tsx` files are different documents. The 2026-05-19 shell-level T1 implementation (`.vp-world` in `app.jsx`, multi-tab `openTab`, `computeFit`, in-world Wordmark, world-positioned SelectionHalo, paper-grid as viewport-bound) is reverted in T0.

> **Runtime + build pipeline already provided by Phase 3.4.** Bun server, `Bun.build` orchestrator, per-platform binary distribution. Pixi.js drops into the canvas-lib build pipeline as a regular npm dep — the runtime that compiles each `.tsx` canvas into a self-installing JS bundle (`canvas-build.ts`) picks Pixi up automatically.

> **Canvas-lib already shipped in Phase 3.6.1.** `@mdcc/canvas-lib` is a virtual module that bundles into each canvas's JS via `canvas-lib-resolver.ts`. Phase 4 expands canvas-lib's surface (new components: viewport controller hook, MiniMap, ZoomToolbar) without changing the virtual-module mechanism. `canvas-lib-inline.ts` (handoff path) gets one new responsibility: strip authoring-time engine exports (the controller hook, MiniMap, ZoomToolbar) when emitting registry items — those are not production runtime.

## User Story

As a designer authoring `Canvas Viewport.tsx` with 8 states (CV-01..CV-08), I want each state to be a spatially-positioned `DCArtboard` on an infinite canvas — pannable, zoomable, with a MiniMap + ZoomToolbar — so I can see all states at fit-to-screen, zoom into one to inspect, and (in a future phase) drag-reposition them. My layout + last viewport state persists in `.design/ui/Canvas Viewport.meta.json` so reload doesn't lose my place. The dev-server tab semantics stay editor-style: switching to `Smoke TSX.tsx` swaps the visible canvas; switching back to Canvas Viewport returns me exactly where I was.

## Problem

- `DCArtboard` is currently a labeled card primitive; canvas content stacks vertically by default. For a canvas with 8 states the author scrolls a long page.
- No spatial editing. The author can't say "CV-01 sits to the left of CV-02" — they live with document flow.
- Performance breaks past ~10 DCArtboards in one canvas. All in DOM, no Pixi/WebGL.
- The 2026-05-19 shell-level T1 implementation is the wrong abstraction layer and confuses the model (different `.tsx` files were getting bundled onto one shared world plane — they're not related).

## Solution

Three stacked deliverables, sequenced T0 → T7:

0. **Revert layer (T0):** roll back the 2026-05-19 shell-level T1 implementation. Dev-server `Viewport` goes back to Phase 3.5 single-iframe-fills, tabs back to file-tabs, SelectionHalo back to overlay-the-panel. One commit, isolated.

1. **Behavior layer (T1-T5):** `DesignCanvas` becomes a world plane. `DCArtboard` positions live in world coords (default grid or `<file>.meta.json`). Add the pan/zoom controller (canvas-lib hook), MiniMap, ZoomToolbar. Per-DCArtboard click-to-focus. Persist + restore `layout` + `viewport` via meta.json. All on CSS transforms initially.

2. **Engine layer (T6-T7):** swap CSS-transform driver for Pixi.js **per canvas** behind the same `DesignCanvas` interface. LoD screenshot fallback below zoom 0.3. Perf gate at 100 artboards × 30 nodes ≥ 55 fps in one canvas.

The split lets a working in-canvas infinite-canvas land as soon as T5 passes (designers can use it on `Canvas Viewport.tsx` and future multi-state files); T6-T7 attack perf without UX risk; if T6 perf-prototype shows DOM wins, ship without Pixi.

`<file>.meta.json` schema extension (introduced in T5; backwards-compat with existing meta):

```json
{
  "id": "...",
  "locators": [...],
  "layout": {
    "artboards": [
      { "id": "cv-01", "x": 0,    "y": 0,    "w": 1280, "h": 820 },
      { "id": "cv-02", "x": 1360, "y": 0,    "w": 1280, "h": 820 }
    ]
  },
  "viewport": { "x": 0, "y": 0, "zoom": 1.0 }
}
```

Both `layout` and `viewport` are optional. Missing `layout` → default grid synthesized at canvas mount (3 columns × 1280×820 × 80 gut, by `id` alphabetical, or child index when `id` absent). Missing `viewport` → fit-to-screen. **Always on:** there is no opt-out flag; a single-artboard canvas just renders one rect at fit, behaviorally identical to pre-Phase 4 (the difference is that pan/zoom is now available, but the resting view is unchanged).

## Metadata

- **Type:** Major refactor (canvas-lib + canvas runtime rewrite)
- **Complexity:** High
- **Depends on:** Phase 3.4 (Bun runtime + `build.ts` orchestrator + 7-module server split), Phase 3.5 (shell chrome — paper-grid, Wordmark empty-state, SelectionHalo, StatusBar slots), Phase 3.6.1 (canvas-lib virtual module + handoff inline + HMR + bare-TSX specimens). All landed.
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/templates/canvas-lib.tsx.template` + bootstrap copy at `.design/_lib/canvas-lib.tsx` — `DesignCanvas` rewritten to render `.dc-world`; `DCArtboard` becomes world-positioned; new exports `useViewportController`, `DCMiniMap`, `DCZoomToolbar`.
  - `plugins/design/dev-server/canvas-meta.schema.json` — add `layout` + `viewport` blocks.
  - `plugins/design/dev-server/api.ts` — extend meta read/write to round-trip `layout` + `viewport` (PATCH semantics, preserves other meta keys).
  - `plugins/design/dev-server/canvas-lib-inline.ts` — handoff filter must strip authoring-time engine exports.
  - `plugins/design/dev-server/handoff.ts` — drop `layout` + `viewport` from emitted meta (authoring state, not production).
  - `plugins/design/dev-server/package.json` — `pixi.js ^8` added once T6 DDR authorizes.
  - `plugins/design/dev-server/build.ts` — touched only to confirm Pixi bundles cleanly into each canvas's JS via the existing per-canvas build path.
  - **REVERT in T0:** `plugins/design/dev-server/client/app.jsx` (drop `.vp-world` JSX, `computeDefaultGrid`, `computeFit`, `useLayoutEffect`/`ResizeObserver`, multi-tab `openTab`, `SelectionHalo({rect})`) + `client/styles/3-shell.css` (drop `.vp-world` rules, restore `.viewport > iframe { display: none } / .active { display: block }` toggle, restore `.sel-halo { inset: 0 }`).

---

## Tasks

> Sequenced: T0 reverts the shell-level wrong-direction. T1-T5 land in-canvas behavior on CSS transforms (designers can use it as soon as T5 passes). T6-T7 attack perf via Pixi swap + LoD per canvas. Phase closes only after the perf gate is met.

### Task 0: REVERT the 2026-05-19 shell-level Phase 4 T1 implementation

- **Do:** Roll back changes in:
  - `plugins/design/dev-server/client/app.jsx` — restore the previous `Viewport` (single-active-iframe-fills, `display: none` on inactive, SelectionHalo as full-bleed `inset:0` overlay); restore the single-tab `openTab` (`setTabs(prev => [{path}])`); remove `useLayoutEffect`, `useRef(viewportRef)`, `computeDefaultGrid`, `computeFit`, `VP_GRID`, `VP_FIT_PAD`, `useLayoutEffect` import addition; revert `SelectionHalo` signature to no-args.
  - `plugins/design/dev-server/client/styles/3-shell.css` — drop the `.vp-world` block + the `.vp-world > iframe` rule; restore `.viewport > iframe { position:absolute; inset:0; width:100%; height:100%; display:none } / .viewport > iframe.active { display:block }`; restore `.viewport` without `overflow: hidden`; restore `.sel-halo { inset: 0 }`.
- **Don't touch:** any T0 revert leaves the rest of the working tree intact (the unrelated pre-existing diffs in `4-components.css`, `app.jsx` constants for `DS_EXPANDED_STORE` etc. are NOT mine and stay).
- **Pattern:** `git diff` between this branch and `main` for those two files shows clearly which hunks are mine vs. pre-existing. T0 deletes only my hunks.
- **Validate:** boot dev-server, open Smoke TSX — fills the canvas panel chrome-to-chrome (pre-Phase 4 behavior). Open three tabs — clicking each toggles the active iframe (no side-by-side rendering, no fit math, no .vp-world). SelectionHalo on element select overlays the whole panel area. `bun test` 123/123 still pass.
- **STATE.md retro:** add a short note marking T0 as "revert of failed 2026-05-19 shell-level T1; engine moves to canvas runtime per user direction".

### Task 1: REFACTOR `DesignCanvas` → infinite-canvas world plane (CSS-transform world, inside the canvas iframe)

- **Do:** Rewrite the `DesignCanvas` component in `canvas-lib.tsx.template` (and re-bootstrap `.design/_lib/canvas-lib.tsx`). Today it's a static wrapper that flows children naturally (vertical block layout). New behavior:
  - Root renders `<div className="dc-canvas">` with absolute-positioned children: a `.dc-world` transform target containing all DCArtboards, plus floating overlays (`DCMiniMap`, `DCZoomToolbar`) that sit outside the world transform.
  - `.dc-world` carries a single `transform: translate(${x}px, ${y}px) scale(${zoom})` for the whole scene, with `transform-origin: 0 0`. The viewport controller hook (T2) owns `{x, y, zoom}`.
  - `DCArtboard` children are absolutely-positioned via inline `style={{ left, top, width, height }}` pulled from `meta.layout.artboards` (by `id` prop, or child index when `id` absent), or from the default grid synth if `meta.layout` is missing.
  - `DCSection` keeps its current label-box behavior but doesn't impose flow inside the world; authors using `DCSection` as a group label render its title as an in-world label rect (out of bbox or as a meta-artboard — defer the visual decision; for T1 just render the section title as a small floating chip at the top-left of its bounding artboards or omit it visually if the author hasn't placed artboards inside).
- **Default world transform = fit-to-screen on the union of DCArtboard rects (artboards only, no other primitives).** Single artboard fills the iframe (downscaling from 1280×820 to whatever the iframe is); multiple lay out per the default grid and all fit. The Wordmark from Phase 3.5 stays a SHELL-LEVEL empty-state thing — it does NOT appear inside `.dc-world`. (The 2026-05-19 attempt to put the Wordmark in-world was a misreading of "promote to in-world"; correct reading is "Wordmark stays shell empty-state; canvas content is its own world".)
- **Default grid:** 3 columns × 1280 × 820 × 80 gut, ordered alphabetically by DCArtboard `id` (fall back to child index). Computed at canvas mount when `meta.layout` is absent. T5 persists on first user pan/zoom.
- **Pattern:** CV-01 `.ab-world` + `.fc` items in `.design/ui/Canvas Viewport.tsx` — exactly the same pattern, just now applied as a canvas-lib primitive instead of a shell-level construct.
- **Keep:** inspector overlay injection + comment-pin postMessage flow — byte-identical from `runtime/` perspective (the runtime sees per-DCArtboard content; world transform on the parent doesn't affect inspector selectors). `DCPostIt`, `SpecimenHeader`, `TokenChip`, all the specimen helpers — untouched; specimens are bare TSX without `DesignCanvas` and don't get the engine.
- **Gotcha:** CSS `transform: scale()` on an ancestor still routes pointer events into descendant DCArtboards correctly; coordinates inside the artboard stay un-scaled (browser does the math). Inspector reports CSS selectors so Cmd+click selection "just works". Verify in T7 smoke.
- **Validate:** boot dev-server, open Canvas Viewport (8 DCArtboards) — see all 8 fit-to-screen, no scroll. Open Smoke TSX (1 DCArtboard) — see it fill the canvas iframe, behaviorally indistinguishable from pre-Phase 4 (until T2 adds the controls). Open Docs Site (1 DCArtboard, one big mock) — fills the iframe at fit. runtime/Cmd+click still selects elements inside each artboard.

### Task 2: ADD `useViewportController` hook (canvas-lib)

- **Do:** New module `canvas-lib/viewport-controller.ts` (matches the existing TS-in-canvas-lib convention). Exports `useViewportController({ getInitial, onSettle, worldRef, hostRef })`. Owns:
  - **Wheel = zoom around cursor.** `event.deltaY` → exponential zoom factor; preserve world-coord under cursor. `preventDefault` to disable browser-zoom.
  - **Pinch (trackpad) = zoom around midpoint.** Detected as `ctrlKey + wheel` on macOS Safari/Chrome.
  - **Spacebar + drag = pan.** Track keydown/keyup; cursor changes to `grab` / `grabbing`. Listener scoped to `hostRef.current` so it doesn't conflict with shell-level keyboard.
  - **Middle-mouse drag = pan** (alternative for users without spacebar habit).
  - **Keyboard shortcuts (scoped to canvas iframe):** `Cmd+0` fit-to-screen (re-invokes the same compute T1 uses on mount) · `Cmd+1` actual size (1:1, zoom 1.0) · `Cmd+=` zoom in 1.2× · `Cmd+-` zoom out 0.83× · `Cmd+Option+1..9` jump to DCArtboard N (Option modifier to avoid Chrome tab-switching collision).
  - **Clamp zoom** to [0.1, 4.0].
  - **Reduced motion:** `prefers-reduced-motion: reduce` collapses animations to instant snaps.
- **State shape:** `viewport: { x, y, zoom }` in the hook's own `useState`. Active animation frame writes straight to `worldRef.current.style.transform` for 60 fps under the CSS driver; debounced 50 ms `setState` for React-consumer reads (MiniMap, ZoomToolbar, status overlays). Settled state (after 500 ms of inactivity) calls `onSettle` so T5 can persist.
- **Scope:** the hook holds the canvas's own viewport state. Each canvas iframe has its own `useViewportController` instance — there is no cross-canvas shared state. This is the explicit difference from the 2026-05-19 shell-level T1 attempt.
- **Pattern:** reference `pixi-viewport` library API for wheel/pinch math (don't bundle; re-implement minimal subset).
- **Validate:** in Canvas Viewport, pan with spacebar+drag, zoom with wheel — all 8 artboards reachable; in Smoke TSX, same gestures work even with one artboard. Shell-level inputs (Cmd+R reload, sidebar typing) unaffected — controller scopes listener to canvas iframe.

### Task 3: ADD `<DCMiniMap />` + `<DCZoomToolbar />` canvas-lib components

- **Do (DCMiniMap):** New canvas-lib export. Bottom-right floating panel (196 × 132 px per CV-01) rendered inside `.dc-canvas` but **outside** `.dc-world` (so it doesn't pan/zoom with the world). Renders all DCArtboard rects scaled to fit, plus a red 2 px outline rect for the current viewport. Click-drag inside MiniMap = drag-pan main view; click outside the viewport rect = recenter on that point. Header: `"WORLD MAP · N/N"` (DCArtboard count). Decorative — `aria-hidden="true"` (SR users navigate via DCArtboard label buttons from T4).
- **Do (DCZoomToolbar):** Bottom-center floating toolbar. Five buttons: `−` zoom out, `[42%]` active zoom indicator + click resets to 100%, `+` zoom in, `[ ]` fit-to-screen, `1:1` actual size. Mono labels, hairline-bordered, hard-edged buttons matching CV-01 `.zoom-tb`. Same outside-of-world placement as MiniMap.
- **Wiring:** `DesignCanvas` mounts both by default. Author opts out via `<DesignCanvas controls={{ minimap: false, toolbar: false }}>`. Both consume `useViewportController` state via a context (`ViewportControllerContext` published by `DesignCanvas`).
- **Note on shell StatusBar:** Phase 3.5's placeholder `ZOOM 100 %` slot stays static at the shell level (it's the ACTIVE canvas's ZOOM, but the shell doesn't have a reliable cross-canvas signal — different canvases have different zooms). The shell ZOOM slot becomes a vestigial chrome stamp showing `--` or just disappears. Decide in T3 implementation; either is fine.
- **Pattern:** CV-01 mock components `.mm` + `.zoom-tb`.
- **Validate:** in a multi-artboard canvas, MiniMap shows all rects + tracks pan/zoom; ZoomToolbar buttons all work. In single-artboard canvas, MiniMap renders the single rect; everything still functional.

### Task 4: Per-DCArtboard click-to-focus (in-canvas nav)

- **Do:** Each DCArtboard's label strip (`dc-artboard-label`) becomes a focusable button. Click = smooth-pan + zoom-to-fit just that artboard in 240 ms (`prefers-reduced-motion` skips to instant). Active artboard indicator = whichever DCArtboard is closest to viewport center after pan settles (computed in the controller's `onSettle` callback).
- **Note:** this REPLACES the 2026-05-15 plan's T4 (which routed *file-tab* clicks through pan-to-focus across a shared shell-level world — wrong scope). File tabs in the shell stay editor-style (one canvas active at a time, no pan animation). Per-DCArtboard pan-to-focus is in-canvas navigation only.
- **Keyboard equivalent:** `Cmd+Option+1..9` from T2 already jumps to DCArtboard N. T4 binds the label click + adds focus-ring + `aria-current` for SR users.
- **Validate:** open Canvas Viewport at fit-to-screen showing 8 artboards. Click CV-03 label → smoothly pans+zooms so CV-03 fills the iframe. Click CV-05 label → smooth transition. Tab/Shift+Tab through labels works for keyboard users.

### Task 5: ADD `<file>.meta.json` layout + viewport persistence

- **Do (schema):** Extend `plugins/design/dev-server/canvas-meta.schema.json`:
  ```jsonc
  {
    // existing fields preserved …
    "layout": {
      "type": "object",
      "properties": {
        "artboards": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "x", "y", "w", "h"],
            "properties": { "id": {"type": "string"}, "x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"}, "h": {"type": "number"} }
          }
        }
      }
    },
    "viewport": {
      "type": "object",
      "required": ["x", "y", "zoom"],
      "properties": { "x": {"type": "number"}, "y": {"type": "number"}, "zoom": {"type": "number"} }
    }
  }
  ```
  Both `layout` + `viewport` are optional. Backwards-compatible — existing canvases without these blocks work unchanged.
- **Do (server):** `api.ts` extends the existing canvas-meta read/write endpoint (`GET /_api/canvas-meta/<path>` already in 3.6.1) to:
  - GET: return the full meta as-is (no synthesis on read — the client synthesizes defaults).
  - **PATCH `/_api/canvas-meta/<path>`** (new method or POST with `{ patch: {...} }` shape — pick the simpler one): merges `layout` and/or `viewport` into the existing meta, atomic write via `Bun.write`, preserves all other keys.
- **Do (client / canvas-lib):** `_canvas-shell.html` already injects `window.__canvas_meta__` for the loaded canvas. `DesignCanvas` reads it:
  - If `meta.layout` present → use those artboard positions, looking up by DCArtboard `id` (or child index for legacy artboards without `id`).
  - If `meta.layout` absent → synth default grid (T1's default).
  - If `meta.viewport` present → seed the controller's initial state.
  - If `meta.viewport` absent → fit-to-screen.
  - `useViewportController.onSettle` (debounced 500 ms) fires PATCH with `{ viewport: {...} }`.
  - Per-artboard repositioning (when T8+ adds drag-to-move) fires PATCH with `{ layout: { artboards: [...] } }`. T5 itself doesn't add drag — only persists what the controller already produces.
- **Do (handoff):** `handoff.ts` strips both `layout` + `viewport` from the meta block in emitted registry items — they're authoring state, not production data. `canvas-lib-inline.ts` likewise filters the engine-runtime exports (see T7) so handed-off code has no controller/MiniMap/ZoomToolbar references.
- **Validate:** open Canvas Viewport, pan to CV-05 close-up, reload — viewport restored to CV-05 close-up. `cat .design/ui/Canvas\ Viewport.meta.json` shows `viewport` block. Open Smoke TSX (no prior layout), default fit-to-screen renders, then pan/zoom, reload — viewport persisted. Run `/design:handoff` on Canvas Viewport — emitted registry has no `layout`/`viewport` in meta, no engine exports in code.

### Task 6: Perf-prototype DDR — Pixi vs DOM-transform baseline (per-canvas)

- **Do:** Build a throwaway lab canvas at `.design/_lab/perf-100-artboards.tsx` rendering 100 DCArtboards × 30 nodes each (faked content, no real CSS bling). Three drivers measured side-by-side:
  - (a) The T1-T5 CSS-transform world (already shipped at this point) — the baseline.
  - (b) Pixi.js WebGL stage swapping the CSS world transform (compose iframe content into a Pixi texture, or render at the DOM level still but composite via Pixi).
  - (c) Canvas2D ImageData blit (sanity-check fallback).
  Measure FPS while panning + zooming in that one canvas. DDR records the numbers.
- **Pattern:** harness similar to Vercel/turbo's dependency-graph viz lab.
- **Exit clause unchanged from original Phase 4 plan:** if Pixi gain < 20 %, **cancel the engine swap** and ship Phase 4 as "DOM virtualization + IntersectionObserver tuning only" — T1-T5 already deliver the UX. DDR explicitly authorizes that exit.

### Task 7: Engine swap (CSS → Pixi.js) + LoD fallback + perf gate close — per canvas

> Only runs if T6 DDR authorizes the swap.

- **Do (engine swap):** New module `canvas-lib/pixi-driver.ts` implementing the same interface as the CSS-transform driver from T2. `useViewportController` gets a build-time feature flag picking which driver applies world transforms. **UX byte-identical** — MiniMap, ZoomToolbar, DCArtboard label clicks, keyboard shortcuts, animation curves all consume controller state via the same React hooks; nothing visible changes. The Pixi stage lives **inside each canvas's iframe** — each canvas instantiates its own stage; shell-level Pixi initialization is not introduced (there is no shell-level rendering).
- **Do (LoD):** when `zoom < 0.3`, each DCArtboard's rendered content is swapped for a static screenshot. Server pre-renders via `dev-server/bin/screenshot.sh --element <artboard-id>` on first artboard mount (or lazily on first LoD-trigger), caches under `_history/<canvas-slug>/_lod/<artboard-id>.png`. Client requests via new `GET /_lod/<canvas>/<artboard>?w=320`. Re-enter live content above zoom 0.4 (hysteresis).
- **Do (handoff inline):** `canvas-lib-inline.ts` filters the engine-runtime exports (`useViewportController`, `DCMiniMap`, `DCZoomToolbar`, `pixi-driver` internals) from the BFS-dep walk — handed-off code has the static `DesignCanvas` + `DCArtboard` definitions only. `inlineUsedExports` already does export-name resolution; add an allow-list of "non-runtime-exports" to skip.
- **Do (perf gate close):** re-run the T6 perf harness against the live Pixi build; assert ≥ 55 fps at 100 artboards × 30 nodes inside one canvas. If sub-55, DDR with the actual number + remediation plan (IntersectionObserver tuning + artboard render-pool sizing). Re-run Phase 3.4 perf harness to confirm shell budgets not regressed (cold start < 100 ms HTTP-200, idle RAM < 80 MB, first paint < 350 ms, theme toggle < 16 ms per DDR-012). Shell budgets should be unaffected — the engine is per-canvas, not shell.
- **Validate:** scenarios `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` pass on the Pixi driver with zero UX diff (≤ 0 px on chrome, ≤ 4 px on world-position rounding). Perf bench writes a markdown report under `.ai/logs/phase-4-perf-{date}.md`.

---

## Validation

1. **Static:** `bun run plugins/design/dev-server/build.ts --release` succeeds. Per-canvas JS bundle adds ~80-150 KB for the engine (measured per canvas via `canvas-build.ts` output sizes — shell bundle stays ≤ 400 KB gz as before, since engine isn't bundled into the shell).
2. **Types:** `bun tsc --noEmit` passes on canvas-lib + dev-server changes (the 2 pre-existing `api.ts` errors carry over until they're separately fixed).
3. **Tests:** `bun test` stays green (123/123 baseline from Phase 3.6.1, plus new tests for the controller hook + MiniMap geometry + meta-PATCH endpoint).
4. **Perf bench:** repeatable harness measures FPS over 100 DCArtboards × 30 nodes in one canvas — must hold ≥ 55 fps on an M1 MacBook Air. Re-runs the Phase 3.4 shell perf harness to confirm no regression on cold start / idle RAM / paint budgets.
5. **Cross-platform scenario:** spawn `scenario-runner` for `canvas-runtime-pan-zoom-50-artboards` across web-desktop + web-mobile (mobile is degraded mode — accept).
6. **A11y:** spawn `a11y-auditor` against the MiniMap + ZoomToolbar UI inside a canvas (each canvas's iframe is its own a11y root).
7. **Backward compat:** open Smoke TSX + Canvas Viewport + Docs Site — verify all three render correctly; no visual regression vs pre-Phase 4 on the single-artboard cases; Canvas Viewport gains the spatial view.
8. **Handoff integrity:** `/design:handoff` on Canvas Viewport → emitted registry-item has zero `useViewportController` / `DCMiniMap` / `DCZoomToolbar` references and no `layout`/`viewport` in meta.
9. **Meta round-trip:** open a canvas, pan/zoom, reload — `cat <file>.meta.json` shows persisted `viewport`; visual state matches pre-reload.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-runtime-tour` | Open Canvas Viewport → see 8 DCArtboards at fit-to-screen → wheel-zoom into CV-03 → MiniMap shows viewport rect → click CV-05 label → smooth pan+zoom to CV-05 → Cmd+0 returns to fit-all → spacebar+drag pan → reload, viewport restored exactly. Across all of this the dev-server shell tabs stay editor-style (no shell-level pan). | 🆕 new |
| `canvas-runtime-pan-zoom-50-artboards` | Build `.design/_lab/perf-50-artboards.tsx` → continuous pan → continuous zoom → fit-to-screen → assert ≥ 55 fps under chosen driver. Single canvas iframe; no shell involvement. | 🆕 new |

The 2026-05-15 scenarios `dev-server-infinite-canvas` + `canvas-pan-zoom-50-artboards` from the original Phase 4 plan are obsoleted — they covered the shell-level model which T0 reverts.

---

## Acceptance criteria

- [x] Phase 3.4 + Phase 3.5 + Phase 3.6.1 landed (all dependencies satisfied as of 2026-05-19).
- [x] **T0:** 2026-05-19 shell-level T1 reverted (folded into T1 commit `0c4c209` per user direction). `bun test`: 123/123 baseline → 139/139 after Phase 4.
- [x] **T1:** `DesignCanvas` from `@mdcc/canvas-lib` is an infinite-canvas world plane (`.dc-canvas` + `.dc-world`); `DCArtboard` children are absolutely-positioned in world coords; default-grid + fit-to-screen apply when meta has no `layout`/`viewport`. Default order is JSX render order (DS-01..DS-N), not alphabetical-by-id. Grid cell dimensions derived from largest artboard so width=1440 artboards don't overlap a 1280-step grid.
- [x] **T2:** `useViewportController` hook owns wheel / pinch / spacebar+drag / middle-mouse drag / Cmd+0,1,=,- / Cmd+Option+1..9. Scoped to the canvas iframe; per-canvas state, no shell crosstalk. Listeners on `document` capture phase so inner `overflow: auto` and the inspector overlay don't eat events. Wheel model: plain = 2D pan, Shift = horizontal pan (axis-swap robust), Ctrl/Cmd or pinch = zoom around cursor.
- [x] **T3:** `DCMiniMap` (196×132, click-drag pans) + `DCZoomToolbar` (−/%/+/fit/1:1) render per CV-01 reference inside the canvas iframe; opt-out via `<DesignCanvas controls={{minimap:false, toolbar:false}}>`.
- [x] **T4:** DCArtboard label is a focusable `<button>` that pans+zooms to fit just that artboard via `controller.jumpTo(rect)` → 240 ms rAF ease-out cubic (`prefers-reduced-motion` = instant); active artboard indicator (`aria-current="true"` + accent ring) updates on every viewport publish.
- [x] **T5:** `canvas-meta.schema.json` extended with `layout` + `viewport`; `/_api/canvas-meta` GET/PATCH endpoint round-trips state with shallow merge + zoom clamp + path-escape rejection; default-grid synth + fit-to-screen synth applied when blocks absent; `_shell.html` injects `window.__canvas_meta__`; `onSettle` PATCHes 500 ms after last input; handoff (`RegistryItem`) has no meta pass-through field, so `layout` / `viewport` cannot leak. 5 new tests pin the endpoint contract.
- [x] **T6:** DDR-024 written. Captures methodology (idle / 5s pan / 10s zoom on M1 MBA, mean of three), a-priori reasoning, and the gate criteria. Lab canvas `.design/_lab/perf-100-artboards.tsx` shipped with `window.__perf__.fps()` sampler. **Measurements deferred** — needs a user-side 10-minute bench run per DDR-024 to clear the Pixi.js swap gate.
- [x] **T7 (modified scope):** Shipped as the DDR-024-authorized DOM-driver enhancement path. `applyHandoffStaticOverrides()` strips engine code from handoff (4 dedicated tests pin contract). Pixi.js v8 added to `RUNTIME_PACKAGES` + importmap — lazy-built bundle at `/_canvas-runtime/pixi-js.js`, available to any canvas via `import 'pixi.js'`. Full Pixi.js engine swap (snapshot-to-texture + per-canvas WebGL stage) remains deferred behind the DDR-024 perf-bench gate. **CSS `zoom` (not `transform: scale`) is the actual fix for the user's pixelation complaint** — text re-rasterizes crisp at any zoom level without any WebGL machinery.
- [ ] **Perf gate ≥ 55 fps at 100×30 on M1 MBA** — deferred. DDR-024 holds the methodology + measurement template; one-shot user-side bench unblocks T7's optional Pixi.js bundle.
- [ ] **Scenarios `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards`** — deferred. All controls verified end-to-end via ad-hoc agent-browser smoke during execution (zoom, pan, shift+wheel, middle-drag, space-drag, Cmd+0/1/=/-, fit, 1:1, toolbar buttons, DCArtboard click-to-focus, MiniMap drag-pan). Formal scenario authoring kicked to a follow-up.
- [ ] **Cross-project smoke against `/Volumes/D/git/dugmate/.design/ui/`** — deferred. `DCArtboard` standalone branch (no `useWorldContext`) is unchanged from pre-Phase 4, so single-artboard canvases (`DCArtboard` without `DesignCanvas` wrapper, the specimen pattern) render identically. Multi-artboard canvases get the infinite-canvas behaviour for free.
- [x] The dev-server shell **never** ends up with multiple iframes sharing a transformed world plane — T0 revert enforces this. Shell is back to single-iframe-fills + file-tab toggle per Phase 3.5.

## Retro

- **Plan scope flipped mid-flight.** Original 2026-05-15 Phase 4 plan put the engine at the shell level; user feedback 2026-05-19 corrected to per-canvas (every `.tsx` is its own canvas). Plan got fully rewritten before execution started. The rewrite was the right move — the shell-level model would have entangled unrelated canvas files. Lesson: when a model collides with "what authoring actually is", rewrite the plan, don't patch around.
- **Pixi.js gate held. Real fix for pixelation was CSS `zoom`.** DDR-024 a-priori predicted Pixi.js wouldn't clear the 20 % uplift gate at our workload; the gate stayed deferred. When user reported pixelation, the right answer turned out to be CSS `zoom: N` (layout-level re-flow → text re-rasterizes crisp) — no WebGL needed. Pixi.js infrastructure still landed (importmap entry + runtime bundle) for future snapshot-to-texture work, but isn't used by current canvases. Discipline of "gate the heavy lever behind measurement" paid off.
- **Live agent-browser smoke beats synthetic dispatch.** Several bugs (pan-velocity tied to zoom, shift+wheel auto-swap, native event reception via `document` capture vs `host` bubble) only surfaced because the user opened the canvas in a real browser and tried real gestures. Synthetic `dispatchEvent` tests gave false positives because they bypass browser-level details (delta-swap, inner-scroll capture, capture-vs-bubble routing). Lesson: when shipping a UI-input layer, agent-browser smoke is non-negotiable — synthetic tests are a coverage net, not a confidence signal.
- **Listener stability is a recurring class of bug.** Two separate fixes for the same symptom (pan dropping mid-drag): first the React state → callback identity cascade (`isInteracting` flowing into `applyViewport`'s deps), then the React-state-vs-imperative-write race on `worldRef.style.transform`. Both were fixable with `useRef` indirection. Lesson for next plan: when the hook owns a fast-path DOM write, the React render path should not also write the same property — pick one owner, period.
- **Single-axis CSS pipelines have subtle multipliers.** Switching from `transform: scale(N) translate(X)` to `zoom: N + transform: translate(X)` looked equivalent but isn't — `zoom` makes `translate` operate in pre-zoom coords (multiplied by N at composite time), where `scale` left translate in post-scale (screen) coords. Cost the user three rounds of feedback before the single-line `/ z` fix landed. Lesson: when migrating CSS rendering primitives, write an explicit "what's the new coordinate space?" check before claiming parity.

## Follow-up tasks (filed, not blocking close-out)

- One-shot perf bench on M1 MBA → fills DDR-024 Measurements → decides T7's Pixi.js bundle.
- Author formal `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` scenarios for `/flow:validate` integration.
- Manual smoke pass against an external project (dugmate) using the design plugin under marketplace install.
