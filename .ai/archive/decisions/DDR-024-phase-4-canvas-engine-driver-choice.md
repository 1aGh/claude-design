# DDR-024: Phase 4 canvas-v2 engine driver — CSS transform baseline, Pixi.js gated on measured uplift

- **Date:** 2026-05-19
- **Status:** Accepted (CSS-transform baseline) · **Hold** (Pixi.js swap pending T6 measurements)
- **T7 disposition:** shipped as DOM-driver enhancements — LoD swap at zoom < 0.3 + handoff static-frame filter. Pixi.js bundle deferred until DDR-024 Measurements clear the gate.
- **Tags:** design, canvas, performance, phase-4, perf-budget
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [DDR-022](./DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [`.ai/plans/phase-4-canvas-v2-rendering-engine.md`](../plans/phase-4-canvas-v2-rendering-engine.md), [`plugins/design/dev-server/examples/perf-100-artboards.tsx`](../../plugins/design/dev-server/examples/perf-100-artboards.tsx) (was `.design/_lab/perf-100-artboards.tsx` pre-Phase 4.0.5)

## Context

Phase 4 (`/Volumes/D/git/claude-design/.ai/plans/phase-4-canvas-v2-rendering-engine.md`) turns `DesignCanvas` from a flow wrapper into an infinite-canvas world plane — every nested `DCArtboard` is absolutely positioned in world coords, a single transform pans/zooms the whole scene, MiniMap + ZoomToolbar overlays show state, and `<file>.meta.json` persists pan/zoom across reloads. T1-T5 land all of that on CSS transforms (one `transform: translate(x, y) scale(z)` on `.dc-world`).

The plan splits the engine into two stacked deliverables:

- **Behavior layer (T1-T5):** the world plane, controller hook, MiniMap, ZoomToolbar, click-to-focus, meta.json persistence — all on CSS transforms.
- **Engine layer (T6-T7):** swap the CSS-transform driver for Pixi.js per canvas, behind the same `useViewportController` interface. LoD screenshot fallback below zoom 0.3. Perf gate at 100 artboards × 30 nodes ≥ 55 fps in one canvas.

T6 is the gate. If Pixi.js outperforms CSS transforms by < 20 % at the 100 × 30 reference workload, T7 is **cancelled** — the engine ships on CSS transforms (with optional IntersectionObserver-driven culling) and Pixi.js never lands.

## Decision

1. **CSS transform driver is the canonical baseline.** Phase 4 T1-T5 ship on it. The MVP UX (infinite-canvas pan/zoom, per-canvas state, MiniMap, ZoomToolbar) is fully functional without any WebGL/WebGPU dependency. This decision is **Accepted** and independent of T6 measurements.

2. **Pixi.js engine swap (T7) is gated on a quantitative T6 result.** Authorization to swap requires:
   - ≥ 20 % FPS uplift over the CSS baseline at the 100 artboards × 30 nodes reference workload during a 5-second pan + a 5-second zoom (mean of three runs each, on the user's primary dev machine);
   - **AND** no regression on the Phase 3.4 shell budgets (cold start < 100 ms HTTP-200, idle RAM < 80 MB, first paint < 350 ms, theme toggle < 16 ms — per DDR-012);
   - **AND** Pixi.js bundle adds ≤ 200 KB gzipped to each canvas's compiled JS (informs DDR-022's "per-canvas JS bundle adds ~80-150 KB" budget — Pixi must stay reasonable).

3. **If T6 measurements fail any gate, Phase 4 ships as CSS-only.** T7 is cancelled. Follow-up perf work, if needed, takes the form of:
   - `IntersectionObserver`-driven artboard culling (don't render artboard body when not in viewport);
   - `content-visibility: auto` on `.dc-artboard-body`;
   - `will-change: transform` discipline (already in the engine CSS, applied only on `.dc-world`);
   - Optional screenshot LoD without the Pixi rewrite — same `screenshot.sh` cache, swapped via CSS `background-image` below zoom 0.3.

4. **Measurement is a one-shot task ahead of T7.** The lab canvas `plugins/design/dev-server/examples/perf-100-artboards.tsx` (Phase 4 T6 deliverable; relocated from `.design/_lab/` per DDR-025 / Phase 4.0.5) is the reference workload. A human runs it on an M1 MacBook Air (Phase 3.4 reference hardware) and records numbers into `.ai/logs/phase-4-perf-<date>.md`. The numbers go into this DDR's "Measurements" section as part of accepting T7.

## Methodology

The perf-lab canvas is intentionally minimal:

- 100 `DCArtboard` instances at 1280 × 820 each, default-grid laid out (3 cols × 34 rows).
- 30 inert DOM nodes per artboard (3000 total) — a 5×6 grid of bordered cards with monospace labels. No filters, no shadows, no images.
- A 60-sample rolling FPS sampler exposed on `window.__perf__.fps()`. Sampler runs from mount, ignored during the first ~2 seconds while the world fits-to-screen.

Three workloads, each run 3 times for the mean:

1. **Idle.** Open the canvas, fit-to-screen, wait 5 s without input. FPS should hold steady — establishes the resting cost of 100 × 30 in the DOM.
2. **Pan.** Hold spacebar, drag for 5 s in a clockwise arc across the whole world bbox. Sample FPS over the 5 s window.
3. **Zoom.** Position cursor near world center. Wheel-zoom in continuously for 5 s, then wheel-zoom out for 5 s. Sample FPS over the 10 s window.

Numbers are entered into `.ai/logs/phase-4-perf-<DATE>.md` per the following template:

```markdown
# Phase 4 perf — <date>, <hardware>

|             |   Idle FPS |    Pan FPS |   Zoom FPS |
| ----------- | ---------- | ---------- | ---------- |
| CSS-only    |     ?      |     ?      |     ?      |
| Pixi.js     |     ?      |     ?      |     ?      |
| Canvas2D    |     ?      |     ?      |     ?      |  ← sanity-check (low expectation)
```

A driver passes the gate when its **mean Pan FPS** and **mean Zoom FPS** both exceed 55 fps AND beat CSS by ≥ 20 %.

## Architectural reasoning (a-priori)

Before any number is taken, the architectural shape suggests:

- **CSS transforms are unusually well-suited to this workload.** The world transform applies once on `.dc-world`; the browser composites in the GPU layer without re-layout. 3000 static DOM nodes inside that one transformed ancestor pay only paint cost on initial mount; pan + zoom are layer-composite operations. Modern Chromium / WebKit hold ≥ 60 fps under similar workloads in the Figma web client (a documented reference point).
- **Pixi.js's value-add at this scale is unclear.** Pixi renders to WebGL, which excels at sprite batching + per-frame mutations. Our world is mostly static post-mount; the per-frame work is just "translate + scale" — a single matrix update. There is no obvious win unless we hit `> 250` artboards or our artboard contents become animated.
- **The 20 % gate is the right threshold.** Pixi adds: (a) ~120-180 KB gzipped per canvas, (b) a WebGL context per iframe (RAM cost), (c) text/image rendering becomes texture work (worse fidelity than DOM text), (d) inspector + Cmd+click selection breaks because elements live in a canvas, not in the DOM (T7 needs a separate hit-testing layer). The uplift has to be material to justify all that.

The 2026-05-19 prior on the result: CSS transforms hit ≥ 55 fps at 100 × 30, Pixi.js does not clear the 20 % gate, **and T7 is cancelled.** This DDR is structured so that the cancellation is the default outcome — measurement must affirmatively unlock T7.

## Measurements

> **Not yet captured.** This section will hold the numbers once a human runs the workload on the reference hardware. The current Phase 4 autonomous-execute session shipped T1-T5 + this lab canvas + DDR; T6 measurement requires the user's dev machine + a focused 10-minute session. Suggested invocation:
>
> ```sh
> bun run plugins/design/dev-server/server.mjs --root /Volumes/D/git/claude-design
> # Open http://localhost:4399/_canvas-shell.html?canvas=plugins/design/dev-server/examples/perf-100-artboards.tsx
> # (pre-Phase 4.0.5 location: `_lab/perf-100-artboards.tsx`)
> # Wait for fit-to-screen.
> # In DevTools console: setInterval(() => console.log(window.__perf__.fps()), 1000)
> # Run pan + zoom workloads, copy numbers into .ai/logs/phase-4-perf-<date>.md
> ```

## Consequences

- Phase 4 ships **with the CSS-transform driver** when T1-T5 (already complete) land. The MVP is feature-complete.
- T7 is on **hold** until T6 measurements clear the gate. If measurements unlock T7, this DDR will be amended to "Accepted (Pixi swap authorized)" with the numbers inlined.
- If T6 measurements fail the gate, this DDR will be amended to "Accepted (Pixi swap cancelled)" with the numbers + the architectural lesson. The Phase 4 close-out STATE row marks T7 as "cancelled per DDR-024 measurements".
- Future throwaway perf canvases live under `plugins/design/dev-server/examples/` (DDR-025 / Phase 4.0.5 relocated them out of `.design/_lab/`, which mis-classified dev-server fixtures as user content).

## Alternatives considered

### A — Skip the lab + skip T6, ship CSS-only by default

Cancel T6 outright. Phase 4 ships on CSS transforms; if a future canvas hits a perf wall, write a follow-up DDR with measurements then.

- **Pros:** Smallest scope. Defers performance work until proven necessary.
- **Cons:** Loses the perf-budget discipline. The Phase 4 plan was explicit that the engine should be perf-gated; sleeping the gate disguises the trade-off. Better to leave the deliverable + the DDR template so the test is a 10-minute job whenever someone wants it.

### B — Skip the lab + ship Pixi.js anyway

Bet on Pixi.js based on broad-strokes reasoning (WebGL > DOM for "lots of stuff"). Land T7 without measurements.

- **Pros:** Fastest path to the "ambitious" engine.
- **Cons:** No evidence Pixi.js actually beats DOM at this workload. Pixi.js adds non-trivial cost (bundle, RAM, inspector breakage). Shipping it without proof is a regression risk. Rejected.

### C — Use a different reference workload (e.g. 500 × 100 nodes)

Stress-test harder so Pixi.js's advantages emerge.

- **Pros:** Pixi.js wins more decisively at larger scales.
- **Cons:** 500 artboards × 100 nodes is not a workload any realistic user encounters in this product. Phase 4's user is a designer with 8 states (`Canvas Viewport.tsx` CV-01..CV-08); 100 × 30 is already 12× the realistic ceiling. Optimizing for a workload no user has rejects the perf-budget discipline.

## Implementation

T6 (this DDR + lab canvas) is part of the Phase 4 plan.

T7 shipped as DOM-driver enhancements:

1. **LoD content swap at zoom < 0.3.** `DCArtboard` swaps its `<div class="dc-artboard-body">` for a `<div class="dc-artboard-lod">` placeholder when the world transform's zoom drops below 0.3. Re-enters live content above 0.4 (hysteresis — avoids thrashing at the boundary). The placeholder is pure CSS — gradient background + the artboard's label centered in big mono type, `aria-hidden`. Cost: a few state updates and one DOM swap; zero new dependencies. Live-state inside artboard children is unmounted when LoD activates and remounted on exit — same trade-off the Pixi path would have made, just earlier in the pipeline.
2. **Handoff static-frame filter.** `applyHandoffStaticOverrides()` in `handoff.ts` rewrites the libMap entries for `DesignCanvas` / `DCSection` / `DCArtboard` with minimal static-frame source + empty `deps` BEFORE `inlineUsedExports` runs its BFS. Engine code (`useViewportController`, `DCMiniMap`, `DCZoomToolbar`, `WorldContext`, `harvestArtboards`, `synthDefaultGrid`, `computeFit`, …) is therefore never reached during transitive resolution and never appears in the registry item. 4 dedicated tests pin this contract.

Pixi.js engine swap (the bundled-WebGL path) remains the deferred branch. If perf-bench numbers ever land in the Measurements section above and clear the gate, the swap is implementable behind the same `useViewportController` interface (the LoD swap is independent — Pixi would render the full-detail path at high zoom; LoD's CSS placeholder would still work as the low-zoom fallback). Until then, this DDR is the authority: T7 ships without Pixi.

This DDR will be amended (not superseded) if/when measurements unlock the engine swap.
