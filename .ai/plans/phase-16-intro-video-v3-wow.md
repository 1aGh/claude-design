# Feature: Intro video v3 — Getting Started scenario + wow layer

> **v3 (2026-05-23).** v2.1 shipped a real-pipeline 90 s cut at
> `site/public/demo.mp4`. User feedback after viewing it: "vypada jak
> prezentace skolniho projektu." Feature beats are correct, captures
> are real, but the editorial layer is missing — no dramaturgy, gentle
> xfades, no infographic moments, no kinetic typography, no surprises.
>
> v3 keeps phase 15.1 infrastructure and most v2.1 captures. It
> **re-scripts the scenario around the freshly-rewritten Getting
> Started flow** (Install CLI → marketplace → plugins → init →
> design loop → flow loop → browser) and **adds a "wow layer"** of
> diagrammatic / kinetic / B-roll-style Remotion compositions that
> sit between feature beats and pay off as a marketing piece.
>
> Length target stays flexible (~90–120 s). Output stays
> `site/public/demo.mp4` (≤16 MB for landing autoplay).

## Description

Replace the v2.1 single-cut storyboard with a **scenario-driven
narrative** that mirrors the new `docs/getting-started.mdx` (install
→ marketplace → plugins → init → design → flow). Layer over it a
**Remotion-native wow track**: kinetic Berkeley-Mono typography
opens / transitions, animated architecture diagrams that materialize
between captures, triptych split-screens (TUI · canvas · diff)
instead of two-pane splits, hard match cuts and whip pans instead
of universal 12-frame xfades, and a closing infographic that lands
the catalog identity.

Re-uses every v2.1 capture that still fits the scenario (install,
TUI setup-ds dry-run, ds-reveal, canvas reveals, comments,
annotations, docs scroll). Adds new captures for the bits the new
onboarding flow surfaces and v2.1 didn't: marketplace install,
`/design:browse` boot, `/flow:setup-prd → plan → execute → done`
loop teaser.

## User Story

As a **first-time visitor** to maude.iagh.cz or the GitHub README,
I want a **~90–120 s video** that:

1. Pulls me in inside the first 3 seconds (kinetic open, not a
   wordmark fade).
2. Walks me through the **actual install flow** in the order the
   docs teach it.
3. Shows real `/design:setup-ds` + `/design:new` + `/design:edit`
   executing, intercut with diagrams that explain *what just
   happened*.
4. Teases the `/flow:plan → execute → done` loop without forcing
   me to sit through a full ship.
5. Lands with a SKU-stamped infographic card that makes me want to
   screenshot it.
6. Never feels like a documentation walkthrough.

## Problem

v2.1's pacing is even (5 s/scene), transitions are uniform (12-frame
crossfade), and every scene shows "the product doing the thing"
without any **editorial commentary** layered over it. There are no
diagrams, no surprises, no moments where the video shifts gear. The
captures are accurate but the *composition* reads as a screen
recording with captions, not a marketing piece.

The scenario also predates the new Getting Started rewrite — v2.1
shows the v0.15 install flow (skipping `npm i -g`, no marketplace
beat, no `/design:init` + `/flow:init` separation, no
`/design:browse` mention).

## Solution

Three layers, composed on top of phase 15.1 infrastructure:

### Layer 1 — Scenario aligned to the new Getting Started

```
                v3 scenario
                ────────────────────────────────────────
hook                    (kinetic Berkeley Mono)     3.0 s
step-0-install-cli      (VHS bun add -g)            5.0 s
diagram-marketplace     (Remotion infographic)      3.5 s
step-1-marketplace      (VHS /plugin marketplace)   4.5 s
step-2-plugins          (VHS /plugin install x2)    5.0 s
diagram-architecture    (Remotion exploded view)    4.0 s
step-3-flow-init        (VHS /flow:init)            5.0 s
step-3-design-init      (VHS /design:init)          4.5 s
BENEFIT card-A          local-figma                 2.5 s
step-4a-setup-ds        (VHS /design:setup-ds)      5.5 s
ds-reveal               (Playwright, 4 specimens)   6.0 s
step-4b-design-new      (triptych: TUI·canvas·diff)10.0 s
canvas-reveal           (Playwright pan)            5.0 s
step-4c-design-edit     (triptych: TUI·canvas·diff)10.0 s
BENEFIT card-B          all-in-one                  2.5 s
canvas-hero             (3 hovers + multi-select)   8.0 s
comments                (Cmd+0 + composer)          5.5 s
annotations             (pen + arrow + label)       4.5 s
BENEFIT card-C          human-ai                    2.5 s
step-5-flow-loop        (kinetic + diagram teaser)  6.0 s
step-6-browser          (VHS /design:browse boot)   4.0 s
docs                    (Playwright smooth scroll)  3.5 s
BENEFIT card-D          your-repo                   2.5 s
infographic-outro       (number ticker + CTA)       5.0 s
                ────────────────────────────────────────
                sum ≈ 115 s on-screen (pre-transitions)
```

