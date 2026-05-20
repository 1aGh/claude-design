# Feature: Marketing Demo Video — ~55s agent-orchestrated showreel (+ 30s tight cut)

> **Toolchain prerequisite (2026-05-20):** This plan assumes
> [`phase-15-video-pipeline-toolchain.md`](./archive/phase-15-video-pipeline-toolchain.md)
> has been run and `pnpm run video:smoke` exits 0. Do not run this plan against
> a cold toolchain — the install gates (ffmpeg, vhs, Playwright Chromium,
> Remotion license ack) live there and the per-tool smokes are the ladder. This
> plan composes the real scenes on top of that proven base.
>
> Refactored: the original bash ladder (HTML cards + render-card.mjs,
> record-scene.sh, custom xfade math + drawtext + 2-pass loudnorm) is replaced
> by VHS tapes (terminal scenes), Playwright specs (browser scenes), Remotion
> compositions (cards + final assembly). Net result: ~50–60% less custom code.
> See `scripts/video/README.md` for the toolchain runbook.
>
> **Scope revision 2026-05-20:** target duration grew from 30s → ~55s primary cut
> to cover the full lifecycle that shipped between 2026-05-12 and 2026-05-20:
> `/design:setup-ds` 3-stage discovery (Vision → Research → Refinement, commit
> 2c90eb1) and in-place FigJam-style comments (pins + composer + thread popover
> + @mention autocomplete, commit 462e95b). The 30s tight cut survives as
> "Cut B" — see `## Cut variants` — for surfaces with autoplay-length
> constraints (GitHub READMEs, social previews). Filename retains `-30s` for
> git continuity; ignore it.

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Produce a ~55-second 16:9 marketing/showcase video for `maude` that the agent (me) produces **end-to-end without human edits in a video editor**. The video stitches real screen recordings of the design plugin dev-server UI, the docs site (`site/`), and the Claude Code terminal flow, overlaid with infographic "title cards" and burned-in captions, scored with a royalty-free instrumental bed. Final artifact lives in `site/public/demo.mp4` (primary cut) + `site/public/demo-30s.mp4` (tight cut for GitHub README + social) and is embedded into both the docs landing page and `README.md`.

The agent orchestrates **every** step: spawns the dev-server, drives terminal scenes through VHS `.tape` files, drives browser scenes through Playwright specs (Cmd+Click inspector, comment-pin workflow, docs scroll), produces infographic frames as Remotion compositions, downloads music via WebFetch/curl, and assembles everything inside one Remotion `Final` composition with `@remotion/transitions` xfades.

## User Story

As a **prospective Maude user** landing on the docs site or GitHub README, I want a **under-one-minute visual demo** so that I can grasp the full canvas-first design lifecycle — `maude init` → `/design:setup-ds` (3-stage discovery) → `/design:new` (multi-artboard canvas) → live dev-server with Cmd+Click inspector → `/design:edit` iteration → in-place FigJam-style comments → docs — **without reading a wall of text or installing anything**.

## Problem

- README and docs explain features verbally; there is no visual "show, don't tell" surface.
- Onboarding friction is high — users have to install the marketplace + run a flow before they see the dev-server UI, which is the visually striking part. The two highest-leverage features (`/design:setup-ds` 3-stage discovery and in-canvas comments) only reveal themselves after a non-trivial setup.
- Social/share previews currently fall back to text snippets.

## Solution

