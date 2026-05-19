# canvas-annotations

**Persona:** Designer doing async review of a canvas. Wants to circle a button, note "this needs more padding", and toggle the marks off for a clean screenshot — without leaving the dev-server iframe.
**Canvases under test:** `.design/ui/Canvas Viewport.tsx` (multi-artboard surface, exercises world-coord persistence at non-zero zoom), `.design/ui/Smoke TSX.tsx` (single-artboard fixture, exercises load-empty + first-stroke path).
**Hypothesis:** Phase 5 ships a SVG annotation overlay mounted by `CanvasShell`. Tools pen / rect / arrow / eraser are reachable via the floating `ToolPalette` AND the bare keys `B / R / A / E`; `V` clears to Move. Strokes persist to `<designRoot>/<slug>.annotations.svg` via debounced PUT (`/_api/annotations`). `Shift+P` hides the layer in-place (no write); `Cmd+/` toggles a native `<dialog>` shortcut sheet. Coexistence with Phase 4 viewport: while a draw tool is active the layer claims pointer events (drag = stroke); when a non-draw tool is active the SVG is `pointer-events: none` and the user gets the full Phase 4 / 4.1 input grammar.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | degraded — touch can draw strokes; Shift+P / Cmd+/ unavailable (no physical keyboard); persistence assertions still apply |

Native iOS / Android intentionally **skipped** — annotation UX is pointer-and-keyboard centric and the dev-server doesn't render in native shells. Document in run report as `SKIPPED reason="annotation tools are dev-server / web-only"`.

## Preconditions

- Dev server running (`bun plugins/design/dev-server/server.ts --root . --port 4399`).
- `<designRoot>/ui-canvas_viewport.annotations.svg` and `<designRoot>/ui-smoke_tsx.annotations.svg` cleared at scenario start (delete if present so we exercise the empty-load path).
- Active tool resets to `move` on each canvas open (default).
- `prefers-reduced-motion` not set (so the help-sheet `<dialog>` open/close fires normally; not strictly required, just documents the resting case).

## Steps

1. **Open Canvas Viewport.tsx; assert empty load.**
   - Capture full-page screenshot.
   - Assert active tool is `move` (palette button `aria-pressed="true"` on `move`).
   - Assert no `.dc-annot-svg` strokes rendered (`document.querySelectorAll('.dc-annot-svg [data-tool]').length === 0`).
   - GET `/_api/annotations?file=.design/ui/Canvas%20Viewport.tsx` → response body `""` (file does not exist yet).

2. **Switch to Pen via keyboard (B); palette + cursor reflect change.**
   - `keydown B` on document.
   - Assert palette: `aria-pressed="true"` on `pen` button; all others `aria-pressed="false"`.
   - Assert `.dc-canvas[data-active-tool="pen"]` attribute present.
   - Assert body cursor computed style is `crosshair`.
   - Assert the AnnotationsChrome (color picker + Hide + `?`) is now rendered (only mounts when an annotation tool is active).

3. **Pen-circle the first visible artboard's label area.**
   - Pointerdown on a free patch of canvas roughly above the first artboard at viewport (640, 320).
   - Move through ~24 points tracing a closed loop (~120 px diameter), ending near the start.
   - Pointerup.
   - Assert: a single `<path data-tool="pen">` exists under `.dc-annot-svg`.
   - Assert: `vector-effect="non-scaling-stroke"` attribute present (stroke stays pixel-thick under CSS zoom).
   - Assert: stroke color = `#d63b1f` (default palette slot 0).
   - Wait 300 ms (PUT debounce 200 ms + slack).
   - GET `/_api/annotations?file=.design/ui/Canvas%20Viewport.tsx` → body is non-empty, contains `data-mdcc-annotations="1"` AND `data-tool="pen"`.
   - File on disk `<designRoot>/ui-canvas_viewport.annotations.svg` exists, bytes > 200.

4. **Switch to a non-default color and draw a rectangle.**
   - Click the 4th swatch in the AnnotationsChrome (`aria-label="Color #1d6cf0"`).
   - Assert that swatch has `aria-pressed="true"`.
   - `keydown R`. Assert active tool = `rect`.
   - Pointerdown at (900, 400), drag to (1080, 540), pointerup.
   - Assert: a `<rect data-tool="rect" stroke="#1d6cf0">` exists, with `width ≥ 4` and `height ≥ 4` (meets `isStrokeMeaningful` threshold).
   - Negative-area normalization: from (1080, 540) drag back to (900, 400) in a separate stroke — width/height still positive after normalization.

5. **Arrow tool draws a stroke with a head triangle.**
   - `keydown A`. Assert active tool = `arrow`.
   - Pointerdown at (300, 600), drag to (500, 600), pointerup.
   - Assert: a `<g data-tool="arrow">` exists, containing `<line>` + `<polyline>`. The polyline's `points` attribute has 3 comma-separated pairs (left wing, tip, right wing).

6. **Pan/zoom interactions in draw mode (current Phase 5 limitation — regression guard).**
   - With Pen active (`keydown B`), ctrl+wheel zoom in over the canvas center.
   - **Expected today (Phase 5):** zoom is BLOCKED — the SVG claims wheel events. Assert that `useViewportController.viewport.zoom` did NOT change. _This is the explicit Phase 5.1 entry point_ — the scenario records the limitation so Phase 5.1 can flip the assertion to "zoom works in draw mode."
   - Switch to Move (`keydown V`). Ctrl+wheel zoom — assert zoom now changes. (Regression guard against breaking Move-mode viewport.)

