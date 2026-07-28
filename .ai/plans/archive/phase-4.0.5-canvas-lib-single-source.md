---
name: phase-4.0.5-canvas-lib-single-source
status: draft
created: 2026-05-19
decisions: [DDR-025-canvas-lib-single-source-in-dev-server.md]
amends: phase-3.6.1-canvas-envelope-and-ds-specimens.md (DDR-022's "project-owned" stance), phase-4-canvas-v2-rendering-engine.md (`_lab/` location)
blocks: phase-4.1-figjam-canvas-interactions.md (must land first; 4.1 cannot be sequenced without the new boundary)
---

# Phase 4.0.5: canvas-lib + perf-lab single source in dev-server

> **Scope.** Architectural cleanup gating Phase 4.1+. Per DDR-025, relocate canvas-lib from a project-scaffolded file (`<designRoot>/_lib/canvas-lib.tsx`) to a dev-server-internal single source (`plugins/design/dev-server/canvas-lib.tsx`). Relocate this repo's `_lab/perf-100-artboards.tsx` perf fixture to the dev-server's examples folder. Remove the canvas-lib bootstrap step from the `design-system` skill. Add a one-cycle deprecation guard for downstream projects with legacy `_lib/canvas-lib.tsx`. Zero behavior changes from a consumer perspective — handoff drop is byte-identical, HMR works the same, `/design:edit` Step 1.5 still pre-loads the same source.

## Description

Implements DDR-025. The current architecture (DDR-022) treats canvas-lib as project-owned source that gets scaffolded into `<designRoot>/_lib/canvas-lib.tsx` on first `/design:setup-ds`. That design has produced unbounded drift — project copies never update across plugin releases, the template under `plugins/design/templates/canvas-lib.tsx.template` is the *real* source-of-truth that the project copy silently diverges from, and the dogfood instance in this repo (`.design/_lib/canvas-lib.tsx`) is what authors actually edit during plugin development. Phase 4.1's added canvas-lib surface (input-router, tool-mode, selection-set, context-menu) would multiply the drift cost. The fix is to stop materializing canvas-lib into projects and serve it directly from the dev-server install.

What changes:

- **canvas-lib.tsx** moves to `plugins/design/dev-server/canvas-lib.tsx` (single canonical home). The `plugins/design/templates/canvas-lib.tsx.template` is deleted. The dogfood copy at `.design/_lib/canvas-lib.tsx` is deleted.
- **`canvas-lib-resolver.ts`** rewires `canvasLibPath()` to return the dev-server-internal path. `Bun.build` resolves `@mdcc/canvas-lib` → that file. Pre-flight checks in `canvas-build.ts` become sanity checks (corrupt install if missing); no more "Run /design:setup-ds to scaffold" hint.
- **`canvas-lib-inline.ts`** (handoff inliner) reads from the new path. Output is byte-identical to today — registry-item drops still have no `@mdcc/canvas-lib` reference, helpers are still AST-inlined per-canvas.
- **HMR watcher** in `http.ts` watches `plugins/design/dev-server/canvas-lib.tsx` instead of `<designRoot>/_lib/canvas-lib.tsx`. Hard-reload broadcast behavior unchanged.
- **`design-system/SKILL.md`** loses Round-0 Batch-A step 0 (the "copy canvas-lib.tsx into project" step). Bootstrap runs faster and one less file lands on disk per new project.
- **Legacy deprecation guard**: when a project still has `<designRoot>/_lib/canvas-lib.tsx` from a pre-4.0.5 setup, `canvas-build.ts` logs a one-line warning on boot ("delete `<designRoot>/_lib/canvas-lib.tsx` — canvas-lib now ships with dev-server"). The dev-server-bundled lib is authoritative; the project file is ignored. After two minor versions the warning becomes silent and the fallback path is removed.
- **`.design/_lab/perf-100-artboards.tsx`** relocates to `plugins/design/dev-server/examples/perf-100-artboards.tsx`. It's a dev-server perf fixture; living in `.design/_lab/` mislabels it as user content.
- **All skill docs and CLAUDE.md references** to `<designRoot>/_lib/canvas-lib.tsx` are swept and replaced with the dev-server path or with a "ships with dev-server" phrasing where the path doesn't matter to the reader.

What stays untouched:

- The virtual specifier `@mdcc/canvas-lib` continues to work in canvas TSX. No author-facing change.
- The handoff drop contract — emitted registry-item is byte-identical to today.
- DDR-022's "two-state model" (virtual at author time, inlined at handoff time). Only the *physical home* of the canonical source changes.
- HMR cycles, `data-cd-id` injection through canvas-lib JSX, Bun.build tree-shake — all unchanged.
- Downstream projects' existing `<designRoot>/_lib/canvas-lib.tsx` files are NOT auto-deleted by this phase. The deprecation cycle is non-destructive.

## User Story

As a plugin author working on canvas-lib, I want exactly one file to edit (`plugins/design/dev-server/canvas-lib.tsx`) — not a template + a dogfood copy + N drifted project copies — so that releasing canvas-lib changes actually reaches end users automatically and `.design/` stays clean as a pure user-content directory.

## Problem

DDR-022 took a reasonable architectural shortcut (scaffold canvas-lib into project) that aged badly:

1. **Three copies for one source.** Today canvas-lib exists as `plugins/design/templates/canvas-lib.tsx.template` (the *real* source-of-truth authors edit), `<designRoot>/_lib/canvas-lib.tsx` in every initialized project (scaffolded copies), and the dogfood `.design/_lib/canvas-lib.tsx` in *this* repo. Every plugin upgrade leaves stale project copies that never get touched. The release flow has no mechanism to update them.
2. **The dogfood/template split confuses contributors.** "Did you edit the dogfood or the template?" is the most common review nit on plugin-internal PRs. CLAUDE.md has a load-bearing sentence ("don't edit one without the other") — that sentence shouldn't exist; the system shouldn't have two surfaces to keep in sync.
3. **Phase 4.1's surface multiplies the drift.** Following DDR-022's pattern, the new input-router / tool-mode / selection-set / context-menu modules would each get scaffolded into project + dogfood + template, tripling the drift surface in one phase. The cost trajectory is unsustainable.
4. **`.design/_lib/` and `.design/_lab/` muddle the user-content boundary.** Designers reasoning about "what's mine vs what's plugin infra" can't tell from the path. `_lib/canvas-lib.tsx` looks user-owned (it's under their design root), but it's actually plugin internals they're not supposed to touch.
5. **The Phase 4.1 framing session 2026-05-19 made the user's mental model explicit.** "*Dev-server má sloužit jako wrapper pro design co se vygeneruje, nic víc.*" The dev-server should be the wrapper; `.design/` should hold only user content. That model is incompatible with DDR-022 as-written.

