# Pastier probe templates — Stage 2 research scaffolding

> **Audience:** the `design:ux-research-agent` (mode `discovery`) when invoked from `/design:setup-ds` Stage 2.
> **Authority:** structures the agent's WebSearch + analysis. Runs alongside the source-type-driven breadth in `_ux-research-config.json` (Rule 1 of `agents/ux-research-agent.md`) — this file is the second, input-field-driven axis.
> **Owner:** `design-system` skill at `SKILL.md` Stage 2. Ships with SKILL.md.

Each template names: (1) which `vision-brief.json` fields drive it, (2) what the agent looks for, (3) what payload fields it populates, (4) one worked example.

Pastier-chapter mapping: A=Ulice · B=Zrcadlo+Charakter · C=OST · D=Kmen · E=meta-probe.

---

## A. ULICE — design lineage discovery

**Input fields:** `design_lineage` · `tired_tropes_to_avoid` · `anti_aesthetics`

**Action:** find 5–8 design systems / products in the named lineage. For each, document: signature visual treatment, typography family, color discipline, density. **Cross-check against `tired_tropes_to_avoid` + `anti_aesthetics` — any reference that matches the user's anti-list is repurposed as an `anti_references[]` entry, NOT a positive anchor.**

If `design_lineage == "research, surprise me"`, infer lineage from `primary_emotion` + `elevator_pitch` + `audience` and explore 3 candidate lineages in parallel (one query per).

**Balance the canon (DDR-073 anti-monoculture).** The default surfacing skews to the "quiet editorial" canon (Stripe/Vercel docs, Linear, Are.na). When any expressiveness signal is present — `aesthetic_ambition_signal`, a playful/bold/joyful `primary_emotion`, a colour-forward `design_lineage`, or a creative-tool `audience` — you MUST also query the **colour-forward / maximalist canon**: Figma, Figma Config, Canva, Affinity, Gumroad, Arc, Framer, Pitch, Cosmos, Spline, Linear's *marketing* site, Stripe *marketing*. Surface these as real anchors when the character calls for it; don't reflexively map a vivid brief onto a minimal reference.

