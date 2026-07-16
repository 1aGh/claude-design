# DDR-182: Print artboards — bleed-inside model, RGB-only scope, pdf-lib post-pass, single-source units

**Status:** Accepted
**Date:** 2026-07-16
**Tags:** print, pdf, export, canvas-lib, units

## Context

`feature-1-artboard-kinds-foundation` (DDR-181) added a `kind="print"` artboard classification and a shared overlay-mount registry, but no artboard rendered as an actual print-ready surface: there was no physical-unit system anywhere in the codebase (everything is CSS px), no paper-size presets, `/design:export pdf --option pageFit=a4` was documented but dead (PDF export ignored `options` entirely), and the raster PNG export's `deviceScaleFactor` ceiling of 4 caps out well below the 3.125× (300dpi) or 6.25× (600dpi) a print shop needs.

This plan (`feature-2-print-artboards`) is the second of a 4-plan family sharing DDR-181's `kind`/overlay foundation. It needed to answer four questions before implementation: (1) does bleed live inside or outside the artboard's authored bounds, (2) is CMYK/PDF-X in scope, (3) does the PDF pipeline stay Chromium-vector-only or does bleed/marks require re-introducing a pdf-lib rasterization pass, (4) where does the single mm↔px conversion authority live so the on-canvas guide and the exported PDF box can never silently disagree.

## Alternatives considered

**Bleed placement:**
- **Artboard = trim, bleed drawn outside the artboard bounds** — pros: the artboard's authored `width`/`height` stays exactly the paper's trim size, matching how a user would naively think about "an A4 artboard"; cons: today's rendering model clips all artboard content at the artboard's own bounds (`.dc-artboard` / `content-visibility`), so background/photo content can never actually reach the bleed edge — the bleed region would always render empty regardless of what the user authored. Rejected — it can't do the one thing bleed exists for.
- **Artboard = bleed box (trim + 2×bleed), authored width/height already include the bleed margin** — pros: works with today's clip-at-bounds model with zero rendering-engine changes; a full-bleed background is just "cover the artboard," no special-cased bleed-only paint layer. Cons: the artboard's px size is no longer literally "the paper size" — it's paper + margin, so a naive read of `width`/`height` in the JSX doesn't match the paper preset name. Picked — the `print` prop is the source of truth for "what paper is this," and `width`/`height` are (as with every other artboard) DDR-027's JSX-authoritative RESOLVED geometry, not raw input.

