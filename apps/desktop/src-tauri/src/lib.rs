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

mod menu;
mod server_json;
mod sidecar;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32};
use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_dialog::DialogExt;

use sidecar::SidecarState;

/// Cold-start timeout: first launch runs boot-self-heal (bun install + build), up
/// to ~90 s; give it headroom. Warm launches resolve in well under 2 s.
const SERVER_WAIT_MS: u64 = 120_000;

/// Resolve the project root to open. Phase-26: `MAUDE_PROJECT_ROOT` env override →
/// last-used project (app config dir) → current dir. The full project picker is
/// phase-29.
fn resolve_project_root(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(p) = std::env::var("MAUDE_PROJECT_ROOT") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    if let Some(p) = last_project_path(app) {
        if p.exists() {
            return p;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Path to the `last-project.txt` marker in the app config dir.
fn last_project_marker(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("last-project.txt"))
}

fn last_project_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let marker = last_project_marker(app)?;
    let raw = std::fs::read_to_string(marker).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
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
        .menu(menu::build_menu)
        .on_menu_event(|app, event| {
            if event.id().as_ref() == menu::MENU_OPEN_PROJECT {
                let app = app.clone();
                // Pick a project folder, remember it, and relaunch pointed at it.
                // (The richer in-window project switcher is phase-29.)
                app.dialog().file().pick_folder(move |folder| {
                    if let Some(folder) = folder {
                        if let Some(path) = folder.as_path() {
                            if let Some(marker) = last_project_marker(&app) {
                                if let Some(dir) = marker.parent() {
                                    let _ = std::fs::create_dir_all(dir);
                                }
                                let _ = std::fs::write(&marker, path.to_string_lossy().as_bytes());
                            }
                            // Switch in-process — NOT app.restart() (relaunch aborts
                            // tao's did_finish_launching on the non-bundled dev binary).
                            sidecar::switch_project(&app, path.to_path_buf());
                        }
                    }
                });
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
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

            // NOTE: `maude://` deep-link handling is deferred to phase-29. It needs a
            // bundled .app + the `open?path=` route; the dev-mode deep-link plugin
            // aborted in `did_finish_launching` (Apple-Event open handler) on a
            // non-bundled `tauri dev` binary. See DDR-106 addendum.

            Ok(())
        })
        // Kill the sidecar when the main window is closed (X button).
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                sidecar::kill_server(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Kill the sidecar on Cmd+Q / app termination.
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            sidecar::kill_server(app_handle);
        }
    });
}
