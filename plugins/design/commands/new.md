---
description: Vytvoř nový multi-artboard canvas projekt přes frontend-design — generic envelope adaptovaný podle .design/config.json. Default = --perfect (8 iter, full panel, target 4.5/5). Opt out přes --quick nebo --no-critic. Opt out z DS přes --opt-out=palette|aesthetic|full.
argument-hint: "<Name> \"<brief>\" [--component] [--mobile] [--quick | --no-critic] [--perfect-iter N] [--opt-out=palette|aesthetic|full]"
---

# /design:new — scaffold nový canvas projekt

Vytvoří **nový multi-artboard canvas soubor** v `<designRoot>/<newCanvasDir>/<Name>.html` přes `frontend-design` plugin. Generic envelope se adaptuje podle `<repo>/.design/config.json` (rootClass, themeDefault, tokensCssRel, …).

**Canvas projekt = `DesignCanvas` + jedna nebo více `DCSection` + jeden nebo více `DCArtboard`** (Figma-style scrollable infinite canvas). Single-page wrapper je anti-pattern; nový screen patří jako další `DCArtboard` do existujícího canvasu (přes `/design "<add new artboard for X>"` ne přes `/design:new`).

**Sessions už neexistují.** Nová plocha = nový soubor v `<designRoot>/<newCanvasDir>/`. Žádný `.ai/design-sessions/` adresář, žádné `iterations/NNN.html`. Iterace je in-place edit s `_history/` snapshoty.

## Default = `--perfect`

`/design:new` je **high-leverage moment** — initial scaffold sets the canvas trajectory pro všechny budoucí `/design "<feedback>"` iterace. Levné nedotáhnout, drahé refactorovat zpětně. Proto je critic panel **vždy on, vždy plný, vždy target portfolio-grade**:

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

**Mode není volitelný-on opt-in.** Mode je **opt-out**. Když user nechce platit cost, musí explicitně říct `--quick` nebo `--no-critic`. Ticha je souhlas s plným loopem.

**Vstup `$ARGUMENTS`:** `<Name> "<brief>" [--component] [--mobile] [--quick | --no-critic] [--perfect-iter N]`

- `<Name>` — Title-Case s mezerami (`Match Recap`, `Scout Radar`) pro full-screen canvas projekt.
  - PascalCase (`MatchRecap`) když je to komponenta s `--component`.
- `<brief>` — co má canvas dělat / vypadat. Tady popisuj **co všechno bude v canvasu** (kolik artboardů, jaké screens, jaký flow), ne single screen.
- `--component` — vytvoří `<designRoot>/<newComponentDir>/<PascalName>.jsx` místo top-level HTML. Komponenty se mountují uvnitř canvas artboardů.
- `--mobile` — naznačí mobile aesthetic v promptu (mobile chrome, single column). Default = desktop. Pokud název obsahuje "Mobile" / "iOS" / "Android", auto-detect.
- `--quick` | `--no-critic` | `--perfect-iter N` — viz tabulka výše.
- `--opt-out=palette|aesthetic|full` — opt out z project DS rules. **Default = `palette`** (tokens link + rootClass envelope kept; local namespaced palette overrides colors only; type/radii/aesthetic still enforced). `aesthetic` = palette + gradients/off-ladder radii/alt type pairings/decorative SVGs allowed. `full` = DS treated as advisory. **A11y enforced at every scope.** Plain-language opt-out signals in the brief ("opt-out design system", "modern color scheme", "different feel", "fully off-system") trigger an inferred scope + one-shot AskUserQuestion before the loop kicks off — see SKILL.md "Opt-out scope" + "Iter-1 checkpoint when scope > palette".

**Backwards compat:** `--perfect` a `--perfect --all` jsou stále accepted (no-op pro samotný `--perfect`, `--all` rozšiřuje panel na **every** critic v `agents/`). User co píše `--perfect` explicitně dostane co očekává.

**Příklady:**
```
/design:new "Match Recap" "Post-game recap canvas — 3 artboardy: hero stat card, key moments timeline, share/embed view"
/design:new "Onboarding Desktop" "5-step onboarding flow — welcome, invite preview, identity, permissions, tour. Each as separate DCArtboard."
/design:new "Scout Radar Mobile" "Radar/sonar circular sweep finder — single full-screen canvas s 2 artboardy: scanning + result list" --mobile
/design:new MatchRecap "..." --component                   # komponenta v components/
/design:new "iOS Bikeshare Signup" "5-screen iOS signup flow, modern blue+orange palette" --mobile --opt-out=aesthetic
```

## Postup

Vyvolej skill `design` se vstupem: `new $ARGUMENTS`.

### 1. Resolve config

