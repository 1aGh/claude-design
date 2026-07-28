# DDR-073 — Aesthetic-ambition axis: an inferred anchor that breaks the single-accent funnel

> **Numbering note (2026-06-01):** drafted as DDR-070, bumped to 073 because 070 (`DDR-070-svg-generation-geometry-engine`), 071 (`DDR-071-svgo-dependency`), and 072 (`DDR-072-project-level-tsx-sync-opt-in`) landed concurrently. If a further collision is found at merge, renumber and keep the note.

**Status:** Accepted — 2026-06-01.
**Supersedes:** none.
**Related:** [DDR-033](DDR-033-three-stage-discovery.md) (three-stage discovery — this axis is inferred, not a hardcoded picker, so it stays inside DDR-033's "zero hardcoded ladders" rule), [DDR-043](DDR-043-bias-free-design-plugin-templates.md) (bias-free templates — this implements DDR-043's "Forward-pointing extensions → Stage 3 question expansion" and removes the residual conservative prior DDR-043 left in the agent's structural-knob defaults), [DDR-057](DDR-057-aspiration-pass-bar-raised-to-4.md) (aspiration bar — restraint scoring feeds it; this DDR makes the restraint floor ambition-aware so a declared-maximalist DS can still pass). Instruments: `plugins/design/agents/ux-research-agent.md`, `plugins/design/skills/design-system/_bootstrap.md`, `plugins/design/agents/signature-moment-critic.md`.

## Context

`/design:setup-ds` structurally collapses every new design system into a "tasteful minimal single-accent editorial" aesthetic regardless of the brief. The `ux-research-agent` returns rich, brand-relevant research, but the discovery → scaffold → critic pipeline funnels the output to one accent colour, one font, a solid background, and maximal restraint. Diagnosis found **7 independent funnel points**, all pushing the same direction (hence the strikingly consistent minimal result):

1. **`ux-research-agent.md` `recommendations.palette` is a single OKLCH pick** — `color_oklch_options[]` has one `recommended:true`. There is no slot for "how many colours / how chromatic / how expressive".
2. **The structural knobs silently default conservative and are never surfaced.** The agent's `_structural_doc` marked `accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio` as "NOT research-driven" with the instruction *"usually `single`"*. The agent dutifully emits `single` at high confidence → Stage 3's confidence gate (`< 0.85` → ask) **skips** it → the user never sees the choice. Self-fulfilling: high-confidence-by-instruction ⇒ never asked.
3. **No discovery prompt captures chromatic/expressive appetite.** Stage 1 Q8 even forces *"one emotion… pick one word"*.
4. **The accent heuristic is single-accent only and is literally named "tasteful default"** (`_bootstrap.md`: no mood cue → `tasteful default L 68-72`).
5. **The signature-moment-critic actively penalises maximalism.** Its Restraint axis (×1.5) docks >2 chromatic surfaces, >3 accent instances, *"three accent colours trying to do vibrant"*; Negative-space (×1.0) rewards "editorial breathing room". Under the default `palette` opt-out scope, a colourful design scores low → the auto-fix loop retries it back toward minimalism.
6. **Anchor monoculture in worked examples.** Every example anchors on Stripe/Vercel docs · Linear · Robin Rendle · Are.na — the "quiet editorial" canon. The LLM pattern-matches to it regardless of brief.
7. **The Q9 effect-family catalogue has no chromatic/maximalist member** (`chrome-glow / body-pattern / hard-edges / inset-recess / none`). Even if research surfaces a Canva-style direction, it must map to a conservative family.

The opt-out scopes (`aesthetic`/`full`) can relax restraint, but they are **per-canvas flags on `/design:new`**, not a property of the DS. A DS born "tasteful" stays tasteful forever unless the user hand-types `--opt-out` on every canvas.

The root cause is that **expressiveness is captured by no axis**, so every knob falls to its conservative default and the critic + examples reinforce it.

## Decision

Introduce a single first-class axis, **`aesthetic_ambition`**, with four poles — and make it an **inferred anchor decision**, not a forced picker:

- The `ux-research-agent` **infers** `aesthetic_ambition` from the brand character (Probe A lineage + Probe B Zrcadlo+Charakter + the product-description fields of `vision-brief.json`) and assigns confidence by signal strength. It is the **anchor**: the other structural knobs (`accent_strategy`, `shadow_strategy`, `radii_personality`, `type_ratio`, `easing_personality`) are **derived from it** instead of each defaulting independently conservative. The *"usually single"* instruction is deleted.
- It surfaces through the **same confidence gate** as every other decision (skip ≥0.85 / prefill 0.60–0.85 / ask <0.60). **No Stage 0 picker, no forced choice** — this keeps it research-driven (DDR-033-aligned) and fixes the user complaint that the questions force a blind pick.
- **Anti-funnel invariant (critical): absence of signal ≠ `restrained`.** When the brand character gives no clear temperature, confidence is `<0.60` → Stage 3 *asks* across the full scale (incl. a multi-colour palette option), never silently defaulting to minimal. High-confidence skip is legitimate only when the character is unambiguous — at **both** ends of the scale.
- **Timing: pure post-research.** The product is described in Stage 1 (pre-research); ambition is inferred in Stage 2; the user is asked only in Stage 3, only when ambiguous. No early steer prompt, no always-on confirm. (User decision, 2026-06-01.)
- A DS's inferred ambition is persisted to `config.json.aestheticAmbition` and **sets the default `opt_out_scope`** for every canvas under that DS, so expressiveness is a DS property, not a per-canvas flag.

## Decision table (ambition → knobs → scope)

| Pole | Aesthetic (reference canon) | `accentStrategy` | shadow / decor | default `opt_out_scope` |
|---|---|---|---|---|
| `restrained` | mono / 1 accent, editorial, generous negative space — *Linear, Stripe docs, Vercel* | `single` | soft / none | `palette` |
| `confident` | 1 strong accent + 1–2 support, mild decoration — *Notion, Height, Stripe marketing* | `single \| paired` | soft, +1 chromatic-surface tolerance | `palette` |
| `expressive` | multi-accent / paired chromatic, playful shapes, gradients OK — *Figma, Gumroad, Arc* | `paired \| chromatic-3` | accent-tinted, gradients | `aesthetic` |
| `maximalist` | chromatic palette (3+ accents), colour-as-structure — *Canva, Affinity, Memphis, Figma Config* | `chromatic-N` | bold, colour-as-structure | `full` |

Two new Q9 effect families back the high-ambition poles (this DDR is the `_MAPPING.md:158` "spec-change conversation" that catalogued families require):

- **`chromatic-blocks`** — multiple `--accent-*` filled surfaces as structural blocks (Memphis / Canva); colour carries hierarchy. Requires `accentStrategy ≥ chromatic-3`.
- **`gradient-mesh`** — soft multi-stop mesh / aurora backdrop (Figma / Stripe-marketing); single-role `--mesh-*` backdrop family (per D-5), accent-tinted cards; honours `prefers-reduced-motion`.

`config.schema.json` gains `aestheticAmbition` with **`default: "restrained"`** — this default is **only** the legacy/no-bootstrap fallback (a hand-written config without the field). A freshly bootstrapped DS always writes the *inferred* value. Existing DSes behave exactly as today (no migration).

## Why this is DDR-worthy

This changes what `/design:setup-ds` produces for downstream users — it relaxes the de-facto "single-accent minimal" house style that every DS inherited, and it makes the signature-moment-critic's restraint floor conditional on a declared DS property. It also implements DDR-043's explicitly-deferred "Stage 3 question expansion" and deletes the conservative `usually single` prior DDR-043 left behind. The anti-funnel invariant (ambiguity → ask, never silent `restrained`) is a deliberate, auditable inversion of the prior behaviour.

## Consequences

- A genuinely quiet brief still infers `restrained` at high confidence and behaves identically to today — `restrained` is now *earned from signal* rather than assumed. Backwards-compatible.
- The signature-moment-critic reads the DS's `aestheticAmbition` (via the Task-9 default `opt_out_scope`): a declared-`maximalist` DS is judged on intentional chromatic **coherence**, not absolute surface/accent counts. The true-overload guard (5+ chromatic surfaces in a 200 px region) stays — maximalism ≠ chaos.
- completeness-critic C7 must pass for `chromatic-N`: the Batch A scaffold emits N `--accent*` families when ambition drives a chromatic strategy.
- To counter the LLM's own minimal bias, Probe E must emit an audit line in `research_quality_notes` whenever it infers `restrained`/`confident` ("considered the expressive end, ruled it out because X") — forcing justification rather than default. (Execute-time decision, accepted.)
- A strong volunteered expressiveness cue in Stage 1 free-text (e.g. "barevné jako Figma") is a high-weight inference signal, not a hard pin — research stays in the loop to refine the exact pole. (Execute-time decision, accepted.)

## Files changed

- `plugins/design/dev-server/config.schema.json` — add `aestheticAmbition`
- `plugins/design/templates/design-system-inspiration/core/config.json.tpl` — emit `{{aesthetic_ambition}}`
- `plugins/design/templates/design-system-inspiration/_MAPPING.md` — add `chromatic-blocks` + `gradient-mesh` families + ambition→knobs subsection
- `plugins/design/skills/design-system/_bootstrap.md` — Stage 2 inference note; Stage 3 confidence-gated surfacing + multi-colour palette; accent heuristic multi-hue rows + no-cue reroute; Batch A scaffold (N accent families, new treatments, write inferred ambition)
- `plugins/design/agents/ux-research-agent.md` — `aesthetic_ambition` as anchor `recommendations` decision; derive knobs from it; delete "usually single"; `palette_options[]`; Probe E confidence + audit line
- `plugins/design/skills/design-system/_pastier-probe-templates.md` — Probe B aesthetic-temperature read (both ends); Probe E ambition confidence; expressive/maximalist anchors
- `plugins/design/commands/new.md` + `plugins/design/commands/edit.md` — default `opt_out_scope` from `config.aestheticAmbition`
- `plugins/design/agents/signature-moment-critic.md` — declared-maximalist judged on coherence, not counts

## What this DDR does not change

- Token NAMES (`--bg-0`, `--accent`, `--mesh-*`, etc.) — canonical contract unchanged.
- `prefers-reduced-motion: reduce` collapse — a11y invariant.
- The shape of `/design:setup-ds` (Stages 0–3, ux-research-agent in discovery mode) — only payload + scaffolding + critic-floor wiring changed; no new stage, no new picker.
- A11y enforcement at every opt-out scope — untouched.
