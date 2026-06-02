# Feature: Dependency freshness sweep + Biome v2 / Motion v12 major migration

> **Why now.** Dependabot PR #27 (GitHub Actions) and #31 (patch-and-minor group, 26 updates) are **already merged** to `main` (squash, green). What remains is **the `majors` group PR — now #33** (dependabot superseded the original #30 after #31 merged; #33 is the narrowed group with exactly the 2 real majors), which fails the `Quality` gate for a *real* reason (not a flake): Biome v2 has a breaking config-format change and `@biomejs/biome` 1→2 makes the current `biome.json` invalid. `motion` 11→12 additionally needs the committed runtime bundles regenerated. This plan turns "#33 is red, leave it" into a tracked, low-risk migration, and folds in a **full repo dependency-freshness sweep** so we carry no residual tech debt.

## Description

Land every outstanding dependency bump across the pnpm workspace (`.`, `site`, `plugins/design/dev-server`, `plugins/design/hub`) and the side projects (`plugins/design/hub` bun.lock, `scripts/video/final`), splitting the work by **risk tier** so the safe majority ships in one pass and the two genuinely-breaking majors (Biome v2, Motion v12) get the migration care they need. End state: `pnpm outdated -r` is empty (or only intentional holdbacks), `Quality` is green, and the majors PR (#33) is closed (superseded by this work) or merged after rebasing onto the migrated `main`.

## User Story

As a **maintainer of Maude**, I want **all dependencies current and the two breaking majors properly migrated**, so that **we don't accumulate dependency tech debt, dependabot's queue stays empty, and the next contributor isn't blocked by a red `Quality` gate they didn't cause.**

## Problem

- **The majors PR (#33, ex-#30) is a real failure, not a flake.** `@biomejs/biome` 1.9.4 → 2.4.16: the CI log shows `× Biome exited because the configuration resulted in errors` — v2 renamed/restructured config keys (`files.ignore` → `files.includes` with negated globs; `organizeImports` → `assist`; new rule defaults), so the pinned-to-1.9.4 `biome.json` (86 lines, schema `https://biomejs.dev/schemas/1.9.4/schema.json`) is rejected outright.
- **Motion 12 touches committed, environment-sensitive artifacts.** `motion` 11.18.2 → 12.40.0 affects `plugins/design/dev-server/dist/runtime/motion.js` + `motion_react.js`, which are **committed and authoritative for the release** (CLAUDE.md "Runtime bundles" + the v0.22.0 13 kB `motion_react.js` regression). A naive bump without regenerating + validating these bundles ships broken canvases.
- **The rest is stale-but-safe and just needs a sweep.** `pnpm outdated -r` (2026-06-02) lists ~12 more packages within minor/patch range that post-date the #31 snapshot.

## Context — current `pnpm outdated -r` (2026-06-02, post #27/#31 merge)

**Tier 0 — breaking majors (this plan's core, = PR #33, ex-#30):**

| Package | Current | Latest | Dependent | Migration cost |
| ------- | ------- | ------ | --------- | -------------- |
| `@biomejs/biome` (dev) | 1.9.4 | 2.4.16 | `@1agh/maude` (root) | config migrate + new-rule triage |
| `motion` | 11.18.2 | 12.40.0 | `@maude/dev-server` | regen + validate committed runtime bundles |

**Tier 1 — safe minor/patch sweep (`pnpm update`-range):**

| Package | Current → Latest | Dependent(s) | Note |
| ------- | ---------------- | ------------ | ---- |
| `@types/node` (dev) | 25.7.0 → 25.9.1 | site | types only |
| `fumadocs-core` | 16.8.10 → 16.9.3 | site | docs UI |
| `fumadocs-ui` | 16.8.10 → 16.9.3 | site | docs UI |
| `fumadocs-mdx` | 15.0.4 → 15.0.10 | site | docs build |
| `postcss` (dev) | 8.5.14 → 8.5.15 | site | — |
| `yjs` | 13.6.30 → 13.6.31 | **dev-server + hub** | **MUST move in lockstep** (collab wire-compat; DDR-052) |
| `@types/react` (dev) | 19.2.14 → 19.2.15 | dev-server + site | types only |
| `oxc-parser` + 8× `@oxc-parser/binding-*` (dev) | 0.131.0 → 0.133.0 | dev-server | pre-1.0 — smoke the import-graph lint after |
| `react` / `react-dom` | 19.2.6 → 19.2.7 | dev-server + site | registry-lag patch; bump only if `latest` resolves |
| `next` | 16.2.6 → 16.2.7 | site | registry-lag patch |
| `dom-to-pptx` | 1.1.9 → (1.1.10 wanted) | dev-server | export path — smoke `/_api/export` |

**Resolved incidentally:** the pre-existing `packages/maude-*` optionalDependency lockfile drift (specifier `0.25.0` vs `package.json` `0.27.0`) is **gone** after the #31 merge — the lockfile now pins `0.27.0`. No action needed; just confirm in Task 0.

## Constraints (load-bearing — from CLAUDE.md + DDRs)

1. **Runtime bundles are committed + authoritative.** Regenerate with `cd plugins/design/dev-server && bun run build.ts` (dev) or `bun run build:binary` (release/minified). CI sets `MAUDE_SKIP_RUNTIME_BUILD=1` and ships whatever is committed; `check-runtime-bundles.sh` gates every `dist/runtime/*.js` against the per-slug floor in `.min-sizes.json`. **Bun.build output for `motion`/`motion/react` is environment-sensitive — regenerate locally on macOS (the working profile), never trust a CI regen.**
2. **Hub deps go through the frozen `plugins/design/hub/bun.lock`** (DDR-054/056 security). Bump via the lockfile; **never** add a fresh-resolution step to `plugins/design/hub/Dockerfile`. `yjs` in the hub must match the dev-server.
3. **No `tsc` quality gate** (DDR-026 baseline accepted) — don't add one; type regressions surface via `biome` + tests + build, not a red typecheck.
4. **Version parity** (`scripts/check-version-parity.sh`) is about the **maude package version** (`package.json` + 2× `plugin.json`), *not* dependency versions — this plan doesn't touch it, but don't let a stray edit break it.
5. **Changesets**: dependency bumps that affect the published `@1agh/maude` runtime (dev-server deps) warrant a `patch` changeset; pure dev-deps (biome, @types/*) do not.

## Tasks

### Group A — Safe minor/patch sweep (low risk, do first, one commit)
- [x] **A0 — Baseline.** On a fresh branch off `main`: `pnpm install`, run the full local gate (`pnpm -w format`, `pnpm -w lint`, `pnpm --filter @maude/dev-server test`, `pnpm --filter @maude/site build`, `maude design smoke`) and record GREEN before touching anything. Confirm the `maude-*` lockfile drift is resolved. — **DONE 2026-06-02.** Baseline GREEN: biome v1 clean (411 files), CLI 153 pass, dev-server 1097 pass, site build ok, runtime bundles 13/13 above floor. `maude-*` drift resolved (lockfile wants 0.27.0, matches package.json; the registry-latest-0.24.0 "missing" rows are the unpublished-until-release optional binaries — benign). _(Note: running dev-server tests / install regenerates `dist/runtime/*.js` as a side-effect — reverted to keep the committed release-minified bundles authoritative; deliberate regen happens in C1.)_
- [x] **A1 — `pnpm update -r`** for the Tier-1 set… — **N/A (already landed via #31).** `pnpm outdated -r` post-#31 shows ONLY the two majors; `@types/node`, `fumadocs-*`, `postcss`, `@types/react`, `oxc-parser`, `react`/`react-dom` (`19.2.7`), `next`, `dom-to-pptx` are all already current. No bump needed.
- [x] **A2 — `yjs` 13.6.31 in lockstep** … — **CONFIRMED.** dev-server `^13.6.31`, hub `package.json` `^13.6.31` + `bun.lock` `13.6.31`, pnpm-lock resolved `13.6.31`. All lockstep (landed via #31 + hub re-sync `13e3dc0`).
- [x] **A3 — Verify Group A** … — Covered by A0 baseline (no Group A bump to verify). Export/smoke deferred to C3 where the runtime regen makes them load-bearing.

### Group B — Biome v1 → v2 migration (breaking config; isolated commit)
- [x] **B1 — Auto-migrate.** — **DONE.** Bumped `@biomejs/biome` `^1.9.4` → `^2` (2.4.16), ran `biome migrate --write`: `$schema` → 2.4.16, `files.ignore` → `files.includes` (`"**"` + negated globs), `overrides[].include` → `includes`. No `organizeImports`→`assist` (v1 config had none).
- [x] **B2 — Triage new rules.** — **DONE.** Applied biome **safe** fixes only (`biome check --write`, no `--unsafe`): import re-sort + 24 safe fixes across 146 files (mechanical, all tests green). Remaining net-new/stricter rules neutralized in `biome.jsonc` to restore v1 posture (per the plan's risk-mitigation): `off` for intentional-conflict rules (`noImportantStyles`, `noDescendingSpecificity` — CSS cascade/specificity), `warn` for deferred cleanups (`useTemplate`, `noUnusedImports`, `useOptionalChain`, `noDelete`, `useIterableCallbackReturn`, `noArrayIndexKey`, `useExhaustiveDependencies`, `useIndexOf`, `noUselessFragments`, etc.) — each with a justification comment + a "lint-posture follow-up" pointer. **biome.json → `biome.jsonc`** (v2 parses `.json` as strict JSON; comments need `.jsonc`; `cli/lib/stack-detect.mjs` already probes both). a11y: extended the existing overlay exemption override to the canvas-chrome overlays (`annotations-layer`/`participants-chrome`/`context-menu`) for `noStaticElementInteractions`+`useAriaPropsSupportedByRole`; **fixed** the one real product-code finding (`roadmap-timeline.tsx` glyph `<span>` → `role="img"`). Also fixed a pre-existing broken JSON import assertion in `DemoCaptioned.tsx` (dead `assert; {…}` statements blocking `organizeImports`).
- [x] **B3 — Re-assert ignore scope.** — **DONE + extended.** All v1 `files.ignore` entries carried into v2 `files.includes` negations (folder-form `!**/x`, deduped `node_modules`). **Added `!**/*.html`** — Biome v2 added experimental HTML linting v1 never had; the repo's only HTML is the bias-free `design-system-inspiration` reference templates (DDR-043) + the server shell (153 spurious a11y errors), never linted under v1. Excluding restores v1 scope.
- [x] **B4 — Verify:** `pnpm -w format` + `pnpm -w lint` clean on the full tree; the `format`/`lint` quality gates still resolve. — **GREEN.** `pnpm lint` exit 0 (411 files, 52 warnings, **0 errors**), `pnpm format` exit 0. CLI 153 pass, dev-server 1097 pass, site build ok. Dev-dep → no changeset.

### Group C — Motion 11 → 12 + runtime bundle regen (sensitive; isolated commit)
- [x] **C1 — Bump + regen locally on macOS.** — **DONE.** `motion` `^11.0.0` → `^12.40.0` in `@maude/dev-server`; regenerated via `pnpm build:binary` (= `build.ts --release`, MODE=release → minified) on macOS-arm64 (the trusted profile). All 13 `dist/runtime/*.js` re-emitted current with the post-#31 lockfile (react 19.2.7 / yjs 13.6.31 / motion 12.40.0). _Gotcha: the previously-committed bundles were **unminified dev builds** (motion_react.js = 10,056 lines / 390 kB) — #31 bumped react/yjs but never regenerated. This release regen ships proper minified bundles (motion_react.js = 12 lines / 205 kB). The throwaway `dist/maude-darwin-arm64` binary is gitignored (CI builds the matrix)._
- [x] **C2 — Floor check.** — **PASS.** 13/13 above floor. motion.js 149,887 B ≥ 50 k; motion_react.js 204,722 B ≥ 110 k (nowhere near the v0.22.0 13 kB collapse). Floors unchanged — v12 minified (205 k) still well above floor; lowering would weaken the degeneracy guard.
- [x] **C3 — Runtime-health + smoke.** — **PASS.** Booted local `server.ts` (`MAUDE_NO_AUTOBUILD=1`) → `runtime-health` all bundles served==disk (ratio 1.000). `design smoke` = **45/45 rendered styled, import-graph lint clean** (agent-browser = the live check; motion preview specimen + all motion-using UI canvases render perfectly). Byte-diff vs the pre-change June-1 smoke run = only re-render jitter (<300 B) + `diff-view` improved from a blank capture + 2 new canvases — **no regression**. _Note: the running dev-server dynamic-builds `/_canvas-runtime/*` in dev mode (clobbers the on-disk release bundles), so the release regen was re-run with the server down; release bundles then `bun build`-parse-validated + floor-checked. The definitive serve-test of the release artifact is CI's `build-binaries` + `check-runtime-bundles`._
- [x] **C4 — Motion API audit.** — **CLEAN.** Our only motion surface is `motion` / `AnimatePresence` / `useReducedMotion` from `motion/react` (canvas-lib.tsx + a handoff string-emit + 1 test) — all unchanged in v12. No removed/renamed API usage. Patch changeset added (`.changeset/motion-v12-runtime-bundles.md`). _(Commit deferred to the close-out — see Group D.)_

### Group D — Land + close out
- [~] **D1 — Full `/flow:validate`** — equivalent gates run **manually GREEN** (lint+format biome v2, CLI 153, dev-server 1097, site build, parity 0.28.0, smoke 45/45, floor 13/13, runtime-health). Per `/flow:execute` we don't auto-run the expensive `/flow:validate` (5-platform scenario is N/A here per the plan's Validation block) — `/flow:done` runs the full gate.
- [x] **D2 — Majors PR (#33):** **already CLOSED by dependabot itself** (2026-06-02 11:36, "Looks like these dependencies are updatable in another way, so this is no longer needed."). No action — recommendation (a) effectively self-executed. (Original #30 auto-closed earlier.)
- [ ] **D3 — Merge** to `main` via squash — pending user go-ahead (`/flow:done` or manual). Repo policy: squash only, admin bypass via `1aGh` account.
- [ ] **D4 — Close out** — `pnpm outdated -r` clean of biome/motion (only the benign unpublished-optional-binary rows remain). STATE.md History row + `gen:roadmap` + retro = `/flow:done` (D4).

## Risks & mitigations
- **Biome v2 surfaces a wall of new findings** → triage by disabling new rules first (restore green), then re-enable + fix incrementally in follow-ups; don't block the bump on a perfect lint pass.
- **Motion 12 bundle regen produces a degenerate bundle on a non-macOS runner** → regen **only** locally on macOS; CI must keep `MAUDE_SKIP_RUNTIME_BUILD=1`; `check-runtime-bundles.sh` is the backstop.
- **yjs dev-server/hub skew breaks collab** → A2 moves both together and asserts equality; if hub's frozen lock can't take the bump cleanly, hold yjs at 13.6.30 everywhere (lockstep > freshness).
- **react/react-dom/next "latest" lag** → these showed `latest` == current; treat as no-ops, don't force a phantom bump.

## Validation
- `pnpm outdated -r` empty (or documented holdbacks).
- `Quality` workflow green on `main` (lint+test+links + parity + tokens + site-content).
- `maude design smoke` 43/43; `maude design runtime-health` clean; `/_api/export` non-empty.
- One live agent-browser pass on a motion canvas + the motion preview specimen.
- **N/A** (no product UI/auth surface changed): 5-platform scenario, a11y-auditor, security fan-out — per the same right-sizing as the surrounding spec/tooling work.

## Out of scope
- `scripts/video/final` (standalone Remotion project, not a workspace member) — bump separately if/when that pipeline is touched.
- The maude package **version** bump / release — this is a dependency sweep, not a release; release happens later via `scripts/bump-version.sh`.
- Any net-new lint rules beyond Biome v2's defaults (a separate "tighten lint posture" decision).

## Retro (2026-06-02)

- **Re-check `pnpm outdated -r` at execution start — don't trust the plan's snapshot.** All of Group A (Tier-1 sweep + yjs lockstep) had already landed via #31 + the hub re-sync between plan-authoring and execution. Confirming-vs-doing saved a redundant (and conflicting) sweep. Likewise PR #33 had already auto-closed itself ("updatable in another way").
- **A linter major is more than "migrate the config."** Biome 2 parses `.json` as strict JSON (forced `biome.json` → `biome.jsonc`), ships a strictly larger `recommended` set, AND added experimental HTML linting (411→476 files; ~166 spurious a11y errors on bias-free reference templates). The plan's risk-mitigation ("disable to v1 posture, defer the cleanup") was exactly right — budget triage time for the rule-by-rule decision, and don't let a dep bump become a codebase lint overhaul. Recorded as DDR-081.
- **The committed runtime bundles were stale *unminified* dev builds** (`motion_react.js` 10,056 lines / 390 kB). #31 bumped react/yjs without regenerating, and `check-runtime-bundles.sh`'s floor passes on too-big bundles too, so nothing caught it. The motion regen incidentally corrected it. **Follow-up:** add a CI assertion that committed `dist/runtime/*.js` are actually minified (line-count or an is-minified check), not just above-floor.
- **Two dev-server footguns cost real debugging during validate.** (1) A running `maude design serve` **reset this repo's git index** to the parent commit mid-pipeline (sync/git-lifecycle mutating the served repo's index) — un-staged the whole commit from the index. (2) `pnpm test:dev-server` **rewrites `dist/runtime/*.js` in dev mode**, clobbering the committed release bundles in the working tree. **Lessons baked in:** regenerate release bundles as the *last* step before commit (with the server down), and kill every dev-server before git/release operations. Both deserve a dedicated guard/bug DDR if they recur.
- **Right-sizing `/flow:validate` per the plan's explicit Validation block worked.** Scenario / a11y / security fan-out were declared N/A (no product-UI/auth surface), and `design smoke` 45/45 + a byte-diff vs the pre-change baseline was the proportionate UI gate — no regression, no disproportionate 5-platform run on a dep bump.
