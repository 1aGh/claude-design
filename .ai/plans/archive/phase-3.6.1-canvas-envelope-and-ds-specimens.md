# Phase 3.6.1 — Canvas envelope hygiene + reusable canvas-lib + HMR + DS specimens as TSX

> **Position.** Direct follow-up to Phase 3.6 (canvas TSX format). Closes four gaps surfaced when the user opened the migrated canvases in the dev-server: (1) the codemod produced `.tsx` files that build cleanly but **white-page at runtime** because the frame primitives (`DesignCanvas`, `DCSection`, `DCArtboard`) were never defined in TSX-land, (2) frame primitives were planned as inline-per-canvas (handoff-friendly but ~50× duplication when DS specimens also flip), (3) HMR was never wired in Phase 3.6 — every canvas edit requires a manual iframe reload, (4) the design-system preview specimens were left as static `.html`, breaking the "plug-and-play" expectation — inspector select + `/design:edit` should iterate on a specimen the same way they iterate on a UI canvas.
>
> **Why this isn't just a 3.6 patch.** It introduces a new contract (canvas-lib import resolved via virtual module + handoff inlining; HMR over Bun's `import.meta.hot`; `/design:setup-ds` scaffolds TSX specimens), extends the codemod beyond `ui/`, and ripples through `setup-ds.md`, `design-system/SKILL.md`, and the design-system-keeper agent. Multi-file + new pattern + new runtime channel + cross-skill = own phase.

## Description

Make every TSX canvas — UI mock OR DS specimen — a fully self-contained, browser-loadable canvas backed by a small **shared canvas-lib** (`@mdcc/canvas-lib`, virtual-module-resolved at the dev-server level → `<designRoot>/_lib/canvas-lib.tsx`), so:

- The dev-server's `_canvas-shell.html` harness mounts ANY `.tsx` file under `<designRoot>/` and renders it inside its artboard chrome via primitives imported from `@mdcc/canvas-lib` — one source of truth, no per-file duplication.
- The canvas-lib also ships **opt-in helpers** authors commonly reach for: `<DCPostIt>`, `<TokenChip>`, `<ColorSwatch>`, `<SpecimenHeader>`, `<SpecimenMeta>`, `<KbdHint>`, `useTokens()`, `useTheme()`, `useArtboardBounds()` — "imagine but don't reinvent" surface for canvases + specimens.
- **HMR is wired**. Editing a canvas TSX (or its sibling `.css`, or `_lib/canvas-lib.tsx`) reloads the iframe in < 200 ms via Bun's `import.meta.hot` + React Fast Refresh + fs-watch (`fs-watch.ts` already streams change events; we connect them to a WS broadcast).
- `Cmd+Click` over the inspector overlay produces a `data-cd-id` + `_active.json.selected.v=2` for elements in DS specimens, exactly like UI canvases.
- `/design:edit "make the stamp border thinner"` works against `system/project/preview/colors-accent.tsx` the same way it works against `ui/Docs Site.tsx`.
- `/design:setup-ds` (and the DS bootstrap flow) scaffold new specimens as `.tsx` from a shared template that imports from `@mdcc/canvas-lib`.
- `/design:handoff` **inlines** every used export from `@mdcc/canvas-lib` into the emitted registry-item.json — the consumer ships a single self-contained `.tsx` (the import line is rewritten away, the relevant function bodies appear inline). Tree-shaken via `Bun.Transpiler.scanImports()` + the canvas-lib's named-export list — only the helpers actually used in the canvas land in the registry-item.

**Out of scope:**
- New UX features in the inspector overlay (Phase 12).
- Yjs CRDT integration (Phase 10).
- Performance budget validation beyond the HMR < 200 ms gate (other 3.6 budgets — cold load, transform — carry forward).
- Rewriting `_components.css` rules to match a new specimen layout — specimens that already lift `.btn / .stamp / .sku / .crumbs` from `_components.css` stay verbatim; the migration is HTML→TSX only.
- Publishing the canvas-lib as a separate npm package. It lives **inside the design root** (`<designRoot>/_lib/`) as project-owned source, not as a versioned external dep. Downstream projects that want it copy it via `/design:handoff` (which inlines used exports per-canvas) or by hand.

## User Story

As Claude opening `colors-accent` in the dev-server, I want to Cmd+Click the brand-spotlight stamp and run `/design:edit "tighten the stamp inset"` so the specimen's TSX gets an AST-aware byte-range edit on the `.stamp` `style={{ inset: 6 }}` value — **same flow as editing a UI canvas**, without the orchestrator having to special-case "this is HTML so fall through to full-file rewrite."

## Problem

| Symptom | Current cause | Impact |
| --- | --- | --- |
| `Docs Site.tsx` + `Canvas Viewport.tsx` render as a white page despite `bun test` + `buildCanvasModule()` passing | Codemod copied JSX verbatim including `<DesignCanvas>` / `<DCSection>` / `<DCArtboard>` references, but these identifiers are undefined in TSX-land. Original HTML canvases got them as window globals from a babel-runtime injection. | Phase 3.6's headline feature (`.tsx` canvases) doesn't actually work end-to-end on the existing repo. The codemod ran successfully but produced non-functional output. |
| `Smoke TSX.tsx` renders but doesn't look like a canvas | The file was a runtime-mount smoke test from the Phase 3.6 foundation slice — bare `<div>`, no `<DesignCanvas>`/`<DCArtboard>`. Never updated when the envelope contract solidified. | First impression of a "canvas opened in the dev-server" is a context-less `<button>` floating on the iframe background. User question (justified) was "wait, this isn't a canvas?" |
| DS specimens stay `.html` after Phase 3.6 | Plan Task 9 explicitly skipped them ("preview specimens STAY as `.html`"). Reasoning was "they don't iterate; React runtime overhead unjustified." | Specimens can't be edited via `/design:edit`. Inspector select doesn't work on them. Plug-and-play with UI canvases is broken. |
| `/design:setup-ds` writes new specimens as `.html` | Bootstrap flow + frontend-design specimen scaffolding default to `.html`. | Newly-bootstrapped DSs ship in the legacy format, requiring a follow-up migration. |
| **No HMR** — every canvas edit requires a manual iframe reload | Phase 3.6's runtime slice deferred HMR ("`_canvas-shell.html` doesn't yet bust the canvas-module browser cache when its source changes"). The fs-watch service writes change events but no listener forwards them to the iframe. | Iteration loop is 3–5× slower than it needs to be. Tight inner-loop edits (color tweak, padding nudge) feel sluggish; `/design:edit` is partially gated on this. |
| Canvas frame primitives would duplicate in every TSX | The original 3.6 plan + early-3.6.1 draft inlined `DesignCanvas`/`DCSection`/`DCArtboard` per canvas. With ~12 UI canvases + ~40 specimens = ~50 copies; any change to the primitives means a sweep over 50 files. | **Phase 3.6.1 changes course** — primitives live in `<designRoot>/_lib/canvas-lib.tsx`; canvases import them. Handoff inlines on emit so the registry-item.json stays self-contained. Single edit point + still handoff-friendly. |
| No reusable surface for common canvas patterns | Every canvas re-implements specimen headers, token chips, color swatches, kbd hints, theme toggles. ~3000 LOC of duplication across `Docs Site.html` + `Canvas Viewport.html` + the 40 specimens. | Author friction; visual drift between specimens that should agree. The canvas-lib gives "lift existing pattern" a working surface. |

