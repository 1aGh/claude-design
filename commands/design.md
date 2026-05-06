---
description: Iteruj na aktivním canvasu — Claude přečte soubor co máš v browseru otevřený a aplikuje feedback IN PLACE
argument-hint: "\"<feedback>\" [--screenshot <path>]"
---

# /design — iteruj na active canvasu

Default flow Dugmate Designu. Edituje **soubor co máš právě otevřený v browser tabu** — ne nový session, ne nový file. Jako Claude Design canvas — řekneš "přidej tady presence dot", a presence dot se objeví v `Dugmate Mobile.html` (nebo komkoliv jiném co máš zrovna jako active tab).

**Vstup `$ARGUMENTS`:** `"<feedback>" [--screenshot <path>]`

- `<feedback>` — verbatim co se má změnit. Konkrétně: "presence dot 8px u každého hráče v rosteru", "tighter row density", "remove avatar from chat header".
- `--screenshot <path>` — volitelně cesta k anotovanému obrázku. Claude ho přečte jako image input.

**Příklady:**
```
/design "Presence dot 8px (--status-success) before each roster player name"
/design "Tighter density on Roster section — padding 8/12 instead of 12/16"
/design "Match this layout exactly" --screenshot /Users/me/Downloads/anotated.png
```

## Postup

Vyvolej skill `design` se vstupem `$ARGUMENTS`.

### 1. Server lifecycle (vždy první)

```bash
# Check
if [ -f .ai/design/_server.json ]; then
  PID=$(jq -r .pid .ai/design/_server.json)
  PORT=$(jq -r .port .ai/design/_server.json)
  if kill -0 $PID 2>/dev/null && curl -fs http://localhost:$PORT/_health > /dev/null; then
    echo "✓ server running pid=$PID port=$PORT"
  else
    rm -f .ai/design/_server.json
    NEEDS_START=1
  fi
else
  NEEDS_START=1
fi

# Start if needed
if [ -n "$NEEDS_START" ]; then
  nohup node .claude/plugins/design/dev-server/server.mjs > .ai/design/_server.log 2>&1 &
  disown
  # poll for ready
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    [ -f .ai/design/_server.json ] && curl -fs http://localhost:$(jq -r .port .ai/design/_server.json)/_health > /dev/null && break
  done
fi
```

### 2. Read active canvas + selected element

```bash
ACTIVE=$(jq -r .active .ai/design/_active.json 2>/dev/null)
[ -z "$ACTIVE" ] || [ "$ACTIVE" = "null" ] && echo "No active canvas. Open a file in browser tab first." && exit 1

# Read selected (může být null = canvas-wide)
SELECTED=$(jq -r '.selected // empty' .ai/design/_active.json)
SEL_FILE=$(jq -r '.selected.file // empty' .ai/design/_active.json)
SEL_VALID=$([[ -n "$SELECTED" && "$SEL_FILE" == "$ACTIVE" ]] && echo 1 || echo 0)
```

Pokud `SEL_VALID=1`, edit bude **scoped** na vybraný element (selector + dom_path + outerHTML). Pokud ne, edit je **canvas-wide**.

Stale selection (`selected.file !== active`) → ignoruj a flagni v response.

### 3. Snapshot before edit

```bash
SLUG=$(echo "$ACTIVE" | tr '/' '-' | tr ' ' '_' | tr '[:upper:]' '[:lower:]' | sed 's/\.html$//')
HIST=".ai/design/_history/$SLUG"
mkdir -p "$HIST"
N=$(printf "%03d" $(($(ls "$HIST" 2>/dev/null | wc -l) + 1)))
TS=$(date -u +%Y%m%dT%H%M%S)
cp "$ACTIVE" "$HIST/$N-$TS.bak"
```

### 4. Apply edit

Read the canvas file. **If selection is valid**, build scoped prompt (selector + dom_path + outerHTML + bounds + feedback) — orchestrator zná pattern z `design/SKILL.md` "Scoped edit prompt". Edit pomocí `Edit` tool s `old_string` matchnoutý na unikátní substring vybraného elementu (pokud outerHTML appears multiple times, použij dom-path context k disambiguaci).

**Pokud selection není**, edit je canvas-wide. Použij Edit pro minimal diff (preferuj). Write jen když změna je zásadní rewrite, ale preserve:
- `<link rel="stylesheet" href=".../colors_and_type.css">`
- `<body class="dugmate" data-theme="dark">`
- The Babel/UMD React mount pattern
- All existing tokens (`var(--*)` references)

### 5. Validate

After edit:
```bash
grep -q 'colors_and_type.css' "$ACTIVE" || RESTORE=1
grep -q 'class="dugmate"' "$ACTIVE" || RESTORE=1
# grep for hardcoded #hex in style attributes — should be 0 hits in newly added lines
```

If `RESTORE=1`, copy back the snapshot and report drift to user. Don't leave broken HTML.

### 6. Tell user

```
✓ Edited: <path>
  Snapshot: <hist>/NNN-ts.bak (rollback with /design:rollback)
  Lines changed: <range>
  Reload browser tab to see changes (Cmd+R inside the iframe).
```

## Failure modes

- **Server nelze nastartovat (10s timeout)** → fail s `cat .ai/design/_server.log` instrukcí.
- **`_active.json` chybí / `active = null`** → fail: "Otevři soubor v browser tabu, klikni na něj, pak zkus znovu."
- **Active path není `.html`** → fail: "Active canvas musí být HTML soubor."
- **Snapshot fail (no disk / permission)** → refuse, needituj.
- **Edit poruší tokens link / dugmate class / hardcoded colors** → automatic rollback ze snapshotu, report.
- **Selected element's outerHTML appears multiple times v souboru** → použij dom_path k disambiguaci nebo fail s návrhem zúžit selekci (Cmd+Click konkrétnější dítě).
- **Stale selection** (`selected.file !== active`) → ignoruj selection, edituj canvas-wide, flagni jednou v response.

## Tipy

- **Pin-to-element edit** — drž **Cmd** (nebo Alt) v canvasu, najeď myší — element se zvýrazní cyan. **Cmd+klikni** ho označ. Status bar dole ukáže `● selector — text`. Další `/design "<feedback>"` edituje **jen ten element**, ne celý soubor.
- **Esc uvnitř canvasu** zruší selection. Nebo `×` button ve status baru.
- **Tab switch zruší selection** automaticky (selection je per-canvas).
- **Refresh canvas** — Cmd+R uvnitř iframe. Pokud nefunguje, klikni na "↻ active" v headeru.
- **Anotovaný screenshot** — `/design:screenshot` → otevřeš PNG v Preview → zakroužkuješ → `/design "..." --screenshot <path>`. Selection-aware screenshot je default pokud máš element označený.

Po editu pokračuj `/design "<další feedback>"`, `/design:screenshot`, `/design:critic`, nebo `/design:handoff`. `/design:rollback` pokud editace nedopadla.
