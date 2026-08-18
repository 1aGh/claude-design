# Feature: Cloud-managed git posture — the desktop stops running local git and shows the cloud's history

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

When a desktop folder is linked + credentialed to Maude Cloud, the cell is the sole committer (DDR-198/209/213). DDR-218 already withdrew the *working-tree half* of the Changes panel in that posture — but it withdrew only the offer, not the machinery, and it left the History tab pointed at the **local** repo, which in that posture nobody ever commits to.

The result is the reported symptom: the panel says "Cloud is saving — changes sync automatically" and directly underneath says **"No saved versions yet"**, while the same canvas in cloud studio shows three commits. Both statements are true about different repos, and together they read as "nothing is being saved."

This feature makes the posture whole: while cloud-linked, the desktop **stops doing local git at all** (no status poll, no remote ahead/behind probe, no dirty badges, no drafts/branch switching) and the History tab reads the **cloud's** history, including click-to-preview of a past version. Unlinked, everything reverts to today's full local-first panel, live, without a reload.

## User Story

As a designer whose folder is connected to Maude Cloud, I want the app to show me the history that is actually being written — the cloud's — and to stop showing me a second, dead, local git surface, so that I can trust that my work is saved and can look back at any version.

## Problem

1. **The History tab lies by omission.** `gitLoadLog` always hits the desktop's own `/_api/git/log` (`app.jsx:11383`), which reads the local repo. In cloud-managed posture that repo has zero commits — nobody writes it (`sync/index.ts:496`: "NO autocommit lives in this runtime"; DDR-119 forbids committing under the user).
2. **The withdrawal is presentation-deep only.** `savingIsManaged` zeroes the *count*, but `app.jsx` keeps polling `/_api/git/status` (9698, 11287) and `?remote=1` (11299), keeps deriving `dirtyByPath` M/A/D badges for the tree, and keeps rendering `RepoBranchSwitcher` (2981) — all of which describe a repo the user is not editing through.
3. **The panel header names the wrong repo.** It renders `project / branch` from local git status — the screenshot's `desktop-side / main` versus the cloud's `local-cell-s… / main`.

## Solution

One posture flag already exists and is already tested as the single owner of this question (`cloudManaged`, `cloud-managed-save-surfaces.test.ts`). Extend what it governs, in three layers:

**Layer 1 — the desktop stops running local git (UI + actions only).** Gate the status poll, the remote probe, the dirty-badge map, and the drafts switcher on `!savingIsManaged`. **`.git` is untouched**: no hook, no config write, `git` in a terminal is byte-for-byte unaffected, and the local `/_api/git/*` routes keep exactly today's gates. This preserves DDR-218's "presentation, not a control" and DDR-119's "the developer's git is theirs" — we stop *Maude* from doing local git, we do not stop *the user*. **Explicitly out of scope:** the git-lifecycle watcher (`git/watch.ts`, DDR-051) stays live — a terminal `git checkout` must still flush into Yjs. It is a correctness mechanism, not a save surface.

**Layer 2 — History reads the cloud.** Two new token-authenticated, scope-filtered hub routes (`GET /api/history`, `GET /api/history/file`), reached from the desktop **server-side** using the hub credential already resolved by `cloud/endpoints.ts:readLinkedHub` + `getHubToken`. The token never reaches the browser. A new studio route `/_api/cloud/history` proxies it and returns the **same entry shape** the client already renders, so `GitPanel` needs no new row renderer.

**Layer 3 — click-to-preview at a cloud sha.** `serveHistoricalCanvas` (`http.ts:601`) already builds a canvas from `gitShowFile(repoRoot, sha, rel)` and caches by `(path, sha)`. Make that *source resolution* cloud-aware: local git first, and when the repo is cloud-managed and the sha does not resolve locally, fetch the blob from the hub. Everything downstream — bundling, CSP, the LRU, DiffView — is unchanged.

**Shape invariant.** The log's pretty-format and parser move into one shared module imported by both the studio service and the hub (the same "one engine, copied into the image" rule `autocommit.ts` and `canvas-path.ts` already follow), so a cloud commit row and a local commit row can never drift.

## Metadata

- **Type**: Enhancement (completes a shipped decision)
- **Complexity**: Medium-High — cross-package (studio client + studio server + hub + Dockerfile), new authenticated network surface
- **App/Package**: `apps/studio`, `apps/hub`
- **Affected Systems**: GitPanel / app shell posture, studio cloud endpoints, hub HTTP API, historical-canvas build path, hub container image
- **Dependencies**: none new (no npm additions)
- **Supersedes/extends**: DDR-218 (extends — same gate, wider scope; the "presentation, not a control" rule is *kept*, not reversed)

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message.

