# Feature: setup-ds aesthetic-ambition axis (rozbít single-accent funnel)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is a spec/infrastructure change to the design plugin's bootstrap flow — pure markdown + JSON Schema, no runtime/app code.**

## Description

`/design:setup-ds` strukturálně kolabuje každý nový design system do „tasteful minimal single-accent editorial" estetiky bez ohledu na brief. Research (`ux-research-agent`) vrací bohaté výsledky, ale discovery questions + critic + worked-example anchory funnelují výstup do jedné akcentní barvy, jednoho fontu, solid pozadí a maximální zdrženlivosti. Tato feature zavádí **jednu first-class osu `aesthetic_ambition`** (`restrained → confident → expressive → maximalist`), která se protáhne celým bootstrap pipeline a deterministicky řídí strukturální knoby, default opt-out scope a restraint floor — takže DS může vědomě jít barevně (Figma/Gumroad/Arc) nebo extravagantně (Canva/Affinity/Memphis), ne jen minimal.

## User Story

As a **designer bootstrapping a new design system** I want **to declare how chromatically/expressively ambitious the system should be** so that **the bootstrap flow opens the full design scale (from quiet editorial to colorful-maximalist) instead of always funnelling me to a single-accent minimal default.**

## Problem

Diagnóza našla **7 nezávislých funnel points**, všechny tlačí stejným směrem (proto je výsledek tak konzistentně minimal):

| # | Místo | Mechanismus |
|---|---|---|
| 1 | `plugins/design/agents/ux-research-agent.md:299` | `recommendations.palette` = **jeden** OKLCH pick; žádný slot pro „kolik barev / jak chromatické". |
| 2 | `plugins/design/agents/ux-research-agent.md:315-316` | Strukturální knoby „NOT research-driven", rationale *„usually `single`"* → agent emituje `single` s **vysokou confidence** → Stage 3 to z definice (`< 0.85`) **přeskočí** → uživatel volbu nikdy neuvidí. Self-fulfilling. Stejně `shadow:soft`, `radii:mild`. |
| 3 | `plugins/design/skills/design-system/_bootstrap.md:189-192` | Q8 nutí *„jakou JEDNU emoci… Vyber jedno slovo"*. Žádná otázka o chromatické/expresivní ambici neexistuje. |
| 4 | `plugins/design/skills/design-system/_bootstrap.md:415-421` | Accent heuristika je čistě single-accent; bez mood cue → *„tasteful default L 68-72"*. |
| 5 | `plugins/design/agents/signature-moment-critic.md:148-156` | Restraint (×1.5) penalizuje >2 chromatic surfaces / >3 accents / *„three accent colors trying to do vibrant"* → maximalismus skóruje nízko → auto-fix loop ho retry-uje zpět k minimalismu. |
| 6 | celý spec (worked examples) | Anchor-monokultura: Stripe/Vercel docs · Linear · Robin Rendle · Frank Chimero · Are.na. LLM pattern-matchuje na „quiet editorial". |
| 7 | `plugins/design/templates/design-system-inspiration/_MAPPING.md:148-156` | Q9 effect-family katalog (`chrome-glow / body-pattern / hard-edges / inset-recess / none`) nemá žádnou chromatickou/maximalistickou rodinu — i kdyby research našel Canva-styl, musí ho namapovat na konzervativní rodinu. |

Opt-out scopes (`aesthetic`/`full`) to umí uvolnit, ale jsou to **per-canvas flagy na `/design:new`**, ne vlastnost DS. DS narozený jako „tasteful" zůstane navždy tasteful, dokud uživatel ručně nedá `--opt-out` na *každý* canvas.

## Solution

**Odvodit** expresivitu z toho, jak uživatel popíše produkt (Stage 1 vision-brief) + co UX-research najde podle **charakteru značky** (Probe A lineage + Probe B Zrcadlo+Charakter) — NE vnutit ji dalším pickerem. `aesthetic_ambition` je **kotevní inference** v `recommendations` bloku: research agent ji přečte jako „aesthetic temperature" značky a všechny ostatní strukturální knoby (`accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio`) z ní pak **dědí** — místo aby každý zvlášť padal na konzervativní default. Surfacuje se Stage 3 přes standardní confidence-gate (skip / prefill / ask), úplně jako každé jiné rozhodnutí.

4-pólová škála + mapování na knoby (toto je referenční tabulka, kterou agent použije při inferenci a derivaci):

