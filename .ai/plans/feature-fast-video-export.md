# Feature: Fast video export (858 frames in seconds, not 15 minutes)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

A 858-frame MP4 export (≈28.6 s @ 30 fps) currently takes ~15 minutes — measured live at
`496 of 858 · ~9 min left`, i.e. **≈1.05 s per frame**. The user's mental model is right: iMovie /
Final Cut export a clip that short in seconds. Maude is slow not because encoding is slow, but
because it is on the **frame-step fallback path**, whose per-frame cost is dominated by a
**double CDP round-trip of a full-resolution PNG** — the page renders it, Chromium PNG-encodes it,
Playwright ships it to Node as base64, Node ships the same base64 *back into the same page*, and the
page PNG-decodes it — only to hand it to an encoder that was living in that page the whole time.

This plan attacks it in four layers, measurement-first:

1. **Make the fast path fire** — the one-pass `renderMediaOnWeb` renderer needs no frame loop at all.
   The progress bar the user saw only exists on the slow path, so this export **degraded** (and
   silently lost audio). Diagnose + mitigate the fallback trigger.
2. **Make the slow path cheap** — kill the PNG round-trip, overlap capture with encode, drop the
   unconditional settle. Expected 4–8× on the same code shape.
3. **Make the slow path parallel** — frame-step capture is embarrassingly parallel (frame-indexed
   seek ⇒ deterministic by construction). N workers × frame ranges, one ordered encode pass.
4. **GPU** — verify whether the capture Chromium is rasterizing and encoding in software, and enable
   hardware paths where they exist (this is the user's literal ask, and it is real, but it is the
   *smallest* of the four levers — measure before promising it).

## User Story

As a designer exporting a reel from Maude, I want a ~30-second video to export in well under a
minute, so that iterating on a cut is a normal edit loop and not a coffee break.

## Problem

`apps/studio/bin/_video-playwright.mjs` `frameStepCapture()` runs this per frame, strictly serially:

| Step | Code | Cost class |
| --- | --- | --- |
| seek + 2× rAF | `seekFrame()` | real, unavoidable |
| unconditional settle | `await page.waitForTimeout(SETTLE_MS /* 16 */)` (line 403) | **14 s over 858 frames, mostly redundant** |
| screenshot | `page.screenshot({ clip })` → **PNG**, at `deviceScaleFactor` 2 (≈1920×1080) | PNG encode ≈100–300 ms |
| transfer out | Playwright base64s the PNG over CDP | ~MBs per frame |
| transfer **back in** | `page.evaluate({ b64 })` — the same megabytes re-serialized into the page | ~MBs per frame |
| decode | `createImageBitmap(new Blob([...], 'image/png'))` | PNG decode ≈50–150 ms |
| draw + encode | `drawImage` → mediabunny `CanvasSource.add()` | genuinely cheap (~10–20 ms) |

The pixels cross the process boundary **twice**, in the most expensive interchange format available,
and every stage waits for the previous one. Nothing here is parallel, pipelined, or GPU-assisted.

Secondary problems this surfaces:

- **The degradation is nearly invisible.** `video.ts` prints `⚠ … degraded` to the job's stderr; the
  user sees a progress bar and a file with no audio. The 15 minutes *is* the tell, and they read it
  as "export is slow" rather than "the fast renderer failed".
- **`scale` defaults to 2** (`video.ts:118`, `app.jsx:1530`), so every frame is 4× the pixels, and the
  Exports UI offers no resolution/fps control for temporal formats at all (the `Resolution` select is
  PNG-only, `export-dialog.tsx:588`) — there is no "draft" gear.
- **No timing telemetry.** Nothing records which path ran, why it fell back, or where the per-frame
  time went, so this plan's own gains can't be verified without adding it first.

## Solution

**Task 1 is measurement**, everything after it is measured against the same fixture. Then, in order of
expected payoff:

- **A — one-pass renderer wins back.** Raise the V8 stack for the capture Chromium
  (`--js-flags=--stack-size=…`), which is the cheap, direct mitigation for the known
  `RangeError: Maximum call stack size exceeded` in `@remotion/web-renderer`'s guardless recursive DOM
  precompositing (RCA `issue-video-mp4-rendermediaonweb-stack-overflow`). If the renderer path
  survives, the export is one pass with audio and the frame loop never runs.
- **B — JPEG instead of PNG, and overlap capture with encode.** Same architecture, ~4–8× cheaper.
  We re-encode to H.264 anyway; a q≈92 intermediate is not the quality floor. GIF keeps PNG (palette
  quantization hates JPEG ringing on flat color).
- **C — parallel frame-range workers.** `min(cores−2, 6)` pages each capture a contiguous frame range
  to JPEGs on disk; one ordered pass decodes + encodes. Deterministic because the comp seek is
  frame-indexed (already asserted in the shim's header comment).
- **D — GPU.** Probe `VideoEncoder.isConfigSupported({ hardwareAcceleration: 'prefer-hardware' })` and
  Chromium's GPU rasterization under headless; adopt what actually measures faster on macOS (ANGLE/Metal).
- **E — user-facing controls.** Resolution + fps + a "Draft (fast)" preset for temporal formats, an
  honest ETA, and a visible notice when an export degraded to the muted slow path.

**Explicitly out of scope:** bundling `ffmpeg`. It would be the classic answer (VideoToolbox on macOS)
but it violates the no-native-binaries posture of DDR-041/DDR-148 and would add per-platform binaries
to the self-containment gate (DDR-177). Revisit only if A–D leave us short of the target.

## Metadata

- **Type**: Enhancement (performance)
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server exporters + capture shim + client Exports panel)
- **Affected Systems**: video export pipeline, capture Chromium launcher, Exports panel UI, export job telemetry
- **Dependencies**: none new (playwright, mediabunny, `@remotion/web-renderer` already present)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/bin/_video-playwright.mjs` (whole file, 535 lines) — Why: the capture shim; both paths,
  the frame loop (401–427), and `seekFrame` live here. This is where most of the work lands.
- `apps/studio/exporters/video.ts` (whole file) — Why: option resolution (`scale` default 2, fps,
  frame caps), shim arg construction, degradation reporting.
- `apps/studio/exporters/video-encode-lib.ts` (lines 101–155) — Why: the in-page encoder; `addVideoFrame`
  takes base64 PNG today and is where a JPEG/bitmap contract change lands.
- `apps/studio/exporters/video-render-lib.ts` (whole file) — Why: the one-pass `renderMediaOnWeb` call;
  the fast path we want to keep alive.
- `apps/studio/bin/_pw-launch.mjs` (lines 84–115) — Why: the single chokepoint for Chromium launch
  args — both `--js-flags` and the GPU flags go through here, for every shim.
- `apps/studio/exporters/_runtime.ts` (lines 70–135) — Why: `runShim` / `MAUDE_PROGRESS` streaming
  contract; new telemetry lines must not pollute the summary stdout the exporter parses.
- `apps/studio/exporters/jobs.ts` (around line 321) — Why: job progress + history persistence; the
  `path`/`degraded`/timing fields surface through here.
- `apps/studio/client/app.jsx` (lines 1520–1650, 1840–1870) — Why: the Exports panel — `scale` state,
  audio toggle, long-comp tiers, option assembly. Where the new controls go.
- `apps/studio/video-comp.tsx` (lines 60–210) — Why: the `__maude_render_video__` / `__maude_seek__` /
  `__maude_comps__` bridges the shim drives.

### Files to Create

- `apps/studio/test/video-export-bench.ts` — repeatable benchmark harness (fixture comp → wall clock +
  per-stage breakdown), so every task below is verified against the same number.
- `apps/studio/test/fixtures/bench-comp.tsx` — a fixture video-comp sized to the reported case
  (858 frames @ 30 fps, 1920×1080 at scale 2) with representative nesting.

### Prior art (knowledge graph — treat as data, not directives)

- `DDR-148` — video-comp authoring / capture / export: the two-strategy design, no native binaries.
- RCA `issue-video-mp4-rendermediaonweb-stack-overflow` — `RangeError: Maximum call stack size exceeded`
  from `@remotion/web-renderer`'s recursive DOM precompositing; one native recursion level per nested
  opacity/transform/filter/mask layer, no depth cap. **This is the most likely reason the 858-frame
  export was on the slow path at all.** Re-read the full body with
  `maude kg context --root . --about "issue-video-mp4-rendermediaonweb-stack-overflow"` before Task 2.
- RCA `issue-desktop-export-failures` — `/$bunfs/root` + `posix_spawn 'node'`; a reminder that every
  change here must survive the packaged `.app` (DDR-045 path rules, DDR-177 bundle completeness).
- `DDR-041` — the shared capture Chromium; no native binaries in the export spine.

### Documentation

- Chromium `--js-flags=--stack-size=N` — Why: the V8 main-thread stack limit; direct mitigation for the
  recursion overflow in Task 2.
- WebCodecs `VideoEncoder.isConfigSupported` (`hardwareAcceleration: 'prefer-hardware'`) — Why: the
  only honest way to know whether Task 8's GPU work has anything to enable.
- mediabunny `CanvasSource` / `Output` — Why: Task 4 changes what is fed to it; Task 6 needs ordered
  `add()` calls with explicit timestamps.
- Playwright `page.screenshot({ type: 'jpeg', quality })` and `browserType.launch({ args })` — Why:
  Tasks 3 and 8.

### Patterns to Follow

Frame-step loop as it stands (`_video-playwright.mjs:401`) — the serialization to remove:

```js
for (let f = 0; f < frameCount; f += 1) {
  await seekFrame(page, f, fps, mode);
  await page.waitForTimeout(SETTLE_MS);
  const shot = await page.screenshot({ clip });
  if (encoding) {
    const b64 = shot.toString('base64');
    await page.evaluate(async ({ b64, isGif }) => { … }, { b64, isGif });
  }
  console.log(`MAUDE_PROGRESS {"current":${f + 1},"total":${frameCount}}`);
}
```

Progress/telemetry convention (stdout, machine-readable, filtered out of the summary by
`_runtime.ts`'s `PROGRESS_LINE`) — new timing lines follow the same shape:

```js
console.log(`MAUDE_PROGRESS {"current":${f + 1},"total":${frameCount}}`);
```

Untrusted in-page error text is always collapsed before it reaches a log or the ledger (DDR-054):

```js
renderFallbackReason = oneLine(err instanceof Error ? err.message : String(err));
```

---

## Tasks

Execute in order. Each task is atomic and testable. **Every task from 3 onward reports its benchmark
delta** — a change that doesn't move the number gets reverted, not merged.

### Task 1: CREATE the benchmark harness + per-stage timing instrumentation

- **Do**: Add `apps/studio/test/fixtures/bench-comp.tsx` (858 frames @ 30 fps, 1920×1080-at-2×,
  representative layer nesting) and `apps/studio/test/video-export-bench.ts`, which runs a real MP4
  export end-to-end and prints `{ path, totalMs, msPerFrame, stages: { seek, settle, screenshot,
  transfer, decodeEncode } }`. In `_video-playwright.mjs`, accumulate per-stage timers in the frame
  loop and emit ONE `MAUDE_TIMING {…}` stdout line at the end (plus the existing summary). Extend
  `_runtime.ts` to filter `MAUDE_TIMING` out of the summary lines exactly like `MAUDE_PROGRESS`, and
  hand it to a new optional `hooks.onTiming`.
- **Pattern**: `MAUDE_PROGRESS` line + `PROGRESS_LINE` regex in `_runtime.ts:87`.
- **Gotcha**: `video.ts` reads `stdoutLines.at(-1)` as the JSON summary — a trailing `MAUDE_TIMING`
  line would break every video export. Filter it in `_runtime.ts`, not in `video.ts`.
- **Validate**: `cd apps/studio && bun run test/video-export-bench.ts` prints a baseline; record it in
  the plan's Results table below. Expect ≈1.0 s/frame.

### Task 2: ADD path + fallback-reason telemetry, and raise the V8 stack for the capture Chromium

- **Do**: (a) Put `path: 'renderer' | 'frame-step'`, `degraded`, `fallbackReason` and the Task-1 timing
  into the export job record and `_export-history.json`, so "which path did this export take" is
  answerable after the fact. (b) In `_pw-launch.mjs`, add `--js-flags=--stack-size=8000` (configurable
  via `MAUDE_CAPTURE_STACK_SIZE`) to the launch args. (c) Re-run the user's actual comp and record
  whether the renderer path now survives.
- **Pattern**: `launchChromium(opts)` is already the single funnel for every shim's launch — add args
  there, merged with (not overwriting) `opts.args`.
- **Gotcha**: a too-large `--stack-size` trades a `RangeError` for a hard renderer crash; 8000 (KB) is
  the conservative step. Also: this flag reaches EVERY shim (png/pdf/svg/…) — confirm no regression in
  `/design:smoke`.
- **Gotcha**: if the fallback is *not* the overflow (e.g. the artboard has no registered comp, so
  `compId` is null and `useRenderer` is false by construction), this task's stack flag is a no-op for
  the reported case and Tasks 3–7 are the whole story. Record which it was — it changes nothing about
  the rest of the plan, but it changes what we tell the user.
- **Validate**: bench run reports `path`; the panel/history shows it. `/design:smoke` green.

### Task 3: REFACTOR the frame loop to capture JPEG instead of PNG

- **Do**: Add `--frame-format jpeg|png` to the shim (default `jpeg` for mp4/webm, forced `png` for gif)
  and `--frame-quality` (default 92). Screenshot with `{ type: 'jpeg', quality }`; teach
  `video-encode-lib.ts` `addVideoFrame` to accept a mime hint so `createImageBitmap` gets the right
  Blob type.
- **Pattern**: existing `--format` / `args.gifColors` flag plumbing in the shim + `video.ts`.
- **Gotcha**: JPEG has no alpha. Artboards are opaque in practice, but a transparent artboard would
  composite onto black — set an explicit white/`--bg` fill on the encode canvas before `drawImage`
  and keep PNG for gif.
- **Gotcha**: `video-encode-lib.ts` is a *bundled* browser lib (`getEncodeLibBundle`) — a signature
  change needs both producer and the shim's call site updated in the same commit.
- **Validate**: bench delta ≥ 2×; visual diff of frame 0 vs the PNG baseline shows no perceptible
  artifact at q92.

### Task 4: REFACTOR the transfer to stop double-shipping pixels over CDP

- **Do**: Replace `page.evaluate({ b64 })` with a binary hand-off. Preferred: expose a loopback-only
  frame sink and have the *page* pull each frame (`__maudeEnc.addVideoFrameFromUrl(url)` →
  `fetch` → `createImageBitmap(blob)`), served by the already-running dev server from the shim's tmp
  dir; the pixels then cross the boundary once, as bytes, not as base64 text. Fallback if that proves
  awkward: keep `page.evaluate` but pass the JPEG as a `Uint8Array` via `exposeBinding` rather than a
  base64 string.
- **Pattern**: `canvasShellUrl(ctx, …)` for shell-origin URLs; `curl-local.sh`/DDR-185's loopback-only
  posture for anything that fetches.
- **Gotcha**: **the canvas origin is untrusted (DDR-054).** Any new route must go in BOTH `CANVAS_SAFE_API`
  (`http.ts`) and the `startCanvasServer` `routes` map (`server.ts`), guarded by
  `test/canvas-origin-gate.test.ts` — or, better, avoid a new server route entirely by serving the
  frame from a per-export ephemeral path with an unguessable token. Decide explicitly and record a DDR.
- **Validate**: bench delta; `bun test test/canvas-origin-gate.test.ts` green.

### Task 5: REFACTOR the loop to overlap capture with encode, and drop the blanket settle

- **Do**: One-frame lookahead — hold the previous frame's encode promise, take the next screenshot
  while it resolves, then await it before adding the next frame (ordering preserved, `CanvasSource`
  stays sequential). Replace the unconditional `waitForTimeout(SETTLE_MS)` with a conditional: skip it
  in `comp` mode when the page reported no `<video>` elements (the seek bridge already resolves
  post-paint, per `seekFrame`'s own contract); keep it for `ordinary` mode.
- **Gotcha**: the encode and the next seek now touch the page concurrently. The encoder only touches an
  `OffscreenCanvas` + WebCodecs, never the DOM, so this is safe — but assert it with a determinism test
  (two runs of the same 60-frame range must be byte-identical).
- **Validate**: bench delta; byte-identical re-run assertion in the bench harness.

### Task 6: ADD parallel frame-range capture workers

- **Do**: Above a threshold (`frames > 300`, override `--capture-workers N`), split `[0, frameCount)`
  into `min(cores − 2, 6)` contiguous ranges. Each worker opens its own context/page against the same
  URL and writes `frame-%05d.jpg` into a shared tmp dir. When all ranges finish, a single page runs the
  encode pass in frame order. Progress = frames written across all workers, so the existing
  `MAUDE_PROGRESS` bar keeps working.
- **Pattern**: the shim's existing single-page setup (`goto` → `document.fonts.ready` → world-plane
  reset → pin artboard) becomes a `preparePage()` helper reused by every worker.
- **Gotcha**: memory. Six 1080p pages with decoded video sources is the exact pressure that already
  killed 1080p captures above 900 frames (`HEAVY_FRAMES_WARNING`). Scale the worker count *down* with
  `scale` and frame count; make the ceiling configurable; fail soft to single-worker.
- **Gotcha**: determinism holds only for frame-indexed `comp` mode. In `ordinary` (wall-clock/WAAPI)
  mode, keep the single-worker path — a parallel split there is a correctness risk, not a speedup.
- **Gotcha**: disk. 858 × ~400 KB JPEG ≈ 340 MB of tmp; clean up in the `finally` that already
  `rmSync`s the tmp dir in `video.ts`.
- **Validate**: bench delta ≈ linear in workers up to the memory wall; determinism assertion from
  Task 5 still green.

### Task 7: UPDATE the Exports panel — resolution, fps, Draft preset, honest ETA, degradation notice

- **Do**: For temporal cards, surface (a) Resolution 1×/2× (default 2× stays, 1× labelled "Draft —
  fastest"), (b) fps override (comp fps default; 24/30 choices), (c) a live ETA derived from the
  Task-1 `msPerFrame` of the last export of that shape rather than a fixed string, and (d) a visible,
  non-silent notice when a finished export came back `degraded` ("audio dropped — the fast renderer
  failed"), which today only exists in job stderr.
- **Pattern**: `PNG_RESOLUTIONS` + the `Resolution` select at `export-dialog.tsx:588`; the audio toggle
  and long-comp notice at `app.jsx:1547` / `1859`.
- **Gotcha**: after editing client sources, rebuild the committed bundle release-minified
  (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit
  `dist/client.bundle.js` + `dist/styles.css` — whatever is committed is what ships (CLAUDE.md).
  Check `git status apps/studio/dist/` before AND after any `bun test` in this tree.
- **Validate**: manual — export the same comp at 1× and 2×, confirm the ETA tracks reality within ~20%.

### Task 8: SPIKE GPU rasterization + hardware video encoding, adopt what measures faster

- **Do**: (a) In-page probe: `VideoEncoder.isConfigSupported({ codec: 'avc1.…',
  hardwareAcceleration: 'prefer-hardware', width, height, framerate })` — log the verdict; if hardware
  is available, pass the preference through mediabunny's codec/encoder config in
  `video-encode-lib.ts`. (b) Launch-flag matrix in `_pw-launch.mjs`, measured with the Task-1 bench on
  macOS: `--use-angle=metal`, `--enable-gpu-rasterization`, `--ignore-gpu-blocklist`,
  `--enable-zero-copy`. Adopt only flags with a measured win.
- **Gotcha**: headless Chromium commonly falls back to SwiftShader, in which case "GPU" flags are
  noise. **Report the measured truth** — including "no hardware encoder available headless, the win
  came from Tasks 3–6" if that is what the numbers say. Do not ship flags on faith.
- **Gotcha**: these flags apply to every export shim; re-run `/design:smoke` and the PNG/PDF exports.
- **Validate**: bench delta per flag combination, recorded in the Results table.

### Task 9: RECORD the decision + close the loop

- **Do**: `/flow:record-ddr` for the capture-transport decision (Task 4's frame hand-off) and the
  parallel-capture determinism argument; re-ingest into the graph
  (`maude kg import --only "DDR-NNN"`). Update the DDR-148 pointer in `CLAUDE.md` only if the capture
  contract actually changed. Add a `whats-new-entry` for "video exports are ~Nx faster".
- **Validate**: `maude kg context --root . --about "video export"` returns the new decision.

---

## Results (fill in as tasks land)

| Stage | Config | ms/frame | 858-frame wall clock | Notes |
| --- | --- | --- | --- | --- |
| Baseline | frame-step, PNG, scale 2, 1 worker | ~1050 (measured live) | ~15 min | the reported case |
| Task 3 (jpeg) | | | | |
| Task 4 (single transfer) | | | | |
| Task 5 (overlap) | | | | |
| Task 6 (N workers) | | | | |
| Task 8 (GPU flags) | | | | |
| Task 2 (renderer path) | one-pass renderMediaOnWeb | n/a | | with audio |

**Target**: < 60 s for 858 frames at scale 2 on the frame-step path; seconds-to-low-tens-of-seconds on
the one-pass renderer path. If Tasks 3–6 land and the number is still minutes, the bench will say
exactly which stage owns it — that is the point of Task 1.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test` (watch `git status apps/studio/dist/` before and after)
3. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`
4. **Bench**: `bun run test/video-export-bench.ts` — the Results table must be filled, not asserted from memory
5. **Smoke**: `/design:smoke` (the launch-flag changes touch every capture shim)
6. **Desktop**: the capture shims run under the packaged `.app` too — run
   `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` before release (DDR-177)
7. **Manual**: export the user's actual 858-frame comp as MP4 and as GIF; confirm output is visually
   identical to the pre-change file, audio present on the renderer path, and the panel reports the path

---

## Acceptance Criteria

- [ ] Task 1 baseline recorded before any optimization lands
- [ ] Every optimization task has a measured before/after in the Results table (no unmeasured merges)
- [ ] 858-frame MP4 at scale 2 exports in < 60 s on the frame-step path
- [ ] Output is visually indistinguishable from the current export (frame-0 and mid-transition diff)
- [ ] Re-running the same export twice is byte-identical (determinism preserved under parallelism)
- [ ] GIF export unaffected (still PNG-sourced, still palette-correct)
- [ ] A degraded (audio-dropped) export is visible in the UI, not only in job stderr
- [ ] `/design:smoke` and the packaged-`.app` bundle gate green
- [ ] Capture-transport + parallel-capture decisions recorded as DDRs and ingested into the graph
