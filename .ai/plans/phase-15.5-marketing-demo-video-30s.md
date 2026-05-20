# Feature: Marketing Demo Video — 30s, agent-orchestrated

> **Toolchain prerequisite (2026-05-20):** This plan assumes
> [`phase-15-video-pipeline-toolchain.md`](./phase-15-video-pipeline-toolchain.md)
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

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Produce a 30-second 16:9 marketing/showcase video for `maude` that the agent (me) produces **end-to-end without human edits in a video editor**. The video stitches real screen recordings of the design plugin dev-server UI, the docs site (`site/`), and the Claude Code terminal flow, overlaid with infographic "title cards" and burned-in captions, scored with a royalty-free instrumental bed. Final artifact lives in `site/public/demo.mp4` and is embedded into both the docs landing page and `README.md`.

The agent orchestrates **every** step: spawns the dev-server, triggers UI interactions via `computer-use` + Bash, records segments with `screencapture -v` (macOS built-in) — falling back to `ffmpeg avfoundation` once installed — produces infographic frames by rendering HTML cards in a Chromium tab and screenshot-sequencing them, downloads music from Pixabay via WebFetch/curl, and assembles everything with `ffmpeg` (concat + drawtext + audio mix + scale/pad).

## User Story

As a **prospective Maude user** landing on the docs site or GitHub README, I want a **30-second visual demo** so that I can grasp what the marketplace + plugins do — `maude init`, `/design:new`, the canvas dev server, `/design:edit` — **without reading a wall of text or installing anything**.

## Problem

- README and docs explain features verbally; there is no visual "show, don't tell" surface.
- Onboarding friction is high — users have to install the marketplace + run a flow before they see the dev-server UI, which is the visually striking part.
- Social/share previews currently fall back to text snippets.

## Solution

A single 30-second muted-friendly MP4 (autoplay-safe) with:
- 6 scenes × ~5s, captions burned in for clarity without audio,
- Royalty-free instrumental bed (Pixabay/CC0) at -18 LUFS,
- 16:9 1920×1080 H.264, < 8 MB target so it embeds cleanly into README via GitHub's video upload + lives in `site/public/` for the Next.js landing.

Every recording, transition, caption, and mix is produced by Bash + ffmpeg + `computer-use`/`claude-in-chrome` MCP — reproducible, scriptable, no Final Cut.

## Metadata