24 scenes, target ~95–110 s post-transitions. Transitions are
**non-uniform** (see Layer 3).

### Layer 2 — Wow vocabulary (Remotion compositions)

Six new scene types live alongside the v2.1 set:

| Scene | Role | Component |
| ----- | ---- | --------- |
| `HookScene` | First 3 s. Kinetic Berkeley Mono mask-reveal of "MAUDE" letter by letter, dissolves into "Plugins. CLI. Vibes." Catalog SKU stamp materializes top-right. | `scenes/00-hook/index.tsx` |
| `DiagramMarketplace` | 3.5 s exploded-diagram of `/plugin marketplace add` — the marketplace.json animates from JSON tree to plugin tiles, two tiles peel off and slot into a "Claude Code" shell silhouette. | `scenes/04-diagram-marketplace/index.tsx` |
| `DiagramArchitecture` | 4 s. Shows the **whole maude system** at a glance — file-tree of `.ai/` + `.design/` growing from null, plugin badges (`flow` / `design`) docking onto `Claude Code`, CLI binary tying them together with a line. Holds the diagram on screen for 1 beat as a "this is what you just installed" payoff. | `scenes/05-diagram-architecture/index.tsx` |
| `TriptychFrame` | Three-pane composition (TUI · canvas · diff). LEFT = VHS Claude TUI. CENTER = Playwright dev-server iframe. RIGHT = Remotion-rendered file-diff (semantic colors, monospace). Replaces v2.1's `SplitScreenFrame` for `/design:new` + `/design:edit`. | `scenes/07-triptych/index.tsx` |
| `FlowLoopTeaser` | 6 s kinetic typography. Four slash commands materialize as Berkeley Mono cards (`/flow:setup-prd`, `/flow:plan`, `/flow:execute`, `/flow:done`), each card carries one tiny inline preview (PRD outline, plan tree, edit-verify checkmark, PR badge). Cards arrange into a horizontal stamp-roll. | `scenes/12-flow-loop-teaser/index.tsx` |
| `InfographicOutro` | 5 s closing card. Number ticker counts up: "44 commands · 11 critics · 2 plugins · 1 CLI · 0 telemetry". Catalog footer with install snippet. Spring entrance from below. | `scenes/13-infographic-outro/index.tsx` |

All six use existing tokens (`scripts/video/final/src/lib/tokens.ts`)
and Berkeley Mono. Catalog motif (1 px hairlines, paper bg, SKU
stamp) stays — that's the brand, not the boring part.

### Layer 3 — Transition vocabulary

v2.1 uses `linearTiming({ durationInFrames: 12 })` + `fade()` for
every transition. v3 uses **five** named transitions, picked per
beat:

| Transition | Frames | Where | Effect |
| ---------- | -----: | ----- | ------ |
| `fade-soft` | 9 | Card → next scene | Subtle hand-off |
| `whip-pan-h` | 6 | Across scenario steps (step-0 → step-1, step-1 → step-2, etc.) | Motion-blurred horizontal slide — energy without confusion |
| `mask-stamp` | 14 | Into / out of diagrams | SKU-stamp shaped mask wipe — brand-honest reveal |
| `scale-slam` | 4 | Into triptych | Hard scale 0.98 → 1.02 → 1.0 of incoming, with 50 ms audio thump cue |
| `match-cut` | 0 | TUI typed-command → diagram of the same command | Cursor position aligned across the cut for "click" feel |

Implementation: each transition is a `TransitionPresentation`
exported from `scripts/video/final/src/lib/transitions/` and
applied via `<TransitionSeries.Transition presentation={…}>`.

### Visual verification loop (unchanged from v2.1)

Per-scene intent checks + per-cut contact-sheet review stays. v3
**extends** the per-scene intent list with new entries for the six
new scene types (hook, two diagrams, triptych, flow-loop-teaser,
infographic-outro). Each new entry specifies what must be readable
at the mid-frame.

## Metadata

- **GitHub Issue**: (none — internal phase)
- **Type**: Refactor + New Capability (re-script + new scenes)
- **Complexity**: High
- **App/Package**: `scripts/video/final/` (Remotion workspace)
- **Affected Systems**: Remotion compositions, VHS tapes, Playwright
  specs, ffmpeg post step, `site/public/demo.mp4`
