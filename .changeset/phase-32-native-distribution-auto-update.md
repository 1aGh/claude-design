---
"@1agh/maude": minor
---

Native app distribution & auto-update (Phase 32) — Maude is now a real desktop app for macOS and Windows that keeps itself current with no terminal.

- **Maude is a desktop app.** Download an installer for **macOS** (`.dmg`) or **Windows** (`.msi`), open it, sign in with GitHub, and start designing — no terminal at any step. New `/desktop` download page on the site with platform detection, system requirements, and an FAQ.
- **Auto-update.** The app polls a signed release feed, downloads new versions in the background, and shows a non-blocking **"Maude updated · restart to apply"** banner — one click puts you on the latest. Updates are ed25519-signed and verified before install, so a tampered feed can't push a rogue build. No `npm`, no command line.
- **Windows installer in CI.** The desktop build pipeline now produces a (optionally code-signed) Windows `.msi` alongside the macOS `.dmg`, with the auto-update artifacts signed on both.
- **Opt-in crash reporting (local-only).** A first-run checkbox (default **off**) lets you write a scrubbed local crash log — stack trace + OS + version, never canvas content, file paths, or tokens — that you can attach to an issue. Nothing leaves your machine.
- **What's New, kept current.** The in-app "What's New" badge now re-checks on window focus, so a background update surfaces it without a reload.
