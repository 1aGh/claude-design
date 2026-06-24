# Feature: First-open AI-editing readiness check (desktop onboarding)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is native-app + dev-server work (Tauri/Rust shell + Bun dev-server route + React onboarding UI).** UI gates apply to the React surface (a11y, DS tokens). The hardest correctness item is environment-detection accuracy, not pixels — see DDR-128 Decision 3 (login-shell PATH trap).

## Description

Add a **non-blocking, detect-and-guide** readiness check to the desktop app's first-open flow (and a persistent re-check surface) that verifies the dependency chain AI editing actually needs, and explains any gap instead of letting `/design:edit` fail silently. Per **[DDR-128](../decisions/DDR-128-first-open-readiness-check-detect-and-guide.md)**: detect everything, mutate nothing in v1, never block the onboarding doors.

The bundled core (canvas browser, git, GitHub sign-in, collaboration) keeps working with zero install; this feature only makes the **AI-editing prerequisite** visible: a paired Claude Code with the maude marketplace + `design@maude`/`flow@maude` plugins, the `maude` CLI on PATH, and a logged-in `claude` CLI.

## User Story

As a non-technical user who installed only the Maude desktop app, when I try to use AI editing I want the app to tell me up front exactly what's missing (and how to get it) — instead of typing `/design:edit` into the chat and watching nothing happen — so that I either fix the gap in a couple of guided steps or understand that the bundled browser/git/collab features work regardless.

## Problem

The native chat panel forwards `/design:edit` / `/design:new` **verbatim** to the user's own `claude` CLI (DDR-123, `apps/studio/acp/index.ts`). Those commands resolve only if the maude plugins are installed **in that paired Claude Code**, and `/design:edit` additionally shells out to `maude design <verb>` (DDR-062), needing `maude` on PATH. Today onboarding (`OnboardingWizard.jsx`) checks none of this. A plugin-less user hits a **silent no-op** and the "no terminal at any step" promise (DDR-126) breaks for the one feature that depends on terminal-world setup. `GET /_api/acp/status` already detects the `claude` CLI but nothing detects `maude` on PATH or the installed plugins, and nothing surfaces readiness during onboarding.

## Solution

1. **One detection surface.** Extend `apps/studio/acp/probe.ts` into a structured `GET /_api/preflight` readiness endpoint that reports, per dependency: `present | missing | unknown`, a human `reason`, and a copy-paste `remediation`. Reuse `maude doctor`'s detection libs; don't duplicate.
2. **Login-shell-aware probing (the load-bearing correctness item).** Resolve `claude` / `maude` via a login shell (`zsh -lic 'command -v …'`), NOT the GUI app's truncated PATH — otherwise everything reports false-missing on macOS. See DDR-128 Decision 3.
3. **Read-only plugin detection.** Scan `~/.claude/` (following symlinks) for the maude marketplace + `design@maude`/`flow@maude` registration. Never write. Degrade to `unknown` + guidance if the registry layout is unrecognized.
4. **Non-blocking UI.** A readiness card in the onboarding wizard (after a door is chosen) + a persistent "AI editing readiness" item reachable post-onboarding. Green checks for present deps; for missing ones, the `reason` + copy-paste fix. **Never gates the doors** — the user always lands in a working project.
5. **Docs honesty.** Update `site/content/docs/desktop/index.mdx` so the AI-editing prerequisite is stated explicitly and matches what the panel says.

Out of scope for v1 (DDR-128 follow-ups): bundling the `maude` CLI + opt-in PATH-link (Decision 4), any one-click install, writing into `~/.claude/`.

## Metadata

- **Type**: New Capability (native onboarding)
- **Complexity**: Medium (1 new/extended dev-server route + Rust-or-Bun login-shell probe + 1 React surface + docs; no new runtime deps)
- **App/Package**: `apps/studio` (dev-server route + client) + `apps/desktop` (only if the login-shell probe lands on the Rust side) + `site` (docs)
- **Affected Systems**: `acp/probe.ts`, dev-server HTTP route map, `OnboardingWizard.jsx`, `ChatPanel.jsx` (reuse the same readiness signal it already fetches), `maude doctor` libs (reused read-only), desktop docs
- **Dependencies**: none new at runtime. Soft contract on Claude Code's `~/.claude/` plugin-registry layout (read-only; degrades to `unknown`).

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message.**