- **Dependencies**: phase 15.1 infrastructure (shipped),
  `bun`, `vhs`, `claude` CLI, `ffmpeg`, `pnpm`
- **Length target**: 95–110 s, ≤16 MB post-loudnorm

---

## Context References

### Must-Read Files

- `site/content/docs/getting-started.mdx` (full) — **the
  authoritative scenario source.** Scene order + caption strings
  derive from this file.
- `scripts/video/storyboard.md` (lines 1–270) — v2.1 storyboard.
  v3 supersedes the "Single cut — scene table" but inherits the
  visual verification loop spec.
- `scripts/video/final/src/compositions/Final.tsx` — v2.1
  composition. v3 extends, doesn't rebuild.
- `scripts/video/final/src/scenes/05-benefit-card/index.tsx` —
  benefit card pattern. New diagram scenes follow the same
  prop-driven copy + spring entrance pattern.
- `scripts/video/final/src/scenes/06-split-screen/index.tsx` —
  v2.1 two-pane split. `TriptychFrame` replaces it for
  `/design:new` + `/design:edit` but reuses its
  Playwright-iframe + VHS-frame loader logic.
- `scripts/video/final/src/lib/tokens.ts` — paper / hairline /
  Berkeley Mono tokens. Reuse, do not redefine.
- `.ai/decisions/DDR-037-marketing-video-cut-a-cut-b.md` — v1
  retro + v2 gotchas. Production rules in `memory/feedback-marketing-video-production.md` extend it.

### Files to Create

- `scripts/video/final/src/scenes/00-hook/index.tsx` — kinetic open
- `scripts/video/final/src/scenes/04-diagram-marketplace/index.tsx`
- `scripts/video/final/src/scenes/05-diagram-architecture/index.tsx`
- `scripts/video/final/src/scenes/07-triptych/index.tsx`
- `scripts/video/final/src/scenes/12-flow-loop-teaser/index.tsx`
- `scripts/video/final/src/scenes/13-infographic-outro/index.tsx`
- `scripts/video/final/src/lib/transitions/whip-pan-h.tsx`
- `scripts/video/final/src/lib/transitions/mask-stamp.tsx`
- `scripts/video/final/src/lib/transitions/scale-slam.tsx`
- `scripts/video/final/src/lib/transitions/match-cut.tsx`
- `scripts/video/final/src/lib/transitions/index.ts` — barrel
- `scripts/video/final/src/lib/DiffPanel.tsx` — Remotion-rendered
  semantic file-diff panel (used by TriptychFrame)
- `scripts/video/tapes/00-install-cli.tape` — VHS `npm i -g`
- `scripts/video/tapes/05-marketplace-add.tape` — VHS `/plugin
  marketplace add`
- `scripts/video/tapes/06-plugins-install.tape` — VHS `/plugin
  install design@maude && /plugin install flow@maude`
- `scripts/video/tapes/07-flow-init.tape` — VHS `/flow:init`
- `scripts/video/tapes/08-design-init.tape` — VHS `/design:init`
- `scripts/video/tapes/13-design-browse.tape` — VHS
  `/design:browse` + port URL line
- `scripts/video/playwright/05-marketplace-confirm.spec.ts` —
  capture the post-install confirmation panel (optional B-roll)
- `scripts/video/final/src/compositions/FinalV3.tsx` — new
  composition (don't overwrite v2.1 `Final.tsx`; keep both for
  reference until v3 ships)
- `scripts/video/final/src/Root.tsx` — register `FinalV3`
  composition

### Documentation