| Pól | Estetika (referenční kánon) | `accentStrategy` | shadow/decor | default `opt_out_scope` |
|---|---|---|---|---|
| `restrained` | mono / 1 akcent, editorial, hodně negative space — *Linear, Stripe docs, Vercel* | `single` | soft/none | `palette` |
| `confident` | 1 silný akcent + 1–2 podpůrné, mírná dekorace — *Notion, Height, Stripe marketing* | `single \| paired` | soft, +1 chromatic surface tolerance | `palette` |
| `expressive` | multi-accent / párově chromatické, hravé tvary, gradienty OK — *Figma, Gumroad, Arc* | `paired \| chromatic-3` | accent-tinted, gradients | `aesthetic` |
| `maximalist` | chromatická paleta (3+ akcenty), barva jako struktura — *Canva, Affinity, Memphis, Figma Config* | `chromatic-N` | bold, color-as-structure | `full` |

**Pojistka proti návratu funnelu (kritická):** **absence signálu ≠ `restrained`.** Když vision-brief + research nedávají jasnou aesthetic temperature, je to **nízká confidence → Stage 3 se ZEPTÁ** (otevírací otázka napříč celou škálou, vč. multi-color palety), NE tiché spadnutí do minimalu. Vysoká confidence (a tedy skip) je legitimní jen když brand charakter směr opravdu určuje — na obou koncích škály stejně (jasně klidný editorial → `restrained` skip je správně; jasně hravý multi-color → `expressive`/`maximalist` skip je správně).

**Config default `restrained`** je POUZE legacy/no-bootstrap fallback (config bez pole, např. ručně psaný) — **čerstvě bootstrapnutý DS vždy zapíše odvozenou hodnotu**, ne default. Existující DSy bez pole se chovají jako dnes (žádná migrace).

## Metadata

- **Ticket**: none (internal spec change; tracked via DDR-073)
- **Type**: Enhancement (bootstrap-flow capability)
- **Complexity**: High (9 spec files + JSON schema + DDR; cross-cutting across skill/agent/command/template layers)
- **App/Package**: `plugins/design` (design plugin bootstrap), `plugins/design/dev-server/config.schema.json`
- **Affected Systems**: design-system bootstrap flow, ux-research-agent, signature-moment-critic, `/design:new` + `/design:edit` opt-out resolution, design-system-completeness-critic (C7), config schema
- **Dependencies**: none new (ajv 2020-12 already in repo for schema; no npm deps)

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message**.

- `plugins/design/skills/design-system/_bootstrap.md` (Stage 0 `:108-130`, Stage 1 `:131-251`, Stage 3 `:311-345`, accent heuristic `:411-423`, Batch A scaffold `:589-617`) — Why: the discovery flow + scaffold that must learn the ambition axis.
- `plugins/design/agents/ux-research-agent.md` (recommendations schema `:297-337`, structural-knob doc `:315-323`, confidence heuristic `:331-337`) — Why: the agent that must stop defaulting `single` and start deriving knobs from ambition + emit `palette_options[]`.
- `plugins/design/skills/design-system/_pastier-probe-templates.md` (Probe A `:13-38`, Probe C `:75-111`) — Why: worked examples + research branches to broaden with expressive/maximalist anchors.
- `plugins/design/templates/design-system-inspiration/_MAPPING.md` (Q9 families `:144-158`, `:158` new-family clause) — Why: add `chromatic-blocks` + `gradient-mesh` effect families.
- `plugins/design/dev-server/config.schema.json` (`:104-130` — completenessProfile/accentStrategy/colorSpace) — Why: insertion point + sibling shape for the new `aestheticAmbition` field.
- `plugins/design/templates/design-system-inspiration/core/config.json.tpl` (`:19-21`) — Why: add the `aestheticAmbition` placeholder so scaffold emits it.
- `plugins/design/agents/signature-moment-critic.md` (opt-out scope `:44-54`, Restraint axis `:143-165`, Negative space `:167-187`) — Why: make declared-maximalist DS judged by intentional coherence, not absolute counts.
- `plugins/design/commands/new.md` (opt-out resolution `:193-217`) — Why: default `opt_out_scope` from `config.aestheticAmbition` instead of hardcoded `palette`.
- `plugins/design/commands/edit.md` (opt-out resolution) — Why: same default resolution as `new.md`.
- `plugins/design/agents/design-system-completeness-critic.md` (C7 accent-count gate) — Why: confirm C7 passes when ambition drives `chromatic-N` (read-only check, no edit expected).

### Files to Create

- `.ai/archive/decisions/DDR-073-aesthetic-ambition-axis.md` — the decision record (drafted below in Task 1).

### Design canvases

> N/A — this feature has no UI surface. It edits the *generator* of design systems, not a canvas. `.design/` exists but no canvas matches the `aesthetic-ambition` / `setup-ds` slug; recent canvas activity (annotations/draw-agent) is unrelated.

