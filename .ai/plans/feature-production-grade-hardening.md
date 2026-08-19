---
name: production-grade-hardening
status: active
created: 2026-08-05
rescoped: 2026-08-19
decisions:
  - kg:debate-production-grade-stack-direction (divergent debate, 2026-08-05, converged 3-0)
  - kg:debate-shared-layer-architecture (divergent debate round 2, 2026-08-05, converged 4-0 — import spine / vendor edge)
  - kg:debate-maturity-escalation (round 3 + online research, 2026-08-05, 4-0 escalate)
  - kg:maude/debate-v1-gate-set (divergent debate round 4, 2026-08-19, 4-0 gate — THIS re-scope; supersedes the 5-phase sequencing below the line)
---

# Feature: v1.0.0 gate-set — production-grade hardening, re-scoped to what gates the tag

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The original 5-phase program (2026-08-05, rounds 1–3) was written when the repo's dominant risk was code hygiene (untested client monolith, untyped `.mjs`, forked CSS). The 63 commits of `feat/sync-journal-file-plane` changed the dominant risk to **data custody over a transport the threat model calls untrusted** (DDR-226 journal file plane, deletions propagating, `.design/` syncing by default, self-hosted hub + OIDC).

Round 4 (2026-08-19, BUILDER/SHIPPER/BREAKER/USER-ADVOCATE, blind openings + one cross-challenge) converged **4-0: gate v1.0.0 on a narrow mechanical set — and do NOT execute the 24-task program first.** Phases 2–4 and most of Phases 1/5 move to [`feature-post-1.0-hardening-backlog.md`](feature-post-1.0-hardening-backlog.md). The user resolved the two open forks: **no consent/defaults machinery for 1.0** (Maude has no external users yet — sync defaults ship ON as the branch has them; the DDR-064 A7 notice stays tracked debt, binding before first external users / Increment 8), and **the gate binds directly to v1.0.0** (no 0.61.0 intermediate).

Key round-4 measurements that re-scoped the old tasks:

- `tsc --noEmit` on the current surface = **28 errors** (3 in `sync/`, two genuine nullability defects). `sync/**` IS transitively checked — but **71 tracked source files are reached by NO checker** because `include` lacks `*.tsx` (among the orphans: `canvas-lib.tsx`, the overlays, `commands/**`). T0c is a one-sitting fix, not a phase.
- **No CI job runs `tsc` at all**, and the 289-file studio `bun:test` suite (incl. the 13 sync tests) runs in **no workflow**. The hub leg of old-T0a is already satisfied by `main` (66 files run per-PR via root `pnpm test`).
- One genuinely **RED** test sits on the branch: `apps/studio/test/sync-seed-defers-to-hub.test.ts` — empty replica clobbers hub state (`local-adopt` where `defer-hub-state` is expected). Data-loss-shaped; untracked (concurrent session).
- **No canary mechanism exists**: `scripts/bump-version.sh:77` rejects prerelease strings, `npm publish` carries no `--tag` (build-binaries.yml:182/290), the Tauri updater endpoint has no channel dimension — and the `v*.*.*` workflow globs would MATCH `v1.0.0-rc.1`, rolling the fleet + npm `latest`. **An rc tag is more dangerous than no rc**; live drills go through `workflow_dispatch`.
- The containment argument in `apps/hub/src/journal.mjs` (~line 424) states its own expiry — "it stops being contained the moment Increment 6 wires tombstone application" — and tombstone application IS wired (`sync/index.ts` imports `tombstone-apply`). F-1 must be re-argued or closed with a hub-door delete breaker.

## User Story

As the maintainer of Maude I want v1.0.0 to be gated by the small set of checks that actually bound the sync arc's blast radius (red test, unchecked types, ungated delete/injection lanes, unrehearsed release mechanics), so that the first release carrying the file plane to the whole fleet is verified — without spending weeks on hygiene refactors users never see.

