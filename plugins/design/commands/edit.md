---
name: design:edit
category: daily
description: Iteruj na aktivním canvasu — Claude přečte soubor co máš v browseru otevřený a aplikuje feedback IN PLACE. Default: po editu auto-spustí critic panel; přidej --perfect [N] pro N iterací auto-fixu, nebo --no-critic pro skip. --opt-out=<scope> přepíše scope ze sidecaru pro tuhle iteraci.
argument-hint: "\"<feedback>\" [--screenshot <path>] [--perfect [N]] [--no-critic] [--opt-out=palette|aesthetic|full]"
---

# /design:edit — iteruj na active canvasu

Default flow design pluginu. Edituje **soubor co máš právě otevřený v browser tabu** — ne nový session, ne nový file. Jako Claude Design canvas — řekneš "přidej tady presence dot", a presence dot se objeví v aktivním canvasu.

Project-specific hodnoty (designRoot, rootClass, tokens path, themeDefault) přicházejí z `<repo>/.design/config.json`. Orchestrator je čte přes server `/_config` endpoint (nebo přímo ze souboru).

**Vstup `$ARGUMENTS`:** `"<feedback>" [--screenshot <path>] [--opt-out=palette|aesthetic|full]`

- `<feedback>` — verbatim co se má změnit. Konkrétně: "presence dot 8px u každého hráče v rosteru", "tighter row density", "remove avatar from chat header".
- `--screenshot <path>` — volitelně cesta k anotovanému obrázku. Claude ho přečte jako image input.
- `--opt-out=palette|aesthetic|full` — override scope pro tuhle iteraci a persist do `.meta.json`. Pokud chybí, čte se ze sidecaru `<canvas>.meta.json` field `opt_out_scope` (default `palette`). Viz SKILL.md "Opt-out scope".

**Příklady:**
```
/design:edit "Presence dot 8px (--status-success) before each roster player name"
/design:edit "Tighter density on Roster section — padding 8/12 instead of 12/16"
/design:edit "Match this layout exactly" --screenshot /Users/me/Downloads/anotated.png
```

## Postup

### 0. Pre-flight: bootstrap detection

Before any edit work, check whether the project has a usable design system. Canonical recipe — `${CLAUDE_PLUGIN_ROOT}/dev-server/bin/bootstrap-check.sh` — populates `HAS_DS`, `CONFIG_PRESENT`, `REPO_ROOT`, `KNOWN_DS`, `DEFAULT_DS`, `BOOTSTRAP_EXIT`:

```bash
eval "$(bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/bootstrap-check.sh" --shell-export)"
```

| State | Action |
|---|---|
| `HAS_DS=true` | Skip to step 1; normal edit-in-place flow. |
| `HAS_DS=false`, `CONFIG_PRESENT=false` | Print `→ Running /design:init to initialize project…` and invoke `/design:init --skip-prompts`. Then invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$ARGUMENTS`. After bootstrap returns, continue to step 1. |
| `HAS_DS=false`, `CONFIG_PRESENT=true` | Invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$ARGUMENTS` directly (config exists; skill detects `first-bootstrap` because `designSystems[]` is empty). After bootstrap returns, continue to step 1. |

