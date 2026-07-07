---
name: design:edit
category: daily
description: Iterate on the active canvas — Claude reads the file you have open in the browser and applies feedback IN PLACE. Default: after the edit, auto-runs the critic panel; add --perfect [N] for N auto-fix iterations, or --no-critic to skip. --opt-out=<scope> overrides the scope from the sidecar for this iteration.
argument-hint: "\"<feedback>\" [--screenshot <path>] [--perfect [N]] [--no-critic] [--opt-out=palette|aesthetic|full]"
---

# /design:edit — iterate on the active canvas

The design plugin's default flow. Edits the **file you currently have open in the browser tab** — not a new session, not a new file. Like a Claude Design canvas — you say "add a presence dot here", and the presence dot appears in the active canvas.

Project-specific values (designRoot, rootClass, tokens path, themeDefault) come from `<repo>/.design/config.json`. The orchestrator reads them via the server `/_config` endpoint (or straight from the file).

**Input `$ARGUMENTS`:** `"<feedback>" [--screenshot <path>] [--opt-out=palette|aesthetic|full]`

- `<feedback>` — verbatim what should change. Concretely: "presence dot 8px next to each roster player name", "tighter row density", "remove avatar from chat header".
- `--screenshot <path>` — optionally a path to an annotated image. Claude reads it as image input.
- `--opt-out=palette|aesthetic|full` — override scope for this iteration and persist to `.meta.json`. If absent, read from the sidecar `<canvas>.meta.json` field `opt_out_scope` (default `palette`). See SKILL.md "Opt-out scope".

**Examples:**
```
/design:edit "Presence dot 8px (--status-success) before each roster player name"
/design:edit "Tighter density on Roster section — padding 8/12 instead of 12/16"
/design:edit "Match this layout exactly" --screenshot /Users/me/Downloads/anotated.png
```

## Procedure

### 0. Pre-flight: bootstrap detection

Before any edit work, check whether the project has a usable design system. Canonical recipe — `maude design bootstrap-check` (on-PATH `maude` dispatches to the bundled helper — DDR-062) — populates `HAS_DS`, `CONFIG_PRESENT`, `REPO_ROOT`, `KNOWN_DS`, `DEFAULT_DS`, `BOOTSTRAP_EXIT`:

```bash
eval "$(maude design bootstrap-check --shell-export)"
```

| State | Action |
|---|---|
| `HAS_DS=true` | Skip to step 1; normal edit-in-place flow. |
| `HAS_DS=false`, `CONFIG_PRESENT=false` | Print `→ Running /design:init to initialize project…` and invoke `/design:init --skip-prompts`. Then invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$ARGUMENTS`. After bootstrap returns, continue to step 1. |
| `HAS_DS=false`, `CONFIG_PRESENT=true` | Invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$ARGUMENTS` directly (config exists; skill detects `first-bootstrap` because `designSystems[]` is empty). After bootstrap returns, continue to step 1. |

