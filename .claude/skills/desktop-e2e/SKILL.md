---
name: desktop-e2e
description: Run or author DOM-driven end-to-end scenarios against the bundled Maude desktop app (Tauri + WKWebView) using WebdriverIO. Use when the user asks to "run desktop e2e", "test the native app", "regression-test the desktop build", "add a desktop scenario", or when closing a feature that touched the native shell (apps/desktop) / studio UI and needs native verification beyond browser-mode agent-browser.
---

# desktop-e2e — DOM-driven E2E for the native Maude `.app`

Repo-internal skill (Maude-specific; lives in `.claude/skills/`, **not** shipped via the marketplace or npm). It owns how we drive the **real bundled desktop app** in scenario tests — the native counterpart to `agent-browser` (which only reaches the web layer at `http://localhost:<port>`, never the native shell).

Background + decisions: `.ai/plans/feature-desktop-e2e-scenario-harness.md`, memory `project_tauri_desktop_e2e_testing_path`, and `feedback_prefer_dom_driven_e2e_not_computer_use`.

## The one rule

**DOM-driven, never computer-use.** Find elements by `data-testid`, click/type, assert on DOM/text, screenshot for evidence. Computer-use/pixel-vision is too flaky (user feedback) and is NOT used here. Native menu actions are invoked via `window.__TAURI__` commands (see `helpers/native.ts`), not by clicking native chrome.

## What it is