Načti `.design/config.json`:

```bash
CFG=.design/config.json
NAME=$(jq -r '.name // "Project"' "$CFG")
DESIGN_ROOT=$(jq -r '.designRoot // ".design"' "$CFG")
ROOT_CLASS=$(jq -r '.rootClass // "app"' "$CFG")
THEME=$(jq -r '.themeDefault // "dark"' "$CFG")
TOKENS_REL=$(jq -r '.tokensCssRel // "system/colors_and_type.css"' "$CFG")
NEW_CANVAS_DIR=$(jq -r '.newCanvasDir // "ui/project"' "$CFG")
NEW_COMPONENT_DIR=$(jq -r '.newComponentDir // "ui/project/components"' "$CFG")
TEAM_DEFAULT=$(jq -r '.teamAccentDefault // empty' "$CFG")
```

### 2. Server lifecycle check (auto-start pokud chybí)

Stejné jako u `/design`.

### 3. Validate name + resolve target path

- Default canvas: `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.html`
- `--component`: `<DESIGN_ROOT>/<NEW_COMPONENT_DIR>/<PascalName>.jsx`
- Reject pokud target file existuje (suggest `<Name> v2`).

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
    SCOPE="palette"   # silent default
  fi
fi
```

The resolved `SCOPE` is persisted on the canvas's `.meta.json` `opt_out_scope` field (step 11) and passed to every critic in the auto-fix loop (step 10).

### 5. Build envelope

**Discipline:** envelope je *creative brief*, ne *wireframe spec*. Viz `skills/design/SKILL.md` → "Envelope discipline". Stručně: vibe + 1–2 reference canvases + aspiration directives 9–14 verbatim + brief. **Ne** dictate elements, button counts, copy, paddings.

Adaptuj generic envelope ze SKILL.md "Generation envelope" s konkrétními config hodnotami z kroku 1. **Aspiration directives 9–14 musí být v envelope verbatim** — to je co drive signature-moment-critic axes (signature moment, brand prominence, mock fidelity, restraint, negative space, specificity).

**Test envelope kvality před spuštěním generation:**
- Reads jako brief seniornímu IC? ✓
- Reads jako wireframe spec se seznamem prvků? ✗ — zkrátit
- Délka ~30–50 řádků? ✓ (~100+ = over-prescriptive)
- Aspiration directives přítomny? ✓ povinné
- Reference 1–2 existing canvases? ✓ povinné

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

## Constraints
- rootClass: <ROOT_CLASS>
- tokens: <TOKENS_REL>
- platform: <mobile | desktop>
- opt_out_scope: <palette | aesthetic | full>   ← from step 4, propagated into the generation prompt so the generator knows how much DS latitude it has

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

- Link na tokens (relative path resolved správně z target file)
- `<body class="<ROOT_CLASS>" data-theme="…">`
- Obsahuje alespoň jeden `<DCArtboard` ref (canvas-multi-artboard pattern)
- Žádné hardcoded colors / fonts / radii

### 8. Write target file

Pokud validation fails, do not write. Re-prompt jednou s konkrétním fix-list. Pokud znovu fail, stop.

### 9. Post-write reality check — per-artboard screenshots

**Always fires, regardless of `--no-critic`.** Reality check, ne quality check. Capture přes agent-browser na server URL (ne `file://`).

**Per-artboard element screenshots are the default for `/design:new`** because new canvases are typically multi-artboard (3–8) and DesignCanvas's pan/zoom viewport means a single full-page snapshot misses everything outside the visible viewport. Read artboard ids from the just-written `.meta.json` (step 11 writes it; for the reality-check screenshot we infer ids from the generated JSX — `grep -oE 'DCArtboard id="[^"]*"' "$ACTIVE"`).

```bash
PORT=$(jq -r .port "$DESIGN_ROOT/_server.json")
URL="http://localhost:$PORT/$ACTIVE"                       # URL-escape spaces as %20
HIST="$DESIGN_ROOT/_history/$SLUG"
mkdir -p "$HIST"

agent-browser navigate "$URL" >/dev/null 2>&1
sleep 1.5                                                  # let React+Babel mount the canvas

# Per-artboard loop — selector is the FIRST positional arg, path is the SECOND.
# No `--` separator needed in this form (that was for the `--full` mode).
for ID in $(grep -oE 'DCArtboard id="[^"]+"' "$ACTIVE" | sed -E 's/.*id="([^"]+)".*/\1/'); do
  agent-browser eval "document.querySelector('[data-dc-slot=\"$ID\"]').scrollIntoView({block:'center'})" >/dev/null
  sleep 0.6
  agent-browser screenshot "[data-dc-slot=\"$ID\"]" "$HIST/000-baseline-$ID.png"
done
ls -la "$HIST"/000-baseline-*.png >/dev/null 2>&1 || echo "⚠ no baseline screenshots written"
```

