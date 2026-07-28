# DDR-074: Draw engine composition layer + discriminating critic metrics (φ rejected)

- **Date:** 2026-06-01
- **Status:** Accepted
- **Tags:** design, dev-server, draw, composition, armature, color-harmony, apca, vme-balance, critic-metrics, golden-ratio-myth, deep-research, regression-prevention
- **Related:** [DDR-070](./DDR-070-svg-generation-geometry-engine.md) (the engine this extends), [DDR-071](./DDR-071-svgo-dependency.md), [DDR-067](./DDR-067-annotation-figjam-parity-v2-shape-tool-arrowheads-cursors.md) (single-source pattern), [Phase 25 plan](../plans/phase-25-designer-draw-svg-agent.md)

## Context

Phase 25 shipped the draw engine + agent + critics (DDR-070). In use, the output
was amateurish — randomly-placed "blob soup" backgrounds — and the critics passed
mediocre work as "portfolio-grade". A deep-research pass ("what makes good design
objectively good — codifiable") was run (fan-out web search → adversarial
verification → cited synthesis; 27 sources, 25 claims verified, 19 confirmed /
6 killed). It produced three load-bearing, sometimes counter-intuitive results:

1. **The golden ratio is NOT a quality signal.** Peer-reviewed evidence (Naini
   2024 PMC; Markowsky 1992; Blake 1921, *Art Bulletin*) demolishes the φ-and-beauty
   myth and the Parthenon claim. Worse: fitting *any* proportion grid to a finished
   image is mathematically **non-discriminating** — a single artifact admits dozens
   of equally-valid root-rectangle fits, and no finite-precision measurement
   distinguishes a rational from an irrational ratio. So a "does it align to φ / an
   armature?" check **passes everything** and is useless as a critic gate.

2. **"Blob soup" is a generation-architecture failure, not a taste failure.**
   Random placement avoids overlap only ~3–12% of the time (Shiripour 2021, ACM
   EICS); snapping elements onto a constructed armature is valid by construction.

3. **The codifiable parts are specific, measurable metrics** — not vibes:
   rule-of-thirds / rabatment / dynamic-symmetry focal scaffolds (generation),
   VME visual-balance-as-moment-equilibrium, Cohen-Or 8 hue-harmony templates,
   value-range (luminance span), APCA Lc contrast, Ngo's per-axis measures.

## Decision

**Split the fix across generation and critique, exactly along the
discriminating / non-discriminating line the research drew.**

**Generation gets a composition layer** (`draw/composition.ts`): `armature()`
(thirds / rabatment / dynamic-symmetry / golden / quad) → construction lines +
focal points; `assignSlots()` (constraint placement — place ON the armature,
never random-scatter); `balanceMoment()` (VME nine-grid + Manhattan); plus
`blobPath()` (smooth closed organic curves) in `geometry.ts` and color harmony +
value tools in `palette.ts` (`bestHarmony` / `harmonize` / `harmonyDistance` =
Cohen-Or; `valueRange`; `apcaLc`). The draw-agent now MUST compose on an armature
with one dominant focal, a harmonized palette, a real value range, and balanced
masses (rubric "Generation discipline G1–G6", agent protocol step 0.5).

**Critique is re-grounded on the DISCRIMINATING metrics** — value range
(≥ 0.35 for depth), hue-harmony distance (Cohen-Or, ≤ ~30), VME balance (≥ 0.75),
dominance ratio (≥ 1.3), APCA Lc — with an **anti-soup gate** (value-range < 0.25
∥ balance < 0.6 ∥ dominance < 1.15 ⇒ FAIL, regardless of pretty colors). The
critic reports per-axis (Ngo: the summed score has weak human correlation).

**φ / armature-alignment / root-ratio presence are explicitly NOT scored.** φ is
at most one *optional* armature with no special status; armatures are a
generation tool only (non-discriminating as a gate).

## Why (the empirical anchors)

| Choice | Rationale | Source |
|---|---|---|
| Compose on an armature, never random-scatter | Random non-overlap ~3–12%; grid-snap = 100% valid by construction | Shiripour 2021 (ACM EICS) |
| φ is not a gate; armature-alignment is generation-only | φ-beauty debunked; grid-fitting is non-discriminating (fits anything) | Naini 2024; Blake 1921; Markowsky 1992 |
| Balance = VME net-moment → 0 | Visual balance as physical moment equilibrium, nine-grid + Manhattan | MDPI Symmetry 18(1):41 |
| Harmony = Cohen-Or hue-template distance | 8 templates; distance 0 = harmonious; sat-weighted | SIGGRAPH 2006 |
| Value does the work | value/contrast is the dominant perceptual variable; APCA Lc is linear | APCA docs; notan literature |
| Anti-soup metric gate | the leniency that passed soup as portfolio-grade was vibe-scoring | this project's own failure |

## Consequences

- **Positive:** the engine produces intentional compositions (validated: a
  background rebuilt on the composition layer scored harmony-distance 0 + value
  range 0.59 vs the old soup's harmony-distance 88; an agency hero composed text +
  organic-blob bg into a balanced whole). The critic now objectively rejects soup.
  All metrics are pure + unit-tested (99 draw tests).
- **Cost:** more engine surface to maintain; the metric thresholds were validated
  on UI-layout corpora (Ngo / VME / Shiripour), NOT abstract vector art — treat
  them as strong priors, re-validate on rendered output, and tune. Logged as an
  open caveat in the research report.
- **Bias-free invariant (DDR-043-adjacent):** organic seed artifacts for DS
  bootstrap (`/design:setup-ds`) and all generation are grounded in the
  *discovered* palette + a chosen harmony template, never hardcoded — and never φ.
- **Don't re-add:** φ as a constraint/gate, armature-alignment scoring, "5 pleasing
  ratios" snapping, or the refuted Figma typography numbers (all killed in
  verification).
