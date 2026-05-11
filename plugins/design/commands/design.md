---
description: Iteruj na aktivním canvasu — Claude přečte soubor co máš v browseru otevřený a aplikuje feedback IN PLACE. Default: po editu auto-spustí critic panel; přidej --perfect [N] pro N iterací auto-fixu, nebo --no-critic pro skip. --opt-out=<scope> přepíše scope ze sidecaru pro tuhle iteraci.
argument-hint: "\"<feedback>\" [--screenshot <path>] [--perfect [N]] [--no-critic] [--opt-out=palette|aesthetic|full]"
---

# /design — iteruj na active canvasu

Default flow design pluginu. Edituje **soubor co máš právě otevřený v browser tabu** — ne nový session, ne nový file. Jako Claude Design canvas — řekneš "přidej tady presence dot", a presence dot se objeví v aktivním canvasu.

Project-specific hodnoty (designRoot, rootClass, tokens path, themeDefault) přicházejí z `<repo>/.design/config.json`. Orchestrator je čte přes server `/_config` endpoint (nebo přímo ze souboru).

**Vstup `$ARGUMENTS`:** `"<feedback>" [--screenshot <path>] [--opt-out=palette|aesthetic|full]`

- `<feedback>` — verbatim co se má změnit. Konkrétně: "presence dot 8px u každého hráče v rosteru", "tighter row density", "remove avatar from chat header".
- `--screenshot <path>` — volitelně cesta k anotovanému obrázku. Claude ho přečte jako image input.
- `--opt-out=palette|aesthetic|full` — override scope pro tuhle iteraci a persist do `.meta.json`. Pokud chybí, čte se ze sidecaru `<canvas>.meta.json` field `opt_out_scope` (default `palette`). Viz SKILL.md "Opt-out scope".

**Příklady:**
```
/design "Presence dot 8px (--status-success) before each roster player name"
/design "Tighter density on Roster section — padding 8/12 instead of 12/16"
/design "Match this layout exactly" --screenshot /Users/me/Downloads/anotated.png
```

## Postup

Vyvolej skill `design` se vstupem `$ARGUMENTS`.

### 1. Resolve config

```bash
# Read per-repo config (or query running server's /_config)
CFG=.design/config.json
DESIGN_ROOT=$(jq -r '.designRoot // ".design"' "$CFG" 2>/dev/null || echo ".design")
ROOT_CLASS=$(jq -r '.rootClass // "app"'           "$CFG" 2>/dev/null || echo "app")
TOKENS_REL=$(jq -r '.tokensCssRel // "system/colors_and_type.css"' "$CFG" 2>/dev/null || echo "system/colors_and_type.css")
```

### 2. Server lifecycle (vždy první)

```bash
# Check
if [ -f "$DESIGN_ROOT/_server.json" ]; then
  PID=$(jq -r .pid  "$DESIGN_ROOT/_server.json")
  PORT=$(jq -r .port "$DESIGN_ROOT/_server.json")
  if kill -0 $PID 2>/dev/null && curl -fs http://localhost:$PORT/_health > /dev/null; then
    echo "✓ server running pid=$PID port=$PORT"
  else
    rm -f "$DESIGN_ROOT/_server.json"
    NEEDS_START=1
  fi
else
  NEEDS_START=1
fi

# Start if needed
if [ -n "$NEEDS_START" ]; then
  nohup node .claude/plugins/design/dev-server/server.mjs > "$DESIGN_ROOT/_server.log" 2>&1 &
  disown
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    [ -f "$DESIGN_ROOT/_server.json" ] && curl -fs http://localhost:$(jq -r .port "$DESIGN_ROOT/_server.json")/_health > /dev/null && break
  done
fi
```

### 3. Read active canvas + selected element + open comments

```bash
ACTIVE=$(jq -r .active "$DESIGN_ROOT/_active.json" 2>/dev/null)
[ -z "$ACTIVE" ] || [ "$ACTIVE" = "null" ] && echo "No active canvas. Open a file in browser tab first." && exit 1

SELECTED=$(jq -r '.selected // empty'      "$DESIGN_ROOT/_active.json")
SEL_FILE=$(jq -r '.selected.file // empty' "$DESIGN_ROOT/_active.json")
SEL_VALID=$([[ -n "$SELECTED" && "$SEL_FILE" == "$ACTIVE" ]] && echo 1 || echo 0)

# Open comments — annotations the user dropped on elements via Cmd+Shift+click
# or ⌘C in the dev server UI. `_active.json` mirrors the active file's comments
# inline (server keeps it in sync), so this is a single read.
OPEN_COMMENTS=$(jq -c '[(.active_comments // [])[] | select(.status != "resolved")]' "$DESIGN_ROOT/_active.json" 2>/dev/null || echo '[]')

# Slug + COMMENTS_FILE for the resolve path lower (write directly to authoritative storage).
SLUG_PATH="${ACTIVE#$DESIGN_ROOT/}"
SLUG=$(echo "$SLUG_PATH" | tr '/' '-' | tr ' ' '_' | tr '[:upper:]' '[:lower:]' | sed 's/\.html$//' | sed 's/^\.\+//')
COMMENTS_FILE="$DESIGN_ROOT/_comments/$SLUG.json"
```

