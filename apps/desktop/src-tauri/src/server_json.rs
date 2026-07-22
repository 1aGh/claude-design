// Poll `<design_root>/_server.json` to discover the dev-server URL (DDR-106).
//
// The dev-server (apps/studio/server.ts) writes `_server.json` after it binds:
//   { pid, port, url: "http://localhost:<port>", canvasOrigin?, started, ... }
// First launch runs boot-self-heal (bun install + build.ts) → up to ~90 s, so the
// caller uses a 120 s timeout on cold start; subsequent launches are < 2 s.
//
// DDR-106: navigate the `url` field VERBATIM — it uses `localhost`, not
// `127.0.0.1` (different origins to WKWebView).

use std::path::PathBuf;
use std::time::Duration;

use serde::Deserialize;

#[derive(Deserialize)]
struct ServerInfo {
    url: Option<String>,
    port: Option<u16>,
}

/// Poll `<design_root>/_server.json` every 200 ms until a URL is resolvable or the
/// timeout elapses. Returns the URL string to navigate the webview to.
pub async fn wait_for_server(design_root: PathBuf, timeout_ms: u64) -> Result<String, String> {
    let info_file = design_root.join("_server.json");
    let tries = (timeout_ms / 200).max(1);

    for _ in 0..tries {
        if let Ok(bytes) = std::fs::read(&info_file) {
            if let Ok(info) = serde_json::from_slice::<ServerInfo>(&bytes) {
                if let Some(url) = info.url.filter(|u| !u.is_empty()) {
                    return Ok(url);
                }
                if let Some(port) = info.port {
                    return Ok(format!("http://localhost:{port}"));
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    Err(format!(
        "timed out after {timeout_ms} ms waiting for {}",
        info_file.display()
    ))
}

/// One-shot read of `_server.json` — unlike `wait_for_server`, does not poll or
/// time out. For callers that run AFTER the server is already known to be up
/// (e.g. `save_export` resolving a download URL for a running session), a
/// poll loop would be the wrong shape — this just returns `None` if the file
/// is absent/unparseable so the caller can surface its own clear error.
pub fn read_server_url(design_root: &std::path::Path) -> Option<String> {
    let bytes = std::fs::read(design_root.join("_server.json")).ok()?;
    let info: ServerInfo = serde_json::from_slice(&bytes).ok()?;
    if let Some(url) = info.url.filter(|u| !u.is_empty()) {
        return Some(url);
    }
    info.port.map(|p| format!("http://localhost:{p}"))
}

/// Enforce the DDR-109 §1 loopback-only invariant IN CODE at the navigate sites:
/// only ever navigate the webview to `http://localhost:*` / `http://127.0.0.1:*`.
/// Defense-in-depth — `_server.json` is cleared before spawn, but its `url` still
/// originates from a file under the (potentially untrusted) project root, so the
/// navigate target is validated rather than trusted (security review F3).
pub fn is_loopback_url(url: &tauri::Url) -> bool {
    url.scheme() == "http" && matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"))
}
