# Feature — Draw animation layer: a serializable keyframe IR + native per-platform renderers + motion-aware verify loop

> Validate engine + agent docs before implementing. Decision recorded in
> [DDR-094](../decisions/DDR-094-draw-animation-keyframe-ir-native-authoring-lottie-export.md);
> grounded in the studyfi-v3 mascot session (StudyFi DDR-011 + its execution
> report + system review) and a 2026-06-05 deep-research pass on SMIL→Lottie.
> Extends the static draw engine (DDR-070) + composition layer (DDR-074).

## Description

Give the `/design:draw` stack a **first-class animation capability** so animated
marks (mascots, animated logos/icons, motion spots) are **generated and verified
inside the draw loop**, not hand-rolled in `/design:edit`. The core is a **general,
serializable keyframe IR** — a timeline of keyframed property tracks attachable to
any node/group — that **renders natively on each platform from ONE source**: web
SMIL / `motion`, and **React Native via `react-native-svg` + Reanimated**. The IR
*is* the cross-platform animation format; maude is its editor; the renderers are
thin adapters. Lottie is a **secondary export** only. This extends the DDR-067
single-source `toSvg`/`toJsx` invariant from static geometry to time.

**Phase milestone:** `/design:draw "<animated brief>"` produces an animated mark
whose morph/sequence is engine-generated (not LLM-guessed, not Python-perturbed),
verified **live** (sampled over real time, not a freeze-frame); and `/design:to-rn`
emits a **theme-aware Reanimated component** of the same animation for the StudyFi
RN app — no Lottie, no editor, no lossy conversion.

## User Story

As a designer iterating on an animated mascot, I want the draw agent to generate
the animation *as code* and prove it animates live before saying it's done — and I
want to drop that exact animation into the React Native app as a native, theme-aware
component — so I stop steering dead morphs and stop facing a "now re-animate it for
mobile" wall.

## Problem

The draw engine is **100% static** (no animation primitive; `draw-proof` renders
only still artboards; the rubric never mentions motion). Consequences, all observed
in studyfi-v3:

1. **Animation falls outside the loop** — ad-hoc CSS/SMIL in `/design:edit`, no
   mechanism, no rubric, no verification.
2. **Invalid verification (D2)** — a paused freeze-frame computes a static keyframe
   even when nothing interpolates → CSS `d:path()` "passed" while dead; ~3 rounds lost.
3. **Mechanism thrash** — CSS transform → CSS `d:` (dead) → SMIL; the known-good
   ladder wasn't written down.
4. **"Animate as code" doesn't exist** — final morph variants came from a Python
   perturbation *outside* the engine, bypassing the iron law (DDR-070).
5. **Gotchas re-discovered** — CSS `transform` overrides `transform=`; SMIL ignores
   the CSS reduced-motion catch-all.
6. **License surfaced late (D5)** — a CC-BY external asset became load-bearing
   before its attribution obligation was acknowledged.
7. **No RN bridge** — SMIL doesn't survive `react-native-svg`; and (deep research)
   **no SMIL→Lottie converter exists** and After Effects rejects animated SVG, so
   without an IR there is no path to RN at all.

## Solution

A general keyframe IR (vertex-array valued) + native per-platform renderers + a
motion-aware verify loop, plus the supporting fixes. User requirement honored:
**"animate sequences of anything, not just morph — the engine must be scalable."**
RN strategy: **native renderer over the shared IR** (theme-aware, all code, no
editor); Lottie deferred to a secondary export. See DDR-094 for rationale.

---

## P0 — the animation IR + native serializers + live verify (the root-cause fix)

### Task P0.1 — Animation IR module (`draw/animate.ts`)
- React-free root (DDR-067). Types:
  - `Keyframe` = `{ t, value, ease?: cubicBezierHandles }`.
  - `Track` = keyframes on one property: `d` (shape morph, **vertex-array valued**),
    `transform` (translate/scale/rotate), `opacity`, fill / **gradient stops**.
  - `Timeline` = `{ dur, begin?, repeat?, tracks, stagger? }`; tracks attach to a
    node/group id. **Stagger + sequence composition** for choreography.
