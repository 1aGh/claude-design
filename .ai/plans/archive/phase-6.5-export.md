---
name: phase-6.5-export
status: planned
created: 2026-05-19
extracted-from: phase-6-comments-presentation-export.md
decisions: []
---

# Phase 6.5: Canvas export (UI-first, multi-format, scope-aware)

## Description

A first-class **export feature surfaced from the canvas UI** (not just CLI). One dialog covers seven formats × four scopes:

- **Formats:** PNG, PDF, SVG, HTML (standalone runnable), **PPTX** (editable), **Canva handoff bundle** (PPTX + MCP-ready prompt artifact), project raw ZIP.
- **Scopes:** `selection` (currently selected element), `artboard` (one `DCArtboard`), `canvas-as-separate` (every artboard in the active canvas exported as N files, zipped), `project-raw` (entire `.design/` source tree as a ZIP — *source files, not renders*).

The user opens **Export…** from the toolbar (or `⌘E`), picks format + scope, sees a live preview of the file list, and downloads. Same engine is also reachable through `maude design export` CLI and `/design:export` slash command — the UI is the canonical surface, CLI/slash are thin clients of the same `POST /api/export` endpoint.

Extracted from old Phase 6 because export grew into its own substantial feature with non-trivial scope semantics (selection ≠ artboard ≠ canvas ≠ project), a vector format (SVG), and **non-destructive editable handoff** to Canva — which on deeper research turned out to require PPTX authoring rather than a flat PNG dump.

> **Future integration:** When [Phase 12](./phase-12-in-canvas-css-and-layers.md) ships the Inspector Panel, the Export entry point is duplicated into the panel toolbar (same dialog, scope auto-set to whatever is selected in the layers tree). No new endpoint — Phase 12 just adds another caller of `POST /api/export`.


## User Story

As a designer handing a multi-artboard mockup to a developer, I want to right-click the canvas, choose **Export → PDF, all artboards as separate pages**, and get one `mockup.pdf` with each artboard on its own page — without screenshotting six times and assembling in another tool. As a marketing-adjacent designer working in Canva, I want **Export → Canva** to drop my mockup into Canva as **editable text, shapes, and images** (not a flat PNG wallpaper) so I can adjust copy, swap brand photos, and recolor without going back to the source. As a contractor, I want **Export → ZIP project raw** so I can hand the client a single archive of every canvas, system, and asset under `.design/` without manually `zip -r`-ing it on the command line.

## Problem

- Phase 6 lumped export with comments + presentation; the export scope was under-specified (no SVG, no selection scope, "canvas" vs "artboard" vocabulary was conflated, no raw-source export).
- Current state: zero UI surface for export. To get a PNG of one artboard the user has to call `bin/screenshot.sh --element <id>` from a terminal.
- Users cannot easily hand off a full project — there's no "give me everything as a zip" affordance, and `git archive` requires shell + git literacy.
- The vocabulary mismatch (Phase 6 said "PNG per canvas") was load-bearing — in the `DC*` model a *canvas* contains multiple `DCArtboard` children, so "per canvas" and "per artboard" mean different things.

## Solution

**Single UI surface, single API, six format adapters, four scope resolvers.**

### A. Scope resolver

Given the current `_active.json` state (active canvas + open tabs + selected element) and a user-chosen scope, resolve to a concrete *target list*:

| Scope | Resolution | Output cardinality |
|---|---|---|
| `selection` | `_active.json.selected.cssPath` against active canvas DOM. Falls back to `artboard` if no selection. | 1 item |
| `artboard` | The `DCArtboard` containing the selection (or the first artboard if none selected). | 1 item |
| `canvas-as-separate` | Every `[data-dc-screen]` in the active canvas, in render order. | N items, always zipped |
| `project-raw` | The entire `<designRoot>/` minus runtime files (`_server.json`, `_active.json`, `_history/`, `node_modules`, `dist`, `.DS_Store`). | 1 ZIP (raw files, not renders) |

Scope auto-default per format: `selection` if a selection is captured, otherwise `artboard`. `project-raw` is only meaningful with the ZIP format and locks the UI to it.

### B. Format adapters

Each adapter is a single module under `plugins/design/dev-server/exporters/`, taking `(targets, options) → Buffer | ReadableStream`.