**Why per-artboard wins for canvases (retro 2026-05-09).** During the iOS Bikeshare Signup session, full-page snapshots showed only 1 of 6 artboards because DesignCanvas pans/zooms its world independently of document scroll. `[data-dc-slot]` element screenshots captured all 6 cleanly. See SKILL.md "Post-write reality check" for the full explanation.

**Fallback for ≤ 3 artboards** (cheaper, single image):

```bash
agent-browser screenshot --full -- "$HIST/000-baseline.png"
```

State which approach was used in the print step. `--full` form REQUIRES the `--` separator (without it, the path is silently dropped — see Failure modes).

Pokud blank render / timeout → warn `⚠ canvas rendered blank — likely JSX error`. Don't auto-rollback. Path tohoto screenshotu jde do final print + chat.md iteration 0 row.

Detaily a failure handling: SKILL.md "Post-write reality check".

### 10. Auto-critic + auto-fix loop (default = `--perfect`)

**Same loop algorithm as `/design`** — see SKILL.md "Auto-critic loop". Klíčový rozdíl: `/design:new` má **vyšší výchozí laťku** než `/design "<feedback>"`, protože scaffold je high-leverage.

**Iter-1 checkpoint — fires only when `opt_out_scope ∈ {aesthetic, full}`.** Before spawning iter-1 critics (after the post-write reality-check screenshots), surface a one-shot AskUserQuestion:

```
Iter 1 ready (opt_out_scope = <scope>). Pick:
  (a) Run the auto-fix loop now — fixes a11y; downgrades DS blockers per scope. (default)
  (b) Show me iter 1, I'll send specific feedback (skip auto-loop this round).
  (c) A11y-only check — skip aspiration + DS, just verify accessibility.
```

This exists because the user signaled exploration — they should get to see iter-1 cheaply before the loop reshapes it. **For `opt_out_scope = palette` (default), do NOT fire this checkpoint** — the existing `--perfect` contract runs unconditionally. Auto Mode (AskUserQuestion denied) → default to (a) and proceed.

**Pass `opt_out_scope` to every critic in the panel.** Each `Agent` invocation's prompt MUST include the scope verbatim alongside `canvas_path`, `screenshot_path`, etc. Each critic agent reads `opt_out_scope` and adjusts severity per its own spec — `design-critic` / `graphic-design-critic` / `typography-critic` / `signature-moment-critic` downgrade matching DS-rule blockers to warnings; `a11y-critic` / `frontend-critic` / `copy-critic` ignore the parameter (their blockers are universal).

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
1. Write `<DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json` from the brief (title, subtitle from one-line, brief, platform from --mobile flag, sections+artboards extracted from generated JSX, **`opt_out_scope` from step 4**). Subsequent `/design` iterations on this canvas read the field and inherit the scope automatically — no re-asking on every edit.
2. **If `<DESIGN_ROOT>/INDEX.md` doesn't exist** → invoke `/design:docs --full` (regenerates both INDEX.md and README.md from all canvases). **Do NOT improvise a hand-written INDEX.md** — `/design:docs` is the source of truth and the AUTO-MAINTAINED marker depends on it. Improvised INDEX gets overwritten on next `/design:docs` run, and any rows added by hand are lost.
3. **Else** (INDEX.md exists) → add a row to `<DESIGN_ROOT>/INDEX.md` for the new canvas (or invoke `/design:docs` without `--full` to do the incremental update for you).
4. If `<DESIGN_ROOT>/README.md` doesn't exist after step 2, generate it via `/design:docs --full` flow.
5. Update `<DESIGN_ROOT>/README.md` "Last updated" line. **This step is non-skippable** — if you used `/design:docs --full` in step 2, it's done; if you wrote the INDEX row by hand, you must update README too.

### 12. Print