## Solution

Five-piece refactor. Order matters — A unblocks B, then everything else parallelises.

**A. Ship `<designRoot>/_lib/canvas-lib.tsx` — the shared canvas library.** Project-owned source (lives next to canvases under the design root, not as an npm dep). Default exports cover the frame envelope (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`) plus opt-in helpers (`TokenChip`, `ColorSwatch`, `SpecimenHeader`, `SpecimenMeta`, `KbdHint`, `useTokens`, `useTheme`, `useArtboardBounds`). The file is a regular `.tsx` — no special shape, no decorators. The Phase 3.6 pipeline transpiles it like any other canvas; the same `data-cd-id` injection runs (so the lib's own primitives are inspectable when you Cmd+Click into them, which is fine — chrome elements get IDs too).

**B. Resolve `@mdcc/canvas-lib` virtually in `canvas-build.ts`.** Canvases (and specimens, after Task D) `import { DesignCanvas, ColorSwatch } from "@mdcc/canvas-lib"`. The Bun.build plugin in `canvas-build.ts` adds a resolver: `@mdcc/canvas-lib` → `<designRoot>/_lib/canvas-lib.tsx`. Externals list stays the same (React + ReactDOM + jsx-runtime). The browser-loaded canvas module includes the bundled lib code; no extra runtime fetch.

**C. Wire HMR via Bun's `import.meta.hot` + WebSocket fanout.** The dev-server already has `fs-watch.ts` streaming change events and `ws.ts` running a WebSocket for inspector messages. Plug them together: on `change` events touching `<designRoot>/**/*.{tsx,css}` OR `<designRoot>/_lib/**`, broadcast `{type: "canvas-hmr", canvas: <slug>}` on the existing WS. Each iframe loaded from `_canvas-shell.html` runs a small client (added inline in the shell) that listens, filters by canvas slug, and either does a Bun-Vite-style `import.meta.hot.accept(...)` self-reload OR a hard iframe reload when the change touches `_lib/`. Target latency: **< 200 ms p50** click-to-paint. CSS-only changes use `<link>` `?v=<etag>` cache-bust without a full module reload.

**D. Codemod overhaul — rewrite imports + handle DS specimens.** Two codemod modes:
1. **`--target canvases` (default, replaces Phase 3.6 Task 8 behaviour):** Re-run on the UI canvases that have already migrated. Rewrite the dangling `<DesignCanvas>` JSX references → import them from `@mdcc/canvas-lib` (prepend the import; the canvases already use those JSX identifiers as if they were in scope). Drop the inline primitive definitions if any (none currently — they were never added). Re-emit JSDoc header.
2. **`--target specimens` (new):** Walk `.design/system/<ds>/preview/*.html`. For each:
   - Parse `<body>` via the new `html-to-jsx.ts` (regex-driven; `class=` → `className=`, self-closing voids, style-attr → object, comments → `{/* */}`, boolean-attr → `={true}`, etc.).
   - Wrap converted body in `<DesignCanvas><DCSection><DCArtboard width={0} height={0} label={...}>...</DCArtboard></DCSection></DesignCanvas>`.
   - Hoist `<style>` blocks → sibling `<Slug>.css` + side-effect import.
   - Drop `<link rel="stylesheet">` (loaded by `_canvas-shell.html` query).
   - Write `<Slug>.tsx` + `<Slug>.meta.json` (synthesised from `<title>` + SPECIMEN comment + parent-folder DS name).
   - Archive original under `_history/_migration-2026-05-15/system/<ds>/preview/`.

   `--force` flag overwrites existing `.tsx` (needed for re-runs).

**E. Update `/design:setup-ds` to scaffold TSX specimens importing from canvas-lib.** Roster format flips extension. Templates reference canvas-lib. The DS bootstrap also writes `_lib/canvas-lib.tsx` if it's not already present in the design root — first-bootstrap of a project gets the lib for free.

**F. `/design:handoff` inlines used canvas-lib exports.** Extend `handoff.ts`:
1. After `scanImports()` classifies imports, treat `@mdcc/canvas-lib` as a **special-case dep** (don't ship as npm dep, don't ship as registry dep).
2. Parse `<designRoot>/_lib/canvas-lib.tsx`, build a `Map<exportName, sourceText>` keyed by named export.
3. From the canvas TSX, scan its `import { ... } from "@mdcc/canvas-lib"` line, collect the named imports.
4. Resolve each named import + its transitive lib-internal references (helper functions the export calls) via AST walk.
5. Strip the import line; append the resolved function bodies at the file's tail, before `export default`.
6. The emitted `files[0].content` is now self-contained — no `@mdcc/canvas-lib` dep, no manual user step.

## Metadata

- **GitHub Issue**: (none — internal hardening)
- **Type**: Refactor (high impact — touches every TSX canvas + every DS specimen)
- **Complexity**: Medium-high
- **App/Package**: `plugins/design` (codemod + commands + skills + templates)
- **Affected Systems**:
  - `<designRoot>/_lib/canvas-lib.tsx` — **NEW** — shared canvas library (primitives + helpers); ~250 LOC
  - `plugins/design/dev-server/canvas-build.ts` — virtual-module resolver for `@mdcc/canvas-lib`
  - `plugins/design/dev-server/handoff.ts` — lib-inlining on emit (Task F above)
  - `plugins/design/dev-server/fs-watch.ts` + `plugins/design/dev-server/ws.ts` — HMR broadcast on `<designRoot>/**/*.{tsx,css}` change
  - `plugins/design/templates/_shell.html` — HMR client injection (small inline script listens to WS, decides reload strategy)
  - `scripts/migrate-canvases.ts` — `--target {canvases|specimens}` + `--force`
  - `plugins/design/templates/canvas.tsx.template` — uses `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib"` instead of inline primitives
  - `plugins/design/templates/ds-specimen.tsx.template` — **NEW** — simpler envelope for specimens, imports from canvas-lib
  - `plugins/design/templates/canvas-lib.tsx.template` — **NEW** — scaffolded into `<designRoot>/_lib/` on first bootstrap (one-shot, idempotent)
  - `plugins/design/skills/design-system/SKILL.md` — Round 3 scaffold flow flips to TSX + bootstraps canvas-lib
  - `plugins/design/agents/design-system-completeness-critic.md` — reads `.tsx` instead of `.html` for specimens
  - `plugins/design/agents/design-system-keeper.md` — same
  - `plugins/design/dev-server/api.ts` — `findFiles()` DS-group extensions list (already accepts `.tsx` after Phase 3.6.1 pre-flight fix; verify)
  - `.design/system/project/preview/*.html` (~40 files) — migrated to `.tsx` by codemod
  - `.design/ui/{Docs Site,Canvas Viewport,Smoke TSX}.tsx` — rewritten to import from canvas-lib
