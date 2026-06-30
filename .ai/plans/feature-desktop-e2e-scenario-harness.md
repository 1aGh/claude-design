# Feature: Desktop E2E scenario harness (Tauri + WebdriverIO, repo-internal skill)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

A repeatable, DOM-driven end-to-end test harness that drives the **real bundled Maude desktop `.app`** (Tauri v2 + WKWebView, Bun sidecar) the way `agent-browser` drives the web — find elements by `data-testid`, click/type, screenshot, assert — so we can run scenario-based regression checks for new features or on demand. Lives **only in this repo**: a repo-internal skill (`.claude/skills/desktop-e2e/`) owns the author/run/interpret knowledge; the harness code lives under `apps/desktop/e2e/`; scenario specs reuse the existing `.ai/scenarios/` convention with a new `native-desktop` platform.

Grounded in deep research (2026-06-29, memory `project_tauri_desktop_e2e_testing_path`): **`@wdio/tauri-service` embedded provider** is Tauri's officially-recommended E2E path and the only robust way to drive WKWebView on macOS (Apple ships no WKWebView WebDriver; the service runs an embedded W3C WebDriver server inside the app). Explicitly **not** computer-use/pixel-vision (user feedback `feedback_prefer_dom_driven_e2e_not_computer_use` — too flaky).

## User Story

As a Maude maintainer I want to run a desktop E2E scenario against the real `.app` so that I can regression-test native-shell behaviors (sidecar boot, webview navigation, canvas render, project switch, first-run) that browser-mode `agent-browser` cannot exercise — without manual dogfooding every time.

## Problem

The native shell is the project's documented **verification ceiling**: `agent-browser` only reaches the web layer served at `http://localhost:<port>`, never the native WKWebView shell. Native-only behavior — first-run wizard (gated by `window.__TAURI__`), Tauri menus, in-process project switch (`switch_project`), sidecar PATH resolution (DDR-128), keychain/OAuth — is verified by manual dogfood + screen recording (see `.ai/scenarios/native-onboarding-zero-terminal/spec.md`). That doesn't scale and isn't a regression gate.

## Solution

Adopt `@wdio/tauri-service` (embedded provider) to drive the bundled `.app`'s WKWebView DOM. Wire the embedded WebDriver server + deterministic native-dialog/OAuth stubs behind an **`e2e` Cargo feature** so the shipped notarized release stays clean. Add `data-testid` attributes to the studio client surfaces scenarios touch + a testid convention. Capture per-step screenshots into the `.ai/scenarios/` evidence layout. Ship one integration-smoke pilot + a skill documenting how to add more.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/desktop` (Rust feature + e2e harness), `apps/studio` (client testids), `.claude/` (skill + command), `.ai/scenarios/` (spec)
- **Affected Systems**: Tauri build, dev-server sidecar lifecycle, studio client DOM, repo skills/commands, (optional) CI
- **Dependencies**: `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/tauri-service`, `expect-webdriverio`, `tsx`/`tsconfig`; Rust: `tauri-plugin-wdio-webdriver` (feature-gated). All **new**, scoped to `apps/desktop/e2e/` + the `e2e` Cargo feature.

---

## Decisions locked (from clarification)

1. **DOM-driven, no computer-use.** WebdriverIO API (`$('[data-testid=x]').click()`), screenshots first-class (`browser.saveScreenshot`).
2. **`@wdio/tauri-service` embedded provider** (not tauri-playwright) — official, robust, cross-platform (macOS + Windows WebView2).
3. **`#[cfg(debug_assertions)]`-gated WebDriver plugin** (REVISED after Task 1 — official `@wdio/tauri-service` docs gate the in-app plugin to debug builds, so the shipped release stays clean **by construction**; no custom `e2e` Cargo feature needed). Native-dialog/OAuth **stubs are DEFERRED** — the pilot opens the fixture via `MAUDE_PROJECT_ROOT` (already in `resolve_project_root`), bypassing the first-run/project-picker entirely, so it needs no native chrome. Stub infra lands with the first scenario that needs it (first-run / project-switch).
4. **Native menu actions** invoked via `window.__TAURI__` command calls inside `browser.execute()`, not by clicking native chrome.
5. **`data-testid`** attributes added to `apps/studio/client` on elements scenarios need + convention in the skill.
6. **Scope**: full infra + **1 integration-smoke pilot**; skill documents how to add more.

