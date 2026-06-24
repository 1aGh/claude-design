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
    if let Some(login_path) = resolve_login_path() {
        eprintln!("[maude] sidecar PATH ← login shell ({} entries)", login_path.split(':').count());
        command = command.env("PATH", login_path);
    }

    // Pass through the canvas-origin-split override (DDR-063) so a WKWebView that
    // can't load the cross-origin canvas iframe can be debugged / fall back to
    // same-origin via `MAUDE_CANVAS_ORIGIN_SPLIT=0 tauri dev`.
    if let Ok(split) = std::env::var("MAUDE_CANVAS_ORIGIN_SPLIT") {
        command = command.env("MAUDE_CANVAS_ORIGIN_SPLIT", split);
    }

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
            let _ = child.kill();
            eprintln!("[maude] dev-server sidecar killed on quit");
        }
    }
}
