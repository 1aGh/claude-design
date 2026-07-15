# DDR-178: Local whisper model downloads have no content-integrity check — accepted gap, tracked as a follow-up

**Status:** Accepted (deferred)
**Date:** 2026-07-15
**Tags:** dev-server, whisper, transcription, ssrf, supply-chain, security, follow-up

**Related:** DDR-164 (BYOK AI-media generation provider spine — original `downloadWhisperModel` feature + "ethical-hacker Finding 2" that added the redirect-host allowlist this DDR follows up on)

## Context

`apps/studio/generation/whisper-models.ts` downloads whisper.cpp GGML models (`ggml-tiny.bin`, `ggml-base.bin`, …) from a frozen `ggerganov/whisper.cpp` Hugging Face URL into a per-machine cache, for `maude design transcribe --provider whisper`'s local-subtitle feature.

While fixing an unrelated bug — Hugging Face migrated some blob storage to its newer "Xet" CDN (`*.xethub.hf.co`), which broke every download because the redirect-host allowlist only accepted `*.huggingface.co` (commits `73f413d2`…`e70bbe9f`, RCA at `.ai/logs/rca/issue-local-whisper-model-download-xet-redirect.md`) — the `/flow:done` review fan-out's `ethical-hacker` pass flagged a HIGH-severity, **pre-existing** gap while auditing the widened allowlist:

`downloadWhisperModel()` validates *who* served the bytes (frozen initiating URL + an allowlisted final-redirect host, per DDR-164 Finding 2) and *how much* (a per-chunk size cap at +20% of the expected size), but never validates *what* the bytes actually are. There is no hash pinned per model in `WhisperModelDescriptor`, and nothing hashes the downloaded `.part` file before the atomic rename. The file is then loaded directly by whisper.cpp's native, hand-rolled GGML deserializer (`whisper_model_load()`) and run with the host process's own privileges. That loader has a dated, format-matching crash report — [ggml-org/whisper.cpp#3807](https://github.com/ggml-org/whisper.cpp/issues/3807) (2026-05-12): unvalidated hyperparameters read straight from the model file are used as tensor dimensions, producing undefined behavior. The sibling `llama.cpp` GGUF parser has multiple recent CVEs in the same "hand-rolled deserialization of attacker-shaped file metadata" class, though those target a different file format whisper.cpp doesn't use — cited only as architectural analogy, not a directly applicable CVE.

The docstring above `downloadWhisperModel` frames "SSRF-safe" + "size-capped" as the complete security story for this download — which is misleading once you separate transport trust (who served it) from content trust (what it actually is). Widening the trusted-apex list was the moment this distinction became worth naming explicitly, even though the widening itself doesn't worsen the gap (both `huggingface.co` and `xethub.hf.co` are Hugging Face's own operated infrastructure, not self-service multi-tenant hosts — a bad actor can't get their own subdomain under either apex to redirect this fetch to).

**Attacker-reachability today:** low. Exploiting this requires either compromising `ggerganov/whisper.cpp`'s own HF repo or compromising HF's resolve/redirect infrastructure — neither of which this diff, or the reviewing agent, could trigger. This is a defense-in-depth gap, not a demonstrated live exploit.

## Alternatives considered

- **A. Do nothing now; record and defer.** Ship the Xet-redirect bug fix as scoped, track the integrity gap as an explicit follow-up. Keeps the bug fix small and reviewable; the gap is real but not newly introduced and not urgently attacker-reachable.
- **B. Add SHA-256 pinning now, as part of the same change.** `WhisperModelDescriptor` gains a `sha256` field (values are published on the `ggerganov/whisper.cpp` HF repo), `downloadWhisperModel` hashes the `.part` file before the atomic rename and rejects/deletes on mismatch. Closes the gap directly and — per the reviewer's own note — would let `ALLOWED_REDIRECT_APEXES` shrink in importance (the hash becomes the real boundary, not the host list). Real, scoped, low-complexity work, but expands a narrow redirect-bug fix into a new registry-schema + verification feature with its own test surface, decided without the owner having asked for it.
- **C. Downgrade/ignore the finding as out of scope.** Rejected — the finding is substantive (a memory-unsafe native parser downstream, a dated matching crash report) and leaving it fully unrecorded would violate the "no decision left unrecorded" discipline `/flow:done`'s review step exists to enforce, even though it predates this session's diff.

## Decision

We pick **Option A**, on the owner's explicit call after the finding was surfaced: ship the Xet-redirect fix (`73f413d2`, `e70bbe9f`) as-is, and record this DDR as the tracked follow-up rather than scope-creeping the bug fix into a hash-pinning feature.

**Recommended shape for the follow-up**, when picked up:
- Add a `sha256` field to each `WhisperModelDescriptor` in `WHISPER_MODELS` (values published on the HF repo).
- In `downloadWhisperModel`, hash the `.part` file (streaming, alongside the existing size-cap accounting) before `rename()`; on mismatch, delete the `.part` and throw — same error-handling shape already used for over-cap violations.
- Once digest-pinning exists, revisit whether `ALLOWED_REDIRECT_APEXES` needs to keep growing, or whether the docstring's security framing should shift to "content-verified" as the primary control and the apex allowlist as a secondary belt-and-suspenders check.

## Consequences

**Positive:**
- Kept the Xet-redirect fix small, reviewable, and shippable without delay for an unrelated hardening feature.
- The gap now has a paper trail — a future session (or a future security fan-out) won't have to rediscover it from scratch.

**Negative / trade-offs:**
- The gap remains open in the shipped code: a compromise of `ggerganov/whisper.cpp`'s HF repo, or of HF's own resolve/redirect path, could deliver a crafted `.bin` file that reaches whisper.cpp's native parser unverified. Low likelihood, non-trivial impact (native memory-unsafe parser, matching crash report on file).
- `ALLOWED_REDIRECT_APEXES` will need re-justifying (per DDR-176-style "N places must agree" discipline, this is a smaller version of the same pattern) each time a new apex is proposed, until content pinning exists to make the apex list a secondary control rather than the primary one.

## Revisit when

- Before or during any future work that touches `apps/studio/generation/whisper-models.ts` again — pick up the hash-pinning follow-up rather than re-deferring it a second time.
- If a third redirect apex is ever proposed for `ALLOWED_REDIRECT_APEXES`, treat that as a forcing function to implement content pinning first, per the reviewer's own note that pinning is "arguably a better long-term control than an ever-growing apex list."
- If whisper.cpp ships its own model-integrity verification upstream (some model-serving tools now support this natively), re-evaluate whether Maude needs to duplicate it or can defer to the upstream binary's own check.

## Linked
- Plan: —
- PRD: —
- RCA: `.ai/logs/rca/issue-local-whisper-model-download-xet-redirect.md`
- Supersedes: —
