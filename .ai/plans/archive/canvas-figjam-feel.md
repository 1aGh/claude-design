# Feature: Canvas viewport — FigJam-grade direct-manipulation feel

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Revision Log

- **2026-05-26 (rev 1)** — Initial plan, 22 tasks split into Wave 1 (visual identity, T1–T12) + Wave 2 (behavioral, T13–T22). [DDR-046](.ai/decisions/DDR-046-canvas-chrome-three-state-halo-language.md) drafted.
- **2026-05-26 (rev 2 — current)** — Wave 1 executed and reviewed by user. **9 new grievances** + **3 second-order issues** surfaced post-screenshot. Plan restructured:
  - Tasks 1–12 ✅ done.
  - Tasks 13–22 OBSOLETED / merged. The original Wave-2 backbone (drag-threshold, marquee, cursor state machine, keyboard, ContextualToolbar, LOD, delta-clamp, zoom-easing) moves to **Wave 3** (renumbered T25–T33).
  - **New Wave 2** (T13–T24) addresses user grievances + critic recommendations: delete brand watermark (G9), quiet artboard frame (G7), multi-select chrome overhaul (G1), annotation halo parity (G3), draw auto-select (G2), stroke weight on shapes (G5), per-tool cursors (G6), annotation resize handles (G4), multi-artboard select/distribute (G8), collapse overloaded annotation toolbar (G_S1). DDR-046 also gets corrected — dashed is canonical group-container signal, not "reserved for none".
  - Inputs to rev 2: `design-critic` follow-up report ([agent ad2ed089dffec374c — JSON verdict inline](#)) + `ux-research-agent` payload at `.design/_history/_system/maude-canvas-4d4b0f9f-domain-research-ux-patterns.json` (17 queries, FigJam Section vs Figma Frame canonical patterns, tldraw STROKE_SIZES, FigJam color-preview-attached-to-cursor, Excalidraw resize anti-patterns).

## Description

Polish the Maude dev-server canvas viewport so direct manipulation (select, hover, snap, marquee, pan/zoom, floating chrome) reads as a professional FigJam-class app instead of "school-project tier wireframe". The backbone is already shipped (Phase 4 infinite canvas + multi-selection + snap math + inspector + annotations). What's missing is the **feel layer**: confident selection chrome with corner ticks, distance-pill snap callouts, animated guide spawn, marquee selection, modifier-aware cursors, brand wordmark in the world, ambient-shadow floating chrome, and the small numeric defaults (4 px drag threshold, 16 × 16 hit zones, 80 ms toolbar fade) that separate pro from amateur.

## User Story

As the Maude user (single developer iterating on TSX canvases), I want the canvas viewport to feel like a polished pro tool — selection lands confidently, snap guides tell me HOW MUCH not just WHERE, drag thresholds prevent micro-jitter clicks, modifier keys mutate behavior live, and floating chrome stays out of the way until I select something — so iteration feels fast and pleasant rather than fighting a thin outline + an anemic accent line.

## Problem

Today the canvas has the right scaffolding but the visual + behavioral layer collapses 8+ semantic states (hover, selected, group bbox, snap, marquee, mini-map viewport, annotation-selected, lock-banner) into one undifferentiated `2px solid var(--accent)` line. The Maude DS brutalist language (border-radius 0, hard 4 × 4 × 0 offset shadows, full-bleed accent solids) was correctly applied to the app shell but copy-pasted onto the **interaction surface** where FigJam earns polish via dual-stroke contrast, tinted active states, animated fade-in, distance pills, and softer ambient shadows.

Concrete gaps (from `design-critic` + `graphic-design-critic` + `ux-research-agent` reports — cited inline below):

1. Selection halo is a generic outline — the spec's signature 8 × 8 corner ticks aren't rendered (`canvas-shell.tsx:86-89`).
2. Snap guides render as 1 px hairlines, same color as selection, no fade, no distance pill, no merge-flash (`canvas-lib.tsx:1424-1466`). The distance pill is THE differentiator between pro and amateur tools.
3. No marquee selection — drag from empty canvas does nothing.
4. No equal-spacing smart guides (Figma's pink pills between distributed siblings — Rasmus Andersson 2018).
5. Active-artboard ring at `0 0 0 1px color-mix(--accent 40%)` is imperceptible inside the louder 6 px hard shadow (`canvas-shell.tsx:105-109`).
6. Mini-map artboards at `rgba(0,0,0,0.06)` invisible; viewport indicator unfilled.
7. Floating chrome (tool palette + mini-map + zoom HUD) all wear identical 4 × 4 × 0 brutalist shadows — fights the floating paradigm.
8. Tool palette + mini-map collide in same bottom band (L-shape at 1280, crowding at 1024).
9. Brand wordmark missing from live canvas world (spec requires ≥ 40 px top-left).
10. No per-direction resize cursors, no Alt-drag-copy cursor, no live modifier-driven cursor mutation.
11. Drag threshold not enforced — every click micro-jitters.
12. No selection-anchored floating toolbar (Figma/FigJam/Whimsical core affordance).
13. No keyboard nudge / duplicate-with-offset-memory / Alt-drag-duplicate.
14. No LOD — at zoom < 0.35 the canvas renders text shadows and fine strokes that should drop.

## Solution

Two-wave refactor of the chrome + interaction layer of `plugins/design/dev-server/`. Backbone (canvas-lib viewport controller, selection set, snap math, inspector, annotations) stays untouched — we add a `--guide-magenta` token, extend `SnapGuide` with `delta`, refactor `HALO_CSS` into a 3-state language, and **add new floating overlays** for marquee, contextual toolbar, distance pills, equal-spacing pink dots.

**Wave 1 (visual identity)** — pure CSS + small overlay refactors. Visible to the user as "canvas suddenly looks like a real tool":
- Three-state halo language with corner ticks (spec compliance)
- Snap-guide visual upgrade (2 px width, glow, magenta token, fade-in / out, distance pill)
- Active-artboard ring outside drop-shadow with 120 ms transition
- Mini-map artboard + viewport-indicator polish
- Floating chrome ambient-shadow refactor (drop brutalist, adopt soft ambient)
- Brand wordmark in canvas world (≥ 40 px top-left)

**Wave 2 (behavioral discipline)** — input router + new affordances:
- 4 px drag threshold (`input-router.tsx`)
- Marquee selection (new overlay + router branch + modifier-mode switching)
- Equal-spacing pink-pill smart guides (new detector in `use-snap-guides.tsx`)
- Per-direction resize cursors + Alt-drag copy cursor (state machine in router)
- Keyboard discipline (arrow nudge, Cmd+D with offset memory, Cmd+A, Esc consolidation)
- Selection-anchored floating contextual toolbar
- LOD (`<= 0.35` zoom drops handles + heavy effects)
- Delta-clamped wheel + trackpad parity

## Metadata

- **GitHub Issue**: — (no issue filed; ad-hoc polish pass requested in chat)
- **Type**: Enhancement
- **Complexity**: High
- **App/Package**: `plugins/design/dev-server/` (single-package, multi-file refactor — single source per [DDR-025](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md))
- **Affected Systems**: canvas-shell, canvas-lib (SnapGuideOverlay), use-snap-guides, input-router, tool-palette, annotations-layer, client styles
- **Dependencies**: existing — none new (Bun-side per [DDR-009](.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md))

---

## Context References

### Must-Read Files (source of truth)

- `plugins/design/dev-server/canvas-shell.tsx` — current halo CSS + selection/group bbox overlays. Lines 72-137 (`HALO_CSS`), 657-714 (`SelectionHalos`), 716-771 (`GroupBbox`), 612-651 (`HoverHalo`).
- `plugins/design/dev-server/canvas-lib.tsx` — viewport controller + `SnapGuideOverlay` (lines 1413-1471) + mini-map + zoom HUD (`OVERLAY_CSS` 1487-1562) + `ENGINE_CSS` (105-189, dot grid).
- `plugins/design/dev-server/use-snap-guides.tsx` — pure snap math, `Rect` / `SnapGuide` / `SnapResult` / `computeSnap` (215 lines). **`SnapGuide` will be extended with `delta`** here.
- `plugins/design/dev-server/use-selection-set.tsx` — multi-selection store (provider + dedupe + wire-shape helpers).
- `plugins/design/dev-server/input-router.tsx` — pointer event routing for hover / select / context-menu / tool grammar.
- `plugins/design/dev-server/inspect.ts` — hover-target resolver, `data-cd-id` anchor lookup.
- `plugins/design/dev-server/annotations-layer.tsx` (1715 lines) — annotation chrome; reference for "how heavy overlays render currently".
- `plugins/design/dev-server/tool-palette.tsx` — bottom-center palette CSS (lines 28-133 in critic report).
- `plugins/design/dev-server/client/styles/3-shell.css` (876-896 — duplicate `.sel-halo` def to reconcile) and `4-components.css`.
- `.design/ui/Canvas Viewport.tsx` + `.design/ui/Canvas Viewport.css` — spec / aspiration. Lines 177-193 (`.sel-halo` with corner ticks), 152-174 (`.wm` wordmark), 97-120 (mini-map), 123-149 (zoom toolbar).

### Critic & research reports (read all three before starting)

- **UX research cache** — `.design/_history/_system/maude-canvas-43c3f11b-domain-research-ux-patterns.json`. The `synthesized_pattern_reference` block has numeric values for every interaction moment. **Required reading.**
- **Design critic** — `.design/_history/canvas-viewport/critique/001-design-critic.md` (14 blockers, 11 warnings, top-3 spelled out: halo language, snap pill, mini-map / brutalist-shadow chrome).
- **Graphic-design critic** — inline in this session's agent output (5 blockers, 8 warnings: wordmark missing, corner ticks missing, mini-map collision, anemic snap, imperceptible active ring).

### Files to Create

- `plugins/design/dev-server/marquee-overlay.tsx` — `MarqueeOverlay` floating rect + selection-pending overlay during marquee drag.
- `plugins/design/dev-server/contextual-toolbar.tsx` — `ContextualToolbar` selection-anchored chrome (top-of-selection, 80 ms fade, position-tween between selections).
- `plugins/design/dev-server/use-keyboard-discipline.tsx` — arrow nudge + Cmd+D with offset memory + Cmd+A + Esc consolidation hook.
- `plugins/design/dev-server/equal-spacing-detector.ts` — pure function: given 3+ siblings on an axis, returns pink-pill positions + distance label.
- `plugins/design/dev-server/__tests__/snap-distance-pill.test.ts` — new bun-test fixture for `SnapGuide.delta` and equal-spacing detector.
- `.ai/decisions/DDR-046-canvas-chrome-three-state-halo-language.md` — locks the 3-state halo contract (hover 1.5 px tinted, selected 2 px + ring + ticks, group 1 px solid). Prevents future drift back to the "one-line-fits-all" pattern.

### Documentation

- [Figma — Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) — Why: canonical multi-select semantics; mixed-type chrome contract.
- [tldraw — selection-color-condition](https://tldraw.dev/examples/selection-color-condition) — Why: CSS-var public surface for selection theming (`--color-selection`).
- [tldraw — performance docs (LOD)](https://tldraw.dev/sdk-features/performance) — Why: documented `textShadowLod = 0.35` threshold — our LOD anchor.
- [Figma Blog — Smart Selection (Rasmus Andersson 2018)](https://medium.com/figma-design/introducing-smart-selection-51f6ca7a817b) — Why: pink-pill distributed-spacing affordance math + behavior.
- [Excalidraw issue #250 — cursor states](https://github.com/excalidraw/excalidraw/issues/250) — Why: cursor-on-hover-not-drag-start canonical complaint.
- [Aseprite — selecting docs](https://www.aseprite.org/docs/selecting/) — Why: cleanest marquee-modifier vocabulary (Shift add / Alt subtract / Shift+Alt intersect).
- [Microsoft — Win32 mouse drag threshold](https://learn.microsoft.com/en-us/windows/win32/learnwin32/other-mouse-operations) — Why: 4 px canonical drag threshold source.
- [tigerabrodi.blog — Trackpad pinch vs scroll](https://tigerabrodi.blog/how-to-handle-trackpad-pinch-to-zoom-vs-two-finger-scroll-in-javascript-canvas-apps) — Why: `event.ctrlKey === true` discriminator + delta-clamp recipe.

### Patterns to Follow

**Screen-space chrome math** (from existing `HoverHalo` in `canvas-shell.tsx:612-651`):
```ts
const tick = () => {
  rafRef.current = null;
  const r = (t as HTMLElement).getBoundingClientRect();
  div.style.left = `${Math.round(r.left)}px`;
  div.style.top = `${Math.round(r.top)}px`;
  // ... rAF loop, fixed-position overlay sibling of canvas
};
```
Every new floating overlay (marquee, contextual toolbar, distance pills, equal-spacing handles) follows this exact recipe — `position: fixed`, `pointer-events: none`, `rAF`-driven `getBoundingClientRect()` reads.

**SnapGuide extension** (from `use-snap-guides.tsx:43-50`):
```ts
// Today:
export interface SnapGuide { axis: SnapAxis; pos: number; from: number; to: number; }
// After Task 4 (additive — back-compat):
export interface SnapGuide {
  axis: SnapAxis; pos: number; from: number; to: number;
  /** Signed pixel delta the snap corrected. Render as a `Δ34` mid-span pill when |delta| > 0. */
  delta?: number;
  /** Source kind — `grid` paints lighter (40% opacity gray), `sibling` full magenta. */
  kind?: 'grid' | 'sibling';
}
```
Then `computeSnap` populates `delta = winX.delta` and `kind` per candidate. `SnapGuideOverlay` reads both fields to render the pill + select color.

**Three-state halo language** (target shape — DDR-046 contract):
```css
/* Hover: light, no ring, no ticks. 1.5px tinted line. */
.dc-cv-halo--hover {
  border: 1.5px solid color-mix(in oklab, var(--accent) 60%, transparent);
  box-shadow: inset 0 0 0 1px var(--bg-0);          /* white inner for dark elements */
}
/* Selected: 2px solid + 18% ring halo + 4 corner ticks. */
.dc-cv-halo--selected {
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent);
}
.dc-cv-halo--selected::before, .dc-cv-halo--selected::after,
.dc-cv-halo--selected > .tick-bl, .dc-cv-halo--selected > .tick-br {
  /* 8×8 filled accent corner ticks at inset: -3px */
}
/* Group bbox: 1px solid (NOT dashed — dashed reserved for marquee). */
.dc-cv-group-bbox {
  border: 1px solid color-mix(in oklab, var(--accent) 50%, transparent);
}
/* Marquee: 1px solid + 8% fill — different visual idiom from selection. */
.dc-cv-marquee {
  border: 1px solid var(--accent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
}
```

**Spec wordmark** (port verbatim from `.design/ui/Canvas Viewport.css:152-174`):
```css
.dc-canvas-brand {
  position: absolute; top: 20px; left: 28px;
  font-family: var(--font-display); font-size: 40px; font-weight: 700;
  letter-spacing: -0.02em; color: var(--fg-0); opacity: 0.92; z-index: 4;
  transition: opacity 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dc-canvas-brand--faded { opacity: 0.35; }  /* once user pans/zooms past initial fit */
.dc-canvas-brand-sub {
  margin-top: 10px; font-size: 11px; font-family: var(--font-mono);
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-2);
}
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `SelectionHalos` | `plugins/design/dev-server/canvas-shell.tsx:657-714` | Extend in place: add corner ticks, restructure halo into `.tick-tl/.tick-tr/.tick-bl/.tick-br` inner spans. |
| `GroupBbox` | `plugins/design/dev-server/canvas-shell.tsx:716-771` | Switch border from dashed → solid 1 px (dashed reserved for marquee per DDR-046). |
| `HoverHalo` | `plugins/design/dev-server/canvas-shell.tsx:612-651` | Drop 2 px / 85 % style; new class `.dc-cv-halo--hover` per three-state contract. |
| `SnapGuideOverlay` | `plugins/design/dev-server/canvas-lib.tsx:1413-1471` | Add distance-pill rendering + spawn-fade + `kind`-aware color selection. |
| `ToolPalette` | `plugins/design/dev-server/tool-palette.tsx` | Demote shadow + active-state to 14% tint + 2 px underbar. Reposition to dock differently from mini-map (see Task 13). |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Mini-map | `canvas-lib.tsx:1487-1562` | Restyle: `--bg-0` body, brighter artboard tones, filled viewport indicator, ambient shadow. |
| Zoom HUD | `canvas-lib.tsx:OVERLAY_CSS` | Same shadow refactor; demote vs mini-map (less weight). |
| Brand wordmark | `.design/ui/Canvas Viewport.css:152-174` | **Port the CSS verbatim** — spec is the contract. Add component in `canvas-shell.tsx` as sibling of `<ToolPalette />`. |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| `Maximize2` / `Move` / `MousePointer2` | Lucide (already in repo) | 16 | Resize cursor fallback if CSS `cursor` can't reach (very edge case — usually CSS native cursors suffice). |
| no new glyphs | — | — | Tool palette already has its full icon set. |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Snap guide color (sibling alignment) | `--guide-magenta` (NEW) | Default `oklch(62% 0.28 350)` (FigJam magenta in our OKLCH space). Distinct from `--accent` so the snap layer never melts into selection. |
| Snap guide color (grid fallback) | `color-mix(in oklab, var(--fg-3) 40%, transparent)` | Lighter gray — grid is fallback when no sibling. |
| Selection halo ring tint | `color-mix(in oklab, var(--accent) 18%, transparent)` | Existing pattern (`canvas-shell.tsx:88`), keep. |
| Hover halo color | `color-mix(in oklab, var(--accent) 60%, transparent)` | 1.5 px tinted line per DDR-046. |
| Group bbox color | `color-mix(in oklab, var(--accent) 50%, transparent)` | 1 px solid — separates visually from selection (100% accent). |
| Active-tool tint | `color-mix(in oklab, var(--accent) 14%, transparent)` | Background; pair with `border-bottom: 2px solid var(--accent)` underbar + `color: var(--accent)` fg. |
| Floating chrome ambient shadow | `0 6px 24px color-mix(in oklab, var(--fg-0) 10%, transparent)` | Replaces brutalist `4px 4px 0 var(--fg-0)` for all floating overlays (tool palette, mini-map, zoom HUD, contextual toolbar, popovers). |
| Floating chrome radius | `8px` | Replaces brutalist `border-radius: 0`. App shell chrome (menubar etc.) keeps 0 — the floating layer is the exception. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `MarqueeOverlay` | No marquee selection today. | New — fixed-position overlay sibling of `SelectionHalos`. |
| `ContextualToolbar` | No selection-anchored floating toolbar. | New — anchored 12 px above selection AABB, flip below if `< 60 px` headroom. |
| `DistancePill` | Render mid-span numeric callout on each `SnapGuide`. | New — child of `SnapGuideOverlay`. |
| `EqualSpacingHandles` | Pink dots between distributed siblings (Figma smart selection). | New — separate overlay; consumes `equal-spacing-detector.ts`. |
| `BrandWordmark` | Spec requires ≥ 40 px brand mark; missing from live canvas. | New — child of `CanvasRouter` in `canvas-shell.tsx`. |

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR.

> **Wave 1 — visual identity (Tasks 1-12).** Pure CSS + small overlay refactor. Visible win.
> **Wave 2 — behavioral discipline (Tasks 13-22).** Input router + new affordances.
> Each task ends with a screenshot validation against the spec canvas (`/design:screenshot --canvas "Canvas Viewport"`) and visual diff against `.design/ui/Canvas Viewport.tsx` artboards CV-01..CV-10.

---

### Task 1: ADD DDR-046 — canvas-chrome three-state halo language

- **Do**: Write `.ai/decisions/DDR-046-canvas-chrome-three-state-halo-language.md`. Locks the contract: hover = 1.5 px tinted + white-inset ring, selected = 2 px + 18 % ring + 4 corner ticks, group = 1 px solid (NOT dashed — dashed reserved for marquee), marquee = 1 px solid + 8 % fill. Reference [DDR-025](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md) for the canvas-shell single-source rule.
- **Pattern**: Mirror DDR-026 (`universal-canvas-input-grammar`) — short contract + the 4 visual states tabulated + 1 paragraph rationale (8+ overlapping semantic states must be visually distinguishable).
- **Gotcha**: List the four states + the marquee state as a fifth. Cross-link from `canvas-shell.tsx` `HALO_CSS` comment.
- **Validate**: `grep -l "DDR-046" .ai/decisions/` returns the file; `grep "DDR-046" plugins/design/dev-server/canvas-shell.tsx` cross-links present.

### Task 2: REFACTOR `HALO_CSS` in `canvas-shell.tsx` to the three-state language

- **Do**: Rewrite the `HALO_CSS` template literal (lines 72-137). New rules:
  - `.dc-cv-halo--hover`: `border: 1.5px solid color-mix(in oklab, var(--accent) 60%, transparent); box-shadow: inset 0 0 0 1px var(--bg-0);` (white inner ring for contrast on dark elements). Remove `opacity: 0.85` — already conveyed by tint.
  - `.dc-cv-halo--selected`: keep `border: 2px solid var(--accent)` + `box-shadow: 0 0 0 4px color-mix(...18%, transparent)`. Add four absolutely-positioned `<i class="tick tick-tl/tl/bl/br" />` children: `8 × 8`, `background: var(--accent)`, `inset: -3px` per corner.
  - `.dc-cv-group-bbox`: change `border: 1px dashed` → `border: 1px solid color-mix(in oklab, var(--accent) 50%, transparent)`. Drop `opacity: 0.85`.
  - Add CSS-var fallback chain: `var(--accent, #0d99ff)` (FigJam blue default, falling through to themed accent token).
- **Pattern**: Existing `HALO_CSS` style block (lines 72-137) — keep the same template-literal + `ensureHaloStyles()` injection mechanism.
- **Gotcha**: `SelectionHalos` builds halos via `document.createElement('div')` (lines 673-678) — add 4 `<i>` children with the tick classes inside each `.dc-cv-halo--selected` node so CSS positioning works without restructuring the render loop.
- **Validate**: Boot `/design:browse`, select an artboard, screenshot via `/design:screenshot --selector ".dc-cv-halo--selected"`. Compare to `.design/ui/Canvas Viewport.tsx` CV-04 artboard (single-selection state).

### Task 3: UPDATE `SelectionHalos` render to include corner-tick inner children

- **Do**: In `canvas-shell.tsx:673-678`, when creating a new halo `<div>`, also append four `<i>` children with classes `tick tick-tl`, `tick tick-tr`, `tick tick-bl`, `tick tick-br`. Suppress tick rendering when the selection set has `length > 1` (per pattern-multi-selection-bounding from research — multi-select shows union bbox handles only, individual elements get 1 px tinted outline, no per-element ticks).
- **Pattern**: Same `while (c.children.length < selected.length)` loop, just create a richer node tree.
- **Gotcha**: At `selected.length === 1` show full ticks; at `selected.length > 1` swap halo class to `.dc-cv-halo--selected-member` (1 px tinted, no ticks) and only the `GroupBbox` carries the bold treatment + corner ticks.
- **Validate**: Multi-select two elements via Cmd+Shift+Click — screenshot shows thin tinted outlines per member + bold group bbox with corner ticks. Single-select → full halo + ticks.

### Task 4: EXTEND `SnapGuide` interface with `delta` and `kind` fields

- **Do**: In `use-snap-guides.tsx:43-50`, add `delta?: number` and `kind?: 'grid' | 'sibling'` (optional — back-compat). In `computeSnap` (lines 119-215), populate `delta = winX.delta` / `winY.delta` on each emitted guide, and tag `kind` based on whether the winning candidate came from `nearestGridDelta` (grid) or the sibling loop (sibling). Re-export `SnapGuide` type unchanged.
- **Pattern**: Pure-function purity is load-bearing here ([DDR-028](.ai/decisions/DDR-028-snap-tolerance-in-world-units.md)) — `computeSnap` stays no-React, no-DOM. Tag the candidate's `kind` by tracking source in the existing `xCands` / `yCands` arrays (add a `kind` field to `AxisCandidate` at line 71-79).
- **Gotcha**: `mergeAtPos` (line 108) merges multiple sibling candidates at the same `pos` — preserve the first candidate's `kind` and use the maximum `|delta|` among merged candidates (the pill should show the worst-case correction, not average).
- **Validate**: Write `plugins/design/dev-server/__tests__/snap-distance-pill.test.ts` with bun:test:
  ```ts
  test('grid snap emits delta and kind=grid', () => {
    const r = computeSnap({x: 33, y: 0, w: 100, h: 100}, [], {gridSize: 40, tolerance: 8, disabled: false});
    expect(r.guides[0]?.delta).toBe(7);   // 40 - 33
    expect(r.guides[0]?.kind).toBe('grid');
  });
  test('sibling snap beats grid when both fire', () => {
    const r = computeSnap({x: 37, y: 0, w: 100, h: 100}, [{x: 35, y: 0, w: 50, h: 50}], {gridSize: 40, tolerance: 8, disabled: false});
    expect(r.guides[0]?.kind).toBe('sibling');  // closer delta wins
  });
  ```
  Run via `bun test plugins/design/dev-server/__tests__/snap-distance-pill.test.ts`.

### Task 5: ADD `--guide-magenta` design token + UPDATE `SnapGuideOverlay` color routing

- **Do**: In `plugins/design/dev-server/canvas-lib.tsx` `ENGINE_CSS` block (lines 105-189), add `--guide-magenta: oklch(62% 0.28 350);` to `:root` / `.dc-canvas`. In `SnapGuideOverlay` render (lines 1424-1466), switch line `background` based on `guide.kind`:
  - `kind === 'sibling'`: `background: var(--guide-magenta)` + `box-shadow: 0 0 4px color-mix(in oklab, var(--guide-magenta) 35%, transparent)`.
  - `kind === 'grid'`: `background: color-mix(in oklab, var(--fg-3) 40%, transparent)` + no glow.
  - Both: `width: 2px` (vertical guide) / `height: 2px` (horizontal) — up from the current 1 px.
- **Pattern**: Match `--accent` declaration site in `ENGINE_CSS` — same place, same `:root` cascade order.
- **Gotcha**: Some downstream `.design` projects override `--accent` but won't have `--guide-magenta` — provide the fallback in the same declaration: `var(--guide-magenta, oklch(62% 0.28 350))`.
- **Validate**: Drag an artboard near a sibling — visual confirms 2 px magenta confident line with soft glow, distinct from the orange/red selection halo.

### Task 6: ADD `DistancePill` rendering inside `SnapGuideOverlay`

- **Do**: For each emitted `SnapGuide` where `|delta| > 0`, render a pill at the midpoint of the guide's `from..to` span on the perpendicular axis. Pill: absolutely positioned at `pos = (from + to) / 2` (centered on guide), `font-size: 11px`, `font-family: var(--font-mono)`, `padding: 2px 6px`, `background: var(--guide-magenta)`, `color: white`, `border-radius: 2px`, `text-content: Δ{Math.round(delta)}` (e.g. `Δ34`). `pointer-events: none`. Hide pill when guide length `< 60 px` in screen-space (it'd overlap the line).
- **Pattern**: Same screen-space `position: fixed` overlay sibling as `HoverHalo` — fixed-position, rAF-driven.
- **Gotcha**: Pill rotates 90° on Y-axis guides? Test both — vertical guides usually fit a horizontal pill at the midpoint; only flip if pill width > guide perpendicular span.
- **Validate**: Drag an artboard so it snaps to a sibling 34 px away — pill reads `Δ34`. The single biggest visible upgrade in the whole plan.

### Task 7: ADD spawn-fade animation to snap guides

- **Do**: In `SnapGuideOverlay` overlay CSS, add `@keyframes snap-spawn { from { opacity: 0; transform: scaleY(0.92); } to { opacity: 1; transform: scaleY(1); } }` and apply `animation: snap-spawn 80ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards` on guide mount. On unmount (drag-end), fade-out via `opacity 1→0` over 160 ms ease-out.
- **Pattern**: Match existing `transition: opacity 60ms linear` on `.dc-cv-halo` (line 80) — same easing family, just longer + composited.
- **Gotcha**: rAF-driven overlay vs CSS keyframe interplay — append guide nodes via `appendChild` so the keyframe runs on mount; tag the removed node with a class that triggers the fade-out keyframe, then `setTimeout(removeChild, 160)`.
- **Validate**: Slow-mo screen-recording (or `prefers-reduced-motion` toggle test) shows guide appearing with a subtle scale + fade-in. **Honor `prefers-reduced-motion`**: collapse all animation to 1 ms per `motion-rules` skill.

### Task 8: ADD `--bg-0` mini-map body + filled viewport indicator + ambient shadow

- **Do**: In `canvas-lib.tsx:1488-1562` (`OVERLAY_CSS`):
  - `.dc-mm`: `background: var(--bg-0)` (paper-white, not `--bg-2`). `border-radius: 8px`. `box-shadow: 0 6px 24px color-mix(in oklab, var(--fg-0) 10%, transparent)`. Drop the brutalist `4px 4px 0 var(--fg-0)`.
  - `.dc-mm-artboard`: bump fill from `rgba(0,0,0,0.06)` → `color-mix(in oklab, var(--fg-0) 14%, transparent)` so artboards read against the bg.
  - `.dc-mm-viewport`: change from outline-only → `background: color-mix(in oklab, var(--accent) 12%, transparent); border: 1.5px solid var(--accent)`. Filled viewport indicator is what FigJam/Figma both ship.
- **Pattern**: Same `OVERLAY_CSS` template literal, same selector names — just style values change.
- **Gotcha**: Mini-map currently positioned `right: 16px; bottom: 16px`. Keep position unchanged here — repositioning logic moves to Task 13.
- **Validate**: Pan around — viewport indicator clearly visible as a tinted rectangle; artboards readable.

### Task 9: REFACTOR floating chrome (tool palette + zoom HUD + popovers) — drop brutalist shadow

- **Do**: Find every `box-shadow: 4px 4px 0 var(--fg-0)` in `plugins/design/dev-server/**/*.{tsx,ts,css}` (grep). For each occurrence on a FLOATING chrome element (mini-map, tool palette, zoom HUD, contextual toolbar, popovers, export dialog, comment composer), replace with `box-shadow: 0 6px 24px color-mix(in oklab, var(--fg-0) 10%, transparent)` and bump `border-radius: 0` → `border-radius: 8px`. **Exception**: keep brutalist 0-radius + hard-offset on the **app shell** (menubar, header, tab strip, file tree) — that's the project's deliberate brutalist identity per `.design` config.
- **Pattern**: Floating-vs-shell distinction maps to z-index families: floating = `z-index: 5..6`, shell = `z-index: 100+`.
- **Gotcha**: The shell `.sel-halo` definition in `client/styles/3-shell.css:872-896` is a DUPLICATE of `canvas-shell.tsx` `HALO_CSS`. Per the design-critic report, reconcile to ONE source — delete the shell CSS def (canvas-shell.tsx injects via `ensureHaloStyles`).
- **Validate**: Visual diff `/design:screenshot --full` vs `.design/ui/Canvas Viewport.tsx` CV-01 — mini-map / zoom HUD / tool palette read as soft-floating cards, not stamped brutalist tiles.

### Task 10: REFACTOR `ToolPalette` active-tool button — tinted + underbar

- **Do**: In `tool-palette.tsx` (lines 80-83 per critic report), change active-tool button from `background: var(--accent); color: var(--bg-0)` (full accent flood) → `background: color-mix(in oklab, var(--accent) 14%, transparent); border-bottom: 2px solid var(--accent); color: var(--accent)`. Same change in any hover state — keep hover subtler (8 % tint, no underbar).
- **Pattern**: 14 % tint + accent underbar is the FigJam / Figma toolbar active idiom.
- **Gotcha**: A11y contrast: text-on-accent at 100 % accent (current) passes WCAG AA, but accent-on-bg-0 (new) needs the user's `--accent` to clear 4.5:1 against `--bg-0`. The setup-ds quality gate already enforces this via `feedback-design-token-discipline` — verify with the a11y critic in validation.
- **Validate**: Active tool reads as confident-but-quiet; FigJam screenshot comparison (when user supplies).

### Task 11: ADD active-artboard ring OUTSIDE the drop-shadow

- **Do**: In `canvas-shell.tsx:105-109`, replace the imperceptible `0 0 0 1px color-mix(--accent 40%)` ring with `box-shadow: 0 0 0 3px var(--accent), 6px 6px 0 var(--fg-0, #2a2520)`. Order matters — accent ring first (innermost), hard shadow last (outermost). Add `transition: box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1)` so activation is felt.
- **Pattern**: Stacking multiple `box-shadow` values left→right inner→outer is the standard CSS layer recipe.
- **Gotcha**: The active artboard is determined by pan-settle midpoint; verify the ring transition fires only on `aria-current` change (not on every pan-tick).
- **Validate**: Pan between artboards — ring "snaps to" the new active artboard with a 120 ms ease. Visible at any zoom.

### Task 12: ADD `BrandWordmark` to canvas world (top-left, ≥ 40 px)

- **Do**: In `canvas-shell.tsx` `CanvasRouter` (around line 593-604), add `<BrandWordmark />` sibling. Render: `<div className="dc-canvas-brand"><span className="dc-canvas-brand-mark">maude-design-server</span><div className="dc-canvas-brand-sub">{sku} · v{version} · localhost:{port}</div></div>`. Style per spec (`.design/ui/Canvas Viewport.css:152-174` — port verbatim). Fade to `opacity: 0.35` once the user pans / zooms past initial fit (track via viewport controller `isInitialFit` state).
- **Pattern**: Port spec CSS as-is; the spec IS the contract.
- **Gotcha**: Wordmark is `position: absolute` inside `.dc-canvas`, not `position: fixed` — it lives in the world and stays anchored to canvas origin (pans away with the world). That's per the spec.
- **Validate**: Boot dev-server in empty target — top-left of canvas shows 40 px brand wordmark with mono sub-line. Critic block #1 resolved.

> **End of Wave 1 (rev 1).** 12/12 ✅ — 359/359 bun tests green, manual screenshot confirms wordmark + ambient chrome. User feedback identified 9 grievances; rev 2 restructures the remaining work.

---

> **Wave 2 — User-grievance fixes (Tasks 13–24, rev 2).** Trivial-to-moderate effort, addresses every visible issue from the user's post-Wave-1 review. Ordering is cheapest-first per `design-critic` rev 2 recommendation — each task ships standalone, no cross-task blocking.

### Task 13: REMOVE `BrandWordmark` (Grievance G9 — user explicit reject)

- **Do**: Delete the `BrandWordmark` React component + its mount in `CanvasRouter` + the `.dc-canvas-brand` / `.dc-canvas-brand-mark` / `.dc-canvas-brand-sub` CSS block in `HALO_CSS` (lines added in Task 12). Also drop `:has(.dc-artboard)` empty-state rule. Brand identity already lives in the dev-server menubar above the iframe — that's the right home; canvas surface is the user's, not Maude's.
- **Pattern**: Pure deletion. No peer canvas app (FigJam / Figma / tldraw / Excalidraw / Miro) paints their brand on canvas. Match that.
- **Gotcha**: Watch for any unit test that asserts wordmark presence — none expected, but grep `dc-canvas-brand` across `plugins/design/dev-server/` before deleting CSS to be safe.
- **Validate**: `grep -rn "dc-canvas-brand\|BrandWordmark" plugins/design/dev-server/` returns 0 hits. Boot `/design:browse` → top-left of canvas is empty (just the dot grid). User explicitly confirms.

### Task 14: REVISE DDR-046 — clarify dashed = group-container signal (not "reserved for none")

- **Do**: Edit `.ai/decisions/DDR-046-canvas-chrome-three-state-halo-language.md`. The current contract says "Dashed lines are deliberately NOT used anywhere" and reserves dashed for "transient states only" — that's wrong. Dashed is the canonical **group-container** signal in every direct-manipulation tool (Figma group bbox, FigJam Section drag-state, Photoshop selection "marching ants"). Update DDR-046 to:
  - Mark dashed as the explicit Group bbox idiom.
  - Update the comparison table: `Group bbox` → `1 px dashed var(--accent)` + 6 px square corner handles.
  - Add a row for **Marquee** (`1 px solid + 8% fill` — note: distinct from dashed group bbox in semantic, both "containers" but marquee = active gesture, group = persistent multi-select state).
  - Add a "Why dashed for group, solid for selection" note: dashed = "ambient grouping affordance", solid = "this thing is the active subject".
- **Pattern**: DDR amendment in-place, not a new DDR. The original DDR-046 stands; we're correcting one ill-considered exclusion.
- **Gotcha**: Update the misleading comment in `canvas-shell.tsx:115` (`/* Group bbox: 1px solid (NOT dashed — dashed reserved for marquee). */`) as part of Task 16 — comment, code, and DDR all flip together.
- **Validate**: DDR-046 reads coherently — every state in the table corresponds to a unique geometric idiom. No "reserved for none" language. Cross-link from Task 16's commit message.

### Task 15: QUIET artboard frame — drop brutalist shadow (Grievance G7)

- **Do**: Refactor `.dc-canvas .dc-artboard` in `canvas-lib.tsx:181-189` (`ENGINE_CSS`):
  ```css
  .dc-canvas .dc-artboard {
    background: var(--bg-0, #ffffff);
    color: var(--fg-0, #2a2520);
    border: 1px solid color-mix(in oklab, var(--fg-0, #2a2520) 22%, transparent);
    border-radius: 2px;
    /* NO box-shadow — frame is quiet (per FigJam Section convention) */
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  ```
  Apply same treatment to `.dc-artboard-ghost` (lines 222-229): drop `box-shadow: 6px 6px 0 var(--fg-0)`, swap border to 22 %-tinted, keep `opacity: 0.5`.
  In `canvas-shell.tsx:131-136`, replace the active-artboard ring `box-shadow: 0 0 0 3px var(--accent), 6px 6px 0 var(--fg-0)` with `box-shadow: 0 0 0 2px var(--accent)`. The double-layered ring + hard shadow was readable but visually expensive; a 2 px accent ring around a quiet frame is unambiguous.
- **Pattern**: FigJam Section + Figma Frame canonical — frame chrome is quiet so user content can be loud. The Memphis hard-shadow IS the Maude brand, but it belongs on user-content components inside artboards (where it's identity), not on the frame chrome itself (where it's tax).
- **Gotcha**: Some downstream `.design` projects might have CSS overriding `.dc-artboard` shadow expecting the brutalist treatment — grep `.design/system/*/core/components.css` for `dc-artboard.*box-shadow` and note any conflicts in PR description.
- **Validate**: Boot `/design:browse` → artboards read as quiet paper cards with hairline borders, no aggressive Memphis offset. Active-artboard pop is the 2 px accent ring (visible, not violent). Screenshot side-by-side with Wave 1 PNG at `/tmp/canvas-viewport-wave1.png`.

### Task 16: REFACTOR multi-select chrome (Grievance G1)

- **Do**: In `canvas-shell.tsx` `HALO_CSS`:
  ```css
  /* Member of multi-selection — 1.5px solid 100% accent (drop 50% tint — opacity weakens the signal). */
  .dc-cv-halo--selected-member {
    border: 1.5px solid var(--accent, #0d99ff);
  }
  /* Group bbox — 1px DASHED 100% accent. Dashed = container affordance (DDR-046 amended in Task 14). */
  .dc-cv-group-bbox {
    position: fixed;
    pointer-events: none;
    z-index: 5;
    border: 1px dashed var(--accent, #0d99ff);
    border-radius: 2px;
  }
  ```
  In `GroupBbox` render (`canvas-shell.tsx:716-771`), append 4 `<i class="tick tick-tl/tr/bl/br" />` children to the bbox div with classes from `TICK_CLASSES` array. Add to `HALO_CSS`:
  ```css
  .dc-cv-group-bbox .tick {
    position: absolute;
    width: 6px; height: 6px;
    background: var(--accent, #0d99ff);
    border-radius: 1px;
    box-shadow: 0 0 0 1px var(--bg-0, #ffffff);
  }
  .dc-cv-group-bbox .tick-tl { top: -3px; left: -3px; }
  .dc-cv-group-bbox .tick-tr { top: -3px; right: -3px; }
  .dc-cv-group-bbox .tick-bl { bottom: -3px; left: -3px; }
  .dc-cv-group-bbox .tick-br { bottom: -3px; right: -3px; }
  ```
  Corner handles are 6 × 6 (smaller than selection's 8 × 8) so the group-bbox idiom reads as "thinner / lighter authority" than single-select. Also update the comment at the original `.dc-cv-group-bbox` block per Task 14.
- **Pattern**: Figma + FigJam multi-select language. Members carry full-opacity outline + group bbox carries the resize-handle affordance via corner ticks.
- **Gotcha**: Member outline at 1.5 px solid will read DARKER than the artboard frame after Task 15 (22 %-tinted artboard border) — so members visible inside artboards no longer melt away. Reinforcing change.
- **Validate**: Cmd+click on element A, Cmd+Shift+click on element B → both get 1.5 px solid outlines + group bbox carries 1 px dashed border + 4 small corner ticks. Visually distinct from single-select.

### Task 17: ANNOTATION halo parity with element halo (Grievance G3)

- **Do**: In `annotations-layer.tsx:1507-1532` `SelectionHalo` SVG component:
  - Drop the outer `<rect strokeDasharray={...}>` dashed border. Keep ONE `<rect>` for the inner border, switch to **solid** `strokeWidth={2}`.
  - Add a SECOND `<rect>` underneath as the ring halo: `strokeWidth={4}`, `stroke="color-mix(in oklab, var(--accent) 18%, transparent)"`, `pad = 8` (where the inner rect uses `pad = 4`). The 4 px inset gives breathing room around thin pen strokes.
  - Append 4 absolutely-positioned corner ticks (8 × 8 SVG `<rect>` at the bbox corners, accent fill, 1 px white stroke for halo). Use `vector-effect="non-scaling-stroke"` so they stay constant at zoom.
  - For multi-stroke annotation selection (`annotSel.size > 1`), use the `--selected-member` 1.5 px solid recipe instead — mirror canvas-shell pattern. Render group bbox via a separate dashed `<rect>` enclosing the union of all selected annotation bboxes.
- **Pattern**: One verb = one chrome. Selected = solid 2 px + ring + ticks, whether the target is an element or an annotation. Marquee STAYS dashed (the "marching ants" idiom is universal and correct for active gesture).
- **Gotcha**: The SVG portal lives under `.dc-world` (annotations-layer.tsx). `--accent` token cascades correctly through the world plane — verify by grepping. The 4 px inset ring won't be visible on annotations whose bbox sits flush against an artboard edge — accept this for v1; clip handling is future polish.
- **Validate**: Click on a drawn rect / ellipse / pen stroke → halo matches element halo exactly. Multi-select two annotations → both get 1.5 px outlines + dashed group bbox.

### Task 18: AUTO-SELECT on draw release + auto-flip tool back to Move (Grievance G2)

- **Do**: In `annotations-layer.tsx:923-940` `endStroke`:
  ```ts
  setStrokesState((prev) => [...prev, committed]);
  annotSel?.replace(committed.id);                 // NEW: select the freshly-drawn shape
  if (!stickyToolModeRef.current) setTool('move'); // NEW: flip back to Move tool
  ```
  Pass `setTool` from `useToolMode()` into the `useAnnotations` hook signature. Add an internal `stickyToolModeRef` that defaults to `false`; tracked via a new "tool-lock" UX (Task 21).
- **Pattern**: Canonical across FigJam / Figma / tldraw / Excalidraw / Sketch / Illustrator. Mouseup → commit → select → revert tool. Zero delay, zero animation.
- **Gotcha**: When `isStrokeMeaningful` returns false (the drawn shape is too small — e.g. accidental 1 × 1 click), still revert the tool but DO NOT call `annotSel.replace`. The shape was never committed.
- **Validate**: Switch to rect tool, draw a 200 × 100 rectangle, release → the rect is selected with new halo + Tool palette flips back to Move. Draw another → tool was already Move, so this is a fresh Move-tool gesture (no draw).

### Task 19: ADD sticky-tool double-click lock (research recommendation, supplements Task 18)

- **Do**: In `tool-palette.tsx`, double-click on a draw-tool button (rect / ellipse / arrow / pen) toggles `stickyToolMode` on the global store. When sticky:
  - Tool stays armed after each draw release (overrides Task 18's auto-flip).
  - Render a small lock badge (8 × 8 SVG, accent fill) in the corner of the active tool button, fading in 50 ms after the double-click.
  - Single-click on any other tool clears sticky-mode and flips to that tool.
  - Esc clears sticky-mode + flips to Move.
- **Pattern**: tldraw double-click-to-lock — canonical "sticky tool" UX. Shift-held is NOT the trigger (Shift is reserved for aspect-lock + multi-select extend).
- **Gotcha**: `useToolMode` hook needs a `stickyMode: boolean` state field + a `setSticky(next: boolean)` setter. Persist sticky across tool changes? NO — sticky-mode is a per-tool flag, but single-click on a DIFFERENT tool clears it. So sticky = `(toolId, locked)` tuple.
- **Validate**: Single-click rect → draw → tool flips back to Move (Task 18). Double-click rect → lock badge fades in → draw multiple rects without tool flipping → Esc clears sticky.

### Task 20: STROKE weight on rect + ellipse (Grievance G5)

- **Do**: In `annotations-layer.tsx:656`:
  ```ts
  const supportsThickness = tool === 'pen' || tool === 'arrow' || tool === 'rect' || tool === 'ellipse';
  ```
  At lines 842, 854 (rect + ellipse creation), use `thickness` (the current state value) instead of hardcoded `STROKE_WIDTH_THIN`. Verify `annotations-context-toolbar.tsx` `caps.thickness` evaluation includes rect + ellipse too (search for the caps mapping; broaden if pen/arrow only).
- **Pattern**: FigJam exposes stroke weight on every shape. Stay 2-stop (Thin / Thick) for Wave 2 — adding more stops is a research recommendation but the visible chip pattern already reads as "stroke weight chooser"; numeric expansion comes after the resize handles ship.
- **Gotcha**: Existing drawn rects + ellipses with hardcoded thickness won't retroactively respect the new value — that's correct (don't migrate persisted data; new shapes use the current thickness setting).
- **Validate**: Switch to rect tool, click the Thick chip, draw a rect → rendered with thick border. Select an existing thin rect → toolbar shows Thin selected. Toggle to Thick → re-renders with thick border.

### Task 21: ADD Esc-to-cancel-mid-stroke (Grievance G_S5 from critic)

- **Do**: In `annotations-layer.tsx` near `endStroke`, add an `onEscape` handler in the canvas router (`canvas-shell.tsx:494`) that, when a stroke is in progress (`drawing != null` in annotations state), aborts the draw without committing. Specifically: call `cancelStroke()` (new exported helper) which resets `drawing = null` and does NOT push to `strokesState`. Then `setHoverEl(null)` + `selSet.clear()` + `setTool('move')` per existing Esc behavior.
- **Pattern**: Every drawing tool needs an abort gesture. Figma uses Esc; FigJam uses Esc; Adobe uses Esc + Cmd+Z combo. We use Esc.
- **Gotcha**: The current `onEscape` (canvas-shell.tsx:494) only calls `selSet.clear()`. Don't break that path — `cancelStroke` only runs when `drawing != null`. Order: `cancelStroke()` first, then existing Esc logic.
- **Validate**: Start drawing a rect, drag halfway, press Esc → rect disappears, no shape committed. Press Esc on idle canvas → existing behavior (clear selection).

### Task 22: ADD per-tool SVG cursors (Grievance G6)

- **Do**: In `canvas-shell.tsx` `HALO_CSS`, replace the per-tool `cursor: crosshair !important` block with `cursor: var(--cursor-<tool>) !important`. Define each `--cursor-*` as an inline `data:image/svg+xml,...` URI with declared hotspot. Six cursors:
  - `--cursor-pen`: 16 × 16 tilted pen SVG with ink-tip at bottom-left, hotspot `2 14`
  - `--cursor-rect`: 16 × 16 crosshair with a tiny rect glyph at bottom-right, hotspot `8 8`
  - `--cursor-ellipse`: 16 × 16 crosshair with tiny circle glyph, hotspot `8 8`
  - `--cursor-arrow`: 16 × 16 crosshair with arrow glyph, hotspot `8 8`
  - `--cursor-eraser`: 16 × 16 pink-bubble eraser, hotspot `8 14` (NOT `cell`)
  - `--cursor-comment`: 16 × 16 speech-bubble pointing top-left, hotspot `4 4`
  Provide PNG-2x fallback for browsers without high-DPI SVG cursor support (data-uri PNG raster at 32 × 32). Keep `cursor: grab` for hand-tool (native is fine).
- **Pattern**: FigJam ships per-tool SVG cursors with active-color preview attached to pen tip. We ship the SVG cursors; color-preview-attached pattern is Wave 3 follow-up (needs a positioning loop + a color picker — too much for this task).
- **Gotcha**: The user-agent must accept SVG cursors. All Chromium-based browsers do; Safari 16+ does; Firefox 117+ does. Fallback to PNG-2x raster as a comma-separated `cursor: url(...svg) X Y, url(...png) X Y, crosshair;` chain. The PNG generation is one-time and can ship as static files under `dev-server/static/cursors/`.
- **Validate**: Switch each tool — cursor changes visibly when hovering the canvas. Pen cursor has nib at the click point. Eraser is a pink-bubble shape, not the `cell` crosshair-with-corners. Comment cursor is a small speech bubble.

### Task 23: ADD annotation resize handles (4 corners) — heavy module (Grievance G4)

- **Do**: Create `plugins/design/dev-server/use-annotation-resize.tsx` exposing `useAnnotationResize(strokesStore, annotSel, screenToWorld)`. Render 4 corner handles in screen-space (mirror the `SelectionHalos` pattern at `canvas-shell.tsx:773-840`, NOT world-coord with `vector-effect`). Per-tool resize math:
  - `rect`: adjust `x/y/w/h` based on which corner moved; re-normalize negative `w/h` via existing `normalizeRect` (`annotations-layer.tsx:360`).
  - `ellipse`: adjust `cx/cy/rx/ry` based on diagonal corner.
  - `arrow`: drag-the-endpoint metaphor — 2 handles at `(x1,y1)` and `(x2,y2)`, NOT 4 bbox corners. Special-case in render.
  - `pen`: SCALE all points by `(newW/oldW, newH/oldH)` around the opposite-corner anchor. Most expensive case.
  - `text`: skip (text inherits its anchor's bbox; resize via anchor in future).
  Hide handles when `annotSel.size > 1` (multi-resize undefined, like canvas-shell).
- **Pattern**: Screen-space px-constant handles at any zoom, no `vector-effect` gymnastics. Per-tool math kept in the resize hook, isolated from rendering.
- **Gotcha**: Modifier semantics (Shift = preserve aspect, Alt = scale from center) are OUT OF SCOPE for v1. Add a TODO marker — ship corner-resize without modifier handling first. Rotation handles also deferred.
- **Validate**: Select drawn rect → 4 corner handles visible. Drag NW corner → rect resizes around SE anchor. Same for ellipse + arrow (2 endpoints) + pen (scale points). Multi-select → handles hidden.

### Task 24: ADD multi-artboard select + distribute (Grievance G8) — heavy

- **Do**:
  1. **Shift+Cmd+click on artboard label** adds to multi-selection. Verify `Selection.artboardId` populates correctly via `hoverTargetToSelection` (`canvas-shell.tsx:786-817`). The drag reducer (`use-artboard-drag.tsx`) already follows multi-artboard selections — gesture is the only missing piece.
  2. Create `plugins/design/dev-server/use-artboard-marquee.tsx` parallel to `annotations-layer.tsx:1071-1110`. Move-tool + pointerdown on empty world + drag threshold crossed (Task 25 from Wave 3 — coordinate: this task uses the 4 px threshold from T25, so T25 should land first OR add a local threshold here). On pointer-up: every artboard whose bbox intersects the marquee enters `selSet`.
  3. **Distribute commands** in `canvas-shell.tsx:413` `'artboard-chrome'` context registry: `Distribute horizontally` and `Distribute vertically`, gated on `selSet.selected.length >= 3 && all-are-artboards`. Math: sort by leading edge on axis, compute total span, divide remaining gap by `(n-1)`, shift middle artboards. Persist via existing artboard-meta save channel.
  4. Keyboard: `Cmd+Option+H` → distribute horizontally, `Cmd+Option+V` → distribute vertically. Bail when no multi-artboard selection.
- **Pattern**: Figma's distribute behavior + FigJam Section drag. Pink dots between distributed artboards (Wave 3 Task 27 — Smart Selection) appear on hover after distribute, not always-on.
- **Gotcha**: Distribute requires AT LEAST 3 artboards (with 2, "evenly distributed" is undefined). Show a `disabled` state in the context menu when only 2 are selected.
- **Validate**: Shift+Cmd+click 3 artboards → group bbox surrounds all 3. Move one with the drag → all 3 follow. Right-click → "Distribute horizontally" enabled → execute → middle artboards repositioned to equal gaps.

---

> **End of Wave 2 (rev 2).** All 9 user grievances + 3 second-order issues resolved. Pause for user review before Wave 3.

---

> **Wave 3 — Behavioral discipline (Tasks 25–33, renumbered from rev-1 Wave 2).** Input router + new affordances. Higher risk; pause again at end of Wave 2 for user review.

### Task 25: ADD 4 px drag threshold in `input-router.tsx`

- **Do**: In the pointer-down → pointer-move chain, track `(startX, startY)` and only fire drag-related callbacks when `Math.hypot(dx, dy) >= 4`. Until threshold crossed, treat the gesture as a potential click. Source: Microsoft Win32 docs + d3-drag canonical value.
- **Pattern**: Add a `dragStarted: boolean` flag to the router's internal state; flip on threshold cross, reset on pointer-up.
- **Gotcha**: Don't add threshold to wheel/zoom — only to drag gestures (pointermove following pointerdown on a selectable target or empty canvas).
- **Validate**: Click without moving → no drag fires. Click and move 3 px → still a click. Click and move 5 px → drag fires.

### Task 26: ADD element marquee on empty canvas (companion to T24 artboard marquee)

- **Do**: Create `plugins/design/dev-server/marquee-overlay.tsx`. When `input-router` detects pointerdown on empty canvas in Move tool + drag threshold crossed AND no artboard is hovered, enter ELEMENT marquee mode (vs artboard marquee from T24): render `<div className="dc-cv-marquee">` from `(startX, startY)` to `(currX, currY)`. On pointer-up: compute which `[data-cd-id]` elements intersect the marquee AABB; apply modifier semantics (no-mod = replace, Shift = add, Alt = subtract, Shift+Alt = intersect).
- **Pattern**: Aseprite modifier vocabulary (cleanest in research). Marquee state checked LIVE during drag.
- **Gotcha**: T24 has the artboard marquee variant. The two modes can be distinguished by whether the initial pointerdown is on `.dc-canvas` empty space vs over an artboard's content area. Decide which marquee mode applies at pointerdown, not later.
- **Validate**: Drag from empty space → marquee paints. Cross several elements → they get a thinner "pending" halo. Release → they enter selection. Shift/Alt modifiers work live.

### Task 27: ADD `EqualSpacingHandles` overlay + detector (Smart Selection pink dots)

- **Do**: Create `plugins/design/dev-server/equal-spacing-detector.ts` — pure function `detectEqualSpacing(rects: Rect[], axis: 'x' | 'y'): { gapPx: number, midpoints: number[] } | null`. For 3+ sorted rects on the axis, compute pairwise gaps; if all gaps are within 1 px of each other, emit gap + midpoint positions. Create `EqualSpacingHandles` overlay rendering 4–6 px pink dots (`#FF24BD` per research) at each midpoint, with the gap distance pill above each dot. Driven by multi-selection set when `selected.length >= 3`. **Show on hover only**, not always-visible (discoverable but not noisy).
- **Pattern**: Figma Smart Selection (Rasmus Andersson 2018). The "pleasant moment" research flagged as the differentiator.
- **Gotcha**: Pink dots after T24 distribute → they appear once distribute fires, persist on hover, fade on mouse-leave. Drag-adjusts all gaps proportionally with the pink dimension-pill near the dragged dot.
- **Validate**: Multi-select 3 elements, distribute via Cmd+Option+H, hover → pink dots between adjacent pairs with gap labels.

### Task 28: ADD cursor state machine (modifier-aware live cursor)

- **Do**: In `input-router.tsx`, add `useCursorStateMachine` hook tracking held modifiers as a Set (not state-machine, per Figma Space+Cmd+Alt bug). On pointer hover over a resize handle (from T23 / future element resize), set the appropriate CSS cursor (`nw-resize`, `ne-resize`, `ns-resize`, `ew-resize`). On Alt-held + drag of selected element, set `cursor: copy`. Restore previous cursor on modifier release.
- **Pattern**: `useModifierSet() → Set<'shift' | 'alt' | 'meta' | 'space'>`. Cursor derives from `{tool, hoverKind, modifiers}` triple.
- **Gotcha**: Cursor must change on HOVER, not on drag-start (Excalidraw #250). Use pointermove + elementFromPoint hit-zone resolution.
- **Validate**: Hover over a corner handle → cursor flips to `nw-resize` etc. before any click. Alt-held over selected element → cursor flips to `copy`.

### Task 29: ADD keyboard discipline hook

- **Do**: Create `use-keyboard-discipline.tsx`. Wire into `CanvasRouter`. Handlers:
  - Arrow keys (no modifier): nudge selection by 1 px in that direction.
  - Shift+Arrow: nudge by 10 px.
  - Cmd+D: duplicate selection at remembered offset (default `+10, +10`). After first Cmd+D the user can drag to set a new offset; next Cmd+D reuses it.
  - Cmd+A: select all `[data-cd-id]` elements in active artboard.
  - Esc: clear selection + close context menu (consolidate path through this hook, dedup with T21's cancelStroke).
- **Pattern**: useEffect + document.addEventListener('keydown'). Bail when focus is in input / textarea / contenteditable.
- **Gotcha**: 1 px / 10 px in WORLD UNITS, not screen pixels — per [DDR-028](.ai/decisions/DDR-028-snap-tolerance-in-world-units.md).
- **Validate**: Select element, arrow → moves 1 px world unit. Shift+arrow → 10 px. Cmd+D → +10/+10 duplicate. Cmd+D twice → diagonal of 3.

### Task 30: ADD `ContextualToolbar` — selection-anchored floating chrome (+ G_S1 collapse stroke/fill)

- **Do**: Create `plugins/design/dev-server/contextual-toolbar.tsx`. Render when `selected.length >= 1`. Anchor: horizontally centered to selection AABB, vertically 12 px ABOVE top edge. Flip below if AABB top `< 60 px` from viewport top. Animation: `opacity 0→1 + translateY(4→0)` over 100 ms cubic-bezier; `1→0` over 80 ms on disappear. Tween anchor over 180 ms on selection change. Hide during drag, instant re-show on drag-end.
- **Bundle G_S1 here**: Refactor `annotations-context-toolbar.tsx:281-382` to collapse stroke + fill swatches into a SINGLE swatch row with a `Stroke | Fill` mode toggle pill above. Cuts ~7 controls. Move Delete to a right-side overflow `⋯` menu (keyboard shortcut covers primary use).
- **Pattern**: Selection-driven (NOT move-driven — Miro 2024 anti-pattern). Whimsical's restraint-first toolbar. FigJam single-color row with fill/stroke radio.
- **Gotcha**: Two toolbars now exist — the existing `annotations-context-toolbar` (annotation-specific: colors, thickness) and the new `ContextualToolbar` (element-specific: Duplicate, Copy CSS, Delete). Decide if they consolidate into one switching-on-target-kind toolbar, or stay separate. Recommendation: keep separate for v1, plan a future merge.
- **Validate**: Select annotation → annotation toolbar appears with collapsed stroke/fill row + overflow Delete. Select element → contextual toolbar with Duplicate / Copy CSS / Delete. Selection change → toolbar tweens position.

### Task 31: ADD LOD pass — hide handles + drop shadows below 0.35 zoom

- **Do**: In `canvas-lib.tsx` viewport controller, expose current zoom on CSS attribute `data-cv-zoom-lod: 'normal' | 'low' | 'crisp'` (`normal` for 0.35..4.0, `low` < 0.35, `crisp` > 4.0). Add CSS rules:
  - `.dc-canvas[data-cv-zoom-lod="low"] .dc-cv-halo .tick` → `display: none`
  - `.dc-canvas[data-cv-zoom-lod="low"] .dc-snap-pill` → `display: none`
  - `.dc-canvas[data-cv-zoom-lod="low"] .dc-artboard[aria-current="true"]` → drop accent ring
  - `.dc-canvas[data-cv-zoom-lod="crisp"]` → `font-smooth: antialiased; -webkit-font-smoothing: subpixel-antialiased`
- **Pattern**: tldraw `textShadowLod = 0.35` canonical threshold.
- **Gotcha**: Single attribute swap (`data-cv-zoom-lod`) is cheaper than per-rule rewrites.
- **Validate**: Zoom out to 25 % → ticks + pills disappear; canvas reads clean. Zoom in past 400 % → text crisper.

### Task 32: ADD delta-clamped wheel + trackpad parity in viewport controller

- **Do**: In `canvas-lib.tsx` viewport controller `onWheel` handler, detect trackpad-pinch via `event.ctrlKey === true`. Clamp `deltaY` to `[-50, 50]` then multiply by consistent zoom-rate. Trackpad pan (bare two-finger, `ctrlKey === false`): apply directly, no clamping.
- **Pattern**: tigerabrodi.blog recipe from research_quality_notes.
- **Gotcha**: User preference "wheel = zoom" vs "wheel = pan" is future flag. Default FigJam: Cmd+wheel = zoom, bare wheel = vertical pan.
- **Validate**: Trackpad pinch + mouse wheel zoom at similar perceived speed. Pan via two-finger drag feels native.

### Task 33: ADD programmatic-zoom easing — Cmd+0 / Cmd+1 / Cmd+2 / double-click-to-fit

- **Do**: In viewport controller, when `fit()` / `reset()` / `zoomToSelection()` is called, animate `(translateX, translateY, zoom)` over 200 ms with cubic-bezier `(0.4, 0, 0.2, 1)`. Use rAF interpolation. Add double-click on empty canvas → `fit()`, double-click on artboard → zoom-to-that-artboard with 40 px padding. Honor `prefers-reduced-motion` → instant.
- **Pattern**: 180–220 ms sweet spot. Don't animate user-driven zoom — direct feel.
- **Gotcha**: Animation runs only on programmatic zoom. Wheel/pinch stays direct.
- **Validate**: Cmd+1 → smooth ease-out to fit-all. Cmd+0 → smooth reset. Double-click empty canvas → smooth fit. `prefers-reduced-motion`: media query → instant.

---

## Validation

Run these commands to confirm zero regressions:

1. **Tests**: `cd plugins/design/dev-server && bun test` — all `bun:test` files green, including the new `snap-distance-pill.test.ts` from Task 4.
2. **Type-check**: this repo has no top-level lint/typecheck per CLAUDE.md ("There is **no test suite, lint config, or build step** in this repo"). Type-check the dev-server in isolation: `cd plugins/design/dev-server && bun run --bun tsc --noEmit` if a tsconfig exists; otherwise rely on `bun build` catching type errors at boot.
3. **Boot the server**: `node plugins/design/dev-server/server.mjs --root /tmp/scratch-with-design-dir` — `_server.json` lands, `/design:browse` opens without 404 / 500.
4. **Wave 1 visual diff**: `/design:screenshot --canvas "Canvas Viewport" --all-screens` then visual diff each artboard (CV-01..CV-10) against the live `/design:browse` viewport. Acceptable: live matches spec on selection chrome, snap pills, mini-map, active ring, wordmark.
5. **Wave 2 behavioral smoke** (the 9 user grievances):
   - Brand wordmark gone (T13) — no `dc-canvas-brand` in DOM.
   - Artboards read as quiet paper cards, no Memphis hard shadow on frame chrome (T15).
   - Multi-select: members get 1.5 px solid outlines + dashed group bbox with corner ticks (T16).
   - Annotation selection matches element selection chrome — same 2 px solid + ring + ticks idiom (T17).
   - Draw a rect → released → rect is selected + tool flips back to Move (T18).
   - Double-click rect tool → lock badge appears → draw multiple without tool flipping → Esc clears (T19).
   - Rect / ellipse expose Thin / Thick chips in annotation toolbar (T20).
   - Mid-stroke Esc cancels without commit (T21).
   - Each draw tool has its own SVG cursor with hotspot (T22).
   - Click drawn rect → 4 corner handles visible; drag NW corner → resizes (T23).
   - Shift+Cmd+click 3 artboards → multi-select; right-click → Distribute horizontally → equal gaps (T24).
6. **Wave 3 behavioral smoke**:
   - Click without moving → no drag (T25). Click+move 5 px → drag fires.
   - Drag from empty world → element marquee with Shift+Alt modifiers (T26).
   - Multi-select 3 distributed elements → pink dots between adjacent pairs (T27).
   - Hover resize handle → cursor flips to `nw-resize` before any click; Alt-held drag → `cursor: copy` (T28).
   - Arrow key nudges 1 px; Shift+Arrow 10 px; Cmd+D duplicates with offset memory; Cmd+A select all (T29).
   - Select element → ContextualToolbar fades in above with Duplicate / Copy CSS / Delete (T30). Annotation toolbar collapsed stroke+fill into single swatch row + overflow Delete.
   - Zoom to 20 % → handles + pills hidden (T31). Zoom to 400 % → text crisper.
   - Mouse wheel zoom + trackpad pinch zoom at similar perceived speed (T32).
   - Cmd+1 / Cmd+0 / double-click empty → smooth 200 ms ease-out animation; `prefers-reduced-motion` → instant (T33).
7. **Cross-platform scenario**: spawn `scenario-runner` on `canvas-figjam-feel` scenario (new — see Scenario Coverage). web-desktop primary; mobile best-effort (canvas is desktop-only per spec).
8. **Design System Guard**: spawn — verifies `--guide-magenta` token, accent ring outside drop-shadow, ambient-shadow on floating chrome, quiet artboard frame (no brutalist on frame chrome).
9. **A11y**: spawn `a11y-auditor` — verify tinted active-tool clears WCAG AA, distance pills + corner ticks `aria-hidden`, ContextualToolbar reachable via Tab. Honor `prefers-reduced-motion` on Tasks 7, 17, 30, 33.
10. **Critic panel**: `/design:critic --panel design-critic,graphic-design-critic,a11y-critic`. Target: drop from 9 user grievances + 14 original blockers → ≤ 3. Aspiration ≥ 4.6/5.
11. **Manual** — humans-only judgments:
    - Snap pill `Δ34` feels confident, not flickery.
    - Selection chrome reads instantly as "selected" — same idiom for element and annotation.
    - Marquee modifier switching is LIVE during drag (release Shift mid-drag → mode flips).
    - Artboard frames feel like FigJam Sections — quiet, paper-card.
    - Drawing a shape feels like a complete loop: draw → see selected → adjust via toolbar → keep moving.

---

## Scenario Coverage (UI tasks — required)

> Per CLAUDE.md, UI features must ship a cross-platform scenario before `/done`. Canvas viewport is desktop-first (`.design/ui/Canvas Viewport.meta.json` declares `platform: "desktop"`), so web-mobile / native variants are best-effort.

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| (none) | The canvas viewport has no dedicated scenario today. | 🆕 new |

**New scenarios to create:**

- `canvas-figjam-feel-smoke` — flow: (1) boot `/design:browse`, (2) hover artboard → 1.5 px tinted halo within 1 frame, (3) Cmd+click → 2 px solid + ring + corner ticks + contextual toolbar fade-in, (4) Switch to rect tool, draw rect → released → rect auto-selected + tool flips to Move, (5) drag drawn rect near sibling → magenta snap guide + `ΔN` pill, (6) Shift+Cmd+click 3 artboards → distribute horizontally → equal gaps + pink dots on hover, (7) Cmd+1 → smooth 200 ms fit-all, (8) zoom out to 20 % → ticks + pills hidden (LOD). Persona: "single-developer-iterating". Fixtures: `.design/` with 3+ artboards laid out roughly evenly.

`/done` runs `scenario-runner` across 5 platforms. Web-desktop blocking; mobile / native expected-skip with reason (canvas is desktop-only per `Canvas Viewport.meta.json`).

---

## Acceptance Criteria

- [x] Wave 1 (T1–T12) completed 2026-05-26
- [x] Wave 2 (T13–T24) completed 2026-05-26 — all 9 user grievances + 3 second-order issues resolved (artboard marquee sub-task deferred to Wave 3 / T26)
- [x] Wave 2 follow-up patches (2026-05-26) — annotation halo simplified (drop SVG ring + corner ticks; resize handles play that role); T24.5 artboard chrome selection gesture wired through `resolveHoverTarget` opening + `[data-dc-screen]` selector fallback; T24.6 artboard marquee drag-to-lasso overlay
- [x] Wave 2.7 (2026-05-26, post-user-review batch) — three coordinated UX fixes: (1) no auto-clear on empty-space click — Esc is the single deselect gesture (elements / artboards / annotations); (2) direct artboard drag (drop `.dc-artboard-ghost`, drop `.dc-dragging` opacity-0.3, article updates `live X/Y` inline) — halo + group-bbox follow naturally via `getBoundingClientRect`; (3) distribute commands move to `MultiArtboardToolbar` floating chrome anchored above the group bbox (≥ 2 artboards visible, ≥ 3 enabled), keyboard shortcuts `⌘⌥H` / `⌘⌥V` removed per user feedback
- [ ] Wave 3 (T25–T33) completed — original behavioral discipline
- [x] DDR-046 amended (Task 14) — dashed = group-container signal, not "reserved for none"
- [ ] `bun test plugins/design/dev-server/` green — baseline 359 + tests added per task
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (types, no lint config)
  - [ ] Tests (bun:test suite)
  - [ ] Build (`bun run plugins/design/dev-server/build.ts`)
  - [ ] **`scenario-runner`: 0 blockers on web-desktop**, mobile / native skipped with reason
  - [ ] `design-system-guard` subagent: 0 blockers
  - [ ] `a11y-auditor` subagent: 0 blockers; `prefers-reduced-motion` honored on Tasks 7, 17, 30, 33
- [ ] `design-critic` pass: ≤ 3 blockers (down from 9 user grievances + 14 original baseline = 23)
- [ ] `graphic-design-critic` pass: ≤ 1 blocker
- [ ] `signature-moment-critic`: aspiration ≥ 4.6/5
- [ ] User confirms all 9 grievances + 3 second-order are visually resolved (post-Wave-2)
- [ ] Scenario report linked in PR description
- [ ] No DDR-worthy decision left unrecorded (DDR-046 amended in T14; assess if T19 sticky-tool-lock warrants its own DDR)
- [ ] Code follows project conventions per CLAUDE.md (Bun-first APIs per [DDR-009](.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md), `dev-server/paths.ts` for any FS paths per [DDR-045](.ai/decisions/DDR-045-real-disk-path-resolution-for-compiled-dev-server.md), no project-side `canvas-lib` copy per [DDR-025](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md))

---

## Grievance traceability

User-supplied feedback after Wave 1 → task assignment:

| ID | Grievance | Task | Effort | Severity |
|----|-----------|------|--------|----------|
| G1 | Multi-select looks weird | T16 | trivial | warning |
| G2 | Drawing shape doesn't auto-select | T18 | trivial | blocker |
| G3 | Annotation selection ≠ element selection chrome | T17 | trivial | blocker |
| G4 | Annotations no resize handles | T23 | moderate | blocker |
| G5 | Shapes no stroke weight | T20 | trivial | warning |
| G6 | All draw tools share crosshair cursor | T22 | moderate | warning |
| G7 | Artboard frame too brutalist | T15 | trivial | blocker |
| G8 | No multi-artboard select/distribute | T24 | moderate | warning |
| G9 | Brand watermark unwanted | T13 | trivial | blocker |
| G_S1 | Annotation toolbar overloaded (16 controls in row) | T30 | moderate | warning |
| G_S4 | DDR-046 comment incorrect re: dashed | T14 (+ T16 comment) | trivial | nit |
| G_S5 | No Esc-to-cancel-mid-stroke | T21 | trivial | nit |

Critic + research artifacts:
- design-critic rev 2 report — inline in this session (9 blockers, 4 warnings, ordering recommendation)
- ux-research-agent payload — `.design/_history/_system/maude-canvas-4d4b0f9f-domain-research-ux-patterns.json` (17 queries, FigJam Section vs Figma Frame, tldraw STROKE_SIZES, FigJam color-preview-attached-to-cursor pattern, Excalidraw resize anti-patterns)

---

## Retro

Closed 2026-05-26 with commit `8654dab` — 23 files, +2293/-89 lines.

**What worked**

- **Three-wave structure** (visual → behavioral → user-grievance) absorbed two rounds of post-implementation feedback (Wave 3.5, Wave 3.6) without rebuilding the plan. The user-grievance traceability table at the end let me jump straight from a one-line complaint to the right code surface every time.
- **Live agent-browser verification** beat the heavy critic-panel loop. Every Wave 3.5/3.6 fix landed with a `pointerdown→pointerup→click` synthetic-event probe that asserted the exact behavior the user described — caught the G3/G7 root cause (chrome filters missing toolbar surfaces) in one session, where a static-only review would have missed it.
- **DDR-046 as a load-bearing anchor**. Rev 2's "dashed = group container, solid = active subject, dashed+fill = marquee" idiom held up through every Wave 3 addition. The pattern repeated cleanly for ContextualToolbar (floating chrome contract) and EqualSpacingHandles (decorative non-accent pink). Future floating-overlay additions should cite DDR-046 by default.
- **Scenario spec written AFTER implementation, BEFORE /done**. The 9-step `canvas-figjam-feel` spec at `.ai/scenarios/canvas-figjam-feel/spec.md` codified what the user-grievance fixes are actually checking. Future regression runs read this file, not the plan's prose. Spec-after-implementation worked here because the plan's "Validation" section was already a rough scenario — formalizing it into a runnable spec was a 1-hour task.

**What didn't**

- **Canvas-cache mtime gate had a fatal blind spot.** `canvasCache` in `http.ts` invalidated only on `_lib/` file events. After DDR-025 moved canvas-lib into the dev-server, edits to `canvas-shell.tsx` / `contextual-toolbar.tsx` / etc. **never** flushed the cache — the iframe served pre-edit bundles regardless of hard reload. Cost me ≥ 30 min of G3/G7 debugging chasing phantom bugs that were already fixed in source. Fix landed in this commit (recursive `fs.watch` over `DEV_SERVER_ROOT`). Pre-`/flow:done` rule for future maude-on-itself dev: rebuild + restart dev-server after any `plugins/design/dev-server/**/*.tsx` edit until cache invalidation is more granular.
- **The "click-on-empty clears selection" decision was reverted twice.** Wave 2.7 dropped click-clear in favor of Esc-only. Wave 3.5 (G1) brought it back. Both decisions were user-grievance-driven, both felt right at the moment. The lesson: empty-world click-handling is a load-bearing UX call deserving its own DDR rather than living in one-line plan revisions. Add a follow-up: DDR-049 (or similar) — "click-to-deselect is the default; Esc is the explicit-deselect fallback. Floating chrome surfaces are not 'empty world' — they're listed in marquee chrome filters."
- **Synthetic event scripts in scenario-runner needed careful ordering** (`pointerdown(buttons=1) → mousedown → pointerup(buttons=0) → mouseup → click`). agent-browser has no native modifier-click. Spec.md now documents the working recipe in a "Tooling notes" comment, but the next scenario author will hit the same trap. Either upstream a helper to `.ai/scenarios/_lib/` or land a PR against agent-browser's `click` for `--meta` / `--shift` flags.

**What to change in /plan or /execute next time**

- **/plan should include a "scenario spec stub" section** for any UI-touching feature, mirroring the existing "Validation" section but in the scenario-runner protocol (steps + assertions + screenshots). The plan template's Validation section is verbose prose — the scenario spec is executable. Both, not either-or.
- **/execute should check `bundle freshness` before declaring a task complete** when working in the dev-server-on-itself dogfooding loop. A quick `grep -c <recent-string> dist/client.bundle.js` after each edit would have caught the stale-cache issue immediately. Could ship as a `flow:utils-verify` extension for this repo specifically.
- **The "user picks scope" interrupt pattern** (AskUserQuestion at session start for Wave 3 scope, again at /flow:done for validate intensity) was the right tradeoff between blind-autonomy and stop-and-ask. Worth promoting to a /flow:execute convention for any wave > 5 tasks.

**Follow-up scopes (not blocking the commit)**

- Wave 3.7 polish: token-discipline (pink-dot token, hardcoded easings, danger color, gradient slash, OKLCH palette, accent fallback) per design-system-guard's 6 warnings — single-pass refactor across `equal-spacing-handles.tsx`, `annotations-context-toolbar.tsx`, `marquee-overlay.tsx`, `canvas-shell.tsx`.
- a11y polish: focus rings + touch-target min-height + white-swatch border + keyboard-nudge AT-bail. Greppable, one-pass across `.dc-elem-ctx-tb button`, `.dc-multi-artboard-tb button`, `.dc-annot-ctx-sw`, `.dc-annot-ctx-btn`.
- Element-marquee scenario + LOD scenario (spec.md "Follow-ups" §).
- DDR-049 (proposed) — empty-world-click deselect contract + floating chrome filter discipline.

**Time-in-execution**

Plan rev 1 (Wave 1) + rev 2 (Wave 2) was committed 2026-05-26 morning. Wave 3 + 3.5 + 3.6 ran across this session — net ~6 hours of execution (excluding the heavy /validate batch which ran in parallel during commit prep).