The skill treats `$ARGUMENTS` (the feedback the user passed to `/design:edit`) as the answer to discovery Question 1 (product one-liner) and runs Round 1 Q2–Q4 + Round 2 Q5–Q8, confirms direction, and scaffolds before returning here. After scaffold, the active canvas may be unset (user hasn't opened anything yet) — in that case, fall through to step 1's "no active canvas" error path, which now points the user at `/design:new` to scaffold their first canvas.

#### 0.5 Motion-complaint fast-path (matchMedia-first — D-3)

When the feedback is a motion complaint — it mentions `motion`, `animace`, `animation`, `nehýbe se`, `animace nefunguje`, `not animating`, `nereaguje`, "stuck / frozen / dead" — the **FIRST diagnostic is `prefers-reduced-motion`, before reading any CSS or component code**:

```bash
agent-browser eval "matchMedia('(prefers-reduced-motion: reduce)').matches"
```

Headless Chrome (and many real user browsers / OS accessibility settings) default `prefers-reduced-motion: reduce` to **true**, and the design tokens *correctly* collapse `--dur-*` to `1ms` in that branch — so "nothing animates" is the system working as designed, not a CSS bug. If the probe returns `true`, that is almost certainly the whole story: surface it to the user ("motion is suppressed by `prefers-reduced-motion: reduce` in this browser/OS — toggle it via the specimen's `<ReducedMotionToggle>` or your OS settings to see it play") instead of chasing the CSS. Only if the probe returns `false` does a real motion bug warrant reading the keyframes/`motion/react` code. The probe is ~1 agent-browser call and belongs before any code reading — studyfi burned ~2 user round-trips chasing CSS that was working.

#### 0.6 Video-comp pre-load (DDR-148)

When the feedback mentions video / animation-as-video cues — `video`, `klip`, `clip`, `animace`, `animation`, `mp4`, `gif`, `hudba`, `music`, `soundtrack`, `titulek`, `title card`, `transition`, `crossfade`, `motion graphic`, `showreel`, `trailer` — **OR** the active canvas already contains `<VideoComp` — load skill **`design:video-comp`** before dispatching the edit, so the composition stays inside the Remotion iron rules (frame-driven values only, no CSS animations in a comp, only bundled imports, `assets/` sources). One-liner grep:

```bash
grep -qiE 'video|klip|clip|animace|animation|mp4|gif|hudba|music|soundtrack|titulek|title card|transition|crossfade|motion graphic|showreel|trailer' <<< "$ARGUMENTS" && VIDEO_EDIT=1
grep -q '<VideoComp' "$ACTIVE_CANVAS_ABS" 2>/dev/null && VIDEO_EDIT=1
[ -n "$VIDEO_EDIT" ] && echo "→ loading skill design:video-comp (Remotion composition rules)"
```

### 1. Resolve config

Invoke skill `design` with input `$ARGUMENTS`.

**One pre-flight call instead of the config jq reads + the step-3 slug compute.** `prep.sh --shape edit` reads `.design/config.json` + `_active.json` + `_server.json` in a single pass and exports `DESIGN_ROOT`, `ROOT_CLASS`, `TOKENS_REL`, plus the active-canvas context `ACTIVE_CANVAS`, `SELECTED_FILE`, `SEL_VALID`, `OPEN_TABS`, `ACTIVE_SLUG`, and the server probe `SERVER_UP` / `SERVER_PORT`. Step 3's slug no longer needs a separate `slug.sh` call (use `$ACTIVE_SLUG`); step 2 still runs `server-up.sh` because that helper *starts* a stale/absent server — `prep.sh` only probes.

```bash
eval "$(maude design prep --shell-export --shape edit --root "$REPO_ROOT")"
CFG="$REPO_ROOT/.design/config.json"
```

### 1.5 Auto-load DS context for inline-mode canvases (Phase 3.6 Task 12c)

When the canvas is `.tsx` + `css_mode: "inline"` AND the feedback is about styling (classes, spacing, colors, borders, radii, …) OR `_active.json.selected.id` is set, **pre-load** the DS's `_components.css` + `colors_and_type.css` into the orchestrator's context BEFORE dispatching to `frontend-design`. Cost: ~6 KB CSS read per qualifying edit; saves the ~30 KB "Claude re-grep'd `_components.css` mid-edit" round-trip that empirically slows token-cheap iteration.

```bash
# Resolve the active canvas's meta sidecar; bail early on non-tsx, non-inline,
# or when there's no _components.css to load.
ABS_ACTIVE="$REPO_ROOT/$DESIGN_ROOT/${ACTIVE#$DESIGN_ROOT/}"
META_PATH="${ABS_ACTIVE%.*}.meta.json"
CSS_MODE=$(jq -r '.css_mode // "inline"' "$META_PATH" 2>/dev/null || echo "inline")

LOAD_CSS=0
# Heuristic — case-insensitive match against style verbs. Bound and conservative;
# err toward loading when in doubt (~6 KB is cheap).
case "$ARGUMENTS" in
  *color*|*COLOR*|*Color*|\
  *padding*|*PADDING*|*Padding*|\
  *spacing*|*SPACING*|*Spacing*|\
  *margin*|*MARGIN*|*Margin*|\
  *border*|*BORDER*|*Border*|\
  *radius*|*RADIUS*|*Radius*|\
  *shadow*|*SHADOW*|*Shadow*|\
  *background*|*BACKGROUND*|\
  *className*|*class\ name*|\
  *font*|*tracking*|*leading*|\
  *opacity*|*OPACITY*|\
  *hover*|*HOVER*|*focus*|*FOCUS*|\
  *barv*|*Barv*|*BARV*|\
  *odsazen*|*Odsazen*|*mezer*|*Mezer*|\
  *okraj*|*Okraj*|*rámeč*|*ramec*|\
  *zaobl*|*Zaobl*|*stín*|*Stín*|*stin*|\
  *pozad*|*Pozad*|*písm*|*pism*|*Písm*|\
  *průhled*|*pruhled*|*třída*|*trid*)
    LOAD_CSS=1
    ;;
esac
# ↑ The Czech verbs (barva, odsazení, mezery, okraj, rámeček, zaoblení, stín, pozadí,
# písmo, průhlednost, třída) are load-bearing, not decoration — the ds-awareness RCA
# found Czech style feedback silently missed the EN-only list, so those edits ran with
# ZERO DS vocabulary and the generator improvised off-system (DDR-141).

# Selection-anchored edits also benefit — they're nearly always style/structure.
if [ "${SEL_VALID:-0}" = "1" ]; then
  LOAD_CSS=1
fi

CANVAS_LIB="$CLAUDE_PLUGIN_ROOT/dev-server/canvas-lib.tsx"
DCTX=""   # cached DS-context pack (empty = cache miss → read the raw files)

if [ "$LOAD_CSS" = "1" ] && [ "${ACTIVE##*.}" = "tsx" ] && [ "$CSS_MODE" = "inline" ]; then
  # Use the design system's tokensCssRel + the DS-specific `_components.css`.
  DS_NAME=$(jq -r '.designSystem // "project"' "$META_PATH" 2>/dev/null || echo "project")
  DS_PREVIEW_DIR=$(jq -r ".designSystems[] | select(.name==\"$DS_NAME\") | .path" "$CFG" 2>/dev/null || echo "system/$DS_NAME")
  COMPONENTS_CSS="$REPO_ROOT/$DESIGN_ROOT/$DS_PREVIEW_DIR/preview/_components.css"
  TOKENS_CSS="$REPO_ROOT/$DESIGN_ROOT/$TOKENS_REL"

  # Sidecar cache (Phase C / DDR-061): cache the extracted DS vocabulary
  # (component class names + token names + canvas-lib exports) per
  # (DS-name, sha-of-the-three-source-files). A repeated /design:edit on the
  # same canvas reads the compact digest instead of re-reading ~6 KB CSS +
  # the ~58 KB canvas-lib. Invalidates the moment ANY of the three files change.
  # Access via the `maude` CLI (declared dep, on PATH) — cli/lib is NOT beside
  # the plugin in a marketplace install (DDR-061).
  TOKENS_SHA=$(cat "$COMPONENTS_CSS" "$TOKENS_CSS" "$CANVAS_LIB" 2>/dev/null | git hash-object --stdin | cut -c1-12)
  DCTX=$(maude cache get design-context "$DS_NAME/$TOKENS_SHA" 2>/dev/null)

  if [ -n "$DCTX" ]; then
    echo "→ DS context cache HIT ($DS_NAME/$TOKENS_SHA) — seeding from cached vocabulary, skipping CSS + canvas-lib reads"
  else
    echo "→ DS context cache MISS ($DS_NAME/$TOKENS_SHA) — pre-loading: $COMPONENTS_CSS"
    echo "→ pre-loading DS context: $TOKENS_CSS"
  fi
fi

# Pre-load the dev-server-bundled canvas-lib for every TSX canvas UNLESS the
# DS-context cache already covered it (the lib sha is folded into TOKENS_SHA, so
# a hit means its export vocabulary is in $DCTX). The lib is the authoring
# vocabulary (envelope + helpers + hooks the canvas can compose from); cold-edit
# without it is a known foot-gun (Phase 3.6.1 Task 13). Per DDR-025 it ships
# with the dev-server install. Cost when read: ~58 KB, idempotent.
if [ "${ACTIVE##*.}" = "tsx" ] && [ -z "$DCTX" ] && [ -f "$CANVAS_LIB" ]; then
  echo "→ pre-loading canvas-lib: $CANVAS_LIB"
fi

# ── Add-surface edits: pre-load the platform SHOWCASE shell (placement reference) ──
# When the edit PLACES A NEW SURFACE (a new screen/section/panel/artboard) rather than
# tweaking an existing element, the orchestrator needs the DS's canonical product shell so
# the new surface reuses "kde to bude" instead of inventing a parallel shell. Gate it tight
# — a class tweak / copy / colour edit must NOT trigger this (the showcase TSX is large).
ADD_SURFACE=0
case "$ARGUMENTS" in
  *add*|*Add*|*ADD*|*new\ *|*New\ *|\
  *přidej*|*Přidej*|*nová*|*nový*|*nové*|\
  *screen*|*section*|*panel*|*page*|*view*|*layout*|*sidebar*|*obrazovk*|*sekc*|*stránk*|*artboard*)
    ADD_SURFACE=1 ;;
esac
# A structural edit (AST fast-path did NOT fire) that adds a region is also add-surface.
# Never for surgical single-attribute edits (step 3a handles those).
if [ "$ADD_SURFACE" = "1" ] && [ "${ACTIVE##*.}" = "tsx" ]; then
  # Resolve platform + DS preview dir independently of the LOAD_CSS branch (which may
  # not have run for a non-style add-surface edit).
  SC_DS=$(jq -r '.designSystem // "project"' "$META_PATH" 2>/dev/null || echo "project")
  SC_PLATFORM=$(jq -r '.platform // "desktop"' "$META_PATH" 2>/dev/null || echo "desktop")
  [ "$SC_PLATFORM" = "tablet" ] && SC_PLATFORM="mobile"   # tablet rides mobile showcase family
  SC_PREVIEW=$(jq -r ".designSystems[] | select(.name==\"$SC_DS\") | .path" "$CFG" 2>/dev/null || echo "system/$SC_DS")
  SC_DIR="$REPO_ROOT/$DESIGN_ROOT/$SC_PREVIEW/preview"
  SHOWCASE=$(ls "$SC_DIR/ui_kits-${SC_PLATFORM}-showcase.tsx" 2>/dev/null | head -1)
  # Fallback: any showcase the DS ships (shell reference only). Never fatal.
  [ -z "$SHOWCASE" ] && SHOWCASE=$(ls "$SC_DIR/ui_kits-"*-showcase.tsx 2>/dev/null | head -1)
  if [ -n "$SHOWCASE" ]; then
    echo "→ pre-loading platform showcase: $SHOWCASE"
  else
    echo "→ add-surface edit but DS ships no showcase — placing surface from component priors + DS readme"
  fi
fi

# ── Brand-touching edits: pre-load the DS logo + iconography specimens (DDR-141) ──
# When the feedback touches the brand mark or icons (EN + CZ cues), the orchestrator needs
# the CANONICAL specimens in context — otherwise it redraws/invents. Add-surface edits get
# them too (a new full-screen surface typically places the mark).
BRAND_EDIT=0
grep -qiE 'logo|wordmark|brand|značk|znack|ikon|icon|glyph' <<< "$ARGUMENTS" && BRAND_EDIT=1
if { [ "$BRAND_EDIT" = "1" ] || [ "$ADD_SURFACE" = "1" ]; } && [ "${ACTIVE##*.}" = "tsx" ]; then
  BR_DS=$(jq -r '.designSystem // "project"' "$META_PATH" 2>/dev/null || echo "project")
  BR_PREVIEW=$(jq -r ".designSystems[] | select(.name==\"$BR_DS\") | .path" "$CFG" 2>/dev/null || echo "system/$BR_DS")
  BR_DIR="$REPO_ROOT/$DESIGN_ROOT/$BR_PREVIEW/preview"
  BR_LOGO=$(ls "$BR_DIR"/logo.{tsx,jsx,svg,html} 2>/dev/null | head -1)
  BR_ICON=$(ls "$BR_DIR"/iconography.{tsx,jsx,html} 2>/dev/null | head -1)
  [ -n "$BR_LOGO" ] && echo "→ pre-loading canonical brand mark: $BR_LOGO"
  [ -n "$BR_ICON" ] && echo "→ pre-loading iconography family: $BR_ICON"
  [ -z "$BR_LOGO$BR_ICON" ] && [ "$BRAND_EDIT" = "1" ] && echo "→ brand edit but DS ships no logo/iconography specimen — new art is legitimate (route via step 4.6)"
fi
```

**What the orchestrator does with those paths:**

- **Brand pre-load (DDR-141):** when `→ pre-loading canonical brand mark: …` / `→ pre-loading iconography family: …` printed, `Read` those specimens and pass them to the edit prompt as the **identity reference** — any brand mark the edit places or touches IS the specimen's mark (lift its markup; adapt only size/placement), and any icon matches the iconography family's grid/stroke/corner rules. Never redraw the mark from memory.

- **Add-surface pre-load:** when `→ pre-loading platform showcase: …` printed, `Read` that showcase TSX and pass it to `frontend-design` as the **placement reference** — the new surface must adopt the showcase's shell arrangement (nav / sidebar / toolbar / main / status), same chrome material, instead of inventing a new shell. It is reference, not a wireframe — the new surface still owns its own content. Skip the load (and this read) for surgical / cosmetic edits.
  - **Artboard-isolation hard-stop (carry into the `frontend-design` prompt for any add-surface / new-artboard edit):** the new `<DCArtboard>` is a fixed-size surface — never author it with viewport length units (`vw`/`vh`/`*-screen`/`h-[100vh]`) or viewport `@media` width queries / Tailwind responsive prefixes (`md:`/`lg:`), which resolve against the studio canvas stage and reflow the mock when the panel/sidebar/window resizes. Use fixed px / `%` / `h-full`, or `@container`+`cqw/cqh` for artboard-relative responsiveness. One artboard = one form factor (add a second artboard for another breakpoint). Full rule: `/design:new` envelope → "Artboard isolation". `design-system-keeper` Pass A.7 warns on violations.

- **Cache HIT (`$DCTX` non-empty):** seed the `frontend-design` prompt directly from the cached pack — `classNames` (what `_components.css` offers: `.btn`, `.tile`, `.sku`, `.seg`, …), `tokenNames` (the `colors_and_type.css` namespace), and `libExports` (the canvas-lib authoring vocabulary). **Skip the CSS + canvas-lib Reads entirely.** This is the C5 win — repeat edits on an unchanged DS pay zero read cost.
- **Cache MISS:** if `LOAD_CSS=1`, `Read` `_components.css` + `colors_and_type.css`, and (for any `.tsx`) the canvas-lib, **in parallel — one assistant message, multiple Read tool calls** (independent files; serialising just adds round-trips). Then extract the vocabulary and write the pack so the next edit hits:

  ```sh
  # Build the pack JSON from the parsed vocabulary, then store it:
  #   { "dsName": "...", "classNames": [...from _components.css...],
  #     "tokenNames": [...--tokens from colors_and_type.css...],
  #     "libExports": [...exported names from canvas-lib.tsx...],
  #     "logoSpecimenPath": "<preview/logo.* or null>",              // DDR-141 brand inventory —
  #     "iconographySpecimenPath": "<preview/iconography.* or null>", // paths + names only; mark
  #     "assetNames": [...filenames under <ds>/assets/, if any...] }  // CONTENT is Read fresh
  printf '%s' "$PACK_JSON" | maude cache put design-context "$DS_NAME/$TOKENS_SHA"
  ```

For `css_mode: "tailwind"` canvases skip (Tailwind utilities self-describe); for `css_mode: "modules"` load the canvas's `<Slug>.module.css` sidecar instead. Missing the canvas-lib vocabulary is the most common reason a `/design:edit` suggests re-inventing a helper that already exists — so on a miss the lib read is non-negotiable, and on a hit `libExports` carries that same vocabulary forward.

### 2. Server lifecycle (always first) + runtime-bundle health probe

```bash
PORT=$(maude design server-up --root "$REPO_ROOT")

# Parse-clean ≠ run-clean. A stale server process can cache a broken dynamic
# build of /_canvas-runtime/*.js (the canvas TSX serves fine, but the iframe
# throws at module-eval time). System-review 2026-05-27 D-1. --restart auto-kills
# and respawns; helper exits 3 only when the restarted server is still defective.
maude design runtime-health \
  --port "$PORT" \
  --root "$REPO_ROOT" \
  --restart \
  --quiet \
  || { echo "✗ runtime bundles defective even after restart — abort /design:edit (see stderr)"; exit 1; }
```

`server-up.sh` detects a running server (PID + `curl /_health`), restarts on stale, polls 10 s, stdout = port. Diagnostics on stderr (`✓ server alive pid=… port=…` / `→ starting dev server …`).

`runtime-health.sh` verifies that for every `/_canvas-runtime/<slug>.js` the server returns bytes close to the on-disk pre-built bundle (ratio ≥ 0.5). Lower ratio → defective dynamic Bun.build → auto-restart + a single re-probe; if that doesn't help, `/design:edit` aborts and recommends `lsof -i :$PORT` + manual restart.

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
# (Separate surface: the FigJam draw layer — see skill `whiteboard` for the
# full read/write/template spec. Reach for it when the feedback references the
# user's sketches/stickies/a note pinned to an element, asks to add a
# note/sticky/label to the board, or to answer ON the board — prefer
# `/design:board` over hand-rolling `maude design annotate` calls here.)
OPEN_COMMENTS=$(jq -c '[(.active_comments // [])[] | select(.status != "resolved")]' "$DESIGN_ROOT/_active.json" 2>/dev/null || echo '[]')

# Slug + COMMENTS_FILE for the resolve path. prep.sh (step 1) already computed
# the slug via slug.sh — reuse $ACTIVE_SLUG; fall back to a direct slug.sh call
# only if prep didn't run (e.g. ACTIVE changed after pre-flight).
SLUG="${ACTIVE_SLUG:-$(maude design slug "${ACTIVE#$DESIGN_ROOT/}")}"
COMMENTS_FILE="$DESIGN_ROOT/_comments/$SLUG.json"
```

If `SEL_VALID=1`, the edit is **scoped** to the selected element (selector + dom_path + outerHTML). If not, the edit is **canvas-wide**. Stale selection (`selected.file !== active`) → ignore and flag in the response.

**Open comments take precedence when feedback is empty / generic.** Each entry: `{id, selector, dom_path, tag, classes, bounds, html_excerpt, text, status, created}`. Orchestrator behaviour:

1. **Empty / generic feedback** ("polish", "fix open comments", "")  + open comments exist → iterate over each comment as a separate scoped edit; resolve each after successful edit.
2. **Specific feedback referencing comments** ("address comment 3", "fix all the typography feedback") → match comment ids/text to the request, edit those, resolve them.
3. **Feedback unrelated to comments** → execute feedback first, then warn user that N open comments still need attention.

**To mark a comment resolved (write directly — server picks up on next read / WS broadcast):**
```bash
jq --arg id "$ID" 'map(if .id == $id then .status = "resolved" | .resolved_at = (now | todate) else . end)' \
  "$COMMENTS_FILE" > "$COMMENTS_FILE.tmp" && mv "$COMMENTS_FILE.tmp" "$COMMENTS_FILE"
```

### 3a. AST-aware fast-path (Phase 3.6 — TSX canvases only)

**Trigger:** all four conditions true:

1. Active canvas extension is `.tsx` (TSX format, two-pass pipeline emits `data-cd-id`).
2. `_active.json.selected.v === 2` AND `_active.json.selected.id` is set (the user Cmd+Clicked an element that carries a pipeline-emitted `data-cd-id`).
3. Feedback names a **single-element single-attribute** change. Heuristic — the feedback contains exactly one of: a class change ("make this `<X>`-class", "set className to …", "switch to `.btn--ghost`"), a style swap ("change padding to 14", "color → amber", "border-radius 8"), or a plain string-attribute set ("aria-label X", "title X").
4. The change is **non-structural** — feedback doesn't insert, delete, or reorder elements.

When all four fire, skip the full-file `Edit`/`Write` of step 5 + the post-edit `grep` validation of step 6 (the surgical edit can't break tokens or rootClass — it only touches one attribute). Instead:

```bash
ACTIVE_EXT="${ACTIVE##*.}"
SEL_V=$(jq -r '.selected.v // 0'   "$DESIGN_ROOT/_active.json")
SEL_ID=$(jq -r '.selected.id // empty' "$DESIGN_ROOT/_active.json")

if [ "$ACTIVE_EXT" = "tsx" ] && [ "$SEL_V" = "2" ] && [ -n "$SEL_ID" ] && [ "$AST_EDIT_OK" = "1" ]; then
  # $ATTR + $NEW_VALUE come from interpreting the feedback. Examples:
  #   ATTR=className   NEW_VALUE="btn btn--ghost"
  #   ATTR=style.color NEW_VALUE='"#facc15"'   # JS expression for style.*
  #   ATTR=aria-label  NEW_VALUE="Save changes"
  maude design canvas-edit \
       "$ACTIVE" "$SEL_ID" "$ATTR" "$NEW_VALUE"
  AST_EDITED=1
fi
```

`canvas-edit.sh` exits 0 on a successful (or no-op) edit and prints one JSON line — `{"canvas": "...", "id": "...", "delta": <int>}`. On any failure (id not in source, parse error, unsupported attribute shape) it exits 2 and writes a readable error to stderr; in that case fall through to the canvas-wide path (step 5).

**When AST fast-path runs**, the orchestrator still:

- Takes the step-4 snapshot (single-line edits are still rollback-able).
- Runs the step-7 post-write reality-check screenshot (the change still needs to render).
- Routes to the critic panel per step 8 (the panel reads screenshots, not source — format-blind).
- Refreshes docs per step 9.

It skips:

- Step 5 (full-file Read + Edit/Write — the AST helper already applied the change).
- Step 6's `grep` validation — surgical attribute swaps can't move the tokens link or the rootClass.
- The step-3.5 element-focused screenshot (the AST path already knows the exact target).

**When the AST path does NOT run** (no selection, v=1 selection, multi-element feedback, structural change), fall through to step 3.5 + step 5 unchanged.

**Motion-role feedback shortcut (Phase 3.7 / DDR-049).** When feedback names a motion role (`"make the panel snappier"`, `"slower flip"`, `"this should use spring"`) AND the selected element is a `<MotionDemo role="…">`, the AST fast-path can target the `role` prop directly: `ATTR=role`, `NEW_VALUE="<one of: flip|panel|route|soft|spring|scroll|drag|presence>"`. This is faster than a full-file rewrite and keeps the canvas-lib vocabulary intact (the role-→-token mapping in canvas-lib's `MOTION_ROLE_DEFAULTS` already encodes the speed change). If the feedback names a NEW role outside the 8-vocabulary, fall through to the full-file path (the request is structural, not a prop swap).

The token-cost win is the headline result: the orchestrator reads ~5 KB of canvas state (`_active.json` excerpt + one selection record) instead of the full canvas TSX, and writes 0 bytes of file diff outside the targeted attribute byte range. Tracked against the Phase 3.6 budget "< 30 % of pre-phase token cost on a 1-element edit."

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
maude design screenshot --full --out "$OUT"

# If the selected element has a data-dc-element="<id>", grab a focused crop too:
if [ "$SEL_VALID" = "1" ] && [[ "$(jq -r '.selected.selector // empty' "$DESIGN_ROOT/_active.json")" == *"data-dc-element="* ]]; then
  EL_ID=$(jq -r '.selected.selector' "$DESIGN_ROOT/_active.json" | sed -nE 's/.*data-dc-element="([^"]+)".*/\1/p')
  maude design screenshot --element "$EL_ID" --out "$HIST/$N-context-element.png"
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

### 4.5 AI activity banner — start (Phase 8 Task 4)

Phase 8 ships a yellow "Claude is editing this canvas — your changes may conflict" banner that any browser tab opened on the same canvas sees during this edit. Fire `/_api/ai/start` now so the banner appears before any file mutation, then re-ping `/heartbeat` once between long-running steps (post-validate + post-critic), and `/end` on step 10 (success) or in any error / abort path. The server auto-clears after 30 s of heartbeat silence — covers crashes — but the explicit `/end` ensures the banner clears instantly on normal completion.

```bash
# Phase 8 Task 4 — soft lock banner. Fires before step 5 (apply edit).
curl -s -m 2 -X POST -H 'content-type: application/json' \
  -d "{\"file\":\"$ACTIVE\",\"author\":\"Claude (acting for $(git -C "$REPO_ROOT" config user.name 2>/dev/null || echo 'anonymous')\"}" \
  "http://127.0.0.1:$PORT/_api/ai/start" >/dev/null 2>&1 || true
trap 'curl -s -m 2 -X POST -H "content-type: application/json" -d "{\"file\":\"$ACTIVE\"}" "http://127.0.0.1:$PORT/_api/ai/end" >/dev/null 2>&1 || true' EXIT
```

Treat the curl/trap as best-effort. The banner is decorative; an unreachable dev-server (offline, port mismatch) shouldn't abort an edit.

### 4.6 Custom-art routing → `draw-agent` (conditional)

**Fires when the feedback asks to draw/add a genuine custom vector mark** — a logo, custom icon, illustration, or diagram — rather than tweak an existing element. Drawing SVG by hand (the orchestrator typing `<path d="…">` coordinates) is precisely the drift-prone path the geometry engine replaces, so route these to `draw-agent` in **inline** mode instead.

```bash
# Intent: a draw/create request naming a mark type (EN + CZ cues).
WANTS_DRAW=$(grep -iqE "(draw|create|add|nakresli|přidej|vytvoř)[^.]*(logo|wordmark|brand mark|icon|illustration|diagram|svg|vector|mark|ikon)" <<< "$FEEDBACK" && echo 1 || echo 0)
```

**Skip** (fall through to the normal hand-edit in step 5) when:
- The request is a tweak to an **existing** element ("make the icon bigger", "change the logo color") — that's a scoped edit, not new art.
- The mark is a trivial **icon-set glyph** the DS already provides (just reference the set; don't engine-build a one-`<path>` chrome icon).
- **The mark is the brand logo/wordmark AND the DS ships a canonical specimen** (the step-1.5 brand pre-load resolved `$BR_LOGO`) — **substitute the canonical mark** (lift its markup from the specimen; adapt only size/placement via tokens/classes), don't draw a new one. Redrawing a mark the DS already ships is the invention-laundering path DDR-141 closes; `draw-agent` is for art the DS does NOT ship.
- The feedback doesn't name a mark type at all.

**When `WANTS_DRAW=1` and it's genuine new art**, spawn `draw-agent` inline against the active canvas (it owns the plan→generate→rank→verify loop), then jump to step 7 (confirmation screenshot) — skip the manual step 5 edit:
```
Agent(
  description: "draw mark into <active canvas>",
  subagent_type: "design:draw-agent",
  prompt: <<EOF
brief:         "<feedback, verbatim>"
type:          "logo | icon | illustration | diagram"   # infer from the feedback
grid:          <1 logo/icon · 0 illustration · 8 diagram>
output_mode:   "inline"
into_canvas:   "<abs path to active canvas>"
selected:      <selected element JSON if the edit is scoped (place the mark there), else null>
slug:          "<canvas-slug>-<mark>"
config:        <contents of .design/config.json>
designRoot:    "<abs designRoot>"
opt_out_scope: "<scope or empty>"
max_rounds:    3
candidates_n:  2
EOF
)
```
The step-8 critic panel then includes `draw-critic` automatically (the `HAS_CUSTOM_SVG` routing signal fires once the mark lands). **Failure handling:** agent fails / can't converge → fall back to the normal step-5 hand-edit and note it.

### 5. Apply edit

Read the canvas file. **If selection is valid**, build a scoped prompt (selector + dom_path + outerHTML + bounds + feedback) — the orchestrator knows the pattern from `design/SKILL.md` "Scoped edit prompt". Edit using the `Edit` tool with `old_string` matched to a unique substring of the selected element (if outerHTML appears multiple times, use the dom-path context to disambiguate).

**If there's no selection**, the edit is canvas-wide. Use Edit for a minimal diff (preferred). Write only when the change is a substantial rewrite, but preserve:
- `<link rel="stylesheet" href=".../<TOKENS_REL>">`
- `<body class="<ROOT_CLASS>" data-theme="…">`
- The Babel/UMD React mount pattern (if present)
- All existing tokens (`var(--*)` references)

**Touch the paired `.tsx` after editing a sibling `.css` (D-2 — highest-ROI fix).** For `css_mode` canvases that carry a sibling `<slug>.css` (NOT Tailwind / inline modes), the dev-server's canvas-build **inlines the CSS at module init and the bundle cache keys on the `.tsx` mtime** — so a CSS-only edit is invisible until something bumps the `.tsx` mtime (or a server restart). After editing any `<slug>.css`, `touch <slug>.tsx` so the canvas-build re-inlines the CSS. Without this, the confirmation screenshot in step 7 reflects the *pre-edit* CSS — studyfi burned 5 identical "nothing changed" screenshots on exactly this. (Tailwind/inline-mode canvases have no sibling `.css`, so this does not apply to them.)

### 6. Validate

```bash
grep -q "$(basename "$TOKENS_REL")" "$ACTIVE" || RESTORE=1
# Accept BOTH plain HTML (class="…") and JSX (className="…") form — React canvases
# render the rootClass via JSX so it never appears as a literal HTML attribute.
grep -qE "(^| )(class|className)=\"$ROOT_CLASS([\" ])" "$ACTIVE" || RESTORE=1
# grep for hardcoded #hex in style attributes — should be 0 hits in newly added lines
```

If `RESTORE=1`, copy back the snapshot and report drift to user. Don't leave broken HTML.

```bash
# Phase 8 Task 4 — refresh AI banner heartbeat (keeps the banner alive through
# the validate + screenshot + critic steps that follow).
curl -s -m 2 -X POST -H 'content-type: application/json' \
  -d "{\"file\":\"$ACTIVE\"}" \
  "http://127.0.0.1:$PORT/_api/ai/heartbeat" >/dev/null 2>&1 || true
```

### 7. Post-write reality check — confirmation screenshot

**Always fires, regardless of `--no-critic`.** Reality check (does the file render?), ne quality check.

> **Activity overlay (Phase 13 / DDR-029).** While each Edit/Write lands, any open canvas tab shows a live "editing — `<file>`" overlay (pulsing rim + corner badge) on the affected artboard(s), then cross-fades out ~3 s after the last write. It's fs-watch-driven and automatic — no action required. Exports and `hide-chrome` captures suppress it; the peripheral rim doesn't obstruct the reality-check screenshot.

**Background overlap (Phase C / DDR-061).** When the critic panel will run (not `--no-critic`), fire this capture as a **background Bash call** (`run_in_background: true`) and spend the wait on step-8 prep — resolving the opt-out scope, the routed panel set (8a/8b decision), the per-critic inline DS context (already cached from step 1.5), and the `RUN_KEEPER` ds-keeper context. Hold the batch ready; when the background job completes you are notified (do **not** poll/sleep), then `Read` the PNG for the reality check and spawn the prepped panel. The CSS-mtime `touch` below must happen **before** the capture is launched, so do it first, then background the screenshot. If `run_in_background` is unavailable, fall back to the synchronous capture — it just blocks — and prep afterward. (`--no-critic` runs the capture synchronously; there's no panel to overlap with.)

```bash
# D-2 — if the active canvas is css_mode with a sibling <slug>.css that we just
# edited, bump the .tsx mtime so canvas-build re-inlines the CSS BEFORE the
# screenshot (the bundle cache keys on the .tsx mtime; a CSS-only edit is
# otherwise invisible until restart). No-op when there's no sibling .css.
ABS_ACTIVE="$REPO_ROOT/$DESIGN_ROOT/${ACTIVE#$DESIGN_ROOT/}"
SIBLING_CSS="${ABS_ACTIVE%.tsx}.css"
if [ "${ACTIVE##*.}" = "tsx" ] && [ -f "$SIBLING_CSS" ]; then
  touch "$ABS_ACTIVE" && echo "→ touched $(basename "$ABS_ACTIVE") to re-inline sibling CSS"
fi

OUT="$DESIGN_ROOT/_history/$SLUG/$NNN-baseline.png"
maude design screenshot --full --out "$OUT" \
  || echo "⚠ baseline screenshot not written"
```

The helper resolves the URL from `_server.json` + `_active.json`, polls for canvas mount, picks the engine (agent-browser > playwright fallback). Diagnostics on stderr.

The screenshot path is referenced in the final print + chat.md row. If it renders blank → warn `⚠ canvas rendered blank — likely JSX error`, don't abort (the file exists, the user can open it manually).

Detaily: SKILL.md "Post-write reality check".

### 7.5. Design-system keeper precheck (conditional)

**Auto-routed when the diff is substantial.** The `design-system-keeper` agent (read-only) audits the just-edited canvas for two failure modes — pattern reinvention (lifting existing canvas shapes instead of inventing parallel ones) and token-usage drift (using a token in the wrong role per the DS Token usage guide). The retro at `.ai/logs/system-reviews/docs-site-design-generation-review.md` is the source of this step.

Unlike `/design:new` (where ds-keeper always fires), `/design:edit` runs ds-keeper **only when the iteration is non-trivial** — to avoid spawn cost on every single-line tweak. Triggers:

- **Diff ≥ 10 lines changed** between snapshot (`$HIST/$N-$TS.bak` from step 4) and current `$ACTIVE`, OR
- **Any new class root appears** in the candidate that wasn't in the snapshot (new compositional element added)

```bash
# Skip if --skip-ds-keeper flag was passed.
if grep -q -- '--skip-ds-keeper' <<< "$ARGUMENTS"; then
  echo "→ ds-keeper precheck skipped per --skip-ds-keeper flag"
  RUN_KEEPER=0
else
  SNAPSHOT="$HIST/$N-$TS.bak"
  DIFF_LINES=$(diff "$SNAPSHOT" "$ACTIVE" | grep -cE '^[<>]' || echo 0)

  # New class roots — set difference (candidate − snapshot).
  CAND_CLASSES=$(grep -oE '(className|class)="[^"]+"' "$ACTIVE"   | sed -E 's/^(className|class)="//; s/"$//' | tr ' ' '\n' | grep -E '^[a-z][a-z0-9-]+$' | sort -u)
  PREV_CLASSES=$(grep -oE '(className|class)="[^"]+"' "$SNAPSHOT" | sed -E 's/^(className|class)="//; s/"$//' | tr ' ' '\n' | grep -E '^[a-z][a-z0-9-]+$' | sort -u)
  NEW_CLASSES=$(comm -23 <(echo "$CAND_CLASSES") <(echo "$PREV_CLASSES") | wc -l)

  if [ "$DIFF_LINES" -ge 10 ] || [ "$NEW_CLASSES" -gt 0 ]; then
    RUN_KEEPER=1
  else
    RUN_KEEPER=0
    echo "→ ds-keeper precheck skipped (diff $DIFF_LINES lines, $NEW_CLASSES new class roots — below trigger threshold)"
  fi
fi
```

When `RUN_KEEPER=1`, spawn ds-keeper in parallel with the critic panel (step 8), same envelope shape as `/design:new` step 9.5. Output → `$HIST/$N_KEEPER-ds-keeper.md`. Findings merge into the iter-1 panel summary; self-promoted blockers (mass drift) get priority in the auto-fix loop. Same failure handling as `/design:new` step 9.5 — agent failure does not block the panel.

**Pass `platform_showcase_path` + the DDR-141 brand/fidelity inputs to the keeper** so Pass A.6 (product-shell reuse, DDR-127) and Pass A.8 (brand-asset reuse, DDR-141) can check whether a substantial edit reinvented the shell or the brand identity. Resolve them cheaply here even when the step-1.5 pre-loads didn't run (a non-add-surface edit can still cross the diff threshold):

```bash
SC_DS=$(jq -r '.designSystem // "project"' "$META_PATH" 2>/dev/null || echo "project")
SC_PLATFORM=$(jq -r '.platform // "desktop"' "$META_PATH" 2>/dev/null || echo "desktop")
[ "$SC_PLATFORM" = "tablet" ] && SC_PLATFORM="mobile"
SC_PREVIEW=$(jq -r ".designSystems[] | select(.name==\"$SC_DS\") | .path" "$CFG" 2>/dev/null || echo "system/$SC_DS")
KEEPER_SHOWCASE=$(ls "$REPO_ROOT/$DESIGN_ROOT/$SC_PREVIEW/preview/ui_kits-${SC_PLATFORM}-showcase.tsx" 2>/dev/null | head -1)
[ -z "$KEEPER_SHOWCASE" ] && KEEPER_SHOWCASE=$(ls "$REPO_ROOT/$DESIGN_ROOT/$SC_PREVIEW/preview/ui_kits-"*-showcase.tsx 2>/dev/null | head -1)

# DDR-141 — brand specimens + fidelity policy (scope full overrides strict; see /design:new step 4)
KEEPER_LOGO=$(ls "$REPO_ROOT/$DESIGN_ROOT/$SC_PREVIEW/preview"/logo.{tsx,jsx,svg,html} 2>/dev/null | head -1)
KEEPER_ICON=$(ls "$REPO_ROOT/$DESIGN_ROOT/$SC_PREVIEW/preview"/iconography.{tsx,jsx,html} 2>/dev/null | head -1)
DS_FIDELITY=$(jq -r '.dsFidelity // "advisory"' "$CFG" 2>/dev/null || echo advisory)
# Scope may not be resolved yet at 7.5 (full resolution order lives in 8b) — read the
# same sources here: --opt-out flag wins, else the canvas sidecar; default palette.
K_SCOPE=$(grep -oE -- '--opt-out=(palette|aesthetic|full)' <<< "$ARGUMENTS" | cut -d= -f2)
[ -z "$K_SCOPE" ] && K_SCOPE=$(jq -r '.opt_out_scope // "palette"' "$META_PATH" 2>/dev/null || echo palette)
[ "$K_SCOPE" = "full" ] && DS_FIDELITY="advisory"
# Add to the keeper-spawn prompt:
#   platform_showcase_path: "$KEEPER_SHOWCASE"   (empty → Pass A.6 no-ops)
#   brand_logo_path:        "$KEEPER_LOGO"       (empty → Pass A.8 no-ops)
#   brand_iconography_path: "$KEEPER_ICON"
#   opt_out_scope:          "$K_SCOPE"
#   ds_fidelity:            "$DS_FIDELITY"
```

### 8. Auto-critic + auto-fix loop (default — opt out with `--no-critic`)

#### 8a. DS-drift fast-path (token-only fixes)

Before resolving the panel, check whether the user's feedback is a **DS-drift complaint** — a request to undo token misuse, not a request for new design work. The conservative regex below matches feedback that *explicitly* names the design system or DS drift:

```bash
DRIFT_FEEDBACK=0
if grep -qiE '\b(design[ -]?system|DS)[ -](drift|color[s]?|barv[ay]|barev)\b|\bjiné barvy než (DS|design system)\b|\b(wrong|different) (colors?|tokens?) (than|from) (DS|design system|the system)\b|\bDS drift\b' <<< "$FEEDBACK"; then
  DRIFT_FEEDBACK=1
fi
```

**Conservative by design.** Generic color comments ("the green here feels off", "tighter palette") are NOT DS-drift complaints — they're aesthetic feedback that wants the full critic panel. The regex requires explicit "DS" / "design system" / Czech "jiné barvy než DS" wording. On ambiguity, fall through to the default routing.

**When `DRIFT_FEEDBACK=1`:** route a stripped panel — `[design-system-keeper, design-critic]` only — and cap the loop at **2 iterations**. Reasoning: DS drift fixes are deterministic find-and-replace once ds-keeper surfaces the mismatch — no aspiration / signature / a11y reverification needed beyond what `design-critic` already does inline. This skips 4–6 critic spawns per iteration vs the default panel.

If the fast-path runs but ds-keeper produces 0 token-usage findings, the orchestrator surfaces a one-line note ("ds-keeper found no DS drift — falling through to standard panel for iter 2") and proceeds with the default routing for the next iteration.

#### 8b. Standard routing

**Resolve opt-out scope first.** Order: (1) `--opt-out=<scope>` flag in `$ARGUMENTS` wins; (2) else read `<active>.meta.json` `opt_out_scope` field; (3) else the DS default from `config.aestheticAmbition` (DDR-073 — `maximalist` → `full`, `expressive` → `aesthetic`, `restrained`/`confident`/missing → `palette`), via `jq -r '.aestheticAmbition // "restrained"' "${DESIGN_ROOT:-.design}/config.json"`; (4) else default `palette`. Pass the resolved scope to every critic in the panel via the input envelope. Each critic adjusts severity per its own spec — `design-critic` / `graphic-design-critic` / `typography-critic` / `signature-moment-critic` downgrade matching DS-rule blockers to warnings; `a11y-critic` / `frontend-critic` / `copy-critic` ignore the parameter (their blockers are universal). Persist the resolved scope back to `.meta.json` if it changed.

**Resolve `ds_fidelity` alongside it (DDR-141):** `jq -r '.dsFidelity // "advisory"'` from `.design/config.json`; a resolved scope of `full` overrides to `advisory` (explicit free-use beats project policy — one axis, not two competing switches). Pass it to `design-system-keeper` + `brand-critic` in the same envelope: under `strict`, their reuse findings (invented brand mark, reinvented component/icon family, parallel shell) are **blockers** that count toward the loop's correctness gate; under `advisory` (default) they stay warnings — today's behavior.

**See `skills/design/SKILL.md` "Auto-critic loop" + "Opt-out scope" for full spec.** Key points:

| Flag | max_iter | aspiration_target | Panel | Use |
|---|---|---|---|---|
| (default) | 4 | 4.0 / 5 | routed (incl. `signature-moment-critic` when feedback contains polish/nicer/elegant cues) | every /design:edit — solid-for-review |
| `--no-critic` | 0 | n/a | (skip) | quick / dirty edit |
| `--perfect [N]` | N (default 8) | 4.5 / 5 | routed | extended polish, broader scope |
| `--perfect --all` | N | 4.5 / 5 | every critic incl. aspiration | exhaustive / portfolio-grade |
| `--opt-out=<scope>` | (orthogonal) | (orthogonal) | (orthogonal) | Override scope for this iteration. `palette` (default) / `aesthetic` (palette + gradients/radii free) / `full` (DS advisory). A11y enforced regardless. Persists to `.meta.json`. |
| `--skip-ds-keeper` | (orthogonal) | (orthogonal) | (orthogonal) | Skip the `design-system-keeper` precheck (step 7.5). Use for known-experimental edits where reinvention is intent. |

Default loop **multi-axis** stop condition: `correctness == 0 AND aspiration ≥ 4.0 AND specificity == "pass" AND no_gains_for_1_round`. When it plateaus → exit `stable-but-bland` with a diagnostic (lowest 2 axes), instead of silent success on "blockers == 0 but bland."

**Per iteration, decide the panel set first, then spawn it in one parallel batch.** The decision block selects which critics run:

1. **`DRIFT_FEEDBACK=1`** (step 8a) → `[design-system-keeper, design-critic]`, cap 2 iter.
2. **else** → the routed panel from the table above (default 4-critic set; add `signature-moment-critic` when feedback carries polish/nicer/elegant cues; `--perfect --all` → every critic).
3. **`design-system-keeper`** (step 7.5) joins the same batch when `RUN_KEEPER=1`.

Then: **spawn the selected set in a single assistant message using parallel Agent tool calls** → parse JSON verdicts → write NNN-PANEL.md → check exit conditions → auto-fix top 3 blockers → repeat. Even when the selected set is a single critic, keep the explicit "spawn in parallel" framing so the habit holds. Track best snapshot, restore on divergence.

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

- **Server won't start (10s timeout)** → fail with a `cat $DESIGN_ROOT/_server.log` instruction.
- **`_active.json` missing / `active = null`** → fail: "Open a file in the browser tab, click on it, then try again."
- **Active path is not `.tsx`** → fail: "The active canvas must be a TSX file."
- **Snapshot fail (no disk / permission)** → refuse, don't edit.
- **Edit breaks the tokens link / rootClass / hardcoded colors** → automatic rollback from the snapshot, report.
- **Selected element's outerHTML appears multiple times in the file** → use dom_path to disambiguate or fail with a suggestion to narrow the selection (Cmd+Click a more specific child).
- **Stale selection** (`selected.file !== active`) → ignore the selection, edit canvas-wide, flag once in the response.

## Tips

- **Pin-to-element edit** — hold **Cmd** (or Alt) in the canvas and hover — the element highlights. **Cmd+click** to select it. The status bar at the bottom shows `● selector — text`. The next `/design:edit "<feedback>"` edits **only that element**, not the whole file.
- **Esc inside the canvas** clears the selection. Or the `×` button in the status bar.
- **Tab switch clears the selection** automatically (selection is per-canvas).
- **Refresh canvas** — Cmd+R inside the iframe. If it doesn't work, click "↻ active" in the header.
- **Annotated screenshot** — `/design:screenshot` → open the PNG in Preview → circle things → `/design:edit "..." --screenshot <path>`. A selection-aware screenshot is the default if you have an element selected.

After editing, continue with `/design:edit "<more feedback>"`, `/design:screenshot`, `/design:critic`, or `/design:handoff`. `/design:rollback` if the edit didn't work out.
