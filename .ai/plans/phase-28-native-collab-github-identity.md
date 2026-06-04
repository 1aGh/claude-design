# Phase 28 — Native Maude: GitHub identity & remote

Validate docs and codebase patterns before implementing. Pay attention to the OAuth token never landing in `_server.json` or `.design/`, DDR-045 disk paths, and the `canvas-create.ts` security pattern for all new endpoints.

## Description

Add "Sign in with GitHub" via OAuth device flow. The token lands in the OS keychain (Tauri), never on disk. Wire `/_api/github/*` endpoints for create-repo, set-remote, and invite-collaborator. After this phase a user can create a new GitHub repo, push their first canvas, and share it with a teammate — entirely from the Maude UI.

**Phase milestone:** A non-technical user can sign in with GitHub, create a new project repo, and invite a collaborator — no terminal, no PAT, no GitHub.com needed.

## User Story

As a non-technical collaborator, I want to sign in with GitHub and create or share a project in one click, so that I never paste a token or navigate GitHub.com to set up collaboration.

## Problem

Hub linking requires `maude design link <url> --token <hex>` from the CLI. Creating a GitHub repo and setting up collaboration requires navigating GitHub.com. Both are blockers for the non-technical target audience.

## Solution

1. OAuth device flow in the Tauri shell (Rust) — opens the system browser, polls for the token, stores it in the OS keychain via `tauri-plugin-keychain`.
2. `/_api/github/*` endpoints in the dev-server, reading the token from keychain via a Tauri command (IPC bridge).
3. A GitHub identity bar in the client (avatar + name + "Sign in" / "Sign out").

## Metadata

- **Type:** New Capability
- **Complexity:** High (Rust OAuth flow, OS keychain, Octokit REST)
- **App/Package:** `apps/desktop/src-tauri/` (OAuth flow + keychain) + `plugins/design/dev-server/` (github endpoints) + client UI
- **Depends on:** phase-26 (Tauri shell), phase-27 (git layer — `create-repo` wires into git clone)
- **Dependencies (new):** `tauri-plugin-keychain` (Rust), `@octokit/rest` (dev-server)

---

## Context References

### Must-Read Files

> Read in parallel.

- `.ai/docs/epic-native-collab-app.md` § E3 — full scope.
- `plugins/design/dev-server/canvas-create.ts` — security pattern for all new write endpoints.
- `plugins/design/dev-server/http.ts` — route registration; dual-allowlist rule.
- `cli/lib/design-link.mjs` + `cli/commands/design.mjs` (`runLink`, `runAdopt`) — existing hub-connect plumbing. Phase-28's "paste a hub token" advanced path surfaces this as a UI action rather than reimplementing it.
- `plugins/design/dev-server/sync/hubs-config.ts` — where hub tokens live today (`~/.config/maude/hubs.json`). Phase-28 moves GitHub tokens to OS keychain; hub tokens stay in `hubs-config.ts` for now (upgraded to keychain in phase-32).
- `apps/desktop/src-tauri/src/` — existing shell code from phase-26.

### Files to Create

- `apps/desktop/src-tauri/src/oauth.rs` — GitHub device-flow implementation
- `apps/desktop/src-tauri/src/keychain.rs` — keychain read/write via `tauri-plugin-keychain`
- `plugins/design/dev-server/github/service.ts` — Octokit wrapper (`createRepo`, `setRemote`, `inviteCollaborator`, `getIdentity`)
- `plugins/design/dev-server/github/endpoints.ts` — `/_api/github/*` handlers
- `plugins/design/dev-server/client/panels/IdentityBar.jsx` — avatar + name + sign-in/out

### Design canvases

> **Mock-first before Task 3.**

| Canvas (to create) | Screens needed |
| --- | --- |
| `GitHubIdentity.tsx` | Sign-in flow (device code screen: "Go to github.com/login/device, enter XXXX-XXXX"), signed-in state (avatar + username), sign-out confirmation |
| `CreateProject.tsx` | Create new repo (name, private/public toggle, description), "Open existing" (clone URL or picker), share sheet (invite by GitHub username, copy invite link) |

### Documentation

