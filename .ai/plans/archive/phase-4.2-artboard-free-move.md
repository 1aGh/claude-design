---
name: phase-4.2-artboard-free-move
status: implemented
created: 2026-05-19
revised: 2026-05-19 (path-sweep + scope shrinkage after Phase 4.0.5 + 4.1 shipped)
implemented: 2026-05-19 (T1–T7 landed; 228/228 bun tests; DDR-027 + DDR-028 to be recorded on /done)
decisions:
  - DDR-025-canvas-lib-single-source-in-dev-server.md
  - DDR-026-universal-canvas-input-grammar.md
depends-on: phase-4.1-figjam-canvas-interactions.md (shipped — selection-set + tool-mode + canvas-shell)
amends: phase-4-canvas-v2-rendering-engine.md (delivers the deferred "T8+ drag-to-move")
---

# Phase 4.2: Free-form artboard repositioning

> **Scope.** Phase 4 shipped persistence infra for per-artboard `(x, y)` (`meta.layout.artboards[]` + PATCH write-path) but left drag-to-reposition as a "future T8+" placeholder. Phase 4.1 shipped the universal input grammar (selection-set + tool-mode + canvas-shell). This phase plugs drag-to-reposition into both — single-artboard drag, multi-select drag, snap-to-sibling, ghost preview, persist on drop. Nothing else: no resize handles (artboard `width`/`height` stay JSX-authoritative), no z-order shuffling, no nested grouping.

## Description

Make artboards spatially editable on the infinite canvas:

- **Drag the artboard chrome (label strip + outer border)** while the Move tool (`"move"`) is active. Inner content stays click-through so Cmd+click selection still works through it.
- **Multi-select drag** — when Phase 4.1's `selectionSet` contains multiple artboard-root selections (the selected element matches an artboard's `data-cd-id` / `data-dc-screen`), dragging any one moves all selected artboards together, preserving relative offsets.
- **Snap during drag** — to a coarse world grid (every 40 world-units at zoom 1.0) and to other artboards' edges/centers (within 8 world-units of the dragging artboard's edge). Snap visualizes with a 1px guide line in `--accent`. Hold `Alt` to disable snap.
- **Ghost preview** — original stays muted at old position; semi-opaque copy follows cursor. Drop commits.
- **Persist on settle** — PATCH `meta.layout.artboards[]` via the existing `patchCanvasMeta` writer. Reload → positions restored.

Artboard `width`/`height` remain authored in JSX (`<DCArtboard width={...} height={...}>`). Per the 2026-05-19 decision, `meta.layout` holds positions only — sizes flow from code (single source of truth). T5 constrains the PATCH writer to position-only (`{ id, x, y }`), even though the `ArtboardRect` type still carries `w`/`h` for in-memory layout.

## User Story

As a designer reviewing 8 states of `.design/ui/Canvas Viewport.tsx`, I want to grab the CV-04 artboard by its label strip and drag it next to CV-02 — so I can group related states visually without editing the JSX. After drop, the position is in `Canvas Viewport.meta.json` and reload preserves it. If I Cmd+click CV-03 then Cmd+Shift+click CV-05 first to multi-select, then drag, all three move as a rigid group.

## Problem

Phase 4 deliberately left this gap:

1. **The data model is ready.** `meta.layout.artboards[i].{x, y}` exists, the synthesizer + reader exists (`canvas-lib.tsx` ~lines 215–290, `readCanvasMeta`, `synthDefaultGrid`), the PATCH endpoint exists (`canvas-lib.tsx:352` `patchCanvasMeta` + `/_api/canvas-meta` handler in `api.ts`). The only missing piece is the pointer-down → drag → drop → PATCH UI surface.
2. **Phase 4 made the label clickable** for pan-to-focus (`canvas-lib.tsx:1172` `onClick={onFocus}` → `controller.jumpTo(rect)`). That click needs to coexist with drag-start: click = focus, drag = move; distinguished by a 4px mousemove threshold.
3. **Without drag, the default grid is the only layout.** Designers can't visually group related states. The "infinite canvas" feels frozen.

## Solution

A drag controller hook (`useArtboardDrag`) that attaches its **own** pointerdown listener to the artboard chrome (label strip + outer border). It deliberately does **not** plug into the Phase 4.1 `input-router` classifier — the router is per-event-stateless (`classify()` is a pure function), while drag is a multi-event state machine (down → move ×N → up). Owning its own listeners mirrors how `useViewportController` works.

