# DDR-094: Draw animation as a serializable keyframe IR — native authoring in maude; **Lottie emitted from code is the validated 1:1 web+mobile delivery**; per-platform native renderers (rn-svg/Reanimated) a fallback for light cases

- **Date:** 2026-06-05
- **Status:** Accepted — **primary/fallback flipped after a working POC (2026-06-05); see the Update section below.** (Originally recorded native-renderer-primary; the POC found that doesn't hold for rich continuous animation.)

> ## Update 2026-06-05 — POC built + self-verified; the primary path is Lottie-from-code
>
> A full POC ported the studyfi-v3 fire mascot to React Native. It surfaced two
> **real** limits of the native `react-native-svg` + Reanimated renderer that the
> original "native-primary" decision didn't anticipate:
>
> 1. **`feTurbulence` / `feDisplacementMap` have NO native implementation** in
>    react-native-svg 15.x (JS-only stubs; no iOS `.mm` / Android `.java`). Procedural
>    texture (the body "shine") simply cannot render natively → must be pre-baked.
> 2. **Continuous multi-layer path-`d` morph froze the whole app** — rn-svg re-parses
>    a Path's `d` on every change and re-renders the whole `<Svg>` when any child
>    updates; with SVG `<Filter>`s in the same tree it ran an offscreen pass every
>    frame. Even isolated, continuous `d`-morph is at rn-svg's performance ceiling.
> 3. **Hand-matching two implementations drifts** — the rn-svg port kept missing
>    nuances (pre-jump tremble, mouth grit→yell) because it was a second hand-built
>    renderer chasing the web by eye. "Guaranteed 1:1" is impossible by construction
>    when web and native are separate implementations.
>
> **Lottie-from-code solves all three** and was validated: a python-lottie generator
> (`to-lottie.py`) emits ONE `.lottie` from the same keyframe data + the `_layout.css`
> choreography, **self-verified by rendering frames through the real lottie-web
> runtime** (not cairo — cairo can't render masks). The SAME file plays on
> `lottie-web` (web) and `lottie-react-native` (mobile) → **1:1 guaranteed by
> construction**, performant (native Lottie runtime), and theme handled via Lottie
> color overrides. The only thing Lottie also can't compute is procedural turbulence —
> same pre-bake answer, but consistent across platforms.
>
> **Decision flip:** **Lottie emitted from code is the PRIMARY production delivery for
> rich/continuous animation, on web AND mobile** (one artifact, both platforms).
> Native rn-svg/Reanimated is the **fallback** for light/occasional animation where a
> Lottie dependency isn't warranted. Authoring stays native in maude; `/design:to-lottie`
> (alias `/design:to-rn`) is the productionizing handoff (e.g. inside `/flow:execute`).
> The IR + `morphVariants` + per-segment-easing design (below) is unchanged — it now
> feeds a `toLottie()` serializer as the primary target.
>
> ### Correct CSS/SMIL → Lottie conversion rules (the load-bearing findings)
>
> These are what the `/design:to-lottie` skill MUST encode (the POC found each the hard way):
>
> 1. **Per-segment easing from the actual CSS tokens.** A CSS `cubic-bezier(x1,y1,x2,y2)`
>    becomes Lottie keyframe handles by applying the same `Bezier((x1,y1),(x2,y2))` to
>    **every** keyframe (sets each kf's `o=(x1,y1)` + `i=(x2,y2)` → every segment exact).
>    **Preserve overshoot (`y>1`)** — `--ease-out: cubic-bezier(0.34,1.42,0.5,1)` is the
>    "snap/odpich"; a generic smooth/Sigmoid easing kills it. Each animation uses its OWN
>    token (body/lids/mouth/aura = ease-in-out; fire-shoot = ease-out overshoot; morph = keySplines).
> 2. **Port EVERY animated property** — easy to miss one (the POC initially dropped the
>    mouth `grit→yell`). Enumerate from the CSS, don't eyeball.
> 3. **Arc path commands (`A`) → parse with python-lottie (`parse_svg_file`)**, never
>    hand-approximate with a bezier (the first mouth shape was wrong because of this).
> 4. **Lottie `layers[0]` renders on TOP** (and within a layer/group, first shape = top).
>    Build back→front then **reverse** the layer list (parenting resolves by `ind`, not
>    array position, so reversing is safe).
> 5. **Masks for clipping** (eyes, mouth) work on lottie-web/lottie-react-native but NOT
>    in python-lottie's cairo preview — **self-verify through lottie-web headless**, not cairo.
> 6. **Incommensurate sub-loops** (the 1.05/0.85/0.70 s flame flicker vs the 3.6 s master)
>    can't be independent loops in one Lottie comp — bake the flicker keyframes across the
>    comp duration and **hide the loop seam in an invisible phase** (here the extinguish, opacity 0).
> 7. **Coordinate offset + baked static transforms** — shift the viewBox origin into the
>    comp (here `+44` for `0 -44 120 176`), bake static `translate/scale` into vertices, and
>    leave only the ANIMATED transforms as Lottie keyframes (jump on a parent null, flame
>    envelope as a layer scale about the base).
> 8. **Gradient opacity stops** are appended after color stops in the flat colors array
>    (`[off,r,g,b,...]` then `[off,alpha,...]`, `count` = color-stop count) — needed for
>    the soft aura glow + flame tip fade.
>
> POC artifacts: generator `AI-StudyMate/.design/_draw/_to-lottie.py`; output
> `StudyFiMobile/src/components/mascot/mascot-fire.json`; the rn-svg fallback port lives
> beside it (`Mascot.tsx`). Self-verify recipe: emit JSON → embed in an HTML with
> `lottie.min.js` → `agent-browser` screenshot per `?f=<frame>` → compare to web.

- **Status (original):** Accepted (decision recorded; implementation planned, not yet built — see [feature-draw-animation-layer plan](../plans/feature-draw-animation-layer.md))
- **Tags:** design, dev-server, draw, animation, motion, svg, smil, react-native, reanimated, lottie, keyframe-ir, single-source, deep-research, regression-prevention
- **Related:** [DDR-070](./DDR-070-svg-generation-geometry-engine.md) (the static geometry engine this extends), [DDR-074](./DDR-074-draw-composition-layer-and-discriminating-critic-metrics.md) (composition layer + discriminating metrics), [DDR-067](./DDR-067-annotation-figjam-parity-v2-shape-tool-arrowheads-cursors.md) (the single-source `SvgPrimitive` → SVG+JSX invariant generalized here), [DDR-045](./DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (engine path resolution), [DDR-062](./DDR-062-plugins-reach-executable-logic-via-maude.md) (verbs via `maude design`), and the StudyFi DDR-011 (SMIL `<animate>` over CSS `d:path()`) that motivated this.

## Context

The draw engine (DDR-070) and its critics (DDR-074) are **100% static**. The
engine surface (`primitives → geometry → palette → layout → serialize → optimize`)
has **no animation concept at all**, `draw-proof` renders only still artboards
(16/24/48/256 × {light, dark, flatten}), and the rubric (`_draw-design-rules.md`)
never mentions motion. So when a brief is "animated mascot," the agent draws a
single still frame and **all animation falls outside the draw loop** — into ad-hoc
hand-authored CSS/SMIL via `/design:edit`, with no mechanism guidance, no rubric,
and no verification.

The studyfi-v3 mascot session (execution report + system review + DDR-011,
2026-06-04) is the worked example of the cost: ~3 rounds burned on a dead
mechanism (CSS `d:path()` doesn't animate live here, but a paused freeze-frame
*looked* like proof — invalid verification); mechanism thrash (CSS transform → CSS
`d:` → SMIL); the final morph variants generated by a **deterministic Python
perturbation outside the engine** (bypassing "draw as code"); and two gotchas
re-discovered (CSS `transform` overrides `transform=`; SMIL ignores the CSS
reduced-motion catch-all).

Two questions then arose:

1. **How should the draw layer support animation natively** — and does the user
   requirement *"animate sequences of anything, not just morph; the engine must be
   scalable"* fit?
2. **Once an animation is polished in maude, how does it actually ship into the
   StudyFi React Native app** (where SMIL doesn't survive `react-native-svg`)? Build
   a Lottie translator? Author cross-platform from the start?

A [deep-research pass](#deep-research-the-lottie-question) (2026-06-05; 6 angles,
23 sources, 25 claims adversarially verified — 17 confirmed / 8 killed) answered
the Lottie sub-question decisively, and reframed the whole pipeline.

## Decision

**Animation in the draw engine is a first-class, serializable keyframe IR — a
general timeline of keyframed property tracks attachable to any node/group — and
the SAME IR is rendered natively on each platform.** The IR *is* the cross-platform
animation format; **maude is its editor**; web (SMIL / `motion`) and React Native
(`react-native-svg` + Reanimated) are thin **renderers** over it. Lottie is a
**secondary export** for the narrow cases where a `.lottie` asset is genuinely
wanted — never the primary bridge, never an authoring target.

Five parts:

### 1. A general animation IR, not a morph special-case (the scalability requirement)

A new engine module (`draw/animate.ts`, React-free root per DDR-067) defines an
**animation track IR** that any node or group carries:

- A **track** = an ordered list of **keyframes** on one animatable property:
  `d` (path/shape morph, **vertex-array valued** — not a `d` string; see part 2),
  `transform` (translate / scale / rotate — the envelope beats: shoot-up,
  extinguish, jump), `opacity`, fill / **gradient stops**.
- Each keyframe has a time, a value, and an **easing** (cubic-bezier handles, the
  `keySplines` form).
- Tracks compose into a **timeline** with `dur`, `begin`/delay, `repeat`, and
  **stagger** across a slot set, so multi-element **sequences and choreography**
  ("clench → ignite → cheer → extinguish", interweaving layers at different `dur`)
  are expressible — *animate sequences of anything*, not just morph.

`morphVariants(basePath, {n, jitter, seed})` is **one producer** into the IR — a
deterministic path-`d` perturbation that **preserves command structure / vertex
count** (the constraint that makes morph interpolable). It replaces the ad-hoc
Python perturbation and emits **vertex arrays**, not a `d` string (see part 2).
Iron law preserved: the LLM specifies animation *intent*; the engine computes
keyframe values. "Animate as code," the natural extension of "draw as code."

### 2. The IR holds vertex arrays so it serializes losslessly to every target

Path keyframes are stored as **vertex arrays with a shared command template**, not
as `d` strings, because the morph must interpolate on three different runtimes that
each represent paths differently:

- **Web SMIL** — `<animate values="d0;d1;…">` (reassemble each frame's `d`).
- **Web/RN motion runtimes** — interpolate the vertices, rebuild `d` per frame.
- **Lottie** (export) — native bezier `ks` (`v`/`i`/`o`/`c`), *not* a `d` string.

A `d`-string-only IR would paint us into SMIL-only and block every other renderer.
The vertex-array form is the single representation all three fall out of.

### 3. React Native delivery = a native renderer over the shared IR (the primary bridge)

The same IR renders in the RN app via **`react-native-svg` + Reanimated** — no
Lottie, no conversion, no editor. Concretely (validated against the StudyFi RN
stack: Expo 53, RN 0.79, `react-native-svg` 15.13, `react-native-reanimated`
3.17):

- **Path morph** — a Reanimated worklet lerps between two keyframe **vertex
  arrays** (by phase) and rebuilds the `d` string from the shared command template;
  `useAnimatedProps` feeds it to an `AnimatedPath`. Identical-command-structure (the
  same discipline SMIL needs) is what makes the lerp valid.
- **Gradients** — `react-native-svg` `LinearGradient` / `Stop` natively; **colors
  are props → theme-aware** (the decisive win over Lottie, which bakes color).
- **Reduced motion** — Reanimated's `useReducedMotion()` (or `AccessibilityInfo`)
  → render the static base frame. Per-platform gate, no format dependency.
- **Per-layer timing + envelope** — each layer its own `withRepeat(withTiming(…,
  {duration}))`; transform tracks (scaleY shoot-up / extinguish) drive a shared
  value — sequences/choreography expressed natively.

This keeps the **maude authoring loop intact** (Claude iterates in the canvas with
live preview + critics); the RN renderer is a thin adapter that consumes the same
IR the web renderer does. Packaged as a **`/design:to-rn` skill** (part 5).

### 4. Lottie is a secondary IR *export*, not the bridge — and there is no translator

The deep research is decisive: **there is no production mechanism to translate an
SMIL-animated SVG into Lottie**, and After Effects does not import animated SVG at
all. So Lottie can only be reached by emitting it from the **IR** (`toLottie()`),
and it earns its place only in narrow cases — handing a `.lottie` asset to a
non-Claude pipeline, designer hot-swap, an already-Lottie-heavy host. For a
Claude-authored, theme-aware mascot its losses bite (baked color → manual
re-theme; reduced-motion not in the format → host-gated; no converter) and its
wins (editor handoff, portable asset) don't apply. `toLottie()` is therefore
**deferred** — built only if a concrete Lottie need appears — but the IR's
vertex-array form (part 2) keeps it a serializer, not a rewrite. Mapping is clean
and verified: vertices → `ty:sh` `ks`; `keySplines` → `i`/`o` handles 1:1;
`linearGradient` → `gf` (`t:1`).

### What we are NOT doing

- **Not** adopting Lottie/Rive as an **authoring** format. Their value is "a
  designer animates in an editor (After Effects / Rive editor) and exports." Claude
  has no editor; it would have to hand-author Lottie JSON (nested, normalized
  coordinate space, transform matrices) — a *worse* coordinate-hallucination
  surface than `<path d>`, violating the iron law harder. Editors break the maude
  loop, which is the whole point.
- **Not** routing through After Effects (doesn't import animated SVG).
- **Not** trusting freeze-frames to prove motion (see part 6).

### 5. The `/design:to-rn` skill (packaging the RN renderer)

A skill emits a **`react-native-svg` + Reanimated** component from a maude
animation — input is the IR, or (transitionally) an engine-authored / disciplined
SMIL mark whose `<animate values>` can be parsed back to vertex arrays because it
follows the fixed-vertex-count discipline. Output is a drop-in RN component sharing
the keyframe data. It is an **IR emitter, NOT an SVG→Lottie parser** — parsing
arbitrary rendered SVG is the unsolved problem; parsing *disciplined* maude output
is tractable and is the migration path for marks authored before the IR exists.

### 6. Verification + supporting changes

- **Live-motion proof gate** — `draw-proof --motion` samples an animated property
  over **real wall-clock time** (`getBBox()` / `getComputedStyle` at t0 vs t1) and
  asserts it changes; a freeze-frame pass + over-time fail is a HARD fail. (Kills
  the studyfi-v3 D2 gap.)
- **`_draw-motion-rules.md`** — the mechanism ladder (envelope → CSS/`animateTransform`;
  shape morph → motion/Reanimated/SMIL, **never CSS `d:`**), the four gotchas, and
  the RM-gate pattern. Read by `draw-agent` (motion branch) + a motion-aware critic.
- **Reference-adapt + license-at-fetch gate** — sanctioned "look like THIS external
  asset" branch: fetch the license first, surface options, record provenance, then
  adapt. (Fixes studyfi-v3 D5.)

## Deep research: the Lottie question

Run 2026-06-05 (deep-research harness; 6 angles, 23 sources fetched, 92 claims
extracted, **25 adversarially verified — 17 confirmed / 8 killed**). Headline,
high-confidence findings:

| Finding | Verdict | Source |
|---|---|---|
| **No production SMIL→Lottie converter.** lottie-web has no SMIL import *or* export; issue #62 open since 2016, never implemented; bodymovin's SMIL renderer on hold. | confirmed 3-0 | [lottie-web#62](https://github.com/airbnb/lottie-web/issues/62) |
| **LottieFiles Universal Importer (2026-03) ingests SVG but does static cleanup only** — zero SMIL-morph carryover (animation carryover is FLA/AEP + GIF/MP4 only). | confirmed 3-0 | [LottieFiles blog](https://lottiefiles.com/blog/working-with-lottie-animations/universal-file-importer-bring-any-file-into-lottie-creator) |
| **After Effects does not import animated SVG.** Adobe verbatim: *"Animated and raster SVGs are not supported."* SMIL morphs discarded. ("AE preserves morph + gradients" claims killed 0-3.) | confirmed 3-0 | [Adobe AE SVG import](https://helpx.adobe.com/after-effects/using/import-svg-files.html) |
| **Code-first Lottie generation from a keyframe IR is viable.** lottie-js object model; keyframes a property block `k` with `t`+`s`. No turnkey "morph" helper (pessimistic framing killed 0-3 — generic keyframe API expresses it); `python-lottie` / `@lottiefiles/lottie-js` emit programmatically. | confirmed 2-1 | [lottie-js](https://github.com/LottieFiles/lottie-js), [lottie-spec](https://lottie.github.io/lottie-spec/1.0/specs/properties/), [python-lottie](https://github.com/eltiempoes/python-lottie) |
| **Lottie paths are native bezier** (`ty:sh`, `ks` = `v`/`i`/`o`/`c`), not `d` strings; **morph requires matching vertex count** ("no requirement" killed 1-2 → constraint holds). Same discipline as SMIL. | confirmed 3-0 | [lottie-docs shapes](https://lottiefiles.github.io/lottie-docs/shapes/) |
| `linearGradient` → Lottie `gf` (`t:1`, linear universal; conic uneven at runtime). | confirmed 3-0 | [lottie-docs shapes](https://lottiefiles.github.io/lottie-docs/shapes/) |
| **`keySplines` → Lottie `i`/`o` cubic-bezier handles 1:1.** SMIL easing is a strict subset, always representable. | confirmed 3-0 | [lottie-spec](https://lottie.github.io/lottie-spec/1.0/specs/properties/) |
| **Reduced-motion is NOT in the Lottie format** — handled at the host runtime, same posture as gating SMIL in the component. ("only iOS implements it" framing killed 0-3.) | confirmed 3-0 | [lottie-spec#7](https://github.com/lottie/lottie-spec/issues/7) |
| **dotLottie runtime theming exists but is manual** (expose slots; gradient theming hand-wired — "flat-color-only" killed 0-3, so gradient re-theme *is* possible, not free). | confirmed 3-0 | [dotLottie theming](https://developers.lottiefiles.com/docs/tools/dotlottie-js/theming/) |
| **Rive imports static SVG geometry only**; animation authored in the Rive editor (state machines). Good RN runtime, not a *translation* of existing SMIL. | confirmed 3-0 | [Rive features](https://rive.app/features) |

**Net:** "is there a reliable tool to translate this animation to Lottie?" → **no**
(no converter; AE rejects animated SVG). The only reliable bridge is to emit from
the IR. And since the IR can equally feed a **native Reanimated renderer** — which
is theme-aware, all-code, and editor-free — the native renderer, not Lottie, is the
right primary RN target.

## Why these specific choices

| Choice | Rationale | Alternative rejected |
|---|---|---|
| Native per-platform renderers over a shared IR (primary RN bridge) | Theme-aware (colors are props, not baked), all code Claude authors, no editor, no lossy conversion, RM native per platform. Keeps the maude canvas loop. | Lottie as primary — bakes color, RM outside the format, no converter to even reach it from SMIL. |
| IR holds **vertex arrays**, not `d` strings | Web SMIL, web/RN worklet lerp, and Lottie `ks` all fall out of vertices; a `d` string serializes to none but SMIL. | `d`-string IR — SMIL-only, blocks the RN renderer and Lottie. |
| General keyframe-track timeline (not a `morphVariants` helper alone) | User requirement: "animate sequences of anything, scalable." Tracks express morph + transform + opacity + gradient + stagger + choreography in one abstraction. | One-off morph helper — the fire needed envelope + sequence + stagger too. |
| Lottie a deferred secondary export | No converter exists; Lottie's wins don't apply to a theme-aware Claude-authored mascot, its losses do. Build only on a concrete `.lottie` need. | Build `toLottie()` eagerly (premature) / make it the bridge (worse than native renderer). |
| Native authoring (Claude writes code), editors out of band | The geometry engine already yields deterministic coordinates; Lottie/Rive's editor value is absent without an editor and breaks the maude loop. | Author in Rive/AE/LottieFiles — hand-authoring or GUI, both leave the Claude loop. |
| Live-motion proof (sample over time) | A freeze-frame computes a static keyframe even when nothing interpolates — it falsely "confirmed" the dead `d:path()` (~3 rounds). | Trust paused freeze-frames (the D2 failure). |

## Consequences

**Positive:**
- One IR, every target: SMIL (web `.svg`), `motion`/WAAPI (web JSX), **Reanimated
  (RN)** — and Lottie if ever needed. The RN port is a renderer/serializer, not a
  re-animation, and stays **theme-aware**.
- Animated marks are generated and verified inside the draw loop; the ad-hoc Python
  perturbation becomes `morphVariants()`. The maude canvas loop is preserved.
- studyfi-v3 failure modes structurally prevented: live-motion gate (D2), mechanism
  ladder (thrash), RM-gate + transform-split gotchas (D4), license gate (D5).
- "Animate sequences of anything" — a general timeline, scalable past morph.

**Negative / trade-offs:**
- **Two web mechanisms + an RN renderer** to maintain. Mitigated by the shared IR
  (renderers are thin adapters consuming one data source) and a deterministic
  mechanism ladder.
- Real engine surface to build (IR types, serializers, vertex-array producer,
  live-motion proof, the RN renderer / skill). Bounded but not free.
- Morph authoring constrained to a **fixed vertex count** across keyframes (so every
  renderer interpolates) — a real constraint on how morph art is built.
- If `toLottie()` is later built: Lottie loses `currentColor` (manual re-theme),
  RM host-gated — fidelity costs the native forms don't carry.

**Scope guardrails:** the IR covers keyframed vector animation (morph, transform,
opacity, gradient, stagger/sequence) of engine-authored marks. Out of scope:
physics/particle simulation, video, full app-level motion choreography (stays
`/design:edit` + the flow `motion-rules` skill).

## Revisit when

- **A concrete `.lottie` need appears** (non-Claude pipeline, designer hot-swap) →
  build `toLottie()` then; the IR is ready.
- **The dev-server render gains reliable live CSS `d` animation** → CSS morph
  becomes viable and the SMIL RM-gate complexity drops (DDR-011 revisit).
- **The mascot becomes highly interactive** (state-machine driven by app state /
  gestures) → Rive's runtime may beat hand-maintained renderers; the IR decision is
  unaffected (still the single source), the target shifts.
- **Maintaining two web mechanisms (SMIL + motion) proves redundant** → collapse to
  one (likely `motion`) and keep SMIL only for the standalone `.svg` asset form.

## Linked

- Plan: [`feature-draw-animation-layer.md`](../plans/feature-draw-animation-layer.md)
- Deep research: `tasks/wxwv7vc25` (2026-06-05; 23 sources, 25 verified claims)
- POC: `StudyFiMobile/src/components/mascot/` (react-native-svg + Reanimated port of the studyfi-v3 fire-ring) — validates part 3
- StudyFi origin: `AI-StudyMate/.ai/decisions/DDR-011-svg-path-morph-uses-smil.md`,
  `.../logs/execution-reports/studyfi-v3-mascot-fire-and-eyes.md`,
  `.../logs/system-reviews/studyfi-v3-mascot-fire-and-eyes-review.md`
- Supersedes: — (extends DDR-070 / DDR-074)
