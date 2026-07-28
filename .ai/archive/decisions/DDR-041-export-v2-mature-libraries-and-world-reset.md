# DDR-041: Export v2 — `page.pdf` / `dom-to-svg` / `dom-to-pptx` + world-plane reset + hide-chrome shell flag

- **Date:** 2026-05-23
- **Status:** Accepted — supersedes DDR-038 + DDR-039
- **Tags:** design, export, phase-6.5, playwright, dom-to-svg, dom-to-pptx, page.pdf, fidelity, vector, affinity, oklch
- **Related:** [Phase 6.5](../plans/phase-6.5-export.md), [DDR-038](./DDR-038-svg-export-via-foreignobject.md) (superseded), [DDR-039](./DDR-039-export-pptx-via-pptxgenjs.md) (superseded), [DDR-040](./DDR-040-export-canva-via-pptx-and-mcp-prompt.md) (still applies — Canva path is PPTX + MCP-prompt regardless of which engine builds the PPTX)

## Context

Phase 6.5 shipped v1 of the export feature on 2026-05-22 with three home-grown approaches: PDF via `pdf-lib` over PNG embed (raster), SVG via `<foreignObject>` wrapping outerHTML (DDR-038), PPTX via a hand-rolled DOM walker emitting `pptxgenjs` shapes (DDR-039). The user dogfooded the exports the same day and reported:

- **PDF was a TIFF inside a PDF wrapper** — Spotlight confirmed `kMDItemTextContent = null`, no selectable text. Designers expected vector + searchable text.
- **SVG had errors in Affinity Designer** — foreignObject is a known incompatibility; Affinity / Illustrator / Inkscape can't decompose it.
- **PPTX was "uplne rozhozeny bez css"** — coords collapsed near origin, all colours `#000000`, font sizes 7.5pt. The hand-rolled walker's heuristics couldn't classify a real-world canvas (marketplace landing) into editable PPTX shapes.
- **PNG exports were ~50% of the artboard size** with a strip of dev-server chrome (tool palette, world map mini, artboard labels) visible.

Two parallel research subagents (PDF+SVG / PPTX) returned converging recommendations: stop hand-rolling, use the libraries the broader web already debugged, and fix the cross-cutting capture-environment bug.

## Decision

Three engine swaps + two shell-side fixes. All five land together because the bugs compound — fixing only the engine without the capture environment still produces broken output.

### 1. PDF: `pdf-lib`-over-PNG → `playwright page.pdf()`

Drop `pdf-lib`-as-page-builder. `bin/_pdf-playwright.mjs` calls `page.pdf({ width, height, printBackground:true, preferCSSPageSize:false, margin:0 })` after `page.emulateMedia({ media: 'print' })` + `await document.fonts.ready`. Chromium's print-to-PDF emits real PDF text objects, vector paths for borders/backgrounds/inline-SVG, and embeds @font-face fonts. `pdf-lib` survives as a one-trick `copyPages` concatenator for multi-artboard documents — never used for embedding.

### 2. SVG: `<foreignObject>` → `dom-to-svg` (felixfbecker, Sourcegraph)

Drop the foreignObject wrapper. `dom-to-svg@0.12.2` walks the rendered DOM via `getComputedStyle` + `getBoundingClientRect` and emits real SVG primitives — `<rect>`, `<text>`, `<g>`, `<path>`, `<image>`. Verified output: 211 `<g>`, 52 `<rect>`, 162 `<text>` for the marketplace landing artboard. Affinity Designer decomposes the result; foreignObject errors are gone. The library is stale-but-functional (last release 2021-07) — the algorithm is closed-form (computed styles → SVG nodes) and doesn't bit-rot.

### 3. PPTX: hand-walker + pptxgenjs → `dom-to-pptx@1.1.9`

Drop the home-grown DOM walker. `dom-to-pptx` (atharva9167j, last push 2026-05-16) is the only library actively solving HTML→editable-PPTX with the same architecture as `dom-to-svg`: read the browser's layout via `getBoundingClientRect`, place each element on a slide via `pptxgenjs`. v1.1.x ships fixes for the exact failures we hit — flexbox axis-swap, OKLCH color parsing, subpixel rounding, font CORS embedding. Verified output: 14 distinct `srgbClr` values in slide1 (paper-ink `#1E130E`, amber-rust accent `#BE4C00`, status greens, mono grays). Multi-artboard merge handled in our adapter via JSZip slide concatenation (dom-to-pptx writes one slide per call).

### 4. Cross-cutting fix #1: `?hide-chrome=1` shell flag

The dev-server canvas-shell injects runtime overlays (`.dc-tool-palette`, `.dc-mini-world-map`, halos, snap guides, annotation chrome, artboard labels) so designers can iterate. These leaked into every export because the shell mounts them unconditionally. Exporters now pass `?hide-chrome=1` on the shell URL; the shell has a tiny `<style id="canvas-hide-chrome" media="not all">` rule that flips to `media="all"` when this flag is set. Three lines of inline script, no plumbing changes to the canvas runtime.

### 5. Cross-cutting fix #2: world-plane zoom + transform reset

`.dc-world` uses CSS `zoom: <fraction>` (NOT `transform: scale()`) to render its multi-artboard plane at fit-to-screen scale, plus `transform: translate()` for pan. CSS `zoom` actually shrinks layout — `getBoundingClientRect` returns post-zoom dimensions. A 1440×900 artboard reports 818×512 if the world is at 0.568× zoom. All five capture shims (PNG / PDF / SVG / HTML / PPTX) now run a pre-capture `world.style.zoom='1'; world.style.transform='none'; artboards.style.left='0px'; artboards.style.top='0px'` to restore native dimensions. Without this, every export comes out scaled-down with the world-plane grid visible around the artboard.

