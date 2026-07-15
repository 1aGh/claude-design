# DDR-179 — ACP permission gate: mode-driven policy + manual approve/deny UI retires DDR-125 F2

**Status:** accepted · **Date:** 2026-07-15 · **Phase:** feature-acp-panel-dynamic-claude-code-capabilities (Milestone B)
**Relates:** DDR-125 (multi-chat + security posture — F2 is the accepted risk this closes), DDR-123 (connection model + guardrails, unchanged), DDR-054 (untrusted-canvas / loopback trust model)

## Context

DDR-125's F2 accepted a real risk as a bounded v1 trade-off: the bridge's `requestPermission` handler auto-approved every tool call (`pickAllowOption` picked the most-permissive offered option and returned it synchronously), more permissive than terminal Claude Code's own default. That DDR named the required mitigation explicitly — "a manual approve/deny UI… scheduled as the next ACP follow-up" — and warned "until then the panel must not be presented as safe against a hostile repo."

Milestone A of this feature (feature-acp-panel-dynamic-claude-code-capabilities) made the session's permission-mode roster (`SessionModeState`) live and user-selectable. That made F2 worse in one specific way: a mode picker showing "Manual" while the bridge silently auto-approved everything underneath it would be actively misleading — the user picks a mode that promises prompts and gets none. Milestone A's mode picker could not ship honestly without Milestone B alongside it.

## Decision

**The permission POLICY is now the selected session mode, sourced from Claude Code itself — not a client-side auto-approve.** Per the ACP adapter's own mode semantics (verified by reading `@agentclientprotocol/claude-agent-acp` on disk):

- `bypassPermissions` / `dontAsk` — the adapter short-circuits `requestPermission` entirely (no call reaches the bridge). Selecting one of these IS "no prompts," honestly, because the agent never asks.
- `plan` — the adapter never executes tools regardless of any answer, so a prompt (if one arrives at all) is inert.
- `default` (Manual) / `acceptEdits` — the adapter calls `requestPermission` for every non-pre-approved tool call. These are the modes this DDR makes honest.

**`AcpBridge.requestPermission` is now async and awaits a real human decision** (`acp/bridge.ts`):
- Forwards the request to the client via a new `onPermissionRequest(id, req)` callback (a fresh `crypto.randomUUID()` nonce), registers a pending resolver, and returns a `Promise` that only settles when `resolvePermission(id, decision)` is called.
- The existing `onPermission` transparency callback is kept, unconditionally, alongside the new one — every request is still observable for logging regardless of how it resolves.
- **Fails closed on every abandonment path**, never open:
  - **Timeout** (`PERMISSION_TIMEOUT_MS`, 120 s, injectable via `permissionTimeoutMs` for tests only) → `resolvePermission(id, 'cancelled')`.
  - **Turn-cancel** (`bridge.cancel()`) → `denyAllPendingPermissions()` settles every request currently pending on this bridge as `'cancelled'`, so a cancelled turn never leaves a permission promise hanging forever.
  - **An unoffered/unknown decision** (a `permission-response` frame whose `decision` isn't `'cancelled'` and isn't one of THIS request's own advertised `optionId`s) also collapses to `'cancelled'` rather than being forwarded blind — the DDR-125 F1 posture ("a loopback frame can't pin an arbitrary value") extended to this new channel: `pendingPermissions` stores each request's own offered `optionIds`, and `resolvePermission` validates against that set, not a global allowlist.

**Wire protocol** (`acp/index.ts`): a new `permission-request` server→browser frame (`{id, toolCall, options}`) and `permission-response` browser→server frame (`{id, decision}`) → `bridge.resolvePermission(id, decision)`. Both stay on the existing main-origin + loopback-guarded `/_ws/acp` socket — no new route, so the DDR-054/123 canvas-origin exclusion is untouched by construction.

**Client** (`acp-runtime.js` + `PermissionPrompt.jsx`): pending requests are surfaced OUTSIDE the assistant-ui message stream — a panel-level `onPermission(fn)` subscription (mirroring `onCommands`/`onCaps`), not routed through `run()`'s parts array, since a permission request is "pause here for a human," not renderable turn content. `PermissionPrompt` renders every offered `options[]` generically (not a fixed Allow/Reject pair) because **`ExitPlanMode` rides this exact same `requestPermission` path** — the adapter surfaces "approve exiting plan mode?" as a multi-way permission request ("Yes, and use auto mode" / "Yes, and auto-accept edits" / "Yes, and manually approve edits" / "No, keep planning"), and approving flips the mode via `current_mode_update` + `config_option_update` the SAME way a user-driven `set-mode` does. The composer footer shows the active mode's name and whether it implies prompts (`bypassPermissions`/`dontAsk` → "no prompts"; everything else → "you'll be asked"), so the mode picker (Milestone A) is now honest about what it promises.

**No blanket auto-approve escape hatch was added anywhere** (no localStorage "always allow" toggle, no default-allow fallback) — the mode IS the policy; a user who wants today's hands-off behavior picks Bypass/Don't-Ask explicitly, the same way they would in terminal Claude Code.

## Consequences

**Positive:**
- F2 is retired. The scope DDR-125 accepted it for (the user's OWN `claude`, OWN machine, loopback, native-app-only, OWN project) is now backed by a real per-call gate instead of a blanket grant.
- The Milestone A mode picker is now truthful: picking Manual/Accept-Edits genuinely produces prompts; picking Bypass/Don't-Ask genuinely doesn't (because the adapter itself never calls in).
- The fail-closed defaults (timeout, cancel, unoffered decision) mean there is no code path where an abandoned or malformed decision resolves to *allow* — the security property holds even under a client crash, a socket drop, or a buggy frame.

**Negative / trade-offs:**
- A user who wants zero interruption must now explicitly select Bypass/Don't-Ask mode, rather than getting silent auto-approve by default under Manual — a deliberate UX cost in exchange for the mode picker being honest.
- `PERMISSION_TIMEOUT_MS` (120 s) is a judgment call, not protocol-specified — a long-idle user could see a turn silently deny itself. Acceptable for v1; revisit if dogfooding surfaces it as premature.
- Security review (per this plan's Validation §7, `/flow:validate-security`) is required before F2 can be marked closed in the tracker — this DDR records the mechanism; the review confirms no bypass exists (e.g. a canvas-origin frame reaching `permission-response`, which the origin gating should already prevent structurally).

## Revisit when

- The adapter/SDK version bumps in a way that changes `requestPermission` semantics for any mode (re-verify the `bypassPermissions`/`dontAsk` short-circuit and the `ExitPlanMode` multi-way-option shape against the new adapter source).
- Dogfooding surfaces `PERMISSION_TIMEOUT_MS` as too short/long in practice.

## Linked

- Plan: `.ai/plans/feature-acp-panel-dynamic-claude-code-capabilities.md` (Milestone B)
- Supersedes: DDR-125's F2 accepted-risk clause (that DDR's text is updated in place to point here, not rewritten)
