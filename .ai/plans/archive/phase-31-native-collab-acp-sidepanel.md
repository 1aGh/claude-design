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

## Scope notes (2026-06-21, owner)

- **Native-app only.** The ACP panel ships only in the native Maude shell — NOT the browser surface. Rationale: ACP is local-per-peer (the agent must run on the peer's own machine — the same constraint that iceboxed phase-7), so only the Tauri shell can reliably detect + background-launch the user's already-installed Claude Code. A hub-served browser tab can't (the dev-server isn't on the user's machine); a local-dev-server browser user already has a terminal, so the value is marginal. Browser stays power-user / terminal-driven.
- **No new login.** The bridge connects over loopback to an already-running, already-authenticated Claude Code — there is no Claude-Code login flow inside Maude. Task 2's job is purely detect → background-launch the installed binary → connect. The disabled explainer (`ChatPanel` disabled state) becomes the fallback for "not installed / launch failed," not a parallel browser path. This simplifies Task 2's state machine — drop the browser branch, keep launch + can't-launch fallback.
- **Quick-action buttons = native Maude slash commands.** Persistent (always-on) buttons for the high-frequency verbs: `/design:edit` and `/design:new` (most repeated), plus `/design:critic` and `/design:screenshot`. `/design:setup-ds` is a one-time bootstrap → surface it contextually in the empty / no-DS state, not as an always-on button. Every button prefills the input with the command + auto-attached active-canvas/selection context (phase-7 Task 4 behavior), never fires blind.

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

- [x] ChatPanel mockup approved (critic PASS, handed off — registry sidecar)
- [x] ACP bridge loopback-only, protocol subset implemented — `ClientSideConnection` over a `Bun.spawn`'d `claude-agent-acp` adapter (the DDR-123 reuse-the-lib model supersedes phase-7's hand-rolled premise)
- [x] Streaming + cancel + quick actions work — assistant-ui headless thread; live-verified streaming vs real claude; cancel via `ThreadPrimitive.If running` → `cancel` frame; 4 persistent quick-actions prefill the composer
- [x] Transcript stored at `.design/_chat/<slug>.jsonl` (append-only; live-verified)
- [x] Native shell: Claude Code detection — `GET /_api/acp/status` (claude-on-PATH + adapter); **launch rescoped away** (the bridge spawns the adapter headlessly — no separate launch; DDR-123)
- [x] Non-technical peer sees disabled explainer, not an error — `ChatPanel` not-connected state with the subscription trust box + reason/install hint
- [x] `/design:chat` slash command opens the panel — `maude design chat-open` → `/_api/acp/focus` → broadcast → native-only panel open (live-verified)
- [x] Security: loopback-only asserted in test; transcripts gitignored — `acp-origin-gate.test.ts` + `_chat/` in the DDR-115 three-list. _Heavier security fan-out (defender + ethical-hacker on the new spawn-subprocess + WS + auto-approve surface) → `/flow:done`._

---

## Retro (2026-06-23)

**Shipped:** the native ACP chat sidepanel — Claude in-app on the user's own subscription, multiple parallel background chats with a status switcher + delete, per-project history, model/effort, live activity, finish notification, `/design:chat`. Closed via `/flow:done`.

**What worked**
- **Primary-source research de-risked the whole phase.** The connection model (drive the user's own `claude` CLI, scrub the API key) vs the ToS-trap SDK-embed path was the load-bearing decision — DDR-123 locked it before any code. A first research pass over-claimed a "categorical ban"; the auth-precedence + Zed docs corrected it.
- **The dev-server already supported parallelism.** One bridge per WS meant true parallel chats needed only a *client* rearchitecture (per-chat connections), not a server change — caught by re-reading the manager before designing.
- **Reuse over reinvent held.** assistant-ui headless + a tiny WS `ChatModelAdapter` gave streaming/tool-cards/a11y for a +300 KB bundle, styled entirely in Maude CSS. The hand-rolled markdown renderer (XSS-safe, no new dep) was the one exception, and the right call.

**What didn't / cost time**
- **The dep names were stale within a day.** DDR-123 named two Zed packages that were deprecated→renamed to `@agentclientprotocol/*` between the DDR (06-21) and the build (06-22). Lesson: verify deps at install time, never trust a day-old DDR's package names.
- **The native-app verification ceiling made the loop very long.** Every visual/interactive detail (composer layout, send-button visibility, "still working" placement, parallel-switch, delete, status dots) only surfaced in the user's live dogfood — agent-browser can't flip `isNativeApp()` (eval is isolated-world, `--init-script` broken in 0.27.1). ~10 dogfood round-trips. A mockup-first pass helped but couldn't pre-empt the live-UX feel.
- **"Multiple chats" should have been scoped as *parallel* from the start.** It arrived as "per-canvas history" → "repo-level multi-chat" → "must run in parallel in the background", forcing a mid-flight rearchitecture (single-runtime-remount → per-chat connections, all mounted). Scoping the end-state up front would have saved one rebuild.
- **Stash near-miss.** Diagnosing the (pre-existing, date-sensitive) sync-agent failure via `git stash` while the user was committing in parallel temporarily reverted in-progress work; recovered via `stash pop`. Lesson: don't stash a shared/actively-edited tree mid-flight; reason about isolation instead.

**Security**
- The fan-out earned its keep: the "single load-bearing guardrail" (`scrubAgentEnv`) was a 2-key **denylist** — a latent HIGH (a sibling `ANTHROPIC_BASE_URL` / future billing var bypasses it). Fixed to a namespace scrub. **Guardrails should be allowlists/namespace-scrubs, not key lists.**
- The **auto-approve** is the one accepted bounded risk (DDR-125): fine for loopback/native/own-project v1 (= `bypassPermissions`), but the manual approve/deny UI is a *required security follow-up*, not polish — don't widen the panel's reach without it.

**For next /plan or /execute**
- When a phase drives a native-only surface, budget for a long user-dogfood loop and a mockup that nails layout *structure* (the Zed-style composer box was the fix once referenced) — don't expect agent-browser to verify the native render.
- Track the open follow-ups as their own slice: **cross-restart `session/load` resume**, the **approve/deny permission UI** (security control for F2), **spawn cap** (F3), **WS/transcript caps** (F4), and the **date-sensitive sync-agent test** (use fake timers).