```
✓ Created: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.html
  Pattern: multi-artboard canvas (DesignCanvas + N artboards)
  Sidecar: <DESIGN_ROOT>/<NEW_CANVAS_DIR>/<Name>.meta.json
  Generation: {frontend-design specialist | orchestrator-direct fallback}
  Baseline: <DESIGN_ROOT>/_history/<slug>/000-baseline.png

  Mode: {--perfect (default) | --perfect-iter N | --quick | --no-critic}
  Opt-out scope: {palette (default) | aesthetic | full} {if inferred from brief: "(inferred from brief — user confirmed via AskUserQuestion)"}
  Critic panel ({default = signature-moment + design + frontend + a11y; --quick = signature-moment only;
                --perfect --all = full set; --no-critic = (none)}; scope-downgraded blockers tagged as warnings):
    correctness: {X} blockers · {Y} warnings
    aspiration: {n}/5 (signature {n}, brand {n}, fidelity {n}, restraint {n}, neg-space {n}) · specificity: {pass|fail}
    verdict: {solid | stable-but-bland | max-reached | divergent | validation-failed | skipped}
    iterations: {N} of {max_iter}
  {if user opted into --quick / --no-critic via flag or AskUserQuestion: "Critic mode: <flag> per user choice"}
  {iteration log for each iter — score delta, fixes applied}
  {if stable-but-bland: "Lowest axes: <list>. Targeted feedback would lift these."}
  {if baseline screenshot covers only some artboards: "Baseline: 000-baseline.png (first 3 artboards only — lazy-mount limit; rest unverified)"}

  Docs: <designRoot>/INDEX.md added entry; <designRoot>/README.md updated.
  {if INDEX.md was missing and /design:docs --full was invoked: "Docs: bootstrapped via /design:docs --full"}

  Klikni na něj v browser file tree (autorefresh přes ↻ tree v UI), stane se aktivním.
  Iteruj přes /design "<feedback>".
```

## Co `/design:new` NEDělá

- Nevytváří `.ai/design-sessions/` (koncept zrušen).
- Negeneruje "iteraci 001". Soubor je rovnou the canvas.
- Nepřepisuje existující soubor (ochrana proti omylem).
- Neotevírá soubor v browseru — user na něj klikne sám (auto-refresh tree přes `↻ tree` v UI).
- Neaktualizuje `_active.json` — stane se aktivním až user klikne v tree.
- **Negeneruje single-page HTML wrapper** — vždycky multi-artboard canvas.

## Failure modes

- **Target file already exists** → preferred: surface AskUserQuestion s 2–3 návrhy alternative name (mechanical `<Name> v2`, plus 1–2 brief-derived semantic alternatives — e.g. pokud existující je `iOS Signup Flow.html` a brief je o scootersharingu, navrhni `Scooter Signup Flow`). Pokud user vybere, použij; pokud zruší, abort.
- **Target file exists AND AskUserQuestion is denied** (Auto Mode / non-interactive context) → infer the most accurate alternative name from the brief — semantic, ne mechanical `v2`. Document the choice explicitly v final printu (`Filename: <chosen> (auto-picked from brief because <existing> existed)`). Auto Mode authorizes reasonable autonomous decisions; preserving existing files while creating a new one with brief-accurate name je reasonable. Mechanical `v2` suffix je acceptable fallback pokud brief nedává jasný semantic name.
- **`frontend-design` Skill nedostupný** → **NE fail** — fall back to orchestrator-direct generation (viz krok 6). Final print MUSÍ flagnout `Generation: orchestrator-direct fallback` + suggestion `/plugin install frontend-design@claude-plugins-official` pro lepší kvalitu příští spuštění.
- **Generated HTML porušuje validaci** (chybí tokens, hardcoded colors, single-page wrapper bez DCArtboard, …) → re-prompt jednou. Pokud zase rozbité, fail s detail.
- **Post-write screenshot fails / canvas renders blank** → warn `⚠ canvas rendered blank — likely JSX error` ale neabortuj. Soubor existuje, user ho může otevřít manually + zjistit error v console.
- **`agent-browser` reportuje "✓ Screenshot saved" ale soubor neexistuje** → CLI flag-vs-positional bug. Zkontroluj že příkaz používá `agent-browser screenshot --full -- "$PATH"` (positional s `--` separátorem), ne `--output "$PATH"`. Re-run s correct syntax.

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

3. **Never silently downgrade** — pokud chceš méně, **explicit flag**: `--quick` nebo `--no-critic`. Token-saving shortcut bez user opt-in / opt-in question = **process violation**. Stejný pattern jako `/execute` Edit-Verify Loop — contract je contract.

4. **If user explicitly chose downgrade** (option b/c v question above, OR explicit `--quick` / `--no-critic` flag) → state it explicitly v final printu:
   > `Critic panel (--quick mode per user choice): signature-moment-critic only, max 2 iter`
- **Path obsahuje cestu mimo `<DESIGN_ROOT>`** → fail (security).
- **`.design/config.json` chybí** → varuj user "using defaults" a pokračuj s defaults z `dev-server/config.schema.json`.
- **Auto-critic loop hits `stable-but-bland`** (correctness clean, aspiration plateau pod target) → ne fail, surface canvas s diagnostic. User má dostat lowest 2 aspiration axes named, aby věděl kam směřovat targeted feedback.
