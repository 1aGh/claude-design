---
name: design:design-system
description: Owns all design-system work. (1) READ mode (default) — loads the active canvas's declared DS (tokens, philosophy, hard-stops) so the agent iterates against the correct context. (2) BOOTSTRAP mode — runs when invoked via /design:setup-ds, or auto-loaded by /design:edit / /design:new on a missing target. Hard-deps pre-flight, spawns `design:ux-research-agent` in `discovery` mode (Round 0 — domain reference pool from WebSearch), then runs 12-question discovery (3 rounds of AskUserQuestion with options sourced from research payload) in one of 3 sub-modes (first-bootstrap / additional-ds / re-bootstrap), consults _MAPPING.md to compute scaffold set, generates project-flavored files using design-system-inspiration as reference, runs design-system-completeness-critic, and prints next-step block.
user-invocable: true
---

# design-system — pointer + bootstrap

This skill has **two responsibilities** with **mode-switched flows**:

1. **READ flow** (default) — load the project's design-system context (tokens, philosophy, hard-stops, active families) so any agent iterating on a canvas respects the system.
2. **BOOTSTRAP flow** — scaffold a new design system (first one, an additional one alongside an existing DS, or re-bootstrap an existing DS with `--force`).

The mode is **auto-detected** at invocation (see `## Mode-detection` below).

---

## Mode-detection (which flow to run)

At every invocation, decide which flow to execute:

- Invoked via `/design:setup-ds <name>` → **BOOTSTRAP**, `target_ds = <name>`
- Invoked via `/design:edit "..."` or `/design:new "..."` AND no `<designRoot>/system/*/` exists → **BOOTSTRAP**, `target_ds = "project"`, Q1 prefilled from `$ARGUMENTS` / `$BRIEF`
- Invoked via `/design:setup-ds <existing-name> --force` → **BOOTSTRAP** (re-bootstrap), `target_ds = <existing-name>`
- Otherwise (active canvas exists, `system/*/` exists) → **READ** (default)

When in BOOTSTRAP mode, classify into sub-modes:

- `first-bootstrap` — `.design/config.json` does not exist (or `designSystems[]` is empty)
- `additional-ds` — config exists, `target_ds` is NOT in `designSystems[]`
- `re-bootstrap` — config exists, `target_ds` IS in `designSystems[]`, `--force` passed (else refuse)

If both modes seem plausible, **prefer READ** — bootstrap should be the explicit choice.

---

## Read flow (canvas iteration)

When you're generating, reviewing, or migrating UI:

1. **Resolve `designRoot`** from `<repo>/.design/config.json` (or fall back to `.design`).
2. **Look up the canvas's declared DS.** Read `<canvas>.meta.json.designSystem` to know which DS to load. Fall back to `config.json.defaultDesignSystem` if no canvas meta. Fall back to `system/project/` if neither is set (single-DS layout).
3. **Read the tokens CSS** at `<designRoot>/<resolvedDsPath>/colors_and_type.css` (or the path declared in `config.json.tokensCssRel` for single-DS layouts). These are the only legal colors / fonts / radii / shadows.
4. **Read the DS README** at `<designRoot>/<resolvedDsPath>/README.md` — it contains the project-specific aesthetic, hard-stop rules, and rationale that override anything generic you'd otherwise default to.
5. **Read the DS SKILL.md** at `<designRoot>/<resolvedDsPath>/SKILL.md` — terse load-bearing summary the agent should treat as authoritative for hard rules + voice.
6. **Browse specimens** at `<designRoot>/<resolvedDsPath>/preview/` — concrete examples of legal swatches, typography pairings, density ladders, component compositions.
7. **Reference UI kits** at `<designRoot>/<resolvedDsPath>/preview/ui_kits-{desktop,mobile}-{index,showcase}.tsx` (when present) — `index` is the catalog/launcher, `showcase` is the full product mock with theme/accent switching. These flatten into the `preview/` dir at scaffold time; the source convention in the inspiration library is `platform-<platform>/ui_kits-<platform>-*.html`.

### Multi-DS lookup pattern

When `config.json.designSystems[]` has more than one entry:

- Each canvas's `.meta.json.designSystem` field names which DS that canvas was built against (kebab-case slug, matches `designSystems[].name`).
- The skill loads **only that DS**, not all of them. Tokens and rules don't blend across DSes — a marketing canvas built against `marketing` DS uses marketing tokens, period.
- Subagents (`design-critic`, `design-system-completeness-critic`, etc.) scope to the same DS by reading the canvas's meta first.
- If `.meta.json.designSystem` is missing on a canvas in a multi-DS project, treat it as a warning (canvas drift) and fall back to `defaultDesignSystem` while flagging the gap.

### What you must never do (READ flow)

- **Never invent tokens.** If a color, font, radius, or shadow isn't in the tokens CSS, ask the user before adding it.
- **Never mix tokens between DSes.** A canvas's DS is single-valued; don't blend.
- **Never silently restyle a canvas to a different aesthetic** — token-family violation is a hard-stop the design-stack critics flag as a blocker.

---

## Bootstrap flow (create / extend / re-bootstrap a DS)

### Pre-Flight (light)

Bootstrap-mode Pre-Flight is **minimal** — checks only hard deps + presence of skeleton config. Rich environment onboarding (soft dep hints, install offers, CLAUDE.md / .ai/ recommendations) is the responsibility of `/design:init` (which the bootstrap entry-point auto-invokes when needed).

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Hard deps (abort on miss)
NODE_OK=false; command -v node &>/dev/null && \
  [[ "$(node -v | sed 's/v//;s/\..*//')" -ge 20 ]] && NODE_OK=true
GIT_OK=false; git -C "$REPO_ROOT" rev-parse &>/dev/null && GIT_OK=true
[[ -w "$REPO_ROOT" ]] || WRITE_OK=false

# Skeleton config check — if missing, auto-invoke init first
if [[ ! -f "$REPO_ROOT/.design/config.json" ]]; then
  echo "→ .design/config.json missing. Running /design:init first…"
  # Slash command body auto-invokes /design:init; skill proceeds after it returns.
fi
```

Hard-stops: missing Node → abort with install hint; missing git → abort with `run git init first`; no write permission → abort.

### Discovery (Round 0 + Round 1 + Round 2 + Round 3 + confirm)

**Detect target first.**

- Read `<repo>/.design/config.json`. Compute `designRoot` (default `.design`).
- For `first-bootstrap`: check that `<designRoot>/system/` is empty (or `designSystems[]` is empty). **Name-resolution rule (Phase 19 / DDR-044):**
  - If user passed no `<name>` → default to literal `project`; record `name_source: "default"` in vision-brief.
  - If user passed `<name>` exactly equal to the repo basename (`basename(repo)` matches the slug) → warn: `You passed '<name>'; the conventional default for first-bootstrap is 'project' (auto-detected by /design:edit). Continue with '<name>'? [Y/n]`. Proceed on Y/enter. Record `name_source: "user"`.
  - Otherwise → honor `<name>`; record `name_source: "user"`.
  - Net effect: user-supplied names are NEVER silently overridden, AND the completeness-critic C2 dirname check reads `name_source` and skips the divergence flag when the user explicitly chose the name.
- For `additional-ds`: target dirname is the kebab-case slug of the user-provided name (`<name>`); always `name_source: "user"`.
- For `re-bootstrap`: target is the existing `system/<name>/` dir; refuse unless `--force`. Preserve the existing brief's `name_source` if present; default to `"user"` if absent (legacy briefs predating Phase 19).

> **3-stage architecture (DDR-033, 2026-05-20).** Discovery is split into three stages that move from **abstract to concrete** the way a designer would talk to a stakeholder: **Stage 1 — Vision (extract)** conversational free-text prompts; **Stage 2 — Research (synthesize)** the `ux-research-agent` consumes the rich vision-brief and returns recommendations with per-decision confidence; **Stage 3 — Refinement (decide)** the skill asks the user only where research is uncertain. **Zero hardcoded option ladders in Stage 3.** Pre-3-stage v1 (12 fixed Qs in 3 rounds) is archived at `_DISCOVERY-v1.md` for diff reference. The reasons for the rewrite are documented in DDR-033.

> **Hard rule — Stage 1 is plain prose, NOT AskUserQuestion.** The AskUserQuestion tool is a multi-choice picker (min 2 labeled options, auto-"Other" affordance always rendered as N+1 item — schema-enforced, no bypass). Stage 1 needs free-text capture with skip-per-prompt; the tool cannot deliver that UX. Skill emits one chat message per batch with numbered prompts; user replies in one chat message with `1. … 2. …` headings. Parser splits on the heading boundary. See DDR-033 + DF-4 / DF-7 / DF-8 in the plan for the deep research that ruled this in. **Stage 0 + Stage 3 use AskUserQuestion** (4 concrete picks each, with auto-"Other" for overrides).

> **Tool-availability check (Phase 19 / DDR-044).** Before Stage 0 fires, probe `AskUserQuestion` with a single trivial question (e.g. confirm bootstrap mode). On `InputValidationError`, permission denial, or "don't-ask mode" rejection, **switch Stage 0 + Stage 3 to numbered-prose mode** for the remainder of the session. Stage 1 is unaffected (already prose-only). Do NOT hard-depend on AskUserQuestion — the dev-server-bootstrap retro (2026-05-25) hit this exact failure and the flow only survived because the agent improvised. Codify the fallback so it isn't tribal knowledge.
>
> **Numbered-prose fallback shape** — emit one chat message of the form below, then await a single reply containing `1. <answer>` lines. Parser is the same split-on-heading logic Stage 1 already uses.
>
> Stage 0 fallback (single Q, single answer):
>
> ```
> AskUserQuestion is unavailable in this session — answering via chat instead.
>
> Co je tohle za projekt?
>   1. Produkt pro veřejnost  — chceš oslovit externí lidi, zákazníky, širší komunitu
>   2. Interní nástroj         — pro tebe a tvůj tým nebo firmu, audience zná kontext
>   3. Osobní projekt          — pro sebe, portfolio, vlastní tool, experiment
>   4. Open-source knihovna    — pro vývojáře co tvůj kód budou používat
>
> Reply with: 1 / 2 / 3 / 4 (or paste your own answer).
> ```
>
> Stage 3 fallback (N Qs in one batch, each with N labeled options):
>
> ```
> AskUserQuestion is unavailable — answering Stage 3 via chat. One reply, format:
>   1. <choice for Q1>
>   2. <choice for Q2>
>   …
>
> Q1. <prompt from research recommendations>
>   a) <option 1>
>   b) <option 2>
>   c) <option 3>
>   d) <option 4>
>
> Q2. …
> ```
>
> Default to letter codes (`a/b/c/d`) for the per-Q options so the heading split on `1. / 2. / …` stays unambiguous.

#### Stage 0 — Scope gate (one AskUserQuestion, only hardcoded choice in the whole flow)

One single-select picker captured BEFORE Stage 1. The answer steers wording in Stage 1, the aspiration target the signature-moment-critic checks against post-scaffold, and the voice register defaults — but is **invisible in the UI as internal scoring jargon**. The user sees plain language about who will use the thing (DF-5).

```
Co je tohle za projekt?
  ○ Produkt pro veřejnost  — chceš oslovit externí lidi, zákazníky, širší komunitu
  ○ Interní nástroj         — pro tebe a tvůj tým nebo firmu, audience zná kontext
  ○ Osobní projekt          — pro sebe, portfolio, vlastní tool, experiment
  ○ Open-source knihovna    — pro vývojáře co tvůj kód budou používat