Click-vs-drag classifier: `pointerdown` enters `pending`; if a subsequent `pointermove` moves the cursor ≥ 4px in screen space, transition to `dragging` and `preventDefault()` on the event so the label's native `onClick` (pan-to-focus) never fires. If `pointerup` arrives with cumulative move < 4px, do nothing — the native click handler runs as usual, preserving Phase 4 T4 pan-to-focus.

Multi-select: when drag-start fires on an artboard whose id is present in `selectionSet`, all selected-artboard ids drag together. Their relative offsets to the drag origin are captured at drag-start and applied on every move. When the drag-start target is **not** in the selection-set, the controller behaves as if only that one artboard were selected (does NOT mutate the selection-set; that stays orthogonal).

Snap: a `useSnapGuides({ proposedRect, otherRects, options })` pure function returns the snapped `(x, y)` + array of guide-line shapes. Two snap kinds — grid (mod-`gridSize`) and sibling (edge/center alignment to other artboards). `Alt` modifier bypasses.

## Metadata

- **GitHub Issue**: — (user-requested in /flow:plan session 2026-05-19)
- **Type**: Enhancement (completes Phase 4's deferred T8+)
- **Complexity**: Medium (data model ready; selection-set + tool-mode ready from 4.1; only the drag surface + snap math are new)
- **App/Package**: `plugins/design` (dev-server canvas-lib + new sibling modules + handoff filter)
- **Affected Systems**: Phase 4 layout persistence (`patchCanvasMeta`), Phase 4.1 selection-set + tool-mode, Phase 4 label-click pan-to-focus
- **Dependencies**: Phase 4.0.5 ✅ shipped (canvas-lib single source) · Phase 4.1 ✅ shipped (universal input grammar)

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/canvas-lib.tsx` lines 215–290 — Phase 4 default-grid synthesizer (`harvestArtboards`, `synthDefaultGrid`) + layout reader (`readCanvasMeta`); same coord space we write to
- `plugins/design/dev-server/canvas-lib.tsx` lines 348–363 — `patchCanvasMeta` writer; **reuse, don't rewrite.** Only constrain payload (no `w`/`h`) in T5
- `plugins/design/dev-server/canvas-lib.tsx` lines 1130–1181 — `DCArtboard` render; chrome (label strip = `<button class="dc-artboard-label">` + outer `<div class="dc-artboard dc-positioned">` border) vs inner content (`<div class="dc-artboard-body">`) split is where drag-start vs click-through is decided
- `plugins/design/dev-server/canvas-lib.tsx` lines 103–164 (`ENGINE_CSS`) — engine stylesheet, injected once per iframe inside `DesignCanvas`. `.dc-artboard-label` styles live here; drag classes (`.dragging`, `.dc-artboard-ghost`) extend here
- `plugins/design/dev-server/input-router.tsx` — Phase 4.1 router; **drag does NOT route through here** (per-event-stateless), but the router's `Tool` type (`"move" | "hand" | "comment"`) is the gating signal: drag enabled only when active tool is `"move"`
- `plugins/design/dev-server/use-selection-set.tsx` lines 40–66 — `Selection` shape; multi-drag reads `selected: Selection[]` and matches `selection.id === artboard.id` (or `selection.artboardId === artboard.id`) to find drag-eligible siblings
- `plugins/design/dev-server/use-tool-mode.tsx` lines 93–110 — `useToolMode()` / `useToolModeOptional()` for the `enabled` gate
- `plugins/design/dev-server/canvas-shell.tsx` — universal shell that wraps every TSX canvas; the drag overlay (snap guides) lives here as a sibling to MiniMap, since it's a chrome layer rendered outside `.dc-world`
- `.design/ui/Canvas Viewport.tsx` — primary scenario fixture (8 artboards, current positions are default grid)

### Files to Create

- `plugins/design/dev-server/use-snap-guides.tsx` — pure snap math + guide-line shapes (no React state; pure function exported, plus a thin hook wrapper if needed for memo)
- `plugins/design/dev-server/use-artboard-drag.tsx` — drag controller hook (state machine + pointer listeners + commit)
- `plugins/design/dev-server/test/use-snap-guides.test.ts` — snap math unit tests (table-driven, `bun:test`)
- `plugins/design/dev-server/test/use-artboard-drag.test.ts` — drag-classifier + multi-drag math tests
- `.ai/scenarios/canvas-artboard-drag.md` — drag single, drag multi, snap, persist, reload

### Files to Update

- `plugins/design/dev-server/canvas-lib.tsx`
  - Import + wire `useArtboardDrag` into `DCArtboard` chrome
  - Extend `ENGINE_CSS` with `.dc-artboard-ghost`, `.dragging`, cursor swap
  - Constrain `patchCanvasMeta` writer: strip `w`/`h` from `layout.artboards[]` payload before fetch
  - Export `SnapGuideOverlay` (new) for `CanvasShell` to mount
- `plugins/design/dev-server/canvas-shell.tsx` — mount `<SnapGuideOverlay />` as an outside-of-world chrome layer (same placement plane as the MiniMap), wired to the drag state
- `plugins/design/dev-server/canvas-lib-inline.ts` — extend handoff strip list with the new exports (`useArtboardDrag`, `useSnapGuides`, `SnapGuideOverlay`) so emitted registry items don't carry them
- `plugins/design/dev-server/canvas-meta.schema.json` — narrow `layout.artboards[].w`/`h` from `required` to optional read-only (writes strip them; reads tolerate them for back-compat)
- `_active.json` schema — no change (Phase 4.1 already widened it to `selected: Selection[]`)

### Files NOT Touched (explicit non-scope)

- ~~`plugins/design/_lib/...`~~ — does not exist (DDR-025; pre-sweep typo in original plan)
- ~~`plugins/design/dev-server/runtime/design-canvas.jsx`~~ — does not exist (runtime/ purged 2026-05-19; engine CSS now inline in `canvas-lib.tsx`)
- ~~`plugins/design/templates/canvas-lib.tsx.template`~~ — does not exist (DDR-025: single source, no template mirror)

### Documentation

- [Figma snapping behavior](https://help.figma.com/hc/en-us/articles/360039956334) — Why: target snap-guide behavior (1px lines, edge + center match, Alt to disable)
- [`tldraw` drag-snap implementation](https://github.com/tldraw/tldraw) — Why: minimal reference for snap math (don't bundle; lift the geometry idea)
- [DDR-007](.ai/archive/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md) — `data-dc-id` / `data-cd-id` is the persistence key; drag commits keyed by artboard `id`, not by index
- [DDR-025](.ai/archive/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md) — canvas-lib lives in dev-server only; this plan adds siblings, not project-side files
- [DDR-026](.ai/archive/decisions/DDR-026-universal-canvas-input-grammar.md) — universal input grammar context; drag is an orthogonal listener path (not through the router classifier)

### Patterns to Follow

**Drag controller shape** — own listeners like `useViewportController`:

```ts
// dev-server/use-artboard-drag.tsx
type DragPhase =
  | { kind: "idle" }
  | { kind: "pending"; startClientX: number; startClientY: number; targetId: string }
  | {
      kind: "dragging";
      origin: { x: number; y: number }; // world coords of drag-leader at start
      targets: DragTarget[];             // 1..N artboards in motion
      cursor: { x: number; y: number };  // current cursor in world coords
      snap: SnapResult;                  // { x, y, guides }
    };

interface DragTarget {
  id: string;
  startRect: ArtboardRect;  // captured at drag-start
}

export function useArtboardDrag(opts: {
  artboardId: string;
  selected: Selection[];             // from useSelectionSet
  rectFor: (id: string) => ArtboardRect | null;  // from WorldContext
  allRects: ArtboardRect[];          // from WorldContext.artboards
  viewport: { x: number; y: number; zoom: number };
  enabled: boolean;                  // false when activeTool !== "move"
  onCommit: (next: { id: string; x: number; y: number }[]) => void;
}): {
  bindHandle: () => HTMLAttributes<HTMLElement>;  // spread onto label + border
  dragState: DragPhase;
};
```

The 4px threshold for click-vs-drag is the same idiom HTML5 drag-and-drop uses. Below threshold → no drag started, the native `onClick` runs (Phase 4 label-click → pan-to-focus). At/above → call `event.preventDefault()` on the original pointerdown's downstream click event, commit to drag.

**Snap result shape** — pure function, easy to unit-test:

```ts
// dev-server/use-snap-guides.tsx
type Rect = { x: number; y: number; w: number; h: number };

type SnapGuide = {
  axis: "x" | "y";
  pos: number;        // world coord where the guide line sits
  from: number;       // start of the line along the perpendicular axis
  to: number;         // end of the line along the perpendicular axis
};

type SnapResult = {
  x: number;          // possibly snapped
  y: number;          // possibly snapped
  guides: SnapGuide[];
};

export function computeSnap(
  proposed: Rect,
  others: Rect[],
  opts: { gridSize: number; tolerance: number; disabled: boolean }
): SnapResult;
```

---

## Design Decisions

### Components / hooks reused (from registry)

| Component | Source | Notes |
|---|---|---|
| `useViewportController` | `canvas-lib.tsx` (Phase 4) | Read `zoom` to scale pointer-delta → world-delta. Already exposed via `useViewportControllerContext()` |
| `WorldContext` (`useWorldContext`) | `canvas-lib.tsx` | Read `artboards`, `rectFor`, `viewport` — drag pulls sibling rects from here for snap candidates |
| `useSelectionSet` | `use-selection-set.tsx` (4.1) | Source of multi-drag targets |
| `useToolModeOptional` | `use-tool-mode.tsx` (4.1) | `enabled = (toolMode?.activeTool === "move")` |
| `patchCanvasMeta` | `canvas-lib.tsx` (Phase 4) | Drop → PATCH; new constraint (T5) strips `w`/`h` |

### Existing fixtures reused

| Fixture | Path | Notes |
|---|---|---|
| Canvas Viewport (8 artboards) | `.design/ui/Canvas Viewport.tsx` | Primary — 8 same-size artboards in default 3×3 grid |
| Smoke TSX (1 artboard) | `.design/ui/Smoke TSX.tsx` | Edge case — single-artboard canvas; drag should still work, snap-to-grid only (no siblings) |
| Docs Site (5 artboards × 1440×900) | `.design/ui/Docs Site.tsx` | Larger artboards — verifies snap-tolerance math at non-default size |

### Icons / Tokens

- Snap guide color: `--accent` at full opacity (same as Phase 4.1 selection halo)
- Ghost opacity: hardcoded `0.5` on the dragging clone, `0.3` on the original at start position (opacities aren't a token in this DS)
- Cursor: `grab` on label hover when `activeTool === "move"`; `grabbing` during drag (CSS cursors, not icons)

### Custom Components Needed

| Component | Reason | File |
|---|---|---|
| `SnapGuideOverlay` | Renders the 0–N guide lines from `dragState.snap.guides`, outside `.dc-world`, in screen coords via the live viewport transform | New export from `canvas-lib.tsx` (or sibling file), mounted in `canvas-shell.tsx` |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `use-snap-guides.tsx` + unit tests

- **Do:** Pure function `computeSnap(proposed, others, opts)` returning `{ x, y, guides }`. Snap kinds:
  - **Grid:** every `gridSize` world-units (default 40 at zoom 1.0; opts can override). Applied to top-left corner of `proposed`.
  - **Sibling edges:** left↔left, right↔right, left↔right, right↔left of any other rect within `tolerance` (default 8 world-units).
  - **Sibling centers:** centerX↔centerX, centerY↔centerY within `tolerance`.
  - **Sibling top/bottom:** top↔top, bottom↔bottom, top↔bottom, bottom↔top.
  - When multiple snaps within tolerance on a given axis → prefer the closest (smallest delta).
  - X-axis and Y-axis are independent (you can snap X to a sibling and Y to the grid simultaneously; both guides render).
  - When `disabled: true` (Alt held) → return `{ x: proposed.x, y: proposed.y, guides: [] }`.
- **Pattern:** Pure-function table-driven test. Mirror `input-router.test.ts` style — `describe`/`test` from `bun:test`, one `describe` per snap kind, table of `[input, expected]` pairs.
- **Gotcha:** `tolerance` is in **world units, not screen pixels.** Caller passes the *world* tolerance. Guide line length is min/max of the two rects' relevant axis (so a top-edge snap draws a line from the leftmost-left to the rightmost-right of the two snapped rects).
- **Validate:** `cd plugins/design/dev-server && bun test test/use-snap-guides.test.ts` — cover every snap kind + Alt-disable + multi-snap-prefer-closest + corner case where `proposed.x` is exactly at gridSize boundary (no false guide).

### Task 2: CREATE `use-artboard-drag.tsx` + 4px click-vs-drag classifier + tests

- **Do:** Hook returning `{ bindHandle, dragState }`. State machine: `idle` → `pending` (on `pointerdown` over the artboard chrome) → `dragging` (on `pointermove` past 4px screen-px threshold) → `idle` (on `pointerup`). In `dragging`:
  1. Compute the drag leader's proposed world rect: `startRect + (cursor - origin) / zoom`
  2. Identify follower artboards: any entry in `selected` whose `id` matches an artboard id in `allRects` (and isn't the leader itself). If `selected` is empty or the leader isn't in `selected`, followers = `[]` and only the leader moves.
  3. Call `useSnapGuides.computeSnap(leaderProposed, otherRects, { gridSize: 40, tolerance: 8, disabled: altHeld })` where `otherRects = allRects.filter(r => r.id !== leader.id && !followers.includes(r.id))`.
  4. Apply leader's snap delta to all followers (rigid translation).
  5. On `pointerup`: if any drag happened, call `onCommit([{ id, x, y }, ...])` with the final positions. Reset to `idle`.
- **Pattern:** `useViewportController`'s pointer-listener style (capture on a ref, attach on mount, clean up on unmount). `enabled = false` short-circuits all event handling.
- **Gotcha:** The pointer-delta is in **screen pixels**; divide by `viewport.zoom` to get world delta. `useViewportController`'s wheel handler already does this division — mirror it. The leader's `pointerdown` must call `setPointerCapture()` so a fast drag doesn't lose the pointer when it leaves the artboard.
- **Edge case:** if `enabled` flips to `false` mid-drag (user pressed `H` to switch to hand tool), commit nothing and reset to `idle`. Don't strand the drag.
- **Validate:** `cd plugins/design/dev-server && bun test test/use-artboard-drag.test.ts`. Drive the hook via `@testing-library/react` if available; otherwise expose the state machine as a separately-testable pure reducer and unit-test the reducer (preferred — keeps the test snappy and DOM-free). Coverage: drag single artboard, drag with 3 in selection-set (followers preserve relative offset), drag at zoom 0.5 + zoom 2.0 (world-delta correct), drag below 4px threshold (resolves as click, no commit), tool-mode flip mid-drag (reset, no commit).

### Task 3: WIRE drag into `<DCArtboard>` + ghost rendering + cursor swap

- **Do:** In `canvas-lib.tsx`'s `DCArtboard` render:
  1. Call `useArtboardDrag` with the artboard's id, the `WorldContext` rects, the selection-set, the viewport, and `enabled = (activeTool === "move")` (read via `useToolModeOptional`; defaults to `true` when no provider).
  2. Spread `bindHandle()` onto both the outer `<div class="dc-artboard">` and the inner `<button class="dc-artboard-label">`. Inner `<div class="dc-artboard-body">` stays untouched — its children remain click-through.
  3. While `dragState.kind === "dragging"`: render a second absolutely-positioned clone of the artboard's frame (label + body wrapper, no children — empty body is fine for ghost) at the snapped world coords with `opacity: 0.5` and a `.dc-artboard-ghost` class. Mute the original at `opacity: 0.3` via a `.dragging` class.
  4. Extend `ENGINE_CSS`: `.dc-artboard-ghost { pointer-events: none; }`, `.dc-artboard.dragging { opacity: 0.3; }`, `.dc-canvas[data-tool="move"] .dc-artboard-label { cursor: grab; }`, `.dc-canvas[data-tool="move"] .dc-artboard-label:active { cursor: grabbing; }`. `data-tool` attribute is set on `.dc-canvas` by `DesignCanvas` from `useToolModeOptional`.
- **Pattern:** The ghost lives **inside** `.dc-world` (it represents a world-coord position, panning/zooming with the world). The snap-guide overlay (T4) lives **outside** `.dc-world` (it's chrome, painted in screen coords).
- **Gotcha:** The label is a `<button>` with `onClick={onFocus}` (Phase 4 label-click pan-to-focus). The 4px threshold guard means a real click (mousedown → mouseup with < 4px move) still fires `onClick`; a drag (≥ 4px move) must call `event.preventDefault()` on the pointerdown's resulting click. Standard recipe: on transition `pending → dragging`, set a flag, and bind a one-shot `click` listener on the button with `capture: true` that calls `e.stopPropagation()` and unbinds itself.
- **Validate:** `cd plugins/design/dev-server && bun test` baseline still green. Manual smoke (via `screenshot.sh` on Canvas Viewport): hover CV-03 label → cursor becomes grab. Click without moving → pan-to-focus on CV-03 (Phase 4 behavior unchanged). Click+drag ≥ 4px → CV-03 ghost follows cursor; original stays muted at old spot. Release → ghost gone, no persist yet (T5 wires that).

### Task 4: CREATE `SnapGuideOverlay` + Alt-disables-snap

- **Do:** New named export from `canvas-lib.tsx` (sibling to `DCMiniMap`). Renders 1px `--accent`-colored lines at the indicated positions, transformed from world coords to screen coords via `useViewportControllerContext().viewport`. Mount in `canvas-shell.tsx` as a chrome layer (same placement plane as `<DCMiniMap />`). Reads `dragState` via a new lightweight context (`DragStateContext`) published by `DesignCanvas` so the overlay can read it without prop-drilling through the shell. Alt keydown/keyup flips a `disabled` flag in the drag hook's options — implement by reading `altKey` from each pointermove (no global keyboard listener needed; `altKey` is on every PointerEvent).
- **Pattern:** Same outside-of-world placement as `DCMiniMap` (already mounted by canvas-shell). World coord → screen coord uses `viewport.x + worldCoord * viewport.zoom` (CSS-zoom math; see `writeTransform` at `canvas-lib.tsx:490` for the exact convention).
- **Gotcha:** Guide lines must update on every `pointermove` during drag (smooth) — React state at 60fps is acceptable for ≤10 guides; if there's flicker, fall back to imperative DOM mutation (`useRef` + write `transform` directly). Defer perf optimization to T6 if needed.
- **Validate:** Drag CV-03 close to CV-02's right edge → vertical guide appears spanning both artboards' visible height. Hold Alt → guide disappears, CV-03 follows cursor freely. Release Alt → guide reappears on next pointermove. Same with grid snap (move CV-03 freely until it hits a 40-unit boundary).

### Task 5: CONSTRAIN `patchCanvasMeta` writer to position-only + commit on drop

- **Do:** Modify `patchCanvasMeta({ layout })` in `canvas-lib.tsx`: when `patch.layout` is present, strip any `w`/`h` keys from each `artboards[]` entry before PATCH. The reader (`readCanvasMeta`) keeps reading `w`/`h` for back-compat but `DCArtboard` already falls back to props.width / props.height when meta sizes are missing or stale (Phase 4 design). Drag controller (T2's `onCommit` callback) calls `patchCanvasMeta({ layout: { artboards: [{ id, x, y }, ...] } })` on drop. Also update `canvas-meta.schema.json` to mark `w`/`h` as optional (was: required).
- **Pattern:** Phase 4's PATCH endpoint coalesces writes by file path on the server side. Drop = single write at settle (no need to debounce during drag — only commit on pointerup).
- **Gotcha:** Existing `meta.layout.artboards[]` files (from Phase 4 defaults) have `w`/`h` written. They stay until next drag overwrites the entry. `DCArtboard` already ignores them when JSX props are present. **Don't migrate** existing files; let them age out organically.
- **Validate:** Drag CV-03 to new spot. `cat ".design/ui/Canvas Viewport.meta.json"` → CV-03 entry now has `{ id, x, y }`, no `w`/`h`. Other entries (untouched) keep their old `w`/`h`. Edit `Canvas Viewport.tsx` to change CV-03's `width={1280}` → `width={600}` → reload → CV-03 renders at 600px wide at its new position (JSX wins). `bun test test/canvas-meta-api.test.ts` updated to cover the strip-on-PATCH.

### Task 6: SCENARIO `canvas-artboard-drag`

- **Do:** New scenario at `.ai/scenarios/canvas-artboard-drag.md` covering: single drag → snap-to-sibling → drop → reload-persist; multi-select drag (3 artboards) → all-three-move → relative offsets preserved; Alt-disables-snap; click-without-move falls through to Phase 4 label-click pan-to-focus (regression guard); drag in `"hand"` tool does nothing (pans world instead); drag in `"comment"` tool does nothing.
- **Pattern:** Existing `canvas-input-grammar` and `canvas-runtime-tour` scenarios. Web-desktop primary; web-mobile noted as degraded (touch drag works but snap guides hidden — touch coords are too imprecise for 8-unit snap-tolerance to feel natural; document this rather than implement special-case touch math).
- **Validate:** `flow:scenario-runner` runs green on web-desktop. Mobile entry in scenario notes the degraded behavior.

### Task 7: HANDOFF strip list + `_active.json` no-change check

- **Do:** Extend `plugins/design/dev-server/canvas-lib-inline.ts` strip list with the new exports (`useArtboardDrag`, `useSnapGuides`, `computeSnap`, `SnapGuideOverlay`, `DragStateContext`) so emitted registry items don't carry them. Also verify the emitted meta.json strips `layout.viewport` and `layout.artboards[].{x,y}` (handoff emits a positionless registry — production code doesn't need world-canvas positions). If the existing handoff already strips those, just add a regression test asserting it.
- **Pattern:** Existing strip-list pattern in `canvas-lib-inline.ts` (Phase 4 handoff filter).
- **Gotcha:** Per DDR-025 there is **no `plugins/design/templates/canvas-lib.tsx.template`** to mirror — the dev-server file is the single source. Don't recreate the template.
- **Validate:** `bun test test/canvas-lib-inline.test.ts` baseline + new test for the additions. Run `/design:handoff` on Canvas Viewport against a scratch dir → emitted registry has no drag exports, no `x`/`y` in emitted meta.

### Out of scope this phase — explicit

- **T6 Pixi driver parity** (in the original 2026-05-19 plan): deferred. No Pixi runtime path currently exists in canvas-lib (DDR-024's Pixi importmap is plumbed but not wired to DCArtboard rendering). When Pixi rendering ships, this task returns as a follow-up plan; ghost + guides need Pixi `Graphics` equivalents.
- **Template mirror** (original T8): N/A per DDR-025 (single source in dev-server; no template).

---

## Validation

1. **Bun tests**: `cd plugins/design/dev-server && bun test` — must pass the new `use-snap-guides.test.ts` + `use-artboard-drag.test.ts` + all prior baseline (currently 185/185 post-Phase-4.1)
2. **Type check**: `cd plugins/design/dev-server && bunx tsc --noEmit` clean
3. **Manual smoke**: drag CV-03 → snap to CV-02's right edge → drop → reload → CV-03 stays
4. **Scenario `canvas-artboard-drag`**: green on web-desktop, mobile degraded with rationale documented
5. **Phase 4 regression**: label-click pan-to-focus still works on a no-move click; `canvas-runtime-tour` still passes
6. **Phase 4.1 regression**: `canvas-input-grammar` still passes — drag doesn't break router-driven selection / hover / context-menu / tool-switch
7. **Handoff**: emitted registry from `/design:handoff` has no drag code, no `x`/`y` in emitted meta

---

## Scenario Coverage (UI tasks — required)

| Scenario | Covers | Status |
|---|---|---|
| `canvas-artboard-drag` | Single drag · multi-drag · snap (grid + sibling) · Alt-disable · click-without-move (regression) · drag-in-non-move-tools (no-op) · persist + reload | 🆕 new |
| `canvas-input-grammar` (Phase 4.1) | Regression — router-driven select/hover/context-menu/tool-switch unchanged with drag added | ✅ existing |
| `canvas-runtime-tour` (Phase 4) | Regression — pan/zoom/fit/jumpTo unchanged | ✅ existing |

---

## Acceptance Criteria

- [x] T1: `computeSnap` ships with all snap kinds + Alt-disable + closest-prefer tiebreak; `bun test` table covers each axis independently (20/20 tests in `test/use-snap-guides.test.ts`)
- [x] T2: `useArtboardDrag` 4px click-vs-drag classifier; multi-drag preserves relative offsets; world-delta scales by zoom; tool-mode flip mid-drag is graceful (20/20 tests in `test/use-artboard-drag.test.ts` — pure reducer + helpers; DOM smoke deferred to scenario)
- [x] T3: DCArtboard chrome (article + label button) is the drag handle; pointerdowns originating inside `.dc-artboard-body` are filtered out for Cmd+select pass-through; ghost renders at 0.5 opacity (`.dc-artboard-ghost`), original at 0.3 opacity (`.dc-dragging`) during drag; cursor swaps `grab`↔`grabbing` via `.dc-canvas[data-active-tool="move"]` (existing canvas-shell projection — plan named `data-tool` but the shell already uses `data-active-tool`)
- [x] T4: `SnapGuideOverlay` exported from `canvas-lib.tsx`, mounted in `canvas-shell.tsx`; renders 1px `--accent` lines outside `.dc-world` in screen coords (`position: fixed`); Alt is read from each pointermove → `computeSnap({ disabled: alt })` so the disable is live
- [x] T5: `patchCanvasMeta` writer strips `w`/`h` from `layout.artboards[]` payload; reader stays back-compat; JSX `width`/`height` remains authoritative source of size; `canvas-meta.schema.json` narrowed (w/h now optional read-only); `test/canvas-meta-api.test.ts` covers the position-only round-trip
- [x] T6: scenario `canvas-format-tsx/canvas-artboard-drag/spec.md` authored; web-desktop primary; web-mobile degraded (snap guides hidden) documented under "Known limitations"
- [x] T7: handoff regression tests added — when `applyHandoffStaticOverrides` runs, `useArtboardDrag`, `SnapGuideOverlay`, `computeSnap`, `useSnapGuides`, `DragStateContext` are all stripped from inlined output. Emitted meta already does not ship positions (handoff only reads `title` + `subtitle`).
- [x] **DDRs captured:**
  - [x] [**DDR-027**](../decisions/DDR-027-artboard-size-jsx-authoritative.md): artboard size = JSX-authoritative; `meta.layout.artboards[]` holds positions only
  - [x] [**DDR-028**](../decisions/DDR-028-snap-tolerance-in-world-units.md): snap tolerance is in world-units, not screen-pixels (gridSize default 40, tolerance default 8)
- [x] `/flow:validate` clean overall (static + tests + build + scenario manual smoke + a11y + DS guard)
- [x] `/flow:review-code` clean — NEEDS-FIXES verdict resolved (C1 multi-drag identity bug + W1 cast-lie fixed + S5 magic-number extracted)
- [ ] Plan archived on `/done` — pending

---

## Non-goals (out of scope)

- **Resize handles** — artboard `width`/`height` stay JSX-authored. Adding drag-to-resize would invert the source-of-truth direction.
- **Z-order shuffling** — overlapping artboards keep their DOM order. No "bring to front" / "send to back" affordance this phase. (Right-click context-menu from Phase 4.1 could surface these later — track as 4.3 candidate.)
- **Nested grouping / frames** — Figma's Frame-inside-Frame is out of scope. Each artboard is a leaf in `meta.layout.artboards[]`.
- **Auto-layout / flex-layout artboards** — artboards don't auto-arrange after a drag. Drop = literal world position.
- **Undo/redo for drag commits** — single-canvas undo isn't infra'd yet. Drag is destructive once committed (the meta.json file is the only history; rely on git). Add when project-wide undo is planned.
- **Touch-precision snap** — touch drag fires drag events but snap guides are hidden on mobile (touch coords are too imprecise for 8-unit snap-tolerance to feel natural).
- **Snap to MiniMap viewport rect** — drag while watching MiniMap doesn't snap to its viewport indicator.
- **Pixi-driver parity** — deferred until a Pixi rendering path exists in canvas-lib (DDR-024 plumbed the bundle but no runtime path wires it to DCArtboard yet).
- **Template / project-side mirror** — N/A per DDR-025 (single source in dev-server).

---

## Retro

- **Visual smoke caught two bugs the unit tests couldn't.** The reader's partial-replace (meta wholesale overwriting defaults, zero-ing out `w`/`h` once writers went position-only) and the `setPointerCapture` click-redirect both rendered the canvas non-functional but passed every reducer + pure-math test. Lesson: for any change that touches the canvas iframe boundary (reader, capture, event routing) drive the dev-server through `agent-browser` before declaring done. The two-helper test layer is necessary but never sufficient.
- **Code review surfaced a third bug the visual smoke missed.** `selectedIds` falling back from `Selection.id` (a child cd-id) to `Selection.artboardId` silently disabled multi-drag — the visual smoke happened to only drag single artboards (no multi-select set up), so the bug was invisible. Lesson: every multi-element interaction needs at least one explicit unit test pinning identity-set construction, even when the integration smoke "works." Extracted `selectionsToArtboardIds` to make the contract testable.
- **DDR-027 + DDR-028 paid for themselves immediately.** Writing DDR-027 forced me to articulate why the reader merge is necessary (legacy-tolerant), and that articulation surfaced the post-Phase-4 default-grid snapshots as the back-compat concern to guard. DDR-028's tolerance-in-world-units rationale would have taken twice as long to reconstruct from code alone in a future debugging session.
- **What to change next plan-execute cycle:** for `/design`-adjacent work, add a mandatory `agent-browser` smoke step between `/flow:execute` and `/flow:validate`. The plan T3 "manual smoke via `screenshot.sh`" was authored but not actually performed during execute; if it had been, the reader+capture bugs would have been caught before code-review even ran. Consider promoting it from "validate step" to "execute exit criterion."
- **`agent-browser`'s `mouse down/move/up` triplet works for drag-and-drop simulation.** Each command is a separate CDP frame, so the React event loop processes them as discrete pointer events — exactly what the hook expects. No need for `playwright`-style higher-level drag helpers.
- **Post-merge dogfooding caught a fourth bug — `useMemo([seeds])` was the wrong shape for `artboards`.** Drag committed to the server but local state never updated, so users had to switch canvases (forcing iframe reload) to see the drop reflected. Fixed by converting to `useState` with optimistic update on commit + `useEffect` re-seed on JSX changes. Lesson: any persistence flow where "the same component both reads and writes the persisted value" needs to use state (not memoized snapshot of the read), or else write-then-read in the same session degrades to "write-then-reload." The unit-tested `commitFromState` returned correct payloads; the smoke confirmed the PATCH landed; what neither verified was the post-PATCH React render. A render-after-commit assertion in the scenario (or a future React Testing Library smoke) would have caught it pre-merge.
