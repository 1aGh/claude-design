# Sign-off · Scene 00 — Cold open

- **Signed off:** 2026-06-08 (iter 1)
- **Composition:** `v4-00-cold-open` · 90f @ 30fps (≈3 s) · 1920×1080
- **Source:** `src/scenes/v4/00-cold-open/index.tsx`
- **Render:** `out/v4/scene-00.mp4` · stills `out/v4/s00-iter1-{early,mid,late}.png`
- **Role:** hook
- **Signature:** a caret pulses ALONE on the empty dotted void, then the wordmark types in left→right with the caret trailing as the insertion point; one presence cursor drifts in.

## Rubric (target avg ≥ 4.0, no line < 3)

| Line | iter0 | iter1 |
|---|---|---|
| Wordmark "maude" legible | 5 | 5 |
| Single cursor present | 5 | 5 |
| Zero chrome / empty void | 5 | 5 |
| Signature — caret pulsing on void | **2** | 5 |
| Screenshot-worthy frame | 4 | 4.5 |
| **Average** | 4.2 (FAIL — line < 3) | **4.9 PASS** |

## Iteration log

- **iter0** — caret was nested inside the wordmark opacity wrapper, so it never read as a caret on the void (hidden early, blink-phased mid/late). Signature line scored 2 → fail.
- **iter1 (structural)** — pulled the caret out of the wordmark wrapper; made it the opening beat (caret alone on void), then the wordmark types in via a max-width reveal with the caret as the trailing insertion point. Signature now 5. SIGN OFF.