```

(AskUserQuestion hard schema: max 4 options per Q — DF-1. "Osobní projekt" + "Research" are merged on purpose so the picker fits the 4-option ceiling.)

Internal mapping (NOT surfaced to user):

| Scope | Stage 1 voice | Aspiration target (signature-moment-critic) | Default voice register |
|---|---|---|---|
| `market` (Produkt pro veřejnost) | "vaše značka / tvůj produkt" | **≥ 4.0/5** | researched per audience |
| `internal` (Interní nástroj) | "tvůj DS / tvůj tool" | ≥ 3.5/5 | terse |
| `personal` (Osobní projekt) | "tvůj DS / pro tebe" | 3.0–4.0/5 (per ambition) | user's own voice |
| `oss` (Open-source knihovna) | "tvoje knihovna" | **≥ 4.0/5** | researched per audience |

#### Stage 1 — Vision (11 conversational free-text prompts, 3 batches, plain prose)

**Principle:** small steps, plain language, every prompt carries an example, `skip` is always a valid answer. Pastier's chapters (Zrcadlo · Facka · Ulice · Kmen · Zkratka · Charakter · OST) live in the **internal comment** beside each prompt — the user never sees the Pastier vocabulary, only a human question with a concrete example.

**Pattern per batch — emit one chat message with the batch heading + numbered prompts + examples; user replies in one chat message with `1. … 2. …` headings or `skip` per item. Parser splits on `**N. …**` boundary or `\nN. ` numbered list; trim, strip example artifacts, identify `skip` markers (case-insensitive, also `ne`, `nevím`, `—`).** Validated end-to-end in plan dogfood DF-8.

```
─── Batch 1/3 — PŘÍPRAVA (kdo a proč, 4 prompts) ──────────────────

Odpověz v jednom message. Napiš `skip` u jakékoli otázky kterou chceš přeskočit.

**1. Co tenhle projekt je?** Napiš 1–2 věty, jako bys to říkal kamarádovi.
   *Příklad: „Je to recept manager kde si můžeš nastavit počet porcí
   a on přepočítá ingredience."* Nemusí to znít cool, normální slova jsou OK.
   (interní: Pastier — Zkratka)

**2. Co by udělalo tenhle DS úspěchem v TVÝCH očích?**
   Tady jde o tebe, ne o uživatele. Na čem by sis dal záležet?
   *Příklad: „Aby každá obrazovka vypadala jako z časopisu",
   „Aby to bylo rychlé a nepřekáželo to", „Aby se mi to líbilo i za 5 let".*
   (interní: Pastier — Zrcadlo, část 1)

**3. Je něco, na čem si zakládáš a chceš, aby to bylo cítit i v DS?**
   *Příklad: „Vždycky perfekcionismus na detailech",
   „Pohoda nad formálností", „Žádné prázdné buzzwords".*
   Klidně přeskoč, pokud nevíš.
   (interní: Pastier — Zrcadlo, část 2)

**4. Naopak — co bys NIKDY nechtěl, aby DS vypadal?**
   Co tě v jiných projektech / DSes vyloženě irituje? Klidně napiš
   konkrétní jména produktů kterým se chceš VYHNOUT. (Tohle pomůže
   research agentovi víc než pozitivní reference.)
   (interní: Pastier — Facka)

─── Batch 2/3 — PROSTOR (kde to žije, 3 prompts) ──────────────────

**5. V jakém vizuálním prostoru tenhle projekt žije?**
   Nemusí to být přímí konkurenti — stačí říct, k jaké tradici se hlásíš.
   *Příklad: „terminal tools jako Linear / Vercel",
   „editorial jako Stripe docs", „hand-drawn jako Notion early days",
   „retro arcade jako itch.io".* „Nevím, podívej se a doporuč mi" je
   validní — research agent to udělá.
   (interní: Pastier — Ulice, část 1: design lineage)

**6. A naopak — co je z toho prostoru OTŘEPANÉ, čeho už je všude moc?**
   Co bys NECHTĚL zopakovat?
   *Příklad: „purple-pink gradient hero", „bento grid landing pages",
   „glass-morphism cards", „stock photos s ‚happy team meeting'".*
   (interní: Pastier — Ulice, část 2: anti-references)

**7. Pro koho to děláš?** Klidně „jen pro sebe" je validní odpověď.
   Pokud jsou to jiní lidé — co o nich asi víš?
   *Příklad: „Jen pro sebe, je to portfolio", „Pro 5 lidí v týmu
   co používají dashboardy denně", „Pro vývojáře co staví na PostgreSQL".*
   (interní: Pastier — Kmen)

─── Batch 3/3 — DUŠE (jak má působit, 4 prompts) ──────────────────

**8. Když to někdo poprvé vidí — jakou JEDNU emoci by měl odejít?**
   *Příklad: klid · údiv · soustředění · hravost · autorita ·
   „cítím se chytrý" · radost · pocit „to je řemeslo" · respekt.*
   Vyber jedno slovo, klidně své vlastní.
   (interní: Pastier — Charakter, část 1: primární emoce)

**9. A jaký pocit by měl mít z TEBE jako z autora?**
   *Příklad: „profík v oboru", „hravý experimentátor",
   „klidný řemeslník", „někdo kdo ví co dělá ale nepyšní se tím".*
   Můžeš přeskočit pokud je DS impersonální (např. interní nástroj).
   (interní: Pastier — Charakter, část 2: autor)

**10. Existuje něco jednoho, čím by ses chtěl odlišit?**
    Jedna věc, díky které lidi řeknou „jo to je [tvůj projekt]"?
    *Příklad: „naše signature žlutá", „CRT motion na všech přechodech",
    „mascot ježek v rohu", „typografie jak ve starých knihách",
    „nezvyklý layout pattern".* „Nevím, doporuč mi něco" je perfektně
    OK — research ti potom dá návrhy a ty z nich vybereš.
    (interní: Pastier — OST, část 1: signature claim)

**11. A naopak — co určitě NEMÁ být tvůj signature?**
    Co je „taková obyčejná default věc" a nechceš to za signature mít?
    *Příklad: „určitě ne barva, ta je obyčejná",
    „určitě ne font, neumím to ohlídat".*
    Klidně přeskoč pokud nemáš názor.
    (interní: Pastier — OST, část 2)
