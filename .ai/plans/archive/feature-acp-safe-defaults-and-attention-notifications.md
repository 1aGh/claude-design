# Feature: ACP safe default-allow (localhost curl + read-only fs) + attention push notifications

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Two related, independently-shippable improvements to Maude's native ACP chat panel (`design:chat`):

**A.** Widen the session's default auto-approved tool surface so the actions that dominate real `/design:setup-ds`/`/design:edit`/`/design:new` friction stop interrupting the user with a permission prompt every time: raw `agent-browser` calls (already the documented, current behavior of `motion-critic.md`/`edit.md` and others), checking a localhost dev server via `curl`, read-only filesystem inspection (`ls`/`cat`/`find`/etc.), and `WebSearch`/`WebFetch` (used throughout `/design:setup-ds` research and `draw-agent`/`reconstruct-agent`) — without reopening the exact Bash-allowlist risk [DDR-184](../decisions/DDR-184-acp-default-tool-allowlist-and-no-edit-mode-banner.md) explicitly rejected.

**B.** Fire an OS-level push notification whenever the ACP panel needs the user's attention — a tool-call permission prompt (DDR-179) or an AskUserQuestion/elicitation form (DDR-180) — mirroring the existing "Claude finished" notification, so the user notices even when the Maude window isn't focused.

## User Story

As a Maude user driving an ACP chat session, I want `curl` to my own localhost and basic file/folder inspection to just work without a permission prompt every time, and I want a system notification whenever Claude is waiting on my approval or an answer, so I don't miss a stalled turn while working in another window.

## Problem

- A fresh ACP session already auto-approves `Read`/`Edit`/`Write`/`Glob`/`Grep`/`NotebookEdit`/`Bash(maude:*)` ([DDR-184](../decisions/DDR-184-acp-default-tool-allowlist-and-no-edit-mode-banner.md)). Anything else — including `curl localhost:3000` to sanity-check a local dev server, or `ls`/`cat`/`find` to look around a folder — still prompts every time.
- DDR-184's own "Alternatives rejected" section explicitly killed "`acceptEdits` + a broad Bash allow-list of common commands" as unmaintainable. The user's ask, taken literally, is exactly that rejected shape — it needs a materially different mechanism, not a blind re-application.
- When a permission prompt or an elicitation form appears, the only existing "notice me" signal is an in-app badge + a browser `Notification` that currently fires ONLY on "Claude finished" (`app.jsx:8401` `handleAssistantFinished`). A stalled turn waiting on a permission decision or a question produces **no** signal if the user has looked away — exactly the case the user is asking to close.

## Solution

### A. Widen the default-allow surface — without reopening what DDR-184 rejected

**Research finding that reframes the whole approach:** Claude Code's `allowedTools` `Bash(prefix:*)` syntax is a plain **string-prefix match** with no semantic understanding of "this argument is a URL to localhost" or "this argument is a path inside this repo" — `Bash(curl http://localhost:*)` would not match `curl -s http://localhost:3000` (the `-s` flag breaks the literal prefix). A `PreToolUse` **hook** could do a real semantic check instead — and the installed adapter (`@agentclientprotocol/claude-agent-acp@0.57.0/dist/acp-agent.js:2857`) does merge `...userProvidedOptions?.hooks` — but **this path is a dead end**: `apps/studio/acp/bridge.ts:719` spawns the adapter as a genuinely separate OS process (`Bun.spawn`), and `newSession(params)` (`bridge.ts:623`) sends `params` to that process over the ACP JSON-RPC wire. A `HookCallback` is a live JS function; it cannot survive JSON serialization across that process boundary. `userProvidedOptions.hooks` can only ever be populated by code running *inside* the adapter process — never by `bridge.ts`. (A divergent debate ran on this decision — BUILDER and BREAKER both initially converged on the `PreToolUse` hook approach before this wire-boundary check; see Design Decisions § Debate below for the full record and why their verdict was overturned by this follow-up finding, not silently swapped.)