Pokud `SEL_VALID=1`, edit bude **scoped** na vybraný element (selector + dom_path + outerHTML). Pokud ne, edit je **canvas-wide**. Stale selection (`selected.file !== active`) → ignoruj a flagni v response.

**Open comments take precedence when feedback is empty / generic.** Each entry: `{id, selector, dom_path, tag, classes, bounds, html_excerpt, text, status, created}`. Orchestrator behaviour:

1. **Empty / generic feedback** ("polish", "fix open comments", "")  + open comments exist → iterate over each comment as a separate scoped edit; resolve each after successful edit.
2. **Specific feedback referencing comments** ("address comment 3", "fix all the typography feedback") → match comment ids/text to the request, edit those, resolve them.
3. **Feedback unrelated to comments** → execute feedback first, then warn user that N open comments still need attention.

**To mark a comment resolved (write directly — server picks up on next read / WS broadcast):**
```bash
jq --arg id "$ID" 'map(if .id == $id then .status = "resolved" | .resolved_at = (now | todate) else . end)' \
  "$COMMENTS_FILE" > "$COMMENTS_FILE.tmp" && mv "$COMMENTS_FILE.tmp" "$COMMENTS_FILE"
```

### 4. Snapshot before edit

```bash
# SLUG already computed in step 3 (uses normalised form — no designRoot prefix, no leading dot)
HIST="$DESIGN_ROOT/_history/$SLUG"
mkdir -p "$HIST"
N=$(printf "%03d" $(($(ls "$HIST" 2>/dev/null | wc -l) + 1)))
TS=$(date -u +%Y%m%dT%H%M%S)
cp "$ACTIVE" "$HIST/$N-$TS.bak"
```

### 5. Apply edit

Read the canvas file. **If selection is valid**, build scoped prompt (selector + dom_path + outerHTML + bounds + feedback) — orchestrator zná pattern z `design/SKILL.md` "Scoped edit prompt". Edit pomocí `Edit` tool s `old_string` matchnutý na unikátní substring vybraného elementu (pokud outerHTML appears multiple times, použij dom-path context k disambiguaci).

**Pokud selection není**, edit je canvas-wide. Použij Edit pro minimal diff (preferuj). Write jen když změna je zásadní rewrite, ale preserve:
- `<link rel="stylesheet" href=".../<TOKENS_REL>">`
- `<body class="<ROOT_CLASS>" data-theme="…">`
- The Babel/UMD React mount pattern (pokud existuje)
- All existing tokens (`var(--*)` references)

### 6. Validate

```bash
grep -q "$(basename "$TOKENS_REL")" "$ACTIVE" || RESTORE=1
# Accept BOTH plain HTML (class="…") and JSX (className="…") form — React canvases
# render the rootClass via JSX so it never appears as a literal HTML attribute.
grep -qE "(^| )(class|className)=\"$ROOT_CLASS([\" ])" "$ACTIVE" || RESTORE=1
# grep for hardcoded #hex in style attributes — should be 0 hits in newly added lines
```

If `RESTORE=1`, copy back the snapshot and report drift to user. Don't leave broken HTML.

### 7. Post-write reality check — confirmation screenshot

**Always fires, regardless of `--no-critic`.** Reality check (does the file render?), ne quality check.

```bash
PORT=$(jq -r .port "$DESIGN_ROOT/_server.json")
URL="http://localhost:$PORT/$ACTIVE"               # URL-escape spaces as %20
SLUG=...   # already computed
OUT="$DESIGN_ROOT/_history/$SLUG/$NNN-baseline.png"

# Two-step: navigate, then screenshot. agent-browser screenshot does NOT take
# a URL arg — its signature is `screenshot [selector] [path]`. Path is
# positional with `--` separator; `--output <path>` silently fails (CLI treats
# it as a literal positional and reports success without writing the file).
agent-browser navigate "$URL" >/dev/null
sleep 1.5
agent-browser screenshot --full -- "$OUT"
ls -la "$OUT" >/dev/null 2>&1 || echo "⚠ baseline screenshot not written"
```

Screenshot path je referenced v final print + chat.md row. Pokud render blank → warn `⚠ canvas rendered blank — likely JSX error`, neabortuj (file exists, user může otevřít manually).

Detaily: SKILL.md "Post-write reality check".

### 8. Auto-critic + auto-fix loop (default — opt out with `--no-critic`)

**Resolve opt-out scope first.** Order: (1) `--opt-out=<scope>` flag in `$ARGUMENTS` wins; (2) else read `<active>.meta.json` `opt_out_scope` field; (3) else default `palette`. Pass the resolved scope to every critic in the panel via the input envelope. Each critic adjusts severity per its own spec — `design-critic` / `graphic-design-critic` / `typography-critic` / `signature-moment-critic` downgrade matching DS-rule blockers to warnings; `a11y-critic` / `frontend-critic` / `copy-critic` ignore the parameter (their blockers are universal). Persist the resolved scope back to `.meta.json` if it changed.

