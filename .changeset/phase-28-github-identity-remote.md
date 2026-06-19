---
"@1agh/maude": minor
---

Sign in with GitHub (Phase 28, epic E3) — start, share, and sync design projects without a terminal (native app).

- **Sign in with GitHub** from the account bar — a plain device-code flow ("enter this code"), token stored in the OS keychain, never on disk and never exposed to the canvas.
- **New project** creates a private GitHub repo, scaffolds `.design/`, and opens it; **Pull a local copy** clones one of your repos (or a pasted link) to a folder you pick. A non-Maude folder offers a one-click "Set up Maude here".
- **Share** invites a collaborator by GitHub username.
- **Publish / Get latest** now use your GitHub sign-in (no system-git helper needed). A "Get latest" nudge surfaces when a teammate has published changes.
- **Merge-conflict resolution in the UI**: when you both changed the same canvas, "Get latest" opens the visual resolver — Keep mine / Keep theirs / Keep both (Keep both saves your version as a copy, zero data loss) — and completes the merge with no terminal.

Security: GitHub access stays confined to the keychain via a loopback token bridge (never reaches the webview/canvas); the clone-URL host is anchored to `github.com` so a crafted link can't redirect the token elsewhere; every `/_api/github/*` + `/_api/git/*` route is main-origin-only (dual-allowlist) + CSRF + loopback gated. See DDR-114 (OAuth-App boundary) and DDR-116 (in-UI conflict resolution).
