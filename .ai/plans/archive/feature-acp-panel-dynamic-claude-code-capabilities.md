# Feature: ACP panel — dynamic Claude Code capabilities (models · modes · permission gate · transcript polish)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. Every model/mode/effort list this feature renders MUST be pulled live from the ACP session — **never a hardcoded array**. That is the load-bearing requirement.

## Description

Enrich the native ACP chat sidepanel (`apps/studio/client/panels/ChatPanel.jsx`, DDR-123/125) with the robust Claude Code controls the user sees in Claude Desktop's code mode: a **model picker**, an **effort control**, a **permission-mode picker** (Manual / Accept Edits / Plan / Auto / Bypass), **collapsed tool-call groups**, **per-message actions**, a **connection-problem error card with retry**, **transcript view modes** (Normal / Thinking / Verbose / Summary), and a per-chat **overflow menu** (rename / archive / transcript-view / delete).

The spine of the feature is a new **session-capabilities channel**: the bridge already harvests the agent's slash-command catalogue from the ACP session and drops everything else. The ACP session ALSO exposes — dynamically, sourced from the user's own `claude` CLI — the available models, permission modes, effort levels, and a live chat title. This feature surfaces that whole capability set and drives it live (`session/set_config_option` + `session/set_mode`), deleting the hardcoded model/effort arrays on both client and server, and deleting the env-at-spawn model/effort respawn dance.

Bundled with it: the **manual approve/deny permission UI** that DDR-125 tracks as the required mitigation for the accepted-risk F2 auto-approve — because a "Manual" mode that silently auto-approves would be security theatre.

## User Story

As a Maude Desktop user editing with my own Claude subscription, I want to pick the model, effort, and permission mode from the same live lists my `claude` CLI actually offers — and approve/deny tool actions when I'm in a manual mode — so the panel is as capable and trustworthy as Claude Code itself, and never drifts out of date because a list was hardcoded.

## Problem

- **Model list is hardcoded twice.** `ChatPanel.jsx:113-118` (`MODELS = ['', 'opus', 'sonnet', 'haiku']`) and `acp/index.ts:24` (`VALID_MODELS = new Set(['opus','sonnet','haiku'])`). New Claude models (Opus 4.8, Fable 5, …) never appear; removed ones linger. Directly violates the user's stated requirement.
- **Effort is hardcoded** (`ChatPanel.jsx:119-123`; `acp/bridge.ts:66 EFFORT_THINKING_TOKENS`) and applied as `MAX_THINKING_TOKENS` env-at-spawn, so a change **tears down and respawns** the `claude` subprocess (`acp/bridge.ts:483-485`).
- **No permission-mode control at all.** The session's `availableModes` (`default`/`acceptEdits`/`plan`/`dontAsk`/`auto`/`bypassPermissions`) is discarded — `establishSession()` (`acp/bridge.ts:295`) reads only `.sessionId` off the `newSession()` result and throws away `.modes` + `.configOptions`.
- **The bridge auto-approves every tool permission** (`acp/bridge.ts:451`, DDR-125 F2 — accepted risk). The tracked, required mitigation is a manual approve/deny UI. The `permission` frame is already emitted (`acp/index.ts:171`) but the client **drops it** (`acp-runtime.js` run loop skips every non-`update` frame; `ChatPanel.jsx` renders nothing).
- **Transcript rendering is thin.** Every tool call is its own card (`ChatToolCard`, `ChatPanel.jsx:290`); there's no grouping ("Ran 3 commands, browsed the web"), no message actions, no transcript view modes, and a bridge `error` surfaces as a bare assistant-ui error, not a styled retry card.

## Solution

Three milestones, sequenced. **A** is the dynamic backbone and is a prerequisite for everything. **B** is the security control that makes the mode picker honest. **C** is presentation polish that has no protocol dependency.

- **A — Dynamic capability channel.** Bridge harvests `modes` + `configOptions` (+ `session_info` title) from `newSession`/`loadSession` and from the `current_mode_update` / `config_option_update` / `session_info_update` notifications; relays them as new WS frames. Client renders model/effort/mode pickers from those live lists and drives changes via new `set-config` / `set-mode` frames → `conn.setSessionConfigOption` / `conn.setSessionMode`. Delete the hardcoded arrays + the env-at-spawn respawn.
- **B — Permission approve/deny UI (retires DDR-125 F2).** `requestPermission` becomes async: the bridge forwards the request and awaits the user's decision (with mode-driven defaults + a timeout fallback). Client renders an inline Allow-once / Allow-always / Reject card. The permission **policy is now the selected mode**, sourced from Claude Code — pick Bypass/Don't-Ask to get today's behavior.
- **C — Transcript polish.** Collapsed tool-call groups, per-message Copy/Retry actions, a connection-problem error card with "Try again", transcript view modes, and a per-chat overflow menu.
- **D — Usage.** A live context-window meter + session cost (from the `usage_update` notification) and an event-driven rate-limit banner. The full multi-window "Plan usage limits" panel from screenshot #9 is **out of v1 scope** — the ACP adapter doesn't expose it (only a thin single-window signal reaches the wire; see Milestone D).

## Metadata

