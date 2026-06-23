# Phase 27.1 — Native Maude E2 follow-up: History-view "click-to-preview" + DiffView version picker

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — this is a wiring slice over machinery that already ships.

## Description

Phase-27 shipped the in-UI git layer (GitPanel + DiffView + the `?sha=` historical-render machinery, DDR-113), but the **History tab is a read-only list** — its rows have no `onClick`, so a user can see saved versions but cannot open a preview of one. This violates the epic E2 spec (`.ai/docs/epic-native-collab-app.md:191` — *"History — version timeline, each entry click-to-preview"*). The render machinery (`serveHistoricalCanvas` / `gitShowFile` / `canvasUrl({sha})`) and DiffView's `beforeSha` parameter are already built and security-hardened; the only gap is UI wiring + a per-file log filter.

This phase wires the two missing interactions:
1. **History click-to-preview** — clicking a saved version in the History tab opens a before/after preview of the **currently open canvas or specimen** at that version.
2. **DiffView version picker** — inside the diff modal, a picker for the open file lets the user choose **which saved version** the "before" pane compares against (changes `beforeSha`).

## User Story

As a non-technical Maude user, I want to click a saved version in History and see how my **currently open** canvas looked then (and pick any earlier version to compare against in the diff view), so that I can browse my work's history visually without a terminal or a code diff.

## Problem

- `GitPanel.jsx:566-578` — History rows (`.gp-version`, `role="listitem"`) render message/author/short-sha/timeAgo with **no click handler**.
- `app.jsx:6829` — `onOpenDiff` only ever sets `beforeSha: 'HEAD'`; nothing passes a non-HEAD sha, so DiffView's already-parameterized `beforeSha` is never exercised beyond HEAD.
- A commit touches N files, so "what does a History row preview?" was left undecided → the wiring was dropped. **Resolved by the user: scope the preview to the currently-open file (`activePath`).**
- `gitLog(dir, limit)` has **no path filter**, so the History list is repo-wide — it can't show "versions that changed *this* canvas", which is what makes per-file preview meaningful.

## Solution

Add an optional **per-file filter** to the existing `/_api/git/log` (same route, new `?path=` query param — no new endpoint, no new allowlist entry; log is already main-origin-only). Then:
- Thread `activePath` into GitPanel; when a canvas is open, the History tab loads that file's history and rows become clickable → open DiffView at the chosen sha. When nothing is open, keep the repo-wide read-only list with a hint.
- Give DiffView a version picker that loads the open file's history and re-points `beforeSha` locally (the before pane already derives from it).

No new render subsystem, no new write surface. The expensive/untrusted historical-build path (LRU + rate-limit, DDR-113) is unchanged and already gates the only canvas-origin-reachable route.

## Metadata

- **Type**: Enhancement (follow-up — closes an E2 spec gap)
- **Complexity**: Medium (service + endpoint param + 2 client panels + app wiring + bundle rebuild)
- **App/Package**: `apps/studio` (dev-server / canvas browser)
- **Affected Systems**: git service + `/_api/git/log` endpoint; client GitPanel/DiffView panels + app.jsx git wiring; release bundle
- **Dependencies**: phase-27 (E2 git layer, DDR-111/112/113) — all shipped. No new npm deps.

---

## Context References

### Must-Read Files

> Read these in parallel in a single message during `/flow:execute`.

