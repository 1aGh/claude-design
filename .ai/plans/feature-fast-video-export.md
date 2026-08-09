# Feature: Fast, correct video export

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Rev 2 (2026-08-09).** Rewritten after a divergent bookend debate (BUILDER / SHIPPER / BREAKER, blind openings + one cross-challenge round — all three revised) and three web-research passes (Remotion upstream, WebCodecs/GPU in headless, peer architectures). Rev 1's task list optimized the wrong layer and its headline target was arithmetically unreachable from its own cost table. The debate record and the corrections are in § Debate outcome.
>
> **Rev 3 (2026-08-09).** RCA [`issue-mp4-audio-export-html5audio-silent-degrade`](../logs/rca/issue-mp4-audio-export-html5audio-silent-degrade.md) **settles the attribution Task 0 was going to spike for** — and the answer is neither of the two candidates this plan weighed. The reported export degraded because `remotion`'s `<Audio>` **is** `<Html5Audio>`, which `renderMediaOnWeb` rejects with a *typed, decidable* error. The whole 15 minutes is a one-word import bug, silently converted into a 40× slowdown plus a muted file. **The RCA's fixes are now Tasks A1–A5 and they come first** — they are worth more than every speed task in this plan combined, and they are the "reliable, highest-quality render" the user actually asked for.

## Description

An 858-frame (28.6 s @ 30 fps) MP4 export takes ~15 minutes ≈ 1.05 s/frame. That is the symptom. The debate established that it is **two problems wearing one coat**:

1. **A correctness problem.** The export ran on the frame-step fallback, which is video-only by construction — it produced a **silently muted file behind a progress bar**. Underneath it, the seek bridge can fail and report success (`video-comp.tsx:158-164`), and the shim's `<video>` wait has a wall-clock escape hatch that captures a stale frame rather than failing (`_video-playwright.mjs:517`). Neither is visible today; both become far more likely the moment anything runs in parallel.
2. **A speed problem.** Per frame, the pixels cross the process boundary **twice** as base64 PNG — out to Node, straight back into the same page — to reach an encoder that lived in that page all along. Real, but bounded: it cannot account for the whole second, and fixing it alone cannot reach a "seconds, not minutes" target.

The reliable, high-quality render the user asked for is mostly problem 1. The speed is mostly a third thing neither of the above: **the export may not need the frame-step path at all**, and if it does, the only lever with an order of magnitude in it is distribution.

## User Story

As a designer exporting a reel from Maude, I want a ~30-second video to export in well under a minute **and to be exactly what I scrubbed in the Player, with its audio**, so that iterating on a cut is a normal edit loop and I never ship a file that is quietly wrong.

## Problem

### The diagnosis Rev 1 got wrong

Rev 1 asserted the export degraded off the one-pass renderer because of the known `RangeError` (RCA `issue-video-mp4-rendermediaonweb-stack-overflow`), and proposed a bigger V8 stack as the fix. Three corrections:

- **The RCA itself says the overflow needs "on the order of hundreds of nested precompositing boundaries… not a typical hand-authored scene."** The far likelier reason this export was on the slow path is `compId === null` — the artboard has no registered `VideoComp`, so `useRenderer` is false by construction (`_video-playwright.mjs:128`). A stack flag is a no-op in that case. **One telemetry field settles which it was; nothing else should be built until it does.**
- **Upstream, the recursion premise is narrower than our RCA states** (research, DOCUMENTED from Remotion source): plain `opacity` and 2D transforms do **not** precomposite — only filters, masks, and non-2D transforms do. And `createLayer` is `async` and awaits at every level, so the precomposite chain is a *promise* chain, not a deep sync stack. Our `RangeError` may originate elsewhere entirely.
- **A raised `--stack-size` can make things worse.** The frame-step fallback reuses the *same page* the renderer just failed in (`_video-playwright.mjs:223-239`). A catchable `RangeError` leaves that page alive; a stack that overruns the OS thread guard page turns it into a renderer-process crash, after which the fallback also throws and the shim raises "failed on both paths" (`:248`) — a regression from *muted file* to *no file*.

### The arithmetic Rev 1 got wrong

Rev 1's own cost table attributes ~150–450 ms of the measured ~1050 ms/frame to PNG encode + decode + transport. That caps transport work at ~2× → ≈7 minutes for 858 frames, **not** the stated `< 60 s`. The target was only reachable via parallelism, which Rev 1 listed as one task among nine and justified with a premise that turned out to be false (below). **The target must be stated as a function of which path the export takes**, not as a single number.

### The premise Rev 1 inherited without checking

