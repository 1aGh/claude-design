# Marketing demo video storyboard — v2.1 (real maude in sandbox, single perfect cut)

> **v2.1 (rewritten 2026-05-20 after second user round of feedback).** v1
> shipped two cuts (48 s + 26 s) judged "nudné." v2 prep added benefit
> cards + Claude TUI + annotations + split-screen HMR. v2.1 narrows the
> scope to **one perfect ~90 s cut** and demands that `/design:new` +
> `/design:edit` actually execute against a real maude sandbox with the
> result captured live. `/design:setup-ds` stays as a dry-run capture
> (questionary visible, no completion).
>
> Filename retains `-30s` for git continuity; ignore the suffix.

## Changelog (v1 → v2 → v2.1)

| Round | Decision | Why |
|---|---|---|
| v1 | Two cuts (48 s + 26 s), all-fixture content, no slash commands in shell, no benefit framing | Original plan. Shipped, judged "nudné." |
| v2 | Added 4 benefit cards, Claude TUI dry-run scene, annotations, split-screen HMR, bun-add fix | Feedback from v1 review. Still two cuts. Generic marketing copy. |
| **v2.1** | **Single ~90 s cut, real `/design:new` + `/design:edit` captures with split-screen, DS reused from this repo's `.design/system/project/`, visual verification loop with per-scene intent checks, copywriting aligned to site/.design voice (catalog spine + Bear-Blog dry-grin, with direct echoes of "Two plugins, one CLI, some vibes" and "No telemetry. No signup. No book a demo button.")** | "Nemusis se drzet strkiktne 30s nebo 1min. Proste udelej jedno video ale at je perfektni." + "opravdu realne pouzij maude v sandboxu" + "do planu zakomponuj i nejakou visualni verifikaci abys na videu mohl sam iterovat" + "zapracuj na tom copywritingu. Inspiruj se v .design nebo primo v site tam uz by tone of voice mel byt ready" |

## Why one cut

v1 + v2's two-cut approach (Cut A landing page + Cut B README) split the
authoring budget across two compositions that share most of their
captures. v2.1 collapses to a single ~90 s cut embedded everywhere
(landing + README). README's GitHub <video> tag will point at the same
release-asset URL; landing autoplays the same MP4. Size cap is 16 MB for
landing autoplay — well within reach for ~90 s at CRF 23.

## Ground rules (v2.1)

1. **Slash commands appear inside Claude Code TUI only** — VHS captures
   the `claude` interactive shell. Three slash commands get TUI
   captures: `/design:setup-ds` (dry-run, no completion),
   `/design:new "Recipe Recap" "..."` (real execution), `/design:edit
   "tighten the hero, drop one row from the metadata block"` (real
   execution).
2. **Real maude in the sandbox.** `maude init` runs for real.
   `/design:new` + `/design:edit` execute for real against the scratch
   dir. The dev-server iframe records what actually happens. No
   simulation, no hand-authored canvas — the canvas in the video IS the
   canvas `/design:new` produces.
