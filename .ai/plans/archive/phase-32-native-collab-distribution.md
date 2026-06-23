# Phase 32 — Native Maude: Distribution, auto-update & maintenance

Validate docs and codebase patterns before implementing. `MAUDE_SKIP_RUNTIME_BUILD=1` discipline is load-bearing throughout this phase — never let a CI step regenerate the committed runtime bundles.

## Description

Make Maude self-maintaining and properly distributable to non-technical users: auto-update (download in background, restart to apply), Windows `.msi` signing, a `/desktop` download page on the site, opt-in crash reporting, and the in-app "what's new" wired to the existing `whats-new.json` feed.

**Phase milestone:** A non-technical user installs Maude, and it keeps itself up to date silently. When a new version is ready: "Maude updated · Restart to apply." No CLI, no npm update.

## User Story

As a non-technical user, I want Maude to update itself in the background and tell me when it's ready, so that I'm always on the latest version without ever opening a terminal.

## Problem

Today Maude has no native installer, no auto-update, and no download page. Upgrading requires `npm install -g @1agh/maude` — a terminal operation non-technical users can't do.

## Solution

1. **Auto-update:** Tauri updater plugin polls a signed JSON release feed; downloads in background; notifies user; applies on restart.
2. **Windows `.msi`:** Extend `build-desktop.yml` CI to produce a signed Windows installer alongside the macOS `.dmg`.
3. **Download page:** `site/content/docs/desktop/index.mdx` + a `/desktop` route with platform-detection.
4. **Crash reporting:** Sentry (opt-in only, shown at first-run wizard, default off).
5. **In-app What's New:** Wire the existing `GET /_api/whats-new` feed into the native app's "What's New" badge — already shipped in the dev-server, just needs surfacing in the native chrome.

## Metadata

- **Type:** Enhancement (spans phase-26 shell + release pipeline)
- **Complexity:** Medium
- **App/Package:** `apps/desktop/src-tauri/` + `.github/workflows/build-desktop.yml` + `site/`
- **Depends on:** phase-26 (shell + initial CI), all prior phases (distributing the complete app)
- **Dependencies (new):** `tauri-plugin-updater`, `tauri-plugin-crash-reporter` (or Sentry Rust SDK), Windows code-signing cert

---

## Context References

### Must-Read Files

> Read in parallel.

- `CLAUDE.md` § "Release flow" — `scripts/bump-version.sh`, version parity, `MAUDE_SKIP_RUNTIME_BUILD=1` invariant.
- `CLAUDE.md` § "In-app What's New feed" — `whats-new.json` schema, `GET /_api/whats-new`, `scripts/stamp-whats-new.mjs`.
- `.github/workflows/build-binaries.yml` — existing CI pattern. `build-desktop.yml` mirrors this structure.
- `scripts/bump-version.sh` — version bump must also update `apps/desktop/src-tauri/tauri.conf.json` `version` field (add to the script).
- `plugins/design/dev-server/whats-new.json` — feed. Phase-32 adds a desktop entry here after shipping.
- `site/` — `site/content/docs/` for the download page.

### Files to Create / Modify

- `apps/desktop/src-tauri/src/updater.rs` — update check + download + notify
- `apps/desktop/src-tauri/src/crash_reporter.rs` — opt-in Sentry init
- `.github/workflows/build-desktop.yml` — extend from phase-26 with Windows matrix + updater feed upload
- `site/content/docs/desktop/index.mdx` — download page
- `site/app/(home)/desktop/page.tsx` — route
- `scripts/bump-version.sh` — add `tauri.conf.json` version bump

---

## Tasks

### Task 1: Auto-update (Tauri updater)

- **Do:** Add `tauri-plugin-updater` to `Cargo.toml`. Configure `tauri.conf.json` → `plugins.updater`:
  - `endpoints: ["https://maude.1agh.dev/releases/{{target}}/{{arch}}/{{current_version}}"]` — a small Vercel edge function that returns the latest release JSON for the platform.
  - `pubkey` — ed25519 public key for signature verification (generate with `cargo tauri signer generate`; private key in GitHub Secrets).
  - Check interval: on app focus + every 4 h.
  - Update UX: download silently in background → show a non-intrusive banner in the Tauri window chrome: **"Maude updated · Restart to apply"** with a "Restart now" button. No modal, no blocking.
