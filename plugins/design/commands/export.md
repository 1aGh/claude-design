---
name: design:export
category: daily
description: Export aktivního canvasu — PNG / PDF / SVG / HTML / PPTX / Canva handoff bundle / project ZIP. Thin slash wrapper nad `POST /_api/export` (stejný engine jako UI dialog ⌘E).
argument-hint: "<png|pdf|svg|html|pptx|canva|zip> [--scope selection|artboard|canvas-as-separate|project-raw] [--out <path>] [--option key=value]"
---

# /design:export — export active canvas

Pošle požadavek na běžící dev-server (`POST /_api/export`) se stejným payloadem, jaký posílá ⌘E dialog uvnitř canvasu. Server zapíše soubor a tenhle slash command ho dotáhne na disk (default cwd, nebo `--out <path>`).

**Předpoklad:** dev-server běží (`maude design serve` nebo `/design:new` ho nahodí). Slash command čte port z `.design/_server.json`.

## Vstup `$ARGUMENTS`

| Flag | Význam |
|---|---|
| `<format>` (povinné) | `png` / `pdf` / `svg` / `html` / `pptx` / `canva` / `zip` |
| `--scope <s>` | `selection` / `artboard` / `canvas-as-separate` / `project-raw`. Default = `canvas-as-separate` pro element-shape formáty, `project-raw` pro `zip`. |
| `--out <path>` | Kam zapsat. Default = cwd + filename, který server vrátí v `Content-Disposition`. |
| `--option key=value` | Per-format option. Lze opakovat. Příklady: `--option pageFit=a4` (PDF), `--option mode=raster` (Canva → legacy raster bundle), `--option include=system` (ZIP filtr). |

## Příklady

```
# Aktivní canvas → multi-page PDF, jeden artboard na stránku
/design:export pdf --scope canvas-as-separate

# Vybraný element → PNG do ~/Downloads/hero.png
/design:export png --scope selection --out ~/Downloads/hero.png

# Editable Canva handoff bundle (PPTX + .canva-handoff.md)
/design:export canva

# Legacy raster bundle (PNG+CSV+README, bez editovatelné PPTX)
/design:export canva --option mode=raster

# Celý `.design/` source ZIP, jen DS subtree
/design:export zip --option include=system

# A4 PDF místo native rozměrů artboardu
/design:export pdf --option pageFit=a4
```

## Co command provede

1. **Detekuje port** z `.design/_server.json` (nebo `--port N` override).
2. **Resolve scope:** pokud uživatel neuvedl `--scope`, použije plan-definovaný default (`canvas-as-separate` pro element formáty, `project-raw` pro `zip`).
3. **POST** `http://localhost:<port>/_api/export` s body `{ format, scope, options }`.
4. **Zapíše bytes** do `--out` cesty (nebo cwd + server-supplied filename).
5. **Stdout:** `wrote <abs-path> (<bytes> bytes)`. Stderr na chybu.

Žádné network volání mimo localhost. Žádné OAuth / token storage — Canva handoff vrací PPTX + markdown s prompt blockem pro tvůj MCP (viz `plugins/design/docs/canva-handoff.md`).
