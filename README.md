# Dugmate Design — local Claude-Design clone

A Claude Code plugin that gives Dugmate the same iterative design workflow Anthropic's Claude Design provides — but **fully local, git-tracked, canvas-first, and chained against existing Dugmate skills**.

## What it gives you

- **Canvas-first iteration.** `/design "<feedback>"` edits the file you have **active in the browser tab** — not a new session. Like Claude Design's canvas: open `Dugmate Mobile.html`, click into it, then say "presence dot 8px in roster" → that file is mutated in place. Sessions only spawn on explicit `/design:new`.
- **Active state via WebSocket.** A local Node dev server (zero deps, ~600 LOC) tracks which tab the user is focused on and writes `<designRoot>/_active.json` (default `.design/_active.json`). The orchestrator reads it before every command.
- **Auto-snapshot before every edit.** `<designRoot>/_history/<file-slug>/<NNN>-<ts>.bak` (gitignored). Undo via `/design:rollback`.
- **Auto-server lifecycle.** Every command checks `<designRoot>/_server.json`; if no server running, auto-starts in background. Never spawns a duplicate.
- **Three-engine orchestration.** First-pass generation (sessions only) uses `frontend-design`. Slider exploration uses `playground`. Critique uses `ux-designer` + `design-system-guard` patterns inline (no nested agents).
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

- `design-critic` — performs UX 7-layer review + DS compliance protocol **inline** (reads `ux-designer/SKILL.md` + `design-system-guard.md` as frameworks, no nested invocation). Writes merged report to `<designRoot>/_history/<slug>/critique/<NNN>-design-critic.md`.

## Dependencies

- **`frontend-design`** plugin (Anthropic) — required by `/design:new` for new-canvas generation.
- **`playground`** plugin (Anthropic) — optional, for slider explorers (`/plugin install playground@claude-plugins-official`).
- **`agent-browser`** skill (Dugmate repo) — for screenshots.
- **`ux-designer`** skill (Dugmate repo) — UX framework `design-critic` reads.
- **`design-system-guard`** subagent file (Dugmate repo) — DS protocol `design-critic` reads.

## NPM scripts

| Script | Effect |
|---|---|
| `pnpm design` / `design:browse` | Boot local browser server (auto-opens browser). |
| `pnpm design:headless` | Boot without auto-open (CI / SSH). |

`PORT=4400 pnpm design` to override port (default: first free from 4321).

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

## Install

This repo is both a **single-plugin marketplace** and the plugin itself. Add it to Claude Code:

### From GitHub (when published)

```
/plugin marketplace add <owner>/<repo>
/plugin install design@claude-design
```

Updates: bump `version` in `.claude-plugin/plugin.json`, push, then in Claude Code:

```
/plugin marketplace update claude-design
```

### Local path (for development of this plugin itself)

```
/plugin marketplace add /Users/iagh/git/claude-design
/plugin install design@claude-design
```

## Local development loop

Working on the plugin's own commands/agents/skills/dev-server:

1. **Edit in place** at `/Users/iagh/git/claude-design/`. The local marketplace points at this directory, so every edit is the live source.
2. **Reload after edits:**
   - Commands / agents / skills metadata changes → `/plugin marketplace update claude-design` then `/reload-plugins` (or restart Claude Code).
   - `dev-server/` code → kill any running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it. The server is spawned on demand by the plugin.
3. **Test in isolation:** open Claude Code from a scratch project (`cd /tmp && claude`) so the plugin's behavior isn't entangled with the parent repo's `.claude/`.
4. **Two-checkout debug:** if you want to compare against the bundled copy in another repo (e.g. `dugmate/.claude/plugins/design/`), keep both marketplaces added — Claude resolves `design@claude-design` from the active marketplace. Disable one with `/plugin` UI to switch.
5. **Plugin smoke test:** `node dev-server/server.mjs --root /tmp/design-test --port 4310` boots the server standalone so you can iterate on `dev-server/client/` HTML without going through the slash command.

## Versioning

Semver in `.claude-plugin/plugin.json`. Without it, every commit SHA counts as a new version — bump it deliberately when shipping user-visible changes.

## License

TBD — currently extracted from a Dugmate-internal context. Choose a license before publishing publicly (MIT recommended for plugin distribution).
