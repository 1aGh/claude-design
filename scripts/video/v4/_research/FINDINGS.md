# v4 research — reality capture (2026-06-08)

User verdict on the first v4 cut: "nudné, bez šťávy, utahané jak korporátní
prezentace." Root cause: the scenes were **hand-authored mocks** (fake terminal,
fake TUI, fake moodboard, fake spec sheet), so they read generic. Fix: ground
every scene in **how maude actually looks**, then animate that.

## What I captured (real, from the live dev-server on :4401 + real CLI)

| File | What it really is | Maps to scene |
|---|---|---|
| `real-studio.png` | The **real maude Studio** — menu bar (File/Edit/View/Selection/Tools/Help, View dropdown w/ Panels+Zoom), FILES tree (DESIGN SYSTEM / UI CANVASES), dotted canvas w/ artboards + selection handles + comment pin + Δ badge, zoom controls, tool palette, WORLD minimap | 20, 30, 35, 45 |
| `real-canvas-viewport.png` | Real multi-artboard infinite canvas (maude-design-server, 46% zoom, WORLD minimap) | 30 canvas pan |
| `real-colors-accent.png` | Real DS specimen — "Accent. One indigo." w/ prose + oklch table + **in-context studio mock** + accent family + button examples + selection states | 15 DS reveal |
| `real-colors-themes.png` | Real light/dark side-by-side specimen | 15 |
| `real-type-scale.png` | Real type ladder specimen | 15 |
| `real-cards.png` | Real card components | 20 canvas content |
| `real-command-palette.png` | Real ⌘K command palette | 35 / new beat |
| `real-logo.png` | Real brand mark specimen (spark-on-bubble) | 55 end card |
| `real-elevation.png` | Real elevation ladder | texture |
| `real-cli-output.txt` | Real `maude --help` / `maude design help` / `--version` text | 05 install / commands |

## Key realisations

1. **The real Studio is far more credible than any mock.** Real menus, real file
   tree, real canvas chrome, real minimap. The film should *feature the real
   product*, not a fabricated split-screen.
2. **Real DS specimens are editorial + dense** ("Accent. One indigo." with prose,
   tables, in-context mock). My fake spec-sheet (type ladder + 6 swatches) was a
   pale imitation. Use the real specimens.
3. **"Moodboard" has no literal real artifact.** maude's research step produces a
   JSON reference pool (`ux-research-agent`), and the *output* is the realized DS
   specimens — not a Pinterest board. Honest depiction = the research payload +
   the specimens it yields, not a fake mood grid. (Revisit scene 12.)

## Gaps still to close (need a decision)

- **Live Claude Code TUI** running `/design:setup-ds` / `/design:new` /
  `/design:edit` — this is interactive; can't be captured headless from here.
  Options: (a) you record a short screen/asciinema of a real session and I
  composite it; (b) I recreate the TUI faithfully from real command behavior +
  the real `maude design help` strings; (c) drive it via `vhs`/`tmux` capture.
- **Real critics run output** — the critic panel emits a `PANEL.md` report (text),
  no UI specimen. Scene 25 reality = a real verdict report, which I'd need to
  generate from an actual `/design:critic` run.

## Proposed new direction — "real product, cinematic camera"

Stop fabricating. Build scenes as **cinematic camera moves over the real
captures** (push-in, pan, rack-focus, scale-on-cut) + **kinetic type overlays**
+ live accents (cursor, selection halo, presence) composited on top. This is the
Linear/Vercel film grammar: real UI is the hero, motion + type give it šťáva.
Replaces the mock-rebuild approach for the UI-heavy scenes; terminal/CLI scenes
use real command strings.
