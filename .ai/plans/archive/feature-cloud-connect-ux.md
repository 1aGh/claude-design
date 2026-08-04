# Feature: Cloud→desktop connect UX — native sign-in browser open + deep-link decision modal

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Two user-facing breaks in the Maude Cloud ↔ desktop connection lane (reported 2026-08-04 with screenshots):

1. **Device sign-in dead-ends in the desktop app.** `CloudBar.jsx:183` calls `window.open(verificationUrl)` — a silent no-op in Tauri WKWebView. The dialog then claims "Maude opened your dashboard in the browser" (false in the shell), shows no clickable link, and the person is stranded with a code and nothing to do with it. The flow is actually one-click by design: `verification_url` carries the prefilled code (`/activate?code=XXXX`, `apps/cloud/device-auth.mjs:212`).
2. **The `maude://open/<project>?code=…` deep link is confusing and under-explained.** "Open in Maude" on the dashboard surfaces a terse strip "Connect this project to <X>?" that attaches the **currently open local project** to cloud project X — with no explanation of what syncs where, no check that the local project corresponds to the cloud one, and no honest answer for "I don't have this project on disk." The user with StudyFi open who pressed Open in Maude on alligators was one click away from linking StudyFi's `.design/` into the alligators workspace.

## User Story

As a Maude Cloud user I want signing in from the desktop app to open my browser to a one-click confirm, and "Open in Maude" to clearly explain (and sanity-check) what will be connected, so that I never link the wrong local project to a cloud workspace and never dead-end mid-sign-in.

## Problem

- No generic URL opener exists in the shell (deliberate — DDR-054 posture); only github.com-locked commands (`oauth.rs:257-289`). Cloud URLs have no native path to the OS browser. Two more silent `window.open` no-ops on the same code path: `CloudBar.jsx:335` (share view) and `:359` (dashboard).
- The deep-link confirm strip verifies code↔claimed-project (anti-phishing 409, `endpoints.ts:276-284`) but nothing compares **local** project identity to the cloud project, and the copy explains nothing.

## Solution

