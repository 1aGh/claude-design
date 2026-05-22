# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`Maude` — a Claude Code marketplace (defined by `.claude-plugin/marketplace.json`) shipping two plugins plus an npm-published CLI. Project was renamed from `md-claude` in v0.15.0; see [`docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`](docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md).

- **`plugins/design`** — canvas-first iteration on HTML/JSX mocks under a project's `<designRoot>` (default `.design/`). Includes a zero-dep Node dev server (`plugins/design/dev-server/server.mjs`) that injects an inspector overlay for Cmd+Click element selection and tracks active-canvas state over WebSocket.
- **`plugins/flow`** — generic agentic workflow loop with a second-brain `.ai/` workspace. Project-agnostic via `<project>` placeholders + per-repo `.ai/workflows.config.json` (schema at `plugins/flow/.claude-plugin/config.schema.json`).
- **`cli/`** — `maude` CLI (entry `cli/bin/maude.mjs`, subcommands in `cli/commands/`). Published as `@1agh/maude` on npm. Bins: `maude` (primary), `mdcc` (legacy alias — prints deprecation warning, drop in v0.17.x), `maude-safe`/`mdcc-safe` (per-call platform-detection fallback), `claude-design-server` (direct dev-server alias).

The npm package, the design plugin, and the flow plugin all share a single version — `package.json`, `plugins/design/.claude-plugin/plugin.json`, and `plugins/flow/.claude-plugin/plugin.json` must move together. CI enforces parity (`.github/workflows/version-parity.yml`).

## Common commands

```sh
# Run dev server against a target project (NOT this repo unless you're testing the server itself)
npm run start                          # serves $CLAUDE_PROJECT_DIR or cwd; needs a .design/ there
npm run dev                            # same, explicit port 4399
node plugins/design/dev-server/server.mjs --root /path/to/target-repo

# CLI (after `npm i -g @1agh/maude` OR `npm run maude -- <args>` locally)
maude init [--name <project>] [--force] [--dry-run]    # scaffold .ai/ from plugins/flow/templates/ai-skeleton
maude config show | get <dotted.key> | set <key> <val>  # edits .ai/workflows.config.json
maude design serve [--port N] [--root <path>]          # boots the design dev server
# Legacy `mdcc <cmd>` still works (prints a deprecation warning) until v0.17.x.

# Version + release
scripts/bump-version.sh patch|minor|major|X.Y.Z       # bumps package.json + both plugin.json files
scripts/check-version-parity.sh                       # asserts all three match (run in CI too)
```

There is **no test suite, lint config, or build step** in this repo — the plugins are pure markdown commands/skills/agents plus a zero-dep Node server. Don't invent a `test` script. If you need to verify a CLI change, run `node cli/bin/maude.mjs <cmd>` directly.

## Architecture

### Marketplace layout

`.claude-plugin/marketplace.json` is the entry point Claude Code reads when a user runs `/plugin marketplace add 1aGh/maude`. It lists the two plugins and their source paths. Each plugin has its own `.claude-plugin/plugin.json` manifest plus `commands/`, `agents/`, and `skills/` directories — these are surfaced as slash commands, subagents, and auto-loaded skills inside Claude Code.

### Dev server runtime contract (`plugins/design/dev-server/server.mjs`)

> **Runtime migration ahead — [DDR-009](.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md) (2026-05-15):** Phase 3.4 ([`.ai/plans/archive/phase-3.4-architecture-refactor.md`](.ai/plans/archive/phase-3.4-architecture-refactor.md)) migrates this server to **Bun authoritatively** (`Bun.serve` + `Bun.file` + `Bun.write` + `Bun.spawn` + `bun:test`), distributed as per-platform `bun --compile` standalone binaries via npm `optionalDependencies` sub-packages (mirroring `@anthropic-ai/claude-code`). No Node fallback. **When writing new dev-server code, reach for `Bun.*` APIs instead of `node:http` / `node:fs.readFile` / `node:child_process.spawn`** — `node:path` and `node:url` stay (Bun supports them identically). Tests under `plugins/design/dev-server/` use `bun:test`, not `node --test` (the `cli/` shim stays Node). The description below documents the current pre-migration state; update it once Task 7 of Phase 3.4 lands.

