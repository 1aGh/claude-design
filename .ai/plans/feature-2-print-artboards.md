---
name: feature-2-print-artboards
status: planned
created: 2026-07-15
decisions: [DDR-182]
depends-on: feature-1-artboard-kinds-foundation.md
planned-via: /flow:plan 2026-07-15 — DDR-130 relay debate converged; units/preset infra deliberately lives HERE (not foundation)
---

# Feature: Print artboards — paper presets, bleed/margin/marks overlays, DPI + print-ready PDF export

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

`kind="print"` artboards become genuinely print-ready: paper-size presets (ISO A, US, envelopes, business cards), on-canvas bleed/trim/margin/safe-area overlays honoring the pro-tool color conventions, DPI-parameterized raster export, and a print-ready PDF path (vector, correct MediaBox ⊇ BleedBox ⊇ TrimBox nesting, optional vector crop/registration marks) — **zero new dependencies**: PDF post-processing uses the already-present `pdf-lib`, rendering uses the existing Playwright export shims.

## User Story

As a designer, I want to ask the agent for an "A4 letak s 3mm spadavkou", see the trim/margin/bleed guides while iterating (toggleable), and export a PDF my print shop accepts (correct boxes, crop marks) or a 300 DPI PNG — without leaving Maude.

## Problem

- No physical-unit system exists anywhere (everything is CSS px); no paper presets.
- PDF export ignores `options` entirely (`--option pageFit=a4` is documented but dead); no bleed/marks/boxes.
- PNG scale ceiling is 4 (`_png-playwright.mjs:38`) — 300 DPI (3.125×) fits, 600 DPI (6.25×) doesn't.
- No on-canvas print guides; users can't see trim/safe zones while editing.

## Solution

**Author at CSS px @96dpi; the artboard IS the bleed box.** `paper` + `orientation` + `bleed` resolve ONCE at authoring time to px `width`/`height` = trim + 2×bleed (mm never enters JSX geometry; DDR-027 untouched). The overlay draws the trim line (inset by bleed), margins, safe area. Export: Playwright `page.pdf()` at artboard size (vector), then a pdf-lib post-pass enlarges the MediaBox for a marks slug, sets BleedBox/TrimBox, and draws vector crop/registration marks. Raster export maps DPI → `deviceScaleFactor` (`dpi/96`). **CMYK / PDF-X is explicitly out of scope** (requires Ghostscript-class color management — documented as print-shop-side; a future opt-in sidecar would be its own DDR since it breaks zero-dep + `bun --compile`).

## Metadata

- **Ticket**: — (user-requested, /flow:plan session 2026-07-15)
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (exporters, bin shims, canvas-lib overlay content, client dialogs) + `plugins/design` (skill, export command)
- **Affected Systems**: export engine (pdf/png adapters + shims), export dialogs (both mirrors), foundation overlay registry, Inspector, design skill
- **Dependencies**: foundation plan (kind prop + overlay primitive + guides visibility lane). **No new npm deps.**

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `apps/studio/exporters/index.ts` (48, 92-122) — free-form `options` bag + adapter registry; new print params enter here and MUST be clamped/validated in-adapter (no schema gate exists).
- `apps/studio/exporters/pdf.ts` (esp. ~100-105) — multi-page path already loads pages into a pdf-lib `PDFDocument` (extend to single-page); the post-pass home.
- `apps/studio/bin/_pdf-playwright.mjs` (118-124) — page size = artboard px, margin 0, printBackground; keep rendering native px.
- `apps/studio/exporters/png.ts` (38, 139) + `apps/studio/bin/_png-playwright.mjs` (38-47) — `clampScale` + `deviceScaleFactor` ceiling 4 → raise to 8 with memory guard.
- `apps/studio/http.ts` (831, 2597-2665) — `buildExportArgs` + `/_api/export`; confirm privileged (in NEITHER canvas-origin allowlist, `test/canvas-origin-gate.test.ts:65-71`) — new params = options keys only, **no new route**.
- `apps/studio/client/app.jsx` (921, 945, 957, 1277-1476) — `ExportDialog`; print section slots at :1449 (after Size row, gated `card.format==='pdf'`); row pattern :1412-1429; checkbox pattern :1460-1476.
- `apps/studio/export-dialog.tsx` (106-111, 207, 465, ~549) — the in-canvas mirror dialog; keep both in sync.
- `apps/studio/exporters/jobs.ts` (186, 239-258, 332-335) — job queue + `_export-history.json` ledger (runtime-state; unchanged).
- `plugins/design/commands/export.md` (21, 44) — `--option key=value` surface; the dead `pageFit=a4` doc line to finally implement.
- `apps/studio/client/app.jsx` (4219-4224) — `SCREEN_PRESETS` shape to mirror as `PRINT_PRESETS`.

