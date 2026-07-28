# DDR-162: "Add to Shared version" opens a pull request on GitHub remotes; SSH-remote parity for publish/get-latest

- **Date:** 2026-07-10
- **Status:** Accepted (implemented on `main` — Part A transport fix + Part B PR flow)
- **Tags:** studio, git, github, pull-request, ssh, transport, isomorphic-git, collaboration, branch-protection, security
- **Related:** [DDR-131](./DDR-131-remote-draft-checkout-and-refresh-model.md) (the remote-URL transport gate this extends to the write paths), [DDR-133](./DDR-133-system-git-autodetect-and-git-native-switcher-vocabulary.md) (auto-prefer system git for network paths), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas-origin trust — why `/_api/git/*` stays main-origin-only), [DDR-114](./DDR-114-github-oauth-app-implementation-boundary.md) (hand-rolled GitHub REST client this adds `createPullRequest` to). RCA: `.ai/logs/rca/issue-maude-ssh-remote-publish-and-pr-flow.md`.

> **DDR-number note:** drafted as 161, renumbered to **162** — a concurrent `feature-photo-editor` session landed its own DDR-161 on `main` first (the shared-main numbering race; memory `ddr-numbering-races-on-shared-main`).

## Context

Reported from a real StudyFi repo driven through the Maude desktop app: making a draft and choosing **"Add this draft to the Shared version"** threw the raw `Git remote "git@github.com:StudyFi-Team/studyfi-design.git" uses an unrecognized transport protocol: "ssh"`. Two independent defects surfaced in one gesture (full evidence in the RCA):

1. **Transport (Part A).** `gitPush`/`gitPull` chose their engine on the `MAUDE_USE_SYSTEM_GIT` env flag (off by default), so an ssh remote fell into isomorphic-git's HTTP-only transport and threw. The network *read* paths (`gitFetchRemote`, `remoteAheadBehind`) were already hardened for this under DDR-131/DDR-133; the *write* paths were missed.
2. **No PR flow (Part B).** `gitFoldDraft` implemented "Add to Shared version" as a **local merge into `main` + direct push to `main`**. On a repo whose `main` has branch protection requiring pull requests — the norm for a team repo, and StudyFi's case — GitHub rejects a direct push regardless of transport. So even with Part A fixed, the gesture could not succeed. There was **no pull-request code anywhere** in the app, contradicting the project's own declared `github-flow`.

## Decision

### 1. Publish/get-latest obey the same transport gate as fetch (Part A)

`gitPush`/`gitPull` route through a shared `resolveNetWriteRoute` mirroring `gitFetchRemote`'s gate: **ssh → system git**, github-only token-host policy (the PAT rides only a trusted-host HTTPS request), `ext::`/`fd::` command-executing helpers **refused before any spawn** (RCE), plain file/local remotes allowed to the system engine (matching `HARDENED_REMOTE_FLAGS`' "file object transfer is legitimate, only shell-helpers are blocked" stance), and `none` (no remote) keeps the pre-gate routing so a local-only project's tokenless publish still short-circuits to "sign in" unchanged. A friendly transport-error belt in the iso catch blocks + a `code 127` (no git CLI) message in the system engine ensure the raw iso string can never reach the UI again. The test gap that let this ship (only `fetch` had ssh coverage) is closed with push/pull/fold cases.

### 2. On a GitHub remote, "Add to Shared version" opens a pull request — it never pushes `main`

`gitFoldDraft` branches on the remote:

- **GitHub remote** (`isGitHubRemote` routing heuristic → `git@github.com:…` / `https://github.com/…`): push the **draft branch** (branch protection guards the Shared version, *not* the draft, so this succeeds) and signal the endpoint to open a PR `draft → shared`. **No local merge or push of `main` happens.** The merge lands on GitHub after review — exactly how a protected `main` is meant to be updated. Maude never merges `main` itself.
- **No remote, or a non-GitHub local remote:** unchanged — merge the draft into `main` locally (there is no PR host). This preserves the purely-local-project behavior and its existing test.

### 3. The PR is orchestrated server-side, inside the existing `fold` endpoint — no new HTTP route

`createPullRequest(token, owner, repo, {head, base, title, body})` is added to the hand-rolled GitHub REST client (`github/service.ts`, mirroring `createRepo`; a 422 probes for an already-open PR and returns its link so a re-run is idempotent, else surfaces "nothing new to add"). The **`fold` endpoint** (`git/endpoints.ts`, which already resolves the keychain token) parses `owner/repo` with the security-anchored `parseGitHubRemote` and calls `createPullRequest`, returning `{ ok, prUrl, prNumber }`.

**Deliberately NOT a separate `/_api/github/create-pr` route** (the plan's first sketch): the draft-push and the PR-open are one user gesture, so one server round-trip with the failure handled in one place is cleaner and avoids a new canvas-origin allowlist surface (DDR-088 dual-allowlist). `/_api/git/fold` is already main-origin-only; the posture is unchanged.

### 4. Partial success is `ok:true`, not a hard failure

If the draft pushes but the PR can't be opened — no in-app GitHub sign-in (an ssh push succeeds on the user's key, but the REST API needs a token), a non-GitHub remote, or the PR call errors — the endpoint returns `{ ok:true, published:<draft>, prUnavailable:true, error:<reason> }` and **keeps the draft**. The work IS published; the UI shows the reason as a heads-up and the user can sign in and retry or open the PR by hand. Losing the pushed draft over a PR-API hiccup would be the worse failure.

## Alternatives considered

- **Separate `/_api/github/create-pr` route, client-orchestrated (fold → then create-pr).** Rejected: two round-trips, client-side orchestration state, and a new canvas-origin allowlist entry to gate — for no benefit over doing it in the one gesture's existing endpoint.
- **Direct-push to `main`, fall back to a PR only on a protected-branch rejection.** Rejected: unpredictable (behaves differently per repo), wastes a push that gets rejected, and still needs the whole PR path — so "always PR when a GitHub remote exists" is simpler and matches `github-flow`.
- **Keep the local merge and just surface a friendlier protected-branch error.** Rejected as the primary fix: it leaves the user to open the PR by hand every time; it's at most a stopgap, not the capability the workflow needs.

## Consequences

- SSH-cloned team repos (the GitHub default) can publish, get-latest, and add drafts from the Maude UI. On a protected `main` the draft lands via a reviewable PR, surfaced as a link in the draft switcher.
- `git/endpoints.ts` now imports `parseGitHubRemote` (github/endpoints.ts) + `createPullRequest`/`GitHubApiError` (github/service.ts) — a one-directional dependency, no cycle.
- **Verification ceiling:** the full loop (real ssh draft push → real PR opened against a protected `main`) is a user-dogfood step — the harness can hit the routing + REST-shape hermetically (stubbed fetch, `GIT_SSH_COMMAND=false` for a no-network push failure) but not a live protected GitHub repo.
- Follow-up: the `desktop-e2e` scenario for the draft-switcher PR-link toast.
