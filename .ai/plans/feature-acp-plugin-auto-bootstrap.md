# Feature: ACP plugin auto-bootstrap — zero-install design (+flow) in the Maude Desktop chat

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Today a Maude Desktop user who opens the app and tries to use the ACP chat panel to drive `/design:*` gets a red "Maude plugins in Claude Code" row unless they've already run the manual dance in a **separate** Claude Code session: `npm i -g @1agh/maude` → `/plugin marketplace add 1aGh/maude` → `/plugin install design@maude` + `/plugin install flow@maude` → `/reload-plugins`. That's three surfaces (a terminal, three slash commands, plus init) the desktop app can only *detect and describe* — never perform (DDR-128 "detect-and-guide, never auto-install").

This feature makes **Claude Code installed** the single hard prerequisite for the Maude Desktop chat. When a non-power-user opens the app, the ACP-spawned `claude` session gets the `design` (and `flow`) plugin **auto-loaded, session-scoped**, so `/design:new`, `/design:edit`, `/design:critic`, `/flow:plan`, … resolve immediately with zero install. Power users who already installed the plugin via the marketplace get a **no-op** (detection short-circuits the injection, so no double-load / version-skew). The existing readiness "check" collapses from a red install-wall to a short "is `claude` reachable + is the adapter bundled" probe.

The manual marketplace/CLI path stays fully documented for power users and for the web `maude design serve` flow — this feature is the **fallback** for users who don't have those dependencies, not a replacement.

## User Story

As a Maude Desktop user with only Claude Code installed, I want to open the app, finish onboarding, and immediately use `/design:*` in the chat panel — without installing the maude CLI, adding a marketplace, or installing plugins by hand — so that the app "just works" out of the box, while power users who already set everything up see no change.

## Problem

- **The plugin's command/skill/agent files are not reachable by the ACP-spawned `claude`.** They surface today **only** by environment inheritance: the adapter runs the user's `claude`, which reads `~/.claude/` — so `/design:*` appears **iff** the user already installed `design@maude` globally. (ACP research: `apps/studio/acp/` has zero plugin/marketplace references; the whole coupling is `HOME`/`CLAUDE_CONFIG_DIR` inheritance.)
- **DDR-128 declared plugin install "structurally out of reach"** — but on the false premise that the only levers are mutating `~/.claude` or typing `/plugin` slash commands. Maude fully controls the `claude` spawn via the ACP adapter, and the installed Agent SDK exposes a **session-scoped, non-mutating** plugin-load option DDR-128 never considered.
- **The plugin files aren't bundled anywhere shippable.** Desktop stages only `plugins/design/templates` (`stage-resources.mjs:79-80`); the npm tarball ships only `plugins/design/templates` + `dependencies.json` (DDR-044 minimal surface). Nothing on an end-user machine carries `plugins/design/{commands,agents,skills,hooks,.claude-plugin}`.
- **The readiness check is a wall, not a helper.** `readiness.ts` `scanPlugins()` reads `~/.claude/plugins/{known_marketplaces,installed_plugins}.json` and, when absent, emits a copy-paste remediation string — it can only *tell* the user to install, never do it. This is the "much shorter after auto-bootstrap" surface.

## Solution

Inject the plugin(s) into the ACP session through the **same `_meta` seam already used for the bootstrap brief** — no `~/.claude` writes, no `npm`, no network, no `/plugin` commands.