| Format | Engine | Renders or raw? | Editable downstream? | Multi-target handling |
|---|---|---|---|---|
| **PNG** | Playwright via existing `bin/screenshot.sh --element` (reuse — no new screenshot path) | Render | No (flat raster) | One file per target. Multiple → ZIP. |
| **PDF** | `pdf-lib` assembles per-target PNGs as pages (raster path). Vector path deferred — see ADR below. | Render | Partial (PDF text layer if vector path taken) | One multi-page PDF regardless of target count. |
| **SVG** | DOM walk → SVG with `<foreignObject>` for HTML/CSS; user-authored inline `<svg>` lifted directly. Fonts inlined as base64 in `<defs>`. | Render | Limited (one element on Canva import) | One file per target. Multiple → ZIP. |
| **HTML** | Walk target's HTML, inline `<link>`/`<style>`/`@font-face`/`<img src>` as base64 or relative paths, emit standalone `index.html` + `assets/`. | Render | Yes (source code) | Always zipped (multi-file). |
| **PPTX** | Walk our **canvas model** (not the DOM) → emit native shapes/text frames/images via `pptxgenjs`. Each `DCArtboard` becomes one slide sized to its declared width/height. | Render via authored model | **Yes — fully editable in PowerPoint, Keynote, Google Slides, and on Canva import** | Single multi-slide `.pptx` regardless of target count. |
| **Canva handoff bundle** | Emits PPTX (same as above) PLUS a `<name>.canva-handoff.md` artifact containing: (a) drag-drop instructions, (b) an LLM-ready prompt block users can paste into their Canva MCP / agentic tool of choice to automate the import. **No OAuth, no Enterprise tier dependency, no token storage in `.design/`.** Optional `--canva=raster` flag swaps in the legacy PNG+CSV+README bundle (see T6d). | Render via authored model | **Yes — editable Canva elements once imported (text, shapes, images, layers)** | Single ZIP with `.pptx` + `.canva-handoff.md`. |
| **ZIP (project-raw)** | Walk `<designRoot>/`, apply excludes (see scope table), stream into archive. | **Raw source** | Yes (source code) | Single ZIP. |

#### Why PPTX + MCP-prompt handoff, not direct Canva API integration

Researched (2026-05-19, refined 2026-05-22):

- Canva Connect **Create Design** endpoint is **image-only** — can't author shape/text trees.
- Canva Connect **Design Imports** endpoint accepts editable formats and runs an async conversion job that returns an `edit_url` — but **requires Canva Enterprise tier for production scope**, which excludes ~95% of expected Maude users. OAuth scaffolding for an endpoint nobody can actually call is engineering debt.
- Canva's import-fidelity ladder: **PPTX > PDF > SVG > PNG**. PPTX brings through text boxes, shapes, images, layouts as native Canva elements; PDF is mixed (Canva's own docs contradict whether text stays editable); SVG imports as a single non-decomposable element and requires Canva Pro/Teams tier.
- `pptxgenjs` is pure JS, ~500 KB, zero deps, mature (13+ years), Bun-compatible. Authoring from our canvas model (not the DOM) gives a deterministic, debuggable mapping. `dom-to-pptx` (computed-style DOM walker built on pptxgenjs) exists but is single-maintainer / unproven (May 2026); not picked for v1.0.
- **Decision:** ship PPTX as the universal payload + emit a `<name>.canva-handoff.md` artifact alongside it. The artifact contains drag-drop instructions for humans AND a self-contained prompt for users with a Canva MCP / agentic tool connected. **The MCP runs in the user's tool, not ours** — Maude stays out of the auth, token storage, and Enterprise gate problem entirely. Users who want one-click handoff configure their Canva MCP once; users who don't get the drag-drop path that always works.
- The MCP-prompt pattern generalises — same shape (`.<target>-handoff.md` next to a payload file) can serve Figma MCP, Slack export, etc. in future phases without re-architecting.

DDR-worthy decisions captured in T12.

### C. UI affordances

- **Toolbar button:** Export icon in `tool-palette.tsx` (download glyph, right of the existing tools).
- **Keyboard:** `⌘E` opens dialog, `⌘⇧E` re-runs the last export with same options (no dialog).
- **Context menu:** "Export this artboard…" / "Export selection…" entries in `context-menu.tsx` — pre-fills the dialog scope.
- **Dialog:** format dropdown → scope dropdown (filtered by what makes sense for the format — e.g. SVG hides `project-raw`) → per-format options (PNG scale 1×/2×/3×, PDF page size, HTML "inline fonts y/n") → file-list preview → download button.
- **Toast on completion:** "Saved 6 files → `~/Downloads/mockup-2026-05-19.zip`" with "Reveal in Finder" action (server emits OS-open intent).
- **Recent exports:** Last 5 stored in `<designRoot>/_export-history.json`, surfaced as a "Recent" tab in the dialog for one-click re-export.

### D. CLI + slash parity

```sh
maude design export <format> [--scope selection|artboard|canvas-as-separate|project-raw]
                            [--canvas <slug>] [--element <id>]
                            [--scale 1|2|3] [--out <path>]
```