## Problem

The `v1.0.0` tag is simultaneously: npm publish of 8 packages, hub image, desktop builds + auto-update offer to every install, and **the only mechanism that rolls the cloud fleet** — carrying the entire sync arc at once, with sync defaults ON. Today the branch would ship with a red data-loss-shaped test no CI would ever see, an expired containment argument on the delete lane, a prompt-injection lane into agent-read files, and release mechanics that failed twice before (v0.57.0, v0.58.0) and have never been rehearsed with this arc.

## Solution

Three phases, strictly ordered: **harden on branch → full validate → merge → workflow_dispatch live drills → tag v1.0.0.**

Not merge-then-harden (main must stay tag-able; `cells-deploy.yml` fires on a main push touching `apps/hub`/`apps/cells` paths). Not tag-then-harden (the tag IS the delivery mechanism; there is no post-tag staging, and a 1.0.1 cannot un-delete a file).

## Metadata

- **Type**: Refactor / Release hardening
- **Complexity**: Medium (each task is bounded; the program is days, not weeks)
- **App/Package**: apps/studio (sync, tsconfig, tests), apps/hub (journal door), .github/workflows, scripts/
- **Affected Systems**: quality CI, release workflows, sync file plane, hub write door
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, read every file listed here in parallel in a single assistant message — they're independent context loads.

- `apps/studio/test/sync-seed-defers-to-hub.test.ts` — the RED test (untracked; from a concurrent session — coordinate before adopting). Expected `defer-hub-state`, got `local-adopt`.
- `apps/studio/sync/migrate-seed.ts` (lines ~100–200) — `local-adopt` / `defer-hub-state` decision; the fix target for A1.
- `apps/studio/sync/file-ledger.ts:301` + `apps/studio/sync/index.ts:1246` — the two genuine nullability defects in the sync lane.
- `apps/studio/tsconfig.json` — `include` lacks `*.tsx` and the orphan roots; A2 completes it.
- `.github/workflows/quality.yml` — already installs Bun 1.3.3 AND runs `bun install --frozen-lockfile` in `apps/studio` (cloud-binary gate), so A3's sync-lane gate is ~3 lines of YAML + ~50 s.
- `apps/hub/src/journal.mjs` (lines ~400–440) — `recordWrite` classifier invariant + the expired containment comment. A4's F-1 target.
- `apps/studio/sync/file-membership.ts` + `apps/hub/src/file-membership.mjs` — the byte-identical classifier pair (drift tripwire in `sync-file-membership.test.ts`); A4 extends the owner-gate here.
- `apps/studio/sync/index.ts` (lines ~1482–1497) — the existing `_untrusted/INDEX.json` + managed `.claudeignore` machinery A4 reuses; (lines 1567, 3234) — the DDR-064 A7 one-time notice (stays debt, do not build UI for it now).
- `apps/studio/git/endpoints.ts:88` + `apps/studio/git/watch.ts:53` — where `designRel` flows toward git (A5, F-13/B12).
- `.github/workflows/build-binaries.yml` (lines ~170–200, ~280–310) — `publish-main` `needs:` and the un-`--tag`ged `npm publish`; A6 target.
- `.github/workflows/build-desktop.yml` — the blank-window gates (`check-bundle-completeness --smoke`, `check-client-boots`) that A6 must put in front of npm publish.
- `.ai/plans/archive/feature-sync-burn-down-and-shared-doc.md` § "Inherited security findings" — the full F-*/B-* list; A4/A5 close F-1, B8/F1, F-13/B12; the rest is named backlog.
- `scripts/dev/sync-e2e.mjs`, `scripts/dev/journal-e2e.mjs`, `scripts/dev/local-cell.mjs` — existing harnesses B2's drills build on.
- `.ai/release-guide.md` — the runbook C1 follows; § "Verify the fleet actually rolled".

### Files to Create