Rev 1 wrote that frame-step capture is "deterministic by construction," quoting the shim's own header comment. It is not. `video-comp.tsx:10-14` asserts determinism as a **doc comment with nothing enforcing it**, and below it:

```ts
try {
  e.ref.current?.pause();
  e.ref.current?.seekTo(f);
} catch {
  /* Player not yet ready — a later seek settles it */
}
await afterPaint();
```

A seek can be a complete **no-op and still resolve as success** — `afterPaint()` proves a paint happened, not that the right content was in it. Serially this is benign (frame N+1 repairs frame N's miss; only frame 0 is exposed). Under parallel frame-range workers, **every worker's range boundary is a first seek on a cold page**, so "a later seek settles it" is invoked once per worker instead of once per export. A readiness handshake layered above this bridge cannot see the failure — the bridge reports success.

There is also **no ready-count primitive to poll**: `grep` for `delayRender` / `continueRender` / `renderReady` / `__maude_ready` across Maude's own source returns **zero** hits (only the vendored `dist/runtime/@remotion_player.js`). Remotion's handshake works because user code registers handles via `delayRender()`. Maude canvases are **agent-generated TSX with no such contract stated anywhere**. Adopting Remotion's parallel Pool without Remotion's user-code contract is adopting the fast half of their design and none of the safe half.

## Solution

Ordered by what the debate converged on. **The first two steps may make everything after them unnecessary for the common case** — which is exactly why they come first.

- **Settle the attribution before optimizing anything** (a spike, then telemetry). Which path did this export take, and why.
- **Upgrade, don't work around.** `@remotion/web-renderer` 4.0.491 (PR #9101) detects native nested HTML-in-canvas and uses it on Chromium 152+, **bypassing the recursive DOM composer entirely**; 4.0.491 also shipped a client-side render performance improvement, and 4.0.499 fixed opacity leaking between layers. We are pinned at 4.0.486; latest is 4.0.507 (2026-08-07), 21 releases ahead. `pageResponsiveness: 'disabled'` is a documented one-option win for a headless exporter (the default `"medium"` yields the event loop every 33 ms).
- **Fix the correctness defects regardless of speed.** The silently-muted export, the seek-failure swallow, the wall-clock stale-frame escape hatch. These are the "reliable, highest-quality render" the user actually asked for, and they are prerequisites for anything parallel.
- **Then, and only then, distribution.** Remotion's entire speed story is parallel tabs (Pool of Pages in one browser, auto-capped at `min(8, cpus/2)`); `renderMediaOnWeb` itself is explicitly single-threaded per page, so parallelism must come from N pages on our side. Do it at **BUILDER's boundary — encoded segments, not raw frames** — so pixels never cross the process boundary at all.

**Keep the frame-step path.** BUILDER opened by arguing it should be the only path and `renderMediaOnWeb` deleted; he withdrew that after the Chromium-152 finding. SHIPPER's counter stands and is the reason both directions lose: **in the packaged `.app` we do not control the engine** — `_pw-launch.mjs:42-65` resolves system Chrome or a provisioned `chrome-headless-shell` of unknown version when Playwright's own browser is absent (the documented desktop case, RCA `issue-desktop-export-failures`). So the bump makes the fast path *likely on a dev machine* and *merely possible in the shipped app*. Both paths stay; both must be correct.

**No ffmpeg.** Rev 1 excluded it on posture; research made it an evidence-backed call. libx264 is **GPL** and the popular static builds enable it (`--enable-gpl --enable-libx264`), so bundling would make Maude GPL or require a commercial x264 license; ~25–60 MB per platform slice; and there is an **open Tauri bug ([#11992](https://github.com/tauri-apps/tauri/issues/11992))** where an app notarizes fine until `externalBin` is added. Against that, **WebCodecs H.264 inside Chromium runs under Chrome's own licenses** — a materially different legal position from shipping our own encoder. Note the boundary precisely: `@mediabunny/server` polyfills WebCodecs via **NodeAV, N-API bindings to FFmpeg's C API**, so mediabunny honors "no native binaries" **only in-browser**. If encoding ever moves to Node, ffmpeg is back in the bundle wearing a different hat.

---

## Debate outcome

Three seats, blind openings, one cross-challenge round. **All three revised.** Full payloads are in the session transcript; this is the resolved position.

| | Opening | After cross-challenge |
| --- | --- | --- |
| **BUILDER** | Delete `renderMediaOnWeb`; make the compositor the only path; parallelize at encoded segments; build a `<CompAudio>` manifest | **Revised.** Withdrew the deletion (PR #9101 means the renderer *is* the compositor on Chromium 152+, so the fidelity premise evaporates); withdrew the audio manifest (its own top-risk — bare Remotion `<Audio>` and `/design:reel` footage tracks would render silent — was disqualifying). Holds: the Chromium floor is not ours to guarantee, and *"a fallback whose output is silently muted is not a fallback, it is a defect with a progress bar."* |
| **SHIPPER** | Ship telemetry + JPEG + conditional settle + overlap + a scoped stack flag as the entire first release; cut the rest | **Revised.** Concedes the version bump was wrongly cut — the risk cited was a *process* cost with an existing gate (`check-runtime-bundles.sh`), not a correctness risk — which **inverts his own ordering**: every capture-path optimization was optimizing a fallback. Holds: the bump touches the live Player preview too (the same committed bundles), so budget a visual re-check of existing comps. |
| **BREAKER** | Build Task 1 only; parallel capture must not be built — determinism here is timer-dependent, not construction-dependent | **Revised, objection reduced not dissolved.** The handshake is the right mechanism, but Maude has no ready-count to poll and the bridge below it swallows failure, so it is *a feature to build*, not a refactor of one line. Adds a failure class no one named: six workers independently negotiating codecs (below). Holds the arithmetic. |

**Converged (no seat dissents):** instrument first · bump + `pageResponsiveness` before any capture work · fix the correctness defects before parallelism · parallelize at the **encoded-segment** boundary if at all · keep both paths · JPEG is a knob, not a contract.

**Live dissent, preserved:** BREAKER (confidence 8) holds that parallel capture stays unsafe until a **stated, linted frame-purity contract** exists for agent-generated comps — Remotion enforces determinism as a contract on user code (*"should not rely on frames being rendered in order"*), and Maude has no equivalent. BUILDER and SHIPPER (both confidence 6) put parallelism behind the correctness fixes but not behind a lint. **This plan sides with BREAKER** — the contract is Task 7's gate — because the failure it prevents is invisible and load-dependent.

### Research findings no seat had (fold into the tasks)

- **Playwright's default browser forces software encoding.** `chrome-headless-shell` forces ANGLE/SwiftShader in `headless_content_main_delegate.cc`, and `gpu_util.cc` then sets `ACCELERATED_VIDEO_ENCODE = kGpuFeatureStatusDisabled` — so WebCodecs falls back to **OpenH264 software**, and VideoToolbox is never reachable. The lever is the *browser choice* (`channel: 'chromium'`, `--enable-gpu`), not an encoder flag. `--enable-features=AcceleratedVideoEncoder` is **Linux-only** and does nothing on macOS.
- **`hardwareAcceleration` guarantees nothing.** W3C WebCodecs §7.9: `prefer-hardware` is a **hint** User Agents "may ignore… for any reason", and `isConfigSupported()` reports no field for whether hardware is actually in use. Usable only as a *differential* probe. Spec also warns hardware is not unconditionally faster (higher startup latency; worse at low resolution).
- **A correctness landmine in mediabunny:** browsers default `latencyMode` to `quality` (spec: **MUST NOT** drop frames), but MediaStream-driven sources auto-flip to `realtime` (**MAY** drop frames). Stay on `CanvasSource`/direct `VideoSample` push and pin `latencyMode: 'quality'`.
- **`optimizeForSpeed: true`** is a documented CDP `captureScreenshot` option we do not pass today.
- **Dead ends, confirmed:** `HeadlessExperimental.beginFrame` was **never supported on macOS** (Chromium dev, 2017), is `chrome-headless-shell`-only, and is reported removed in Chromium 147. `Page.startScreencast` **drops frames by design** — the browser decides when frames exist. Our slow `captureScreenshot` never silently drops one; that is the property worth keeping.
- **No published benchmark exists** for `captureScreenshot` cost at any resolution or format, nor for whether new headless on Apple Silicon exposes VideoToolbox. Anyone quoting a number is guessing. Both are ~20-minute local A/Bs.
- **Remotion's determinism model, for reference:** they do *not* virtualize page time — they push the frame in explicitly (`window.remotion_setFrame`), exactly the shape `__maude_seek__` already has. Their stale-frame fix is a **readiness handshake** (`window.remotion_renderReady`, driven by `delayRender()`/`continueRender()`, checked **twice** — before *and* after the frame is set, because setting the frame can register new handles), plus `await document.fonts.ready` **before every screenshot** (we await it once, at `_video-playwright.mjs:82`). They avoid `<video>` seek races by never seeking a `<video>` — `@remotion/media` extracts the exact frame via Mediabunny into a `<canvas>`.
- **Licensing:** Remotion's Free License covers a for-profit org with **up to 3 employees**. Client-side rendering **always sends a telemetry event including the IP address**, even with no license key; our capture CSP blocks it at the network layer, but from Remotion 5.0 telemetry becomes mandatory for render-based licensing. Worth a conscious decision, not a discovery later.

---

## Tasks

**Nothing after Task 2 is authorized to start until Tasks 0–2 have reported their numbers.** The point of the ordering is that Tasks 0–2 may delete the need for Tasks 5–8 in the common case.

### Task 0: ~~SPIKE the attribution~~ — ANSWERED by the RCA

**Settled, no spike needed.** RCA `issue-mp4-audio-export-html5audio-silent-degrade` reproduced it four times across three server sessions (`~/Library/Logs/com.maude.app/server.log` lines 1037/1175/1336/2167):

> `⚠ mp4 export degraded: the audio renderer failed (page.evaluate: Error: <Html5Audio> is not supported in @remotion/web-renderer. Use <Audio> from @remotion/media instead. …), so this file was captured frame-by-frame and has no audio.`

Neither candidate this plan weighed was right. Not `compId === null`; not the recursion overflow (the thrown error is a *typed unsupported-element rejection*, not a `RangeError`, and it reproduces identically at `scale: 1`, so render size is not a factor either). The RCA also killed the "the `.mov` sources have unsupported audio tracks" theory by experiment: exporting with `options.audio = false` **still** degraded, because `muted` does not unmount the `<Audio>` element.

**Consequences for the rest of this plan:**

- The fast path was never broken for this comp. The sibling 16:9 artboard in the *same file* exports **with** audio in **~45 s** — versus ~37 min frame-stepping for the 9:16 one. That is the real, measured cost of this bug: **~40×**, plus silent audio loss.
- Task 2's Remotion bump is still worth doing on its own merits, but it is **not** what unblocks this user.
- Tasks 5–9 (handshake, parallelism, GPU, JPEG) optimize a path this export should never have been on. They stay in the plan, correctly ordered, but their priority drops behind A1–A5.

### Task A1: Make `degraded` a first-class outcome (kills the silence)

- **Do**: `degraded?: {audioDropped: boolean; reason: string}` on `ExportResult` (`exporters/index.ts`); set it from the summary `video.ts` already parses (`:161-185`) instead of only `console.error`; carry it onto the job record, the WS `export:job` emit, and `_export-history.json` (`jobs.ts:49-62,328`); render a warning row + completion toast in `client/export-center.jsx`.
- **Keep `status: 'done'`** — the file is real. Make the degradation *machine-readable*, not a status change.
- **Rejected**: encoding the remediation into the download filename — it breaks the handoff contract. The job row + toast are enough.
- **Why it matters beyond this bug**: today the artifact and its ledger entry are **indistinguishable from a clean export**. The only place the warning lands is the desktop app's stderr, which is not surfaced in-product and is not where a user or an agent looks.

### Task A2: Pre-flight the unsupported elements before launching Chromium

- **Do**: In the mp4/webm path, statically scan the target canvas source for `Audio` / `OffthreadVideo` imported from `'remotion'`. **Refuse** for `<Audio>` with the exact one-line remedy (a music bed silently vanishing is worse than a refused export); **pre-stamp `degraded`** for `OffthreadVideo` (often legitimately silent b-roll).
- **Pattern**: mirrors the existing "refused with remediation, never silently truncated" posture of `resolveMaxFrames` (`video.ts:44-49`).
- **Gotcha**: must see through a **re-export barrel one hop away** — that is the actual shape of the reproducer (`_broadcast.tsx` re-exports `Audio` from `'remotion'`; the canvas imports from `_broadcast`). A scanner that only reads the canvas file misses the real bug.
- **Why this and not just the fallback**: DDR-157's blanket "degrade on ANY renderer failure" is right for the overflow class it was built for — data-dependent, late-manifesting, unfixable by the author. `<Html5Audio>` is the **opposite**: decidable from source before a browser launches, always fails, one-line remedy stated in the error itself. Swallowing it into a generic fallback converts a fixable mistake into a mysterious one.

### Task A3: Stop generating the broken pattern

- **`plugins/design/skills/video-comp/SKILL.md`** — move `Audio` from the `remotion` import list (`:42`) to the `@remotion/media` list (`:43`); retitle the `:152` section ("Audio in exports") to cover **both** elements, not just `OffthreadVideo`; fix the canonical example at `:235`/`:278`. Add the `disallowFallbackToHtml5Audio` note — `@remotion/media`'s `Audio` can itself fall back to `Html5Audio` under some conditions, which would reopen this exact failure.
- **`apps/studio/clip-ops.ts:350-353`** — stop rewriting `<Video>` → `<OffthreadVideo>`. The name collision it guards against (a canvas component called `Video`) is real, but it belongs in the **import alias**, not in a rewrite that silently destroys the audio track behind the author's back.
- **Scaffold + tests** — `test/clip-addressing.test.ts:711`, `test/canvas-create-api.test.ts:156`, `test/clip-ops.test.ts:758` currently *assert* the broken shape.

### Task A4: Post-export artifact assertion

- **Do**: when audio was requested and the produced container has **no audio stream**, that is by definition a degraded result — independent of whether the shim noticed. Cheap, and it catches audio-loss classes we have not met yet.
- **Note**: the `video-comp` skill already tells authors to `ffprobe` after every export (`SKILL.md:171-175`) — a human-only instruction that this makes the exporter's job.

### Task A5: Codemod the existing canvases

- **Do**: at minimum `maude/.design/ui/Photo Editor Trailer.tsx:1-10` — **Maude's own trailer cannot export with sound.** (`Maude Video Intro.tsx` and `Maude Native Launch.tsx` already import from `@remotion/media` and are fine — the correct pattern exists in practice, just not in the docs.) The same one-line swap applies downstream.

### Task 1: ADD in-shim per-stage timing + path telemetry

- **Do**: Per-stage accumulators (seek / settle / screenshot / transfer+encode) in the existing loop (`_video-playwright.mjs:401-427`); emit ONE `MAUDE_TIMING {…}` stdout line. Propagate the already-computed `path` / `degraded` / `fallbackReason` (`_video-playwright.mjs:433-435`, `video.ts:171-177`) into the job record and `_export-history.json`.
- **Gotcha**: `video.ts:163` parses `stdoutLines.at(-1)` as the summary — an unfiltered trailing line **breaks every video export**. Filter `MAUDE_TIMING` in `_runtime.ts` beside `PROGRESS_LINE`, not in `video.ts`.
- **Cut from Rev 1**: the synthetic bench fixture. The user's real comp is the fixture; a synthetic one risks measuring a nesting shape that does not reproduce the fallback, and `bun test` in `apps/studio` is documented to clobber `dist/`.
- **Validate**: one export prints a stage breakdown; the panel/history shows the path.

### Task 2: UPDATE — bump `@remotion/*` and disable page responsiveness

- **Do**: Bump all six pinned `@remotion/*` packages (`apps/studio/package.json:40-63`) from 4.0.486 to ≥4.0.491 (prefer 4.0.507); regenerate the 10 committed `dist/runtime/*.js` bundles with `MAUDE_FORCE_RUNTIME_BUILD=1 bun run build.ts --release`; set `pageResponsiveness: 'disabled'` in the `renderMediaOnWeb({…})` call (`video-render-lib.ts:76-95`).
- **Gotcha**: those same bundles drive the **live Player preview**, not just export. 4.0.499's "opacity leaking between layers" fix is evidence that rendering **output** changed across this delta. Budget a visual re-check of existing video canvases, not just an export check.
- **Gotcha**: PR #9101 **removed** `allowHtmlInCanvas` (option, CLI flag, Studio toggle); `Config.setAllowHtmlInCanvasEnabled()` is a deprecated no-op that warns.
- **Validate**: `check-runtime-bundles.sh` green; export AND scrub an existing video comp; Task 0's repro re-run.

### Task 3: FIX the silently-muted export (correctness, ships regardless of speed)

- **Do**: When the compositor path runs, render audio in a **separate `renderMediaOnWeb` pass** — audio has no DOM rasterization, so it cannot hit the composer cliff at all — and mux that single track into the mediabunny output. One track, one pass, **no seam, no re-encode** (research: Remotion's single biggest distributed-render win was eliminating an AAC re-encode at the audio join; this design has no join). If an audio-only render proves unexpressible in the web-renderer API, **refuse the export with an explanation** rather than shipping a silent file behind a progress bar.
- **Do**: Surface `degraded` / `audioDropped` in the UI, reusing the existing notice pattern (`app.jsx:1769`, `data-testid="export-long-comp-notice"`).
- **Cut from Rev 1 and from BUILDER's opening**: the `<CompAudio>` manifest. Withdrawn by its own author — bare Remotion `<Audio>` in a `<TransitionSeries>` and `/design:reel` footage tracks would render silent.
- **Validate**: an export that degrades says so in the UI; no path produces a silent file without telling the user.

### Task 4: FIX the seek bridge — a failed seek must not report success

- **Do**: Remove the empty catch at `video-comp.tsx:158-164`. A failed `seekTo` must reject, or increment a failure counter the shim reads and hard-fails on.
- **Gotcha**: this sits **below** any shim-level handshake and is invisible to it. Serially benign, which is why it has survived; it is the first thing parallelism would break.
- **Gate (source-shape, per `test/export-shim-multi-capture.test.ts`)**: assert the empty-catch shape is gone. **This gate precedes all others — without it a handshake is decorative.**

### Task 5: BUILD the readiness handshake (a feature, not a one-line refactor)

- **Do**: A ready-count registry in Maude's own source (there is none today), a canvas-lib API to register/release handles, and a shim-side wait that polls it **before and after** the frame is set (Remotion's stated reason: setting the frame can itself register new handles). Await `document.fonts.ready` **per frame**, not once at `:82`. Replace `setTimeout(finish, 1500)` (`_video-playwright.mjs:517`) with it.
- **Gotcha**: the 1500 ms timer is a **backstop that only fires when `seeked` never arrives** — it does *not* explain 1.05 s/frame in the common case (SHIPPER's correction). It explains why per-frame cost is **bimodal**, and why parallel capture is unsafe today. Treat it as correctness work, not perf work.
- **Gates (source-shape)**: no wall-clock escape hatch survives in the comp-mode wait — any ready timeout must `throw`/exit non-zero, never `res()`; the ready-wait is invoked **twice**; a single-call implementation fails the test.
- **Known limit**: `ordinary` mode can never have this (`_video-playwright.mjs:456-486` seeks WAAPI + real `<video>.currentTime` on wall clock, with 500 ms and 2000 ms bail-outs). Parallel capture must be **hard-gated to `mode === 'comp'`** with an asserted early return.

### Task 6: ADD the guards Rev 1 never mentioned

- **Do**: (a) `assertRenderOutputSizeOk(clip.width, clip.height, deviceScaleFactor, '_video-playwright')` — it exists in `_pw-launch.mjs:151`, is enforced by `_pdf-playwright.mjs:130`, and the video path (the only one holding a full-resolution surface across thousands of frames) has **no guard at all**. (b) Make `addVideoFrame` **reject** a bitmap whose dimensions differ from the encoder canvas instead of silently rescaling (`video-encode-lib.ts:135`). (c) Content-hash the bundle cache filenames — `getEncodeLibBundle()`/`getWebRendererBundle()` write **fixed, unversioned** tmp paths (`_browser-bundles.ts:91`, `:131`) that concurrent Maude servers at different versions race-write. (d) Pin `latencyMode: 'quality'` explicitly and never route frames through a MediaStream-backed source. (e) Decide `drawImage` clearing between frames deliberately — it never clears today, so a transparent artboard ghosts the previous frame; pin current behavior in a test first.
- **Validate**: unit-testable in `bun` without a browser — which is the point, since CI has no browser.

### Task 7: SPIKE + GATE parallelism at the encoded-segment boundary

- **Falsify first (standalone, touches nothing)**: run the existing in-page encoder twice against the same comp — frames 0-29, then 30-59 with a forced keyframe on the segment's first frame — and attempt a **re-encode-free join** via mediabunny demux → packet-passthrough into one `Output`. Assert: the join decodes to exactly 60 frames; frame 30 is pixel-identical to segment 2's own frame 0; **no `VideoEncoder` was constructed during the join**. If mediabunny exposes no encoded-packet source, **that is the falsification and segment parallelism dies there**, before a line of shim code moves. (The OBS "soft remux" pattern — fragmented output with a placeholder `free` box rewritten at finalize — is documented as a pattern but its preconditions for this library are **unverified**; nobody has published them.)
- **Then, if it survives**: N pages, each owning an in-page encoder, each returning one encoded segment; cap at `min(8, cpus/2)`. Raw pixels never cross the boundary, which makes JPEG, the frame-sink, and the overlap loop **unnecessary rather than cheaper**.
- **Gate — codec negotiation happens ONCE in the parent.** Each `startVideo()` independently runs `getFirstEncodableVideoCodec` and independently falls back mp4→webm (`video-encode-lib.ts:114-124`), so six workers under six different memory pressures can resolve six different codecs or containers. Resolve once, pass the config down, fail the export if any worker cannot honor it. Also: `QUALITY_HIGH` is per-segment rate control → a visible quality pulse at each boundary unless bitrate is pinned.
- **Gate — clip equality.** Extract clip resolution (`_video-playwright.mjs:296-304`) into a pure function of `(rect, deviceScaleFactor)`, unit-test it, and hard-fail when workers disagree. Independent of any timing fix: workers can measure different rects when fonts land at different moments.
- **Gate — the frame-purity contract (BREAKER's held dissent).** Write it into `plugins/design/skills/video-comp/SKILL.md` ("frame N is a pure function of N; no `Date.now`/`performance.now`/unseeded `Math.random`; never assume frames render in order") and lint comp files for those constructs. Maude's comps are **agent-generated**; without a stated contract and a lint, parallel capture is nondeterministic from user code alone regardless of any handshake.
- **Gate — memory.** Derive worker count from measured RSS, fail soft to single-worker. `HEAVY_FRAMES_WARNING = 900` exists because **one** 1080p page already OOMs. Remotion's `min(8, cpus/2)` comes from a dedicated CLI process at composition resolution — **not** from `deviceScaleFactor: 2` pages inside a desktop app also hosting a dev server, an ACP session, and the canvas browser. That number is not transferable.
- **Gate — recorded, nightly, under load.** 3 runs of a ≥300-frame **footage-bearing** comp must be byte-identical AND report a ready-timeout-fired count of exactly **zero**, run once idle and once **under artificial load**. Determinism measured on an idle machine proves nothing about a failure mode that *is* load.

### Task 8: SPIKE the GPU question honestly

- **Do**: (a) Test whether leaving `chrome-headless-shell` for `channel: 'chromium'` and/or `--enable-gpu` actually exposes hardware encode on this machine — confirm in `chrome://gpu` → "Video Encode", and by differential probe (`prefer-hardware` → `supported:false` while `no-preference` → `true` proves hardware is genuinely absent). (b) Measure `captureScreenshot` PNG vs JPEG vs WebP with and without `optimizeForSpeed: true` — no published number exists.
- **Do NOT**: ship `hardwareAcceleration: 'prefer-hardware'` as a setting (spec: an ignorable hint, and it can render a config *unsupported*); ship `--enable-features=AcceleratedVideoEncoder` (Linux-only); or add flags to `_pw-launch.mjs`, which 11 other shims call with no opts — anything kept goes in the video shim's own `launchChromium({args})` call.
- **Report the measured truth**, including "no hardware encoder is reachable headless on this platform" if that is the answer.

### Task 9: JPEG as a knob, defaulting to PNG

- **Do**: `--frame-format jpeg|png`, **default `png`**. Zero-risk opt-in; the default flips only if measurement earns it. If Task 7 lands, the intermediate disappears entirely — which is the strongest argument for treating this as a knob and not a contract.
- **Settling measurement** (SHIPPER's, after conceding his "below the noise floor" claim was asserted rather than measured): export the same DS canvas twice, PNG vs JPEG q90 intermediate, decode the **final MP4** both times — the intermediates are irrelevant, only the post-H.264 delta matters — and compute ΔE2000 restricted to a **high-contrast-edge mask** (accent-on-dark text, flat-color boundaries) plus full-frame SSIM. Ship JPEG only if max ΔE2000 on the edge mask is **< 2.0** AND Task 1's timing shows transport owning **> 30%** of per-frame cost.
- **Note the mechanism correctly**: the artifact that shows on this repo's DS is **DCT ringing and blocking at hard edges**, not the second chroma subsample (resampling already-half-resolution chroma on an aligned grid is close to identity).

### Task 10: RECORD

- **Do**: A DDR for the resolved architecture (both paths retained, segment boundary if Task 7 survives, audio as a separate render pass) and one for the frame-purity contract. Ingest into the graph. Add an RCA addendum to `issue-video-mp4-rendermediaonweb-stack-overflow` with Task 0's attribution. `whats-new-entry` when user-visible.

---

## Measured findings (2026-08-09, M-series mac)

### GPU / hardware encode — the spike, answered

`VideoEncoder.isConfigSupported({ codec: 'avc1.640028', 1920×1080, hardwareAcceleration: … })`, plus
median-of-8 `page.screenshot` at 1920×1080:

| engine | h264 prefer-hardware | PNG | JPEG q90 |
| --- | --- | --- | --- |
| **`chrome-headless-shell` (what we ship today)** | **false** | 51 ms / 187 KB | 33 ms / 43 KB |
| `chrome-headless-shell --enable-gpu` | true | 34 ms / 84 KB | 33 ms / 43 KB |
| full Chromium (new headless) | true | 49 ms / 84 KB | 17 ms / 43 KB |
| system Google Chrome `--enable-gpu` | true | 34 ms / 84 KB | 17 ms / 43 KB |

- **The research was right**: today's engine is the ONE configuration that cannot reach a hardware
  encoder. `chrome-headless-shell` forces ANGLE/SwiftShader, so Chromium reports
  `ACCELERATED_VIDEO_ENCODE` disabled. `--enable-gpu` flips it.
- **Shipped as `MAUDE_CAPTURE_GPU=1`, off by default, deliberately.** With the GPU the same page
  rasterizes to a materially different PNG (84 KB vs 187 KB) — a **visual change to every export**.
  That is not something to smuggle into a design tool behind a perf flag. And encode is not the
  bottleneck anyway: ~50 ms of a ~1050 ms frame.
- **A trap worth recording**: probing with `avc1.42001f` returns `supported: false` at 1080p in every
  engine — Baseline **level 3.1** caps at 720p. That reads as "no H.264 in headless" and is purely a
  wrong probe string. Use `avc1.640028` (High, level 4.0).
- Per WebCodecs §7.9 a `true` here proves availability, not use; a `false` does prove absence.

### Encoded-segment concat — the falsification spike, SURVIVED

Two 30-frame MP4 segments encoded in-page (keyframe forced on each segment's frame 0), demuxed via
`EncodedPacketSink`, re-muxed into one `Output` through `EncodedVideoPacketSource` with the second
segment's packet timestamps shifted:

```json
{ "ok": true, "codec": "avc", "frames": 60, "encodersConstructedDuringJoin": 0 }
```

`encodersConstructedDuringJoin: 0` is the load-bearing number — the join is a true **re-encode-free
remux**, so BUILDER's segment-parallel design is viable in mediabunny rather than hypothetical.

**What the spike did NOT prove** — these stay as gates, unchanged:
- Both segments came from ONE encoder config in ONE page. BREAKER's objection — N workers each running
  `getFirstEncodableVideoCodec` under different memory pressure and resolving different
  codecs/containers — is untouched by this. **Negotiate once in the parent** remains mandatory.
- Frame count is right; frame 30 being **pixel-identical** to segment B's frame 0 was not verified.
- The per-segment rate-control pulse at boundaries was not measured.

**Decision: viable, not yet built.** Parallel capture stays behind BREAKER's held dissent — the
frame-purity contract + lint for agent-generated comps, clip equality, memory-derived worker count,
and the recorded under-load determinism runs. Those are a feature's worth of work, and the spike's job
was to decide whether that work is worth starting. It is.

## Cut from Rev 1

| Cut | Why |
| --- | --- |
| Loopback frame-sink HTTP route | Superseded by the segment boundary; was the only item touching the DDR-054 canvas-origin trust boundary. If any transport change happens, it is the `exposeBinding(Uint8Array)` form — no route, no allowlist edit, no DDR. |
| `--js-flags=--stack-size` in `_pw-launch.mjs` | 11 other shims call `launchChromium()` with no opts, including the critic/smoke screenshot spine and whiteboard geometry. Kept only as scoped insurance at `_video-playwright.mjs:74` for the packaged-`.app` case where an older Chrome lacks the 152+ native path. |
| Resolution control for temporal formats | **Already shipped** — `app.jsx:1745-1768` renders it for every `card.temporal`. Rev 1 read the wrong dialog (`export-dialog.tsx:588` is the in-canvas one). At most, relabel `1×` as "Draft — fastest". |
| fps override + modelled ETA | New state and plumbing for an ETA only as good as telemetry that does not exist yet. |
| GPU launch-flag matrix | Downgraded to Task 8's measured spike. Ship no flags on faith. |
| Synthetic bench fixture | The user's real comp is the fixture. |

## Validation

1. `pnpm lint`
2. `cd apps/studio && bun test` — check `git status apps/studio/dist/` **before and after**
3. `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (Task 2 uses `MAUDE_FORCE_RUNTIME_BUILD=1` deliberately)
4. `/design:smoke`
5. `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` and `check-client-boots.mjs` (DDR-177; Task 2 changes the committed runtime bundles, which ship)
6. Manual: export the user's 858-frame comp as MP4 and GIF; audio present on the renderer path; the panel reports the path; scrub an existing video comp after the bump

> Note the ordering: step 2 (`bun test`) is documented to clobber `dist/`, so the release build in step 3 must follow it, not precede it.

## Acceptance Criteria

- [ ] Task 0 has answered "which path, and why" for the reported export **before** any optimization landed
- [ ] No export can produce a silent file without telling the user
- [ ] A failed seek can no longer report success (`video-comp.tsx` empty catch gone, asserted by a source-shape test)
- [ ] No wall-clock escape hatch remains in the comp-mode capture wait; a ready timeout fails the export loudly
- [ ] Every gate is a source-shape or unit assertion that runs **without a browser** (CI has none), or is explicitly recorded as a manual/nightly ritual with its result written down
- [ ] Parallel capture, if built: falsification spike passed, codec negotiated once, clip equality asserted, frame-purity contract written and linted, worker count derived from measured RSS, 3× byte-identical under load with zero ready-timeouts
- [ ] Speed target stated per path and measured, not asserted: the one-pass renderer path in seconds-to-low-tens-of-seconds; the frame-step path **< 60 s only if Task 7 lands**, otherwise ~2× today's and said so plainly
- [ ] GPU findings reported as measured, including a negative result
