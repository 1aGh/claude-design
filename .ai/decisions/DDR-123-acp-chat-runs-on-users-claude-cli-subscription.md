# DDR-123 — The ACP chat panel drives the user's OWN installed `claude` CLI (subscription, never API billing), reusing claude-code-acp + agent-client-protocol + assistant-ui headless

**Status:** accepted · **Date:** 2026-06-21 · **Phase:** 31 (Native Maude: ACP sidepanel — de-icebox phase-7)
**Supersedes/relates:** phase-7 plan (`.ai/plans/phase-7-acp-chat-sidebar.md` — overrides its "hand-rolled ACP client, no SDK, attach to a pre-existing session" premise), DDR-054 (untrusted-canvas / loopback trust model), DDR-062 (plugins reach executables via `maude`), DDR-106/DDR-109 (Tauri sidecar lifecycle + loopback-only navigation), DDR-045 (real-disk path resolution)

## Context

Phase-31 surfaces the chat/agent sidepanel (de-icebox of phase-7) in the **native** Maude shell. The owner set two hard constraints that override phase-7's design and gate every downstream choice:

1. **Zero new login + Claude Pro/Max SUBSCRIPTION, never API-key billing.** The panel must reuse whatever Claude auth the user already set up; it must NOT consume metered API credits.
2. **Reuse existing building blocks — don't reinvent the wheel.** A polished chat (streaming, tool-call rendering, cancel, markdown, a11y) should come from existing libraries, rendered in Maude's own visual style.

Research this session (primary sources, not blogs) found phase-7's premise wrong on three points:

- **Claude Code does not speak ACP natively.** ACP (Agent Client Protocol, Zed) is JSON-RPC-2.0 over stdio (`initialize` → `session/new` → `session/prompt` → `session/update` streaming → `session/cancel`). To make Claude Code an ACP agent you run an **adapter subprocess** (`@zed-industries/claude-code-acp`) that wraps it.
- **You cannot "attach to a pre-existing interactive `claude` session."** ACP needs a dedicated agent subprocess. The adapter spawns its own `claude -p --output-format stream-json --verbose --resume <id>` under the hood.
- **The subscription/login distinction is precise and load-bearing** (Anthropic [auth precedence](https://code.claude.com/docs/en/authentication) + [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)):
  - ❌ **Restricted:** a third-party product that *offers claude.ai login / subscription rate-limits for its own product* — e.g. embedding `@anthropic-ai/claude-agent-sdk` and feeding it an OAuth token. The SDK docs explicitly steer third parties to API keys: *"Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."* → **the SDK path is out for our subscription requirement.**
  - ✅ **Sanctioned (how Zed ships):** spawn the user's **own, separately-installed `claude` CLI**, into which the user logged in with their *own* `/login`. The third-party tool is an ACP *client*; the spawned Claude Code "owns its own authentication and billing." The tool never sees or stores the token.

  Auth precedence confirms the mechanism: `ANTHROPIC_API_KEY` (#3, API billing) **beats** subscription OAuth from `/login` (#6, the Pro/Max default). *"Run `unset ANTHROPIC_API_KEY` to fall back to your subscription."*

## Decision

**Connection model — drive the user's own logged-in `claude` CLI; never hold the credential.** The chat panel is an ACP *client*; the agent is the user's installed Claude Code, reached through the adapter. Maude never implements a sign-in, never reads/stores an OAuth token, never sets an API key.

**Reused stack (no reinvention; minimal dep set — Vercel AI SDK and the `@mcpc-tech` community bridge were both evaluated and dropped):**

| Layer | Library (reused) | Runs in | Role |
| --- | --- | --- | --- |
| Agent | `@zed-industries/claude-code-acp` | spawned subprocess (native-side) | wraps `claude -p`; subscription |
| ACP client | `@zed-industries/agent-client-protocol` (`ClientSideConnection`) | dev-server (Bun) | JSON-RPC framing + `session/update` streaming + cancel; bridges `/_ws/acp` ↔ adapter stdio |
| Chat UI | `@assistant-ui/react` **headless primitives** (`ThreadPrimitive` / `MessagePrimitive` / `ComposerPrimitive`) | client bundle | streaming render, tool-call cards, auto-scroll, edit/branch, a11y — **styled entirely in Maude CSS** (`className` + `data-role`); the styled `@assistant-ui/ui` (shadcn/Tailwind) package is NOT used |
| Runtime glue | `useLocalRuntime(adapter)` with a custom `ChatModelAdapter.run` async generator streaming from `/_ws/acp` | client bundle | no Vercel AI SDK, no API key |

**Compliance guardrails (load-bearing — these keep it on subscription AND inside ToS):**

1. **Scrub `ANTHROPIC_API_KEY` (and `ANTHROPIC_AUTH_TOKEN`) from the spawned adapter/`claude` child env.** Per precedence, a stray global key silently switches the user to metered API billing. Delete it from the inherited env; do not pass it.
2. **Never hold or offer login.** Rely entirely on the user's existing `claude login`. If not logged in / not installed → surface "open a terminal and run `claude` / `/login`"; do NOT implement a sign-in flow (that is the restricted path).
3. **Not `--bare`.** Bare mode does not read subscription credentials; use normal `-p` headless.
4. **Native-app only.** Spawning a local process reliably requires the Tauri shell (mirrors `sidecar.rs`/DDR-106). A hub-served browser cannot spawn the user's `claude`; a local-dev-server browser user already has a terminal. Browser stays power-user / terminal-driven (owner scope note, phase-31).

**Routing:** the ACP WebSocket mounts at `/_ws/acp` on the **main (privileged) origin only**, loopback-guarded via the existing `isLoopbackHost` (ws.ts). It is NEVER added to `startCanvasServer`'s allowlist or `CANVAS_SAFE_API` — the untrusted canvas origin (DDR-054) must not reach the agent bridge.

## Consequences

- ✅ Subscription-correct: the guarantee lives at the bottom layer (`claude-code-acp` → `claude -p`), independent of the UI. Whatever sits above only spawns that adapter, so subscription holds as long as guardrail #1 is enforced.
- ✅ Maude-native look with full reuse: assistant-ui's headless primitives give the polished chat behavior; Maude CSS gives the look. We write wiring + the Maude-specific quick-action buttons (`/design:edit`, `/design:new`, `/design:critic`, `/design:screenshot`), not streaming/protocol plumbing.
- ⚠️ **+3 dependencies, scoped to the native chat feature** — client: `@assistant-ui/react`; dev-server: `@zed-industries/agent-client-protocol` + `@zed-industries/claude-code-acp`. This is real new surface for a "zero-dep" dev-server that guards supply-chain hard (DDR-054/056). Mitigations: the chat path is **loopback-only, native-only, privileged-origin** (a different trust zone than the hub / canvas origin); the two ACP libs are official Zed (14k+ wk downloads), not a fringe community package; the dropped Vercel-AI-SDK + `@mcpc-tech` layers kept the set minimal. The owner accepted this trade for "don't reinvent."
- ⚠️ **CLI-output coupling.** `claude-code-acp` absorbs the `claude -p --output-format stream-json` format churn for us; we do not parse stream-json directly. If the adapter lags a Claude Code release, the panel degrades to "update Claude Code," not a silent break.
- ➡️ The phase-7 plan's Tasks 1–7 stand as the *feature* blueprint (UI states, transcript, quick actions, `/design:chat`), but its **transport/auth specifics are superseded by this DDR**. The phase-7 method names (`prompt_response`, `tool_use`) are replaced by the real ACP `session/*` methods, handled by the library.

## Follow-up (tracked, not decided here)

- **First-run / not-logged-in UX (phase-31 Task 2, `claude_code.rs`).** Detect installed `claude` (`which claude` / `pgrep`) + logged-in state; the disabled `ChatPanel` explainer is the fallback for "not installed / not logged in / launch failed." Exact detection + the "open a terminal to /login" affordance designed in Task 2.
- **Declare `claude` as a soft/optional dependency** in `plugins/design/dependencies.json` (type `cli`, hardness `soft`, used-by the chat panel) so `maude doctor` reports it without hard-failing non-chat use.
- **Transcript at `.design/_chat/<slug>.jsonl`** stays gitignored — add to `cli/lib/gitignore-block.mjs`, the repo `.gitignore`, and `isMaudeRuntimeState` (the DDR-115 three-list rule).

## The lesson (for future agents)

For "use my Claude subscription, not API billing" in a third-party app: **embedding the Agent SDK with an OAuth token is a ToS trap** (Anthropic steers the SDK to API keys and forbids third-party products offering claude.ai login). The compliant lane is the **inverse of holding the credential** — spawn the user's *own* installed, already-logged-in `claude` CLI (directly, or via an ACP adapter that does), scrub `ANTHROPIC_API_KEY` so precedence falls through to the subscription, and never present your own sign-in. The credential stays owned by the user's Claude Code install; your app is just the ACP client. This is the Zed-sanctioned pattern, and it is materially different from the SDK-embed path that the first research pass wrongly conflated it with.
