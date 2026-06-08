# Sign-off · Scene 40 — /design:edit

- **Signed off:** 2026-06-08 (iter 0)
- **Composition:** `v4-40-design-edit` · 270f @ 30fps (≈9 s) · 1920×1080
- **Source:** `src/scenes/v4/40-design-edit/index.tsx`
- **Render:** `out/v4/scene-40.mp4` · still `out/v4/s40-iter0-late.png`
- **Role:** proof
- **Signature:** split-screen — the edit diff on the left, the same canvas reloading on the right.

## Rubric

| Line | iter0 |
|---|---|
| Left edit diff | 5 |
| Right edit applied in place | 5 |
| Signature — split-screen diff + reload | 5 |
| Screenshot-worthy frame | 5 |
| Caption present | 5 |
| **Average** | **5.0 PASS** |

## Iteration log

- **iter0** — left: `/design:edit "…"` + Hero.tsx diff (−padding 96 / +padding 56,
  −2 meta rows). Right: reload flash → canvas with "✓ reloaded" badge, tightened
  hero, meta chips. Passed first pass at 5.0.