**Color scope:**
- **CMYK / PDF-X output** — pros: what a print shop's prepress team actually wants; cons: requires a real ICC/rasterization color-management pipeline (Ghostscript-class tooling), which breaks the zero-new-dependency / `bun --compile` single-binary constraint every other exporter in this codebase honors. Rejected for this plan.
- **RGB PDF + correct box nesting + vector marks, documented scope-honest** — pros: zero new deps, reuses the already-vendored `pdf-lib`; the boxes/marks are the part a print shop's own RIP can't infer on its own (they need the artboard's OWN bleed intent, which only Maude knows), while CMYK conversion is a mechanical step any prepress workflow already does on ingest. Picked. A CMYK/PDF-X opt-in sidecar is explicitly future work with its own DDR — it would need its own dependency-shape debate.

**PDF rendering pipeline:**
- **Keep Chromium's `page.pdf()` output completely untouched, no pdf-lib round-trip** — pros: today's simplest path, avoids any pdf-lib version/behavior risk; cons: `page.pdf()` has no bleed/marks/box-nesting concept at all (confirmed against the CDP `Page.printToPDF` param surface) — there's no way to ask Chromium for a TrimBox. Rejected — the feature is impossible without a post-pass.
- **Rasterize the whole export and rebuild vector-look via pdf-lib primitives** — the OLD (pre-Phase-6.5) approach this codebase already tried and explicitly moved away from (a user complaint is on record: "the PDF export is raster, not vector"). Rejected outright — regresses a fixed bug.
- **Keep Chromium's vector `page.pdf()` render, add a pdf-lib POST-PASS that only touches page boxes + draws marks (never re-encodes the page content)** — pros: content stays 100% Chromium-vector (selectable text, embedded fonts, SVG paths untouched); pdf-lib's box setters + `drawLine`/`drawCircle` operate on the SAME page object, so no content is ever rasterized or copied. Picked.

**Units single-source:**
- **Compute mm→px independently in the overlay, the Inspector, and each exporter** — rejected outright in the plan's own T1 gotcha: two conversion sites is how the on-canvas bleed guide silently desyncs from the exported PDF's TrimBox — exactly the class of bug this feature exists to prevent, not reproduce.
- **One module (`print/units.ts`) that every consumer — client-bundled overlay/Inspector AND server-side exporters — imports, with a lint-guard test banning the `25.4` (mm-per-inch) literal anywhere else** — picked. The same module is proven to bundle into BOTH the client shell (`client/app.jsx`) and the server-side `exporters/pdf.ts`/`png.ts` (pure TS/math, no Node/Bun-specific APIs), so "single source" is a real, enforced invariant, not just a naming convention.

## Decision

We pick **artboard-is-the-bleed-box + RGB-only scope-honest export + a pdf-lib post-pass over Chromium's vector `page.pdf()` output + `print/units.ts` as the sole mm↔px/pt conversion authority**, because:

- The artboard's resolved `width`/`height` (written by the Inspector's paper picker via the SAME `/_api/resize-artboard` lane every other artboard resize uses, DDR-027) already equal `resolvePrintArtboard()`'s `trim + 2×bleed`, so a full-bleed background painted to `100%`/artboard bounds correctly reaches the cut edge under today's clip-at-artboard-bounds rendering model with no new CSS escape hatch.
- The `print` JSX prop (`paper`/`orientation`/`bleedMm`/`marginsMm`) is the ONE place bleed intent is authored — the on-canvas overlay (T3) and the PDF exporter (T5) each independently RE-READ this prop (the overlay via `readBackAttrs`'s `data-dc-print` JSON, the exporter via a no-eval AST reader, `readArtboardPrintProp`) rather than trusting a value passed through export options, so the two can never diverge: what you see is what gets cut.
- `readArtboardPrintProp` walks the `print` prop's object-literal AST directly (string/number/boolean/null leaves + nested objects) instead of `JSON.parse` (would reject a hand-authored unquoted-key JS literal) or `eval`/`Function()` (unsafe — canvas content is the DDR-054 untrusted-authoring surface, and this reader runs server-side during export).
- `page.setMediaBox` enlarges the page with a NEGATIVE origin (the marks slug) while `setBleedBox`/`setTrimBox` stay anchored to the page's own existing (0,0)-based coordinate space — content drawn by Chromium is never moved, only the box metadata around it changes, so `MediaBox ⊇ BleedBox ⊇ TrimBox` holds by construction and is asserted with exact expected pt values in `test/pdf-print-boxes.test.ts` (the plan's own load-bearing golden gate).
- `pageFit=<paper>` (finally implementing the long-documented-but-dead `export.md` option) is a SEPARATE code path from the print-artboard box/marks post-pass — it targets a non-print artboard and uses `embedPage`/`drawPage` to scale-and-center the existing vector content onto a fresh paper-sized page, never touching a `kind="print"` artboard's own bleed geometry.
- Raster export DPI (T4, `png.ts`) is unrelated to the PDF vector path — `deviceScaleFactor = dpi/96` reuses `print/units.ts`'s `CSS_DPI` constant so the DPI ladder and the mm↔px authoring ratio stay the same "96 CSS px = 1 physical inch" assumption throughout the feature, with an explicit output-size guard (16,000px / ~600MB) added to `_png-playwright.mjs` because raising the `deviceScaleFactor` ceiling 4→8 makes an unbounded high-DPI request a real OOM/hang risk that didn't exist at the old ceiling.

## Consequences

**Positive:**
- A print artboard's on-canvas bleed/trim/margin guide and its exported PDF's BleedBox/TrimBox are provably pixel/point-identical (both derive from the SAME `print` prop via the SAME `print/units.ts` functions) — the single biggest risk this DDR set out to avoid.
- Zero new npm dependencies — `pdf-lib` was already vendored (Phase 6.5); the feature reuses it more fully rather than adding a print-specific library.
- Existing non-print artboards and existing PDF/PNG exports are unaffected: `pdf.ts`'s post-pass only activates when `options.pdfPrint`/`options.pageFit` is present (a fast-path with zero pdf-lib round-trip otherwise), and `png.ts`'s `dpi` option is additive to the existing `scale` option.

