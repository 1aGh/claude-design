# Feature: CSS-Grid track editor (on-canvas columns/rows + track drag-resize)

> **Stub — follow-up split off from `feature-element-editing-robustness.md` (Stage M, 2026-07-07 decision).** The flex/auto-layout editor (Stage M1/M2) shipped there; the CSS-Grid track editor is intentionally its own plan because grid's mental model (a 2-D track system with explicit cell placement) is materially different from flexbox's 1-D flow and warrants a dedicated design + interaction pass rather than being bolted onto the flex controls.

## Scope (one paragraph)

Give a `display: grid` container a first-class on-canvas track editor, matching what Figma auto-layout-grids and Webflow's Grid 2.0 give designers: define the column and row tracks, drag the track gutters directly on the canvas to resize a track (with Shift to resize both neighbouring tracks symmetrically), pick each track's unit (`px` / `%` / `fr` / `em` / `auto` / `min-content` / `max-content`), and place a child into a specific cell with corner-drag spanning across cells. This composes with the existing curated CSS knobs (`display: grid` is already a `CSS_DISPLAYS` option) and the Stage-D resize-handle geometry, but the track-gutter overlay + `grid-template-columns` / `grid-template-rows` / `grid-column` / `grid-row` source-write are net-new.

## Key requirements (to flesh out when picked up)

- **Define tracks** — a Grid section in the Inspector to add/remove columns + rows, edit `grid-template-columns` / `grid-template-rows` as a list of sized tracks, and set `gap` (reuse the existing `gap` knob).
- **On-canvas track drag-resize** — draggable gutter handles between tracks (a new fixed-rAF overlay, sibling to the Stage-J spacing overlay + Stage-D resize handles); dragging rewrites the two adjacent track sizes; `Shift` resizes both neighbours symmetrically. Live optimistic preview + `edit-css` commit + undo, exactly like the spacing/resize lanes.
- **Per-track unit** — a unit picker per track (`px` / `%` / `fr` / `em` / `auto` / `min-content` / `max-content`); `fr` is the grid-native flexible unit and must round-trip.
- **Manual cell placement** — select a child, assign `grid-column` / `grid-row` (start / span), with a corner-drag to span across cells on the canvas.
- **Predictability + reuse** — honor the Stage-H edit-scope model (a grid child inside a reused component follows the same local-vs-shared rules), the DDR-054 main-origin-only write posture, and INV-1 (every track edit undoable) / INV-2 (no flicker).

## Deep-research citation

- [Webflow University — Grid 2.0](https://university.webflow.com/videos/grid-2-0) — the reference interaction model for on-canvas grid track editing (define tracks, drag gutters, per-track units, cell placement) that this plan should match so a Webflow/Figma user recognizes it.

## Status

> **✅ IMPLEMENTED (2026-07-18) as T5 of [`feature-3-web-artboards.md`](../feature-3-web-artboards.md).** Define-tracks (Inspector Grid section, per-track unit picker incl. `fr` round-trip), on-canvas gutter drag-resize (Shift = symmetric neighbors), and manual cell placement (Inspector `grid-column`/`grid-row` fields) all shipped. **One disclosed scope trim**: on-canvas corner-drag cell-span was NOT built — cell placement is Inspector-field-only (start/span text entry), not a draggable on-canvas handle; see [DDR-186](../../decisions/DDR-186-web-artboards-breakpoint-duplicate-and-grid-track-editor.md) "Revisit when" for the follow-up shape. This file is archived as the interaction spec of record; the shipped implementation lives in `apps/studio/grid-track-handles.ts` + `apps/studio/use-grid-track-handles.tsx` + the CssKnobs "Grid"/"Grid item" sections in `apps/studio/client/app.jsx`.

Grounded in the same deep-research pass that produced `feature-element-editing-robustness.md` Stage M; picked up after the flex/auto-layout editor landed and got dogfooded.
