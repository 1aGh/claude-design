# DDR-114: GitHub identity implementation — OAuth App (device flow) boundary, hand-rolled REST, loopback token bridge

- **Date:** 2026-06-18
- **Status:** Accepted (phase-28 / epic E3 implementation). Realizes the founding [DDR-108](./DDR-108-github-auth-oauth-device-flow.md).
- **Tags:** native-app, github, oauth, device-flow, octokit, keychain, security, phase-28
- **Related:** [DDR-108](./DDR-108-github-auth-oauth-device-flow.md) (founding: OAuth not PAT, token→keychain, scopes `repo read:user`), [DDR-109](./DDR-109-native-shell-security-model.md) (loopback-only, secrets in keychain), [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (iso-git engine reused for `setRemote`), [DDR-112](./DDR-112-simplified-staging-model.md) / phase-27 git layer (the `/_api/git/*` + dual-allowlist pattern these endpoints mirror). Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md).

## Context

DDR-108 fixed the *what* (OAuth "Sign in with GitHub", token → OS keychain, scopes `repo read:user`, GitHub App deferred). Phase-28 implements it and had three decisions DDR-108 deliberately left to implementation, plus two deviations from the phase-28 plan text worth recording so a future reader isn't surprised by the code.

## Decisions

### 1. OAuth **App** + **device flow** (no redirect/callback, no client secret) — and the App-vs-GitHub-App boundary

We use a GitHub **OAuth App** with the **device flow** (`POST /login/device/code` → show a user code → poll `POST /login/oauth/access_token`). DDR-108 left "device flow vs PKCE/loopback redirect" open; device flow wins because:

- **No redirect URI, no `maude://` dependency for auth.** PKCE/loopback would couple sign-in to the deep-link/loopback-redirect plumbing (still unbuilt — phase-26 removed the deep-link plugin after the `did_finish_launching` crash). Device flow needs none of it: the app shows a code, the user types it on `github.com/login/device`. This is also exactly the mock the design phase produced (`GitHubIdentity.tsx` device-code artboard).
- **No client secret.** The device flow is a public-client grant — there is no secret to embed or leak. The `client_id` is not a secret and is compiled in (overridable via `MAUDE_GITHUB_CLIENT_ID`).
- **Reuses the real browser session + 2FA** (DDR-108's anti-phishing requirement) for free.

**OAuth App now, GitHub App later (the boundary):**

| | OAuth App (chosen) | GitHub App (deferred) |
|---|---|---|
| Auth as | the **user** (their token, their visible repos) | an **installation** (per-org/repo, fine-grained) |
| Token | user-scoped `repo read:user`, broad | installation token, per-repo scoped, short-lived |
| Create repo / invite collaborator | ✓ (user-owned repos) | ✓ + org-level controls |
| Org install / admin approval flow | ✗ (user grants their own scopes) | ✓ (the reason to upgrade) |
| Setup cost | one OAuth App, device-flow toggle | App manifest, install UX, JWT signing, token exchange |

The OAuth App's **documented limitations** (accepted for now): the `repo` scope is coarse (full control of all the user's repos, not just Maude's); no org-installation/admin-approval flow; no fine-grained per-repo permissions. The GitHub App upgrade (a later phase) addresses org installs + least-privilege; until a real org/enterprise need appears, the OAuth App is the lower-lift fit for the non-technical single-user persona.

### 2. Loopback **token bridge** for the sidecar (not a webview-exposed token)

The token lives in the OS keychain, owned by the **Tauri shell**. The dev-server runs as a **separate sidecar process** and cannot read the keychain or call Tauri IPC. So `keychain.rs` runs a **127.0.0.1-only `tiny_http` server** exposing `GET /_tauri/github-token`, and the shell passes its `(endpoint, per-launch key)` to the sidecar as env at spawn (`MAUDE_TOKEN_ENDPOINT` / `MAUDE_TOKEN_KEY`, `sidecar.rs`). The sidecar's `/_api/github/*` endpoints fetch the token from the bridge at request time (`github/token.ts`).

Guards (Task 3 acceptance): bound to loopback only; every request must carry the per-launch random `X-Maude-Token-Key` header (missing/wrong → **403**); only `GET /_tauri/github-token` is served (else **404/405**); the token is never logged. The webview/canvas is **never** handed the token — `get_token` is intentionally not a Tauri command; the webview only learns *whether* it's signed in (`github_is_signed_in`). In non-Tauri mode (`maude design serve` in a browser) the env is absent → `getGithubToken()` returns null → the github endpoints degrade to "sign in via the desktop app."

### 3. Sign-out is a **Tauri command**, not a dev-server endpoint

The phase-28 plan sketched `DELETE /_api/github/identity` for sign-out. But the dev-server **cannot delete a keychain entry** (it doesn't own the keychain). So sign-out is the `github_sign_out` Tauri command (`keychain.rs` → `delete_credential`), invoked from the webview. There is deliberately **no** `DELETE /_api/github/identity` route — it would be a dead end. `/_api/github/identity` is **GET-only** (read the profile via the bridge token).

## Deviations from the plan text (recorded so the code isn't surprising)

- **Hand-rolled `fetch`, not `@octokit/rest`.** Four simple REST calls (identity · create-repo · invite · list-repos) + one local iso-git `setRemote`. A `fetch` client (`github/service.ts`) keeps the `bun --compile` sidecar lean (no large mixed-module dep to bundle — relevant to the committed-runtime-bundle invariant), gives full control over the **non-technical error copy** (GitHub's raw 401/403/404/422 bodies are mapped to plain sentences), and reuses the phase-27 iso-git engine for the remote write. Bun ships global `fetch` + `AbortSignal.timeout`. If pagination/retries/webhooks grow, revisit `@octokit/rest`.
- **Create-repo defaults to PRIVATE** (`b.private !== false`) — the non-technical-safety default DDR-108/the plan call for; public is an explicit opt-in in the wizard.

## Consequences

- **Setup gate:** sign-in is inert until the `1aGh` OAuth App exists and its `client_id` is wired (`oauth.rs` constant or `MAUDE_GITHUB_CLIENT_ID`). Until then `github_sign_in` returns a friendly "not set up yet" message. Steps: `apps/desktop/README-github-oauth.md`.
- **Security surface:** the token never reaches the webview or the untrusted canvas iframe; the bridge is loopback + key-gated; every `/_api/github/*` route is main-origin-only (absent from `CANVAS_SAFE_API` + `startCanvasServer` routes) and loopback-Host-gated, asserted in `canvas-origin-gate.test.ts`.
- **Coarse scope** (the OAuth App `repo` limitation) is the accepted trade-off until a GitHub App phase.
