# Feature: ACP session always uses Maude's bundled `maude` CLI + `design`/`flow` plugins — never disk-installed versions

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Maude Desktop bundles a version-matched `maude` CLI (compiled fresh from `cli/bin/maude.mjs`) and the `design`/`flow` plugin markdown trees INTO the app at every release build — both sourced from the exact same working-tree commit as the rest of the app (`apps/desktop/scripts/build-cli-binary.mjs` + `stage-resources.mjs`). Two pieces of currently-shipped/mid-flight logic nonetheless let a **disk-installed** version win over that bundled copy inside the ACP (Agent Client Protocol) chat panel:

1. `apps/studio/acp/plugin-bootstrap.ts`'s `computeSessionPlugins()` (DDR-143 Decision 3, committed) **skips** injecting the bundled `design`/`flow` plugin dir if `scanPlugins()` reports the plugin already installed/enabled on the user's disk (`~/.claude/plugins/installed_plugins.json` or `settings.json` `enabledPlugins`).
2. `apps/desktop/src-tauri/src/sidecar.rs`'s `spawn_server()` (DDR-166 T0b, currently **uncommitted**, mid-flight from a concurrent session) **appends** the bundled `maude` CLI's narrow `bin-link/` PATH directory to the sidecar child's PATH, deliberately so a user's own newer global `maude` (e.g. `npm i -g @1agh/maude`) wins PATH-lookup precedence.

The repo owner's conclusion: since every Maude Desktop release ships an internally-consistent, release-matched `maude` CLI + plugin set, the ACP session should **always** use that bundled/internal version — never defer to, or even check, what's separately installed on disk. **This applies only inside Maude Desktop's own ACP chat panel.** A power user running Claude Code directly in their own terminal (a wholly separate session, not spawned by Maude Desktop) still manages their own plugin/CLI versions themselves — that context is untouched.

**Explicitly out of scope / not to be confused:** the Anthropic **`claude`** CLI (the actual agent runtime `probe.ts`'s `resolveClaudePath()` resolves) is a *completely separate axis*, governed by DDR-123/DDR-129 ("always drive the user's own `claude`, for subscription-billing/ToS reasons — never bundle/embed it"). This feature is only about Maude's *own* `maude` CLI and the `design`/`flow` plugin bundles. Do not touch `probe.ts`'s `resolveClaudePath()`/`resolveAdapterEntry()` core logic.

## User Story

As a Maude Desktop user, I want the chat panel to always run the exact CLI and plugin commands that shipped with my installed app version, so that `/design:*` commands behave consistently with what the release notes describe — regardless of whatever else I may have separately installed via npm or the Claude Code plugin marketplace.

## Problem

Today, a power user who has an older globally-installed `maude` on PATH, or an older marketplace-installed `design@maude`, will silently get **that** stale version inside Maude Desktop's ACP chat — even though the app just shipped a newer, matched bundle. This is backwards: the bundled copy is the one guaranteed to match the plugin markdown's expectations of the CLI's flags/behavior (DDR-062's `maude design <verb>` convention), and the one the release was actually tested against.

## Solution

Flip both gates so bundled always wins, unconditionally, inside the ACP-spawned session — while closing the one real risk that flip introduces (a power user who *also* has `design@maude` enabled at the `~/.claude` **user** level would otherwise get it loaded from two sources at once, since `bridge.ts` unconditionally keeps `settingSources: ['user']` in scope for unrelated reasons).

This plan is grounded in a divergent debate (BUILDER/SHIPPER/BREAKER seats, reduce-tier) run before drafting tasks. Synthesis: adopt SHIPPER's minimal-diff shape (flip the two gates, no new toggles, no scan-based suppression heuristics) **plus** BUILDER's one structural fix for the double-registration risk BREAKER flagged as blocking — because that fix is now confirmed (not just inferred) against the actual installed adapter/SDK source, not merely their `.d.ts` doc comments:

- `node_modules/.pnpm/@agentclientprotocol+claude-agent-acp@0.57.0.../dist/acp-agent.js:2803` spreads `...userProvidedOptions` (which carries `_meta.claudeCode.options`) into the SDK's `query()` options, and `settings` is not among the fields the adapter overrides afterward (only `cwd`/`mcpServers`/`env`/etc. are) — so `_meta.claudeCode.options.settings` reaches the SDK untouched, exactly like `plugins` already does per DDR-143.
- The installed SDK's `sdk.d.ts:1831` documents `options.settings` as loading into the **"flag settings"** layer, "highest priority among user-controlled settings" (precedence `user < project < local < flag < policy`).
- `sdk.d.ts:5193`'s `Settings.enabledPlugins` doc comment gives the *exact* worked example: "to disable a plugin that project settings enable, set it to `false` in `.claude/settings.local.json`" — the flag tier does the same thing one level higher. Setting `enabledPlugins: { 'design@maude': false }` in `options.settings` will deterministically override a `true` set at the user tier.

BREAKER's other concern — that always-bundled would break this repo's own "test local plugin edits via Maude Desktop's ACP panel" dogfooding path — turns out to already be solved by existing infrastructure: `MAUDE_NO_PLUGIN_BOOTSTRAP=1` (the existing hard opt-out in `isNativePluginContext()`) reverts to the pre-DDR-143 detect-and-guide posture entirely, letting a contributor's own marketplace-pointed-at-working-tree install load natively instead. It just needs a documented pointer so it isn't a silent trap (Task 8).

## Metadata

- **Type**: Enhancement (policy reversal on two already-shipped/mid-flight decisions)
- **Complexity**: High — cross-language (Rust + TypeScript), touches a security-reviewed surface (ACP auto-approve envelope, DDR-125/DDR-144), no new dependencies
- **App/Package**: `apps/desktop` (Rust sidecar) + `apps/studio` (TS ACP bridge/readiness) — cross-cutting, hence a root-level plan
- **Affected Systems**: ACP chat panel plugin auto-bootstrap (DDR-143), desktop sidecar PATH construction (DDR-166 T0b), readiness UI
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message when consuming this plan during `/flow:execute`.

