---
name: phase-4.1-figjam-canvas-interactions
status: draft
created: 2026-05-19
decisions: []
amends: phase-4-canvas-v2-rendering-engine.md (T2 selection + wheel routing)
---

# Phase 4.1: FigJam-style canvas interactions

> **Scope.** Phase 4 shipped pan/zoom + MiniMap + ZoomToolbar + Pixi driver + LoD. The interaction *grammar* (wheel = zoom, Cmd-gated hover/select, Cmd+Shift+click = comment) is functional but doesn't match the muscle memory anyone arrives with from Figma / FigJam / Miro. This phase rewires the input grammar end-to-end (wheel routing, hover-driven selection, multi-select, tool modes, right-click context menu) so the canvas *feels* like FigJam without changing the world-plane / Pixi / persistence machinery underneath.

## Description

Replace Phase 4's interaction primitives with a FigJam-equivalent input model:

- **Wheel = pan Y · Shift+wheel = pan X · Cmd/Ctrl+wheel = zoom.** Decouple bare-wheel from zoom (currently bare wheel zooms — non-Figma-native).
- **Hover-driven selection.** No Cmd required. Hover paints a highlight on the topmost interesting element; **Cmd+hover** descends to the deepest element under the cursor. Click persists the highlighted element as selected. Shift+click adds to selection. Cmd+Shift+click adds the deeply-nested element to selection.
- **Tool-mode state machine.** Letter-key shortcuts switch the active tool: `V` move/select (default), `H` hand/pan, `C` comment. Active tool changes cursor + click semantics. Replaces the Phase-4 ad-hoc `Cmd+C` / `Cmd+Shift+click` comment binding.
- **Right-click context menu.** Contextual to where the click lands (artboard chrome / element / empty world / MiniMap) — `Add comment`, `Copy CSS`, `Inspect`, `Hide`, `Lock`, `Fit to view`, `Reset view`, `Add artboard`, etc. New surface entirely; not currently in any plan.

Everything in this phase is per-canvas (lives inside the canvas iframe), reusing the Phase-4 `useViewportController` hook + the existing runtime inspector (`runtime/design-canvas.jsx`). The dev-server shell stays unchanged.

## User Story

As a designer with Figma/FigJam muscle memory, I want bare wheel to pan vertically, Cmd+wheel to zoom, hovering to preview the element I'd select, clicking to persist it, Shift+click to multi-select, and right-click to surface contextual actions — so the canvas behaves the way every other infinite-canvas tool I use behaves and I don't have to learn a bespoke grammar.

## Problem

Phase 4 shipped a working but unfamiliar grammar:

1. **Bare wheel zooms** — every other infinite-canvas tool (Figma, FigJam, Miro, Mural, tldraw) pans on bare wheel and zooms on Cmd/Ctrl+wheel. Users land on the canvas and accidentally zoom when they meant to scroll a long artboard.
2. **Cmd-gated selection** — the inspector requires holding Cmd to highlight or click. There's no resting "what would I select if I clicked right now" preview. Click without Cmd does nothing (or hits browser-default behavior).
3. **No multi-select.** Phase 4 selection is single-element. Bulk operations (multi-comment, multi-inspect) aren't reachable.
4. **No tool modes.** Comment dropping is a chord (`Cmd+Shift+click`) rather than a tool-state. Phase 5 will add draw tools — Phase 5's plan implies a tool framework exists but Phase 4 never built one. Building it once, here, unblocks Phase 5.
5. **No right-click affordances.** Everything goes through the toolbar, keyboard, or chord-hotkey. Power users expect right-click `→ Copy CSS / Lock / Inspect`.

## Solution

Build a per-canvas **input router** module owned by canvas-lib that classifies every pointer/keyboard event into one of: { pan, zoom, hover-preview, select, multi-select, tool-action, context-menu, no-op }. The router consults (a) the active tool from a new tool-mode store and (b) the modifier-key state, then dispatches to the viewport controller (pan/zoom), inspector (hover/select), or new comment/context-menu surfaces.

The router replaces ad-hoc handlers currently sprinkled across `runtime/design-canvas.jsx`, `_lib/canvas-lib.tsx`, and `client/app.jsx`. State lives in two new pieces — `useToolMode()` (canvas-lib) and `useSelectionSet()` (replaces single-element selection in runtime) — both per-canvas-iframe.

