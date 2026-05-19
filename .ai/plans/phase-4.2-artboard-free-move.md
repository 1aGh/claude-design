---
name: phase-4.2-artboard-free-move
status: draft
created: 2026-05-19
decisions: []
depends-on: phase-4.1-figjam-canvas-interactions.md (selection-set + tool-mode framework)
amends: phase-4-canvas-v2-rendering-engine.md (delivers the deferred "T8+ drag-to-move")
---

# Phase 4.2: Free-form artboard repositioning

> **Scope.** Phase 4 shipped persistence infra for per-artboard `(x, y)` (`meta.layout.artboards[]` + PATCH write-path in T5) but left drag-to-reposition as a "future T8+" placeholder that never got concrete tasks. Phase 4.1 ships selection-set + tool-mode + input-router. This phase plugs drag-to-reposition into both — single-artboard drag, multi-select drag, snap-to-sibling, ghost preview, persist on drop. Nothing else: no resize handles (artboard `width`/`height` stay JSX-authoritative per the 2026-05-19 conversation), no z-order shuffling, no nested grouping.

## Description

Make artboards spatially editable on the infinite canvas:

- **Drag the artboard chrome (label strip + outer border)** in `V` move tool to reposition. Inner content stays click-through (Cmd+click / hover-select still works through it).
- **Multi-select drag** — selecting N artboards via Phase 4.1's selection-set then dragging any one moves all N together, preserving relative positions.
- **Snap during drag** — to a coarse world grid (every 40 world-units at zoom 1.0) and to other artboards' edges/centers (within 8 world-units of the dragging artboard's edge). Snap visualizes with a 1px guide line. Hold `Alt` to disable snap.
- **Ghost preview** — original stays muted at old position; semi-opaque copy follows cursor. Drop commits.
- **Persist on settle** — PATCH `meta.layout.artboards[]` via the Phase-4 T5 write-path (already shipped, no infra change). Reload → positions restored.

