---
"@1agh/maude": minor
---

Annotations FigJam-parity polish v2 — the canvas annotation chrome now matches FigJam much more closely, per the 7-point brief.

- **One Shape tool** replaces the separate Rect (R) + Ellipse (O) buttons, with a kind switcher: square / rounded square / circle / diamond / triangle / triangle-down (the last three are a new on-disk `polygon` stroke). A bare tap drops a default-sized shape (FigJam "click to place"); a drag sizes it. `rect`/`ellipse` stay byte-identical on disk — no migration.
- **Full arrowhead vocabulary** — `none / line / triangle / triangle-outline / circle / diamond` selectable **per end**, plus line-type `straight / curved / elbow`. Geometry has a single source of truth (`canvas-arrowheads.ts`) shared by the serializer and the renderer, so on-disk and on-canvas forms can't drift.
- **Sticky notes** — always 1:1, a 10-tint muted/dim palette (slot 0 muted yellow), body text top-left, corner-radius switch removed. Fixes a latent bug where the per-selection toolbar painted sticky swatches from the ink palette instead of the paper tints.
- **Richer text controls** — named size presets (Small → Huge) + a numeric field (8–200), Bold, Strikethrough, and alignment, applied to standalone text, anchored text, and sticky bodies.
- **Ghost placeholder** preview while drawing, and a cohesive **Kenney CC0** cursor pack across every tool (24px, dark-glyph + white-halo so it reads on any background; text I-beam + sticky note authored to match).
- Custom tool cursors now show across the **whole** app shell (sidebar / top bar / canvas), not just inside the canvas.

Legacy `.annotations.svg` files round-trip byte-identical (two frozen canaries). Every new attribute serializes only when non-default. Security: the sanitizer allowlist gained `polygon`/`circle` and a glued-handler bypass was closed; arrowhead attrs are parse-clamped + escaped; and the app-wide cursor bridge resolves a trusted tool token (not an untrusted cursor string) so a synced canvas can't push an invisible/displaced cursor as a clickjacking aid (DDR-067 / DDR-054).
