# Feature: Intel Mac support for the desktop app

Validate the local test build (Task 5) BEFORE touching CI — the exact Tauri universal-binary
bundle path is asserted, not 100% confirmed against this repo's Tauri version.

## Description

The Maude desktop `.dmg` currently only runs on Apple Silicon. The CLI already ships an Intel
build (`@1agh/maude-darwin-x64` — `build-binaries.yml` has built `bun-darwin-x64` for a while),
but `build-desktop.yml`'s macOS leg only builds+bundles for `aarch64-apple-darwin`. Intel Mac
users installing the desktop app get a binary that won't launch (wrong arch).

## User Story

As an Intel Mac user I want to download and run the Maude desktop app so that I get the same
native experience Apple Silicon users have, without needing Rosetta workarounds I'm not told about.

## Problem

`build-desktop.yml`'s `macos-14` matrix leg (`label: macos-arm64`) builds the Rust/Tauri app and
its dev-server sidecar for `aarch64-apple-darwin` only, and bundles a single `.dmg` +
`.app.tar.gz` (the updater artifact) with no arch marker in the filename. There is no
Intel/`x86_64-apple-darwin` leg at all.

## Solution

Build a **universal binary** (`tauri build --target universal-apple-darwin`) on the existing
`macos-14` runner, rather than adding a second separate macOS matrix leg.

**Why not a second leg producing an Intel-only `.dmg`:** Tauri's default `.app.tar.gz` (the
updater artifact) is named `Maude.app.tar.gz` with **no arch token** — confirmed from a local
build artifact (`apps/desktop/src-tauri/target/release/bundle/macos/Maude.app.tar.gz`). Two
matrix legs would each upload a file with that same name to the same GitHub Release via
`softprops/action-gh-release@v2`, silently clobbering one arch's asset. Worse, the site's own
download/updater routes already assume exactly one macOS asset per release with no arch
disambiguation:
- `site/app/(home)/desktop/download/[platform]/route.ts` — `assets.find(a => a.name.endsWith('.dmg'))`, first match wins, no arch check.
- `site/app/releases/[target]/[arch]/[current_version]/route.ts` — falls back to `candidates[0]` when no filename carries an arch token (which none would, today).

A universal binary sidesteps all of this: one `.dmg` / one `.app.tar.gz` per release, runs
natively on both architectures, **zero changes needed** to either route above or to the updater
arch-matching logic.

**Mechanics:** Tauri's `externalBin` sidecar resolution auto-lipos a universal sidecar when it
finds both `<name>-x86_64-apple-darwin` and `<name>-aarch64-apple-darwin` staged in
`src-tauri/binaries/` before a `--target universal-apple-darwin` build. Both dev-server (Bun) and
`agent-browser` sidecars already have per-arch binaries readily buildable/available on the same
`macos-14` (arm64) host — the dev-server cross-compiles via `bun run build.ts --target=bun-darwin-x64`
(same trick `build-binaries.yml` already uses for the CLI), and `agent-browser`'s npm package
already ships a `bin/agent-browser-darwin-x64` binary alongside the arm64 one. So this is a CI-only
change: stage both arches' sidecars, add the Rust `x86_64-apple-darwin` target, build once with
`--target universal-apple-darwin`, and fix up the bundle output glob paths (which move under
`target/universal-apple-darwin/release/bundle/...` instead of `target/release/bundle/...`).

## Metadata

- **Type**: Enhancement
- **Complexity**: Low (CI-config + 2 doc-copy edits, no app/runtime code changes)
- **App/Package**: `apps/desktop` (+ `site` for two copy edits)
- **Affected Systems**: `.github/workflows/build-desktop.yml` (release CI only — not `build-binaries.yml`, which is unaffected)
- **Dependencies**: none new. Adds the `x86_64-apple-darwin` Rust target to the existing toolchain step.

---

## Context References

### Must-Read Files

- `.github/workflows/build-desktop.yml` (lines 48-266) — Why: the matrix + build/notarize/bundle-glob steps that need editing (macOS leg only; Windows/Linux legs untouched).
- `apps/desktop/scripts/sync-sidecar.mjs` — Why: already maps `darwin-x64` → `x86_64-apple-darwin` via `MAUDE_SIDECAR_SLUG`; just needs to be invoked twice (once per arch) before the universal build instead of once.
- `apps/desktop/scripts/sync-agent-browser.mjs` — Why: same pattern, second sidecar (`agent-browser`) that also needs both arches staged.
- `apps/desktop/src-tauri/tauri.conf.json` — Why: confirms `bundle.targets: "all"` (bundle *formats*, unrelated to CPU arch) and `externalBin` list — no changes needed here, just confirms nothing else assumes a single arch.
- `.ai/archive/decisions/DDR-106-tauri-v2-native-shell-architecture.md` — Why: already documents the `darwin-x64` → `x86_64-apple-darwin` slug/triple mapping as a founding-decision table; this feature just wires it into the desktop release CI for the first time.
- `site/app/(home)/desktop/download-button.tsx` (line ~23, `FILE.macos`) — Why: hardcodes the copy `'.dmg · Apple Silicon'`, needs to say both.
- `site/content/docs/desktop/index.mdx` (line 23) — Why: system-requirements table says "13 Ventura (Apple Silicon)".

