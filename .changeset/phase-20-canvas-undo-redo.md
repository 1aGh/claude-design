---
'@1agh/maude': minor
---

**Canvas Cmd+Z / Cmd+Shift+Z** — per-canvas in-memory undo / redo stack in the dev-server iframe. Reverses drag, marquee batch-move, equal-spacing distribute, align, and annotation strokes (add / erase / translate / text). Per-iframe scope, ring-capped at 50, clears on external `.meta.json` edit. Viewport + selection intentionally NOT undoable (Figma convention). Toast HUD announces every operation via `aria-live="polite"`. See DDR-049.