- `apps/studio/client/panels/GitPanel.jsx` (150–230, 400–430, 480–520, 750–800) — Why: the `withdrawn` posture, the History load effect, the header, the empty state, the row renderer (only `author` + `sha` are displayed — email is never rendered).
- `apps/studio/client/app.jsx` (9530–9560, 9690–9705, 11240–11300, 11380–11420, 14465–14510, 2970–2990) — Why: `cloudLinkedHub` state, the two status polls, the remote probe, `gitLoadLog`, `dirtyByPath`, the posture constants, the GitPanel call site, `RepoBranchSwitcher`.
- `apps/studio/cloud/endpoints.ts` (355–405) — Why: `readLinkedHub()` + `getHubToken()` — the server-side seam where the hub URL and credential are already resolved. The new proxy belongs here, next to `status`.
- `apps/studio/http.ts` (2289–2296, 594–601, 718–800, 2415–2500) — Why: the local `/_api/git/log` route to mirror; `serveHistoricalCanvas` + its `(path, sha)` LRU; the `/_api/cloud/*` route block with its `sameOriginRead` + `isTrustedRequestHost` gates to copy verbatim.
- `apps/studio/git/service.ts` (1680–1745, 1810–1830) — Why: `gitLog`'s two engines, the `%x1f`/`%x1e` format and its `GIT_LITERAL_PATHSPECS` hardening (to extract), and `gitShowFile`'s containment checks (to mirror on the hub).
- `apps/hub/src/server.mjs` (995–1075) — Why: the exact route-module pattern to follow — `bearer` / `verify` / `matchesScope` / `respondJson` / `checkRateLimit`, plus the "in NEITHER canvas allowlist" guard (`!(studioProxy && isCanvasHost(request))`).
- `apps/hub/src/git-runner.mjs` — Why: `createGitRunner()`, the argv-restricted runner the new hub reader must use.
- `apps/hub/src/path-contain.mjs`, `apps/hub/src/file-membership.mjs` — Why: containment + the membership oracle that decides what a file read may address.
- `apps/hub/Dockerfile` (43–70) — Why: the `COPY apps/studio/<module>` lines; a new shared module MUST be added or the cell refuses to boot with "MISSING".
- `.ai/archive/decisions/DDR-218-cloud-linked-repo-commit-model.md` — Why: the decision this extends; its rejected alternatives (suppressing local git, installing hooks) bound what Layer 1 may do.

### Files to Create

- `apps/studio/git/log-format.ts` — the shared pretty-format string + record parser (`gitLogArgs()` / `parseGitLog()`), imported by both `git/service.ts` and the hub.
- `apps/hub/src/history.mjs` — `handleHistoryRoutes({...})`: `GET /api/history` (log) + `GET /api/history/file` (blob at sha), token + scope + containment + rate-limit gated.
- `apps/hub/test/history.test.mjs` — hub route tests.
- `apps/studio/test/cloud-history-posture.test.ts` — source-level pins for the widened posture (the `cloud-managed-save-surfaces.test.ts` house style).

### Documentation

- `.ai/archive/decisions/DDR-119-*.md` — Why: why the desktop must never commit under the user; bounds Layer 1.
- `.ai/archive/decisions/DDR-088-*.md` — Why: a privileged route belongs to NEITHER canvas allowlist; both new hub routes are privileged.

### Patterns to Follow

The hub route-module contract (`server.mjs`, journal block) — copy this shape exactly, including the canvas-origin exclusion:

```js
if (authPath.startsWith(HISTORY_PREFIX) && !(studioProxy && isCanvasHost(request))) {
  const handled = await handleHistoryRoutes({
    path: authPath, method,
    query: Object.fromEntries(new URL(url, 'http://x').searchParams),
    bearer: (request.headers?.authorization ?? '').replace(/^Bearer\s+/i, '').trim() || null,
    verify: (token) => verifyToken(dataDir, token, secret),
    matchesScope,
    repoDir: workspaceMode ? repoDir : null,
    run: workspaceMode && repoDir ? createGitRunner() : null,
    designRoot: journalDesignRoot,
    checkRateLimit: rateLimit ? (label) => checkConnRateLimit(fileReadBuckets, label, assetWriteRateLimitMax) : undefined,
    respondJson: (status, payload) => respondAdminJson(response, status, payload),
  });
  if (handled) bailFromOnRequest();
}
```

