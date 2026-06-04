# DDR-090 — Highlighter as a PenStroke flag, not a new stroke type

**Date:** 2026-06-04  
**Status:** accepted  
**Feature:** annotation-tooling-polish (item 8)

## Decision

The `'highlighter'` **tool** maps to a `PenStroke` with `highlighter: true`
(a new optional flag), reusing all existing pen draw / erase / hit-test /
translate logic. It does **not** introduce a new stroke type (e.g. `HighlighterStroke`).

Serializes via `data-highlighter="1"` emitted **only when true**; absent/false
stays byte-identical to a normal pen (canary safe).

## Context

A FigJam-style highlighter produces a wide, translucent stroke where overlapping
strokes darken (`mix-blend-mode: multiply`). Two implementation options existed:

- **A) New stroke type `HighlighterStroke`**: parallel type in the union, own
  serialize/parse/render/bbox/hit-test/translate branches.
- **B) PenStroke flag**: `highlighter?: boolean` on the existing `PenStroke`;
  render branch adds `style={{ mixBlendMode: 'multiply' }}` and uses the
  pen's width as the nib size.

## Rationale for B

Pen logic already handles all five cross-cutting concerns (draw, erase,
hit-test, translate, undo). Duplicating them for a shape that is geometrically
identical (a polyline) is pure overhead. The only behavioural difference is the
render style (opacity + blend mode + wide width) — achievable with a single
conditional in `StrokeNode`.

Option A would add 5+ new code paths, a new frozen fixture, and a wider
serializer surface, for no gain in correctness.

## Consequences

- Highlighter and pen strokes are stored in the same `<path>` element;
  `data-highlighter="1"` is the sole discriminant.
- The `'highlighter'` tool id is in the `Tool` union and `ANNOTATION_TOOLS`
  set; the input-router, use-tool-mode, tool-palette, canvas-cursors, and
  canvas-icons all register it as a first-class tool.
- Future: if a custom eraser radius or blend mode per-stroke is needed, the
  flag can be promoted to a richer discriminant without a schema migration.
