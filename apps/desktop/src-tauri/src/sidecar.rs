// Dev-server sidecar lifecycle — spawn / supervise / kill (DDR-106, DDR-109).
//
// The sidecar is the compiled Bun dev-server binary (DDR-009/084), bundled via
// Tauri `externalBin` as `binaries/maude-server-<target-triple>` and spawned with
// `--root <project>`. Loopback-only (DDR-109): the dev-server binds localhost.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Managed state holding the live sidecar child + supervision flags.
pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
    /// Set true on app quit so the supervisor does not respawn during shutdown.
    pub shutting_down: AtomicBool,
    /// Respawn attempts so far (capped at MAX_RESTARTS).
    pub restarts: AtomicU32,
    /// Project root passed to the dev-server as `--root`. Mutable so the user can
    /// switch projects in-process (File ▸ Open Project…) without restarting the app.
    pub project_root: Mutex<String>,
}

const MAX_RESTARTS: u32 = 3;

/// Resolve the user's real PATH by asking their login shell, so a Finder/Dock-
/// launched `.app` can reach `claude` / `maude` even though it inherited the
/// truncated launchd PATH (DDR-128). Unix-only — Windows GUI apps already inherit
/// the user PATH. Best-effort: returns `None` on any failure and the caller leaves
/// the inherited PATH in place.
///
/// `-ilc` runs an interactive login shell so BOTH `.zprofile` (login) and `.zshrc`
/// (interactive — where Homebrew/asdf/nvm users usually export PATH) are sourced.
/// The value is bracketed with markers because instant-prompt frameworks
/// (powerlevel10k) write to stdout on interactive start; we extract only the slice
/// between the markers. Runs on a worker thread with a 5 s timeout so a slow or
/// input-blocking rc can never wedge app startup (stdin is /dev/null for the same
/// reason).
#[cfg(unix)]
fn resolve_login_path() -> Option<String> {
    use std::process::{Command, Stdio};
    use std::sync::mpsc;
    use std::time::Duration;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let out = Command::new(&shell)
            .args(["-ilc", "command printf '__MAUDE_PATH__%s__MAUDE_END__' \"$PATH\""])
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output();
        let _ = tx.send(out);
    });

    let output = match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(o)) => o,
        _ => return None,
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    let start = stdout.find("__MAUDE_PATH__")? + "__MAUDE_PATH__".len();
    let rest = &stdout[start..];
    let end = rest.find("__MAUDE_END__")?;
    let path = rest[..end].trim();
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

#[cfg(not(unix))]
fn resolve_login_path() -> Option<String> {
    None
}

/// DDR-166 T0b — stage the bundled `maude` binary as the ONLY entry in a
/// narrow, single-purpose directory, and return that entry's own path (the
/// symlink, not the real target — this is exactly what a PATH lookup for
/// `maude` will resolve to, so it's also what `MAUDE_BUNDLED_CLI_PATH` must
/// equal for `readiness.ts`'s bundled-vs-real-PATH comparison to match).
///
/// Returns `None` when the bundled binary isn't next to our own executable —
/// the expected case under `tauri dev`, where `externalBin` is triple-named
/// under `src-tauri/binaries` rather than staged beside the dev binary (same
/// condition `MAUDE_AGENT_BROWSER` above degrades under). No regression: PATH
/// resolution then falls through to whatever's genuinely on the user's PATH.
fn stage_bundled_cli_link(app: &AppHandle) -> Option<PathBuf> {
    let exe = if cfg!(windows) { "maude.exe" } else { "maude" };
    let bundled = std::env::current_exe().ok()?.parent()?.join(exe);
    if !bundled.is_file() {
        return None;
    }
    let dir = app.path().app_cache_dir().ok()?.join("bin-link");
    std::fs::create_dir_all(&dir).ok()?;
    let link = dir.join(exe);
    // Idempotent: always refresh, so a stale symlink from a prior version
    // (or a same-user-writable location, per the F4 rationale this mirrors)
    // never lingers pointed at the wrong — or a tampered — target.
    let _ = std::fs::remove_file(&link);
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&bundled, &link).ok()?;
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_file(&bundled, &link).ok()?;
    }
    Some(link)
}