Artboard `width`/`height` remain authored in JSX (`<DCArtboard width={...} height={...}>`). Per the 2026-05-19 decision, meta.layout holds positions only — sizes flow from code (single source of truth). T1 of this phase makes that explicit by ensuring the PATCH payload never writes `w`/`h` back into meta (currently the schema includes them; we'll constrain the writer).

## User Story

As a designer reviewing 8 states of `Canvas Viewport.tsx`, I want to grab the CV-04 artboard by its label strip and drag it next to CV-02 — so I can group related states visually without editing the JSX. After drop, the position is in `Canvas Viewport.meta.json` and reload preserves it. If I Shift+click CV-03 and CV-05 first then drag, all three move as a rigid group.

## Problem

Phase 4 deliberately left this gap:

1. **The data model is ready.** `meta.layout.artboards[i].{x, y}` exists, the synthesizer + reader exists, the PATCH endpoint exists. The only missing piece is the pointer-down → drag → drop → PATCH UI surface.
2. **Phase 4 T4 made the label clickable** for pan-to-focus — that click needs to coexist with drag-start (click = focus, drag = move; distinguished by mousemove threshold).
3. **Without drag, the default grid is the only layout.** Designers can't visually group related states. The "infinite canvas" feels frozen.

## Solution

A drag controller in canvas-lib (`useArtboardDrag`) that hooks into Phase 4.1's input-router. The router classifies `mousedown` on an artboard's chrome (label strip or border, **not** inner content) into either "select" (if mousemove < 4px before mouseup) or "drag-start" (if mousemove ≥ 4px). Drag-state owns the ghost element; on settle (mouseup), commit world-coord positions via the existing PATCH.

Multi-select: when drag-start fires on an artboard that's in the selection-set, all selected artboards drag together. Their relative offsets to the drag origin are captured at drag-start and applied on every move.

Snap: a `useSnapGuides({ otherRects, gridSize })` pure function returns the snapped `(x, y)` + array of guide lines to render. Two snap kinds — grid (mod-`gridSize`) and sibling (edge/center alignment to other artboards). `Alt` modifier bypasses.

## Metadata

- **GitHub Issue**: — (user-requested in /flow:plan session 2026-05-19)
- **Type**: Enhancement (completes Phase 4's deferred T8+)
- **Complexity**: Medium (data model ready; selection-set + tool-mode ready from 4.1; only the drag surface + snap math are new)
- **App/Package**: `plugins/design` (canvas-lib + runtime + template)
- **Affected Systems**: Phase 4 layout persistence (T5), Phase 4.1 input-router + selection-set, Phase 4 label-click pan-to-focus (T4)
- **Dependencies**: **Phase 4.1 must ship first** — drag classifier is part of input-router; multi-drag uses selection-set; tool-mode gates drag to `V` only.

---

## Context References

### Must-Read Files

- `.ai/plans/phase-4-canvas-v2-rendering-engine.md` lines 19, 171 — original "future T8+ drag-to-move" placeholders this phase closes
- `.ai/plans/phase-4.1-figjam-canvas-interactions.md` — selection-set (T3), input-router (T1), tool-mode (T2) all referenced from this phase's tasks
- `.design/_lib/canvas-lib.tsx` lines 205–280 — Phase 4 default-grid synthesizer + layout reader; same coord space we write to
- `.design/_lib/canvas-lib.tsx` lines 338–360 — `patchCanvasMeta({ layout })` — the PATCH writer. **Reuse, don't rewrite.** Only constrain payload (no `w`/`h`).
- `.design/_lib/canvas-lib.tsx` lines 1056–1100 — `DCArtboard` render; chrome (label strip + border) vs inner content split is where drag-start vs click-through is decided
- `plugins/design/dev-server/runtime/design-canvas.jsx` lines 1–60 (stylesheet) + `.dc-artboard-label` styles — drag handle gets cursor: grab; cursor: grabbing during drag
- `.design/ui/Canvas Viewport.tsx` — primary scenario fixture (8 artboards, current positions are default grid)

### Files to Create

- `plugins/design/_lib/use-artboard-drag.tsx` — drag controller hook (start → move → drop → PATCH)
- `plugins/design/_lib/use-snap-guides.tsx` — pure snap math + guide-line shapes
- `plugins/design/dev-server/test/use-snap-guides.test.ts` — snap math unit tests (table-driven)
- `plugins/design/dev-server/test/artboard-drag.test.ts` — drag-classifier + multi-drag math tests
- `.ai/scenarios/canvas-artboard-drag.md` — drag single, drag multi, snap, persist, reload

### Files to Update

- `plugins/design/_lib/canvas-lib.tsx` — wire `useArtboardDrag` into `<DCArtboard>` chrome (label + border); add snap-guide overlay rendered outside `.dc-world` (similar to MiniMap)
- `plugins/design/_lib/canvas-lib.tsx` `patchCanvasMeta` writer — constrain payload to `{ id, x, y }` only (drop `w`/`h` per the JSX-authoritative size decision)
- `plugins/design/dev-server/runtime/design-canvas.jsx` — `.dc-artboard-label` gets `cursor: grab` in V tool; cursor swap to `grabbing` during drag; `.dc-artboard.dragging` class for ghost effect
- `plugins/design/templates/canvas-lib.tsx.template` — mirror canvas-lib changes
- `_active.json` schema — no change (Phase 4.1 already widened it to `selected: Selection[]`)
- Meta JSON schema for `layout.artboards[]` (referenced in Phase 4 T5) — narrow `w`/`h` from `required` to `forbidden in PATCH` (still readable for back-compat, but writes strip them)

### Documentation

- [Figma snapping behavior](https://help.figma.com/hc/en-us/articles/360039956334) — Why: target snap-guide behavior (1px lines, edge + center match, Alt to disable)
- [`tldraw` drag-snap implementation](https://github.com/tldraw/tldraw) — Why: minimal reference for snap math (don't bundle; lift the geometry idea)
- [DDR-007](.ai/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md) — `data-dc-id` is the persistence key; drag commits keyed by `id`, not by index

### Patterns to Follow

**Drag controller shape** — mirror Phase 4 `useViewportController` ergonomics:

```ts
// _lib/use-artboard-drag.tsx
type DragState =
  | { phase: 'idle' }
  | { phase: 'pending'; startX: number; startY: number; targetId: string }
  | { phase: 'dragging'; origin: Point; cursor: Point; targets: DragTarget[]; snap: SnapResult };

type DragTarget = { id: string; startRect: Rect; ghost: HTMLElement };

export function useArtboardDrag(opts: {
  selectionSet: Selection[];
  artboardRects: ArtboardRect[];
  zoom: number;
  enabled: boolean;  // false when activeTool !== 'move'
  onCommit: (next: ArtboardRect[]) => void;  // routes through patchCanvasMeta
}): DragHandlers;  // { onPointerDown, onPointerMove, onPointerUp }
```

The 4px threshold for click-vs-drag is the same idiom HTML5 drag-and-drop uses. Below threshold → no drag started, click semantics win (Phase 4 T4 label-click → pan-to-focus). At/above → cancel pending click, commit to drag.

**Snap result shape** — pure function, easy to unit-test:

```ts
type SnapResult = {
  x: number;  // possibly snapped
  y: number;  // possibly snapped
  guides: { axis: 'x' | 'y'; pos: number; from: number; to: number }[];  // 0..N
};

function computeSnap(
  proposedRect: Rect,
  otherRects: Rect[],
  opts: { gridSize: number; tolerance: number; disabled: boolean }
): SnapResult;
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
|---|---|---|
| `useViewportController` | `plugins/design/_lib/canvas-lib.tsx` (Phase 4) | Read `zoom` to scale pointer-delta → world-delta |
| `useSelectionSet` | `plugins/design/_lib/use-selection-set.tsx` (Phase 4.1) | Source of multi-drag targets |
| `useInputRouter` | `plugins/design/_lib/input-router.tsx` (Phase 4.1) | Drag-start gets routed from here; classifier gains `'artboard-drag-pending'` action |
| `patchCanvasMeta` | `plugins/design/_lib/canvas-lib.tsx` (Phase 4 T5) | Drop → PATCH; settle-debounce already in writer |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
|---|---|---|
| Canvas Viewport (8 artboards) | `.design/ui/Canvas Viewport.tsx` | Primary fixture — 8 same-size artboards in default 3×3-ish grid |
| Smoke TSX (1 artboard) | `.design/ui/Smoke TSX.tsx` | Edge case — single-artboard canvas; drag should still work, snap-to-grid only (no siblings) |
| Docs Site (5 artboards × 1440×900) | `.design/ui/Docs Site.tsx` | Larger artboards — verifies snap-tolerance math at non-default size |

### Icons

None new. The grab cursor is a CSS cursor, not an icon. The snap guides are 1px lines, not icons.

### Tokens

- Snap guide color: reuse `--accent` (the selection halo color from Phase 4) at full opacity
- Ghost opacity: `0.5` on the dragging copy (Hardcoded constant in CSS — opacity isn't a token in this DS)
- Origin-position muting: `opacity: 0.3` on the original artboard during drag

### Custom Components Needed

| Component | Reason | Extends |
|---|---|---|
| `SnapGuideOverlay` | Renders the 0–N guide lines from `SnapResult.guides` outside `.dc-world` | New — same outside-of-world placement as MiniMap, ZoomToolbar (per Phase 4 T3 pattern) |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `_lib/use-snap-guides.tsx` + unit tests

- **Do:** Pure function `computeSnap(proposed, others, opts)` returning `{ x, y, guides }`. Snap kinds:
  - **Grid:** every `gridSize` world-units (default 40 at zoom 1.0; opts can override).
  - **Sibling edges:** left↔left, right↔right, left↔right, right↔left of any other artboard within `tolerance` (8 world-units).
  - **Sibling centers:** centerX↔centerX, centerY↔centerY within `tolerance`.
  - **Sibling top/bottom:** top↔top, bottom↔bottom, top↔bottom, bottom↔top.
  - When multiple snaps within tolerance → prefer closest (smallest delta).
  - When `disabled: true` (Alt held) → return `{ x: proposed.x, y: proposed.y, guides: [] }`.
- **Pattern:** Pure-function table-driven test. Mirror Phase 4.1 input-router's `bun test` style.
- **Gotcha:** `tolerance` is in **world units, not screen pixels.** Caller passes the *world* tolerance; screen tolerance / zoom = world tolerance. Guide line length is min/max of the two rects' relevant axis (so a top-edge snap draws a line from the leftmost-left to the rightmost-right of the two snapped rects).
- **Validate:** `bun test plugins/design/dev-server/test/use-snap-guides.test.ts` — cover every snap kind + Alt-disable + multi-snap-prefer-closest + corner case where proposed.x is exactly at gridSize boundary.

### Task 2: CREATE `_lib/use-artboard-drag.tsx` + 4px click-vs-drag classifier

- **Do:** Hook returning `{ onPointerDown, onPointerMove, onPointerUp, dragState }`. Phase machine: `idle` → `pending` (on pointerdown) → `dragging` (on pointermove past 4px threshold) → `idle` (on pointerup). In `dragging`, compute new positions for **all** targets in the selection-set (if drag-target is in selection-set; otherwise just the clicked artboard, and selection-set becomes `[targetId]`). Apply `useSnapGuides` against the leader's proposed rect; offset followers by leader's snap delta.
- **Pattern:** Phase 4.1 router callbacks. `enabled = (activeTool === 'move')` from `useToolMode`.
- **Gotcha:** The pointer-delta is in **screen pixels**; divide by `viewport.zoom` to get world delta. Forgetting this means dragging is "wrong speed" at zoom 0.5 or 2.0. Phase 4 T2's wheel handler already does this division — mirror it.
- **Validate:** `bun test plugins/design/dev-server/test/artboard-drag.test.ts` — drag single artboard, drag with 3 in selection-set (followers preserve relative offset), drag at zoom 0.5 + zoom 2.0 (world-delta correct), drag below 4px threshold (resolves as click, no commit).

### Task 3: WIRE drag into `<DCArtboard>` + ghost rendering + cursor swap

- **Do:** In `canvas-lib.tsx`'s DCArtboard render: attach `useArtboardDrag` handlers to the **chrome** (label strip element + outer border, **not** the inner content area where Cmd+click selection lives). During `pending`/`dragging`, render a `.dc-artboard.dragging` semi-opaque clone at the cursor position; mute the original at 0.3 opacity at its starting position. Body cursor swap: `grab` on hover over chrome in V tool; `grabbing` during drag.
- **Pattern:** Phase 4's `.dc-selection-halo` and MiniMap both render outside `.dc-world` (don't pan/zoom with world). The ghost lives **inside** `.dc-world` (it does pan/zoom with world — it represents a world-coord position). The snap-guide overlay (next task) lives outside.
- **Gotcha:** Click on label strip currently triggers Phase 4 T4's pan-to-focus. The 4px threshold guard means a real click (mousedown → mouseup with < 4px move) still fires pan-to-focus; a drag (≥ 4px move) cancels pan-to-focus and commits position instead. Implement by: pan-to-focus listener checks `dragState.phase === 'idle'` before firing.
- **Validate:** Open Canvas Viewport. Hover CV-03 label strip → cursor becomes grab. Click without moving → pan-to-focus on CV-03 (Phase 4 T4 unchanged). Click+drag → CV-03 follows cursor as ghost; original stays muted at old spot. Release → ghost disappears, CV-03 settles at new spot.

### Task 4: WIRE `SnapGuideOverlay` + Alt-disables-snap

- **Do:** New canvas-lib export rendered outside `.dc-world`. Reads `dragState.snap.guides` (when `phase === 'dragging'`); renders 1px `--accent`-colored lines at the indicated positions in screen coords (world coords transformed through the current viewport). Listens for Alt keydown/keyup to flip the `disabled` flag passed into `useSnapGuides`.
- **Pattern:** Same outside-of-world placement as MiniMap (Phase 4 T3). World coord → screen coord uses the same matrix the viewport controller exposes.
- **Gotcha:** Guide lines must update on every pointermove during drag (smooth) — render directly via DOM mutation or rAF, not via React state, for 60fps under the CSS driver. Pixi driver: lines can be drawn into the Pixi stage as `Graphics`. Defer Pixi version to T6.
- **Validate:** Drag CV-03 close to CV-02's right edge → vertical guide appears spanning both artboards' visible height. Hold Alt → guide disappears, CV-03 follows cursor freely. Release Alt → guide reappears on next pointermove. Same with grid snap (move CV-03 freely until it hits a 40-unit boundary).

### Task 5: CONSTRAIN `patchCanvasMeta` writer to position-only + commit on drop

- **Do:** Modify `patchCanvasMeta({ layout })` in `canvas-lib.tsx`: when given `layout.artboards`, strip any `w`/`h` keys from each entry before PATCH. Reader (`canvas-lib.tsx:900`) keeps reading `w`/`h` for back-compat but doesn't trust them — DCArtboard render falls back to props.width / props.height when meta values disagree (already true today; just remove `w`/`h` from new writes). Drag controller calls this with `{ id, x, y }` per artboard on pointerup-settle.
- **Pattern:** Phase 4 T5's settle-debounce (50ms) already coalesces rapid writes. Drop = single write at settle (we don't need debouncing during drag itself — only commit on pointerup).
- **Gotcha:** Existing `meta.layout.artboards[]` files (from Phase 4) have `w`/`h` written. They stay until next drag overwrites the entry. That's fine — DCArtboard already ignores them when JSX props are present. **Don't migrate** existing files; let them age out organically.
- **Validate:** Drag CV-03 to new spot. `cat .design/ui/Canvas\ Viewport.meta.json` → CV-03 entry now has `{ id, x, y }`, no `w`/`h`. Other entries (untouched) keep their old `w`/`h`. Edit `Canvas Viewport.tsx` to change CV-03's `width={1280}` → `width={600}` → reload → CV-03 renders at 600px wide at its new position (JSX wins).

### Task 6: PIXI DRIVER parity for ghost + snap guides

- **Do:** Phase 4 T7's Pixi driver renders the world transform via WebGL. The ghost + snap guides need Pixi equivalents: ghost = duplicate the DCArtboard's Pixi container at ghost position with 0.5 alpha; snap guides = `Graphics` lineTo/moveTo at the indicated world coords. Same handler API as the CSS driver path — only the rendering output differs.
- **Pattern:** Phase 4 T7's driver-swap interface — UX byte-identical between drivers.
- **Gotcha:** Pixi `Graphics` is retained-mode — clear and redraw on every pointermove during drag. At zoom 0.5 with 50 artboards in the snap-candidate set, this could be a perf hit. Limit snap-candidate set to artboards within a screen-area-padded bbox around the dragging rect (cheap pre-filter).
- **Validate:** Scenario `canvas-artboard-drag` runs green on both drivers. FPS gate: ≥ 55 fps while dragging in a 50-artboard canvas under Pixi.

### Task 7: SCENARIO `canvas-artboard-drag` + perf addendum

- **Do:** Single scenario covering single drag → snap → drop → reload-persist; multi-select drag → all-three-move → relative offsets preserved; Alt-disables-snap; click-without-move falls through to Phase 4 T4 pan-to-focus (regression guard); drag in `H` hand tool does nothing (pans world instead); drag in `C` comment tool does nothing.
- **Pattern:** Phase 4 T7's `canvas-runtime-pan-zoom-50-artboards` scenario for the perf addendum — extend with continuous-drag step.
- **Validate:** `flow:scenario-runner` runs across web-desktop + web-mobile. Mobile is degraded mode (touch drag works but snap-guides hidden — touch surface too imprecise; document gracefully).

### Task 8: TEMPLATE mirror + handoff filter

- **Do:** Mirror `_lib/canvas-lib.tsx` changes into `plugins/design/templates/canvas-lib.tsx.template`. Extend `canvas-lib-inline.ts` (handoff path) to strip drag-related exports (`useArtboardDrag`, `useSnapGuides`, `SnapGuideOverlay`) from emitted registry items — same authoring-time-only treatment as Phase 4's engine exports.
- **Pattern:** Phase 4 T7's handoff strip list.
- **Validate:** `mdcc init --dry-run` against a scratch dir → canvas-lib template has drag exports. Run `/design:handoff` on Canvas Viewport → emitted registry has no drag exports in code, no `layout.artboards[].x|y` in emitted meta (handoff emits **positionless** registry — production code doesn't need world-canvas positions).

---

## Validation

1. **Bun tests**: `cd plugins/design/dev-server && bun test` — must pass the new `use-snap-guides.test.ts` + `artboard-drag.test.ts` + all prior baseline
2. **Manual smoke**: drag CV-03 → snap to CV-02's right edge → drop → reload → CV-03 stays
3. **Scenario `canvas-artboard-drag`**: green on web-desktop, web-mobile degraded with rationale
4. **Phase 4 regression**: `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` still pass (drag didn't break pan/zoom or pan-to-focus)
5. **Phase 4.1 regression**: `canvas-figjam-grammar` + `canvas-context-menu` still pass (drag plugs into router, doesn't replace anything)
6. **Perf**: dragging a 5-target group in a 50-artboard canvas under Pixi ≥ 55 fps
7. **Handoff**: emitted registry from `/design:handoff` has no drag code, no `x`/`y` in emitted meta

---

## Scenario Coverage (UI tasks — required)

| Scenario | Covers | Status |
|---|---|---|
| `canvas-artboard-drag` | Single drag · multi-drag · snap (grid + sibling) · Alt-disable · click-without-move (regression) · drag-in-non-V-tools (no-op) · persist + reload | 🆕 new |
| `canvas-runtime-pan-zoom-50-artboards` | Perf regression — drag of N-group under Pixi | ✅ existing (extended) |
| `canvas-figjam-grammar` (4.1) | Regression — input-router still routes selection/comment/etc. correctly with drag classifier added | ✅ existing |

---

## Acceptance Criteria

- [ ] T1: `useSnapGuides` ships with all snap kinds + Alt-disable + closest-prefer tiebreak; `bun test` table covers each
- [ ] T2: `useArtboardDrag` 4px click-vs-drag classifier; multi-drag preserves relative offsets; world-delta scales by zoom
- [ ] T3: DCArtboard chrome (label + border) is the drag handle; inner content stays click-through for Cmd+select; ghost renders at 0.5 opacity, original at 0.3 opacity during drag; cursor swaps `grab`↔`grabbing`
- [ ] T4: SnapGuideOverlay renders 1px `--accent` lines outside `.dc-world`; Alt toggles disable in real-time
- [ ] T5: `patchCanvasMeta` writer strips `w`/`h` from layout payload; reader stays back-compat; JSX width/height remains authoritative source of size
- [ ] T6: Pixi driver renders ghost + guides identically; snap-candidate prefilter holds perf budget
- [ ] T7: scenario green on web-desktop; mobile degraded documented
- [ ] T8: template + handoff filter mirror changes
- [ ] **DDR-worthy decisions captured:**
  - DDR: artboard size = JSX-authoritative; meta.layout.artboards[] holds positions only. (References the 2026-05-19 conversation — formalizes it now that we have a write surface that could violate it.)
  - DDR: snap tolerance is world-units, not screen-pixels (rationale: snap feel stays consistent across zoom levels). Document the gridSize default (40 world-units) and how it was picked.
- [ ] `/flow:validate` clean overall (static + tests + build + scenario + a11y + DS guard)
- [ ] Plan archived on `/done`

---

## Non-goals (out of scope)

- **Resize handles** — artboard `width`/`height` stay JSX-authored, per 2026-05-19 decision. Adding drag-to-resize would invert the source-of-truth direction.
- **Z-order shuffling** — overlapping artboards keep their DOM order. No "bring to front" / "send to back" affordance this phase. (Right-click context-menu from Phase 4.1 *could* surface these later — track as 4.3 candidate.)
- **Nested grouping / frames** — Figma's Frame-inside-Frame is out of scope. Each artboard is a leaf in `meta.layout.artboards[]`.
- **Auto-layout / flex-layout artboards** — artboards don't auto-arrange after a drag. Drop = literal world position.
- **Undo/redo for drag commits** — single-canvas undo isn't infra'd yet. Drag is destructive once committed (the meta.json file is the only history; rely on git). Add when project-wide undo is planned.
- **Touch-precision snap** — touch drag fires drag events but snap guides are hidden on mobile (touch coords are too imprecise for 8-unit snap-tolerance to feel natural).
- **Snap to MiniMap viewport rect** — drag while watching MiniMap doesn't snap to its viewport indicator. Out of scope.
