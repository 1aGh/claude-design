# DDR-143 — ACP session-scoped plugin auto-bootstrap: `_meta.claudeCode.options.plugins`, native-only, no-op for power users

**Superseded in part by [DDR-168](DDR-168-acp-bundled-cli-and-plugins-always-win.md)** — Decision 3 ("no-op for power users, hard") is removed: the bundled `design` plugin is now injected unconditionally regardless of disk state; the double-registration risk that gate existed to prevent is closed structurally instead (`bridge.ts`'s `options.settings.enabledPlugins` override). Decisions 1, 2, 4 and Guards 1–2, 4–8 below are unchanged.

**Status:** accepted
**Date:** 2026-07-03
**Relates:** DDR-128 (**supersedes** its "plugin install is structurally out of reach / detect-and-guide only" ceiling — for the session-scoped injection path *only*; the rejected `~/.claude`-mutation + `npm i -g` mechanisms stay rejected), DDR-123 (ACP drives the user's OWN `claude` on their subscription — env untouched), DDR-125 (auto-approve accepted-risk envelope — not widened), DDR-126 (no package managers / no network in the app), DDR-044 (minimal npm surface — the web path ships no plugin manifest), DDR-062 (`/design:*` reach executables via `maude design <verb>` from the maude package root, not `CLAUDE_PLUGIN_ROOT`), DDR-119 (native owns the workspace; web users have a terminal), DDR-129 (desktop-staging fail-loud assertions), DDR-045 (real-disk path resolution — never a local `import.meta.url`), DDR-142 (the `_meta` injection seam + `role:'bootstrap'` transcript audit this reuses)

## Context

A Maude Desktop user who opens the app and tries the ACP chat panel to drive `/design:*` gets a red "Maude plugins in Claude Code" readiness row unless they've already run — in a **separate** Claude Code session — the manual dance: `/plugin marketplace add 1aGh/maude` → `/plugin install design@maude` + `/plugin install flow@maude` → `/reload-plugins` (plus `npm i -g @1agh/maude`). Three surfaces the desktop app can only *detect and describe*, never perform.

**DDR-128 declared plugin install "structurally out of reach"** on the premise that the only levers are (a) mutating `~/.claude`'s registry files or (b) typing `/plugin` slash commands inside a Claude Code session — both of which the desktop app can't safely do. That premise missed a **third lever**: Maude fully controls the `claude` spawn through the ACP adapter (DDR-123), and the installed Agent SDK exposes a **session-scoped, non-mutating** plugin-load option that neither writes `~/.claude` nor invokes `/plugin`.

## Decision 1 — Inject the plugins session-scoped via `_meta.claudeCode.options.plugins`

The dev-server's ACP bridge already carries a `_meta` payload into `session/new` (the DDR-142 bootstrap brief rides `_meta.systemPrompt.append`). We add a sibling: `_meta.claudeCode.options.plugins = [{ type: 'local', path: <bundled plugin dir>, skipMcpDiscovery: true }, …]`.

The pinned adapter (`@agentclientprotocol/claude-agent-acp@0.49.0`) reads `_meta.claudeCode.options` (`acp-agent.js:2302`) and spreads the **whole** object into the SDK `query()` options (`...userProvidedOptions`, `:2333` → `query({ options })` `:2455`); `plugins` is not in the override list after the spread, so it reaches the SDK's documented `plugins?: SdkPluginConfig[]` (`@anthropic-ai/claude-agent-sdk@0.3.185`, `sdk.d.ts:1683`; `SdkPluginConfig = { type:'local'; path; skipMcpDiscovery? }` `:3766`) untouched. The SDK loads that dir's commands/agents/skills/hooks **for that session only** — no `~/.claude` write, no `npm`, no network, no `/plugin` command (holds DDR-126). Reversible and per-session by construction.

**Verified live (Task-1 spike, go/no-go gate):** injecting a uniquely-named throwaway local plugin made its command (`maude-spike:marker`) appear in the session's `available_commands_update` (`103` cmds with injection vs `102` without — an exact +1 delta) with no install. No fallback lever needed. The full `slash-commands.js` catalogue reports colon-form (`design:edit`) once a plugin loads.

## Decision 2 — Native/desktop-only; the web `maude design serve` path is excluded

The bundled plugin tree ships **only** in the desktop `Resources/` (staged by `apps/desktop/scripts/stage-resources.mjs`); the npm tarball ships only `plugins/<p>/templates` (DDR-044), never the plugin manifest. So the load-bearing native gate is **"the plugin manifest resolves on disk"** — `paths.ts` `DESIGN_PLUGIN_DIR`/`FLOW_PLUGIN_DIR` gate on `.claude-plugin/plugin.json`, non-null only in the dev tree or the desktop bundle, `null` under npm/web. `isNativePluginContext()` additionally honors the desktop sidecar's `MAUDE_DEV_SERVER_ROOT` (DDR-106) as an explicit marker and keeps the feature dogfoodable in the dev tree. The web path (terminal-having users, DDR-119) keeps the manual marketplace flow, still fully documented.

## Decision 3 — No-op for power users (hard): skip a plugin already present

Every injected plugin is gated on a `scanPlugins()` (readiness.ts) miss. If `design@maude` / `flow@maude` is already in `~/.claude/plugins/installed_plugins.json` **or** enabled in `~/.claude/settings.json` `enabledPlugins` (the adapter's `settingSources:["user","project","local"]` loads it natively either way), we **skip** injecting the bundled copy — preventing double-registration and version skew (bundled-at-release vs a marketplace copy at a different version). A pristine `~/.claude` (the target non-power-user) reads as not-installed ⇒ inject. This is why the spike used a throwaway marker to isolate the mechanism: the author's own `design@maude` was already installed, so `design:*` appeared in both runs — exactly the natural no-op.

## Decision 4 — `maude design <verb>` shell-out resolves from the maude package, not the staged plugin

The staged Resources plugin only needs its **markdown** (commands/agents/skills/hooks/templates). Its `/design:*` workflows shell out to `maude design <verb>` (DDR-062), and the `maude` CLI resolves the helper `.sh` from **its own package root** (`join(pkgRoot,'apps','studio','bin',<verb>.sh)`, `cli/commands/design.mjs`), setting `CLAUDE_PLUGIN_ROOT` to the plugin dir for the child — never `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"`. Verified live: `maude design slug` from a foreign cwd with `CLAUDE_PLUGIN_ROOT` pointed at the staged dir returned correctly, exit 0. The `maude` CLI on PATH stays a separate readiness row (DDR-128 sidecar login-shell PATH fix makes it reachable); this feature does not bundle `maude`, and the default direct-edit path (per the DDR-142 brief) needs neither `maude` nor the full workflows.

## Guards (all preserved)

1. **Subscription / ToS (DDR-123):** `scrubAgentEnv` and the `CLAUDE_CODE_EXECUTABLE` pin are untouched; zero Anthropic-auth env added. Injecting a `plugins` option keeps Maude an ACP client driving the user's own `claude`, not an SDK-with-token embedder.
2. **No environment mutation (DDR-126):** session-scoped `_meta` + a bundled read-only dir. Never writes Claude Code's registry, never runs a package manager, never touches the network.
3. **No-op for power users (Decision 3):** `scanPlugins()`-gated per plugin.
4. **Native-only (Decision 2):** manifest-on-disk gate; web excluded. `MAUDE_NO_PLUGIN_BOOTSTRAP=1` is a hard opt-out that reverts to the DDR-128 detect-and-guide posture.
5. **Auto-approve envelope (DDR-125 F2) not widened:** the ACP bridge is wired only on the main-origin loopback WS (never the canvas origin, DDR-054), native-only. The auto-loaded commands run inside the same loopback / native / own-project / own-`claude` envelope that already existed — no hub / multi-user reach.
6. **`settingSources` breadth (pre-existing leak note) — NOW CLOSED (DDR-144 security pass, 2026-07-03):** the adapter defaults to `["user","project","local"]`, so the spawned `claude` read the served downstream repo's `.claude/`. The DDR-144 adversarial review showed this composes with the auto-loaded `/design:*` + a screenshot-engine exec sink into an "open a repo → get owned" confused-deputy chain, so `bridge.ts` `newSessionParams` now injects `_meta.claudeCode.options.settingSources = ['user']` on every session — the served project's `.claude/{settings.json,hooks,enabledPlugins}` no longer loads into the auto-approving session. See DDR-144 § Security review.
7. **Adapter-internal contract fragility:** `_meta.claudeCode.options.plugins` forwarding is undocumented and pinned to `claude-agent-acp@0.49.x` + `claude-agent-sdk@0.3.185`. A CI presence-test (`test/acp-session-plugins.test.ts`) asserts the adapter still reads+spreads `_meta.claudeCode.options` into `query()` and the SDK still declares `plugins?: SdkPluginConfig[]`, so a dependency bump that drops either side fails loud. Documented fallback: `settings.enabledPlugins` + a local `extraKnownMarketplaces` source.
8. **Auditability (DDR-142 BREAKER discipline):** the auto-load silently changes the available command/tool surface, so the bridge records the injected plugin paths as a `role:'bootstrap'` (`kind:'plugins-autoloaded'`) transcript entry on the session's first turn, alongside the brief. Invisible-to-user ≠ invisible-to-audit for the auto-approving agent. The bootstrap brief also states the commands are available in-session (`commandsAvailable`).

## Rejected

- **Mutating `~/.claude` (write marketplace/plugin registry files):** the DDR-128 rejection stands — fragile across Claude Code versions, reaching into another tool's internal state. Session-scoped `_meta` is strictly better (reversible, per-session, no persistence).
- **Auto `npm i -g` / one-click installs:** violates DDR-126; adds a network+exec surface. The manual/power-user path keeps these explicit.
- **`settings.enabledPlugins` + local `extraKnownMarketplaces`:** kept as the documented fallback if the `plugins` option ever stops forwarding — heavier (a settings object + a synthetic local marketplace) than a direct dir pointer, and the spike proved the direct `plugins` lever works.
- **Bundling `maude` into the desktop app:** out of scope; the CLI stays a separate readiness row (DDR-128), the default direct-edit path needs neither it nor the full `/design:*` workflows.

## Consequences / Deferred

- The desktop bundle now carries ~2 MB of plugin markdown (design + flow trees) — negligible vs the ~67 MB sidecar; copied from the repo at the release commit ⇒ ships at the release version automatically (no new version-parity source).
- The readiness `plugins` row collapses from a red install-wall to green ("Auto-loaded in the Maude chat session — nothing to install") on the desktop path; the manual `/plugin` remediation still shows on web/opt-out.
- **Deferred (tracked in the plan):** narrowing `settingSources` for the bootstrap case (guard #6); an approve/deny permission UI before any hub/multi-user reach (DDR-125 F2 follow-up); the live bundled-`.app` dogfood on a pristine `~/.claude` (native verification ceiling, DDR-135 — user-driven).
