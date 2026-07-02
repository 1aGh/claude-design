---
"@1agh/maude": minor
---

Drag to reorder elements on a canvas. Grab an element and drop it on the top/left half of another to go above, the bottom/right half to go below, or the middle of a box to nest inside it — the layout reflows live while you hold, Figma-style, with the neighbours gliding into place, and Esc puts it back. Do the same from the Layers panel, which now mirrors the canvas both ways as you drag. Instances of the same reusable component (a board's columns, repeated cards) reorder too. Every move rewrites your `.tsx` source and undoes with ⌘Z / redoes with ⌘⇧Z. Keyboard: with the Layers panel focused, ↑/↓ walk the selection, Alt+↑/↓ move within the parent, and Alt+Shift+↑/↓ move across.