Approved by divergent debate (builder/shipper/breaker seats, 2026-08-04 — converged on A and C; B decided by the user's explicit ask for a modal):

- **A — native open:** new Rust command `open_cloud_url`, cloned from `open_github_url` (same length cap + CVE-2024-24576 metachar filter). Host-lock resolved **per call in Rust** from `MAUDE_CLOUD_URL` env (normalized origin; default `https://cloud.maude.sh`) — never from the webview argument, never read once at boot (the sidecar resolves per call too, `endpoints.ts:34-36`; three-way origin drift on self-host was the breaker's key finding). Allowed: URL origin == configured cloud origin, OR https URL whose host is a subdomain of the configured cloud host (covers `<project>.cloud.maude.sh` cells and `view-*.cloud.maude.sh`). The sign-in dialog ALWAYS renders the verification URL as a visible clickable + copyable link (fallback for self-host origin drift, browser surface, and refusal paths) with honest, surface-aware copy. Opener plugin: rejected (arbitrary-URL surface DDR-054 forbids).
- **B — deep-link decision modal:** replace the one-line strip with a `gi-modal`-family dialog that names both sides ("Connect **<local project>** → cloud project **<X>**"), states in one plain sentence what happens ("this folder's `.design/` canvases will sync to X's workspace; nothing else in the repo is uploaded"), and branches on a local-identity **hint** (heuristic, copy-only — never a hard gate):
  - *match / not-yet-linked* → primary Connect;
  - *different project linked or name mismatch* → warning styling + explicit "Connect anyway" secondary + guidance "open the <X> project folder and press Open in Maude again" (deep-link re-press is cheap — the dashboard re-mints the code);
  - **no** mid-flow project switching (burns the one-shot 2-minute code → 410 after consent; consent-erosion risk);
  - *project not on disk* is answered honestly in the same copy (open in the browser / open the right folder) — **no fake download branch**.
  - All existing trust invariants preserved: park-then-ask, never-replace-pending-link slot, code exchanged only against the configured cloud address, 409 on claimed↔actual mismatch.
- **C — "pull a local copy": deferred** to its own feature (new cloud→disk write surface on the DDR-054-untrusted hub; path traversal + first-sync reconciliation need their own security pass). Recorded in Follow-ups.

## Metadata

- **Type**: Bug Fix (A) + Enhancement (B)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (client + cloud endpoints), `apps/desktop` (src-tauri + e2e)
- **Affected Systems**: CloudBar, device sign-in lane, maude:// deep-link lane, Tauri command ACL
- **Dependencies**: none new (reuses `open` crate already used by `open_github_url`)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/studio/client/panels/CloudBar.jsx` — Why: the whole client surface; lines 119-164 (deep-link pending + connectPending), 175-206 (startSignIn/cancel), 263-284 (strip to replace), 370-395 (device dialog to fix), 335 + 359 (the other two silent `window.open`s)
- `apps/desktop/src-tauri/src/oauth.rs` (lines 255-289) — Why: `github_open_verification` + `open_github_url` are the verbatim host-lock pattern to clone (incl. the Windows CVE-2024-24576 filter comment)
- `apps/desktop/src-tauri/src/lib.rs` (around line 399, `generate_handler`) — Why: command registration site
- `apps/desktop/src-tauri/build.rs` — Why: the ACL manifest `commands(&[…])` list — missing entry = hard panic at real build only (memory `reference_tauri_command_needs_build_rs`; `cargo check` does NOT catch it)
- `apps/desktop/src-tauri/capabilities/default.json` — Why: `allow-open-cloud-url` must be granted to the remote loopback origin (Phase 28 / DDR-108/109 pattern; read the security description at the top before touching)
- `apps/studio/cloud/endpoints.ts` — Why: `status()` (117-125) to extend with linkedHub info; `attachCode` (249-292) mismatch 409; `linkToWorkspace` (295-354) writes `linkedHub{url,linkedAt}`
- `apps/studio/client/github.js` — Why: `invoke`/`isNativeApp` bridge + where the `openCloudUrl` helper lands (mirror `openGitHubUrl`, line 41)
- `apps/desktop/src-tauri/src/deep_link.rs` — Why: trust posture comment — the modal must not weaken park-then-ask
- `apps/desktop/e2e/scenarios/cloud-attach.e2e.ts` — Why: scenario 4 asserts the current strip text + testids; extend for the modal + mismatch case
- `apps/desktop/e2e/wdio.cloud.conf.ts` — Why: stubbed control plane / cell (`127.0.0.1` origins) — the identity hint must degrade to neutral copy here, which the e2e will implicitly prove
- `apps/studio/test/workspace-signin.test.ts` — Why: endpoint contract tests; `status()` response shape changes
- `apps/studio/cloud/device-auth reference: apps/cloud/device-auth.mjs` (lines 200-215, `/activate`) — Why: `verification_url` shape (code prefilled) the dialog copy leans on

### Files to Create

- none (all changes land in existing files; the modal is a CloudBar-internal component)

### Design canvases

No `.design/` canvas matches this feature (checked: repo's own canvases are product marketing/UI-kit surfaces). The two screenshots in the session + the existing `gi-*` dialog family are the visual ground truth.

### Patterns to Follow

- Host-locked opener (`oauth.rs:271-289`): prefix lock closing the authority with `/`, length ≤ 2048, reject whitespace/control/`@ \ & | ^ < > " ' `` ` ``.
- Dual-surface branch (`CloudBar.jsx` + `github.js`): `isNativeApp() ? invoke('…') : window.open(…)`, with graceful fallback on invoke error (mirror `openGitHubUrl`'s "older desktop build" caveat — older shells without the new command must fall back to the visible link, not throw).
- Dialog chrome: the existing `gi-modal` / `gi-scrim` / `gi-dialog` family (device-code dialog, lines 370-395) — one dialog family per DDR; no new CSS primitives. Styles live in `apps/studio/client/styles/4-components.css`.
- Testids: `<area>-<thing>[-<id>]` kebab-case (`cloud-deeplink-connect` etc. — keep existing ids where semantics survive; new: `cloud-deeplink-dialog`, `cloud-deeplink-mismatch`, `cloud-signin-link`).

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `gi-modal` dialog family | `CloudBar.jsx` device dialog + `4-components.css` | Reuse for the deep-link decision modal; warning variant via existing danger/err classes |
| `btn btn--sm` / `btn--ghost` | existing | Connect (primary), Connect anyway (ghost/danger), Not now (ghost) |

### Icons

| Icon | Library | Usage |
| ---- | ------- | ----- |
| `Spark`, `link`, `external`, `copy` | CloudBar-local SVG set | Reuse; no new glyphs needed |

### Tokens

No new tokens. Warning styling reuses the `gi-rail-err` / danger classes already in the family.

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Deep-link decision modal (inline in CloudBar) | Strip → explanatory modal per user request | `gi-dialog` family |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ADD Rust command `open_cloud_url` (apps/desktop/src-tauri/src/oauth.rs)

- **Do**: New `#[tauri::command] pub fn open_cloud_url(url: String)`. Resolve allowed origin **per call**: `std::env::var("MAUDE_CLOUD_URL")` → parse/normalize to origin (scheme+host+port, strip trailing slashes; on parse failure fall back to default) → default `https://cloud.maude.sh`. Accept `url` iff it passes the `open_github_url` char/length filter AND (its origin == allowed origin, OR it is `https` and its host == allowed host or ends with `"." + allowed host`). Refuse otherwise with the same "Refusing to open" error shape. Then `open::that(&url)`.
- **Pattern**: `open_github_url` (oauth.rs:271-289) — copy the filter verbatim; keep the security comment style explaining WHY (DDR-054: never an arbitrary opener; per-call env read to avoid boot-time origin drift with the sidecar, endpoints.ts:34).
- **Gotcha**: subdomain check must be suffix-with-dot (`.cloud.maude.sh`), never `contains` — `evilcloud.maude.sh.attacker.com` shapes. Port-bearing self-host origins (e.g. `http://127.0.0.1:8788`) only match the exact-origin arm, not the subdomain arm (subdomain arm is https-only).
- **Validate**: `cd apps/desktop/src-tauri && cargo check` (compile only — full ACL proof is Task 2/Task 8) + unit tests in the same file for accept/reject cases (default origin, env origin, subdomain, `@`-smuggle, http-subdomain rejection).

### Task 2: REGISTER the command in all three ACL sites

- **Do**: `lib.rs` `generate_handler![…]` + `build.rs` `commands(&[…])` + `capabilities/default.json` `"allow-open-cloud-url"`.
- **Gotcha**: memory `reference_tauri_command_needs_build_rs` — missing `build.rs` entry hard-panics `tauri-build` and **`cargo check` does not catch it**; only a real desktop build proves it. Capabilities file: keep the JSON description comment accurate (it documents the security posture; mention the new command is origin-locked in Rust).
- **Validate**: `cd apps/desktop && pnpm tauri build --debug` (or the e2e test build `pnpm test:e2e:desktop:build`) completes.

### Task 3: ADD `openCloudUrl` client helper (apps/studio/client/github.js)

- **Do**: `export const openCloudUrl = (url) => invoke('open_cloud_url', { url });` with a docstring mirroring `openGitHubUrl`'s (native only; Rust host-locks; throws on older desktop builds → caller falls back).
- **Validate**: covered by Task 4's callers + bundle build.

### Task 4: UPDATE sign-in dialog + the three `window.open` call sites (CloudBar.jsx)

- **Do**:
  - `startSignIn` (line ~183): `const openExternal = (url) => { if (isNativeApp()) { openCloudUrl(url).catch(() => {}); } else { window.open(url, '_blank', 'noopener'); } }` — shared helper inside the component (or module-local), used for verificationUrl, share view (line 335), and dashboard (line 359).
  - Device dialog: replace the lying copy with surface-honest copy — "Confirm this code on your dashboard to connect." + a **visible link row**: `<a>` with the full `verificationUrl` (click → `openExternal`) + the existing Copy button now also offering "Copy link" (or a second copy affordance) — the person must always have a manual path (self-host origin drift, older shell builds, browser popup blockers). Add testid `cloud-signin-link`.
  - Keep the poll loop untouched.
- **Pattern**: existing `copyCode` for clipboard; `openGitHubUrl` fallback comment for the older-build catch.
- **Gotcha**: this component also runs in plain browser — never call `invoke` unless `isNativeApp()`. Do not remove `window.open` for the browser surface.
- **Validate**: `cd apps/studio && bun test test/workspace-signin.test.ts` (still green) + manual browser-mode smoke.

### Task 5: REPLACE the deep-link strip with the decision modal (CloudBar.jsx)

- **Do**:
  - Extend `/_api/cloud/status` (endpoints.ts `status()`) to also return `{ project: <repoRoot basename>, linkedHub: { url } | null }` (read `ctx.paths` + designRoot config; no token material). Update `workspace-signin.test.ts` for the new shape.
  - In CloudBar, on `pending` render a `gi-modal` dialog (not the rail strip): title "Connect to <X>?", body naming both sides — local project (basename from status) → cloud project `pending.project` — plus the one-sentence sync explanation ("This folder's `.design/` canvases will sync with the <X> workspace. Nothing else in this repo is uploaded.").
  - Identity **hint** (copy-only, never a gate): if `linkedHub.url` host == `<X>.<cloud-host>` → "This folder is already linked to <X>." (primary Connect = reconnect). If linkedHub exists but points elsewhere, or the local basename ≠ X → warning block: "This folder looks like **<local>**, not **<X>**. Connecting will sync **this folder's** designs into <X>." + primary action demoted; explicit "Connect anyway" + hint "If you meant to work on <X>, open its folder in Maude and press Open in Maude again." No linkedHub + no signal → neutral copy (this is what the 127.0.0.1-stubbed e2e sees).
  - "Not now" clears `pending` (slot invariant preserved: `setPending((current) => current ?? parsed)` untouched; Escape + scrim close = Not now).
  - No project-switch action inside the modal (one-shot code, 2-min TTL — a switch restarts the sidecar and guarantees a 410 after consent).
  - Testids: keep `cloud-deeplink-connect` / `cloud-deeplink-dismiss`; add `cloud-deeplink-dialog`, `cloud-deeplink-mismatch`.
- **Pattern**: device-code dialog structure (lines 370-395) for modal chrome; `attachCode`'s 409 copy for refusal-tone reference.
- **Gotcha**: host parsing of `linkedHub.url` is only meaningful on the default cloud — treat parse failure / non-matching shapes as "no signal", never as mismatch (breaker finding: every e2e/self-host stub is `http://127.0.0.1:<port>`).
- **Validate**: `cd apps/studio && bun test` (dev-server suite) — then Task 6 e2e.

### Task 6: UPDATE desktop e2e scenario (apps/desktop/e2e/scenarios/cloud-attach.e2e.ts)

- **Do**: scenario 4 asserts the modal (`cloud-deeplink-dialog`) instead of strip text, still proving park→ask→attach; ADD scenario 5: deep link claiming a project ≠ fixture project name → mismatch warning visible (`cloud-deeplink-mismatch`) → "Connect anyway" completes the attach (stub). Keep the fixture-config restore in `after()`.
- **Pattern**: existing testid helpers + `capture()` evidence calls.
- **Validate**: `pnpm test:e2e:desktop` with `MAUDE_E2E_CLOUD_STUB=1` (needs the Task 2 test build).
- **Gotcha**: memory `project_desktop_e2e_harness_wdio_gotchas` (pinned tauri-service 1.1.0, embeddedPort 4455, etc.).

### Task 7: REBUILD the committed client bundle (release-minified)

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css` with the source changes.
- **Gotcha**: CLAUDE.md rule — whatever is committed is what ships; run `git status apps/studio/dist/` before AND after any `bun test` run (test runs have clobbered dist with unminified dev bundles).
- **Validate**: `bash apps/studio/../..//scripts/check-tarball-shape.sh` via `pnpm` quality gates; bundle size sanity vs previous.

### Task 8: VERIFY the packaged app (the only proof that counts)

- **Do**: build the bundled `.app`; run `apps/desktop/scripts/check-bundle-completeness.mjs <app> --smoke` + `check-client-boots.mjs <app>`; then live-verify in the packaged app: (1) Sign in to Maude Cloud → OS browser opens `/activate?code=…`; (2) dialog shows the clickable link; (3) deep link (`open "maude://open/…"`) → decision modal; per memory `feedback_native_app_verification_ceiling` the interactive half is user-dogfooded — hand over with exact steps.
- **Gotcha**: green `tauri dev` and green browser prove nothing here (`window.__TAURI__`-only bug class, v0.51.1 precedent — this feature IS that class: the no-op only reproduces under Tauri).

---

## Validation

Repo-real gates (this repo has no generic 5-platform scenario runner for desktop features — validation per `.ai/workflows.config.json` `quality` + desktop gates):

1. **Lint/format**: `pnpm lint` + `pnpm format`
2. **Tests**: `pnpm test && pnpm test:dev-server` (expect `better-sqlite3` ABI red herring per memory — rebuild from source if the 8 hub-token failures appear)
3. **Rust**: `cargo check` + unit tests in `oauth.rs`; real build via Task 2/8
4. **Desktop e2e**: `pnpm test:e2e:desktop` (cloud-attach suite, stubbed)
5. **Packaged app**: bundle-completeness `--smoke` + client-boots + manual native verification (Task 8)
6. **Manual edge cases**: sign-in in plain-browser mode (`maude design serve`) still opens a tab; older-shell fallback path (simulate by invoking against a build without the command → visible link still works); self-host `MAUDE_CLOUD_URL` origin → native open works via exact-origin arm

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `cloud-attach.e2e.ts` 1-3 | sign-in flip, picker, attach writes linkedHub | ✅ existing |
| `cloud-attach.e2e.ts` 4 | deep link → decision modal → attach | 🆕 updated |
| `cloud-attach.e2e.ts` 5 | mismatch warning → Connect anyway | 🆕 new |

---

## Risks

- **Origin drift on self-host** (breaker): Rust env vs sidecar env vs cloud's self-origin can disagree behind proxies. Mitigated: per-call env read + exact-origin arm + the always-visible link fallback. Document in the capabilities description.
- **E2e fixture drift**: strip-text assertions replaced by testid assertions (less brittle).
- **Concurrent sessions on `~/git`**: `apps/cloud/operator.mjs` + `brand.mjs` are another session's in-flight work — stage ONLY this feature's files, never `git add -A`; watch `scripts/check-import-coherence.sh`.
- **TTL vs modal reading time**: the 2-minute handoff code now has a modal in front of it. Acceptable (modal is one decision), and the expiry error already tells the user to re-press Open in Maude. Do NOT add slower steps into this path.

## Follow-ups (out of scope, recorded)

- **Pull a local copy of a cloud project** (deep link "absent on disk" branch): needs a hub/cell download surface (`git archive`/bundle over the cell checkout), auth + path-traversal review (DDR-054 hub-untrusted), first-sync reconciliation rule ("cell is source of truth after download"). Own feature + `/flow:validate-security`.
- Consider surfacing the connected device in the cloud Account page copy at confirm time (dashboard already lists devices post-connect).

## Retro

- **The plan contradicted itself between two tasks, and the contradiction was load-bearing.** Task 5 said "local basename ≠ X → warn"; Task 6 required scenario 4 (fixture dir `project`, stub id `stub-project`) to be the *quiet* case. Both can't hold. I resolved it during execute with a containment heuristic — and the adversarial pass then showed that resolution was the security hole (below). The lesson for `/plan` isn't "check for contradictions" so much as: when a plan resolves an ambiguity by *loosening* a check, say out loud who controls the input to that check.
- **The anti-cry-wolf instinct was exactly backwards on attacker-controlled input.** The near-match rule was designed against a benign collision (`alligators-web` vs `alligators`). But the compared value is a cloud project id, which anyone can register — so "don't warn on near-matches" handed the attacker the off-switch for the warning, and the server's 409 doesn't cover it because the claim and the actual project genuinely agree. Only an exact match (or a credentialed link) is silent now. **Generalizable rule: before softening a check to reduce false positives, ask who picks the value being compared.**
- **The review fan-out earned its cost here.** The defender found a `%`/`cmd /c start` env-expansion path by reading the `open` crate's Windows source at the pinned version; the attacker reframed the zone as "Maude *and every tenant's* cell/share-view/canvas origin," which turned "not a general opener" into a claim the capability file couldn't support. Neither is visible from the diff alone. Both passes were worth more than the tests they didn't write.
- **Two long detours were environmental, and both looked exactly like a code failure.** A locked/asleep display and a macOS keychain prompt each froze the WKWebView, producing `webview unknown` + WebDriver script timeouts — never an assertion failure. `check-client-boots.mjs` stayed green through both, which is the tell. Encoded in the `desktop-e2e` memory with a `screencapture -x` triage step; a harness-level fix (skip the keychain read under `MAUDE_E2E_*`) would remove the recurring one.
- **The plan under-counted the ACL sites.** It listed three (`lib.rs`, `build.rs`, `capabilities/default.json`); there is a fourth — the `build.rs`-generated `permissions/autogenerated/<cmd>.toml`, whose 22 siblings are all tracked. A missing one is invisible locally and fatal on a fresh clone. Worth folding into the Tauri-command memory.
- **Reading the evidence, not just the exit code, caught two real defects** the assertions were happy with: every dialog screenshot was captured mid-animation (unreadable), and the two-sided row used the "open in browser" glyph as a directional divider. Both were only visible by opening the PNGs.

## Acceptance Criteria

- [ ] All tasks completed; `/flow:utils-verify` after each task
- [ ] Sign-in from the packaged app opens the OS browser at `/activate?code=…`; dialog shows a working clickable + copyable link; copy never claims a browser opened when it didn't
- [ ] All three former `window.open` no-ops route through the native opener in the shell
- [ ] Deep link always produces the explanatory modal; mismatch shows the warning + explicit Connect anyway; no mid-flow project switch; trust invariants (park-then-ask, slot non-replacement, configured-address-only exchange, 409 mismatch) unchanged
- [ ] `open_cloud_url` refuses non-cloud origins (unit-tested incl. smuggle shapes)
- [ ] Desktop e2e cloud-attach suite green (scenarios 1-5)
- [ ] Committed client bundle rebuilt `--release`; packaged-app gates green
- [ ] DDR recorded for the opener origin policy + deep-link modal semantics; What's New entry via `whats-new-entry` skill at `/flow:done`
