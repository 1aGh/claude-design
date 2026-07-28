# DDR-128 — First-open readiness check: detect-and-guide, non-blocking, no environment mutation

**Status:** proposed · **Date:** 2026-06-24 · **Phase:** 33 (proposed) — native onboarding readiness
**Relates:** DDR-126 (native distribution + security posture — "no package managers in the app"), DDR-123 (ACP chat runs on the user's own `claude` CLI, forwards prompts verbatim), DDR-125 (ACP multichat + accepted-risk posture), DDR-109 (main-origin loopback trust model), DDR-062 (plugins reach executable logic via `maude design <verb>`)

## Context

The desktop app bundles the whole dev-server as a sidecar (`apps/desktop/scripts/sync-sidecar.mjs` + `src-tauri/src/sidecar.rs`), so the **core experience — canvas browser, Cmd+Click CSS edit, git versioning, GitHub sign-in, branch-scoped collaboration — works with zero install.** That is the "no terminal at any step" promise (DDR-126, `site/content/docs/desktop/index.mdx:17`).

**AI editing is the exception, and it fails silently today.** The native chat panel is a thin ACP client (DDR-123): quick-action buttons prefill `/design:edit ` / `/design:new ` (`apps/studio/client/panels/ChatPanel.jsx:71`) and the handler forwards that text **verbatim, with zero enrichment**, to the user's own `claude` CLI (`apps/studio/acp/index.ts`). Therefore:

1. `/design:edit` / `/design:new` only resolve if the **maude marketplace + plugins (`design@maude`, `flow@maude`) are installed in that paired Claude Code** — the desktop app neither bundles them nor reimplements their logic.
2. `/design:edit` further shells out to `maude design <verb>` (screenshot / server-up / prep / slug — DDR-062), so it also needs the **`maude` CLI on PATH** in the environment the paired `claude` runs in.
3. None of this is surfaced. A plugin-less user types `/design:edit`, the command silently no-ops inside Claude Code, and the "no terminal" promise quietly breaks for the one feature that needs the terminal-world setup.

Today's onboarding (`apps/studio/client/panels/OnboardingWizard.jsx`) gates only on GitHub sign-in success and `.design/` presence — it never checks the AI-editing dependency chain. We want first-open to make the gap **visible and self-explanatory** rather than a silent failure.

Three things had no obvious default and were taken to the owner; this records the chosen posture.

## Decision 1 — Detect-and-guide, never auto-install (the posture)

The readiness check **detects** each dependency and, for anything missing, surfaces status + a copy-paste remediation + a one-line "why" — but it does **NOT run package managers, register plugins, or otherwise mutate the user's environment.** Rationale:

- **Plugin install is structurally out of reach.** `/plugin marketplace add` and `/plugin install` are slash commands that live **inside a Claude Code session**; the desktop app cannot invoke them. Writing the maude marketplace/plugin entries directly into `~/.claude/` would mean reaching into another tool's internal state — fragile across Claude Code versions and a maintenance liability. Detect + guide is the honest ceiling here.
  - **⚠ Superseded in part by [DDR-143](DDR-143-acp-session-scoped-plugin-auto-bootstrap.md) (2026-07-03).** This bullet enumerated only two levers (mutate `~/.claude`, or type `/plugin`) and concluded "out of reach." It missed a **third**: session-scoped `_meta.claudeCode.options.plugins` injection through the ACP adapter Maude already drives — non-mutating, per-session, no `~/.claude` write, no `npm`, no `/plugin`. DDR-143 uses it to auto-load `design`(+`flow`) on the **native/desktop** path (no-op for power users). The rejection of the two *original* levers (registry mutation, `npm i -g`) still stands; only the "structurally out of reach" conclusion is superseded, and only for the injection path. The rest of DDR-128 (non-blocking check, sidecar PATH fix, the `maude`/`claude` readiness rows) is unchanged.
- **Auto `npm i -g` violates the DDR-126 posture** ("the app does not run `npm install` / `brew install` / package managers"). We hold that line.
- Chosen over (a) **consented one-click installs** (`npm i -g @1agh/maude`, agent-browser) — rejected for v1 because it reverses DDR-126 and adds a network+exec attack surface; and (b) **full auto-setup** (write marketplace/plugins into `~/.claude/`) — rejected as fragile + highest-risk. Both remain enumerated under follow-ups, gated behind their own DDR if ever revisited.

The single sanctioned mutation is the opt-in PATH-link of a **bundled** `maude` CLI (Decision 4) — no npm, no network — and that is deferred out of v1.

## Decision 2 — The check is non-blocking; it never gates the onboarding doors

The bundled core works without any external dependency, so readiness is an **informational surface attached to the "AI editing" capability**, not a wall in front of the project. The user always "lands in a working project" (DDR-126); the readiness panel explains what AI editing additionally needs. It renders:

- as a **step / card in the onboarding wizard** (after the door is chosen, before/alongside landing), and
- as a **persistent "AI editing readiness" item** reachable post-onboarding (menu / status), so a user who installs the plugins later can re-check without reinstalling the app.

Hard-gating onboarding on these deps would break the core promise and punish users who only want the bundled browser/git/collab features.

## Decision 3 — Fix the root cause (sidecar PATH), then report on top

> **Revised during execution (2026-06-24).** The plan originally scoped Decision 3 as a login-shell-aware *probe* that only **reports** accurately. Tracing the ACP path showed the truncated-PATH problem is **not** confined to the report — it breaks AI editing itself. `apps/desktop/src-tauri/src/sidecar.rs` spawns the dev-server **without setting `PATH`**, so the sidecar inherits the macOS GUI launchd PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), *not* the user's shell PATH. Downstream: (1) `Bun.which('claude')` in the probe fails; (2) the ACP bridge (`acp/bridge.ts`) spawns the adapter with `scrubAgentEnv(process.env)`, so the adapter — and the `claude` it launches — inherit the same truncated PATH and can't find `claude`; (3) the paired `claude`'s `/design:edit` shell-out to `maude design <verb>` (DDR-062) can't find `maude`. This is why it works under `tauri dev` (inherits the terminal's full PATH) but fails in the packaged `.app` — the exact "works in dev, breaks when bundled" trap the native-verification-ceiling lesson warns about. The owner chose **fix the root cause + readiness on top** over report-only.

**Primary fix — inject the login-shell PATH at the sidecar boundary (Rust, once).** `spawn_server` resolves the user's login shell (`$SHELL -ilc`, marker-bracketed output to survive instant-prompt stdout noise, timeout-guarded on a worker thread, unix-only — Windows GUI apps already inherit the user PATH) and sets the resolved PATH on the sidecar's env. One fix corrects the whole chain: `Bun.which` becomes accurate, the adapter finds `claude`, and the paired `claude` finds `maude`. If resolution fails, PATH is left unset (no regression vs. today).

**Reporting surface — `/_api/preflight`.** With the sidecar PATH corrected, the readiness probe can use a plain `Bun.which` and be accurate in both the `.app` (Rust-fixed) and `maude design serve` (terminal PATH already correct) paths. A login-shell fallback stays in the probe as cheap defense-in-depth if the Rust resolution misses for an unusual shell config. The endpoint:

- Lives in a new `apps/studio/readiness.ts`, registered at `GET /_api/preflight` alongside `/_api/acp/status` (reuses `resolveClaudePath` from `acp/probe.ts`); main-origin-only (absent from `CANVAS_SAFE_API` + `startCanvasServer` routes).
- **Checks:** `claude` on PATH, `maude` on PATH, the maude marketplace (`repo: 1aGh/maude`) + plugins (`design@maude` / `flow@maude`) registered in the paired Claude Code (**read-only** scan of `$CLAUDE_CONFIG_DIR`/`~/.claude/plugins/{known_marketplaces,installed_plugins}.json`, follows symlinks), and optional `agent-browser`.
- Returns `{ ready, items: [{ id, label, required, status, detail, remediation }] }`. Unknown registry layout → `status:'unknown'` + generic guidance, never throws (it's Claude Code's internal contract).

## Decision 4 — The one sanctioned auto-action (tracked, NOT v1): bundle the maude CLI + opt-in PATH-link

The app already bundles the server binary; the `maude` CLI is pure Node JS. So the app **could** ship the CLI inside the `.app`/`.msi` and offer an explicit, opt-in **"Link Maude to your PATH"** — a consented symlink (`/usr/local/bin`) or shell-profile edit exposing the bundled binary. **No npm, no network** — it only surfaces what already ships. This is the one environment mutation that does not violate DDR-126's spirit (we're not resolving/installing anything from the internet) and is reversible. Deferred out of v1 to keep the first cut purely read-only; recorded here so the bundling decision is made deliberately, not by accident.

