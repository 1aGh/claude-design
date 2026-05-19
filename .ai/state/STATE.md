# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — md-claude v1.0 roadmap
**Phase:** Phase 4.1
**Status:** done
**Started:** 2026-05-12
**Updated:** 2026-05-19
**Active task:** —
**Active plan:** —

## History

| Date | Phase | Status | Note |
| --- | --- | --- | --- |
| 2026-05-19 | Phase 4.1 | done | Universal canvas input grammar shipped (DDR-026). Every TSX canvas now mounts `CanvasShell` automatically — Move (V), Hand (H), Comment (C) tools; Cmd+hover preview deep; Cmd+click select replace; Cmd+Shift+click add to multi; right-click context menu with Copy CSS / Fit / Reset etc.; hand-mode bare-drag pan via new `isPanDragActive` on `useViewportController`; capture-phase listeners suppress native button presses / input focus when the router claims an event. Halos render as `position: fixed` overlays in screen coords (zoom-immune at any level). Active-artboard indicator softened to 1px tinted accent. Inspector overlay shrunk to comment-pin renderer (legacy `dgn-insp-*` hover/click classes removed). Shell-side `.sel-halo` wrap removed. Decision flipped mid-execution from opt-in `inputMode="figjam"` prop to universal default (visual inconsistency cyan-vs-accent + naming directive); `figjam-shell.tsx` → `canvas-shell.tsx`, `.dc-fjm-*` → `.dc-cv-*`. New modules: `input-router.tsx`, `use-tool-mode.tsx`, `use-selection-set.tsx`, `context-menu.tsx`, `tool-palette.tsx`, `canvas-shell.tsx` (+ 3 test files = 52 new tests). `bun test`: 185/185, 0 fail. `bunx tsc --noEmit` clean. Canvas-build smoke: Canvas Viewport / Docs Site / Smoke TSX all 200, 0 legacy `figjam` / `dc-fjm-` / `dgn-insp-` refs in bundles. DDR-026 rewritten as universal grammar; scenario `canvas-figjam-grammar` → `canvas-input-grammar`. Archived: `.ai/plans/archive/phase-4.1-figjam-canvas-interactions.md`. |
| 2026-05-19 | Phase 4.0.5 | done | DDR-025 implemented. Canvas-lib relocated `.design/_lib/canvas-lib.tsx` → `plugins/design/dev-server/canvas-lib.tsx` (single source). `canvas-lib-resolver.ts` rewired to `import.meta.dir`; `canvas-build.ts` pre-flight is install-corruption check + once-per-boot legacy-`_lib/` deprecation warning; `http.ts` adds explicit `fs.watch` on the dev-server-internal canvas-lib (synthetic `fs:any` rel-path → existing hard-reload classifier). `design-system/SKILL.md` Round-0 Batch-A step 0 deleted; perf fixture relocated `.design/_lab/perf-100-artboards.tsx` → `plugins/design/dev-server/examples/perf-100-artboards.tsx` + sibling README; template + dogfood + orphan `.design/_lib/design-canvas-viewport.tsx` deleted (`.design/_lib/` + `.design/_lab/` gone). Skill docs (design, ui-kit, design-system), edit/new commands, canvas template, CLAUDE.md "Dev-server runtime contract" all swept; DDR-022 header annotated as partially superseded; DDR-024 references updated with "now at" notes. `bun test` 133/133. Handoff drop sha1 byte-identical (`7de51a51…`, baseline cached at `.ai/logs/phase-4.0.5-handoff-baseline.json`). 4 tests rewritten in `canvas-lib-resolver.test.ts` to match the new contract + new legacy-guard test. Validate scope: plumbing (tests + handoff parity + doc sweep + dev-server boot smoke); cross-platform scenario skipped — no UI surface changed. Changeset authored (patch, `phase-4-0-5-canvas-lib-single-source.md`). Plan retro appended; archived to `.ai/plans/archive/phase-4.0.5-canvas-lib-single-source.md`. Phase 4.1 + 4.2 plans remain `blocked` pending post-4.0.5 rewrite. |
| 2026-05-19 | Phase 4.1 | blocked → 4.0.5 spawned | `/flow:execute` on `phase-4.1-figjam-canvas-interactions.md` halted before any code change. Architectural pushback from user: `.design/_lib/canvas-lib.tsx` + `.design/_lab/perf-100-artboards.tsx` are dev-server engine code wrongly materialized into user-content space; DDR-022's "project-owned canvas-lib" produces unbounded drift across plugin releases (every project copy stale forever); Phase 4.1's new modules (input-router / tool-mode / selection-set / context-menu) would multiply the drift. DDR-025 recorded — canvas-lib relocates to `plugins/design/dev-server/canvas-lib.tsx` (single source), `_lab/` perf fixture moves to `dev-server/examples/`, `design-system/SKILL.md` Round-0 step 0 (canvas-lib scaffold) deleted, one-cycle deprecation log for downstream projects with legacy `_lib/`. Phase 4.0.5 plan drafted as the prerequisite cleanup. Phase 4.1 marked `blocked-on: phase-4.0.5` in its frontmatter with a banner noting why it can't run as-written. No commits this session. |
| 2026-05-19 | Phase 4 | done | Infinite-canvas engine landed: `DesignCanvas` world plane + `useViewportController` + `DCMiniMap` + `DCZoomToolbar` + click-to-focus + `<file>.meta.json` `layout`/`viewport` persistence (PATCH endpoint, 5 new tests). T7 shipped as DOM-driver enhancements with handoff static-frame filter + Pixi.js v8 runtime importmap entry (lazy bundle). Pan/zoom math hardened across 4 user-feedback hotfix passes: wheel input model (pan default, shift=horizontal, ctrl/pinch=zoom), iframe focus on pointerenter, lib HMR cache invalidation, listener stability (no mid-gesture teardown), React-state-vs-imperative-write decoupling, render-order grid (DS-01..DS-N not alphabetical), per-cell sizing for mixed-width artboards, paper-grid bg + DS-token artboard chrome, CSS `zoom` (not `transform: scale`) → text crisp at any zoom level, document-capture listeners for wheel/keys, shift+wheel axis-swap robustness, pan velocity decoupled from zoom. DDR-024 holds the deferred Pixi.js bundle gate. `bun test` 139/139. Commits: `0c4c209`, `db2f896`, `deef639`, `1abbc09`, `95260c2`, `1aeffdb`. Archived: `.ai/plans/archive/phase-4-canvas-v2-rendering-engine.md`. |
| 2026-05-19 | Phase 4 T1–T6 | done | Infinite-canvas engine landed in `canvas-lib.tsx.template` — DesignCanvas world plane (T1), `useViewportController` hook (T2), `DCMiniMap` + `DCZoomToolbar` (T3), per-DCArtboard click-to-focus (T4), `<file>.meta.json` `layout` + `viewport` persistence (T5) via new `/_api/canvas-meta` GET/PATCH endpoint, perf lab `.design/_lab/perf-100-artboards.tsx` + DDR-024 (T6). T0 revert folded into the same change. `bun test` 135/135. Commit `0c4c209`. |
| 2026-05-19 | Phase 4 T0 | folded | Shell-level 2026-05-19 T1 reverted in `app.jsx` (computeFit/computeDefaultGrid/.vp-world/multi-tab openTab/SelectionHalo rect dropped); engine moves to canvas runtime per user direction. Folded into the T1–T6 commit. |
| 2026-05-19 | Sidebar restructure | done | Dev-server FILES panel redesigned: sidecar nesting, per-DS folders, unified section toggles, hidden-files toggle, DS-count pill. Commit `8c58c2c`. Archived: `.ai/plans/archive/client-tree-restructure.md`. Changeset authored. |
| 2026-05-19 | Phase 3.6.1 | done | canvas-lib + HMR + TSX specimens shipped; 38/38 specimen-render scenario PASS; DDR-022 + DDR-023 recorded. Archived: `.ai/plans/archive/phase-3.6.1-canvas-envelope-and-ds-specimens.md`. |

## Phase 3.6.1 close-out (2026-05-19, /flow:done)

- `/flow:validate` ran clean after one type-contract fix (`Inspect.injectInspectorOnly()` declaration) + 30 biome autofixes (1 pre-existing `while ((m = re.exec()))` carry-over).
- New scenario `canvas-format-tsx/specimen-render-and-edit` (web-desktop, walks all 38 specimen TSXs) authored + piloted. First run caught **3 broken specimens** with unescaped `{` / `}` chars in JSX text content (`components-code-block`, `components-diff-view`, `type-mono`). Fixed via `{'{'}` / `{'}'}` escapes + `<pre>{\`...\`}</pre>` template wrap. Re-run: **38/38 PASS**.
- DDR-022 (canvas-lib virtual module + inline-on-handoff) + DDR-023 (no html-to-jsx codemod, specimens are bare TSX) recorded.
- Changeset authored (`@1agh/md-claude` minor, 0.13.1 → 0.14.0 on next `changeset version`).
- Plan retro appended; plan archived to `.ai/plans/archive/`.
- Commits: `5d9292e` (feat) + this STATE update.

## Phase 3.6.1 visual-regression repair (2026-05-18, post-/validate)

When the user opened the migrated specimens in the dev-server they reported widespread visual breakage. Live screenshot review confirmed three discrete failure modes; all fixed in this session:

1. **Triple-chrome above specimen content.** The migrated specimens were wrapped in `<DesignCanvas><DCSection title="..."><DCArtboard label="..." width={0} height={0}>...</DCArtboard></DCSection></DesignCanvas>`. The DCSection's `<h2>` title strip + DCArtboard's `dc-artboard-label sku` SKU strip both rendered ABOVE the original `<header class="specimen-hd">` — three header rows where the original HTML had one.

2. **`htmlFor` bleeding into prose.** The html-to-jsx codemod's attribute-rename regex (`\s([a-zA-Z-]...)(=...|(?=\s|/>|>))`) matched plain words in text content. The word "for" in sentences like "a library for the marketplace" got rewritten to `htmlFor`. Same risk class would have hit `readonly`, `disabled`, `checked`, `selected`, `hidden`, etc. — every boolean attribute name.

3. **Sibling CSS dropped.** `import "./<slug>.css"` in specimen TSX produced a separate `.css` asset via Bun.build, but `buildCanvasModule()` only took `outputs[0]` (the JS entry-point) and discarded the rest. Specimens with bespoke per-file CSS (`ui_kits-desktop-showcase`, `motion`, `state-system`, `logo`, `iconography`, ...) rendered as unstyled text dumps in the browser.

### Scope correction — user direction

User explicitly stated `html-to-jsx` is unnecessary scaffolding: specimens should be authored as native TSX with no codemod layer at all. Phase 3.6.1's "specimens migration" track is **collapsed to a one-shot manual migration** — going forward, specimens are bare TSX written by hand or by sub-agents during DS bootstrap (per the updated SKILL.md sub-agent prompt). No `migrate-canvases.ts`, no `html-to-jsx.ts`.

### Changes this session

- **DELETED:** `plugins/design/dev-server/html-to-jsx.ts`, `plugins/design/dev-server/test/html-to-jsx.test.ts`, `plugins/design/dev-server/test/migrate-specimens.test.ts`, `scripts/migrate-canvases.ts`. Tests dropped from 149 → 123 (still ahead of Phase 3.6 baseline of 95).
- **canvas-lib.tsx + template** — reverted the `width=0/height=0` auto-flow special case + `bare` DCSection prop. DCArtboard now ONLY renders fixed-px chrome (UI mocks); specimens never wrap themselves in it.
- **Specimens stripped (`.design/system/project/preview/*.tsx`)** — 38 specimens hand-fixed: dropped the `<DesignCanvas><DCSection><DCArtboard>` envelope, replaced with bare `<><header class="specimen-hd">...</header><main class="specimen">...</main></>`. Also globally replaced `htmlFor ` → `for ` in prose text (left `htmlFor=`/`htmlFor={...}` in actual attribute positions). Carried out via a one-shot Bun script (deleted after run).
- **canvas-build.ts** — `buildCanvasModule()` now collects every `kind: "asset"` CSS output from `Bun.build` and prepends a self-installing `<style data-canvas-css="bundled">` injector to the JS bundle. Idempotent per-slug; works under both module + hard HMR reloads.
- **ds-specimen.tsx.template** — rewritten to scaffold bare TSX with `specimen-hd` + `<main class="specimen">` shape. No envelope.
- **design-system/SKILL.md** — sub-agent prompt block flipped: specimens are bare TSX, NO `@mdcc/canvas-lib` import. UI mock canvases (Docs Site, Canvas Viewport, Smoke TSX) keep the envelope.

