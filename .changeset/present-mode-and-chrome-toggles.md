---
"@1agh/maude": minor
---

Presentation Mode + Minimap/Zoom View toggles for the studio canvas browser.

- **View ▸ Minimap** and **View ▸ Zoom controls** now hide/show the floating mini-map and the zoom pill independently, across every open canvas.
- **View ▸ Presentation Mode** (previously a stub) is now a real "artboards only" view — it hides the entire UI at once: the menubar, sidebar, and side panels, plus the in-canvas mini-map, zoom pill, tool palette, annotations, and comment pins. Get back to the chrome with **Esc** or the floating **Exit** pill. The canvas tool-palette's presentation button enters the same mode.

Presentation Mode is non-destructive — it overlays-hides chrome without touching your individual Minimap/Zoom/Annotations toggles, so exiting restores exactly what you had. Fail-closed sync/divergence warnings stay visible even while presenting, and an untrusted canvas can't blank an in-flight dialog. See DDR-117.
