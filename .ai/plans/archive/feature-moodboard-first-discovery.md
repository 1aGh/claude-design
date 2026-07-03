# Feature: Moodboard-first discovery — `/design:setup-ds` stage reorder + moodboard hardening

Validate docs and codebase patterns before implementing. Pay attention to existing naming, spec cross-links, and the "pointer, not restatement" doc convention (canonical spec lives in `_bootstrap.md`; every other file points at it).

## Description

Reorder the design-system bootstrap discovery so the **design-language moodboard becomes the primary direction-communication vehicle**: it moves from Stage 4 (after refinement + prose Confirm) to directly after Stage-2 research, defaults to **~3 genuinely distinct directions** (seed-composed, cheap), the user **picks a direction first**, and only then answers a **slimmed refinement** scoped to the residue the pick didn't settle. The moodboard content and pick-gate copy are hardened with research-grounded direction-board methodology (style-tile/element-collage hybrid anatomy, choice-architecture, anti-Frankenstein mix handling).

## User Story

As a **non-designer bootstrapping a design system**, I want **to see ~3 rendered visual directions before being asked refinement questions** so that **I can react to real type/color/treatment in context ("nobody knows what font they want until they see it used") instead of answering abstract questions in a visual vacuum**.

## Problem

Today's flow (Stage 0 scope → Stage 1 vision → Stage 2 research → **Stage 3 refinement (abstract Qs: ambition, palette, typography, voice, density, treatment, majak codes, spacing, easing, width)** → prose Confirm → **Stage 4 moodboard** → scaffold) asks the user to decide palette/typography/ambition **as text** before they've seen a single pixel. The moodboard — the artifact that would let them *see* those decisions — arrives only after all decisions are made, demoted to a yes/no gate. Variant mode (2–3 directions) exists but is opt-in behind "Show more variants". Evidence (kanban dogfood transcript, 2026-07-03): a user answered 9 abstract refinement picks with "a / a / a / a … nechám na tobě" — the questions carried no signal a rendered board wouldn't have carried better.

## Solution

Converged architecture (3-seat relay debate, all seats **yes** after cross-challenge — see § Debate provenance):

```
Stage 0  Scope gate                      (unchanged)
Stage 1  Vision — 11 prose prompts      (unchanged, kept FULL — fuel for direction seeds)
Stage 2  Research — ux-research-agent   (unchanged mechanism; payload now seeds directions)
Stage 3  DIRECTION GATE (moodboard)     ← moved up; default ~3 seed-composed direction tiles,
         → pick / Mix / eliminate         main-agent-assembled, NO web, NO fan-out
Stage 4  REFINEMENT (residue only)      ← moved down; only axes the pick didn't settle: 1–3 Qs
LOCK     lock gate = the confirm        ← replaces the 3-sentence prose Confirm
Mapping → roster → Batch A → hero-preview gate → B+C → critics   (all unchanged)
```

Key decisions (D1–D11), each argued by at least one seat — the lead added none:

- **D1 — Reorder.** Moodboard directly after Stage 2; refinement after the pick. Stage 1 stays full (trimming it would starve the seeds — BUILDER).
- **D2 — Default-3 is CHEAP: main-agent, seed-only composition.** Up to 3 miniature direction tiles composed from the **already-computed Stage-2 payload** — `mood_clusters[i]` + its palette option + type pairing + treatment + the `reference_images[]` slice matched via `anchor → reference_products[].mood_tag` + the always-render CSS/SVG scrap layer. **No sub-agent fan-out, no per-variant WebSearch/WebFetch on the default path.** Divergence lives in *seed distinctness*, not the collage hand; one consistent hand isolates *direction* as the comparison variable (BUILDER's reframe, adopted by SHIPPER). *Recorded dissent:* BREAKER preferred 3 blind compose-only sub-agents (hand-divergence, parallel latency) — available via D3 escalation; revisit if dogfood shows same-y tiles.
- **D3 — Escalation tier.** The existing blind-parallel-sub-agent + per-variant-self-harvest variant machinery (DDR-080/DDR-136) is preserved **verbatim** as opt-in escalation ("wilder / richer variants", or drilling into a direction) — that's where craft-divergence + fresh imagery spend is justified.
- **D4 — Degrade rule (never fabricate a pole).** Tile count = number of **pairwise-distinct seeds** passing the existing gate (reject < 40° hue apart or ≥ 2 shared anchors); cap 3, floor 1. On `fallback_used` / thin research, present fewer — and surface the degrade as an **informed opt-in** ("research found 2 distinct directions — want a 3rd, richer web-sourced one? ~1–2 min"), never a silent drop and never a silent web charge (BREAKER's flipped top-risk mitigation).
- **D5 — Pick semantics + adjudication (DDR-073-safe).** The pick **SELECTS, it does not lock**. A pick settles **only the axes that visibly varied across the presented tiles** (always palette + `aesthetic_ambition`; `typography`/`signature_treatment` iff the tiles varied on them). Fields held constant — including inherited fields and uncontested ≥ 0.85 recommendations — keep their normal research-confidence gate. Every pick-driven override of a ≥ 0.85 field is logged to the bypass-log. Picking the recommended pole = affirmation; picking away = a *visible, visually-informed* earned deviation.
- **D6 — Refinement residue = abstract Qs for genuinely non-visual fields only.** `majak_3_codes`, `density`, `spacing_base`, `type_ratio`, `easing_personality`, `layout_max_w`, plus any `< 0.60` leftovers → typically **1–3 Qs (one AskUserQuestion batch)**. A static collage cannot show easing or a spacing scale — do NOT settle those from a pick (BREAKER). Visual adjustments ride the **existing Tweak loop** (swap swatch/font/treatment → re-screenshot → re-gate); no new residue-as-visual-swaps machinery (SHIPPER).
- **D7 — Single LOCK gate replaces the prose Confirm.** Order: tiles → pick/Mix → optional Tweak loop → residual Qs → **LOCK** ("lock this direction + residue → generate ~30–40 min?"). Lock is terminal; the locked artifact = {picked board visuals + refined residue} = exactly what Batch A consumes = the hero-preview gate's stable referent. Any post-lock edit re-locks and re-runs the hero gate. Net: one gate *removed* from the flow.
- **D8 — Sub-mode carve-outs.** `--quick` → 1 tile, auto-proceed-but-still-ask (unchanged contract). Autonomous (`pokracuj autonomně`) → 1 tile, auto-pick on clean self-read + bypass-log row; **never fans out**. `additional-ds` → inheritance picker stays **BEFORE** the moodboard (BAD-7 position preserved); inherited fields are **frozen across all tiles** (never a varied axis → never settled by a pick) and excluded from the residue. `re-bootstrap` → 1 tile (lossy low-confidence inferred vision must not seed 3 poles). `--no-discovery` → moodboard skipped entirely (unchanged).
- **D9 — Config knob, single source of truth.** `.design/config.json` → `moodboard.variants` (default **3**, min 1, cap 3). Additive property in `apps/studio/config.schema.json`; exported by `prep.sh --shell-export` as `MOODBOARD_VARIANTS`. Docs reference the knob, never restate literals ("default = 1 (cheap)" is currently restated across ≥ 5 files — the drift BREAKER flagged).
- **D10 — Governance.** New **DDR-147** supersedes DDR-080's cost clause ("default 1, variants opt-in via fan-out") and amends DDR-033's stage ordering; DDR-080 + DDR-136 get pointer banners (no second inline rewrite). The two-gate model (direction gate + hero-preview gate) and the "never under `system/<ds>/`" invariant are explicitly KEPT.
- **D11 — Moodboard hardening (research-grounded).** See § Research findings. Tile + board anatomy upgraded to a **style-tile/element-collage hybrid**; pick-gate copy upgraded with gut-first framing, fit-framing, per-direction rationale, eliminate-one fallback, and coherent Mix handling. Budget: net ≤ +80 lines in `_bootstrap.md` — ingredients **replace** the current miniature-tile spec text, they don't stack on it (SHIPPER's size guard; no new craft invariants beyond the anatomy swap).

## Metadata

- **Type**: Enhancement
- **Complexity**: High
- **App/Package**: `plugins/design` (spec/markdown) + `apps/studio` (config schema + prep helper) + `site` (docs) + `.ai/decisions`
- **Affected Systems**: design-system bootstrap flow (`_bootstrap.md`), `/design:setup-ds` command, design-system SKILL router, ux-research-agent payload docs, design config schema, public docs
- **Dependencies**: none new (no libraries — `flow:skill-loader` skipped: markdown-spec work only)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `plugins/design/skills/design-system/_bootstrap.md` (lines 58–135 discovery header + fallback shapes; 258–323 Stage 2; 324–383 Stage 3 + Confirm; 385–525 Stage 4 incl. variant mode/gating/outcomes; 527–552 sub-mode adaptations; 1035–1049 sequencing diagram) — Why: the canonical spec being restructured; every anchor above moves or is rewritten.
- `plugins/design/commands/setup-ds.md` (lines 12–14 mode descriptions, 23–24 `--quick`/`--imprint`, 88–105 step-3 numbered flow) — Why: restates the stage order in 3 places; must follow the reorder as pointers.
- `plugins/design/skills/design-system/SKILL.md` (line 17 BOOTSTRAP one-liner; frontmatter description) — Why: router enumerates the stage order + gates.
- `plugins/design/agents/ux-research-agent.md` (lines 145–178 discovery procedure; `_reference_images_doc`; 326–377 recommendations block + confidence heuristic) — Why: payload consumers change (tiles sliced per cluster; moodboard now pre-refinement); doc notes + cross-links must be updated — **payload schema itself is unchanged** (SHIPPER: zero new fields needed; `mood_clusters[]` already carries 3 pairwise-distinct clusters and `reference_images[].anchor → reference_products[].mood_tag` already slices imagery per cluster).
- `plugins/design/skills/design-system/_pastier-probe-templates.md` (§ E confidence heuristic) — Why: Probe E semantics feed Stage 3; verify wording still matches after refinement moves post-pick.
- `.ai/decisions/DDR-080-moodboard-direction-gate.md`, `DDR-136-…`, `DDR-033-…`, `DDR-073-…`, `DDR-043-…` — Why: the decisions being superseded-in-part/amended; DDR-147 must cite them precisely.
- `site/content/docs/design/bootstrap.mdx` (lines 22, 68, 78, 90) — Why: public docs restate the 3-stage order and sub-mode flows.
- `apps/studio/bin/prep.sh` (ACCENT_STRATEGY/COLOR_SPACE read + `--shell-export` emit, lines ~78–185) — Why: pattern for the `MOODBOARD_VARIANTS` knob export.
- `apps/studio/config.schema.json` — Why: additive `moodboard.variants` property lands here.

### Files to Create

- `.ai/decisions/DDR-147-moodboard-first-discovery-default-directions.md` — the governing DDR (D1–D11 above).

### Design canvases

No `*.meta.json` canvas matches the feature slug. Related on-disk evidence: `.design/_moodboard/maude-v2-variant-{A,B}.tsx` — **tracked legacy leftovers** of the pre-DDR-136 throwaway variant path (the dir was retired; these two files remained committed). Cleanup task included below.

### Documentation

- Research reports quoted in § Research findings (all claims carry source URLs there).

### Patterns to Follow

- **Pointer convention:** `setup-ds.md` step 3.5 → "Canonical spec in `_bootstrap.md` § … — this is a pointer." Reuse for every restated stage reference.
- **Config-routing pattern:** `accentStrategy`/`colorSpace` read in `prep.sh` (`jq -r '.accentStrategy // "single"'`) → mirror for `moodboard.variants // 3`.
- **Silencing precedent:** `additional-ds` inheritance picker — "inherited values … the corresponding `recommendations` entries are silenced (no Stage 3 Q on inherited fields, regardless of confidence)" (`_bootstrap.md:543`) → the template for pick-settled-axes silencing.
- **Bypass-log discipline:** every autonomous deviation/override → `_history/_system/<ds>-bypass-log.md` (existing rows table, `_bootstrap.md:44–54` of DDR-080 + Stage-4 section).

---

## Research findings (user-requested: moodboard techniques + direction communication)

Two web-research passes (formats/methodology + feedback-elicitation), all claims cited. Full reports in the debate transcript; the actionable distillate that drives D11:

**Format fit.** A code-rendered moodboard maps to a **style tile** (Samantha Warren, [A List Apart](https://alistapart.com/article/style-tiles-and-how-they-work/)) / **element collage** (Dan Mall, [danmall.com](https://v3.danmall.com/articles/rif-element-collages/)) **hybrid** — "for when a mood board is too vague and a comp is too literal." Its native strengths (live fonts, real OKLCH, UI fragments, real copy, motion) are precisely the highest-evidence direction cues; weakness at stock photography is a feature, not a bug ([wearediagram.com](https://www.wearediagram.com/blog/using-element-collages-to-improve-the-design-process)).

**Direction count + distinctness.** 2–3 strategically distinct directions is the practitioner norm; more dilutes decisions ([ebaqdesign](https://www.ebaqdesign.com/blog/logo-presentation), [wayfarerdesignstudio](https://wayfarerdesignstudio.com/blog/how-many-logo-concepts-should-you-present-to-your-design-clients)); choice-overload evidence: jam study 24-vs-6 options, 3% vs 30% conversion ([Laws of UX](https://lawsofux.com/choice-overload/)). Directions must be **distinct axes, not variations on one theme** ([agenciacomma](https://agenciacomma.com/en/specialized-communication/the-art-of-creative-territories/)); NN/g: differences "must be significant enough to be immediately detectable to a nondesigner" ([NN/g](https://www.nngroup.com/articles/testing-visual-design/)). → D4's distinctness-driven count.

**Tile/board anatomy (evidence-ranked ingredients).** (1) Type in context at real sizes, headline + body + UI label; (2) **color in proportion — 60/30/10 strip**, not equal chips ([freecodecamp](https://www.freecodecamp.org/news/the-60-30-10-rule-in-design/)); (3) ≥ 1 real higher-fidelity **UI fragment** (card/button set) — element-collage core; (4) **real copy, never Lorem** ([uxplanet](https://uxplanet.org/should-we-use-lorem-ipsum-in-product-design-f1a09b9fd3ec)) — already a payload invariant (`domain_nouns`); (5) dominant mood anchor / signature-treatment hero; (6) tone-of-voice words + short voice sample; (7) **one-line rationale per direction** — a board without its "why" invites taste-fights ([malbardesign](https://malbardesign.com/brand-identity-design-process-explained/)); (8) texture/material cues (CSS-native); (9) optional motion hint, reduced-motion-respecting.

**Elicitation + choice architecture.** Gut-first: 5-second first-impression before rationale ([NN/g](https://www.nngroup.com/articles/testing-visual-design/), [Maze](https://maze.co/collections/user-research/five-second-test/)). Ask **"which feels most like you / your customer"**, not "which do you like" ([ebaqdesign](https://www.ebaqdesign.com/blog/logo-presentation)). **Echo prior approved decisions** in the prompt ("you said calm + craft — B leans hardest into that") — "it's much more difficult to disagree with yourself." **Naming biases the pick** ([PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0178826)): use short *descriptive* feeling-names tied to brief attributes — not evocative marketing names, not bare A/B/C. **Recommended-flag**: unsettled in the literature; if flagged, state the *why* (tie to the brief), never stack weak decoys ([wayfarerdesignstudio](https://wayfarerdesignstudio.com/blog/how-many-logo-concepts-should-you-present-to-your-design-clients)). **Eliminate-one fallback** when the user stalls ("is there a direction we should definitely rule out?"). Anchoring: first-shown becomes the benchmark — don't lead the copy with one direction; present each fully, compare last ([cursorup](https://www.cursorup.com/blog/anchoring-bias), ebaqdesign).

**Frankenstein/Mix.** Expected, not a failure — standard move: element-by-element reaction, then **tweak a chosen base** ("base direction B + palette from A"), re-rendered as ONE coherent board — never token cut-and-paste across directions ([newsocksmedia](https://www.newsocksmedia.co.uk/post/stylescapes), [z-dd](https://www.z-dd.com/stylescape-upgraded-moodboard/), [alistapart](https://alistapart.com/article/style-tiles-and-how-they-work/) "Frankenstein" warning).

**Fidelity.** Rendered artifacts beat abstract questions (the user's core thesis, confirmed: [IxDF](https://ixdf.org/literature/topics/mockups)); but too-high fidelity drags feedback to the wrong layer ("client thinks about button colors instead of direction" — [uxmovement](https://uxmovement.com/wireframes/4-things-no-one-told-me-about-high-fidelity-wireframes/)) → keep **direction fidelity, not layout fidelity**; the existing "it's about the feeling" framing is correct and stays.

**AI-era caution.** The real failure mode of cheap generation is **same-y directions**, not too few (Big Human's Midjourney moodboard retro: derivative, "exploration felt disposable" — [bighuman.com](https://www.bighuman.com/blog/midjourney-ai-generated-mood-boards)) → D4's hard distinctness gate is the mitigation; treat the pick as a base to push off, expect a remix round (§ Frankenstein).

---

## Debate provenance (DDR-130 relay, 3 seats, cross-challenge round)

| Seat | Opening | Revised | Key contribution |
|---|---|---|---|
| BUILDER | yes 0.82 (default-3 via blind fan-out + self-harvest) | yes 0.8 — mechanism conceded | Seed-distinctness ≠ hand-divergence reframe → main-agent composition; pick-collapses-abstract-Qs; adjudication is native (tile A = recommended pole) |
| SHIPPER | yes 0.8 (pure reorder, reuse variant machinery) | yes 0.82 | Lock semantics (pick SELECTS, LOCK after residue = the confirm); residue stays abstract (non-visual by nature); config knob; fresh DDR not inline amendment |
| BREAKER | **no 0.82** (cost inversion = blocker) | **yes 0.78 — flipped**, 6 conditions | No-web-on-default binding constraint; bounded pick-override; sub-mode carve-outs; informed-opt-in degrade; density/easing never settled by a pick |

Residual recorded dissent: BREAKER prefers 3 *compose-only sub-agents* over main-agent composition for the default (hand-divergence); majority chose main-agent (cheaper, isolates direction as the variable). Revisit trigger: dogfood shows same-y tiles despite distinct seeds.

---

## Tasks

Execute in order. Keywords: CREATE, UPDATE, REMOVE.

### Task 1: CREATE DDR-147

- **Do**: Write `.ai/decisions/DDR-147-moodboard-first-discovery-default-directions.md` recording D1–D11 (context: kanban dogfood evidence + user request; decision; consequences; files changed; what it does NOT change — two-gate model, never-under-`system/<ds>/`, DDR-043 bias-free, Stage-1 fullness, `--no-discovery` skip). Explicitly: **supersedes DDR-080's cost clause**, **amends DDR-033's ordering**, keeps everything else.
- **Pattern**: DDR-136 (amends-one-aspect structure), DDR-080 (gate spec structure).
- **Gotcha**: verify 147 is still the next free number at execution time (STATE shows DDR-146 as latest; collisions happened before — see DDR-080's numbering note).
- **Validate**: DDR cross-links resolve (`grep -o 'DDR-[0-9]*' | sort -u` against `.ai/decisions/`).

### Task 2: UPDATE config schema + prep helper (the D9 knob)

- **Do**: Add additive `moodboard` object property (`{"variants": {"type":"integer","minimum":1,"maximum":3,"default":3}}`) to `apps/studio/config.schema.json`. In `apps/studio/bin/prep.sh`, read `jq -r '.moodboard.variants // 3'` and emit `export MOODBOARD_VARIANTS=…` in `--shell-export` + the JSON mode field (mirror `ACCENT_STRATEGY` handling at lines ~92/160/183).
- **Pattern**: `accentStrategy` read/emit in `prep.sh`.
- **Gotcha**: additive only — absent key must behave as 3 (no config migration). `prep.sh` ships via npm (`apps/studio/` is in `files`) — no packaging change needed.
- **Validate**: `bash apps/studio/bin/prep.sh --shell-export --shape setup-ds` in this repo prints `export MOODBOARD_VARIANTS=3`.

### Task 3: UPDATE `_bootstrap.md` — the stage reorder (D1, D5, D6, D7, D8)

- **Do**: Restructure the Discovery section:
  1. Move the moodboard block (current `#### Stage 4`, lines 385–525) to become **`#### Stage 3 — Direction gate (design-language moodboard)`**, directly after Stage 2. Default path rewritten per D2: main agent composes `MOODBOARD_VARIANTS` (≤ distinct-seed count, floor 1) miniature tiles from the payload — **no fan-out, no web**; existing blind-sub-agent + self-harvest machinery re-gated as the escalation path (D3), text preserved.
  2. Rewrite the current `#### Stage 3 — Refinement` as **`#### Stage 4 — Refinement (residue)`**: keep the confidence-gate table, add the **pick-settled-axes silencing rule** (D5 — pattern: inheritance silencing at `:543`) and the residue enumeration (D6). The DDR-073 ambition question is **replaced by the pick** when tiles varied on ambition (they do by seed construction); keep it only for the degraded-to-1 path.
  3. Replace `#### Confirm` with the **LOCK gate** (D7): one AskUserQuestion (+ numbered-prose fallback) that echoes {picked direction + residue} and locks; on "change something" → back to Stage 4 residue or the Tweak loop, not Stage 1. Post-lock edit ⇒ re-lock + re-run hero gate.
  4. Update the gating table (interactive / `--quick` / autonomous / `--no-discovery`) + sub-mode adaptations per D8 (inheritance picker stays pre-moodboard; frozen axes note; re-bootstrap → 1 tile) + the degrade rule with the **informed opt-in** wording (D4).
  5. Update the Sequencing diagram (`:1035`) — "Stage 4 moodboard approved" → "Stage 3 direction locked (post-refinement LOCK)".
  6. Bypass-log rows: add `direction-pick (autonomous auto-pick)`, `pick-overrides-≥0.85-field`, `degrade-N`, `escalation-to-web-variants`.
- **Pattern**: existing Stage-4 spec structure; pointer convention.
- **Gotcha**: renumbering ripples through every "Stage 3"/"Stage 4" mention **inside the same file** (spec-bypass table, hero-gate section, 4-brand-rounds intro). Do the sweep in Task 9, but keep this file self-consistent now. Keep AskUserQuestion ≤ 4 options everywhere (tiles ≤ 3 + Mix = 4; "None/eliminate" folds into follow-up, existing pattern at `:512–521`).
- **Validate**: `grep -n "Stage 3\|Stage 4\|prose Confirm" plugins/design/skills/design-system/_bootstrap.md` reads consistently; no orphaned "Show more variants" as the only variant path.

### Task 4: UPDATE `_bootstrap.md` — tile/board anatomy + pick-gate copy hardening (D11)

- **Do**: (a) **Replace** the miniature-tile content spec (current variant-tile parenthetical, `:454`) with the research-ranked tile anatomy: type-in-context (headline + body + UI label in the real families), **60/30/10 proportion strip + OKLCH chips**, signature-treatment hero, feeling word, **short descriptive direction name + one-line direction thesis** (from `mood_clusters[i].one_line` + `why_relevant`), cluster provenance tag. (b) The post-pick **expanded board** keeps the existing 5-concern collage spec + gains the **one real UI fragment** ingredient (a card/button cluster in the direction's tokens). (c) Rewrite the two gate scripts (direction gate + variant-pick gate collapse into one **direction-pick gate**): gut-first line ("first gut reaction — don't overthink"), fit-framing ("which feels most like <product> for <audience>"), echo of 1–2 Stage-1 answers, recommended tile flagged WITH its rationale, **eliminate-one fallback**, Mix = "base + named element(s), re-rendered as one coherent board" (anti-Frankenstein wording). Keep the existing chaotic-collage craft rules for the expanded board untouched.
- **Pattern**: existing gate scripts (`:481–501`, `:512–521`); numbered-prose fallback shapes.
- **Gotcha**: **net budget ≤ +80 lines for Tasks 3+4 combined** — the anatomy REPLACES text, the escalation path already exists; do not add new collage-craft invariants (SHIPPER guard, debate condition).
- **Validate**: `wc -l _bootstrap.md` delta ≤ +80; all five content concerns still enumerated once.

### Task 5: UPDATE `setup-ds.md`

- **Do**: Reorder the step-3 numbered flow (2 = discovery stages 0–2, **2.5 = direction gate (moodboard, default per `moodboard.variants`)**, 3 = residue refinement, 3.5 = LOCK); update the mode descriptions (lines 12–14) from "3-stage discovery … Stage 3 refinement" to the new order; update `--quick` copy (line 23: collapses Stage 1 AND forces 1 direction tile); keep all specs as pointers to `_bootstrap.md`.
- **Pattern**: existing pointer sentences ("Canonical spec in … — this is a pointer.").
- **Gotcha**: the DDR-130 debate note (line 88) references "Stage 3 refinement + Stage 4 moodboard direction decision" — reword to the new numbering; the design-seat roster (`flow:debate-protocol` § rosters) still applies at the direction gate.
- **Validate**: `grep -n "Stage" plugins/design/commands/setup-ds.md` consistent with new order.

### Task 6: UPDATE `SKILL.md` router + frontmatter

- **Do**: Line 17 BOOTSTRAP one-liner → "…carries discovery, the **Stage-3 direction gate** (default ~`moodboard.variants` seed-composed directions, pre-refinement — DDR-147) + residue refinement + LOCK, the Batch-A hero-preview drift gate, scaffold…". Frontmatter `description:` "3 rounds of AskUserQuestion" phrasing → match new flow.
- **Validate**: router still loads `_bootstrap.md` only for BOOTSTRAP; no stage-order restatement beyond the one-liner.

### Task 7: UPDATE `ux-research-agent.md` + `_pastier-probe-templates.md` (doc notes only — schema unchanged)

- **Do**: In `_reference_images_doc` + cross-links: moodboard consumes the payload **pre-refinement**; default tiles slice `reference_images[]` per cluster via `anchor → mood_tag`; per-variant self-harvest happens **only on the escalation path** (reword the "seed is a floor, variant sub-agents harvest their own" note to name the escalation). In the Probe E / confidence section of `_pastier-probe-templates.md`: one note that Stage-4-residue reads confidence AFTER the pick-silencing rule (pointer to `_bootstrap.md`).
- **Gotcha**: NO schema changes — `recommendations[]`, `mood_clusters[]`, `reference_images[]` shapes stay byte-compatible (cached payloads must remain valid).
- **Validate**: `maude cache`-related text untouched; cross-links resolve.

### Task 8: UPDATE DDR-080 + DDR-136 banners

- **Do**: Add one banner line to each: "Superseded in part by DDR-147 (2026-07-03): the moodboard now runs **before** refinement as Stage 3 with default ~3 seed-composed directions; the 'default 1, variants opt-in fan-out' cost clause is superseded. The two-gate model and persistence/composition mechanics below stand."
- **Pattern**: DDR-080's existing DDR-136 amendment banner.
- **Validate**: banners link-resolve.

### Task 9: UPDATE public docs + cross-file consistency sweep

- **Do**: `site/content/docs/design/bootstrap.mdx` lines 22/68/78/90 → new stage order (research → **direction moodboard (pick of ~3)** → refinement-residue → lock); then a repo-wide sweep: `grep -rn "Stage 3\|Stage 4\|Show more variants\|default = 1\|prose Confirm" plugins/design/ site/content/docs/design/ .ai/decisions/DDR-147*` — fix stragglers (known extra hits: `_read.md`?, `CATEGORIES.md`?, `new.md`/`edit.md` cross-references — verify at execution).
- **Validate**: sweep returns only intentional mentions (DDR history + the knob definition).

### Task 10: REMOVE legacy `.design/_moodboard/` leftovers

- **Do**: `git rm .design/_moodboard/maude-v2-variant-A.tsx .design/_moodboard/maude-v2-variant-B.tsx` — tracked leftovers of the path DDR-136 retired.
- **Gotcha**: repo-local dogfood state, shared main tree — commit only with this feature's files (memory: scope-flow-commands rule).
- **Validate**: `git ls-files .design/_moodboard/` empty.

### Task 11: Dogfood dry-run (scratch project)

- **Do**: Per CLAUDE.md "Working on plugin internals locally": point a scratch project's marketplace at this working tree, run `/design:setup-ds glass-test "<one-para brief>"` interactively → verify: 3 distinct tiles render in one canvas (screenshot + Read), pick gate copy matches D11, residue ≤ 3 Qs, LOCK echoes {direction + residue}, bypass-log rows written; re-run with `--quick` → 1 tile auto-proceed; simulate thin research (force `fallback_used`) → informed-opt-in degrade line.
- **Validate**: transcript + `_history/_system/<ds>-bypass-log.md` rows match D4/D5/D8.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test` (includes `cli/lib/plugin-cli-reachability.test.mjs` — our edits must keep `maude design <verb>` invocations, no raw bin paths)
3. **Build** (site docs touched): `pnpm --filter @maude/site build`
4. **Site-content drift gate**: `pnpm --filter @maude/site gen:reference && git diff --quiet -- site/content/docs/` (quality.site-content)
5. **Config knob**: `bash apps/studio/bin/prep.sh --shell-export --shape setup-ds | grep MOODBOARD_VARIANTS`
6. **Consistency sweep**: Task 9 grep returns clean
7. **Manual**: Task 11 dogfood dry-run (this is the real acceptance test — spec-only change has no automated runtime harness)

## Scenario Coverage

**N/A (justified):** this feature changes plugin *markdown specs* + one shell helper + one schema property — there is no runtime UI code in this repo to drive via `scenario-runner`/agent-browser. The Task-11 scratch-project dogfood bootstrap IS the end-to-end scenario (interactive, `--quick`, thin-research degrade). `design-system-guard`/`a11y-auditor` are not applicable (no UI diff in this repo; downstream boards inherit the existing a11y invariants — reduced-motion collapse untouched).

## Acceptance Criteria

- [ ] All tasks completed; `_bootstrap.md` net growth ≤ +80 lines
- [ ] DDR-147 recorded; DDR-080/DDR-136 banners in place
- [ ] `moodboard.variants` knob: schema + prep.sh + docs point at it; no doc restates a literal default count
- [ ] Default path provably web-free + fan-out-free (spec text; dogfood transcript shows no WebSearch during tile assembly)
- [ ] Pick-silencing rule + bounded adjudication (D5) spelled out; density/easing/majak never settled by a pick
- [ ] Single LOCK after residue; prose Confirm removed; hero-gate referent = locked canvas
- [ ] Sub-mode carve-outs (D8) all specified; BAD-7 inheritance-picker position preserved
- [ ] Degrade rule surfaces informed opt-in, never silent (D4)
- [ ] Dogfood dry-run (Task 11) passes all three paths
- [ ] `/flow:done` extras: whats-new entry (user-visible plugin change) + `pnpm --filter @maude/site gen:roadmap` in the closing commit

## Risks

1. **Same-y tiles despite distinct seeds** (BREAKER flipped top-risk + AI-era research finding). Mitigation: hard distinctness gate drives count (D4) + informed opt-in web escalation; revisit trigger recorded (switch default to compose-only sub-agents if dogfood shows convergence).
2. **"3 directions" promise is research-quality-bound** (SHIPPER top-risk): thin research → 1 tile ≈ today's flow. Accepted; the informed-opt-in line keeps it honest.
3. **Doc drift across 5+ instruments** (BREAKER #8): mitigated by the knob (D9) + Task 9 sweep; residual risk on future edits — DDR-147 is the anchor.
4. **`_bootstrap.md` size creep**: hard budget in Tasks 3+4; anatomy replaces, never stacks.
5. **Cached payload compat**: schema untouched (Task 7 gotcha); old cache files remain valid.

## Execution checkpoint (2026-07-03, /flow:execute)

- ✅ Task 1: CREATE DDR-147 — completed (verify: cross-links resolve)
- ✅ Task 2: config schema + prep.sh knob — completed (verify: `MOODBOARD_VARIANTS=3` default, `=2` with explicit knob, JSON mode, schema valid)
- ✅ Task 3: `_bootstrap.md` stage reorder — completed (Stage 3 direction gate → Stage 4 residue → LOCK; net +8 lines vs ≤ +80 budget)
- ✅ Task 4: tile/board anatomy + pick-gate copy hardening — completed (same file, six concerns, gut-first/fit-framed gate)
- ✅ Task 5: `setup-ds.md` — completed (modes, --quick, DDR-130 note, step list 2.5/3/3.5)
- ✅ Task 6: `SKILL.md` router + frontmatter — completed (also fixed stale v1 "12-question discovery" description)
- ✅ Task 7: `ux-research-agent.md` + `_pastier-probe-templates.md` doc notes — completed (schema untouched; Round 0 → Stage 2 label cleanup)
- ✅ Task 8: DDR-080 + DDR-136 banners — completed
- ✅ Task 9: site docs (`bootstrap.mdx`, `multi-ds.mdx`) + repo sweep (`CLAUDE.md`, `_MAPPING.md`) — completed; gen:reference exposed PRE-EXISTING drift (12 command pages, Czech→English from c5e0b57) — recommend separate chore commit at /done
- ✅ Task 10: legacy `.design/_moodboard/` leftovers removed (`git rm`)
- ⏳ Task 11: dogfood dry-run in scratch project — PENDING (interactive; requires a live user session — run before /flow:done)

Verification: `pnpm lint` clean (15 pre-existing client warnings), `pnpm test` 163/163, smoke gate exit 0 (changed-only noop, no dist churn), `prep.sh` both modes verified, consistency sweep clean.

## Retro

- **Relay debate earned its cost.** The 3-seat cross-challenge didn't just rubber-stamp — BREAKER's "no" forced the two load-bearing guards (no web on the default path; single lock after refinement) that make the reorder actually safe. Author the divergent debate as a genuine fork, not theater; a seat that never flips is a merged seat.
- **Live dogfood > spec review, every time.** The spec passed lint/tests/security-review "green", but only rendering 3 real tiles in the user's browser surfaced four defects the review couldn't: hotlinks that fetch-fine-but-render-blank, airy density, text-over-image dominance, and harvested junk (noise/shadow PNGs) in anchor slots. Every one became a DDR-147 addendum. Build a render-and-Read checkpoint into any canvas-generating spec BEFORE calling it done.
- **`/flow:done` security fan-out caught a real class of bug the feature review missed.** The `curl` guidance and the `MOODBOARD_VARIANTS` eval both shipped in the "done" commits and were only hardened at the closeout gate — evidence the fan-out isn't ceremony. Threat-model *agent instructions* (SSRF/traversal via attacker-influenced payloads), not just runtime code, whenever a spec tells a downstream agent to fetch+write.
- **Shared-`main` concurrency is the recurring tax.** A parallel session (config-hot-reload + video-animation-layer) owned STATE.md/roadmap.json/whats-new.json throughout; commit-only-your-own-files held, but STATE done-flip + roadmap regen + What's New had to be deferred to their next clean regen. Worktree isolation would have removed the tax — worth defaulting to for any multi-session day.
- **Process change for `/plan`:** when a feature's deliverable is *generated visual output* (canvas/moodboard/draw), the plan should include an explicit "render N real examples + Read them" acceptance task up front, not just automated gates — the pixels are the spec.

## Confidence score

**8/10** for one-pass implementation — the spec is markdown (no runtime regression surface beyond prep.sh/schema), the debate resolved every contested seam into explicit rules, and the machinery being promoted already exists. The two points off: renumbering ripple risk across a 1305-line spec + the dogfood dry-run's inherent nondeterminism.
