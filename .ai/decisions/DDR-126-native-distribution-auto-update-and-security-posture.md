# DDR-126 — Native distribution: auto-update model, signing-key custody, local crash reporting + the phase-32 security posture

**Status:** accepted · **Date:** 2026-06-23 · **Phase:** 32 (Native Maude: distribution, auto-update & maintenance)
**Relates:** DDR-106 (Tauri shell + sidecar), DDR-108/109 (OAuth boundary + main-origin CSP / loopback trust model), DDR-054 (untrusted-canvas trust model), DDR-015 (per-platform sub-package version lockstep)

## Context

Phase-26 shipped the Tauri shell as an unsigned `.dmg`; everything since (git layer, GitHub identity, multiplayer, ACP chat) made the native app the primary surface. Phase-32 makes it **distributable to non-technical users**: a real installer per platform, silent background updates, and a download page — no `npm install -g`, no terminal. Three choices had no obvious default and were taken to the owner.

## Decision 1 — Auto-update via a dynamic Vercel feed + Rust-driven check/install

- **`tauri-plugin-updater`**, configured in `tauri.conf.json` (`plugins.updater`): a single HTTPS endpoint `https://maude.sh/releases/{{target}}/{{arch}}/{{current_version}}` + a pinned ed25519 `pubkey`; `bundle.createUpdaterArtifacts: true`.
- **The feed is a Vercel edge route** (`site/app/releases/[target]/[arch]/[current_version]/route.ts`) that reads the GitHub Releases "latest" and returns the signed updater JSON (or 204). Chosen over a static `latest.json` uploaded to the release (the other option offered) because the dynamic route gives per-platform/arch resolution + version compare server-side and reuses the site we already deploy. (The production host is **`maude.sh`** — the plan's `maude.1agh.dev` was wrong; corrected in all shipped code.)
- **The check/download/install loop lives entirely in Rust** (`src/updater.rs`): check on boot + window-focus + every 4 h, `download_and_install` in the background, then emit `update-ready` → a non-blocking client banner ("Maude updated · restart to apply") → `restart_to_update`. The webview is **never** granted `updater:default` — the only update-related command exposed to the (remote loopback) main origin is the narrow `restart_to_update`, and that is **guarded to no-op unless an update is genuinely staged** (so a forged call can't loop-restart the app). Rationale: the dev-server UI is a remote origin (DDR-108/109); keeping the updater in the trusted Rust core is least-privilege.

## Decision 2 — Signing-key custody

- **The ed25519 updater key was generated during this phase**; the public half is committed in `tauri.conf.json`, the private half + (empty) password go to GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The signature is the **sole** trust control for updates — verified before install — so the key is the update trust root: losing it = can't ship updates; leaking it = universal silent RCE. Custody is the owner's (handed off out-of-band, never in the repo).
- **Platform code-signing is independent and optional.** macOS notarization (`APPLE_*`) and Windows Authenticode (`WINDOWS_CERTIFICATE` PFX, imported + thumbprint-injected via `--config` in CI) both degrade gracefully to an **unsigned** installer when the secret is absent (mirrors phase-26). Unsigned installers still auto-update (the ed25519 signing is separate); users just get a one-time Gatekeeper/SmartScreen prompt.

## Decision 3 — Crash reporting is a local file, not Sentry

- Chosen over the Sentry Rust SDK (the other option offered). `src/crash_reporter.rs` installs a panic hook that — **only** when `prefs.crash_reporting` is opted in (default **off**, an explicit first-run checkbox) — writes a scrubbed `crashes/crash-<ts>.log` (panic message + source location + backtrace + OS + version; **no** canvas content, user-data paths, or tokens). Nothing leaves the machine; no DSN, no third party, no account to create before shipping. Logs are capped (most-recent 10, pruned at startup).

## Decision 4 — Version lockstep extends to the desktop crate

`apps/desktop/src-tauri/tauri.conf.json` `version` (drives the updater's `{{current_version}}`) and `Cargo.toml` `[package].version` (drives the native About box) now move with `package.json` + the plugin manifests + the per-platform sub-packages. `scripts/bump-version.sh` bumps all of them; `scripts/check-version-parity.sh` asserts them. They ship under one release line.

## Security posture (the `/flow:done` fan-out)

Reports: `.ai/logs/security-reviews/phase-32-distribution.md` (defender — **PASS WITH SUGGESTIONS**, 0 blockers at the medium floor) and `…-distribution-attacker.md` (adversarial — 2 HIGH + several MEDIUM). Disposition:

- **Confirmed solid (both passes):** signature verification is mandatory + pubkey-pinned (a tampered feed cannot push an unsigned/rogue build); the feed/redirect routes have no SSRF/open-redirect (params are key lookups + a numeric compare, the repo + GitHub host are hardcoded, asset URLs come from the authenticated release); `GITHUB_TOKEN` is outbound-only, never logged; the crash opt-in gate is enforced before any write and the log carries no sensitive data; the canvas iframe gets no IPC global so none of the new commands are reachable from untrusted content; CI never logs the PFX/password.
- **Fixed this phase:** `restart_to_update` guarded (no-op unless staged) — neutralizes the injection restart-DoS (attacker F1's phase-introduced bite); static error message in the feed route (no param reflection, W2); crash-log cap (W3); `sign.conf.json` gitignored (W4); the update banner renders only the owner-controlled `version`, never the GitHub `notes` (attacker F3 moot as built).
- **Accepted / tracked (not blockers for v1):**
  - **F1 root cause — main-origin CSP (DDR-109 F2).** The dev-server main origin still ships no CSP (only the untrusted canvas iframe does). This is a pre-existing, separately-tracked architectural gap, not introduced by phase-32. Phase-32's new commands are now either guarded (`restart_to_update`) or local-only in impact (`prefs_set_crash_reporting` flips a boolean that writes machine-local logs — no exfil). **The main-origin CSP remains the priority follow-up before wide public distribution.**
  - **F7 — single feed endpoint, no failover.** Losing/taking over `maude.sh` is a **denial-of-patch** (availability) only — a feed attacker cannot push malicious updates without the signing key. Follow-up: add a static-`latest.json`-on-GitHub-Releases second endpoint as failover.
  - **F4 — downgrade floor**, **F5 — SHA-pin CI actions** (the whole repo uses floating tags today; pinning is a repo-wide posture change), **F2 — feed defense-in-depth** beyond the pubkey: all tracked, below the medium floor / gated by the signing key.

This mirrors the phase-31 precedent (DDR-125): fix the cheap/phase-introduced items, record an explicit accepted-risk posture for the architectural ones, and keep the priority follow-up (here: main-origin CSP) named.

## Consequences

- Non-technical users install + stay current with zero terminal; the owner must keep the signing key + feed host alive (both are now single points of availability).
- The Rust code (updater/crash/prefs) compiles in CI / on a dev machine — it was authored without a local `cargo` this phase, so `Cargo.lock` must be regenerated (`cargo build`) before release so the resolved `tauri-plugin-updater` version is pinned.
- Open follow-ups: main-origin CSP (DDR-109 F2, priority); updater feed failover endpoint; SHA-pin the build-desktop actions; client-side monotonic downgrade floor.
