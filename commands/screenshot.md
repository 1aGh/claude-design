---
description: Capture screenshot aktivního canvasu přes agent-browser (HTTP server URL, ne file://) — pro visual review, /design:critic, nebo annotation loop
argument-hint: "[--area <name>] [--selector <css>]"
---

# /design:screenshot — capture active canvas

Otevře aktivní canvas (`_active.json`) v agent-browseru (přes HTTP, ne file://), zachytí screenshot, uloží do `.design/_history/<slug>/screenshots/<NNN>-<area>.png` (gitignored).

**Vstup `$ARGUMENTS`:** `[--area <name>] [--selector <css>]`

- `--area <name>` — label pro screenshot (default `full`). Příklady: `roster-row`, `top-bar`, `presence-dots`.
- `--selector <css>` — jen výřez podle CSS selectoru. Předá se agent-browseru.

**Příklady:**
```
/design:screenshot
/design:screenshot --area roster-row --selector ".roster-row:nth-child(1)"
/design:screenshot --area presence-dots
```

## Postup

Vyvolej skill `design` se vstupem: `screenshot $ARGUMENTS`.

Skill:
1. Server lifecycle check (auto-start pokud chybí).
2. Read `.design/_active.json` → cesta k canvasu + server `port`.
3. Sestaví URL: `http://localhost:<port>/<active-path>` (HTTP, ne file:// — relativní imports tokenů jen tak fungují).
4. Spočítá `<slug>` z active path. `mkdir -p .design/_history/<slug>/screenshots/`.
5. Pojmenuje výstup `<NNN>-<area>.png` kde `<NNN>` je další číslo v sekvenci pro daný area.
6. Spustí: `agent-browser screenshot "<url>" --output "<out>" [--selector "<css>"]`.
7. Vypíše path uživateli.

## Tip — annotation loop pro pin-comments (Claude Design style)

Pokud chceš anotovat konkrétní místo:

1. `/design:screenshot --area <focus>` (`--selector` pro výřez).
2. Otevři PNG v Preview / CleanShot / Figma.
3. Zakroužkuj / anotuj / popiš → ulož.
4. `/design "<konkrétní feedback>" --screenshot <cesta-k-anotovanému-obrázku>`.

Tohle je nejbližší ekvivalent Claude Design pinned-comments workflow — ručně řízený, ale plně funkční.

## Failure modes

- **`agent-browser` skill nedostupný** → fail s cestou `.claude/skills/agent-browser/`.
- **`_active.json` chybí / null** → fail: "Otevři canvas v browseru first."
- **Server neodpovídá na `/_health`** → fail loud, log path k debug.
- **`--selector` nematchne** → agent-browser vrátí prázdný screenshot; skill detekuje (size < 1KB) a fail s návrhem opravit selector.

## Co `/design:screenshot` NEdělá

- Nemodifikuje canvas — jen čte.
- Nemodifikuje `_active.json`.
- Nezapisuje do `_history/` snapshotů (jen do `_history/<slug>/screenshots/`).

Default-screenshotuj často — je to free, image input je nepostradatelný pro `/design "..." --screenshot` annotation loop a pro `/design:critic`.
