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

    // Pass through the canvas-origin-split override (DDR-063) so a WKWebView that
    // can't load the cross-origin canvas iframe can be debugged / fall back to
    // same-origin via `MAUDE_CANVAS_ORIGIN_SPLIT=0 tauri dev`.
    if let Ok(split) = std::env::var("MAUDE_CANVAS_ORIGIN_SPLIT") {
        command = command.env("MAUDE_CANVAS_ORIGIN_SPLIT", split);
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
