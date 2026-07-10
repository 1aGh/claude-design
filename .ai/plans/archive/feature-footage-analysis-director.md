# Feature: Footage analysis + AI director — from a folder of clips to a cut, in one prompt

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — this feature is a **new layer on top of the shipped video-comp spine (DDR-148)**, not a rewrite of it.

## Description

Today Maude can **author** a video-comp (a real Remotion composition mounted in
the Player, exported via the capture spine — DDR-148) and **stitch clips** with
`<TransitionSeries>`. But it starts from the assumption that *you already know
which clips, which moments, and in what order*. There is **no mechanism for
Claude to understand the footage before editing it** — no way to point at a
folder of raw clips, have Claude actually *watch* them, find the good shots,
characterize each clip, and then assemble them like a director into a cut that
makes narrative sense.

This feature adds that missing front half of the pipeline:

1. **Ingest** raw footage — from a **folder path** (`/…/podklady/video`) or from
   **clips dropped into a canvas** — into `<designRoot>/assets/` (content-addressed,
   reusing the DDR-088/DDR-148 asset surface).
2. **Analyze** each clip — extract keyframes via the **existing capture spine**
   (no ffmpeg binaries), have Claude *watch* them (+ optional audio transcript),
   and write a per-clip **`<sha8>.footage.json` sidecar**: shots, good-moment
   frame ranges, subject / motion / lighting / mood tags, usable-vs-unusable.
3. **Direct** — a `footage-director` agent reads every footage sidecar + the
   brief and produces an **Edit Decision List (EDL)**: an ordered list of
   `{clip, in, out, why, transition, overlay}` beats — the "reziser poskládá
   záběry za sebe aby dávaly smysl" logic, free to pull **multiple shots from
   one clip**.
4. **Generate** — turn the EDL into a Timeline-parseable `<TransitionSeries>`
   video-comp TSX with graphics/titles, using the **existing video-comp skill**.
5. **Critique** — run the motion/design critics, then hand off for scrub/export.

The whole chain is drivable from **one prompt** via a new `/design:reel`
orchestrator command, with `footage-analyst` + `footage-director` agents and a
`footage-director` skill as the supporting stack.

**On the transitions question:** `@remotion/transitions` is **already bundled**
(fade / slide / wipe / flip / clock-wipe / none — see video-comp SKILL.md).
Remotion has this library and Maude already ships it. This plan *documents and
lightly widens* it (see Task 10), it does **not** build a new one.

## User Story

As a **designer/editor**, I want to point Maude at a folder of raw client clips
(or drop them on a canvas) and say "make me a 30s rebrand reel," so that Claude
**watches the footage first**, finds the strongest shots, arranges them like a
director, and generates a graphics-laden cut I can then scrub, retime, and export
— without me pre-selecting a single frame.

## Problem

- **No footage comprehension.** `video-comp` takes `assets/clip.mp4` as a given
  black box. Claude has never *seen* the pixels — it can't say "the drone push-in
  at 0:04–0:07 is the hero shot" because it has no frames to look at.
- **No director layer.** There is no artifact that reasons over *all* the clips
  at once to pick moments and order them into a narrative. Ordering today is
  hand-authored in the TSX.
- **No folder ingest.** `fetch-asset` pulls a single URL; there is no
  "ingest this directory of videos" verb. Canvas drop uploads one file and
  toasts a snippet (auto-insert is a documented DDR-148 follow-up).
- **Not one-prompt.** The user wants `folder → finished cut` from a single
  instruction; today that's a manual multi-step author loop.

## Solution

A **five-stage pipeline** layered onto the DDR-148 spine, reusing every piece
of existing infrastructure:

```
folder path ─┐
             ├─▶ (1) ingest-footage ─▶ assets/<sha8>.mp4  (+ probe: dur/fps/dims)
canvas drop ─┘                          │
                                        ▼
                        (2) probe-footage ── capture spine (Playwright + @remotion/media
                                        │      OffthreadVideo, NO ffmpeg) ─▶ N keyframe PNGs
                                        ▼
                        footage-analyst agent ── watches keyframes (+ optional whisper
                                        │          transcript) ─▶ <sha8>.footage.json
                                        ▼
                        (3) footage-director agent ── reads ALL footage.json + brief
                                        │              ─▶ <slug>.edl.json  (ordered beats)
                                        ▼
                        (4) EDL → <TransitionSeries> video-comp TSX  (existing skill)
                                        ▼
                        (5) motion/design critics ─▶ scrub/export (existing)
```