`/design:export <format> [--scope ...]` is a thin slash wrapper that calls the same `POST /api/export` endpoint the UI hits. CLI and slash always write to disk; UI streams to browser download.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium-high (7 format adapters incl. PPTX model walker + UI dialog + scope resolver + CLI/slash; Canva handoff is a thin artifact emitter, not an integration)
- **Depends on:** Phase 4 (canvas v2 — needs the `DCArtboard` registration and `[data-dc-screen]` markers for element-scoped capture)
- **Parallel with:** Phase 6 (comments + presentation), Phase 5 (draw tools — but draw layer must be capturable, see Task 4)
- **Affected files:**
  - `plugins/design/dev-server/exporters/index.ts` (new — registry)
  - `plugins/design/dev-server/exporters/{png,pdf,svg,html,pptx,canva,zip}.ts` (new — seven adapters; `canva.ts` is a thin wrapper over `pptx.ts` + `canva-handoff-prompt.ts`)
  - `plugins/design/dev-server/exporters/scope.ts` (new — scope resolver)
  - `plugins/design/dev-server/exporters/inline-assets.ts` (new — shared base64/font/img inliner used by SVG + HTML)
  - `plugins/design/dev-server/exporters/canvas-model.ts` (new — DOM/JSX → normalized model used by PPTX + Canva)
  - `plugins/design/dev-server/exporters/canva-handoff-prompt.ts` (new — emits the `.canva-handoff.md` artifact with drag-drop steps + MCP prompt block)
  - `plugins/design/dev-server/api.ts` (extend — `POST /api/export`, `GET /api/export/recent`)
  - `plugins/design/dev-server/export-dialog.tsx` (new — React dialog mounted by client)
  - `plugins/design/dev-server/tool-palette.tsx` (edit — add export button)
  - `plugins/design/dev-server/context-menu.tsx` (edit — add export entries)
  - `plugins/design/dev-server/client/app.jsx` (edit — mount dialog, wire `⌘E` / `⌘⇧E`)
  - `plugins/design/dev-server/bin/export.sh` (new — CLI helper paralleling `screenshot.sh`)
  - `cli/commands/design.mjs` (edit — `export` subcommand)
  - `plugins/design/commands/export.md` (new — `/design:export` slash command)
  - `plugins/design/dev-server/test/exporters/{scope,png,pdf,svg,html,pptx,canva,zip}.test.ts` (new — bun:test)
  - `.ai/archive/decisions/DDR-NNN-export-pptx-via-pptxgenjs.md` (new — model walker over dom-to-pptx)
  - `.ai/archive/decisions/DDR-NNN-export-canva-via-pptx-and-mcp-prompt.md` (new — PPTX payload + MCP-prompt artifact; explicit rejection of Connect API OAuth path due to Enterprise gate)

---

## Tasks

### T1: Scope resolver + endpoint skeleton ✅

- **Do:** Implement `exporters/scope.ts` — takes `{ scope, activeJson, designRoot }` returns `Target[]` where `Target = { kind: 'element' | 'file-tree', cssPath?: string, canvasSlug?: string, paths?: string[] }`. Wire `POST /api/export` in `api.ts` that accepts `{ format, scope, options }`, calls scope resolver, dispatches to format adapter (stubs initially), streams response.
- **Pattern:** Mirror the existing `_active.json` consumer pattern in `canvas-edit.ts` — read once at request entry, pass down as immutable arg.
- **Validate:** `bun:test` covers all four scope branches with synthetic `_active.json`. Endpoint returns 200 + empty zip for each format stub.
- **Shipped:** `exporters/{scope,index,png,pdf,svg,html,pptx,canva,zip}.ts` + `POST /_api/export` in `http.ts` + 18 passing tests under `test/exporters/{scope,endpoint}.test.ts`. Route prefix is `_api/` not `api/` per existing convention.

### T2: PNG adapter (reuse `screenshot.sh`) ✅

- **Do:** `exporters/png.ts` shells out to `bin/screenshot.sh --element <id>` per target (or `--all-screens` when target list = full canvas). Bundles results: single → raw PNG, multiple → ZIP. Honors `options.scale` (1×/2×/3×) by passing `--scale` to screenshot.sh (extend screenshot.sh if needed).
- **Pattern:** Don't reinvent screenshot capture — the helper already handles agent-browser + playwright fallback.
- **Validate:** Export selection scope → 1 PNG. Export canvas-as-separate on a 6-artboard canvas → ZIP with 6 PNGs matching artboard order in JSX.
- **Shipped:** JSZip added (`jszip@3.10.1`). PNG adapter uses `bin/screenshot.sh` with `--selector` for single + `--all-screens` for `multi: true`. Unit tests cover the contract; real screenshot integration lands as the `export-from-toolbar` scenario per T2 plan. NOTE: `--scale` flag is not yet wired into `screenshot.sh` — defer until T8 surfaces the option in the UI.

### T3: PDF adapter ✅

