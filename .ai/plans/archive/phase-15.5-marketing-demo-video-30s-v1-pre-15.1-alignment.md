# Feature: Marketing demo — real green-field onboarding lifecycle (~60s primary + 30s tight cut)

> **Toolchain prerequisite (2026-05-20):** Phase 15 video toolchain
> ([`archive/phase-15-video-pipeline-toolchain.md`](./archive/phase-15-video-pipeline-toolchain.md))
> must be green. `pnpm run video:smoke` exits 0.
>
> **Infrastructure prerequisite (phase 15.1, 2026-05-20):**
> [`phase-15.1-video-pipeline-infrastructure.md`](./phase-15.1-video-pipeline-infrastructure.md)
> must be done. That phase provides:
>   - Nested Remotion workspace at `scripts/video/final/` (own package.json,
>     tsconfig, remotion.config.ts, Studio entry).
>   - TikTok-style captioning components cherry-picked into
>     `scripts/video/final/src/lib/captioned-clip/` (Page + SubtitlePage +
>     `<CaptionedClip>` wrapper) + build-time Whisper.cpp pipeline (`sub.mjs`).
>   - Animation helpers re-export surface at
>     `scripts/video/final/src/lib/animated/` (remotion-bits + remotion-animated).
>   - Golden-frame regression harness (`__tests__/frame-regression.test.ts`).
>   - `/flow:video-new-scene` scaffolder for adding scenes.
>   - Curated CC0 music manifest at `scripts/video/music/MANIFEST.md`.
>   - CSS motion guard at `scripts/video/final/scripts/check-css-motion.sh`.
> This plan composes scenes ON TOP of that infra — do not re-build the
> workspace inline. Use the scaffolder for new scenes; render via the nested
> workspace (`cd scripts/video/final && pnpm run render <Composition> ...`);
> caption via `pnpm run caption`. Anywhere the original 15.5 tasks scaffolded
> `scripts/video/cards/` or invoked `pnpm exec remotion render` from root,
> route through the nested workspace instead.
>
> **Hard reset (2026-05-20, post-revert).** Prior phase-15.5 attempt produced
> VHS "cinematic-cast" reproductions of `/design:setup-ds` / `/design:new` /
> `/design:edit` terminal output. The user rejected that direction: those
> commands run inside the Claude Code TUI and **viewer must never see them
> typed in a shell**, because that misrepresents how the tool actually works
> (they are slash commands, not shell commands). This plan replaces the
> previous Tasks 5–9 with a **real green-field onboarding capture** flow.
> Filename retains `-30s` for git continuity; ignore the suffix.

## Description

Produce two 1920×1080 H.264 MP4s — `site/public/demo.mp4` (primary, ~60s,
embedded in the docs landing) and `site/public/demo-30s.mp4` (tight cut for
the GitHub README, < 10 MB) — by:

1. **Bootstrapping a real green-field project** at
   `/tmp/scratch-maude-demo-<date>/` using the production CLI + plugins:
   - `maude init --name recipe-recap`
   - `/design:setup-ds project "<brief>"` driven from this Claude Code session
     against the scratch directory (the slash command is dispatched here; the
     scratch dir is the target — it becomes a real DS scaffold).
   - `/design:new "Recipe Recap" "<brief>"` similarly.
   - `/design:edit "<feedback>"` against the freshly-created canvas — produces
     a real before/after + a real HMR reload moment.
   - Seed 2 comment threads (1 resolved + 1 open-with-reply) in
     `.design/_comments/recipe_recap.json` so Scene 7 has pre-existing pins.
