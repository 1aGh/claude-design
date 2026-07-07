# Feature: Robust in-canvas + specimen element editing (Figma/Webflow-grade)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan is grounded in a four-agent read of the studio editing subsystems (selection/toolbar, camera/move/resize, inspector/knobs, specimen/media) — every task carries the file:line anchors that research surfaced.

## Description

Bring Maude Studio's element editing up to the standard users already know from Figma, Webflow, and Pencil.dev — so that editing an element (in a UI canvas artboard **or** a design-system specimen) is predictable, familiar, and never leaves the user hunting for where to change something. The coordinated work areas:

1. **Fix two camera/scroll bugs** that make editing feel broken (moving an absolute element resets the pan; selecting an element that overflows its artboard shifts the layout and reveals a phantom right-side strip).
2. **On-canvas drag-resize** — real resize handles around a selected element, with the modifier grammar users expect (Shift = aspect-lock, Alt = from-center).
3. **Expand the curated Inspector knobs** with the recurring properties that are currently only reachable through the raw escape hatch: `position` (+ a `top/right/bottom/left` inset widget shaped like the margin box), `transform`, `font-style`, `text-transform`/`text-decoration`, and media framing (`object-fit`, `aspect-ratio`, `object-position`).
4. **Auto-open the CSS panel on select** — selecting an element pops the Inspector on the CSS tab (only when no right panel is already open), so the edit surface is where the eye already is.
5. **Element selection + inspect on design-system specimens**, not just `ui/` canvases.
6. **Swap/replace a photo or video** (incl. a **background-image** file picker) and set its framing (cover/contain, aspect ratio) from the Inspector + context menu.
7. **Delete an element** and **insert a new div / text / image** directly in the artboard.
8. **On-canvas padding + gap drag** — adjust spacing by dragging on the canvas, not only via the panel.
9. **Functional undo/redo on *every* edit** — resize, delete, insert, media-swap, spacing-drag, position — all Cmd+Z / Cmd+Shift+Z reversible.
10. **A predictability contract for reusable components** used across multiple artboards — the user must always know whether an edit is local to one artboard or shared across all instances, and moving/resizing a component *instance* must stay local.
11. **Smooth, non-flickering micro-interactions** throughout — the canvas never blinks; edits preview optimistically and reveal/settle with the DS motion vocabulary.
12. **Free-hand artboard resize** — drag an artboard's frame to resize it (today only artboard *move* exists).
13. **Insert a new empty artboard** from standard screen-size presets (Desktop / Laptop / Tablet / Mobile / custom), so the user can start from a clean frame and add elements themselves.
14. **Editor ergonomics parity** (deep-research gap analysis) — element keyboard-nudge, keyboard tree traversal, duplicate (Cmd+D) / Alt-drag-duplicate / paste-in-place, copy-style/paste-style, distribute/equal-spacing/tidy-up, deep-select + right-click "Select layer", live Alt-hover distance measurement + drag dimension readout.
15. **Flex / auto-layout editor** — per-element sizing mode (Fixed / Hug / Fill) + a grouped direction/wrap/distribution/gap/padding editor (the biggest layout-behavior clarity win for React/flexbox mockups). *(CSS-Grid track editor is a separate follow-up plan.)*

Per the user's decisions (2026-07-07, `AskUserQuestion` ×2): **one cohesive plan, no priority ordering** — the stages below are ordered by *dependency*, not by "ships first", and land as a single plan executed end-to-end; and for reusable components, **visibility + local instance move/resize** (surface the edit scope, route instance move/resize per-occurrence to stay local) — **no** per-instance style-override or detach primitive in this plan (both explicitly out of scope; the predictability comes from *showing* the scope, not from a new override mechanism).

## User Story

As a Studio user iterating on a mockup, I want to select any element (in an artboard or a DS specimen), immediately see an edit panel where I expect it, drag its handles to resize, nudge its position, change the properties I use constantly, and swap/reframe its imagery — without the canvas jumping around or me having to guess which hidden field does what — so that editing feels like the tools I already know instead of a puzzle.

## Problem

Editing today is functional but incomplete and, in two cases, actively broken:

- **Bug A — moving an absolute element resets the pan.** After an out-of-flow element drag writes `left/top`, the shell re-selects the element by id, and the in-iframe `select-by-id` handler calls `scrollIntoView({ block:'nearest', behavior:'smooth' })` (`canvas-shell.tsx:1634`). The `.dc-canvas` host is `overflow:hidden` (`canvas-lib.tsx:158-161`) but still *programmatically scrollable*; the transform-based camera (`writeTransform`, `canvas-lib.tsx:799-816`) has no knowledge of host scroll, so the world visibly jumps and stays desynced from the camera model.
- **Bug B — selecting an overflowing element shifts layout + shows a right strip** ([Image #1]). Same root cause, hit directly: any selection routed through `dgn:'select-by-id'` (Layers-panel click, restored/echoed selection) runs the same `scrollIntoView` (`canvas-shell.tsx:1634`); if the element sticks out of its artboard, the nearest `overflow:hidden` ancestors (`.dc-artboard-body` `canvas-lib.tsx:298-315`, `.dc-canvas` `:158-161`) scroll to reveal it → "the whole thing shifts and a strip appears on the right".
- **No on-canvas resize.** There are zero resize handles for canvas elements (grep for "resize" in `canvas-lib.tsx`/`canvas-shell.tsx` returns only window-resize comments). Width/height can only be changed via the CSS knob. The user explicitly asked for "resize elementu dragem".
- **The everyday properties aren't curated.** `position`, `top/right/bottom/left`, `transform`, `font-style`, `text-transform`, `object-fit`, `aspect-ratio` are all in DDR-104's **explicit OUT-list** — reachable only by typing a raw custom property in the "Advanced" hatch. These are exactly the recurring edits the user names.
- **Selecting never opens the panel.** A plain ⌘-click selects (halo + status bar) but the `select-set` handler (`app.jsx:7594-7613`) only calls `setSelected(...)`; it never opens the Inspector. The user must already have it open (menu / `⌘⇧I` / "Inspect") to edit.
- **Specimens can't be selected at all.** DS preview specimens (`system/<ds>/preview/*.tsx`) render bare markup, not `<DesignCanvas>`, so there is no CanvasShell selection router; `resolveHoverTarget` hard-requires artboard ancestry (`input-router.tsx:607-625`) and returns null on a specimen.
- **No media swap.** Nothing in the shell or any context menu re-points an existing `<img>`/`ImageStroke`/`MediaRefStroke` at a different asset; `POST /_api/asset` is write-only intake. `object-fit`/`aspect-ratio` aren't curated knobs.

## Solution

Everything above is achievable by **extending existing, already-hardened lanes** rather than inventing new plumbing — which is what makes this a large-but-low-risk plan:

- **Both bugs collapse to one line** (`canvas-shell.tsx:1634`): replace the host-scrolling `scrollIntoView` with a **camera-aware reveal** (pan the `.dc-world` transform via the viewport controller so the selected element comes into view *through the camera*, not through host scroll), and add a host-scroll-0 invariant clamp so nothing else can desync the camera. `__maudeCanvasRects` (`canvas-lib.tsx:1975-2039`) already assumes host-scroll 0 — the clamp makes that assumption safe.
- **Resize handles** model on the annotation resize hook (`use-annotation-resize.tsx` — screen-space 8×8px corner/edge handles that stay constant at any zoom) and write `width`/`height` (+ `left`/`top` for absolute or top/left-edge drags) through the **existing** `reposition-request → repositionElement → /_api/edit-css` lane (`canvas-shell.tsx:2926-2953`, `app.jsx:8244-8290`), extended to chain up to four properties on the serialized `editApplyChainRef`.
- **New knobs are client-only.** The write path (`/_api/edit-css` → `editAttribute`) is already generic over *any* property (the Advanced hatch proves it). Promoting the OUT-list means: extend `KNOB_PROPS` (`dom-selection.ts:249-292`) so `authored`/`computed` carry the values, add `CSS_*` option lists, add `row(...)`s inside new/existing `sec(...)`s in `CssKnobs`, and register them in `SECTION_PROPS`. A `position` inset widget is a direct mirror of the existing margin/padding `side()` box-model widget. This **reverses DDR-104's OUT-list** → recorded as a new DDR.
- **Auto-open** adds one guarded call in the `select-set` handler: when a fresh single selection arrives and no right panel is open, `openRightPanel('inspector')` on the CSS tab. Default-on, with a persisted preference so a user who dislikes it can turn it off, and it never steals focus from an already-open panel (the user's stated guard).
- **Specimen selection** closes a mount/router gap only: teach the lite mount (`canvas-comment-mount.tsx`) to claim `'select'` and resolve a specimen hover target (mirroring the existing `pickSpecimenEl` fallback, `:93-104`), then render a minimal selection layer (halo + contextual toolbar + resize handles) that reuses the same components. Everything downstream (`select-set` message, Inspector, `edit-css`/`edit-attr`) is already kind-agnostic and ready.
- **Media swap** adds a "Replace…" affordance (asset picker: browse `assets/` + upload + fetch-by-URL) that re-points `src` via the existing `editAttribute` src-replace path (`canvas-edit.ts:1627`) through `/_api/edit-attr`, and for a **background image** writes `background-image: url(assets/…)` via `edit-css`, plus a conditional **Media** knob section (`object-fit` segmented cover/contain/fill, `aspect-ratio`, `object-position`, `background-size`). This is **orthogonal to the photo-editor plan** (`.ai/plans/feature-photo-editor.md`): that plan owns an image's *pixels/look* via its own `/_api/photo-edit` route; this plan owns its *box/framing/source* via `edit-css`/`edit-attr`.
- **Delete + insert** are the two structural source-mutations that don't exist yet for general elements (only video-comp `<Sequence>` clips have them). They mirror the `moveElement`/`reorder` machinery: a `delete` removes the element's framed source span via `MagicString.remove` + reparse gate; an `insert` synthesizes a bare `<div>`/text/`<img>` JSX string (no `data-cd-id` — the pipeline stamps it on next transpile) placed at a `refId`+`position` anchor with `moveElement`'s indentation helpers. Both run through **new main-origin `dgn:'delete-request'`/`'insert-request'` relays** (mirroring `reorder-request`) and both **undo via whole-file snapshot** (the `reorder-revert` seq-log model) — *not* an inverse descriptor, because a structural edit renumbers positional ids (DDR-138/139).
- **On-canvas spacing** (padding + gap drag) is a new fixed-rAF overlay reusing the `equal-spacing-handles.tsx` follow-layer scaffold + `makeScrub`'s value math + `applyOptimisticStyle` live preview; a released drag commits through the same `commit()`→`/_api/edit-css`→`record('css', …)` path the panel box-model uses, so it inherits `edit-source` undo for free.
- **Reusable-component predictability** needs no new source primitive: the edit *scope* is already computable at parse time (`componentName` on the locator entry + `collectElementsFull().filter(tag === componentName).length` = N instances, the exact computation `resolveUsageId` already ships). Surface it (badge + confirm), and route instance move/resize/reposition through the existing occurrence-index → usage resolver (`resolveUsageId`, `canvas-edit.ts:718-747`, already wired for reorder via `idIndex`/`refIndex`) so moving/resizing a `<Card/>` instance stays local. Styling an *inner* shared element stays global — clearly labeled, per the user's chosen model.
- **Artboard resize + new-artboard insert** ride the existing artboard model: per **DDR-027** artboard size is JSX-authoritative (`width`/`height` props on `<DCArtboard>`), so free-hand resize writes those two props via `/_api/edit-attr` (the artboard frame is a `[data-dc-screen]` with a `data-cd-id`), reusing Stage D's resize-handle geometry at the artboard scope and `use-artboard-drag.tsx`'s screen-delta÷zoom math. A **new empty artboard** is a structural insert of a `<DCArtboard id label width height>` (optionally inside a `<DCSection>`) — the exact shape `scaffold-design.ts:35-79` authors — placed after the last artboard, with `width`/`height` from a small screen-size preset table; the pipeline stamps its `data-cd-id`/registers it, and `patchCanvasMeta` gives it a grid position (DDR-027 default-grid). Same structural-insert + whole-file-snapshot-undo lane as element insert.

### Cross-cutting invariants (apply to every task, verified per stage)

- **INV-1 — Every edit is undoable.** No new edit op ships without Cmd+Z / Cmd+Shift+Z coverage. Two mechanisms (research-confirmed): a **CSS-expressible** op (resize, spacing-drag, media/bg-image, position) reuses the `edit-source` command — after the `/_api/edit-css`/`edit-attr` write, call `recordSourceEdit({ op:'css'|'attr', canvas, id, key, before, after })` (`app.jsx:8121`), exactly as `repositionElement` records `left`/`top`. A **structural** op (delete, insert) needs the full five-part `reorder`-style wiring (server endpoint + inverse seq-log, a `commands/*-command.ts` builder registered via `registerCommand`, a `CommandSinks` field wired in `canvas-shell.tsx`, a parent-origin-gated postMessage verb + shell handler, and a `undoStack.record/push`). The undo stack is per-canvas, in-iframe, serializable-record based (`undo-stack.ts`, DDR-050). Known gaps are catalogued in `.ai/logs/rca/issue-undo-redo-coverage-gaps.md` — this plan closes the element-delete/insert gap and must not add new ones.
- **INV-2 — The canvas never hard-flashes.** Every CSS-shaped op posts an optimistic `dgn:'apply-style'` **before** its write, which (a) previews instantly and (b) arms the 1.5s reload-suppression window (`_shell.html:376`, DDR-105 addendum) so the follow-up HMR is skipped entirely. Structural ops that can't be style-previewed rely on `softReload` (import-before-swap, holds last-good, no white flash — `_shell.html:225-245`). New on-canvas affordances (resize handles, spacing handles) paint into a fixed rAF overlay like the halo/`equal-spacing-handles` layers, reveal/settle with the DS motion tokens (`--dur-soft: 120ms`, `--ease-out`; halos use 60ms opacity, reorder FLIP 180ms — `1-tokens-maude.css:102-108`), and honor the `prefers-reduced-motion` 1ms collapse already present in each stylesheet.
- **INV-3 — Edit scope is always legible.** Any selection/edit surface (Inspector header, resize/reposition, delete) shows whether the target is a **local** element (this artboard only) or a **shared** component instance (edits N places), and destructive/global edits on a shared element confirm first. This is the user's "musí to být předvidatelné" contract.

### Divergent framing (recorded, resolved by the brief)

A BUILDER/SHIPPER/BREAKER read of the approach converged rather than forked, because the user's brief and the research already pin the answers:

- **BUILDER** would build a full free-transform layer (drag-move any element, convert-to-absolute on drag like Webflow). **Resolved down:** in-flow *move* already exists as tree-reorder (`ReorderDrag`, `canvas-shell.tsx:2500-3046`) and absolute *move* already exists as coordinate mode — the gap the user reported is the *pan-jump bug*, not missing move. So Stage D adds *resize* (genuinely missing) and *fixes* move, but does **not** add a layout-mutating "convert to absolute on drag" (out of scope; a raw `position` knob now covers the intent explicitly).
- **SHIPPER** would skip on-canvas handles and rely on the width/height knobs. **Rejected:** the user explicitly asked for "resize elementu dragem" — direct manipulation is in scope.
- **BREAKER**'s flagged risk — *new write surface = new trust boundary* — is answered by reuse: every new write rides `edit-css`/`edit-attr`/`reposition-request`, all already main-origin-only + CSRF-guarded + parent-source-gated (DDR-054/DDR-105). The only genuinely new surface is producing a *selection* on specimens, which flows through the already-parent-gated `select-set` handler. This is carried forward as the Stage E/G security-review focus, not an open gap.

## Metadata

- **Type**: Enhancement (+ two Bug Fixes + two new structural capabilities: element delete/insert)
- **Complexity**: High
- **App/Package**: `apps/studio` (client shell + in-iframe canvas chrome + selection/inspect engine + structural source-edit engine + undo command layer); no CLI or plugin-markdown changes required
- **Affected Systems**: selection engine (`dom-selection.ts`, `input-router.tsx`, `use-selection-set.tsx`), in-iframe chrome (`canvas-shell.tsx`, `contextual-toolbar.tsx`, `use-annotation-resize.tsx` as pattern), camera (`canvas-lib.tsx`), Inspector + CSS knobs (`client/app.jsx` `InspectorPanel`/`CssKnobs`), specimen mount (`canvas-comment-mount.tsx`), media (`annotations-layer.tsx`, `use-canvas-media-drop.tsx`), structural source-edit engine (`canvas-edit.ts` — **new** delete/insert ops + routes in `http.ts`), undo command layer (`undo-stack.ts`, `use-undo-stack.tsx`, `commands/*-command.ts` — **new** command kinds), on-canvas spacing overlay (new, reusing `equal-spacing-handles.tsx` scaffold), anti-flicker window (`plugins/design/templates/_shell.html` — reused)
- **Dependencies (new)**: none — no new npm deps. **New HTTP routes**: `/_api/delete-element` (+ `/_api/delete-revert` or reuse the reorder seq-log), `/_api/insert-element`, an optional `/_api/assets` list (GET) for the picker, and the optional batch-edit route (Task D3). All main-origin-only (DDR-054), `sameOriginWrite`+loopback guarded.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file below **in parallel in a single assistant message** (multiple Read calls) — they're independent context loads.

**Camera / bugs (Stage A):**
- `apps/studio/canvas-shell.tsx:1618-1637` — the `dgn:'select-by-id'` handler; the `scrollIntoView` at **`:1634`** is the shared root cause of Bugs A + B.
- `apps/studio/client/app.jsx:6035-6058` (halo-restore ladder, posts `select-by-id` at `:6046-6054`), `:7717` and `:7967-7978` (post-edit reselect posts) — the callers that *fire* the reveal-scroll after a write.
- `apps/studio/canvas-lib.tsx:158-161` (`.dc-canvas` `overflow:hidden` host), `:227-234` (`.dc-world`), `:799-816` (`writeTransform` — the only thing that moves the world), `:873-888` (`applyViewport`), `:902-917` (`zoomAt` — the world↔screen affine to reuse for a camera-aware reveal), `:1975-2039` (`__maudeCanvasRects` — assumes host scroll 0).
- `apps/studio/use-artboard-drag.tsx:125-177` — the clean `dragReducer` (screen delta ÷ zoom, no camera-offset mixing) that resize math should mirror.

**Inspector / knobs (Stages B, C, F):**
- `apps/studio/client/app.jsx:4280-5178` (`CssKnobs`) — the component to extend. Load-bearing internals: `commit`/`reset`/`optimistic`/`record` write helpers (`:4385-4438`), `makeScrub` with `opts.sides` box-model modifiers (`:4461-4517`), the builder helpers `csel` (`:4673`), `num` (`:4724`), `text` (`:4709`), `side` (`:4828`, the box-model longhand input), `corner` (`:4866`), `provDot` (`:4547`), `row` (`:4580`), `sec` (`:4639`), `SECTION_PROPS` (`:4597-4632`).
- `apps/studio/client/app.jsx:3637-3677` — the `CSS_*` option-list constants (`CSS_DISPLAYS`/`CSS_FLEX_DIR`/`CSS_WEIGHTS`/`CSS_ALIGN_OPTS`…) and `PROP_LEAD` glyph map; new lists (`CSS_POSITION`, `CSS_FONT_STYLE`, `CSS_TEXT_TRANSFORM`, `CSS_OBJECT_FIT`) go here.
- `apps/studio/client/app.jsx:5518-6008` (`InspectorPanel`) — the tab host; tab bar `:5851-5854` (Inspect/Layers/CSS), tab body switch `:5865-6003`, right-dock render `:8913`, open/close state `inspectorOpen` `:6233`, `openRightPanel` `:6318`, `toggleRightPanel` `:6328`. **Stale comment warning:** the banner at `:5251-5255` still calls the panel "display-only" — it is not (Phase 12.2/12.3 shipped live writes); don't trust it.
- `apps/studio/dom-selection.ts:249-292` (`KNOB_PROPS`) — **the curated list that `styleMapsFor` (`:300-347`) captures into `authored`/`computed`.** New knobs that read `el.authored[prop]`/`el.computed[prop]` MUST be added here too, or the panel rows render blank.
- `apps/studio/client/app.jsx:7594-7613` — the `select-set` message handler (calls `setSelected`); the Stage-C auto-open guard hooks in here.

**Selection / write path (all stages):**
- `apps/studio/dom-selection.ts:349-399` (`hoverTargetToSelection` — builds `id`/`selector`/`index`/`bounds`/style maps), `:300-347` (`styleMapsFor`), `:156-176` (`resolveSelectionEl`), `:205-233` (`resolveByDomPath` drift fallback).
- `apps/studio/input-router.tsx:592-658` (`resolveHoverTarget` — the artboard-ancestry hard requirement at `:607-625` that blocks specimens), `:270-283` (Cmd/Ctrl select classification).
- `apps/studio/http.ts:1393-1414` (`/_api/edit-css` — single-property, `sameOriginWrite`+loopback guarded), `apps/studio/api.ts:1805-1846` (`editCss`, `CD_ID_RE` `:1764`), `apps/studio/canvas-edit.ts:261+` (`editAttribute`), `:1627` (the media `src`-replace positional-id note).

**Resize pattern (Stage D):**
- `apps/studio/use-annotation-resize.tsx` (whole file) — screen-space 8×8px corner/mid-edge/endpoint handles (`.dc-annot-resize-handle`) with FigJam modifier grammar; the geometry + zoom-invariance the element resize layer copies. Uses `useViewportControllerContext` (`:42`).
- `apps/studio/canvas-shell.tsx:2500-3046` (`ReorderDrag`) — the existing element-drag machine: threshold gate `:2799-2836`, `outOfFlow` capture `:2812/:2832`, coordinate-mode `left/top` write `:2926-2953`, `dgn:'reposition-request'` post; halos `:197-198`, `:2432-2440` (rAF-tracked `position:fixed`).
- `apps/studio/client/app.jsx:8244-8290` (`repositionElement` — the serialized `editApplyChainRef` that chains `left`+`top` writes and records both to the undo stack; the pattern to extend to `width`/`height`), `:7773-7791` (`reposition-request` relay, pinned to `activePath`).

**Specimens (Stage E):**
- `apps/studio/canvas-comment-mount.tsx:362-372` (`buildCanvasTree` — lite mount tree), `:374-382` (`mountCanvas`), `:75-80` (`COMMENT_CLAIMS` — claims comment actions but NOT `'select'`), `:86-88` (`isBareSpecimen`), `:93-104` (`pickSpecimenEl` — the specimen hover resolver to generalize).
- `apps/studio/canvas-pipeline.ts:211-226` — unconditional `data-cd-id` stamping (specimens already get ids), guard `:161-174`.
- `apps/studio/canvas-lib.tsx:1397` (UI canvas default export renders `<DesignCanvas>` → `<CanvasShell>`) vs a specimen's bare markup — the structural divergence.

**Media (Stage F):**
- `apps/studio/use-canvas-media-drop.tsx` (whole file) — drag-drop/paste intake; `classifyMediaPayload` `:141-163`.
- `apps/studio/annotations-layer.tsx:1114-1160` (`createImageFromFile` → `POST /_api/asset` → content-addressed `assets/<sha8>.<ext>` href), `:4252-4269` (`<image>` render), `:1194-1226` (`createMediaReference` → `MediaRefStroke`), `:3745-3816` (`AnnotationContextMenu` — where an annotation "Replace…" entry goes).
- `apps/studio/annotations-model.ts:229-250` (`ImageStroke` shape), `apps/studio/api.ts:1863-1911` (`/_api/edit-attr` — the `src`-replace + `object-fit` write route for authored `<img>`).
- `apps/studio/canvas-shell.tsx:1323-1372` — the element right-click menu (where an element "Replace image…" entry goes, alongside "Copy CSS"/"Inspect").

**Reusable-component scope (Stage H):**
- `apps/studio/canvas-edit.ts:661-716` (`collectElementsFull` — per-element `{id, componentName, isFrameRoot, tag}`), `:718-747` (`resolveUsageId` — the `sharedInternalId + occurrenceIndex → usage` resolver; `usages.length` **is** the instance count), `:69-115` (`computeId`/`findOpening` — the positional-id root cause).
- `apps/studio/locator.ts:25-36` (`LocatorEntry {canvas, line, col, jsxPath, componentName}` — the per-cd-id source-location + `componentName` used to detect "inside a component").
- `apps/studio/canvas-shell.tsx:431-459` (`serializeArtboardTree` — per-artboard occurrence `index`), `apps/studio/client/app.jsx:5340-5350` (Layers highlight of the *specific* instance), `:5575-5580`/`:7752-7772` (the `idIndex`/`refIndex` instance protocol on reorder).
- `.ai/decisions/DDR-139-reused-component-reorder-and-phase-12.1-followups.md` (read in full — canonical shared-instance description + occurrence-index solution + the `.map()` caveat), `DDR-019-canvas-tsx-format.md` (positional cd-id), `DDR-138-jsx-node-move-reorder-and-id-resettle.md` (the move/reorder + id-resettle model).

**Structural edits: delete / insert / artboard (Stage I):**
- `apps/studio/canvas-edit.ts:757-929` (`moveElement`/`applyMove` — "the one structural edit"; reparse gate `:906-914`, indentation helpers `detectIndentUnit` `:574-578` / `reindentBlock` `:584-597` / anchor logic `:864-898`), `:1956-1962` (`spanWithFraming` — framed-span removal, reuse for delete), `:1964-2050` (`applyRemoveClip` — the clip-delete pattern to generalize), `:2282-2401` (`applyInsertClip` — the `appendLeft → reparse → gate → return-id` insert pattern).
- `apps/studio/http.ts:1489-1530` (`/_api/reorder` + `idIndex`/`refIndex`), `:1753-1770` (`/_api/reorder-revert` seq-log — the id-churn-proof undo model delete/insert must reuse), `:1567-1585`/`~:1600` (`/_api/remove-sequence`/`insert-sequence` — route shape to mirror).
- `apps/studio/api.ts:614-628`, `:1972-1981` (`reorderLog` whole-file `{before, after}` + `history.writeSnapshot` — the structural undo primitive).
- `apps/studio/scaffold-design.ts:30-96` (the `<DCSection><DCArtboard id label width height>…</DCArtboard></DCSection>` shape + the `layout.artboards[]` meta entry a new empty artboard must synthesize), `apps/studio/canvas-lib.tsx:1763-1912` (`DCArtboard` — `width`/`height` props are the resize target, DDR-027), `apps/studio/use-artboard-drag.tsx` (whole file — the artboard chrome-drag; resize handles compose with it), `apps/studio/canvas-meta.schema.json:140` (DDR-027 JSX-authoritative size + default-grid).
- `apps/studio/tool-palette.tsx` (whole file — the annotation-tool palette; the insert-element/insert-artboard UI affordance lives near here, but writes canvas *source*, not the annotation layer — keep that boundary explicit).

**Undo + anti-flicker (Stage K, cross-cutting):**
- `apps/studio/undo-stack.ts:41-90` (`EditCommand`/`CommandRecord`/`CommandSinks`), `:120-185` (reducer + `MAX_DEPTH`), `:125-147` (`registerCommand`/`rebuildCommand`), `apps/studio/use-undo-stack.tsx:205-308` (`push`/`record`/`undo`/`redo`/`clear` + `maude:invalidate-undo`).
- `apps/studio/commands/reorder-command.ts` (the structural-command template + why an inverse *descriptor* goes stale → server seq-log), `commands/edit-source-command.ts` (the `op:'css'|'text'|'attr'` command reused by resize/spacing/media), `commands/move-artboards-command.ts` (the layout-patch command reused by artboard move/resize).
- `apps/studio/client/app.jsx:8121-8132` (`recordSourceEdit` — the exact call a CSS-shaped op makes to be undoable), `:8104` (`applyOptimisticStyle` — the pre-write preview that also arms the no-flicker window), `:7643-7687` (`apply-edit` undo relay), `:7724-7751` (`reorder-revert` relay).
- `plugins/design/templates/_shell.html:202-245` (`lastCssOptimisticAt` + 1.5s suppression `:376`, `softReload` import-before-swap `:225-245`), `apps/studio/hmr-broadcast.ts:145-172` (the `module` HMR classifier).
- `apps/studio/client/styles/1-tokens-maude.css:102-108` (`--dur-*`/`--ease-*` motion tokens), `:288-292` (`prefers-reduced-motion` collapse), `apps/studio/canvas-shell.tsx:196-285` (`HALO_CSS` — halo/handle transition idiom), `apps/studio/equal-spacing-handles.tsx` (whole file — the read-only rAF-follow overlay scaffold the on-canvas spacing drag extends; header note "drag-to-adjust is a Wave 3.x follow-up" = this plan builds it).
- `.ai/logs/rca/issue-undo-redo-coverage-gaps.md` (the undo-coverage matrix — this plan closes the element-delete/insert gap; do not reopen others).

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio.tsx` (+ `Studio.css`) | (no sidecar status) | — | "Studio — Maude app-shell redesign". Per **DDR-104 §7** the Inspector composition (token dropdowns, box-model widget, section rhythm, provenance) was designed here first, then ported to `app.jsx` `CssKnobs`. Ground all Stage-B/C/F panel additions (Position section, Media section, auto-open affordance) in this canvas's inspector artboard **before** porting to the shell — the DDR-104 "critic ≥ 4.0 then port" contract still applies to net-new knob UI. |

### Documentation

- [Figma — Adjust & constrain layers](https://help.figma.com/hc/en-us/articles/360039957734) — Why: canonical 8-point resize-handle grammar (corner + edge handles, Shift = aspect-lock, Alt/Opt = resize-from-center, arrow-key nudge) that Stage D must match so the interaction is "what they're used to".
- [Figma — Constraints](https://help.figma.com/hc/en-us/articles/360039957734) — Why: pin-to-edge constraints are the mental model behind a `top/right/bottom/left` inset widget; the Position section should read like Figma's constraints box.
- [Webflow — Style panel: Position & the box model](https://university.webflow.com/lesson/position) — Why: the reference for a `position` select + inset (`top/right/bottom/left`) inputs shaped like the margin/padding widget, and the `object-fit` cover/contain control for images. DDR-104 already benchmarked Webflow's box-model; this extends the same lineage.
- [MDN — `object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) + [`aspect-ratio`](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio) — Why: the exact value sets for the Media knob section (`cover`/`contain`/`fill`/`none`/`scale-down`).
- **In-repo — `.ai/decisions/DDR-104-css-panel-ux-model.md`** — Why: **this plan's Stage B reverses DDR-104 decision §3's OUT-list** (`position`, `top/right/bottom/left`, `transform`, `text-transform`, `object-fit`, `aspect-ratio` were explicitly deferred). Read its §3 + Addendum to reuse the vocabulary/provenance rules and to write the superseding DDR (Task G1) correctly.
- **In-repo — `.ai/plans/feature-photo-editor.md`** — Why: the adjacent plan. Confirm the boundary (that plan = pixels/look via `/_api/photo-edit`; this plan = box/framing/source via `edit-css`/`edit-attr`) so the two Inspector additions (its "Photo" tab vs this plan's "Media" section + "Replace…") don't collide. Both touch `InspectorPanel` and the element/annotation context menus — coordinate the insertion points.

### Patterns to Follow

The CSS-knob write path is the load-bearing pattern for every new knob (`apps/studio/client/app.jsx`):

```js
// :4385-4394 commit(property, raw): optimistic(live postMessage into iframe)
//   → setA(overlay) → POST /_api/edit-css → record(undo). Generic over ANY property.
// :4461-4517 makeScrub(prop, {sides}): drag-to-value, live optimistic per move,
//   commit once on release. opts.sides = { pair, all } drives alt / alt+shift.
// :4828 side(prop, group): the box-model longhand input — MIRROR for the Position inset widget.
```

The reposition lane is the load-bearing pattern for resize commit (`apps/studio/client/app.jsx:8244-8290`):

```js
// repositionElement chains writeProp('left') → writeProp('top') on a serialized
// editApplyChainRef, then records BOTH to the undo stack. Extend the chain to
// write width/height (+left/top) — same serialization, same per-prop undo records.
```

The specimen-hover fallback is the pattern for Stage E (`apps/studio/canvas-comment-mount.tsx:93-104`):

```js
// pickSpecimenEl(): anchors on a data-cd-id element WITHOUT requiring
// .dc-artboard-body ancestry — generalize this into the specimen select resolver.
```

---

## Design Decisions

### Competitive patterns adopted (Figma / Webflow / Pencil.dev)

| Interaction | Reference app | Adopted behavior |
| --- | --- | --- |
| Resize handles | Figma / Framer | 8 handles (4 corner + 4 edge), constant screen size at any zoom (mirror `use-annotation-resize.tsx`), Shift = aspect-lock, Alt/Opt = resize-from-center, cursor per handle (`nwse`/`nesw`/`ns`/`ew`). |
| Move | Figma / Webflow | Keep existing: in-flow = tree reorder (`ReorderDrag`), absolute = coordinate `left/top`. **No** layout-mutating "convert to absolute on drag" — a raw `position` knob makes that intent explicit instead of implicit. |
| Position inputs | Webflow / Figma constraints | `position` select + a `top/right/bottom/left` inset widget shaped exactly like the margin/padding box (reuse `side()`). |
| Select → panel | Figma / Pencil.dev | Selecting an element reveals the properties panel immediately (Stage C auto-open). |
| Image framing | Webflow | `object-fit` segmented (cover/contain/fill), `aspect-ratio`, plus a one-click "Replace image" that opens an asset picker. |

### Components (from registry — reuse, don't reinvent)

| Component | Source | Notes |
| --- | --- | --- |
| `side()` box-model input | `app.jsx:4828` | Reused verbatim for the Position inset widget (`top/right/bottom/left`), with `makeScrub`'s `sides` modifiers. |
| `csel()` enum select | `app.jsx:4673` | Reused for `position`, `font-style`, `text-transform`, `text-decoration`, `object-fit`. |
| `num()` / `text()` | `app.jsx:4724` / `:4709` | `num` for `aspect-ratio` numeric; `text` for `transform` / `object-position`. |
| `makeScrub` segmented + provenance | `app.jsx:4461`, `:4547` | All new numeric rows scrub-drag; all rows show the provenance dot. |
| Selection halo + `ContextualToolbar` | `canvas-shell.tsx:197-198`, `contextual-toolbar.tsx` | Reused by the Stage-E specimen selection layer (render around a specimen selection). |
| `repositionElement` chain | `app.jsx:8244-8290` | Extended (not replaced) to carry width/height for resize commit. |
| Annotation resize hook geometry | `use-annotation-resize.tsx` | Structural model for the new element resize hook. |

### Icons

| Icon | Library | Size | Usage |
| --- | --- | --- | --- |
| `move` / `frame` | Lucide line (matches existing tab icons) | 12–16 | Position section header / leading glyph. |
| `image` / `replace` (`arrow-left-right`) | Lucide line | 16 | "Replace image…" context-menu + Media section. |
| `maximize-2` | Lucide line | 12 | `object-fit: cover`/resize affordance. |

### Tokens

No new tokens. Inspector chrome uses existing DS tokens; new knob rows inherit `.st-cp-*` styling from `styles/3-shell-maude.css` (box-model widget classes `.st-cp-box*` `:707-718`, per-corner `.st-cp-corners` `:781-785` — mirror for the Position inset). Handle styling reuses the `.sel-handle` DS specimen recipe already referenced by `use-annotation-resize.tsx:46-47`.

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `useElementResize` hook (`apps/studio/use-element-resize.tsx`) | No element resize exists; annotation resize targets the SVG model, not DOM elements. | New — structural mirror of `use-annotation-resize.tsx`, writes via `reposition-request`/`edit-css`. |
| Element resize-handle overlay | Rendered by CanvasShell around the selection halo. | New — reuses `.dc-annot-resize-handle` geometry + `.sel-handle` styling. |
| Position inset knob (`positionBox`) | `top/right/bottom/left` widget. | New render in `CssKnobs`, but built entirely from the existing `side()` primitive. |
| Media knob section (`mediaSec`) | `object-fit`/`aspect-ratio`/`object-position`, shown only for `<img>`/`<video>`/bg-image selections. | New section in `CssKnobs`, built from `csel`/`num`/`text`. |
| Asset picker (`AssetPicker`) | No asset browser exists anywhere. | New small dialog: lists `assets/`, upload (`POST /_api/asset`), fetch-by-URL (`maude design fetch-asset` semantics), returns a path for `src`-replace. |
| Specimen selection layer | Bare specimens have no CanvasShell. | New minimal layer in the lite mount reusing halo + toolbar + resize overlay. |
| Edit-scope resolver (`resolveEditScope`) | No local-vs-shared / instance-count is surfaced anywhere. | New — composes `collectElementsFull`/`resolveUsageId` (`canvas-edit.ts`) + `_locator.json` `componentName`; feeds the scope badge (INV-3). |
| Structural ops (`applyDeleteElement`/`applyInsertElement`/`applyInsertArtboard`) + routes | Only video-comp `<Sequence>` clips have delete/insert today. | New in `canvas-edit.ts`, modeled on `applyRemoveClip`/`applyInsertClip`/`moveElement`; whole-file-snapshot undo. |
| Delete/insert undo commands (`commands/delete-element-command.ts`, `insert-element-command.ts`) | New structural ops need serializable command builders + sinks. | New — mirror `commands/reorder-command.ts` (server seq-log revert). |
| On-canvas spacing overlay (`useSpacingHandles`) | No on-canvas padding/gap drag (only read-only equal-spacing dots). | New — extends `equal-spacing-handles.tsx`'s rAF-follow scaffold + `makeScrub`; commits via `edit-css`. |
| `SCREEN_PRESETS` table + "+ Artboard"/"+ Element" affordances | No element/artboard insertion UI or device-size presets exist. | New — device sizes (Desktop 1440×1024 / Laptop 1280×800 / Tablet 834×1194 / Mobile 390×844 / Custom) + palette entries near `tool-palette.tsx`. |

---

## Tasks

Execute in order. Tasks are grouped into dependency stages (A→G); the whole set lands as **one** plan. Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR.

### Stage A — Camera/scroll bug fixes (the two reported bugs)

#### ✅ Task A1: FIX the `select-by-id` reveal so it pans the camera instead of scrolling the host — DONE

- **Do**: In `canvas-shell.tsx:1618-1637`, replace `(target).scrollIntoView({ block:'nearest', behavior:'smooth' })` (`:1634`) with a **camera-aware reveal**: measure the target's world box (same affine as `__maudeCanvasRects`, `canvas-lib.tsx:1983-1988`), and only if it's outside the current viewport, call the viewport controller to pan `.dc-world` (reuse the `zoomAt`/`applyViewport` math, `canvas-lib.tsx:902-917`/`:873-888`) so the element comes into view *through the transform*. If it's already visible, do nothing (no reveal, no animation).
- **Pattern**: `use-annotation-resize.tsx:42` already consumes `useViewportControllerContext` — use the same controller handle to move the camera.
- **Gotcha**: This is the shared root cause of Bugs A **and** B. Verify with the research's repro signal: a *direct* in-canvas ⌘-click selects via `use-selection-set.tsx:149-156` (no `scrollIntoView`), so Bug B reproduces **only** through the `select-by-id` channel (Layers-panel click / restore / post-edit reselect). Test both channels.
- **Validate**: `maude design screenshot` before/after selecting an overflowing element via the Layers panel; confirm no host scroll and no right-strip. `cd apps/studio && bun test`.

#### ✅ Task A2: ADD a host-scroll-0 invariant clamp — DONE

- **Do**: Add a guard so the `.dc-canvas` host's `scrollLeft/scrollTop` can never drift from 0 (a `scroll` listener that resets to 0, or the canonical fix: ensure nothing programmatically scrolls it). This defends the camera model — `writeTransform` (`canvas-lib.tsx:799-816`) and `__maudeCanvasRects` (`:1975-2039`) both assume host scroll 0; the clamp makes that assumption enforced rather than incidental.
- **Gotcha**: Don't break legitimate scroll *inside* an artboard's own overflow content — scope the clamp to the `.dc-canvas` host and `.dc-artboard-body`/`.dc-artboard` reveal-scroll specifically, not to author-authored scroll containers inside a mock.
- **Validate**: After A1, drag an absolute element far outside its artboard, drop it, confirm the camera stays put (Bug A gone). `cd apps/studio && bun test`.

#### ✅ Task A3: ADD a regression test for the camera-desync class — DONE

- **Do**: New test (near the selection tests) asserting that a `select-by-id` on an out-of-artboard element does not change host `scrollLeft/scrollTop` and does not mutate `vpRef` unexpectedly (or, at the harness level, that the reveal path calls the camera controller, not `scrollIntoView`).
- **Validate**: `cd apps/studio && bun test`.

### Stage B — Curated-knob expansion (Position / Transform / Typography / Media props)

#### ✅ Task B1: EXTEND `KNOB_PROPS` with the promoted properties

- **Do**: In `dom-selection.ts:249-292`, add: `position`, `top`, `right`, `bottom`, `left`, `z-index`, `transform`, `transform-origin`, `font-style`, `text-transform`, `text-decoration`, `white-space`, `overflow`, and the media props `object-fit`, `aspect-ratio`, `object-position`. This makes `styleMapsFor` (`:300-347`) capture their `authored`/`computed` values into the `Selection` payload so the new panel rows are populated (and so they're excluded from the "customStyles" Advanced bucket).
- **Gotcha**: `KNOB_PROPS` is `as const` and also drives the customStyles-exclusion logic — adding a prop here moves it *out* of the Advanced hatch and *into* curated rendering. That's intended, but verify a canvas that had one of these as a raw custom prop now surfaces it in its curated row (not duplicated in Advanced).
- **Validate**: `cd apps/studio && bun tsc --noEmit`; select an element with an inline `position`/`object-fit` and confirm it arrives in `el.authored`.

#### ✅ Task B2: ADD the `CSS_*` option lists

- **Do**: Near `app.jsx:3637-3677`, add `CSS_POSITION` (`static`/`relative`/`absolute`/`fixed`/`sticky`), `CSS_FONT_STYLE` (`normal`/`italic`/`oblique`), `CSS_TEXT_TRANSFORM` (`none`/`uppercase`/`lowercase`/`capitalize`), `CSS_TEXT_DECORATION` (`none`/`underline`/`line-through`/`overline`), `CSS_OBJECT_FIT` (`fill`/`contain`/`cover`/`none`/`scale-down`), `CSS_OVERFLOW` (`visible`/`hidden`/`auto`/`scroll`). Add `PROP_LEAD` glyphs where a leading icon aids scanning (e.g. position T/R/B/L).
- **Validate**: `cd apps/studio && bun tsc --noEmit`.

#### ✅ Task B3: ADD the Position section to `CssKnobs`

- **Do**: In `CssKnobs` (`app.jsx:4280+`), add a `Position` section (canonical order: after `Layout`, before `Typography`) containing: `position` via `csel('position', CSS_POSITION)`, a `top/right/bottom/left` **inset widget** built by mirroring the margin/padding box (`side()` at `:4828` + the `.st-cp-box` markup at `:4947-4967`), and `z-index` via `num`. Register all five props in `SECTION_PROPS` (`:4597`) so section-reset works. Gate the inset widget's *relevance hint* on `position` being non-static (show a subtle "requires position: relative/absolute" note when static — but keep the inputs editable, mirroring how `gap` degrades on non-flex).
- **Pattern**: the margin/padding box (`:4944-4969`) is the exact structural template; `makeScrub(prop, { sides })` gives the alt/alt+shift multi-side drag for free.
- **Gotcha**: `top/right/bottom/left` accept `auto` — the box `side()` already handles the `auto` empty-state dimming (DDR-104 addendum); confirm `auto` round-trips.
- **Validate**: `maude design screenshot` of the CSS tab on an absolute element; scrub each inset side; confirm live preview + Cmd+Z.

#### ✅ Task B4: ADD the Transform + Typography rows

- **Do**: Add a `transform` row (in an `Appearance` or new `Transform` subsection) via `text('transform')` with a token-or-text control (mirror `box-shadow`'s free-value row `:5043`). Add `font-style`, `text-transform`, `text-decoration` rows to the existing `Typography` section via `csel` (or a segmented group mirroring `text-align` `:4920-4940` for `text-transform`). Register all in `SECTION_PROPS`.
- **Validate**: `maude design screenshot`; toggle `text-transform: uppercase` on a heading, confirm live + persisted.

#### ✅ Task B5: ADD the conditional Media section

- **Do**: Add a `Media` section rendered **only** when the selection is an `<img>`/`<video>`/`<picture>` (check `el.tag`) or carries a background image: `object-fit` via `csel('object-fit', CSS_OBJECT_FIT)` (or a segmented cover/contain/fill), `aspect-ratio` via `num`/`text`, `object-position` via `text`. This is where "aspect ratio / background cover" from the brief lands as first-class knobs.
- **Gotcha**: Coordinate the section's insertion point with the photo-editor plan's "Photo" tab (`feature-photo-editor.md` Task 13) — Media is a *section in the CSS tab*, Photo is a *separate tab*; they must not fight over the same DOM slot. If the photo-editor plan lands first, add Media as a sibling section; if this lands first, leave a comment marking the tab-host contract.
- **Validate**: select an authored `<img>`; confirm the Media section appears with cover/contain working live.

#### ✅ Task B6: RECORD the DDR-104 reversal (see Task G1 — flagged here so the row-set change is traceable)

- **Do**: Note in the code comment on the new sections that they promote DDR-104 §3's OUT-list; the actual DDR is Task G1.
- **Validate**: N/A (doc pointer).

### Stage C — Auto-open CSS panel on select

#### ✅ Task C1: ADD the auto-open-on-select behavior

- **Do**: In the `select-set` handler (`app.jsx:7594-7613`), when a fresh **single** selection arrives (`el.id` present) and **no** right panel is currently open (`!inspectorOpen` and no other right dock), call `openRightPanel('inspector')` and set the active tab to `'css'`. Never act when a right panel is already open (the user's explicit guard — "jen pokud už není otevřený inspect panel"), and never override a user currently on the Layers/Inspect tab.
- **Pattern**: `openRightPanel` (`:6318`) already does the mutual-exclusion; the tab state lives in `InspectorPanel` — thread an initial/`requestedTab` prop or lift the tab state so the handler can set `'css'`.
- **Gotcha**: Don't auto-open on *multi*-select or on clear-select. Don't thrash: opening should be idempotent within a selection. Respect the DDR-105-addendum reload-suppression so the open doesn't fight an in-flight optimistic apply.
- **Validate**: ⌘-click an element with the panel closed → Inspector opens on CSS tab; ⌘-click another with it already open on Layers → stays on Layers.

#### ✅ Task C2: ADD a persisted "auto-open inspector on select" preference (default on)

- **Do**: Back the behavior with a `localStorage` preference (mirror `usePanelSize`'s persistence, `app.jsx:6110`), default **on**, exposed as a checkbox in the View menu (near the Inspector item, `:2572`). A user who finds it intrusive can disable it.
- **Validate**: toggle off → selecting no longer auto-opens; reload → preference persists.

### Stage D — On-canvas drag-resize (+ move solidified by Stage A)

#### ✅ Task D1: CREATE `use-element-resize.tsx` — DONE

- **Do**: New hook mirroring `use-annotation-resize.tsx`: given the current selection's world box (from `__maudeCanvasRects`/the selection bounds), render 8 screen-space handles (`nw/ne/sw/se` corners + `n/s/e/w` edges), constant 8×8px at any zoom, with correct resize cursors. On drag, compute the new `width`/`height` in world units (`dxClient / zoom`, mirroring `use-artboard-drag.tsx:146-152`), applying: Shift = aspect-lock (scale the opposite dimension proportionally), Alt = resize-from-center (grow/shrink symmetrically). For corner/edge handles that move the top or left edge, also adjust `left`/`top`. Live-preview every move via the optimistic `apply-style` postMessage (reuse `applyOptimisticStyle`); commit once on pointer-up.
- **Gotcha**: Only elements with an explicit or resolvable box should show handles; skip inline text runs where width/height are meaningless. For **in-flow** elements, resizing writes explicit `width`/`height` (fine); it does **not** convert to absolute. For **absolute** elements a top/left-edge drag writes `width`+`left` (or `height`+`top`) together.
- **Validate**: `maude design screenshot` mid-resize; confirm handles stay 8px at 50%/200% zoom.

#### ✅ Task D2: RENDER the resize overlay in CanvasShell around the selection halo — DONE

- **Do**: Mount `use-element-resize`'s overlay in `canvas-shell.tsx` alongside the existing selection halo (`:197-198`, `:2432-2440`), for a single non-annotation element selection in move-tool mode. Ensure it composes with `ReorderDrag` (`:2500-3046`) — a pointerdown on a handle must claim resize and **not** start a reorder/reposition drag (handle hit-test wins; `stopPropagation`).
- **Gotcha**: The halo is `position:fixed` + rAF-tracked; handles must track the same rect so they don't lag during zoom/pan.
- **Validate**: select an element → 8 handles appear; drag a corner → resizes; drag the body (not a handle) → still moves via the existing reorder/reposition path.

#### ✅ Task D3: EXTEND `repositionElement` to commit width/height (+ left/top) — DONE (via sibling resizeElement)

- **Do**: Extend `app.jsx:8244-8290` (or add a sibling `resizeElement`) so a resize commit chains the changed props (`width`, `height`, and `left`/`top` when the edge moved) on the same serialized `editApplyChainRef`, recording each to the undo stack (as reposition already does for `left`+`top`). Post via a new `dgn:'resize-request'` (mirror `reposition-request`, pinned to `activePath`, `:7773-7791`) or reuse `reposition-request` with an extended payload.
- **Gotcha**: `/_api/edit-css` is single-property (`http.ts:1393`), so a 4-property resize is 4 serialized writes → 4 HMR reloads. The DDR-105-addendum reload-suppression window (1.5 s) + the serialized chain keep it from flickering, but verify the *final* rendered box is correct and Cmd+Z steps back cleanly. **Optional optimization (only if flicker is observed):** add a `POST /_api/edit-css-batch` that writes multiple `{property,value}` in one `editAttribute` pass + single reload — but that is a *new route* (add to neither canvas allowlist, `sameOriginWrite`-guard it) and needs its own test; prefer the serialized chain first.
- **Gotcha (scope)**: if the resized element is inside a reusable component, `width`/`height` written via `edit-css` change **all instances** (Stage H). For a resize on a component **instance**, route through the occurrence-index resolver per Stage H so it stays local; otherwise show the Stage-H "affects N instances" confirm. Do **not** ship resize before Stage H's scope surfacing.
- **Validate**: resize an absolute element from its top-left corner; confirm width/height/left/top all persist to the `.tsx`, one coherent render, Cmd+Z reverts.

#### 🟡 Task D4: ADD free-hand artboard resize — numeric-attr engine (`applyResizeArtboard`) + `/_api/resize-artboard` route + shell + undo + tests DONE; ElementResizeOverlay artboard-scope extension REMAINING

- **Do**: Extend the resize-handle overlay to the **artboard** scope: when an artboard frame (`[data-dc-screen]`) is the active selection, render the 8 handles around the artboard and, on drag, write the new `width`/`height` **props** on the `<DCArtboard>` element via `/_api/edit-attr` (per DDR-027 artboard size is JSX-authoritative, not a `layout` field). Reuse `use-element-resize`'s geometry + `use-artboard-drag.tsx`'s screen-delta÷zoom math; compose with the existing artboard chrome-drag (a handle pointerdown claims resize, the chrome body still moves).
- **Pattern**: `DCArtboard` `width`/`height` authoring (`canvas-lib.tsx:1763-1912`, `scaffold-design.ts:36`); artboard drag (`use-artboard-drag.tsx`).
- **Gotcha**: `width`/`height` are numeric JSX **attributes** (`width={430}`), not inline style — write via `edit-attr` (`attr:'width'`), and record two `edit-source` `op:'attr'` undo entries. Don't write them into `layout.artboards[]` (DDR-027 strips `w`/`h` there). Live-preview via optimistic apply on the artboard element.
- **Validate**: drag an artboard corner → its `width`/`height` props update in source, one coherent render, Cmd+Z reverts; `--all-screens` screenshot still labels it.

### Stage E — Element selection + inspect on DS specimens

#### ✅ Task E1: TEACH the lite mount to produce a selection on bare specimens — DONE

- **Do**: In `canvas-comment-mount.tsx`, add `'select'` to the lite mount's claimable actions (currently `COMMENT_CLAIMS` at `:75-80` deliberately omits it) and wire a specimen-aware select resolver by generalizing `pickSpecimenEl` (`:93-104`) — anchor on the hit element's own `data-cd-id` (specimens are already stamped, `canvas-pipeline.ts:211-226`) **without** requiring `.dc-artboard-body`/`[data-dc-screen]` ancestry. Build the `Selection` via the existing `hoverTargetToSelection` machinery (`dom-selection.ts:349-399`) with a null `artboardId` (the selector degrades to a bare `[data-cd-id="…"]`).
- **Gotcha**: `resolveHoverTarget` (`input-router.tsx:592-658`) returns null without artboard ancestry — do **not** loosen that (it's load-bearing for UI canvases); instead give the specimen path its own resolver. `scopedCdSelector` (`dom-selection.ts:124-128`) must tolerate a null artboard scope.
- **Validate**: ⌘-click an element inside `system/<ds>/preview/logo.tsx` → a `select-set` message reaches the shell; the Inspector shows the element.

#### ✅ Task E2: RENDER a minimal selection layer on specimens — DONE

- **Do**: In the lite mount tree (`buildCanvasTree`, `:362-372`), render a minimal selection layer for the specimen path: a selection halo + the `ContextualToolbar` (`contextual-toolbar.tsx`) + the Stage-D resize overlay, reusing the same components CanvasShell uses. This gives specimens the same select→inspect→resize affordances without pulling in the full CanvasShell.
- **Gotcha**: Specimens have no camera/artboard, so world↔screen is identity (no `.dc-world` transform) — the halo/handle math must handle the no-camera case (guard the `getLiveViewport`/controller calls). Verify the contextual toolbar's "Inspect"/"Copy CSS" still post correctly (they already post to `window.parent`, `contextual-toolbar.tsx:207-251`).
- **Validate**: select a specimen element → halo + toolbar appear; "Inspect" opens the panel; edit a knob → persists to the specimen `.tsx` via `edit-css`.

#### ✅ Task E3: VERIFY the specimen write path end-to-end + `_active` tracking — mechanism verified (live specimen-edit → Stage-G scenario)

- **Do**: Confirm (research says it's ready, but verify live) that `edit-css`/`edit-attr` on a specimen element (`el.file` = `system/<ds>/preview/X.tsx`, `el.id` = `data-cd-id`) writes correctly, `_active.json` tracks the specimen selection, and the halo restores after HMR. No code change expected unless a gap surfaces.
- **Validate**: edit a specimen element's `color` → source updates, HMR reloads, halo restores. `cd apps/studio && bun test`.

### Stage F — Media swap/replace + framing

#### 🟡 Task F1: CREATE the `AssetPicker` dialog — DONE (list `/_api/assets` GET + upload); fetch-by-URL deferred (needs a host-allowlisted download route)

- **Do**: New small dialog listing existing `assets/` (a `GET` that enumerates the content-addressed asset dir — add a read-only `/_api/assets` list route if none exists, `sameOriginWrite` N/A for GET but keep it main-origin), plus **upload** (reuse `POST /_api/asset`, `use-canvas-media-drop.tsx:171`) and **fetch-by-URL** (the `maude design fetch-asset` semantics from the `reference_canvas_images_download_first` memory — download local, reference flat `assets/<sha8>`). Returns a chosen `assets/<sha8>.<ext>` path.
- **Gotcha**: Never hotlink — the CSP split origin blocks remote `<img>` (per memory `reference_canvas_images_download_first`); the picker must always resolve to a local `assets/` path.
- **Validate**: open the picker, pick an existing asset + upload a new one + fetch a URL; each returns a valid local path.

#### ✅ Task F2: ADD "Replace image/media…" for authored `<img>`/`<video>` (context menu + Media section) — DONE (context-menu "Replace image…" + Media-section "Replace…" button → `/_api/edit-attr` src + undo; I3 image-insert wired through the picker)

- **Do**: Add a "Replace image…" entry to the element right-click menu (`canvas-shell.tsx:1323-1372`, alongside "Copy CSS"/"Inspect") and a "Replace" button in the Media knob section (Task B5), shown when the selection is an `<img>`/`<video>`. On pick, re-point `src` via `/_api/edit-attr` (`attr: 'src'`, value = the picked path) — the `editAttribute` src-replace path already exists (`canvas-edit.ts:1627`).
- **Gotcha**: `edit-attr` writes a JSX attribute; a `src` that's a template expression (`src={foo}`) can't be safely string-replaced — detect and fall back to "edit with /design:edit" (mirror the `CssKnobs` `!editable` disabled state, `app.jsx:4524-4535`).
- **Validate**: right-click an authored `<img>` → "Replace image…" → pick → the `src` in the `.tsx` updates, canvas re-renders, Cmd+Z reverts.

#### Task F3: ADD "Replace…" for annotation `ImageStroke`/`MediaRefStroke` — TODO (separate annotation-model path)

- **Do**: Add the same "Replace…" entry to `AnnotationContextMenu` (`annotations-layer.tsx:3745-3816`), gated on an `ImageStroke`/`MediaRefStroke`. On pick, update the stroke's `href`/`src` through the annotation model (mirror `createImageFromFile`'s href-swap, `:1114-1160`) — **not** `edit-css` (annotation images have no `data-cd-id`).
- **Gotcha**: This rides the annotation write path, not the source-write routes — keep the two clearly separated (research flagged this as the exact fault line between the three media representations).
- **Validate**: drop a photo into the annotation layer → right-click → "Replace…" → pick a different asset → the `<image href>` swaps; undo works.

### Stage H — Reusable-component edit-scope predictability (the "must be predictable" contract)

> User-chosen model (Option A): **surface the scope + keep instance move/resize local**. No per-instance style override, no detach. The predictability comes from *showing* whether an edit is local or shared, and from routing instance move/resize per-occurrence.

#### Task H1: CREATE an edit-scope resolver (local vs shared, instance count)

- **Do**: Add a server-side (or parse-time) resolver that, for a selected `data-cd-id`, returns `{ scope: 'local' | 'shared', componentName, instanceCount }`. Compute it from the existing primitives: read the id's `componentName` from `_locator.json` (`locator.ts:25-36`) — `shared` iff `componentName` names a real component (not the top-level artboard function) — and `instanceCount = collectElementsFull().filter(e => e.tag === componentName).length` (`canvas-edit.ts:661-747`, the exact computation `resolveUsageId` already ships). Surface it on the `Selection` (extend the payload) or via a small `GET /_api/edit-scope?canvas&id`.
- **Gotcha**: the `.map()` caveat (DDR-139 §1) — a single `<Card/>` inside `.map()` has `instanceCount === 1` but renders N DOM nodes. For an accurate badge, combine the source usage count with the DOM occurrence count (from `serializeArtboardTree`'s per-artboard `index`, `canvas-shell.tsx:431-459`). Label honestly: "shared source · rendered N×".
- **Validate**: `cd apps/studio && bun test` with fixtures: an artboard-local `<div>` → `local`; a `<div>` inside a `Card` used in 3 artboards → `shared, instanceCount 3`.

#### Task H2: SURFACE the scope in the Inspector + on destructive/global edits

- **Do**: Add a scope badge to the Inspector header (near `el.selector`, `app.jsx:5876`) and the contextual toolbar: **"Local — this artboard only"** vs **"Shared component · edits N places"**. For a **shared** element, a first style/attr edit in a session shows a one-time inline confirm ("This changes N instances across artboards — edit anyway?"), remembered per session so it isn't nagging. Delete of a shared element (Stage I) always confirms.
- **Pattern**: reuse the Layers-tab per-instance highlight already shipped (`app.jsx:5340-5350`) so selecting an instance highlights only that occurrence, reinforcing the mental model.
- **Gotcha**: don't block the edit — this is *legibility*, not a gate (except delete). The user's model explicitly accepts that inner-shared-element styling is global; the badge just makes it never surprising.
- **Validate**: select an inner element of a 3×-used component → header shows "Shared · edits 3 places"; select an artboard-local element → "Local".

#### Task H3: ROUTE instance move/resize/reposition per-occurrence so it stays local

- **Do**: When a **component instance** (`<Card/>` usage — resolvable to a usage node) is moved/resized/repositioned, send the occurrence `idIndex`/`refIndex` (the protocol already carried by reorder, `app.jsx:5575-5580`, `:7752-7772`) so `resolveUsageId` (`canvas-edit.ts:718-747`) targets that specific usage's own `left/top`/`width`/`height`, not the shared definition. This makes "absolutely position one instance" local — the user's exact ask.
- **Gotcha**: this only makes the **instance wrapper** local; positioning an *inner* element of a shared component is inherently global (no override primitive, per the chosen model) — the Stage-H2 badge + confirm is the answer there. Document this boundary in a code comment so a future reader doesn't mistake it for a bug.
- **Validate**: a `<Card/>` used in 2 artboards, both absolutely positioned via drag → each moves independently (its own instance), neither drags the other.

### Stage I — Structural edits: delete element, insert element, new artboard

> New capability: general element delete + insert (only video-comp `<Sequence>` clips have these today). All ride the `reorder`-style five-part wiring with **whole-file-snapshot undo** (a structural edit renumbers positional ids, so an inverse *descriptor* goes stale — DDR-138/139).

#### ✅ Task I1: CREATE the `delete-element` source op + route — DONE (engine + route + tests)

- **Do**: In `canvas-edit.ts`, add `applyDeleteElement(source, id, occurrence?)`: `findOpening` → `spanWithFraming` (`:1956-1962`) → `MagicString.remove` → **reparse gate** (`:906-914`); for a shared-component instance, resolve the specific usage via `resolveUsageId` first (delete the `<Card/>` usage, artboard-local — not the shared def). Add `POST /_api/delete-element {canvas, id, idIndex?}` (main-origin-only, `sameOriginWrite`+loopback) writing a `reorderLog`-style whole-file `{before, after}` under a `seq`, plus history snapshot (`api.ts:1972`).
- **Pattern**: `applyRemoveClip` (`canvas-edit.ts:1964-2050`) is the near-exact template; `/_api/remove-sequence` (`http.ts:1567-1585`) is the route shape.
- **Gotcha**: refuse to delete the last child of an artboard into invalid JSX (reparse gate catches it, but message it). Deleting a shared-component **inner** element deletes it everywhere — gate behind the Stage-H2 confirm.
- **Validate**: `cd apps/studio && bun test` (delete round-trips, reparse gate rejects a delete that would break JSX).

#### ✅ Task I2: WIRE delete undo + the Del-key/context-menu/toolbar affordances — DONE (undo reuses reorder-revert seq-log; Del/Backspace key + context-menu; toolbar entry deferred)

- **Do**: New `commands/delete-element-command.ts` (register via `registerCommand`), a `deleteRevertFn` sink on `CommandSinks` wired in `canvas-shell.tsx`, a parent-gated `dgn:'delete-request'` verb + shell handler (mirror `reorder-request`, `app.jsx:7752-7772`), and `undoStack.push(...)`. Trigger from: `Delete`/`Backspace` on a selected element (guard against text-editing focus), the element context menu (`canvas-shell.tsx:1323-1372`), and the contextual toolbar. Undo posts `dgn:'delete-revert'` → `POST /_api/delete-revert {seq, dir}` (or reuse `reorder-revert`'s handler generalized).
- **Gotcha**: `Delete` must NOT fire while an inline text edit or a form input is focused; reuse the keyboard-discipline guard (`use-keyboard-discipline.tsx`).
- **Validate**: select an element → press Delete → it's removed → Cmd+Z restores it exactly (whole-file snapshot). Delete a shared instance → only that instance goes.

#### 🟡 Task I3: CREATE the `insert-element` source op + route + palette — engine + route + shell + context-menu Div/Text/Image (image via AssetPicker) DONE; tool-palette place-mode REMAINING

- **Do**: In `canvas-edit.ts`, add `applyInsertElement(source, refId, position, kind)` where `kind ∈ {div, text, image}`: synthesize a minimal JSX string (`<div style={{…}} />`, `<p>Text</p>`, `<img src="assets/…"/>`) **without** `data-cd-id` (the pipeline stamps it on next transpile — `canvas-pipeline.ts:161-174`), placed at `refId`+`position` (`before`/`after`/`inside-start`/`inside-end`) using `moveElement`'s indentation helpers (`:574-597`, `:864-898`); `appendLeft` + reparse gate + return the new element's post-transpile id. Add `POST /_api/insert-element` (whole-file snapshot undo, same as delete). Add an insert affordance to `tool-palette.tsx` (a "+ Element" menu: Div / Text / Image) that, on click, enters a place-mode (click an artboard/element to choose the insertion anchor) or appends to the active artboard.
- **Pattern**: `applyInsertClip` (`canvas-edit.ts:2282-2401`) is the insert template; `tool-palette.tsx` is the palette host (but this writes canvas **source**, not the annotation layer — keep the boundary explicit in a comment).
- **Gotcha**: an inserted `<img>` needs a source — open the `AssetPicker` (Task F1) inline, or insert a neutral placeholder asset. A new element should land selected + inspectable so the user can immediately style it.
- **Validate**: `cd apps/studio && bun test` (insert round-trips, new id resolves); manual: "+ Element → Div" appends a div to the active artboard, it's selected, Cmd+Z removes it.

#### 🟡 Task I4: CREATE the `insert-artboard` op + screen-size presets — engine + route + shell + undo + tests DONE; canvas-side "+ Artboard" affordance + SCREEN_PRESETS picker + patchCanvasMeta grid REMAINING

- **Do**: Add `applyInsertArtboard(source, preset)` inserting a new `<DCArtboard id label width height>` (optionally wrapping in a `<DCSection>` if the canvas uses sections) after the last artboard, using the `scaffold-design.ts:35-79` shape, with `width`/`height` from a **preset table** (`SCREEN_PRESETS`: Desktop 1440×1024, Laptop 1280×800, Tablet 834×1194, Mobile 390×844, plus Custom W×H). Generate a unique `id`/`label`, let the pipeline stamp the `data-cd-id`, and `patchCanvasMeta` to give it a grid position (DDR-027 default-grid, `canvas-lib.tsx:1526-1528`). Surface via a canvas-level "+ Artboard" affordance (toolbar / canvas context menu / empty-canvas CTA) with a preset picker. Whole-file snapshot undo.
- **Pattern**: `applyInsertElement` (Task I3) for the source write; `scaffold-design.ts` for the artboard JSX + `layout.artboards[]` entry shape; `SCREEN_PRESETS` is new (device sizes).
- **Gotcha**: the new artboard must be **empty** (a clean frame the user fills), not pre-populated — the user's explicit intent ("začít s čistým a začít sám přidávat prvky"). Ensure `insert-element` (Task I3) then targets it. Give it a sensible default position (next grid slot) so it doesn't overlap existing artboards.
- **Validate**: "+ Artboard → Mobile" adds an empty 390×844 artboard at the next grid slot; it's selectable, resizable (Task D4), accepts inserted elements; Cmd+Z removes it.

### Stage J — On-canvas spacing (padding + gap drag)

#### Task J1: CREATE an on-canvas padding + gap drag overlay

- **Do**: New fixed-rAF overlay (mirror `equal-spacing-handles.tsx`'s follow-layer scaffold, `:159-219`) that, for a selected flex/grid container or padded element, paints draggable **padding** edges (inside the box) and **gap** handles (between flex/grid children). Dragging uses `makeScrub`'s value math (`app.jsx:4461`) and previews live via `applyOptimisticStyle`; on release, commit through `commit()`→`/_api/edit-css`→`record('css', 'padding-…'|'gap', before, after)` so it inherits `edit-source` undo (INV-1). Alt = symmetric pair, alt+shift = all sides (match the panel box-model grammar).
- **Pattern**: read-only affordance already exists in `equal-spacing-handles.tsx` (header: "drag-to-adjust … Wave 3.x follow-up; for v1 we paint the affordance only") — this task builds the deferred drag. Detector: `equal-spacing-detector.ts` for gap midpoints.
- **Gotcha**: gap only applies to flex/grid; padding to any box — gate the handles by computed `display`. Handle hit-tests must not conflict with the Stage-D resize handles (padding handles are *inside* the box, resize handles *on* the frame).
- **Validate**: `maude design screenshot` mid-drag; drag a padding edge → live preview + persisted + Cmd+Z; drag a gap → children respace; verify at 50%/200% zoom the handles track.

### Stage K — Undo coverage + anti-flicker orchestration (INV-1 / INV-2 verification)

#### Task K1: AUDIT + close undo coverage for every new op

- **Do**: Verify each new op records undo per INV-1: resize (D3/D4), delete (I2), insert element (I3), insert artboard (I4), media/bg-image swap (F2/F3), spacing drag (J1), position knobs (B3). CSS-shaped ops use `recordSourceEdit`; structural ops use their command builders. Cross-check against `.ai/logs/rca/issue-undo-redo-coverage-gaps.md` — this plan must close the "element delete/insert" row and add no new gaps. Confirm the `maude:invalidate-undo` self-write damping (`use-undo-stack.tsx:295-308`) isn't tripped by our own `patchCanvasMeta` writes (artboard insert/resize).
- **Validate**: a scripted sequence — resize → delete → insert → move instance → spacing-drag → Cmd+Z ×5 — returns the canvas to its exact start (byte-compare the `.tsx`).

#### Task K2: VERIFY anti-flicker across all new ops (INV-2)

- **Do**: Confirm every CSS-shaped op posts `dgn:'apply-style'` **before** its write so the 1.5s suppression window (`_shell.html:376`) skips the redundant reload; confirm structural ops (delete/insert) go through `softReload` (no white flash, holds last-good). Add reveal/settle transitions to the new overlays (resize handles, spacing handles, scope badge) using `--dur-soft`/`--ease-out` (`1-tokens-maude.css:102-108`) with the `prefers-reduced-motion` guard. No hard `location.reload()` on any element/spacing/media edit.
- **Gotcha**: the video-comp exception (`_shell.html:361-376`) bypasses the CSS suppression on canvases with a mounted Remotion comp — verify resize/spacing on a video-comp artboard still settles cleanly (soft-reload, not skip).
- **Gotcha (WebKit ceiling)**: on WKWebView, heavy filter/blend canvases jank on pan/zoom because WebKit doesn't GPU-accel SVG `url()`/`feTurbulence` filters (memory `project_canvas_perf_webkit_filter_ceiling`) — the mitigation is `will-change:transform`+`isolation` per `.dc-artboard` + `content-visibility` cull (already shipped); a fidelity-toggle **flickers** and rasterize-during-gesture is **impossible** on WebKit. INV-2's "no flicker" is scoped to the **edit/HMR path**, NOT this separate, accepted filter-GPU ceiling — don't chase it as a bug during resize/pan on filter-heavy artboards.
- **Validate**: screen-record a resize + a spacing-drag + a delete — no blink, halo/handles animate smoothly; toggle `prefers-reduced-motion` → animations collapse to 1ms, behavior unchanged.

### Stage L — Editor ergonomics & tool parity (from deep-research gap analysis, 2026-07-07)

> A 108-agent deep-research pass (all findings 3-0 verified against primary Figma/Webflow/Penpot docs) surfaced table-stakes affordances users of those tools reach for by muscle memory. **Already present in Maude → not re-added:** marquee/rubber-band select (`marquee-overlay.tsx`), command palette (`CommandPalette`, `app.jsx:559`), inline double-click text edit (`contenteditable .dc-text-editing`, `canvas-shell.tsx:320`), unit-switching, undo/redo. **Out of scope (no clean TSX analog):** vector boolean ops; prototyping links; element interaction-states / responsive breakpoints (note as a future plan). The tasks below are the confirmed gaps that reuse existing infra.

#### ✅ Task L1: EXTEND keyboard nudge from artboards to elements — DONE (out-of-flow elements; in-flow no-op; live verify pending dogfood)

- **Do**: `use-keyboard-discipline.tsx` already nudges **artboards** by arrow keys but explicitly scopes out elements (`:9` "arrow nudge applies to artboards only … would require an ephemeral CSS-transform overlay"). Extend it to the selected element: Arrow = 1px, Shift+Arrow = 10px (configurable), previewing via the optimistic `apply-style` overlay and committing `left/top` (absolute) or the appropriate offset through the Stage-D reposition lane on key-up (debounced), with one undo record per settle.
- **Gotcha**: bail when a text input / `contenteditable` is focused (the guard already exists in the hook). For in-flow elements without `position`, nudge is ambiguous — either no-op with a hint or nudge via `margin` (decide during impl; prefer no-op + hint to avoid surprising layout shifts).
- **Validate**: select an element → Arrow moves 1px, Shift+Arrow 10px, Cmd+Z reverts; artboard nudge still works.

#### Task L2: ADD keyboard selection traversal (parent / child / sibling)

- **Do**: Map DOM tree navigation to keys, mirroring Figma/Webflow: `Enter` = select first child, `Shift+Enter` (or `↑` per Webflow) = select parent, `Tab`/`Shift+Tab` (or `←`/`→`) = next/previous sibling, `Esc` = deselect. Resolve relatives from the selected element's DOM node + the Layers tree (`serializeArtboardTree`, `canvas-shell.tsx:431-459`) and reuse the `select-by-id` path (camera-aware after Stage A).
- **Gotcha**: this is also the **editor-accessibility** answer (the selection graph becomes mouse-free) — keep `aria` focus in sync. Don't collide with the existing `Tab` usage elsewhere; scope to when the canvas has focus + a selection.
- **Validate**: select an element → Enter drills in, Shift+Enter goes up, Tab cycles siblings, Esc clears; keyboard-only round-trip works.

#### 🟡 Task L3: ADD duplicate (Cmd+D) + Alt-drag-duplicate + paste-in-place — Cmd+D + context-menu DONE; Alt-drag / paste-in-place REMAIN

- **Do**: `Cmd/Ctrl+D` duplicates the selected element in place (slightly offset), `Alt`-drag drops an instant copy at the release point, and `Cmd/Ctrl+Shift+V` pastes a copied element at its original coordinates onto the selected frame (not nested). All three are **structural inserts** — reuse the Stage-I `insert-element` engine (clone the source JSX span, re-anchor) + its whole-file-snapshot undo.
- **Gotcha**: duplicating a **shared-component instance** duplicates the `<Card/>` usage (artboard-local), consistent with the Stage-H scope model. Cross-canvas paste must resolve the asset/component imports or warn.
- **Validate**: Cmd+D on an element → an offset copy appears + selected; Alt-drag → copy at drop point; both Cmd+Z-reversible.

#### ✅ Task L4: ADD copy-style / paste-style (Cmd+Opt+C / Cmd+Opt+V) — DONE (appearance-only; N-step undo, live verify pending dogfood)

- **Do**: `Cmd/Ctrl+Opt/Alt+C` captures the selected element's authored style map (the `authored`/`customStyles` already on the `Selection`), `Cmd/Ctrl+Opt/Alt+V` applies it to another selected element by chaining `edit-css` writes for each captured property (serialized on `editApplyChainRef`, one undo group). Also expose via the context menu ("Paste style").
- **Gotcha**: apply only *authored* props (not resolved computed) so you don't bake inherited/DS-token values into raw overrides — respect the DDR-104 authored-vs-computed distinction. This is the natural batch-write case that may justify the optional `edit-css-batch` route (Task D3).
- **Validate**: style element A, copy its style, select B, paste-style → B gains A's authored props; Cmd+Z reverts as one step.

#### Task L5: ADD distribute / equal-spacing / tidy-up as a multi-select operation

- **Do**: On a multi-selection, add **Distribute horizontal/vertical spacing** (equalize gaps, keep outer elements fixed) and **Tidy up** (snap into a clean row/column/grid). Reuse `equal-spacing-detector.ts` (gap detection) + the align math; write results as `left/top` (absolute) or reorder (flow) via the existing lanes. **First verify the scope of the existing "G7 align cluster" (`canvas-shell.tsx:2171`)** — if it already aligns element multi-selections, extend it with distribute/tidy-up; if it's artboard/annotation-only, add element align (6 axes) too.
- **Gotcha**: distribute/tidy-up on flow elements is ambiguous (they're not free-positioned) — scope the operation to absolutely-positioned siblings or offer "convert to a spaced flex container" as the flow-friendly alternative (ties into the Stage-M layout editor if built).
- **Validate**: select 3 absolutely-positioned elements → Distribute → equal gaps; Tidy up → clean grid; Cmd+Z reverts.

#### Task L6: ADD deep-select + right-click "Select layer" disambiguation

- **Do**: **Deep-select** — double-click (or a modifier-click) drills one nesting level down from the clicked container into its child (Figma parity), instead of only grabbing the outer wrapper. **Select layer** — a right-click submenu listing every element stacked under the cursor (Layers-panel order, with tag/label) so the user picks the exact one. Both build on `resolveHoverTarget` + `elementFromPoint` stacking + the Layers tree.
- **Gotcha**: this directly serves the plan's *selection predictability* goal (deeply-nested TSX + overlapping elements are otherwise un-grabbable) — pair the "Select layer" list with the Stage-H scope badge so each candidate shows local-vs-shared.
- **Validate**: double-click drills into a nested child; right-click an overlap → "Select layer" lists all stacked elements → picking one selects it exactly.

#### Task L7: ADD live distance measurement + drag dimension readout

- **Do**: **Alt/Option-hover measurement** — with one element selected, holding Alt and hovering another paints a red line + horizontal/vertical pixel distances (Figma parity); reuse `equal-spacing-detector.ts` + the `use-snap-guides.tsx` overlay. **Drag readout** — while dragging/resizing (Stage D) show a live W×H / X,Y pill. Both are read-only overlays in the fixed-rAF layer, honoring `prefers-reduced-motion`.
- **Gotcha**: measurement must use world coords (post-Stage-A host-scroll-0 invariant) so numbers are correct at any zoom.
- **Validate**: select A, Alt-hover B → red line + px distances; drag/resize → live dimension pill.

#### ✅ Task L8: ADD a free-hand rotate handle on canvas elements (dogfood request 2026-07-07) — DONE (live-drag verify pending dogfood)

- **Do**: Add a **rotate handle** to the element selection overlay (a small handle offset above the top edge, or a Cmd-hover of a corner per Figma) so the user can grab and rotate an element directly on the canvas. Writes `transform: rotate(<deg>deg)` (composing with any existing `transform`) through the same optimistic `apply-style` → `edit-css` lane resize uses; snap to 15° increments while Shift is held. The resize-handle geometry (Stage D `use-element-resize.tsx`) must account for the element's current rotation when placing the 8 resize handles (rotate the handle anchor points by the element's angle) so resize stays correct on a rotated element.
- **Pattern**: `use-element-resize.tsx` (the overlay + rAF-follow + optimistic commit lane); the Stage-B `transform` knob already does rotate-via-text — this is the direct-manipulation counterpart. Read the element's current rotation from `authored.transform` / `computed.transform` (parse the `rotate()`/matrix).
- **Gotcha**: a rotated element's `getBoundingClientRect()` is the AABB, not the rotated box — the handle placement must use the element's own transform, not the AABB, or the handles drift. Verify at 50%/200% zoom + on an already-`transform`-ed element. Cmd+Z reverts.
- **Validate**: select an element → grab the rotate handle → it rotates; Shift snaps to 15°; the resize handles still sit on the (rotated) box corners; Cmd+Z reverts.

> **Open (deep-research did not confirm present or absent — quick internal check before deciding):** eyedropper / color-picker-from-canvas, gradients + blend modes (probe #8); numeric-entry-with-math like `100+20` in knob fields (probe #13); explicit z-order **commands** (bring-to-front / send-backward — the `z-index` knob is added in Stage B, but not the one-click stacking commands). These are small follow-ups if wanted; not blockers. (The dedicated rotate **handle** is now Task L8 above.)

### Stage M — Flex / auto-layout editor (sizing modes + grouped layout controls)

> Deep-research's highest-value strategic gap for a TSX/flexbox tool. **Partially present:** the CssKnobs `Layout` section already has `display`/`flex-direction`/`align-items`/`justify-content`/`gap` (`app.jsx:4900-4909`). This stage turns that into a coherent **auto-layout editor** and adds the missing piece users reason about most: **per-element sizing mode**. (CSS-Grid track editor is a **separate follow-up plan** per the 2026-07-07 decision — stub it in `.ai/plans/` but do not build here.)

#### Task M1: ADD per-element sizing mode (Fixed / Hug / Fill)

- **Do**: Add a `Fixed / Hug / Fill` control for width and (separately) height — the single biggest source of layout-behavior confusion for React/flexbox mockups (Figma auto-layout parity). Map to CSS: **Fixed** = an explicit `width`/`height` value; **Hug** = `width: auto` / `fit-content` (shrink to children); **Fill** = `width: 100%` or `flex: 1 1 0` (stretch to fill the flex parent), with optional `min-`/`max-` bounds. Surface it as a segmented toggle at the top of the `Size` section, driving the existing `width`/`height` knobs (which stay for the Fixed case).
- **Gotcha**: the correct "Fill" CSS depends on the parent's `display` (flex child → `flex: 1`; block child → `width: 100%`) — resolve from the selection's parent (available via the Layers tree / computed styles) so the emitted CSS actually behaves. Extend `KNOB_PROPS` (Stage B1) with `flex-grow`/`flex-shrink`/`flex-basis`/`align-self`/`min-width`/`min-height`/`max-height` so these round-trip.
- **Validate**: set a card to Fill inside a flex row → it stretches; Hug → it shrinks to text; Fixed → the width knob controls it; Cmd+Z reverts each.

#### Task M2: EXTEND the Layout section into a grouped auto-layout editor

- **Do**: Extend the existing `Layout` section (`app.jsx:4900-4909`) into a proper auto-layout editor: add `flex-wrap` (nowrap/wrap), promote `justify-content` to include `space-between`/`space-around`/`space-evenly` ("Auto" gap), keep `align-items`, surface per-side padding inline (it already exists in Spacing — cross-link), and gap with an "Auto" option. Present it with the auto-layout mental model (Direction · Wrap · Distribution · Gap · Padding) so a Figma/Webflow user recognizes it. Optionally add an on-canvas "add auto-layout" affordance on a container.
- **Gotcha**: only show the flex controls when `display` is `flex`/`inline-flex` (or offer a one-click "make this a flex container" that sets `display:flex`) — don't present flex knobs on a block element (the DDR-104 `gap`-degrades-gracefully precedent).
- **Validate**: on a flex container, toggle direction/wrap/distribution/gap → live reflow + persisted + Cmd+Z; the controls hide/adapt on a non-flex element.

#### Task M3: STUB the CSS-Grid track editor follow-up plan

- **Do**: Create `.ai/plans/feature-grid-track-editor.md` as a **stub** (title, one-paragraph scope, the deep-research citation `university.webflow.com/videos/grid-2-0`, and the key requirements: define columns/rows, on-canvas track drag-resize with Shift-both, per-track unit px/%/fr/em, manual cell placement + corner-span). Do **not** implement — this is the separate follow-up the user chose. Run the roadmap regen so it appears.
- **Validate**: stub file exists; `pnpm --filter @maude/site gen:roadmap` includes it.

### Stage G — Guardrails, decision record, tests, changelog

#### Task G1: RECORD the DDR (curated-tier expansion + resize/specimen/media model)

- **Do**: Via `/flow:record-ddr`, record a decision covering: (a) **supersedes DDR-104 §3's OUT-list** — `position`/inset/`transform`/`text-transform`/`text-decoration`/`font-style`/`object-fit`/`aspect-ratio` are now curated (state *why*: user feedback that box/framing/positioning are core designer edits, not power-user escapes); (b) the element + artboard resize-handle model (reuse annotation-resize geometry; element size via `edit-css`, artboard size via `edit-attr width/height` per DDR-027); (c) specimen selection as a mount/router-gap fix with the `select-set` parent-gate as the trust boundary; (d) the media-swap write concern (`edit-attr` src-replace / annotation-model href-swap) orthogonal to the photo-editor plan's `/_api/photo-edit`; (e) **general element delete/insert + new-artboard insert** as new structural ops with whole-file-snapshot undo (extending DDR-138/139's model from clips to general elements); (f) the **reusable-component predictability contract** (Option A: surface scope + local instance move/resize, *no* override/detach — record why the override/detach path was declined). Cross-reference DDR-103/104/105/019/027/054/088/138/139/050.
- **Gotcha**: DDR numbering races on shared `main` (memory `project_ddr_numbering_races_on_shared_main`) — re-check `.ai/decisions/` immediately before numbering; the tentative next number is **DDR-152** (current max is 151). This may warrant **two** DDRs (the knob/scope UX decision and the structural-edit/undo decision) if one grows unwieldy.
- **Validate**: DDR file(s) exist, index updated.

#### Task G2: ADD tests for the new surfaces

- **Do**: (a) the Stage-A camera regression (Task A3); (b) a `dom-selection` test asserting the new `KNOB_PROPS` round-trip into `authored`; (c) resize-commit tests for element (`width/height/left/top`) and artboard (`width/height` attrs) + undo records; (d) a specimen-selection test asserting a bare-specimen element produces a `select-set` with a null-artboard selector; (e) a media src-replace test (`edit-attr` on `src`); (f) `canvas-edit.ts` structural tests: `applyDeleteElement`/`applyInsertElement`/`applyInsertArtboard` round-trip, reparse-gate rejects invalid results, shared-instance delete targets the usage; (g) an edit-scope resolver test (`local` vs `shared, instanceCount N`, incl. the `.map()` caveat); (h) a spacing-drag commit test; (i) the K1 whole-file byte-compare undo sequence. Mirror `canvas-edit.test.ts` / selection-test shapes.
- **Validate**: `cd apps/studio && bun test`.

#### Task G3: RUN the security-review focus on the one new selection surface

- **Do**: Per DDR-054/DDR-105, confirm every new source-write route (`delete-element`, `insert-element`, `insert-artboard`, `delete-revert`, the optional `edit-css-batch`, and the `/_api/assets` GET) is **main-origin-only** (absent from `CANVAS_SAFE_API` + `startCanvasServer`'s allowlist), `sameOriginWrite`+loopback guarded, and pinned to `activePath` (never the iframe-supplied canvas). Confirm specimen selection (Stage E) flows through the already parent-source-gated `select-set` handler (`app.jsx:7584-7590`) and adds no canvas-origin-reachable write. Confirm the insert path can't be driven to write outside the design root (path containment on any asset `src`). Run `security-auditor` + `ethical-hacker` scoped to the diff.
- **Validate**: `/flow:validate-security` → 0 blockers at the configured `severityFloor`; add `test/canvas-origin-gate.test.ts`-style assertions (GET→405 / canvas-origin POST→rejected) for each new write route.

#### Task G4: ADD a what's-new entry (at `/flow:done` time)

- **Do**: Via the `whats-new-entry` skill, append a pending entry (`version: null`) describing: drag-to-resize (element + artboard), delete + insert element, new empty artboard from screen presets, on-canvas padding/gap drag, the new Position/Transform/Media knobs, auto-open-on-select, specimen editing, image/video/background replace, the shared-component scope badge, keyboard editing (nudge + tree traversal), duplicate/copy-style, distribute/align, deep-select, distance measurement, and the flex/auto-layout (Fixed/Hug/Fill) editor. Consider spotlight tour steps for the resize handles, the "+ Element / + Artboard" affordances, auto-open, and the Fill/Hug/Fixed control.
- **Validate**: entry present, stamped at release.

---

## Validation

Run these to confirm zero regressions:

1. **Lint**: `pnpm lint`
2. **Types**: `cd apps/studio && bun tsc --noEmit`
3. **Tests**: `pnpm test && pnpm test:dev-server`
4. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (client bundle — commit `dist/client.bundle.js` + `dist/styles.css` per CLAUDE.md's rebuild rule, since this changes `client/app.jsx` + `styles/3-shell-maude.css`), then `pnpm build` (site/packages).
5. **Cross-platform scenario** (UI): spawn `scenario-runner` — see Scenario Coverage.
6. **Design System Guard**: spawn `design-system-guard` — new knob rows + resize handles must use `.st-cp-*`/`.sel-handle` DS classes, no hardcoded colors.
7. **A11y**: spawn `a11y-auditor` — every new knob needs keyboard reach + `aria-label`; resize handles need keyboard-resize (arrow-key nudge) + focus; the auto-open must not trap focus.
8. **Manual**:
   - Bug A: drag an absolute element far out of its artboard → camera stays put.
   - Bug B: select an overflowing element via the Layers panel → no layout shift, no right strip.
   - Resize an element (corner + edge, Shift aspect-lock, Alt from-center) → correct box, Cmd+Z reverts; free-hand resize an **artboard**.
   - Auto-open: ⌘-click with panel closed → CSS tab opens; with panel open on Layers → no override.
   - Specimen: select + edit an element in a `system/<ds>/preview/*.tsx`.
   - Media: replace an authored `<img>`, an `ImageStroke`, a **background image**, set `object-fit: cover`.
   - Structural: **delete** an element (Del key + menu) → Cmd+Z restores; **insert** a Div/Text/Image; **+ Artboard → Mobile** adds an empty 390×844 frame, then insert elements into it.
   - Spacing: drag a **padding** edge and a **gap** on-canvas → live + persisted + Cmd+Z.
   - Scope: select an inner element of a component used in 3 artboards → header shows "Shared · edits 3 places"; absolutely position **one instance** → the others don't move.
   - Ergonomics (Stage L): element arrow-nudge (1/10px); keyboard traversal (Enter/Shift+Enter/Tab/Esc); Cmd+D + Alt-drag duplicate; copy-style→paste-style onto another element; distribute 3 elements; deep-select (double-click) + right-click "Select layer"; Alt-hover distance readout.
   - Flex (Stage M): set a card to Fill/Hug/Fixed inside a flex row → correct reflow; toggle direction/wrap/distribution on the container.
   - Undo sequence (INV-1): resize → delete → insert → move-instance → spacing-drag → Cmd+Z ×5 → canvas byte-identical to start.
   - No-flicker (INV-2): screen-record the above — no blink; `prefers-reduced-motion` collapses animations.
   - Desktop parity: dogfood the bundled `.app` (not `tauri dev`) — the WebKit `writeTransform` branch (`canvas-lib.tsx:805-806`) means the camera-aware reveal (Task A1) must be verified in WKWebView, not just Chromium (mind the filter-GPU ceiling, K2).

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `app-boots-and-renders-canvas` | Baseline boot + canvas render + existing selection | ✅ existing (must still pass) |

**New scenarios to create:**

- `element-editing-resize-and-position` — flow: open a UI canvas → ⌘-click an element (panel auto-opens on CSS) → drag a corner handle to resize (Shift-lock) → nudge `top/left` via the Position inset → drag a padding edge on-canvas → Cmd+Z through each → drag an absolute element far out and confirm the camera doesn't jump. Persona: designer refining a mockup. Fixtures: a canvas with one flow element and one absolutely-positioned element that overflows its artboard.
- `specimen-and-media-editing` — flow: open a DS specimen (`system/<ds>/preview/*.tsx`) → ⌘-click an element → edit a knob → confirm the specimen source updated; then on a UI canvas, right-click an `<img>` → "Replace image…" → pick an asset → set `object-fit: cover`. Persona: designer maintaining the DS + swapping hero imagery. Fixtures: one specimen with editable elements, one canvas with an authored `<img>`.
- `structural-and-scope` — flow: **+ Artboard → Mobile** → empty 390×844 frame appears → **+ Element → Div** into it → style it → **delete** it → Cmd+Z restores → free-hand resize the artboard → then select an inner element of a component used in 3 artboards, confirm the "Shared · edits 3 places" badge, absolutely position **one** `<Card/>` instance and confirm the other two don't move. Persona: designer starting a new screen from scratch + working with reusable components. Fixtures: an empty-ish canvas + a canvas with a `Card` reused across 3 artboards. This is the scenario that proves the **predictability** contract.

`/flow:done` runs `scenario-runner` across 5 platforms. This is a `web-desktop`-only project (`.ai/workflows.config.json` `platforms`) — the other 4 report `skipped`, not `blocked`; confirm parity treats that correctly.

---

## Acceptance Criteria

- [ ] All tasks completed (Stages A–M + G)
- [ ] **Editor ergonomics parity** (Stage L): element keyboard-nudge (1/10px), keyboard tree traversal (parent/child/sibling + Esc), Cmd+D duplicate + Alt-drag-dup + paste-in-place, copy-style/paste-style (Cmd+Opt+C/V), distribute/equal-spacing/tidy-up, deep-select + right-click "Select layer", Alt-hover distance measurement + drag readout — all Cmd+Z reversible; the already-present ones (marquee, command palette, inline text edit) verified not regressed
- [ ] **Flex/auto-layout editor** (Stage M): per-element Fixed/Hug/Fill sizing + grouped direction/wrap/distribution/gap/padding editor, gated by `display`; CSS-Grid track editor stubbed as a separate follow-up plan (`feature-grid-track-editor.md`), not built here
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] Bug A (absolute-move pan jump) and Bug B (overflow-select shift + right strip) are **gone**, verified through the `select-by-id` channel specifically
- [ ] On-canvas resize works with Figma-grammar (corner+edge handles, Shift aspect-lock, Alt from-center), constant handle size at any zoom, single coherent commit + Cmd+Z — for **elements and artboards** (artboard size via `edit-attr width/height`, DDR-027)
- [ ] `position` (+ `top/right/bottom/left` inset), `transform`, `font-style`, `text-transform`/`text-decoration`, and media `object-fit`/`aspect-ratio`/`object-position` are curated knobs with live preview + provenance + undo
- [ ] Selecting an element auto-opens the Inspector on the CSS tab **only** when no right panel is already open; preference-backed (default on)
- [ ] Element selection + inspect + resize + edit works on DS specimens (`system/<ds>/preview/*.tsx`)
- [ ] Image/video/background swap works for authored `<img>`/`<video>` (via `edit-attr`/`edit-css`) and annotation `ImageStroke`/`MediaRefStroke` (via the annotation model), through the asset picker
- [ ] **Delete** an element (Del key + context menu + toolbar) and **insert** a new Div/Text/Image work in-artboard, both Cmd+Z reversible via whole-file snapshot
- [ ] **Insert a new empty artboard** from a screen-size preset (Desktop/Laptop/Tablet/Mobile/Custom); it's clean, selectable, resizable, and accepts inserted elements
- [ ] **On-canvas padding + gap drag** works with live preview + undo, gated correctly by `display`
- [ ] **Undo/redo covers every edit op** (INV-1): the K1 byte-compare sequence returns the canvas to its exact start; the `.ai/logs/rca/issue-undo-redo-coverage-gaps.md` element-delete/insert gap is closed, no new gaps
- [ ] **No hard flicker** on any edit (INV-2): CSS-shaped ops skip the redundant reload; structural ops soft-reload with no white flash; new affordances animate with DS motion tokens + honor `prefers-reduced-motion`; the WebKit filter-GPU ceiling is documented, not chased
- [ ] **Reusable-component predictability** (INV-3, Option A): every selection shows Local vs Shared·N-places; moving/resizing a component **instance** stays local; inner-shared-element styling is global-and-labeled; **no** override/detach primitive was added
- [ ] `/flow:validate` passes overall:
  - [ ] Static (types, lint, format)
  - [ ] Tests (full suite + the new Stage-G tests, incl. structural delete/insert/artboard, edit-scope, spacing, undo sequence)
  - [ ] Build (client bundle rebuilt `--release` + committed; site/packages)
  - [ ] `scenario-runner`: 0 blockers, parity OK on `web-desktop` (others `skipped`)
  - [ ] `design-system-guard`: 0 blockers
  - [ ] `a11y-auditor`: 0 blockers (new knobs + keyboard-resize + keyboard-delete + auto-open focus)
- [ ] `/flow:validate-security`: 0 blockers — every new write route (`delete-element`/`insert-element`/`insert-artboard`/`delete-revert`/`edit-css-batch`?/`assets` GET) is main-origin-only + `sameOriginWrite`+loopback guarded + `activePath`-pinned + origin-gate-tested; specimen selection adds no canvas-origin write
- [ ] The DDR(s) (Task G1) are recorded, superseding DDR-104 §3's OUT-list, extending DDR-138/139 to general delete/insert, and recording the declined override/detach path; cross-referencing DDR-103/105/019/027/054/088/050
- [ ] Media-swap/framing stays orthogonal to `feature-photo-editor.md` (box/source via `edit-css`/`edit-attr`, not `/_api/photo-edit`); Inspector insertion points coordinated
- [ ] Code follows project conventions, no regressions; the stale "display-only" banner (`app.jsx:5251-5255`) is corrected while in the file
