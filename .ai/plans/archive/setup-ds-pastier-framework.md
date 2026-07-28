# Feature: Setup-DS — 3-stage discovery (Vision → Research → Refinement) inspired by Pastier

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. The 3-stage architecture below is load-bearing — do not collapse stages, do not reintroduce hardcoded option ladders in Stage 3, do not surface Pastier vocabulary as user-facing labels.

## Description

Přepsat discovery flow ve skillu `design-system` (BOOTSTRAP mode) na **3-stage architekturu**, která jde od **abstraktnějšího ke konkrétnímu** — tak, jak by to dělal lidský designer s klientem:

1. **Stage 1 — Vision (extract):** Conversational free-text prompty, malé kroky. Skill se ptá jako designer u kafe a postupně z uživatele dolouduje vizi, kterou ten možná ani neví, že má. Žádné token-level rozhodnutí. Pastierova metodologie (Zrcadlo · Facka · Ulice · Kmen · Zkratka · Charakter · OST) slouží **jako šablona promptů** — uživatel Pastiera nikde nevidí, jen dostává srozumitelné lidské otázky s příklady.
2. **Stage 2 — Research (synthesize):** `ux-research-agent` dostane bohatý **vision-brief.json** ze Stage 1 (ne jen one-liner jako dnes) a vrátí **tailored recommendations** s `confidence` skóre per design rozhodnutí (paleta, typografie, signature, 3-code Maják kombinace, density, motion). Pastierovy kapitoly žijou v **agent promptu** jako research probe templates — agent jimi je instructován co hledat.
3. **Stage 3 — Refinement (decide):** Skill se uživatele ptá **jen na to, kde má research nejistotu**. Každá Q má shape "Research ti doporučuje X, protože Y. Tady jsou alternativy A, B. Nech to být, vyber jinak, nebo napiš vlastní." **Nula hardcoded ladders.** Pokud research selže celý → flow se zastaví a vrátí do Stage 1, ne nedegraduje na fallback ladder.

**North star:** unikátní a skvělý design system pro **jakýkoli scope** (market produkt / interní nástroj / osobní projekt / research / open-source). Pastier je inspirační lens, ne implementační kopie.

## User Story

As a person bootstrapping a design system (možná poprvé, bez branding znalostí), I want **conversational, small-step discovery, který mě nenechá tápat nad otevřenou složitou otázkou** — and which extracts my vision through plain-language probes with examples, then does research on my behalf, then asks me to refine only the decisions where it's unsure. The result is a DS where each visual choice is justified against my intent, not picked from a hardcoded ladder.

## Problem

Současný 12-Q dotazník (3 rounds: Identity / Brand / Pro-designer) má 4 strukturální problémy:

1. **Visual-first inversion.** Q5–Q8 (mood / color OKLCH / typography pairing / voice) přijdou před tím, než discovery zachytí PURPOSE / CHARAKTER. Uživatel vybírá "cool-clinical L 58-62 C 0.08-0.11" aniž by někdo formuloval **proč ten DS existuje** a **jaký charakter má nést**. Volba tokenů je arbitrarní — jakákoli ze tří nabídek je strukturálně validní, ale není vázaná na intent.

2. **"3 kódy stačí" princip ignorován.** Pastier explicitně limituje codes na 3 z 9. Současný flow aktivuje všech 9 token families bez prioritizace. Výsledné DS jsou "kompletní" ale **nemají signature** — nic není dominantní, vše je vyrovnané. Přímá příčina toho, že aesthetic critic dlouhodobě dává 3.5/5 místo 4.0+.

3. **Hardcoded fallback ladders.** SKILL.md lines ~156-169 mají "emergency-only" fallback options (8 signature treatments, 4 density labels, atd.) které se ve skutečnosti spouští kdykoli research jen ztratí dech. Tyhle ladders **jsou bias source** — uživatel vždy vidí stejnou trojici aniž by věděl proč.

4. **Scope-agnostic assumptions.** Dotazník mlčky předpokládá market-facing produkt s "pro / consumer / developer" audience. Pro osobní projekt / interní nástroj / research je tahle taxonomy irelevantní; uživatel se vlomí do nejbližší škatulky.

**Důsledek:** DS vychází strukturálně validní (completeness-critic dává pass) ale aesthetic skóre stagnuje na ~3.5. Otázky jsou moc úzké, moc brzo konkrétní, a moc často "vyber jednu ze tří" místo "popiš co chceš".

## Solution

**3-stage architektura. Žádné fixed Q count. Žádné hardcoded options v Stage 3.**

### Stage 0 — Scope gate (1 picker, only hardcoded thing in entire flow)

Před Stage 1 jedna single-select otázka která řídí všechno dál. **AskUserQuestion má MAX 4 options per Q** (DF-1) → osobní projekt + research jsou sloučené:

```
Co je tohle za projekt?
  ○ Produkt pro veřejnost  — chceš oslovit externí lidi, zákazníky, širší komunitu
  ○ Interní nástroj         — pro tebe a tvůj tým nebo firmu, audience zná kontext
  ○ Osobní projekt          — pro sebe, portfolio, vlastní tool, experiment
  ○ Open-source knihovna    — pro vývojáře co tvůj kód budou používat
```

**User-facing descriptions nesmí obsahovat internal jargon** (DF-5): žádné "Aspirační target 4.0+", žádné "signature-moment-critic threshold". Jen lidská řeč o tom, kdo to bude používat.

