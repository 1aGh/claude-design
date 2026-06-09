# Feature: Intro video v4 — total rebuild, scene-by-scene visual iteration

> ## ⚠ v5.2 SUPERSEDES THE BODY BELOW — read this first (2026-06-09)
> The concept pivoted from a tutorial to a **feature SHOWREEL**. The authoritative
> spec is now **`scripts/video/v4/_showreel-script.md`** (15 beats + ElevenLabs VO,
> EN+CZ). The visual storyboard is `.design/ui/Studio Intro Video.tsx` (one
> artboard per beat, built from REAL assets).
>
> **EXECUTOR DIRECTIVE (load-bearing):** the storyboard is **inspiration, not a
> spec**. Do NOT copy its frames 1:1 — **ELEVATE** every beat (more cinematic,
> more real, more polished). Ground each scene in the **real assets**, not the
> mocks: `.design/_assets/showreel/` + `scripts/video/v4/_research/` (real Studio
> / canvas / DS specimen / moodboard captures), `scripts/video/final/public/v4/cli.mp4`
> (real terminal), `.design/_draw/*.svg` (real geometry marks), `.ai/` artifacts
> (DDR-070, plans, scenarios), `.design/ui/*.registry.json` (real handoff).
> The storyboard fixes order + beat + VO + what-to-prove; the composition is
> yours to make better. Bar: "would a designer screenshot it?" — if a beat only
> matches the mock, it failed.
>
> Install beat dropped. Critics may be illustrated (don't run `/design:critic`
> just for footage). Everything else must be a faithful representation of how
> maude really looks + behaves.
>
> _The v4 body below is retained for the per-scene visual-iteration loop
> mechanics (render → frame-grab → score → sign off), which still apply._

> **v4 (2026-05-23, after scrapping v3 layering attempt).** v3 tried to
> "fix" v2.1 by layering 6 new wow scenes on top of the existing
> composition. User watched the result and called it "fakt slusnej
> bulshit, jeste horsi nez predtim" — feature-correct, technically clean,
> still reads like a school project. Full revert. Memory rule:
> `[video-rebuild-discipline]`.
>
> **v4 throws away everything v2.1 + v3 produced and rebuilds the video
> from zero, scene by scene, with a mandatory visual self-iteration loop
> per scene before moving on — mirroring `/design:new`'s perfect-mode
> workflow.** Length flexible (target 60-120 s, whatever the rhythm
> demands). Output stays `site/public/demo.mp4`.

---

## What got us here (so the loop closes)

| Round | Strategy | Why it failed |
|---|---|---|
| v1 | Two fixture cuts (48 s + 26 s) | "nudné" — no voice, no proof |
| v2 | Benefit cards + Claude TUI + annotations + split-screen HMR | Still two cuts, generic copy |
| v2.1 | Single ~90 s cut with real `/design:new` + `/design:edit` execution + split-screen + voice-aligned copy | Captures real, intent clean — still "nudné" |
| v3 | Layered HookScene + 2 diagrams + Triptych + FlowLoopTeaser + InfographicOutro + 5 transitions onto v2.1 composition | Inherited v2.1's pacing problem; "fakt slusnej bulshit, jeste horsi nez predtim"; full revert |

**The structural lesson** (encoded as
`memory/feedback-video-rebuild-discipline.md`):

> Tile-by-tile correctness is necessary but not sufficient. A passing
> contact sheet is not a passing video. Reusing the failing baseline's
> scenes/captures/tokens inherits the failing baseline's feel. The fix
> is rebuild, not layer; and visual iteration per scene, not per cut.

---

## Description (v4)

Three rules in tension on purpose:

1. **Zero reuse from v2.1 / v3.** No surviving scenes, no surviving
   captures, no surviving tokens, no surviving transitions, no surviving
   composition shape. The catalog motif (paper + hairlines + Berkeley
   Mono + SKU stamp) is **off-limits as a default** — if it earns its
   way in via reference research, fine, but it does not get inherited
   by reflex.
