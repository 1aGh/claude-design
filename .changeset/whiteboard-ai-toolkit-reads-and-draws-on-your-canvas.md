---
"@1agh/maude": minor
---

Add a full two-way AI toolkit for the whiteboard/annotation layer.

The design plugin's FigJam-style draw layer (stickies, shapes, connectors) is now a complete two-way AI surface, not just a read-only channel:

- New `maude design canvas-rects` geometry manifest resolves artboard AND element-level context in world coordinates, so an agent understands which UI element a sketched note is drawn over, and can place new notes/shapes without ever hand-computing a coordinate.
- `read-annotations --rects` adds that element context to reads.
- `annotate` gains `--in`/`--pin` (pin a note beside a specific button or element, with an automatic pointer arrow), a `--board` template engine (retro, kanban, social-media calendar, roadmap, brainstorm, checklist, user-flow — all auto-laid-out), and id-preserving `move`/`set-text`/`set-color` ops.
- A new `/design:board` command and `whiteboard` skill package the whole read-understand-author-verify loop end to end.