```

**After P11, synthesize the inputs into `vision-brief.json`** at `<designRoot>/_history/_system/<ds>-vision-brief.json`:

```json
{
  "name": "<DS slug — same as system/<name>/ dirname>",
  "name_source": "user | default",
  "scope": "<from Stage 0: market | internal | personal | oss>",
  "elevator_pitch": "<P1>",
  "success_essay": "<P2>",
  "values": "<P3 — may be null>",
  "anti_aesthetics": "<P4>",
  "design_lineage": "<P5 — may be 'research, surprise me'>",
  "tired_tropes_to_avoid": "<P6>",
  "audience": "<P7>",
  "primary_emotion": "<P8>",
  "author_voice": "<P9 — may be null>",
  "ds_signature_hypothesis": "<P10 — may be 'no preference'>",
  "ds_signature_anti": "<P11 — may be null>",
  "_pastier_chapter_coverage": {
    "zrcadlo": ["P2", "P3"],
    "facka":   ["P4", "P6"],
    "ulice":   ["P5", "P6"],
    "kmen":    ["P7"],
    "zkratka": ["P1"],
    "charakter": ["P8", "P9"],
    "ost":     ["P10", "P11"]
  }
}
```

`_pastier_chapter_coverage` is an internal audit field — QA that every Pastier chapter in scope has a source prompt.

`name_source` is added by the Detect-target step (above) — `"user"` when the user passed `<name>` explicitly, `"default"` when first-bootstrap auto-applied `project`. The completeness-critic's C2 (dirname convention) reads this field; user-supplied names do not trigger the C2 warning. Phase 19 / DDR-044. Legacy briefs predating Phase 19 lack the field — readers MUST default to `"user"` (treat as explicit, do not flag).

**`<brief>` argument shortcut.** If `/design:setup-ds <name> "<rich brief>"` was invoked with a paragraph that covers some of P1 / P5 / P10 inline, pre-fill those vision-brief fields from the brief and **skip the corresponding Stage 1 prompts** — print a one-line `→ Skipping P5 (covered in brief: "<excerpt>")` per skipped prompt so the user can correct if the heuristic misfired. Stages 2 + 3 always run regardless.

#### Stage 2 — Research (no user input, ~30–90s wall-clock)

The `design:ux-research-agent` is spawned via the `Agent` tool with `subagent_type: "design:ux-research-agent"` and **receives the full `vision-brief.json` as input** (the v1 flow only passed a one-liner — DDR-033 + DF-9 prove the rich brief is the single biggest aesthetic-quality lift). Inputs:

```
brief:           <vision-brief.json contents — entire object, not just elevator_pitch>
caller:          "setup-ds"
mode:            "discovery"
context_paths:
  vision_brief:        <abs path to <ds>-vision-brief.json>
  existing_ds_tokens:  <abs path or empty>
  existing_ds_readme:  <abs path or empty>
  cached_payload:      <abs path to <ds>-<BRIEF_SHA8>-domain-research-discovery.json — if exists>
output_path:     <designRoot>/_history/_system/<ds>-<BRIEF_SHA8>-domain-research-discovery.json
researched_at:   <current ISO date>
```

`BRIEF_SHA8 = printf '%s' "$(cat <vision-brief.json>)" | shasum -a 256 | cut -c1-8`. Exact hash match for cache reuse; `--force` always re-researches.

The agent's prompt has been extended with **5 Pastier probe templates** (`A. Ulice / B. Zrcadlo + Charakter / C. OST / D. Kmen / E. Confidence evaluation`) — see `_pastier-probe-templates.md` in this folder. The probes structure the WebSearch queries against the vision-brief fields. The agent's response payload extends the existing `discovery` schema with a new `recommendations` block:

```jsonc
{
  /* … existing fields (mood_clusters, color_oklch_options, …) … */
  "recommendations": {
    "palette": {
      "recommendation": { /* primary OKLCH option */ },
      "alternatives":   [ /* 2 OKLCH options */ ],
      "confidence":     0.85,
      "rationale":      "Tvoje primary_emotion='klid' + design_lineage='editorial Stripe docs' nasvědčuje L 58-65, C 0.08-0.12, H 200-240. Anchor: Stripe docs accent, Vercel docs hover."
    },
    "typography":          { /* same shape */ },
    "signature_treatment": { /* same shape */ },
    "majak_3_codes": {
      "recommendation": ["barva", "font", "motion"],
      "alternatives":   [["symbol", "barva", "voice"], ["font", "tvar", "vzor"]],
      "confidence":     0.7,
      "rationale":      "OST hypotéza 'CRT motion' → motion je code. Lineage editorial → font je code. Třetí code 'barva' protože scope=osobní a chceš výrazné rozpoznání."
    },
    "density": { /* same shape */ },
    "voice":   { /* same shape */ }
  }
}
```

Confidence semantics: `≥ 0.85` strong consensus, `0.60–0.85` mid (vision-brief is specific OR research found consensus, but not both), `< 0.60` low (vague brief + thin or conflicting research), `null` no payload (agent failed).

**Failure handling — NO degradation to hardcoded ladders.** If the agent fails (no payload file written), flow **STOPS** and surfaces:

```
Research nedoběhl. Můžeš:
  ○ Popsat Stage 1 víc do hloubky (vrátit se na P1)
  ○ Zkusit znovu za chvíli (transient WebSearch error)
  ○ Ukončit a vrátit se k tomu později
```

The v1 hardcoded option pools are deleted — they were the bias source DDR-033 exists to eliminate (see archived `_DISCOVERY-v1.md` for the v1 reference).

#### Stage 3 — Refinement (adaptive, 0–N Qs by confidence)

For each decision in `recommendations`:

| Confidence | Behavior |
|---|---|
| **≥ 0.85** | **Skip Q.** Surface only in the final 3-sentence confirm. |
| **0.60–0.85** | **1 Q with pre-pick.** Recommended option is first; 2 alternatives from `alternatives[]`; auto-"Other" affordance for user-written override; one option labeled `skip (keep recommendation)`. |
| **< 0.60** | **1 Q without pre-pick.** 3 alternatives (research's top 3) with `recommended` flag on the first; auto-"Other" for user-written. |

Counts observed in dogfood (DF-10, DF-11):

- **Ideal** (rich vision-brief + strong consensus): 0–2 Qs total.
- **Typical**: 4–6 Qs.
- **Worst** (vague vision + niche domain): 8–10 Qs.

Stage 3 batches the active Qs into AskUserQuestion calls **of up to 4 Qs each** (DF-2 — schema max). So a typical 4–6-Q Stage 3 is one or two batches.

**No hardcoded option pools.** If `alternatives[]` is empty for a decision (research found nothing), skill **skips the Q** and asks free-text in the next chat message: `"Research nedoporučuje konkrétní směr pro [X]. Napiš co bys chtěl, nebo nechám default tokens."`

**Maják 3-code is always a Stage 3 Q** (never Stage 1) — it's a concrete design decision that depends on OST hypothesis + lineage research. Question shape:

```
Research mi doporučuje, aby SIGNATURE tohohle DS stál na 3 kódech:
  → <code1> (<concrete value 1>), <code2> (<concrete value 2>), <code3> (<concrete value 3>)

Důvod: <one sentence — vazba na OST hypothesis + lineage research>

  ○ Tahle trojka je dobrá, jdeme dál        (Recommended)
  ○ Vyměnit jeden kód                       (open-text follow-up which one + which alternative)
  ○ Vyměnit všechny 3                       (open-text follow-up custom trio)
  ○ Vyber mi je sám podle vision-brief      (skill picks within research consensus)
```

The 9 Pastier codes are `barva · font · symbol · tvar · vzor · motion · zvuk · voice · charakter`. Of those, `zvuk` and `charakter` are domain-rare; the typical 3-code recommendation draws from the other 7.

#### Confirm (1 chat message, no Q)

After Stage 3 the skill prints a **3-sentence summary** — one sentence per stage:

```
Vision:     <2-line synth of vision-brief>
Research:   <3 key anchors from payload + 3-code Maják pick>
Refinement: <what user changed vs what was left on recommendation>

Pokračovat? (y / něco upravit)
```

On `něco upravit` return to Stage 3 (NOT Stage 1, unless user explicitly says `začni od začátku`).

#### `additional-ds` adaptation

Same 3 stages, with two added inputs:

- **Pre-Stage 0:** `Q_purpose` (one prose prompt) — "Co je tohle za DS, jiné než tvůj existující DS `<existing-ds>`?" The answer is folded into vision-brief as `elevator_pitch`; the existing DS's vision-brief (if present) is shown as context but does NOT inherit.
- **Between Stage 2 and Stage 3:** `INHERITANCE PICKER` (multi-select AskUserQuestion, position load-bearing per studio-2 retro BAD-7 — picker before Stage 3 prevents Stage 3 answers from being silently overridden by inheritance).

```
Inherit from <existing-ds>? (multi-select; "None" = define fresh)
  [x] Typography (font_display, font_body, font_mono)
  [ ] Voice / content tone
  [ ] Iconography family
  [x] Motion durations
  [ ] None
