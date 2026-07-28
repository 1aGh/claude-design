# DDR-033: Discovery rewritten as 3-stage (Vision → Research → Refinement) — Pastier-inspired, zero hardcoded ladders

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** design, design-system, setup-ds, discovery, ux-research-agent, bootstrap, ddr-033
- **Related:** [`.ai/plans/setup-ds-pastier-framework.md`](../plans/setup-ds-pastier-framework.md), [`.ai/plans/archive/setup-ds-pastier-framework-v1-iterative.md`](../plans/archive/setup-ds-pastier-framework-v1-iterative.md), `plugins/design/skills/design-system/SKILL.md`, `plugins/design/agents/ux-research-agent.md`, `plugins/design/skills/design-system/_DISCOVERY-v1.md` (archived v1)

## Context

The pre-rewrite discovery flow (cataloged in `_DISCOVERY-v1.md`) was a **12-question fixed dotazník in 3 rounds** — Identity (Q1–Q4) → Brand (Q5–Q8) → Pro-designer (Q9–Q12). Round 0 (domain research) ran before the questions and seeded option labels into AskUserQuestion pickers.

The flow was structurally sound and shipped scaffolded DSes that passed `design-system-completeness-critic`. But the **aesthetic-quality ceiling stalled at ~3.5/5 aspiration** across multiple bootstraps. The post-mortem of the studio re-bootstrap (2026-05-13) + the Pastier framework analysis (2026-05-20) surfaced four root causes:

1. **Visual-first inversion.** Q5–Q8 (mood / color / typography / voice) forced token-level decisions BEFORE the discovery captured **purpose / character**. Users picked "cool-clinical L 58-62 C 0.08-0.11" without anyone formulating *why the DS exists* or *what character it must carry*. Any of the three offered options was structurally valid — but the pick wasn't anchored to intent. Token choice became arbitrary.

2. **"3 codes stačí" principle ignored.** Pastier limits signature codes to **3 of 9** (`barva · font · symbol · tvar · vzor · motion · zvuk · voice · charakter`) so the brand has a recognizable signature instead of being "equally good at everything". The v1 flow activated all 9 token families with no prioritization. Result: DSes were "complete" but had **no signature** — nothing dominant, everything balanced. Direct cause of the 3.5/5 aesthetic ceiling.

3. **Hardcoded fallback ladders surfaced regardless of research success.** SKILL.md lines ~156-169 listed "emergency-only" fallbacks (8 signature treatments, 4 density labels, etc.) which fired **whenever research lost momentum**, not only when it failed entirely. Even with successful research, the same trio of options bled through because the agent's confidence wasn't checked per-decision. **These ladders WERE the bias source** the agent was supposed to fix.

4. **Scope-agnostic assumptions.** The dotazník silently assumed a market-facing product with `pro / consumer / developer` audience. For personal projects, internal tools, OSS libraries, and research artifacts the taxonomy is irrelevant — users crammed themselves into the nearest box.

The v1 plan attempted iterative fixes (added Pastier vocabulary as derivation inputs while keeping the 12-Q skeleton — archived at `.ai/plans/archive/setup-ds-pastier-framework-v1-iterative.md`). The iteration showed too many hardcoded ladders survived; the structural shape itself was the blocker, not the wording.

## Decision

**Replace the 12-Q fixed dotazník with a 3-stage flow that moves from abstract to concrete the way a human designer would talk to a stakeholder.** Implementation in `plugins/design/skills/design-system/SKILL.md` § "Discovery", with companion files `_pastier-probe-templates.md` (Stage 2 scaffolding) and `_DISCOVERY-v1.md` (archived v1 reference).

The three stages:

1. **Stage 0 — Scope gate.** Single AskUserQuestion (the only hardcoded picker in the whole flow). 4 options: `market` / `internal` / `personal` / `oss`. Steers Stage 1 wording, the signature-moment-critic aspiration target post-scaffold, and default voice register — invisible to the user as internal scoring jargon.

2. **Stage 1 — Vision (extract).** 11 conversational free-text prompts in 3 batches (PŘÍPRAVA 4 · PROSTOR 3 · DUŠE 4), emitted as plain prose chat messages with examples per prompt. User replies in one chat message per batch with `1. … 2. …` headings or `skip`. Parser splits and populates `vision-brief.json`. Pastier's 7 chapters (Zrcadlo · Facka · Ulice · Kmen · Zkratka · Charakter · OST) live in **internal comments** beside each prompt — user never sees Pastier vocabulary.

3. **Stage 2 — Research (synthesize).** `design:ux-research-agent` receives the **full** `vision-brief.json` (v1 only passed a one-liner) and returns a payload extended with a `recommendations` block: for each design decision (palette, typography, signature_treatment, majak_3_codes, density, voice) the agent emits `{recommendation, alternatives[], confidence, rationale}`. Pastier chapters are encoded as 5 **probe templates** in the agent prompt (`_pastier-probe-templates.md`).

4. **Stage 3 — Refinement (decide).** Adaptive 0–N AskUserQuestion picks. Per-decision behavior driven by confidence: `≥ 0.85` SKIP (surface in confirm only); `0.60–0.85` ASK with recommendation pre-filled; `< 0.60` ASK without pre-pick. Maják 3-code combination is always a Stage 3 Q. **Zero hardcoded fallback ladders** — if `alternatives[]` is empty, skill skips the Q and asks free-text.