> **DDR-worthy** (record during `/flow:done`): the desktop-E2E testing approach (WebdriverIO embedded provider + `e2e` feature, lifting the native-app verification ceiling) and the `data-testid` convention. Supersedes the manual-dogfood framing of the ceiling for DOM-reachable surfaces.

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `apps/desktop/src-tauri/src/sidecar.rs` — sidecar spawn/supervise; `MAUDE_PROJECT_ROOT`, `NO_OPEN`, `MAUDE_CANVAS_ORIGIN_SPLIT` env knobs; `switch_project` (project-switch scenario later). Why: the e2e build must pass a fixture project root + know boot env.
- `apps/desktop/src-tauri/src/server_json.rs` — `_server.json` poll contract (`url`/`port`, `localhost` verbatim, 120 s cold-start). Why: the wait-for-sidecar helper mirrors this.
- `apps/desktop/src-tauri/src/lib.rs` — Tauri builder + plugin registration site (`mod` list, `.plugin(...)` chain). Why: register the wdio plugin behind `#[cfg(feature = "e2e")]`.
- `apps/desktop/src-tauri/Cargo.toml` — `[dependencies]`, `tauri features = []`. Why: add `[features] e2e = [...]` + optional dep.
- `apps/desktop/src-tauri/tauri.conf.json` — CSP (`connect-src http://localhost:* ws://localhost:*`), `frontendDist`, `beforeBuildCommand`. Why: the embedded WebDriver server port may need a CSP/capability allowance; build hooks run for the e2e build too.
- `apps/desktop/src-tauri/capabilities/default.json` — capability ACL. Why: any new e2e command must be granted here (only under the feature).
- `apps/desktop/src/main.js` + `apps/studio/client/app.jsx` — the actual UI mounted in the webview; where `data-testid` lands. Why: pilot asserts canvas list/card/frame.
- `.ai/scenarios/README.md` + `.ai/scenarios/live-multiplayer-hub-sync/README.md` + `.../native-onboarding-zero-terminal/spec.md` — scenario folder + spec + evidence conventions to mirror.
- `.claude/skills/whats-new-entry/SKILL.md` — the repo-internal-skill convention (frontmatter, "lives in .claude/skills not shipped via marketplace", delegated-from-flow framing) to mirror for `desktop-e2e`.
- `apps/studio/bin/server-up.sh` + `apps/studio/bin/screenshot.sh` — helper-script idioms (PID/health probe, screenshot capture) to mirror in the e2e helpers; the screenshot evidence sink.
- `apps/desktop/package.json` + root `package.json` scripts (`dev:desktop`, `build:desktop`, `test`) — where the e2e npm scripts hook in.

### Files to Create

