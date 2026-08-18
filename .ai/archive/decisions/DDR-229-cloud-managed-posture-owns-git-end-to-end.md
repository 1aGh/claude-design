# DDR-229 — The cloud-managed posture owns git end to end: the desktop stops running local git, and History reads the cloud

**Status:** Accepted — 2026-08-18.
**Related:** [DDR-218](DDR-218-cloud-linked-repo-commit-model.md) (**extends** — same gate, wider scope; its "presentation, not a control" rule is KEPT, not reversed), DDR-119 (the desktop must never commit under the user), DDR-198/209/213 (the cell is the sole committer), DDR-051 (the git-lifecycle watcher), DDR-054 (the canvas origin is untrusted), DDR-088 (a privileged route belongs to NEITHER canvas allowlist), DDR-115 (the runtime-state taxonomy).
**Instruments:** `apps/studio/git/log-format.ts` (new, shared), `apps/hub/src/history.mjs` (new), `apps/hub/Dockerfile`, `apps/studio/cloud/endpoints.ts` (`history` / `historyFile`), `apps/studio/http.ts` (`/_api/cloud/history`, `serveHistoricalCanvas`), `apps/studio/client/app.jsx` (the hoisted posture + the gates), `apps/studio/client/panels/GitPanel.jsx` (`historySource`).

## Context

DDR-218 withdrew the working-tree half of the desktop Changes panel whenever the cell commits this project. It withdrew **the offer** and not **the machinery**, and it left the History tab pointed at the local repo.

The result was reported as a single screenshot: the panel says *"Cloud is saving — changes sync automatically"* and directly underneath says *"No saved versions yet"*, while the same canvas in cloud studio shows three commits. Both sentences are true — about different repos. Together they read as "nothing is being saved," which is the exact fear the note above them exists to answer.

Three mechanisms kept describing a repo the user is not editing through: `gitLoadLog` always hit the local `/_api/git/log`; the app went on polling `/_api/git/status` (mount, refresh, and the `?remote=1` ahead/behind probe) and deriving the tree's M/A/D badges from it; and the panel header rendered the LOCAL project and branch (`desktop-side / main`) above the CLOUD's commits.

## Decision

**While a folder is linked AND credentialed to Maude Cloud, Maude runs no local git of its own, and History reads the cell's.** One posture flag already owned this question (`savingIsManaged`); this widens what it governs, in three layers.

**Layer 1 — the desktop stops running local git (UI and actions only).** The mount status fetch, both status refreshers, the remote ahead/behind probe, the `git-status` WS push, the `dirtyByPath` badge map and the drafts switcher (`RepoBranchSwitcher`) are all gated on the posture, reactively — Connect stops them and Disconnect resumes them live, with no reload. The posture constants move to the top of the component because a dependency array evaluates during render and a `const` below its first consumer is a temporal-dead-zone crash at boot, not a warning.

**Layer 2 — History reads the cloud.** Two new token-authenticated, scope-filtered hub routes (`GET /api/history`, `GET /api/history/file`), reached **server-side** through the hub credential `readLinkedHub()` + `getHubToken()` already resolve. The token never reaches the browser; the client talks only to the loopback `/_api/cloud/history`, which returns the same entry shape the row renderer already draws.

**Layer 3 — click-to-preview at a cloud sha.** `serveHistoricalCanvas` resolves its source local-first, then from the cell. Everything downstream — the build, the CSP, the `(path, sha)` LRU, DiffView — is untouched, because historical content is immutable and a cloud-sourced build caches under an identical key.

**The shape invariant.** The log's pretty-format, its argv (including the `GIT_LITERAL_PATHSPECS` hardening that must travel WITH a scoped argv) and its parser move into `git/log-format.ts`, imported by both the studio service and the hub — the same "one engine, copied into the image" rule `autocommit.ts` and `canvas-path.ts` already follow. A cloud commit row and a local commit row cannot drift into different shapes behind one renderer.

**`.git` IS STILL UNTOUCHED, AND THAT IS THE POINT OF THE WORDING.** No hook is installed, no config is written, `git` in a terminal is byte-for-byte unaffected, the local `/_api/git/*` routes keep exactly their old gates, and **`git/watch.ts` stays live** — a terminal `git checkout` must still flush into Yjs (DDR-051). What stops is **Maude's own** local git activity. We stop *Maude* from doing local git; we do not stop *the user*.

### Rejected alternatives

- **Refusing the local `/_api/git/*` write routes while linked.** Rejected — it converts DDR-218's presentation rule into a control, which is the trust violation DDR-218 already declined ("touching a user's `.git` on their behalf"). It would also break the exact terminal workflow DDR-218 promised would survive, and it fails safe in the wrong direction: a stale posture flag would lock a user out of their own repo.
- **Disabling `git/watch.ts` alongside the polls.** Rejected — it looks like the same class of thing (local git activity) and is not. The watcher is a correctness mechanism, not a save surface; disabling it would silently desync anyone who uses git in a terminal. Pinned by a NEGATIVE assertion so a future tidy-up cannot quietly add the gate.
- **Merging the cloud log into the local one.** Rejected — two repos with unrelated object graphs produce rows that cannot be previewed interchangeably, and the merged list would be the same "which repo is this about?" ambiguity in a new shape.
- **Fetching the hub history from the browser.** Rejected — it would put the hub credential in the client. Every other cloud call in this module is already server-side for exactly this reason.
- **Reporting a failed cloud read as an empty history.** Rejected explicitly: collapsing "could not reach the cloud" into "no versions yet" is a re-run of the original bug over the network. `null` means unreachable (warning callout + Retry), `[]` means genuinely empty.
- **Serving the historical blob as JSON.** Considered — it keeps one responder shape. Rejected in favour of `text/plain` + `nosniff`, matching the file-door route's posture; the desktop proxies it server-side and never renders it.

### What the new routes refuse

Both are privileged and registered in **neither** canvas allowlist (DDR-088). Gates run auth → rate limit → validation → scope, and **every post-auth refusal is `404`** — out-of-scope, out-of-tree, malformed, wrong class and simply absent are one answer, so neither route can become a filesystem oracle. `sha` is anchored to `/^[0-9a-f]{7,40}$/` on **both** sides (it reaches the preview route from the untrusted canvas origin, and "the other end checks it" is how a guard ends up on neither end); a ref expression can never reach git. `path` is containment-checked through symlinks and membership-checked, so `config.json` and DDR-115 runtime state are refused. A scoped token cannot read the repo-wide log, because nothing could filter it per-commit. A hub `401` here is a **plain read failure** and must never take `/_api/cloud/status`'s credential-deleting path (confused-deputy F6) — a cell restarting mid-renewal would otherwise silently unlink a working project because History polled at the wrong second.

## Consequences

- The linked desktop's History shows the cell's commits, headed by the cloud project name (hub host as fallback), and a row previews the canvas at a sha that exists only on the cell.
- While linked, the desktop issues **zero** local-git status/remote calls. Disconnect restores the full local panel live; an unlinked folder is behaviourally unchanged.
- `createGitRunner` gains `maxCapture` and per-call `env`. The blob route checks `cat-file -s` before reading, because a silently truncated canvas body builds into a plausible-looking wrong canvas.
- `apps/hub/Dockerfile` must copy `apps/studio/git/log-format.ts` into the bundler stage, or the cell fails to build with "Could not resolve".
- The historical-canvas miss path now spends a network round trip as well as a git process, so it gains a bounded negative cache — and the existing global build limiter, which must stay ABOVE both lookups, now caps the hub fan-out too.
