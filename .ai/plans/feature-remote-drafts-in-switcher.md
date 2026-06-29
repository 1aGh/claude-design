# Feature: Surface remote branches (drafts) in the native draft switcher

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The native draft switcher (`RepoBranchSwitcher`) lists only **local** branches. Drafts that exist on the remote but not locally — a teammate's draft, or a branch you pushed from another machine — never appear, and the new search box returns "no matches" for them. Surface remote-tracking drafts in the same picker, let the user switch to one (auto-creating a local tracking branch), and add an explicit **Refresh** that fetches new remote drafts on demand.

## User Story

As a non-technical Maude user with a shared project, I want to see and open drafts my teammates made (or drafts I pushed elsewhere) directly in the switcher, so that I don't have to drop to a terminal or get confused when a draft I know exists isn't in the list.

## Problem

- `gitListBranches` (`apps/studio/git/service.ts`) reads only `refs/heads` (system git) / `git.listBranches({fs,dir})` (iso git). Remote-only drafts under `refs/remotes/origin/*` are invisible.
- The just-shipped search box (commit `a7dfaf1`) therefore returns "Nothing matches" for a branch name that genuinely exists on the remote — actively misleading.
- The default engine is **isomorphic-git** (`USE_SYSTEM_GIT` defaults off; the desktop app never sets it). iso-git's `git.checkout({ref})` does **not** DWIM-create a tracking branch the way system `git checkout X` does, so even if a remote-only name were listed, switching to it wouldn't work without new logic.

## Solution

Two phases, chosen via `/flow:plan` divergence (recommended option **"Fáze 1 + manuální Refresh"**):

**Phase 1 — no new network.** List remote-tracking branches that already exist locally (populated by the original `git clone` / prior fetch), dedupe against local branches into one row per draft tagged with a `where` field (`local` | `remote` | `both`). Switching to a `remote`-only draft creates a local tracking branch via `git.checkout({ ref, remote: 'origin', track: true })`. Zero new network surface, zero token use.

**Phase 2 — explicit Refresh.** A "Refresh" affordance in the switcher runs `gitFetchRemote` (`git.fetch({ remote:'origin', onAuth: <server keychain token>, prune:true })`) to pull in brand-new remote drafts, then re-reads the branch list. Network + token, behind an explicit user gesture (NOT auto-fetch on popup open) with an "as of <relative time>" staleness hint. Token resolution mirrors `pull`/`fold`: server-held `getGithubToken()`, main-origin + loopback-only endpoint.

## Metadata

- **Type**: Enhancement
- **Complexity**: High (live workspace-switch path + network/token + vocabulary contract; needs a DDR)
- **App/Package**: `apps/studio` (dev server / native studio shell)
- **Affected Systems**: git service, git endpoints, http routes, the native switcher UI, committed client bundle
- **Dependencies**: none new (isomorphic-git already present)

---

## Context References

### Must-Read Files

> Read these in parallel during `/flow:execute`.

- `apps/studio/git/service.ts` (lines 437–543) — `GitBranch`, `gitListBranches`, `gitCheckout`. The two-engine pattern (system vs iso) every git function follows.
- `apps/studio/git/service.ts` (lines ~768–835) — `gitPull` / `pullIso` / `pullSystem`: the **token + `onAuth` + remote-name validation** pattern `gitFetchRemote` must mirror.
- `apps/studio/git/endpoints.ts` (lines ~64–100, 181–209, 250–290) — endpoint shape, `readToken(body) ?? getGithubToken()` token resolution, `safeGitArg`/`isSafeGitPositional` argv-injection guards.
- `apps/studio/http.ts` (lines ~860–960) — `/_api/git/branches` (GET, main-origin), `/_api/git/checkout`, `/_api/git/pull`, `/_api/git/fold` routes + the loopback Host check on token-bearing routes. New `/_api/git/fetch` must be POST + `sameOriginWrite` + loopback, and **must NOT** be added to `CANVAS_SAFE_API` or `startCanvasServer` routes (DDR-088 dual-allowlist — privileged routes belong to neither).
- `apps/studio/client/panels/RepoBranchSwitcher.jsx` (whole file, ~360 lines) — the dock + popup. Note the `native` vs web-read-only split (line ~125), the `byRecent` sort + `query`/`matchesQuery`/`sharedMatchesQuery` filter (lines ~115–124), and the two render branches (`onShared` / draft).
- `apps/studio/test/git-branches.test.ts` — the real-repo bun test the new service logic extends.

