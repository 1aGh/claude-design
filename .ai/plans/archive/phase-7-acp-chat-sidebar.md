# Phase 7: ACP local chat sidebar — DELIVERED (de-iceboxed → shipped as phase-31)

> **CLOSED 2026-06-23 — delivered via phase-31.** This iceboxed plan was de-iceboxed and shipped as the native ACP chat sidepanel in **phase-31** (`.ai/plans/archive/phase-31-native-collab-acp-sidepanel.md`). The connection model evolved past this plan's premise (drive the user's OWN installed `claude` CLI on their Pro/Max subscription, never API billing — **DDR-123**; repo-level parallel multi-chat — **DDR-125**; the "every create/remove emits canvas-list-update" invariant — **DDR-124**). Native-app only, as anticipated here. Archived; preserved below for provenance.

> **TODO when de-iceboxed (added 2026-05-13):** the bare `/design "<feedback>"` quick-action reference around line ~32 needs to become `/design:edit "<feedback>"`. The command `/design` was renamed to `/design:edit` in `.ai/plans/design-system-init.md` Phase 0; compat stub may or may not still exist depending on minor-version ladder at revive-time.

> **Moved to icebox 2026-05-12.** v1.0 ships without browser-based agent chat; the terminal Claude Code session remains the primary agent interaction. Rationale:
>
> - ACP is inherently **local-per-peer** — the agent (Claude Code) must run on the same machine as the peer. The hub (Phase 9) cannot proxy ACP messages cross-peer, so in hub federation each peer needs their own Claude Code session running locally to use this sidebar.
> - Target persona (designer using hub mode) gets marginal value from per-peer ACP given they typically pair with a developer who already drives the agent.
> - Phase 7 is "High" complexity (~2 weeks). Deferring shortens v1.0 ship time and refocuses scope on canvas + collab core.
>
> **Trigger to revisit:** if ≥3 v1.0 user reports indicate "I want browser-based agent chat without opening a terminal", schedule for v1.1+. The plan below is preserved verbatim so future implementation has a starting point. Solo-only scope expected at that time.

## Description

Embed a chat sidebar directly in the canvas chrome that speaks the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/get-started/introduction). The sidebar can connect to a locally-running Claude Code session (or any ACP-compatible agent) so the user can ask design questions, request edits to the active canvas, or run any flow / design command without leaving the browser tab. Builds on Phase 4 canvas v2.

## User Story

As a designer reviewing a canvas, I want to type "make the CTA button more prominent" into a sidebar chat and have the running Claude Code session pick it up, run `/design "<feedback>"` scoped to the selected element, and stream the result back — so that I don't have to switch to a terminal mid-review.

## Problem

- The current loop requires switching: browser canvas → terminal Claude Code → type slash command → wait → switch back.
- For non-technical reviewers (PO, designer), the terminal context is alien. Forcing a terminal context excludes them from driving.

## Solution

