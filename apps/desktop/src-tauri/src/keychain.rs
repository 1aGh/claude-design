// keychain.rs — OS keychain storage for the GitHub token + a loopback-only HTTP
// bridge so the sidecar (dev-server) can read it at request time (Phase 28 / DDR-108).
//
// Why a bridge? The token lives in the OS keychain (macOS Keychain / Windows
// Credential Manager / Linux Secret Service). The dev-server runs as a SEPARATE
// process (a Tauri sidecar) and cannot call Tauri IPC or the OS keychain directly,
// so when its `/_api/github/*` endpoints need the token for Octokit, they fetch it
// over loopback from this bridge.
//
// SECURITY (Task 3 acceptance):
//   • The bridge binds to 127.0.0.1 only — unreachable off-loopback.
//   • Every request must carry a per-launch random `X-Maude-Token-Key` header that
//     ONLY the sidecar is told (passed via env at spawn). So neither the untrusted
//     canvas iframe (which can't reach this ephemeral port at all) nor a casual
//     local process can read the token. Missing/wrong key → 403.
//   • Only `GET /_tauri/github-token` is served; everything else → 404/405.
//   • The token is never logged. `github_get_token` is deliberately NOT exposed to
//     the webview — the webview only learns *whether* you're signed in, never the
//     token itself.

use std::sync::OnceLock;

use keyring::Entry;

/// Keychain coordinates. One credential: the GitHub access token.
const KEYCHAIN_SERVICE: &str = "com.maude.app.github";
const KEYCHAIN_ACCOUNT: &str = "maude-github-token";

const BRIDGE_PATH: &str = "/_tauri/github-token";
const KEY_HEADER: &str = "X-Maude-Token-Key";

fn entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

/// Store the token (overwrites any prior). Called from the OAuth flow only.
pub fn set_token(token: &str) -> Result<(), String> {
    entry()?.set_password(token).map_err(|e| e.to_string())
}

/// Read the token, or `None` if not signed in. Internal — never exposed to the webview.
pub fn get_token() -> Option<String> {
    match entry() {
        Ok(e) => e.get_password().ok(),
        Err(_) => None,
    }
}

/// Delete the token (sign out). Idempotent — a missing entry is success.
pub fn delete_token() -> Result<(), String> {
    let e = entry()?;
    match e.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

// ── loopback token bridge ────────────────────────────────────────────────────

struct Bridge {
    port: u16,
    key: String,
}
static BRIDGE: OnceLock<Bridge> = OnceLock::new();

fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    // getrandom is infallible on every platform Maude targets; fall back to a
    // time-seeded value rather than panicking if the OS RNG were ever unavailable.
    if getrandom::getrandom(&mut buf).is_err() {
        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        for (i, b) in buf.iter_mut().enumerate() {
            *b = ((seed >> (i % 16 * 8)) as u8) ^ (i as u8).wrapping_mul(31);
        }
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// Start the loopback token bridge on an ephemeral 127.0.0.1 port (idempotent).
/// Returns immediately; the server loop runs on a background thread.
pub fn start_token_bridge() -> Result<(), String> {
    if BRIDGE.get().is_some() {
        return Ok(());
    }
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("could not bind token bridge: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .ok_or_else(|| "token bridge has no port".to_string())?;
    let key = random_hex(32);
    let key_for_thread = key.clone();

    std::thread::Builder::new()
        .name("maude-token-bridge".into())
        .spawn(move || {
            for req in server.incoming_requests() {
                handle_request(req, &key_for_thread);
            }
        })
        .map_err(|e| format!("could not start token bridge thread: {e}"))?;

    let _ = BRIDGE.set(Bridge { port, key });
    eprintln!("[maude] github token bridge on 127.0.0.1:{port}");
    Ok(())
}

/// The `(endpoint_url, key)` the sidecar needs to read the token, or `None` if the
/// bridge isn't up. Passed to the sidecar as env at spawn (sidecar.rs).
pub fn bridge_env() -> Option<(String, String)> {
    BRIDGE.get().map(|b| {
        (
            format!("http://127.0.0.1:{}{}", b.port, BRIDGE_PATH),
            b.key.clone(),
        )
    })
}

fn handle_request(req: tiny_http::Request, key: &str) {
    let is_get = req.method() == &tiny_http::Method::Get;
    let path_ok = req.url() == BRIDGE_PATH;
    let key_ok = req
        .headers()
        .iter()
        .any(|h| h.field.equiv(KEY_HEADER) && h.value.as_str() == key);

    // Wrong route → 404; wrong method on the route → 405; bad/missing key → 403.
    let status: u16 = if !path_ok {
        404
    } else if !is_get {
        405
    } else if !key_ok {
        403
    } else {
        200
    };

    let body = if status == 200 {
        match get_token() {
            Some(t) => t,
            // Authenticated bridge request but not signed in → 404 (no token).
            None => return respond(req, 404, String::new()),
        }
    } else {
        String::new()
    };
    respond(req, status, body);
}

fn respond(req: tiny_http::Request, status: u16, body: String) {
    let resp = tiny_http::Response::from_string(body).with_status_code(status);
    let _ = req.respond(resp);
}

// ── webview commands (NO token ever crosses to the webview) ──────────────────

/// Whether a GitHub token is currently stored. Drives the IdentityBar's signed-in
/// state on launch. Returns only a boolean — never the token.
#[tauri::command]
pub fn github_is_signed_in() -> bool {
    get_token().is_some()
}

/// Sign out — delete the keychain token. Idempotent.
#[tauri::command]
pub fn github_sign_out() -> Result<(), String> {
    delete_token()
}