Plugin registration and `claude` login stay **guide-only** — neither can be safely automated from outside a Claude Code session.

## Security posture

Reviewed at close-out by the `/flow:done` defender + attacker fan-out (reports: `.ai/logs/security-reviews/ddr-128-readiness-defender.md` PASS WITH SUGGESTIONS, `…-readiness-attacker.md` 1 MEDIUM — both fixed before commit).

- **The read-only `~/.claude/` scan + the `/_api/preflight` report are clean:** no writes, no info leak (resolved binary paths are consumed as booleans, never serialized), no XSS (report strings are server-authored constants, React-escaped), `<bin>` is always a hardcoded literal (no shell injection), and the route is main-origin-only (absent from `CANVAS_SAFE_API` + `startCanvasServer`, asserted in `acp-origin-gate.test.ts`).
- **Correction to the original claim** ("no new attack surface beyond a read-only `~/.claude/` read" — *incomplete*): the Rust login-shell PATH resolution (T0) **executes the user's shell rc** (`$SHELL -ilc`) on every GUI/auto-start launch, not just in a terminal, and widens the sidecar/adapter PATH. This is the user's own dotfiles (pre-existing trust), but the *behavior* — rc runs at Finder/Dock/login-item boot — is new. Bounded: fixed command literal, stdin `/dev/null`, 5 s timeout, `$SHELL` is the user's own.
- **Fixed before commit (attacker F1, MEDIUM — DoS):** `/_api/preflight` originally used a **synchronous** `Bun.spawnSync` login-shell fallback with no Origin gate, so on a fresh machine (binary missing) a single call blocked the event loop ~5 s/binary, and a cross-site drive-by `fetch` to the loopback port could spawn-storm the server. Now: the fallback is **async `Bun.spawn`** (yields the loop) with the three probes run **concurrently**, and the route is **Origin-gated** (`sameOriginWrite` — a cross-origin GET is 403'd before any spawn). Same-origin/loopback callers (no Origin header) are unaffected.
- The deferred PATH-link (Decision 4) is the only mutation and is opt-in + reversible; it ships its own consent prompt.
- This does **not** touch the open DDR-126/DDR-109 main-origin-CSP follow-up — the readiness UI renders on the main origin like the rest of the shell; it introduces no privileged command reachable from the (remote loopback) origin.

## Consequences

- Users see **why** AI editing isn't working (missing plugins / `maude` / `claude` login) instead of a silent no-op; the "no terminal" promise is scoped honestly to the bundled core.
- `site/content/docs/desktop/index.mdx` should state the AI-editing prerequisite explicitly (the paired Claude Code needs the maude plugins + `maude` CLI) — the readiness panel and the docs should say the same thing.
- Detection of installed plugins depends on the `~/.claude/` registry layout, which is **Claude Code's** internal contract — if it changes, the plugin check degrades to "unknown" (show guidance anyway), never a hard error.
- Follow-ups (each gated behind its own decision if pursued): bundle the maude CLI + PATH-link (Decision 4); consented one-click installs; a deep-link / copyable block that pre-fills the `/plugin marketplace add` + `/plugin install` commands for the paired Claude Code.