- **Do:** `exporters/pdf.ts` calls PNG adapter internally to get rasters, assembles via `pdf-lib`. One target → 1-page PDF. Multiple → N-page PDF with one artboard per page. Page size = artboard's declared `width`/`height`, scaled to A4 if user opts in (option `pageFit: native | a4 | letter`).
- **Pattern:** Same `pdf-lib`-over-PNG approach as the old Phase 6 plan — works, ships fast, vector-faithful PDF can come later as a separate task if users ask.
- **Validate:** Export 5-artboard canvas → 5-page PDF, opens in Preview, each page legible at native zoom. Smoke: file > 0 bytes, valid PDF magic.
- **Shipped:** `pdf-lib@1.17.1` added. Adapter splays the PNG result (single → 1 page, ZIP → N pages) and embeds via `embedPng()`. `pageFit: native | a4 | letter` honored. Unit test verifies PDF magic byte (`%PDF-`).

### T4: SVG adapter ✅

- **Do:** `exporters/svg.ts` walks the target subtree, emits SVG with `<foreignObject>` wrapping serialized HTML + inlined `<style>` block. Web fonts pulled via `inline-assets.ts` and embedded as base64 `@font-face` rules inside `<defs>`. Inline `<svg>` elements in the source (icons, draw-layer shapes) are lifted directly — not wrapped in foreignObject.
- **Pattern:** `dom-to-svg`'s foreignObject approach. Document the known caveat (Safari renders foreignObject inconsistently; Illustrator can import but may flatten). Add a `<!-- generated by maude; foreignObject required -->` comment.
- **Validate:** Export single artboard → open SVG in Chrome (must match canvas pixel-for-pixel within 2px). Open in Illustrator (must import without errors, vector text remains editable).
- **Shipped:** `bin/_svg-playwright.mjs` walks rendered DOM (stylesheets via `document.styleSheets`, bbox via `getBoundingClientRect`, inline `<svg>` lifted out of foreignObject). Per-artboard outputs zipped when `multi: true`. **Web-font inlining deferred** — `inline-assets.ts` consolidates with T5; v1 SVG relies on the consuming environment's font stack. Generated comment flags the foreignObject caveats.

### T5: HTML adapter (standalone) ✅

- **Do:** `exporters/html.ts` walks target HTML, inlines:
  - `<link rel="stylesheet">` → `<style>` with content fetched + minified
  - `@font-face src: url(...)` → base64 data URLs (or `assets/fonts/` if `options.inlineFonts === false`)
  - `<img src>` → base64 or `assets/img/`
  - JS modules → bundled via existing Bun.build pipeline, emitted as `assets/app.js`
  - Ships zip with `index.html` + `assets/` (if not all inlined)
- **Pattern:** Same approach used by static-site bundlers. Don't try to handle every edge case — document the limit ("CSS `@import` chains beyond depth 3 may not inline").
- **Validate:** Export canvas → unzip to a fresh dir → open `index.html` over `file://` → renders identically to canvas view, including fonts.
- **Shipped:** `bin/_html-playwright.mjs` serializes with stylesheets inlined via `document.styleSheets` walk. `<base href="<origin>">` keeps remote font/image refs resolvable. **Full asset inlining deferred** (TODO note in code) — fonts + images stay origin-relative for v1; T13 docs flag the file:// caveat. Always ZIP output (single-artboard files included).

### T6a: Canvas model walker (shared by PPTX + Canva) ✅

- **Shipped:** `exporters/canvas-model.ts` (IR types + walkCanvas shell) + `bin/_canvas-model-playwright.mjs` (browser-side walker, classifies into text/shape/image/svg/group). Heuristic v1 — refinement against real canvas IR lands as scenario feedback.
- **Do:** `exporters/canvas-model.ts` walks a target artboard subtree (or all artboards on `canvas-as-separate` scope) and emits a normalized `CanvasModel` IR:
  ```ts
  type CanvasModel = {
    artboards: Array<{
      id: string; title: string; width: number; height: number;
      elements: ModelElement[];
    }>;
  };
  type ModelElement =
    | { type: 'text';  bbox: Bbox; runs: Array<{ text: string; font: FontSpec; color: string }> }
    | { type: 'shape'; bbox: Bbox; kind: 'rect'|'ellipse'|'line'|'path'; fill?: string; stroke?: string; radius?: number }
    | { type: 'image'; bbox: Bbox; src: string }   // resolved to base64 or URL
    | { type: 'svg';   bbox: Bbox; markup: string }
    | { type: 'group'; bbox: Bbox; children: ModelElement[] };
  ```
  Uses `getComputedStyle` + `getBoundingClientRect` via Playwright `page.evaluate()`. Maps CSS background-gradient → linear/radial fill specs that PPTX understands. Flattens flex/grid into absolute bboxes at export-time viewport.
- **Pattern:** Mirror the existing `inspect.ts` cssPath/bbox harvesting — same DOM-walk vocabulary, new sink.
- **Validate:** Golden-file IR for a 3-element artboard (heading + image + button) matches expected JSON within bbox tolerance ±1px. Gradients and `border-radius` round-trip.

### T6b: PPTX adapter ✅