- **Gotcha:** The update server endpoint must return a signed JSON with `{version, url, signature, notes}`. Set up as a Vercel edge function at `maude.1agh.dev/releases/` that reads from the GitHub Releases API. This is a ~30-line edge function.
- **Validate:** Build a `.dmg` with version `0.0.1`, install. Build a `.dmg` with version `0.0.2`, upload to the release feed. Launch the `0.0.1` app → sees "Maude updated" banner within 4 h (or trigger immediately in dev with `TAURI_UPDATER_FORCE_CHECK=1`).

### Task 2: Windows `.msi` CI

- **Do:** Extend `.github/workflows/build-desktop.yml` matrix with `windows-latest`. Add Windows code-signing:
  - `WINDOWS_CERTIFICATE` (base64 PFX) + `WINDOWS_CERTIFICATE_PASSWORD` secrets.
  - `signtool.exe` in the Tauri build config.
  - Output: `Maude_X.Y.Z_x64_en-US.msi` uploaded to GitHub Release assets.
  - `MAUDE_SKIP_RUNTIME_BUILD=1` must be set on the Windows build step too.
- **Gotcha:** The Bun dev-server binary must have a Windows build too — `build-binaries.yml` already produces `server-x86_64-pc-windows-msvc.exe` (verify; add if missing). Tauri's `externalBin` bundles it.
- **Validate:** Windows CI job produces a signed `.msi`; install on a Windows VM → Maude opens, canvas loads.

### Task 3: Download page on site

- **Do:** `site/content/docs/desktop/index.mdx` — platform-aware download page:
  - Hero: "Install Maude" with platform-detected download button (macOS `.dmg` / Windows `.msi`).
  - System requirements (macOS 13+, Windows 10+).
  - "What's included" — canvas browser, git versioning, GitHub sign-in, live collaboration.
  - FAQ: "Does it require a terminal? No." / "Is it free? Yes, open source." / "What's the AI editing? Requires a paired Claude Code."
  - Links to hub self-hosting docs.