**Mid-planning correction (2026-07-18, user clarification):** the user's actual, primary pain point is narrower and more concrete than "curl and fs commands in the abstract" — it's that **`/design:setup-ds`, `/design:edit`, `/design:new` (and the critic/motion-critic agents they spawn) already call raw `agent-browser` directly as documented, current behavior**, not through any `maude design <verb>` wrapper. Confirmed by grep, e.g.:
- `plugins/design/agents/motion-critic.md:106-107` — `agent-browser eval "window.__maude_seek__..."; agent-browser screenshot /tmp/mc-f0.png` (raw, two separate Bash calls).
- `plugins/design/commands/edit.md:50` — `agent-browser eval "matchMedia('(prefers-reduced-motion: reduce)').matches"` (raw, an ad-hoc one-off probe — the expression varies per situation, so it can't be pre-canned into a fixed `maude design <verb>`).
- Referenced (not always wrapped) throughout `critic.md`, `screenshot.md`, `smoke.md`, `design-critic.md`, `graphic-design-critic.md`, `a11y-critic.md`, `draw-agent.md`, `draw-critic.md`.

None of this matches `Bash(maude:*)`, so **every one of these calls prompts today**, inside exactly the workflows (`setup-ds`/`edit`/`new`) the user named. This is the dominant friction source, ahead of plain `curl`/`ls`. The plan below is revised accordingly — three tracks, not two, split by **why each one is trustworthy to auto-approve**, not by convenience:

- **`agent-browser` is a second named, first-party-adjacent tool — same trust tier as `maude` itself.** It's a hard dependency the design plugin declares in `plugins/design/dependencies.json`, the user installs it explicitly (`npm i -g agent-browser`) *for* Maude's design workflow, and every one of its call sites in this plugin's own docs is browser-automation against the local dev-server canvas (screenshots, `eval` probes, axe-core scans) — not a generic shell escape hatch. Add **`Bash(agent-browser:*)`** to `MAUDE_DEFAULT_ALLOWED_TOOLS` directly, using the *same* justification DDR-184 already used for `Bash(maude:*)` (named, vetted, purpose-built tool — not "any command"), not the curl treatment. **Residual, accepted explicitly, not hidden:** unlike a hypothetical wrapper verb, nothing stops `agent-browser navigate https://not-localhost` from working — the tool itself has no built-in host restriction, and prefix-matching can't add one. Accepted because the threat model is identical to what DDR-184 already accepted for `Bash(maude:*)` (a hostile project's content could already try to steer the model into misusing an auto-approved first-party tool; this doesn't open a new category, it extends the existing one to a second tool). **`npx playwright` (the documented *fallback* when `agent-browser` itself is missing) is deliberately EXCLUDED** — `npx` can execute arbitrary, non-pinned npm packages, a categorically bigger escape hatch than a fixed installed binary; that fallback path stays behind the normal prompt (rare in practice — only fires when `agent-browser` isn't installed).

- **`curl` reaches the network via a generic system utility — a genuinely new capability class, and not a tool Maude owns the way it owns `agent-browser`/`maude`.** Ship it as a first-party `maude design curl-local <url> [curl-args...]` verb ([DDR-062](../decisions/DDR-062-plugins-reach-executable-logic-via-maude.md) pattern), implemented in trusted first-party code that resolves the target host itself and refuses non-loopback targets *before* ever invoking real `curl`. This is covered automatically by the **existing** `Bash(maude:*)` rule — **zero additional widening of `MAUDE_DEFAULT_ALLOWED_TOOLS`** beyond the `agent-browser` line above, real host enforcement (actual DNS resolution + IP classification, not string matching), and it directly reuses the SSRF-gate primitives already shipped and reviewed in `apps/studio/bin/_fetch-asset.mjs` (`resolveSafeIp`/`classifyAddress`/`classifyIPv4`/`classifyIPv6`, which resolve **every** DNS record via `lookup(host, {all:true, verbatim:true})` — closing the DNS-rebinding gap the debate's BREAKER seat raised), just with the accept condition inverted (require loopback, instead of rejecting it). A short, static line in `buildStudioBrief` (`apps/studio/acp/bootstrap-brief.ts`) nudges the model to prefer the verb for localhost checks; raw `curl` still falls through to today's normal permission prompt — not a regression, just not the happy path.

- **Read-only filesystem inspection (`ls`/`cat`/`find`/`pwd`/`head`/`tail`/`wc`/`tree`/`file`/`stat`) adds ~no incremental read capability.** `Read`/`Grep`/`Glob` are *already* auto-approved unconditionally today (DDR-184, unchanged) — Claude can already read any file it can name via those tools, with **no folder scoping** (see Open Finding below — this is worth knowing before treating "scope it to the folder" as achievable here). So this half is a small, **closed** addition directly to `MAUDE_DEFAULT_ALLOWED_TOOLS` — justified by "no new power, just a more convenient interface to power already granted," not by "these commands are safe in isolation" (the argument DDR-184 already rejected). Mutating commands (`mkdir`/`touch`/`rm`/`mv`/`cp`/`chmod`) are explicitly excluded from the list — mutation stays behind `Write`/`Edit` (already approved, with `_history/` rollback) or the permission prompt.

- **`WebSearch`/`WebFetch` — decided in scope (user confirmed 2026-07-18).** The design-system bootstrap flow (`/design:setup-ds` Stage 2, `ux-research-agent` in `discovery` mode) runs 6-8 `WebSearch` queries, and both tools are referenced across `draw-agent.md`, `reconstruct-agent.md`, `draw.md`, `import.md`, `new.md`. Neither is on `MAUDE_DEFAULT_ALLOWED_TOOLS` today, so those calls also prompt every time during a setup-ds run. Mechanically simpler than the Bash tracks above: these are **native Claude Code tools**, not shell commands — `allowedTools` matches them as bare exact tool names (`'WebSearch'`, `'WebFetch'`), the same shape as the already-approved `Read`/`Edit`/`Write`, with none of the string-prefix brittleness the Bash tracks have to work around. Already part of the session's available toolset today (the adapter defaults to the full `claude_code` tool preset — `acp-agent.js`'s `tools: userProvidedOptions?.tools ?? {type:"preset", preset:"claude_code"}` — so this is purely a permission change, not a capability/tool-availability change like DDR-180's `AskUserQuestion` gate was). **Residual, accepted explicitly:** unlike the Bash tracks, the risk here isn't command injection — it's that fetched web content is exactly the kind of untrusted external data a prompt-injection attack rides in on (a WebFetch/WebSearch result the model then treats as instructions). This risk exists in EVERY Claude Code session regardless of Maude, is orthogonal to the auto-approve decision (a user manually clicking "allow" on a WebFetch prompt doesn't actually vet the fetched content either — approval gates *whether* the fetch happens, not what's in the response), and is unchanged by this addition. Named here so it's not silently assumed away.

- Recorded as a new DDR (**DDR-185** — confirmed free against `.ai/decisions/` and no uncommitted DDR files as of this planning session; **re-confirm immediately before the closing commit**, per the `project_ddr_numbering_races_on_shared_main` lesson — concurrent sessions can claim the same number).
- **Mandatory security-auditor + ethical-hacker fan-out before this half is considered done** — every prior ACP-permission DDR (179, 180, 184) required this, and DDR-179's own addendum documents a real bug (wrong default button on the permission card) that only a *second* pass caught. Not optional here.

**Open finding worth surfacing, not solving in this plan:** `Read`/`Write`/`Edit` are already unconditionally auto-approved with **no path scoping at all** — the model can already read/write any absolute path it can name on the user's disk without a prompt, today, under the existing DDR-184 baseline. "Scope bash to the folder" doesn't change that pre-existing fact; if genuine folder-scoping for `Read`/`Write`/`Edit` themselves is wanted, that's a separate, larger feature (and hits the same hook/wire-boundary dead end this plan just worked around for Bash) — out of scope here, flagged for a future DDR if it turns out to matter in practice.

### B. Attention push notifications

Reuse the **existing** Notification-API + focus-gating pattern already shipped for "Claude finished" (`app.jsx:8401-8412`), instead of adding a new Tauri OS-notification plugin. Confirmed via research: no `tauri-plugin-notification` dependency exists anywhere in the repo, and none is needed — the Web `Notification` API precedent is already live, dogfooded, and works from inside the WKWebView. Thread two new callback props (`onPermissionRequest`, `onElicitationRequest`) through `ChatPanel` (mirroring the existing `onBusyChange`/`onFinished` wiring) up to `app.jsx`, firing the same `document.hidden`/`assistantOpenRef`-gated `Notification` call with distinct copy ("Maude needs your input").

## Metadata

- **Type**: Enhancement
- **Complexity**: High (touches the ACP session-options surface, a new CLI verb, a new DDR reopening a recent security-reviewed boundary, and a client-side notification wire-up; mandatory security fan-out)
- **App/Package**: `apps/studio` (dev-server + client), `cli/` (design verb dispatch), `.ai/decisions/` (DDR)
- **Affected Systems**: ACP bridge/session options, native chat panel UI, `maude design` CLI verb surface
- **Dependencies**: none new (no new npm/cargo packages — the Web Notification API and the DNS/SSRF primitives are already present)

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message during `/flow:execute` — they're independent context loads.

- `apps/studio/acp/bridge.ts` (lines 200-300, and 700-730) — Why: owns `MAUDE_DEFAULT_ALLOWED_TOOLS` + `newSessionParams()` (Task A target) and the `Bun.spawn` adapter boundary that ruled out the hook approach.
- `apps/studio/acp/bootstrap-brief.ts` — Why: `buildStudioBrief()` is where the curl-local nudge line gets added (static facts only — read the file's own guardrail comment before touching it).
- `apps/studio/bin/_fetch-asset.mjs` (especially `resolveSafeIp`, `classifyAddress`, `classifyIPv4`, `classifyIPv6`, lines ~60-350) — Why: the exact DNS-resolution + IP-classification primitives to reuse (inverted accept condition) for `curl-local`'s host check. Do not reinvent this.
- `apps/studio/bin/fetch-asset.sh` — Why: the thin `.sh`-shim-over-`.mjs` pattern `curl-local.sh` must mirror exactly (verb dispatch is hardcoded to `.sh` extension in `cli/commands/design.mjs:248`, so the real logic lives in a co-located `.mjs`).
- `cli/commands/design.mjs` (lines 20-70, 117-260) — Why: `BIN_VERBS` set + `runBinDispatch` — where the new `curl-local` verb registers.
- `apps/studio/test/acp-session-allowed-tools.test.ts` — Why: the existing hard-guard test that currently asserts the Bash allowlist is *exactly* `['Bash(maude:*)']` — this test must be deliberately, visibly updated (not loosened silently) to the new fixed set.
- `plugins/design/agents/motion-critic.md` (lines ~106-107) and `plugins/design/commands/edit.md` (line ~50) — Why: the concrete, currently-shipping evidence that raw `agent-browser eval`/`agent-browser screenshot` calls are documented, expected agent behavior during `/design:edit` and the motion critic — this is the finding that drove the `Bash(agent-browser:*)` addition; re-grep `plugins/design/**/*.md` for `agent-browser` (excluding `maude design` matches) to confirm the full call-site set hasn't grown before finalizing the DDR's residual-risk framing.
- `plugins/design/dependencies.json` — Why: confirms `agent-browser` is a declared hard dependency of the design plugin (part of the "named, vetted, first-party-adjacent" trust argument for Task 5).
- `apps/studio/client/panels/ChatPanel.jsx` (lines 1606-1730, and props block 1724-1825) — Why: `conn.onPermission`/`conn.onElicitation` subscriptions already exist for local UI state; `onBusyChange`/`onFinished` show the exact prop-callback pattern to mirror for the two new callbacks.
- `apps/studio/client/app.jsx` (lines 8379-8412, and render sites ~12360-12445) — Why: `handleAssistantFinished` is the notification pattern to mirror; both `<ChatPanel>` render call sites (left/right dock) need the new props wired identically.
- `.ai/decisions/DDR-184-acp-default-tool-allowlist-and-no-edit-mode-banner.md` — Why: the decision this plan extends; its "Alternatives rejected" section is exactly what Task A must NOT blindly repeat, and its comment style is the model for the new DDR.
- `.ai/decisions/DDR-179-acp-permission-gate-retires-ddr125-f2.md` and `.ai/decisions/DDR-180-acp-elicitation-form-support-askuserquestion-plus-mcp.md` — Why: the permission/elicitation request lifecycle Task B's notifications hook into (`onPermission`/`onElicitation` callback shapes, fail-closed semantics).
- `.ai/decisions/DDR-054-*.md` (untrusted-project-content trust model) and `.ai/decisions/DDR-144-*.md` (`settingSources` narrowing) — Why: the threat model every ACP-permission change is reviewed against; cite in the new DDR.

### Documentation

- None external — every mechanism used here (Web Notification API, Node `dns/promises`, Claude Code `allowedTools` syntax) is already used elsewhere in this repo; no new library docs needed.

### Patterns to Follow

**`_fetch-asset.mjs`'s SSRF gate, inverted** (`apps/studio/bin/_fetch-asset.mjs`):
```js
import { lookup } from 'node:dns/promises';
// resolveSafeIp(host) today REJECTS loopback/private/link-local — for
// curl-local, require classifyAddress(...) to be exactly loopback and
// reject everything else, but reuse the same all-records DNS resolution
// (lookup(host, { all: true, verbatim: true })) so a multi-A-record
// DNS-rebinding host can't slip a non-loopback record past the check.
```

**`fetch-asset.sh` — the `.sh`-shim-over-`.mjs` verb pattern** (`apps/studio/bin/fetch-asset.sh`):
```sh
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_fetch-asset.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_fetch-asset.mjs" "$@"
else
  echo "fetch-asset.sh: node (or bun) is required." >&2
  exit 1
fi
```

**`app.jsx`'s existing attention-notification pattern** (`apps/studio/client/app.jsx:8401-8412`):
```jsx
const handleAssistantFinished = useCallback(() => {
  if (!assistantOpenRef.current || document.hidden) {
    setAssistantUnseen(true);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Claude finished', { body: 'Your assistant turn is ready in Maude.' });
      }
    } catch {
      /* best-effort — the in-app badge is the reliable signal */
    }
  }
}, []);
```

**`ChatPanel.jsx`'s callback-prop mirroring** (`apps/studio/client/panels/ChatPanel.jsx:1732-1733`, `1822-1825`, `1853`, `1861`):
```jsx
// props: onBusyChange, onFinished  →  add onPermissionRequest, onElicitationRequest
const cbRef = useRef({ onBusyChange, onFinished });
useEffect(() => { cbRef.current = { onBusyChange, onFinished }; }, [onBusyChange, onFinished]);
```

**`MAUDE_DEFAULT_ALLOWED_TOOLS`'s comment discipline** (`apps/studio/acp/bridge.ts:229-237`) — every rule in this list carries an inline comment explaining *why* it's safe to auto-approve; the new fs-verb entries and the DDR-185 pointer must follow the same style, not just append bare strings.

---

## Design Decisions

> No UI/visual surface changes — the permission/elicitation cards already render (DDR-179/180); this only adds a notification side-effect and a CLI verb. No Design System Discovery section needed.

### Debate record (per `/flow:plan` Step 5.5)

A 3-seat `reduce`-tier debate (BUILDER/SHIPPER/BREAKER, blind parallel openings) ran on "how should the default allow-list widen for curl+fs, without reopening DDR-184." Verdicts: BUILDER → `pretooluse-hook` (confidence 7), SHIPPER → `minimal-unscoped` (confidence 6, argued for a bare unscoped `Bash(curl:*)` and cutting the fs half entirely), BREAKER → `pretooluse-hook` reluctantly (confidence 8, with a "steelman against consensus" leaning toward shipping neither). No short-circuit — genuine disagreement, so the lead (this planning session) consolidated.

**The 2-of-3 `pretooluse-hook` verdict was overturned by a fact none of the three seats had**: verifying `bridge.ts:719`'s `Bun.spawn` + the ACP JSON-RPC `newSession` call (`bridge.ts:623`) shows hooks cross a real process boundary as JSON, and a `HookCallback` is a live function — it cannot survive that. This is disclosed here per the protocol's step-6 requirement to preserve real disagreement rather than silently picking a winner: BUILDER and BREAKER's *reasoning* (real semantic enforcement beats string-prefix matching) was right and is preserved in the `curl-local` verb design (which achieves the same real-enforcement goal via a different, wire-compatible mechanism); SHIPPER's *caution* about not reopening DDR-184's rejected shape is preserved in the "equivalent-power, closed-list, no-mutation" framing for the fs half, and its "cut what isn't load-bearing" instinct is preserved by NOT giving `curl` a broad unscoped rule.

### Why three different mechanisms, not one "widen Bash" decision

Each of the three tracks is justified by a *different* property, deliberately not collapsed into one rule:

| Track | Mechanism | Why this one's safe to auto-approve |
| --- | --- | --- |
| `agent-browser` | Direct `Bash(agent-browser:*)` entry | Named, vetted, first-party-adjacent tool (hard dependency of the design plugin) — same trust tier as `Bash(maude:*)`, not "any command" |
| `curl` | Dedicated `maude design curl-local` verb | Generic system utility reaching the network — Maude doesn't "own" curl the way it owns `agent-browser`/itself, so it earns real enforcement (host resolution) instead of a blanket grant |
| `ls`/`cat`/`find`/etc. | Direct allowlist entries | Add no capability beyond what `Read`/`Grep`/`Glob` already grant unconditionally today — friction reduction, not a new grant |
| `WebSearch`/`WebFetch` | Direct allowlist entries (bare tool names, native — no prefix-matching involved) | Already-available native tools (full `claude_code` preset); risk is prompt-injection-via-fetched-content, orthogonal to the approve/deny decision itself |

### Alternatives rejected

- **Curated `curl` prefix-list** (`Bash(curl http://localhost:*)` etc.) — the literal DDR-184-rejected shape; flag-order and `127.0.0.1`-vs-`localhost` text variants defeat it outright.
- **`PreToolUse` hook via `_meta.claudeCode.options.hooks`** — structurally infeasible; see the wire-boundary finding above. Do not attempt this without first re-verifying the adapter's process topology hasn't changed (spawn vs. in-process import) on any future `@agentclientprotocol/*` version bump.
- **Bare unscoped `Bash(curl:*)`** (SHIPPER's literal ask) — rejected because the `curl-local` verb achieves the same friction removal with real enforcement at roughly the same implementation cost; kept here as the documented fallback if the verb approach proves materially harder to ship than estimated.
- **Provisioning a hook into the user's own `~/.claude/settings.json`** (session-external) — considered and rejected: it would leak Maude's gate into the user's unrelated plain-terminal `claude` sessions (global, not session-scoped), and conflicts with the spirit of `settingSources:['user']` narrowing being about *reading* user config, not Maude *writing* into it.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `apps/studio/bin/_curl-local.mjs`

- **Do**: Pure Node ESM (mirrors `_fetch-asset.mjs`'s structure/exit-code convention: `0` ok · `2` usage · `3` validation reject · `4` curl/exec error · `1` other). Import (or, if the module boundary makes that awkward, port verbatim with a comment pointing back to the source) `classifyAddress`/`parseIPv4`/`parseIPv6` from `_fetch-asset.mjs`. Parse the target URL from argv (first non-flag arg, matching how a user would actually type `curl <flags> <url>` — curl itself accepts the URL in any position, so scan all args for the first one that parses as an http(s) URL). Resolve its hostname via `lookup(host, { all: true, verbatim: true })`; require **every** returned address to classify as loopback (IPv4 `127.0.0.0/8` or IPv6 `::1`); refuse (exit 3, clear stderr) if any record is non-loopback or DNS resolution fails. On success, `spawn('curl', originalArgv, { stdio: 'inherit' })` and forward curl's own exit code.
- **Pattern**: `apps/studio/bin/_fetch-asset.mjs` (`resolveSafeIp`, `classifyAddress`, `curlDownload`'s spawn-and-forward-exit-code shape).
- **Gotcha**: resolve **every** DNS record, not just the first (`{ all: true }`) — a multi-A-record response where only one record is loopback must still be rejected; this is the DNS-rebinding defense BREAKER's debate seat flagged.
- **Validate**: `bun run apps/studio/bin/_curl-local.mjs http://localhost:1/ping` (or any loopback URL) succeeds through to a real curl invocation; `bun run apps/studio/bin/_curl-local.mjs http://example.com` exits 3 without ever invoking curl.

### Task 2: CREATE `apps/studio/bin/curl-local.sh`

- **Do**: Thin shim, byte-for-byte pattern match on `fetch-asset.sh` — prefer `node`, fall back to `bun run`, `exec` into `_curl-local.mjs "$@"`.
- **Pattern**: `apps/studio/bin/fetch-asset.sh`.
- **Validate**: `bash apps/studio/bin/curl-local.sh --help` (or a loopback URL) behaves identically to calling the `.mjs` directly.

### Task 3: UPDATE `cli/commands/design.mjs`

- **Do**: Add `'curl-local'` to the `BIN_VERBS` set (~line 38-70), matching the existing whitelist style/comment block. Also add a row to CLAUDE.md's "Dev-server helpers (`apps/studio/bin/`)" table (per its own stated rule: "When the CLI needs anything else at runtime on end-user machines, add it here") — Purpose: "Loopback-only curl — resolves the target host and refuses non-loopback targets before invoking real curl"; Callers: "ACP session default-allow (DDR-185), general terminal use via `maude design curl-local`."
- **Pattern**: existing `BIN_VERBS` entries (e.g. `'fetch-asset'`).
- **Gotcha**: `runBinDispatch` hardcodes the `.sh` extension (`design.mjs:248`) — the verb name must exactly match the `.sh` filename stem (`curl-local`, not `curl_local`/`curlLocal`).
- **Validate**: `maude design curl-local http://localhost:1/ping` (repo-local `node cli/bin/maude.mjs design curl-local ...` in dev) dispatches correctly.

### Task 4: UPDATE `apps/studio/acp/bootstrap-brief.ts`

- **Do**: Add one static fact line to `buildStudioBrief()`'s returned array: the `maude design curl-local <url>` helper exists, is pre-approved (unlike raw `curl`, which will prompt), and should be preferred for checking a local dev server during this session.
- **Pattern**: the existing `slashCommands`/`whiteboardFact` lines — plain orientation fact, no behavioral/policy override, gated through `safeFact` if it ever incorporates any config-derived value (it doesn't need to here — this line is a static string, no interpolation).
- **Gotcha**: keep it STATIC (no live state) per this file's own guardrail comment (lines 10-20) — this is an environment-capability fact, not a policy instruction.
- **Validate**: `bun test apps/studio/test/acp-bootstrap-brief.test.ts` (extend if it snapshot-asserts the brief's line count/content).

### Task 5: UPDATE `apps/studio/acp/bridge.ts`

- **Do**: Extend `MAUDE_DEFAULT_ALLOWED_TOOLS` with:
  1. **`Bash(agent-browser:*)`** — a single named-tool rule, own comment block explaining the "second first-party-adjacent tool, same trust tier as `Bash(maude:*)`" justification, explicitly naming the residual (no host restriction inside the tool itself) and why it's accepted (mirrors the existing `Bash(maude:*)` residual reasoning, doesn't open a new risk category), and explicitly noting `npx playwright` (the agent-browser-missing fallback) is deliberately NOT included.
  2. The closed read-only fs verb set: `Bash(ls:*)`, `Bash(cat:*)`, `Bash(pwd:*)`, `Bash(find:*)`, `Bash(head:*)`, `Bash(tail:*)`, `Bash(wc:*)`, `Bash(tree:*)`, `Bash(file:*)`, `Bash(stat:*)` — own comment block, "equivalent read power to Read/Grep/Glob already granted — not new capability" justification, explicitly naming what's excluded (mutating verbs) and why.
  3. **`WebSearch`, `WebFetch`** — bare native tool names (no `Bash(...)` wrapper, no prefix-matching involved). Own comment block: "already-available native tools under the session's `claude_code` preset; auto-approving removes friction for `/design:setup-ds` research + `draw-agent`/`reconstruct-agent` reference lookups; residual risk is prompt-injection-via-fetched-content, which is orthogonal to the approve/deny gate itself and unchanged by this addition."
- **Pattern**: the existing `Bash(maude:*)` entry's comment style (lines 218-228) — three more entries/groups, each with the SAME level of inline justification, not appended as bare strings.
- **Gotcha**: do NOT add a bare `find` without considering `find -delete`/`find -exec` — `find`'s own flags can mutate. Note this explicitly in the comment as an accepted residual (prefix-matching can't distinguish `find . -name '*.tmp'` from `find . -delete`), mirroring DDR-184's own honesty about the chained-command caveat. If this residual is judged unacceptable at review time, drop `find` from the list and keep the rest — flag this as the one entry most likely to get cut in review.
- **Validate**: `bun test apps/studio/test/acp-session-allowed-tools.test.ts` (will fail until Task 6 updates it — expected, sequence-dependent).

### Task 6: UPDATE `apps/studio/test/acp-session-allowed-tools.test.ts`

- **Do**: Update the `'the ONLY Bash rule is prefix-scoped to maude — never a bare/un-scoped Bash'` test to assert the new fixed set (`Bash(maude:*)`, `Bash(agent-browser:*)`, + the Task 5 fs list) instead of the old single-entry array — as an explicit, visible, reviewed change, not a silent loosening. Keep it asserting rejection of anything NOT on the fixed list (still fails if `rm`/`curl`/`npx`/a bare `Bash`/`Bash(*)` ever appears). Consider renaming the test description off "the ONLY Bash rule" (now three rules) to something like "the Bash rules are exactly this closed set." Also extend the existing `'the canvas-editing file tools are all present'` test (or add a sibling) to assert `'WebSearch'` and `'WebFetch'` are present in `MAUDE_DEFAULT_ALLOWED_TOOLS`.
- **Pattern**: the existing test's own structure (`apps/studio/test/acp-session-allowed-tools.test.ts:71-76`).
- **Validate**: `bun test apps/studio/test/acp-session-allowed-tools.test.ts` — green, and manually confirm the updated assertion still fails if you temporarily add `'Bash(rm:*)'` to the source list (proves the guard still guards).

### Task 7: CREATE `apps/studio/bin/_curl-local.test.mjs`

- **Do**: Mirror `cli/lib/fetch-asset.test.mjs`'s structure. Cover: a literal loopback IP (`127.0.0.1`) accepted; `localhost` accepted (real DNS lookup, not string match); a real non-loopback public hostname rejected without invoking curl; a mocked/stubbed multi-record DNS response where one record is loopback and one is not → rejected (proves the "every record" check, not "first record").
- **Pattern**: `cli/lib/fetch-asset.test.mjs`.
- **Validate**: `bun test apps/studio/bin/_curl-local.test.mjs`.

### Task 8: RECORD DDR-185

- **Do**: `.ai/decisions/DDR-185-acp-agent-browser-curl-local-websearch-and-readonly-fs-allowlist.md` — document the decision using this plan's Design Decisions section as the source: the wire-boundary finding that ruled out `PreToolUse` hooks, the debate record (verdicts + why the majority was overturned), the FOUR-way split (`agent-browser` named-tool trust-tier reasoning vs. `curl` dedicated-verb reasoning vs. fs-list equivalent-power reasoning vs. `WebSearch`/`WebFetch` native-tool/prompt-injection-is-orthogonal reasoning), the concrete `motion-critic.md`/`edit.md` evidence that motivated the `agent-browser` track, and the alternatives rejected (including "route agent-browser through new maude verbs instead" — rejected for this pass because some call sites are ad-hoc/dynamic `eval` expressions that don't fit a fixed verb; flag as a possible future DDR-062-consistency cleanup). Link DDR-184/179/180/054/144/062. **Re-confirm DDR-185 is still the next free number immediately before this commit** (numbering races on shared `main` — check `.ai/decisions/` + `git status` for uncommitted DDR files again, not just at planning time).
- **Pattern**: `.ai/decisions/DDR-184-*.md`'s structure (Context / Decision / Consequences / Alternatives rejected / Revisit when / Linked).
- **Validate**: `.ai/decisions/README.md` index updated in the same commit (per this repo's convention — check how prior DDR commits update it).

### Task 9: UPDATE `apps/studio/client/panels/ChatPanel.jsx`

- **Do**: Add `onPermissionRequest` and `onElicitationRequest` props to `ChatPanel`'s signature (~line 1724-1734), threaded through the same `cbRef`-pattern as `onBusyChange`/`onFinished` (~lines 1822-1825). Fire `cbRef.current.onPermissionRequest?.()` / `onElicitationRequest?.()` from inside the existing `conn.onPermission(setPendingPermissions)` / `conn.onElicitation(setPendingElicitations)` effects (~lines 1624, 1633) — but only when a **genuinely new** request arrives (compare the incoming list's ids against the previous state, e.g. inside the setter's updater function), not on every resolution/removal re-render.
- **Pattern**: `onBusyChange`/`onFinished`'s existing `cbRef` wiring (lines 1822-1880).
- **Gotcha**: `setPendingPermissions`/`setPendingElicitations` fire on BOTH new arrivals AND removals (a request resolving/timing out also updates the list) — the "new request" diff must be computed correctly or the notification will double-fire on every permission-prompt dismissal too.
- **Validate**: manually trigger a permission prompt in a live session (see Task 12) and confirm the new callback fires exactly once per new prompt, not on dismissal.

### Task 10: UPDATE `apps/studio/client/app.jsx`

- **Do**: Add a `handleAssistantAttention` callback mirroring `handleAssistantFinished` (~lines 8401-8412) — same `document.hidden`/`assistantOpenRef` gating, same best-effort try/catch, distinct copy (e.g. `'Maude needs your input'` / body naming permission-vs-question if easy to distinguish, otherwise one generic body). Wire it as `onPermissionRequest={handleAssistantAttention}` and `onElicitationRequest={handleAssistantAttention}` on **both** `<ChatPanel>` render sites (~lines 12366-12374 and 12434-12442 — left dock and right dock).
- **Pattern**: `handleAssistantFinished` (lines 8401-8412).
- **Gotcha**: both render sites must get identical wiring — DDR-184's own `ModeBanner` fix already had to touch both sites for the same reason; don't repeat a "forgot the second dock" bug.
- **Validate**: manual live-verify (Task 12).

### Task 11: Rebuild the committed client bundle

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, then `git status apps/studio/dist/` before and after to confirm only the intended bundle files changed. Commit `dist/client.bundle.js` + `dist/styles.css` in the same change as Tasks 9-10, per CLAUDE.md's explicit rule (uncommitted-source-only client changes ship broken).
- **Pattern**: CLAUDE.md § "In-app What's New feed" rebuild rule.
- **Validate**: `git diff --stat apps/studio/dist/` shows the expected files; re-run `bun test` in `apps/studio` afterward and re-check `git status apps/studio/dist/` per the "bun test has been observed clobbering dist/" caution in CLAUDE.md.

### Task 12: Verify the packaged desktop app, not just `tauri dev`

- **Do**: Per [DDR-177](../decisions/DDR-177-desktop-self-contained-runtime-and-bundle-completeness-gate.md), the new `curl-local` verb is a runtime-spawned `maude design <verb>` helper and must work inside the packaged `.app` with no `node`/`bun` on PATH. Run `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` after a real `tauri build`, confirming `curl-local` passes alongside the existing verbs.
- **Pattern**: DDR-177's own smoke-gate requirement for any new `maude design <verb>`.
- **Validate**: the smoke script exits 0 with `curl-local` in its coverage.

---

## Validation

Run these commands to confirm zero regressions:

1. **Tests**: `cd apps/studio && bun test` (full suite — the ACP allowlist/notification tests are new/changed, but a full run catches cross-file breakage)
2. **CLI**: `node cli/bin/maude.mjs design curl-local http://127.0.0.1:1/x` (or repo-equivalent) exercises the new verb end-to-end
3. **Security fan-out (mandatory, not optional)**: spawn `security-auditor` + `ethical-hacker` over the full diff — matches the standing requirement for every ACP-permission-surface DDR (179, 180, 184). Do not consider Task A "done" without this, per this plan's own Design Decisions section.
4. **Manual, native app** (per the `feedback_native_app_verification_ceiling` precedent — this feature has no cross-platform UI scenario surface; `design:chat` is native-desktop-only): open the real bundled `.app`, start an ACP session, and confirm — (a) running `/design:edit` with motion feedback (or directly asking the model to run `agent-browser eval "matchMedia('(prefers-reduced-motion: reduce)').matches"`) executes with no prompt; (b) `curl localhost:<port>` via the model resolves through `curl-local` with no prompt; (c) `ls`/`cat` in the project folder run with no prompt; (d) asking the model to search the web for something (or running `/design:setup-ds` far enough to reach Stage 2 research) executes `WebSearch`/`WebFetch` with no prompt; (e) a raw `curl` to a non-local host, and an `agent-browser navigate` to a non-local host, still prompt normally; (f) triggering a permission prompt while the Maude window is unfocused/hidden produces a real OS notification; (g) triggering an AskUserQuestion the same way does too; (h) dismissing/resolving a prompt does NOT re-fire the notification.
5. **Desktop bundle completeness**: Task 12's `check-bundle-completeness.mjs --smoke` on a real `tauri build` output.

No cross-platform `scenario-runner`/`design-system-guard`/`a11y-auditor` fan-out — this feature has no new visual surface and `platforms: ["web-desktop"]` is the only configured platform, itself not really applicable (`design:chat` doesn't run on the plain web path in a materially different way for this change, and the panel itself is unchanged visually).

---

## Scenario Coverage (UI tasks)

Not applicable — no new UI surface (the permission/elicitation cards are unchanged visually; this adds a CLI verb and a notification side-effect only). No `.ai/scenarios/` entry needed.

---

## Acceptance Criteria

- [x] All 12 tasks completed
- [x] `/flow:utils-verify`-equivalent checks passed after each task (bundling + targeted test runs; not the literal subagent, but the same static+test coverage)
- [x] `bun test` green in `apps/studio` (3034 pass / 5 skip / 0 fail, full suite, final run)
- [x] `security-auditor` + `ethical-hacker` fan-out: 0 blockers — took **three rounds** to actually reach 0 (see Retro below); final round found nothing further
- [x] DDR-185 recorded (number re-confirmed free immediately before commit) and `.ai/decisions/README.md` index updated
- [x] `apps/studio/dist/client.bundle.js` + `styles.css` rebuilt `--release` and committed (picked up automatically by a concurrent session's own rebuild once the source was already committed; verified the committed bundle reflects every source change before relying on that)
- [x] `apps/desktop/scripts/check-bundle-completeness.mjs --smoke` green with `curl-local` + `agent-browser-safe` both covered, 0 new npm deps
- [ ] Manual native-app verification (Validation §4) — **NOT performed**. This requires the user to dogfood the real packaged `.app`; flagging explicitly rather than claiming it, per this repo's own "native-app verification ceiling" convention.
- [x] No DDR-worthy decision left unrecorded beyond DDR-185 itself (three rounds of addenda, all in the same DDR)
- [x] Code follows project conventions (comment discipline on the allowlist, `.sh`-shim-over-`.mjs` verb pattern), no regressions — biome clean, full suite green

## Retro

- **What worked**: treating "mandatory security fan-out" as genuinely mandatory, not a formality — running it, reading the findings carefully, and re-running it AGAIN after each fix (rather than fixing once and declaring victory) is what actually caught rounds 2 and 3. Each round's findings were real, live-reproducible exploits, not theoretical nitpicks — the fan-out earned its cost every time.
- **What didn't work / should change next time**: my own initial designs (round 1's `Bash(agent-browser:*)` grant, round 1's curl-local blocklist, round 2's agent-browser-safe flag-blocklist) all shared one mistake — I validated a wrapper's SAFETY at the layer I personally wrote code for (argv parsing) and never independently verified the WRAPPED BINARY's own behavior against my claims. `agent-browser --help` had `--allowed-domains` explicitly documented as restricting "navigation," not "network egress" — that distinction was sitting in the tool's own docs the whole time and I didn't read it closely enough on the first two passes.
- **The recurring root cause across all three rounds**: enumerating "known-dangerous" surface (flags, subcommands) against a THIRD-PARTY tool's own evolving grammar is fundamentally a losing game — you find bypasses one at a time, forever. The fix that actually held (round 2's redesign to a Maude-owned semantic vocabulary for curl-local, and round 3's arity-only model + `eval` removal for agent-browser-safe) was the one that ELIMINATED the bypass CLASS by construction rather than patching instances. Next time: reach for "own the interface, don't parse the wrapped tool's interface" as the DEFAULT design for any new `maude design <verb>` wrapper around a third-party CLI, not as a fallback after two rounds of bypasses.
- **Process note for `/flow:plan` next time**: this plan's own divergent debate (BUILDER/SHIPPER/BREAKER) discussed the `PreToolUse` hook vs. allowlist tradeoff at length but never surfaced "what does the wrapped binary's OWN `--help` say" as a required research step before locking a design. Worth adding to the debate-protocol's retrieval-grounding step for any future wrapper-around-a-CLI decision.
- **Mid-flight scope change handled well**: the user's clarification ("hlavně agent-browser volání ve setup-ds/edit/new") after the plan was already written led to a real, well-justified pivot (from generic curl/fs-only to agent-browser as the primary target) rather than a rigid "the plan says X" adherence — worth continuing to treat plans as living documents mid-execute when the user sharpens the actual ask.
- **Shared-tree discipline held up**: staging only owned files, using `git restore --staged` (reversible) instead of touching concurrent sessions' staged work, and re-syncing `dist/` after every `bun test` clobber — all worked as intended across a genuinely busy shared `main` with at least one other active session throughout.
