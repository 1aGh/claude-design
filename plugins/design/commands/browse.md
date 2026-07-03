---
name: design:browse
category: daily
description: Launch the local design browser — file tree of every canvas + tabbed iframe preview on a free port
argument-hint: "[--port <n>]"
---

# /design:browse — local design canvas

Launches a mini Node server (zero deps) that scans the project's design root (`<designRoot>` from `.design/config.json`, default `.design/`) and builds a 2-pane UI in the browser:

- **Left column** — file tree (collapsible by hierarchy + group labels from the config)
- **Right side** — tabbed iframe preview, like in an editor
- **Inspector overlay** inside every canvas (Cmd+hover highlight, Cmd+click select, Esc clear)
- **Status bar** — active file + selection (`<designRoot>/_active.json`)

The server reads `<repo>/.design/config.json` at boot. Auto-finds a free port from **4321** and opens the default browser. Idempotent: if already running, it just prints the URL. `Ctrl+C` in the terminal stops it.

**Input `$ARGUMENTS`:** `[--port <n>]`

- `--port <n>` — force a specific port (default = first free port from 4321).

## Procedure

```bash
# Direct boot (Bun-based server, reads $CLAUDE_PROJECT_DIR if set, otherwise cwd):
bun ${CLAUDE_PLUGIN_ROOT}/dev-server/server.ts --root "$CLAUDE_PROJECT_DIR"

# With explicit port:
bun ${CLAUDE_PLUGIN_ROOT}/dev-server/server.ts --root "$CLAUDE_PROJECT_DIR" --port 4400

# Headless (no auto-open browser, useful in CI / SSH):
NO_OPEN=1 bun ${CLAUDE_PLUGIN_ROOT}/dev-server/server.ts --root "$CLAUDE_PROJECT_DIR"
```

`--root` is an explicit option — if omitted, the server falls back to `$CLAUDE_PROJECT_DIR` and then to `process.cwd()`. It always points at the **user's project**, not the plugin's install dir (`${CLAUDE_PLUGIN_ROOT}` is used only to locate `server.ts`).

The repo may have a wrapper script in `package.json` (e.g. `pnpm design:browse`) — if it exists, use it. Otherwise the direct invocation above.

## What the server supports

- **Live re-scan** — the `↻ tree` button in the UI re-scans the disk (or Cmd+R / F5 on the index page).
- **Per-tab reload** — the `↻ active` button (or Cmd+R inside the UI) reloads only the active iframe, not the whole app.
- **Open in system browser** — the `↗ system` link opens the active mock in a new tab (useful for DevTools, screenshots).
- **Keyboard:** `Cmd+W` closes the active tab, `Cmd+R` reloads the active iframe.
- **Path safety:** the server rejects everything outside the repo root.

## Server endpoints

| Endpoint | Purpose |
|---|---|
| `/` | UI (file tree + tabs + inspector) |
| `/_health` | Health check `{ ok, app, project, pid, port }` |
| `/_active` | Current `_active.json` content |
| `/_config` | Resolved per-repo config (echoed from `.design/config.json` + defaults) |
| `/_ws` | WebSocket for tab/selection state |

## When /design:browse vs `open <file>`

- **`open <file>`** — a quick one-off look at a single file via `file://`. **No inspector overlay, no `_active.json` tracking.**
- **`/design:browse`** — when you want the orchestrator with the `/design:edit "<feedback>"` flow. Tab tracking, element selection (Cmd+click), inspector overlay, snapshots — all of it runs through the server.

The orchestrator (`/design:edit`, `/design:new`, etc.) auto-starts the server itself if it isn't running — `/design:browse` is just an explicit boot for the browsing-only use case.

## Failure modes

- **Ports 4321–4420 all taken** → the server throws `no free port`. Run with `PORT=<free>`.
- **Node < 18** → top-level `await` doesn't work. The server requires Node 18+.
- **Spaces in filenames** — the server URL-decodes, link generation encodes. It works.
- **`.design/config.json` missing or invalid** — the server warns in the log and uses defaults.
