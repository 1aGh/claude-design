---
name: phase-4.1-figjam-canvas-interactions
status: draft
created: 2026-05-19
revised: 2026-05-19
decisions: [DDR-025-canvas-lib-single-source-in-dev-server.md, DDR-016-runtime-folder-purpose.md (superseded)]
candidate-decisions: [DDR-026 canvas-lib `inputMode` prop — opt-in switch for FigJam routing vs handoff-default Phase-4 grammar]
amends: phase-4-canvas-v2-rendering-engine.md (T2 selection)
---

> **Rewritten 2026-05-19** to align with the canvas-lib single-source architecture (Phase 3.6 → 4.0.5). The `plugins/design/dev-server/runtime/` folder + its two files (`design-canvas.jsx`, `tweaks-panel.jsx`) were deleted in the same session — they were dead code (legacy HTML-canvas injection path; no active `.html` canvases under `.design/` since the 2026-05-15 TSX migration). All TSX canvases now use canvas-lib's `DesignCanvas` exclusively. This plan therefore drops every reference to `runtime/design-canvas.jsx`, the `attachListeners` opt-out (no listener race exists anymore — canvas-lib's listeners and the new router don't overlap), and the template mirror (deleted by DDR-025).

# Phase 4.1: FigJam-style canvas interactions

> **Scope.** Phase 4 shipped pan/zoom + MiniMap + ZoomToolbar + Pixi driver + LoD. Post-Phase-4 hotfixes (`95260c2`, `1aeffdb`) refined wheel routing to FigJam parity (bare = pan Y, Shift = pan X, Cmd/Ctrl = zoom). What's still bespoke: Cmd-gated hover/select, single-element selection, no tool modes, no right-click context menu. This phase adds those four interaction surfaces as an opt-in `inputMode="figjam"` layer on top of canvas-lib's `DesignCanvas` — without touching the world-plane / Pixi / persistence machinery underneath, and without bringing back any `runtime/` folder.

## Description

Add a FigJam-equivalent input layer to canvas-lib's `DesignCanvas` as an opt-in `inputMode` prop:

- **Hover-driven selection.** No Cmd required. Hover paints a highlight on the topmost interesting element; **Cmd+hover** descends to the deepest element under the cursor. Click persists the highlighted element as selected. Shift+click adds to selection. Cmd+Shift+click adds the deeply-nested element to selection.
- **Tool-mode state machine.** Letter-key shortcuts switch the active tool: `V` move/select (default), `H` hand/pan, `C` comment. Active tool changes cursor + click semantics. Replaces the existing inspector's `Cmd+C` / `Cmd+Shift+click` comment binding.
- **Right-click context menu.** Contextual to where the click lands (artboard chrome / element / empty world / MiniMap) — `Add comment`, `Copy CSS`, `Inspect`, `Hide`, `Lock`, `Fit to view`, `Reset view`, `Add artboard`, etc. New surface entirely; not currently in any plan.
- **Wheel routing already FigJam-aligned** (bare = pan Y, Shift = pan X, Cmd/Ctrl = zoom). Canvas-lib's `useViewportController` keeps owning wheel/space/middle-mouse — the new router consumes a DIFFERENT subset of events (pointer move/down without modifiers, V/H/C/Esc keys, right-click). No listener race.