- **GitHub Issue**: n/a (internal initiative)
- **Type**: New Capability (marketing artifact + agentic video pipeline)
- **Complexity**: High — first agentic video production in this repo; multi-tool orchestration (screencapture, ffmpeg, computer-use, chrome-mcp, WebFetch); macOS-only capture path
- **App/Package**: `site/` (embed target) + `scripts/` (new video-pipeline scripts) + `.design/` (canvas content recorded)
- **Affected Systems**: Next.js docs site, README, design plugin dev-server, repo build/publish (video must NOT ship to npm — exclude from `package.json` `files`)
- **Dependencies**:
  - **ffmpeg** (Homebrew install — gated user step, see Task 0)
  - macOS Screen Recording permission for Terminal/Chrome (gated user grant)
  - Pixabay royalty-free music asset (download once, commit to `site/public/audio/` or fetch at build time)
  - Existing canvases: `.design/ui/Canvas Viewport.tsx`, `.design/ui/Docs Site.tsx` (used as hero shots)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/server.mjs` (full file) — Why: confirms `--root` arg + `/_health` + WebSocket inspector contract; the video shows real inspector overlay clicks, which depend on this server being live and seeded against `.design/`.
- `plugins/design/dev-server/bin/screenshot.sh` — Why: prior art for agent-driven capture; reuse the agent-browser/playwright fallback ladder pattern for video frame capture.
- `plugins/design/dev-server/bin/server-up.sh` — Why: lifecycle helper to ensure server is healthy before recording; the video pipeline must invoke this, not start a duplicate.
- `.design/ui/Canvas Viewport.tsx` + `.design/ui/Canvas Viewport.css` — Why: this canvas IS the hero shot for Scene 4 (dev-server UI). Confirm it renders cleanly fullscreen before recording.
- `.design/ui/Docs Site.tsx` — Why: Scene 6 docs teaser uses this canvas mock OR the real `site/` build — decide in Task 2.
- `site/app/(home)/page.tsx` (and Fumadocs layout) — Why: embed location for the final MP4; check current hero structure.
- `README.md` lines 1-50 — Why: confirm where to embed the GitHub-uploaded video link (typically right under H1).
- `package.json` `files` array — Why: must verify `site/public/demo.mp4` is NOT in the npm publish set; the video is web/repo-only.

### Files to Create

- `scripts/video/storyboard.md` — Frozen scene-by-scene script (timings, captions, recording cues). Single source of truth for the producer pipeline.
- `scripts/video/record-scene.sh` — Per-scene capture wrapper. Inputs: `<scene-id> <duration> <output>`. Drives `screencapture -v` (or `ffmpeg avfoundation` if installed) with a precise window region.
- `scripts/video/render-card.mjs` — Standalone Node + Playwright (or Puppeteer-core via Chrome MCP) script that renders an HTML title card at 1920×1080 and exports `N` frames over `D` seconds to PNG sequence, then concats to a silent MP4 via ffmpeg. Used for Scenes 1, 7, and any infographic overlay.
- `scripts/video/cards/intro.html`, `scripts/video/cards/outro.html`, `scripts/video/cards/lower-third-*.html` — HTML/CSS card templates using `.design/system/<active-ds>/_tokens.css` so cards inherit the project's brand identity. **No hardcoded colors.**
- `scripts/video/captions.srt` — Burned-in captions per scene timecode.
- `scripts/video/assemble.sh` — Final pipeline. Inputs: all scene MP4s + audio + captions. Output: `site/public/demo.mp4`. Steps: scale/pad each clip to 1920×1080, xfade transitions, drawtext captions, audio mix with ducking under transitions, 2-pass H.264 encode to <8 MB.
- `scripts/video/download-music.sh` — Idempotent fetch of the Pixabay track to `scripts/video/.cache/music.mp3` (gitignored) — license URL recorded in `storyboard.md`.
- `site/public/demo.mp4` — Final artifact (committed; ~6–8 MB).
- `site/public/demo-poster.jpg` — Frame 1 used as `<video poster>`.
- `.gitignore` entry for `scripts/video/.cache/`, `scripts/video/.work/`.

### Documentation

- ffmpeg avfoundation device list: https://ffmpeg.org/ffmpeg-devices.html#avfoundation — Why: enumerate screen device id with `ffmpeg -f avfoundation -list_devices true -i ""` before recording.
- ffmpeg drawtext: https://ffmpeg.org/ffmpeg-filters.html#drawtext-1 — Why: burned-in captions without `.srt` muxing complexity.
- ffmpeg xfade: https://ffmpeg.org/ffmpeg-filters.html#xfade — Why: smooth scene transitions (fade, slideleft).
- `screencapture(1)` man page (`man screencapture`) — Why: native macOS recorder, no install. `-v` records video, `-R x,y,w,h` constrains region. Works on macOS 14+.
- Pixabay Music licensing: https://pixabay.com/service/license-summary/ — Why: confirm "Pixabay Content License" = no attribution required, free commercial use. Pin the track URL in `storyboard.md`.
- GitHub video embed in README (drag-drop releases a CDN URL, but for reproducibility we'll commit MP4 + reference via `<video>` in README): https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files — Why: confirm GitHub's MP4 render limit (10 MB).

### Patterns to Follow

**Helper script ladder (mirror `plugins/design/dev-server/bin/screenshot.sh`):**
```sh
# screenshot.sh: agent-browser primary → npx playwright fallback
# Our analogue:
#   record-scene.sh: ffmpeg avfoundation primary → screencapture -v fallback
```

**Server lifecycle (from `server-up.sh`):**
```sh
# Reuse, do NOT reimplement. Our pipeline:
plugins/design/dev-server/bin/server-up.sh
PORT=$(plugins/design/dev-server/bin/server-up.sh)
URL="http://localhost:$PORT/canvas/ui/Canvas+Viewport"
```

**Brand tokens in HTML cards:**
```html
<!-- scripts/video/cards/intro.html -->
<link rel="stylesheet" href="../../../.design/system/<active-ds>/_tokens.css">
<style>
  body { background: var(--bg); color: var(--ink); font-family: var(--font-display); }
  .tag { color: var(--accent); }