## Consequences

**Wins:**

- Single-artboard PDF opens in Preview/Acrobat with **selectable text**. Vector primitives carry through to Illustrator if the user wants to refine.
- SVG decomposes in **Affinity / Illustrator / Inkscape / Figma**. The output is real SVG, not a Chrome-only foreignObject.
- PPTX carries the **right palette and approximate layout** — text is editable text, shapes are editable shapes, native PPT primitives. Tested at 5-slide canvas-as-separate export (760 KB, 5 slides, distinct colours per slide).
- PNG / SVG / PDF / PPTX all capture **the artboard alone**, no tool palette / world map / halos.
- Bundle delta: +`playwright` (dev-only), `+dom-to-svg` (~50 KB), `+dom-to-pptx` (~150 KB, pre-bundled UMD). Net under the 650 KB ceiling because `pdf-lib`-as-renderer dropped out.

**Caveats:**

- `dom-to-svg` last release was 2021. Functional, but no active maintenance — if the algorithm breaks against a new CSS feature, we'd have to fork. Mitigation: vendor the version + add a golden-SVG regression test before any version bump.
- `dom-to-pptx` is 5 months old, single maintainer (atharva9167j). v1.1.x explicitly ships fixes for the failures we hit, but the dependency carries v1-shape API risk. Mitigation: pinned `^1.1.9`, vendor if the package goes dark.
- Web fonts: `Berkeley Mono` is commercial and not redistributable. The PPTX will substitute the system fallback in environments without it (Canva web defaults to Arial). Free fonts (`JetBrains Mono`, `Inter`) carry through fine.
- The browser-bundle helper (`exporters/_browser-bundles.ts`) re-bundles `dom-to-svg` via `Bun.build` at first use because the lib only ships ESM. Cached under `/tmp` so subsequent exports skip the build. ~200ms one-time cost.
- World-plane reset mutates `.style.left/top` on every `[data-dc-screen]` in the captured page. Cosmetic — playwright's page state doesn't persist across requests — but if a future read-back hits the same page handle, expect the meta.json's layout positions to look off until the next navigation.

## Anti-references — explicitly rejected

- **`pdf-lib` for PDF authoring beyond multi-page concatenation.** Embeds PNG as raster, defeats the format choice.
- **`html2pdf.js`, `puppeteer-html2pdf`, html2canvas-based PDF pipelines.** All rasterize first; user's complaint applies to every member of this family.
- **`<foreignObject>` SVG wrapping.** Renders pixel-perfect in Chrome only. Affinity / Illustrator / Inkscape / Figma reject or strip it. Vercel Satori is the JSX-input variant of the right approach (real SVG primitives) but only supports flexbox, no grid — wrong fit for arbitrary canvas DOM.
- **Hand-rolled DOM-to-PPTX classifier.** Tried; user reported the result is unusable. Heuristic-based classification of arbitrary CSS into PPT shapes is a known-hard problem; libraries that read the browser's computed layout are the right shape.
- **`libreoffice --headless --convert-to pptx`.** Treats HTML as flow document → one giant text frame per slide. Confirmed in research; reject.
- **PDF → PPTX converters (Adobe, Smallpdf, LibreOffice Draw).** Re-chunk text by visual proximity → dozens of tiny text boxes per heading. Editable in the strict sense, unusable for designer iteration.
- **Aspose.Slides Cloud / GroupDocs / CloudConvert.** Cloud auth surface + per-call cost + data sovereignty trade-off. Skip until a real user asks.

## Open questions

- Multi-artboard PPTX merge currently uses naive slide concatenation via JSZip. The merged deck inherits the first input's theme/layout/master. If the inputs diverge (different fonts, different slide dimensions), the merged output may render inconsistently. Acceptable for v1 — all our exports use the same shell/page so divergence is unlikely. Watch for it on first multi-DS canvas export.
- The `?hide-chrome=1` shell flag is exporter-only. If a future flow wants to embed the canvas-shell in some other surface that also wants the chrome hidden, the flag is already there. If the chrome list grows, the rule lives in one place.
- Browser-bundle helper is general; if/when we adopt more ESM-only libs for in-page execution, the same helper handles them.

## Migration notes for v1 users

- `DDR-038-svg-export-via-foreignobject.md` is **superseded by this DDR** — left in place for history, but the implementation it describes is gone.
- `DDR-039-export-pptx-via-pptxgenjs.md` is **superseded by this DDR** — the canvas-model IR + hand walker is deleted. `pptxgenjs` is still used internally by `dom-to-pptx`, just not directly.
- `DDR-040-export-canva-via-pptx-and-mcp-prompt.md` is **unchanged** — the Canva handoff is still PPTX + `.canva-handoff.md` with a paste-ready MCP prompt. The PPTX engine swap doesn't affect that contract.

## Sources

- [felixfbecker/dom-to-svg](https://github.com/felixfbecker/dom-to-svg) — last release 2021-07, Sourcegraph-tested
- [atharva9167j/dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) — v1.1.9, last push 2026-05-16
- [Playwright `page.pdf()` docs](https://playwright.dev/docs/api/class-page#page-pdf)
- [Chrome headless print-to-PDF gotchas (Arko, 2025)](https://andre.arko.net/2025/05/25/chrome-headless-print-to-pdf/)
- Phase 6.5 user-feedback iteration log — this conversation transcript (2026-05-22 → 2026-05-23)
