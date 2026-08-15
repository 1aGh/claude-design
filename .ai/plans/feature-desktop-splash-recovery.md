# Feature: Desktop splash self-recovery + back-navigation hardening

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Status (2026-08-14)

**Tasks 1, 2, 5, 6 have SHIPPED** — the reported bug is fixed and covered by a
proven red→green regression test. Tasks 3 and 4 remain as optional hardening
follow-ups; neither is needed for the reported failure.

| Task | State | Note |
| ---- | ----- | ---- |
| 1 — `resolve_dev_server_url` command | ✅ done | plus the hand-authored permission toml + capability entry the ACL codegen needs |
| 2 — self-healing splash script | ✅ done | the primary fix; covers every return-to-entry trigger |
| 3 — WKWebView gesture disable + `Cmd+[` intercept | ⏸ follow-up | needs `objc2` promoted to a DIRECT dep (touches `Cargo.lock`). Task 2 already recovers from this trigger, and `location.replace()` means there is no splash entry in history to go back to at all |
| 4 — Rust-side return-to-splash watchdog | ⏸ follow-up | belt-and-braces for a wedged page-side script; must arm only AFTER the first successful navigate |
| 5 — E2E regression scenario | ✅ done | `splash-recovers-after-return-to-entry.e2e.ts`, proven red pre-fix and green post-fix |
| 6 — Rust unit tests | ✅ done | 5 tests on the loopback validation + `wait_for_server` |

**One correction to Task 5's plan below, learned by running it:** the scenario
must simulate the crash-reload by navigating straight at `tauri://localhost`,
**not** via `history.back()`. Once the fix is in, `history.back()` can no longer
reach the splash at all — `location.replace()` overwrites the splash's own
history entry — so a history-based reproduction goes green vacuously. That
property is now pinned by its own test.

## Description

The desktop shell's entry document (`apps/desktop/src/index.html`) is a static, JS-free boot splash. The Rust side navigates the webview away from it exactly once, at startup (`apps/desktop/src-tauri/src/lib.rs:542-564`). Any event that returns the webview to that entry document — a WKWebView content-process crash/reload (which always reloads the window's *original* URL), an uncaught back-navigation gesture, or `Cmd+[`/`Cmd+←` — stands there forever: the splash has no JS, so it can't detect it's stuck and re-navigate itself. The user's only recovery is a force-quit.

This plan makes the splash self-healing (works for *any* return-to-splash trigger, known or not) and closes the specific back-navigation door as defense-in-depth, per the RCA already produced for issue #92.

## User Story

As a Maude desktop user, when the app's content process crashes or reloads mid-session, I want the app to recover to the working UI within a couple of seconds, so that I never have to force-quit and lose my session.

## Problem

