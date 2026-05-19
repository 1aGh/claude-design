# canvas-artboard-drag

**Persona:** Designer reviewing many states of one screen wants to group related artboards spatially without editing JSX.
**Canvases under test:** `.design/ui/Canvas Viewport.tsx` (8 same-size artboards in the default 3×3 grid), `.design/ui/Smoke TSX.tsx` (single-artboard edge case), `.design/ui/Docs Site.tsx` (larger 1440×900 artboards — verifies snap math at non-default size).
**Hypothesis:** Phase 4.2 adds drag-to-reposition on the artboard chrome (label strip + outer border) gated by the Move tool. Inner content stays click-through for Cmd+select. Multi-select drags as a rigid group. Snap engages to a 40 world-unit grid + sibling edges/centers within 8 world-units, visualised with 1 px `--accent` guides. Alt disables snap. Drop persists `{ id, x, y }` (position-only, JSX width/height authoritative). Phase 4 label-click pan-to-focus stays intact for clicks below the 4 px drag threshold.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | degraded — touch drag fires but snap guides hidden (touch coords too imprecise for 8-unit snap tolerance); position commits still work |

## Preconditions

- Dev server running (`bun plugins/design/dev-server/server.ts --root . --port 4399`).
- `Canvas Viewport.meta.json` has no `layout.artboards[]` entries OR matches Phase-4 defaults so the synthesized 3×3 grid is the starting layout.
- Active tool resets to `move` on canvas open.

## Steps

1. **Open Canvas Viewport.tsx.**
   - Capture full-page screenshot.
   - Assert Move tool active in the palette.
   - Assert no `.dc-snap-guide` divs in the DOM (no drag in flight).

2. **Hover an artboard label in Move tool → cursor changes to `grab`.**
   - Pointer over CV-03's label strip without clicking.
   - Assert computed `cursor` on `.dc-artboard-label` is `grab` (CSS rule `.dc-canvas[data-active-tool="move"] .dc-artboard-label`).
   - Switch to Hand tool (press H) — cursor on the label becomes `grab` from the universal hand-mode override (existing behavior, regression guard).
   - Press V to return to Move.

3. **Click-without-move falls through to Phase 4 label-click pan-to-focus (regression guard).**
   - Pointerdown on CV-03's label, immediately pointerup (cumulative move < 4 px screen).
   - Assert: the viewport animates to fit CV-03 (`useViewportController.jumpTo(CV-03)` fires). `_active.json#viewport.x/y/zoom` settles to the per-rect fit values within ~250 ms.
   - Assert: no `dc-artboard-ghost` ever rendered (no drag started).
   - Assert: `Canvas Viewport.meta.json` unchanged.

