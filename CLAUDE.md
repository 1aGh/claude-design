# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`md-claude` — a Claude Code marketplace (defined by `.claude-plugin/marketplace.json`) shipping two plugins plus an npm-published CLI:

- **`plugins/design`** — canvas-first iteration on HTML/JSX mocks under a project's `<designRoot>` (default `.design/`). Includes a zero-dep Node dev server (`plugins/design/dev-server/server.mjs`) that injects an inspector overlay for Cmd+Click element selection and tracks active-canvas state over WebSocket.
- **`plugins/flow`** — generic agentic workflow loop with a second-brain `.ai/` workspace. Project-agnostic via `<project>` placeholders + per-repo `.ai/workflows.config.json` (schema at `plugins/flow/.claude-plugin/config.schema.json`).
- **`cli/`** — `mdcc` CLI (entry `cli/bin/mdcc.mjs`, subcommands in `cli/commands/`). Published as `@1agh/md-claude` on npm with two bins: `mdcc` and the back-compat alias `claude-design-server`.

The npm package, the design plugin, and the flow plugin all share a single version — `package.json`, `plugins/design/.claude-plugin/plugin.json`, and `plugins/flow/.claude-plugin/plugin.json` must move together. CI enforces parity (`.github/workflows/version-parity.yml`).

## Common commands

```sh
# Run dev server against a target project (NOT this repo unless you're testing the server itself)
npm run start                          # serves $CLAUDE_PROJECT_DIR or cwd; needs a .design/ there
npm run dev                            # same, explicit port 4399
node plugins/design/dev-server/server.mjs --root /path/to/target-repo

# CLI (after `npm i -g @1agh/md-claude` OR `npm run mdcc -- <args>` locally)
mdcc init [--name <project>] [--force] [--dry-run]    # scaffold .ai/ from plugins/flow/templates/ai-skeleton
mdcc config show | get <dotted.key> | set <key> <val>  # edits .ai/workflows.config.json
mdcc design serve [--port N] [--root <path>]          # boots the design dev server

# Version + release
scripts/bump-version.sh patch|minor|major|X.Y.Z       # bumps package.json + both plugin.json files
scripts/check-version-parity.sh                       # asserts all three match (run in CI too)
```

There is **no test suite, lint config, or build step** in this repo — the plugins are pure markdown commands/skills/agents plus a zero-dep Node server. Don't invent a `test` script. If you need to verify a CLI change, run `node cli/bin/mdcc.mjs <cmd>` directly.

## Architecture

### Marketplace layout

`.claude-plugin/marketplace.json` is the entry point Claude Code reads when a user runs `/plugin marketplace add 1aGh/md-claude`. It lists the two plugins and their source paths. Each plugin has its own `.claude-plugin/plugin.json` manifest plus `commands/`, `agents/`, and `skills/` directories — these are surfaced as slash commands, subagents, and auto-loaded skills inside Claude Code.

### Dev server runtime contract (`plugins/design/dev-server/server.mjs`)

The server is zero-dep (`node:http` + `node:crypto` for WS handshake) and resolves the **target repo root** in this order: `--root <path>` arg → `$CLAUDE_PROJECT_DIR` → `process.cwd()`. It deliberately never uses `__dirname` for the project root, because the plugin can be installed centrally (npm global) and serve any repo.

It writes three runtime files into `<designRoot>/` that the orchestrator (`/design` slash command) relies on:

| File | Role |
| ---- | ---- |
| `_server.json` | `{ pid, port, url, started }` — orchestrator uses this to detect a live instance instead of starting a duplicate. |
| `_active.json` | `{ active, open_tabs, selected, last_change }` — the injected inspector pushes the user's currently-selected element here over WebSocket so `/design "<feedback>"` can scope edits. |
| `_history/<slug>/` | Auto-snapshot stack per canvas, consumed by `/design:rollback`. |

These files are user-facing runtime state — when changing the server, keep the schemas backwards-compatible or update both producer and the consuming commands (`plugins/design/commands/*.md`) in the same change.

The server fails loud if launched from a directory without `.design/` rather than serving an empty UI — preserve this behaviour, it's load-bearing for debugging "wrong project root" cases.

### Flow plugin: `<project>` placeholder convention

Every flow command/skill is project-agnostic. They read `.ai/workflows.config.json` to resolve a `<project>` placeholder and feature toggles (`boundaries.*`, `motion.*`, `responsive.*`, `skills.*`, `integrations.*`). When adding or editing flow content under `plugins/flow/`, **do not hardcode this repo's specifics** — the same plugin runs against arbitrary downstream repos. Reach for the config; if a knob doesn't exist, extend `plugins/flow/.claude-plugin/config.schema.json` rather than hardcoding.

### `.ai/` skeleton vs. this repo's own `.ai/`

`plugins/flow/templates/ai-skeleton/` is the template that `mdcc init` copies into a target project. This repo also has its own `.ai/` directory at the root — that's md-claude *dogfooding* flow on itself (see README "Local development" section). **The two are independent.** Edits to `plugins/flow/templates/ai-skeleton/` only affect future `mdcc init` runs in other repos; edits to `/Volumes/D/git/claude-design/.ai/` only affect work on this repo.

`cli/commands/init.mjs` does string templating during the copy: it replaces `PROJECT_NAME` and rewrites the `$schema` ref in `workflows.config.json` from a relative path to an absolute GitHub raw URL (because after npm install the schema is no longer at a stable relative location). When changing the skeleton, keep this rewrite in mind for any files added to the `TEMPLATED` list.

### Published npm surface

`package.json` `files` is intentionally minimal — only `cli/`, `plugins/design/dev-server/`, `plugins/flow/templates/`, the flow config schema, `LICENSE`, and `README.md` ship to npm. The plugin commands/agents/skills (`plugins/*/commands/`, etc.) are **NOT** published via npm — they reach users through the Claude Code plugin marketplace mechanism (`/plugin install`). When adding a new top-level directory that the CLI needs at runtime, add it to `files` or `mdcc` will break for end users.

## Release flow

1. `scripts/bump-version.sh patch` (or `minor`/`major`/explicit `X.Y.Z`) — updates all three version fields together.
2. `scripts/check-version-parity.sh` — sanity check (also runs in CI on PRs touching `package.json` or the design plugin manifest; note the workflow does not currently watch the flow plugin manifest, so don't bypass the local script).
3. `git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags`.
4. The `v*` tag triggers `.github/workflows/publish.yml`, which re-runs parity, asserts the tag matches `package.json`, and publishes to npm with `--access public --provenance`.

Never bump versions by hand or with `npm version` — the script is the single source of truth for keeping all three manifests in lockstep.

## Working on plugin internals locally

For testing edits to plugin commands/skills/agents, the README's "Local development" section is the canonical recipe: point the marketplace at the local working tree (`/plugin marketplace add /absolute/path/to/md-claude`), then `/plugin marketplace update md-claude` + `/reload-plugins` after each edit. **Test in a scratch project** (`cd /tmp/scratch && claude`) rather than from this repo's directory — otherwise this repo's own `.ai/` workspace tangles with the plugin you're testing.

For dev-server code changes specifically: kill the running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it; the orchestrator checks `<designRoot>/_server.json` and respawns when stale.