```

Inherited values are pre-baked into the new DS's `colors_and_type.css`; the corresponding `recommendations` entries in the research payload are silenced (no Stage 3 Q on inherited fields, regardless of confidence).

#### `re-bootstrap` adaptation

For an existing DS without a `vision-brief.json` (DSes scaffolded before DDR-033 don't carry one):

1. **Lossy inference.** Read `system/<ds>/README.md` "What this DS is for" line, `colors_and_type.css` (palette + type families), `_layout.css` (signature treatment family). Produce a draft `vision-brief.json` with `_inferred: true` on every field. Confidence is intentionally low on character / OST / lineage fields (no source in tokens for those).
2. **Stage 1 confirm pass.** Show the inferred vision-brief to the user in plain prose: `"Tady je co jsem si přečetl z tvého stávajícího DS. Oprav / doplň cokoli, nebo napiš 'OK' pro pokračování."` User edits in one chat message; parser updates fields.
3. **Stage 2 ALWAYS re-runs.** `--force` implies time has passed; cached payload is stale by definition.
4. **Stage 3 + Confirm** identical to first-bootstrap.

#### Post-scaffold gate — "4 kola značky"

After scaffold, the aesthetic / structural critic panel is grouped under three Pastier-flavored headers (rename only — critic agents themselves are unchanged):

| Kolo (Pastier) | Critic agents | What it asks |
|---|---|---|
| **Kolo 1 — Srozumitelnost** | `design-system-completeness-critic` + `a11y-auditor` | Lze tomu rozumět? Drží to standardy? |
| **Kolo 2 — Atraktivita** | `graphic-design-critic` + `signature-moment-critic` | Rezonuje to vizuálně? Má to moment? |
| **Kolo 3 — Konzistence** | `typography-critic` + `brand-critic` + `copy-critic` | Drží to spolu? Voice + visual + naming sedí? |

Pastier's fourth kolo (Frekvence — marketing reach) is intentionally dropped — outside the DS surface. The actual critic-panel execution + reporting block uses these labels; see "Aesthetic critic panel (mandatory)" and "Always-print next steps" sections below.

### Mapping → file set

**Consult `_MAPPING.md`** at `plugins/design/templates/design-system-inspiration/_MAPPING.md` (the contract for which files to scaffold). Compute the file set based on Q2 (audience) / Q3 (platforms) / Q4 (theme), and bake Q1 / Q5 / Q6 / Q7 / Q8 into the content of every generated file.

Compute `activeFamilies[]`:

- `accent` — always
- `status` — always unless project explicitly opts out (rare)
- `presence` — IF audience = pro tool AND Q1 mentions multiplayer / live / collab
- `mono` — IF audience = developer tool, OR Q7 includes a monospace pairing

### Accent color heuristic (Q6 "pick for me")

When the user lets the skill pick the OKLCH accent, **read the mood cues in Q1 + Q5 + Q6 label before picking lightness**:

| Mood cue | Target L | Target C | Notes |
|---|---|---|---|
| "burnt", "lava", "warm", "hedgehog", "amber", "rust", "fire" | **L 60–66** | C 0.16–0.20 | Saturated but not bright — reads as deep, not candy |
| "electric", "vibrant", "neon", "highlighter" | L 72–80 | C 0.18–0.24 | Bright, sits forward on dark |
| "muted", "earthy", "natural", "stone" | L 55–62 | C 0.08–0.13 | Low chroma; reads quiet |
| "pastel", "soft", "creamy" | L 75–85 | C 0.08–0.12 | High L, low C |
| default (no mood cue) | L 68–72 | C 0.14–0.18 | Mid-range, "tasteful default" |

**Why this exists:** picking accent OKLCH from mood cues alone (without checking lightness for the cue) is a known failure mode — e.g. "burnt / lava / warm" briefs default to high-L oranges that render as candy / pumpkin rather than the deep, technical warmth the mood word implied. Always **screenshot the accent in context** (step 7 below) before declaring the color final.

### Namespace + parameterization patterns (when to use)

The reference templates use a `.app` root class on `<body>` for namespacing. Two patterns the skill can opt into for richer DSes:

**1. `.{project-slug}` root scoping (dugmate-style).** When the DS is meant to be **reusable across multiple host apps** (e.g. embedded as a widget, shared across a monorepo, or shipped as a standalone CSS bundle), scope every selector under a project-named class:

```css
.dugmate          { /* base reset + body font */ }
.dugmate h1, .dugmate h2 { font-family: var(--font-display); }
.dugmate .btn--primary  { background: var(--accent); }
```

This prevents token leakage when the DS coexists with another design system on the same page. The trade-off: every selector gains a prefix, and consumers must wrap their app in `<div class="dugmate">`. Set `config.json.rootClass` to the project slug if you opt in.

**Default:** single-DS projects use `class="app"` — simple, no prefix needed.

**2. `[data-team="<accent-variant>"]` retint (dugmate-style team accents).** When the DS supports **multiple branded variants** (per-team color in a sports app, per-tenant color in B2B, per-product color in a portfolio), declare each variant as an attribute selector that overrides the accent family:

```css
[data-team="cyan"]    { --accent: oklch(72% 0.16 220); --accent-hover: oklch(68% 0.16 220); --accent-fg: oklch(14% 0.04 220); }
[data-team="emerald"] { --accent: oklch(70% 0.16 150); --accent-hover: oklch(66% 0.16 150); --accent-fg: oklch(14% 0.04 150); }
```

This pattern overrides the `--accent*` family per-tenant — compatible with any declared `accentStrategy` (the family count from config.json is preserved, only its hue values change per `data-team`). The `platform-desktop/ui_kits-desktop-showcase.tsx` reference template includes an accent picker that flips `data-team` on `<html>`.

**Default:** skip this section unless the discovery brief explicitly mentions "per-team", "per-tenant", or "multi-brand". Most DSes don't need it.

**3. `[data-theme="dark|light"]` parameterization.** Always emit at least `[data-theme="dark"]` (or `[data-theme="light"]`, whichever is the default). When `config.json.themeDefault == "both"`, emit both blocks with identical token shapes but different surface/text values. The completeness-critic V18 enforces this.

### Pre-scaffold — real-asset sweep + claim scan + emit `_scaffold-roster.yaml`

**Step 0 — Real-asset sweep (mandatory; closes D-2 from the imprint retro).** Before ANY placeholder asset gets written in Batch A, grep the target repo for production sources of brand assets. The cost is < 1 s on a 20k-file monorepo, < 2 s on 50k-file. The cost of NOT running it (placeholder bleed into Batch C sub-agent prompts; user catching the made-up "S" SVG mid-flow) is one full fix-pass.

```bash
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/asset-sweep.sh" \
  --root "$CLAUDE_PROJECT_DIR" \
  --query "logo,mark,wordmark,mascot,glyph,illustration"
