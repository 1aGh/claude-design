---
"@1agh/maude": minor
---

**`/design:setup-ds` rewritten as 3-stage discovery (Vision → Research → Refinement).** Replaces the v1 12-question fixed dotazník (3 rounds — Identity / Brand / Pro-designer) with a conversational small-step flow that moves from abstract to concrete the way a human designer talks to a stakeholder. See [DDR-033](../.ai/decisions/DDR-033-three-stage-discovery.md) for full reasoning.

User-visible changes:

- **Stage 0 — Scope gate.** One picker (`market` / `internal` / `personal` / `oss`) up front, steers Stage 1 wording + post-scaffold aspiration target. The only hardcoded picker in the whole flow.
- **Stage 1 — Vision.** 11 conversational free-text prompts in 3 batches (PŘÍPRAVA · PROSTOR · DUŠE), emitted as plain prose chat messages with one example per prompt. `skip` is always a valid answer. Output = rich `vision-brief.json`. Pastier's framework (Zrcadlo · Facka · Ulice · Kmen · Zkratka · Charakter · OST) templates the prompts but is invisible in the UI.
- **Stage 2 — Research.** `ux-research-agent` now receives the full vision-brief (was: one-liner). Returns the existing `discovery` payload plus a new `recommendations` block with `{recommendation, alternatives[], confidence, rationale}` per design decision (palette / typography / signature_treatment / majak_3_codes / density / voice). Pastier probe templates live at `plugins/design/skills/design-system/_pastier-probe-templates.md`.
- **Stage 3 — Refinement.** Adaptive 0–N AskUserQuestion picks driven by confidence: `≥ 0.85` SKIP / `0.60–0.85` ASK with pre-pick / `< 0.60` ASK without pre-pick. Maják 3-code combination is always a Stage 3 Q. **Zero hardcoded fallback ladders** — if research fails entirely, flow STOPS (re-run / abort), no degradation.
- **`<brief>` argument shortcut.** Rich `/design:setup-ds <name> "<paragraph>"` invocations pre-fill matching vision-brief fields and skip those Stage 1 prompts (each skip printed inline so user can correct).
- **`--quick` semantics.** Now collapses Stage 1 to 4 prompts (P1 + P5 + P8 + P10) instead of skipping pre-DDR-033 Round 3.
- **Post-scaffold critic panel rebranded as "4 kola značky"** (rename only, no agent-code changes): **Kolo 1 — Srozumitelnost** (completeness + a11y), **Kolo 2 — Atraktivita** (graphic-design + signature-moment), **Kolo 3 — Konzistence** (typography + brand + copy). Pastier's fourth kolo (Frekvence) is dropped — outside DS surface.

Re-bootstrap of existing DSes is lossy on Stage 1 fields (existing DSes don't carry `vision-brief.json`); skill infers from README + tokens + `_layout.css`, user confirms / corrects in a single chat message before Stage 2 runs. `--force` always re-runs Stage 2.

v1 reference preserved at `plugins/design/skills/design-system/_DISCOVERY-v1.md` for a transition window.
