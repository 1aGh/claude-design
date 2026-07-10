# DDR-159: desktop-e2e is the cross-platform verification substitute for WKWebView-specific canvas behavior

- **Date:** 2026-07-09
- **Status:** Accepted (practiced — feature `unified-text-editing`)
- **Tags:** testing, desktop-e2e, wkwebview, scenario-runner, synthetic-events, verification, harness
- **Related:** [DDR-158](./DDR-158-unified-text-editing-custom-caret-and-world-html-editors.md) (the feature that forced the question), `.ai/plans/feature-desktop-e2e-scenario-harness.md` (the harness), skill `desktop-e2e`. Memories: `project_desktop_e2e_harness_wdio_gotchas`, `feedback_prefer_dom_driven_e2e_not_computer_use`.

## Context

The flow pipeline's default UI gate is the 5-platform `scenario-runner` (web-desktop, web-mobile, ios, android) driven by `agent-browser`/Chromium. `feature-unified-text-editing` is WebKit-correctness work: caret blink freezing under compositing, `<foreignObject>` mis-hit-testing under transform, rAF throttling for occluded windows. **Chromium cannot reproduce any of it (measured)** — a green Chromium run would say nothing, and a red one would chase ghosts. `/flow:done` would normally block on the missing 5-platform run.

## Decision

For canvas behavior that is engine-specific to WKWebView, the **desktop-e2e harness (WebdriverIO + `@wdio/tauri-service` against the bundled `--debug` `Maude.app`) IS the cross-platform gate** — the 5-platform scenario-runner is N/A, recorded as such in the scenario spec's platform matrix, and `/flow:done` should not block on it.

The verification model that makes this workable (all measured, encoded in `apps/desktop/e2e/scenarios/canvas-text-editing.e2e.ts` + `.ai/scenarios/canvas-text-editing/spec.md`):

1. **Native WebDriver input does not penetrate the canvas iframe.** Drive everything with synthetic events dispatched inside the same-origin frame (`MAUDE_CANVAS_ORIGIN_SPLIT=0`) via `iframe.contentDocument` from the top frame — also robust against post-build hot-reload invalidating `switchFrame`.
2. **Synthetic events run no UA default action.** They faithfully exercise app handlers (edit entry, keydown commit, the app's own caret placement) but cannot produce native typing or native caret motion — emulate insertion with `execCommand('insertText')`, and assert the app's programmatic placement path (which is what real users exercise too, per DDR-158).
3. **Temporal behavior (caret blink, "feel") is a user visual gate**, not a harness assertion. The harness asserts the deterministic proxy (element presence + `animationName` + position); the human confirms blink/feel in `pnpm dev:desktop` once per feature.
4. **Determinism rules:** delete `_canvas-state/` before the run (the DDR-115 camera persists across runs and pushes targets off-viewport, where `caretRangeFromPoint` returns null), fit + wait for rect-stability before any hit-test, snapshot + byte-restore every fixture file a commit test writes through to disk, and kill stale fixture sidecars between runs (a leaked `maude-server` serves stale staged sources).
5. **Two-tier rebuild economy:** canvas-runtime source (`apps/studio/*.tsx`, read from the staged `.app` resources at runtime) refreshes with a `cp` into `Maude.app/Contents/Resources/apps/studio/`; pipeline/server code is compiled INTO the sidecar and needs `bun run build.ts --release --target=<host>` + swapping `Contents/MacOS/maude-server` (or the full `tauri build --debug`).

## Rejected

- **Trusting Chromium (`agent-browser`) for caret/hit-test coverage** — measured false confidence; the bugs only exist in WKWebView.
- **Computer-use / pixel driving of the native window** — standing user feedback: too flaky; DOM-driven only.
- **Skipping automation and gating on manual testing alone** — the 8-test suite catches regressions the eye misses (select-all fallbacks, ghost read-renders, stroke-count changes), and survived five real regressions during the feature's own development.

## Consequences

- Scenario specs for engine-specific canvas behavior must declare the substitution in their platform matrix (see `canvas-text-editing`'s) so `/flow:done` has an explicit record instead of a missing gate.
- The suite's determinism rules (camera reset, fixture restore, sidecar cleanup) are load-bearing — new scenarios that hit-test or commit must copy them.
- `@wdio/tauri-service` stays pinned `1.1.0` (1.2.0 re-confirmed broken 2026-07-09 — imports `installMockSyncOverride` that `@wdio/native-utils` doesn't export).
