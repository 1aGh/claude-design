# Feature: Maude runtime restructure — extract dev-server + hub out of `plugins/design/` into top-level `apps/`

Validate docs and codebase patterns before implementing. Pay attention to existing naming, the binary-resolution path (DDR-009/045/084), the `maude design <verb>` dispatcher (DDR-062), npm `files` shipping surface (DDR-001), and the two CI workflows that consume these paths.

> **Plan A of two.** This is the mechanical directory move; **Plan B** (`feature-studio-maude-ds-redesign.md`) does the maude-DS UI rewrite on the resulting stable tree. Land A → merge → green CI → then start B. Redesigning on a moving directory is the pain this split avoids.

## Description

Today the two runtime products — the canvas-browser **dev-server** (`@maude/dev-server`) and the collab **hub** (`@maude/hub`) — live physically under `plugins/design/`, mixed with the Claude Code *plugin surface* (markdown commands / agents / skills / hooks / templates). The package boundaries already exist (both are pnpm workspace members); only the **directory location** conflates "plugin" with "runtime app".

This plan moves:
- `plugins/design/dev-server/` → `apps/studio/`
- `plugins/design/hub/` → `apps/hub/`

leaving `plugins/design/` to hold **only** the plugin surface. This aligns with the already-planned top-level `apps/desktop/` Tauri shell (phase-26), giving a clean `apps/*` home for all runnable artifacts.

**Non-goal (this plan):** no behavior change, no UI change, no API change. Whatever shipped before the move ships identically after. The finer-grained `packages/*` extraction of shared libs (canvas-lib, draw engine, exporters) is documented as an **optional deferred Phase 2** below — not forced, because it multiplies import-rewrite risk for marginal gain right now.

## User Story

As a Maude maintainer, I want the runtime apps to live under `apps/` separate from the plugin markdown, so that the repo's conceptual boundary (plugin vs. app) is visible in the directory tree and the incoming Tauri/desktop work has a natural home — **without changing how `maude design serve` or any `/design:*` workflow behaves for end users.**

## Problem

- `plugins/design/` mixes two unrelated concerns: the Claude-Code plugin (distributed via the marketplace clone) and the runtime apps (distributed via npm + Docker). A reader can't tell which files are "the plugin" vs "the app."
- The incoming `apps/desktop/` (Tauri, phase-26) will sit at top level while the dev-server it wraps is buried in `plugins/design/dev-server/` — asymmetric and confusing.
- 221 references to `plugins/design/dev-server` and 30 to `plugins/design/hub` make the location a load-bearing constant scattered across code, docs, and CI — fragile.

## Solution

A single, mostly-mechanical `git mv` of each runtime directory to `apps/`, followed by an exhaustive sweep of every pointer that named the old path. The work is "find every reference, repoint it, prove nothing regressed."

### Headline invariant (answers "nebude to chybět pro CLI tool?")