2. **Capturing artifacts** of the resulting state:
   - VHS terminal recording of the **install + init + serve** path only —
     `npm i -g @1agh/maude`, `maude init --name recipe-recap`,
     `maude design serve`. Stops before any slash-command interaction; the
     viewer sees the CLI surface, never the Claude TUI.
   - Playwright browser recordings of the dev-server (pointed at the scratch
     dir, on a separate port from this repo's dev-server) — DS preview
     specimens, the multi-artboard canvas, pan/zoom + Cmd+Click inspector,
     a real HMR moment after a file edit, the FigJam-style comments overlay,
     the docs site teaser.
   - Two Remotion brand cards (intro + outro).
3. **Composing** via Remotion: scene library + brand cards + lower-third
   captions + opacity-envelope cross-fades. Two compositions share the same
   scene library — Cut A (60s) and Cut B (30s).

The artifact ships **into this repo** at `site/public/demo.mp4` +
`site/public/demo-30s.mp4` + `site/public/demo-poster.jpg`, embedded into the
docs landing via a small `<DemoVideo>` component. The scratch project is
ephemeral — its files exist only at recording time; after the cuts are
rendered the scratch dir can be deleted. None of the scratch project's source
ships into this repo or to npm.

## User Story

As a **prospective Maude user** landing on the docs site or the GitHub README,
I want a **under-one-minute visual walk-through of a fresh project** so I can
grasp the canvas-first design lifecycle — install → init → DS bootstrap →
canvas creation → live dev-server → iterate → comments → docs — **without
installing anything first** and **without watching someone type slash commands
in a terminal** that wouldn't make sense to me until I had Maude installed.

## Problem

Prior attempt synthesized terminal output to fake `/design:setup-ds` etc.
running in a shell. Two issues:

- **Misleading.** Slash commands live in the Claude Code TUI, not in zsh. A
  marketing reel that shows them in a shell prompt teaches the viewer the
  wrong mental model.
- **Inauthentic.** Pre-canned bash `printf` sequences are easy to spot once
  you know how Maude actually works. Existing users will see fake; new users
  will be confused when their real experience doesn't match the video.

The fix is to **stop showing the agent commands at all** and instead show
their **visual results** — the live dev-server with a freshly-onboarded
project — plus the one terminal step that genuinely IS a shell command
(`maude init` + `maude design serve`).

## Solution

Two cuts of "real first-time user lifecycle":

| Cut | Duration | Embed | Filename | Size |
|-----|----------|-------|----------|------|
| **A — primary** | ~60 s | `site/` landing | `site/public/demo.mp4` | < 16 MB |
| **B — tight** | 30 s | GitHub README | `site/public/demo-30s.mp4` | < 10 MB |

Same scene library, same captions schema, same brand cards. Re-record any
single scene → both cuts pick up the change on next `pnpm exec remotion
render`.

## Metadata

- **GitHub Issue:** n/a (internal initiative)
- **Type:** New Capability — marketing artifact, second attempt
- **Complexity:** High — multi-tool orchestration; second dev-server
  instance against a scratch root; agent must drive a real `/design:*` cycle
  before recording starts.
- **App/Package:** `site/` (embed target) + `scripts/video/` (pipeline) +
  `/tmp/scratch-maude-demo-<date>/` (recording surface; ephemeral)
- **Affected systems:** Next.js docs site, README, design plugin
  dev-server, repo build/publish (videos must NOT ship to npm)
- **Dependencies:**
  - Phase 15 toolchain green
  - Pixabay royalty-free music asset (optional; silent v1 acceptable)
  - This repo's dev-server NOT running (we'll spawn a second instance
    against the scratch root on a separate port; the current one stays as-is)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/server.mjs` and `server.ts` — Why: confirms
  `--root <path>` flag resolution; the scratch dir becomes the server root,
  not this repo.
- `plugins/design/dev-server/bin/server-up.sh` — Why: lifecycle helper. The
  scratch-dev-server uses this with a custom `--root` + an alternate port.
- `plugins/design/skills/design-system/SKILL.md` — Why: drive
  `/design:setup-ds` against the scratch dir from this session. The skill's
  3-stage discovery (Vision → Research → Refinement) is the agent's exact
  procedure.
- `plugins/design/commands/new.md` — Why: drive `/design:new` against the
  scratch dir from this session. The command spawns `frontend-design` for
  envelope construction → canvas generation.
- `plugins/design/commands/edit.md` — Why: drive `/design:edit` for the
  real HMR moment captured in Scene 6.
- `plugins/design/dev-server/comments-overlay.tsx` (search for `cm-pin`,
  `cm-composer`, `cm-thread`, `cm-mention-popup`) — Why: Scene 7 Playwright
  spec needs the same selectors that worked in the prior attempt:
  `.cm-pin`, `.cm-composer`, `.cm-composer__textarea`, `.cm-thread`,
  `.cm-thread__reply-textarea`, `.cm-mention-popup`, `.cm-btn.cm-btn--primary`.
- `site/app/(home)/page.tsx` — Why: embed target for the primary cut. Insert
  point is after `.mdcc-hero` / install section, before `.mdcc-cat-grid`.
- `README.md` lines 1-20 — Why: embed target for the tight cut (`<video>`
  tag below H1).
- `package.json` `files` array — Why: must NOT include `site/public/*.mp4`.
- `scripts/video/smoke/` — Why: existing Phase 15 toolchain proof. The
  marketing pipeline reuses the same Remotion/Playwright/VHS shape, only
  bigger.

### Files to Create

- `scripts/video/storyboard.md` — Frozen scene script for both cuts +
  music license slot.
- `scripts/video/cards/{IntroCard,OutroCard,LowerThird,tokens,index,remotion.config}.tsx`
  — Brand cards + lower-third overlay.
- `scripts/video/tapes/01-install-init-serve.tape` — Single VHS terminal
  capture covering the entire CLI surface the viewer should see. **No slash
  commands.**
- `scripts/video/playwright/*.spec.ts` — Per-scene browser specs (DS preview
  reveal, canvas reveal, canvas hero, edit auto-reload, comments overlay,
  docs teaser).
- `scripts/video/playwright/playwright.config.ts` — Absolute `outputDir` via
  `import.meta.url`; viewport 1920×1080.
- `scripts/video/final/{Final,Final30,SceneClip,scene-source,index,remotion.config}.tsx`
  — Two compositions + helper components.
- `scripts/video/lib/{server-up,normalize,make-placeholders}.sh` — Helper
  layer. `server-up.sh` boots a SECOND dev-server instance against the
  scratch root on `--port 4400` (this repo's instance keeps 4399).
- `scripts/video/bootstrap-scratch.sh` — Agent-runnable script that
  scaffolds the scratch dir up to (but NOT including) the `/design:setup-ds`
  / `/design:new` / `/design:edit` cycles (those are agent-driven in this
  Claude session).
- `scripts/video/render-all-scenes.sh` — Top-level orchestrator.
- `scripts/video/download-music.sh` — Idempotent fetch of the optional
  music bed.
- `scripts/check-publish-size.sh` — npm hygiene guard (no MP4 in tarball).
- `site/components/mdcc/demo-video.tsx` — `<DemoVideo>` component for
  landing embed (autoplay muted loop, prefers-reduced-motion pause).
- `site/public/{demo.mp4,demo-30s.mp4,demo-poster.jpg}` — Final artifacts.
- `.ai/decisions/DDR-035-marketing-video-real-green-field-capture.md` — DDR
  recording the new approach + the rejection of the cinematic-cast
  alternative.

### Documentation

- VHS docs: https://github.com/charmbracelet/vhs
- Playwright video recording: https://playwright.dev/docs/videos
- Remotion `Composition` + `Sequence` + `Video`:
  https://www.remotion.dev/docs/composition
- Pixabay Music license: https://pixabay.com/service/license-summary/
- GitHub video embed in README (10 MB limit):
  https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files

---

## Design Decisions

### Storyboard — Cut A (primary, ~60 s)

Every scene below is **a real artifact** captured from the scratch project
or rendered as a Remotion brand card. **No scene shows a Claude TUI or a
typed slash command.**

| # | Scene | Slot | Source | Caption |
|---|-------|------|--------|---------|
| 1 | Intro card | 2.5 s | Remotion IntroCard | `maude. canvas-first design + workflow for Claude Code.` |
| 2 | Install + init + serve (terminal) | 6.0 s | VHS tape on the scratch dir | `Install. Init. Serve. One command each.` |
| 3 | DS preview reveal — `colors-accent` → `typography` → `components-buttons` → `components-callout` | 6.0 s | Playwright on scratch dev-server | `A real design system, scaffolded from one brief.` |
| 4 | Canvas reveal — fresh multi-artboard `Recipe Recap` | 5.0 s | Playwright on scratch dev-server | `Multi-artboard canvas. Real code, no Figma.` |
| 5 | Canvas hero — pan/zoom + Cmd+Click inspector | 8.0 s | Playwright on scratch dev-server | `Cmd+Click any element. Live inspector.` |
| 6 | Edit moment — file diff + HMR reload | 9.0 s | Playwright on scratch dev-server (no terminal half — viewer sees the result, not the command) | `Edit a file. Canvas reloads in place.` |
| 7 | Comments overlay — pin, composer, @mention, reply, resolve | 12.0 s | Playwright on scratch dev-server | `In-place comments. Anchored to elements.` |
| 8 | Docs teaser | 3.5 s | Playwright on real `site/` localhost or canvas-shell mock | `Docs at maude.sh.` |
| 9 | Outro card | 3.0 s | Remotion OutroCard | `npm i -g @1agh/maude . github.com/1aGh/maude` |

Wall-clock: 55.0 s of scenes − 8 cross-fades × 9 frames overlap (0.3 s each)
= ~52.6 s. Held tails on intro / outro bring to ~60 s. Cross-fades
implemented as opacity envelopes per `<Sequence>` (no
`@remotion/transitions` dep — keeps the surface inspectable; same approach
as the toolchain smoke).

### Storyboard — Cut B (tight, 30 s)

Drops scene 3 (DS preview) and scene 7 (comments) entirely. Keeps the
canonical "install → see canvas → iterate → docs" arc under GitHub's
10 MB cap.

| # | Cut A # | Scene | Slot | Caption |
|---|---------|-------|------|---------|
| 1 | 1 | Intro | 2.5 s | `maude. design + workflow for Claude Code.` |
| 2 | 2 | Install + init + serve | 4.0 s | `One command to install. One to scaffold.` |
| 3 | 4 | Canvas reveal | 4.0 s | `Multi-artboard canvas. Real code.` |
| 4 | 5 | Canvas hero + Cmd+Click | 6.5 s | `Cmd+Click any element.` |
| 5 | 6 | Edit moment + HMR | 7.0 s | `Edit a file. Canvas reloads in place.` |
| 6 | 8 | Docs teaser | 2.5 s | `Docs at maude.sh.` |
| 7 | 9 | Outro | 3.0 s | `npm i -g @1agh/maude` |

Wall-clock: 29.5 s − 6 cross-fades × 9-frame overlap = ~27.7 s. Held tail
on outro brings to 30 s.

### Captions discipline

Per [no AI-tell punctuation] memory: ASCII hyphens only, straight quotes,
three periods if needed (never ellipsis char), interpunct (`.`) OK only in
stamps. **One caption per scene; held through any sub-beats.**

### Scratch project

- Path: `/tmp/scratch-maude-demo-$(date +%Y%m%d)/`
- Brief for setup-ds: `"Recipe manager kde nastavíš počet porcí a on
  přepočítá ingredience. Pro mě a 3 kamarády. Vibe: 80s cookbook,
  Berkeley-mono everywhere, hard-edges + amber-rust stamp accent."`
  (The brief is intentionally lineage-loaded so Stage 1 has enough to skip
  P1/P5/P10 — produces the recognisable `→ Skipping P<N>` print pattern, in
  case we capture skill output to a log file for the storyboard.)
- Canvas for new: `Recipe Recap` — `"Multi-artboard hero + portion scaler
  + ingredient list + cookbook print preview"`.
- Edit feedback: `"tighten the hero, drop one row from the metadata
  block"` — produces a small, readable diff suitable for HMR demonstration.

### Dev-server lifecycle

The scratch dev-server runs on a **separate port** (`--port 4400`) so this
repo's running instance on 4399 is undisturbed. Lifecycle:

```sh
PORT=4400 bash plugins/design/dev-server/bin/server-up.sh \
  --root /tmp/scratch-maude-demo-$(date +%Y%m%d) \
  --port 4400
```

All marketing Playwright specs target `localhost:4400`. Smoke tests and
this repo's own dev-server stay on 4399.

### Components (Remotion cards, from project DS tokens)

Same as prior attempt; carry forward without changes:

| Component | Source | Notes |
|-----------|--------|-------|
| `IntroCard.tsx` | new | Wordmark + tagline. Spring entrance over 18 frames, hold, 18-frame fade. |
| `OutroCard.tsx` | new | Mono install command + GitHub URL. Accent underline wipes L→R. |
| `LowerThird.tsx` | new | Reusable caption strip, 50% accent plate, fontsize 44. |
| `tokens.ts` | new | Mirror of active DS `colors_and_type.css` (light + dark tracks, accent oklch 56% 0.170 50). |

---

## Tasks

Execute in order. Each task is atomic and testable. **Tasks 0–4 are
preparation; Tasks 5–8 capture the green-field project; Tasks 9–14 produce
and ship.**

### Task 0 — GATE: Phase 15 toolchain green

- **Do:** Confirm `pnpm run video:smoke` exits 0 against the current branch.
- **Validate:** Exit code 0.

### Task 1 — CREATE storyboard + music script + .gitignore

- **Do:**
  1. Write `scripts/video/storyboard.md` with both cut tables, ASCII-clean
     captions, music license slot (URL TBD).
  2. Write `scripts/video/download-music.sh` — idempotent curl to
     `scripts/video/.cache/music.mp3`, accepts URL as arg or `$MUSIC_URL`.
  3. Confirm `scripts/video/.gitignore` already ignores `.cache/` and
     `.work/`.
- **Gotcha:** Music v1 may be silent — the cut works without music.
  Storyboard documents that fallback.
- **Validate:** Storyboard reads cleanly; `bash download-music.sh
  --force-validate` (no URL) prints actionable error.

### Task 2 — CREATE Remotion brand cards

- **Do:**
  1. `scripts/video/cards/tokens.ts` — mirror the active DS values from
     `.design/system/project/colors_and_type.css` (light + dark tracks,
     accent `oklch(56% 0.170 50)`, mono `"Berkeley Mono", "JetBrains Mono",
     "SF Mono", Menlo, Consolas, monospace`).
  2. `cards/IntroCard.tsx` — 1920×1080, 75 frames @ 30 fps, spring
     entrance, hold, fade-out. SKU stamp top-left
     (`MDCC-MKT/00 . THE CATALOG . v0.15.0`), wordmark "maude." centered,
     tagline below, bottom catalog strip
     (`github.com/1aGh/maude . 2 plugins . 1 CLI . zero telemetry .
     published 2026-05-20`).
  3. `cards/OutroCard.tsx` — 1920×1080, 90 frames, install command in
     mono with hard-edge border, accent underline wipe L→R, secondary
     line (`github.com/1aGh/maude . docs at maude.sh`).
  4. `cards/LowerThird.tsx` — utility component (NOT registered).
     Bottom-centered pill with 88% accent plate, fontsize 44, 6-frame
     fade-in + 6-frame fade-out scoped to its parent `<Sequence>` via a
     `durationInFrames` prop.
  5. `cards/index.tsx` — `registerRoot` for IntroCard + OutroCard only.
     **Do NOT re-export LowerThird here** — re-exporting triggers a
     second `registerRoot` from `Final.tsx`'s import path. Final imports
     `LowerThird` directly from `cards/LowerThird.tsx`.
  6. `cards/remotion.config.ts` — pixel format yuv420p, codec h264,
     crf 23.
- **Gotcha:** Strip em/en dash, curly quotes, ellipsis char from card
  copy. ASCII only.
- **Validate:**
  - `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard
    /tmp/intro.mp4 --mute --log=error` exits 0; ffprobe reports 2.50 s.
  - Same for OutroCard → 3.00 s.
  - Extract frame 30 from each — manual visual sanity (wordmark renders,
    underline visible).

### Task 3 — CREATE capture-surface scaffolding

- **Do:**
  1. Make dirs: `scripts/video/{tapes,playwright,final,lib}`.
  2. `lib/server-up.sh` — thin wrapper that exec's
     `plugins/design/dev-server/bin/server-up.sh` with `--root` + `--port`
     args, prints resolved port on stdout. Default port `4400` when called
     from this script; do NOT clobber this repo's `4399`.
  3. `lib/normalize.sh` — `ffmpeg ... scale=1920:1080
     ... force_original_aspect_ratio=decrease ... pad ... fps=30 ...
     format=yuv420p ... libx264 crf 20 ... -an`. One source → one
     normalised MP4.
  4. `lib/make-placeholders.sh` — for each scene file expected by
     `final/scene-source.ts` that's missing, generate a 1920×1080 black
     MP4 of slot duration. Lets `Final.tsx` render with placeholders
     even mid-pipeline.
  5. `playwright/playwright.config.ts` — absolute `outputDir` via
     `import.meta.url`, viewport 1920×1080, `video: { mode: 'on',
     size: { width: 1920, height: 1080 } }`, 60 s timeout per spec.
- **Validate:** `bash lib/server-up.sh --port 4400 --root /tmp` does NOT
  affect the running 4399 instance. `bash lib/make-placeholders.sh`
  produces placeholder MP4s of correct duration.

### Task 4 — RENDER Scene 1 (intro) + Scene 9 (outro)

- **Do:**
  1. `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard
     scripts/video/.work/scenes/01-intro.mp4 --mute`.
  2. Same for OutroCard → `09-outro.mp4`.
- **Validate:** `ffprobe ... -show_entries format=duration` returns
  `2.50...` and `3.00...` respectively. Visual sanity on extracted
  frames.

### Task 5 — BOOTSTRAP green-field scratch project

> This is the **load-bearing real-work task**. The agent (executing this
> plan) drives a full `/design:setup-ds` + `/design:new` + `/design:edit`
> cycle against the scratch dir before any recording happens. The scratch
> dir is the input to every Playwright spec.

- **Do:**
  1. `SCRATCH=/tmp/scratch-maude-demo-$(date +%Y%m%d); rm -rf "$SCRATCH"
     && mkdir -p "$SCRATCH"`.
  2. `cd "$SCRATCH" && node /Volumes/D/git/claude-design/cli/bin/maude.mjs
     init --name recipe-recap` — produces `.ai/`, `package.json`,
     `CLAUDE.md`, `.gitignore`, etc.
  3. **Drive `/design:setup-ds project "<brief>"`** from this Claude
     session against the scratch dir. The slash command's skill
     (`plugins/design/skills/design-system/SKILL.md`) runs in this
     session; the target dir is the scratch dir. Drive the 3-stage
     discovery (Vision → Research → Refinement) end-to-end. Produces
     a real `.design/system/project/` with `colors_and_type.css`,
     `_components.css`, `README.md`, and preview specimens.
  4. **Drive `/design:new "Recipe Recap" "<brief>"`** similarly. The
     command spawns `frontend-design` for envelope construction +
     generation. Produces `.design/ui/Recipe Recap.tsx` with at least
     4 artboards (RR-01-hero / RR-02-scaler / RR-03-ingredients /
     RR-04-print).
  5. **Drive `/design:edit "tighten the hero, drop one row from the
     metadata block"`** to produce one captured iteration. The edit
     must be small enough that the resulting diff is readable in a
     7-second window (Scene 6).
  6. Seed `.design/_comments/recipe_recap.json` with **1 resolved + 1
     open-with-reply** thread anchored to stable `[data-cd-id]` values
     from the canvas. Use the same schema as
     `plugins/design/dev-server/comments-overlay.tsx` `OverlayComment`
     interface.
  7. **Take screenshots of each artifact** for inclusion in the
     execution report — confirm Stage 0/1/2/3 prints landed, DS
     specimens render, canvas renders multi-artboard, edit produced a
     visible diff, comments seed loads in dev-server.
- **Pattern:** This task is the "agent-driven" part. The agent runs the
  real slash commands; the marketing video then captures the
  **resulting state**, not the commands themselves.
- **Gotcha:**
  - The agent **does not** need to use `claude --print` or spawn a
    nested Claude. The slash commands ARE dispatched in this session
    (which is itself a Claude session running this plan). The scratch
    dir is just a different `CLAUDE_PROJECT_DIR`-equivalent path that
    the design plugin's skills can target.
  - If a skill step requires `AskUserQuestion` (Stage 0 scope picker,
    Stage 3 refinement picks), the agent makes the picks itself based
    on the brief — these are agent-judgement-calls, not user gates,
    in this execution context. Document the picks in the execution
    report so the recording's caption text matches.
  - `/design:edit` writes a snapshot to `.design/_history/<slug>/`.
    Keep both before/after versions so Scene 6 can show the diff.
- **Validate:**
  - `ls "$SCRATCH/.design/system/project/preview/"` lists at least 6
    specimens.
  - `ls "$SCRATCH/.design/ui/"` shows `Recipe Recap.tsx` +
    `Recipe Recap.meta.json`.
  - `ls "$SCRATCH/.design/_history/recipe-recap/"` has the
    pre-edit snapshot.
  - `cat "$SCRATCH/.design/_comments/recipe_recap.json" | jq length`
    returns `2`.

### Task 6 — BOOT scratch dev-server on port 4400

- **Do:** `bash scripts/video/lib/server-up.sh --root "$SCRATCH"
  --port 4400`. Confirm `curl -sf
  http://localhost:4400/_health` returns `{"ok":true}` and that the
  existing dev-server on 4399 is undisturbed.
- **Gotcha:** Two dev-servers in the same OS — they must NOT both
  write to the same `.design/_server.json` or `_active.json`. The
  scratch dir has its own `.design/_server.json`; this repo's is
  separate.
- **Validate:** Both ports return `{"ok":true}`.

### Task 7 — RECORD Scene 2 (install + init + serve) via VHS

- **Do:** Write `scripts/video/tapes/01-install-init-serve.tape`:
  ```
  Output scripts/video/.work/scenes/02-install-init-serve.mp4

  Set FontSize 20
  Set Width 1920
  Set Height 1080
  Set Framerate 30
  Set Theme "Dracula"

  Type "cd /tmp/scratch-maude-demo-$(date +%Y%m%d)"  # use a stable scratch path
  Sleep 200ms
  Enter
  Sleep 400ms

  Type "npm i -g @1agh/maude"  # real install
  Sleep 200ms
  Enter
  Sleep 2.5s

  Type "maude init --name recipe-recap"  # real CLI
  Sleep 200ms
  Enter
  Sleep 1.5s

  Type "maude design serve --port 4400"  # real CLI, server already running so this is a no-op message
  Sleep 200ms
  Enter
  Sleep 1.5s
  ```
- **Pattern:** The tape **stops before any slash command**. Viewer sees
  the install path that genuinely exists in zsh; the rest of the journey
  happens in the browser (Scenes 3–8).
- **Gotcha:** If `npm i -g @1agh/maude` takes too long in the real run,
  the tape can be tightened — drop the `npm i` line and start at
  `maude init` (assume install already done; the install URL stays in
  the OutroCard caption).
- **Validate:** `vhs scripts/video/tapes/01-install-init-serve.tape`
  produces an MP4 of duration ≥ 6.0 s.

### Task 8 — CAPTURE Scenes 3, 4, 5, 6, 7, 8 via Playwright (all against scratch dev-server on port 4400)

> All six browser scenes are authored as separate spec files. Each spec
> bumps initial wait to **2.8 s** before any interaction — canvas-shell
> needs Bun.build compile + React mount + world layout before first
> paint (~2 s) and the prior attempt's 800 ms wait produced black
> frames.

- **Do (Scene 3 — `03-ds-reveal.spec.ts`):**
  - `await page.goto(<preview-specimen>, { waitUntil: 'networkidle' })`
    for each of 4 specimens, hold 1.5 s each.
  - Specimens to flip: `colors-accent`,
    `colors-themes-side-by-side`, `components-buttons`,
    `components-callout`. Confirm presence in scratch's
    `.design/system/project/preview/` first.
- **Do (Scene 4 — `04-canvas-reveal.spec.ts`):**
  - `goto(<canvas-shell URL with canvas=ui/Recipe Recap.tsx>)`,
    `waitForTimeout(2800)`. Soft horizontal pan via
    `page.mouse.wheel(40, 0)` × 8 iterations with 110 ms between.
- **Do (Scene 5 — `05-canvas-hero.spec.ts`):**
  - Pan/zoom (wheel events). Then `keyboard.down('Meta')` + slow
    hover sweep + click. Hold final frame for 1 s.
- **Do (Scene 6 — `06-edit-hmr.spec.ts`):**
  - Page already loaded showing the **pre-edit** Recipe Recap canvas
    (this spec runs BEFORE we apply the edit).
  - In the same spec, after recording ~5 s of the pre-edit state, the
    spec writes an `edit-marker.txt` file at a known path — the
    pipeline orchestrator picks this up, runs the agent-driven edit
    against the scratch canvas, and the HMR broadcast triggers a live
    reload that Playwright continues recording for ~3 s.
  - Alternative if file-watching coordination is too tricky: pre-edit
    the canvas before the spec runs, but capture the canvas iframe at
    a moment of HMR reload triggered by `touch
    .design/ui/Recipe\ Recap.tsx` from outside the spec. Document the
    chosen approach in the execution report.
- **Do (Scene 7 — `07-comments.spec.ts`):**
  - Goto canvas, `waitForTimeout(2800)`, press `c` for comment-tool
    mode, click an empty artboard area to open composer, type text,
    submit (with `click({ force: true })` since the submit button can
    fall outside the 1920×1080 viewport when canvas-shell renders
    sub-region). Then click the new pin to open the thread, type
    `@` to surface the mention popup, Arrow-down + Enter to pick a
    committer, type more reply text, submit. Finally click an
    existing pin, find the Resolve button via
    `:has-text('resolve')`, click it. Hold 1.5 s.
  - **Selectors confirmed in canvas-lib.tsx:** `.cm-pin`,
    `.cm-composer`, `.cm-composer__textarea`, `.cm-thread`,
    `.cm-thread__reply-textarea`, `.cm-mention-popup`,
    `.cm-btn.cm-btn--primary`.
- **Do (Scene 8 — `08-docs.spec.ts`):**
  - Prefer `pnpm --filter site dev` on port 4398; fall back to
    canvas-shell `Docs Site.tsx` mock. Soft scroll + 2 s hold.
- **Do (transcode step):** All `.webm` outputs are normalized via
  `lib/normalize.sh` to 1920×1080 30fps H.264 yuv420p no-audio MP4.
  **Crop step:** if a canvas-shell render fills only the upper-left
  sub-region of the viewport (observed in prior attempt — canvas-shell
  inner iframe is sized to a fixed width independent of viewport),
  apply `crop=960:540:0:0,scale=1920:1080:flags=lanczos` to fill the
  frame. Decide per-scene; brand cards / VHS tapes / real `site/`
  docs use full-frame, no crop.
- **Gotcha:**
  - 2.8 s initial wait is non-negotiable. Anything shorter produces
    black frames per the prior attempt.
  - Playwright's video continues recording even when the spec throws.
    Use `.click({ force: true }).catch(() => {})` for any
    interaction that might land outside the viewport — the recording
    is more valuable than the test pass.
  - The dev-server's canvas-shell renders the canvas world inside an
    iframe with **fixed pixel dimensions** at first paint. Width is
    not viewport-relative until pan/zoom interactions resize. Hence
    the crop step for scenes 3–7.
- **Validate:** Each scene produces a normalized 1920×1080 MP4 with
  visible content (not 8.6 KB black-only). Frame extraction at the
  mid-point shows the expected UI.

### Task 9 — COMPOSE Final.tsx + Final30.tsx + render + post-process

- **Do:**
  1. `final/scene-source.ts` — declare every scene path. Paths are
     relative to `--public-dir scripts/video/.work` (required CLI
     flag — `Config.setPublicDir(...)` in `final/remotion.config.ts`
     does NOT take effect for non-root entries; the CLI flag is
     authoritative — see DDR).
  2. `final/SceneClip.tsx` — `<Video src={src} startFrom?={n}
     muted />` inside `<AbsoluteFill>`. Optional `debugLabel` prop
     for authoring; unset for final renders.
  3. `final/Final.tsx` — 1800 frames (60 s @ 30 fps), 1920×1080.
     Sequenced scenes with 9-frame opacity-envelope cross-fades.
     `LowerThird` overlay per scene with caption. Audio bed
     optional.
  4. `final/Final30.tsx` — 900 frames (30 s @ 30 fps), drops scene 3
     + 7, same shape otherwise.
  5. `final/index.tsx` — `registerRoot` with both compositions.
  6. Render:
     ```sh
     pnpm exec remotion render scripts/video/final/index.tsx Final \
       site/public/demo.mp4 \
       --codec=h264 --crf=23 \
       --public-dir scripts/video/.work
     pnpm exec remotion render scripts/video/final/index.tsx Final30 \
       site/public/demo-30s.mp4 \
       --codec=h264 --crf=23 \
       --public-dir scripts/video/.work
     ```
  7. Loudnorm: only if music bed exists; skip if silent.
  8. Poster: `ffmpeg -y -i site/public/demo.mp4 -vf "select=eq(n\\,30)"
     -vframes 1 -q:v 2 site/public/demo-poster.jpg`.
- **Gotcha:**
  - `cards/index.tsx` must NOT re-export `LowerThird` — re-exporting
    triggers a duplicate `registerRoot` from Final's bundler reach.
    Final imports `LowerThird` directly from
    `cards/LowerThird.tsx`.
  - The 9-frame fade-in / fade-out envelope must NOT exceed half the
    scene's slot duration for the shortest scene (intro = 75 frames;
    9-frame envelope is fine). If a scene drops below 30 frames the
    envelope eats it.
- **Validate:**
  - `ffprobe -v error -show_entries format=duration,size -of
    default=nw=1 site/public/demo.mp4` → duration 60.00 ± 0.5,
    size < 16 MB.
  - Same for `demo-30s.mp4` — duration 30.00 ± 0.5, size < 10 MB.
  - Extract frames at 1 s, 12 s, 24 s, 36 s, 48 s, 58 s — each shows
    visible content (no all-black sample frames at non-fade
    boundaries).

### Task 10 — UPDATE `site/` landing to embed primary cut

- **Do:**
  1. Create `site/components/mdcc/demo-video.tsx` — client component
     with autoplay muted loop playsinline, prefers-reduced-motion
     pause via useEffect + matchMedia.
  2. Insert `<DemoVideo />` in `site/app/(home)/page.tsx` as a new
     `.mdcc-demo-section` between `.mdcc-hero` and `.mdcc-cat-grid`.
  3. Add `.mdcc-demo-section` + `.mdcc-demo-video` styles to
     `site/app/global.css` — aspect-ratio 16/9, `border: var(--rule-default)`,
     `background: var(--bg-1)`, `<video>` `object-fit: cover`.
- **Gotcha:** `playsInline` is required for iOS autoplay. `muted` is
  required for autoplay everywhere.
- **Validate:** `pnpm --filter @maude/site build` exits 0. Manual:
  `pnpm --filter @maude/site dev`, open `localhost:3000`, confirm
  autoplay + loop + reduced-motion pause.

### Task 11 — UPDATE `README.md` to embed tight cut

- **Do:**
  1. Below H1, add a `<video src="..." controls muted playsinline
     width="800">` tag pointing at the GitHub release asset URL
     (`https://github.com/1aGh/maude/releases/latest/download/demo-30s.mp4`).
  2. Add a one-line link to the docs landing for the full cut.
  3. Add a `<!-- comment -->` block above the video tag with the
     repro command (`gh release create demo-assets-vX.Y.Z ...`).
- **Gotcha:** README on npm WILL NOT render the video. Acceptable —
  the GitHub embed is the goal.
- **Validate:** Open the GitHub PR / commit preview — `<video>` tag
  renders inline once the release asset is uploaded.

### Task 12 — VERIFY npm publish hygiene

- **Do:** Write `scripts/check-publish-size.sh`:
  - Runs `npm pack --dry-run --json | jq ...` and asserts:
    - Tarball size < 2 MB (current baseline ~1.04 MB; 2 MB ceiling
      gives 1 MB headroom for normal growth).
    - No file in `files[].path` matches `demo(-30s)?\.mp4` or
      `scripts/video/`.
- **Validate:** `bash scripts/check-publish-size.sh` exits 0.

### Task 13 — UPDATE scripts/video/README.md with the green-field pipeline

- **Do:** Append a "Marketing pipeline" section describing:
  - Scratch project bootstrap (Task 5) — what the agent does before
    recording.
  - Per-scene re-record commands.
  - Render commands for both cuts.
  - The 2.8 s initial-wait constraint for Playwright canvas-shell
    scenes.
  - The optional crop step for canvas-shell sub-region scenes.
- **Gotcha:** Append; don't rewrite the smoke section.
- **Validate:** A fresh contributor reading the README can re-run the
  whole pipeline without asking.

### Task 14 — RECORD a DDR

- **Do:** Create
  `.ai/decisions/DDR-035-marketing-video-real-green-field-capture.md`
  documenting:
  1. The hard reset away from cinematic terminal casts.
  2. Why no slash command appears in the marketing reel terminal.
  3. The two-port dev-server pattern (4399 for this repo, 4400 for
     scratch).
  4. The 2.8 s wait constraint + crop step for canvas-shell scenes.
  5. `cards/index.tsx` non-re-export discipline.
  6. `--public-dir` CLI flag is authoritative over `setPublicDir(...)`
     for non-root entries.
- **Validate:** DDR follows project schema, cross-linked from this
  plan + from DDR-031.

---

## Cut variants

| Cut | Duration | Embed target | Filename | Size budget |
|-----|----------|--------------|----------|-------------|
| **A — primary** | ~60 s | `site/` landing | `site/public/demo.mp4` | < 16 MB |
| **B — tight** | 30.0 s | GitHub README | `site/public/demo-30s.mp4` | < 10 MB |

Both cuts share the same scene library + captions + brand cards.

---

## Validation

1. `pnpm run video:smoke` exits 0 (toolchain prereq).
2. Scratch project exists at `/tmp/scratch-maude-demo-<date>/` with a
   real `.design/system/project/`, `.design/ui/Recipe Recap.tsx`, a
   history snapshot, and 2 seeded comments.
3. Scratch dev-server on port 4400 returns `{"ok":true}` at `/_health`.
4. `bash scripts/video/render-all-scenes.sh` exits 0; every scene MP4
   under `scripts/video/.work/scenes/` is > 50 KB (sanity bound — black
   frames are ~8.6 KB).
5. `pnpm exec remotion render ... Final ...` produces `site/public/demo.mp4`
   at ~60.0 s and < 16 MB.
6. Same for `Final30` → `demo-30s.mp4` at 30.0 s and < 10 MB.
7. Frame samples at 1 s, 12 s, 24 s, 36 s, 48 s, 58 s of the primary cut
   all show visible content.
8. `cd site && pnpm dev` → `localhost:3000` autoplays the primary cut
   muted, loops, respects reduced-motion.
9. `bash scripts/check-publish-size.sh` exits 0.
10. Manual: watch the primary cut on a retina screen at native 1080p.
    Read captions. Confirm: **no Claude TUI is visible**, **no slash
    command is typed in a shell**, every terminal frame shows zsh +
    real CLI output, every browser frame shows the live scratch
    dev-server.

---

## Scenario Coverage (UI tasks)

The video embed in `site/` and the README IS a UI change. Scenarios:

| Scenario | Covers | Status |
|----------|--------|--------|
| `site-landing-video-autoplay` | landing autoplays muted, loops | 🆕 new |
| `site-landing-reduced-motion` | reduced-motion pauses | 🆕 new |
| `readme-video-loads` | GitHub release asset HTTP 200 | 🆕 new |

---

## Acceptance Criteria

- [ ] All tasks 0–14 completed.
- [ ] **Scratch project bootstrapped end-to-end before any recording
      starts** — `.design/system/project/`, `.design/ui/Recipe Recap.tsx`,
      `.design/_history/`, `.design/_comments/recipe_recap.json` all
      exist and the dev-server on port 4400 renders them.
- [ ] **Zero Claude TUI frames in either cut.**
- [ ] **Zero `/design:*` slash commands typed in any terminal scene.**
      Terminal scenes only show real shell-runnable CLI: `npm i`,
      `maude init`, `maude design serve`.
- [ ] `site/public/demo.mp4` exists, ~60.0 s, < 16 MB, H.264 yuv420p.
- [ ] `site/public/demo-30s.mp4` exists, 30.0 s, < 10 MB.
- [ ] `site/public/demo-poster.jpg` exists.
- [ ] Site build green; landing autoplays + loops + reduced-motion
      pauses.
- [ ] README `<video>` tag wired to the release asset URL.
- [ ] `npm pack --dry-run` does NOT include any MP4 or
      `scripts/video/` path.
- [ ] DDR-035 recorded.
- [ ] Music license URL committed (if music is bedded) OR storyboard
      documents the silent-cut decision.
- [ ] All captions ASCII-only per [no AI-tell punctuation] memory.
