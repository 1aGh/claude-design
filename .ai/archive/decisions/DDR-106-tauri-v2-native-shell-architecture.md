# DDR-106: Tauri v2 native shell — sidecar over the compiled dev-server binary

- **Date:** 2026-06-16
- **Status:** Accepted (founding decision for the native-collab arc — phase-26 Task 1)
- **Tags:** native-app, tauri, desktop, sidecar, lifecycle, distribution, csp, webview, phase-26
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun runtime + per-platform `bun --compile` binaries — the executable the sidecar spawns), [DDR-084](./DDR-084-server-up-boots-compiled-binary.md) (binary resolution + the `isPlausiblePlatformBinary` allowlist the Rust side mirrors), [DDR-095](./DDR-095-runtime-apps-extracted-to-top-level.md) (dev-server now at `apps/studio/`; `apps/desktop/` joins it at top level), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (real-disk paths inside the compiled binary), [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (`boot-self-heal.ts` first-launch build — wrapped by the native splash), [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md) (cross-origin canvas iframe — must survive WKWebView), [DDR-062](./DDR-062-plugins-reach-executable-logic-via-maude.md) (`maude design <verb>` dispatch — unchanged by the shell). Sibling founding DDRs: [DDR-107](./DDR-107-git-engine-isomorphic-git.md), [DDR-108](./DDR-108-github-auth-oauth-device-flow.md), [DDR-109](./DDR-109-native-shell-security-model.md), [DDR-110](./DDR-110-three-lane-collaboration-model.md). Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md). Plan: [`phase-26-native-collab-tauri-shell.md`](../plans/phase-26-native-collab-tauri-shell.md).

## Context

Maude today launches only as a CLI + Claude Code plugin + a localhost dev-server you open in a browser. The target persona for the native-collab arc — PMs, designers, founders — is excluded by `maude design serve` from a terminal. We need a native app: install one thing, double-click, see canvases.

The dev-server is already a **self-contained `bun --compile` standalone binary** (DDR-009) that embeds yjs + every runtime dep, resolves its own real-disk paths (DDR-045), and self-heals on first launch (DDR-044). The native layer must be **purely additive** — it adds process lifecycle, native chrome, OS keychain, deep links, and (later phases) auto-update, while reusing 100% of the dev-server and client. A non-shell user (raw CLI / plugin) must be unaffected.

Two shell technologies were on the table: **Electron** (Chromium + Node bundled, ~120 MB) and **Tauri v2** (Rust core + OS webview, ~10 MB).

## Decision

**The native shell is a Tauri v2 app at `apps/desktop/`. It spawns the existing compiled dev-server binary as a Tauri _sidecar_ (`externalBin`), polls `_server.json` for the port, and loads the existing canvas UI in the OS webview. No dev-server or client code changes in phase-26.**

### Why Tauri over Electron

- **Size:** ~10 MB vs ~120 MB. For non-technical distribution (download + double-click), bundle size is a real adoption tax.
- **OS webview:** WKWebView (macOS) / WebView2 (Windows) — no second Chromium to ship, patch, or sign.
- **Sidecar mechanism:** Tauri's `externalBin` is purpose-built for bundling + spawning an external executable — an exact fit for the already-compiled Bun binary. We do not re-implement the dev-server in-process; we run it as-is.
- **Mature signing/updater:** Apple Developer ID + notarytool and the Tauri updater are first-class — load-bearing for the "install like Figma" promise (auto-update + crash recovery land in phase-32).
- **Cost:** a Rust toolchain enters the build. Isolated to `apps/desktop/src-tauri/`; most logic can stay in the Rust `setup` hook + a thin JS glue.

### Lifecycle contract (the shell's whole job)

