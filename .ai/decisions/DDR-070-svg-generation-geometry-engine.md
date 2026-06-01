# DDR-070: SVG generation via a deterministic geometry engine + rank-not-score verify loop

- **Date:** 2026-06-01
- **Status:** Accepted
- **Tags:** design, dev-server, draw, svg, geometry-engine, draw-agent, verify-loop, vlm-as-judge, optical-adjustment, regression-prevention
- **Related:** [DDR-067](./DDR-067-annotation-figjam-parity-v2-shape-tool-arrowheads-cursors.md) (the `SvgPrimitive` single-source pattern this generalizes), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (engine path resolution), [DDR-062](./DDR-062-plugins-reach-executable-logic-via-maude.md) (verbs via `maude design`), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md) (canvas-lib single source), [DDR-071](./DDR-071-svgo-dependency.md) (the one new dep), [Phase 25 plan](../plans/phase-25-designer-draw-svg-agent.md)

## Context

The design plugin had **no first-class way to produce vector art** — logos, icons,
illustrations, diagrams. Canvases hand-wrote `<svg>` JSX ad hoc, ungrounded in
design principles and never visually verified, which is exactly the condition that
produces generic, amateur output. And the obvious "just ask the LLM for SVG"
approach is documented to fail: LLMs emit *syntactically valid* SVG reliably but
their **spatial/visual coherence is weak and degrades sharply with complexity**
(SVGenius, LLM4SVG, OmniSVG, the "pelican on a bicycle" benchmark). The failure
modes are specific and repeatable: integer-coordinate quantization, coordinate
hallucination/drift, render-order/occlusion errors, color degradation to `#000`,
grid-misalignment that accumulates over edits, connector gaps, text/shape overlap,
"blob" outputs.

`/design:smoke` catches *blank/error* iframes, not *bad graphics* — a canvas can
build green and still render a logo that's illegible at 16px or fails contrast.

The repo already proved the fix-shape in miniature: `canvas-arrowheads.ts`
(DDR-067) reduces an arrow to ordered `SvgPrimitive`s that one serializer turns
into both an SVG string and JSX from a single source — coordinates computed in
code, never guessed.

## Decision

**Generate SVG as code through a deterministic TypeScript geometry engine, and
verify it with a short rank-not-score, keep-best loop on real browser renders.**
Three pillars:

1. **Draw as code, not as a string.** The engine (`plugins/design/dev-server/draw/`)
   computes exact coordinates; the LLM (`draw-agent`) specifies *intent* — what
   shape, where, what z-order. This removes the dominant LLM-SVG failure classes
   by construction. The only hand-authored path data allowed is via the engine's
   `pchipPath()` (overshoot-free monotone splines), never LLM-guessed Béziers.
   Optical adjustments (overshoot, `EQUAL_AREA_CIRCLE_SCALE = 2/√π ≈ 1.1284`,
   centroid-centering) are engine helpers, not nudged numbers.
   - Layering: `primitives` → `geometry` (PCHIP / A* routing / centroid / optics)
     → `palette` (WCAG + OKLCH) → `layout` (snap / modular scale / label solver /
     `diagram()`) → `serialize` (one node tree → SVG string **and** JSX, the
     DDR-067 single-source invariant generalized) → `optimize` (the only dep —
     see DDR-071). Pure + dep-free except `optimize`; React-free root (DDR-067)
     so `@types/react`'s global JSX namespace can't break under `types:[bun-types]`.

2. **Plan before draw.** A mandatory planning pass (enumerate primitives → assign
   grid cell + z-order → emit) — the single highest-leverage, free technique from
   the literature (SVGThinker).

3. **Rank-not-score verify loop.** Generate N candidates → render via the existing
   `maude design screenshot` machinery (a `DrawProof` size-ladder × {light, dark,
   single-color flatten} canvas) → **pairwise-rank** (never trust absolute VLM
   scores) → **keep-best-so-far** (anti-regression) → structured rubric critique →
   iterate, **hard cap 3–4 rounds**. Text / counts / exact color / WCAG are
   verified from the **SVG source / primitive list / palette tokens**, never by
   asking the vision model.