```

The helper emits one JSON object — keys = nouns, values = repo-relative paths (sorted, deduped). For each noun:

| Hits | Action |
| --- | --- |
| **Exactly 1** at a conventional path (e.g. `packages/ui/.../logo/`, `frontend/.../public/logo.svg`) | Copy the asset 1:1 into `<designRoot>/system/<ds>/assets/<noun>/`. Record the source path in the roster's `assets:` block so Batch C sub-agents reference the real asset, not a placeholder. |
| **Exactly 1** at a non-conventional path | Treat as 1-hit but post a 1-line "auto-picked <path> for <noun>" so the user can correct. |
| **Multiple hits** | `AskUserQuestion` with each hit as an option ("Use <path> as the canonical <noun>?" / "None — author placeholder"). Default = the first hit at the most conventional-looking path. |
| **Zero hits** | Placeholder authorship is permitted. The placeholder filename MUST end `-placeholder.svg` so it's visually obvious in greps (e.g. `assets/logo/logo-placeholder.svg`). Roster's `assets:` block records `source: placeholder`. |

The substring-match policy is documented in `asset-sweep.sh --help`: noun matches case-insensitively against basename OR parent directory segment, with `-maxdepth 6` and standard build/vendor excludes (`node_modules/`, `.git/`, `.design/_history/`, `.next/`, `dist/`, `build/`, `coverage/`, `.turbo/`, `.cache/`). False-positive bleed across overlapping nouns (e.g. `mark` substring-matching `Wordmark.svg`) is resolved at the AskUserQuestion step — the agent does NOT auto-pick when multiple nouns claim the same file.

**Step 1 — Claim scan (mandatory before roster).** Read the draft README + SKILL.md you're about to author for this DS. `grep` the prose for these substrings: `mascot`, `glyph`, `logotype`, `wordmark`, `illustration`, `hedgehog`, `character`, `mark`. For every match, ensure the receiving file (logo.tsx for wordmark/mark, ≥1 `assets/glyphs/*.svg` for glyph, etc.) is **listed as a `pending` row in the roster you're about to emit**. See `_MAPPING.md` "Claim → receipt" for the canonical claim→file table. This pre-emission scan is what prevents the `assets/glyphs/` empty-directory regression the studio-2 retro flagged (BAD-4). **Cross-reference with Step 0:** for every claim where the sweep returned a hit, the corresponding roster row's `source:` field flags the real-asset copy (so downstream sub-agents don't re-invent).

**Step 2 — Emit `_scaffold-roster.yaml`.** The main agent writes the roster to `<designRoot>/_history/_system/<ds>-000-scaffold-roster.yaml`. The roster lists every file the scaffold will produce, plus its dependency closure and batch assignment. **The roster is the contract.** Sub-agents write their slice, then update `status: written` (with a `loc: <N>` field) on each row. Main agent reconciles at the end — any row stuck in `pending` is a regression flag.

**Roster mutation rule.** Sub-agents may ONLY flip existing rows' `status` and add `loc`. They MUST NOT add new rows. If a sub-agent discovers a missing claim during its slice (e.g. wordmark referenced but no logo.tsx in roster), it returns the gap as a one-line note in its completion message; the main agent adds the row in the next reconcile pass. This rule prevents the silent contract-drift the studio-2 retro caught (BAD-1).

```yaml
# 000-scaffold-roster.yaml — emitted before scaffold; sub-agents update status as they write
discovery:
  product: "{{Q1 product one-liner}}"
  audience: "{{Q2}}"
  platforms: ["{{Q3}}"]
  theme_default: "{{Q4}}"
  mood: "{{Q5}}"
  accent_oklch: "{{Q6 → computed OKLCH}}"
  typography: "{{Q7}}"
  voice: "{{Q8}}"
  signature_treatment: "{{Q9}}"
  hard_nos: ["{{Q10 picks}}"]
  iconography_vibe: "{{Q11}}"
  density: "{{Q12}}"
  # Discovery-driven values for bias-free template rendering (DDR-026, 2026-05-25).
  # Derived from the answers above OR captured as follow-up batches when Stage 3
  # implies them. The agent MUST fill every field — there are no template
  # defaults to fall back on; an unsubstituted `{{placeholder}}` leaks as a
  # literal into the rendered tokens CSS.
  accent_strategy:    "{{single | paired | chromatic-3 | chromatic-N}}"   # default: single
  color_space:        "{{oklch | hsl | hex | lab}}"                       # default: oklch
  spacing_base:       "{{4 | 8 | golden | fluid-vh}}"                     # default: 4 if Q12 dense; 8 if Q12 roomy
  type_base_px:       "{{14 | 15 | 16 | 18}}"                             # default: 14 if Q12 dense; 16 if Q12 roomy
  type_ratio:         "{{1.067 | 1.125 | 1.200 | 1.250 | 1.333 | 1.500}}" # default: 1.200; 1.125 if dense; 1.333 if editorial
  ease_out_curve:     "{{cubic-bezier(…) | linear() | spring}}"           # researched per Q9; no universal default
  ease_in_out_curve:  "{{cubic-bezier(…) | linear() | spring}}"           # researched per Q9; no universal default
  layout_max_w:       "{{1200px | 1280px | 1440px | none | column-based}}" # default: 1200 if Q3 desktop-only; none if Q3 mobile-first
  layout_gutter:      "{{var(--space-4) | var(--space-5) | …}}"           # default: var(--space-4)
  shadow_strategy:    "{{soft | hard | none | inset | accent-tinted}}"    # default: soft; none if Q9 brutalism
  border_strategy:    "{{relative-from-bg | fixed-token | inline-from-fg | hairline-mono}}"  # default: relative-from-bg
  touch_target_min:   "{{44 | 48 | desktop-na}}"                          # computed: iOS=44, Android=48, desktop-only=desktop-na
  radii_personality:  "{{sharp | mild | soft | pill-heavy | mixed}}"      # default: mild; sharp if Q9 brutalism
round_0_research:
  payload_path: "{{abs path to <ds>-domain-research-discovery.json}}"
  fallback_used: {{bool from payload}}
  reference_products_picked_as_mood_anchors: ["{{anchor1}}", "{{anchor2}}", "{{anchor3}}"]   # the 3 anchors from the user's Q5 cluster pick — passed to Batch C sub-agents as gold-standards
files:
  # Batch A — main agent writes serially (tokens are the dependency root)
  - { path: "colors_and_type.css",       batch: A, deps: [], status: pending }
  - { path: "README.md",                 batch: A, deps: [tokens], status: pending }
  - { path: "SKILL.md",                  batch: A, deps: [tokens], status: pending }
  - { path: "preview/_layout.css",       batch: A, deps: [tokens, Q9], status: pending }  # signature treatment lives here
  - { path: "../../README.md",           batch: A, deps: [], status: pending }            # designRoot orchestration README
  - { path: "../../INDEX.md",            batch: A, deps: [], status: pending }
  - { path: "../../config.json",         batch: A, deps: [], status: pending }
  # Batch B — fan out (token-only specimens; depend only on tokens + chrome)
  - { path: "preview/colors-text.tsx",      batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/colors-surfaces.tsx",  batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/colors-accent.tsx",    batch: B, deps: [tokens, chrome],          status: pending, signature: true }
  - { path: "preview/type-scale.tsx",       batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/spacing-scale.tsx",    batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/motion.tsx",           batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/radii.tsx",            batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/elevation.tsx",        batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/focus.tsx",            batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/iconography.tsx",      batch: B, deps: [tokens, chrome, Q11],     status: pending }
  - { path: "preview/borders.tsx",          batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/grid.tsx",             batch: B, deps: [tokens, chrome, Q3],      status: pending }
  - { path: "preview/opacity.tsx",          batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/selection.tsx",        batch: B, deps: [tokens, chrome],          status: pending }
  # Batch C — fan out (components + compositions; depend on tokens + chrome + reference template)
  - { path: "preview/components-buttons.tsx",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-cards.tsx",        batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-inputs.tsx",       batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-toggles.tsx",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-dialogs.tsx",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-tooltips.tsx",     batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-tables.tsx",       batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-callout.tsx",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/empty-state.tsx",             batch: C, deps: [tokens, chrome, template], status: pending, signature: true }
  - { path: "preview/logo.tsx",                    batch: C, deps: [tokens, chrome, assets], status: pending, signature: true }
  # … gated entries appended based on Q2/Q3 (audience-pro/*, audience-developer/*, status/*, presence, etc.)
  # … always ends with the highest-leverage composition:
  - { path: "preview/ui_kits-desktop-showcase.tsx", batch: C, deps: [tokens, chrome, template, ALL], status: pending, signature: true }
  - { path: "preview/ui_kits-desktop-index.tsx",    batch: C, deps: [ALL specimens written], status: pending }   # written LAST so it can link to peers
# Batch B fan-out groups — sub-agents claim these slices
fanout:
  - { batch: B, slice: "color tokens",        files: [colors-text, colors-surfaces, colors-accent] }
  - { batch: B, slice: "type + spacing",      files: [type-scale, spacing-scale] }
  - { batch: B, slice: "motion + foundations a", files: [motion, radii, elevation, focus] }
  - { batch: B, slice: "foundations b",       files: [iconography, borders, grid, opacity, selection] }
  - { batch: C, slice: "core components",     files: [components-buttons, components-cards, components-inputs] }
  - { batch: C, slice: "universal a",         files: [components-toggles, components-dialogs, components-tooltips] }
  - { batch: C, slice: "universal b",         files: [components-tables, components-callout] }
  - { batch: C, slice: "brand + voice",       files: [empty-state, logo] }
  - { batch: C, slice: "audience-pro",        files: [components-command-palette, components-shortcuts-overlay, …] }   # only if Q2 = pro
  # … plus other gated slices
```

Reconciliation rule: after Batch C completes, the main agent reads the roster, asserts every row is `written`, and rejects the bootstrap as incomplete otherwise. The `ui_kits-*-index.tsx` is always last because it links every peer — written after the rest by the main agent, not a sub-agent.

### Scaffold (3-batch fan-out)

The inspiration library at `plugins/design/templates/design-system-inspiration/` has **11 category dirs** holding **~67 reference HTML specimens**. The skill walks the categories, picks files matching the project profile, and **GENERATES** project-flavored versions in `system/<ds>/preview/`. **Scaffold output is flat** — category prefixes live only in the library; the scaffolded files all land directly under `preview/`. See `_MAPPING.md` for the full inventory, gating rules, and the `dependency_closure` column that drives batching.

**Scaffold is fan-out work, not serial work.** Independent file writes are pure leaves of a DAG: every specimen depends only on `colors_and_type.css` + `_layout.css` (chrome) + zero or one reference template. Serial scaffold of 25–30 specimens in the main agent burns context and produces quality drift (early specimens get full creative attention; late specimens get token-swapped). Fan-out fixes both: 5–8 sub-agents in parallel, each with a fresh attention budget per specimen slice.

#### Batch A — main agent writes serially

The dependency root. Main agent writes these **in order, alone** because every later file imports them.

> **Canvas-lib note (DDR-025):** Per Phase 4.0.5 canvas-lib ships with the dev-server install at `plugins/design/dev-server/canvas-lib.tsx`. Bootstrap **does not** scaffold a project-side copy — the virtual specifier `@maude/canvas-lib` resolves directly at canvas build time. UI mock canvases keep importing `DesignCanvas` / `DCSection` / `DCArtboard` from `@maude/canvas-lib` without any per-project setup.

1. `colors_and_type.css` — tokens. Substitute discovery values (accent OKLCH, fonts, density-derived `--space-*` defaults, Q9-derived shadow/treatment tokens like `--shadow-glow` or `--scanline-alpha`).
2. `<designRoot>/system/<ds>/preview/_layout.css` — chrome. **Bakes Q9 signature treatment into the body background + h1 treatment.** Examples:
   - Q9 = `gradient discipline` → soft accent halo at top-right, light vignette at bottom
   - Q9 = `CRT scanlines + phosphor glow` → repeating-linear-gradient scanlines + h1 text-shadow with accent glow + body::before SVG film-grain + body::after CRT roll animation (reduced-motion safe)
   - Q9 = `glassmorphism` → backdrop-filter blur on cards; `.specimen` gets a faint frosted backdrop
   - Q9 = `brutalism` → no shadows at all; thick `--border-strong` outlines; sharp corners override on key elements
   - Q9 = `soft-shadow depth ladder` → richer `--shadow-md/lg` with longer offsets; cards float higher
   - The treatment is **the project's first impression** — every specimen inherits it via `_layout.css`.
3. **`<designRoot>/system/<ds>/preview/_components.css`** — shared component anatomy. **Emit when Q9 family ≠ `none` AND the signature treatment repeats across 3+ components** (typical: a bevel pattern on button + tile + segmented + switch; a recessed-bay pattern on input + checkbox + radio). Promotes `.btn`, `.tile`, `.input`, `.switch`, `.seg`, `.pill`, etc. out of per-specimen `<style>` blocks into one authoritative file. Specimens then carry only their demonstration-specific CSS inline. **Skip** when Q9 family = `none` AND Q12 family = `roomy` — inline styles are fine and `_components.css` adds noise. Sub-agents in Batch C MUST receive this file (when present) as part of their reference bundle and reference its class names instead of re-implementing the anatomy.
4. `<designRoot>/system/<ds>/README.md` — philosophy (substitutes mood references + hard-NOs from Q10 + signature treatment summary + voice block).
5. `<designRoot>/system/<ds>/SKILL.md` — the per-DS skill pointer.
6. **`<designRoot>/README.md`** — designRoot orchestration README. **Mandatory Tier 1 file** per `_MAPPING.md`; missing this is the most common bootstrap blocker.
7. **`<designRoot>/INDEX.md`** — canvas + specimen index.
8. `<designRoot>/config.json` — per-repo plugin config with all 14 fields populated.

After Batch A writes, the main agent reads the freshly-written `colors_and_type.css` + `_layout.css` + `_components.css` (when emitted) back into context — those files are passed verbatim to every Batch B/C sub-agent as authoritative reference.

#### Batches B + C — parallel fan-out via sub-agents

Group the remaining files into **5–8 slices** (per the `fanout:` block of the roster). For each slice, spawn one `general-purpose` sub-agent. **Fire all slices in a single message** (multiple Agent tool calls in parallel) — that's the whole point.

**Sub-agent prompt template** (use verbatim, substitute the slice details):

```
You are scaffolding part of a design system. Write {{N}} specimen TSX files in
parallel with other sub-agents. Each file lands at the absolute path listed.

SHAPE — every specimen TSX is BARE — NO canvas-lib envelope. The shape:

  /** JSDoc header (see template) */
  import "./<slug>.css";  /* per-specimen bespoke CSS — sibling file */

  export default function <PascalName>() {
    return (
      <>
        <header className="specimen-hd">
          <span className="sku">MDCC-DSN/01.<slug></span>
          <span className="crumbs">...</span>
          <span className="theme-toggle" ...>...</span>
        </header>
        <main className="specimen">
          <section className="specimen-title">
            <h1>...</h1>
            <p className="lede">...</p>
          </section>
          {/* sections, h2 dividers, tables, etc. */}
        </main>
      </>
    );
  }

