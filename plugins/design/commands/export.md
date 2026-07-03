---
name: design:export
category: daily
description: Export the active canvas — PNG / PDF / SVG / HTML / PPTX / Canva handoff bundle / project ZIP. Thin slash wrapper over `POST /_api/export` (same engine as the ⌘E UI dialog).
argument-hint: "<png|pdf|svg|html|pptx|canva|zip> [--scope selection|artboard|canvas-as-separate|project-raw] [--out <path>] [--option key=value]"
---

# /design:export — export active canvas

Sends a request to the running dev-server (`POST /_api/export`) with the same payload the ⌘E dialog inside the canvas sends. The server writes the file and this slash command pulls it down to disk (default cwd, or `--out <path>`).

**Prerequisite:** the dev-server is running (`maude design serve` or `/design:new` brings it up). The slash command reads the port from `.design/_server.json`.

## Input `$ARGUMENTS`

| Flag | Meaning |
|---|---|
| `<format>` (required) | `png` / `pdf` / `svg` / `html` / `pptx` / `canva` / `zip` |
| `--scope <s>` | `selection` / `artboard` / `canvas-as-separate` / `project-raw`. Default = `canvas-as-separate` for element-shape formats, `project-raw` for `zip`. |
| `--out <path>` | Where to write. Default = cwd + the filename the server returns in `Content-Disposition`. |
| `--option key=value` | Per-format option. Can be repeated. Examples: `--option pageFit=a4` (PDF), `--option mode=raster` (Canva → legacy raster bundle), `--option include=system` (ZIP filter). |

## Examples

```
# Active canvas → multi-page PDF, one artboard per page
/design:export pdf --scope canvas-as-separate

# Selected element → PNG to ~/Downloads/hero.png
/design:export png --scope selection --out ~/Downloads/hero.png

# Editable Canva handoff bundle (PPTX + .canva-handoff.md)
/design:export canva

# Legacy raster bundle (PNG+CSV+README, no editable PPTX)
/design:export canva --option mode=raster

# Whole `.design/` source ZIP, DS subtree only
/design:export zip --option include=system

# A4 PDF instead of the artboard's native dimensions
/design:export pdf --option pageFit=a4
```

## What the command does

1. **Detects the port** from `.design/_server.json` (or a `--port N` override).
2. **Resolve scope:** if the user didn't pass `--scope`, use the plan-defined default (`canvas-as-separate` for element formats, `project-raw` for `zip`).
3. **POST** `http://localhost:<port>/_api/export` with body `{ format, scope, options }`.
4. **Writes the bytes** to the `--out` path (or cwd + the server-supplied filename).
5. **Stdout:** `wrote <abs-path> (<bytes> bytes)`. Stderr on error.

No network calls outside localhost. No OAuth / token storage — the Canva handoff returns a PPTX + markdown with a prompt block for your MCP (see `plugins/design/docs/canva-handoff.md`).
