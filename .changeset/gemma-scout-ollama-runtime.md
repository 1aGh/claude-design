---
'@1agh/maude': minor
---

Gemma scout is much easier to set up. The smart-frames `gemma` tier now runs on either of two local runtimes: **Ollama** (new — `ollama pull gemma3:4b`, no Python, vision-capable gemma3 tags auto-detected) or **mlx-vlm** (preferred when present — the benchmarked native-video path). The Settings → Video card shows copy/paste install commands for both (the mlx-vlm one now targets a Maude-managed venv, so it works on PEP 668 externally-managed Pythons) and re-probes automatically, unlocking itself once a runtime is installed. New env knobs: `OLLAMA_HOST`, `MAUDE_OLLAMA_MODEL`.
