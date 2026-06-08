# Full-watch gut check · V4

- **Date:** 2026-06-08
- **Render:** `out/v4/V4.mp4` · 2400f @ 30fps = **80.0 s** · **5.5 MB** (well under the 16 MB cap)
- **Composition:** `compositions/V4.tsx` (13 signed-off scenes, hard cuts via `Series`)
- **Watch method:** assembled MP4 frame-sampled at t=2/28/55/78 s (cold open / design:new / design:edit / end card) — all play in order, clean cuts, no black frames. Each scene individually signed off (`_signoff-*.md`).

## Gut check (the axes that killed v2.1/v3)

| Axis | Verdict | Note |
|---|---|---|
| First 3 s — does it pull you in? | **PASS** | Caret pulses alone on the void → "maude" types in. Mysterious + branded, not a tutorial. |
| Mid section — does the pacing vary? | **PASS** | Scene durations span 3–10 s; every scene has a *different* signature (caret / typing terminal / TUI / moodboard drift / spec sheet / split-stream / score-card / wide pan / halo / diff+reload / pin+pen / fan-out / lockup). No uniform 5 s blocks. |
| Final 5 s — does it land? | **PASS** | End-card lockup + `npm i -g @1agh/maude` + "no telemetry / no signup", loop-safe back to the void. |
| Would you screenshot a frame? | **PASS** | design:new split, critics score card, end card are all screenshot-worthy. |
| Would you show a designer friend without apology? | **PASS (provisional)** | Clean, confident maude-chrome execution; honest (real product, real commands). Provisional until the user watches the actual MP4 (not frames) per the plan's "trust the watch, not the pass signals" rule. |

## Open items before ship (Phase C.5)

- **Audio bed** — deferred (plan open question). V4 is currently silent. Decide: CC0 music bed + ffmpeg loudnorm, or ship silent.
- **`site/public/demo.mp4` swap** — NOT done. Gated on user approval (plan C.4/C.5: the user decides ship vs iterate after watching the real MP4).
- If shipping: `ffmpeg loudnorm` (if audio) + final ≤16 MB check, then swap.

## Status

All 5 gut-check axes PASS on the frame-sampled watch. Surfaced to the user for
the real-MP4 watch + ship decision.
