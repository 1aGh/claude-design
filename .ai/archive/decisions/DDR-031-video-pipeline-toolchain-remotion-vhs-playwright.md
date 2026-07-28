# DDR-031: Video pipeline toolchain — Remotion + VHS + Playwright + ffmpeg

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** video, toolchain, marketing, remotion, vhs, playwright, ffmpeg, devx
- **Related:** [DDR-008](./DDR-008-dev-server-bin-canonical-helper-home.md) (same ladder discipline), [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (dev-server runtime touches Scene 4 capture), [`.ai/plans/phase-15-video-pipeline-toolchain.md`](../plans/phase-15-video-pipeline-toolchain.md), [`.ai/plans/phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md), `scripts/video/README.md`

## Context

The original `phase-15.5-marketing-demo-video-30s.md` plan specified a
hand-rolled bash pipeline: `record-scene.sh` (ffmpeg `avfoundation` + macOS
`screencapture -v` fallback) for capture, `render-card.mjs` (headless Playwright
+ frame-by-frame screenshot loop + ffmpeg image-sequence encode) for cards,
`assemble.sh` (ffmpeg `xfade` cumulative-offset math + `drawtext` for burned-in
captions + 2-pass `loudnorm` + 2-pass H.264 encode) for final composition. Tally
was roughly 600 LOC of ladders, with several known-fragile pieces:

- `xfade` `offset` is cumulative and **subtracts** the transition duration —
  one bad offset = black gaps in the final cut.
- `drawtext` `between(t, T0, T1)` expressions had to be re-derived if any
  scene's duration shifted by even 100 ms.
- `screencapture -v` needed macOS Screen Recording permission and a 5 s
  countdown disable (`-T 0`).
- `record-scene.sh` had to fork into two distinct ladders (terminal vs Chrome)
  with `computer-use` clipboard hacks for terminal scenes (terminal apps are
  tier "click" — typing is blocked) and `claude-in-chrome` extension hooks for
  Chrome interactions (Chrome is tier "read" — clicks are blocked).

Deep research on 2026-05-20 produced a short list of declarative alternatives:

1. **Remotion** (React-based programmatic video, MIT-with-commercial-clause) —
   compositions, transitions, captions, audio mixing, all in JSX. Free for
   individuals and companies ≤3 employees; $100/mo above that.
2. **VHS** (charmbracelet, MIT) — declarative `.tape` DSL for headless terminal
   recording. No Screen Recording permission. ttyd-backed, deterministic.
3. **Playwright `--save-video=mp4`** (Apache-2.0) — native video output for
   browser scenes; no `claude-in-chrome` extension required, no Chrome
   tier-"read" tax for computer-use; full keyboard/mouse control inside the
   recorded scene.
4. **Revideo** (MIT) — alternative to Remotion built on Motion Canvas. Smaller
   ecosystem, fewer first-party docs, no commercial-license risk.
5. **SaaS APIs** (Shotstack, Cloudinary video) — JSON-API composers. Rejected
   for OSS-CI reproducibility and credit-cost reasons.
6. **AI generation tools** (Synthesia, Pictory) — rejected as inappropriate
   visual register for a developer tool's demo.

## Decision

Adopt **Remotion + VHS + Playwright + ffmpeg** as the marketing/demo video
toolchain. Per-tool role:

| Stage | Tool | Why |
| --- | --- | --- |
| Terminal capture | VHS | Headless, deterministic, no permission grant, declarative `.tape` syntax replaces the `computer-use` clipboard hack. |
| Browser capture | Playwright | Native video output, full keyboard + mouse control, no `claude-in-chrome` extension dep, same Chromium that Remotion bundles (no duplicate download). |
| Compose | Remotion | React/JSX compositions for cards (replaces `render-card.mjs` HTML + screenshot loop), `<TransitionSeries>` for xfades (replaces hand-rolled ffmpeg `xfade` math), `<Sequence>` for split-screen (replaces `hstack`), `<Audio>` with `volume` envelopes (replaces single-pass `loudnorm`), `<Video>` for scene embedding. |
| Post | ffmpeg | One-shot `loudnorm` (single-pass is fine post-Remotion mix), normalization between mismatched source fps (VHS emits 25 fps for MP4 regardless of `Set Framerate 30`; Playwright outputs WebM that needs H.264 transcode). |

Explicit rejections:

- **Revideo** — fewer Stack Overflow / GitHub-issues hits, narrower community,
  no transitions library equivalent to `@remotion/transitions`. The license
  trade-off (Revideo MIT vs Remotion commercial-above-3-employees) is real
  but currently moot for md-claude (solo OSS). If the org grows past 3
  people, swap to Revideo is a single-file replacement of the compose layer
  (`Final.tsx`); VHS, Playwright, ffmpeg are unaffected.
- **SaaS JSON-API composers** — incompatible with the project's OSS / no-vendor
  posture and `pnpm run video:smoke` end-to-end reproducibility goal.
- **AI generation** — wrong register; this is a tool demo, not a marketing
  reel that benefits from synthesized B-roll.

## Consequences

**Positive:**

- ~50–60% less custom code in the final-video plan: `phase-15.5` Task 2 (cards)
  drops the `render-card.mjs` screenshot loop; Task 3 drops `record-scene.sh`
  entirely; Task 8 drops `hstack` clapperboard; Task 10 drops `xfade` math +
  `drawtext` `between(t, ...)` expressions + 2-pass loudnorm + 2-pass H.264.
- Per-tool smokes (`pnpm run video:smoke:{terminal,browser,card}`) isolate
  failures. A new contributor debugging the pipeline gets a single-tool
  reproducer instead of a 600-LOC bash trace.
- Deterministic captures via `.tape` files mean re-recording a scene after a
  CLI label change is a one-line edit, not a Terminal-window-resize-and-pray
  workflow.
- Playwright video capture replaces the `computer-use` Chrome tier-"read"
  constraint that previously forced us through the `claude-in-chrome` MCP for
  Scene 4 alone. One tool covers every browser scene.

**Negative / risk:**

- **Remotion license risk above 3 employees** — gated by Task 0 of
  `phase-15-video-pipeline-toolchain.md` (ack captured in `scripts/video/README.md`
  + `scripts/video/smoke/card/remotion.config.ts` `// LICENSE-NOTE` comment).
  Future contributors inheriting the repo at a larger org must re-litigate
  before rendering.
- **VHS limit on full-screen TUIs** — Claude Code's REPL with animated cursor
  + streaming spinner renders fine in `.tape`, but specific full-screen TUIs
  (top, htop, vim with cursor blinking) may capture imperfectly. Documented
  failure mode in `scripts/video/README.md` troubleshooting matrix; fallback
  is the unselected `screencapture -v` path (still available, just not the
  default).
- **Playwright video defaults to WebM** — every browser smoke needs an ffmpeg
  transcode step. Encapsulated in `scripts/video/smoke/run.sh`; not a per-spec
  concern. Trade-off accepted for the native-video-recording ergonomics.
- **VHS MP4 output fps drift** — `Set Framerate 30` is honored for GIF but
  not for MP4 output (VHS emits 25 fps). Normalize step in
  `scripts/video/smoke/assemble.sh` handles this; documented in the
  troubleshooting matrix.

## Alternatives Considered

See Context table above for the full short-list. Rejection reasons:

- **Revideo**: smaller ecosystem; deferred as the swap-in plan if Remotion
  license posture changes.
- **Shotstack / Cloudinary video API**: vendor lock-in, credit-cost,
  unreproducible offline.
- **Synthesia / Pictory**: wrong visual register for a dev tool.
- **Original custom bash pipeline**: kept as the prior-art reference in
  `phase-15.5` git history; replaced wholesale.

## Reversibility

**High.** The four tools are decoupled:

- Replace Remotion with Revideo → only `scripts/video/cards/` and
  `scripts/video/final/Final.tsx` change; tapes and Playwright specs are
  untouched.
- Replace VHS with `screencapture -v + ffmpeg` → only `.tape` files become
  `.region.json` files; Remotion + Playwright untouched.
- Replace Playwright with `claude-in-chrome` + `record-scene.sh` → only
  `scripts/video/playwright/` specs revert; smoke contract identical.

The shared concat/normalize step in ffmpeg is the only piece every other layer
depends on; ffmpeg has no realistic replacement, so it stays.

## Cross-links

- [`.ai/plans/phase-15-video-pipeline-toolchain.md`](../plans/phase-15-video-pipeline-toolchain.md) — install + smoke + runbook (this DDR's enabling work).
- [`.ai/plans/phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md) — downstream consumer (refactored to use this toolchain).
- [DDR-008](./DDR-008-dev-server-bin-canonical-helper-home.md) — same ladder discipline (primary tool → documented fallback).
- [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) — dev-server runtime contract; Scene 4 capture depends on it.
- [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md) — canvas-lib single source; Playwright specs that target the canvas inherit this dependency.
- Research source: deep research conversation 2026-05-20 (md-claude session) that produced the tool short-list.
