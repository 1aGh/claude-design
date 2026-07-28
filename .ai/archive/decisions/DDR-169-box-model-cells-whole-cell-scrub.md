# DDR-169: Box-model cells (margin/padding/inset/corner) keep whole-cell scrub, not a separate drag-handle

**Status:** Accepted — 2026-07-14
**Extends:** feature-inspector-controls-redesign (Phase 1 — the shared `inspector-controls.jsx` control library), the `NumberField` drag-handle interaction model it introduced for standalone number fields.

## Context

Phase 1's `NumberField` moved scrub off the input body onto a dedicated prefix drag-handle (`.st-cp-handle`, `ew-resize`, `role="presentation"`) so a click-to-edit and a drag-to-scrub never compete for the same hit target. That's the right model for a standalone field with room for a separate handle.

The box-model widgets (`side()` for margin/padding, `inset()` for position top/right/bottom/left, `corner()` for per-corner radius) render each value as a compact **36×24px cell** packed into a nested diagram (see `apps/studio/client/app.jsx`, the `.st-cp-box`/`.st-cp-boxpad` structure). A cell this small has no room for both a visible drag-handle glyph AND a legible numeric value without either shrinking the text below the a11y-reviewed size floor or clipping the handle.

## Decision

Box-model cells deliberately **keep whole-cell scrub** — the entire 36×24px cell is the drag surface (`ew-resize` on hover, same modifier grammar as `NumberField`: Alt = opposite side, Alt+Shift = all four), rather than carving out a separate handle region. This mirrors the Figma/Webflow convention for box-model/spacing-diagram cells at this size — neither product gives spacing-diagram cells their own drag-handle glyph; the whole cell scrubs.

What box-model cells DO gain from Phase 1's shared engine, via the same `makeScrubHandler`/`useScrub` primitives `NumberField` uses:
- Select-all-on-focus (click once → the value is selected, ready to retype).
- Arrow-key stepping (Up/Down ± step, Shift ×10), matching `NumberField`'s keyboard model.
- The same dead-zone/modifier math (~3px dead-zone so a click isn't misread as a 1px scrub).

What they do NOT get: a separate icon/label prefix. The whole-cell-is-the-handle model is the deliberate, permanent shape for this control — not a placeholder pending a future handle redesign.

## Consequences

- Box-model cells and standalone `NumberField`s now share one scrub engine (`makeScrubHandler`) but present it through two different affordances (dedicated handle vs. whole-cell) depending on available cell width — this is documented here specifically so a future contributor doesn't "fix" the box-model cells to match `NumberField`'s handle pattern without knowing it was a considered, sized-based choice, not an oversight.
- If a future redesign gives box-model cells more width (e.g. a wider panel default), revisit whether a handle affordance becomes viable — this DDR's scope is the current 36×24px cell size, not a permanent ceiling on the widget's dimensions.
