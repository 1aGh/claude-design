# DDR-091 — List markers are render-only; raw text is stored

**Date:** 2026-06-04  
**Status:** accepted  
**Feature:** annotation-tooling-polish (item 4c)

## Decision

`listType?: 'bullet' | 'number'` on `TextStroke` and `StickyStroke` activates
list rendering, but **the stored `text` field carries no markers**. Markers
(`• ` / `N. `) are prepended at render time only — in `StrokeNode` tspans,
`stickyBodyText()`, the editors' display, and `strokeToSvgEl` tspans.

On commit, `stripEditorMarkers()` removes any markers the user sees in the
editor before writing back to the stroke model.

## Context

Two options:
- **A) Store markers in `text`**: simpler render — just emit `text`; harder
  editing (contentEditable must not accidentally duplicate/mangle the prefix;
  switching list type requires rewriting every line).
- **B) Store raw text; compute markers at render**: editing stays clean (user
  types "milk", sees "• milk", commit strips back to "milk"); switching
  `listType` from bullet → numbered instantly re-derives the correct markers
  with no stored-text migration.

## Rationale for B

Option A pollutes the stored string and creates a subtle class of bugs where
markers accumulate across edit cycles (the exact bug we observed in testing
before this DDR was locked). Option B keeps `text` semantically clean and
makes the toolbar-toggle stateless — flipping `listType` re-renders correctly
without touching `text`.

The tradeoff: a raw-SVG consumer reading `<text>` content sees markers in the
tspan children (render form), not in the top-level `text` attribute. This is
acceptable because (a) the serializer always emits markers in tspans, and
(b) `svgToStrokes` strips them back via `stripListPrefix` on parse.

## Consequences

- `data-list="bullet|number"` on `<text>` elements is the round-trip
  discriminant; absent = no list.
- `listPrefixedBody` / `listPrefixedLine` / `stripListPrefix` /
  `stripEditorMarkers` are the four helper functions that enforce this contract.
- Canary: `data-list` absent on unstyled text; round-trip test confirms
  stored text stays marker-free.