- `apps/desktop/e2e/package.json` — e2e workspace member; wdio + framework devDeps; `e2e` / `e2e:build` scripts.
- `apps/desktop/e2e/wdio.conf.ts` — WebdriverIO config: `@wdio/tauri-service` embedded provider, `tauri:application` pointing at the built test `.app`, mocha, screenshots-on-step, reporter.
- `apps/desktop/e2e/tsconfig.json` — TS config for the specs.
- `apps/desktop/e2e/helpers/sidecar.ts` — wait for the sidecar `_server.json` / `/_health`; expose resolved port/url to specs.
- `apps/desktop/e2e/helpers/canvas-frame.ts` — switch into the (DDR-054/063 cross-origin) canvas iframe; `MAUDE_CANVAS_ORIGIN_SPLIT=0` fallback if frame-switch is blocked.
- `apps/desktop/e2e/helpers/evidence.ts` — per-step screenshot + report row → `.ai/device/scenario-runs/<slug>/<YYYY-MM-DD-HHMM>/` (SAME gitignored run-output tree as `/flow:scenario`; `report.md` at run root, screenshots under `native-desktop/`).
- `apps/desktop/e2e/helpers/native.ts` — invoke Tauri commands via `browser.execute(() => window.__TAURI__...)` (menu actions, project switch) without native chrome.
- `apps/desktop/e2e/scenarios/app-boots-and-renders-canvas.e2e.ts` — the pilot.
- `apps/desktop/e2e/fixtures/project/` — a minimal fixture `.design/` project the test `.app` opens (`MAUDE_PROJECT_ROOT`), with 1 deterministic canvas.
- `apps/desktop/src-tauri/src/e2e.rs` — feature-gated module: register wdio plugin + native-dialog/OAuth stubs (returns fixture paths/tokens). `#[cfg(feature = "e2e")]`.
- `.claude/skills/desktop-e2e/SKILL.md` — the repo-internal skill (author/run/interpret + testid convention + gotchas + "how to add a scenario").
- `.claude/commands/desktop-e2e.md` — local slash command `/desktop-e2e <scenario>` that loads the skill and runs the harness.
- `.ai/scenarios/app-boots-and-renders-canvas/spec.md` — pilot scenario spec (mirrors existing convention; platform matrix lists `native-desktop`).

### Patterns to Follow

- **Repo-internal skill** — mirror `.claude/skills/whats-new-entry/SKILL.md`: frontmatter `name:`/`description:`, an explicit "Maude-specific; lives in `.claude/skills/`, not shipped via marketplace/npm" note, and a "When to run" section.
- **Sidecar readiness** — poll `<root>/.design/_server.json` exactly like `server_json.rs::wait_for_server` (200 ms tick, `url` verbatim with `localhost`).
- **Feature gating** — `#[cfg(feature = "e2e")]` around the module + the `.plugin()` call, like the existing `#[cfg(unix)]` blocks in `sidecar.rs`/`lib.rs`. Release build (no feature) must compile and link unchanged.
- **Evidence layout** — `.ai/scenarios/<slug>/<YYYY-MM-DD-HHMM>/native-desktop/*.png` + a `report.md`, as in `live-multiplayer-hub-sync/`.

### Documentation

