# git-switch-repos

**native-desktop** E2E scenario — switches between two local git projects through the desktop app, driven via the native `open_local_project` Tauri command (DOM-driven). Validates the switch-repos lane of **DDR-133**. Isolated from `git-lifecycle` because the command respawns the dev-server sidecar on the new `--root` and re-navigates the WKWebView — under the embedded WebDriver that's flaky, so this scenario **retries** the switch (`this.retries(2)`) rather than chaining it inline.

**Persona:** developer moving between repos in the project picker.
**Decision:** [DDR-133](../../decisions/DDR-133-system-git-autodetect-and-git-native-switcher-vocabulary.md). Harness: `apps/desktop/e2e/` (`wdio.switchrepos.conf.ts` → `make-lifecycle-fixture`). Skill: `desktop-e2e`.
**Fixtures:** `primary` = the github-backed clone (boots on `main`); `secondary` = the offline `make-git-fixture` repo (current branch `feat/nav-redesign` — a label primary never shows, so the switch is unambiguous).

## Platform matrix

| Platform | Required | Rationale |
| --- | --- | --- |
| **native-desktop** (`Maude.app`) | ✓ | Project switch = sidecar respawn + webview re-navigation, a native-shell-only path. |
| web-* / ios / android | N/A | Native-desktop-only surface. |

## Steps (automated — `apps/desktop/e2e/scenarios/git-switch-repos.e2e.ts`)

| # | Step | Expected |
| --- | --- | --- |
| 1 | boot on primary | trigger shows `main`. Screenshot. |
| 2 | `open_local_project(secondary)` | trigger shows `feat/nav-redesign` (secondary now active; the invoke may reject as the respawn interrupts execute/async — swallowed, then reconnect). Screenshot. |
| 3 | `open_local_project(primary)` | trigger back on `main`. Screenshot. |

**Acceptance:** all 3 steps pass (with up to 2 retries on the flaky switch), 0 blockers. Run output → `.ai/device/scenario-runs/git-switch-repos/<ts>/` (gitignored). 3 screenshots.

## How to run

```sh
pnpm test:e2e:desktop:build
pnpm test:e2e:desktop:switchrepos
```
