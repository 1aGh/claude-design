# md-claude — Claude Code marketplace

A personal marketplace of Claude Code plugins by Michal Dovrtěl (`1aGh`). Two plugins today, plus an `mdcc` CLI for scaffolding and running the bundled dev tooling.

| Plugin | What it does |
| ------ | ------------ |
| **`design`** | Canvas-first iteration on HTML/JSX mocks under `.design/` — element selection via Cmd+Click, auto-managed dev server, chained UX/DS critique. |
| **`flow`** | Generic agentic workflow loop with a second-brain `.ai/` workspace. `/flow:plan`, `/flow:execute`, `/flow:verify`, `/flow:validate`, `/flow:done`, `/flow:onboard`, `/flow:ddr`, `/flow:scenario`, …. Project-agnostic via `<project>` placeholders + per-repo `.ai/workflows.config.json`. |

Plus the **`mdcc`** CLI (Michal Dovrtěl Claude Code) — `mdcc init` scaffolds a fresh `.ai/` workspace from the flow plugin skeleton; `mdcc design serve` boots the design dev server.

## Quick start

### 1. Add the marketplace inside Claude Code

```
/plugin marketplace add 1aGh/md-claude
```

### 2. Install the plugins you want

```
/plugin install design@md-claude
/plugin install flow@md-claude
```

Then `/reload-plugins` and you should see `/design`, `/design:*`, `/flow:plan`, `/flow:execute`, etc.

### 3. Install the CLI

```sh
# From npm (once published):
npm i -g md-claude

# Or directly from GitHub:
npm i -g github:1aGh/md-claude
```

After install you have two bins on `$PATH`:

- `mdcc` — the namespace CLI (`init`, `config`, `design serve`).
- `claude-design-server` — direct alias for the dev server (kept for back-compat).

### 4. Bootstrap a repo

In any project root:

```sh
mdcc init                          # scaffold .ai/ + PROJECT.md from the flow skeleton
mdcc config set platforms '["web-desktop","web-mobile"]'
mdcc design serve                  # if you want the design canvas
```

Inside Claude Code, `/flow:onboard` then `/flow:status` to confirm the workspace is wired up.

## Runtime requirements

- **Node ≥ 20** — for the dev server and CLI. Zero npm runtime deps.
- **Claude Code** — desktop app, CLI, or IDE extension.
- Optional: **`agent-browser`** for design screenshot evidence (see below).

## The `flow` plugin — agentic workflow loop

A project-agnostic workflow harness. Every command resolves the `<project>` placeholder from `.ai/workflows.config.json` so the same plugin works across repos without forking.

### Commands

| Command | Purpose |
| ------- | ------- |
| `/flow:onboard` | Auto-detect stack, populate `PROJECT.md`. |
| `/flow:status` | Where am I? Active phase, plan, blockers. |
| `/flow:create-prd <feature>` | Draft a PRD into `.ai/plans/`. |
| `/flow:plan <prd>` | Generate a feature plan with task list. |
| `/flow:execute <plan>` | Work the plan, tick tasks. |
| `/flow:verify` | Light per-file validation during execution. |
| `/flow:validate` | Full gate: tests + build + scenario + a11y + design consistency. |
| `/flow:done` | Close out feature: validate → DDR sweep → commit → push → PR → retro → archive. |
| `/flow:pause` / `/flow:resume` | Session continuity via `HANDOFF.md`. |
| `/flow:ddr <title>` | Record a Design Decision Record. |
| `/flow:retro` | Implementation-vs-plan retrospective. |
| `/flow:scenario <flow>` | Cross-platform UI scenario run with screenshots. |
| `/flow:bug-rca` / `/flow:bug-fix` | Root-cause analysis then targeted fix from a GitHub issue. |
| `/flow:code-review` | Pre-commit self-review. |
| `/flow:quick` | Fast path for trivial changes (skip the full plan cycle). |
| `/flow:map-codebase` / `/flow:context` | Refresh / prime the codebase snapshot. |
| `/flow:ai-health` | Diagnose the workflow infrastructure itself. |
| `/flow:discover` | Search AI capabilities by natural-language task description. |
| `/flow:maintain-clean` / `/flow:maintain-docs` | Periodic upkeep. |
| `/flow:execution-report` / `/flow:validate-a11y` / `/flow:validate-visual` | Targeted variants. |

### Subagents (auto-spawned)

- `scenario-runner` — orchestrates cross-platform scenarios.
- `a11y-auditor` — WCAG 2.1 AA pass over changed UI.
- `design-system-guard` — compares rendered UI to the project's design system doc.
- `test-coverage` — flags untested logic paths.

### Skills (auto-loaded knowledge)

`workflow-state`, `ddr-keeper`, `scenario`, `agent-browser`, `agent-device`, `codebase-intelligence`, `a11y-checker`, `question-protocol`, `make-skill-template`.

### `.ai/` workspace

`mdcc init` scaffolds:

```
.ai/
├── README.md                        — guide
├── INDEX.md                         — second-brain map
├── workflows.config.json            — per-repo config (validated against config.schema.json)
├── state/STATE.md                   — workflow state (single source of truth)
├── plans/                           — feature plans + archive/
├── decisions/                       — DDRs (append-only)
├── reviews/                         — code reviews + retros
├── scenarios/                       — cross-platform UI scenario specs + run reports
├── logs/                            — system audit logs
├── context/                         — codebase snapshots
├── business/, docs/, dev-logs/      — hand-curated knowledge
├── browser/, device/, design-import/ — automation evidence buckets
└── templates/                       — copy-paste starters
```

Plus `PROJECT.md` at the repo root (identity, stack, constraints) and optionally `.ai/<project>-prd.md` + `.ai/<project>-design-system.md`.