- **Reference (lift, don't re-derive):** `.design/ui/Studio Hub.tsx` → artboard **A** (landing splash: hero + console-preview inset + value-prop trio + deploy-targets strip, maude DS) is a built maude-DS reference for the `/desktop` download-page IA + section rhythm. **NOT a 1:1** — artboard A markets the *self-hosted hub*; this page markets the *native desktop app*. Lift the hero/preview/value-prop layout skeleton; rewrite the copy + CTAs for the app download.
- **Validate:** `pnpm --filter @maude/site build` passes; `/desktop` route renders; platform-detection shows correct button.

### Task 4: Opt-in crash reporting

- **Do:** Add Sentry Rust SDK (or `tauri-plugin-crash-reporter`) with:
  - Default: **off**. Only enabled if user checked "Send crash reports to help improve Maude" in the first-run wizard (phase-29 — add the checkbox to the wizard's final screen).
  - Preference stored in `AppData/maude/prefs.json`.
  - If enabled: catch panics + unhandled errors; send to a Sentry DSN.
  - **Privacy:** no canvas content, no file paths, no GitHub tokens in crash reports. Only stack traces + OS version + Maude version.
- **Gotcha:** Non-technical users often just click "yes" on everything. Make opt-in the explicit checkbox, opt-out the default — never the reverse.
- **Validate:** Checkbox unchecked → no Sentry requests (verify with network proxy). Checkbox checked → simulated panic sends a report to the test Sentry project.

### Task 5: What's New in native chrome

- **Do:** The existing `GET /_api/whats-new` endpoint already serves the feed. In the Tauri shell:
  - On app focus (after a version bump): fetch `/_api/whats-new`, compare `version` to last-seen version in `AppData/maude/prefs.json`. If newer: show a "✦ What's New" badge in the window titlebar area → click opens a native sheet or the existing web panel.
  - This is a thin Tauri-side wrapper — the web panel (`WhatsNewPanel`) already exists in `client/app.jsx`. The Tauri chrome just adds a persistent badge.
- **Validate:** Bump version → relaunch app → "✦ What's New" badge appears → click → panel shows the new entries.

### Task 6: `scripts/bump-version.sh` — add desktop version

- **Do:** Add `apps/desktop/src-tauri/tauri.conf.json` to the version-bump script alongside `package.json` + both `plugin.json` files. All four must stay in lockstep (add to `scripts/check-version-parity.sh` too).
- **Validate:** `scripts/bump-version.sh patch` → all four files bumped to the same version.

### Task 7: What's New entry + docs

- **Do:**
  - Run `whats-new-entry` skill to add a "Native app available" entry to `whats-new.json`.
  - `site/content/docs/hub/` — add a note that the native app handles hub-connect via the onboarding wizard (no more `maude design link` needed for non-technical users).
- **Validate:** `whats-new.json` has the new entry; site builds.

---

## Validation

1. **Auto-update:** version bump → release feed updated → running app detects update + shows banner (Task 1).
2. **Windows:** `Maude_X.Y.Z_x64_en-US.msi` installs on Windows; canvas loads (Task 2).
3. **Site:** `/desktop` route renders with platform-detected download button (Task 3).
4. **Privacy:** crash reporting off by default; no tokens/paths in reports (Task 4).
5. **Zero-terminal scenario (full):** install → onboard → edit → save → publish → collaborator joins → live session → update notification → restart to update. No terminal at any step.
6. **Version parity:** `check-version-parity.sh` passes with the new desktop field (Task 6).

## Acceptance Criteria

- [x] Auto-update: background download, "Restart to apply" banner (Task 1) — implemented; runtime verify CI/dogfood-gated (no `cargo`)
- [x] Windows `.msi` signed, installs on Windows, canvas loads (Task 2) — CI matrix implemented; execution gated (no Windows runner)
- [x] `/desktop` download page live on site (Task 3) — built; site build green
- [x] Crash reporting opt-in, default off, no sensitive data (Task 4) — implemented (local-file backend, not Sentry)
- [x] What's New badge in native chrome (Task 5) — badge already shipped; added focus re-check
- [x] `bump-version.sh` + parity check include `tauri.conf.json` (Task 6) — done + verified
- [x] What's New entry added, docs updated (Task 7) — done
- [ ] Full zero-terminal scenario passes end-to-end — **NOT verified here** (native-app ceiling: agent-browser can't drive `isNativeApp()`; auto-update/Windows/Sentry runtime is CI/dogfood-gated). User dogfood + CI.

## Retro

- **What worked:** Decomposing by verifiability up front paid off — the fully-runnable gates (parity, site build, dev-server tests) gave real signal, and the security fan-out caught a genuine phase-introduced issue (the unguarded `restart_to_update`) that was cheap to fix. AskUserQuestion on the three custody/identity decisions (feed shape, signing key, crash backend) avoided scaffolding the wrong thing.
- **What didn't:** The `/design:smoke` gate fired on the `apps/studio/**` diff, but booting the source dev-server clobbered the committed release `client.bundle.js` → dev (3.6 MB) **and** regenerated the authoritative `dist/runtime/*.js` — both had to be reverted/rebuilt. The smoke gate should detect "client-shell-only diff, canvas pipeline untouched" and skip the destructive boot, or always boot with `MAUDE_NO_AUTOBUILD=1` AND a guard against the on-demand `/_client/` dev-build.
- **Plan staleness:** the plan's `plugins/design/dev-server/` paths (→ `apps/studio/`, DDR-095) and the `maude.1agh.dev` host (real: `maude.iagh.cz`) were both wrong — same DDR-095 drift that bit phases 27–31. A plan-author pre-flight that greps the plan's paths/hosts against the tree would catch this once.
- **Environment ceilings, repeatedly:** no `cargo` (all Rust write-only, CI-gated), the `better-sqlite3` ABI mismatch (needed a from-source rebuild to get CLI tests green), and the native-app `isNativeApp()` ceiling. These are now well-understood; the retro learning is to **state them as gate-exemptions up front** rather than discovering them mid-`/done`.
- **Next time:** for an infra/distribution phase like this, `/execute` should explicitly mark each task's verification tier (runnable / CI-gated / dogfood-gated) in the output report from the start, so `/done` doesn't re-litigate what "passing" means.
