---
"@1agh/maude": patch
---

Fixed local whisper subtitle model downloads (Settings → Local subtitle models) failing with "model download redirected off huggingface.co (cas-bridge.xethub.hf.co)" — Hugging Face now serves some model blobs through its newer Xet CDN, which the download's host allowlist didn't recognize.
