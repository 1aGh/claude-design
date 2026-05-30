# Phase 21 — Annotation vocabulary expansion (FigJam-feel)

> Builds on Phase 5 (`phase-5-draw-tools.md`) + Phase 5.1 (`phase-5.1-annotations-figjam.md`). Both archived. Same schema, same render path, same selection store — this phase only EXTENDS them with new shape types and per-shape options.

## Description

Today the annotation toolkit ships `pen / rect / ellipse / arrow / text (anchored only) / eraser`. Real review workflows that the user keeps reaching FigJam for need three things we don't have:

1. **Sticky notes** — colored cards with their own multi-line text, draggable, resizable. The single annotation primitive everyone names first when they say "I miss FigJam".
2. **Standalone text** — text on canvas not anchored to a host shape (today you must double-click a rect/ellipse to add text — orphan labels and free-floating callouts aren't expressible).
3. **Shape and arrow polish** — rect corner radius (square / soft / pill), arrow head direction (start / end / both / none = line) and arrowhead style (triangle / circle / bar). The current arrow always ships a triangle on `(x1,y1)→(x2,y2)`, rect always renders sharp 90° corners.

Out of scope (deliberately deferred): triangle / diamond / hexagon shapes, freeform polygon, stamps/emoji, connectors that snap to artboard anchors, sticky-note auto-layout grids. The brief explicitly says "nemusíme mít úplně vše" — we ship a 3-item core that closes the FigJam parity gap users actually feel.

## User Story

As a designer reviewing a canvas, I want to drop a yellow sticky on a button with "approve copy?", connect it with a soft-corner rect to a side-note text label, and recolor the arrow to a single-headed dashed line — without leaving the canvas or asking a teammate to "just open FigJam for this one comment".

## Problem

Concrete gaps the user hits today (verbatim from the brief):

- **Sticky note** — there is no sticky-equivalent. Workaround = filled rect + double-click + type. The result has no resize handles after the first commit (handle is wired for stroke shapes, not for text-bearing cards), no padding around the text, no visual cue that this is an "annotation" vs a "design element", and the colors live in the stroke palette so they read as ink, not paper.
- **Rounded corners** — `rect` writes `<rect>` without `rx`/`ry`. FigJam ships a 3-step radius selector (square / soft / pill) and the absence is the most-noticed visual gap when porting a Figma mock review into Maude.
- **Arrow direction / shape** — `ArrowStroke` is hardcoded end-only with a triangle head. Users want: line (no head), back-arrow (start-only), two-way (both ends), and at least one head variant beyond triangle. The serialization (`<g><line/><polyline/></g>`) doesn't even round-trip extra metadata yet.

## Solution

| Concern | Approach |
| ------- | -------- |
| Sticky note (new primitive) | New `StickyStroke` type `{ id, tool: 'sticky', x, y, w, h, color, text, fontSize }`. Rendered as a paper-tone rect with a `foreignObject` containing a `<div>` for word-wrapped text. Drag-create on the canvas (default 200×160), double-click to edit, resize handles reuse `use-annotation-resize.tsx`. Distinct palette of paper tints (yellow / pink / blue / green / purple / paper-white) — wholly separate from the stroke palette. |
| Standalone text | Relax `TextStroke.anchorId` to optional. Add new world-coord `(x, y)` for unanchored text. Existing anchored text untouched (back-compat — `anchorId` still present and parsed). New tool `'text'` (shortcut `T`) — single-click on empty world drops a 1-line editable text node, Enter commits. Context toolbar exposes color + fontSize. |
| Rect corner radius | Add optional `cornerRadius` field to `RectStroke` (number, defaults `0`). Context toolbar shows 3 chips (`0` / `8` / `999` for pill) when a rect is selected. Sticky inherits the same field but defaults `8`. |
| Arrow heads | Extend `ArrowStroke` with `startHead?: 'none' \| 'triangle'` and `endHead?: 'none' \| 'triangle'` (`endHead` defaults `'triangle'`, `startHead` defaults `'none'` — back-compat). Add `dashed?: boolean`. Context toolbar gains a 4-segment direction toggle (none / start / end / both) and a dash chip. Triangle is the only head style this phase — circle/bar deferred until a real user asks. |
| Schema round-trip | Bump SVG `data-tool` set: `sticky`, plus `data-r` on rect for cornerRadius, `data-start-head` / `data-end-head` / `data-dash` on arrow. Standalone text writes `x`+`y` attributes and no `data-anchor-id`. Parser falls back to current behavior when new attributes are absent — the existing `.annotations.svg` files keep loading byte-identical. |
| Tool palette | Add two icon buttons: Sticky (`N` shortcut — "Note", since `S` is taken by Shift-marquee) + Text (`T`). Both behave as draw-tools — sticky-tool double-click lock applies. |
| Undo / persist | Reuse `commitStrokes` + `AnnotationStrokesCommand` — every new mutation routes through the same undo sink (DDR-049). Zero new command types. |

## Metadata

- **GitHub Issue**: — (drive-by; brief in command-args)
- **Type**: Enhancement (Phase 5.1 follow-up)
- **Complexity**: Medium (one new schema type, two field extensions, two new tools, three new toolbar chip groups; no new render path, no new undo command, no new server route)
- **App/Package**: `plugins/design` — dev-server only
- **Depends on**: Phase 5.1 (annotations-figjam) + Phase 20 (canvas-undo-redo, command sink). Both archived.
- **Parallel with**: None — annotations layer is owned by this phase end-to-end.
- **Affected files**:
  - `plugins/design/dev-server/annotations-layer.tsx` — extend `Stroke` union (`+StickyStroke`), bump `RectStroke` + `ArrowStroke` + `TextStroke`, extend `strokeToSvgEl` / `svgToStrokes` / `strokeBBox` / `strokeHitTest` / `translateOne` / `isStrokeMeaningful` / `normalizeRect`, add sticky inline editor, register tool branches in `beginStroke` / `moveStroke` / `endStroke`.
  - `plugins/design/dev-server/annotations-context-toolbar.tsx` — new chip groups (cornerRadius for rect/sticky, arrowDir + dash for arrow, fontSize already wired), recompute `caps`.
  - `plugins/design/dev-server/use-tool-mode.tsx` — register `sticky` + `text` descriptors (cursor: `crosshair` for sticky, `text` for text-standalone).
  - `plugins/design/dev-server/input-router.tsx` — extend `Tool` union with `'sticky' | 'text'`, classify `N` and `T`, add to `ANNOTATION_TOOLS` set.
  - `plugins/design/dev-server/tool-palette.tsx` — add sticky + text to `DRAW_TOOLS`, ensure icons resolve.
  - `plugins/design/dev-server/canvas-icons.tsx` — add `IconSticky` + `IconText` + register in `TOOL_ICONS`.
  - `plugins/design/dev-server/use-annotation-resize.tsx` — extend hit-target detector so sticky strokes get resize handles (currently shape-typed to rect/ellipse only).
  - `plugins/design/dev-server/test/annotations-layer.test.ts` — round-trip tests for sticky, standalone text, corner radius, arrow heads (4 directions × 2 dash states), back-compat parse of pre-Phase-21 SVGs.
  - `plugins/design/dev-server/test/use-annotation-selection.test.tsx` — no change expected; selection store is shape-agnostic.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/annotations-layer.tsx:50-99` — Stroke union types; this is where the new `StickyStroke` lives and where `RectStroke` / `ArrowStroke` / `TextStroke` get their optional fields.
- `plugins/design/dev-server/annotations-layer.tsx:165-200` — `strokeToSvgEl` writer. Three branches today (text / pen / rect / ellipse / arrow); add a fourth for sticky, extend rect (rx/ry) and arrow (heads, dasharray).
- `plugins/design/dev-server/annotations-layer.tsx:221-294` — `svgToStrokes` parser. Same branches need the symmetric read path. Critical: keep back-compat — every new attribute is optional with a sensible default.
- `plugins/design/dev-server/annotations-layer.tsx:313-381` — hit-test + bbox + meaningfulness + normalize-rect. All four need a sticky branch (rect-shaped, but text-bearing).
- `plugins/design/dev-server/annotations-layer.tsx:604-613` — `translateOne`. Sticky moves like rect; standalone text moves like a point.
- `plugins/design/dev-server/annotations-layer.tsx:681-689` — `isDraw` + `supportsThickness` + `supportsFill` flags. These gate the contextual chrome — extend for `sticky` / `text`.
- `plugins/design/dev-server/annotations-layer.tsx:885-963` — `beginStroke` / `moveStroke` / `endStroke`. Pattern to mirror for sticky (drag-create rect) and text (single-click commit).
- `plugins/design/dev-server/annotations-layer.tsx:1264-1316` — `commitText` + double-click editor. The sticky inline editor reuses this state machine but with a `foreignObject` host instead of an absolute-positioned overlay.
- `plugins/design/dev-server/annotations-context-toolbar.tsx:203-219` — `caps` intersection. Add `cornerRadius` (rect-or-sticky-only), `arrowDir` (arrow-only), `dash` (arrow-only). `fontSize` already supports `text`; extend to `sticky`.
- `plugins/design/dev-server/use-tool-mode.tsx:38-51` — `DEFAULT_TOOLS` registry. Two new entries; cursors `crosshair` (sticky drag) and `text` (text I-beam).
- `plugins/design/dev-server/input-router.tsx:66-149` — `Tool` union + key classifier + `ANNOTATION_TOOLS` set. All three need updating.
- `plugins/design/dev-server/canvas-icons.tsx:122-131` — `TOOL_ICONS` map; add two entries.
- `plugins/design/dev-server/test/annotations-layer.test.ts` — round-trip test pattern to mirror.

### Files to Create

- None this phase. All work is additive in existing files.

### Documentation

- SVG `<foreignObject>` — used for sticky-note word-wrap. Renders an HTML `<div>` inside the SVG world-coord space so the existing CSS-zoom-driven portal renders sticky text in lockstep with the canvas. <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/foreignObject>
- SVG `rx` / `ry` on `<rect>` — corner radius. <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/rx>
- SVG `stroke-dasharray` — arrow dash. The pen + arrow paths already have `stroke-linecap="round"`, so `stroke-dasharray="6 4"` reads as a tasteful 6 px-on / 4 px-off pattern at any zoom (vector-effect non-scaling-stroke keeps the dash unit constant). <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dasharray>

### Patterns to Follow

- **Schema bump back-compat**: Phase 5.1 added `ellipse` + `text` + `fill` without breaking pre-existing SVGs. Same playbook here — new attributes are `parseFloat(getAttribute || default)` reads, never `required`. The test for this is one-shot: load a Phase-5 SVG fixture, round-trip through `svgToStrokes → strokesToSvg`, byte-compare to the post-Phase-20 reference. If the bytes drift, the migration is wrong.
- **Tool palette ordering**: current `DRAW_TOOLS = ['pen', 'rect', 'ellipse', 'arrow', 'eraser']`. Insert `'sticky'` after `'ellipse'` (paper primitives clustered) and `'text'` before `'eraser'` (the constructive end of the palette before the destructive end). Eraser must remain the last button — the visual separation users already learned matters.
- **Contextual toolbar chip discipline**: every new chip-group follows the existing pattern — `aria-pressed` for the active value, `dc-annot-ctx-btn` styling, gated behind a `caps.*` boolean. No new CSS class names unless the group needs a visual departure (none of these do — three labelled buttons + an aria-radiogroup is the existing precedent set by the Stroke|Fill toggle).
- **Sticky font sizing**: reuse `S / M / L` chip group (12 / 14 / 20) already wired for text. Sticky default = `M` (14 px world). The default `cornerRadius` for sticky is `8` (soft); the rect chip group exposes `0 / 8 / 999` (square / soft / pill).

---

## Design Decisions

> Dev-server is internal tooling — no project DS in play. Visual decisions follow the chrome conventions already set by `tool-palette.tsx` + `annotations-context-toolbar.tsx`.

### Components (from existing dev-server)

| Component                  | Source                                                    | Notes                                            |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `AnnotationContextToolbar` | `annotations-context-toolbar.tsx`                         | extend caps + chip groups in place               |
| `AnnotationResizeOverlay`  | `use-annotation-resize.tsx`                               | extend stroke-type filter to include `'sticky'`  |
| `ToolPalette`              | `tool-palette.tsx`                                        | add two entries to `DRAW_TOOLS`                  |
| `Svg` icon factory         | `canvas-icons.tsx`                                        | reuse for new `IconSticky` / `IconText`          |

### Icons

| Icon         | Source                | Size | Usage                                  |
| ------------ | --------------------- | ---- | -------------------------------------- |
| `IconSticky` | new — `canvas-icons.tsx` | 16   | Tool palette N button                  |
| `IconText`   | new — `canvas-icons.tsx` | 16   | Tool palette T button                  |

Both Lucide-style single-stroke, `currentColor`, viewBox 24. Sticky = small folded-corner square (path: 4,5 → 16,5 → 20,9 → 20,19 → 4,19 z + 16,5→16,9→20,9 fold line). Text = capital-T glyph (4,6 → 20,6 horizontal cap + 12,6 → 12,18 stem).

### Tokens

| Purpose            | Source                                          | Notes                                                              |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| Sticky paper tints | new `STICKY_PALETTE` const in annotations-layer | 6 colors, FigJam-style desaturated tints (yellow, pink, blue, green, purple, paper-white); distinct from the existing `PALETTE` (stroke ink) and `FILL_PALETTE` (translucent shape fills) |
| Chrome surfaces    | `--u-bg-0`, `--u-fg-0`, `--accent` (existing)   | already used by `dc-annot-ctx`                                     |

### Custom Components Needed

| Component        | Reason                                | Extends                          |
| ---------------- | ------------------------------------- | -------------------------------- |
| Sticky inline editor | sticky needs word-wrap + multi-line input | reuses the rect/ellipse `commitText` state machine, swaps the absolute overlay for a `foreignObject`-hosted `<textarea>` |

---

## Tasks

Execute in dependency order. Every task ends with a `bun test` run (`cd plugins/design/dev-server && bun test --bail`) — the schema is the contract, the tests are the gate.

### Task 1: EXTEND Stroke union — add StickyStroke + new optional fields

- **Do**:
  - Add `StickyStroke { id; tool: 'sticky'; x; y; w; h; color; text; fontSize; cornerRadius? }` to the union in `annotations-layer.tsx:50-99`.
  - Add `cornerRadius?: number` to `RectStroke`.
  - Add `startHead?: 'none' | 'triangle'`, `endHead?: 'none' | 'triangle'`, `dashed?: boolean` to `ArrowStroke`.
  - Relax `TextStroke.anchorId` to optional; add optional `x?: number`, `y?: number` for standalone text.
  - Add `STICKY_PALETTE` constant (6 paper tints, see Design Decisions); default = `STICKY_PALETTE[0]` (yellow).
- **Pattern**: mirror `EllipseStroke` shape — fields ordered: id, tool, color, then shape-specific.
- **Gotcha**: TypeScript `Stroke` is a discriminated union on `tool`. Every consumer (`strokeBBox`, `strokeHitTest`, `translateOne`, `isStrokeMeaningful`, `strokeToSvgEl`, `svgToStrokes`, the context toolbar `caps`) is reachable via `bun run tsc` — leave one branch out and it errors. Use that as the checklist.
- **Validate**: `cd plugins/design/dev-server && bun run tsc --noEmit` — expect zero new errors.

### Task 2: EXTEND strokeToSvgEl + svgToStrokes (schema round-trip)

- **Do**:
  - `strokeToSvgEl`: add a `'sticky'` branch — writes `<g data-tool="sticky" data-id data-r=cornerRadius data-fs=fontSize fill="<paper>"><rect rx ry width height/><foreignObject ...><div class="dc-sticky-body">text</div></foreignObject></g>`. Use `esc()` for text. **Note**: foreignObject in the persisted SVG is fine — Chrome/Safari render it identically to the in-canvas version.
  - Rect branch: when `cornerRadius > 0`, write `rx="<r>" ry="<r>"` and `data-r="<r>"`.
  - Arrow branch: factor head rendering. Read `endHead ?? 'triangle'` (back-compat default) and `startHead ?? 'none'`. Emit `<polyline>` for each head present. Add `stroke-dasharray="6 4"` when `dashed`. Persist `data-start-head` / `data-end-head` / `data-dash` for non-default values only (keep current SVG bytes identical for legacy strokes — same byte-compat trick Phase 5.1 used).
  - Text branch: when `anchorId` absent, emit `x="<x>" y="<y>"` and DO NOT write `data-anchor-id`.
  - `svgToStrokes`: symmetric reads with defaults — `data-r` → `0` if absent (rect) or `8` (sticky), `data-start-head` → `'none'`, `data-end-head` → `'triangle'`, `data-dash` → `false`, sticky `data-fs` → `14`, text without `data-anchor-id` reads `x`/`y` instead.
- **Pattern**: the `parseFill` helper is the template for "treat missing/empty/none as `null`". Apply the same defensive read shape for booleans (`raw === 'true' || raw === '1'`).
- **Gotcha**: `DOMParser` lowercases attribute names. `data-startHead` becomes `data-startHead` on read in some browsers but `data-startHead` is camelCase-sensitive in SVG namespace — use **kebab-case** attribute names (`data-start-head`) to dodge the cross-engine inconsistency the dev-server has already hit twice.
- **Validate**: add round-trip tests for each new field in `test/annotations-layer.test.ts` — sticky default, sticky-with-text, rect cornerRadius 0/8/999, arrow heads (none-none, none-tri, tri-none, tri-tri) × dashed/solid, standalone text (no anchor). Plus a back-compat test: a Phase-5 hand-rolled SVG must `strokesToSvg(svgToStrokes(s)) === s` (byte-identical).
- **Validate**: `bun test test/annotations-layer.test.ts`.

### Task 3: EXTEND strokeBBox / strokeHitTest / translateOne / isStrokeMeaningful / normalizeRect

- **Do**:
  - `strokeBBox`: sticky → `{ x, y, w, h }` (rect-shaped). Standalone text → small synthetic bbox `{ x, y, w: text.length * fontSize * 0.55, h: fontSize * 1.2 }` so it's selectable and the context toolbar positions reasonably (mirrors how anchored text inherits its host).
  - `strokeHitTest`: sticky → filled-rect hit (always inside the bbox). Standalone text → synthetic-bbox hit.
  - `translateOne`: sticky → translate `x` + `y`. Standalone text → translate `x` + `y` (anchored text untouched).
  - `isStrokeMeaningful`: sticky → `w >= 40 && h >= 40` (smaller stickys are unreadable; below threshold they're discarded the same way a 2×2 rect is). Standalone text → `text.trim().length > 0` (same as anchored).
  - `normalizeRect`: extract the rect-normalize logic into a helper that sticky can reuse (`normalizeSticky` returns a `StickyStroke` with the same `x = min, w = abs(w)` flip).
- **Pattern**: every branch checks `s.tool === '<id>'` first — TS narrows after that. The existing code follows this pattern already.
- **Validate**: `bun test test/annotations-layer.test.ts` — extend the existing bbox/hit-test test cluster.

### Task 4: REGISTER sticky + text tools

- **Do**:
  - `input-router.tsx`: extend `Tool` to `... | 'sticky' | 'text'`. Add `n` → `{ kind: 'tool', tool: 'sticky' }` and `t` → `{ kind: 'tool', tool: 'text' }` in `classify()`. Add both to `ANNOTATION_TOOLS`.
  - `use-tool-mode.tsx:38-51`: append `{ id: 'sticky', label: 'Sticky', shortcut: 'N', cursor: 'crosshair' }` and `{ id: 'text', label: 'Text', shortcut: 'T', cursor: 'text' }` to `DEFAULT_TOOLS`.
  - `tool-palette.tsx:192`: extend `DRAW_TOOLS = ['pen', 'rect', 'ellipse', 'sticky', 'arrow', 'text', 'eraser']` (insert positions per "Patterns to Follow").
  - `canvas-icons.tsx`: add `IconSticky` + `IconText` (paths in Design Decisions); register both in `TOOL_ICONS`.
- **Gotcha**: `T` shortcut collides with no existing classifier path, but verify against the menubar keymap (`client/app.jsx`) — Phase 5.1 added a few menubar bindings. If a collision exists, fall back to keeping the tool button but no shortcut (palette tooltip drops the `(T)` suffix).
- **Validate**: tool-palette renders the two new buttons; `useToolMode().setTool('sticky')` updates `document.body.style.cursor` to `crosshair`. Add a one-line classify-router test for `n`/`t`.
- **Validate**: `bun test test/input-router*.test.ts`.

### Task 5: ADD sticky draw branch (beginStroke / moveStroke / endStroke)

- **Do**:
  - `beginStroke`: when `tool === 'sticky'`, capture `[wx, wy]` and seed `{ id, tool: 'sticky', x: wx, y: wy, w: 0, h: 0, color: STICKY_PALETTE[0], text: '', fontSize: 14, cornerRadius: 8 }`.
  - `moveStroke`: sticky branch identical to rect (`w = wx - x, h = wy - y`).
  - `endStroke`: after `normalizeSticky`, if `isStrokeMeaningful` — commit, set `editingId = sticky.id` to drop straight into the inline editor (FigJam parity — sticky is created in edit-mode by default). The commit + editor switch is the only meaningful UX deviation from how rect/ellipse work.
- **Pattern**: mirror the existing rect branch at lines 911-922; the only delta is the post-commit `setEditingId(committed.id)`.
- **Gotcha**: the existing post-commit `setTool('move')` flip happens unconditionally for non-eraser tools (annotations-layer.tsx:1020-1023). Sticky needs the same flip — that's correct, the user expects to drop one sticky then return to Move. Sticky double-click on the tool button still locks via `useToolMode().toggleSticky` — no special-case needed.
- **Validate**: manual — drag-create sticky, observe inline editor opens, type, click out, sticky commits with text. `bun test` no new test required (covered by Task 2 round-trip).

### Task 6: ADD standalone-text draw branch + inline editor

- **Do**:
  - `beginStroke`: when `tool === 'text'`, single-click (no drag) commits a `TextStroke { id, tool: 'text', color, fontSize: 14, text: '', x: wx, y: wy }` and immediately `setEditingId(id)`. The inline editor is the existing `commitText` flow — extend the absolute-positioned overlay so it works for both anchored (current) and standalone (new) text. For standalone, the overlay positions at `(x, y)` in world coords (transform through the existing `screenToWorld` inverse).
  - `commitText`: when called with no `existing` AND `anchorId` is `''`, branch to standalone-write — `next = [...prev, { ..., anchorId: undefined, x: editorX, y: editorY }]`.
- **Gotcha**: `commitText` currently filters/finds anchored text via `s.tool === 'text' && s.anchorId === anchorId`. When `anchorId === ''` is passed, the find returns nothing, the "create" branch fires, and we land in the new standalone-write path. Existing anchored-text behavior keeps working because `anchorId` is always passed truthy by the double-click handler.
- **Validate**: manual — pick Text tool, click empty world, type "hello", Enter, see commit. `bun test test/annotations-layer.test.ts` for the round-trip.

### Task 7: ADD sticky inline editor (foreignObject host)

- **Do**:
  - In the strokes render loop, when a sticky's id matches `editingId`, render its `<foreignObject>` body as a `<textarea>` instead of a `<div>`. Style the textarea to fill the sticky bbox minus 12 px inset padding; bind to a local `editingText` state that commits on blur via `commitStickyText(sticky.id, editingText)`.
  - `commitStickyText` is a thin wrapper over `strokesStore.updateStroke(id, { text })` — no new command type needed; the existing `AnnotationStrokesCommand` handles the diff at the next push.
- **Pattern**: the rect/ellipse inline editor (annotations-layer.tsx:1264-1316) is the playbook; the only delta is the host element (`foreignObject` instead of an absolutely-positioned overlay) so the editor moves with CSS zoom natively.
- **Gotcha**: `foreignObject` content needs `xmlns="http://www.w3.org/1999/xhtml"` on the inner `<div>` / `<textarea>` for some Safari versions to lay out HTML inside. The existing SVG header already declares `xmlns="http://www.w3.org/2000/svg"` so just add the inner namespace.
- **Validate**: manual — create sticky, type multi-line text, observe word-wrap, resize sticky → text re-wraps. `bun test` round-trip for sticky-with-multiline-text.

### Task 8: EXTEND context toolbar — cornerRadius + arrow direction + dash chips

- **Do**:
  - `caps`: add `cornerRadius: allRectOrSticky`, `arrowDir: allArrow`, `dash: allArrow`. `fontSize` extends to `allTextOrSticky`.
  - Render 3-chip group for `cornerRadius` (gated by `caps.cornerRadius`): `0` (Square) / `8` (Soft) / `999` (Pill). Click → `store.updateStroke(s.id, { cornerRadius: <v> })` for each selected sticky/rect.
  - Render 4-chip group for arrow direction (gated by `caps.arrowDir`): None / Start / End / Both. The chips set `{ startHead, endHead }` pairs: `none-none` / `triangle-none` / `none-triangle` / `triangle-triangle`. Active-state computed off uniform pair across selection.
  - Render dash toggle (gated by `caps.dash`): single button, `aria-pressed` reflects `dashed === true` across all selected arrows.
  - Sticky also gets the existing fontSize S/M/L group (caps now includes sticky via the `allTextOrSticky` predicate).
- **Pattern**: mirror the existing `Thin / Thick` thickness group structure (annotations-context-toolbar.tsx:401-423). Each new group is `<>{<sep/>}{<button>...</button>...}</>` gated by its caps flag.
- **Gotcha**: stroke|fill mode toggle currently shows when `caps.fill` is true. Sticky has a single `color` field (the paper tint) — DO NOT expose sticky in the fill caps; let the existing stroke palette handle sticky color via the always-on stroke palette path (which writes `s.color`). This keeps the toolbar honest: sticky has one color, not a stroke + fill pair.
- **Validate**: manual — multi-select two rects, click `Pill` → both update; select arrow, flip direction chips, observe arrowheads switch sides.
- **Validate**: `bun test test/annotations-layer.test.ts` (round-trip already covers field shape).

### Task 9: EXTEND resize overlay for sticky

- **Do**:
  - `use-annotation-resize.tsx`: the existing handle hit-test filters to `rect` and `ellipse`. Add `sticky` to the allowed-set. Resize math is identical to rect (sticky shares `x / y / w / h`).
- **Gotcha**: text re-wraps automatically inside `foreignObject` so no special handling needed during resize — Chrome layout handles it.
- **Validate**: manual — create sticky, click to select, drag corner handle, observe resize + text reflow.

### Task 10: BACK-COMPAT regression test

- **Do**:
  - Create a fixture `test/fixtures/phase-20-annotations.svg` containing one stroke of every legacy shape (pen, rect with fill, ellipse with fill, arrow, anchored text). Hand-write the SVG bytes — DO NOT generate via `strokesToSvg` (the test must catch round-trip drift).
  - Test: `const parsed = svgToStrokes(fixture); const re = strokesToSvg(parsed); expect(re).toBe(fixture)` — byte-identical.
  - This is the canary that pins us against accidentally introducing a "phantom default" (e.g. always emitting `data-end-head="triangle"` would silently bloat every legacy SVG on first load → save cycle).
- **Validate**: `bun test test/annotations-layer.test.ts`.

### Task 11: DOC sweep — Phase 5.1 plan + DDR cross-link

- **Do**:
  - Add a one-paragraph "Phase 21 follow-up" note to the archived Phase 5.1 plan's execution log (so future readers see the linkage without grepping).
  - If during implementation any decision goes against "obvious" expectations (e.g. why text fontSize chip is S/M/L = 12/14/20 and not aligned with the rect cornerRadius 0/8/999 step pattern), write a DDR. Otherwise no DDR is mandatory — this phase only extends existing shapes within decisions already made by phase-5.1 and DDR-049.
- **Validate**: `bun test` full suite passes (target: zero new failures, all new tests green).

---

## Validation

Run these commands to confirm zero regressions:

1. **Types**: `cd plugins/design/dev-server && bun run tsc --noEmit`
2. **Tests**: `cd plugins/design/dev-server && bun test --bail`
3. **Build**: `cd plugins/design/dev-server && bun run build.ts` — confirm `dist/` artifacts are produced.
4. **Smoke**: from a target project with `.design/`, `node plugins/design/dev-server/server.mjs --root <target>` → open a canvas → pick Sticky tool → drag-create → type → resize → recolor → reload page → observe stroke persists.
5. **`/design:smoke`** — DDR-021 gate; run before declaring done because this phase touches `annotations-layer.tsx` + `canvas-icons.tsx` + the tool palette.
6. **Cross-platform scenario**: extend `.ai/scenarios/canvas-figjam-feel/spec.md` (or create a new `canvas-annotations-v2/spec.md`) with steps that exercise sticky create-edit-resize, rect rounded corners, arrow direction flip. Run via `scenario-runner` subagent — web-desktop only is acceptable (annotations are not native-mobile-relevant; ios/android skip with justification).
7. **A11y**: spawn `a11y-auditor` subagent — focus on the two new tool palette buttons (aria-label, shortcut hint) and the foreignObject textarea (label, focus management).
8. **Manual**: legacy SVG load test — pick any `.annotations.svg` written by pre-Phase-21 Maude (the dogfood `.design/_history/*/annotations*.svg` snapshots are plentiful), load, save, diff — must be byte-identical until the user actually mutates a stroke.

---

## Scenario Coverage (UI tasks — required)

**Existing scenario:**

| Scenario               | Covers                                                   | Status              |
| ---------------------- | -------------------------------------------------------- | ------------------- |
| `canvas-figjam-feel`   | Phase 5.1 base draw / select / context-toolbar flows     | ✅ existing (extend) |

**New scenario steps** (append to `canvas-figjam-feel/spec.md`, OR create `canvas-annotations-v2/spec.md`):

- Pick Sticky tool (N) → drag-create on empty canvas → editor opens → type 2 lines → click out → sticky commits with multi-line text wrapped inside.
- Select the sticky → recolor via context toolbar (pick pink tint) → resize via corner handle → text re-wraps.
- Pick Text tool (T) → click empty world → type "label" → Enter → text commits standalone (no host shape).
- Select a rect → context toolbar shows `Square / Soft / Pill` chips → click Pill → corners go to full radius.
- Select an arrow → flip arrowhead direction to "Both" → both ends render triangle → toggle Dash → stroke renders dashed.
- Reload the canvas iframe — every new shape persists with the right attributes (sticky text, rect radius, arrow heads + dash).

`/done` runs `scenario-runner` across the supported platforms. Web-desktop is the only required platform for this phase; native mobile/tablet skip is justified (annotation tooling is mouse + keyboard centric).

---

## Acceptance Criteria

- [x] All 11 tasks completed
- [x] `bun test` green (801 pass / 1 pre-existing `canvas-route` fail, unrelated); +43 net new tests (Tasks 2 + 10 in `test/annotations-roundtrip.test.ts`, write-path + geometry in `test/annotations-layer.test.ts`)
- [x] `bun tsc --noEmit` clean — 3 errors = the DDR-026 baseline (`api.ts` ×2 + `runtime-bundle.ts`), zero new. NB: only `input-router.tsx` of the affected files is in the tsc program; the other `.tsx` are caught by tests + build + smoke (tsconfig `include` is `*.ts`, root `.tsx` are only checked transitively).
- [x] Sticky + standalone text + rect rounded corners + arrow direction + arrow dash all visible in tool palette / context toolbar (verified via agent-browser live smoke)
- [x] Legacy `.annotations.svg` files load + round-trip byte-identical (Task 10 fixture `test/fixtures/phase-20-annotations.svg` passes)
- [x] `/design:smoke` equivalent: booted the LOCAL `server.ts` (working-tree source, not the published global `maude`), drove agent-browser — canvas renders 0-error, sticky create/edit/resize/recolor + standalone text + arrow Both+Dash all work, reload-persists; the browser-authored SVG round-trips byte-identical + survives `sanitizeAnnotationSvg`
- [→] `scenario-runner`: NOT re-run at close-out — feature already shipped in v0.24.0; impl-time live agent-browser smoke covered the web-desktop flow with 0 blockers; ios/ipad/android skip justified (annotation tooling is mouse+keyboard). Annotation layer is re-validated under **Phase 24 (parity-v2)**. See close-out note.
- [→] `a11y-auditor`: NOT re-run at close-out — feature already shipped in v0.24.0; new tool buttons carry `aria-label`+shortcut hints, sticky textarea + standalone editor carry `aria-label`, corner/arrow/dash chips carry `aria-label`+`aria-pressed`. Re-audited under **Phase 24 (parity-v2)**. See close-out note.
- [x] `design-system-guard`: N/A (dev-server internal chrome, no project DS applies)
- [x] DDRs: the only divergence — sticky text persists in an allowlisted `<text>` child, NOT a `<foreignObject>` (the plan's assumption), because `sanitizeAnnotationSvg`/DDR-060 F1 strips `foreignObject`. Documented in the Phase 5.1 follow-up note rather than a new DDR (it's a direct consequence of existing DDR-060). Surfaced for the user to escalate to a DDR if desired.
- [x] Phase 5.1 archived plan gains a "Phase 21 follow-up" cross-link
- [x] No regression in existing draw / select / context-toolbar flows (full suite green modulo the pre-existing fail)

---

## Close-out (2026-05-30, retroactive)

This phase was **code-complete and shipped before a formal `/flow:done` ran**, so the plan lingered in `.ai/plans/` while the feature was already in users' hands. Disposition recorded here at retroactive close-out:

- **Shipped**: implementation committed in `096f0bf` (*"feat(design): FigJam-parity annotations — sticky/text/shape polish + dark icon toolbars + custom cursors"*) and released in **v0.24.0** (release commit `d3afea7`). The commit also folded in the Task 11 custom-cursor redesign (`canvas-cursors.ts`).
- **Sole divergence from plan**: sticky text persists in an allowlisted `<text>` child, **not** a `<foreignObject>` — `sanitizeAnnotationSvg` (DDR-060 F1) strips `foreignObject` on every PUT, so the persisted form is `<g data-tool="sticky"><rect/><text data-sticky-body>…</text></g>` (live in-canvas render still uses `foreignObject` via React DOM, which is never sanitized). Documented in the Phase 5.1 follow-up note rather than a standalone DDR (direct consequence of existing DDR-060). Surfaced for the user to escalate to a DDR if desired.
- **Deferred gates NOT re-run retroactively**: `scenario-runner` + `a11y-auditor` were originally deferred to `/done`. Because the feature already shipped clean in v0.24.0 (impl-time live agent-browser smoke covered web-desktop with 0 blockers and the new chrome carries `aria-label`/`aria-pressed`), and because **Phase 24 (annotation parity-v2)** re-touches and re-validates the entire annotation layer, these heavyweight gates are folded into Phase 24's `/done` rather than re-run here against frozen, already-shipped state.
- **Bookkeeping**: plan moved to `.ai/plans/archive/`; STATE.md History gains a `done` row; `site/lib/roadmap.json` regenerated.