- `scripts/check-tsc-coverage.sh` — asserts `tsc --listFiles` covers every tracked non-test `.ts`/`.tsx` under `apps/studio` (A2's tripwire so orphans can't reappear).
- `.github/workflows/` additions inside `quality.yml` (A3) — required sync-lane job + non-blocking full-suite job. No new workflow file needed.
- `apps/hub/test/journal-delete-breaker.test.mjs` (A4) — hub-door tombstone gate tests, both directions.

### Patterns to Follow

- Gates: `scripts/check-version-parity.sh` / `check-import-coherence.sh` — small loud bash checks wired into CI.
- Tests: `apps/studio/test/sync-*.test.ts` under `bun:test`; hub `node --test` under `apps/hub/test/`.
- Memory rules that bind here: **regression tests must fail first** (revert the fix, watch red); **test sync in both directions** (cloud and desktop are not symmetric); **never run the studio `bun test` while the hub suite runs** (parallel contamination); `git status apps/studio/dist/` before AND after any `bun test` run.

---

## Tasks

Execute in order. **Phase gates are hard: no Phase B until every Phase A task is green; no tag until B2's drills pass.**

### Phase A — harden on branch

#### A1: FIX the red seed test (data-loss shape) and adopt it
- **Do**: Coordinate with the concurrent session that authored `apps/studio/test/sync-seed-defers-to-hub.test.ts` (untracked), adopt the file, and fix `migrateSeed` so an empty replica against a hub whose listing says the document holds bytes returns `defer-hub-state`, never `local-adopt`.
- **Gotcha**: verify the test fails BEFORE the fix (memory: two tests once passed against the bug they guarded). Run the studio suite alone, never alongside the hub suite.
- **Validate**: `cd apps/studio && bun test test/sync-seed-defers-to-hub.test.ts` green; `git status apps/studio/dist/` clean before/after.

#### A2: REPAIR the studio typecheck surface and drive it to 0
- **Do**: Complete `apps/studio/tsconfig.json` `include` — add `"*.tsx"` and the orphan roots (`commands/**`, `sync/**`, `collab/**`, `git/**`, `exporters/**`, `photo/**`, …) so all 71 currently-unreached files (incl. `canvas-lib.tsx`) are checked. Add `scripts/check-tsc-coverage.sh` (listFiles assertion). Fix the ~28 baseline errors — `sync/file-ledger.ts:301` (cursor narrowing) and `sync/index.ts:1246` (`string|null`) first; if the completed surface raises the count, baseline + ratchet non-increasing, target 0 before tag.
- **Gotcha**: the canvas tree may deliberately compile only under the bundler — if so, a second `tsconfig.canvas.json`, checked somewhere, not nowhere.
- **Validate**: `cd apps/studio && bun tsc --noEmit` → 0 errors; coverage script green.

#### A3: ADD the sync-lane CI gate (required) + full suite (non-blocking), + typecheck
- **Do**: In `quality.yml` (toolchain already present after the cloud-binary gate): (1) **required**: `cd apps/studio && bun test test/sync-*.test.ts` (~43 files, ~32 s) and `bun tsc --noEmit`; (2) **non-blocking** (`continue-on-error: true`, named job): the full `bun test` studio suite — clean-CI data, not a contaminated laptop, names any quarantine list. Wrap both with the `git status apps/studio/dist/` clobber guard. Update `quality.typecheck`/`quality.tests` in `.ai/workflows.config.json` to match what CI actually executes.
- **Why**: the newest, least-run code in the tree is exactly the file plane; a local flake measurement (3/0/10) was contaminated by concurrent runs and decides nothing.
- **Validate**: PR run shows both jobs; sync lane red on an injected regression; full-suite job cannot fail the check.