2. **Reference research before any authoring.** Spend 30–60 minutes
   pulling 8–12 distinct marketing-film references (Linear,
   Arc, Bun, Vercel, Replit, Raycast, t3.gg, Resend, modern indie
   product launches) and write down — in `_references.md` next to the
   composition — what each reference does that we want to steal and
   what we explicitly will not do. The brief feeds the scene
   vocabulary; the vocabulary does not feed the brief.
3. **Per-scene visual self-iteration loop, gating progression.** Each
   scene authored gets rendered standalone, frame-grabbed at 3
   timestamps (early / mid / late), the agent reads every PNG into
   context, applies an explicit rubric, and either signs the scene off
   or iterates. The loop matches `/design:new --perfect` shape: max 8
   iterations per scene, target rubric score ≥ 4 / 5. Only signed-off
   scenes go into the assembly.

These rules apply per scene, not per cut. The composition only assembles
once every scene has individually passed its rubric.

---

## User Story (unchanged from v3)

As a first-time visitor to maude.iagh.cz, I want a ~60–120 s video that
pulls me in inside 3 s, shows the product doing something I'd actually
want to do (not a tutorial), and lands a closing frame I want to
screenshot. It must NOT feel like a documentation walkthrough or a
school project. It must feel like a marketing film a designer friend
would not apologize for sharing.

---

## Problem

Three rounds (v2, v2.1, v3) all failed the same gut-check question:
"would I show this to a designer friend without apology?" The shared
failure mode across all three: even pacing, uniform compositions,
captures-with-captions feel, no editorial commentary, no surprises, no
moments where the video shifts gear. v3 added "wow elements" but kept
the same compositional spine, which preserved the failure.

v4 is allowed to be smaller in scope (fewer scenes, shorter runtime) so
long as each surviving scene is screenshot-worthy on its own.

---

## Solution (v4 approach)

**Three phases, each gating the next.** Do not skip ahead.

### Phase A — Reference + brief (no authoring yet)

A.1. Pull 8–12 marketing-film / product-launch references via WebSearch.
     Mix established companies (Linear, Arc, Bun, Vercel, Replit) with
     indie launches (Resend, t3.gg, Raycast, recent Show HN tops) and
     at least 2 non-product / non-Anglo references (motion graphics
     reels, design awards, Korean / Japanese product spots) to break
     anchoring on the same 5 inspirations every product video uses.

A.2. For each reference, write 3 lines: what it does that we want, what
     it does that we explicitly won't copy, why. Save to
     `scripts/video/v4/_references.md`.

A.3. From references, derive a **visual vocabulary brief** — 1 page,
     written first-person, listing:
       - Pacing / rhythm philosophy (uneven / kinetic / restrained?)
       - Type personality (mono / sans / display? letter-spacing?)
       - Motion vocabulary (cuts vs. dissolves; whip pans, mask wipes,
         hard scale, freeze-frames?)
       - Color philosophy (paper-and-ink vs. saturated vs. duotone?)
       - Signature treatment (the one moment people screenshot)
       - Hard-NO list (no SKU stamps, no benefit-card grids, no
         catalog hairlines, no Berkeley Mono — UNLESS the research
         pulls them back in for a real reason)
     Save to `scripts/video/v4/_brief.md`.

