# DDR-147 — Moodboard-first discovery: the direction gate moves before refinement, with ~3 seed-composed directions by default

**Status:** Accepted — 2026-07-03.
**Supersedes (in part):** [DDR-080](DDR-080-moodboard-direction-gate.md) — the *cost clause only* ("default = 1 main-agent collage; 2–3 variants opt-in via blind sub-agent fan-out"). The two-gate model (direction gate + Batch-A hero-preview drift gate) and the "never under `system/<ds>/`" invariant **stand**.
**Amends:** [DDR-033](DDR-033-three-stage-discovery.md) — the *stage ordering only* (refinement no longer precedes the first rendered pixels). The three-stage abstract→concrete architecture, Stage-1 prose capture, and "zero hardcoded ladders" rule **stand**.
**Related:** [DDR-136](DDR-136-moodboard-persisted-as-commentable-ui-canvas.md) (persistent commentable moodboard canvas — composition mechanics reused verbatim), [DDR-073](DDR-073-aesthetic-ambition-axis.md) (ambition anchor — preserved via the bounded pick-override rule below), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (bias-free — every tile value remains research-payload-derived), [DDR-130](DDR-130-bookend-debate-layer.md) (this decision was produced by a 3-seat relay debate; BREAKER flipped to conditional-yes under the guard set recorded here). Instruments: `plugins/design/skills/design-system/_bootstrap.md`, `plugins/design/commands/setup-ds.md`, `plugins/design/skills/design-system/SKILL.md`, `plugins/design/agents/ux-research-agent.md`, `apps/studio/config.schema.json`, `apps/studio/bin/prep.sh`, `site/content/docs/design/bootstrap.mdx`.

## Context

DDR-033/DDR-080 ordered discovery as: Stage 3 refinement (abstract AskUserQuestion picks — ambition, palette, typography, voice, density, treatment, majak codes, spacing, easing, width) → prose Confirm → Stage 4 moodboard (yes/no direction gate, default 1 board, variants opt-in). The user was asked to decide palette/typography/ambition **as text before seeing a single pixel**; the moodboard — the artifact that renders those decisions — arrived only after all of them were made.

Dogfood evidence (kanban bootstrap transcript, 2026-07-03): a user answered 9 abstract refinement picks with "a / a / a / a … nechám na tobě". The questions carried no signal a rendered board would not have carried better. User request (verbatim intent): *"Ne každej hned ví jaký font chce použít, ale když ho vidí použitý někde, tak si to dokáže lépe představit"* — show ~3 directions first, pick, then refine.

External research (2 cited passes, quoted in `.ai/plans/feature-moodboard-first-discovery.md` § Research findings) confirms: rendered artifacts beat abstract questions for non-designers; 2–3 *distinct-axis* directions is the practitioner norm; choice-overload and Frankenstein-mix are the known failure modes; a code-rendered board is natively a style-tile/element-collage hybrid whose strengths (live type, proportioned color, UI fragments, real copy) are the highest-evidence direction cues.

## Decision

Reorder the bootstrap discovery and re-cost the direction gate:

```
Stage 0 scope → Stage 1 vision (full 11 prompts) → Stage 2 research
→ Stage 3 DIRECTION GATE (moodboard, default ~3 directions → pick / Mix)
→ Stage 4 REFINEMENT (residue only — the axes the pick didn't settle, 1–3 Qs)
→ LOCK gate (replaces the prose Confirm) → Mapping → Batch A → hero gate → B+C
```

1. **Default ~3 directions are CHEAP: main-agent, seed-only composition.** The main agent composes up to `moodboard.variants` (default 3) miniature direction tiles **purely from the Stage-2 payload** — `mood_clusters[i]` + its palette option + type pairing + treatment + the `reference_images[]` slice matched via `anchor → reference_products[].mood_tag`, over the always-render CSS/SVG scrap layer. **No sub-agent fan-out and no WebSearch/WebFetch on the default path.** Divergence lives in *seed distinctness*, not the collage hand; one consistent hand isolates *direction* as the comparison variable.
2. **The expensive path becomes the escalation.** DDR-080/DDR-136's blind-parallel-sub-agent machinery (distinct seeds, per-variant imagery self-harvest, return-a-body composition) is preserved **verbatim** as the opt-in "wilder / richer variants" escalation.
3. **Count follows seed distinctness (never fabricate a pole).** Tile count = number of pairwise-distinct seeds (reject < 40° hue apart or ≥ 2 shared anchors); cap 3, floor 1. On `fallback_used` / thin research, present fewer and surface the degrade as an **informed opt-in** ("research found 2 distinct directions — want a 3rd, richer web-sourced one? ~1–2 min") — never a silent drop, never a silent web charge.
4. **The pick SELECTS; a single LOCK comes after refinement.** A pick settles **only the axes that visibly varied across the presented tiles** (always palette + `aesthetic_ambition`; typography / signature-treatment iff the tiles varied on them). Fields held constant — inherited fields, uncontested ≥ 0.85 recommendations — keep their normal research-confidence gate (DDR-073 preserved: picking the recommended pole = affirmation; picking away = a visible, visually-informed earned deviation; every pick-driven override of a ≥ 0.85 field is bypass-logged). Refinement's residue is the genuinely non-visual set (`majak_3_codes`, density, spacing_base, type_ratio, easing, layout_max_w, `< 0.60` leftovers) — a static collage cannot show easing or a spacing scale, so a pick never settles them. Visual adjustments ride the existing Tweak loop. The **LOCK gate replaces the 3-sentence prose Confirm**: it echoes {picked direction + residue} once and locks; the locked artifact is exactly what Batch A consumes and what the hero-preview gate drift-checks against. Any post-lock edit re-locks and re-runs the hero gate.
5. **Sub-mode carve-outs.** `--quick` → 1 tile, auto-proceed-but-still-ask. Autonomous → 1 tile, auto-pick on clean self-read + bypass-log row; never fans out. `additional-ds` → inheritance picker stays **before** the moodboard (studio-2 BAD-7 position preserved); inherited fields are frozen across all tiles (never a varied axis → never settled by a pick) and excluded from the residue. `re-bootstrap` → 1 tile (lossy low-confidence inferred vision must not seed 3 poles). `--no-discovery` → gate skipped entirely (unchanged).
6. **The default count lives in ONE place.** `.design/config.json` → `moodboard.variants` (integer, min 1, max 3, default 3), declared in `apps/studio/config.schema.json`, exported by `maude design prep --shell-export` as `MOODBOARD_VARIANTS`. Docs reference the knob; no prose restates a literal default (the "default = 1 (cheap)" restatement across ≥ 5 files was the drift surface).
7. **Moodboard hardening (research-grounded).** Tile anatomy = mini style-tile/element-collage hybrid: type-in-context at ≥ 2 real sizes, **60/30/10 color-proportion strip** + OKLCH chips, signature-treatment hero, feeling word, short *descriptive* direction name + one-line direction thesis (from the cluster's `one_line` + `why_relevant`), provenance tag. The post-pick expanded board keeps the DDR-080 5-concern chaotic collage + gains **one real UI fragment** (card/button cluster in the direction's tokens). Pick-gate copy: gut-first framing, "which feels most like *your product for your audience*" (not "which do you like"), echo of 1–2 Stage-1 answers, recommended tile flagged **with its rationale** (no weak decoys), eliminate-one fallback, Mix = "base direction + named element(s), re-rendered as ONE coherent board" (anti-Frankenstein).

