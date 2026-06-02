# DDR-080 — Moodboard direction gate: a cheap pre-scaffold visual approval before the expensive bootstrap

> **Numbering note (2026-06-02):** originally drafted as 079 because 075 (`canvas-activity-overlay`), 077 (`hmr-error-resilience`), and 078 (`agent-presence`) were taken by Phase 13 / 13.1 / 13.2 work in flight on `main` (untracked at drafting time). At merge (PR #32 → `main`), 079 had since been claimed by `DDR-079-tsx-sync-default-on.md` on `main`, so this DDR was renumbered to **080** per this note's own escalation rule.

**Status:** Accepted — 2026-06-02.
**Supersedes:** none.
**Related:** [DDR-033](DDR-033-three-stage-discovery.md) (three-stage discovery — the moodboard *follows* the Stage-3 refinement + prose Confirm and is assembled from the same research payload, not a new picker, so it stays inside DDR-033's "zero hardcoded ladders" rule), [DDR-057](DDR-057-aspiration-pass-bar-raised-to-4.md) (aspiration pass bar — the post-scaffold panel measures portfolio-worthiness; this DDR adds the *pre*-scaffold human-taste checkpoint the panel cannot be, since a 4.4/5 pass coexisted with a total rejection), [DDR-073](DDR-073-aesthetic-ambition-axis.md) (aesthetic-ambition axis — the moodboard renders the inferred ambition / palette / treatment in context, making the axis's first concrete pixels approvable before the fan-out commits to them). Instruments: `plugins/design/skills/design-system/_bootstrap.md`, `plugins/design/agents/ux-research-agent.md`, `plugins/design/commands/setup-ds.md`, `plugins/design/skills/design-system/SKILL.md`.

## Context

`/design:setup-ds` invests **~30–40 min and ~15,000 LOC** of scaffold (Batch A + B + C fan-out) plus a full critic panel **before the user sees a single pixel**. The originating evidence is the StudyFi-v2 bootstrap (`.ai/logs/execution-reports/new-studyfi-v2-design-system.md`, status REVERTED): it generated a complete DS, **passed the post-scaffold critic panel at signature-moment 4.4/5**, and was then deleted in full — *"smaž úplně, to se mi vůbec nelíbí."*

Three structural gaps let an entire investment be spent on a direction the user never liked:

1. **First pixels appear only after the full scaffold.** A direction the user dislikes costs the entire ~15k-LOC investment to *discover*.
2. **The only pre-scaffold checkpoint is a prose-only 3-sentence Confirm.** A text echo of vision / research / refinement cannot expose an *aesthetic-direction* mismatch — you cannot see "burnt-orange rendered as candy pumpkin" or "this type ladder is melodramatic" in three sentences.
3. **The post-scaffold critic panel measures the wrong thing for this failure.** The panel (completeness + a11y + graphic + signature-moment + typography + brand + copy) scores **absence-of-badness + portfolio-worthiness** — not *this specific user's taste on this specific direction*. A 4.4/5 "portfolio-worthy" verdict and a "delete it all" reaction are not contradictory; they measure different axes. There was **no cheap human-taste checkpoint** anywhere in the flow.

A fourth, process gap: under autonomous "pokracuj", the coverage / seed `AskUserQuestion`s defaulted **silently** (the report's logged divergence #3 + "Skipped the draw-agent step"). Any new gate must define an explicit, logged autonomous behaviour or it gets skipped the same way.

## Decision

Insert **two visual fail-fast gates** into the bootstrap flow so the user approves the *direction* cheaply, before (and during the early part of) the expensive generation.

### 1. Stage 4 — Design-language moodboard (direction gate, pre-scaffold)

After Stage 3 refinement + the prose Confirm, and **before any Mapping / roster / token / specimen generation**, the **main agent** assembles a **throwaway moodboard canvas** (no sub-agent fan-out, target < 3 min) under a new `<designRoot>/_moodboard/<ds>-moodboard.tsx` (a throwaway sibling of `_draw/`, never written under `system/<ds>/`). It is assembled **purely from the already-computed discovery + research payload** (DDR-043 bias-free) — no new generation — and is treated as a **chaotic, hand-assembled collage / pinboard** (overlapping torn-paper scraps, photos taped/pinned at slight angles, scattered paint-chip swatches, ripped type-specimen fragments, marker scribbles/arrows, washi tape, corkboard/paper-grain texture) — **deliberately messy + human, feeling-first**, a hook for "líbí se mi X odsud, ale Y odtamtud". It must NOT read as a tidy app-mockup or a clean exhibition poster (no numbered sections, no masthead, no uniform grid of bordered cards). The five content *concerns* below are an inventory of what must stay legible across the mess, NOT a five-card layout: proposed **palette** OKLCH swatches + accent-in-context hero · **type pairing** in the real font families · the **signature-treatment hero** applied to one representative card · a **voice / feeling-words** sample in the proposed tone using real `domain_nouns` (+ `primary_emotion` / `anti_aesthetics` as big mood words) · a **reference provenance panel** that shows *where the direction came from* — `ux-research-agent`'s new `reference_images[]` PAIRED with `reference_products[]` (anchor name + `why_relevant` + source link + the query that surfaced it), the names+why+links being the reliable backbone shown even when the image is blocked. The agent screenshots it via `maude design screenshot` (DDR-062), **Reads the PNG into context**, and gates:

```
Jdeme do toho      → lock the moodboard as the direction contract → Mapping → Batch A
Uprav <co>         → iterate the moodboard ONLY (swap swatch/font/treatment) → re-screenshot → re-gate
Ukaž víc variant   → assemble 2–3 distinct direction tiles → comparative pick/mix gate → expand winner
Tohle ne           → zpět na Stage 3 (refinement), or konec — before any scaffold; nothing was written
```

**Direction is a divergent problem**, so beyond the default single moodboard the user may request **2–3 variants**. Default = 1 stays **main-agent-assembled** (no fan-out, cheap). On the opt-in variant path, each variant is generated by **its own independent sub-agent, fired in PARALLEL in one message, each BLIND** to the others (no shared draft, no peer tile) so the variants genuinely diverge instead of sharing one house style — each gets a **distinct seed** (a different `mood_cluster` / aesthetic pole / lineage; pairwise distinctness asserted before firing: reject seeds sharing ≥ 2 anchors or < 40° apart in hue), and **each gathers its OWN direction-specific imagery** (its own WebSearch/WebFetch). The user reacts comparatively (pick or mix), then expands the winner into the full collage moodboard. **Default stays 1** (fast common path); variants are the opt-in divergent path. Capped at 3 (choice-overload + AskUserQuestion 4-option cap). On approval the moodboard becomes the **locked direction contract**: Batch A consumes its palette / type / treatment **verbatim** instead of re-deriving the look — directly reducing the burnt-orange-as-candy accent, D-7 inverted type roles, and D-8 melodramatic ladder drift `_bootstrap.md` already warns about. The prose Confirm stays as a cheap text echo that *leads into* the moodboard; the moodboard **supersedes it as the real direction approval**.

### 2. Batch-A hero-preview gate (token-fidelity check, mid-scaffold)

Batch A already writes `colors_and_type.css` + `_layout.css`. It now also writes **one `signature: true` specimen** (`colors-accent.tsx`) as a hero preview, screenshots it, and drift-checks the **real computed tokens** against the approved moodboard **before** the costly Batch B+C fan-out. It is the **post-token complement** to the moodboard's pre-token *direction* approval: "did the real tokens render what the moodboard promised?" **Light by default** — auto-proceed on no-drift (one line, no question); hard-prompt (`Pokračovat / Uprav tokeny / Stop`) **only** on detected drift (wrong hue lightness, missing treatment, inverted type roles). Fixing here is a **token edit, not a regen** — catching the defect before the ~15k-LOC fan-out it would otherwise poison. When the moodboard was skipped (`--no-discovery` / autonomous skip) there is nothing to drift-check against, so it falls back to the existing accent-in-context self-check.

### 3. Autonomous-mode discipline (no new silent path)

Every new default routes through the per-DS bypass log (`<ds>-bypass-log.md`), never silently:

| Gate | Autonomous default | Surfacing |
|---|---|---|
| Moodboard direction gate | proceed **only** on a clean self-read of the screenshot; else stop + ask | 1-line chat + log row; never skip the screenshot+Read |
| Hero-preview drift override | proceed on no-drift; stop+ask on drift | log row on any proceed-through-drift override |
| Critic-panel coverage | **Full 4 kola** (not a silent trim) | log row (codifies report divergence #3) |
| Organic-seed (`draw-agent`) | **None** | 1-line chat + log row + `recommend /design:draw "<brief>" --asset` line |

## Why this is DDR-worthy

This changes the **shape of the most load-bearing design-plugin flow** for every downstream user: it inserts a new stage (Stage 4) and a mid-scaffold gate, makes the moodboard — not the prose Confirm — the real direction approval, and adds a research-payload field (`reference_images[]`) that feeds it. It is a deliberate, auditable inversion of "generate first, judge after": the human-taste checkpoint moves **before** the spend. The cost trade is explicit — **a 1–3 min gate vs a 30–40 min / ~15k-LOC scaffold thrown away** — and it is the cheap-checkpoint the post-scaffold critic panel structurally cannot be (it measures portfolio-worthiness, demonstrably orthogonal to "the user wants this").

## Consequences

- **Two complementary gates, different fidelity.** Moodboard = *direction* approval (pre-token, headline, the user can iterate/bail). Hero preview = *token-fidelity* drift net (post-token, light, prompts only on divergence). They are not redundant — one catches "wrong direction", the other "right direction, wrong tokens".
- **Throwaway-canvas precedent reused, no new helper.** The moodboard mirrors `draw-proof.sh`'s `_draw/<slug>.proof.tsx` pattern (write under a throwaway dir, screenshot through `_canvas-shell.html?canvas=<rel>`, Read). v1 adds **no new dev-server binary** — it reuses `maude design screenshot` + `server-up` + the existing canvas-render pipeline.
- **Roster invariant preserved.** `colors-accent.tsx` is pre-written by the main agent in Batch A (the hero specimen) and dropped from the Batch B "color tokens" fan-out slice, so reconciliation still asserts every row written **exactly once** — no double-count, no orphan.
- **Image density, with reliability as an accepted risk.** The moodboard is *dense* by construction: the main-agent seed harvest is raised to **~6–12 images best-effort** (`reference_images[]`, still a by-product of the research WebFetch passes — never extra WebSearch calls), and **variant sub-agents harvest their own** direction-specific imagery (~4–8 each) so the seed is a floor, not a ceiling. Density never leaves holes because three layers always render: real `<img>` photos, CSS/SVG scraps (paint-chips / torn fragments / scribbles / tape), and provenance tags. A failed or CSP-blocked load degrades to a labeled colour/treatment scrap + the anchor name in the *same slot*; the moodboard never blocks on a broken image, and an empty seed array is valid (niche / non-English anchors often have none). Harvest biases toward stable direct URLs (`upload.wikimedia.org`, museum CDNs, `og:image`) over auth-walled app screenshots.
- **Provenance over thumbnails (the "full picture").** Block 5 is a *reference provenance panel*, not a bare image grid: each anchor shows name + `why_relevant` + source link + the query that surfaced it (from `reference_products[]`), paired with the image when it loads. The user sees *what we found and why we recommend this direction* — transparency consistent with the research agent's "every source query logged" principle — and the names+why+links are the reliable backbone that survives a blocked image.
- **Divergent by request via independent parallel fan-out, fast by default.** Direction is a comparative judgement, so the opt-in 2–3-variant path fires **one blind sub-agent per variant, in parallel in a single message** — each seeded with a distinct pole (different `mood_cluster` / palette / lineage, pairwise-distinct), each self-harvesting its own imagery, none seeing the others. This is what makes variants *genuinely* diverge instead of sharing one house style (one main agent authoring all tiles converges them). The default single moodboard stays **main-agent-assembled** (no fan-out) to keep the common path cheap; variants are the opt-in spend the divergent problem justifies. Capped at 3 (choice-overload + the AskUserQuestion 4-option cap). A crashed sub-agent degrades to the surviving tiles — it never aborts the gate. Still ≪ the scaffold.
- **Chaotic-collage framing.** The moodboard is intentionally a hand-assembled pinboard — torn/taped/pinned scraps at jittered angles on a corkboard texture, overlapping, lumpy density, marker scribbles — not a polished deliverable and explicitly NOT a tidy numbered-section poster or a grid of bordered cards. The polish lands later in the scaffold + critic panel. This is a deliberate stance: a deliberately-messy, human collage that earns a fast "jo/ne" beats a clean-but-generic poster. The chaos is craft, not noise — every palette value, type specimen, and provenance tag stays legible (overlap decoration, not data).
- **Validated by live dogfood (2026-06-02).** A "funny Bauhaus kanban" moodboard was assembled by a sub-agent and rendered end-to-end through the real pipeline (`_moodboard/*.tsx` → `_canvas-shell.html?canvas=` → `hide-chrome=1` capture), confirming the `_moodboard/` render-path claim live. The run also hit two of the plan's deferred bugs first-hand — `server-up` crashing on a missing `yjs` (out-of-scope item #2) and the export adapter returning empty without Playwright browsers — reinforcing those deferrals.
- **Bias-free (DDR-043).** The moodboard is assembled from *discovered* values + *researched* imagery — no hardcoded aesthetic — and is **skipped entirely** on the neutral `maude design init --no-discovery` skeleton (no palette to ground), the same gating as the draw organic-seed step.
- **Interactive-only.** `--quick` auto-proceeds but **still surfaces the question** (per-stage speed ≠ blanket scope-renegotiation); autonomous mode proceeds only on a clean self-read and logs the decision.

## Files changed

- `plugins/design/skills/design-system/_bootstrap.md` — new `#### Stage 4 — Design-language moodboard (direction gate)` (assembly + screenshot+Read + gate + iterate/bail + gating); `##### Hero-preview gate` in Batch A + roster/fanout annotations for `colors-accent`; Sequencing diagram (moodboard pre-Batch-A + hero gate between A and B+C); Spec-bypass + Panel-coverage + Seed-organic autonomous-mode rows.
- `plugins/design/agents/ux-research-agent.md` — discovery payload gains optional `reference_images[]` (`{url, alt, anchor, source_query}`, **~6–12 best-effort** raised from 3–6 for a dense collage, harvested from the existing WebFetch pass — still NO extra WebSearch-for-images, bias toward stable direct URLs); procedure step 4 + the `_reference_images_doc` "seed is a floor, variant sub-agents harvest their own" note + cross-link.
- `plugins/design/commands/setup-ds.md` — Step-3 numbered flow pointers (3.5 moodboard, 6.5 hero-preview) → `_bootstrap.md` canonical spec.
- `plugins/design/skills/design-system/SKILL.md` — BOOTSTRAP one-liner enumerates the two new gates.

## What this DDR does not change

- The three-stage discovery (Stages 0–3, ux-research-agent in `discovery` mode) — the moodboard is **Stage 4**, assembled from existing payload; no new picker, no new research pass.
- Token NAMES / the canonical token contract — the moodboard is throwaway and never writes tokens.
- The post-scaffold "4 kola značky" critic panel — unchanged; the moodboard sits **upstream** of it, it does not replace any critic.
- `prefers-reduced-motion: reduce` collapse + a11y invariants — untouched.
- The hero-preview specimen is the existing `colors-accent.tsx` — no new specimen type is introduced.