**Why keyframe-vision, not a home-grown scene detector:** Claude *is* the shot
detector — give it evenly-sampled frames (+ scene-cut candidates) and it
characterizes footage far better than a luma-histogram heuristic, and it's the
only thing that can judge "is this a *good* shot for a rebrand reel." The
capture spine already decodes video deterministically in Chromium
(`@remotion/media` `OffthreadVideo`, DDR-148 addendum) — extracting frames is
the same seek-and-screenshot muscle the exporter already uses. **Zero new native
binaries**, consistent with DDR-148's "no renderer binaries" posture.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (bin verbs + capture-spine frame grab + sidecar
  store + schema), `plugins/design` (2 agents, 1 skill, 1 command), `cli`
  (`maude design ingest-footage` / `probe-footage` dispatch)
- **Affected Systems**: asset intake (DDR-088/DDR-148), capture spine
  (DDR-041/DDR-148), runtime-state taxonomy (DDR-115), design plugin
  command/agent/skill naming (DDR-004/DDR-006), `maude design <verb>` dispatch
  (DDR-062)
- **Dependencies**: none new — the whole path reuses the capture spine.
  **Audio analysis is out of scope entirely** (no whisper/transcript, no beat
  detection). Analysis is **vision-only, full stop**. A plain user-dropped music
  track can still ride along as an ordinary `<Audio>` layer (that's not analysis
  — it's the existing video-comp media vocabulary), but nothing in this feature
  listens to or reasons about audio.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `plugins/design/skills/video-comp/SKILL.md` — the authoring contract the
  generator (Stage 4) must obey: determinism iron law, bundled-imports-only,
  `<VideoComp>` meta, **Timeline-parseable literal `<TransitionSeries.Sequence>`
  blocks (never `.map()`)**, `assets/` refs, the 6 bundled transition
  presentations. The EDL→TSX task emits exactly this shape.
- `.ai/decisions/DDR-148-video-comp-remotion-authoring-capture-export.md` — the
  whole spine: capture-first export, `@remotion/media` `OffthreadVideo` decoding
  to `<canvas>` in Chromium (the frame-grab reuse), asset-intake caps, the dual
  allowlist, `cspForCapture()` (attacker-F1) that the probe render must also carry.
- `apps/studio/bin/_video-playwright.mjs` (whole file) — the capture shim to
  fork for `_probe-footage-playwright.mjs`: `launchChromium`, `__maude_seek__`,
  the `<video>.currentTime`+`seeked` wait, frame screenshot loop.
- `apps/studio/photo/schema.ts` (lines 1-40) — the **sidecar-schema pattern to
  mirror**: dependency-free TS types + hand-rolled structural validator + a
  `version` marker, persisted as `assets/<sha8>.photo.json` (VERSIONED). The
  `footage.json` + `edl.json` schemas copy this house style exactly.
- `apps/studio/photo-store.ts` — the server-side read/write/route pattern for a
  `<sha8>.<kind>.json` sidecar (mirror it for `footage-store.ts`).
- `apps/studio/bin/fetch-asset.sh` + `apps/studio/bin/_fetch-asset.mjs` — the
  single-URL, hardened, content-addressed ingest to generalize into a
  **directory** ingest (SSRF rationale N/A for local dirs, but the
  content-address + containment-assert + magic-byte sniff carry over).
- `apps/studio/use-canvas-media-drop.tsx` (lines 1-60) — the canvas-drop path;
  Stage-1 "drop clips on a canvas" reuses `onMedia` → `POST /_api/asset`.
- `apps/studio/api.ts` — `sniffAssetType` (mp4/mov/webm caps) + `saveAsset`
  containment; the folder-ingest verb writes through the same discipline.
- `cli/commands/design.mjs` — the `maude design <verb>` dispatch table to add
  `ingest-footage` + `probe-footage` to (DDR-062).
- `plugins/design/agents/ux-research-agent.md` + `plugins/design/agents/motion-critic.md`
  — agent frontmatter/house-style to mirror for the two new agents.
- `plugins/design/CATEGORIES.md` — pick the group prefix for the new command +
  agents (DDR-004).

### Files to Create

- `apps/studio/footage/schema.ts` — `FootageAnalysis` + `Edl` types + validators
  (mirrors `photo/schema.ts`).
- `apps/studio/footage-store.ts` — sidecar read/write + `/_api/footage` route
  (mirrors `photo-store.ts`).
- `apps/studio/bin/ingest-footage.sh` + `apps/studio/bin/_ingest-footage.mjs` —
  folder→`assets/` content-addressed copy + probe manifest.
- `apps/studio/bin/probe-footage.sh` + `apps/studio/bin/_probe-footage-playwright.mjs`
  — keyframe extraction via the capture spine.
- `plugins/design/agents/footage-analyst.md` — vision characterization agent.
- `plugins/design/agents/footage-director.md` — EDL-assembly ("reziser") agent.
- `plugins/design/skills/footage-director/SKILL.md` — the EDL vocabulary + the
  director rubric + EDL→`<TransitionSeries>` codegen contract.
- `plugins/design/commands/reel-cut.md` — `/design:reel` one-prompt orchestrator
  (name per DDR-006: `name: design:reel`).
- `.ai/decisions/DDR-XXX-footage-analysis-director-layer.md` — the decision
  record (capture-spine frame-grab over ffmpeg; vision-over-heuristic shot
  detection; EDL as the director artifact; whisper deferred/opt-in).

### Design canvases

> No `.design/` canvas matches "footage/reel/director" today. Closest existing
> video-comp work: `.design/ui/Studio Intro Video.tsx` + `Maude Video Intro.tsx`
> — reference these for the `<VideoComp>`/`<DCArtboard>` envelope the generated
> cut must live in, not as feature mockups.

### Documentation

- `@remotion/transitions` — presentations API (`TransitionSeries`, `linearTiming`,
  `springTiming`, `fade/slide/wipe/flip/clock-wipe/none`). Already bundled;
  consult context7/Remotion docs before widening (Task 10).
- Remotion `OffthreadVideo` / `@remotion/media` — decode-to-canvas semantics
  (DDR-148 addendum documents the gotcha the probe shim must respect).

### Patterns to Follow

- **Sidecar = params/metadata only, never pixels, `version`-stamped, VERSIONED
  next to its asset** (`photo/schema.ts`). `footage.json` describes the clip;
  `edl.json` describes the cut. Both are `git`-tracked (like `.photo.json`,
  `.meta.json`, `.annotations.svg`).
- **Reach executable logic via `maude design <verb>`, never a raw bin path**
  (DDR-062) — the new command + agents call `maude design ingest-footage` /
  `probe-footage`. `cli/lib/plugin-cli-reachability.test.mjs` will fail otherwise.
- **Capture/probe routes stay MAIN-ORIGIN ONLY** (absent from both canvas
  allowlists — DDR-148 attacker-F1). The probe render carries `cspForCapture()`.
- **Timeline-parseable codegen**: one **literal** `<TransitionSeries.Sequence
  name="…" durationInFrames={…}>` block per EDL beat — **never `.map()`**
  (video-comp SKILL.md, the load-bearing "loop is invisible to the Timeline"
  rule).

---

## Runtime-state taxonomy (DDR-115 — decide up front)

`<sha8>.footage.json` and `<slug>.edl.json` are authored analysis a user will
want to keep and version — treat them as **VERSIONED** (same bucket as
`.photo.json` / `.meta.json` / `.annotations.svg`), **not** `_*` runtime state.
Extracted keyframe PNGs are **throwaway scratch** → write them to
`/tmp`/scratchpad (DDR-115: capture scratch never gets a new `_*` dir), never to
`assets/`. **No `.gitignore` triple-list change is needed** because we add no new
`_*` path — call this out in the DDR so nobody adds one by reflex.

---

## Tasks

Execute in dependency order. Each is atomic and testable.

### Task 1: ADD `apps/studio/footage/schema.ts`

- **Do**: Define `FootageAnalysis` (per-clip) + `Edl` (per-cut) TS interfaces +
  `version` marker + hand-rolled structural validators + `isEmptyAnalysis()`.
  Shape:
  - `FootageAnalysis`: `{ asset, durationInFrames, fps, width, height,
    shots: {in, out, kind, subject, motion, lighting, mood, quality: 0..1,
    usable: boolean, note}[], summary, tags[], version }`.
  - `Edl`: `{ title, fps, width, height, beats: {clip, in, out, why,
    transition: {presentation, frames}|null, overlay: {kind, text?}|null }[],
    music?: {asset, fadeOutFrames}, version }`.
- **Pattern**: `apps/studio/photo/schema.ts` — dependency-free, no Ajv, no
  browser/native import (imported by both server and any client surface).
- **Gotcha**: frame-based, not ms (matches Remotion + the Timeline).
- **Validate**: `cd apps/studio && bun test footage/schema` (add a unit test
  mirroring the photo schema test).

### Task 2: ADD `apps/studio/footage-store.ts` + `/_api/footage` route

- **Do**: Read/write `assets/<sha8>.footage.json` and `<designRoot>/<slug>.edl.json`.
  GET/PUT route registered on the MAIN origin only.
- **Pattern**: `apps/studio/photo-store.ts` + its `/_api/photo-edit` route.
- **Gotcha**: **NOT** in `CANVAS_SAFE_API` / `startCanvasServer` routes — this is
  privileged (writes analysis the director trusts). Assert `GET → 405` from the
  canvas origin in `test/canvas-origin-gate.test.ts` (the DDR-148 pattern).
- **Validate**: `bun test test/canvas-origin-gate` + a store round-trip test.

### Task 3: ADD `ingest-footage` bin verb (folder → assets)

- **Do**: `_ingest-footage.mjs` walks a directory (non-recursive default,
  `--recursive` opt), sniffs each file (`sniffAssetType`), content-addresses it
  to `assets/<sha8>.<ext>` (dedupe), and emits a JSON manifest
  `{clips: [{asset, src, bytes}], skipped: [{src, why}]}`. `ingest-footage.sh`
  is the DDR-062 shim (node primary, bun fallback — mirror `fetch-asset.sh`).
- **Pattern**: `bin/_fetch-asset.mjs` (content-address + containment) + `api.ts`
  `saveAsset`/`sniffAssetType`.
- **Gotcha**: honor the DDR-148 caps (per-file 100 MB, session budget); a
  Google-Drive-CloudStorage path (the user's example) is a normal local dir once
  synced — no network fetch. **Log skipped oversized/non-video files loudly** (no
  silent truncation).
- **Validate**: `node apps/studio/bin/_ingest-footage.mjs <tmp-dir-of-clips>
  --root <repo> --json`.

### Task 4: ADD `probe-footage` bin verb (clip → keyframes via capture spine)

- **Do**: `_probe-footage-playwright.mjs` boots Chromium (`_pw-launch.mjs`),
  mounts a throwaway probe page with `<OffthreadVideo src="assets/<sha8>.mp4">`,
  reads `durationInFrames/fps/width/height`, then seeks to N evenly-spaced frames
  (default 12, `--frames N`) **plus** cheap scene-cut candidates (frame-diff over
  a coarse pass, optional v1.1), screenshots each to `/tmp/.../footage-<sha8>/`,
  and prints the frame manifest `{asset, fps, duration, frames:[{frame, t, png}]}`.
  `probe-footage.sh` is the DDR-062 shim.
- **Pattern**: `bin/_video-playwright.mjs` — same `launchChromium`, seek, and
  `<video>.currentTime`+`seeked` wait. Carry `cspForCapture()` on the probe page.
- **Gotcha**: `@remotion/media` decodes to `<canvas>` not `<video>` (DDR-148
  addendum) — screenshot the artboard, don't wait on a `<video>` `seeked` event
  for that path; the frame-step spine's own note covers this. **Keyframes are
  scratch → `/tmp`, never `assets/`** (Task's DDR-115 line).
- **Validate**: `maude design probe-footage assets/<sha8>.mp4 --root <repo>
  --frames 8` → 8 PNGs + manifest. Verify frames differ (freeze-frames lie,
  DDR-094 — sample 2+ and confirm change).

### Task 5: ADD `maude design ingest-footage` + `probe-footage` dispatch

- **Do**: Wire both verbs into `cli/commands/design.mjs`'s dispatch table so
  plugin markdown reaches them via `maude design <verb>` (DDR-062).
- **Pattern**: existing `screenshot` / `fetch-asset` dispatch entries.
- **Gotcha**: add the two `.sh` files to `package.json` `files` (bin helpers ship
  via npm, not the marketplace — CLAUDE.md rule).
- **Validate**: `node cli/bin/maude.mjs design ingest-footage --help` +
  `... probe-footage --help`; `bun test cli/lib/plugin-cli-reachability.test.mjs`.

### Task 6: CREATE `plugins/design/agents/footage-analyst.md`

- **Do**: Agent that, per clip, runs `maude design probe-footage`, **reads the
  keyframe PNGs** (vision), and writes `assets/<sha8>.footage.json` via
  `PUT /_api/footage`: segment into shots, tag subject/motion/lighting/mood,
  mark good-moment frame ranges + a `quality` score + `usable`, one-line
  per-shot note and a clip summary. **Vision-only — no audio.** The agent never
  probes or reasons about the clip's audio track.
- **Pattern**: `plugins/design/agents/ux-research-agent.md` frontmatter/style;
  `name: design:footage-analyst`, group per CATEGORIES.md.
- **Gotcha**: **freeze-frames lie** (DDR-094) — reason over the *sequence* of
  keyframes for motion, not a single frame. Never invent moments not visible in
  a frame.
- **Validate**: run against 2-3 real clips; inspect the `footage.json` sidecars
  for sane shot boundaries + quality scores.

### Task 7: CREATE `plugins/design/agents/footage-director.md`

- **Do**: The "reziser." Reads **every** `footage.json` + the brief (tone,
  length, aspect, must-include) and emits `<slug>.edl.json`: an ordered beat list
  that tells a story, **free to pull multiple shots from one clip**, assigning a
  transition + optional graphic overlay per beat, and a music bed. Encodes
  editing heuristics (hook first, vary shot scale/motion, match on action, breathe
  before the logo, respect the target duration). **No audio-driven timing** — the
  cut is composed on visual rhythm alone; a music bed, if the user drops one, is
  laid under the finished cut as a plain `<Audio>` layer, it does not drive edits.
- **Pattern**: `ux-research-agent.md` (reads a cache, emits structured JSON);
  `name: design:footage-director`.
- **Gotcha**: EDL frames must be **within** each clip's `durationInFrames`;
  transitions restricted to the **6 bundled presentations** (video-comp SKILL.md).
  Total duration = sum(beat lengths) − sum(transition overlaps) (the SKILL's
  literal-sum rule).
- **Validate**: EDL validates against `schema.ts`; every `{clip,in,out}` lies
  inside the referenced clip; transitions ∈ the bundled six.

### Task 8: CREATE `plugins/design/skills/footage-director/SKILL.md`

- **Do**: Own (a) the EDL vocabulary + director rubric the agent applies, and
  (b) the **EDL → `<TransitionSeries>` video-comp codegen contract**: one literal
  `<TransitionSeries.Sequence name="beat-N" durationInFrames={…}>` per beat with
  an `<OffthreadVideo src="assets/<sha8>.mp4" startFrom={in} />`, literal-sum
  `TOTAL`, overlays as DS-token'd `<AbsoluteFill>` children, `<Audio>` music bed.
  Explicitly **defer** to `video-comp` SKILL.md for the Remotion iron rules.
- **Pattern**: `plugins/design/skills/video-comp/SKILL.md`'s worked 4-clip example
  **is** the target output shape — the codegen produces exactly that.
- **Gotcha**: **never `.map()` the beats** (Timeline-invisible). `startFrom` on
  `<OffthreadVideo>` is how a beat uses a mid-clip in-point; a second beat from
  the same clip is a second literal block with a different `startFrom`.
- **Validate**: hand-generate a comp from a sample EDL; open it, confirm the
  Timeline panel shows N distinct named clip rows (not one collapsed fallback).

### Task 9: CREATE `plugins/design/commands/reel-cut.md` (`/design:reel`)

- **Do**: The one-prompt orchestrator. Args: a folder path and/or "use the clips
  on the active canvas," + a brief. Steps: (0) pre-flight (server up, config);
  (1) `ingest-footage` the folder (or collect canvas `assets/` clips); (2) fan
  out `footage-analyst` per clip (parallel, capped); (3) `footage-director` →
  EDL; (4) codegen the `<TransitionSeries>` comp via the `footage-director`
  skill into a new canvas; (5) motion + design critics; (6) report + next-step
  block (scrub in Player / `/design:export mp4`).
- **Pattern**: `plugins/design/commands/new.md` orchestration shape; `name:
  design:reel`, group + filename per DDR-004/DDR-006 (`reel-cut.md`).
- **Gotcha**: analyst fan-out is the expensive step — cap concurrency (3-4, the
  setup-ds ceiling) and **cache** `footage.json` (skip re-probe if the sidecar
  exists and the asset hash matches). Surface the license note once (Remotion,
  per video-comp SKILL.md).
- **Validate**: end-to-end on the user's real folder → a scrubable, exportable
  cut, one command.

### Task 10: DOCUMENT (+ optionally widen) the transitions library

- **Do**: In the `footage-director` skill, catalog the **6 already-bundled**
  presentations with when-to-use director guidance. Evaluate widening the bundle
  with `@remotion/transitions/wipe` directions + `clock-wipe` params, and (behind
  a size check) `dreamy-zoom` — but only if `check-runtime-bundles.sh` floors +
  `.min-sizes.json` are updated and the bundle stays committed (DDR-148 "whatever
  is committed is what ships").
- **Pattern**: `apps/studio/runtime-bundle.ts` `RUNTIME_PACKAGES` + the committed
  `dist/runtime/*.js` + floors.
- **Gotcha**: **do not** add exotic presentations casually — each is bytes on
  every canvas. Default answer to "does Remotion have a transitions library" is
  **yes, and we ship it** — widening is optional and gated.
- **Validate**: `bash apps/studio/bin/check-runtime-bundles.sh` green after any
  bundle change.

### Task 11: RECORD DDR + What's New + roadmap regen

- **Do**: Write `DDR-XXX-footage-analysis-director-layer.md` (capture-spine
  frame-grab over ffmpeg; vision-over-heuristic shot detection; EDL as the
  director artifact; footage.json/edl.json VERSIONED, no new `_*` path;
  vision-only, audio out of scope). Append a **pending** What's New entry
  (`whats-new-entry` skill).
  Regen the roadmap.
- **Pattern**: CLAUDE.md "Site roadmap regen" + "In-app What's New feed" rules.
- **Gotcha**: check the decisions dir **and** the uncommitted README index diff
  before claiming the next DDR number (DDR-numbering races on shared main).
- **Validate**: `pnpm --filter @maude/site gen:roadmap` diff committed;
  `scripts/check-version-parity.sh` unaffected.

---

## Scope note: analysis is vision-only

Audio is **explicitly out of scope** — no transcript, no whisper, no
beat-detection, no audio-driven cut timing. The director composes purely on
visual rhythm (shot scale, motion, subject, mood over the keyframes). This keeps
the "one prompt, zero install" promise fully intact (no model download, no new
binary). A user-dropped music track can still sit under the finished cut as an
ordinary `<Audio>` layer — that's the existing video-comp vocabulary, not part of
this feature's analysis. If audio-aware editing is ever wanted, it's a clean
future layer that reads the same `footage.json`/`edl.json` seams; nothing here
forecloses it.

---

## Validation

1. **Types/lint**: `pnpm lint` (repo has no `tsc` gate — DDR-026 baseline).
2. **Unit**: `cd apps/studio && bun test footage/ footage-store canvas-origin-gate`
3. **CLI reachability**: `bun test cli/lib/plugin-cli-reachability.test.mjs`
4. **Runtime bundles** (if Task 10 touches the bundle):
   `bash apps/studio/bin/check-runtime-bundles.sh`
5. **End-to-end (the real acceptance)**: `/design:reel` on a folder of ≥4 real
   clips → footage.json per clip → edl.json → a scrubable video-comp canvas →
   `/design:export mp4` produces a coherent, graphics-laden cut. Verify motion
   over **two** frames (DDR-094).
6. **Design/motion critics**: the generated comp passes the motion-critic's
   over-time gate + design-critic.

---

## Acceptance Criteria

- [ ] Point at a folder **or** use canvas clips → footage ingested to `assets/`.
- [ ] Each clip gets a `<sha8>.footage.json` with shots + good-moment ranges,
      grounded in **actually-watched keyframes** (no invented moments).
- [ ] `footage-director` emits a valid `<slug>.edl.json` that pulls **multiple
      shots from one clip** where it makes sense and orders beats narratively.
- [ ] EDL → a **Timeline-parseable** `<TransitionSeries>` comp (N literal named
      blocks, never `.map()`), with graphics + a music bed, using **bundled**
      transitions.
- [ ] The whole chain runs from **one `/design:reel` prompt**.
- [ ] **Zero new native binaries**; **vision-only** — no audio analysis anywhere.
- [ ] Capture/footage routes MAIN-ORIGIN only (`GET → 405` from canvas origin).
- [ ] No new `_*` runtime path (footage.json/edl.json VERSIONED); DDR-115 triple-
      list untouched by design.
- [ ] DDR recorded; What's New pending entry; roadmap regenerated.
- [ ] Naming: `name: design:reel` / `design:footage-analyst` /
      `design:footage-director` (DDR-006); filenames group-prefixed (DDR-004).
```

## Acceptance — met (2026-07-10)

All criteria met. Feature landed on `main` in commit `1830343e` (schema + store +
`/_api/footage` route + `ingest-footage`/`probe-footage` verbs + CLI dispatch + the
two agents + skill + `/design:reel` command + DDR-163 + What's New + roadmap).
**The owner live-gate is now satisfied** — the full pipeline was dogfooded
end-to-end on real client footage (Alligators Brno recruiting folder → ingest → 6
parallel vision analysts → director EDL → `<TransitionSeries>` codegen →
capture-spine MP4), producing a 29 s director cut AND a 24 s effect-maxed cinematic
cut. Ingest/probe were live-verified (dedupe, polyglot-skip, 6 real decoded
keyframes); footage/edl schemas + the canvas-origin 403 gate are unit-green.

## Retro

- **The vision-only pipeline works and the output is genuinely good.** Six analysts
  fanned out in parallel, the director assembled a coherent 35-beat arc that a human
  editor endorsed ("jak to na sebe navazuje ty klipy… fakt dobrej"). Keyframe-vision
  beat a heuristic shot-detector exactly as the plan bet.
- **Sparse keyframe sampling misses baked graphics.** 12–14 frames over a 40 s
  *finished-promo* clip straddled 1–2 s baked title cards → a beat landed on foreign
  text. Fix folded back into `footage-analyst` (≥1 fps + flag baked text) and
  `footage-director` (avoid those in-points). Raw footage is fine; edited promos need
  denser sampling.
- **The export path had more sharp edges than the authoring path.** Four real
  export-cost realities surfaced only under a heavy comp — the `MAX_FRAMES=900`
  silent truncation, 1080p memory death, full-frame `mix-blend-mode` renderer
  crashes, and the `renderMediaOnWeb` hang-instead-of-fallback. All now documented
  in the `video-comp` skill + DDR-148 addendum; two env gaps fixed (CLI mp4/webm/gif
  formats, `MAUDE_NO_WATCH`). **Lesson for `/plan`: a "capture-spine export" feature
  should budget an explicit hardening pass for long/heavy comps, not assume the
  authoring green implies export green.**
- **`renderMediaOnWeb` hang→frame-step fallback is a tracked follow-up** (DDR-148) —
  the one genuine code bug left; everything else was env-tuning or authoring guidance.
- **Remotion's ceiling is high.** A pure-frame-driven VFX + motion-graphics stack
  (kinetic type, RGB split, slow-mo, VHS, glitch, light leaks, a self-drawing
  chalkboard play-diagram, an animated infographic, a 3D CTA) all rendered
  deterministically through the same capture spine — no new deps. Worth a showcase
  canvas in the DS someday.
