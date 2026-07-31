// Native OS menu (DDR-106 Task 6). App menu (About + Quit) and File ▸ New
// Project… / Open Project…. The full menu grows in later phases.

use tauri::menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

/// Menu-item id for the File ▸ New Project… action.
pub const MENU_NEW_PROJECT: &str = "new_project";

/// Menu-item id for the File ▸ Open Project… action.
pub const MENU_OPEN_PROJECT: &str = "open_project";

/// Menu-item id for the Maude ▸ Check for Updates… action (manual update check).
pub const MENU_CHECK_UPDATES: &str = "check_updates";

/// Menu-item id for the Help ▸ Report a Bug… action (feature-bug-report-button).
pub const MENU_REPORT_BUG: &str = "report_bug";

/// Build the application menu. The first submenu becomes the macOS app menu.
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let about = AboutMetadataBuilder::new()
        .name(Some("Maude"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .build();

    // Manual "Check for Updates…" — the background loop (updater.rs) already checks
    // on boot / focus / every 4 h, but this lets the user force a check on demand and
    // get explicit feedback (a native "you're up to date" / error dialog) that the
    // silent background path deliberately withholds.
    let check_updates =
        MenuItemBuilder::with_id(MENU_CHECK_UPDATES, "Check for Updates…").build(app)?;

    let app_menu = SubmenuBuilder::new(app, "Maude")
        .about(Some(about))
        .separator()
        .item(&check_updates)
        .separator()
        .quit()
        .build()?;

    let new_project = MenuItemBuilder::with_id(MENU_NEW_PROJECT, "New Project…")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_project = MenuItemBuilder::with_id(MENU_OPEN_PROJECT, "Open Project…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_project)
        .item(&open_project)
        .build()?;

    // Help menu — Report a Bug… hands off to the webview's report dialog
    // (app.jsx listens for `menu://report-bug`), which owns capture + consent.
    let report_bug = MenuItemBuilder::with_id(MENU_REPORT_BUG, "Report a Bug…").build(app)?;
    let help_menu = SubmenuBuilder::new(app, "Help").item(&report_bug).build()?;

    // Edit menu — carries the standard Cut/Copy/Paste/Select-All predefined items.
    // These are load-bearing on macOS: WKWebView only receives the Cmd+X/C/V/A
    // shortcuts when the app menu exposes the matching predefined items (they wire
    // the native `cut:`/`copy:`/`paste:`/`selectAll:` selectors). Without this
    // submenu copy/paste is dead everywhere in the app, including the ACP chat
    // composer. Undo/Redo are macOS-only (unsupported on Windows/Linux).
    let edit_menu = SubmenuBuilder::new(app, "Edit");
    #[cfg(target_os = "macos")]
    let edit_menu = edit_menu.undo().redo().separator();
    let edit_menu = edit_menu.cut().copy().paste().select_all().build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &help_menu])
        .build()
}