1. **Spawn** the dev-server binary as a sidecar with `--root <project>`. The `project_root` in phase-26 = the folder the user opened, or the last-used project from `AppData`; the full project picker is phase-29.
2. **Poll** `<designRoot>/_server.json` (the dev-server writes it on boot — see schema below) until the `port`/`url` is present, then navigate the webview to the `url`. First launch runs `boot-self-heal` (`bun install --production` + `build.ts`), which can take 30–90 s → native "Starting Maude…" splash, **120 s timeout** on first run, < 2 s after.
3. **Kill** the sidecar on app quit (SIGTERM → 2 s → SIGKILL). **Respawn** up to 3× with backoff on non-zero child exit.
4. **Single-instance** via `tauri-plugin-single-instance` — a second launch focuses the existing window.

### Concrete wiring corrections (the plan's paths were pre-DDR-095/pre-build-output)

These are the real, on-disk facts the implementation must follow — they differ from the prose in the phase-26 plan, which predates the `apps/studio` relocation and didn't account for Tauri's triple-naming requirement:

| Plan assumed | Reality (this DDR) |
| --- | --- |
| Server at `plugins/design/dev-server/server.ts` | **`apps/studio/server.ts`** (DDR-095) |
| `externalBin: ["../plugins/design/dev-server/bin/server"]` | The compiled binary is named `maude` inside a `maude-<slug>/` dir (DDR-084), or built to `apps/studio/dist/maude-<slug>`. **Neither matches Tauri's required `<name>-<target-triple>` sidecar naming.** A build step must copy/rename the binary to `apps/desktop/src-tauri/binaries/maude-server-<target-triple>` before `tauri build` bundles it. |
| Webview loads `http://127.0.0.1:<port>` | The dev-server writes `url: http://localhost:<port>`. **Navigate to the `url` field verbatim** (`localhost`, not `127.0.0.1` — they are different origins to WKWebView). |
| Single port | `_server.json` may also carry **`canvasOrigin: http://localhost:<canvasPort>`** — a _second_ port for the cross-origin canvas iframe (DDR-063). CSP must allow `localhost:*`, not a single port. |

**Platform-slug → Rust target-triple map** (the sidecar copy step):

| maude slug (DDR-084) | Tauri/Rust target triple |
| --- | --- |
| `darwin-arm64` | `aarch64-apple-darwin` |
| `darwin-x64` | `x86_64-apple-darwin` |
| `linux-x64` / `linux-x64-musl` | `x86_64-unknown-linux-gnu` / `x86_64-unknown-linux-musl` |
| `linux-arm64` / `linux-arm64-musl` | `aarch64-unknown-linux-gnu` / `aarch64-unknown-linux-musl` |
| `win32-x64` | `x86_64-pc-windows-msvc` |

### `_server.json` schema the shell consumes (do not break)

Written by `apps/studio/server.ts` after the server binds:

```json
{ "pid", "port", "url": "http://localhost:<port>", "canvasOrigin"?: "http://localhost:<canvasPort>",
  "started", "project", "config_source" }
```

The shell treats this read-only. Any future field stays backwards-compatible (the consuming slash commands also read it).

## Consequences

- **Positive:** smallest possible shell; zero dev-server changes; reuses the whole collaboration backbone; clean signing/updater path for later phases.
- **Negative / accepted:** a Rust toolchain in CI + dev (the plan flags `cargo ≥ 1.77`); the sidecar binary must be built _before_ `tauri build` (order is load-bearing); the binary-rename step is a new release-pipeline responsibility.
- **Highest residual risk:** the DDR-063 cross-origin canvas iframe + its `postMessage` inspector channel must work inside WKWebView. If it breaks, the fix is a `sandbox="allow-same-origin allow-scripts"` on the iframe (a 2-line dev-server HTML-template change), **not** an architectural rethink. Verified in phase-26 Task 5.
- **`MAUDE_SKIP_RUNTIME_BUILD=1` discipline carries into the desktop CI** — the committed `dist/runtime/*.js` bundles ship as-is; regen in CI corrupts them (a known production-breaking mistake).

## Alternatives considered

