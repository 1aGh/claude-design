# DDR-131: Remote drafts in the switcher — local-tracking-branch checkout + explicit Refresh fetch

- **Date:** 2026-06-29
- **Status:** Accepted (implemented — `.ai/plans/feature-remote-drafts-in-switcher.md`)
- **Tags:** dev-server, git, drafts, branches, isomorphic-git, network, token, security, native-only, vocabulary
- **Related:** [DDR-051](./DDR-051-collab-persistence-json-snapshot-at-quiescence.md) (HEAD-watcher flush on a draft switch — not duplicated), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) + [DDR-109](./DDR-109-native-shell-security-model.md) (token stays main-origin + loopback only), [DDR-119](./DDR-119-native-owns-the-workspace-web-is-a-repo-bound-companion.md) (native owns the workspace; web is a read-only badge). Code: `apps/studio/git/service.ts` (`gitListBranches`, `gitCheckout`, `gitFetchRemote`), `apps/studio/git/endpoints.ts`, `apps/studio/http.ts` (`/_api/git/fetch`), `apps/studio/client/panels/RepoBranchSwitcher.jsx`.

## Context

The draft switcher (`RepoBranchSwitcher`, phase 29 / E4) listed only **local** branches (`refs/heads`). A draft that exists on the remote but not locally — a teammate's, or one pushed from another machine — never appeared. After the search box shipped (commits da2fee4 / a7dfaf1) this became actively misleading: typing a real remote branch name returned "Nothing matches".

Two engine facts constrain any fix. The **default** engine is isomorphic-git (`MAUDE_USE_SYSTEM_GIT` defaults off; the desktop app never sets it). (1) `git.listBranches({ remote })` reads only `refs/remotes/<remote>/*` **already on disk** — populated by the original `clone`, but NOT refreshed by "Get latest" (`pull` is `singleBranch`). So a brand-new teammate draft is invisible until a full fetch. (2) iso-git's `git.checkout({ ref })` does **not** DWIM-create a tracking branch the way system `git checkout X` does — switching to a remote-only name needs `git.checkout({ ref, remote, track: true })`, and that throws if the remote ref was never fetched.

## Decision

Two-phase, chosen via `/flow:plan` divergence ("Fáze 1 + manuální Refresh").

1. **`gitListBranches` merges local + remote-tracking refs** into one row per name with a `where: 'local' | 'remote' | 'both'` tag and a recents `updatedAt` (max of the two sides). Remote enumeration is best-effort (`.catch(() => [])`) so a repo with no remote is unaffected. `origin/HEAD` is skipped.

2. **Switching onto a `remote`-only draft creates a local tracking branch** — iso: `checkout({ ref, remote: 'origin', track: true })` (local refs still take the plain path); system git already DWIMs. A name that was never fetched returns the plain-language **"Couldn't find that draft — try Refresh."** rather than a raw error — the seam between Phase 1 (no fetch) and Phase 2. The existing dirty-tree guard ("Save your changes before switching drafts.") is reused verbatim on both paths. The switch is still the same HEAD move the DDR-051 watcher turns into a Yjs flush + reload — not duplicated here.

3. **Freshness is an explicit gesture, never auto.** A new `gitFetchRemote` (iso `git.fetch({ remote, prune, onAuth })` / system `git fetch --prune`) fetches **all** remote heads so new drafts surface, behind a "Refresh drafts" button showing "as of &lt;relative time&gt;". We deliberately do **not** auto-fetch on popup open — that would put a network round-trip + token use behind a common UI action and add surprise latency. Token resolution mirrors `pull`/`fold`: server-held `getGithubToken()` (keychain bridge), never client-supplied; a tokenless refresh returns `authRequired` → "Sign in with GitHub to refresh." The `/_api/git/fetch` route is POST + same-origin-write + **loopback-Host-gated**, and absent from both `CANVAS_SAFE_API` and `startCanvasServer` routes (DDR-088 dual-allowlist — a privileged token-bearing route belongs to neither; guarded by `canvas-origin-gate.test.ts`).

4. **Native-only.** The web studio path stays the DDR-119 read-only badge — no remote rows, no Refresh. Only the native dock, which owns the workspace, mutates it.

## Consequences

- **Good:** the common "I cloned a repo with 10 branches but only have main locally" case is solved with **zero new network** (clone already populated the remote refs); search now finds those names; switching onto one Just Works. Brand-new teammate drafts are one explicit Refresh away. No new dependency; no token surface added to any non-explicit action.
- **Cost / accepted:** the list is only as fresh as the last Refresh/clone — a deliberate trade to keep popup-open free of network + token use. `gitFetchRemote`'s network path isn't covered by the offline unit tests (iso-git can't fetch a `file://` remote); it's verified by the tokenless-`authRequired` guard test + manual native dogfood. Remote checkout-creates-tracking-branch IS covered by an offline clone test (`switches onto a remote-only draft by creating a local tracking branch`).
- **Verification ceiling:** native-only dock, so the standard 5-platform `scenario-runner` doesn't apply — intentional divergence, recorded here per the acceptance checklist.
