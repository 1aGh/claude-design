# DDR-038: SVG export wraps rendered HTML in `<foreignObject>` rather than vector-serializing the DOM

- **Date:** 2026-05-22
- **Status:** SUPERSEDED by [DDR-041](./DDR-041-export-v2-mature-libraries-and-world-reset.md) (2026-05-23) — user dogfooded the foreignObject SVG and confirmed Affinity Designer refuses to import it. The v2 path uses `dom-to-svg` for real SVG primitives.
- **Tags:** design, export, svg, phase-6.5, foreignobject, playwright, fidelity
- **Related:** [Phase 6.5](../plans/phase-6.5-export.md) T4, [DDR-039](./DDR-039-export-pptx-via-pptxgenjs.md) (sibling decision for PPTX), `plugins/design/dev-server/exporters/svg.ts`, `plugins/design/dev-server/bin/_svg-playwright.mjs`

## Context

The SVG export needs to produce a file that:

1. Opens in any browser at pixel-perfect fidelity to the canvas.
2. Imports into Illustrator / Inkscape with text remaining selectable + editable.
3. Renders without external font requests on offline machines (eventually — v1 punts).

The naive paths considered:

- **Rasterize the canvas and wrap the PNG in an `<svg>`-`<image>`.** Loses every editable property — defeats the format choice.
- **Vector-serialize the rendered DOM** (each `<div>` → `<g>` of `<rect>`s, each text node → `<text>`). The output is fully editable but requires re-implementing browser layout: CSS `flex`/`grid`/`position` rules, line breaking, font-fallback chains. The fidelity ceiling is roughly "what we re-implement"; the floor is "complete divergence on anything we miss." This is roughly a year of compounding edge cases.
- **`<foreignObject>` wrapping the rendered HTML.** SVG's escape hatch — a sub-document that contains arbitrary XHTML rendered by the host browser. Pixel-perfect by definition (it IS the same rendered HTML); editable text passes through to Illustrator and Inkscape where the foreignObject is unwrapped into an HTML subtree.

## Decision

Ship the `<foreignObject>` approach. `bin/_svg-playwright.mjs` walks the rendered DOM via Playwright, captures `outerHTML` + concatenated stylesheet text (`document.styleSheets.cssRules`), and emits an SVG of the shape:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H">
  <defs><style>/* all stylesheet rules */</style></defs>
  <foreignObject x="0" y="0" width="W" height="H">
    <div xmlns="http://www.w3.org/1999/xhtml"><!-- outerHTML --></div>
  </foreignObject>
  <!-- inline <svg> elements lifted out -->
</svg>
```

Inline SVG children of the artboard are lifted as siblings of the `<foreignObject>` rather than nested inside it. They're already valid SVG — keeping them outside the foreignObject preserves vector-primitive editability in Illustrator.

## Consequences

**Wins:**

- v1 SVG ships in ~120 lines of TypeScript + Playwright. The vector-serialize alternative was estimated at 1500+ lines and would have blocked Phase 6.5.
- Pixel-perfect match to the canvas. CSS gradients, blend modes, box-shadow, `mix-blend-mode`, complex `clip-path` — everything Chrome paints, Chrome paints again from the foreignObject.
- Inline `<svg>` icons (Lucide etc.) remain native vector primitives, lifted out of the foreignObject envelope.

**Caveats — documented in `plugins/design/docs/canva-handoff.md` and inline in the generated SVG:**

- **Safari renders `<foreignObject>` inconsistently.** macOS Safari and iOS WebKit have known bugs where text inside `<foreignObject>` reflows differently from the source canvas, especially with complex flex layouts. Files render fine in Chrome / Firefox / Edge.
- **Illustrator imports foreignObject but flattens nested HTML into stacked text frames.** Editable but the source DOM hierarchy is lost. Inkscape preserves the structure better.
- **Web fonts are NOT inlined in v1** — the SVG references `@font-face` URLs by their origin. On the consuming machine, the font either resolves (online + same origin allowed) or falls back to a system font. Inlining web fonts as base64 `@font-face` data URLs is a follow-up; the share between SVG and HTML (which has the same need) lands when one of them grows the requirement.
- **Cross-origin stylesheets are skipped** during the walk (CORS — `sheet.cssRules` throws). The dev-server serves CSS same-origin so this doesn't bite in practice, but a user-authored canvas that pulls a CDN stylesheet without CORS headers will lose those styles in the export.

The SVG carries a top-of-file comment flagging the foreignObject choice + linking back to this DDR for anyone debugging visual divergence between the canvas and a downstream consumer.

## Alternatives considered

- **`dom-to-svg` (npm package).** Same approach we landed on, but written for arbitrary DOMs. Pulls in additional dependencies (~200 KB) for marginal value beyond what 80 lines of `page.evaluate()` already does. Re-evaluate if our home-grown shim grows past 300 LoC.
- **Server-side DOM emulation (jsdom + happy-dom).** Avoids spinning up Chromium, but the layout engines are partial implementations — flex/grid behaviors diverge from Chrome enough to be its own fidelity problem. Plus Playwright is already a dev-time dep for screenshots.
- **Punt SVG to v1.1.** Considered. Rejected by user — SVG is explicitly in scope for Phase 6.5. Fidelity is acknowledged as "good for browser, partial for Illustrator, broken for Safari."

## Open questions

- When font inlining lands, do we share the inliner with HTML (which faces the same problem) or per-format? Likely shared via `exporters/inline-assets.ts` — declared in the plan, deferred during execution.
- Does Canva ever consume our SVG? Per plan T6c the answer is no — Canva's import ladder bottoms out at SVG (one non-decomposable element, Pro/Teams tier). The SVG export is for designers handing off to print/Illustrator workflows, not Canva.
