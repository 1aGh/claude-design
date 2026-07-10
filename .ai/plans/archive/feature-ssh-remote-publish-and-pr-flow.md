# Feature: SSH-remote publish/merge + PR-based "Add to Shared version"

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. The git engine layer (`apps/studio/git/service.ts`) is dense and security-reviewed — mirror the **existing** transport-gate code (`gitFetchRemote`, `remoteAheadBehind`), don't invent a new pattern.

## Description

Two linked defects in Maude's desktop git layer, hit when driving a project whose `origin` is an **SSH** remote with a **protected `main`** (`git@github.com:StudyFi-Team/studyfi-design.git`):

- **A — transport bug.** Publish / Get-latest / Add-to-Shared throw the raw `unrecognized transport protocol: "ssh"` because `gitPush`/`gitPull` route to isomorphic-git (HTTP-only) instead of system git, unlike the already-hardened `gitFetchRemote`/`remoteAheadBehind`.
- **B — no PR flow.** "Add this draft to the Shared version" does a **local merge into `main` + direct push to `main`**. On a protected `main` GitHub rejects that regardless of transport. There is no pull-request path anywhere in the codebase. It must open a PR instead.

Grounding RCA (read first — has root cause, exact line numbers, evidence): `.ai/logs/rca/issue-maude-ssh-remote-publish-and-pr-flow.md`.

## User Story

As a Maude desktop user whose team repo uses an SSH remote and a protected `main`, I want "Add to Shared version" to open a pull request (and publish/get-latest to work over SSH) so that I can ship my draft through my team's review process without dropping to the terminal or seeing a raw git error.

## Problem

- `gitPush` (`git/service.ts:882`) and `gitPull` (`:994`) branch on the env flag `USE_SYSTEM_GIT` (default **false**) → iso engine → SSH throws. The network reads (`gitFetchRemote:1099`, `remoteAheadBehind:1628`) already do the right thing: `classifyRemoteUrl` + `(systemGitAvailable() || transport === 'ssh')`.
- `pushIso`/`pullIso` catch blocks don't map the transport error to friendly copy (fetch does at `:1153`), so the raw iso string leaked to the UI.
- The only SSH-routing test (`test/git-branches.test.ts:187`) exercises **fetch only** — push/pull/fold are untested, which is why this shipped.
- `gitFoldDraft` (`:779`) merges into `main` locally then `gitPush` to `main` (`:844`). No `createPullRequest` exists in `github/service.ts`.

## Solution

- **A:** give `gitPush`/`gitPull` the same transport gate as `gitFetchRemote`; add friendly transport-error mapping to the iso catch blocks; add the missing push/pull/fold SSH-routing tests. `gitFoldDraft` inherits the push fix.
- **B:** add `createPullRequest` to the GitHub REST service + a `/_api/github/create-pr` endpoint (resolve `owner/repo` via the existing `parseGitHubRemote`, token via `withToken`). Rework `gitFoldDraft`: when a GitHub remote exists → push the **draft branch** + open a PR `draft → main` and return the PR URL; keep the local merge only for remote-less projects. Surface the PR link in `RepoBranchSwitcher`.

## Metadata

- **Ticket**: none (manual RCA — `integrations.tracker.provider: github`, but this was reported directly, not as a GH issue)
- **Type**: Bug Fix (Part A) + New Capability (Part B)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (dev-server sidecar) + committed client bundle
- **Affected Systems**: git engine (`git/service.ts`), git endpoints (`git/endpoints.ts`, `http.ts`), GitHub REST (`github/service.ts`, `github/endpoints.ts`), client draft switcher (`client/panels/RepoBranchSwitcher.jsx`, `GitPanel.jsx`), dev-server test suite
- **Dependencies**: none new (`isomorphic-git`, GitHub REST, Bun — all already present)
- **Branch**: implement on a **dedicated branch** (e.g. `fix/ssh-remote-publish-pr-flow`). The current `main` working tree is dirty with unrelated inline-editing work (DDR-160) — do NOT tangle this in.

---

## Context References

### Must-Read Files

> Read these in parallel (single message, multiple Read calls) at the start of `/flow:execute`.