- Unit tests: timeline composes; stagger offsets; easing round-trips.

### Task P0.2 — `morphVariants()` producer (vertex-array, deterministic)
- `morphVariants(basePath, { n, jitter, seed })` → a `d`-track whose keyframe values
  are **vertex arrays** sharing an **identical command template / fixed vertex
  count** (the cross-renderer interpolability constraint). Deterministic; replaces
  the ad-hoc Python perturbation. Pure; unit-tested for vertex-count invariance.

### Task P0.3 — Web serializers: IR → SMIL + IR → motion/JSX (single source)
- Extend `serialize`: same node-tree-plus-`Timeline` emits SMIL
  (`<animate>`/`<animateTransform>`) for the `.svg` form **and** `motion`/WAAPI
  keyframes for the JSX form (`motion` ships in canvas-lib).
- Invariants: RM gate emitted for both; **position-vs-animation split** (outer
  `transform=` attribute, inner animated node).
- Test: SVG↔JSX **parity** for an animated mark (DDR-067 invariant, time-generalized).

### Task P0.4 — `_draw-motion-rules.md` (motion companion to the rubric)
- Mechanism ladder (envelope → CSS transform / `animateTransform`; shape morph →
  motion / Reanimated / SMIL, **never CSS `d:`**); the four gotchas; the live-verify
  rule; the RM-gate pattern. Read by `draw-agent` (motion branch) + motion-aware critic.

### Task P0.5 — Live-motion proof gate (`draw-proof --motion`)
- Sample an animated property over **real wall-clock time** (`getBBox()` /
  `getComputedStyle()` at t0 vs t1); assert it changes. Freeze-frame pass +
  over-time fail ⇒ HARD fail. Reuses existing screenshot machinery.

### Task P0.6 — Wire `draw-agent` + critic motion branch
- Motion brief → read `_draw-motion-rules.md`, plan the timeline, generate via IR
  producers, run `--motion` proof. Verdict gains a `motion` block. Motion-aware
  critic judges mechanism + live-verified + RM-gate from source.

---

## P1 — React Native delivery (the bridge the user needs) + external-asset path

### Task P1.1 — RN renderer + `/design:to-rn` skill (PRIMARY RN bridge)
- A renderer that emits a **`react-native-svg` + Reanimated** component from the IR:
  - path morph = a Reanimated worklet lerping keyframe **vertex arrays** by phase,
    rebuilding `d` from the shared command template, fed via `useAnimatedProps` to
    `AnimatedPath`;
  - gradients via `LinearGradient`/`Stop`; **colors as props (theme-aware)**;
  - reduced motion via Reanimated `useReducedMotion()` → static base frame;
  - per-layer `withRepeat(withTiming(…, {duration}))`; transform tracks for envelope.
- `/design:to-rn` skill packages it — spec sketch: [`notes/design-to-rn-skill-spec.md`](notes/design-to-rn-skill-spec.md).
  Input: IR, or a **disciplined** engine-authored SMIL mark (parse `<animate values>`
  → vertex arrays — works because of the fixed-vertex-count discipline). **NOT** an
  SVG→Lottie parser.
- Validated against StudyFi RN stack (Expo 53, RN 0.79, `react-native-svg` 15.13,
  `react-native-reanimated` 3.17). See the POC (below) for the reference impl.

### Task P1.2 — Reference-adapt sub-mode + license-at-fetch HARD gate
- Sanctioned "look like THIS external asset" branch: fetch the license **first**,
  surface options (keep+attribute / swap PD-CC0 / redraw via engine), record
  provenance, then adapt. Default stays engine-first. (Fixes studyfi-v3 D5.)