## Metadata

- **GitHub Issue**: — (no issue; user-requested in /flow:plan session 2026-05-19)
- **Type**: Enhancement (Phase 4 input grammar refit)
- **Complexity**: High (cross-cuts viewport controller, inspector, comment surface, keyboard map; touches three modules; needs full scenario coverage)
- **App/Package**: `plugins/design` (canvas-lib + runtime + dev-server client)
- **Affected Systems**: pan/zoom (Phase 4), comment-drop (Phase 6 will inherit), selection inspector (`runtime/design-canvas.jsx` + `_active.json` writer)
- **Dependencies**: Phase 4 shipped (✓ as of `db2f896`). Should land before Phase 5 (draw tools) so Phase 5 inherits the tool-mode framework instead of reinventing it.

---

## Context References

### Must-Read Files

- `plugins/design/_lib/canvas-lib.tsx` — Phase 4's `useViewportController`, MiniMap, ZoomToolbar; the wheel handler that this phase replaces lives here. **Why:** the input router slots in front of the existing controller's pan/zoom API; the existing API stays.
- `plugins/design/dev-server/runtime/design-canvas.jsx` (lines 1–60 stylesheet, full file) — current `DesignCanvas` / `DCArtboard` runtime; inspector-driven hover/select today writes to `_active.json`. **Why:** the new selection model replaces the Cmd-gated paint logic here.
- `plugins/design/dev-server/client/app.jsx` lines 1660–1750 (keyboard block), 956 (current docstring `Cmd+Shift+click = comment`), 1581–1595 (Cmd+Shift+click handler), 1684–1700 (Cmd+C handler). **Why:** these existing bindings collide with the new grammar and need rewiring, not just adding-on-top.
- `.ai/plans/phase-4-canvas-v2-rendering-engine.md` lines 105–117 (T2 wheel + spacebar + middle-mouse spec). **Why:** this phase *amends* Phase 4 T2 — wheel routing changes from "zoom around cursor" to "pan Y" by default.
- `.ai/plans/phase-5-draw-tools.md` lines 35–47 (toolbar pen/circle/arrow/eraser shortcuts). **Why:** Phase 5 needs the same tool-mode framework; align the API now.
- `.ai/plans/phase-6-comments-presentation-export.md` lines 60–72 (comment-pin drop flow). **Why:** the C-tool handler replaces the chord-based drop; Phase 6 inherits the new entry path.
- `.ai/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md` — `data-dc-*` attribute schema; the input router uses these to resolve hover/select target identity.

### Files to Create

- `plugins/design/_lib/input-router.tsx` — the per-canvas event classifier + dispatcher
- `plugins/design/_lib/use-tool-mode.tsx` — tool-mode store + `useToolMode()` hook
- `plugins/design/_lib/use-selection-set.tsx` — multi-select state (replaces single `_active.selected`)
- `plugins/design/_lib/context-menu.tsx` — right-click context menu component + registry
- `plugins/design/dev-server/test/input-router.test.ts` — `bun:test` unit tests for the event-classification table
- `.ai/scenarios/canvas-figjam-grammar.md` — cross-platform scenario covering the new grammar
- `.ai/scenarios/canvas-context-menu.md` — scenario for right-click menu

### Files to Update

- `plugins/design/_lib/canvas-lib.tsx` — wire input-router in front of viewport controller; remove inline wheel-zoom logic
- `plugins/design/dev-server/runtime/design-canvas.jsx` — replace Cmd-gated hover with router-driven hover + selection-set integration
- `plugins/design/dev-server/client/app.jsx` — remove `Cmd+C` comment-on-selection chord, remove `Cmd+Shift+click` comment handler, document the new tool-mode shortcuts in the help overlay (line 668 + 956), reconcile letter-key conflicts: existing `H` (toggle hidden) → `Cmd+H`; existing `T` (toggle tree) keeps `T` (no conflict, tools are inside canvas iframe).
- `plugins/design/templates/canvas-lib.tsx.template` — same canvas-lib surface changes mirrored into the template
- `plugins/design/dev-server/runtime/tweaks-panel.jsx` — multi-select aware (apply to N selected elements)
- `_active.json` writer — extend schema: `selected: Selection | null` → `selected: Selection[]` (back-compat: read accepts both, write always emits array)

