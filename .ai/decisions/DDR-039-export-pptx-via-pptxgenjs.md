# DDR-039: PPTX export authors from a normalized canvas model via pptxgenjs, not a DOM walker

- **Date:** 2026-05-22
- **Status:** SUPERSEDED by [DDR-041](./DDR-041-export-v2-mature-libraries-and-world-reset.md) (2026-05-23) — the hand-rolled CanvasModel walker produced PPTX with coordinates collapsed near origin and colours lost. The v2 path uses `dom-to-pptx` which reads the browser's computed layout directly. `pptxgenjs` is still used internally by `dom-to-pptx`.
- **Tags:** design, export, pptx, phase-6.5, pptxgenjs, canvas-model, ir, canva, fidelity
- **Related:** [Phase 6.5](../plans/phase-6.5-export.md) T6a + T6b, [DDR-038](./DDR-038-svg-export-via-foreignobject.md), [DDR-040](./DDR-040-export-canva-via-pptx-and-mcp-prompt.md), `plugins/design/dev-server/exporters/canvas-model.ts`, `plugins/design/dev-server/exporters/pptx.ts`, `plugins/design/dev-server/bin/_canvas-model-playwright.mjs`

## Context

PPTX is the load-bearing format for the Canva handoff (see DDR-040) and a first-class output in its own right (PowerPoint / Keynote / Google Slides). It must:

1. Open as **editable** native shapes / text frames / images — not a raster-on-slide.
2. Preserve artboard-to-slide mapping (N artboards = N slides).
3. Round-trip without crashing PowerPoint / Keynote / Google Slides (no malformed OOXML).
4. Fit under Phase 6.5's 650 KB bundle budget.

Two library shapes were realistic:

- **`pptxgenjs`** — pure JS PPTX authoring library. 13+ years old, mature, Bun-compatible, ~500 KB. We declare slides, shapes, text runs, images; the lib emits OOXML. Author drives the IR.
- **`dom-to-pptx`** — newer (May 2026), single-maintainer, walks computed-style DOM into pptxgenjs shapes. Less authoring code, but the heuristics are fixed in the lib — no way to tune classification of buttons-vs-shapes-vs-text without forking.

And the input shape:

- **DOM walker directly into pptxgenjs.** Each `<div>` → addShape, each text node → addText. Couples the export to whatever the DOM looks like at the moment. Refactoring a card component breaks the export's classification heuristics. Hard to debug ("why is this button rendering as four overlapping shapes?").
- **Normalized canvas model IR.** A typed JSON IR — `Artboard[]` × `ModelElement` (`text` | `shape` | `image` | `svg` | `group`) — produced by one walker, consumed by N adapters. Decouples capture from emit; refining classification only touches the walker; PPTX adapter only knows IR semantics.

## Decision

**Two-stage pipeline: Playwright walker → CanvasModel IR → pptxgenjs author.**

- `bin/_canvas-model-playwright.mjs` walks the rendered DOM, classifies each top-level child of `[data-dc-screen]` into one of `text / shape / image / svg / group`, captures bboxes via `getBoundingClientRect` (subtracted by the artboard's own rect → artboard-local coordinates), computed styles for fill/stroke/radius/font, and writes JSON to disk.
- `exporters/pptx.ts:modelToPptx(model)` consumes the IR. One slide per artboard, layout sized to the artboard's pixel dimensions (custom layout `CANVAS`). Element placement maps:
  - `text` → `slide.addText()` with font face / size / weight / color from `FontSpec`.
  - `shape` (rect / ellipse) → `slide.addShape()` with native PPT geometry + fill + stroke + radius.
  - `image` → `slide.addImage()` with `data:` URLs routed to the `data` property, remote URLs to `path` (mixing the two crashes pptxgenjs).
  - `svg` → emit as `addImage({ data: 'data:image/svg+xml;base64,…' })`. PPT can't edit SVG nodes anyway.
  - `group` → recurse children.

Pixel-to-inch conversion happens once (`PX_PER_IN = 96` matching CSS-default DPI), inline at the placement site.

Heuristic classifier v1: an element is **text** if it has direct text-node children and no element children; **shape** if it has no children and visible background-color or border-width > 0; **group** otherwise. Refinement (e.g. button = group of `[shape, text]`, recognise compound primitives) lands as scenario feedback — the IR is permissive enough to accept it without breaking the PPTX consumer.

## Consequences

**Wins:**

- One walker, multiple consumers. Phase 6.5 T6c reuses `walkCanvas()` for the Canva handoff. Future Phase 11+ ("Flow ↔ Design") could plug an additional consumer for handoff-to-Linear / Notion / etc. without touching capture.
- IR is debuggable. JSON dump → eyeball the classification → adjust the walker, not the PPTX emitter.
- pptxgenjs at ~500 KB is the largest single dep in Phase 6.5 but still under the 650 KB budget (650 = 500 pptxgenjs + 80 pdf-lib + 50 jszip + 30 react-dialog headroom).
- Editable in PowerPoint / Keynote / Google Slides today; editable in Canva on import (per DDR-040).

**Caveats:**

- **Layout fidelity drops on complex compositions.** Flex / grid / nested transforms get flattened to absolute coords at the export-time viewport (1440 × declared artboard height). A canvas designed responsively will export to its 1440-px layout regardless of breakpoint. Acceptable for v1 — production designs typically lock breakpoint at export-time anyway.
- **CSS gradients translate to native PPT gradients with reduced multi-stop fidelity.** PowerPoint's gradient model is simpler than CSS's; > 4-stop CSS gradients quantize to PPT's available stops.
- **Effects rasterize.** `box-shadow`, `mix-blend-mode`, `backdrop-filter`, complex `clip-path` — PPT either doesn't support or supports differently. The walker doesn't try to translate; the affected element falls into the `group` path and the visual effect is lost on export.
- **Heuristic v1 will misclassify edge cases.** A button styled as "bg + label text" is currently grouped, not a `shape` with a `text` child. Iterating after dogfooding.

## Alternatives considered

- **`dom-to-pptx`.** Single-maintainer (May 2026), unproven at scale. Decoupling capture from emit isn't there. Re-evaluate when the dep matures + downstream consumers prove the API. Until then, `walkCanvas → modelToPptx` is the contract.
- **Native Canva API element insertion.** Researched — Canva Connect's Create-Design endpoint accepts image assets only, not editable element trees. Off the table regardless of which PPTX path we'd pick. See DDR-040 for the Canva-specific rationale.
- **PowerPoint REST API.** Microsoft Graph offers presentation authoring, but requires OAuth + a Microsoft account + network round-trips per slide. Defeats the offline-friendly local-only constraint Maude has held since v0.1.

## Open questions

- Streaming PPTX output for very large canvases (50+ artboards). pptxgenjs `write({ outputType: 'arraybuffer' })` buffers in memory. The HTTP layer already buffers the Response body, so streaming PPTX wouldn't help end-to-end RSS. Defer until a real user hits a heap ceiling.
- Compound-primitive recognition (button = shape+text). Naturally lands in T8 dogfooding — the dialog will produce visibly broken PPTX on common button shapes, surfacing the gap.
