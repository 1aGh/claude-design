# maude-mark — plan (LOCKED design, execution-only)

**Type:** logo (brand mark). **viewBox:** `0 0 32 32`. **grid:** 1 (pixel-snap).
**Color:** ONE colour — every fill/stroke = `currentColor` (monochrome; lockup tints later).
**a11y:** title "maude" / desc "maude mark — a selected node with an agent spark".

## Concept (do NOT redesign)
A SELECTED NODE: rounded-square frame (the node) + selection handles at the
corners. Three corners = square grips; the TOP-LEFT corner = a 4-point spark
(the AI agent). "Select a node and iterate on it with an agent."

## Primitive list + z-order (paint back→front)
1. **Frame** — rounded square, centered on 32×32. Stroke only, `fill="none"`,
   `currentColor`, weight ~2.6. This is the dominant element (squint → a square).
   Reference: x8 y8 w16 h16 r~4. Drawn FIRST so handles overlap it like real grips.
2. **3 square handles** — rounded squares ~6.4², r~1.8, FILLED `currentColor`,
   centered on the frame's OUTER corners: TR, BL, BR (just outside the corner).
3. **Spark (top-left, the agent)** — 4-point star, FILLED `currentColor`,
   centered on (6,6). Optically mass-matched to the square handles via
   equal-AREA: a 4-point star of bounding radius R has far less area than a
   square of side s, so R is grown until star area ≈ square area, then
   `centroidCenter` seats it exactly on (6,6). Concavity moderate (a chunky
   spark, NOT a thin sparkle) so it still reads as a grip-sized mass at 16px.

## Composition / hierarchy
- One dominant focal: the frame (squint test → "a selected box"). Handles are
  secondary accents at the corners. Spark is the single distinguishing detail.
- Symmetric/static on purpose (it's a corner-grip motif). Check 18/19 are SOFT
  and a deliberately-static grip lattice is the correct read here.
- HARD floor: 16px legibility, single-color flatten, grid-1 snap, WCAG (mono
  currentColor inherits text color → contrast = whatever the host gives; on the
  DS accent/dark it's the same shape mass, verified by flatten not by hue).

## Optical refinements the candidates explore (ONLY axis of difference)
- **C1 — reference-faithful, balanced grips.** Frame stroke 2.6, handles 6.4²
  r1.8, spark equal-area-matched (R derived), moderate concavity (inner = 0.42·R).
  Frame corner radius 4. Handles seated with a tiny outward bias so they read as
  *outside* grips. This is the safe, on-spec execution.
- **C2 — slightly chunkier spark + tighter handles for 16px.** Frame stroke 2.6,
  handles 6.2² r1.6, spark grown ~+8% beyond equal-area (R larger, inner 0.40·R)
  so the agent corner clearly out-masses the plain grips and survives the favicon
  downscale; frame corner radius 4.2. Tests whether a heavier spark / lighter
  grips reads more intentionally small.

Both candidates are the SAME concept; they differ only in spark mass vs handle
mass, stroke weight nuance, corner radius, and seat bias. Pairwise-rank →
keep-best. If 3 handles + spark is mush at 16px, fall back to a documented
minimal variant (node + spark-corner only) and report honestly.

## Favicon fallback (only if 16px fails)
Minimal: frame + spark at top-left + ONE diagonal opposite grip (BR), dropping
TR/BL — keeps the "selected + agent" read with less corner clutter at 16px.

---

## Round-3 single-fix (2026-06-04) — corner-element family consistency (critic 24/25)

LOCKED concept unchanged. ONE fix: the spark was oversized + detached (old c3
R=5.4, K=0.46 → bbox 10.8, linear ratio **1.69×** the 6.4 squares, area 1.31×;
seated at (5.4,5.4) so it floated to the (0,0) edge). It read as a separate
ornament, not the 4th corner grip.

Fix (base = c3 build; change ONLY the spark):
- Shrink: outer R 5.4 → **4.0** → bbox extent 8.0 → **spark_handle_linear_ratio
  = 8.0/6.4 = 1.25** (≤ target).
- Keep inner/outer ratio ~**0.65** (brief), symmetric 8-vertex on two exact radii.
- Re-seat to the SAME diagonal corner offset as the square grips: handles sit ~2
  units diagonally outside the frame corner (frame corner (8,8) → handle center
  (6,6)). So center the spark at **(6,6)** via `centroidCenter` (optical centre).
- Focal-by-SHAPE (4-point star), not by size. A bbox-8 star is visually LIGHTER
  than a filled 6.4 square (concave arms), so equal-bbox = mass-matched.

Candidates (only axis = inner-arm chunkiness):
- **C-fixA** R=4.0, K=0.65 → linear 1.25, area ≈1.02× (clean mass-matched star).
- **C-fixB** R=4.0, K=0.72 → linear 1.25, area ≈1.125× (chunkier arms; "modestly
  larger in area" per brief, still unmistakably a star).
Pairwise-rank at 16/48/256 → keep-best. spark_handle_linear_ratio target ≤ ~1.25.