- **Type**: Enhancement (+ one security control)
- **Complexity**: High
- **App/Package**: `apps/studio` (bridge + client), `apps/desktop` (E2E scenario + staged resources are build-copied)
- **Affected Systems**: ACP bridge (`apps/studio/acp/*`), chat client runtime (`apps/studio/client/panels/*`), chat CSS (`client/styles/6-acp-chat.css`), committed client bundle (`apps/studio/dist/`), desktop E2E
- **Dependencies**: no new npm deps. `@agentclientprotocol/sdk@0.28.1` (already pinned) exposes everything needed — see Research. An **optional** later bump to `1.2.0` only buys the native boolean Fast-mode toggle.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/client/panels/ChatPanel.jsx` (whole; esp. 113-123 hardcoded lists, 773-987 `Composer` + toolbar selects, 290-312 `ChatToolCard`, 467-489 message components, 993-1022 `NotConnected`, 1060-1169 `ChatThread`, 1183-1195 model/effort persistence, 1408-1489 chat switcher/overflow) — the panel to enrich.
- `apps/studio/client/panels/acp-runtime.js` (whole; esp. 19 `reduceActivity`, 72 `applyUpdate`, 123 `createAcpConnection`, 187 `onFrame` + 197 commands special-case, 260 `onCommands`, 271 `warm`, 291 `prompt`, 515 `makeAcpAdapter`) — the client↔bridge frame protocol + assistant-ui adapter.
- `apps/studio/acp/bridge.ts` (whole; esp. 66 `EFFORT_THINKING_TOKENS`, 244 `setConfig`, 249 `configChanged`, 295 `establishSession` — where `.modes`/`.configOptions` are discarded, 362-474 `start()` incl. env-at-spawn 393-398 + `requestPermission` 451, 477-519 `prompt` respawn-on-change 483) — the per-connection ACP client.
- `apps/studio/acp/index.ts` (whole; esp. 21-24 `VALID_EFFORT`/`VALID_MODELS`, 124-180 `getOrCreateBridge` sinks incl. `onPermission` 171, 200-245 handlePrompt/handleWarm, 256-289 frame router) — the WS manager / frame translator.
- `apps/studio/acp/probe.ts` (esp. 208 `getClaudeAuthStatus` — the established `Bun.spawn(claude … --json)` shell pattern) — for reference only; models come from the session, not a shell.
- `apps/studio/client/styles/6-acp-chat.css` (whole) — the `chat-*` class system to extend (Maude CSS, not the lib theme).
- `.ai/decisions/DDR-125-acp-multichat-parallel-and-security-posture.md` — F2 auto-approve accepted risk + the approve/deny-UI mitigation contract. **Load-bearing for Milestone B.**
- `.ai/decisions/DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md` — the three guardrails (scrub `ANTHROPIC_API_KEY`, pin `CLAUDE_CODE_EXECUTABLE`, native-only). Nothing here may weaken them.

### Files to Create

- `apps/studio/client/panels/acp-capabilities.js` — pure helpers: parse a `configOptions[]` into `{ model, effort, fast, other[] }` by `category`; parse `modes` into `{ current, available[] }`; a persisted-value re-apply resolver (last pick → matching option in a fresh session, else default). Pure → unit-testable.
- `apps/studio/client/panels/CapabilityBar.jsx` (or inline in ChatPanel) — the model / effort / mode picker row (replaces the two hardcoded `<select>`s).
- `apps/studio/client/panels/PermissionPrompt.jsx` — the inline Allow-once / Allow-always / Reject card (Milestone B).
- `apps/studio/client/panels/ToolGroup.jsx` — collapsed consecutive-tool-call summary row ("Ran N commands, browsed the web").
- `apps/studio/client/panels/acp-usage.js` — pure `parseUsage(frame)` → context gauge + cost + single-window rate-limit (Milestone D).
- `apps/studio/test/acp-usage.test.ts` — `parseUsage` pure fn (Milestone D).
- `apps/studio/test/acp-capabilities.test.ts` — caps parsing + persisted re-apply resolver (pure).
- `apps/studio/test/acp-caps-bridge.test.ts` — bridge harvests `.modes`/`.configOptions`, forwards `config_option_update`/`current_mode_update`/`session_info_update`, validates `set-mode`/`set-config` against **advertised** options (not a hardcoded allowlist).
- `apps/studio/test/acp-permission.test.ts` — requestPermission round-trip: forwarded → awaits client response → applies chosen optionId; timeout/cancel fallback; mode-driven default.
- `apps/desktop/e2e/scenarios/acp-capability-picker.e2e.ts` — DOM-driven: open panel → mode picker lists modes → switching Plan mode reflects in a subsequent turn (native-only).

### Design canvases

> Design Canvas Detection matched the panel's own mock.

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/ChatPanel.tsx` (+ `.css`, `.meta.json`, `.registry.json`) | (read `status` in sidecar) | chat / acp / assistant | The panel's design source — the `chat-*` classes in `6-acp-chat.css` were ported from here. Ground new controls (capability bar, permission card, tool group, overflow menu) in this canvas's visual language; update the canvas in a `/design:edit` pass if the new controls need a mock. **Read-only from this flow command.** |

### Documentation

- ACP protocol — Session Modes: https://agentclientprotocol.com/protocol/session-modes — Why: the `SessionMode`/`SetSessionMode`/`current_mode_update` contract Milestone A consumes.
- ACP protocol — Session Config Options (models/effort as generic select options): https://agentclientprotocol.com/protocol — Why: models are NOT a typed protocol concept; they ride the generic `configOptions` channel keyed `category:"model"`.
- Installed sources of truth (read locally, do not trust memory of the API):
  - `apps/studio/node_modules/@agentclientprotocol/sdk/dist/acp.d.ts:1060` (`setSessionMode`) + `:1067` (`setSessionConfigOption`) — the client-connection methods (present in 0.28.1).
  - `apps/studio/node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts` — `SessionModeState` (2528), `SessionConfigOption` (2584), `SessionConfigOptionCategory` (2631), `NewSessionResponse.modes` (2509) + `.configOptions` (2513), the 13 `SessionUpdate` variants (3379-3405).
  - `apps/studio/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js` — `buildAvailableModes` (3158), `buildConfigOptions` (3305: model 3320 / effort 3352 / fast 3269), `getAvailableModels` (3575, sourced from `initializationResult().models`).

### Patterns to Follow

