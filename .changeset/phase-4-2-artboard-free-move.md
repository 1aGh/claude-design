---
"@1agh/md-claude": minor
---

**Design plugin — Phase 4.2: free-form artboard repositioning (DDR-027, DDR-028).**

Artboards on the infinite canvas are now spatially editable. Phase 4 shipped the persistence infra; 4.2 plugs the drag-to-reposition UI surface into both that infra and the Phase 4.1 selection-set + tool-mode grammar.

- **Drag the artboard chrome** (label strip + outer border) while the Move tool is active. Inner content stays click-through, so Cmd+select still works through it.
- **Multi-select drag.** When the selection-set contains multiple artboard roots, dragging any one moves all selected artboards rigidly together — relative offsets captured at drag-start and preserved through snap.
- **Snap-to-grid + snap-to-sibling.** 40 world-unit grid + 8 world-unit tolerance to other artboards' left / right / center on X (and top / bottom / center on Y). 1 px guide lines render at the snapped position in `--accent`. Independent per axis (X can snap to a sibling and Y to the grid simultaneously).
- **Hold Alt to disable snap.** Per-pointermove modifier read; release Alt and guides reappear on the next move.
- **Ghost preview.** Original artboards mute to opacity 0.3 (`.dc-dragging`); a semi-transparent clone at opacity 0.5 (`.dc-artboard-ghost`) follows the snapped cursor position. Drop commits.
- **4 px click-vs-drag classifier.** Below threshold → label `onClick` fires (Phase 4 pan-to-focus regression-clean). At/above → drag starts, the synthetic click is suppressed via a one-shot capture-phase listener.
- **Persistence on drop.** PATCH `meta.layout.artboards[]` via the existing `patchCanvasMeta` writer. Reload restores positions.
- **Position-only writes (DDR-027).** The writer strips `w` / `h` from layout payload — artboard size is JSX-authoritative now. The reader still tolerates legacy entries with `w` / `h` for back-compat with Phase 4 default-grid snapshots; the next drag organically migrates them to position-only entries.
- **Snap tolerance in world units (DDR-028).** Tolerance scales with the layout, not the screen, so snap feel stays consistent across zoom levels. `useSnapGuides` is a pure zoom-agnostic function.
- **Cursor swap.** `grab` on label hover when active tool is `move`; `grabbing` during drag. Wired via the existing `.dc-canvas[data-active-tool="move"]` projection.

**New modules.** `use-snap-guides.tsx` (pure snap math, 20 table tests) · `use-artboard-drag.tsx` (state-machine reducer + DOM hook, 20 unit tests) · `SnapGuideOverlay` export from `canvas-lib.tsx` mounted by `CanvasShell`.

**Bug fixes (caught during visual smoke + code review + post-merge dogfooding).**
- The reader in `DesignCanvasInner.artboards` `useMemo` previously replaced default-grid entries wholesale with meta entries. Once 4.2 writers started emitting position-only `{ id, x, y }`, the replace left `w` / `h` undefined → artboards rendered at 0×0. Reader now merges meta over defaults instead of replacing.
- The drag hook used to call `setPointerCapture` on the outer article on pointerdown. That redirected the synthetic `click` event to the captured ancestor, breaking the label button's `onClick` → Phase 4 pan-to-focus regression. Capture removed; global window-level pointermove/up listeners (capture: true) carry the drag without it.
- `selectedIds` in the drag hook fell back from `Selection.id` (a child element's `data-cd-id`) to `Selection.artboardId`. That pulled stray child cd-ids into the multi-drag identity set and silently disabled multi-artboard drag. New `selectionsToArtboardIds` helper now keys on `artboardId` only; covered by a regression test.
- Drag commits PATCH'd the server but the local React state stayed frozen — users had to switch canvases to "see" the dropped artboard at its new position. `DesignCanvasInner.artboards` converted from `useMemo([seeds])` to `useState` with optimistic update on commit. Drop now reflects instantly in the DOM without an iframe reload.

**Handoff regression-clean.** Drag + snap exports (`useArtboardDrag`, `SnapGuideOverlay`, `computeSnap`, `useSnapGuides`, `DragStateContext`) never travel into a handed-off registry item — the static-frame overrides for `DesignCanvas` / `DCArtboard` / `DCSection` break the transitive chain, pinned by 2 new tests in `handoff-static-frames.test.ts`.

**Schema.** `canvas-meta.schema.json#layout.artboards[].required` narrows from `["id","x","y","w","h"]` to `["id","x","y"]`. `w` / `h` remain in `properties` as legacy read-only fields.

`bun test` 239/239, 0 fail (baseline + 44 new across snap + drag + 1 canvas-meta-api + 2 handoff). `bunx tsc --noEmit` clean of new errors. Scenario `canvas-artboard-drag` authored at `.ai/scenarios/canvas-format-tsx/canvas-artboard-drag/spec.md`; manual web-desktop end-to-end smoke confirmed drag → snap → drop → reload round-trip with pin artboard at `{x: 1200, y: 1200}` post-reload, plus the post-merge instant-update fix (pin moved from `(0, 900)` → `(1414, 1400)` with DOM reflecting the change immediately on pointerup, no reload).
