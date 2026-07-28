# DDR-034: Comments overlay lives outside `.dc-world` as a screen-coord `position: fixed` layer

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** design, canvas-lib, comments, phase-6, react, css-stacking, z-index, figjam
- **Related:** [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md) (CSS zoom drives world scale), [DDR-026](./DDR-026-universal-canvas-input-grammar.md) (input router, capture-phase), [DDR-029](./DDR-029-annotation-overlay-portal-into-world.md) (annotations portal INTO world), [Phase 6](../plans/archive/phase-6-comments-presentation-export.md)

## Context

Phase 6 replaced the shell-side comment composer with an in-iframe overlay that owns pins + composer card + thread popover + @mention autocomplete. The plan originally specified the same shape as DDR-029 (Phase 5.1 annotations): **portal the overlay INTO `.dc-world` so CSS zoom + transform on the world scale every pin and popover uniformly with the artboards**. That's what shipped in the first execute pass.

Live dogfooding immediately surfaced four problems that the world-portal architecture caused, two of which are unfixable inside the architecture:

1. **Selection halo painted ON TOP of pins and thread popover.** `SelectionHalos` (canvas-shell.tsx) renders as a `position: fixed` sibling of `.dc-world` with `z-index: 5`. `.dc-world` declares `will-change: transform`, which forms its own stacking context. Inside that context the comments layer can set any z-index it wants, but **the whole `.dc-world` paints as a single unit at z-index `auto`** in its parent's stacking context — below the halos at z-index 5. There is no z-index value on `.cm-layer` that wins this comparison, because the comparison happens at the parent (`.dc-canvas`) level where `.dc-world` is just one absolute-positioned div with no z-index of its own.
2. **Composer and thread popover do not chase pan/zoom.** Their position is computed once at mount from `offsetWithinWorld(target, world)`. When the user pans the canvas, the target moves but the popover stays at its initial layout offset. Pins update via rAF; popovers do not. The fix in-world is to give every popover its own rAF loop reading `offsetWithinWorld` — feasible but redundant since the same data lives at the same rect via `getBoundingClientRect`.
3. **Pins scale with canvas zoom (24 px → 12 px at 50% zoom).** This was sold as a feature in the plan ("scales/zooms with the canvas") but in practice it makes the affordance unreadable at lower zoom and disproportionately large at high zoom. FigJam keeps pins fixed-size for exactly this reason — readability of the affordance is more important than visual consistency with the artboard.
4. **Composer / Save / Cancel buttons unclickable while in comment tool mode.** The input router (DDR-026) lives on `.dc-canvas` in capture phase. In comment mode it claims every click and calls `preventDefault + stopImmediatePropagation` to suppress native button behavior on artboard content. React `stopPropagation` on the composer card runs in bubble phase — too late. The composer's interactive descendants never see their clicks.

Problems 1 and 3 are properties of the world-portal architecture, not bugs in our composition: the stacking-context boundary at `will-change: transform` is intentional (the world transforms a lot, so the browser benefits from isolating it), and the zoom-scaling behavior is a side-effect of being inside the zoomed plane.

## Decision

**The comments overlay renders as a `position: fixed` sibling of `.dc-canvas`, NOT portaled into `.dc-world`.** Every pin and popover positions itself in screen coords by reading `target.getBoundingClientRect()` on every animation frame — the same pattern `SelectionHalos` / `HoverHalo` already use one level above.

Concretely:
- `.cm-layer` is a `position: fixed; inset: 0; pointer-events: none; z-index: 10` div rendered inline by `CanvasRouter` (no `createPortal`). It sits above `SelectionHalos` (z-index 5) in the root stacking context, below `ToolPalette` (no explicit z-index, painted later in DOM).
- `CommentPin`, `CommentComposer`, `CommentThread` each own a rAF loop that resolves their target via `screenRectFor(selector)` (live `document.querySelector` + `getBoundingClientRect`) and writes `style.left` / `style.top` directly to the DOM node via a `ref` — no React state churn per frame.
- The input router (`useInputRouter`) gets a new `isOverlayTarget(t)` helper that matches `.cm-composer, .cm-thread, .cm-mention-popup, .cm-pin`. `onPointerDown` / `onMouseDown` / `onClick` capture handlers return early when the target is inside the overlay, letting React's synthetic events reach the button handlers. This is the same shape as `isEditableTarget` — the router yields, React owns.
- For the SVG-logo-with-`pointer-events: none` case, `onDropComment` falls back through three lookups: `resolveHoverTarget(deep)` → `resolveHoverTarget(non-deep)` → `document.elementsFromPoint(x, y)` walked for a `[data-cd-id]` descendant inside `.dc-artboard-body`. The last layer specifically handles decorations that propagate `elementFromPoint` past the intended target.

