---
"@1agh/maude": minor
---

Exports now run in the background with live progress, instead of blocking the dialog until the render finishes.

- `POST /_api/export` still works exactly as before (byte-for-byte, no CLI changes needed) — it now just wraps a background job internally.
- A new menubar "Exports" button shows a running/queued count, a toast on start and completion (progress bar for multi-artboard `canvas-as-separate` exports, indeterminate spinner otherwise), and a panel listing every export with Download/Save actions. Both dialogs (menubar + in-canvas) close immediately on submit.
- Multiple exports can run concurrently (default cap 2) — a quick PNG no longer has to wait behind a slow PDF/video render.

Also fixes a real correctness bug: `canvas-as-separate` (multi-artboard) exports in PNG/PDF/SVG/HTML/PPTX could scramble content — each per-artboard capture pinned the artboard's position for cropping but never restored it, so earlier artboards stayed stacked at the origin and bled into later captures. All 5 render shims now save and restore each artboard's position around its own capture.
