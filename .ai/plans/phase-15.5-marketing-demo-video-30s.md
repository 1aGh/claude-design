# Feature: Marketing demo video — real green-field onboarding (Cut A ~60s + Cut B 30s)

> **Rewritten 2026-05-20 to align with phase 15.1 infrastructure.** The
> v1 of this plan (archived at
> [`archive/phase-15.5-marketing-demo-video-30s-v1-pre-15.1-alignment.md`](./archive/phase-15.5-marketing-demo-video-30s-v1-pre-15.1-alignment.md))
> described building plumbing inline — `scripts/video/cards/`, `scripts/video/lib/*.sh`,
> custom opacity-envelope cross-fades, Playwright at 1920×1080, etc. Phase 15.1
> shipped all of that as proper infrastructure: a nested Remotion workspace at
> `scripts/video/final/`, `<TransitionSeries>` for xfades, `<TerminalFrame>` /
> `<BrowserChrome>` capture wrappers, `/flow:video-new-scene` scaffolder,
> Playwright at 1280×720, `pnpm run qa` visual-QA workflow, golden-frame
> regression. This rewrite assumes that infrastructure exists and ONLY composes
> the real marketing content on top of it.
>
> Filename retains `-30s` for git continuity; ignore the suffix.

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Produce two MP4s — `site/public/demo.mp4` (Cut A, ~60 s, primary, embedded in
the docs landing) and `site/public/demo-30s.mp4` (Cut B, 30 s, tight, GitHub
README, < 10 MB cap) — by:

1. **Bootstrapping a real green-field project** at
   `/tmp/scratch-maude-demo-<date>/` and running the full lifecycle (`maude
   init` → `/design:setup-ds` → `/design:new` → `/design:edit`) against it.
   The marketing video captures the **resulting artifacts**, not the slash
   commands themselves (the slash commands run inside Claude Code's TUI; the
   viewer must never see them typed in a shell — that misrepresents how the
   tool works).
2. **One VHS terminal capture** covering the genuinely shell-visible part
   (`npm i -g @1agh/maude && maude init --name recipe-recap && maude design serve`),
   using the canonical tape pattern from
   [`scripts/video/tapes/_TEMPLATE.tape`](../../scripts/video/tapes/_TEMPLATE.tape).
