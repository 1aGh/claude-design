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

## Security review (/flow:done, 2026-07-03)

Defender (security-auditor) + adversary (ethical-hacker), floor = medium. Defender: 3 medium; adversary: **2 HIGH + 2 medium + a widened-trifecta call**. **All at/above-floor findings FIXED before close-out.**

- **Provenance (defender F1).** The bundled+executed `agent-browser` is the **unscoped npm package published by Vercel** (`vercel-labs/agent-browser`, `vercel-release-bot`; lockfile-pinned `0.27.0` with a `dist.integrity` sha512), NOT `@anthropic-ai/agent-browser` (which doesn't exist on npm). `plugins/design/dependencies.json` wrongly documented the scoped name — corrected to `npm i -g agent-browser` + `github.com/vercel-labs/agent-browser`. Trusted publisher, integrity-pinned.
- **Download-and-execute (defender F2 / adversary F1, HIGH).** `_ensure-browser.mjs` fetched the resolved `chrome-headless-shell` URL and `chmod +x`'d + executed it with no scheme/host check, and `fetch` followed redirects. FIXED: `isTrustedDownloadUrl()` pins `https:` + an allowlisted host (`storage.googleapis.com` / `googlechromelabs.github.io`) before fetch, and the download uses `redirect: 'error'` (the CfT CDN serves the artifact directly). Residual (accepted): no per-artifact SHA (CfT publishes none) → Google's CDN-of-record is the trust anchor, same as Playwright/Puppeteer.
- **"Open a repo → get owned" (adversary F2, HIGH — the headline).** A SERVED (untrusted, DDR-054) project's `.claude/settings.json` `env` block (e.g. `AGENT_BROWSER_EXECUTABLE_PATH` → a repo-shipped binary) / hooks / enabledPlugins would load into the AUTO-APPROVING (DDR-125 F2) session because the adapter defaults to `settingSources:["user","project","local"]` — DDR-143 makes `/design:*` auto-reachable + DDR-144 supplies a clean exec sink. FIXED at the root: `bridge.ts` `newSessionParams` now injects `_meta.claudeCode.options.settingSources = ['user']` on EVERY session, so the served project's `.claude/` can't inject env/hooks/plugins into the auto-approving turn (the DDR-143 guard #6 follow-up, done). The project's CLAUDE.md is read via a separate path, unaffected.
- **Cache persistence (adversary F3, medium).** `~/.maude/browsers` was 0755 and `findShell` returns the first basename match with no digest — a once-planted binary runs forever. FIXED: the cache dir is created + chmod'd `0700`.
- **PATH-prepend shadowing (adversary F4, medium).** `sidecar.rs` prepended the app binary's dir (Contents/MacOS, where the externalBin siblings + the sidecar live) to the dev-server PATH, letting a same-user attacker who can write there shadow `node`/`google-chrome`/etc. for every child. FIXED: replaced with an EXPLICIT single-binary pointer — the sidecar sets `MAUDE_AGENT_BROWSER=<exe_dir>/agent-browser`; `screenshot.sh` uses `"$AB"` (that or a PATH lookup). No PATH pollution.
- **Windows PowerShell injection (defender F3, medium).** Remote CfT `version` flowed into an `Expand-Archive -Command` string. FIXED: validated against `CFT_VERSION_RE` before any path/shell use.

New unit tests: `isTrustedDownloadUrl` (http / foreign-host / garbage rejected), `CFT_VERSION_RE` (shell-injection payloads rejected), and the `settingSources:['user']`-on-every-session invariant. **Accepted below-floor:** zip-slip on extraction (low — `unzip`/libarchive reject `../` at the tool level, and the precondition [controlling the zip bytes] is now gated by the download host+https pin). The two features' fixes together **re-narrow the trifecta** the adversary flagged (settingSources scope + explicit engine pointer + host-pinned download). Reports: `.ai/logs/security-reviews/ddr143-144-screenshot-plugin-attacker.md` (defender inline).
