# DDR-108: GitHub auth — OAuth "Sign in with GitHub" in the system browser, token to OS keychain

- **Date:** 2026-06-16
- **Status:** Accepted (founding decision for the native-collab arc — phase-26 Task 1). Implementation lands in phase-28 (GitHub identity); recorded now so phase-28's plan has a stable reference.
- **Tags:** native-app, github, oauth, auth, identity, keychain, security, phase-28
- **Related:** [DDR-109](./DDR-109-native-shell-security-model.md) (where the token lives — OS keychain; the `maude://` callback allowlist), [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (the token authenticates clone/push), [DDR-106](./DDR-106-tauri-v2-native-shell-architecture.md) (the shell opens the system browser + handles the deep-link callback), [DDR-110](./DDR-110-three-lane-collaboration-model.md) (GitHub identity powers "share = invite collaborator"). Today there is no auth surface at all in `client/app.jsx` (zero `token`/`sign-in`/`onboard`), and hub tokens currently sit at `~/.config/maude/hubs.json` — the shell upgrades secrets to the keychain. Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md).

## Context

Phase-28 needs "Sign in with GitHub", create-repo (public/private), set-remote, push, and invite-collaborator — the "založit nový projekt a sharenout to s ostatními" pillar. The persona is non-technical: asking them to generate a Personal Access Token, pick scopes, and paste a hex string is a non-starter (too technical, over-scoped, and a long-lived secret on disk).

Three auth models: **PAT-paste**, **OAuth** (device flow or PKCE/loopback), or a **GitHub App**.

## Decision

**"Sign in with GitHub" via OAuth in the system browser. The user authorizes in their real browser session; the token returns to the app and is stored in the OS keychain — never on disk, never in `.design/`, never in `_server.json`. Scopes: `repo` + `read:user`. The GitHub App is a deferred upgrade for org installs + fine-grained collaborator management.**

### Flow

- The app opens the GitHub authorize URL in the **system browser** (not an embedded webview — embedding login pages is a phishing-shaped anti-pattern and breaks the user's existing GitHub session/2FA).
- Callback returns via either the **`maude://` deep-link** (registered in `tauri.conf.json`, allowlisted per DDR-109) **or** a transient **loopback redirect** (`http://127.0.0.1:<ephemeral>/callback`) — phase-28 picks one during implementation; both are loopback/allowlisted, neither exposes a public redirect.
- The resulting token goes straight to the OS keychain via the Tauri keychain plugin. The dev-server reads it from there for `/_api/github/*` and for authenticating git HTTPS (DDR-107).

### Why

- **No PAT paste** — removes the single most technical, most error-prone onboarding step and avoids a long-lived broad-scope secret living in a file.
- **System-browser OAuth** — reuses the user's logged-in GitHub session + 2FA; no credentials ever touch a Maude-controlled input field.
- **Keychain, not disk** — a GitHub `repo`-scoped token is high-value; it belongs in the OS secret store, consistent with DDR-109's "secrets never committed / never in `.design/`" rule and the existing "hub tokens never committed" posture.
- **OAuth App now, GitHub App later** — an OAuth App is the lowest lift for individual sign-in + repo create + push. A GitHub App (installation tokens, fine-grained per-repo permissions, org approval) is the right upgrade when org/team management and least-privilege collaborator control matter — but it's heavier to set up and not needed for the first milestone. Named as a future phase, not a silent gap.

### Scope notes

- **`repo` scope is broad** — accepted for the first cut (the persona needs create + push to private repos). The GitHub-App upgrade is where fine-grained scoping happens; document the trade-off in the phase-28 plan.
- **Private-repo default** — new repos created from the app default to **private** (non-technical safety; don't accidentally make someone's work-in-progress public).
- **Sign-out** clears the keychain entry.

## Consequences

- **Positive:** one-click, familiar "Sign in with GitHub"; no token literacy required; secrets in the OS store; clean path to the GitHub-App upgrade later.
- **Negative / accepted:** an OAuth App client-id/secret must exist (registered Maude GitHub OAuth App); the `repo` scope is broader than ideal until the GitHub-App phase; the device-flow-vs-PKCE choice is left to phase-28 implementation (both satisfy this DDR).
- **Security gate:** the callback path (deep-link or loopback) is allowlisted per DDR-109; the token never transits `_server.json` or any committed file.

## Alternatives considered

- **PAT paste** — rejected: too technical, over-scoped, long-lived secret on disk; exactly the friction this arc exists to remove.
- **GitHub App now** — rejected as the _starting_ point: heavier setup (installation flow, org approval) than the first milestone needs. Adopt later for org installs + fine-grained collaborator management.
- **Embedded-webview login** — rejected: phishing-shaped, breaks existing session/2FA, and a security smell in a desktop shell.
