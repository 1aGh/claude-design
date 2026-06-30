---
"@1agh/maude": patch
---

Inspector CSS edits, inline text rewrites, and custom HTML-attribute edits are now undoable with Cmd+Z (and redoable). Previously these direct in-canvas edits wrote the canvas source but were recorded by neither the undo stack nor the history snapshots, so they couldn't be reverted in-app — and a forwarded Cmd+Z would instead pop an unrelated layout/annotation step. Undo now works from the canvas, the Edit menu, and the inspector fields (Figma-parity).