- **Dependencies**:
  - None new — re-uses the Phase 3.6 toolchain (`oxc-parser` + `magic-string` + `Bun.Transpiler` + `Bun.build`).
  - HTML→JSX rewriting for specimens uses a small in-house module — no `cheerio` added (in-house regex is sufficient for the static-HTML shape specimens actually use).
  - HMR uses Bun's native WebSocket + `import.meta.hot` (Bun 1.3+, already pinned).
- **Blocks**: Phase 12 (in-canvas CSS editor — needs every canvas to support inspector edits, including specimens).
- **Does NOT block**: Phase 4 (Pixi), Phase 10 (Yjs).

## Performance budgets (acceptance gates)

| Metric | Target | Notes |
| --- | --- | --- |
| Per-canvas TSX file size after lib-import refactor | **< 50 KB** raw typical UI canvas, **< 20 KB** typical specimen | Canvases SHRINK vs pre-3.6.1 because primitives moved out of inline duplication. |
| Canvas-lib bundled size (post `Bun.build` tree-shake into a canvas) | **< 8 KB gz** per canvas (typical: 4 used helpers + frame envelope) | Reference: full lib ~25 KB raw / ~7 KB gz. Tree-shake drops what the canvas doesn't import. |
| HMR latency click-to-paint on a single-element edit | **< 200 ms p50, < 400 ms p99** | Wall-clock from `Bun.write()` finishing to React rerender (measured via `performance.mark` in the iframe + server-side `fs-watch` timestamp). |
| `Docs Site.tsx` + `Canvas Viewport.tsx` + `Smoke TSX.tsx` render without console errors | **0 console errors** | White-page repro fixed. |
| Inspector Cmd+Click on a specimen surfaces `data-cd-id` + `selected.v=2` | **Yes** | Verified manually on `colors-accent.tsx`. |
| `/design:edit "tighter inset"` on a specimen lands a single-attribute edit | **Yes** | AST fast-path through `canvas-edit.ts` — same as for UI canvases. |
| `/design:handoff` emits self-contained registry-item with canvas-lib helpers inlined | **Yes** | Grep result: zero `@mdcc/canvas-lib` import strings remain in `files[0].content`. |
| All Phase 3.6 tests still green | **95 → ≥ 110 pass** | New tests cover canvas-lib emission, virtual-module resolution, HMR client, specimen migration, handoff inlining. |

## Context References

### Must-read files

- `plugins/design/templates/canvas.tsx.template` (existing) — the frame envelope source. Lines 46–101 are the four primitive functions. **The codemod will copy these verbatim** into every migrated canvas.
- `.design/ui/Docs Site.tsx` (post-3.6) — concrete white-page repro target. Grep shows `<DesignCanvas>` / `<DCSection>` / `<DCArtboard>` referenced but no inline definitions. Re-run of codemod with primitive-injection fixes it.
- `scripts/migrate-canvases.ts` — the codemod to extend. Lines ~120–180 are `transformBabelBody` + `assembleTsx` — primitive injection lives in `assembleTsx`.
- `plugins/design/skills/design-system/SKILL.md` (~600 LOC) — the bootstrap + scaffold flow. Sections "Round 3 / scaffold-time" lines 280–420 are the per-specimen writer. **Read carefully** — the roster mutation rule (lines 258–267) is load-bearing and must survive the extension flip.
- `plugins/design/agents/design-system-completeness-critic.md` — specimen-existence check reads `.html` paths; needs `.tsx` awareness.
- `plugins/design/agents/design-system-keeper.md` — scaffold-time auditor; reads existing specimens to learn class roots. Already accepts both extensions per Phase 3.6.1 pre-flight tree fix; verify.
- `plugins/design/dev-server/canvas-pipeline.ts` — read-only. No changes; verifies that the regenerated canvases parse cleanly.
- `plugins/design/dev-server/canvas-build.ts` — read-only. Confirm the post-primitive-injection source still goes through Bun.build cleanly.
- One reference specimen: `.design/system/project/preview/colors-accent.html` (~200 LOC) — use as the codemod's HTML-to-JSX fixture. After migration, must render at `_canvas-shell.html?canvas=system%2Fproject%2Fpreview%2Fcolors-accent.tsx`.

### Files to create

- `plugins/design/templates/canvas-lib.tsx.template` (new — ~250 LOC) — **canonical source of the canvas library**. Scaffolded into `<designRoot>/_lib/canvas-lib.tsx` on first DS bootstrap. Exports:
  - **Frame envelope**: `DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`.
  - **Specimen helpers**: `SpecimenHeader` (matches current `.specimen-hd` shape), `SpecimenMeta` (the `<dl class="specimen-meta">` ladder), `KbdHint` (the `<kbd>` chrome), `TokenChip` (visualises a `var(--...)` value inline), `ColorSwatch` (square+label for color tokens), `TypeScaleRow` (single row of the type ladder), `ThemeToggle` (light/dark button group, writes `data-theme` on `<html>`).
  - **Hooks**: `useTokens(prefix?)` (returns resolved CSS var values), `useTheme()` (returns + sets current theme), `useArtboardBounds()` (the ResizeObserver wrapper for the active artboard).