Specimens are FLOWING reference pages, not viewport mocks. Do NOT wrap in
`<DesignCanvas><DCSection><DCArtboard>` — `_layout.css` styles `<body>` as
a flex column directly. The original .html-era specimens had exactly this
shape; we keep it one-for-one in TSX.

Canvas-lib (`@maude/canvas-lib`) is reserved for UI mock canvases with
multiple fixed-px artboards (Docs Site, Canvas Viewport). Specimens do NOT
import it. Token/theme hooks (`useTokens`, `useTheme`) ARE available if a
specimen genuinely needs them — but bare CSS via `var(--*)` is the default.

Per-specimen bespoke CSS lives in a sibling `<slug>.css`. The dev-server's
canvas-build.ts collects this and injects it as a `<style>` at module init
so the drop is self-contained.

PROJECT
- name: {{project_label}}
- DS slug: {{ds_dirname}}
- one-liner: {{Q1}}
- audience: {{Q2}} · platforms: {{Q3}} · theme default: {{Q4}}
- voice: {{Q8}} ("{{voice_one_line_summary}}")
- signature treatment: {{Q9}} ({{Q9_one_line_summary}})
- hard NOs: {{Q10 csv}}
- iconography vibe: {{Q11}}
- density: {{Q12}}

REFERENCES (verbatim — read first, do not skim)
- TOKENS (authoritative):     {{absolute path to colors_and_type.css}}
- CHROME (signature):         {{absolute path to _layout.css}}
- DS README (hard rules):     {{absolute path to system/<ds>/README.md}}
- _MAPPING.md gating rules:   {{absolute path to _MAPPING.md}}
- inspiration library root:   {{absolute path to plugins/design/templates/design-system-inspiration/}}
{{if peer_DS_references_attached:}}
- PEER DS gold-standard:      {{absolute paths to system/<peer-ds>/preview/<file>.tsx}}
{{endif}}