## Why this is DDR-worthy

It reverses two documented decisions for the most load-bearing design-plugin flow — DDR-033's "refine, then show" ordering and DDR-080's "default 1, variants opt-in" cost contract — and it re-grounds the direction decision in a comparative visual pick instead of an abstract question funnel. The cost trade is explicit and *preserved*: the default path stays inside DDR-080's cheap-gate budget (seed-only composition, no web, no fan-out ≈ today's single collage × ~1.5), while the genuinely expensive divergence machinery moves behind an explicit escalation. The decision was adversarially debated (DDR-130 relay; the cost objection flipped only under the guard set above), and the guard set is the substance of this record.

## Consequences

- **The direction pick replaces most of the abstract refinement.** Typical interactive flow: one gut-pick across ≤ 3 tiles + one residue batch (1–3 Qs) + one LOCK — versus up to 9–10 abstract picks before any pixels.
- **One gate removed.** The prose Confirm folds into the LOCK gate.
- **Recorded dissent / revisit trigger:** BREAKER preferred 3 *compose-only sub-agents* (hand-divergence, parallel latency) over main-agent composition for the default. If dogfood shows same-y tiles despite distinct seeds, switch the default mechanism to compose-only sub-agents (still no web) before touching the escalation tier.
- **"3 directions" is research-quality-bound.** Thin research honestly degrades to fewer tiles (informed opt-in for a web-sourced extra) — the headline value is conditional on Stage 2 producing distinct poles. Accepted.
- **Cached research payloads stay valid** — the payload schema is untouched; only its consumption order changed.
- **DDR-073 is strengthened, not bypassed:** the ambition axis is now *seen* (tile poles) instead of asked abstractly; restraint is affirmed by sight or overridden by an informed pick, and the abstract ambition question survives only on the degraded-to-1 path.
- **Bypass-log gains four rows:** autonomous direction auto-pick, pick-overriding-a-≥0.85-field, degrade-N, escalation-to-web-variants.

## Files changed

- `plugins/design/skills/design-system/_bootstrap.md` — Stage 3 ⇄ Stage 4 reorder; default seed-composed tiles + escalation re-gating; pick-settled-axes silencing; LOCK gate; sub-mode + gating-table + sequencing + bypass-row updates; tile-anatomy + pick-gate copy hardening.
- `plugins/design/commands/setup-ds.md` — step-3 flow pointers, mode descriptions, `--quick` copy.
- `plugins/design/skills/design-system/SKILL.md` — BOOTSTRAP one-liner + frontmatter description.
- `plugins/design/agents/ux-research-agent.md` + `_pastier-probe-templates.md` — consumption notes (pre-refinement moodboard; default tiles slice the seed; self-harvest = escalation only). **No schema change.**
- `apps/studio/config.schema.json` + `apps/studio/bin/prep.sh` — `moodboard.variants` knob + `MOODBOARD_VARIANTS` export.
- `site/content/docs/design/bootstrap.mdx` — public flow description.
- `.ai/decisions/DDR-080…` + `DDR-136…` — superseded-in-part banners.

## What this DDR does not change

- The **two-gate model** — direction gate + Batch-A hero-preview drift gate — and the hero gate's mechanics.
- The **"never under `system/<ds>/`"** invariant; the moodboard remains a persistent, versioned, commentable `ui/<ds>-moodboard.tsx` canvas (DDR-136).
- **Stage 1's full 11 prompts** (the rich vision-brief is the seed fuel — DDR-033/DF-9) and Stage 2's research mechanism, cache layers, and payload schema.
- **DDR-043 bias-free rule** — no hardcoded aesthetic anywhere in the tiles; every value is payload-derived.
- The chaotic hand-assembled collage craft rules for the expanded board (DDR-080), the `--no-discovery` skip, and the post-scaffold "4 brand rounds" panel.