- `apps/studio/acp/probe.ts` (whole file) — Why: the existing detection to extend; shows `resolveClaudePath()` / `Bun.which` and the `{available, reason, claudePath, adapterEntry}` shape. The new endpoint generalizes this. **This is where the login-shell-vs-truncated-PATH fix lands.**
- `apps/studio/acp/index.ts` — Why: confirms prompts are forwarded verbatim (no enrichment) and shows the existing WS/HTTP wiring style; the new `/_api/preflight` route registers alongside `/_api/acp/status`.
- `apps/studio/client/panels/ChatPanel.jsx` (esp. the `/_api/acp/status` fetch + the `QUICK_ACTIONS` `/design:edit` prefill, ~lines 23 + 71) — Why: it already consumes the probe to decide whether to show chat; the readiness card should reuse the same signal, and the "missing deps" state should explain the quick-action buttons.
- `apps/studio/client/panels/OnboardingWizard.jsx` (whole file) — Why: the wizard step structure (GitHub / local folder / hub doors, first-run detection) where the readiness card slots in. Match its component + CSS-token conventions.
- `cli/commands/doctor.mjs` + `cli/lib/preflight.mjs` + `cli/lib/stack-detect.mjs` — Why: the canonical dependency-detection logic to **reuse** (not re-implement) for the endpoint. Note what `doctor` does NOT check today (Claude Code login, installed plugins) — those are the net-new probes.
- `apps/studio/server.ts` + `apps/studio/http.ts` — Why: route registration. **A canvas-reachable route must be in BOTH `CANVAS_SAFE_API` and the `routes` map (DDR-088); a privileged route in NEITHER.** `/_api/preflight` is main-origin-only → keep it OUT of `CANVAS_SAFE_API`.
- `apps/studio/paths.ts` — Why: resolve `~/.claude/` and the maude package root via the sanctioned path module, NOT a local `dirname(fileURLToPath(...))` (DDR-045 — breaks inside `bun --compile`).
- `apps/desktop/src-tauri/src/sidecar.rs` + `src/lib.rs` — Why: only if the login-shell probe is better run from Rust (it can spawn a login shell cleanly); shows the existing `tauri_plugin_shell` spawn pattern + `invoke_handler` registration.
- `site/content/docs/desktop/index.mdx` — Why: the "no terminal at any step" + "AI editing pairs with a Claude Code you already have installed" copy to reconcile with the panel.
- `.ai/decisions/DDR-128-first-open-readiness-check-detect-and-guide.md` — Why: the governing decision (posture, non-blocking, login-shell trap, what's deferred).
- `.ai/decisions/DDR-126-...` + `DDR-123-...` + `DDR-062-...` — Why: the "no package managers" posture, the verbatim-forward ACP contract, and the `maude design <verb>` shell-out that makes `maude`-on-PATH a real requirement.

### Files to Create / Modify

- **Modify** `apps/studio/acp/probe.ts` — generalize into a readiness probe (or add `probeReadiness()` beside `probeAcpAvailability()`), login-shell-aware.
- **Create** the `/_api/preflight` handler (in `acp/` or a small `preflight.ts`), registered in `server.ts` `routes` + `http.ts` — main-origin-only, NOT in `CANVAS_SAFE_API`.
- **Create** `apps/studio/client/panels/ReadinessCard.jsx` (or fold into the wizard) — the non-blocking readiness surface.
- **Modify** `OnboardingWizard.jsx` — mount the readiness card after a door is chosen; never gate.
- **Modify** `ChatPanel.jsx` — when AI editing is not ready, link/expand the same readiness explanation instead of just hiding.
- **Modify** `site/content/docs/desktop/index.mdx` — state the AI-editing prerequisite explicitly.
- **Possibly modify** `apps/desktop/src-tauri/src/*` — only if the login-shell probe runs Rust-side (add a `preflight_probe` Tauri command).

### Patterns to Follow

- **Probe shape** — mirror `probe.ts`'s `{available, reason, ...}` but as an array of `{ id, label, status: 'present'|'missing'|'unknown', reason, remediation }`. Stable `id`s so the client can render fixed rows.
- **Route allowlist discipline (DDR-088)** — `/_api/preflight` is privileged/main-origin → register in the `routes` map only, keep it out of `CANVAS_SAFE_API`; add the `GET → 405`-from-canvas-origin assertion in `test/canvas-origin-gate.test.ts` if a canvas-origin guard test exists for siblings.
- **Path resolution (DDR-045)** — import from `paths.ts`; never compute `dirname(fileURLToPath(import.meta.url))` (breaks in `bun --compile`).
- **No env mutation (DDR-128 / DDR-126)** — read-only everywhere in v1; the only shell spawn is a binary-resolution `command -v`, no user-controlled args.
- **DS-native UI (memory: reuse-but-Maude-styled)** — the readiness card uses the studio's own tokens/components, not a borrowed widget theme.

---

## Tasks

- [ ] **T1 — Readiness probe (login-shell-aware).** Extend `probe.ts`: detect `claude` (reuse existing), `maude` on PATH, and `agent-browser`, all resolved via a **login shell** so the result matches the env the paired `claude` runs in. Return the per-dep `{id,label,status,reason,remediation}` array. Unit-cover the false-negative case (binary present in login shell, absent in app env → must report `present`).
- [ ] **T2 — Plugin-registry read.** Add a **read-only** `~/.claude/` scan (follow symlinks) for marketplace `1aGh/maude` + plugins `design@maude`/`flow@maude`. Unknown layout → `status: 'unknown'` + generic guidance, never throw. Verify the actual registry path/format before coding (it's Claude Code's internal contract).
- [ ] **T3 — `/_api/preflight` route.** Register main-origin-only (in `routes`, NOT `CANVAS_SAFE_API`); reuse `maude doctor` libs for the deps it already covers. Add the canvas-origin-gate assertion if the sibling pattern has one.
- [ ] **T4 — Readiness card UI.** Non-blocking card in `OnboardingWizard.jsx` (post-door, pre/at-landing) with green checks + copy-paste remediation for gaps. DS tokens, a11y (keyboard reach, labels, contrast).
- [ ] **T5 — ChatPanel reconcile.** When AI editing isn't ready, surface the same readiness explanation (not just hide the panel); reuse the T3 signal.
- [ ] **T6 — Persistent re-check.** Expose readiness post-onboarding (menu/status) so a user who installs plugins later can re-verify without reinstalling.
- [ ] **T7 — Docs honesty.** Update `desktop/index.mdx` so the AI-editing prerequisite (paired Claude Code + maude plugins + `maude` CLI) is explicit and matches the panel copy.
- [ ] **T8 — Bundle artifacts + verify on the real `.app`.** Rebuild the committed client bundle release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` + `dist/styles.css`). Verify in the **bundled `.app`**, not just `tauri dev` (native-app verification ceiling): the login-shell probe must report correctly there, where the truncated-PATH trap actually bites.

## Verification

- **Probe correctness (the critical path):** on a machine where `maude`/`claude` are on the login-shell PATH but not the GUI app env, the panel must show them **present**. This is the regression the whole feature hinges on — verify in the packaged `.app` per the native-app verification ceiling (system `screencapture` + computer-use to drive the real window).
- **Non-blocking invariant:** with every dependency missing, onboarding still completes and the bundled core (browse/git/collab) works.
- **Route gate (DDR-088):** `/_api/preflight` 405s from the canvas origin; reachable from main origin.
- **No mutation:** confirm the check performs zero writes (no `~/.claude/` writes, no env/PATH changes) — read-only `command -v` + filesystem reads only.
- **Bundle drift:** committed `dist/client.bundle.js` + `dist/styles.css` are the release-minified artifacts (not the 3.6MB dev self-heal output).
- **Docs ↔ panel parity:** the prerequisite stated in `desktop/index.mdx` matches the panel's remediation text.

## Design / Architecture Decisions

Governed by **[DDR-128](../decisions/DDR-128-first-open-readiness-check-detect-and-guide.md)**. Key load-bearing calls already settled there:

- **Detect-and-guide, no mutation (v1)** — plugin install can't be driven from outside a Claude Code session; `npm i -g` violates DDR-126. The check only reads + guides.
- **Non-blocking** — readiness attaches to the AI-editing capability, never gates the doors (preserves "land in a working project").
- **Login-shell probe** — the single highest-risk correctness item; the macOS GUI-PATH ≠ shell-PATH trap produces false negatives if probed naively.
- **Deferred:** bundling the `maude` CLI + opt-in PATH-link (DDR-128 Decision 4) is the cleanest future one-click (no npm, app already ships a binary) — explicitly NOT in this plan.

---

## Retro

- **Tracing the runtime before coding paid off.** Following the ACP path (`bridge.ts` spawns the adapter with the inherited env) surfaced that the real bug was the **sidecar inheriting the truncated launchd PATH**, not just an inaccurate report. That turned a "report-only" feature into an actual fix (DDR-128 Decision 3 revised mid-execution) and was the highest-value moment of the work. **Lesson for `/plan`:** when a feature's value depends on a runtime env (PATH, shell, spawn inheritance), add a "trace the actual runtime env one layer below the stated scope" task *before* the UI tasks.
- **The `/flow:done` adversarial fan-out earned its keep.** The implementation shipped a synchronous `Bun.spawnSync` login-shell fallback with no Origin gate — on a fresh machine that blocks the dev-server event loop ~5 s/binary, and a drive-by page could spawn-storm it (ethical-hacker F1, MEDIUM). Fixed before close-out (async `Bun.spawn` + concurrent probes + `sameOriginWrite` gate + a regression test). Verify-by-attacker caught a real bug the author missed.
- **Reuse kept the diff small.** `sameOriginWrite`, the `help-modal-*` chrome, and one shared `ReadinessList` across three surfaces (onboarding strip · ChatPanel · Help modal) meant little net-new UI. Matches the "reuse libs but in Maude's style" prior.
- **The dist-churn trap bit repeatedly.** Every server-booting test self-heals `dist/` to unminified dev bundles; had to `git checkout dist/` + release-rebuild several times. The "rebuild `--release` before any dist commit" rule is load-bearing — worth keeping front-of-mind in any dev-server feature.
- **Verification ceiling honored.** The native `.app` PATH-fix behavior (Finder launch) is owed to the user; built the `.app` and a sandbox-launch recipe (`PATH=/usr/bin:/bin` + `SHELL=/usr/bin/false` + empty `CLAUDE_CONFIG_DIR`) so the fresh-user empty state can be previewed without uninstalling anything.