- `.ai/logs/rca/issue-maude-ssh-remote-publish-and-pr-flow.md` — the full RCA (root cause + fix + tests).
- `apps/studio/git/service.ts` (`:34-65` engine switches, `:516-566` `classifyRemoteUrl`/`isTrustedTokenHost`/`HARDENED_REMOTE_FLAGS`, `:779-865` `gitFoldDraft`, `:874-953` `gitPush`/`pushIso`/`pushSystem`, `:987-1050` `gitPull`, `:1068-1162` `gitFetchRemote` — the reference pattern to mirror, `:1615-1645` `remoteAheadBehind` — the other reference).
- `apps/studio/github/service.ts` (`:83-117` `api()` client, `:135-165` `createRepo` — mirror for `createPullRequest`, `:53-74` `GitHubApiError`/`friendly`).
- `apps/studio/github/endpoints.ts` (`:61-96` `parseGitHubRemote` — SSH-capable owner/repo parse, `:128-145` `withToken`, `:295-350` `createProject` — mirror for the create-pr handler, `:225-250` origin-resolution pattern).
- `apps/studio/git/endpoints.ts` (`:78-79`, `:286-330` `fold` handler + token resolution).
- `apps/studio/http.ts` (`:1251` `/_api/git/fold` route, `:1382-1394` `/_api/github/create-project` route — mirror for create-pr, `:2520-2535` `CANVAS_SAFE_API` allowlist — create-pr must **NOT** appear here).
- `apps/studio/client/panels/RepoBranchSwitcher.jsx` (`:16`, `:256` the fold gesture — where the PR link surfaces).
- `apps/studio/client/panels/GitPanel.jsx` (`:337-420` publish/get-latest handlers + error toasts — where protected-branch/transport copy lands).
- `apps/studio/test/git-branches.test.ts` (`:85-103` fold tests, `:187-198` the SSH-fetch test to mirror for push/pull/fold).
- `apps/studio/test/github-api.test.ts` (`:270-300` `parseGitHubRemote` tests — add `createPullRequest` shape test alongside).
- `apps/studio/test/canvas-origin-gate.test.ts` — add a `GET /_api/github/create-pr → 405/404 from canvas origin` assertion.

### Files to Create

- (none — all changes extend existing files. New DDR file: `.ai/decisions/DDR-<n>-pr-flow-for-add-to-shared-version.md`, number resolved at record time — see Task B0.)

### Patterns to Follow

The transport gate to copy verbatim into `gitPush`/`gitPull` (from `gitFetchRemote:1081-1099` / `remoteAheadBehind:1620-1628`):

```ts
const url = await readRemoteUrl(dir, remote);
const transport = classifyRemoteUrl(url);
if (transport === 'unsafe') return { ok: false, error: 'Maude can only publish to github.com (HTTPS or SSH) projects.' };
const trustedHttp = transport === 'http' && isTrustedTokenHost(url);
if (transport === 'http' && !trustedHttp) return { ok: false, error: 'Maude can only publish to github.com projects.' };
if ((await systemGitAvailable()) || transport === 'ssh')
  return pushSystem(dir, trustedHttp ? token : undefined, remote, opts.ref);
return pushIso(dir, token, remote, opts.ref);
```

`createPullRequest` mirrors `createRepo` (`github/service.ts:135`) — same `api()` call, same `friendly()` error mapping, returns `{ number, html_url }`.

---

## Design Decisions

Not a UI-design-system feature. The only UI is a text link ("Pull request opened → <url>") in `RepoBranchSwitcher` on fold success, and refined error copy in `GitPanel`. Use existing panel styles/toasts (`gp-*` classes, the existing `run(...)` toast helper). No new tokens, icons, or components. Desktop-only (`platforms: ["web-desktop"]`).

**Open sub-decision for the DDR (Task B0):** when a GitHub remote exists, does fold **always** open a PR, or **try a direct push and fall back to a PR** only on a protected-branch rejection? Recommendation: **always PR when a remote exists** — it's predictable, matches the declared `github-flow`, and avoids a wasted-then-rejected push. Keep the local-merge path strictly for remote-less (purely local) projects.

---

## Tasks

Execute in order. A-tasks are independently shippable and unblock the transport; B-tasks build the PR flow on top.

### Task A0: SETUP dedicated branch

- **Do**: from a clean checkout of `main`, create `fix/ssh-remote-publish-pr-flow`. Do all work here.
- **Gotcha**: the current tree is dirty with DDR-160 inline-editing work — branch from a clean state, don't absorb those changes.
- **Validate**: `git status` shows only this feature's files.