**Populates:** `mood_clusters[]` (3 clusters anchored in lineage products) · `reference_products[]` (5–8 entries) · `anti_references[]` (2–3 entries from user's anti-list cross-checked against actual products).

**Worked example:**

```jsonc
// vision-brief.json fragment → agent runs 5 queries (lineage + anti-trope)
{
  "design_lineage": "editorial like Stripe docs + retro arcade like itch.io",
  "tired_tropes_to_avoid": "purple-pink gradient hero, bento grid landing pages"
}
// Expected mood_clusters[] entry
{
  "id": "editorial-arcade",
  "label": "editorial-arcade (Stripe docs × itch.io × Are.na)",
  "anchors": ["Stripe docs", "itch.io browse", "Are.na block"],
  "one_line": "Long-measure serif body with playful display moments — calm reading meets controlled mischief."
}
```

---

## B. ZRCADLO + CHARAKTER — character grounding

**Input fields:** `success_essay` · `values` · `primary_emotion` · `author_voice`

**Action:** find products / portfolios whose authors describe their work with similar values / emotion. **Use these as VOICE anchors, not visual anchors** — the goal is to populate `voice_tone_options[]` with real, attributable copy from products that share the user's character.

Query patterns: search for case-study copy, about-page copy, README voice in projects whose author-bios resonate with `author_voice`. The `sample_microcopy` field in the payload should be **lifted verbatim** (with attribution) from one anchor product per option.

**Populates:** `voice_tone_options[]` (3 tones, each anchored to a real product whose copy embodies it) **AND `recommendations.aesthetic_ambition` (the anchor, DDR-073).**

### B.2 Aesthetic temperature read (feeds the `aesthetic_ambition` anchor)

From the same character anchors PLUS `design_lineage` (Probe A) and the chroma of the products you surfaced, infer where the brand sits on the `restrained → confident → expressive → maximalist` scale. **Read both ends honestly — this is the primary signal for the anchor decision.**

- **Restrained signals:** quiet/craftsman/calm voice; editorial or terminal lineage; anchors are low-chroma, mono, lots of negative space (Linear, Stripe docs, Vercel, Robin Rendle, Are.na).
- **Expressive/maximalist signals:** playful/bold/joyful/"experimentátor" voice; colour-forward or creative-tool lineage; anchors lean multi-accent, gradient, colour-as-structure (Figma, Figma Config, Canva, Gumroad, Arc, Framer, Pitch, Linear's *marketing* site, Stripe *marketing*).
- **Confident** sits between (one strong accent + support); **maximalist** is the far end (colour is the structure).

**Mandatory anti-bias guard:** the model defaults to "tasteful minimal". Before recommending `restrained`/`confident`, you MUST have actively considered the expressive end and be able to name *why you ruled it out* — and write that into the `aesthetic_ambition.rationale` audit clause. **No clear signal either way ⇒ confidence `< 0.60` ⇒ Stage 3 asks; absence of signal is NEVER read as `restrained`.**

**Worked example (both ends):**

```jsonc
// Quiet end — character + lineage cluster low-chroma
{ "values": "perfekcionismus na detailech", "primary_emotion": "soustředění", "design_lineage": "editorial Stripe docs" }
// → aesthetic_ambition: { "recommendation": "restrained", "alternatives": ["confident", "expressive"], "confidence": 0.82,
//      "rationale": "quiet-craftsman voice + Stripe-docs lineage + every anchor low-chroma → restrained; considered confident, ruled out: no colour-forward cue in brief or anchors." }

// Expressive end — playful voice + creative-tool lineage cluster colour-forward
{ "values": "hravost nad formálností", "primary_emotion": "radost", "design_lineage": "Figma / Gumroad / Arc", "ds_signature_hypothesis": "výrazné barvy" }
// → aesthetic_ambition: { "recommendation": "expressive", "alternatives": ["confident", "maximalist"], "confidence": 0.8,
//      "rationale": "playful joyful voice + Figma/Gumroad lineage + signature='výrazné barvy' + anchors multi-accent → expressive; restrained ruled out (every signal is colour-forward)." }
```

**Worked example (voice tone):**

```jsonc
// vision-brief.json fragment → agent finds portfolios whose authors describe
// themselves as craftsmen / detail-obsessive / quiet
{
  "values": "Vždycky perfekcionismus na detailech",
  "primary_emotion": "soustředění",
  "author_voice": "klidný řemeslník"
}
// Expected voice_tone_options[] entry
{
  "id": "quiet-craftsman",
  "label": "quiet-craftsman (anchor: Robin Rendle's blog)",
  "anchor_examples": ["robinrendle.com", "Are.na editorial"],
  "characteristics": ["Sentences hold one idea; no marketing intensifiers.", "Lowercase headings; punctuation does the lifting."],
  "sample_microcopy": "A blog about typography and the quiet pleasures of slow CSS.",
  "recommended": true
}
```

---

## C. OST — signature direction

**Input fields:** `ds_signature_hypothesis` · `ds_signature_anti`

**Action:**

- **If hypothesis is specific** (e.g. `"signature žlutá"`, `"CRT motion na přechodech"`): find 3–5 products that nail that direction; recommend a refined version (e.g. a specific OKLCH yellow range with rationale, a specific motion choreography with anchor URL).
- **If hypothesis is `"research, surprise me" / null`**: propose 3 candidate signatures based on `design_lineage` + `primary_emotion`, each classified into a Q9 signature-treatment family from `_MAPPING.md`.
- **When `aesthetic_ambition ≥ expressive` (DDR-073):** include the colour-led families among the candidates — `chromatic-blocks` (colour-as-structure; Memphis / Canva / Figma Config) and `gradient-mesh` (mesh/aurora backdrop; Figma / Stripe marketing). The subtle families (`chrome-glow`, `inset-recess`) under-deliver for an expressive/maximalist brief, so don't make them the only options.
- **Always:** check `ds_signature_anti` and ensure no candidate violates it.

**Populates:** `signature_treatment_options[]` (3 entries, `family` field set per Rule 4) · `recommendations.signature_treatment.{recommendation, alternatives, confidence, rationale}`.

**Worked example:**

```jsonc
// vision-brief.json fragment → agent refines hypothesis into specific OKLCH range
{
  "ds_signature_hypothesis": "signature žlutá je důležitá",
  "ds_signature_anti": "určitě ne font, neumím to ohlídat"
}
// Expected signature_treatment_options[] entry
{
  "id": "signature-yellow-chrome-glow",
  "label": "signature žlutá chrome-glow (anchor: vintage cookbook ochre)",
  "family": "chrome-glow",
  "anchor_examples": ["vintage Penguin cookbook 1971", "Foxie.io accent"],
  "why_in_domain": "Recipe / cookbook tradition leans warm ochre / mustard; not bright lemon.",
  "recommended": true
}
// Expected recommendations.signature_treatment
{
  "recommendation": { "id": "signature-yellow-chrome-glow" },
  "alternatives":   [{ "id": "signature-yellow-body-pattern" }, { "id": "warm-paper-frosted-blur" }],
  "confidence": 0.90,
  "rationale": "User hypothesis specific + research consensus on warm-ochre over lemon-yellow in cookbook tradition. Anti-list excludes typography signatures."
}
```

---

## D. KMEN — audience-driven density

**Input fields:** `audience` · `scope` (from Stage 0)

**Action:** research density conventions for the named audience. Pro tools lean dense; consumer mobile leans roomy; personal projects lean to author's preference (default roomy unless `author_voice` includes "terminal" / "dense" / "compact"). Internal tools take their cue from the team's existing tool habits.

**Populates:** `density_options[]` (3 entries, `family` field set per Rule 4) · `recommendations.density.{recommendation, alternatives, confidence, rationale}`.

**Worked example:**

```jsonc
// vision-brief.json fragment → scope=personal + author "klidný" → roomy bias
{ "scope": "personal", "audience": "Jen pro sebe, je to portfolio", "author_voice": "klidný řemeslník" }
// Expected density_options[] entry
{
  "id": "roomy-editorial",
  "label": "roomy-editorial (anchor: Robin Rendle, Frank Chimero)",
  "family": "roomy",
  "anchor_examples": ["robinrendle.com", "frankchimero.com"],
  "domain_rationale": "Long-measure body, generous vertical rhythm — reading mode for a personal portfolio.",
  "recommended": true
}
```

---

## E. CONFIDENCE EVALUATION — meta-probe

**Input:** all of Probes A–D output, plus per-decision research consensus from WebSearch results.

**Action:** compute a confidence value in `[0.0, 1.0]` for each decision in `recommendations`. **Evaluate the anchor `aesthetic_ambition` FIRST (DDR-073)** — the structural knobs (`accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio`) inherit its confidence and direction, so they are NOT scored as independent conservative defaults. For every decision (`aesthetic_ambition`, `palette`, `typography`, `signature_treatment`, `majak_3_codes`, `density`, `voice`):

| Score | Heuristic |
|---|---|
| **0.85–1.00** | vision-brief is specific AND research found strong consensus across ≥ 3 anchors |
| **0.60–0.85** | vision-brief is specific OR research found consensus — but not both |
| **0.40–0.60** | vision-brief is vague AND research found conflicting evidence; usable but flag it |
| **< 0.40** | vision-brief is vague AND research found nothing useful — flag for user input in Stage 3 |
| **`null`** | agent failed entirely (no payload written) — Stage 3 cannot proceed; flow stops |

The `rationale` field is **mandatory** for every recommendation — it's what the user sees in Stage 3 to understand WHY the skill is recommending what it is. Format: one sentence naming the vision-brief input(s) + the research evidence + the resulting recommendation.

**`aesthetic_ambition` confidence rule (DDR-073) — anti-funnel safeguard.** Score it by how strongly the Probe A+B anchors cluster on ONE temperature:

| Score | When |
|---|---|
| **0.85–1.00** | Voice + lineage + anchor-chroma all agree on one pole (e.g. every anchor low-chroma editorial → `restrained`; every anchor multi-accent creative-tool → `expressive`). |
| **0.60–0.85** | Most signals agree but one pulls the other way. |
| **< 0.60** | Mixed or absent signal — **Stage 3 asks across the full scale.** This is the correct score for "I can't tell"; do NOT round it up to a confident `restrained`. |

**Mandatory audit clause:** whenever `aesthetic_ambition.recommendation` is `restrained` or `confident`, the `rationale` MUST name the expressive end you considered and why you ruled it out (forces justification, counters the model's minimal-bias). A `restrained` recommendation with no audit clause is a fail.

**Worked example:**

```jsonc
{
  "recommendations": {
    "palette": {
      "confidence": 0.85,
      "rationale": "primary_emotion='soustředění' + design_lineage='editorial Stripe docs' → cool-neutral L 58-65, C 0.08-0.12, H 200-240. Anchored on Stripe + Vercel docs."
    },
    "majak_3_codes": {
      "recommendation": ["barva", "font", "motion"],
      "alternatives":   [["symbol", "barva", "voice"], ["font", "tvar", "vzor"]],
      "confidence": 0.70,
      "rationale": "OST hypothesis ('CRT motion') → motion is a code. Lineage 'editorial' → font is a code. Third 'barva' because scope=personal needs distinctive recognition."
    }
  }
}
```

---

## Hard rules (summary)

1. Every probe writes its output into the canonical `discovery` payload schema (see `agents/ux-research-agent.md` payload schema for the merged shape).
2. **Confidence is mandatory** on every decision in `recommendations` — if a probe cannot estimate it, set it to `0.0` and surface that as a Stage 3 hard input.
3. **Real products only** — every anchor named in any payload field MUST be an identifiable real product or portfolio surfaced through WebSearch. Training-data assertions without WebSearch evidence count as `fallback_used: true`.
4. **Family classification (Rule 4 of agent.md) applies to C + D outputs** — every `signature_treatment_options[].family`, `iconography_vibe_options[].family`, and `density_options[].family` MUST classify into a `_MAPPING.md`-catalogued family.
5. **No probe surfaces Pastier vocabulary in user-facing fields.** "Pastier", "Zrcadlo", "OST", etc. live only in the agent's INTERNAL reasoning and the `_pastier_chapter_coverage` audit field — never in `label`, `description`, `rationale`, or `sample_microcopy`.

## Cross-links

- Caller skill (Stage 2 invocation point): `plugins/design/skills/design-system/SKILL.md` § Stage 2
- Agent definition: `plugins/design/agents/ux-research-agent.md`
- Runtime WebSearch category config: `plugins/design/agents/_ux-research-config.json`
- Family classification catalog: `plugins/design/templates/design-system-inspiration/_MAPPING.md`
