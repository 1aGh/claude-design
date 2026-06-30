// Maude native shell — Tauri v2 entry (DDR-106).
//
// Lifecycle: spawn the compiled dev-server as a sidecar → poll `_server.json` for
// the port → navigate the webview to it → kill the sidecar on quit. Single-instance
// focuses the existing window instead of opening a second one.
//
// Quit is caught on three paths so the sidecar is never orphaned (DDR-106 lifecycle):
//   1. Window `CloseRequested` — the window's X button.
//   2. `RunEvent::ExitRequested` / `Exit` — Cmd+Q / app termination.
//   3. SIGTERM / SIGINT — `kill`, Ctrl+C, crash-via-signal.
// (SIGKILL is uncatchable and will orphan — unavoidable for any process; a relaunch
// detects the stale `_server.json` server.)

mod app_state;
mod crash_reporter;
mod keychain;
mod menu;
mod oauth;
mod prefs;
mod server_json;
mod sidecar;
mod updater;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_dialog::DialogExt;

use sidecar::SidecarState;

/// Cold-start timeout: first launch runs boot-self-heal (bun install + build), up
/// to ~90 s; give it headroom. Warm launches resolve in well under 2 s.
const SERVER_WAIT_MS: u64 = 120_000;

/// Resolve the project root to open. `MAUDE_PROJECT_ROOT` env override → last-used
/// project (if it still exists) → the minimal welcome project (first run). Phase-29
/// (E4): on first run we boot the welcome project so the webview can render the
/// OnboardingWizard over it (the client checks `app_is_first_run`).
fn resolve_project_root(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(p) = std::env::var("MAUDE_PROJECT_ROOT") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    if let Some(p) = app_state::last_project(app) {
        return p;
    }
    app_state::welcome_project(app)
}

/// Catch SIGTERM/SIGINT so an abrupt `kill`/Ctrl+C still tears the sidecar down.
/// One task per signal (avoids the `tokio` `macros` feature); whichever fires
/// first kills the sidecar and exits.
#[cfg(unix)]
fn install_signal_handler(handle: tauri::AppHandle) {
    use tokio::signal::unix::{signal, SignalKind};
    for kind in [SignalKind::terminate(), SignalKind::interrupt()] {
        let handle = handle.clone();
        tauri::async_runtime::spawn(async move {
            match signal(kind) {
                Ok(mut sig) => {
                    sig.recv().await;
                    eprintln!("[maude] termination signal received — killing sidecar");
                    sidecar::kill_server(&handle);
                    std::process::exit(0);
                }
                Err(e) => eprintln!("[maude] could not install signal handler: {e}"),
            }
        });
    }
}

/// Native folder picker for "pull a local copy" — returns the chosen parent dir,
/// or `None` if the user cancelled. The clone lands in `<dir>/<repo-name>`.
#[tauri::command]
async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // E2E (debug builds only): a native folder picker can't be DOM-driven, so the
    // harness injects the chosen path via MAUDE_E2E_PICK_DIR instead of opening the OS
    // dialog. Gated on `debug_assertions`, so it is NEVER compiled into the release
    // `.app` (which has no WebDriver server either). See the `desktop-e2e` skill.
    #[cfg(debug_assertions)]
    if let Ok(p) = std::env::var("MAUDE_E2E_PICK_DIR") {
        if !p.is_empty() {
            return Ok(Some(p));
        }
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let path = folder
            .and_then(|f| f.into_path().ok())
            .map(|p| p.to_string_lossy().to_string());
        let _ = tx.send(path);
    });
    rx.await.map_err(|_| "Folder picker closed unexpectedly.".to_string())
}

