# Feature: ACP panel — AskUserQuestion / elicitation form support

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This mirrors `feature-acp-panel-dynamic-claude-code-capabilities`' Milestone B (permission approve/deny gate) closely — same bridge shape (Promise + pending map + timeout), same WS frame-pair pattern, same "one card slot between feed and composer" client shape. Reuse that architecture; don't invent a new one.

## Description

Claude Code's built-in `AskUserQuestion` tool — the interactive multi-choice picker the CLI (and this very Claude Code session) uses to ask the user something mid-task — currently does nothing inside Maude's ACP chat panel. A user who types "ask me something, use the ask user tool" gets a plain-text question instead, and Claude's own reply says it doesn't have that tool available in this environment. That's not a bug in the panel's rendering — **the tool is being stripped from the model's tool list before it ever reaches Claude**, because the ACP client (Maude's bridge) never declares the `elicitation.form` capability the adapter gates it on.

This feature declares that capability and renders the resulting **ACP form elicitation** — a JSON-Schema-driven form the agent sends over `elicitation/create` — as an inline card in the chat panel: single-select questions as radio groups, multi-select as checkboxes, each with the CLI's own "type your own answer" free-text fallback, Submit/Skip/Cancel actions.

The same wire mechanism (`unstable_createElicitation`) also carries elicitation requests **from any MCP server** connected to the session, not just the built-in tool — declaring the capability turns both on together; there's no way to offer one without the other (see Research). The form renderer is written generically against the schema, so this isn't extra scope, just an explicit acknowledgment.

## User Story

As a Maude Desktop user chatting with my own Claude subscription, I want Claude to be able to ask me a real multi-choice question mid-task — the same `AskUserQuestion` picker I get in the Claude Code CLI — instead of silently losing that tool and falling back to asking in plain text I then have to answer freeform.

## Problem

- **`AskUserQuestion` is disallowed at the adapter level whenever the client doesn't advertise form-elicitation support.** `claude-agent-acp` (`dist/acp-agent.js:2787`): `const disallowedTools = elicitationSupport.form ? [] : ["AskUserQuestion"]`. Maude's bridge declares `clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } }` at `initialize()` (`acp/bridge.ts:728`) — no `elicitation` key at all, so `elicitationSupport.form` is falsy and the tool never reaches the model. This is why Claude "honestly" reports it has no such tool: it doesn't, in this session.
- **Even if declared, nothing handles the resulting request.** The `Client` object passed to `ClientSideConnection` (`acp/bridge.ts` client literal, ~line 610-709) implements `sessionUpdate` and `requestPermission` but no `unstable_createElicitation` — an agent that called it anyway would get the SDK's default (likely a JSON-RPC "method not implemented" error), aborting the tool call.
- **No client-side rendering exists for a schema-driven form.** Every UI primitive built so far (`PermissionPrompt.jsx`) renders a flat `options[]` list; a form elicitation carries a JSON-Schema `properties` map with per-field types (string+enum, array+multi-select, free text) that needs its own renderer.

## Solution

One milestone, closely mirroring Milestone B of `feature-acp-panel-dynamic-claude-code-capabilities` (the permission gate) — same shape, different payload:

