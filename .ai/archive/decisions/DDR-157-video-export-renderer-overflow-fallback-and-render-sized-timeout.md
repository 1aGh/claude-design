# DDR-157: Video export survives a renderer overflow — frame-step fallback + render-sized job timeout

- **Date:** 2026-07-09
- **Status:** Accepted (implemented — commit `3126ed08`; RCA `issue-video-mp4-rendermediaonweb-stack-overflow`)
- **Tags:** studio, exporters, video, remotion, web-renderer, fallback, dos, timeout, resilience, trust-model
- **Related:** [DDR-148](./DDR-148-video-comp-remotion-authoring-capture-export.md) (the video-comp capture spine + the renderMediaOnWeb audio addendum this hardens), [DDR-153](./DDR-153-export-job-queue-and-notification-center.md) (the job queue whose per-job timeout this makes render-aware), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (canvas iframe is untrusted — why the in-page error text is sanitized). RCA (gitignored): `.ai/logs/rca/issue-video-mp4-rendermediaonweb-stack-overflow.md`.

## Context

A user's MP4 export of a real 900-frame video-comp (`studyfi-design/.design/ui/Video Start Here.tsx`, artboard `reel`) never completed. Two chained failures, confirmed by reproduction:

1. **`@remotion/web-renderer`'s `renderMediaOnWeb` overflows the JS call stack on deep comps.** Its DOM→canvas rasterizer recurses one native stack level per nested *precompositing boundary* (`processNode → compose (new OffscreenCanvas) → walkOverNode → processNode`), with **no depth guard**. A comp that stacks enough nested `opacity`/`transform`/`filter`/`mask` layers throws `RangeError: Maximum call stack size exceeded` — at a *late* frame (the renderer walks frames sequentially, so a shallow opening frame renders fine and the overflow only appears deep in the timeline). The capture shim (`_video-playwright.mjs`) awaited the render bare, so the throw killed the whole export (exit 1, no file).

2. **The export job's wall-clock timeout was a flat 5 min for every format** (DDR-153). Even once the fallback below exists, a 900-frame frame-step render at 2× (2560×1440) takes ~9 min on a dedicated box (measured; more under desktop load), so the 5-min cap fired `controller.abort()` mid-render → "Target page closed at frame ~180/900" → hard fail. The two failures compounded: the overflow forced the slow path, and the slow path outran the timeout.

The fast one-pass renderer is the *good* outcome (228-frame comp = ~8 s, with audio). The frame-step path (`page.screenshot` per frame → mediabunny) goes through Chromium's **native compositor** and is immune to the recursion — it was already the spine for GIF / ordinary / comp-less artboards. It just wasn't reachable when the renderer path threw, and couldn't finish inside the timeout when it was.

## Decision

### 1. Degrade to frame-step on ANY renderer failure — a video-only file beats a hard failure

`_video-playwright.mjs` wraps the `renderMediaOnWeb` path in try/catch. On any throw it logs a warning and falls through to the existing `frameStepCapture`. The single cost is **audio**: the frame-step path is video-only, so a comp that overflows the one-pass audio renderer still exports — just muted, with `degraded/audioDropped/fallbackReason` stamped on the summary and surfaced by `video.ts` to stderr. This is a deliberate *graceful degradation*, not a silent one: a genuine double-failure (fallback also throws) re-throws a combined error naming **both** root causes, so a real bug is never hidden behind the fallback. We did NOT try to fix the upstream recursion (no depth cap in web-renderer 4.0.486) or forbid deep comps — the fallback is version-independent and needs no author behavior change.

### 2. Size the job timeout to the WORK, not a flat constant — and floor it at 5 min, not 30

Video formats (`mp4/webm/gif`) get `jobTimeoutMs = clamp(60s setup + frames × 2.5s, 5min, 60min)`; non-video keeps the 5-min default. Frame count comes from `options.frames` / `durationMs×fps`, worst-cased to the 900-frame `MAX_FRAMES` when absent. `MAUDE_EXPORT_VIDEO_TIMEOUT_MS` is an operator escape hatch, **intentionally uncapped** (removing the backstop is the whole point of an override, and env is trusted-operator input, not attacker-reachable).

The lower bound is deliberately **5 min (the image baseline), not a flat 30 min** — a decision the adversarial security pass drove: a flat 30-min floor would give even a 1-frame GIF a half-hour budget, and a hostile hub-pushed comp that *reliably* overflows the renderer and is expensive per screenshot could turn a former 5-second fast-fail into a ~30–60 min occupation of one of the two bounded render slots. Sizing the floor to the frame count keeps the legit 900-frame comp at ~38 min while collapsing that adversarial window for small comps back to 5 min. (Both agents confirmed the residual is below the medium floor — enqueue is `MAX_PENDING`/semaphore-capped and same-origin+loopback-gated — so this is defense-in-depth, not a gate blocker.)

### 3. Neutralize log/ledger injection from the untrusted in-page error text

The caught error `.message` carries an in-page (canvas-origin, untrusted per DDR-054) stack, and it flows to `console.error`, the stdout summary, and the persisted `_export-history.json` `job.error`. It is newline-collapsed (`oneLine()`) at the capture point before any sink, so a comp throwing `new Error("…\n[FATAL] forged")` can't inject lines into the dev-server's stderr or the history ledger. (The summary path was already `JSON.stringify`-escaped; this closes the raw-`console.error` residual.)

## Consequences

- **Positive:** MP4/WebM export never hard-fails on the renderMediaOnWeb overflow class; long legitimate renders complete instead of aborting at 5 min; the degradation (dropped audio) is observable, not silent; a small hostile comp can't grief a render slot for longer than the old 5-min cap.
- **Negative / accepted:** a comp that overflows the renderer exports **without audio** — the user isn't told in-product yet (stderr/logs only; a UI toast reading the `degraded` flag is a noted follow-up). The best outcome is still *not overflowing* (fast path, audio intact); flattening a comp's nested precompositing layers keeps it on the fast path — an authoring guideline for the `video-comp` skill (follow-up).
- **Deployment:** the timeout lives in the compiled `maude-server` sidecar, so the desktop app only picks it up after the sidecar binary is rebuilt (`build.ts --release`); the shim fallback ships via `stage-resources.mjs` on every `tauri dev`.

## Alternatives considered

- **Patch/upgrade `@remotion/web-renderer`** to add a depth guard — out of our control at 4.0.486; the fallback is version-independent. Worth an upstream report + a version bump if a later release converts the recursion to an explicit work stack.
- **Pre-flight reject deep comps** — brittle (depth is data-dependent and only manifests at specific frames) and user-hostile (blocks a comp that previews fine).
- **Keep a flat, generous timeout (30 min for all video)** — rejected on the adversarial slot-occupation ground in Decision 2.
