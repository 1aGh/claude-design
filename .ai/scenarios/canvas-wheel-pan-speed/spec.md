# canvas-wheel-pan-speed

**Persona:** Anyone panning the canvas with a physical mouse wheel (no shift, no ctrl/cmd). Issue #94 dogfood report: "scroll with mouse wheel in browser is very slow ... should be more smoother and faster".

**Canvases under test:** any canvas with `DesignCanvas`/`useViewportController` mounted — uses `.design/ui/Canvas Viewport.tsx` (already exercised by `canvas-figjam-feel`) so the viewport host + `.dc-world` transform are already known-good selectors.

**Hypothesis:** `onWheel` in `apps/studio/canvas-lib.tsx` now normalizes `WheelEvent.deltaX`/`deltaY` through `wheelDeltaToPixels` before panning, so a LINE-mode wheel event (`deltaMode: 1`, the common case for a physical mouse — see RCA `.ai/logs/rca/issue-94-wheel-pan-slow.md`) pans the viewport by a normal, visible-per-notch amount instead of a few CSS pixels.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |

Native iOS / Android and web-mobile **SKIPPED** — same rationale as `canvas-figjam-feel`: the canvas viewport is desktop-only dev tooling (`.design/ui/Canvas Viewport.meta.json#platform: "desktop"`), a physical mouse wheel has no touch-input parity story, and this dev-server is not a mobile product surface.

## Preconditions

- Dev server running (`bun apps/studio/server.ts --root . --port <port>`).
- `.design/ui/Canvas Viewport.tsx` accessible at the dev-server root.
- Browser viewport at 1440×900.

## Steps

1. **Open Canvas Viewport.tsx; assert load.**
   - Navigate to dev-server root, click "Canvas Viewport" in the file tree.
   - Capture a full-page **before** screenshot.
   - Read `.dc-world`'s computed `transform` (or `style.zoom` + `style.transform`, engine-dependent) as the baseline viewport position.

2. **Dispatch a single LINE-mode wheel notch (the regression case).**
   - Dispatch a native `WheelEvent` on the canvas host with `deltaY: 3, deltaMode: 1` (`WheelEvent.DOM_DELTA_LINE`), no modifier keys — this is the shape Firefox (and other browser/OS combinations) emit for one physical mouse-wheel notch.
   - Wait for the gesture-settle window (>220 ms per `markInteracting`'s `SETTLE_MS`/interact-end timer).
   - Read `.dc-world`'s transform again.
   - Capture a full-page **after** screenshot.
   - Assert the viewport's world Y offset moved by `48` px (`3 × LINES_TO_PIXELS(16)`) in the panned direction — NOT `3` px. A `3` px result reproduces the pre-fix bug (raw line-mode delta consumed as pixels).

3. **Dispatch a PIXEL-mode wheel event (trackpad regression guard).**
   - Dispatch `WheelEvent` with `deltaY: 100, deltaMode: 0` (`WheelEvent.DOM_DELTA_PIXEL`), no modifiers.
   - Assert the viewport's world Y offset moved by exactly `100` px — pixel-mode deltas must remain unscaled (proves the fix doesn't regress trackpad panning, which was already correct).

## Success criteria

- Both steps 2 and 3 PASS.
- Zero JS console errors in the canvas iframe over the full run.
- Before/after screenshots visibly show the artboards shifted after step 2 (not a near-imperceptible few-pixel nudge).

## Counter-delta

Single platform — no counter-delta. The scenario IS the verification; if both steps PASS on web-desktop, that's the gate.

## Follow-ups (not blocking)

- A `deltaMode: 2` (`DOM_DELTA_PAGE`) case exists as a unit test (`apps/studio/test/canvas-wheel-delta.test.ts`) but has no live-DOM scenario step — page-mode wheel events are rare in practice (mostly Space/PageDown-triggered native scroll, not wheel notches) and lower priority to script live.