- **Declare the capability.** Add `elicitation: { form: {} }` to `clientCapabilities` at `initialize()`. Deliberately declare `form` only, not `url` — directing the user to an agent-chosen URL is a bigger trust decision than rendering a form and is out of scope here (see Open decisions).
- **Bridge handles `unstable_createElicitation`.** New method on the `client` literal, mirroring `requestPermission`: emits a `{ t:'elicitation-request', id, ... }` frame, registers a pending resolver keyed by a fresh id, resolves on the client's answer or a timeout. **Fails closed** — timeout/cancel/turn-cancel resolve `{ action:'decline' }` (never fabricate `accept` content), matching the fail-closed posture DDR-179 established for permissions.
- **New WS frame pair** `elicitation-request` / `elicitation-response`, wired through `acp/index.ts` and `acp-runtime.js` exactly like `permission-request`/`permission-response`.
- **`ElicitationPrompt.jsx`** renders `requestedSchema.properties` generically (works for both `AskUserQuestion`'s `question_N`/`question_N_custom` fields and any other well-formed elicitation form an MCP server sends): per-property single-select (radio) or multi-select (checkboxes) from `enum`/`oneOf`/array-items, plus a free-text field where offered. Submit → `accept` with a `content` map; Skip → `decline`; Esc/close → `cancel`. Same card slot as `PermissionPrompt` (between feed and composer), same CSS language, new `.chat-elicit*` classes.

## Metadata

- **Type**: Enhancement
- **Complexity**: Medium
- **App/Package**: `apps/studio` (bridge + client)
- **Affected Systems**: ACP bridge (`apps/studio/acp/bridge.ts`, `acp/index.ts`), chat client runtime (`apps/studio/client/panels/acp-runtime.js`), new chat panel component + CSS, committed client bundle (`apps/studio/dist/`)
- **Dependencies**: no new npm deps. `@agentclientprotocol/sdk@0.28.1` (already pinned) exposes `unstable_createElicitation` + the full `CreateElicitationRequest`/`CreateElicitationResponse` schema types today — confirmed on disk, see Research. `@agentclientprotocol/claude-agent-acp@0.57.0` (already pinned) already implements the `AskUserQuestion` → form-elicitation bridge on the agent side; nothing to bump.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/acp/bridge.ts` (whole; esp. the `client` literal's `requestPermission` ~line 689-708 — the pattern to mirror — and the `clientCapabilities` object at `conn.initialize()` ~line 728) — where the new capability + handler both land.
- `apps/studio/acp/index.ts` (whole; esp. `onPermission`/`onPermissionRequest` sinks ~line 177-179 and the `permission-response` inbound branch ~line 378) — the WS manager / frame translator to extend the same way.
- `apps/studio/client/panels/acp-runtime.js` (whole; esp. `onFrame`'s `permission-request` branch ~line 262, `onPermission` ~line 363, `respondPermission` ~line 376) — the client↔bridge frame protocol to extend the same way.
- `apps/studio/client/panels/PermissionPrompt.jsx` (whole) — the closest existing UI precedent: card slot, Enter/Esc handling, focus trap. `ElicitationPrompt.jsx` reuses this shape, not this component (the payload — a JSON-Schema form vs. a flat `options[]` — is different enough to need its own renderer).
- `apps/studio/client/panels/ChatPanel.jsx` (whole; esp. wherever `PermissionPrompt` is rendered in the thread — same slot, mutually exclusive with `.chat-perm`/`.chat-error-card`) — where `ElicitationPrompt` mounts.
- `.ai/archive/decisions/DDR-179-acp-permission-gate-retires-ddr125-f2.md` — the fail-closed default + timeout precedent this feature must match (deny/decline on timeout, never fabricate an answer).
- `.ai/archive/decisions/DDR-125-acp-multichat-parallel-and-security-posture.md` — native-only + loopback-only posture; nothing here may widen reach.
- `.ai/archive/decisions/DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md` — the three guardrails (scrub `ANTHROPIC_API_KEY`, pin `CLAUDE_CODE_EXECUTABLE`, native-only). Nothing here may weaken them.

### Files to Create

- `apps/studio/client/panels/acp-elicitation.js` — pure helpers: `parseElicitationSchema(requestedSchema)` → an ordered list of renderable question descriptors (`{ id, title, description, kind: 'single'|'multi'|'text', options?[], customFieldId? }`) from the ACP `ElicitationSchema.properties` map; `buildElicitationContent(questions, answers)` → the `content` object shape the response expects (custom free-text answer wins over a selection, per the adapter's own `applyAskElicitationResponse` convention — see Research). Pure → unit-testable, no DOM.
- `apps/studio/client/panels/ElicitationPrompt.jsx` — the inline form card: renders `message` as a header, each parsed question as a radio group / checkbox group / text field, a per-question free-text fallback where the schema offers one, Submit / Skip / Cancel actions.
- `apps/studio/test/acp-elicitation.test.ts` — `parseElicitationSchema` + `buildElicitationContent` pure fns: single-select (`oneOf`), multi-select (array+items), the `_custom` free-text override, malformed/missing schema tolerance.
- `apps/studio/test/acp-elicitation-bridge.test.ts` — bridge round-trip: `unstable_createElicitation` forwarded → awaits client response → resolves `accept`/`decline`/`cancel`; timeout and turn-cancel fall back to `decline` (fail-closed); a live `AskUserQuestion` tool call end-to-end via the mock adapter.
- `apps/studio/test/fixtures/mock-acp-agent-elicit.mjs` — mock agent fixture that calls the real `AskUserQuestion` tool (mirrors `mock-acp-agent-permission.mjs`'s shape, calling `ctx.client.request(acp.methods.client.elicitation.create, {...})` — confirm the exact method constant name against the installed SDK, not assumed).
- `apps/desktop/e2e/scenarios/acp-ask-user-question.e2e.ts` — DOM-driven: open panel → trigger a question (a scripted prompt asking Claude to call `AskUserQuestion`) → the form card renders → picking an option + Submit resolves the turn (native-only).

### Documentation

- ACP protocol — Elicitation (unstable): https://agentclientprotocol.com/protocol — the `elicitation/create` method + `ElicitationCapabilities` — confirm the current spec text against the installed SDK below; the protocol page may describe a later/earlier shape than what 0.28.1 ships.
- Installed sources of truth (read locally, do not trust memory of the API — this whole feature rests on an **UNSTABLE** protocol surface, explicitly marked so throughout the SDK's own type comments):
  - `apps/studio/node_modules/@agentclientprotocol/sdk/dist/acp.d.ts:467` (`CLIENT_METHODS.elicitation_create` handler slot), `:763-777` (`unstable_createElicitation`/`unstable_completeElicitation` on the connection), `:1415-1429` (same, as the `Client` interface the bridge implements).
  - `apps/studio/node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts` — `CreateElicitationRequest` (`:799`, form-mode = `ElicitationFormMode` at `:1196` — `{ sessionId, toolCallId?, requestedSchema, message }`), `ElicitationSchema`/`ElicitationPropertySchema` (`:864-919`, the JSON-Schema subset: string+enum/oneOf, number, integer, boolean, array/multi-select), `CreateElicitationResponse` (`:5573` — `{action:'accept', content?} | {action:'decline'} | {action:'cancel'}`), `ClientCapabilities.elicitation` (`:4094`) + `ElicitationCapabilities`/`ElicitationFormCapabilities`/`ElicitationUrlCapabilities` (`:4212-4269` — each is just a presence-gated `{}`-shaped object, no sub-flags to configure).
  - `apps/studio/node_modules/@agentclientprotocol/claude-agent-acp/dist/elicitation.d.ts` (whole — short, read it fully) — the agent-side bridge this feature's client half completes: `extractAskUserQuestions`, `askUserQuestionsToCreateRequest` (documents the exact field-naming convention: `question_<n>` single/multi-select + a sibling `question_<n>_custom` free-text field, nothing required so Skip always works), `applyAskElicitationResponse` (documents the answer-folding rule: a non-empty custom field wins over a selection; `decline` → empty answers, not a turn abort; `cancel` → aborts the tool call).
  - `apps/studio/node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js:2185-2200` (`AskUserQuestion` routed through `canUseTool` when `elicitation.form` is set), `:2354-2380` (`handleAskUserQuestion`), `:2778-2787` (`disallowedTools` gate — the exact line that currently strips the tool).

### Patterns to Follow

- **This is Milestone B's shape, replayed.** Bridge: Promise + `pendingElicitations` Map + timeout, mirroring `pendingPermissions`/`resolvePermission`/`PERMISSION_TIMEOUT_MS`. WS: a request/response frame pair mirroring `permission-request`/`permission-response`, relayed the same way in `acp/index.ts`. Client: an `onElicitation` listener + `respondElicitation` sender mirroring `onPermission`/`respondPermission` in `acp-runtime.js`. Don't invent parallel plumbing — extend the existing pending-request machinery if it can be shared cleanly (both are "the bridge asks the client something and awaits an answer with a timeout"); if sharing turns out awkward, a parallel-but-identical-shaped implementation is an acceptable fallback — call out which was chosen in the execution notes.
- **Fail closed, same as DDR-179.** Timeout, turn-cancel, and an elicitation the client doesn't recognize the shape of must all resolve `decline` — never `accept` with fabricated/empty content standing in for a real answer, and never leave the Promise unresolved (that hangs the turn).
- **Tests are `bun:test`** under `apps/studio/test/`, named `acp-*.test.ts`, using the `test/fixtures/mock-acp-agent*.mjs` harness pattern (see `mock-acp-agent-permission.mjs` for the closest precedent — an agent script that drives a real ACP request through the mock adapter and asserts on the client's response).
- **`data-testid` convention** — `<area>-<thing>[-<id>]`, kebab-case (existing: `chat-permission-prompt`, `chat-mode-picker`). Add `chat-elicit-prompt`, `chat-elicit-option-<id>`, `chat-elicit-submit`, `chat-elicit-skip`.

---

## Research — the hard boundary (confirmed on disk vs. assumed)

**Confirmed by reading the installed packages (not the public docs, which may describe a different unstable-surface snapshot):**

- The full request/response contract, the client-capability gate, and the exact `AskUserQuestion` → form-elicitation mapping are all implemented and shipping in the exact SDK/adapter versions Maude already pins (`@agentclientprotocol/sdk@0.28.1`, `@agentclientprotocol/claude-agent-acp@0.57.0`). No version bump needed.
- `claude-agent-acp` strips `AskUserQuestion` from the model's tool list entirely when the client hasn't declared `elicitation.form` support (`acp-agent.js:2787`) — confirmed this is the actual, sole reason the tool is unavailable today; it is not a client-side rendering gap.
- The SAME `unstable_createElicitation` handler also carries **MCP-server-originated elicitation requests** (`elicitation.d.ts` header comment: "1. `onElicitation` — fired when an MCP server requests user input... maps directly onto ACP `session/create_elicitation`"). There is no capability sub-flag to accept AskUserQuestion-shaped forms only — declaring `elicitation.form` opens the channel to both sources uniformly.
- A THIRD, unrelated mechanism — the `refusal_fallback_prompt` dialog kind, gated by a separate `supportedDialogKinds` declaration — rides a different, generic "dialog" protocol, not elicitation. **Out of scope here**; don't conflate the two capability gates.
- URL-mode elicitation (`ElicitationUrlMode`, directing the user to an agent-chosen URL) is a materially different trust surface (an agent picking a URL for the user to visit) from a schema-driven form rendered entirely client-side. **This plan declares `form` capability only, not `url`** — an agent that requests url-mode without the client advertising it gets the SDK's own unsupported-mode handling, not a Maude-authored one.

**Not yet confirmed — verify during Task 1 execution, don't assume:**

- The exact `acp.methods.client.elicitation.create` constant path used by an agent-side test fixture to issue a raw elicitation request (for the MCP-elicitation test case, as opposed to going through the real `AskUserQuestion` tool, which is the primary test path and doesn't need this).
- Whether `ctx.client.request(...)` (the pattern `mock-acp-agent-permission.mjs` uses) is the correct call shape for triggering `AskUserQuestion` specifically, or whether the mock fixture instead needs to register a real tool call the SDK routes through `canUseTool` (per `acp-agent.js:2189` — `AskUserQuestion` is "surfaced to us as a normal permission check"). Read `handleAskUserQuestion`'s actual call site fully before writing the fixture; the doc comment implies the routing is more indirect than a bare client request.

---

## Design Decisions

### Components

- New: `ElicitationPrompt.jsx` (form card), `acp-elicitation.js` (pure schema parser + content builder).
- Reused: the card-slot layout, focus-trap, and Enter/Esc handling pattern from `PermissionPrompt.jsx`; the `.chat-perm*` CSS shape as the basis for new `.chat-elicit*` classes (DS tokens only, no hardcoded colors, per repo convention).

### Interaction

- Single-select question → radio group (one schema property with `type:'string'` + `oneOf`/`enum`).
- Multi-select question → checkbox group (`type:'array'` + `items`).
- Per-question free-text override, where the schema offers a sibling `_custom` field — rendered as a collapsed "Type your own answer instead" toggle beneath that question's options, matching the CLI's own "Other" affordance so the panel doesn't feel like a lesser version of the terminal experience.
- Submit is disabled only when the schema marks a field `required` and it's unanswered; every `AskUserQuestion`-sourced form has nothing required (Skip always works, per the adapter's own doc comment) — a generic MCP form theoretically could mark fields required, so honor `schema.required` rather than hardcoding "nothing is ever required".
- Esc → Cancel (aborts the tool call, distinct from Skip). Matches `PermissionPrompt`'s existing Esc semantics (closest analog: Esc = reject there too).

---

## Tasks

### Task 1: DECLARE the elicitation.form client capability

- **Do**: In `bridge.ts`, add `elicitation: { form: {} }` to the `clientCapabilities` object passed to `conn.initialize()`. Add `type CreateElicitationRequest, type CreateElicitationResponse` to the `@agentclientprotocol/sdk` import block.
- **Gotcha**: Declare `form` only. Do not add `url` — see Research / Open decisions.
- **Validate**: `cd apps/studio && bun test acp-elicitation-bridge` (once Task 2 exists) — confirm `AskUserQuestion` is no longer in the mock agent's `disallowedTools` echo, if the mock fixture surfaces that; otherwise defer validation to Task 2's round-trip test.

### Task 2: IMPLEMENT `unstable_createElicitation` on the bridge (fail-closed)

- **Do**: On the `client` literal passed to `ClientSideConnection` (alongside `requestPermission`), add `unstable_createElicitation(params: CreateElicitationRequest): Promise<CreateElicitationResponse>`. Mirror `requestPermission`'s shape exactly: generate an id, register `{ resolve, timer }` in a new `pendingElicitations` Map, emit via a new `onElicitationRequest?(id, params)` sink, resolve via a new `resolveElicitation(id, response)` bridge method. Reuse `PERMISSION_TIMEOUT_MS`/`permissionTimeoutMs` as the default timeout unless a dedicated constant is cleaner — judgment call, note which in execution.
- **Do**: On timeout AND on `cancel()`/`stop()` (mirror `denyAllPendingPermissions()` → add a `declineAllPendingElicitations()` called from the same places), resolve `{ action: 'decline' }`. Never resolve `accept` without a real client-supplied `content`.
- **Gotcha**: This handler fires for BOTH `AskUserQuestion` and any MCP-server elicitation (see Research) — do not special-case the toolCallId/session scope to assume it's always the built-in tool.
- **Validate**: `cd apps/studio && bun test acp-elicitation-bridge`

### Task 3: WIRE elicitation frames through the manager (index.ts) + connection (runtime)

- **Do**: `acp/index.ts` — add `onElicitationRequest: (id, req) => send(ws, { t:'elicitation-request', id, message: req.message, mode: req.mode, requestedSchema: req.requestedSchema })` to the bridge-sink wiring (alongside `onPermissionRequest`). Add an `elicitation-response` inbound branch → `bridge.resolveElicitation(id, decision)`, gated the same way the `permission-response` branch is (loopback + same-origin — this is server-authoritative bridge control, not canvas-reachable).
- **Do**: `acp-runtime.js` — add the `elicitation-request` branch in `onFrame` (mirror the `permission-request` branch at ~line 262), an `onElicitation(fn)` listener registration (mirror `onPermission`), and a `respondElicitation(id, response)` sender (mirror `respondPermission`).
- **Validate**: `cd apps/studio && bun test acp-elicitation-bridge`

### Task 4: ADD the pure schema parser + content builder

- **Do**: `acp-elicitation.js` — `parseElicitationSchema(requestedSchema)` walks `properties` in object-key order, classifying each into `{ id, title, description, kind, options, customFieldId }`; pairs a `question_<n>` field with its sibling `question_<n>_custom` field into one question descriptor (don't render the custom field as its own top-level question). `buildElicitationContent(questions, answers)` folds the UI's answer state back into the `content` map the response expects, with a non-empty custom answer taking precedence over a selection (mirrors `applyAskElicitationResponse`'s documented rule — read it, don't guess the shape).
- **Validate**: `cd apps/studio && bun test acp-elicitation`

### Task 5: RENDER `ElicitationPrompt.jsx`

- **Do**: Card in the same slot as `PermissionPrompt` (thread-level, between feed and composer, mutually exclusive with `.chat-perm`/`.chat-error-card`), showing `message` as a header and each parsed question as a radio/checkbox group + optional free-text toggle. Submit → `conn.respondElicitation(id, { action:'accept', content })`; Skip → `{ action:'decline' }`; Esc/close → `{ action:'cancel' }`. Focus-trapped, Enter submits when a required field is satisfied, like `PermissionPrompt`.
- **Do**: `ChatPanel.jsx` — mount it wherever `PermissionPrompt` mounts, driven by a new elicitation-pending state (mirror the permission-pending wiring).
- **Do**: CSS — `.chat-elicit`, `.chat-elicit-hd`, `.chat-elicit-question`, `.chat-elicit-actions` in `6-acp-chat.css`, based on `.chat-perm*`'s existing shape (DS tokens only).
- **Validate**: live-verify in the native app (see Validation §3).

### Task 6: TEST the end-to-end round trip + record the DDR

- **Do**: `mock-acp-agent-elicit.mjs` + `acp-elicitation-bridge.test.ts` — a real `AskUserQuestion` call through the mock adapter, asserting the client sees a well-formed `elicitation-request` frame and the bridge correctly folds the client's `elicitation-response` back into a tool result the mock agent can read. Cover timeout → decline, cancel → cancel, accept with a selected option, accept with a custom free-text answer overriding a selection.
- **Do**: New DDR (`record-ddr`; next free number — re-check the decisions dir AND the uncommitted README index diff at commit time, numbering races on shared main per the standing convention): "ACP elicitation-form support — AskUserQuestion + generic MCP form input, fail-closed." Note explicitly: (a) this is an UNSTABLE upstream protocol surface — the SDK's own types mark every elicitation type `@experimental`, a future SDK bump could change the wire shape without a Maude-side signal; (b) the same channel carries any connected MCP server's elicitation requests, not just the built-in tool — a compromised/malicious MCP server could theoretically use a deceptive form `message` to solicit sensitive input (e.g. "paste your API key") from the user; this is the same class of trust boundary as an existing tool-call permission prompt (the user is always the one typing the answer, nothing auto-fills), not a new category of risk, but worth naming so a future reader doesn't have to rediscover it.
- **Validate**: `cd apps/studio && bun test`

### Task 7: CLOSE-OUT (bundle, E2E, docs)

- **Do**: Rebuild the committed client bundle release-minified: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.
- **Do**: `apps/desktop/e2e/scenarios/acp-ask-user-question.e2e.ts` (DOM-driven, new `data-testid`s from Patterns to Follow).
- **Do**: Append a What's New entry via the `whats-new-entry` skill — this is genuinely user-visible ("Claude can now ask you a real multi-choice question, right in the chat panel").

---

## Validation

1. **Unit tests**: `cd apps/studio && bun test` — new suites (`acp-elicitation`, `acp-elicitation-bridge`) green + no regression in existing `acp-*`/`chat-*`.
2. **Lint/format**: `biome check apps/studio` (repo uses biome; no root `tsc` gate per CLAUDE.md/DDR-026).
3. **Native live-verify** (the ceiling per memory `feedback_native_app_verification_ceiling` — dogfood the bundled `.app`, not just `tauri dev`): ask Claude, in a real chat, to use the `AskUserQuestion` tool (the exact prompt the user already tried: "ask me something, use the ask user tool") — the form card should render with real options, Submit should resolve the turn with the chosen answer reflected in Claude's next message, Skip should let the turn continue with no answer, and killing/timing-out a pending request must not hang the composer.
4. **Origin gate**: confirm the new `elicitation-response` WS branch is loopback/same-origin gated identically to `permission-response` — no canvas-origin frame can answer on the user's behalf. Extend `acp-origin-gate` coverage if that test file enumerates frame types explicitly.
5. **Desktop E2E**: `pnpm test:e2e:desktop` green for the new scenario.
6. **Security re-review** (a genuinely new client-exposed capability, same class of change as Milestone B): spawn `security-auditor` + `ethical-hacker` over the diff — confirm decline-on-timeout/cancel actually fires in every code path (no Promise left dangling), the new WS branch can't be reached from the canvas origin, and the MCP-elicitation-as-phishing-vector residual (Task 6) is documented, not silently accepted. `/flow:validate-security` pass.

---

## Acceptance Criteria

- [ ] `elicitation: { form: {} }` declared in `clientCapabilities`; `url` mode NOT declared.
- [ ] `unstable_createElicitation` implemented on the bridge; resolves `decline` on timeout/cancel/turn-cancel, never fabricates `accept`.
- [ ] `elicitation-request`/`elicitation-response` frame pair wired end-to-end (bridge → index.ts → acp-runtime.js).
- [ ] `ElicitationPrompt.jsx` renders single-select, multi-select, and free-text-override questions correctly from a real `AskUserQuestion` call; Submit/Skip/Cancel all resolve the turn correctly.
- [ ] Live-verified in the native `.app`: the exact prompt "ask me something, use the ask user tool" now produces a working interactive form instead of a plain-text fallback.
- [ ] `bun test` green (new + existing); `biome check` clean; committed `dist/*` rebuilt `--release`.
- [ ] Desktop E2E scenario green.
- [ ] New DDR recorded, including the MCP-elicitation-as-phishing-vector residual note.
- [ ] `security-auditor` + `ethical-hacker`: 0 blockers.
- [ ] DDR-123/DDR-125 guardrails intact (native-only, loopback-only, no ACP route on the canvas origin).
- [ ] What's New entry added.

---

## Open decisions (surface to the user before execution)

1. **Form-only vs. form+url capability.** This plan declares `form` only (recommended — a schema-driven form rendered entirely client-side is a materially smaller trust surface than an agent picking a URL for the user to visit). If a future need for url-mode elicitation shows up, it should be its own follow-up with its own security review, not folded in here.
2. **Shared vs. parallel pending-request machinery.** Task 2 prefers extending/sharing the existing `pendingPermissions`-style machinery with the new elicitation map if that's clean; a parallel, identically-shaped implementation is an acceptable fallback if sharing gets awkward (e.g. the two request types don't unify well under one generic "pending client answer" abstraction). Execution should note which was chosen and why — not a blocking decision, but worth a conscious call rather than an accidental one.
3. **Scope of the MCP-elicitation residual.** This plan accepts that declaring `elicitation.form` opens the same UI to any connected MCP server, not just `AskUserQuestion`, and treats that as an acceptable, DDR-documented residual (same trust class as an existing tool-permission prompt) rather than something to gate behind a separate opt-in. If the user disagrees and wants AskUserQuestion-only behavior, that would require either an adapter-side change (out of Maude's control — `claude-agent-acp` doesn't expose a "form, but only for the built-in tool" sub-flag) or a Maude-side heuristic to detect and reject non-AskUserQuestion-shaped forms, which is fragile (a heuristic-based reduction is a materially worse implementation, not a peer alternative — surfaced here for a decision, not as an option to choose without discussion).

---

## Retro

- **What worked**: the plan's research-first framing (confirm every claim against the installed `@agentclientprotocol/sdk`/`claude-agent-acp` source, not the public docs) held up completely through execution — the exact field-pairing convention, capability-gate shape, and fail-closed contract predicted in the plan matched what got implemented and reviewed, with zero surprises requiring a plan rewrite. Mirroring DDR-179's Promise+pending-map+timeout shape (rather than inventing a new pattern) meant the elicitation channel inherited a security posture that had already been thought through once, and the two security fan-out passes run against it (see DDR-180's two addenda) found real, non-overlapping findings each time — evidence the extra scrutiny was worth the cost, not redundant.
- **Executed by a different session than the one that authored the plan.** This plan was written in one Claude Code session (in response to a user's live dogfooding question — "why doesn't AskUserQuestion work?") and then picked up and implemented by a SEPARATE, concurrent Claude Code session on the same working tree, apparently without direct coordination — discovered mid-`/flow:done` when files this session expected to be untouched (`bridge.ts`, `ChatPanel.jsx`) turned out to already carry the other session's uncommitted elicitation-mounting code. The two sessions' independent security-hardening choices converged closely (near-identical `Object.create(null)` proto-pollution defenses, near-identical `mode:'url'` structural-rejection fixes) — reassuring that the plan's own detail level was sufficient to guide a differently-scoped session to the same conclusions, but also a genuine collision risk that needed careful `git log`/`git diff HEAD` forensics to untangle before committing anything.
- **What a second, independent review pass is worth**: the executing session's OWN security fan-out (documented as DDR-180's first addendum) caught and fixed the attribution/mode:'url'/proto-pollution findings. A SECOND fan-out, run by this closing session before commit, found three more real findings the first pass didn't — an unbounded elicitation-request queue/schema-size flood vector, a proto-pollution-hardening asymmetry between the client and server content builders, and the `form`-only capability decision funneling every credential request onto one unmasked channel. Neither pass was redundant; the second one specifically reasoned from the MCP spec's own elicitation guidance rather than just the codebase, which is what surfaced the credential-channel finding. Two independent adversarial passes over genuinely new, AI-facing surface caught meaningfully more than one.
- **Process note for next time**: consider a lightweight "claiming" signal (even just a STATE.md `Active task` line, updated promptly) when a plan is about to be executed, specifically to avoid the two-sessions-editing-the-same-files situation this close-out had to untangle after the fact rather than avoid up front.