- **Electron** — rejected on size (~120 MB) + second-Chromium maintenance/signing burden, for no offsetting benefit (we don't need bundled Node; the dev-server is already a standalone binary).
- **Rewrite the dev-server in-process (Tauri commands, no sidecar)** — rejected: throws away the DDR-009 compiled-binary investment, forces a Rust rewrite of yjs/Bun.build/HMR, and breaks the "non-shell user unaffected" invariant.
- **PWA / "open localhost in the default browser"** — rejected: no native chrome, no keychain, no signing/notarization, no auto-update, no single-instance — none of the distribution affordances the persona needs.

## Addendum (2026-06-16 — phase-26 dogfood)

Two adjustments after the first real `tauri dev` run on macOS:

1. **`maude://` deep-link deferred from phase-26 to phase-29.** The phase-26 plan called for registering the scheme with a no-op handler. In practice `tauri-plugin-deep-link` aborted in `did_finish_launching` (the AppKit Apple-Event open handler) when run as a **non-bundled `tauri dev` binary** — `panic_cannot_unwind` → `SIGABRT`. The scheme is only meaningful once the app is a signed `.app` bundle and the `open?path=` route exists (phase-29), so the plugin is removed for now rather than shipping a no-op that crashes.
2. **Sidecar spawns with `NO_OPEN=1`.** The dev-server's default boot behavior opens the system browser (`server.ts` honors `NO_OPEN`). In the shell the webview IS the UI, so a second browser window is wrong — the sidecar env suppresses it. The sidecar also passes through `MAUDE_CANVAS_ORIGIN_SPLIT` for WKWebView iframe debugging (DDR-063).
4. **Bundled `.app` ships the dev-server runtime as a resource + resolves it via `MAUDE_DEV_SERVER_ROOT`.** The `bun --compile` binary does NOT embed its served assets (`dist/client.bundle.js`, `dist/runtime/*.js`, `client/index.html`, `plugins/design/templates/_shell.html`) — it reads them from disk, resolving the root by walking up from `process.execPath` (paths.ts). Inside `Maude.app/Contents/MacOS/` that walk-up finds nothing → `boot-self-heal` exits 1 ("missing committed artifacts", `Looked under: /$bunfs/root`) → the canvas browser never loads. Fix (3 parts): (a) `paths.ts` honors a `MAUDE_DEV_SERVER_ROOT` env override (additive, checked before walk-up); (b) `scripts/stage-resources.mjs` + `tauri.conf.json` `bundle.resources` ship the **`apps/studio` source tree** + `plugins/design/templates` into `Resources/`, preserving the `apps/studio ↔ plugins/design/templates` `../../` relationship `TEMPLATES_DIR` needs (resource map dest = `apps/studio` / `plugins/design/templates`, since Tauri copies the source dir's *contents* into `Resources/<dest>`); (c) `sidecar.rs` sets `MAUDE_DEV_SERVER_ROOT` to the bundled `<resource_dir>/apps/studio` (probed via candidates). **It must be the SOURCE tree, not just `dist/`+`client/`:** canvases are built on-demand (`canvas-build.ts` → Bun.build) which resolves `@maude/canvas-lib` → `DEV_SERVER_ROOT/canvas-lib.tsx` and its sibling `.tsx` import graph from disk (react/motion externalized to the prebuilt `dist/runtime`, so no `node_modules` needed). Shipping only `dist/`+`client/` boots the canvas browser but every canvas open fails with "Importing a module script failed". Excluded: `node_modules`, the per-platform `dist/maude-*` build binaries, `.js.map`, `.compile-entries` → 30.4 MB `.dmg`. Verified: bundled-app smoke serves `/`, `/_client/client.bundle.js`, `/_canvas-runtime/react.js`, AND a canvas module build (`/.design/ui/Demo.tsx` → 200 `application/javascript`, resolved from the bundled `canvas-lib.tsx`) all 200. **The sidecar binary must be rebuilt from current source** (`bun run build.ts`) before bundling, or the override isn't compiled in — the CI workflow does this; a stale committed `dist/maude-<slug>` will silently ship without it.
3. **Project switching is IN-PROCESS, not `app.restart()`.** File ▸ Open Project… first used `app.restart()`; that reliably **SIGABRT-ed** — on a non-bundled `tauri dev` binary the relaunch + macOS "open" Apple Event aborts `tao` in `did_finish_launching` (`panic_cannot_unwind`; same signature the deep-link plugin also hit). Fix: `sidecar::switch_project` updates the (now `Mutex<String>`) `project_root`, kills the child so the supervisor respawns it with the new root, and re-navigates the webview once the fresh `_server.json` lands — no relaunch. Better UX (no window flash) and sidesteps the whole Apple-Event-on-launch class of crashes. `project_root` became mutable to support this.

## Addendum (2026-07-08 — Intel Mac support, universal binary)

The macOS `.dmg` shipped Apple-Silicon-only through phase-32 (a single `aarch64-apple-darwin` matrix leg). `feature-desktop-intel-mac-support` adds Intel support by building a **universal (arm64+x86_64) binary** (`tauri build --target universal-apple-darwin`) rather than a second matrix leg.

**Why not a second leg producing an Intel-only `.dmg`:** Tauri's `.app.tar.gz` updater artifact carries **no arch token** in its filename (confirmed from a local build artifact). Two matrix legs would each upload a file with that same name to the same GitHub Release via `softprops/action-gh-release@v2`, silently clobbering one arch's asset — and the site's own download/updater routes (`site/app/(home)/desktop/download/[platform]/route.ts`, `site/app/releases/[target]/[arch]/[current_version]/route.ts`) already assume exactly one macOS asset per release, first-match/fallback, no arch disambiguation. A universal binary sidesteps all of it: one `.dmg` / one `.app.tar.gz` per release, zero changes needed to either route.

**Landmine: Tauri does NOT auto-lipo `externalBin` sidecars.** The plan that scoped this feature assumed Tauri's universal-binary support would auto-fuse two staged arch-specific sidecar files (`maude-server-{aarch64,x86_64}-apple-darwin`) the way it fuses the main Rust binary. It doesn't — confirmed against `tauri-apps/tauri#3355` (`gh issue view 3355 --repo tauri-apps/tauri`): the main-binary auto-lipo is a `cargo`-level artifact of compiling the same crate for both arches in one invocation; `externalBin` sidecars are pre-built blobs Tauri just copies, and for `--target universal-apple-darwin` it looks for one **already-fused** binary literally named `<name>-universal-apple-darwin`, failing to bundle (`Failed to copy external binaries: resource path ... doesn't exist`) if that exact file isn't present. Discovered by running the plan's own Task 5 (local repro) *before* touching CI, per the plan's explicit ordering note — the first local build attempt failed with exactly that error.

**Fix:** stage both arches of every sidecar (`maude-server`, `agent-browser`) as before, then run `lipo -create` yourself before `tauri build`:

```bash
cd apps/desktop/src-tauri/binaries
lipo -create -output maude-server-universal-apple-darwin \
  maude-server-aarch64-apple-darwin maude-server-x86_64-apple-darwin
lipo -create -output agent-browser-universal-apple-darwin \
  agent-browser-aarch64-apple-darwin agent-browser-x86_64-apple-darwin
```

Verified locally: second build attempt succeeded; `lipo -info` on all three shipped binaries (`maude-desktop`, `maude-server`, `agent-browser`) reports `x86_64 arm64`; the `.app` boots and the dev-server sidecar serves correctly both natively (arm64) and under Rosetta (`arch -x86_64 ...`, from a non-symlinked path — a `/tmp`-mount launch trips Tauri's `StartingBinary` symlink guard on **either** arch, an unrelated pre-existing safety check, not an arch regression). **Takeaway for future sidecar work:** any project using `externalBin` + `--target universal-apple-darwin` must pre-lipo every sidecar itself; nothing in Tauri does it automatically, and the failure mode only surfaces at bundle time, not at `cargo build` time.
