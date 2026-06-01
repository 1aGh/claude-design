---
name: design:new
category: daily
description: Vytvoř nový multi-artboard canvas projekt přes frontend-design — generic envelope adaptovaný podle .design/config.json. Default = --perfect (8 iter, full panel, target 4.5/5). Opt out přes --quick nebo --no-critic. Opt out z DS přes --opt-out=palette|aesthetic|full.
argument-hint: "<Name> \"<brief>\" [--component] [--mobile] [--quick | --no-critic] [--perfect-iter N] [--opt-out=palette|aesthetic|full] [--ds=<name>]"
---

# /design:new — scaffold nový canvas projekt

Vytvoří **nový multi-artboard canvas soubor** v `<designRoot>/<newCanvasDir>/<Name>.tsx` přes `frontend-design` plugin. Generic envelope se adaptuje podle `<repo>/.design/config.json` (rootClass, themeDefault, tokensCssRel, …). Canvas envelope (`DesignCanvas` / `DCSection` / `DCArtboard`) se importuje z virtuálního specifikátoru `@maude/canvas-lib`, který dev-server resolvuje na svou bundled canvas-lib v `plugins/design/dev-server/canvas-lib.tsx` (single source, ships s dev-server installem per DDR-025).

**Canvas projekt = `DesignCanvas` + jedna nebo více `DCSection` + jeden nebo více `DCArtboard`** (panable / zoomable infinite-canvas pattern). Single-page wrapper je anti-pattern; nový screen patří jako další `DCArtboard` do existujícího canvasu (přes `/design:edit "<add new artboard for X>"` ne přes `/design:new`).

**Sessions už neexistují.** Nová plocha = nový soubor v `<designRoot>/<newCanvasDir>/`. Žádný `.ai/design-sessions/` adresář, žádné `iterations/NNN.tsx`. Iterace je in-place edit s `_history/` snapshoty.

## Default = `--perfect`

`/design:new` je **high-leverage moment** — initial scaffold sets the canvas trajectory pro všechny budoucí `/design:edit "<feedback>"` iterace. Levné nedotáhnout, drahé refactorovat zpětně. Proto je critic panel **vždy on, vždy plný, vždy target portfolio-grade**:

- **max 8 iterations** auto-fix loop
- **aspiration target 4.5 / 5**
- **panel:** `signature-moment-critic` + `design-critic` + `frontend-critic` + `a11y-critic` (pokud canvas má interactive elements) — minimální set; viz step 10 pro routing detail
- **token cost:** ~150–300k per `/design:new` invocation. Tohle je deal — uplatňuje se vždy ne se náhodně neprokliká.

Opt-out flagy (pro vědomé výjimky):

| Flag | Co dělá | Kdy použít |
|---|---|---|
| (žádný) | Plný `--perfect` loop. **Default.** | Standard — chceš solidní startovní bod. |
| `--quick` | 1 critic (`signature-moment-critic`) + max 2 fix iter, žádný plný panel | Throwaway exploration ("can we even render a chart canvas?"), proof-of-concept |
| `--no-critic` | Skip auto-critic loop entirely (jen generate + reality-check) | Testovací / debug runs, kde jen ověřuješ že file vznikne |
| `--perfect-iter N` | Override max iterations (default 8) | Velké canvasy (10+ artboardů) co potřebují víc iterací; nebo malé kde 4 stačí |
| `--skip-ds-keeper` | Skip the `design-system-keeper` precheck (step 9.5) | Známě-experimentální canvasy kde reinvention je intent; debug runs |

**Mode není volitelný-on opt-in.** Mode je **opt-out**. Když user nechce platit cost, musí explicitně říct `--quick` nebo `--no-critic`. Ticha je souhlas s plným loopem.

**Vstup `$ARGUMENTS`:** `<Name> "<brief>" [--component] [--mobile] [--quick | --no-critic] [--perfect-iter N] [--ds=<name>]`

- `<Name>` — Title-Case s mezerami (`Match Recap`, `Scout Radar`) pro full-screen canvas projekt.
  - PascalCase (`MatchRecap`) když je to komponenta s `--component`.
- `<brief>` — co má canvas dělat / vypadat. Tady popisuj **co všechno bude v canvasu** (kolik artboardů, jaké screens, jaký flow), ne single screen.
- `--component` — vytvoří `<designRoot>/<newComponentDir>/<PascalName>.jsx` místo top-level HTML. Komponenty se mountují uvnitř canvas artboardů.
- `--mobile` — naznačí mobile aesthetic v promptu (mobile chrome, single column). Default = desktop. Pokud název obsahuje "Mobile" / "iOS" / "Android", auto-detect.
- `--quick` | `--no-critic` | `--perfect-iter N` — viz tabulka výše.
- `--ds=<name>` — pick which design system this canvas uses (multi-DS projects). Must match a name in `config.json.designSystems[]`. Default = `config.defaultDesignSystem`, falling back to `project` for single-DS layouts. **Unknown DS fails with hint to `/design:setup-ds <name>` — no fallback prompt** (clean separation: `new` does canvases, `setup-ds` does DS creation).
- `--opt-out=palette|aesthetic|full` — opt out z project DS rules. **Default = `palette`** (tokens link + rootClass envelope kept; local namespaced palette overrides colors only; type/radii/aesthetic still enforced). `aesthetic` = palette + gradients/off-ladder radii/alt type pairings/decorative SVGs allowed. `full` = DS treated as advisory. **A11y enforced at every scope.** Plain-language opt-out signals in the brief ("opt-out design system", "modern color scheme", "different feel", "fully off-system") trigger an inferred scope + one-shot AskUserQuestion before the loop kicks off — see SKILL.md "Opt-out scope" + "Iter-1 checkpoint when scope > palette".

**Backwards compat:** `--perfect` a `--perfect --all` jsou stále accepted (no-op pro samotný `--perfect`, `--all` rozšiřuje panel na **every** critic v `agents/`). User co píše `--perfect` explicitně dostane co očekává.

**Příklady:**
```
/design:new "Match Recap" "Post-game recap canvas — 3 artboardy: hero stat card, key moments timeline, share/embed view"
/design:new "Onboarding Desktop" "5-step onboarding flow — welcome, invite preview, identity, permissions, tour. Each as separate DCArtboard."
/design:new "Scout Radar Mobile" "Radar/sonar circular sweep finder — single full-screen canvas s 2 artboardy: scanning + result list" --mobile
/design:new MatchRecap "..." --component                   # komponenta v components/
/design:new "iOS Bikeshare Signup" "5-screen iOS signup flow, modern blue+orange palette" --mobile --opt-out=aesthetic
/design:new "Marketing Hero" "Landing hero with feature grid" --ds=marketing
```

## Postup

### 0. Pre-flight: bootstrap detection

Before scaffolding a canvas, check whether the project has a usable design system. Canonical recipe is `maude design bootstrap-check` (the on-PATH `maude` binary dispatches to the bundled helper — DDR-062) — exits 0 (ready) / 10 (needs `/design:init`) / 11 (needs `/design:setup-ds`). Use `--shell-export` to populate `HAS_DS`/`CONFIG_PRESENT`/`KNOWN_DS`/`DEFAULT_DS`/`REPO_ROOT`/`BOOTSTRAP_EXIT`:

```bash
eval "$(maude design bootstrap-check --shell-export)"
```

| State | Action |
|---|---|
| `HAS_DS=true` | Skip to step 1. **If `--ds=<name>` was passed**, validate it against `config.json.designSystems[].name`. Unknown DS → fail with:<br/>`Error: design system "<name>" not found in config.json.designSystems[].`<br/>`Available: <list>`<br/>`To create: /design:setup-ds <name> "<brief>"`<br/>**No fallback prompt** — clean separation between canvas creation (`new`) and DS creation (`setup-ds`). Resolve the DS's tokens + component HTML and pass as context to `frontend-design`. Write the chosen `designSystem` name into the new canvas's `.meta.json`. |
| `HAS_DS=false`, `CONFIG_PRESENT=false` | Print `→ Running /design:init to initialize project…` and invoke `/design:init --skip-prompts`. Then invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$BRIEF`. After bootstrap returns, continue to step 1 and create the canvas with the freshly-scaffolded tokens. |
| `HAS_DS=false`, `CONFIG_PRESENT=true` | Invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$BRIEF` directly. After bootstrap returns, continue to step 1. |

