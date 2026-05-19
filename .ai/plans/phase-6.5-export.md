---
name: phase-6.5-export
status: planned
created: 2026-05-19
extracted-from: phase-6-comments-presentation-export.md
decisions: []
---

# Phase 6.5: Canvas export (UI-first, multi-format, scope-aware)

## Description

A first-class **export feature surfaced from the canvas UI** (not just CLI). One dialog covers six formats × four scopes:

- **Formats:** PNG, PDF, SVG, HTML (standalone runnable), Canva-handoff bundle, project raw ZIP.
- **Scopes:** `selection` (currently selected element), `artboard` (one `DCArtboard`), `canvas-as-separate` (every artboard in the active canvas exported as N files, zipped), `project-raw` (entire `.design/` source tree as a ZIP — *source files, not renders*).

The user opens **Export…** from the toolbar (or `⌘E`), picks format + scope, sees a live preview of the file list, and downloads. Same engine is also reachable through `mdcc design export` CLI and `/design:export` slash command — the UI is the canonical surface, CLI/slash are thin clients of the same `POST /api/export` endpoint.

Extracted from old Phase 6 because export grew into its own substantial feature with non-trivial scope semantics (selection ≠ artboard ≠ canvas ≠ project) and a vector format (SVG) that has different mechanics than the raster pipeline.

## User Story

As a designer handing a multi-artboard mockup to a developer, I want to right-click the canvas, choose **Export → PDF, all artboards as separate pages**, and get one `mockup.pdf` with each artboard on its own page — without screenshotting six times and assembling in another tool. As a contractor, I want **Export → ZIP project raw** so I can hand the client a single archive of every canvas, system, and asset under `.design/` without manually `zip -r`-ing it on the command line.

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

| Format | Engine | Renders or raw? | Multi-target handling |
|---|---|---|---|
| **PNG** | Playwright via existing `bin/screenshot.sh --element` (reuse — no new screenshot path) | Render | One file per target. Multiple → ZIP. |
| **PDF** | `pdf-lib` assembles per-target PNGs as pages (raster path). Vector path deferred — see ADR below. | Render | One multi-page PDF regardless of target count. |
| **SVG** | DOM walk → SVG with `<foreignObject>` for HTML/CSS; user-authored inline `<svg>` lifted directly. Fonts inlined as base64 in `<defs>`. | Render | One file per target. Multiple → ZIP. |
| **HTML** | Walk target's HTML, inline `<link>`/`<style>`/`@font-face`/`<img src>` as base64 or relative paths, emit standalone `index.html` + `assets/`. | Render | Always zipped (multi-file). |
| **Canva** | PNG dump per artboard + `canvas-titles.csv` + `README.md` with manual import steps. | Render + metadata | Always zipped. |
| **ZIP (project-raw)** | Walk `<designRoot>/`, apply excludes (see scope table), stream into archive. | **Raw source** | Single ZIP. |

### C. UI affordances

- **Toolbar button:** Export icon in `tool-palette.tsx` (download glyph, right of the existing tools).
- **Keyboard:** `⌘E` opens dialog, `⌘⇧E` re-runs the last export with same options (no dialog).
- **Context menu:** "Export this artboard…" / "Export selection…" entries in `context-menu.tsx` — pre-fills the dialog scope.
- **Dialog:** format dropdown → scope dropdown (filtered by what makes sense for the format — e.g. SVG hides `project-raw`) → per-format options (PNG scale 1×/2×/3×, PDF page size, HTML "inline fonts y/n") → file-list preview → download button.
- **Toast on completion:** "Saved 6 files → `~/Downloads/mockup-2026-05-19.zip`" with "Reveal in Finder" action (server emits OS-open intent).
- **Recent exports:** Last 5 stored in `<designRoot>/_export-history.json`, surfaced as a "Recent" tab in the dialog for one-click re-export.

### D. CLI + slash parity

```sh
mdcc design export <format> [--scope selection|artboard|canvas-as-separate|project-raw]
                            [--canvas <slug>] [--element <id>]
                            [--scale 1|2|3] [--out <path>]
```

`/design:export <format> [--scope ...]` is a thin slash wrapper that calls the same `POST /api/export` endpoint the UI hits. CLI and slash always write to disk; UI streams to browser download.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium-High (6 format adapters + UI dialog + scope resolver + CLI/slash)
- **Depends on:** Phase 4 (canvas v2 — needs the `DCArtboard` registration and `[data-dc-screen]` markers for element-scoped capture)
- **Parallel with:** Phase 6 (comments + presentation), Phase 5 (draw tools — but draw layer must be capturable, see Task 4)
- **Affected files:**
  - `plugins/design/dev-server/exporters/index.ts` (new — registry)
  - `plugins/design/dev-server/exporters/{png,pdf,svg,html,canva,zip}.ts` (new — six adapters)
  - `plugins/design/dev-server/exporters/scope.ts` (new — scope resolver)
  - `plugins/design/dev-server/exporters/inline-assets.ts` (new — shared base64/font/img inliner used by SVG + HTML)
  - `plugins/design/dev-server/api.ts` (extend — `POST /api/export`, `GET /api/export/recent`)
  - `plugins/design/dev-server/export-dialog.tsx` (new — React dialog mounted by client)
  - `plugins/design/dev-server/tool-palette.tsx` (edit — add export button)
  - `plugins/design/dev-server/context-menu.tsx` (edit — add export entries)
  - `plugins/design/dev-server/client/app.jsx` (edit — mount dialog, wire `⌘E` / `⌘⇧E`)
  - `plugins/design/dev-server/bin/export.sh` (new — CLI helper paralleling `screenshot.sh`)
  - `cli/commands/design.mjs` (edit — `export` subcommand)
  - `plugins/design/commands/export.md` (new — `/design:export` slash command)
  - `plugins/design/dev-server/test/exporters/{scope,png,pdf,svg,html,zip}.test.ts` (new — bun:test)

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
- **Pattern:** `dom-to-svg`'s foreignObject approach. Document the known caveat (Safari renders foreignObject inconsistently; Illustrator can import but may flatten). Add a `<!-- generated by mdcc; foreignObject required -->` comment.
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

