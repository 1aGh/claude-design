---
"@1agh/maude": minor
---

Draw animation layer — keyframe IR + Lottie-from-code handoff (DDR-094)

Extends the static draw engine (DDR-070) to **time**: a cross-platform keyframe IR is the animation source, authored natively in maude and shipped as one Lottie for web + mobile.

- **Animate a draw mark** — `/design:draw` now handles motion briefs (morph / pulse / blink). A keyframe `Timeline` of property tracks (`draw/animate.ts`) drives the mark; shape morphs come from a deterministic `morphVariants()` producer (fixed vertex count — the cross-renderer interpolability rule), never hand-typed `values=` or CSS `d:path()`. One IR emits both an animated SVG (SMIL) and an animated JSX preview from the same node tree (`toAnimatedSvg`/`toAnimatedJsx`) — the DDR-067 single-source invariant, generalized to time.
- **Live-motion proof** — `maude design draw-proof --motion` samples the animated element at two wall-clock times and requires an over-time delta. A freeze-frame can't prove animation (the dead-`d:path()` trap), so a still-pass + over-time-no-change is a HARD fail.
- **`/design:to-lottie`** (+ `maude design to-lottie`) — productionize an animation into **one `.lottie` from code** that renders 1:1 on web (`lottie-web`/`dotlottie-react`) AND mobile (`lottie-react-native`). It's an emitter from the keyframe data (there's no reliable rendered-SVG→Lottie converter), self-verified through headless lottie-web. Encodes the 8 conversion rules (per-segment easing with overshoot, arc parsing, layer ordering, masks, gradient opacity stops, …).
- **`/design:to-rn`** — native `react-native-svg` + Reanimated fallback for **light** animation only (continuous rich morph hits rn-svg's perf ceiling; `feTurbulence` has no native impl — use `/design:to-lottie` for those).
- **Reference-adapt license gate** — `/design:draw --reference <url>` adapts an external asset only after a license is fetched and the user picks adapt / inspiration-only; provenance is recorded.
- **Screenshot port-bounce resilience** — `screenshot.sh` re-reads the live port from `_server.json` and retries once on `ERR_CONNECTION_REFUSED` (dev-server respawned on a new port).

Reduced motion is host-gated for SMIL/Lottie (the format can't carry it); colors are baked into a Lottie with a runtime override. See DDR-094 + `_draw-motion-rules.md`.