The skill treats `$ARGUMENTS` (the feedback the user passed to `/design:edit`) as the answer to discovery Question 1 (product one-liner) and runs Round 1 Q2–Q4 + Round 2 Q5–Q8, confirms direction, and scaffolds before returning here. After scaffold, the active canvas may be unset (user hasn't opened anything yet) — in that case, fall through to step 1's "no active canvas" error path, which now points the user at `/design:new` to scaffold their first canvas.

### 1. Resolve config

Vyvolej skill `design` se vstupem `$ARGUMENTS`.

```bash
# Read per-repo config (or query running server's /_config)
CFG=.design/config.json
DESIGN_ROOT=$(jq -r '.designRoot // ".design"' "$CFG" 2>/dev/null || echo ".design")
ROOT_CLASS=$(jq -r '.rootClass // "app"'           "$CFG" 2>/dev/null || echo "app")
TOKENS_REL=$(jq -r '.tokensCssRel // "system/colors_and_type.css"' "$CFG" 2>/dev/null || echo "system/colors_and_type.css")
```

### 2. Server lifecycle (vždy první)

```bash
PORT=$(bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/server-up.sh" --root "$REPO_ROOT")
```

Helper detekuje běžící server (PID + `curl /_health`), startuje znovu při stale, poll-uje 10 s, stdout = port. Diagnostic na stderr (`✓ server alive pid=… port=…` / `→ starting dev server …`).

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

# Slug + COMMENTS_FILE for the resolve path (single source of truth: dev-server/bin/slug.sh).
SLUG=$(bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/slug.sh" "${ACTIVE#$DESIGN_ROOT/}")
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

### 3.5 Pre-edit context screenshot — **mandatory when any of**:

- `SEL_VALID=1` (inspector captured an element in this canvas)
- Feedback contains "screenshot" / "udelej si screenshot" / "take a screenshot" (the user asks for one)
- Feedback names a specific UI element by class, role, or component name ("the active item", "search input", "tooltip")
- Feedback compares ≥ 2 surfaces ("X doesn't match Y", "both files", "showcase and resize-panels") — screenshot **each named file**

```bash
HIST="$DESIGN_ROOT/_history/$SLUG"
mkdir -p "$HIST"
N=$(printf "%03d" $(($(ls "$HIST" 2>/dev/null | wc -l) + 1)))
OUT="$HIST/$N-context.png"

# Canonical helper — auto-resolves URL from _server.json + _active.json,
# polls for canvas mount, picks engine (agent-browser > playwright fallback).
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "$OUT"

# If the selected element has a data-dc-element="<id>", grab a focused crop too:
if [ "$SEL_VALID" = "1" ] && [[ "$(jq -r '.selected.selector // empty' "$DESIGN_ROOT/_active.json")" == *"data-dc-element="* ]]; then
  EL_ID=$(jq -r '.selected.selector' "$DESIGN_ROOT/_active.json" | sed -nE 's/.*data-dc-element="([^"]+)".*/\1/p')
  bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --element "$EL_ID" --out "$HIST/$N-context-element.png"
fi
```

**Then `Read` the PNG into the conversation** with the Read tool. The selection JSON gives you WHAT (selector + outerHTML + bounds); the screenshot gives you WHERE-IN-CONTEXT (neighbors, alignment, the visual conversation the element is part of). Editing from JSON alone is *tapping in the dark* — the bounds tell you where the box is, not what's next to it.

**Multi-surface feedback:** screenshot EACH named file before editing any of them. Compare them visually first, then edit. This is non-negotiable when the user's feedback explicitly names a parity claim ("A is not the same as B").

**Skip ONLY when** none of the four triggers fire — i.e. a canvas-wide cosmetic tweak with no selection and no explicit element reference. In that case, the post-write reality-check screenshot (step 7) is sufficient.

Cost of the screenshot: ~5s + one tool call. Cost of skipping when needed: 2–3 follow-up iterations to roll back a bad edit. See `.ai/logs/system-reviews/design-edit-screenshot-habits-review.md` for the studio iter-4 incident this rule patches.

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
OUT="$DESIGN_ROOT/_history/$SLUG/$NNN-baseline.png"
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "$OUT" \
  || echo "⚠ baseline screenshot not written"
```

Helper resolvuje URL z `_server.json` + `_active.json`, poll-uje pro canvas mount, vybírá engine (agent-browser > playwright fallback). Diagnostic na stderr.

Screenshot path je referenced v final print + chat.md row. Pokud render blank → warn `⚠ canvas rendered blank — likely JSX error`, neabortuj (file exists, user může otevřít manually).

Detaily: SKILL.md "Post-write reality check".

### 8. Auto-critic + auto-fix loop (default — opt out with `--no-critic`)

**Resolve opt-out scope first.** Order: (1) `--opt-out=<scope>` flag in `$ARGUMENTS` wins; (2) else read `<active>.meta.json` `opt_out_scope` field; (3) else default `palette`. Pass the resolved scope to every critic in the panel via the input envelope. Each critic adjusts severity per its own spec — `design-critic` / `graphic-design-critic` / `typography-critic` / `signature-moment-critic` downgrade matching DS-rule blockers to warnings; `a11y-critic` / `frontend-critic` / `copy-critic` ignore the parameter (their blockers are universal). Persist the resolved scope back to `.meta.json` if it changed.

**See `skills/design/SKILL.md` "Auto-critic loop" + "Opt-out scope" for full spec.** Klíčové:

| Flag | max_iter | aspiration_target | Panel | Use |
|---|---|---|---|---|
| (default) | 4 | 4.0 / 5 | routed (incl. `signature-moment-critic` když feedback obsahuje polish/nicer/elegant cues) | každé /design:edit — solid-for-review |
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

Failure here is non-fatal — print warning, don't restore the canvas. (User can run `/design:setup-docs --full` to recover.)

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

- **Pin-to-element edit** — drž **Cmd** (nebo Alt) v canvasu, najeď myší — element se zvýrazní. **Cmd+klikni** ho označ. Status bar dole ukáže `● selector — text`. Další `/design:edit "<feedback>"` edituje **jen ten element**, ne celý soubor.
- **Esc uvnitř canvasu** zruší selection. Nebo `×` button ve status baru.
- **Tab switch zruší selection** automaticky (selection je per-canvas).
- **Refresh canvas** — Cmd+R uvnitř iframe. Pokud nefunguje, klikni na "↻ active" v headeru.
- **Anotovaný screenshot** — `/design:screenshot` → otevřeš PNG v Preview → zakroužkuješ → `/design:edit "..." --screenshot <path>`. Selection-aware screenshot je default pokud máš element označený.

Po editu pokračuj `/design:edit "<další feedback>"`, `/design:screenshot`, `/design:critic`, nebo `/design:handoff`. `/design:rollback` pokud editace nedopadla.