The skill treats `$BRIEF` as the answer to discovery Question 1 (product one-liner) and runs the full 8-question discovery, scaffolds the DS, runs the completeness-critic, and returns. The canvas creation then proceeds with the project's actual tokens (not a default placeholder set).

### 1. Resolve config + DS

Vyvolej skill `design` se vstupem: `new $ARGUMENTS`.

**One pre-flight call instead of 4–8 sequential jq reads.** `prep.sh` reads `.design/config.json` + `_active.json` + `_preflight.json` + `_server.json` in a single pass and exports the resolved vars (`REPO_ROOT`, `NAME`, `DESIGN_ROOT`, `ROOT_CLASS`, `THEME`, `TOKENS_REL`, `NEW_CANVAS_DIR`, `NEW_COMPONENT_DIR`, `TEAM_ACCENT`, `DEFAULT_DS`, `KNOWN_DS`, `ACCENT_STRATEGY`, `COLOR_SPACE`, `DEPS_OK`, `DEPS_MISSING`, `SERVER_UP`, `SERVER_PORT`). The DS-presence gate (`bootstrap-check.sh`, step 0) stays separate — it owns the 0/10/11 exit-code contract.

```bash
eval "$(maude design prep --shell-export --shape new --root "$REPO_ROOT")"
CFG="$REPO_ROOT/.design/config.json"
TEAM_DEFAULT="$TEAM_ACCENT"   # downstream alias

# Resolve target DS (multi-DS aware) — DEFAULT_DS / KNOWN_DS already exported by prep.sh
DS_FLAG=$(grep -oE -- '--ds=[a-z][a-z0-9-]*' <<< "$ARGS" | cut -d= -f2)
TARGET_DS="${DS_FLAG:-$DEFAULT_DS}"

# Validate against designSystems[]
KNOWN=$(jq -r '.designSystems // [] | map(.name) | join(",")' "$CFG")
if [[ -n "$DS_FLAG" ]]; then
  if ! jq -e --arg ds "$DS_FLAG" '.designSystems // [] | any(.name == $ds)' "$CFG" > /dev/null; then
    echo "Error: design system \"$DS_FLAG\" not found in config.json.designSystems[]."
    echo "Available: ${KNOWN:-<none>}"
    echo "To create: /design:setup-ds $DS_FLAG \"<brief>\""
    exit 1
  fi
fi

# Resolve DS-specific paths
DS_TOKENS=$(jq -r --arg ds "$TARGET_DS" '.designSystems[] | select(.name == $ds) | .path + "/colors_and_type.css" // empty' "$CFG")
DS_ROOT=$(jq -r --arg ds "$TARGET_DS"   '.designSystems[] | select(.name == $ds) | .path // empty' "$CFG")
# Fallback to single-DS layout if designSystems[] is empty
[[ -z "$DS_ROOT" ]] && DS_ROOT="system/project" && DS_TOKENS="$TOKENS_REL"
```

### 1.5 Cache the DS-context pack (Phase C / DDR-061)

Build (or reuse) the compact DS-context pack — component class names + token names + canvas-lib exports — keyed on `(DS-name, sha-of-the-source-files)`, the **same layer and key scheme** `/design:edit` step 1.5 uses. This lets step 1's "resolve DS context to pass `frontend-design`" AND the B16 inline critic-context (step where `design-critic` / `graphic-design-critic` / `typography-critic` get `tokens_path` + `components_css`) seed from the cached vocabulary instead of each re-`Read`ing `colors_and_type.css` + `_components.css`.

Access the cache via the `maude` CLI (declared dep, on PATH) — `cli/lib` is NOT beside the plugin in a marketplace install (DDR-061).

```bash
COMPONENTS_CSS="$REPO_ROOT/$DESIGN_ROOT/$DS_ROOT/preview/_components.css"
TOKENS_CSS="$REPO_ROOT/$DESIGN_ROOT/$DS_TOKENS"
CANVAS_LIB="$CLAUDE_PLUGIN_ROOT/dev-server/canvas-lib.tsx"
TOKENS_SHA=$(cat "$COMPONENTS_CSS" "$TOKENS_CSS" "$CANVAS_LIB" 2>/dev/null | git hash-object --stdin | cut -c1-12)
DCTX=$(maude cache get design-context "$TARGET_DS/$TOKENS_SHA" 2>/dev/null)
[ -n "$DCTX" ] && echo "→ DS context cache HIT ($TARGET_DS/$TOKENS_SHA)" || echo "→ DS context cache MISS — read the CSS once, then write the pack (see edit.md §1.5 recipe)"
```

On a hit, hand the cached `classNames` / `tokenNames` / `libExports` to `frontend-design` and the DS-conformance critics directly. On a miss, `Read` the files once, then `printf '%s' "$PACK_JSON" | maude cache put design-context "$TARGET_DS/$TOKENS_SHA"` (identical pack shape to edit.md) so the next `/design:new` or `/design:edit` against this unchanged DS hits.

### 2. Server lifecycle check + runtime-bundle health probe

```bash
PORT=$(maude design server-up --root "$REPO_ROOT")

# Parse-clean ≠ run-clean. Probe each /_canvas-runtime/*.js URL the canvas-lib
# pulls in (motion, motion/react, react, react-dom, react/jsx-runtime, …) and
# compare body size to the on-disk pre-built bundle. A stale dev-server process
# can cache a broken dynamic Bun.build (e.g. 409-line motion_react.js with a
# hoisting bug → "ReferenceError: AcceleratedAnimation is not defined" at
# iframe boot). Restart on detected defect.
maude design runtime-health \
  --port "$PORT" \
  --root "$REPO_ROOT" \
  --restart \
  --quiet \
  || { echo "✗ runtime bundles defective even after restart — abort /design:new (see stderr)"; exit 1; }
```

`server-up.sh` detekuje běžící server (PID + `curl /_health`), startuje znovu pokud stale, poll-uje 10 s. Stdout = port; diagnostic na stderr.

`runtime-health.sh` HEAD-probes každý `/_canvas-runtime/<slug>.js` URL a porovná velikost s on-disk pre-built v `<plugin>/dev-server/dist/runtime/`. Ratio < 0.5 = defective dynamic build → `--restart` auto-kill + respawn + jediné re-probe; pokud i restart selže, helper exit 3 a `/design:new` abortuje (canvas by se mountoval s broken runtime). Vyřešeno per system-review 2026-05-27 (D-1): parse-clean nestačí, runtime bundle musí být run-clean ještě před generation step.

### 3. Validate name + resolve target path

