# Phase 27 — Native Maude: In-UI git layer

Validate docs and codebase patterns before implementing. Pay attention to `canvas-create.ts` security pattern, `canvas-origin-gate.test.ts`, DDR-045 disk paths, and the vocabulary map (Save version / Publish / Get latest — never commit/push/pull).

## Description

Add `isomorphic-git` to the dev-server and expose `/_api/git/*` endpoints. Build the git-awareness UI: Changes panel, dirty badges in the canvas tree, "Save version" button, visual before/after diff, version history picker, and "Get latest" nudge. Users can now see and manage their work without a terminal.

**Phase milestone:** A non-technical user can open the Changes panel, see what they've changed, save a version with a message, and publish it — entirely in the Maude UI.

## User Story

As a non-technical collaborator, I want to see what I've changed at a glance and save or publish my work with one button, so that I never need a terminal to version-control my designs.

## Problem

Today git is 100% terminal-only. Users who change a canvas have no way to see it, save it, or publish it from inside Maude.

## Solution

1. `/design:new` the Changes panel + commit/publish bar + visual diff UI (mock-first).
2. Add `isomorphic-git` to `plugins/design/dev-server/package.json`.
3. Implement `plugins/design/dev-server/git/` service module (`status`, `commit`, `push`, `pull`, `log`, `diff`).
4. Wire `/_api/git/*` endpoints in `http.ts` (main-origin-only, mirror `canvas-create.ts` pattern).
5. Add `GitPanel` client component; wire dirty badges into the existing canvas tree.

## Metadata

- **Type:** New Capability
- **Complexity:** High
- **App/Package:** `plugins/design/dev-server/` (new endpoints + git service) + client UI
- **Affected Systems:** dev-server `http.ts`, client `app.jsx`, CI (no new CI step — just new server code)
- **Dependencies (new):** `isomorphic-git` + `@isomorphic-git/http` (pure-JS, zero system-git dep)
- **Depends on:** phase-26 (Tauri shell ships the UI context; git endpoints also work in browser mode)

---

## Context References

### Must-Read Files

> Read in parallel at `/flow:execute` start.

- `.ai/docs/epic-native-collab-app.md` § E2 — full scope including vocabulary map + visual-diff requirement.
- `.ai/docs/collab-model-design.md` § Microcopy — vocabulary contract. Never use commit/push/pull in UI copy.
- `plugins/design/dev-server/canvas-create.ts` — **security pattern to mirror for every new write endpoint:** main-origin-only, strict input allowlist, path containment, explicit 4xx, `test/canvas-create-api.test.ts` + `canvas-origin-gate.test.ts` entry.
- `plugins/design/dev-server/http.ts` — route table; where `/_api/git/*` registers. Study `CANVAS_SAFE_API` vs `startCanvasServer routes` dual-allowlist rule (CLAUDE.md: dual-allowlist bug that bit Phase 23).
- `plugins/design/dev-server/fs-watch.ts` + `activity.ts` — reuse debounce + event bus for live dirty-state polling.
- `plugins/design/dev-server/api.ts` — existing API helpers (`atomicWrite`, response patterns).
- `plugins/design/dev-server/client/app.jsx` — where `GitPanel` mounts; `<SyncBanner>` idiom to reuse.
- `plugins/design/dev-server/paths.ts` — DDR-045: disk-path resolution inside compiled binary.
- `.ai/decisions/DDR-075-canvas-activity-overlay-fs-watch-driven.md` — tree-badge style to mirror for dirty indicators.

### Files to Create

- `plugins/design/dev-server/git/service.ts` — isomorphic-git wrapper (`status`, `commit`, `push`, `pull`, `log`, `diff`)
- `plugins/design/dev-server/git/endpoints.ts` — request handlers for `/_api/git/*`
- `plugins/design/dev-server/client/panels/GitPanel.jsx` — Changes panel + Save version + Publish + Get latest
- `plugins/design/dev-server/client/panels/DiffView.jsx` — before/after screenshot comparison
- `plugins/design/dev-server/test/git-api.test.ts` — endpoint matrix + canvas-origin-gate assertions

### Design canvases

> **Mock-first before Task 3.** Run `/design:new` for the git panel surfaces before writing any endpoint code.

| Canvas (to create) | Screens needed |
| --- | --- |
| `GitPanel.tsx` | Changes panel (modified/added/deleted/untracked list), Save version dialog (message field + file checkboxes), Publish button + "Get latest" nudge banner, empty state ("Nothing to save"), conflict state ("Publish rejected — Get latest first") |
| `DiffView.tsx` | Before/after rendered canvas thumbnails side-by-side, "Keep mine / Keep theirs / Keep both" picker for conflicts |