Stage 0 INTERNĚ (neviditelné v UI) řídí:
- **Stage 1 wording** — pro osobní projekt nepíšeme "vaše značka", píšeme "tvůj DS"
- **Aspirační target pro signature-moment-critic** (market/oss 4.0+ · interní 3.5+ · osobní 3.0–4.0+ podle ambice)
- **Voice register defaults** (interní → terse; osobní → user's own voice; market/oss → researched per audience)

### Stage 1 — Vision (11 free-text prompty, conversational)

**Princip:** malé kroky, srozumitelné jazykem nezasvěceného člověka, vždy s příkladem, "nevím" je vždy validní odpověď. Pastierovy kapitoly nemají user-facing labels — žijí jen v interním komentáři skillu.

**Stage 1 implementation** (DF-4 resolved — plain prose, no tool):

Stage 1 NEPOUŽÍVÁ AskUserQuestion. Důvod: tool je multi-choice picker, ne free-text capture (DF-4 + DF-7 deep research dokazuje impossibility "2 visible items" UI).

**Pattern per batch (PŘÍPRAVA / PROSTOR / DUŠE):**

Skill emituje jeden chat message s 3–4 očíslovanými otázkami + příklady. User odepíše v jednom chat message — formát volný, ideálně `1. ...` / `2. ...` headings nebo `skip` per otázka.

```
**Stage 1 — PŘÍPRAVA** (1/3)

Odpověz v jednom message. Napiš `skip` u jakékoli otázky kterou chceš přeskočit.

**1. Co tenhle projekt je?** Napiš 1–2 věty, jako bys to říkal kamarádovi.
*Příklad: „Je to recept manager kde si můžeš nastavit počet porcí."*

**2. Co by udělalo tenhle design system úspěchem v TVÝCH očích?** ...
```

Parser logic: split user reply na `**N. ...**` boundary nebo `\nN. ` numbered list. Trim, strip example artifacts, identify `skip` markers (case-insensitive, also "ne", "nevím", "—"). Vše naplní do `vision-brief.json`.

```
─── PŘÍPRAVA — kdo a proč (~4 prompty) ───────────────────────────

P1  (Pastier: Zkratka)
    Co tenhle projekt je? Napiš 1–2 věty, jako bys to říkal kamarádovi.
    
    Příklad: „Je to recept manager kde si můžeš nastavit počet porcí
    a on přepočítá ingredience."
    Nemusí to znít cool, normální slova jsou OK.

P2  (Pastier: Zrcadlo, část 1 — úspěch)
    Co by udělalo tenhle DS úspěchem v TVÝCH očích?
    Tady jde o tebe, ne o uživatele. Na čem by sis dal záležet?
    
    Příklad: „Aby každá obrazovka vypadala jako z časopisu",
    „Aby to bylo rychlé a nepřekáželo to", „Aby se mi to líbilo i za 5 let".

P3  (Pastier: Zrcadlo, část 2 — hodnoty)
    Je něco, na čem si zakládáš a chceš, aby to bylo cítit i v DS?
    
    Příklad: „Vždycky perfekcionismus na detailech",
    „Pohoda nad formálností", „Žádné prázdné buzzwords".
    Klidně přeskoč, pokud nevíš.

P4  (Pastier: Facka)
    Naopak — co bys NIKDY nechtěl, aby DS vypadal?
    Co tě v jiných projektech / DSes vyloženě irituje?
    
    Klidně napiš konkrétní jména produktů kterým se chceš VYHNOUT.
    (Tohle pomůže research agentovi víc než pozitivní reference.)

─── PROSTOR — kde to žije (~3 prompty) ───────────────────────────

P5  (Pastier: Ulice, část 1 — design lineage)
    V jakém vizuálním prostoru tenhle projekt žije?
    Nemusí to být přímí konkurenti — stačí říct, k jaké tradici se hlásíš.
    
    Příklad: „terminal tools jako Linear / Vercel",
    „editorial jako Stripe docs", „hand-drawn jako Notion early days",
    „retro arcade jako itch.io".
    „Nevím, podívej se a doporuč mi" je validní — research agent to udělá.

P6  (Pastier: Ulice, část 2 — anti-references)
    A naopak — co je z toho prostoru OTŘEPANÉ, čeho už je všude moc?
    Co bys NECHTĚL zopakovat?
    
    Příklad: „purple-pink gradient hero", „bento grid landing pages",
    „glass-morphism cards", „stock photos s ‚happy team meeting'".

P7  (Pastier: Kmen)
    Pro koho to děláš? Klidně „jen pro sebe" je validní odpověď.
    Pokud jsou to jiní lidé — co o nich asi víš?
    
    Příklad: „Jen pro sebe, je to portfolio",
    „Pro 5 lidí v týmu co používají dashboardy denně",
    „Pro vývojáře co staví na PostgreSQL".

─── DUŠE — jak má působit (~4 prompty) ───────────────────────────

P8  (Pastier: Charakter, část 1 — primární emoce)
    Když to někdo poprvé vidí — jakou JEDNU emoci by měl odejít?
    
    Příklad: klid · údiv · soustředění · hravost · autorita · 
    „cítím se chytrý" · radost · pocit „to je řemeslo" · respekt.
    Vyber jedno slovo, klidně své vlastní.

P9  (Pastier: Charakter, část 2 — autor)
    A jaký pocit by měl mít z TEBE jako z autora?
    
    Příklad: „profík v oboru", „hravý experimentátor",
    „klidný řemeslník", „někdo kdo ví co dělá ale nepyšní se tím".
    Můžeš přeskočit pokud je DS impersonální (např. interní nástroj).

P10 (Pastier: OST, část 1 — signature claim)
    Existuje něco jednoho, čím by ses chtěl odlišit?
    Jedna věc, díky které lidi řeknou „jo to je [tvůj projekt]"?
    
    Příklad: „naše signature žlutá", „CRT motion na všech přechodech",
    „mascot ježek v rohu", „typografie jak ve starých knihách",
    „nezvyklý layout pattern".
    
    „Nevím, doporuč mi něco" je perfektně OK — research ti potom dá 
    návrhy a ty z nich vybereš.

P11 (Pastier: OST, část 2 — co určitě NE)
    A naopak — co určitě NEMÁ být tvůj signature?
    Co je „taková obyčejná default věc" a nechceš to za signature mít?
    
    Příklad: „určitě ne barva, ta je obyčejná",
    „určitě ne font, neumím to ohlídat".
    Klidně přeskoč pokud nemáš názor.
```

**Po P11 skill syntetizuje vstupy do `vision-brief.json`:**

```json
{
  "scope": "<from P0>",
  "elevator_pitch": "<from P1>",
  "success_essay": "<from P2>",
  "values": "<from P3 — may be null>",
  "anti_aesthetics": "<from P4>",
  "design_lineage": "<from P5 — may be 'research, surprise me'>",
  "tired_tropes_to_avoid": "<from P6>",
  "audience": "<from P7>",
  "primary_emotion": "<from P8>",
  "author_voice": "<from P9 — may be null>",
  "ds_signature_hypothesis": "<from P10 — may be 'no preference'>",
  "ds_signature_anti": "<from P11 — may be null>",
  "_pastier_chapter_coverage": {
    "zrcadlo": ["P2", "P3"],
    "facka": ["P4", "P6"],
    "ulice": ["P5", "P6"],
    "kmen": ["P7"],
    "zkratka": ["P1"],
    "charakter": ["P8", "P9"],
    "ost": ["P10", "P11"]
  }
}
```

`_pastier_chapter_coverage` je internal audit field — pro QA že každá Pastier kapitola v scope má source prompt.

### Stage 2 — Research (no user input, ~30–90s wall-clock)

`ux-research-agent` dostane `vision-brief.json` celé jako vstup (dnes dostává jen one-liner brief).

**Agent prompt rozšířen o Pastier probe templates** — pět nových sekcí v agent system prompt:

```
PASTIER PROBE TEMPLATES (use to structure WebSearch queries)

A. ULICE — design lineage
   Input fields: design_lineage, tired_tropes_to_avoid, anti_aesthetics
   Action: find 5–8 design systems / products in the named lineage. 
   For each, document: signature visual treatment, typography family,
   color discipline, density. Flag any that match anti_aesthetics 
   as anchor → "do NOT look like".

B. ZRCADLO + CHARAKTER — character grounding  
   Input fields: success_essay, values, primary_emotion, author_voice
   Action: find products / portfolios whose authors describe their work
   with similar values / emotion. Use these as voice anchors, NOT visual
   anchors. Returns: voice_tone_options[] grounded in real product copy.

C. OST — signature direction
   Input fields: ds_signature_hypothesis, ds_signature_anti
   Action: if hypothesis is specific (e.g. "yellow"), find 3–5 products
   that nail that direction; recommend a refined version (e.g. specific
   OKLCH yellow range with rationale). If hypothesis is "surprise me",
   propose 3 candidate signatures based on lineage + character, each
   classified into a Q9 family.

D. KMEN — audience-driven density + density bias
   Input fields: audience, scope
   Action: research density conventions for the named audience. Pro 
   tool dense; consumer mobile roomy; personal project = author's 
   preference, lean toward roomy unless author voice = "terminal".

E. CONFIDENCE EVALUATION
   For each design decision (palette, typography, signature, density,
   3-code Maják combination), compute confidence 0.0–1.0:
   - 1.0 = vision-brief is specific + research found strong consensus
   - 0.5 = vision-brief is vague OR research found conflicting evidence
   - 0.0 = research found nothing useful; flag for user input in Stage 3
```

**Payload schema extended** (zachovává backward-compat — only adds fields):

```json
{
  ... existing fields (mood_clusters, color_oklch_options, etc.) ...
  
  "recommendations": {
    "palette": {
      "recommendation": { ... primary OKLCH option ... },
      "alternatives": [ ... 2 OKLCH options ... ],
      "confidence": 0.85,
      "rationale": "Tvoje primary_emotion='klid' + design_lineage='editorial Stripe docs' nasvědčuje L 58-65, C 0.08-0.12, H 200-240. Anchor: Stripe docs accent, Vercel docs hover."
    },
    "typography": { ... same shape ... },
    "signature_treatment": { ... same shape ... },
    "maják_3_codes": {
      "recommendation": ["barva", "font", "motion"],
      "alternatives": [["symbol", "barva", "voice"], ["font", "tvar", "vzor"]],
      "confidence": 0.7,
      "rationale": "OST hypotéza 'CRT motion' → motion je code. Lineage editorial → font je code. Třetí code 'barva' protože scope=osobní a chceš výrazné rozpoznání."
    },
    "density": { ... },
    "voice": { ... }
  }
}
```

Pokud agent **selže celý** (no payload written): flow se zastaví, surface message `"Research nedoběhl. Můžeš popsat víc Stage 1, nebo zkus znovu za chvíli."` a NABÍZÍ buď re-run Stage 1 nebo abort. **NEDEGRADUJE na hardcoded ladder.**

### Stage 3 — Refinement (adaptive, 0–N Q dle confidence)

**Pro každé rozhodnutí v `recommendations`:**

| Confidence | Behavior |
|---|---|
| ≥ 0.85 | **Skip Q.** Surface jen ve finálním 3-sentence confirm. |
| 0.60–0.85 | **1 Q s pre-pickem.** Recommended option je první, 2 alternativy ze `alternatives`, "něco jiného (napsat) →", "skip (nechat doporučení)". |
| < 0.60 | **1 Q bez pre-picku.** 3 alternativy (research's nejlepší 3) s `recommended` flagem na první, plus "něco jiného (napsat) →". |

Counts in ideal vs worst case:
- **Ideal** (rich vision-brief + strong consensus): 0–2 Q v Stage 3, většina rozhodnutí pre-picked.
- **Typical**: 4–6 Q.
- **Worst** (vague vision + niche domain): 8–10 Q.

**Žádné hardcoded fallback ladders. Pokud `alternatives` je prázdné pro některé rozhodnutí, skill přeskočí Q a požádá uživatele na free-text** ("Research nedoporučuje konkrétní směr pro [X]. Napiš mi co bys chtěl, nebo nechám to na default tokens.").

**Maják 3-code je vždy Q v Stage 3** (ne v Stage 1) — protože je to konkrétní design rozhodnutí navazující na OST hypothesis + lineage research. Q má shape:

```
Research mi doporučuje, aby SIGNATURE tohohle DS stál na 3 kódech:
  → barva (signature OKLCH yellow), font (display-serif anchor), motion (CRT roll)

Důvod: tvoje OST hypothesis ('signature žlutá') + design lineage 
(editorial × retro-tech) by ladila s touhle kombinací.

  ○ Tahle trojka je dobrá, jdeme dál
  ○ Vyměnit jeden kód (alternativy: symbol, vzor, voice)
  ○ Vyměnit všechny 3 (napsat vlastní výběr)
  ○ Vyber mi je sám podle vision-brief
```

### Confirm step (1 message, no Q)

Po Stage 3 skill vypíše **3-sentence summary** — jedna věta per stage:

```
Vision: <2-line synth z vision-brief>
Research: <3 key anchors z payload + 3-code Maják pick>
Refinement: <co user změnil vs co necháno na recommendation>

Pokračovat? (y / něco upravit)
```

Na "něco upravit" se vrátíš do Stage 3; ne dál do Stage 1, pokud uživatel explicitně neřekne "začni od začátku".

### Post-scaffold gate — rename critic panel na "4 kola značky" (SAFK adapted)

Existující critic panel (completeness + a11y + graphic-design + typography + signature-moment + brand + copy) zorganizovat do 3 Pastierových kontrol (Frekvence je marketing, drop):

| 4 kola (Pastier) | Mapuje na critic agents | Co kontroluje |
|---|---|---|
| **Srozumitelnost** | completeness + a11y + design-system-completeness | Lze tomu rozumět? Drží to standardy? |
| **Atraktivita** | graphic-design + signature-moment | Rezonuje to vizuálně? Má to moment? |
| **Konzistence** | typography + brand + copy | Drží to spolu? Voice + visual + naming sedí? |

**Žádný code change na critic agentech — jen rebrand v reporting bloku** (current "Aesthetic gate" → "4 kola značky" header). Visual hierarchy v "Bootstrap complete" outputu drží Pastier loop end-to-end.

## Metadata

- **GitHub Issue**: (žádný; maintainer-initiated)
- **Type**: Refactor (full discovery rewrite) + minor enhancement (critic rebrand)
- **Complexity**: **High** — touches the most-used skill (`design-system` bootstrap), but scaffold output contract preserved
- **App/Package**: `plugins/design/`
- **Affected Systems**:
  - `plugins/design/skills/design-system/SKILL.md` — discovery section úplně přepsaná (~300 řádků diff)
  - `plugins/design/agents/ux-research-agent.md` — agent prompt rozšířen o Pastier probe templates; payload schema extended s `recommendations` blokem
  - `plugins/design/agents/_ux-research-config.json` — případné dodatky pro probe templates
  - `plugins/design/commands/setup-ds.md` — Examples + brief guidance přepsány (žádné Pastier vocabulary, místo toho "Stage 1 tě vede otázkami")
  - `.ai/archive/decisions/DDR-NNN-three-stage-discovery.md` — new DDR
  - User memory: `feedback-design-bootstrap-workflow.md` refresh
- **Dependencies**: None new.

---

## Context References

### Must-Read Files

- `plugins/design/skills/design-system/SKILL.md` (lines 99-200) — Why: aktuální discovery flow being replaced. Lines 156-169 (fallback ladders) deleted entirely.
- `plugins/design/agents/ux-research-agent.md` (full) — Why: payload schema extends here; agent prompt gets new Pastier probe section.
- `plugins/design/commands/setup-ds.md` (full) — Why: thin wrapper, brief guidance section needs rewrite.
- `.ai/plans/archive/setup-ds-pastier-framework-v1-iterative.md` — Why: explored "iterative" approach (kept 12-Q, added Pastier vocab as derivation inputs); rejected because too many hardcoded ladders survived. Reference for what NOT to do.
- Figma `Processes` board (private, fileKey `ikeICj0lwlz6Coe7H9tAeq`, node `182:1421` = overview, node `182:1135` = full board) — Why: Pastier's verbatim phrasing per kapitola. Stage 1 prompts mirror his conversational voice ("tady můžete...", "klidně...", first-person framing).

### Files to Create

- `.ai/archive/decisions/DDR-NNN-three-stage-discovery.md` — Why: architectural shift; future contributors need rationale.
- `plugins/design/skills/design-system/_pastier-probe-templates.md` — Why: standalone reference for the 5 Pastier probe templates fed to ux-research-agent. Loaded by agent at runtime.

### Files NOT to Touch

- `plugins/design/templates/design-system-inspiration/_MAPPING.md` — scaffold contract unchanged.
- `plugins/design/agents/design-*-critic.md` — critic agents unchanged (only the rebrand of their grouping in skill's output).
- All token CSS templates — derivation logic v Stage 2 stejné jako dnes (research → OKLCH range etc.); jen víc bohatých inputs.

### Patterns to Follow

**Pastier Zrcadlo prompts (verbatim Czech, our P2 + P3 mirror this shape):**
```
Co bych považoval za úspěch své značky?
Stojím si za...
Nikdy nebudu stát za tím, že...
Vždy se soustředím na...
Mým závazkem je...
```

**Pastier Ulice prompts (our P5 + P6 mirror — but reframed from competitors to design lineage):**
```
Na které ulici chcete být?
Jak vypadají? Co dělají? Jakým stylem komunikují? Co je spojuje?
Kde je prostor pro odlišení se?
```

**Pastier "tady můžete..." invitation pattern** — Stage 1 prompts vždy končí povzbuzením, ne příkazem. Příklad: "Klidně přeskoč, pokud nevíš" / "Nemusí to znít cool, normální slova jsou OK" / "Klidně i tvé vlastní slovo".

**AskUserQuestion + free-text pattern** (existující convention v repu):
```
question: <prompt>
options:
  - label: "Napsat odpověď →"
    description: "Skill se zeptá free-text v dalším kroku"
  - label: "Přeskočit (nemám odpověď)"
    description: "Není to mandatory — research si poradí"
```

---

## Dogfood findings (load-bearing — read before every dry-run)

Tahle sekce se updatuje **postupně** s každým dry-runem. Před dalším dry-runem si projdi všechny DF-N body a aplikuj je. Číslování je permanentní (nereindexovat) — findings se jen přidávají, neodstraňují.

### DF-1 — AskUserQuestion má max 4 options per question
Schema: `"options": { "maxItems": 4 }`. Stage 0 scope tedy MAX 4 (původní plán měl 5: market / interní / osobní / research / oss → sloučeno "osobní + research" do jednoho).

### DF-2 — AskUserQuestion má max 4 questions per call
Schema: `"questions": { "maxItems": 4 }`. Pokud chceme batchovat Stage 1 prompty, max 4 prompty per batch (Stage 1 má 11 → minimálně 3 calls).

### DF-3 — AskUserQuestion vždy auto-přidává "Other" / "Type something" jako N+1 viditelný item
Tool description: `"Users will always be able to select 'Other' to provide custom text input"`. Nelze suppress. Implication: pokud poskytnu 2 options, user vidí 3 items. Pokud 4 options, user vidí 5.

### DF-4 — RESOLVED — Stage 1 = plain prose; user mistook prose-UX for a tool

**Critical insight z oficiálních Claude Code docs** (https://code.claude.com/docs/en/agent-sdk/user-input):

> "Question limits: each `AskUserQuestion` call supports 1-4 questions with **2-4 options each**"
> "Support free-text input — Display an additional 'Other' choice after Claude's options that accepts text input"

Tj. AskUserQuestion **vždy** má:
- min 2 labeled options (hard schema)
- + Other affordance jako N+1 item (mandatory in Claude Code CLI rendering)

**Visible items vždy = N+1 ≥ 3. "1 item only" je mechanicky nemožné.**

**Co user vlastně viděl** ("jen otázka + open text"): To NEBYLA AskUserQuestion. To byl běžný **chat prompt v plain prose** — Claude napíše otázku do chatu, user odepíše v chatu. Vypadá to identicky jako AskUserQuestion s jedním free-text fieldem, ale není to tool call. User si nevšiml že je to chat-level interaction, ne tool-level.

**RESOLUTION:**
- **Stage 1** = plain prose chat (= "otázka + open text" UX který user chce a měl na mysli)
- **Stage 0** = AskUserQuestion (4 jasné scopes, single-select)
- **Stage 3** = AskUserQuestion (4 concrete recommendations z research, single-select + Other pro override)

Plain prose is the answer — to je přesně to, co user chtěl, jen tomu říkal "question tool". V Claude Code je rozdíl mezi "tool call" a "chat message" pro user-experience invisible — oba vypadají jako "Claude napsal otázku, ty odepíšeš".

### DF-5 — User-facing descriptions NESMĚJÍ obsahovat internal scoring jargon
"Aspirační target 4.0+", "signature-moment-critic threshold", "completeness gate" atd. patří do INTERNAL docs. Uživatel slyší lidskou řeč o tom, **kdo to bude používat** / **jak to má vypadat**, ne o kritičích a thresholdech. Aplikuje se na všechny user-facing prompts ve všech stages.

### DF-6 — Dry-run musí číst aktuální plán
Každý "nový dry run" = před spuštěním Read plán, projdi sekci "Dogfood findings", aplikuj všechny DF-N. Žádné ad-hoc improvizace mezi pokusy — to vede k tomu, že findings se ztratí a stejná chyba se opakuje (jak se stalo v prvních 3 pokusech).

### DF-7 — Deep research: AskUserQuestion má hard constraints, custom MCP je out of scope
Sources:
- [Handle approvals and user input — Claude Code docs](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Tool implementation gist](https://gist.github.com/bgauryy/0cdb9aa337d01ae5bd0c803943aa36bd)
- [Piebald-AI system prompts](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md)

Confirmed konstrukty:
- `options` array: `minItems: 2`, `maxItems: 4` — hard schema, no bypass
- Auto-"Other" affordance: mandatory, no `suppressOther` flag
- Per-question shape: `question`, `header` (≤12 chars), `options[]`, `multiSelect`
- Visible items ALWAYS = N+1
- "Other" zobrazené jako text input, ne jako labeled option

Alternativní nástroje:
- **Custom MCP tool** — Agent SDK ano, slash commands NE. Out of scope pro tento plán.
- **flow:question-protocol** — batching wrapper kolem AskUserQuestion, neopravuje constraint.
- **Plain prose** — clean UX pro free-text capture, no tool overhead.

Best-practice z Anthropic cookbook: "When you need free-text + skip with structured UI, design 2 options that work WITH auto-Other (skip + 'use custom value' guide)." Tj. accept 3-item UI.

### DF-8 — Stage 1 plain prose v 3 batches FUNGUJE
Full dry-run validated: 11 promptů ve 3 batches (PŘÍPRAVA 1–4 · PROSTOR 5–7 · DUŠE 8–11) = 3 user turns total. User odpovídá v jednom message per batch, formátování dle `**N. ...**` headers parser jasně rozdělí. Žádná friction, žádná konfuze ohledně "kde napsat odpověď". Pattern adopted ✓.

### DF-9 — Rich vision-brief.json výrazně přebíjí current one-liner brief
V dogfood vision-brief obsahoval 11 distinct fields s konkrétními signály ("Swiss Helvetica + Grid", "silná typografie + motion design jako OST", explicit anti-refs Vercel + shadcn). Tohle dává research agentovi tight zaměření — confidence skóre per decision smysluplně varíruje (0.65–0.92). Current one-liner brief generuje generic research; rich vision-brief generuje targeted research. **Tohle je hlavní lift v aesthetic-score, který nový flow přináší.**

### DF-10 — Stage 3 batched AskUserQuestion (4 Qs per call) funguje bez friction
Dogfood: 4 refinement questions batched v 1 AskUserQuestion call (per DF-2 max). User vyřešil 3 picks na recommendation + 1 swap na alternativu. Žádná frustrace. Pattern adopted ✓.

### DF-11 — Confidence-based question count je legit ROI lift
Dogfood: research agent uzavřel 2 decisions sám (typography 0.92 · signature 0.85) → Stage 3 měl jen 4 otázky místo 6. V ideálním běhu (rich brief + strong consensus) může být Stage 3 0–2 otázky. Vs. current 12-Q fixed by user dělal všech 12 vždy. **Adaptive question count = real user-time savings.**

### DF-12 — Stage 2 simulation v dry-runu byl adequate proof-of-concept
V live runu bude actual `ux-research-agent` trvat ~30–60s WebSearch. Dry-run-simulated payload (s plausible content + confidence skóre) plně postačil k validation flow shape. Live implementation potřebuje progress indicator během research wait.

### Findings backlog

| ID | Topic | Status | User decision needed |
|---|---|---|---|
| DF-1 | AskUserQuestion max 4 options | informational | — |
| DF-2 | AskUserQuestion max 4 Qs per call | informational | — |
| DF-3 | Auto-Other mandatory affordance | informational | — |
| DF-4 | Stage 1 free-text pattern | **resolved** — plain prose | — |
| DF-5 | No internal jargon v descriptions | informational | — |
| DF-6 | Dry-run musí číst plán | informational | — |
| DF-7 | AskUserQuestion deep research | **resolved** — constraints documented | — |
| DF-8 | Stage 1 plain prose batches | **validated in dogfood** | — |
| DF-9 | Rich vision-brief.json value | **validated in dogfood** | — |
| DF-10 | Stage 3 batched 4-Q AskUserQuestion | **validated in dogfood** | — |
| DF-11 | Confidence-based question count | **validated in dogfood** | — |
| DF-12 | Stage 2 simulation adequate | informational | — |

**Dry-run conclusion (2026-05-20):** Flow has spine, structurally valid. User reaction: "celkově mě to docela bavilo, myslím že ten celý flow má páteř". Typos v promptech k vytunění při implementaci.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ARCHIVE current discovery as `_DISCOVERY-v1.md` reference

- **Do**: Extract lines 99-200 from `plugins/design/skills/design-system/SKILL.md` (the current 12-Q discovery section) into a new file `plugins/design/skills/design-system/_DISCOVERY-v1.md` with a `> DEPRECATED — kept as reference for transition window` header. SKILL.md will be rewritten in Task 2; the v1 reference lets contributors compare.
- **Pattern**: Just copy-paste with the deprecated banner; no edits.
- **Validate**: `wc -l _DISCOVERY-v1.md` ≥ 100. `head -3` shows the deprecation banner.

### Task 2: REWRITE SKILL.md discovery section as 3-stage flow

- **Do**: Replace lines 99-200 in `SKILL.md` with new sections:
  - "Stage 0 — Scope gate"
  - "Stage 1 — Vision (11 free-text prompts, conversational)" — full prompt text from Solution section above, verbatim
  - "Stage 2 — Research (no user input)" — schema extension + Pastier probe templates inline
  - "Stage 3 — Refinement (adaptive, 0–N Qs)" — confidence-band logic + Maják 3-code Q template
  - "Confirm step"
  - "Post-scaffold gate — 4 kola značky" (renames existing critic panel block)
- **DELETE**: SKILL.md lines ~156-169 ("Fallback option ladders" section). Replace with one paragraph: `"Pokud Round 0 selže (no payload written), skill ZASTAVÍ flow a nabídne re-run Stage 1 nebo abort. Žádné hardcoded ladders nedegradují quality."`
- **Pattern**: Match SKILL.md voice (terse, technical, no AI-tell punctuation). User-facing prompts (Stage 1) jsou single-spaced, with example + skip option built in.
- **Gotcha**: AskUserQuestion supports max 4 questions per call. Stage 1 prompts P1–P11 are **11 separate AskUserQuestion calls** (each with skip-or-answer pattern). Stage 0 is 12th call. Total 12 calls + free-text follow-up steps. **This is more turns than current flow** — accept it; user said "menší krůčky" je preferred.
- **Validate**: `grep -c "Stage 0\|Stage 1\|Stage 2\|Stage 3" SKILL.md` ≥ 8. `grep "Fallback option ladders\|fallback ladder" SKILL.md` returns 0 hits. `grep "P[1-9]\|P1[0-1]" SKILL.md` returns ≥ 11 hits (all prompts referenced).

### Task 3: CREATE _pastier-probe-templates.md (research agent reference)

- **Do**: Write `plugins/design/skills/design-system/_pastier-probe-templates.md` (~150 lines). Contains the 5 probe templates (A. Ulice / B. Zrcadlo+Charakter / C. OST / D. Kmen / E. Confidence) with verbatim text from Solution > Stage 2 above, plus 1 worked example per template (fictional vision-brief.json → probe → expected research output).
- **Pattern**: Mirror `_MAPPING.md` structure (sectioned, table-heavy, code-block-rich).
- **Gotcha**: ux-research-agent loads this at runtime. Keep paths absolute and discoverable (note in agent.md file frontmatter).
- **Validate**: File exists, ≤ 200 lines, each probe template has 1 example.

### Task 4: UPDATE ux-research-agent.md — payload schema + agent prompt

- **Do**: Two changes in `plugins/design/agents/ux-research-agent.md`:
  1. **Agent prompt section** (~lines 105-130): add Pastier probe templates inline (or via Read of `_pastier-probe-templates.md`). Add instruction to compute `confidence` per design decision.
  2. **Payload schema** (~lines 130-252): add `recommendations` block per the Solution > Stage 2 schema. Keep all existing fields (backward-compat for callers that read them).
- **Pattern**: Existing schema docs in agent.md are JSON-schema-flavored markdown — add the new `recommendations` block in the same shape.
- **Gotcha**: The agent's confidence calculation is non-trivial. Add a 3-bullet heuristic in agent prompt: high (1.0) = brief specific + research consensus; mid (0.7) = brief vague but research found consensus; low (0.4) = brief vague + research conflicted; null = no payload (flow stops).
- **Validate**: `grep "recommendations" ux-research-agent.md` ≥ 3 hits. `grep "confidence" ux-research-agent.md` ≥ 5 hits. Existing fields (mood_clusters etc.) still present.

### Task 5: UPDATE setup-ds.md — rewrite brief guidance for Stage 1

- **Do**: In `plugins/design/commands/setup-ds.md` lines 34-37 (brief content guidance), replace ✅ / ❌ bullet list. New text:
  ```
  Brief content guidance:
  - Stage 1 of discovery is conversational — skill tě provede 11 malými 
    otázkami, každá s příkladem. Nemusíš nic vědět dopředu.
  - Pokud máš v `<brief>` argumentu jen one-liner, použije se jako P1 
    (project description); zbylých 10 prompts skill položí postupně.
  - Pokud chceš dát skillovi víc paliva, klidně v `<brief>` rovnou popis 
    víc do hloubky — Stage 1 prompts které máš v textu zachycené 
    se PŘESKOČÍ a skill se zeptá jen na ty zbývající. Stages 2 + 3 
    běží vždy.
  - Žádné Pastier vocabulary není potřeba — skill se postará o interní 
    mapping na jeho kapitoly.
  ```
- **Pattern**: Keep terse; remove the existing "what helps research vs what biases it" detail (žil v current flow context).
- **Gotcha**: Examples section (lines ~27-31) — Add one example with full Stage-1-style brief: `/design:setup-ds project "Je to recept manager kde nastavíš počet porcí a on přepočítá ingredience. Pro mě a 3 kamarády. Chci aby to vypadalo jako kuchařka z 80s, ne jako moderní food app s velkými fotkami."`
- **Validate**: `grep "Stage 1\|Pastier" setup-ds.md` reflects new guidance.

### Task 6: CREATE DDR-NNN-three-stage-discovery.md

- **Do**: Write `.ai/archive/decisions/DDR-NNN-three-stage-discovery.md` (resolve NNN by `ls .ai/archive/decisions/ | tail -1`). Document:
  - **Decision**: nahradit 12-Q fixed dotazník 3-stage (Vision → Research → Refinement) flow s 0 hardcoded ladders v Stage 3.
  - **Why**: visual-first inversion + "3 codes stačí" princip ignorován + hardcoded fallback ladders byly bias source + scope-agnostic assumptions.
  - **Alternatives considered**:
    - (a) iterative refinement of current 12-Q (Pastier vocab as derivation inputs) — rejected: too many hardcoded ladders survived (see `archive/v1`).
    - (b) drop discovery entirely, auto-derive everything from one-liner brief — rejected: brief is too sparse; designer-grade output needs designer-grade input.
    - (c) chosen 3-stage — abstract → research → concrete, mirrors real designer workflow.
  - **Consequences**:
    - Stage 1 = 12 AskUserQuestion calls (was 3 for previous Round 1-3). More turns, but each is smaller and skippable.
    - Re-bootstrap mode lossy on Stage 1 fields (existing DSes don't carry vision-brief).
    - Research agent becomes load-bearing — if it fails, flow stops; no degradation path.
  - **Migration**: zero migration for read flow (token CSS contract unchanged). Re-bootstrap of existing DSes infers vision-brief from README "What this DS is for" + lossy guess on character / OST / lineage; user corrects in confirm step.
- **Pattern**: Mirror `.ai/archive/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md` shape.
- **Validate**: File exists; frontmatter has DDR-NNN; alternatives section lists at least 3 alternatives considered.

### Task 7: UPDATE user memory `feedback-design-bootstrap-workflow.md`

- **Do**: Rewrite the memory to reflect 3-stage. Keep ≤ 30 lines. Mention: "Stage 1 = 11 conversational free-text prompts (Pastier-templated, not Pastier-visible); Stage 2 = research with rich vision-brief; Stage 3 = refinement of research recommendations, 0 hardcoded ladders." Link `[[feedback-setup-ds-quality-gate]]`.
- **Validate**: `wc -l memory/feedback-design-bootstrap-workflow.md` ≤ 30.

### Task 8: UPDATE CLAUDE.md — pointer to probe templates

- **Do**: In CLAUDE.md "Design plugin" section "Entry points" list, add bullet: `plugins/design/skills/design-system/_pastier-probe-templates.md` — "Pastier probe templates fed to ux-research-agent during Stage 2".
- **Validate**: `grep "_pastier-probe-templates" CLAUDE.md` returns the new bullet.

### Task 9: SMOKE TEST — dry-run 3-stage flow on fictional brief

- **Do**: Manual paper-trace. Pick 2 fictional briefs (one rich, one one-liner) and walk through Stage 0 → Stage 1 (answer P1-P11) → Stage 2 (predict what research payload would look like) → Stage 3 (predict question count + confidence distribution). Capture in `.ai/plans/notes/setup-ds-3stage-smoke-trace.md`.
- **Pattern**: Two fictional briefs:
  - Rich: "recipe scaler for serious home cooks, retro cookbook aesthetic, signature žlutá je důležitá"
  - Sparse: "internal dashboard"
- **Validate**: Trace exists; for each brief, lists Stage 3 question count (rich should be ≤ 3 questions, sparse should be 7+).

### Task 10: REBRAND critic panel output as "4 kola značky"

- **Do**: In SKILL.md "Aesthetic critic panel (mandatory)" section (~line 596) and "Always-print next steps" template (~line 629), rename:
  - "Structural gate — design-system-completeness-critic:" → "Kolo 1 — Srozumitelnost:" (completeness + a11y)
  - "Aesthetic gate — critic panel:" → "Kolo 2 — Atraktivita:" (graphic-design + signature-moment)
  - (no current header) → "Kolo 3 — Konzistence:" (typography + brand + copy critics)
- **Pattern**: Reuse existing critic-output structure; only the section headers change.
- **Gotcha**: Critic agents themselves stay named as-is (no rename of `graphic-design-critic.md` etc.). Only the **reporting block** in skill output groups them under Pastier's 4 kola names.
- **Validate**: `grep "Kolo 1\|Kolo 2\|Kolo 3" SKILL.md` returns the 3 new headers. `grep "Aesthetic gate\|Structural gate" SKILL.md` returns 0 hits in the reporting block.

---

## Validation

1. **Markdown structure** — `grep -c "^##\|^###" SKILL.md` ≥ previous count + 5 (new Stage 0/1/2/3 + post-scaffold).
2. **No hardcoded ladders** — `grep -i "fallback option ladders\|fallback ladder" SKILL.md` returns 0 hits.
3. **Schema backward-compat** — diff `ux-research-agent.md` payload schema; existing fields (`mood_clusters[]` etc.) are byte-identical; only new `recommendations` block + new internal fields added.
4. **Smoke trace** (Task 9) — closed end-to-end without spec gaps.
5. **`mdcc init` regression** — `node cli/bin/mdcc.mjs init --dry-run --name test` in `/tmp/scratch-3stage/`; unchanged.
6. **Plugin marketplace reload** — `/plugin marketplace add /Volumes/D/git/claude-design` + `/reload-plugins`; `/design:setup-ds --help` shows updated description.
7. **DO NOT live-run setup-ds** against any real project during execution. Live testing only after smoke + DDR are in place; only against `/tmp/scratch-*` directories user explicitly approves.

---

## Acceptance Criteria

- [ ] Task 1-10 completed.
- [ ] SKILL.md discovery uses Stage 0/1/2/3 architecture; lines 156-169 fallback ladders deleted.
- [ ] `_pastier-probe-templates.md` exists, ≤ 200 lines, 5 templates each with 1 example.
- [ ] `ux-research-agent.md` payload schema has new `recommendations` block; existing fields preserved.
- [ ] `setup-ds.md` brief guidance reflects 3-stage flow.
- [ ] DDR-NNN documents decision + alternatives (≥3) + consequences.
- [ ] User memory refreshed (≤ 30 lines).
- [ ] Smoke-trace in `.ai/plans/notes/` for 2 fictional briefs.
- [ ] CLAUDE.md points to `_pastier-probe-templates.md`.
- [ ] Critic panel output rebranded to "4 kola značky" (Srozumitelnost / Atraktivita / Konzistence).
- [ ] No live setup-ds run against a real project during execution.

---

## Open questions

1. **AskUserQuestion + free-text capture** — current pattern is `[Napsat odpověď →, Přeskočit]` 2-option Q followed by next-turn free-text capture. Funguje to v praxi (jeden user turn lost na "Napsat odpověď"), nebo bychom měli najít čistší pattern? **My recommendation: accept the extra turn, it's the price of "small steps" UX.**

2. **Stage 1 prompt count — 11 jako sweet spot?** Můžeme collapsovat P2+P3 (Zrcadlo úspěch + hodnoty), P5+P6 (Ulice lineage + anti-references) na 6 promptů místo 11. Méně turns. **My recommendation: keep 11 — user explicitly said "menší krůčky"; consolidation undoes that.**

3. **Re-bootstrap inference** — pro existující DSes (např. md-claude vlastní `.design/system/project/`) Stage 1 fields nemáme. Akceptable: skill inferuje z README + tokens (lossy), prompts user na confirm step "tady je co jsem si přečetl, opravit?". **My recommendation: accept lossy inference; user může vždy --force re-bootstrap.**

4. **`<brief>` argument shortcut** — pokud uživatel napíše rich brief jako argument (např. `/design:setup-ds project "recipe scaler, retro cookbook, signature žlutá..."`), skill rozpozná že brief covers P1+P5+P10 a přeskočí je. Logic je heuristická (keyword match). **Risk:** false positives. **My recommendation: implement, ale vždy log "skipping P5 because <reason>" do confirm step, aby uživatel věděl co se přeskočilo a mohl opravit.**

5. **"4 kola" rename — neuškodí to clarity?** Stávající "Structural / Aesthetic" gates jsou tech-style; "Srozumitelnost / Atraktivita / Konzistence" jsou marketing-style. **My recommendation: keep both — primary header je Pastier-style, sub-line je tech-explanation. Best of both.**

Tyhle 5 jsou jediné genuine fork points. Defaults v "my recommendation" lze přijmout en bloc — řekni "all default" a běžíme execute.

---

## Retro (2026-05-20, /flow:done)

**What worked**

- **Plain-prose Stage 1** (DF-4 → DF-8) was the right call — the AskUserQuestion ceiling deep-research saved us from shipping a broken Stage 1. The dry-run that produced DF-8 also caught the typo + parser-boundary edge cases before the SKILL.md rewrite locked them in.
- **Dogfood findings backlog (DF-1 … DF-12)** carried load-bearing context across multiple plan iterations and the implementation pass. Permanent IDs (never reindexed) made it trivial to cross-reference rules in commits / DDR / smoke trace without ambiguity.
- **Sequencing T10 before T9** (rebrand critic-panel headers before paper-tracing) meant the smoke trace could reference final shape, not a moving target.
- **`_DISCOVERY-v1.md` archive** kept the v1 diff legible without bloating SKILL.md history. Future contributors comparing 3-stage vs 12-Q have a single artifact to read.

**What didn't**

- **First T2 edit left v1 content in place below the new section** — the SKILL.md old-string boundary was too narrow on the first pass; needed a second pass to delete lines 391–488. Lesson: when replacing a multi-section span, anchor the `old_string` on a sentinel BEYOND the last section you want to keep.
- **`_pastier-probe-templates.md` overshot the 200-line cap on first write** (235 → 191 after trim). Worked examples were padded with redundant comments. Lesson: a "worked example" should be the smallest object that illustrates the shape, not a fully-realized payload.
- **One residual `fallback ladder` literal in SKILL.md** survived two grep validations — the third grep (caps-insensitive) caught it. Lesson: the validation grep ITSELF needs to match the validation regex the plan declared. If the plan grep is `-i`, the author check should be `-i`.

**What to change in `/plan` or `/execute` next time**

- **Plans that do multi-section file rewrites should declare anchor sentinels** (a "first line to keep AFTER the deletion" string) in the task, not just "replace lines 99-200". Line numbers go stale the moment the first task lands.
- **Validation greps must include the case / regex flag in the published check.** "0 hits on `fallback ladder`" is ambiguous between `grep` and `grep -i`; the latter is stricter. Spell it out.
- **For docs-and-spec-only plans, /done should skip the cross-platform scenario gate explicitly**, not silently — surface "no scenario applicable for this change shape" as a green tick instead of an empty section.

