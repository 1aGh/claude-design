# Feature: Video tracking & stabilization — a solve you can trust, as data

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Give Maude a **geometric solve** over real footage — per-frame camera/plane motion — emitted as a versioned, parameters-only sidecar that a Remotion comp consumes as a pure function of `useCurrentFrame()`. v1 ships **stabilization**; the same contract carries planar corner-pin (screen replacement) at v1.5 with no schema migration.

The motivating shot — a hand holding an iPhone, its screen replaced with different content, occluded by the fingers — is the **north star, not a v1 gate**. Three independent research passes agreed on why: the warp is a day's work, the track is bounded classical work, and **the finger occlusion is the one step nothing on the market solves**. Hosted services sell masks (`fal-ai/sam-3/video-rle`, per-frame RLE + `track_id`, ~$0.09/10 s) but **nobody sells tracking at any price**; the professional answer (Mocha planar track → corner pin → separately roto'd occlusion matte) is GUI-first and seat-locked. Shipping the solve is therefore both the hard part and the differentiating part: no CLI, SDK, or MCP anywhere gives a coding agent tracking, roto, or compositing.

## User Story

As a **Maude user cutting real footage into a comp**, I want **a trustworthy per-frame geometric solve emitted as data I can inspect, version, and re-consume**, so that **handheld wobble is corrected deterministically, and — when the solve is bad — the tool tells me so with a remedy instead of handing me a composite that swims.**

## Problem

`/design:reel` and the video-comp canvas can cut, transition, grade and title real footage, but they have **no geometric relationship to what's inside the frame**. Every effect is frame-locked to the composition, never to a moving object or a moving camera. Concretely:

- **Handheld wobble is unfixable in-comp.** The most common defect in real footage has no answer in the current pipeline.
- **`video-comp/SKILL.md:393` already documents the workaround as prose** — a per-frame person mask via macOS Vision, clean-plate reconstruction from neighbouring frames (`cv2.phaseCorrelate` + `nanmedian` + `cv2.inpaint`), composite at `A ≈ 0.45`. It has sat there **un-productized**, needs Python, and runs nowhere the app can reach.
- **There is no vocabulary for "I tried and it didn't work."** A failed track does not throw — it drifts. Today the only way to discover it is a full export (858 frames took 15 min; see `feature-fast-video-export.md`), and the result gives the user nothing to attribute the failure to.

## Solution

**Contract-first.** Freeze a rich, versioned sidecar and the refusal path *before* any warp code, then implement the minimal producer behind it.

1. **`assets/<sha8>.track.json`** — per-frame `H[9]` (always), presentation timestamp `t`, `inliers`/`rmse`/`ok`, a `source` decode-provenance block, and a `solve` identity block. Parameters only, never pixels — the `.footage.json` / `.photo.json` precedent.
2. **opencv.js (`@techstark/opencv-js`, Apache-2.0) in the headless Chromium** that `_ensure-browser.mjs` already provisions identically on all 7 targets. One 13.3 MB WASM artifact, arch- and libc-agnostic. No native binaries (DDR-148), no Tauri command, no signing surface.
3. **Refusal as a first-class outcome**, riding the existing `ExportDegradation` / `remedyFor` vocabulary in `apps/studio/exporters/degraded.ts`.
4. **v1 fits similarity only**, consumed by one `<StabilizedVideo>` emitting CSS `matrix3d`. Homography + corner-pin is v1.5, purely additive against an unchanged schema.

### Why not the alternatives (all three were argued and rejected)

| Rejected | Why |
| --- | --- |
| **Apple Vision as the spine** (`objc2-vision` — `VNTrackRectangleRequest`, `VNTrackHomographicImageRegistrationRequest`) | Free, on-device, zero bytes shipped — and **macOS-only, on a project shipping 7 targets**. Plugin markdown has **no capability-gating vocabulary**, so a Windows agent reading the skill would simply try; and `feature-goal-unattended-pipelines.md` targets a Linux fleet that could never run it. Also: the research passes **contradict each other** on whether `VNTrackRectangleRequest` still returns four corners or regressed to a bounding box at iOS 15, and Apple's modern Vision API is Swift-only (unreachable from objc2). **Reopen only if the spike shows opencv.js cannot ship anywhere.** |
| **Native OpenCV** (Rust `opencv` crate, `@u4/opencv4nodejs`) | Does not bundle OpenCV. The two **musl** legs mean four Linux builds alone (glibc/musl × x64/arm64) before macOS×2 and Windows. Fails DDR-177 in practice and reopens DDR-148. |
| **Hosted tracking** | Does not exist. Segmentation is a commodity; tracking is not sold. |
| **`ffmpeg vidstab`** | Best classical stabilizer, but `--enable-libvidstab` forces `--enable-gpl`, so **bundling it means distributing a GPL binary** into a notarized auto-updating `.app` (source-offer + anti-tivoization). Stock Homebrew ffmpeg can't even do it — it's keg-only `ffmpeg-full` now. Keep as an opt-in tier via the existing shell-out-to-user-install pattern; **never bundle**. |
| **Tauri webview instead of headless Chromium** | Saves a download the user already paid (`_ensure-browser.mjs` is a precondition of `screenshot.sh`, the most-invoked verb in the plugin). Costs a **second execution environment** and forks video *decode* — WKWebView/WebKitGTK/WebView2 seek differently, and a track computed against different pixels than the capture is a silent frame-offset bug. |

