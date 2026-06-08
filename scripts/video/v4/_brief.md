# v4 intro film — visual vocabulary brief

> Captured via `/design:setup`-style decision pass (4 axes, AskUserQuestion)
> 2026-06-08 and signed off by the user ("ok super") as the Phase A.5 gate.
> The concrete, authoritative artifact is the **storyboard canvas**
> `.design/ui/Studio Intro Video.tsx` (3 artboards: brief / storyboard /
> landing) — this markdown mirrors its decisions for Phase B authoring.

## The four decided axes

- **Narrative / rhythm philosophy.** The full real loop end-to-end (v2.1
  spine): install → onboarding → moodboard → `/design:new` → canvas →
  `/design:edit` → comments → handoff → end card. The narrative is NOT
  reinvented — the win comes from *execution*: every scene earns its own
  signature moment and the pacing is uneven on purpose. Length decided by
  rhythm, not a clock (≈80 s draft across 13 scenes). No uniform 5 s blocks.

- **Type personality.** Inter Tight (display) + Inter (body) + JetBrains
  Mono (part-numbers, commands, captions). The maude DS stack — confident,
  modern, mono-as-first-class for anything machine-y (commands, coords,
  scores). Display tracking tight (-0.02em) for the wordmark.

- **Motion vocabulary.** Spring entrances over linear fades; max-width /
  reveal "typing" for terminal + wordmark; live fill (skeleton → content)
  for the agent draw; presence cursor drift; hard cuts between scenes (no
  long dissolves). Each scene's signature is a *different* motion idea —
  caret-on-void, typing terminal, streaming split, score-card resolve,
  wide pan, inspector halo, diff+reload, pin-drop, export fan-out, end-card
  lockup. Compositor-only props (transform/opacity); reduced-motion safe.

- **Color philosophy.** Maude product chrome — dark cool-neutral studio
  (hue 255 elevation ladder), the infinite **dotted canvas** as the
  recurring stage, ONE confident indigo accent (oklch 0.68 0.18 268), and
  the violet-magenta presence cursor held 54° off the accent so it never
  reads as "the accent." It is the real UI, not a fake mock.

## Signature treatment (the one screenshot)

The **cold-open caret on the empty dotted void** resolving into the
`maude` wordmark — the "you start with nothing" beat. It is the loop-safe
bookend with the end card.

## Hard-NO list

- No benefit-card grids.
- No captions-with-captions / documentation-walkthrough feel.
- No uniform pacing or school-project even cuts.
- No catalog motif by reflex (SKU stamps, paper bg, hairlines, Berkeley
  Mono) — superseded by the maude-DS decision.
- No "wow tax" thinking — each scene earns its own moment; nothing rides
  in because it was already built.

## Voice

Voice-aligned captions — short, dry, lowercase-leaning, catalog-spine
tone. Echoes the site: "Two plugins, one CLI." · "No telemetry. No
signup." Captions read like a voiceover script but ship as on-screen text
(no recorded VO committed yet — open question deferred).
