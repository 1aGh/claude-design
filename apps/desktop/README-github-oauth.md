# GitHub sign-in setup (Phase 28 / DDR-108)

Maude's native app signs in with **GitHub's OAuth device flow** — no Personal
Access Token paste. This needs a **GitHub OAuth App** with *Device flow* enabled.
The app's **Client ID is not a secret** (it only identifies the app), so it is
compiled into the binary. There is **no client secret** — the device flow doesn't
use one. The user's **access token is a secret** and is stored only in the OS
keychain, never on disk.

Until the OAuth App exists and its Client ID is filled in below, "Sign in with
GitHub" returns a friendly *"GitHub sign-in isn't set up yet"* message instead of a
confusing GitHub error — everything else (the dev-server, git layer, canvases) works.

## One-time setup (maintainer)

1. Go to **https://github.com/organizations/1aGh/settings/applications** →
   **New OAuth App** (an *OAuth App*, not a GitHub App — see DDR in
   `.ai/decisions/` for why OAuth App now, GitHub App later).
2. Fill in:
   - **Application name:** `Maude`
   - **Homepage URL:** `https://maude.sh` (or the repo URL)
   - **Authorization callback URL:** `https://maude.sh/auth/callback` — *required by
     the form but unused by the device flow.* Any valid URL is fine.
3. **Register application.**
4. On the app's settings page, tick **"Enable Device Flow"** and **Update application**.
   (This is the load-bearing step — without it `POST /login/device/code` 404s.)
5. Copy the **Client ID** (looks like `Iv1.abc123…` or `Ov23li…`).

## Wire it in

Two ways — pick one:

- **Compiled in (release):** edit `src-tauri/src/oauth.rs` and replace the
  `GITHUB_CLIENT_ID` placeholder:
  ```rust
  const GITHUB_CLIENT_ID: &str = "Iv1.your_real_client_id";
  ```
- **Runtime override (dev / per-machine):** set the env var before launching —
  ```sh
  MAUDE_GITHUB_CLIENT_ID=Iv1.your_real_client_id pnpm dev:desktop
  ```
  The env override wins over the compiled-in constant.

## Scopes requested

`repo read:user` — `repo` lets a user create private/public project repos and
manage collaborators (the "create a project" + "share" flows); `read:user` reads
the signed-in profile for the identity bar. GitHub shows the user exactly these
scopes on the device-authorization page.

## How it flows (for reviewers)

```
webview                Rust shell (oauth.rs)            GitHub            keychain
  invoke github_sign_in ─▶ POST /login/device/code ─────▶
                          ◀─ user_code, verification_uri
   ◀─ emit github://device-code (show the code modal)
                          open browser at github.com/login/device
                          poll POST /login/oauth/access_token ─▶
                          ◀───────────── access_token (after user authorizes)
                          set_token(token) ──────────────────────────────▶ (keychain)
   ◀─ resolves: login (public handle, NOT the token)
```

The dev-server (sidecar) later reads the token over the **loopback token bridge**
(`keychain.rs` → `GET /_tauri/github-token`, 127.0.0.1-only, per-launch key header)
when its `/_api/github/*` endpoints need it for Octokit. The token never reaches
the webview or the untrusted canvas iframe.

## Validation checklist (after wiring the Client ID)

- [ ] Launch the bundled app → IdentityBar shows "Sign in with GitHub".
- [ ] Click it → the system browser opens `github.com/login/device` and the app
      shows a code (e.g. `WDJB-MJHT`) within ~2 s.
- [ ] Enter the code + authorize → the app flips to "Connected" (avatar + login)
      within ~10 s.
- [ ] Quit + relaunch → still signed in (token persisted in keychain).
- [ ] Sign out → `github_is_signed_in` returns false; keychain entry gone.
- [ ] `curl http://127.0.0.1:<bridge-port>/_tauri/github-token` **without** the key
      header → `403`; with the wrong path → `404`.
