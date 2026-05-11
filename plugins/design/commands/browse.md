---
description: Spustí lokální design browser — file tree všech canvasů + tabbed iframe preview na volném portu
argument-hint: "[--port <n>]"
---

# /design:browse — local design canvas

Spustí mini Node server (zero deps) co skenuje project's design root (`<designRoot>` z `.design/config.json`, default `.design/`) a vyrobí v prohlížeči 2-pane UI:

- **Levý sloupec** — file tree (collapsible podle hierarchie + group labels z configu)
- **Pravá strana** — tabbed iframe preview, jako v editoru
- **Inspector overlay** uvnitř každého canvasu (Cmd+hover highlight, Cmd+click select, Esc clear)
- **Status bar** — aktivní soubor + selection (`<designRoot>/_active.json`)

Server čte `<repo>/.design/config.json` při bootu. Auto-najde volný port od **4321** a otevře default browser. Idempotent: pokud už běží, jen vypíše URL. `Ctrl+C` v terminálu zastaví.

**Vstup `$ARGUMENTS`:** `[--port <n>]`

- `--port <n>` — vynutit konkrétní port (default = první volný od 4321).

## Postup

```bash
# Direct boot (server čte $CLAUDE_PROJECT_DIR pokud je nastaveno, jinak cwd):
node ${CLAUDE_PLUGIN_ROOT}/dev-server/server.mjs --root "$CLAUDE_PROJECT_DIR"

# With explicit port:
PORT=4400 node ${CLAUDE_PLUGIN_ROOT}/dev-server/server.mjs --root "$CLAUDE_PROJECT_DIR"

# Headless (no auto-open browser, useful in CI / SSH):
NO_OPEN=1 node ${CLAUDE_PLUGIN_ROOT}/dev-server/server.mjs --root "$CLAUDE_PROJECT_DIR"
```

`--root` je explicitní volba — pokud chybí, server fallbackne na `$CLAUDE_PROJECT_DIR` a pak na `process.cwd()`. Vždy ukazuje na **uživatelův projekt**, ne na install dir pluginu (`${CLAUDE_PLUGIN_ROOT}` slouží jen k lokaci `server.mjs`).

Repo může mít wrapper script v `package.json` (např. `pnpm design:browse`) — pokud existuje, použij ho. Jinak přímé spuštění výše.

## Co server podporuje

- **Live re-scan** — `↻ tree` button v UI re-skenuje disk (nebo Cmd+R / F5 na index page).
- **Per-tab reload** — `↻ active` button (nebo Cmd+R uvnitř UI) reloadne jen aktivní iframe, ne celou aplikaci.
- **Open in system browser** — `↗ system` link otevře aktivní mock v novém tabu (užitečné pro DevTools, screenshots).
- **Keyboard:** `Cmd+W` zavře aktivní tab, `Cmd+R` reloadne aktivní iframe.
- **Path safety:** server odmítne všechno mimo repo root.

## Server endpoints

| Endpoint | Účel |
|---|---|
| `/` | UI (file tree + tabs + inspector) |
| `/_health` | Health check `{ ok, app, project, pid, port }` |
| `/_active` | Current `_active.json` content |
| `/_config` | Resolved per-repo config (echoed from `.design/config.json` + defaults) |
| `/_ws` | WebSocket pro tab/selection state |

## Kdy /design:browse vs `open <file>`

- **`open <file>`** — rychlé jednorázové prohlédnutí jednoho souboru přes `file://`. **Žádný inspector overlay, žádný `_active.json` tracking.**
- **`/design:browse`** — když chceš orchestrátor s `/design "<feedback>"` flow. Tab tracking, element selection (Cmd+click), inspector overlay, snapshots — to vše jede přes server.

Orchestrator (`/design`, `/design:new`, atd.) sám server auto-startne pokud neběží — `/design:browse` je jen explicit boot pro browsing-only use case.

## Failure modes

- **Port 4321–4420 všechny obsazené** → server vyhodí `no free port`. Spusť s `PORT=<volný>`.
- **Node < 18** → top-level `await` nefunguje. Server vyžaduje Node 18+.
- **Spaces v názvech souborů** — server URL-decoduje, link generation enkóduje. Funguje.
- **`.design/config.json` chybí nebo invalid** — server warne v logu a použije defaults.
