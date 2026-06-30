# app-boots-and-renders-canvas

Pilot **native-desktop** E2E scenario — proves the bundled Maude `.app` boots its sidecar, navigates the WKWebView to the loopback dev-server, and renders a canvas. DOM-driven via `@wdio/tauri-service` (no computer-use). The integration-smoke backbone for the desktop E2E harness.

**Persona:** maintainer running a regression check on the native shell.
**Plan:** `.ai/plans/feature-desktop-e2e-scenario-harness.md`.
**Harness:** `apps/desktop/e2e/` (WebdriverIO + embedded WebDriver provider). Skill: `desktop-e2e`.
**Hypothesis:** A `--debug` test build of `Maude.app` launched with `MAUDE_PROJECT_ROOT=<fixture>` → sidecar boots → webview on `http://localhost:<port>` → `[data-testid=canvas-list]` visible → click `[data-testid=canvas-row-ui-smoke]` → `[data-testid=canvas-frame]` renders the fixture content.

## Platform matrix

| Platform | Required | Rationale |
| --- | --- | --- |
| **native-desktop** (`Maude.app`, Tauri/WKWebView) | ✓ | The only platform that exercises the native shell + sidecar + webview integration. Driven by the WebdriverIO harness against the **bundled** `--debug` app. |
| web-desktop (`maude design serve`) | covered elsewhere | The studio web UI is faithfully testable in browser mode via `agent-browser`; this scenario deliberately covers what browser mode can't (the native shell). |
| web-mobile / ios / android | N/A | No mobile form factor for the desktop app. |

## Steps (automated — `apps/desktop/e2e/scenarios/app-boots-and-renders-canvas.e2e.ts`)

| # | Step | Expected |
| --- | --- | --- |
| 1 | Launch the test `.app` (harness). | `window.__TAURI__` present (real native shell). |
| 2 | Wait for the sidecar. | Webview URL matches `http://localhost:<port>`. Screenshot `webview-on-localhost`. |
| 3 | Canvas list renders. | `[data-testid="canvas-list"]` displayed. Screenshot `canvas-list-visible`. |
| 4 | Click the fixture canvas row. | `[data-testid="canvas-row-ui-smoke"]` click opens a tab. Screenshot `canvas-opened`. |
| 5 | Canvas renders in the iframe. | Inside `[data-testid="canvas-frame"]`, `[data-testid="smoke-artboard-content"]` contains "Maude desktop E2E". Screenshot `canvas-rendered`. |

**Acceptance:** all 5 steps pass, 0 blockers. Run output (report + screenshots) lands in the same place as `/flow:scenario` — `.ai/device/scenario-runs/app-boots-and-renders-canvas/<YYYY-MM-DD-HHMM>/` (gitignored: `report.md` at the run root, screenshots under `native-desktop/`). This committed `spec.md` is the spec; run outputs are NOT committed here.

## How to run

```sh
pnpm test:e2e:desktop:build   # one-time / on source change — `tauri build --debug`
pnpm test:e2e:desktop         # runs the WebdriverIO scenario(s)
# or: /desktop-e2e app-boots-and-renders-canvas
```

> First run also needs the e2e workspace deps installed (`pnpm install` after the harness landed) and a synced sidecar binary (the `tauri build` `beforeBuildCommand` runs `sync-sidecar.mjs`). macOS/Windows toolchain required (cargo + tauri-cli).
