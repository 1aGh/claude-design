# DDR-231: Hybrid export lanes — images render in the member's browser, video on maude-render

**Status:** Accepted
**Date:** 2026-08-23
**Extends:** DDR-230
**Related:** DDR-193, DDR-209, DDR-054, DDR-088

## Problem

The DDR-230 remote render lane shipped as the export path for EVERY browser-needing format — and never completed a production render. Five distinct outage classes preceded the first successful job (DO env caching, container-roll gap, verify race, npm token expiry, and finally the token-proxy header-replay bug root-caused 2026-08-23: `startTokenProxy` replayed Bun-fetch's transparently-decompressed Response with the stale `content-encoding`/compressed `content-length`, so Chromium hit `ERR_CONTENT_DECODING_FAILED` on the main document and every `goto` burned its full timeout). Even with the lane fixed, its floor for an interactive "export the artboard I'm looking at" is two chained container cold-starts (tenant cell wake + multi-GB Chromium image wake) — a distributed-systems tax on screenshotting pixels the member's browser has already rendered.

## Decision

Split the export surface by format, per the 2026-08-23 debate-protocol bookend (divergent+research; graph node `maude/debate-hybrid-export-lanes`):

- **Images — `png`, `pdf`, `svg`, `html`, `pptx` — render in the MEMBER'S OWN BROWSER** in workspace/cloud mode (new `browser` lane). The canvas already evaluates tenant TSX there (containment-clean under DDR-193 — nothing changes about vendor compute), and the capture core is *already browser-side code*: `dom-to-svg`/`dom-to-pptx` run inside `page.evaluate` today via `_browser-bundles.ts`, so the browser lane re-hosts the existing spine's in-page half rather than forking a second implementation. Industry prior: Figma/tldraw export images client-side wherever the editor owns a browser renderer.
- **Video — `mp4`, `webm`, `gif` — stays on `maude-render`** (the fixed remote lane). Full-CSS fidelity requires a real headless Chromium; browser-side MP4 was evaluated and REJECTED for arbitrary DCArtboard comps on the evidence of Remotion's own web-renderer limitations (CSS subset only — no `z-index`, `backdrop-filter`, `mix-blend-mode`, 3D transforms). Industry prior: Canva/Kapwing/Remotion-classic all render video server-side.
- **`zip`** stays in-cell (browser-free), **`canva`** stays desktop-only (both per DDR-230).
- **Desktop / self-host-with-browser** keeps the `local` playwright spine for everything — the `browser` lane exists only where `local` is forbidden (workspace containment).

Guard rails carried from the debate's preserved dissent:

1. **Daily synthetic canary** against the production render service (BREAKER: "a never-exercised worker path is exactly how we got a service that has never completed a render") — the video lane must be exercised between releases.
2. **Honest video-lane UX** (USER-ADVOCATE): staged `queued / waking / rendering` progress, human-readable failures, tool internals behind a disclosure.
3. **Single spine** (BUILDER): the in-page capture/fixup code (dom-to-svg usage, `pptx.ts` text-positioning fixups) is shared between the playwright host and the browser-lane host — never duplicated.

## Alternatives considered

- **Keep + fix the worker as the only lane** (status quo): rejected — no seat argued it; the interactive-latency floor is structural, and the ops loop (unreachable container logs, one hypothesis per release) makes it the most expensive surface to keep correct.
- **Pure browser-local incl. video, decommission the fleet** (SHIPPER's stance, preserved dissent): rejected for video on Remotion's documented CSS-subset ceiling + tab-throttling/battery hazards for long encodes + no headless story for scheduled/API exports. Revisit if a future composition model is canvas-renderable end-to-end.
- **Browser MP4 via WebCodecs alongside the worker**: deferred — encoding itself is production-viable in 2026 (H.264 encode ~99.7% device support; mediabunny muxing; Remotion web-renderer, Clipchamp), but per-frame DOM rasterization fidelity is the unsolved half. The worker keeps video until that changes.

## Consequences

- Everyday exports (PNG/PDF/PPTX of the visible artboard) become near-instant and fleet-independent; the failure surface moves to code debuggable in devtools.
- The render fleet's blast radius shrinks to video/batch — a rotten heavy lane degrades to "video export is broken", never "exports don't exist".
- Two hosts share one capture spine — a fidelity gate (browser capture vs playwright reference on the smoke canvases) is REQUIRED before the browser lane ships a format, and PDF specifically may NOT silently ship raster (vector `page.pdf` fidelity was already litigated in `pdf.ts` history; browser PDF is svg2pdf-vector or it falls back to the worker).
- The self-host `--render` sidecar becomes video-only; docs must say so.

## Superseding conditions

- If the fidelity gate cannot be held green for a browser-lane format, that format returns to the remote lane (per-format, not wholesale).
- If a future canvas composition model makes video canvas-renderable (no arbitrary-DOM rasterization), revisit browser-side video and the fleet's existence (SHIPPER's dissent becomes live again).

## Plan

`.ai/plans/feature-hybrid-export-browser-images.md` (T1 hotfix shipped as v1.0.6).
