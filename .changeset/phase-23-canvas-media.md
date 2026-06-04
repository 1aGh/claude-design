---
"@1agh/maude": minor
---

Canvas media: drop images + paste link chips (Phase 23)

- **Drop or paste images onto the canvas** — drag a `.png`/`.jpg`/`.gif`/`.webp` from Finder, or `Cmd+V` a clipboard image, straight onto the canvas. It uploads to `<designRoot>/assets/<sha8>.<ext>` and renders as a movable / resizable annotation stroke that persists in the canvas's `.annotations.svg`.
- **Paste a link → a tidy preview chip** — drop or paste a URL and it renders as a client-only card (link glyph + domain + title), no server fetch and no external favicon (the dev-server stays zero-egress). Click-to-open from the selection toolbar. You don't need to type `https://` — a bare `example.com` is normalized; `javascript:`/`data:` are rejected.
- Media intake is **paste/drop-only** (no toolbar buttons). Image + link are new annotation strokes — they move, resize, and undo with the existing machinery.
- **Security (DDR-088):** a new `POST /_api/asset` binary write reachable from the canvas origin is gated by magic-byte sniffing (SVG rejected), a 10 MB per-file cap, content-addressed names, a traversal guard, a per-session write budget, and `maxRequestBodySize`. The annotation-SVG sanitizer now allows an `<image>` href but ONLY a relative `assets/<sha8>.<ext>` path — every external / `data:` / `javascript:` / `..` href is still stripped.
