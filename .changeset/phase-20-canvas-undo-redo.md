---
'@1agh/maude': minor
---

**Canvas Cmd+Z / Cmd+Shift+Z** — per-canvas undo / redo stack in the dev-server iframe. Reverses drag, marquee batch-move, equal-spacing distribute, align, and annotation strokes (add / erase / translate / text). Stack persists across canvas switches (keyed by canvas file path on `window.top.__maude_undo_stacks`), ring-capped at 50, cleared on external `.meta.json` edit. Viewport + selection intentionally NOT undoable (Figma convention). Annotation drag now coalesces into ONE undo record per pointerdown → pointerup gesture, not per pointermove tick. Toast HUD announces every operation via `aria-live="polite"`. See DDR-050 (revised twice during the same day's iteration loop; originally drafted as DDR-049 but renumbered after a same-day collision with the motion-one DDR).