DOMAIN_NOUNS (authoritative — every specimen MUST use only these nouns)
{{domain_nouns}}    # the 5–10 nouns from discovery payload's domain_nouns field — project-native vocabulary the specimen must use
{{if peer_DS_references_attached:}}
DOMAIN NOUN PURGE — peer DS references are COMPOSITION REFERENCES ONLY. The peer
DS uses different domain nouns (a peer DS built for a different product domain
will have nouns specific to that domain). When restructuring from a peer reference,
search-and-replace EVERY peer-DS noun in your output with a noun from this DS's
DOMAIN_NOUNS list. A single peer-DS noun surviving in your output is a copy-critic
blocker — leaked domain nouns from a peer reference (e.g. "publish <peer-noun>"
surviving into this DS's specimen) is the regression mode this purge step prevents.
{{endif}}

YOUR SLICE — write these {{N}} files (absolute paths):
1. {{abs path 1}}  — reference template: {{abs path to inspiration template 1}}
2. {{abs path 2}}  — reference template: {{abs path to inspiration template 2}}
… (etc.)

CREATIVITY RUBRIC — do NOT token-swap. RESTRUCTURE.
- Read the reference template. Understand the SPECIMEN comment header (what it
  demonstrates). Then write a project-flavored equivalent of 1.5×–6× the reference
  LOC. Same demonstration intent, ORIGINAL composition, project's voice, project's
  domain nouns.
- Every specimen earns at least ONE compositional choice that's not in the
  template. Examples that landed well in the studio 2026-05-13 re-bootstrap (use
  these as gold-standard creativity moves):
    - colors-accent.tsx (48 LOC template → ~5× LOC): added a brand-spotlight
      hero with masked gradient border, a "wrong" anti-pattern teaching device,
      chroma annotations on swatches.
    - empty-state.tsx (~6× LOC): added a "Voice — keep or kill" panel
      comparing good vs corporate copy side by side; added a variants grid for
      multiple empty-state cases.
    - ui_kits-<platform>-showcase.tsx (~3× LOC): replaced the template's
      generic mock screens with project-specific reality from the discovery
      payload's domain_nouns; added a live-presence layer + a token-row
      inspector panel where the brief warranted it.
  Anti-example: a components-buttons.tsx at 1.3× the template LOC that kept
  the template's fake-state grid almost verbatim. **Don't do this.** Add
  icon-only + kbd-hint variants, push hierarchy contrast, surface the signature
  treatment on the primary's hover state.
- Copy is project-specific. NO "Lorem", NO "Acme Corp.", NO "Get Started". Use
  the project's actual nouns ({{domain_nouns}}). Match the voice — {{Q8 voice}}.
- Tokens only. No hardcoded hex / px / rem. If you reach for an off-ladder
  value, STOP and use the nearest `var(--*)` token. The typography-critic
  catches off-ladder px and will return a blocker.
- Hard NOs from Q10 are guardrails. {{if "no animations" in hard_nos: "Do not add hover/active transitions; static states only."}} {{if "no gradients" in hard_nos: "No linear-gradient / radial-gradient anywhere."}} (etc.)
- Carry the SPECIMEN comment header from the reference template at the top of
  your output so future agents can identify what each file demonstrates.

ANTI-PATTERNS (graphic-design-critic blockers — guaranteed rejection)
- Multiplayer cursors / annotation pins / presence avatars MUST anchor to
  SPECIFIC content (a toolbar button, a list row, a panel, a swatch). Pins
  floating over canvas void are a fail mode. If you don't have content for a
  pin to anchor, REDUCE the pin count to match available anchor count. (Caught
  on studio-2 showcase, retro BAD-8.)
- Cropmarks / signature framing devices must be visually thicker than internal
  panel borders, otherwise they read as "another panel" not "this is the
  staging frame".
- Sections in long specimens (≥ 4 sections) must vary in vertical weight — the
  hero / signature section earns 25–30%, not equal share with policy sections.

WHEN DONE
After writing all {{N}} files:
  1. Update each row in {{absolute path to _scaffold-roster.yaml}}: change
     `status: pending` → `status: written, loc: <line-count>`.
  2. **Do NOT add new rows.** If you discover a missing claim (e.g. wordmark
     referenced but no logo.tsx in roster), include "ROSTER GAP: <description>"
     in your completion message. The main agent reconciles new rows.
  3. Return a one-line confirmation per file with LOC.
```

Sub-agents are stateless — give each a complete brief, do not assume shared context. Three-line confirmation back is enough; the roster is the source of truth.

#### Sequencing

```
Batch A (main agent, serial)         ← ~7 files, 2-3 minutes
  ↓ blocks all of B + C
Batch B (5 sub-agents, parallel)     ← ~12-14 files in ~4-6 minutes wall-clock
Batch C (3-5 sub-agents, parallel)   ← ~10-15 files in ~4-6 minutes wall-clock
  ↓ blocks ui_kits-*-index.tsx
Index files (main agent, serial)     ← 1-2 files linking every peer; written LAST
```

Batch B and Batch C can also fire **simultaneously** — they have disjoint dependency sets. The wall-clock total drops to ~4-6 minutes vs the 15-25 minutes of serial scaffold.

For each file in the computed set the sub-agent:

- **Core `.tpl` files** (under inspiration `core/`): substitute placeholders from the discovery payload. If `maude` is available on PATH, shell out to `maude design init --discovery-payload <path>`. Else inline Write.
- **Specimen files**: read the corresponding reference in the inspiration library, then **RESTRUCTURE** following the creativity rubric above. **No placeholder copy** in the output, ever.

Scaffold sources (walk in order, apply gate, generate):

1. **`core/preview/*`** — always-on. 10 preview specimens (colors-{text,surfaces,accent}, type-scale, spacing-scale, motion, components-{buttons,cards,inputs}) + `_layout.css` chrome.
2. **`foundations/*`** — always-on for any `completenessProfile != minimal`. 8 specimens: borders, elevation, focus, grid, iconography, opacity, radii, selection. **Re-curate iconography** to project domain (developer → terminal/file/branch; consumer → home/search; pro → roster/calendar).
3. **`universal/*`** — always-on. 6 components (toggles, dialogs, tooltips, tables, callout, empty-state) + `logo.tsx` IF wordmark/logotype claim exists.
4. **`status/*`** — IF `"status" ∈ activeFamilies` (default-on). 3 files: colors-status, components-status, skeletons.
5. **`audience-<q2>/*`** — gated on Q2 audience. Pick exactly ONE of audience-developer / audience-pro / audience-consumer. 5–6 files each.
6. **`platform-<q3>/*`** — gated on Q3 platforms. desktop is default-on (2 components + 2 ui_kit entries). mobile adds 4 components + 2 ui_kit entries.
7. **`theme-both/*`** — IF Q4 theme = `both equal`. 1 file: colors-themes-side-by-side.
8. **`patterns/*`** and **`meta/*`** — opt-in only. Not auto-scaffolded; user requests them explicitly via `/design:new` or `config.extensions[]`.

**ui_kit handling** — `platform-<platform>/ui_kits-<platform>-{index,showcase}.html` is **not optional** for any in-scope platform. The two files serve distinct roles:
- `ui_kits-<platform>-index.tsx` — **catalog/launcher** (links to platform-specific specimens)
- `ui_kits-<platform>-showcase.tsx` — **full product mock** (multi-screen + theme/accent picker — the highest-leverage "DS in use" artifact)

Both flatten into `system/<ds>/preview/` at scaffold time. **Never scaffold a platform-* directory as an empty stub.** Empty `ui_kits/<platform>/` is the regression the studio bootstrap produced — completeness-critic V12/V13 enforces non-emptiness.

Typical output: 18–30 scaffolded files (10 core + 8 foundations + 6 universal + 5–6 audience + 2–4 platform/ui_kit + 0–3 conditional family). See `_MAPPING.md` "Typical scaffold sizes" for per-profile counts.

Write `<designRoot>/config.json` with `extensions: []`, `completenessProfile: "standard"`, computed `activeFamilies[]`, and the new DS entry in `designSystems[]`.

Write `<designRoot>/system/<ds>/SKILL.md` with `name: ${ds}-design` (or similar slug derived from the project label).

### Copy claim → asset receipt

Before finishing scaffold, **scan the generated README + SKILL.md + specimen ledes for these substrings**: `mascot`, `glyph`, `logotype`, `wordmark`, `illustration`, `hedgehog`, `character`. For every match:

- If `assets/glyphs/` is empty AND no `*.svg` exists in `assets/`, **generate at least one minimal SVG** to back the claim. A simple geometric mark (8–16 lines of SVG) is enough — the goal is "claim has an artifact behind it", not "world-class illustration".
- Alternative: rewrite the copy to remove the claim if no asset is reasonable. Never let "hedgehog mascot energy" survive in copy with an empty `assets/glyphs/`.

This catches the self-injected-puffery drift the studio bootstrap produced.

**Run completeness-critic.** Spawn `design-system-completeness-critic` as a subagent with:

```
config_path: <repo>/.design/config.json
ds_name:     <target_ds>
ds_root:     <designRoot>/system/<target_ds>/
output_path: <designRoot>/_history/_system/000-bootstrap-completeness.md
all_ds:      false
```

The critic emits a JSON verdict. If it returns **blockers**, the bootstrap flow surfaces them in the next-step block and recommends the user re-run with `--force` after addressing each. Warnings are listed in the completion message but do NOT block. Tier 3 (free-form) acknowledgements are listed informationally.

### Visual sanity check (mandatory — fail loud, never silently elide)

> **This step exists because completeness-critic is structural only.** It cannot see that the rendered output looks like a generic public-component-library template, that the motion specimen is dead-on-arrival, or that a logo asset 404s because of a relative-URL gotcha in canvas-shell routing. The screenshots feed the aesthetic critics in the next step AND give the user a fast visual proof.
>
> **Closes D-3 + D-4 in the imprint-bootstrap retro** (`.ai/logs/system-reviews/imprint-bootstrap-review-2026-05-26.md`): both failure modes were caught by the user, not the loop, because the visual sanity step was treated as soft + skipped when dev-server boot "looked heavy". Phase 3.7 flips it: dev-server boot is **mandatory**; failure surfaces as `AskUserQuestion`, never silently elided.

Use the canonical helper — `${CLAUDE_PLUGIN_ROOT}/dev-server/bin/visual-sanity.sh`. It boots the dev-server (via `server-up.sh`), screenshots N specimens (via `screenshot.sh`), writes them + a `_manifest.json` under `<designRoot>/_history/_system/<ds>-visual-sanity-<ISO>/`, and exits with a distinct code per failure mode.

```bash
bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/visual-sanity.sh" \
  --ds "<ds-name>" \
  --specimens "colors-accent,motion,ui_kits-desktop-showcase,empty-state,logo"
# Pass only specimens that were actually written this run — derive from the
# reconciled roster (rows with status: written), not a hardcoded list.
```

**Signature trio (mandatory when present):**

- `colors-accent` — proves the accent color renders as intended (the single highest-signal token decision)
- `motion` — proves motion plays on initial paint, not just on hover. Catches the dead-on-arrival regression Phase 3.7 workstream B exists to prevent. **`motion-critic` is auto-routed in the panel below when this specimen exists, regardless of opt-out scope.**
- `ui_kits-desktop-showcase` — proves the DS works on a real product surface (the multi-screen showcase, not the catalog launcher)

Additional specimens (capture when scaffolded): `empty-state` (brand/voice moment), `logo` (asset integrity — was D-4 in the retro), `components-buttons` (the most-trafficked component).

**TSX specimens require the dev-server.** Pre-Phase-19 spec said "use `file://` URLs". That worked for the HTML era. The current scaffold ships `.tsx` (DDR-019) — the browser can't compile JSX on its own, so `file://*.tsx` shows raw source. `screenshot.sh` hard-errors with exit 2 on `file://*.tsx`. The helper routes through the dev-server's `_canvas-shell.html?canvas=<rel>` transpile path. Phase 19 / DDR-044.

**Handle helper exit codes — never silently elide.** The helper's exit codes map 1:1 onto the recovery path:

| Exit | Meaning | Action |
| --- | --- | --- |
| `0` | All specimens captured | `Read` each PNG into context (mandatory — direct visual scrutiny BEFORE spawning aesthetic critics). |
| `1` | Dev-server boot failed | **`AskUserQuestion`** — "Dev-server boot failed: `<reason from _server.log>`. Skip visual sanity (aesthetic critics run source-only) or fix and retry?" Record selection to `<designRoot>/_history/_system/<ds>-bypass-log.md`. |
| `3` | One or more screenshot(s) failed | Surface the failing specimen names; treat as a soft warning (continue with the captured PNGs), and add a `recommend /design:edit "<specimen> failed to render"` line to the next-step block. |
| `4` | No requested specimens existed on disk | Indicates a scaffold gap. Re-check the roster reconciliation; the bypass-log records the gap. |

**Read each captured PNG with the `Read` tool** so they're in your visual context. Direct visual scrutiny BEFORE you spawn the aesthetic critics — if the accent is obviously the wrong hue, the motion specimen is blank on first frame, or a logo shows the broken-image icon, fix it in source NOW rather than asking critics to confirm what you can already see.

### 4 kola značky — critic panel (mandatory)

> **The completeness-critic does not catch aesthetic gaps.** It returns `pass` for generic public-component-library output. This step is non-negotiable, especially when discovery captured strong references in the research payload.

The seven critic agents are grouped into Pastier's three brand-quality kola (Frekvence is intentionally dropped — outside DS surface). **Kolo 1 runs first** (Srozumitelnost — structural floor must hold before aesthetics matter); **Kola 2 + 3 fire in parallel** in a single message, multiple Agent calls. Default specimen target is `colors-accent.tsx` (the accent showcase); when the bootstrap produced a `ui_kits-desktop-showcase.tsx` run a second pass on it too — it's the highest-fidelity "DS in use" artifact.

| Kolo (Pastier) | Critic | Subagent type | What it catches |
|---|---|---|---|
| **Kolo 1 — Srozumitelnost** | `design-system-completeness-critic` | `design:design:design-system-completeness-critic` | Structural completeness — required files, token coverage, manifest fields |
| **Kolo 1 — Srozumitelnost** | `a11y-auditor` | `flow:flow:a11y-auditor` | WCAG 2.1 AA — contrast, focus, semantic HTML, keyboard reach |
| **Kolo 2 — Atraktivita** | `signature-moment-critic` | `design:design:signature-moment-critic` | Brand prominence, hero moments, mock fidelity, specificity — the "is this portfolio-worthy?" axis |
| **Kolo 2 — Atraktivita** | `graphic-design-critic` | `design:design:graphic-design-critic` | Composition, hierarchy, balance, density, rhythm, white-space discipline |
| **Kolo 3 — Konzistence** | `typography-critic` | `design:design:typography-critic` | **Always run during bootstrap.** Type decisions (font choice, scale, mono pairing) are always non-trivial enough to warrant a sanity pass. Cost: one parallel sub-agent. Opt-out only via `--no-typography-critic`. (Was conditional pre-studio-2-retro — BAD-5 caught the trigger condition was too fuzzy.) |
| **Kolo 3 — Konzistence** | `brand-critic` | `design:design:brand-critic` | Logo placement / mark integrity / asset ladder / voice-asset alignment |
| **Kolo 3 — Konzistence** | `copy-critic` | `design:design:copy-critic` | **Always run during bootstrap.** Voice + claim-vs-content drift slip past completeness-critic by definition. Sub-agent peer-reference cross-contamination (e.g. "publish lineup" leaking from studio's sports-stack) is caught here. |

**Surface their verdicts in the next-step block.** Use this threshold matrix:

| Outcome | Action |
|---|---|
| All critics pass, aspiration_score ≥ 3.5 | Print "Bootstrap complete — aesthetic check passed" |
| Any graphic-design blocker, OR aspiration_score < 3.0 | Print "Bootstrap complete with aesthetic warnings — DS scaffold is structurally valid but does NOT match the brief's quality bar yet. Run `/design:edit` on the flagged specimens before calling this done." Surface the top 3 blockers verbatim. |
| Both completeness AND aesthetic critics flagged blockers | Print "Bootstrap produced a structurally broken AND aesthetically weak DS. Recommend `/design:setup-ds <name> --force` after revising the brief." |

**Never silently report "Bootstrap complete" when aspiration_score < 3.0.** That's the regression mode the studio bootstrap landed in.

### Post-Flight (slim)

Bootstrap-mode Post-Flight is **slim** — only DS-specific follow-ups (no environment offers; those belong to `init`):

- Optionally surface a one-shot AskUserQuestion offering `maude design serve` if not already running, so the user can browse the freshly-generated specimens.

Everything else (CLAUDE.md, .ai/, agent-browser install hints) was handled during `init` BEFORE bootstrap ran.

### Always-print next steps

```
Bootstrap complete. .design/ scaffolded at <repo>/.design/system/<ds>/.
  <N> specimen pages under preview/ (audience: <Q2>, platforms: <Q3>)
  <M> ui_kit compositions under ui_kits/ (the "DS in use" artifacts)
  config.json: 14 fields populated (incl. extensions, completenessProfile, activeFamilies, designSystems[])

Round 0 research:
  Payload: <designRoot>/_history/_system/<ds>-domain-research-discovery.json
  Reference anchors (user picked Q5 cluster): <anchor1>, <anchor2>, <anchor3>
  [if fallback_used: "⚠ Research fell back to LLM-knowledge mode for this niche domain — review the payload manually before trusting the option pool"]
  [if cache hit: "Reused cached research from <date>"]

Kolo 1 — Srozumitelnost:
  design-system-completeness:  <N> blockers, <N> warnings
  a11y-auditor:                <N> blockers, <N> warnings

Kolo 2 — Atraktivita (run on <signature specimen>):
  signature-moment:    aspiration <X.Y>/5  (blockers: <N>, warnings: <N>)
  graphic-design:      <N> blockers, <N> warnings

Kolo 3 — Konzistence:
  typography:          <N> blockers, <N> warnings
  brand:               <N> blockers, <N> warnings
  copy:                <N> blockers, <N> warnings

Visual proof — screenshots saved to .design/_history/_system/<ds>-visual-sanity-<ISO>/:
  colors-accent.png · motion.png · ui_kits-desktop-showcase.png · empty-state.png · logo.png
  (_manifest.json records which were captured / missing / failed)

[IF aspiration < 3.0 OR any Kolo-2 blocker:]
⚠ Kolo 2 (Atraktivita) did NOT pass. The DS is structurally valid but does not match the brief's quality bar.
  Top blockers:
    1. <blocker 1 summary>
    2. <blocker 2 summary>
    3. <blocker 3 summary>
  Recommended: /design:edit "<specific fix>" --perfect, then re-run /design:critic to confirm.

Daily verbs:
  /design:edit "<feedback>"   — iterate on a specimen
  /design:new "<Name>" "..."  — add a new full canvas
  /design:browse              — open the dev server tab
  /design:critic              — run all critics on active canvas
  /design:help                — grouped command index
```

---

## Companion skills

- `design` — user-facing orchestrator (canvas-first iteration loop)
- `ui-kit` — pointer to project-specific reference surfaces / components
- `frontend-design` (external plugin) — generates new canvas files using these tokens

## Cross-links

- Inspiration library: `plugins/design/templates/design-system-inspiration/`
- Mapping contract: `plugins/design/templates/design-system-inspiration/_MAPPING.md`
- Tokens (authoritative, post-scaffold): `<designRoot>/<tokensCssRel>` (single-DS) or `<designRoot>/system/<ds>/colors_and_type.css` (multi-DS)
- Live specimen browse: dev server at `http://localhost:<port>/<designRoot>/system/...`
- Per-repo config: `.design/config.json`
- Completeness-critic: `plugins/design/agents/design-system-completeness-critic.md`
- Round 0 research agent: `plugins/design/agents/ux-research-agent.md` (mode `discovery`)
- Round 0 payload cache: `<designRoot>/_history/_system/<ds>-<brief-sha8>-domain-research-discovery.json` (brief-hash in key — different briefs in same DS get separate cache files)