3. **Per-scene Playwright captures** against the scratch dev-server on port
   4400 (separate from this repo's 4399 instance) — DS preview reveal,
   canvas reveal, Cmd+Click inspector, HMR reload, comments overlay, docs.
4. **Assembly via the existing `<Final>` composition** at
   `scripts/video/final/src/compositions/Final.tsx` — extended with the real
   scene list + Cut B sibling (`Final30.tsx`). Music bed replaces the
   synthesized `ambient.aac` from phase 15.1 with a real CC0 track from
   `scripts/video/music/`.
5. **Site embed** (DemoVideo component, autoplay muted loop, reduced-motion
   pause) + README embed (GitHub release asset).

The agent (me) drives every step — no human in the recording loop; no manual
video editor.

## User Story

As a **prospective Maude user** landing on the docs site or the GitHub
README, I want a **under-one-minute visual demo** so I can grasp the full
canvas-first design lifecycle without reading a wall of text or installing
anything.

## Problem

Today the docs site and README describe Maude in prose. The two highest-
leverage features (`/design:setup-ds` 3-stage discovery + in-canvas
comments) only reveal themselves after a non-trivial setup — first-time
visitors bounce before they ever see the dev-server UI.

Phase 15.1 proved the production pipeline works end-to-end (real VHS
capture + real Playwright capture + Remotion assembly + loudnorm produced
a clean 11.9 s `final.normalized.mp4`). What's left = author the real
storyboard content on top.

## Solution

Author scenes against the phase-15.1 nested workspace. Reuse `<TerminalFrame>`,
`<BrowserChrome>`, `<LowerThird>`, `<TransitionSeries>`, `/flow:video-new-scene`.
Re-record the smoke captures with real content. Build `Final.tsx` (already
exists as proof-of-concept) into the actual Cut A; add `Final30.tsx` sibling.
Render → QA → loudnorm → deliver.

```
phase 15.1 (done)            phase 15.5 (this plan)
─────────────────            ──────────────────────────
Nested workspace +    ────▶  Real storyboard + real captures +
capture wrappers +           Cut A + Cut B + site embed +
qa workflow +                README embed.
scaffolder.
```

## Metadata

- **Type:** Marketing artifact (content authored on phase-15.1 infrastructure).
- **Complexity:** Medium — most plumbing exists; the work is content
  (scratch bootstrap, real captures, storyboard wiring, site embed).
- **App/Package:** `scripts/video/final/` (compose target) + `site/` (embed
  target) + scratch dir at `/tmp/scratch-maude-demo-<date>/`.
- **Dependencies:**
  - **Phase 15 toolchain green** (`pnpm run video:smoke` exits 0).
  - **Phase 15.1 infrastructure** committed and clean (nested workspace
    boots, `pnpm run qa` works, `pnpm run lint:tape` clean).
  - **Real CC0 music track** committed to `scripts/video/music/` per
    `MANIFEST.md` criteria (60–120 s instrumental, BPM 80–110, license URL
    HTTP 200).
  - **Optional: Whisper.cpp** if Cut A grows a voiceover (~466 MB model;
    deferred until needed — current LowerThird captions cover the silent-
    autoplay use case).

---

## Context References

### Must-Read Files

- `scripts/video/final/src/compositions/Final.tsx` — Existing composition.
  This plan extends its scene list from the phase-15.1 proof (1 terminal +
  1 browser) to the full storyboard (1 terminal + 5 browser scenes).
- `scripts/video/final/src/Root.tsx` — Composition registry. Append
  `Final30` next to `Final`.
- `scripts/video/final/src/lib/capture-frames/{TerminalFrame,BrowserChrome}.tsx`
  — Reusable wrappers. Inputs come from `public/scene-*.mp4`.
- `scripts/video/final/src/lib/LowerThird.tsx` — Caption strip used per
  capture scene.
- `scripts/video/tapes/_TEMPLATE.tape` — Canonical VHS tape pattern. Copy
  for the install-init-serve tape.
- `scripts/video/playwright/playwright.config.ts` — Already at 1280×720.
  New specs share this config.
- `scripts/video/music/MANIFEST.md` — Curation criteria for the music bed.
- `scripts/video/README.md` "Visual QA workflow" section — Mandatory step
  before delivery.
- `plugins/design/dev-server/bin/server-up.sh` — Lifecycle helper. New
  `lib/server-up.sh` in 15.5 just dispatches with `--root` + `--port 4400`.
- `.ai/decisions/DDR-036-video-pipeline-infrastructure.md` — The "Lessons
  from first real assembly" section documents the three production
  gotchas this plan must respect.
- `site/app/(home)/page.tsx` — Embed location for Cut A.
- `README.md` — Embed location for Cut B (GitHub release asset URL).

### Files to Create

- `scripts/video/storyboard.md` — Frozen scene script (both cuts), captions,
  pinned music URL.
- `scripts/video/tapes/01-install-init-serve.tape` — Single VHS tape for
  the shell-visible part. Pattern from `_TEMPLATE.tape`.
- `scripts/video/playwright/{03-ds-reveal,04-canvas-reveal,05-canvas-hero,06-edit-reload,07-comments,08-docs}.spec.ts`
  — Per-scene browser specs. All at 1280×720 viewport (config inherited).
- `scripts/video/final/src/compositions/Final30.tsx` — 900-frame Cut B
  composition. Drops scene 3 + scene 7; keeps the install → canvas reveal
  → hero → edit → docs arc.
- `scripts/video/final/src/scenes/02-install/index.tsx` — Wraps the
  install-init-serve VHS capture (via `<TerminalFrame>`).
- `scripts/video/final/src/scenes/{03-ds-reveal,04-canvas-reveal,05-canvas-hero,06-edit-reload,07-comments,08-docs}/index.tsx`
  — Each scene wraps its Playwright capture (via `<BrowserChrome>` with
  scene-appropriate `urlBar`).
- `scripts/video/music/<chosen-track>.mp3` — Real CC0 / Pixabay-License /
  FMA-CC0 instrumental, with row in `MANIFEST.md`.
- `scripts/video/final/lib/server-up.sh` — Thin shell wrapper around
  `plugins/design/dev-server/bin/server-up.sh` that pins `--port 4400` and
  `--root` to the scratch dir.
- `site/components/mdcc/demo-video.tsx` — DemoVideo client component
  (autoplay muted loop, prefers-reduced-motion pause).
- `site/public/{demo.mp4,demo-30s.mp4,demo-poster.jpg}` — Committed
  artifacts. Verified < 16 MB / < 10 MB respectively.
- `.ai/decisions/DDR-037-marketing-video-cut-a-cut-b.md` — Documents the
  content choices: which scenes Cut B drops + why, the two-port dev-server
  pattern, music license posture.

### Documentation

- VHS docs: https://github.com/charmbracelet/vhs (tape DSL).
- Playwright video: https://playwright.dev/docs/videos.
- Remotion `<TransitionSeries>`: https://www.remotion.dev/docs/transitions
  (already in workspace; `fade()` preset used in Final.tsx).
- Pixabay Music license: https://pixabay.com/service/license-summary/
  (no API; pick a track manually, pin URL).
- GitHub video embed in README, 10 MB limit:
  https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files.

---

## Design Decisions

### Storyboard — Cut A (primary, ~60 s)

**No scene shows a Claude TUI or a typed slash command.** Slash commands
run inside Claude Code; the viewer sees the **resulting artifacts** (DS
preview specimens, multi-artboard canvas, comment threads), not the
commands themselves.

| # | Scene id | Scene | Slot | Source | Caption |
|---|----------|-------|------|--------|---------|
| 1 | `scene-01-intro` | Intro card | 2.5 s | IntroScene (15.1) | `maude. canvas-first design + workflow for Claude Code.` |
| 2 | `scene-02-install` | Install + init + serve | 6.0 s | VHS `01-install-init-serve.tape` | `Install. Init. Serve. One command each.` |
| 3 | `scene-03-ds-reveal` | DS preview reveal (`colors-accent` → `typography` → `components-buttons` → `components-callout`) | 6.0 s | Playwright on scratch :4400 | `A real design system from one brief.` |
| 4 | `scene-04-canvas-reveal` | Multi-artboard `Recipe Recap` canvas | 5.0 s | Playwright on scratch :4400 | `Multi-artboard canvas. Real code.` |
| 5 | `scene-05-canvas-hero` | Pan/zoom + Cmd+Click inspector | 8.0 s | Playwright on scratch :4400 | `Cmd+Click any element. Live inspector.` |
| 6 | `scene-06-edit-reload` | File diff + HMR reload | 9.0 s | Playwright on scratch :4400 | `Edit a file. Canvas reloads in place.` |
| 7 | `scene-07-comments` | Comment overlay (pin → composer → @mention → reply → resolve) | 12.0 s | Playwright on scratch :4400 | `In-place comments. Anchored to elements.` |
| 8 | `scene-08-docs` | Docs teaser | 3.5 s | Playwright on `site/` localhost | `Docs at maude.iagh.cz.` |
| 9 | `scene-09-outro` | Outro card | 3.0 s | OutroScene (15.1) | `npm i -g @1agh/maude . github.com/1aGh/maude` |

Wall-clock: 55 s of scenes − 8 × 12-frame `<TransitionSeries>` xfades
(0.4 s each) = ~51.8 s. Held tails on intro / outro bring it to ~60 s.

### Storyboard — Cut B (tight, 30 s, GitHub README)

Drops scene 3 (DS reveal — needs the 5 s setup-ds context to land) and
scene 7 (comments — needs 12 s to read every beat). Keeps the canonical
"install → see canvas → iterate → docs" arc under GitHub's 10 MB cap.

| # | Cut A # | Scene | Slot | Caption |
|---|---------|-------|------|---------|
| 1 | 1 | Intro | 2.0 s | `maude. design + workflow for Claude Code.` |
| 2 | 2 | Install + init + serve | 4.0 s | `One command to install. One to scaffold.` |
| 3 | 4 | Canvas reveal | 4.0 s | `Multi-artboard canvas. Real code.` |
| 4 | 5 | Canvas hero + Cmd+Click | 6.5 s | `Cmd+Click any element.` |
| 5 | 6 | Edit + HMR | 7.0 s | `Edit a file. Canvas reloads in place.` |
| 6 | 8 | Docs teaser | 2.5 s | `Docs at maude.iagh.cz.` |
| 7 | 9 | Outro | 2.5 s | `npm i -g @1agh/maude` |

Wall-clock: 28.5 s − 6 × 12-frame xfades = ~26.1 s. Held tail on outro → 30 s.

### Scratch project (input for every browser scene)

- Path: `/tmp/scratch-maude-demo-$(date +%Y%m%d)/`
- Brief for `/design:setup-ds`:
  > "Recipe manager kde nastavíš počet porcí a on přepočítá ingredience.
  > Pro mě a 3 kamarády. Vibe: 80s cookbook, Berkeley-mono everywhere,
  > hard-edges + amber-rust stamp accent."
- Canvas for `/design:new`: `"Recipe Recap"` — `"Multi-artboard hero +
  portion scaler + ingredient list + cookbook print preview"`.
- Edit feedback: `"tighten the hero, drop one row from the metadata
  block"` — produces a small readable diff suitable for Scene 6 HMR.

### Dev-server lifecycle (two-port)

The scratch dev-server runs on `--port 4400` so this repo's instance on
4399 is undisturbed. Helper:

```sh
# scripts/video/final/lib/server-up.sh
exec plugins/design/dev-server/bin/server-up.sh \
  --root "/tmp/scratch-maude-demo-$(date +%Y%m%d)" \
  --port 4400 "$@"
```

### Captions discipline

Per [no AI-tell punctuation] memory: ASCII hyphens only, straight quotes,
three periods if needed (never `…`), interpunct (`·`) OK only in stamps.
One caption per scene; held through any sub-beats. `<LowerThird>` from
phase 15.1 takes a `durationInFrames` prop and handles entry/exit fades.

### What stays from phase 15.1 (do NOT re-build)

- Nested workspace + `pnpm run render` + `pnpm run qa`.
- `<TransitionSeries>` + `fade()` for cross-fades.
- `<TerminalFrame src=...>` + `<BrowserChrome src=... urlBar=...>` wrappers.
- `<LowerThird caption=... durationInFrames=...>` caption strip.
- IntroScene + OutroScene (may need brand-polish pass — see Task 4 note).
- VHS tape canonical pattern at `tapes/_TEMPLATE.tape` (Hide+clear+Show,
  1280×720 canvas).
- Playwright config at 1280×720.
- `pnpm run qa` mandatory before delivery.
- Goldens harness (Final not in goldens — capture-driven; per DDR-036).

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 0 — GATE: phase 15.1 infrastructure clean

- **Do:** Confirm:
  1. `pnpm run video:smoke` exits 0.
  2. `cd scripts/video/final && pnpm exec tsc --noEmit` exits 0.
  3. `cd scripts/video/final && pnpm run lint:motion && pnpm run lint:tape && pnpm run goldens:check` all green.
  4. `cd scripts/video/final && pnpm run qa Demo` produces a contact sheet
     that reads coherently.
- **Pattern:** Hard gate. Do not start authoring content against a broken
  workspace.
- **Validate:** All four commands exit 0.

### Task 1 — CREATE storyboard + curate real music track

- **Do:**
  1. Write `scripts/video/storyboard.md` with **both** scene tables (Cut A
     + Cut B), pinned music URL + license, snippet timecodes per scene,
     captions ASCII-clean.
  2. Source one 60–120 s instrumental, BPM 80–110, mood "tech inspiration"
     / "minimal piano" / "lofi". Pixabay Music, Mixkit, or FMA. Download
     manually (no API).
  3. Rename per convention: `<slug>-<bpm>bpm-<source>.mp3`. Place in
     `scripts/video/music/`. Append row to `MANIFEST.md` with **license
     URL** (mandatory — Task 7 verifies HTTP 200).
  4. Replace `scripts/video/final/public/ambient.aac` reference in
     `Final.tsx` with `staticFile('<chosen-track-name>.mp3')`. Delete the
     placeholder `ambient.aac` from `public/`.
- **Gotcha:** File size budget per track ~4–6 MB at 192 kbps. Trim with
  ffmpeg if oversize: `ffmpeg -i in.mp3 -b:a 192k out.mp3`.
- **Validate:**
  - `ls scripts/video/music/*.mp3` has at least one real track.
  - `curl -sI <license-url> | head -1` returns `200`.
  - `ffprobe -v error -show_entries format=duration scripts/video/music/*.mp3`
    ≥ 60 s for the chosen track.

### Task 2 — BOOTSTRAP green-field scratch project (agent-driven)

> This is the **load-bearing real-work task.** The agent (executing this
> plan, this Claude Code session) drives the full `/design:setup-ds` +
> `/design:new` + `/design:edit` cycle against the scratch dir. The slash
> commands run inside THIS session against the scratch target; the
> recording captures the resulting state, not the typed commands.

- **Do:**
  1. `SCRATCH=/tmp/scratch-maude-demo-$(date +%Y%m%d)`
  2. `rm -rf "$SCRATCH" && mkdir -p "$SCRATCH"`
  3. `cd "$SCRATCH" && node /Volumes/D/git/claude-design/cli/bin/maude.mjs init --name recipe-recap`
  4. **Drive `/design:setup-ds project "<brief from storyboard>"`** from
     this Claude session targeting the scratch dir. Run the full 3-stage
     discovery. Make agent-judgement picks for any `AskUserQuestion` gates
     based on the brief — document picks in the execution report.
  5. **Drive `/design:new "Recipe Recap" "<brief>"`** to produce
     `.design/ui/Recipe Recap.tsx` with ≥ 4 artboards.
  6. **Drive `/design:edit "tighten the hero, drop one row from the
     metadata block"`** for one captured iteration. Edit must produce a
     small readable diff (Scene 6 reads it in 7 s).
  7. Seed `.design/_comments/recipe_recap.json` with **1 resolved + 1
     open-with-reply** thread anchored to stable `[data-cd-id]` values.
     Schema = `OverlayComment` from `plugins/design/dev-server/comments-overlay.tsx`.
- **Pattern:** Agent runs real slash commands; marketing video captures
  the resulting state, not the commands.
- **Gotcha:** `/design:edit` writes a snapshot to `.design/_history/<slug>/`
  — keep both before/after for Scene 6 diff.
- **Validate:**
  - `ls "$SCRATCH/.design/system/project/preview/"` ≥ 6 specimens.
  - `ls "$SCRATCH/.design/ui/"` has `Recipe Recap.tsx` + `.meta.json`.
  - `cat "$SCRATCH/.design/_comments/recipe_recap.json" | jq length` = 2.

### Task 3 — RECORD Scene 2 (VHS terminal) + Scenes 3–8 (Playwright browser)

- **Do (Scene 2 — VHS terminal):**
  1. Copy `scripts/video/tapes/_TEMPLATE.tape` →
     `scripts/video/tapes/01-install-init-serve.tape`.
  2. Edit: typed block runs `npm i -g @1agh/maude` (or just shows
     `maude --help` if local install) → `maude init --name recipe-recap`
     → `maude design serve --port 4400`. Hide block sets up scratch dir.
  3. Run `vhs scripts/video/tapes/01-install-init-serve.tape` →
     `scripts/video/final/public/scene-02-install.mp4`.
- **Do (Scenes 3–8 — Playwright on scratch :4400):**
  1. Boot scratch dev-server: `bash scripts/video/final/lib/server-up.sh`
     (produces port 4400 against `$SCRATCH`).
  2. Author six spec files in `scripts/video/playwright/`:
     - `03-ds-reveal.spec.ts` — navigates through 4 DS preview specimens
       (`/canvas/system/project/preview/colors-accent`,
       `/typography-ladder`, `/components-buttons`, `/components-callout`),
       1.2 s pause each. **Initial 2.8 s wait** after first `goto` to let
       canvas-shell hydrate (Remotion `<OffthreadVideo>` will trim later).
     - `04-canvas-reveal.spec.ts` — opens `/canvas/ui/Recipe+Recap`,
       gentle scroll to reveal all artboards.
     - `05-canvas-hero.spec.ts` — pan/zoom via `page.mouse.wheel`, then
       Cmd+hover deep child, hold 1 s for inspector ring, click, release.
     - `06-edit-reload.spec.ts` — open canvas, wait, programmatically
       trigger HMR (touch the .tsx in `$SCRATCH/.design/ui/`), capture
       the iframe reload moment.
     - `07-comments.spec.ts` — click empty area → composer appears →
       type "This needs more breathing room" → submit → new pin renders
       → click old pin → thread opens → reply with @mention autocomplete
       → resolve a different pin.
     - `08-docs.spec.ts` — navigate to real `site/` localhost (or
       `.design/ui/Docs Site.tsx` if `site/` not running), gentle scroll.
  3. Run all specs: `pnpm exec playwright test --config scripts/video/playwright/playwright.config.ts`.
  4. Transcode each WebM to MP4 and place in
     `scripts/video/final/public/scene-<id>.mp4`:
     ```sh
     for spec in 03-ds-reveal 04-canvas-reveal 05-canvas-hero 06-edit-reload 07-comments 08-docs; do
       WEBM=$(find scripts/video/.work/playwright -name "*${spec}*" -name "*.webm" | head -1)
       ffmpeg -y -i "$WEBM" -c:v libx264 -pix_fmt yuv420p -r 30 -an \
         "scripts/video/final/public/scene-${spec}.mp4"
     done
     ```
- **Gotcha:**
  - **2.8 s wait** after first `goto` for canvas-shell scenes — the
    iframe needs time to hydrate, dev-server WebSocket needs to connect,
    inspector to inject. Skip this wait and you record a black frame.
  - All Playwright captures inherit the 1280×720 viewport from
    `playwright.config.ts` (DDR-036 Gotcha 2 — do NOT override to
    1920×1080).
- **Validate:**
  - `pnpm run lint:tape` clean (the new tape follows the discipline).
  - 7 MP4s in `scripts/video/final/public/scene-*.mp4` (1 terminal + 6
    browser).
  - Each MP4 plays cleanly: `ffprobe ... -show_entries format=duration`
    matches storyboard slot ± 0.5 s.

### Task 4 — COMPOSE Final.tsx (Cut A) + CREATE Final30.tsx (Cut B)

- **Do (Final.tsx — extend the phase-15.1 proof):**
  1. Replace the placeholder terminal + browser scene pair with the full
     9-scene `<TransitionSeries>`:
     - `<IntroScene />` (60f)
     - `<TerminalFrame src="scene-02-install.mp4" />` (180f)
     - `<BrowserChrome src="scene-03-ds-reveal.mp4" urlBar="localhost:4400" />` (180f)
     - `<BrowserChrome src="scene-04-canvas-reveal.mp4" urlBar="localhost:4400/Recipe+Recap" />` (150f)
     - `<BrowserChrome src="scene-05-canvas-hero.mp4" urlBar="localhost:4400/Recipe+Recap" />` (240f)
     - `<BrowserChrome src="scene-06-edit-reload.mp4" urlBar="localhost:4400/Recipe+Recap" />` (270f)
     - `<BrowserChrome src="scene-07-comments.mp4" urlBar="localhost:4400/Recipe+Recap" />` (360f)
     - `<BrowserChrome src="scene-08-docs.mp4" urlBar="maude.iagh.cz" />` (105f)
     - `<OutroScene />` (90f)
   2. 12-frame `fade()` `<TransitionSeries.Transition>` between every pair.
   3. `<LowerThird>` overlays via `<Sequence>` per capture scene (skip
      intro/outro — they own their typography).
   4. Total `durationInFrames` = recalculated per scene slots + xfades.
   5. Replace `<Audio src={staticFile('ambient.aac')}>` with the real
      track from Task 1.
- **Do (Final30.tsx — new):**
  1. New composition at `src/compositions/Final30.tsx`. Same imports as
     `Final.tsx`. Wires only Cut B's 7 scenes (no DS reveal, no comments).
  2. Register in `src/Root.tsx` next to `Final`.
- **Do (Brand polish on IntroScene / OutroScene — optional but
  recommended):**
  - Phase 15.1's IntroScene / OutroScene are minimal. Consider upgrading
    with a SKU stamp top-left (`MDCC-MKT/00 · MAUDE · v<current>`) +
    catalog strip bottom (`github.com/1aGh/maude · 2 plugins · 1 CLI ·
    zero telemetry`) to match the project's industrial-catalog DS. If
    upgraded, run `pnpm run goldens:update` and review the diff.
- **Pattern:** Lift `<TerminalFrame>` + `<BrowserChrome>` patterns — one
  line per scene, all chrome is in the lib.
- **Gotcha:** Frame budgets must satisfy `<TransitionSeries>` constraint:
  scene duration ≥ 2 × xfade duration. With 12-frame xfades, minimum
  scene = 24 frames. Smallest planned scene is intro at 60 frames — fine.
- **Validate:**
  - `pnpm exec tsc --noEmit` exits 0.
  - `pnpm run render Final out/cut-a.mp4` succeeds.
  - `pnpm run render Final30 out/cut-b.mp4` succeeds.
  - Both durations within ± 0.5 s of target.

### Task 5 — Visual QA (mandatory, gated)

- **Do:**
  1. `pnpm run qa Final 16` — render + extract 16 frames + contact sheet.
  2. **Agent (Claude session) reads every QA_FRAME path via Read tool.**
     For each scene, verify: no leaked setup commands, no empty bg, no
     truncated UI, captions readable, xfades smooth.
  3. Repeat for `pnpm run qa Final30 12`.
  4. If ANY issue surfaces, fix the source capture / scene wiring / token
     and loop. Do not advance to Task 6 until both contact sheets read
     clean end-to-end.
- **Pattern:** Per DDR-036 "Lessons from first real assembly" — this step
  is **mandatory before delivery**. Skipping it is how the phase-15.1
  first-delivery shipped two visible bugs the user caught in 30 s.
- **Validate:** Two contact sheets at `__qa__/Final/contact-sheet.png` +
  `__qa__/Final30/contact-sheet.png`. Agent confirms scene-by-scene
  cleanliness in the execution report.

### Task 6 — Loudnorm + copy to site/public

- **Do:**
  1. `pnpm run render Final site/public/demo.mp4 --crf=23` (re-render
     into final location; render is deterministic, no quality loss).
  2. `pnpm run render Final30 site/public/demo-30s.mp4 --crf=23`.
  3. Loudnorm both:
     ```sh
     for f in site/public/demo.mp4 site/public/demo-30s.mp4; do
       ffmpeg -y -i "$f" -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy "${f%.mp4}.norm.mp4"
       mv "${f%.mp4}.norm.mp4" "$f"
     done
     ```
  4. Poster: `ffmpeg -y -i site/public/demo.mp4 -vf "select=eq(n\\,30)" -vframes 1 -q:v 2 site/public/demo-poster.jpg`.
- **Gotcha:**
  - If `demo.mp4` > 16 MB → re-render at `--crf=26`. If `demo-30s.mp4` >
    10 MB → same.
  - `-c:v copy` on the loudnorm step preserves H.264 — no re-encode.
- **Validate:**
  - `ffprobe -v error -show_entries format=duration,size site/public/demo.mp4`
    → duration 60.00 ± 0.5, size < 16 MB.
  - Same for `demo-30s.mp4` — 30.00 ± 0.5, < 10 MB.
  - `ffmpeg -i <file> -af loudnorm=print_format=json -f null - 2>&1 | tail -25`
    integrated loudness -18 ± 2 LU.

### Task 7 — Site embed (DemoVideo component)

- **Do:**
  1. `site/components/mdcc/demo-video.tsx`:
     ```tsx
     'use client';
     import { useEffect, useRef } from 'react';
     export function DemoVideo() {
       const ref = useRef<HTMLVideoElement>(null);
       useEffect(() => {
         const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
         const sync = () => { if (ref.current) mql.matches ? ref.current.pause() : ref.current.play(); };
         sync();
         mql.addEventListener('change', sync);
         return () => mql.removeEventListener('change', sync);
       }, []);
       return (
         <video ref={ref} src="/demo.mp4" poster="/demo-poster.jpg"
           autoPlay muted loop playsInline controls={false}
           className="mdcc-demo-video" aria-label="Maude demo" />
       );
     }
     ```
  2. Insert into `site/app/(home)/page.tsx` between `.mdcc-hero` and the
     next section.
  3. Add CSS in `site/app/global.css`:
     `.mdcc-demo-video { aspect-ratio: 16/9; width: 100%; object-fit: cover;
     border: var(--rule-default); background: var(--bg-1); }`.
- **Gotcha:** `playsInline` required for iOS autoplay. `muted` required
  for autoplay everywhere.
- **Validate:**
  - `pnpm --filter @maude/site build` exits 0.
  - Manual: `pnpm --filter @maude/site dev`, open `localhost:3000`,
    confirm autoplay + loop + reduced-motion pause.

### Task 8 — README embed (release asset) + npm publish hygiene

- **Do (README):**
  1. Below H1, add:
     ```md
     <video src="https://github.com/1aGh/maude/releases/latest/download/demo-30s.mp4"
            controls muted playsinline width="800"></video>

     > Full walkthrough at [maude.iagh.cz](https://maude.iagh.cz).
     ```
  2. Upload `site/public/demo-30s.mp4` as a release asset via
     `gh release create demo-assets-v<X.Y.Z> site/public/demo-30s.mp4`.
- **Do (npm hygiene):**
  1. Write `scripts/check-publish-size.sh`:
     ```sh
     #!/usr/bin/env bash
     set -euo pipefail
     OUT=$(npm pack --dry-run --json)
     SIZE=$(echo "$OUT" | jq -r '.[0].size')
     if [ "$SIZE" -gt 2000000 ]; then echo "tarball $SIZE > 2 MB"; exit 1; fi
     if echo "$OUT" | jq -r '.[0].files[].path' | grep -qE "demo(-30s)?\.mp4|scripts/video/"; then
       echo "MP4 or scripts/video/ in tarball"; exit 1
     fi
     echo "ok: tarball ${SIZE} bytes, no MP4 / scripts/video matches"
     ```
- **Validate:**
  - GitHub README preview renders the video.
  - `bash scripts/check-publish-size.sh` exits 0.

### Task 9 — Record DDR-037

- **Do:** `.ai/decisions/DDR-037-marketing-video-cut-a-cut-b.md`.
  Document:
  1. Content decisions: which scenes Cut B drops + why (DS reveal needs
     6 s setup-ds context; comments needs 12 s to read every beat —
     both unviable in 30 s).
  2. The "no slash command in shell" rule — slash commands are TUI;
     showing them typed in bash misrepresents how the tool works.
  3. Two-port dev-server pattern (4399 repo / 4400 scratch).
  4. The 2.8 s canvas-shell hydration wait constraint for Playwright
     captures.
  5. Cross-link: DDR-031 (toolchain), DDR-036 (15.1 infrastructure +
     three gotchas).
- **Pattern:** Mirror DDR-036 shape.
- **Validate:** DDR cross-links resolve.

---

## Validation

Run these end-to-end:

1. **Toolchain green:** `pnpm run video:smoke` exits 0.
2. **Infrastructure clean:** `cd scripts/video/final && pnpm exec tsc --noEmit && pnpm run lint:motion && pnpm run lint:tape && pnpm run goldens:check` — all exit 0.
3. **End-to-end pipeline (idempotent):**
   ```sh
   bash scripts/video/final/lib/server-up.sh &      # boot scratch :4400
   vhs scripts/video/tapes/01-install-init-serve.tape
   pnpm exec playwright test --config scripts/video/playwright/playwright.config.ts
   # transcode WebM → MP4 loop (see Task 3)
   cd scripts/video/final
   pnpm run render Final site/public/demo.mp4 --crf=23
   pnpm run render Final30 site/public/demo-30s.mp4 --crf=23
   # loudnorm both (see Task 6)
   ```
4. **Visual QA (mandatory):** `pnpm run qa Final 16 && pnpm run qa Final30 12` — agent reads every JPG, contact sheet eyeballed.
5. **Sizes:** `demo.mp4` < 16 MB, `demo-30s.mp4` < 10 MB.
6. **Loudness:** integrated loudness within -18 ± 2 LU for both.
7. **Site embed:** landing autoplays muted, loops, reduced-motion pauses.
8. **README embed:** renders inline on GitHub.
9. **npm hygiene:** `bash scripts/check-publish-size.sh` exits 0.
10. **Lint:** `pnpm lint` clean (root).

---

## Scenario Coverage (UI tasks — required)

The site embed + README embed ARE UI changes. New scenarios:

- `site-landing-video-autoplay` — assert `<video>` element present,
  `currentTime > 0` after 1 s, `muted=true`, `loop=true`. Platforms:
  web-desktop, web-mobile.
- `site-landing-reduced-motion` — emulate `prefers-reduced-motion`,
  assert `video.paused === true`. Platform: web-desktop.
- `readme-video-loads` — fetch the release-asset URL, assert HTTP 200.
  Platform: web-desktop.

`scenario-runner` agent runs these in `/flow:validate`.

---

## Acceptance Criteria

- [ ] Tasks 0–9 completed in order.
- [ ] Phase 15.1 gates green (Task 0).
- [ ] Real CC0 music track committed; license URL HTTP 200.
- [ ] Scratch project bootstrapped, all artifacts exist (Task 2 validates).
- [ ] Seven `scene-*.mp4` captures in `scripts/video/final/public/` (1 VHS + 6 Playwright).
- [ ] `pnpm run lint:tape` clean (new tape follows discipline).
- [ ] `Final.tsx` extended with full storyboard; `Final30.tsx` created.
- [ ] **`pnpm run qa Final` + `pnpm run qa Final30` contact sheets eyeballed; agent confirmed scene-by-scene clean in execution report.**
- [ ] `site/public/demo.mp4` exists, < 16 MB, ~60 s, h264 + aac, loudnorm -18 LUFS.
- [ ] `site/public/demo-30s.mp4` exists, < 10 MB, ~30 s, same encoding.
- [ ] `site/public/demo-poster.jpg` exists.
- [ ] DemoVideo component embedded in landing; autoplay + reduced-motion verified.
- [ ] GitHub release asset uploaded; README renders inline.
- [ ] `scripts/check-publish-size.sh` exits 0; no MP4 in npm tarball.
- [ ] DDR-037 recorded.
- [ ] Scenarios authored + green in `/flow:validate`.
- [ ] No DDR-worthy decision left unrecorded.