- **New WS frames mirror the existing catalogue path.** The command catalogue already flows session → bridge callback → `onCommands` → `{ t:'commands' }` frame → `createAcpConnection.onCommands` listener → `useSlashCommands` hook. Add `caps` / `caps-update` / `session-info` / `permission-request` frames + `onCaps` / `onSessionInfo` / `onPermission` listeners the SAME way (`acp/index.ts:172-175`, `acp-runtime.js:196-201,259-264`).
- **Client→server control frames mirror `warm`/`cancel`.** `set-mode` / `set-config` / `permission-response` are new `onMessage` branches in `acp/index.ts:280-288`, and new senders on the connection like `warm()` (`acp-runtime.js:271`).
- **Server-side validation replaces the allowlist, doesn't drop it.** `VALID_MODELS`/`VALID_EFFORT` (`acp/index.ts:21-24`) become validation against the **last-advertised** `modes`/`configOptions` for that bridge (a loopback frame still must not pin an arbitrary value — DDR-125 F1). The allowlist is now dynamic, cached per bridge from what the agent advertised.
- **Tests are `bun:test`** under `apps/studio/test/`, named `acp-*.test.ts` (see `acp-commands.test.ts`, `acp-bridge.test.ts` for the mock-adapter harness: `test/fixtures/mock-acp-agent*.mjs`).
- **`data-testid` convention** — `<area>-<thing>[-<id>]`, kebab-case (existing: `chat-composer`, `chat-cmd-menu`, `acp-not-connected`). Add `chat-mode-picker`, `chat-model-picker`, `chat-permission-prompt`, `chat-tool-group`, `chat-overflow-menu`.

---

## Research — the hard boundary (protocol-given vs. self-sourced)

Confirmed by reading the installed `@agentclientprotocol/sdk@0.28.1` + `@agentclientprotocol/claude-agent-acp@0.57.0` on disk:

**Everything the user asked for IS dynamic from Claude Code. Nothing needs a hardcoded list.**

