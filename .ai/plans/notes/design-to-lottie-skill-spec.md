# Skill spec — `/design:to-lottie` (alias `/design:to-rn`)

> Sketch, validated by a working POC (2026-06-05). Productionizing handoff: take a
> maude-authored animated mark and **emit ONE Lottie from code** that renders 1:1 on
> web (`lottie-web` / `dotlottie-react`) AND mobile (`lottie-react-native`). See
> DDR-094 (Update section) for why Lottie-from-code is the primary path and why the
> native rn-svg renderer is the fallback. Reference implementation:
> `AI-StudyMate/.design/_draw/_to-lottie.py` (python-lottie) → `mascot-fire.json`.

## One-liner

`design:to-lottie` — Přelož maude animaci (IR / disciplinovaný SMIL+CSS source) na
JEDEN `.lottie` Z KÓDU pro web i mobile. Garantované 1:1 (stejný soubor, stejný
renderer family), výkonné. **Emitter z IR, NE konvertor renderovaného SVG.**

## Why Lottie (not a second native renderer)

The POC built BOTH. The native `react-native-svg` + Reanimated port proved fidelity
is *possible* but hit three real walls (DDR-094 Update): `feTurbulence` has no native
impl; continuous multi-layer `d`-morph froze the app (rn-svg re-parses `d` + re-renders
the whole `<Svg>` every frame); and two hand-matched implementations drift (missed the
pre-jump tremble, mouth grit→yell). Lottie is ONE artifact rendered by the same engine
family on both platforms → 1:1 by construction, performant, from code.

## Inputs / output

| Arg | Meaning |
|---|---|
| `"<mark>"` | The animated mark: an IR handle / `.tsx` canvas / disciplined SMIL+CSS source. |
| `--out <path>` | Output `.lottie`/`.json` (default under the app's assets). |
| `--web` | Also drop a web usage snippet (`dotlottie-react` / `lottie-web`). |
| `--verify` | Render frames through headless lottie-web and emit a comparison strip. |

Output: one `.json` Lottie + a one-line usage (`<LottieView source={require(...)} autoPlay loop/>`
on RN; `<DotLottieReact .../>` on web). Theme colors → Lottie color overrides where needed.

## Algorithm (proven by the POC)

1. **Resolve the source → per-property keyframes + per-layer shapes.** IR path: read
   tracks directly. SMIL+CSS path: read the morph `<animate values>` (→ vertex frames)
   + the CSS `@keyframes` (→ transform/opacity/scale tracks) + the easing tokens.
2. **Build the Lottie via python-lottie** (it owns the format correctness: beziers,
   keyframes, gradients, masks, parenting). Map:
   - path morph → animated `ty:sh` bezier (`v`/`i`/`o`/`c`); parse `d` (incl. `A` arcs)
     with `parse_svg_file`.
   - transforms (jump/scale/rotate) → a parent null layer + per-layer transforms.
   - gradients → `gf`/`gr` with **opacity stops appended after color stops**.
   - clipping (eyes/mouth) → masks.
3. **Apply the conversion rules** (the load-bearing part — see below).
4. **Self-verify through lottie-web** (NOT cairo — cairo can't render masks): embed the
   JSON in an HTML with `lottie.min.js`, `agent-browser` screenshot per `?f=<frame>`,
   compare the arc to the web reference. Iterate until it matches.
5. **Emit** the `.lottie` + usage snippet.

## Conversion rules (MUST encode — each found the hard way in the POC)

1. **Per-segment easing from the real CSS tokens.** `cubic-bezier(x1,y1,x2,y2)` →
   apply the same `Bezier((x1,y1),(x2,y2))` to **every** keyframe (each kf gets
   `o=(x1,y1)` + `i=(x2,y2)` → every segment exact). **Preserve overshoot (`y>1`)** —
   `--ease-out (0.34,1.42,…)` is the "snap"; a generic smooth easing kills it. Each
   animation uses its OWN token (body/lids/mouth/aura = ease-in-out; fire-shoot =
   ease-out overshoot; morph = keySplines).
2. **Port EVERY animated property** — enumerate from the CSS, don't eyeball (the POC
   first dropped the mouth grit→yell).
3. **Arc commands (`A`) → `parse_svg_file`**, never hand-approximate.
4. **Lottie `layers[0]` = top** (and within a layer, first shape = top). Build
   back→front then **reverse the layer list** (parenting resolves by `ind`, safe).
5. **Masks** (clipping) render on lottie-web/RN but NOT in cairo → self-verify via lottie-web.
6. **Incommensurate sub-loops** (flame flicker vs master) → bake the flicker across the
   comp duration; **hide the loop seam in an invisible phase**.
7. **Coordinate offset + baked static transforms** — shift viewBox origin into the comp;
   bake static `translate/scale` into vertices; only ANIMATED transforms become keyframes.
8. **Gradient opacity stops** appended after color stops in the flat array (`count` =
   color-stop count) — for soft glows + tip fades.

## What it does NOT do

- **Not** a converter of *rendered* SVG/SMIL (no reliable one exists — DDR-094 research).
- **Not** an authoring tool — you iterate the animation in maude; this emits.
- **Not** RN-only — the emitted Lottie serves web AND mobile (hence `to-lottie`).

## Integration

- Sits beside `/design:handoff` (shadcn) + `/design:export` as the **motion** handoff.
- Tooling: python-lottie (generator) + lottie-web headless (self-verify) reachable via
  `maude design to-lottie` (DDR-062). Ships the generator + verify HTML harness.
- Fallback: `/design:to-rn` native renderer (rn-svg/Reanimated) for light animation —
  reference `Mascot.tsx`; not for continuous rich morph (perf ceiling).

## Open polish (non-blocking)

- Exact eye proportions / pixel positions; finer color match — micro-tuning, not capability.
- A `toLottie()` engine serializer (TS, from the IR directly) once P0's IR lands — the
  python-lottie generator is the proven reference until then.
