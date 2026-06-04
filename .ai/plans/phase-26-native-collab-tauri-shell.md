# Phase 26 — Native Maude: Tauri shell + sidecar lifecycle

Validate docs and codebase patterns before implementing. Pay attention to the binary-resolution path (DDR-009/084), real-disk paths (DDR-045), canvas-origin split (DDR-063), and the canvas-origin gate tests.

## Description

Wrap the existing Maude dev-server in a **Tauri v2 native app** so users can install `Maude.app` and open canvases without a terminal. The shell spawns the already-compiled Bun dev-server binary as a Tauri sidecar, manages its lifecycle, and loads the existing canvas UI in the OS webview. Nothing in the dev-server changes — the shell is a pure distribution + process-lifecycle layer on top.

**Phase milestone:** A signed macOS `.dmg` that non-technical users can install, double-click, and see their canvases — no terminal, no `npm install`, no `maude design serve`.

## User Story

As a non-technical collaborator, I want to install one app and see my design canvases open immediately, so that I never have to touch a terminal or know that Bun exists.

## Problem

Today Maude requires `maude design serve` from a terminal and a browser open to `localhost:4399`. There is no native app, no installer, no auto-update. The target audience (PMs, designers, founders) is excluded by this.

## Solution

Tauri v2 app in `apps/desktop/`:
1. On launch: spawn the compiled dev-server binary as a Tauri `externalBin` sidecar with `--root <project>`.
2. Poll `<designRoot>/_server.json` for the port, then open the webview at that URL.
3. On quit: kill the sidecar. On crash: respawn.
4. CI produces a signed macOS `.dmg` (Windows signing deferred to phase-32).

The webview shows the existing Maude UI unchanged — no new client code in this phase.

## Metadata

- **Type:** New Capability
- **Complexity:** High (Rust/Tauri toolchain, cross-platform CI, new `apps/desktop/` workspace)
- **App/Package:** new `apps/desktop/` (Tauri v2) — no changes to `plugins/design/dev-server/` or `cli/`
- **Affected Systems:** CI (`build-binaries.yml`), release flow (`bump-version.sh`)
- **Dependencies (new):** Rust toolchain (cargo ≥ 1.77), Tauri CLI v2, `tauri-plugin-shell` v2

---

## Phase roadmap (26–32)

| Phase | What ships |
| --- | --- |
| **26 (this)** | Tauri shell — install Maude.app, open canvases, no terminal |
| **27** | In-UI git — Changes panel, "Save version", visual diff, history |
| **28** | GitHub identity — "Sign in with GitHub" OAuth, create/clone repo, invite collaborator |
| **29** | Onboarding + repo/branch switcher — first-run wizard, zero-terminal path for non-technical users |
| **30** | Live multiplayer + artboard locking — 3-lane collab model live, hub UI realignment |
| **31** | ACP sidepanel — right-side chat panel to local Claude Code (de-icebox phase-7) |
| **32** | Distribution — auto-update, Windows signing, download page, crash reporting |

---

## Context References

### Must-Read Files

> Read in parallel at `/flow:execute` start.

- `.ai/docs/epic-native-collab-app.md` — full architecture, reuse inventory, all decisions. **Read the "Context References → Must-Read Files" section** before touching any dev-server code.
- `.ai/docs/collab-model-design.md` — 3-lane collaboration model + UX mental model. Informs Task 1 (DDRs) and any UI copy.
- `cli/commands/design.mjs` (`runServe`, `resolveServerBinary`, `lazyResolveBinary`, `MAUDE_DEV_SERVER_BIN`) — **exact binary resolution the sidecar must mirror** (DDR-084).
- `plugins/design/dev-server/server.ts` lines 1–60 — port resolution, `_server.json` write schema `{pid,port,url,started}`. The shell polls this file to know when to open the webview.
- `plugins/design/dev-server/paths.ts` — DDR-045: disk paths inside compiled binaries. Sidecar runs as a compiled binary; any Rust-side path logic must not assume source-relative layout.
- `plugins/design/dev-server/boot-self-heal.ts` — first-launch `bun install --production` + `build.ts`. The shell wraps this with a native splash "Preparing Maude…" while self-heal runs.
- `.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md` + `DDR-084-server-up-boots-compiled-binary.md` — binary build/boot model.
- `.ai/decisions/DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md` — **canvas iframe is cross-origin by default**. Task 4 must verify this works in WKWebView. Highest-risk detail.
- `.ai/decisions/DDR-054-linked-mode-trust-model-and-task-4-hardening.md` — iframe sandbox/CSP model.
- `plugins/design/dev-server/build.ts` (`bun run build:binary`) — produces the per-platform compiled binary the sidecar bundles.
- `.github/workflows/build-binaries.yml` — existing CI; Task 7 extends it for Tauri.

