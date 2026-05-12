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

> **Runtime-agnostic constraint:** server-side code in this phase MUST stay portable between Node 20+ and Bun. No internal `_*` property access on `http.IncomingMessage` / `http.ServerResponse`; only `node:http`, `node:crypto.createHash`, `node:fs/promises`, `node:net`, `node:path`, `node:url.fileURLToPath`. This keeps the v1.1 path open to ship a `bun build --compile` standalone binary via GitHub Releases + npm `optionalDependencies` wrapper (research at `.ai/docs/research-runtime.md`).

`.design/<canvas-slug>.layout.json` stores per-canvas spatial state: `{ artboards: [{ slug, x, y, width, height, zIndex }], viewport: { x, y, zoom } }`. Persists across sessions; can be hand-edited.

## Metadata

- **Type:** Major refactor (rendering rewrite)
- **Complexity:** High
- **Depends on:** Phase 1 (workspaces + bundler infra already in place — Pixi.js + esbuild already in root devDeps from Phase 1 Task 0)
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/dev-server/client/app.jsx` (major rewrite — split into `Canvas/`, `Viewport/`, `Toolbar/` subtrees)
  - `plugins/design/dev-server/client/canvas/` (new — Pixi.js stage, viewport controller, artboard renderer)
  - `plugins/design/dev-server/client/styles.css` (canvas overlay styles)
  - `plugins/design/dev-server/server.mjs` (serve new client bundle; new endpoint `GET/PUT /api/layout/<slug>`)
  - `plugins/design/dev-server/canvas-meta.schema.json` (extend with `layout` + `viewport`)
  - `plugins/design/dev-server/package.json` (update from Phase 1 stub — fill `dependencies: { "pixi.js": "^8" }` and `scripts: { build, dev }`)
  - `plugins/design/dev-server/build.mjs` (new — esbuild orchestrator: bundles `client/` → `dist/client.bundle.js` and `server.mjs` → `dist/server.bundle.mjs` with all deps inlined; both committed)
  - Root `package.json` `bin.claude-design-server` re-points to `plugins/design/dev-server/dist/server.bundle.mjs`
  - `.gitignore` (do not ignore `plugins/design/dev-server/dist/` — we ship it pre-built)

---

## Tasks

### Task 1: Perf-prototype before committing to Pixi

- **Do:** Build a throwaway test page rendering 100 artboards (100x100 div each, faked content) under three approaches: (a) plain DOM transforms, (b) Pixi.js WebGL, (c) Canvas2D ImageData blit. Measure FPS while panning + zooming. DDR the result.
- **Pattern:** Same harness `Vercel/turbo` uses for their dependency-graph viz.
- **Validate:** Decision recorded with FPS numbers. If Pixi loses by >20%, fall back to plain DOM + virtualization.

### Task 2: Build the dist bundles (client + server)

- **Do:** Phase 1 already placed esbuild + Pixi.js in root devDeps and stubbed `plugins/design/dev-server/package.json`. Now write `plugins/design/dev-server/build.mjs` driving two esbuild calls: (a) client bundle (`client/app.jsx` → `dist/client.bundle.js`, IIFE for the browser, inlines Pixi); (b) server bundle (`server.mjs` → `dist/server.bundle.mjs`, ESM platform=node, inlines any future runtime deps like `pdf-lib` for Phase 6). Both outputs committed to git so end users get them in the published tarball. Root `bin.claude-design-server` re-points at `dist/server.bundle.mjs`.
- **Pattern:** Mirror what `vitejs/vite` ships: workspace builds, root ships only `dist/`.
- **Validate:** `pnpm build:server` produces both bundles. `npm pack --dry-run` confirms `dist/` files present but `package.json` of the workspace absent. `mdcc design serve` on a downstream repo loads the bundled client without requiring `pnpm i`.

### Task 3: Pixi stage + viewport controller

- **Do:** New module `client/canvas/viewport.ts` owns the Pixi `Application` + a single `Container` for the world. Wheel = zoom around cursor; spacebar+drag = pan; pinch = zoom. World coords ↔ screen coords helpers.
- **Pattern:** Reference `pixi-viewport` library API (don't bundle it — re-implement minimal subset).
- **Validate:** Pan + zoom feels Figma-like. No iframe yet — just colored rectangles representing artboards.

### Task 4: Iframe positioning sync

- **Do:** Each artboard rectangle in the Pixi stage has a matching absolutely-positioned `<iframe>` in a separate DOM layer. Every frame, the viewport controller updates `iframe.style.transform = translate(...) scale(...)`. Below `zoom < 0.3`, swap iframe for a static screenshot (rendered on first paint by the server) to maintain perf.
- **Pattern:** "Level-of-detail" rendering, standard in mapping libs.
- **Validate:** 50 artboards × 30 nodes each holds ≥ 55 fps on M-class laptop.

### Task 5: Layout persistence

- **Do:** Server endpoints `GET /api/layout/<canvas-slug>` + `PUT` body `{ artboards, viewport }`. Client writes on debounced changes (pan stop / zoom stop / artboard move). File: `.design/<slug>.layout.json`. Add this file to gitignore? **No** — layout is a meaningful design artifact, should commit.
- **Validate:** Pan, reload page, viewport restored.

### Task 6: Mini-map + zoom controls + fit-to-screen

- **Do:** Bottom-right Pixi overlay shows a scaled-down rendering of all artboards + viewport rectangle. Click-drag the rectangle pans the main view. Toolbar buttons: zoom +/-, zoom 100%, fit-to-screen.
- **Validate:** Mini-map updates when artboards move; fit-to-screen centers all artboards in view.

### Task 7: Migration from v0.x layout

- **Do:** First time a v0.x canvas is opened in v1.0, auto-generate a default layout (linear grid, screen-width artboards) and write `.layout.json`. Preserve all canvas content.
- **Validate:** Open an existing v0.x project; confirm screens visible without manual layout edits.

### Task 8: Update `_active.json` schema

- **Do:** Extend `_active.json` with `viewport: { x, y, zoom }` and `selected.worldCoords`. Keep `selected.cssPath` etc. unchanged.
- **Validate:** Cmd+click an element in v2 canvas; `_active.json` carries world coords.

---

## Validation

1. **Static:** `pnpm --filter=design-client build` succeeds; bundle size ≤ 400KB gz (canvas v2 budget).
2. **Perf bench:** Repeatable harness measures FPS over 100 artboards × 30 nodes — must hold ≥ 55fps on a M1 MacBook Air.
3. **Cross-platform scenario:** Spawn `scenario-runner` for `canvas-pan-zoom-50-artboards` across `web-desktop` + `web-mobile` (mobile is degraded mode — accept).
4. **A11y:** Spawn `a11y-auditor` against the toolbar + minimap UI.
5. **Backward compat:** Open three v0.x sample projects; verify auto-layout migration works.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-pan-zoom-50-artboards` | Open project → pan across all → zoom in on one → zoom out fit-to-screen | 🆕 new |
| `canvas-v0-v1-migration` | Open an existing v0.x canvas → confirm auto-layout writes `.layout.json` → reload → viewport persists | 🆕 new |

---

## Acceptance criteria

- [ ] Bundler (esbuild) integrated; pre-built dist committed.
- [ ] Pixi.js viewport renders artboards as rectangles + matches iframe positions.
- [ ] Pan / zoom / pinch / spacebar-drag work and feel responsive.
- [ ] Layout persists to `.design/<slug>.layout.json`.
- [ ] Mini-map + zoom controls + fit-to-screen all present.
- [ ] Migration path for v0.x canvases preserves content.
- [ ] DDR: chosen rendering approach (Pixi vs. fallback) with perf numbers.
- [ ] `_active.json` carries world coordinates for selection.
- [ ] Perf gate met (≥ 55fps on bench).
