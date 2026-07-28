# DDR-134: Desktop E2E via WebdriverIO `@wdio/tauri-service` (embedded provider) + a `data-testid` convention

- **Date:** 2026-06-30
- **Status:** Accepted (shipped — commit `fbaf628`; pilot verified green on real WKWebView)
- **Tags:** desktop, tauri, testing, e2e, webdriverio, wkwebview, data-testid, debug-only, repo-internal-skill, verification-ceiling
- **Related:** [DDR-106](./DDR-106-native-shell-tauri-sidecar.md) (the Tauri shell + sidecar this drives), [DDR-054](./DDR-054-canvas-origin-split.md)/[DDR-063](./DDR-063-canvas-origin-split-default-on.md) (the cross-origin canvas iframe = the soft-assertion boundary), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (paths in compiled binaries), [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (bundled-runtime self-heal). Spec: `.ai/plans/archive/feature-desktop-e2e-scenario-harness.md`; skill: `.claude/skills/desktop-e2e/SKILL.md`; harness: `apps/desktop/e2e/`. Memory: `project_desktop_e2e_harness_wdio_gotchas`, `project_tauri_desktop_e2e_testing_path`, `feedback_prefer_dom_driven_e2e_not_computer_use`.

## Context

The native Maude `.app` (Tauri v2 + WKWebView, Bun sidecar) was the project's documented **verification ceiling**: `agent-browser` only reaches the web layer at `http://localhost:<port>`, never the native shell (first-run, Tauri menus, sidecar lifecycle, project switch, OAuth/keychain, updater). Those were verified by manual dogfood + screen recording — which doesn't scale and isn't a regression gate. The user wanted a repeatable, in-repo, **DOM-driven** harness (Playwright/agent-browser-style, by `data-testid`) — explicitly **not** computer-use, which is too flaky from their experience (`feedback_prefer_dom_driven_e2e_not_computer_use`).

Deep research (`project_tauri_desktop_e2e_testing_path`) established that Apple ships no WKWebView WebDriver, so the only robust macOS path is an **embedded W3C WebDriver server inside the app** — which is exactly what Tauri's officially-recommended `@wdio/tauri-service` does. Playwright-via-CDP is Windows/WebView2-only; the mock runtime never runs a real webview.

## Decision

Adopt **WebdriverIO + `@wdio/tauri-service`** (embedded provider) as the desktop E2E harness, living only in this repo:

1. **Harness** at `apps/desktop/e2e/` (own pnpm workspace member, kept out of the default build/test fan-out). Drives the real bundled `.app`'s WKWebView DOM; screenshots per step; run outputs to `.ai/device/scenario-runs/<slug>/<ts>/` (gitignored, same as `/flow:scenario`).
2. **`tauri-plugin-wdio-webdriver` registered `#[cfg(debug_assertions)]` only** — the shipped, signed release `.app` never starts a WebDriver server (verified: release `cargo check` clean, plugin not in the release runtime path). The `--debug` test build is a near-release artifact (same source, debug profile), an accepted delta.
3. **`data-testid` convention** for scenario hooks: `<area>-<thing>[-<id>]`, kebab-case, slug derived from the canvas path **with the designRoot dot-folder stripped** (`.design/ui/Smoke.tsx` → `canvas-row-ui-smoke`). New feature UI a scenario must reach adds its testid in the same change.
4. **Repo-internal skill `desktop-e2e` + `/desktop-e2e` command** own author/run/interpret — Maude-specific, not shipped via the marketplace/npm (mirrors the `whats-new-entry` convention).
5. **Native chrome (menus, dialogs)** is driven by invoking Tauri commands via `window.__TAURI__` in `browser.execute`, never by clicking native chrome; dialog/OAuth stubs (for first-run/project-switch scenarios) are deferred behind `#[cfg(debug_assertions)]` until the first scenario needs them.

This lifts the native-app verification ceiling for everything DOM-reachable; it does **not** cover the Bun sidecar process, native OS dialogs, or the macOS menu bar (assert their effects via the webview/commands).

## Consequences

- **Five integration realities encoded** (each found by actually running the pilot, not by static review): pin `@wdio/tauri-service` to **`1.1.0`** (latest `1.2.0` is published broken — imports a non-existent `@wdio/native-utils` export); a **distinct e2e bundle id `com.maude.app.e2e`** (`tauri.e2e.conf.json`) so `single-instance` doesn't focus a developer's already-running Maude; a **non-default `embeddedPort: 4455`** so it doesn't collide with a running debug instance's WebDriver server on 4445; `app_state::is_first_run` **honors `MAUDE_PROJECT_ROOT`** so a distinct-id fresh app-state doesn't pop the onboarding wizard over the fixture; and the testid slug strips the `.design/` root. All in the skill's gotchas + the memory.
- **Deep canvas-iframe DOM is a soft assertion** — the canvas builds+renders a few seconds after opening (an immediate screenshot can read blank) and may be cross-origin (DDR-054). The hard assertion is the top-frame `canvas-frame` element + its `data-path`; visual render is confirmed by screenshot evidence.
- **+367 npm dev-deps** (the wdio tree) in `apps/desktop/e2e` — devDependencies only, not in the published `files`, run only on a dev machine. `pnpm install` needs `edgedriver`/`geckodriver` build scripts **denied** (`allowBuilds:false` + `pnpm approve-builds '!…'`) to stay exit-0.
- **Security:** no production attack surface — the WebDriver server is debug-only; the `wdio-webdriver:default` capability is dormant in release (plugin unregistered). The `is_first_run`/`MAUDE_PROJECT_ROOT` behavior is an existing documented env override, not new surface.

## Alternatives considered

- **Playwright (`tauri-playwright`)** — familiar API, but bridges macOS WKWebView via a single early-stage OSS eval-socket project (higher churn risk); `@wdio/tauri-service` is the official, maintained path.
- **Computer-use / vision** — rejected up front (user experience: too flaky; `feedback_prefer_dom_driven_e2e_not_computer_use`).
- **Custom bridge over the Bun sidecar's HTTP/WS** — reinvents WebDriver and still can't drive native chrome; against "reuse battle-tested libs."
- **A custom `e2e` Cargo feature** (original plan) — superseded: the official integration gates the plugin via `#[cfg(debug_assertions)]`, which keeps the release clean by construction without a bespoke feature.