</style>
```

Detect active DS via `jq -r '.activeDesignSystem' .design/config.json`.

---

## Design Decisions

### Storyboard (frozen — see `scripts/video/storyboard.md`)

| # | Scene | Dur | Capture source | Caption |
|---|-------|-----|----------------|---------|
| 1 | Intro card | 3.0s | `render-card.mjs intro.html` | `maude — design + workflow plugins for Claude Code` |
| 2 | `maude init` terminal | 4.0s | `screencapture -v` of Terminal running `maude init` in `/tmp/scratch` | `Scaffold .ai/ in one command` |
| 3 | `/design:new` flow | 5.0s | `screencapture -v` of Claude Code terminal, scripted Q&A via computer-use type-into-app-when-allowed; speed 2× in post | `Brief → discovery → design system` |
| 4 | Dev-server canvas (hero) | 6.0s | `screencapture -v` of Chrome showing `Canvas Viewport`, Cmd+Click element select animation via claude-in-chrome MCP | `Live canvas with Cmd+Click inspector` |
| 5 | `/design:edit` magic | 6.0s | Split-screen: left half = Claude Code terminal showing `/design:edit "tighten the hero"`, right half = canvas auto-reloading. Composite in ffmpeg `hstack`. | `One feedback string → diff applied & reloaded` |
| 6 | Docs teaser | 3.0s | `screencapture -v` of `site/` localhost scroll OR real production https://maude.iagh.cz | `Docs at maude.iagh.cz` |
| 7 | Outro CTA | 3.0s | `render-card.mjs outro.html` | `npm i -g @1agh/maude · github.com/1aGh/maude` |

**Total:** 30.0s exact. Each scene's raw capture is ~10% longer than its slot to allow trim-in/trim-out cleanup.

### Components (HTML cards, from project DS tokens)

| Component | Source | Notes |
|-----------|--------|-------|
| `intro.html` | new — built fresh | Uses `_tokens.css` from active DS; gradient bg from `--gradient-hero` if exists, else solid `--bg`. Logo wordmark only (no logo asset in repo as of now). |
| `outro.html` | new — built fresh | Mirrors intro typography; large mono install command + GitHub URL. |
| `lower-third.html` | new — built fresh | Reusable caption strip (480×120) overlaid on Scenes 2–6 if drawtext proves too plain. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
|----------------|--------|-------|
| Canvas Viewport | `.design/ui/Canvas Viewport.tsx` | Hero shot for Scene 4. Pre-flight: render at 1440×900 in browser, confirm no console errors. |
| Docs Site mock | `.design/ui/Docs Site.tsx` | Fallback for Scene 6 if real `site/` looks too WIP at recording time. |

### Tokens

| Purpose | Token | Usage |
|---------|-------|-------|
| Card background | `--bg` | intro/outro backgrounds |
| Card text | `--ink` | primary copy |
| Accent / brand pulse | `--accent` | wordmark, animated underline |
| Caption strip | `--surface` + `--ink-muted` | lower-third pill |

### Custom Components Needed

| Component | Reason | Extends |
|-----------|--------|---------|
| `render-card.mjs` | No existing card-to-video frame pipeline in repo | none — new helper, sibling to `screenshot.sh` |
| `assemble.sh` | No existing ffmpeg pipeline | none |

### Captions discipline

Per [no AI-tell punctuation] memory: **no em dash, en dash, curly quotes, ellipsis char, excess emoji** in any caption or card copy. ASCII hyphens, straight quotes, three periods if needed. Interpunct OK only in stamps like `npm i -g @1agh/maude`.

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 0: GATE — Install ffmpeg + grant Screen Recording

- **Do**: Ask the user to run `brew install ffmpeg` (gated — Bash sandbox may not allow brew install). Verify with `which ffmpeg && ffmpeg -version | head -1`. Then ask the user to open **System Settings → Privacy & Security → Screen Recording** and grant Terminal + Google Chrome.
- **Pattern**: This is the same human-grant gating done for `computer-use` `request_access`. Document the exact prompts I'll show the user.
- **Gotcha**: Without ffmpeg, fallback path is `screencapture -v` only — usable for capture but NOT for concat/drawtext/xfade. We CANNOT ship without ffmpeg. This is a hard gate.
- **Validate**: `ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -i "screen capture"` lists at least one screen device.

### Task 1: CREATE storyboard + license-anchored music download

- **Do**:
  1. Write `scripts/video/storyboard.md` with the 7-scene table above, exact timecodes, exact caption strings (ASCII-clean), and the Pixabay track URL + license excerpt.
  2. Pick a track: 30-40s instrumental, BPM 90-110, "corporate ambient" or "tech inspiration" mood. Browse Pixabay Music via WebFetch (`https://pixabay.com/music/search/tech/?duration=0-30`), pick one, record its track-id + URL.
  3. Write `scripts/video/download-music.sh` that `curl`s the track to `scripts/video/.cache/music.mp3`.
  4. Add `scripts/video/.cache/` and `scripts/video/.work/` to `.gitignore`.
- **Pattern**: Storyboard format mirrors how `.ai/plans/phase-N-*.md` documents scope before code.
- **Gotcha**: Pixabay direct-download URLs require a session cookie since 2024; if the curl fails, fall back to a public CC0 alternative on Mixkit (`https://mixkit.co/free-stock-music/`) or Free Music Archive — note the chosen source in storyboard.
- **Validate**: `bash scripts/video/download-music.sh && ffprobe scripts/video/.cache/music.mp3 2>&1 | grep -E "Duration|bit_rate"` — duration ≥ 30s.

### Task 2: CREATE Remotion card compositions

