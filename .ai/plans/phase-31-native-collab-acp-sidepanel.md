# Phase 31 — Native Maude: ACP sidepanel (de-icebox phase-7)

Validate docs and codebase patterns before implementing. Read the existing phase-7 plan (`.ai/plans/phase-7-acp-chat-sidebar.md`) in full — this phase executes it largely as-written with the native-shell context added.

## Description

Surface the ACP (Agent Client Protocol) chat sidepanel in the native Maude app, letting the technical peer drive `/design:edit`, `/design:critic`, and `/design:screenshot` from inside the same window the team is looking at. Non-technical peers see the panel as disabled with a plain explainer: "AI editing requires a paired Claude Code — ask your developer to connect."

**Phase milestone:** A developer can open the ACP sidepanel, type `/design:edit "make the button red"`, and see the canvas update — without switching to a terminal window.

## User Story

As a developer paired with a non-technical collaborator, I want a chat panel inside Maude where I can run AI design edits while my collaborator watches — so we stay in the same shared context instead of me working in a separate Claude Code window.

## Problem

The ACP sidepanel (phase-7) was designed and planned but iceboxed — it needed the native shell as its distribution layer. That shell now exists (phase-26).

## Solution

De-icebox phase-7 largely as-written:
- Right-side chat panel speaking ACP WebSocket to a local Claude Code instance.
- Loopback-only `acp-bridge` — rejects any non-loopback connection.
- Active canvas + selected element auto-attached as context.
- Streaming + cancel.
- Quick actions: `/design:edit`, `/design:critic`, `/design:screenshot`.
- Per-canvas transcript at `.design/_chat/<slug>.jsonl`.
- In the native shell: detect / offer to launch a local Claude Code if not running.
- Apply the `/design` → `/design:edit` rename TODO noted in phase-7.

## Metadata

- **Type:** New Capability (de-icebox)
- **Complexity:** High
- **App/Package:** `plugins/design/dev-server/` (acp-bridge, endpoints, client chat panel)
- **Depends on:** phase-26 (native shell — detection + launch of Claude Code)
- **Dependencies (new):** ACP protocol subset (WebSocket, JSON-RPC style — hand-rolled, no SDK needed per phase-7 Task 1)

---

## Context References

### Must-Read Files

> Read in parallel.

- `.ai/plans/phase-7-acp-chat-sidebar.md` — **the source plan.** Tasks 1–7 are the implementation blueprint. Read every task before writing code.
- `.ai/docs/epic-native-collab-app.md` § E6 — native-shell additions to phase-7 scope (agent-discovery/launch behavior).
- `plugins/design/dev-server/client/app.jsx` — where the chat panel mounts.
- `plugins/design/dev-server/_active.json` schema — active canvas + selected element; ACP context auto-attachment reads this.
- `plugins/design/dev-server/paths.ts` — DDR-045.

### Files to Create (from phase-7 plan)

- `plugins/design/dev-server/acp/bridge.mjs` — loopback-only WebSocket bridge to local Claude Code
- `plugins/design/dev-server/acp/protocol.ts` — ACP subset (per phase-7 Task 1)
- `plugins/design/dev-server/client/panels/ChatPanel.jsx` — right-side chat UI
- `plugins/design/dev-server/test/acp-bridge.test.ts` — loopback-only assertion + protocol tests
- `apps/desktop/src-tauri/src/claude_code.rs` — detect / launch local Claude Code

### Design canvases

> `/design:new` before Task 2. Phase-7 may have had a mockup — check `.design/` first.

| Canvas (to create if absent) | Screens needed |
| --- | --- |
| `ChatPanel.tsx` | Active state (streaming response, cancel button, quick actions), idle state (prompt input + recent commands), disabled state (non-technical peer: "AI editing requires a paired Claude Code"), agent-editing indicator (mirrors activity overlay) |

---

## Tasks

### Task 1: Execute phase-7 Tasks 1–7 as written

- **Do:** Read `.ai/plans/phase-7-acp-chat-sidebar.md` and execute its tasks. Apply the one noted change: wherever the plan references `/design`, use `/design:edit` instead. The phase-7 plan is the authoritative implementation spec for the ACP protocol subset, bridge architecture, streaming, cancel, quick actions, transcript storage.
- **Gotcha (from phase-7):** The `acp-bridge` must reject any non-loopback origin at the WebSocket upgrade. Add an assertion in `acp-bridge.test.ts`.
- **Validate:** Per phase-7 acceptance criteria.

### Task 2: Native shell — Claude Code detection + launch

- **Do:** `apps/desktop/src-tauri/src/claude_code.rs`:
  - `is_claude_code_running() -> bool` — checks for a `claude` process (macOS: `pgrep -x claude`).
  - `launch_claude_code(project_path: PathBuf)` — opens Claude Code at the project path via `open -a "Claude" <path>` (macOS) or equivalent.
  - Expose as Tauri commands: `cc_is_running`, `cc_launch`.
  - In `ChatPanel.jsx`: if the ACP bridge can't connect (`GET /_api/acp/status` returns `{connected: false}`):
    - If `cc_is_running()` → "Connecting to Claude Code…" (retry in 3 s).
    - If not running AND current user is technical (heuristic: has a git identity) → show "Launch Claude Code" button → calls `cc_launch`.
    - If not running AND user appears non-technical → show the disabled explainer.
- **Validate:** Launch Maude → Claude Code not running → ChatPanel shows "Launch Claude Code" → click → Claude Code opens at the project path → ChatPanel connects.

### Task 3: `/design:chat` slash command

- **Do:** Add `/design:chat` slash command (per phase-7) that opens the ACP panel from Claude Code. Implement as a simple `plugins/design/commands/chat.md` that calls `maude design chat-open` (new bin verb that sends a WebSocket message to the dev-server to focus the panel).
- **Validate:** `/design:chat` in Claude Code → chat panel focuses in Maude native window.

---

## Validation

1. **Tests:** `acp-bridge.test.ts` — loopback-only, protocol round-trip.
2. **Security:** loopback rejection; transcript at `.design/_chat/` gitignored (add to `gitignore-block.mjs`).
3. **Scenario:** Developer types `/design:edit "make header larger"` → canvas updates live → collaborator watching sees the change. Non-technical peer sees disabled panel with explainer.
4. **Zero regression:** phase-7 baseline (if any existing code) unaffected.

## Acceptance Criteria

- [ ] ChatPanel mockup approved
- [ ] ACP bridge loopback-only, protocol subset implemented (Tasks from phase-7)
- [ ] Streaming + cancel + quick actions work
- [ ] Transcript stored at `.design/_chat/<slug>.jsonl`
- [ ] Native shell: Claude Code detection + launch works (Task 2)
- [ ] Non-technical peer sees disabled explainer, not an error
- [ ] `/design:chat` slash command opens the panel (Task 3)
- [ ] Security: loopback-only asserted in test; transcripts gitignored
