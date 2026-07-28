# Feature: Git version-switcher — fast, trustworthy, git-native

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The native desktop switcher (project picker + branch/"version" dropdown) is slow and brittle on real developer repos. Six concrete complaints, one architectural root cause, plus one product-vocabulary pivot. This plan is the **follow-up that the two 2026-06-29 plans deferred** — `feature-git-perf-identity-and-remote-cache` (DDR-132) and `feature-remote-drafts-in-switcher` (DDR-131) shipped the caches + remote-draft listing, but left the engine on pure-JS isomorphic-git and the UI coupled to a timeout-less network path.

**Headline lever:** finally implement DDR-107's deferred end-state — runtime-detect system `git` and prefer it for the network paths (fetch / ahead-behind), falling back to isomorphic-git for the zero-setup persona. Native `git fetch` / `git for-each-ref` are instant on a developer machine, which is exactly the experience the user expects from their terminal.

**Vocabulary pivot (user decision 2026-06-29):** move the switcher to **fully git-native** terms — `main` / branches / "Merge this branch → main" — replacing the plain-language "Shared version / draft" layer. This supersedes the non-technical-persona vocabulary of DDR-110/119 for this surface and needs its own DDR.

## User Story

As a developer using Maude on a real multi-branch repo, I want my local branches to appear instantly, remote branches one explicit fetch away, GitHub auth to not stall the app, and the labels to use plain git terms I already know — so the switcher feels as fast and legible as my terminal.

## Problem

Confirmed root causes (file:line), grouped:

**Engine / network (issues 1, 2, 3):** `apps/studio/git/service.ts` defaults to isomorphic-git; system git is gated behind a module-level `USE_SYSTEM_GIT` env boolean (`service.ts:34`) the desktop never sets (DDR-107 deferred auto-detect). Branch **listing** is already disk-only/instant (`gitListBranches`, `service.ts:533-602`), but:
- `gitFetchRemote` (`service.ts:987+`) does an iso-git `git.fetch` of **all heads with no timeout** → on a bigger repo the client's 45 s cap trips → "Refresh timed out" (#1).
- `remoteAheadBehind` (`service.ts:1499-1571`) does a network fetch with **no timeout**; fired by `/_api/git/status?remote=1` on startup → the real ~30 s stall on app reopen (#2). (Identity SWR cache DDR-132 already paints instant; the probe is the culprit.)

**Client coupling (issue 3):** `RepoBranchSwitcher.jsx` renders a persistent error under the trigger (`rb-switcher-err`, ~line 422) and the branch list looks empty after a failed refresh. The local list is never independently re-asserted on popup open. → dropdown "disappears" on a bigger repo (#3).

**Repo discovery (issue 4):** `listUserRepos` (`github/service.ts:208-231`) queries `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator` — **missing `organization_member`** and **no pagination**. Repos accessed via org/team membership (e.g. StudyFi-Team) never appear → "Pull a local copy" shows one repo (#4).

**Copy / vocabulary (issues 5, 6):** the "Add this draft to the Shared version" fold button (`RepoBranchSwitcher.jsx:339`, service `gitFoldDraft` `service.ts:695-786`) is opaque; `SHARED = {main, master}` is surfaced as "Shared version / what everyone sees" and the git name `main` only appears on search (`RepoBranchSwitcher.jsx:21,141,313`). User can't find "main" (#5, #6).

## Solution

Five work-streams, ordered by leverage:

1. **Engine: detect-and-prefer system git** (DDR-107 end-state). Replace the static `USE_SYSTEM_GIT` boolean with a memoized runtime `git --version` probe → an `engine` selector. Prefer system git for the **network paths** (`gitFetchRemote`, `remoteAheadBehind`) and the disk listing (`for-each-ref` is marginally faster but optional). Keep iso-git as the fallback when git is absent. Add `MAUDE_NO_SYSTEM_GIT=1` escape hatch. Must compose with the DDR-131 transport gate (`classifyRemoteUrl` / `isTrustedTokenHost` / `HARDENED_REMOTE_FLAGS`) — the probe selects the engine; the classifier still decides whether a spawn is allowed at all.

2. **Bound every network git op + keep it off first paint.** Add a server-side timeout (AbortSignal / spawn kill) to `gitFetchRemote` and `remoteAheadBehind` (~12 s fetch, ~8 s probe). The probe must never block initial paint (local `gitStatus` already paints first — confirm the client orders it that way). Surface a precise, non-fatal result on timeout.

3. **Decouple the UI from the network (issue 3).** On popup open, always re-read `/_api/git/branches` (disk-only, instant) so the local list is current regardless of any prior refresh. A refresh/fetch failure becomes a **dismissable inline notice inside the popup**, never the persistent dock-level `rb-switcher-err`, and never clears or hides the local list. Clear stale errors when the popup reopens. Optional: **fetch-on-search-miss** — when a typed name matches no local/remote-tracking branch, offer a one-tap "Search remote for '<name>'" that runs the bounded fetch (the user's own suggestion).

4. **Repo discovery (issue 4).** Add `organization_member` to the affiliation set and paginate `listUserRepos` until exhausted (or a sane cap, e.g. 300, with a "showing N" note). Keep `sort=updated`.

5. **Git-native vocabulary (issues 5, 6).** Re-label the switcher: current branch shown by its real name with a "default branch" hint for `main`/`master`; section header "Switch branch"; remote rows keep the cloud glyph + "(remote)"; the fold action becomes **"Merge this branch → main"** with a one-line plain explanation retained in the confirm sheet. Record the persona/vocabulary pivot in a new DDR (supersedes DDR-110/119 *for this surface only*).

## Metadata

- **Type**: Enhancement (performance + correctness + UX) — cluster of 6
- **Complexity**: Medium-High (engine selection + security-adjacent network paths + a documented vocabulary pivot)
- **App/Package**: `apps/studio` (dev-server + client) — native-only surface (DDR-119); `apps/desktop` sidecar context only
- **Affected Systems**: git service engine selection, remote fetch + ahead/behind probe, GitHub repo discovery, RepoBranchSwitcher + CreateProject UI, committed client bundle
- **Dependencies**: none new (`node:child_process` already imported; `git --version` probe)

---

## Context References

### Must-Read Files

> Read these in parallel in a single message during `/flow:execute`.

- `apps/studio/git/service.ts:1-60` — Why: engine header doc + `USE_SYSTEM_GIT` boolean (line 34) to convert to a runtime probe.
- `apps/studio/git/service.ts:211-260` — Why: existing system-git fallback path (`runGit`) the probe will route to.
- `apps/studio/git/service.ts:453-490` — Why: DDR-131 transport gate (`classifyRemoteUrl`, `isTrustedTokenHost`, `HARDENED_REMOTE_FLAGS`) the engine selection must compose with.
- `apps/studio/git/service.ts:533-602` — Why: `gitListBranches` (already disk-only) — the shape the client renders.
- `apps/studio/git/service.ts:695-786` — Why: `gitFoldDraft` (the "merge branch → main" action) — unchanged mechanic, new label.
- `apps/studio/git/service.ts:987-1058` — Why: `gitFetchRemote` — add timeout + engine routing.
- `apps/studio/git/service.ts:1442-1571` — Why: `remoteAheadBehind` TTL/dedupe wrapper + uncached body — add timeout + engine routing.
- `apps/studio/github/service.ts:208-231` — Why: `listUserRepos` — affiliation + pagination fix.
- `apps/studio/client/panels/RepoBranchSwitcher.jsx:21,89-275,308-364,406-424` — Why: vocabulary map, mount fetch, render conditions, persistent error, fold button.
- `apps/studio/client/panels/CreateProject.jsx:169-293` — Why: "Pull a local copy" repo list rendering.
- `apps/studio/http.ts` (`/_api/git/fetch`, `/_api/git/status`, `/_api/github/repos`) — Why: route layer + loopback gates (don't widen the allowlists — DDR-088).

### Files to Create

- `.ai/archive/decisions/DDR-133-system-git-autodetect-and-git-native-switcher-vocabulary.md` — records (a) the DDR-107 end-state activation and (b) the git-native vocabulary pivot superseding DDR-110/119 for this surface.

### Patterns to Follow

- **Engine routing:** mirror the existing `if (USE_SYSTEM_GIT) { runGit(...) } else { git.xxx(...) }` two-branch shape already in `gitListBranches`/`remoteAheadBehind` — just feed it from the probe instead of the env constant. Memoize the probe (one `git --version` per process; the sidecar respawns per repo so per-process is correct).
- **Timeouts:** iso-git path → `AbortSignal.timeout(ms)` passed to `git.fetch`; system path → kill the `spawn` child on a timer (the `runGit` helper already wraps `spawn`).
- **Transport safety:** never bypass `classifyRemoteUrl`; the probe chooses the engine, the classifier still refuses `unsafe`/non-GitHub before any spawn (DDR-131).
- **Client error UX:** model the inline notice on the existing `rb-pop-empty` pattern (inside the popup), not the dock-level `rb-switcher-err`.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: REFACTOR engine selection — runtime detect-and-prefer system git

- **Do**: Replace the `USE_SYSTEM_GIT` constant (`service.ts:34`) with a memoized `resolveEngine()` that returns `'system'` when `git --version` succeeds (and `MAUDE_NO_SYSTEM_GIT` is unset), else `'iso'`. `MAUDE_USE_SYSTEM_GIT=1` stays as a force-on override. Route `gitFetchRemote` and `remoteAheadBehind` through it; listing may stay iso (already instant) or adopt system `for-each-ref`.
- **Pattern**: existing two-branch engine shape in `gitListBranches`.
- **Gotcha**: the probe must run **after** the DDR-131 `classifyRemoteUrl` gate, not before — engine choice never relaxes the transport refusal. Don't set env at test module top level (DDR-131 retro: it leaks across the shared bun-test process — pass the engine in or use object-identity assertions).
- **Validate**: `cd apps/studio && bun test git/` (existing engine round-trip tests stay green under both engines).

### Task 2: ADD timeouts to the two network git paths

- **Do**: Bound `gitFetchRemote` (~12 s) and `remoteAheadBehind` uncached body (~8 s). iso path → `AbortSignal.timeout`; system path → kill the spawned child. On timeout return a typed result (`{ timedOut: true }` for fetch; `{ahead:0,behind:0, stale:true}` for the probe) — never throw into the unattended poll.
- **Gotcha**: the probe's 45 s TTL cache (DDR-132) must cache only **successful** results; a timeout must not poison the cache (the existing wrapper already clears the in-flight slot on throw — keep that for the timeout path).
- **Validate**: `bun test git/` + a new test asserting a slow/again-unreachable remote resolves within the bound, not at 45 s.

### Task 3: UPDATE RepoBranchSwitcher — decouple list from network, fix the disappearing dropdown

- **Do**: On popup open, re-fetch `/_api/git/branches` (disk-only) so the local list is always current. Move refresh/fetch failures into a dismissable in-popup notice; stop letting them set the persistent `rb-switcher-err`. Clear `err` on reopen. The local branch list renders unconditionally whenever branches exist, independent of any refresh state.
- **Gotcha**: keep the web read-only badge path (DDR-119) untouched — native-only changes.
- **Validate**: manual native dogfood — switch to a bigger repo, force a refresh timeout (offline), confirm local branches still listed + error is dismissable and gone on reopen.

### Task 4: ADD fetch-on-search-miss (optional within this plan)

- **Do**: When the search query matches no local/remote-tracking branch, render a "Search remote for '<query>'" affordance that runs the bounded `gitFetchRemote` then re-reads branches. Replaces the dead-end "Nothing matches".
- **Validate**: manual — type a known-remote-only branch name, confirm it surfaces after the explicit fetch.

### Task 5: FIX listUserRepos — affiliation + pagination

- **Do**: Change the query to `affiliation=owner,collaborator,organization_member` and paginate (`Link` header or `page=` loop) until exhausted or a 300 cap; if capped, return a flag the dialog renders as "showing first N". Keep `sort=updated`.
- **Gotcha**: GitHub PAT scope — org repos need the token to have org read; surface the existing tokenless/insufficient-scope error rather than silently returning fewer.
- **Validate**: `bun test github/` if a fixture test exists; manual — confirm >1 repo (incl. org repos) in "Pull a local copy".

### Task 6: REFACTOR switcher vocabulary to git-native (issues 5, 6)

- **Do**: Current row shows the real branch name; `main`/`master` gets a "default branch" subtitle (not "Shared version"). Section header → "Switch branch". Remote rows → name + "(remote)". Fold button + confirm sheet → "Merge this branch → main" with the existing plain one-liner kept as the explanatory body. Update `SHARED`-derived copy and the search-match hint accordingly.
- **Gotcha**: this is the surface the DDR-110/119 plain-vocab promise covered — do NOT change the non-switcher plain verbs (Save version / Publish / Get latest) without a separate decision; scope the rename to the switcher.
- **Validate**: manual native dogfood across on-main and on-draft states; screenshot both.

### Task 7: RECORD DDR-133

- **Do**: Write `.ai/archive/decisions/DDR-133-...md` covering the system-git auto-detect activation (the DDR-107 end-state, why now, the timeout + transport-gate composition) and the git-native vocabulary pivot (supersedes DDR-110/119 for the switcher only, with the user-decision provenance).
- **Validate**: linked from this plan + from DDR-107/110/119/131/132.

### Task 8: REBUILD committed client bundle

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` (CLAUDE.md: whatever is committed is what ships; never leave dev-form bundles).
- **Validate**: `scripts/check-runtime-bundles.sh` (or the min-size gate) passes.

---

## Validation

1. **Tests**: `cd apps/studio && bun test` (git + github suites green under both engines)
2. **Engine matrix**: run the git suite once with `MAUDE_NO_SYSTEM_GIT=1` (force iso) and once default (system git present) — both green.
3. **Security**: spawn `security-auditor` + `ethical-hacker` over the engine-selection diff — confirm the DDR-131 transport gate still refuses `ext::`/`fd::`/`file://`/non-GitHub remotes and the token still only attaches to `github.com` (the probe must not have opened a bypass). This is the gating check — the probe touches the exact RCE/SSRF surface DDR-131 hardened.
4. **Build**: `MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` clean; bundle min-size gate passes.
5. **Manual native dogfood** (the verification backbone here): on a bigger real repo —
   - local branches appear instantly on popup open;
   - app reopen no longer stalls ~30 s on GitHub auth;
   - Refresh completes fast (system git) or fails gracefully without hiding the list;
   - "Pull a local copy" lists org repos;
   - git-native labels read correctly on-main and on-branch.

---

## Verification ceiling (intentional divergence)

Native-only dock (DDR-119) → the standard 5-platform `scenario-runner` does **not** apply, consistent with the DDR-131/132 precedent. Coverage = unit tests (engine round-trip + timeout bound + transport-gate refusal) + the adversarial security pass (Task-3 gate above) + manual native dogfood. Record this divergence in DDR-133's acceptance section.

## Acceptance Criteria

- [x] All 8 tasks completed
- [x] git + github test suites green under **both** engines (system + forced-iso)
- [x] Committed client bundle rebuilt `--release`
- [x] DDR-133 recorded and cross-linked
- [x] No regression to the web read-only badge path (DDR-119 — `!native` branch untouched) or the non-switcher plain verbs (Save/Publish/Get latest unchanged)
- [x] `security-auditor` + `ethical-hacker`: run at /done on the engine-selection diff (DDR-131 gate)
- [x] Dogfooded on a real 306-branch repo (status 87 ms / branches 62 ms via system git vs iso crash) + 3 DOM-driven desktop-e2e scenarios (12 screenshots) — supersedes the manual-only line
- [x] Git/github suites green (per-file deterministic; full-suite flake = pre-existing git-api round-trip timeout under load) under both engines

## Retro

- **The plan's root-cause scoping was half-right.** It correctly fingered iso-git as the bottleneck but scoped the fix to the *network* paths; real dogfooding showed iso-git's `statusMatrix`/`listBranches` was **crashing + slow on the READ paths** for a 306-branch repo — that, not the probe, vanished the dropdown. Lesson: when a plan says "listing is already instant," verify against a *real* large repo, not the assumption.
- **My own hoist introduced a regression I only caught in e2e.** Hoisting the fetch token-guard for test determinism broke tokenless system-git fetch (credential helper). The DOM-driven lifecycle e2e is what surfaced it — unit tests alone (pinned to iso) would have missed it. Worth the cost of building the harness.
- **desktop-e2e paid off but the flaky edges are real.** `open_local_project` sidecar-respawn drops the WebDriver session intermittently → isolate repo-switch into its own retried scenario; never chain a respawn inline. A real-remote fixture must be offline-refs-only or the boot probe hangs the webview. Recorded as skill gotchas.
- **computer-use is a dead end for the native WKWebView** (clicks don't activate React; screen-asleep blocks it) — the coordinate-scaling fight confirmed the `feedback_prefer_dom_driven_e2e_not_computer_use` memory. desktop-e2e is the right tool.
- **Next time:** budget for the read-path engine flip + a real-repo dogfood up front rather than discovering it during execute.
