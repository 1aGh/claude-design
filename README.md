# claude-design — canvas-first design iteration

A local Claude-Design clone: iterate on HTML mocks in your repo's `.design/` folder with live element selection, automatic snapshots, and an inline critic panel. Ships as a **Claude Code plugin** *and* a **standalone Node CLI** (`claude-design-server`) — the same dev server backs both.

> The repo also vendors a generalised PRD-driven AI workflow loop (`/plan`, `/execute`, `/done`, `/verify`, `/validate`, `/ddr`, plus supporting agents and skills under `.claude/` and `.ai/`) so any project can adopt the same canvas → critique → handoff cycle.

## Quick start

### A) As a Claude Code plugin

```
/plugin marketplace add 1aGh/claude-design && /plugin install design@claude-design
```

Then `/reload-plugins`, run `/design:browse` to open the local canvas browser, click into a `.design/<your-mock>.html`, and iterate with `/design "<feedback>"`.

### B) As a standalone CLI

Install once globally, then run from any repo root:

```sh
# Install from GitHub (no npm publish required):
npm i -g github:1aGh/claude-design

# Or once published to npm:
npm i -g claude-design

# Then in any repo with a .design/config.json:
claude-design-server                       # boots on first free port from 4321
PORT=4400 claude-design-server             # explicit port
claude-design-server --root /path/to/repo  # explicit repo root
```

In a project's `package.json` it's idiomatic to wrap it:

```json
{
  "scripts": {
    "design": "claude-design-server"
  }
}
```

The server resolves the project root in this order: `--root <path>` arg → `$CLAUDE_PROJECT_DIR` env → `process.cwd()`. So `pnpm design` from your repo root just works.

## Dependencies

Run these slash commands inside Claude Code — they bring in the official Anthropic plugins this one chains against:

```
# Required — needed by /design:new (first-pass canvas generation)
/plugin marketplace add anthropics/claude-code
/plugin install frontend-design@claude-code

# Optional — slider variant exploration
/plugin install playground@claude-code
```

Runtime requirements: **Node ≥ 20** (the bundled dev server uses `node:http` + WebSocket, zero npm deps).

### External tool — `agent-browser`

Required for `/design:screenshot` and for canvas screenshots auto-captured by the critic. It's a standalone Rust CLI distributed at <https://agent-browser.dev>:

```sh
npm install -g agent-browser     # all platforms
# or
brew install agent-browser       # macOS
# or
npx agent-browser open example.com   # try without installing

agent-browser install            # one-time: downloads Chrome
```

The rest of the plugin works without it — `/design`, `/design:new`, `/design:critic` all run fine; you just won't get screenshot evidence in critic reports.

If you prefer a guided env check, clone the repo and run `./scripts/install.sh` — it verifies Node and prints the exact slash commands for your current shell.

## What it gives you

- **Canvas-first iteration.** `/design "<feedback>"` edits the file you have **active in the browser tab** — not a new session. Like Claude Design's canvas: open `Mobile.html`, click into it, then say "presence dot 8px in roster" → that file is mutated in place. Sessions only spawn on explicit `/design:new`.
- **Active state via WebSocket.** A local Node dev server (zero deps, ~600 LOC) tracks which tab the user is focused on and writes `<designRoot>/_active.json` (default `.design/_active.json`). The orchestrator reads it before every command.
- **Auto-snapshot before every edit.** `<designRoot>/_history/<file-slug>/<NNN>-<ts>.bak` (gitignored). Undo via `/design:rollback`.
- **Auto-server lifecycle.** Every command checks `<designRoot>/_server.json`; if no server running, auto-starts in background. Never spawns a duplicate.
- **Three-engine orchestration.** First-pass generation (sessions only) uses `frontend-design`. Slider exploration uses `playground`. Critique is fully embedded in the plugin's `design-critic` (7-layer UX walk + DS-compliance protocol inline) and a panel of nine specialty critics (`a11y`, `brand`, `copy`, `frontend`, `graphic-design`, `info-architecture`, `motion`, `signature-moment`, `typography`).
- **Native handoff.** `/design:handoff` migrates active canvas to `apps/web` or `apps/mobile` (Next.js / Expo + Tailwind + shadcn / NativeWind).

## Skills (auto-loaded by Claude when relevant)

| Skill | Purpose |
|---|---|
| `design` | The orchestrator. Server lifecycle, active-canvas detection, snapshot protocol, command routing, engine chaining. |
| `design-system` | **Pointer** → content lives at `<designRoot>/system/` (tokens, specimens, ui kits desktop+mobile). |
| `ui-kit` | **Pointer** → content lives at `<designRoot>/ui/` (full surface mocks, chat history). |

