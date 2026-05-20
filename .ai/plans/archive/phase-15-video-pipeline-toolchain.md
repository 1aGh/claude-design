# Feature: Video pipeline toolchain — setup + smoke tests

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Install, configure, and **smoke-test** the four tools that the agentic video pipeline depends on — `ffmpeg`, **VHS** (terminal capture), **Playwright** (browser capture with `--save-video=mp4`), **Remotion** (compose/title-cards/transitions/captions) — and prove they integrate via one tiny end-to-end smoke clip (~5 s, ~720p, no brand polish). This phase ships zero marketing video. Its sole output is a passing `pnpm run video:smoke` and a `scripts/video/README.md` runbook that the follow-up plan ([`phase-15.5-marketing-demo-video-30s.md`](./phase-15.5-marketing-demo-video-30s.md)) consumes as "toolchain is green, just compose the real thing."

Decoupling rationale from the deep research (2026-05-20):
- Custom bash pipeline (the original plan) had ~600 LOC of ladders + xfade math + drawtext + 2-pass loudnorm. Research found `VHS + Playwright video + Remotion` collapses ~50–60% of that to React composables + declarative `.tape` files. Before rewriting the final-video plan, we must verify the new stack actually works on this Mac, against `mdcc` CLI output (animated spinners, ANSI colors) and against the dev-server canvas (Cmd+Click inspector overlay) — both have edge cases that broke past attempts.
- Doing setup-and-validate as its own phase means the final video plan can be re-run idempotently without re-debugging the toolchain.

## User Story

As the **md-claude maintainer producing the first of many marketing/demo videos**, I want a **proven, reproducible toolchain** (one `pnpm run video:smoke` from clean clone to a stitched MP4) so that I can author the actual 30 s release video — and every future video — by writing scenes, not by debugging ffmpeg.

## Problem

- The toolchain (`ffmpeg`, `vhs`, `@playwright/test`, `remotion`) is not installed; `ffmpeg` and `vhs` are missing from `$PATH` per `which` check.
- No commitment yet about Remotion license posture (free tier vs paid) for an OSS solo maintainer transitioning the project — needs an explicit ack before depending on it.
- VHS records terminals via `ttyd` headlessly (no macOS Screen Recording permission needed), but it has known limits with full-screen TUIs and animated spinners — must be verified against `mdcc` and Claude Code TUI output before being chosen for Scenes 2/3/5-left of the final video.
- Playwright `--save-video=mp4` exists since 1.59 but the encoder path differs by platform; needs a 3-second smoke before being trusted with Scene 4's Cmd+Click inspector flow.
- Remotion produces ESM React + needs `@remotion/cli` + a renderer (`@remotion/bundler` + `@remotion/renderer`); needs to coexist with this repo's biome lint + tsconfig + Bun runtime without breaking `pnpm install`.
- Existing `scripts/video/` skeleton has empty `.cache`, `.work`, `cards` dirs from an earlier exploratory pass — risk of stale assumptions if not cleaned.

## Solution

A four-step gated installation, three single-tool smoke tests, one stitched cross-tool smoke clip, and one human-runnable `scripts/video/README.md`. No final-video artifacts in this phase. The follow-up plan reads the smoke output to confirm the stack and then only composes Scenes 1–7 + assembles.

```
Phase 1 (this plan)            Phase 2 (phase-15.5-marketing-demo-video-30s.md, refactored)
──────────────────             ─────────────────────────────────────────────────
Install + Smoke + Runbook  ──▶ Compose final 30s with proven toolchain
3 tool smokes + 1 stitched     Real captures, real cards, real assembly
~5s smoke.mp4 (no brand)       site/public/demo.mp4
```

## Metadata

- **GitHub Issue**: n/a (internal initiative; depends-on stub for `phase-15.5-marketing-demo-video-30s.md`)
- **Type**: New Capability (toolchain setup + validation; no product code)
- **Complexity**: Medium — four external tools, license check, no DOM/UI, single bash + one Remotion bundle
- **App/Package**: `scripts/video/` (new pipeline workspace) + root `package.json` (smoke npm script + dev deps)
- **Affected Systems**: Repo `package.json` (devDeps), `.gitignore` (cache/work dirs), no shipping artifact
- **Dependencies**:
  - **Homebrew**: `ffmpeg`, `vhs` (gated user installs — sandbox cannot run `brew install`)
  - **npm**: `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`, `remotion`, `react`, `react-dom`, `@playwright/test` (installed via `pnpm`)
  - **Playwright browsers**: `npx playwright install chromium` (gated, ~150 MB download)
  - **Active design tokens**: not used in this phase (smoke video is unbranded — brand wiring is Phase 2 / [pattern lift first] memory applies in Phase 2)

