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

- **Formats:** PNG, PDF, SVG, HTML (standalone runnable), **PPTX** (editable), **Canva** (editable via Connect API or PPTX drag-drop), project raw ZIP.
- **Scopes:** `selection` (currently selected element), `artboard` (one `DCArtboard`), `canvas-as-separate` (every artboard in the active canvas exported as N files, zipped), `project-raw` (entire `.design/` source tree as a ZIP — *source files, not renders*).

The user opens **Export…** from the toolbar (or `⌘E`), picks format + scope, sees a live preview of the file list, and downloads. Same engine is also reachable through `maude design export` CLI and `/design:export` slash command — the UI is the canonical surface, CLI/slash are thin clients of the same `POST /api/export` endpoint.

Extracted from old Phase 6 because export grew into its own substantial feature with non-trivial scope semantics (selection ≠ artboard ≠ canvas ≠ project), a vector format (SVG), and **non-destructive editable handoff** to Canva — which on deeper research turned out to require PPTX authoring, not the original "PNG dump + README" plan.

### Inspiration: parity with Anthropic's Claude Design

Anthropic launched [Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs) (Anthropic Labs, April 2026) — a code-first design tool whose export surface is **Canva + PDF + PPTX + standalone HTML + shared URL**, with the [Canva integration co-marketed](https://www.canva.com/newsroom/news/canva-claude-design/) as the headline handoff. Their Canva mechanism is undocumented but, given Canva's import-fidelity ladder, almost certainly the [Canva Connect Design-Imports API](https://www.canva.dev/docs/connect/api-reference/design-imports/create-design-import-job/) wrapped in an OAuth flow with PPTX as the payload. **This plan targets parity** — same format ladder, same Canva mechanism, plus the formats Claude Design omits (SVG, raw ZIP, per-element selection).

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
| **Canva** | **Two delivery paths:** (a) emit PPTX (same as above) + open Canva drag-drop flow (no auth needed); (b) emit PPTX + push via [Canva Connect Design-Imports API](https://www.canva.dev/docs/connect/api-reference/design-imports/create-design-import-job/) if user supplied an OAuth token (returns `edit_url` for one-click handoff). Falls back to PNG+CSV+README handoff bundle if PPTX adapter unavailable. | Render via authored model | **Yes — editable Canva elements (text, shapes, images, layers)** | Single `.pptx` or single Canva design URL. |
| **ZIP (project-raw)** | Walk `<designRoot>/`, apply excludes (see scope table), stream into archive. | **Raw source** | Yes (source code) | Single ZIP. |

#### Why PPTX, not direct Canva API element insertion

Researched (2026-05-19, see commit msg for source links):

- Canva Connect **Create Design** endpoint is **image-only** — can't author shape/text trees.
- Canva Connect **Design Imports** endpoint accepts the same formats Canva's UI accepts, runs an async conversion job, and returns an editable design URL.
- Canva's import-fidelity ladder: **PPTX > PDF > SVG > PNG**. PPTX brings through text boxes, shapes, images, layouts as native Canva elements; PDF is mixed (Canva's own docs contradict whether text stays editable); SVG imports as a single non-decomposable element and requires Canva Pro/Teams tier.
- `pptxgenjs` is pure JS, ~500 KB, zero deps, mature (13+ years), Bun-compatible. Authoring from our canvas model (not the DOM) gives a deterministic, debuggable mapping. `dom-to-pptx` (computed-style DOM walker built on pptxgenjs) exists but is single-maintainer / unproven (May 2026); not picked for v1.0.
- Canva Connect API requires Canva Enterprise for production — the drag-drop fallback is the path for everyone else.

DDR-worthy decisions captured in T13.

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
- **Complexity:** High (7 format adapters incl. PPTX model walker + Canva Connect OAuth + UI dialog + scope resolver + CLI/slash)
- **Depends on:** Phase 4 (canvas v2 — needs the `DCArtboard` registration and `[data-dc-screen]` markers for element-scoped capture)
- **Parallel with:** Phase 6 (comments + presentation), Phase 5 (draw tools — but draw layer must be capturable, see Task 4)
- **Affected files:**
  - `plugins/design/dev-server/exporters/index.ts` (new — registry)
  - `plugins/design/dev-server/exporters/{png,pdf,svg,html,pptx,canva,zip}.ts` (new — seven adapters)
  - `plugins/design/dev-server/exporters/scope.ts` (new — scope resolver)
  - `plugins/design/dev-server/exporters/inline-assets.ts` (new — shared base64/font/img inliner used by SVG + HTML)
  - `plugins/design/dev-server/exporters/canvas-model.ts` (new — DOM/JSX → normalized model used by PPTX + Canva)
  - `plugins/design/dev-server/exporters/canva-connect.ts` (new — OAuth + Design-Imports client)
  - `plugins/design/dev-server/api.ts` (extend — `POST /api/export`, `GET /api/export/recent`, `GET/POST /api/canva-auth`)
  - `plugins/design/dev-server/export-dialog.tsx` (new — React dialog mounted by client)
  - `plugins/design/dev-server/tool-palette.tsx` (edit — add export button)
  - `plugins/design/dev-server/context-menu.tsx` (edit — add export entries)
  - `plugins/design/dev-server/client/app.jsx` (edit — mount dialog, wire `⌘E` / `⌘⇧E`)
  - `plugins/design/dev-server/bin/export.sh` (new — CLI helper paralleling `screenshot.sh`)
  - `cli/commands/design.mjs` (edit — `export` subcommand)
  - `plugins/design/commands/export.md` (new — `/design:export` slash command)
  - `plugins/design/dev-server/test/exporters/{scope,png,pdf,svg,html,pptx,canva,zip}.test.ts` (new — bun:test)
  - `.ai/decisions/DDR-NNN-export-pptx-via-pptxgenjs.md` (new — model walker over dom-to-pptx)
  - `.ai/decisions/DDR-NNN-export-canva-via-connect-design-imports.md` (new — Connect API + drag-drop fallback, supersedes "no native Canva integration")

---

## Tasks

### T1: Scope resolver + endpoint skeleton

- **Do:** Implement `exporters/scope.ts` — takes `{ scope, activeJson, designRoot }` returns `Target[]` where `Target = { kind: 'element' | 'file-tree', cssPath?: string, canvasSlug?: string, paths?: string[] }`. Wire `POST /api/export` in `api.ts` that accepts `{ format, scope, options }`, calls scope resolver, dispatches to format adapter (stubs initially), streams response.
- **Pattern:** Mirror the existing `_active.json` consumer pattern in `canvas-edit.ts` — read once at request entry, pass down as immutable arg.
- **Validate:** `bun:test` covers all four scope branches with synthetic `_active.json`. Endpoint returns 200 + empty zip for each format stub.

### T2: PNG adapter (reuse `screenshot.sh`)

- **Do:** `exporters/png.ts` shells out to `bin/screenshot.sh --element <id>` per target (or `--all-screens` when target list = full canvas). Bundles results: single → raw PNG, multiple → ZIP. Honors `options.scale` (1×/2×/3×) by passing `--scale` to screenshot.sh (extend screenshot.sh if needed).
- **Pattern:** Don't reinvent screenshot capture — the helper already handles agent-browser + playwright fallback.
- **Validate:** Export selection scope → 1 PNG. Export canvas-as-separate on a 6-artboard canvas → ZIP with 6 PNGs matching artboard order in JSX.

### T3: PDF adapter

- **Do:** `exporters/pdf.ts` calls PNG adapter internally to get rasters, assembles via `pdf-lib`. One target → 1-page PDF. Multiple → N-page PDF with one artboard per page. Page size = artboard's declared `width`/`height`, scaled to A4 if user opts in (option `pageFit: native | a4 | letter`).
- **Pattern:** Same `pdf-lib`-over-PNG approach as the old Phase 6 plan — works, ships fast, vector-faithful PDF can come later as a separate task if users ask.
- **Validate:** Export 5-artboard canvas → 5-page PDF, opens in Preview, each page legible at native zoom. Smoke: file > 0 bytes, valid PDF magic.

### T4: SVG adapter

- **Do:** `exporters/svg.ts` walks the target subtree, emits SVG with `<foreignObject>` wrapping serialized HTML + inlined `<style>` block. Web fonts pulled via `inline-assets.ts` and embedded as base64 `@font-face` rules inside `<defs>`. Inline `<svg>` elements in the source (icons, draw-layer shapes) are lifted directly — not wrapped in foreignObject.
- **Pattern:** `dom-to-svg`'s foreignObject approach. Document the known caveat (Safari renders foreignObject inconsistently; Illustrator can import but may flatten). Add a `<!-- generated by maude; foreignObject required -->` comment.
- **Validate:** Export single artboard → open SVG in Chrome (must match canvas pixel-for-pixel within 2px). Open in Illustrator (must import without errors, vector text remains editable).

### T5: HTML adapter (standalone)

- **Do:** `exporters/html.ts` walks target HTML, inlines:
  - `<link rel="stylesheet">` → `<style>` with content fetched + minified
  - `@font-face src: url(...)` → base64 data URLs (or `assets/fonts/` if `options.inlineFonts === false`)
  - `<img src>` → base64 or `assets/img/`
  - JS modules → bundled via existing Bun.build pipeline, emitted as `assets/app.js`
  - Ships zip with `index.html` + `assets/` (if not all inlined)
- **Pattern:** Same approach used by static-site bundlers. Don't try to handle every edge case — document the limit ("CSS `@import` chains beyond depth 3 may not inline").
- **Validate:** Export canvas → unzip to a fresh dir → open `index.html` over `file://` → renders identically to canvas view, including fonts.

### T6a: Canvas model walker (shared by PPTX + Canva)

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

### T6b: PPTX adapter

- **Do:** `exporters/pptx.ts` consumes `CanvasModel`, calls `pptxgenjs` to emit one slide per artboard. Maps model → pptxgenjs:
  - `text` → `slide.addText()` with `font_face`, `font_size`, `color`, `bold`, `italic` from FontSpec
  - `shape` (rect/ellipse) → `slide.addShape()` with native PPT geometry
  - `image` → `slide.addImage()` with base64 data
  - `svg` → emit as `slide.addImage()` after Sharp/Playwright PNG rasterization (Canva can't edit SVG nodes anyway)
  - `group` → pptxgenjs grouping (preserves designer's mental model on Canva import)
  - Slide dimensions = artboard `width × height`, with `pptx.layout = { name: 'CANVAS', width, height }` per artboard for non-standard sizes
- **Pattern:** `pptxgenjs` HTML-to-PPT example is the closest reference but we're authoring from our IR, not from DOM directly — gives us control over what becomes editable vs rasterized.
- **Validate:** Export 3-artboard canvas → `.pptx` opens in PowerPoint, Keynote, and Google Slides. Text is editable. Shapes preserve fill/stroke. Reload-roundtrip (open + save in PowerPoint, re-import to maude via no-op) doesn't crash anything.

### T6c: Canva adapter — Connect API path + drag-drop fallback

- **Do:** `exporters/canva.ts` always emits a PPTX (delegates to T6b). Then:
  - **If user has supplied a Canva OAuth token** (stored in `<designRoot>/_canva-auth.json`, never committed — added to `.gitignore` by T7 of phase-1): `canva-connect.ts` POSTs the PPTX to [`/v1/imports`](https://www.canva.dev/docs/connect/api-reference/design-imports/create-design-import-job/), polls the job until `status: success`, returns `{ designId, editUrl }`. UI surfaces a toast "Open in Canva →" linking to `editUrl`.
  - **If no token:** download the PPTX locally + open a small "Drag this file into Canva" instruction toast with a `canva.com/?create=upload` deep link.
  - **OAuth flow:** `GET /api/canva-auth` initiates Canva OAuth (Authorization Code + PKCE per [Canva OAuth docs](https://www.canva.dev/docs/connect/authentication/)), stores refresh token in `_canva-auth.json` (chmod 600). `POST /api/canva-auth/revoke` clears it.
- **Pattern:** Connect API is async — design-import returns a job ID, poll `/v1/imports/{jobId}` every 2 s for up to 60 s. Surface progress in the UI toast.
- **Validate:** **(a) Drag-drop path:** export Canva → `.pptx` downloads → drag into Canva web app → all artboards land as editable pages, text is selectable, brand images swappable. **(b) Connect API path:** with valid token → "Open in Canva" toast appears within 30 s → click opens the resulting Canva design URL → same editability. **(c) No token + Connect API failure:** falls back cleanly to drag-drop with no error spew.

### T6d: PNG+CSV+README legacy bundle (kept as `--canva=raster` opt-in)

- **Do:** The old PNG-dump-plus-CSV-plus-README bundle is retained as a `--canva=raster` opt-in for the case where the user wants a flat reference image set rather than editable PPTX. Default Canva export is editable (T6b+T6c).
- **Validate:** `maude design export canva --canva=raster --out ~/handoff.zip` produces the legacy bundle.

### T7: Project-raw ZIP adapter

- **Do:** `exporters/zip.ts` streams `<designRoot>/` into a zip, excluding by default: `_server.json`, `_active.json`, `_export-history.json`, `_history/`, `node_modules/`, `dist/`, `.DS_Store`, `*.log`. Excludes overridable via `options.exclude: string[]` (gitignore-style glob). Optional `options.include: ['system'|'canvases'|'assets'|'meta']` for filtered exports. Streams (does NOT buffer whole archive in memory — Bun supports streaming responses).
- **Pattern:** Use `archiver` (Node-compat, works under Bun) or roll our own with `bun-zip` if it stays small. Stream the response.
- **Validate:** Export `project-raw` on a 50MB `.design/` → ZIP arrives ≤ memory ceiling 64MB (proves streaming). Unzip → diff against source minus excludes → identical.

### T8: Export dialog UI

- **Do:** `export-dialog.tsx` is a React `<dialog>` with three columns: format picker (list with icons + descriptions), scope picker (filtered by format), per-format options panel. File-list preview at bottom updates live as scope changes. Submit triggers `fetch('/api/export', { method: 'POST', body: ... })` and pipes the response stream to a browser download (`URL.createObjectURL`).
- **Pattern:** Match `dc-zoom-toolbar` / `dc-tool-palette` token styling. Use `aria-modal`, focus trap, `Esc` to close.
- **Validate:** Open dialog with `⌘E`, tab through every control with keyboard, submit, download lands. a11y-auditor pass.

### T9: Toolbar + context menu integration

- **Do:** Add download icon to `tool-palette.tsx` (opens dialog with default scope). Edit `context-menu.tsx` so right-clicking an artboard adds "Export this artboard…" and right-clicking a selection adds "Export selection…" — both open the dialog pre-filtered.
- **Validate:** Right-click on artboard → "Export this artboard…" → dialog opens with `scope = artboard` preselected. Right-click selection → `scope = selection`.

### T10: Recent exports + re-run shortcut

- **Do:** Server appends to `_export-history.json` after each successful export. UI dialog shows last 5 as one-click re-export buttons. `⌘⇧E` re-runs the most recent without opening the dialog.
- **Validate:** Export PNG of artboard A → close dialog → `⌘⇧E` → identical PNG written. History persists across server restarts.

### T11: CLI + slash command surfaces

- **Do:** `cli/commands/design.mjs` adds `export` subcommand parsing `<format>` + `--scope` + `--canvas` + `--element` + `--scale` + `--out`. Calls the same `POST /api/export` endpoint (server already running from `maude design serve`, or spawns transient one). `plugins/design/commands/export.md` defines `/design:export` slash with same flag surface, autodetecting active canvas from `_active.json`.
- **Validate:** `maude design export pdf --scope canvas-as-separate --out ~/out.pdf` produces identical file to the UI-driven path. Slash command from inside Claude Code produces identical file.

### T12: Bun-native dependency audit + DDRs

- **Do:** Confirm `pdf-lib`, `pptxgenjs`, and the chosen zip library all work under Bun (all pure-JS, expected fine). Write:
  - `.ai/decisions/DDR-NNN-svg-foreignobject-tradeoff.md` — foreignObject choice over pure-vector serialization (Safari + Illustrator caveats).
  - `.ai/decisions/DDR-NNN-export-pptx-via-pptxgenjs.md` — model-walker + pptxgenjs picked over `dom-to-pptx` (maturity risk) and over direct Canva element API (image-only, doesn't support shape/text trees).
  - `.ai/decisions/DDR-NNN-export-canva-via-connect-design-imports.md` — Canva path = PPTX + Connect Design-Imports API (when token present) / drag-drop fallback. Supersedes Phase 6's "no native Canva integration" stance; documents Enterprise-tier gate on Connect API and the drag-drop path as the universal fallback. Cites Anthropic's Claude Design (April 2026) as parity target.
- **Validate:** All three DDRs land. Dependency tree adds ≤ **700 KB** (pdf-lib ~80 KB + pptxgenjs ~500 KB + zip lib ~50 KB + react-dialog ~30 KB). Budget revised upward from initial 200 KB ceiling because PPTX-editable Canva handoff is now table stakes — see DDR.

### T13: Documentation — Canva handoff README

- **Do:** Author `plugins/design/docs/canva-handoff.md` covering:
  - The drag-drop path (the universal one): step-by-step screenshots
  - The Connect API path: when to use it, Enterprise tier requirement, OAuth setup, token storage
  - Fidelity caveats: fonts substitute if absent from user's Canva Brand Kit; CSS gradients translate to native PPT gradients; advanced shadows/blend-modes rasterize; flex/grid → absolute coords at export-time viewport
  - The `--canva=raster` legacy bundle and when to prefer it
- **Validate:** Docs site picks up the new MDX (Phase 2 dependency, but a stub commits regardless).

---

## Validation

1. **Static:** `pdf-lib` + `pptxgenjs` + zip lib + react-dialog total ≤ **700KB** bundle delta. `bun:test` covers all seven adapters + canvas-model walker with golden-file fixtures.
2. **Functional:** Every (format × scope) combo that the UI offers produces a non-empty, openable file. The full matrix is 7 formats × up to 4 scopes minus invalid combinations (e.g. SVG × project-raw is hidden in UI; PPTX × selection collapses to PPTX × artboard).
3. **Streaming:** Project-raw ZIP on a 50MB `.design/` stays under 64MB process RSS during export (proves streaming, not buffered).
4. **Cross-platform scenario:** `export-from-toolbar` runs on web-desktop and web-mobile (mobile dialog must reflow to single column).
5. **A11y:** Export dialog passes axe-core; keyboard-only operation completes export end-to-end.
6. **Design system:** Dialog uses project's design tokens — no raw hex values.
7. **Fidelity:** SVG and HTML exports of a reference artboard match the canvas screenshot within 2px (visual diff via existing `screenshot.sh` + ImageMagick `compare`).
8. **Canva editability:** Exported PPTX, imported via drag-drop into Canva, retains: (a) all text strings editable, (b) shape fills/strokes editable, (c) images swappable, (d) layer order preserved, (e) artboard count = slide count = Canva page count. Tested manually against a 3-artboard golden canvas; results recorded in T13 docs.
9. **OAuth security:** `_canva-auth.json` is in `.gitignore`, stored chmod 600, refresh tokens rotated per Canva spec, revoke endpoint clears the file.

## Scenario coverage

| Scenario | Covers user flow | Status |
|---|---|---|
| `export-from-toolbar` | Open canvas → click Export → pick PDF + canvas-as-separate → download → open in Preview → all artboards present | new |
| `export-selection-png` | Select element → `⌘E` → format=PNG, scope=selection (auto) → download → file dims match selection bbox | new |
| `export-project-zip` | Right-click empty canvas → "Export project (ZIP)…" → download → unzip → contents match `.design/` minus excludes | new |
| `export-canva-editable-dragdrop` | Export → Canva (no token) → `.pptx` downloads → drag into Canva web app → all artboards land as editable pages, text editable, shapes editable | new |
| `export-canva-editable-connect` | Export → Canva (with OAuth token) → toast "Open in Canva" within 30 s → click → Canva opens design with same editability | new (skipped if no Enterprise Canva account in CI) |
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
- [ ] Canva Connect API path works end-to-end with OAuth + Design-Imports + edit_url surfacing (manual verification — CI smoke covers OAuth scaffold only, real Enterprise account required for full path).
- [ ] `_canva-auth.json` in `.gitignore`, chmod 600, never logged.
- [ ] DDR for "PPTX via pptxgenjs (model walker, not DOM walker)" landed.
- [ ] DDR for "Canva via Connect Design-Imports API + drag-drop fallback" landed (supersedes Phase 6's "no native integration" stance).
- [ ] DDR for "SVG via foreignObject" landed with the Safari + Illustrator caveats spelled out.
- [ ] `plugins/design/docs/canva-handoff.md` exists with drag-drop walkthrough + Connect API setup.
- [ ] All 8 scenarios pass on web-desktop where applicable; `export-from-toolbar` + `export-selection-png` also pass on web-mobile; `export-canva-editable-connect` may be marked SKIP if no Enterprise Canva test account.
- [ ] Bundle delta ≤ 700KB; streaming verified at 50MB input under 64MB RSS.

---

## Out of scope (explicit non-goals)

- **Vector-faithful PDF** (currently raster-only via PNG → pdf-lib). Track as a follow-up if users ask — would require Playwright `page.pdf()` with print CSS per artboard.
- **Animated GIF / video export.** Phase 5 draw tools and Phase 8 collaboration may motivate it later; not here.
- **Cloud upload targets beyond Canva** (Drive / Dropbox / S3 / Figma sync). Out of scope — stays local file output unless Canva path with OAuth token. Figma sync is its own future phase.
- **Per-artboard PDF metadata** (title, author, keywords). Could be added trivially if requested; not in v1.0 plan.
- **Layered PSD / Sketch / Figma `.fig` output.** Not feasible without proprietary format reverse-engineering.
- **Direct Canva element insertion via Create-Design API.** Researched — Canva's Create-Design endpoint accepts image assets only, not editable element trees. PPTX-via-Design-Imports is the only viable editable path.
- **DOM-driven PPTX** (`dom-to-pptx` and similar). Considered, rejected — single-maintainer, unproven, harder to debug than authoring from our normalized model. Revisit if the dependency matures.