### Files to Create

- `apps/desktop/` — Tauri v2 project root
- `apps/desktop/src-tauri/` — Rust core (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`)
- `apps/desktop/src-tauri/src/sidecar.rs` — sidecar spawn/lifecycle/kill logic
- `apps/desktop/src-tauri/src/server_json.rs` — poll `_server.json` to discover port
- `apps/desktop/package.json` — minimal JS glue (Tauri CLI, vite if needed)
- `.github/workflows/build-desktop.yml` — macOS `.dmg` build + notarization

### Design canvases

No canvas matched `native-collab` or `tauri`. No UI surfaces are net-new in this phase (webview shows the existing canvas browser). `/design:new` is deferred to phases 27–29 (git panel, onboarding wizard — those have new screens that need design first).

### Documentation

- [Tauri v2 sidecar guide](https://v2.tauri.app/develop/sidecar/) — `externalBin`, `bundle.externalBin`, `Command::sidecar`, permissions. Why: the entire spawn mechanism.
- [Tauri v2 `tauri-plugin-shell`](https://github.com/tauri-apps/tauri-plugin-shell) — required for sidecar spawn in v2 (replaced v1's built-in shell). Why: Task 3.
- [Tauri v2 webview CSP config](https://v2.tauri.app/security/csp/) — `app > security > csp` in `tauri.conf.json`. Why: Task 4 (cross-origin iframe).
- [Tauri v2 code signing + notarization (macOS)](https://v2.tauri.app/distribute/sign/macos/) — Apple Developer ID, notarytool. Why: Task 7.
- [Tauri v2 `tauri-plugin-single-instance`](https://github.com/tauri-apps/tauri-plugin-single-instance) — prevent duplicate windows. Why: Task 3.

### Patterns to Follow

**Binary resolution (mirror `design.mjs` exactly):**
```js
// cli/commands/design.mjs — resolveServerBinary
const MAUDE_DEV_SERVER_BIN = process.env.MAUDE_DEV_SERVER_BIN
const bin = MAUDE_DEV_SERVER_BIN ?? path.join(pluginRoot, 'dev-server/bin/server-<platform>')
```
The Rust sidecar must find this same binary. In `tauri.conf.json`:
```json
{ "bundle": { "externalBin": ["../plugins/design/dev-server/bin/server"] } }
```
Tauri appends the platform triple automatically (`-x86_64-apple-darwin`, etc.).

**`_server.json` polling (mirror `server-up.sh`):**
Poll `<designRoot>/_server.json` every 200 ms for up to 10 s; on success read `{port}` and open `http://127.0.0.1:{port}` in the webview. On timeout: show error overlay.

**Security: loopback-only.** The webview must only ever load `http://127.0.0.1:<port>` — never a remote URL. CSP: `default-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; frame-src http://127.0.0.1:*`. The canvas iframe (cross-origin, DDR-063) is `http://127.0.0.1:<canvas-port>` — verify it loads in WKWebView.

---

## Design Decisions

No net-new UI in this phase (the webview renders the existing Maude client unchanged). Design work begins in phase-27 (git panel) and phase-29 (onboarding wizard) — those phases run `/design:new` before implementation.

---

## Tasks

Execute in order. Tasks 1–2 are prerequisites; Tasks 3–6 can overlap once Task 2 boots.

### Task 1: Write founding DDRs

- **Do:** Write 5 DDRs in `.ai/decisions/` (next free numbers after DDR-088). These decisions are already made (see epic + `collab-model-design.md`); this task formalizes them so all future phases have a stable reference:
  1. **Tauri v2 shell architecture** — sidecar-over-compiled-binary model, lifecycle (spawn / poll `_server.json` / webview-open / kill-on-quit / respawn-on-crash), webview CSP, why Tauri over Electron (~10 MB vs ~120 MB, OS webview, mature signing/updater).
  2. **Git engine: isomorphic-git** — pure-JS, zero system-git dep; detect+prefer system git when present; Bun-compatible; LFS/large-file caveat documented.
  3. **GitHub auth: OAuth device flow** — "Sign in with GitHub" in system browser → OS keychain; scopes (`repo`, `read:user`); GitHub App deferred for org installs.
  4. **Native-shell security model** — loopback-only sidecar; strict CSP; `maude://` deep-link allowlist; secrets in keychain (never in `_server.json` / `.design/`).
  5. **Three-lane collaboration model + mental model** — git = canvas distribution (push→pull, no cold-start); Yjs = live overlay (comments/annotations/presence, shipped); artboard locking = code-body lane (soft single-writer, no CRDT merge for TSX); UX vocabulary contract (see `collab-model-design.md`). Cross-link DDR-051/054/064/076.
- **Gotcha:** Take the next free DDR numbers (check `ls .ai/decisions/DDR-*.md | sort -V | tail -1`). Cross-link each DDR from `epic-native-collab-app.md`'s "DDRs to record in E0" table.
- **Validate:** 5 DDR files exist, numbered, cross-linked from the epic.

### Task 2: Scaffold `apps/desktop/` Tauri v2 project

- **Do:** Run `pnpm create tauri-app` inside `apps/desktop/` (or `cargo tauri init`). Target: minimal Tauri v2 app with:
  - `src-tauri/Cargo.toml` — deps: `tauri`, `tauri-plugin-shell`, `tauri-plugin-single-instance`, `serde`, `serde_json`
  - `src-tauri/tauri.conf.json` — `productName: "Maude"`, `version` from root `package.json`, `bundle.identifier: com.maude.app`, `bundle.externalBin` pointing at the dev-server binary
  - `src-tauri/src/main.rs` + `lib.rs` — Tauri builder + plugin registration
  - `apps/desktop/package.json` — `@tauri-apps/cli` dev dep, `tauri dev` + `tauri build` scripts
- **Pattern:** Keep Rust code minimal — Tauri is the framework; business logic goes in `sidecar.rs` + `server_json.rs` (next task), not in `main.rs`.
- **Gotcha:** Tauri v2 uses a plugin system — `tauri-plugin-shell` (for `Command::sidecar`) must be registered in both `Cargo.toml` AND `lib.rs` (`Builder::plugin(tauri_plugin_shell::init())`). Missing either = runtime panic, no compile error.
- **Validate:** `cd apps/desktop && pnpm tauri dev` opens an empty Tauri window without errors.

### Task 3: Wire the sidecar + lifecycle

- **Do:** Implement `apps/desktop/src-tauri/src/sidecar.rs`:
  - `spawn_server(app: &AppHandle, project_root: PathBuf) -> Result<Child>` — calls `Command::sidecar("server")` with args `["--root", project_root]`, captures stdout/stderr, returns the child.
  - `kill_server(child: &mut Child)` — SIGTERM → 2 s wait → SIGKILL.
  - On `window-destroyed` (app quit): call `kill_server`. On child exit with non-zero: respawn up to 3 times with exponential backoff.
  - Single-instance: `tauri-plugin-single-instance` prevents duplicate windows (second launch focuses the existing one instead).
  - The `project_root` for phase-26 = the directory the user dropped onto the app, or the last-used project stored in `AppData` (simple JSON file). Full project-picker UI is phase-29.
- **Gotcha:** On macOS, `tauri.conf.json` → `bundle.externalBin` paths must match **exactly** including the platform triple Tauri appends. Build the binary first (`cd plugins/design/dev-server && bun run build:binary`) and confirm the file exists at the expected path before wiring.
- **Validate:** Launch the app → dev-server binary spawns (verify with `pgrep -f "maude.*server"`); quit the app → process exits within 3 s.

### Task 4: Poll `_server.json` and open the webview

- **Do:** Implement `apps/desktop/src-tauri/src/server_json.rs`:
  - `wait_for_server(design_root: &Path, timeout_ms: u64) -> Result<u16>` — reads `<design_root>/_server.json` every 200 ms until `port` field is present or timeout (10 s). Returns the port.
  - In `lib.rs` app setup: after spawning the sidecar, call `wait_for_server`, then `window.navigate(format!("http://127.0.0.1:{port}"))`.
  - Show a native splash / loading label ("Starting Maude…") while waiting; replace with the webview on success; show an error panel on timeout.
- **Gotcha:** `_server.json` is written by the dev-server's boot-self-heal path (DDR-044), not immediately on launch. The self-heal runs `bun install --production` + `bun run build.ts` on first launch — this can take 30–90 s. Set `timeout_ms = 120_000` for first-run; subsequent launches are < 2 s.
- **Validate:** Cold-launch the app → see "Starting Maude…" → canvas browser loads in the webview.

### Task 5: CSP + cross-origin iframe verification

- **Do:** Set `tauri.conf.json` → `app.security.csp`:
  ```
  default-src 'self' http://127.0.0.1:* ws://127.0.0.1:*;
  frame-src http://127.0.0.1:*;
  script-src 'self' 'unsafe-inline' http://127.0.0.1:*;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: http://127.0.0.1:* assets:;
  connect-src http://127.0.0.1:* ws://127.0.0.1:*;
  ```
  Verify in WKWebView (macOS) that:
  - The canvas browser UI loads (React + motion).
  - The cross-origin canvas iframe (DDR-063 split) loads — `http://127.0.0.1:<canvas-port>` inside the main frame.
  - HMR WebSocket connects and live-reloads work when a `.tsx` is edited.
  - The iframe's `postMessage` inspector channel (Cmd+Click element selection) works.
- **Gotcha:** WKWebView treats two different ports on `127.0.0.1` as cross-origin. The `frame-src http://127.0.0.1:*` covers this, but `postMessage` + `window.opener` might still be restricted. If the inspector channel breaks, add `allow-same-origin allow-scripts` to the iframe's sandbox attribute in the dev-server's HTML template (not in the CSP — CSP can't grant iframe permissions, only the `sandbox` attribute can).
- **Validate:** Open a multi-artboard canvas; Cmd+Click an element → inspector shows the element path. Edit `.tsx` → HMR reloads the canvas in the webview without a full page refresh.

### Task 6: Native chrome — OS menus, window, deep links

- **Do:**
  - `tauri.conf.json` → `app.windows[0]`: `title: "Maude"`, `minWidth: 1024`, `minHeight: 680`, `decorations: true`.
  - OS menu bar: `File > Open Project…` (opens a folder picker → sets `project_root`), `File > Quit` (`Cmd+Q`). `Help > About Maude` (version from `package.json`). Keep it minimal — full menu comes in later phases.
  - `maude://` deep-link scheme: register in `tauri.conf.json` → `bundle.macOS.urlSchemes: ["maude"]`. Handle `maude://open?path=<url-encoded-path>` to open a project (used later by the CLI and phase-29 onboarding). No-op handler is fine in phase-26.
- **Gotcha:** macOS Gatekeeper requires the app to be notarized for end-users to open it without right-click. For development, `xattr -cr Maude.app` bypasses it. Full notarization is Task 7 (CI).
- **Validate:** `Cmd+Q` quits cleanly (sidecar killed, no orphan processes). `File > Open Project…` shows a folder picker.

### Task 7: CI — macOS `.dmg` build

- **Do:** Create `.github/workflows/build-desktop.yml`:
  - Trigger: `v*` tags (same as `build-binaries.yml`) + `workflow_dispatch`.
  - Matrix: `macos-latest` only (Windows/Linux in phase-32).
  - Steps: install Rust stable, install Tauri CLI, build the dev-server binary first (`cd plugins/design/dev-server && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build:binary`), then `pnpm tauri build`.
  - Code-signing: use `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` + `APPLE_SIGNING_IDENTITY` secrets (same pattern as the existing `build-binaries.yml`). Notarization: `APPLE_ID` + `APPLE_TEAM_ID` + `APPLE_PASSWORD` secrets via `notarytool`.
  - Upload `.dmg` as a GitHub Release asset alongside the existing CLI artifacts.
  - **`MAUDE_SKIP_RUNTIME_BUILD=1` is mandatory** (per CLAUDE.md — the committed runtime bundles ship as-is; regen in CI corrupts them).
- **Gotcha:** `pnpm tauri build` resolves `externalBin` at build time — the binary must already exist at the declared path when Tauri bundles the app. Order matters: build dev-server binary → build Tauri app.
- **Validate:** Tag `v0.29.0-desktop-alpha` → CI produces `Maude_0.29.0_x64.dmg` in the release assets. Download + install on a fresh macOS machine → canvases load without a terminal.

---

## Validation

1. **Rust compile:** `cd apps/desktop && cargo check` — zero errors.
2. **pnpm build:** `pnpm --filter @maude/desktop tauri build` — succeeds, `.dmg` produced.
3. **Sidecar lifecycle:** launch → dev-server spawns; quit → no orphan processes (`pgrep -f "server"` empty); kill sidecar externally → respawns within 3 s.
4. **Webview render:** canvas browser loads; multi-artboard canvas renders; Cmd+Click inspector works; HMR works.
5. **Cross-origin iframe:** DDR-063 split canvas loads inside the webview; no CSP console errors.
6. **Zero regression to CLI/plugin paths:** `node cli/bin/maude.mjs design serve` still works standalone; dev-server tests `bun test` still green; existing CI `build-binaries.yml` unaffected.
7. **Scenario (manual — no agent-device for desktop yet):** fresh macOS install → double-click `Maude.app` → canvas browser opens → open one of `.design/ui/*.tsx` → artboard renders. Record screen for PR.

> **N/A (justified):** 5-platform `scenario-runner` + `a11y-auditor` + `design-system-guard` — phase-26 ships no net-new UI screens; the canvas browser is unchanged. Automated cross-platform UI validation applies from phase-27 onwards when new panels are added.

---

## Acceptance Criteria

- [ ] 5 DDRs written and cross-linked (Task 1)
- [ ] `apps/desktop/` scaffolded, `pnpm tauri dev` opens a window (Task 2)
- [ ] Sidecar spawns on launch, killed on quit, respawns on crash (Task 3)
- [ ] Webview loads the canvas browser from `_server.json` port (Task 4)
- [ ] Cross-origin canvas iframe + HMR + inspector all work in WKWebView (Task 5)
- [ ] OS menus + `maude://` deep-link scheme registered (Task 6)
- [ ] CI produces a signed + notarized macOS `.dmg` on `v*` tag (Task 7)
- [ ] Zero regression: dev-server tests green, existing CLI paths work, `build-binaries.yml` unaffected
- [ ] Roadmap regen: `pnpm --filter @maude/site gen:roadmap` run with this plan added

## Risks

- **WKWebView + cross-origin iframe (DDR-063):** the highest-risk item. If the `postMessage` inspector channel breaks, the fix is a `sandbox="allow-same-origin allow-scripts"` on the iframe — a 2-line change in the dev-server's HTML template, not an architectural rethink.
- **Rust/Cargo toolchain unfamiliarity:** budget extra time for first `cargo build` (downloads deps). Isolated to `apps/desktop/src-tauri/`; if Rust proves too slow for iteration, the Tauri JS-API bindings let most logic stay in JS.
- **Code-signing secrets:** Apple Developer ID + notarization credentials must be in GitHub Secrets before Task 7 produces a distributable `.dmg`. Development builds (unsigned) can ship first; signing is the last task.
- **`MAUDE_SKIP_RUNTIME_BUILD=1` discipline:** if this flag is missed in the CI step, the CI will regenerate unminified dev bundles and overwrite the committed `dist/runtime/*.js` — a known production-breaking mistake (per CLAUDE.md).
