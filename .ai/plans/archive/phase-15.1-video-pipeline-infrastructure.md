# Feature: Video pipeline infrastructure — Remotion-native workspace + skills + caption + regression harness

> **Sandwich position.** Phase 15 ([`archive/phase-15-video-pipeline-toolchain.md`](./archive/phase-15-video-pipeline-toolchain.md))
> proved the toolchain compiles (`pnpm run video:smoke` exits 0). Phase 15.5
> ([`phase-15.5-marketing-demo-video-30s.md`](./phase-15.5-marketing-demo-video-30s.md))
> composes the real ~55s demo. **This plan (15.1) sits between them** and lifts the
> infrastructure from "bash + ad-hoc Remotion entry" to "proper Remotion workspace
> with skills, captioning, regression tests, scaffolder." After this phase, future
> videos (release announcements, feature demos, tutorials) are author-storyboard-and-render,
> not debug-ffmpeg-again.
>
> Research lineage (2026-05-20):
> - `asciinema-mp4` (lhr0909) is dead — last commit 2023-01-30, 0 issues, 0 PRs.
>   Don't depend on it. Use `asciinema/agg` (active, v1.8.1 May 2026) + ffmpeg
>   for terminal scenes that VHS cannot capture cleanly.
> - `DojoCodingLabs/remotion-superpowers` is a Claude Code prompt-plugin requiring
>   5 paid SaaS APIs (TwelveLabs, ElevenLabs, Replicate, Suno via KIE, Pexels) —
>   wrong fit for solo OSS no-SaaS posture. Skip the plugin; reference its
>   captioning macro markdown only if useful.
> - The real "all-in-one" for us = oficial Remotion Agent Skills (`npx skills add
>   remotion-dev/skills`) + TikTok template's `sub.mjs` Whisper pipeline +
>   `remotion-bits` / `remotion-animated` for animation primitives.

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Restructure `scripts/video/` into a proper Remotion workspace (own `package.json`, `tsconfig.json`, `remotion.config.ts`, Studio entry) and bolt on the infrastructure that makes every future video cheap to produce:

1. Install the **official Remotion Agent Skills** globally (`npx skills add remotion-dev/skills`) so any agent in this repo (or downstream) has on-demand access to the 37 Remotion best-practice rule files.
2. Adopt the **TikTok template's build-time captioning pipeline** (`@remotion/install-whisper-cpp` + `sub.mjs` + `Caption[]` JSON next to each input MP4) — cherry-pick `Page.tsx` + `SubtitlePage.tsx`, drop the rest.
3. Add **`remotion-bits` + `remotion-animated`** for `<AnimatedText>` / chained spring animations, retiring most of the hand-rolled `interpolate()` boilerplate in cards.
4. Switch Playwright browser scenes from WebM-transcode-to-MP4 to direct `<OffthreadVideo src="...webm" />` ingest, saving the transcode step and one ffmpeg invocation per scene.
5. Build a **golden-frame regression harness** (`renderStill()` + `pixelmatch` + `__goldens__/`) so DS-token drift doesn't silently break the marketing cut.
6. Add a **`/design:video-new-scene` scaffolder** (skill or thin command) that emits `scenes/<slug>/index.tsx` + registers the composition + appends a row to the storyboard table.
7. Add a **Biome override** under `scripts/video/` that forbids CSS `transition:` / `animation:` style props (a known Remotion footgun the official skill warns about).
8. Land a **CI render workflow** (`.github/workflows/video-render.yml`) — matrix-renders scenes individually on `ubuntu-latest`, concats with ffmpeg, uploads artifacts. Gated/manual trigger only (no auto-run on every push — burning 4-min minutes per commit is silly).
9. Curate a **`scripts/video/music/` set** of 6-10 CC0 instrumentals committed to the repo (Pixabay has no music API; Freesound API exists but no BPM filter on music; curating once + referencing by filename in storyboard is the right shape for a solo maintainer shipping ~10 videos/year).
10. Update **`phase-15.5`** to reference this new shape (smaller diff than the previous phase-15 → phase-15.5 fold, since 15.5 already cites Remotion + Playwright + ffmpeg).

This plan ships **zero marketing video** of its own. Output = the workspace and the harness that 15.5 (and every future video plan) consumes.

## User Story

As the **maude maintainer producing many marketing/demo/release videos over the next year**, I want a **single-file-edit dev loop** (open `scripts/video/final/src/scenes/<n>.tsx`, see it update live in Remotion Studio, run one render) so that authoring video #5 takes an afternoon, not a week of toolchain re-debugging.

## Problem

- `scripts/video/` today is a flat dir with `cards/`, `final/`, `playwright/`, `tapes/`, `raw/`, `lib/`, `smoke/`. There is no `package.json`, no `tsconfig.json`, no Studio entry — Remotion is invoked from the repo root with positional args, and dependencies pollute root `node_modules`.
- Captions are hand-authored ASCII strings in storyboard.md → burnt into `<LowerThird>` via `interpolate()`. There is no transcription pass and no path to TikTok-style word-by-word captions, even though that's a 1-day swap.
- No regression test of any kind on the rendered output. If `--accent` token changes color, the demo video silently goes off-brand until someone notices on YouTube.
- Adding a new scene today means: edit storyboard.md, edit `final/Final.tsx` (hand-write `<Sequence>`), edit Root.tsx, edit render-all-scenes.sh, hope you renumbered correctly. No scaffolder.
- CSS `transition:` / `animation:` work in dev but produce flickering / missing frames in Remotion's deterministic render — a known footgun. Today nothing flags it.
- CI never renders the video. The only proof it works = the maintainer manually running `pnpm exec remotion render ...` after every storyboard edit.
- Music sourcing today = curl one URL into `.cache/`, gitignored, ephemeral. Re-running phase 15.5 after a year requires re-finding the same track on Pixabay.
- Phase 15.5's task list (16 tasks) inherits this missing infra and re-litigates pieces of it inline.

## Solution

A standalone `scripts/video/final/` package + 9 infra additions, all reversible, all local, no SaaS:

```
scripts/video/
├── final/                       ← NEW: standalone Remotion workspace
│   ├── package.json             ← own deps; not in root node_modules
│   ├── tsconfig.json            ← jsx:react-jsx, moduleResolution:Bundler
│   ├── remotion.config.ts       ← codec/CRF/fps defaults
│   ├── src/
│   │   ├── Root.tsx             ← composition registry (one <Composition> per scene + Final + Final30)
│   │   ├── index.ts             ← registerRoot entry
│   │   ├── load-font.ts         ← @remotion/google-fonts setup
│   │   ├── lib/
│   │   │   ├── tokens.ts        ← mirrors active DS tokens (already exists at cards/tokens.ts)
│   │   │   ├── captioned-clip/  ← cherry-picked from template-tiktok (Page.tsx + SubtitlePage.tsx)
│   │   │   └── animated/        ← re-exports from remotion-bits + remotion-animated wrappers
│   │   ├── scenes/              ← one folder per scene, scaffolded by /design:video-new-scene
│   │   │   ├── 01-intro/index.tsx
│   │   │   ├── 02-maude-init/index.tsx
│   │   │   └── …
│   │   ├── compositions/
│   │   │   ├── Final.tsx
│   │   │   └── Final30.tsx
│   │   └── sub.mjs              ← build-time Whisper.cpp captioning (cherry-picked from template-tiktok)
│   ├── public/                  ← input MP4/WebM, music, JSON captions
│   ├── __goldens__/             ← committed PNG goldens (frame snapshots per scene)
│   └── __tests__/
│       └── frame-regression.test.ts  ← renderStill + pixelmatch
├── music/                       ← NEW: curated CC0 instrumentals (committed)
│   ├── MANIFEST.md              ← per-track license + URL + BPM + duration
│   └── *.mp3
├── tapes/  raw/  playwright/    ← unchanged from 15/15.5
└── smoke/                       ← unchanged (toolchain smoke from phase 15)

.github/workflows/video-render.yml   ← NEW: manual-trigger matrix render
plugins/flow/commands/video-new-scene.md   ← NEW: scaffolder
```