### Documentation

- `.ai/archive/decisions/DDR-033-*.md` (3-stage discovery, zero hardcoded ladders) — Why: the Stage-0 ambition picker is a 2nd meta-picker; argue the tension explicitly.
- `.ai/archive/decisions/DDR-043-*.md` (bias-free templates) — Why: this change *reinforces* DDR-043 (removes the hidden conservative `single/soft/mild` prior).
- `.ai/archive/decisions/DDR-057-*.md` (aspiration bar ≥4.0) — Why: verify a maximalist canvas can still hit 4.0 under relaxed restraint scoring.

### Patterns to Follow

- **opt_out_scope resolution** (`plugins/design/commands/new.md:200-217`): explicit flag wins → plain-language inference → default. The new behavior inserts a config-default read between inference and the hardcoded fallback:
  ```bash
  # 1. Explicit flag wins.
  SCOPE=$(grep -oE -- '--opt-out=(palette|aesthetic|full)' <<< "$ARGS" | cut -d= -f2)
  # 2. Plain-language inference (only if no explicit flag).  [unchanged]
  # 3. NEW: DS default from config.aestheticAmbition (only if still unset).
  #    restrained|confident → palette ; expressive → aesthetic ; maximalist → full
  # 4. Hardcoded fallback `palette` (only if config has no aestheticAmbition — legacy DS).
  ```
- **Confidence-gated Stage 3** (`ux-research-agent.md:331-337`): `≥0.85` skip · `0.60–0.85` ask-with-prefill · `<0.60` ask-no-prefill. The fix is NOT "always ask" — it's that `aesthetic_ambition` confidence is computed HONESTLY from brand-character signal strength, and **ambiguity (no clear signal) yields `<0.60` → ask**, instead of the old "default `single` at high confidence → silently skip". High confidence (skip) is correct at BOTH ends when the character is unambiguous.
- **Effect-family classification** (`_MAPPING.md:144-158`): every payload `*_options[].family` must classify into a catalogued family; new families require a spec-change conversation (this DDR is it).
- **Token-role separation** (`_bootstrap.md:611`, D-5): chromatic-blocks surfaces must use real accent/surface tokens, never dual-purpose a decorative backdrop token as a product fill.

---

## Design Decisions

> This feature *is* a design-system-bootstrap change; the "design decisions" here are the axis contract, not UI components.

### The axis contract

- **Name:** `aesthetic_ambition` (payload `recommendations`) ↔ `aestheticAmbition` (config.json). Enum: `restrained | confident | expressive | maximalist`.
- **Inference point (NOT a picker):** `aesthetic_ambition` is a **derived `recommendations` decision** computed by `ux-research-agent` from the brand character — Probe A (lineage / Ulice) + Probe B (Zrcadlo+Charakter) + the product description fields of `vision-brief.json` (`elevator_pitch`, `values`, `primary_emotion`, `design_lineage`, `ds_signature_hypothesis`, `tired_tropes_to_avoid`, `audience`). It is the **anchor knob**: `accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio` derive FROM it rather than each defaulting independently. **No Stage 0 picker, no forced choice** — this is what makes it research-driven (aligned with DDR-033) and what fixes the user's "the questions force me to pick" complaint.
- **Surfacing:** standard confidence gate (skip ≥0.85 / prefill 0.60–0.85 / ask <0.60). Ambiguous brand character → `<0.60` → Stage 3 opens the question across the full scale (incl. a multi-color palette option), never silently defaults to `restrained`.
- **Mapping table** (ambition → knobs → scope): the Solution table above is authoritative; bake it verbatim into `_MAPPING.md` and `ux-research-agent.md` as the derivation reference.

### New Q9 effect families (add to `_MAPPING.md`)

| Family ID | Scaffold effect (`_layout.css` / tokens) |
|---|---|
| `chromatic-blocks` | Multiple `--accent-*` filled surfaces used as structural blocks (Memphis / Canva); bold color fields, high chroma, color carries hierarchy. Requires `accentStrategy ≥ chromatic-3`. |
| `gradient-mesh` | Soft multi-stop mesh / aurora background (Figma / Stripe-marketing); `--mesh-*` backdrop family (single-role per D-5), accent-tinted cards. Honors `prefers-reduced-motion`. |

### Anchor canon to add (across worked examples)

Alongside the existing quiet-editorial anchors, add real expressive/maximalist anchors: **Figma, Figma Config, Canva, Affinity, Gumroad, Arc browser, Framer, Linear marketing site, Stripe marketing (not docs), Pitch, Cosmos, Spline, Retool.** Goal: break the LLM's mono-cultural pattern match — NOT replace the minimal anchors, but balance them per ambition pole.