/// Spawn the dev-server sidecar and store the child in managed state. Drains the
/// command's event stream; on unexpected termination (not a quit), respawns with
/// linear backoff up to `MAX_RESTARTS`. Re-entrant: the respawn path calls back in.
pub fn spawn_server(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<SidecarState>();
    let project_root = state.project_root.lock().expect("sidecar mutex poisoned").clone();

    let mut command = app
        .shell()
        .sidecar("maude-server")
        .map_err(|e| format!("sidecar resolve failed: {e}"))?
        .args(["--root", project_root.as_str()])
        // The webview IS the UI — suppress the dev-server's default
        // open-the-browser-on-boot behavior (server.ts honors NO_OPEN).
        .env("NO_OPEN", "1");

    // DDR-128 — a `.app` launched from Finder/Dock inherits the truncated launchd
    // PATH (`/usr/bin:/bin:…`), NOT the user's shell PATH. The sidecar would then
    // fail to find `claude` (the ACP adapter spawns it) and `maude` (the paired
    // `claude`'s `/design:edit` shells out to `maude design <verb>`), so AI editing
    // silently dies in the bundled app while working under `tauri dev` (which
    // inherits the terminal's full PATH). Resolve the login-shell PATH once and
    // pass it through; everything downstream (Bun.which, the adapter, the paired
    // claude) then sees the real PATH. Best-effort: on failure we leave PATH
    // untouched (no regression). The /_api/preflight readiness probe reports what's
    // still genuinely missing on top of this.
    let base_path = resolve_login_path().unwrap_or_else(|| std::env::var("PATH").unwrap_or_default());
    eprintln!("[maude] sidecar PATH ← login shell ({} entries)", base_path.split(':').count());

    // DDR-166 T0b — expose the bundled `maude` CLI on the sidecar's PATH so the
    // ACP-spawned `claude`'s Bash-tool shell-outs (`maude design <verb>`, per
    // DDR-062's "never a raw bin path" convention) resolve it even with no
    // global install. NOT via `current_exe().parent()` prepended wholesale —
    // that directory also holds `maude-server`/`agent-browser`, and per the
    // Attacker-F4 rationale a few lines above, exposing an entire multi-binary
    // directory for unqualified PATH lookup lets a same-user attacker who can
    // write there shadow every name in it for every dev-server child. Instead:
    // stage `maude` alone as the ONLY entry in a narrow, single-purpose
    // directory, and APPEND (not prepend) that directory — a user's own newer
    // global `maude` (e.g. `npm i -g @1agh/maude`) still wins on precedence;
    // this is a floor, not a forced ceiling.
    let mut path = base_path;
    if let Some(link) = stage_bundled_cli_link(app) {
        path = format!("{path}:{}", link.parent().unwrap_or(&link).display());
        command = command.env("MAUDE_BUNDLED_CLI_PATH", link.to_string_lossy().to_string());
    }
    command = command.env("PATH", path);

    // Point the screenshot helper at the bundled `agent-browser` engine (DDR-144)
    // by an EXPLICIT env var rather than prepending our dir to PATH. Attacker-F4:
    // prepending `current_exe().parent()` (Contents/MacOS, where the externalBin
    // siblings live) would let a same-user attacker who can write there shadow
    // `node`/`google-chrome`/etc. for every dev-server child. A single-binary env
    // pointer exposes ONLY agent-browser, no PATH pollution. screenshot.sh honors
    // `MAUDE_AGENT_BROWSER` and otherwise falls back to a PATH lookup. In `tauri
    // dev` the externalBin is triple-named in src-tauri/binaries (not next to the
    // exe), so this stays unset → the developer's global agent-browser is used.
    if let Some(ab) = std::env::current_exe().ok().and_then(|p| {
        let exe = if cfg!(windows) { "agent-browser.exe" } else { "agent-browser" };
        p.parent().map(|d| d.join(exe))
    }) {
        if ab.is_file() {
            command = command.env("MAUDE_AGENT_BROWSER", ab.to_string_lossy().to_string());
            eprintln!("[maude] bundled screenshot engine: {}", ab.display());
        }
    }

    // DDR-166 T0b — same single-binary env-pointer pattern as MAUDE_AGENT_BROWSER
    // above, for the bundled `maude-server` binary itself: the compiled `maude`
    // CLI's BOOT_VERBS (server-up/visual-sanity/smoke, cli/commands/design.mjs)
    // resolve their own copy of this same binary via npm-package lookup, which
    // breaks inside a compiled binary (no npm package to resolve — DDR-045-class
    // trap). Pre-setting this short-circuits that resolution entirely: the CLI's
    // own dispatch already checks `!process.env.MAUDE_DEV_SERVER_BIN` before
    // trying to resolve it itself. This is also literally the exact binary
    // already running as this sidecar, so it's always correct.
    if let Some(sb) = std::env::current_exe().ok().and_then(|p| {
        let exe = if cfg!(windows) { "maude-server.exe" } else { "maude-server" };
        p.parent().map(|d| d.join(exe))
    }) {
        if sb.is_file() {
            command = command.env("MAUDE_DEV_SERVER_BIN", sb.to_string_lossy().to_string());
        }
    }

    // Pass through the canvas-origin-split override (DDR-063) so a WKWebView that
    // can't load the cross-origin canvas iframe can be debugged / fall back to
    // same-origin via `MAUDE_CANVAS_ORIGIN_SPLIT=0 tauri dev`.
    if let Ok(split) = std::env::var("MAUDE_CANVAS_ORIGIN_SPLIT") {
        command = command.env("MAUDE_CANVAS_ORIGIN_SPLIT", split);
    }

    // DDR-166 — deterministic E2E stub for claude-readiness states that are
    // otherwise near-impossible to reproduce on an already-set-up dev machine
    // (mirrors MAUDE_E2E_FAKE_GITHUB_LOGIN in oauth.rs). Never set in a normal
    // launch; readiness.ts is the consumer.
    if let Ok(v) = std::env::var("MAUDE_E2E_FORCE_CLAUDE_STATUS") {
        command = command.env("MAUDE_E2E_FORCE_CLAUDE_STATUS", v);
    }

    // DDR-166 Decision 5 — pass the settings-UI opt-out for auto-install/
    // auto-sign-in to the sidecar at spawn time. Read fresh on every spawn
    // (including respawn/switch_project), so a toggle takes effect on the
    // next project switch or app launch without needing extra plumbing.
    let auto_setup = crate::prefs::load(app).claude_auto_setup;
    command = command.env("MAUDE_CLAUDE_AUTOSETUP_ENABLED", if auto_setup { "1" } else { "0" });

    // Loopback GitHub-token bridge (DDR-108): the dev-server's /_api/github/*
    // endpoints fetch the keychain token from this endpoint at request time, with
    // the per-launch key. Absent in non-Tauri `maude design serve` → those
    // endpoints degrade to "sign in via the desktop app".
    if let Some((endpoint, key)) = crate::keychain::bridge_env() {
        command = command
            .env("MAUDE_TOKEN_ENDPOINT", endpoint)
            .env("MAUDE_TOKEN_KEY", key);
    }

    // In a packaged .app the sidecar binary sits alone in Contents/MacOS/ with no
    // apps/studio/ up-tree, so paths.ts walk-up can't find the runtime. Point it at
    // the runtime we ship as a bundle resource (Resources/apps/studio). In dev this
    // dir doesn't exist → left unset → walk-up resolves the source tree (DDR-106).
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Tauri's resource-path mapping varies by version/config; probe the likely
        // landing spots for the staged `apps/studio` runtime (anchor: it has `dist/`).
        let candidates = [
            resource_dir.join("apps").join("studio"),
            resource_dir.join("resources").join("apps").join("studio"),
            resource_dir.join("_up_").join("apps").join("studio"),
            resource_dir.join("studio"),
        ];
        if let Some(studio) = candidates.into_iter().find(|p| p.join("dist").exists()) {
            command = command.env("MAUDE_DEV_SERVER_ROOT", studio.to_string_lossy().to_string());
            eprintln!("[maude] bundled runtime: {}", studio.display());
        }
    }

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("sidecar spawn failed: {e}"))?;

    eprintln!(
        "[maude] dev-server sidecar spawned (pid {}) --root {}",
        child.pid(),
        project_root
    );
    *state.child.lock().expect("sidecar mutex poisoned") = Some(child);

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprint!("[maude:server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprint!("[maude:server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    eprintln!("[maude:server] error: {err}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[maude:server] terminated (code={:?})", payload.code);
                    let state = app.state::<SidecarState>();
                    if state.shutting_down.load(Ordering::SeqCst) {
                        break; // expected — app is quitting
                    }
                    let attempt = state.restarts.fetch_add(1, Ordering::SeqCst) + 1;
                    if attempt > MAX_RESTARTS {
                        eprintln!("[maude] sidecar gave up after {MAX_RESTARTS} restarts");
                        break;
                    }
                    eprintln!("[maude] respawning dev-server (attempt {attempt}/{MAX_RESTARTS})");
                    tokio::time::sleep(Duration::from_millis(500 * attempt as u64)).await;
                    if let Err(e) = spawn_server(&app) {
                        eprintln!("[maude] respawn failed: {e}");
                    }
                    break; // a fresh task now drains the new child
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Switch the open project IN-PROCESS (File ▸ Open Project…): point the dev-server
/// at a new root and reload the webview — WITHOUT `app.restart()`.
///
/// Why not restart: `app.restart()` relaunches the binary, and on a non-bundled
/// `tauri dev` binary macOS delivers an "open" Apple Event that aborts `tao` in
/// `did_finish_launching` (SIGABRT). Switching in-process avoids that entirely and
/// is better UX (no window flash). The supervisor's respawn (Terminated → spawn)
/// reads the updated `project_root`, so killing the child re-spawns it with the new
/// root; we then re-navigate once the new `_server.json` lands.
pub fn switch_project(app: &AppHandle, new_root: PathBuf) {
    let state = app.state::<SidecarState>();
    *state.project_root.lock().expect("sidecar mutex poisoned") = new_root.to_string_lossy().to_string();
    state.restarts.store(0, Ordering::SeqCst); // a deliberate switch is not a crash
    eprintln!("[maude] switching project → {}", new_root.display());

    // Force `wait_for_server` to block on a FRESH write rather than a stale file
    // from a previous session of the target project.
    let design_root = new_root.join(".design");
    let _ = std::fs::remove_file(design_root.join("_server.json"));

    // Kill the current child; the Terminated supervisor respawns it with the new root.
    if let Some(child) = state.child.lock().expect("sidecar mutex poisoned").take() {
        let _ = child.kill();
    }

    // Re-navigate once the new project's dev-server is up.
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match crate::server_json::wait_for_server(design_root, 120_000).await {
            Ok(url) => {
                eprintln!("[maude] project switched — navigating to {url}");
                if let Some(window) = app.get_webview_window("main") {
                    match url.parse::<tauri::Url>() {
                        Ok(parsed) if crate::server_json::is_loopback_url(&parsed) => {
                            if let Err(e) = window.navigate(parsed) {
                                eprintln!("[maude] navigate failed: {e}");
                            }
                        }
                        Ok(parsed) => {
                            eprintln!("[maude] refusing non-loopback navigate (DDR-109): {parsed}")
                        }
                        Err(e) => eprintln!("[maude] invalid server url {url}: {e}"),
                    }
                }
            }
            Err(e) => eprintln!("[maude] switch: dev-server did not come up: {e}"),
        }
    });
}