## Metadata

- **GitHub Issue**: n/a (internal initiative; unblocks phase 15.5 + every future video phase)
- **Type**: Infrastructure refactor (no shipping artifact; enables future content)
- **Complexity**: Medium — Remotion workspace restructure + 4 new tooling installs (Whisper.cpp, remotion-bits, remotion-animated, pixelmatch) + 1 CI workflow + 1 scaffolder skill + Biome override
- **App/Package**: `scripts/video/final/` (new nested workspace) + `.github/workflows/` + `plugins/flow/commands/`
- **Affected Systems**: Root `package.json` (devDeps shrink — Remotion moves to `scripts/video/final/`), `biome.json` (override), `.gitignore` (Whisper model cache, `__goldens__/.diff/`)
- **Dependencies**:
  - **Homebrew**: nothing new (ffmpeg + vhs already from phase 15)
  - **npm (under `scripts/video/final/`)**: `@remotion/install-whisper-cpp`, `@remotion/captions`, `remotion-bits`, `remotion-animated`, `pixelmatch`, `pngjs`, `@types/pngjs`
  - **`asciinema/agg`**: optional brew install, only as VHS fallback for full-screen TUI scenes (Claude Code REPL animated spinners)
  - **Whisper.cpp model**: `medium.en` (~466 MB, gitignored cache) — installed lazily by `sub.mjs` on first run
  - **Vercel Labs skills CLI**: `npx skills add remotion-dev/skills` — global one-shot, no project file

---

## Context References

### Must-Read Files

- `.ai/plans/archive/phase-15-video-pipeline-toolchain.md` (full) — Why: the smoke pipeline this plan upgrades. Specifically the `cards/SmokeCard.tsx` shape gets refactored into the new workspace layout in Task 2.
- `.ai/plans/phase-15.5-marketing-demo-video-30s.md` (full) — Why: the downstream consumer. Task 11 of this plan edits 15.5 in place to reference the new workspace + caption pipeline + scaffolder.
- `scripts/video/storyboard.md` (full) — Why: source of truth for scene list, captions, and music license. Must remain backwards-compatible with the new workspace's `Root.tsx` composition registry — same scene numbering, same caption strings.
- `scripts/video/smoke/card/SmokeCard.tsx` + `scripts/video/smoke/card/index.ts` — Why: prior art for the minimal Remotion entry. The new workspace's `Root.tsx` mirrors this shape but with multiple compositions.
- `plugins/design/dev-server/bin/screenshot.sh` (full) — Why: prior art for the "ladder discipline" pattern that the new `final/package.json` scripts mirror (`studio` → primary, `render:scene` → secondary, `render:goldens` → tertiary).
- `biome.json` (root) — Why: must add `overrides` block scoped to `scripts/video/final/**` forbidding `transition:` / `animation:` in inline style objects.
- `package.json` (root) — Why: the `video:*` scripts move from root into `scripts/video/final/package.json`; root keeps `video:smoke` (phase 15) and adds a single passthrough `video` script that delegates to the nested workspace.
- `plugins/flow/CATEGORIES.md` — Why: confirm `design:` is the right namespace for `/design:video-new-scene` (it is — scaffolds a Remotion comp the same way `/design:new` scaffolds a canvas).
- `plugins/design/skills/design-system/SKILL.md` — Why: pattern reference for the new scaffolder skill (frontmatter shape, `args:` handling, bootstrap-mode vs read-mode split).

### Files to Create