The server is zero-dep (`node:http` + `node:crypto` for WS handshake) and resolves the **target repo root** in this order: `--root <path>` arg → `$CLAUDE_PROJECT_DIR` → `process.cwd()`. It deliberately never uses `__dirname` for the project root, because the plugin can be installed centrally (npm global) and serve any repo.

It writes three runtime files into `<designRoot>/` that the orchestrator (`/design` slash command) relies on:

| File | Role |
| ---- | ---- |
| `_server.json` | `{ pid, port, url, started }` — orchestrator uses this to detect a live instance instead of starting a duplicate. |
| `_active.json` | `{ active, open_tabs, selected, last_change }` — the injected inspector pushes the user's currently-selected element here over WebSocket so `/design:edit "<feedback>"` can scope edits. |
| `_history/<slug>/` | Auto-snapshot stack per canvas, consumed by `/design:rollback`. |

These files are user-facing runtime state — when changing the server, keep the schemas backwards-compatible or update both producer and the consuming commands (`plugins/design/commands/*.md`) in the same change.

The server fails loud if launched from a directory without `.design/` rather than serving an empty UI — preserve this behaviour, it's load-bearing for debugging "wrong project root" cases.

The shared canvas library (`DesignCanvas`, `DCSection`, `DCArtboard`, helpers, hooks) lives at **`plugins/design/dev-server/canvas-lib.tsx`** — single source, ships with the dev-server install. Canvases import it via the virtual specifier `@maude/canvas-lib`, which the dev-server's Bun.build plugin resolves to that file. (Pre-v0.15.0 canvases used `@mdcc/canvas-lib` — the legacy specifier is no longer supported; update existing canvas imports if you upgrade from before the rename.) Edit there; the http-layer file-watcher broadcasts a hard reload to every open canvas iframe on change. Per [DDR-025](.ai/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md), there is no project-side copy — downstream projects that still carry a legacy `<designRoot>/_lib/canvas-lib.tsx` get a one-shot deprecation warning at boot and the file is ignored.

### Dev-server helpers (`plugins/design/dev-server/bin/`)

Single source of truth for the bash recipes that used to be duplicated across `/design:new`, `/design:edit`, `/design:screenshot`, `/design:setup-ds`, and every critic agent:

| Helper | Purpose | Callers |
| ------ | ------- | ------- |
| `screenshot.sh` | Capture screenshots — `--full` / `--screen <id>` / `--element <id>` / `--selector <css>` / `--all-screens`. agent-browser primary, `npx playwright` fallback. | `/design:screenshot`, `/design:new` step 9 (per-artboard reality check), `/design:edit` steps 3.5 + 7, design-system bootstrap visual sanity, design + signature-moment critics. |
| `bootstrap-check.sh` | Detect `.design/config.json` + DS folders. Exits 0 / 10 / 11. Modes: default / `--json` / `--shell-export`. | `/design:new`, `/design:edit` pre-flight (step 0). |
| `server-up.sh` | PID + `/_health` check, respawn on stale, poll 10 s, stdout = port. | `/design:new`, `/design:edit`, `/design:screenshot` server lifecycle (step 2). |
| `slug.sh` | Normalize `<active-relative-path>` → kebab slug for `_history/<slug>/`. | `/design:edit` step 3 + anywhere `_history/<slug>/` is computed. |
| `_screenshot-playwright.mjs` | Element-scoped playwright fallback shim (called by `screenshot.sh` only). | `screenshot.sh` when `agent-browser` is unavailable. |

When the CLI needs anything else at runtime on end-user machines, add it here and remember to add the directory to `package.json` `files` (the helpers ship via npm, not via the plugin marketplace).

### Plugin command naming

Two conventions apply to every command, skill, and agent under `plugins/{flow,design}/`. See [DDR-004](./.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md) (group-prefix filename) and [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md) (plugin-namespace in `name:`).

