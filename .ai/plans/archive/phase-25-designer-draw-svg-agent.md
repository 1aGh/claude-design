# Feature: `design:draw` — principle-grounded SVG generation agent + deterministic geometry engine

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. The load-bearing prior art for this whole feature already lives in the repo: **`plugins/design/dev-server/canvas-arrowheads.ts`** (the `SvgPrimitive` "draw-as-code, never-as-string" pattern) and **`plugins/design/agents/signature-moment-critic.md`** (the scoring-critic + JSON-verdict + auto-fix-loop contract). This feature generalizes both.

## Description

A new design-plugin capability that **generates high-quality SVG drawings, logos, icons, illustrations, and diagrams** — and **verifies them visually** by rendering → screenshotting → self-critiquing against a formal design rubric → iterating to convergence.

It is built on three pillars derived from the deep research (sources at the bottom):

1. **Draw as code, not as a string.** A deterministic TypeScript *geometry engine* computes exact coordinates; the LLM specifies *intent* (what shape, where, what z-order). This eliminates the dominant LLM-SVG failure classes (integer-coordinate quantization, coordinate drift, occlusion errors, alignment rot).
2. **Plan before draw.** A mandatory planning pass (enumerate primitives → assign grid cell + z-order → emit) — the single highest-leverage, free technique from the literature (SVGThinker).
3. **A short, ranking-driven verify loop.** Generate N candidates → render via the *existing* `maude design screenshot` machinery → **pairwise-rank** (never trust absolute VLM scores) → **keep-best-so-far** (anti-regression) → structured rubric critique → iterate, **hard cap 3–4 rounds**.

The capability is exposed two ways (user choice): a standalone **`/design:draw "<brief>"`** command, *and* auto-routed from `/design:new` + `/design:edit` whenever a canvas needs custom vector art. Output lands either **inline into the active canvas TSX** or as **standalone reusable asset files** under the design root.

## User Story

As a **designer/developer iterating on canvases in the design plugin**, I want **an agent that draws production-grade SVG (logos, icons, illustrations, diagrams) grounded in real design principles and self-verifies the result visually**, so that **I get marks that survive the 16px favicon test, the single-color flatten, WCAG contrast, and a consistent icon-family grid — instead of the blobby, drifting, occluded SVG that LLMs emit when they free-hand path data.**

## Problem

- LLMs emit *syntactically valid* SVG reliably but their **spatial/visual coherence is weak and degrades sharply with complexity** (SVGenius benchmark; "pelican on a bicycle"). Documented failure modes: integer-coordinate quantization, coordinate hallucination/drift, render-order/occlusion errors, color degradation to `#000`, grid-misalignment that accumulates over edits, connector/arrow gaps, text-shape overlap, and "blob" outputs.
- The design plugin today has **no first-class way to produce vector art**. Canvases hand-write `<svg>` JSX ad hoc, with no grounding in design principles and no visual verification — exactly the conditions that produce generic, amateur output.
- There is **no closed verification loop** for graphics: a canvas can build green and still render a logo that's illegible at 16px or fails contrast. (`/design:smoke` catches blank/error iframes, not *bad* graphics.)

## Solution

A geometry engine + a draw-agent + a `/design:draw` command + a draw-critic + auto-integration, built in dependency-ordered milestones:

- **Geometry engine** (`plugins/design/dev-server/draw/`) — pure-TS, generalizes `canvas-arrowheads.ts`. Grid-snapped primitives, transform-based composition (`<defs>`/`<symbol>`/`<use>`), PCHIP overshoot-free splines, A* obstacle-aware connectors, constraint-based label placement, OKLCH/WCAG palette helpers, and a dual serializer (primitives → SVG string **and** → JSX, single-source so on-disk and on-canvas forms never drift — the same invariant `canvas-arrowheads.ts` enforces).
- **Render/verify harness** — a `DrawProof` canvas-lib component + generated proof canvas that renders any mark across a **size ladder (16/24/48/256px) × {light, dark, single-color flatten}**, so one `maude design screenshot --all-screens` operationalizes the scalability test, the single-color test, dark-mode (`currentColor`), and per-size legibility — reusing 100% of the existing screenshot/artboard machinery, zero new rendering infra.
- **`draw-agent`** (`plugins/design/agents/draw-agent.md`) — encodes the design principles + the machine-checkable rubric, runs plan-before-draw, draws *only* through the engine, runs the verify loop, emits the standard JSON verdict.
- **`draw-critic`** (`plugins/design/agents/draw-critic.md`) — an independent rubric judge (graphic-design-critic's sibling, specialized for standalone vector art) for the critic panel.
- **`/design:draw`** command + auto-routing from `/design:new` and `/design:edit`.

## Metadata

- **Ticket**: (none — GitHub-tracker repo; create a tracking issue at `/flow:done` if desired)
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `plugins/design` (+ `plugins/design/dev-server`), `cli` (maude verb dispatch + reachability test), `package.json`/deps manifest (SVGO)
- **Affected Systems**: design plugin agents + commands, dev-server (`draw/` engine, bin verbs, canvas-lib), critic panel orchestration, `/design:new` + `/design:edit` routing, dependency manifests, CI (bun:test + reachability)
- **Dependencies**: **SVGO** (one new dev-server dep — validity gate + optimize; pure-JS, Bun-compatible) — gated by DDR (see Design Decisions). Reuses existing: agent-browser/playwright (screenshot), canvas-lib, `maude design <verb>` dispatch.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `plugins/design/dev-server/canvas-arrowheads.ts` (whole file, ~197 lines) — Why: **the pattern to generalize.** `SvgPrimitive` union, `arrowPrimitives()` reducer, the dual serialize/JSX-render single-source invariant, the byte-identical back-compat discipline (DDR-067), and the deliberate one-way `.ts → no react import` dependency rule that avoids the `JSX` namespace breakage. The engine's `primitives.ts` + `serialize.ts` mirror this exactly.
- `plugins/design/agents/signature-moment-critic.md` (whole file) — Why: **the agent contract to clone.** Frontmatter (`name: design:<slug>`, `tools:`), the orchestrator **Inputs** envelope, opt-out-scope handling, the **Aggregate score → verdict thresholds**, the final fenced-`json` **Verdict** block the loop parses, the per-symptom **Failure handling** table, and the "return a short tail, don't paste the report" rule. `draw-agent` and `draw-critic` follow this shape.
- `plugins/design/commands/critic.md` — Why: how the orchestrator spawns critics in parallel, the structured prompt payload, and panel-verdict consolidation. The `/design:draw` loop and panel integration mirror this.
- `plugins/design/commands/new.md` + `plugins/design/commands/edit.md` — Why: the `--perfect` auto-fix loop structure, server lifecycle (`server-up.sh`), the step-9 per-artboard reality check, and the exact points where `design-system-keeper` is auto-routed (step 9.5 / 7.5) — the template for auto-routing `draw-agent`.
- `plugins/design/dev-server/canvas-lib.tsx` (skim exports) — Why: `DesignCanvas`, `DCArtboard`, `DCSection`, `useTheme` — the building blocks for the `DrawProof` size-ladder proof component.
- `plugins/design/dev-server/bin/screenshot.sh` — Why: the capture flags (`--full`/`--element <id>`/`--selector`/`--all-screens`), agent-browser-primary/playwright-fallback, the canvas-mount polling, and the `--all-screens` artboard iteration the proof harness relies on.
- `plugins/design/dev-server/paths.ts` — Why: **DDR-045** — any new bin/route that touches disk MUST import `DEV_SERVER_ROOT`/`DIST_DIR`/etc. from here, never `dirname(fileURLToPath(import.meta.url))` (breaks inside `bun --compile`).
- `plugins/design/dev-server/test/canvas-route.test.ts` — Why: the `bun:test` sandbox/boot/teardown pattern for any dev-server test (engine units don't need a server; the proof-route/verb tests do).
- `plugins/design/CATEGORIES.md` — Why: where `/design:draw` is registered (daily group) and how auto-routed agents omit `category:`.
- `cli/lib/plugin-cli-reachability.test.mjs` — Why: **DDR-062** — bans direct `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"` in plugin markdown. New `draw-proof` / `svg-optimize` recipes must be reached via `maude design <verb>` and the dispatch wired in `cli/`.
- `plugins/design/dependencies.json` + `package.json` (`files` array) — Why: SVGO must be declared in the deps manifest (read at runtime by `cli/lib/preflight.mjs`) and the `draw/` dir ships via npm (it's under an already-shipped path, but confirm).
- `plugins/design/skills/design-system/_pastier-probe-templates.md` — Why: the pattern for a reference doc consumed by an agent (`_draw-design-rules.md` mirrors this layout).

### Files to Create

**Geometry engine** (`plugins/design/dev-server/draw/`):
- `primitives.ts` — `DrawPrimitive` union (superset of `SvgPrimitive`: rect, circle, ellipse, line, polyline, polygon, path, text, group/`use`), grid-snapped constructors, `place(part, {x,y,scale,rotate})` transform composition, viewBox presets (24×24 icon / 64×64 logo / arbitrary).
- `geometry.ts` — PCHIP monotone spline interpolation (overshoot-free curves), A* connector routing (obstacle-aware, chamfered corners), centroid + convex-hull weighting (optical centering), overshoot/optical-correction helpers (circle ≈ +12.84% vs equal-extent square; triangle centroid-centering; cap-line overshoot ~1–3%).
- `layout.ts` — constraint-based label/element placement (overlap penalties), grid system, 4/8pt snap, modular-scale ratios.
- `palette.ts` — WCAG contrast computation (4.5:1 / 3:1), OKLCH ramp generation (constant-L per tier), 60-30-10 distribution check, `currentColor` defaulting.
- `serialize.ts` — `toSvg(primitives, {viewBox, a11y})` → optimized SVG string (viewBox kept, `role="img"`/`<title>`/`<desc>` injected, `currentColor` default) **and** `toJsx(primitives)` → JSX for inline canvas embedding. Single source; SVG↔JSX parity is a tested invariant.
- `optimize.ts` — SVGO wrapper (multipass, `floatPrecision: 2`, `removeViewBox:false`, `removeDesc:false`) doubling as a parse/validity gate; throws on malformed input.
- `index.ts` — public surface re-export.
- `draw/test/*.test.ts` — `bun:test` units for each module.

**Render/verify harness**:
- `plugins/design/dev-server/canvas-lib.tsx` — **edit**: add `DrawProof` export (renders a mark across the 16/24/48/256 ladder × light/dark/flatten as labeled `DCArtboard`s).
- `plugins/design/dev-server/bin/draw-proof.sh` — generates a proof canvas under `<designRoot>/_draw/<slug>.proof.tsx`, screenshots it via `--all-screens`, returns the screenshot dir. Reached via `maude design draw-proof`.
- `plugins/design/dev-server/bin/svg-optimize.sh` (or `.mjs` shim) — CLI front for `optimize.ts`; reached via `maude design svg-optimize`.

**Agent + command + reference**:
- `plugins/design/agents/draw-agent.md` — `name: design:draw-agent`. Generator + self-verify loop.
- `plugins/design/agents/draw-critic.md` — `name: design:draw-critic`. Independent rubric judge for the panel.
- `plugins/design/agents/_draw-design-rules.md` — the distilled principles + 30-check machine-checkable rubric (single source; both agents read it). Underscore prefix = not a slash command.
- `plugins/design/commands/draw.md` — `name: design:draw`, `category: daily`. The orchestrator.

**CLI / docs / decisions**:
- `cli/commands/design.mjs` (or wherever `maude design <verb>` dispatches) — **edit**: register `draw-proof` + `svg-optimize` verbs.
- `plugins/design/dependencies.json` — **edit**: add SVGO.
- `package.json` — **edit**: add SVGO to dev-server deps; confirm `draw/` ships.
- `plugins/design/CATEGORIES.md` — **edit**: add `/design:draw` to daily; note `draw-agent`/`draw-critic` auto-routing.
- `.ai/archive/decisions/DDR-0XX-svg-generation-geometry-engine.md` — architecture decision (draw-as-code + verify-loop design).
- `.ai/archive/decisions/DDR-0XX-svgo-dependency.md` — the one new dep, frozen, files-manifest implications.

### Design canvases

> No `.design/` canvas matched — this is design-plugin **internal tooling**, not a UI feature consumed via a mockup. Section intentionally empty. The closest "canvas" is the generated `DrawProof` harness, which this feature itself produces.

### Documentation (research foundation — preserve these)

**What makes design good (→ encoded in `_draw-design-rules.md`):**
- Gestalt principles — [IxDF](https://ixdf.org/literature/topics/gestalt-principles), [Toptal](https://www.toptal.com/designers/ui/gestalt-principles-of-design)
- Composition/balance/focal points — [Smashing: Balance](https://www.smashingmagazine.com/2015/06/design-principles-compositional-balance-symmetry-asymmetry/), [Smashing: Visual Weight](https://www.smashingmagazine.com/2014/12/design-principles-visual-weight-direction/)
- Visual hierarchy + scan patterns — [IxDF](https://ixdf.org/literature/topics/visual-hierarchy), [NN/G F-pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/), [NN/G Layer-cake](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)
- 8pt spacing grid — [designsystems.com](https://www.designsystems.com/space-grids-and-layouts/), [The Hangline](https://www.thehangline.com/8px-grid-spacing-system-explained-for-web-designers/)
- Color / 60-30-10 / OKLCH / WCAG — [60-30-10](https://www.sixtythirtyten.co/blog/choose-color-palette-60-30-10-rule), [OKLCH](https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes), [WebAIM contrast](https://webaim.org/resources/contrastchecker/)
- Type scale / measure / leading — [type scales](https://cieden.com/book/sub-atomic/typography/different-type-scale-types), [Baymard line length](https://baymard.com/blog/line-length-readability)
- Logo principles / Paul Rand — [Paul Rand criteria](https://inkbotdesign.com/paul-rand/), logo types [99designs](https://99designs.com/blog/design-tipps/types-of-logos/)
- Icon grids / keylines — [Material system icons](https://m1.material.io/style/icons.html), [icon grids](https://designproject.io/blog/icon-design-grids-keylines/)
- **Optical adjustments (overshoot, centroid-centering, equal-area)** — [Bjango](https://bjango.com/articles/opticaladjustments/), [logodesign.net](https://www.logodesign.net/blog/optical-adjustments-in-logo-design/)

**LLM SVG generation + verify loops (→ encoded in `draw-agent.md` + engine design):**
- Benchmarks/failure modes — [SVGenius](https://arxiv.org/html/2506.03139v1), [pelican benchmark](https://simonwillison.net/2025/Nov/25/llm-svg-generation-benchmark/), [LLM4SVG](https://arxiv.org/html/2412.11102v1), [OmniSVG](https://arxiv.org/html/2504.06263v1)
- Plan-before-draw / primitives-first — [SVGThinker](https://arxiv.org/pdf/2509.24299), [Chat2SVG](https://arxiv.org/pdf/2411.16602), [StarVector](https://github.com/joanrod/star-vector)
- Draw-as-code / computed geometry — [Stop Fixing Your AI SVGs](https://pub.towardsai.net/stop-fixing-your-ai-svgs-715df70ccca0)
- Verify loop (cap 3, select-don't-just-refine, keep-best) — [Self-Refine](https://selfrefine.info/), [Idea2Img](https://idea2img.github.io/), [Agentic Pelican on a Bicycle](https://www.robert-glaser.de/agentic-pelican-on-a-bicycle/)
- **VLM-as-judge: rank, don't score** — [VLM Judges Can Rank but Cannot Score](https://arxiv.org/html/2604.25235v1), [Rating Roulette](https://arxiv.org/pdf/2510.27106)
- SVG production a11y/optimization — [dbushell](https://dbushell.com/2025/06/25/svg-optimization-and-accessibility-basics/), [SVGO node API](https://svgo.dev/docs/usage/node/)

### Patterns to Follow

**1. `SvgPrimitive` reducer + dual serialize/JSX single source** (from `canvas-arrowheads.ts`):
```ts
// One reducer turns intent into ordered primitives; serializer and JSX-renderer
// both consume the SAME primitives, so on-disk SVG and on-canvas JSX never drift.
export type SvgPrimitive =
  | { el: 'line'; x1: number; y1: number; x2: number; y2: number; dash: boolean }
  | { el: 'path'; d: string; dash: boolean }
  | { el: 'polygon'; points: string; fill: string }
  | { el: 'circle'; cx: number; cy: number; r: number; fill: string };
// Keep the engine root a `.ts` that imports NOTHING from react/.tsx (DDR-067) to
// avoid breaking @types/react's global JSX namespace under `types: ["bun-types"]`.
```

**2. Agent inputs envelope + JSON verdict** (from `signature-moment-critic.md`): clone the `Inputs (orchestrator passes you)` block, the `Aggregate score → verdict thresholds`, the final fenced-`json` verdict (the loop parses the *last* json block), and the `Failure handling` table. `draw-agent`'s verdict adds `iterations_run`, `kept_best_round`, `rubric` (per-check pass/fail), `output_path`, `output_mode` (`inline|asset`).

**3. Auto-routing precedent** (from `new.md` step 9.5 / `edit.md` step 7.5 routing of `design-system-keeper`): same mechanism routes `draw-agent` when a canvas needs custom art.

**4. Bun + path discipline**: new dev-server code uses `Bun.*` where it does IO (DDR-009/020); pure-math engine modules are runtime-agnostic; disk paths come from `paths.ts` (DDR-045); tests are `bun:test`.

---

## Design Decisions

> Repurposed for this tooling feature: the engine/architecture decisions (each becomes a DDR).

### Decision 1 — Draw as code via a deterministic geometry engine (not raw LLM path strings)

| Choice | Rationale |
|---|---|
| **LLM emits intent; engine computes coordinates** | Removes the documented LLM-SVG failure classes (integer quantization, coordinate drift, occlusion, alignment rot). Confirmed by SVGenius/LLM4SVG/OmniSVG + the "Stop Fixing Your AI SVGs" practitioner pattern. The repo already proves the pattern (`canvas-arrowheads.ts`). |
| Reserve hand-written `<path d>` for genuinely freeform curves | …and even then via the PCHIP spline helper, not LLM-guessed Béziers. |

→ **DDR-0XX-svg-generation-geometry-engine**.

### Decision 2 — Verify loop drives on pairwise ranking + binary checks, never absolute VLM scores

| Choice | Rationale |
|---|---|
| Generate N candidates → **pairwise-rank** → keep-best → structured rubric critique → iterate, **cap 3–4** | VLM judges rank reliably but score with ±3/5 noise and poor intra-rater consistency (arXiv 2604.25235, 2510.27106). Composition freezes after round 1 and oscillates/over-complicates without a keep-best gate (Agentic-Pelican finding). Idea2Img's selection-among-N (+26.9pp over single-pass) is the lever. |
| Verify text/counts/exact-color by **parsing the SVG source / primitive list / palette tokens**, NOT by asking the vision model | VLMs confidently misread rendered text, counts, and colors. |

→ folded into **DDR-0XX-svg-generation-geometry-engine** (loop section).

### Decision 3 — SVGO as the single new dependency

| Choice | Rationale | Alternative considered |
|---|---|---|
| Add **SVGO** to dev-server deps (validity gate + optimize) | Pure-JS, Bun-compatible, MIT, healthy; doubles as a parse/validity gate. One dep. | In-house optimizer — rejected: reimplementing path-data rounding + plugin pipeline is more risk than one well-maintained dep. |
| Reuse **agent-browser** (already present) for rasterization | Real browser engine = highest fidelity, matches what users see, zero new deps. | resvg-js/sharp — rejected: redundant given agent-browser; sharp is a native addon (conflicts with bun-compile/zero-dep goals). |

→ **DDR-0XX-svgo-dependency** (note `package.json` `files`, `dependencies.json` manifest, and the frozen-lockfile/hub-image implications of DDR-054).

### Supported draw types (scope of "SVG + other canvas things")

`icon` (24-grid keyline family) · `logo` (wordmark/lettermark/pictorial/abstract/combination/emblem) · `illustration` (spot/hero) · `diagram` (nodes + A* connectors + constraint labels — this is what the *full* engine unlocks) · `spot` (decorative geometric composition / pattern / background). **Out of scope:** full multi-artboard layout generation (that stays `/design:new`); photorealism (no vector method does it).

---

## Tasks

Execute in dependency order, grouped by milestone. Each task is atomic and testable. `/flow:utils-verify` after each; `pnpm test:dev-server` after each engine task.

### Milestone A — Geometry engine core

#### Task A1: CREATE `draw/primitives.ts`
- **Do**: Define `DrawPrimitive` union (superset of `SvgPrimitive`), grid-snapped constructors (`rect/circle/ellipse/line/polyline/polygon/path/text/group`), `place(part, {x,y,scale,rotate})` → transform string, viewBox presets, `defs`/`symbol`/`use` support.
- **Pattern**: `canvas-arrowheads.ts` `SvgPrimitive` + the one-way `.ts → no react import` rule (DDR-067).
- **Gotcha**: keep this file react-free; JSX rendering lives only in `serialize.ts#toJsx`.
- **Validate**: `pnpm test:dev-server` (A-unit tests, Task A6).

#### Task A2: CREATE `draw/geometry.ts`
- **Do**: PCHIP monotone spline; A* connector routing (obstacle-aware, chamfered corners); `centroid()` + convex-hull weight; optical-correction helpers (`overshoot()`, `equalAreaCircleScale ≈ 1.1284`, `centroidCenter()`).
- **Pattern**: `shaftPath()`/`arrowHeadPoints()` in `canvas-arrowheads.ts` (pure trig, returns geometry).
- **Gotcha**: PCHIP must be monotone (no overshoot) — that's the whole point vs naive Bézier.
- **Validate**: unit tests assert monotonicity, A* avoids obstacles, overshoot ratios.

#### Task A3: CREATE `draw/palette.ts`
- **Do**: WCAG contrast ratio fn; OKLCH→sRGB + ramp generator (constant-L per tier); 60-30-10 area-distribution check; `currentColor` default.
- **Gotcha**: OKLCH conversion must be correct — test against known WebAIM ratios.
- **Validate**: unit tests vs published contrast pairs.

#### Task A4: CREATE `draw/serialize.ts`
- **Do**: `toSvg(primitives, {viewBox, a11y})` (keep viewBox, inject `role="img"`/`<title>`/`<desc>`, `currentColor` default) **and** `toJsx(primitives)`. SVG↔JSX parity is the core invariant.
- **Pattern**: the dual serialize/render single-source contract in `canvas-arrowheads.ts`.
- **Validate**: round-trip test — `toSvg` then parse, and `toSvg`↔`toJsx` produce structurally identical trees.

#### Task A5: CREATE `draw/optimize.ts` + `draw/index.ts`
- **Do**: SVGO wrapper (multipass, `floatPrecision:2`, `removeViewBox:false`, `removeDesc:false`); throws on malformed (validity gate). `index.ts` re-exports the public surface.
- **Gotcha**: SVGO v4+ keeps viewBox/title by default but still strips `<desc>` — override.
- **Validate**: optimize round-trips a known mark; rejects malformed SVG.

#### Task A6: CREATE `draw/test/*.test.ts` (engine units)
- **Do**: `bun:test` covering A1–A5 (no server needed — pure functions).
- **Pattern**: `test/canvas-route.test.ts` import style (`bun:test`), minus the server sandbox.
- **Validate**: `pnpm test:dev-server` green.

### Milestone B — Layout / diagram engine

#### Task B1: CREATE `draw/layout.ts`
- **Do**: constraint-based label placement (simultaneous solve w/ overlap penalty), grid + 4/8pt snap, modular-scale ladder.
- **Gotcha**: label solver must be deterministic (no `Math.random`) for reproducible output + testable.
- **Validate**: unit test — N labels around M anchors, assert no overlaps + on-grid.

#### Task B2: ADD diagram composition helper (nodes + A* edges + labels)
- **Do**: a `diagram()` helper composing `geometry.ts` A* routing + `layout.ts` labels into primitives.
- **Validate**: unit test — a 4-node graph routes edges without crossing nodes.

### Milestone C — Render / verify harness

#### Task C1: ADD `DrawProof` to `canvas-lib.tsx`
- **Do**: component rendering a mark across **16/24/48/256px × {light, dark, single-color flatten}** as labeled `DCArtboard`s (each becomes a `--all-screens` target).
- **Pattern**: existing `DCArtboard`/`DesignCanvas`/`useTheme` usage in canvas-lib.
- **Gotcha**: canvas-lib edits hot-reload all iframes; keep the export additive (no breaking change to existing exports — DDR-025 single-source).
- **Validate**: scaffold a proof canvas, `maude design screenshot --all-screens`, eyeball the ladder.

#### Task C2: CREATE `bin/draw-proof.sh` + wire `maude design draw-proof`
- **Do**: generate `<designRoot>/_draw/<slug>.proof.tsx` (gitignored like `_history`), screenshot `--all-screens`, print screenshot dir.
- **Pattern**: `screenshot.sh` + `slug.sh`; reach disk via `paths.ts` (DDR-045).
- **Gotcha**: `_draw/` must be added to the design root `.gitignore` template.
- **Validate**: `maude design draw-proof --asset <svg> --slug test` returns a dir of PNGs.

#### Task C3: CREATE `bin/svg-optimize.sh` shim + wire `maude design svg-optimize`
- **Do**: CLI front for `optimize.ts`.
- **Validate**: `maude design svg-optimize <in.svg>` emits optimized SVG to stdout.

#### Task C4: UPDATE `cli/` dispatch + reachability
- **Do**: register `draw-proof` + `svg-optimize` in `maude design` dispatch.
- **Gotcha**: **DDR-062** — plugin markdown must NOT call `bash .../bin/*.sh` directly; only `maude design <verb>`. `cli/lib/plugin-cli-reachability.test.mjs` enforces it.
- **Validate**: `node cli/bin/maude.mjs design draw-proof --help`; reachability test green.

### Milestone D — The draw-agent

#### Task D1: CREATE `agents/_draw-design-rules.md` (the rubric)
- **Do**: distill the research into principles (Gestalt, composition, hierarchy, spacing, color, type, logo, icon, optical) + the **30-check machine-checkable rubric** (HARD/STRONG/SOFT tiers; HARD = WCAG, 8pt grid, 16px legibility, single-color flatten).
- **Pattern**: `_pastier-probe-templates.md` reference-doc layout.
- **Validate**: doc review — every check is yes/no or measurable.

#### Task D2: CREATE `agents/draw-agent.md`
- **Do**: `name: design:draw-agent`. Body: (1) plan-before-draw protocol; (2) **draw only via the engine** (`@maude/canvas-lib`/`draw/` import; never free-hand `<path>`); (3) the verify loop (N candidates → render via `maude design draw-proof`/`screenshot` → pairwise-rank → keep-best → rubric critique → cap 3–4); (4) source-level verification of text/counts/color; (5) JSON verdict.
- **Pattern**: clone `signature-moment-critic.md` Inputs envelope + verdict + Failure-handling table.
- **Gotcha**: instruct it to **stop / simplify** (over-complication is a documented failure); keep-best is mandatory.
- **Validate**: dry-run via `/design:draw` (Task E) on 3 briefs (icon, logo, diagram).

### Milestone E — `/design:draw` command + registration

#### Task E1: CREATE `commands/draw.md`
- **Do**: `name: design:draw`, `category: daily`. Parse brief + flags (`--type`, `--grid`, `--inline`/`--asset <path>`, `--into <canvas>`, `--perfect [N]`, `--no-critic`). Pre-flight (`server-up`, `prep`), spawn `draw-agent`, run loop, write output (inline TSX or asset), optionally run `draw-critic`, report + refresh docs.
- **Pattern**: `new.md`/`edit.md` orchestration + server lifecycle.
- **Validate**: `/design:draw "minimal fox head logo, single color" --type logo --asset` produces a verified asset.

#### Task E2: UPDATE `CATEGORIES.md`
- **Do**: add `/design:draw` to the daily table; add `draw-agent`/`draw-critic` to the auto-routed-agents table (they omit `category:`).
- **Validate**: `/design:help` lists `/design:draw`; agents stay out of the catalog.

### Milestone F — draw-critic (independent judge) + panel

#### Task F1: CREATE `agents/draw-critic.md`
- **Do**: `name: design:draw-critic`. Independent rubric judge (reads `_draw-design-rules.md`), scores the final mark, emits the standard verdict. Specialized for standalone vector art (the gap graphic-design-critic doesn't cover).
- **Pattern**: `signature-moment-critic.md` scoring + verdict.
- **Validate**: run on a known-good and known-bad mark; verdicts differ correctly.

#### Task F2: UPDATE critic panel routing
- **Do**: route `draw-critic` into the panel when the canvas/feedback involves a logo/icon/illustration/diagram (skill `design` "Critic panel routing").
- **Validate**: `/design:critic` on a canvas with a custom mark includes `draw-critic`.

### Milestone G — Auto-integration into new / edit

#### Task G1: UPDATE `new.md` + `edit.md` routing
- **Do**: when a canvas needs custom art (art slot in `/design:new`, or feedback like "add/draw a logo/icon/illustration/diagram" in `/design:edit`), route to `draw-agent` instead of hand-writing SVG.
- **Pattern**: the `design-system-keeper` auto-route insertion points (step 9.5 / 7.5).
- **Gotcha**: gate it — don't fire `draw-agent` for trivial inline icons already covered by the icon set; only for genuine custom marks.
- **Validate**: `/design:edit "draw a small abstract leaf logo in the header"` routes through `draw-agent`.

### Milestone H — Deps, docs, decisions, gates

#### Task H1: ADD SVGO dependency + manifests
- **Do**: add SVGO to dev-server deps; update `plugins/design/dependencies.json`; confirm `package.json` `files` ships `draw/`; mind frozen-lockfile/hub image (DDR-054).
- **Validate**: `maude doctor` reports no missing dep; `pnpm install` clean; tarball-shape gate green.

#### Task H2: RECORD DDRs
- **Do**: `DDR-0XX-svg-generation-geometry-engine` (draw-as-code + verify loop) and `DDR-0XX-svgo-dependency`. Use `/flow:record-ddr`.
- **Validate**: DDRs linked from `draw-agent.md` + `optimize.ts`.

#### Task H3: UPDATE CLAUDE.md + dev-server doc + roadmap
- **Do**: add `draw/` engine + `draw-proof`/`svg-optimize` verbs to the dev-server helpers table in CLAUDE.md; regen site roadmap (`pnpm --filter @maude/site gen:roadmap`) since a plan was added/archived.
- **Validate**: `claude-md-keeper` clean; roadmap diff committed.

---

## Validation

Run to confirm zero regressions (this repo's gates, from `workflows.config.json`):

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Tests**: `pnpm test && pnpm test:dev-server` (engine units + proof-route/verb tests; **TDD** the engine — tests before/with each module per `flow:testing-rules`)
4. **Build**: `pnpm --filter @maude/site build`
5. **Parity/tarball/tokens/site-content**: `bash scripts/check-version-parity.sh`, `bash scripts/check-tarball-shape.sh`, `pnpm --filter @maude/site sync:tokens:check`, site-content gate
6. **Reachability**: `node --test cli/lib/plugin-cli-reachability.test.mjs` (DDR-062 — new verbs reached via `maude design`)
7. **Runtime bundles**: `bash plugins/design/dev-server/bin/check-runtime-bundles.sh` (if canvas-lib edit changes a runtime bundle, regen + commit per CLAUDE.md)
8. **Capability smoke** (the real backbone — this feature's "scenario"): run `/design:draw` on 3 briefs (icon / logo / diagram), confirm each converges and the `DrawProof` ladder shows a mark that passes the HARD rubric checks (16px legible, single-color flatten, WCAG).

> **Cross-platform 5-platform scenario does NOT apply** — `platforms: []` in config and this is plugin-internal tooling, not an end-user app screen. The `draw-proof` size-ladder + `draw-critic` are the verification surface. Note this in the PR so `/flow:done` doesn't block on a missing scenario.

---

## Scenario Coverage

Not a multi-platform UI feature. Verification backbone:
- **Engine**: `bun:test` units (PCHIP monotonicity, A* obstacle avoidance, WCAG ratios, serialize SVG↔JSX parity, optimize validity gate).
- **Capability**: the `draw-proof` ladder + `draw-critic` rubric verdict on representative briefs (icon / logo / diagram), captured as screenshots in the PR.

---

## Acceptance Criteria

- [ ] All milestone tasks completed in order
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` overall:
  - [ ] Static (lint, format)
  - [ ] Tests (`pnpm test && pnpm test:dev-server`) — engine TDD'd
  - [ ] Build
  - [ ] Parity / tarball / tokens / site-content / reachability / runtime-bundle gates green
- [ ] `maude doctor` reports no missing dep after SVGO added
- [ ] `/design:draw` converges on icon/logo/diagram briefs; output passes the HARD rubric checks (16px legible · single-color flatten · WCAG contrast · on-grid icon family)
- [ ] `draw-agent` + `draw-critic` emit a parseable JSON verdict (loop-compatible)
- [ ] No DDR-worthy decision left unrecorded (geometry-engine + SVGO dep)
- [ ] CLAUDE.md dev-server helper table + site roadmap updated
- [ ] Code follows project conventions (Bun APIs for IO, `paths.ts` for disk, `name: design:<slug>` frontmatter, `<group>-<verb>` filenames, no direct bin paths in markdown) — no regressions

---

## Research foundation (the deep research you asked for)

**What makes design good — the 30-check machine-checkable rubric** (to land verbatim in `_draw-design-rules.md`). Severity: **HARD** = objective defect · **STRONG** = best practice (deviation needs a one-line reason) · **SOFT** = context-judged.

- **Hierarchy**: (1) exactly one clear primary focal element [STRONG]; (2) largest text ≥1.5× body [STRONG]; (3) ≥3 typographic tiers [STRONG]; (4) squint/blur test — surviving blobs are the intended primaries [STRONG].
- **Spacing/grid**: (5) all spacing on 4/8pt scale, flag 7/11/13/23px [HARD]; (6) intra-group < inter-group spacing (≥~1.5–2×) [STRONG]; (7) internal ≤ external spacing [STRONG]; (8) edges align to a small set of x/y positions [STRONG].
- **Type**: (9) sizes on a consistent modular ratio [STRONG]; (10) body measure 45–75ch [STRONG]; (11) body line-height ~1.4–1.6, headlines tighter [STRONG]; (12) ≤2–3 families [SOFT].
- **Color**: (13) every text/bg pair meets WCAG AA (4.5:1 / 3:1; non-text ≥3:1) [HARD]; (14) ~60-30-10, accent ≤~15% area [STRONG]; (15) recognizable harmony, no two saturated colors fighting at equal value [STRONG]; (16) ramps perceptually even (OKLCH) [SOFT]; (17) never color-alone meaning [SOFT].
- **Composition**: (18) focal point off-center unless deliberately static [SOFT]; (19) not everything centered [STRONG]; (20) balanced visual weight [SOFT].
- **Optical correction (craft tier)**: (21) curves/circles overshoot flat edges ~1–3%, circle ~+13% vs equal-extent square [STRONG]; (22) triangles/play-icons centroid-centered, not bbox-centered [STRONG]; (23) logo icon ~1–3% larger than adjacent cap height [SOFT].
- **Icon family**: (24) shared stroke width + corner radius + keyline grid + optical weight [STRONG]; (25) pixel-snapped, consistent live-area padding [STRONG].
- **Logo**: (26) legible/recognizable at 16px [HARD]; (27) survives single-color black-on-white flatten [HARD]; (28) free of dated trend effects + stock clichés [SOFT].
- **Anti-pattern sweep**: (29) same semantic role styled identically [STRONG]; (30) whitespace deliberate/active with macro breathing room [SOFT].

**Strongest objective anchors** (the non-negotiable core the engine enforces in code): WCAG ratios, the 4/8pt scale, modular type ratios, 45–75ch measure, proximity (intra<inter), the squint test, and the optical-correction trio (overshoot, centroid-centering, single focal point).

**The hard truth from the SVG-generation research** (why the engine exists): LLMs free-handing SVG quantize coordinates to integers, hallucinate/drift coordinates, mis-order paths (occlusion), and degrade colors — and the defects accumulate over edits. Fix = the LLM specifies *intent*, deterministic code computes *coordinates*; plan before drawing; verify with a short **rank-not-score, keep-best** loop (cap 3–4) on real browser renders; and verify text/counts/color from the *source*, never from the vision model.

---

## Retro

Closed out 2026-06-01 across three commits — `0b4a4a3` (Milestones A–H: engine + serialize + agents + `/design:draw` + new/edit routing + DDR-070/071), `9edbfdf` (engine v2: gradients/filters/patterns/masks/blend + composition layer + principle-grounded critics + DDR-074), `4942e65` (brush + engraving layer).

**What worked**
- **Draw-as-code held up.** The `SvgPrimitive`→single-source-serialize pattern (DDR-067) generalized cleanly to the whole vocabulary; the SVG↔JSX parity invariant + the SVGO validity gate caught every malformed build. The `maude design draw-build/draw-proof/svg-optimize` verbs + the `MAUDE_DRAW_ENGINE` injected-path trick made the engine runnable portably without a bundler specifier.
- **The verify loop earned its keep.** Reading proof PNGs into context (DDR-021) caught real defects the build couldn't — the pastel "muddy" variant, the neon overlap, the hero-text↔blob collision — before they shipped.
- **Research-driven correction beat intuition.** The deep-research pass overturned the golden-ratio assumption (myth, non-discriminating as a gate) and reframed "blob soup" as a *generation-architecture* failure (random vs armature-constrained). That produced the composition layer + the discriminating critic metrics (value-range / harmony-distance / VME balance / dominance / APCA) instead of vibe-scoring.

**What didn't / surprised**
- **Procedural composition has a soul ceiling.** Repeated attempts at a tattoo/engraving crest stayed "competent but soulless" no matter how many primitives were added (hatch → contour → stipple → engraveLines). The honest learning: a brush/engraving *toolkit* is the right deliverable; the soul in the reference art comes from a human (or a high-latitude visual agent) **drawing the forms** and applying the brushes — not from a generator composing the whole. Don't promise auto-soul from procedural generation.
- **Critics were too lenient initially** — they passed "soup" at 4.x/"portfolio-grade". Root cause was gut-scoring; fixed by grounding them on computed metrics + an anti-soup gate. Lesson: a critic without a measurable floor drifts generous.
- **Shared-tree concurrency was constant.** A second session committed Phase-9.1 TSX-sync work (DDR-072/073) to `main` throughout. Staging only own files atomically (per the scope-to-repo-state rule) kept commits clean; a spurious `dist/client.bundle.js` rebuild from server boots had to be excluded twice.

**For next /plan or /execute**
- When a plan's deliverable is "good-looking output", separate **mechanism** (testable, plannable) from **aesthetics** (judgment, has a ceiling) up front, and set expectations on the latter — don't let "make it dope" become an open-ended iteration loop.
- The DDR README index has drifted badly (~40 of 73 DDRs unindexed, pre-existing) — worth a dedicated `/flow:maintain` backfill, separate from feature work.
- Follow-ups deferred (not blockers): wire `draw-agent` to *apply* the brush/engraving toolkit per-form (the realistic path to soul); `inkBleedFilter` preset; round-cap for `taper:'none'`. The `setup-ds` organic-seed step is specced but not yet exercised live.