### Task A1: UPDATE `gitPush` — transport gate

- **Do**: in `git/service.ts:874` `gitPush`, before the `USE_SYSTEM_GIT ? … : …` return, insert the transport-gate block (see Patterns). Route SSH / system-git-available → `pushSystem`; refuse `unsafe`; enforce the github-only token-host policy; only fall to `pushIso` for github HTTPS with no system git.
- **Pattern**: `gitFetchRemote:1081-1099`.
- **Gotcha**: pass `trustedHttp ? token : undefined` to `pushSystem` — never lend the PAT to a non-github host or over ssh.
- **Validate**: `bun test test/git-branches.test.ts` (after A4).

### Task A2: UPDATE `gitPull` — transport gate

- **Do**: same gate in `gitPull:987`, routing to `pullSystem` / `pullIso`. Reuse the identical block (consider a small shared helper `pickPushPullEngine(dir, remote, token)` returning `{ system: boolean, tokenForSystem }` to avoid drift between push and pull — optional but preferred).
- **Pattern**: `gitPull` current body + the A1 gate.
- **Validate**: covered by A4.

### Task A3: UPDATE `pushIso`/`pullIso` catch — friendly transport error (belt)

- **Do**: in the `catch` of `pushIso` (`:926`) and `pullIso` (`:1020`), before returning `errMsg(e)`, add: `if (/unrecognized transport|unsupported|protocol/i.test(msg)) return { ok:false, error: 'Publishing needs the git command-line tool for this project\'s connection.' }` (pull: "Getting the latest…"). Mirrors `gitFetchRemote:1153`.
- **Validate**: covered by A4.

### Task A4: ADD SSH-routing tests for push/pull/fold

- **Do**: in `test/git-branches.test.ts`, mirror the `:187` fetch test for `gitPush`, `gitPull`, and `gitFoldDraft`: configure an `.invalid` SSH `origin` (`git@nonexistent.invalid:team/app.git`), set `GIT_SSH_COMMAND` with `BatchMode=yes`, assert `ok === false`, `authRequired` falsy, and `error` **not** matching `/unrecognized transport/i` (proves it left iso for system git). Add a `MAUDE_NO_SYSTEM_GIT=1` + ssh case asserting the friendly-copy fallback (A3).
- **Gotcha**: `.invalid` fails fast at DNS — no network, deterministic. Scope env vars in try/finally so they don't leak across tests.
- **Validate**: `cd apps/studio && bun test test/git-branches.test.ts`.

> **A ships here.** A1–A4 alone fix the raw transport error for Publish/Get-latest and unblock the draft-branch push that B needs. Commit this as a self-contained unit.

### Task B0: RECORD DDR — PR flow for "Add to Shared version"

- **Do**: `/flow:record-ddr`. Decision: on a repo with a GitHub remote, "Add to Shared version" opens a PR (`draft → main`) instead of merging+pushing `main`; local merge retained only for remote-less projects; always-PR (not try-push-then-fallback). Resolve the DDR number at write time (latest is DDR-160 — check `.ai/decisions/` AND the uncommitted README index diff per the numbering-race gotcha; likely 161).
- **Validate**: DDR file exists + linked in `.ai/decisions/README.md`.

### Task B1: ADD `createPullRequest` to `github/service.ts`

- **Do**: `export async function createPullRequest(token, owner, repo, input: { head: string; base: string; title: string; body?: string }): Promise<{ number: number; html_url: string }>` — `api(token, '/repos/{owner}/{repo}/pulls', { method:'POST', body:{ title, head, base, body } })`. Map `422` to friendly copy: if the message mentions "A pull request already exists" → return/point to the existing PR; if "No commits between" → "Nothing new to add to the Shared version."
- **Pattern**: `createRepo:135` + `friendly:64`.
- **Validate**: `bun test test/github-api.test.ts`.

### Task B2: ADD `/_api/github/create-pr` endpoint handler

- **Do**: in `github/endpoints.ts`, add `createPr(body)` via `withToken`. Resolve `origin` URL → `parseGitHubRemote` → `{owner, repo}` (reject non-github). Validate `head`/`base`/`title` (reuse the input-validation style of `createProject`). Call `createPullRequest`. Return `{ ok:true, url, number }` or the mapped error. Export it in the endpoints object.
- **Pattern**: `createProject:295` + the origin-resolution at `:225-250`.
- **Gotcha**: `base` defaults to the repo's Shared branch (`main`/`master`) — resolve it the same way `gitFoldDraft` does (`SHARED_BRANCHES`), don't hardcode `main`.
- **Validate**: `bun test test/github-api.test.ts`.

