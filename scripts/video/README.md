# Video pipeline

Toolchain for maude marketing/demo videos.

**Remotion license ack** (2026-05-20): maude is solo OSS, qualifies for the
Remotion free tier (https://www.remotion.dev/docs/license). If the org ever
grows beyond 3 people, a Company License is required before this stack can keep
rendering.

## What it is

Four tools, one pipeline:

| Stage | Tool | Role |
| --- | --- | --- |
| Terminal capture | VHS (charmbracelet) | Headless ttyd recording from a `.tape` DSL file |
| Browser capture | Playwright | Chromium scripted by `*.spec.ts`, native video output |
| Compose | Remotion | React composition for cards, transitions, captions |
| Post | ffmpeg | Normalize + concat |

The smoke (`scripts/video/smoke/`) exercises all four tools end-to-end on a
3-clip 13s stitched output. It is purely a toolchain-integration proof. Brand
polish and marketing content live in the follow-up plan
(`.ai/plans/phase-15.5-marketing-demo-video-30s.md`).

## Prereqs (one-time)

```sh
brew install ffmpeg vhs
pnpm install
pnpm exec playwright install chromium
```

No macOS Screen Recording permission needed. VHS runs ttyd headlessly,
Playwright runs Chromium headlessly. Permission only matters if a later phase
falls back to `screencapture -v` for native UI capture.

## Quick start

```sh
pnpm run video:smoke
```

Expect: `Toolchain green` banner in ~30s. Output at
`scripts/video/.work/smoke/smoke.mp4` (h264, 1280x720, 30fps, no audio,
~13s).

## Per-tool smokes (debugging only)

When the full smoke fails, isolate via:

```sh
pnpm run video:smoke:terminal   # VHS only -> .work/smoke/terminal.mp4
pnpm run video:smoke:browser    # Playwright only -> .work/smoke/playwright/.../video.webm
pnpm run video:smoke:card       # Remotion only -> .work/smoke/card.mp4
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `vhs: command not found` | brew package missing | `brew install vhs` |
| VHS produces a 0-byte mp4 | ffmpeg missing from PATH inside the ttyd subprocess | `brew install ffmpeg`, restart shell |
| VHS: `could not open ttyd: ERR_CONNECTION_REFUSED` | transient ttyd startup race | re-run; if persistent, kill leftover ttyd procs (`pkill ttyd`) |
| VHS Output rejects absolute paths | `Output /tmp/...` is parsed as 3 commands | use a path relative to repo root: `Output scripts/video/.work/...` |
| Playwright: "Browser not found" | `playwright install` skipped | `pnpm exec playwright install chromium` |
| Playwright outputDir lands in `scripts/video/smoke/scripts/...` | relative path resolved against config dir | use the absolute path in `playwright.config.ts` (already wired) |
| Remotion render hangs at "Bundling" | Vite/esbuild cache corrupted | `rm -rf node_modules/.vite` |
| Remotion card.mp4 has a silent AAC track | default behavior | pass `--mute` to `remotion render` (already wired in run.sh and `video:smoke:card`) |
| `concat -c copy` fails with "Non-monotonous DTS" | fps drift between inputs | `assemble.sh` pre-normalizes each input to 30fps/h264/yuv420p/no-audio before concat — if you bypass it, re-encode the concat with `-c:v libx264 -preset veryfast` |
| Browser smoke shows a black frame | dev server not up or wrong URL | check `.design/_server.json` is fresh, re-run `plugins/design/dev-server/bin/server-up.sh` |
| Playwright video.webm not found by glob | test failed without producing a recording | run `video:smoke:browser` standalone and inspect the per-test directory under `.work/smoke/playwright/` |

## What's next

When this smoke is green, run the marketing demo plan:
[`.ai/plans/phase-15.5-marketing-demo-video-30s.md`](../../.ai/plans/phase-15.5-marketing-demo-video-30s.md).
The toolchain there is the same; only the scenes and assembly change.

---

# Workspace layout (phase 15.1)

The actual marketing pipeline lives in a nested Remotion workspace:

```
scripts/video/
├── final/                              <- nested Remotion workspace
│   ├── package.json                    own deps, own node_modules
│   ├── pnpm-workspace.yaml             onlyBuiltDependencies: esbuild
│   ├── remotion.config.ts              h264, crf 23, 30 fps
│   ├── src/
│   │   ├── index.ts                    registerRoot(Root)
│   │   ├── Root.tsx                    composition registry
│   │   ├── load-font.ts                JetBrains Mono fallback
│   │   ├── lib/
│   │   │   ├── tokens.ts               mirrors .design/system/project/colors_and_type.css
│   │   │   ├── captioned-clip/         cherry-picked from template-tiktok
│   │   │   └── animated/               remotion-bits + remotion-animated
│   │   └── scenes/<id>/index.tsx       one folder per scene
│   ├── sub.mjs                         build-time Whisper.cpp captioning
│   ├── whisper-config.mjs              model + lang + cache path
│   ├── __tests__/frame-regression.test.ts   goldens harness
│   ├── __goldens__/*.png                     committed baselines
│   └── public/                         scene MP4s + Caption JSON + music
├── music/                              committed CC0 instrumentals
│   └── MANIFEST.md                     license + URL per track
├── smoke/                              phase 15 smoke (untouched)
├── tapes/    .tape files               VHS terminal scenes (phase 15.5)
├── raw/      .cast files               asciinema sources for snippet montage
└── playwright/  *.spec.ts              browser scene specs (phase 15.5)
```

The nested workspace is intentional: Remotion deps stay isolated from the root
`maude` CLI tree. The smoke (`scripts/video/smoke/`) renders its card through
the nested workspace via the `video:smoke:card` script.

## Adding a new scene

```sh
/flow:video-new-scene <scene-id> <duration-seconds> "<caption>"
```

Example:

```sh
/flow:video-new-scene 03-setup-ds-flow 6.0 "Vision -> research -> refinement"
```

The command:
1. Creates `scripts/video/final/src/scenes/<scene-id>/index.tsx` from a template.
2. Registers a `<Composition>` in `Root.tsx` (numeric-prefix-sorted insertion).
3. Appends a row to `scripts/video/storyboard.md` (creates it if missing).

Idempotent — refuses to overwrite without `--force`.

Then iterate:

```sh
cd scripts/video/final
pnpm run studio                                      # live preview, hot-reloads
pnpm run render scene-03-setup-ds-flow out/03.mp4    # render single scene
```

## Captions workflow

Captions are **build-time**, not render-time. The `sub.mjs` script walks
`scripts/video/final/public/` for video files, runs Whisper.cpp, and writes
`Caption[]` JSON next to each input.

```sh
cd scripts/video/final
pnpm run caption                                  # process everything in public/
pnpm run caption public/scene-02-maude-init.mp4   # single file
WHISPER_LANG=cs pnpm run caption                  # Czech (needs large-v3 model)
```

First run downloads the Whisper.cpp source + the `medium.en` model (~466 MB
into `scripts/video/final/.whisper-cache/`, gitignored). Subsequent runs cache.

**Caption JSON is editable.** Whisper mistranscribes our jargon ("Claude" as
"cloud", "MCP" as "MCBP", "maude" as "mode"). Patch the JSON by hand and
re-render — do not re-prompt Whisper.

Drop a captioned clip into a composition via:

```tsx
import { CaptionedClip } from './lib/captioned-clip';
import scene02Captions from '../public/scene-02-maude-init.json';

<CaptionedClip src="scene-02-maude-init.mp4" captions={scene02Captions} />
```

Pass `captions={null}` if a scene already has a burnt-in lower-third caption
and shouldn't get TikTok-style word-by-word overlays.

## Visual QA workflow (mandatory before delivery)

Regression goldens (next section) catch DS-token drift on synthetic scenes,
but the **assembled cut** layers VHS terminal captures + Playwright browser
captures into one MP4 — these external inputs change, so goldens can't
regress against them. After every re-capture or scene refactor, run the QA
frame-grid:

```sh
cd scripts/video/final
pnpm run qa             # default: Final composition, 12 frames
pnpm run qa:render      # force re-render even if MP4 exists
pnpm run qa Demo 20     # different composition, more frames
```

The script:
1. Renders the composition if `out/<comp>.mp4` is missing.
2. Extracts N evenly-spaced JPGs at half resolution into `__qa__/<comp>/`.
3. Builds a 4×3 contact sheet PNG (`__qa__/<comp>/contact-sheet.png`).
4. Prints frame paths in agent-readable format (`QA_FRAME <path>`) plus the
   contact sheet path.

**Workflow:**

- **Agent (Claude Code):** read each `QA_FRAME` path via the Read tool —
  Claude is multimodal and sees the JPG directly. Check every scene + every
  xfade transition for layout glitches, leaked setup commands, empty bg, etc.
- **Human:** `open __qa__/Final/contact-sheet.png` — one image, whole video
  at a glance, easy eyeball pass before delivery.

Without this step, gotchas like the ones in DDR-036 ("Lessons from first
real assembly") leak into the delivered video. Visual verification is
mandatory before sending the final cut to a human consumer.

## Tape discipline (VHS gotchas)

```sh
cd scripts/video/final
pnpm run lint:tape
```

Greps `scripts/video/tapes/*.tape` for the two pitfalls documented in
`scripts/video/tapes/_TEMPLATE.tape`:

1. **Canvas size 1280×720** (not 1920×1080) — terminal output never fills
   1080p, leaves 60% empty bg. Remotion scales 1280×720 cleanly via
   `objectFit:contain` inside the `<TerminalFrame>` wrapper.
2. **Hide block must contain `Type "clear" Enter` before `Show`** — VHS
   `Hide`/`Show` controls frame capture, not the shell buffer. Without
   `clear`, the supposedly-hidden setup commands leak into captured frames.

Copy `scripts/video/tapes/_TEMPLATE.tape` as a starting point — both
gotchas are pre-wired with explanatory comments.

## Capture scene wrappers

Two reusable React components in `scripts/video/final/src/lib/capture-frames/`:

```tsx
import { BrowserChrome, TerminalFrame } from '../lib/capture-frames';

<TerminalFrame src="scene-terminal.mp4" />
<BrowserChrome src="scene-browser.mp4" urlBar="localhost:4399" />
```

Both accept `src` as a prop pointing into `public/` so adding a new capture
scene = author the .tape or .spec.ts, drop the resulting MP4 into `public/`,
compose with the wrapper. No copy-pasted JSX for the chrome frame.

## Regression goldens

The marketing video must not silently drift when DS tokens change. Goldens
render frame 0 / middle / -1 of every scene composition and diff against
committed PNGs.

```sh
cd scripts/video/final
pnpm run goldens:check    # diff vs committed goldens, exit 1 on regression
pnpm run goldens:update   # overwrite goldens with current renders
                          # (use ONLY after intentional visual changes)
```

Threshold: 0.5% mismatched pixels per frame (font anti-aliasing tolerant).
Diffs land at `__goldens__/.diff/<scene>-<frame>.diff.png` for inspection.

When you change tokens or a scene's layout intentionally, run
`pnpm run goldens:update` then commit the updated PNGs alongside the code
change so the diff is reviewable.

## Music

Curated CC0 / Pixabay-License instrumentals committed to `scripts/video/music/`.

```sh
ls scripts/video/music/             # see committed tracks
cat scripts/video/music/MANIFEST.md # license + URL per track
```

Reference by filename in compositions:

```tsx
import { Audio, staticFile } from 'remotion';
<Audio src={staticFile('quiet-progress-92bpm-pixabay.mp3')} volume={0.6} />
```

Add new tracks per the MANIFEST.md instructions (filename convention,
license URL mandatory).

## CSS motion guard

Remotion renders deterministically frame-by-frame. CSS `transition:` /
`animation:` work in Studio (browser playback) but produce broken frames at
render time. Catch this pre-render:

```sh
cd scripts/video/final
pnpm run lint:motion
```

Use `interpolate()` + `useCurrentFrame()`, or the `<Animated by={[Fade(), Move(...)]}>`
declarative API from `lib/animated/`.

## CI

There is no GH Actions workflow for video rendering. Local M-series renders
are faster than `ubuntu-latest` hosted runners (~4-6 min for a 55s 1080p
clip locally; CI would be the same or slower). If a future contributor needs
CI, see the deferred Task 10 in
[`.ai/plans/phase-15.1-video-pipeline-infrastructure.md`](../../.ai/plans/phase-15.1-video-pipeline-infrastructure.md).