- **A. Session-scoped local plugin load.** In `apps/studio/acp/bridge.ts` `newSessionParams()`, add `_meta.claudeCode.options.plugins = [{ type: 'local', path: <DESIGN_PLUGIN_DIR> }, { type: 'local', path: <FLOW_PLUGIN_DIR> }]`. The adapter reads `_meta.claudeCode.options` (`acp-agent.js:2302`) and spreads it into the Agent SDK `query()` (`acp-agent.js:2329-2333`); the SDK (`@anthropic-ai/claude-agent-sdk@0.3.185`) supports `plugins?: SdkPluginConfig[]` where `SdkPluginConfig = { type: 'local'; path: string; skipMcpDiscovery?: boolean }` (`sdk.d.ts:1683`, `:3766`, doc: *"Plugins provide custom commands, agents, skills, and hooks"*). This is the identical wire path the context-hardening plan proved for `_meta.systemPrompt.append`.
- **B. No-op gate for power users.** Reuse `readiness.ts` `scanPlugins()` (or a small extract of it). If `design@maude`/`flow@maude` are already in `installed_plugins.json`, **skip injection for that plugin** — the natively-loaded copy wins and there's no double-registration. (The adapter's `settingSources` already includes `user`, so a user who enabled the plugin in `~/.claude/settings.json` also loads it natively — a second natural no-op.)
- **C. Bundle the plugin tree.** Extend `apps/desktop/scripts/stage-resources.mjs` to stage the full `plugins/design/` and `plugins/flow/` (`commands/`, `agents/`, `skills/`, `hooks/`, `.claude-plugin/plugin.json`) into `src-tauri/resources/`, with a build-time fail-loud assertion (the DDR-129 pattern already used for the adapter closure). Copied from the repo tree at the release commit → ships at the release version automatically (no new parity source).
- **D. Path resolution.** Add `DESIGN_PLUGIN_DIR` + `FLOW_PLUGIN_DIR` to `apps/studio/paths.ts`, resolved from `DEV_SERVER_ROOT` per DDR-045 (must resolve in dev tree, npm global, `bun --compile` binary, **and** the desktop `Resources/` layout via `MAUDE_DEV_SERVER_ROOT`). Never compute `dirname(fileURLToPath(import.meta.url))` locally.
- **E. Shorten the check + brief.** Flip the `readiness.ts` `plugins` row to satisfied when injection is active; update the ChatPanel `NotConnected` explainer + onboarding `AiReadiness` strip copy; upgrade `bootstrap-brief.ts:36` from "prefer `/design:*` *when available*" to stating the commands **are** available in this session.

### Non-negotiable guards