- `apps/studio/git/service.ts:597-615` (`gitLog` / `logIso` / `logSystem`) — Why: add the optional `filepath` arg here; iso-git `git.log` takes a `filepath` option, system-git needs `-- <path>`.
- `apps/studio/git/endpoints.ts:175-182` (`log(limitRaw)`) + `:26` (`isContainedRepoPath` import already present) — Why: add `pathRaw` param + containment validation, mirroring the `commit`/`discard` path-guard pattern (`:98`, `:121`).
- `apps/studio/http.ts:808-812` (`/_api/git/log` route) — Why: forward `?path=` into the endpoint. Route is MAIN-ORIGIN ONLY (absent from `CANVAS_SAFE_API` + `server.ts` routes) — keep it that way.
- `apps/studio/client/panels/GitPanel.jsx:140-210` (`log` state, `openHistory`, `loadLog`) + `:552-581` (History render) — Why: thread `activePath`, load per-file history, make rows clickable.
- `apps/studio/client/panels/DiffView.jsx:209` (props) + `:236-240` (`beforeSha`/`beforeSrc`) — Why: add the version picker + local `beforeSha` state.
- `apps/studio/client/app.jsx:5304` (`diffTarget` state), `:5843-5852` (`gitLoadLog`), `:6817-6830` (GitPanel render), `:6899-6916` (DiffView render) — Why: make `gitLoadLog` path-aware, thread `activePath`, add `onPreviewVersion`.
- `apps/studio/client/canvas-url.js:16-37` (`canvasUrl` — `sha`/`hideChrome`/`thumbnail` opts) — Why: confirm the `sha` opt that powers both panes (no change needed; reference only).
- `.ai/decisions/DDR-113-visual-diff-historical-render.md` — Why: the security envelope (LRU 96 + rate-limit 24/10s, `isSafeGitPositional` + containment) this slice must not weaken; the accepted "current-lib approximation" note.

### Files to Create

- *(none)* — all changes are edits. New DDR only if a design decision below is contested.

### Design canvases

