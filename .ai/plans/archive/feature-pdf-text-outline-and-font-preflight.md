# Feature: PDF export — `text` mode (keep / embed / outline) + font preflight

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Chromium's `page.pdf()` emits **Type 3 fonts** for COLRv1 colour fonts (`@font-palette-values`) and for synthetic italics. Type 3 is a per-glyph content stream, not a real embedded font program — a print shop's preflight reports it as *not embedded*, Acrobat/Illustrator render it broken, and DTP has to re-substitute by hand. Maude's PDF export is genuinely vector and genuinely print-ready in every other respect (boxes, bleed, marks, DPI), so this is the one remaining thing that stops a `/design:export pdf` output from being sendable to a printer without a manual out-of-band step.

Add a **`text` option** to the PDF export (⌘E dialog + `POST /_api/export` `options` + `--option text=…`):

| Value | Behaviour |
|---|---|
| `keep` (default) | today's behaviour — text stays selectable, fonts as Chromium emits them. **New:** a font preflight notice when Type 3 / non-embedded fonts are present. |
| `embed` | assert every font is a real embedded font program. **Type 3 is a hard failure**, named and remedied — never a silent pass. |
| `outline` | convert all text to vector paths (Ghostscript `-dNoOutputFonts`), preserving raster fidelity and print boxes/marks. |

Plus an always-on **font preflight** (native, no external tool) so the Type 3 problem announces itself at export time instead of being discovered via `pdffonts` after the printer refuses the file.

## User Story

As a designer sending a Maude-authored print piece to a print shop, I want the PDF export to either guarantee real embedded fonts or hand me curves, so that I don't discover a Type 3 font problem from the printer's preflight and re-do the file by hand.

## Problem

`pdffonts` on a real `POST /_api/export` output (Brno Alligators A6 leaflet + A-board, brand colour font `AlligatorsSigns-Color`/`-Fill`):

```
name                                    type            emb sub uni
AAAAAA+AvenirNextCondensed-Heavy        CID TrueType    yes yes yes   ← OK
CAAAAA+Menlo-Bold                       CID TrueType    yes yes yes   ← OK
DAAAAA+AlligatorsSigns-Fill             Type 3          yes yes yes   ← ✗
EAAAAA+AlligatorsSigns-Color            Type 3          yes yes yes   ← ✗
HAAAAA+AvenirNextCondensed-HeavyItalic  Type 3          yes yes yes   ← ✗
HAAAAA+AvenirNextCondensed-HeavyItalic  CID TrueType    yes yes yes   ← ✗ (same font twice, two representations)
```

Two distinct causes, worth separating because only one of them is fixable by the author:
- **COLRv1 / `font-palette` colour font** → Chromium has no other PDF representation. Only outlining fixes it.
- **Synthetic italic** (CSS asks for `italic`, no real italic face loaded) → author-fixable by shipping the real face. Worth calling out by name in the preflight.

The manual workaround (verified, went to print) is a Ghostscript post-pass:

```sh
gs -o curves.pdf -sDEVICE=pdfwrite -dNoOutputFonts -dCompatibilityLevel=1.7 \
   -dPreserveMarkedContent=false \
   -dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode \
   -dAutoFilterGrayImages=false  -dGrayImageFilter=/FlateEncode \
   -dDownsampleColorImages=false -dDownsampleGrayImages=false -dDownsampleMonoImages=false \
   raw.pdf
```

Verified afterwards: `pdffonts` empty, `pdftotext` empty, `pdfinfo -box` keeps MediaBox/BleedBox/TrimBox, `pdfimages -list` identical px + ppi. The `-dAutoFilter*` / `-dDownsample*` flags are load-bearing — without them gs silently re-JPEGs and downsamples every photo, killing print DPI. Cost: file size (photo-heavy A-board 16 MB → 254 MB), which is exactly why this must be an explicit user choice rather than an always-on default.

## Solution

Three layers, in increasing cost:

1. **Native font preflight** (`exporters/pdf-fonts.ts`) — walk the assembled document's font dictionaries via pdf-lib's low-level object graph, classify each font as `type3` / `embedded` / `not-embedded`. No external tool, no new dependency. This alone converts an invisible failure into a visible one, and it powers both `keep` (notice) and `embed` (hard fail).
2. **`text: 'embed'`** — the same analysis, promoted to a thrown error naming the offending fonts and pointing at `text=outline`.
3. **`text: 'outline'`** — Ghostscript post-pass, **capability-gated on an external `gs`**, mirroring the existing `svg2pptx` pattern in `exporters/pptx.ts` (env override → PATH probe → memoized availability), but with the opposite failure posture: pptx *falls back* when the tool is missing; outline **must not**, because a silently-un-outlined print PDF is the exact bug this feature exists to close. Missing `gs` ⇒ loud, actionable error.