The plugin's `skills/` folder is just `SKILL.md` shells. The actual design content lives at `<designRoot>` (default `.design/`). See `.design/README.md`.

## Commands

| Command | Effect |
|---|---|
| **`/design "<feedback>"`** | **Default.** Edit the active canvas in place. If the user has Cmd+Clicked an element, edit is scoped to that element only. Auto-snapshot before every edit. |
| `/design:new <Name> "<brief>" [--component] [--mobile]` | Scaffold a NEW canvas file in `<designRoot>/<newCanvasDir>/<Name>.html` (or `<newComponentDir>/<PascalName>.jsx`) via `frontend-design` with project envelope. |
| `/design:rollback [--steps N] [--list]` | Restore last snapshot of active canvas. `--list` to inspect history. |
| `/design:screenshot [--area] [--selector]` | Capture active canvas via agent-browser (HTTP server URL). |
| `/design:critic` | Spawn `design-critic` subagent — UX (7-layer) + DS compliance pass inline against active canvas. |
| `/design:handoff [--target]` | Convert active canvas into production code (`apps/web` or `apps/mobile`). |
| `/design:browse` | Boot/show the dev server. Idempotent — uses existing if running. |

## Subagent

- `design-critic` — performs UX 7-layer review + DS compliance protocol **inline** (both frameworks are embedded in the agent prompt — no external skill loads). Writes merged report to `<designRoot>/_history/<slug>/critique/<NNN>-design-critic.md`.

Specialty critics co-located in `plugins/design/agents/`: `a11y-critic`, `brand-critic`, `copy-critic`, `frontend-critic`, `graphic-design-critic`, `info-architecture-critic`, `motion-critic`, `signature-moment-critic`, `typography-critic`. Routed by `design-critic`'s panel mode or invoked directly via `/design:critic --agent <name>`.

## Server runtime files

All gitignored:

| File | Owner | Purpose |
|---|---|---|
| `<designRoot>/_server.json` | dev-server | `{ pid, port, url, started }` — orchestrator reads to detect running instance. Removed on SIGINT. |
| `<designRoot>/_active.json` | dev-server (via WebSocket) | `{ active, open_tabs, last_change, session_started }` — frontend pushes on every tab click. |
| `<designRoot>/_server.log` | shell | nohup output when orchestrator auto-starts server in background. |
| `<designRoot>/_history/<slug>/` | orchestrator | snapshot stack per canvas. Format: `<NNN>-<YYYYMMDDTHHMMSS>.bak`. |

## Canvas-first flow (typical)

```
# 1. Open dev-server (or just run /design — it auto-starts)
pnpm design

# 2. Click "Dugmate Mobile.html" in the file tree → it becomes active in _active.json

# 3. Iterate
/design "Add 8px presence dot before each roster row name (--status-success when online)"
  → reads _active.json → ".design/ui/project/Dugmate Mobile.html"
  → snapshots to .design/_history/dugmate-mobile-html/001-20260506T223100.bak
  → edits file in place
  → reload iframe (Cmd+R)

/design "Tighter density on Roster section — padding 8/12 instead of 12/16"
  → snapshots to 002-...bak
  → edits in place

/design:screenshot --area roster
  → agent-browser snap → _history/dugmate-mobile-html/screenshots/001-roster.png

/design:critic
  → spawns design-critic subagent
  → UX + DS pass inline against current state of the canvas + screenshot
  → _history/dugmate-mobile-html/critique/001-design-critic.md

# Don't like the last edit?
/design:rollback
  → restores 002-...bak

# Ready to ship?
/design:handoff
  → reads active canvas
  → converts to apps/mobile/app/team/[teamId]/team-hub.tsx (mobile inferred from filename)
  → tokens-used.json + handoff-report.md in _history/<slug>/handoff/
```

## Element selection (pin-to-element edits)

The dev server injects a tiny inspector overlay into every served HTML under `<designRoot>`. Inside any canvas iframe:

- **Cmd / Ctrl / Alt + hover** → element under the cursor highlights cyan + label shows tag/class
- **Cmd + click** → select that element (cyan outline + glow). The selection is pushed to `<designRoot>/_active.json.selected` over WebSocket
- **Esc** (with iframe focused) or `×` button in the status bar → clear selection
- **Switching tabs** auto-clears selection (selection is per-canvas)

When `_active.json.selected` is set, the next `/design "<feedback>"` is **scoped** to that element only. The orchestrator builds a prompt that includes the CSS selector, dom path, outerHTML snippet, bounds, and your feedback — and uses the Edit tool with disambiguating context to mutate **just that element** in the canvas file.

## Sessions are not a thing anymore

