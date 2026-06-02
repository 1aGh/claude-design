# Feature: Dependency freshness sweep + Biome v2 / Motion v12 major migration

> **Why now.** Dependabot PR #27 (GitHub Actions) and #31 (patch-and-minor group, 26 updates) are **already merged** to `main` (squash, green). What remains is **PR #30 — the `majors` group**, which fails the `Quality` gate for a *real* reason (not a flake): Biome v2 has a breaking config-format change and `@biomejs/biome` 1→2 makes the current `biome.json` invalid. `motion` 11→12 additionally needs the committed runtime bundles regenerated. This plan turns "#30 is red, leave it" into a tracked, low-risk migration, and folds in a **full repo dependency-freshness sweep** so we carry no residual tech debt.

## Description

Land every outstanding dependency bump across the pnpm workspace (`.`, `site`, `plugins/design/dev-server`, `plugins/design/hub`) and the side projects (`plugins/design/hub` bun.lock, `scripts/video/final`), splitting the work by **risk tier** so the safe majority ships in one pass and the two genuinely-breaking majors (Biome v2, Motion v12) get the migration care they need. End state: `pnpm outdated -r` is empty (or only intentional holdbacks), `Quality` is green, and PR #30 is closed (superseded by this work) or merged after rebasing onto the migrated `main`.

## User Story

As a **maintainer of Maude**, I want **all dependencies current and the two breaking majors properly migrated**, so that **we don't accumulate dependency tech debt, dependabot's queue stays empty, and the next contributor isn't blocked by a red `Quality` gate they didn't cause.**

## Problem

- **PR #30 is a real failure, not a flake.** `@biomejs/biome` 1.9.4 → 2.4.16: the CI log shows `× Biome exited because the configuration resulted in errors` — v2 renamed/restructured config keys (`files.ignore` → `files.includes` with negated globs; `organizeImports` → `assist`; new rule defaults), so the pinned-to-1.9.4 `biome.json` (86 lines, schema `https://biomejs.dev/schemas/1.9.4/schema.json`) is rejected outright.
- **Motion 12 touches committed, environment-sensitive artifacts.** `motion` 11.18.2 → 12.40.0 affects `plugins/design/dev-server/dist/runtime/motion.js` + `motion_react.js`, which are **committed and authoritative for the release** (CLAUDE.md "Runtime bundles" + the v0.22.0 13 kB `motion_react.js` regression). A naive bump without regenerating + validating these bundles ships broken canvases.
- **The rest is stale-but-safe and just needs a sweep.** `pnpm outdated -r` (2026-06-02) lists ~12 more packages within minor/patch range that post-date the #31 snapshot.

## Context — current `pnpm outdated -r` (2026-06-02, post #27/#31 merge)

**Tier 0 — breaking majors (this plan's core, = PR #30):**

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
- [ ] **A0 — Baseline.** On a fresh branch off `main`: `pnpm install`, run the full local gate (`pnpm -w format`, `pnpm -w lint`, `pnpm --filter @maude/dev-server test`, `pnpm --filter @maude/site build`, `maude design smoke`) and record GREEN before touching anything. Confirm the `maude-*` lockfile drift is resolved.
- [ ] **A1 — `pnpm update -r`** for the Tier-1 set (explicitly, not blanket): `@types/node @types/react postcss fumadocs-core fumadocs-ui fumadocs-mdx oxc-parser "@oxc-parser/binding-*"`. Then `react react-dom next dom-to-pptx` **only if** `latest` actually resolves above current (skip registry-lag no-ops).
- [ ] **A2 — `yjs` 13.6.31 in lockstep** across `@maude/dev-server` (pnpm) **and** `@maude/hub` (bun.lock — `cd plugins/design/hub && bun update yjs`, commit the lock). Assert both resolve to the same minor.
- [ ] **A3 — Verify Group A:** dev-server test suite, `maude design smoke` (43/43), `/_api/export` smoke (PPTX/PDF path for `dom-to-pptx`), site build, biome clean. Commit `chore(deps): minor/patch sweep` (+ `patch` changeset for the dev-server-facing deps).

### Group B — Biome v1 → v2 migration (breaking config; isolated commit)
- [ ] **B1 — Auto-migrate.** `pnpm dlx @biomejs/biome@2 migrate --write` (or bump the dep first, then `biome migrate`). This rewrites `biome.json` (key renames, `$schema` → v2 URL, `files.ignore` → `files.includes` negations).
- [ ] **B2 — Triage new rules.** `biome check .` will surface v2's new recommended-rule violations. For each: fix the code if cheap, else explicitly disable with a one-line justification comment in `biome.json` (match the project's existing rule posture — don't silently widen scope).
- [ ] **B3 — Re-assert ignore scope.** Verify the v2 `files.includes` still excludes everything the v1 `files.ignore` did (`.ai/**`, `.design/**`, `dist/**`, `client/**`, `runtime/**`, `server.mjs`, `site/.next/**`, generated reference docs, `scripts/video/.work|.cache`, etc.) — a missed negation = thousands of spurious findings.
- [ ] **B4 — Verify:** `pnpm -w format` + `pnpm -w lint` clean on the full tree; the `format`/`lint` quality gates (read by `/flow:utils-verify` + `/flow:validate`) still resolve. Commit `chore(deps): migrate to Biome v2` (dev-dep → no changeset).

### Group C — Motion 11 → 12 + runtime bundle regen (sensitive; isolated commit)
- [ ] **C1 — Bump + regen locally on macOS.** `pnpm --filter @maude/dev-server add motion@12`, then `cd plugins/design/dev-server && bun run build:binary` to regenerate `dist/runtime/motion.js` + `motion_react.js` (+ any others Bun re-emits).
- [ ] **C2 — Floor check.** `bash plugins/design/dev-server/bin/check-runtime-bundles.sh` (or the CI step) — assert `motion_react.js` is well above the `.min-sizes.json` floor (the v0.22.0 regression was a 13 kB vs 155 kB+ collapse). Update `.min-sizes.json` floors only if the legitimate new size moved.
- [ ] **C3 — Runtime-health + smoke.** Boot the dev-server, run `maude design runtime-health` (HEAD-probe every `/_canvas-runtime/*.js`, body-size vs on-disk), then `maude design smoke` — catches the "parse-clean, fails-at-module-eval" class (`AcceleratedAnimation is not defined`). Live agent-browser check of one motion-heavy canvas + the `system/*/preview/motion.tsx` specimen.
- [ ] **C4 — Motion API audit.** Grep canvas-lib + previews for any motion API removed/renamed in v12 (check the motion 12 migration notes for `AnimatePresence`, `useAnimate`, layout APIs). Fix usages. Commit `chore(deps): motion v12 + regen runtime bundles` (+ `patch` changeset — ships in `@1agh/maude`).

### Group D — Land + close out
- [ ] **D1 — Full `/flow:validate`** on the combined branch (format → lint → tests → build → custom gates: parity/tarball/tokens/site-content). All green.
- [ ] **D2 — Decide PR #30:** either (a) close #30 with a comment pointing at this branch's commits (cleanest — our migration supersedes dependabot's raw bump), or (b) rebase #30 onto migrated `main` and squash-merge if it now passes. Recommend (a).
- [ ] **D3 — Merge** to `main` via squash (repo policy: no merge commits, no rebase-merge, admin bypass via the `1aGh` account). Confirm CI green on `main`.
- [ ] **D4 — `pnpm outdated -r` == empty** (or document intentional holdbacks). STATE.md History row + `pnpm --filter @maude/site gen:roadmap`. Retro: capture any motion/biome gotchas for next major sweep.

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
