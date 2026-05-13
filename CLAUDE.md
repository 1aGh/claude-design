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
| `_active.json` | `{ active, open_tabs, selected, last_change }` — the injected inspector pushes the user's currently-selected element here over WebSocket so `/design:edit "<feedback>"` can scope edits. |
| `_history/<slug>/` | Auto-snapshot stack per canvas, consumed by `/design:rollback`. |

These files are user-facing runtime state — when changing the server, keep the schemas backwards-compatible or update both producer and the consuming commands (`plugins/design/commands/*.md`) in the same change.

The server fails loud if launched from a directory without `.design/` rather than serving an empty UI — preserve this behaviour, it's load-bearing for debugging "wrong project root" cases.

### Plugin command naming

Two conventions apply to every command, skill, and agent under `plugins/{flow,design}/`. See [DDR-004](./.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md) (group-prefix filename) and [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md) (plugin-namespace in `name:`).

**1. `name:` frontmatter MUST be `<plugin>:<slug>`.** Every file declares its fully-qualified slash name in the `name:` field — e.g. `name: flow:resume`, `name: design:edit`, `name: flow:a11y-auditor`. **Without the explicit `<plugin>:` prefix**, Claude Code registers the bare slug and collides with built-ins like `/resume` or `/init` — see Claude Code [issue #22063](https://github.com/anthropics/claude-code/issues/22063). This is load-bearing — forgetting the prefix is a silent regression. Both `/flow:help` and `/design:help` parse `name:` and render `/<name>` directly (no template-side prefix).

**2. Non-daily filenames use `<group>-<verb>`.** Daily verbs (called every feature cycle) stay terse — `plan`, `execute`, `done`, `validate`, etc. Everything else gets a group prefix matching the command's `category:` field — `bug-fix`, `setup-prd`, `record-ddr`, `maintain-clean`. Categories are catalogued in [`plugins/flow/CATEGORIES.md`](./plugins/flow/CATEGORIES.md) and [`plugins/design/CATEGORIES.md`](./plugins/design/CATEGORIES.md). The strict prefix substitutes for the subdirectory namespacing that Claude Code [doesn't support](https://github.com/anthropics/claude-code/issues/2422) (closed not-planned; [#44678](https://github.com/anthropics/claude-code/issues/44678) is the open feature request) — typing `/flow:bug-` autocompletes only `bug-*` members.

**Lone exception:** `init` (both `/flow:init` and `/design:init`) is a bare-verb that mirrors Claude Code's built-in `/init`. The plugin-namespace prefix (`flow:` / `design:`) keeps them unambiguous against the built-in, so the filename doesn't need a `setup-` group prefix. Documented in both `CATEGORIES.md` files. No other bare-verb exceptions without a DDR.

When adding a new command/skill/agent: pick the group from `CATEGORIES.md`, name the file `<group>-<verb>.md`, and set frontmatter `name: <plugin>:<filename-sans-md>`, `category:`, `description:`.

### Flow plugin: `<project>` placeholder convention

Every flow command/skill is project-agnostic. They read `.ai/workflows.config.json` to resolve a `<project>` placeholder and feature toggles (`boundaries.*`, `motion.*`, `responsive.*`, `skills.*`, `integrations.*`). When adding or editing flow content under `plugins/flow/`, **do not hardcode this repo's specifics** — the same plugin runs against arbitrary downstream repos. Reach for the config; if a knob doesn't exist, extend `plugins/flow/.claude-plugin/config.schema.json` rather than hardcoding.

### `.ai/` skeleton vs. this repo's own `.ai/`

`plugins/flow/templates/ai-skeleton/` is the template that `mdcc init` copies into a target project. This repo also has its own `.ai/` directory at the root — that's md-claude *dogfooding* flow on itself (see README "Local development" section). **The two are independent.** Edits to `plugins/flow/templates/ai-skeleton/` only affect future `mdcc init` runs in other repos; edits to `/Volumes/D/git/claude-design/.ai/` only affect work on this repo.

`cli/commands/init.mjs` does string templating during the copy: it replaces `PROJECT_NAME` and rewrites the `$schema` ref in `workflows.config.json` from a relative path to an absolute GitHub raw URL (because after npm install the schema is no longer at a stable relative location). When changing the skeleton, keep this rewrite in mind for any files added to the `TEMPLATED` list.

### Published npm surface

`package.json` `files` is intentionally minimal — only `cli/`, `plugins/design/dev-server/`, `plugins/design/templates/`, `plugins/flow/templates/`, the flow config schema, `LICENSE`, and `README.md` ship to npm. The plugin commands/agents/skills (`plugins/*/commands/`, etc.) are **NOT** published via npm — they reach users through the Claude Code plugin marketplace mechanism (`/plugin install`). When adding a new top-level directory that the CLI needs at runtime, add it to `files` or `mdcc` will break for end users.

## Design system bootstrap (`.design/`)

When the user asks you to scaffold a design system for ANY project, do not improvise. The design plugin has TWO setup commands plus skill-driven bootstrap:

- **`/design:init`** — project-level environment init (deps check, install hints, CLAUDE.md / .ai/ offers, writes skeleton `.design/config.json` with `designSystems: []`). Mirrors `/flow:init`. **Does NOT create a DS.** Auto-invoked transparently when other commands hit a missing `.design/config.json`.
- **`/design:setup-ds <name> "[brief]"`** — dedicated command for creating a DS (first or additional). Auto-invokes `init` first if needed.
- **Auto-load skill `design-system` (BOOTSTRAP mode)** when `/design:edit "..."` or `/design:new "..."` is invoked against a `<designRoot>/system/` that has no DS yet.

Nine rules govern the result:

- **Onboard before bootstrap.** `/design:init` is the gate: it runs dependency pre-flight, surfaces install hints, and writes a skeleton `.design/config.json` with empty `designSystems: []`. Only after that does `/design:setup-ds` (or auto-load) run DS bootstrap. Onboard is auto-invoked transparently when other commands detect a missing config.

- **One skill owns DS work.** Skill `design-system` (`plugins/design/skills/design-system/SKILL.md`) has TWO modes: READ (default — load active canvas's DS context for iteration) and BOOTSTRAP (create / extend / re-bootstrap). Mode is auto-detected on invocation. **There is NO separate `init` skill.** If you see one, delete it — it's WIP residue.

- **Three bootstrap sub-modes.** `first-bootstrap` (no config exists, or `designSystems[]` empty), `additional-ds` (config exists, new name), `re-bootstrap` (existing DS, requires `--force`). Each runs different discovery (full 8-Q vs reduced 7-Q + Q_purpose + inheritance picker vs pre-filled 8-Q).

- **Inspiration library, not substrate.** The template at `plugins/design/templates/design-system-inspiration/` is a REFERENCE inventory. Skill (bootstrap mode) reads it as "this is what a good specimen looks like", then GENERATES project-flavored files based on discovery answers. Do not naively copy reference files; do not include placeholder copy ("Lorem", "Click here", "Acme Corp.") in scaffolded output.

- **Dynamic scaffold count.** A project gets 11–24 specimens out of the library (Core 10 preview + Universal 6 preview + 1–2 `ui_kits/<platform>/index.html` always-on compositions). Selection driven by `_MAPPING.md` based on discovery answers. Marketing sites get fewer; pro-tools with multiplayer get more. Use `config.json`'s `activeFamilies[]` to know what's in scope.

- **Single-DS default dirname is the literal `project`.** Multi-DS opt-in uses `system/<name>/` (kebab-case slug matching a `config.designSystems[]` entry). Never use `system/<slug-of-project-name>/` — that's the D2 divergence the completeness-critic flags as a blocker (Tier 1, C2).

- **Three-tier compliance.** `design-system-completeness-critic` enforces three tiers: Core (blocker, regardless of profile), Conventional (warning, gated by `activeFamilies` + `completenessProfile`), Free-form (no check, acknowledged). Lets the system stay extensible without weakening compliance. Profile knob (`completenessProfile: minimal | standard | strict`) lives in `config.json`.

- **Bootstrap success ≠ DS success.** `design-system-completeness-critic` is **structural-only** — it cannot catch shadcn-generic aesthetics, missing brand prominence, claim-without-artifact drift, or layouts that read as "lonely centered column in a dark void". The bootstrap flow therefore ALSO auto-runs (a) `agent-browser` screenshots of 3 signature specimens into `<designRoot>/_history/_system/000-bootstrap-screenshots/`, and (b) an aesthetic critic panel — at minimum `signature-moment-critic` + `graphic-design-critic` — on `colors-accent.html` and `ui_kits/desktop/index.html`. Aspiration_score < 3.0 OR any graphic-design blocker surfaces as a **named warning** in the next-step block, NOT as a silent pass. See `.ai/logs/system-reviews/setup-ds-studio-review.md` (2026-05-13) for the canonical incident this rule patches; the bootstrap flow shipped pre-fix and produced a "structurally valid + aesthetically weak" output that scored 2.3/5 on signature-moment and 0/5 on brand prominence.

- **Daily verb is `/design:edit`, not `/design`.** The bare `/design` form was a v0.8 one-version compat stub; **removed in v0.9**. Cross-reference docs with `/design:edit` only. Renamed verbs: `/design:edit` (was `/design` in v0.8), `/design:setup-docs` (was `/design:docs` in v0.8).

Reference: `/Volumes/D/git/dugmate/.design/system/project/` (the canonical real-world example).
Library: `plugins/design/templates/design-system-inspiration/`.
Skill: `plugins/design/skills/design-system/SKILL.md`.
Completeness-critic: `plugins/design/agents/design-system-completeness-critic.md`.
Slash commands: `plugins/design/commands/{init,setup-ds,setup-docs,help}.md`.
Per-DS canvas attribution: `<canvas>.meta.json.designSystem` (kebab-case slug; multi-DS projects only).
Categories catalog: `plugins/design/CATEGORIES.md`.

## Release flow

1. `scripts/bump-version.sh patch` (or `minor`/`major`/explicit `X.Y.Z`) — updates all three version fields together.
2. `scripts/check-version-parity.sh` — sanity check (also runs in CI on PRs touching `package.json` or the design plugin manifest; note the workflow does not currently watch the flow plugin manifest, so don't bypass the local script).
3. `git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags`.
4. The `v*` tag triggers `.github/workflows/publish.yml`, which re-runs parity, asserts the tag matches `package.json`, and publishes to npm with `--access public --provenance`.

Never bump versions by hand or with `npm version` — the script is the single source of truth for keeping all three manifests in lockstep.

## Working on plugin internals locally

For testing edits to plugin commands/skills/agents, the README's "Local development" section is the canonical recipe: point the marketplace at the local working tree (`/plugin marketplace add /absolute/path/to/md-claude`), then `/plugin marketplace update md-claude` + `/reload-plugins` after each edit. **Test in a scratch project** (`cd /tmp/scratch && claude`) rather than from this repo's directory — otherwise this repo's own `.ai/` workspace tangles with the plugin you're testing.

For dev-server code changes specifically: kill the running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it; the orchestrator checks `<designRoot>/_server.json` and respawns when stale.
