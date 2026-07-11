# Task 2.7 feasibility spike — transformers.js whisper (word timestamps in the sidecar)

**Date:** 2026-07-11 · **Verdict: PASS → build approach B (zero-install WASM/JS whisper).**

The plan gated the one-click local-subtitle build on a spike (DDR-164 Open-Question 7):
in-process transformers.js whisper must produce word-level timestamps, at tolerable
speed + memory, running MAIN-origin / in the sidecar (not the untrusted canvas realm).

## Result (Node sidecar, `@huggingface/transformers` v3, `onnx-community/whisper-base_timestamped`, q8)

| Criterion | Measured | Gate |
| --- | --- | --- |
| Word-level timestamps | `hasWordTimestamps: true` — `"And" [0.22–0.52] "so" [0.52–0.84] "my" [0.84–1.2]…` | ✅ |
| Transcript accuracy | "And so my fellow Americans ask not what your country can do for you…" (JFK 11s clip, verbatim) | ✅ |
| Speed | 2.66× realtime (4.14 s for 11.0 s audio) | ✅ tolerable; show an ETA for long clips |
| Memory | ~676 MB peak RSS | ✅ fits |
| In-process, main-origin | Node/Bun via onnxruntime-node — no browser CSP surface | ✅ |

## Build notes (feed the DDR + the implementation)

1. **Must use a `_timestamped` model variant.** Plain `onnx-community/whisper-base`
   throws `Model outputs must contain cross attentions to extract timestamps` —
   word timestamps need the cross-attention export. Use `onnx-community/whisper-*_timestamped`.
2. **Model size default.** `base` (q8) is the sweet spot for the WASM/sidecar default
   (accuracy vs download size vs the 2.66× speed). Offer `tiny`/`small` in the size picker.
3. **onnxruntime-node teardown quirk.** A cosmetic `mutex lock failed` SIGABRT fires on
   process exit AFTER all output is produced — the shim must `process.exit(0)` cleanly
   once the SRT is written (the inference itself is unaffected).
4. **Packaging fork (the genuinely consequential decision — DDR-worthy).** transformers.js
   in Node defaults to **onnxruntime-node** (native `.node` binaries) — fast, but a heavy
   per-platform native dep that fights the `bun --compile` standalone-binary distribution
   (DDR-045) and bloats the npm tarball. Alternatives that avoid that: (a) transformers.js
   with **onnxruntime-web (WASM)** in the browser proof-canvas harness — mirrors the shipped
   `@imgly/background-removal` precedent (DDR-161) exactly, no native dep, but slower and
   in a browser context; (b) native **whisper.cpp + a managed model-download button** (the
   plan's fallback A) — fastest, but needs the binary. This fork is surfaced to the owner
   before the heavy dep ships to every user.

## Repro

`scratchpad/whisper-spike/spike3.mjs` (stereo→mono + 44.1k→16k resample; the earlier
garbled "[BIRDS CHIRPING]" run was a WAV-parse bug in the harness, not the model).