- `plugins/design/templates/ds-specimen.tsx.template` (new — ~50 LOC) — simpler envelope than `canvas.tsx.template`. Single `<DCArtboard width={0} height={0}>` (flowing layout), imports `DesignCanvas`/`DCSection`/`DCArtboard`/`SpecimenHeader` from `@mdcc/canvas-lib`. JSDoc header projection from synthesised meta.
- `plugins/design/dev-server/canvas-lib-resolver.ts` (new — ~80 LOC) — Bun.build plugin factory + a parallel runtime resolver used by the pipeline tests. Exports `canvasLibResolver(designRoot: string): BunPlugin` — adds an `onResolve` for `@mdcc/canvas-lib` → `<designRoot>/_lib/canvas-lib.tsx`. Also exports `readCanvasLibSource(designRoot: string): Promise<string>` used by `handoff.ts` for inlining.
- `plugins/design/dev-server/canvas-lib-inline.ts` (new — ~150 LOC) — handoff helper. Parses `<designRoot>/_lib/canvas-lib.tsx` once, builds an `export-name → { source, deps[] }` map (deps = other named exports referenced within), and exposes `inlineUsedExports(canvasSource: string, libMap): { content, droppedImport: boolean }`. Pure; tested.
- `plugins/design/dev-server/hmr-broadcast.ts` (new — ~100 LOC) — hooks `fs-watch` to the WS. Debounces (50 ms) so a multi-file write batches into one message. Computes slug from path + decides "soft" (`.tsx` of a canvas) vs "hard" (`_lib/*` — every iframe reloads) vs "css" (cache-bust the `<link>` `?v=` query).
- `plugins/design/dev-server/html-to-jsx.ts` (new — ~150 LOC) — codemod helper. Exports `htmlToJsx(bodySource: string): string` — regex-driven rewrite. Documented as "v1 — handles the static-HTML shape specimens use; non-goal: arbitrary HTML."
- `plugins/design/dev-server/test/canvas-lib-resolver.test.ts` (new — ~6 cases) — onResolve hooks, missing-lib-file error path, designRoot-relative resolution.
- `plugins/design/dev-server/test/canvas-lib-inline.test.ts` (new — ~10 cases) — single-export inline, transitive deps, no-ops when no `@mdcc/canvas-lib` import, helper-internal recursion (`ColorSwatch` uses `TokenChip` → both inline when only `ColorSwatch` imported).
- `plugins/design/dev-server/test/hmr-broadcast.test.ts` (new — ~6 cases) — debouncing, slug derivation, soft-vs-hard decision boundary, CSS-only branch.
- `plugins/design/dev-server/test/html-to-jsx.test.ts` (new — ~12 fixture cases) — covers the rewrite rules.
- `plugins/design/dev-server/test/migrate-specimens.test.ts` (new — ~6 cases) — codemod against a fixture DS.

### Files to update