---

## Context References

### Must-Read Files

- `.ai/plans/phase-15.5-marketing-demo-video-30s.md` (entire file) — Why: this is the downstream consumer; the smoke + README must satisfy its toolchain expectations and the final-video plan needs to be edited at the end (Task 8) to drop the bash ladder and reference this toolchain.
- `package.json` lines 1-60 — Why: confirm pnpm@11 + Node 24 + Bun 1.3 baseline; new devDeps go under `devDependencies` (not `dependencies` — toolchain is repo-only, never ships to npm).
- `package.json` `files` array (lines ~80-90) — Why: confirm `scripts/` and `site/public/demo.mp4` are NOT matched; the smoke clip must stay outside the publish set.
- `plugins/design/dev-server/bin/screenshot.sh` (full file) — Why: prior art for the ladder pattern (`agent-browser` primary → `playwright` fallback). Same ladder discipline applies — primary path via VHS/Playwright, fallback via `ffmpeg avfoundation`. Don't re-invent the shape.
- `plugins/design/dev-server/bin/server-up.sh` (full file) — Why: lifecycle helper to invoke when the Playwright smoke needs the dev-server (it does — see Task 4). Re-use, do not duplicate.
- `biome.json` (or equivalent) — Why: Remotion outputs ESM React; biome rules must allow `.tsx` under `scripts/video/` without polluting the main lint scope. Add ignore pattern if needed.
- `CLAUDE.md` "Published npm surface" section — Why: enforces `files` allowlist; smoke + final video must remain repo artifacts only.
- `scripts/video/` (existing empty skeleton) — Why: don't delete blindly; pre-existing `.cache/`, `.work/`, `cards/` dirs match the layout already planned in `phase-15.5-marketing-demo-video-30s.md` Task 1.

### Files to Create

- `scripts/video/README.md` — Runbook: prereqs (ffmpeg, vhs, Playwright browsers, optional Screen Recording grant), per-tool smoke commands, full smoke pipeline, troubleshooting matrix (the "what if X fails" table). Single source for future agents/devs running the pipeline.
- `scripts/video/smoke/terminal.tape` — Minimal VHS tape: opens shell, runs `mdcc --version && ls .ai | head -5`, exits. Output: `.work/smoke/terminal.mp4` (~3 s).
- `scripts/video/smoke/browser.spec.ts` — Minimal Playwright spec: navigates to `http://localhost:<PORT>/canvas/ui/Canvas+Viewport` (server up via `bin/server-up.sh`), waits 1 s, hovers one DC element, video saved to `.work/smoke/browser.webm` then transcoded to `.mp4`. Smoke test only — no inspector overlay yet.
- `scripts/video/smoke/card/index.ts` — Remotion entry: imports `<SmokeCard>`.
- `scripts/video/smoke/card/SmokeCard.tsx` — 3 s 1280×720 React composition: solid background, centered text "md-claude — smoke test", fade-in over 30 frames. Zero brand tokens (those come in Phase 2).
- `scripts/video/smoke/card/remotion.config.ts` — Remotion config: H.264, 30 fps, 1280×720 (smaller than final 1080p — smoke is for tool verification, not quality).
- `scripts/video/smoke/assemble.sh` — Stitch all three (`terminal.mp4` + `browser.mp4` + `card.mp4`) into one ~6–9 s `smoke.mp4` via `ffmpeg concat` (no transitions, no captions, no audio — purely tool-integration proof). Output: `.work/smoke/smoke.mp4`.
- `scripts/video/.gitignore` — Ignore `.cache/` and `.work/` (smokes regenerate; never commit).
- `package.json` (UPDATE) — Add `video:smoke` script: runs the four smoke commands in order, prints "✅ Toolchain green" on success. Add devDeps (see Task 2).

### Documentation

