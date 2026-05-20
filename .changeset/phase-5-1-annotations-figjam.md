---
"@1agh/md-claude": minor
---

**Design plugin — Phase 5.1: FigJam-style annotation overhaul + canvas chrome redesign.**

The Phase 5 draw layer was write-once: pen/rect/arrow strokes worked, but you couldn't re-select, re-style, move, or delete what you'd drawn, the viewport stuttered, and the dev-server menubar's `View / Selection / Tools` items were inert. Phase 5.1 brings annotations close to FigJam, with a single centered canvas toolbar that replaces the three floating chrome pieces.

**Annotation rendering**

- **Portal architecture.** The annotation SVG renders **inside** `.dc-world` via `createPortal`, so the world's CSS `zoom` + `translate` propagate to strokes natively — zero-latency pan/zoom (Phase 5's one-frame shimmer is gone). The input layer is a separate transparent overlay portaled into the host (`.dc-canvas`); viewport gestures (space-pan, middle-mouse, wheel/pinch) coexist with draw mode without `stopPropagation`. See `DDR-029`.
- **New shapes.** `O` activates the ellipse tool. Rect + ellipse both gain a **fill picker** ("none" + 6-color palette). Pen + arrow gain a **thin / thick** thickness chip (2 px / 6 px). Schema is back-compatible — Phase 5 SVGs round-trip cleanly.
- **Text-in-shape.** Double-click a selected rect or ellipse → `<foreignObject>` editor opens centered in the shape's bbox. Type your label, `Esc` commits; reload preserves. Font size step (S / M / L) lives in the contextual toolbar.

**Annotation selection + editing**

- **Parallel selection store.** `AnnotationSelectionProvider` mirrors `use-selection-set` for stroke IDs. Move-tool bare click on a stroke selects (replace), Shift+click adds. `Cmd / Cmd+Shift` falls through to the existing element-selection path (Phase 4.1 escape hatch preserved). Element + annotation selection don't co-exist visibly.
- **Marquee drag-select.** In Move mode, drag from empty world → screen-coord rectangle expands as you drag; on release every stroke whose bbox intersects gets selected (Shift = additive). Sub-4-px gestures fall back to "click on empty world → clear".
- **Contextual floating toolbar.** Per-shape FigJam-style toolbar anchored above the selection union bbox. Color (always), fill (rect/ellipse), thickness (pen/arrow), font-size (text), delete (always). Fields show the intersection across multi-select. Mutations route through a lifted strokes store and trigger the same debounced PUT save as drawing.
- **Move / nudge / delete.** Drag a selected stroke (or the group) → world-coord translate, persists on release. Arrow keys nudge 1 unit (`Shift` = 10). `Backspace` / `Delete` removes selection.

**Canvas chrome redesign**

- **Single centered bottom toolbar** replaces `ToolPalette` + `DCZoomToolbar` (the bottom-right pill). Icon-based buttons grouped into three pill segments: nav (V/H/C) · draw (B/R/O/A/E) · view (presentation toggle + zoom display). Adopts the dev-server menubar's visual language (8 px radius, soft shadow, hairline border) so canvas chrome and app chrome read as one product. New `canvas-icons.tsx` ships a dependency-free Lucide-style icon set.
- **Color/fill/thickness chrome** sits **directly above** the tool toolbar (centered) when a draw tool is active. Stripped of the Phase 5 "Hide" + "?" buttons — presentation lives on the main toolbar, annotation shortcuts live in the menubar `Help` modal.
- **Minimap** restyled to the same chrome family (8 px radius, 24 px shadow), unchanged behavior.
- **Zoom popover** absorbs the legacy `DCZoomToolbar`'s four actions (Zoom In / Out / Fit / Actual Size). Opens above the toolbar with shortcut hints. `DCZoomToolbar` is kept exported for back-compat but no longer rendered by `DesignCanvas`.

**Dev-server menubar bridge**

- `View → Annotations` toggles visibility (replaces the disabled "Phase 5" tag).
- New `Selection` dropdown: `Deselect all` / `Select all annotations`.
- New `Tools` dropdown: every tool with its shortcut, click → activates inside the canvas iframe via the existing `dgn:*` postMessage channel.
- `HelpModal` gains an **Annotation tools** section so all 11 shortcuts (B/R/O/A/E, V+click, V+drag, double-click, arrow nudge, Backspace, Shift+P) live in one searchable place.

**Runtime + build**

- `react-dom` is now its own runtime bundle (was aliased to `react-dom/client`, which omits `createPortal`). Importmap routes `react-dom` → `/_canvas-runtime/react-dom.js`. See `DDR-029`.
- New annotation modules: `use-annotation-selection.tsx`, `use-annotations-visibility.tsx`, `annotations-context-toolbar.tsx`, `canvas-icons.tsx`.
- New `.gitignore` rule for `.design/**/*.annotations.svg` (per-canvas review scratch is user-local, not source).
- `bun test` 287/287 pass (+18 over Phase 5 baseline). `bunx tsc --noEmit` clean (modulo 2 pre-existing `api.ts` errors).
- New scenario `canvas-annotations-figjam` (14-step web-desktop walkthrough); supersedes Phase 5's `canvas-annotations`.
- `DDR-029` recorded — annotation overlay architecture (portal into world, large SVG dimensions, react-dom bundle split).