#### A4: CLOSE the delete/injection lanes at the hub door (F-1 + B8/F1)
- **Do**: Two halves, one bypass class:
  1. **F-1 / F-3**: re-run the `journal.mjs` containment argument now that tombstone application is wired — and land the missing enforcement: a tombstone at the hub write door passes the SAME per-class admission gate as a write (a hub that may not WRITE `code-module` paths may not DELETE them), plus a delete breaker at the door mirroring the desktop's `DELETE_BREAKER_MAX`/`_FRACTION` (file-plane.ts:126–127).
  2. **B8/F1**: extend the owner-gate (or the existing `_untrusted` marker machinery, sync/index.ts:1482–1497) to **agent-read text under `.design/system/**`** (`.md`/`.css` companion-text) — today only `code-module` is owner-gated, while design agents read `system/**` as authoritative spec. Scope: agent-read text only, not all companion-text.
- **Gotcha**: classifier changes touch the byte-identical pair (`file-membership.ts` + `file-membership.mjs`) — update both, the parity test pins them. Test both directions (memory).
- **Validate**: hub suite + sync lane green; new tests fail with the gate reverted; `sync-file-membership.test.ts` parity green.

#### A5: VALIDATE `designRel` before it reaches git (F-13/B12)
- **Do**: Assert a safe relative path (no `..`, no leading `-`, no NUL, inside the design root) where `designRel` flows toward git pathspecs (`git/endpoints.ts:88`, `git/watch.ts:53`, autocommit path). Central helper, not per-call-site regex.
- **Validate**: regression test with a hostile rel (e.g. `--upload-pack=…`, `../escape`) fails before the fix, passes after.

#### A6: MAKE the release gate atomic (old T0f)
- **Do**: `publish-main` currently `needs: build-binaries` only, while the blank-window gates live in `build-desktop.yml` on the same tag. Extract a fast macOS `desktop-gate` job (bundle-completeness `--smoke` + `check-client-boots` against the built `.app`) and add it to `publish-main`'s `needs:` — or merge the workflows. Documented, logged break-glass (`workflow_dispatch` override input).
- **Validate**: test tag with a deliberately corrupted `dist/client.bundle.js` → the npm publish step never executes.

#### A7: RUN the full `/flow:validate` on the branch (STATE.md mandate)
- **Do**: The branch was closed under `--quick`; STATE.md says a full `/flow:validate` is MANDATORY before merge. Run it: static + tests + build + `/design:smoke` + desktop gates against a **built** `.app` + a11y/DS where applicable. Fix what it finds.
- **Validate**: all gates green on the branch head.

### Phase B — merge + live drills (workflow_dispatch, NOT an rc tag)

#### B1: MERGE to main
- **Do**: After Phase A is green: stage specific files (never `git add -A` — Syncthing tree), run `scripts/check-import-coherence.sh`, merge.
- **Gotcha**: the main push itself triggers `cells-deploy.yml` (paths include `apps/hub`) — expect its test half to run; it cannot roll the fleet (tag-gated), but watch it.
- **Validate**: main green across `quality.yml` + `cells-deploy` test half.

#### B2: DRILL the release live, before the tag
- **Do**: Via `workflow_dispatch` and the existing dev harnesses — never an rc tag (the `v*.*.*` globs match `1.0.0-rc.1` and would roll the fleet + npm `latest`):
  1. **Fleet drill**: `cells-deploy.yml` dispatch against a staging-named image; verify a cell answers on the new bytes.
  2. **Two-machine cloud↔desktop pass** incl. a **delete** and a **conflict** (rename-aside lands in `_trash/` on the loser) — `scripts/dev/sync-e2e.mjs` + `local-cell.mjs`.
  3. **Self-host E2E (D7)**: `docker compose` hub from the operator docs, link, sync, backup+restore drill against it.
- **Validate**: all three drills pass and are written into the release notes as executed rehearsals.

### Phase C — release