| Capability | ACP source | How to read | How to set | Live update |
| --- | --- | --- | --- | --- |
| **Permission modes** (Manual/Accept Edits/Plan/Don't Ask/Auto/Bypass) | `SessionModeState` on `NewSessionResponse.modes` (`availableModes[]` + `currentModeId`) | off the `newSession`/`loadSession` result | `conn.setSessionMode({sessionId, modeId})` | `current_mode_update` (carries only `currentModeId`) |
| **Models** | generic `SessionConfigOption` with `category:"model"`, id `"model"`; the list is `initializationResult().models` from the user's CLI/subscription | `NewSessionResponse.configOptions[]`, find `category==='model'` | `conn.setSessionConfigOption({sessionId, configId:'model', value})` | `config_option_update` (full refreshed list) |
| **Effort** | `SessionConfigOption` `category:"thought_level"`, id `"effort"` (only when the current model `supportsEffort`) | same `configOptions[]` | `setSessionConfigOption(configId:'effort', value)` | `config_option_update` |
| **Fast mode** | `SessionConfigOption` `category:"model_config"`, id `"fast"` (model-dependent) | same | `setSessionConfigOption(configId:'fast', value)` | `config_option_update` |
| **Chat title** | `SessionInfoUpdate` (`title`, `updatedAt`) | `session_info_update` notification | — (agent-generated) | `session_info_update` |
| **Slash commands** | `available_commands_update` | already consumed | — | already consumed |
| **Context window + cost** | `usage_update` `{ used, size, cost }` (from SDK `getContextUsage()`) | `usage_update` notification | — | on/after each turn (not at rest) |
| **Rate limit (single window)** | thin `SDKRateLimitInfo` on `usage_update._meta["_claude/rateLimit"]` — ONE window/event, event-driven | `usage_update` notification | — | only on a rate-limit event during a turn |
| **Full plan-limits (5h+weekly+Fable)** | `SDKControlGetUsageResponse.rate_limits` — **NOT plumbed through adapter 0.57.0** | ✗ not over ACP (unstable `usage_EXPERIMENTAL_…()` only) | — | — |

Hard boundaries to design around:
1. **No typed model API.** Models are opaque `{value, name, description}` select options tagged `category:"model"` (a UX hint that MAY be absent). Key off the category; treat ids as opaque strings. There is no `SessionModelState`/`availableModels`/`select_model` in either SDK version.
2. **Client SDK is 0.28.1; adapter speaks 1.2.0 internally.** Modes + configOptions (select) are wire-identical and arrive fine on 0.28.1. The ONLY 0.28.1 gap: the client cannot advertise the `session.configOptions.boolean` capability, so the Fast-mode **boolean** toggle degrades to a two-value **select** (still fully functional). Upgrading `@agentclientprotocol/sdk` → 1.2.0 for the native boolean is an **optional, separately-reviewed** follow-up (DDR-125 B4 pins the adapter/SDK; bumps gate on manual review).
3. **`setSessionConfigOption`/`setSessionMode` exist on the 0.28.1 `ClientSideConnection`** (`acp.d.ts:1060`, `:1067`) — verified. Live switching needs NO respawn; the env-at-spawn model/effort path (`bridge.ts:393-398,483`) is replaced, not extended.
4. **Adapter mode roster is model-capability-filtered.** `buildAvailableModes` (acp-agent.js:3158) includes `auto` only when the model `supportsAutoMode`, and `bypassPermissions` only when `ALLOW_BYPASS`. So `availableModes` legitimately varies by model — the client MUST render whatever the session advertises, never assume a fixed 5.
5. **Mode semantics are agent-side** (this is why Milestone B matters):
   - `plan` → adapter does not execute tools (safe regardless of our permission response).
   - `acceptEdits` → adapter auto-accepts edit-kind tools but STILL calls `requestPermission` for non-edit tools (bash/network).
   - `default` (Manual) → adapter calls `requestPermission` for everything.
   - `bypassPermissions` / `dontAsk` → no prompt / deny-unless-preapproved.
   So with today's blanket auto-approve, only `plan` and `bypassPermissions` are honest; `default` and `acceptEdits` (for non-edit tools) would silently bypass. The mode picker is only truthful once the approve/deny UI (Milestone B) exists.

---

## Design Decisions

### Components

| Component | Source | Notes |
| --- | --- | --- |
| Model / effort / mode pickers | new `CapabilityBar.jsx`, styled with existing `chat-select` + a new `chat-menu`-style popover | replaces the two hardcoded `<select>`s at `ChatPanel.jsx:920-949`. Menu visual language = the existing `chat-menu`/`chat-menu-row` switcher (1443-1474). |
| Permission prompt card | new `PermissionPrompt.jsx` | inline in the feed; reuses `chat-tool`/`chat-bubble` card styling + `btn`/`btn--danger` primitives already in the panel. |
| Tool group | new `ToolGroup.jsx` wrapping `ChatToolCard` | `<details>`-style collapse like the existing `ChatReasoning` (`chat-think`, 274-288). |
| Overflow menu | extend the chat switcher menu (`ChatPanel.jsx:1440-1476`) | add rows: Rename / Archive / Transcript view ▸ / Delete (delete already exists). |

### Tokens / styling

All new surfaces use the existing `chat-*` CSS token system in `6-acp-chat.css` (which already consumes the DS `--bg-*`/`--fg-*`/`--accent*` tokens). **No hardcoded colors.** New classes: `chat-caps`, `chat-caps-btn`, `chat-mode-menu`, `chat-perm`, `chat-perm-actions`, `chat-toolgroup`, `chat-toolgroup-sum`, `chat-msg-actions`, `chat-error-card`, `chat-transcript-menu`, `chat-overflow`.

### Custom components needed

All of the above are custom (the panel deliberately hand-rolls Maude-styled components over assistant-ui's headless primitives — `reuse existing libs but Maude-styled`). Per-message actions use assistant-ui's `MessagePrimitive.Action` where it fits; otherwise a hover toolbar.

---

## Tasks

Execute in dependency order. **Milestone A first (backbone), then B (security), then C (polish).** Each task ends with a check.

### Milestone A — Dynamic capability channel

#### Task A1: ADD capability harvest to the bridge
- **Do**: In `acp/bridge.ts` `establishSession()` (295), capture the full `newSession()`/`loadSession()` result. Store `lastModes` + `lastConfigOptions` on the bridge. Add an `onCaps?(modes, configOptions)` option (wired in `index.ts`) and fire it after establish (respecting `replaying` — do NOT fire during a resume replay).
- **Do**: In the `client.sessionUpdate` callback (434), add branches for `current_mode_update`, `config_option_update`, `session_info_update` → update `lastModes`/`lastConfigOptions` and fire `onCaps` / a new `onSessionInfo`. Keep them OUT of `onUpdate`/the transcript (chrome, like `available_commands_update`).
- **Pattern**: mirror the `available_commands_update` special-case at 438.
- **Gotcha**: `current_mode_update` carries only `currentModeId` — merge it into the cached `availableModes`, don't replace the list.
- **Validate**: `cd apps/studio && bun test acp-caps-bridge`

#### Task A2: ADD `setMode` / `setConfigOption` to the bridge
- **Do**: Add `async setMode(chatId, modeId)` + `async setConfigOption(chatId, configId, value)` on `AcpBridge` → resolve the session via `sessionFor(chatId)` then `conn.setSessionMode(...)` / `conn.setSessionConfigOption(...)`. `setSessionConfigOption` echoes the full option set → feed it back through `onCaps`.
- **Gotcha**: These require a live session. If none exists yet, `warmUp` first (or no-op and let the value apply on the next `newSession`). Persist the chosen value so a fresh/respawned session re-applies it (Task A3).
- **Validate**: `cd apps/studio && bun test acp-caps-bridge`

#### Task A3: REMOVE env-at-spawn model/effort + the respawn dance
- **Do**: Delete `EFFORT_THINKING_TOKENS` env mapping (`bridge.ts:66,393-398`), `configChanged()` (249) and the respawn on config change in `prompt`/`warmUp` (483,530). Replace with: after a session is established, if the user has a persisted model/effort/mode pick, apply it via `setConfigOption`/`setMode` once (best-effort; skip if the option isn't advertised for the current model).
- **Do**: Keep passing the persisted model as `ANTHROPIC_MODEL` at spawn ONLY as the initial default (the adapter reads it for `currentModelId`), OR drop it entirely and rely on live-set — **decide during execution**; dropping is cleaner but re-applies one config call per new session. Whichever: the DDR-125 F1 requirement (loopback frame can't pin an arbitrary value) still holds — validate against advertised options.
- **Gotcha**: `scrubAgentEnv` must stay intact (DDR-123 guardrail #1). If keeping `ANTHROPIC_MODEL` as initial default, it is still re-added post-scrub from a validated value.
- **Validate**: `cd apps/studio && bun test acp-bridge acp-env`

#### Task A4: UPDATE the WS manager (`acp/index.ts`)
- **Do**: Wire `onCaps`/`onSessionInfo` sinks in `getOrCreateBridge` (172) → `send(ws, { t:'caps', modes, configOptions })` / `{ t:'session-info', title }`. Add `set-mode` / `set-config` branches to the frame router (280): validate `modeId`/`configId`/`value` against the bridge's `lastModes`/`lastConfigOptions` (replaces `VALID_MODELS`/`VALID_EFFORT`), then call the bridge. Emit an initial `caps` on establish.
- **Gotcha**: All `/_ws/acp` + `/_api/acp/*` routes stay main-origin + loopback only (never on `CANVAS_SAFE_API` / `startCanvasServer` — DDR-054/125). New frames add no new route.
- **Validate**: `cd apps/studio && bun test acp-caps-bridge acp-origin-gate`

#### Task A5: ADD connection listeners + capability parsing (client)
- **Do**: In `acp-runtime.js`, add `onCaps`/`onSessionInfo` listeners + `setMode(modeId)` / `setConfig(configId, value)` senders (mirror `onCommands`/`warm`, 259-285). Handle `caps`/`session-info` frames in `onFrame` (187) like `commands` (197).
- **Do**: Create `acp-capabilities.js` — `parseConfigOptions(configOptions)` → `{ model, effort, fast, others }` (by `category`); `parseModes(modes)` → `{ current, available }`; `resolvePersistedPick(available, savedValue, defaultValue)`.
- **Gotcha**: the config channel is generic — the adapter also emits an **Agent persona** option (`id:"agent"`, when custom agents exist) and may add more. `others` must render **every** advertised select option generically (id → labeled dropdown), not just the three known ids. Never assume a fixed set of config options; `category` is a UX hint that may be absent.
- **Validate**: `cd apps/studio && bun test acp-capabilities`

#### Task A6: REPLACE the hardcoded pickers with the dynamic CapabilityBar (client)
- **Do**: Delete `MODELS`/`EFFORTS` (`ChatPanel.jsx:113-123`). Render model + effort + (fast) pickers from parsed `configOptions`, and a **mode picker** from parsed `modes` — styled like the screenshot (menu with name + description). On pick → `conn.setConfig` / `conn.setMode`. Reflect `caps`/`current_mode_update` live (e.g. Plan → default after ExitPlanMode).
- **Do**: Migrate persistence: keep the last chosen value in localStorage per option id; re-apply on a new chat/session via `resolvePersistedPick` (fall back to the option's `currentValue` when the saved one isn't offered).
- **Do**: Use `session_info_update.title` for the chat switcher title when present (replaces the "New chat" heuristic at 1436).
- **Gotcha**: `availableModes` varies by model — the mode picker must re-render on every `caps` frame, never assume a fixed set. Show `description` as a subtitle (matches the screenshot).
- **Validate**: `cd apps/studio && bun test`; then live-verify (see Validation).

### Milestone B — Permission approve/deny UI (retires DDR-125 F2)

#### Task B1: MAKE requestPermission async + mode-aware (bridge)
- **Do**: In `bridge.ts` `requestPermission` (451), stop returning `allow_always` unconditionally. Return a Promise resolved by a client decision: emit `{ t:'permission-request', id, toolCall, options }` (id = a fresh nonce) and register a pending resolver keyed by id. Add a bridge method `resolvePermission(id, optionId | 'cancelled')`.
- **Do**: Apply a **policy default** so nothing hangs: honor a bounded timeout (reuse the `withTimeout` pattern at 88) and a turn-cancel → resolve `cancelled`. When the selected mode implies "no prompt" the adapter won't even call this (bypass/dontAsk) — but keep a safety default of `cancelled` (deny) on timeout, not allow.
- **Gotcha**: This is THE security control. Do not add a blanket "auto-approve" localStorage escape hatch — the **mode** is the policy now (pick Bypass for hands-off). Keep the `onPermission` transparency callback too.
- **Note**: `ExitPlanMode` rides this SAME `requestPermission` path (adapter surfaces plan-exit as a permission request; approving emits `current_mode_update` + `config_option_update` and flips the mode; rejecting keeps plan mode). So the permission card automatically becomes the "approve exiting plan mode?" prompt — handle that toolCall kind with an apt label. `bypassPermissions` short-circuits adapter-side and never calls `requestPermission` at all (genuinely no prompt); `default` calls it for every SDK-surfaced tool.
- **Validate**: `cd apps/studio && bun test acp-permission`

#### Task B2: WIRE permission frames through the manager (index.ts) + connection (runtime)
- **Do**: Relay `permission-request` frames to the client; add a `permission-response` inbound branch → `bridge.resolvePermission(id, ...)`. On the connection, surface pending permission requests via an `onPermission` listener and a `respondPermission(id, decision)` sender. The run loop / a panel-level subscription (not the assistant-ui message stream) carries these.
- **Validate**: `cd apps/studio && bun test acp-permission`

#### Task B3: RENDER the inline permission card (client)
- **Do**: `PermissionPrompt.jsx` — shows the tool name + target (reuse `ChatToolCard`'s path extraction) + the offered options mapped to buttons (Allow once / Allow always / Reject). Enter=approve-once, Esc=reject, focus-trapped like `ChatLightbox`. On click → `conn.respondPermission`. Only rendered while a request is pending for the active chat.
- **Do**: Surface the current mode in the composer footer so the user knows whether prompts will appear ("Manual — you'll be asked" vs "Bypass — no prompts").
- **Validate**: live-verify in the native app (see Validation §5).

#### Task B4: RECORD the DDR + update posture
- **Do**: New DDR (`record-ddr`; next free ~DDR-177 — re-check the decisions dir at commit time, numbering races on shared main): "ACP permission gate — mode-driven policy + manual approve/deny UI retires DDR-125 F2." Update DDR-125's F2 note to point at it. Note the residual: the UI is native-only + loopback; do not widen reach without it (unchanged).
- **Validate**: `scripts/check-version-parity.sh` (docs-only, but keep the DDR index consistent).

### Milestone C — Transcript polish (client-only unless noted)

#### Task C1: ADD collapsed tool-call groups
- **Do**: `ToolGroup.jsx` — fold a run of consecutive `tool-call` parts into one summary row ("Ran N commands, browsed the web", derived from tool kinds/names like `activityLabel` at `acp-runtime.js:56`), expandable to the individual `ChatToolCard`s. Apply in `AssistantMessage` + `ContinuationBubble`.
- **Validate**: `cd apps/studio && bun test`; live-verify.

#### Task C2: ADD per-message actions (Copy, Retry)
- **Do**: Hover toolbar on assistant/user bubbles: Copy message (plain text of the parts), Retry (re-send the last user turn). Reuse assistant-ui `MessagePrimitive.Action` where clean.
- **Validate**: live-verify.

#### Task C3: ADD the connection-problem error card
- **Do**: Render the bridge `error` frame as a styled `chat-error-card` (icon + "Connection problem" + reason) with "View details" (expands the raw message) + "Try again" (re-sends the last turn). Today the adapter throws and assistant-ui shows a bare error.
- **Gotcha**: distinguish a transient bridge/socket error (retry) from a hard not-connected state (the existing `NotConnected` readiness flow, 993-1022) — don't duplicate.
- **Validate**: live-verify (kill the bridge mid-turn).

#### Task C4: ADD transcript view modes
- **Do**: A `chat-transcript-menu` (Normal / Thinking / Verbose / Summary) that filters rendered parts: Normal = text + collapsed tools, hide reasoning; Thinking = show reasoning; Verbose = expand all tool detail; Summary = final text only. Pure filter over the parts array; persist the choice.
- **Validate**: `cd apps/studio && bun test` (pure filter fn); live-verify.

#### Task C5: ADD the per-chat overflow menu
- **Do**: Extend the switcher menu (1440-1476) with a ⋯ overflow: Rename, Archive (a flag that hides from recents), Transcript view ▸ (C4), Copy transcript, Delete (exists). Keep `_chat/*` in the DDR-115 runtime-state taxonomy (already gitignored).
- **Rename**: prefer driving the agent's OWN title — the adapter honors a `customTitle` (its `/rename`) that wins over the auto-summary and re-emits `session_info_update`. If a direct set isn't reachable via ACP, fall back to a Maude-side title override on a `_chat/<id>.meta.json` sidecar. (The `session_info_update` title fires at **turn-end**, so a fresh chat shows the client heuristic until the first turn completes — expected.)
- **Gotcha**: Rename/Archive touch `_chat/` — stay within the `[a-z0-9_-]/64` chatId containment (index.ts:184) and main-origin+loopback gating.
- **Validate**: `cd apps/studio && bun test`; live-verify.

### Milestone D — Usage view (context window + cost, live; rate-limit banner, partial)

> Screenshot #9 shows Claude Desktop's usage popover: a **Context window** gauge + a **Plan usage limits** list (5-hour / weekly-all / weekly-Fable, each % + reset). **Reality check (confirmed on disk): the ACP adapter exposes the gauge + cost fully, but NOT the full multi-window plan-limits panel.** Ship what's genuinely dynamic; scope the rich panel honestly as a gated follow-up — do NOT render fabricated bars.

**Research (confirmed against the installed SDKs — this is the hard boundary):**
- **Context window + cost — FULLY DYNAMIC today.** ACP `usage_update` (`UsageUpdate`, sdk types.gen.d.ts:3894) = `{ used, size, cost? }`; `used` from the SDK's authoritative `getContextUsage().totalTokens` (system prompt + tool schemas + MCP + memory, not just messages; `acp-agent.js:4235`), `size` from the model window (handles 1M). `Cost` (:3871) = `{ amount, currency }`. Emitted after each result (`acp-agent.js:965,1317`). **Caveat: it only ticks during/after a prompt turn** — present as "context: X / Y · updated HH:MM", not live-at-rest.
- **Rate limits — only a THIN, single-window signal reaches ACP.** The adapter forwards the SDK `rate_limit_event` as a `usage_update` with `_meta["_claude/rateLimit"] = SDKRateLimitInfo` (`acp-agent.js:1768-1776`). `SDKRateLimitInfo` (claude-agent-sdk@0.3.202 `sdk.d.ts:3984`) carries **ONE window per event**: `status`, a single `rateLimitType` (`five_hour|seven_day|seven_day_opus|seven_day_sonnet|seven_day_overage_included|overage`), one `resetsAt`, one `utilization`, plus an overage sidecar. **It cannot express the 3-window panel, and per-model buckets (Fable) aren't representable.** It's event-driven + turn-bound (only fires when `lastAssistantTotalUsage != null`, reset each turn at `acp-agent.js:687`) — never at rest.
- **The RICH panel data EXISTS but is NOT plumbed through the adapter.** `SDKControlGetUsageResponse.rate_limits` (`sdk.d.ts:3059`) has exactly the Desktop panel — `five_hour`, `seven_day`, `seven_day_opus/sonnet`, `model_scoped[]` (incl. `display_name:"Fable"`), `extra_usage`, each `{ utilization 0-100, resets_at ISO }`, queryable **at rest**. But it's reachable only via the control method `query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()` — which **claude-agent-acp 0.57.0 never calls and never forwards** (no ACP method, no `_meta` channel carries it). The method name is a literal "do not rely on this yet"; `rate_limits_available` is `false` for API-key/Bedrock/Vertex sessions.
- **`/usage` over ACP is TEXT, not structured** — its stdout is stripped of markers and forwarded as a plain `agent_message_chunk` (`acp-agent.js:1622`). Not a parseable source.

**Scope decision (see Open decisions #4):** v1 ships the **context-window gauge + session cost** (fully dynamic) and an **event-driven single-window rate-limit banner** (from the thin `SDKRateLimitInfo`). The **full multi-window plan-limits panel is a separate gated follow-up** requiring either an adapter patch or an out-of-band source — NOT promised here.

#### Task D1: HARVEST `usage_update` in the bridge
- **Do**: In `bridge.ts` `client.sessionUpdate` (434), special-case `usage_update` like `available_commands_update` (438): extract `{ used, size, cost }` + `_meta?.['_claude/rateLimit']`, fire a new `onUsage?(usage)` sink; keep it OUT of `onUpdate`/the rendered turn (chrome). Cache last-seen usage on the bridge, replay to a freshly-opened socket (mirror `latestCommands`, `index.ts:132,253`).
- **Do**: `index.ts` — wire `onUsage` → `send(ws, { t:'usage', usage })`; cache `latestUsage` + replay on `onOpen`.
- **Gotcha**: `usage_update` already arrives as a plain `{t:'update'}` frame and is dropped by `applyUpdate`'s default (`acp-runtime.js:117`) — promote it to the dedicated frame; ensure no double-handling.
- **Validate**: `cd apps/studio && bun test acp-usage-bridge`

#### Task D2: ADD the client usage channel + parser
- **Do**: `acp-runtime.js` — add `onUsage` listener + handle the `usage` frame in `onFrame` (187), like `commands`/`caps`.
- **Do**: New `acp-usage.js` (pure) — `parseUsage(frame)` → `{ context: { used, size, pct }, cost, rateLimit: { type, label, pct, resetsAt, status } | null, asOf }`. `rateLimit` is the single active window from `SDKRateLimitInfo` (null when absent). Map `rateLimitType` → a friendly label ("5-hour limit", "Weekly limit", "Weekly · Opus", …). Tolerate a malformed/missing `_meta`.
- **Validate**: `cd apps/studio && bun test acp-usage`

#### Task D3: ADD the usage UI (gauge + cost + single-window banner)
- **Do**: A **context-window meter** — slim, ambient, in the composer footer (join/replace the "your Claude subscription" line, `ChatPanel.jsx:967-971`): "context X% · updated HH:MM", expandable to `used / size` + session cost. Live-updates on `usage` frames.
- **Do**: An **event-driven rate-limit banner** — when `rateLimit` arrives with `status:'allowed_warning'|'rejected'` (or high `utilization`), show a compact notice ("You're at N% of your 5-hour limit · resets HH:MM"). Dismissible; not a persistent panel (the data isn't fresh at rest).
- **Do**: CSS — `chat-usage`, `chat-usage-meter`, `chat-usage-bar`, `chat-usage-banner` in `6-acp-chat.css` (DS tokens, no hardcoded colors).
- **Gotcha**: context window is per-chat/session; cost is per-session. Label accordingly.
- **Validate**: live-verify in the native app.

#### Task D4: TEST the usage parser
- **Do**: `apps/studio/test/acp-usage.test.ts` — `parseUsage`: context pct math, `rateLimit` mapped from an `SDKRateLimitInfo` fixture (each `rateLimitType`), null/missing rate-limit → gauge-only, malformed `_meta` tolerated.
- **Validate**: `cd apps/studio && bun test acp-usage`

> **Follow-up (out of v1 scope) — the full multi-window "Plan usage limits" panel.** Requires surfacing `SDKControlGetUsageResponse.rate_limits` (the 5h + weekly + `model_scoped[]`/Fable + extra_usage data, fresh at rest). Two paths, both gated: **(a)** patch/fork `claude-agent-acp` to call `query.usage_EXPERIMENTAL_…()` and forward it over a `_meta` channel — but DDR-125 B4 pins the adapter exact-version + the SDK API is explicitly unstable; **(b)** source out-of-band (spawn the user's `claude`), if/when a stable `claude usage --json` exists — today the data lives only behind the unstable Agent-SDK control method, and hitting the claude.ai endpoint directly is the OAuth-token ToS trap (memory `reference_claude_subscription_via_users_cli_not_sdk`). Record as its own DDR + plan when picked up; `rate_limits_available:false` for API-key/Bedrock/Vertex must degrade gracefully.

### Cross-cutting close-out

#### Task X1: REBUILD the committed client bundle (release-minified)
- **Do**: Per CLAUDE.md: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`. Never boot the source dev-server from this tree without rebuilding `--release` afterward (its self-heal writes unminified dev bundles that would ship).
- **Validate**: bundle size sane; `git diff --stat apps/studio/dist`.

#### Task X2: ADD the desktop E2E scenario
- **Do**: `apps/desktop/e2e/scenarios/acp-capability-picker.e2e.ts` (DOM-driven, `data-testid`, per the `desktop-e2e` skill). Add the new testids in the same change. Build the debug app if stale.
- **Validate**: `pnpm test:e2e:desktop:build` then `pnpm test:e2e:desktop` (or `/desktop-e2e acp-capability-picker`).

#### Task X3: WHAT'S-NEW entry + docs
- **Do**: On close-out, append a pending What's New entry via the `whats-new-entry` skill (model/mode pickers + permission gate are user-visible). Refresh any ACP-panel docs.

---

## Validation

1. **Unit tests**: `cd apps/studio && bun test` — new suites (`acp-capabilities`, `acp-caps-bridge`, `acp-permission`) green + no regression in existing `acp-*`/`chat-*`.
2. **Lint/format**: `biome check apps/studio` (repo uses biome; no root `tsc` gate per CLAUDE.md/DDR-026).
3. **Bundle**: rebuilt `dist/client.bundle.js` + `dist/styles.css` committed (Task X1).
4. **Origin gate**: `bun test acp-origin-gate` still passes — no ACP route reachable from the canvas origin.
5. **Native live-verify** (the ceiling per memory `feedback_native_app_verification_ceiling` — dogfood the bundled `.app`, not just `tauri dev`):
   - Model picker lists the models the user's `claude` actually offers (verify against `claude`'s own `/model` list); switching mid-chat takes effect WITHOUT a subprocess respawn (no reconnect flicker).
   - Mode picker lists the advertised modes; Plan mode → a turn plans without executing; Manual mode → a tool triggers the approve/deny card; approving proceeds, rejecting aborts.
   - Kill the bridge mid-turn → the connection-problem card appears with a working "Try again".
   - Transcript view modes filter as specified; collapsed tool groups expand; Copy/Retry work.
6. **Desktop E2E**: `pnpm test:e2e:desktop` green for the new scenario (Task X2).
7. **Security re-review** (Milestone B changes the permission posture): spawn `security-auditor` + `ethical-hacker` over the diff — confirm the approve/deny path can't be bypassed by a canvas-origin frame, the timeout defaults to DENY, and no new env/credential surface opened. This is a `/flow:validate-security` pass; F2 should be markable retired.

---

## Acceptance Criteria

- [ ] **No hardcoded model/effort/mode arrays remain** — `MODELS`/`EFFORTS` (ChatPanel), `VALID_MODELS`/`VALID_EFFORT` (index.ts), `EFFORT_THINKING_TOKENS` env mapping (bridge) are gone or converted to dynamic-from-session validation. A grep for these names returns only the new capability plumbing.
- [ ] Model / effort / mode pickers render live from the ACP session and update on `config_option_update` / `current_mode_update`; changes apply without respawning `claude`.
- [ ] Permission approve/deny card works; the selected mode is the permission policy; timeout defaults to deny. DDR-125 F2 is retired by a recorded DDR.
- [ ] Collapsed tool groups, per-message Copy/Retry, connection-problem retry card, transcript view modes, and the per-chat overflow menu all function (native live-verified).
- [ ] `bun test` green (new + existing); `biome check` clean; `acp-origin-gate` green; committed `dist/*` rebuilt `--release`.
- [ ] Desktop E2E scenario green.
- [ ] Usage: context-window meter + session cost render live from `usage_update`; the single-window rate-limit banner appears on a warning/rejected event. The full multi-window panel is explicitly deferred (not faked).
- [ ] `security-auditor` + `ethical-hacker`: 0 blockers on the permission-gate diff.
- [ ] DDR-123 guardrails intact (`scrubAgentEnv`, `CLAUDE_CODE_EXECUTABLE` pin, native-only). No ACP route on the canvas origin.
- [ ] What's New entry added; DDR-125 note updated.

---

## Open decisions (surface to the user before execution)

1. **Scope / sequencing.** This is three milestones. Recommended: **A + B together** (an honest mode picker requires the permission UI — a "Manual" mode that silently auto-approves is misleading), then **C** as a fast-follow. Alternative de-scope: ship **A** with the mode picker limited to `plan` + `bypassPermissions` (the two honest-without-a-prompt modes), defer Manual/Accept-edits + the approve/deny UI (B) to a second cycle. Not recommended — it half-delivers the headline control.
2. **SDK bump 0.28.1 → 1.2.0?** Only needed for the native boolean Fast-mode toggle; everything else works on 0.28.1. Default: **stay on 0.28.1** (Fast mode degrades to a 2-value select), treat the bump as a separate reviewed follow-up per DDR-125 B4.
3. **Keep `ANTHROPIC_MODEL` at spawn as the initial default, or fully live-set?** (Task A3) — minor; decide in execution. Fully-live is cleaner; env-default avoids one config call per new session.
4. **Full "Plan usage limits" panel (screenshot #9) — in or out?** Out for v1 (Milestone D ships gauge + cost + single-window banner, which is all the adapter exposes). The rich 5h/weekly/Fable panel needs either an adapter patch to surface the unstable `usage_EXPERIMENTAL_…()` control method or an out-of-band source — both gated (DDR-125 B4 pin; unstable SDK API; OAuth-token ToS trap). Recommend treating it as its own DDR + follow-up plan, not bundling it here. Confirm you're OK deferring the multi-window panel.

---

## Retro

- **What worked**: the milestone sequencing (A+B together, then C, then D) held up exactly as recommended — an honest mode picker genuinely did need the permission gate alongside it, and building them together avoided a half-honest intermediate state. Protocol-boundary research paid off repeatedly (the elicitation follow-up feature and this session's retroactive permission-gate fixes both hinged on reading the installed `@agentclientprotocol/*` packages directly rather than trusting docs/memory).
- **What didn't**: the plan's own Validation §7 gate ("`security-auditor` + `ethical-hacker`: 0 blockers on the permission-gate diff") was never actually run before Milestone B's commit landed on `main` — it took a live-dogfooding cycle plus a THIS-session `/flow:done` pass to notice the gap and run it retroactively. When it finally ran, it found a genuinely severe finding (the permission card's Enter key/primary button defaulted to `allow_always`, not `allow_once` — see DDR-179's addendum) that had been shipped and live for a full round of user dogfooding without being caught, because dogfooding exercised the FEATURE (does a card appear, can you click a button) not the SPECIFIC DEFAULT a reflexive Enter/click resolves to.
- **Process gap to fix next time**: `/flow:execute`'s per-task Edit-Verify Loop and the polish-pass `code-simplifier` step are not a substitute for the plan's own named Validation gates — a plan that says "security review required before X" needs that review run as part of closing the MILESTONE it gates, not deferred to whenever `/flow:done` eventually gets invoked (which in this case was several dogfooding rounds and a second, unrelated feature later). Consider making `/flow:execute` itself refuse to mark a milestone checkbox complete when the plan's own Validation section names a gate that hasn't run yet, rather than relying on `/flow:done` to catch it at the very end.
- **Concurrent-session surprise**: this close-out ran WHILE a second Claude Code session was independently implementing the sibling `feature-acp-ask-user-question` plan on the same working tree — both sessions edited `ChatPanel.jsx`/`6-acp-chat.css` concurrently, and the other session ended up committing a combined snapshot (their elicitation code + this session's UI polish, since they were interleaved in the same uncommitted files) before this session could commit it explicitly. No data was lost, but it was a close call that needed careful `git log`/`git show --stat` forensics to confirm — worth normalizing "check `git log` for a landed commit before assuming your own uncommitted diff is still the only copy" as a habit whenever a `/done` pass spans a long wall-clock session on a shared `main`.
- **User-directed deviation from the plan's own acceptance criterion**: "Usage: context-window meter + session cost render live" shipped, then the user explicitly asked to remove the dollar-cost display in favor of the rate-limit/plan-usage percentage (more meaningful for a Pro/Max subscriber than an equivalent-API-cost dollar figure). Recorded here rather than silently marking that criterion "done as originally written" — the context-window meter and rate-limit banner both ship; session cost specifically does not, by explicit request.
