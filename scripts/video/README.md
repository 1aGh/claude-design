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