The capability is exposed as `/design:draw`, auto-routed from `/design:new` (art
slot) + `/design:edit` (draw-a-mark feedback), and judged independently by
`draw-critic` against the shared 30-check rubric (`agents/_draw-design-rules.md`,
HARD floor = WCAG · 4/8pt grid · 16px legibility · single-color flatten). New
dev-tooling verbs `draw-build` / `draw-proof` / `svg-optimize` reach the engine
through `maude design <verb>` (DDR-062); the engine is imported in build scripts
via an injected absolute path (`MAUDE_DRAW_ENGINE`) resolved next to the bin dir
(DDR-045), portable across every install layout.

## Why these specific choices

| Choice | Rationale | Alternative rejected |
|---|---|---|
| LLM emits intent; engine computes coords | Removes the documented LLM-SVG failure classes (quantization, drift, occlusion, alignment rot). Repo already proves it (`canvas-arrowheads.ts`). | Raw LLM `<path d>` — the entire failure surface. |
| Pairwise-rank + binary checks, never absolute VLM scores | VLM judges rank reliably but score with ±3/5 noise + poor intra-rater consistency (arXiv 2604.25235, 2510.27106). | Absolute 1–5 VLM scoring to pick a winner. |
| Keep-best + cap 3–4 | Composition freezes after round 1 and oscillates/over-complicates without an anti-regression gate (Agentic-Pelican). Idea2Img's selection-among-N is the +lever. | Refine-in-place forever. |
| Verify text/counts/color from source | VLMs confidently misread rendered text, counts, and colors. | Ask the vision model "what does it say / how many / is contrast OK". |
| Reuse agent-browser + the `DrawProof` artboard ladder for rasterization | Real browser engine = highest fidelity, matches what users see, zero new rendering infra. | resvg-js/sharp — redundant; sharp is a native addon hostile to bun-compile. |

## Consequences

- **Positive:** vector art that survives the favicon test, the single-color
  flatten, WCAG, and a consistent icon-family grid — produced *and verified* in
  one closed loop, reusing 100% of the screenshot/artboard machinery (no new
  rendering infra). The engine is pure + unit-tested (PCHIP monotonicity, A*
  obstacle avoidance, WCAG ratios, SVG↔JSX parity, optimize validity gate).
- **Cost:** one new dev-server dependency (SVGO — DDR-071) and a body of
  engine + agent code that must stay maintained. The agent loop is bounded
  (cap 3–4 rounds, 2–3 candidates) so token cost is predictable.
- **Scope guardrails:** the engine covers `icon | logo | illustration | diagram |
  spot`. Out of scope: full multi-artboard layout generation (stays `/design:new`)
  and photorealism (no vector method does it).
- **Seed-artifact source for DS bootstrap (added post-Phase-25).** `/design:setup-ds`
  routes to `draw-agent` for an **opt-in organic-artifact layer** — backgrounds,
  `<pattern>` tiles, spot textures, and a starter brand mark — generated from the
  *just-discovered* palette + mood (DDR-043: discovery-driven, never hardcoded;
  never in the `--no-discovery` neutral skeleton). This is the "organic vs hard
  token data" gap: tokens are systematic; the `spot` type + the gradient / grain /
  pattern / mask / blend toolkit bring warmth. Wired in `_bootstrap.md` before the
  visual-sanity check so artifacts flow through the 4-kola critic gate. The
  toolkit (gradients, filters incl. `feTurbulence` grain, patterns, masks/clips,
  `mix-blend-mode`) is the engine-v2 surface this organic layer needs.
- **Maintenance invariant:** the SVG↔JSX parity (one node tree feeds both
  serializers) is a tested invariant — keep it, same discipline as DDR-067.
