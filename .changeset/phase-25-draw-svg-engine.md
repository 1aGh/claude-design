---
"@1agh/maude": minor
---

**`/design:draw` — principle-grounded SVG generation for the design plugin.** A new command + geometry engine that draws production-grade vector marks, illustrations, diagrams, and backgrounds as *code* (the agent specifies intent; deterministic TypeScript computes the coordinates), then verifies them visually and iterates.

- **Geometry engine** (`plugins/design/dev-server/draw/`): grid-snapped primitives, PCHIP splines, A\* connector routing, optical corrections, OKLCH + WCAG/APCA color, a single-source serializer that emits matching SVG **and** JSX, and an SVGO optimize/validity gate.
- **Composition layer**: armatures (rule-of-thirds / rabatment / dynamic-symmetry), VME visual-balance + dominance metrics, Cohen-Or colour-harmony, organic `blobPath` — so generation composes on a scaffold instead of scattering randomly.
- **Brush / engraving layer**: variable-width brush strokes, scatter brushes, dry-brush/grain texture, hatch / cross-hatch line shading, form-following contour lines, and graded stipple.
- **Agents + verify loop**: a `draw-agent` (plan → generate → render via the `DrawProof` size-ladder → rank → keep-best → critique) and an independent `draw-critic` scored on measurable thresholds (value range, harmony distance, balance, dominance, APCA contrast). Auto-routed from `/design:new`, `/design:edit`, and the critic panel; `/design:setup-ds` can seed organic DS artifacts.
- New `maude design draw-build` / `draw-proof` / `svg-optimize` dev-tooling verbs. Adds SVGO as a dev-server dependency.
