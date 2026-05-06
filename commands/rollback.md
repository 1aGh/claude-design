---
description: Vrať poslední snapshot aktivního canvasu (undo poslední /design edit). --steps N pro víc kroků zpět.
argument-hint: "[--steps N] [--list]"
---

# /design:rollback — undo edit

Restoruje předchozí stav active canvasu z `.ai/design/_history/<slug>/`. Každý `/design "<feedback>"` udělal snapshot **před** editem; rollback ten snapshot vrátí.

**Vstup `$ARGUMENTS`:** `[--steps N] [--list]`

- `--steps N` — kolik kroků zpět (default 1 = poslední snapshot).
- `--list` — místo undo jen vypíše dostupné snapshots aktivního canvasu.

**Příklady:**
```
/design:rollback                    # undo poslední edit
/design:rollback --steps 3          # vrať 3 editace zpět
/design:rollback --list             # ukáže historii pro active canvas
```

## Postup

Vyvolej skill `design` se vstupem: `rollback $ARGUMENTS`.

Skill:
1. Server lifecycle check.
2. Read `.ai/design/_active.json` → cesta k canvasu.
3. Spočítá `<slug>` z cesty.
4. **`--list` mode:** `ls .ai/design/_history/<slug>/` setříděné desc by timestamp. Vypíše s indexem (1 = nejnovější) + size + ts. Konec.
5. **Default mode:** vezme N-tý snapshot zpět (default 1).
6. **Snapshot CURRENT state first** — rollback je sám reversible. Zapíše current jako `<NNN+1>-<ts>-pre-rollback.bak`.
7. `cp <chosen-snapshot> <canvas-file>`.
8. Print: který snapshot byl restorován, kolik kroků, current snapshot count.
9. User reloadne iframe (Cmd+R).

## Failure modes

- **Žádný history pro active canvas** → fail: "No snapshots in `.ai/design/_history/<slug>/`. Žádný `/design` edit ještě neběžel."
- **`--steps N` > history count** → fail s actual count + nabídka `--steps <max>`.

## Tipy

- **Před `/design:handoff` projdi historii** přes `--list` — uvidíš všechny iterace co se sbíhaly k finální.
- **Snapshots jsou gitignored.** Pokud chceš zachovat konkrétní stav v gitu, copy ho ručně mimo `_history/` (např. `cp .ai/design/_history/.../005-*.bak .ai/decisions/DDR-NNN/visual-evidence.html`).
- **Rollback rollback** — protože pre-rollback snapshot se taky uloží, můžeš `/design:rollback` zase `/design:rollback` a vrátit se k stavu před první rollbackem.

## Co `/design:rollback` NEdělá

- Nesmaže `_history/<slug>/` (zůstává navždy, dokud user manuálně neumaže).
- Nemění `_active.json` (active canvas zůstává stejný).
- Nemodifikuje `apps/web` ani `apps/mobile` (handoff je separate flow).
