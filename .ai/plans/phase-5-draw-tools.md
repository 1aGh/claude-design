# Phase 5: Draw / annotation tools for the dev server

> **Scope-narrowed 2026-05-13.** Originally this phase bundled layers panel + in-canvas CSS editor + draw tools + multi-DS. Layers panel + in-canvas CSS editor were extracted to **Phase 12** (end-of-roadmap extra feature). Multi-DS was folded into [`.ai/plans/design-system-init.md`](./design-system-init.md) as its Phase 4, since it shares the same `system/` shape and completeness contract as the single-DS bootstrap workflow.
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

- [ ] Draw / annotation tools persist to `.annotations.svg`; eraser works; toggle visible.
- [ ] All draw-tool keyboard shortcuts work (B/R/A/E/V/Esc/Cmd+/).
- [ ] Presentation-mode toggle (Shift+P) hides annotations without persisting.
- [ ] No regression in Phase 4 canvas v2 perf benchmark.
- [ ] Multi-DS, layers, in-canvas CSS editor explicitly NOT in this phase (tracked in `design-system-init.md` Phase 4 + Phase 12 respectively).
