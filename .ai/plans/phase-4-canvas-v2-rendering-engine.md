# Phase 4: Canvas v2 rendering engine + infinite canvas

## Description

Replace the v0.x iframe-only canvas with a hybrid rendering model: each artboard is still a real iframe (so user-authored HTML renders truthfully and we can `Cmd+click` the actual DOM via the inspector), but the **canvas viewport** — pan, zoom, scroll, multi-artboard layout, mini-map, snap-to-grid — is rendered by a Pixi.js (WebGL with Canvas2D fallback) layer on top. This unlocks 60fps pan / zoom on 50+ artboards / 1k+ DOM nodes, FigJam-style infinite canvas, and the foundation for Phases 5-8.

## User Story

As a designer working on a 30-screen flow, I want to fluidly pan and zoom across my entire `.design/` workspace at 60fps so that I can navigate the project the way I would in Figma — without each artboard reloading or scrolling stuttering.

## Problem

- Current canvas is a list of iframes in a flexbox container. Pan and zoom = browser scroll. Performance collapses past ~10 artboards.
- No infinite canvas — artboards are tab-stacked, not spatially arranged. No mini-map, no zoom controls, no fit-to-screen.
- Free-form screen positioning (a v1.0 user request) is impossible in the current model.

## Solution

Hybrid renderer: `<canvas>` overlay (Pixi.js) draws the **viewport frame** — artboard rectangles, labels, selection halos, mini-map, grid, draw-tool overlay. Inside each artboard rectangle, a positioned `<iframe>` renders the actual HTML at the correct CSS transform. The canvas reacts to wheel / pinch / spacebar-drag for pan + zoom by adjusting both the Pixi stage and every iframe's `transform: translate(...) scale(...)`.

> **Runtime + build pipeline already provided by Phase 3.4.** Server runs on Bun (`Bun.serve` / `Bun.file` / `Bun.write`); client bundle is produced by `Bun.build` per `plugins/design/dev-server/build.ts`; Pixi.js is added to the existing client build as a regular npm dep and gets bundled by `Bun.build` into `dist/client.bundle.js`. This phase does **not** introduce a new build tool, a new runtime, or a new distribution model — those landed in Phase 3.4 (DDR-009 Bun authoritative; DDR-013 per-platform binary distribution).

`.design/<canvas-slug>.layout.json` stores per-canvas spatial state: `{ artboards: [{ slug, x, y, width, height, zIndex }], viewport: { x, y, zoom } }`. Persists across sessions; can be hand-edited.

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

### Task 1: Perf-prototype before committing to Pixi

- **Do:** Build a throwaway test page **inside the Phase 3.4 build pipeline** (Bun.build + React 19, no babel-standalone) rendering 100 artboards (100×100 div each, faked content) under three approaches: (a) plain DOM transforms, (b) Pixi.js WebGL, (c) Canvas2D ImageData blit. Measure FPS while panning + zooming. DDR the result.
- **Pattern:** Same harness `Vercel/turbo` uses for their dependency-graph viz.
- **Validate:** Decision recorded with FPS numbers. If Pixi loses by >20%, fall back to plain DOM + virtualization.

### Task 2: Pixi stage + viewport controller

- **Do:** New module `client/canvas/viewport.ts` owns the Pixi `Application` + a single `Container` for the world. Wheel = zoom around cursor; spacebar+drag = pan; pinch = zoom. World coords ↔ screen coords helpers.
- **Pattern:** Reference `pixi-viewport` library API (don't bundle it — re-implement minimal subset).
- **Validate:** Pan + zoom feels Figma-like. No iframe yet — just colored rectangles representing artboards.

### Task 3: Iframe positioning sync

- **Do:** Each artboard rectangle in the Pixi stage has a matching absolutely-positioned `<iframe>` in a separate DOM layer. Every frame, the viewport controller updates `iframe.style.transform = translate(...) scale(...)`. Below `zoom < 0.3`, swap iframe for a static screenshot (rendered on first paint by the server) to maintain perf. **Integrate with Phase 3.4's IntersectionObserver lazy-mount** (`client/iframe-lazy.mjs`) so off-viewport iframes stay unmounted; Pixi world-coords are the authoritative visibility signal here, replacing the simple flexbox-IO logic from 3.4.
- **Pattern:** "Level-of-detail" rendering, standard in mapping libs.
- **Validate:** 50 artboards × 30 nodes each holds ≥ 55 fps on M-class laptop.

### Task 4: Layout persistence

- **Do:** Server endpoints `GET /api/layout/<canvas-slug>` + `PUT` body `{ artboards, viewport }` — added to `api.ts` from Phase 3.4. Client writes on debounced changes (pan stop / zoom stop / artboard move). File: `.design/<slug>.layout.json` written via `Bun.write`. Add this file to gitignore? **No** — layout is a meaningful design artifact, should commit.
- **Validate:** Pan, reload page, viewport restored.

### Task 5: Mini-map + zoom controls + fit-to-screen

- **Do:** Bottom-right Pixi overlay shows a scaled-down rendering of all artboards + viewport rectangle. Click-drag the rectangle pans the main view. Toolbar buttons: zoom +/-, zoom 100%, fit-to-screen.
- **Validate:** Mini-map updates when artboards move; fit-to-screen centers all artboards in view.

### Task 6: Migration from v0.x layout

- **Do:** First time a v0.x canvas is opened in v1.0, auto-generate a default layout (linear grid, screen-width artboards) and write `.layout.json`. Preserve all canvas content.
- **Validate:** Open an existing v0.x project; confirm screens visible without manual layout edits.

### Task 7: Update `_active.json` schema

- **Do:** Extend `_active.json` with `viewport: { x, y, zoom }` and `selected.worldCoords`. Keep `selected.cssPath` etc. unchanged. Writes go through `inspect.ts` from Phase 3.4 via `Bun.write`.
- **Validate:** Cmd+click an element in v2 canvas; `_active.json` carries world coords.

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
| `canvas-pan-zoom-50-artboards` | Open project → pan across all → zoom in on one → zoom out fit-to-screen | 🆕 new |
| `canvas-v0-v1-migration` | Open an existing v0.x canvas → confirm auto-layout writes `.layout.json` → reload → viewport persists | 🆕 new |

---

## Acceptance criteria

- [ ] Phase 3.4 already landed (Bun runtime + `build.ts` + React 19 + per-platform binary distribution + 7-module server split + `@layer` CSS); this phase consumes that.
- [ ] Pixi.js dropped into the existing `Bun.build` pipeline as a regular dependency — no new bundler, no new build script.
- [ ] Pixi.js viewport renders artboards as rectangles + matches iframe positions.
- [ ] Pan / zoom / pinch / spacebar-drag work and feel responsive.
- [ ] Layout persists to `.design/<slug>.layout.json` via `Bun.write` from `api.ts`.
- [ ] Mini-map + zoom controls + fit-to-screen all present.
- [ ] Migration path for v0.x canvases preserves content.
- [ ] DDR: chosen rendering approach (Pixi vs. fallback) with perf numbers.
- [ ] `_active.json` carries world coordinates for selection.
- [ ] Perf gate met: ≥ 55 fps on bench AND Phase 3.4 shell budgets (cold start < 100 ms HTTP-200, first paint < 350 ms, idle RAM < 80 MB, theme toggle < 16 ms — per DDR-012 relaxed budgets) NOT regressed.
