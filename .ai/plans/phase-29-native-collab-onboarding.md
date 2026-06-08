# Phase 29 — Native Maude: Onboarding wizard + repo/branch switcher

Validate docs and codebase patterns before implementing. Aspiration bar applies — this is the first-impression surface; `/design:new` with `--perfect` is mandatory before Task 2.

## Description

Build the first-run onboarding wizard and the persistent repo/branch switcher that becomes the top-level navigation primitive. After this phase, a non-technical user can install Maude, open it for the first time, sign in with GitHub, and start working — zero terminal, zero setup, zero git vocabulary.

**Phase milestone:** Zero-terminal acceptance test: install → first-run wizard → sign in with GitHub → open or create a project → canvas browser shows up. No terminal touched at any step.

## User Story

As a non-technical collaborator opening Maude for the first time, I want to be guided into a working project in under 2 minutes, so that I can start collaborating without any setup friction.

## Problem

Today Maude requires `maude design serve` from a terminal, then a browser. There is no first-run experience, no project switcher, no way to start without developer help.

## Solution

1. On first launch (no last-used project in `AppData`): show the onboarding wizard instead of the canvas browser.
2. Wizard primary door: "Sign in with GitHub" → open existing shared repo OR create new one (reuses phase-28).
3. Wizard secondary door: "Open a local folder" (drag/drop or file picker).
4. Wizard advanced door: "Connect to a hub" (paste token, surfaces `runLink` from `design-link.mjs`).
5. After onboarding: persistent **repo/branch switcher** header in the sidebar — "you are in **repo X** on **branch Y**" — one-click switch for both. This is the permanent top-level nav.

## Metadata

- **Type:** New Capability
- **Complexity:** Medium
- **App/Package:** `apps/desktop/src-tauri/` (first-run state, last-project persistence) + client UI
- **Depends on:** phase-26 (Tauri shell), phase-27 (git — branch switching), phase-28 (GitHub sign-in)

---

## Context References

### Must-Read Files

> Read in parallel.

- `.ai/docs/epic-native-collab-app.md` § E4 — full scope, IA model, "switchování mezi repos a branches".
- `.ai/docs/collab-model-design.md` § Metaphor stack — "Draft" not "branch"; "the shared version" not "main".
- `cli/lib/design-link.mjs` (`runLink`, `runAdopt`, `runStatus`) — hub-connect logic to surface in the advanced wizard door.
- `plugins/design/dev-server/sync/hubs-config.ts` — existing hub token store (advanced door writes here).
- `plugins/design/dev-server/sync/status.ts` + `_sync.json` — `<SyncBanner>` / health probe the wizard uses.
- `apps/desktop/src-tauri/src/` — last-project persistence goes here (`AppData/maude/last-project.json`).

### Files to Create

- `apps/desktop/src-tauri/src/app_state.rs` — last-project persistence, first-run detection
- `plugins/design/dev-server/client/panels/OnboardingWizard.jsx` — the wizard
- `plugins/design/dev-server/client/panels/RepoBranchSwitcher.jsx` — persistent top-level nav

### Design canvases

> **`/design:new --perfect` mandatory before Task 2.** This is the first impression; aspiration bar ≥ 4.5/5.

| Canvas (to create) | Screens needed |
| --- | --- |
| `Onboarding.tsx` | Welcome screen (3 doors: GitHub / Local folder / Hub token), GitHub door (sign-in → repo picker / create), Local folder door (drag-drop zone), Hub advanced door (token field + URL + adopt), Loading / success state |
| `RepoBranchSwitcher.tsx` | Sidebar header with repo name + branch/draft name, repo picker dropdown (list of recent repos + "Open another…"), branch/draft picker dropdown ("New draft", list of drafts), loading state during switch |

