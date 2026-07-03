# DDR-144 — Bundled screenshot engine: agent-browser launcher + on-demand chrome-headless-shell

**Status:** accepted
**Date:** 2026-07-03
**Relates:** DDR-143 (zero-install `/design:*` in the desktop chat — this completes the promise: commands resolve AND their critics can now SEE artboards), DDR-128 (readiness detect-and-guide; agent-browser was a "soft/optional" row), DDR-106 (Tauri `externalBin` sidecar + target-triple staging), DDR-062 (`/design:*` reach helpers via `maude design <verb>` from the maude package root), DDR-071 (playwright/SVGO deps), DDR-069 (export pipeline — also needs a Chromium)

## Context

DDR-143 made `/design:*` commands resolve in the Maude Desktop chat with zero install. But the *value* of `/design:new`, `/design:edit`, `/design:critic` is that the critics **see** the rendered artboards — `design-critic` / `graphic-design-critic` / `a11y-critic`, the `/design:new` step-9 reality check, `/design:edit` step-3.5/7, and `/design:smoke` all capture screenshots via `apps/studio/bin/screenshot.sh` (agent-browser preferred, `npx playwright` fallback). Screenshots are therefore **effectively required** for the full design workflow, not "optional" — the readiness row's `(optional)` label understated it for the desktop use case.

The desktop app bundled NEITHER agent-browser nor playwright, so a fresh desktop user (only Claude Code installed) had `/design:*` resolve but every critic screenshot fail — a hollow zero-install. Fixing it means shipping a screenshot backend, which means shipping (or provisioning) a **Chrome-family browser** — and browser engines are inherently large.

Facts established before deciding (all measured / verified live):
- `agent-browser` is a self-contained **~10 MB per-platform binary** (darwin/linux/win32 all present) with **no browser bundled** — it drives a Chrome-family engine.
- It honors **`AGENT_BROWSER_EXECUTABLE_PATH`** — point it at any Chromium binary.
- **`chrome-headless-shell`** (headless-only Chrome-for-Testing) is **94 MB** vs **172 MB** for full Chrome (~45 % smaller) and is exactly what headless capture needs.
- **Verified end-to-end:** `agent-browser` + `AGENT_BROWSER_EXECUTABLE_PATH=<chrome-headless-shell>` renders a real Maude canvas faithfully (studio shell + artboard, valid 1280×720 PNG) through the actual `screenshot.sh` path.

## Decision 1 — Bundle the agent-browser LAUNCHER via `externalBin`; provision the browser on-demand

Ship the ~10 MB per-platform `agent-browser` binary in the desktop app as a Tauri `externalBin` sidecar (`sync-agent-browser.mjs` → `binaries/agent-browser-<triple>`, mirroring `sync-sidecar.mjs`; wired into `beforeBuild/DevCommand`). `externalBin` (not a staged resource) is deliberate: **Tauri signs it for macOS notarization** — an unsigned executable dropped into `Resources/` would break the notarized bundle.

The browser is NOT bundled in the installer. Instead `apps/studio/bin/ensure-browser.mjs` resolves one at screenshot time, priority: (1) `AGENT_BROWSER_EXECUTABLE_PATH`/`MAUDE_BROWSER_EXECUTABLE` override → (2) a Maude-cached `chrome-headless-shell` (`~/.maude/browsers`, override `MAUDE_BROWSERS_DIR`) → (3) an existing Playwright `chromium-headless-shell` → (4) system Chrome/Chromium → (5) **download `chrome-headless-shell`** (~94 MB, one-time) into the Maude cache. `screenshot.sh` calls it and exports `AGENT_BROWSER_EXECUTABLE_PATH` for the agent-browser calls. Small installer (+~10 MB), download-and-go — consistent with the desktop app's ethos; the 94 MB browser lands once, on first screenshot, cached forever.

## Decision 2 — chrome-headless-shell (94 MB), not full Chrome (172 MB) or a bundled Chromium

Screenshots are always headless, so the headless-only shell is the right engine — ~45 % smaller than full Chrome, official Chrome-for-Testing build, and reused if a Playwright/system copy already exists (no duplicate download). Rejected: (a) `agent-browser install` — downloads **full** Chrome (172 MB), no headless-shell option; (b) **bundling Chromium in the installer** (~94–172 MB/platform) — big installer, offline-ready but against the download-and-go model (kept as a possible future toggle); (c) **WebKit / the app's own WKWebView** — near-free on macOS but agent-browser is Chrome/CDP-only and WebKit could render differently from the Chromium the canvases are tuned against (fidelity risk).

## Decision 3 — PATH via the bundled-tools dir; browser resolution stays lazy in screenshot.sh

`sidecar.rs` prepends the app binary's own dir (where `externalBin` siblings land — `agent-browser`, `maude-server`) to the spawned dev-server's PATH, so `screenshot.sh`'s `command -v agent-browser` finds the bundled launcher through the whole spawn chain (dev-server → claude → `maude design screenshot`). The sidecar does NOT set `AGENT_BROWSER_EXECUTABLE_PATH` (it can't know the path before provisioning) — `screenshot.sh` resolves the browser lazily via `ensure-browser`. Clean separation: sidecar owns PATH, screenshot.sh owns the browser.

## Guards

1. **No surprise downloads on web/CLI.** `screenshot.sh` gates the 94 MB fetch on `MAUDE_DEV_SERVER_ROOT` (set only by the desktop sidecar): the desktop path may download; the web `maude design serve` + CLI paths pass `--no-download` (resolve an EXISTING browser only, else agent-browser keeps its own system-Chrome default). A terminal user is never ambushed by a background download.
2. **No behavior change for working setups.** ensure-browser prefers an existing browser (cache / Playwright / system Chrome) over downloading, so users who already have a screenshot backend keep it.
3. **Notarization.** agent-browser rides `externalBin` so Tauri signs it; staging it as a plain resource would ship an unsigned executable and fail notarization.
4. **Readiness honesty.** The `agent-browser` readiness row is first-class (required) + present (bundled) on the desktop path — never a red "optional install" wall — with a note when the browser will download on first use; it stays optional on web/CLI (`readiness.ts`).

## Consequences / Deferred

- Desktop installer grows ~10 MB/platform (the launcher); the 94 MB browser is a one-time first-screenshot download, cached in `~/.maude/browsers`.
- `agent-browser` becomes a build-time devDependency of `@maude/desktop` (pinned `0.27.0`) — the platform binaries ship in its npm tarball, so pnpm's ignored-build-script warning is harmless.
- **Exports (PNG/PDF/SVG/PPTX, DDR-069) still need Playwright's own Chromium** — this feature covers screenshots (agent-browser), not the export pipeline. A follow-up can point the export shims at the same provisioned headless-shell (or bundle Playwright) to make exports zero-install too.
- **Verification ceiling (DDR-135):** the mechanism is proven live (headless-shell renders a canvas via the real `screenshot.sh`); the packaged-`.app` end-to-end (externalBin on PATH in the notarized bundle, first-run provisioning) is user dogfood — `cargo check` + the sync-staging assertion are the automated coverage.
- **Linux-arm64 / platforms without a Chrome-for-Testing build** fall through to system Chrome or agent-browser's own install; `ensure-browser` returns null there and logs it.