- **Do**:
  1. Scaffold `scripts/video/cards/`:
     - `IntroCard.tsx` — 3 s, 1920×1080. Big wordmark "maude", tagline "design + workflow plugins for Claude Code". Spring-driven entrance (90 frames at 30 fps): opacity 0→1 + 24px translate over the first 18 frames using `spring()`, hold 54 frames, gentle fade-out over the last 18.
     - `OutroCard.tsx` — 3 s, 1920×1080. Install command in mono, GitHub URL, accent-color underline that wipes left→right with `interpolate()`.
     - `LowerThird.tsx` — reusable caption overlay, 50% accent-plate behind text, fontsize 44, used by every scene via `<Sequence>` from final composition.
  2. Brand wiring: `import tokens from '../../../.design/system/project/colors_and_type.css'` is not directly importable into Remotion (it's CSS, not TS). Two options: (a) re-export a small `tokens.ts` shim under `scripts/video/cards/tokens.ts` that mirrors `--bg`, `--ink`, `--accent`, `--mono-family` values, with a regression check that fails if the CSS source drifts; (b) inject the CSS file as an `<style>` block in a Remotion `<AbsoluteFill>` wrapper. Default to (a) — explicit shim is greppable when the DS rotates.
  3. Mirror the shape of smoke `SmokeCard.tsx`: `AbsoluteFill` root, `useCurrentFrame()` + `interpolate()` + `spring()` for animation.
  4. Register all three in a single `scripts/video/cards/index.tsx` `registerRoot` so `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard …` works per-composition.
- **Pattern**: Mirror smoke `SmokeCard.tsx` shape. Token shim mirrors the way `site/app/mdcc-tokens.css` is reconciled today (the "single source is CSS, JS mirror is a derived view" pattern).
- **Gotcha**: Per the [no AI-tell punctuation] memory — strip em dash, en dash, curly quotes, ellipsis char from card copy. ASCII only.
- **Validate**:
  - `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard scripts/video/.work/cards/intro.mp4 --mute` succeeds.
  - `ffprobe scripts/video/.work/cards/intro.mp4` reports h264 / 1920×1080 / 30 fps / duration 3.00.
  - Same for `OutroCard`.
  - Color sampling on a single frame matches token `--accent` ± 2 in each RGB channel.

### Task 3: CREATE per-scene capture surfaces (no bash ladder)

- **Do**:
  1. `scripts/video/tapes/` — VHS `.tape` files for terminal scenes. One file per scene (Scene 2 + Scene 3 + Scene 5-left). Each tape declares its own `Output ...mp4`, `Set Framerate 30` (best-effort; VHS may still emit 25 fps for MP4 — assemble normalizes), `Set FontSize`, `Set Width/Height`, `Set Theme`.
  2. `scripts/video/playwright/` — Playwright spec files for browser scenes (Scene 4 hero, Scene 5-right canvas reload, Scene 6 docs teaser). Reuse `scripts/video/smoke/playwright.config.ts` as base; per-scene specs can override `outputDir` via env or test-level config.
  3. Helper: `scripts/video/lib/server-up.sh` — thin alias to `plugins/design/dev-server/bin/server-up.sh` so all browser scenes pre-flight the dev-server identically. Do NOT duplicate the helper.
- **Pattern**: The toolchain IS the ladder — VHS for terminal, Playwright for browser, Remotion for compose. No `record-scene.sh` bash wrapper; tapes and specs are the source artifacts.
- **Gotcha**: VHS `Output` rejects absolute paths; use repo-root-relative paths. Playwright `outputDir` is resolved against the config file location, not cwd — use an absolute path computed via `import.meta.url` (as `smoke/playwright.config.ts` already does).
- **Validate**: Each `.tape` and `.spec.ts` is independently runnable and produces an MP4 (or WebM that ffmpeg converts) of the expected duration ± 200 ms.

### Task 4: COMPOSE Scene 1 (intro card) + Scene 7 (outro card)

- **Do**: `pnpm exec remotion render scripts/video/cards/index.tsx IntroCard scripts/video/.work/scenes/01-intro.mp4 --mute` and same for `OutroCard` → `07-outro.mp4`.
- **Pattern**: n/a — straight invocation of Task 2's compositions.
- **Gotcha**: Frame timing — 3.0s × 30fps = 90 frames; Remotion's `durationInFrames` is the source of truth. Off-by-one is impossible if `Composition durationInFrames={90}` is set.
- **Validate**: `ffprobe -v error -show_entries format=duration -of csv=p=0 scripts/video/.work/scenes/01-intro.mp4` returns `3.00...`.

### Task 5: AUTHOR Scene 2 (`maude init`) as a `.tape`

- **Do**:
  1. Write `scripts/video/tapes/02-maude-init.tape`:
     ```
     Output scripts/video/.work/scenes/02-maude-init.mp4
     Set FontSize 18
     Set Width 1920
     Set Height 1080
     Set Theme "Dracula"
     Type "cd /tmp/scratch-maude-demo && node /Volumes/D/git/claude-design/cli/bin/maude.mjs init && ls .ai" Enter
     Sleep 4s
     ```
  2. Run via VHS: deterministic, headless, no clipboard hack, no Screen Recording permission. The 4-second cut comes from the `Sleep` after the command.
- **Pattern**: Declarative `.tape` DSL replaces the computer-use clipboard workflow entirely.
- **Gotcha**: `maude init` colors render via the same ANSI codes VHS captures; if output looks dim, `Set Theme` to a higher-contrast preset (e.g. `Dracula` or `GitHub`) — no `CLICOLOR_FORCE` needed.
- **Validate**: `vhs scripts/video/tapes/02-maude-init.tape && ffprobe scripts/video/.work/scenes/02-maude-init.mp4` reports duration ≥ 4.0s, h264, 1920×1080 (VHS may degrade fps to 25 — assemble normalizes).

### Task 6: AUTHOR Scene 3 (`/design:new` discovery turn) as a `.tape`

- **Do**:
  1. Write `scripts/video/tapes/03-design-new.tape` that opens a non-interactive scripted Claude Code session via `claude --print` (one-shot) or stages a pre-recorded `asciinema` cast and replays it through VHS. Decide on whichever produces a 5–8 s segment that visibly shows the option-pool render.
  2. Trim/speed handled in the final Remotion composition via `<Sequence playbackRate={2}>` — NOT in `assemble.sh`. There is no `assemble.sh` in this refactored plan.
- **Pattern**: All speed + trim handled inside Remotion's timeline. VHS captures raw; Remotion shapes.
- **Gotcha**: `claude --print` may not fully render the streaming spinner; if it looks static, fall back to recording the live REPL via a pre-scripted `Type "<feedback>"` + `Enter` + `Sleep` sequence — VHS handles the streaming render fine since it captures the terminal at 30 fps regardless of whether the underlying process is interactive.
- **Validate**: 8.0s raw; 5.0s after Remotion `playbackRate={1.6}` trim (or 2× then crop). Visible: option-pool render with at least 3 distinct options on-screen.

### Task 7: CAPTURE Scene 4 (dev-server canvas — hero) via Playwright

- **Do**:
  1. `scripts/video/playwright/04-canvas-hero.spec.ts`:
     - `await page.goto(<canvas URL>, { waitUntil: 'networkidle' });`
     - Move mouse, hover hero artboard, hold modifier via `page.keyboard.down('Meta')`, hover deepest child, hold 1s for inspector ring animation, click, release Meta.
     - Total page interaction ~6s; Playwright records the whole spec to WebM at 1920×1080.
  2. Pre-flight: `PORT=$(plugins/design/dev-server/bin/server-up.sh)` (re-used helper, not duplicated).
  3. Transcode WebM → MP4 in the same step (mirror `smoke/run.sh` pattern).
- **Pattern**: Playwright `keyboard.down('Meta')` + `page.mouse.move()` simulates the Cmd+Click overlay trigger that `claude-in-chrome` would have done. No external MCP dep — Playwright owns the browser end-to-end.
- **Gotcha**: The inspector overlay is injected by the dev-server's `injectInspectorOnly()` and requires a live WS connection back to the dev-server. The Playwright Chromium is a separate browser instance from the dev-server's `_server.json` PID — verify the inspector overlay actually renders by asserting `await page.locator('.dgn-insp-ring').count() > 0` after the modifier-hover.
- **Validate**: 6.0s duration; manual playback confirms inspector ring visible; `expect(page.locator('.dgn-insp-ring')).toBeVisible()` assertion passes.

### Task 8: COMPOSE Scene 5 split-screen in Remotion

- **Do**:
  1. Capture left + right as separate sources:
     - Left = `scripts/video/tapes/05-edit-left.tape` (terminal `/design:edit "..."` flow).
     - Right = `scripts/video/playwright/05-edit-right.spec.ts` (canvas auto-reload after edit).
  2. Compose in Remotion: a `<SplitScreen>` composition with `<Sequence from={0} durationInFrames={180}>` wrapping two `<Video src={staticFile('...left.mp4')} style={{position:'absolute', left:0, width:'50%'}} />` + `<Video src={...right.mp4} style={{position:'absolute', left:'50%', width:'50%'}} />`. 6.0s × 30fps = 180 frames.
  3. Frame-perfect alignment via the `startFrom` prop on each `<Video>` — pin the moment "edit applied" lines up with the canvas reload by reading the `_active.json.last_change` timestamps from both runs and computing the offset.
- **Pattern**: Declarative composition in JSX. Zero ffmpeg `hstack`; zero clapperboard. Remotion's `staticFile()` + `<Video>` + `<Sequence>` IS the composer.
- **Gotcha**: Both inputs must be normalized to the same fps before Remotion ingests them (Remotion `<Video>` re-encodes at composition fps but mixed source fps inside one `<Video>` causes audio/video drift even when muted). Run them through `assemble.sh`-style ffmpeg normalize as a pre-step (mirror `smoke/assemble.sh` `normalize()` function — lift, don't duplicate).
- **Validate**: 6.0s duration; left + right reload moments within ±100 ms (tighter than the bash plan's 200 ms slop because Remotion is frame-deterministic once `startFrom` is dialled in).

### Task 9: CAPTURE Scene 6 (docs teaser) via Playwright

- **Do**:
  1. `scripts/video/playwright/06-docs.spec.ts`: `await page.goto('http://localhost:3000/'); await page.waitForLoadState('networkidle'); await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' })); await page.waitForTimeout(3000);`.
  2. Use the real `site/` localhost (`pnpm --filter site dev`) — pre-flight in the run script. Fall back to `.design/ui/Docs Site.tsx` only if `site/` build is broken; note the choice in the storyboard.
  3. Transcode WebM → MP4 + trim to 3.0s.
- **Pattern**: Same Playwright pre-flight + transcode pattern as Scene 4 and the smoke browser spec.
- **Gotcha**: First-load CLS is still a risk. Pre-warm via a discarded first `goto()` + 2s wait, then a fresh `page.reload()` before the recorded interaction.
- **Validate**: 3.0s; hero + at least one section visible in the scroll path.

### Task 10: COMPOSE final assembly in Remotion + post-loudnorm

- **Do**:
  1. `scripts/video/final/Final.tsx`: a single Remotion composition, 900 frames (30 s × 30 fps), 1920×1080. Inside:
     - `<Sequence from={0} durationInFrames={90}><Video src={staticFile('scenes/01-intro.mp4')} /></Sequence>` — Scene 1.
     - `<Sequence from={90} ...><TransitionSeries.Sequence>...</TransitionSeries.Sequence></Sequence>` — Scenes 2–6 via `@remotion/transitions/fade` (300 ms xfades replace the ffmpeg xfade math).
     - `<Sequence from={810} durationInFrames={90}><Video src={staticFile('scenes/07-outro.mp4')} /></Sequence>` — Scene 7.
     - `<Audio src={staticFile('music.mp3')} volume={(f) => spring({ frame: f, from: 0, to: 0.8, config: { damping: 100 } })} />` — music bed with fade-in spring; volume tapers to 0 over the last 60 frames.
     - `<LowerThird ... />` per-scene captions via the reusable card component from Task 2.
  2. `scripts/video/final/index.tsx`: `registerRoot` with one composition id `Final`.
  3. Render: `pnpm exec remotion render scripts/video/final/index.tsx Final site/public/demo.mp4 --codec=h264 --crf=23`.
  4. Post-process loudnorm (Remotion's audio mixing is fine, but loudness normalization is a one-liner ffmpeg can do better):
     ```sh
     ffmpeg -y -i site/public/demo.mp4 -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy site/public/demo.norm.mp4
     mv site/public/demo.norm.mp4 site/public/demo.mp4
     ```
  5. Extract poster: `ffmpeg -y -i site/public/demo.mp4 -vf "select=eq(n\\,0)" -vframes 1 -q:v 2 site/public/demo-poster.jpg`.
- **Pattern**: Remotion composition + audio + transitions + captions all declared in JSX. The only bash is the single-pass loudnorm post-step and the poster extract.
- **Gotcha**:
  - Music license still applies — same Pixabay / Mixkit / FMA fallback ladder from Task 1.
  - 2200 kbps × 30s ≈ 8.25 MB before audio — Remotion's CRF 23 typically lands well below that. If over 8 MB, re-render with `--crf=28` or `--video-bitrate=1800k`.
  - `@remotion/transitions` requires `pnpm add -D -w @remotion/transitions` — fold into Task 2 of `phase-15-video-pipeline-toolchain.md`'s devDeps list (or add here if not already shipped from Phase 1).
- **Validate**:
  - `ffprobe -v error -show_entries format=duration,size -of default=nw=1 site/public/demo.mp4` → duration 30.00s ±0.05, size < 8 MB.
  - `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0` → `aac` (Remotion default).
  - Loudness sanity: `ffmpeg -i site/public/demo.mp4 -af loudnorm=print_format=json -f null - 2>&1 | tail -25` → integrated loudness -18 ± 2 LU.
  - Manual: full 30s playback at native 1080p; captions legible; transitions smooth (no black flicker); audio audible but not overpowering.

### Task 11: UPDATE `site/` landing — embed video

- **Do**:
  1. In `site/app/(home)/page.tsx` (or whichever hero component): add `<video src="/demo.mp4" poster="/demo-poster.jpg" autoPlay muted loop playsInline controls={false} class="..." />` near the top of the hero, above any descriptive copy.
  2. Width: full-bleed within hero container, `aspect-video`, rounded corners matching the site's existing radius token.
  3. Respect `prefers-reduced-motion` — pause when set. Use a tiny `useEffect` (or a CSS-only `@media (prefers-reduced-motion: reduce) { video { animation-play-state: paused; } }` won't pause an HTML5 video — JS needed).
- **Pattern**: Match existing site component naming and styling (Tailwind via Fumadocs presets).
- **Gotcha**: Next.js `<video>` is fine; no need for a custom player. `playsInline` is required for iOS autoplay. `muted` is required for autoplay everywhere.
- **Validate**: `cd site && pnpm dev`, open `http://localhost:3000`, confirm video autoplays muted and loops; toggle macOS Reduced Motion and confirm pause behavior.

### Task 12: UPDATE `README.md` — embed video

- **Do**:
  1. Below H1 and tagline, add a video tag pointing to the GitHub-uploaded URL.
  2. To get the URL: `gh release create demo-assets --notes "marketing assets" site/public/demo.mp4` OR drag-drop into a fresh issue/PR to get the user-content CDN URL. Prefer release assets — reproducible.
  3. README block:
     ```md
     <video src="<CDN_URL>" controls muted playsinline width="800"></video>
     ```
- **Pattern**: GitHub README markdown allows `<video>` since 2022.
- **Gotcha**: README on PyPI/npm WILL NOT render the video — that's fine, this is GitHub-specific. The video MUST NOT be linked from the npm-published README path. Verify by checking `package.json` `files` excludes README modifications that would mislead npm viewers. Acceptable: keep one README, GitHub renders video, npm shows broken tag (or wrap in a `<!-- video -->` comment a build step strips for the npm copy — but that's overkill for v1; just accept the broken tag on npm).
- **Validate**: View README on github.com/1aGh/maude, confirm video renders inline.

### Task 13: EXCLUDE video from npm publish

- **Do**:
  1. `package.json` `files` is allowlist-based (CLAUDE.md confirms). Verify `site/public/demo.mp4` is **NOT** matched by any entry.
  2. If `site/` is currently NOT in `files`, no action needed. Add a comment in `package.json` `// _note` or in `CONTRIBUTING.md` clarifying the video is a repo artifact, not a published one.
- **Pattern**: Mirrors how design plugin commands stay out of npm (per CLAUDE.md "Published npm surface").
- **Gotcha**: If anyone adds `site/` to `files` later, an 8 MB MP4 ships to every `npm i` user. Add a parity check script: `scripts/check-publish-size.sh` that runs `npm pack --dry-run --json | jq '.[0].size'` and fails over 1 MB.
- **Validate**: `npm pack --dry-run 2>&1 | grep -c demo.mp4` returns `0`.

### Task 14: EXTEND `scripts/video/README.md` with the marketing pipeline

- **Do**: The smoke README (created by `phase-15-video-pipeline-toolchain.md` Task 8) already covers prereqs, troubleshooting, and the toolchain runbook. **Append** a "Marketing pipeline" section that documents: how to re-record each scene independently (one per `.tape` / `.spec.ts` filename), how to regenerate the final cut (`pnpm exec remotion render scripts/video/final/index.tsx Final site/public/demo.mp4`), where the music license lives, and the exact terminal/window dimensions used for the source captures (so re-records match the original framing).
- **Pattern**: Same tone as the existing smoke README. Keep ASCII-only per the [no AI-tell punctuation] memory.
- **Gotcha**: Do not rewrite the smoke README — augment it. The smoke section stays load-bearing for toolchain onboarding; the marketing section is the second-level "now that the toolchain is green, here's how to author scenes" guide.
- **Validate**: A fresh agent reading the unified README can reproduce both the smoke AND the marketing video.

### Task 15: RECORD a DDR

- **Do**: Create `.ai/decisions/DDR-NNN-agent-orchestrated-marketing-video-pipeline.md`. Document the choices specific to this phase: Pixabay over commissioned audio (cost), 16:9 master (web-first per user answer), commit MP4 to repo (under 8 MB, reproducibility) vs LFS (overkill at this size), Remotion `<TransitionSeries>` xfade over ffmpeg xfade math (declarative > hand-tuned offset arithmetic).
- **Pattern**: Existing DDRs in `.ai/decisions/`.
- **Gotcha**: Reference the toolchain DDR recorded by `phase-15-video-pipeline-toolchain.md` Task 10 (Remotion + VHS + Playwright + ffmpeg) — do not re-litigate that decision here. Also reference DDR-009 (Bun runtime) and DDR-025 (canvas-lib single source) since the dev-server lifecycle is part of the recording pipeline.
- **Validate**: DDR follows project DDR schema; cross-linked from this plan AND from the toolchain DDR.

---

## Validation

Run these commands to confirm zero regressions:

1. **Toolchain green**: `pnpm run video:smoke` exits 0 (delegates to `phase-15-video-pipeline-toolchain.md` — required precondition).
2. **Pipeline end-to-end (idempotent)**: `bash scripts/video/download-music.sh && bash scripts/video/render-all-scenes.sh && pnpm exec remotion render scripts/video/final/index.tsx Final site/public/demo.mp4 --codec=h264 --crf=23 && ffmpeg -y -i site/public/demo.mp4 -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy site/public/demo.norm.mp4 && mv site/public/demo.norm.mp4 site/public/demo.mp4` — exits 0, produces `site/public/demo.mp4` with `duration=30.0`, `size < 8 MB`. `render-all-scenes.sh` orchestrates VHS + Playwright captures + the scene normalize step (replacement for the old `record-scene.sh` + `assemble.sh` bash pair).
3. **Video integrity**: `ffprobe -v error site/public/demo.mp4` returns no errors; `ffmpeg -v error -i site/public/demo.mp4 -f null -` returns nothing.
4. **Captions readable**: manual playback at 1×, 0.5× speeds — every caption is on-screen ≥ 2.0s and centered.
5. **Audio levels**: `ffmpeg -i site/public/demo.mp4 -af loudnorm=print_format=json -f null - 2>&1 | tail -20` shows integrated loudness within -18 ± 2 LU.
6. **Site embed**: `cd site && pnpm dev` — landing autoplays muted, loops cleanly, reduced-motion pauses.
7. **README on GitHub**: render preview via `gh pr view --web` (or push to a draft branch) — video renders inline.
8. **npm publish hygiene**: `npm pack --dry-run 2>&1 | tee /tmp/pack.log; ! grep -q demo.mp4 /tmp/pack.log`.
9. **Lint**: `pnpm lint` (site) passes after embedding `<video>` element.
10. **Manual**:
    - Watch full 30s on retina screen at native 1080p — no compression artifacts on text, no audio clipping, transitions smooth.
    - Watch on mobile-sized browser window (375×812) — captions still legible.

---

## Scenario Coverage (UI tasks — required)

> The video embed in `site/` IS a UI change. A scenario should verify the player loads, autoplays muted, loops, and respects reduced-motion across desktop + mobile web.

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| (none for `site/` landing today — confirm via `ls .ai/scenarios/`) | — | 🆕 new |

**New scenarios to create:**

- `site-landing-video-autoplay` — flow: navigate to `/`, assert `<video>` element present + `currentTime > 0` after 1s + muted=true + loop=true. Platforms: web-desktop, web-mobile. Fixture: none (static page).
- `site-landing-reduced-motion` — flow: emulate `prefers-reduced-motion: reduce`, assert `<video>.paused === true`. Platforms: web-desktop.

The `scenario-runner` agent runs these as part of `/validate`. They're cheap (under 5s each) and catch the most likely regression (somebody removes the `muted` attribute, breaking autoplay).

---

## Acceptance Criteria

- [ ] All tasks 0-15 completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` passes overall:
  - [ ] Static (types, lint, format) — `site/` clean
  - [ ] Tests — none new; pipeline scripts run idempotently
  - [ ] Build — `site/` builds; final `demo.mp4` committed
  - [ ] **`scenario-runner`**: site-landing-video-autoplay + site-landing-reduced-motion green on web-desktop + web-mobile
  - [ ] `design-system-guard`: 0 blockers on the embedded video container
  - [ ] `a11y-auditor`: 0 blockers — `<video>` has `aria-label`, captions burned in (visible without audio), no autoplay sound (muted)
- [ ] `site/public/demo.mp4` exists, under 8 MB, exactly 30.0s, H.264 + AAC
- [ ] `site/public/demo-poster.jpg` exists, used as `<video poster>`
- [ ] GitHub README renders the video inline
- [ ] npm `--dry-run` does NOT include `demo.mp4`
- [ ] DDR recorded
- [ ] Music license URL committed in `scripts/video/storyboard.md`
- [ ] No DDR-worthy decision left unrecorded
- [ ] Captions strictly ASCII (no em dash, en dash, curly quotes, ellipsis char) per project memory