**Negative / trade-offs:**
- RGB-only / no CMYK / no PDF-X compliance claim — a real print shop still needs to run its own color conversion; this is documented in the export dialogs' own copy ("Bleed and marks apply to print artboards only" + no DPI-on-PDF claim) and in `export.md`, not silently implied.
- Marks MVP is crop + registration only — `colorBars`/`pageInfo` are accepted in the options shape (so a caller's request never fails validation) but not yet drawn; a future round can add them without a shape change.
- `readArtboardPrintProp`'s artboard-id correlation for a `canvas-as-separate` (multi-artboard) PDF export depends on the Playwright shim naming each written file after the artboard's own `data-dc-screen` id (changed from a positional `artboard-N.pdf` index) — a render path that produces a target Target whose `cssPath` doesn't resolve to a literal `[data-dc-screen="<id>"]` (the descendant-widen fallback, `:first-of-type` last-resort) degrades to "no print geometry for that page" rather than guessing, so an edge-case scope resolution can silently skip bleed/marks on that one page.
- Manual print-shop preflight acceptance (plan Validation §5 — sending a real exported PDF through a print shop's own preflight tool) is owner-side follow-up, not verified in this session.

## Revisit when

- A CMYK/PDF-X opt-in export is requested — needs its own DDR (color-management dependency shape, likely breaks the zero-new-dep / `bun --compile` constraint this plan preserved).
- `colorBars`/`pageInfo` marks are implemented — extend `print/marks.ts`'s `computeMarksGeometry`, don't fork it; the options shape already reserves the keys.
- A raster export beyond the current 16,000px/~600MB guard is needed (e.g. a large-format poster) — the plan's own T4 gotcha flags tiling as documented future work, not silently unsupported.
- The live artboard→world-space guide-line assembly DDR-181 deferred is picked up — print's bleed/trim/margin lines are a natural candidate to ALSO participate as snap-guide candidates once that wiring lands.

## Linked
- Plan: `.ai/plans/feature-2-print-artboards.md`
- PRD: —
- Supersedes: —
- Builds on: [DDR-181](./DDR-181-artboard-kind-model-and-overlay-layer-contract.md) (artboard `kind` + overlay registry)

## Addendum (2026-07-16, same-day dogfood pass)

Live dogfooding immediately after implementation surfaced two real gaps, both fixed same-day:

1. **Switching Kind → Print via the Inspector didn't seed a `print` prop.** The Kind picker (foundation feature, `setArtboardKindOp`) only ever wrote the `kind` attribute; nothing coupled it to `print`. An artboard could end up `kind="print"` with NO `print` prop at all — the guides overlay (`print-overlay-content.tsx`'s `!print` guard) rendered nothing, and the PDF exporter found no bleed to apply, even though the artboard's kind chip correctly showed "print." Fixed: switching TO `"print"` with no existing `print` prop now seeds a default `{ paper: 'a4' }` + its resolved px size in the same gesture (mirroring the `"+ Artboard: print preset"` flow), in `client/app.jsx`'s `setKind`.
2. **`readArtboardPrintProp` didn't check `kind`.** It gated purely on the `print` prop's presence, so a `print` prop left over from a PRIOR kind switch (artboard later switched back to `"digital"`) would still leak bleed/marks into an export. Fixed: the reader now requires `kind="print"` literally, matching the (now-fixed) invariant that the two always travel together.
3. **DPI was PNG-only — scoped too narrowly.** The original decision's "DPI is raster-only" framing conflated "the PDF page is vector" (true — text/shapes never rasterize) with "DPI has no meaning for PDF" (false). A PDF can embed RASTER content — a dropped photo, or a large-format piece (e.g. a billboard) authored at a fraction of its real physical size — and that content's capture density is exactly what `dpi` should control, independent of the page's own vector-ness. Fixed: `exporters/pdf.ts` gained `resolvePdfDeviceScale` (deliberately NOT `png.ts`'s `resolveDeviceScale` reused as-is — that function's absent-`dpi` fallback defaults to PNG's own 2× "a 1× export was uselessly small" UX default, which would have silently doubled every embedded image's weight on a plain "just export a PDF" call; the PDF resolver defaults absent-`dpi` to unchanged 1×) wired into `_pdf-playwright.mjs`'s `deviceScaleFactor` exactly like the PNG shim. Both export dialogs gained a PDF "Image quality" DPI picker, copy corrected in `export.md` + `print.mdx`.

None of these are scope or model reversals — the artboard-is-the-bleed-box model, the RGB-only decision, and the pdf-lib-post-pass-over-vector-Chromium-output architecture all hold exactly as decided above. These were implementation completeness gaps the model itself didn't anticipate needing (kind/print coupling) or scoped too narrowly at first pass (DPI as PNG-exclusive).