## Metadata

- **Ticket**: (none — internal roadmap item; `integrations.tracker.provider: github`, no issue filed)
- **Type**: New Capability
- **Complexity**: High (new compute surface, new versioned datatype, new refusal vocabulary) — but scope-bounded by design
- **App/Package**: `apps/studio` (helper, schema, store, canvas-lib component), `cli` (gitignore prerequisite), `plugins/design` (verb docs, skill)
- **Affected Systems**: helper-verb surface (DDR-062), browser provisioning (`_ensure-browser.mjs`), runtime-state taxonomy (DDR-115), export degradation channel, canvas-lib, npm tarball size
- **Dependencies (new)**: `@techstark/opencv-js` (Apache-2.0, 13.3 MB single file, 5.0.0-release.1 / 2026-06-24) — bundled, staged via `helper-deps.mjs`
- **DDR**: one warranted for the track-artifact contract + the refusal model. Record at execute.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message — independent context loads.

- `apps/studio/footage/schema.ts` (whole file) — Why: the **exact house style** to mirror. Dependency-free, hand-rolled structural validator (no Ajv), explicit version const, and the seconds-vs-frames time-model note that this feature must extend to presentation timestamps.
- `apps/studio/photo/schema.ts` (lines 1–35) — Why: the second instance of the same pattern; confirms "parameters only, never pixels" and the versioned-sidecar-beside-the-asset placement.
- `apps/studio/exporters/degraded.ts` (whole file, ~90 lines) — Why: **the refusal path is this file's pattern applied to a new failure class.** `ExportDegradation`, `remedyFor()`, and the load-bearing doctrine at :48 — *"If audio was asked for and the bytes don't have it, the result is degraded — full stop, no matter what the renderer reported"* — with `hasAudioStream` deliberately conservative so it "can never invent a degradation it cannot prove."
- `apps/studio/exporters/jobs.ts` (~:345) — Why: documents that **`done` + `degraded` is a real, deliberate combination — the file exists.** That is precisely a tracker refusal: the sidecar is produced *and* flagged untrustworthy.
- `apps/studio/bin/_probe-footage-playwright.mjs` (whole file) — Why: **the shape to copy.** Decode-in-Chromium via plain HTML5 `<video>` + seek, `file://` navigation, JSON manifest on stdout, documented exit-code table, and the DDR-148 rationale for why a browser and not ffmpeg.
- `apps/studio/bin/_smart-frames.mjs` (lines 120–160) — Why: the **degrade-ladder pattern** (`hasCommand` probes → tier resolution → explicit error when a named tier is unavailable). The stabilization tier ladder mirrors this.
- `apps/studio/bin/screenshot.sh` — Why: **the correct engine-resolution precedent** (bundled agent-browser primary). Do **NOT** copy `probe-footage.sh:20`, which prefers `node`+`playwright` before `bun` — a DDR-177 hazard in the packaged `.app`.
- `cli/lib/gitignore-block.mjs` (lines 55–70) — Why: the `s3Assets` prerequisite. Verified: the branch emits `${root}/assets/` wholesale, and its own comment scopes the intent to **binary media** ("a 60 MB clip is 60 MB in every clone forever").
- `apps/studio/git/service.ts` (~:248) — Why: `isMaudeRuntimeState`, one of DDR-115's three lists. Verified: keys on a **leading underscore**; `assets/` matches none of it.
- `apps/studio/video-comp.tsx` (lines 1–60) — Why: the determinism iron law and the `window.__maude_seek__` bridge the consumer must not violate.
- `apps/studio/bin/draw-proof.sh` — Why: the **proof-artifact pattern** for `track-proof` (throwaway canvas under an ignored `_*` dir, screenshot the ladder, print the dir, zero interaction).
- `plugins/design/skills/video-comp/SKILL.md` (lines 352–420) — Why: the existing VFX section this feature productizes, and the prose recipe to update once a real verb exists.