**Reference (lift, don't re-derive) — CHROME/LAYOUT ONLY:** `.design/ui/Studio Hub.tsx` → artboard **B** (first-run onboarding wizard: left **step-rail** + fingerprint-verify card + "next step" peek, maude DS) is a built maude-DS reference for `Onboarding.tsx`'s wizard chrome + step-rail. **⚠ Door order must stay GitHub-first.** Studio Hub makes the bootstrap-key claim the headline; phase-29 **demotes** that to the advanced door (c) — GitHub is the headline door. Lift the wizard skeleton + step-rail motion; do NOT inherit Studio Hub's door ordering or copy. Not a drop-in (this surface still requires `/design:new --perfect` ≥ 4.5/5 from scratch).

### Documentation

- [Tauri v2 — `app.path.appDataDir`](https://v2.tauri.app/reference/javascript/api/namespaceapp/) — where `last-project.json` lives. Why: first-run detection.
- [Tauri v2 — file dialog](https://v2.tauri.app/plugin/dialog/) — `open({ directory: true })` for "Open local folder". Why: Task 3.

---

## Tasks

### Task 1: `/design:new --perfect` — Onboarding + switcher mockups

- **Do:** Run `/design:new --perfect` for `Onboarding` + `RepoBranchSwitcher`. Iterate until critic panel scores ≥ 4.5/5. This surface is load-bearing for the non-technical first impression.
- **Validate:** Both canvases `status: ready-for-handoff`, critic score ≥ 4.5/5.

### Task 2: First-run detection + last-project persistence (Rust)

- **Do:** `apps/desktop/src-tauri/src/app_state.rs`:
  - `is_first_run() -> bool` — checks if `AppData/maude/last-project.json` exists.
  - `get_last_project() -> Option<PathBuf>`
  - `set_last_project(path: PathBuf)`
  - On app start: if `is_first_run()` → tell the webview to show `OnboardingWizard`; else open last project directly (fast path).
  - Expose as Tauri commands: `app_is_first_run`, `app_get_last_project`, `app_set_last_project`.
- **Validate:** Fresh install → wizard shows. Re-launch after onboarding → canvas browser opens directly.

### Task 3: `OnboardingWizard` client component

- **Do:** Per approved mockup. Three doors:

  **Door A — GitHub (primary, pre-selected):**
  - "Sign in with GitHub" button → triggers `github_sign_in` Tauri command (phase-28).
  - On sign-in: show repo picker (`GET /_api/github/repos`) + "Create new project" card.
  - Select existing → `gitClone` → `app_set_last_project` → open canvas browser.
  - Create new → `POST /_api/github/create-repo` → `app_set_last_project` → open canvas browser.

  **Door B — Local folder:**
  - Drag-drop zone OR "Choose folder" → Tauri file dialog (`open({ directory: true })`).
  - Validate: folder has `.design/` dir (check via `/_api/git/status`). If not → offer to init.
  - `app_set_last_project` → open canvas browser.

  **Door C — Hub token (advanced, collapsed by default):**
  - URL field + token field → calls `runLink` logic via `POST /_api/hub/link` (new thin endpoint wrapping `design-link.mjs`). Show `_sync.json` status after link.
  - `app_set_last_project` → open canvas browser.

- **Gotcha:** Door A requires phase-28's OAuth to be complete. If the sign-in Tauri command isn't available (browser-only mode, no Tauri shell), Door A falls back to "Paste a GitHub token" (PAT flow). Add a `window.__TAURI__` guard.
- **Validate:** All three doors navigate to the canvas browser. Wizard never shows on re-launch.

### Task 4: `RepoBranchSwitcher` — persistent top-level nav

- **Do:** Per approved mockup. Mounts in the sidebar header, always visible.
  - **Repo switcher:** Shows current repo name (from `_server.json` → `project_root` → `git remote get-url origin`). Dropdown: recent repos list (stored in `AppData/maude/recent-projects.json`, max 10) + "Open another…" (Tauri file dialog). Switching: `app_set_last_project(new_path)` → reload webview.
  - **Branch/draft switcher:** Shows current branch from `GET /_api/git/status` (add `currentBranch` field). Dropdown: list of local branches from `GET /_api/git/log?branches=true`. "New draft" → `POST /_api/git/branch` (creates a new branch, switches to it). Switching: `POST /_api/git/checkout` → reload canvas tree.
  - Vocabulary: "branch" → "draft" in UI. "main" → "shared version".
- **Gotcha:** Branch switching must flush the Yjs doc before switching (reuse the existing `collab/git-lifecycle.ts` flush-before-reload pattern — already watches `.git/HEAD`). Don't duplicate that logic.
- **Validate:** Switch repo → canvas browser reloads with new project's canvases. Switch draft → canvas tree updates; `GET /_api/git/status` returns new branch name.

### Task 5: Zero-terminal acceptance scenario

- **Do:** Write + run the scenario: fresh macOS install → launch `Maude.app` → wizard appears → Door A → sign in with GitHub → pick a shared repo → clone → canvas browser shows. No terminal opened at any step.
- **Validate:** Scenario passes; screen recording attached to PR.

---

## Validation

1. **Scenario:** Zero-terminal acceptance (Task 5) — 0 blockers.
2. **Design:** Both canvases critic score ≥ 4.5/5 (Task 1).
3. **Zero regression:** Existing `maude design serve` (browser-only mode) still works; hub linking CLI still works.
4. **First-run:** Fresh install always shows wizard; re-launch skips it.

## Acceptance Criteria

- [ ] Mockups approved, critic ≥ 4.5/5 (Task 1)
- [ ] First-run detection + last-project persistence in Rust (Task 2)
- [ ] All 3 wizard doors navigate to canvas browser (Task 3)
- [ ] RepoBranchSwitcher shows repo + draft, switching works (Task 4)
- [ ] Zero-terminal scenario passes with screen recording (Task 5)
- [ ] Vocabulary contract upheld throughout (no "branch", "commit", "push" in UI copy)