A primary ~55-second muted-friendly MP4 (autoplay-safe) with:
- 9 scenes, captions burned in for clarity without audio,
- Royalty-free instrumental bed (Pixabay/CC0) at -18 LUFS,
- 16:9 1920×1080 H.264, target < 14 MB so it embeds cleanly into the Next.js landing and the Vercel CDN; a sibling 30s tight cut < 8 MB (GitHub's video upload limit at 10 MB) lives at `site/public/demo-30s.mp4` for the README embed.

Every recording, transition, caption, and mix is produced by Bash + Remotion + VHS + Playwright + ffmpeg — reproducible, scriptable, no Final Cut.

## Metadata

- **GitHub Issue**: n/a (internal initiative)
- **Type**: New Capability (marketing artifact + agentic video pipeline)
- **Complexity**: High — first agentic video production in this repo; multi-tool orchestration (VHS, Playwright, Remotion, ffmpeg); macOS-only capture path
- **App/Package**: `site/` (embed target) + `scripts/video/` (pipeline) + `.design/` (canvas content recorded)
- **Affected Systems**: Next.js docs site, README, design plugin dev-server, repo build/publish (videos must NOT ship to npm — verify `package.json` `files` excludes them)
- **Dependencies**:
  - Phase 15 toolchain green (`pnpm run video:smoke` exits 0)
  - Pixabay royalty-free music asset (download once, gitignored cache; license URL pinned in `storyboard.md`)
  - Existing canvases: `.design/ui/Canvas Viewport.tsx`, `.design/ui/Docs Site.tsx` (used as hero shots)
  - A demo `.design/` workspace seeded with at least one canvas that has resolvable comment threads (pins + replies) for Scene 7 — see Task 0.5.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/server.mjs` — Why: confirms `--root` arg + `/_health` + WebSocket inspector contract; Scenes 5–7 all depend on this server being live and seeded against `.design/`.
- `plugins/design/dev-server/bin/screenshot.sh` — Why: prior art for agent-driven capture; the fallback ladder pattern (primary tool → secondary tool) is mirrored by VHS → Playwright → Remotion in our video pipeline.
- `plugins/design/dev-server/bin/server-up.sh` — Why: lifecycle helper to ensure server is healthy before recording; the video pipeline must invoke this, not start a duplicate.
- `plugins/design/commands/setup-ds.md` — Why: Scene 3 records the live 3-stage discovery flow. The command's documented Stage 0 / 1 / 2 / 3 ordering + the `→ Skipping P<N> (covered in brief)` line shape is what the on-screen text needs to show for the scene to read as authentic.
- `plugins/design/commands/new.md` — Why: Scene 4 records `/design:new` envelope generation. Note the default `--perfect` loop is verbose — for the video we want `--quick` so the scene fits in 6 s without speed-ramping past readability.
- `plugins/design/commands/edit.md` — Why: Scene 6 records `/design:edit "<feedback>"`. The dev-server's HMR broadcast → iframe hard reload is what makes the split-screen reload moment land; pin the reload moment via `_active.json.last_change`.
- `plugins/design/dev-server/canvas-lib.tsx` (search for `commentPin`, `composer`, `thread`) — Why: Scene 7 drives the comment overlay (commit 462e95b). The Playwright spec needs the actual DOM selectors / class names produced by the in-iframe overlay (`.dgn-comment-pin`, `.dgn-comment-composer`, `.dgn-thread-popover`, `.dgn-mention-autocomplete` — confirm exact names).
- `.design/ui/Canvas Viewport.tsx` + `.design/ui/Canvas Viewport.css` — Why: Scene 5 hero shot. Confirm it renders cleanly fullscreen before recording.
- `.design/ui/Docs Site.tsx` — Why: Scene 8 fallback if real `site/` looks too WIP at recording time.
- `site/app/(home)/page.tsx` — Why: embed location for the final primary cut.
- `README.md` lines 1-50 — Why: embed location for the 30s tight cut (GitHub `<video>` tag).
- `package.json` `files` array — Why: must verify both demo MP4s are NOT in the npm publish set.

### Files to Create

- `scripts/video/storyboard.md` — Frozen scene-by-scene script for **both cuts** (primary ~55s + tight 30s). Single source of truth.
- `scripts/video/tapes/*.tape` — VHS scripts for terminal scenes (init, setup-ds, new, edit-left).
- `scripts/video/playwright/*.spec.ts` — Playwright specs for browser scenes (canvas hero, edit-right, comments, docs).
- `scripts/video/cards/{IntroCard,OutroCard,LowerThird}.tsx` + `cards/index.tsx` + `cards/tokens.ts` — Remotion compositions for intro / outro / reusable lower-third caption strip.
- `scripts/video/final/Final.tsx` + `final/Final30.tsx` + `final/index.tsx` — Two Remotion compositions sharing the same scene library; `Final` is the ~55s primary, `Final30` is the 30s tight cut.
- `scripts/video/render-all-scenes.sh` — Orchestrates VHS + Playwright captures + per-scene normalize (replaces the old `record-scene.sh` + `assemble.sh` bash pair).
- `scripts/video/download-music.sh` — Idempotent fetch of the Pixabay track to `scripts/video/.cache/music.mp3` (gitignored).
- `site/public/demo.mp4` — Primary ~55s cut (committed).
- `site/public/demo-30s.mp4` — Tight 30s cut (committed).
- `site/public/demo-poster.jpg` — Frame 1 of primary cut.
- `.gitignore` entries for `scripts/video/.cache/`, `scripts/video/.work/`.

### Documentation

- VHS docs: https://github.com/charmbracelet/vhs — Why: declarative terminal capture. `Type`, `Sleep`, `Set Theme`, `Set Width/Height` are the four commands every tape needs.
- Playwright video recording: https://playwright.dev/docs/videos — Why: per-test WebM at fixed viewport; we transcode to MP4 in post.
- Remotion `<TransitionSeries>`: https://www.remotion.dev/docs/transitions — Why: declarative xfade between scenes; replaces the ffmpeg xfade offset math.
- Pixabay Music licensing: https://pixabay.com/service/license-summary/ — Why: confirm "Pixabay Content License" = no attribution required, free commercial use. Pin the track URL in `storyboard.md`.
- GitHub video embed in README (10 MB limit): https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files — Why: the 30s tight cut is sized to land under this limit.

### Patterns to Follow

**Server lifecycle (from `server-up.sh`):**
```sh
# Reuse, do NOT reimplement. Both Playwright and the smoke pipeline:
PORT=$(plugins/design/dev-server/bin/server-up.sh)
URL="http://localhost:$PORT/canvas/ui/Canvas+Viewport"
```

**Brand tokens in Remotion cards:**
```ts
// scripts/video/cards/tokens.ts — single shim mirrors the active DS's CSS tokens.
// Regression-checked against .design/system/<active>/colors_and_type.css at lint time.
export const tokens = {
  bg: 'var(--bg, #0e0e10)',         // fallback for non-CSS contexts
  ink: 'var(--ink, #f5f5f0)',
  accent: 'var(--accent, #ff5722)',
  mono: 'var(--font-mono, "JetBrains Mono", monospace)',
} as const;
```

Detect active DS via `jq -r '.designSystems[0].name' .design/config.json` (note: schema changed in 2026-05-12 from `activeDesignSystem` to `designSystems[]`).

---

## Design Decisions

### Storyboard — Cut A (primary, ~60s)

Frozen — see `scripts/video/storyboard.md`. Each scene's raw capture is ~10% longer than its slot to allow trim-in/trim-out cleanup. Scenes **3** and **4** are **hybrid (terminal → browser reveal)**: the terminal half shows the command running, the browser half shows the actual UI artifact the command produced (DS preview specimens for setup-ds, the rendered multi-artboard canvas for /design:new). Without the browser reveal both commands look like log output; with it the viewer sees the real visual payoff.

| # | Sub | Scene | Dur | Capture source | Caption (one per parent scene) |
|---|-----|-------|-----|----------------|--------------------------------|
| 1 | — | Intro card | 2.5s | `Remotion IntroCard` | `maude — canvas-first design + workflow for Claude Code` |
| 2 | — | `maude init` terminal | 3.5s | VHS tape (`02-maude-init.tape`) | `Scaffold .ai/ in one command` |
| 3 | a | `/design:setup-ds` — 3-stage discovery (terminal, **snippet montage**) | 6.0s | 4-5 jump-cut snippets pulled from a full asciinema/VHS recording of one real run — see Task 6 | `Vision → research → refinement` |
| 3 | b | DS scaffold reveal — preview specimens in dev-server | 4.5s | Playwright (`03b-ds-reveal.spec.ts`) | `→ DS scaffolded: tokens, type, components` |
| 4 | a | `/design:new` (terminal, **snippet montage**) | 4.0s | 3 jump-cut snippets from a full recording — see Task 7 | `Brief → multi-artboard canvas` |
| 4 | b | Canvas reveal — fresh multi-artboard opens in dev-server | 4.0s | Playwright (`04b-canvas-reveal.spec.ts`) | `→ Recipe Recap, 4 artboards, live` |
| 5 | — | Canvas hero — Cmd+Click inspector | 7.5s | Playwright (`05-canvas-hero.spec.ts`) | `Live canvas, Cmd+Click any element` |
| 6 | — | `/design:edit "tighten the hero"` split-screen | 9.0s | Composite: VHS left (`06-edit-left.tape`) + Playwright right (`06-edit-right.spec.ts`) — composed in Remotion, not ffmpeg `hstack` | `One feedback string → diff + auto-reload` |
| 7 | — | In-place comments — pin → composer → @mention → reply → resolve | 12.0s | Playwright (`07-comments.spec.ts`) | `In-place comments — FigJam style, anchored to elements` |
| 8 | — | Docs teaser | 3.5s | Playwright (`08-docs.spec.ts`) on real `site/` localhost | `Docs at maude.iagh.cz` |
| 9 | — | Outro CTA | 3.0s | `Remotion OutroCard` | `npm i -g @1agh/maude · github.com/1aGh/maude` |

**Wall-clock total:** sum of sub-durations 59.5s − 10 xfades × 300 ms = **~56.5s**. Round to **60.0s** with held tails on the intro / outro cards. Within each hybrid scene (3, 4) the terminal→reveal handoff is a quick 150 ms cut (not a 300 ms xfade) so the viewer reads it as "the command finished, now look at the result" rather than two unrelated beats.

### Snippet montage principle (scenes 3a, 4a, 6-left)

Agent runs (especially `/design:setup-ds` 3-stage discovery and `/design:new --perfect`) take **minutes**, not seconds. Compressing a multi-minute run into a 4-6s slot via `playbackRate=N` produces unreadable, artificial-looking footage (ANSI streams blur, prompts flicker by, the viewer learns nothing). **Better approach: record the full run once, then jump-cut between 3-5 representative beats.** Each beat is shown at 1× speed for 1.0-1.5 s — long enough to read, short enough to keep the scene moving. Jump cuts (no xfade between snippets within a single scene) read as a deliberate montage, like a film trailer; the viewer infers the omitted middle without seeing it slowed down or sped up.

| Scene | Snippets (each 1.0-1.5 s @ 1×) |
|-------|--------------------------------|
| 3a | (1) Stage 1 — first vision prompt + user paste; (2) `→ Skipping P<N> (covered in brief)` lines flash; (3) Stage 2 — three `→ Researching <axis>…` lines in quick succession; (4) Stage 3 — refinement table preview; (5) `✓ Design system project scaffolded at .design/system/project/`. |
| 4a | (1) `/design:new` invocation line; (2) generation log middle (the spinner + 2-3 "→ writing artboard" lines); (3) `→ Canvas created at .design/ui/Recipe Recap.tsx`. |
| 6-left | (1) `/design:edit "tighten the hero"` prompt; (2) mid-stream diff preview lines; (3) `→ Applied, reloading canvas`. Right half (Playwright canvas) plays continuously at 1× — only the left terminal half is snippet-cut. |

Recorded raw via `asciinema rec` (preferred — text-based, easy to cherry-pick by timecode) or via VHS `.tape` with `Hide`/`Show` blocks bracketing the keep-segments. Snippets are stitched in Remotion via `<Sequence from={...} durationInFrames={...}>` against the same source file with different `startFrom` offsets — no separate clip files per snippet.

### Storyboard — Cut B (tight, 30s)

Drops Scene 3 (setup-ds) entirely and Scene 7 (comments) entirely; keeps Scene 4's **hybrid (terminal snippet + canvas reveal)** because the reveal is what tells the viewer what `/design:new` actually produced. Keeps the canonical "install → scaffold → live → iterate → docs" arc under GitHub's 10 MB cap.

| # | Scene (Cut A #) | Dur | Source | Caption |
|---|----------------|-----|--------|---------|
| 1 | (1) Intro | 2.5s | Remotion IntroCard | `maude — design + workflow for Claude Code` |
| 2 | (2) `maude init` | 3.0s | VHS | `Scaffold .ai/ in one command` |
| 3 | (4a + 4b) `/design:new` terminal snippet → canvas reveal | 5.5s (2.5 + 3.0) | snippet montage + Playwright reveal | `Brief → multi-artboard canvas` |
| 4 | (5) Canvas hero | 6.0s | Playwright | `Live canvas, Cmd+Click any element` |
| 5 | (6) `/design:edit` split | 7.0s | snippet montage + Playwright | `One feedback string → diff + auto-reload` |
| 6 | (8) Docs | 2.5s | Playwright | `Docs at maude.iagh.cz` |
| 7 | (9) Outro | 3.0s | Remotion OutroCard | `npm i -g @1agh/maude` |

**Wall-clock total:** 29.5s − 7 xfades × 300 ms = **~27.4s**. Held tail on outro brings it to 30.0s.

### Components (Remotion cards, from project DS tokens)

| Component | Source | Notes |
|-----------|--------|-------|
| `IntroCard.tsx` | new — built fresh | Wordmark + tagline. Spring entrance over 18 frames, hold, 18-frame fade. |
| `OutroCard.tsx` | new — built fresh | Mono install command + GitHub URL. Accent underline wipes L→R via `interpolate()`. |
| `LowerThird.tsx` | new — built fresh | Reusable caption overlay, 50% accent-plate behind text, fontsize 44. Used by every scene via `<Sequence>` inside `Final` / `Final30`. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
|----------------|--------|-------|
| Canvas Viewport | `.design/ui/Canvas Viewport.tsx` | Hero shot for Scene 5 (Cut A) / Scene 4 (Cut B). Pre-flight: render at 1920×1080 in browser, confirm no console errors. |
| Comment overlay | injected by `canvas-lib.tsx` | Scene 7 (Cut A only). Pre-seed `.design/_comments/<slug>.json` so the canvas already has one resolved thread + one open thread; the spec adds a third pin live. |
| Docs Site mock | `.design/ui/Docs Site.tsx` | Fallback for Scene 8 / Scene 6 if real `site/` looks too WIP. |

### Tokens

| Purpose | Token | Usage |
|---------|-------|-------|
| Card background | `--bg` | intro/outro backgrounds |
| Card text | `--ink` | primary copy |
| Accent / brand pulse | `--accent` | wordmark, animated underline, comment-pin badge |
| Caption strip | `--surface` + `--ink-muted` | lower-third pill |

### Custom Components Needed

| Component | Reason | Extends |
|-----------|--------|---------|
| `Final.tsx` + `Final30.tsx` | Two compositions sharing one scene library, one music bed, one `LowerThird` | Remotion `<Composition>` + `<TransitionSeries>` |
| `render-all-scenes.sh` | Orchestrate VHS + Playwright + normalize step before Remotion ingests | none — new helper |

### Captions discipline

Per [no AI-tell punctuation] memory: **no em dash, en dash, curly quotes, ellipsis char, excess emoji** in any caption or card copy. ASCII hyphens, straight quotes, three periods if needed. Interpunct OK only in stamps like `npm i -g @1agh/maude`.

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 0: GATE — Phase 15 toolchain green

- **Do**: Confirm `pnpm run video:smoke` exits 0 against the current branch. If not, run / finish `phase-15-video-pipeline-toolchain.md` first.
- **Pattern**: Single hard gate; do not start authoring scenes against a broken toolchain.
- **Gotcha**: VHS, Playwright Chromium, and the Remotion license ack are all gated by user grant. Don't re-litigate here — that's the toolchain phase's job.
- **Validate**: `pnpm run video:smoke` exits 0.

### Task 0.5: SEED demo `.design/` workspace for recording

- **Do**:
  1. Use this repo's own `.design/` (the dogfood workspace) — do NOT create a `/tmp/scratch-maude-demo` for the recording surface, because Scene 5 / 6 / 7 want a canvas that already has interesting content.
  2. Confirm `.design/ui/Canvas Viewport.tsx` renders cleanly at 1920×1080 (open in dev-server, check console).
  3. For Scene 7 (comments): pre-seed `.design/_comments/<viewport-slug>.json` with **one resolved thread** + **one open thread (one reply)** anchored to two distinct elements in `Canvas Viewport.tsx`. The Playwright spec then adds a **third** pin live so the viewer sees both pre-existing pins and the new-pin moment.
  4. For Scene 3 (`/design:setup-ds`): the tape runs in a sibling scratch dir (`/tmp/scratch-maude-recording/`) seeded with `maude init` so the discovery scene starts from a clean state. The tape is the only thing that writes to it.
- **Pattern**: Two recording surfaces — this repo's own `.design/` for live-canvas scenes (5/6/7), a clean scratch dir for the install-flow scenes (2/3/4).
- **Gotcha**: Comment-pin coordinates are stored relative to the artboard's bounding box; if the canvas layout changes between seed-time and record-time, pins drift. Pin them to stable element IDs (`data-cd-id`), not absolute pixels.
- **Validate**: Opening the dev-server shows the two seeded pins on `Canvas Viewport`; clicking one opens the thread popover with the seeded reply.

### Task 1: CREATE storyboard + license-anchored music download

- **Do**:
  1. Write `scripts/video/storyboard.md` with **both** scene tables (Cut A primary, Cut B tight), exact timecodes, exact ASCII-clean captions, and the Pixabay track URL + license excerpt.
  2. Pick a track: 60-90s instrumental (long enough for Cut A with headroom), BPM 90-110, "corporate ambient" or "tech inspiration" mood. The 30s tight cut crops the same source; do NOT pick a 30s track and then need a different one for Cut A.
  3. Write `scripts/video/download-music.sh` that `curl`s the track to `scripts/video/.cache/music.mp3`.
  4. Add `scripts/video/.cache/` and `scripts/video/.work/` to `.gitignore`.
- **Gotcha**: Pixabay direct-download URLs require a session cookie since 2024; if the curl fails, fall back to Mixkit (`https://mixkit.co/free-stock-music/`) or Free Music Archive — note the chosen source in storyboard.
- **Validate**: `bash scripts/video/download-music.sh && ffprobe scripts/video/.cache/music.mp3 2>&1 | grep -E "Duration|bit_rate"` — duration ≥ 60s.

### Task 2: CREATE Remotion card compositions

- **Do**:
  1. Scaffold `scripts/video/cards/`:
     - `IntroCard.tsx` — 2.5 s, 1920×1080. Wordmark "maude", tagline "canvas-first design + workflow for Claude Code". Spring entrance (75 frames at 30 fps): opacity 0→1 + 24 px translate over the first 18 frames using `spring()`, hold 39 frames, gentle fade-out over the last 18.
     - `OutroCard.tsx` — 3.0 s, 1920×1080. Install command in mono, GitHub URL, accent-color underline that wipes left→right with `interpolate()` over 30 frames.
     - `LowerThird.tsx` — reusable caption overlay, 50 % accent-plate behind text, fontsize 44, used by every scene via `<Sequence>` from `Final` / `Final30`.
  2. Brand wiring: `scripts/video/cards/tokens.ts` mirrors `--bg`, `--ink`, `--accent`, `--mono-family` values from the active DS's `colors_and_type.css`. Add a lint-time regression check that fails if the CSS source drifts beyond ±2 in any RGB channel.
  3. Register all three in `scripts/video/cards/index.tsx` `registerRoot`.
- **Gotcha**: Per the [no AI-tell punctuation] memory — strip em dash, en dash, curly quotes, ellipsis char from card copy. ASCII only.
- **Validate**:
  - `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard scripts/video/.work/cards/intro.mp4 --mute` succeeds.
  - `ffprobe scripts/video/.work/cards/intro.mp4` reports h264 / 1920×1080 / 30 fps / duration 2.50.
  - Same for `OutroCard` (3.00 s).
  - Color sampling on a single frame matches token `--accent` ± 2 in each RGB channel.

### Task 3: CREATE per-scene capture surfaces

- **Do**:
  1. `scripts/video/raw/` — full **raw recordings** of long-running agent flows (the source material the Remotion compositions snippet-cut from). One file per agent flow:
     - `03a-setup-ds.cast` (asciinema cast of one full `/design:setup-ds project "<brief>"` run — typically 3-6 minutes).
     - `04a-design-new.cast` (asciinema cast of one full `/design:new "Recipe Recap" "..."` run — typically 1-3 minutes; `--perfect` not `--quick` so the discovery beats are visible).
     - `06a-edit.cast` (asciinema cast of one full `/design:edit "tighten the hero"` run — typically 30s-2min).
     Each cast is committed once; re-record only when the on-screen output shape genuinely changes (e.g. new Stage in setup-ds). Snippet selection happens in Remotion (Task 12), not at record time, so a single cast supports many edits to the final cut.
  2. `scripts/video/tapes/` — VHS `.tape` files for **short, deterministic terminal scenes** (no snippet stitching needed):
     - `02-maude-init.tape` (Scene 2 — `maude init` is a sub-second command; record at 1× and pad to 3.5s with a `Sleep` at the end).
     Each tape declares its own `Output`, `Set Framerate 30`, `Set FontSize 18`, `Set Width 1920`, `Set Height 1080`, `Set Theme "Dracula"`.
  3. `scripts/video/playwright/` — Playwright spec files for **browser scenes**:
     - `03b-ds-reveal.spec.ts` (Scene 3b — opens 2-3 DS preview specimens at `<dev-server>/canvas/system/project/preview/*`; see Task 6 for exact specimens).
     - `04b-canvas-reveal.spec.ts` (Scene 4b — opens the freshly-created `<dev-server>/canvas/ui/Recipe+Recap`, gentle pan/zoom over the multi-artboard layout).
     - `05-canvas-hero.spec.ts` (Scene 5 — dev-server canvas + Cmd+Click inspector).
     - `06-edit-right.spec.ts` (Scene 6 right half — canvas auto-reload after edit).
     - `07-comments.spec.ts` (Scene 7 — comment-pin workflow, Cut A only).
     - `08-docs.spec.ts` (Scene 8 — docs site teaser).
     Reuse `scripts/video/smoke/playwright.config.ts` as base.
  4. Helper: `scripts/video/lib/server-up.sh` — thin alias to `plugins/design/dev-server/bin/server-up.sh` so every browser scene pre-flights the dev-server identically. Do NOT duplicate the helper.
- **Pattern**: Two recording tiers — **raw casts** for long agent runs (snippet-cut later), **VHS tapes** for short deterministic commands, **Playwright specs** for browser scenes. Remotion is the compose layer for all three.
- **Gotcha**:
  - asciinema casts default to whatever the terminal's font/colors are at record time — set `TERM=xterm-256color` and use a known font (Menlo 18pt) before recording so re-runs match.
  - For Remotion ingestion, asciinema casts are converted via `agg` (asciinema-agg) to MP4 at 1920×1080 30fps. Add `agg` to the toolchain phase if missing.
  - VHS `Output` rejects absolute paths; Playwright `outputDir` is resolved against config file location — use `import.meta.url`.
- **Validate**: Each cast, tape, and spec is independently producible. `agg --cols 200 --rows 60 --font-size 18 scripts/video/raw/03a-setup-ds.cast scripts/video/.work/raw/03a.mp4` exits 0 and produces a multi-minute MP4 at 1920×1080.

### Task 4: COMPOSE Scene 1 (intro) + Scene 9 (outro)

- **Do**: `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard scripts/video/.work/scenes/01-intro.mp4 --mute` and same for `OutroCard` → `09-outro.mp4`.
- **Validate**: `ffprobe -v error -show_entries format=duration -of csv=p=0 scripts/video/.work/scenes/01-intro.mp4` returns `2.50...`; outro returns `3.00...`.

### Task 5: AUTHOR Scene 2 (`maude init`) as a `.tape`

- **Do**:
  1. Write `scripts/video/tapes/02-maude-init.tape`:
     ```
     Output scripts/video/.work/scenes/02-maude-init.mp4
     Set FontSize 18
     Set Width 1920
     Set Height 1080
     Set Theme "Dracula"
     Type "cd /tmp/scratch-maude-recording && node /Volumes/D/git/claude-design/cli/bin/maude.mjs init && ls .ai"
     Enter
     Sleep 3s
     ```
  2. Run via VHS: deterministic, headless, no Screen Recording permission.
- **Gotcha**: `maude init` colors render via the same ANSI codes VHS captures; if output looks dim, raise contrast via `Set Theme "GitHub"` — no `CLICOLOR_FORCE` needed.
- **Validate**: `vhs scripts/video/tapes/02-maude-init.tape && ffprobe scripts/video/.work/scenes/02-maude-init.mp4` reports duration ≥ 3.5 s.

### Task 6: RECORD Scene 3a (`/design:setup-ds` raw cast) + AUTHOR Scene 3b (DS preview reveal)

- **Do (3a — terminal snippet montage source):**
  1. Run `asciinema rec scripts/video/raw/03a-setup-ds.cast --cols 200 --rows 60` in a clean `/tmp/scratch-maude-recording/` (post-`maude init`). Use Menlo 18pt, `TERM=xterm-256color`. Inside the recording session:
     ```
     claude
     /design:setup-ds project "Je to recept manager kde nastavíš počet porcí a on přepočítá ingredience. Pro mě a 3 kamarády. Chci aby to vypadalo jako kuchařka z 80s, ne jako moderní food app s velkými fotkami."
     ```
     Let the full 3-stage flow play out (3-6 minutes is normal — that's the point of recording once and snippeting later).
  2. Note **snippet timecodes** in `storyboard.md` — the 5 beats listed in the "Snippet montage principle" table above. Each snippet 1.0-1.5s; pick a timecode where the on-screen content is stable and readable (avoid mid-redraw frames).
  3. Convert to MP4 via `agg --cols 200 --rows 60 --font-size 18 scripts/video/raw/03a-setup-ds.cast scripts/video/.work/raw/03a-setup-ds.mp4`. Remotion ingests this single file and pulls each snippet via `startFrom` + `endAt`.
- **Do (3b — DS preview reveal spec):**
  1. Write `scripts/video/playwright/03b-ds-reveal.spec.ts`:
     - Pre-flight: `PORT=$(plugins/design/dev-server/bin/server-up.sh)`.
     - `await page.goto('http://localhost:${PORT}/canvas/system/project/preview/colors-accent', { waitUntil: 'networkidle' });` — hold ~1.2s.
     - `page.goto(...preview/typography-ladder)` — hold ~1.2s.
     - `page.goto(...preview/components-buttons)` — hold ~1.2s.
     - `page.goto(...preview/components-cards)` — hold ~0.9s.
     - Pick whichever 3-4 specimens the actual scaffold writes (grep `.design/system/project/preview/` for `.tsx` files); the goal is **a varied visual sweep** (color swatches → type ladder → button states → card pattern) so the viewer sees "the DS is real and visual, not just config files".
  2. Output a single 4.5s MP4 via Playwright's video config.
- **Pattern**: Snippet montage for the agent run (no artificial speed-up); Playwright tab-switch montage for the visual DS reveal. Both Remotion-composable.
- **Gotcha**:
  - For 3a: if the `→ Skipping P<N>` lines don't show because the brief didn't trigger them, re-record with a more lineage-loaded brief. Don't fake the line in post.
  - For 3b: preview specimen filenames are not stable across DS bootstraps — grep the actual folder after recording 3a to confirm which specimens exist before authoring the spec.
- **Validate**:
  - 3a: `agg ... | ffprobe -` reports duration ≥ 180 s (3 min) so the snippet picker has headroom.
  - 3b: 4.5s ± 200 ms; manual playback confirms at least 3 distinct visual styles flash by (color block + text block + component block).

### Task 7: RECORD Scene 4a (`/design:new` raw cast) + AUTHOR Scene 4b (canvas reveal)

- **Do (4a — terminal snippet montage source):**
  1. Run `asciinema rec scripts/video/raw/04a-design-new.cast` after Task 6's setup-ds completes so the project has a live DS. Inside:
     ```
     claude
     /design:new "Recipe Recap" "Multi-artboard hero + portion scaler + ingredient list + cookbook-style print preview"
     ```
     Use the **default `--perfect`** (not `--quick`) — the critic-loop iterations are visually meaningful, the snippet picker will lift the most readable moments.
  2. Identify 3 snippets per the table above. The middle snippet (generation log) is the trickiest — pick a stable frame where 2-3 `→ writing artboard <name>` lines are visible at once, not one being typed letter-by-letter.
  3. Convert via `agg ... 04a-design-new.cast scripts/video/.work/raw/04a-design-new.mp4`.
- **Do (4b — canvas reveal spec):**
  1. Write `scripts/video/playwright/04b-canvas-reveal.spec.ts`:
     - Pre-flight: dev-server up.
     - `await page.goto('http://localhost:${PORT}/canvas/ui/Recipe+Recap', { waitUntil: 'networkidle' });`
     - Brief opening pan: `page.mouse.wheel(0, -400)` then `page.evaluate(() => document.scrollingElement.scrollTo({ left: 200, top: 100, behavior: 'smooth' }))` — soft motion so the multi-artboard layout reveals progressively.
     - Optional: hover an artboard to surface its title chip.
     - 4s total.
- **Pattern**: Same record-once-snippet-many pattern as Task 6, paired with a Playwright visual reveal.
- **Gotcha**:
  - The actual canvas file path depends on the canvas's name slug. `/design:new "Recipe Recap"` writes to `.design/ui/Recipe Recap.tsx` → URL path `Recipe+Recap` (URL-encoded space). Confirm by hitting the URL manually before authoring the spec.
  - If the canvas renders with visible critic-iteration scaffolding artifacts (e.g. TODO comments visible in the rendered output), re-run `/design:new` until the output is clean — don't post-process artifacts out of the recording.
- **Validate**:
  - 4a: `agg ... | ffprobe -` reports duration ≥ 60 s.
  - 4b: 4.0s ± 200 ms; manual playback confirms the multi-artboard canvas is visibly multi-artboard (at least 3 artboards on-screen at some point).

### Task 8: CAPTURE Scene 5 (dev-server canvas — hero) via Playwright

- **Do**:
  1. `scripts/video/playwright/05-canvas-hero.spec.ts`:
     - Pre-flight: `PORT=$(plugins/design/dev-server/bin/server-up.sh)` (re-used helper).
     - `await page.goto(<canvas URL>, { waitUntil: 'networkidle' });`
     - Pan/zoom briefly via `page.mouse.wheel()` (1 s of fluid motion to advertise the infinite-canvas).
     - Move mouse, hover hero artboard, `page.keyboard.down('Meta')`, hover deepest child, hold 1 s for inspector ring animation, click, release Meta.
     - Total page interaction ~8 s; Playwright records at 1920×1080.
  2. Transcode WebM → MP4 in the same step (mirror `smoke/run.sh` pattern).
- **Gotcha**: The inspector overlay is injected by `injectInspectorOnly()` and requires a live WS connection. Verify with `await page.locator('.dgn-insp-ring').count() > 0` after the modifier-hover.
- **Validate**: 8.0 s duration; manual playback confirms inspector ring visible; `expect(page.locator('.dgn-insp-ring')).toBeVisible()` passes.

### Task 9: COMPOSE Scene 6 split-screen in Remotion

- **Do**:
  1. Capture left + right as separate sources:
     - Left = `scripts/video/raw/06a-edit.cast` (asciinema cast of a full `/design:edit "tighten the hero"` run — typically 30s-2min). Snippet-cut in Remotion to 3 beats (prompt, mid-diff, "applied + reloading") per the snippet table above.
     - Right = `scripts/video/playwright/06-edit-right.spec.ts` (canvas auto-reload after edit). Plays continuously at 1× — only the left terminal half is snippet-cut.
  2. Compose in Remotion: a `<SplitScreen>` composition with `<Sequence from={0} durationInFrames={270}>` wrapping the right `<Video src={staticFile('...right.mp4')} style={{position:'absolute', left:'50%', width:'50%'}} />` (continuous) + three left `<Sequence>` blocks each pulling a snippet from `staticFile('raw/06a-edit.mp4')` with `startFrom={...}` + `endAt={...}` and absolute-positioned `left:0, width:'50%'`. 9.0 s × 30 fps = 270 frames.
  3. Frame-perfect alignment via `startFrom` — pin the "applied + reloading" left snippet to the canvas reload moment on the right by reading `_active.json.last_change` timestamps from both runs.
- **Pattern**: Left half is montage (jump-cuts within the half-frame), right half is continuous reality — mirrors the user experience of "I typed one feedback line and the canvas reloaded".
- **Gotcha**: Both inputs must be normalized to 30 fps before Remotion ingests them. Reuse the `normalize()` function from `smoke/assemble.sh`.
- **Validate**: 9.0 s duration; the third left-snippet ("→ Applied, reloading canvas") and the right-half iframe reload moment align within ±100 ms.

### Task 10: CAPTURE Scene 7 (in-place comments) via Playwright — Cut A only

- **Do**:
  1. `scripts/video/playwright/07-comments.spec.ts`:
     - Pre-flight: dev-server up (re-use helper); confirm the two pre-seeded pins from Task 0.5 render.
     - `await page.goto(<canvas URL>);` then scroll/zoom so both seeded pins are in frame.
     - **Beat 1 (0-2 s):** click an empty area of an artboard — composer card appears at click point. Type a comment via `page.keyboard.type('This needs more breathing room', { delay: 60 });`. Press Enter to submit.
     - **Beat 2 (2-4 s):** new pin renders at the click point; click it; thread popover opens.
     - **Beat 3 (4-7 s):** in the reply field, type `@`. `page.locator('.dgn-mention-autocomplete')` (or whatever the real selector is — confirm in Task 3) shows git-shortlog committers. Arrow-down twice, Enter to insert the @handle. Continue typing `take a look`. Submit reply.
     - **Beat 4 (7-10 s):** click "Resolve" on a different pre-existing pin; the pin animates to resolved-state (subdued color, dot, whatever the real animation is).
     - **Beat 5 (10-12 s):** brief hold showing the canvas with the new pin + the now-resolved pin + the still-open seeded pin — three different states in one frame.
  2. Total page interaction ~12 s; Playwright records at 1920×1080.
- **Pattern**: The whole comment-pin overlay is in-iframe (commit 462e95b: "in-canvas iframe overlay that owns pins + composer card + thread popover + @mention autocomplete"). Playwright drives the iframe directly; no popup/window switching.
- **Gotcha**:
  - Confirm exact DOM selectors before authoring the spec — grep `canvas-lib.tsx` for `commentPin`, `composer`, `thread`, `mention` and use whatever class names the runtime actually emits.
  - `@mention` autocomplete is fed by the local repo's git shortlog (commit 462e95b + endpoint `GET /_api/git-committers`, cached 60 s). For a deterministic recording, commit one extra `Co-Authored-By` line into the demo `.design/` repo so the autocomplete has at least 2-3 distinct names. Otherwise the autocomplete shows only the single dev's name and the @-completion beat looks empty.
- **Validate**: 12.0 s duration; manual playback confirms all 5 beats land in order; `expect(page.locator('.dgn-comment-pin')).toHaveCount(3)` at the final frame.

### Task 11: CAPTURE Scene 8 (docs teaser) via Playwright

- **Do**:
  1. `scripts/video/playwright/08-docs.spec.ts`: `await page.goto('http://localhost:3000/'); await page.waitForLoadState('networkidle'); await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' })); await page.waitForTimeout(3500);`.
  2. Use the real `site/` localhost (`pnpm --filter site dev`) — pre-flight in the run script. Fall back to `.design/ui/Docs Site.tsx` only if `site/` build is broken; note the choice in storyboard.
  3. Transcode WebM → MP4 + trim to 3.5 s (Cut A) / 2.5 s (Cut B trims this same source).
- **Gotcha**: First-load CLS is still a risk. Pre-warm via a discarded first `goto()` + 2 s wait, then a fresh `page.reload()` before the recorded interaction.
- **Validate**: 3.5 s duration (Cut A); hero + at least one section visible in the scroll path.

### Task 12: COMPOSE Final Cut A (`Final.tsx`, ~55s) + Cut B (`Final30.tsx`, 30s) + post-loudnorm

- **Do**:
  1. `scripts/video/final/Final.tsx`: one Remotion composition, **1800 frames (60 s × 30 fps)**, 1920×1080. Inside:
     - `<Sequence from={0} durationInFrames={75}><Video src={staticFile('scenes/01-intro.mp4')} /></Sequence>`
     - `<Sequence from={75} ...><TransitionSeries>...</TransitionSeries></Sequence>` — scenes 2-8 wired through `@remotion/transitions/fade` (300 ms xfades between top-level scenes; 150 ms hard cuts between 3a↔3b and 4a↔4b sub-beats). All `<Video>` sources are played at **1× speed** — there are no `playbackRate` modifiers. Scene 3a and Scene 4a are each composed as **multiple `<Sequence>` blocks pulling snippets from a single raw cast MP4** via `startFrom` / `endAt` (see Tasks 6 + 7 + 9 for the snippet timecode tables). Scene 6 left half is composed similarly.
     - `<Sequence from={1710} durationInFrames={90}><Video src={staticFile('scenes/09-outro.mp4')} /></Sequence>`
     - `<Audio src={staticFile('music.mp3')} volume={(f) => spring({ frame: f, from: 0, to: 0.8, config: { damping: 100 } })} />` — music bed with fade-in spring; tapers to 0 over the last 60 frames.
     - `<LowerThird ...>` per-scene captions via the reusable card component from Task 2 (one `<Sequence>` per caption).
  2. `scripts/video/final/Final30.tsx`: 900 frames (30 s × 30 fps), 1920×1080. Reuses the same scene assets and `LowerThird`, drops Scenes 3 + 7 entirely; keeps Scene 4 hybrid (terminal snippet + canvas reveal). See Cut B storyboard table for the exact frame ranges.
  3. `scripts/video/final/index.tsx`: `registerRoot` with both composition ids: `Final` and `Final30`.
  4. Render:
     ```sh
     pnpm exec remotion render scripts/video/final/index.tsx Final   site/public/demo.mp4    --codec=h264 --crf=23
     pnpm exec remotion render scripts/video/final/index.tsx Final30 site/public/demo-30s.mp4 --codec=h264 --crf=23
     ```
  5. Post-process loudnorm on both:
     ```sh
     for f in site/public/demo.mp4 site/public/demo-30s.mp4; do
       ffmpeg -y -i "$f" -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy "${f%.mp4}.norm.mp4"
       mv "${f%.mp4}.norm.mp4" "$f"
     done
     ```
  6. Extract poster from primary cut: `ffmpeg -y -i site/public/demo.mp4 -vf "select=eq(n\\,0)" -vframes 1 -q:v 2 site/public/demo-poster.jpg`.
- **Gotcha**:
  - Same Pixabay / Mixkit / FMA license fallback ladder from Task 1.
  - Primary cut at CRF 23 typically lands ~12-14 MB for 55 s. If over 16 MB (Vercel CDN soft limit for inline embed), re-render with `--crf=26`.
  - Tight cut at CRF 23 typically lands ~6-7 MB for 30 s. If over 10 MB (GitHub limit), drop to `--crf=26` or `--video-bitrate=2200k`.
  - `@remotion/transitions` requires `pnpm add -D -w @remotion/transitions` — folded into Task 2 of the toolchain phase's devDeps list.
- **Validate**:
  - `ffprobe -v error -show_entries format=duration,size -of default=nw=1 site/public/demo.mp4` → duration 60.00s ±0.05, size < 16 MB.
  - `ffprobe -v error -show_entries format=duration,size -of default=nw=1 site/public/demo-30s.mp4` → duration 30.00s ±0.05, size < 10 MB.
  - `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0` → `aac` for both.
  - Loudness sanity on both: `ffmpeg -i <file> -af loudnorm=print_format=json -f null - 2>&1 | tail -25` → integrated loudness -18 ± 2 LU.
  - Manual: full playback at native 1080p; captions legible; transitions smooth (no black flicker); audio audible but not overpowering. Comment-pin beats in Scene 7 read cleanly (Cut A only).

### Task 13: UPDATE `site/` landing — embed primary cut

- **Do**:
  1. In `site/app/(home)/page.tsx`: add `<video src="/demo.mp4" poster="/demo-poster.jpg" autoPlay muted loop playsInline controls={false} className="..." />` near the top of the hero.
  2. Width: full-bleed within hero container, `aspect-video`, rounded corners matching the site's existing radius token.
  3. Respect `prefers-reduced-motion` — pause when set via a tiny `useEffect`.
- **Gotcha**: `playsInline` is required for iOS autoplay. `muted` is required for autoplay everywhere.
- **Validate**: `cd site && pnpm dev`, open `http://localhost:3000`, confirm video autoplays muted and loops; toggle macOS Reduced Motion and confirm pause behavior.

### Task 14: UPDATE `README.md` — embed tight cut

- **Do**:
  1. Below H1 and tagline, add a video tag pointing to the GitHub-uploaded URL of `demo-30s.mp4`.
  2. To get the URL: `gh release create demo-assets --notes "marketing assets" site/public/demo-30s.mp4` OR drag-drop into a fresh issue/PR to get the user-content CDN URL. Prefer release assets — reproducible.
  3. README block:
     ```md
     <video src="<CDN_URL>" controls muted playsinline width="800"></video>

     > For the full ~55s walkthrough (incl. `/design:setup-ds` discovery and comments), see the [docs site](https://maude.iagh.cz).
     ```
- **Gotcha**: README on npm WILL NOT render the video. Acceptable: keep one README, GitHub renders video, npm shows broken tag (or wrap in a `<!-- video -->` comment a build step strips for npm — overkill for v1).
- **Validate**: View README on github.com/1aGh/maude, confirm video renders inline; the "full walkthrough" link points to docs landing where Cut A lives.

### Task 15: EXCLUDE both videos from npm publish

- **Do**:
  1. Verify `site/public/demo.mp4` and `site/public/demo-30s.mp4` are **NOT** matched by any `package.json` `files` entry.
  2. Add a parity check `scripts/check-publish-size.sh` that runs `npm pack --dry-run --json | jq '.[0].size'` and fails over 1 MB.
- **Gotcha**: If anyone adds `site/` to `files` later, ~22 MB of MP4 ships to every `npm i` user.
- **Validate**: `npm pack --dry-run 2>&1 | grep -cE 'demo(-30s)?\.mp4'` returns `0`.

### Task 16: EXTEND `scripts/video/README.md` with the marketing pipeline

- **Do**: Append a "Marketing pipeline" section that documents: how to re-record each scene independently (one per `.tape` / `.spec.ts` filename), how to regenerate **both cuts** (`pnpm exec remotion render scripts/video/final/index.tsx Final ...` + `... Final30 ...`), where the music license lives, the seeded comments state for Scene 7, and the exact terminal/window dimensions used for source captures.
- **Pattern**: Same tone as the existing smoke README. Keep ASCII-only per the [no AI-tell punctuation] memory.
- **Gotcha**: Do not rewrite the smoke README — augment it.
- **Validate**: A fresh agent reading the unified README can reproduce both cuts (primary and tight).

### Task 17: RECORD a DDR

- **Do**: Create `.ai/decisions/DDR-NNN-agent-orchestrated-marketing-video-pipeline.md`. Document the phase-specific choices: primary cut grew from 30s → ~55s to cover setup-ds + comments (the two highest-leverage features that shipped late-cycle); two cuts not one (autoplay length constraints differ between Vercel-hosted docs landing and GitHub-rendered README); Remotion `<TransitionSeries>` over ffmpeg xfade math; comment scene depends on pre-seeded `.design/_comments/<slug>.json` so the pin state is deterministic.
- **Gotcha**: Reference DDR for the toolchain (Remotion + VHS + Playwright + ffmpeg) — do not re-litigate. Also reference DDR-009 (Bun runtime) and DDR-025 (canvas-lib single source) since the dev-server lifecycle is part of the recording pipeline.
- **Validate**: DDR follows project DDR schema; cross-linked from this plan AND from the toolchain DDR.

---

## Cut variants

| Cut | Duration | Embed target | Filename | Size budget |
|-----|----------|--------------|----------|-------------|
| **A — primary** | ~60 s | `site/` landing (`<video autoPlay muted loop>`) | `site/public/demo.mp4` | < 16 MB |
| **B — tight** | 30.0 s | GitHub `README.md` (`<video controls>`) | `site/public/demo-30s.mp4` | < 10 MB (GitHub limit) |

Both cuts share the same scene library, the same captions schema, and the same music bed (different in/out trims). Re-recording a scene in `scripts/video/tapes/` or `scripts/video/playwright/` rebuilds both cuts on the next `pnpm exec remotion render ...` invocation.

---

## Validation

Run these commands to confirm zero regressions:

1. **Toolchain green**: `pnpm run video:smoke` exits 0 (delegates to the toolchain phase).
2. **Pipeline end-to-end (idempotent)**:
   ```sh
   bash scripts/video/download-music.sh
   bash scripts/video/render-all-scenes.sh
   pnpm exec remotion render scripts/video/final/index.tsx Final   site/public/demo.mp4    --codec=h264 --crf=23
   pnpm exec remotion render scripts/video/final/index.tsx Final30 site/public/demo-30s.mp4 --codec=h264 --crf=23
   for f in site/public/demo.mp4 site/public/demo-30s.mp4; do
     ffmpeg -y -i "$f" -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy "${f%.mp4}.norm.mp4"
     mv "${f%.mp4}.norm.mp4" "$f"
   done
   ```
   exits 0, produces both MP4s with the right durations + sizes.
3. **Video integrity**: `ffprobe -v error site/public/demo.mp4` returns no errors; same for the 30s cut.
4. **Captions readable**: manual playback at 1×, 0.5× speeds — every caption is on-screen ≥ 2.0 s and centered.
5. **Audio levels**: integrated loudness within -18 ± 2 LU for both cuts.
6. **Site embed**: `cd site && pnpm dev` — landing autoplays the primary cut muted, loops cleanly, reduced-motion pauses.
7. **README on GitHub**: render preview via `gh pr view --web` — tight cut renders inline.
8. **npm publish hygiene**: `npm pack --dry-run 2>&1 | tee /tmp/pack.log; ! grep -qE 'demo(-30s)?\.mp4' /tmp/pack.log`.
9. **Lint**: `pnpm lint` passes after embedding the `<video>` element.
10. **Manual**:
    - Watch the full primary cut on a retina screen at native 1080p — no compression artifacts on text, no audio clipping, transitions smooth.
    - Watch tight cut at mobile-size browser (375×812) — captions still legible.
    - **Scene 7 sanity (Cut A only):** the three comment-pin beats (new pin, @mention autocomplete, resolve) all read clearly — if any beat blurs into the next, raise that beat's duration in `Final.tsx` by 0.5 s.

---

## Scenario Coverage (UI tasks — required)

> The video embed in `site/` and the README IS a UI change. Scenarios verify the player loads, autoplays muted, loops, and respects reduced-motion across desktop + mobile web.

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| (none for `site/` landing today — confirm via `ls .ai/scenarios/`) | — | 🆕 new |

**New scenarios to create:**

- `site-landing-video-autoplay` — flow: navigate to `/`, assert `<video src="/demo.mp4">` element present + `currentTime > 0` after 1 s + `muted=true` + `loop=true`. Platforms: web-desktop, web-mobile.
- `site-landing-reduced-motion` — flow: emulate `prefers-reduced-motion: reduce`, assert `<video>.paused === true`. Platforms: web-desktop.
- `readme-video-loads` — flow: navigate to the GitHub README rendered view, assert the `<video>` tag points at the release asset and the asset returns HTTP 200. Platform: web-desktop. (Cheap precondition for the GitHub embed not silently breaking.)

The `scenario-runner` agent runs these as part of `/validate`.

---

## Acceptance Criteria

- [ ] All tasks 0-17 completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` passes overall:
  - [ ] Static (types, lint, format) — `site/` clean
  - [ ] Tests — none new; pipeline scripts run idempotently
  - [ ] Build — `site/` builds; both demo MP4s committed
  - [ ] **`scenario-runner`**: site-landing-video-autoplay + site-landing-reduced-motion + readme-video-loads green
  - [ ] `design-system-guard`: 0 blockers on the embedded video container
  - [ ] `a11y-auditor`: 0 blockers — `<video>` has `aria-label`, captions burned in (visible without audio), no autoplay sound (muted)
- [ ] `site/public/demo.mp4` exists, < 16 MB, ~60.0 s ± 0.5, H.264 + AAC
- [ ] `site/public/demo-30s.mp4` exists, < 10 MB, exactly 30.0 s, H.264 + AAC
- [ ] `site/public/demo-poster.jpg` exists, used as `<video poster>`
- [ ] GitHub README renders the tight cut inline; tight cut link to docs landing for the full cut works
- [ ] npm `--dry-run` does NOT include either demo MP4
- [ ] DDR recorded
- [ ] Music license URL committed in `scripts/video/storyboard.md`
- [ ] No DDR-worthy decision left unrecorded
- [ ] Captions strictly ASCII (no em dash, en dash, curly quotes, ellipsis char) per project memory