- [Remotion `<TransitionSeries>`](https://www.remotion.dev/docs/transitions/transitionseries)
  — Why: custom `presentation` slot for our 5 transitions.
- [Remotion `spring()`](https://www.remotion.dev/docs/spring) —
  Why: hook + benefit cards + ticker entrances.
- [Remotion `OffthreadVideo` `startFrom`](https://www.remotion.dev/docs/offthreadvideo)
  — Why: skip blank pre-paint frames (frames at fps, not seconds —
  memory rule #3).

### Patterns to Follow

- **Scene shape**: `BenefitCard` is the reference — single default
  export, props-driven copy, no side effects, `spring()` entrances,
  uses tokens from `lib/tokens.ts`. New scenes mirror this.
- **Capture lookup**: `BrowserChrome` / `TerminalFrame` from
  `lib/capture-frames.tsx`. Pass `src` + `startFrom={n}` (frames
  not seconds).
- **Caption overlay**: `<LowerThird>` from `lib/LowerThird.tsx` —
  reuse, don't duplicate.
- **Composition assembly**: `Final.tsx` shows the
  `<TransitionSeries.Sequence durationInFrames={SCENES.x}>` +
  `<TransitionSeries.Transition>` pattern. v3 same pattern, more
  `presentation` variety.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `<IntroScene>` | `scenes/01-intro/index.tsx` | Replaced by `HookScene` in v3; kept for fallback |
| `<OutroScene>` | `scenes/03-outro/index.tsx` | Replaced by `InfographicOutro`; kept for fallback |
| `<BenefitCard>` | `scenes/05-benefit-card/index.tsx` | Used as-is (4 cards interleaved) |
| `<SplitScreenFrame>` | `scenes/06-split-screen/index.tsx` | Superseded by `TriptychFrame` for `/design:new` + `/design:edit`; kept available |
| `<TerminalFrame>` / `<BrowserChrome>` | `lib/capture-frames.tsx` | Reused inside `TriptychFrame` LEFT + CENTER panes |
| `<LowerThird>` | `lib/LowerThird.tsx` | Reused for caption overlays on capture scenes |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Paper background | `tokens.paper` | All scenes |
| Hairline 1 px | `tokens.hairline` | All cards + diagrams |
| Accent (amber/rust) | `tokens.accent` | Highlight words inside headlines (e.g. "Local") |
| Mono font | `tokens.font.mono` (Berkeley Mono) | All on-screen type |
| SKU stamp | `tokens.stamp` (`MDCC-…/…`) | Top-left of every full-frame scene |

### Custom Components Needed

| Component | Reason |
| --------- | ------ |
| `HookScene` | v2.1's `IntroScene` is too quiet for 3-second open. Need letter-by-letter mask reveal with audio cue. |
| `DiagramMarketplace` | No existing diagram scene type. Needs JSON-tree → tile transformation. |
| `DiagramArchitecture` | Same — visualizes maude as a system, has no precedent. |
| `TriptychFrame` | `SplitScreenFrame` is 2-pane; we need 3-pane (TUI · canvas · diff) to make `/design:edit` legible. |
| `DiffPanel` | TriptychFrame's RIGHT pane needs a semantic diff render — no precedent. |
| `FlowLoopTeaser` | Showing all 4 flow verbs in 6 s requires kinetic typography rig, not a capture. |
| `InfographicOutro` | Number-ticker outro replaces the v2.1 fade-to-install-line. |

### Transitions

| Transition | Reason |
| ---------- | ------ |
| `whip-pan-h` | Horizontal motion-blurred slide between adjacent scenario steps — gives the install sequence forward momentum without becoming "flashy." |
| `mask-stamp` | SKU-stamp shaped reveal into / out of diagram scenes — turns the brand mark into a transition motif. |
| `scale-slam` | Into the two triptych scenes — short, percussive, sets up the "live exec" payoff. |
| `match-cut` | Zero-frame cut between TUI-typed-command frame and the matching diagram — cursor stays in the same spot, content morphs. |
| `fade-soft` | Reserved for benefit-card hand-offs only — keeps the cards as gentle inserts between feature volleys. |

---

## Tasks

Execute in order. Tasks 1–4 are infra. Tasks 5–11 are scene
authoring (independent — could parallel, but verify locally first).
Tasks 12–17 are captures (depend on tasks 5–11). Task 18 is the
composition. Tasks 19–21 are verification + post.

### Task 1: ADD transition library skeleton

- **Do**: Create `scripts/video/final/src/lib/transitions/` with
  `whip-pan-h.tsx`, `mask-stamp.tsx`, `scale-slam.tsx`,
  `match-cut.tsx`, and a barrel `index.ts`. Each file exports a
  `TransitionPresentation` per Remotion's `transitions` API.
- **Pattern**: Reference Remotion's built-in `fade()` (it's a
  `TransitionPresentation` factory) — copy that shape.
- **Gotcha**: `match-cut` is a 0-frame transition. Remotion supports
  this but the timing function needs `durationInFrames: 0`. Verify
  in Remotion docs before assuming it works as-is.
- **Validate**: `pnpm --filter scripts/video/final tsc --noEmit`

### Task 2: ADD `DiffPanel` Remotion component

- **Do**: Create `scripts/video/final/src/lib/DiffPanel.tsx` —
  takes `{ before: string, after: string, language?: string }`
  props, renders a side-by-side or unified diff in Berkeley Mono
  with semantic colors (added = `tokens.accent`, removed = muted
  red, context = `tokens.fg`). Animate the diff appearing line by
  line via `useCurrentFrame` + per-line `interpolate`.
- **Pattern**: Mirror `BenefitCard`'s component shape. No external
  diff lib — write a tiny line-diff helper inline (≤30 lines).
- **Gotcha**: Don't tokenize/highlight as code — too expensive at
  render time. Plain mono with color spans is enough at 1080 p.
- **Validate**: Render in isolation via Remotion Studio
  (`pnpm --filter scripts/video/final dev`), verify legible at
  1080 p.

### Task 3: ADD `TriptychFrame` scene

- **Do**: Create `scripts/video/final/src/scenes/07-triptych/index.tsx`
  with props `{ leftSrc, centerSrc, diff: { before, after }, leftStartFrom?, centerStartFrom?, durationInFrames }`.
  Renders three panes 1/3 width each. LEFT = `<TerminalFrame>`,
  CENTER = `<BrowserChrome>`, RIGHT = `<DiffPanel>`. Honor
  `startFrom={frames}` on both video sources.
- **Pattern**: Adapt `SplitScreenFrame` (`scenes/06-split-screen/`)
  — same loader/wrapper logic, three columns instead of two.
- **Gotcha**: `startFrom` is **frames**, not seconds (memory rule
  #3). Document at the prop declaration.
- **Validate**: Mock with two existing v2.1 captures + a stubbed
  diff. Render in Studio. Verify all three panes are legible at
  1080 p (each pane ≈ 640 px wide — Berkeley Mono 14 pt is the
  floor).

### Task 4: REFACTOR `Root.tsx` to register `FinalV3`

- **Do**: Add a second `<Composition id="FinalV3">` entry alongside
  `<Composition id="Final">`. Same dimensions (1920 × 1080),
  same fps (30). `durationInFrames` will be filled in after task 18.
- **Gotcha**: Don't delete `Final`. We need v2.1 available for A/B
  during review.
- **Validate**: `pnpm --filter scripts/video/final dev` — both
  compositions listed in Studio sidebar.

### Task 5: CREATE `HookScene`

- **Do**: 3-second kinetic open. Letter-by-letter mask reveal of
  "MAUDE" (96 pt Berkeley Mono) at frames 0–30, then mask wipe to
  reveal "Plugins. CLI. Vibes." subline frames 30–60, hold SKU
  stamp top-right frames 45–90.
- **Pattern**: `spring()` per-letter delay (stagger 3 frames each).
  Mask via `clip-path: inset()` interpolated by `interpolate(frame,
  [start, end], [100, 0])`.
- **Gotcha**: At 30 fps, letter stagger 3 frames = 100 ms per
  letter. Five letters = 500 ms to spell "MAUDE." That's the beat
  cue — verify the audio thump (when music ships) aligns.
- **Validate**: Mid-frame (45 frames) Read tool check — "MAUDE" +
  subline + SKU all visible.

### Task 6: CREATE `DiagramMarketplace`

- **Do**: 3.5 s. Frame 0–30: JSON tree of `marketplace.json`
  fades in (`name`, `plugins: [design, flow]`). Frames 30–60: tree
  collapses into two plugin tiles. Frames 60–105: tiles slide
  right into a "Claude Code" shell silhouette (just an outlined
  terminal-window glyph), each tile flashes once on dock.
- **Pattern**: Use `spring()` for tile slide, `interpolate` for
  opacity. Plugin tiles re-use the `BenefitCard` typography
  (smaller — 32 pt). Catalog hairlines and SKU stamp present.
- **Gotcha**: Keep the JSON tree readable — don't shrink below
  20 pt. If the tree doesn't fit on one column, render it in two
  columns and animate both.
- **Validate**: Mid-frame check — both plugin tiles + at least
  one JSON key readable.

### Task 7: CREATE `DiagramArchitecture`

- **Do**: 4 s. Show maude as a system. Frame 0–45: file-tree
  unfolds from `.` to:
  ```
  my-app/
  ├── .ai/          ← from flow plugin
  ├── .design/      ← from design plugin
  ├── CLAUDE.md
  └── package.json
  ```
  Frame 45–90: two plugin badges (`flow` `design`) dock onto a
  "Claude Code" pill at the top. Frame 90–120: a thin line draws
  from the `maude` CLI badge through both plugins down into the
  file-tree, illustrating the wiring. Hold the final diagram for
  the last 30 frames.
- **Pattern**: SVG paths with `strokeDashoffset` interpolation for
  the line draw. Tree nodes use `spring()` opacity stagger.
- **Gotcha**: Use the project icon system (Lucide line, single
  stroke) for any glyphs. No emoji.
- **Validate**: Mid-frame check — file-tree + both plugin badges
  + at least the start of the connecting line visible.

### Task 8: CREATE `FlowLoopTeaser`

- **Do**: 6 s. Four slash-command cards materialize horizontally
  left-to-right (`/flow:setup-prd` at frame 0, `/flow:plan` at
  frame 30, `/flow:execute` at frame 60, `/flow:done` at frame 90).
  Each card carries a tiny inline preview (PRD bullet list, plan
  tree-of-phases, Edit-Verify checkbox row, PR badge with `#42`).
  Stamp roll motif: cards align on a horizontal baseline like
  postage stamps. Frames 120–180: zoom out, the four cards
  pull-quote together as a single composite, SKU stamp stamps
  itself on top.
- **Pattern**: Per-card `spring()` entrance with `delay = i * 30`.
  Final composite zoom via `interpolate` on `transform: scale`.
- **Gotcha**: Cards must stay legible at the zoomed-out frame.
  Berkeley Mono 18 pt minimum.
- **Validate**: Mid-frame check (frame 90) — at least 3 of 4 cards
  visible.

### Task 9: CREATE `InfographicOutro`

- **Do**: 5 s. Number ticker: starts at 0, counts to 44 ("commands"),
  then sub-ticker for "11 critics", "2 plugins", "1 CLI", "0
  telemetry." Each number lands on a beat (frame 0, 30, 60, 90, 120).
  Last 30 frames: catalog footer settles with the install snippet
  (`npm i -g @1agh/maude`) and `maude.iagh.cz`.
- **Pattern**: `interpolate(frame, [start, end], [0, finalNumber],
  { extrapolateRight: 'clamp' })` per ticker, `Math.floor` the
  output.
- **Gotcha**: "0 telemetry" must hold the zero — don't interpolate
  it (looks like a bug). Render it as literal "0" with a static
  entrance.
- **Validate**: End-frame check — all 5 stats + install line + URL
  visible.

### Task 10: VHS new tapes

- **Do**: Create six new VHS tapes per the "Files to Create" list:
  `00-install-cli.tape`, `05-marketplace-add.tape`,
  `06-plugins-install.tape`, `07-flow-init.tape`,
  `08-design-init.tape`, `13-design-browse.tape`.
- **Pattern**: `_TEMPLATE.tape` + the v2.1 install tape
  (`01-install-init-serve.tape`) are the references.
- **Gotcha**: `00-install-cli.tape` MUST use `bun add -g`. The
  marketing demo's foreground command stays `npm i -g` (per the
  rewritten Getting Started), but the **invisible setup** that
  precedes capture MUST use `bun add -g` to avoid the
  `oxc-parser` native binding failure (memory rule #1). Two-step
  approach: pre-arrange the sandbox via `bun add -g`, then the
  visible tape runs `npm i -g @1agh/maude` only as a typed-and-
  highlighted command without actually executing (use VHS `Type`
  + `Sleep`, NOT `Enter`). The tape ends with the prompt back —
  no error possible.
- **Validate**: Each tape renders to its `.mp4`. Mid-frame Read
  tool check on each — no red text, no error strings.

### Task 11: PLAYWRIGHT new spec (marketplace-confirm, optional)

- **Do**: Author `playwright/05-marketplace-confirm.spec.ts` —
  capture the Claude Code post-install confirmation panel (the
  one that lists "Installed 2 plugins"). This is optional B-roll
  for `step-2-plugins` if the VHS tape alone feels thin.
- **Gotcha**: Claude Code's confirmation UI may not be capturable
  via Playwright since it lives in the TUI. If so, skip this task
  and stretch the VHS tape instead.
- **Validate**: If captured, mid-frame shows the confirmation
  message clearly.

### Task 12: CAPTURE tapes (run VHS)

- **Do**: Run each new tape through VHS, output to
  `scripts/video/final/public/` matching v2.1 filename convention
  (`scene-install-cli.mp4`, `scene-marketplace-add.mp4`, etc.).
- **Validate**: Each captured `.mp4` passes mid-frame Read tool
  check — no error text, command text legible, prompt visible.
  Re-shoot on fail (max 3 iterations per tape per memory rule).

### Task 13: CAPTURE playwright specs (re-run any v2.1 specs that still apply)

- **Do**: v2.1 specs that survive into v3: `04-ds-reveal`,
  `06b-canvas-appears`, `07-canvas-reveal`, `08-canvas-hero`,
  `10b-canvas-edit`, `11-comments`, `12-annotations`, `14-docs`.
  Re-run only if the existing `.mp4` files in `public/` need
  refresh (zoom state, dwell timing, scroll smoothness — apply
  memory rules #2, #4, #5).
- **Validate**: Same as v2.1 — per-spec mid-frame intent check.

### Task 14: COMPOSE `FinalV3.tsx`

- **Do**: Assemble all 24 scenes into a `<TransitionSeries>` in
  `scripts/video/final/src/compositions/FinalV3.tsx`. Caption
  overlays via `<LowerThird>`, transitions per the Layer 3 table.
- **Pattern**: Mirror `Final.tsx` structure. Frame budget filled
  from the Layer 1 scenario table.
- **Gotcha**: Total `durationInFrames` must be the sum of all
  scenes minus the sum of all transition overlaps. Compute
  programmatically (constant + reduce).
- **Validate**: Studio renders the full timeline without errors.
  Each scene visible in the scrubber.

### Task 15: ADD captions for new scenes

- **Do**: Caption strings for the new scenario steps. Voice-aligned
  per the v2.1 voice anchor (catalog spine, Bear-Blog dry-grin,
  ASCII only).
  - `step-0-install-cli`: `Install the CLI. Required, not optional.`
  - `step-1-marketplace`: `Add the marketplace.`
  - `step-2-plugins`: `Install the plugins.`
  - `step-3-flow-init`: `Scaffold .ai/.`
  - `step-3-design-init`: `Scaffold .design/.`
  - `step-4a-setup-ds`: `Design system from a paragraph.` (v2.1
    string survives)
  - `step-4b-design-new`: `One slash. Real canvas, real diff.`
    (extends v2.1 — adds "real diff" for the triptych)
  - `step-4c-design-edit`: `Edit. Reload. Same canvas.` (v2.1
    string survives)
  - `step-5-flow-loop`: `Plan. Execute. Done.`
  - `step-6-browser`: `/design:browse. One port. Every canvas.`
  - `docs`: `Docs at maude.iagh.cz.` (v2.1 string survives)
- **Validate**: All captions ASCII-only. No em-dash / en-dash /
  curly quotes / ellipsis char (project punctuation rule).

### Task 16: RUN `pnpm run qa FinalV3 18`

- **Do**: Generate contact-sheet (18 frames sampled across the
  composition). Read each tile, verify the captions land, the
  diagrams hold, the transitions don't tear, no blank-white
  pre-paint frames.
- **Gotcha**: A failed tile triggers either a re-shoot (capture
  issue) or a composition fix (transition timing, scene duration).
  Most v2.1 failures at this layer were composition fixes.
- **Validate**: All 18 tiles pass intent check.

### Task 17: RENDER + ffmpeg post

- **Do**: `pnpm --filter scripts/video/final render FinalV3 -o
  out/v3-pre.mp4`. Then ffmpeg loudnorm + size check (≤16 MB).
  Output to `scripts/video/final/out/v3-final.mp4`.
- **Gotcha**: If size > 16 MB after CRF 23, bump CRF to 25 and
  re-render. Don't downscale below 1080 p.

### Task 18: REPLACE `site/public/demo.mp4`

- **Do**: Copy `out/v3-final.mp4` to `site/public/demo.mp4`. Keep
  `out/v2.1-final.mp4` archived alongside for rollback.
- **Validate**: Open `site/app/(home)/page.tsx` → `<DemoVideo />`
  component points at `/demo.mp4`. No path changes needed.

### Task 19: UPDATE storyboard.md

- **Do**: Mark v2.1 as "superseded by v3" at the top. Append a v3
  section that mirrors the Layer 1 / Layer 2 / Layer 3 structure
  from this plan. Don't delete v2.1 content — it's reference.
- **Validate**: `storyboard.md` opens cleanly, both v2.1 and v3
  sections legible.

### Task 20: RUN visual verification loop end-to-end

- **Do**: Per memory rule + DDR-037 production rules — every new
  scene type passes mid-frame intent check, contact-sheet passes,
  no inspector / pin / annotation affordance regressions.
- **Validate**: All checks logged in `scripts/video/final/__qa__/`
  per existing pattern.

### Task 21: COMMIT + push, open PR

- **Do**: Conventional commit prefix `feat(video):` for the new
  scenes and `FinalV3`, `chore(video):` for the demo.mp4 swap.
  PR title: `feat(video): phase 16 — intro video v3 with wow layer`.
- **Validate**: `/flow:done` gates — `/validate` passes, DDR sweep
  records this work, retro captured.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm --filter scripts/video/final lint`
2. **Types**: `pnpm --filter scripts/video/final typecheck`
3. **Tests**: `pnpm --filter scripts/video/final test`
   (`__tests__/` directory exists from phase 15.1)
4. **Build**: `pnpm --filter scripts/video/final build`
5. **Composition render**: `pnpm --filter scripts/video/final
   render FinalV3 -o out/v3-final.mp4`
6. **Golden frames**: `pnpm --filter scripts/video/final goldens`
   — verify any v2.1 golden frames still pass for retained scenes
   (intro / outro / benefit cards / split-screens we keep).
7. **Size check**: `du -h site/public/demo.mp4` ≤ 16 MB.
8. **Site preview**: `pnpm --filter @maude/site dev` →
   `http://localhost:3000` → `<DemoVideo>` autoplays the new
   demo.mp4 without errors.
9. **Manual**: Watch the full cut twice. First time muted, second
   time with placeholder audio. Confirm the editorial rhythm
   reads — pacing varies, transitions vary, infographics land,
   nothing feels "school project."

---

## Scenario Coverage (UI tasks — required)

Not applicable here — this is a video-composition phase. The
"scenario" of this phase IS the storyboard, validated via the
visual verification loop (Task 20).

---

## Acceptance Criteria

- [ ] All 21 tasks completed
- [ ] `/flow:utils-verify` passes after each scene-authoring task
- [ ] `/validate` passes overall:
  - [ ] Lint / types / tests / build all pass for
        `scripts/video/final/`
  - [ ] `FinalV3` renders end-to-end without errors
  - [ ] Contact-sheet (Task 16) shows 18/18 tiles passing intent
  - [ ] Per-scene mid-frame checks (Tasks 5–9, 12, 13) all pass
  - [ ] Output ≤ 16 MB post-loudnorm
- [ ] `site/public/demo.mp4` swapped, v2.1 archived in `out/`
- [ ] `storyboard.md` updated with v3 section
- [ ] DDR recorded if any production gotcha emerged that wasn't in
      DDR-037 or the marketing-video-production memory
- [ ] Retro captured with explicit answer to: "Does this feel like
      marketing or a school project?"

---

## Risks

1. **Diagrammatic scenes are the load-bearing wow contribution.**
   If `DiagramMarketplace` and `DiagramArchitecture` don't land,
   v3 is just v2.1 with new captions — boring problem unsolved.
   Mitigation: scaffold both scenes first (Tasks 6–7), render in
   Studio, do a creative review before committing to the full
   composition.
2. **Triptych legibility at 1080 p.** Three panes at ~640 px each
   is tight for Berkeley Mono. If diff panel is unreadable,
   degrade to two panes (TUI + canvas only, drop diff) for that
   scene. Recorded as a deliberate fallback in Task 3.
3. **Transition variety becomes noise.** Five transitions might
   feel busy. Mitigation: rule-of-thirds — `fade-soft` and
   `whip-pan-h` carry 70 % of transitions; the loud three
   (`mask-stamp`, `scale-slam`, `match-cut`) reserve for marked
   beats only.
4. **VHS install tape contradicts memory rule #1.** The new
   Getting Started teaches `npm i -g`, which is the v1 failure
   mode. Resolution baked into Task 10: capture `npm i -g` as
   typed-not-executed; the real install behind the camera uses
   `bun add -g`. This is a "marketing point IS the pipeline"
   exception per memory rule #8.
5. **Size budget tight.** v2.1 hit 13 MB at 84 s. v3 is longer
   (95–110 s) and has more compositional Remotion content (less
   compressible than captures). CRF 23 → 25 fallback in Task 17.
   If still over, drop one benefit card (lose ~2.5 s + ~0.5 MB).
6. **Audio bed still placeholder.** Music sourcing was deferred
   from phase 15.5. v3 ships with the same `ambient.aac` synth.
   Real music selection is out of scope here; flag in retro.

---

## Confidence

**7 / 10** for one-pass implementation success.

- Infrastructure is shipped (phase 15.1), production rules are
  encoded in memory + DDR-037, capture pipeline works end-to-end.
- Six new Remotion scenes are real authoring work, not glue —
  expect 1–2 iteration cycles on `DiagramArchitecture` and
  `TriptychFrame` before they read right at the mid-frame check.
- Five-transition variety is the most subjective risk. Plan
  bakes in a degrade path (rule-of-thirds restraint).
- The "wow" judgement is ultimately user-aesthetic — even if every
  technical check passes, v3 might still read as "fancier school
  project." Mitigation: render `HookScene` + `DiagramArchitecture`
  + `FlowLoopTeaser` first, share for taste check before
  committing the full composition.

