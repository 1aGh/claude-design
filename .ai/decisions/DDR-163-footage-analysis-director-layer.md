# DDR-163: Footage-analysis + AI director layer — vision keyframes over ffmpeg, EDL as the director artifact

**Status:** Accepted — 2026-07-10 (implemented via `/flow:execute`, plan `.ai/plans/feature-footage-analysis-director.md`).
**Extends:** [DDR-148](DDR-148-video-comp-remotion-authoring-capture-export.md) (the video-comp authoring + capture-first export spine — this is the missing FRONT half: understanding footage before composing it), [DDR-088](DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the content-addressed asset-write surface the ingest verb reuses), [DDR-161](DDR-161-in-app-photo-editor-webgl-pipeline-and-photoedit-sidecar.md) (the `<sha8>.<kind>.json` VERSIONED sidecar + dependency-free-schema + hand-rolled-validator pattern, mirrored here).
**Related:** [DDR-115](DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (keyframe scratch → `/tmp`, sidecars VERSIONED — no new `_*` path), [DDR-062](DDR-062-plugins-reach-executable-logic-via-maude.md) (both new verbs dispatch via `maude design`), [DDR-054](DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (the footage route is main-origin-only, absent from both canvas allowlists), [DDR-094](DDR-094-draw-animation-keyframe-ir-native-authoring-lottie-export.md) (freeze-frames-lie — the probe samples evenly-spaced midpoints; the analyst reasons over the frame SEQUENCE).
**Instruments:** `apps/studio/footage/schema.ts` (`FootageAnalysis` + `Edl` + validators), `apps/studio/footage-store.ts` + `apps/studio/http.ts` (`/_api/footage` route, loopback-only) + `apps/studio/test/canvas-origin-gate.test.ts` (403 guard), `apps/studio/bin/ingest-footage.sh`/`_ingest-footage.mjs` (folder → assets), `apps/studio/bin/probe-footage.sh`/`_probe-footage-playwright.mjs` (clip → keyframes), `cli/commands/design.mjs` (BIN_VERBS), `plugins/design/agents/footage-analyst.md` + `footage-director.md`, `plugins/design/skills/footage-director/SKILL.md`, `plugins/design/commands/reel.md`.

## Context

DDR-148 gave Maude a genuine video-authoring loop — a Remotion comp mounted in the Player, stitched with `<TransitionSeries>`, exported through the capture spine. But it starts from the assumption that **you already hold the clips and know the arrangement**. There was no way for Claude to *understand raw footage before editing it*: no folder ingest, no mechanism to actually *watch* a clip and find its good shots, and no "director" reasoning that orders shots across all the clips into a cut that makes narrative sense. The user wants `folder-of-clips → finished, graphics-laden cut` from one prompt, like a director: understand → find good shots → arrange → generate.

## Decision — a five-stage layer on top of DDR-148

`ingest-footage → footage-analyst (vision, per clip) → footage-director (EDL) → EDL→<TransitionSeries> codegen → critics`, orchestrated by `/design:reel`.

### 1. Frame extraction via a headless `<video>`, NOT ffmpeg

To "see" footage, Claude needs frames. We extract them by decoding the clip in **headless Chromium** (Playwright) with a plain HTML5 `<video>` seeked to evenly-spaced midpoints and screenshotted — **zero native renderer binaries**, consistent with DDR-148's posture. Notably this needs **no dev server and not even Remotion**: the probe page is navigated as `file://` (with `--allow-file-access-from-files`) and the clip is a same-scheme `file://` subresource, so probing works offline / pre-server (unlike the export capture, which drives the live Player). ffmpeg was rejected (per-platform binaries, distribution weight); a home-grown luma-histogram scene detector was rejected because **Claude IS the shot detector** — vision over keyframes judges "is this a *good* shot for this brief," which a histogram can't.

**`about:blank` cannot host a `file://` subresource** (opaque origin) even with the flag — the probe writes a throwaway `file://` host page. This was found + fixed live during implementation.

### 2. Two VERSIONED sidecars (mirror the DDR-161 photo pattern)

- `assets/<sha8>.footage.json` — a `FootageAnalysis` (per clip): shots, good-moment ranges, subject/motion/lighting/mood, per-shot `quality` + `usable`, a summary. **Seconds-based** (source time).
- `<designRoot>/<slug>.edl.json` — an `Edl` (per cut): the director's ordered beat list. **Output-frame-based** (Remotion's clock); `startSec` is the only seconds value.

**Why two clocks:** an HTML5 `<video>` reports `duration` but not a reliable native fps, and the analyst reasons in seconds; the composition composes at a chosen OUTPUT fps where lengths ARE frames. The director converts source-seconds → output-frames at codegen (`startFrom = round(startSec * fps)`). Keeping the clocks separate sidesteps a fragile fps-probe.

Both sidecars are **VERSIONED** (DDR-115 — they commit + sync like `.meta.json`/`.photo.json`/`.annotations.svg`). **No new `_*` runtime path is introduced** — keyframe PNGs are throwaway scratch in `/tmp`. The DDR-115 triple-list (`isMaudeRuntimeState` / `gitignore-block.mjs` / `.gitignore`) is deliberately **untouched**.

### 3. The EDL is the director artifact; codegen is a pure text transform

The `footage-director` agent emits the `Edl` (which shots, in what order, joined by which of the **six bundled** transitions, with which overlays). The `/design:reel` codegen turns it into a **Timeline-parseable** `<TransitionSeries>` video-comp — one **literal** `<TransitionSeries.Sequence name>` block per beat, **never `.map()`** (the DDR-148/DDR-150 rule: the Timeline reads the file as text; a loop collapses N beats into one row). Multiple shots from one clip = multiple literal blocks with different `startFrom`. This keeps the whole thing inside the existing video-comp authoring contract — the cut is hand-editable on the Timeline exactly like a hand-authored comp.

### 4. The `/_api/footage` route is main-origin-only (privileged)

Unlike `/_api/photo-edit` (canvas-reachable — the compositor GETs it), the footage route is written only by the analyst/director agents over loopback. It is **absent from both canvas allowlists** (`CANVAS_SAFE_API` + `startCanvasServer` routes); a `GET → 403` from the canvas origin is asserted in `canvas-origin-gate.test.ts`. The DDR-088 cap stack (sha8/slug validate + containment + `validate{FootageAnalysis,Edl}` + 256 KB size cap) guards the caller-derived write path.

### 5. Transitions — Remotion already has the library; Maude already ships it

The user's "is there a transitions library" question: **yes** — `@remotion/transitions` is bundled (DDR-148). The director uses the six bundled presentations (`none`/`fade`/`slide`/`wipe`/`flip`/`clock-wipe`); nothing else resolves on an end-user install. Widening the set is a **gated follow-up** (bundle + `.min-sizes.json` floor + `check-runtime-bundles.sh`), not done in v1 — bytes on every canvas.

## Scope: vision-only

Audio analysis is **out of scope** — no transcript, no whisper, no beat detection, no audio-driven cut timing. The director composes on visual rhythm alone. A user-dropped `--music` track rides under the finished cut as a plain `<Audio>` layer (existing video-comp vocabulary), not part of analysis. This keeps the "one prompt, zero install" promise intact (no model download). Audio-aware editing is a clean future layer that reads the same sidecar seams; nothing here forecloses it.

## Consequences

- **`maude design ingest-footage` / `probe-footage`** join the DDR-062 BIN_VERBS; both `.sh`+`.mjs` ship via `apps/studio` in `package.json` `files` (already covered). Neither boots the dev server.
- **The probe depends on Playwright's Chromium** (like every other capture shim) — the same missing-browser remediation (`_pw-launch.mjs`) applies.
- **Live-verified during implementation** (real ffmpeg-synthesized 4s clip): ingest content-addresses + dedupes + skips polyglots; probe extracts 6 distinct decoded keyframes (color-bars, confirmed by reading a PNG). The analyst/director agents + the full `/design:reel` orchestration on real client footage is the **live-browser gate** the owner holds (same posture as the photo-editor's ML pass) — the schema/store/verbs/route + unit tests are landed and green.

## Revisit when

- **ffmpeg optionalDeps** — if a cut needs a source property the `<video>` probe can't surface (exact native fps, keyframe-accurate seeking on long-GOP clips).
- **Audio-aware editing** — cut-on-beat / speech-driven timing (reads the same `footage.json`/`edl.json` seams).
- **Widening the transition bundle** — a real cut needs a presentation beyond the six.
- **A `footage-critic`** — an aspiration-axis judge for the cut (pacing, coverage, story) alongside the motion/design critics.

## Linked

Plan: [`.ai/plans/feature-footage-analysis-director.md`](../plans/feature-footage-analysis-director.md).