3. **DS reused from this repo.** Skip `/design:setup-ds` execution for
   the actual DS content — copy `.design/system/project/` from this repo
   into scratch verbatim. `/design:setup-ds` is captured as a TUI
   dry-run for the marketing beat ("look — there's a real onboarding
   here"), but its output is not used.
4. **Two-port pattern** — scratch on 4400, repo on 4399.
5. **Caption discipline** — ASCII only inside backticks.
6. **Frame math** — 30 fps; xfades 12 f (0.4 s); minimum scene 24 f.
7. **Visual verification loop** — every capture has per-scene intent
   checks. Agent reads frames at known timestamps; failures trigger
   re-shoot.

## Music bed

Stays on synthesized `ambient.aac` from phase 15.1 with `<Audio loop>`.
Real CC0 curation deferred.

## Sandbox setup (v2.1)

- Path: `/tmp/scratch-maude-demo-<date>/`
- **Step 1:** `maude init --name recipe-recap` for real.
- **Step 2:** Copy `.design/system/project/` from this repo → scratch.
  This is the "user's DS" — saves the bootstrap discovery step.
- **Step 3:** Copy `.design/config.json` with `name: "recipe-recap"`
  override.
- **Step 4:** Do NOT seed `.design/ui/` or `.design/_comments/`. Both
  get populated by the real `/design:new` + `/design:edit` runs
  recorded in the video.
- **Step 5:** Boot scratch dev-server on 4400.
- **Step 6 (capture-time):** Real `/design:new "Recipe Recap" "Multi-
  artboard hero + portion scaler + ingredient list + cookbook print
  preview"` runs inside the recorded Claude TUI.
- **Step 7 (capture-time):** Real `/design:edit "tighten the hero, drop
  one row from the metadata block"` runs inside the recorded Claude TUI.

The `/design:setup-ds` dry-run is captured AFTER step 5 but BEFORE step
6 — viewer sees onboarding kicking off, then sees real authoring
without the interim.

## Single cut — scene table

Target: ~90 s, 13 scenes with 12 xfades.

| # | Scene id | Source | Slot (s) | Frames | Caption | Intent (must be visible) |
|---|----------|--------|---------:|-------:|---------|--------------------------|
| 1 | `intro` | `IntroScene` (15.1) | 2.5 | 75 | — | "maude." wordmark legible |
| 2 | `install` | VHS `01-install-init-serve.tape` (`bun add -g`) | 7.0 | 210 | `Install. Init. Serve.` | No red error text anywhere |
| 3 | `tui-setup-ds` | VHS `02-tui-setup-ds-dryrun.tape` | 5.5 | 165 | `Onboarding is a slash command.` | Claude TUI visible + `/design:setup-ds project "..."` typed + Stage 1 first prose prompt rendering |
| 4 | `ds-reveal` | Playwright `04-ds-reveal.spec.ts` (4 specimens via tree) | 7.0 | 210 | `Design system from a paragraph.` | At least one specimen content (type-scale or colors-accent) clearly readable |
| 5 | `card-A` | Remotion `<BenefitCard kind="local-figma" />` | 2.5 | 75 | own type | "Local Figma. For Claude Code." legible |
| 6 | `tui-new` (split-screen) | VHS+Playwright composite (real `/design:new`) | 12.0 | 360 | `One slash. Real canvas, real code.` | LEFT: Claude TUI with `/design:new` typed + streaming output. RIGHT: dev-server iframe with new canvas appearing |
| 7 | `canvas-reveal` | Playwright `06-canvas-reveal.spec.ts` (Space+drag pan) | 6.0 | 180 | `Multi-artboard. Pan. Zoom. Ship.` | At least 3 of 4 artboards visible at some frame; visible mid-pan motion |
| 8 | `canvas-hero` | Playwright `07-canvas-hero.spec.ts` (3 hovers + multi-select) | 9.0 | 270 | `Cmd+Click. The file Claude needs.` | At least 2 distinct frames show inspector halo on different elements |
| 9 | `card-B` | Remotion `<BenefitCard kind="all-in-one" />` | 2.5 | 75 | own type | "Plan. Design. Ship." legible |
| 10 | `tui-edit` (split-screen) | VHS+Playwright composite (real `/design:edit`) | 12.0 | 360 | `Edit. Reload. Same canvas.` | LEFT: Claude TUI with `/design:edit` typed + edit diff visible. RIGHT: dev-server iframe with the edit applied |
| 11 | `comments` | Playwright `09-comments.spec.ts` (zoom-1.0 reset + composer + reply) | 7.0 | 210 | `Comments anchored to pixels. No exports.` | At least one visible pin OR composer affordance on the canvas |
| 12 | `annotations` | Playwright `10-annotations.spec.ts` (pen + arrow + label) | 5.5 | 165 | `Draw on the canvas. Hand it off.` | At least one drawn mark + one label visible |
| 13 | `card-C` | Remotion `<BenefitCard kind="human-ai" />` | 2.5 | 75 | own type | "Human reads. AI iterates." legible |
| 14 | `docs` | Playwright `11-docs.spec.ts` (`scrollTo({behavior:'smooth'})`) | 4.0 | 120 | `Docs at maude.iagh.cz.` | "Plugins & Vibes." landing visible (no blank-white pre-paint) |
| 15 | `card-D` | Remotion `<BenefitCard kind="your-repo" />` | 2.5 | 75 | own type | "Your repo. Yours forever." legible |
| 16 | `outro` | `OutroScene` (15.1) | 3.0 | 90 | — | `npm i -g @1agh/maude` legible |

### Frame budget (single cut)

```
intro          75
install       210
tui-setup-ds  165
ds-reveal     210
card-A         75
tui-new       360
canvas-reveal 180
canvas-hero   270
card-B         75
tui-edit      360
comments      210
annotations   165
card-C         75
docs          120
card-D         75
outro          90
────────────────────
sum         2715 frames
- 15 xfade × 12 = 180 overlap
= 2535 frames = 84.5 s on-screen.
```

Held intro/outro tails → ~88–92 s final on-screen length.

### Caption strings (verbatim, ASCII only — voice-aligned to site/.design)

Voice anchor: "catalog spine, person speaks." Source register from
`.design/system/project/README.md` § Voice — Bear-Blog dry-grin on a
U.S. Graphics catalog spine. Short, period-ended sentences. No hype
words. No exclamation. Tech-honest. Triads ok.

Direct echoes from site copy (`site/app/(home)/page.tsx` +
`site/content/docs/index.mdx`):
- "Two plugins, one CLI, some vibes."
- "no telemetry, no signup, no book a demo button"
- "The agentic loop that ships things eventually."
- "Iterates canvases until they stop being embarrassing."
- "Three commands and you're in. (Maybe four. Depends on your shell.)"

| Scene | String |
|-------|--------|
| install | `Install. Init. Serve.` |
| tui-setup-ds | `Onboarding is a slash command.` |
| ds-reveal | `Design system from a paragraph.` |
| tui-new | `One slash. Real canvas, real code.` |
| canvas-reveal | `Multi-artboard. Pan. Zoom. Ship.` |
| canvas-hero | `Cmd+Click. The file Claude needs.` |
| tui-edit | `Edit. Reload. Same canvas.` |
| comments | `Comments anchored to pixels. No exports.` |
| annotations | `Draw on the canvas. Hand it off.` |
| docs | `Docs at maude.iagh.cz.` |

### Benefit cards (4 × 2.5 s, voice-aligned)

Cards echo the site catalog voice. Card B's subline lifts the site hero
verbatim ("Two plugins, one CLI, some vibes."). Card D's subline lifts
the site fine-print verbatim ("No telemetry. No signup. No book a demo
button."). Echoes are deliberate — viewers who land on the docs after
the video get a callback hit.

| Kind | Headline | Subline | Decorative |
|------|----------|---------|------------|
| `local-figma` | `Local Figma. For Claude Code.` | `Canvas-first iteration. In your repo. Under .design/.` | Stamp + amber-rust accent on "Local" + "Claude Code" |
| `all-in-one` | `Plan. Design. Ship.` | `Two plugins, one CLI, some vibes.` | Three interpunct chain animating left-to-right |
| `human-ai` | `Human reads. AI iterates.` | `Both sides speak the same canvas.` | Two-column with a connecting line |
| `your-repo` | `Your repo. Yours forever.` | `No telemetry. No signup. No book a demo button.` | Stamp + file-tree fragment glyph |

All cards: paper bg, 1 px hairlines, SKU stamp top-left
(`MDCC-MKT/0X · CARD · v0.16.0`), catalog footer
(`github.com/1aGh/maude · 2 plugins · 1 CLI · zero telemetry`).
Berkeley Mono 96 pt headline, 24 pt subline, spring entrance via
`remotion-bits`.

---

## Visual verification loop

Per the user request "do planu zakomponuj i nejakou visualni verifikaci."

### Per-scene intent check

Every capture scene has an **intent** entry in the table above. After
recording, agent does:

1. Compute `mid-frame timestamp = duration_seconds / 2`.
2. Extract that frame: `ffmpeg -ss <ts> -i <capture> -vframes 1 -q:v 3
   <out.jpg>`.
3. **Read the JPG via the Read tool.**
4. Cross-check against the scene's "Intent (must be visible)" cell.
5. If FAIL: log the failure reason, re-shoot the scene (max 3
   iterations), re-verify. Escalate to user after 3 fails.

### Per-cut contact-sheet check

After all captures pass per-scene checks, render the full cut, run
`pnpm run qa Final 18`. Agent reads every contact-sheet frame. Failures
trigger composition or capture fixes (NOT a hard scene re-shoot — most
issues at this layer are caption mis-timing, blank pre-paint frames,
audio dropouts).

### Specific affordance-visibility checks

These are the v1 failure modes the user flagged. Hard-coded into the
verification:

- **Inspector halo**: `canvas-hero` scene's frames 4.5 s + 6.0 s + 7.5 s
  (the dwell points) must each show a visible orange/amber halo
  outline around a different element. If ANY of the three is
  halo-less, re-shoot.
- **Comments pin**: `comments` scene's mid-frame must show an
  orange/amber pin dot or a composer text-field. If neither, re-shoot
  with explicit `Cmd+0` zoom reset.
- **Annotation mark**: `annotations` scene's frame at 70 % duration
  must show at least one drawn line/arrow AND one text label. If
  drawn but no label, re-shoot.
- **Install scene error**: `install` scene frames at 14 s, 17 s, 20 s,
  21 s must NOT contain the strings `Error`, `Cannot find native
  binding`, `oxc-parser`. If any do, re-shoot with confirmed
  `bun add -g` install.
- **Docs paint**: `docs` scene frame at 0.5 s must show the
  "Plugins & Vibes" landing OR header content (not pure white).
- **Split-screen alignment**: `tui-new` + `tui-edit` mid-frames must
  show both halves with content rendered (LEFT: Claude TUI text;
  RIGHT: canvas content). If either half is blank or shows a transition
  artifact, adjust the right-half `startFrom` and re-render the cut.

### Iteration budget per scene

Max 3 re-shoots per scene before escalating to user (avoid infinite
loops on environmental issues like 1Password lockouts or network
flakes). Each iteration logged in the execution report.

---

## Capture roster (single cut)

| Scene | Capture file | Tool | Action |
|-------|--------------|------|--------|
| install | `scene-02-install.mp4` | VHS | RECORD (`bun add -g`) |
| tui-setup-ds | `scene-03-tui-setup-ds.mp4` | VHS | RECORD (dry-run, no completion) |
| ds-reveal | `scene-04-ds-reveal.mp4` | Playwright | RECORD (tree nav, 4 specimens) |
| tui-new (LEFT) | `scene-06a-tui-new.mp4` | VHS | RECORD `claude` + `/design:new` real execution |
| tui-new (RIGHT) | `scene-06b-canvas-appears.mp4` | Playwright | RECORD dev-server iframe parallel with the VHS |
| canvas-reveal | `scene-07-canvas-reveal.mp4` | Playwright | RECORD Space+drag pan |
| canvas-hero | `scene-08-canvas-hero.mp4` | Playwright | RECORD 3 hovers + multi-select |
| tui-edit (LEFT) | `scene-10a-tui-edit.mp4` | VHS | RECORD `claude` + `/design:edit` real execution |
| tui-edit (RIGHT) | `scene-10b-canvas-edit.mp4` | Playwright | RECORD dev-server iframe parallel |
| comments | `scene-11-comments.mp4` | Playwright | RECORD `Cmd+0` reset + composer |
| annotations | `scene-12-annotations.mp4` | Playwright | RECORD pen + arrow + label |
| docs | `scene-14-docs.mp4` | Playwright | RECORD smooth scroll |

Net: 3 VHS tapes + 8 Playwright specs + 2 split-screen composites + 4
Remotion benefit cards + 2 framing scenes = 19 content sources.

---

## Sources of truth

- Frame timings: this file.
- Captions: this file.
- Intent checks: this file (per-scene cell above).
- Benefit-card copy: this file.
- Sandbox path + brief: this file.