## Consequences

### Wins

- **Z-index actually works.** Pins and popovers stack above halos by simple comparison; the halo at z-index 5, the comments layer at z-index 10 in the same stacking context. No `will-change` boundary to fight.
- **Pins stay 24 px at every zoom level.** Readability of the affordance is preserved at all zoom levels, matching FigJam's exact treatment.
- **Reusing the SelectionHalos pattern.** rAF + `getBoundingClientRect` is already proven in canvas-shell.tsx for hover halo, selection halo, and group bbox. Comments-overlay just mirrors it — three layers in the same architectural shape, predictable to debug.
- **The composer / thread / mention popup all share the same screen-coord positioning code (`screenRectFor`, `computeAnchor`, `computeThreadAnchor`).** No coordinate-system translation between pin and popover.
- **No `createPortal` dependency.** The Phase 5.1 portal hit a real `react-dom` bundle gap (see DDR-029 Snag 1). Comments avoid that surface entirely.

### Trade-offs accepted

- **Stored `Comment.bounds` are screen coords at capture time.** For an orphaned pin (target element deleted), the bounds anchor drifts when the user zooms — they were captured at zoom level X, replayed at zoom level Y. This is best-effort; users see the pin somewhere sensible rather than vanishing entirely. Live `screenRectFor(selector)` dominates when the target exists, which is the common case.
- **The overlay shares the iframe's root stacking context with several siblings (`SelectionHalos`, `HoverHalo`, `ToolPalette`, `GroupBbox`, `SnapGuideOverlay`).** Any future overlay added to canvas-shell must declare a z-index above 10 if it wants to render above the comments layer. The current ordering is documented in canvas-shell.tsx HALO_CSS + comments-overlay.css.
- **`SelectionHalos` still uses `position: fixed` outside `.dc-world` too.** Both layers share the same architectural pattern now. The only world-portal in canvas-shell stays the annotations layer (DDR-029) — which is correct because annotations ARE world-content (strokes drawn at world coords), while comments are UI affordances ABOVE the world.

### Reverses

This DDR explicitly does not generalize to "everything should live outside `.dc-world`." DDR-029's choice for annotations stands: annotations are world-content, comments are world-overlays. The decision rule:

> If the surface is **drawn by the user as part of the artboard** (annotations, ink, text-on-shape), portal into `.dc-world`. If the surface is a **UI affordance pointing AT the artboard** (selection halo, hover halo, comment pin, comment popover), render as a screen-coord fixed sibling.

## Alternatives considered

1. **Drop `will-change: transform` from `.dc-world`.** Removes the stacking-context boundary; comments inside the world stack against the halos. Rejected — `will-change: transform` is load-bearing for pan/zoom perf (DDR-024).
2. **Give `.dc-world` an explicit `z-index: 10` so its whole tree wins over halos.** Then the halos become invisible (they're literally for the world's content). Rejected — halos must remain visible.
3. **Move halos into `.dc-world` too.** Halos would scale with zoom — the 2 px border becomes 0.84 px subpixel at 42% zoom (= invisible). Comment in canvas-shell.tsx already warns about this. Rejected.
4. **Keep world-portal but use `isolation: isolate` differently.** Doesn't fix the underlying stacking-context boundary — `will-change: transform` already creates the boundary. Rejected.

## Verification

- Live dogfood after refactor: pin + thread popover render above selection halo with target element halo visible below (screenshot in conversation history 2026-05-20).
- Pin position survives pan/zoom; popover position survives pan/zoom (rAF tracking confirmed).
- Save / Cancel / Resolve / Delete / Send buttons clickable in comment tool mode without switching to Move (`isOverlayTarget` early-return verified).
- SVG-logo (data-cd-id="e6584ede") and similar `pointer-events: none`-decorated elements receive comments through the `elementsFromPoint` fallback.
- `bun test` 293/293 pass; tsc clean (modulo 2 pre-existing api.ts errors unrelated to Phase 6); bundle build 3.5 MB / 56 KB CSS.

## Future work

- The plan's deferred `comment-thread-resolve` scenario should walk the new flow end-to-end (Comment tool → click element → composer at click point → ⌘↵ → pin appears → click pin → thread → reply → ⌘↵ → Resolve → reload → pin hidden under default filter). Currently un-authored.
- Stored `bounds` could be converted to world coords at capture time (the existing `offsetWithinWorld` helper would help). Would fix the orphaned-pin zoom drift. Not load-bearing for the common case; deferred until a real bug appears.
