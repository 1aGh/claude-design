# Feature: Marketing Demo Video — 30s, agent-orchestrated

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Produce a 30-second 16:9 marketing/showcase video for `md-claude` that the agent (me) produces **end-to-end without human edits in a video editor**. The video stitches real screen recordings of the design plugin dev-server UI, the docs site (`site/`), and the Claude Code terminal flow, overlaid with infographic "title cards" and burned-in captions, scored with a royalty-free instrumental bed. Final artifact lives in `site/public/demo.mp4` and is embedded into both the docs landing page and `README.md`.

The agent orchestrates **every** step: spawns the dev-server, triggers UI interactions via `computer-use` + Bash, records segments with `screencapture -v` (macOS built-in) — falling back to `ffmpeg avfoundation` once installed — produces infographic frames by rendering HTML cards in a Chromium tab and screenshot-sequencing them, downloads music from Pixabay via WebFetch/curl, and assembles everything with `ffmpeg` (concat + drawtext + audio mix + scale/pad).

## User Story

As a **prospective md-claude user** landing on the docs site or GitHub README, I want a **30-second visual demo** so that I can grasp what the marketplace + plugins do — `mdcc init`, `/design:new`, the canvas dev server, `/design:edit` — **without reading a wall of text or installing anything**.

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
| 1 | Intro card | 3.0s | `render-card.mjs intro.html` | `md-claude — design + workflow plugins for Claude Code` |
| 2 | `mdcc init` terminal | 4.0s | `screencapture -v` of Terminal running `mdcc init` in `/tmp/scratch` | `Scaffold .ai/ in one command` |
| 3 | `/design:new` flow | 5.0s | `screencapture -v` of Claude Code terminal, scripted Q&A via computer-use type-into-app-when-allowed; speed 2× in post | `Brief → discovery → design system` |
| 4 | Dev-server canvas (hero) | 6.0s | `screencapture -v` of Chrome showing `Canvas Viewport`, Cmd+Click element select animation via claude-in-chrome MCP | `Live canvas with Cmd+Click inspector` |
| 5 | `/design:edit` magic | 6.0s | Split-screen: left half = Claude Code terminal showing `/design:edit "tighten the hero"`, right half = canvas auto-reloading. Composite in ffmpeg `hstack`. | `One feedback string → diff applied & reloaded` |
| 6 | Docs teaser | 3.0s | `screencapture -v` of `site/` localhost scroll OR real production https://md-claude.dev | `Docs at md-claude.dev` |
| 7 | Outro CTA | 3.0s | `render-card.mjs outro.html` | `npm i -g @1agh/md-claude · github.com/1aGh/md-claude` |

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

Per [no AI-tell punctuation] memory: **no em dash, en dash, curly quotes, ellipsis char, excess emoji** in any caption or card copy. ASCII hyphens, straight quotes, three periods if needed. Interpunct OK only in stamps like `npm i -g @1agh/md-claude`.

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

### Task 2: CREATE HTML card templates + `render-card.mjs`

- **Do**:
  1. `scripts/video/cards/intro.html`: 1920×1080, body uses `--bg`/`--ink`/`--accent` from active DS tokens; large wordmark "md-claude", tagline "design + workflow plugins for Claude Code". Subtle animation: 1s in (opacity 0→1 + 8px translate), 1s hold, 1s out — keyframes driven by a `data-t="0..3000"` attribute the renderer increments.
  2. `scripts/video/cards/outro.html`: install command in mono, GitHub URL, animated underline on accent color.
  3. `scripts/video/render-card.mjs`: Node ESM script. Uses Playwright (or Chrome MCP if Playwright not installed) to load the HTML at 1920×1080, then for `t in 0..duration` step `1000/fps`: set `body.dataset.t = t`, take a screenshot to `.work/cards/<name>/frame-<NNNN>.png`. After loop, run `ffmpeg -framerate 30 -i frame-%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 <name>.mp4`.
- **Pattern**: Same shell as `_screenshot-playwright.mjs` — Node ESM, accepts CLI args, exits on error.
- **Gotcha**: Playwright may not be a project dep yet. Check `package.json`; if absent, the script should detect and fall back to `npx -y playwright@latest`. Cache the install.
- **Validate**: `node scripts/video/render-card.mjs intro 3 && ffprobe scripts/video/.work/cards/intro.mp4 2>&1 | grep "30 fps"`.