### Documentation

- [Figma keyboard shortcuts reference](https://help.figma.com/hc/en-us/articles/360040328653) — Why: target grammar we're matching (pan/zoom modifiers, V/H/C tool letters)
- [FigJam interaction primer](https://help.figma.com/hc/en-us/articles/4402301508887) — Why: right-click menu structure + tool-mode patterns (sticky-note tool, comment tool, etc.)
- [`pixi-viewport`](https://github.com/davidfig/pixi-viewport) — Why: their `wheel({ percent, smooth, lineHeight })` plugin already separates pan vs. zoom by modifier; reference the math, don't bundle (per Phase 4 T2 pattern)
- [DDR-007](.ai/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md) — `data-dc-id` schema for stable element identity during selection persistence

### Patterns to Follow

**Tool-mode store shape** (mirror Phase 4's `useViewportController` ergonomics — `useState` + ref, settle callback):

```ts
// _lib/use-tool-mode.tsx
type Tool = 'move' | 'hand' | 'comment';
const ToolContext = createContext<{ tool: Tool; setTool: (t: Tool) => void } | null>(null);
export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<Tool>('move');
  return <ToolContext.Provider value={{ tool, setTool }}>{children}</ToolContext.Provider>;
}
export function useToolMode() {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error('useToolMode outside <ToolProvider>');
  return ctx;
}
```

**Event classification table** (the router's core; example rows — full table in T1):

| Pointer event | Modifiers | Active tool | → Action |
|---|---|---|---|
| `wheel` | none | any | pan Y by `deltaY` |
| `wheel` | shift | any | pan X by `deltaY` |
| `wheel` | cmd \| ctrl | any | zoom around cursor by `deltaY` (existing Phase 4 math) |
| `wheel` | ctrl (from trackpad pinch — `ctrlKey && !explicitCtrlDown`) | any | zoom (pinch — OS synthesizes ctrl) |
| `mousedown` btn=1 (middle) | any | any | begin pan-drag |
| `mousedown` btn=0 | space-held | any | begin pan-drag |
| `mousedown` btn=0 | none | move | persist hover-element as selection (replace set) |
| `mousedown` btn=0 | shift | move | persist hover-element as selection (add to set) |
| `mousedown` btn=0 | cmd+shift | move | persist deepest-hover-element as selection (add to set) |
| `mousedown` btn=0 | none | comment | drop comment pin at cursor |
| `mousedown` btn=2 (right) | any | any | open context menu (target = element under cursor) |
| `mousemove` | none | move | recompute hover (top element) — paint highlight |
| `mousemove` | cmd | move | recompute hover (deepest element) — paint highlight |

The OS-synthesized `ctrlKey` from trackpad pinch is the well-known gotcha — detect by checking `deltaY` magnitude (pinch is usually fractional, scroll is integer) or by tracking whether ctrl was explicitly pressed via keydown.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
|---|---|---|
| `useViewportController` | `plugins/design/_lib/canvas-lib.tsx` (Phase 4) | Pan/zoom API unchanged; router calls `pan()`, `zoom()`, `fit()` as before |
| `DCArtboard` | `plugins/design/dev-server/runtime/design-canvas.jsx` (Phase 4) | Hover/select wiring replaced; data-dc-* attrs unchanged |
| `DCMiniMap`, `DCZoomToolbar` | `plugins/design/_lib/canvas-lib.tsx` (Phase 4) | Unchanged; toolbar gains tool-mode buttons in T3 |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
|---|---|---|
| Canvas Viewport (8 artboards) | `.design/ui/Canvas Viewport.tsx` | Primary scenario fixture (already used by Phase 4 scenarios) |
| Smoke TSX | `.design/ui/Smoke TSX.tsx` | Single-artboard regression check |
| `audience-pro/components-toast-menu.html` | `plugins/design/templates/design-system-inspiration/audience-pro/` | **Pattern prior for right-click context menu** — composition, hierarchy, keyboard-shortcut hints in a contextual menu. Grep'd 2026-05-19; lifting structure (not skin). |

### Icons

| Icon | Library | Size | Usage |
|---|---|---|---|
| `MousePointer2` | Lucide line | 16 | Move/select tool button in toolbar |
| `Hand` | Lucide line | 16 | Hand/pan tool button |
| `MessageCircle` | Lucide line | 16 | Comment tool button |
| `ChevronRight` | Lucide line | 14 | Context-menu submenu affordance |

### Tokens

Reuse the active DS's `--accent`, `--accent-hover`, `--accent-active` for the active-tool indicator + hover highlight. The hover halo and selection halo are already Phase-4 chrome — adopt their existing tokens. No new tokens.

### Custom Components Needed

| Component | Reason | Extends |
|---|---|---|
| `ToolPalette` (in canvas-lib) | Phase 5 will add 5 more tool buttons; need a host component now even though we only ship 3 tools | Float-bottom-left, mirrors `DCZoomToolbar` styling |
| `ContextMenu` | Not in registry; project has zero right-click surfaces today | New — patterns lifted from `components-toast-menu.html` |
| `SelectionHalo` (multi-aware) | Phase 4 ships a single-element halo; needs to render N halos with grouping | Extends Phase 4's `.dc-selection-halo` CSS class |

---

## Tasks

Execute in order. Each task is atomic and testable. **Pattern priors first** — before writing any new compositional element, grep `.design/ui/*.tsx` and `plugins/design/templates/design-system-inspiration/` for similar shapes (per DDR-010 and CLAUDE.md "Pattern priors come first").

### Task 1: CREATE `_lib/input-router.tsx` with full event-classification table

- **Do:** Pure function `classify(event, { activeTool, modifiers, spaceHeld, hoverTarget })` returning a discriminated union of actions. Plus a React hook `useInputRouter(hostRef)` that attaches the listeners and dispatches through callbacks (`onPan`, `onZoom`, `onSelect`, `onContextMenu`, etc.). No DOM mutation in the classifier — all side effects happen in callbacks. Implement the trackpad-pinch heuristic (fractional `deltaY` + `ctrlKey` synthesized).
- **Pattern:** Reuse `useViewportController` callback ergonomics from `_lib/canvas-lib.tsx` (Phase 4 T2). Listener attachment scoped to `hostRef.current` (canvas iframe boundary) so shell-level shortcuts don't collide.
- **Gotcha:** macOS Safari/Chrome synthesize `ctrlKey: true` on trackpad pinch — distinguishing from real Ctrl+wheel requires deltaY-magnitude check. Document the heuristic in code + add explicit test cases. Browser middle-click (mousedown btn=1) auto-scrolls on Windows — `preventDefault` on the mousedown.
- **Validate:** `bun test plugins/design/dev-server/test/input-router.test.ts` — table-driven unit test of the classifier matrix (cover every row in the Patterns table + edge cases: wheel during space-held, right-click while drag-panning, comment-tool active during space-pan).

### Task 2: CREATE `_lib/use-tool-mode.tsx` + `<ToolProvider>` + global letter-key shortcuts

- **Do:** Tool-mode context + provider per the snippet in **Patterns to Follow**. Global keydown listener (scoped to canvas iframe): `V` → move, `H` → hand, `C` → comment, `Esc` → move (cancel). Cursor changes on `document.body`: move = `default`, hand = `grab` (`grabbing` while panning), comment = `crosshair`. Skipped when `inEditable` (input/textarea/contentEditable focused).
- **Pattern:** Mirror `app.jsx` lines 1666–1750 keyboard-shortcut block — same `inEditable` check, same `meta = metaKey || ctrlKey` idiom.
- **Gotcha:** **Key collisions with shell shortcuts** — `H` currently toggles "show hidden" in the dev-server shell sidebar (`app.jsx`), `T` toggles tree, `C` is unused at shell level but Cmd+C drops a comment. Resolution:
  - Tool-mode shortcuts fire **only inside the canvas iframe** (their listener is attached to canvas-lib's host, not `window`). The shell's `H`/`T` listeners (which run at `window` scope but `e.preventDefault()` only when sidebar is focused) need updating — make shell shortcuts no-op when `document.activeElement` is inside a canvas iframe. Add this check in `app.jsx` onKey.
  - Remove `Cmd+C → drop comment` chord (`app.jsx` lines 1684–1700). Comment-drop is now `C` (enter comment tool) → click. Migration: add a one-cycle deprecation log line `console.warn` if `Cmd+C` is pressed with a selection — point to `C` key.
- **Validate:** `bun test` — tool-mode unit test covers `V`/`H`/`C`/`Esc` transitions and the `inEditable` guard. Boot dev-server: press `C` inside a canvas → cursor becomes crosshair, ToolPalette highlights Comment; press `V` → returns to default; press `H` in canvas → hand tool (and **does not** toggle sidebar hidden mode). Press `H` in sidebar → still toggles hidden.

### Task 3: CREATE `_lib/use-selection-set.tsx` + extend `_active.json` schema

- **Do:** `useSelectionSet()` returns `{ selected: Selection[], replace(s), add(s), remove(s), clear() }`. A `Selection` is `{ artboardId, selector, dcId? }`. Persist via the existing `_active.json` writer; change the schema from `selected: Selection | null` to `selected: Selection[]`. Reader accepts both shapes for one cycle (single-element gets wrapped in array on read). Producer always emits array.
- **Pattern:** Reuse the `_active.json` write path already in `runtime/design-canvas.jsx`; only the payload shape changes. Mirror Phase 4's settle-debounce (50ms) so rapid Shift-clicks coalesce into one write.
- **Gotcha:** `/design:edit "feedback"` reads `_active.selected` to scope the edit; today it assumes single-element. If we ship multi-select before updating the command, the edit command silently picks `selected[0]`. Acceptable for this phase **only because** `/design:edit` is still single-target — adding multi-target edits is an explicit non-goal. Document this assumption in the writer.
- **Validate:** Open Canvas Viewport, click CV-01, Shift+click CV-03, Shift+click CV-05 → `cat .design/_active.json` shows three entries. Cmd+click on bare canvas → array clears. Run `/design:edit "tweak the heading"` → command picks `selected[0]` and proceeds (existing behavior preserved).

### Task 4: REFACTOR `_lib/canvas-lib.tsx` — wire input-router in front of `useViewportController`

- **Do:** Replace the inline wheel handler with `useInputRouter` callbacks. `onPan({ dx, dy }) → viewport.pan(dx, dy)`; `onZoom({ factor, cx, cy }) → viewport.zoomAt(factor, cx, cy)`. Remove the bare-wheel-zoom branch. Spacebar tracking moves from canvas-lib into the router (with `spaceHeld` modifier flag). Middle-mouse pan moves too. The viewport controller's public API (`pan`, `zoom`, `fit`, `zoomTo`) stays byte-identical.
- **Pattern:** Phase 4 T2 spec at `.ai/plans/phase-4-canvas-v2-rendering-engine.md:107-117` — this task **amends T2**: lines 107 ("Wheel = zoom around cursor") and 109 ("Spacebar + drag = pan") become router-owned, with wheel routing changing per the classification table.
- **Gotcha:** Phase 4 T7 swapped CSS-transform driver for Pixi.js. Both drivers consume the same `pan()`/`zoom()` API — the router doesn't care which driver is active. Verify smoke on both (CSS driver via Smoke TSX, Pixi via Canvas Viewport).
- **Validate:** Open Canvas Viewport. Wheel (no modifier) → world pans vertically; Shift+wheel → pans horizontally; Cmd+wheel → zooms around cursor. Space+drag → pan. Middle-mouse drag → pan. Cmd+0 / Cmd+= / Cmd+- still work (untouched, they were keyboard-only). MiniMap + ZoomToolbar still work. Trackpad pinch still zooms (heuristic from T1 active).

### Task 5: REFACTOR `runtime/design-canvas.jsx` — hover-driven selection (no Cmd required)

- **Do:** Replace the current Cmd-gated paint logic with router-driven hover. `onHoverChange({ target, deep })` paints the halo on the matched element. Default `target` resolution = topmost interactive element with a `data-dc-id` ancestor; `deep = metaKey held` resolves to deepest descendant with a `data-dc-id`. Selection persistence (click) goes through `useSelectionSet`. Halo CSS adapts: single selection = solid 2px outline; multi-selection = solid outline per element + dashed group bbox.
- **Pattern:** Reuse existing `.dc-selection-halo` styles (lines 35–60 of `design-canvas.jsx`). The `data-dc-id` walk is already in Phase 4 — only the trigger condition changes.
- **Gotcha:** Hover-without-Cmd previously did nothing — now it constantly recomputes the hover target. Heavy DOM (50-artboard perf canvas) might thrash. Use `requestAnimationFrame` coalescing + `pointerMove` (not `mouseMove`) for better trackpad sampling. Compare FPS in T7 perf scenario before/after.
- **Validate:** Hover over CV-03 (no modifier) → halo on top-level artboard chrome. Hold Cmd while hovering → halo descends to deepest element under cursor. Click → halo persists. Shift+click another element → both halos remain. Esc → clear selection.

### Task 6: CREATE `_lib/context-menu.tsx` + register right-click handler

- **Do:** `<ContextMenu>` floating component, positioned at cursor. Sections + items registered via a `ContextRegistry` that the router queries with `{ target, activeTool, selectionSet }`. Built-in items:
  - **On element (`data-dc-id` ancestor present):** Add comment · Copy CSS · Copy `data-dc-id` · Inspect (toggle tweaks-panel) · Hide · Lock
  - **On artboard chrome:** Rename · Duplicate · Reset position · Fit just this artboard (Cmd+0 equivalent for one artboard)
  - **On empty world (`data-dc-canvas` only):** Paste artboard · Fit to view · Reset view (Cmd+0)
  - **On MiniMap / ZoomToolbar:** Hide MiniMap · Hide Toolbar (re-enable via View menu — out of scope this phase; for now leave a `console.warn`)
  - Each item shows its keyboard shortcut hint right-aligned (mirror `components-toast-menu.html` structure).
- **Pattern:** **Pattern prior** — `plugins/design/templates/design-system-inspiration/audience-pro/components-toast-menu.html` lines 30+ (right-click context menu with keyboard-shortcut hints). Lift composition: hairline border, monospace shortcut hints, section separators.
- **Gotcha:** Browser native context menu still wants to fire — `preventDefault` on `contextmenu`. Keyboard equivalent: Menu key (rare) or Shift+F10. Inside the canvas iframe, `oncontextmenu` propagates to the shell — confirm it stops at the canvas-lib host.
- **Validate:** Right-click on CV-03 heading → menu shows Add comment / Copy CSS / Inspect / Hide / Lock + shortcuts. Right-click on artboard chrome → menu shows Rename / Duplicate / Reset / Fit. Right-click on empty world → Paste / Fit / Reset. Menu dismisses on Esc / click-outside / scroll.

### Task 7: CREATE `<ToolPalette>` floating UI inside canvas-lib

- **Do:** Bottom-left floating panel (mirrors `DCZoomToolbar` styling). Three buttons (V move, H hand, C comment) with active-tool highlight. Tooltips show letter-key shortcut. Outside `.dc-world` (doesn't pan/zoom with world, per Phase 4 T3 pattern).
- **Pattern:** `.zoom-tb` styling from Phase 4 T3 (`Canvas Viewport.tsx` CV-01 reference); same hairline-bordered, mono-labeled, hard-edged buttons. Same outside-of-world placement as MiniMap.
- **Gotcha:** Phase 5 (draw tools) will add 5 more buttons (pen, circle, arrow, eraser, color picker) — design ToolPalette for arbitrary tool count from day one. The tool registry is open: any consumer can register a tool via `<ToolProvider tools={[...]}>`. Phase 5 inherits this.
- **Validate:** Open any canvas → ToolPalette visible bottom-left, V highlighted by default. Click H → highlight moves to H, body cursor becomes `grab`. Press `Esc` → returns to V. Toolbar buttons + keyboard shortcuts agree (clicking H emits same tool change as pressing H).

### Task 8: UPDATE `client/app.jsx` — remove deprecated chords, update help overlay, isolate shell shortcuts from canvas

- **Do:**
  - Remove `Cmd+Shift+click → start composer` handler (lines 1581–1595).
  - Remove `Cmd+C → comment on selected` (lines 1684–1700). Log deprecation warning for one cycle.
  - In the global onKey handler, early-return when `document.activeElement` is inside a canvas iframe (so `H`/`T` letter-keys don't double-fire — they're now tool-mode shortcuts inside canvas + sidebar shortcuts outside).
  - Update the help overlay (line 668 `Element selection` block and line 956 doc string) to document the new grammar: hover = preview, click = select, Shift+click = add, Cmd+Shift+click = add nested, V/H/C = tool modes, right-click = context menu.
- **Pattern:** existing `inEditable` guard on every shortcut — extend to `inCanvasIframe`.
- **Gotcha:** `Cmd+Shift+M` (toggle comments panel) stays — comments panel exists at shell level. Don't accidentally lose it.
- **Validate:** Press `H` while focused in sidebar tree → toggles hidden. Press `H` while focused in canvas → hand tool. Press `Cmd+Shift+M` → toggles comments panel (unchanged). Press `Cmd+C` with a selection → no comment-drop, deprecation warning in console, system copy works.

### Task 9: UPDATE `templates/canvas-lib.tsx.template` — mirror canvas-lib changes for `mdcc init`

- **Do:** Re-emit canvas-lib template so new projects scaffold with the input router + tool-mode framework. Diff `_lib/canvas-lib.tsx` against the template, port additions verbatim.
- **Gotcha:** The template is the source of truth for new projects via `cli/commands/init.mjs`. The dogfooded `.design/_lib/canvas-lib.tsx` in this repo is **regenerated** from the template — don't edit one without the other. Per CLAUDE.md "Dev-server runtime contract" section.
- **Validate:** `mdcc init --dry-run` against a tmp scratch dir → emitted canvas-lib contains `useInputRouter`, `useToolMode`, `useSelectionSet`.

### Task 10: CREATE scenarios `canvas-figjam-grammar` + `canvas-context-menu`

- **Do:** Two scenarios under `.ai/scenarios/`. **`canvas-figjam-grammar`**: open Canvas Viewport → bare wheel pans Y → Shift+wheel pans X → Cmd+wheel zooms → space+drag pans → middle-mouse pans → hover paints halo without Cmd → click persists → Shift+click multi-selects → Cmd+Shift+click adds nested → V/H/C tool keys swap cursor → reload restores selection-set. **`canvas-context-menu`**: right-click on element → menu shows + shortcut hints align right → Esc dismisses → right-click on empty world → different menu items → click Reset view → world fits.
- **Pattern:** Phase 4's `canvas-runtime-tour` scenario is the closest existing one — same canvas (Canvas Viewport), same step granularity.
- **Validate:** `flow:scenario-runner` runs both across web-desktop + web-mobile. Mobile is degraded mode for non-touch gestures (Cmd+wheel etc.) — accept; document gracefully.

### Task 11: PERF check on multi-artboard hover

- **Do:** Reuse `.design/_lab/perf-50-artboards.tsx` (built in Phase 4 T7). Continuously move the cursor across all 50 artboards under (a) CSS driver, (b) Pixi driver. Assert ≥ 55 fps with hover-recompute active (the new always-on hover is the concern; pan/zoom perf is already vetted).
- **Validate:** Write the report to `.ai/logs/phase-4.1-hover-perf-{date}.md`. If below 55 fps under CSS driver, the rAF coalescing in T5 needs tightening — block this task on hitting target.

---

## Validation

Run these commands to confirm zero regressions:

1. **Types** (skipped — no tsc setup in this repo per CLAUDE.md "no test suite, lint config, or build step")
2. **Bun tests**: `cd plugins/design/dev-server && bun test` — must hit 123/123 (Phase 4 baseline) + the new input-router + tool-mode + selection-set tests
3. **Manual smoke**: boot dev-server (`npm run dev`), open Canvas Viewport, walk the canvas-figjam-grammar scenario by hand
4. **Cross-platform scenario** (UI tasks): spawn `scenario-runner` for `canvas-figjam-grammar` + `canvas-context-menu` across web-desktop + web-mobile (mobile = degraded; accept). Web-desktop must be **0 blockers**.
5. **Design System Guard**: spawn `design-system-guard` subagent — ToolPalette + ContextMenu must not introduce hardcoded colors, must hit `--accent` tokens
6. **A11y**: spawn `a11y-auditor` — ContextMenu must be keyboard-reachable (Shift+F10 or Menu key; arrow keys navigate items; Esc dismisses); ToolPalette buttons must have `aria-label` + `aria-pressed`
7. **Phase 4 regression**: rerun `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` — must still pass (zero UX diff on pan/zoom math; new wheel routing is the only behavioral change)
8. **Handoff filter**: run `/design:handoff` on Canvas Viewport → registry must NOT include input-router / tool-mode / context-menu code (per Phase 4 T7 "strip authoring-time engine exports" — extend `canvas-lib-inline.ts` strip list)

---

## Scenario Coverage (UI tasks — required)

| Scenario | Covers | Status |
|---|---|---|
| `canvas-figjam-grammar` | New wheel routing, hover-driven select, multi-select, tool-mode shortcuts, persisted selection-set | 🆕 new |
| `canvas-context-menu` | Right-click menu on element / artboard chrome / empty world; keyboard reachability | 🆕 new |
| `canvas-runtime-tour` (Phase 4) | Regression — pan/zoom basics still work after router replaces inline handlers | ✅ existing |
| `canvas-runtime-pan-zoom-50-artboards` (Phase 4) | Regression — perf budget held; **new** hover-recompute under stress | ✅ existing (extended) |

`/done` runs `scenario-runner` across 5 platforms. The two new scenarios must have web-desktop runners at minimum; mobile/iOS/Android are degraded-mode (touch gestures aren't in scope — comment in scenario file).

---

## Acceptance Criteria

- [ ] T1: `_lib/input-router.tsx` ships with full classification table + `bun test` covers every row
- [ ] T2: `useToolMode` + V/H/C/Esc shortcuts work inside canvas iframe, do **not** collide with shell H/T
- [ ] T3: `_active.json` is `selected: Selection[]`; reader back-compatible with single-element shape for one cycle
- [ ] T4: canvas-lib wheel routing matches Figma — bare wheel = pan Y, Shift+wheel = pan X, Cmd+wheel = zoom. Spacebar + middle-mouse pan unchanged behaviorally
- [ ] T5: hover paints halo without Cmd; Cmd+hover descends to deepest element; click persists into selection-set
- [ ] T6: right-click menu shows context-appropriate items with shortcut hints, dismisses on Esc / outside-click; keyboard-reachable
- [ ] T7: ToolPalette renders bottom-left, tracks active tool, registers V/H/C; designed for Phase 5 tool extensibility
- [ ] T8: shell `Cmd+C` / `Cmd+Shift+click` comment chords removed; shell H/T don't fire inside canvas iframe; help overlay documents new grammar
- [ ] T9: `templates/canvas-lib.tsx.template` mirrors `_lib/canvas-lib.tsx`; `mdcc init` scaffolds with new framework
- [ ] T10: both scenarios run green on web-desktop; mobile = degraded with rationale
- [ ] T11: perf gate ≥ 55 fps with hover-recompute under 50-artboard stress, both drivers
- [ ] `/flow:utils-verify` clean after each task
- [ ] `/flow:validate` clean overall:
  - [ ] Bun tests pass
  - [ ] `scenario-runner`: 0 blockers, parity_ok=true on the two new scenarios + Phase 4 regression
  - [ ] `design-system-guard`: 0 blockers
  - [ ] `a11y-auditor`: 0 blockers (right-click menu keyboard reachability is the bar)
- [ ] **DDR-worthy decisions captured:**
  - DDR: trackpad-pinch vs Ctrl+wheel disambiguation heuristic (which signal we trust, why)
  - DDR: tool-mode framework extensibility contract (Phase 5 inherits this; lock the API now)
  - DDR: selection-set as `_active.selected: Selection[]` schema migration + back-compat window
- [ ] CLAUDE.md updated if any new convention emerged (likely: "tool-mode shortcuts are canvas-iframe scoped, not window scoped")
- [ ] Plan archived on `/done` per `.ai/plans/README.md` lifecycle

---

## Non-goals (out of scope)

- **Drawing tools** — Phase 5 owns pen/circle/arrow/eraser. This phase only ships the tool-mode framework Phase 5 will plug into.
- **Multi-target `/design:edit`** — edit command still operates on `selected[0]`. Multi-target editing is its own (future) decision.
- **Touch gestures** — pinch-to-zoom-on-touch, two-finger-pan-on-touch. Mobile scenarios are degraded.
- **Box-select / rubber-band** — drag-from-empty-world to multi-select N artboards. Strong FigJam feature, but deferred — needs collision-detection math that isn't trivial under Pixi LoD. Track as Phase 4.2 candidate.
- **Snap-to-other-artboard during drag-reposition** — Phase 4's plan didn't add artboard repositioning; this phase doesn't either.
- **Layers panel / CSS editor** — Phase 12 owns those.