4. **Drag CV-03 ≥ 4 px → ghost follows cursor, original is muted.**
   - Pointerdown on CV-03's label; move pointer 200 px right at zoom 1.0.
   - Assert: `.dc-artboard.dc-dragging` class added to CV-03's original `<article>` (opacity 0.3 via engine CSS).
   - Assert: a `<div class="dc-artboard-ghost">` exists inside `.dc-world` at the new world-coord position (opacity 0.5, contains the label text only — empty body).
   - Assert: `pointer-events: none` on the ghost (it doesn't intercept pointer input).

5. **Snap to sibling edge during drag.**
   - Continue dragging CV-03 horizontally until its left edge is within 8 world-units of CV-02's right edge.
   - Assert: a `<div class="dc-snap-guide">` appears with `position: fixed`, 1 px wide, `background: var(--accent, …)`. It spans the vertical union of CV-02 + CV-03's heights.
   - Assert: the ghost's `left` snaps to (CV-02.right) in world coords.

6. **Alt disables snap mid-drag.**
   - Hold Alt while continuing to drag.
   - Assert: all `.dc-snap-guide` elements removed from the DOM.
   - Assert: the ghost follows the raw cursor (no snap applied).
   - Release Alt while still dragging.
   - Assert: guides reappear on the next pointermove.

7. **Drop commits position-only to meta.**
   - Pointerup with CV-03 snapped to CV-02's right edge.
   - Assert: ghost element removed.
   - Assert: CV-03's `<article>` `style.left` updated to the snapped world coord.
   - Assert: `Canvas Viewport.meta.json` re-read. `layout.artboards[]` entry for `CV-03` is exactly `{ id, x, y }` — no `w`, no `h`.
   - Assert: untouched entries (CV-01, CV-02, …) still match their pre-drag positions; their `w`/`h` (if present from Phase 4 defaults) remain untouched.

8. **Reload → positions restored.**
   - Reload the iframe.
   - Assert: CV-03 renders at the dragged position (read from meta).
   - Assert: every other artboard renders at its pre-drag position.

9. **JSX width remains authoritative.**
   - With CV-03 still at its new position, edit `Canvas Viewport.tsx` to change CV-03's `width={1280}` to `width={600}`.
   - Wait for HMR.
   - Assert: CV-03 renders at the new 600 px width AT the dragged position. JSX wins for size; meta wins for position.
   - Revert the edit.

10. **Multi-select drag preserves relative offsets.**
    - Cmd+click on CV-03's label area (to select that artboard root — selection-set entry where `artboardId === "CV-03"`).
    - Cmd+Shift+click on CV-05 and CV-07 to add them.
    - Pointerdown on CV-03 (leader), drag by world (+200, +50). Hold Alt to disable snap so the math is exact.
    - Assert: three ghosts render — leader + two followers — each at `(start + (200, 50))`.
    - Assert: original three artboards all carry `.dc-dragging`.
    - Pointerup. Assert: `Canvas Viewport.meta.json#layout.artboards` reflects all three new positions, each as `{ id, x, y }`.

11. **Drag in Hand tool does nothing (no-op).**
    - Press H.
    - Pointerdown + drag over CV-04's label.
    - Assert: world pans (existing Hand-tool behavior). No `.dc-artboard-ghost` ever renders.
    - Assert: `Canvas Viewport.meta.json#layout.artboards` unchanged.

12. **Drag in Comment tool does nothing (no-op).**
    - Press C.
    - Pointerdown + drag over CV-04's label.
    - Assert: the comment composer opens for the underlying element (or no-op if the chrome itself isn't comment-attachable). No drag ghost. Layout unchanged.
    - Press V to return to Move.

13. **Single-artboard canvas — drag still works, no sibling snap.**
    - Open `Smoke TSX.tsx`.
    - Drag the single artboard by world (+30, +30).
    - Assert: only grid-snap guides appear (no sibling candidates exist).
    - Drop. Assert: `Smoke TSX.meta.json#layout.artboards` has one position-only entry.

14. **Larger artboards — snap tolerance still 8 world-units.**
    - Open `Docs Site.tsx`.
    - Drag artboard 2 until its left edge is within 8 world-units of artboard 1's right edge.
    - Assert: snap guide appears. Tolerance is the same regardless of artboard size (DDR-028: tolerance is in world units).

## Success criteria

- 0 console errors during drag, snap, drop, reload.
- The 4 px click-vs-drag classifier is robust: every test that pointers down + ups with cumulative client-px move < 4 still fires the label's pan-to-focus (no false positives).
- Persisted meta entries from a Phase 4.2 drag never carry `w` or `h`.
- Snap guides are 1 px wide / 1 px tall (axis-dependent) in `--accent`.
- Multi-drag preserves relative offsets to floating-point precision.
- Tool gating: drag only in `move`; `hand` and `comment` continue to own their pointerdown semantics.

## Counter deltas

- `Canvas Viewport.meta.json#layout.artboards` grows entries for each dragged artboard. Pre-existing entries with `w`/`h` (Phase 4 default-grid snapshots) keep their fields until next drag overwrites them.
- `_active.json` is unchanged by drag — drag does not mutate the selection set.

## Known limitations

- web-mobile: snap guides intentionally hidden — touch coords are too imprecise for 8-unit world-tolerance to feel natural. Drag + commit still work; user just won't see alignment lines.
- iOS/Android native: N/A (canvas runs in browser only).
- No undo/redo for drag commits — relies on git history of `<canvas>.meta.json`.
- Pixi renderer parity: deferred (no Pixi runtime path in canvas-lib yet; DDR-024 plumbed bundle only).
