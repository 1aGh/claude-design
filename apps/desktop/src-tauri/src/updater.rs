// updater.rs — background auto-update (Phase 32 / Task 1).
//
// Polls the signed JSON release feed (endpoint + ed25519 pubkey in
// tauri.conf.json → plugins.updater), downloads + stages a newer build silently
// in the background, then emits `update-ready` to the webview so the client can
// show a non-blocking "Maude updated · Restart to apply" banner. The user applies
// it by clicking "Restart now" (→ `restart_to_update`), which kills the sidecar
// and relaunches into the swapped bundle.
//
// Why drive this from Rust instead of the @tauri-apps/plugin-updater JS API: the
// webview loads the dev-server UI from a REMOTE (loopback http://) origin. Letting
// that origin invoke the updater plugin would mean granting `updater:default` to
// remote content (it could trigger an install). Instead we keep all updater calls
// in the trusted Rust core and expose only the narrow `restart_to_update` command.
//
// Cadence: an initial check shortly after boot, on every window focus, and every
// 4 h. Checks never block the UI and failures are logged, not fatal (a dev / un-
// bundled build has nothing to install — that's expected and quiet).

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

/// 4 hours between background checks (plus on-focus + boot).
const CHECK_INTERVAL_SECS: u64 = 4 * 60 * 60;
/// Let the sidecar + webview settle before the first check.
const INITIAL_DELAY_SECS: u64 = 15;

/// Set true only after an update has actually been downloaded + staged. The
/// `restart_to_update` command is a no-op until this flips, so a forged/injected
/// call from the (CSP-less, DDR-109-F2) main origin can't loop-restart the app —
/// you can only "restart to update" when there genuinely IS a staged update.
static UPDATE_STAGED: AtomicBool = AtomicBool::new(false);

/// Payload for the `update-ready` event the client banner listens for.
#[derive(Clone, Serialize)]
struct UpdateReady {
    version: String,
    notes: Option<String>,
}

/// Spawn the background check loop: initial check after a short delay, then every
/// `CHECK_INTERVAL_SECS`. Call once from `setup`.
pub fn spawn_update_loop(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(INITIAL_DELAY_SECS)).await;
        let mut ticker = tokio::time::interval(Duration::from_secs(CHECK_INTERVAL_SECS));
        loop {
            check_and_apply(&handle, false).await;
            ticker.tick().await;
        }
    });
}

/// One-shot check (used on window focus). Safe to call concurrently with the loop —
/// the updater plugin no-ops a second in-flight check.
pub fn check_now(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        check_and_apply(&handle, false).await;
    });
}

/// One-shot check the user triggered from the Maude ▸ Check for Updates… menu.
/// Unlike the silent background/focus checks, this surfaces the two otherwise-
/// invisible outcomes via a native dialog: "you're up to date" and "check failed".
/// A found update still flows through the normal download → `update-ready` banner.
pub fn check_now_interactive(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        check_and_apply(&handle, true).await;
    });
}

/// `interactive` = the user asked for this check (menu), so give explicit feedback
/// on the up-to-date + error paths. Background/focus checks pass `false` and stay quiet.
async fn check_and_apply(handle: &AppHandle, interactive: bool) {
    let updater = match handle.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[maude] updater unavailable: {e}");
            if interactive {
                notify_check_failed(handle, &e.to_string());
            }
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            let notes = update.body.clone();
            eprintln!("[maude] update available: {version} — downloading in background");
            // download_and_install stages the new bundle (macOS swaps the .app, Windows
            // runs the signed installer). The running process keeps going until restart.
            let result = update
                .download_and_install(
                    |_chunk, _total| {},
                    || eprintln!("[maude] update downloaded — staged for restart"),
                )
                .await;
            match result {
                Ok(()) => {
                    UPDATE_STAGED.store(true, Ordering::Relaxed);
                    if let Err(e) = handle.emit("update-ready", UpdateReady { version, notes }) {
                        eprintln!("[maude] could not emit update-ready: {e}");
                    }
                }
                Err(e) => {
                    eprintln!("[maude] update download/install failed: {e}");
                    // Unlike the sibling Ok(None)/Err(check) branches below, this used to
                    // swallow the failure — a manual click that finds an update but can't
                    // install it looked identical to a click that did nothing at all.
                    if interactive {
                        handle
                            .dialog()
                            .message(format!(
                                "Found Maude {version}, but couldn’t install it.\n\n{e}"
                            ))
                            .title("Update failed")
                            .kind(MessageDialogKind::Error)
                            .show(|_| {});
                    }
                }
            }
        }
        Ok(None) => {
            // Already up to date. Quiet for background checks; for a manual check the
            // user expects confirmation that the click did something.
            if interactive {
                handle
                    .dialog()
                    .message(format!(
                        "Maude {} is the latest version.",
                        env!("CARGO_PKG_VERSION")
                    ))
                    .title("You’re up to date")
                    .kind(MessageDialogKind::Info)
                    .show(|_| {});
            }
        }
        Err(e) => {
            eprintln!("[maude] update check failed: {e}");
            if interactive {
                notify_check_failed(handle, &e.to_string());
            }
        }
    }
}

/// Native error dialog for a manual check that couldn't reach / verify the feed.
fn notify_check_failed(handle: &AppHandle, err: &str) {
    handle
        .dialog()
        .message(format!("Couldn’t check for updates.\n\n{err}"))
        .title("Update check failed")
        .kind(MessageDialogKind::Error)
        .show(|_| {});
}

/// Webview → shell: apply the staged update by relaunching. Tears the sidecar down
/// first (mirrors the quit paths) so the relaunched app gets a fresh dev-server.
///
/// Guarded: a no-op unless an update was genuinely downloaded + staged. Without this
/// a forged/injected call from the main origin (which has no CSP yet — DDR-109 F2)
/// could loop-restart the app as a DoS. With it, the worst an injected call can do is
/// nothing.
#[tauri::command]
pub fn restart_to_update(app: AppHandle) {
    if !UPDATE_STAGED.load(Ordering::Relaxed) {
        eprintln!("[maude] restart_to_update ignored — no update staged");
        return;
    }
    eprintln!("[maude] restart_to_update — killing sidecar and relaunching into the update");
    crate::sidecar::kill_server(&app);
    app.restart();
}
