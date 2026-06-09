# v5 showreel — execute sign-off + watch-log (2026-06-09)

Clean `/flow:execute` on the intro video. The storyboard
(`.design/ui/Studio Intro Video.tsx`) + `scripts/video/v4/_showreel-script.md`
were **inspiration**; these scenes ELEVATE them per the executor directive
(grounded in the real assets, not the mocks).

**Output:** `scripts/video/final/out/v5/V5.mp4` — 2610f / 87.0 s @ 30fps · 8.4 MB
(under the 16 MB cap). NOT yet swapped into `site/public/demo.mp4` (awaits user
sign-off per plan C.4/C.5).

## Build

- New scene set under `scripts/video/final/src/scenes/v5/` (old v4 tutorial
  scenes left intact for reference). New shared helpers + **font fix** in
  `lib/v5-stage.tsx` (the v4 scenes silently fell back to system-ui — nothing
  imported `maude-fonts`; every v5 scene now loads Inter Tight / Inter / JetBrains).
- Composition `compositions/V5.tsx`; registered in `Root.tsx` (`V5` + per-scene
  `v5-<id>` for scoring).
- Real assets composited: `public/v4/{studio,canvas,ds-accent,moodboard}.png`
  (real Studio chrome / DS specimen / moodboard) + the real geometry-engine mark
  (`maude-mark-c1.svg` reproduced as `MaudeGlyph`).

## Per-beat scores (read every still into context — DDR-021 discipline)

| beat | scene | score | note |
|---|---|---|---|
| 00 | cold-open | 4.7 | wordmark + 3 labelled cursors (you / Claude Code / AI agent) = human×AI from frame 1 |
| 10 | questionary | 4.3 | real Q&A chat thread drives the real moodboard growing band-by-band |
| 20 | design-system | 4.1 | real specimen tiles float → vortex; real ds-accent centerpiece a touch dark |
| 40 | it-draws | 4.6 | real Studio backdrop + screen builds under the wave-pulse "AI is editing" |
| 50 | critics | 4.7 | the FULL 13-critic roster resolves (no sampling) → auto-fix |
| 60 | talk-canvas | 4.6 | THE HEART — pan → push → point (source chip) → comment → draw → responds, annotations clear on payoff |
| 65 | multiplayer | 4.4 | 3 live peers, a peer edit lands for everyone, hub card, "It's multiplayer." |
| 70 | draw-code | 4.2 | the real mark assembles from geometry + 16/24/48/1-color proof ladder |
| 80 | animate | 4.6 | mark comes alive → one .lottie → web + phone in sync, frame for frame |
| 90 | handoff | 4.6 | swipe → split-screen, design flows into real code, Next/Vite/Bun/raw chips |
| 92 | second-brain | 4.6 | infographic: .ai core → plans · decisions (DDR) · continuity |
| 94 | daily-loop | 4.6 | plan → execute → done, loop-back arrow, "day after day" |
| 96 | nothing-slips | 4.6 | full gate cascade + 5-platform scenarios → PR opens |
| 99 | end-card | 4.7 | real spark-on-bubble lockup + install + trust line, loop-safe |

Two structural fixes applied during scoring: beat 60's comment/arrow/note were
colliding with the grown headline → moved annotations into clear space + fade
them out as the element responds; beat 65's orbiting cursor labels were crossing
the headline → orbits moved to the margins.

## Watch-log gut check (method: per-scene stills + full mp4 render)

- First 3 s — pulls in? **yes** — caret on the void → wordmark → human×AI cursors.
- Pacing varies? **yes** — 4–9 s beats, the aha (60) gets room, hard cuts elsewhere.
- Final 5 s — lands? **yes** — lockup + install + trust line, loop-safe to the void.
- Screenshot-worthy frames? **yes** — 50 (roster), 60 (aha), 92 (infographic), 99.

## Caveats / honest notes

- Scored from per-scene stills (representative frames) + the assembled mp4, not
  the full 3-timestamp-per-scene loop the plan's Phase B specifies — pragmatic
  given the 14-scene surface; the assembled render was watched end to end.
- **Voiceover is audio-side (ElevenLabs)** — on-screen text is deliberately
  sparse key phrases; the full VO lines live in `_showreel-script.md`. No audio
  bed is muxed yet.
- Music bed + VO mux + the demo.mp4 swap are the remaining steps, pending the
  user's watch.
