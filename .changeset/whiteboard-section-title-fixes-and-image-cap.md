---
"@1agh/maude": patch
---

Fix several whiteboard section-title bugs and raise the image upload cap.

- A section's title chip now stays a constant on-screen size at any zoom level, instead of shrinking to unreadable when zoomed out.
- Double-clicking a section (or sticky/shape) to rename it no longer also triggers the canvas's "fit to view" zoom.
- The rename editor now confirms on plain Enter (matching a native text input) instead of inserting a newline — Cmd/Ctrl+Enter is still reserved for multi-line standalone text notes.
- The rename editor's box now matches the read-only chip's background/padding/size, instead of rendering as a bare, tiny sliver of text mid-rename.
- Dragging multiple image/video/audio files from Finder onto a canvas now adds all of them in one drop, instead of only the first file (previously required dropping one at a time).
- The per-image upload cap is raised from 10 MB to 50 MB (env-overridable via `MAUDE_ASSET_MAX_IMAGE_BYTES`), matching the existing video/audio cap pattern.