- `apps/studio/acp/plugin-bootstrap.ts` (full file, 116 lines) — Why: `computeSessionPlugins()` (lines 66-79) holds the scan-gated skip to remove; `isNativePluginContext()` (93-98) and its `MAUDE_NO_PLUGIN_BOOTSTRAP` opt-out (94) are unchanged but need a docs pointer.
- `apps/desktop/src-tauri/src/sidecar.rs` (lines 78-215, especially 139-166) — Why: `stage_bundled_cli_link()` (78-113, unchanged) + the PATH-append line inside `spawn_server()` (~156-166, uncommitted DDR-166 T0b diff) is the one-line append→prepend flip.
- `apps/studio/acp/bridge.ts` (lines 108-146) — Why: `newSessionParams()` is where `settingSources: ['user']` (138) is unconditionally set and where the new `options.settings.enabledPlugins` override must be added.
- `apps/studio/readiness.ts` (lines 240-304) — Why: the `maude` row (246-269, already correctly keys off `MAUDE_BUNDLED_CLI_PATH`, needs only a doc-comment refresh) and the `plugins` row (271-304, `designAutoloaded` at line 282 has the `&& !scan.design` condition to drop).
- `apps/studio/test/acp-plugin-bootstrap.test.ts` (89 lines) — Why: the "already-installed → no-op" test cases assert the OLD behavior; must flip to assert unconditional injection.
- `apps/studio/test/readiness.test.ts` — Why: contains a "design already installed → keeps the 'is installed' detail" case (~line 129 per research) that must flip to expect "Auto-loaded" framing.
- `apps/studio/test/acp-session-plugins.test.ts` (132 lines) — Why: already has an "upgrade guard" section statically grepping the adapter/SDK for the `_meta.claudeCode.options` spread contract (DDR-143 guard #7 precedent) — extend it with the same style of guard for `options.settings`/`enabledPlugins`, plus a new assertion that `newSessionParams()` emits the override when plugins are injected.
- `.ai/decisions/DDR-143-acp-session-scoped-plugin-auto-bootstrap.md` — Why: Decision 3 ("no-op for power users") is what this feature supersedes in part; needs a "superseded in part by DDR-\<N\>" pointer per this repo's own convention.
- `.ai/decisions/DDR-166-zero-terminal-acp-cold-start.md` — Why: Decision 1 (append-not-prepend rationale) is what this feature supersedes in part. **Note:** this DDR's T0b code is currently uncommitted, owned by a concurrent session per `.ai/state/STATE.md`'s note about `feature-unified-settings-modal` WIP sharing the tree — coordinate rather than clobber (see Task 2 gotcha).
- `CLAUDE.md` § "Working on plugin internals locally" — Why: the documented local-plugin-dev recipe this feature's behavior interacts with (Task 8).

### Files to Create

- `.ai/decisions/DDR-167-acp-bundled-cli-and-plugins-always-win.md` — records this policy reversal (exact number TBD at execute time — verify against `.ai/decisions/README.md` immediately before writing, per memory `project_ddr_numbering_races_on_shared_main`; DDR-166 is highest as of this plan's authoring).

### Documentation

- None external — this is a self-contained architecture decision internal to the repo.

### Patterns to Follow

The existing "adapter-internal contract fragility" guard in `acp-session-plugins.test.ts` (DDR-143 guard #7) is the pattern to mirror for the new `options.settings` mechanism: a static grep-based presence-test against the actual installed `node_modules/.pnpm/@agentclientprotocol+claude-agent-acp@*/dist/acp-agent.js` and the SDK's `sdk.d.ts`, so a future adapter/SDK bump that silently drops the `settings` pass-through fails loud instead of quietly reopening the double-registration hole.

Existing `SessionPluginDeps`/`computeSessionPlugins()` shape (plugin-bootstrap.ts) and the `add()` helper closure are the pattern for how the plugin list is built — keep the same shape, just delete the gate rather than restructuring.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `.ai/decisions/DDR-167-acp-bundled-cli-and-plugins-always-win.md`

- **Do**: Record the decision: Maude Desktop's ACP session always uses the bundled `maude` CLI + `design`/`flow` plugins, ignoring disk state. Structure per this repo's DDR convention (Status/Relates/Context/Decision/Consequences). Cover: (a) rationale — release-locked consistency between plugin markdown and CLI behavior beats "respect what's on disk"; (b) the two mechanism changes (PATH prepend, unconditional injection); (c) the `options.settings.enabledPlugins:false` structural double-registration guard, with the exact `acp-agent.js`/`sdk.d.ts` line citations from this plan's Solution section as verified evidence (not a speculative claim); (d) the accepted residual — prepending the bin-link dir means it now outranks even a locked-down/enterprise-pinned `maude` on PATH within the sidecar's own child-process env (narrow: affects only Maude's own CLI dispatch inside its own sidecar, not the user's system-wide PATH); (e) the `MAUDE_NO_PLUGIN_BOOTSTRAP=1` pointer for the local-plugin-dev-via-ACP-panel case (Task 8).
- **Pattern**: Mirror DDR-166's own "Supersedes in part" framing for DDR-123/DDR-128.
- **Gotcha**: Verify the DDR number is still free (check both `.ai/decisions/` dir AND any uncommitted README index diff) immediately before writing AND again before the closing commit — this tree has concurrent sessions active (memory `project_ddr_numbering_races_on_shared_main`).
- **Validate**: File exists, cross-links resolve, `.ai/decisions/README.md` gets an index entry.

### Task 2: UPDATE `apps/desktop/src-tauri/src/sidecar.rs` — prepend instead of append the bundled CLI PATH entry

- **Do**: In `spawn_server()`, change the PATH-construction line from `path = format!("{path}:{}", link.parent()...)` to prepend form: `path = format!("{}:{path}", link.parent()...)`. Update the adjacent doc comment (currently asserts "a user's own newer global `maude` ... still wins on precedence — this is a floor, not a forced ceiling") to state the new intent (bundled is now authoritative — a ceiling, not a floor) and cross-reference DDR-167.
- **Pattern**: `stage_bundled_cli_link()` itself (the narrow single-binary directory) is untouched — the debate confirmed the security boundary DDR-166 closed (shadow-directory risk) is about directory *breadth*, not PATH *position*; prepending a directory containing only the `maude` symlink adds no new shadow surface.
- **Gotcha**: This file has **uncommitted, mid-flight changes from a concurrent session** (DDR-166 T0b) per `.ai/state/STATE.md`. Diff narrowly — touch only this one `format!` line + its comment, re-`git diff` before editing to confirm the concurrent session hasn't since changed this exact block, and do not blanket-revert or restage unrelated hunks in this file.
- **Validate**: `cargo check` in `apps/desktop/src-tauri`; manual `pnpm dev:desktop` boot confirms `MAUDE_BUNDLED_CLI_PATH` is set and a shell inside the sidecar's own spawned children resolves `maude` to the bundled symlink even when a different `maude` is earlier in the login-shell PATH.

### Task 3: UPDATE `apps/studio/acp/plugin-bootstrap.ts` — remove the scan-gated skip

- **Do**: In `computeSessionPlugins()`, delete the `alreadyPresent` check inside `add()` — inject whenever `dir` resolves and `deps.native` is true, full stop. Drop the now-dead `scan: Pick<PluginScan, 'design' | 'flow'>` field from `SessionPluginDeps`. In `resolveSessionPlugins()`, stop calling `scanPlugins()` for injection purposes (readiness.ts keeps its own independent call for its own row, per Task 5 — unaffected).
- **Pattern**: Keep the `add()` closure shape and the `skipMcpDiscovery: true` field; keep the flow-disabled comment/dead-but-wired `flowDir`/scan-for-flow structure exactly as-is (still "OFF for now", unrelated to this change).
- **Gotcha**: This directly reverses DDR-143 Decision 3's stated intent ("no-op for power users, hard"). That reversal is deliberate and is what DDR-167 (Task 1) documents — don't treat the old comments as a signal to keep the gate.
- **Validate**: `apps/studio/test/acp-plugin-bootstrap.test.ts` updated in Task 6 passes.

### Task 4: UPDATE `apps/studio/acp/bridge.ts` — structural double-registration guard

- **Do**: In `newSessionParams()`, when `plugins` is non-empty, also set `options.settings = { enabledPlugins: { 'design@maude': false } }` (keyed to whichever plugin ids are actually being injected — currently only `design@maude`; write it so re-enabling `flow@maude` injection later is a one-line addition, matching this file's existing "one-line change" style for the flow toggle). This forces off any natively-loaded user-level copy of the same plugin id via the SDK's documented `flag > user` settings precedence, so the bundled copy injected via `options.plugins` is the *only* one that loads — closing the double-registration/duplicate-MCP-spawn/duplicate-hook risk BREAKER flagged.
- **Pattern**: `settingSources: ['user']` (line 138) stays exactly as-is — this is additive, not a replacement of the DDR-144 guard.
- **Gotcha**: Do NOT set this unconditionally regardless of `plugins` — only when Maude is actually injecting a bundled copy of that id (keeps the override meaningless/absent on the npm/web path where `plugins` is always empty, avoiding any behavior change there).
- **Validate**: New assertion in `acp-session-plugins.test.ts` (Task 6) confirms the emitted `_meta.claudeCode.options.settings.enabledPlugins['design@maude'] === false` whenever `plugins` is non-empty, and is entirely absent when `plugins` is empty (web/npm path unaffected).

### Task 5: UPDATE `apps/studio/readiness.ts` — plugins row no longer gates on disk state

- **Do**: In the `plugins` row construction, remove `&& !scan.design` from the `designAutoloaded` computation (line 282) so native context always reports `designAutoloaded = native && DESIGN_PLUGIN_DIR !== null`, regardless of `scan.design`. Update the `detail` copy so the "Auto-loaded" message no longer implicitly implies "...because you didn't already have it" — reword to something like "Bundled with this app — always active in the chat session" so it reads correctly even when `scan.design` is also true. Refresh the doc comment above the `maude` row (lines 246-255) to say PATH prepend makes this deterministic now, not a "falls through" fallback.
- **Pattern**: Keep `scan.status === 'unknown'` handling and the web-path (`native === false`) branch exactly as they are — those are unaffected (`scanPlugins()` is still called and still used for the non-native/manual-marketplace messaging path).
- **Gotcha**: Don't remove the `scanPlugins()` call from `readiness.ts` entirely — it's still needed for `scan.status`/the web-path branch and for `marketplace` detection; only the `designAutoloaded` gate condition changes.
- **Validate**: `apps/studio/test/readiness.test.ts` updated in Task 6 passes; manual `/_api/preflight` response inspection shows `status: 'present'`/"Auto-loaded" framing regardless of a pristine vs. already-marketplace-installed `~/.claude`.

### Task 6: UPDATE tests

- **Do**:
  - `apps/studio/test/acp-plugin-bootstrap.test.ts` — rewrite the "already-installed → no-op" case(s) to assert injection happens regardless of prior install state; remove `scan` from all `SessionPluginDeps` fixture objects.
  - `apps/studio/test/readiness.test.ts` — flip the "design already installed" case to expect the "Auto-loaded"/bundled-always-active framing instead of the old "keeps the installed detail" expectation.
  - `apps/studio/test/acp-session-plugins.test.ts` — add: (1) an assertion that `newSessionParams()` with a non-empty `plugins` array produces `_meta.claudeCode.options.settings.enabledPlugins['design@maude'] === false`; (2) an assertion that it's absent when `plugins` is empty; (3) extend the existing "upgrade guard" section with a grep-based presence check that the installed adapter (`node_modules/.pnpm/@agentclientprotocol+claude-agent-acp@*/dist/acp-agent.js`) still spreads `...userProvidedOptions` with `settings` NOT among the fields it overrides afterward, and that the SDK's `sdk.d.ts` still declares `Settings.enabledPlugins` — mirroring the existing `plugins`-field guard exactly.
- **Pattern**: Follow this repo's existing "upgrade guard" grep style (already in `acp-session-plugins.test.ts`) rather than inventing a new test-infra pattern.
- **Gotcha**: The adapter/SDK versions currently installed (`@agentclientprotocol/claude-agent-acp@0.57.0`, `@anthropic-ai/claude-agent-sdk@0.3.202`) have moved on from the versions DDR-143's own text cites (`0.49.0`/`0.3.185`) — this is expected version drift, not a regression; just make sure the new guard checks against whatever is actually installed, not the DDR's stale citation.
- **Validate**: `bun test apps/studio/test/acp-plugin-bootstrap.test.ts apps/studio/test/acp-session-plugins.test.ts apps/studio/test/readiness.test.ts` — all green.

### Task 7: UPDATE `.ai/decisions/DDR-143-...md` and `.ai/decisions/DDR-166-...md` — supersession pointers

- **Do**: Add a one-line "Superseded in part by DDR-167 (Decision 3 — the no-op-for-power-users gate is removed; bundled always injects)" pointer near the top of DDR-143, and a similar one-line pointer to DDR-166 ("Superseded in part by DDR-167 (Decision 1 — PATH order flips from append to prepend)"), matching the "superseded in part, not silently reinterpreted" convention DDR-166 itself used for DDR-123/DDR-128.
- **Pattern**: Exact phrasing precedent — DDR-166's own "Supersedes in part" line at the top of its file.
- **Validate**: Cross-links resolve both directions.

### Task 8: UPDATE `CLAUDE.md` (or `apps/desktop/README.md`, whichever currently documents the local-dev plugin-testing recipe) — document the `MAUDE_NO_PLUGIN_BOOTSTRAP` interaction

- **Do**: Add a short note to the "Working on plugin internals locally" section (or desktop-specific equivalent): testing your own in-flight `plugins/design`/`plugins/flow` edits through Maude Desktop's **ACP chat panel** specifically (as opposed to a separate terminal `claude` session) now requires `MAUDE_NO_PLUGIN_BOOTSTRAP=1` set when running `pnpm dev:desktop`, since the bundled copy always wins by default post-DDR-167.
- **Gotcha**: Keep it to 2-3 sentences — this is a footnote to an existing section, not a new subsection.
- **Validate**: Read-through; no broken existing instructions.

---

## Validation

Run these commands to confirm zero regressions:

1. **Rust**: `cd apps/desktop/src-tauri && cargo check`
2. **Studio tests**: `bun test` (from `apps/studio`) — full suite green, especially the three files touched in Task 6
3. **Types/lint**: project's existing `biome`/`tsc` gates, touched-files-clean per this repo's DDR-026 baseline convention
4. **Security fan-out (required — this code area has a documented history of High/Critical findings, DDR-166)**: spawn `security-auditor` + `ethical-hacker` against the diff. Specifically direct them to check: (a) the PATH append→prepend flip doesn't reopen the shadow-directory finding DDR-166 closed (directory breadth vs. position); (b) the new `options.settings.enabledPlugins` override is set entirely from Maude's own code (never derived from untrusted/served-project input), so it can't be flipped by a malicious repo; (c) always-injecting bundled plugins regardless of disk state doesn't widen the DDR-125 F2 auto-approve envelope — it changes *which copy* of an already-in-scope plugin loads, not the trust boundary itself.
5. **Native-app verification ceiling applies** (memory `feature_native_app_verification_ceiling`): a `tauri dev` boot is not sufic — verify against the actual **bundled `.app`** (`pnpm build:desktop` or equivalent) that: (a) `MAUDE_BUNDLED_CLI_PATH` wins even with a conflicting global `maude` earlier in login-shell PATH; (b) a pristine `~/.claude` still shows the plugins row as ready; (c) a `~/.claude` with `design@maude` marketplace-installed AND enabled at user level *also* shows ready, with no duplicate `/design:*` command entries visible in the chat's slash-command list (the concrete double-registration check). Use `desktop-e2e` (WebdriverIO, DOM-driven) per memory `feedback_prefer_dom_driven_e2e_not_composer_use` — not computer-use.
6. **Manual**: toggle `MAUDE_NO_PLUGIN_BOOTSTRAP=1` in a `pnpm dev:desktop` run and confirm the old detect-and-guide behavior returns (Task 8's documented escape hatch actually works).

---

## Scenario Coverage

Not applicable as a new cross-platform UI scenario — this is a backend/session-policy change with only minor readiness-row copy changes in existing UI (`ReadinessList.jsx` renders text this plan changes, but adds no new screen/flow). No new `.ai/scenarios/` entry needed. The native-app dogfood in Validation item 5 is the real verification surface for this feature.

---

## Acceptance Criteria

- [ ] All 8 tasks completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` passes overall: static (types/lint/format), tests (full suite), build
- [ ] `security-auditor` + `ethical-hacker` fan-out: 0 unresolved blockers on the PATH-precedence flip and the `enabledPlugins` override
- [ ] Bundled `.app` dogfood confirms: bundled `maude`/plugins win regardless of disk state, no duplicate `/design:*` commands when a marketplace copy also exists, `MAUDE_NO_PLUGIN_BOOTSTRAP=1` escape hatch still works
- [ ] DDR-167 written and indexed; DDR-143 + DDR-166 carry "superseded in part" pointers
- [ ] No DDR-worthy decision left unrecorded
- [ ] Code follows project conventions, no regressions
