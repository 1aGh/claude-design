# Phase 5: Draw / annotation tools for the dev server

> **Scope-narrowed 2026-05-13.** Originally this phase bundled layers panel + in-canvas CSS editor + draw tools + multi-DS. Layers panel + in-canvas CSS editor were extracted to **Phase 12** (end-of-roadmap extra feature). Multi-DS was folded into [`.ai/plans/archive/design-system-init.md`](./archive/design-system-init.md) as its Phase 4, since it shares the same `system/` shape and completeness contract as the single-DS bootstrap workflow.
>
> **This phase now ships only:** draw / annotation tools on canvas (pen, circle, arrow, eraser) as a transparent SVG overlay per canvas, with keyboard shortcuts and hideable presentation mode.

## Description

Toolbar buttons in canvas chrome: pen, circle, arrow, eraser, color picker. Drawing happens on a transparent SVG layer sized to the canvas world (zoomable with viewport from Phase 4). On stroke complete: PUT to `/api/annotations/<slug>` → server writes `.design/<slug>.annotations.svg`. Annotations toggleable; hideable in presentation mode (Phase 6).

## User Story

As a designer reviewing a canvas, I want to circle a button and write "this needs more padding" directly on the canvas so that screenshots aren't needed for async review.

## Problem

Annotation in the canvas today requires a screenshot + external tool (FigJam, Excalidraw, Skitch). Not bad, but a workflow break.

## Solution

Toolbar with native `<svg>` drawing (minimal subset of tldraw's pattern — no external dep). Strokes persist to `.design/<slug>.annotations.svg`. Layer is hideable; eraser removes strokes; stroke color picker uses the project's accent/status palette.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium-Low (after multi-DS extraction)
- **Depends on:** Phase 4 (canvas v2 rendering — viewport + world coordinate system)
- **Parallel with:** Phase 6 (comments + export — both touch canvas chrome)
- **Affected files:**
  - `plugins/design/dev-server/client/canvas/AnnotationsLayer.tsx` (new — draw layer)
  - `plugins/design/dev-server/client/canvas/Toolbar.tsx` (extend with draw buttons)
  - `plugins/design/dev-server/server.mjs` (new endpoint: `GET/PUT /api/annotations/<slug>`)

---

## Tasks

### Task 1: Draw tools

- **Do:** Toolbar buttons (pen, circle, arrow, eraser, color picker). Drawing happens on a transparent SVG layer sized to canvas world coords (zoomable with Phase 4 viewport). On stroke complete, PUT to `/api/annotations/<slug>` → `.design/<slug>.annotations.svg`.
- **Pattern:** [tldraw](https://github.com/tldraw/tldraw) is the gold standard but heavy — implement a minimal subset directly with native `<svg>` elements.
- **Validate:** Circle an element; reload; annotations restored. Eraser removes strokes.

### Task 2: Keyboard shortcuts

- **Do:** B = pen, R = circle/rectangle, A = arrow, E = eraser, V = select (clear draw), Esc = exit draw mode. Cmd+/ = show shortcut sheet. (No shortcuts for layers / inspector — those live in Phase 12.)
- **Validate:** All shortcuts work; no conflict with browser defaults or canvas pan/zoom from Phase 4.

### Task 3: Presentation mode toggle

- **Do:** Single toggle button + keyboard shortcut (Shift+P) to hide annotations layer for clean screenshots / review. State is local (not persisted to disk).
- **Validate:** Annotations hide instantly; toggle is reversible.

---

## Validation

1. **Static:** Bundle size delta ≤ 30KB gz after additions (smaller than original Phase 5 estimate since multi-DS + layers + inspector all moved out).
2. **Functional:** Manual scenario through draw tools (pen-circle-arrow-eraser).
3. **Cross-platform scenario:** `scenario-runner` for `canvas-annotations` (web-desktop).
4. **A11y:** `a11y-auditor` against draw toolbar (keyboard reachable; clear focus indicators).

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-annotations` | Pen-circle an element → reload → annotation persists; toggle off for clean view; Shift+P enters presentation mode | 🆕 new |

---

## Acceptance criteria

- [x] Draw / annotation tools persist to `.annotations.svg`; eraser works; toggle visible.
- [x] All draw-tool keyboard shortcuts work (B/R/A/E/V/Esc/Cmd+/).
- [x] Presentation-mode toggle (Shift+P) hides annotations without persisting.
- [ ] No regression in Phase 4 canvas v2 perf benchmark. _(deferred to `/done` validation — perf harness lives at `dev-server/examples/perf-100-artboards.tsx`)_
- [x] Multi-DS, layers, in-canvas CSS editor explicitly NOT in this phase (tracked in `design-system-init.md` Phase 4 + Phase 12 respectively).

---

## Execution log (2026-05-19, /flow:execute)

- ✅ Task 1: input-router.tsx — Tool union extended with pen/rect/arrow/eraser + `isAnnotationTool()` helper; keydown classify maps B/R/A/E to tool actions; pointer events return no-op for annotation tools (Cmd+click escape hatch preserved).
- ✅ Task 2: use-tool-mode.tsx — DEFAULT_TOOLS grew to 7 (V/H/C/B/R/A/E); canvas-shell `data-active-tool` cursor CSS covers pen/rect/arrow=crosshair, eraser=cell.
- ✅ Task 3: api.ts + http.ts — `loadAnnotations()` / `saveAnnotations()` write `<designRoot>/<slug>.annotations.svg`; `/_api/annotations` GET ?file= → SVG text, PUT body { file, svg } → 204. 1 MB body cap; rejects non-SVG content.
- ✅ Task 4: new `annotations-layer.tsx` (~640 LOC) — SVG overlay with world-coord stroke storage, viewport-transformed render via `<g transform>`, vector-effect=non-scaling-stroke so strokes stay pixel-thick across zoom. Pen / rect / arrow capture, eraser hit-test on click+drag, 6-swatch color picker, Shift+P presentation toggle, Cmd+/ help sheet. Debounced 200 ms PUT on stroke commit.
- ✅ Task 5: canvas-shell.tsx — `<AnnotationsLayer/>` mounted before ToolPalette in CanvasRouter so the SVG sits under the floating chrome but over the world.
- ✅ Task 6: tests added — `test/annotations-layer.test.ts` (helpers: penPathD, arrowHeadPoints, strokesToSvg, strokeHitTest per shape, escape) + `test/annotations-api.test.ts` (GET/PUT round-trip, 400/405 gates, 1 MB body cap) + extensions to `test/input-router.test.ts` (B/R/A/E + annotation-tool pointer no-op + Cmd+click escape hatch) + `test/use-tool-mode.test.tsx` (7-tool DEFAULT_TOOLS). `bun test` 269/269 pass (+30 new). `bunx tsc --noEmit` clean (two pre-existing api.ts errors unchanged).

**Files added:**
- `plugins/design/dev-server/annotations-layer.tsx`
- `plugins/design/dev-server/test/annotations-layer.test.ts`
- `plugins/design/dev-server/test/annotations-api.test.ts`

**Files modified:**
- `plugins/design/dev-server/input-router.tsx`
- `plugins/design/dev-server/use-tool-mode.tsx`
- `plugins/design/dev-server/canvas-shell.tsx`
- `plugins/design/dev-server/api.ts`
- `plugins/design/dev-server/http.ts`
- `plugins/design/dev-server/test/input-router.test.ts`
- `plugins/design/dev-server/test/use-tool-mode.test.tsx`

**Scenario coverage gap:** `canvas-annotations` scenario not yet authored — flag for `/flow:scenario new canvas-annotations` before `/flow:done`.