### Visual verification (live dev-server, agent-browser)

Started the Bun-based dev-server (`bun plugins/design/dev-server/server.ts`) — note that `bin/server-up.sh` boots the legacy `server.mjs` (zero-dep Node, no TSX pipeline). The Bun server is what wires the canvas-build pipeline + CSS injector.

Captured screenshots of 38 specimens + 3 UI canvases. Sampled and confirmed visually correct:

- ✓ colors-accent · type-scale · components-buttons · components-toggles · iconography · logo · motion · borders · empty-state · components-cards · ui_kits-desktop-showcase — all render with full styling, single specimen-hd, original layout intact.
- ✓ Docs Site (5 stacked artboards at 1440×900) · Canvas Viewport — UI canvas chrome (`dc-canvas` / `dc-section` / `dc-artboard` + label strips) renders correctly via their sibling CSS.
- ✓ Smoke TSX renders functionally (counter + h1 + bare button); intentionally has no chrome styling (it's a foundation smoke fixture).

### Known carry-over

- `bin/server-up.sh` still launches `server.mjs` (legacy Node server, no TSX pipeline). The mdcc design serve story for the Bun-based server is a separate follow-up — currently you boot it manually via `bun plugins/design/dev-server/server.ts --root . --port 4399`. Not blocking Phase 3.6.1 close-out but worth a Phase 3.6.2 or DDR.
- Tests: 123 pass / 0 fail (down from 149 only because the codemod tests went with the codemod). tsc clean except for the two pre-existing api.ts errors.

## Phase 3.6.1 execution close-out (2026-05-18)

All 14 tasks of the Phase 3.6.1 plan landed in this session — canvas envelope + reusable canvas-lib + HMR + DS specimens all in TSX.

- ✅ Task 1: `plugins/design/templates/canvas-lib.tsx.template` (~290 LOC) — frame envelope (DesignCanvas/DCSection/DCArtboard/DCPostIt) + specimen helpers (SpecimenHeader/SpecimenMeta/TokenChip/ColorSwatch/TypeScaleRow/KbdHint/ThemeToggle) + hooks (useTokens/useTheme/useArtboardBounds). Bootstrapped into `.design/_lib/canvas-lib.tsx`. Parses cleanly via oxc.
- ✅ Task 2: `plugins/design/dev-server/canvas-lib-resolver.ts` (~90 LOC) — `@mdcc/canvas-lib` virtual module resolver as a Bun.build plugin; `readCanvasLibSource()` for handoff. `canvas-build.ts` wires it in + adds explicit pre-flight check (Bun.build's plugin throws collapse to "Bundle failed", so we surface the missing-lib reason at the top level). `http.ts` threads `designRoot`. 7 new tests.
- ✅ Task 3: `.design/ui/Smoke TSX.tsx` rewritten with canvas-lib envelope + new meta sidecar. Renders 6 locator entries, no console errors.
- ✅ Task 4: `plugins/design/dev-server/html-to-jsx.ts` (~170 LOC) — regex-driven HTML→JSX rewriter: class→className, void elements self-close, boolean attrs `={true}`, style→object, comments→`{/* */}`, SVG kebab→camelCase, rejects inline `on*` handlers + `<script>` as out-of-scope. 15 fixture tests.
- ✅ Task 5: `scripts/migrate-canvases.ts` rewritten with `--target {canvases|specimens}` + `--force`. Canvases mode: prepend `@mdcc/canvas-lib` import + drop orphan inline primitives. Specimens mode: strip scripts → htmlToJsx → wrap in canvas-lib envelope → emit triplet (`.tsx`/`.css`/`.meta.json`) + archive original. 11 tests.
- ✅ Task 6: Both codemod modes ran end-to-end. Canvases: `Docs Site.tsx` + `Canvas Viewport.tsx` regenerated via `--force` (Smoke TSX already done). Specimens: 37/38 auto-migrated, 1 (`components-toggles.tsx`) hand-migrated for inline `onclick`-based state; archive + MIGRATION_NOTES.md written. All 11 sample canvases (3 UI + 8 specimens) build cleanly with non-trivial locator cardinality.
- ✅ Task 7: `plugins/design/skills/design-system/SKILL.md` — Round 0 (Batch A step 0) scaffolds `_lib/canvas-lib.tsx` idempotently from the template. Roster + prose flipped to `.tsx` extensions (~50 substitutions). Sub-agent prompt template now requires the canvas-lib envelope import block. `_MAPPING.md` destination paths flipped; source-side inspiration library kept as `.html` (the templates don't migrate).
- ✅ Task 8: `plugins/design/dev-server/hmr-broadcast.ts` (~110 LOC) — bridges `fs:any` events to `canvas-hmr` WS messages with 50ms debounce + mode classification (`css`/`module`/`hard`) + coalescing (`hard > module > css` within the window). Wired into `ws.ts`. `_shell.html` injects a small HMR client that opens `/_ws`, swaps `<link>` href on CSS changes (cache-bust `?v=`) and `location.reload()` on TSX/`_lib` changes; reconnects with 750 ms backoff on close. 7 tests.
- ✅ Task 9: `plugins/design/dev-server/canvas-lib-inline.ts` (~180 LOC) — `buildLibMap()` parses canvas-lib via oxc-parser, captures named exports + internal helpers with JSDoc-extended source ranges + dep edges (transitive references). `inlineUsedExports()` strips the `@mdcc/canvas-lib` import line, BFS-resolves transitive deps, appends bodies after the canvas default export. `handoff.ts` calls it after `stripDataCdId()`; filters `@mdcc/canvas-lib` out of npm deps. End-to-end verified: `Smoke TSX.registry.json.files[0].content` has zero `@mdcc` references. 14 tests.
- ✅ Task 10: `plugins/design/templates/canvas.tsx.template` rewritten — replaces inline primitive functions with `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib"`; JSDoc explains the virtual-specifier contract. NEW `plugins/design/templates/ds-specimen.tsx.template` (~55 LOC) — simpler envelope for specimens, auto-flow artboard (`width={0} height={0}`), wraps `SpecimenHeader`.
- ✅ Task 11: `plugins/design/agents/design-system-completeness-critic.md` + `design-system-keeper.md` — specimen-existence checks + narrative refs flipped to `.tsx`.
- ✅ Task 12: `_canvas-shell.html` accepts new `?layout=<rel>` query param (specimens load DS chrome via `_layout.css`). `client/app.jsx`'s `canvasUrl()` detects `system/<ds>/preview/` paths and auto-derives `?layout=` + `?components=` + `?tokens=` from the DS slug. `colors-accent.tsx` end-to-end-loadable with full chrome.
- ✅ Task 13: `plugins/design/commands/edit.md` Step 1.5 extended — for ALL `.tsx` canvases (any css_mode), the orchestrator pre-loads `_lib/canvas-lib.tsx` so the iteration prompt sees the authoring vocabulary (envelope + helpers + hooks) instead of re-inventing equivalents.
- ✅ Task 14: full regression. `bun test` — **149 pass / 0 fail** across 21 test files (+ 54 new tests, up from 95 baseline). `bun tsc --noEmit` — only pre-existing api.ts errors (467/468); no new errors. End-to-end build smoke on 11 canvases/specimens — all clean. /design:handoff on Smoke TSX → registry-item has zero `@mdcc/canvas-lib` references.

**Files added this session:**

- ADDED: `plugins/design/templates/canvas-lib.tsx.template` + `.design/_lib/canvas-lib.tsx`
- ADDED: `plugins/design/templates/ds-specimen.tsx.template`
- ADDED: `plugins/design/dev-server/canvas-lib-resolver.ts`
- ADDED: `plugins/design/dev-server/canvas-lib-inline.ts`
- ADDED: `plugins/design/dev-server/hmr-broadcast.ts`
- ADDED: `plugins/design/dev-server/html-to-jsx.ts`
- ADDED: `plugins/design/dev-server/test/canvas-lib-resolver.test.ts` (7 tests)
- ADDED: `plugins/design/dev-server/test/canvas-lib-inline.test.ts` (14 tests)
- ADDED: `plugins/design/dev-server/test/hmr-broadcast.test.ts` (7 tests)
- ADDED: `plugins/design/dev-server/test/html-to-jsx.test.ts` (15 tests)
- ADDED: `plugins/design/dev-server/test/migrate-specimens.test.ts` (11 tests)
- ADDED: 37 codemod-migrated specimen TSX/CSS/meta triplets under `.design/system/project/preview/`
- ADDED: `.design/system/project/preview/components-toggles.tsx` (hand-migrated)
- ADDED: `.design/_history/_migration-2026-05-15/MIGRATION_NOTES.md`
- MODIFIED: `plugins/design/dev-server/canvas-build.ts`, `handoff.ts`, `http.ts`, `ws.ts`, `client/app.jsx`
- MODIFIED: `plugins/design/templates/canvas.tsx.template`, `_shell.html`
- MODIFIED: `plugins/design/skills/design-system/SKILL.md`, `plugins/design/templates/design-system-inspiration/_MAPPING.md`
- MODIFIED: `plugins/design/agents/design-system-{completeness-critic,keeper}.md`
- MODIFIED: `plugins/design/commands/edit.md`
- MODIFIED: `scripts/migrate-canvases.ts`
- ARCHIVED: `.design/system/project/preview/*.html` → `.design/_history/_migration-2026-05-15/system/project/preview/`

## Phase 3.6 close-out note (2026-05-18)

Phase 3.6 (canvas TSX format) **shipped** with all 12 tasks marked complete + 95 tests green + handoff CLI end-to-end-verified. Acceptance criteria as written were met. Runtime hygiene gaps surfaced when the user opened the migrated canvases in the dev-server:

- `Docs Site.tsx` + `Canvas Viewport.tsx` white-page at runtime — codemod produced JSX that referenced `<DesignCanvas>`/`<DCSection>`/`<DCArtboard>` but didn't define them (originals relied on babel-runtime window globals). Build + tests pass; runtime fails.
- `Smoke TSX.tsx` lacks the canvas envelope (was a foundation-slice mount fixture, never upgraded).
- DS specimens left as `.html` (Plan Task 9 explicitly skip-listed them) breaks the plug-and-play promise — inspector select + `/design:edit` don't work on specimens.
- HMR was never wired (carries from runtime slice).

3.6 acceptance criteria didn't require "renders without console errors" — only "transpile + build". That gap caused the disconnect. 3.6.1 plan adds that gate + introduces a project-owned `@mdcc/canvas-lib` shared library (resolved virtually, inlined on handoff) + wires HMR + flips DS specimens to TSX.

Closing 3.6 as **shipped + documented**; 3.6.1 is the follow-up.

## Execution Progress — phase-3.6-canvas-tsx-format (closing slice, 2026-05-18)

Tasks 7–12 of 12 landed in this session — canvas TSX format is feature-complete from the dev-server through to /design:handoff registry-item drop.

- ✅ Task 7: `handoff.ts` + `bin/handoff.sh` + rewritten `/design:handoff` command. Emits `<Slug>.registry.json` per [shadcn registry-item schema](https://ui.shadcn.com/schema/registry-item.json). `stripDataCdId()` AST-removes the pipeline scaffolding from the dropped TSX. `classifyImports()` separates npm specs from `@/components/ui/*` registry deps via `Bun.Transpiler.scanImports()`. React + ReactDOM forced into the dep floor (DDR-012). 14 new tests in `test/handoff.test.ts`.

- ✅ Task 8: `scripts/migrate-canvases.ts` codemod + one-shot run. `Docs Site.html` (1909 LOC, 74 KB) → `Docs Site.tsx` (48 KB) + `Docs Site.css` (30 KB) + meta-injected `css_mode: "inline"` + `data_cd_id_version: 1` + auto-generated JSDoc header (Task 12a baked in). `Canvas Viewport.html` (3076 LOC) → equivalent triplet. Originals archived under `_history/_migration-2026-05-15/ui/`. Both migrated canvases parse cleanly via `canvas-pipeline.ts` (locator counts: 722 + 1070 elements) and round-trip through `canvas-build.ts` (browser-loadable ESM, 156 KB + 244 KB respectively). React.useEffect ⇒ bare `useEffect` import rewrite handled.

- ✅ Task 9: `.html → .tsx` sweep across `plugins/design/commands/*` + `plugins/design/skills/*` (excluding intentional preview-specimen + `_shell.html` references). `new.md` scan recipes now match `\( -name "*.tsx" -o -name "*.html" \)` so the grace-window keeps working. `edit.md` Failure modes accept both extensions. `skills/design/SKILL.md` + `skills/ui-kit/SKILL.md` describe TSX-first canvas layout.

- ✅ Task 10 + 12d: schema additions. `canvas-meta.schema.json` gained `css_mode` enum (`inline | tailwind | modules`), `data_cd_id_version` integer, `ai_context` object (`pinned_decisions[]`, `known_quirks[]`, `why_this_exists`). `config.schema.json.handoffTargets` documents `registry:item` magic-path. `.design/config.json.handoffTargets` populated with the shadcn-registry entry.

- ✅ Task 11: smoke + regression. `test/phase-3.6-smoke.test.ts` exercises the migrated `Docs Site.tsx` + `Canvas Viewport.tsx` end-to-end (transpile → build → emit registry-item, all in one suite). Skips cleanly on fresh checkouts via `existsSync` guard. Real CLI run produces `Docs Site.registry.json`: 57 KB, 3 files (component 45 KB no `data-cd-id`, style 3 KB subset of `_components.css`, theme 2 KB of touched tokens), 30 cssVars surfaced.

- ✅ Task 12: AI-handoff polish.
  - 12a — `canvas-header.ts` JSDoc projector module. Idempotent block-comment overwrite via `applyHeaderToSource()`; surfaces `ai_context.why_this_exists` → `@notes`, `pinned_decisions[]` → `@decision`, `known_quirks[]` → `@quirk`. CLI entry for `/design:edit` to shell out. 8 new tests in `test/canvas-header.test.ts`. JSDoc generation is also baked into Task 8's codemod (every migrated canvas already ships a header).
  - 12b — `_components.css` + token bundling in `handoff.ts`. AST-scan canvas TSX for every `className` literal (covers string concats, template-literal quasis, ternaries via generic-recurse). `filterComponentsCss()` keeps rules whose first class is in the harvested set, including BEM-modifier derivatives (`.btn--ghost` rides along when `btn` is referenced). `filterTokensCss()` plucks only the `var(--*)` references the kept CSS touches. Emitted as `files[1]: registry:style` + `files[2]: registry:theme` + `cssVars.theme`.
  - 12c — `/design:edit` Step 1.5 added. Auto-loads `_components.css` + `colors_and_type.css` into orchestrator context BEFORE dispatching to frontend-design, gated on `css_mode === "inline"` + (style-verb-in-feedback OR `selected.v === 2`). Bounded cost (~6 KB CSS context) vs. the unbounded "Claude re-grep'd mid-edit" round-trip.
  - 12d — `ai_context` schema field (combined with Task 10).

**Phase 3.6 acceptance gates verified this session:**
- `bun test` — **95 pass / 0 fail** across 16 files (up from 83 at session start; +12 new tests).
- `bun tsc --noEmit` — clean for new files; only pre-existing `api.ts(457,25)+(458,24)` errors remain (confirmed unchanged).
- End-to-end CLI run: `bin/handoff.sh "Docs Site.tsx" .design` exits 0, emits valid `<Slug>.registry.json` (schema URL matches, `dependencies` floor present, `files[0].content` has zero `data-cd-id` occurrences).
- Pipeline round-trip on migrated canvases: `Docs Site.tsx` and `Canvas Viewport.tsx` both transpile + build cleanly; locator cardinality non-trivially populated (722 + 1070 entries).

**Deps added this session:** none. (`oxc-parser` + `magic-string` already present from foundation slice; `lightningcss` already in devDeps from Phase 3.4.)

**Files added (Phase 3.6 closing slice):**

- ADDED: `plugins/design/dev-server/handoff.ts` (~480 LOC) — registry-item emitter + CSS bundling
- ADDED: `plugins/design/dev-server/canvas-header.ts` (~130 LOC) — JSDoc projector
- ADDED: `plugins/design/dev-server/bin/handoff.sh` — orchestrator shell-out
- ADDED: `plugins/design/dev-server/test/handoff.test.ts` (14 tests)
- ADDED: `plugins/design/dev-server/test/canvas-header.test.ts` (8 tests)
- ADDED: `plugins/design/dev-server/test/phase-3.6-smoke.test.ts` (4 tests — repo-canvas regression)
- ADDED: `scripts/migrate-canvases.ts` (~330 LOC) — one-shot HTML→TSX codemod
- ADDED: `.design/ui/Docs Site.tsx` + `.css` (migrated)
- ADDED: `.design/ui/Canvas Viewport.tsx` + `.css` (migrated)
- ADDED: `.design/ui/Docs Site.registry.json` (sample handoff emit — gitignored? user picks)
- ADDED: `.design/_history/_migration-2026-05-15/ui/Docs Site.html` (archived)
- ADDED: `.design/_history/_migration-2026-05-15/ui/Canvas Viewport.html` (archived)
- MODIFIED: `plugins/design/dev-server/canvas-meta.schema.json` — `css_mode`, `data_cd_id_version`, `ai_context`
- MODIFIED: `plugins/design/dev-server/config.schema.json` — `handoffTargets[].path` documents `registry:item`
- MODIFIED: `.design/config.json` — `handoffTargets[0]` populated
- MODIFIED: `.design/ui/Docs Site.meta.json` + `Canvas Viewport.meta.json` — `css_mode: "inline"` + `data_cd_id_version: 1`
- MODIFIED: `plugins/design/commands/handoff.md` — rewritten for shadcn registry-item flow
- MODIFIED: `plugins/design/commands/edit.md` — Step 1.5 DS-context auto-load + Failure-modes ext check
- MODIFIED: `plugins/design/commands/new.md` — TSX-first default + tsx|html scan recipes
- MODIFIED: `plugins/design/commands/setup-docs.md` — TSX-aware inventory + tree diagram
- MODIFIED: `plugins/design/skills/design/SKILL.md` — TSX paths in active/comments/new
- MODIFIED: `plugins/design/skills/ui-kit/SKILL.md` — TSX canvas layout + inline frame primitives

**Out-of-scope / carries forward:**

- Performance budget gates from the plan (cold-load < 250 ms, transform < 8 ms p50, HMR < 100 ms, token cost < 30 %) — not measured this session. Bench harness in `test/perf-harness.ts` exists; full sampling against the migrated canvases is a `/done` follow-up.
- HMR — still not wired (carries from runtime slice).
- DDR-017 numbering — the plan calls for DDR-017 but the foundation slice picked DDR-019 (017 + 018 already taken). DDR-019 is the source of truth.
- `Docs Site.registry.json` was emitted as a smoke test; user should decide whether to commit it as an example or gitignore it.

## Execution Progress — phase-3.6-canvas-tsx-format (runtime slice, 2026-05-18)

Tasks 4–6 landed in second session of 2026-05-18 — TSX canvases now browser-loadable end-to-end (page mounts, useState round-trips, inspector reads data-cd-id).

- ✅ Task 4: `inspect.ts` upgraded — `SelectedElement.v: 1 | 2` schema (v=2 when click-target has an ancestor `data-cd-id`; v=1 fallback for legacy .html + shell chrome clicks). INSPECTOR_SCRIPT.elInfo() adds `id` via `closest('[data-cd-id]')`. Server-side `setSelected()` derives canvas slug from path. 3 new tests in `test/active-state.test.ts` (v=2 round-trip, v=1 fallback, slug derivation).

- ✅ Task 5: `canvas-edit.ts` + `bin/canvas-edit.sh` + `/design:edit` Step 3a. AST-aware single-attribute edits via oxc-parser + magic-string. Supports `className` swap/insert, `style.<prop>` swap/insert in inline ObjectExpression, plain string attrs (aria-label, etc.). Per-canvas mutex + atomic-rename write. Refuses to edit `data-cd-id` (pipeline-owned). CLI entry `bun canvas-edit.ts --invoke <canvas> <id> <attr> <value>` for `/design:edit` to shell out. 11 new tests in `test/canvas-edit.test.ts`. `edit.md` Step 3a documents the fast-path triggers (active = .tsx + selected.v=2 + single-element single-attribute feedback) and what it skips (steps 5 + 6 + 3.5 element-focused screenshot).

- ✅ Task 6: TSX canvases browser-loadable end-to-end. Five sub-deliverables:
  - `runtime-bundle.ts` — pre-built React 19 + ReactDOM + jsx-runtime bundles served at `/_canvas-runtime/<pkg>.js`. Per-package sub-bundles + cross-bundle externals (each bundle externalises the others; importmap stitches at browser-level → singleton React preserved). Dynamic export discovery via `await import(pkg)` enumerates ALL keys including `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` (required for ReactDOM to find React's shared internals — without it: `Cannot read properties of undefined (reading 'S')` on first createRoot). **NODE_ENV=production** baked in — the dev React variant trips a Bun.build CJS-rename collision (`Assignment to constant variable` on `import * as React`); production variant is collision-free + smaller. 6 tests in `test/runtime-bundle.test.ts`.
  - `canvas-build.ts` — wraps `canvas-pipeline.ts` (pass-1 data-cd-id injection) with a Bun.build pass that produces browser-loadable ESM. Virtual-loader plugin feeds the with-IDs source to Bun.build (filter uses suffix-match because macOS /tmp → /private/tmp symlinks defeat exact-path matching). React + jsx-runtime + ReactDOM externalised. 5 tests in `test/canvas-build.test.ts`.
  - `http.ts` — new routes `/_canvas-runtime/<slug>.js` (lazy-built, etag-cached, 304-aware) + `/_canvas-shell.html` (serves the static shell template). TSX-canvas route swapped from `transpileCanvasSource` direct → `buildCanvasModule` (the route's `js` body is now browser-loadable, not just parseable). Existing `canvas-route.test.ts` updated for Bun.build's `export { X as default }` form.
  - `plugins/design/templates/_shell.html` — shared canvas mount harness with importmap (`react`/`react-dom`/`react-dom/client`/`react/jsx-runtime`/`react/jsx-dev-runtime` → `/_canvas-runtime/*.js`), async dynamic-import of the canvas TSX, `createRoot(root).render(<Canvas/>)`. Query params `?canvas=<rel>` + `?designRel=<rel>` + optional `?tokens=` / `?components=`.
  - `plugins/design/templates/canvas.tsx.template` — JSDoc header projecting `.meta.json` (@canvas/@ds/@platform/@opt_out/@artboards/@brief/@stack/@history/@handoff) + envelope with DesignCanvas + DCSection + DCArtboard primitives inlined locally (handoff-friendly — no runtime dep on dev-server chrome).
  - `client/app.jsx` — `canvasUrl(p, cfg)` helper switches `.tsx` paths to `/_canvas-shell.html?canvas=…&designRel=…` while keeping `.html` on the legacy direct-load path. App fetches `/_config` once at boot + threads `cfg` into Viewport. Existing build (`bun run build.ts`) refreshed.
  - `/design:new` step 3 + 7 + 8 patched — default target now `.tsx`, validation accepts default-export React component + no `<!doctype>`, write step references the canvas.tsx.template. Legacy `.html` path kept for backwards compat until Task 8 codemod lands.

**Phase 3.6 acceptance gates verified this session:**
- Browser end-to-end: `/_canvas-shell.html?canvas=ui/Smoke%20TSX.tsx` renders `<div>` + `<h1>` + `<button>` with `data-cd-id` attrs in DOM; useState round-trips (clicking the button increments visible count).
- `bun test`: **69 pass / 0 fail** (up from 44 at end of Task 3 session).
- `bun tsc --noEmit`: clean for new files; only pre-existing api.ts(457,25)+(458,24) errors remain (confirmed not introduced this session).

**Deps added this session:** none (React + ReactDOM + @types/* were already in `plugins/design/dev-server/package.json` devDeps from Task 0; no new packages needed for Tasks 4–6).

**Files modified / added (Phase 3.6 runtime slice):**

- ADDED: `plugins/design/dev-server/canvas-build.ts` — Bun.build wrap on pipeline withIds source
- ADDED: `plugins/design/dev-server/canvas-edit.ts` — AST single-attribute editor
- ADDED: `plugins/design/dev-server/runtime-bundle.ts` — React 19 pre-bundles
- ADDED: `plugins/design/dev-server/bin/canvas-edit.sh` — CLI wrapper for /design:edit Step 3a
- ADDED: `plugins/design/dev-server/test/canvas-build.test.ts` (5 tests)
- ADDED: `plugins/design/dev-server/test/canvas-edit.test.ts` (11 tests)
- ADDED: `plugins/design/dev-server/test/runtime-bundle.test.ts` (6 tests)
- ADDED: `plugins/design/templates/_shell.html` — canvas mount harness with importmap
- ADDED: `plugins/design/templates/canvas.tsx.template` — TSX scaffold with JSDoc header
- ADDED: `.design/ui/Smoke TSX.tsx` — smoke fixture used to verify browser-load; safe to keep or delete
- MODIFIED: `plugins/design/dev-server/inspect.ts` — v=2 selection schema + data-cd-id reader
- MODIFIED: `plugins/design/dev-server/http.ts` — buildCanvasModule swap + /_canvas-runtime + /_canvas-shell routes
- MODIFIED: `plugins/design/dev-server/client/app.jsx` — canvasUrl helper + cfg loading + Viewport prop wiring
- MODIFIED: `plugins/design/dev-server/dist/client.bundle.js` + `styles.css` — rebuilt
- MODIFIED: `plugins/design/dev-server/test/active-state.test.ts` — +3 tests (v=2 round-trip, v=1 fallback, slug derivation)
- MODIFIED: `plugins/design/dev-server/test/canvas-route.test.ts` — accept Bun.build's `export { X as default }` form
- MODIFIED: `plugins/design/commands/edit.md` — new Step 3a documenting AST fast-path
- MODIFIED: `plugins/design/commands/new.md` — Step 3 + 7 + 8 default to `.tsx` (legacy `.html` path kept for backwards compat)

**Out-of-scope / carries to next session:**

- Tasks 7–12 unchanged from prior session note: handoff.ts + /design:handoff (shadcn registry-item.json), scripts/migrate-canvases.ts codemod + one-shot migration, sweep of remaining `.html` references in commands + skills, schema updates (canvas-meta.schema.json `css_mode` + `data-cd-id-version`, config.schema.json handoffTargets), e2e regression suite + token-cost measurement, AI-handoff polish (JSDoc header generator, CSS bundling in registry-item, /design:edit Step 1.5 auto-load _components.css for css_mode=inline canvases, `ai_context` meta schema field).
- **Performance budget gates** — not yet measured this session either; per-canvas TSX file size + transform cost + cold-load < 250 ms + HMR + token cost target should be sampled in Task 11 once the codemod produces realistic migrated canvases.
- HMR — not wired yet. `/_bun_hmr` endpoint still TODO (plan says "Bun 1.3's `import.meta.hot` + React Fast Refresh"). Currently a manual page reload is needed after editing a canvas TSX.
- Iframe Cmd+R reload behaviour — the `_canvas-shell.html` doesn't yet bust the canvas-module browser cache when its source changes; next session should add ETag-aware reload or `?v=<etag>` query.
- Dev-mode JSX runtime — Bun.build's collision in the dev React variant means production-mode React is used everywhere. Source-map quality + dev warnings are reduced as a consequence; revisit if/when Bun ships a fix (track via Bun's issue tracker).
- React-DOM bundle size is ~922 KB raw (no minify in dev). Plan target was ~25–35 KB gz total runtime — production minify + gz would close most of the gap. Not addressed this session.

## Execution Progress — phase-3.6-canvas-tsx-format (foundation slice, 2026-05-18)

- ✅ Task 0: DDR-019 written (`.ai/decisions/DDR-019-canvas-tsx-format.md`). Renumbered from plan's "DDR-017" because 017 + 018 were taken by Phase 3.5. DDR-019 reconciles with DDR-007: `data-cd-id` (transpiler-emitted, universal) and `data-dc-element` (author-emitted, semantic) coexist with documented inspector preference order. DDR index updated; 017 + 018 also indexed (were missing from README).
- ✅ Task 1: `plugins/design/dev-server/canvas-pipeline.ts` — two-pass transform via `oxc-parser` (parse) + `magic-string` (byte-range inject) + `Bun.Transpiler` (TSX→JS). ID = `Bun.hash(componentName + ":" + idx).toString(16).slice(0, 8)` — 8 hex chars, no `blake3-wasm` dep added (plan permitted Bun.hash). 15 bun:test cases green; covers determinism, whitespace-stability, sibling-insert contract, robustness (arrow components, JSXMemberExpression, idempotency on re-transpile of post-pass-1 source, malformed source → TranspileError).
- ✅ Task 2: `plugins/design/dev-server/locator.ts` — per-canvas `_locator.json` writer with per-path Promise-mutex + atomic rename. Top-level keyed by canvas slug (POSIX, ext-less, relative to designRoot). 14 bun:test cases green; covers roundtrip, multi-slug isolation, deterministic sorted-key JSON, 20-way concurrent multi-slug writes, 10-way concurrent same-slug last-writer-wins, clearLocatorSlug, malformed-JSON-as-empty.
- ✅ Task 3: `plugins/design/dev-server/http.ts` — TSX-route hooked into the existing fall-through `fetch()`. URL pattern `/.design/ui/<file>.tsx` (matches existing shell `urlOf()` helper that prefixes designRel into the iframe src). 200 + `application/javascript` + ETag (`Bun.hash(post-pass-1 source).toString(16)`); 304 on `If-None-Match` match; 500 + readable body on `TranspileError`; 404 / 403 on missing / traversal. In-memory `(absPath -> { mtimeMs, etag, js })` cache skips re-transpile when source unchanged. Locator is written synchronously before the response. 7 bun:test cases green.

**Deps added (workspace `plugins/design/dev-server/package.json`):**

- `oxc-parser ^0.131.0` (devDependency; ESTree-compatible TSX parser, ~1–3 ms for canvas-scale input)
- `magic-string ^0.30.21` (devDependency; byte-range edits, used by Rollup/Vite in production)
- Skipped `blake3-wasm` per plan permission — `Bun.hash` is 64-bit; sliced to 8 hex chars = 32 bits = ample for ≤300-element canvases.

**Validation status:**

- `bun test` — 44 pass / 0 fail across 10 files (the new 36 expects fold cleanly into the existing 8-file suite).
- `bun tsc --noEmit` — clean for new files. Pre-existing `api.ts(457,25)` error confirmed via stash-then-tsc — not introduced by this session.
- `bun run build.ts` — not re-run; route + pipeline run under bun source-mode. Should be re-built when Task 6 ships the runtime bundle that makes the JS browser-loadable.

**Out-of-scope / carries to next session:**

- **Browser-loadability of the route response.** `Bun.Transpiler.transformSync` output uses internal `jsxDEV_<hash>` symbol names meant for Bun's runtime — not browser-resolvable as-is. Task 6 (`_shell.html` + `/_canvas-runtime/react.bundle.js`) closes this; Tasks 0–3 stop at "valid JS by parse-check" (DDR-019 explicitly notes this — "making it BROWSER-loadable is the _shell.html + react-runtime bundle's job"). Tests verify the JS is re-parseable by `oxc-parser`; nothing more is promised this session.
- Tasks 4–12: inspector contract upgrade (data-cd-id reader in inspect.ts), `/design:edit` AST-aware element edits (canvas-edit.ts + bin/canvas-edit.sh), `_shell.html` + `canvas.tsx.template` + `/design:new` rewrite, `handoff.ts` + `/design:handoff` (shadcn registry-item.json sidecar), `scripts/migrate-canvases.ts` codemod + one-shot migration, sweep of `.html` refs across `plugins/design/commands/*` + skills, schema updates (`canvas-meta.schema.json.css_mode` + `data-cd-id-version`, `config.schema.json.handoffTargets`), e2e regression, AI-handoff polish (JSDoc headers, CSS bundling in registry-item, edit-context CSS auto-load).
- Performance budget gates from the plan (per-canvas TSX < 35 KB, two-pass < 8 ms p50, cold load < 250 ms, etc.) — not yet measured. Most are gated on Task 8 (codemod) producing real-world migrated canvases.

**Files modified / added (Phase 3.6 foundation):**

- ADDED: `plugins/design/dev-server/canvas-pipeline.ts`
- ADDED: `plugins/design/dev-server/locator.ts`
- ADDED: `plugins/design/dev-server/test/canvas-pipeline.test.ts`
- ADDED: `plugins/design/dev-server/test/locator.test.ts`
- ADDED: `plugins/design/dev-server/test/canvas-route.test.ts`
- ADDED: `.ai/decisions/DDR-019-canvas-tsx-format.md`
- MODIFIED: `plugins/design/dev-server/http.ts` — imports canvas-pipeline + locator; new `serveCanvasTsx()` + in-memory cache; dispatched from `fetch()` for `.tsx` under designRoot
- MODIFIED: `plugins/design/dev-server/package.json` — added `oxc-parser` + `magic-string` devDeps (`bun.lock` is gitignored)
- MODIFIED: `.ai/decisions/README.md` — indexed DDR-017, DDR-018, DDR-019

## Execution Progress — phase-3.5-dev-server-ui-ux-refresh (DONE 2026-05-17)

- ✅ Task 1-3 (design stage — CV-08/09/10 mocks; user signed off 2026-05-15)
- ✅ Task 4: index.html → JetBrains Mono fallback (Berkeley primary via token chain), Inter dropped
- ✅ Task 5: 1-tokens.css → project DS bridge (OKLCH paper-light + phosphor-dark + `--u-*` alias layer); zero hex literals remaining in chrome CSS; sibling-token roles audited (`--u-accent` → `--accent`, `--u-accent-bg` → `--accent-tint`, etc.)
- ✅ Task 6: Header + ThemeToggle component (Sun/Moon, localStorage-persisted) wired
- ✅ Task 7: Sidebar + Tree restyled to CV-08 — search "filter…" placeholder, section headers SKU-tracked uppercase, active-row hairline left edge + accent-tint bg (no pill), unread badge on `--accent` chip
- ✅ Task 8: Tabs + StatusBar slots — `StatusBarSlot` helper, slot order: ACTIVE | SELECTED | COMMENTS | LIVE | spacer | THEME; tabs got hairline-underline active treatment; ThemeToggle moved from Header → StatusBar per plan
- ✅ Task 9: SystemView (CV-09) — new live `TokenLadder` (reads `getComputedStyle`, MutationObserver re-reads on theme flip) + 8-step `TypeLadder` + SKU-framed header; CommentsPanel (CV-10) — uppercase mono tab labels with hairline-underline active state, hairline-divided item rows, accent-tint active pin, muted resolved
- ✅ Task 10: live smoke green — boot in <2 s, both themes round-trip via toggle, keyboard focus visible on tree + tabs + buttons (`--shadow-focus` 2 px accent ring); full a11y-auditor sweep deferred to `/flow:validate-a11y` at `/done`
- ✅ Task 11 (2026-05-15): paper-grid 24 px bg on `.viewport` via `--u-border-subtle` linear-gradient — visible behind empty-state, covered by iframe `--u-bg-0` once mounted
- ✅ Task 12 (2026-05-15): `<Wordmark>` empty-state watermark top-left (project + `v{__MDCC_VERSION__}` baked via `build.ts` `define` from `package.json` + `window.location.port`) + `<SelectionHalo>` accent 2 px outline + 4 corner ticks around active iframe when `selected && activePath !== SYSTEM_TAB`
- ✅ Task 13 (2026-05-15): StatusBar ARTBOARDS slot (live `tabs.length`) + ZOOM slot (static `100%`, tooltip "Pan/zoom in Phase 4"); slot order now ACTIVE · SELECTED · COMMENTS · ARTBOARDS · ZOOM · LIVE · spacer · THEME

**Files modified:**

- `plugins/design/dev-server/client/index.html` — fonts swap (T4)
- `plugins/design/dev-server/client/styles/1-tokens.css` — full rewrite (project DS + alias bridge) (T5)
- `plugins/design/dev-server/client/styles/3-shell.css` — sidebar/header/tabs/statusbar refactor; 5 hex literals removed (T6-T8); paper-grid `.viewport`, `.wm`, `.sel-halo`, `.sb-artboards`, `.sb-zoom` (T11-T13)
- `plugins/design/dev-server/client/styles/4-components.css` — system-view + comments panel refactor; 11 hex/rgba literals removed (T9)
- `plugins/design/dev-server/client/app.jsx` — `ThemeToggle`, `TokenLadder`, `TypeLadder`, `StatusBarSlot` components; theme state + localStorage round-trip (T6-T9); `Wordmark`, `SelectionHalo` components + `MDCC_VERSION` define ref; Viewport receives `project` + `selected`; StatusBar gains `tabsCount` + ARTBOARDS/ZOOM slots (T11-T13)
- `plugins/design/dev-server/build.ts` — `__MDCC_VERSION__` define populated from `package.json` at build time (T12)

**Validation status:** `bun run build.ts` green (client 3.4 MB raw / styles 49.7 KB after T11-T13); `bun tsc --noEmit` clean; biome clean; live dev-server boot OK against this repo's `.design/` on port 4421 (smoke: 200 on root/bundle/css, `/_health` OK, version `0.12.0` baked into bundle).

**Carry-over:**

- Modified-dot indicator (plan T7 spec) — no server data flow for "file modified since open", left out; would need fs-watch + diff against the canvas history snapshot.
- "Avatar + author" in comment items (plan T9 spec) — comment data model has no `author` field; deferred to a future schema migration.
- Full `/flow:a11y-auditor` cross-theme sweep — not run; recommended to invoke at `/flow:done`.
- `dev-server-shell-tour` scenario not recorded — recommended via `/flow:scenario new dev-server-shell-tour` before `/done`.
- Smoke against `/Volumes/D/git/dugmate/.design/` (canonical real-world example per plan §Validation step 8) — not run this session.
- DDR candidates per plan acceptance: (a) font hosting strategy (chose option-c JetBrains-Mono-only fallback; Berkeley Mono name kept in chain for users who have it locally), (b) token bridge approach (chose alias-layer + inline DS values rather than cross-`plugins/` `@import`).

**Last archived plan:** `.ai/plans/archive/feature-docs-site-mdcc-skin.md`
**Branch:** `main`

## Loaded skills (skill-loader)

Resolved 2026-05-12 via `/flow:maintain-docs` Step 3b → `flow:skill-loader` → `terminal-skills` MCP.

| Library / tech | Source | Slug | Notes |
| -------------- | ------ | ---- | ----- |
| Yjs | terminal-skills MCP | `yjs` | v1.0 collab backbone (Phase 8 LAN, Phase 9 hub). Covers Y.Doc / shared types / WebsocketProvider / awareness / IndexedDB offline. |
| Playwright | terminal-skills MCP | `playwright-testing` | Planned dev-only dep for visual regression (per PRD §Testing). Covers config, page objects, API mocking, visual snapshots, a11y axe integration. |

Still unresolved (no MCP match, no built-in skill):

- **Fumadocs** — Next.js-based docs site for v1.x. Fallback: WebFetch on https://fumadocs.dev when starting the docs-site phase.
- **Hocuspocus** — Yjs hub framework (Phase 9). The loaded `yjs` skill covers the WebSocket provider patterns; for Hocuspocus-specific server config (`@hocuspocus/server`, extensions, `onAuthenticate`), fallback to WebFetch on https://tiptap.dev/docs/hocuspocus when Phase 9 starts.
- **Next.js** (the framework itself) — no direct terminal-skills hit; closest tangents are `nextra`, `turbopack`, `ai-sdk`. Only needed when Fumadocs phase starts; defer.

Consider `/flow:make-skill-template` for **fumadocs** and **hocuspocus** if their use becomes load-bearing across multiple sessions.

## Decisions

- DDR-001 Monorepo with single npm publisher (Phase 1)
- DDR-002 Release flow via Changesets, with parity-preserving wrapper (Phase 1)
- DDR-003 `/flow:release` walks user-authored runbook instead of dispatching on provider (Phase 3)
- DDR-004 Flow commands use `<group>-<verb>` prefix; compat stubs shipped in v0.6.0, removed in v0.6.1 (Phase 13)
- DDR-005 Docs site stack — Fumadocs + Vercel; accept Fumadocs DS defaults (Phase 2)
- DDR-006 Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter (ad-hoc, 2026-05-13)
- DDR-007 Stable element-id schema — `data-dc-screen` + `data-dc-element` (Phase 13, 2026-05-15)
- DDR-008 `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers (Phase 13, 2026-05-15)
- DDR-010 `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel (Phase 14, 2026-05-15) [DDR-009 was claimed by the bun-runtime DDR mid-session]
- DDR-011 Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork (feature-docs-site-mdcc-skin, 2026-05-15)
- DDR-012 React 19 everywhere — shell and canvases share a single runtime (Phase 3.4, 2026-05-15)
- DDR-013 Server modular split into seven TypeScript modules on `Bun.serve` (Phase 3.4, 2026-05-15)
- DDR-014 CSS `@layer reset, tokens, layout, shell, components, utilities` + Lightning CSS at build time (Phase 3.4, 2026-05-15)
- DDR-015 Per-platform Bun binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Phase 3.4 Tasks 12-13, 2026-05-15)
- DDR-016 `plugins/design/dev-server/runtime/` is the canvas-runtime library home — runtime code, not meta-design (Phase 3.4 Task 1 audit, 2026-05-15)
- DDR-017 Dev-server shell = shadcn-style menubar + single-canvas viewport (tabs row killed) — Phase 3.5 mid-session pivot from action-button header after user pushback on "chrome not mocked" exemption (2026-05-17)
- DDR-018 Tree groups via `kind` discriminator (`project | canvas | runtime`) — server scans PROJECT root + RUNTIME gitignored alongside canvases; DS canvas group widens to non-HTML scan (2026-05-17)

## Blockers

- (none)

## History

| When | Phase | Note |
| ---- | ----- | ---- |
| 2026-05-12 | planning | PRD authored at `.ai/docs/PRD.md`; 8 phase plans generated. Start with `/flow:execute .ai/plans/phase-1-contribute-infra-changesets.md`. |
| 2026-05-12 | planning | Phase 1 expanded (Task 0: monorepo + pnpm workspaces; Task 8: GitHub repo via `gh` CLI). Phase 4 updated for esbuild + bundled `dist/server.bundle.mjs` + `dist/client.bundle.js` shipping pattern; `plugins/design/dev-server/package.json` becomes `"private": true` workspace. |
| 2026-05-12 | planning | Runtime research at `.ai/docs/research-runtime.md`. Decision: stay on Node 20+ for v1.0, defer Bun binary distribution to v1.1 (first off the icebox). Phase 4 constrained to runtime-agnostic `node:*` patterns. |
| 2026-05-12 | planning | Collab research at `.ai/docs/research-collab.md` (814 lines). Phase 8 scope cut to "ambient multiplayer" (Yjs + Awareness, no HTML co-editing). New Phase 9 created for v1.1 structured CRDT HTML co-editing (`data-cd-id` identity + Y.XmlFragment + AI diff-to-ops). Phase 0 spike (HTML↔Y.XmlFragment fidelity) is go/no-go gate for Phase 9. |
| 2026-05-12 | planning | Architecture pivot: user wants federated self-hostable hub, not LAN-peer-to-peer. Research overwritten (`.ai/docs/research-collab.md`, 1145 lines, new). **PartyKit rejected** (`partyserver` is CF-Workers-only). **Hocuspocus adopted** (MIT, Node-native, production-tested for TipTap Collab). Phase 9 renumbered → Phase 10 (v1.2 structured CRDT). New Phase 9 = self-hostable hub + bidirectional file sync (`mdcc hub serve|deploy`, `mdcc design link`). v1.1 ship target. |
| 2026-05-12 | planning | `/flow:maintain-docs` Step 3b → `flow:skill-loader` loaded `yjs` + `playwright-testing` skills from `terminal-skills` MCP. Fumadocs/Hocuspocus/Next.js framework still gaps (no MCP match) — recorded above under "Loaded skills". |
| 2026-05-12 | planning | Audit pass (2 Explore agents): 93% consistency, 16/16 user requirements covered. User decisions: (1) Phase 7 (ACP) → icebox; (2) apply all doc fixes now. Plus 3 scope refinements: (a) Phase 3 split — flow⇄design seam extracted to new Phase 11; (b) Phase 5 multi-DS reinterpretation (DS-as-attachment to `/design:new`, not runtime switcher) + extract layers + in-canvas CSS to new Phase 12 (end-of-roadmap extra feature); (c) Phase 8 file renamed `partykit` → `yjs-lan`. Phase 1 reserves `plugins/design/hub/` workspace. New `.ai/docs/config-schema.md` consolidates evolving config. Phase 9 gains migration section from Phase 8 LAN. |
| 2026-05-12 | Phase 1 | Started `/flow:execute phase-1`. Branch `infra/phase-1-contribute-changesets` cut from `main`. |
| 2026-05-12 | Phase 1 | Tasks 1–9 + DDR-001/002 landed. Local CI smoke green (lint/test/parity/tarball/changeset-status). Awaiting `/flow:done`. |
| 2026-05-12 | done | `/flow:done` — Phase 1 closeout. Plan archived; retro recorded; reverted out-of-scope biome JSX reformat at review gate. Next: Phase 2 (Fumadocs docs site) or Phase 3 (flow ↔ design changeset). |
| 2026-05-12 | Phase 3 | `/flow:execute phase-3` — schema + `/flow:release-changelog` + `/flow:release` + onboard auto-detect + de-hardcode + DDR-003. Worked directly on `main` (no branch cut, user's choice). Docs pages (Task 11) deferred to Phase 2. |
| 2026-05-12 | done | `/flow:done` Phase 3 — DDR-003 written, changeset queued (minor), retro recorded, plan archived. CLAUDE.md debrief skipped (no new convention). Next: Phase 2 (docs site) or any of Phase 4–10. |
| 2026-05-13 | Phase 13 | `/flow:execute` Phase 13 — 11 renames, 11 compat stubs (remove v0.6.0), category: frontmatter on 29 live commands, /flow:help aggregator, CATEGORIES.md catalog, README + plugin README + CLAUDE.md updates, 18-file reference sweep clean. 40 files in commands/ (29 live + 11 stubs). |
| 2026-05-13 | Phase 13 | Post-validate triple audit (3× Explore agents) caught a hidden-dir gap — original `rg` sweep skipped `.ai/`, `.github/`, `plugins/flow/.claude-plugin/`. Patched 22 leftover refs across 14 hidden-path files (`.ai/{README,INDEX}.md`, `.ai/{decisions,reviews,logs,context}/README.md`, `.ai/docs/{PRD,config-schema}.md`, `.ai/plans/{README,phase-11-…}.md`, `.ai/state/STATE.md`, `plugins/flow/.claude-plugin/config.schema.json`, `.github/ISSUE_TEMPLATE/docs.yml`). Final `rg --hidden` sweep clean. |
| 2026-05-13 | done | `/flow:done` Phase 13 — DDR-004 recorded (naming convention + v0.6.0 stub removal target), retro appended, plan archived to `.ai/plans/archive/phase-13-…`. Local commit only (no push, per user). |
| 2026-05-13 | Phase 2 | `/flow:execute phase-2` — scoped to Task 1–2 only (scaffold + core MDX) per user. Hosting choice: Vercel (DDR-005 to record at /flow:done). Tasks 3 (auto-gen command ref), 4 (schema renderer), 5 (search + llms.txt), 6 (deploy), 7 (README dedup) deferred to follow-up execute. |
| 2026-05-13 | Phase 2 | Commit `c81da3b` lands Task 1–2. Continued execute → Task 3–7 in one pass. Auto-gen command reference (37 pages) + schema reference + robots.txt + metadataBase fix + DDR-005 + site-deploy.yml workflow (inert pending Vercel secrets) + README trim 339→164. Build green; lint clean. Awaiting `/flow:done` for retro + archive. |
| 2026-05-13 | done | `/flow:done` Phase 2 — DDR-005 recorded (Fumadocs + Vercel + accept DS defaults), patch changeset authored (`.changeset/phase-2-docs-site.md`), retro appended (what worked / didn't / change-next-time / carry-overs), plan archived to `.ai/plans/archive/phase-2-docs-site-fumadocs.md`. Next: Phase 4–10 from the v1.0 roadmap (Phase 5 dep on Phase 4; Phase 11 dep on Phase 3 + 4; Phase 6/8/9/10 sequential). |
| 2026-05-13 | design-system-init | `/flow:execute` design-system-init.md — scoped to Phase 0–2 skeleton first, then user requested continuation through Phase 6. Commit `e7d7773` (Phase 0–2): rename `/design`→`/design:edit` + compat stub + sweep (22 files), inspiration library skeleton (24 files), skill `design-system` Bootstrap+Mode-detection sections, 3 new commands (setup-onboard/setup-ds/help) + CATEGORIES.md, pre-flight bootstrap hooks in edit/new, `mdcc design init` CLI subcommand (smoke-tested). Commit `852a25a` (Phase 3–6): `design-system-completeness-critic` agent w/ 3-tier rules + `--system-only` flag, multi-DS canvas wiring (canvas-meta `designSystem` field + `--ds=` flag w/ fail-on-unknown + flow:design-system-guard scoped to canvas DS), CLAUDE.md "Design system bootstrap" section (8 rules), Fumadocs narrative pages (bootstrap.mdx, categories.mdx, multi-ds.mdx, mdcc design init in cli.mdx). |
| 2026-05-13 | done | `/flow:done` design-system-init — validate green (passed with warnings, no hard fails), changeset authored (minor bump @1agh/md-claude), `.changeset/{config.json,README.md}` restored from git history (deleted post-v0.7.0), retro appended to plan with 5 "what worked" / 4 "what didn't" / 4 "change next time" bullets + carry-over list, plan archived to `.ai/plans/archive/design-system-init.md`. Open carry-overs: inspirational library expansion (~38 unwritten reference files), multi-DS `--all-ds` critic runtime testing, version bump to v0.8 (separate cycle). Total: 83 files net, ~3,600 insertions across 3 commits on `main` (no branch). |
| 2026-05-13 | ad-hoc | Plugin namespace + `setup-onboard` → `init` rename. No plan file; started from a `/flow:quick` trigger after a user-reported autocomplete collision between `/flow:resume` and the native `/resume`. Discovered Claude Code [#22063](https://github.com/anthropics/claude-code/issues/22063): plugin commands with `name:` frontmatter lose namespace prefix, registering as bare slugs. Workaround: prefix `name:` explicitly with `<plugin>:`. Verified empirically on `resume.md` first (autocomplete showed namespaced `/flow:resume`), then propagated to 77 plugin files (49 flow + 25 design + 3 incidental). Also renamed `/flow:setup-onboard` → `/flow:init` and `/design:setup-onboard` → `/design:init` (bare-verb exception to DDR-004's `<group>-<verb>` rule, mirroring Claude Code built-in `/init`). |
| 2026-05-13 | done | `/flow:done` plugin-namespace + init rename — commit 1 (`444afa5`) namespace fix (74 files), commit 2 follows with rename + cross-refs + DDR-006 + changeset. Total: 108 files net, ~190 insertions across 2 commits on `main`. No plan to archive (ad-hoc trigger). |
| 2026-05-15 | Phase 13 | `/flow:execute` Phase 13 started — stable element IDs (`data-dc-screen`/`data-dc-element`) + canonical screenshot pipeline (`screenshot.sh`) + 3 cheap helpers (`bootstrap-check.sh`, `server-up.sh`, `slug.sh`) + `data-artboard-id` selector bug fix. 22 tasks in 4 waves. |
| 2026-05-15 | Phase 13 | All 22 tasks completed in single execute pass. 14 files modified, 5 new helpers in `dev-server/bin/` (244 lines deleted, 212 added — net ~30 line reduction despite adding ~600 LOC of helpers because callers shrank dramatically). Grep audit clean: 0 inline `agent-browser` invocations, 0 server-lifecycle bash, 0 slug bash, 0 stale `data-artboard` selectors. Live smoke green against `Canvas Viewport.html`. Awaiting `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 13 — validate green with soft warnings → addressed (DDR-007 element schema, DDR-008 bin/ helper home, minor changeset for Phase 13). Retro appended. Plan archived to `.ai/plans/archive/phase-13-stable-element-ids-and-canonical-screenshots.md`. Local commit on `main`, no push (per session). |
| 2026-05-15 | Phase 14 | `/flow:execute` Phase 14 — design-system-keeper agent + pattern priors envelope + token-usage doctrine. 7 tasks: T1 Token usage guide section in DS README, T2 new agent (read-only `Read,Bash,Glob,Grep`), T3 `commands/new.md` envelope `## Pattern priors` + step 9.5 invocation, T4 `commands/edit.md` step 7.5 (conditional) + step 8a DS-drift fast-path + `--skip-ds-keeper` flag, T5 CLAUDE.md pattern-lift rule (127 lines), T6 DDR-010 (DDR-009 collision with bun-runtime DDR caught at validation, renamed), T7 CATEGORIES.md auto-routed-agents cross-reference section. T1 + T5 bundled into user's parallel commits (`3d663e6`, `16af2b6`); remaining 5 files committed by `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 14 — DDR-010 written, retro appended (3 wins / 3 misses / 3 process improvements), action checklist in retro source ticked to `[x]`, plan archived to `.ai/plans/archive/phase-14-design-system-keeper-pattern-priors.md`. Open carry-over: scratch-project smoke run of `/design:new` to verify ds-keeper fires + reports findings on a deliberately-drifty input. |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 — scoped to fundament-only per user: DDR-012 pivot (React 19 unified, supersedes hybrid Preact+React draft), Task 1 audit (runtime/ verdict = canvas-runtime library, not meta-design — DDR-016), Task 2 (Bun toolchain + react/lightningcss devDeps + scripts), DDR-013 (server modular split + TS), DDR-014 (CSS @layer + Lightning CSS). 5 DDRs landed + dev-server/package.json + root engines.bun=>=1.3 + STATE.md updated. Tasks 3-16 deferred to follow-up execute sessions. Parallel to feature-docs-site-mdcc-skin (awaiting-done). |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 follow-up — Tasks 3-16 implementation pass in one session. Highlights: `build.ts` Bun-driven orchestrator (client + Lightning CSS + per-platform compile + --watch HMR broadcast); React 18 UMD → React 19 esm in `app.jsx` (216 KB raw / 69 KB gz under 80 KB budget); `index.html` rewritten to bundle-loading (no more babel-standalone CDN); `styles.css` split into 6 `@layer` files under `client/styles/`; `server.mjs` (1288 LOC) rewritten as 7 TypeScript modules on `Bun.serve` (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts + mem.ts auxiliary; 1963 total LOC; bun tsc --noEmit clean); native WS handlers (drops handwritten RFC-6455 upgrade); `mem.ts` FinalizationRegistry + heap-watch; `client/hmr.mjs` CSS-only live reload; `client/iframe-lazy.mjs` IntersectionObserver lazy mount + content-visibility wrappers; 7 `bun:test` smoke tests (8 pass) + perf harness; postinstall-hardlink distribution pattern (`cli/install.cjs` writes side-channel file `cli/.platform-binary-path`, `design.mjs` execs binary direct — pragmatic deviation documented in DDR-015 since full bun-CLI port is deferred); 7 sub-package manifests under `packages/md-claude-<slug>/`; root `package.json` `optionalDependencies` pin all 7; `mdcc-safe` `--ignore-scripts` fallback; `.github/workflows/build-binaries.yml` 7-platform fail-fast matrix with `publish-main needs: build-binaries`; `scripts/check-version-parity.sh` + `bump-version.sh` extended to cover sub-packages + optionalDependencies pin parity; DDR-015 written; Phase 4 + Phase 3.5 plan footers reconciled with the new pipeline. Live smoke: server.ts boots in < 200 ms on this repo, all endpoints return correct JSON, `mdcc-darwin-arm64` standalone binary compiles in ~100 ms (57 MB; under 80 MB budget). |
| 2026-05-15 | done | `/flow:done` feature-docs-site-mdcc-skin — pre-existing CI Quality red since v0.12.0 (package.json tabs vs biome's space convention) surfaced + fixed in separate commit `5c8932c` (chore: biome format drift). Static gates green (types / lint / build / 7 node:test / token sync / stats drift). 4 scenarios written + run via `flow:scenario-runner` (agent-browser 0.27.0, web-desktop+web-mobile): blockers=0, parity_ok=true, but 8 follow-ups including 3 real bugs (numbered h2 ::before counter rule unmatched, mobile theme toggle 0×0/unreachable, cmd-K backdrop blur). `flow:design-system-guard` returned BLOCK (6 blockers: glassmorphism, BMC stock PNG, Lucide Coffee in nav, h2 selector miss, mobile toggle, cmd-K SVGs). `flow:a11y-auditor` returned BLOCK (3 WCAG fails: 2.4.7 focus rings, 2.1.1 mobile toggle, 2.4.1 skip-link). `flow:review-code` PASS WITH SUGGESTIONS (12 items, none release-blocking; `<dt>`/`<dd>` outside `<dl>` in page-meta-footer + build-stats brittleness are strongest patch candidates). Per user closeout decision: accept as known issues, ship + follow-up plan rather than return to /execute. Follow-up plan written at `.ai/plans/feature-docs-site-followups.md` (21 items across 3 commits). Retro appended to docs-site plan. Plan archived. No new commit during /done (feature commits already on main via 78d9d8f + 94b4e77; only format-drift fix 5c8932c added). Carry-overs: implement followups plan; investigate agent-browser daemon stability (a11y agent fell back to static-only due to `os error 35`); decide DDR-011 amendment vs new DDR for "Lucide-in-chrome scope" + "mobile theme toggle strategy". |
| 2026-05-15 | done | `/flow:done` Phase 3.4 — validate gates green (parity / tsc / 8 smoke tests / release build with 66 KB gz bundle / 57 MB binary / live boot OK). Two runtime bugs caught + fixed during user smoke and folded into the same commit: (a) `Bun.build` `format:'iife'` + `minify:true` triggers TDZ in React 19 internals → switched to `format:'esm'` + `<script type="module">` (66 KB gz, even better than IIFE was), (b) `app.jsx` had `useCallback`-declared `startDraftFromSelection` / `startDraftFor` AFTER the `useEffect` that references them via deps — fine under babel-standalone runtime eval, real TDZ under ESM build; moved declarations above. Also fixed minor `inspect.ts` bug: `Bun.write(.keep)` was a misguided "ensure dir exists" — Bun.write creates parent dirs automatically — removed + added artifact to .gitignore. Biome auto-fix landed across 7 TS files (template literals + non-null assertion cleanup); remaining 27 findings are intentional (`any` on bus payloads + WS msg decoder, `let foo` patterns) — same exemption posture as the existing JSX. Changeset queued (minor bump). Pragmatic deviation from plan T12 (full bun-CLI port) documented in DDR-015 — only `mdcc design serve` hot path execs the native binary today; cold-path subcommands (init/config/version) keep Node dispatcher; tracked as v1.0 follow-up. Single commit on `main`: `61d9e9d`. Plan retro appended + archived to `.ai/plans/archive/phase-3.4-architecture-refactor.md`. Carry-overs: 8h soak test, cross-platform binary smoke beyond darwin-arm64, --smol runtime honor verification, `iframe-lazy.mjs` wiring into `app.jsx` (Phase 4 viewport rewrite), full CLI bun-port (v1.0), `api.ts` / `inspect.ts` LOC split. Eight pre-existing `MM` staged files from prior parallel sessions (biome.json + site/* + dev-server/bin/_screenshot-playwright.mjs) were surgically excluded via `git reset HEAD` + per-file `git add` — index now clean of any non-3.4 content; their working-tree changes ended up matching HEAD so nothing was lost. |
| 2026-05-15 | Phase 3.5 | `/flow:execute` Phase 3.5 — Tasks 4-10 implementation pass after the user-signed-off design stage (CV-08/09/10 in `.design/ui/Canvas Viewport.html`). Token bridge: full rewrite of `client/styles/1-tokens.css` with project DS OKLCH paper-light + phosphor-dark blocks inlined (decided against cross-`plugins/` @import for fragility) + a `--u-*` alias layer with sibling-token roles audited per CLAUDE.md memory; all chrome CSS now passes `grep -E '#[0-9a-f]{3,6}|rgba?\(\s*[0-9]'` zero. Chrome refactor: ghost-button `.actions` row, mono SKU-framed sidebar with hairline section dividers, hairline-underline tabs (no pills), `StatusBarSlot` helper + new slot row (ACTIVE / SELECTED / COMMENTS / LIVE / spacer / THEME); ThemeToggle component shows the destination icon (Sun↔Moon) and persists to `localStorage('mdcc-theme')`. SystemView (CV-09): added live `TokenLadder` reading `getComputedStyle(documentElement)` for 21 named tokens with a `MutationObserver` on `data-theme` to re-read on flip, plus a `TypeLadder` rendering the 8-step ladder at actual size. CommentsPanel (CV-10): tabs row got SKU-tracked mono labels with active-underline + accent counter chip; comment rows are hairline-divided, accent-tint background on active pin with left-edge accent border, muted resolved (kept opacity 1 + `--fg-2`). Validation: `bun run build.ts` green (client 3.4 MB raw / Lightning CSS 47.8 KB) — Lightning CSS produced 47.8 KB minified styles, both themes round-trip via the toggle, `bun tsc --noEmit` clean, focus rings visible via Tab navigation. Live screenshots in `/tmp/phase-3.5-shots/` confirm: dark theme catalog-stamp visual, light paper-cream equivalent, real canvas iframe inside the new shell, system view token grid. Awaiting `/flow:done`. |
| 2026-05-15 | Phase 3.5 | `/flow:plan` addendum (rev 1, then trimmed) — user first wanted "připravte layout, Phase 4 ať jen předělá render engine" → I expanded 3.5 with 6 functional tasks (pan/zoom, MiniMap, ZoomToolbar, layout.json, tab semantics, perf smoke). User then clarified: *"funkcionalita kanvasu patří do Phase 4 ať se to nepřekrývá; teď jen shell UX a UI iterace podle design návrhu."* **Trimmed Phase 3.5 to 3 visual-only tasks: T11 paper-grid bg on `.viewport`, T12 `<Wordmark>` empty-state + `<SelectionHalo>` accent corner-ticks around iframe, T13 StatusBar `ARTBOARDS` (live count) + `ZOOM` (static 100% placeholder with tooltip).** Phase 4 expanded back to 7 tasks covering the whole canvas-functionality block as one coherent rewrite: T1 multi-iframe plane refactor, T2 pan/zoom controller, T3 MiniMap + ZoomToolbar interactive, T4 tab semantics change, T5 layout.json persistence + default-grid migration, T6 perf-prototype DDR, T7 Pixi engine swap + LoD + world coords + perf gate close. Both plans now don't overlap — Phase 3.5 paints around the canvas, Phase 4 owns how the canvas works. |
| 2026-05-17 | Phase 3.5 | `/flow:execute` continuation — Tasks 11-28 implementation pass after user comparison against CV-08 mock revealed gaps. T11-T13 (paper-grid + Wordmark + SelectionHalo + StatusBar slots) landed first. Then mid-session pivot: T14-T17 menubar component (shadcn-style File/Edit/View/Selection/Tools/Help + state stamp) replacing the action-button header, tabs row killed entirely (single-canvas model) — codified as DDR-017. T18 fixed body-grows scrollbar bug (`grid-template-columns: minmax(0, 1fr)`). T19-T20 rewrote sidebar tree to CV-08 spec (tree-panel-hd + sections + pill counter + tp-row.dir/.sel modifiers + files-first ordering). T21-T24 extended `api.ts:buildIndexData` with PROJECT (root `.md`/`.json`) + RUNTIME (gitignored `_*`) groups via new `kind` discriminator (DDR-018), DS canvas group widened to non-HTML scan, dir-wrapper rendering. T25-T28 added sidebar visibility toggle (View > Project Tree, T key), Help modal (Cheatsheet relocated from sidebar, `?`/`F1`), DS section header clickable (replaces dropped promoted button). Post-validate user reported View dropdown invisible — root cause `.mb { overflow: hidden }` clipping the `top: 30px` absolute dropdown; fix moved clip responsibility to `.mb-status` only. 25+ visual comparison screenshots captured during iteration (`/tmp/phase-3.5-audit/`, `/tmp/menubar-bug/`). Awaiting `/flow:done`. |
| 2026-05-17 | done | `/flow:done` Phase 3.5 — validate green (TS clean, build 3.47 MB client / 56.7 KB CSS, biome clean on touched files, dev-server live). DDR-017 + DDR-018 written. Changeset queued (minor). Plan retro appended + archived to `.ai/plans/archive/phase-3.5-dev-server-ui-ux-refresh.md`. Single feat commit on `main`. Carry-overs: `dev-server-shell-tour` scenario unrecorded; full `flow:a11y-auditor` formal run not done (ARIA verified manually + keyboard surface expanded with T/S/?/F1); smoke against `/Volumes/D/git/dugmate/.design/` not run; ★ star + ● modified file row indicators need data backend (favorites list + fs.watch tracking); `SECTION_META.ds` hardcodes `MDCC-DSN/01` pill — should read from project config when md-claude dev-server runs in other repos. |

## Execution Progress

### feature-docs-site-mdcc-skin — execute complete (2026-05-15)

- [x] T1: Copy MDCC tokens into site + sync script ✅ (`site/app/mdcc-tokens.css`, `site/scripts/sync-mdcc-tokens.mjs`, `pnpm sync:tokens` + `sync:tokens:check`)
- [x] T2: Swap Inter → JetBrains Mono via next/font/google ✅ (`site/app/layout.tsx` — variable `--font-mdcc-mono`, `mdcc` class + `data-theme="light"` on `<html>`)
- [x] T3: `--color-fd-*` bridge in `site/app/global.css` ✅ (overrides for 17 fumadocs slots, mapped to MDCC `--bg-*`/`--fg-*`/`--accent`)
- [x] T4: MDCC nav chrome in `lib/layout.shared.tsx` ✅ (JSX nav title + Docs/Plugins/Source links)
- [x] T5: `<SkuLabel>` component + base MDCC CSS (.mdcc-sku, .mdcc-wm, .mdcc-nav-link, .mdcc-skip-link) ✅
- [x] T6: `(home)/page.tsx` rebuilt — Hero + CatalogGrid + MetaFooter inline ✅
- [x] T7: `<CodeBlock>` MDX renderer with filename strip + copy button ✅ (`site/components/mdcc/code-block.tsx`)
- [x] T8: `<Callout>` MDX renderer with ASCII glyphs (`?`, `!`, `▲`, `★`) ✅
- [x] T9: Docs shell extras — `<SkuBreadcrumb>` + CSS-counter h2 numbering + `<PageMetaFooter>` ✅
- [x] T10: Sidebar + TOC + prev/next pager re-skin (pure CSS in global.css) ✅
- [x] T11: Cmd-K palette re-skin (CSS targeting Orama dialog selectors) ✅
- [x] T12: Theme parity — `html.dark.mdcc` selector (specificity 0,2,1) wins over `.mdcc[data-theme="light"]` (0,2,0); mirrors all MDCC dark tokens ✅
- [x] T13: Inter removed; `appName` kept (still used by OG image route) ✅
- [x] T14: DDR-011 written + indexed in `.ai/decisions/README.md` ✅

**Validation:**
- `pnpm types:check` ✅ green
- `pnpm lint` ✅ green on all touched files (12 files clean)
- `pnpm build` ✅ green — 169 static routes prerendered, 0 warnings, Turbopack 3.6s

**Carry-over:**
- Visual diff vs 4 artboards (DS-01..DS-04) NOT yet run — `/flow:validate` step that needs `flow:scenario-runner`. Recommended before `/flow:done`.
- `design-system-guard` + `a11y-auditor` scenario runs pending — both from `/flow:validate`.
- Cmd-K type-specific glyphs documented in DDR-011 as deferred (fumadocs 16.8.10 doesn't expose result-type metadata).

### Phase 13 — Stable element IDs + canonical screenshots + cheap helpers — execute complete (2026-05-15)

- [x] Wave A: runtime + inspector (Tasks 1, 2) — `data-dc-screen` on DCArtboard; inspector `cssPath`/`domPath` prefer data-dc-* attrs ✅
- [x] Wave B: helpers (Tasks 3, 4, 15, 16, 17) — `screenshot.sh` + `_screenshot-playwright.mjs` + `bootstrap-check.sh` + `server-up.sh` + `slug.sh` self-test green ✅
- [x] Wave C: callers refactor (Tasks 5–13, 18, 19, 20) — `screenshot.md` / `new.md` / `edit.md` / `setup-ds` SKILL / design SKILL / 2 critics / CATEGORIES.md / CLAUDE.md; envelope directive 15 (element tagging); `data-artboard-id` selector sweep ✅
- [x] Wave D: packaging + audit (Tasks 21, 22) — npm pack ships all 5 helpers via existing `files: ["plugins/design/dev-server"]` (no edit needed); grep audit zero hits for screenshot/bootstrap/server/slug inline duplicates ✅

Live smoke against repo (`Canvas Viewport.html`, 10 artboards): `screenshot.sh --all-screens` captured 10/10 PNGs (55 KB first); `--full` 5 KB; `--screen idle` 42 KB; `bootstrap-check.sh` 0/10/11 exit codes verified across 3 project states; `server-up.sh` alive-detect + stale-respawn green.

Manual smoke deferred: end-to-end `/design:setup-ds → new → edit` in scratch project (Task 22 plan-step) — recommended pre-`/done`.

### design-system-init — Phase 0–6 complete (this execute)

- [x] Phase 0: rename `/design` → `/design:edit` + compat stub + plugin sweep ✅
- [x] Phase 1A: inspiration library skeleton (24 files at `plugins/design/templates/design-system-inspiration/`) ✅
- [x] Phase 1B: SKILL.md `design-system` extended with Bootstrap flow + Mode-detection; copy-tree rename hook; `package.json` files += templates ✅
- [x] Phase 2A: setup-docs rename, `category:` on all 12 commands, new commands (`help`, `setup-ds`, `setup-onboard`), `CATEGORIES.md` ✅
- [x] Phase 2B: missing-state hooks in `edit.md` + `new.md` (auto-invoke onboard → bootstrap) ✅
- [x] Phase 2C: `mdcc design init` CLI subcommand (Core scaffold from inspiration library) ✅; schema extended forward-compat (Phase 3/4 fields) ✅
- [x] Phase 3: `design-system-completeness-critic` agent (3-tier rules — Core/Conventional/Free-form, adaptive by `activeFamilies` + `completenessProfile`); `commands/critic.md` += `--system-only` flag + short-circuit; skill bootstrap flow wires the critic at scaffold end ✅
- [x] Phase 4: multi-DS canvas wiring — `canvas-meta.schema.json` += `designSystem` + `opt_out_scope` fields; `commands/new.md` parses `--ds=` flag with validation + fail-with-hint on unknown DS; `flow:design-system-guard` scoped to canvas DS (reads `.meta.json.designSystem`) ✅
- [x] Phase 5: CLAUDE.md "Design system bootstrap" section (8 rules: onboard-before-bootstrap, one-skill-owns-DS, 3-sub-modes, inspiration-not-substrate, dynamic-scaffold-count, literal-project-dirname, 3-tier-compliance, daily-verb-is-edit) ✅
- [x] Phase 6: Fumadocs narrative pages — `design/bootstrap.mdx`, `design/categories.mdx`, `design/multi-ds.mdx`; `design.mdx` → `design/index.mdx` (folder pattern); `cli.mdx` += `mdcc design init` section ✅

**Open carry-over for follow-up release:**

- Inspiration library is **skeleton only** (Core 10 + Universal 6 = 16 specimens populated). `foundations/` (8), `status/` (3), `audience-*/` (5–6 per branch), `platform-*/` (2–5), `theme-both/` (1), `patterns/` (6), `meta/` (4) — total ~38 additional reference files — are stubs documented in `_MAPPING.md` but not yet authored. Single-DS minimum-viable scaffold works today; richer scaffold awaits next library pass.
- Site `categories.mdx` mentions `--all-ds` for the critic — flag exists in critic.md spec but the actual loop logic in the critic agent's pre-flight is described, not yet runtime-tested against a real multi-DS project (no production multi-DS users yet).
- Version bump (Phases 0–6 ship together as v0.8 minor) — separate cycle.

### Phase 2 — Tasks (Fumadocs docs site)

- [x] Task 1: Scaffold Fumadocs in `site/` ✅ — manual `npm create fumadocs-app` by user, then integrated into pnpm workspace (`@md-claude/site`), `esbuild`+`sharp` allow-listed, build green
- [x] Task 2: Author core MDX pages ✅ — `index`, `getting-started`, `cli`, `flow`, `design`, `config`, `recipes/{nextjs,expo,monorepo}` + sidebar `meta.json`s; home page updated; `test.mdx` removed
- [x] Task 3: Auto-generate command reference ✅ — `site/scripts/build-command-reference.mjs` walks `plugins/{flow,design}/commands/*.md` and emits 37 per-command MDX pages under `content/docs/reference/{flow,design}/<name>.mdx`. Wired as `prebuild`. Output is gitignored.
- [x] Task 4: Render config schema as typed MDX ✅ — `site/scripts/build-schema-reference.mjs` walks `config.schema.json` recursively, emits `content/docs/reference/config-schema.mdx` with every key, type, default, enum, description.
- [x] Task 5: Search + `llms.txt` polish ✅ — Fumadocs default scaffold ships Orama search + `/llms.txt` + `/llms-full.txt` + `/llms.mdx/docs/*`; added `/robots.txt` + root `metadata` (fixes Next `metadataBase` warning).
- [x] Task 6: Deploy infra ✅ — DDR-005 (`docs-site-stack-and-hosting.md`) + `.github/workflows/site-deploy.yml`. Custom domain: `md-claude.iagh.cz` (subdomain of team-owned `iagh.cz`). Vercel project `md-claude` in team `Slant` (slug `iagh`).
- [x] Task 7: README de-dup vs docs site ✅ — root `README.md` trimmed 339 → 164 lines. Flow + design command tables removed (now at `/docs/flow`, `/docs/design:edit`); kept quickstart + workspaces + releasing + local-dev (contributor info).

**Carry-over (out of plan scope):**

- Design plugin commands lack `category:` frontmatter → all 8 show as "uncategorized" in auto-gen reference. Cosmetic; align in a follow-up cleanup pass.
- Recipes (Next.js / Expo / monorepo) are documented but not tested end-to-end against fresh repos per Acceptance criterion 4 — needs a manual smoke run after deploy.


### Phase 13 — Tasks (flow command categorization)

- [x] Task 1: `plugins/flow/CATEGORIES.md` — canonical catalog with 9 groups, naming convention, rename history ✅
- [x] Task 2: 11 `git mv` renames + `name:` field updates ✅
- [x] Task 3: `category:` frontmatter on all 29 live commands; `name:` normalized to match filenames ✅
- [x] Task 4: Reference sweep (18 files updated, 0 stale refs remaining outside plan/CATEGORIES/archive/help.md) ✅
- [x] Task 5: 11 backwards-compat stubs under old filenames (shipped in v0.6.0, removed in v0.6.1) ✅
- [x] Task 6: `/flow:help` aggregator command authored ✅
- [x] Task 7: Root `README.md` regrouped + `plugins/flow/README.md` created with naming convention ✅
- [x] Task 8: `CLAUDE.md` — new "Flow command naming" subsection under Architecture ✅
- [x] Task 9: Phase 3 alignment verified (`release-changelog` + `release` ship at final names) ✅
- [ ] Task 10: Phase 2 docs-site flow page — **carry-over** (out of scope here)

### Phase 3 — Tasks (flow changelog integration + /flow:release)

- [x] Task 1: Schema — `integrations.changelog` (provider/scope/releaseGuide/mcp/defaults) ✅
- [x] Task 2: Skeleton default `{changelog: {provider: none}}` ✅
- [x] Task 3: `/flow:release-changelog` command (changesets impl + stub for others) ✅
- [x] Task 4: `/flow:validate` Step 7b — non-blocking changelog hygiene ✅
- [x] Task 5: `/flow:done` Step 4b — overridable changelog reminder ✅
- [x] Task 6: DDR-keeper SKILL.md — provider-choice is DDR-worthy ✅
- [x] Task 7: De-hardcoded `changeset` in `execute.md:179` + `quick.md:37` ✅ (grep clean)
- [x] Task 8: `release-guide.md` template + `mdcc init --provider` propagation ✅ (smoke-tested 4 providers)
- [x] Task 9: `/flow:setup-onboard` Q7 auto-detect + scaffold ✅
- [x] Task 10: `/flow:release` runbook walker ✅
- [ ] Task 11: Docs pages — **deferred** (Phase 2 site dependency, tracked as carry-over)

### Phase 1 — Tasks

- [x] Task 0: Monorepo + workspace bootstrap ✅ tarball shape clean (42 files), parity OK
- [x] Task 1: CONTRIBUTING + CoC + SECURITY ✅ (CoC links Contributor Covenant 2.1)
- [x] Task 2: PR + issue templates ✅ (PULL_REQUEST_TEMPLATE.md + ISSUE_TEMPLATE/{bug,feature,docs,config}.yml)
- [x] Task 3: Wire Dependabot ✅ (.github/dependabot.yml — npm + actions, weekly, grouped)
- [x] Task 4: Bootstrap Changesets ✅ (config + Phase 1 changeset queued; status reports minor)
- [x] Task 5: Version wrapper preserving parity ✅ (scripts/changesets-version.sh)
- [x] Task 6: Quality CI workflow + argv test ✅ (biome + 7 argv tests passing; dev-server JSX excluded — pre-existing debt)
- [x] Task 7: Update publish workflow ✅ (build → publish → GH Release from CHANGELOG)
- [x] Task 8: GitHub repo via gh CLI ✅ (script + JSON payloads + CODEOWNERS + auto-merge-dependabot workflow). Script not yet **applied** to live repo (gated — needs maintainer to run).
- [x] Task 9: Update README ✅ (Workspaces section, reauthored Releasing, new Repo administration section)
- [x] DDR sweep: DDR-001 + DDR-002 written

### phase-3.4-architecture-refactor — fundament partial (2026-05-15)

> Scope this session: DDR groundwork + Task 1 audit + Task 2 deps. Tasks 3-16 (build pipeline, client migration, server rewrite, CSS @layer files, HMR, lazy iframes, perf harness, postinstall pattern, CI matrix, plan updates) deferred to follow-up `/flow:execute` sessions.

- [x] **DDR-012** — React 19 everywhere ✅ (`.ai/decisions/DDR-012-react-19-unified-runtime.md` — supersedes the hybrid Preact+React assumption; relaxes perf budgets to bundle < 80 KB, RAM < 80 MB, first paint < 350 ms)
- [x] **Task 1** — Audit `runtime/` folder ✅ (verdict: canvas-runtime library injected into user HTML pages via `/_runtime/*`, NOT meta-design. Plan hypothesis re: commit `5864f71` was wrong — actual origin is `b200e59`.) → **DDR-016** landed
- [x] **Task 2** — Bun toolchain deps ✅ (`plugins/design/dev-server/package.json` rewritten — `@types/bun`, `react ^19`, `react-dom ^19`, `@types/react ^19`, `@types/react-dom ^19`, `lightningcss ^1.27` in devDependencies; `build`/`build:watch`/`test`/`typecheck` scripts; root `package.json` `engines.bun = ">=1.3"`. No `pnpm install` / `bun install` run yet — defer to Task 3 session to avoid lockfile drift mid-refactor.) Bun 1.3.3 verified locally.
- [x] **DDR-013** — Server modular split + TypeScript ✅ (`.ai/decisions/DDR-013-server-modular-split-typescript.md` — 7 modules (`server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`) + `mem.ts` auxiliary; ≤ 300 LOC each; Context-object communication; no module-level mutable state)
- [x] **DDR-014** — CSS @layer architecture ✅ (`.ai/decisions/DDR-014-css-layer-architecture.md` — `reset, tokens, layout, shell, components, utilities`; Lightning CSS at build time; DS token import via `1-tokens.css`)
- [x] **DDR-016** — `runtime/` folder verdict ✅ (`.ai/decisions/DDR-016-runtime-folder-purpose.md` — canvas-runtime library; renamed `.jsx` → `.tsx` in Task 7; IIFE bundle registers `window.*` globals for backward-compat with user HTML pages)
- [x] **DDR README + DDR-009 update** ✅ (DDR-README index now lists DDR-012/013/014/016; DDR-009's "Companion DDRs" footer renumbered from the old DDR-010..014 numbering to actual DDR-012..016)
- [x] **Task 3** — `build.ts` Bun-driven orchestrator ✅ (client `Bun.build` IIFE + Lightning CSS + per-platform `bun build --compile` + `--watch` HMR broadcast + `--dry-run` smoke)
- [x] **Task 4** — `app.jsx` UMD React → React 19 esm ✅ (`import { ... } from 'react'` + `createRoot` from `react-dom/client`; release bundle 216 KB raw / 69 KB gz — under 80 KB budget)
- [x] **Task 5** — `index.html` bundle-loading ✅ (no more unpkg babel-standalone / UMD)
- [x] **Task 6** — `client/styles/` 6 `@layer` files + Lightning CSS ✅ (0-reset / 1-tokens / 2-layout / 3-shell / 4-components / 5-utilities; `_index.css` declares layer order; output 25 KB minified)
- [x] **Task 7** — `server.mjs` → 7 TS modules on `Bun.serve` ✅ (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts factory base + mem.ts; 1963 LOC total; `bun tsc --noEmit` clean; native WS drops handwritten RFC-6455 upgrade; live boot returns correct JSON on /_health /_config /_index-data /_system-data)
- [x] **Task 8** — `mem.ts` ✅ (FinalizationRegistry + WeakMapById + startHeapWatch with warn/panic thresholds; --smol embedded into `bun build --compile`)
- [x] **Task 9** — `client/hmr.mjs` ✅ (CSS-only path zero-risk reload via `<link>` cache-busting; JSX path full-page reload until react-refresh-runtime is wired in Phase 3.5)
- [x] **Task 10** — `client/iframe-lazy.mjs` ✅ (IntersectionObserver mount + content-visibility wrapper + 30s-idle detach + state stash)
- [x] **Task 11** — perf harness + 7 `bun:test` smokes ✅ (server-lifecycle / ws-handshake / active-state / history-rollback (2 tests) / fs-watch / bundle-smoke / binary-smoke; `bun test` = 8 pass 0 fail in 1.6 s; `test/perf-harness.ts` measures cold start + gz bundle + WS p50/p99)
- [x] **Task 12** — postinstall-hardlink distribution ✅ (pragmatic deviation per DDR-015 — `cli/install.cjs` writes `cli/.platform-binary-path` side channel, `design.mjs` execs binary directly for `mdcc design serve` hot path; `mdcc.exe` stub + `mdcc-safe` (`cli/cli-wrapper.cjs`) fallback for `--ignore-scripts`; 7 sub-packages under `packages/md-claude-<slug>/`; root `optionalDependencies` pins all 7; full bun-CLI port deferred to Phase 3.5/3.6)
- [x] **Task 13** — `.github/workflows/build-binaries.yml` ✅ (7-platform fail-fast matrix on v*.*.* tags incl. Alpine musl variants + Windows; `publish-main needs: build-binaries`; npm provenance on every sub-package + main)
- [x] **Task 14** — DDR-015 written ✅ (per-platform binary distribution rationale + alternatives + Claude-Code precedent + pragmatic-partial deviation footer)
- [x] **Task 15** — Phase 4 plan reconciled ✅ (already had Phase 3.4 dependency from prior session; verified no stale references to `runtime-agnostic constraint` or `build.mjs`; relaxed Phase 3.4 budget references to DDR-012 values)
- [x] **Task 16** — Phase 3.5 plan reconciled ✅ (Task 4 note about bundle-loading index.html; Task 5 retargeted to `client/styles/1-tokens.css` `@layer tokens`; Validation section bumped — biome/tsc/build are now actual gates, not "skip")

**Files added (Tasks 3-16):**

- `plugins/design/dev-server/build.ts`, `tsconfig.json`, `context.ts`, `server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`, `mem.ts`
- `plugins/design/dev-server/client/styles/{0-reset,1-tokens,2-layout,3-shell,4-components,5-utilities,_index}.css`
- `plugins/design/dev-server/client/{hmr,iframe-lazy}.mjs`
- `plugins/design/dev-server/test/{_helpers,server-lifecycle,ws-handshake,active-state,history-rollback,fs-watch,bundle-smoke,binary-smoke}.{ts,test.ts}` + `perf-harness.ts`
- `packages/md-claude-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,win32-x64}/{package.json,README.md}` (7 sub-packages)
- `cli/{install.cjs,cli-wrapper.cjs,bin/mdcc.exe}` (postinstall + safe-mode bin + 500-byte stub)
- `.github/workflows/build-binaries.yml`
- `.ai/decisions/DDR-015-per-platform-binary-distribution.md`

**Files modified (Tasks 3-16):**

- `plugins/design/dev-server/client/{app.jsx,index.html}` (React 19 esm; bundle-loading)
- `plugins/design/dev-server/package.json` (typescript + bun-types added)
- `package.json` (root: `bin.mdcc-safe`, `postinstall`, `optionalDependencies` × 7, `start`/`dev` use `bun run server.ts`, `build:binary` + `test:dev-server` scripts)
- `cli/commands/design.mjs` (side-channel binary path resolution for `mdcc design serve`)
- `scripts/{check-version-parity.sh,bump-version.sh}` (sub-package + optionalDependencies pin parity)
- `.ai/decisions/README.md` (DDR-015 indexed)
- `.ai/plans/{phase-4-canvas-v2-rendering-engine,phase-3.5-dev-server-ui-ux-refresh}.md` (3.4 alignment notes)

**Verification status this session:** No `bun run build.ts` exists yet (Task 3); no tests run; JSON syntax + Bun 1.3.3 install verified. Edit-Verify Loop is N/A — work is purely additive paper artifacts (DDRs) + a `package.json` rewrite with no runtime callers yet.

**Files modified:**

- `.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md` — companion-DDRs footer renumbered
- `.ai/decisions/README.md` — index updated for DDR-012/013/014/016
- `.ai/state/STATE.md` — Phase header + Decisions list + History row + this section

**Files created:**

- `.ai/decisions/DDR-012-react-19-unified-runtime.md`
- `.ai/decisions/DDR-013-server-modular-split-typescript.md`
- `.ai/decisions/DDR-014-css-layer-architecture.md`
- `.ai/decisions/DDR-016-runtime-folder-purpose.md`
- `plugins/design/dev-server/package.json` — full rewrite (was 12-line stub)
- `package.json` — root `engines.bun: ">=1.3"` added