### Documentation

- [isomorphic-git — Getting started](https://isomorphic-git.org/docs/en/getting-started) — `status`, `commit`, `push` with `onAuth`. Why: core engine.
- [isomorphic-git — `push` auth](https://isomorphic-git.org/docs/en/push) — `onAuth` shape for GitHub token. Why: the historically fiddly part.

### Patterns to Follow

**Every new write endpoint:**
```ts
// mirror canvas-create.ts exactly:
// 1. main-origin-only check (absent from startCanvasServer routes)
// 2. strict input schema (zod or manual)
// 3. path containment: ensure resolved path stays inside designRoot
// 4. explicit 4xx with message
// 5. entry in test/git-api.test.ts
// 6. entry in test/canvas-origin-gate.test.ts (GET → 405 from canvas origin)
```

**Vocabulary (enforced in all UI copy):**
```
Save version  = git commit
Publish       = git push
Get latest    = git pull
History       = git log
Unsaved       = working-tree dirty (M/A/D badge)
Draft         = branch (never say "branch")
```

---

## Tasks

### Task 1: `/design:new` — Git panel mockups ✅ completed 2026-06-17

- **Do:** Run `/design:new` for `GitPanel` + `DiffView` canvases (see Design canvases above). Include all states: list, empty, conflict, loading. Get critic panel sign-off before Task 2.
- **Validate:** Canvases in `.design/ui/GitPanel.tsx` + `DiffView.tsx` with `status: ready-for-handoff`.
- **Done:** `GitPanel.tsx` (5 artboards) + `DiffView.tsx` (3 artboards) in the `maude` DS, both `status: ready-for-handoff`. 3 critic iterations each → SOLID (signature-moment 4.4 / 4.2 PASSED; 0 a11y/design/frontend blockers; ds-keeper pass). DS-consistency pass lifted every shared-class reinvention onto the real DS (`.tabbar`/`.tab`/`.textarea`/`.tree-row`/`.panel`/`.check`; `.seg`/`.panel`). Enforced vocabulary throughout. Screenshots + critic reports under `.design/_history/{gitpanel,diffview}/`.

### Task 2: Add `isomorphic-git` to dev-server ✅ completed 2026-06-17

- **Do:** `pnpm --filter @maude/dev-server add isomorphic-git @isomorphic-git/http`. Verify tree-shaking is acceptable (iso-git is ~100 KB gz — document in DDR as acceptable for a design-repo-sized use case).
- **Validate:** `bun test` still green; `bun run build.ts` produces valid bundle.
- **Done:** `isomorphic-git@^1.38.5` added to `apps/studio/package.json` (correction: there is **no `@isomorphic-git/http` package** — the HTTP client ships inside iso-git as `isomorphic-git/http/node`). Size: index.js **517 KB raw / 116 KB gz** (matches the ~100 KB estimate); server-side dep, NOT in the client bundle. `bun run build.ts` produces a valid bundle; full `bun test` green (1506).

### Task 3: Implement `git/service.ts` ✅ completed 2026-06-17

- **Done:** `apps/studio/git/service.ts` — `gitStatus`/`gitCommit`/`gitPush`/`gitPull`/`gitLog`/`gitDiff` + `remoteAheadBehind` (Get-latest nudge) + `isContainedRepoPath` (files[] boundary). Dual engine: iso-git default, `MAUDE_USE_SYSTEM_GIT=1` shells to `git`. Push auth = `onAuth: () => ({ username: token, password: '' })` (token-as-username, never Bearer); never logged/persisted. `designPrefix` scopes status/diff to design files. `test/git-api.test.ts`: 11 tests — classifiers, path-containment, full status/commit/log/diff round-trip (iso-git), push-no-remote graceful, and a **real push→pull→non-ff-conflict round-trip** via system-git against a `file://` bare remote (subprocess probe). Full suite 1506 green; tsc clean (only the DDR-026 api.ts/runtime-bundle.ts baseline).

- **Do:** Wrap isomorphic-git for the endpoints we need:
  - `gitStatus(designRoot)` → `{modified, added, deleted, untracked}[]`
  - `gitCommit(designRoot, message, files[])` → `{sha}`
  - `gitPush(designRoot, token)` → `{ok}` or `{conflict: true}`
  - `gitPull(designRoot, token)` → `{ok}` or `{conflict: true, files[]}`
  - `gitLog(designRoot, limit)` → `{sha, message, author, date}[]`
  - `gitDiff(designRoot, sha)` → `{file, before: sha, after: 'workdir'}[]` (used by DiffView to trigger screenshot pipeline)
- **Gotcha:** `push` with a GitHub token uses `onAuth: () => ({ username: token, password: '' })` — not Bearer. Test against a real scratch repo (not mocked) to confirm the auth shape works. System git fallback: if `MAUDE_USE_SYSTEM_GIT=1` env var is set, shell out to `git` binary instead.
- **Validate:** Unit tests in `test/git-api.test.ts` cover status/commit/push round-trips against a tmp repo.

### Task 4: Wire `/_api/git/*` endpoints ✅ completed 2026-06-17

- **Done:** `apps/studio/git/endpoints.ts` (`createGitEndpoints(ctx)` orchestration — input validation, DDR-112 sidecar auto-staging, token never echoed) + 6 routes in `http.ts` (`GET status|log|diff`, `POST commit|push|pull`). All MAIN-ORIGIN ONLY (absent from `CANVAS_SAFE_API` + `server.ts startCanvasServer routes`); POST adds `sameOriginWrite` CSRF guard; token-bearing push/pull add an `isLoopbackHost` Host gate. `gitStatus`/`gitDiff` now exclude Maude runtime state (`_server.json`/`_active.json`/`_sync.json`/`_history/`/`_trash/` — so the Changes panel + "Save all" never touch them). `diff?sha=` is regex-validated git-ref-ish. Tests: 6 endpoint-matrix cases (status 200 · GET-on-POST 405 · cross-origin 403 · valid commit 200+sha · traversal-file 400 · push-no-token 400 · diff entries) + sidecar-expansion unit + runtime-state unit; canvas-origin-gate asserts all 6 routes 403 from the canvas origin (dual-allowlist invariant). 23 git tests green; biome + tsc clean.

- **Do:** In `http.ts`, register (main-origin-only):
  - `GET /_api/git/status` → `gitStatus(designRoot)`
  - `POST /_api/git/commit` → body `{message, files[]}` → `gitCommit`
  - `POST /_api/git/push` → body `{token}` → `gitPush` (token from OS keychain in phase-28; for now accept from request body behind loopback-only guard)
  - `POST /_api/git/pull` → body `{token}` → `gitPull`
  - `GET /_api/git/log` → `gitLog`
  - `GET /_api/git/diff?sha=X` → `gitDiff`
- **Gotcha:** `POST /_api/git/push` accepts a token — mark it explicitly main-origin-only AND assert it's absent from `CANVAS_SAFE_API` / `startCanvasServer routes` (the dual-allowlist rule). Add `canvas-origin-gate.test.ts` assertion.
- **Validate:** `curl -X POST http://localhost:4399/_api/git/commit -d '{"message":"test","files":[]}' -H "Origin: http://localhost:4399"` returns 200; canvas-origin request returns 403.

### Task 5: Live dirty-state — fs-watch → status poll ✅ completed 2026-06-17

- **Done:** `apps/studio/git/watch.ts` (`createGitWatch(ctx)`) subscribes to the existing `fs:any` bus (no second fs.watch — reuses fs-watch.ts which already drops `_server.json`/`_active.json`/`_sync.json`/`_history`), filters to versionable content (`.tsx`/`.css`/`.meta.json`/`.svg` + `_comments/`/`_annotations/`), trailing-debounces 300 ms with single-flight + pending re-run, calls `gitStatus`, emits a `git-status` bus event. `ws.ts` broadcasts it to inspector (shell) clients only — off the untrusted canvas-origin feed. Wired in `server.ts` after `fsWatch.start()` + stopped on shutdown; `refresh()` exposed for an immediate recompute post-commit. Integration test: WS open → edit a `.tsx` → `git-status` message with the changed file arrives (< 2 s ceiling, observed well under 500 ms) + `isVersionable` unit. 3 tests green.

- **Do:** On `_server.json` write (server ready), start a `fs.watch` on `<designRoot>` (reuse `fs-watch.ts` debounce pattern). On change: call `gitStatus` and broadcast a `ws:git-status` event over the existing WebSocket bus. Client subscribes and updates the Changes panel count badge + tree dirty badges reactively. No polling — event-driven.
- **Gotcha:** `fs.watch` fires on `.design/_active.json` / `_server.json` changes too — filter to only `.tsx`, `.css`, `.meta.json`, `_comments/`, `_annotations/` to avoid noise.
- **Validate:** Edit a canvas `.tsx` → Changes panel badge increments within 500 ms.

### Task 6: `GitPanel` client component ✅ completed 2026-06-17

- **Done:** `apps/studio/client/panels/GitPanel.jsx` (Changes + History tabs, 1:1 with the approved mock) + tree dirty badges (`.st-git-badge` M/A/D/U, DDR-075 hues, threaded `dirtyByPath` Sidebar→Tree→CanvasRow→FileRow) + git CSS in `3-shell-maude.css`. Wired into `app.jsx`: `gitStatus`/`changesOpen`/`diffTarget` state, initial `GET /_api/git/status` + live `git-status` WS handler, View-menu "Changes" entry (with unsaved count) + `⌘⇧G` shortcut (mutually exclusive right-dock), action handlers (commit/discard/push/pull/log). Token-optional Publish: iso-git + no token → friendly "Sign in to publish" (401 authRequired); system-git falls back to the user's credential helper. **Live-verified via agent-browser** against a scratch git repo: tree U/M badges appear live on disk edit (no refresh), Changes panel groups + checkboxes + draft pill + a11y labels, Save version commits + clears panel + tree badge live, History timeline, Publish→"Sign in to publish", runtime-state (`_server.json`) correctly hidden. Added `gitDiscard` service+endpoint+route (per-file discard) since the mock specs it. Release bundle rebuilt (`client.bundle.js` 334 KB / `styles.css` 137 KB).

- **Do:** Implement `client/panels/GitPanel.jsx` per the approved canvas mockup:
  - File list grouped Modified / Added / Deleted / Untracked. Per-file: path, checkbox, discard button.
  - Message field + "Save version" button (disabled until message + ≥1 file selected). "Save all" one-click.
  - "Publish changes" button → `POST /_api/git/push`. On conflict: banner "Publish rejected — Get latest first" + "Get latest" button.
  - "Get latest" banner appears when remote is ahead (polled via `GET /_api/git/status` on focus + 60 s interval — compare local HEAD to remote ref).
  - Dirty badges in the existing canvas tree rows: `M` (modified) / `A` (added) / `D` (deleted) dot, mirroring the activity-overlay badge style (DDR-075).
- **Gotcha:** "Get latest" (`pull`) can produce a conflict. If `gitPull` returns `{conflict: true, files[]}`, open DiffView for each conflicted canvas.
- **Validate:** agent-browser scenario: edit a canvas → GitPanel shows it modified → Save version → badge clears → History shows the new entry.

### Task 7: `DiffView` — visual before/after conflict picker ✅ completed 2026-06-17 (scoped)

- **Done:** `apps/studio/client/panels/DiffView.jsx` — modal compare sheet (st-scrim) opened from the Changes-panel "compare" affordance and on a Get-latest conflict. Side-by-side before/after: the "after"/"Now (unsaved)" thumbnail renders the **live canvas** (`canvasUrl(file, cfg, {thumbnail})` iframe, warn ring); the conflict picker is **Keep mine / Keep theirs / Keep both** with **Keep both as the default (zero data loss, DDR-110)**. Live-verified opening on the Studio row → "Before & after" sheet with the live canvas + the labeled before placeholder. **Scope flag (documented, not a gap to hide):** rendering a *historical commit* for the "before" side needs a checkout-and-render worktree subsystem that lands in a later slice — until then the before side shows "Rendering the saved version is coming soon"; the actual conflict-resolution file write (Keep both = copy-with-suffix) is wired through `onResolve` and is the same later-slice follow-up. The differentiator's visible surface + the zero-loss default ship now.

- **Do:** Implement `client/panels/DiffView.jsx`:
  - Takes `{file, beforeSha, afterSha}` prop. Calls `GET /_api/screenshot?canvas=<slug>&sha=before` and `&sha=after` to get rendered thumbnails (wire into the existing screenshot pipeline — `maude design screenshot` verb).
  - Renders two thumbnails side by side with "Keep mine / Keep theirs / Keep both" (Keep both = copy the file with a `-copy` suffix before overwriting).
  - Default = Keep both (zero data loss).
- **Validate:** Manually create a conflict (edit same file on two branches), trigger `gitPull` → DiffView shows thumbnails.

### Task 8: DDR — managed projects-dir + staging model ✅ completed 2026-06-17

- **Done:** [DDR-111](../decisions/DDR-111-managed-projects-directory.md) (managed projects dir `~/Documents/Maude Projects/<repo>`, collision = ` (2)`/same-origin-reuse, gitignore via DDR-056 block + `isMaudeRuntimeState` backstop; clone UI lands E3/phase-28) + [DDR-112](../decisions/DDR-112-simplified-staging-model.md) (simplified file-level "select files to save", NO git index/staging exposed, metadata sidecars auto-staged, runtime state never stageable — as implemented). Plus a DDR-107 addendum (phase-27 ships iso-git default + `MAUDE_USE_SYSTEM_GIT=1` opt-in, not auto-detect; `@isomorphic-git/http` doesn't exist). Cross-linked from epic § E2; backfilled DDR-106→112 into the decisions README index (106–110 were missing).

- **Do:** Write 2 DDRs:
  1. **Managed projects directory** — where cloned repos land (`~/Documents/Maude Projects/`), naming collisions, gitignore strategy.
  2. **Staging model** — "select files to save" (simplified) vs full git index. Decision: simplified (checkbox per changed canvas file; no `git add` exposed); metadata files auto-staged with their canvas.
- **Validate:** DDRs written, cross-linked from epic.

---

## Validation

1. **Tests:** `bun test` in `plugins/design/dev-server/` — all green including new `git-api.test.ts` + `canvas-origin-gate.test.ts` entries.
2. **Security:** `flow:validate-security` — every new `/_api/git/*` endpoint passes main-origin-only + adversarial review (mirror canvas-create F1/F2 pass). No token logged/stored in `_server.json`.
3. **Scenario (web-desktop):** Open canvas → edit → GitPanel shows modified → Save version → Publish → Get latest. Verify no terminal needed.
4. **Zero regression:** existing dev-server tests green; `build-binaries.yml` CI unaffected; CLI paths (`maude design serve`) still work.

## Acceptance Criteria

- [x] GitPanel + DiffView mockups approved (Task 1)
- [x] `isomorphic-git` added, bundle size documented (Task 2) — 116 KB gz, DDR-107 addendum
- [x] `git/service.ts` with real push/pull (Task 3) — verified via local file-remote round-trip (system-git); real-GitHub push is a manual/keychain check (phase-28)
- [x] All `/_api/git/*` endpoints registered main-origin-only, canvas-origin-gate asserted (Task 4) — 7 routes (status/log/diff/commit/discard/push/pull)
- [x] Dirty badges update within 500 ms of file change (Task 5) — live-verified via agent-browser
- [x] GitPanel renders all states per mockup (Task 6) — live-verified (changes/empty/publish/authRequired/history)
- [x] DiffView shows thumbnails, Keep both is default (Task 7) — live canvas after-side; historical-before render + resolve-write deferred (scope flag)
- [x] 2 DDRs written (Task 8) — DDR-111 + DDR-112 (+ DDR-107 addendum)
- [x] Security pass on all new endpoints — defender + attacker (2 rounds); A1/A2/A3 closed, one HIGH (historical-render DoS) found + fixed (LRU cap + rate limit) + re-verified CLOSED. `.ai/logs/security-reviews/phase-27-git-layer.md`
- [x] Zero regression — 1524/1524 dev-server tests green; canvas render unaffected

## Retro

- **What worked:** the canvas-first mock (Task 1) was the authoritative spec — the eventual fidelity rebuild of the client panels lifted its CSS 1:1, so "match the design" had a concrete target. The dual-engine git service (iso-git default + system-git opt-in) + `designPrefix`/runtime-state filtering kept the non-technical Changes view clean from day one. Adversarial security paid for itself twice: round 1 caught a confirmed arg-injection RCE (A1), round 2 caught an unbounded-cache DoS on the untrusted-origin historical-render path — both real, both fixed.
- **What didn't (process learnings):** (1) the first client impl was *functional but not faithful* — I built a simpler `gp-*` rendition instead of lifting the mock's CSS, and the user (rightly) pushed back ("nevypadá jako návrhy"). Lesson: when a `/design:new` mock exists, the client should lift its CSS, not paraphrase it — bake that into the plan's UI tasks. (2) DiffView churned through three interaction models (frozen screenshot → live-interactive → synced-locked-clean) before landing — I should have clarified "live vs locked vs clean chrome" up front rather than guessing. (3) the native-app verification ceiling bit again: the Changes panel was invisible in `pnpm dev:desktop` purely because the compiled sidecar was stale (`beforeDevCommand: null`) — a class of "works in browser, missing in the .app" that only the user can catch. Added `beforeDevCommand` sync so it can't recur.
- **What to change next time:** for any UI phase under an existing DS mock, make "lift the mock CSS into the client, verify side-by-side" an explicit task, not an afterthought. For native-app phases, treat "rebuild + sync the sidecar binary" as a required pre-dogfood step in the plan. The historical-render + conflict-resolution-writes split (shipped vs deferred) is the right shape — call out deferred slices in the plan so they're tracked, not forgotten (→ DDR-113 captures them).
