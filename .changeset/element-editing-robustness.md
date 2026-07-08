---
"@1agh/maude": minor
---

Bring Studio's element editing up to Figma/Webflow-grade direct manipulation.

- **On-canvas drag-resize** for elements (8 handles + rotate zones, Shift-lock aspect, Alt from-center) and artboards (free-hand resize), plus a live W×H/X,Y readout while dragging.
- **Structural editing**: delete an element (Del key / context menu), insert a new div/text/image, and insert a whole new empty artboard from a Desktop/Laptop/Tablet/Mobile preset — all Cmd+Z reversible via whole-file snapshot undo.
- **Richer Inspector knobs**: Position (with a constraints-style inset box), Transform, extra Typography rows, and a Media section (`object-fit`/`aspect-ratio`/`object-position`) — promotes DDR-104's deferred OUT-list into curated, live-preview controls.
- **Auto-open the Inspector on select** (only when no right panel is already open), **on-canvas padding/gap drag**, and a **shared-component scope badge** ("Local" vs "Shared · edits N places") so editing a reused component's inner element is never a surprise, with instance move/resize routed to stay local.
- **Editing works on design-system specimens**, not just UI canvases, and **image/video/background swap** via a built-in asset picker (authored `<img>`/`<video>` and annotation media alike).
- **Editor ergonomics**: keyboard nudge + tree traversal, Cmd+D duplicate, copy/paste style, multi-select align/distribute/tidy-up, deep-select + right-click "Select layer" for nested/overlapping elements, Alt-hover distance measurement, and a free-hand rotate handle.
- **Flex/auto-layout editor**: per-element Fixed/Hug/Fill sizing plus a grouped direction/wrap/distribution/gap/padding editor (CSS-Grid tracks are a separate follow-up plan).
- Fixed two camera bugs: moving an absolute element no longer resets the pan, and selecting an overflowing element no longer shifts the layout or reveals a phantom strip.
