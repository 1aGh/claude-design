---
description: Spustí lokální Dugmate Design browser — file tree všech mocků + tabbed iframe preview na volném portu
argument-hint: "[--port <n>]"
---

# /design:browse — local design canvas

Spustí mini Node server (zero deps) co skenuje:
- **Design system** — tokens preview + ui kits desktop/mobile (`.ai/design/system/project/...`)
- **UI kit** — full canvas mocks (`.ai/design/ui/project/Dugmate Studio.html`, `Dugmate Mobile.html`, …)

a vyrobí v prohlížeči 2-pane UI:
- **Levý sloupec** — file tree (collapsible podle skill / dir hierarchy)
- **Pravá strana** — tabbed iframe preview, jako v editoru
- **Inspector overlay** uvnitř každého canvasu (Cmd+hover highlight, Cmd+click select, Esc clear)
- **Status bar** — aktivní soubor + selection (`.ai/design/_active.json`)

Server auto-najde volný port od **4321** a otevře default browser. Idempotent: pokud už běží, jen vypíše URL. `Ctrl+C` v terminálu zastaví.

**Vstup `$ARGUMENTS`:** `[--port <n>]`

- `--port <n>` — vynutit konkrétní port (default = první volný od 4321).

## Postup

```bash
pnpm design:browse                                    # default — najde volný port od 4321, otevře browser
PORT=4400 pnpm design:browse                          # vynutit konkrétní port
pnpm design:headless                                  # bez auto-open (CI / SSH)

# přímé spuštění (pokud bys neměl pnpm po ruce):
node .claude/plugins/design/dev-server/server.mjs
```

## Co server podporuje

- **Live re-scan** — `↻ tree` button v UI re-skenuje disk (nebo Cmd+R / F5).
- **Per-tab reload** — `↻ active` button (nebo Cmd+R uvnitř UI) reloadne jen aktivní iframe, ne celou aplikaci.
- **Open in system browser** — `↗ system` link otevře aktivní mock v novém tabu (užitečné pro DevTools, screenshots).
- **Keyboard:** `Cmd+W` zavře aktivní tab, `Cmd+R` reloadne aktivní iframe.
- **Path safety:** server odmítne všechno mimo repo root.

## Kdy /design:browse vs `open <file>`

- **`open <file>`** — rychlé jednorázové prohlédnutí jednoho souboru přes `file://`. **Žádný inspector overlay, žádný `_active.json` tracking.**
- **`/design:browse`** — když chceš orchestrátor s `/design "<feedback>"` flow. Tab tracking, element selection (Cmd+click), inspector overlay, snapshots — to vše jede přes server.

Orchestrator (`/design`, `/design:new`, atd.) sám server auto-startne pokud neběží — `/design:browse` je jen explicit boot pro browsing-only use case.

## Failure modes

- **Port 4321–4420 všechny obsazené** → server vyhodí `no free port`. Spusť s `PORT=<volný>`.
- **Node < 18** → top-level `await` nefunguje. Repo má nyní Node 24, ale pokud bys měl starší, fail loud.
- **Spaces v názvech (např. `Dugmate Studio.html`)** — server URL-decoduje, link generation enkóduje. Funguje.
