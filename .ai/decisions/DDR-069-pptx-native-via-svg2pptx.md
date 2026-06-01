# DDR-069: PPTX export via svg2pptx (native editable shapes) with a PNG fallback

- **Date:** 2026-06-01
- **Status:** Accepted
- **Tags:** design, dev-server, export, pptx, svg2pptx, python-dependency, canva, keynote, fonts, regression-prevention
- **Related:** [DDR-043](./DDR-043-bias-free-design-plugin-templates.md), [DDR-058](./DDR-058-maude-doctor-deps-config-quality.md), [DDR-060](./DDR-060-canvas-origin-split.md), [RCA `issue-nefunguji-exporty-v2`](../logs/rca/issue-nefunguji-exporty-v2.md), [export-pipeline-fixes plan](../plans/export-pipeline-fixes.md)

## Context

The PPTX exporter went through three architectures chasing one goal a user
stated plainly: a deck that **opens everywhere (incl. Canva), looks 1:1 with the
design, and is editable**. Each prior approach failed a hard requirement, proven
by live testing (PowerPoint + Keynote + Canva) and LibreOffice renders:

1. **`dom-to-pptx`** (DOM → native shapes): reflows text with the viewer's font
   metrics → overflow/overlap. Its multi-artboard merge also produced an invalid
   package (dropped `slideMaster` rels via a `[^/]*` regex that truncates on the
   `//` in relationship Type URLs; colliding `image-1-*` media across slides;
   missing Content-Types Overrides) → "won't open in **anything**". See RCA v2.
2. **SVG-image** (`pptxgenjs` `addImage` SVG → `<asvg:svgBlip>` + raster
   fallback): faithful, vector in PowerPoint 365 — but **Canva rejects the
   `svgBlip` extension** ("file is corrupt") and **Keynote rasterizes it** (not
   editable). Also: `pptxgenjs` can't rasterize in Node, so the `<a:blip>`
   fallback it writes is SVG bytes in a `.png` part → blank in fallback viewers.
3. **`svg2pptx`** (SVG → native shapes, Python): the only OSS tool that yields
   faithful **and** editable native objects — but two bugs made its first output
   look broken: it reads `text@x/y` (dom-to-svg leaves those off, positioning on
   the `<tspan>`) → every run collapsed to `(0,0)` and overlapped; and it copies
   the whole CSS `font-family` stack into the single-valued PPTX `typeface` →
   no font matches → generic fallback.

LibreOffice `--convert-to pptx` from SVG was also evaluated as the "most mature"
converter: it emits an **empty** deck for our complex SVG. Ruled out.

## Decision

**PPTX (and the PPTX inside the Canva bundle) is built by rendering each
artboard to SVG, pre-processing the SVG, converting it to native PowerPoint
objects with `svg2pptx` (Python), and merging the per-artboard single-slide
decks into one.** When `svg2pptx`/`python3` is unavailable (or `options.raster`),
it falls back to a **PNG-per-slide deck** (faithful, universal, Canva-safe, NOT
editable) with a one-line install hint.

Two pre-processing transforms (`preprocessSvg`, pure + unit-tested) make
`svg2pptx` faithful — they are the load-bearing fix:

- **Lift the first `<tspan>` x/y onto its `<text>` parent.** Without it every
  text run sits at `(0,0)` (the catastrophic pile-up). Verified: text lands at
  the right positions in Keynote/Canva with the design font installed.
- **Collapse `font-family="<CSS stack>"` to its first concrete name.** A PPTX
  `typeface` is a single font name, not a fallback list. We write **the design's
  own first font** (e.g. `Berkeley Mono` for this DS) — never a hardcoded one —
  so it honours whatever the canvas's DS uses.

The merge (`mergeDecks`, pure + unit-tested) reuses the corrected OOXML surgery
from RCA v2: preserve non-slide presentation rels (`[^>]*`, not `[^/]*`),
renumber slides contiguously, re-emit Content-Types slide Overrides, and **strip
any Override whose part doesn't exist** (`pptxgenjs`/`svg2pptx` over-declare one
`slideMaster<N>` per slide but write a single master — strict consumers reject
the dangling Overrides). `svg2pptx` output carries no media, so unlike the
dom-to-pptx merge there is no media-collision to namespace.

## Consequences

- **New soft dependency: `python3` + `svg2pptx`** (declared in
  `plugins/design/dependencies.json`, `hardness: "soft"`). The dev-server is
  Bun/Node; this is the first Python touchpoint. It is **soft** — absence
  degrades to the PNG deck, never an error. `MAUDE_SVG2PPTX` overrides the
  executable (venv path, or `python3 -m svg2pptx`).
- **Fonts are not embeddable for the exact design font.** The design font must
  be *installed* in the viewer (macOS for Keynote) or *uploaded* (Canva Brand
  Kit). Embedding helps only PowerPoint; Keynote is partial and **Canva ignores
  embedded PPTX fonts**. So the file names the font (correct for anyone who has
  it) and the user installs it — an accepted limitation, not a bug.
- **Fidelity is "editable + faithful in real apps", not pixel-locked across all
  renderers.** SVG baseline (`text-after-edge`) vs PPTX text-box metrics differ
  per renderer; LibreOffice (no design font → wide fallback) exaggerates
  overlap, while Keynote/Canva with the design font render cleanly (user-
  confirmed). We do NOT baseline-shift in `preprocessSvg` — empirically the
  un-shifted lift renders correctly in the target apps.
- **Dead code:** `bin/_pptx-playwright.mjs` + `bin/_enumerate-artboards-playwright.mjs`
  + the `dom-to-pptx` npm dep are no longer used by `pptx.ts`. Left in place for
  now; flagged for a follow-up cleanup (remove from `package.json`/shims).

## Alternatives considered

- **Stay on the SVG-image (`svgBlip`) path** — faithful + vector in PowerPoint,
  zero extra dependency. Rejected: Canva (a hard requirement) rejects it as
  corrupt and Keynote rasterizes it (not editable).
- **PNG-only default** — universal, Canva-safe, faithful, zero dependency.
  Kept as the *fallback*, not the default: it is not editable, which was the
  user's primary ask. (Selectable via `options.raster`.)
- **Fork/patch `svg2pptx`** to control text-box vertical metrics for pixel-exact
  baselines. Deferred: the un-shifted lift already renders correctly in the
  target apps; forking is a deep, per-renderer rabbit hole with uncertain payoff.
- **Port `svg2pptx` to JS** to avoid the Python dependency. Deferred: it's a
  non-trivial SVG→DrawingML engine; revisit if the Python soft-dep proves a
  real adoption barrier.