- `apps/desktop/src/index.html` is pure static markup — no script, no polling, no way to detect "I am wedged."
- The only navigate-away-from-splash code path (`lib.rs:542-564`) runs once, at process startup, driven by `tauri::async_runtime::spawn`. Nothing re-arms it later.
- A second navigate site exists (`sidecar.rs` `switch_project`, ~583-600) but only fires on an explicit user-initiated project switch — it doesn't help an involuntary return to the splash.
- One trigger is already covered: `apps/studio/client/app.jsx:13688-13713` prevents `Backspace`/`Delete` from falling through to WKWebView back-navigation when focus is on shell chrome. Its own comment names this exact failure mode ("dogfood crash"). That guard:
  - only fires when the **shell window**, not the canvas iframe, has focus (a keydown inside the untrusted canvas iframe never reaches the shell's `window` listener);
  - doesn't cover `Cmd+[`, `Cmd+←`, or the macOS two-finger swipe-back trackpad gesture — none of which is a `keydown` at all;
  - does nothing for the reporter's actual trigger ("command finished, then it went black"), which is the content-process-crash/reload path, not a keyboard event.
- Net effect: the app's usability rests on an **unenforced invariant** — "the webview must never navigate back to its entry document" — with only one of several return paths guarded, and the highest-severity one (crash/reload) not guarded at all.

## Solution

Two layers, ordered by how directly each addresses the reported trigger:

1. **Splash self-recovery (primary fix, covers every trigger).** Give `index.html` a small inline script that, on load, asks Rust (via a new narrow Tauri command) for the current dev-server URL and navigates there itself, retrying with backoff, with a visible "stuck" fallback after ~10s. This makes *any* return to the splash — known trigger or not — a ~1s blip instead of a dead app. URL selection and the DDR-109 loopback validation stay in Rust; the page only ever receives an already-validated `http://localhost:*`/`http://127.0.0.1:*` string, never chooses or constructs one.
2. **Close the back-navigation door (defense-in-depth for the one trigger we can name).** Disable the WKWebView back/forward swipe gesture and intercept `Cmd+[`/`Cmd+←` at the window level, so the existing `app.jsx` keydown guard stops being the *only* line of defense against that specific trigger.

A Rust-side watchdog (re-navigate on landing back on the bundled-asset origin) is included as an explicit, separately gated task — see the Risk note under Task 4 on why it is scoped narrower than the issue's original wording.

### Why not the issue's Task 3 as originally worded

The issue proposes an `on_page_load`/navigation handler in `lib.rs` that "re-navigates whenever the webview lands on the bundled asset origin after startup." Taken generically, this event fires on *every* load including the legitimate first-boot splash display before the first navigate — a naive version would race the startup navigate itself. Task 4 below scopes it to fire only *after* the first successful navigate away from the splash has been observed (i.e., it detects a *return*, not the initial *arrival*), which is what the issue's intent actually requires. Flagging this now so the implementer doesn't reproduce the race.

## Metadata

- **Ticket**: GitHub #92 — desktop "Starting…" hang after a command finishes (dogfood, 2026-08-12)
- **Type**: Bug Fix (with a small new IPC surface)
- **Complexity**: Medium
- **App/Package**: `apps/desktop` (`src/index.html`, `src-tauri/src/lib.rs`, `src-tauri/src/server_json.rs`, `e2e/`)
- **Affected Systems**: Tauri native shell (Rust), the boot splash (static HTML → gains inline JS), desktop E2E harness
- **Dependencies**: none required for Task 1–2 (reuses existing `server_json` module + registers a plain Rust command). Task 3 (WKWebView gesture disable) likely requires promoting the already-transitive `objc2`/`objc2-app-kit` crates to **direct** `Cargo.toml` dependencies — see the Risk note under Task 3, this touches `Cargo.lock`, a guard-listed lockfile in the automated fix-bot pipeline; a human must land that specific task.

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message before starting Task 1.

- `apps/desktop/src/index.html` — the static splash to instrument; currently zero JS.
- `apps/desktop/src-tauri/src/lib.rs` (lines 395-430 `invoke_handler` registration; 511-564 the one-shot startup navigate; 589-597 `on_window_event`; 599-618 WebDriver/run loop) — where the new command is registered and where the watchdog hook attaches.
- `apps/desktop/src-tauri/src/server_json.rs` — `wait_for_server` (polls `_server.json`) and `is_loopback_url` (DDR-109 §1 enforcement) — the two functions the new command wraps. Do not duplicate their logic; call them.
- `apps/desktop/src-tauri/src/sidecar.rs` (~lines 583-600, `switch_project`) — the second, explicit navigate site; confirms the one-shot invariant is truly the only other navigate path.
- `apps/studio/client/app.jsx:13688-13713` — the existing shell-level Backspace/Delete guard and its "dogfood crash" comment. Task 3's window-level interception must sit *alongside* this, not replace it (element-focused Backspace/Delete still needs the in-canvas handling this guard defers to).
- `apps/desktop/src-tauri/tauri.conf.json` — current window config (`app.windows[0]`, no back/forward gesture setting exists anywhere here); confirms Task 3 needs a runtime API call, not a config flag.
- `apps/desktop/e2e/scenarios/backspace-no-active-canvas-no-hang.e2e.ts` — the existing E2E regression test for the *keyboard* trigger of this same failure mode. Mirror its structure (report/capture calls, `isNativeShell()` gate, asserting the webview URL stays on `http://localhost|127.0.0.1:*`) for the new splash-recovery test rather than inventing a new pattern.
- `apps/desktop/e2e/helpers/native.ts`, `apps/desktop/e2e/helpers/sidecar.ts`, `apps/desktop/e2e/helpers/evidence.ts` — shared E2E helpers (`isNativeShell`, `waitForSidecar`, `capture`/`startReport`) the new scenario will reuse.
- `.ai/archive/decisions/DDR-109-native-shell-security-model.md` — §1 loopback-only invariant; the new command must not weaken it (it must return an already-validated URL, never accept one from the page).
- `apps/desktop/src-tauri/src/notify.rs:441-`, `apps/desktop/src-tauri/src/oauth.rs:436-` — existing `#[cfg(test)] mod tests` idiom in this crate; mirror for the new `is_loopback_url`-adjacent unit test.

### Files to Create

- None as new files — all changes land in existing files listed above, plus one new E2E spec: `apps/desktop/e2e/scenarios/splash-recovers-after-return-to-entry.e2e.ts`.

### Documentation

- [Tauri v2 — `WebviewWindow::navigate` / `on_navigation`](https://v2.tauri.app/reference/rust/tauri/webview/struct.WebviewWindow.html) — Why: confirm whether a navigation/page-load hook can be attached to a window declared via `tauri.conf.json`'s `app.windows[]` array (as "main" is here) at runtime, or whether it requires rebuilding window creation through `WebviewWindowBuilder` in `setup()`. This is a genuine open question the plan can't resolve from the repo alone — first sub-task of Task 4.
- [Tauri v2 — `WebviewWindow::with_webview`](https://v2.tauri.app/reference/rust/tauri/webview/struct.WebviewWindow.html#method.with_webview) — Why: the documented escape hatch for platform-native webview access (macOS `WKWebView` pointer), needed for Task 3's `allowsBackForwardNavigationGestures = false`.

### Patterns to Follow

Existing one-shot navigate + DDR-109 validation (`lib.rs:542-564`) — the new command's Rust body should be a thin async wrapper around exactly this pattern, not a reimplementation:

```rust
match server_json::wait_for_server(design_root, SERVER_WAIT_MS).await {
    Ok(url) => match url.parse::<tauri::Url>() {
        Ok(parsed) if server_json::is_loopback_url(&parsed) => Ok(parsed.to_string()),
        Ok(parsed) => Err(format!("refusing non-loopback url (DDR-109): {parsed}")),
        Err(e) => Err(format!("invalid server url {url}: {e}")),
    },
    Err(e) => Err(e),
}
```

Existing E2E regression-test shape (`backspace-no-active-canvas-no-hang.e2e.ts`) — doc comment naming the exact hang this guards against + a link to the RCA, `isNativeShell()` gate, `waitForSidecar()`, `capture()` calls at each step, and the tell-tale assertion (`urlAfter` matches `http://(localhost|127.0.0.1):\d+`, not a `file://` splash URL).

---

## Tasks

Execute in order. Each task is atomic and testable. Task 1 alone fixes the reported bug; Tasks 2-4 are hardening layers and may ship as follow-ups if Task 1 needs to land first.

### Task 1: ADD a narrow `resolve_dev_server_url` Tauri command

- **Do**: In `apps/desktop/src-tauri/src/lib.rs` (or a new small module if preferred — `server_json.rs` already holds the logic it wraps), add an async `#[tauri::command]` that calls `server_json::wait_for_server` + `server_json::is_loopback_url` exactly as the existing startup navigate does (see Pattern above), returning `Result<String, String>`. Register it in the `invoke_handler(tauri::generate_handler![...])` list (`lib.rs:405-430`). It must take **no arguments from the page** — the URL is always derived server-side from `_server.json`, never accepted as input, so it cannot become an open-navigate primitive.
- **Pattern**: `lib.rs:542-564` (the startup navigate); `server_json.rs` (`wait_for_server`, `is_loopback_url`).
- **Gotcha**: reuse the same `design_root`/`project_root` resolution the startup path uses (`resolve_project_root`) — don't hardcode a path. Keep the timeout shorter than `SERVER_WAIT_MS` (that constant is sized for cold start / first-run bun install; a *recovery* poll should time out faster, e.g. a few seconds per attempt, since the server is normally already up).
- **Validate**: `cd apps/desktop/src-tauri && cargo build`

### Task 2: UPDATE `apps/desktop/src/index.html` — self-healing splash script

- **Do**: Add an inline `<script>` (CSP already allows `'unsafe-inline' http://localhost:*` for `script-src`, per DDR-109 — confirm the splash's own origin is covered, it's the bundled `asset://`/`tauri://` origin, not `http://localhost`, so verify CSP `default-src 'self'` permits the inline script to *call* `window.__TAURI__.core.invoke` — check against the current `tauri.conf.json` CSP string, don't assume). On load: `invoke('resolve_dev_server_url')`, and on success `window.location.replace(url)` (not `.href`, to avoid adding a splash entry to session history that a future back-nav could return to); on failure, retry with backoff (e.g. 300ms → 600ms → 1200ms, capped) up to the ~10s mark.
- **Pattern**: none in-repo (first JS in this file) — keep it minimal, no framework, matching the file's current plain-HTML style.
- **Gotcha**: `withGlobalTauri: true` is already set in `tauri.conf.json`, so `window.__TAURI__` is available without an extra script tag. Guard against `window.__TAURI__` being undefined (e.g. if this HTML is ever opened outside the Tauri shell) with a no-op fallback so it doesn't throw.
- **Validate**: manual — `pnpm --filter @1agh/maude-desktop tauri dev` (or the app's actual dev script), then in devtools navigate the webview back to the bundled `index.html` at runtime and confirm it self-navigates back to the dev-server URL within ~2s.

### Task 3 (hardening, may need a human hand-off — see Dependencies): UPDATE `lib.rs` — disable WKWebView back/forward gestures + intercept `Cmd+[`/`Cmd+←`

- **Do**: Using `WebviewWindow::with_webview` (macOS-only, gate with `#[cfg(target_os = "macos")]`), reach the native `WKWebView` and set `allowsBackForwardNavigationGestures = false`. Separately, add a window-level (Rust-side, not `app.jsx`-side) shortcut interception for `Cmd+[` / `Cmd+←` so it's caught even when focus is inside the untrusted canvas iframe (which `app.jsx`'s `window` keydown listener can never see).
- **Pattern**: no existing `with_webview`/objc usage in this crate to mirror — this is new native-FFI surface for `apps/desktop`. Follow the transitive `objc2`/`objc2-app-kit` crate versions already pinned in `Cargo.lock` (`objc2 = "…"`, `objc2-app-kit = "…"`) rather than picking arbitrary new versions, to avoid an unrelated dependency-graph bump.
- **Gotcha / Risk**: `objc2`/`objc2-app-kit` are currently only **transitive** dependencies (via `tauri`/`wry`); calling their APIs directly requires promoting them to **direct** `Cargo.toml` dependencies, which changes `Cargo.lock`. In this repo's automated fix-bot pipeline, `Cargo.lock` is a guard-listed lockfile no `quick`/`bug` tier run may touch — **this task needs a human to land**, or an alternative that avoids a new direct dependency (e.g. checking whether a newer `tauri-plugin-*` already wraps this before hand-rolling the objc2 call — re-check the Tauri plugin ecosystem at implementation time, it moves fast). Scope this task to macOS only; the app currently ships only a macOS bundle config (`tauri.conf.json` → `bundle.macOS`, `entitlements.plist`), so no Windows/Linux equivalent is in scope now.
- **Validate**: `cargo build`, then manual macOS trackpad two-finger-swipe-back test + `Cmd+[` in a running dev build — confirm neither reaches WebKit's default back-navigation.

### Task 4 (hardening): ADD a return-to-splash watchdog in `lib.rs`

- **Do**: First resolve the open question in **Documentation** above — whether a navigation/page-load hook can attach to the config-declared "main" window at runtime, or whether "main" needs to move to a `WebviewWindowBuilder` in `setup()` to get `.on_navigation()`/`.on_page_load()`. Once resolved: after the **first successful** startup navigate (i.e., only arm the watchdog once we've confirmed we left the splash at least once — see "Why not the issue's Task 3 as originally worded" above), register a handler that detects the webview URL matching the bundled-asset origin again and calls the same `resolve_dev_server_url` + navigate logic as Task 1, server-side this time (belt-and-suspenders in case the page-side JS itself is what's wedged, e.g. mid-crash).
- **Pattern**: `lib.rs:589-597` `on_window_event` — same builder-chain location, different event type.
- **Gotcha**: must NOT fire before the first navigate (see the race note above) — gate on a simple `AtomicBool`/state flag flipped once inside the existing Task 1/startup navigate success arm.
- **Validate**: `cargo build`; E2E scenario in Task 5 should pass whether recovery comes from the page-side script (Task 2) or this watchdog — consider a variant that disables/delays the page script via devtools to prove the Rust-side path alone also recovers, if the WebDriver harness allows injecting that state (evaluate feasibility at implementation time; not a blocker for the main scenario).

### Task 5: CREATE `apps/desktop/e2e/scenarios/splash-recovers-after-return-to-entry.e2e.ts`

- **Do**: Mirror `backspace-no-active-canvas-no-hang.e2e.ts`'s structure. After the app boots and the dev-server URL is confirmed (`waitForSidecar()`), programmatically navigate the webview back to the bundled `index.html` (WebdriverIO `browser.url('...')` or `browser.navigateTo` to the file/asset URL the splash actually ships at — determine the exact scheme, `tauri://`/`asset://`/`file://`, from a manual run first) to simulate the crash-reload return-to-splash. Assert the webview URL returns to `http://(localhost|127\.0\.0\.1):\d+` within a bounded timeout (a few seconds, generous enough for the retry/backoff in Task 2), and that `[data-testid="canvas-list"]` reappears and is interactive.
- **Pattern**: `apps/desktop/e2e/scenarios/backspace-no-active-canvas-no-hang.e2e.ts` (structure, helpers, assertion shape) + `app-boots-and-renders-canvas.e2e.ts` (initial-boot assertions to crib from for the "did it actually re-render" check).
- **Gotcha**: this is the regression test for the bug — it must **fail against pre-Task-2 `index.html`** (no self-heal script → webview stays parked on the splash origin past the timeout) and **pass once Task 2 lands**, independent of whether Tasks 3/4 are implemented. Confirm that red→green transition explicitly before calling the fix done.
- **Validate**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` (per the `desktop-e2e` skill / root `CLAUDE.md` §233-235), run once before Task 2 (red) and once after (green).

### Task 6: ADD a Rust unit test for the new command's loopback validation

- **Do**: In `server_json.rs` (or wherever Task 1's command body lives), add `#[cfg(test)] mod tests` covering: a loopback `http://localhost:<port>` URL is accepted; a loopback `http://127.0.0.1:<port>` URL is accepted; a non-loopback URL (e.g. `http://evil.example`) and a non-`http` scheme are rejected — i.e., direct coverage of `is_loopback_url` plus the command's own error path when `wait_for_server` fails or times out (can be tested by pointing at a `design_root` with no `_server.json`).
- **Pattern**: `notify.rs:441-`, `oauth.rs:436-` (`#[cfg(test)] mod tests { use super::*; ... }` idiom already used in this crate).
- **Validate**: `cd apps/desktop/src-tauri && cargo test`

---

## Validation

Run these commands to confirm zero regressions:

1. **Rust build**: `cd apps/desktop/src-tauri && cargo build`
2. **Rust tests**: `cd apps/desktop/src-tauri && cargo test`
3. **Desktop E2E build + run**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop` (or via the `desktop-e2e` skill) — must include the new `splash-recovers-after-return-to-entry` scenario plus the existing `backspace-no-active-canvas-no-hang` and `app-boots-and-renders-canvas` scenarios (no regression on the trigger already covered).
4. **Version parity** (only if `Cargo.toml`/`tauri.conf.json` version fields are touched — they should NOT be by this feature): `scripts/check-version-parity.sh`
5. **Manual**: force-quit-free recovery check on a real build — trigger a WebKit content-process reload manually (devtools → "Reload page" targeting the splash origin, or macOS Activity Monitor → kill the `com.apple.WebKit.WebContent` process for the app) mid-session and confirm the app recovers without a force-quit.

No cross-platform `scenario-runner` (web-desktop/web-mobile/ios/android) run applies here — this is native-shell-only (WKWebView/Tauri), with no `agent-browser`-reachable web surface; the desktop E2E harness above is the correct and complete verification surface, per `CLAUDE.md`'s own framing of `apps/desktop/e2e/` as "the native counterpart to `agent-browser`, which only reaches the web layer, never the native shell."

---

## Scenario Coverage (native desktop — not a web `agent-browser` scenario)

| Scenario | Covers | Status |
|----------|--------|--------|
| `backspace-no-active-canvas-no-hang` | Backspace-triggered back-nav hang (existing, narrower trigger) | ✅ existing |
| `app-boots-and-renders-canvas` | Normal cold-boot happy path | ✅ existing |
| `splash-recovers-after-return-to-entry` | Any return-to-splash (crash/reload/programmatic), the reported bug's actual trigger | 🆕 new (Task 5) |

---

## Acceptance Criteria

- [x] Task 1 (new command) + Task 2 (self-healing splash) implemented and building.
- [x] Task 5's E2E scenario written, confirmed **red** against the pre-fix `index.html` and **green** after Task 2 — this is the regression test; do not skip the explicit red→green check.
- [x] Task 6's Rust unit test covers the loopback-validation success and rejection paths.
- [x] `cargo build` + `cargo test` pass in `apps/desktop/src-tauri`.
- [x] The new + existing splash/back-nav scenarios pass: `splash-recovers-after-return-to-entry` (2 tests), `backspace-no-active-canvas-no-hang`, `app-boots-and-renders-canvas` — run together, all green, against a `--debug` bundle rebuilt from these sources.
- [x] Tasks 3 and 4 (gesture disable, watchdog) either implemented with the `Cargo.lock` risk in Task 3 explicitly called out to a human reviewer, or explicitly deferred as a fast-follow — Task 1+2+5+6 alone already fix the reported bug and are shippable independently.
- [x] No DDR-worthy decision left unrecorded — the splash/`resolve_dev_server_url` boundary IS recorded (kgai `d_0caa05c9ba7ce62907df6986`, EXTENDS DDR-109) — if Task 3's direct `objc2` dependency addition proceeds, it's a small addition to DDR-109's "narrow command surface" posture worth a one-line mention in that DDR's Consequences section, not a new DDR.
- [x] Code follows project conventions (existing `#[cfg(test)] mod tests` idiom, existing E2E helper reuse, DDR-109 loopback validation stays server-side), no regressions.
