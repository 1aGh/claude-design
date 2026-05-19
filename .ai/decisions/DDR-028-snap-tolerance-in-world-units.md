# DDR-028: snap tolerance is in world units, not screen pixels

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, canvas-lib, phase-4.2, snap, zoom, ux-math
- **Related:** [DDR-027](./DDR-027-artboard-size-jsx-authoritative.md), [Phase 4.2](../plans/phase-4.2-artboard-free-move.md)

## Context

Phase 4.2 ships drag-to-reposition for artboards on an infinite canvas. Drag math is straightforward: convert pointer delta (screen px) to world delta by dividing by `viewport.zoom`, then offer to snap the proposed world rect to grid + sibling rects.

Snap needs a tolerance — a distance threshold below which the proposal "sticks" to the candidate. The choice has two plausible flavors:

1. **Screen pixels.** Snap engages when the proposed coord is within N screen pixels of a candidate. Feels like "always 8 px snap zone," regardless of zoom. Mirrors how some 2D editors behave (notably anything where snap is implemented by checking pointer distance to a candidate's *visible* location).
2. **World units.** Snap engages when the proposed coord is within N world units. At zoom 1.0, snap zone = N visible pixels. At zoom 0.5, snap zone = N/2 visible pixels. At zoom 2.0, snap zone = 2N visible pixels.

Both are mathematically defensible. The question is which produces a better tactile feel at the canvas scales Phase 4.2 targets (~1000–3000 world units between artboard edges, zoom range 0.1–4.0).

Quick mental simulation with N = 8 in each variant:

- **Screen-px @ zoom 0.1** (far-zoomed-out, fit view of 10 artboards): user nudges a 1280×820 artboard. A screen-px 8 zone is **80 world units** wide. The artboard sticks to the nearest candidate from 80 units away — feels overly sticky; the user can't place freely.
- **Screen-px @ zoom 4.0** (zoomed in for pixel-precise work): screen-px 8 = **2 world units**. Snap zone is smaller than the artboard's grid step (40 world units). The user can't hit a snap line without millimeter-precise mousing.
- **World-units @ any zoom:** snap zone is constant in the world. At fit-out, the *visible* snap zone shrinks; users naturally drag in larger gestures at low zoom anyway, and the snap "wants" to bind sibling artboards to a shared world layout, not to whatever happens to be N pixels away on screen. At fit-in, the visible snap zone expands, which is what high-zoom precision work needs (more room for the alignment to "catch").

The world-units variant lines up with the *intent* of the snap: align artboards to a shared world coordinate system. The screen-px variant lines up with the *mechanism* of pointer input. World-units wins on intent matching.

## Decision

**Snap tolerance is expressed in world units. `useSnapGuides.computeSnap(proposed, others, opts)` accepts `opts.tolerance` and treats it as a world-coord delta. Phase 4.2 defaults: `gridSize = 40`, `tolerance = 8` (both world units). The hook never reads `viewport.zoom`; that conversion happened upstream in the drag controller before `computeSnap` is called.**

Concretely:

1. **`computeSnap` signature** (`use-snap-guides.tsx`):
   ```ts
   computeSnap(
     proposed: Rect,                    // world coords
     others: Rect[],                    // world coords
     opts: { gridSize: number; tolerance: number; disabled: boolean }
   ): SnapResult
   ```
   `proposed.x`, `proposed.y`, `gridSize`, and `tolerance` are all in the same coordinate space (world units). The function is zoom-agnostic.

2. **Drag controller** (`use-artboard-drag.tsx`) converts pointer delta to world delta with `world = screenΔ / zoom` before computing the proposed rect, so `computeSnap` always sees world coords.

3. **Defaults are tokens, not magic numbers.** `DEFAULT_GRID_SIZE = 40` and `DEFAULT_SNAP_TOLERANCE = 8` are exported from `use-artboard-drag.tsx` and referenced by callers (currently just `DCArtboard`). When a future canvas wants tighter snap (precision DS work) or looser snap (high-density layouts), the override path is a per-canvas hook prop, not a magic-number edit.

4. **Tolerance ratio: 1:5 of gridSize.** 8/40 = 0.2 — meaning each grid line "claims" 20 % of the gutter on each side. Adjacent artboards 1280 wide on a 40-unit grid have ~1240 units of free travel before they hit the next snap candidate. Feel is loose enough that users don't fight the snap when they want free placement.

5. **Hard rule, not a per-tool toggle.** The Alt modifier disables ALL snap (grid + sibling). There's no "screen-px snap mode" knob; world-units is the only mode.

## Alternatives considered

### A — Screen pixels (8 px snap zone, divide world tolerance by zoom)

- **Pros:** Matches how a few popular editors model snap. Constant visible affordance.
- **Cons:** Snap feel degrades at zoom extremes (see Context numbers above). Worst at zoom 0.1 (snap zone covers most of a small layout — over-sticky). Couples the snap math to the live viewport zoom — `computeSnap` would need access to viewport state, which sacrifices the pure-function shape (and the unit-test surface that depends on it).

### B — Adaptive — switch between world-units and screen-px depending on zoom range

E.g. world-units for zoom ∈ [0.5, 2.0], screen-px outside. Switch silently.

- **Pros:** Best of both worlds in theory.
- **Cons:** Silent mode-switches surprise users. Two snap behaviors means twice the bugs and twice the explanation in docs. The zoom-extreme cases that motivate the switch are also where users probably *want* less or no snap (zoomed way out = laying out coarsely; zoomed way in = pixel-tweaking and snap is in the way).

### C — Same number, different unit semantics depending on a `tolerance.unit` field

Caller declares whether `tolerance` is `"world"` or `"screen-px"`. Hook normalizes internally.

- **Pros:** Configurable without rewriting math.
- **Cons:** Adds API surface (the `unit` field) for an option that has one obvious right answer at the scales Phase 4.2 targets. Configuration is not a substitute for taste.

The accepted decision (world-units, no toggle) is the smallest API surface that matches user intent at every zoom level the canvas supports.

## Consequences

- Snap feel is consistent at any zoom — predictable.
- `computeSnap` stays a pure function — no viewport state coupling, fully unit-testable.
- Future canvases at unusual world scales (e.g. component-library canvases at 1:1 of small UI elements) may want smaller defaults. Override via hook prop; document if a new use case justifies new defaults.

## Compatibility notes

- No prior snap behavior to migrate from — Phase 4.2 introduces the surface.
- The `gridSize = 40` default coincides with the existing canvas background grid line spacing (`background-size: 24px 24px` in `ENGINE_CSS`). They're not the same value — the visible 24 px grid is a CSS decoration, the snap grid is a math abstraction. Aligning them was considered but rejected: 24 px world units / artboard widths of ~1280 produces 53 candidates per artboard edge, far too noisy for snap math. 40 is sparse enough to be useful and dense enough that artboards align well at common layout offsets (multiples of 80 / 160 / 320).

## Research source

- Phase 4.2 plan T1 task spec: "Caller passes the *world* tolerance. Guide line length is min/max of the two rects' relevant axis."
- Mental simulation at zoom 0.1 / 1.0 / 4.0 with both variants (above).
- `tldraw` reference (open-source) uses world-units for snap, validating the intent-over-mechanism direction at the same canvas scale.