/// Switch the app to a local project folder (the freshly cloned copy) — same
/// in-process switch as File ▸ Open Project (NOT app.restart()).
#[tauri::command]
fn open_local_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err("That project folder doesn’t exist.".to_string());
    }
    // The dev-server fails loud on a project with no `.design/` (load-bearing,
    // CLAUDE.md). Refuse the switch HERE so a non-Maude folder shows a clear message
    // instead of crash-looping the sidecar (3 respawns → blank). The client also
    // pre-checks via the clone's `hasDesign`, but this guards every open path.
    if !p.join(".design").is_dir() {
        return Err("That folder isn’t a Maude project yet (no design system). Open it and run “Set up a design system” first.".to_string());
    }
    // Remember it as the last project (so a relaunch reopens it) + switch in-process.
    app_state::set_last_project(&app, &p);
    sidecar::switch_project(&app, p);
    Ok(())
}

/// Remember `path` as the last project (so a relaunch reopens it) + switch in-process.
fn remember_and_switch(app: &tauri::AppHandle, path: PathBuf) {
    app_state::set_last_project(app, &path);
    sidecar::switch_project(app, path);
}

/// Write a minimal bootable `.design/` into `dir` (mirrors apps/studio/scaffold-design.ts)
/// so a non-Maude folder opened via File ▸ Open Project can boot instead of crash-
/// looping. A real design system is created later via /design:setup-ds.
pub(crate) fn write_minimal_design(dir: &std::path::Path) -> std::io::Result<()> {
    let design = dir.join(".design");
    if design.join("config.json").exists() {
        return Ok(());
    }
    std::fs::create_dir_all(design.join("ui"))?;
    std::fs::create_dir_all(design.join("system"))?;
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());
    // `{name:?}` debug-formats the string with JSON-safe quoting/escaping.
    let config = format!(
        "{{\n  \"$schema\": \"https://raw.githubusercontent.com/1aGh/maude/main/apps/studio/config.schema.json\",\n  \"name\": {name:?},\n  \"designRoot\": \".design\",\n  \"canvasGroups\": [\n    {{ \"label\": \"Design system\", \"path\": \"system\" }},\n    {{ \"label\": \"UI kit\", \"path\": \"ui\" }}\n  ],\n  \"designSystems\": [],\n  \"completenessProfile\": \"standard\"\n}}\n"
    );
    std::fs::write(design.join("config.json"), config)?;
    std::fs::write(design.join("ui").join(".gitkeep"), "")?;
    std::fs::write(design.join("system").join(".gitkeep"), "")?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Single-instance MUST be registered first (DDR-106): a second launch
        // focuses the existing window rather than opening a duplicate.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        // Auto-update (Phase 32 / Task 1) — config (endpoints + pubkey) is in
        // tauri.conf.json; the check/download/install loop lives in updater.rs.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            oauth::github_sign_in,
            oauth::github_open_verification,
            keychain::github_is_signed_in,
            keychain::github_sign_out,
            pick_directory,
            open_local_project,
            app_state::app_is_first_run,
            app_state::app_get_last_project,
            app_state::app_set_last_project,
            app_state::app_recent_projects,
            updater::restart_to_update,
            prefs::prefs_get_crash_reporting,
            prefs::prefs_set_crash_reporting,
        ])
        .menu(menu::build_menu)
        .on_menu_event(|app, event| {
            if event.id().as_ref() == menu::MENU_OPEN_PROJECT {
                let app = app.clone();
                // Pick a project folder, remember it, and relaunch pointed at it.
                // (The richer in-window project switcher is phase-29.)
                app.dialog().file().pick_folder(move |folder| {
                    let Some(folder) = folder else { return };
                    let Some(path) = folder.as_path().map(|p| p.to_path_buf()) else { return };
                    // Switch in-process — NOT app.restart() (relaunch aborts tao's
                    // did_finish_launching on the non-bundled dev binary).
                    if path.join(".design").is_dir() {
                        remember_and_switch(&app, path);
                        return;
                    }
                    // Not a Maude project yet — ASK before setting one up (the user's
                    // requested fallback), instead of crash-looping on a no-.design root.
                    let app2 = app.clone();
                    let name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    app.dialog()
                        .message(format!(
                            "“{name}” isn’t a Maude project yet. Set up a Maude project here so you can start designing?"
                        ))
                        .title("Set up Maude")
                        .buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancelCustom(
                            "Set it up".to_string(),
                            "Cancel".to_string(),
                        ))
                        .show(move |ok| {
                            if ok && write_minimal_design(&path).is_ok() {
                                remember_and_switch(&app2, path);
                            }
                        });
                });
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();

            // Crash reporting (Phase 32 / Task 4) — prime the opt-in toggle from
            // prefs.json and install the panic hook FIRST, so a panic anywhere in
            // setup is caught (and, only if opted in, written to a local file).
            prefs::init(&handle);
            crash_reporter::install(&handle);

            let project_root = resolve_project_root(&handle);
            eprintln!("[maude] project root: {}", project_root.display());

            app.manage(SidecarState {
                child: Mutex::new(None),
                shutting_down: AtomicBool::new(false),
                restarts: AtomicU32::new(0),
                project_root: Mutex::new(project_root.to_string_lossy().to_string()),
            });

            // Clear any stale `_server.json` from a previous session BEFORE spawning,
            // so `wait_for_server` blocks on THIS run's fresh (post-bind) write. Without
            // this the webview navigates to the old port before the new server binds →
            // connection refused → intermittent white screen.
            let design_root = project_root.join(".design");
            let _ = std::fs::remove_file(design_root.join("_server.json"));

            // 0. Start the loopback GitHub-token bridge BEFORE spawning the sidecar,
            // so its endpoint+key are available to pass to the child (DDR-108).
            if let Err(e) = keychain::start_token_bridge() {
                eprintln!("[maude] WARN: token bridge did not start (GitHub features disabled): {e}");
            }

            // 1. Spawn the dev-server sidecar.
            if let Err(e) = sidecar::spawn_server(&handle) {
                eprintln!("[maude] FATAL: could not spawn dev-server: {e}");
            }

            // 2. Poll `_server.json`, then navigate the webview to the server URL.
            let nav_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                match server_json::wait_for_server(design_root, SERVER_WAIT_MS).await {
                    Ok(url) => {
                        eprintln!("[maude] dev-server ready at {url} — navigating webview");
                        if let Some(window) = nav_handle.get_webview_window("main") {
                            match url.parse::<tauri::Url>() {
                                Ok(parsed) if server_json::is_loopback_url(&parsed) => {
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
                    Err(e) => eprintln!("[maude] dev-server did not come up: {e}"),
                }
            });

            // 3. SIGTERM/SIGINT → kill sidecar + exit.
            #[cfg(unix)]
            install_signal_handler(handle.clone());

            // 4. Background auto-update (Phase 32 / Task 1): initial check after a
            // short delay, then every 4 h. On-focus checks are wired in
            // `on_window_event` below. No-op on a dev / unbundled build.
            updater::spawn_update_loop(handle.clone());

            // NOTE: `maude://` deep-link handling is deferred to phase-29. It needs a
            // bundled .app + the `open?path=` route; the dev-mode deep-link plugin
            // aborted in `did_finish_launching` (Apple-Event open handler) on a
            // non-bundled `tauri dev` binary. See DDR-106 addendum.

            Ok(())
        })
        // Kill the sidecar when the main window is closed (X button); check for
        // updates whenever the window regains focus (Phase 32 / Task 1).
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { .. } => {
                sidecar::kill_server(window.app_handle());
            }
            WindowEvent::Focused(true) => {
                updater::check_now(window.app_handle().clone());
            }
            _ => {}
        });

    // Desktop E2E (DOM-driven scenario tests via @wdio/tauri-service): register the
    // embedded W3C WebDriver server LAST and ONLY in debug builds. `debug_assertions`
    // is on for `tauri dev` AND `tauri build --debug` (the e2e test bundle) but OFF
    // for the shipped release, so the production `.app` never starts a WebDriver
    // server. Registered after single-instance so DDR-106's focus behavior is
    // unaffected. See the `desktop-e2e` skill + the harness in apps/desktop/e2e/.
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Kill the sidecar on Cmd+Q / app termination.
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            sidecar::kill_server(app_handle);
        }
    });
}