### Files to Create

- `apps/studio/track/schema.ts` — the `Track` datatype + hand-rolled validator (mirrors `footage/schema.ts`)
- `apps/studio/track/schema.test.ts` — validator + golden-numeric fixture tests
- `apps/studio/track/store.ts` — read/write the sidecar (mirrors `footage-store.ts`)
- `apps/studio/bin/track-footage.sh` + `apps/studio/bin/_track-playwright.mjs` — the solve helper, own browser context
- `apps/studio/bin/track-proof.sh` — overlay proof frames under `_track/`
- `apps/studio/track/mats.ts` — the `withMats(fn)` arena
- `apps/studio/test/track-mats-shape.test.ts` — source-shape gate on arena usage
- `apps/studio/test/track-determinism.test.ts` — seeded byte-identical re-run
- `.ai/archive/decisions/DDR-2NN-track-artifact-contract-and-refusal-model.md`

### Design canvases

None matched — this feature has no UI surface by design (see Cut list).

### Documentation

- [`@techstark/opencv-js`](https://www.npmjs.com/package/@techstark/opencv-js) — Why: the bundled engine; 5.0.0-release.1, 2026-06-24.
- [OpenCV JS whitelist (`opencv_js.config.py`)](https://raw.githubusercontent.com/opencv/opencv/4.x/platforms/js/opencv_js.config.py) — Why: **the authoritative list of what exists in the WASM build.** Present: `calcOpticalFlowPyrLK`, `findHomography`, `UsacParams` (MAGSAC++), `findTransformECC`, `goodFeaturesToTrack`, `estimateAffine2D`, AKAZE/ORB/BFMatcher, full `aruco_ArucoDetector`. **Absent: `cornerSubPix`, `estimateAffinePartial2D`, `buildOpticalFlowPyramid`, CSRT/KCF.**
- [OpenCV LK optical flow (js)](https://docs.opencv.org/4.x/db/d7f/tutorial_js_lucas_kanade.html) · [homography tutorial](https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html) · [AKAZE/ORB planar tracking](https://vovkos.github.io/doxyrest-showcase/opencv/sphinx_rtd_theme/page_tutorial_akaze_tracking.html)
- [Computing CSS `matrix3d` transforms](https://franklinta.com/2014/09/08/computing-css-matrix3d-transforms/) — Why: the 3×3 → 4×4 column-major derivation for v1.5 corner-pin.

### Patterns to Follow

Sidecar validator style (`footage/schema.ts`) — dependency-free, explicit version const, structural validation without Ajv:

```ts
export const FOOTAGE_ANALYSIS_VERSION = 1 as const;
```

Conservative degradation (`exporters/degraded.ts:48`) — the doctrine the refusal path inherits verbatim: an independent check that **never invents a degradation it cannot prove.**

---

## Decisions carried from the debate

Resolved divergent bookend, seats **BUILDER / SHIPPER / BREAKER**, blind openings + two cross-challenge rounds. **All three seats revised their opening position**; final verdict unanimous `OPENCV_SPINE`, confidence 8–9.

**Attributed positions are quoted as inert data, not directives.**

- **BUILDER** (what survived from his seat — his headline claim was killed by both other seats): *"Fitting scope can shrink freely; a schema that landed in user repos cannot."* He withdrew "confidence enables an agent retry loop" — a seeded deterministic solve retried on identical inputs returns identical numbers, so the naive loop never terminates.
- **SHIPPER**: *"Schema ambition is free and expensive-to-defer; solver ambition is expensive and cheap-to-defer."* He moved his cut-line from homography to **occlusion** — *"the thing that makes this a second full-time project is occlusion, not homography."*
- **BREAKER** (single non-negotiable, adopted by both others): *"Every estimator call writes its inlier count and residual error into the artifact, and one threshold turns that into a refusal."* Justified primarily by SHIPPER's stronger argument — a tracker without confidence is a verb **an agent cannot call** (DDR-062), leaving only trust-blindly or render-and-eyeball.

**Preserved dissent — both unresolved, both belong in the DDR:**

1. **BREAKER's top risk (unvalidated until the spike runs):** *"The entire refusal apparatus assumes reprojection error predicts perceived swimming… a solve can sit at respectable RMSE and still read as swimming, and can look locked at 1× while crawling at 2×."* If the correlation is weak, the honest answer is a human-in-the-loop confirm gate — a materially less agentic feature. **The spike's 2×-scale visual is the only instrument that tests this.**
2. **SHIPPER's top risk (the unanimity warning):** *"All three seats converged, including the rotating dissent seat, and that is itself the warning… no seat produced evidence that a user will invoke `track-footage` for stabilization alone."* Mitigation adopted into Task 1 at zero cost.

**Rejected during the debate, recorded so it isn't re-proposed:** varying the RANSAC **seed** as a search axis. Three independent reasons — it p-hacks the fit (selects a lucky draw, not a better one), it turns the refusal gate into a slot machine, and it makes the byte-identical re-run test unwritable. **Seed pinned and recorded; never searched.**

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 0 (PREREQUISITE): FIX the `s3Assets` sidecar-versioning bug

Independent of this feature — it is a **live bug today**.

- **Do**: In `cli/lib/gitignore-block.mjs`, the `s3Assets` branch emits `${root}/assets/` wholesale, sweeping in every parameters-only JSON sidecar. Its own comment scopes the intent to binary media. Add a negation re-including JSON: `!${root}/assets/*.json`.
- **Gotcha (load-bearing)**: the negation MUST come **after** the directory line — **gitignore is last-match-wins**. Emitted before, it is a silent no-op that reads as correct in review. This is the same footgun CLAUDE.md already documents for the `.kgai/` store.
- **Gotcha**: confirm against the `.footage.json` / `.photo.json` **write paths** before editing — verify they land under `assets/` as assumed.
- **Impact**: retroactively un-breaks `.footage.json` and `.photo.json`, which are silently de-versioned on any bucket-configured machine today. Fixing once covers three features.
- **Validate**: unit-test `buildBlock({ s3Assets: true })` — assert the negation line exists and its index is greater than the `assets/` line's; assert `.footage.json` is not ignored.

### Task 1: SPIKE — is the solve good enough, and would you ship the cut?

Time-boxed to ~1.5 days. **Everything downstream is gated on this.** Throwaway code; nothing here ships.

- **Do**: load opencv.js in headless Chromium; decode a real clip via `<video>` + seek; `goodFeaturesToTrack` → `calcOpticalFlowPyrLK` with a forward-backward check (discard round-trip error > ~0.5 px) → `estimateAffine2D` with `UsacParams`/MAGSAC → smooth the trajectory → warp.
- **Fixture (non-negotiable)**: a **VFR hand-held iPhone `.mov`** — and specifically **footage Michal actually shot intending to use**. A CFR test clip validates the easy case and leaves the decode/frame-indexing risk untested.
- **Deliverables — all five**:
  1. A reprojection-error curve across the clip.
  2. **A defended numeric threshold**, separated against a second clip that *should* fail. A cutoff chosen afterward by judgment either never fires (decorative) or always fires (unusable).
  3. The warped result **inspected at the export's default 2× scale** — this is the instrument for BREAKER's top risk; a solve can look locked at 1× and crawl at 2×.
  4. The **858-frame WASM-heap curve** (does the heap plateau or climb?).
  5. **"Would you ship this cut?"** — a yes/no on the stabilized output, which is SHIPPER's demand test at zero marginal cost since the spike already produces the artifact.
- **Gotcha**: `cv` sometimes resolves as a Promise (`_malloc on the Promise object` is the classic symptom) — await init explicitly.
- **Decision gate**: bad curve **and** bad 2× visual ⇒ stop; reopen Apple Vision as a macOS-only path (BREAKER's named trigger) or abandon. Good curve, weak error↔swimming correlation ⇒ the refusal path becomes human-in-the-loop; say so before building it.

### Task 2: CREATE the track contract (`apps/studio/track/schema.ts`)

- **Do**: mirror `footage/schema.ts` exactly — dependency-free, hand-rolled structural validator, no Ajv, explicit `TRACK_VERSION = 1 as const`.

```ts
interface TrackFrame {
  t: number;        // presentation timestamp (seconds) — the resolution key
  H: number[];      // ALWAYS 9 numbers, row-major
  inliers: number;  // 0..1
  rmse: number;     // px
  ok: boolean;      // threshold verdict for this frame
}
interface Track {
  version: 1;
  model: 'similarity' | 'affine' | 'homography';  // which constraint was FITTED
  reference: number;
  frames: TrackFrame[];
  source: { videoSha8, decoder, browserVersion, seekMode,
            indexedBy: 'pts' | 'frame', fps, frameCount };
  solve:  { roi, reference, engine, engineVersion, seed };
}
```

- **`H[9]` always, no `m` field.** An affine 2×3 **is** a homography with bottom row `[0,0,1]`, so a similarity solve fills all nine at zero cost. Storing six buys nothing and bakes in a **migration over committed user data**.
- **`t` is the resolution key, not the array index.** On genuinely VFR iPhone `.mov`, index→time is not affine, so tracking and capture contexts can disagree about which frame index 412 is *even with matching provenance*. The consumer resolves by time.
- **`solve` identity is required**: `<sha8>` content-addresses the **clip**, so two solves under different ROIs would collide on one path.
- **DDR-115 disposition — verified, decided**: `assets/<sha8>.track.json` is **VERSIONED**, and needs **zero edits** to the three lists. All three key on a **leading underscore** and `assets/` matches none. Content-addressing also makes clip-axis staleness structurally impossible — the path *is* the hash. Note the near-miss: `_track/` (proof output) **is** ignored runtime state. The underscore does all the work, so a future `_track.json` would silently land on the wrong side.
- **Validate**: `bun test apps/studio/track/schema.test.ts` — round-trip, rejection of malformed input, version marker present.

### Task 3: CREATE the refusal path (before any warp code)

- **Do**: extend `exporters/degraded.ts`'s vocabulary with track reasons; thresholded per-frame reprojection/FB error → `ok` per frame → an aggregate `ExportDegradation` with a `remedyFor()` string.
- **Pattern**: `hasAudioStream`'s doctrine verbatim — an **independent** check that never invents a degradation it cannot prove. `done` + `degraded` is the established combination (`jobs.ts:345`): the sidecar exists *and* is flagged.
- **An ABSENT or unverifiable sidecar is a first-class refusal**, not an edge case — until Task 0 lands everywhere, the artifact is inconsistently present across a team.
- **The consumer ASSERTS `source` provenance before warping** and refuses on mismatch, rather than warping wrong.
- Target message shape: *"track lost at frame 214 (reprojection error 8.3 px > 2.0 px); the bezel leaves frame at 0:07. Re-shoot with less motion blur, or narrow --roi."*
- **Validate**: unit tests — good track passes; a synthetically-drifting track refuses with a remedy; a provenance mismatch refuses; an absent sidecar refuses.

### Task 4: CREATE the `withMats` arena (`apps/studio/track/mats.ts`)

- **Do**: a scoped helper that collects and `.delete()`s every `cv.Mat` allocated within it. Make leaks **structurally impossible** rather than caught in review.
- **Gotcha**: the WASM heap is a fixed-size ArrayBuffer that **does not shrink back once it peaks** — which is why the tracker gets its own process (Task 5), not just tidy code.
- **Validate**: `apps/studio/test/track-mats-shape.test.ts` — a source-shape test asserting every `cv.Mat` allocation goes through the arena, in the established house style of `capture-determinism-shape.test.ts`. Prevention in CI; measurement stays in the spike.

### Task 5: CREATE the solve helper (`_track-playwright.mjs` + `track-footage.sh`)

- **Do**: mirror `_probe-footage-playwright.mjs` — own browser context, run ahead of and independent of export, write the sidecar, exit. Flags: `--roi`, `--reference`, `--model similarity`, `--out`.
- **Own browser context is load-bearing**: the tracker's heap must never share a page with export capture, or an OOM takes the capture page down mid-export and is misreported as a capture failure. Separate context ⇒ separate decode ⇒ **provenance is mandatory, not optional**.
- **Engine resolution follows `screenshot.sh`** (bundled agent-browser primary), **NOT** `probe-footage.sh:20` (prefers `node`+`playwright` — a DDR-177 hazard in the packaged `.app`).
- **Actuators, bounded**: `--roi` and `--reference` are the only search axes. `maxAttempts = 3` with a monotonic-improvement stop, **enforced in the verb, not left to agent discretion**. Seed pinned and recorded, **never searched**.
- **Reached via `maude design track-footage`** (DDR-062) — add to `cli/commands/design.mjs`; never a raw bin path.
- **Validate**: `maude design track-footage <fixture>` produces a schema-valid sidecar; `apps/studio/test/track-determinism.test.ts` asserts a **seeded byte-identical re-run**; a **golden numeric** comparison of `frames[]` against a committed fixture within epsilon. **Not golden pixels** — cross-platform rasterization across 7 targets, two libcs and a WASM build is a flake generator with a rebaseline ritual nobody trusts.

### Task 6: CREATE `<StabilizedVideo>` in canvas-lib

- **Do**: read the sidecar, resolve by `t`, emit a CSS `matrix3d` on the video element inside an overscan container. One `toMatrix3d(frame, model)` helper.
- **Iron law holds trivially** — a pure lookup keyed on `useCurrentFrame()`. **The compositor gains zero new dependencies.**
- **Validate**: mount in a video-comp canvas; `maude design screenshot`; confirm two runs to frame N are pixel-identical.

### Task 7: CREATE `maude design track-proof`

- **Do**: render the tracked quad/trajectory as an overlay on source frames, on the `draw-proof.sh` pattern — throwaway output under `_track/` (ignored runtime state), screenshot, print the dir. **Non-interactive.**
- **Why**: stabilization has no visual tell of its own, and this is what makes `--roi` usable rather than a guessing game — it distinguishes "the ROI was wrong" from "this clip is untrackable". A bad solve costs a glance instead of a 15-minute export.
- **Validate**: run on the fixture; assert frames land and the dir prints.

### Task 8: UPDATE docs + bundle gates

- **Do**: `plugins/design/dependencies.json` (opencv.js); `plugins/design/skills/video-comp/SKILL.md:393` (replace the Python prose recipe with the real verb, keep the honest occlusion caveat); a new `/design:track` command doc; `whats-new-entry` skill for the feed.
- **Budget the ~13.3 MB tarball growth deliberately** — this repo has a `tarball` quality gate. Have that conversation in the plan, not at release.
- **Validate**: `bash scripts/check-tarball-shape.sh`; `node apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke`.

---

## Cut from v1 — explicitly, and these are hard lines

- **Occlusion, rotoscoping, SAM-3 masks.** Not deferred-with-a-hook; **absent** — any hook designed now is the wrong hook. This is where the second full-time project lives, and it is the one step no researched path solves.
- **The homography *fitter*.** Ships at v1.5 **iff** the spike's curve holds. The *schema* carries it from day one, so the increment is additive with no migration.
- **All interactive UI** — no panel, no scrubber, no corner-drag widget. The moment this grows manual keyframing it stops being an agent feature. (`track-proof` is a proof artifact, not UI.)
- **AKAZE re-acquire, ECC polish, ArUco** — each added only when a real clip demonstrably fails without it.
- **The specular phone-with-fingers shot as an acceptance criterion.** North star in this section; not a gate.
- **Apple Vision.** Rejected as a spine; reopens only on the Task 1 trigger.

> **Implementation guard (BUILDER's caveat, and it binds implementation not planning):** the rich contract is cheap **only because** the producer stays minimal. **v1 fits ONE model.** A second fitter is a v1.5 decision with its own gate — not an "while we're in here" implementation detail. If scope creeps, the schema concession stops being free and the whole bargain needs re-examining rather than quietly absorbing.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server`
3. **Build**: `pnpm --filter @maude/site build`
4. **Tarball**: `bash scripts/check-tarball-shape.sh`
5. **Bundle completeness**: `node apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke`
6. **Determinism**: seeded byte-identical re-run + golden numeric `frames[]` within epsilon
7. **Arena**: source-shape test — every `cv.Mat` goes through `withMats`
8. **Manual**: run `track-footage` + `track-proof` on the real fixture; confirm the refusal fires on the should-fail clip

> **`git status apps/studio/dist/` before AND after any `bun test` in this tree** — test runs have been observed clobbering `dist/` with unminified dev bundles.

---

## Acceptance Criteria

- [ ] Task 0 prerequisite landed and unit-tested (negation **after** the directory line)
- [ ] Spike ran on real VFR iPhone footage; curve, defended threshold, 2× visual, heap curve, and the "would you ship this cut?" answer all recorded
- [ ] `assets/<sha8>.track.json` schema-validated, versioned, `H[9]`-always, `t`-keyed
- [ ] Refusal path fires on a bad track, a provenance mismatch, **and** an absent sidecar — each with a remedy
- [ ] `maxAttempts` enforced in the verb; seed pinned and recorded, never searched
- [ ] Seeded byte-identical re-run + golden numeric comparison green
- [ ] Tarball + bundle-completeness gates green
- [ ] DDR recorded for the artifact contract + refusal model, **with both preserved dissents**
- [ ] `video-comp/SKILL.md:393` prose recipe replaced with the real verb, occlusion caveat kept honest
