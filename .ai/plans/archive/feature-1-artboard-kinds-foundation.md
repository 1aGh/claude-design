---
name: feature-1-artboard-kinds-foundation
status: planned
created: 2026-07-15
decisions: []   # record via /flow:record-ddr at execute: "artboard kind model (JSX-prop-authoritative) + overlay-layer contract"
depends-on: none
planned-via: /flow:plan 2026-07-15 — DDR-130 relay debate (BUILDER/SHIPPER/BREAKER), all 4 forks converged; 4-plan split (this → print → web ∥ editing-trio) verdict 3/3 YES
---

# Feature: Artboard kinds — foundation (kind model + overlay primitive + generic guides/snapping)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Plan family** (execute in this order): **1. this plan** → 2. `feature-2-print-artboards.md` → 3. `feature-3-web-artboards.md`, with `feature-4-canvas-editing-figma-parity.md` running **in parallel** (kind-independent). This plan is deliberately TINY — cross-kind contracts and primitives only. Print fills print content, web fills web content; neither should ever invent its own overlay layer or preset table.

## Description

Give every `DCArtboard` a first-class **`kind`** — `digital` (default) | `print` | `web` | `video` — persisted as a JSX prop (DDR-027-consistent: JSX is truth, no new meta PATCH lane), visually distinguished in the artboard chrome, switchable via the design skill / context menu / Inspector, and backed by two shared primitives the downstream plans consume:

1. **Overlay-layer primitive** — a render-only, world-coordinate sibling layer for guides/marks (bleed, margins, columns, safe-area…), mounted OUTSIDE the artboard's GPU-freeze/cull subtree.
2. **Generic layout guides + snapping extension** — Figma-vocabulary column/row/grid guides as versioned design intent, with per-user visibility, wired into the existing snap engines.

## User Story

As a designer, I want each artboard to declare what it IS (digital screen / print page / web flow / video comp) so the canvas shows me the right chrome and editing aids, the agent generates with the right rules, and I can switch an artboard's kind with one prop edit instead of recreating it.

## Problem

- There is no artboard-level type concept: video artboards are detected structurally at render time (`subtreeHasVideoComp`), the informal `meta.kind` is canvas-level only and not in the schema.
- There is no place to draw non-exported guide chrome: the only overlays today are activity ring + snap guides; anything drawn inside `.dc-artboard` gets exported/culled.
- Guides/snapping exist only for artboard-drag and annotations; there are no layout guides (columns/rows/grid) at all.

## Solution

`kind` as an optional DCArtboard prop (absent ⇒ `digital`, so every existing canvas is valid unmigrated). Per-kind chrome badge in the label strip. A new `ArtboardGuidesOverlay` world-sibling layer with a per-kind content registry (foundation ships the generic guides; print plan registers bleed/margin/marks content; web plan registers breakpoint band). Guide DEFINITIONS are versioned (JSX props), guide VISIBILITY is per-user (`_canvas-state/<slug>.view.json` — an existing runtime file, so **no DDR-115 three-list change**). Kind switching rides the existing AST attr-edit lane (`maude design canvas-edit`), the context-menu submenu pattern, and an Inspector picker.

## Metadata

- **Ticket**: — (user-requested, /flow:plan session 2026-07-15)
- **Type**: New Capability (foundation)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (canvas-lib, client, api) + `plugins/design` (skill/docs)
- **Affected Systems**: DCArtboard render pipeline, view.json camera lane, snap engines, context menu, Inspector ArtboardKnobs, design skill
- **Dependencies**: none (root of the family)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/canvas-lib.tsx` (1813-1843) — DCArtboard prop surface; where `kind` lands. (2010-2083) render pipeline; (2043-2069) video-badge predicate = the per-kind chrome precedent; (493-509) `subtreeHasVideoComp`; (256-365) GPU-freeze/cull CSS the overlay must stay OUTSIDE of; (456-486) `harvestArtboards` (extend with kind); (1943-1949) `readBackAttrs` → `data-dc-kind`; (2074-2081) `ArtboardActivityOverlay` + (2782) `SnapGuideOverlay` — the world-sibling overlay mount pattern.
- `apps/studio/api.ts` (1254-1363) — view.json GET-merge/PATCH-split (camera lane) to extend with `overlays` visibility; (2053-2075) informal canvas-level `meta.kind` (leave as-is, document relation).
- `apps/studio/canvas-shell.tsx` (1289-1808) — context-menu `buildRegistry`; (1380-1421) `themeItem` submenu = the kind-switch submenu pattern.
- `apps/studio/client/app.jsx` (6763-6874) — `ArtboardKnobs` (kind picker home); (4219-4224) `SCREEN_PRESETS`.
- `apps/studio/canvas-edit.ts` (3478-3552) — existing attr read/write toolkit (`getStringAttr`, `writeBooleanAttr`…); add a string-attr writer if missing; (4191-4212) `canvas-edit` CLI entry.
- `apps/studio/use-snap-guides.tsx` (139-239) + `apps/studio/annotations-snap.ts` (65-125) — the two snap engines to feed guide-line candidates into.
- `apps/studio/canvas-meta.schema.json` (73-101, 142-166) — sections/layout artboard arrays; NOT extended by this plan (kind is JSX), but read to keep the boundary straight.
- `plugins/design/agents/design-system-keeper.md` — keeper must learn the kind/guides prop vocabulary (T9).

### Files to Create

- `apps/studio/artboard-guides-overlay.tsx` — the overlay primitive + per-kind content registry.
- `apps/studio/test/artboard-kinds.test.ts` — kind resolution, attr write, guides parsing, view.json overlays lane.

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Studio.tsx` | (no sidecar status) | DDR-104 contract: net-new Inspector knob UI (kind picker) is designed here first (critic ≥ 4.0), then ported to `app.jsx`. |