### Tokens

- `accentStrategy` already supports `^(single|paired|chromatic-[1-9][0-9]?)$` (`config.schema.json:122`) — no schema change needed there; ambition just drives which value is chosen.
- New token families gated by the new Q9 families: `--mesh-*` (gradient-mesh), additional `--accent-2/-3/...` (chromatic-blocks). Both must pass completeness-critic C7 (accent count == declared `accentStrategy`).

### Custom Components Needed

None — no UI components. All work is spec markdown + JSON Schema + one DDR.

---

## Tasks

Execute in order. Each task is atomic and independently reviewable. **No version bump** (spec-only change; CI parity gate stays green because all three version fields are untouched).

### Task 1: CREATE `.ai/archive/decisions/DDR-073-aesthetic-ambition-axis.md`

- **Do**: Record the decision — the 7 funnel points, the 4-pole axis + mapping table, the 2 new Q9 families, the DDR-033/043/057 relationships, and the chosen capture point (Stage 0 vs Stage 1 — record whichever the user confirms).
- **Pattern**: Mirror an existing DDR's structure (e.g. `.ai/archive/decisions/DDR-043-*.md`, `DDR-057-*.md`) — Status / Context / Decision / Consequences / Related.
- **Gotcha**: 070–072 are already taken (draw / svgo / tsx-sync-opt-in); this is DDR-073 — RE-VERIFY + bump at execute, concurrent work claims numbers fast. Use `/flow:record-ddr` or follow the house format exactly.
- **Validate**: file exists; `grep -l 'DDR-073' .ai/archive/decisions/` returns it; no duplicate number.

### Task 2: UPDATE `plugins/design/dev-server/config.schema.json` — add `aestheticAmbition`

- **Do**: Insert a new property after `colorSpace` (`:130`):
  ```json
  "aestheticAmbition": {
    "type": "string",
    "enum": ["restrained", "confident", "expressive", "maximalist"],
    "description": "How chromatically/decoratively expressive the DS is. Drives accentStrategy default, shadow/decor scaffold, and the default opt_out_scope for canvases under this DS. Default 'restrained' (backwards-compatible). Per DDR-073.",
    "default": "restrained"
  }
  ```
