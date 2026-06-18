# Phase 29 — Native Maude: Onboarding wizard + repo/branch switcher

Validate docs and codebase patterns before implementing. Aspiration bar applies — this is the first-impression surface; `/design:new` with `--perfect` is mandatory before Task 2.

## Description

Build the first-run onboarding wizard and the persistent repo/branch switcher that becomes the top-level navigation primitive. After this phase, a non-technical user can install Maude, open it for the first time, sign in with GitHub, and start working — zero terminal, zero setup, and **no raw git** (no `commit`/`push`/`pull`/`merge`/`branch`/SHA jargon).

Instead of *hiding* version control entirely, this phase teaches a **simple, visible action-cycle** through a built-in onboarding tour + infographic — see [§ Teaching model](#teaching-model-decision). The only three verbs the user ever sees are **Save changes locally → Publish for everyone → Pull changes**, with the live-collaboration layer presented as something that just happens automatically. The bar: explain it so simply that a complete non-technical first-timer "gets the loop" in one pass.

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
6. **Onboarding tour + infographic** (the "rychlý kurz"): a built-in, re-openable walkthrough that teaches the action-cycle (Save locally → Publish → Pull) and the live-vs-async duality in plain language. Plugs into the **existing tour engine** (`client/tour/overlay.jsx` + `[data-tour]` anchors — the same one as `usage-tour.js`), so it's first-run-offered and re-entrant from Help. **Ships v1-minimal, then is progressively refined** (see Task 6) — copy is treated as never-final.

## Teaching model (decision)

> **This overrides the "zero git vocabulary / hide the duality" recommendation in [`.ai/docs/collab-model-design.md` § Part 2](../docs/collab-model-design.md) (and the E0 microcopy contract A5).** That research recommended hiding the live-vs-async duality entirely behind a "room + note on the table" metaphor. We deliberately take the opposite call: surface a **visible three-verb action-cycle** and *teach* the duality — because (a) the cycle has to match real buttons in the app (a hidden-magic metaphor can't sit next to a "Publish" button), and (b) pure hiding is *leaky*: live-sync and publish/pull coexist, and when they diverge the magic breaks more confusingly than an honestly-shown loop. **Record this reversal as a DDR at implementation time** (`/flow:record-ddr`) — it reverses a documented decision.

**Two layers, named plainly — never mixed into one diagram:**

| Layer | What's in it | How it behaves | User verb |
| --- | --- | --- | --- |
| **Live (together)** | cursors · who's here · comments · annotations | **Automatic, no buttons** — when you're both here, you see each other instantly | *(none — it just happens)* |
| **The work itself** | the canvas files / design content | **Visible cycle, has buttons** | **Save changes locally → Publish for everyone → Pull changes** |

**Canonical verb set (the only version-control words the UI uses):**

| Action | UI verb | Replaces (never shown) |
| --- | --- | --- |
| Snapshot your work on your machine | **Save changes locally** | `commit` |
| Send your work to everyone | **Publish for everyone** | `push` |
| Get everyone else's work | **Pull changes** | `pull` / `fetch` / "behind" |
| Separate line of work | **Draft** | `branch` |
| The team's canonical version | **Shared version** | `main` |

**The one hard thing to teach (and the honest framing for it):** when you're *live together*, publishing by one person already covers the other — the teammate already sees the work live, so Publish is "just dropping a bookmark," not a hand-off. Diverging work only happens when people are **apart**; then the app shows a **visual picker** ("keep mine / keep theirs / keep both"), never a text merge. The infographic must make this two-layer split obvious, or it reintroduces the exact confusion the research warned about.

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
- `.ai/docs/collab-model-design.md` § Part 2 (microcopy/vocabulary table + "3 věci co se user učí") — source of the verb set. **NB: this phase partially overrides it (teaches the cycle instead of hiding it) — see [§ Teaching model](#teaching-model-decision).**
- `apps/studio/client/tour/overlay.jsx` + `client/tour/usage-tour.js` — the **existing** tour engine (`[data-tour]` anchors, centered fallback for target-less steps, first-run offer + Help re-entry). The collab tour + infographic plug into THIS — do not fork it. Consumed by `app.jsx` + `whats-new.jsx`; contract test at `apps/studio/test/tour-overlay.test.tsx`.
- `cli/lib/design-link.mjs` (`runLink`, `runAdopt`, `runStatus`) — hub-connect logic to surface in the advanced wizard door.
- `plugins/design/dev-server/sync/hubs-config.ts` — existing hub token store (advanced door writes here).
- `plugins/design/dev-server/sync/status.ts` + `_sync.json` — `<SyncBanner>` / health probe the wizard uses.
- `apps/desktop/src-tauri/src/` — last-project persistence goes here (`AppData/maude/last-project.json`).

### Files to Create

- `apps/desktop/src-tauri/src/app_state.rs` — last-project persistence, first-run detection
- `apps/studio/client/panels/OnboardingWizard.jsx` — the wizard  *(path corrected — the client lives in `apps/studio/client/panels/`, not `plugins/design/dev-server/...`)*
- `apps/studio/client/panels/RepoBranchSwitcher.jsx` — persistent top-level nav
- `apps/studio/client/tour/collab-tour.js` — action-cycle education step data (sibling of `usage-tour.js`)
- `apps/studio/client/panels/CollabModelInfographic.jsx` — two-layer infographic; shown in the wizard success state AND embeddable as a centered tour step

### Design canvases

> **`/design:new --perfect` mandatory before Task 2.** This is the first impression; aspiration bar ≥ 4.5/5.

| Canvas (to create) | Screens needed |
| --- | --- |
| `Onboarding.tsx` | Welcome screen (3 doors: GitHub / Local folder / Hub token), GitHub door (sign-in → repo picker / create), Local folder door (drag-drop zone), Hub advanced door (token field + URL + adopt), Loading / success state |
| `RepoBranchSwitcher.tsx` | Sidebar header with repo name + branch/draft name, repo picker dropdown (list of recent repos + "Open another…"), branch/draft picker dropdown ("New draft", list of drafts), loading state during switch |
| `OnboardingTour.tsx` | The infographic itself (two-layer model: the live layer floating above the **Save → Publish → Pull** cycle) + the per-step coach-mark cards as they appear over `[data-tour]` anchors (the three action buttons + presence dots). Mock the infographic to portfolio quality — it carries the whole mental model. |

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

### Task 6: Onboarding tour + infographic — the version-control "rychlý kurz" (iterative)

> Built on the **existing** tour engine (`client/tour/overlay.jsx`), never a new one. **Ships v1-minimal this phase, then is progressively refined** — this is a living first-impression surface; treat copy as never-final and expect later passes.

- **Do (v1 — this phase):**
  - Add stable `[data-tour]` anchors to the three action-cycle controls (**Save changes locally** / **Publish for everyone** / **Pull changes**) and the presence indicators, so the engine can spotlight them. Anchors on `[data-tour]`, never on styling classes (redesign-proof, per `usage-tour.js`).
  - `apps/studio/client/tour/collab-tour.js` — a step sequence walking the two-layer model: (1) infographic intro (centered, target-less step — the engine already centers these), (2) "Save changes locally", (3) "Publish for everyone", (4) "Pull changes", (5) the live layer ("when you're here together it's all automatic — no buttons"), (6) the one hard thing ("publishing covers your teammate when you're live; apart → the app shows both versions, you pick — never a merge").
  - `CollabModelInfographic.jsx` — the centered step's graphic (live layer floating over the Save→Publish→Pull loop). Extend the overlay step shape with an optional `graphic`/`render` field; update `test/tour-overlay.test.tsx` for it.
  - Offer the collab tour once after first onboarding completes; re-openable from Help (mirror the `usage-tour.js` wiring in `app.jsx`).
- **Do (progressive refinement — tracked, not all this phase):**
  - Contextual coach-marks: the first time the user actually hits Publish / Pull, show the single relevant card inline.
  - Tighten copy against real non-technical users; iterate the infographic framing.
  - Czech localization if `ux.bilingual`.
- **Validate (v1):** First run → onboarding completes → collab tour offered → all steps render (infographic centered, action steps spotlight the real buttons); Help → "Take the tour" replays it; `tour-overlay.test.tsx` green. Critic panel on `OnboardingTour.tsx` ≥ 4.5/5 (aspiration bar — it's the first impression).
- **Gotcha:** Don't fork the engine — reuse `overlay.jsx`. Target-less steps already render centered, so the infographic step needs no special casing beyond the `graphic` field. The verb set is the [§ Teaching model](#teaching-model-decision) table — no raw git terms leak into copy.

---

## Validation

1. **Scenario:** Zero-terminal acceptance (Task 5) — 0 blockers.
2. **Design:** All three canvases (Onboarding, RepoBranchSwitcher, OnboardingTour) critic score ≥ 4.5/5 (Task 1 + Task 6).
3. **Zero regression:** Existing `maude design serve` (browser-only mode) still works; hub linking CLI still works; existing `usage-tour.js` still runs unaffected.
4. **First-run:** Fresh install always shows wizard; re-launch skips it.
5. **Onboarding tour:** Collab tour offered after first onboarding, replayable from Help, all steps render incl. the centered infographic; `tour-overlay.test.tsx` green (Task 6).

## Acceptance Criteria

- [ ] Mockups approved, critic ≥ 4.5/5 — Onboarding, RepoBranchSwitcher, **and OnboardingTour** (Task 1 + Task 6)
- [ ] First-run detection + last-project persistence in Rust (Task 2)
- [ ] All 3 wizard doors navigate to canvas browser (Task 3)
- [ ] RepoBranchSwitcher shows repo + draft, switching works (Task 4)
- [ ] Zero-terminal scenario passes with screen recording (Task 5)
- [ ] Onboarding tour v1 ships on the existing engine; offered first-run, replayable from Help; `tour-overlay.test.tsx` green (Task 6)
- [ ] Vocabulary contract upheld: **no raw git terms** (`branch`/`merge`/`fetch`/`checkout`/SHA/`commit`/`push`); the user-facing cycle uses **Save changes locally / Publish for everyone / Pull changes**; "Draft" not branch, "Shared version" not main; the live layer is presented as automatic
- [ ] Teaching-model reversal recorded as a DDR (`/flow:record-ddr`)
