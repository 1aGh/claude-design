# git-lifecycle

**native-desktop** E2E scenario — drives the COMPLETE in-repo git lifecycle through the bundled Maude `.app` UI (switcher + GitPanel), DOM-driven, one screenshot per operation. Validates **DDR-133** end-to-end against a real GitHub remote. Repo-switch is split into the separate `git-switch-repos` scenario (its sidecar-respawn is WebDriver-flaky).

**Persona:** developer doing a full save → publish → sync cycle in the desktop app.
**Decision:** [DDR-133](../../decisions/DDR-133-system-git-autodetect-and-git-native-switcher-vocabulary.md). Harness: `apps/desktop/e2e/` (`wdio.lifecycle.conf.ts` → `make-lifecycle-fixture`). Skill: `desktop-e2e`.
**Auth model:** the conf sets `MAUDE_USE_SYSTEM_GIT=1` so push/pull/fetch authenticate via the developer's own git credential helper — the `--debug` test app isn't signed into GitHub, and forcing system git is the screen-independent way to exercise the token-bearing ops (verified tokenless in the de-risk). Reads/vocabulary are engine-independent.
**Fixture:** a FULL clone (not `--depth`, which would be single-branch) of the throwaway `iagh66/maude-git-smoke` repo, reset to a clean `main`.

## Platform matrix

| Platform | Required | Rationale |
| --- | --- | --- |
| **native-desktop** (`Maude.app`) | ✓ | GitPanel + switcher are `isNativeApp()`-gated (DDR-119); only the native shell renders the full git UI. |
| web-* / ios / android | N/A | Native-desktop-only surface. |

## Steps (automated — `apps/desktop/e2e/scenarios/git-lifecycle.e2e.ts`)

| # | Operation | Drives | Expected |
| --- | --- | --- | --- |
| 1 | boot | — | native shell + sidecar on `main`. |
| 2 | **new branch** | switcher → New branch → name → Create | trigger shows `smoke/ui-lifecycle`. |
| 3 | **switch branches** | switcher → `branch-row-main` → back | trigger flips main ↔ feature. |
| 4 | **commit** (Save version) | GitPanel: message + Save all (after a Node-side `.design/` write + reload) | "Version saved" → publish state. |
| 5 | **push** (Publish) | GitPanel → Publish | branch appears on GitHub (`gh` verify). |
| 6 | **fetch remote branches** | switcher → Fetch | a teammate `smoke/from-remote` (created via `gh`) surfaces as a remote row. |
| 7 | **merge to main** (fold) | switcher → Merge this branch → main → confirm | lands on `main`; `ui-lifecycle.txt` reaches remote `main` (`gh` verify). |
| 8 | **pull** (Get latest) | GitPanel → Get latest (after a `gh` out-of-band commit on `main`) | best-effort — the remote-ahead nudge is probe-timing-sensitive (45 s cache); captures whatever state it reaches. |

**Acceptance:** steps 1–7 hard-assert + screenshot; step 8 (pull) is best-effort (operation is verified at the API layer; the UI nudge is timing-sensitive). Run output → `.ai/device/scenario-runs/git-lifecycle/<ts>/` (gitignored). 9 screenshots.

## How to run

```sh
pnpm test:e2e:desktop:build       # one-time / on studio-client or Rust change
pnpm test:e2e:desktop:lifecycle
```

> Mutates the throwaway `iagh66/maude-git-smoke` remote (pushes a branch, merges to main); the `after()` hook prunes the test branches. Needs the dev's github credential helper.
