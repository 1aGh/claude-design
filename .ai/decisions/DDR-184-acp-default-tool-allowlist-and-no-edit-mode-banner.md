# DDR-184 — ACP default tool allow-list (first-party tooling) + no-edit-mode banner

**Status:** accepted · **Date:** 2026-07-16 · **Phase:** bug-fix (issue: ACP panel default "Manual" mode blocks every edit)
**Relates:** DDR-179 (mode-driven permission gate — this COMPLEMENTS it, does not reverse it), DDR-125 (multi-chat + F2 security posture), DDR-062 (plugins reach executable logic via `maude design <verb>` — the single-Bash-rule enabler), DDR-054 (untrusted-canvas / loopback trust model)

## Context

A fresh Maude ACP chat session starts in Claude Code's `default` permission mode — displayed as **"Manual"** since Claude Code 2.1.200 ("Standard behavior, prompts for dangerous operations"). Maude sets no `permissionMode` in `newSessionParams()` and seeds no persisted mode pick, so the adapter's own default always wins. In Manual mode the adapter calls `requestPermission` for every non-pre-approved tool call: `Read` passes (no permission needed), `Bash` passes only if the user's own `~/.claude` allow-rules cover it, and **every `Edit`/`Write` raises a prompt** — which, if missed / cancelled / timed out, surfaces as the tool being "interrupted."

A user reported this out-of-box: canvas edits and `maude` helper calls kept getting blocked; even Claude-in-the-panel couldn't diagnose it (RCA: `.ai/logs/rca/issue-acp-panel-default-manual-mode-blocks-edits.md`). The design workflow's whole loop is *edit a canvas → shell out to `maude design <verb>`* — so **both edits and `maude` calls must run un-prompted by default**, while genuinely dangerous operations still gate.

This is exactly the tension DDR-179 was careful about: it retired DDR-125 F2's *blanket* auto-approve so the mode picker stays honest ("a user who wants zero interruption must explicitly select Bypass/Don't-Ask"). A blunt fix — defaulting the session to `bypassPermissions` — would reverse that and drop the interactive gate the user actually still wants for the un-listed surface.

## Decision

Three coordinated changes; **no session-mode change** (the picker stays honest, DDR-179 intact):

1. **Inject a curated `allowedTools` allow-list into every new session** (`apps/studio/acp/bridge.ts`, exported `MAUDE_DEFAULT_ALLOWED_TOOLS`, set on `_meta.claudeCode.options.allowedTools` — the same `...userProvidedOptions` spread that already carries `settingSources`/`plugins`/`settings`). The list:
   - `Read`, `Edit`, `Write`, `Glob`, `Grep`, `NotebookEdit` — the canvas-editing surface.
   - **`Bash(maude:*)`** — a *single* prefix-scoped rule that covers the entire design-helper surface, because DDR-062 routes every helper through `maude design <verb>`, and each helper's own deps (agent-browser, playwright, svgo) run as CHILD processes of that one `maude` bash call. Bash NOT starting with `maude` (`curl`, `rm`, arbitrary commands) still prompts.

   This is a **narrow complement** to DDR-179, not a reversal: the SDK's `allowedTools` auto-approves *only* the listed first-party tools; the session mode is untouched, so everything else routes through the real approve/deny gate (`requestPermission` → `PermissionPrompt`).

2. **Everything off the allow-list keeps the interactive approve/deny card** (`PermissionPrompt.jsx`, already built for DDR-179 Milestone B). No new plumbing — the allow-list just makes the card the exception (dangerous/novel tools) instead of firing on every edit. This is the "interaktivní potvrzení když po mně chce ACP použít tools které nejsou allowed" the reporter asked for.