#### C1: CUT v1.0.0
- **Do**: `scripts/bump-version.sh major` (stamps the 7 pending what's-new entries; 5 changesets pending), `scripts/check-version-parity.sh`, annotated tag per `.ai/release-guide.md`, `git push --follow-tags`. Release notes MUST: label hub **OIDC as beta** (a review round found two "closed" blockers that weren't), and carry the **known-limits list** = the deferred findings from the backlog plan (F-4, F-6, F-7/8/14, F-11/12, B6, B11, B13, B14/15; `_trash/` unpruned; sync flags CLI-only).
- **Validate**: fleet verified per release-guide § "Verify the fleet actually rolled"; auto-updater offers 1.0.0; `npm i -g @1agh/maude` clean-machine smoke.

#### C2: CLOSE the plan
- **Do**: `/flow:done` — DDR sweep (the round-4 debate is already in the graph as `maude/debate-v1-gate-set`), archive this plan, `pnpm --filter @maude/site gen:roadmap`, confirm `feature-post-1.0-hardening-backlog.md` carries everything deferred.

---

## Validation

Scoped to this repo's real gates (no generic 5-platform scenario runner here):

1. **Lint**: `pnpm lint`
2. **Types**: `cd apps/studio && bun tsc --noEmit` (0 errors, coverage script green)
3. **Tests**: `pnpm test` (CLI+hub) · `cd apps/studio && bun test test/sync-*.test.ts` · full studio suite (non-blocking job) — never in parallel with the hub suite locally
4. **Build**: `bun run apps/studio/build.ts --release` (dist clobber guard before/after); `pnpm --filter @maude/site build`
5. **Smoke**: `/design:smoke`
6. **Desktop**: `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` against a built `.app`
7. **Drift gates**: `scripts/check-version-parity.sh`, `check-import-coherence.sh`
8. **Drills** (B2): fleet dispatch, two-machine sync pass (delete + conflict), self-host D7

---

## Acceptance Criteria

- [x] A1 red seed test adopted, failing-first verified, green — the fix had already landed in `35a5b115`; re-verified by reverting the `hubHasState` guard (red) and restoring (green)
- [x] A2 tsconfig surface complete (52 orphans measured, all in via broad `**/*` include + `@maude/canvas-lib` paths), `scripts/check-tsc-coverage.sh` tripwire (fails on a shrunk include), **0 tsc errors** (28 baseline → 69 once the surface was complete → 0)
- [x] A3 sync-lane gate REQUIRED in quality.yml (844 tests / 44 files / ~30 s, proven red on an injected `migrateSeed` regression) + `studio-suite` job non-blocking + typecheck & coverage wired, both behind a `dist/` clobber guard; `workflows.config` `quality.typecheck`/`quality.tests` match CI; CLAUDE.md's "typecheck intentionally absent" note corrected
- [x] A4 — three findings, two of which the plan's task list had over-scoped:
  - **F-1 (real, closed):** the hub had NO deletion breaker on either door while the desktop has had one since `propagateDeletes` shipped ON. Added `DELETE_BUDGET_WINDOW_MS`/`DELETE_BUDGET_PER_WINDOW` (same numbers as `sync/file-plane.ts`) + `deletionsSince`/`deleteBudget` in `journal.mjs`, a 429 at the HTTP door checked inside the path lock and BEFORE the quarantine, and the same cumulative budget applied to `replayTail` (which re-classified every row but trusted `deleted` verbatim). `journal.mjs`'s expired containment comment is re-argued in place: `deleted` cannot be re-derived from disk, because a tail legitimately carries deletes newer than the restored generation — so the control is a rate, not a permission. New `apps/hub/test/journal-delete-breaker.test.mjs`, 7 tests, **4 verified failing-first** with both halves reverted.
  - **F-3 (already satisfied):** the door computes the class and applies the owner gate BEFORE dispatching to `handleDelete`, so a tombstone already passes the same per-class admission gate as a write. Was unpinned; now pinned by a test.
  - **B8/F1 (already shipped):** `writeUntrustedMarkers` already receives every landed plane-B path from the ledger and lists it under `files` in `_untrusted/INDEX.json` + the managed `.claudeignore` — carrying verbatim the rationale the plan cites (DS READMEs and token CSS "are DATA, not instructions"). No code change needed; the plan's task list lagged the branch.
  - Classifier pair untouched, parity test green (844/844 sync lane); full hub suite 880/880.