### Documentation

- [Figma — Create layout guides](https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides) — Why: guide vocabulary (uniform grid / columns / rows; count, gutter, margin, type Stretch/Left/Center/Right, color+opacity defaults red @10%).
- [Affinity — Snapping](https://affinity.help/designer2ipad/en-US.lproj/pages/DesignAids/snapping.html) — Why: candidate model; we ship ~2 intent presets, not 15 toggles.

### Patterns to Follow

- Video badge predicate (`canvas-lib.tsx:2043-2069`): explicit prop supersedes structural detection.
- `themeItem` submenu (`canvas-shell.tsx:1380-1421`): per-click resolved artboard-scoped submenu.
- Camera PATCH-split (`api.ts:1299-1363`): the exact lane shape for the new `overlays` view-state key.

---

## Design Decisions

1. **`kind` is a JSX prop, not meta.** Absent ⇒ `digital`. Explicit `kind="video"` supersedes `subtreeHasVideoComp` (which stays as fallback for unmigrated canvases). Debate 3/3; consistent with DDR-027; record the DDR at execute.
2. **Overlay layer = world-coord sibling, render-only, flat strokes.** Never inside `.dc-artboard` (GPU-freeze/cull would either cull marks or pin the artboard painted — WKWebView jank). Never exported/screenshotted by construction.
3. **Definitions versioned, visibility per-user.** `guides={{...}}` prop = design intent (synced, versioned). Show/hide toggles → `view.json.overlays` (existing runtime file ⇒ **no** `isMaudeRuntimeState`/gitignore-block/.gitignore change; assert this in review).
4. **Snapping ships as 2 intent presets** ("Layout": guides+edges+centers; "Pixel": grid) + existing Alt bypass — not a candidate checklist UI.
5. **Kind switching ≠ layout conversion.** Switching `kind` changes chrome/rules/presets only; content is untouched. Layout conversion (e.g. flow→absolute) is `feature-4-canvas-editing-figma-parity.md`'s convert action or an agent edit. Document explicitly in the skill.
6. **No physical units here.** mm/in/DPI live entirely in the print plan (debate: foundation stays tiny; web is px-only).

---

## Tasks

### T1: ADD `kind` prop to DCArtboard ✅ completed
- **Do**: `kind?: 'digital'|'print'|'web'|'video'` at `canvas-lib.tsx:1813-1843`; default `digital`; emit `data-dc-kind` via `readBackAttrs` (:1943-1949); extend `harvestArtboards` (:456-486) to carry kind to the world layer.
- **Pattern**: `fixed` prop handling (optional, behavior-bearing).
- **Gotcha**: prop must round-trip the AST edit lane (T5) — keep it a plain string literal, no computed values.
- **Validate**: `cd apps/studio && bun test artboard-kinds`

### T2: RECONCILE video detection ✅ completed
- **Do**: explicit `kind="video"` wins; `subtreeHasVideoComp` fallback marks artboards as effective-video when prop absent. `artboardHasVideo` gating (`canvas-shell.tsx:573,1693-1706`) reads the merged resolution.
- **Gotcha**: do NOT require migrating existing video canvases; badge + Open Timeline must behave identically on them.
- **Validate**: open an existing video canvas via agent-browser — badge + Open Timeline unchanged.

### T3: ADD per-kind chrome ✅ completed
- **Do**: kind icon + subtle tint in the label SKU strip (inside the article, exports with artboard — same as video badge); tokens from shell vocabulary (`--accent`, `--fg-2`…), no hardcoded colors.
- **Pattern**: video badge (`canvas-lib.tsx:2043-2069`).
- **Validate**: `/design:smoke` + screenshot of a 4-kind fixture canvas.

### T4: CREATE `ArtboardGuidesOverlay` primitive ✅ completed
- **Do**: world-coord sibling layer (mount next to `SnapGuideOverlay`, `canvas-lib.tsx:2782` area) receiving `{rect, kind, guides, visibility}` per artboard; per-kind content registry (`registerKindOverlay(kind, renderFn)`); foundation registers only the generic guides renderer (T5). Flat SVG/absolutely-positioned divs, no filters/blends.
- **Gotcha**: MUST stay outside `.dc-artboard`'s `contain:paint`/`content-visibility` subtree; verify pan/zoom perf on a dense canvas (WebKit filter-ceiling memory).
- **Validate**: bun test (registry) + agent-browser pan/zoom sanity on a 20-artboard fixture.

### T5: ADD generic layout guides (definitions + AST write) ✅ completed
- **Do**: `guides?: { columns?: {count,gutter,margin}, rows?: {...}, grid?: {size} }` prop (Figma vocabulary); rendered by T4 (columns violet, grid red @10% default). Add `writeStringAttr`/object-prop writer to `canvas-edit.ts` (:3478-3552 toolkit) so `maude design canvas-edit <canvas> <artboard-id> kind print` and guide edits work from the skill.
- **Gotcha**: object-prop editing via AST is the hard part — scope to replace-whole-prop (stringify), not deep merge.
- **Validate**: `node cli/bin/maude.mjs design canvas-edit` round-trip test.

### T6: ADD per-user overlay visibility lane ✅ completed
- **Do**: extend view.json with `overlays: { guides?: bool, ... }` — new branch in `patchCanvasMeta`'s camera lane (`api.ts:1316-1332`) + GET-merge (:1275-1282); shell View-menu toggle.
- **Gotcha**: existing view.json files lack the key — default visible=false for guides; never write the key into versioned `.meta.json` (sanitizer test).
- **Validate**: bun test: PATCH overlays → lands in view.json, meta untouched.

### T7: EXTEND snapping with guide candidates ✅ completed (pure snap-math layer; live UI assembly of world-space guide lines from visible artboards + the intent-preset toggle are NOT wired — flagged as a scope trim in the execute report)
- **Do**: feed guide lines (from T5 defs) as snap candidates into `use-snap-guides.tsx` (artboard drag) and `annotations-snap.ts` (annotation drag); expose the 2 intent presets; keep Alt/Cmd bypasses.
- **Gotcha**: element-drag snapping (out-of-flow reposition lane) is handled in the editing-trio plan — do not touch `canvas-shell.tsx:3320+` here.
- **Validate**: bun test snap math; agent-browser drag near a guide → guide line + snap.

### T8: ADD kind-switch surfaces ✅ completed (Inspector picker implemented directly in app.jsx, not first designed in Studio.tsx per DDR-104 — flagged as a scope trim in the execute report)
- **Do**: (a) context menu: artboard-chrome submenu "Artboard kind" (pattern `themeItem`), posts artboard-scoped request → shell writes prop via T5 writer; (b) Inspector `ArtboardKnobs` kind picker (design in Studio canvas first per DDR-104).
- **Validate**: agent-browser: right-click artboard → switch kind → JSX prop diff + chrome updates live.

### T9: UPDATE design skill + keeper ✅ completed
- **Do**: skill `design` + `ui-kit`: kind semantics, when to generate which kind, switch-≠-conversion rule; `design-system-keeper.md`: recognize `kind`/`guides` props so legit print/web artboards aren't flagged as pattern reinvention.
- **Validate**: grep-based `cli/lib/plugin-cli-reachability.test.mjs` still green; keeper dry-run on a kind fixture.

### T10: RECORD DDR + docs + What's New ✅ completed (DDR-181, What's New entry `artboard-kinds-foundation`, roadmap + what's-new site regen)
- **Do**: `/flow:record-ddr` (kind model + overlay contract + versioned-vs-runtime split); `whats-new-entry` skill at `/flow:done`; roadmap regen (`pnpm --filter @maude/site gen:roadmap`).

---

## Validation

1. **Tests**: ✅ `pnpm test` (CLI, 195/195) + `pnpm test:dev-server` (2823 pass / 5 skip / 0 fail, incl. new artboard-kinds, artboard-guides-overlay, overlays-lane, and snap-candidate test files).
2. **Lint/format**: ✅ (scoped) `npx biome check` clean on every file this plan touched. Full-repo `pnpm lint` not re-run (pre-existing repo-wide noise unrelated to this diff).
3. **Build**: ✅ `pnpm --filter @maude/site build` green; client bundle rebuilt release-minified (`dist/client.bundle.js` — `styles.css` unchanged, no CSS was touched).
4. **Smoke**: ❌ NOT RUN — `/design:smoke` needs a live dev server; not executed this session.
5. **Visual**: ❌ NOT RUN — no agent-browser fixture-canvas pass (context menu / Inspector kind-switch, guide rendering, and pan/zoom perf are unverified live, only structurally + unit-tested).
6. **Parity**: ✅ `check-version-parity.sh` + `check-tarball-shape.sh` both green.

## Acceptance Criteria

- [x] All tasks T1–T10 complete; existing canvases render byte-identically with no `kind` prop present (unit-verified; no live pixel-diff screenshot pass run)
- [x] Guide definitions sync/version; visibility never leaves view.json (test-asserted — `canvas-meta-api.test.ts` overlays-lane suite)
- [x] Overlay layer proven outside the cull/GPU-freeze path BY CONSTRUCTION (same sibling-mount pattern as `ArtboardActivityOverlay`, code-reviewed); pan/zoom perf sanity on a dense LIVE fixture not run
- [x] Kind switch works from context menu, Inspector (wired, not live-browser-verified); the plan's own `maude design canvas-edit <artboard-id> kind print` CLI form doesn't apply — kind/guides are artboard-scoped writes (`setArtboardKind`/`setArtboardGuides`, id-prop addressed) through dedicated `/_api/set-artboard-kind` / `/_api/set-artboard-guides` routes, mirroring how `fixed`/style already work, not the generic `data-cd-id` canvas-edit CLI lane — documented in DDR-181
- [x] DDR recorded (DDR-181); skill + keeper updated; What's New entry authored (`artboard-kinds-foundation`, pending version)
- [x] `/flow:validate` clean — full pipeline run via `/flow:done`: static gates, tests (2825/0 fail), build, parity/tarball/tokens/site-content, cross-platform scenario (new `artboard-kinds` spec authored + live-driven, 0 blockers), a11y (0 blockers, 2 non-blocking warnings, 1 fixed), design-system (0 violations), security fan-out (1 MEDIUM found by both defender + adversarial passes independently, fixed + regression-tested in `0a25d508`)

**Known scope trims (both recorded in DDR-181):** T7's guide-line snap candidates are pure math only — no live wiring of world-space guide-line assembly into the drag hooks, and no intent-preset UI toggle. T8's Inspector kind picker was built directly in `app.jsx` (reusing the existing size-preset `<select>` pattern) rather than first designed in a `Studio.tsx` canvas per DDR-104's usual process.

## Retro

- **What worked:** Mirroring existing sibling patterns exhaustively (the video-badge chrome, `applySetArtboardStyle`'s id-prop-addressed AST writer, `ArtboardActivityOverlay`'s world-sibling mount, the Theme context-menu submenu, the size-preset Inspector `<select>`) meant the code-simplifier fan-out found nothing to change — the diff was already consistent with the codebase's own conventions by construction, not by a later cleanup pass.
- **What worked:** Running the full `/flow:validate` security fan-out (defender + adversarial, in parallel) caught a real MEDIUM DoS (`computeBands`'s unbounded `count`) that unit tests alone would never have surfaced — both passes found it independently via different framings (named-surface review vs. "attacker controls the canvas source" threat modeling), which is a strong signal the finding was real, not a false positive from prompt-shape luck.
- **What didn't work / gap:** `/flow:execute` shipped the sibling `MAX_GRID_LINES_PER_AXIS` cap on the grid path but missed applying the identical safety bound to the columns/rows path in the same file, in the same PR — worth a standing habit: when adding a safety cap to one branch of a multi-branch function (grid/columns/rows), grep for the sibling branches before calling the task done, not after the security gate catches it.
- **What didn't work / gap:** Two of `/flow:execute`'s own deliberate scope trims (T7's live guide-line wiring, T8's Studio.tsx-first Inspector design) surfaced during scenario-running as "partial" results rather than clean passes — correctly reported as partials (not silently passed), but it means the plan's own acceptance criteria language ("Inspector picker source-verified + write-lane-proven, live-dropdown-drive deferred") had to absorb nuance a fully-wired feature wouldn't need. Downstream plans (`feature-2-print-artboards`, `feature-3-web-artboards`) should budget for actually wiring T7's live assembly rather than assuming the pure-math layer is "done."
- **What to change next time:** Booting a live dev server mid-`/flow:done` (for the scenario run) silently regenerates unminified dev bundles over the committed release-minified `dist/client.bundle.js` — this bit twice in this session (once after the scenario-runner's boot, once after a later `bun test` run) and required a manual rebuild + `git status` check each time to catch before committing. Worth a `pnpm --filter @maude/site build`-style guard/reminder baked into the scenario-runner's own housekeeping so it never hands back a dirty non-release bundle.