### Task 3: CREATE `record-scene.sh`

- **Do**:
  1. POSIX shell script. Args: `--scene <id> --duration <sec> --region <x,y,w,h> --out <path>`.
  2. Primary path: `ffmpeg -f avfoundation -capture_cursor 1 -i "1:none" -t $DURATION -filter:v "crop=$W:$H:$X:$Y" -r 30 -c:v libx264 -pix_fmt yuv420p "$OUT"` (device index `1` is typically the main screen; auto-detect via the device list).
  3. Fallback: `screencapture -v -R "$X,$Y,$W,$H" -V "$DURATION" "$OUT.mov"` then `ffmpeg -i "$OUT.mov" -c:v libx264 -pix_fmt yuv420p "$OUT"`.
  4. Pre-flight: invoke `plugins/design/dev-server/bin/server-up.sh` if the scene needs the server (Scenes 4/5/6 with localhost canvas).
- **Pattern**: Two-tier ladder (primary ffmpeg / fallback screencapture) mirrors `plugins/design/dev-server/bin/screenshot.sh`.
- **Gotcha**: `screencapture -v -V N` exists on macOS 14+, but it includes a 5s countdown unless `-T 0` is added. Use `-T 0`.
- **Validate**: `bash scripts/video/record-scene.sh --scene smoke --duration 2 --region 0,0,640,480 --out /tmp/smoke.mp4 && ffprobe /tmp/smoke.mp4 2>&1 | grep "Duration: 00:00:02"`.

### Task 4: RECORD Scene 1 (intro card) + Scene 7 (outro card)

- **Do**: Run `render-card.mjs intro 3` and `render-card.mjs outro 3`. These do not require capture — they're rendered headlessly. Move outputs to `scripts/video/.work/scenes/01-intro.mp4` and `07-outro.mp4`.
- **Pattern**: n/a — straight invocation of Task 2's tool.
- **Gotcha**: Frame timing — confirm 3.0s × 30fps = 90 frames; off-by-one drift compounds across the 7 scenes.
- **Validate**: `ffprobe -v error -show_entries format=duration -of csv=p=0 scripts/video/.work/scenes/01-intro.mp4` returns `3.00...`.

### Task 5: RECORD Scene 2 (`mdcc init`)

- **Do**:
  1. Create `/tmp/scratch-mdcc-demo` (empty dir).
  2. Open Terminal at that path. Resize to a clean 1280×720 windowed region with white-on-black or solid theme.
  3. Start `record-scene.sh --scene 02-mdcc-init --duration 5 --region <terminal-bounds> --out 02-mdcc-init.mp4`.
  4. Via `computer-use` (terminal is tier "click" → no typing) — pre-load the command via clipboard (`pbcopy <<< "mdcc init && ls .ai"`), focus Terminal, click in window, use Cmd-V via key tool then Enter. Output streams during 4-second target window.
  5. Trim to exact 4.0s in `assemble.sh`.
- **Pattern**: Use clipboard pre-load to work around terminal typing-blocked tier.
- **Gotcha**: `mdcc init` output is dim by default — set `CLICOLOR_FORCE=1` and a high-contrast terminal theme before recording. Also: `mdcc` must be on PATH; if running from repo, alias to `node /Volumes/D/git/claude-design/cli/bin/mdcc.mjs`.
- **Validate**: Playback 02-mdcc-init.mp4 manually (one-off `open` call) and confirm the `.ai/` listing is legible at 1080p.

### Task 6: RECORD Scene 3 (`/design:new` flow)

- **Do**:
  1. Open a fresh Claude Code session in a Terminal window in `/tmp/scratch-mdcc-demo`.
  2. Pre-script the brief: "Show product hero for a local-first task app for designers, calm voice, generous whitespace."
  3. Start capture for 8s of raw footage (will be sped to 2× and trimmed to 5s).
  4. Computer-use clipboard-paste the brief; let the agent render its first Q&A; do not fully complete — just enough to show the discovery turn.
  5. In `assemble.sh`: `setpts=PTS/2` to 2×, trim to exact 5.0s.
- **Pattern**: Mirror Scene 2 clipboard workaround.
- **Gotcha**: Claude Code's animated cursor + spinner are the visual hook — make sure the 5s segment lands on visible streaming output, not idle prompt.
- **Validate**: 5.0s duration; eyeball-check that "design system" and the option-pool render are visible somewhere in the cut.