- [Tauri v2 — WebDriver testing](https://v2.tauri.app/develop/tests/webdriver/) — Why: embedded provider config, the `@wdio/tauri-service` macOS story.
- [WebdriverIO — Tauri platform support](https://webdriver.io/docs/desktop-testing/tauri/platform-support/) — Why: macOS/Windows matrix, `driverProvider: 'embedded'`, msedgedriver auto-download on Windows.
- [Tauri v2 — debug / devtools feature](https://v2.tauri.app/develop/debug/) — Why: confirm whether the e2e build needs `devtools`/extra features; macOS private-API caveat (OK for our notarized DMG, irrelevant for a local test build).
- Resolve exact `@wdio/tauri-service` version + embedded-provider API via context7 (`webdriverio`) at execute-time — pin versions (OSS ecosystem is early-stage/churny).

---

## Open questions to resolve IN the pilot (de-risk)

These are the research's unverified points; the pilot must answer them and the skill records the answers:

1. **Signed release vs test build** — does the embedded provider require a debug/`--features e2e` build (so we test a *near*-release, not the exact signed artifact)? Expected: yes; accept it, document the delta.
2. **Canvas iframe frame-switching** — does WebDriver `switchToFrame` work across the DDR-054/063 untrusted cross-origin canvas iframe, or must the pilot run with `MAUDE_CANVAS_ORIGIN_SPLIT=0`? `helpers/canvas-frame.ts` encodes the answer.
3. **eval-over-IPC flakiness on heavy/animated canvas** — can specs get a stable snapshot mid-animation (project memory `reference_svg_animation_gotchas`: freeze-frames lie)? Pilot asserts on a static canvas first; document waits/retries.

---

## Tasks

Execute in order. Each task is atomic and testable.

### ✅ Task 1: RESEARCH resolve WebdriverIO + @wdio/tauri-service current API — completed

- **Findings (locked):** `@wdio/tauri-service@1.2.0` on npm (deps `@wdio/native-*` + `get-port`, no `tauri-driver`). Config: `services:['@wdio/tauri-service']`, `capabilities:[{browserName:'tauri','tauri:options':{application:'<binPath>'}}]`, macOS embedded provider = default (auto-detected). Rust crate **`tauri-plugin-wdio-webdriver`** required for macOS embedded; register under `#[cfg(debug_assertions)]`; add `wdio-webdriver:default` to capabilities. Recorded in STATE.

### Task 2: ADD the WebDriver plugin to Cargo, gated to debug builds

- **Do**: `cd apps/desktop/src-tauri && cargo add tauri-plugin-wdio-webdriver`. The dep can be unconditional (it's only *registered* under `debug_assertions`); prefer `[target.'cfg(debug_assertions)'.dependencies]` or a plain dep — pick whichever `cargo add` + release-strip leaves clean. No custom `e2e` feature, no stub module (deferred).
- **Pattern**: mirror the existing plugin deps in `Cargo.toml` (`tauri-plugin-shell` etc.).
- **Gotcha**: the **release `.app` must be unaffected** — registration is `#[cfg(debug_assertions)]` only. Confirm `cargo check` (release profile) doesn't pull the plugin into the shipped binary's runtime path.
- **Validate**: `cargo check` passes; `Cargo.lock` updates.

### Task 3: UPDATE lib.rs to register the plugin under debug_assertions + grant capability

- **Do**: in the Tauri builder chain add `#[cfg(debug_assertions)] let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());`. Add `"wdio-webdriver:default"` to `capabilities/default.json` (debug-only plugin — verify a release build doesn't reject the unknown permission; if it does, split into a debug-only capability file).
- **Gotcha**: `tauri dev` is also `debug_assertions` → the plugin loads in normal dev too. That's harmless (loopback WebDriver server, never shipped), but note it.
- **Validate**: `cargo check` passes; `cargo build` (debug) links the plugin; a release `tauri build` still validates capabilities.

### Task 4: ADD data-testid attributes + convention to the studio client

- **Do**: add stable `data-testid` to the pilot's elements in `apps/studio/client/app.jsx` (+ panels as needed): `canvas-list`, `canvas-card-<slug>`, `canvas-frame`. Keep them semantic + slug-based.
- **Pattern**: no existing testids — establish the convention: `data-testid="<area>-<thing>[-<id>]"`, kebab-case, slug-derived for list items.
- **Gotcha**: after client edits, **rebuild the committed bundle release-minified** per CLAUDE.md: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.
- **Validate**: `grep -r data-testid apps/studio/client` shows the new ids; bundle rebuilt.

### Task 5: SCAFFOLD apps/desktop/e2e workspace + wdio config

- **Do**: create `package.json` (pnpm workspace member; pinned wdio devDeps), `tsconfig.json`, `wdio.conf.ts` (embedded provider; `tauri:application` → the `--features e2e` build path; mocha; screenshots; reporter). Add the dir to the pnpm workspace if `pnpm-workspace.yaml` enumerates members.
- **Gotcha**: root `build` script excludes `@maude/desktop` (`--filter '!@maude/desktop'`) — keep the e2e member out of the default `build`/`test` fan-out so it never runs in the normal pipeline; it's invoked explicitly.
- **Validate**: `pnpm --filter @maude/desktop-e2e exec wdio --version` resolves.

### Task 6: CREATE helpers (sidecar, canvas-frame, evidence, native)

- **Do**: implement the four helpers per Files-to-Create. `sidecar.ts` mirrors `server_json.rs`; `canvas-frame.ts` encodes the frame-switch answer (open question 2); `evidence.ts` writes the `.ai/scenarios/` screenshot/report layout; `native.ts` wraps `window.__TAURI__` command calls.
- **Validate**: helpers type-check; `evidence.ts` writes to the right path in a dry run.

### Task 7: CREATE the fixture project

- **Do**: `apps/desktop/e2e/fixtures/project/.design/` with `config.json` + one deterministic, static canvas (`*.tsx` + `*.meta.json`). The test `.app` opens it via `MAUDE_PROJECT_ROOT`.
- **Gotcha**: keep it static (no animation) so the pilot asserts a stable DOM (open question 3).
- **Validate**: `maude design serve --root apps/desktop/e2e/fixtures/project` renders it.

### Task 8: WRITE the pilot scenario

- **Do**: `scenarios/app-boots-and-renders-canvas.e2e.ts` — launch test `.app` → wait sidecar `_server.json` → assert webview on `localhost:<port>` → `$('[data-testid=canvas-list]')` visible → click `canvas-card-<slug>` → switch into `canvas-frame` → assert it rendered → screenshot each step.
- **Pattern**: WebdriverIO `$`/`waitForExist`/`expect`; evidence helper per step.
- **Validate**: `pnpm --filter @maude/desktop-e2e e2e` → scenario passes, 0 blockers, screenshots written.

### Task 9: CREATE the scenario spec

- **Do**: `.ai/scenarios/app-boots-and-renders-canvas/spec.md` mirroring the existing convention; platform matrix lists `native-desktop` (✓) and notes web-desktop is covered separately by browser-mode.
- **Validate**: matches `.ai/scenarios/README.md` layout.

### Task 10: CREATE the repo-internal skill

- **Do**: `.claude/skills/desktop-e2e/SKILL.md` — mirror `whats-new-entry` framing. Cover: what the harness is + why DOM-driven not computer-use; how to build the test app (`e2e:build`); how to run a scenario; the `data-testid` convention; the canvas-frame/`MAUDE_CANVAS_ORIGIN_SPLIT` gotcha; the signed-vs-test-build delta; **a step-by-step "how to add a new scenario"** (new `*.e2e.ts` + testids + spec.md). Record the open-question answers from the pilot.
- **Validate**: skill description triggers on "run desktop e2e", "test the native app", "add a desktop scenario".

### Task 11: CREATE the local slash command

- **Do**: `.claude/commands/desktop-e2e.md` — `/desktop-e2e <scenario|all>` loads the `desktop-e2e` skill, ensures the test build exists (`e2e:build` if stale), runs the scenario(s), surfaces the report path + pass/fail.
- **Pattern**: mirror `.claude/commands/video-new-scene.md` structure.
- **Validate**: command parses; dry-run prints the steps.

### Task 12: WIRE npm scripts

- **Do**: `apps/desktop/package.json` → `"e2e:build": "tauri build --features e2e --debug"` (debug for speed) + `"e2e": "wdio run e2e/wdio.conf.ts"`. Root `package.json` → `"test:e2e:desktop": "pnpm --filter @maude/desktop e2e"` + `"test:e2e:desktop:build": "pnpm --filter @maude/desktop e2e:build"`.
- **Gotcha**: do NOT add e2e to the default `test`/`build` (they must stay green without a desktop toolchain / macOS runner).
- **Validate**: scripts present; `pnpm test:e2e:desktop:build` produces the test `.app`.

### Task 13: DOCS — CLAUDE.md + (optional) CI note

- **Do**: add a short "Desktop E2E" subsection to CLAUDE.md (harness location, the `e2e` feature, the testid convention, "run via `/desktop-e2e`") so it stays in context. Note CI is **out of scope for now** (needs a macOS runner + cargo + the test build) — leave a follow-up to add an opt-in `desktop-e2e.yml` (manual/`workflow_dispatch`).
- **Validate**: CLAUDE.md edited; follow-up captured in the plan retro.

---

## Validation

This repo has no generic test/lint gate for native code; the harness IS the validation backbone.

1. **Rust both ways**: `cargo check` (no feature) + `cargo check --features e2e` — release path unaffected.
2. **Lint/format**: `pnpm lint` (biome) over the new TS.
3. **CLI tests unaffected**: `pnpm test` still green.
4. **Pilot scenario**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` → **0 blockers**, screenshots written to `.ai/scenarios/app-boots-and-renders-canvas/<timestamp>/native-desktop/`.
5. **Release cleanliness**: a normal `pnpm build:desktop` (no `e2e` feature) still produces a working, signable `.app` with no WebDriver server embedded.
6. **Manual**: confirm the pilot drives the **bundled** test `.app`, not `tauri dev` (the whole point).

---

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `app-boots-and-renders-canvas` | native launch → sidecar boot → webview navigate → canvas list → open canvas renders | 🆕 new (pilot) |

**Future scenarios** (skill documents how; not in this plan's scope): `first-run-wizard-zero-terminal`, `project-switch-in-process`, `whats-new-badge`, per-feature regression scenarios added as features land.

---

## Acceptance Criteria

- [x] All scaffolding tasks completed (Tasks 1–13); pilot RUN is dogfood-gated (see below)
- [x] `cargo check` passes in dev AND release profile; release `.app` build unchanged/clean (release profile = `debug_assertions` off → WebDriver plugin not registered; capability still resolves) — **verified, both exit 0**
- [x] **Pilot scenario `app-boots-and-renders-canvas` PASSES** against the bundled `--debug` `.app` — `1 passing` on `webkit 605.1.15 macos` (real WKWebView), 5 screenshots written, canvas visibly renders (step-05). Ran end-to-end on 2026-06-29; five real integration bugs found + fixed in the process (see the skill's gotchas).
- [x] `data-testid` convention established (`canvas-list`/`canvas-row-<slug>`/`canvas-frame` in `app.jsx`); skill documents it. **Bundle rebuild deferred** (shared-tree: `dist/*` is entangled with concurrent git-switcher work — rebuild `--release` once that lands, before the pilot run)
- [x] `.claude/skills/desktop-e2e/SKILL.md` documents author/run/interpret + "how to add a scenario" + the open-question gotchas
- [x] `/desktop-e2e` local command created (runs the harness)
- [x] e2e kept out of the default pipeline (no `build` script → skipped; `test` doesn't fan out); `pnpm install` + `--frozen-lockfile` exit 0 (edgedriver/geckodriver builds denied); harness `tsc` + `biome` clean
- [ ] DDR recorded for the testing approach + testid convention (during `/flow:done`)
- [x] No regression to the shipped/signed desktop release path (release `cargo check` clean; plugin debug-only)

**Verified here:** Rust dev+release `cargo check` (exit 0), harness `tsc` (exit 0), `biome` (exit 0), `pnpm install`/`--frozen-lockfile` (exit 0), all JSON valid, `wdio` binary resolves (9.29.1).
**Pilot ran GREEN end-to-end (2026-06-29):** `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` → `1 passing` on real WKWebView, canvas renders. Five integration bugs surfaced + fixed by running it: (1) `@wdio/tauri-service@1.2.0` published broken → pinned `1.1.0`; (2) single-instance collision with a running Maude → distinct `com.maude.app.e2e` identifier; (3) default WebDriver port 4445 collided with a running debug instance → `embeddedPort: 4455`; (4) first-run wizard over the fixture → `is_first_run` honors `MAUDE_PROJECT_ROOT`; (5) testid slug carried the `.design/` root → strip the dot-folder. All encoded in the skill's gotchas. Canvas-iframe deep DOM stays a soft assertion (cross-origin DDR-054 / render timing).
