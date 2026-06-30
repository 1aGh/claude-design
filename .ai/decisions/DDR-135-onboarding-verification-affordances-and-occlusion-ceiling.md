# DDR-135: First-run onboarding — debug-only driving affordances, runtime-wiring hardening, and the occlusion verification ceiling

- **Date:** 2026-07-01
- **Status:** Accepted (shipped — onboarding driving affordances + first batch of runtime-wiring fixes; remaining hardening backlogged, see Consequences)
- **Tags:** desktop, tauri, wkwebview, onboarding, first-run, e2e, dogfood, debug-only, github-oauth, verification-ceiling, occlusion, runtime-wiring
- **Related:** [DDR-134](./DDR-134-desktop-e2e-webdriverio-tauri-service.md) (the harness this extends — it deferred first-run/OAuth/dialog stubs `#[cfg(debug_assertions)]`), [DDR-106](./DDR-106-native-shell-tauri-sidecar.md) (the shell + sidecar switch), [DDR-108](../README-github-oauth.md) (GitHub device-flow sign-in), [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (welcome-project boot self-heal). Harness: `apps/desktop/e2e/{scenarios/onboarding.e2e.ts,wdio.onboarding.conf.ts}`; skill: `.claude/skills/desktop-e2e/SKILL.md`; spec: `.ai/scenarios/native-onboarding-zero-terminal/spec.md`; bug ledger: `.ai/device/scenario-runs/native-onboarding-persona-smoke/2026-06-30-1535/live-dogfood-bugs.md`. Memory: `feedback_native_app_verification_ceiling`, `project_desktop_e2e_harness_wdio_gotchas`.

## Context

DDR-134 lifted the native-app verification ceiling for everything DOM-reachable, but it **deferred the first-run onboarding path** — exactly the highest-stakes cold-start surface (a user from maude.sh: GitHub sign-in → create/clone a repo → land in the studio → understand branch / Save version / Publish / Get latest / merge). The harness deliberately *suppressed* first-run (`MAUDE_PROJECT_ROOT ⇒ is_first_run=false`) so the wizard, the GitHub device flow, and the native folder picker were untested and only manually dogfoodable.

A 5-persona **static** audit (UX designer, graphic designer, novice, non-technical, developer) read the real code and surfaced genuine UX/copy issues — but missed every **runtime** "I clicked and nothing happened" bug. Those only appeared once the app was driven live: a single interactive dogfood + a 4-agent runtime-wiring trace found a device-modal Cancel that left sign-in stuck ≤15 min, an IdentityBar that showed "Sign in" with a valid token, a merge with no spinner, a fire-and-forget project switch that could freeze the wizard, and more.

## Decision

**1. Three debug-only env affordances make the wizard drivable + dogfoodable — all `#[cfg(debug_assertions)]`, never in the release `.app`:**
- `MAUDE_E2E_PICK_DIR` → `pick_directory` returns the path instead of opening the native folder dialog (Door B).
- `MAUDE_E2E_FAKE_GITHUB_LOGIN` → `github_sign_in` emits a deterministic device-code, "authorizes" after a beat, returns a fake login — no browser, no network, no keychain write (Door A UI transition).
- `MAUDE_FORCE_ONBOARDING` → `is_first_run` returns true **without moving app-state on disk**, and **dismisses once a project opens this run** (`app_state::PROJECT_OPENED_THIS_RUN`, set in `set_last_project`) so completing a door lands in the studio instead of re-rendering the wizard forever.

**2. Automated scenario** `onboarding.e2e.ts` + `wdio.onboarding.conf.ts` (drops `MAUDE_PROJECT_ROOT` + wipes the e2e app-state → first-run via the welcome project): wizard (3 doors) → Door A device-code → signed-in door → Door B folder → "Set up Maude here" → studio opens on the **seeded Welcome canvas**. Runs only under its config (self-skips elsewhere). Wizard `data-testid`s added per the DDR-134 convention.

**3. Interactive dogfood `pnpm dev:desktop:onboarding` uses the REAL bundle id** (`com.maude.app`, not the isolated `com.maude.app.e2e`) so the user's existing GitHub keychain token carries over — an isolated e2e keychain renders a wrong "signed in but shows Sign in." The **automated** harness keeps the isolated id (own app-state, no developer-Maude collision). Door A's CTA + subhead now reflect `signedIn` ("Continue" vs "Sign in with GitHub").

**4. Seed a neutral, token-free `Welcome` canvas in `scaffoldDesign`** (both create-project + init-design paths) so a brand-new project opens to a real artboard, not an empty studio.

**5. Runtime-wiring hardening principle:** a Rust/async side-effect failure (the `github_sign_in` poll, the `switch_project` navigate) and the identity fetch **must feed their failure back to the JS busy/rendered state** — otherwise a normal click yields a dead button, a frozen spinner, or a signed-out CTA. First batch applied: device-modal Cancel resets `signing` + guards a late resolve; IdentityBar gates signed-in on the keychain + subscribes to `github://signed-in` + retries a transient identity fetch; the merge/fold spinner is gated on `folding`; DiffView "Restore" surfaces a discard failure instead of closing silently.

## Consequences

- **The occlusion ceiling (new, load-bearing).** WKWebView throttles its JS/rendering (occlusion / App-Nap) whenever the window is **not frontmost**, so the embedded WebDriver can't answer `execute`/`getUrl`. Autonomous e2e therefore needs BOTH an **awake display** AND a **frontmost, non-occluded** window for the whole ~3.5 min run. In a headless / display-asleep session it wedges at `waitForSidecar` (confirmed: black `screencapture`, `pmset -g powerstate` errors, no window bounds, while `/_health` is `ok`). In an *interactive* session it wedges the moment focus shifts to the coordinating chat — proven across two real runs (run #1 wedged on a sleeping display; run #2 got past boot + found the wizard, then throttled when focus left). **Practical rule:** hand the run to an untouched, screen-awake session (the user's), or treat the live **dogfood** as the better signal. Extends DDR-134's ceiling + `feedback_native_app_verification_ceiling`.
- **Static persona audit ≠ runtime audit.** The 5 code-reading personas caught copy/UX (the "Publish — coming soon" stale string, the tour-vs-UI vocabulary drift, the two-languages switcher) but zero runtime dead-clicks. The runtime class came only from a live dogfood + a 4-agent click→handler→command/endpoint→effect trace. **Lesson:** pair static review with a live dogfood (or runtime-wiring trace) for any interactive flow before claiming it's seamless.
- **Backlog (deferred, each benefits from live confirmation), recorded in `live-dogfood-bugs.md`:** auto-open the seeded Welcome canvas on landing (today it sits unopened behind a dev-jargon "No canvas open"); a "Setting up…" overlay during the sidecar respawn + a `project-switch-failed` event/recovery + persisting `last_project` only after boot-confirm (the relaunch-brick); an `authRequired` "Sign in" CTA in GitPanel/switcher; the system-git get-latest conflict fallback (config-gated, iso default is safe); and "make the e2e robust to occlusion" so autonomous runs survive losing focus.
- **Security:** the three env affordances are all `#[cfg(debug_assertions)]` — never compiled into the release/signed `.app` (verified `cargo check`); the fake-login stub never writes a keychain token; the real-bundle dogfood script only *reads* the existing token (no new surface). No production attack surface added.
- **Verification status:** Rust `cargo check` clean; client bundle rebuilt + transpiles; seed canvas parses; the user's live dogfood confirmed open-folder / pull / open land in the studio and the sign-in state carries over. The automated green is pending an untouched screen-awake run.

## Alternatives considered

- **Wipe `app-state.json` on disk to force first-run** — rejected for interactive dogfood: it touches the user's *real* Maude state and is fiddly (move-aside/restore). `MAUDE_FORCE_ONBOARDING` is the disk-free equivalent.
- **Isolate the dogfood under `com.maude.app.e2e`** — rejected for interactive dogfood (separate keychain → login doesn't carry over → the exact "signed in but shows Sign in" confusion); kept for the *automated* harness, where isolation is the point.
- **Build full OAuth + clone stubs for an end-to-end automated happy path** — deferred: real network/keychain; the current stubs cover the UI transitions, the rest stays manual dogfood (per DDR-134's deferral).
- **Computer-use to drive the wizard** — rejected per the standing DOM-driven-only rule (`feedback_prefer_dom_driven_e2e_not_computer_use`).
