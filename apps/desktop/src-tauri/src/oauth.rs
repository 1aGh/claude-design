// oauth.rs — GitHub OAuth **device flow** sign-in (Phase 28 / DDR-108).
//
// Non-technical sign-in with no PAT paste: we POST for a device+user code, open
// the system browser at github.com/login/device, show the user the short code
// (the webview renders the GitHubIdentity device-code modal off the emitted
// `github://device-code` event), and poll GitHub until the user authorizes.
//
// SECURITY — the access token is a SECRET:
//   • It goes ONLY to the OS keychain (`keychain::set_token`) — never to disk,
//     never to `_server.json`/`.design/`, never logged or echoed to the webview.
//   • `github_sign_in` returns only the **login** (a public handle) so the UI can
//     flip to "Connected"; the full profile comes from `/_api/github/identity`,
//     which reads the token via the loopback bridge (keychain.rs).
//
// The `client_id` is NOT a secret (it merely identifies the OAuth App) and is
// compiled in / overridable via `MAUDE_GITHUB_CLIENT_ID`. *** SETUP REQUIRED ***:
// create a GitHub OAuth App under the `1aGh` org with **Device flow enabled** and
// drop its Client ID into `GITHUB_CLIENT_ID` below (see
// `apps/desktop/README-github-oauth.md`). Until then sign-in fails with a clear,
// non-technical message instead of a confusing GitHub error.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

/// The Maude GitHub OAuth App client id. NOT a secret. Replace the placeholder
/// once the `1aGh` OAuth App exists (or set `MAUDE_GITHUB_CLIENT_ID` at runtime).
const GITHUB_CLIENT_ID: &str = "Ov23liQZXn0jbRdYbKkk";
const CLIENT_ID_PLACEHOLDER: &str = "REPLACE_WITH_MAUDE_OAUTH_APP_CLIENT_ID";

/// Scopes: `repo` (create private/public repos + manage collaborators) and
/// `read:user` (read the signed-in profile for the identity bar).
const OAUTH_SCOPE: &str = "repo read:user";

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_URL: &str = "https://api.github.com/user";
const USER_AGENT: &str = "maude-desktop";

/// Resolve the client id: `MAUDE_GITHUB_CLIENT_ID` env override → compiled-in
/// constant. Returns a friendly error while the placeholder is still in place.
fn client_id() -> Result<String, String> {
    if let Ok(v) = std::env::var("MAUDE_GITHUB_CLIENT_ID") {
        if !v.trim().is_empty() {
            return Ok(v.trim().to_string());
        }
    }
    if GITHUB_CLIENT_ID == CLIENT_ID_PLACEHOLDER {
        return Err(
            "GitHub sign-in isn't set up yet — Maude needs its GitHub app to be configured. \
             (Developer: create the `1aGh` OAuth App with Device flow enabled and set the \
             client id — see apps/desktop/README-github-oauth.md.)"
                .to_string(),
        );
    }
    Ok(GITHUB_CLIENT_ID.to_string())
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default = "default_interval")]
    interval: u64,
    #[serde(default)]
    expires_in: u64,
}
fn default_interval() -> u64 {
    5
}

/// Emitted to the webview so the GitHubIdentity device-code modal can render the
/// code + verification URL. Deliberately carries NO secret (the `device_code` —
/// the pollable secret half — stays in Rust).
#[derive(Serialize, Clone)]
struct DeviceCodeEvent {
    user_code: String,
    verification_uri: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct GitHubUser {
    login: String,
}

/// POST for a device+user code.
async fn request_device_code(
    client: &reqwest::Client,
    client_id: &str,
) -> Result<DeviceCodeResponse, String> {
    let resp = client
        .post(DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[("client_id", client_id), ("scope", OAUTH_SCOPE)])
        .send()
        .await
        .map_err(|_| "Couldn't reach GitHub. Check your internet connection and try again.".to_string())?;
    if !resp.status().is_success() {
        return Err("GitHub couldn't start sign-in. Try again in a moment.".to_string());
    }
    resp.json::<DeviceCodeResponse>()
        .await
        .map_err(|_| "GitHub sent an unexpected response. Try again.".to_string())
}

/// Poll the token endpoint until the user authorizes (or the code expires / is
/// denied). Honors `interval` and the `slow_down` back-off.
async fn poll_for_token(
    client: &reqwest::Client,
    client_id: &str,
    device_code: &str,
    interval: u64,
) -> Result<String, String> {
    let mut wait = interval.max(1);
    loop {
        sleep(Duration::from_secs(wait)).await;
        let resp = client
            .post(ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", client_id),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|_| "Lost connection to GitHub while signing in. Try again.".to_string())?;
        let body = resp
            .json::<AccessTokenResponse>()
            .await
            .map_err(|_| "GitHub sent an unexpected response. Try again.".to_string())?;

        if let Some(token) = body.access_token {
            return Ok(token);
        }
        match body.error.as_deref() {
            Some("authorization_pending") => continue,
            Some("slow_down") => {
                wait += 5;
                continue;
            }
            Some("expired_token") => {
                return Err("That code expired — start sign-in again to get a fresh one.".to_string())
            }
            Some("access_denied") => {
                return Err("Sign-in was cancelled. You can try again any time.".to_string())
            }
            other => {
                // Don't surface raw GitHub error codes to a non-technical user.
                eprintln!("[maude] github device-flow error: {:?}", other);
                return Err("Sign-in didn't finish. Please try again.".to_string());
            }
        }
    }
}

/// GET the signed-in user's login (public handle). The token is used once here
/// and never returned to the webview.
async fn fetch_login(client: &reqwest::Client, token: &str) -> Result<String, String> {
    let resp = client
        .get(USER_URL)
        .header("Accept", "application/vnd.github+json")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| "Signed in, but couldn't load your GitHub profile. Try again.".to_string())?;
    if !resp.status().is_success() {
        return Err("Signed in, but GitHub declined the profile request. Try again.".to_string());
    }
    Ok(resp
        .json::<GitHubUser>()
        .await
        .map_err(|_| "GitHub sent an unexpected profile response.".to_string())?
        .login)
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "Couldn't start the sign-in client.".to_string())
}

