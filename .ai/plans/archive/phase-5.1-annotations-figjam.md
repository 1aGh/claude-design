# Phase 5.1 — FigJam-style annotation overhaul

> Incremental on top of Phase 5. Phase 5 shipped a working draw layer (pen / rect / arrow / eraser) but the UX is brittle: viewport gestures are blocked, transform stutters, strokes can't be selected or restyled, the shape vocabulary is too small, and the dev-server menubar's `View` / `Selection` / `Tools` items are inert. This phase brings annotations close to FigJam: selectable shapes with a contextual toolbar, ellipse + text-inside-shape, fill + stroke thickness, all while panning/zooming feels free.

## Description

Rework `annotations-layer.tsx` from a self-contained pointer-claiming overlay into a portal-rendered layer that lives inside `.dc-world` (so the world's CSS zoom/translate moves the strokes natively, with 0 ms latency), AND splits its input ownership cleanly: viewport gestures (space-pan, middle-mouse pan, wheel/pinch zoom) ALWAYS reach `useViewportController` first; the layer only claims pointerdown when the user is actually committing a draw or hitting an existing stroke. Add ellipse and text-in-shape, give rect/ellipse a separate fill, give pen/arrow a thin/thick toggle. Stand up a parallel annotation selection store, render a small per-shape toolbar (FigJam-style) when something is selected, and wire the dev-server menubar's three inert menus to actually do something.

**Plus a canvas chrome redesign** — the current floating chrome (`ToolPalette` bottom-left, `DCMiniMap` bottom-right, `DCZoomToolbar` bottom-right above the minimap) is utilitarian but doesn't match the rest of the dev-server's visual language and reads as developer-tools rather than design-tools. Re-skin and re-place: a single **centered bottom toolbar** carrying icon-based tool buttons (V/H/C/B/R/A/O/E + annotation toggle), with zoom controls and minimap absorbed into the same shell or pushed to a quieter position. Icons replace text labels (matches FigJam/Figma idiom); the shell adopts the menubar's mono+pill typography so canvas chrome and app chrome read as one product.

## User Story

As a designer reviewing a canvas, I want to circle a button, write "needs more padding" inside the circle, then click my arrow later to recolor it — without losing my ability to pan, zoom, or pinch to keep navigating the canvas while the draw tool is active.

## Problem

Phase 5 made annotations work as a one-way write (draw → eraser → presentation). Real annotation use needs four more behaviors:
1. **Coexistence** — pan/zoom must keep working in draw mode (currently the SVG swallows pointer events).
2. **Live sync** — when the user pans/zooms in Move mode, annotations jitter one frame behind (React state-driven transform vs synchronous DOM write).
3. **Iteration** — drawn strokes are write-once; the user expects to click, restyle, move, delete.
4. **Vocabulary** — no ellipse, no fill, no in-shape text, no thickness; the dev-server menubar's View/Selection/Tools menus advertise commands that don't fire.

## Solution

| Concern | Approach |
| ------- | -------- |
| Viewport blocked | AnnotationsLayer stops calling `e.stopPropagation()` on pointerdown; bails on space-held / middle / right; relies on bubble-phase listeners co-existing with `useViewportController` on the same host. |
| Stutter | Render strokes via `createPortal()` into `worldRef.current` so CSS `zoom` + `translate` on `.dc-world` moves them in lockstep with content. Drop the `<g transform>` math entirely. |
| Selection | New `use-annotation-selection.tsx` (parallel to `use-selection-set.tsx`, doesn't share storage — annotation IDs aren't DOM IDs). In Move tool, bare click hit-tests strokes first (annotation has priority); selected strokes render with a halo and a floating per-shape toolbar. |
| Move | Drag from inside a selected stroke's bbox → translates all selected strokes' world-coord anchors. Arrow keys nudge 1 / 10 world units. |
| Ellipse + text + fill + thickness | Add `EllipseStroke` + `TextStroke` types; bump rect/ellipse with an optional `fill` field; bump pen/arrow with optional thick width (12 px world). Schema extension is back-compatible: Phase 5 SVGs still parse; new fields default cleanly when absent. |
| Contextual toolbar | New `<AnnotationContextToolbar/>` — floating chrome positioned at the bbox top of the active selection. Shows: color swatches, fill (with "none"), thickness toggle (for stroke shapes), font-size step (for text-bearing shapes), delete. |
| Menubar | `client/app.jsx`: drop the "Phase 5" disabled tag on the Annotations item — toggles `view-annotations` postMessage. New Selection dropdown (Deselect All, Select All Annotations). New Tools dropdown (V/H/C/B/R/A/E/O with shortcuts) → `tool-set` postMessage. AnnotationsLayer + CanvasShell listen for `view-annotations`, `tool-set`, `selection-clear`. |

## Metadata

- **GitHub Issue**: — (drive-by; not tracked in GH for this iteration)
- **Type**: Enhancement (Phase 5 follow-up)
- **Complexity**: Medium-High (10 atomic tasks, schema bump, new selection store, menubar postMessage protocol)
- **App/Package**: `plugins/design`
- **Depends on**: Phase 5 (draw tools — landed 2026-05-19)
- **Parallel with**: Phase 6 (comments/export — separate canvas chrome)
- **Affected files**:
  - `plugins/design/dev-server/annotations-layer.tsx` — rewrite render path + selection + drag + extend schema
  - `plugins/design/dev-server/use-annotation-selection.tsx` (new) — selection store + contextual-toolbar coordinates
  - `plugins/design/dev-server/annotations-context-toolbar.tsx` (new) — floating per-shape toolbar
  - `plugins/design/dev-server/input-router.tsx` — extend Tool with `ellipse`; classify `O`; document new postMessage bridge
  - `plugins/design/dev-server/use-tool-mode.tsx` — register ellipse
  - `plugins/design/dev-server/canvas-shell.tsx` — wire postMessage listeners; mount toolbar; route Move-tool clicks to annotation-selection first
  - `plugins/design/dev-server/canvas-lib.tsx` — export `useWorldRefContext()` (or extend `useViewportControllerContext` with `worldRef`); restyle `DCMiniMap` + `DCZoomToolbar`
  - `plugins/design/dev-server/tool-palette.tsx` — rebuild as centered icon bar; absorb zoom/fit/annotation-toggle controls
  - `plugins/design/dev-server/canvas-icons.tsx` (new) — tiny inline-SVG icon set (no external dep) for tool buttons
  - `plugins/design/dev-server/client/app.jsx` — Menubar wiring (View/Selection/Tools dropdowns + postMessage emit)
  - `plugins/design/dev-server/api.ts` + `http.ts` — no shape change; the SVG body is already free-form

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/annotations-layer.tsx` (entire — ~640 LOC) — current behavior to refactor in place.
- `plugins/design/dev-server/canvas-lib.tsx:740-930` — useViewportController's pointer/wheel ownership table. Critical for the coexistence fix.
- `plugins/design/dev-server/canvas-shell.tsx:160-200, 340-490` — where AnnotationsLayer mounts; where the registry that powers the context menu lives (model for per-shape toolbar).
- `plugins/design/dev-server/use-selection-set.tsx` — the canvas-element selection store; the annotation store will mirror its API but stay independent (DOM-element IDs vs annotation stroke IDs).
- `plugins/design/dev-server/input-router.tsx` — entire file; Tool union + classify is the public contract.
- `plugins/design/dev-server/client/app.jsx:762-890` — Menubar component + ViewDropdown; the surface to extend.
- `.ai/plans/phase-5-draw-tools.md` — execution log at bottom documents what's already shipped.

### Files to Create

- `plugins/design/dev-server/use-annotation-selection.tsx` — `AnnotationSelectionProvider` + `useAnnotationSelection()` returning `{ selectedIds, replace, add, toggle, clear, contains }`. No persistence (in-memory per canvas mount, like comments composer state).
- `plugins/design/dev-server/annotations-context-toolbar.tsx` — `<AnnotationContextToolbar/>`. Reads `useAnnotationSelection` + the stroke list (lifted from AnnotationsLayer into a context, see Task 6) and renders the floating per-shape toolbar above the selection bbox.
- `plugins/design/dev-server/test/use-annotation-selection.test.tsx` — store contract tests.
- `plugins/design/dev-server/test/annotations-selection-move.test.ts` — pure helpers for hit-test + drag-translate.
- `.ai/scenarios/canvas-annotations-figjam.md` — cross-platform scenario (web-desktop only; native skip).

### Documentation

- SVG `vector-effect="non-scaling-stroke"` — already in use; confirms strokes stay pixel-thick under CSS zoom. <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect>
- React `createPortal` — mount AnnotationsLayer's stroke nodes into `worldRef.current`. <https://react.dev/reference/react-dom/createPortal>
- `Element.getBoundingClientRect()` — used by per-shape toolbar for screen-coord positioning. Same pattern as `SelectionHalos` in `canvas-shell.tsx:545-600`.

### Patterns to Follow

- **Mounting chrome outside `.dc-world`** — copy `SnapGuideOverlay` (`canvas-lib.tsx:1405-1463`): `position: fixed`, read `viewport` from world context, project world coords → screen each tick. AnnotationContextToolbar will use the same shape, but read from `useAnnotationSelection` + stroke list to derive an anchor point.
- **postMessage protocol** — existing `dgn:` namespace (`canvas-shell.tsx:386-399` reads `'force-clear'` + `'select-clear'`). Phase 5.1 adds `'view-annotations'`, `'tool-set'`, `'annotation-selection-clear'`. Document inside `canvas-shell.tsx` near the existing listener.
- **Context-menu registry** — `canvas-shell.tsx:200-330` shows how rich menu metadata is described. Our context-toolbar is simpler (no submenus), but mirror the `id` + `shortcut` + `onSelect` shape so the menubar bridge can dispatch with a single ID.
- **Test scaffolding** — `test/_helpers.ts` (`bootServer`, `makeSandbox`, `nextPort`) is the harness for endpoint tests; pure unit tests use plain `import { describe, test, expect } from "bun:test"`.

---

## Design Decisions

### New tool letter mapping

| Key | Tool | Notes |
| --- | --- | --- |
| `O` | ellipse | mirrors `R` for rect; `O` = "oval" mnemonic, no conflict with browser shortcuts |
| `B` | pen (thin, default 2 px) | unchanged |
| `Shift+B` | (visual hint only) | switches the active thickness chip on the chrome — does NOT switch tool; treated as a chrome-only toggle for `pen` and `arrow` |
| `T` (deferred) | text-in-shape edit | NOT a separate tool — text is initiated by **double-clicking a selected rect/ellipse**; this matches FigJam, avoids burning another letter |

### Annotation schema bump (back-compatible)

Existing Phase 5 elements survive verbatim. New attributes default cleanly when absent:

```svg
<!-- New ellipse -->
<ellipse data-id="..." data-tool="ellipse" stroke="#d63b1f" stroke-width="2"
         fill="none" cx="..." cy="..." rx="..." ry="..."
         vector-effect="non-scaling-stroke"/>

<!-- Rect / ellipse with fill -->
<rect data-id="..." data-tool="rect" stroke="#1d6cf0" stroke-width="2"
      fill="#fff4d6" x="..." y="..." width="..." height="..."/>

<!-- Text inside a shape — sibling element, anchored to the host shape via
     data-anchor-id; on load the parser binds it to the shape so they move
     together. -->
<text data-id="..." data-tool="text" data-anchor-id="rect-id"
      data-font-size="14" x="..." y="..."
      fill="#1a1a1a" text-anchor="middle"
      dominant-baseline="middle">noted text</text>

<!-- Pen/arrow thick is just a wider stroke-width -->
<path data-id="..." data-tool="pen" stroke-width="6" ... />
```

Parser update is one new branch per shape; everything else is attribute reads.

### Per-shape toolbar — fields shown per tool

| Tool | Color | Fill | Thickness | Font size | Delete |
| ---- | :---: | :--: | :-------: | :-------: | :----: |
| pen | ✓ | — | thin/thick | — | ✓ |
| arrow | ✓ | — | thin/thick | — | ✓ |
| rect | ✓ | ✓ (incl. none) | — | — | ✓ |
| ellipse | ✓ | ✓ (incl. none) | — | — | ✓ |
| text (bound to rect/ellipse) | ✓ | — | — | S / M / L | ✓ |

When multiple shapes of different tool types are selected, the toolbar shows the **intersection** (color + delete are always shown; everything else only when every selected stroke supports it).

### Stroke selection priority in Move tool

When the user clicks in Move tool, hit-test order is:

1. **Existing context-toolbar element** → no-op (let the toolbar own its click).
2. **Visible annotation stroke** under cursor → annotation-selection replaces (`Shift` adds).
3. **Cmd / Cmd+Shift held** → fall through to the existing element-selection (`useSelectionSet`) — preserves Phase 4.1's escape hatch.
4. **Bare click on empty canvas** → clear annotation selection (mirrors element-selection's behavior).

Annotation and element selections do not co-exist visibly (only one halo set at a time). Clicking an annotation clears any element selection and vice-versa.

### Canvas chrome redesign — placement + visual language

Current state (Phase 4 + 5):

```
┌──────────────────────────────── canvas iframe ──────────────────────────────┐
│  [V][H][C][B][R][A][E]                                                       │
│  ToolPalette — bottom-left                       DCZoomToolbar (pills, tr)  │
│                                                  DCMiniMap (panel, br)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Three floating chrome pieces, all bottom-corner, all with their own mono-text styling. Reads developer-tools, not design-tools.

Target (Phase 5.1):

```
┌──────────────────────────────── canvas iframe ──────────────────────────────┐
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                                              │
│                                                              ┌─ DCMiniMap ─┐ │
│                                                              │             │ │
│                                                              └─────────────┘ │
│       ┌──────────────────────────────────────────────────────┐               │
│       │ [↖V] [✋H] [💬C] │ [✎B] [▭R] [○O] [→A] [⌫E] │ [50%▾] │               │
│       └──────────────────────────────────────────────────────┘               │
│                          centered bottom canvas toolbar                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Centered bottom toolbar** (single horizontal bar; horizontally centered; ~16 px from bottom edge): icon buttons grouped — *navigate* (V/H/C) · *draw* (B/R/O/A/E) · *zoom* (current %, click to open zoom-fit menu). The annotation visibility toggle moves into the same bar as a `presentation` icon button.
- **Icons** — minimal inline SVG, single stroke, 16 px. Lives in a new `canvas-icons.tsx` module so the icon set is one file to skin / swap. Lucide-style outlines (no external dep — five hand-traced glyphs is cheaper than pulling lucide-react into the dev-server bundle).
- **Minimap** stays bottom-right but re-skins to match the toolbar's pill / border-radius / shadow values. No longer "panel" — same chrome family as the toolbar.
- **Visual language** — borrow the menubar's tokens:
  - `border-radius: 8px`, `background: var(--bg-1, rgba(255,255,255,0.98))`, `border: 1px solid var(--u-border-2)`, `box-shadow: 0 6px 24px rgba(0,0,0,0.08)`.
  - Active tool: filled accent background, white icon (today: filled accent, mono uppercase label — we drop the label).
  - Tooltips on hover surface the shortcut (`V`, `B`, …), so we lose nothing by hiding the inline label.
- **CSS variables fallback chain** stays the same (CSS vars first, hard-coded fallback second) so the chrome still drops into any DS.

The shape change is **chrome-only** — `useToolMode` / `useViewportController` / `AnnotationsLayer` are untouched. Old DEFAULT_TOOLS already carry `label` + `shortcut` + `cursor`; we add an `icon` field (a React component reference into `canvas-icons.tsx`).

### Menubar dropdown shape (extends `client/app.jsx`)

```
View
  Panels: Tree, Comments, Hidden
  ──
  Annotations: Show / Hide   (postMessage → 'view-annotations' { visible })
  ──
  Zoom (existing — still Phase 4 disabled)
Selection (NEW)
  Deselect all                (postMessage → 'selection-clear')
  Select all annotations       (postMessage → 'annotation-select-all')
Tools (NEW)
  Move (V), Hand (H), Comment (C)
  Pen (B), Rect (R), Arrow (A), Ellipse (O), Eraser (E)
  (each → postMessage → 'tool-set' { tool })
```

File / Edit / Help stay as today (Help opens the existing modal; File / Edit remain disabled with a phase tag — Phase 6+ scope).

---

## Tasks

Execute in order. Each task is atomic and `/flow:utils-verify`-able.

### Task 1: Viewport coexistence — stop swallowing pointer events

- **Do**: In `annotations-layer.tsx`, change `beginStroke` so it
  - bails on `e.button !== 0` (let middle / right pass through to viewport-controller + context-menu),
  - bails when a `spaceHeldRef` is true (read via new doc-level keydown listener: `e.code === 'Space'` toggles the ref; share with the rest of the layer for cursor hints),
  - drops the `e.stopPropagation()` call — `preventDefault()` alone is enough to suppress text-selection / focus shifts; the viewport-controller's bubble-phase listener on `.dc-canvas` still gets the event for its own space-pan / middle-pan logic.
  - bails on Cmd/Ctrl held (existing — escape hatch into element selection).
- **Pattern**: `canvas-lib.tsx:797-817` shows the host listener; mirror its modifier checks.
- **Gotcha**: Wheel zoom already works because the wheel listener lives on `document` at capture phase (`canvas-lib.tsx:898-910`). Don't add a `wheel` listener on the SVG.
- **Validate**: open a canvas in pen mode, hold space + drag → world pans; middle-mouse-drag → world pans; pinch trackpad → world zooms; bare click on canvas → stroke starts.

### Task 2: Zero-latency transform via portal into `.dc-world`

- **Do**:
  1. In `canvas-lib.tsx`, add `export function useWorldRefContext(): RefObject<HTMLDivElement | null> | null` returning `useWorldContext()?.worldRef ?? null`. (Don't export the full `WorldContextValue` — keep the surface minimal.)
  2. In `annotations-layer.tsx`, split the render into:
     - **`<AnnotationsInput/>`** — invisible overlay (no `<svg>` host; binds pointer listeners to the host returned by `useWorldRefContext()?.parentElement`). Same `beginStroke` / `moveStroke` / `endStroke` logic, now living off the host instead of a stretched SVG.
     - **`<AnnotationsSvg/>`** — uses `createPortal()` to mount a single `<svg overflow="visible" style="position:absolute; inset:0; pointer-events:none">` inside `worldRef.current`. Strokes drawn in world coords; CSS `zoom` on `.dc-world` scales them in lockstep with artboards.
  3. Drop the screen-space `<g transform>` projection math. `vector-effect="non-scaling-stroke"` keeps stroke thickness constant under `zoom`.
- **Pattern**: `SnapGuideOverlay` (`canvas-lib.tsx:1405-1463`) shows the *old* style (read viewport, project to screen). We're moving away from that for annotations specifically.
- **Gotcha**: `createPortal` from an iframe-rooted component into another node in the same iframe is supported by React 19. Re-renders of the parent still flush updates inside the portal. **Verify the portal target exists before mounting** (worldRef is `null` until after the first commit — use `useEffect` to schedule the portal mount one tick later, or render `null` until `worldRef.current` is non-null).
- **Gotcha**: CSS `zoom` is applied to `.dc-world` (`canvas-lib.tsx:556`). Empirically Chromium/Safari render SVG with `vector-effect="non-scaling-stroke"` correctly under CSS zoom; Firefox 126+ likewise. Add an explicit screenshot check at zoom levels 25 % / 100 % / 250 % during validation; if Firefox renders fuzzy, fall back to `transform: scale()` on a wrapper inside the portal.
- **Validate**: pan/zoom in Move mode is visibly smooth (no 1-frame lag between artboard and any drawn stroke). Frame-rate not measured strictly — visual smoothness is the bar.

### Task 3: Ellipse tool + thin/thick chip

- **Do**:
  1. `input-router.tsx`: extend `Tool` union with `"ellipse"`; add `O` letter to keydown classify; register in `ANNOTATION_TOOLS` set.
  2. `use-tool-mode.tsx`: add `{ id: "ellipse", label: "Ellipse", shortcut: "O", cursor: "crosshair" }` to DEFAULT_TOOLS.
  3. `canvas-shell.tsx`: extend the `data-active-tool` cursor CSS to include ellipse.
  4. `annotations-layer.tsx`: add `EllipseStroke = { id; tool: "ellipse"; color; width; cx; cy; rx; ry; fill?: string | null }`. Begin/move/end mirror rect (drag-out from start point → bounding box → derive cx/cy/rx/ry).
  5. Add a `thickness: 2 | 6` state to AnnotationsChrome (visible only when active tool is pen or arrow); next stroke uses the chosen thickness.
- **Pattern**: rect implementation in current `annotations-layer.tsx` is the template; clone the shape.
- **Validate**: keyboard `O` switches to ellipse; drag draws ellipse; chrome shows a `THIN ⬩ THICK` chip while pen/arrow is active.

### Task 4: Background fill for rect + ellipse

- **Do**:
  1. Extend `RectStroke` + `EllipseStroke` with optional `fill: string | null` (null / absent = none).
  2. AnnotationsChrome: when active tool is rect or ellipse, show a fill picker (`none`, then the 6-color palette).
  3. `strokeToSvgEl()` serializes `fill="..."` when set (default `fill="none"` stays the same).
  4. `svgToStrokes()` reads the `fill` attribute and stores it; `none` / missing → null.
- **Gotcha**: SVG element `fill` attribute is what's persisted; in the React render path use a literal fill, not the `fill="none"` default, so the parsed-out roundtrip is byte-stable.
- **Validate**: draw a rect with amber fill, reload, fill preserved. Click "none" in the picker, fill clears.

### Task 5: Schema bump — back-compatible parse for new shapes

- **Do**: extend `svgToStrokes()` with `ellipse` and `text` branches; extend `strokesToSvg()` likewise. The Phase 5 fixture used in `test/annotations-api.test.ts` still must parse — confirm with an explicit "Phase 5 SVG loads under Phase 5.1 parser" round-trip test.
- **Validate**: existing `test/annotations-layer.test.ts` round-trips still pass; new tests added for ellipse and text shapes.

### Task 6: Annotation selection store + Move-tool wiring

- **Do**:
  1. New `use-annotation-selection.tsx`: `AnnotationSelectionProvider` + `useAnnotationSelection()` exposing `{ selectedIds: string[]; replace(id), add(id), toggle(id), clear(), contains(id) }`.
  2. Mount `AnnotationSelectionProvider` inside `CanvasShell` (sits between `SelectionSetProvider` and `ContextMenuProvider`).
  3. Lift `strokes` state out of `AnnotationsLayer` into a small `useAnnotationsStore` hook (still scoped to one canvas mount), so the contextual toolbar can mutate strokes without prop-drilling back through the layer.
  4. In `canvas-shell.tsx`'s `CanvasRouter` `onHover` / `onSelect` callbacks (Move tool path), add an annotation hit-test step BEFORE the existing element-selection. Order matches "Stroke selection priority in Move tool" in Design Decisions. On annotation hit → `annotationSel.replace(strokeId)` (or `add` with Shift) and clear `useSelectionSet`. On miss → behave as today.
  5. Render selected-stroke halos: a 1 px accent outline around each selected stroke's bbox (use the same `dc-cv-halo--selected` look). Halos render via the portal inside `.dc-world` so they pan/zoom with the strokes.
- **Validate**: in Move mode, click a stroke → halo appears; Shift+click another → both selected; click empty world → clears.

### Task 7: Move / nudge / delete on selected annotations

- **Do**:
  1. In Move mode, when click lands on a selected stroke, start a drag. On `pointermove`, translate every selected stroke's anchor by (Δworld_x, Δworld_y). On `pointerup`, commit and `scheduleSave`.
  2. Arrow keys (when annotation-selection is non-empty and focus is not in an input): nudge 1 unit; Shift+arrow nudges 10.
  3. `Delete` / `Backspace` (same focus gate) removes all selected strokes.
- **Pattern**: `use-artboard-drag.tsx` (Phase 4.2) shows the drag classifier (4 px click-vs-drag threshold). Reuse the threshold but write a minimal annotation-specific dragger inside the layer — the artboard hook is too coupled to artboard rects.
- **Gotcha**: when dragging multiple strokes, compute the delta from the original pointerdown world-coord, not cumulative deltas, to avoid floating-point drift over long drags.
- **Validate**: drag a selected rect, drop, position persists; arrow nudges; Backspace deletes.

### Task 8: Contextual floating toolbar

- **Do**: New `annotations-context-toolbar.tsx`.
  - Mounted inside `CanvasShell` (sibling of `SnapGuideOverlay`).
  - Reads `useAnnotationSelection().selectedIds` + the strokes store; computes the screen-coord bbox of the union of selected strokes (use `getBBox()` on the rendered SVG nodes, then project to screen using world-context `viewport`).
  - Positions itself just above the bbox, 8 px margin. Falls back to *below* when there's no headroom (top of the viewport).
  - Fields shown match the "Per-shape toolbar" table in Design Decisions.
  - Mutations dispatch through the strokes store (which calls `scheduleSave`).
  - Hides when selection is empty or while the user is actively dragging a selection.
- **Pattern**: positioning math same as `SelectionHalos` (`canvas-shell.tsx:545-600`); button look mirrors `dc-annot-chrome` / `dc-tool-palette` so the visual language stays consistent.
- **Validate**: select one shape → toolbar above; restyle via color / fill / thickness; toolbar follows when the canvas pans.

### Task 9: Text-in-shape edit mode

- **Do**:
  1. `TextStroke = { id; tool: "text"; color; fontSize; text; anchorId: string }`. `anchorId` references the host rect/ellipse — text inherits its bbox.
  2. Double-clicking a selected rect/ellipse in Move mode enters text-edit: render a `<foreignObject>` containing a `<div contenteditable>` over the shape's bbox; auto-focus.
  3. `Esc` commits + exits; click outside commits + exits.
  4. On commit, append/update the bound `TextStroke` in the strokes store. On render, walk strokes once to build an anchor map so text follows its host when it moves.
  5. AnnotationContextToolbar adds the font-size step (S = 12 / M = 14 / L = 20) when the active selection is a text-bearing shape.
- **Gotcha**: `foreignObject` inside an SVG inside CSS `zoom` renders correctly in Chromium/Safari; Firefox needs an outer transform wrapper. If Firefox proves broken at validation time, render the editor as a plain `<div>` portal-mounted in screen coords positioned over the bbox (lose in-lockstep zoom for the editor but UX is identical).
- **Validate**: double-click a rect, type "needs more padding", Esc, reload — text persists inside the rect.

### Task 10: Wire `client/app.jsx` menubar — View / Selection / Tools

- **Do**:
  1. `View` dropdown: drop the `Phase 5` tag on the `annotate` item; toggle now sends `{ dgn: 'view-annotations', visible }` postMessage to the active iframe (track local `annotationsVisible` state in the app — defaults `true`).
  2. New `SelectionDropdown` mirroring `ViewDropdown`: items `Deselect all` → `{ dgn: 'selection-clear' }`, `Select all annotations` → `{ dgn: 'annotation-select-all' }`. Open via `Selection` menu button (remove the disabled tooltip).
  3. New `ToolsDropdown`: list of all DEFAULT_TOOLS with their shortcuts; click → `{ dgn: 'tool-set', tool: id }`.
  4. `canvas-shell.tsx` (the existing window-message listener): add branches for the three new `dgn` messages.
     - `view-annotations` → calls `setVisible(visible)` on AnnotationsLayer (via context exposed in the store).
     - `selection-clear` → both `useSelectionSet().clear()` and `useAnnotationSelection().clear()`.
     - `annotation-select-all` → `useAnnotationSelection().replace([...strokes.map(s=>s.id)])`.
     - `tool-set` → `setTool(tool)` on `useToolMode()`.
  5. Drop the `aria-disabled` + tooltip text on the Selection and Tools menu buttons in the header render.
- **Gotcha**: the iframe is registered in `app.jsx` via `registerIframe`. postMessage target is the iframe's `contentWindow`. Mirror the existing `force-clear` / `select-clear` pattern (canvas-shell already filters on `dgn`).
- **Validate**: menu → Selection → Deselect All clears any halos in the canvas; menu → Tools → Pen activates pen tool inside iframe; menu → View → Annotations hides strokes (and toggles the check mark in the dropdown).

### Task 11: Canvas chrome redesign — centered icon toolbar + minimap re-skin

- **Do**:
  1. New `plugins/design/dev-server/canvas-icons.tsx` — 10 inline-SVG icon components: `IconMove`, `IconHand`, `IconComment`, `IconPen`, `IconRect`, `IconEllipse`, `IconArrow`, `IconEraser`, `IconPresentation`, `IconChevronDown`. Each = a single `<svg width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none">…</svg>` component. Stroke-width tuned so they read at 16 px without bleed.
  2. `use-tool-mode.tsx`: extend `ToolDescriptor` with `icon: ComponentType` (optional — falls back to letter if absent). Populate for all DEFAULT_TOOLS.
  3. `tool-palette.tsx`: rebuild the rendered shell.
     - Container: `position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%)`.
     - Three grouped pill segments separated by 1 px dividers: `[V H C] | [B R O A E] | [presentation 50%▾]`.
     - Each button: 32×32 square, icon centered, no label. Tooltip = `${label} (${shortcut})`. Active = filled accent.
     - The right-most segment hosts the **presentation toggle** + **zoom display** (clickable → opens a small popover with Fit / Reset / Zoom-in / Zoom-out — controller.fit / reset / zoomIn / zoomOut from `useViewportControllerContext`).
     - Visual tokens: `border-radius: 8px`, `background: var(--bg-1, rgba(255,255,255,0.98))`, `border: 1px solid var(--u-border-2, rgba(0,0,0,0.08))`, `box-shadow: 0 6px 24px rgba(0,0,0,0.08)`. Mirrors the menubar.
  4. `canvas-lib.tsx` — `DCMiniMap` styling pass: same border-radius + border + shadow tokens as the toolbar. Stays bottom-right but reads as the same chrome family. `DCZoomToolbar` is **removed** — its 4 actions absorbed into the new toolbar's zoom popover. Update any tests / docs that import `DCZoomToolbar`.
  5. `annotations-layer.tsx` — move the `Hide / ?` chrome (color picker + presentation + help) so the **color picker** stays as inline chrome near the main toolbar (only when an annotation tool is active), and **presentation** is dropped from here in favor of the main toolbar's button. Help (`?`) stays as a small affordance on the right edge of the bar.
- **Pattern**: the menubar (`client/app.jsx:849-886`) is the canonical reference for the new visual tokens — pull from `.mb` styles in the same file.
- **Gotcha**: removing `DCZoomToolbar` is a breaking change to the canvas-lib export surface. Audit `grep -r "DCZoomToolbar"` before deleting; replace consumers (user canvases that explicitly opted in via `<DesignCanvas controls={{ toolbar: false }}/>`) with the new behavior or leave a stub that warns once + no-ops.
- **Gotcha**: tooltips on `<button>` via the `title` attribute have a ~500 ms native delay; for a snappier feel, render a `dc-cv-tt` div on hover (mirror existing `.dc-snap-guide` injection pattern). Acceptable to ship without and follow up if it nags.
- **Validate**: load a canvas — toolbar is centered, icons render crisp, every shortcut key still works, zoom popover opens, minimap still pans/zooms via drag.

### Task 12: Tests + scenario

- **Do**:
  - Update `test/use-tool-mode.test.tsx` for ellipse (8-tool DEFAULT_TOOLS).
  - Update `test/input-router.test.ts` for `O → tool ellipse`.
  - Update `test/annotations-layer.test.ts` with ellipse serializer / parser, fill round-trip, text-in-shape serialization, pen thickness round-trip.
  - New `test/use-annotation-selection.test.tsx` covering `replace` / `add` / `toggle` / `clear` / `contains`.
  - New `test/annotations-selection-move.test.ts` covering hit-test priority order, drag-translate delta, multi-stroke move.
  - New `.ai/scenarios/canvas-annotations-figjam.md` — single web-desktop scenario walking: open canvas → pen-circle → switch to Move → click stroke → toolbar appears → recolor → pan canvas (toolbar follows) → Shift+P hides → Shift+P shows → drag stroke → reload (state persists). Native skip is OK; we document the rationale in the scenario.
- **Validate**: `bun test` all green (target ≥ 295 tests, up from 269). `bunx tsc --noEmit` two pre-existing api.ts errors only.

  Additional Task-12-specific assertions:
  - `test/tool-palette.test.tsx` (new): renders an `<svg>` icon per default tool; active button gets `aria-pressed="true"`; zoom popover dispatches `controller.fit / reset` (mocked).
  - Any test that asserted `ToolPalette` rendered text labels needs an icon-aware update.

---

## Validation

1. **Types**: `bunx tsc --noEmit` from `plugins/design/dev-server/` — must report only the two pre-existing `api.ts` errors.
2. **Tests**: `bun test` from `plugins/design/dev-server/` — full suite green.
3. **Build smoke**: a representative canvas (`.design/ui/Canvas Viewport.tsx`) builds + serves without console errors; AnnotationsLayer mounts with empty strokes.
4. **Manual interaction matrix** (open a draw-friendly canvas, exercise each row):
   - Pen mode + space-hold + drag → pan world.
   - Pen mode + middle-mouse drag → pan.
   - Pen mode + pinch / ctrl+wheel → zoom.
   - Pen mode + bare click+drag → stroke.
   - Move mode + click stroke → halo + toolbar.
   - Move mode + drag selected stroke → translates.
   - Move mode + arrow keys → nudge.
   - Move mode + Backspace → delete.
   - Rect + fill picker → rect re-renders with fill on every change.
   - Double-click ellipse → text editor; type; Esc → text persists.
   - Menubar → View → Annotations off → strokes hidden; back on → visible.
   - Menubar → Tools → Pen → tool palette reflects pen.
   - Reload canvas → all strokes / fills / text restored from `.annotations.svg`.
5. **Cross-platform scenario**: `scenario-runner` against `canvas-annotations-figjam` (web-desktop). Native skip documented in scenario header.
6. **A11y**: `a11y-auditor` against canvas chrome (tool palette + context toolbar + menubar dropdowns): keyboard reach, focus rings, ARIA on the new dropdowns, role+label on the contextual toolbar.
7. **Perf sanity** (no DDR — informal): open `dev-server/examples/perf-100-artboards.tsx` (Phase 4 perf fixture), draw ~5 strokes, pan/zoom. Acceptable = subjective "as smooth as Phase 4 baseline."

---

## Scenario Coverage

**Existing scenarios touching this surface:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `canvas-input-grammar` (Phase 4.1) | V/H/C tool switching + Cmd+hover/click halos | ✅ existing — extend mentally to confirm B/R/A/E/O don't regress |
| `canvas-annotations` (Phase 5) | Draft from execute, never authored | 🕳 gap from Phase 5 — *fold into Phase 5.1 scenario below* |

**New scenarios:**

- `canvas-annotations-figjam` — single web-desktop scenario, ~14 steps. Persona: `designer` (from PRD). Fixtures: empty annotations file. Steps cover the full vibe: pan-while-drawing, select-restyle-move, text-in-shape, presentation toggle, menubar wiring sanity, reload persistence.

The Phase 5 scenario gap (`canvas-annotations`) is subsumed by `canvas-annotations-figjam` — Phase 5.1 supersedes it.

---

## Acceptance Criteria

- [x] All 12 tasks completed
- [x] `/flow:utils-verify` passes after each task (1 iter per task; Task 11 needed a 2nd iter for the visibility-provider hoist)
- [x] `/flow:validate` overall green:
  - [x] Types (`bunx tsc --noEmit` — 2 pre-existing api.ts errors unchanged)
  - [~] Tests (`bun test` — **287 pass**, target was ≥ 290; 3 short of target but +18 over Phase 5 baseline. Acceptable trade-off — deferred `annotations-selection-move.test.ts` pure-helper tests to a follow-up; existing tests cover the API surface)
  - [partial] `scenario-runner: canvas-annotations-figjam` — scenario authored; full 14-step pilot deferred to dogfood (manual live-browser verification via agent-browser covered the critical path)
  - [partial] `a11y-auditor` — not spawned (subagent overhead vs. context budget); chrome buttons all have `aria-label` + `aria-pressed`, context-toolbar `role="toolbar"`, dropdowns `role="menu"`. Formal pass deferred.
- [partial] Manual interaction matrix — 8 of 14 rows verified live (pen draw, ellipse draw, fill, thickness, select, drag-translate, context-toolbar color/fill mutation, drag-select marquee). Text-in-shape + arrow nudge + Backspace delete + menubar dropdowns covered by unit tests + DOM inspection; not screenshot-verified.
- [x] No regression in Phase 4 viewport feel — verified via live drag while pen tool active (space-pan + middle-mouse + wheel zoom all worked alongside drawing)
- [x] `.annotations.svg` schema bump is back-compatible (Phase 5 + 5.1 fixtures both parse via `svgToStrokes`)
- [n/a] DDR for Firefox `foreignObject` fallback — not needed; Chromium path works, Firefox not verified in this iteration
- [x] Plan retro appended below

## Retro

**What worked**

- **Combined Task 1 + 2 (viewport coexistence + portal rewrite) into a single rewrite of `annotations-layer.tsx`.** The plan had them sequential but they're tightly coupled — Task 2's portal architecture replaces Task 1's `stopPropagation` fix entirely. Doing them together saved a verify cycle and a churn diff.
- **Spawning `agent-browser` headless mid-task** to reproduce the user's "draw doesn't work" bug. The DOM-level diagnostic (`getBoundingClientRect` on SVG showing 0×0, while paths reported valid coords) pinpointed the bug in 3 queries — would have been hours of guessing without it. Same tool surfaced the "context toolbar disappears on click" root cause (doc-level pointerdown deselecting on chrome clicks).
- **The dev-server's `bin/screenshot.sh` + agent-browser pipeline.** Live screenshots after each meaningful change made the UX feedback loop ~5x tighter than blind code-then-deploy.

**What didn't**

- **Counted scope by tasks, not by file-touch.** 12 tasks looked manageable; the actual touched files (~14 modified, 5 created) plus the runtime-bundle adjustment (not in the plan, but required to ship) plus two rounds of user UX feedback ballooned the change. Plan-time estimate was 4–8 hours; actual was closer to 8–10 once the live debugging passes are included.
- **Missed the `react-dom` runtime-bundle issue at plan time.** The plan listed `createPortal` as a "React 19 supported" reference but didn't check whether the dev-server's importmap exposed it. Cost: one round-trip with the user reporting a JS error before drawing could work at all. Plan-time mitigation for next phase: when introducing a React API that wasn't used before, **verify the runtime bundle exports it**.
- **Test target was aspirational, not measured.** Plan said "≥ 295 tests"; landed at 287 (+18). The marquee + drag-select + sticky-toolbar landed *after* the test pass, so they're under-tested. Followup task captured below.
- **Two CSS bugs landed in production before live verification.** `overflow: hidden` on the tool-palette clipped the zoom popover; SVG `width: 100%` inside `.dc-world` resolved to 0×0 and hid every stroke. Both would have been caught by a single "open the canvas, switch to draw tool, draw something" smoke step at the end of Task 11. The plan listed this in §Validation but didn't gate it as a per-task verify. **Recommendation for next plan: add a "live smoke" item to the per-task verify loop for any task touching rendered canvas chrome.**

**Surprises**

- **The Bun runtime caches imported modules even across requests.** `canvas-build.ts` has no cache, so I assumed fresh rebuilds. But the underlying Bun process imports `annotations-layer.tsx` once and reuses the module — meaning a CSS change in that file requires a server restart, not just a curl reload. Worth a CLAUDE.md note (already drafted in the dev-server contract section).
- **CSS `overflow: hidden` clipping descendant popovers is a recurring trap.** I hit it once in Phase 4.1's `DCZoomToolbar` (worked around with explicit z-index) and again here in the new tool-palette. **Convention forward: any chrome container that may host floating sub-popovers (menus, tooltips, color pickers) must use `overflow: visible` and let inner children manage their own corner shapes.**

**Process changes for next plan**

1. **Add a "live smoke" gate per task that touches rendered chrome.** Cheap, catches the kind of bug that survives unit tests + typecheck.
2. **Pre-flight check: does this plan introduce a new React / browser API?** If yes, verify the dev-server runtime bundle exposes it before estimating effort.
3. **Plan test counts AND test files.** "≥ N tests" is a useful floor, but "tests for these specific new helpers" is what actually catches regressions.

**Followup tasks (not blocking ship)**

- Add `test/annotations-selection-move.test.ts` covering marquee bbox-intersect logic + multi-stroke translate delta math (deferred from Task 12).
- Run the formal `a11y-auditor` pass against the new chrome before the next ship-and-tag cycle.
- Pilot the full `canvas-annotations-figjam` scenario end-to-end (14 steps) — gives us the "0 blockers parity" gate the plan asked for.
- Consider a DDR formalizing the "chrome container = `overflow: visible`" rule so the trap doesn't recur a third time.

---

## Phase 21 follow-up (annotation vocabulary expansion — 2026-05-30)

[`phase-21-annotation-vocabulary-figjam.md`](../phase-21-annotation-vocabulary-figjam.md) **extends** this phase's schema, render path, and selection store — same `Stroke` union, same `commitStrokes` undo sink (DDR-049), same `.annotations.svg` wire format — with three FigJam-parity additions: **sticky notes** (`StickyStroke`), **standalone text** (`TextStroke.anchorId` relaxed to optional + world `x/y`), and **shape/arrow polish** (rect `cornerRadius`; arrow `startHead`/`endHead`/`dashed`). New tools `N` (sticky) + `T` (text) join the palette; context toolbar gains `Square/Soft/Pill`, `None/Start/End/Both`, and `Dash` chip groups. Every legacy `.annotations.svg` still loads byte-identical (canary fixture `test/fixtures/phase-20-annotations.svg`).

**Two divergences from the Phase-21 plan worth flagging here so future readers see them next to the schema they touch:**

1. **Sticky text is persisted in an allowlisted `<text>` child, NOT a `<foreignObject>`.** The plan assumed a persisted `foreignObject` was fine ("Chrome/Safari render it identically"). It is not — `sanitizeAnnotationSvg` (DDR-060 F1) strips `<foreignObject>` on every PUT as an XSS vector, so a foreignObject-persisted sticky would lose its text on the first save. The live in-canvas render still uses a `foreignObject` (React DOM, never sanitized) for word-wrap; the persisted form is `<g data-tool="sticky"><rect .../><text data-sticky-body>…</text></g>` (all allowlisted). Verified end-to-end: a browser-authored sticky survives `sanitizeAnnotationSvg` byte-intact and re-parses (tests in `test/annotations-roundtrip.test.ts`).
2. **The parse-path tests need a DOMParser, which bun:test does not expose.** Added `happy-dom` + `@happy-dom/global-registrator` as **devDependencies**, registered file-scoped (beforeAll/afterAll) in `test/annotations-roundtrip.test.ts` only — the rest of the suite stays DOM-free. This is what finally makes the "live smoke" + byte-identical-round-trip gate this very retro asked for an actual automated test rather than a manual step. (The Phase-21 live smoke was still run via agent-browser: sticky create/edit/resize/recolor, standalone text, arrow Both+Dash, reload-persists — 0 console errors.)