3. **A loud top-of-thread banner when the current mode cannot edit** (`plan` / `dontAsk`) — `ChatPanel.jsx` `ModeBanner`, gated by `modeBlocksEdits` (`acp-capabilities.js`, keyed off the mode id). `plan` = "no actual tool execution"; `dontAsk` denies anything without a standing pre-approval (and the DDR-184 allow-list only pre-approves edits + `maude`, so an off-list step is silently denied). Previously the only signal was a tiny composer footnote ("Manual — you'll be asked"); a user typing "change X" in Plan mode got nothing back with no explanation. The banner offers a one-click hop to the least-privilege editing mode (Accept Edits, else Manual).

**Source of truth for the allow-list:** the `Bash(maude:*)` scope rests entirely on DDR-062 (all design executable logic is a `maude design <verb>`). `acp-session-allowed-tools.test.ts` asserts the ONLY Bash rule is `maude`-scoped (never a bare/un-scoped `Bash`) and that `cli/commands/design.mjs` still dispatches via `BIN_VERBS` / `maude design <verb>` — so a future helper NOT reached through `maude` fails loudly instead of silently prompting the user mid-workflow.

## Consequences

- **The out-of-box design loop just works** — edit a canvas + call `maude` helpers with zero prompts, on new AND resumed sessions (both go through `newSessionParams`). Ships server-side + in the committed client bundle, so it applies automatically on version update (desktop auto-updater per DDR-126); no user configuration, no localStorage migration.
- **Accepted residual (documented, not hidden):** auto-approving `Edit`/`Write` means injected *content* Claude reads (e.g. hostile text in a served canvas — DDR-054 treats the project as untrusted) could edit files without a prompt. Bounded because: edits land in the served project (already the edit target) and are reversible via the `_history/` snapshot stack; and `Bash` is scoped to `maude:*` only, so **arbitrary command execution still prompts**. `settingSources: ['user']` (DDR-144) already blocks the project-config injection vector. This is a materially tighter surface than the blanket bypass DDR-179 killed.
- **Bash prefix-match caveat:** `Bash(maude:*)` relies on Claude Code's own command-splitting for chained commands (`maude … && rm …`). Claude Code splits on shell operators and evaluates each segment, but this is the adapter's behavior, not ours — flagged for the contract test to watch on adapter bumps.
- **DDR-179 stays honest:** the mode picker is untouched; a security-conscious user can still dial *up* to Manual (and get a prompt on every edit) — the allow-list is what a session with the *default* mode auto-approves, layered under, not over, the mode policy.

## Alternatives rejected

- **Default the mode to `bypassPermissions`** — fully un-prompts everything incl. arbitrary Bash, but reverses DDR-179 + DDR-125 F2 and drops the interactive gate the reporter explicitly wanted for un-allowed tools. Lower effort, worse posture. Kept only as the documented fallback if zero-prompt-ever is ever required.
- **Default to `acceptEdits`** — auto-accepts edits but still prompts every `Bash(maude …)`, so the panel would interrupt on every helper call. Fails the "bash taky musí fungovat default" requirement.
- **`acceptEdits` + a broad Bash allow-list of common commands** — still prompts for the generic `ls`/`cat`/`node` Claude runs, and grows an unmaintainable list. The `Bash(maude:*)` single rule + DDR-062 is strictly tighter and self-maintaining.

## Revisit when

- The adapter changes how `_meta.claudeCode.options.allowedTools` is forwarded, or the `Bash(prefix:*)` matcher semantics change (the contract test guards both directions).
- A design helper ships that is NOT reached via `maude design <verb>` (the source-of-truth test will fail first).
- The `Edit`/`Write` auto-approve residual is judged too broad for a future multi-user / hub-reachable ACP surface (DDR-125's "untrusted to peers" line) — at which point the allow-list should narrow or gate edits behind the prompt again.

## Linked

- RCA: `.ai/logs/rca/issue-acp-panel-default-manual-mode-blocks-edits.md`
- DDR-179 (the honest-mode-picker decision this layers under), DDR-062 (single-Bash-rule enabler), DDR-054 / DDR-144 (trust model + settingSources narrowing)