There used to be `.ai/design-sessions/<slug>/iterations/NNN.html`. Retired. New surfaces = new files in `<designRoot>/<newCanvasDir>/<Name>.html` via `/design:new`. Iteration history = `<designRoot>/_history/<slug>/<NNN>-<ts>.bak` snapshots (gitignored, restored via `/design:rollback`).

## Updates

Bump version with `scripts/bump-version.sh` (it moves `package.json` and `plugins/design/.claude-plugin/plugin.json` together — see [Releasing](#releasing) below), push to `main`, then in Claude Code:

```
/plugin marketplace update claude-design
/plugin install design@claude-design
```

Without a `version` bump every commit SHA counts as a new version. Bump deliberately when shipping user-visible changes.

## Releasing

Two release surfaces share the same version: the npm package (`claude-design`) and the Claude Code plugin (`design@claude-design`). A CI check (`.github/workflows/version-parity.yml`) blocks PRs that desync them.

### One-shot release

```sh
# 1. Bump both files in lockstep
scripts/bump-version.sh patch          # or minor / major / X.Y.Z

# 2. Sanity check
scripts/check-version-parity.sh        # should print "version parity OK: X.Y.Z"

# 3. Commit, tag, push
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

The `v*` tag push triggers `.github/workflows/publish.yml`, which:
1. Re-runs the parity check
2. Verifies the tag matches `package.json`
3. Publishes to npm with `--access public --provenance`

### Manual / dry-run publish

GitHub UI → **Actions** → **Publish to npm** → **Run workflow** — toggles `dry-run: true` to test the publish step without pushing to the registry.

### One-time setup (project owner)

1. Create an **Automation** token at <https://www.npmjs.com/settings/~/tokens> (granular access, packages-and-scopes, write).
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** → name `NPM_TOKEN`, value the token.
3. Enable **id-token: write** for the workflow (already declared in `publish.yml` for npm provenance).
4. First-time publish from your laptop is OK too: `npm login`, then `npm publish --access public` from the repo root.

## Install from a local path (plugin developers)

Cloned this repo and want the marketplace to live off your working tree?

```
/plugin marketplace add /absolute/path/to/claude-design
/plugin install design@claude-design
```

## AI workflow loops (bundled)

This repo also ships a PRD-driven workflow loop under `.claude/` and `.ai/` — the same one that built it. It is **not** installed by the design plugin; it lives in the repo itself so the project can dogfood the loop on its own development. Eventually each loop will be exposable as its own installable Claude Code plugin.

Surfaces:

- `.claude/commands/` — slash commands: `/plan`, `/execute`, `/done`, `/verify`, `/validate`, `/create-prd`, `/ddr`, `/pause`, `/resume-task`, `/status`, `/retro`, `/scenario`, `/code-review`, `/bug-rca`, `/bug-fix`, `/map-codebase`, `/context`, `/onboard`, `/ai-health`, `/discover`, `/quick`, `/maintain-clean`, `/maintain-docs`, `/execution-report`, `/validate-a11y`, `/validate-visual`.
- `.claude/agents/` — subagents: `scenario-runner`, `a11y-auditor`, `design-system-guard`, `test-coverage`.
- `.claude/skills/` — auto-loaded knowledge: `agent-browser`, `agent-device`, `scenario`, `a11y-checker`, `workflow-state`, `ddr-keeper`, `codebase-intelligence`, `question-protocol`, `make-skill-template`.
- `.ai/` — templates, decisions (DDRs), workflow state, docs.

Recommended bootstrap in a fresh repo: `/onboard` → `/map-codebase` → `/create-prd <feature>` → `/plan <prd path>` → `/execute <plan path>` → `/done`.

## Local development loop

Working on the plugin's own commands/agents/skills/dev-server:

1. **Edit in place** in your cloned `claude-design` directory. The local marketplace points at this directory, so every edit is the live source.
2. **Reload after edits:**
   - Commands / agents / skills metadata changes → `/plugin marketplace update claude-design` then `/reload-plugins` (or restart Claude Code).
   - `dev-server/` code → kill any running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it. The server is spawned on demand by the plugin.
3. **Test in isolation:** open Claude Code from a scratch project (`cd /tmp && claude`) so the plugin's behavior isn't entangled with the parent repo's `.claude/`.
4. **Two-checkout debug:** if you want to compare against a bundled copy in another repo, keep both marketplaces added — Claude resolves `design@claude-design` from the active marketplace. Disable one with `/plugin` UI to switch.
5. **Plugin smoke test:** `node plugins/design/dev-server/server.mjs --root /tmp/design-test --port 4310` boots the server standalone so you can iterate on `dev-server/client/` HTML without going through the slash command.

## License

MIT — see [LICENSE](./LICENSE).
