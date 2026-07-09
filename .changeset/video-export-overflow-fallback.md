---
"@1agh/maude": patch
---

Video export (MP4/WebM) of complex video-comps no longer fails or hangs. A deeply-nested composition could overflow the one-pass audio renderer (`renderMediaOnWeb`); the export now falls back to frame-by-frame capture and produces a valid (video-only) file instead of erroring. Long renders also get a frame-count-sized time budget, so a 900-frame comp that legitimately takes ~9 minutes isn't aborted mid-render by the old fixed 5-minute cap (overridable via `MAUDE_EXPORT_VIDEO_TIMEOUT_MS`).