A.4. Storyboard the scenes — fewer than v3 (target 8–12, not 24). Each
     scene gets:
       - id (00, 10, 20 … — leave gaps for inserts)
       - role (hook / proof / payoff / closer)
       - duration estimate (don't pre-commit to a fixed second count)
       - signature treatment for THIS scene (each scene's signature
         must be different from every other scene's — no repeating
         the same motif across the cut)
       - intent rubric: 5 lines of "at frame X, the viewer must see Y"

     Save to `scripts/video/v4/_storyboard.md`.

A.5. Show the brief + storyboard to the user. **Hard gate** — do not
     proceed to Phase B until the user explicitly signs off on the
     brief and the storyboard. If the user pushes back, iterate in
     this phase only.

### Phase B — Scene authoring with visual self-iteration

B.1. Create `scripts/video/final/src/scenes/v4/` (separate from v2.1's
     `scenes/01-intro` etc. — zero overlap). Each scene gets its own
     folder under `v4/<scene-id>/`.

B.2. **For each scene, run this loop** (mirrors `/design:new --perfect`
     shape — see `plugins/design/commands/new.md`):

     ```
     iteration 0:
       - author the scene component (or capture spec)
       - register it as a standalone Composition in Root.tsx
       - render the scene to scripts/video/final/out/scene-<id>-iter0.mp4
       - extract 3 PNG frames: early (10% of duration),
         mid (50%), late (90%)
       - Read all 3 PNGs into context
       - score against this scene's intent rubric (1-5 per rubric line)
       - score against this scene's signature treatment (1-5)
       - if average ≥ 4.0 AND no rubric line < 3, SIGN OFF — write
         scripts/video/v4/_signoff-<id>.md with timestamp + scores
       - else, write down ONE specific structural fix and iterate

     iterations 1-7:
       - apply the structural fix
       - re-render
       - re-extract + re-Read 3 frames
       - re-score
       - sign off OR iterate

     iteration 8: STOP. If still not ≥ 4.0, mark the scene BLOCKED
       and surface to the user with: which rubric lines fail, what
       structural changes were tried, recommended pivot.
     ```

     Critical: each iteration is a STRUCTURAL change, not a token
     swap. If the rubric says "viewer must see motion at frame 30" and
     iter 0 shows a static frame, the fix is "add a spring entrance,"
     not "change the color."

B.3. **No `/design:new` clichés.** This is a video composition workflow,
     not a UI canvas. The visual self-iteration loop is BORROWED from
     `/design:new --perfect`; it is not a replacement for actually
     thinking about what each scene should communicate.

B.4. Captures (VHS / Playwright) live under
     `scripts/video/tapes/v4/` and `scripts/video/playwright/v4/`. Re-
     shoot all captures; do not reuse v2.1's. The user's mental model
     of "we already have those captures" is exactly the thinking that
     produced v3's school-project feel.

### Phase C — Composition + final visual gate

C.1. Assemble all signed-off scenes into a new composition file:
     `scripts/video/final/src/compositions/V4.tsx`. Do not touch
     `Final.tsx`. Register V4 in Root.tsx alongside Final + Demo.

C.2. Render the full V4 cut.

C.3. **Mandatory full-watch.** Open the rendered MP4 (not the contact
     sheet — the actual MP4). Watch it twice: once muted, once with
     audio bed. Apply the gut check explicitly:

     - First 3 seconds — does it pull you in?
     - Mid section — does the pacing vary (no uniform 5 s scenes)?
     - Final 5 seconds — does it land?
     - Overall — would you screenshot any frame to share?
     - Overall — would you show it to a designer friend without
       apology?

     Write the answers in `scripts/video/v4/_watch-log.md`.

C.4. If the gut check fails on any axis, do NOT swap demo.mp4. Surface
     the specific failure to the user with the failing axis quoted
     verbatim from the gut check and a proposed structural fix at the
     scene level. The user decides whether to iterate (re-enter Phase
     B for the failing scenes) or to ship.

C.5. If gut check passes, ffmpeg loudnorm + ≤16 MB check, then swap
     `site/public/demo.mp4` — and ONLY then ask permission to commit.

---

## Hard rules (encoded so I cannot waive them on the next pass)

1. **No layering.** v4 does not extend v2.1 or v3. The file
   `scripts/video/final/src/compositions/Final.tsx` is read-only for
   this phase. New composition lives at `compositions/V4.tsx`.

2. **No scene reuse.** Each scene authored under `scenes/v4/<id>/`. The
   v2.1 scenes (`scenes/01-intro`, `scenes/03-outro`, `scenes/05-
   benefit-card`, `scenes/06-split-screen`) are not imported into V4.

3. **No capture reuse.** New tapes in `tapes/v4/`, new specs in
   `playwright/v4/`, new mp4s in `final/public/v4/`.

4. **No token reuse — unless the brief earns it.** Default starting
   palette is BLANK. The brief gets to declare its own tokens after
   the reference research. Berkeley Mono / SKU stamp / paper bg /
   hairlines are NOT defaults — they are choices that must be
   re-defended against the references.

5. **Visual self-iteration is gating, not advisory.** A scene without
   `_signoff-<id>.md` does not enter the composition. The composition
   does not assemble until every scene has a signoff. The MP4 does not
   swap into site/public/ until the full-watch gut check is logged
   AND passes.

6. **Brief sign-off before authoring.** Phase A.5 is a HARD GATE.
   Authoring code before the user signs off on the brief is the v3
   mistake repeating.

7. **No "wow tax" thinking.** Each scene earns its own moment. "I
   already added the diagram so the cut is interesting now" is the v3
   mistake repeating.

---

## Metadata

- **GitHub Issue**: none — internal phase
- **Type**: Total rebuild (zero reuse from v3 or v2.1)
- **Complexity**: High — but smaller surface than v3 (fewer scenes,
  fewer transitions, no triptych mechanics)
- **App/Package**: `scripts/video/final/` + new `scripts/video/v4/`
  for briefs / references / signoffs
- **Affected Systems**: new Remotion compositions, new VHS tapes, new
  Playwright specs, ffmpeg post step, `site/public/demo.mp4`
- **Dependencies**: phase 15.1 infrastructure (Remotion + ffmpeg
  toolchain), `vhs`, `claude` CLI
- **Length target**: 60–120 s, ≤16 MB post-loudnorm
- **Confidence (one-pass)**: 4 / 10. The unknown is whether the
  reference research surfaces a vocabulary distinct enough from the
  v2.1 / v3 catalog motif to break the school-project pattern. The
  mitigation is the brief sign-off gate at Phase A.5 — the user gets
  to call the brief before any authoring happens.

---

## Open questions for the user (answer before Phase A starts)

1. **Voice cut?** v2.1 + v3 used voice-aligned but still-text-heavy
   captions. Is a voiceover acceptable (CC0 AI voice or your own), or
   stay text-only?
2. **Music bed?** Current `ambient.aac` is placeholder. Are you OK
   sourcing CC0 music for v4, or accept the same placeholder?
3. **Length tolerance?** v2.1 shipped 84 s; v3 hit 112 s. Is shorter
   (45–60 s) acceptable if it lands the gut-check, or do you want
   ≥ 90 s for the README / landing?
4. **Reference vetoes?** Any brand or style you do NOT want as
   reference (e.g. "no Vercel-flavored saturation," "no Arc-style
   teaser")?

---

## Acceptance criteria

- [ ] `scripts/video/v4/_references.md` exists with 8–12 entries
- [ ] `scripts/video/v4/_brief.md` exists, includes hard-NO list
- [ ] `scripts/video/v4/_storyboard.md` exists with 8–12 scenes, each
      with its own signature treatment
- [ ] User signed off on brief + storyboard (Phase A.5 gate cleared)
- [ ] Every scene under `scenes/v4/<id>/` has a paired
      `_signoff-<id>.md` with iteration count + final scores
- [ ] `compositions/V4.tsx` assembles only signed-off scenes
- [ ] `scripts/video/v4/_watch-log.md` contains the full-watch gut-
      check answers, all axes PASS
- [ ] `site/public/demo.mp4` swapped to V4 only AFTER watch log passes
- [ ] User explicitly approved commit before any `git commit` runs

---

## Risks

1. **Reference research surfaces nothing distinct.** Mitigation: brief
   sign-off gate. If after Phase A the user looks at the brief and
   says "same vibe as v3," we re-do Phase A before any code runs.
2. **Per-scene rubric becomes box-checking.** Mitigation: rubric
   includes "would you screenshot this frame" as one of the 5 lines.
   That single line is hard to fake.
3. **Watch-log gut check is subjective.** That's the point. The
   previous failure mode was the agent trusting technical pass
   signals; v4 explicitly does not trust those.
4. **Scope creep.** v4 starts with 8–12 scenes max. If during
   authoring it grows to 24, that's a v3 mistake repeating; stop and
   reduce.

---

## Notes for the next executor (could be future-me)

If you read this plan and feel the urge to skip Phase A and start
writing Remotion scenes immediately, stop and re-read the v3 retro
above. The technical work was never the bottleneck. The bottleneck was
authoring decisions made without enough reference fuel. Phase A is
NOT optional. The user pre-emptively refused to authorize the v3
commit specifically because the visual quality bar was not met, and
explicitly told you to rewrite this plan to require independent
authoring with iterative visual verification. That is what v4 is.
Honor the contract.