- **Harness:** `apps/desktop/e2e/` — WebdriverIO + [`@wdio/tauri-service`](https://www.npmjs.com/package/@wdio/tauri-service) (Tauri's official E2E path). On macOS the service runs an **embedded W3C WebDriver server inside the app** (no external driver — Apple ships none for WKWebView). The Rust crate `tauri-plugin-wdio-webdriver` is registered in `apps/desktop/src-tauri/src/lib.rs` under `#[cfg(debug_assertions)]`, so the **shipped release `.app` never starts a WebDriver server** — only `tauri dev` and the `--debug` test build do.
- **Scenarios:** `apps/desktop/e2e/scenarios/*.e2e.ts`. The committed **spec** lives in `.ai/scenarios/<slug>/spec.md`. **Run outputs go to the SAME place as `/flow:scenario`** — `.ai/device/scenario-runs/<slug>/<YYYY-MM-DD-HHMM>/` (gitignored): `report.md` at the run root + screenshots under `native-desktop/`. Per the scenario convention, **never write run outputs into `.ai/scenarios/<slug>/`** (that's spec/runners only).
- **Fixture:** `apps/desktop/e2e/fixtures/project/` — a minimal `.design/` project the test app opens via `MAUDE_PROJECT_ROOT`, bypassing first-run/project-picker so scenarios need no native dialog.

## How to run

```sh
# 1. (once / after harness or dep changes) install the e2e workspace deps
pnpm install

# 2. (once / on studio-client or Rust source change) build the test app
pnpm test:e2e:desktop:build      # → apps/desktop: tauri build --debug

# 3. run the scenarios
pnpm test:e2e:desktop            # → wdio run apps/desktop/e2e/wdio.conf.ts
```

Requires the macOS/Windows toolchain (cargo + tauri-cli). The `tauri build` `beforeBuildCommand` syncs the Bun sidecar binary automatically.

> **Studio client changes need a bundle rebuild first.** The test app serves the committed `apps/studio/dist/client.bundle.js`. If you added/changed `data-testid`s in `apps/studio/client/`, rebuild release-minified before `test:e2e:desktop:build`: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` and commit `dist/client.bundle.js` + `dist/styles.css` (CLAUDE.md rule).

## The `data-testid` convention

Scenarios target `data-testid`, never CSS classes (classes churn with the DS). Format: `data-testid="<area>-<thing>[-<id>]"`, kebab-case, slug-derived for list items. Established hooks in `apps/studio/client/app.jsx`:

| testid | Element |
| --- | --- |
| `canvas-list` | the sidebar file tree (`.st-tree`) |
| `canvas-row-<slug>` | a canvas row; `<slug>` = the canvas path kebab-cased (e.g. `ui/Smoke.tsx` → `canvas-row-ui-smoke`) |
| `canvas-frame` | the **active** canvas iframe |
| `smoke-artboard-content` | content inside the fixture canvas |

When a new feature adds UI a scenario must reach, add a `data-testid` to that element in the same change.

## How to add a new scenario

1. **Add testids** to the studio-client (or native) elements the flow touches; rebuild the bundle (above).
2. **Write the spec:** `.ai/scenarios/<slug>/spec.md` (mirror `app-boots-and-renders-canvas/spec.md`; platform matrix lists `native-desktop`).
3. **Write the test:** `apps/desktop/e2e/scenarios/<slug>.e2e.ts`. Use the helpers: `waitForSidecar()`, `enterCanvasFrame()`/`exitToTop()`, `capture(label)` (screenshot + report row), `invokeTauri(cmd, args)` / `isNativeShell()`.
4. **Run** via `/desktop-e2e <slug>` or `pnpm test:e2e:desktop`.

### Scenarios that need native dialogs / OAuth (deferred infra)

The pilot avoids native chrome by opening the fixture via `MAUDE_PROJECT_ROOT` and calling Tauri commands directly. A scenario that genuinely needs the native file picker or the GitHub device flow (e.g. `first-run-wizard`, `project-switch`) will need **deterministic stubs** added behind `#[cfg(debug_assertions)]` in the Rust shell (return a fixture path/token instead of opening the OS dialog). That stub module is **not built yet** — add it with the first such scenario and document it here.

## Known gotchas (all VERIFIED on the first real run, 2026-06-29)

The pilot run surfaced five real integration issues — every one is now fixed/encoded in the harness. Keep these in mind when extending:

- **Pin `@wdio/tauri-service` to `1.1.0` (exact, not `^`).** `1.2.0` (current latest) is published broken — it imports `installMockSyncOverride` from `@wdio/native-utils`, which that version doesn't export, so the service fails to initialize. `^1.2.0` would regress to it. Re-check when a `1.2.1+` ships.
- **Distinct bundle identifier for the e2e build (`com.maude.app.e2e`, in `tauri.e2e.conf.json`).** Without it, the `tauri_plugin_single_instance` plugin makes the test launch **focus a developer's already-running Maude** (same `com.maude.app`) instead of spawning a fresh fixture instance — the test then drives the wrong project. The distinct id isolates the e2e instance (own single-instance lock, own app-state dir).
- **Pin a non-default embedded WebDriver port (`embeddedPort: 4455`, in `wdio.conf.ts`).** The default is 4445; a developer's running **debug** Maude also carries the wdio plugin (it's `#[cfg(debug_assertions)]`) and answers on 4445, so the harness would connect to the wrong instance. 4455 sidesteps the collision.
- **First-run wizard suppression.** A distinct identifier ⇒ fresh app-state ⇒ `is_first_run` true ⇒ the OnboardingWizard renders over everything. `app_state::is_first_run` now returns false when `MAUDE_PROJECT_ROOT` is set (an explicit project target = not a first run). `MAUDE_PROJECT_ROOT` reliably forwards: the embedded provider spawns the app with `{...process.env}`.
- **`data-testid` for canvas rows strips the designRoot prefix.** `file.path` is `.design/ui/Smoke.tsx` (with the `.design/` root), so the slug derivation strips a leading dot-folder → `canvas-row-ui-smoke` (not `…-design-ui-smoke`).
- **Canvas iframe content is a SOFT assertion (step 5b).** The canvas takes a few seconds to build+render after opening (an immediate post-click screenshot can show "0 ARTBOARDS" — it's timing, not a runtime gap; a later screenshot shows the full render). The hard assertion is the top-frame `canvas-frame` element + its `data-path`; the in-frame DOM check is best-effort (cross-origin DDR-054 if the split is on; with `MAUDE_CANVAS_ORIGIN_SPLIT=0` it's same-origin and renders — confirmed visually in the evidence). Tighten to a hard in-frame assertion (with generous waits) when a scenario must prove deep canvas DOM.
- **Signed vs test build:** the harness drives a `--debug` build (embedded WebDriver), not the exact signed release. Same source, different profile — a near-release smoke, documented.
- **Not covered:** the Bun sidecar process itself, native OS dialogs, and the macOS menu bar chrome — assert their *effects* via the webview / Tauri commands, or a separate probe. Dialog/OAuth stubs (for first-run/project-switch scenarios) are still deferred (above).

## When NOT to use

Browser-renderable studio UI is cheaper to verify with `agent-browser` in browser mode (`maude design serve`). Reach for desktop-e2e only for native-shell behavior: sidecar lifecycle, webview navigation, first-run, project switch, native menus, OAuth/keychain, updater.