**1. `name:` frontmatter MUST be `<plugin>:<slug>`.** Every file declares its fully-qualified slash name in the `name:` field — e.g. `name: flow:resume`, `name: design:edit`, `name: flow:a11y-auditor`. **Without the explicit `<plugin>:` prefix**, Claude Code registers the bare slug and collides with built-ins like `/resume` or `/init` — see Claude Code [issue #22063](https://github.com/anthropics/claude-code/issues/22063). This is load-bearing — forgetting the prefix is a silent regression. Both `/flow:help` and `/design:help` parse `name:` and render `/<name>` directly (no template-side prefix).

**2. Non-daily filenames use `<group>-<verb>`.** Daily verbs (called every feature cycle) stay terse — `plan`, `execute`, `done`, `validate`, etc. Everything else gets a group prefix matching the command's `category:` field — `bug-fix`, `setup-prd`, `record-ddr`, `maintain-clean`. Categories are catalogued in [`plugins/flow/CATEGORIES.md`](./plugins/flow/CATEGORIES.md) and [`plugins/design/CATEGORIES.md`](./plugins/design/CATEGORIES.md). The strict prefix substitutes for the subdirectory namespacing that Claude Code [doesn't support](https://github.com/anthropics/claude-code/issues/2422) (closed not-planned; [#44678](https://github.com/anthropics/claude-code/issues/44678) is the open feature request) — typing `/flow:bug-` autocompletes only `bug-*` members.

**Lone exception:** `init` (both `/flow:init` and `/design:init`) is a bare-verb that mirrors Claude Code's built-in `/init`. The plugin-namespace prefix (`flow:` / `design:`) keeps them unambiguous against the built-in, so the filename doesn't need a `setup-` group prefix. Documented in both `CATEGORIES.md` files. No other bare-verb exceptions without a DDR.

When adding a new command/skill/agent: pick the group from `CATEGORIES.md`, name the file `<group>-<verb>.md`, and set frontmatter `name: <plugin>:<filename-sans-md>`, `category:`, `description:`.

### Flow plugin: `<project>` placeholder convention

Every flow command/skill is project-agnostic. They read `.ai/workflows.config.json` to resolve a `<project>` placeholder and feature toggles (`boundaries.*`, `motion.*`, `responsive.*`, `skills.*`, `integrations.*`). When adding or editing flow content under `plugins/flow/`, **do not hardcode this repo's specifics** — the same plugin runs against arbitrary downstream repos. Reach for the config; if a knob doesn't exist, extend `plugins/flow/.claude-plugin/config.schema.json` rather than hardcoding.

### `.ai/` skeleton vs. this repo's own `.ai/`

`plugins/flow/templates/ai-skeleton/` is the template that `maude init` copies into a target project. This repo also has its own `.ai/` directory at the root — that's Maude *dogfooding* flow on itself (see README "Local development" section). **The two are independent.** Edits to `plugins/flow/templates/ai-skeleton/` only affect future `maude init` runs in other repos; edits to `/Volumes/D/git/claude-design/.ai/` only affect work on this repo.

`cli/commands/init.mjs` does string templating during the copy: it replaces `PROJECT_NAME` and rewrites the `$schema` ref in `workflows.config.json` from a relative path to an absolute GitHub raw URL (because after npm install the schema is no longer at a stable relative location). When changing the skeleton, keep this rewrite in mind for any files added to the `TEMPLATED` list.

### Published npm surface

`package.json` `files` is intentionally minimal — only `cli/`, `plugins/design/dev-server/`, `plugins/design/templates/`, `plugins/flow/templates/`, the flow config schema, `LICENSE`, and `README.md` ship to npm. The plugin commands/agents/skills (`plugins/*/commands/`, etc.) are **NOT** published via npm — they reach users through the Claude Code plugin marketplace mechanism (`/plugin install`). When adding a new top-level directory that the CLI needs at runtime, add it to `files` or `maude` will break for end users.

## Design plugin

Design-system bootstrap, canvas iteration, and research-agent rules are owned by the plugin itself. When the user invokes `/design:*` or asks about design work, **load the plugin's own docs as the authoritative source** — do not rely on (or extrapolate from) summaries in this CLAUDE.md.

Entry points (load these when relevant, in this order):
- `plugins/design/skills/design-system/SKILL.md` — the canonical bootstrap + iteration spec (modes, sub-modes, 3-stage discovery, scaffold flow)
- `plugins/design/skills/design-system/_pastier-probe-templates.md` — Pastier probe templates fed to `ux-research-agent` during Stage 2 (5 input-field-driven probes: A. Ulice / B. Zrcadlo+Charakter / C. OST / D. Kmen / E. Confidence)
- `plugins/design/agents/ux-research-agent.md` — domain research subagent (consumes the full `vision-brief.json` from Stage 1; emits `recommendations[]` with per-decision confidence for Stage 3)
- `plugins/design/commands/{init,setup-ds,setup-docs,new,edit,help}.md` — slash-command flows
- `plugins/design/agents/*-critic.md` — critic panel definitions (grouped as "4 kola značky" in the post-scaffold reporting block — see SKILL.md § "Post-scaffold gate")
- `plugins/design/CATEGORIES.md` — command catalog and naming convention

When working on a brief the user provided via `/design:setup-ds` or `/design:new`: pass their input **verbatim** to the skill / agent. Do not paraphrase, polish, or augment the brief with "vibe references". Do not propose option ladders that name specific products (brand-name suggestions at the brief-capture stage are the bias source the research agent exists to eliminate). The plugin's own docs handle option generation via the `design:ux-research-agent` — your job is to invoke the right slash command with the user's input intact.

**Pattern priors come first.** When working under a project DS that has existing canvases or preview components, those files ARE the design spec, not the generic DS readme. Before scaffolding new compositional elements (cards, panels, modals, snippets), grep the existing canvas set and preview library for similar shapes. Lifting is the default; reinventing is the exception and needs a one-line comment explaining why a prior didn't fit. Applies to `/design:new` (envelope construction) and `/design:edit` (when adding new components). The `design-system-keeper` agent enforces this — see `plugins/design/agents/design-system-keeper.md` and DDR-010.

## Release flow

1. `scripts/bump-version.sh patch` (or `minor`/`major`/explicit `X.Y.Z`) — updates all three version fields together.
2. `scripts/check-version-parity.sh` — sanity check (also runs in CI on PRs touching `package.json` or the design plugin manifest; note the workflow does not currently watch the flow plugin manifest, so don't bypass the local script).
3. `git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags`.
4. The `v*` tag triggers `.github/workflows/publish.yml`, which re-runs parity, asserts the tag matches `package.json`, and publishes to npm with `--access public --provenance`.

Never bump versions by hand or with `npm version` — the script is the single source of truth for keeping all three manifests in lockstep.

## Site roadmap regen

`site/lib/roadmap.json` is auto-generated from `.ai/plans/*.md` + `.ai/plans/archive/*.md` + `.ai/state/STATE.md` by `site/scripts/build-roadmap.mjs`. It feeds the public `/roadmap` page. Like `stats.json` it IS committed because Vercel uploads only `site/` and cannot see the `.ai/` sibling.

**Whenever** you edit `.ai/state/STATE.md` History, archive a plan into `.ai/plans/archive/`, or add a new plan under `.ai/plans/`, run:

```
pnpm --filter @maude/site gen:roadmap
```

and include the resulting `site/lib/roadmap.json` diff in the same commit. This is the auto-update mechanism for `/flow:done` and any ad-hoc plan moves, no plugin-command hook needed — the rule lives here so it stays in context.

## Working on plugin internals locally

For testing edits to plugin commands/skills/agents, the README's "Local development" section is the canonical recipe: point the marketplace at the local working tree (`/plugin marketplace add /absolute/path/to/maude`), then `/plugin marketplace update maude` + `/reload-plugins` after each edit. **Test in a scratch project** (`cd /tmp/scratch && claude`) rather than from this repo's directory — otherwise this repo's own `.ai/` workspace tangles with the plugin you're testing.

For dev-server code changes specifically: kill the running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it; the orchestrator checks `<designRoot>/_server.json` and respawns when stale.