The studio cloud-route gate (`http.ts`, `/_api/cloud/status`) — token-bearing, so both guards are mandatory:

```ts
if (!sameOriginRead(req)) return new Response('cross-origin rejected', { status: 403 });
if (!isTrustedRequestHost(req)) return new Response('local request required', { status: 403 });
```

The posture-is-named-once rule (`app.jsx:11417`) — extend these constants, never re-derive at a call site; `cloud-managed-save-surfaces.test.ts` fails the build if a second derivation appears.

---

## Design Decisions

No new visual vocabulary. Three copy/state changes inside the existing `GitPanel`:

| Surface | Today (cloud-linked) | After |
| --- | --- | --- |
| Panel header | `desktop-side / main` (local repo) | the cloud project + branch, with the hub host as fallback |
| Empty state | "No saved versions yet — Save a version and it'll show up here." | "The cloud is saving this project. Versions appear here as you work." (never offers a Save the posture has withdrawn) |
| Load failure | *(cannot happen — local read)* | new inline `callout--warning`: "Couldn't reach the cloud history." + Retry — reuses the existing `banner` mechanism, no new component |

Tokens/icons: unchanged (`Icon name="history"`, existing `gp-*` classes). No new dependency.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `apps/studio/git/log-format.ts` (shared log shape)

- **Do**: Extract from `git/service.ts:logSystem` — export `GIT_LOG_FORMAT` (`'%H%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e'`), `gitLogArgs(limit, filepath?)` (including the `--` terminator), and `parseGitLog(stdout)` → `{sha, message, author, email, date}[]`. React-free, dependency-free, importable from both a Bun studio build and the hub's Node/Bun runtime.
- **Do**: Rewrite `logSystem` to call them. `logIso` (isomorphic-git fallback) keeps producing the identical object shape — assert that in the test.
- **Pattern**: `apps/studio/sync/canvas-path.ts` — a tiny shared module whose header comment says *why* it is shared ("re-typing a guarantee is how the two halves drift").
- **Gotcha**: `GIT_LITERAL_PATHSPECS: '1'` is set by the *caller* when `filepath` is present — keep that hardening at both call sites, it is a recorded phase-27.1 security re-review outcome.
- **Validate**: `cd apps/studio && bun test test/git-*.test.ts`

### Task 2: ADD the two hub routes (`apps/hub/src/history.mjs`)

- **Do**: `GET /api/history?path=&limit=` → `{ entries: [{sha, message, author, date}] }`. **Omit `email`** — the client never renders it and a member's address is not needed to draw a row. Clamp `limit` to 1–100.
- **Do**: `GET /api/history/file?sha=&path=` → `200 text/plain` with the blob, or `404`. Cap at 2 MB.
- **Do**: Gates, in this order, on both: bearer verify → `matchesScope` → rate-limit (`fileReadBuckets`) → argument validation. Validate `sha` as `/^[0-9a-f]{7,40}$/` (no ref expressions — no `HEAD~3`, no `..`, no `:`). Validate `path` with `path-contain.mjs` **and** `file-membership.mjs`: refuse anything that is not inside the design root or that classifies as runtime state. Every post-auth refusal is `404`, never a distinguishing error — the `PROJECT_FILE_PREFIX` route's "no oracle" posture.
- **Do**: Register in `server.mjs` with the `!(studioProxy && isCanvasHost(request))` exclusion (DDR-088 — privileged routes belong to NEITHER canvas allowlist).
- **Pattern**: `apps/hub/src/journal.mjs` + the `handleProjectFileRoute` registration block.
- **Gotcha**: `workspaceMode && repoDir` may be null (a non-workspace hub) — answer `404`, never crash.
- **Gotcha**: use `createGitRunner()`; do not shell out directly. It restricts argv on purpose.
- **Validate**: `cd apps/hub && bun test test/history.test.mjs`

### Task 3: UPDATE `apps/hub/Dockerfile` — copy the shared module

- **Do**: Add `COPY apps/studio/git/log-format.ts /build/apps/studio/git/log-format.ts` next to the existing `autocommit.ts` / `repo-lock.ts` / `canvas-path.ts` lines (43–70).
- **Gotcha**: the file's own header (line ~158) states that a runtime-stage omission makes the cell refuse to boot with "MISSING" — verify the module lands in *both* the bundler stage and whatever stage the hub actually runs from.
- **Validate**: `docker build -f apps/hub/Dockerfile -t maude-hub:history-check .` then boot it against a scratch workspace and `curl -H "Authorization: Bearer <t>" .../api/history`.