### Documentation

- [Tauri: Universal macOS Binary](https://v2.tauri.app/distribute/macos-application-bundle-universal-binary/) — Why: the `--target universal-apple-darwin` flag + the dual-arch sidecar auto-lipo behavior this plan relies on. Re-read before Task 1 to confirm the bundle output path against the installed Tauri CLI version in this repo (`apps/desktop/package.json`).

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: UPDATE Rust toolchain step to install both macOS targets ✅ Task 1 — completed

- **Do**: In `build-desktop.yml`'s `Install Rust` step (line ~97-98), add
  `targets: aarch64-apple-darwin,x86_64-apple-darwin` to the `dtolnay/rust-toolchain@stable`
  action's `with:` block (only affects the `macos-14` runner; other OSes ignore unknown targets
  or just install their own default — verify the action accepts a no-op target list on non-macOS
  runners, or gate the `targets:` input to `if: matrix.os == 'macos-14'` via a separate step if not).
- **Gotcha**: `aarch64-apple-darwin` is already the default host target on `macos-14` — listing it
  explicitly is harmless (rustup no-ops on an already-installed target).
- **Validate**: `rustc --print target-list | grep apple-darwin` shows both after the step (or just proceed to Task 5's local repro).

### Task 2: UPDATE dev-server sidecar build step to produce both arches ✅ Task 2 — completed

- **Do**: In the `Build dev-server sidecar binary` step (line ~112-121, `if: matrix.os == 'macos-14'`
  section — currently shared with other OSes via `matrix.target`/`matrix.sidecar_dist`), for the
  macOS leg specifically run `bun run build.ts --release --target=bun-darwin-arm64` **and**
  `--target=bun-darwin-x64` (two builds), producing both `dist/maude-darwin-arm64` and
  `dist/maude-darwin-x64`.
- **Pattern**: mirrors `build-binaries.yml`'s existing `bun-darwin-x64` cross-compile cell (comment
  there explains bun's `--target=bun-darwin-x64` cross-compiles cleanly from an arm64 host).
- **Gotcha**: the matrix's `sidecar_dist`/`target` fields are currently single-value per OS — since
  macOS now needs two builds instead of one, either special-case the macOS leg with inline extra
  commands (simplest, since it's the only OS needing two), or split into a small bash loop over
  `(bun-darwin-arm64 darwin-arm64) (bun-darwin-x64 darwin-x64)`. Don't try to generalize the matrix
  shape for this — only macOS needs it.
- **Validate**: `ls apps/studio/dist/maude-darwin-*` shows both files after the step.

### Task 3: UPDATE sidecar staging to run for both arches before `tauri build` ✅ Task 3 — completed (with a correction, see note below)

- **Do**: Immediately before the `tauri build` invocation in the macOS build step, run both sync
  scripts twice, once per slug:
  ```bash
  MAUDE_SIDECAR_SLUG=darwin-arm64 node scripts/sync-sidecar.mjs
  MAUDE_SIDECAR_SLUG=darwin-arm64 node scripts/sync-agent-browser.mjs
  MAUDE_SIDECAR_SLUG=darwin-x64 node scripts/sync-sidecar.mjs
  MAUDE_SIDECAR_SLUG=darwin-x64 node scripts/sync-agent-browser.mjs
  ```
  (run from `apps/desktop/`). This lands both
  `binaries/maude-server-{aarch64,x86_64}-apple-darwin` and
  `binaries/agent-browser-{aarch64,x86_64}-apple-darwin` before Tauri's own
  `beforeBuildCommand` hook fires (that hook re-runs the scripts once more with whatever
  `MAUDE_SIDECAR_SLUG` is set at `tauri build` time — harmless, it just re-stages one of the two
  arches that's already there).
- **Gotcha**: `resolveAbBinDir()` in `sync-agent-browser.mjs` requires the `agent-browser` package
  to have both `bin/agent-browser-darwin-arm64` and `bin/agent-browser-darwin-x64` present — already
  confirmed true (both ship in the same npm package, not split by `optionalDependencies`).
- **Validate**: `ls apps/desktop/src-tauri/binaries/` shows 4 files (2 sidecars × 2 arches) before `tauri build` runs.

> **Correction found during Task 5's local repro (2026-07-08):** the plan's Solution-section assumption that "Tauri's `externalBin` sidecar resolution auto-lipos a universal sidecar when it finds both arch files staged" is **wrong**. Confirmed via `gh issue view 3355 --repo tauri-apps/tauri`: that auto-lipo only applies to the *main* Rust binary (cargo compiles both arches itself for `--target universal-apple-darwin`); `externalBin` sidecars are pre-built blobs Tauri just copies — for the universal target it looks for a binary literally named `<name>-universal-apple-darwin` and **fails to bundle** if that exact file isn't present. Fix: after staging all 4 arch-specific files above, run `lipo -create` yourself:
> ```bash
> cd apps/desktop/src-tauri/binaries
> lipo -create -output maude-server-universal-apple-darwin maude-server-aarch64-apple-darwin maude-server-x86_64-apple-darwin
> lipo -create -output agent-browser-universal-apple-darwin agent-browser-aarch64-apple-darwin agent-browser-x86_64-apple-darwin
> ```
> This is now landed in both `build-desktop.yml` (macOS build step) and verified locally (`tauri build --target universal-apple-darwin` succeeded on the second attempt, 6 files in `binaries/` before the build). Worth a DDR-106 addendum — see the updated Acceptance Criteria note.

### Task 4: UPDATE the `tauri build` invocation + bundle glob paths to the universal target ✅ Task 4 — completed

- **Do**:
  1. Change the macOS `tauri build` command (line ~149) to
     `pnpm --filter @maude/desktop tauri build --target universal-apple-darwin`.
  2. Update the dmg-notarize glob (line ~158) and the matrix's `bundle_glob` (line ~63) from
     `apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg` to
     `apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`.
  3. Update the "Attach installers" step's file globs (lines ~258-259) similarly for
     `.app.tar.gz` / `.app.tar.gz.sig` under the `universal-apple-darwin` path.
  4. Rename the matrix entry's `label`/`artifact_name` from `macos-arm64` /
     `maude-desktop-macos-arm64` to `macos-universal` / `maude-desktop-macos-universal` (cosmetic —
     the workflow-artifact name, not the GH Release asset filename Tauri produces).
- **Gotcha**: confirm the exact `universal-apple-darwin` path segment against Task 5's local build
  output before editing CI — don't guess this into `build-desktop.yml` blind.
- **Validate**: `grep -n "release/bundle" .github/workflows/build-desktop.yml` shows no remaining
  bare `target/release/bundle` path on the macOS leg.

### Task 5: Local repro BEFORE the CI edit (do this first in practice, confirms Tasks 1-4's paths) ✅ Task 5 — completed

- **Do**: On this machine (Apple Silicon), from `apps/desktop/`:
  1. `rustup target add x86_64-apple-darwin`
  2. Build both dev-server sidecar arches (Task 2's commands) and stage both sidecars (Task 3's commands).
  3. `pnpm --filter @maude/desktop tauri build --target universal-apple-darwin` (no `APPLE_*` secrets
     locally → unsigned dev build, same graceful-degradation path CI already exercises).
  4. Confirm the actual output directory (adjust Task 4's glob paths if it differs from the assumed
     `target/universal-apple-darwin/release/bundle/...`).
  5. `lipo -info target/universal-apple-darwin/release/bundle/macos/Maude.app/Contents/MacOS/Maude`
     — must report **two** architectures (`x86_64 arm64`).
- **Gotcha**: if any Cargo dependency in `src-tauri/Cargo.toml` lacks `x86_64-apple-darwin` support
  the build fails at this step, not in CI — cheaper to find out here.
- **Validate**: `lipo -info` output contains both `x86_64` and `arm64`; `.dmg` mounts and the app launches.

### Task 6: UPDATE desktop docs copy (2 files) ✅ Task 6 — completed (2 more spots found + fixed in `page.tsx`, see report)

- **Do**:
  - `site/content/docs/desktop/index.mdx` line 23: `13 Ventura (Apple Silicon)` → `13 Ventura (Intel or Apple Silicon)`.
  - `site/app/(home)/desktop/download-button.tsx` `FILE.macos`: `'.dmg · Apple Silicon'` → `'.dmg · Intel & Apple Silicon'`.
- **Validate**: grep confirms no remaining "Apple Silicon"-only wording for macOS in `site/content` or `site/app/(home)/desktop`.

---

## Validation

1. **Local repro** (Task 5) — must pass before touching CI.
2. **CI dry run**: trigger `build-desktop.yml` via `workflow_dispatch` on a branch (no tag push) —
   the "Attach installers" step is gated on `startsWith(github.ref, 'refs/tags/v')` so this is safe;
   it exercises the full macOS build+bundle without publishing anything.
3. **Manual arch check without owning Intel hardware**: run the Intel slice under Rosetta on this
   Apple Silicon Mac — `arch -x86_64 /Applications/Maude.app/Contents/MacOS/Maude` — should launch
   and behave identically (sidecar spawn, canvas load) to the native-arch launch.
4. **Updater feed sanity**: `curl` the deployed
   `/releases/darwin/x86_64/0.0.0` and `/releases/darwin/aarch64/0.0.0` routes after the next real
   release ships — both must resolve to the **same single** `.app.tar.gz` asset (no code change
   there, just confirms the "no arch token needed" assumption in Solution held).
5. No project-wide lint/typecheck/test/build gate applies (`build-desktop.yml` is standalone CI,
   this repo has no root test suite per `CLAUDE.md`).

---

## Acceptance Criteria

- [x] Local universal build (Task 5) produces a `.dmg` whose `Maude.app` binary is a 2-arch fat binary (`lipo -info`) — verified `x86_64 arm64` on `maude-desktop`, `maude-server`, AND `agent-browser`; live-booted + dev-server confirmed serving on both native arm64 and Rosetta x86_64
- [x] `build-desktop.yml` macOS leg builds `--target universal-apple-darwin` with correct bundle-glob paths (Tasks 1-4) — paths confirmed against the actual local build output, not guessed
- [ ] `workflow_dispatch` dry run of `build-desktop.yml` succeeds end-to-end on the branch — **deferred**, needs a push + explicit user go-ahead (not run this session)
- [x] Docs no longer claim macOS desktop is Apple-Silicon-only (Task 6) — grep-clean across `site/content` + `site/app/(home)/desktop` (2 extra spots found in `page.tsx` beyond the plan's named 2 files, also fixed)
- [x] `build-binaries.yml` (CLI release) untouched — already had `darwin-x64`, out of scope (git diff confirms no changes)
- [x] No DDR-worthy decision left unrecorded — DDR-106 addendum recorded (2026-07-08) documenting the universal-binary choice + the lipo-it-yourself landmine, confirmed against `tauri-apps/tauri#3355`

## Retro

- **What worked:** the plan's own "do Task 5 first" instruction was exactly right — the local repro caught a real, load-bearing wrong assumption (Tauri does NOT auto-lipo `externalBin` sidecars) before it ever touched CI, where the failure would have cost a wasted CI run and a confusing error with no local repro loop to debug it in.
- **What worked:** scoping the plan tight ("CI-config + 2 doc-copy edits, no app/runtime code") made the `/flow:done` validate fan-out fast to reason about — every subagent (scenario/a11y/design-system/security/ethical-hacker) could quickly conclude "no new surface" instead of doing deep discovery, and 3 independent `/simplify` reviewers converged on the same follow-up theme (centralize the triple-naming/lipo logic in the sync scripts) without prompting, which is a good signal the diff was small enough to actually reason about fully.
- **What to change next time:** the plan's "Must-Read Files" list named 2 site files for Task 6 but a grep of the stated validate scope (`site/app/(home)/desktop`) turned up 2 more instances in a file the plan didn't list (`page.tsx`). Future plans doing a "find every occurrence of X wording" task should grep first and enumerate every hit as an explicit sub-item, rather than naming files from memory/context — the validate command already existed to catch this, but it would have been cheaper to get it right at plan time.
- **What to change next time:** this ran on a shared, actively-concurrent `main` (another session was mid-`/flow:done` on an unrelated feature throughout this whole session) — staging required manually diffing every touched shared file (STATE.md, whats-new.json, whats-new mirror) to confirm no entanglement before every commit. Worth a standing reminder in `/flow:execute`/`/flow:done`: on this repo, always re-check `git status` immediately before `git add`, not just at session start, since the tree can change under you mid-session.
- **Follow-up (not applied, recorded for a future pass):** three independent `/simplify` reviewers flagged the same shape — the sidecar triple-naming + `lipo` fusion logic is hand-rolled in `build-desktop.yml` instead of living in `sync-sidecar.mjs`/`sync-agent-browser.mjs` (which already own the canonical slug→triple map). A `darwin-universal` slug that stages both arches and lipos them internally would remove the duplicated triple literals from the YAML and the redundant re-staging via `beforeBuildCommand`. Out of scope for this plan (touches shared build tooling used by every `tauri dev`/`build` invocation, not just CI) — worth its own small plan if the triple-hardcoding pattern gets copied elsewhere.
```