### Approach decision — Ghostscript as an optional external tool

The issue itself sets the direction ("buď volat gs, když je v PATH, nebo to udělat nativně … pokud gs, chce to jasnou chybu, když chybí"). Recorded here because it constrains later work:

- **Chosen: external `gs`, resolved off PATH, not bundled.** `apps/render/Dockerfile` gets `ghostscript` so the **cloud lane always works**. Desktop `.app` and the npm channel do **not** bundle it — Ghostscript is AGPL-3.0, Maude is MIT; exec'ing a separately-installed unmodified `gs` is clean, while shipping it inside an MIT-licensed signed `.app` drags in AGPL distribution + notarization obligations for a third-party binary, on every platform, for one opt-in export mode. Users on desktop who want `outline` install `gs` (one line, named in the error) — and the preflight from layer 1 still tells them *why* they'd want it.
- **Rejected: bundle Ghostscript in the packaged app.** Zero-setup outline everywhere, but licence posture + ~30 MB/platform + a new arm on the DDR-177 bundle-completeness gate + notarization of a foreign binary. Not worth it for an opt-in print mode; revisit only if outline becomes a default path.
- **Rejected: write our own outliner** (fontkit glyph paths + PDF content-stream rewriting, or an in-page DOM→path pass with opentype.js). No external dep and no licence question, but: the in-page variant cannot handle COLRv1 layering or complex shaping — i.e. it fails on *precisely* the Alligators brand font that motivated the issue — and the content-stream variant means emulating the full PDF text-state machine (`Tf/Tm/TJ/Tz/Ts/TL/Tc/Tw`, text render modes, text clipping). Weeks of work with a real chance of shipping something worse than `gs`. Named here so it isn't re-litigated.
- Every AGPL-licensed alternative outliner (MuPDF, poppler/Inkscape) has the same or worse posture; the Apache/BSD ones (qpdf, pdfium) can't outline at all. There is no permissive off-the-shelf option.

### Non-goals

- **CMYK / PDF-X** — unchanged, still out of scope (`pdf.ts` Design Decision 4). This is a *font-representation* axis, not a colour one.
- **Page splitting** (`-dFirstPage`/`-dLastPage`) — the issue mentions it as a bonus of the manual workflow; scope is `canvas-as-separate` today and splitting an assembled PDF is a separate feature.
- **Bundling `gs`** — see above.
- **Fixing synthetic italic automatically** — the preflight *names* it; substituting a real face is an authoring decision.

## Metadata