> The handed-off mocks GitPanel + DiffView are the visual source of truth. The two new affordances (clickable history row, version picker) are interaction additions not in the original artboards — reuse their existing class shapes; an optional `/design:edit` pass (Task 0) can update the mocks for fidelity.

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/GitPanel.tsx` (+ `.css`) | `handed-off` | History timeline (`.gp-version` rail/node/body/meta/when). The clickable-row affordance lifts this row; add hover/focus + a "preview" cue. |
| `.design/ui/DiffView.tsx` (+ `.css`) | `handed-off` | before/after + `.seg` segmented control + Keep mine/theirs/both. The version picker should reuse the `.seg`/menu material, label "Saved version". |

### Patterns to Follow

- **Path containment guard** (endpoints.ts commit/discard):
  ```ts
  if (typeof f !== 'string' || !isContainedRepoPath(dir, f)) { /* 400 */ }
  ```
- **Vocabulary contract (DDR-110)** — visible copy says *Save version / Saved version / History / Draft*; **never** sha/commit/branch/push in visible text. Short-sha as dimmed meta is allowed (already in `.gp-version-meta`).
- **canvasUrl sha forwarding** — `canvasUrl(file, cfg, { sha })` is the entire render path; both panes already use it.

---

## Design Decisions

### History-row preview scope (the resolved ambiguity)

- **Decision:** A History row previews the **currently open canvas/specimen** (`activePath`) at that row's version — NOT the commit's full file set. This is the user's explicit choice and sidesteps a multi-file picker.
- **Consequence:** When a canvas is open, the History tab loads **that file's** history (`?path=<activePath>`) so the listed versions are exactly the ones that touched it. When nothing is open (or the SYSTEM tab is active), fall back to the existing **repo-wide** list, rendered read-only with a one-line hint ("Open a canvas to preview a saved version").

### No new endpoint / no new write surface

- Reuse `/_api/git/log` with an additive optional `?path=` param. It stays main-origin-only (not in `CANVAS_SAFE_API`). No canvas-origin reachability, so the DDR-113 DoS envelope is untouched. The `path` is validated with `isContainedRepoPath` (rejects traversal / out-of-tree) and passed positionally after `--` for system-git (no option injection).

### Components / tokens

| Need | Reuse | Notes |
| ---- | ----- | ----- |
| Clickable history row | existing `.gp-version` | promote to `<button>`/`role="button"` + `tabindex`, hover/focus ring from shell tokens; keep the timeline rail/node visual |
| Version picker (DiffView) | existing `.seg` / shell menu material in `3-shell-maude.css` | label "Saved version ▾"; list = per-file log (message + timeAgo + dimmed short-sha) |
| Icons | existing `Icon` set (`history`) | no new glyphs |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: UPDATE `gitLog` — optional per-file filter

- **Do**: Add an optional `filepath?: string` arg to `gitLog(dir, limit, filepath?)`. In `logIso`, pass `filepath` to `git.log({ fs, dir, depth, filepath })` (iso-git follows a single file's history). In `logSystem`, append `'--', filepath` to the argv when set (positional — no option injection). No filter → identical to today (byte-compatible repo-wide log).
- **Pattern**: existing `logIso`/`logSystem` at `service.ts:597-635`.
- **Gotcha**: iso-git `filepath` is repo-relative with forward slashes; `activePath` already is (`.design/ui/Foo.tsx`). Don't prefix designPrefix twice.
- **Validate**: `cd apps/studio && bun test git` — existing log tests stay green; add a unit asserting `gitLog(dir, 40, '<file>')` returns only commits touching that file.

### Task 2: UPDATE the `log` endpoint + route — accept `?path=`

- **Do**: Change `log(limitRaw)` → `log(limitRaw, pathRaw)` in `endpoints.ts`. When `pathRaw` is set, validate with `isContainedRepoPath(dir, pathRaw)`; on failure return `400` (reuse the commit/discard guard). Pass the validated path to `gitLog`. In `http.ts:808`, read `url.searchParams.get('path')` and forward it. Keep main-origin-only.
- **Pattern**: path guard at `endpoints.ts:98`/`:121`; route handler shape at `http.ts:808`.
- **Gotcha**: an absent/empty `path` must behave exactly as today (repo-wide). Don't let a malformed path silently fall back to repo-wide — reject with 400 so a bug can't leak a broader log than intended.
- **Validate**: `bun test` — add endpoint-matrix cases: `log?path=<valid>` → 200 + filtered entries; `log?path=../../etc/passwd` → 400; `canvas-origin-gate.test.ts` still asserts `/_api/git/log` 403s from the canvas origin (unchanged — confirm it still passes).

### Task 3: UPDATE `gitLoadLog` (app.jsx) — path-aware loader

- **Do**: Make `gitLoadLog` accept an optional `path`: `fetch('/_api/git/log?limit=40' + (path ? '&path=' + encodeURIComponent(path) : ''))`. Return `data.entries || []` as today.
- **Pattern**: existing `gitLoadLog` at `app.jsx:5843`.
- **Validate**: `bun build` clean; manual — `gitLoadLog('.design/ui/GitPanel.tsx')` returns only that file's versions.

### Task 4: UPDATE GitPanel — clickable per-file History + open-canvas scope

- **Do**:
  - Thread a new `activePath` prop + an `onPreviewVersion(sha)` prop into `GitPanel`.
  - In `openHistory`, when `activePath` is a real canvas (not null, not SYSTEM), call `loadLog(activePath)`; else `loadLog()` (repo-wide). Re-load when `activePath` changes while the History tab is open.
  - When scoped to a file, render each `.gp-version` as an activatable control (`<button>` or `role="button"` + `tabIndex={0}` + `onClick`/`onKeyDown` Enter/Space) calling `onPreviewVersion(c.sha)`; add hover/focus styling + a subtle "Preview" affordance. Header copy: "History · <canvas name>".
  - When repo-wide (no canvas open), keep rows non-interactive and show a one-line hint: "Open a canvas to preview a saved version."
- **Pattern**: existing tab/row markup `GitPanel.jsx:552-581`; vocabulary already enforced in this file.
- **Gotcha**: keyboard a11y — rows must be focusable + Enter/Space-activatable (the phase-27 DiffView radiogroup arrow-nav warning is a known below-floor item; don't add a new one). Keep `role="list"`/`listitem` semantics coherent (a list of buttons).
- **Validate**: `bun test` (no client unit harness — rely on agent-browser in Task 6) + `tsc`/biome clean.

### Task 5: UPDATE DiffView — "Saved version" picker for the open file

- **Do**:
  - Add a `loadLog` prop (the path-aware loader) to `DiffView`. On open, load `loadLog(target.file)` → list of saved versions.
  - Make `beforeSha` **local state** seeded from `target.beforeSha` (default `'HEAD'`). Render a picker (reuse `.seg`/menu material) labeled "Saved version" listing the file's versions (message + timeAgo + dimmed short-sha, plus a "Last saved (HEAD)" / "Now" anchor). Selecting one sets the local `beforeSha`; `beforeSrc` re-derives automatically.
  - Keep the conflict mode (`target.conflict`) behavior unchanged — the picker is additive, shown in the compare/history mode.
- **Pattern**: `DiffView.jsx:236-240` (beforeSha→beforeSrc) — only the source of `beforeSha` changes (state vs prop).
- **Gotcha**: confirm `renderable` is NOT gated on the file being dirty — a clean open canvas must still render before/after (history preview of a clean file is the primary flow). If it is gated, relax it for the history/compare mode.
- **Validate**: agent-browser (Task 6).

### Task 6: WIRE app.jsx + verify live + rebuild bundle

- **Do**:
  - Pass `activePath={activePath}` and `onPreviewVersion={(sha) => setDiffTarget({ file: activePath, beforeSha: sha, conflict: false })}` to `<GitPanel>` (app.jsx:6817).
  - Pass `loadLog={gitLoadLog}` to `<DiffView>` (app.jsx:6900).
  - Confirm `setDiffTarget` shape stays `{ file, beforeSha, conflict }`.
  - **Live-verify via agent-browser** in a scratch git repo with ≥3 saved versions of one canvas: open canvas → Changes → History shows that canvas's versions → click an older one → DiffView opens with before=that version, after=now, synced zoom works → in DiffView open the picker → choose a different version → before pane re-renders. Also verify: no canvas open → History is repo-wide + hint, rows not clickable.
  - Rebuild release bundle: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.
- **Gotcha**: native-app verification ceiling — interactive desktop dogfood is the user's; agent-browser against the dev-server is the automated proof. Don't boot the source dev-server without rebuilding `--release` afterward (unminified self-heal would bloat the committed bundle).
- **Validate**: agent-browser screenshots attached; `git diff --stat` shows the rebuilt bundle.

### Task 7: Security re-check + STATE/DDR bookkeeping

- **Do**:
  - Spawn `security-auditor` + `ethical-hacker` scoped to the diff (the only new surface is the `?path=` param). Confirm: containment rejects traversal, no argument injection (positional after `--` / iso `filepath` string), log stays main-origin-only, canvas-origin gate still 403s.
  - Update `.ai/state/STATE.md`: move "historical-sha render for History" off the open-follow-ups list (now done); note phase-27.1 close.
  - Decide on a DDR: if the per-file-log scoping + open-canvas-preview decision is non-obvious enough, add a short DDR (or a one-paragraph addendum to DDR-113). The byte-faithful historical render + conflict-resolution writes remain explicitly out of scope (still deferred).
- **Validate**: security reports show no finding ≥ `security.severityFloor`; STATE reflects reality.

---

## Out of Scope (explicit)

- **Byte-faithful historical render** (rendering against *historical* lib/siblings, not today's) — stays deferred per DDR-113 (accepted approximation; would need the rejected checkout-and-render worktree subsystem).
- **Conflict-resolution file writes** ("Keep both" = copy-with-suffix) — separate deferred follow-up, unrelated to history preview.
- **Restore/checkout a past version into the working tree** — this slice is **read/view-only** (the user's framing). No `git checkout`/restore wiring here.
- **Repo/branch (draft) switching** — that's phase-29 (E4), separate.

---

## Validation

1. **Format/lint**: `cd apps/studio && bunx biome check .` (or repo `format`+`lint` gates).
2. **Types**: `cd apps/studio && bunx tsc --noEmit` (touched files clean; DDR-026 baseline unchanged).
3. **Tests**: `cd apps/studio && bun test` — full dev-server suite green, incl. new `gitLog` filepath unit + log-endpoint path-filter matrix + canvas-origin-gate (`/_api/git/log` 403).
4. **Bundle**: `MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` produces and commits `dist/client.bundle.js` + `dist/styles.css`; `check-runtime-bundles.sh` + `runtime-health` green.
5. **Live UI (agent-browser)**: the Task 6 scenario — history click-to-preview (canvas open), picker re-point, repo-wide fallback (no canvas) — 0 blockers.
6. **Security**: `security-auditor` + `ethical-hacker` over the `?path=` diff — 0 findings ≥ floor.
7. **Manual (user dogfood)**: interactive desktop app — open canvas, browse History, click versions, use the DiffView picker (native WKWebView verification ceiling).

> No 5-platform `scenario-runner` / mobile parity — this is a desktop dev-tool surface with no native mobile/tablet variant (consistent with prior plugin/dev-server History rows marking the 5-platform scenario N/A). agent-browser substitutes.

---

## Acceptance Criteria

- [x] `/_api/git/log?path=<file>` returns only that file's saved versions; absent `path` = repo-wide (byte-compatible); traversal → 400; still 403 from canvas origin. _(+ contained-but-outside-design → 400; pathspec-magic → 400.)_
- [x] History tab, with a canvas/specimen open, lists that file's versions and each row is click/keyboard-activatable → opens DiffView at that version (before=version, after=now). _(live-verified: 3 button rows scoped to Studio.)_
- [x] DiffView shows a "Saved version" picker for the open file; selecting a version re-renders the before pane. _(live-verified: combobox + reactive before-label.)_
- [x] No canvas open → History is repo-wide, read-only, with the hint; no crash on SYSTEM tab.
- [x] Vocabulary contract upheld (no git jargon in visible copy; short-sha as meta OK).
- [x] Tests + tsc + biome green (1549/1549); release bundle rebuilt + ready to commit.
- [x] Security fan-out: 0 findings ≥ floor on the `?path=` surface (MEDIUM DoS empirically disproven; lows hardened).
- [x] STATE.md updated; DDR-113 addendum records the open-canvas-scope decision + `?path=` envelope; out-of-scope items still listed as deferred.
- [x] agent-browser scenario green; interactive dogfood (native Tauri window) handed to user per the native-app verification ceiling.

---

## Retro

- **The hard + risky part was already built (DDR-113); this was pure wiring.** Right-sizing the plan around "machinery exists, DiffView already takes `beforeSha`" kept it to one endpoint param + UI handlers. The earlier instinct ("don't do the byte-faithful render") correctly survived — the gap that mattered was the *interaction* wiring, not more render fidelity.
- **Empirically probing iso-git beat trusting the attacker's model.** The ethical-hacker escalated a MEDIUM "whole-DAG walk" DoS; a 4-line probe disproved it (`depth` bounds the walk: full 466-commit walk = 47 ms; nonexistent path errors in 1 ms). Lesson for `/execute`: when a security finding hinges on a library's internal semantics, measure before fixing — and still apply the cheap defence-in-depth (designPrefix scope + `GIT_LITERAL_PATHSPECS`).
- **Live agent-browser against this repo's own `.design/` (real git history) was the ideal test bed** — no scratch-repo seeding; `Studio.tsx` (3 versions) + `Studio Intro Video.tsx` (8) gave instant per-file-history coverage. Verified the full chain (History rows → DiffView at `?sha=` → picker re-point) with real screenshots.
- **Dogfood caught what headless didn't: the DiffView sheet overflow.** The 92vh sheet + shared `.st-scrim` 12vh top-pad clipped the footer — only visible on a real constrained window. A `.dv-scrim` centering modifier fixed it. Lesson: native-window layout bugs need the actual window; agent-browser at a fixed viewport can miss vh-overflow.
- **Commingled tree was the real friction, not the code.** Phase-28 sat uncommitted and shared `http.ts` + the client bundle's import graph (`app.jsx` imports the phase-28 `IdentityBar`). Atomic commit needed a per-hunk `http.ts` patch + a stash-rebuild-restore so the committed bundle carried only the phase-27.1 client delta. Lesson for `/plan`: when a sibling phase is open in the tree, flag bundle/shared-file commingling up front so `/done` budgets for it.