7. **Eraser removes a stroke.**
   - `keydown E`. Assert active tool = `eraser`. Cursor = `cell`.
   - Pointerdown roughly on the rect drawn in step 4 (centre of its top edge, e.g. (990, 400)) and release without moving.
   - Assert: the matched `<rect data-tool="rect">` is removed from the DOM (count of `<rect data-tool="rect">` decreases by 1).
   - Wait 300 ms.
   - GET annotations → rect no longer present in the response body.
   - **Drag-erase** — pointerdown over the arrow stroke and drag along its shaft. Assert the arrow `<g>` is removed.

8. **Presentation toggle (Shift+P) hides without persisting.**
   - `keydown V` (back to Move).
   - Snapshot: pen circle still visible (`.dc-annot-svg path[data-tool="pen"]` rendered).
   - `keydown Shift+P`.
   - Assert: `.dc-annot-svg` has `display: none` (or `visibility: hidden` — either acceptable; the layer's `visible` state flips).
   - GET annotations → unchanged from the post-step-7 body (no write).
   - `keydown Shift+P` again → layer visible again.

9. **Help sheet (Cmd+/) opens + Esc dismisses.**
   - `keydown Cmd+/`.
   - Assert: a native `<dialog open class="dc-annot-help">` is in the DOM, focus moved into it.
   - Assert: the dialog renders all 8 shortcut rows (B, R, A, E, V, Esc, Shift+P, Cmd+/) — verify by `dialog.querySelectorAll('dt').length >= 8`.
   - `keydown Escape`.
   - Assert: dialog removed from the DOM (or `open` attribute cleared).
   - Repeat with backdrop click — open via Cmd+/, click the dialog's outer area (not the inner card), assert closes.

10. **Reload restores all strokes.**
    - Reload the iframe (or switch tab away + back).
    - Wait for AnnotationsLayer's mount-time GET to complete.
    - Assert: the pen circle is rendered (count of `<path data-tool="pen">` ≥ 1).
    - Assert: stroke colors match — `path` is `#d63b1f`, anything remaining post-eraser keeps its color.
    - Active tool resets to `move` (provider default).

11. **Cross-canvas isolation — Smoke TSX has its own file.**
    - Open `Smoke TSX.tsx`.
    - Assert: `.dc-annot-svg` has 0 stroke elements (file does not exist yet on disk).
    - Press B + draw a single pen stroke.
    - Wait 300 ms.
    - Assert: `<designRoot>/ui-smoke_tsx.annotations.svg` exists, contains the new stroke; `<designRoot>/ui-canvas_viewport.annotations.svg` is unmodified from step 10.

12. **Cmd+click in Pen mode falls through to element selection (escape hatch from Phase 5).**
    - Back in Canvas Viewport.tsx, `keydown B`.
    - Cmd+click on a real artboard child element (e.g. a button or a heading inside an artboard).
    - Assert: a selection halo appears on that DOM element (Phase 4.1 `.dc-cv-halo--selected` rendered).
    - Assert: NO new stroke was started in the annotation layer (count of strokes unchanged).
    - Confirms input-router still claims Cmd+click for select even while a draw tool is active.

13. **Esc returns to Move + clears in-progress drawings.**
    - `keydown B`. Start a pen stroke at (400, 400) but DO NOT release.
    - `keydown Escape`.
    - Assert: active tool is `move`; the in-flight stroke is discarded (no orphan stroke ends up in the DOM or the saved SVG).
    - Pointerup at (450, 400) — assert still no new stroke created (the gesture was canceled).

## Counter-deltas (parity signal)

Tracked across the run; the report's parity section asserts identical values across non-skipped platforms.

| Counter | After step | Expected delta |
| --- | --- | --- |
| `Canvas Viewport.tsx` stroke count | 3 | +1 (pen circle) |
| `Canvas Viewport.tsx` stroke count | 4 | +1 (rect) |
| `Canvas Viewport.tsx` stroke count | 5 | +1 (arrow) |
| `Canvas Viewport.tsx` stroke count | 7 | −2 (rect + arrow erased) |
| `Smoke TSX.tsx` stroke count | 11 | +1 |
| Annotations SVG file count under `<designRoot>` | end | exactly 2 (`ui-canvas_viewport.annotations.svg` + `ui-smoke_tsx.annotations.svg`) |

## What we are NOT asserting

- **Multi-color round-trip beyond default + slot 4.** Other palette slots are exercised by the unit test (`test/annotations-layer.test.ts`); the scenario doesn't need to repeat.
- **Help-sheet visual diff.** The dialog is styled minimally; we assert its structure (rows, focus) but don't pixel-diff.
- **Stroke smoothness / point count.** Pen path quality is implementation-defined; we only assert the path exists and is hit-testable.
- **Phase 5.1 affordances** — annotation selection / move / contextual toolbar / ellipse / fill / text-in-shape / menubar wiring — those land in Phase 5.1 and get their own scenario or extension to this one.

## Recommended follow-ups

- After Phase 5.1 lands: flip step 6 from "zoom blocked" to "zoom works in draw mode" + add steps for selection-restyle-move, ellipse, fill, text-in-shape, menubar postMessage round-trip.
- Add testIDs (`data-testid`) on the AnnotationsChrome swatches + the AnnotationsLayer SVG itself — currently we rely on class + ARIA selectors; testIDs would harden the runner against any future class-name rename.
- The mobile-degraded notes (Shift+P / Cmd+/ unavailable) should ideally surface a touch-affordance for the same actions in Phase 5.1's chrome redesign.