### Config

`.ai/workflows.config.json` — schema at `plugins/flow/.claude-plugin/config.schema.json`. Sections: `name`, `language`, `theme`, `paths`, `platforms`, `bundleIdPrefix`, `boundaries` (realtime / video / api / db / auth / telemetry / payments), `motion` (duration ceilings), `responsive` (breakpoints, density map), `ux` (response targets, bilingual codes), `skills` (per-skill enable toggles), `integrations` (tracker / analytics / ci / design — lightweight pointers with free-form `defaults`; see [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)).

Read/write via the CLI:

```sh
mdcc config show
mdcc config get motion.complex
mdcc config set platforms '["web-desktop","web-mobile","ios-phone"]'
```

## The `design` plugin — canvas-first iteration

A local Claude-Design clone: iterate on HTML mocks in your repo's `.design/` folder with live element selection, automatic snapshots, and an inline critic panel.

### Commands

| Command | Effect |
| ------- | ------ |
| `/design "<feedback>"` | **Default.** Edit the active canvas in place. If a Cmd+Click selection is active, edit scopes to that element only. Auto-snapshot before every edit. |
| `/design:new <Name> "<brief>" [--component] [--mobile]` | Scaffold a NEW canvas (`.html`) or component (`.jsx`) via `frontend-design`. |
| `/design:rollback [--steps N] [--list]` | Restore last snapshot. |
| `/design:screenshot [--area] [--selector]` | Capture via agent-browser. |
| `/design:critic` | Spawn `design-critic` subagent — UX (7-layer) + DS compliance. |
| `/design:handoff [--target]` | Convert active canvas into production code (`apps/web` or `apps/mobile`). |
| `/design:browse` | Boot/show the dev server (idempotent). |
| `/design:docs` | Maintain canvas README + INDEX. |

### Dev server

```sh
mdcc design serve                    # auto-port from 4321
mdcc design serve --port 4399        # explicit port
mdcc design serve --root /path/to/repo
# or the legacy bin:
claude-design-server
```

In a project's `package.json` it's idiomatic to wrap it:

```json
{ "scripts": { "design": "mdcc design serve" } }
```

The server resolves the project root in this order: `--root <path>` arg → `$CLAUDE_PROJECT_DIR` env → `process.cwd()`.

### Element selection (pin-to-element edits)

The dev server injects an inspector overlay into every served HTML under `<designRoot>`:

- **Cmd / Ctrl / Alt + hover** → highlight + label.
- **Cmd + click** → select element; push to `<designRoot>/_active.json.selected` via WebSocket.
- **Esc** or `×` in the status bar → clear.

When a selection is active, the next `/design "<feedback>"` is **scoped** to that element only — the orchestrator builds a prompt with CSS selector, dom path, outerHTML, bounds.

### Server runtime files (all gitignored)

| File | Purpose |
| ---- | ------- |
| `<designRoot>/_server.json` | `{ pid, port, url, started }` — orchestrator detects running instance. |
| `<designRoot>/_active.json` | `{ active, open_tabs, selected, last_change }` — frontend pushes on every tab click. |
| `<designRoot>/_server.log` | nohup output when auto-started in background. |
| `<designRoot>/_history/<slug>/` | snapshot stack per canvas. |

### Dependencies

Run inside Claude Code:

```
# Required — needed by /design:new (first-pass canvas generation)
/plugin marketplace add anthropics/claude-code
/plugin install frontend-design@claude-code

# Optional — slider variant exploration
/plugin install playground@claude-code
```

Plus the external `agent-browser` CLI for `/design:screenshot`:

```sh
npm install -g agent-browser
agent-browser install                # one-time: downloads Chrome
```

If you skip `agent-browser`, the rest of the plugin still works — you just won't get screenshot evidence in critic reports.

## Updating

Bump version with `scripts/bump-version.sh` (keeps `package.json` and `plugins/design/.claude-plugin/plugin.json` in lockstep — CI enforces parity via `.github/workflows/version-parity.yml`). Push to `main`, then in Claude Code:

```
/plugin marketplace update md-claude
/plugin install design@md-claude
/plugin install flow@md-claude
```

## Releasing

The npm package (`md-claude`) and the Claude Code plugins (`design@md-claude`, `flow@md-claude`) share the same version.

```sh
scripts/bump-version.sh patch          # or minor / major / X.Y.Z
scripts/check-version-parity.sh        # asserts files match
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which re-runs the parity check, verifies the tag matches `package.json`, and publishes with `--access public --provenance`.

### One-time setup (project owner)

1. Create an **Automation** token at <https://www.npmjs.com/settings/~/tokens>.
2. GitHub repo → **Settings → Secrets → Actions** → `NPM_TOKEN`.
3. `id-token: write` is already enabled in `publish.yml` for npm provenance.

## Local development (plugin authors)

```
/plugin marketplace add /absolute/path/to/md-claude
/plugin install design@md-claude
/plugin install flow@md-claude
```

Working on plugin internals:

1. **Edit in place** — the local marketplace points at your working tree.
2. **Reload after edits:**
   - Commands / agents / skills → `/plugin marketplace update md-claude` then `/reload-plugins`.
   - Dev server code → kill the running process (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart.
3. **Test in isolation** — open Claude Code from a scratch project (`cd /tmp && claude`) so plugins aren't entangled with this repo's own `.ai/`.
4. **Dogfood** — md-claude itself uses `flow` for plan/execute/done. Once `flow` is installed against this marketplace, you can drive its own development with `/flow:plan`, `/flow:execute`, etc.

## License

MIT — see [LICENSE](./LICENSE).
