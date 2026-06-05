# `to-lottie` POC — reference bundle

The working proof behind [DDR-094](../../../decisions/DDR-094-draw-animation-keyframe-ir-native-authoring-lottie-export.md)
and the [`/design:to-lottie` skill spec](../design-to-lottie-skill-spec.md): a maude
animation translated **from code** into ONE Lottie that renders 1:1 on web
(`lottie-web`) and mobile (`lottie-react-native`). Authored against the studyfi-v3 fire
mascot; copied here from the StudyFi POC so the source repo can be wiped. **Reference,
not a maintained module** — the real `/design:to-lottie` skill (TS, IR-driven) supersedes it.

## Files

| File | Role |
|---|---|
| `to-lottie.py` | **The primary reference.** python-lottie generator: reads `mascotFireData.ts` (flame keyframes) + the hardcoded `_layout.css` `.mascot--fire` choreography → emits `mascot-fire.json`. Encodes all 8 conversion rules (see the skill spec): per-segment easing incl. overshoot, arc parsing, `layers[0]`=top + reverse, masks, baked sub-loops, coord offset, gradient opacity stops. |
| `mascotFireData.ts` | Input: the 3-layer flame morph (vertex frames + command templates), gradients, outer transform — extracted from the studyfi-v3 `_mascot-fire-ring.tsx` SMIL. |
| `mascot-fire.json` | The verified Lottie output (the proof). Plays via `<LottieView source={require('./mascot-fire.json')} autoPlay loop/>` (RN) or `dotlottie-react` (web). |
| `verify.html` | Self-verify harness: loads `mascot-fire.json` through real `lottie-web`, seekable per-frame (`?f=<n>`). Render frames headless (`agent-browser`) and compare to the web reference — **cairo can't render masks, lottie-web must**. |
| `to-rn.mjs` | Fallback-path reference: SMIL → `react-native-svg` + Reanimated component generator (emits `MascotFireRing.tsx` + the data module). |
| `Mascot.fallback.tsx` | Fallback-path reference: the full rn-svg + Reanimated mascot (worklet vertex-lerp morph, View-transform body motion). **Light animation only** — continuous rich morph hit rn-svg's perf ceiling (DDR-094 Update). |

## Re-run

```sh
python3 -m venv /tmp/lottie-venv && /tmp/lottie-venv/bin/pip install lottie cairosvg pillow
/tmp/lottie-venv/bin/python to-lottie.py ./mascotFireData.ts ./mascot-fire.json
# self-verify (real lottie-web; cairo can't do masks):
python3 -m http.server 8123   # serve this dir (file:// blocks fetch)
agent-browser open "http://localhost:8123/verify.html?f=108" && agent-browser screenshot frame.png
```