- Default canvas: `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.tsx` (TSX canvas served by the dev-server's two-pass pipeline + Bun.build runtime). The canvas mounts via `_canvas-shell.html`; React 19 + ReactDOM ride in shared `/_canvas-runtime/*.js` bundles. Envelope primitives (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`) come from `@maude/canvas-lib` — the dev-server resolves that virtual specifier to its bundled canvas-lib at `plugins/design/dev-server/canvas-lib.tsx` (per DDR-025; ships with the dev-server install).
- `--component`: `<DESIGN_ROOT>/<NEW_COMPONENT_DIR>/<PascalName>.tsx`
- Reject pokud target file existuje (suggest `<Name> v2`).

**TSX is the only canvas format.** Legacy `.html` canvases have been migrated; the html-to-jsx codemod was removed alongside the migration. New canvases are authored as TSX from `canvas.tsx.template`.

### 3.6. Short-circuit on identical brief (Phase C / DDR-061)

Before the expensive UX research (step 4.5) + generation (step 6), check whether a previous `/design:new` already produced a canvas from a **byte-identical brief in this same DS**. Each canvas's `.meta.json` carries a `brief_sha` (stamped at step 11); scan the canvas dir for a match.

```bash
BRIEF_SHA8=$(printf '%s' "$BRIEF" | shasum -a 256 | cut -c1-8)   # reused by step 4.5's research cache key
EXISTING_MATCH=""; EXISTING_TS=""
while IFS= read -r m; do
  [ -f "$m" ] || continue
  MSHA=$(jq -r '.brief_sha // empty'      "$m" 2>/dev/null)
  MDS=$(jq  -r '.designSystem // "project"' "$m" 2>/dev/null)
  if [ "$MSHA" = "$BRIEF_SHA8" ] && [ "$MDS" = "$TARGET_DS" ]; then
    EXISTING_MATCH="${m%.meta.json}.tsx"
    EXISTING_TS=$(jq -r '.last_modified // .created // "unknown"' "$m" 2>/dev/null)
    break
  fi
done < <(find "$DESIGN_ROOT/$NEW_CANVAS_DIR" -maxdepth 2 -name '*.meta.json' 2>/dev/null)
```

**If `$EXISTING_MATCH` is set:** surface a one-shot AskUserQuestion:

```
Same brief already produced a canvas in this DS:
  <EXISTING_MATCH> (created <EXISTING_TS>)
Pick:
  (a) Open the existing canvas — don't regenerate. (default)
  (b) Re-run anyway — generate a fresh canvas. Step 3's existing-file guard
      forces a distinct name, so the prior file is preserved.
```

On **(a)** → print the existing path, tell the user to click it in the browser file tree to make it active, and **exit without generating**. On **(b)** → continue to step 4 (the new canvas gets a distinct name; the prior is untouched).

**Auto Mode (AskUserQuestion denied):** default to **(b) re-run** — a `/design:new` invocation should produce a canvas (silently producing nothing surprises the user), and the cost is already bounded by the `--quick`/`--no-critic`/budget guards. Stamp `Identical-brief match found (<EXISTING_MATCH>); re-ran per Auto Mode default` in the final print so the collision is visible.

### 4. Resolve mobile/desktop + opt-out scope

`--mobile` flag, nebo název obsahuje `Mobile` / `iOS` / `Android`.

**Opt-out scope resolution** (see SKILL.md "Opt-out scope" for the canonical spec):

```bash
# 1. Explicit flag wins.
SCOPE=$(grep -oE -- '--opt-out=(palette|aesthetic|full)' <<< "$ARGS" | cut -d= -f2)

# 2. Plain-language inference (only if no explicit flag).
if [ -z "$SCOPE" ]; then
  if grep -qiE 'opt[ -]out|off[ -]system|sandbox|custom palette|different brand|fully off|advisory only' <<< "$BRIEF"; then
    INFERRED=$(grep -qiE 'fully off|advisory only|different brand' <<< "$BRIEF" && echo "full" \
            || grep -qiE 'modern (color|scheme|aesthetic)|vibrant|playful|exploration|experimental|consumer-app' <<< "$BRIEF" && echo "aesthetic" \
            || echo "palette")
    # Surface AskUserQuestion before continuing — propose INFERRED, options a/b/c, default a.
    SCOPE=<user_choice_or_palette_in_auto_mode>
  else
    # 3. DS-default from config.aestheticAmbition (DDR-073). The DS's inferred ambition sets the
    #    default scope, so an expressive/maximalist DS doesn't need --opt-out on every canvas.
    #    Legacy/missing field → "restrained" → palette = old behavior (zero regression).
    AMB=$(jq -r '.aestheticAmbition // "restrained"' "${DESIGN_ROOT:-.design}/config.json" 2>/dev/null)
    case "$AMB" in
      maximalist) SCOPE="full" ;;
      expressive) SCOPE="aesthetic" ;;
      *)          SCOPE="palette" ;;   # restrained | confident | legacy/missing
    esac
  fi
fi
```

**Explicit `--opt-out` and plain-language signals still win** (steps 1–2 precede the DS default). A11y is enforced at every scope regardless. The DS default just means "born expressive ⇒ canvases default to `aesthetic`" instead of the universal hardcoded `palette`.

The resolved `SCOPE` is persisted on the canvas's `.meta.json` `opt_out_scope` field (step 11) and passed to every critic in the auto-fix loop (step 10).

### 4.5. UX patterns research (cache-first)

> **Why this step exists.** Without domain-aware UX research, `frontend-design` invents the IA from scratch for every canvas — leading to generic shapes (5-tab nav, dashboard-card grid, modal-overlay flows) regardless of whether the brief is a recipe app, a sports tracker, or a scientific tool. The `ux-research-agent` (mode `ux-patterns`) builds a domain-aware behavioral pool — typical IA, screen anatomy, common flows, interaction patterns, current UX trends — and `frontend-design` consumes it as part of its reference bundle. **Visual identity is NOT in scope here — the DS owns that, /design:new always uses the finished DS.** The research is purely about **good UX patterns** for the domain.

**Cache key:** `<DESIGN_ROOT>/_history/_system/<TARGET_DS>-<BRIEF_SHA8>-domain-research-ux-patterns.json`. The cache includes the brief hash — two canvases in the same DS with different briefs get separate cache files. The match is exact (hash, not fuzzy semantic similarity); rewording a brief produces a fresh cache key.

```bash
BRIEF_SHA8=$(printf '%s' "$BRIEF" | shasum -a 256 | cut -c1-8)
PAYLOAD="$DESIGN_ROOT/_history/_system/$TARGET_DS-$BRIEF_SHA8-domain-research-ux-patterns.json"

if [[ -f "$PAYLOAD" ]]; then
  echo "→ UX patterns cache hit (brief-hash match: $BRIEF_SHA8) — reusing $PAYLOAD"
else
  echo "→ No cache for brief-hash $BRIEF_SHA8 — running fresh research"
fi
```

**Spawn the agent (only when needed):**

```
Agent(
  description: "UX patterns research for <Name>",
  subagent_type: "design:ux-research-agent",
  prompt: <<EOF
brief:          "<verbatim user brief>"
caller:         "new-canvas"
mode:           "ux-patterns"
context_paths:
  existing_ds_tokens:  "<abs path to DS_TOKENS>"
  existing_ds_readme:  "<abs path to system/<TARGET_DS>/README.md>"
  cached_payload:      "<abs path to PAYLOAD if exists, else empty>"
output_path:    "<abs path to PAYLOAD>"
researched_at:  "<current ISO date>"
EOF
)
```

Wall time ~30–60s when fresh; ~0s on cache hit (the agent reads the cache, validates, returns immediately).

**Read the payload back** with the `Read` tool into your context. It will be passed to `frontend-design` in step 6 as part of the reference bundle alongside the envelope.

**Failure handling:**
- Agent fails entirely (no payload written) → **do not block scaffold**. Surface a warning in the final print (`UX patterns research failed — frontend-design generation proceeded without domain pool; quality may regress to generic-template default`) and continue with envelope-only generation.
- Payload reports `fallback_used: true` → continue normally but surface in final print (`UX patterns research fell back to LLM-knowledge mode — review canvas IA carefully`).
- `/design:edit` does NOT run this step. Edit stays rýchlý — research is on-demand only via `--research` flag (future, not currently shipped).

### 4.6. Artboard-count + scope pre-question (when count is ambiguous from brief)

**Fires when:** the brief doesn't explicitly name an artboard count (no "3 artboardy", "5-screen flow", "single canvas with 2 artboards" phrasing). Goal: surface the **render-budget cost** of large canvases BEFORE generation, so users opting for 8+ artboards know the pan/zoom perf wall they'll hit on trackpad-driven zoom.

System-review 2026-05-27 (D-3) flagged that a previous run offered "8 (recommended)" without surfacing perf cost — user picked 8 and reported "pan/zoom strašně seká" once the canvas mounted. The "recommended" tag pushed the choice without surfacing the trade-off. Render-budget heuristic: **≥ 8 artboards on a `--perfect`-shaped canvas with non-trivial CSS hits the canvas-lib pan/zoom perf wall** (~ 2000+ DOM nodes inside a transformable root).

Surface a one-shot `AskUserQuestion` (skip when `--no-critic` or `--quick` — those modes user opted-out of `--perfect`'s default density):

```
Brief implies a multi-screen canvas but doesn't fix the artboard count. Pick:
  (a) 4–5 artboards — snappy pan/zoom; covers the brief's headline flows.
  (b) 6–7 artboards — balanced; pan/zoom feels normal on trackpad. (default)
  (c) 8+ artboards — comprehensive coverage; expect pan/zoom to stutter on
      trackpad-based zoom (canvas-lib transform-root hits perf wall around
      ~2000 DOM nodes). Use when the brief explicitly demands breadth.
```

**Do NOT mark any option "recommended" without naming the trade-off in the same label.** The label IS the trade-off; the "recommended" tag is for cost-neutral defaults. Render budget is not cost-neutral.

**Auto Mode (AskUserQuestion denied):** default to (b) 6–7 artboards (median safe density). Stamp the auto-pick in the final print: `Artboard density: 6–7 (Auto Mode default; brief did not name a count)`.

**Brief explicitly names a count:** skip this question, use the brief's count verbatim. Even when the count crosses the 8-threshold (user explicitly opted in), still flag the perf cost in the final print so the connection between "I asked for 10" and "now my zoom stutters" is documented: `Artboard density: 10 (per brief) — pan/zoom may stutter on trackpad; consider /design:edit "reduce to N artboards" if interaction feels heavy.`

### 5. Build envelope

**Discipline:** envelope je *creative brief*, ne *wireframe spec*. Viz `skills/design/SKILL.md` → "Envelope discipline". Stručně: vibe + 1–2 reference canvases + aspiration directives 9–14 verbatim + brief. **Ne** dictate elements, button counts, copy, paddings.

**Motion vocabulary (Phase 3.7 / DDR-049).** When the brief asks for or implies motion (`animate`, `transition`, `motion`, `play`, `loop`, `slide`, `fade`, drag/drop UX, route transitions, presence cursors, scroll-linked effects), the envelope **MUST** use the canvas-lib motion vocabulary — `<MotionDemo role>` / `<MotionTrack>` / `<TokenPlayback>` / `<ReducedMotionToggle>` / `useMotionTokens` from `@maude/canvas-lib` — not hand-rolled `@keyframes`. The pure-CSS `.motion-*` escape hatch is opt-in for justified zero-JS surfaces only. **The full, authoritative rule (default / escape hatch / never) lives in `skills/design-system/SKILL.md` → "Animation tooling contract" — this is a pointer.** The 8 roles (flip / panel / route / soft / spring / scroll / drag / presence) are the canonical vocabulary; `design-system-keeper` warns on reinventions ≥3× per canvas (promotes to blocker). The motion library (`motion/react`) is automatically declared in `/design:handoff`'s registry-item.json, so the canvas drops into a Next.js + shadcn project with animations working — no manual `npm i motion`.

Adaptuj generic envelope ze SKILL.md "Generation envelope" s konkrétními config hodnotami z kroku 1. **Aspiration directives 9–14 musí být v envelope verbatim** — to je co drive signature-moment-critic axes (signature moment, brand prominence, mock fidelity, restraint, negative space, specificity).

**Append UX pattern reference bundle** (from step 4.5 payload): include in the envelope a `## UX patterns reference` section listing payload `information_architecture_patterns[0].label` (the Recommended IA pattern), `typical_screen_anatomy.regions[]` as a region checklist, `common_flows[].id` as flow names the canvas might depict, `interaction_patterns[].label` as patterns to honor, and `anti_patterns[].pattern` as patterns to avoid. These are **reference**, not prescription — `frontend-design` interprets, doesn't dictate. If step 4.5 failed and no payload exists, skip this section and note in the envelope's footer (`UX pattern research unavailable — generation proceeds on DS + brief alone`).

**Test envelope kvality před spuštěním generation:**
- Reads jako brief seniornímu IC? ✓
- Reads jako wireframe spec se seznamem prvků? ✗ — zkrátit
- Délka ~30–50 řádků? ✓ (~100+ = over-prescriptive)
- Aspiration directives přítomny? ✓ povinné
- Reference 1–2 existing canvases? ✓ povinné
- `## Pattern priors` section populated (or explicitly empty for first-canvas case)? ✓ povinné

#### 5a. Collect pattern priors (for the envelope's `## Pattern priors` section)

```bash
# Existing canvases in this DS — same dir as the target, .meta.json.designSystem matches.
PRIORS_DIR="$DESIGN_ROOT/$NEW_CANVAS_DIR"
PRIOR_CANVASES=$(find "$PRIORS_DIR" -maxdepth 2 -name "*.tsx" -not -name "$(basename "$TARGET_PATH")")

PRIORS_LIST=""
for c in $PRIOR_CANVASES; do
  STEM="$(basename "$c")"
  STEM="${STEM%.*}"
  META="$(dirname "$c")/${STEM}.meta.json"
  # Filter to canvases in the same DS (multi-DS aware). Single-DS layouts have no
  # designSystem field on the meta — accept those too (treat as same DS).
  CANVAS_DS=$(jq -r '.designSystem // "project"' "$META" 2>/dev/null || echo "project")
  [[ "$CANVAS_DS" != "$TARGET_DS" ]] && continue

  # Class roots — both className="..." (JSX) and class="..." (HTML).
  CLASSES=$(grep -oE '(className|class)="[^"]+"' "$c" \
              | sed -E 's/^(className|class)="//; s/"$//' \
              | tr ' ' '\n' \
              | grep -E '^[a-z][a-z0-9-]+$' \
              | sort -u | tr '\n' ',' | sed 's/,$//')
  SUB=$(jq -r '.subtitle // ""' "$META" 2>/dev/null || echo "")
  PRIORS_LIST+="- $c ($SUB) — class roots: $CLASSES"$'\n'
done

# Preview components — DS-supplied component library (TSX specimens).
PRIOR_PREVIEW=$(ls "$DS_ROOT/preview/components-"*.tsx 2>/dev/null)
PREVIEW_LIST=""
for p in $PRIOR_PREVIEW; do
  # Pull subtitle from .meta.json sidecar (cheap, no AST parse).
  META="${p%.tsx}.meta.json"
  ROLE=$(jq -r '.subtitle // .title // ""' "$META" 2>/dev/null || echo "")
  [ -z "$ROLE" ] && ROLE=$(basename "$p" .tsx | sed 's/components-//; s/-/ /g')
  PREVIEW_LIST+="- $(basename "$p") — $ROLE"$'\n'
done
```

The `PRIORS_LIST` and `PREVIEW_LIST` strings are interpolated verbatim into the envelope's `## Pattern priors` section (step 5b heredoc). If both are empty, write a one-line note ("First canvas in this DS — no priors to lift from.") and continue.

#### 5b. Persist envelope as audit artifact

**Always write the envelope to `<DESIGN_ROOT>/_history/<slug>/000-envelope.md` before invoking generation** — regardless of which path (Skill vs orchestrator-direct) ultimately produces the canvas. This makes the brief auditable for future retros and lets the user see what creative directive actually drove the output.

```bash
mkdir -p "$DESIGN_ROOT/_history/$SLUG"
cat > "$DESIGN_ROOT/_history/$SLUG/000-envelope.md" << EOF
# Envelope — <Name>

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Generation path: {to be filled in step 6}

## Brief
<verbatim user brief>

## Aspiration directives (verbatim from SKILL.md 9–14)
<directives 9–14>

## Reference canvases
- <ref 1>
- <ref 2>

## Pattern priors — existing canvases to study before inventing

For any compositional element (card, panel, snippet, toolbar, sidebar, modal, button, badge), FIRST check if any prior listed below has the same shape. If yes, **lift it** — same class names, same paddings, same border treatment. Reinventing is the exception, not the default — leave a one-line JSX comment in the new canvas explaining what your variant does that the prior didn't.

The `design-system-keeper` agent (step 9.5) audits compliance with this directive after generation. Surfaced reinventions feed into the critic panel as additional context.

### Existing canvases (same DS, with class roots)
<for each .tsx in <DESIGN_ROOT>/<NEW_CANVAS_DIR>/ matching this DS, NOT the new canvas — see step 5 collection recipe>
- <path> (<.meta.json.subtitle>) — class roots: <comma-separated list extracted via the recipe>

### Existing preview components (DS library, with role)
<for each .tsx in <DS_ROOT>/preview/components-*.tsx — see step 5 collection recipe>
- <filename> — <one-line role from the .meta.json subtitle>

(If neither list has entries, this is the first canvas in this DS — Pattern priors is empty; the generator works from the DS readme + UX research alone.)

## UX patterns reference (from ux-research-agent step 4.5)
- IA pattern (Recommended): <payload.information_architecture_patterns[recommended].label>
- Typical screen anatomy regions: <payload.typical_screen_anatomy.regions[].id, csv>
- Common flows the canvas might depict: <payload.common_flows[].id, csv>
- Interaction patterns to honor: <payload.interaction_patterns[].label, csv>
- Anti-patterns to avoid: <payload.anti_patterns[].pattern, csv>
- Reference products (for IA / behavior, NOT visual): <payload.reference_products[].name, csv>
- [if step 4.5 skipped/failed: "UX pattern research unavailable — generation proceeds on DS + brief alone."]

## Constraints
- rootClass: <ROOT_CLASS>
- tokens: <TOKENS_REL>
- platform: <mobile | desktop>
- opt_out_scope: <palette | aesthetic | full>   ← from step 4, propagated into the generation prompt so the generator knows how much DS latitude it has
- ux_research_payload: <abs path or empty>      ← from step 4.5, passed to frontend-design as a reference bundle

## Opt-out interpretation (only when scope > palette)
- aesthetic: gradients, off-ladder radii, alt type pairings, decorative SVG/emoji are PERMITTED inside the canvas-local namespace. Tokens link + rootClass envelope still required.
- full:      DS is advisory; type/radii/aesthetic up to the canvas. Envelope still required.
- A11y is independent — keep WCAG AA compliance regardless of scope.
EOF
```

After step 6, append the chosen generation path (Skill vs orchestrator-direct) to the file's "Generation path:" line.

**Why mandatory:** scooter retro (2026-05-09) flagged that without an envelope artifact, future retros can't see what brief drove generation — the orchestrator's mental model of the brief disappears with the conversation. The envelope being on disk also surfaces over-prescriptive briefs (wireframe-spec smell) for review independent of the canvas itself.

### 6. Generate — preferred + fallback

Try in order, document which path se použije:

1. **Preferred:** `Skill(skill: "frontend-design:frontend-design", args: <envelope>)` — creative-design specialist. **Always attempt this first** — even when you predict "same model executes, won't help". Predicting the outcome before observing is the violation; trying and falling back transparently is the contract. See SKILL.md "Why call the Skill even when the executing model is the same".
2. **Fallback:** Pokud Skill nedostupný / errors out (typicky "Skill type not found" nebo "Agent type 'frontend-design:frontend-design' not found"), generuj přímo přes Read + Write s envelope jako prompt. **Mark report jako "orchestrator-direct fallback (quality may be 1 generation lower)"**.
3. **Never silently fall back.** Final print MUSÍ obsahovat řádek `Generation: <path>` se kterou cestou se generovalo. After generation, update `<DESIGN_ROOT>/_history/<slug>/000-envelope.md` "Generation path:" line with the actual path taken.

Viz SKILL.md "Cross-skill calls → Generation invocation".

### 7. Validate output

TSX canvas (the only format):

- Default-exported React component (`export default function <Name>() { … }` — kebab-PascalCase ok; the module must have exactly one default export).
- Standard `import` statements for `react` (when hooks are used), framework primitives, and any sibling components. **No** `<!doctype>`, no `<html>` / `<body>` — those live in `_canvas-shell.html`.
- Imports envelope primitives from `@maude/canvas-lib`: `import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib"`. The dev-server resolves that virtual specifier to its bundled canvas-lib at `plugins/design/dev-server/canvas-lib.tsx` (single source, ships with the dev-server install per DDR-025). `/design:handoff` AST-inlines the used exports on emit so the registry-item drop is self-contained.
- Contains at least one `<DCArtboard …>` (canvas-multi-artboard pattern).
- Class strings reference the project DS `_components.css` classes (`.btn`, `.tile`, `.sku`, `.seg`, …). Inline `style={{}}` is the escape hatch for arbitrary one-offs — gradients / radii honor the opt-out scope.
- No hardcoded colors / fonts / radii in `style={{}}` — use `var(--*)` tokens or DS classes.
- **Theme model (two isolated layers — system-review D9).** The canvas-shell **chrome** (workspace plane, floating toolbar, minimap, zoom HUD, halos) auto-follows the Maude dev-server theme via `data-maude-theme` on the iframe `<html>` — the dev-server owns it; **never** theme the chrome from canvas code, and never read/`--maude-chrome-*` from the artboard. **Artboards** keep their DS theme: the `data-theme="<THEME_DEFAULT>"` on the `rootClass` wrapper pins this artboard to a DS theme block — leave it at the DS default. Do **NOT** hardcode a non-default `data-theme` on artboards unless the canvas is intentionally single-theme — a reviewer flips an individual artboard at runtime via right-click → **Theme ▸ DS default / Light / Dark / Follow chrome** (Light/Dark enabled only when the DS ships both light + dark token blocks). Toggling the chrome theme re-themes the canvas chrome in every open canvas; artboards are unaffected.
- Parses cleanly via `oxc-parser` (the dev-server's canvas-pipeline runs this every request — a parse failure surfaces as HTTP 500 with the error byte). Pre-flight: `bun -e 'import { parseSync } from "oxc-parser"; const s = await Bun.file("<target>").text(); const r = parseSync("<target>", s); process.exit(r.errors?.length ? 1 : 0);'`.

### 8. Write target file

Pokud validation fails, do not write. Re-prompt jednou s konkrétním fix-list. Pokud znovu fail, stop.

**TSX canvases** are written from `plugins/design/templates/canvas.tsx.template` — the JSDoc header is generated from `.meta.json` (auto-emitted by `canvas-header.ts` on `/design:edit`); the JSX body is the frontend-design output. The `_canvas-shell.html` harness lives in the plugin distribution and is served at `/_canvas-shell.html`; **no copy lands in `<DESIGN_ROOT>/`** (server is the single source of truth — avoids a stale per-project copy drifting from the plugin).

### 9. Post-write reality check — per-artboard screenshots

**Always fires, regardless of `--no-critic`.** Reality check, ne quality check. Capture přes agent-browser na server URL (ne `file://`). **Per-artboard screenshot is a BLOCKER condition for `/design:new`, ne footnote** — system-review 2026-05-27 (D-2) flagged that single-PNG fallbacks > 5 MB silently bypass visual verification, and per-screen failures used to be logged as `⚠` and continued. New contract: per-screen succeeds, OR the loop halts and surfaces an AskUserQuestion.

**Per-artboard element screenshots are the default for `/design:new`** because new canvases are typically multi-artboard (3–8) and DesignCanvas's pan/zoom viewport means a single full-page snapshot misses everything outside the visible viewport. The canonical screenshot helper handles navigation, mount-poll, per-screen loop, and the agent-browser CLI gotchas in one call:

**Background overlap (Phase C / DDR-061).** Fire the per-artboard capture with `run_in_background: true` and spend the wait window on critic-prompt prep — capturing screenshots and *building* the critic spawn prompts have no data dependency. Concretely:

1. Launch the `screenshot.sh --all-screens` call below as a **background Bash call** (`run_in_background: true`). Do not block on it.
2. While it runs, do the prep that step 9.5 + step 10 would otherwise do *after* the capture: collect the ds-keeper `EXISTING_JSON`, resolve each critic's inline DS context (`root_class` / `tokens_path` / `components_css` / `ds_root` — already cached from step 1.5), read `<Name>.meta.json`, and draft each per-critic spawn prompt. Hold the batch ready.
3. When the background screenshot job completes you are notified — **do not poll or sleep**. Then `Read` the PNGs for the reality check, run the step-9 FAIL/partial handling, and spawn the prepped critic batch (step 10), which consumes those screenshot paths.

This hides the ~3–5 s capture inside the prompt-prep window (validation target 3: scaffold→critic-spawn within ~200 ms of prep-alone time). The step-9 BLOCKER contract is unchanged — it just evaluates after the job completes, not inline. **If `run_in_background` is unavailable** (restrictive sandbox / permission mode), fall back to the synchronous capture below — identical recipe, it just blocks — and do the prep afterward.

```bash
HIST="$DESIGN_ROOT/_history/$SLUG"
mkdir -p "$HIST"

# First pass — preferred engine.
maude design screenshot \
  --all-screens \
  --out-dir "$HIST" \
  --timeout 10
PER_SCREEN_EXIT=$?

# Second pass — playwright fallback (only when first pass failed).
if [ "$PER_SCREEN_EXIT" -ne 0 ]; then
  echo "→ agent-browser per-screen failed; retrying with playwright engine" >&2
  maude design screenshot \
    --all-screens \
    --engine playwright \
    --out-dir "$HIST" \
    --timeout 15
  PER_SCREEN_EXIT=$?
fi
```

The helper:

- Resolves URL from `_server.json` + `_active.json` (no manual port/URL math).
- Polls for `[data-dc-screen]`/`[data-dc-slot]` mount up to `--timeout`s (Babel/React canvases need 2–4 s).
- Scrolls each artboard into view (defeats `DesignCanvas` pan/zoom lazy-mount) and captures `<HIST>/<NNN>-screen-<id>.png`.
- Picks engine `agent-browser` > `playwright` fallback automatically when `--engine auto`; explicit `--engine playwright` forces the second-pass shim.
- Stdout = written paths (one per line); diagnostic + engine choice in stderr.

**Why per-artboard wins for canvases (retro 2026-05-09).** During the iOS Bikeshare Signup session, full-page snapshots showed only 1 of 6 artboards because DesignCanvas pans/zooms its world independently of document scroll. `[data-dc-screen]` element screenshots captured all 6 cleanly. See SKILL.md "Post-write reality check" for the full explanation.

**Per-screen FAIL handling — both engines exhausted (`PER_SCREEN_EXIT ≠ 0`):**

Do NOT silently fall back to a single full-page PNG. The full-page fallback produces 30–60 MB images for multi-artboard canvases — too large for the orchestrator to Read into context, so "verification" becomes a path string the agent never inspected. System-review 2026-05-27 (D-2) flagged this as the root of "mobile artboards reported missing even though authored". Instead, surface a one-shot AskUserQuestion:

```
Per-artboard screenshot failed on both agent-browser and playwright engines.
The canvas TSX wrote cleanly; this is a visual-verification gap, not a render
failure. Pick:
  (a) Retry once — sometimes a fresh /_health + mount poll succeeds. (default)
  (b) Launch agent-browser interactively — I'll open the URL and you tell me
      what you see; I'll continue based on your readout.
  (c) Accept the gap as known-unverified — proceed to the critic panel
      WITHOUT a baseline screenshot. The print step will flag this loud.
  (d) Abort /design:new — don't continue without visual confirmation.
```

Auto Mode (AskUserQuestion denied) → default to (c) but **the final print MUST stamp `⚠ visual verification SKIPPED — per-artboard capture failed on both engines; canvas IA was not visually confirmed`** so the user sees the gap before they discover it via "kde jsou mobile screens?". The critic panel runs WITHOUT a baseline screenshot path; signature-moment-critic and design-critic both flag absent baseline as a warning.

**Per-screen partial fail (some IDs captured, some failed):** Helper returns the captured paths on stdout and exit 3. Treat this as success-with-gap — record which artboard IDs failed in the print + chat.md iter-0 row; do NOT auto-retry the failed IDs (signal that those artboards have render issues worth investigating manually).

**Pokud blank render / timeout on ALL artboards** → warn `⚠ canvas rendered blank — likely JSX error`. Don't auto-rollback (user can open browser + see console). Path tohoto screenshotu (or the absent-baseline marker) jde do final print + chat.md iteration 0 row.

**No `--full` shortcut for ≤ 3 artboards.** The single-PNG path was removed per system-review D-2 — even 1 artboard at 1200×760 with a full page panable canvas can produce a misleading PNG (offscreen content cropped, transform state ambiguous). The per-screen path is mandatory; if it fails, the AskUserQuestion above is the only escape hatch.

Detaily a failure handling: SKILL.md "Post-write reality check".

### 9.5. Design-system keeper precheck

**Auto-routed by default** — between the post-write reality-check screenshots (step 9) and the critic panel (step 10). Skip with `--skip-ds-keeper` if the user has explicitly opted out (rare — primarily known-experimental canvases or debug runs).

The `design-system-keeper` agent runs two read-only passes — pattern-reinvention scan + token-usage audit — over the just-generated canvas. Findings are warnings (not blockers) by default; the agent self-promotes to blocker only when ≥ 5 token mismatches OR ≥ 3 pattern reinventions stack on this canvas (mass-drift signals). Findings feed into the critic panel as additional context — the panel's own critics can promote to their own blockers if the surrounding context warrants.

**Spawn in parallel with step 10** — the panel doesn't wait on ds-keeper to start; both run concurrently, the orchestrator merges verdicts at the end of the iteration. This keeps the wall-clock cost of the precheck near-zero relative to the panel.

```bash
# Skip if --skip-ds-keeper flag was passed.
if grep -q -- '--skip-ds-keeper' <<< "$ARGS"; then
  echo "→ ds-keeper precheck skipped per --skip-ds-keeper flag"
else
  HIST="$DESIGN_ROOT/_history/$SLUG"
  N_KEEPER=$(printf "%03d" $(($(ls "$HIST" 2>/dev/null | wc -l) + 1)))
  KEEPER_OUT="$HIST/$N_KEEPER-ds-keeper.md"

  # Collect existing canvases in the same DS (excludes the new canvas).
  EXISTING_JSON=$(find "$DESIGN_ROOT/$NEW_CANVAS_DIR" -maxdepth 2 -name "*.tsx" \
                    -not -path "*$TARGET_PATH*" \
                    | jq -R . | jq -sc .)
fi
```

```
# Spawn ds-keeper in parallel with the critic panel (step 10) — single message, multiple Agent calls.
Agent(
  description: "DS keeper precheck for <Name>",
  subagent_type: "design:design-system-keeper",
  prompt: <<EOF
canvas_path:             "<abs path to TARGET_PATH>"
ds_root:                 "<abs path to DS_ROOT>"
existing_canvases:       <EXISTING_JSON>
preview_components_root: "<abs path to DS_ROOT/preview>"
token_guide_path:        "<abs path to DS_ROOT/README.md>"
output_path:             "<abs path to KEEPER_OUT>"
iter_n:                  1
EOF
)
```

The agent writes its report to `<HIST>/<NNN>-ds-keeper.md` and returns a JSON verdict. The orchestrator merges the verdict's `top_warnings` into the iter-1 critic-panel summary so the user sees one consolidated view.

**If ds-keeper self-promoted to blocker** (≥ 5 token mismatches OR ≥ 3 pattern reinventions stacked) → the orchestrator surfaces this in the iter-1 print as `ds-keeper: BLOCKER (mass drift detected — see <KEEPER_OUT>)` and the auto-fix loop's first iteration prioritizes ds-keeper findings before any other critic's blockers. This catches mass-drift early — before the panel chases symptom-level fixes.

**Failure handling:**
- Agent fails entirely (no report written) → **do not block the panel**. Surface a warning in the final print (`ds-keeper precheck failed — DS-fidelity audit unavailable for this iteration`) and let the panel proceed.
- Report written but verdict JSON malformed → treat as no findings, surface report path in the final print so the user can read it manually.

### 9.6. Custom-art routing → `draw-agent` (conditional)

**Fires when the generated canvas contains a genuine custom vector mark** — a brand logo / wordmark lockup, a hero illustration, a custom icon family, or a node-link diagram that `frontend-design` hand-wrote as raw `<svg>` path data. LLM-free-handed `<path d>` is exactly the drift-prone output the geometry engine exists to replace, so route those marks to `draw-agent` to rebuild them deterministically + verify them on the favicon / flatten / WCAG ladder.

**Detection (gate — only genuine custom marks):**
```bash
# A hand-written mark, not a token-driven UI shape or a stock icon-set glyph.
HAS_CUSTOM_MARK=$(grep -cE "<svg [^>]*viewBox[^>]*>[^<]*<(path|polygon|polyline)" "$TARGET_PATH")
# Brief intent — did the user actually ask for a logo / illustration / diagram?
WANTS_MARK=$(grep -iqE "logo|wordmark|brand mark|illustration|hero (art|graphic)|diagram|custom icon" <<< "$BRIEF" && echo 1 || echo 0)
```

**Skip** when neither fires, OR when the only SVG is a trivial inline icon already covered by the DS icon set (a single `<path>` 24-grid glyph used as button chrome) — re-drawing those via the engine is overhead, not value. Per the plan's gotcha: route for *genuine* marks only.

**When it fires**, for each custom mark, spawn `draw-agent` in **inline** mode targeting the just-generated canvas:
```
Agent(
  description: "draw <type> mark for <Name>",
  subagent_type: "design:draw-agent",
  prompt: <<EOF
brief:         "<the part of the brief describing this mark, verbatim>"
type:          "logo | illustration | diagram | icon"
grid:          <1 for logo/icon, 0 for illustration, 8 for diagram>
output_mode:   "inline"
into_canvas:   "<abs path to TARGET_PATH>"
selected:      <the hand-written <svg> block to replace, or null>
slug:          "<Name>-<mark>"
config:        <contents of .design/config.json>
designRoot:    "<abs designRoot>"
opt_out_scope: "<scope or empty>"
max_rounds:    3
candidates_n:  2
EOF
)
```
The agent replaces the hand-written `<svg>` with an engine-built, verified mark in place. Its verdict joins the iter-1 panel summary alongside ds-keeper. `draw-critic` (step 10 panel) then independently judges the result via the `HAS_CUSTOM_SVG` routing signal.

**Failure handling:** agent fails / can't converge → leave the hand-written mark, surface a warning in the final print (`custom-art routing failed — <mark> left as hand-written SVG; re-run /design:draw manually`), continue to the panel.

### 10. Auto-critic + auto-fix loop (default = `--perfect`)

**Same loop algorithm as `/design:edit`** — see SKILL.md "Auto-critic loop". Klíčový rozdíl: `/design:new` má **vyšší výchozí laťku** než `/design:edit "<feedback>"`, protože scaffold je high-leverage.

**Iter-1 checkpoint — fires only when `opt_out_scope ∈ {aesthetic, full}`.** Before spawning iter-1 critics (after the post-write reality-check screenshots), surface a one-shot AskUserQuestion:

```
Iter 1 ready (opt_out_scope = <scope>). Pick:
  (a) Run the auto-fix loop now — fixes a11y; downgrades DS blockers per scope. (default)
  (b) Show me iter 1, I'll send specific feedback (skip auto-loop this round).
  (c) A11y-only check — skip aspiration + DS, just verify accessibility.
```

This exists because the user signaled exploration — they should get to see iter-1 cheaply before the loop reshapes it. **For `opt_out_scope = palette` (default), do NOT fire this checkpoint** — the existing `--perfect` contract runs unconditionally. Auto Mode (AskUserQuestion denied) → default to (a) and proceed.

**Spawn the panel as one parallel batch.** All critics read the same hot-off-the-press canvas + baseline screenshots — there's no inter-critic dependency within an iteration. **In a single assistant message, spawn the selected panel using parallel Agent tool calls** (4 critics in the default panel; one batch, not four sequential spawns). The `design-system-keeper` from step 9.5 is spawned in this same message (already specified there). The orchestrator merges all verdicts at the end of the iteration.

**The iter-1 spawn prompts were already drafted during the step-9 background-screenshot window (Phase C / DDR-061)** — by the time the capture job completes you hold the prepped batch, so iter-1 critic spawn fires immediately after the reality check rather than starting prompt-prep cold.

**Pass `opt_out_scope` to every critic in the panel.** Each `Agent` invocation's prompt MUST include the scope verbatim alongside `canvas_path`, `screenshot_path`, etc. Each critic agent reads `opt_out_scope` and adjusts severity per its own spec — `design-critic` / `graphic-design-critic` / `typography-critic` / `signature-moment-critic` downgrade matching DS-rule blockers to warnings; `a11y-critic` / `frontend-critic` / `copy-critic` ignore the parameter (their blockers are universal).

**Pass the DS context inline too (B16 — avoid re-reads).** `/design:new` already resolved the design system in step 1. Hand each critic the resolved values in its spawn prompt — `root_class: <ROOT_CLASS>`, `tokens_path: <abs DS_TOKENS>`, `components_css: <abs DS_ROOT/preview/_components.css>`, `ds_root: <abs DS_ROOT>`, `ds_name: <TARGET_DS>`, `theme: <THEME>` — so the critics that need DS conformance context (`design-critic`, `graphic-design-critic`, `typography-critic`) don't each re-`Read` `.design/config.json` + the tokens CSS. Subagents inherit CLAUDE.md + MCP + skills but NOT this conversation, so the resolved DS context must travel in the prompt.

**Panel composition — bar by mode (minimum the orchestrator MUST spawn):**

| Mode | max_iter | aspiration_target | Minimum panel |
|---|---:|---:|---|
| **Default (= `--perfect`)** | **8** | **4.5 / 5** | `signature-moment-critic` + `design-critic` + `frontend-critic` + `a11y-critic` (if interactive) |
| `--perfect --all` | 8 | 4.5 / 5 | **every** critic in `${CLAUDE_PLUGIN_ROOT}/agents/` |
| `--perfect-iter N` | N | 4.5 / 5 | same minimum panel as default |
| `--quick` | 2 | 4.0 / 5 | `signature-moment-critic` only |
| `--no-critic` | 0 | n/a | (skip loop entirely) |

**Single-critic runs jsou valid pouze když `--quick` / `--no-critic` flag (user opt-out) nebo když `/design:critic --agent <name>` je explicitně user-invoked.** Uvnitř auto-loopu je single-critic shortcut **process violation**, regardless of justification:

- "I'll just run signature-moment to save tokens" → cost-based skip → violation
- "Would require multiple parallel Agent spawns" → complexity-based skip → violation
- "Same model executes anyway, critics won't help" → quality-prediction-based skip → violation
- "User said brief was a test, probably doesn't need critic" → assumed-intent-based skip → violation

**The default is the contract.** Spec doesn't list "skip if expensive / complex / unlikely to help" as exit conditions. If you predict the loop won't help, that's a spec change to propose, not an orchestrator decision to make mid-run. Pokud token budget je viditelně omezený (context > 60% full), surface a one-shot AskUserQuestion **před** start loopu — viz Failure modes → "--perfect cost when budget tight". Auto Mode (kde AskUserQuestion je denied) **neopravňuje skip** — Auto Mode authorizes autonomous decisions on **ambiguous** matters; spec defaults nejsou ambiguous.

**Stop conditions (per SKILL.md "Auto-critic loop"):**
- `SOLID` — correctness 0 blockers + aspiration ≥ target + specificity pass + stable for 1 iter
- `stable-but-bland` — correctness clean + aspiration plateau pod target → exit s diagnostic (lowest 2 axes named)
- `max-reached` — hit `max_iter` před SOLID nebo stable
- `divergent` — score regressed > tolerance → restore best snapshot, exit
- `validation-failed` — fix iteration porušil validation → restore, exit

Bootstrap a chat transcript: write `<DESIGN_ROOT>/_history/<slug>/chat.md` with the brief as iteration 0 (include screenshot path z kroku 9), then loop entries as iterations 1..N.

### 11. Bootstrap docs

For a new canvas:
1. Write `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json` from the brief (title, subtitle from one-line, brief, platform from --mobile flag, sections+artboards extracted from generated JSX, **`opt_out_scope` from step 4**, **`designSystem: $TARGET_DS` from step 1**, **`brief_sha: $BRIEF_SHA8` from step 3.6** — the byte-identical-brief key the step-3.6 short-circuit scans on the next run). Subsequent `/design:edit` iterations on this canvas read these fields and inherit the scope + DS automatically — no re-asking on every edit. In multi-DS projects, the `designSystem` field is what `flow:design-system-guard` and `design-system-completeness-critic` use to scope their checks to the right DS.
2. **If `<DESIGN_ROOT>/INDEX.md` doesn't exist** → invoke `/design:setup-docs --full` (regenerates both INDEX.md and README.md from all canvases). **Do NOT improvise a hand-written INDEX.md** — `/design:setup-docs` is the source of truth and the AUTO-MAINTAINED marker depends on it. Improvised INDEX gets overwritten on next `/design:setup-docs` run, and any rows added by hand are lost.
3. **Else** (INDEX.md exists) → add a row to `<DESIGN_ROOT>/INDEX.md` for the new canvas (or invoke `/design:setup-docs` without `--full` to do the incremental update for you).
4. If `<DESIGN_ROOT>/README.md` doesn't exist after step 2, generate it via `/design:setup-docs --full` flow.
5. Update `<DESIGN_ROOT>/README.md` "Last updated" line. **This step is non-skippable** — if you used `/design:setup-docs --full` in step 2, it's done; if you wrote the INDEX row by hand, you must update README too.

### 12. Print

```
✓ Created: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.tsx
  Pattern: multi-artboard canvas (DesignCanvas + N artboards)
  Sidecar: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json
  Generation: {frontend-design specialist | orchestrator-direct fallback}
  Baseline: <DESIGN_ROOT>/_history/<slug>/NNN-screen-<id>.png (per-artboard set) | (absent — see "Visual verification" below)
  Visual verification: { confirmed (N of N artboards captured) | partial (M of N — failed: <id-list>) | ⚠ SKIPPED — per-artboard capture failed on both agent-browser + playwright engines; canvas IA was NOT visually confirmed (user accepted gap) | aborted }

  Mode: {--perfect (default) | --perfect-iter N | --quick | --no-critic}
  Artboard density: {N (per brief) | N (chosen via AskUserQuestion) | N (Auto Mode default — brief did not name a count)} {if N ≥ 8: "— pan/zoom may stutter on trackpad; /design:edit \"reduce to M\" if heavy"}
  Opt-out scope: {palette (default) | aesthetic | full} {if inferred from brief: "(inferred from brief — user confirmed via AskUserQuestion)"}
  UX research: {cache hit — reusing <date> | fresh — <N>s wall-clock | fallback (LLM-knowledge) — review IA | unavailable — generation on DS + brief only}
  Critic panel ({default = signature-moment + design + frontend + a11y; --quick = signature-moment only;
                --perfect --all = full set; --no-critic = (none)}; scope-downgraded blockers tagged as warnings):
    correctness: {X} blockers · {Y} warnings
    aspiration: {n}/5 (signature {n}, brand {n}, fidelity {n}, restraint {n}, neg-space {n}) · specificity: {pass|fail}
    verdict: {solid | stable-but-bland | max-reached | divergent | validation-failed | skipped}
    iterations: {N} of {max_iter}
  {if user opted into --quick / --no-critic via flag or AskUserQuestion: "Critic mode: <flag> per user choice"}
  {iteration log for each iter — score delta, fixes applied}
  {if stable-but-bland: "Lowest axes: <list>. Targeted feedback would lift these."}
  {if Visual verification = SKIPPED: "⚠ Critic panel ran WITHOUT baseline screenshots — aspiration scoring is degraded. Mobile/desktop artboards exist in TSX but were not visually confirmed to render. Open <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.tsx in the browser to verify before iterating."}

  Docs: <designRoot>/INDEX.md added entry; <designRoot>/README.md updated.
  {if INDEX.md was missing and /design:setup-docs --full was invoked: "Docs: bootstrapped via /design:setup-docs --full"}

  Klikni na něj v browser file tree (autorefresh přes ↻ tree v UI), stane se aktivním.
  Iteruj přes /design:edit "<feedback>".
```

## Co `/design:new` NEDělá

- Nevytváří `.ai/design-sessions/` (koncept zrušen).
- Negeneruje "iteraci 001". Soubor je rovnou the canvas.
- Nepřepisuje existující soubor (ochrana proti omylem).
- Neotevírá soubor v browseru — user na něj klikne sám (auto-refresh tree přes `↻ tree` v UI).
- Neaktualizuje `_active.json` — stane se aktivním až user klikne v tree.
- **Negeneruje single-page HTML wrapper** — vždycky multi-artboard canvas.

## Failure modes

- **Target file already exists** → preferred: surface AskUserQuestion s 2–3 návrhy alternative name (mechanical `<Name> v2`, plus 1–2 brief-derived semantic alternatives — e.g. pokud existující je `iOS Signup Flow.tsx` a brief je o scootersharingu, navrhni `Scooter Signup Flow`). Pokud user vybere, použij; pokud zruší, abort.
- **Target file exists AND AskUserQuestion is denied** (Auto Mode / non-interactive context) → infer the most accurate alternative name from the brief — semantic, ne mechanical `v2`. Document the choice explicitly v final printu (`Filename: <chosen> (auto-picked from brief because <existing> existed)`). Auto Mode authorizes reasonable autonomous decisions; preserving existing files while creating a new one with brief-accurate name je reasonable. Mechanical `v2` suffix je acceptable fallback pokud brief nedává jasný semantic name.
- **`frontend-design` Skill nedostupný** → **NE fail** — fall back to orchestrator-direct generation (viz krok 6). Final print MUSÍ flagnout `Generation: orchestrator-direct fallback` + suggestion `/plugin install frontend-design@claude-plugins-official` pro lepší kvalitu příští spuštění.
- **Generated HTML porušuje validaci** (chybí tokens, hardcoded colors, single-page wrapper bez DCArtboard, …) → re-prompt jednou. Pokud zase rozbité, fail s detail.
- **Post-write screenshot fails / canvas renders blank** → warn `⚠ canvas rendered blank — likely JSX error` ale neabortuj. Soubor existuje, user ho může otevřít manually + zjistit error v console.
- **Screenshot reports success but file is missing** → použij canonical helper přes `maude design screenshot`. Helper detekuje silent-fail (PNG < 1 KB) a exit-codes 3. Inline `agent-browser screenshot …` voláním napřímo se vyhni — má CLI quirky kolem `--full` separátoru a `--output` které helper řeší za tebe.

### `--perfect` cost when budget tight

Default `/design:new` = `--perfect` (8 iter, target 4.5/5, routed panel). Honest cost:

- 8 iterací × min 4 critic agents (signature-moment + design + frontend + a11y) = **32+ subagent calls**
- Plus auto-fix iterations between critics = **~40+ subagent calls total**
- Estimated token cost: **150–300k tokens** (canvas-size dependent)
- Wall time: **5–15 min** v default model speed

**Orchestrator behavior:**

1. **Default — honor the contract.** Run the full loop. The user chose `/design:new` knowing the deal (default-on `--perfect` je dokumentovaný first-class behavior, ne hidden).

2. **If session token budget je viditelně omezený** (context > 60% full, user dříve v session flagol token concerns, nebo conversation has > ~150k tokens už spotřebovaných) → **before** starting loop, surface a one-shot AskUserQuestion:
   > "`/design:new` runs `--perfect` by default (~40 subagent calls, 150–300k tokens, 5–15 min). Tvůj context je už 65% full. Pick: (a) plný `--perfect` (default — drahé ale dotažené), (b) `--quick` (signature-moment only, ~2 iter, ~30k tokens), (c) `--no-critic` (jen generate + render check, ~5k tokens)."

3. **Never silently downgrade** — pokud chceš méně, **explicit flag**: `--quick` nebo `--no-critic`. Token-saving shortcut bez user opt-in / opt-in question = **process violation**. Stejný pattern jako `/flow:execute` Edit-Verify Loop — contract je contract.

4. **If user explicitly chose downgrade** (option b/c v question above, OR explicit `--quick` / `--no-critic` flag) → state it explicitly v final printu:
   > `Critic panel (--quick mode per user choice): signature-moment-critic only, max 2 iter`
- **Path obsahuje cestu mimo `<DESIGN_ROOT>`** → fail (security).
- **`.design/config.json` chybí** → varuj user "using defaults" a pokračuj s defaults z `dev-server/config.schema.json`.
- **Auto-critic loop hits `stable-but-bland`** (correctness clean, aspiration plateau pod target) → ne fail, surface canvas s diagnostic. User má dostat lowest 2 aspiration axes named, aby věděl kam směřovat targeted feedback.