### Task B3: REGISTER the route (dual-allowlist)

- **Do**: in `http.ts`, add `'/_api/github/create-pr'` to the **main-origin** routes block (mirror `/_api/github/create-project` at `:1382`: loopback + POST CSRF gate, main-origin only). Do **NOT** add it to `CANVAS_SAFE_API` (`:2520`).
- **Pattern**: `create-project` route.
- **Gotcha**: per CLAUDE.md's dual-allowlist rule, a privileged (token-bearing) route belongs in NEITHER `CANVAS_SAFE_API` nor `startCanvasServer.routes`. Add the canvas-origin-gate assertion (Task B6).
- **Validate**: `bun test test/canvas-origin-gate.test.ts`.

### Task B4: REWORK `gitFoldDraft` — PR path when a remote exists

- **Do**: in `git/service.ts:779`, branch on remote presence (`readRemoteUrl(dir, remote)` non-empty + `classifyRemoteUrl !== 'none'`):
  - **Remote present**: do NOT checkout/merge/push `main`. Push the **draft branch** (`gitPush(dir, token, { remote, ref: draftName })`), then have the endpoint (B2) create the PR (`draft → shared`). Return a result carrying `{ ok:true, prPending:true }` (+ enough for the endpoint to open the PR) — or call an injected PR-creator. Keep the draft (do NOT delete it — the PR references it).
  - **No remote**: unchanged local-merge path.
- **Design note**: PR creation needs the GitHub token + owner/repo, which live at the endpoint layer (`withToken`/`parseGitHubRemote`). Cleanest split: `gitFoldDraft` pushes the draft and signals "ready for PR"; the `fold` **endpoint** (`git/endpoints.ts:286`) then calls `createPullRequest` and returns the URL. Update the `GitFoldResult` type accordingly.
- **Gotcha**: draft-branch push is NOT blocked by `main` protection — that's the whole point. Ensure a non-fast-forward on the draft (rare) still surfaces the "Get latest" path.
- **Validate**: `bun test test/git-branches.test.ts` (fold no-remote path unchanged; new remote-path test with a stubbed PR creator).

### Task B5: UPDATE client — surface the PR link + refined copy

