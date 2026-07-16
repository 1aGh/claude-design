---
"@1agh/maude": minor
---

Video analysis now understands a clip's dynamics instead of screenshotting at a blind frame rate. A new `maude design smart-frames` extractor (skill `footage-keyframes`) picks keyframes at real scene cuts, semantic action beats, and the true first/last frame — three auto-detected tiers that degrade gracefully: a local Gemma-4 MLX scout (opt-in, Apple Silicon) → ffmpeg scene-detection (the default) → the existing Chromium extractor (zero-dep floor), so nobody is forced to download a model. The footage-analyst and `/design:reel` now use it, and a new one-shot `/design:video-analyze` command analyzes a clip end to end — picture AND sound — folding a whisper transcript into the result. Studio Settings gains a "Video" section to choose the engine and one-click-download the optional Gemma model (gated on the mlx-vlm runtime being installed). `ffmpeg` and `mlx-vlm` are new soft dependencies; without them the extractor falls back automatically.