- [x] A5 central `apps/studio/git/safe-rel.ts` (`isSafeGitRel` / `safeGitPrefix` / `partitionSafeGitRels`), wired into `normPrefix` (`git/service.ts`, which reaches `git/endpoints.ts` + `git/watch.ts`) and into autocommit's `partitionForStaging`. **The finding was re-scoped by measurement:** argv injection is already defused everywhere — every `runGit`/`run` call carrying a dynamic path puts it after `--` — so the real exposure is CONTAINMENT, which `--` does nothing about (`../../.github/workflows/*` is a well-formed pathspec). A refused prefix falls back to `.design`, never to `''` (empty means "no filter", so mapping a refusal onto it would WIDEN scope). `apps/studio/test/git-safe-rel.test.ts`, 29 tests, **8 verified failing-first** with the traversal guard reverted.
- [x] A6 npm publish blocked on the desktop blank-window gates — new `desktop-gate` job in `build-binaries.yml`, `publish-main` now `needs: [build-binaries, desktop-gate]`. GitHub has no cross-workflow `needs:`, and moving the macOS Tauri leg would drag the signing/notarization secrets with it, so the job asks the API what `build-desktop.yml` concluded **for this exact SHA** and blocks on the answer; a timeout is a REFUSAL. Documented break-glass (`skip-desktop-gate` dispatch input, written into the job summary with actor + SHA) and a documented accepted gap (sub-packages publish before the gate; the ROOT tarball is what `npm i -g` resolves and what the gate protects). Runbook updated. **⚠ The plan's own validation — "test tag with a deliberately corrupted `dist/client.bundle.js` → the npm publish step never executes" — is NOT done here: it requires pushing a real `v*` tag, which publishes sub-packages and rolls the fleet. It belongs with Phase B's `workflow_dispatch` drills and needs the maintainer.**
- [x] A7 full validate green on the branch. **One finding, and it was pre-existing:** `scripts/check-containment.sh` still asserted `/_api/photo-edit` was withheld from a cell, but commit `98a4c5ad` had deliberately reclassified it (updating `workspace-mode.ts` and the hub manifest, not the script) — so the branch was already RED in CI before any of this plan's work. Script aligned, with the reclassification's reasoning quoted in place.
  - Green: lint (0 errors, baseline was 0), `tsc --noEmit` (0), `check-tsc-coverage` (264 files), import-coherence (after landing the new modules — exactly CLAUDE.md's warned case), version-parity, tarball-shape, containment, token drift, site reference/stats drift, site build, `check-runtime-bundles` floors, studio suite **5194 pass / 0 fail**, hub **880/880**, CLI.
  - Desktop gates against a **built** `.app`: `check-bundle-completeness --smoke` OK and `check-client-boots` OK (the local build's only failure is `TAURI_SIGNING_PRIVATE_KEY`, a release secret CI holds; `.app` + `.dmg` both produced). Local build is single-arch, so the gate's "kg is thin" warning is expected — CI builds universal.
  - `/design:smoke`: **73/73 rendered styled**, exit 0. Per DDR-021 every PNG was looked at: 44 differ byte-wise from the last cleared run and were read individually; the other 29 are byte-identical to that run, which is proof of no change rather than a sample of it. Three visual oddities were checked against the prior run and are all **pre-existing, not regressions**: the agent-cursor label overlap in `colors-presence`, the empty toolbar glyphs in `iconography` section 4, and the label-less black boxes in `commands_overview`. Worth a backlog entry, not a gate.
  - Release-minified `dist/client.bundle.js` + `comment-mount.js` rebuilt and staged (within ~80 bytes of the committed artifacts — this IS the release artifact, per CLAUDE.md's rebuild rule); `dist/runtime/*.js` untouched.
  - `site/lib/roadmap.json` regenerated for this plan's edits.
- [ ] B2 all three live drills executed and recorded
- [ ] C1 v1.0.0 tagged, fleet verified, OIDC labeled beta, known-limits list in notes
- [x] Deferred work lives in `feature-post-1.0-hardening-backlog.md` — nothing silently dropped (verified against C1's named list: F-4, F-6, F-7/8/14, F-11/12, B6, B11, B13, B14/15, `_trash/` unpruned, sync flags CLI-only — all present; file committed in `74d9e0df`)
- [x] Debate dissent honored: no rc tag cut (none exists); no consent UI built; A7-notice + the consent/toggle surface both sit in the backlog's BINDING "before first external users" block

---

## Debate record — round 4 (2026-08-19, 4-0 gate; full text in kg `maude/debate-v1-gate-set`)

| Fork | Resolution | Decisive argument (seat-attributed, quoted as data) |
| --- | --- | --- |
| Gate vs ship | **Gate 4-0** | All seats: the tag is npm + fleet + auto-update at once; "there is no post-tag staging to harden in" (ADVOCATE). |
| B8/F1 depth | **Code-gate 4-0** (docs-only rejected) | BREAKER: "docs are advice to an agent, delivered in a file the attacker can also write." SHIPPER conceded: extension of an existing marker is hours. |
| Test gate scope | **Sync-lane required + full non-blocking 4-0** | SHIPPER: own flake measurement "likely my own contamination"; BUILDER: "that is the plan's own ratchet, not a retreat from it." |
| Drill mechanism | **workflow_dispatch 3-1** | BREAKER: the `v*.*.*` glob MATCHES `v1.0.0-rc.1` — "an rc is *more* dangerous than no rc until three regexes and a dist-tag change land." |
| Upgrade defaults / consent | **Dissolved by user** | "Žádný uživatele zatím maude nemá" — no consent machinery for 1.0; A7 notice + UI toggles = binding debt before first external users. |
| `_trash/` restore UI | **1.0.x** (coupled to the dissolved defaults fork) | SHIPPER: "these two forks are coupled and shouldn't be voted independently." Named in release notes instead. |
| Version number | **Direct v1.0.0** (user) | BREAKER's 0.61.0-first alternative preserved as dissent: semver freezes the journal/epoch/cursor wire format "immediately after zero live drills." |

Preserved dissent (verbatim, inert): ADVOCATE (rotating dissent): "A 4-0 convergence on a *small* gate is what you get when each seat guards its own scope and nobody owns the sum… 1.0 is the one promise you cannot patch in 1.0.1." SHIPPER: "if those 10 `/_api/figma/import` failures are real rather than port contention, I would be shipping 1.0.0 past a genuinely broken privileged write surface that my own scoping decision deliberately excluded from the gate" — the A3 non-blocking full-suite job exists to answer exactly this with clean data before C1.

Rounds 1–3 (2026-08-05): full record in this file's git history (`git log -p --follow -- .ai/plans/feature-production-grade-hardening.md` — the pre-re-scope revision) and in the graph (`kg search "production hardening"`). Their standing verdicts carry forward unchanged: Vite/Tailwind-in-studio/Turborepo/cloud-rewrite rejected; import spine internally, vendor edge externally; checker-first TS ratchet.

## Confidence

**8/10** for one-pass implementation. Phase A is bounded and mechanical (the largest unknown — full-suite health — is deliberately non-blocking). B2's drills are the first-ever live exercise of the arc and may surface real defects; that is their purpose, and the plan treats a red drill as a gate doing its job, not a schedule failure.