- **Do**: in `RepoBranchSwitcher.jsx` (fold caller `:256`), on a `{ prUrl }` success show "Pull request opened → <link>" (open via the app's external-link affordance) and keep the draft in the list. In `GitPanel.jsx`, refine publish error copy so a protected-branch rejection reads "`main` is protected — add your draft as a pull request" rather than the generic non-fast-forward toast. Add/keep `data-testid`s for desktop-e2e (`git-fold`, `git-pr-link`).
- **Pattern**: existing `run(...)` toast helper + `gp-*` styles in `GitPanel.jsx`.
- **Gotcha**: after ANY client change, rebuild the committed bundle release-minified (Task B7) — the source dev bundle must never be committed.
- **Validate**: visual check in the desktop build (Task B8).

### Task B6: ADD tests — PR service + endpoint + origin gate

- **Do**: `github-api.test.ts` — `createPullRequest` request shape (URL, method, body) + 422 mappings. `canvas-origin-gate.test.ts` — `create-pr` 405/404 from canvas origin. Endpoint test — fold-with-remote calls the PR creator with `{head:draft, base:shared}` and returns the URL (stub `api`/fetch).
- **Validate**: `cd apps/studio && bun test`.

### Task B7: BUILD committed client bundle (release-minified)

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.
- **Gotcha**: per CLAUDE.md — whatever is committed is what ships; never commit the 3.6 MB dev bundle. `MAUDE_SKIP_RUNTIME_BUILD=1` reuses the on-disk runtime bundles.
- **Validate**: `git diff --stat` shows the minified bundle (~250 KB delta, not MBs).

### Task B8: VERIFY on the desktop build

- **Do**: build the native app and drive the fold gesture against a scratch SSH-remote repo with a protected `main` (or a fixture). Use the `desktop-e2e` skill (WebdriverIO, `data-testid`-driven) — add/extend a scenario that switches to a draft and clicks "Add to Shared version", asserting the PR-link toast. Also manually confirm Publish + Get-latest now work over SSH.
- **Gotcha**: verification MUST be the bundled `.app`, not `tauri dev` (memory: native-app verification ceiling). The user drives this gesture natively.
- **Validate**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` green; manual SSH publish/get-latest confirmed.

---

## Validation

Run to confirm zero regressions (this repo has no `typecheck` gate — DDR-026 baseline; no 5-platform mobile scenario — `platforms: web-desktop` only):

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Dev-server tests (primary)**: `cd apps/studio && bun test` (git-branches, github-api, canvas-origin-gate, endpoint tests all green)
4. **Full test gate**: `pnpm test && pnpm test:dev-server`
5. **Build (site gate)**: `pnpm --filter @maude/site build`
6. **Parity**: `bash scripts/check-version-parity.sh` (only if versions bumped — not required for this change)
7. **Desktop E2E**: `pnpm test:e2e:desktop` (fold → PR-link scenario)
8. **Manual (the actual bug)**: against `~/git/studyfi-design` (SSH remote, protected `main`): Publish works; Get-latest works; "Add to Shared version" opens a PR and shows its link; `main` is never force-pushed.

---

## Acceptance Criteria

- [ ] Part A: Publish / Get-latest / Add-to-Shared no longer emit `unrecognized transport protocol: ssh` on an SSH remote (routed to system git); iso catch maps the error to friendly copy.
- [ ] Part A: new push/pull/fold SSH-routing tests pass (the gap that let this ship is closed).
- [ ] Part B: DDR recorded for the fold → PR semantics change.
- [ ] Part B: "Add to Shared version" on a GitHub remote opens a PR (`draft → main`), returns + displays the PR URL, and never merges/pushes `main`; remote-less projects keep the local merge.
- [ ] `createPullRequest` + `/_api/github/create-pr` added; route is in the main-origin allowlist and NOT in `CANVAS_SAFE_API` (canvas-origin-gate test asserts it).
- [ ] Committed client bundle rebuilt release-minified.
- [ ] Verified on the bundled desktop `.app` (not just `tauri dev`) against a protected-`main` SSH repo.
- [ ] `pnpm lint` + `cd apps/studio && bun test` + `pnpm test:dev-server` green; no regressions.
- [ ] `/flow:done`: whats-new entry added (user-visible collaboration change); `site/lib/roadmap.json` regenerated (new plan file).
```

---

## Retro

- **Splitting A (transport) from B (PR flow) paid off.** Part A was a small, self-contained fix (mirror the existing `gitFetchRemote` gate) that shipped immediate value and unblocked B's draft-push. Landing it as its own commit first — before the larger, DDR-gated B — kept each reviewable. Worth repeating: when an RCA surfaces a "cheap fix + real feature" pair, sequence them.
- **The concurrent-session hazard was the biggest surprise, not the code.** A parallel `feature-photo-editor` `/flow:execute` was live in the *same working tree*; my initial `git checkout -b` switched the shared tree out from under it. Recovery cost real care (isolate my commit, restore `main`, then a worktree). Lesson for `/plan`: when STATE shows another feature `in-progress`, **plan a `git worktree` from task 0** rather than a branch-in-place — and expect a **DDR-number race** (mine drafted as 161, renumbered to 162 after photo-editor committed its 161 to `main` first).
- **A "show a link" UI hid a native-shell dependency the plan missed.** "Review on GitHub" can't open the OS browser from WKWebView without a Tauri command — a Rust change that needs a **desktop rebuild** to reach the user. Mitigated by designing the client to degrade (clipboard fallback) so the bundle-only path works immediately. For any desktop-shell feature, the plan should call out up-front which parts need a rebuild vs. reach users via the live-served bundle, and design the interim path in.
- **Two of the shipped pieces were user-driven follow-ups, not in the plan** (the PR-link opener + the proactive "Get latest" dock nudge). Both were natural extensions discovered by dogfooding the exact flow. The plan correctly scoped the core; the polish emerged from real use — a healthy pattern, but it means the "done" surface is wider than the plan's task list.
- **B8 is a real harness ceiling, not a skipped step.** The full loop (live ssh push → PR against a *protected* GitHub `main`) can't be fabricated in a scratch test because the ahead/behind probe and PR API are github-only by security design. Routing + REST shape are unit-covered; the live pass is genuinely user-dogfood. Accept + document rather than pretend-verify.