### Files to Create

- `apps/studio/print/units.ts` — **the single source**: `mmToPx/inToPx/pxToMm(…, dpi=96)`, `PAPER_PRESETS`, bleed/margin defaults, mark geometry constants. Imported by the overlay content, Inspector knobs, AND both exporters — never computed twice (debate guard: two mm→px sites ⇒ on-canvas bleed silently desyncs from the exported PDF).
- `apps/studio/print/marks.ts` — pure functions emitting crop/registration-mark vectors (consumed by pdf post-pass; reusable by an on-canvas marks preview).
- `apps/studio/test/print-units.test.ts`, `apps/studio/test/pdf-print-boxes.test.ts`.

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Studio.tsx` | (no sidecar status) | Ground the export-dialog print section + Inspector print knobs here first (DDR-104 critic-then-port contract). |

### Documentation

- [CDP Page.printToPDF](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF) — Why: param surface (inches; preferCSSPageSize; NO marks/bleed support — confirmed).
- [pdf-lib PDFPage API](https://pdf-lib.js.org/docs/api/classes/pdfpage) — Why: `setMediaBox/setBleedBox/setTrimBox/setCropBox` + draw APIs (all confirmed present in the vendored version).
- [prepressure — PDF page boxes](https://www.prepressure.com/pdf/basics/page-boxes) — Why: MediaBox ⊇ BleedBox ⊇ TrimBox semantics print shops check.
- [Canva — margins, bleed & crop marks](https://www.canva.com/help/margins-bleed-crop-marks/) — Why: the low-friction UX bar (2 view toggles + 1 export checkbox).
- [Affinity — export settings/marks](https://affinity.help/publisher2/en-US.lproj/pages/Publishing/exportSettings.html) — Why: the marks menu vocabulary (crop / registration / colour bars / page info / include bleed).
- [InDesign — bleed & slug](https://helpx.adobe.com/indesign/desktop/print/page-set-up-and-printer-marks/print-bleed-and-slug-areas.html) — Why: guide color conventions (red=bleed, magenta=margins, violet=columns).

### Patterns to Follow

- Adapter-local option clamping: `clampScale` (`png.ts:38`).
- pdf-lib page manipulation: existing `copyPages` concat (`pdf.ts:100`).
- Dialog row/checkbox markup: `app.jsx:1412-1429` / `:1460-1476` (reuse `.st-dialog-row`, no new primitives).

---

## Design Decisions

1. **Artboard = bleed box** (trim + 2×bleed): content is clipped at artboard bounds today, so bleed must live INSIDE the artboard for backgrounds to reach the cut edge. Overlay draws the trim line inset by bleed; exporter sets TrimBox by insetting. (The alternative — artboard=trim, bleed outside — can't render bleeding content. Record in DDR.)
2. **`print` prop, resolved presets**: `print={{ paper:'A4', orientation:'portrait', bleedMm:3, marginsMm:{...} }}` on DCArtboard; the paper picker WRITES resolved px `width`/`height` (via the existing resize lane) + the `print` prop. Changing paper/orientation/bleed re-resolves px.
3. **Guide colors** honor the Adobe convention verbatim: bleed zone red tint, trim solid line, margins magenta, columns violet (foundation guides), safe-area dashed.
4. **Export scope honesty**: RGB PDF + correct boxes + vector marks + metadata. CMYK/PDF-X documented out of scope, UI copy says "your print shop converts" — never imply PDF/X compliance.
5. **Marks default OFF; bleed included by default when `print.bleedMm > 0`.** Mirrors Canva's one-checkbox simplicity; Affinity's 4 sub-toggles (crop/registration/colorBars/pageInfo) available under an "Advanced" disclosure. MVP = crop + registration (covers ~95% of shops).
6. **DPI is raster-only** (the PDF is vector); UI copy must not suggest a "PDF DPI".

---

## Tasks

### ✅ Task T1: CREATE `print/units.ts` single source — completed
- **Do**: conversions (1mm = 96/25.4 px), `PAPER_PRESETS` (A6 105×148 / A5 148×210 / A4 210×297 / A3 297×420 / A2 420×594 / A1 594×841 / A0 841×1189 mm; Letter 8.5×11 / Legal 8.5×14 / Tabloid 11×17 in; DL 110×220 / C5 162×229 mm; business card EU 85×55 mm, US 3.5×2 in; posters 18×24 / 24×36 in), bleed defaults (3 mm EU / 0.125 in US), safe-margin default 5 mm, marks geometry (length ~3.5 mm, offset = bleed).
- **Gotcha**: THE single source — overlays, Inspector, pdf.ts, png.ts import from here; add a lint-style grep test banning `25.4` outside this module.
- **Validate**: `bun test print-units`

### ✅ Task T2: ADD `print` prop + preset resolution — completed
- **Do**: `print?: {...}` prop on DCArtboard (foundation's prop toolkit); Inspector `PRINT_PRESETS` picker (mirror `SCREEN_PRESETS`) writing resolved px width/height (existing `/_api/resize-artboard` lane) + the `print` prop; orientation swap; bleed field (mm).
- **Pattern**: `ArtboardKnobs` + `SCREEN_PRESETS` (`app.jsx:6763-6874`, `:4219-4224`).
- **Gotcha**: creating a print artboard from the "+ Artboard" flow should set `kind="print"` + `print` prop together.
- **Validate**: agent-browser: pick A4 → artboard resizes to 818×1146 px (794×1123 trim + 2×3mm bleed) and JSX diff shows both props.

### ✅ Task T3: REGISTER print overlay content — completed
- **Do**: bleed tint + trim line + margin guides + safe area + optional crop-mark preview, rendered into foundation's `ArtboardGuidesOverlay` registry for `kind="print"`; visibility toggles ride the foundation view.json lane; View-menu + `/design` flag "Show print guides".
- **Gotcha**: overlay reads `print` prop mm values via `print/units.ts` ONLY; flat strokes, no filters (WKWebView).
- **Validate**: screenshot fixture (A4 + bleed 3mm) — trim/margins/bleed visually match a pdf-lib-parsed export (T5 golden).

### ✅ Task T4: IMPLEMENT raster DPI export — completed
- **Do**: `dpi` option (96/150/300/600) → `deviceScaleFactor = dpi/96` in `png.ts`; raise `_png-playwright.mjs:38` ceiling 4→8; guard: reject when output side > 16,000 px or estimated buffer > ~600 MB with a clear error naming max DPI for that size (tiling = documented future work, not silent).
- **Validate**: bun test clamp logic; manual 300 DPI A4 export → `sips -g pixelWidth` = 2578 (818×3.125 → wait: assert exact = round(818×300/96)).

### ✅ Task T5: IMPLEMENT print-ready PDF post-pass — completed
- **Do**: in `pdf.ts` after render (extend the existing pdf-lib load to single-page too): validate+clamp new options `{ pdfPrint?: { includeBleed, marks:{crop,registration,colorBars,pageInfo}, paper? }, dpi? ignored }`; per page — enlarge MediaBox by a marks slug (negative-origin so content coords don't move), `setBleedBox` (= rendered page), `setTrimBox` (inset by bleedMm from the artboard's `print` prop), draw marks from `print/marks.ts` OUTSIDE the TrimBox; implement `pageFit=a4|letter|…` (finally un-deadening `export.md:44`) as scale-to-paper for non-print artboards.
- **Gotcha**: (a) verify content coordinates survive MediaBox origin shift across PDF viewers; (b) test whether `generateTaggedPDF` metadata survives the pdf-lib round-trip — if not, note in docs; (c) OTF fonts outline to paths in Chromium print — add a skill note recommending TTF for print DS type.
- **Validate**: `bun test pdf-print-boxes` — golden: export A4+3mm+marks, re-parse with pdf-lib, assert MediaBox ⊇ BleedBox ⊇ TrimBox with exact expected pt values + marks present as vector ops.

### ✅ Task T6: EXTEND both export dialogs + CLI — completed
- **Do**: PDF card print section (paper info read from selection, Include bleed checkbox, Marks disclosure, and the multi-artboard "one page per artboard" note) at `app.jsx:1449` + mirror `export-dialog.tsx:~549`; PNG card DPI select replacing the bare 1/2/3× (keep px-scale as "custom"); `/design:export` doc for `--option dpi=300 --option marks=crop,registration --option includeBleed=true`.
- **Gotcha**: rebuild the client bundle release-minified after dialog edits; keep BOTH dialog mirrors in sync (grep test if cheap).
- **Validate**: agent-browser ⌘E flow → options reach the adapter (assert via export-history entry).

### ✅ Task T7: WIRE the design skill (print mode) — completed
- **Do**: `/design:new` print detection (brief mentions letak/plakat/vizitka/brozura/A4/print/tisk → `kind="print"` + preset + bleed default + margins); generation rules: absolute-first composition, backgrounds extend to bleed edge, critical content inside safe margin, TTF-preferred type note, no vw/vh (already banned); `/design:edit` print awareness (edits respect trim/safe guides as constraints); ACP/desktop path inherits via the same skill.
- **Gotcha**: pass user briefs verbatim (CLAUDE.md rule) — detection keys on the brief, never rewrites it.
- **Validate**: scratch-project `/design:new "A5 letak ..."` dry run → print artboard with correct preset px.

### ✅ Task T8: RECORD DDR + docs + What's New — completed
- **Do**: DDR (bleed-inside model, RGB scope, pdf-lib post-pass, single-source units); site docs page for print export; `whats-new-entry`; roadmap regen.

---

## Validation

1. `pnpm lint` / `pnpm format` / `pnpm test && pnpm test:dev-server` (new: print-units, pdf-print-boxes, dpi clamp) / `pnpm --filter @maude/site build`.
2. Golden PDF assertion (T5) is the load-bearing gate — box nesting + marks, exact pt values.
3. `/design:smoke`; agent-browser visual pass (overlay vs export parity fixture).
4. Client bundle rebuilt release-minified + committed; parity + tarball scripts.
5. Manual: send one exported A4+bleed+crop-marks PDF to a real preflight tool (e.g. a print shop's online preflight) — acceptance evidence, record result in the plan.

## Acceptance Criteria

- [x] T1–T8 complete; **zero new npm dependencies** (verified — no `package.json` diff)
- [x] On-canvas trim/margin/bleed geometry provably identical to exported PDF boxes (shared `print/units.ts` + `test/pdf-print-boxes.test.ts` golden gate, 14 tests green)
- [x] 300/600 DPI raster export exact-size verified (`resolveDeviceScale` unit tests); >16k px / ~600MB guarded with a clear max-DPI-for-this-size error in `_png-playwright.mjs`
- [x] `pageFit` no longer dead; export options validated/clamped in-adapter (`parsePdfPrintOptions`/`parsePageFit` in `pdf.ts`)
- [x] CMYK/PDF-X scope honesty present in UI copy (both export dialogs) + docs (`export.md`, `site/content/docs/design/print.mdx`, DDR-182)
- [x] DDR-182 recorded; skill wired (`/design:new`, `/design:edit` print cues); What's New authored (`print-artboards`, pending); roadmap regenerated
- [ ] `/flow:validate` — **NOT run this session** (needs a live dev server for the scenario/agent-browser/design-system-guard fan-out; owner-side follow-up, see plan Validation §3/§5 and the STATE.md checkpoint's scope-trim list)