/// Kill the sidecar (called on app quit). Flags shutdown first so the supervisor
/// does not respawn. The dev-server cleans up its own `_server.json` on SIGTERM.
pub fn kill_server(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarState>() {
        state.shutting_down.store(true, Ordering::SeqCst);
        if let Some(child) = state.child.lock().expect("sidecar mutex poisoned").take() {
            // DDR-166 — `CommandChild::kill()` alone sends SIGKILL (it wraps
            // `std::process::Child::kill`), which the Bun sidecar's own
            // `process.on('SIGTERM', shutdown)` handler (server.ts) never
            // sees — so its cleanup (killing an in-flight claude-install/
            // sign-in grandchild, per this DDR's own previously-unanswered
            // "how does app-quit reach the grandchild" question) never runs.
            // Security-review finding. Fix: SIGTERM first via the system
            // `kill` (no new crate dependency — mirrors resolve_login_path's
            // existing shell-out-to-a-system-binary pattern), a short bounded
            // grace period for the handler to run, THEN the existing
            // guaranteed-termination SIGKILL fallback either way.
            let pid = child.pid();
            #[cfg(unix)]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .status();
                std::thread::sleep(Duration::from_millis(400));
            }
            let _ = child.kill();
            eprintln!("[maude] dev-server sidecar killed on quit (pid {pid})");
        }
    }
}
