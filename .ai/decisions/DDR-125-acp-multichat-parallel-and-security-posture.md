# DDR-125 — ACP chat: repo-level parallel multi-chat + the security posture (auto-approve accepted risk, provider-env hardening)

**Status:** accepted · **Date:** 2026-06-23 · **Phase:** 31 (Native Maude: ACP sidepanel)
**Relates:** DDR-123 (connection model + the three guardrails), DDR-054 (untrusted-canvas / loopback trust model), DDR-115 (runtime-state taxonomy — `_chat/`)

## Context

The phase-31 panel shipped on DDR-123's foundation, then evolved through a long dogfood loop. Two decisions emerged that DDR-123 didn't cover, and a `/flow:done` security fan-out (defender + adversarial) surfaced findings that need a recorded posture.

## Decision 1 — Multi-chat is repo-level + genuinely parallel, one connection per chat

- **Chats are repo-level, not per-canvas.** Transcripts moved from `_chat/<canvas-slug>.jsonl` to `_chat/<chatId>.jsonl` (client-generated id). The active canvas still reaches `claude` via `_active.json` on disk, so a chat isn't bound to one canvas. A switcher lists recents (from disk) + open chats; New / delete / switch.
- **Each open chat owns its own connection** — own `/_ws/acp` WebSocket → own per-WS bridge → own `claude` subprocess. Every open chat stays **mounted** (the ChatPanel toggles `hidden`, never unmounts), so switching never interrupts a running turn and you can run several chats in parallel in the background. (Rejected: one shared connection multiplexing turns — the single turn-handler serialized chats and remounting on switch killed the running one.) The dev-server already creates one bridge per WS, so the server needed no change; parallelism was a pure client rearchitecture. Verified: two concurrent connections finish in ≈max(t₁,t₂), not t₁+t₂.
- **Cost:** N open chats = N `claude` processes. Accepted for "work on N things at once"; a per-chat delete (×) frees its process. A hard spawn cap is a tracked follow-up (see F3 below).
- **Cross-restart claude memory is NOT yet wired.** Reopening a saved chat shows its on-disk history but starts a fresh `claude` session (no `session/load` resume). The adapter supports `loadSession`; persisting + resuming the session id is the tracked follow-up.

## Decision 2 — Security posture (the `/flow:done` fan-out)

Reports: `.ai/logs/security-reviews/phase-31-acp-chat.md` (defender — PASS WITH SUGGESTIONS, 0 blockers at the medium floor) and `…-attacker.md` (adversarial — 2 HIGH + 3 MEDIUM). Confirmed-solid by both passes: origin/loopback gating (`/_ws/acp` + all `/_api/acp/*` main-origin + loopback only, off `CANVAS_SAFE_API` + `startCanvasServer` routes — canvas origin can't reach the bridge or delete a transcript), path-traversal containment (`[a-z0-9_-]`/64 on chatId, write + DELETE), markdown XSS safety (React nodes, http(s)-only links), `_chat/` in the DDR-115 three-list.

**Fixed in this closeout:**
- **F1 (HIGH) — provider-env denylist gap + unvalidated model.** `scrubAgentEnv` was a 2-key denylist; a stray `ANTHROPIC_BASE_URL` / a future billing var could redirect the spawned `claude` off the subscription or exfiltrate prompts. Now it scrubs the **whole `^(ANTHROPIC_|CLAUDE_CODE_USE_|AWS_BEARER_TOKEN_BEDROCK)` namespace** (the bridge re-adds `ANTHROPIC_MODEL` after the scrub, from a validated value). The `model` WS field is allowlisted server-side (`opus|sonnet|haiku`), like `effort`.
- **Supply chain (B4).** `@agentclientprotocol/claude-agent-acp` + `@assistant-ui/react` pinned to **exact** versions (were caret on a freshly-transferred npm org) — mirrors the `@agentclientprotocol/sdk@0.28.1` pin. Adapter upgrades gate on a manual review.
- **CSRF parity.** `/_api/acp/focus` (POST) gained the `sameOriginWrite` guard its sibling POST routes carry.

**Accepted, bounded risk — F2 (HIGH): the bridge auto-approves tool permissions.** `requestPermission` returns `allow_always`, so a turn edits/runs without a per-call human gate — more permissive than terminal Claude Code's default prompt, and the third leg of a trifecta (private disk + DDR-054-class untrusted repo content + the agent's shell/network). **Accepted for v1** because the scope is the user's OWN `claude`, on their OWN machine, over loopback, native-app only, in their OWN project — the same capability as Claude Code's shipped `bypassPermissions` mode. **Required mitigation (tracked, NOT polish):** a manual approve/deny UI (the bridge already forwards each `requestPermission` to the client via `onPermission`) — this is the security control that retires F2, scheduled as the next ACP follow-up. Until then the panel must not be presented as safe against a hostile repo.

**Tracked residuals (MEDIUM, below the blocker bar):**
- **F3** — unbounded `claude` spawn fan-out (one process tree per open chat / WS). Add a concurrent-chat cap + spawn rate-limit.
- **F4** — no `maxPayloadLength` on the acp WS; transcript grows unbounded and is read synchronously. Cap bytes / coalesce.

## Consequences

- Parallel background chats are the headline UX; the cost (N processes) and the no-cross-restart-resume gap are explicit follow-ups.
- The subscription guarantee is now structural (whole-namespace scrub), not a two-key guess — the F1/Chain-2 class is closed.
- **The auto-approve is the one load-bearing accepted risk.** It is fine for the loopback/native/own-project v1 and gated by the documented approve/deny-UI follow-up; do not widen the panel's reach (e.g. a hub-served or multi-user surface) without shipping that control first.