**`maude design serve` and every `maude design <verb>` MUST behave identically after the move.** The CLI never hardcodes the *concept* of a plugin path — it resolves everything from `pkgRoot` (maude's own package root) plus a relative segment. Moving the directory works as long as we move the **relative segment constants** with it. The exact, finite set of CLI resolution sites:

| Site | File:line (current) | Old segment | New segment |
| ---- | ------------------- | ----------- | ----------- |
| `runServe` TS/MJS entry | `cli/commands/design.mjs:263-264` | `plugins/design/dev-server/server.{ts,mjs}` | `apps/studio/server.{ts,mjs}` |
| `runBinDispatch` helper | `cli/commands/design.mjs:90-91` | `plugins/design/dev-server/bin/<verb>.sh` | `apps/studio/bin/<verb>.sh` |
| `resolveServerBinary` | `cli/commands/design.mjs:340+` | (compiled binary lookup) | same logic, new anchor |
| hub server entry | `cli/commands/hub.mjs:453` | `plugins/design/hub/src/server.mjs` | `apps/hub/src/server.mjs` |
| `paths.ts` walk-up | `apps/studio/paths.ts` (`resolveDevServerRoot`) | walks to `plugins/design/dev-server/` | walks to `apps/studio/` |
| npm shipping surface | root `package.json` `files[]` | `plugins/design/dev-server` | `apps/studio` |

Additionally (Task 5b) a new top-level alias **`maude studio`** is added as a synonym for `maude design serve` — `maude design serve` keeps working unchanged (alias, not replacement), so nothing existing breaks.

Once these move, `maude design serve` (and the new `maude studio`) resolves the dev-server at its new home, the compiled per-platform binary path is unchanged (it lives in `packages/maude-<platform>/`, addressed by `pkgRoot`, not by the dev-server dir), and the design workflow is byte-for-byte preserved. A dedicated acceptance test (below) launches `maude design serve` against a scratch `.design/` and asserts `/_health` 200 — the literal proof of the user's concern.

## Metadata

- **Type**: Refactor (structural)
- **Complexity**: High — 251 path references, 2 CI workflows, npm publish surface, compiled-binary resolution, marketplace plugin manifest
- **App/Package**: `@maude/dev-server` → `apps/studio`; `@maude/hub` → `apps/hub`; root `@1agh/maude` (files + scripts); `cli/`
- **Affected Systems**: pnpm workspace, `paths.ts` (DDR-045), `maude design` dispatcher (DDR-062), `cli/bin/maude.mjs` (new `maude studio` alias), `build-binaries.yml`, `hub-image.yml`, `version-parity.yml` (check), root `package.json` `files`/`scripts`, CLAUDE.md (~40 refs), `.ai/` workspace (~1314 line refs / 148 files — operative subset only: `workflows.config.json` feed, `state/`, `context/`, `docs/`, active `plans/`), `site/content/docs/**` (public docs), `.design/` canvas import specifiers (only the `@maude/canvas-lib` virtual specifier — unchanged), Changesets config
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read every file here in parallel in a single message during `/flow:execute`.

- `cli/commands/design.mjs` (full) — Why: the CLI launch + bin-dispatch resolution; the load-bearing invariant lives here.
- `cli/commands/hub.mjs` (lines ~440-460, `hubRoot` resolution) — Why: hub server entry resolution.
- `apps/studio/paths.ts` (currently `plugins/design/dev-server/paths.ts`, full) — Why: DDR-045 walk-up hardcodes `plugins/design/dev-server/`; the single most critical edit.
- `package.json` (root, `files` + `scripts` + `bin`) — Why: npm shipping surface + `start`/`dev`/`build`/`test` scripts that name the old path.
- `pnpm-workspace.yaml` — Why: workspace member paths.
- `.github/workflows/build-binaries.yml` + `hub-image.yml` — Why: CI build context paths + `MAUDE_SKIP_RUNTIME_BUILD` step.
- `CLAUDE.md` (full) — Why: ~40 prose references to `plugins/design/dev-server/` and `plugins/design/hub/` must be repointed (it's an always-loaded context file).
- `cli/lib/plugin-cli-reachability.test.mjs` — Why: its regex bans `plugins/[a-z]+/dev-server/bin/*.sh` direct invocation; verify the pattern still holds (or update) post-move.
- `.changeset/config.json` (or Changesets config) — Why: DDR-001 single-publisher; ensure workspace globs still resolve.
- `.ai/workflows.config.json` (esp. `integrations.whatsNew.feed`, line ~97) — Why: operative path into the dev-server (`whats-new.json`) that the `whats-new-entry` skill writes through — a silent break if missed.

### Files to Create

- `apps/studio/` — moved tree (was `plugins/design/dev-server/`).
- `apps/hub/` — moved tree (was `plugins/design/hub/`).
- `.ai/archive/decisions/DDR-095-runtime-apps-extracted-to-top-level.md` — record the move + the CLI-invariant rationale + the deferred packages/* phase.

### Patterns to Follow

- `packages/maude-<platform>/` already demonstrates the top-level layout for distributable artifacts — mirror its `package.json` shape conventions.
- The existing `git mv` discipline: move the directory in ONE commit with `git mv` (preserves history), repoint refs in the SAME commit so no intermediate state is broken.

---

## Tasks

Execute in order. Each task is atomic and ends green.

### Task 1: MIRROR — inventory every reference before moving anything

- **Do**: Generate the authoritative reference list and commit it as a scratch artifact (deleted in the final task):
  ```sh
  grep -rn "plugins/design/dev-server" . --include='*.{md,json,mjs,ts,tsx,jsx,yml,yaml,sh}' \
    | grep -v node_modules | grep -v '/dist/' | grep -v '.git/' > /tmp/refs-devserver.txt
  grep -rn "plugins/design/hub" . --include='*.{md,json,mjs,ts,tsx,yml,yaml,sh}' \
    | grep -v node_modules | grep -v '/dist/' > /tmp/refs-hub.txt
  ```
- **Gotcha**: Exclude `dist/` (committed build output — regenerated, not hand-edited) and `node_modules/`. Include `.md` + `.json` (CLAUDE.md, DDRs, plans, READMEs, `workflows.config.json`) — prose refs matter because CLAUDE.md is always-loaded.
- **Gotcha (`.ai/` is the bulk, mostly historical)**: ~1314 of the line-level hits live under `.ai/` (942 in `plans/` alone), and **most are historical record that must NOT be rewritten** (archived plans, closed DDRs, logs). Tag each `.ai/` hit in the inventory as **operative** (repoint — Task 7 list) or **historical** (leave). The "verify against zero" bar in Task 8 applies ONLY to operative refs; historical lines are expected to remain.
- **Validate**: `wc -l /tmp/refs-*.txt`; split the list into operative vs historical columns so Tasks 7-8 have an unambiguous repoint target.

### Task 2: REFACTOR — move the hub first (smaller blast radius, 30 refs)

- **Do**: `git mv plugins/design/hub apps/hub`. Update in the same commit: `pnpm-workspace.yaml` (`plugins/design/hub` → `apps/hub`), `cli/commands/hub.mjs` `hubRoot` resolution, `.github/workflows/hub-image.yml` build context + Dockerfile COPY paths, `CLAUDE.md` hub refs, root `package.json` `files` (hub is NOT in `files` — Docker-only — confirm it stays out), any `docker-compose*.yml.template` / `fly.toml.template` / `Caddyfile.template` internal paths.
- **Pattern**: hub ships as `ghcr.io/1agh/maude-hub` Docker image, frozen-install (`bun install --frozen-lockfile` against `apps/hub/bun.lock`) — the Dockerfile COPY context is the only build-path concern.
- **Gotcha**: The hub Dockerfile copies `node_modules` from a build stage (DDR-056 frozen-install invariant) — keep that two-stage shape, only the source path prefix changes.
- **Validate**: `cd apps/hub && bun run build:dry` (or `test`); `node cli/bin/maude.mjs hub --help` resolves; `docker build` context dry-check if available.

### Task 3: REFACTOR — move the dev-server (`git mv plugins/design/dev-server apps/studio`)

- **Do**: `git mv plugins/design/dev-server apps/studio` (single move, history preserved). Do NOT edit any file yet beyond the move — Tasks 4-7 repoint the references in tight, testable batches.
- **Gotcha (rename detection — keep move ≠ repoint)**: git does NOT store renames; it *infers* them at diff time by content similarity (default `-M50%` threshold). If the move and a large repoint landed in the SAME commit, heavily-edited files could fall under 50 % similarity and show as delete+add — losing `--follow` history (exactly the "zbytečný přepis" we're avoiding). Keeping Task 3 content-free guarantees clean renames; Tasks 4-7 then edit files that are already at their new path. Commit Task 3 on its own.
- **Gotcha**: `git mv` of a directory with a nested `node_modules/` is fine (gitignored); the committed `dist/runtime/*.js` bundles move with it and stay authoritative (CLAUDE.md release rule) — do NOT regenerate them as part of the move.
- **Validate**: `git status` shows renames (not delete+add); `ls apps/studio/server.ts apps/studio/paths.ts apps/studio/dist/runtime` all present.

### Task 4: UPDATE — `apps/studio/paths.ts` walk-up anchor (the single most critical edit)

- **Do**: In `resolveDevServerRoot()` change every literal `plugins/design/dev-server` segment in the walk-up logic to `apps/studio`. Verify all THREE runtime modes documented in the file header still resolve: (1) dev `bun server.ts`, (2) compiled npm binary (walks up from `process.execPath`), (3) marketplace-cache binary.
- **Pattern**: DDR-045 — NEVER reintroduce `dirname(fileURLToPath(import.meta.url))` for the project root; the walk-up-from-execPath is load-bearing for `bun --compile` binaries.
- **Gotcha**: Mode 3 (marketplace cache `~/.claude/plugins/cache/maude/design/<v>/dev-server/`) — confirm whether the marketplace cache path also changes. The marketplace copies the *plugin* (`plugins/design/`), and the dev-server ships via *npm* (`files`), so the marketplace-cache `dev-server/` subpath may be unaffected — **verify against the marketplace clone layout** before assuming. Record the finding in DDR-095.
- **Validate**: `cd apps/studio && bun -e "import('./paths.ts').then(p=>console.log(p.DEV_SERVER_ROOT))"` prints the real `apps/studio` dir, not `/$bunfs/root`.

### Task 5: UPDATE — CLI resolution constants (the headline invariant)

- **Do**: Repoint the 4 CLI sites from the invariant table: `design.mjs:263-264` (serve entry), `design.mjs:90-91` (bin dispatch), `resolveServerBinary` anchor, `hub.mjs:453`. Update `cli/lib/plugin-cli-reachability.test.mjs` regex/comments if they name the old path. Update `cli/lib/preflight.mjs` + `cli/commands/scenario-report.mjs` path-segment comments/arrays.
- **Pattern**: every site is `join(pkgRoot, <segments>)` — only the segment array changes (`['plugins','design','dev-server',...]` → `['apps','studio',...]`).
- **Gotcha**: `pnpm-workspace.yaml` dev-server member path must change in this batch too (`plugins/design/dev-server` → `apps/studio`) or `pnpm install` won't see the package.
- **Validate**: `node cli/bin/maude.mjs design serve --help`; `node cli/bin/maude.mjs design screenshot --help` (bin dispatch path resolves); `pnpm install` re-links workspace cleanly.

### Task 5b: ADD — `maude studio` alias for `maude design serve`

- **Do**: Register a top-level `studio` command that dispatches to `design serve`. In `cli/bin/maude.mjs`, add an alias so `maude studio [...args]` runs `design.mjs` with `serve` prepended:
  ```js
  // in COMMANDS dispatch: alias `studio` → `design serve`
  if (cmd === 'studio') {
    const { run } = await COMMANDS.design();
    return run({ args: ['serve', ...args.slice(1)], pkgRoot: PKG_ROOT });
  }
  ```
  Add `studio` to the `help`/usage output (`cli/commands/help.mjs` + the `maude design` usage block) as "`maude studio` — alias for `maude design serve` (boot the canvas studio)". Add a test mirroring `design.test.mjs` asserting `maude studio --root <x>` resolves the same serve path as `maude design serve --root <x>`.
- **Pattern**: thematically clean now that the dir is `apps/studio` — the verb matches the home. Keep `maude design serve` working too (alias, not replacement) so no existing docs/scripts/muscle-memory break.
- **Gotcha**: `studio` must be checked in `main()` BEFORE the `COMMANDS[cmd]` unknown-command branch (otherwise it errors as unknown). It is NOT added to the `COMMANDS` map (which would dispatch `studio.mjs` run with the wrong positional[0]); it's an explicit alias arm.
- **Validate**: `node cli/bin/maude.mjs studio --help` → design-serve usage; `maude studio --root <scratch>` boots the server (same `/_health` 200 as `design serve`); the new alias test passes.

### Task 6: UPDATE — root `package.json` (`files`, `scripts`) + Changesets

- **Do**: `files[]`: `plugins/design/dev-server` → `apps/studio`. `scripts`: repoint `start`/`dev`/`build`/`build:binary`/`test:dev-server` and any `--filter @maude/dev-server` / path-based invocations. Confirm Changesets workspace globs still match (DDR-001 single-publisher — root stays the only publisher).
- **Gotcha**: `files` is the npm shipping surface — if `apps/studio` isn't listed, `maude design serve` breaks for npm users (the exact regression class CLAUDE.md "Published npm surface" warns about). Double-check `dist/runtime` + `bin/` + `client/` + `whats-new.json` all ship under the new prefix.
- **Validate**: `npm pack --dry-run` (or `pnpm pack`) and grep the tarball file list for `apps/studio/server.mjs`, `apps/studio/bin/screenshot.sh`, `apps/studio/dist/runtime/*.js`, `apps/studio/whats-new.json`.

### Task 7: UPDATE — CI workflows + remaining docs sweep

- **Do**: `build-binaries.yml` (build context, `MAUDE_SKIP_RUNTIME_BUILD` step path, `check-runtime-bundles.sh` path, `.min-sizes.json` path), `hub-image.yml` (done in Task 2 — verify), `version-parity.yml` + `quality.yml` (any path globs). Sweep CLAUDE.md, READMEs, `docs/` for residual `plugins/design/dev-server` / `plugins/design/hub` prose.
- **Do (`.ai/` workspace — classify, then repoint ONLY operative refs)**: The `.ai/` tree carries **~1314 references across ~148 files** (bulk in `plans/` 942, `state/` 157, `decisions/` 112, `logs/` 66). **Do NOT blanket-rewrite** — most are historical record that must stand. Classify per subdir:
  - **MUST repoint (operative, live):**
    - `.ai/workflows.config.json` → `integrations.whatsNew.feed` currently `plugins/design/dev-server/whats-new.json` → `apps/studio/whats-new.json`. **Silent-killer if missed** — the `whats-new-entry` skill writes through this path. Verify against `config.schema.json`.
    - `.ai/state/STATE.md` (current state, active-task fields, codebase pointers).
    - `.ai/context/**` (e.g. `codebase-map.md` if present — agents read it as truth).
    - `.ai/docs/**` (operative reference docs).
    - `.ai/plans/*.md` that are **active / not yet archived** (incl. these two plans + the phase-26..32 native-collab plans that reference `apps/`-relative paths and `plugins/design/dev-server/`).
    - `.ai/scenarios/**` that drive real runs.
    - `.ai/release-guide.md`, `.ai/INDEX.md`, `.ai/README.md`.
  - **LEAVE as historical record (do NOT edit):** `.ai/plans/archive/**`, completed `.ai/archive/decisions/DDR-*.md` narrative, `.ai/logs/**`, `.ai/reviews/**`, `.ai/dev-logs/**`, `.ai/device/**`. The path in a closed DDR/log describes the world AT THAT TIME — rewriting it falsifies the decision/incident record.
  - **DDR exception (supersede, don't rewrite):** where a DDR encodes a STILL-LIVE invariant on the old path — DDR-045 (`paths.ts` walk-up), DDR-062 (`maude design <verb>` dispatcher), DDR-009/084 (binary resolution), DDR-001 (npm `files`) — do NOT edit the original; instead have **DDR-095 (Task 9) explicitly supersede/annotate** them with the new `apps/studio` location, and add a one-line "superseded by DDR-095 for path" pointer at the top of each if the convention allows. Record which DDRs got the pointer.
- **Do (site docs — explicit)**: Rewrite the public docs under `site/content/docs/**` that name the old paths or the launch command — at minimum `cli.mdx`, `getting-started.mdx`, `config-schema.mdx`, `recipes/monorepo.mdx`, `security.mdx`, the whole `hub/*.mdx` set (`index`, `deploy`, `linking`), `design/{bootstrap,categories}.mdx`, and every `commands-design/*.mdx` that references `plugins/design/dev-server` or `maude design serve`. Where a doc shows the launch command, also surface the new **`maude studio`** alias (Task 5b) as the primary form with `maude design serve` noted as the equivalent. Home/marketing pages (`site/app/(home)/*.tsx`) that hardcode paths: update too.
- **Gotcha (site docs)**: `site/lib/roadmap.json` is AUTO-GENERATED — do NOT hand-edit; it regenerates via `pnpm --filter @maude/site gen:roadmap` (Task 9). Touch only authored `.mdx` / `.tsx`. Verify the docs site still builds (`pnpm --filter @maude/site build` or the fumadocs `.source` regen) since `site/.source` indexes `content/docs`.
- **Pattern**: CLAUDE.md "Runtime bundles are committed and authoritative" + "Published npm surface" + "Dev-server helpers" sections all name the old path — update each.
- **Gotcha**: Leave historical DDRs' *narrative* intact where the old path is part of the record (e.g. "v0.18.0 shipped broken because…") — repoint only *operative* path references, annotate moved ones. Use judgment; note the policy in DDR-095.
- **Validate**: `grep -rn "plugins/design/dev-server\|plugins/design/hub" . --include='*.{md,json,mjs,ts,tsx,yml,yaml,sh}' | grep -v node_modules | grep -v /dist/` returns only the **historical** lines tagged in Task 1 (archived plans, closed DDR/log narrative) — every line tagged **operative** is gone. Spot-check `.ai/workflows.config.json` shows `apps/studio/whats-new.json` and `git grep -n "plugins/design/dev-server" .ai/state .ai/context .ai/docs` is empty.

### Task 8: VERIFY — full launch + workflow smoke against a scratch project

- **Do**: Prove the invariant end-to-end:
  1. `pnpm install` clean.
  2. Build the local binary or run source: `cd apps/studio && bun run build.ts`.
  3. In a scratch dir with a `.design/`: `node /abs/cli/bin/maude.mjs design serve --root /tmp/scratch` → poll `/_health` → 200.
  4. `maude design screenshot`, `maude design smoke`, `maude design runtime-health` all dispatch.
  5. Open a canvas in the browser via `/design:browse` flow — confirm `@maude/canvas-lib` virtual specifier still resolves (canvas-lib-resolver anchors off `DEV_SERVER_ROOT`).
- **Gotcha**: This is the literal test for "studio je furt pustitelné přes CLI a design workflow se nezměnil." If any step fails, the move is incomplete — do not merge.
- **Validate**: all 5 steps green; `pnpm test` (full suite incl. `apps/studio/test/` 112 files + `cli/` tests) passes.

### Task 9: REMOVE — scratch artifacts + record DDR-095

- **Do**: Delete `/tmp/refs-*.txt`. Author `DDR-095-runtime-apps-extracted-to-top-level.md`: the move, the CLI-invariant guarantee, the new `maude studio` alias (verb now matches the `apps/studio` home), the marketplace-cache finding from Task 4, the explicit deferral of the `packages/*` extraction (Phase 2 below), and the policy on historical-narrative path refs. Optionally append a what's-new entry for `maude studio` via the `whats-new-entry` skill.
- **Validate**: `scripts/check-version-parity.sh` (no version bump in this plan unless releasing); roadmap regen `pnpm --filter @maude/site gen:roadmap` (a plan moved/added).

---

## Phase 2 (DEFERRED / optional — documented, NOT executed in this plan)

Extract shared libs out of `apps/studio/` into `packages/*` so `apps/desktop` (Tauri) and `apps/studio` can both consume them without reaching into each other:

- `packages/canvas-lib/` ← `canvas-lib.tsx` + resolver (consumed via `@maude/canvas-lib`).
- `packages/draw-engine/` ← `draw/` (18 files; consumed by `draw-build`/`draw-proof`).
- `packages/exporters/` ← `exporters/` (11 files; PNG/PDF/SVG/PPTX/shadcn).

**Why deferred:** each extraction rewrites every internal import + the `runtime-bundle.ts` externalization list + the npm `files` surface again, multiplying regression risk for no end-user benefit *today*. Revisit when `apps/desktop` actually needs to import these standalone. Tracked in DDR-095.

---

## Validation

1. **Workspace**: `pnpm install` — clean re-link, all members resolve.
2. **Tests**: `pnpm test` — full suite (cli + `apps/studio/test/`) green.
3. **Build**: `cd apps/studio && bun run build.ts` — bundles regenerate; `check-runtime-bundles.sh` passes against `.min-sizes.json`.
4. **Tarball**: `npm pack --dry-run` — `apps/studio/**` present in shipped file list (Task 6 grep).
5. **CLI launch (the invariant)**: `maude design serve --root <scratch>` → `/_health` 200; `maude design screenshot/smoke/runtime-health` dispatch.
6. **Hub**: `cd apps/hub && bun test`; Docker build context resolves.
7. **CI dry-run**: `act` or push to a branch — `build-binaries.yml` + `hub-image.yml` green with new paths.
8. **No residual refs**: Task 7 grep returns only historical-narrative lines.
9. **Docs site**: `pnpm --filter @maude/site build` (or `.source` regen) succeeds with repointed `content/docs/**`; `maude studio` alias documented in `cli.mdx`.
10. **Alias**: `node cli/bin/maude.mjs studio --root <scratch>` boots == `design serve`; alias test green.

## Acceptance Criteria

- [ ] `apps/studio/` and `apps/hub/` exist; `plugins/design/` holds only plugin markdown surface (commands/agents/skills/hooks/templates/docs/CATEGORIES.md/dependencies*.json).
- [ ] **`maude design serve` + every `maude design <verb>` behave identically** (Validation 5 green) — the design workflow is unchanged for end users.
- [ ] `maude studio` alias boots the studio (same as `maude design serve`); `maude design serve` still works; alias documented in `help` + site `cli.mdx` and tested.
- [ ] `site/content/docs/**` repointed to new paths; docs site builds; `roadmap.json` regenerated (not hand-edited).
- [ ] `git log --follow apps/studio/server.ts` shows pre-move history (clean `git mv`).
- [ ] `pnpm test` + build + tarball + both CI workflows green.
- [ ] No operative reference to the old paths remains (only annotated historical narrative).
- [ ] DDR-095 recorded; `packages/*` Phase 2 explicitly deferred, not silently dropped.
- [ ] CLAUDE.md repointed (always-loaded context must not lie about paths).
- [ ] `.ai/` operative refs repointed (`workflows.config.json` feed → `apps/studio/whats-new.json`, `state/`, `context/`, `docs/`, active `plans/`); historical record (`plans/archive/`, closed DDRs, `logs/`) left intact; DDR-095 supersedes the live-invariant DDRs (045/062/009/084/001) for the path.
- [ ] Roadmap regen committed in the same change.

---

## Retro (2026-06-05)

**Outcome:** Landed clean. `apps/studio` + `apps/hub` exist, `plugins/design/` is surface-only, `maude studio` alias added, DDR-095 recorded, `/flow:validate` GREEN, adversarial security pass = no-new-exposure. Committed to `main` in 3 commits (`2dfc4ad` pure move → `05a0d9c` repoints → site-regen).

**What worked**
- **Pure-move-first commit discipline.** Committing the content-free `git mv` alone (339× R100) before any repoint gave clean `git log --follow` history — the acceptance criterion held exactly as designed. The split was worth the extra commit.
- **Verification found what grep couldn't.** The literal-string inventory (Task 1) caught ~1300 refs but **missed every depth-sensitive `../` walk** — the 5 real breaks (templates `_shell.html` + brief-board import, plugin.json reads, oxc/REPO_ROOT walks) surfaced ONLY under live `maude design serve` + the bun test suite. Lesson: for a relocation, the string grep is necessary but a live boot + full suite is the real gate.
- **Restoring `dist/` after every source boot.** The dev-server self-heal (DDR-044) regenerated env-sensitive runtime bundles each time I booted or ran `pnpm test:dev-server`; `git checkout -- apps/studio/dist/` after each was essential — committing those would have shipped the v0.22.0-class broken bundles.

**What didn't / friction**
- **Extension-filtered grep is a trap.** The Task-1 inventory used `--include='*.{md,json,…}'` and silently missed `.gitignore`, `biome.jsonc`, `.tpl`, `.mdx`, `Dockerfile`. `git status` (untracked build artifacts) and `biome` (7820 false errors) are what caught the gitignore + biome-scope misses. An extension-agnostic `git grep -Il` from the start would have surfaced these in Task 1.
- **The depth change (3-deep → 2-deep) was the whole hidden risk.** Every `../../..` repo-root walk and every `../<sibling>` reach had to be re-counted. A plan section enumerating "relative walks that escape the moved tree" up front would have front-loaded the 5 fixes instead of discovering them in Task 8.
- **Test-runner mismatch wasted a cycle.** Ran `bun test` on `apps/hub` (40 fails) before realizing the hub is Node-only (`better-sqlite3` ≠ Bun). The per-app `package.json` `test` script is the source of truth — read it before picking a runner.

**For next time (`/plan` + `/execute`)**
- For any **directory relocation**, add an explicit task: "grep the moved tree for `import …'../`, `join(ROOT/HERE, '..'…)`, and `\.\./\.\./` ancestor walks; re-derive each against the new depth" — these are invisible to a path-string sweep and are where relocations actually break.
- Bank the **"boot regenerates dist → restore before commit"** rule as a standing checklist item whenever a task boots the source dev-server (it's in CLAUDE.md but bit me 3× this run).
- The `packages/*` Phase 2 extraction (deferred in DDR-095) will hit the same depth + import-rewrite surface at larger scale — budget for live-boot verification, not just grep.
