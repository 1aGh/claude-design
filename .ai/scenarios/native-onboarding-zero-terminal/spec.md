# native-onboarding-zero-terminal

Phase-29 (E4) milestone acceptance scenario — a non-technical collaborator installs Maude, opens it for the first time, and lands in a working project **without ever touching a terminal**.

**Persona:** non-technical first-timer (no git, no command line, no developer help).
**Plan:** `.ai/plans/phase-29-native-collab-onboarding.md` — Task 5 ("Zero-terminal acceptance scenario").
**Hypothesis:** Fresh `Maude.app` → first-run wizard (not the canvas browser) → Door A "Continue with GitHub" → device-flow sign-in → pick a shared project → it clones + opens → canvas browser shows. Zero terminal at any step.

## Platform matrix

| Platform | Required | Rationale |
| --- | --- | --- |
| **native macOS `.app`** (Tauri/WKWebView) | ✓ | The wizard only shows in the native shell (first-run is a Tauri concept; `window.__TAURI__` gates Door A's sign-in). This is the ONLY platform that exercises the full flow. |
| web-desktop (`maude design serve`) | partial | Browser-only mode renders the switcher + collab tour, but NOT the first-run wizard (no Tauri → no first-run) and Door A degrades. Used here for the component-level live checks below. |
| web-mobile / ios / android | N/A | No mobile native shell for the desktop app. |

> **Native-app verification ceiling (project memory `feedback_native_app_verification_ceiling`):** the agent cannot see or drive the WKWebView window. The full happy path below is a **manual interactive dogfood** for the user; the agent verified every component that is reachable without driving the window (endpoints, compile, Rust `cargo check`, and the browser-renderable surfaces via agent-browser). A screen recording of the manual run attaches to the PR.

## Happy path (manual, in the bundled `Maude.app`)

| # | Step | Expected | Verb (no terminal) |
| --- | --- | --- | --- |
| 1 | Install + launch a fresh `Maude.app` (no `app-state.json` / `last-project.txt` yet). | The shell boots the minimal **welcome project**; the client queries `app_is_first_run` → true → the **OnboardingWizard** renders over the (empty) canvas browser. | double-click the app |
| 2 | Welcome screen. | Three doors, **GitHub first** (accent ring + "Sign in with GitHub"); "Open a folder" secondary; "Connect to a team hub" advanced/dashed. No terminal copy anywhere. | — |
| 3 | Click **Continue with GitHub**. | GitHub device-flow modal: short code (e.g. `WDJB-MJHT`) + Copy + "open it again"; browser opens `github.com/login/device`. | click |
| 4 | Authorize in the browser. | Token lands in the OS keychain (never on disk); the wizard advances to the GitHub door: "Start a new project" card + a "Shared with you" repo list. | type the code |
| 5 | Pick a shared project. | Native folder picker → choose where to save it → it clones (`/_api/github/clone` → `gitClone`) and, if it has a `.design/`, switches the sidecar (`open_local_project`) → the webview reloads onto the real project. (No `.design/` → "Set up Maude here".) | click + pick a folder |
| 6 | Canvas browser shows the cloned project's canvases. | `app_is_first_run` is now false (the door called `set_last_project`); the wizard does not show. The **RepoBranchSwitcher** appears at the top of the sidebar ("maude · Shared version"). | — |
| 7 | The collab "rychlý kurz" is offered. | A nudge: "New to working with a team? See how saving & sharing works." → the collab tour (infographic + coach-marks). Re-openable from **Help ▸ How sharing works**. | click Start |
| 8 | Re-launch the app. | `app_is_first_run` is false → it opens the last project **directly** (fast path), wizard skipped. | double-click the app |

**Acceptance:** all 8 steps complete with **0 blockers** and **no terminal opened at any step**.

## What the agent verified (within the ceiling)

- **First-run Rust state** (`apps/desktop/src-tauri/src/app_state.rs`): `cargo check` ✓. `is_first_run` / `last_project` / `set_last_project` (+ MRU `recent_projects`, capped 10) + the welcome-project boot; legacy `last-project.txt` migration; the 4 Tauri commands declared in `build.rs` + granted in `capabilities/default.json` (the phase-28 remote-origin ACL learning).
- **Door A endpoints** (`/_api/github/*`): existing phase-28 coverage (`github-api.test.ts`), main-origin + loopback gated (`canvas-origin-gate.test.ts` → 403 from canvas).
- **Door C** (`/_api/hub/link` → `sync/hub-link.ts`): `hub-link.test.ts` (6 pass — validation, non-http reject, 0600 + trust write, per-machine replace); gate test asserts 403 from canvas.
- **Wizard + switcher + collab tour render live** (browser mode, agent-browser, on the booted dev-server): the RepoBranchSwitcher renders ("maude · native-app · JUST YOU"); the collab tour's two-layer infographic renders, and step 2 auto-opens the Changes panel and spotlights the Save control. `OnboardingWizard.jsx` compiles into the release bundle.
- **The three design mockups** (`Onboarding` / `RepoBranchSwitcher` / `OnboardingTour`) critic-gated ≥ 4.5/5.

## What needs the manual dogfood (handed to the user)

- The full steps 1–8 in the **bundled `.app`** (not `tauri dev`): fresh-install → wizard → device-flow sign-in → clone → switch → re-launch fast-path. Requires the `1aGh` GitHub OAuth App `client_id` wired (per `apps/desktop/README-github-oauth.md`).
- Door B (local folder) and Door C (hub) interactive paths in the `.app`.
- Screen recording → attach to the PR.

## How to run (manual)

1. Build the release `.app`: `cd apps/desktop && pnpm tauri build` (or the CI `build-desktop.yml` artifact).
2. Move any existing `~/Library/Application Support/<maude bundle id>/app-state.json` + `last-project.txt` aside to simulate a fresh install.
3. Launch `Maude.app`, follow steps 1–8, screen-record.