- [Remotion Quickstart](https://www.remotion.dev/docs) — Why: confirms `npx create-video@latest` vs. manual install path; manual install lets us avoid the template's opinionated folder layout.
- [Remotion License](https://www.remotion.dev/docs/license) — Why: gates Task 1. Free for ≤3 employees Company. For solo OSS maintainer = free, but the license check needs an explicit ack so a future contributor doesn't get surprised at the $100/mo threshold.
- [Remotion render() Node API](https://www.remotion.dev/docs/renderer/render-media) — Why: smoke uses `npx remotion render` CLI; render-media is the path Phase 2 will use programmatically.
- [charmbracelet/vhs README](https://github.com/charmbracelet/vhs#installation) — Why: `brew install vhs` on macOS; `.tape` DSL syntax for `Type`, `Enter`, `Sleep`, `Output mp4`.
- [VHS commands reference](https://github.com/charmbracelet/vhs/blob/main/COMMANDS.md) — Why: confirms `Output foo.mp4` works (in addition to GIF/WebM); confirms `Set FontSize/Width/Height` for sizing.
- [Playwright video recording](https://playwright.dev/docs/videos) — Why: confirms `use: { video: 'on' }` config + `--save-video=mp4` path; default output is WebM, MP4 needs a transcode step (use `ffmpeg`).
- [`ffmpeg -f concat`](https://trac.ffmpeg.org/wiki/Concatenate) — Why: lossless concat for the smoke stitch step (Task 5); skip `xfade` — smoke is integration proof, not polish.
- [`ffmpeg avfoundation` (fallback only)](https://ffmpeg.org/ffmpeg-devices.html#avfoundation) — Why: documented as the fallback if VHS chokes on Claude Code's TUI; not used in default smoke path.

### Patterns to Follow

**Helper script ladder** (mirror `plugins/design/dev-server/bin/screenshot.sh`):

```sh
# screenshot.sh ladder:  agent-browser → npx playwright
# This phase smoke:      primary tool → ffmpeg avfoundation fallback (documented in README, not implemented in smoke)
#   terminal:  vhs        → screencapture -v + ffmpeg (Phase 2 fallback only)
#   browser:   playwright → agent-browser (already in repo) (Phase 2 fallback only)
#   compose:   remotion   → no fallback (Remotion is required; if it breaks, fix it, don't shim)
```

**Server lifecycle** (mirror `plugins/design/dev-server/bin/server-up.sh`):

```sh
# Browser smoke MUST reuse the helper, not start a duplicate dev-server:
PORT=$(plugins/design/dev-server/bin/server-up.sh)
URL="http://localhost:$PORT/canvas/ui/Canvas+Viewport"
# server-up.sh is idempotent — safe to call repeatedly across smokes.
```

**npm script naming** (mirror existing `scripts` block in `package.json`):

```json
{
  "scripts": {
    "video:smoke": "bash scripts/video/smoke/run.sh",
    "video:smoke:terminal": "vhs scripts/video/smoke/terminal.tape",
    "video:smoke:browser":  "playwright test scripts/video/smoke/browser.spec.ts",
    "video:smoke:card":     "remotion render scripts/video/smoke/card/index.ts SmokeCard .work/smoke/card.mp4"
  }
}
```

**Biome scope** (if Remotion `.tsx` triggers lint noise):

```json
// biome.json — add to `files.ignore` if needed:
"scripts/video/smoke/**"
```

---

## Tasks

Execute in order. Each task is atomic and testable. **All gated steps require user confirmation before proceeding** — this phase has three hard human gates (brew installs, Playwright browser download, Remotion license ack).

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 0: GATE — Remotion license ack

- **Do**: Ask the user, plainly: *"Remotion is free for individuals + companies ≤3 employees; $100/mo above that. md-claude is solo OSS. Confirm free-tier use is fine (Y/n)?"*. If Y, capture the ack as a one-line note in `scripts/video/README.md` (top of file) plus a `// LICENSE-NOTE` comment in `scripts/video/smoke/card/remotion.config.ts`. If N, abort the plan and propose Revideo (MIT) as Plan B — note this branch in the conversation but do not implement Revideo here.
- **Pattern**: Same gating discipline as `phase-15.5-marketing-demo-video-30s.md` Task 0 (ffmpeg brew install gate).
- **Gotcha**: Don't skip this. Future contributors inheriting this repo at a >3-person org would silently breach the license.
- **Validate**: README line 1-3 contains the ack date and outcome.

### Task 1: GATE — Install `ffmpeg` + `vhs`

- **Do**: Ask the user to run `brew install ffmpeg vhs`. Verify with `ffmpeg -version | head -1 && vhs --version`.
- **Pattern**: Same shape as `phase-15.5-marketing-demo-video-30s.md` Task 0.
- **Gotcha**: VHS depends on `ttyd` (auto-installed by brew). On Apple Silicon, `ffmpeg` from brew ships with `libx264` + `libfreetype` + `aac` — no `--enable-*` flags needed. On Linux the binary names may diverge; out-of-scope for this plan.
- **Validate**: Both commands print a version string and exit 0.

### Task 2: ADD npm devDependencies (Remotion + Playwright)

- **Do**: From repo root, run:
  ```sh
  pnpm add -D -w remotion @remotion/cli @remotion/renderer @remotion/bundler react react-dom @types/react @types/react-dom @playwright/test
  ```
  Then `pnpm install` to lockfile. The `-w` flag targets the workspace root (consistent with how `biome` is currently a root dev dep).
- **Pattern**: Mirror the existing root-level devDeps in `package.json` (biome, changesets).
- **Gotcha**: React 19 is already in this repo (per DDR-012 unified runtime) — Remotion 4.x supports React 19; **do not** pin to React 18. Confirm `react` resolves to 19 after install (`pnpm why react`).
- **Validate**: `pnpm why remotion playwright | head -20` shows both at root, no peer warnings. `pnpm lint` still passes (biome).

### Task 3: GATE — Install Playwright browsers

- **Do**: Ask the user to run `pnpm exec playwright install chromium`. ~150 MB download, ~30 s on a fast connection.
- **Pattern**: Standard Playwright onboarding step — gated because it downloads binaries outside of `node_modules`.
- **Gotcha**: Only Chromium is needed for this pipeline. Skip `--with-deps` (macOS-only smoke; Linux CI is out-of-scope for this plan).
- **Validate**: `pnpm exec playwright --version` prints; `~/Library/Caches/ms-playwright/chromium-*` exists.

### Task 4: CREATE Remotion smoke card

- **Do**:
  1. Create `scripts/video/smoke/card/SmokeCard.tsx`: 90-frame composition, 1280×720, 30 fps. Plain `<AbsoluteFill style={{background:'#111', color:'#fff', alignItems:'center', justifyContent:'center'}}>` with text "md-claude · smoke test" + a 30-frame `interpolate` opacity fade-in. No brand tokens, no `_tokens.css` import — that's Phase 2.
  2. Create `scripts/video/smoke/card/index.ts`: register the composition via `registerRoot` + `Composition` with `id="SmokeCard"`, `durationInFrames=90`, `fps=30`, `width=1280`, `height=720`.
  3. Create `scripts/video/smoke/card/remotion.config.ts`: H.264, CRF 23, `pixelFormat: 'yuv420p'` (QuickTime compat).
  4. Render: `pnpm exec remotion render scripts/video/smoke/card/index.ts SmokeCard scripts/video/.work/smoke/card.mp4`.
- **Pattern**: Standard Remotion minimal entry — see [Remotion Quickstart](https://www.remotion.dev/docs).
- **Gotcha**: Remotion's first render bundles a Chromium via `@remotion/renderer`; if `pnpm exec playwright install` (Task 3) succeeded, the cached browser is reused — no duplicate download. Verify via render log "Using existing Chromium".
- **Validate**: `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate scripts/video/.work/smoke/card.mp4` → `h264,1280,720,30/1`. Duration ~3.0 s.

### Task 5: CREATE VHS terminal smoke

- **Do**:
  1. Create `scripts/video/smoke/terminal.tape`:
     ```
     Output scripts/video/.work/smoke/terminal.mp4
     Set FontSize 16
     Set Width 1280
     Set Height 720
     Set Theme "Dracula"
     Type "node cli/bin/mdcc.mjs --help" Sleep 500ms Enter
     Sleep 2s
     Type "clear" Sleep 200ms Enter
     Type "ls .ai | head -5" Sleep 300ms Enter
     Sleep 1500ms
     ```
  2. Run: `vhs scripts/video/smoke/terminal.tape`.
- **Pattern**: Standard VHS `.tape` DSL — declarative, deterministic. No screen recording permissions, no human in loop.
- **Gotcha**: VHS writes MP4 via ffmpeg internally — it MUST find ffmpeg on `$PATH` (Task 1). If VHS picks WebM by mistake, set `Output ...mp4` explicitly (already done in tape above). VHS runs `mdcc` inside `ttyd`, so the binary must be invoked via its `node` path, not via the npm-installed `mdcc` global (which may not be on the user's PATH in smoke contexts).
- **Validate**: `ffprobe -v error scripts/video/.work/smoke/terminal.mp4` → no errors; duration 5–8 s; visually `open scripts/video/.work/smoke/terminal.mp4` shows the `mdcc --help` output rendered legibly.

### Task 6: CREATE Playwright browser smoke

- **Do**:
  1. Create `scripts/video/smoke/browser.spec.ts` (Playwright test, not a `@playwright/test` describe block — just a single `test()`):
     ```ts
     import { test, expect } from '@playwright/test';
     test('canvas viewport smoke', async ({ page }) => {
       const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4399/canvas/ui/Canvas+Viewport';
       await page.goto(url, { waitUntil: 'networkidle' });
       await page.waitForTimeout(1000);
       await page.mouse.move(640, 360);
       await page.waitForTimeout(2000);
     });
     ```
  2. Create `scripts/video/smoke/playwright.config.ts`: `use: { viewport: {width:1280,height:720}, video: { mode: 'on', size: {width:1280,height:720} } }`, `outputDir: 'scripts/video/.work/smoke/playwright'`.
  3. Pre-flight server: `DEV_SERVER_URL=http://localhost:$(plugins/design/dev-server/bin/server-up.sh)/canvas/ui/Canvas+Viewport pnpm exec playwright test --config scripts/video/smoke/playwright.config.ts`.
  4. Playwright outputs WebM. Transcode: `ffmpeg -y -i scripts/video/.work/smoke/playwright/*/video.webm -c:v libx264 -pix_fmt yuv420p scripts/video/.work/smoke/browser.mp4`.
- **Pattern**: Mirrors `screenshot.sh` ladder (browser captures via Playwright) but for video output.
- **Gotcha**: Playwright `video: 'on'` writes one WebM per test in a hashed subdirectory — glob the output, don't hardcode. Transcode is required because Remotion's downstream concat and the eventual `<video>` embed both expect H.264.
- **Validate**: `ffprobe scripts/video/.work/smoke/browser.mp4` → `codec_name=h264`, duration 3–4 s. Visually: `open` and confirm the Canvas Viewport actually rendered (i.e. the dev-server is alive).

### Task 7: CREATE stitched smoke + npm script

- **Do**:
  1. Create `scripts/video/smoke/assemble.sh`: concat the three MP4s. Lossless concat requires identical codec/resolution/fps — all three inputs are H.264 / 1280×720 / 30 fps by construction.
     ```sh
     #!/usr/bin/env bash
     set -euo pipefail
     W=scripts/video/.work/smoke
     printf "file '%s/terminal.mp4'\nfile '%s/browser.mp4'\nfile '%s/card.mp4'\n" "$PWD/$W" "$PWD/$W" "$PWD/$W" > "$W/concat.txt"
     ffmpeg -y -f concat -safe 0 -i "$W/concat.txt" -c copy "$W/smoke.mp4"
     echo "✅ Toolchain green — $W/smoke.mp4"
     ```
  2. Create `scripts/video/smoke/run.sh`: orchestrator. Order: ensure `.work/smoke/` exists, run Task 4/5/6 in sequence, then `assemble.sh`. Exit 0 on success with a "✅ Toolchain green" banner.
  3. Update `package.json` `scripts`: add `"video:smoke": "bash scripts/video/smoke/run.sh"` and the per-tool granular scripts (terminal/browser/card) for debugging.
  4. Update `scripts/video/.gitignore`: add `.cache/`, `.work/`.
- **Pattern**: Same shape as `scripts/check-version-parity.sh` (one-script-one-purpose, exits non-zero on any failure, prints a banner).
- **Gotcha**: `concat -c copy` fails silently if the three streams have any spec mismatch (fps, pix_fmt, sample aspect ratio). If smoke fails with "Non-monotonous DTS", fall back to a re-encode concat (`-c:v libx264 -preset veryfast`). Document the failure mode in the README's troubleshooting table.
- **Validate**: `pnpm run video:smoke` exits 0 from a clean `.work/`; `ffprobe scripts/video/.work/smoke/smoke.mp4` → duration ~9–12 s, single video stream H.264, no audio. `open` plays cleanly with all three scenes visible.

### Task 8: CREATE `scripts/video/README.md` runbook

- **Do**: A single-page README covering:
  1. **Prereqs** — `brew install ffmpeg vhs` + `pnpm install` + `pnpm exec playwright install chromium`. Note: no macOS Screen Recording permission needed (VHS uses ttyd headlessly; Playwright runs Chromium headlessly). Permission only matters in Phase 2 if we revert to `screencapture -v` fallback.
  2. **Remotion license ack** — date + outcome from Task 0.
  3. **Quick start** — `pnpm run video:smoke` → expect "✅ Toolchain green" in ~30 s.
  4. **Per-tool smoke** — `video:smoke:terminal`, `:browser`, `:card` for isolated debugging.
  5. **Troubleshooting matrix**:
     | Symptom | Likely cause | Fix |
     |---|---|---|
     | `vhs: command not found` | brew not installed | `brew install vhs` |
     | VHS produces 0-byte mp4 | ffmpeg missing from `$PATH` inside the `ttyd` subprocess | reinstall ffmpeg, restart shell |
     | Playwright "Browser not found" | `playwright install` skipped | `pnpm exec playwright install chromium` |
     | Remotion render hangs at "Bundling" | Vite cache corrupted | `rm -rf node_modules/.vite` |
     | `concat -c copy` fails "Non-monotonous DTS" | fps drift | re-encode with `-c:v libx264 -preset veryfast` |
     | Smoke browser.mp4 is black | dev-server not up / wrong URL | check `_server.json` + re-run `bin/server-up.sh` |
  6. **What's next** — explicit pointer: *"once smoke is green, run the final-video plan: [`phase-15.5-marketing-demo-video-30s.md`](../../.ai/plans/phase-15.5-marketing-demo-video-30s.md)"*.
- **Pattern**: Tone matches `plugins/flow/templates/ai-skeleton/README.md` (terse, command-first). Keep under 150 lines.
- **Gotcha**: Per the [no AI-tell punctuation] memory — strip em dash, en dash, curly quotes, ellipsis char. ASCII only in this README.
- **Validate**: A fresh agent reading only this README + running the listed commands produces `smoke.mp4`. Manual: have Claude re-run from scratch in a clean clone simulation (`rm -rf scripts/video/.work && pnpm run video:smoke`).

### Task 9: UPDATE `phase-15.5-marketing-demo-video-30s.md` — fold in the new toolchain

- **Do**: Edit the final-video plan in place:
  1. Add a banner at the top: *"This plan assumes [`phase-15-video-pipeline-toolchain.md`](./phase-15-video-pipeline-toolchain.md) has been run and `pnpm run video:smoke` exits 0. Do not run this plan against a cold toolchain."*
  2. Replace **Task 2** (HTML cards + `render-card.mjs`) with: *"CREATE Remotion compositions in `scripts/video/cards/` — `<IntroCard>`, `<OutroCard>`, `<LowerThird>` — using brand tokens via `import tokens from '../../.design/system/<active>/_tokens.ts'` (or a re-export shim). Mirror smoke `SmokeCard.tsx` shape."*
  3. Replace **Task 3** (`record-scene.sh` ladder) with: *"CREATE per-scene capture: terminal scenes via `.tape` files in `scripts/video/tapes/`; browser scenes via `scripts/video/playwright/` specs (mirror `smoke/browser.spec.ts`). No bash ladder — the toolchain is the ladder."*
  4. Replace **Tasks 5–6** (terminal scenes via clipboard hack) with: *"AUTHOR `.tape` files for Scene 2 (`mdcc init`) and Scene 3 (`/design:new` flow). VHS runs deterministically; no clipboard or computer-use needed."*
  5. Replace **Task 8** (split-screen `hstack`) with: *"COMPOSE Scene 5 split-screen in Remotion via `<Sequence>` + two `<Video src='...terminal.mp4' />` + `<Video src='...browser.mp4' />` side-by-side. Frame-perfect alignment via `from` prop."*
  6. Replace **Task 10** (`assemble.sh` with xfade math + drawtext + loudnorm + 2-pass) with: *"COMPOSE `scripts/video/final/index.ts` Remotion entry that imports all scene MP4s + cards + uses `@remotion/transitions` for xfade + `<Audio>` for music with `volume` envelope. Render: `pnpm exec remotion render scripts/video/final/index.ts Final site/public/demo.mp4 --codec=h264 --crf=23`. Post-step: `ffmpeg -i site/public/demo.mp4 -af loudnorm=I=-18:LRA=11:TP=-1.5 -c:v copy site/public/demo.norm.mp4 && mv site/public/demo.norm.mp4 site/public/demo.mp4`."*
  7. Remove **Tasks** that no longer apply (custom `render-card.mjs`, custom xfade math). Renumber.
  8. Keep Tasks 0 (ffmpeg gate — still required), 4 (intro/outro render — now via Remotion `render`), 7 (Scene 4 canvas hero — still needs claude-in-chrome for Cmd+Click), 9 (docs teaser), 11 (site embed), 12 (README embed), 13 (npm publish exclude), 14 (final docs), 15 (DDR).
- **Pattern**: Surgical edits — preserve the storyboard table, acceptance criteria, validation block; only swap the implementation layer.
- **Gotcha**: Don't delete the original tasks' "Gotcha" sections — many of them (e.g. "claude-in-chrome may not be connected") still apply to the Remotion-driven flow. Keep them; just re-anchor the "Do" steps.
- **Validate**: Side-by-side diff: every original task is either kept, replaced with a Remotion/VHS analogue, or explicitly removed (no orphans). The renumbered task list reads coherently top-to-bottom.

### Task 10: RECORD a DDR

- **Do**: Create `.ai/decisions/DDR-NNN-video-pipeline-toolchain-remotion-vhs-playwright.md`. Document:
  - Decision: choose Remotion (compose) + VHS (terminal) + Playwright (browser) + ffmpeg (post) over the original custom bash pipeline; explicitly reject Revideo/JSON-API SaaS/AI generation tools for stated reasons.
  - Research source: ref to the conversation deep research (2026-05-20).
  - Trade-offs: Remotion license risk above 3 employees; VHS limit on full-screen TUI; Playwright video defaults to WebM.
  - Reversibility: high — VHS/Playwright/Remotion are decoupled; can swap individual tools without rewriting the others.
  - Cross-link: DDR-008 (dev-server-bin canonical helpers — same ladder discipline), [`phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md), [`phase-15-video-pipeline-toolchain.md`](../plans/phase-15-video-pipeline-toolchain.md).
- **Pattern**: Follow `.ai/decisions/DDR-008-dev-server-bin-canonical-helper-home.md` shape (Decision, Context, Alternatives Considered, Consequences, Cross-links).
- **Gotcha**: Pick next free DDR number — `ls .ai/decisions/ | tail -5` to confirm.
- **Validate**: DDR validates against the schema implied by sibling DDRs; cross-links work.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm lint` — biome clean (no new errors in `scripts/video/smoke/` or root).
2. **Types**: not applicable repo-wide (no `tsc` script today); Remotion's `.tsx` is bundled by `@remotion/bundler` internally — failure surfaces at `remotion render` time.
3. **Smoke**: `pnpm run video:smoke` from a clean `scripts/video/.work` — exits 0 within ~60 s, prints "✅ Toolchain green", produces `scripts/video/.work/smoke/smoke.mp4` (duration ~9–12 s, H.264 1280×720, no audio).
4. **Per-tool**: each of `pnpm run video:smoke:{terminal,browser,card}` succeeds standalone (run after `rm -rf scripts/video/.work/smoke`).
5. **Idempotency**: running `video:smoke` twice in a row produces identical-size output (within ±1%); VHS and Remotion are deterministic, Playwright is approximately so.
6. **Publish hygiene**: `npm pack --dry-run 2>&1 | grep -E "(scripts/video|smoke)"` returns nothing — the smoke artifacts and tooling are repo-only.
7. **Runbook**: `cat scripts/video/README.md` includes Remotion license ack date (Task 0) and links to `phase-15.5-marketing-demo-video-30s.md` (Task 8).
8. **DDR**: `ls .ai/decisions/DDR-*video-pipeline*.md` returns exactly one file.
9. **Manual**: `open scripts/video/.work/smoke/smoke.mp4` — three scenes visible in order (terminal `mdcc --help`, Canvas Viewport browser, "smoke test" card). No black frames, no audio (intentional).
10. **Downstream**: `phase-15.5-marketing-demo-video-30s.md` reads top-to-bottom coherently after Task 9's edits — task ordering still valid, no dangling references to removed scripts.

---

## Scenario Coverage (UI tasks — not applicable)

This phase is **toolchain setup with zero product UI surface**. No `scenario-runner` invocation is required; `design-system-guard` and `a11y-auditor` likewise don't apply (the smoke video is not shipped to any UI surface).

The downstream plan ([`phase-15.5-marketing-demo-video-30s.md`](./phase-15.5-marketing-demo-video-30s.md)) embeds the final video into `site/` and does carry scenario coverage (`site-landing-video-autoplay`, `site-landing-reduced-motion` — already enumerated there).

---

## Acceptance Criteria

- [x] Tasks 0–10 completed in order
- [x] User explicitly acked Remotion license posture (Task 0) — ack 2026-05-20 in README + `// LICENSE-NOTE` in `remotion.config.ts`
- [x] `ffmpeg` (8.1.1) + `vhs` (0.11.0) on PATH; Playwright Chromium 148.0 + headless-shell 1223 installed
- [x] Root `package.json` has `video:smoke` + per-tool scripts; devDeps include all listed packages at remotion 4.0.463 / playwright 1.60.0 / react 19.2.6
- [x] `pnpm run video:smoke` exits 0 from a clean `.work/`, produces `smoke.mp4` (h264 / 1280×720 / 30fps / no audio / ~13.6 s — slightly above the plan's ~9–12 s estimate because VHS terminal scene runs 7 s; not a defect)
- [x] `scripts/video/README.md` exists with prereqs + per-tool smokes + troubleshooting matrix + cross-link to phase-15.5
- [x] `phase-15.5-marketing-demo-video-30s.md` updated (Task 9) — banner added; Tasks 2, 3, 5, 6, 8, 10, 14 replaced; Tasks 0/4/7/9/11/12/13/15 kept; validation block updated
- [x] DDR-031 recorded (Task 10), cross-linked from both plans
- [x] `npm pack --dry-run` does NOT include any `scripts/video/` files (verified — zero matches)
- [x] `pnpm lint` clean on new scope (0 errors, 4 pre-existing warnings carried over)
- [x] No DDR-worthy decision left unrecorded
- [x] No regressions in existing scripts (`scripts/check-version-parity.sh`, `scripts/bump-version.sh`) — not touched

---

## Retro

- **What worked.** Gating the three install steps (brew, pnpm, playwright install) up-front kept the rest of the phase mechanical — once tools were on PATH, every task was a Write or Edit. Background-running the long installs in parallel with file scaffolding saved real wall-clock time.
- **What surprised.** Two things diverged from the plan and were absorbed silently: (a) VHS ignores `Set Framerate 30` for MP4 output and still emits 25 fps — assemble.sh now pre-normalizes all inputs to 30 fps before `-c copy` concat (the troubleshooting matrix in the README documents this so a future reader doesn't re-discover it). (b) Playwright resolves a relative `outputDir` against the **config file directory**, not cwd, producing a nested `scripts/video/smoke/scripts/video/.work/...` path on first run — fixed by computing an absolute path via `import.meta.url` in `playwright.config.ts`. Both are now load-bearing notes in the README; `/design:edit` style "screenshot-before-fix" wasn't relevant here, but a 30-second misdiagnosis would have repeated on every fresh clone without these.
- **What I'd change in the next plan.** Estimate stitched duration from the per-tool durations, not as a target. The plan said "~9–12 s"; actual is 13.6 s because VHS terminal renders 7 s (`Sleep 4 s` plus type/run overhead), not the 3 s I implicitly expected. Not a defect — the plan's duration estimate was loose. For phase-15.5 the 30 s budget will be enforced by Remotion's `durationInFrames` per-scene; no equivalent risk.
- **What stays useful.** The smoke ladder pattern (`run.sh` orchestrator + per-tool `:terminal`/`:browser`/`:card` npm scripts for isolated debugging) mirrors `screenshot.sh`'s primary→fallback discipline. When phase-15.5 lands and adds 6 real scenes, the same shape can host them — only the scene list grows.
- **What's still owed.** Phase 15.5 must add `@remotion/transitions` to devDeps (its Task 10 will need it for xfades). Flagged inline in the refactored plan rather than retro-fitted here — keeps the toolchain phase minimal and the marketing phase self-contained.

