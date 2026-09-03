# DDR-237: PDF text handling is a user choice, and outlining is an external-tool capability we refuse to fake

- **Date:** 2026-09-03
- **Status:** Accepted
- **Tags:** export, pdf, print, ghostscript, licensing, degraded, issue-116

## Context

Maude's PDF export is vector-faithful in every respect a print shop checks — correct `MediaBox ⊇ BleedBox ⊇ TrimBox` nesting, vector crop/registration marks, raster content at real print DPI — except one. Chromium's `page.pdf()` emits **Type 3 fonts** for two cases it has no other representation for:

- a **COLRv1 colour font** with `@font-palette-values`, and
- a **synthetic italic** (CSS asks for `italic`, no real italic face is loaded).

A Type 3 "font" is a per-glyph content stream, not a font program. Preflight reports it as *not embedded*, Acrobat/Illustrator render it broken, and DTP re-substitutes by hand. Reported on a real job (issue #116) — the Brno Alligators A6 leaflet and A-board, brand font `AlligatorsSigns-Color`/`-Fill`:

```
DAAAAA+AlligatorsSigns-Fill             Type 3        ← rejected
EAAAAA+AlligatorsSigns-Color            Type 3        ← rejected
HAAAAA+AvenirNextCondensed-HeavyItalic  Type 3        ← rejected
HAAAAA+AvenirNextCondensed-HeavyItalic  CID TrueType  ← the same face, twice, two representations
```

Two properties made this the worst kind of bug. It was **invisible from inside Maude** — the export succeeded, the file downloaded, the page looked right on screen, and the only signal was `pdffonts` on the delivered artifact or the printer refusing it. And the **workaround lived outside the product**: a hand-run Ghostscript `-dNoOutputFonts` pass, verified and sent to print, that every future print job would have to repeat by hand.

The `site/content/docs/design/print.mdx` claim "selectable text, embedded fonts" was, for these faces, simply untrue.

## Decision

**1. `options.text` — `keep` (default) / `embed` / `outline`, TOP-LEVEL.**

Not nested under `pdfPrint`. `pdfPrint`'s presence is what switches the boxes/marks post-pass on, and font representation is orthogonal: a plain non-print PDF carries Type 3 fonts just as easily as a leaflet does. Sits beside `dpi` and `pageFit`, which are top-level for the same reason. Unknown/malformed degrades to `keep` — this adapter's standing rule, since `ExportOptions` is free-form with no schema gate upstream.

**2. The font preflight is native, always-on, and rides the existing degraded channel.**

`exporters/pdf-fonts.ts` walks the assembled document's font dictionaries through pdf-lib's object graph — no external tool, no new dependency. It runs on **every** PDF export including the fast path, and that cost is deliberate: the fast path is what `/design:export pdf` with no options takes, i.e. the most likely way someone exports a leaflet, and a print-unusable PDF that says nothing is the whole bug.

The notice reuses `ExportDegradation` rather than a parallel channel. `audioDropped` became optional and `fontsNotEmbedded?: string[]` joined it. A muted mp4 and an unprintable PDF are the same shape — *the file is real, the file is wrong* — and the job record, history ledger, WS emit, status pill and completion toast are already wired to that type. A second notice type would have had to re-earn all five.

**3. `embed` fails; it never passes a Type 3 through.**

Same analysis, promoted to a thrown error naming the offending faces plus the remedy.

**4. `outline` shells out to Ghostscript, and REFUSES when it is absent.**

`pptx.ts` resolves an optional `svg2pptx` and silently falls back to a PNG deck when it is missing. That is right there — the user asked for slides and gets slides. It is exactly wrong here: a user who asked for outlines and silently receives live Type 3 fonts has been handed the precise artifact this feature exists to prevent, and finds out from their printer. Missing `gs` is an error carrying the install line, never a fallback.

Ghostscript exiting 0 is also not proof. The pass **re-runs the preflight on its own output** and throws if any font survived — "it ran" is not "it worked", and a plausible lie is worse than a failure.

**5. Ghostscript is installed in the render image and NOT bundled in the desktop app.**

`apps/render/Dockerfile` gets `ghostscript`, so the **cloud lane works with no user setup**. The packaged `.app` and the npm CLI resolve `gs` off PATH and refuse loudly.

Ghostscript is AGPL-3.0; Maude is MIT. Exec'ing an unmodified separately-installed program is clean and ordinary. Shipping it *inside* a signed `.app` drags AGPL distribution obligations and third-party notarization into the packaged product, on every platform, for one opt-in export mode — and would add a new arm to the DDR-177 bundle-completeness gate. Redistributing it inside the render image is ordinary Debian redistribution (the package carries its own source offer). This is a deliberate, documented exception to DDR-177's "the packaged app must be self-contained" posture: self-containment covers what the app *needs to function*, and outlining is an opt-in print mode with an honest refusal path.

**6. The flag set was measured, not copied.**

The issue's hand-run recipe forces `/FlateEncode`. Measured on a 3-page 1600×1200-JPEG-per-page fixture with `pdfimages -list` before and after:

| flags | size | image enc | px / ppi |
| --- | --- | --- | --- |
| pass-through ON + forced Flate (**chosen**) | 144 483 | jpeg | identical |
| pass-through ON only | 144 417 | jpeg | identical |
| pass-through OFF + forced Flate | 417 369 | flate | identical |

Two things this settles:

- **`-dPassThroughJPEGImages` is the flag that matters**, and it is now stated explicitly. It defaults to true, which is *why* the hand-run recipe did not corrupt anything — but row three is what happens the moment it does not win: every photo decoded and re-encoded as Flate. That is the reported 16 MB → 254 MB, and it was never the forced-Flate flags protecting against it.
- **The forced Flate filters stay anyway.** `AutoFilter*` defaults to true, and for an image Ghostscript genuinely must re-encode (a Flate source, which is what Chromium often produces) "auto" may choose DCT — a silent *lossy* re-encode of lossless print artwork. Pinning to Flate makes the only re-encode we can be handed a lossless one.

`-dDownsample*=false` is the other half of the fidelity guarantee; without it Ghostscript resamples to its default target and destroys print DPI.

**7. Ordering: text handling runs LAST, on the fully assembled bytes.**

Boxes set and marks drawn first, so they are part of what Ghostscript preserves (verified: TrimBox/BleedBox survive to within rounding) rather than something applied to an already-outlined file.

## Alternatives considered

- **Bundle Ghostscript in the desktop app.** Zero-setup outlining everywhere. Rejected: AGPL-in-an-MIT-product, ~30 MB per platform, notarization of a foreign binary, and a new bundle-completeness arm — for one opt-in mode with a working honest refusal. Revisit only if outlining ever becomes a default path.
- **Write our own outliner.** No external dependency, no licence question. Rejected in two variants. An **in-page DOM→path pass** (opentype.js over the inlined faces) cannot handle COLRv1 layering or complex shaping — it fails on *precisely* the Alligators brand font that motivated the issue. A **content-stream rewriter** (fontkit glyph outlines + re-emitted text) means emulating the whole PDF text-state machine — `Tf/Tm/TJ/Tz/Ts/TL/Tc/Tw`, render modes, text clipping — for a real chance of shipping something worse than `gs`.
- **A permissively-licensed outliner.** There is none. MuPDF and poppler/Inkscape are AGPL/GPL; qpdf (Apache) and pdfium (BSD) cannot outline at all.
- **Byte-scanning for `/Subtype /Type3` instead of parsing** (the `hasAudioStream` idiom in `degraded.ts`). Rejected: it cannot recover font *names*, and Chromium's compressed object streams hide the dictionaries outright — false negatives on the real input.
- **Auto-outlining whenever Type 3 is detected.** Rejected: outlining is lossy in a dimension the user may care about (selectable, searchable, accessible text) and can grow a file by an order of magnitude. The issue asked for a choice, and a choice is what a print deliverable warrants.
- **Hiding "Convert to outlines" in the dialog when `gs` is absent.** Rejected: needs a new capability route, and answers the user's actual question ("can I send this to a printer?") by making the answer invisible. A refusal naming the one-line install reaches them at the moment they care.

## Consequences

- Two dialogs gained the control (`export-dialog.tsx` and `client/app.jsx` — they mirror by standing obligation).
- The preflight added a pdf-lib parse to the PDF fast path. It degrades to silence on bytes pdf-lib cannot read: a warning mechanism must never become a new way for a successful export to fail.
- **A landmine defused on the way:** the preflight originally read `page.node.lookup('Resources')`, but `/Resources` is an *inheritable* page attribute and producers routinely hang one shared dict off the Pages node — which would have silently reported "no fonts" for whole documents. Separately, pdf-lib **defers** `embedPage` until flush, so analysing the in-memory document reports nothing for every `pageFit` export; the adapter analyses **saved bytes** for that reason. Both are pinned by tests, the second including a deliberately-inverted test that fails if pdf-lib ever makes embedding eager.
- `site/content/docs/design/print.mdx` corrected — it claimed embedded fonts unconditionally.
- Not addressed, deliberately: CMYK/PDF-X (unchanged, still out of scope — a colour axis, not this one) and page splitting (`-dFirstPage`/`-dLastPage`), which the issue mentions as a bonus of the manual workflow.