- **Ticket**: [#116](https://github.com/1aGh/maude/issues/116) — PDF export: volba embed fonts / vectorize (outline)
- **Type**: Enhancement
- **Complexity**: Medium-High
- **App/Package**: `apps/studio` (exporter + dialog), `apps/render` (image), `plugins/design` (docs)
- **Affected Systems**: PDF export adapter, export job queue + notification center, export dialog, render-worker image, `/design:export` docs
- **Dependencies**: Ghostscript (external, optional, `outline` mode only). **No new npm dependency** — the preflight uses pdf-lib, already a dependency.

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message** (multiple Read tool calls) — they're independent context loads.

- `apps/studio/exporters/pdf.ts` (whole file, 480 lines) — Why: the adapter. The post-pass path (`run()`, from `const needsPostPass`) is where the outline step attaches; `parsePdfPrintOptions` / `parsePageFit` are the parser shapes to mirror for `parsePdfText`.
- `apps/studio/exporters/pptx.ts` (lines 96–133, 360–420) — Why: **the precedent for an optional external tool** — `svg2pptxArgv()` env override, memoized `svg2pptxAvailable()` `--version` probe, `Bun.spawn` invocation, install-hint messaging. Copy the shape; invert the failure posture (no silent fallback).
- `apps/studio/exporters/degraded.ts` (whole file) — Why: `ExportDegradation` is the existing "the file is real but not clean" channel, already plumbed to the job record, the history ledger, the pill and the toast. The font notice reuses it rather than inventing a parallel one.
- `apps/studio/exporters/jobs.ts` (lines 55–105, 355–380, 540–560) — Why: where `degraded` enters the job, the history entry and the WS emit. Nothing new is needed if the notice rides `ExportDegradation`.
- `apps/studio/client/export-center.jsx` (lines 290–345) — Why: `DegradedNote` + the pill label read `job.degraded.audioDropped` explicitly; generalizing the type means touching this render.
- `apps/studio/export-dialog.tsx` (lines 100–140 option tables, 495–520 submit, 608–672 PDF section) — Why: where the new `Text` control and its `options.text` wiring go.
- `apps/studio/exporters/index.ts` (lines 45–100) — Why: `ExportOptions` is a free-form bag with **no upstream schema gate** — every new option MUST be validated/clamped in-adapter. `ExportResult` is where anything new must surface from.
- `apps/studio/exporters/_runtime.ts` (lines 1–100) — Why: DDR-045 path resolution + the "resolve a binary off the LIVE `process.env.PATH`, not Bun's startup snapshot" rule that the `gs` resolver must follow too.
- `apps/studio/exporters/remote.ts` (lines 1–110) — Why: the cloud lane. A `text=outline` job dispatched to `maude-render` runs `gs` **inside that image**, not on the cell — so the Dockerfile change is what makes the cloud lane work.
- `apps/render/Dockerfile` (runtime stage, the `apt-get install` block) — Why: where `ghostscript` is added.
- `apps/studio/test/pdf-print-boxes.test.ts` (lines 1–60) — Why: the test house style for this area — pure pdf-lib assertions, no Chromium.
- `plugins/design/commands/export.md` (lines 19–32) — Why: the `--option` table + the print-options prose that must document `text`.

### Files to Create

- `apps/studio/exporters/pdf-fonts.ts` — font preflight: classify every font in an assembled `PDFDocument`; pure, no I/O, no external tool.
- `apps/studio/exporters/ghostscript.ts` — `gs` resolution (`MAUDE_GHOSTSCRIPT` → `gs` → `gswin64c`), memoized availability probe, and the `outlinePdf(bytes, {signal}) → bytes` post-pass with the verified flag set.
- `apps/studio/test/pdf-font-preflight.test.ts` — preflight classification over hand-built pdf-lib fixtures (embedded / non-embedded / Type 3).
- `apps/studio/test/pdf-text-outline.test.ts` — `parsePdfText`, the `embed` refusal, and (gated on `gs` being present) a real round-trip asserting fonts gone + boxes/marks intact + images untouched.

### Design canvases

> No `.design/` canvas matches this feature — it is exporter/back-end work with one small dialog control. The motivating print canvases (`LetakA6.tsx`, `AlligatorsAcko.tsx`) live in the `personal/alligators` repo, not here. Section retained only to record that the scan ran and found nothing.

### Documentation

- [Ghostscript `pdfwrite` device options](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html#pdfwrite) — Why: authoritative on `-dNoOutputFonts`, `-dPassThroughJPEGImages`, and every `Downsample*`/`AutoFilter*` flag whose default silently degrades images.
- [PDF 32000-1 §9.6 (Simple Fonts) / §9.6.5 (Type 3)](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf) — Why: the `/Subtype /Type3` + `FontDescriptor` `/FontFile{,2,3}` structure the preflight walks.
- [pdf-lib low-level API (`PDFDict`, `PDFName`, `context.lookup`)](https://pdf-lib.js.org/docs/api/classes/pdfdict) — Why: pdf-lib has no font-inspection API; the preflight walks `page.node.Resources().lookup(PDFName.of('Font'))` by hand.

### Patterns to Follow

Optional-external-tool resolution — `exporters/pptx.ts`, to be mirrored (not re-invented) in `ghostscript.ts`:

```ts
function svg2pptxArgv(): string[] {
  const env = process.env.MAUDE_SVG2PPTX?.trim();
  return env ? env.split(/\s+/) : ['svg2pptx'];
}

let _svg2pptxAvailable: boolean | null = null;
async function svg2pptxAvailable(): Promise<boolean> {
  if (_svg2pptxAvailable !== null) return _svg2pptxAvailable;
  try {
    const [bin, ...rest] = svg2pptxArgv();
    const proc = Bun.spawn([bin, ...rest, '--version'], { stdout: 'pipe', stderr: 'pipe' });
    _svg2pptxAvailable = (await proc.exited) === 0;
  } catch {
    _svg2pptxAvailable = false;
  }
  return _svg2pptxAvailable;
}
```

In-adapter option validation — `exporters/pdf.ts`, the shape `parsePdfText` must follow (unknown/malformed degrades to the safe default, never throws):

```ts
export function parsePdfPrintOptions(raw: unknown): PdfPrintOptions | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // …clamp every field; `ExportOptions` is free-form and has no schema gate upstream.
}
```

DDR-009 — reach for `Bun.*` in dev-server code: `Bun.spawn`, `Bun.which`, `Bun.file`, `Bun.write`; not `node:child_process`. `node:path` / `node:os` stay.

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 1: CREATE `apps/studio/exporters/pdf-fonts.ts` — native font preflight

- **Do**: Export `type PdfFontKind = 'embedded' | 'type3' | 'not-embedded'`, `interface PdfFontInfo { name: string; kind: PdfFontKind; subtype: string; syntheticItalicSuspect: boolean }`, and `analyzePdfFonts(doc: PDFDocument): PdfFontInfo[]`. Walk every page's `Resources /Font` dict via pdf-lib's low-level `context.lookup`; for each font dict read `/Subtype` (`Type3` ⇒ `type3`; `Type0` ⇒ follow `/DescendantFonts[0]`) and the `FontDescriptor`'s `/FontFile`, `/FontFile2`, `/FontFile3` (any present ⇒ `embedded`, none ⇒ `not-embedded`). Strip the `AAAAAA+` subset prefix off `/BaseFont` for display. Set `syntheticItalicSuspect` when a `type3` font's stripped base name also appears in the document as an `embedded` font (that is exactly the `AvenirNextCondensed-HeavyItalic` twice / two-representations row in the issue). Dedupe by `(name, kind)`.
- **Pattern**: pure module, no I/O — same testability posture as `print/marks.ts` and `print/units.ts`.
- **Gotcha**: a font can appear on many pages and in many resource dicts; dedupe or the notice lists the same name ten times. A `Type0` font's descriptor lives on the *descendant*, not the parent — reading the parent finds no `FontFile*` and would misreport every CID font as not-embedded.
- **Validate**: `cd apps/studio && bun test test/pdf-font-preflight.test.ts`

### Task 2: CREATE `apps/studio/test/pdf-font-preflight.test.ts`

- **Do**: Build fixtures with pdf-lib directly — (a) a page using a standard (non-embedded) font, (b) a page with an embedded font (`doc.embedFont(bytes, { subset: true })` over a fixture TTF, or `@pdf-lib/fontkit` if already available), (c) a hand-constructed `/Subtype /Type3` font dict inserted into a page's resources. Assert classification, subset-prefix stripping, dedupe, and the `syntheticItalicSuspect` heuristic (same base name present as both `type3` and `embedded`).
- **Pattern**: `test/pdf-print-boxes.test.ts` — `bun:test`, pdf-lib only, no Chromium.
- **Gotcha**: don't reach for a real Chromium capture here; that couples a unit test to a browser and to a machine-specific font stack.
- **Validate**: `cd apps/studio && bun test test/pdf-font-preflight.test.ts`

### Task 3: UPDATE `apps/studio/exporters/degraded.ts` — generalize `ExportDegradation` beyond audio

- **Do**: Make `audioDropped` optional (`audioDropped?: boolean`) and add `fontsNotEmbedded?: string[]`. Update the doc comment: this type is "the file is real but it is not clean", and audio was merely its first instance. Do **not** create a parallel notice channel — the job record, the history ledger, the WS emit and the toast are already wired to this one.
- **Pattern**: the file's existing "make the invisible visible" rationale (RCA `issue-mp4-audio-export-html5audio-silent-degrade`) — extend it, don't fork it.
- **Gotcha**: `client/export-center.jsx` reads `job.degraded.audioDropped` directly for its pill label; making the field optional without touching that render gives a font-degraded export the wrong label. Task 4 covers it. Also check `test/export-center.test.tsx` for the same assumption.
- **Validate**: `cd apps/studio && bunx tsc --noEmit`

### Task 4: UPDATE `apps/studio/client/export-center.jsx` — render a font notice

- **Do**: In the pill label and `DegradedNote`, branch on which degradation is present: `audioDropped` → today's audio wording; `fontsNotEmbedded?.length` → `Ready · font warning` and a note listing the font names plus the `remedy`. Keep `data-testid="export-degraded-note"`.
- **Pattern**: the existing `DegradedNote` — same element, same testid, one more branch.
- **Gotcha**: after editing any `client/*.jsx`, the committed bundle must be rebuilt release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and `dist/client.bundle.js` + `dist/styles.css` committed — see CLAUDE.md § In-app What's New feed. Run `git status apps/studio/dist/` before and after any `bun test` in this tree.
- **Validate**: `cd apps/studio && bun test test/export-center.test.tsx`

### Task 5: ADD `parsePdfText` to `apps/studio/exporters/pdf.ts`

- **Do**: `export type PdfTextMode = 'keep' | 'embed' | 'outline'` and `export function parsePdfText(raw: unknown): PdfTextMode` — `'embed'`/`'outline'` pass through, anything else (absent, malformed, unknown string) → `'keep'`. Read it in `run()` as `const textMode = parsePdfText(options.text)`. **Top-level `options.text`**, not nested under `pdfPrint` — matching how `dpi` and `pageFit` sit top-level (`pdfPrint`'s presence is what triggers the box/marks post-pass, and text handling must be available on a plain non-print PDF too).
- **Pattern**: `parsePageFit` — one function, degrade-don't-throw.
- **Gotcha**: `textMode !== 'keep'` must join `printOpts`/`pageFit` in the `needsPostPass` condition, otherwise the fast path returns Chromium's bytes untouched and the option silently does nothing.
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts`

### Task 6: ADD the preflight + `embed` refusal to `pdf.ts`'s post-pass

- **Do**: After the pages are assembled (before `out.save()`), run `analyzePdfFonts(out)`. Then:
  - `keep`: if any `type3` or `not-embedded` font exists, attach `degraded: { fontsNotEmbedded: [names], reason: '<N> font(s) exported as Type 3 / not embedded — a print shop's preflight will reject them.', remedy: 'Re-export with text=outline to convert text to curves' + (when any `syntheticItalicSuspect`) ' — <name> looks like a synthetic italic; loading the real italic face fixes that one at the source.' }` to the `ExportResult`.
  - `embed`: throw with the same names and the same remedy. Loud, never a pass-through.
  - `outline`: hand off to Task 8.
- **Pattern**: `degraded.remedyFor` — a remedy is offered only when there is an honest one-liner.
- **Gotcha**: the fast path (no print options, no pageFit, `text: 'keep'`) must stay byte-identical to today for the common "just export a PDF" case. Getting the preflight there too would mean a pdf-lib round-trip on every plain export — accept that a plain `keep` export produces no notice, and say so in `export.md`. (Alternative considered: `PDFDocument.load` for analysis only, discard the document, return the original bytes. Measure the parse cost on a photo-heavy fixture; if it's negligible, prefer it — the notice is most valuable exactly where the user didn't ask for print options.)
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts`

### Task 7: CREATE `apps/studio/exporters/ghostscript.ts` — resolver + probe

- **Do**: `ghostscriptArgv()` (`MAUDE_GHOSTSCRIPT` space-separated override → `Bun.which('gs', { PATH: process.env.PATH })` → `Bun.which('gswin64c', …)`), memoized `ghostscriptAvailable()` via a `-version`/`--version` probe, and `GHOSTSCRIPT_MISSING_MESSAGE` naming the install line per platform (`brew install ghostscript` / `apt-get install ghostscript` / `choco install ghostscript`) and the `MAUDE_GHOSTSCRIPT` override.
- **Pattern**: `pptx.ts` `svg2pptxArgv` / `svg2pptxAvailable` verbatim in shape; `_runtime.ts`'s "look up against the LIVE `process.env.PATH`, not Bun's startup snapshot" rule.
- **Gotcha**: **no silent fallback.** pptx degrades to a PNG deck when its tool is missing; `outline` must not degrade to un-outlined text — that is the precise silent-degrade class this feature closes. Missing `gs` ⇒ throw `GHOSTSCRIPT_MISSING_MESSAGE`.
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts` (probe path covered with `MAUDE_GHOSTSCRIPT` pointed at a nonexistent binary)

### Task 8: ADD `outlinePdf()` to `ghostscript.ts` and wire it into `pdf.ts`

- **Do**: `outlinePdf(bytes: Uint8Array, opts: { signal?: AbortSignal; timeoutSec: number }): Promise<Uint8Array>` — write to a temp file, `Bun.spawn` gs with the verified flag set, read the output, always clean up the temp dir. Flags (from the verified manual run): `-o <out> -sDEVICE=pdfwrite -dNoOutputFonts -dCompatibilityLevel=1.7 -dPreserveMarkedContent=false -dDownsampleColorImages=false -dDownsampleGrayImages=false -dDownsampleMonoImages=false` plus the image-filter flags Task 9 settles. Add `-dBATCH -dNOPAUSE -dQUIET -dSAFER`. In `pdf.ts`, run it on the **final assembled bytes** — after the pdf-lib box/marks/pageFit pass, so the vector marks and the boxes are in the input gs preserves. Then re-run `analyzePdfFonts` on the result and **throw if any font survives** (gs succeeded but didn't outline ⇒ don't hand back a file that looks converted and isn't).
- **Pattern**: `pptx.ts`'s spawn + non-zero-exit error carrying stderr; `_runtime.ts` `runShim`'s abort-signal handling.
- **Gotcha**: `-dSAFER` is default-on in gs ≥ 9.50 but pass it explicitly — the input is user content. gs is not on the desktop app's PATH by default; the error must reach the user (job `error`, toast), not a stderr line. Respect `hooks.signal` — an outline pass on a 250 MB file is long enough to want cancelling.
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts` (gs-gated block)

### Task 9: DECIDE the image-fidelity flag set, with a measurement

- **Do**: The verified recipe forces `-dAutoFilterColorImages=false -dColorImageFilter=/FlateEncode` (+ the gray pair), which preserves pixels and ppi but **decodes every JPEG and re-encodes it as Flate** — the 16 MB → 254 MB blow-up. Measure the alternative on a photo-heavy fixture: keep `-dPassThroughJPEGImages=true` and `-dPassThroughJPXImages=true` (gs defaults) with downsampling off and **no** forced filter, which should copy DCTDecode streams through byte-identically. Compare with `pdfimages -list` (px + ppi must match the input exactly) and record both output sizes. Default to pass-through **if and only if** the images come through unaltered; otherwise keep the verified Flate recipe. Whichever loses, record why in the module comment.
- **Pattern**: the repo's habit of measuring before choosing a flag (see the `addInitScript` measurement in commit `b09abeb6`).
- **Gotcha**: Chromium's `page.pdf()` may re-encode a source JPEG as Flate on its way in, in which case pass-through has nothing to pass through and both recipes tie — measure, don't assume. `pdfimages`/`pdffonts` are poppler tools; use them for the *investigation*, never as a runtime dependency.
- **Validate**: `pdfimages -list` output for input and output identical; both sizes recorded in the plan's execution log.

### Task 10: ADD a post-outline size guard

- **Do**: `pdf.ts`'s `assertTotalSizeOk` runs on the **captured** files, before assembly and before outlining. Add a check on the final buffer after `outlinePdf` against the same `MAUDE_TOTAL_OUTPUT_BYTES` ceiling, with a message that names outlining as the cause and suggests `text=embed`/`keep` or fewer artboards per file. Also note the memory shape: outlining holds input bytes + output bytes + the pdf-lib document simultaneously.
- **Pattern**: `assertTotalSizeOk`'s existing message style — state the size, the limit, and three concrete remedies.
- **Gotcha**: 254 MB is a *legitimate* print deliverable here, well under the 600 MB ceiling — this guard is for runaway, not for ordinary print output. Don't lower the ceiling.
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts`

### Task 11: CREATE `apps/studio/test/pdf-text-outline.test.ts`

- **Do**: (a) `parsePdfText` table (unknown → `keep`). (b) `embed` throws on a Type 3 fixture and passes on an all-embedded one. (c) `keep` attaches `degraded.fontsNotEmbedded`. (d) missing-gs error path via `MAUDE_GHOSTSCRIPT=/nonexistent`. (e) **gs-gated round trip** (`test.skipIf(!(await ghostscriptAvailable()))`): take a pdf-lib document that already carries print boxes + drawn marks, outline it, and assert `analyzePdfFonts` is empty, MediaBox/BleedBox/TrimBox are unchanged to within a rounding tolerance, and the mark line ops survive.
- **Pattern**: `test/pdf-print-boxes.test.ts` for the box assertions; `skipIf` so CI without gs stays green while a dev box with gs actually exercises it.
- **Gotcha**: gs rewrites the whole document — page object numbers, `/Producer`, and content-stream structure all change. Assert on *values* (box rectangles, absence of fonts, presence of stroke ops), never on object identity or byte equality.
- **Validate**: `cd apps/studio && bun test test/pdf-text-outline.test.ts`

### Task 12: UPDATE `apps/studio/export-dialog.tsx` — the `Text` control

- **Do**: In the `format === 'pdf'` block, add a `<select id="dc-ed-pdf-text">` labelled **Text** with `Keep selectable (default)` / `Verify fonts embedded` / `Convert to outlines (print-safe)`, and a `dc-ed-desc` explaining the trade-off in one sentence each — notably that outlines make text unselectable and can grow the file substantially. Set `options.text` in the submit handler alongside `options.dpi` / `options.pdfPrint`. Give the select a `data-testid` (`export-pdf-text`) per the desktop-E2E convention.
- **Pattern**: the adjacent `Image quality` select — same markup, same `dc-ed-desc` prose style.
- **Gotcha**: the option list stays fixed regardless of whether `gs` is present — a capability probe would need a new API route, and a hard error naming the install line is honest enough for v1. Say so in the description text. Rebuild the committed client bundle (Task 4's gotcha).
- **Validate**: `cd apps/studio && bun test test/export-center.test.tsx && bunx tsc --noEmit`

### Task 13: UPDATE `apps/render/Dockerfile` — install `ghostscript`

- **Do**: Add `ghostscript` to the runtime stage's `apt-get install --no-install-recommends` list, with a one-line comment: this is the `text=outline` post-pass (issue #116), it is the ONLY lane where outlining works without user setup, and it is a separately-licensed AGPL program invoked as a subprocess — not linked, not modified.
- **Pattern**: the existing explicit Chromium shared-library list in the same block — explicit, commented, `--no-install-recommends`.
- **Gotcha**: the "frozen install" rule in that Dockerfile is about the **bun lockfile** (supply chain for JS deps), not apt — adding an apt package doesn't violate it. Image size grows ~50 MB; acceptable, note it in the commit message.
- **Validate**: `docker build -f apps/render/Dockerfile -t maude-render-test . && docker run --rm maude-render-test gs --version`

### Task 14: UPDATE `plugins/design/commands/export.md`

- **Do**: Add `--option text=keep|embed|outline` to the `--option` example row and a **PDF `text`** bullet in the print-options prose: the three modes, that `text` is TOP-LEVEL (not inside `pdfPrint`), that `outline` requires Ghostscript on PATH (with the install line and `MAUDE_GHOSTSCRIPT`), that it works out of the box on the cloud render lane, that outlined text is no longer selectable/searchable, and that the file can grow substantially. Add one example: `/design:export pdf --scope artboard --option includeBleed=true --option marks=crop,registration --option text=outline`.
- **Pattern**: the existing PDF `dpi` bullet — states the option, its ladder, its *different meaning* from the neighbouring format, and the default.
- **Gotcha**: `site/content/docs/` is generated from these (`gen:reference`); the `site-content` quality gate fails if the regen diff isn't committed.
- **Validate**: `pnpm --filter @maude/site gen:reference && git diff --stat site/content/docs/`

### Task 15: ADD a What's New entry

- **Do**: Append a pending entry (`version: null`) via the repo-internal `whats-new-entry` skill — user-facing: print-safe PDF export, font preflight warning, outline mode.
- **Pattern**: the skill owns the schema; `scripts/bump-version.sh` stamps the version at release.
- **Gotcha**: run `pnpm --filter @maude/site gen:whatsnew` and commit the regen (`site-content` gate).
- **Validate**: `pnpm --filter @maude/site gen:whatsnew && git diff --stat site/lib/whats-new.json`

### Task 16: RECORD the DDR

- **Do**: `/flow:record-ddr` — "PDF text handling is a user choice, and outlining is an external-tool capability we refuse to fake". Capture: the three modes and why `keep` stays default; why the preflight is native and always-on; why `outline` is gs-gated with **no** silent fallback (contrast with pptx's deliberate fallback); why gs is NOT bundled (AGPL vs MIT, notarization, DDR-177 bundle gate) and what would change that; why the native outliner was rejected (COLRv1 + text-state emulation); the image-fidelity flag decision from Task 9.
- **Pattern**: graph-native — no DDR number to allocate (`hash(kind:name)` identity). Namespace the element `maude/<slug>` per the repo's kgai capture rules.
- **Gotcha**: `EXTENDS` the print-artboards decision line and `REFERENCES` DDR-177 (bundle self-containment) — the "not bundled" choice is a deliberate, documented exception to that DDR's posture, and a future reader must find it from either end.
- **Validate**: `kg search "pdf text outline"` returns the new node.

---

## Validation

Run these commands to confirm zero regressions:

1. **Format**: `pnpm format`
2. **Lint**: `pnpm lint`
3. **Types**: `cd apps/studio && bunx tsc --noEmit && cd ../.. && bash scripts/check-tsc-coverage.sh`
4. **Tests**: `pnpm test && cd apps/studio && bun test test/sync-*.test.ts --timeout 20000` — plus the new files: `bun test test/pdf-font-preflight.test.ts test/pdf-text-outline.test.ts test/pdf-print-boxes.test.ts test/export-center.test.tsx`
5. **Build**: `pnpm --filter @maude/site build`
6. **Site content**: the `site-content` gate (`gen:reference` + `gen:whatsnew` diffs committed)
7. **Committed client bundle**: `git status apps/studio/dist/` clean of unintended changes; `dist/client.bundle.js` rebuilt `--release` and committed after the dialog + export-center edits
8. **Manual (the actual acceptance test)**: export the Alligators A6 leaflet from the `personal/alligators` repo at `text=keep` → expect the font warning naming `AlligatorsSigns-Color`/`-Fill`; at `text=embed` → expect a refusal naming them; at `text=outline` → `pdffonts` empty, `pdftotext` empty, `pdfinfo -box` boxes intact, `pdfimages -list` px + ppi identical to the `keep` export.
9. **Cloud lane**: a `text=outline` job through `maude-render` produces an outlined PDF (the Dockerfile change is what makes this true — verify it, don't assume it).

> UI surface here is one `<select>` in an existing dialog; the cross-platform `scenario-runner` / `design-system-guard` / `a11y-auditor` fan-out is not proportionate. The `a11y` obligation is met by the control carrying a real `<label htmlFor>` like its siblings.

---

## Scenario Coverage

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `apps/desktop/e2e/scenarios/export-formats.e2e.ts` | native export of every format incl. PDF | ✅ existing — must still pass unchanged (default `keep` is byte-compatible) |
| `apps/studio/test/export-e2e-lanes.test.ts` | every format on every lane, asserting delivered bytes | ✅ existing — add a `text=embed` case on the local lane (no gs needed: an all-embedded fixture must pass, a Type 3 one must refuse) |

**New scenarios to create:** none. The gs-dependent path is covered by the `skipIf`-gated unit round-trip (Task 11) rather than an E2E, because an E2E that silently skips on every CI machine without gs would be a scenario that proves nothing.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (types, lint, format)
  - [ ] Tests (full suite + the four PDF/export test files)
  - [ ] Build + `site-content` gate
- [ ] A default (`text` absent) PDF export is byte-compatible with today's output — the fast path is untouched
- [ ] `text=embed` **fails** on a Type 3 document; it never passes one through
- [ ] `text=outline` with no `gs` on PATH fails with an install line, never a silently un-outlined file
- [ ] Outlined output preserves MediaBox/BleedBox/TrimBox, the vector crop/registration marks, and every raster image's px + ppi
- [ ] `apps/render` image carries `ghostscript`; a cloud-lane outline export verified end to end
- [ ] Committed `apps/studio/dist/client.bundle.js` rebuilt `--release` after the client edits
- [ ] DDR recorded (external-tool posture + rejected alternatives + image-flag decision)
- [ ] What's New entry appended (pending), site regen committed
- [ ] Code follows project conventions, no regressions

---

## Retro

- **The plan's own Task 6 design was wrong, and only a test caught it.** pdf-lib *defers* `embedPage` until flush, so analysing the in-memory `PDFDocument` reports zero fonts for every `pageFit` export — the preflight would have shipped silently blind on exactly the scale-to-paper files print shops receive. A second instance of the same class: `/Resources` is an *inheritable* page attribute, so the obvious leaf lookup finds nothing when a producer hangs one shared dict off the Pages node. Both were found by writing the fixture that mimics the real producer rather than the one that mimics the API. Lesson for `/flow:plan`: when a task says "walk structure X", the plan should name the *producer's* shape, not the library's happy path.
- **Measuring beat copying.** The plan carried the issue's hand-verified Ghostscript flags forward as gospel with a task to "measure". The measurement inverted the reasoning: the forced `/FlateEncode` flags were never what protected raster fidelity — `-dPassThroughJPEGImages` (default true) was, and forcing Flate is only harmless while pass-through happens to win. Keeping Task 9 as a real measurement rather than a rubber stamp is the single highest-value thing in this plan.
- **A verified workaround is evidence, not a spec.** The user's manual recipe worked and went to print, which made it tempting to port verbatim. It worked *by accident of a default*. Future plans that inherit a working shell one-liner should treat it as a reproduction case to explain, not a design to transcribe.
- **The feature widened an existing unvalidated boundary.** `x-maude-degraded` was cast unvalidated for as long as it carried only a boolean; adding an array field to the type made a client-side crash reachable. Neither `/flow:plan` nor `/flow:execute` has a step that asks "what existing trust boundary does this new field now flow through" — it was caught in the `/flow:done` review, late. Worth a checklist line in the plan template's Design Decisions section.
- **`--quick` was the wrong shape for the one thing that mattered.** The riskiest artefact here is a Dockerfile line that no local gate can execute (no Docker daemon), and quick mode skips build anyway. The gates that *did* run were the cheap ones; the unverified thing stayed unverified. Not a failure of `--quick`, but a reminder that "quick" trims by cost, not by risk.