- `scripts/video/final/package.json` — Standalone workspace manifest. Scripts: `studio`, `render`, `render:scene`, `caption`, `goldens:update`, `goldens:check`, `test`. devDeps: see "Dependencies" above.
- `scripts/video/final/tsconfig.json` — `jsx: react-jsx`, `moduleResolution: Bundler`, `strict: true`, `paths: { "@/*": ["./src/*"] }`.
- `scripts/video/final/remotion.config.ts` — H.264, CRF 23, 30 fps, 1920×1080, `Config.setVideoImageFormat('jpeg')` for fast renders, `Config.setConcurrency(2)` for CI parity.
- `scripts/video/final/src/index.ts` — `registerRoot(Root)`.
- `scripts/video/final/src/Root.tsx` — Composition registry. One `<Composition id="scene-NN-...">` per scene + `<Composition id="Final">` + `<Composition id="Final30">`. Per-scene compositions enable Studio to preview each scene in isolation and enable the regression harness to `selectComposition` by id.
- `scripts/video/final/src/load-font.ts` — `@remotion/google-fonts` loader for the project's mono + display fonts (read from active DS `colors_and_type.css`).
- `scripts/video/final/src/lib/tokens.ts` — Move from `scripts/video/cards/tokens.ts`. Same shape, mirror active DS.
- `scripts/video/final/src/lib/captioned-clip/Page.tsx` + `SubtitlePage.tsx` — Cherry-picked from [template-tiktok/src/CaptionedVideo/](https://github.com/remotion-dev/template-tiktok/tree/main/src/CaptionedVideo). Dependencies: `@remotion/captions` (`createTikTokStyleCaptions`, `Caption` type) + project fonts. Skip `NoCaptionFile.tsx` + `index.tsx` (template-specific).
- `scripts/video/final/src/lib/animated/index.ts` — Re-exports from `remotion-bits` (`AnimatedText`, `GradientTransition`) and `remotion-animated` (`Animated`, `Move`, `Scale`, `Fade`). One import surface so scenes don't reach into two packages directly.
- `scripts/video/final/sub.mjs` — Build-time captioning. Walks `public/`, runs `transcribe()` for each MP4, writes `<name>.json` (Caption[]). Lifted from [template-tiktok/sub.mjs](https://github.com/remotion-dev/template-tiktok/blob/main/sub.mjs); strip the multi-language detection bits since our captions are English+Czech-tech-jargon (manual editable JSON is the escape hatch).
- `scripts/video/final/__tests__/frame-regression.test.ts` — Render frame 0, frame mid, frame -1 for each per-scene composition via `renderStill`; diff against `__goldens__/<scene-id>-f<N>.png` via `pixelmatch`; threshold 0.5% mismatched pixels per frame. Runs in `bun:test`.
- `scripts/video/final/__goldens__/.gitkeep` — Placeholder; goldens populated by `npm run goldens:update` (manual after intentional visual changes).
- `scripts/video/music/MANIFEST.md` — Per-track table: filename, source URL, license, BPM, duration, mood tags. Curated 6-10 tracks.
- `scripts/video/music/*.mp3` — The actual CC0 instrumentals (committed; ~6-15 MB total — well under repo size budgets).
- `.github/workflows/video-render.yml` — Manual `workflow_dispatch` trigger only. Matrix: one job per scene id + one final assembly job. apt-get install of Remotion's documented Linux deps. `actions/cache` for Chrome Headless Shell. Uploads `demo.mp4` + `demo-30s.mp4` + per-scene MP4s as artifacts. Total expected wall-time: ~6-8 minutes for 9 scenes parallel + 2 min assembly.
- `plugins/flow/commands/video-new-scene.md` — Scaffolder command. **NOTE: lives in `plugins/flow/`, not `plugins/design/`.** Reason: the marketing video pipeline is generic project infrastructure (every maude-using project may want demo videos), not a design-system-canvas artifact. Frontmatter: `name: flow:video-new-scene`, `category: setup`, `description: Scaffold a new Remotion scene under scripts/video/final/src/scenes/`. Args: `<scene-id> <duration-seconds> "<caption>"`. Generates `src/scenes/<id>/index.tsx` from a template, appends `<Composition>` to `Root.tsx`, appends a row to `storyboard.md`. Idempotent (refuses to overwrite an existing scene without `--force`).
- `plugins/flow/CATEGORIES.md` (UPDATE) — Add `video-new-scene` to the `setup` group with a one-liner. Decision note: lives under `flow:` not `design:` because video pipeline is project-agnostic infrastructure; same reason as `flow:setup-prd` vs `design:setup-ds`.
- `scripts/video/README.md` (UPDATE) — Append a "Workspace layout" section linking to `final/package.json` scripts; append a "New scene scaffolder" section pointing at `/flow:video-new-scene`; append a "Regression goldens" section explaining when to run `goldens:update`.
- `biome.json` (UPDATE) — Add `overrides` block:
  ```jsonc
  {
    "overrides": [
      {
        "include": ["scripts/video/final/**/*.tsx", "scripts/video/final/**/*.ts"],
        "linter": {
          "rules": {
            "nursery": {
              "noRestrictedSyntax": {
                "level": "error",
                "options": {
                  "syntax": ["JSXAttribute[name.name='style'] ObjectExpression Property[key.name=/^(transition|animation|animationName|transitionProperty)$/]"]
                }
              }
            }
          }
        }
      }
    ]
  }
  ```
  Selector flags CSS `transition` / `animation` props in inline style objects — the documented Remotion footgun.
- `.gitignore` (UPDATE) — Add `scripts/video/final/.whisper-cache/`, `scripts/video/final/__goldens__/.diff/`, `scripts/video/final/out/`.
- `package.json` (UPDATE) — Remove root-level `remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `react`, `react-dom`, `@types/react`, `@types/react-dom` devDeps (they move to `final/package.json`). Keep `@playwright/test`. Add root passthrough `"video:render": "npm --prefix scripts/video/final run render"`. Keep `"video:smoke"` from phase 15 as-is.

### Documentation

- [Remotion Agent Skills](https://www.remotion.dev/docs/ai/skills) — Why: confirms `npx skills add remotion-dev/skills` is the official install path; the package is open Agent Skills format (Anthropic-originated, MIT) usable by Claude Code's `~/.claude/skills/` or `.claude/skills/`.
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — Why: the generic skill installer CLI. Pass `--agent claude-code` explicitly to avoid the known footgun ([issue #851](https://github.com/vercel-labs/skills/issues/851)) where flag combos write to `~/.agents/skills/`.
- [@remotion/install-whisper-cpp](https://www.remotion.dev/docs/install-whisper-cpp/) — Why: API used by `sub.mjs`. `installWhisperCpp({ to, version })` + `downloadWhisperModel({ model: 'medium.en', folder })` + `transcribe({ model, whisperPath, inputPath, tokenLevelTimestamps: true, splitOnWord: true })`.
- [template-tiktok](https://github.com/remotion-dev/template-tiktok) — Why: source of `sub.mjs` + `CaptionedVideo/Page.tsx` + `SubtitlePage.tsx`. Read the build-time pipeline before adapting.
- [@remotion/captions Caption type](https://www.remotion.dev/docs/captions/caption) — Why: `{ text, startMs, endMs, timestampMs, confidence }`. The shape `sub.mjs` writes to JSON next to each MP4.
- [`createTikTokStyleCaptions`](https://www.remotion.dev/docs/captions/create-tiktok-style-captions) — Why: turns Caption[] into per-page chunks for word-by-word animation.
- [Remotion Studio CLI](https://www.remotion.dev/docs/cli/studio) — Why: `npx remotion studio src/index.ts` positional arg; flags `--port`, `--no-open`, `--props='{...}'`, `--public-dir`.
- [Remotion renderStill](https://www.remotion.dev/docs/renderer/render-still) + [renderFrames](https://www.remotion.dev/docs/renderer/render-frames) + [selectComposition](https://www.remotion.dev/docs/renderer/select-composition) — Why: the golden-frame harness uses these three. `renderStill` is single-PNG, no encoding overhead.
- [pixelmatch](https://github.com/mapbox/pixelmatch) — Why: golden diff. Threshold 0.1 default; we use 0.5% mismatched-pixel ceiling per frame (anti-aliasing tolerant, brand-drift sensitive).
- [Remotion Linux deps](https://www.remotion.dev/docs/miscellaneous/linux-dependencies) — Why: GHA workflow `apt-get install` list.
- [Stoat example Remotion CI](https://github.com/stoat-dev/example-remotion) — Why: working reference for `actions/cache` keyed on lockfile + matrix shards.
- [remotion-bits](https://github.com/av/remotion-bits) — Why: `AnimatedText`, `GradientTransition`, particles, charts. v0.2.0 March 2026, 339 stars, active.
- [remotion-animated](https://github.com/stefanwittwer/remotion-animated) — Why: declarative chained `<Animated by={[Move, Scale, Fade]}>` API. Simpler than `spring()` + `interpolate()` for our card animations.
- [asciinema/agg](https://github.com/asciinema/agg) — Why: VHS fallback for animated spinners / full-screen TUI scenes. v1.8.1 May 2026, active. Output is GIF; pipe through ffmpeg for MP4: `agg cast.cast - | ffmpeg -y -i - -c:v libx264 -pix_fmt yuv420p -r 30 out.mp4`.

### Patterns to Follow

**Workspace nesting (not a pnpm workspace, just a nested package):**

```
# scripts/video/final/package.json — minimal manifest
{
  "name": "@maude/video",
  "private": true,
  "type": "module",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "render": "remotion render src/index.ts",
    "render:scene": "remotion render src/index.ts",
    "caption": "node sub.mjs",
    "goldens:update": "GOLDEN_UPDATE=1 bun test __tests__/frame-regression.test.ts",
    "goldens:check": "bun test __tests__/frame-regression.test.ts",
    "test": "bun test"
  }
}
```

Do NOT make it a pnpm workspace. Reason: this repo's root `package.json` is not a workspace root (no `workspaces` field today), and turning it into one is a bigger change than this plan should own. A nested `package.json` with its own `node_modules` is intentional — Remotion's deps stay isolated from `maude` CLI's deps.

**Composition registry shape:**

```tsx
// scripts/video/final/src/Root.tsx
import { Composition } from 'remotion';
import { IntroScene } from './scenes/01-intro';
import { MaudeInitScene } from './scenes/02-maude-init';
// ... one import per scene
import { Final } from './compositions/Final';
import { Final30 } from './compositions/Final30';

export const Root = () => (
  <>
    {/* Per-scene compositions enable Studio preview + regression goldens */}
    <Composition id="scene-01-intro" component={IntroScene} durationInFrames={75} fps={30} width={1920} height={1080} />
    <Composition id="scene-02-maude-init" component={MaudeInitScene} durationInFrames={105} fps={30} width={1920} height={1080} />
    {/* ... */}
    <Composition id="Final"   component={Final}   durationInFrames={1800} fps={30} width={1920} height={1080} />
    <Composition id="Final30" component={Final30} durationInFrames={900}  fps={30} width={1920} height={1080} />
  </>
);
```

**Scaffolder command shape (mirror `plugins/flow/commands/setup-prd.md`):**

```md
---
name: flow:video-new-scene
category: setup
description: Scaffold a new Remotion scene under scripts/video/final/src/scenes/
---

# /flow:video-new-scene

Args: `<scene-id> <duration-seconds> "<caption>"`

Generates:
- `scripts/video/final/src/scenes/<scene-id>/index.tsx` (template includes <LowerThird caption={...} />)
- Adds `<Composition id="<scene-id>" .../>` to `scripts/video/final/src/Root.tsx`
- Appends a row to `scripts/video/storyboard.md`

Idempotent — refuses to overwrite an existing scene without `--force`.
```

**GH Actions matrix shape (mirror existing `.github/workflows/quality.yml`):**

```yaml
# .github/workflows/video-render.yml
on:
  workflow_dispatch:
    inputs:
      composition:
        description: 'Composition id to render (Final, Final30, or scene-NN-*)'
        required: true
        default: 'Final'

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: |
          sudo apt-get update && sudo apt-get install -y \
            libnss3 libdbus-1-3 libatk1.0-0 libasound2 libxrandr2 \
            libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
            libgbm-dev libcups2 libcairo2 libpango-1.0-0 \
            libatk-bridge2.0-0 fontconfig
      - uses: actions/cache@v4
        with:
          path: |
            scripts/video/final/node_modules
            ~/.cache/remotion
          key: ${{ runner.os }}-remotion-${{ hashFiles('scripts/video/final/pnpm-lock.yaml') }}
      - run: cd scripts/video/final && pnpm install --frozen-lockfile
      - run: cd scripts/video/final && pnpm run render -- ${{ inputs.composition }} out/${{ inputs.composition }}.mp4 --concurrency=2
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ inputs.composition }}
          path: scripts/video/final/out/${{ inputs.composition }}.mp4