### Files to Create

- `.ai/decisions/DDR-<next>-remote-draft-checkout-and-fetch-model.md` — records: (a) switching to a remote-only draft creates a local tracking branch via `checkout({remote,track})`; (b) the dirty-tree guard reused verbatim; (c) the fetch/token model (server keychain token, loopback-only, explicit-gesture-only, no auto-fetch); (d) why freshness is "last fetch" not "live". Reference DDR-051, DDR-054, DDR-109, DDR-119.

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/RepoBranchSwitcher.tsx` | (the component header cites it as the redesign source) | If present, it's the visual reference for the dock/popup; the remote-draft row + Refresh affordance should extend its existing `rb-pop-item` vocabulary, not invent new chrome. Read-only — do not modify `.design/`. |

### Patterns to Follow

Two-engine branch function (existing `gitListBranches`, post-`updatedAt`):

```ts
if (USE_SYSTEM_GIT) {
  const r = await runGit(dir, ['for-each-ref', '--format=…', 'refs/heads']);
  // …
} else {
  const names = await git.listBranches({ fs, dir });
  // …
}
```

Token-bearing iso operation (`pullIso`) — the shape `fetchIso` mirrors:

```ts
await git.pull({ fs, http, dir, remote, ref: branch, singleBranch: true,
  author, onAuth: () => ({ username: token, password: '' }) });