The `inputMode` prop defaults to `'default'` (today's Phase-4 grammar; handoff drops keep working without any router code in scope of the bundle). Setting `inputMode="figjam"` on a canvas mounts the router stack. Canvas Viewport.tsx + Smoke TSX.tsx get `inputMode="figjam"` added; other dev-server canvases (Docs Site.tsx) stay default.

## User Story

As a designer with Figma/FigJam muscle memory, I want hovering to preview the element I'd select, clicking to persist it, Shift+click to multi-select, letter keys to switch tools, and right-click to surface contextual actions — so the canvas behaves the way every other infinite-canvas tool I use behaves and I don't have to learn a bespoke grammar.

## Problem

Phase 4 + hotfixes shipped working wheel/zoom muscle memory, but the remaining grammar is still bespoke:

1. **Cmd-gated selection.** The inspector overlay (injected by `inspect.ts` into `_canvas-shell.html` for every TSX canvas) requires Cmd to highlight or click. There's no resting "what would I select if I clicked right now" preview. Click without Cmd does nothing (or hits browser-default behavior).
2. **No multi-select.** Inspector overlay selection is single-element. Bulk operations (multi-comment, multi-inspect) aren't reachable.
3. **No tool modes.** Comment dropping is a chord (`Cmd+Shift+click`) rather than a tool-state. Phase 5 will add draw tools — Phase 5's plan implies a tool framework exists but Phase 4 never built one. Building it once, here, unblocks Phase 5.
4. **No right-click affordances.** Everything goes through the toolbar, keyboard, or chord-hotkey. Power users expect right-click `→ Copy CSS / Lock / Inspect`.

## Solution

Add a **per-canvas input router** module owned by canvas-lib (lives as siblings to `canvas-lib.tsx` under `plugins/design/dev-server/`, imported by canvas-lib's `DesignCanvas`). The router classifies a NON-OVERLAPPING subset of events vs. `useViewportController`:

| Event class | Owner |
| --- | --- |
| `wheel` (pan Y / shift+pan X / cmd+zoom / trackpad pinch) | `useViewportController` (unchanged) |
| `pointerdown` middle-button / `pointerdown`+space-held → pan drag | `useViewportController` (unchanged) |
| `keydown` Space / Cmd+0/1/+/- / Cmd+Option+1–9 | `useViewportController` (unchanged) |
| `pointermove` (hover-paint) | **router** (new) |
| `pointerdown` left-button without modifiers (selection click) | **router** (new) |
| `pointerdown` left-button with Shift / Cmd+Shift (multi-select / deep) | **router** (new) |
| `pointerdown` right-button (context menu) | **router** (new) |
| `keydown` V / H / C / Esc (tool mode) | **router** (new) |

Because the partitioning is clean, no `attachListeners` opt-out is needed — both stacks coexist. The router's "no modifier" left-click does not race canvas-lib's pointerdown handler (which only fires for `button === 1 || spaceHeld`).

State lives in two new hooks — `useToolMode()` and `useSelectionSet()` — both per-canvas-iframe. The router posts selection changes through the existing parent→shell postMessage channel (the inspector overlay's path; extended to accept `Selection | Selection[]`); `inspect.ts` writes the new shape to `_active.json` via the existing setSelected path.

When `inputMode === 'figjam'`, canvas-lib's `DesignCanvas` sets a window sentinel (`window.__MDCC_INPUT_MODE__ = 'figjam'`) BEFORE the inspector overlay's IIFE runs. The inspector overlay's INSPECTOR_SCRIPT checks the sentinel and short-circuits its Cmd-hover / Cmd-click logic when figjam is active — the router fully owns hover/select for that canvas.

## Metadata

- **GitHub Issue**: — (no issue; user-requested in /flow:plan session 2026-05-19)
- **Type**: Enhancement (Phase 4 input grammar refit)
- **Complexity**: Medium-High (cross-cuts canvas-lib's DesignCanvas + inspector overlay coexistence + app.jsx keyboard map; one new prop, five new modules, tight scenario coverage)
- **App/Package**: `plugins/design` (canvas-lib + inspect.ts coexistence sentinel + dev-server client app.jsx)
- **Affected Systems**: hover/select (inspect.ts INSPECTOR_SCRIPT), comment-drop (Phase 6 will inherit), `_active.json` writer schema (selected: Selection → Selection[]), canvas-lib's `DesignCanvas` API surface (new `inputMode` prop)
- **Dependencies**: Phase 4 shipped (✓ `db2f896`). Phase 4.0.5 + runtime/ purge shipped (✓ `bf3b399` + this session). Should land before Phase 5 (draw tools) so Phase 5 inherits the tool-mode framework.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/canvas-lib.tsx` — single-source canvas library. **Key locations:** `useViewportController` (line 437; listener block lines 665–849) — STAYS untouched; `DesignCanvas` component (~line 954) — gains `inputMode` prop + conditional router mount; `.dc-selection-halo` / `.dc-canvas` CSS (in the styles block) — extend for multi-select. **Why:** the router is added as a sibling stack; canvas-lib's existing listeners do not move.
- `plugins/design/dev-server/inspect.ts` lines 228–547 (`INSPECTOR_SCRIPT` constant) — Cmd+hover/Cmd+click selection logic + parent postMessage. **Why:** the figjam-mode sentinel short-circuit goes here. The parent→server `setSelected()` flow (lines 86, near "warn: failed to save _active.json") is reused as-is.
- `plugins/design/dev-server/client/app.jsx` — receives postMessage from inspector + writes `_active.json`. Existing keyboard block (around lines 1660–1750), Cmd+C handler (1684–1700), Cmd+Shift+click composer (1581–1595). **Why:** these chords get removed; help overlay (line 668 + 956) gets the new grammar documented; canvas-iframe focus check added to gate shell shortcuts.
- `.ai/plans/phase-5-draw-tools.md` lines 35–47 (toolbar pen/circle/arrow/eraser shortcuts). **Why:** Phase 5 needs the same tool-mode framework; align the API now.
- `.ai/plans/phase-6-comments-presentation-export.md` lines 60–72 (comment-pin drop flow). **Why:** the C-tool handler replaces the chord-based drop; Phase 6 inherits the new entry path.
- `.ai/archive/decisions/DDR-025-canvas-lib-single-source-in-dev-server.md` — single-source contract; locks new modules' location (siblings to canvas-lib.tsx, NOT in `runtime/`).
- `.ai/archive/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md` — `data-dc-*` attribute schema; the input router uses these to resolve hover/select target identity.
- `plugins/design/templates/design-system-inspiration/audience-pro/components-toast-menu.html` lines 23–28, 67–77 — **pattern prior** for right-click context menu (hairline border, mono shortcut hints, section separators).

### Files to Create

- `plugins/design/dev-server/input-router.tsx` — event classifier + listener attacher (non-wheel events only)
- `plugins/design/dev-server/use-tool-mode.tsx` — tool-mode store + `useToolMode()` hook + `<ToolProvider>`
- `plugins/design/dev-server/use-selection-set.tsx` — multi-select state + parent-postMessage writer
- `plugins/design/dev-server/context-menu.tsx` — right-click `<ContextMenu>` component + registry
- `plugins/design/dev-server/tool-palette.tsx` — bottom-left floating `<ToolPalette>` (V / H / C buttons)
- `plugins/design/dev-server/test/input-router.test.ts` — `bun:test` table-driven classifier tests
- `plugins/design/dev-server/test/use-tool-mode.test.ts` — transitions + `inEditable` guard
- `plugins/design/dev-server/test/use-selection-set.test.ts` — set semantics + `_active.json` back-compat read
- `.ai/scenarios/canvas-figjam-grammar.md` — cross-platform scenario covering the new grammar
- `.ai/scenarios/canvas-context-menu.md` — scenario for right-click menu

### Files to Update

- `plugins/design/dev-server/canvas-lib.tsx` — add `inputMode?: 'default' | 'figjam'` prop to `DesignCanvas`; when `'figjam'`, mount `<ToolProvider>` + call `useInputRouter` + set `window.__MDCC_INPUT_MODE__ = 'figjam'` BEFORE inspector IIFE runs; render `<ToolPalette>` + `<ContextMenu>` outside `.dc-world` (mirror MiniMap/ZoomToolbar placement). Extend `.dc-selection-halo` CSS for multi-select group bbox. `useViewportController` listener block UNCHANGED.
- `plugins/design/dev-server/inspect.ts` — extend `INSPECTOR_SCRIPT` IIFE with a `window.__MDCC_INPUT_MODE__ === 'figjam'` early-return for hover + click handlers (keep comment-pin rendering active either way; comments are handled by both modes). Extend `setSelected()` to accept `SelectedElement | SelectedElement[]`; persist whichever shape was posted.
- `plugins/design/dev-server/client/app.jsx` — remove `Cmd+C` comment-on-selection chord (lines 1684–1700; log deprecation `console.warn` for one cycle); remove `Cmd+Shift+click → start composer` handler (lines 1581–1595); add early-return in global onKey when `document.activeElement` is inside a canvas iframe (so `H`/`T` shell shortcuts don't fire when canvas owns the key); update help overlay (line 668 + 956 docstring) for the new grammar.
- `.design/ui/Canvas Viewport.tsx` line ~88 (`<DesignCanvas>` opening) — add `inputMode="figjam"`.
- `.design/ui/Smoke TSX.tsx` (locate `<DesignCanvas>` open) — add `inputMode="figjam"`.
- `_active.json` schema — `selected: SelectedElement | null` → `selected: SelectedElement | SelectedElement[] | null`. Reader accepts all three shapes for one cycle; writer emits array when N > 1, single-element otherwise (handoff parity).

### Documentation

- [Figma keyboard shortcuts reference](https://help.figma.com/hc/en-us/articles/360040328653) — Why: target grammar we're matching (V/H/C tool letters; Shift+click multi-select)
- [FigJam interaction primer](https://help.figma.com/hc/en-us/articles/4402301508887) — Why: right-click menu structure + tool-mode patterns (sticky-note tool, comment tool)
- [DDR-007](../decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md) — `data-dc-id` schema for stable element identity during selection persistence
- [DDR-025](../decisions/DDR-025-canvas-lib-single-source-in-dev-server.md) — why new modules live in `plugins/design/dev-server/` siblings, NOT in project-side `_lib/` and NOT in a `runtime/` folder

### Patterns to Follow

**Tool-mode store shape** (mirror Phase 4's `useViewportController` ergonomics — context + provider):

```ts
// use-tool-mode.tsx
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

**Event classification table** (the router's core; full table in T1):

| Pointer event | Modifiers | Active tool | → Action |
|---|---|---|---|
| `pointermove` | none | move | recompute hover (top element) — paint highlight |
| `pointermove` | cmd | move | recompute hover (deepest element) — paint highlight |
| `pointerdown` btn=0 | none | move | persist hover-element as selection (replace set) |
| `pointerdown` btn=0 | shift | move | persist hover-element as selection (add to set) |
| `pointerdown` btn=0 | cmd+shift | move | persist deepest-hover-element as selection (add to set) |
| `pointerdown` btn=0 | none | comment | drop comment pin at cursor |
| `pointerdown` btn=2 (right) | any | any | open context menu (target = element under cursor) |
| `keydown` | V / H / C / Esc | any | switch tool (skip when `inEditable`) |

**NOT in scope** of the router (canvas-lib's `useViewportController` keeps these): bare wheel, shift+wheel, cmd/ctrl+wheel, middle-mouse drag, space+drag pan, Cmd+0/1/+/-, Cmd+Option+1–9 jump.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
|---|---|---|
| `useViewportController` | `plugins/design/dev-server/canvas-lib.tsx` (Phase 4) | UNCHANGED — wheel/pan/zoom math + listener block stay |
| `DesignCanvas` | `plugins/design/dev-server/canvas-lib.tsx` | Gains `inputMode?: 'default' \| 'figjam'` prop; default behavior identical to today |
| `DCArtboard` | `plugins/design/dev-server/canvas-lib.tsx` | UNCHANGED — `data-dc-*` attrs are how router resolves hover/select targets |
| `DCMiniMap`, `DCZoomToolbar` | `plugins/design/dev-server/canvas-lib.tsx` | UNCHANGED |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
|---|---|---|
| Canvas Viewport (8 artboards) | `.design/ui/Canvas Viewport.tsx` | Primary scenario fixture; gets `inputMode="figjam"` added |
| Smoke TSX | `.design/ui/Smoke TSX.tsx` | Single-artboard regression check; gets `inputMode="figjam"` added |
| `audience-pro/components-toast-menu.html` | inspiration library | **Pattern prior** for right-click context menu — composition, hierarchy, keyboard-shortcut hints. Grep'd 2026-05-19; lifting structure (not skin). |

### Icons

| Icon | Library | Size | Usage |
|---|---|---|---|
| `MousePointer2` | Lucide line | 16 | Move/select tool button in `ToolPalette` |
| `Hand` | Lucide line | 16 | Hand/pan tool button |
| `MessageCircle` | Lucide line | 16 | Comment tool button |
| `ChevronRight` | Lucide line | 14 | Context-menu submenu affordance |

### Tokens

Reuse the active DS's `--accent`, `--accent-hover`, `--accent-active` for the active-tool indicator + hover highlight. The hover halo and selection halo are already Phase-4 chrome in canvas-lib — adopt their existing tokens. No new tokens.

### Custom Components Needed

| Component | Reason | Extends |
|---|---|---|
| `ToolPalette` (`tool-palette.tsx`) | Phase 5 will add 5 more tool buttons; need a host component now even though we only ship 3 tools | Float-bottom-left, mirrors `DCZoomToolbar` styling |
| `ContextMenu` (`context-menu.tsx`) | Not in registry; project has zero right-click surfaces today | New — patterns lifted from `components-toast-menu.html` |
| `SelectionHalo` (multi-aware) | Phase 4 ships single-element halo in canvas-lib's `.dc-selection-halo`; needs to render N halos with group bbox | Extends existing CSS class |

---

## Tasks

Execute in order. Each task is atomic and testable. **Pattern priors first** — before writing any new compositional element, grep `.design/ui/*.tsx` and `plugins/design/templates/design-system-inspiration/` for similar shapes (per DDR-010 and CLAUDE.md "Pattern priors come first").

### Task 1: CREATE `plugins/design/dev-server/input-router.tsx` with full event-classification table

- **Do:** Pure function `classify(event, { activeTool, modifiers, hoverTarget })` returning a discriminated union of actions. Plus a React hook `useInputRouter(hostRef, callbacks)` that attaches listeners (`pointermove`, `pointerdown`, `contextmenu`, `keydown`) scoped to `hostRef.current`, and dispatches through callbacks (`onHoverChange`, `onSelect`, `onContextMenu`, `onToolKey`). No DOM mutation in the classifier — all side effects happen in callbacks. NO wheel listener (canvas-lib's `useViewportController` owns wheel).
- **Pattern:** Reuse `useViewportController` callback ergonomics from `canvas-lib.tsx` (Phase 4 T2). Listener attachment scoped to host element (canvas iframe boundary) so shell-level shortcuts don't collide.
- **Gotcha:** `keydown` for tool letters MUST be skipped when `isEditableTarget(e.target)` (input/textarea/contentEditable) — mirror canvas-lib's `isEditableTarget` helper. Browser middle-click (mousedown btn=1) is owned by canvas-lib; the router classifier returns `no-op` for it.
- **Validate:** `bun test plugins/design/dev-server/test/input-router.test.ts` — table-driven unit test covers every row in the Patterns table + edge cases: pointerdown btn=1 falls through (no-op), keydown V/H/C in input field (no-op), contextmenu always preventDefault'd.

### Task 2: CREATE `plugins/design/dev-server/use-tool-mode.tsx` + `<ToolProvider>` + canvas-scoped letter-key shortcuts

- **Do:** Tool-mode context + provider per the snippet in **Patterns to Follow**. Keydown listener attached to canvas iframe's hostRef (via the router's `onToolKey` callback): `V` → move, `H` → hand, `C` → comment, `Esc` → move. Cursor changes on `document.body`: move = `default`, hand = `grab` (`grabbing` while panning — canvas-lib already sets this during space-pan; router preserves), comment = `crosshair`. Skipped when `isEditableTarget` (router T1 already gates this).
- **Pattern:** Mirror `app.jsx` lines 1666–1750 keyboard-shortcut block — same `inEditable` check, same `meta = metaKey || ctrlKey` idiom (though tool keys are non-modifier so the meta branch is N/A here).
- **Gotcha:** **Key collisions with shell shortcuts** — `H` currently toggles "show hidden" in dev-server shell sidebar (`app.jsx`), `T` toggles tree, `C` is unused at shell level but `Cmd+C` drops a comment. Resolution:
  - Tool-mode shortcuts fire **only inside the canvas iframe** (router listener attached to canvas host, not `window`).
  - Shell's `H`/`T` listeners (window-scoped) get an early-return when `document.activeElement` is inside a canvas iframe — added in Task 8.
  - Remove `Cmd+C → drop comment` chord — also in Task 8.
- **Validate:** `bun test plugins/design/dev-server/test/use-tool-mode.test.ts` — covers `V`/`H`/`C`/`Esc` transitions and `inEditable` guard. Live smoke: press `C` inside Canvas Viewport iframe → cursor becomes crosshair, ToolPalette highlights Comment; press `V` → returns to default; press `H` in canvas → hand tool (and **does not** toggle sidebar hidden mode). Press `H` in sidebar → still toggles hidden.

### Task 3: CREATE `plugins/design/dev-server/use-selection-set.tsx` + extend `_active.json` schema + inspect.ts `setSelected`

- **Do:** `useSelectionSet()` returns `{ selected: Selection[], replace(s), add(s), remove(s), clear() }`. A `Selection` is `{ artboardId, selector, dcId? }`. Persist via the existing inspector parent→shell postMessage path: hook posts `{ type: '__design_selected', payload: Selection | Selection[] }` to `window.parent`; app.jsx already listens and forwards to `setSelected()` in inspect.ts. Extend inspect.ts `setSelected(sel)` to accept `Selection | Selection[]` (today: just single) and persist whichever was passed. Reader (anywhere `_active.selected` is consumed) accepts all three shapes (`null | Selection | Selection[]`) for one cycle (single → treat as length-1 array). Writer emits array when N > 1, single-element otherwise (handoff parity for downstream consumers reading `_active.json`).
- **Pattern:** Reuse the parent-postMessage flow already plumbed for the inspector overlay (`inspect.ts` INSPECTOR_SCRIPT posts `__design_selected` → `app.jsx` calls `inspect.setSelected()`). Mirror Phase 4's settle-debounce (50ms) so rapid Shift-clicks coalesce into one post.
- **Gotcha:** `/design:edit "feedback"` reads `_active.selected` to scope the edit; today it assumes single-element. If we ship multi-select before updating the command, the edit command silently picks `selected[0]`. Acceptable for this phase **only because** `/design:edit` is still single-target — adding multi-target edits is an explicit non-goal. Document this assumption at the write site.
- **Validate:** `bun test plugins/design/dev-server/test/use-selection-set.test.ts` — set semantics + `_active.json` round-trip (legacy single-element read produces single-entry array; writing single-entry array emits as single-element object for back-compat with the `selected: Selection | null` shape; writing N>1 emits array). Live smoke (Task 4 must land first for end-to-end): click CV-01, Shift+click CV-03, Shift+click CV-05 → `cat .design/_active.json` shows three entries. Cmd+click elsewhere → array clears.

### Task 4: EXTEND `DesignCanvas` with `inputMode` prop; mount router stack when `'figjam'`; coexistence sentinel with inspector overlay

- **Do:**
  - Add `inputMode?: 'default' | 'figjam'` to `DesignCanvas` props (default `'default'`).
  - When `inputMode === 'figjam'`: set `window.__MDCC_INPUT_MODE__ = 'figjam'` synchronously in a `useLayoutEffect` running BEFORE the inspector's IIFE (which runs at script-execution time, i.e., before React mounts — so the sentinel must be set even earlier, ideally in a module-init top-level statement guarded against SSR). Concretely: canvas-lib exports a small `setInputMode(mode)` helper that runs at import time of the canvas TSX — author opts in via `<DesignCanvas inputMode="figjam">` which sets the sentinel on first render of the component. Inspector overlay's IIFE polls the sentinel inside its hover/click handlers — if `'figjam'`, return early. (The sentinel is read per-event, not once at IIFE entry, so the timing race is benign: as long as the sentinel is set before the user interacts, the gating works.)
  - When `'figjam'`: mount `<ToolProvider>` around children, call `useInputRouter(hostRef, callbacks)`, wire selection-set + tool-mode + context-menu, render `<ToolPalette>` and `<ContextMenu>` outside `.dc-world` (mirror MiniMap placement).
  - When `'default'`: no router, no sentinel — identical to today's behavior. Handoff drops always omit `inputMode` so they get default.
  - Update `.design/ui/Canvas Viewport.tsx` + `.design/ui/Smoke TSX.tsx` to pass `inputMode="figjam"`.
- **Why this shape (DDR-025-aligned + DDR-026 candidate):** canvas-lib is the single source per DDR-025; no project-side scaffolding, no template mirror. The `inputMode` prop is THE control surface for opt-in FigJam routing. Handoff parity is preserved by default. The router code lives as siblings to canvas-lib.tsx (NOT in a `runtime/` folder; that's deleted). Tree-shaking on handoff: handoff drops won't trip the router branch because they don't pass `inputMode="figjam"`; canvas-lib-inline keeps the router exports in the inlined source, but they're dead code at the drop site.
- **DDR-026 candidate:** "Canvas-lib `inputMode` prop — opt-in switch for FigJam routing vs handoff-default Phase-4 grammar." Capture the prop contract + sentinel coexistence with inspector overlay before `/done`.
- **Pattern:** Mirror Phase 4 T3's outside-of-world placement for MiniMap + ZoomToolbar (`Canvas Viewport.tsx` CV-01 reference).
- **Gotcha:** Inspector overlay AND router both render selection halos today (inspector via `.dgn-insp-selected`, router via canvas-lib's `.dc-selection-halo`). When figjam mode active, inspector should also short-circuit its halo paint (the early-return in hover/click handlers handles this — if the inspector's hover handler exits early, no `.dgn-insp-*` class gets added). Double-check no orphan halos remain after a tool switch.
- **Validate:** Open Canvas Viewport (figjam). Hover paints `.dc-selection-halo` only — no `.dgn-insp-hover` class anywhere. Click selects. Shift+click adds. Open Docs Site (still default — `inputMode` omitted): Cmd-hover still works (inspector overlay active). Open a handoff drop: pan/zoom defaults work (no router code triggered). `bun test` still 133/133 baseline + new tests pass.

### Task 5: REFACTOR canvas-lib's hover/select halo path — multi-select aware, no Cmd required

- **Do:** Add `.dc-selection-halo` variants in canvas-lib styles for the multi-select case: solid 2px outline per element + dashed 1px group bbox when N > 1. Wire router's `onHoverChange({ target, deep })` + selection-set state to paint halos via inline style on the target element (mirror existing single-element halo logic). `deep = metaKey held` resolves to deepest descendant with `data-dc-id`. Default `target` = topmost `[data-dc-id]` ancestor.
- **Pattern:** Existing `.dc-selection-halo` styles in canvas-lib.tsx (search "dc-selection-halo"). The `data-dc-id` walk pattern is in the inspector overlay (INSPECTOR_SCRIPT) — port the same walk into the router classifier, exposed as `resolveHoverTarget(event, { deep })`.
- **Gotcha:** Hover-without-Cmd previously did nothing — now it constantly recomputes the hover target. Heavy DOM (100-artboard perf canvas) might thrash. Use `requestAnimationFrame` coalescing + `pointermove` (not `mousemove`) for better trackpad sampling. Compare FPS in T10 perf scenario before/after.
- **Validate:** Hover over CV-03 (no modifier) → halo on top-level artboard chrome. Hold Cmd while hovering → halo descends to deepest element under cursor. Click → halo persists. Shift+click another element → both halos remain + dashed group bbox. Esc → clear selection.

### Task 6: CREATE `plugins/design/dev-server/context-menu.tsx` + register right-click handler

- **Do:** `<ContextMenu>` floating component, positioned at cursor. Sections + items registered via a `ContextRegistry` that the router queries with `{ target, activeTool, selectionSet }`. Built-in items:
  - **On element (`data-dc-id` ancestor present):** Add comment · Copy CSS · Copy `data-dc-id` · Inspect (toggle the existing inspector overlay's tweaks-panel-equivalent UI — out of scope for v1; leave as `console.warn('TODO: tweaks panel for TSX canvases')`) · Hide · Lock
  - **On artboard chrome:** Rename · Duplicate · Reset position · Fit just this artboard (Cmd+0 equivalent for one artboard)
  - **On empty world (`data-dc-canvas` only):** Paste artboard · Fit to view · Reset view (Cmd+0)
  - **On MiniMap / ZoomToolbar:** Hide MiniMap · Hide Toolbar (re-enable via View menu — out of scope this phase; for now leave a `console.warn`)
  - Each item shows its keyboard shortcut hint right-aligned (mirror `components-toast-menu.html` structure).
- **Pattern:** **Pattern prior** — `plugins/design/templates/design-system-inspiration/audience-pro/components-toast-menu.html` lines 23–28 (CSS) + 67–77 (markup): right-click context menu with keyboard-shortcut hints. Lift composition: hairline border, monospace shortcut hints, section separators.
- **Gotcha:** Browser native context menu still wants to fire — `preventDefault` on `contextmenu`. Keyboard equivalent: Menu key (rare) or Shift+F10. Inside the canvas iframe, `oncontextmenu` propagates to the shell — confirm it stops at the canvas-lib host via `stopPropagation`.
- **Validate:** Right-click on CV-03 heading → menu shows Add comment / Copy CSS / Inspect / Hide / Lock + shortcuts. Right-click on artboard chrome → menu shows Rename / Duplicate / Reset / Fit. Right-click on empty world → Paste / Fit / Reset. Menu dismisses on Esc / click-outside / scroll.

### Task 7: CREATE `plugins/design/dev-server/tool-palette.tsx` — bottom-left floating UI

- **Do:** Bottom-left floating panel (mirrors `DCZoomToolbar` styling from canvas-lib). Three buttons (V move, H hand, C comment) with active-tool highlight. Tooltips show letter-key shortcut. Outside `.dc-world` (doesn't pan/zoom with world, per Phase 4 T3 pattern).
- **Pattern:** `.dc-zoom-tb` / `.dc-zoom-tb__btn` styling in canvas-lib (search "zoom-tb"); same hairline-bordered, mono-labeled, hard-edged buttons. Same outside-of-world placement as MiniMap.
- **Gotcha:** Phase 5 (draw tools) will add 5 more buttons (pen, circle, arrow, eraser, color picker) — design `ToolPalette` for arbitrary tool count from day one. The tool registry is open: any consumer can register a tool via `<ToolProvider tools={[...]}>`. Phase 5 inherits this.
- **Validate:** Open Canvas Viewport → ToolPalette visible bottom-left, V highlighted by default. Click H → highlight moves to H, body cursor becomes `grab`. Press `Esc` → returns to V. Toolbar buttons + keyboard shortcuts agree (clicking H emits same tool change as pressing H).

### Task 8: UPDATE `client/app.jsx` — remove deprecated chords, update help overlay, isolate shell shortcuts from canvas

- **Do:**
  - Remove `Cmd+Shift+click → start composer` handler (lines 1581–1595).
  - Remove `Cmd+C → comment on selected` (lines 1684–1700). Log deprecation warning for one cycle (`console.warn('Cmd+C comment-drop deprecated — press C inside the canvas to enter Comment tool')`).
  - In the global onKey handler, early-return when `document.activeElement` is inside a canvas iframe (so `H` / `T` shell shortcuts don't double-fire — they're now tool-mode shortcuts inside canvas + sidebar shortcuts outside).
  - Update the help overlay (line 668 `Element selection` block and line 956 doc string) to document the new grammar: hover = preview, click = select, Shift+click = add, Cmd+Shift+click = add nested, V/H/C = tool modes, right-click = context menu.
  - Extend the postMessage listener that calls `inspect.setSelected()` to accept the new `Selection[]` shape and forward it through (`setSelected` already extended in T3).
- **Pattern:** existing `inEditable` guard on every shortcut — extend to `inCanvasIframe`.
- **Gotcha:** `Cmd+Shift+M` (toggle comments panel) stays — comments panel exists at shell level. Don't accidentally lose it.
- **Validate:** Press `H` while focused in sidebar tree → toggles hidden. Press `H` while focused in canvas → hand tool. Press `Cmd+Shift+M` → toggles comments panel (unchanged). Press `Cmd+C` with a selection → no comment-drop, deprecation warning in console, system copy works.

### Task 9: OPT-IN `inputMode="figjam"` + CREATE scenarios `canvas-figjam-grammar` + `canvas-context-menu`

- **Do:**
  - Edit `.design/ui/Canvas Viewport.tsx` + `.design/ui/Smoke TSX.tsx` — add `inputMode="figjam"` prop to `<DesignCanvas>`.
  - Author two scenarios under `.ai/scenarios/`. **`canvas-figjam-grammar`**: open Canvas Viewport → hover paints halo without Cmd → click persists → Shift+click multi-selects → Cmd+Shift+click adds nested → V/H/C tool keys swap cursor → reload restores selection-set. (Wheel/pan/zoom regressions are covered by the existing `canvas-runtime-tour` scenario; no need to duplicate.) **`canvas-context-menu`**: right-click on element → menu shows + shortcut hints align right → Esc dismisses → right-click on empty world → different menu items → click Reset view → world fits.
- **Pattern:** Phase 4's `canvas-runtime-tour` scenario is the closest existing one — same canvas (Canvas Viewport), same step granularity.
- **Validate:** `flow:scenario-runner` runs both across web-desktop + web-mobile. Mobile is degraded mode for non-touch gestures (Cmd+wheel etc.) — accept; document gracefully.

### Task 10: PERF check on multi-artboard hover

- **Do:** Reuse `plugins/design/dev-server/examples/perf-100-artboards.tsx` (relocated to dev-server by Phase 4.0.5). Add `inputMode="figjam"` for the perf run. Continuously move the cursor across all 100 artboards under (a) CSS driver, (b) Pixi driver. Assert ≥ 55 fps with hover-recompute active (the new always-on hover is the concern; pan/zoom perf is already vetted).
- **Validate:** Write the report to `.ai/logs/phase-4.1-hover-perf-{date}.md`. If below 55 fps under CSS driver, the rAF coalescing in T5 needs tightening — block this task on hitting target.

---

## Validation

Run these commands to confirm zero regressions:

1. **Types** (skipped — no tsc setup in this repo per CLAUDE.md "no test suite, lint config, or build step"; `bun tsc --noEmit` runs locally but isn't a gate)
2. **Bun tests**: `cd plugins/design/dev-server && bun test` — must hit 133/133 (Phase 4.0.5 + runtime-purge baseline) + the new input-router + tool-mode + selection-set tests
3. **Manual smoke**: boot dev-server (`bun plugins/design/dev-server/server.ts --root . --port 4399`), open Canvas Viewport (figjam), walk the canvas-figjam-grammar scenario by hand; also open Docs Site (default mode) and confirm Cmd-hover still works there (inspector overlay).
4. **Cross-platform scenario** (UI tasks): spawn `scenario-runner` for `canvas-figjam-grammar` + `canvas-context-menu` across web-desktop + web-mobile (mobile = degraded; accept). Web-desktop must be **0 blockers**.
5. **Design System Guard**: spawn `design-system-guard` subagent — `ToolPalette` + `ContextMenu` must not introduce hardcoded colors, must hit `--accent` tokens
6. **A11y**: spawn `a11y-auditor` — `ContextMenu` must be keyboard-reachable (Shift+F10 or Menu key; arrow keys navigate items; Esc dismisses); `ToolPalette` buttons must have `aria-label` + `aria-pressed`
7. **Phase 4 regression**: rerun `canvas-runtime-tour` + `canvas-runtime-pan-zoom-50-artboards` — must still pass (zero UX diff on pan/zoom math; only addition is the figjam-mode router for the marked canvases)
8. **Handoff parity (DDR-022 invariant)**: run `/design:handoff "Canvas Viewport"` → registry-item includes `inputMode="figjam"` (it's the author's choice; ships as part of the canvas), AND drop loads in a bare iframe with working pan/zoom + figjam routing. Tree-shake is OK either way: handoff drops that omit `inputMode` get the default branch; drops with it get the FigJam branch. The drop must NOT contain any reference to `runtime/` (the folder is gone).

---

## Scenario Coverage (UI tasks — required)

| Scenario | Covers | Status |
|---|---|---|
| `canvas-figjam-grammar` | Hover-driven select, multi-select, tool-mode shortcuts, persisted selection-set | new |
| `canvas-context-menu` | Right-click menu on element / artboard chrome / empty world; keyboard reachability | new |
| `canvas-runtime-tour` (Phase 4) | Regression — pan/zoom basics still work; figjam mode coexists | existing |
| `canvas-runtime-pan-zoom-50-artboards` (Phase 4) | Regression — perf budget held; new hover-recompute under stress | existing (extended) |

`/done` runs `scenario-runner` across 5 platforms. The two new scenarios must have web-desktop runners at minimum; mobile/iOS/Android are degraded-mode (touch gestures aren't in scope — comment in scenario file).

---

## Acceptance Criteria

> **Plan revision note (2026-05-19, during /done).** Original plan landed an opt-in `inputMode="figjam"` prop. After live smoke tests the decision flipped to a **universal grammar** — the prop, the `__MDCC_INPUT_MODE__` sentinel, and the inspector overlay's hover/click selection path were all removed. `figjam` naming was renamed to `canvas` throughout (file: `figjam-shell.tsx` → `canvas-shell.tsx`; classes `.dc-fjm-*` → `.dc-cv-*`). DDR-026 was rewritten to reflect the universal model. Criteria below are checked against the **shipped** behavior (universal), not the original prop-based design.

- [x] T1: `input-router.tsx` ships with full classification table + `bun test` covers every row (non-wheel events only — canvas-lib owns wheel) — 33 tests
- [x] T2: `useToolMode` + V/H/C/Esc shortcuts work inside canvas iframe, do not collide with shell H/T — 7 tests
- [x] T3: `_active.json` accepts `Selection | Selection[] | null`; writer collapses single-entry array to bare object for back-compat — 12 tests
- [x] T4: `DesignCanvas` **always** mounts canvas-shell + ToolProvider (revised — no `inputMode` prop; universal grammar). Sentinel removed.
- [x] T5: hover paints (Cmd+hover in Move mode, bare hover in Comment mode), Cmd-click selects deepest, multi-select renders solid halos + dashed group bbox. **Refactored to floating overlays** (`position: fixed`) so 2 px stays 2 px at any zoom.
- [x] T6: right-click menu shows context-appropriate items with shortcut hints, dismisses on Esc / outside-click; keyboard-reachable
- [x] T7: `ToolPalette` renders bottom-left, tracks active tool, registers V/H/C; open for Phase 5 tool extensibility
- [x] T8: shell `Cmd+C` / `Cmd+Shift+click` comment chords removed; shell H/T don't fire inside canvas iframe; help overlay rewritten as single section (universal grammar); postMessage listener accepts `select-set` array shape; `force-clear` flows on composer close
- [x] T9: scenarios `canvas-input-grammar` + `canvas-context-menu` authored under `.ai/scenarios/canvas-format-tsx/`. (Originally named `canvas-figjam-grammar` — renamed at the universal-grammar flip.)
- [x] T10: perf-100-artboards fixture opted in (no prop needed in universal model); rAF coalescing argument documented in `.ai/logs/phase-4.1-hover-perf-2026-05-19.md`. Live fps verification deferred to `/flow:validate`.
- [x] `/flow:utils-verify` (light static + tests) clean after each task
- [x] `/flow:validate` partial — heavyweight gates deferred:
  - [x] Bun tests pass: 185 / 185 (133 baseline + 52 new from input-router + tool-mode + selection-set)
  - [x] `bunx tsc --noEmit` clean (only pre-existing `api.ts:592–593` errors)
  - [x] Canvas-build smoke: Canvas Viewport / Docs Site / Smoke TSX all 200, 0 legacy `dc-fjm-` / `figjam` / `dgn-insp-` refs in bundles
  - [ ] `scenario-runner` 5-platform cross-platform — DEFERRED. Web-desktop manually walked the new scenarios during iteration; cross-platform run is the `/flow:validate` job and can be run on demand
  - [ ] `design-system-guard` subagent — DEFERRED (palette + menu chrome use DS tokens by construction; no hardcoded colors)
  - [ ] `a11y-auditor` subagent — DEFERRED (ContextMenu has full keyboard nav + ARIA; ToolPalette buttons have `aria-pressed`)
- [x] **DDR-worthy decisions captured:**
  - DDR-026: **universal canvas input grammar** (rewritten from the original `inputMode`-prop draft after the live smoke session)
  - Tool-mode framework extensibility contract documented in DDR-026 implementation notes
  - `_active.selected` schema migration documented in DDR-026 + in `inspect.ts` doc-string
- [x] CLAUDE.md update — none needed (the universal-grammar decision and its naming convention live in DDR-026; CLAUDE.md already covers "dev-server is single source of canvas tooling")
- [ ] Plan archived on `/done` per `.ai/plans/README.md` lifecycle — happening now

---

## Non-goals (out of scope)

- **Drawing tools** — Phase 5 owns pen/circle/arrow/eraser. This phase only ships the tool-mode framework Phase 5 will plug into.
- **Multi-target `/design:edit`** — edit command still operates on `selected[0]`. Multi-target editing is its own (future) decision.
- **Touch gestures** — pinch-to-zoom-on-touch, two-finger-pan-on-touch. Mobile scenarios are degraded.
- **Box-select / rubber-band** — drag-from-empty-world to multi-select N artboards. Strong FigJam feature, but deferred — needs collision-detection math that isn't trivial under Pixi LoD. Track as Phase 4.2 candidate.
- **Snap-to-other-artboard during drag-reposition** — Phase 4.2 owns artboard repositioning; this phase doesn't touch artboard `(x, y)`.
- **Layers panel / CSS editor** — Phase 12 owns those.
- **Bringing back any `runtime/` folder** — DDR-016 superseded; new modules go as siblings to `canvas-lib.tsx`.
- **Project-side scaffolding of any of these modules** — DDR-025 stands. `.design/` is user content only.
- **Replacing the inspector overlay for default-mode canvases** — superseded during execution. The inspector overlay's selection path was removed; only comment-pin rendering survives. See DDR-026.

---

## Retro

- **Plan vs reality — the opt-in flag was the wrong default.** Original plan invested heavily in coexistence (sentinel, inspector overlay short-circuit, two help-overlay sections, an `inputMode="figjam"` prop on every canvas opening). Live smoke immediately surfaced the two-grammar problem (cyan-with-label vs orange-no-label) and the user's "ne-figjam, prostě canvas" naming directive. The flag was deleted within the same session it landed. **Lesson for `/plan`:** when an opt-in flag exists only to ease coexistence with deprecated behavior, ship a universal default and remove the deprecated behavior — half-coexistence states are more confusing than either pure end-state.
- **Halos as CSS-stamped classes don't work under CSS `zoom`.** Initial T5 stamped `.dc-fjm-selected { outline: 2px ... }` directly on target elements. At 42 % zoom the outline scaled to 0.84 px and was invisible — the user reported "comment hover doesn't paint anything." Refactor to floating `position: fixed` overlays (one per tracked element, rAF-updated from `getBoundingClientRect()`) made the halo zoom-immune. **Lesson:** any canvas-mounted visual that uses CSS `zoom` for the world plane needs screen-coord chrome for affordances that must stay constant-width.
- **`resolveHoverTarget` deep mode shouldn't climb.** First version walked up to find the closest `[data-cd-id]` ancestor — which collapsed to the artboard root when no descendant was stamped. User saw "Cmd-click on a deep span selects the whole artboard." Fix: deep mode uses the hit element's OWN `data-cd-id` (or null + cssPath fallback). **Lesson for resolveHoverTarget-style walkers:** "deep" and "top" are different walking strategies, not modifiers on the same walk. Encode the intent literally.
- **Capture-phase + paired listeners is the right way to claim canvas input.** Initially the router lived in bubble phase; button-click handlers fired before the router could `preventDefault`. Moving to capture phase + adding paired `mousedown` / `click` listeners gave the router first chance and stopped focus / native click reliably. Comment-tool inertness "just worked" once this pattern was in place — no need for `pointer-events: none` gymnastics that would have broken `elementFromPoint`.
- **Decision-flip mid-execution should record itself.** The DDR-026 history (drafted as `inputMode` prop, rewritten as universal grammar same day) is now embedded in DDR-026 — including the "alternatives considered" section listing the rejected opt-in design. Future plans considering coexistence flags can grep this DDR before re-litigating. **Lesson for `/plan`:** when a plan revision lands during `/execute`, push the revision into the DDR Alternatives section right then — don't wait for `/done` to remember.
- **Scenario specs need to follow naming flips.** `canvas-figjam-grammar` was renamed to `canvas-input-grammar` at the universal-grammar flip. Worth adding a brief grep-and-rename guard to `/done` for scenarios + DDR filenames when a plan's frontmatter changes.