5. **Confirm.** 3-sentence summary (one per stage); on "něco upravit" return to Stage 3, not Stage 1.

**Failure handling: NO degradation to hardcoded ladders.** If the research agent fails entirely (no payload), flow STOPS and offers `re-run Stage 1 / retry research / abort`. The v1 fallback ladders are deleted because they were the bias source.

## Alternatives considered

1. **(a) Iterative refinement of the 12-Q flow** — keep the 3-round structure, add Pastier vocabulary as derivation inputs to Q1–Q12, lift the questions toward character-first wording. Explored in `.ai/plans/archive/setup-ds-pastier-framework-v1-iterative.md` (2026-05-19). **Rejected** because too many hardcoded ladders survived (4 of 12 questions still had abstract-label fallbacks; the visual-first inversion in Q5–Q8 was structural, not just wording). The fix would have required deleting Q5–Q8 anyway, at which point it's not iterative refinement, it's a rewrite.

2. **(b) Drop discovery entirely, auto-derive everything from one-liner brief** — let the research agent infer scope + character + signature from the brief alone, surface 0 questions, scaffold immediately. **Rejected** because a one-liner brief is too sparse to anchor character / OST / lineage. The current one-liner-in / generic-DS-out path was the v1 default and produced the 3.5/5 ceiling; sparsity in is sparsity out. Designer-grade output needs designer-grade input.

3. **(c) Chosen: 3-stage Vision → Research → Refinement** — mirrors how a real designer interviews a stakeholder (extract intent, do research, refine choices against research). Each stage has a single clear job; the user-facing surface stays small per stage. The Pastier framework provides the "what to ask" taxonomy without leaking its vocabulary to the user.

4. **(d) Keep 12-Q but make all options payload-sourced (no fallbacks at all)** — considered as a "minimum-change" patch. **Rejected** because the visual-first inversion (Q5–Q8 demand visual decisions before character / OST are captured) survives, and 12 forced questions remains heavyweight regardless of where the options come from.

## Consequences

**Quality lift (the reason for the rewrite):**

- Rich `vision-brief.json` (11 fields) → research agent has 10× the signal to ground recommendations vs. the v1 one-liner. **Dogfood (DF-9) confirms this is the single biggest aesthetic-quality lever.**
- Confidence-driven Stage 3 → ideal-case runs land at 0–2 questions (vs. v1's 12 always); typical 4–6 questions; worst-case 8–10. **Adaptive question count = real user-time savings (DF-11).**
- Zero fallback ladders → users no longer see the same trio of options across unrelated projects. Bias source eliminated by construction.

**Operational changes:**

- **Stage 1 is plain prose, NOT AskUserQuestion.** AskUserQuestion enforces min-2-labeled-options + auto-"Other" affordance (DF-1, DF-3, DF-7 — Anthropic docs confirm this is schema-level, no bypass). Stage 1 needs free-text capture with per-prompt skip — only plain prose delivers that UX. Parser splits user replies on `**N. …**` heading boundary.
- **Stage 1 = 3 chat round-trips** (one per batch of 4 / 3 / 4 prompts). DF-8 validated this end-to-end; no friction.
- **Stage 3 = 1–3 AskUserQuestion calls** (4 Qs per batch, DF-2 schema max).
- Research agent becomes load-bearing: if it fails, flow stops; **no degradation path to hardcoded ladders.** This is intentional — the only mechanism that produces the bias the rewrite eliminates is the fallback path.

**Re-bootstrap mode lossy on Stage 1 fields.** Existing DSes scaffolded pre-DDR-033 don't carry a `vision-brief.json`. Re-bootstrap infers from README + tokens + `_layout.css` (low confidence on character / OST / lineage) and asks the user to confirm / correct in a single chat message before Stage 2. Users can always type `začni od začátku` to restart Stage 1 fresh.

**Critic panel rebrand to "4 kola značky".** Existing critic agents (completeness, a11y, graphic-design, signature-moment, typography, brand, copy) are grouped under three Pastier-flavored headers in the post-scaffold reporting block: **Kolo 1 — Srozumitelnost** (completeness + a11y), **Kolo 2 — Atraktivita** (graphic-design + signature-moment), **Kolo 3 — Konzistence** (typography + brand + copy). Pastier's fourth kolo (Frekvence — marketing reach) is intentionally dropped. **No critic-agent code changes** — only the reporting header rebrand.

**Migration:**

- **Zero migration for READ flow.** Tokens CSS contract is unchanged; scaffold output contract is unchanged; downstream canvas authoring is unaffected.
- **First-bootstrap, additional-ds:** use the new 3-stage flow from the next `/design:setup-ds` invocation. No data migration needed.
- **Re-bootstrap of existing DSes:** lossy inference into `vision-brief.json` + user confirms / corrects; `--force` always re-runs Stage 2.
- **v1 reference preserved at `plugins/design/skills/design-system/_DISCOVERY-v1.md`** for a transition window; deletion deferred until the 3-stage flow has shipped through 2+ live bootstraps without regression.

**Plan dogfood findings (DF-1 through DF-12)** in `.ai/plans/setup-ds-pastier-framework.md` are the source-of-truth for why each architectural pick survived; future contributors should read that section before changing the stage shape.
