# git-branch-switcher

**native-desktop** E2E scenario — proves the bottom-dock RepoBranchSwitcher in the bundled Maude `.app` lists branches fast + git-native + with no phantom row, against a multi-branch git repo. Validates **DDR-133** (system-git auto-detect for the read paths + git-native switcher vocabulary). DOM-driven via `@wdio/tauri-service` (no computer-use).

**Persona:** developer on a real multi-branch repo opening the version switcher.
**Decision:** [DDR-133](../../decisions/DDR-133-system-git-autodetect-and-git-native-switcher-vocabulary.md). Plan: `.ai/plans/feature-git-switcher-fast-and-trustworthy.md`.
**Harness:** `apps/desktop/e2e/` (WebdriverIO + embedded WebDriver). Boots a **generated** multi-branch git fixture (`fixtures/make-git-fixture.ts`) via a dedicated config (`wdio.git.conf.ts`). Skill: `desktop-e2e`.
**Hypothesis:** A `--debug` `Maude.app` launched with `MAUDE_PROJECT_ROOT=<git fixture>` → sidecar boots → the switcher (`[data-testid=repo-switcher-trigger]`) renders (repo detected) → opening it paints the full branch list from system-git reads in well under a second → the labels are git-native and no phantom `origin` row appears.

## Fixture branch graph (`make-git-fixture.ts`)

| Branch | Where | Switcher row |
| --- | --- | --- |
| `main` | both (local + `refs/remotes/origin/main`) | "default branch · what everyone sees" |
| `feat/local-work` | local | plain row |
| `feat/nav-redesign` | local, **HEAD/current** | "your branch" + "Merge this branch → main" CTA |
| `feat/teammate-draft` | remote-only (`refs/remotes/origin/…`) | "remote · not downloaded yet" |
| `origin/HEAD` | symbolic ref | **MUST NOT appear** (the phantom-`origin` bug DDR-133 fixed) |

> **No configured remote URL** — only hand-written `refs/remotes/origin/*` refs. Deliberately offline: a github `remote.origin.url` makes the unattended ahead/behind probe spawn a real `git fetch` to github.com during boot, which keeps the WKWebView unscriptable long enough to trip the WebDriver `getUrl`/script timeouts (observed: the harness hangs at `waitForSidecar`). Refs-only ⇒ `classifyRemoteUrl` → `none` → no fetch → deterministic boot. (Harness gotcha — recorded in the `desktop-e2e` skill.)

## Platform matrix

| Platform | Required | Rationale |
| --- | --- | --- |
| **native-desktop** (`Maude.app`) | ✓ | The full switcher dock is `isNativeApp()`-gated (DDR-119) — only the native shell renders it. Browser mode shows the read-only badge, so `agent-browser` can't reach it. |
| web-* / ios / android | N/A | Native-desktop-only surface. |

## Steps (automated — `apps/desktop/e2e/scenarios/git-branch-switcher.e2e.ts`)

| # | Step | Expected |
| --- | --- | --- |
| 1 | Boot into the git fixture; wait for the sidecar. | Webview URL matches `http://localhost:<port>`. |
| 2 | The switcher trigger renders. | `[data-testid=repo-switcher-trigger]` displayed; its text contains `feat/nav-redesign` (current branch). Screenshot. |
| 3 | Real native shell. | `window.__TAURI__` present. |
| 4 | Open the popup; time the paint. | `[data-testid=repo-switcher-popup]` + `[data-testid=branch-row-main]` displayed in < 8 s (observed ~30 ms — not the iso-git crash / 10 s-timeout path). Screenshot. |
| 5 | Multiple branches listed. | `branch-row-main`, `branch-row-feat-local-work`, `branch-row-feat-teammate-draft` all exist; ≥ 3 `branch-row-*` rows. |
| 6 | No phantom origin. | `[data-testid=branch-row-origin]` does NOT exist. |
| 7 | Git-native vocabulary. | Popup text contains "Merge this branch → main", "default branch", "Switch branch", "remote · not downloaded yet". Screenshot. |

**Acceptance:** all steps pass, 0 blockers. Run output (report + screenshots) → `.ai/device/scenario-runs/git-branch-switcher/<YYYY-MM-DD-HHMM>/` (gitignored). This committed `spec.md` is the spec; run outputs are NOT committed here.

## How to run

```sh
pnpm test:e2e:desktop:build   # one-time / on studio-client or Rust change — `tauri build --debug`
pnpm test:e2e:desktop:git     # runs THIS scenario (git fixture); `:desktop` runs the app-boots one
# or: /desktop-e2e git-branch-switcher
```

> Studio-client `data-testid` changes need a release bundle rebuild before the app build: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (commit `dist/client.bundle.js` + `dist/styles.css`).