```

---

## Design Decisions

This is a native-only dock (the web path is a read-only badge — DDR-119). No mobile/tablet/registry components involved.

### Vocabulary (DDR contract — "draft" / "Shared version", no git jargon)

| Concept | UI treatment |
| ------- | ------------ |
| local + remote (`both`) | normal draft row, no extra label |
| remote-only (`remote`) | draft row + sub-label "from your team · not downloaded yet"; on click → "Downloading <name>…" spinner (reuse `switching` state copy) then reload |
| Refresh | a quiet `rb-pop-item--action` row at the bottom of the Version section: "Refresh drafts" + sub "as of <relative time>"; spins while fetching |
| no token on Refresh | inline error reusing the fold copy: "Sign in with GitHub to refresh." |

### Tokens / CSS

Reuse `rb-pop-item`, `rb-pop-icon--draft`, `rb-pop-sub`, `rb-search`, `rb-pop-empty`. Add one modifier (e.g. `rb-pop-icon--remote` or a small cloud/download glyph in the existing `Icon` map) for the remote-only affordance. No new color literals — semantic tokens only.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: UPDATE `GitBranch` + `gitListBranches` to include remote drafts

- **Do**: Add `where: 'local' | 'remote' | 'both'` to `GitBranch`. In `gitListBranches`, also enumerate remote branches and merge by name:
  - **iso**: `const remote = await git.listBranches({ fs, dir, remote: 'origin' })` (filter out `HEAD`). For each remote-only name, resolve `refs/remotes/origin/<name>` → `readCommit` for `updatedAt` (mirror the local `updatedAt` resolution already added).
  - **system**: extend the existing `for-each-ref` to also read `refs/remotes/origin` (a second `for-each-ref` with `%(committerdate:unix)`), or one call over `refs/heads refs/remotes/origin`.
  - Dedupe: a name present locally and remotely → one entry `where:'both'`, `current` from the local check, `updatedAt` = max(local, remote). Local-only → `where:'local'`. Remote-only → `where:'remote'`.
  - Exclude the remote's `HEAD` pseudo-ref and skip remote `main`/`master` from the **drafts** computation in the UI (it folds into "Shared version" as today — handled in the component, not the service).
- **Pattern**: existing two-engine block + the `updatedAt` resolution just added.
- **Gotcha**: `git.listBranches({remote})` returns whatever was fetched — empty/partial on a freshly-`init`ed repo with no remote. Must not throw → wrap remote enumeration in its own try/catch returning `[]`.
- **Validate**: `bun test apps/studio/test/git-branches.test.ts`

### Task 2: UPDATE `gitCheckout` to switch onto a remote-only draft

- **Do**: Accept that `name` may be a remote-only branch. When the local branch is absent:
  - **iso**: `git.checkout({ fs, dir, ref: name, remote: 'origin', track: true })` — creates `refs/heads/<name>` from `refs/remotes/origin/<name>` with upstream tracking. Keep the existing `git.checkout({fs,dir,ref:name})` for local branches (decide by checking the local set first, or just always pass `remote:'origin'` — verify iso-git prefers a local ref when it exists; if unsure, branch on presence).
  - **system**: `git checkout <name>` already DWIMs a remote tracking branch — no change, but verify the dirty-tree guard still catches the "would be overwritten" case.
- **Pattern**: existing `gitCheckout` body; keep the dirty-tree → "Save your changes before switching drafts." guard verbatim for both paths.
- **Gotcha**: if `refs/remotes/origin/<name>` doesn't exist locally (never fetched), iso checkout throws → surface a plain "Couldn't find that draft — try Refresh." rather than a raw error. This is the seam between Phase 1 (no fetch) and Phase 2 (Refresh).
- **Validate**: extend `git-branches.test.ts` — seed a bare "remote" repo, fetch/clone into a work dir, delete the local branch, assert `gitCheckout` re-creates it and `current` lands on it.

### Task 3: ADD `gitFetchRemote` (Phase 2)

- **Do**: New exported `gitFetchRemote(dir, token, { remote='origin' })`:
  - **iso**: `git.fetch({ fs, http, dir, remote, prune: true, onAuth: () => ({ username: token, password: '' }) })`. No `singleBranch` → fetches all remote heads so new drafts appear. Tokenless → `{ ok:false, authRequired:true, error:'Sign in with GitHub to refresh.' }` (mirror `pullIso`).
  - **system**: `git fetch --prune <remote>` with the same `tokenHeaderArgs(token)` pattern + `isSafeGitPositional(remote)` guard as `pullSystem`.
  - Return `{ ok, authRequired?, error? }`. Optionally return a timestamp the UI shows as "as of …".
- **Pattern**: `gitPull` / `pullIso` / `pullSystem` (token, onAuth, remote-name validation, error mapping).
- **Gotcha**: NEVER log the token. Don't write fetch state into `_server.json`.
- **Validate**: unit test with a local bare remote (no network) — `git-branches.test.ts` style; assert a new branch on the bare remote becomes visible to `gitListBranches` after `gitFetchRemote`.

### Task 4: WIRE endpoints + routes

- **Do**:
  - `endpoints.ts`: `gitListBranches` already flows through `branches()` — no change beyond the richer shape. Add `async function fetchRemote(body)` resolving `token = readToken(body) ?? await getGithubToken() ?? undefined`, calling `gitFetchRemote`. Add `fetchRemote` to the `GitApi` interface.
  - `http.ts`: add `'/_api/git/fetch'` route — POST only, `sameOriginWrite` gate, loopback Host check (copy the fold/pull route guards). **Do NOT** add it to `CANVAS_SAFE_API` or `startCanvasServer` routes (DDR-088). `/_api/git/checkout` is unchanged (it already carries the body; remote checkout is internal to the service).
- **Pattern**: the `/_api/git/pull` + `/_api/git/fold` route blocks and their endpoint handlers.
- **Gotcha**: keep the `GET → 405` assertion coverage for the new privileged route per `test/canvas-origin-gate.test.ts` conventions (a privileged route must 404/blocked from the canvas origin).
- **Validate**: `bun test apps/studio/test/canvas-origin-gate.test.ts`

### Task 5: UPDATE `RepoBranchSwitcher.jsx` — remote rows + Refresh

- **Do**:
  - The branch list now carries `where`. In both render branches (`onShared` / draft), keep the existing recents sort + search filter; for a `where==='remote'` row add the "from your team · not downloaded yet" sub-label and a remote glyph.
  - On click of a remote-only row → existing `switchDraft(name)` (the service handles tracking-branch creation); set `switching` copy to "Downloading <name>…".
  - Add a "Refresh drafts" action row (gated by `native`) that POSTs `/_api/git/fetch`, shows a spinner, then refetches `/_api/git/branches` and updates state (or reloads). Show "as of <relative time>" using the fetch timestamp; on `authRequired`, show the sign-in error inline.
  - `showSearch` threshold unchanged; remote drafts count toward `allDrafts.length`.
- **Pattern**: existing `switchDraft`, the `rb-pop-item--action` "New draft" row, the `switching`/`err` state.
- **Gotcha**: web (non-`native`) path stays the read-only badge — **no remote rows, no Refresh** there (DDR-119). Reset `query` on close still applies.
- **Validate**: rebuild bundle (Task 7) + manual native dogfood.

### Task 6: ADD the Icon glyph for remote drafts

- **Do**: Add a small `cloud`/`download` glyph to the `Icon` map in `RepoBranchSwitcher.jsx` for the remote-only affordance (single 1.4 stroke, 16-viewbox, matching the existing set).
- **Validate**: renders in the popup.

### Task 7: REBUILD the committed client bundle

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` (+ `dist/styles.css` if CSS changed). Per CLAUDE.md the committed bundle is what ships; the dev source must be rebuilt `--release` or a 3.6 MB dev bundle gets shipped.
- **Gotcha**: do NOT commit the generated `dist/maude-darwin-arm64` binary (gitignored).
- **Validate**: `grep -c "Refresh drafts" dist/client.bundle.js` → 1.