/// `#[tauri::command]` — the whole device flow, awaited by the webview.
///
/// 1. POST for a device+user code → emit `github://device-code` so the modal shows
///    the code, and open the browser at the verification URL.
/// 2. Poll until authorized (or expired/denied).
/// 3. Store the token in the OS keychain (never on disk) and return the **login**.
#[tauri::command]
pub async fn github_sign_in(app: AppHandle) -> Result<String, String> {
    // E2E (debug builds only): the device flow opens the system browser + polls GitHub —
    // neither DOM-drivable nor deterministic. With MAUDE_E2E_FAKE_GITHUB_LOGIN set, show a
    // deterministic device-code modal, "authorize" after a beat, then report the fake
    // login — no browser, no network, no keychain write. Gated on `debug_assertions`, so
    // it is NEVER in the release `.app`. See the `desktop-e2e` skill.
    #[cfg(debug_assertions)]
    if let Ok(login) = std::env::var("MAUDE_E2E_FAKE_GITHUB_LOGIN") {
        if !login.is_empty() {
            let _ = app.emit(
                "github://device-code",
                DeviceCodeEvent {
                    user_code: "E2E-CODE".to_string(),
                    verification_uri: "https://github.com/login/device".to_string(),
                    expires_in: 900,
                },
            );
            sleep(Duration::from_millis(2500)).await;
            let _ = app.emit("github://signed-in", &login);
            return Ok(login);
        }
    }

    let client_id = client_id()?;
    let client = http_client()?;

    let dc = request_device_code(&client, &client_id).await?;

    // Show the code in the UI (the device-code modal listens for this).
    let _ = app.emit(
        "github://device-code",
        DeviceCodeEvent {
            user_code: dc.user_code.clone(),
            verification_uri: dc.verification_uri.clone(),
            expires_in: dc.expires_in,
        },
    );
    // Best-effort: open the verification page in the system browser.
    if let Err(e) = open::that(&dc.verification_uri) {
        eprintln!("[maude] could not open browser for device flow: {e}");
    }

    let token = poll_for_token(&client, &client_id, &dc.device_code, dc.interval).await?;

    // The token is a secret → keychain only.
    crate::keychain::set_token(&token)
        .map_err(|e| format!("Signed in, but couldn't save it securely: {e}"))?;

    let login = fetch_login(&client, &token).await?;
    let _ = app.emit("github://signed-in", &login);
    Ok(login)
}

/// `#[tauri::command]` — re-open the verification URL (the modal's "Open it again").
#[tauri::command]
pub fn github_open_verification(url: String) -> Result<(), String> {
    // Only ever the GitHub device-verification URL — refuse anything else so this
    // can't be turned into an arbitrary-URL opener from the webview.
    if url != "https://github.com/login/device" {
        return Err("Refusing to open a non-GitHub URL.".to_string());
    }
    open::that(&url).map_err(|e| format!("Couldn't open the browser: {e}"))
}

/// `#[tauri::command]` — open a github.com URL (a PR link, repo page, …) in the OS
/// browser. Host-locked to github.com: the prefix requires the char after the host to
/// be `/`, so `github.com@evil` / `github.com.evil` can't smuggle another host, and we
/// reject whitespace — the untrusted webview can't turn this into an arbitrary-URL
/// opener (DDR-054 posture, same rationale as `github_open_verification`).
#[tauri::command]
pub fn open_github_url(url: String) -> Result<(), String> {
    // Host-locked to github.com (the trailing `/` closes the URL authority — no
    // `@`/label host-smuggle), length-capped, and rejecting bytes that could re-open
    // the authority (`@`, `\`) or that Rust std's Windows launcher has historically
    // mishandled as cmd-metacharacters (CVE-2024-24576). The only caller passes a
    // github.com PR html_url. (F3)
    let ok = url.starts_with("https://github.com/")
        && url.len() <= 2048
        && !url.contains(|c: char| {
            c.is_whitespace()
                || c.is_control()
                || matches!(c, '@' | '\\' | '&' | '|' | '^' | '<' | '>' | '"' | '\'' | '`')
        });
    if !ok {
        return Err("Refusing to open a non-GitHub URL.".to_string());
    }
    open::that(&url).map_err(|e| format!("Couldn't open the browser: {e}"))
}
