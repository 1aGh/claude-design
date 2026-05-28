---
"@1agh/maude": patch
---

Design dev-server — the in-place comment tool now works on bare DS specimens, not just `DesignCanvas` UI canvases.

The comment subsystem (tool palette, overlay, drop routing, tool/selection providers) used to be mounted only by `DesignCanvas`. Bare DS specimens (`system/<ds>/preview/*.tsx`) have no canvas-lib envelope, so they had no comment tool at all. The comment layer is now **shell-owned**: the canvas mount harness (`_shell.html`) renders a single comment layer (new `mountCanvas` / `dist/comment-mount.js`) around any canvas default export, and `DesignCanvas` consumes the shell-provided providers instead of creating its own (so there's still exactly one `CommentsOverlay` per surface — no double-mount). In comment mode on a specimen you now get a hover-preview halo showing which element you're about to comment on, and the dropped pin anchors to that element. The comment layer lives only inside the canvas iframe (the outer app and gallery thumbnails stay uncommentable via `?comments=0`). See DDR-055.