Add a collapsible right-side panel ("Chat") to canvas chrome. The panel implements an ACP **client** (the agent runs in the user's existing Claude Code session, which becomes the ACP **agent**). Transport: WebSocket over the same dev-server loopback. The panel:

1. Shows running session metadata (Claude version, current cwd, recent commands).
2. Lets the user type a message → sent to agent as ACP `prompt` event.
3. Streams agent output back, rendering tool calls / text deltas / file refs.
4. Tags every message with the active canvas context (`activeCanvas`, `selectedElement`) so the agent has spatial context without the user spelling it out.
5. Surfaces "quick actions" — `/design "<feedback>"`, `/design:critic`, `/design:screenshot` — as buttons that prefill the input.

## Metadata

- **Type:** New Feature
- **Complexity:** High (new protocol surface)
- **Depends on:** Phase 4
- **Parallel with:** Phase 5, Phase 6
- **Affected files:**
  - `plugins/design/dev-server/client/panels/ChatPanel.tsx` (new)
  - `plugins/design/dev-server/client/acp/` (new — ACP client implementation)
  - `plugins/design/dev-server/server.mjs` (new endpoint: `WS /api/acp` proxying to local agent)
  - `plugins/design/dev-server/acp-bridge.mjs` (new — host-side ACP relay; spawns / connects to Claude Code in agent mode)
  - `plugins/design/commands/chat.md` (new — `/design:chat` opens the panel)
  - `plugins/flow/skills/agent-browser/SKILL.md` (note that ACP sidebar is now another in-browser interaction path)
  - `cli/commands/design.mjs` (extend `serve` with `--acp-relay <command>` flag)

---

## Tasks

### Task 1: ACP protocol primer + DDR

- **Do:** Read the ACP spec end-to-end. DDR: what subset do we implement in v1.0? Decision lean: `initialize`, `prompt`, `prompt_response` (streamed), `tool_use`, `tool_result`, `cancel`. Skip `memory`, `compaction`, `attachments` for v1.0.
- **Validate:** DDR captures rationale; subset is explicitly enumerated.

### Task 2: ACP relay

- **Do:** New process `acp-bridge.mjs` spawned by the dev server (or attached to a pre-existing Claude Code agent via stdio). It bridges the browser WS to the agent's ACP transport. Auth: assert localhost-only; reject non-loopback connections.
- **Pattern:** Same loopback model the dev server already enforces.
- **Validate:** Browser opens WS → bridge echoes a test message → agent responds.

### Task 3: Chat panel UI

- **Do:** Right sidebar, toggle via `C` (clash with comments — use `Cmd+J` instead; document). Message list (rendered MDX, tool calls shown as collapsible cards, file references clickable to open in editor via OS-default), input box, send button. Active canvas + selection auto-appended as "Context" in each prompt.
- **Pattern:** Cursor's chat panel is the reference. Minimal first.
- **Validate:** Type a message; see the round-trip; confirm context attached.

### Task 4: Quick action buttons

- **Do:** Above input, three buttons: "Edit selection", "Critique", "Screenshot". Each prefills the input with the appropriate `/design:*` command + selection metadata.
- **Validate:** Click "Edit selection" with an element selected → input shows `/design "feedback for <element>"`.

### Task 5: Streaming + cancel

- **Do:** Render tokens as they stream; show a typing indicator. Big red "Stop" button cancels the running prompt via ACP `cancel`.
- **Validate:** Long-running prompt cancels within 2s of click.

### Task 6: Persistence + transcript

- **Do:** Store chat per canvas at `.design/_chat/<canvas-slug>.jsonl` (append-only). Reload restores history. Cleared with `maude design chat clear --canvas <slug>`.
- **Pattern:** JSONL for git-friendly diffs.
- **Validate:** Restart server, reload page, history preserved.

### Task 7: Surface as slash command

- **Do:** `/design:chat` in Claude Code opens the panel and focuses input (via WS message from agent to client).
- **Validate:** Invocation from terminal opens the panel in browser.

---

## Validation

1. **Static:** ACP client passes a contract test against a reference ACP agent (use ACP project's own conformance tests if available).
2. **Functional:** End-to-end: type prompt in browser → see streamed response from a running Claude Code session in same repo.
3. **A11y:** Chat panel keyboard-navigable (Tab into input, Cmd+Enter to send).
4. **Security:** Confirm the bridge refuses non-loopback connections.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `chat-edit-selection` | Select button → open chat → click "Edit selection" → send → see streamed result → confirm source HTML updated | 🆕 new |
| `chat-critique` | Open chat → click "Critique" → see critic agent output in panel → click file ref to open in editor | 🆕 new |

---

## Acceptance criteria

- [ ] ACP subset selected via DDR.
- [ ] Bridge runs alongside dev server; loopback-only.
- [ ] Chat panel toggles with `Cmd+J`; messages stream; cancel works.
- [ ] Quick actions prefill correctly.
- [ ] Transcripts persist per canvas.
- [ ] `/design:chat` slash command opens panel.
- [ ] Both scenarios pass.
- [ ] Docs site has an "ACP chat" page (Phase 2 update if both land together).
