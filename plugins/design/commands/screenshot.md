---
name: design:screenshot
category: daily
description: Capture screenshot aktivního canvasu — full, jednoho screenu, elementu, nebo všech screens v smyčce. Wrapper přes `maude design screenshot` (agent-browser primárně, playwright fallback).
argument-hint: "[--screen|--element <id> | --selector <css> | --full | --all-screens] [--area <n>]"
---

# /design:screenshot — capture active canvas

Otevře aktivní canvas (`_active.json`) přes server URL (ne `file://`), zachytí screenshot, uloží do `.design/_history/<slug>/screenshots/<NNN>-<area>.png` (gitignored).

Single source of truth pro screenshot logiku je `maude design screenshot` (on-PATH `maude` dispatchuje do bundled helperu — DDR-062). Tento command jen mapuje slash-command flagy na helper a vyřeší cestu output souboru.

**Vstup `$ARGUMENTS`:**

| Flag | Co dělá |
|---|---|
| `--full` *(default)* | Celá stránka. |
| `--screen <id>` | Jen artboard s `data-dc-screen="<id>"` (Phase 13 konvence) nebo `data-dc-slot="<id>"` (legacy). |
| `--element <id>` | Jen element s `data-dc-element="<id>"`. |
| `--selector <css>` | Vlastní CSS selektor (power-user — preferuj `--screen`/`--element` kde to jde). |
| `--all-screens` | Smyčka přes všechny artboardy, ukládá `<NNN>-screen-<id>.png` do screenshots dir. |
| `--area <name>` | Label pro single-shot výstup (default `full`). Příklady: `roster-row`, `top-bar`. |

**Příklady:**
```
/design:screenshot
/design:screenshot --screen onboarding-welcome
/design:screenshot --element cta-primary
/design:screenshot --all-screens
/design:screenshot --selector ".roster-row:nth-child(1)" --area roster-row
```

## Postup

Vyvolej skill `design` se vstupem: `screenshot $ARGUMENTS`.

Skill:

1. **Server lifecycle** — `PORT=$(maude design server-up)`.
2. **Parse args** — extrahuj jeden ze single-shot módů, `--all-screens`, `--area`.
3. **Compute slug** — `SLUG=$(maude design slug "${ACTIVE#$DESIGN_ROOT/}")`.
4. **Output path:**
   - Single-shot: `OUT="$DESIGN_ROOT/_history/$SLUG/screenshots/$(NNN)-$AREA.png"`, kde `NNN` je další v sekvenci pro daný area (žádné colliding názvy).
   - `--all-screens`: `OUT_DIR="$DESIGN_ROOT/_history/$SLUG/screenshots/"`; helper sám vytvoří `NNN-screen-<id>.png`.
5. **Volání helperu:**
   ```bash
   maude design screenshot \
     --screen "$SCREEN_ID" --out "$OUT"
   # nebo
   maude design screenshot \
     --all-screens --out-dir "$OUT_DIR"
   ```
   Helper sám resolvuje URL ze `_server.json` + `_active.json` a zvolí engine (`agent-browser` > `playwright` fallback). Diagnostic jde do stderr, written paths do stdout — composable.
6. **Print uživateli** cestu(y) k PNG. Pokud `--all-screens` napsal < 1 file (capture failed), surface failure místo silent OK.

## Tip — annotation loop pro pin-comments (Claude Design style)

Pokud chceš anotovat konkrétní místo:

1. `/design:screenshot --element <id>` nebo `--selector <css>` pro výřez.
2. Otevři PNG v Preview / annotation toolu → zakroužkuj → ulož.
3. `/design:edit "<konkrétní feedback>" --screenshot <cesta-k-anotovanému-obrázku>`.

## Failure modes

- **`_active.json` chybí / `active = null`** → helper failuje s "open one in browser first".
- **Server neodpovídá na `/_health`** → `server-up.sh` exit 1 s pointem na `$DESIGN_ROOT/_server.log`.
- **Selector nematchne** → helper detekuje (PNG < 1 KB nebo error z agent-browser), exit 3 s diagnostic. NEdělá silent "success".
- **`agent-browser` skill nedostupný** → helper auto-fallback na `npx playwright` (první run instaluje Chromium ~150 MB).

## Co `/design:screenshot` NEdělá

- Nemodifikuje canvas — jen čte.
- Nemodifikuje `_active.json`.
- Nezapisuje do `_history/` snapshotů (jen do `_history/<slug>/screenshots/`).

Default-screenshotuj často — je to free, image input je nepostradatelný pro `/design:edit "..." --screenshot` annotation loop a pro `/design:critic`.