- [GitHub OAuth device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) — `POST /login/device/code`, poll `POST /login/oauth/access_token`. Why: the sign-in mechanism.
- [tauri-plugin-keychain](https://github.com/tauri-apps/tauri-plugin-keychain) — `set_password`, `get_password`. Why: secure token storage.
- [Octokit REST — repos.createForAuthenticatedUser](https://octokit.github.io/rest.js/v21/#repos-create-for-authenticated-user) — Why: create-repo endpoint.
- [GitHub — Add collaborator](https://docs.github.com/en/rest/collaborators/collaborators#add-a-repository-collaborator) — Why: invite endpoint.

---

## Tasks

### Task 1: `/design:new` — GitHub identity + create-project mockups

- **Do:** Run `/design:new` for `GitHubIdentity` + `CreateProject` canvases. Include device-code screen, all states. Critic panel sign-off before Task 2.
- **Validate:** Canvases with `status: ready-for-handoff`.

### Task 2: GitHub OAuth device flow (Rust)

- **Do:** Implement `apps/desktop/src-tauri/src/oauth.rs`:
  - `start_device_flow(client_id) -> (device_code, user_code, verification_uri, interval)`
  - `poll_for_token(device_code, interval) -> Result<String>` — polls `POST /login/oauth/access_token` at `interval` seconds until granted or expired.
  - Expose as Tauri commands: `#[tauri::command] async fn github_sign_in(app: AppHandle) -> Result<String, String>`.
  - The command opens the system browser at `verification_uri`, shows the `user_code` in a native dialog, polls in the background.
  - On success: store token in keychain (`keychain::set("maude-github-token", token)`).
- **Gotcha:** Device flow requires a GitHub OAuth App with "Device flow" enabled. Create a `maude` OAuth App under the `1aGh` org. The `client_id` is NOT a secret — it can be compiled in. The token IS a secret — keychain only, never disk.
- **Validate:** Run the Tauri app → "Sign in with GitHub" → browser opens → enter code → app shows avatar within 10 s.

### Task 3: Keychain IPC bridge

- **Do:** Implement `keychain.rs` with `get_github_token() -> Option<String>` and `delete_github_token()`. Expose as Tauri commands. The dev-server cannot read the OS keychain directly — it's a browser context. Instead: the Tauri shell exposes a loopback-only IPC endpoint `GET /_tauri/github-token` that the dev-server calls at request time to retrieve the token for use with Octokit.
  - **Security:** `/_tauri/github-token` must be loopback-only AND absent from `CANVAS_SAFE_API` (canvas iframe must never be able to retrieve the token).
- **Validate:** `curl http://127.0.0.1:<port>/_tauri/github-token` from loopback returns the token; request from any other origin returns 403.

### Task 4: `github/service.ts` — Octokit wrapper

- **Do:** Add `@octokit/rest` to dev-server. Implement:
  - `getIdentity(token)` → `{login, avatar_url, name}`
  - `createRepo(token, {name, private, description})` → `{clone_url, html_url}`
  - `setRemote(designRoot, remoteUrl)` → uses isomorphic-git (from phase-27) to `git remote add origin`
  - `inviteCollaborator(token, owner, repo, username)` → GitHub collaborators API
  - `listUserRepos(token)` → for the "open existing" picker
- **Validate:** Unit tests with a real scratch GitHub account (not mocked — auth shape matters).

### Task 5: Wire `/_api/github/*` endpoints

- **Do:** Register in `http.ts` (main-origin-only):
  - `GET /_api/github/identity` → `getIdentity(token from /_tauri/github-token)`
  - `POST /_api/github/create-repo` → body `{name, private}` → `createRepo` + `setRemote`
  - `POST /_api/github/invite` → body `{username}` → `inviteCollaborator`
  - `GET /_api/github/repos` → `listUserRepos`
- **Security:** All write endpoints: main-origin-only, canvas-origin-gate asserted in test.
- **DDR:** Write "OAuth App vs GitHub App boundary" DDR — App is deferred (for org installs + fine-grained collaborator mgmt); OAuth App is the current choice with documented limitations.
- **Validate:** Canvas-origin-gate test entries for all write endpoints.

### Task 6: `IdentityBar` client component + `CreateProject` panel

- **Do:** Per approved mockups:
  - `IdentityBar.jsx` — mounts in the sidebar header. Shows avatar + username when signed in, "Sign in with GitHub" button when not. "Sign out" clears keychain via `DELETE /_api/github/identity`.
  - `CreateProject.jsx` — "New project" wizard: name + private toggle → `POST /_api/github/create-repo` → clones via phase-27's `gitPull` → opens the canvas browser for the new project. "Open existing" — clone URL field → `gitClone` (add to phase-27's service).
  - Share sheet: "Invite collaborator" field (GitHub username) → `POST /_api/github/invite` → confirmation toast.
- **Validate:** agent-browser scenario: sign in → create repo → repo appears on GitHub.com → invite by username → invitee receives GitHub email.

---

## Validation

1. **Tests:** `bun test` — git-api + github-api endpoint matrices green.
2. **Security:** `flow:validate-security` — token never in response bodies that canvas origin can read; `/_tauri/github-token` loopback-only; all write endpoints canvas-origin-gated.
3. **Scenario:** Sign in → create repo → open in Maude → edit canvas → Save version → Publish → collaborator receives invite.
4. **Zero regression:** existing CLI / hub paths unaffected.

## Acceptance Criteria

- [ ] Mockups approved (Task 1)
- [ ] OAuth device flow works end-to-end, token in keychain (Task 2)
- [ ] Keychain IPC bridge loopback-only, canvas-origin-gated (Task 3)
- [ ] Octokit service: create-repo, invite, list (Task 4)
- [ ] All `/_api/github/*` endpoints canvas-origin-gated (Task 5)
- [ ] IdentityBar + CreateProject per mockup (Task 6)
- [ ] OAuth App vs GitHub App DDR written
- [ ] Security pass