### Task P1.3 — `toLottie()` serializer — **secondary, deferred**
- IR → Lottie: vertices → `ty:sh` `ks`; `keySplines` → `i`/`o` (1:1); `linearGradient`
  → `gf` (`t:1`); RM host-gated; theme via slots / dotLottie theming.
- Reference: `python-lottie` or `@lottiefiles/lottie-js` (generic keyframe API).
- **Build only on a concrete `.lottie` need** (non-Claude pipeline, designer
  hot-swap). The IR (P0.1/P0.2 vertex arrays) keeps this a serializer, not a rewrite.

---

## P2 — tooling robustness + durable lessons (orthogonal, helps everything)

### Task P2.1 — Server/port-bounce resilience in `screenshot.sh` / `server-up.sh`
- On `ERR_CONNECTION_REFUSED`, re-read the live port from `<designRoot>/_server.json`
  and retry. Apply from capture #1.

### Task P2.2 — Persist durable lessons
- StudyFi project memory: `reference_maude-svg-animation.md` (4 gotchas + live-verify);
  strengthen the screenshot note with the port-bounce detail.
- Maude: the motion ladder lives in `_draw-motion-rules.md` (P0.4).

---

## Risks

- **Engine surface growth** (IR + serializers + producer + proof + RN renderer).
  *Mitigation:* land P0.1–P0.3 behind tests (parity, vertex invariance) before
  wiring agent/skill; keep producers pure.
- **Two web mechanisms + an RN renderer to maintain.** *Mitigation:* shared IR makes
  renderers thin; the ladder makes mechanism choice deterministic; collapse SMIL→motion
  later if redundant (DDR-094 revisit).
- **Vertex-count constraint leaks into art authoring.** *Mitigation:* `morphVariants()`
  enforces it; reference-adapt normalizes traced paths to a fixed count.
- **RN morph perf** (worklet rebuilding `d` per frame). *Mitigation:* the mascot scale
  (≤ a few layers, ~tens of vertices) is comfortably within budget; precomputed-frame
  fallback if a heavy mark needs it.

## Out of scope

- Physics/particle simulation, video, full app-level motion choreography (stays
  `/design:edit` + flow `motion-rules`).
- Lottie/Rive as an **authoring** format (rejected — DDR-094).
- After Effects pipeline (rejected — doesn't import animated SVG).
- Eager `toLottie()` (deferred to a concrete need).

## Verification

- **P0:** unit tests (IR compose/stagger, vertex invariance, SVG↔JSX animated
  parity); a `--motion` proof that flags a deliberately-dead `d:path()` as HARD fail;
  `/design:draw "<animated brief>"` generating + live-verifying a morph + an envelope.
- **P1.1:** the POC RN component renders + morphs in the StudyFi app; `/design:to-rn`
  on a disciplined SMIL mark emits an equivalent component.
- **P1.2:** a reference-adapt run stops and surfaces a license before integrating.
- **P1.3 (if built):** a `toLottie()` mark renders in `lottie-react-native` matching
  the web reference on shape, gradient, timing, RM.
- **P2.1:** kill the dev server mid-capture; the next screenshot re-reads the port.

## POC (done 2026-06-05 — validates P1.1)

A `react-native-svg` + Reanimated port of the studyfi-v3 fire-ring proves the native
RN bridge end-to-end: the three SMIL morph layers → vertex-array worklet lerp,
gradients native, per-layer dur, RM-gated, colors as props. Lives at
`StudyFiMobile/src/components/mascot/`. The generator that produced it
(reads disciplined SMIL → emits the RN component) is the reference implementation
for the `/design:to-rn` skill (P1.1).

## Metadata

- **Status:** planned (decision DDR-094 accepted; POC done; engine work not started)
- **Created:** 2026-06-05
- **Owner:** —
- **Related plans:** [phase-25 archive](archive/phase-25-designer-draw-svg-agent.md)