### Task 7: RECORD Scene 4 (dev-server canvas — hero)

- **Do**:
  1. `bash plugins/design/dev-server/bin/server-up.sh` against this repo (`--root /Volumes/D/git/claude-design`).
  2. Open Chrome to `http://localhost:<PORT>/canvas/ui/Canvas+Viewport` in fullscreen (Cmd+Ctrl+F).
  3. Start `record-scene.sh --duration 7 --region 0,0,1920,1080 --out 04-canvas-hero.mp4`.
  4. Via `claude-in-chrome` MCP (Chrome is tier "read" for computer-use → must use the chrome extension): perform Cmd+Click on a hero element to trigger inspector overlay, hold 1s, release, click a second element. The inspector ring animation is the wow moment.
  5. Trim to exact 6.0s.
- **Pattern**: Tier-aware MCP routing — Chrome interactions through `claude-in-chrome`, NOT `computer-use`.
- **Gotcha**: `claude-in-chrome` may not be connected — if not, ask the user to install. Hard requirement for Scene 4; without it, fall back to keyboard-only navigation (Cmd+Click is mouse-only, so fallback = manual narration via on-screen `data-demo-hint` overlays we'd have to add to the canvas). Prefer the extension.
- **Validate**: 6.0s duration; manual playback confirms at least one inspector overlay frame is visible.

### Task 8: RECORD Scene 5 (`/design:edit` split-screen)

- **Do**:
  1. Two recordings in parallel (or sequential then composited):
     - **Left**: Terminal showing `/design:edit "tighten the hero spacing, push CTA up"`. Same capture mechanics as Scene 2.
     - **Right**: Chrome canvas showing the auto-reload after the edit.
  2. Capture each at 960×1080 region (half-width).
  3. In assemble.sh: `ffmpeg -i left.mp4 -i right.mp4 -filter_complex hstack=inputs=2 05-edit.mp4`.
  4. The two recordings must share a timeline — record left first (4s lead-in to type/run the command), then record right starting at "edit applied" reload, padding left with the trailing terminal state.
- **Pattern**: `hstack` composition; mirrors how some marketing videos show terminal+browser side-by-side.
- **Gotcha**: Time alignment is the hard part — the right pane must reload at exactly the moment the left pane shows "applied". Acceptable: 200ms slop. Use a clapperboard frame (visible counter top-right via on-screen overlay or simply by syncing on the `_active.json` `last_change` timestamp printed in both panes).
- **Validate**: 6.0s duration; left + right are temporally consistent (edit→reload moment visible in same second).

### Task 9: RECORD Scene 6 (docs teaser)

- **Do**:
  1. Decide: real `site/` localhost (run `pnpm --filter site dev`) OR `.design/ui/Docs Site.tsx` mock. Default to the **real site** if the landing renders cleanly; otherwise the mock canvas — note choice in storyboard.
  2. Smooth scroll from top to mid-page over 3.0s. Use Chrome MCP `scroll` with easing if available; else CSS `scroll-behavior: smooth` triggered by a hashchange.
  3. `record-scene.sh --duration 4 --region 0,0,1920,1080 --out 06-docs.mp4`; trim to 3.0s.
- **Pattern**: Same Chrome MCP routing as Scene 4.
- **Gotcha**: First-load CLS will look terrible on camera. Pre-warm the page (load once, wait 2s) before recording.
- **Validate**: 3.0s duration; hero + at least one section visible in the scroll path.

### Task 10: CREATE `assemble.sh` — final ffmpeg pipeline

- **Do**:
  1. Inputs: `01-intro.mp4` ... `07-outro.mp4` + `music.mp3`.
  2. Normalize each clip: `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`.
  3. Concat with xfade transitions (300ms, `fade`) between scenes — use the filter_complex xfade chain with cumulative offset math.
  4. Burn captions: `drawtext=fontfile=...:text='...':fontsize=44:fontcolor=...@0.95:x=(w-text_w)/2:y=h-160:enable='between(t,T0,T1)'`. One drawtext per scene with a `between(t, ...)` enable expression so captions appear/disappear per scene. Background plate behind text: `drawbox` with 50% alpha for legibility.
  5. Audio: trim music to 30s, fade in 1s / fade out 2s, normalize to -18 LUFS via `loudnorm=I=-18:LRA=11:TP=-1.5`.
  6. Encode: 2-pass H.264. Pass 1: `-b:v 2200k -pass 1 -an -f null /dev/null`. Pass 2: `-b:v 2200k -pass 2 -c:a aac -b:a 128k -movflags +faststart -shortest site/public/demo.mp4`.
  7. Extract poster: `ffmpeg -i site/public/demo.mp4 -vf "select=eq(n\,0)" -vframes 1 -q:v 2 site/public/demo-poster.jpg`.
- **Pattern**: Standard ffmpeg pipeline; document each filter so future me can debug.
- **Gotcha**:
  - xfade `offset` is cumulative and **subtracts** the transition duration — bad math = black gaps. Compute once into shell variables.
  - 2200 kbps × 30s ≈ 8.25 MB before audio — tune to land under 8 MB total. If over, drop to `-b:v 1800k`.
  - `loudnorm` 2-pass is more accurate (`-af loudnorm=...:print_format=json` first); single-pass is fine for v1.
  - macOS ffmpeg from Homebrew should ship libx264 + libfreetype by default; if drawtext errors with "Could not load font", fall back to `-vf` `subtitles=captions.srt:force_style='FontSize=24,...'`.
- **Validate**:
  - `ffprobe -v error -show_entries format=duration,size -of default=nw=1 site/public/demo.mp4` → duration 30.00s ±0.05, size < 8 MB.
  - `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0` → `aac`.
  - Manual: `open site/public/demo.mp4`, watch full 30s, every caption legible, no black gaps, audio bed audible but not overpowering.

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
- **Validate**: View README on github.com/1aGh/md-claude, confirm video renders inline.

### Task 13: EXCLUDE video from npm publish

- **Do**:
  1. `package.json` `files` is allowlist-based (CLAUDE.md confirms). Verify `site/public/demo.mp4` is **NOT** matched by any entry.
  2. If `site/` is currently NOT in `files`, no action needed. Add a comment in `package.json` `// _note` or in `CONTRIBUTING.md` clarifying the video is a repo artifact, not a published one.
- **Pattern**: Mirrors how design plugin commands stay out of npm (per CLAUDE.md "Published npm surface").
- **Gotcha**: If anyone adds `site/` to `files` later, an 8 MB MP4 ships to every `npm i` user. Add a parity check script: `scripts/check-publish-size.sh` that runs `npm pack --dry-run --json | jq '.[0].size'` and fails over 1 MB.
- **Validate**: `npm pack --dry-run 2>&1 | grep -c demo.mp4` returns `0`.

### Task 14: DOCUMENT the pipeline in `scripts/video/README.md`

- **Do**: A short README explaining: prerequisites (ffmpeg, Screen Recording grant, claude-in-chrome MCP), how to re-record each scene independently, how to regenerate the final cut, where the music license lives.
- **Pattern**: Match `plugins/design/dev-server/bin/README.md` if it exists, else `plugins/flow/templates/ai-skeleton/README.md` tone.
- **Gotcha**: This is for *future agents/devs re-running the pipeline*. Include the exact terminal window size used so re-records match the original framing.
- **Validate**: A fresh agent reading only this README can reproduce the video.

### Task 15: RECORD a DDR

- **Do**: Create `.ai/decisions/DDR-NNN-agent-orchestrated-marketing-video-pipeline.md`. Document the choices: ffmpeg over OBS (scriptable), screencapture as fallback (no-install), Pixabay over commissioned audio (cost), 16:9 master (web-first per user answer), commit MP4 to repo (under 8 MB, reproducibility) vs LFS (overkill at this size).
- **Pattern**: Existing DDRs in `.ai/decisions/`.
- **Gotcha**: Reference DDR-009 (Bun runtime) and DDR-025 (canvas-lib single source) since the dev-server lifecycle is part of the recording pipeline and future Bun migration will change Task 7's bash recipe.
- **Validate**: DDR follows project DDR schema; cross-linked from this plan.

---

## Validation

Run these commands to confirm zero regressions:

1. **ffmpeg present**: `ffmpeg -version | head -1`
2. **Pipeline end-to-end (idempotent)**: `bash scripts/video/download-music.sh && bash scripts/video/render-all.sh && bash scripts/video/assemble.sh` — exits 0, produces `site/public/demo.mp4` with `duration=30.0`, `size < 8 MB`.
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