## Solution

A single-source relocation, executed as one bundled change so the system is consistent at every commit:

- Move canvas-lib.tsx into `plugins/design/dev-server/canvas-lib.tsx`. Delete the template and the dogfood copy.
- Rewire the resolver, the inliner, and the file-watcher to read from the new path.
- Remove the bootstrap step from `design-system/SKILL.md`.
- Add a one-cycle deprecation log for downstream projects with legacy `_lib/canvas-lib.tsx`.
- Move this repo's `_lab/perf-100-artboards.tsx` to `dev-server/examples/perf-100-artboards.tsx`.
- Sweep doc references (CLAUDE.md, skill docs, plan/DDR backlog).

No new functionality. No behavior change visible to canvas authors or handoff consumers. Pure structural simplification that unblocks Phase 4.1.

## Metadata

- **GitHub Issue**: — (no issue; user-requested in /flow:execute session 2026-05-19, gating Phase 4.1)
- **Type**: Architectural refactor / drift cleanup
- **Complexity**: Low–Medium (mostly path swaps + doc sweeps; one new deprecation guard; no new logic)
- **App/Package**: `plugins/design` (dev-server + skills + templates) and this repo's dogfood `.design/`
- **Affected Systems**: canvas-lib-resolver, canvas-build pre-flight, canvas-lib-inline (handoff), http.ts cache invalidation, `/design:edit` Step 1.5 pre-load, `design-system` skill Round-0 bootstrap, `design` + `ui-kit` skill docstrings, CLAUDE.md "Dev-server runtime contract", `mdcc init` (if it materializes anything design-side)
- **Dependencies**: DDR-025 accepted; supersedes DDR-022 partially. Must land before Phase 4.1 starts.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/canvas-lib-resolver.ts` — resolver + `canvasLibPath()`. The function the path swap centers on.
- `plugins/design/dev-server/canvas-lib-inline.ts` — handoff inliner. Reads canvas-lib source for AST-inlining; just needs the new path.
- `plugins/design/dev-server/canvas-build.ts` (line 28 import, line 70 pre-flight, line 188 fallback root) — three integration points.
- `plugins/design/dev-server/handoff.ts` (line 37 import, line 553 read) — handoff path passes through.
- `plugins/design/dev-server/http.ts` (line 156 HMR cache invalidation) — file-watcher path.
- `plugins/design/skills/design-system/SKILL.md` line 348 (Round-0 Batch-A step 0) — the bootstrap step being deleted.
- `plugins/design/skills/design/SKILL.md` lines 290, 762, 810, 814, 816 — docstrings referencing `<designRoot>/_lib/canvas-lib.tsx`.
- `plugins/design/skills/ui-kit/SKILL.md` line 22 — same.
- `CLAUDE.md` (root) — "Dev-server runtime contract" + "Working on plugin internals locally" sections reference the template + dogfood split. Sweep.
- `plugins/design/templates/canvas-lib.tsx.template` — the template file being deleted (read once to confirm it equals the dogfood copy at deletion time, then `git rm`).
- `.design/_lib/canvas-lib.tsx` — dogfood copy being deleted.
- `.design/_lab/perf-100-artboards.tsx` — perf fixture being relocated.
- `.ai/archive/decisions/DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md` — the prior DDR getting partially superseded; add a header note pointing at DDR-025.

### Files to Create

- `plugins/design/dev-server/canvas-lib.tsx` — relocated source (copied verbatim from `.design/_lib/canvas-lib.tsx` after verifying it matches the template content; the template version may have any pending unmerged edits we need to fold in)
- `plugins/design/dev-server/examples/perf-100-artboards.tsx` — relocated perf fixture
- `plugins/design/dev-server/examples/README.md` — short note explaining the folder's role (fixtures for dev-server perf/smoke testing; not user content)

### Files to Delete

- `plugins/design/templates/canvas-lib.tsx.template`
- `.design/_lib/canvas-lib.tsx`
- `.design/_lib/` (after the canvas-lib.tsx deletion — if no siblings)
- `.design/_lab/perf-100-artboards.tsx` (relocated, not lost)
- `.design/_lab/` (after, if no siblings)

### Files to Update

- `plugins/design/dev-server/canvas-lib-resolver.ts` — `canvasLibPath()` returns dev-server-internal path; resolver still maps `@mdcc/canvas-lib` → that path; `failLoud` behavior unchanged
- `plugins/design/dev-server/canvas-build.ts` — pre-flight error message swaps "Run /design:setup-ds to scaffold" for "canvas-lib not bundled with this dev-server install — re-install `@1agh/md-claude`"; default `designRoot` fallback logic unchanged
- `plugins/design/dev-server/canvas-lib-inline.ts` — comment header updated (no code change beyond a constant if the path was hardcoded anywhere)
- `plugins/design/dev-server/handoff.ts` — relies on `canvasLibPath()`; one comment update at line 98
- `plugins/design/dev-server/http.ts` — file-watcher path updated to the dev-server-internal location
- `plugins/design/skills/design-system/SKILL.md` — DELETE Round-0 Batch-A step 0 (the canvas-lib copy step); reword Round-0 preamble to drop the "scaffold once" framing
- `plugins/design/skills/design/SKILL.md` — sweep 5 references; replace "scaffolded once from `plugins/design/templates/canvas-lib.tsx.template` on first `/design:setup-ds`" with "ships with the dev-server install"; replace "`<designRoot>/_lib/canvas-lib.tsx`" with "the dev-server-bundled canvas-lib"
- `plugins/design/skills/ui-kit/SKILL.md` line 22 — same rewording
- `CLAUDE.md` — "Dev-server runtime contract" section: replace the template + dogfood-must-stay-in-sync paragraph with a one-liner pointing at `plugins/design/dev-server/canvas-lib.tsx`; "Working on plugin internals locally" section: drop the "test in a scratch project" note about canvas-lib regeneration (no longer applicable)
- `.ai/archive/decisions/DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md` — add a header note above "## Context": "**Status update (2026-05-19):** Partially superseded by DDR-025. The 'project-owned source under `<designRoot>/_lib/`' assertion is reversed — canvas-lib now ships with the dev-server. The 'virtual specifier at author time + inlined source at handoff time' two-state model remains in force."
- `plugins/design/dev-server/canvas-lib-resolver.ts` `canvasLibPath()` JSDoc — drop "Centralised so the plugin + handoff + tests agree on the location."; replace with "Returns the dev-server-internal canvas-lib path."
- Any scenario or DDR that references `_lab/perf-100-artboards.tsx` — `.ai/archive/decisions/DDR-024-phase-4-canvas-engine-driver-choice.md` (likely), `.ai/plans/archive/phase-4-canvas-v2-rendering-engine.md` (archive — leave alone, it's history). Run a `grep -rn _lab` sweep to catch stragglers.

### Documentation

- DDR-025 (this DDR) — the authoritative rationale
- DDR-022 — read alongside; partially superseded
- DDR-016 (runtime folder = strip-on-handoff) — clarifies the boundary canvas-lib does NOT fall into (canvas-lib is inline-on-handoff, not strip-on-handoff; both legitimate dev-server-owned categories)

### Patterns to Follow

**Deprecation log shape** — single line, dev-server boot context:

```ts
// in canvas-build.ts initialization
if (existsSync(path.join(designRoot, '_lib', 'canvas-lib.tsx'))) {
  console.warn(
    `[canvas-lib] Legacy <designRoot>/_lib/canvas-lib.tsx detected. ` +
    `As of v0.15.0, canvas-lib ships with the dev-server install — the project file is ignored and can be deleted. ` +
    `See DDR-025 for the migration rationale.`
  );
}
```

Fired once per dev-server boot, not per canvas build (avoid log noise during HMR cycles).

---

## Design Decisions

### Components reused

| Component | Source | Notes |
|---|---|---|
| `canvasLibResolver(designRoot)` | `plugins/design/dev-server/canvas-lib-resolver.ts` | Logic unchanged; only `canvasLibPath()` swaps target |
| `inlineUsedExports(source, usedNames)` | `plugins/design/dev-server/canvas-lib-inline.ts` | Source is read from the new path; output identical |
| `useViewportController`, `DesignCanvas`, `DCArtboard` | `plugins/design/dev-server/canvas-lib.tsx` (new home) | Identical content to `.design/_lib/canvas-lib.tsx` at relocation time |

### Custom Components Needed

None. This is path-relocation + doc sweep + one deprecation log. No new components.

### Tokens

No new tokens. No CSS changes.

---

## Tasks

Execute in order. Each task atomic. After every task: `cd plugins/design/dev-server && bun test` (Phase 4 baseline 139/139 must hold).

### Task 1: VERIFY template + dogfood drift before relocation

- **Do:** `diff plugins/design/templates/canvas-lib.tsx.template .design/_lib/canvas-lib.tsx`. If non-empty, decide which side is authoritative (read both, pick the more recent / more complete; the dogfood is usually what authors actually edit and is therefore the freshest). Note the resolution in this task's checkpoint comment so the diff history is captured.
- **Gotcha:** The template is theoretically the source-of-truth; in practice the dogfood is what we test against. If they've drifted, the dogfood version is usually correct. Decide explicitly; don't merge blindly.
- **Validate:** Both files produce identical AST when parsed by oxc-parser, or the chosen winner is captured verbatim and the other is discarded with rationale.

### Task 2: CREATE `plugins/design/dev-server/canvas-lib.tsx` from the winner of Task 1

- **Do:** `cp <winner> plugins/design/dev-server/canvas-lib.tsx`. Update the JSDoc header at top — replace the "@scope `<designRoot>/_lib/canvas-lib.tsx`" line with "@scope `plugins/design/dev-server/canvas-lib.tsx` (ships with dev-server install; resolved via `@mdcc/canvas-lib`)". Replace the "Phase 4 (2026-05-19)" footer with "Phase 4.0.5 (2026-05-19) — relocated from `<designRoot>/_lib/canvas-lib.tsx` per DDR-025; single source in dev-server."
- **Gotcha:** Don't `git mv` from the template — the template + dogfood are both being deleted; this is a clean create with one of them as content source.
- **Validate:** `bun -e 'await Bun.build({entrypoints:["plugins/design/dev-server/canvas-lib.tsx"],target:"browser",format:"esm"})'` succeeds (round-trip parse + bundle).

### Task 3: REFACTOR `canvas-lib-resolver.ts` — `canvasLibPath()` returns dev-server-internal path

- **Do:** Change `canvasLibPath(designRoot)` body from `path.join(designRoot, '_lib', 'canvas-lib.tsx')` to `path.join(import.meta.dir, 'canvas-lib.tsx')` (or the resolver-file-relative equivalent). The `designRoot` parameter is now unused — keep it in the signature for one cycle as `_designRoot` (suppress unused warning) for back-compat with callers; remove in the next minor. Update the JSDoc comment block.
- **Gotcha:** `import.meta.dir` in Bun returns the directory of the calling module. Confirm with a quick repl — the resolver file lives at `plugins/design/dev-server/canvas-lib-resolver.ts`, so `import.meta.dir` should be the dev-server directory. Test by running the dev-server and grep'ing the build output for the resolved path.
- **Validate:** Boot dev-server against `.design/`. Open any canvas. Check it loads canvas-lib from the new path (browser network tab or Bun build log).

### Task 4: REFACTOR `canvas-build.ts` — drop the "scaffold via `/design:setup-ds`" hint, add deprecation log

- **Do:** Pre-flight at line 70: change the error message from `"Canvas ${canvasAbsPath} imports it. Run /design:setup-ds to scaffold, or copy plugins/design/templates/canvas-lib.tsx.template."` to `"Canvas ${canvasAbsPath} imports it but the dev-server's bundled canvas-lib is missing — re-install @1agh/md-claude."` Move the `existsSync(canvasLibPath(designRoot))` check from the per-build path to once-per-server-boot (it's an install-corruption check, not a per-build hot-path). Add the legacy-deprecation log per the Patterns snippet.
- **Gotcha:** The "fallback root" logic at line 188 (used when `designRoot` is omitted, walks up from the canvas's containing dir looking for `_lib/canvas-lib.tsx`) is no longer useful — the resolver no longer reads `designRoot`. Delete the fallback logic and the call sites that depended on it. Simpler code; fewer edge cases.
- **Validate:** `bun test plugins/design/dev-server/test/canvas-lib-resolver.test.ts` + `bun test plugins/design/dev-server/test/canvas-build.test.ts` — update any fixture expecting the old error message.

### Task 5: SWEEP `canvas-lib-inline.ts` + `handoff.ts` + `http.ts` for path references

- **Do:** Each consumer of `canvasLibPath()` keeps calling it with `designRoot` (back-compat) — no caller-side change required. But search for any hardcoded `_lib/canvas-lib.tsx` literals in these three files and replace with `canvasLibPath()` calls. Update the HMR file-watcher in `http.ts` line 156 to watch the new path.
- **Gotcha:** `http.ts` watches a file path for cache invalidation; the watch target is what triggers iframe hard-reload on canvas-lib edits. Confirm the watcher actually fires when the new path is touched (file an edit, see the HMR broadcast in the browser).
- **Validate:** Edit `plugins/design/dev-server/canvas-lib.tsx` while a canvas iframe is open in the browser. Expect: hard-reload broadcast within ~200ms, iframe re-renders against the new canvas-lib source.

### Task 6: DELETE legacy files

- **Do:** `git rm plugins/design/templates/canvas-lib.tsx.template`. `git rm .design/_lib/canvas-lib.tsx`. `rmdir .design/_lib` (if empty). The deletions go in a separate commit from the creates so the diff is reviewable as a pure relocation.
- **Gotcha:** Don't delete `<other-project>/.design/_lib/canvas-lib.tsx` for any downstream project — those are out of this repo's scope and protected by the deprecation log + non-destructive guard in Task 4.
- **Validate:** `git status` clean of templates/canvas-lib.tsx.template and .design/_lib/.

### Task 7: RELOCATE `.design/_lab/perf-100-artboards.tsx` to `plugins/design/dev-server/examples/perf-100-artboards.tsx`

- **Do:** `git mv .design/_lab/perf-100-artboards.tsx plugins/design/dev-server/examples/perf-100-artboards.tsx`. Create `plugins/design/dev-server/examples/README.md` with a 5-line note: "Fixtures used by dev-server perf + smoke tests. Not user content — refer to `.design/ui/` and DS specimens for actual canvas surfaces." `rmdir .design/_lab` if empty.
- **Gotcha:** Any scenario or doc referencing `_lab/perf-100-artboards.tsx` needs updating. Run `grep -rn '_lab/perf' .ai/ plugins/ README.md CLAUDE.md` to find them. DDR-024 likely mentions the perf canvas — update the reference but leave the DDR's historical claims intact (don't rewrite history; add a "now at" note if needed).
- **Validate:** `grep -rn '\.design/_lab' .ai/ plugins/ README.md CLAUDE.md` returns zero hits (or only archive-folder hits, which are frozen history).

### Task 8: DELETE `design-system/SKILL.md` Round-0 Batch-A step 0 (canvas-lib scaffold)

- **Do:** Open `plugins/design/skills/design-system/SKILL.md` line 348. Delete the step block ("0. `<designRoot>/_lib/canvas-lib.tsx` — project-owned canvas library..."). Renumber any subsequent steps in the same Round-0 section. In the Round-0 preamble (a few lines above), adjust any "scaffold canvas-lib first, then..." prose to drop the canvas-lib step.
- **Gotcha:** Don't drop the **conceptual** reference to canvas-lib — the skill still needs to explain that specimens import from `@mdcc/canvas-lib`. Just drop the *scaffold step*. The "specimens import from `@mdcc/canvas-lib`" wording elsewhere in the skill stays.
- **Validate:** Re-read the surrounding 50 lines for narrative coherence. Run `/design:setup-ds --dry-run` against a fresh tmp dir → bootstrap completes without ever writing a `_lib/` directory.

### Task 9: SWEEP skill docs + CLAUDE.md for `<designRoot>/_lib/canvas-lib.tsx` references

- **Do:** Update each line per the "Files to Update" list above:
  - `design/SKILL.md` 5 references — rewrite per the pattern "scaffolded once from `plugins/design/templates/canvas-lib.tsx.template`" → "ships with the dev-server install"; "`<designRoot>/_lib/canvas-lib.tsx`" → "the dev-server-bundled canvas-lib at `plugins/design/dev-server/canvas-lib.tsx`"
  - `ui-kit/SKILL.md` line 22 — same
  - `CLAUDE.md` "Dev-server runtime contract" section — replace the template + dogfood paragraph with: "canvas-lib lives at `plugins/design/dev-server/canvas-lib.tsx`. Edit there; HMR broadcasts a hard reload to every open canvas iframe. Per DDR-025, no project-side copy."
  - `CLAUDE.md` "Working on plugin internals locally" — drop the canvas-lib regeneration note (no longer applicable)
- **Gotcha:** Don't blanket-`sed` — context matters. Some sentences talk about *importing from* `@mdcc/canvas-lib` (unchanged) vs *the file living at* a path (changes). Read each hit before editing.
- **Validate:** `grep -rn '_lib/canvas-lib' plugins/ .ai/ CLAUDE.md` returns zero hits in non-archive paths. `grep -rn '@mdcc/canvas-lib' plugins/ .ai/ CLAUDE.md` still returns the legitimate author-time import references.

### Task 10: UPDATE `DDR-022` header with the supersession note

- **Do:** Open `.ai/archive/decisions/DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md`. Above the "## Context" heading, insert: "**Status update (2026-05-19):** Partially superseded by [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md). The 'project-owned source under `<designRoot>/_lib/`' assertion is reversed — canvas-lib now ships with the dev-server install. The 'virtual specifier at author time + inlined source at handoff time' two-state model remains in force."
- **Validate:** Quick read of DDR-022 — header note is the first thing readers see after the title, and the rest of the DDR remains coherent as historical context.

### Task 11: SWEEP `cli/commands/init.mjs` for design-side scaffolding

- **Do:** Inspect `cli/commands/init.mjs`. Per CLAUDE.md it templates `.ai/` from `plugins/flow/templates/ai-skeleton/` and is design-agnostic. Confirm it doesn't reach into `.design/` or scaffold a `_lib/`. If it does (it shouldn't), trim those lines. If it doesn't, no-op task — just leave a comment in the close-out report confirming the audit.
- **Validate:** `mdcc init --dry-run` against a tmp dir → emits only `.ai/` skeleton, no `.design/` content.

### Task 12: VERIFY handoff drop unchanged

- **Do:** Pick one canvas with non-trivial canvas-lib usage (e.g. `.design/ui/Canvas Viewport.tsx` which uses `DesignCanvas` + `DCSection` + `DCArtboard`). Run `/design:handoff` against it. `diff` the emitted `files[0].content` against a pre-relocation baseline (capture the baseline before Task 2 lands; cache in `.ai/logs/phase-4.0.5-handoff-baseline.txt`).
- **Validate:** Diff is empty (byte-identical handoff output). This is the load-bearing acceptance: if handoff content changes, something else is wrong.

---

## Validation

1. **Types** (skipped — no tsc setup in this repo per CLAUDE.md)
2. **Bun tests**: `cd plugins/design/dev-server && bun test` — Phase 4 baseline 139/139 must hold. Any test expecting `<designRoot>/_lib/canvas-lib.tsx` paths gets updated; no test changes its assertion shape.
3. **Manual smoke**: boot dev-server (`bun plugins/design/dev-server/server.ts --root . --port 4399`), open Canvas Viewport, confirm: (a) loads cleanly, (b) hover/pan/zoom unchanged, (c) editing `plugins/design/dev-server/canvas-lib.tsx` triggers iframe hard-reload, (d) `_lib/canvas-lib.tsx` deletion left no broken references
4. **Handoff parity**: Task 12's diff is empty
5. **Doc sweep**: `grep -rn '_lib/canvas-lib' plugins/ .ai/ CLAUDE.md` returns 0 (excluding archive); `grep -rn '\.design/_lab' .ai/ plugins/ README.md CLAUDE.md` returns 0
6. **Scenario regression**: rerun `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` (Phase 4 scenarios) — both green (no behavior change)
7. **Deprecation guard manual test**: in a tmp project with a leftover `_lib/canvas-lib.tsx`, boot the dev-server — expect the warning log line once, no error, canvases load against the dev-server's bundled canvas-lib

---

## Scenario Coverage

| Scenario | Covers | Status |
|---|---|---|
| `canvas-runtime-tour` (Phase 4) | Regression — pan/zoom + chrome unchanged | ✅ existing |
| `canvas-runtime-pan-zoom-50-artboards` (Phase 4) | Regression — perf unchanged | ✅ existing |
| `canvas-format-tsx/specimen-render-and-edit` (Phase 3.6.1) | Regression — all 38 specimens still render from dev-server-bundled canvas-lib | ✅ existing |

No new scenarios. This phase is internal plumbing; the user-facing surface doesn't change.

---

## Acceptance Criteria

- [ ] T1: drift between template + dogfood verified or resolved; winner captured
- [ ] T2: `plugins/design/dev-server/canvas-lib.tsx` exists with the winning content + updated JSDoc header
- [ ] T3: `canvasLibPath()` returns the dev-server-internal path; resolver still maps `@mdcc/canvas-lib` correctly
- [ ] T4: pre-flight error rewritten; legacy `<designRoot>/_lib/canvas-lib.tsx` triggers one warning log per dev-server boot
- [ ] T5: `canvas-lib-inline.ts`, `handoff.ts`, `http.ts` all read from the new path; HMR works
- [ ] T6: template + dogfood `_lib/` files deleted
- [ ] T7: `_lab/perf-100-artboards.tsx` relocated; `examples/README.md` written; doc refs swept
- [ ] T8: `design-system/SKILL.md` Round-0 step 0 deleted; bootstrap produces no `_lib/`
- [ ] T9: skill docs + CLAUDE.md swept; zero non-archive references to `<designRoot>/_lib/canvas-lib.tsx`
- [ ] T10: DDR-022 header notes the partial supersession
- [ ] T11: `cli/commands/init.mjs` audited (no-op or trimmed)
- [ ] T12: `/design:handoff` output byte-identical to pre-relocation baseline
- [ ] `bun test` 139/139
- [ ] `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` + `specimen-render-and-edit` regression-green
- [ ] Deprecation guard manual-tested in a fake legacy project
- [ ] Plan archived on `/done` per `.ai/plans/README.md` lifecycle
- [ ] **STATE.md**: Phase 4.0.5 → done, Phase 4.1 → unblocked + plan rewritten in post-4.0.5 world
- [ ] **Phase 4.1 plan rewrite triggered after 4.0.5 lands** — new files live in `plugins/design/dev-server/runtime/`, no template mirror, no `_lib/` references

---

## Non-goals (out of scope)

- **Migrating downstream projects' `_lib/` directories.** The deprecation guard is non-destructive. Each project's owner decides when to delete the stale file. This phase only deletes *this* repo's dogfood instance.
- **Removing the `designRoot` parameter from `canvasLibPath()`.** Kept as `_designRoot` for one minor for back-compat with consumers we don't control. Cleanup is a separate ticket (post-deprecation).
- **Rewriting the handoff inliner or the `@mdcc/canvas-lib` virtual-module mechanism itself.** DDR-022's "two-state model" stands; only the source location moves.
- **Bundling canvas-lib into a string constant (alternative D in DDR-025).** Rejected for IDE-jump-to-definition reasons.
- **Phase 4.1 work.** Out of scope. Resumes after 4.0.5 lands and the 4.1 plan is rewritten.

---

## Risk + rollback

**Risk:** the relocation breaks the handoff drop in some subtle way (path-based bug, AST parser quirk, stale cache).

**Mitigation:** Task 12's byte-identical handoff diff against a captured baseline is the load-bearing check. If the diff is non-empty, stop and root-cause before continuing.

**Rollback:** Phase 4.0.5 is one PR with 12 small commits. `git revert <merge-commit>` restores the prior architecture cleanly. Downstream projects unaffected (the deprecation guard is non-destructive; legacy `_lib/canvas-lib.tsx` files in user projects would still load via the fallback path during the deprecation cycle, so revert is safe even after a release).

---

## Retro (2026-05-19, post-/flow:done)

- **The handoff-baseline-before-T2 discipline paid off.** Capturing `Canvas Viewport.registry.json` sha1 before the resolver swap and diffing after T12 was the single load-bearing acceptance check. Without it, an AST-parser-cache-induced regression could have slipped in unnoticed. This pattern (capture-then-diff against a byte-identical baseline) is the right shape for any plumbing relocation that must preserve a serialized output contract — fold into `/flow:plan` as a heuristic for refactors of inline-on-emit pipelines.
- **Test-fixture rewrites surfaced naturally from the contract change.** 3 tests in `canvas-lib-resolver.test.ts` failed instantly with clear "Expected X, Received Y" output the moment the resolver swapped paths. Updating them was a 5-min job, not a debugging exercise. Phase 4.0.5 lesson: when a contract changes, **let the tests fail first** and rewrite them to match the new contract — don't pre-adapt tests speculatively. The failure messages name what the new assertion should look like.
- **Scope creep caught at session start.** Plan didn't address `.design/_lib/design-canvas-viewport.tsx` (orphan port from `runtime/design-canvas.jsx`, 810 LOC, zero callers). The plan's `rmdir .design/_lib (if empty)` was implicitly load-bearing; the orphan would have left the dir alive and the deletion sweep incomplete. Asking the user up-front (3 options: delete / relocate / leave) saved a stop-and-restart mid-execute. Folding into `/flow:execute`: at task start, do a `ls` of any directories the plan plans to `rmdir` and flag undeclared siblings before touching anything.
- **The `_designRoot` back-compat shim.** Keeping the parameter as `_designRoot` (underscore prefix) on `canvasLibPath()` + `canvasLibResolver()` + `readCanvasLibSource()` for one minor felt over-cautious for an internal API — but it removed any chance of a hand-call from an out-of-tree consumer breaking. Worth the 3 LOC × 3 sites; remove in 4.1 cleanup.
- **HMR fs.watch on a single file is enough.** I considered watching `plugins/design/dev-server/` recursively (so future helper files would also trigger reloads), but the canvas-lib is the only file authors edit during plugin iteration that needs a hard reload. A single `fs.watch(canvasLibPath())` + synthetic-rel-path emit reuses the existing classifier without touching `fs-watch.ts` or `hmr-broadcast.ts`. Lesson: when adding a watcher, scope it to the actual signal — don't pre-generalize.
- **What to change in `/flow:plan` next time.** The Phase 4.0.5 plan's "Files to Delete" list missed the orphan `design-canvas-viewport.tsx`. A heuristic: any `git rm <dir>` step in a plan should be preceded by a "verify directory is empty after the listed files are removed" assertion at plan-write time, not at execute time. Cheap to add; saves the mid-execute interruption.
