// app_state.rs — first-run detection + last-project / recent-projects persistence
// (Phase 29, epic E4).
//
// Chicken-and-egg: the OnboardingWizard is a CLIENT surface served BY the dev-server,
// but the dev-server needs a project with a `.design/` to boot. So on first launch
// (nothing remembered) the shell boots the sidecar against a minimal **welcome
// project** in app-data, and the client — querying `app_is_first_run` — renders the
// wizard OVER the (empty) canvas browser. Completing a door calls `set_last_project`
// + switches the sidecar to the real project, so the next launch skips the wizard
// (the fast path).
//
// State lives in `<app_config_dir>/app-state.json`:
//   { "last_project": "<abs path>", "recent_projects": ["<abs>", …] }   (recent: MRU-first, max 10)
// A phase-26..28 install that only has the legacy `last-project.txt` marker is
// migrated transparently on first read.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

const MAX_RECENT: usize = 10;

#[derive(Default, Serialize, Deserialize)]
pub struct AppState {
    #[serde(default)]
    pub last_project: Option<String>,
    #[serde(default)]
    pub recent_projects: Vec<String>,
}

fn state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("app-state.json"))
}

fn legacy_marker(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("last-project.txt"))
}

/// Read persisted state, migrating a legacy `last-project.txt` (phase 26-28) if the
/// JSON file doesn't exist yet.
pub fn load(app: &tauri::AppHandle) -> AppState {
    if let Some(p) = state_path(app) {
        if let Ok(bytes) = std::fs::read(&p) {
            if let Ok(st) = serde_json::from_slice::<AppState>(&bytes) {
                return st;
            }
        }
    }
    if let Some(marker) = legacy_marker(app) {
        if let Ok(raw) = std::fs::read_to_string(&marker) {
            let t = raw.trim();
            if !t.is_empty() {
                return AppState {
                    last_project: Some(t.to_string()),
                    recent_projects: vec![t.to_string()],
                };
            }
        }
    }
    AppState::default()
}

fn save(app: &tauri::AppHandle, st: &AppState) {
    let Some(p) = state_path(app) else { return };
    if let Some(dir) = p.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(st) {
        let _ = std::fs::write(&p, json);
    }
}

/// The remembered last project, IF it still exists on disk (a deleted project
/// falls through to first-run rather than crash-looping the sidecar).
pub fn last_project(app: &tauri::AppHandle) -> Option<PathBuf> {
    let raw = load(app).last_project?;
    let p = PathBuf::from(raw);
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

/// First run (show the wizard) = there is no usable remembered project.
pub fn is_first_run(app: &tauri::AppHandle) -> bool {
    last_project(app).is_none()
}

/// Remember `path` as the last project and push it to the front of the MRU list.
pub fn set_last_project(app: &tauri::AppHandle, path: &Path) {
    let s = path.to_string_lossy().to_string();
    let mut st = load(app);
    st.last_project = Some(s.clone());
    st.recent_projects.retain(|r| r != &s);
    st.recent_projects.insert(0, s);
    st.recent_projects.truncate(MAX_RECENT);
    save(app, &st);
    // Keep the legacy marker in sync so any older read path still resolves.
    if let Some(marker) = legacy_marker(app) {
        if let Some(dir) = marker.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(&marker, path.to_string_lossy().as_bytes());
    }
}

/// The MRU project list, filtered to ones that still exist (max 10).
pub fn recent_projects(app: &tauri::AppHandle) -> Vec<String> {
    load(app)
        .recent_projects
        .into_iter()
        .filter(|p| Path::new(p).exists())
        .collect()
}

/// A minimal, always-bootable project the dev-server serves on first run so the
/// webview has something to render the wizard over. Reuses the same minimal
/// `.design/` scaffold as the "Set up Maude here" fallback (lib::write_minimal_design).
pub fn welcome_project(app: &tauri::AppHandle) -> PathBuf {
    let base = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
    let dir = base.join("welcome-project");
    let _ = crate::write_minimal_design(&dir);
    dir
}

// ── Tauri commands (webview → shell) ────────────────────────────────────────────
#[tauri::command]
pub fn app_is_first_run(app: tauri::AppHandle) -> bool {
    is_first_run(&app)
}

#[tauri::command]
pub fn app_get_last_project(app: tauri::AppHandle) -> Option<String> {
    last_project(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn app_set_last_project(app: tauri::AppHandle, path: String) {
    set_last_project(&app, &PathBuf::from(path));
}

#[tauri::command]
pub fn app_recent_projects(app: tauri::AppHandle) -> Vec<String> {
    recent_projects(&app)
}
