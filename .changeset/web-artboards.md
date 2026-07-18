---
"@1agh/maude": minor
---

Web artboards (`kind="web"`) get a flex-first authoring contract, a breakpoint chip that tracks the artboard's live width, and a "Duplicate at width…" action (right-click or the Inspector) that clones the artboard at Mobile/Tablet/Laptop/Desktop widths for reflow testing — a structural copy, not a linked variant. Grid containers also get a full CSS-Grid track editor: a new Inspector "Grid" section defines columns/rows with px/%/fr/em/auto/min-content/max-content units (including `fr` round-trip), an on-canvas gutter drag-resize overlay (Shift = resize both neighboring tracks), and a "Grid item" section for `grid-column`/`grid-row` cell placement. No new server-side write surface — both features ride the existing single-property edit-css lane. This is the third of the artboard-kind family (after Digital/Print/Web/Video foundation and print-ready artboards).