- `plugins/design/dev-server/canvas-build.ts` — pull in `canvasLibResolver(designRoot)` plugin alongside `exact-externals`. Fail loud if `<designRoot>/_lib/canvas-lib.tsx` is missing and any canvas imports `@mdcc/canvas-lib` (point user at `/design:setup-ds` to scaffold).
- `plugins/design/dev-server/handoff.ts` — call `inlineUsedExports()` after `stripDataCdId()`; remove `@mdcc/canvas-lib` from the dep-classification output (neither dep nor registry dep).
- `plugins/design/dev-server/ws.ts` — wire the HMR broadcaster onto the existing WS server; new outbound message type `canvas-hmr`.
- `plugins/design/dev-server/fs-watch.ts` — verify it already emits change events for `<designRoot>/_lib/`; extend the include glob if not.
- `plugins/design/templates/_shell.html` — inline a small `<script>` that opens a WS to `/_ws`, listens for `canvas-hmr`, and either calls `import.meta.hot.accept(...)` on the canvas module OR does `location.reload()` (for hard reloads or when `import.meta.hot` is unavailable).
- `plugins/design/templates/canvas.tsx.template` — replace the inline `function DesignCanvas() {...}` block with `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib"` (envelope-only by default; helpers added per-canvas as authors reach for them).
- `scripts/migrate-canvases.ts` — `--target {canvases|specimens}` + `--force`. Canvas mode: inject the canvas-lib import, drop any orphan inline primitives. Specimen mode: full HTML→TSX flow per Solution D.
- `plugins/design/skills/design-system/SKILL.md` — Round 0 (bootstrap) scaffolds `_lib/canvas-lib.tsx` from `canvas-lib.tsx.template` if missing. Round 3 specimen scaffold flips to `.tsx`. Roster format updates. Claim-scan substring list stays the same.
- `plugins/design/agents/design-system-completeness-critic.md` — specimen-existence check reads `.tsx`.
- `plugins/design/agents/design-system-keeper.md` — same.
- `.design/ui/Smoke TSX.tsx` — hand-rewritten: imports `{ DesignCanvas, DCSection, DCArtboard }` from `@mdcc/canvas-lib`, wraps the counter button in the envelope.
- `plugins/design/commands/setup-ds.md` — language flip (specimens are `.tsx` not `.html`); mention canvas-lib bootstrap.
- `plugins/design/commands/edit.md` — Step 1.5 already auto-loads `_components.css` for `inline` canvases; **add** `_lib/canvas-lib.tsx` to the read set for ALL TSX canvases (it's the authoring vocabulary).
- `plugins/design/dev-server/canvas-meta.schema.json` — sanity-verify (no schema change needed).

### Files to NOT change

- `plugins/design/dev-server/canvas-pipeline.ts` / `canvas-edit.ts` — already extension-agnostic. Pipeline pass-1 (data-cd-id) runs on canvas-lib too — its own primitives get IDs, fine.
- `plugins/design/dev-server/inspect.ts` — overlay reads `data-cd-id` regardless. Specimens free.
- `plugins/design/dev-server/runtime-bundle.ts` — React 19 + ReactDOM universal. No change.
- Logo/glyph assets under `system/<ds>/assets/`. Leave alone.
- `system/project/colors_and_type.css` + `_layout.css` + `_components.css` — DS CSS files; loaded by `_canvas-shell.html` query.

### Patterns to follow

The primitive injection in the codemod looks like:

```ts
// scripts/migrate-canvases.ts (sketch, additions only)
const FRAME_PRIMITIVES = `
// ─────────────────────────────────────────────────────────────────────────────
// Canvas-frame primitives — local copies of the design plugin's DesignCanvas
// API. Inlined per Phase 3.6 envelope-hygiene rule so the canvas renders
// without runtime ambient deps (window globals or shared imports).

function DesignCanvas({ children }: { children: React.ReactNode }) {
  return <div className="dc-canvas">{children}</div>;
}
function DCSection({ id, title, subtitle, children }) { /* ... */ }
function DCArtboard({ id, label, width, height, children }) { /* ... */ }
function DCPostIt({ children }) { return <aside className="dc-postit">{children}</aside>; }
`;

function assembleTsx(args): string {
  // ... existing prep ...
  return `${args.header}

${reactImport}${cssImport}

${args.body.trim()}

${FRAME_PRIMITIVES}

export default ${args.componentName};
`;
}
```

For the HTML→JSX rewrite (specimens), the pattern is conservative regex chains; no DOM parser. The specimens' HTML follows a tight house style — every attribute is double-quoted, no exotic SVG, no embedded scripts. If a regex fails, the codemod skips the file with a clear reason. Manual fix-up budget: ~2 hours for the long tail (signature specimens like `colors-accent.html` with elaborate `::before`/`::after` chrome).

## Design Decisions

### Primitive ownership — **inline per canvas, source of truth in template**

| Decision | Rationale |
| --- | --- |
| Each canvas keeps its own copies of `DesignCanvas`/`DCSection`/`DCArtboard` | Handoff-friendly. `/design:handoff` ships one `.tsx` file via shadcn registry-item; ambient deps would break the drop. Phase 3.6 chose this shape; 3.6.1 doubles down. |
| `canvas.tsx.template` is the source; codemod copies verbatim | One file to change when the primitive API evolves; codemod re-runs propagate. |
| No shared `import { DesignCanvas } from "@/design-runtime"` | Would re-introduce the ambient-runtime problem. The plan's "Solution" section calls this out explicitly. |

### Specimen artboard shape — **single full-width auto-height artboard**

Specimens are flowing reference pages, not 1440×900 viewport mocks. The artboard wrapper renders `width: 100%; height: auto` when `width === 0` / `height === 0` (treat 0 as the auto sentinel — explicit, no truthy-default gotcha). The artboard chrome's `<header className="dc-artboard-label sku">` still renders a `SKU` strip at the top of the specimen (matches the current `<header class="specimen-hd">` shape one-for-one).

### HTML→JSX rewrite scope — **static specimens only, regex-driven**

Out-of-scope: arbitrary HTML, embedded scripts, SVG with complex attribute namespaces. In-scope: the specimens that actually exist under `.design/system/*/preview/*.html`. Tested via fixture cases in `html-to-jsx.test.ts`; non-coverage cases skip with a clear reason and migrate by hand. Trying to handle every conceivable HTML shape is scope-creep that doesn't serve the user. Adding `cheerio` would be a new dep without commensurate benefit.

### Codemod re-run safety — **`--force` flag required**

The original codemod (Phase 3.6 Task 8) refused to overwrite existing `.tsx` files. Phase 3.6.1 adds `--force` to opt into re-overwrite, because the UI canvases have already migrated and need primitives injected. Without `--force` the canvases get a SKIP; with `--force` they get overwritten + the original (still-archived) `.html` stays in `_history/_migration-2026-05-15/`.

---

## Tasks

Execute in order — Tasks 1 + 2 unblock the rest; from Task 3 onward parallelisable in pairs.

### Task 1 — CREATE `canvas-lib.tsx.template` + scaffold `<designRoot>/_lib/canvas-lib.tsx`

- **Do**: Write `plugins/design/templates/canvas-lib.tsx.template` with the full named-export surface listed in "Files to create" (envelope + helpers + hooks). Bootstrap this file once into `.design/_lib/canvas-lib.tsx` (manual write for this repo; for fresh projects Task 7 handles it via the DS bootstrap flow). Each export gets its own one-line JSDoc; the file's leading comment block enumerates every export so cold-readers see the surface at a glance. Hooks (`useTokens`, `useTheme`, `useArtboardBounds`) use only React 19 + `window` APIs — no extra deps. `DCArtboard` honours the `width=0|height=0` auto-flow sentinel from the start (specimens need it).
- **Pattern**: Same shape as `canvas.tsx.template`'s current inline primitives, just expanded with helpers + hooks. Source idioms lift from existing HTML specimens (`<dl class="specimen-meta">` becomes `<SpecimenMeta>`; `.sku` chip becomes `KbdHint` reuse with variant prop).
- **Gotcha**: The lib's own JSX gets `data-cd-id`-injected by `canvas-pipeline.ts` pass-1 — that's fine, but the IDs change every time the lib changes. Tests that pin lib-internal IDs will break; don't write any.
- **Validate**: `bun test plugins/design/dev-server/test/canvas-pipeline.test.ts` still green when fed the lib. `bun --cwd plugins/design/dev-server run tsc --noEmit` clean for the new file.

### Task 2 — CREATE `canvas-lib-resolver.ts` + wire into `canvas-build.ts`

- **Do**: Implement the Bun.build plugin (`@mdcc/canvas-lib` onResolve → `<designRoot>/_lib/canvas-lib.tsx`). Export `readCanvasLibSource(designRoot)` for handoff. Update `buildCanvasModule(canvasAbsPath, source)` to take `designRoot` (or derive it from the path) and add `canvasLibResolver(designRoot)` to the plugin list. Fail loud + early when a canvas imports `@mdcc/canvas-lib` and the lib file is missing — wrap `Bun.build`'s error with a help line ("Run `/design:setup-ds` to scaffold the canvas library").
- **Pattern**: Mirrors `exact-externals` plugin already in `canvas-build.ts`. Single `onResolve` hook.
- **Gotcha**: `Bun.build` resolves onResolve hooks in registration order; the canvas-lib resolver must run **before** any other resolver that might claim `@mdcc/*`. Put it first.
- **Validate**: `bun test plugins/design/dev-server/test/canvas-lib-resolver.test.ts` green (6 cases). End-to-end: feed a fixture canvas that imports `{ DesignCanvas } from "@mdcc/canvas-lib"` to `buildCanvasModule()`; the output JS contains the resolved `DesignCanvas` source bundled in.

### Task 3 — REWRITE `Smoke TSX.tsx` to use canvas-lib

- **Do**: Hand-rewrite `.design/ui/Smoke TSX.tsx` to `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib"` + wrap the counter button in the envelope. Single section, single 720×320 artboard. Create `Smoke TSX.meta.json` (`title`, `subtitle: "TSX runtime smoke — single artboard, useState round-trip"`, single section, `css_mode: "inline"`, `designSystem: "project"`, `data_cd_id_version: 1`).
- **Validate**: Open Smoke TSX in dev-server (after Task 2 lands). Counter works. Artboard chrome renders. Cmd+Click → `_active.json.selected.v === 2`.

### Task 4 — CREATE `html-to-jsx.ts` + tests

- **Do**: Implement `htmlToJsx(body: string): string`. Rules (regex-driven):
  1. `class="..."` → `className="..."`; `for="..."` → `htmlFor="..."`.
  2. Void elements (`br`, `hr`, `img`, `input`, `meta`, `link`, `source`, `area`, `base`, `col`, `embed`, `param`, `track`, `wbr`) self-close.
  3. Bare boolean attrs (`disabled`, `readonly`, `checked`, `autofocus`, `required`, `hidden`) → `={true}`.
  4. `style="prop:val;..."` → `style={{ propCamel: 'val', ... }}`.
  5. HTML comments `<!-- x -->` → `{/* x */}`.
  6. SVG attribute fixups (`stroke-width` → `strokeWidth`, `viewBox` stays).
  7. Wrap multi-sibling result in `<>...</>`.
  - On embedded `<script>`, complex SVG namespace attrs, or any parse-blocking condition, throw `HtmlToJsxError(reason, excerpt)`.
- **Pattern**: Pure function, no fs. Same toolchain hygiene as `canvas-pipeline.ts` (`magic-string` for byte-range edits where regex isn't enough).
- **Validate**: `bun test test/html-to-jsx.test.ts` green (12 fixture cases).

### Task 5 — EXTEND codemod with `--target {canvases|specimens}` + `--force`

- **Do**: Replace the single-mode codemod with two explicit modes:
  - `--target canvases` (default): For each `.design/ui/*.tsx` (post-3.6 migrated files), prepend the `@mdcc/canvas-lib` import and drop any orphan inline primitive definitions. Re-emit JSDoc header.
  - `--target specimens`: For each `.design/system/*/preview/*.html`:
    1. Parse `<title>` → canvas name. Parse `<body>` inner HTML.
    2. `htmlToJsx(body)` — on `HtmlToJsxError`, log `[MANUAL] <path>: <reason>` + continue.
    3. Extract `<style>` blocks → `<Slug>.css`.
    4. Drop `<link rel="stylesheet">` (loaded by shell query).
    5. Wrap converted body in canvas-lib envelope (single section, `width={0} height={0}` artboard).
    6. Synthesise `<Slug>.meta.json` from `<title>` + SPECIMEN comment + parent DS name.
    7. Write triple, archive original.
  - `--force` flag overwrites existing `.tsx`; default skips them.
- **Validate**: Dry-run reports ~40 specimens + 3 UI canvases processed with ≤ 5 `[MANUAL]` flags. Real run completes. `bun test test/migrate-specimens.test.ts` green.

### Task 6 — RUN both codemod modes end-to-end

- **Do**: `bun scripts/migrate-canvases.ts --target canvases --force` then `bun scripts/migrate-canvases.ts --target specimens`. Open Docs Site / Canvas Viewport / Smoke TSX / a sample of 5 migrated specimens in dev-server. Verify no console errors.
- **Gotcha**: Signature specimens with elaborate inline SVG (`iconography.html`, `logo.html`) may land in `[MANUAL]`. Manual fix-up budget: ~30 min per. Plan accepts up to 5 manual interventions.
- **Validate**: 35+ specimens auto-migrate. Manual ones tracked in `_history/_migration-2026-05-15/MIGRATION_NOTES.md`.

### Task 7 — UPDATE `/design:setup-ds` to scaffold TSX + bootstrap canvas-lib

- **Do**: In `plugins/design/skills/design-system/SKILL.md`:
  - Round 0 (bootstrap detection) — if `<designRoot>/_lib/canvas-lib.tsx` is missing, write it from `canvas-lib.tsx.template` before anything else.
  - Round 3 (scaffold) — every `preview/X.html` write flips to `preview/X.tsx` via `ds-specimen.tsx.template`.
  - Roster `_MAPPING.md` extension column flips to `.tsx`.
  - frontend-design dispatch hint flips to `target: "tsx-react-specimen"`.
- **Pattern**: Keep the existing claim-scan substring list intact.
- **Validate**: A scratch `mdcc init && /design:setup-ds` in a `/tmp/scratch` writes `.tsx` specimens + `_lib/canvas-lib.tsx`.

### Task 8 — CREATE `hmr-broadcast.ts` + wire into `ws.ts` + `_shell.html` client

- **Do**:
  1. Implement `hmr-broadcast.ts` per the spec in "Files to create". Subscribe to `fs-watch.ts` change events. Debounce 50 ms. Classify each change:
     - `.css` sibling of a canvas → `{ type: "canvas-hmr", mode: "css", slug, version: <etag> }`
     - `.tsx` canvas → `{ type: "canvas-hmr", mode: "module", slug }`
     - `<designRoot>/_lib/**` → `{ type: "canvas-hmr", mode: "hard", scope: "lib" }`
  2. In `ws.ts`, register the broadcaster and ensure it fans out only to clients subscribed to the affected slug.
  3. In `plugins/design/templates/_shell.html`, inject a `<script type="module">` that opens a WS connection on boot, listens for `canvas-hmr`, and:
     - `mode: "css"` → swap `<link>` `href` with cache-bust query.
     - `mode: "module"` → if `import.meta.hot.accept(...)` is wired on the loaded canvas module, call it; else `location.reload()`.
     - `mode: "hard"` → `location.reload()` unconditionally.
  4. The canvas-pipeline output gets a tiny trailing `if (import.meta.hot) import.meta.hot.accept();` snippet appended (only when ESM target — current). React Fast Refresh on Bun 1.3 is built-in via the loader.
- **Validate**: `bun test test/hmr-broadcast.test.ts` (6 cases). Manual: edit a className in `Docs Site.tsx`; iframe updates in < 200 ms wall-clock.

### Task 9 — CREATE `canvas-lib-inline.ts` + wire into `handoff.ts`

- **Do**: Parse `<designRoot>/_lib/canvas-lib.tsx` via `oxc-parser`. Build `Map<exportName, { source, deps[] }>`. Implement `inlineUsedExports(canvasSource: string, libMap): { content, droppedImport }` — find the `import { ... } from "@mdcc/canvas-lib"` line, collect named imports, transitively resolve internal deps, strip the import line, append resolved bodies before `export default`. In `handoff.ts.emitRegistryItem()`, call `inlineUsedExports()` right after `stripDataCdId()` + before `classifyImports()`. Treat `@mdcc/canvas-lib` as neither npm dep nor registry dep.
- **Pattern**: Same `oxc-parser` + `magic-string` pair the rest of the pipeline uses.
- **Gotcha**: Helpers that reference other helpers (`ColorSwatch` → `TokenChip`) need transitive resolution. Tests must cover.
- **Validate**: `bun test test/canvas-lib-inline.test.ts` (10 cases). End-to-end: run `bin/handoff.sh "Smoke TSX.tsx" .design`; grep emitted `Smoke TSX.registry.json.files[0].content` for `@mdcc/canvas-lib` — **zero** matches. Grep for `function DesignCanvas` — at least one match.

### Task 10 — CREATE `ds-specimen.tsx.template` + update `canvas.tsx.template`

- **Do**: Write `plugins/design/templates/ds-specimen.tsx.template` (~50 LOC) — imports envelope from canvas-lib, single section, single `width={0} height={0}` artboard, JSDoc header from meta. Update `plugins/design/templates/canvas.tsx.template` to replace the inline primitive block with `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib"`.
- **Validate**: Hand-render both templates against a sample meta; output parses cleanly via `oxc-parser`.

### Task 11 — UPDATE DS critics + keeper for `.tsx` specimens

- **Do**: `plugins/design/agents/design-system-completeness-critic.md` — specimen-existence check reads `.tsx`. `plugins/design/agents/design-system-keeper.md` — class-roots scan accepts `.tsx` (verify already extension-agnostic).
- **Validate**: Run completeness-critic against `system/project/preview/` after migration — 0 false negatives.

### Task 12 — UPDATE `_canvas-shell.html` query params + `client/app.jsx` for specimens

- **Do**: When the user clicks a specimen tile, `canvasUrl()` passes `?tokens=...&components=...&layout=...` so specimens load DS chrome via `<link>` injection in the shell. Verify the shell parses + injects all three.
- **Validate**: `colors-accent.tsx` renders with full DS chrome (tokens, fonts, hairlines).

### Task 13 — UPDATE `/design:edit` Step 1.5 to also load canvas-lib

- **Do**: Extend Step 1.5 — for ALL `.tsx` canvases (regardless of `css_mode`), also pre-load `<designRoot>/_lib/canvas-lib.tsx` into orchestrator context. The lib IS the authoring vocabulary; cold-edit on a canvas without seeing the available helpers is a known foot-gun.
- **Pattern**: Append a single `Read` call to the step's recipe; capped by canvas-lib size (< 25 KB).
- **Validate**: Manual: run `/design:edit` on a specimen and watch the trace — `_lib/canvas-lib.tsx` shows up as one of the pre-dispatch reads.

### Task 14 — END-TO-END regression + STATE.md update

- **Do**: `bun test` (≥ 110 pass / 0 fail). Manual smoke: every canvas + 5 random specimens render with 0 console errors. HMR latency probe on a single edit: median < 200 ms across 5 attempts. `/design:edit "tighter inset on the stamp"` on `colors-accent.tsx` — single-attribute edit lands via `canvas-edit.ts`. `/design:handoff` on Smoke TSX — emitted registry-item has zero `@mdcc/canvas-lib` references in `files[0].content`.
- **Validate**: STATE.md reflects the post-3.6.1 close. Update `canvas-format-tsx` scenario spec to reference the canvas-lib pattern + add the second scenario `specimen-render-and-edit/`.

---

## Validation

```sh
# Type-check (modulo Phase 3.6 pre-existing api.ts errors)
bun --cwd plugins/design/dev-server run tsc --noEmit

# Tests
bun --cwd plugins/design/dev-server test

# Codemod re-run (specimens + canvases)
bun scripts/migrate-canvases.ts --force
bun scripts/migrate-canvases.ts --target specimens

# Manual canvas roundtrip (requires a dev-server boot)
mdcc design serve --root "$(pwd)"
# Open every canvas + a sample of specimens. Verify rendering + Cmd+Click.
```

---

## Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| HTML-to-JSX rewriter breaks on a specimen with elaborate inline SVG | Med (signature specimens like `iconography.html` + `logo.html`) | Print `[MANUAL]` and skip. Manual migration budget: ~30 min per. Plan accepts up to 5. |
| Width=0/height=0 sentinel collides with legitimate intent | Very low | Documented in `DCArtboard` JSDoc; nothing currently passes `width=0`. |
| Re-running codemod with `--force` orphans the existing migration archive | Low | `--force` only overwrites the `.tsx`; archive untouched. |
| canvas-lib divergence between template + scaffolded copy | Med (template + per-project copy can drift) | Template is the canonical source; setup-ds idempotently re-scaffolds when an upgraded template hash differs from the on-disk hash. Phase 3.7 follow-up if needed. |
| `_canvas-shell.html` doesn't load `_layout.css` for specimens | Low (Task 12 covers it) | Manual smoke against `colors-accent.tsx`; styles missing → follow-up patch. |
| DS critics flag false-positive blockers on `.tsx` files | Low (Task 11 covers it) | Verify each critic's path-reading logic before merge. |
| HMR client races with iframe boot — first WS message arrives before `import.meta.hot` is wired | Med (Bun's HMR API is < 1 year old) | Client buffers up to 5 messages while waiting for `import.meta.hot` to surface; if not surfaced within 1 s, falls back to `location.reload()`. Tested in `hmr-broadcast.test.ts`. |
| Inline canvas-lib export with transitive helper deps inflates handoff sidecar | Low (helpers are small) | Set a soft warning at > 30 KB `files[0].content`; user can audit + opt out of specific helpers in canvas TSX. |
| `Bun.build` rejects the virtual-module resolver in some Bun version | Low (mature API) | Tests pin against current Bun 1.3.10. Bump path: re-run resolver tests on every Bun upgrade. |
| `frontend-design` Skill doesn't know `target: "tsx-react-specimen"` | Low | Orchestrator falls back to template-stitching. |

---

## Scenario Coverage (UI tasks — required)

| Scenario | Covers | Status |
|----------|--------|--------|
| `canvas-format-tsx/tsx-canvas-render-and-edit` (existing — Phase 3.6) | Canvas opens + Cmd+Click + AST edit on UI canvas | Existing; pilot during `/done` |
| `canvas-format-tsx/specimen-render-and-edit` (new) | Same flow against a DS specimen (`colors-accent.tsx`) | 🆕 — single platform (web-desktop) |

---

## Acceptance Criteria

- [ ] All 14 tasks completed
- [ ] `/flow:utils-verify` passes after each task
- [ ] `<designRoot>/_lib/canvas-lib.tsx` exists, parses cleanly, exports the full surface (envelope + helpers + hooks)
- [ ] `Docs Site.tsx`, `Canvas Viewport.tsx`, `Smoke TSX.tsx` all render in the dev-server with **0 console errors**
- [ ] At least 35 of the ~40 DS specimens auto-migrate via `--target specimens`; rest tracked in `_history/_migration-2026-05-15/MIGRATION_NOTES.md` with manual-fix reasons
- [ ] `Cmd+Click` on a specimen element populates `_active.json.selected.v=2`
- [ ] `/design:edit "<small style tweak>"` lands on a specimen via the AST fast-path
- [ ] **HMR median latency < 200 ms** click-to-paint on a single-element edit (sampled over 5 attempts on `Docs Site.tsx`)
- [ ] HMR survives a `_lib/canvas-lib.tsx` edit — every open canvas reloads cleanly
- [ ] `/design:handoff` on any canvas emits a registry-item with **zero `@mdcc/canvas-lib` references** in `files[0].content` (lib exports inlined)
- [ ] `bun test` green (**≥ 110 pass / 0 fail**)
- [ ] `bun --cwd plugins/design/dev-server run tsc --noEmit` no new errors (pre-existing api.ts errors carry forward)
- [ ] `/design:setup-ds` writes `.tsx` specimens for a fresh DS + scaffolds `_lib/canvas-lib.tsx`
- [ ] Updated `canvas-format-tsx` scenarios pass single-platform pilot
- [ ] STATE.md reflects post-3.6.1 status; archive note recorded

---

## Retro (2026-05-19 — /flow:done close-out)

**Shipped:** 14/14 tasks + 6 post-/validate visual-regression repair tasks landed across 2026-05-12 → 2026-05-18 (see STATE.md "Phase 3.6.1 execution close-out" + "visual-regression repair" sections). A standalone system review covers the full divergence inventory: `.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md` (gitignored; alignment 5.5/10).

**The /flow:done session itself (2026-05-19) added three things on top of the executed work:**

1. **Caught a type regression `/flow:validate` would have blocked on.** `Inspect.injectInspectorOnly()` was added to `inspect.ts` during Phase 3.6.1 execution but not declared on the exported interface — `http.ts:292` + `inspect.ts:181` failed `tsc --noEmit` with `Property 'injectInspectorOnly' does not exist on type 'Inspect'`. One-line type-contract fix. Lesson: when extending a returned object inside `createX()`, the interface declaration is non-optional. Worth a lint rule or convention if it recurs.
2. **`specimen-render-and-edit` scenario authored + piloted.** Plan acceptance criterion ("Updated `canvas-format-tsx` scenarios pass single-platform pilot") promised a second scenario; landed today. Runner walks every `.design/system/<ds>/preview/*.tsx`, opens each through `_canvas-shell.html`, probes DOM + console errors + `#canvas-mount-error` text content, screenshots, classifies PASS/EMPTY/FAIL. **First run caught 3 broken specimens with unescaped `{`/`}` in JSX text content** (CSS / code dumps). Initial classifier missed them because the parse error rendered as visible body text rather than console output — fixed the classifier to inspect `#canvas-mount-error` too. After fixing the 3 specimens (`{'{'}` / `{'}'}` escapes + template-literal wrap), 38/38 PASS.
3. **DDR-022 + DDR-023 + changeset.** The Phase 3.6.1 plan + retro captured the architectural decisions in narrative; promoting them to formal DDRs makes the contract greppable for future work. Changeset (minor bump) added.

**Soft gaps acknowledged (acceptance criteria not directly measured this session):**

- HMR < 200 ms p50 latency probe not run end-to-end. Code path is in place (`hmr-broadcast.ts` + `_shell.html` HMR client, 7 tests); a wall-clock measurement deferred.
- Cmd+Click on a specimen → `_active.json.selected.v=2` not directly exercised by the scenario. Pipeline is shared with UI canvases (Phase 3.6 scenario `tsx-canvas-render-and-edit` exercises it); the specimen-render scenario verifies that `data-cd-id` injection lands (per-specimen cdIds counts 39–239), which is the prerequisite. End-to-end Cmd+Click probe is straightforward to add — defer until first observed failure.

**What worked:**

- **`/flow:validate` → `/flow:done` cadence held.** Validate caught the type regression + missing changeset + missing DDRs; done closed each in order. The scenario-runner gate was the high-signal catch — without it the 3 broken specimens would have shipped silent.
- **The retro that already existed paid off twice.** Writing DDR-022 + DDR-023 was just promoting prose the 2026-05-18 system review had already organized. The DDR is the contract; the retro is the receipt.
- **Bash-3.2 compat for the runner script.** Caught `mapfile` not existing on macOS bash in dry-run before live run; one-line `while IFS= read` substitute. The runner is portable to any macOS dev box without Homebrew bash.

**What to change in /plan or /execute next time:**

- **Acceptance criterion "X scenarios pass single-platform pilot" should NAME the scenarios that need to exist.** Phase 3.6.1's criterion left "updated scenarios" ambiguous — turned out to mean "author specimen-render-and-edit then pilot it", but the wording let execution slide past it. Explicit list: "scenarios under `.ai/scenarios/canvas-format-tsx/`: tsx-canvas-render-and-edit, specimen-render-and-edit. Both must have a `runners/web-desktop.sh` and a pilot run committed."
- **Whenever interfaces get extended inside `createX()` factories, run a type-check before declaring the task done.** Phase 3.6.1's Task 14 "full regression: bun test green, bun tsc --noEmit no new errors" line passed at execution time, but the regression that surfaced in `/flow:validate` was a tsc error introduced AFTER Task 14's verification (during one of the repair commits). One more `bun tsc --noEmit` immediately before `/flow:done` would have caught it.
- **Sub-agent specimen prompts must call out JSX brace-escape explicitly.** Three of the 38 specimens dumped raw CSS / JS code into JSX text content with unescaped `{` and `}`. The fix is universal: any specimen showing code-as-text wraps in `<pre>{\`...\`}</pre>` (template literal) when there's no inline highlighting, or uses `{'{'}` / `{'}'}` JSX escapes when there is. Worth a one-line note in `SKILL.md`'s sub-agent prompt block + `ds-specimen.tsx.template` header comment.

**Followups (not blockers):**

- `bin/server-up.sh` still launches `server.mjs` (legacy Node server, no TSX pipeline). The Bun-based server is the authoritative runtime (DDR-009 + DDR-020) but `mdcc design serve` doesn't boot it yet. Phase 3.6.2 or a small follow-up DDR.
- 30 biome-style findings auto-fixed during `/flow:validate`; 1 remaining (`while ((m = re.exec()))` in `handoff.ts:450` — pre-existing regex idiom). Worth a `biome.json` override or a one-line refactor.
- Plan promised `_history/_migration-2026-05-15/MIGRATION_NOTES.md` for codemod-skipped specimens. After the html-to-jsx scope correction (DDR-023) the notes file is moot; can delete on next archive-cleanup pass.
