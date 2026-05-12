# Phase 1: Contribute infrastructure + Changesets bootstrap

## Description

Establish the contribution baseline: documented "how to contribute" path, GitHub repo hygiene (PR / issue templates, branch protection docs, Dependabot), basic CI quality gates beyond version parity, and bootstrap Changesets in this repo as the release authoring tool. This is the foundation Phase 2 (docs site) and Phase 3 (flow ↔ design + changeset command) build on.

## User Story

As a first-time external contributor, I want clear `CONTRIBUTING.md`, a PR template that tells me what's expected, predictable CI checks, and `pnpm changeset add` in my workflow, so that my PR doesn't bounce on style nitpicks or unclear release expectations.

## Problem

- Repo has zero `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, PR template, or issue templates.
- CI only enforces version parity — no lint, no test, no link check.
- Releases are driven by `scripts/bump-version.sh` — opaque to contributors, no CHANGELOG.
- No Dependabot or scheduled dep updates.
- **No workspace / monorepo layout.** Phase 2 (Fumadocs site) and Phase 4 (dev-server bundler + Pixi.js) both need build-time dependencies in dedicated workspaces — bolting them on per-phase later would mean two refactor passes. Land the layout here as the canonical setup.

## Solution

1. **Monorepo layout** — adopt pnpm workspaces. Root `package.json` stays the single published npm package (`@1agh/md-claude`) with a strict `files` whitelist; internal workspaces (`site/`, `plugins/design/dev-server/`) are `"private": true` and never publish. Root scripts orchestrate per-workspace dev / build / test.
2. Author the contribution docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, security policy).
3. Add `.github/PULL_REQUEST_TEMPLATE.md` + `.github/ISSUE_TEMPLATE/*.yml` for bug / feature / docs.
4. Add Dependabot config for `npm` + `github-actions`.
5. Bootstrap Changesets (`pnpm install --save-dev @changesets/cli`, `pnpm changeset init`) wired so that publishing still flows through `scripts/check-version-parity.sh` (changesets writes versions → custom script propagates to plugin manifests → parity check guards).
6. Add `.github/workflows/quality.yml` — `pnpm lint` (biome) + `node --test cli/**/*.test.mjs` + link check on docs.
7. Document branch protection (cannot enforce from repo; document the recommended ruleset in `CONTRIBUTING.md`).

## Metadata

- **Type:** New Feature (infra)
- **Complexity:** Medium
- **Depends on:** —
- **Parallel with:** —
- **Affected files:**
  - `CONTRIBUTING.md` (new)
  - `CODE_OF_CONDUCT.md` (new)
  - `SECURITY.md` (new)
  - `.github/PULL_REQUEST_TEMPLATE.md` (new)
  - `.github/ISSUE_TEMPLATE/{bug,feature,docs}.yml` (new)
  - `.github/dependabot.yml` (new)
  - `.github/workflows/quality.yml` (new)
  - `.changeset/config.json` (new)
  - `pnpm-workspace.yaml` (new — `packages: [site, plugins/design/dev-server, plugins/design/hub]`) — `hub/` is Phase 9 territory but reserved here so the monorepo doesn't need a second restructure later
  - `pnpm-lock.yaml` (new — committed)
  - `package.json` (root) — add `workspaces`, expand `scripts` (`dev`, `build`, `test`, `lint`, `changeset`, `version`, `release`, `prepublishOnly`), add `devDependencies` (`@changesets/cli`, `@biomejs/biome`, `esbuild`, `pixi.js`, `pdf-lib`)
  - `biome.json` (new — root lint config)
  - `scripts/changesets-version.sh` (new — wraps `pnpm changeset version` to also bump plugin manifests via `bump-version.sh`)
  - `.github/workflows/publish.yml` (update — call new script, run `pnpm build` before publish)
  - `.github/workflows/auto-merge-dependabot.yml` (new — squash-merge Dependabot patch/minor after CI green)
  - `.github/CODEOWNERS` (new — `* @1aGh`)
  - `scripts/setup-github.sh` (new — idempotent `gh` CLI script applying branch protection, repo settings, labels, discussions categories)
  - `scripts/github/main-protection.json` + `scripts/github/labels.json` (new — payload for `gh api` calls)
  - `README.md` (link to CONTRIBUTING.md, doc the new release path + workspace layout + repo admin script)

---

## Tasks

### Task 0: Monorepo + workspace bootstrap

- **Do:**
  1. Add `pnpm-workspace.yaml` with `packages: [site, plugins/design/dev-server]` (Phase 2 + Phase 4 fill those dirs; `site/` is scaffolded empty here so the workspace exists).
  2. Update root `package.json`: `"workspaces": ["site", "plugins/design/dev-server"]`, expand `scripts` per "Solution" section, add `engines.pnpm` constraint (`>=9`). Keep `files` whitelist restrictive — only `plugins/design/dev-server/dist/**`, NOT the workspace's `package.json` or source.
  3. Create `plugins/design/dev-server/package.json` (stub) with `"private": true`, `"name": "@md-claude/dev-server"`. Empty `dependencies` for now — Phase 4 fills them.
  3a. Create `plugins/design/hub/package.json` (stub) with `"private": true`, `"name": "@md-claude/hub"`. Empty `dependencies`. Phase 9 (v1.1) fills with Hocuspocus. Reserving the workspace slot now avoids a second monorepo restructure.
  4. Run `pnpm install`, commit `pnpm-lock.yaml`.
  5. Add a smoke check to `scripts/check-version-parity.sh` (or a new script) asserting that `plugins/design/dev-server/package.json` is **not** in the npm tarball — run `npm pack --dry-run` and grep.
- **Pattern:** Identical layout to how `vitejs/vite` ships — root publishes a single package, workspaces are dev-only.
- **Validate:** `npm pack --dry-run` reports zero files from `node_modules/` and zero `plugins/**/package.json`. End-user install (`npm i -g @1agh/md-claude` against tarball) does not pull `pixi.js` or any transitive workspace dep.
- **DDR:** record the workspace strategy + "zero runtime deps" invariant.

### Task 1: Author CONTRIBUTING + COC + SECURITY

- **Do:** Write `CONTRIBUTING.md` covering: local setup, plugin development loop (cite README's "Local development" section), how to add a `pnpm changeset`, PR expectations, recommended branch protection. Write `CODE_OF_CONDUCT.md` (adopt Contributor Covenant v2.1). Write `SECURITY.md` with disclosure mailbox.
- **Pattern:** Mirror the structure used by `vercel/next.js` and `withastro/astro` (short, scannable, copy-paste commands).
- **Validate:** Read top-to-bottom; verify every command works against a fresh clone.

### Task 2: Add GitHub PR + issue templates

- **Do:** PR template asks for "Type of change", "Linked changeset?", and a brief "Why" section. Issue templates: `bug.yml` (with repro requirements), `feature.yml` (with "Have you considered an alternative?"), `docs.yml`.
- **Pattern:** YAML form templates (not the old `.md` style) — better UX in GitHub UI.
- **Validate:** Open a draft issue in a fork; confirm forms render.

### Task 3: Wire Dependabot

- **Do:** `.github/dependabot.yml` with weekly `npm` + `github-actions` updates, grouped patch/minor, opening against `main` with `chore(deps):` prefix.
- **Validate:** Push to a fork branch and confirm Dependabot sees the config (GitHub UI → Insights → Dependency graph).

### Task 4: Bootstrap Changesets

- **Do:** `pnpm i -D @changesets/cli && pnpm changeset init`. Configure `.changeset/config.json` with `"access": "public"`, `"baseBranch": "main"`, `"updateInternalDependencies": "patch"`.
- **Pattern:** Single-package mode (this repo publishes one npm package `@1agh/md-claude`). Plugin manifests are NOT separate packages — they get version-bumped via the wrapper script.
- **Validate:** `pnpm changeset add` produces a `.changeset/<name>.md`; `pnpm changeset status` reports it.

### Task 5: Custom version wrapper preserving parity

- **Do:** `scripts/changesets-version.sh` runs `pnpm changeset version`, then reads new version from `package.json`, then invokes `scripts/bump-version.sh <NEW>` to propagate to plugin manifests, then runs `scripts/check-version-parity.sh`.
- **Pattern:** Make `package.json` the source of truth post-changeset; plugins follow.
- **Validate:** Add a fake changeset, run script, verify all three manifests match.

### Task 6: Quality workflow

- **Do:** `.github/workflows/quality.yml` runs on PR + push to main: Node 20, install Biome, `pnpm biome check .`, `node --test --test-reporter=spec cli/lib/argv.test.mjs` (write a minimal test for `parseArgs` to anchor the test runner; full coverage comes later).
- **Pattern:** Biome over ESLint/Prettier — zero-config, fast, single tool.
- **Validate:** Run locally first (`pnpm biome check .` clean); push and verify CI green.

### Task 7: Update publish workflow

- **Do:** `.github/workflows/publish.yml` — replace bash bump with `scripts/changesets-version.sh` step before `npm publish`. Generate CHANGELOG via `pnpm changeset publish`. Auto-create GitHub Release with changelog entry.
- **Pattern:** Standard changesets + provenance flow.
- **Validate:** Manually trigger workflow on a `vX.Y.Z-rc.1` tag against test branch; confirm npm dist-tag `next` updated.

### Task 8: Configure GitHub repo via `gh` CLI

- **Do:** Run a `scripts/setup-github.sh` (idempotent) that applies branch protection, merge settings, and labels via `gh`:
  1. **Branch protection on `main`:**
     ```bash
     gh api -X PUT repos/1aGh/md-claude/branches/main/protection \
       --input scripts/github/main-protection.json
     ```
     Body asserts: required status checks (`Version parity check`, `Quality (lint+test+links)`), enforce admins, required reviews = 1, dismiss stale reviews on push, require linear history, require conversation resolution, no force push, no deletion.
  2. **Default branch + repo settings:**
     ```bash
     gh repo edit 1aGh/md-claude \
       --enable-squash-merge=true --enable-merge-commit=false --enable-rebase-merge=false \
       --enable-auto-merge=true --delete-branch-on-merge=true \
       --enable-issues=true --enable-discussions=true
     ```
  3. **Labels** (`gh label create` with idempotent `--force`): `type:feat`, `type:fix`, `type:docs`, `type:chore`, `type:refactor`, `scope:design`, `scope:flow`, `scope:cli`, `scope:site`, `scope:infra`, `priority:p0`, `priority:p1`, `priority:p2`, `good first issue`, `help wanted`, `blocked`, `needs:triage`, `needs:repro`, `needs:design`, `needs:DDR`. Color tokens taken from `.design/system/`.
  4. **Required workflows:** assert `quality.yml` + `version-parity.yml` are marked required via the protection rule above.
  5. **Secrets sanity:** `gh secret list` must show `NPM_TOKEN`; print a warning otherwise (don't fail — secrets are set manually).
  6. **CODEOWNERS:** generate `.github/CODEOWNERS` mapping `*` to `@1aGh` so reviews are auto-requested.
  7. **GitHub Discussions categories:** seed `Q&A`, `Show & tell`, `Ideas`, `Announcements` via `gh api graphql` mutation (best-effort; document manual fallback in script comments).
  8. **Auto-merge for Dependabot:** `.github/workflows/auto-merge-dependabot.yml` — merges Dependabot patch + minor PRs after CI green.
- **Pattern:** Script-as-documentation. Re-runnable so future maintainers can re-apply or fork the repo and rebrand. All curl-equivalent commands stay in version control.
- **Validate:** Run the script; verify in GitHub UI: branch protection rule visible, labels exist, squash-only merge, CODEOWNERS triggers review auto-assign on a test PR.
- **Affected files:** `scripts/setup-github.sh`, `scripts/github/main-protection.json`, `scripts/github/labels.json`, `.github/CODEOWNERS`, `.github/workflows/auto-merge-dependabot.yml`. Doc the script in `CONTRIBUTING.md` so contributors forking the repo know how to re-run it.

### Task 9: Update README

- **Do:** README "Releasing" section now points at `pnpm changeset add` for contributors, with `scripts/bump-version.sh` reserved for emergency manual bumps. Link to `CONTRIBUTING.md` from the top of README.
- **Validate:** README reads end-to-end without contradicting actual CI behavior.

---

## Validation

1. **Static:** `pnpm biome check .` + `pnpm changeset status` clean. Both new bash scripts are `set -euo pipefail` and pass `shellcheck`.
2. **CI:** New `quality.yml` green on a PR.
3. **Release rehearsal:** Tag `v0.5.0-rc.0` on a branch → confirm publish workflow runs through changesets without bumping plugin manifests in conflict with `bump-version.sh`.
4. **Doc audit:** Every command listed in CONTRIBUTING.md actually works against a fresh clone.

## Scenario coverage

This phase has no UI deliverable — no cross-platform scenario applies. Smoke check: a fresh contributor reads CONTRIBUTING.md → opens a PR with a changeset → CI passes.

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| (none — infra-only) | — | 🚫 N/A |

---

## Acceptance criteria

- [ ] `pnpm-workspace.yaml` + root workspaces config in place; `pnpm install` clean; lockfile committed.
- [ ] `plugins/design/dev-server/package.json` stub exists, `"private": true`.
- [ ] `plugins/design/hub/package.json` stub exists (`"private": true`, `"name": "@md-claude/hub"`, empty deps); workspace slot reserved for Phase 9 (v1.1).
- [ ] `npm pack --dry-run` confirms zero workspace `package.json` files in the tarball; `files` whitelist verified.
- [ ] Root scripts (`dev`, `build`, `test`, `lint`, `changeset`, `release`) all callable from root.
- [ ] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` present and accurate.
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` + at least 3 issue templates land.
- [ ] Dependabot opens its first PR.
- [ ] `pnpm changeset add` + `pnpm changeset status` works locally.
- [ ] `scripts/changesets-version.sh` propagates version to both plugin manifests; parity check passes.
- [ ] `quality.yml` runs and is green on a green PR.
- [ ] DDR recorded for workspace strategy ("monorepo with single npm publisher; workspaces never publish").
- [ ] DDR recorded for "release flow: changesets wrapping bump-version.sh" decision.
- [ ] `scripts/setup-github.sh` applied: branch protection on `main`, squash-only merge, auto-merge enabled, delete-branch-on-merge, labels seeded, CODEOWNERS in place, Dependabot auto-merge workflow active.
- [ ] `NPM_TOKEN` secret confirmed present (or warning logged) via `gh secret list`.
- [ ] README updated; no stale "scripts/bump-version.sh" as the primary release path (now secondary / manual fallback). New "Workspaces" subsection in README documents `pnpm dev`, `pnpm build`, `pnpm dev:site`. New "Repo administration" subsection points at `scripts/setup-github.sh`.

---

## Status (closeout 2026-05-12)

All 10 tasks landed. Local CI smoke green: `pnpm lint` clean, 7/7 tests pass, parity OK, tarball shape OK (42 files), Changesets queued for `@1agh/md-claude` minor bump.

Acceptance criteria — **met:**

- pnpm workspaces + root in workspace list + `scripts/check-tarball-shape.sh` invariant.
- Contributing trio (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).
- PR template + 4 issue templates (bug / feature / docs / + config router).
- Dependabot config (`npm` + `github-actions`, weekly, grouped).
- Changesets bootstrapped (`access: public`, root in workspace, status detects @1agh/md-claude).
- `scripts/changesets-version.sh` wrapper.
- `quality.yml` workflow (lint + test + tarball + parity) + `biome.json` + `cli/lib/argv.test.mjs`.
- `publish.yml` rewired through `pnpm version` + adds GitHub Release from CHANGELOG.
- `setup-github.sh` + JSON payloads + CODEOWNERS + `auto-merge-dependabot.yml`.
- README updated (Workspaces, reauthored Releasing, Repo administration).
- DDR-001 (monorepo-single-publisher) + DDR-002 (changesets-release-flow).

Acceptance criteria — **deferred:**

- *Dependabot opens its first PR* — happens after merge.
- *`quality.yml` green on a real PR* — happens when this PR opens.
- *`scripts/setup-github.sh` applied to live repo* — gated; maintainer runs it post-merge (script is idempotent).
- *NPM_TOKEN secret check via `gh secret list`* — secret already exists (existing `publish.yml` has been using it).

## Retro

- **Filter-blocked output:** initial attempt at the full Contributor Covenant 2.1 text in `CODE_OF_CONDUCT.md` hit Anthropic output filtering (the enumerated harassment examples pattern-match safety rules even in canonical anti-harassment context). Pivoted to a short file that **links** to the canonical Covenant — standard practice in many OSS projects. Same lesson for SECURITY.md: keep it terse, avoid "exploit/attack-vector/PoC" phrasing. → For future docs work, prefer link-to-canonical over inline for boilerplate text bodies with sensitive-looking content.
- **Biome scope creep:** `pnpm biome check --write --unsafe .` reformatted pre-existing dev-server JSX/CSS (≈2400 lines) before the ignore list landed. Reverted the JSX/CSS reformat at the `/done` review gate; kept the small `cli/**` auto-fixes (in scope for the Biome introduction). → Next time we adopt a formatter on a legacy codebase: write the `ignore` list **first**, run `--write` second.
- **Pre-existing a11y debt:** ignoring `plugins/design/dev-server/{client,runtime,server.mjs}` was the right call for Phase 1, but the debt (~80 errors: `useButtonType`, `useKeyWithClickEvents`, `noSvgWithoutTitle`, …) is now documented and load-bearing for any future dev-server work. → Worth a dedicated "dev-server a11y pass" issue.
- **Workspaces gotcha:** Changesets needs the root package listed in `pnpm-workspace.yaml` (`"."`) because we use single-publisher monorepo mode. Caught by `pnpm changeset status` (`Found changeset … for package … which is not in the workspace`), fixed in one line + a clarifying comment. → Document this pattern in the docs site (Phase 2) — non-obvious enough that the next person hitting it will lose 15 minutes.
- **DDR pacing was right:** authored two DDRs at the end of Phase 1 instead of mid-execute. Both are about decisions that were already made in planning — Phase 1 just materialized them, so the DDRs read as confirmations not pivots. Good cadence.
