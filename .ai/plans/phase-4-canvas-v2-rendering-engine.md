# Phase 4: Canvas v2 — infinite-canvas behavior + render engine

> **SCOPE 2026-05-15 (revised twice).** First revision tried to push viewport mechanics into Phase 3.5; user clarified: *"funkcionalita kanvasu patří do Phase 4, ať se to nepřekrývá."* Final scope: Phase 3.5 = visual chrome around the canvas (Tasks 11-13 added gridded paper bg + Wordmark + SelectionHalo + StatusBar info slots — static-only). Phase 4 = the whole **canvas-functionality block** in one phase: multi-iframe infinite-canvas plane, pan/zoom controller, MiniMap, ZoomToolbar, `layout.json` persistence, default-grid migration from v0.x, tab-semantics change (toggle → pan-to-focus), Pixi.js stage, LoD screenshot fallback, world coords in `_active.json`. One phase, one coherent rewrite of how the canvas works.

## Description

The current dev-server treats canvas as "one active iframe fills the viewport area, tabs toggle visibility." Phase 4 replaces that with a Figma-style infinite canvas: all open tabs render simultaneously on a transformable world plane, pan + zoom + pinch work as expected, a MiniMap shows the world overview, a ZoomToolbar exposes fit-to-screen / 1:1 / +/-, and `.design/<canvas-slug>.layout.json` persists artboard positions + viewport state. Underneath, the world transform is owned by a Pixi.js (WebGL with Canvas2D fallback) stage, not CSS transforms — that's the perf-critical piece that unlocks 60 fps at 100+ artboards. Below `zoom < 0.3` each iframe is swapped for a server-rendered screenshot to maintain frame budget at fit-to-screen.

> **Runtime + build pipeline already provided by Phase 3.4.** Server runs on Bun (`Bun.serve` / `Bun.file` / `Bun.write`); client bundle is produced by `Bun.build` per `plugins/design/dev-server/build.ts`; Pixi.js is added to the existing client build as a regular npm dep and bundled by `Bun.build` into `dist/client.bundle.js`. No new build tool / runtime / distribution.

> **Shell visuals already provided by Phase 3.5.** Wordmark, paper-grid bg, SelectionHalo, StatusBar `ARTBOARDS` + `ZOOM` slots ship as static visuals in Phase 3.5 T11-T13. Phase 4 takes the static `ZOOM 100%` placeholder and wires it to the live controller; promotes the Wordmark from empty-state-only to in-world (so it scales with pan/zoom); inserts a `WORLD x,y` slot between ZOOM and LIVE. Otherwise the Phase 3.5 chrome contract is consumed as-is.

## User Story

As a designer working on a 30-screen flow, I want to fluidly pan and zoom across my entire `.design/` workspace at 60fps so that I can navigate the project the way I would in Figma — without each artboard reloading or scrolling stuttering.

## Problem

- Current canvas is a list of iframes in a flexbox container. Pan and zoom = browser scroll. Performance collapses past ~10 artboards.
- No infinite canvas — artboards are tab-stacked, not spatially arranged. No mini-map, no zoom controls, no fit-to-screen.
- Free-form screen positioning (a v1.0 user request) is impossible in the current model.

## Solution

Two stacked deliverables, sequenced T1 → T7:

1. **Behavior layer (T1-T5):** refactor `Viewport` from single-iframe-fills to multi-iframe infinite-canvas plane; build the pan/zoom controller; add MiniMap + ZoomToolbar interactive components; persist `<slug>.layout.json`; migrate v0.x → default grid. All on CSS transforms initially (proves UX before perf gate).
2. **Engine layer (T6-T7):** swap CSS-transform driver for Pixi.js stage behind the same controller interface; LoD screenshot fallback below zoom 0.3; world coords in `_active.json`; close the perf gate at 100 artboards × 30 nodes ≥ 55 fps.

The split lets us land a working infinite canvas as soon as T5 passes (designers can use it), then attack perf in T6-T7 without UX risk. If T6 perf-prototype shows DOM wins, we ship without Pixi and close the phase.