**See `skills/design/SKILL.md` "Auto-critic loop" + "Opt-out scope" for full spec.** Klíčové:

| Flag | max_iter | aspiration_target | Panel | Use |
|---|---|---|---|---|
| (default) | 4 | 4.0 / 5 | routed (incl. `signature-moment-critic` když feedback obsahuje polish/nicer/elegant cues) | každé /design — solid-for-review |
| `--no-critic` | 0 | n/a | (skip) | quick / dirty edit |
| `--perfect [N]` | N (default 8) | 4.5 / 5 | routed | extended polish, broader scope |
| `--perfect --all` | N | 4.5 / 5 | every critic incl. aspiration | exhaustive / portfolio-grade |
| `--opt-out=<scope>` | (orthogonal) | (orthogonal) | (orthogonal) | Override scope for this iteration. `palette` (default) / `aesthetic` (palette + gradients/radii free) / `full` (DS advisory). A11y enforced regardless. Persists to `.meta.json`. |

Default loop **multi-axis** stop condition: `correctness == 0 AND aspiration ≥ 4.0 AND specificity == "pass" AND no_gains_for_1_round`. Když plateau → exit `stable-but-bland` s diagnostic (lowest 2 axes), místo silent success na "blockers == 0 ale bland."

Each iteration: pick panel → spawn parallel via Agent calls → parse JSON verdicts → write NNN-PANEL.md → check exit conditions → auto-fix top 3 blockers → repeat. Track best snapshot, restore on divergence.

### 9. Refresh docs (auto)

After auto-critic loop completes (or `--no-critic` skipped it), call the **incremental docs refresh** described in `skills/design/SKILL.md` "Continuous docs maintenance":

1. Update `<canvas>.meta.json` (`last_modified`, `iteration_count`, `tokens_used`).
2. Update `<designRoot>/INDEX.md` row for this canvas.
3. Update `<designRoot>/README.md` "Last updated" line.

Failure here is non-fatal — print warning, don't restore the canvas. (User can run `/design:docs --full` to recover.)

### 10. Tell user

```
✓ Edited: <path>
  Snapshot: <hist>/NNN-ts.bak (rollback with /design:rollback)
  Lines changed: <range>
  Baseline: <hist>/NNN-baseline.png

  Critic panel ({list}):
    correctness: {X} blockers · {Y} warnings
    {if signature-moment-critic in panel:}
    aspiration: {n}/5 (signature {n}, brand {n}, fidelity {n}, restraint {n}, neg-space {n}) · specificity: {pass|fail}
    verdict: {solid | stable-but-bland | max-reached | divergent | validation-failed}
  {if iter > 1 or --perfect, list iterations: "iter 1 → iter 2 → iter 3 (final)"}
  {if restored: "↺ restored to iter K (best result)"}
  {if stable-but-bland: "Lowest axes: <list>. Targeted feedback would lift these."}

  Docs: <designRoot>/INDEX.md updated, iter {N}.

  Reload browser tab to see changes (Cmd+R inside the iframe).
```

## Failure modes

- **Server nelze nastartovat (10s timeout)** → fail s `cat $DESIGN_ROOT/_server.log` instrukcí.
- **`_active.json` chybí / `active = null`** → fail: "Otevři soubor v browser tabu, klikni na něj, pak zkus znovu."
- **Active path není `.html`** → fail: "Active canvas musí být HTML soubor."
- **Snapshot fail (no disk / permission)** → refuse, needituj.
- **Edit poruší tokens link / rootClass / hardcoded colors** → automatic rollback ze snapshotu, report.
- **Selected element's outerHTML appears multiple times v souboru** → použij dom_path k disambiguaci nebo fail s návrhem zúžit selekci (Cmd+Click konkrétnější dítě).
- **Stale selection** (`selected.file !== active`) → ignoruj selection, edituj canvas-wide, flagni jednou v response.

## Tipy

- **Pin-to-element edit** — drž **Cmd** (nebo Alt) v canvasu, najeď myší — element se zvýrazní. **Cmd+klikni** ho označ. Status bar dole ukáže `● selector — text`. Další `/design "<feedback>"` edituje **jen ten element**, ne celý soubor.
- **Esc uvnitř canvasu** zruší selection. Nebo `×` button ve status baru.
- **Tab switch zruší selection** automaticky (selection je per-canvas).
- **Refresh canvas** — Cmd+R uvnitř iframe. Pokud nefunguje, klikni na "↻ active" v headeru.
- **Anotovaný screenshot** — `/design:screenshot` → otevřeš PNG v Preview → zakroužkuješ → `/design "..." --screenshot <path>`. Selection-aware screenshot je default pokud máš element označený.

Po editu pokračuj `/design "<další feedback>"`, `/design:screenshot`, `/design:critic`, nebo `/design:handoff`. `/design:rollback` pokud editace nedopadla.