### T6: Canva-handoff adapter

- **Do:** `exporters/canva.ts` reuses PNG adapter for full artboard dump, generates `canvas-titles.csv` (slug, title, description from `.meta.json`), and a `README.md` with stepwise manual Canva import instructions (Canva has no public API). All zipped as `<project>.canva-handoff.zip`.
- **Validate:** Open README → follow steps in a fresh Canva project → all artboards land as separate pages with titles preserved.

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

- **Do:** `cli/commands/design.mjs` adds `export` subcommand parsing `<format>` + `--scope` + `--canvas` + `--element` + `--scale` + `--out`. Calls the same `POST /api/export` endpoint (server already running from `mdcc design serve`, or spawns transient one). `plugins/design/commands/export.md` defines `/design:export` slash with same flag surface, autodetecting active canvas from `_active.json`.
- **Validate:** `mdcc design export pdf --scope canvas-as-separate --out ~/out.pdf` produces identical file to the UI-driven path. Slash command from inside Claude Code produces identical file.

### T12: Bun-native dependency audit + DDR

- **Do:** Confirm `pdf-lib` and the chosen zip library work under Bun (both ship as pure-JS, expected fine). Write `.ai/decisions/DDR-NNN-canva-no-public-api.md` documenting why Canva integration is handoff-archive-only (Phase 6 already noted this — formalize as DDR now that it's a v1.0 commitment). Write `.ai/decisions/DDR-NNN-svg-foreignobject-tradeoff.md` documenting the foreignObject choice over pure-vector serialization.
- **Validate:** Both DDRs land. Dependency tree adds ≤ 200KB.

---

## Validation

1. **Static:** `pdf-lib` + zip lib + react-dialog total ≤ 200KB bundle delta. `bun:test` covers all six adapters with golden-file fixtures.
2. **Functional:** Every (format × scope) combo that the UI offers produces a non-empty, openable file. The full matrix is 6 formats × up to 4 scopes minus invalid combinations (e.g. SVG × project-raw is hidden in UI).
3. **Streaming:** Project-raw ZIP on a 50MB `.design/` stays under 64MB process RSS during export (proves streaming, not buffered).
4. **Cross-platform scenario:** `export-from-toolbar` runs on web-desktop and web-mobile (mobile dialog must reflow to single column).
5. **A11y:** Export dialog passes axe-core; keyboard-only operation completes export end-to-end.
6. **Design system:** Dialog uses project's design tokens — no raw hex values.
7. **Fidelity:** SVG and HTML exports of a reference artboard match the canvas screenshot within 2px (visual diff via existing `screenshot.sh` + ImageMagick `compare`).

## Scenario coverage

| Scenario | Covers user flow | Status |
|---|---|---|
| `export-from-toolbar` | Open canvas → click Export → pick PDF + canvas-as-separate → download → open in Preview → all artboards present | new |
| `export-selection-png` | Select element → `⌘E` → format=PNG, scope=selection (auto) → download → file dims match selection bbox | new |
| `export-project-zip` | Right-click empty canvas → "Export project (ZIP)…" → download → unzip → contents match `.design/` minus excludes | new |
| `export-cli-parity` | `mdcc design export svg --scope artboard --element abc` produces identical bytes to UI-driven export with same args | new |
| `export-recent-rerun` | Export PNG → `⌘⇧E` → identical PNG written without dialog | new |

---

## Acceptance criteria

- [ ] All 6 format adapters produce valid, openable output across all valid scopes.
- [ ] Export dialog reachable from toolbar, context menu, and `⌘E`; passes a11y.
- [ ] Project-raw ZIP excludes runtime files by default; respects `--exclude` overrides.
- [ ] CLI `mdcc design export` and `/design:export` produce byte-identical output to the UI for matching args.
- [ ] Recent-exports list works and `⌘⇧E` re-runs the latest.
- [ ] DDR for "Canva = no-public-api / handoff bundle only" landed.
- [ ] DDR for "SVG via foreignObject" landed with the Safari + Illustrator caveats spelled out.
- [ ] All 5 scenarios pass on web-desktop; `export-from-toolbar` + `export-selection-png` also pass on web-mobile.
- [ ] Bundle delta ≤ 200KB; streaming verified at 50MB input under 64MB RSS.

---

## Out of scope (explicit non-goals)

- **Vector-faithful PDF** (currently raster-only via PNG → pdf-lib). Track as a follow-up if users ask — would require Playwright `page.pdf()` with print CSS per artboard.
- **Animated GIF / video export.** Phase 5 draw tools and Phase 8 collaboration may motivate it later; not here.
- **Cloud upload targets** (Drive / Dropbox / S3 / Figma sync). Out of scope — stays local file output. Figma sync is its own future phase.
- **Per-artboard PDF metadata** (title, author, keywords). Could be added trivially if requested; not in v1.0 plan.
- **Layered PSD / Sketch / Figma `.fig` output.** Not feasible without proprietary format reverse-engineering.