1. **Subscription / ToS (DDR-123):** do NOT touch `scrubAgentEnv` (`acp/env.ts`) or the `CLAUDE_CODE_EXECUTABLE` pin (`bridge.ts:191`). Injecting a `plugins` option keeps Maude an ACP client driving the user's own `claude` — not an SDK-with-token embedder. Add zero Anthropic-auth env.
2. **No `~/.claude` mutation, no package managers, no network (DDR-126/128):** the sanctioned mechanism is session-scoped `_meta` injection + a bundled local dir. Never write Claude Code's registry files, never run `npm`/`/plugin`.
3. **No-op for power users (hard):** gate every injected plugin on the `scanPlugins()` result. Installed-already ⇒ skip that plugin's injection. Prevents duplicate command/skill registration and version skew (bundled vs marketplace copy at different versions).
4. **Native-only scope (DDR-119/123):** inject only when `isNativeApp()` / the desktop bundle is in play. The web `maude design serve` path has no bundled plugin files (DDR-044) and its users have a terminal. (Revisit if the "Desktop + web" scope option is chosen — see § Decisions.)
5. **Auto-approve envelope (DDR-125 F2):** an auto-loaded command set runs under the bridge's auto-approving agent (`bridge.ts:252-261`) — commands that shell out (`maude design <verb>`) / write files execute with no user gate. Keep this strictly within the existing loopback / native / own-project envelope. **Do NOT let the bundled plugin leak into any hub-served or multi-user ACP path** without the approve/deny UI first.
6. **`settingSources` breadth (leak guard):** the adapter defaults to `settingSources: ["user","project","local"]`, so the spawned `claude` already reads the **served downstream repo's** `.claude/` — a downstream repo could enable arbitrary plugins/hooks in the auto-approving session. This pre-exists this feature, but the plan must not widen it; flag in the security section and consider whether injection should narrow `settingSources` for the bootstrap case.
7. **Adapter-internal contract fragility:** `_meta.claudeCode.options` forwarding is undocumented and pinned to `claude-agent-acp@0.49.x` + `claude-agent-sdk@0.3.185`. Add a CI presence-test asserting the `plugins` field is on the outgoing `session/new` params (mirror the `bridge.ts:66-76` `_meta.systemPrompt` guard), so an adapter/SDK bump that drops the field fails loud.
8. **Auditability:** if an auto-load changes the available tool/command surface, record it (like the bootstrap brief's `role:'bootstrap'` transcript entry) so "invisible-to-user" never becomes "invisible-to-audit".

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (ACP bridge + readiness + paths + client copy), `apps/desktop` (resource staging), `plugins/{design,flow}` (bundled, unchanged content), `cli`/docs (power-user path stays)
- **Affected Systems**: ACP `session/new` params, desktop bundle staging, `/_api/preflight` readiness contract, onboarding + ChatPanel copy, bootstrap brief
- **Dependencies**: none new (adapter `_meta` + SDK `plugins` capability already installed at `@anthropic-ai/claude-agent-sdk@0.3.185`)
- **New DDR required**: yes — supersedes DDR-128's "plugin install is guide-only" posture for the **session-scoped injection** path (does not revive the rejected `~/.claude`-mutation mechanism)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `apps/studio/acp/bridge.ts` (whole file, ~330 lines) — Why: `newSessionParams()` `:77-86` (THE injection point, currently builds `_meta.systemPrompt`), `AcpBridgeOptions` `:30-49` (plumb the plugin paths through here), `start()`/spawn `:169-213`, env re-adds `:179-205`, the `_meta.systemPrompt` upgrade-guard `:66-76` (template for the plugins presence-test).
- `apps/studio/acp/index.ts` (whole file) — Why: `getOrCreateBridge` `:142-164` builds `AcpBridgeOptions` from `ctx` (where the plugin paths + no-op gate decision are wired in); `studioBrief` construction `:151-154`.
- `apps/studio/acp/bootstrap-brief.ts` (whole file) — Why: `:36` already says "prefer `/design:*` when available" — upgrade to "available in this session"; the guardrail header is the discipline to follow.
- `apps/studio/acp/probe.ts` — Why: `resolveClaudePath()` `:71`, `resolveAgentRuntime()` `:83`, the DDR-045 resolution style to mirror for `DESIGN_PLUGIN_DIR`.
- `apps/studio/acp/env.ts` — Why: `scrubAgentEnv` / `PROVIDER_REDIRECT_RE` `:31` — DO NOT DISTURB (DDR-123 guard).
- `apps/studio/paths.ts` (whole file) — Why: add `DESIGN_PLUGIN_DIR`/`FLOW_PLUGIN_DIR` next to `DEV_SERVER_ROOT`/`DIST_DIR`; DDR-045 real-disk rule (never local `import.meta.url`).
- `apps/studio/readiness.ts` (whole file, ~240 lines) — Why: `scanPlugins()` `:104-140` (the no-op gate detector), `probeReadiness()` `:148-238`, the `plugins` required row `:181-203` + remediation string `:199-203` (what shortens).
- `apps/studio/http.ts` — Why: `/_api/preflight` route `:620-623` (main-origin gate); the `/_api/design/init` route pattern `:1116-1152` if a server action is needed.
- `apps/studio/client/panels/ReadinessList.jsx` — Why: `useReadiness()` `:19` and the three render sites; copy to update.
- `apps/studio/client/panels/OnboardingWizard.jsx` — Why: `AiReadiness` strip `:147-178`, rendered at `:218`; native-only gate `:584`.
- `apps/studio/client/panels/ChatPanel.jsx` — Why: `NotConnected` explainer `:757-780`, `refresh()` re-probe hook.
- `apps/desktop/scripts/stage-resources.mjs` (whole file) — Why: `:79-80` stages `plugins/design/templates` only; add the full `plugins/{design,flow}` command/agent/skill/hook + `.claude-plugin` staging + the DDR-129-style fail-loud assertion (adapter-closure staging `:82-171` is the pattern).
- `apps/desktop/src-tauri/src/sidecar.rs` — Why: `:107-110` login-shell PATH injection (DDR-128) — the reason the spawned `claude`/`maude` are reachable; `:133-146` `MAUDE_DEV_SERVER_ROOT` (the desktop resolution anchor `paths.ts` must honor).
- `apps/desktop/src-tauri/tauri.conf.json` — Why: `:41-44` `resources` map (add the staged plugin dirs if referenced by path); version-parity field.
- `.ai/decisions/DDR-128-first-open-readiness-check-detect-and-guide.md` — Why: the posture this feature supersedes; quote its rejected-alternatives in the new DDR.
- `.ai/decisions/DDR-123-*.md`, `DDR-125-*.md`, `DDR-129-*.md`, `DDR-044-*.md`, `DDR-062-*.md`, `DDR-119-*.md` — Why: the hard constraints enumerated in § Non-negotiable guards.
- `.ai/plans/feature-acp-context-hardening.md` — Why: the adjacent, just-executed plan that built the `_meta` injection seam + the T1 spike pattern this feature reuses.
- `node_modules/@agentclientprotocol/claude-agent-acp/dist/acp-agent.js` (`:2302`, `:2329-2333`, `:2455`) and `node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.185*/sdk.d.ts` (`:1670-1683`, `:3766-3778`, `:5011`, `:5097`) — Why: the exact adapter merge + SDK `plugins` shape the injection relies on (read-only evidence; pinned versions).

### Files to Create

- `apps/studio/acp/plugin-bootstrap.ts` — Resolves which local plugins to inject: reads `DESIGN_PLUGIN_DIR`/`FLOW_PLUGIN_DIR`, applies the `scanPlugins()` no-op gate + `isNativeApp()`/bundle gate, returns `SdkPluginConfig[]` (empty ⇒ no injection). Pure, unit-testable.
- `apps/studio/test/acp-plugin-bootstrap.test.ts` — no-op gate (installed ⇒ skip), native-only gate, path-exists gate, returns both when neither installed.
- `apps/studio/test/acp-session-plugins.test.ts` — presence-test: `newSessionParams()` emits `_meta.claudeCode.options.plugins` when the resolver returns configs (CI guard for the adapter contract).
- `.ai/decisions/DDR-143-acp-session-scoped-plugin-auto-bootstrap.md` — supersede DDR-128's guide-only ceiling for the injection path.

### Design canvases

> No `.design/` canvas matched — this is infrastructure, not a UI-mock feature. The only UI touch is copy in existing onboarding/chat surfaces (no new canvas).

---

## Decisions (recommended defaults chosen 2026-07-03; user was AFK at the scope question — escalate at execute if desired)

| Decision | Chosen (recommended) | Alternative | Why |
| -------- | -------------------- | ----------- | --- |
| **Scope** | **Desktop bundle only** | Desktop + web `maude design serve` | Consistent with DDR-119 (native owns workspace; web users have a terminal); avoids reversing DDR-044 (minimal npm surface) + a bigger tarball. Web path = document the manual steps. |
| **Which plugins** | **design + flow** | design only | Readiness already requires **both**; loading both turns the whole check green. Flow commands are useful in-chat. |
| **Injection lever** | **`plugins: [{type:'local', path}]`** | `settings.enabledPlugins` + `settings.extraKnownMarketplaces` (local marketplace); or a project `.claude/settings.json` | Cleanest: session-scoped, zero disk writes, direct dir pointer. The other two exist as fallbacks if the spike shows `plugins` doesn't forward. |
| **Version skew (power user, different marketplace version)** | **Skip injection when installed** (no-op gate) | Prefer bundled / surface a choice | The user's explicit requirement is "power users → no-op". Detect-installed ⇒ don't inject. |

---

## Tasks

Execute in order. Each task is atomic and testable. **Task 1 is a go/no-go spike — do not build C–J before it passes.**

### Task 1: SPIKE — verify `_meta.claudeCode.options.plugins` reaches SDK `query()` end-to-end

- **Do**: Reproduce the context-hardening T1 spike shape. Against the installed adapter (`claude-agent-acp@0.49.x`) + a live `claude`, send a `session/new` with `_meta.claudeCode.options.plugins = [{ type:'local', path: <abs plugins/design> }]` and confirm the session's `available_commands_update` reports `design:*` commands with NO `~/.claude` install. Log the exact frame. If it does NOT forward, fall back to `settings.enabledPlugins` + `extraKnownMarketplaces` (local source) and re-verify; record which lever won.
- **Pattern**: `.ai/plans/feature-acp-context-hardening.md` T1 spike; evidence trail in `acp-agent.js:2302/2329-2333/2455` + `sdk.d.ts:1683`.
- **Gotcha**: adapter-internal, undocumented contract — this spike IS the risk retirement. `slash-commands.js:60-64` already confirms the catalogue reports colon-form `design:edit` once a plugin loads.
- **Validate**: manual — the live session lists `/design:*` commands with a pristine `~/.claude`.

### Task 2: ADD `DESIGN_PLUGIN_DIR` + `FLOW_PLUGIN_DIR` to `apps/studio/paths.ts`

- **Do**: Export both, resolved from `DEV_SERVER_ROOT` (e.g. `join(DEV_SERVER_ROOT, '..', '..', 'plugins', 'design')`), validated to resolve in: dev tree, npm global, `bun --compile` binary, and desktop `Resources/apps/studio` (via `MAUDE_DEV_SERVER_ROOT`). Return `null` when the dir is absent (npm/web layout) so callers gate cleanly.
- **Pattern**: existing `DIST_DIR`/`RUNTIME_BUNDLES_DIR` in `paths.ts`; `http.ts:175` join style.
- **Gotcha**: DDR-045 — never `dirname(fileURLToPath(import.meta.url))` locally; two prod releases broke on exactly this.
- **Validate**: unit test that both resolve under a simulated desktop `Resources/` layout and return `null` under the npm layout.

### Task 3: CREATE `apps/studio/acp/plugin-bootstrap.ts` — the resolver + no-op gate

- **Do**: `resolveSessionPlugins(ctx): SdkPluginConfig[]`. Returns `[]` unless: (a) running in the desktop bundle / `isNativeApp()`, (b) the plugin dir exists (Task 2 non-null), (c) `scanPlugins()` shows the plugin NOT already installed. Extract or import `scanPlugins()` from `readiness.ts` (don't duplicate the registry-scan logic). `skipMcpDiscovery: true` unless the spike shows MCP discovery is needed.
- **Pattern**: `readiness.ts` `scanPlugins()` `:104-140`.
- **Gotcha**: honor `settingSources:user` — if the user enabled the plugin in `~/.claude/settings.json` it loads natively; treat that as installed (no-op).
- **Validate**: `apps/studio/test/acp-plugin-bootstrap.test.ts` — installed⇒skip, native-only, path-missing⇒skip, neither-installed⇒both.

### Task 4: PLUMB + INJECT into `bridge.ts` `newSessionParams()`

- **Do**: Add `plugins?: SdkPluginConfig[]` to `AcpBridgeOptions` (`:30-49`); pass it from `index.ts` `getOrCreateBridge` (`:142-164`) via `resolveSessionPlugins(ctx)`. In `newSessionParams()` (`:77-86`), when non-empty, add `_meta.claudeCode.options.plugins`. Keep the existing `_meta.systemPrompt.append` sibling intact.
- **Pattern**: the `studioBrief` plumb already threads config from `index.ts` → bridge → `_meta`.
- **Gotcha**: model/effort change re-spawns the adapter (`configChanged()` `:284`) — the plugin list must be recomputed on re-spawn too.
- **Validate**: `apps/studio/test/acp-session-plugins.test.ts` presence-test.

### Task 5: STAGE the plugin tree into the desktop bundle

- **Do**: In `apps/desktop/scripts/stage-resources.mjs`, stage `plugins/design/` and `plugins/flow/` (`commands/`, `agents/`, `skills/`, `hooks/`, `.claude-plugin/plugin.json`) into `src-tauri/resources/plugins/{design,flow}/` — mirror the existing `plugins/design/templates` copy (`:79-80`). Add a build-time assertion that each plugin's `.claude-plugin/plugin.json` staged (fail the build if missing — DDR-129 pattern). Reference the new dirs in `tauri.conf.json` `resources` (`:41-44`) if path-referenced at runtime.
- **Pattern**: adapter-closure staging + fail-loud assertion (`stage-resources.mjs:82-171`, DDR-129).
- **Gotcha**: copied from the repo tree ⇒ ships at the release version automatically (no new parity source); but this makes the desktop bundle carry the plugin markdown — note the size delta.
- **Validate**: run `node apps/desktop/scripts/stage-resources.mjs`; assert `resources/plugins/design/commands/*.md` + `.claude-plugin/plugin.json` exist.

### Task 6: VERIFY `maude design <verb>` resolves from a STAGED (not marketplace-cloned) plugin dir

- **Do**: Confirm a loaded-from-`Resources` plugin's `/design:edit` shell-out (`maude design <verb>`, DDR-062) works: `maude` on the spawned PATH (DDR-128 sidecar login-shell fix) + `CLAUDE_PLUGIN_ROOT` resolves to the staged dir with the expected bin layout.
- **Pattern**: DDR-062 `maude design <verb>` dispatch; `sidecar.rs:107-110` PATH.
- **Gotcha**: the staged dir has NO `dev-server/bin/*.sh` unless staged — verify what `maude design <verb>` actually needs from `CLAUDE_PLUGIN_ROOT`; it may resolve helpers from the maude package root instead (DDR-061), in which case the staged plugin only needs command/skill/agent markdown.
- **Validate**: in the bundled `.app`, run a `/design:screenshot` turn end-to-end (agent shells out successfully).

### Task 7: SHORTEN the readiness check + update copy

- **Do**: In `readiness.ts` `probeReadiness()`, when session-scoped injection is active (native + resolver non-empty), mark the `plugins` row **satisfied** (detail: "auto-loaded in the Maude chat session") instead of required-missing. Update the remediation copy in `ReadinessList.jsx` / `OnboardingWizard.jsx` `AiReadiness` / `ChatPanel.jsx` `NotConnected` from "run these `/plugin` commands" to "ready — plugins load automatically" for the desktop path; keep the manual string as the power-user/web fallback.
- **Pattern**: `readiness.ts:181-203`, the three render sites via `useReadiness()`.
- **Gotcha**: the `plugins` row must still show the manual remediation on the **web** path (no bundle) — gate the copy on native/bundle, not unconditionally.
- **Validate**: `/_api/preflight` on a pristine `~/.claude` in the bundled app returns `ready:true` (was `false`); web serve still shows the manual row.

### Task 8: UPGRADE the bootstrap brief

- **Do**: `bootstrap-brief.ts:36` — when injection is active, state design (+flow) commands **are available in this session** rather than "when available". Keep it environment-orientation only (no behavioral policy — the context-hardening guardrail). Ensure the auto-load is reflected in the transcript audit entry.
- **Pattern**: `bootstrap-brief.ts` guardrail header; `role:'bootstrap'` transcript entry.
- **Validate**: `acp-bootstrap-brief.test.ts` updated; the brief text is present in `_chat/<id>.jsonl`.

### Task 9: RECORD DDR-143

- **Do**: Write `.ai/decisions/DDR-143-acp-session-scoped-plugin-auto-bootstrap.md`. State: session-scoped `_meta.claudeCode.options.plugins` injection is a **third mechanism** DDR-128 didn't consider (not the rejected `~/.claude` mutation); it's non-mutating, reversible, native-scoped, no-op for power users, inside the Claude Code session the adapter drives. Enumerate the guards (DDR-123 env untouched, DDR-125 F2 envelope not widened, `settingSources` leak note, contract presence-test).
- **Validate**: DDR renders; linked from STATE.md History + the new DDR index.

### Task 10: DOCS — keep the power-user/manual path, add the zero-install note

- **Do**: In `README.md` (`:19-67`) and `site/content/docs/getting-started.mdx` + `desktop/index.mdx`, add a "Maude Desktop: nothing to install beyond Claude Code" note and reframe the `/plugin` + `npm i -g` steps as the **power-user / web-serve / manual** path (not the default happy path for desktop).
- **Pattern**: existing quick-start blocks; DDR-044/119 framing.
- **Gotcha**: don't delete the manual steps — the web `maude design serve` path still needs them (scope = desktop-only).
- **Validate**: docs build; the manual path is still present and labeled.

---

## Validation

Run these to confirm zero regressions:

1. **Tests**: `cd apps/studio && bun test` (must stay green; suite was 1782 pass/0 fail pre-change). New: `acp-plugin-bootstrap`, `acp-session-plugins`, updated `acp-bootstrap-brief`.
2. **Desktop staging**: `node apps/desktop/scripts/stage-resources.mjs` then assert `resources/plugins/{design,flow}/.claude-plugin/plugin.json` + `commands/*.md` exist; the fail-loud assertion trips when a plugin dir is absent.
3. **Bundle rebuild** (if client copy changed): `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` + `dist/styles.css` (CLAUDE.md rebuild rule).
4. **Version parity**: `scripts/check-version-parity.sh` (bundled plugin ships at release version — confirm no drift).
5. **Live bundled-`.app` dogfood** (DDR-135 native verification ceiling — the user dogfoods): fresh machine / pristine `~/.claude` (or temp `CLAUDE_CONFIG_DIR`) → open the `.app` → onboarding → chat → `/design:new` resolves with NO manual install. Then with `design@maude` pre-installed → confirm no double-load (no duplicate command in the catalogue).
6. **Env-scrub regression**: assert `scrubAgentEnv` still strips the `ANTHROPIC_*` namespace and `CLAUDE_CODE_EXECUTABLE` is still pinned after the change (DDR-123).
7. **Security pass**: spawn `security-auditor` + `ethical-hacker` over the diff — focus on the auto-approve × auto-loaded-shell-out surface (DDR-125 F2) and the `settingSources` downstream-repo leak; confirm the feature does not widen reach to hub/multi-user.

---

## Acceptance Criteria

- [ ] Task 1 spike passes (or the documented fallback lever verified) — `/design:*` resolves in an ACP session with a pristine `~/.claude`.
- [ ] Non-power-user, desktop, only Claude Code installed: open app → chat → `/design:new` + `/flow:plan` work with zero manual install.
- [ ] Power user with `design@maude`/`flow@maude` already installed: **no-op** — no double-registration, no version-skew, catalogue shows each command once.
- [ ] Web `maude design serve` path: unchanged; manual steps still documented (scope = desktop-only).
- [ ] `readiness.ts` `plugins` row is satisfied on the desktop path; the manual remediation remains on the web path.
- [ ] `scrubAgentEnv` + `CLAUDE_CODE_EXECUTABLE` pin unchanged (DDR-123); no Anthropic-auth env added.
- [ ] CI presence-test guards the `_meta.claudeCode.options.plugins` field (adapter-contract fragility).
- [ ] DDR-143 recorded, superseding DDR-128's guide-only ceiling for the injection path; STATE.md History updated.
- [ ] `bun test` green; desktop staging asserts the plugin tree; version parity holds; bundle rebuilt if client copy changed.
- [ ] `security-auditor` + `ethical-hacker`: 0 blockers on the auto-approve × auto-load surface; reach not widened to hub/multi-user.
- [ ] Roadmap regen (`pnpm --filter @maude/site gen:roadmap`) included in the commit that adds this plan (CLAUDE.md rule).

---

## Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| `_meta.claudeCode.options.plugins` doesn't forward through the pinned adapter | High (kills the approach) | Task 1 spike is the gate; documented fallback to `settings.enabledPlugins` + local `extraKnownMarketplaces`; CI presence-test. |
| Adapter/SDK bump changes the option merge | Medium | Pin versions; presence-test fails loud; DDR-143 notes the contract. |
| Double-load / version skew (bundled vs marketplace copy) | Medium | No-op gate on `scanPlugins()`; `settingSources:user` natural no-op. |
| Auto-approve × auto-loaded shell-out commands | Medium | Stay in loopback/native/own-project envelope (DDR-125 F2); security pass; no hub/multi-user leak. |
| `settingSources` lets a downstream repo enable arbitrary plugins/hooks in an auto-approving session | Medium (pre-existing) | Flag; evaluate narrowing `settingSources` for the bootstrap case. |
| Desktop bundle size grows (plugin markdown) | Low | Markdown is small vs the 67 MB sidecar; note the delta. |
| Bundled `/design:*` shell-out can't find `maude`/`CLAUDE_PLUGIN_ROOT` | Medium | Task 6 verifies against the DDR-128 PATH fix + DDR-061/062 resolution from the maude package root. |