`.design/<canvas-slug>.layout.json` schema (introduced in T3): `{ artboards: [{ slug, path, x, y, width, height, zIndex }], viewport: { x, y, zoom } }`. Committed (not gitignored) — layout is a meaningful design artifact.

## Metadata

- **Type:** Major refactor (rendering rewrite)
- **Complexity:** High
- **Depends on:** **Phase 3.4** (Bun runtime + `build.ts` orchestrator + per-platform binary distribution + React 19 + 7-module server split + `@layer` CSS) and **Phase 3.5** (shell visual refresh + tokens) must land before this phase starts.
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/dev-server/client/app.jsx` (split into `Canvas/`, `Viewport/`, `Toolbar/` subtrees — built on the React 19+Bun.build pipeline from 3.4)
  - `plugins/design/dev-server/client/canvas/` (new — Pixi.js stage, viewport controller, artboard renderer; written in TS per the 3.4 convention)
  - `plugins/design/dev-server/client/styles/4-components.css` (canvas overlay styles — into the existing `@layer components` from 3.4; no new layer)
  - `plugins/design/dev-server/api.ts` (new endpoint `GET/PUT /api/layout/<slug>` — added to the 3.4 module split, not the old `server.mjs`)
  - `plugins/design/dev-server/canvas-meta.schema.json` (extend with `layout` + `viewport`)
  - `plugins/design/dev-server/package.json` (add `pixi.js ^8` to `dependencies` — bundled into the client by `Bun.build`, picked up by the 3.4 `build.ts` automatically)
  - `plugins/design/dev-server/build.ts` (touched only to verify Pixi bundles cleanly; existing orchestrator unchanged otherwise)

---

## Tasks

> Sequenced: T1-T5 land the infinite-canvas behavior on CSS transforms (designers can use it as soon as T5 passes). T6-T7 attack perf via Pixi swap + LoD. Phase closes only after the perf gate is met.

### Task 1: REFACTOR `Viewport` → multi-iframe infinite-canvas plane (CSS-transform world)

- **Do:** Restructure the `Viewport` component in `app.jsx`. Today it's `<div className="viewport">{tabs.map(t => <iframe className={t.path===activePath?'active':''}/>)}` with `display: none` toggling visibility. Replace with a `.vp-world` div carrying a single `transform: translate(...) scale(...)` for the entire scene; iframes are absolutely-positioned in world coords inside it. All tabs render simultaneously. Per-iframe transforms are NOT used — only the world wrapper is transformed (Phase 4 T6 swaps that one transform from CSS to Pixi).
- **Promote Phase 3.5 Wordmark from empty-state to in-world** so it scales with pan/zoom (CV-01 mock pattern).
- **Pattern:** CV-01 `.ab-world` + `.fc` items in `Canvas Viewport.html`.
- **Keep:** iframe `src`, `data-path`, inspector overlay injection, comment-pin postMessage flow — byte-identical from `runtime/` perspective. SelectionHalo from Phase 3.5 stays; element-level halo overlay can come now that we have world coords (out of CSS px space).
- **Gotcha:** scaling iframes via CSS `transform: scale()` still routes pointer events correctly; coordinates inside the iframe stay un-scaled (browser does the math). Inspector reports CSS selectors so Cmd+click selection "just works". Verify in T7 smoke.
- **Validate:** boot dev-server; all open tabs render side-by-side in the new world plane; `runtime/` Cmd+click still selects elements; SelectionHalo wraps the iframe being interacted with.

### Task 2: ADD pan + zoom interaction (`viewport-control.mjs`)

- **Do:** New module `client/viewport-control.mjs` (matches the existing `client/hmr.mjs` / `client/iframe-lazy.mjs` `.mjs` convention). Exports `createViewportController({ getState, setState, element })`. Owns:
  - **Wheel = zoom around cursor.** `event.deltaY` → exponential zoom factor; preserve world-coord under cursor. `preventDefault` to disable browser-zoom.
  - **Pinch (trackpad) = zoom around midpoint.** Detected as `ctrlKey + wheel` on macOS Safari/Chrome.
  - **Spacebar + drag = pan.** Track keydown/keyup; cursor changes to `grab` / `grabbing`.
  - **Middle-mouse drag = pan** (alternative for users without spacebar habit).
  - **Keyboard shortcuts:** `Cmd+0` fit-to-screen · `Cmd+1` actual size (1:1, zoom 1.0) · `Cmd+=` zoom in 1.2× · `Cmd+-` zoom out 0.83× · `Cmd+Option+1..9` jump to artboard N (Option modifier to avoid Chrome tab-switching collision).
  - **Clamp zoom** to [0.1, 4.0].
  - **Reduced motion:** `prefers-reduced-motion: reduce` collapses animations to instant snaps.
- **State shape:** `viewport: { x, y, zoom }` in React state via `useState`. Controller has a ref handle; React re-renders on settled values (debounced 50 ms); active animation frame goes straight to `style.transform` for 60fps under CSS driver.
- **Pattern:** reference `pixi-viewport` library API for wheel/pinch math (don't bundle; re-implement minimal subset).
- **Validate:** smooth pan/zoom with 10 iframes; shortcuts all work; spacebar in viewport doesn't conflict with spacebar in tree (controller scopes listener to `.viewport`).

### Task 3: ADD `<MiniMap>` + `<ZoomToolbar>` interactive components (CV-01)

- **Do (MiniMap):** Bottom-right floating panel (196 × 132 px per CV-01). Renders all artboard rects scaled to fit, plus a red 2 px outline rect for the current viewport. Click-drag inside MiniMap = drag-pan main view. Click outside the viewport rect = recenter on that point. Header: `"WORLD MAP · N/N"` (artboard count). Decorative — `aria-hidden="true"` (SR users get the same info from StatusBar slots).
- **Do (ZoomToolbar):** Bottom-center floating toolbar. Five buttons: `−` zoom out, `[42%]` active zoom indicator + click resets to 100%, `+` zoom in, `[ ]` fit-to-screen, `1:1` actual size. Mono labels, hairline-bordered, hard-edged buttons matching CV-01 `.zoom-tb`.
- **Wire to Phase 3.5 placeholder ZOOM slot:** swap the static `100%` value source for the live controller value via the existing `<StatusBarSlot label="Zoom">` from Phase 3.5 T13. Remove the "Pan/zoom in Phase 4" tooltip. Insert a new `<StatusBarSlot label="World position">WORLD <b>{x}, {y}</b></StatusBarSlot>` between ZOOM and LIVE (the slot that was deferred from 3.5).
- **Pattern:** CV-01 mock components `.mm` (lines 108-131) + `.zoom-tb` (lines 134-160).
- **Validate:** open 3-5 tabs; MiniMap shows rects + tracks pan/zoom; ZoomToolbar buttons all work; StatusBar ZOOM + WORLD update live.

### Task 4: REFACTOR Tabs — click pans+zooms to artboard (no toggle)

- **Do:** Existing `.tabs` row in the header keeps its JSX but `onClick` changes from `setActivePath(p)` (toggled iframe visibility) to `panToArtboard(p)` (smooth-pan + zoom-to-fit the target iframe in 240 ms; `prefers-reduced-motion` skips to instant). Active tab indicator = whichever artboard is closest to viewport center after pan settles (computed in the controller's `onSettle` callback, not on every frame).
- **Keep:** tab close button, tab open behavior (clicking a tree file still opens a tab — which now also pans to it).
- **Validate:** tab click pans + zooms; close button still works; close-then-open returns to last position (via `layout.json` per T5).

### Task 5: ADD `<slug>.layout.json` persistence + v0.x default-grid migration

- **Do (server):** Handlers `GET /_api/layout/<slug>` + `PUT /_api/layout/<slug>` in `api.ts`. Body schema: `{ artboards: [{ slug, path, x, y, width, height, zIndex }], viewport: { x, y, zoom } }`. File path: `<designRoot>/<slug>.layout.json`. Read via `Bun.file().json()` with 404-on-missing; write via `Bun.write`.
- **Do (migration):** when `<slug>.layout.json` is missing, server **synthesizes a default grid** from `_index-data` (`groups[].paths`): 3 columns, 1280 × 820 default artboard size, 80 px gutters, ordered alphabetically. Returns the synth response **without writing it** (client decides whether to persist on first user interaction — pan or zoom).
- **Do (client):** on mount, fetch `/_api/layout/<slug>` for the current canvas (slug `"default"` for v0.x — Phase 5 introduces multiple named canvases). Apply: position each tab's iframe per `artboards[].{x,y,width,height}`; set viewport `{x,y,zoom}`. On pan-stop / zoom-stop (debounced 500 ms), `PUT` the new state. Add `<slug>.layout.json` as a **committed** file (not gitignored — layout is a meaningful design artifact).
- **Validate:** open dev-server on a fresh `.design/`; verify default grid renders; pan + zoom; reload; viewport restored. `cat .design/default.layout.json` shows JSON with current state.

### Task 6: Perf-prototype DDR — Pixi vs DOM-transform baseline

- **Do:** Build a throwaway test page **inside the Phase 3.4 build pipeline** (Bun.build + React 19) rendering 100 artboards (100 × 100 div each, faked content) under three approaches: (a) the **T1-T5 CSS-transform world** baseline (already shipped at this point), (b) Pixi.js WebGL, (c) Canvas2D ImageData blit. Measure FPS while panning + zooming. DDR the result.
- **Pattern:** harness similar to `Vercel/turbo`'s dependency-graph viz.
- **Validate:** Decision recorded with FPS numbers. If Pixi wins by < 20 %, **cancel the engine swap** and ship Phase 4 as "DOM virtualization + IntersectionObserver tuning only" — T1-T5 already deliver the UX. DDR explicitly authorizes that exit.

### Task 7: Engine swap (CSS → Pixi.js) + LoD fallback + world coords in `_active.json` + perf gate close

> Only runs if T6 DDR authorizes the swap.

- **Do (engine swap):** New module `client/canvas/pixi-driver.ts` implementing the same interface as the CSS-transform driver from T2. `viewport-control.mjs` (or its `.ts` equivalent) gets a build-time feature flag picking which driver applies world transforms. **UX byte-identical** — MiniMap, ZoomToolbar, StatusBar slots, keyboard shortcuts, animation curves all consume controller state via the same React hooks; nothing visible changes.
- **Do (LoD):** when `zoom < 0.3`, swap each iframe for a static screenshot. Server pre-renders via `dev-server/bin/screenshot.sh --full <path>` on first artboard mount, caches under `_history/<slug>/_lod/`. Client requests via new `GET /_lod/<path>?w=320`. Re-enter "live iframe" mode when zoom rises above 0.4 (hysteresis).
- **Do (world coords):** extend `_active.json` with `viewport: { x, y, zoom }` mirror (so Claude reading state via `/design:edit` doesn't have to parse two files) + `selected.worldCoords: { x, y }`. Keep `selected.cssPath` unchanged from Phase 3.5. Writes go through `inspect.ts` via `Bun.write`.
- **Do (perf gate close):** re-run the T6 perf harness against the live build; assert ≥ 55 fps at 100 artboards × 30 nodes. If sub-55, DDR with the actual number + remediation plan (IntersectionObserver tuning + iframe pool size). Re-run Phase 3.4 perf harness to confirm shell budgets not regressed (cold start < 100 ms HTTP-200, idle RAM < 80 MB).
- **Update `client/iframe-lazy.mjs`:** viewport-controller world-coords become the authoritative visibility signal, replacing the flexbox-IO logic from Phase 3.4.
- **Validate:** scenarios `dev-server-shell-tour` + `dev-server-infinite-canvas` pass on Pixi driver pass with zero UX diff (≤ 0 px on chrome, ≤ 4 px on world-position rounding). Perf bench writes a markdown report under `.ai/logs/phase-4-perf-{date}.md`.

---

## Validation

1. **Static:** `bun run plugins/design/dev-server/build.ts --release` succeeds; bundle size ≤ 400 KB gz (canvas v2 budget — adds ~120 KB on top of the ~80 KB Phase 3.4 baseline for the React 19 shell + chrome).
2. **Types:** `bun tsc --noEmit` passes on `client/canvas/*.ts` and any new files in the 7-module server split.
3. **Perf bench:** Repeatable harness measures FPS over 100 artboards × 30 nodes — must hold ≥ 55 fps on an M1 MacBook Air. Re-runs the Phase 3.4 perf harness to confirm no regression on the shell budgets (cold start < 100 ms HTTP-200, idle RAM < 80 MB).
4. **Cross-platform scenario:** Spawn `scenario-runner` for `canvas-pan-zoom-50-artboards` across `web-desktop` + `web-mobile` (mobile is degraded mode — accept).
5. **A11y:** Spawn `a11y-auditor` against the toolbar + minimap UI.
6. **Backward compat:** Open three v0.x sample projects; verify auto-layout migration works.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `dev-server-infinite-canvas` | Open project → default grid renders all .html files → tab click pans/zooms to artboard → wheel-zoom out to fit-to-screen → Cmd+0 fit shortcut → MiniMap click-drag pans → ZoomToolbar `1:1` → reload (viewport restored from `default.layout.json`) → spacebar+drag → confirm StatusBar ZOOM/WORLD/ARTBOARDS update live | 🆕 new |
| `canvas-pan-zoom-50-artboards` | Stress: open 50 artboards → continuous pan → continuous zoom → fit-to-screen → assert ≥ 55 fps under Pixi driver | 🆕 new |

---

## Acceptance criteria

- [ ] Phase 3.4 + Phase 3.5 landed (this phase consumes Phase 3.5's static-visual chrome contract — Wordmark, paper-grid bg, SelectionHalo, StatusBar `ARTBOARDS` + placeholder `ZOOM` slots — and promotes them to fully interactive).
- [ ] `Viewport` refactored to multi-iframe infinite-canvas plane on CSS transforms (T1).
- [ ] Pan / zoom / pinch / spacebar-drag / middle-mouse-drag / Cmd+Option+digit shortcuts all work and feel responsive (T2).
- [ ] `MiniMap` + `ZoomToolbar` render per CV-01 reference; click-drag MiniMap pans main view (T3).
- [ ] StatusBar `ZOOM` slot wired to live controller (replaces placeholder); new `WORLD x,y` slot added (T3).
- [ ] Tab click pans+zooms to focus an artboard (smooth motion, prefers-reduced-motion respected) (T4).
- [ ] `GET/PUT /_api/layout/<slug>` endpoints return + persist; `.design/default.layout.json` round-trips across reload (T5).
- [ ] Default-grid migration: opening a `.design/` without `default.layout.json` returns a synthesized layout; first user pan/zoom persists it (lazy-create). `.design/*.layout.json` is **committed** (T5).
- [ ] DDR-T6 written: perf-prototype results (DOM baseline vs Pixi vs Canvas2D at 100 artboards). If Pixi gain < 20 %, engine swap cancelled — DDR documents the exit (T6).
- [ ] If swap authorized: Pixi.js dropped into the existing `Bun.build` pipeline as a regular dependency — no new bundler, no new build script (T7).
- [ ] If swap authorized: LoD screenshot fallback active below zoom 0.3 with 0.4 re-entry hysteresis; cached under `_history/<slug>/_lod/` (T7).
- [ ] `_active.json` carries `viewport: { x, y, zoom }` + `selected.worldCoords` (T7).
- [ ] `client/iframe-lazy.mjs` updated: viewport-controller world-coords replace flexbox-IO logic as the visibility source (T7).
- [ ] Perf gate met: ≥ 55 fps on the 100-artboard × 30-node bench AND Phase 3.4 shell budgets (cold start < 100 ms HTTP-200, first paint < 350 ms, idle RAM < 80 MB, theme toggle < 16 ms — per DDR-012) NOT regressed (T7).
- [ ] Scenarios `dev-server-infinite-canvas` (new in Phase 4) + `dev-server-shell-tour` (from Phase 3.5) pass on web-desktop.
- [ ] Manual smoke against `/Volumes/D/git/dugmate/.design/` shows no regression + default-grid generates sensibly.
