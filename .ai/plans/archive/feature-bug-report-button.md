# Feature: "Report a bug" in Maude Studio + Maude Desktop

> Resolved by a divergent debate (2026-07-30, reduce tier: BUILDER · SHIPPER ·
> BREAKER). Key consolidated verdicts baked into this plan:
> **(1)** the user-token path structurally cannot deliver screenshots — a
> `repo`-scoped user token can only file on the PUBLIC `1aGh/maude` (no write
> to any private intake repo, and the GitHub REST API cannot attach images to
> issues at all — a PNG must be *committed* to a repo the caller can write).
> Screenshots are the owner's #1 artifact ⇒ **cloud-brokered transport is the
> only viable primary**. **(2)** BREAKER's confused-deputy finding: never put
> the user's `repo`-scoped keychain token behind a reporting route — the
> broker (or nothing) carries the report. **(3)** Auto-collect-and-send would
> reverse the settled `crash_reporter.rs` privacy stance ("nothing leaves the
> machine") — every report goes through a **preview-and-edit consent screen**
> with per-item opt-out; nothing transmits silently. **(4)** Intake is a
> **private** repo; public `1aGh/maude` + user canvas screenshots is an
> irreversible leak (GitHub CDN retains attachment URLs past deletion).

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

A "Report a Bug…" affordance in the Studio menubar (Help) and the Desktop native Help menu. It opens one dialog that: captures a screenshot of the active canvas (annotatable/redactable before sending), auto-collects diagnostic context (Maude version, OS, surface, active canvas slug, recent server-log tail, crash-log presence), lets the user describe the problem, shows **exactly** what will be sent with per-item checkboxes, and files a GitHub issue in the private intake repo `1aGh/maude-reports` via a new `cloud.maude.sh` route. The issue carries a machine-parseable `maude-report/v1` JSON block — the contract the autonomous fix agent (see `feature-bug-autofix-agent.md`) consumes.

## User Story

As a (often non-technical) Maude user who hits a bug, I want one button that files a complete, screenshot-carrying report for me, so that the bug actually gets fixed without me knowing what GitHub is.

## Problem

- Today a user who hits a bug has no in-product path at all: they must know the repo, have a GitHub account, and hand-assemble version/OS/logs. Non-technical desktop users (the DDR-177 target persona: "never opens a terminal") simply never report.
- The highest-value artifact — what the user actually saw — is lost. `crash_reporter.rs` writes local logs the user "can attach to a GitHub issue" manually, which nobody does.
- Sidecar/dev-server stdout is not captured anywhere on desktop, so even a motivated reporter has no log to attach.

## Solution

Three layers, matching the trust model already in the codebase:

1. **Collection (local, consent-gated)** — a `/_api/debug-bundle` dev-server route assembles the scrubbed context; the client dialog renders it as a reviewable checklist. Screenshot = active-canvas PNG via the existing export spine, with a black-box redaction pass before it ever leaves the machine.
2. **Transport (cloud-brokered)** — `POST https://cloud.maude.sh/report` (multipart). The worker validates (size/type/quota), commits media into `1aGh/maude-reports` under `media/`, and creates the issue with the GitHub App installation token (`github-app.mjs` — key never leaves the control plane, per its own blast-radius doctrine). Works for signed-out users, browser Studio, and `.deb` users alike.
3. **Fallback (local bundle)** — cloud unreachable or declined: write the bundle to `<designRoot>/_reports/<ts>/` and open a prefilled `github.com/1aGh/maude/issues/new` URL (text-only, no media) so the path degrades instead of dying.

## Metadata

- **Ticket**: none yet (this plan IS the intake feature; tracker provider `github`)
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (server + client), `apps/desktop` (Tauri), `apps/cloud` (worker) — cross-cutting ⇒ root `.ai/plans/`
- **Affected Systems**: dev-server HTTP layer, studio client menubar/dialog, Tauri menu + commands, cloud worker routes, new private repo `1aGh/maude-reports`
- **Dependencies**: GitHub App (already used by cloud) additionally installed on `1aGh/maude-reports`; no new npm deps expected client-side

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `apps/desktop/src-tauri/src/crash_reporter.rs` (full, esp. lines 1–13) — Why: the standing privacy invariant this feature must not reverse; also the crash-log dir the bundle lists.
- `apps/studio/client/github.js` (full) — Why: the client↔Tauri↔dev-server bridge pattern (invoke/listen/api helpers) the dialog reuses.
- `apps/cloud/github-app.mjs` (full) — Why: installation-token minting the `/report` route calls; its "token is not stored/logged/returned" doctrine applies verbatim.
- `apps/cloud/worker.mjs` (route dispatch around lines 220–280) — Why: route registration pattern + where `/report` slots in.
- `apps/cloud/wrangler.toml` — Why: R2/D1 bindings; NOTE — v1 deliberately does NOT use R2 (media is committed to the intake repo instead; no lifecycle management to rot).
- `apps/studio/http.ts` (route map ~900–1600, `/_api/export` ~3011, `CANVAS_SAFE_API` ~681) — Why: where `/_api/debug-bundle` registers. **It is privileged: NEITHER in `CANVAS_SAFE_API` NOR in the canvas `routes` map** (DDR-088 dual-allowlist rule).
- `apps/studio/client/app.jsx` (menubar ~3277, HelpModal ~2817, whats-new wiring ~91) — Why: menubar action + modal patterns to mirror; `data-testid` conventions for e2e.
- `apps/studio/client/whats-new.jsx` — Why: the panel/toast pattern for a client feature fed by a `/_api/*` route.
- `apps/desktop/src-tauri/src/menu.rs` — Why: `MENU_*` constant + `MenuItemBuilder` pattern for the native "Report a Bug…" item.
- `apps/desktop/src-tauri/src/sidecar.rs` — Why: sidecar spawn — where stdout/stderr capture (T1b) hooks in.
- `apps/desktop/src-tauri/build.rs` + `capabilities/default.json` + `src/lib.rs` — Why: the 3-edit rule for any new `#[tauri::command]` (`generate_handler` + capability allowlist + `build.rs commands()`); missing `build.rs` hard-panics `tauri-build` and `cargo check` does NOT catch it (memory: `reference_tauri_command_needs_build_rs`).
- `apps/studio/paths.ts` — Why: DDR-045 — never compute `__dirname` locally in dev-server code.
- `.ai/archive/decisions/DDR-054-*`, `DDR-088-*` — Why: canvas-origin trust model; the new route must stay off both canvas allowlists.

### Files to Create

- `apps/studio/debug-bundle.ts` — bundle assembly + deterministic scrubber (pure, unit-testable).
- `apps/studio/test/debug-bundle.test.ts` — scrubber redaction tests (bun:test).
- `apps/studio/client/report-bug.jsx` — the dialog (preview/consent/redact/submit states).
- `apps/cloud/report.mjs` + `apps/cloud/report.test.mjs` — the `/report` route: validation, quota, media commit, issue creation.
- `docs/report-schema.md` — the `maude-report/v1` contract (shared with the fix-agent plan).

### Documentation

- [GitHub REST — create an issue](https://docs.github.com/en/rest/issues/issues#create-an-issue) — Why: broker call shape; confirms no attachment upload API exists.
- [GitHub REST — create/update file contents](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents) — Why: how the worker commits the PNG to the intake repo.
- [Tauri v2 menu](https://v2.tauri.app/learn/window-menu/) — Why: Help-menu item + event emit to the webview.

### Patterns to Follow

- Client→server call shape: `api('/_api/…')` helper in `client/github.js` (returns `{ok, status, json}`, never throws).
- Worker route + test pairing: every `apps/cloud/*.mjs` has a sibling `*.test.mjs`; `/report` follows `checkout-routes.mjs` for multipart/body handling and `github-app.test.mjs` for token-mint mocking.
- Native menu → webview event: `menu.rs` `MENU_NEW_PROJECT` → `menu://new-project` → `onMenuNewProject` in `github.js`.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Modal shell | `client/app.jsx` `HelpModal` | same backdrop/Esc/aria pattern |
| Toast/confirm | `client/whats-new.jsx` toast | reuse for "Report sent — issue #N" |
| Annotation/redact | existing draw/annotation layer (`*.annotations.svg` spine) | black-box tool over the screenshot preview; flatten to PNG client-side before upload |

### Tokens

Standard DS tokens only (`--bg-*`, `--fg-*`, `--accent*`); no new visual vocabulary. Dialog copy in English (design plugin/product surface is English-authored).

### Key decisions (record as DDR at `/flow:done`)

1. **Transport = cloud broker, private intake repo `1aGh/maude-reports`** (debate verdict above). User's keychain GitHub token is NEVER used for reporting (confused-deputy). Public-issue mirroring of scrubbed reports = explicit non-goal for v1 (manual promotion by maintainer).
2. **Media = committed to the intake repo, not R2.** Durable (no lifecycle expiry breaking old issues), private, readable by the fix agent with one credential. Size cap 5 MB/image, PNG/JPEG only, max 3 images/report.
3. **Consent-first, always.** The preview screen is not skippable; every payload item (screenshot, log tail, crash-log, canvas slug, project name) has its own checkbox; description is the only mandatory field. Default state: screenshot ON (it's the point) but visibly previewed; logs ON only after scrubbing; project name OFF.
4. **Abuse posture for the open endpoint** (BREAKER #3, accepted residual risk): per-install-id quota (5/day) + IP rate limit + size/type caps + private-repo landing (spam has minimal blast radius) + kill switch (worker env flag disables the route). No signed-report requirement in v1 — it would exclude exactly the signed-out users the broker exists for; revisit when device-auth (Cloud Phase 23 C1/C2) ships broadly, then prefer the device token when present.
5. **Scrubbing is deterministic + tested**, not best-effort: home-dir → `~`, absolute repo paths → `<project>/…`, anything matching token/bearer/key patterns → `[redacted]`, email → `[email]`. The scrubber is a pure function with a red/green test file.

---

## Tasks

### Task 1: CREATE debug-bundle collection (dev-server)

- **Do**: `apps/studio/debug-bundle.ts` — assemble `{ appVersion, platform, arch, surface (native|browser), projectName?, activeCanvas (slug only, never content), serverLogTail (last 200 lines, scrubbed), crashLogs: [{name, firstLine}] }`. Add an in-memory ring buffer (500 lines) tapping the server's console/log path; expose `GET /_api/debug-bundle` (privileged — NOT canvas-safe, guard with `GET → 405`-style assertion in `test/canvas-origin-gate.test.ts` like other privileged routes).
- **Do (1b)**: desktop sidecar stdout/stderr → pipe into a rotating file `~/Library/Logs/Maude/server.log` (sidecar.rs), so the bundle has a log source even when the ring is fresh. 1 MB rotation, keep 3.
- **Pattern**: `paths.ts` for any disk path (DDR-045); `bun:test` for the scrubber tests.
- **Gotcha**: never include canvas file CONTENT or absolute user paths; scrubber runs server-side before the bundle ever reaches the client.
- **Validate**: `cd apps/studio && bun test debug-bundle` + `bun test canvas-origin-gate`

### Task 2: CREATE cloud `/report` route

- **Do**: `apps/cloud/report.mjs` — `POST /report` multipart: `report` (JSON, `maude-report/v1`) + `screenshot[0..2]` (PNG/JPEG ≤ 5 MB). Validate → quota check (D1 table `report_quota` keyed by install id + IP) → commit media to `1aGh/maude-reports:media/<yyyy-mm>/<id>-<n>.png` (contents API, installation token) → create issue: title from description first line, body = human section + fenced ```json maude-report/v1``` block + media links; label `report`. Return `{issueUrl, issueNumber}`. Env kill switch `REPORTS_DISABLED`. Wire into `worker.mjs` dispatch.
- **Pattern**: `github-app.mjs` token mint (never store/log/return the token); `*.test.mjs` sibling with mocked GitHub fetch.
- **Gotcha**: worker has no `Buffer` — use Web APIs (`FormData`, `arrayBuffer`, `btoa` via chunks) for the base64 contents commit.
- **Validate**: `cd apps/cloud && npm test` (all existing suites stay green)
- **Manual pre-req (owner)**: create private repo `1aGh/maude-reports`; install the existing GitHub App on it with Issues:write + Contents:write.

### Task 3: CREATE studio Report-a-bug dialog

- **Do**: `client/report-bug.jsx` — states: *describe* → *preview & consent* (bundle checklist + screenshot thumbnail with black-box redaction + remove) → *sending* → *done (issue link) | fallback*. Screenshot captured on open via the export spine (`/_api/export` PNG of active canvas); redaction = draw filled rects onto an offscreen canvas, flatten, re-encode. Menubar Help gets "Report a Bug…" (+ `data-testid="report-bug-open"`); command palette entry. Fallback path: write bundle to `<designRoot>/_reports/<ts>/` via a small privileged POST, open prefilled `issues/new` URL (title+body only).
- **Pattern**: `HelpModal` modal a11y; `whats-new.jsx` toast; `api()` helper style.
- **Gotcha**: after client edits, rebuild the committed bundle **release-minified** (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit `dist/client.bundle.js` + `dist/styles.css`; check `git status apps/studio/dist/` before/after any `bun test`.
- **Validate**: `maude design smoke` unaffected; manual dialog walk in browser mode.

### Task 4: ADD desktop native surface

- **Do**: `menu.rs` — `MENU_REPORT_BUG` under Help → emit `menu://report-bug`; client listens (github.js `listen` pattern) and opens the dialog. New Tauri commands `list_crash_logs` / `read_crash_log` (scrubbed read of `crashes/` dir) so the bundle can include crash reports on desktop.
- **Gotcha**: the 3-edit rule — `generate_handler` + `capabilities/default.json` + `build.rs commands()`; verify with a real desktop build, not `cargo check`. Then run `apps/desktop/scripts/check-bundle-completeness.mjs <app> --smoke` (DDR-177) before release.
- **Validate**: `pnpm test:e2e:desktop` scenario (T6)

### Task 5: CREATE `maude-report/v1` schema doc

- **Do**: `docs/report-schema.md` — fields, versioning rule (additive only), label taxonomy (`report`, `fix-in-progress`, `pr-open`, `needs-human`, `wontfix-auto`), and the fenced-JSON embedding convention. This is the contract `feature-bug-autofix-agent.md` consumes — link both ways.
- **Validate**: schema example round-trips through the worker test.

### Task 6: ADD e2e + testids

- **Do**: desktop-e2e scenario `report-bug-dialog` (open via menu event, assert preview checklist renders, cancel); agent-browser check for browser mode. testids: `report-bug-open`, `report-bug-preview`, `report-bug-send`.
- **Validate**: `pnpm test:e2e:desktop`

---

## Validation

1. **Lint/format**: repo `quality` gates (`jq` from `.ai/workflows.config.json`)
2. **Tests**: `cd apps/studio && bun test`; `cd apps/cloud && npm test`
3. **Build**: `pnpm build`; committed `dist/` artifacts rebuilt `--release`
4. **Canvas-origin gate**: `bun test canvas-origin-gate` (new route 405s from canvas origin)
5. **Desktop**: real `tauri build` + `check-bundle-completeness.mjs --smoke` + desktop-e2e scenario
6. **Manual**: full happy path against the live worker (file a real report end-to-end into `maude-reports`); offline fallback path; redaction actually blacks out pixels in the uploaded PNG (download from the issue and check).

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `report-bug-dialog` (desktop-e2e) | menu → dialog → preview → cancel | 🆕 new |
| agent-browser smoke | browser-mode dialog open + fallback copy | 🆕 new |

## Acceptance Criteria

- [x] All tasks completed; verified per task (targeted suites in place of `/flow:utils-verify`)
- [x] Nothing transmits without the consent screen; every item opt-out-able; verified live via agent-browser walk
- [x] Scrubber tests cover: home paths, tokens, emails, project paths (`test/debug-bundle.test.ts`)
- [x] New `/_api/debug-bundle` + `/_api/report` + `/_api/report-fallback` are in NEITHER canvas allowlist (`canvas-origin-gate.test.ts`)
- [x] Issue lands with parseable `maude-report/v1` block + committed media — live-verified (#1 intake probe; after the owner's public-destination override, #69 on `1aGh/maude` with private media links, byte-identical round-trip)
- [x] Kill switch covered by `report.test.mjs` (flag on → 503) — client fallback path exercised in tests + fallback UI walk
- [x] DDR recorded: DDR-208 (broker transport, public-issue + private-media split, consent posture, media-in-repo)
- [x] What's New entry appended (pending version) via `whats-new-entry` skill

## Retro

- **The debate earned its cost:** SHIPPER's "GitHub API cannot attach images" fact and BREAKER's confused-deputy finding decided the architecture before a line was written; both survived contact with reality unchanged. The owner later overrode F3 (public issues) — the split-destination answer preserved the privacy line while honoring the override, which is exactly what a recorded rejected-alternative is for.
- **Live verification > mocks:** the mocked-GitHub tests were green, but only the real end-to-end probe (harness driving production `handleReport` against real GitHub) proved the contents-API commit + issue flow — and the very first dogfood report caught the dialog off-DS. Screenshot-driven bug reports work; report #69's own screenshot was the repro.
- **Shared-tree hazard bit again (3rd time in v0.51.0):** committing shared files (`worker.mjs`, `http.ts`, `lib.rs`) from the concurrent session carried this feature's imports into main while the modules were untracked here — the other session had to land them to fix CI. The new import-coherence gate + CLAUDE.md rule exist because of this; `/flow:plan` should flag "shared-file edits on a concurrent tree" as a coordination risk up front.
- **`bun test` clobbered `dist/` exactly as the CLAUDE.md warning predicts** — the checksum-before/after habit caught it both times. Keep the habit; the root cause is still unconfirmed.
- **What to change next time:** when a feature spans two deploy surfaces (worker + client), plan the *deploy* step explicitly — code-complete ≠ live; the worker still needs a deliberate deploy after the tree quiets down.
