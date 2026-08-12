---
'@1agh/maude': patch
---

A muted/degraded video export now looks visibly different from a clean one, and mp4/webm export gets an opt-in JPEG capture intermediate.

- **The "degraded export" pill actually reads as a warning now.** A CSS token typo (`--u-status-warning` instead of `--u-status-warn`) meant the Exports panel's "degraded" pill silently rendered in the same accent color as "running" — undercutting the whole point of flagging a muted or lower-quality export.
- **`--frame-format jpeg|png` (opt-in, default stays `png`)** on the frame-step video capture path — a lossy-but-faster screenshot intermediate for the fallback exporter, gated off for `--dump-frames` and GIF. No default behavior changes.