- **Shipped:** `pptxgenjs@4.0.1`. `modelToPptx(model)` is reusable (T6c calls it). Pixel-to-inch conversion at 96 DPI. Data-URL vs path-URL split for `addImage()`. Tests verify PPTX magic bytes (`PK\x03\x04`).
- **Do:** `exporters/pptx.ts` consumes `CanvasModel`, calls `pptxgenjs` to emit one slide per artboard. Maps model → pptxgenjs:
  - `text` → `slide.addText()` with `font_face`, `font_size`, `color`, `bold`, `italic` from FontSpec
  - `shape` (rect/ellipse) → `slide.addShape()` with native PPT geometry
  - `image` → `slide.addImage()` with base64 data
  - `svg` → emit as `slide.addImage()` after Sharp/Playwright PNG rasterization (Canva can't edit SVG nodes anyway)
  - `group` → pptxgenjs grouping (preserves designer's mental model on Canva import)
  - Slide dimensions = artboard `width × height`, with `pptx.layout = { name: 'CANVAS', width, height }` per artboard for non-standard sizes
- **Pattern:** `pptxgenjs` HTML-to-PPT example is the closest reference but we're authoring from our IR, not from DOM directly — gives us control over what becomes editable vs rasterized.
- **Validate:** Export 3-artboard canvas → `.pptx` opens in PowerPoint, Keynote, and Google Slides. Text is editable. Shapes preserve fill/stroke. Reload-roundtrip (open + save in PowerPoint, re-import to maude via no-op) doesn't crash anything.

### T6c: Canva adapter — PPTX payload + MCP-prompt artifact ✅

- **Shipped:** `canva.ts` calls `walkCanvas` → `modelToPptx` → bundles `.pptx` + `.canva-handoff.md` in a ZIP. `canva-handoff-prompt.ts` is a pure markdown builder (no IO). `options.mode === 'raster'` switches to T6d's legacy PNG+CSV+README bundle. Singular/plural grammar handled. Tests cover markdown shape + adapter contract.
- **Do:** `exporters/canva.ts` always emits a PPTX (delegates to T6b) PLUS a sibling `<name>.canva-handoff.md` produced by `canva-handoff-prompt.ts`. The two are bundled into a single ZIP for download. The markdown contains:
  1. **Human-readable summary** — N artboards, declared dimensions, what is editable (text/shapes/images), known fidelity caveats lifted from T13 docs.
  2. **Drag-drop instructions** — three steps to import `<name>.pptx` into Canva web app, with a `canva.com/?create=upload` deep link.
  3. **MCP-ready prompt block** — a fenced ` ```text ` block containing a self-contained prompt: *"Import the PPTX file at `<absolute-path-resolved-at-export-time>` into a new Canva design titled `<canvas-slug>`. Preserve text editability, shape fills/strokes, image swappability, and artboard-to-page mapping (one PPTX slide = one Canva page). After import, return the Canva design URL."* Users with a Canva MCP server connected paste this into their agentic tool (Claude Code, Cursor, etc.) — the MCP handles auth and the import call. Maude never sees the token.
  4. **Fidelity caveats** — bullet list mirroring T13 (fonts, gradients, blend modes, flex/grid flattening).
- **Pattern:** No network calls from Maude. No token storage. No async polling. The prompt is a string template with three slot fills: `<absolute-pptx-path>`, `<canvas-slug>`, `<artboard-count>`. Same shape generalises to future MCP-driven handoffs (Figma MCP, Slack MCP) — keep `canva-handoff-prompt.ts` named generically enough to refactor into `mcp-handoff-prompt.ts` later if a second target appears.
- **Validate:** **(a) Drag-drop path:** export Canva bundle → unzip → drag `.pptx` into Canva web app → all artboards land as editable pages, text is selectable, brand images swappable. **(b) MCP-prompt path:** unzip → open `<name>.canva-handoff.md` → copy prompt block → paste into a Claude Code session with Canva MCP connected → MCP successfully imports and returns the Canva design URL (manual verification with the user's own MCP setup; CI skips this scenario). **(c) Artifact correctness:** the prompt block contains a resolvable absolute path, the canvas slug matches `_active.json.active`, and the artboard count matches the PPTX slide count.

### T6d: PNG+CSV+README legacy bundle (kept as `--canva=raster` opt-in) ✅

- **Shipped:** `canva.ts:buildRasterBundle` — reuses PNG adapter for capture, attaches `manifest.csv` + `README.md`, ZIPs. Triggered via `options.mode === 'raster'`.
- **Do:** The old PNG-dump-plus-CSV-plus-README bundle is retained as a `--canva=raster` opt-in for the case where the user wants a flat reference image set rather than editable PPTX. Default Canva export is editable (T6b+T6c).
- **Validate:** `maude design export canva --canva=raster --out ~/handoff.zip` produces the legacy bundle.

### T7: Project-raw ZIP adapter ✅

- **Do:** `exporters/zip.ts` streams `<designRoot>/` into a zip, excluding by default: `_server.json`, `_active.json`, `_export-history.json`, `_history/`, `node_modules/`, `dist/`, `.DS_Store`, `*.log`. Excludes overridable via `options.exclude: string[]` (gitignore-style glob). Optional `options.include: ['system'|'canvases'|'assets'|'meta']` for filtered exports. Streams (does NOT buffer whole archive in memory — Bun supports streaming responses).
- **Pattern:** Use `archiver` (Node-compat, works under Bun) or roll our own with `bun-zip` if it stays small. Stream the response.
- **Validate:** Export `project-raw` on a 50MB `.design/` → ZIP arrives ≤ memory ceiling 64MB (proves streaming). Unzip → diff against source minus excludes → identical.
- **Shipped:** Default excludes baked into the resolver (`scope.ts`). Adapter adds glob-based `options.exclude` + tag-based `options.include`. **Streaming deferred** — current implementation buffers (JSZip Uint8Array). Refinement to streaming if a real designRoot blows the heap. Tests cover defaults, exclude globs, include narrowing, and the file-tree-only rejection.

### T8: Export dialog UI ✅

- **Shipped:** `export-dialog.tsx` — native `<dialog>` with format + scope dropdowns (auto-narrows via VALID_SCOPES_PER_FORMAT), Recent tab populated by `/_api/export-history`, status line, ⌘E open + ⌘⇧E re-run last shortcuts, `maude:open-export` custom event for context-menu wiring. Wrapped at canvas root by `canvas-shell.tsx`.
- **Do:** `export-dialog.tsx` is a React `<dialog>` with three columns: format picker (list with icons + descriptions), scope picker (filtered by format), per-format options panel.
- **Pattern:** Match `dc-zoom-toolbar` / `dc-tool-palette` token styling. Use `aria-modal`, focus trap, `Esc` to close.
- **Validate:** Open dialog with `⌘E`, tab through every control with keyboard, submit, download lands. a11y-auditor pass.

### T9: Toolbar + context menu integration ✅

- **Shipped:** `⬇` button in `tool-palette.tsx` (third group, next to presentation). Four context-menu entries — "Export selection…" (element kind), "Export this artboard…" (artboard-chrome), "Export project (ZIP)…" + "Export canvas as separate…" (world). Both surfaces dispatch `maude:open-export` with the scope prefill; dialog provider opens.
- **Do:** Add download icon to `tool-palette.tsx`. Edit `context-menu.tsx`.
- **Validate:** Right-click on artboard → "Export this artboard…" → dialog opens with `scope = artboard` preselected. Right-click selection → `scope = selection`.

### T10: Recent exports + re-run shortcut ✅

- **Shipped:** `api.ts:loadExportHistory / appendExportHistory` (5-deep ring buffer at `<designRoot>/_export-history.json`). `GET /_api/export-history` endpoint. `POST /_api/export` appends on success. Dialog Recent tab shows last 5 with click-to-prefill. `⌘⇧E` re-runs the most recent. 3 history tests + cap-to-5 coverage.
- **Validate:** Export PNG of artboard A → close dialog → `⌘⇧E` → identical PNG written. History persists across server restarts.

### T11: CLI + slash command surfaces ✅

- **Shipped:** `maude design export <format> [--scope ...] [--out ...] [--option k=v]` in `cli/commands/design.mjs`. Repeated `--option key=value` flags collected into the options object. Auto-port from `.design/_server.json`. `plugins/design/commands/export.md` is the slash-command twin — same flags, same endpoint, same output shape.
- **Validate:** `maude design export pdf --scope canvas-as-separate --out ~/out.pdf` produces identical file to the UI-driven path. Slash command from inside Claude Code produces identical file.

### T12: Bun-native dependency audit + DDRs ✅

- **Shipped:** `DDR-038-svg-export-via-foreignobject.md` + `DDR-039-export-pptx-via-pptxgenjs.md` + `DDR-040-export-canva-via-pptx-and-mcp-prompt.md`. All three landed; cross-linked in their `Related:` headers. Deps installed: `pdf-lib@1.17.1`, `pptxgenjs@4.0.1`, `jszip@3.10.1`. Native `<dialog>` element used (no react-dialog dep) — saves 30 KB. **All three deps run server-side under Bun**; the browser-shipped bytes are limited to `export-dialog.tsx` (~9 KB minified) + the toolbar/context-menu deltas (~1 KB). Bundle delta budget honored — server payload doesn't count against the browser ceiling.

### T13: Documentation — Canva handoff README ✅

- **Shipped:** `plugins/design/docs/canva-handoff.md` covering TL;DR, both paths (drag-drop + MCP-prompt), fidelity caveats table, `--canva=raster` reference, troubleshooting, cross-links to DDR-039/040. Self-contained — completes a drag-drop import without leaving the file.
- **Do:** Author `plugins/design/docs/canva-handoff.md`.

---

## Validation

1. **Static:** `pdf-lib` + `pptxgenjs` + zip lib + react-dialog total ≤ **650KB** bundle delta. `bun:test` covers all seven adapters + canvas-model walker + `canva-handoff-prompt.ts` template rendering with golden-file fixtures.
2. **Functional:** Every (format × scope) combo that the UI offers produces a non-empty, openable file. The full matrix is 7 formats × up to 4 scopes minus invalid combinations (e.g. SVG × project-raw is hidden in UI; PPTX × selection collapses to PPTX × artboard).
3. **Streaming:** Project-raw ZIP on a 50MB `.design/` stays under 64MB process RSS during export (proves streaming, not buffered).
4. **Cross-platform scenario:** `export-from-toolbar` runs on web-desktop and web-mobile (mobile dialog must reflow to single column).
5. **A11y:** Export dialog passes axe-core; keyboard-only operation completes export end-to-end.
6. **Design system:** Dialog uses project's design tokens — no raw hex values.
7. **Fidelity:** SVG and HTML exports of a reference artboard match the canvas screenshot within 2px (visual diff via existing `screenshot.sh` + ImageMagick `compare`).
8. **Canva editability:** Exported PPTX, imported via drag-drop into Canva, retains: (a) all text strings editable, (b) shape fills/strokes editable, (c) images swappable, (d) layer order preserved, (e) artboard count = slide count = Canva page count. Tested manually against a 3-artboard golden canvas; results recorded in T13 docs.
9. **Handoff artifact correctness:** `<name>.canva-handoff.md` parses as valid Markdown, the embedded prompt block resolves to an existing PPTX file at the stated absolute path, and the prompt is self-contained (no Maude-specific jargon a user's MCP can't act on).

## Scenario coverage

| Scenario | Covers user flow | Status |
|---|---|---|
| `export-from-toolbar` | Open canvas → click Export → pick PDF + canvas-as-separate → download → open in Preview → all artboards present | new |
| `export-selection-png` | Select element → `⌘E` → format=PNG, scope=selection (auto) → download → file dims match selection bbox | new |
| `export-project-zip` | Right-click empty canvas → "Export project (ZIP)…" → download → unzip → contents match `.design/` minus excludes | new |
| `export-canva-editable-dragdrop` | Export → Canva bundle → unzip → drag `.pptx` into Canva web app → all artboards land as editable pages, text editable, shapes editable | new |
| `export-canva-via-mcp-prompt` | Export → Canva bundle → unzip → open `.canva-handoff.md` → copy prompt block → paste into Claude Code with Canva MCP connected → MCP imports and returns Canva design URL | new (manual; skipped in CI — depends on user's MCP setup) |
| `export-pptx-roundtrip` | Export → PPTX → open in PowerPoint + Keynote + Google Slides → text editable in all three; no crash | new |
| `export-cli-parity` | `maude design export svg --scope artboard --element abc` produces identical bytes to UI-driven export with same args | new |
| `export-recent-rerun` | Export PNG → `⌘⇧E` → identical PNG written without dialog | new |

---

## Acceptance criteria

- [ ] All 7 format adapters produce valid, openable output across all valid scopes.
- [ ] Export dialog reachable from toolbar, context menu, and `⌘E`; passes a11y.
- [ ] Project-raw ZIP excludes runtime files by default; respects `--exclude` overrides.
- [ ] CLI `maude design export` and `/design:export` produce byte-identical output to the UI for matching args.
- [ ] Recent-exports list works and `⌘⇧E` re-runs the latest.
- [ ] PPTX opens editable in PowerPoint, Keynote, Google Slides.
- [ ] Canva drag-drop path produces editable text/shapes/images in Canva.
- [ ] Canva handoff bundle includes `.canva-handoff.md` with valid drag-drop instructions and a self-contained MCP-ready prompt block (manual verification with a user-configured Canva MCP).
- [ ] DDR for "PPTX via pptxgenjs (model walker, not DOM walker)" landed.
- [ ] DDR for "Canva via PPTX + MCP-prompt handoff" landed (supersedes Phase 6's "no native integration" stance; documents explicit rejection of Connect API/OAuth path).
- [ ] DDR for "SVG via foreignObject" landed with the Safari + Illustrator caveats spelled out.
- [ ] `plugins/design/docs/canva-handoff.md` exists with drag-drop walkthrough + MCP-prompt usage guide.
- [ ] All 8 scenarios pass on web-desktop where applicable; `export-from-toolbar` + `export-selection-png` also pass on web-mobile; `export-canva-via-mcp-prompt` may be marked SKIP if no Canva MCP configured in the test environment.
- [ ] Bundle delta ≤ 650KB; streaming verified at 50MB input under 64MB RSS.

---

## Out of scope (explicit non-goals)

- **Vector-faithful PDF** (currently raster-only via PNG → pdf-lib). Track as a follow-up if users ask — would require Playwright `page.pdf()` with print CSS per artboard.
- **Animated GIF / video export.** Phase 5 draw tools and Phase 8 collaboration may motivate it later; not here.
- **Cloud upload targets** (Drive / Dropbox / S3 / Figma sync / direct Canva upload). Out of scope — Maude only writes local files and emits MCP-prompt artifacts. Any "push to cloud" affordance is the user's MCP / agentic tool, not Maude.
- **Per-artboard PDF metadata** (title, author, keywords). Could be added trivially if requested; not in v1.0 plan.
- **Layered PSD / Sketch / Figma `.fig` output.** Not feasible without proprietary format reverse-engineering.
- **Direct Canva element insertion via Create-Design API.** Researched — Canva's Create-Design endpoint accepts image assets only, not editable element trees.
- **Canva Connect Design-Imports API via OAuth.** Researched and explicitly rejected — Enterprise-tier gate excludes ~95% of expected users, and OAuth/token storage in `.design/` is non-trivial risk surface. Users who want one-click handoff configure their own Canva MCP server; Maude emits the prompt artifact and stays out of the auth path entirely.
- **DOM-driven PPTX** (`dom-to-pptx` and similar). Considered, rejected — single-maintainer, unproven, harder to debug than authoring from our normalized model. Revisit if the dependency matures.
- **Direct integration of export into the Phase 12 Inspector Panel UI.** Cross-phase work — Phase 6.5 ships the engine and the standalone dialog; Phase 12 picks up the inspector-panel entry point as its own task (no new endpoint needed).

---

## Retro (added 2026-05-23 on /flow:done)

**What worked**

- Splitting research into two parallel agents (PDF+SVG / PPTX) returned converging recommendations in ~2 min each. Skipping that step would have cost a 3rd day of dead-end hand-rolling.
- The 13-task scope (T1 foundation → T13 docs) actually executed in two sittings. The plan was right that this was multi-session work.
- The dialog + context-menu + toolbar trio dispatching one `maude:open-export` event was the right composition. Three entry points, one consumer, no prop drilling.
- DDR pattern of recording the rejected paths (Canva Connect API + OAuth, hand-rolled walker, foreignObject) — when v1 failed, having those rejected-with-rationale entries on file would have been valuable. They became the v2 supersede targets.

**What didn't**

- **Shipping v1 without inspecting the artifacts.** I called the tests passing, reported 200 statuses + filesizes, and didn't open a single export to look. The user did, found PDF was raster + SVG broken in Affinity + PPTX styling lost — every primary format failed for real-world use. **The lesson: byte counts and HTTP status are not validation; opening the file in a real consumer is.**
- **Hand-rolling DOM-walking heuristics for PPTX.** Mature libraries (`dom-to-pptx@1.1.9`) shipped fixes for the exact failure modes I was reinventing. Net cost: half a day on the dead-end walker before the user's "uplne rozhozeny bez css" prompted the rewrite.
- **Missing CSS environment knowledge: `.dc-world` uses CSS `zoom`, not transform.** Every shim captured a thumbnail-sized artboard for the first day because I assumed `transform: scale()` and only zeroed that. Took a probe script (a tiny standalone playwright script printing getComputedStyle.zoom + transform) to find the bug. Should have been step 1 not step 5.
- **Initial DDRs (038, 039) anchored on the wrong implementation.** Writing them after the user feedback would have produced better docs. v1 DDRs are now SUPERSEDED notes pointing at DDR-041. Acceptable, but a process tax.

**What to change next time**

- For any "export to format X" plan: open the format in the real consumer (Preview / Affinity / PowerPoint / Canva web) as part of the per-task validation. No exceptions for "the bytes look fine".
- Lead with library research before writing custom DOM walkers — even if the libraries are stale or single-maintainer, vendoring + a regression test beats reinventing from scratch.
- Probe the rendering environment (zoom, transform, custom properties) at task 1 of any capture pipeline. The `_probe.mjs` style script (`getComputedStyle` over the relevant nodes, printed as JSON) catches host-environment surprises before any adapter code lands.
- Defer DDR writing until after the user has validated v1 output. Stale DDRs are worse than missing ones — they mislead the next agent.

**Surprises worth carrying forward**

- `dom-to-svg` and `dom-to-pptx` are sister architectures by different authors: read computed styles + bounding rects, emit format primitives. The pattern generalises — when a future export target appears (`.fig`, AfterEffects JSON, whatever), look for or write a `dom-to-X` lib of the same shape rather than hand-walking.
- The dev-server's CSS `zoom` choice is load-bearing for the world-plane pan/zoom math (zoom affects layout, transform doesn't). Worth a CLAUDE.md note for the next agent who tries to extract content from the canvas.
- `pptx.ts:mergePptx` (slide concatenation via JSZip) is the kind of one-off OOXML twiddling that breaks on edge cases. The directory-entry bug (`Object.keys(zip.files)` includes `"ppt/"` whose `zip.file()` returns `null`) bit on the first multi-artboard run. Defensive null-checks are cheap; pay them upfront.