- **Pattern**: copy the shape of `completenessProfile` (`:104-109`) — enum + description + default.
- **Gotcha**: `additionalProperties` may be `false` on the root config object — verify the new key is allowed (it's a declared property, so fine). Keep trailing-comma/JSON validity.
- **Validate**: `node -e "JSON.parse(require('fs').readFileSync('plugins/design/dev-server/config.schema.json','utf8'))"` exits 0; `jq '.properties.aestheticAmbition' plugins/design/dev-server/config.schema.json` shows the block.

### Task 3: UPDATE `plugins/design/templates/design-system-inspiration/core/config.json.tpl` — emit the field

- **Do**: Add `"aestheticAmbition": "{{aesthetic_ambition}}",` near `accentStrategy`/`colorSpace` (`:20-21`).
- **Pattern**: existing `{{accent_strategy}}` / `{{color_space}}` placeholders.
- **Gotcha**: scaffold substitution must supply `{{aesthetic_ambition}}` — wire it in the Batch A token-emit step (Task 8). Until then the placeholder would render literally, so Tasks 3 + 8 land together.
- **Validate**: `grep aestheticAmbition plugins/design/templates/design-system-inspiration/core/config.json.tpl`.

### Task 4: UPDATE `plugins/design/templates/design-system-inspiration/_MAPPING.md` — new families + ambition doc

- **Do**: (a) Add `chromatic-blocks` + `gradient-mesh` rows to the Q9 effect-family table (`:148-156`). (b) Add a short "Aesthetic ambition → structural knobs" subsection documenting the mapping table (Solution section) so the scaffold has a single source.
- **Pattern**: the existing family-table format (`Family ID | Scaffold effect`).
- **Gotcha**: respect D-5 token-role separation — `--mesh-*` is backdrop-only, never a product fill.
- **Validate**: `grep -E 'chromatic-blocks|gradient-mesh' plugins/design/templates/design-system-inspiration/_MAPPING.md`.

### Task 5: UPDATE `plugins/design/skills/design-system/_bootstrap.md` — NO new picker; document ambition as an inferred decision

- **Do**: (a) **Do NOT add a Stage 0 picker.** Stage 1 vision-brief stays as-is — the product description it already captures IS the ambition input. (b) Add a one-paragraph note to Stage 2 (`:253-298`) stating that `aesthetic_ambition` is inferred by the research agent from brand character (Probe A + Probe B) and is the anchor the other structural knobs derive from. (c) Leave the `vision-brief.json` schema (`:219-244`) essentially unchanged — optionally add `aesthetic_ambition_signal` ONLY as a nullable field populated when the user *volunteered* an expressiveness cue in free-text (e.g. P5/P10 says "barevné jako Figma"); it is a hint, not a required field, and never a forced question.
- **Pattern**: how Stage 2 already documents that research drives the recommendations (`:253-296`); the optional-field convention (`values: "<P3 — may be null>"` at `:226`).
- **Gotcha**: resist the temptation to "make it explicit" with a picker — that's the exact funnel/over-asking the user rejected. The strength comes from honest inference + the ambiguity→ask safeguard (Task 6), not from a forced choice.
- **Validate**: `grep -n 'aesthetic_ambition' plugins/design/skills/design-system/_bootstrap.md`; **confirm NO new `AskUserQuestion` was added to Stage 0**.

### Task 6: UPDATE `plugins/design/agents/ux-research-agent.md` — infer `aesthetic_ambition` as the anchor decision + derive knobs from it + `palette_options[]`

- **Do**: (a) **Add `aesthetic_ambition` as a first-class `recommendations` decision** (sibling to `palette`, `typography`, …) — the agent infers it from brand character (Probe A lineage + Probe B Zrcadlo+Charakter + the vision-brief product-description fields) and assigns confidence by signal strength. It is the **anchor**: emit it BEFORE the structural knobs. (b) **Rewrite the `_structural_doc` (`:315`)** — `accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio`, `easing_personality` are **derived from the inferred `aesthetic_ambition`** via the mapping table; **delete the "usually `single`" instruction entirely** (that hardcoded prior is the bug). (c) **Confidence = honest signal read, ambiguity → low.** When brand character gives no clear aesthetic temperature, `aesthetic_ambition` confidence is `<0.60` → Stage 3 asks across the full scale. NEVER emit high-confidence `restrained` to fill a vacuum. (d) Extend Probe E (Confidence) to compute `aesthetic_ambition` confidence from how strongly Probe A+B anchors cluster on a temperature. (e) Add `palette_options[]` (2–5 coordinated OKLCH per option) to the discovery payload; populate when inferred ambition ≥ `expressive`. (f) `recommendations.palette.recommendation` may reference a `palette_options[]` entry (multi-color), not only a single `color_oklch_options[]` id.
- **Pattern**: existing `recommendations.*` decision shape (`:299-314`) + `color_oklch_options[]` (`:210`); confidence heuristic (`:331-337`); Probe E in `_pastier-probe-templates.md` (`:141-174`).
- **Gotcha**: backwards-compat — a genuinely quiet brief still infers `restrained` at high confidence and behaves exactly as today. The change is that `restrained` must be *earned from signal*, not assumed. The knob derivation REPLACES the per-knob conservative defaults — don't leave both paths.
- **Validate**: `grep -n 'aesthetic_ambition\|palette_options' plugins/design/agents/ux-research-agent.md`; `_structural_doc` no longer contains "usually single"; `aesthetic_ambition` appears in the `recommendations` block.

### Task 7: UPDATE `plugins/design/skills/design-system/_pastier-probe-templates.md` — ambition branches + anchors

- **Do**: (a) **Probe B (Zrcadlo+Charakter): add an explicit "aesthetic temperature" read** — from the character/values/emotion anchors, infer where the brand sits on the `restrained→maximalist` scale, with worked examples at BOTH ends (a quiet craftsman → `restrained`; a playful color-forward maker → `expressive`/`maximalist`). This is the primary signal source for Task 6's `aesthetic_ambition` inference. (b) **Probe E (Confidence): add the `aesthetic_ambition` confidence rule** — strong same-temperature clustering across Probe A+B anchors = high confidence; mixed/absent signal = `<0.60` (→ Stage 3 asks). (c) Probe A (Ulice): when the inferred temperature ≥ expressive, search the expressive/maximalist canon too. (d) Probe C (OST): add a maximalist signature worked example (chromatic-blocks anchored on Canva/Memphis). (e) Broaden worked-example anchors per the anchor-canon list.
- **Pattern**: existing Probe B (`:42-71`) + Probe E (`:141-174`) worked examples.
- **Gotcha**: Hard rule #3 (real products only) + #5 (no Pastier vocabulary in user-facing fields) still apply to every new example. The temperature read is INFERENCE from real anchors — not a vibe guess.
- **Validate**: `grep -E 'Figma|Canva|Gumroad|Arc|temperature' plugins/design/skills/design-system/_pastier-probe-templates.md`.

### Task 8: UPDATE `plugins/design/skills/design-system/_bootstrap.md` — Stage 3 + accent heuristic + Batch A scaffold

- **Do**: (a) Stage 3 (`:311-345`): `aesthetic_ambition` surfaces via the standard confidence gate — when inferred confidently it only shows in the final confirm; when ambiguous (`<0.60`) it becomes a Stage 3 Q that opens the whole scale (with a multi-color palette option from `palette_options[]`, not a single swatch). The palette Q presents a coordinated palette when ambition ≥ expressive. (b) Accent heuristic (`:411-423`): add multi-hue / maximalist rows (palette-level, not single-swatch), and reframe the "default (no mood cue) → tasteful default" row so absence-of-cue routes to the ambition inference, not to a hardcoded tasteful single accent. (c) Batch A scaffold (`:589-617`): `colors_and_type.css` emits N accent families per ambition-derived `accentStrategy`; `_layout.css` applies the new `chromatic-blocks` / `gradient-mesh` treatments; write the inferred `{{aesthetic_ambition}}` into `config.json` (closes Task 3).
- **Pattern**: existing Stage 3 question shape (`:333-343`), accent heuristic table, Batch A serial-write steps (`:595-617`).
- **Gotcha**: token-role separation (D-5) — chromatic-blocks fills use accent/surface tokens; `--mesh-*` is backdrop-only. Honor Q10 hard-NOs (e.g. "no gradients" overrides `gradient-mesh`).
- **Validate**: `grep -n 'palette_options\|chromatic-blocks\|gradient-mesh\|aesthetic_ambition' plugins/design/skills/design-system/_bootstrap.md`.

### Task 9: UPDATE `plugins/design/commands/{new,edit}.md` — default opt_out_scope from config

- **Do**: In the opt-out resolution (`new.md:200-217` and the equivalent in `edit.md`), insert step 3: when no explicit flag and no plain-language inference, read `config.aestheticAmbition` and map `restrained|confident→palette`, `expressive→aesthetic`, `maximalist→full`. Hardcoded `palette` stays as the legacy fallback (config without the field).
- **Pattern**: the bash resolution block (`new.md:200-217`); `config.json` reads already use `jq` in `prep.sh`/step 1.
- **Gotcha**: explicit `--opt-out` and plain-language signals still win (precedence unchanged). A11y enforced at every scope (don't touch that invariant).
- **Validate**: `grep -n 'aestheticAmbition' plugins/design/commands/new.md plugins/design/commands/edit.md`.

### Task 10: UPDATE `plugins/design/agents/signature-moment-critic.md` — declared-maximalist coherence

- **Do**: Extend the opt-out-scope adjustment (`:44-54`) with one line: a DS whose `aestheticAmbition` is `maximalist` is judged on intentional chromatic COHERENCE, not absolute surface/accent counts (i.e. `full`-scope language applies DS-wide, not per-canvas). No new scoring logic — just make the existing `aesthetic`/`full` branches reachable from the DS declaration via the Task-9 scope default.
- **Pattern**: existing opt-out-scope table (`:50-54`) and `full`-scope language ("judge against the canvas's own internal coherence").
- **Gotcha**: keep the true-overload guard (5+ chromatic surfaces in a 200px region) — maximalism ≠ chaos. The bar shifts from "count" to "coherent".
- **Validate**: `grep -n 'aestheticAmbition\|maximalist' plugins/design/agents/signature-moment-critic.md`.

### Task 11: VERIFY `design-system-completeness-critic` C7 + cross-reference consistency

- **Do**: (a) Read C7 in `design-system-completeness-critic.md`; confirm it gates actual `--accent*` count against the declared `accentStrategy` and therefore PASSES when ambition drives `chromatic-N` (scaffold emits N families in Task 8). Edit only if C7 hardcodes `single`. (b) Cross-reference sweep: assert the new field name (`aestheticAmbition` / `aesthetic_ambition`), the 4 enum values, and the 2 new family IDs are spelled identically across all 8 edited files.
- **Pattern**: grep-based consistency check.
- **Gotcha**: snake_case in vision-brief/payload (`aesthetic_ambition`) vs camelCase in config.json (`aestheticAmbition`) — keep the two conventions consistent with how `accent_strategy`↔`accentStrategy` already split.
- **Validate**: `grep -rn 'aesthetic_ambition\|aestheticAmbition\|chromatic-blocks\|gradient-mesh' plugins/design/ | sort` — all references agree; no typos.

### Task 12: DOGFOOD — run `/design:setup-ds` for both extremes (the real acceptance test)

- **Do**: In a scratch project (`/tmp/scratch-ambition`), run (a) `/design:setup-ds maxtest "barevný kreativní nástroj jako Figma/Canva, multi-color, hravý"` and (b) `/design:setup-ds mintest "klidný editorial blog"`.
- **Pattern**: README "Local development" — point marketplace at the local tree, test in a scratch project (NOT this repo's `.ai/`).
- **Gotcha**: requires `/plugin marketplace update maude` + `/reload-plugins` after edits so the scratch session sees the new spec.
- **Validate**:
  - **maxtest**: `config.json.aestheticAmbition == "expressive"|"maximalist"`; `accentStrategy ∈ {chromatic-3, chromatic-N}`; Stage 3 surfaced a multi-color palette (not a single swatch); ≥3 `--accent*` families in `colors_and_type.css`; completeness-critic C7 green; a generated canvas under the DS without `--opt-out` is NOT retried to death by signature-moment-critic.
  - **mintest**: `aestheticAmbition == "restrained"`; behavior identical to pre-change (backwards-compat proof).

---

## Validation

> **Repo reality:** Maude has no app to run and no `tsc` gate (CLAUDE.md: "no test suite, lint config, or build step" for plugin markdown; `typecheck` intentionally absent from `quality`). The plugin layer is markdown + JSON Schema, so the UI gates below (scenario-runner / a11y-auditor / design-system-guard) are **N/A** — the acceptance backbone is the **dogfood run (Task 12)** + schema/cross-ref checks. Stated honestly rather than invented.

Run these to confirm zero regressions:

1. **JSON Schema validity**: `node -e "JSON.parse(require('fs').readFileSync('plugins/design/dev-server/config.schema.json','utf8'))"` exits 0.
2. **Cross-reference consistency** (Task 11): `grep -rn 'aesthetic_ambition\|aestheticAmbition\|chromatic-blocks\|gradient-mesh' plugins/design/` — every reference agrees on spelling/enum; no orphan placeholder `{{aesthetic_ambition}}` left unwired.
3. **Plugin reachability guard**: `node --test cli/lib/plugin-cli-reachability.test.mjs` — confirm no markdown edit introduced a banned direct `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"` call (none expected, but the edits touch command markdown).
4. **Existing quality gates** (per `.ai/workflows.config.json`): `pnpm lint` (biome — touched files only need to stay clean), `parity` (untouched versions stay in lockstep), `tokens` + `site-content` (unaffected). **No version bump.**
5. **Dogfood acceptance (Task 12)**: the maxtest + mintest runs are the primary proof. Capture screenshots of the maximalist DS showcase to confirm it actually renders colorful (not funnelled).
6. ~~Cross-platform scenario~~ — **N/A** (no runnable app; the deliverable is the generator spec, not a UI surface).
7. ~~design-system-guard / a11y-auditor~~ — **N/A** for the spec edit itself; the *generated* DS still runs its own post-scaffold "4 kola značky" critic gate (incl. a11y) inside Task 12's dogfood.
8. **Manual**: re-run an existing minimal-brief setup-ds and confirm byte-level behavior parity (no regression for the `restrained` default path); confirm DDR-057's ≥4.0 aspiration bar is still reachable by a maximalist canvas under relaxed restraint scoring.

---

## Scenario Coverage

> **N/A** — no app, no user-flow UI. The design-plugin bootstrap is exercised by the Task 12 dogfood, not by `.ai/scenarios/` cross-platform runners. (The flow `scenario-runner` targets downstream app UIs; this repo's deliverable is the plugin spec.)

---

## Acceptance Criteria

- [ ] DDR-073 recorded (Task 1)
- [ ] `aestheticAmbition` in config schema + emitted by the config template (Tasks 2–3)
- [ ] 2 new Q9 effect families documented in `_MAPPING.md` (Task 4)
- [ ] **NO new forced picker added** — Stage 1 unchanged; Stage 2 notes ambition is inferred (Task 5)
- [ ] `ux-research-agent` **infers `aesthetic_ambition` from brand character** as the anchor `recommendations` decision, derives the other knobs from it (no "usually single"), and **ambiguity → `<0.60` → Stage 3 asks** (never silent `restrained`); emits `palette_options[]` (Task 6)
- [ ] Worked-example anchors broadened beyond the quiet-editorial canon (Task 7)
- [ ] Stage 3 + accent heuristic + Batch A scaffold honor ambition / multi-accent / new families (Task 8)
- [ ] `/design:new` + `/design:edit` default opt_out_scope from `config.aestheticAmbition` (Task 9)
- [ ] signature-moment-critic judges declared-maximalist by coherence, not counts (Task 10)
- [ ] completeness-critic C7 passes for `chromatic-N`; cross-reference sweep clean (Task 11)
- [ ] **Dogfood proof (Task 12): maxtest produces a genuinely colorful/multi-accent DS; mintest is byte-compatible with pre-change behavior**
- [ ] JSON schema valid; reachability guard + lint green; no version bump
- [ ] No DDR-worthy decision left unrecorded (DDR-073 covers it)
- [ ] Roadmap regenerated at commit time (`pnpm --filter @maude/site gen:roadmap`) — required because a new plan landed under `.ai/plans/`

---

## Open decisions (resolve at execute-time)

> **Resolved decisions (locked):**
> - `aesthetic_ambition` is **inferred** from the product description + UX-research brand character, never a forced picker (per user direction — removes the old Stage-0-picker question).
> - **Timing: pure post-research.** User chose: product is described in Stage 1 (pre-research); ambition is inferred in Stage 2; the user is asked ONLY in Stage 3 and ONLY when confidence is low. **No early Stage-1 steer prompt, no always-on post-research confirm.** When confident, ambition appears only in the final confirm summary (still overridable via "něco upravit"). Do NOT add an ambition prompt before research.

1. **Anti-funnel calibration — how hard to push the agent against its own minimal bias.** The remaining risk is the LLM lazily inferring `restrained` even from an expressive brief. Mitigations baked into the plan: (a) ambiguity → `<0.60` → ask (never silent restrained); (b) two-ended worked examples in Probe B; (c) broadened anchors. Open question for execute: should Probe E additionally require an explicit "I considered the expressive end and ruled it out because <X>" audit line in `research_quality_notes` whenever it infers `restrained`/`confident` — forcing the agent to justify the conservative read rather than defaulting to it? Recommended: **yes** (cheap, high-leverage against the bias). Confirm.
2. **Should a strong free-text expressiveness cue in Stage 1 (e.g. P10 "barevné jako Figma") hard-pin ambition** (skip inference, set `expressive`+ directly), or just feed it as a high-weight signal into the inference? Recommended: **feed as high-weight signal** (keeps research in the loop to refine the exact pole), but a hard-pin is defensible when the cue is unambiguous. Confirm at execute.

---

## Retro (executed 2026-06-01, commit `5e5c408`)

**What worked**
- The diagnosis was the leverage. Every task had a `file:line` anchor before any edit, so the 11 edits were surgical — no exploratory thrash mid-execute.
- The **inference-not-picker pivot** (user's correction mid-plan) made the change *smaller and cleaner* than the original Stage-0-picker design: it reuses the existing `recommendations`/confidence machinery instead of bolting on UI, and it resolved the DDR-033 tension entirely. Lesson for `/plan`: when a feature adds a "knob", first ask whether the existing inference pipeline can carry it before designing a new prompt.
- Right-sized verification held up: biome (2 files), CLI tests 143/143, reachability 2/2, and a live `--no-discovery` end-to-end smoke caught the real risk (placeholder leak) without the cost of the full UI/scenario/security pipeline (genuinely N/A here).

**What didn't / surprises**
- **Plan undercounted the file set (9 → 10 actual + the schema).** The plan missed `cli/commands/design.mjs`: adding a `{{placeholder}}` to `config.json.tpl` silently requires a matching key in `defaultPayload()` or `--no-discovery` leaks the literal. **Lesson:** when `/plan` adds a template placeholder, it must trace EVERY substituter (discovery scaffold AND the CLI `--no-discovery` payload), not just the scaffold path.
- **The repo was a live concurrent battlefield.** During this session `main` advanced under me 4+ times (draw engine DDR-070/071 + tsx-sync DDR-072 all landed concurrently), branches switched mid-`git`-script, and DDR/number collisions forced two renumbers (070→072→073). Two `git diff` reads returned empty mid-script purely from HEAD moving between commands. **Lesson:** in a shared tree, never trust a multi-command bash snapshot — re-read state atomically right before any mutation, and guard `HEAD==main` inside the same command that commits.

**What to change in `/plan` or `/execute`**
- `/plan` should add a checklist item: "for every new template placeholder, list its substituters and confirm each has a default."
- `/execute` + `/done` should, on a detectably-concurrent tree (HEAD moved since session start, or target files in others' uncommitted set), default to per-file additive-diff verification before commit (the `git diff <file> | grep '^-'` check that confirmed no concurrent content was clobbered here).

**Deferred (not a blocker, but the real acceptance gate):** Task 12 dogfood (`/design:setup-ds maxtest` + `mintest`) is interactive and was not run. Implementation is statically verified; behavioral proof that a maximalist brief actually yields a colourful multi-accent DS (and that a minimal brief stays byte-compatible) is still pending a scratch-session run.
