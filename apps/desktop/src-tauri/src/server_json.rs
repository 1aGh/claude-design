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