### Task 4: ADD `/_api/cloud/history` + `/_api/cloud/history/file` to the studio server

- **Do**: In `cloud/endpoints.ts`, add `history(path?, limit?)` and `historyFile(sha, path)`: resolve `readLinkedHub()`; if not linked **or not credentialed** → `{ ok: false, reason: 'not-linked' }` (no network call). Otherwise `getHubToken(normalizeUrl(url))` and `fetch` the hub route with `Authorization: Bearer`. Timeout 8 s. **Never** return the token or the raw hub error body to the client.
- **Do**: In `http.ts`, register both under the existing `/_api/cloud/*` block with `sameOriginRead` + `isTrustedRequestHost`, and add them to the same main-origin-only list the neighbours are on (line ~409). They must be in **neither** `CANVAS_SAFE_API` **nor** the `startCanvasServer` routes map.
- **Gotcha**: `/_api/cloud/status` carries a comment that a `401` from the hub **deletes the stored credential** (confused-deputy F6). A history poll must **never** trigger that path — surface `401` as a plain read failure and leave the credential alone.
- **Validate**: `cd apps/studio && bun test test/cloud-*.test.ts`

### Task 5: UPDATE the client — History reads the cloud

- **Do**: In `app.jsx`, add `gitLoadCloudLog` (hits `/_api/cloud/history`) and feed the panel `loadLog={cloudManaged ? gitLoadCloudLog : gitLoadLog}` — decided **at the one place the posture is named**, not inside the panel.
- **Do**: Pass a new `historySource` prop (`'local' | 'cloud'`) so `GitPanel` can pick the header label and the empty-state copy without re-deriving the posture.
- **Do**: Header — when `historySource === 'cloud'`, render the cloud project + branch (from the lifted `cloudLinkedHub`; extend `CloudBar`'s `onLinkedHub` payload with the project name it already knows) and fall back to the hub host.
- **Do**: Error path — when the loader reports a failure, set the existing `banner` to a warning with a Retry action. Distinguish it from "genuinely empty": an empty successful load keeps the empty state, a failure shows the callout.
- **Validate**: `cd apps/studio && bun test test/cloud-history-posture.test.ts`

### Task 6: UPDATE the client — the desktop stops running local git

- **Do**: Gate on `!savingIsManaged`: the mount status fetch (9698), the `/_api/git/status` refresh (11287), the `?remote=1` remote probe (11299), and `dirtyByPath` (returns an empty Map in that posture — the tree's M/A/D badges are the same claim as the withdrawn count).
- **Do**: Withdraw `RepoBranchSwitcher` (2981) when `savingIsManaged` — a local branch switch moves a HEAD the cell knows nothing about.
- **Do**: The WS `gitStatus` broadcast handler (11248) must also no-op in that posture, or the server push re-populates everything the polls stopped fetching.
- **Gotcha**: **Do not touch `git/watch.ts`.** The git-lifecycle watcher turns a terminal `git checkout` into a Yjs flush + reload (DDR-051). It is correctness, not a save surface, and disabling it would silently desync anyone who uses git in a terminal — which is exactly the workflow DDR-218 promised would survive.
- **Gotcha**: everything here must revert **live** on Disconnect (no reload) — the same requirement `git-cloud-posture.test.ts` already pins for the panel. Drive it off the existing `useEffect` reactions to `savingIsManaged`, not off mount-time state.
- **Validate**: `cd apps/studio && bun test test/cloud-managed-save-surfaces.test.ts test/git-cloud-posture.test.ts`

### Task 7: UPDATE `serveHistoricalCanvas` — resolve a cloud sha

- **Do**: In `http.ts:757`+, replace the bare `gitShowFile(...)` call with a resolver: local `gitShowFile` first; if it returns `null` **and** the repo is cloud-managed, fetch via `cloud/endpoints.ts:historyFile(sha, repoRel)`. Keep the existing `(absPath, sha, RUNTIME_BOOT_ID, CHROME_EPOCH)` cache key — historical content is immutable, so a cloud-sourced build caches identically.
- **Do**: Keep the existing build budget/LRU guards on the miss path — a distinct-sha spray must not turn into an unbounded fan-out of hub requests. Add a short negative cache for shas the hub also cannot resolve.
- **Gotcha**: this route is reachable from the **canvas origin** (untrusted, DDR-054). The sha is attacker-influenceable, so the `/^[0-9a-f]{7,40}$/` validation in Task 2 is the load-bearing guard, and the desktop must not forward an unvalidated sha to the hub either — validate on **both** sides.
- **Gotcha**: the existing comment notes a historical render is an approximation (canvas code at the sha, today's DS/lib). That is unchanged and stays true for cloud shas.
- **Validate**: `cd apps/studio && bun test test/historical-canvas*.test.ts`

### Task 8: ADD tests — the posture, end to end

- **Do**: `apps/studio/test/cloud-history-posture.test.ts` — source-level pins in the established house style: the loader is chosen once at the posture constant; every local-git poll is gated on `!savingIsManaged`; `dirtyByPath` is gated; `RepoBranchSwitcher` is gated; the watcher is **not** gated (a negative assertion, so a future "tidy-up" cannot silently disable it).
- **Do**: `apps/hub/test/history.test.mjs` — 200 for an in-scope read; 404 for out-of-scope, for a traversal path, for a runtime-state path, for a ref expression (`HEAD~1`, `a..b`, `x:y`); 401 without a token; the rate limiter fires.
- **Do**: A drift test asserting `parseGitLog`'s output shape equals `logIso`'s (Task 1's invariant).
- **Validate**: `cd apps/studio && bun test` (alone — per the `maude-parallel-test-runs-contaminate` memory, never share the machine with the hub suite), then `cd apps/hub && bun test`.

### Task 9: REBUILD the committed client bundle

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` (+ `dist/styles.css` if touched).
- **Gotcha**: `git status apps/studio/dist/` **before and after** every `bun test` run in this tree — the test run has been observed clobbering `dist/` with unminified dev bundles. Whatever is committed is what ships.
- **Validate**: `scripts/check-runtime-bundles.sh`

### Task 10: RECORD the decision + surface it

- **Do**: `/flow:record-ddr` — DDR-229: "The cloud-managed posture owns git end to end: the desktop stops running local git and History reads the cloud." State the extends-not-reverses relationship to DDR-218 (the "presentation, not a control" rule is **kept** — `.git` untouched, routes unchanged, terminal git unaffected; what stops is *Maude's own* local git activity), and record the rejected alternative (refusing the local `/_api/git/*` write routes) with its reason.
- **Do**: Changeset (`integrations.changelog.provider: changesets`) + a **pending** What's New entry via the `whats-new-entry` skill.
- **Validate**: `maude kg import --dry-run` then `maude kg import`

---

## Validation

1. **Format/Lint**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` — then, separately, `cd apps/hub && bun test`
3. **Build**: `pnpm build`
4. **Manual, two-sided** (the harness from `scripts/dev/sync-e2e.mjs` boots both halves):
   - Linked desktop → panel shows the **cloud** project name and the cell's commits; a fresh cloud edit appears in desktop History within one reload.
   - Click a row → the canvas renders at that version (Task 7's cloud-sha path — verify it built from the hub, not from a lucky local match, by testing a sha that exists **only** on the cell).
   - **Disconnect** → the full local panel returns live, without a reload, with local history and local badges.
   - Unlinked folder → byte-identical to today (the regression that matters most).
   - Cloud unreachable while linked → the warning callout + Retry, never a silent empty state.
5. **A11y**: the new callout and the changed empty state are `role="status"` like their neighbours.

---

## Scenario Coverage

| Scenario | Covers | Status |
| --- | --- | --- |
| `sync-e2e` cold-start phase | the linked-desktop boot path the posture keys off | ✅ existing |
| `cloud-history-desktop` | linked → cloud rows visible → preview a cloud-only sha → disconnect → local panel returns | 🆕 new |

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/flow:utils-verify` passes after each task
- [ ] Linked desktop History shows the cell's commits, headed by the cloud project name
- [ ] Clicking a row previews the canvas at a sha that exists **only** on the cell
- [ ] While linked, the desktop issues **zero** local-git status/remote calls (verify in the server log)
- [ ] `.git` is provably untouched — no hook installed, no config written, terminal `git status`/`git commit` behave exactly as before
- [ ] `git/watch.ts` still flushes a terminal `git checkout` into Yjs while linked
- [ ] Disconnect restores the full local panel live, no reload
- [ ] An unlinked folder is behaviourally unchanged
- [ ] Both new hub routes: 401 without a token, 404 for out-of-scope / traversal / ref-expression / runtime-state, rate-limited
- [ ] DDR-229 recorded and ingested; changeset + pending What's New entry written