### Task 8: RECORD the DDR

- **Do**: Write `DDR-<next>` per the **Files to Create** entry. Run `pnpm --filter @maude/site gen:reference && gen:stats` if the DDR/plan should surface on the site (`site-content` quality gate), and the roadmap regen (`pnpm --filter @maude/site gen:roadmap`) since a plan file changed.
- **Validate**: `bash scripts/check-version-parity.sh` unaffected; `site-content` gate green.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Tests**: `pnpm test && pnpm test:dev-server` (esp. `git-branches.test.ts`, `canvas-origin-gate.test.ts`)
4. **Build**: bundle rebuild (Task 7) succeeds; `check-runtime-bundles.sh` floor respected
5. **Security pass** (token/network surface): spawn `security-auditor` + `ethical-hacker` over the new `/_api/git/fetch` route — confirm main-origin + loopback gating, no token leakage, argv-injection guard on `remote`.
6. **Manual native dogfood** (the verification ceiling for this native-only dock — no 5-platform scenario applies):
   - Clone a repo with several remote branches; confirm remote-only drafts appear, search finds them, switching downloads + checks out and the workspace reloads onto it.
   - On a draft with a dirty tree, confirm "Save your changes before switching drafts." still fires.
   - Refresh after a teammate pushes a new branch → it appears; tokenless Refresh → "Sign in with GitHub to refresh."
   - Web studio (browser) still shows the read-only badge with no remote rows / no Refresh.

---

## Scenario Coverage

Not a cross-platform UI surface — native desktop dock only (web path is read-only). The standard 5-platform `scenario-runner` doesn't apply; verification is the Task-5/6 unit tests + the manual native dogfood above. Note this divergence in the PR description (and the DDR) per the acceptance checklist's "or a DDR explaining intentional divergence".

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/flow:utils-verify` passes after each task (max 3 iterations)
- [ ] Remote-only drafts list, search-match, and switch (auto tracking-branch) on the iso (default) engine
- [ ] Refresh fetches new remote drafts behind an explicit gesture; tokenless → clear sign-in prompt; no auto-fetch on open
- [ ] Web read-only badge path unchanged (DDR-119)
- [ ] `security-auditor` + `ethical-hacker`: 0 blockers on the new fetch route
- [ ] Committed bundle rebuilt `--release`; binary not committed
- [ ] DDR recorded; roadmap/site regen committed in the same change
- [ ] Code follows project conventions, no regressions