```

Manual trigger only. No auto-render on push — wastes minutes; the local M-series render is faster anyway.

---

## Design Decisions

### Why drop `asciinema-mp4` and keep VHS

Verified via `gh api`:
- `lhr0909/asciinema-mp4`: last commit 2023-01-30, 8 total commits, 35 stars, 0 issues, 0 PRs, 3 stale forks. Effectively abandoned.
- No documented support for 1920×1080, 30 fps, 256-color, Unicode box-drawing, or long casts. Companion to a 2022 blog post; not a library.

VHS stays as primary terminal capture (proven in phase 15 smoke). `asciinema/agg` (v1.8.1, May 2026) is the documented fallback for cases VHS chokes on (Claude Code's animated spinners + full-screen TUI). Output path: cast → `agg` → GIF → ffmpeg → MP4. ~3 commands; cheap to add when needed.

### Why install Remotion Agent Skills globally, not vendor

`npx skills add remotion-dev/skills -g` installs to `~/.claude/skills/`. Same namespace as `flow:*` and `design:*` skills already in this repo — no collision (Remotion's skill is named `remotion-best-practices`, no plugin prefix). Vendoring would mean copying 37 rule files into `plugins/`, which:
1. Duplicates content the Remotion team maintains.
2. Bloats this plugin's `commands/`/`skills/` count.
3. Breaks the "progressive disclosure" the official skill is designed for (SKILL.md is small, rules are loaded on demand).

Global install is one-shot. If a contributor doesn't have it, the worst case is the agent has less Remotion context — not a correctness issue.

### Why build-time captioning (not render-time)

`sub.mjs` runs Whisper.cpp on each input MP4 once, writes `<name>.json` next to it. Compositions read JSON via `staticFile()`. Result:
- **Captioning is cached.** Re-renders skip Whisper (the 6s cost stays a one-time cost per re-recorded scene).
- **JSON is editable.** Whisper mistranscribing "Claude" as "cloud" is fixed by hand-editing the JSON, not re-running the transcription with custom prompts.
- **Render is deterministic.** No I/O during render. Goldens stay stable.

This is exactly what template-tiktok does. We adopt it verbatim.

### Why golden frames, not video diff

Diffing two video files pixel-by-pixel is impractical (encoding noise dominates real diffs). Golden **stills** at frame 0 / mid / -1 of each per-scene composition:
- ~3 PNGs per scene × 9 scenes = 27 goldens total. Small, committable.
- `renderStill()` is fast (~200 ms per frame). Full goldens check in ~6s.
- `pixelmatch` with 0.5% threshold tolerates font anti-aliasing while flagging real DS-token shifts.
- Updating goldens after an intentional visual change: `npm run goldens:update` (set `GOLDEN_UPDATE=1`, writes new PNGs). Git diff makes the change reviewable.

### Why music is committed, not API-fetched

- Pixabay has no music API (verified: their REST API covers images + videos only).
- Freesound API has license filtering but no BPM tag on music tracks.
- Curating 6-10 instrumentals once → ~10-15 MB in `scripts/video/music/`. Acceptable repo size (the design system itself is bigger). `MANIFEST.md` documents each license URL.
- For a maintainer shipping ~10 videos/year, "pick from the 8 tracks already committed" beats "find a new track each time" every cut.

### Why the scaffolder lives under `flow:`, not `design:`

The marketing video pipeline is project infrastructure (anyone using `maude` to ship a tool may want demo videos), not a design-system artifact tied to canvases. Mirrors `flow:setup-prd` (generic) vs `design:setup-ds` (design-system-specific). When phase 15.5 ships and downstream projects copy the workspace, they get the scaffolder via the flow plugin install — no design-plugin dependency.

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 0: GATE — Phase 15 toolchain green + Remotion license re-ack

- **Do**: Confirm `pnpm run video:smoke` exits 0 (phase 15 done). Re-confirm the Remotion license posture from phase 15 (`scripts/video/README.md` top of file) — same posture applies (solo OSS, free tier).
- **Pattern**: Single hard gate; same shape as phase 15.5 Task 0.
- **Gotcha**: If phase 15 smoke is broken, fix that first. Do not start authoring infra against a cold toolchain.
- **Validate**: `pnpm run video:smoke` exits 0; README license note dated within 6 months.

### Task 1: INSTALL official Remotion Agent Skills globally

- **Do**: Run `npx skills add remotion-dev/skills -g --agent claude-code`. Verify install path = `~/.claude/skills/remotion-best-practices/SKILL.md`. Confirm Claude Code recognises the skill (it'll appear in `/help` or via skill auto-load on next session restart).
- **Pattern**: One-time global install; not vendored into this repo's plugin tree.
- **Gotcha**: The Vercel Labs `skills` CLI has a known bug ([issue #851](https://github.com/vercel-labs/skills/issues/851)) where some flag combinations write to `~/.agents/skills/` instead of `~/.claude/skills/`. Pass `--agent claude-code` explicitly. If the install lands in the wrong dir, `cp -r` to the right one and `npx skills remove` from the wrong one.
- **Validate**: `ls ~/.claude/skills/remotion-best-practices/` shows `SKILL.md` + `rules/` (≥30 files). `cat ~/.claude/skills/remotion-best-practices/SKILL.md | head -20` shows the frontmatter `name: remotion-best-practices`.

### Task 2: CREATE the nested `scripts/video/final/` workspace

- **Do**:
  1. Create `scripts/video/final/package.json` with the script block from "Patterns to Follow" above. DevDeps: `remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/transitions`, `@remotion/captions`, `@remotion/install-whisper-cpp`, `@remotion/google-fonts`, `remotion-bits`, `remotion-animated`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `pixelmatch`, `pngjs`, `@types/pngjs`. **Do not** install root-level — install under `scripts/video/final/` only.
  2. Create `scripts/video/final/tsconfig.json` (jsx + Bundler + strict + paths).
  3. Create `scripts/video/final/remotion.config.ts` (H.264, CRF 23, 30 fps, 1920×1080, JPEG image format for speed, concurrency=2).
  4. Create `scripts/video/final/src/index.ts` → `registerRoot(Root)`.
  5. Create `scripts/video/final/src/Root.tsx` with one placeholder `<Composition id="scene-00-placeholder" />` (will be replaced as scenes are scaffolded).
  6. Create `scripts/video/final/src/load-font.ts` using `@remotion/google-fonts/<font-name>` (read active font from `.design/system/<ds>/colors_and_type.css`).
  7. Move existing `scripts/video/cards/tokens.ts` → `scripts/video/final/src/lib/tokens.ts` (same content).
  8. From `scripts/video/final/`, run `pnpm install`. Confirm `pnpm why react` resolves to React 19 (matches root + DDR-012).
- **Pattern**: Standalone Remotion workspace (mirror [Remotion blank template](https://www.remotion.dev/templates/blank)).
- **Gotcha**:
  - **Lockfile**: this nested workspace creates `scripts/video/final/pnpm-lock.yaml` separate from root. That's intended. Add a `.gitignore` entry? No — commit it. CI caches off it.
  - **Bun vs npm**: per DDR-009 the dev-server is moving to Bun, but Remotion's `@remotion/bundler` uses Webpack and is more battle-tested on Node. Stick with pnpm + Node 24 for this workspace.
  - **React 19**: Remotion 4.x supports it (already confirmed in phase 15). Do not pin 18.
- **Validate**:
  - `cd scripts/video/final && pnpm install` exits 0.
  - `cd scripts/video/final && pnpm exec remotion versions` prints Remotion 4.x.
  - `cd scripts/video/final && pnpm exec remotion studio src/index.ts --no-open --port=4400` boots without errors (kill after 5s).
  - `pnpm lint` (root) still passes — biome doesn't blow up on the nested workspace.

### Task 3: REMOVE root-level Remotion devDeps

- **Do**: From root, run `pnpm remove -w remotion @remotion/cli @remotion/renderer @remotion/bundler react react-dom @types/react @types/react-dom`. Keep `@playwright/test` (used by Playwright specs in `scripts/video/playwright/`, outside the Remotion workspace).
- **Pattern**: Workspace isolation — Remotion's deps stay nested.
- **Gotcha**: Phase 15's smoke uses `scripts/video/smoke/card/index.ts` which today imports from root-installed Remotion. **Move the smoke card into the new workspace too**: relocate `scripts/video/smoke/card/` → `scripts/video/final/src/scenes/_smoke/`, register as `<Composition id="scene-smoke" />`, update `package.json` root `video:smoke` script to delegate (`bash scripts/video/smoke/run.sh` keeps working; internally `run.sh` calls `npm --prefix scripts/video/final run render -- scene-smoke ...`).
- **Validate**:
  - `pnpm install` from root succeeds without Remotion.
  - `pnpm run video:smoke` still exits 0 (smoke now renders via the nested workspace).
  - `pnpm why remotion` returns nothing at root (only `scripts/video/final/`).

### Task 4: CHERRY-PICK TikTok captioning components

- **Do**:
  1. Download [Page.tsx](https://github.com/remotion-dev/template-tiktok/blob/main/src/CaptionedVideo/Page.tsx) + [SubtitlePage.tsx](https://github.com/remotion-dev/template-tiktok/blob/main/src/CaptionedVideo/SubtitlePage.tsx) → `scripts/video/final/src/lib/captioned-clip/{Page,SubtitlePage}.tsx`.
  2. Strip imports the template provides that we don't need (no `NoCaptionFile`, no template-specific font loader — use our `load-font.ts`).
  3. Re-anchor token references: replace any hard-coded TikTok colors with our `tokens.ts` values (`tokens.ink`, `tokens.accent`).
  4. Add a tiny wrapper `<CaptionedClip src={...} captionsJson={...} />` that hides the template's prop drilling.
  5. Download [sub.mjs](https://github.com/remotion-dev/template-tiktok/blob/main/sub.mjs) → `scripts/video/final/sub.mjs`. Strip multi-language detection; hardcode `model: 'medium.en'`. Add `--lang=cs` CLI flag for the Czech option (large-v3 model, slower).
  6. Add `whisper-config.mjs` shim or env vars: `WHISPER_VERSION=1.5.5`, `WHISPER_MODEL=medium.en`, `WHISPER_PATH=./.whisper-cache/`.
  7. Add `.whisper-cache/` to `scripts/video/final/.gitignore`.
- **Pattern**: Direct port, not a wrapper. The template's components are 200 LOC total — easier to own than to depend on the template.
- **Gotcha**:
  - Whisper model download is ~466 MB for `medium.en` (~1.5 GB for `large-v3`). First `pnpm run caption` is slow; subsequent runs cached.
  - The template's `sub.mjs` assumes inputs in `public/`. Our convention: inputs in `scripts/video/final/public/` (matches Remotion's `staticFile()` resolution).
  - **Caption JSON is editable.** Document this in `scripts/video/README.md` — humans patch transcription errors in JSON, never re-prompt Whisper.
- **Validate**:
  - `cp scripts/video/.work/smoke/terminal.mp4 scripts/video/final/public/`
  - `cd scripts/video/final && pnpm run caption` runs Whisper once, produces `public/terminal.json` containing Caption[] with non-empty `text` fields.
  - `cat public/terminal.json | jq '.[0]'` shows `{ text, startMs, endMs, ... }`.
  - Total caption time for the 5s smoke clip: under 30s including first-run Whisper download (M-series).

### Task 5: ADD animation helpers (`remotion-bits` + `remotion-animated`)

- **Do**:
  1. Already in Task 2 devDeps. Confirm install.
  2. Create `scripts/video/final/src/lib/animated/index.ts`:
     ```ts
     export { AnimatedText, GradientTransition } from 'remotion-bits';
     export { Animated, Move, Scale, Fade } from 'remotion-animated';
     // Plus local wrappers if needed (e.g. brand-colored AnimatedText preset)
     ```
  3. Refactor `scripts/video/cards/IntroCard.tsx` (and OutroCard) to use `<AnimatedText>` + `<Animated by={[Fade(), Move({ y: -24 })]}>` instead of hand-rolled `spring()` + `interpolate()`. Smaller, more readable, identical visual output.
  4. Move both cards into `scripts/video/final/src/scenes/{01-intro,09-outro}/index.tsx` and register in `Root.tsx`.
- **Pattern**: Use library primitives; only drop to raw `interpolate()` for genuinely custom motion.
- **Gotcha**: `remotion-bits` exports `AnimatedText` with its own font assumption; pass `style={{ fontFamily: '...' }}` from `load-font.ts` to override.
- **Validate**:
  - `cd scripts/video/final && pnpm exec remotion render src/index.ts scene-01-intro out/intro.mp4 --mute` produces a 2.5s MP4 identical to phase 15.5's IntroCard output (same colors, same timing, same wordmark).
  - Diff line count: IntroCard.tsx + OutroCard.tsx should drop ~40 LOC combined after the refactor.

### Task 6: CREATE golden-frame regression harness

- **Do**:
  1. Create `scripts/video/final/__tests__/frame-regression.test.ts`:
     ```ts
     import { selectComposition, renderStill } from '@remotion/renderer';
     import { bundle } from '@remotion/bundler';
     import pixelmatch from 'pixelmatch';
     import { PNG } from 'pngjs';
     import fs from 'node:fs';
     import path from 'node:path';
     import { describe, test, expect } from 'bun:test';

     const SCENES = ['scene-01-intro', 'scene-02-maude-init', /* ... */];
     const FRAMES = ['first', 'middle', 'last'];
     const THRESHOLD_PCT = 0.5;

     describe('frame regression', () => {
       test.each(SCENES.flatMap(s => FRAMES.map(f => [s, f])))('%s @ %s', async (sceneId, frameLabel) => {
         const serveUrl = await bundle({ entryPoint: './src/index.ts' });
         const composition = await selectComposition({ serveUrl, id: sceneId });
         const frame = frameLabel === 'first' ? 0 : frameLabel === 'last' ? composition.durationInFrames - 1 : Math.floor(composition.durationInFrames / 2);
         const outPath = path.join('__goldens__', '.diff', `${sceneId}-${frameLabel}.png`);
         await renderStill({ composition, frame, output: outPath, serveUrl });
         const goldenPath = path.join('__goldens__', `${sceneId}-${frameLabel}.png`);
         if (process.env.GOLDEN_UPDATE === '1' || !fs.existsSync(goldenPath)) {
           fs.copyFileSync(outPath, goldenPath);
           return;
         }
         const golden = PNG.sync.read(fs.readFileSync(goldenPath));
         const actual = PNG.sync.read(fs.readFileSync(outPath));
         const diff = new PNG({ width: golden.width, height: golden.height });
         const mismatched = pixelmatch(golden.data, actual.data, diff.data, golden.width, golden.height, { threshold: 0.1 });
         const pct = (mismatched / (golden.width * golden.height)) * 100;
         expect(pct).toBeLessThan(THRESHOLD_PCT);
       });
     });
     ```
  2. Add `__goldens__/.gitkeep`; `__goldens__/.diff/` to `.gitignore`.
  3. Wire scripts: `goldens:update` (sets `GOLDEN_UPDATE=1`), `goldens:check` (default — fails on regression).
- **Pattern**: Renderer programmatic API (`renderStill` + `selectComposition`); pixelmatch threshold 0.1 per-pixel + 0.5% per-frame ceiling.
- **Gotcha**:
  - First run with no goldens **passes silently** (it writes them). Document this clearly in README — running `goldens:check` against an empty `__goldens__/` is a no-op trap.
  - Bundling once per test is slow (~5s). Optimize: bundle once in `beforeAll`, share `serveUrl` across tests. Acceptable as-is for our scale (27 tests × 200ms each + 5s bundle = <15s total).
  - Anti-aliasing on text causes per-pixel diffs even on identical renders. Threshold 0.1 (pixelmatch's "subpixel anti-alias detection") + 0.5% ceiling absorbs this without missing real DS changes.
- **Validate**:
  - First run: `cd scripts/video/final && pnpm run goldens:update` populates `__goldens__/*.png` (3 per scene).
  - Second run: `pnpm run goldens:check` exits 0 (all under 0.5%).
  - Sanity: tweak `tokens.ts` accent color by hand, re-run `goldens:check` → fails on every scene that uses accent.
  - Revert the tweak; `goldens:check` passes again.

### Task 7: BIOME override to forbid CSS transitions/animations in Remotion code

- **Do**: Add the `overrides` block from "Files to Create" above to `biome.json`. Run `pnpm lint` from root.
- **Pattern**: Scope override to `scripts/video/final/**` only; main lint scope unchanged.
- **Gotcha**:
  - Biome's `noRestrictedSyntax` rule is in `nursery` group as of biome 2.x. If unstable, fall back to a `grep -r "transition:" scripts/video/final/src/` step in a pre-commit hook.
  - The selector targets only inline `style={{ ... }}` objects. CSS Modules / Tailwind classes are not flagged (Remotion + Tailwind = also forbidden per the official skill, but Tailwind isn't installed in this workspace, so non-issue).
- **Validate**:
  - Add a deliberate `<div style={{ transition: 'opacity 1s' }}>` to a scene → `pnpm lint` reports the error.
  - Remove it → lint passes.

### Task 8: CREATE `/flow:video-new-scene` scaffolder

- **Do**:
  1. Create `plugins/flow/commands/video-new-scene.md` with frontmatter from "Patterns to Follow" above.
  2. Body of the command: an LLM-instruction-style markdown that tells Claude Code to:
     - Read the args `<scene-id> <duration-seconds> "<caption>"`.
     - Confirm `scripts/video/final/` exists (else fail with hint to run phase 15.1 first).
     - Create `scripts/video/final/src/scenes/<scene-id>/index.tsx` from a baked-in template (using `<LowerThird caption={...}>` from the lib).
     - Open `Root.tsx`, find the registry block, insert a new `<Composition id="<scene-id>" component={...} durationInFrames={<dur*30>} fps={30} width={1920} height={1080} />` in sorted order.
     - Open `scripts/video/storyboard.md`, append a row to the Cut A table with the new scene.
     - Print next-step hint: `cd scripts/video/final && pnpm run studio` to preview.
  3. Update `plugins/flow/CATEGORIES.md` to list `video-new-scene` under the `setup` category with a one-liner.
- **Pattern**: Mirror `plugins/flow/commands/setup-prd.md` shape — the agent does the work via Read/Edit/Write; the command file is the spec.
- **Gotcha**:
  - **Idempotency**: refuse to overwrite an existing scene without `--force`. The command spec must spell this out so the agent doesn't blindly clobber.
  - **Scene ID convention**: `<NN>-<kebab-slug>` (e.g. `03-setup-ds-flow`). Sort key for Root.tsx insertion is numeric prefix.
  - This is a `flow:` command (project-agnostic), not `design:`. Argued in Design Decisions above.
- **Validate**:
  - From root, run `/flow:video-new-scene 99-test 4 "Test caption"`. Confirm:
    - `scripts/video/final/src/scenes/99-test/index.tsx` exists with `durationInFrames={120}` (4s × 30fps).
    - `Root.tsx` gained `<Composition id="99-test" ... />`.
    - `storyboard.md` gained a Cut A row for scene 99.
  - `cd scripts/video/final && pnpm exec remotion render src/index.ts 99-test out/test.mp4 --mute` produces a 4.0s MP4.
  - Re-run the same command → command refuses (no `--force`).
  - Clean up: delete the test scene + revert Root.tsx + storyboard.md.

### Task 9: CURATE `scripts/video/music/` (committed CC0 instrumentals)

- **Do**:
  1. Source 6-10 CC0 / Pixabay-License / FMA-CC0 instrumentals matching: 60-120s duration, BPM 80-110, mood "corporate ambient" / "tech inspiration" / "minimal piano" / "lofi minimal".
  2. Download to `scripts/video/music/`. Filenames: `<short-slug>-<bpm>bpm-<source>.mp3`. Example: `quiet-progress-92bpm-pixabay.mp3`.
  3. Write `scripts/video/music/MANIFEST.md` table: filename | source URL | license | BPM | duration | mood tags | recommended scene context.
  4. Update `scripts/video/storyboard.md` to reference music by filename (not URL); update `download-music.sh` to be a no-op-if-cached helper that the Cut A renderer points at one of these committed tracks.
- **Pattern**: Static asset curation. No API automation.
- **Gotcha**:
  - File-size budget: 10 × 4 MB ≈ 40 MB committed. Acceptable (repo is already larger from `.design/` assets). If a track is over 6 MB at 192 kbps mp3, transcode down.
  - License URL per track is **mandatory** in MANIFEST.md — if it's missing, the track gets deleted.
- **Validate**:
  - `ls scripts/video/music/*.mp3 | wc -l` ≥ 6.
  - `cat scripts/video/music/MANIFEST.md | grep -c "license:"` matches the file count.
  - All license URLs HTTP 200 (`while read url; do curl -sI $url; done < <(grep -oE 'https://[^ ]+' scripts/video/music/MANIFEST.md) | grep -c 200`).

### Task 10: CREATE CI render workflow

- **Do**:
  1. Create `.github/workflows/video-render.yml` from the template in "Patterns to Follow" above.
  2. Trigger: `workflow_dispatch` only (manual). Input: composition id.
  3. Steps: checkout, setup-node 24, apt-get install Linux deps, actions/cache (Remotion + node_modules), pnpm install (in `scripts/video/final/`), `pnpm run render -- <composition> out/<composition>.mp4 --concurrency=2`, upload artifact.
  4. Document in `scripts/video/README.md`: "To render in CI without burning your laptop, go to Actions → 'video-render' → Run workflow → enter composition id."
- **Pattern**: Manual-trigger only. No auto-render on push (waste of minutes; M-series local render is faster anyway).
- **Gotcha**:
  - Workflow does NOT run captioning. Captions JSON must be committed to the repo (in `scripts/video/final/public/`) before CI render. Document this dependency in the workflow's prerequisites section.
  - Memory limit on `ubuntu-latest` (7 GB): pin `--concurrency=2`. Higher concurrency OOMs with `OffthreadVideo` frame cache.
  - 10-minute budget per job is comfortable for a single composition. The `Final` composition (~55s) renders in 4-6 min on `ubuntu-latest` per phase research.
- **Validate**:
  - GH Actions UI shows the workflow under "Actions" tab.
  - Manual trigger with composition=`scene-smoke` (the smoke scene from Task 3) succeeds within 5 min, uploads `scene-smoke.mp4` artifact downloadable from the run page.
  - Subsequent runs hit cache (Chromium not re-downloaded; node_modules restored).

### Task 11: UPDATE `phase-15.5-marketing-demo-video-30s.md` — fold in the new infra

- **Do**: Edit `phase-15.5` in place (Banner block at the top + targeted task edits):
  1. Add banner: *"This plan assumes phase 15 + 15.1 are done. Phase 15.1 provides the Remotion workspace (`scripts/video/final/`), captioning pipeline (`sub.mjs`), animation primitives (`remotion-bits` + `remotion-animated`), golden-frame harness, and `/flow:video-new-scene` scaffolder. This plan only authors scenes + music selection + final assembly + site embed."*
  2. **Task 2** (Remotion card compositions): replace "Scaffold `scripts/video/cards/`" with "Use `/flow:video-new-scene 01-intro 2.5 \"...\"` and `... 09-outro 3.0 \"...\"` to scaffold; edit the generated files to add the brand-specific content. Card animations use `<AnimatedText>` from `final/src/lib/animated/`, not hand-rolled `spring()`."
  3. **Task 3** (per-scene capture surfaces): unchanged structure, but update file paths — `scripts/video/playwright/` and `scripts/video/tapes/` stay where they are; their outputs land in `scripts/video/final/public/<scene-id>.{mp4,webm}` (so `staticFile()` picks them up).
  4. **Task 8 / 9 / 10 / 11** (Playwright scenes): output is WebM, NOT transcoded to MP4 — Remotion ingests WebM directly via `<OffthreadVideo>`. Drop the ffmpeg transcode step from each task.
  5. **NEW intermediate task between current Task 11 and Task 12**: "Run `pnpm run caption` from `scripts/video/final/` to generate Caption[] JSON for every captured scene. Hand-edit JSON to fix Whisper mistranscriptions (`Claude` not `cloud`, `MCP` not `MCBP`, etc)."
  6. **Task 12** (final compose): replace "create `Final.tsx`" instructions with "edit `scripts/video/final/src/compositions/Final.tsx` (scaffolded by 15.1's Task 2 placeholder) to wire scenes via `<TransitionSeries>` + `<Audio src={staticFile('music/<chosen-track>.mp3')}>`. Same for `Final30.tsx`. Run goldens:update once after final scene order is locked."
  7. **Task 17** (DDR): cross-link this phase 15.1 DDR (it carries the infra decisions; 15.5's DDR documents only the content/scope choices).
- **Pattern**: Surgical edits; preserve storyboard table, captions, scenario coverage. Renumbering OK if a new intermediate task lands.
- **Gotcha**:
  - The current phase 15.5 already references `@remotion/transitions` and Whisper. Don't double-add — replace the inline "install this" lines with cross-refs to 15.1.
  - Keep the "Cut A / Cut B" split intact — it's content scope, not infra.
- **Validate**: Diff `phase-15.5`: banner added, ~6 tasks edited, no orphan task references. `grep -c "ffmpeg .* libx264.*pix_fmt" phase-15.5-*.md` returns 0 or 1 (only the final loudnorm post-step survives).

### Task 12: UPDATE `scripts/video/README.md` with workspace + scaffolder + goldens

- **Do**: Append three sections:
  1. **Workspace layout** — describe `scripts/video/final/` package, link to its scripts (`studio`, `render`, `caption`, `goldens:check`). Mention the nested `node_modules` is intentional.
  2. **Adding a new scene** — `/flow:video-new-scene <id> <duration> "<caption>"`. One-liner.
  3. **Captions workflow** — `pnpm run caption` from `scripts/video/final/` runs Whisper.cpp; JSON next to each MP4 is editable; commit the JSON.
  4. **Regression goldens** — `pnpm run goldens:check` before commits that touch DS tokens or scene layout; `pnpm run goldens:update` after intentional visual changes (commit the updated PNGs).
  5. **Music** — pick a track from `scripts/video/music/MANIFEST.md`; reference by filename in the composition.
- **Pattern**: Keep additions ASCII-only, terse, command-first. Don't rewrite existing smoke sections.
- **Gotcha**: Per [no AI-tell punctuation] memory — strip em dash, en dash, curly quotes, ellipsis char.
- **Validate**: A fresh agent reading only the README can scaffold a scene, render Studio, run goldens. Manual: open README, follow the new sections end-to-end.

### Task 13: RECORD a DDR

- **Do**: Create `.ai/archive/decisions/DDR-NNN-video-pipeline-infrastructure-skills-captioning-goldens.md`. Document:
  - **Decision**: standalone nested Remotion workspace under `scripts/video/final/`; install official Remotion Agent Skills globally; cherry-pick TikTok template's captioning components; build-time Whisper.cpp captioning; golden-frame regression via `renderStill` + pixelmatch; scaffolder lives under `flow:` namespace; music curated in-repo (no API).
  - **Rejected**: `asciinema-mp4` (dead 2023); `DojoCodingLabs/remotion-superpowers` (paid SaaS lock-in); pnpm workspace (root not a workspace; nested package is enough); vendor copy of Remotion skills (duplicates upstream maintenance); auto-CI-render on every push (wastes minutes).
  - **Trade-offs**: nested workspace has its own lockfile (drift risk between root pnpm and nested pnpm); golden PNGs add ~3 MB to repo; first Whisper run downloads 466 MB model.
  - **Reversibility**: high. Can collapse the nested workspace back into root by reverting Task 2/3; can re-add WebM-to-MP4 transcode; can swap caption pipeline for any other tool that emits the same Caption[] JSON shape.
  - **Cross-links**: DDR-008 (dev-server-bin helpers — same ladder discipline); DDR-035 (agent-orchestrated marketing video pipeline, the existing DDR from phase 15); [`phase-15-video-pipeline-toolchain.md`](../plans/archive/phase-15-video-pipeline-toolchain.md); [`phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md).
- **Pattern**: Mirror DDR-008 shape.
- **Gotcha**: Pick next free DDR number — `ls .ai/archive/decisions/ | tail -5`.
- **Validate**: DDR cross-links resolve; sibling DDRs match shape.

---

## Validation

Run these to confirm zero regressions:

1. **Phase 15 smoke still green**: `pnpm run video:smoke` exits 0.
2. **Nested workspace install clean**: `cd scripts/video/final && pnpm install --frozen-lockfile` exits 0 from cold; `pnpm why react` resolves to 19.
3. **Studio boots**: `cd scripts/video/final && pnpm run studio -- --no-open --port=4400` boots, accepts a `curl http://localhost:4400/` and returns 200 within 5s; kill cleanly.
4. **Caption pipeline**: `pnpm run caption` on a sample MP4 in `public/` produces valid JSON (Caption[] with non-empty text fields) within 60s on M-series (incl. first-run Whisper download).
5. **Goldens harness**: `pnpm run goldens:update` populates `__goldens__/*.png`; immediate `pnpm run goldens:check` exits 0; deliberate token change fails goldens; revert passes again.
6. **Biome override**: deliberate `style={{ transition: ... }}` in a scene → lint fails; remove → lint passes.
7. **Scaffolder**: `/flow:video-new-scene 99-test 4 "Test"` creates scene + composition + storyboard row; second run refuses without `--force`; cleanup leaves no trace.
8. **CI workflow**: manual trigger on a smoke composition succeeds within 5 min, uploads artifact.
9. **Music manifest**: ≥6 tracks committed; every license URL HTTP 200.
10. **Phase 15.5 coherence**: read 15.5 top-to-bottom — banner present, no orphan references to deleted ffmpeg transcode steps, all caption tasks reference `sub.mjs`.
11. **Root publish hygiene unchanged**: `npm pack --dry-run 2>&1 | grep -cE "scripts/video"` returns 0 (workspace excluded from publish).
12. **Lint clean**: `pnpm lint` from root passes; biome override scoped to `scripts/video/final/**`.
13. **DDR**: `ls .ai/archive/decisions/DDR-*video-pipeline-infrastructure*.md` returns exactly one file; cross-links from both video phase plans resolve.

---

## Scenario Coverage (UI tasks — not applicable)

This phase is **infrastructure setup with zero product UI surface**. No `scenario-runner` invocation. `design-system-guard` doesn't apply (the regression harness IS the visual guard, scoped to video output not site UI). `a11y-auditor` likewise doesn't apply (captions in the marketing video are reviewed manually in JSON, not via an a11y scan).

Phase 15.5 carries the site-embed scenarios (`site-landing-video-autoplay`, `site-landing-reduced-motion`, `readme-video-loads`) — already enumerated there, unchanged by this plan.

---

## Acceptance Criteria

- [x] Tasks 0-13 completed in order
- [x] `~/.claude/skills/remotion-best-practices/SKILL.md` installed (Task 1)
- [x] `scripts/video/final/` standalone workspace boots; `pnpm install` exits 0; `pnpm run studio` boots
- [x] Root `package.json` no longer carries Remotion/React devDeps (moved to nested workspace); `pnpm run video:smoke` still green
- [x] TikTok captioning ported: `Page.tsx` + `SubtitlePage.tsx` + `sub.mjs` under `scripts/video/final/`; `pnpm run caption` produces valid Caption[] JSON for a test MP4
- [x] `remotion-bits` + `remotion-animated` integrated; `IntroCard` + `OutroCard` refactored (LOC dropped vs phase-15 smoke baseline)
- [x] Golden-frame harness: `__goldens__/` populated; `pnpm run goldens:check` passes; deliberate visual change fails goldens; revert passes
- [x] Biome override forbids `transition:` / `animation:` in inline styles under `scripts/video/final/**`
- [x] `/flow:video-new-scene` scaffolder works end-to-end; idempotent without `--force`; logged in `CATEGORIES.md`
- [x] `scripts/video/music/` carries ≥6 CC0 tracks + `MANIFEST.md` with all license URLs HTTP 200
- [SKIP] `.github/workflows/video-render.yml` — user explicitly opted out ("nechci zadny github actions" 2026-05-20); deferred design retained in this plan for future opt-in
- [x] `phase-15.5-marketing-demo-video-30s.md` updated (banner + edits); reads coherently top-to-bottom
- [x] `scripts/video/README.md` extended with workspace + scaffolder + captions + goldens + music sections
- [x] DDR recorded (Task 13), cross-linked from both phase plans
- [x] `pnpm lint` clean; `npm pack --dry-run` does NOT include any `scripts/video/` files
- [x] No DDR-worthy decision left unrecorded
- [x] No regressions in `pnpm run video:smoke`, `scripts/check-version-parity.sh`, `scripts/bump-version.sh`

---

## Retro

- **What worked.** Building infrastructure top-down (workspace skeleton → animation libs → captioning → goldens → scaffolder → guards) meant each layer rendered + tested itself before the next one landed. Single-task verification cycles stayed short (most tasks: 1 iteration to pass). The decision to drop `asciinema-mp4` early (verified dead via `gh api`) saved a POC dead-end. The user's no-SaaS gate on `DojoCodingLabs/remotion-superpowers` was correct — closer inspection showed it requires 5 paid APIs and ships zero Remotion code.
- **What surprised.** Three production-time gotchas surfaced **only** at assembled-cut time, none of them in per-scene unit renders: (a) VHS `Hide`/`Show` doesn't clear the shell buffer — `cd /tmp/scratch` typed inside `Hide` leaks into the first captured frame; (b) Playwright captured at 1920×1080 bakes ~33% empty grey into source because the dev-server UI has a max-width container; (c) per-scene goldens cannot regress against capture-driven scenes because the input MP4 regenerates. All three are now baked into infrastructure (template tape with `clear`, Playwright config defaults to 1280×720, two-tier verification: goldens A + QA frame grid B). Documented in DDR-036's "Lessons from first real assembly" section.
- **What I'd change in the next plan.** Add a **mandatory visual QA step before delivery** to every plan template that produces a video / image / rendered output. Phase 15.1 missed it — initial delivery had two visible regressions the user caught immediately. The new `pnpm run qa` script + 4×3 contact sheet + agent-Read workflow + README "Visual QA workflow (mandatory before delivery)" section addresses this for future videos, but the pattern generalizes: render → QA → deliver, never render → deliver.
- **What stays useful.** The nested-workspace pattern (`scripts/video/final/` owns its `package.json` + lockfile + node_modules) isolates Remotion's heavy deps cleanly from the root `maude` CLI. Root pnpm-lock shrunk by ~1500 lines after removing Remotion. The "promote inline JSX to reusable lib wrapper" move (`<TerminalFrame>` + `<BrowserChrome>`) makes adding a new capture scene a one-line component invocation. The `_TEMPLATE.tape` + `lint:tape` pair stops the VHS Hide gotcha from re-discovery.
- **What's still owed.** Real CC0 music track curation (manifest is placeholder — phase 15.5 will need a real track for the final cut). Whisper.cpp model download smoke (~466 MB; deferred because the captioning path is already proven via hand-crafted JSON). Phase 15.5 task list rewrite (banner-injected pointer is enough — the user rewrote 15.5 on a separate track, and surgical edits would have clashed).
