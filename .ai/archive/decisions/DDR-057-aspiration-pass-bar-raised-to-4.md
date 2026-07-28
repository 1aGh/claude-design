# DDR-057 — `/design:setup-ds` aspiration silent-pass bar raised from 3.5 to 4.0

> **Renumbered from DDR-056 → DDR-057 (2026-05-28):** collided with the merged `DDR-056-linked-mode-gitignore-strategy` (PR #25, phase-9 Task 9), which keeps 056 (already public on `main`). This one moved to 057.

**Status:** Accepted — 2026-05-28.
**Supersedes:** none (tightens the threshold matrix introduced for the signature-moment-critic).
**Related:** [DDR-049](DDR-049-motion-one-as-canonical-motion-library.md) (Phase 3.7 hardening predecessor), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (bias-free templates — restraint defaults live alongside this), the signature-moment-critic (`plugins/design/agents/signature-moment-critic.md`, the aspiration-axis instrument this bar reads).

## Context

`/design:setup-ds`'s post-scaffold critic panel ("4 kola značky") gates a bootstrap on the signature-moment-critic's `aspiration_score` (0–5). Pre-this-DDR, the threshold matrix printed a clean **silent** "Bootstrap complete — aesthetic check passed" at `aspiration_score ≥ 3.5`.

The `new-studyfi` bootstrap (retro `/Users/iagh/git/AI-StudyMate/.ai/logs/system-reviews/new-studyfi-bootstrap-review.md`, 2026-05-28) scored **3.8 / 3.7** and the loop reported a silent pass. The user's lived experience: *"Hezké ale ne wow; typografii a pozadí jsem ladil sám"* — the output was fine but not portfolio-grade, and they spent an evening hand-tuning typography and the background. The bar was measuring **absence-of-bad**, not **presence-of-wow**: 3.5–3.8 is exactly the "hezké ale ne wow" band, and a silent pass at 3.5 lets mediocre-but-fine output ship as "complete" with no signal that a concrete next move exists.

## Decision

**Raise the silent-pass line to `aspiration_score ≥ 4.0`, and insert a non-silent middle band `3.0 ≤ score < 4.0`.**

Three bands:

1. **`≥ 4.0`** — the ONLY band that prints a clean silent "aesthetic check passed".
2. **`3.0 ≤ score < 4.0`** (the "hezké ale ne wow" band) — still prints **complete** (the DS is shippable), but NOT silently: it appends a *"What would take this from hezké to wow"* block surfacing the signature-moment-critic's **top 2 specific lifts** — its actual notes (e.g. studyfi's "mesh never enters a product surface"), never a generic nag. The intent is to hand the user the concrete next move instead of an evening of self-tuning.
3. **`< 3.0`** — unchanged: the hard "does not match the quality bar" path with top-3 blockers surfaced and a `/design:edit` recommendation.

Codified in `plugins/design/skills/design-system/SKILL.md` (threshold matrix + the always-print next-steps block's new `3.0 ≤ aspiration < 4.0` branch).

## Why this is DDR-worthy

Raising a published quality threshold is a **behavior change downstream users feel**: a `/design:setup-ds` run that previously reported a clean pass at 3.6 now appends a "to wow" block. That is a deliberate, visible shift in what the tool calls "done" — recorded here so the 3.5 → 4.0 move (and the evidence: a 3.8 that felt "ne wow") is auditable rather than buried in a markdown diff.

## Consequences

- More bootstraps land in the middle band and surface lifts; this is the intended outcome, not noise. The middle band deliberately still says **complete** to avoid over-correcting into nagging.
- The signature-moment-critic must emit per-lift notes specific enough to populate the "top 2 lifts" block; a generic verdict degrades the band's value. (Already its contract — this DDR makes it load-bearing for bootstrap.)
- Pairs with the Kolo-2-non-skippable rule (same phase): the "ne wow" signal is only visible if Kolo 2 runs, so the aesthetic kola is no longer skippable during a `first-bootstrap` / `additional-ds` run.
