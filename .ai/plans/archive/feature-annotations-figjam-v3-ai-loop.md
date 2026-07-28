# Feature: Annotations FigJam-parity v3 + bidirectional AI loop

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This phase again touches the most load-bearing dev-server file (`apps/studio/annotations-layer.tsx`, ~3500 lines) — read the Hard Invariants and the Regression Inventory below BEFORE writing a single line.** The standing rule applies: inventory + per-feature plan first, verify every feature, **100 % no regressions** (memory `feedback_no_break_exhaustive_verify`).

## Description

Third FigJam-parity wave on the canvas annotation system. Phase 21 shipped the vocabulary (sticky/text/shapes/arrows), Phase 24 shipped the chrome polish (single shape tool, arrowheads, ghost preview, cursors), the tooling-polish batch shipped text unification + highlighter. What's still missing is the **manipulation layer** that makes annotating feel like FigJam — grouping, duplicate, copy/paste, z-order, align/distribute, snapping, connector binding — plus **first-use discoverability**, and the **AI loop**: annotations must be machine-readable with artboard context (read), and AI agents must be able to CREATE annotations — stickies, labeled flow diagrams, user-flow maps — through a typed write surface (write). "Bude to nástroj tam a zpátky."

Grounded in researched, verified semantics from FigJam help docs + tldraw/Excalidraw source (see **Research digest** below — the executor should not need the web).

## User Story

As a designer brainstorming on a canvas, I want annotations to behave exactly like FigJam — group things, duplicate them, snap them, connect them with arrows that stay attached — so that marking up, diagramming, and note-taking feels joyful and natural. As an AI agent (`/design:*` commands, skills), I want to read every annotation with its position, target, and artboard context, and to write new annotations (stickies, flow diagrams) programmatically, so the canvas becomes a true two-way communication medium between the user and AI.

## Problem

Verified against the current source (2026-06-10) — note several things the team believed missing actually exist:

**Already shipped (do NOT re-implement; regression-protect instead):**
- Marquee drag-select on empty world — bbox **intersection** semantics, shift-additive, click-to-deselect (`annotations-layer.tsx:2705-2920`)
- Multi-select via shift-click toggle + hull group-drag of a multi-selection (FigJam parity fix F6), one undo record per gesture
- Bulk delete, bulk color via context toolbar; Edit-menu "Select all annotations"; Cmd+Z/Cmd+Shift+Z undo
- Ghost placement preview (shape/sticky/text), single Shape tool, full arrowhead set, rich text formatting

**Genuinely missing (confirmed by grep — zero hits):**
1. **Grouping** — no group concept anywhere (`groupIds`/`data-group` absent). Users can't keep a cluster of stickies together.
2. **Duplicate** — no Cmd+D, no Alt+drag-duplicate.
3. **Copy/paste of strokes** — paste pipeline handles only media intake (images/URLs); selected strokes can't be copied.
4. **Z-order commands** — render order = array order, but no bring-to-front/send-back UI or shortcuts.
5. **Alignment/distribution** — nothing; no FigJam "Tidy up".
6. **Snapping/smart guides** — free positioning only.
7. **Connector binding** — arrows are freeform lines; they don't attach to shapes/stickies and don't follow them. Without this, AI can't read arrows as graph edges.
8. **Marquee over artboards** — pointerdown inside an artboard routes to artboard-drag/element-marquee (G5 decision), so annotations sitting ON an artboard can't be rubber-band selected.
9. **Quick-create chain** — no Cmd+Enter sibling spawn; sticky doesn't open its editor immediately on placement.
10. **First-use discoverability** — no shortcut-labeled tooltips audit, no one-time hints; the manipulation gestures are invisible.
11. **AI surface is read-only and shallow** — `read-annotations.mjs` emits flat strokes + artboard overlap tag, but no groups, no arrow endpoints→graph edges, no artboard-relative coords, no provenance. There is **no write path at all** for AI.

## Solution

Five waves, each independently shippable and verifiable. Data-model choices follow proven open-source patterns (Excalidraw flat `groupIds` tag-array, Excalidraw-style embedded arrow bindings with normalized anchors, FigJam intersection marquee — rationale in Design Decisions). Every new serialized field follows the established **"serialize only for non-default values"** rule so the byte-identical legacy round-trip canary stays green. AI write goes through a new `maude design annotate` CLI verb (DDR-062 pattern) that accepts a skeleton ops JSON, renders through the SAME serializer + sanitizer, and pushes through the live server so open canvases update in real time via the existing collab bridge.

## Metadata

- **Ticket**: n/a (internal feature plan)
- **Type**: Enhancement + New Capability
- **Complexity**: **High** — single giant file, schema extension with back-compat invariant, new CLI verb, cross-cutting AI surface
- **App/Package**: `apps/studio` (canvas client + bin helpers), `cli/` (verb dispatch), `plugins/design` (agent-facing docs)
- **Affected Systems**: annotation schema + serializer + sanitizer, selection/drag/marquee, context toolbar, input-router, undo, read-annotations, CLI verb table, plugin docs
- **Dependencies**: none new (zero-dep dev-server invariant holds; FigJam patterns implemented natively, NOT via tldraw/excalidraw deps)

---

## Hard invariants (DO NOT BREAK — carried from Phase 24 + DDRs)

1. **Byte-identical legacy round-trip.** New attributes (`data-group-ids`, `data-start-bind`, `data-end-bind`, `data-author`) serialize **only** for non-default values. Canaries: `test/annotations-roundtrip.test.ts` + `test/fixtures/phase-20-annotations.svg` (+ Phase-24 fixture) must stay green. Add a NEW fixture exercising groups + bindings.
2. **Sanitizer is allowlist-based** (`sanitizeAnnotationSvg`, `api.ts`). Every new `data-*` attribute MUST be added to the allowlist + covered in `test/sanitize-annotation-svg.test.ts`. No new element types — groups/bindings are attributes on existing elements.
3. **One user gesture = ONE undo record** via `commitStrokes(before, after, label)` / `createAnnotationStrokesCommand`. Bulk ops (group, align, z-order, duplicate, AI batch) are single records. **AI/remote writes never enter the local undo stack** (they arrive via Yjs, not via commitStrokes — verify, don't assume).
4. **tsc DDR-026 baseline** — only the known `api.ts` ×2 + `runtime-bundle.ts` errors. Zero NEW tsc errors.
5. **Bundles**: rebuild + commit `dist/client.bundle.js` + `dist/comment-mount.js` + `dist/styles.css` **release-minified** (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`). NEVER touch `dist/runtime/*.js`.
6. **1 MB annotations cap** (`MAX_ANNOTATIONS_BYTES`) — the AI write verb must enforce it client-side with a clear error before writing.
7. **No new canvas-origin HTTP routes.** AI write reuses `PUT /_api/annotations` (already dual-registered per DDR-088) from the CLI, or writes the file directly when no server is running. Privileged logic stays in the CLI verb (DDR-054/062).
8. **OOPIF constraint**: agent-browser cannot drive the cross-origin canvas iframe — in-canvas interactive verification is unit-test + code-verified + the **user's interactive gate** (established repo practice, see Phase 24 R1–R20 + STATE A1-S3).
9. **World-coords stay authoritative.** Artboard-relative coords in the AI read surface are DERIVED (computed at read time from `--canvas-state` layout), never stored.
10. Comment style: match the file's `@file/@scope/@purpose` headers + existing density. UI strings stay English.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one message, multiple Read calls). Line numbers are approximate (file moves under edits) — the named anchors are stable.

- `apps/studio/annotations-layer.tsx` — the core. Regions: Stroke type union (~`:85-280`, search `PenStroke`); palettes + `DEFAULT_COLOR`; `strokeToSvgEl` serialize (search `serialize ONLY for non-default`); `svgToStrokes` parse; `strokeBBox`; `translateOne`; `useStrokesStore` / `StrokesStoreValue` (search `translateStrokes`); marquee + hull group-drag effect (`:2700-2920`, search `Drag-select marquee state`); `commitStrokes`.
- `apps/studio/use-annotation-selection.tsx` — selection provider (`replace/add/toggle/clear/contains`, 56 lines). Group expansion logic hooks in here or right above it.
- `apps/studio/use-annotation-resize.tsx` — `resizeStroke(stroke, corner, x, y, {shift, alt})` pure math; binding recompute must hook the same commit path.
- `apps/studio/annotations-context-toolbar.tsx` — capability gating pattern (search `caps.`), where Group/Ungroup + Align cluster land.
- `apps/studio/input-router.tsx` — keyboard dispatch (`RouterAction`), tool shortcuts, undo/redo hotkeys; where Cmd+G/Cmd+D/z-order keys get routed. Note line ~37 comment enumerating gesture owners.
- `apps/studio/commands/annotation-strokes-command.ts` — undo command builder (before/after snapshots).
- `apps/studio/undo-stack.ts` + `use-undo-stack.tsx` — `window.top.__maude_undo_stacks` stash pattern (reuse for the strokes clipboard).
- `apps/studio/api.ts` — `sanitizeAnnotationSvg` allowlist + `ANNOTATION_SVG_ELEMENTS` + `loadAnnotations/saveAnnotations` + `onAnnotationsChanged` hook.
- `apps/studio/sync/codec.ts` — `applyAnnotationsToDoc/annotationsFromDoc` (LWW, `MAX_ANNOTATIONS_BYTES`).
- `apps/studio/collab/registry.ts` — `syncRoomFromAnnotations` (how a server-side PUT reaches live canvases).
- `apps/studio/bin/read-annotations.mjs` — the AI read surface (regex parser, `--canvas-state` artboard tagging).
- `apps/studio/bin/draw-build.sh` + `apps/studio/draw/layout.ts` — `diagram()` auto-layout to reuse for AI flow maps.
- `cli/commands/design.mjs` + `cli/lib/plugin-cli-reachability.test.mjs` — verb dispatch table + whitelist for the new `annotate` verb.
- `plugins/design/commands/new.md` (ingest mode section) + `plugins/design/skills/design/SKILL.md` — where agent-facing annotation docs live today.
- `.ai/plans/archive/phase-24-annotations-figjam-parity-v2.md` — invariants + regression-inventory format to mirror.
- `.ai/archive/decisions/DDR-067` (parity v2 scope), `DDR-029` (overlay portal), `DDR-050` (undo command stack), `DDR-054`/`DDR-063` (canvas-origin trust), `DDR-088` (route dual-registration), `DDR-085` (ingest mode), `DDR-062` (CLI verb dispatch).

### Files to Create

- `apps/studio/annotations-groups.ts` — pure group helpers: `expandSelectionToGroups`, `groupStrokes`, `ungroupStrokes`, contiguity reorder, singleton/empty dissolve. (Keep the giant file from growing; pure = trivially testable.)
- `apps/studio/annotations-align.ts` — pure align/distribute/tidy math over bboxes.
- `apps/studio/annotations-bindings.ts` — pure binding helpers: `bindCandidate(point, strokes, threshold)`, `anchorToPoint(host, nx, ny)`, `recomputeBoundArrows(strokes, changedIds)`, `unbindOnDelete`.
- `apps/studio/annotations-snap.ts` — pure `computeSnap(movingBBox, candidates, threshold)` → `{dx, dy, guides[]}`.
- `apps/studio/bin/annotate.mjs` (+ `.sh` wrapper if the verb table requires one) — AI write verb.
- `apps/studio/test/annotations-groups.test.ts`, `annotations-align.test.ts`, `annotations-bindings.test.ts`, `annotations-snap.test.ts`, `annotate-write.test.ts`, fixture `test/fixtures/figjam-v3-groups-bindings.svg`.
- `plugins/design/skills/design/` doc section (or new reference file) — "Annotations as an AI surface" agent contract.

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio.tsx` — artboard **C · annotate & draw** | shipped reference | maude DS | The approved look for draw tools, selected stroke + context toolbar. New ctx-toolbar clusters (Group, Align) must match this chrome language (`.dc-annot-ctx`, HUD_TOKENS). |
| `.design/ui/Canvas Viewport.tsx` — **CV-03 DRAW MODE** | shipped reference | project DS | "Hand-drawn red annotations IS the signature moment" — manipulation chrome must stay subordinate to the strokes themselves. |

### Research digest (verified semantics — implement from here, no web needed)

- **Marquee**: FigJam = **intersection** ("any object the box touches"). Ours already is — keep. tldraw extras we adopt: Shift preserves pre-existing selection (have it), brush resolves hits to the **outermost group** (new with Task 1).
- **Group**: Cmd+G / Cmd+Shift+G. Click selects outermost group; **double-click a member to select just it** (one-level focus; Esc returns to group). Empty group dissolves; single-child group auto-ungroups; group bbox = union of members. Excalidraw model: every element carries `groupIds: GroupId[]`, **ordered deepest→shallowest**; selection expands via shared outermost id.
- **Duplicate**: Cmd+D with +16/+16 offset; **Alt/Option+drag** duplicates in place and drags the copy. Works on multi-selections; group membership remaps to fresh group ids.
- **Z-order**: `]` front, `[` back, `Cmd+]` forward one, `Cmd+[` backward one. Group members move contiguously.
- **Align/Tidy**: 6 align ops (L/HC/R/T/VC/B) on ≥2 selection; distribute on ≥3; FigJam "Tidy up" = uniform grid both axes (stretch goal).
- **Snapping**: candidates = edges + centers of nearby strokes AND artboard rects; red/accent guide lines; **hold Cmd to suppress**. Threshold ~6 px / zoom.
- **Connector binding** (Excalidraw semantics): bind on proximity ~15 px at 100 % zoom (scale by zoom); endpoint stores `{ hostId, nx, ny }` normalized [0..1] over host bbox; host move/resize → endpoint recomputes from normalized anchor; drag endpoint to re-anchor; **Cmd while dragging endpoint suppresses snap**; deleting host → unbind, endpoint frozen in place (arrow survives).
- **Quick create**: with sticky/shape selected, **Cmd+Enter** spawns a sibling to the right **with its text editor active**; sticky placement opens the editor immediately ("start typing right away").
- **First use**: no modal tour. Shortcut-labeled tooltips on every tool; one-time contextual micro-hints triggered by behavior; cursor ghost previews are themselves the onboarding.
- **AI loop** (tldraw/Excalidraw/FigJam-MCP consensus): dual-channel context (screenshot + simplified JSON with small ids); writes via a **typed op vocabulary** (`create/update/delete` + group), never raw mutation; skeleton input format with bind-by-id and `label:` auto-text; AI output tagged with provenance, non-destructive, NOT in the user's local undo stack; Mermaid-style node/edge input → engine-side auto-layout.

---

## Design Decisions

### Data model (the load-bearing choices)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Group model | **Excalidraw-style flat `groupIds: string[]` per stroke** (serialized `data-group-ids="g1 g2"`, deepest→shallowest), NOT a group parent node | Flat = survives the whole-SVG LWW sync with zero reparenting transactions; trivially serializable into existing elements (sanitizer-friendly); AI-legible. tldraw's lifecycle niceties (empty→delete, singleton→dissolve) are copied as pure helpers. Model nest-capable; v1 UI creates one level. |
| Group ids | `rid()`-style `g<base36>` minted client-side, persisted in the SVG | Stroke ids already persist via `data-id`; same scheme. |
| Connector binding | **Embedded on the arrow**: `data-start-bind="<hostId> <nx> <ny>"` / `data-end-bind=…`, normalized anchor over host bbox. No reverse index on hosts | Reverse index (Excalidraw `boundElements`) is an optimization for huge docs; our per-canvas stroke counts are small — a linear scan in `recomputeBoundArrows` is fine and keeps the schema single-sided (one attribute, one owner). Anchors snap to side/center magnets {0, .5, 1} at bind time (FigJam feel). |
| Z-order | **Array order stays the z model** (no fractional index) | Whole-SVG LWW means no concurrent per-element reordering to reconcile; fractional indexing solves a problem we don't have. Group contiguity enforced on group create + reorder ops. |
| Strokes clipboard | **In-memory `window.top.__maude_strokes_clipboard`** (mirrors `__maude_undo_stacks`), NOT the OS clipboard | Custom-MIME OS clipboard is Chromium-gated and pollutes text/plain. Cross-canvas paste within the session works via window.top; OS-level interop deferred. |
| AI write surface | **CLI verb `maude design annotate`** consuming skeleton ops JSON; pushes via `PUT /_api/annotations` to a live server (collab bridge broadcasts), falls back to direct file write + sanitize | DDR-054/062: privileged/agent logic lives in the CLI, not new HTTP routes; reusing the PUT path means live canvases update with zero new transport. |
| AI provenance | `data-author="ai"` attribute (serialize only when set) | Minimal, honest, filterable later. Visual "provisional" treatment deferred — recorded as follow-up, not scope. |
| Artboard anchoring (read) | Derived at read time: stroke world bbox vs `--canvas-state` artboard layout → `artboard` + `rel: {x,y}` + W3C-style `target` block | World coords stay authoritative (invariant 9); derivation is what survives artboard moves. |

### Components / chrome (from the shipped canvases — no new DS components)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Context toolbar clusters | `annotations-context-toolbar.tsx` (`.dc-annot-ctx`, `caps` gating) | Add Group/Ungroup buttons + Align dropdown cluster following the existing arrowhead-dropdown pattern |
| Icons | `apps/studio/canvas-icons.tsx` | New: group, ungroup, align ×6, distribute ×2, bring-front/send-back. Same stroke style as existing set. |
| Guide lines / marquee chrome | `.dc-annot-marquee` CSS pattern | Snap guides reuse the same overlay layer + accent color token |
| Hints / tooltips | studio shell `.st-*` toast + existing tour conventions (Plan B) | One-time hint chips keyed in localStorage (`maude-annot-hints-v1`), follow `.st-toast` styling |

---

## Tasks

Execute in wave order. Waves are independently shippable; tasks within a wave are dependency-ordered. **After each task: run the targeted bun tests + the round-trip canaries.**

### Wave A — manipulation core

#### Task 1: ADD grouping (model + gestures + chrome)

- **Do**: Add optional `groupIds?: string[]` to every Stroke variant (one field on a shared base if practical). Serialize as `data-group-ids` (space-joined, only when non-empty); parse back. Create `annotations-groups.ts` pure helpers: `outermostGroupOf(stroke)`, `expandIdsToGroups(ids, strokes)` (selection expansion), `groupStrokes(strokes, ids)` (mint id, append to members' arrays, reorder members contiguous preserving relative order), `ungroupStrokes(strokes, ids)` (strip outermost shared id), `normalizeGroups(strokes)` (dissolve empty/singleton). Wire: click/marquee hit → expand to outermost group (in the `onDown` `findStrokeId` branch + marquee `hits` collection); **double-click a member selects just that stroke**, Esc re-selects the group; Cmd+G / Cmd+Shift+G via input-router → ctx-toolbar mutations; Group/Ungroup buttons in ctx toolbar (visible when ≥2 selected / selection is a group); Edit menu entries. Sanitizer: allowlist `data-group-ids`.
- **Pattern**: `caps` gating in `annotations-context-toolbar.tsx`; serialize-only-non-default in `strokeToSvgEl`; `commitStrokes(before, after, 'group 5 strokes')` single record.
- **Gotcha**: group expansion must apply in BOTH the click branch and the hull hit-test + marquee paths; awareness halo (`use-collab.tsx` annotationSelection) just works since it's id-based. Round-trip canary: legacy strokes have no `groupIds` → must serialize byte-identical.
- **Validate**: `cd apps/studio && bun test annotations-groups annotations-roundtrip sanitize-annotation-svg`

#### Task 2: ADD duplicate — Cmd+D + Alt+drag

- **Do**: `duplicateStrokes(strokes, ids)` helper: deep-clone with fresh `rid()` ids, remap internal references (`anchorId`, `groupIds` → fresh group ids per duplicated group, bindings between co-duplicated strokes → remapped, bindings to non-duplicated hosts → kept). Cmd+D = duplicate selection with +16/+16 offset, select the copies. Alt+pointerdown on stroke/hull → clone first, then run the EXISTING group-drag on the clones.
- **Pattern**: the group-drag snapshot branch (`annotations-layer.tsx:2780+`) — Alt just swaps which strokes the drag moves.
- **Gotcha**: Alt is also the resize-from-center modifier — collision is impossible (resize starts on handles, duplicate-drag starts on stroke body), but assert in tests. One undo record covering clone+move.
- **Validate**: `bun test annotations-groups` (duplicate cases live there) + canaries

#### Task 3: ADD copy/paste of strokes (session clipboard)

- **Do**: On Cmd+C with non-empty annotation selection: stash `{ strokes: deepClone(selected), copiedAt }` into `window.top.__maude_strokes_clipboard` (and still let the event propagate for OS text copy when an editor is focused — guard on no active editor). Cmd+V: if the stash exists and clipboard paste isn't claiming media intake, paste with remapped ids (reuse Task 2 helper) at +16/+16 (or centered at cursor world pos if available), select pasted. Cmd+X = copy + delete.
- **Pattern**: `window.top.__maude_undo_stacks` stash (undo-stack.ts); media-intake paste pipeline ordering (`annotations-layer.tsx:2258+` — strokes paste must NOT shadow image/URL paste; check stash claim AFTER media intake declines).
- **Gotcha**: editors (sticky/text) own Cmd+C/V while focused — bail when `document.activeElement` is inside `.dc-annot-editor`/inputs.
- **Validate**: `bun test annotations-groups input-router` + manual checklist row

#### Task 4: ADD z-order commands

- **Do**: Store ops `bringToFront/sendToBack/bringForward/sendBackward(ids)` — array reorders keeping group members contiguous (treat each top-level group as one unit). Shortcuts `]`, `[`, `Cmd+]`, `Cmd+[` via input-router (only when annotation selection non-empty and no editor focused); context-menu entries in the existing right-click menu (`.dc-context-menu`).
- **Pattern**: `translateStrokes` store-method shape; input-router `RouterAction` dispatch.
- **Gotcha**: `[`/`]` are bare keys — must not fire while typing in editors (same guard as tool hotkeys). One undo record.
- **Validate**: `bun test annotations-groups` (z-order cases) + canaries

#### Task 5: ADD align / distribute (+ tidy-up stretch)

- **Do**: `annotations-align.ts`: `alignStrokes(strokes, ids, 'left'|'h-center'|'right'|'top'|'v-center'|'bottom')`, `distributeStrokes(strokes, ids, 'h'|'v')` over `strokeBBox` unions (groups move as one unit — align the group bbox, translate members). Ctx-toolbar Align cluster (dropdown, visible when ≥2 selected; distribute entries enabled at ≥3). Stretch: `tidyUp(strokes, ids)` uniform grid (rows×cols by current spatial order) — implement only if the wave is on schedule.
- **Pattern**: arrowhead dropdown in ctx toolbar; pure-math + table-driven tests like `use-annotation-resize`.
- **Gotcha**: aligning bound arrows directly is a no-op (they follow hosts via Task 7 recompute — when both land, run recompute after align).
- **Validate**: `bun test annotations-align`

#### Task 6: UPDATE marquee — Shift+drag works over artboards

- **Do**: In the `onDown` empty-world branch, the early return for `[data-dc-screen]` targets currently kills marquee over artboards. Change: when `e.shiftKey` is held, a drag starting over an artboard starts the **annotation marquee** (additive) instead of returning. Bare drag over artboard keeps current behavior (artboard-drag / element-marquee — G5 stands).
- **Pattern**: existing `addToSelection = e.shiftKey` branch right below.
- **Gotcha**: input-router comment at `:182` says Shift-marquee is referenced for element selection — verify no conflict with element-marquee's shift semantics; annotation layer's capture-phase listener wins by design (document order), assert with `input-router.test.ts` cases.
- **Validate**: `bun test input-router` + manual checklist row

### Wave B — connectors + snapping

#### Task 7: ADD connector binding (arrows attach + follow + re-anchor)

- **Do**: Extend `ArrowStroke` with `startBind?: { hostId: string; nx: number; ny: number }` + `endBind?`. `annotations-bindings.ts`: `bindCandidate(worldPt, strokes, threshold)` (bindable hosts = rect/ellipse/polygon/sticky/image; threshold 15/zoom px; snap nx/ny to nearest magnet {0,.5,1}×{0,.5,1} excluding center-center unless interior hit), `anchorToPoint(hostBBox, nx, ny)`, `recomputeBoundArrows(strokes, changedIds)` (pure; returns new array with arrow endpoints re-derived), `unbindForDeleted(strokes, deletedIds)` (strip binds, freeze endpoints — arrow survives). Wire: bind on arrow draw-end + on endpoint-handle drag-end (endpoint handles exist via resize overlay — verify; if arrows lack endpoint handles, add the two-endpoint drag affordance here); Cmd held = suppress binding; run `recomputeBoundArrows` after every translate/resize/align commit (centralize in the store commit path, NOT in each call site); visual feedback = accent halo on hover-candidate host while dragging an endpoint. Serialize `data-start-bind`/`data-end-bind` (non-default only) + sanitizer allowlist + parse.
- **Pattern**: `resizeStroke` pure-math + overlay split; Excalidraw semantics from the Research digest.
- **Gotcha**: recompute must run on the POST-translate array inside the drag's `onMove` (so arrows track live, not just on commit) — same snapshot-based approach: derive from `st.snapshot`. Arrows in the moved set are translated normally (both ends move); only NON-moved bound arrows recompute. Beware anchored-text inheritance (text with `anchorId` follows host already — bindings are a separate mechanism, don't conflate).
- **Validate**: `bun test annotations-bindings annotations-roundtrip sanitize-annotation-svg`

#### Task 8: ADD snapping + smart guides

- **Do**: `annotations-snap.ts`: `computeSnap(movingBBox, candidates, threshold)` → `{ dx, dy, guides: Array<{axis, at, from, to}> }`; candidates = bboxes of non-moved strokes + artboard rects (from the same layout the marquee G5 check reads); snap edges+centers both axes independently; threshold 6/zoom px. Hook into the group-drag `onMove`: apply snap delta to the cursor delta; render guides in the marquee overlay layer (accent 1px lines); **Cmd held disables**. Also apply to single-stroke resize (edge snapping) if cheap — else record as follow-up.
- **Pattern**: marquee overlay rendering + `screenToWorld` usage in the same effect.
- **Gotcha**: equal-spacing layer for DOM elements exists (`.dc-cv-eq-spacing-layer`) — annotation guides are a separate overlay; don't entangle. Perf: candidate bboxes computed once at drag start, not per move.
- **Validate**: `bun test annotations-snap`

### Wave C — creation joy + first use

#### Task 9: ADD quick-create chain + sticky auto-edit

- **Do**: (a) Sticky placement opens its editor immediately (cursor in body, FigJam "start typing right away") — verify current behavior first; fix if it requires a second click. (b) Cmd+Enter with exactly one sticky/shape selected: spawn a sibling of the same type/size/style at `x + w + 24`, select it, open its editor; for shapes ALSO auto-create a bound connector from source to new shape (FigJam quick-create semantics, depends on Task 7).
- **Pattern**: sticky creation flow in the draw-start region; `StickyEditor` mount conditions.
- **Gotcha**: Cmd+Enter is claimed by nothing today in the canvas (verify input-router); editor-focused Cmd+Enter should COMMIT-and-chain (FigJam does this — commit current text, spawn next).
- **Validate**: `bun test input-router` + manual checklist rows

#### Task 10: ADD first-use discoverability

- **Do**: (a) Audit `tool-palette.tsx` tooltips — every tool shows name + shortcut (e.g. "Sticky — S"); add missing. (b) One-time contextual hint chips (`.st-toast`-styled, dismissable, localStorage `maude-annot-hints-v1` bitmap): on first multi-select → "⌘G to group · drag the box to move everything"; on first arrow draw near a shape → "Arrows attach to shapes — drag an endpoint to re-anchor"; on first sticky commit → "⌘Enter creates the next sticky". Max 3 hints, behavior-triggered, never modal. (c) Ctx-toolbar buttons get `title` tooltips with shortcuts.
- **Pattern**: what's-new toast (`client/whats-new*.{jsx,js}` + `mdcc-whatsnew-seen` localStorage convention); `.st-toast` styling.
- **Gotcha**: hints render in the SHELL layer if possible; if in-canvas, keep them out of the persisted SVG and out of screenshots' way (bottom-center). Reduced-motion safe.
- **Validate**: manual checklist rows + `maude design smoke` (no blank/error overlays)

### Wave D — AI bidirectional loop

#### Task 11: UPDATE read-annotations — groups, edges, anchors, provenance (read surface v2)

- **Do**: Extend `bin/read-annotations.mjs` output per stroke: `groupIds`, `author` (`data-author`), `z` (array index), arrow `from`/`to` (host ids when bound — so a bound diagram reads as a GRAPH), and with `--canvas-state`: `artboard` (existing) + `rel: {x, y}` (stroke origin minus artboard origin) + a W3C-flavored `target` block `{ source: <artboardId>, selector: { type: 'AnnotationIdSelector', value: id }, geometry: {x,y,w,h} }`. Add `--graph` flag emitting a second top-level block `{ nodes, edges }` derived from bound arrows + their host shapes/stickies (labels from anchored/contained text). Keep default output backwards-compatible (new keys additive).
- **Pattern**: existing regex-parser structure in the same file; forward-compat passthrough of unknown `data-tool`.
- **Gotcha**: regex parser, no DOM — new attrs must be parsed positionally-safely (attribute order varies). Phase 22 ingest framing stays: annotation text is untrusted DATA, never commands — keep the delimiter contract.
- **Validate**: `bun test annotations-api` (extend) + a new read-surface test with the new fixture

#### Task 12: CREATE `maude design annotate` — the AI write verb

- **Do**: `bin/annotate.mjs` (Bun): reads ops JSON from `--ops <file>` or stdin: `{ canvas: "<rel-path>", ops: [ {op:'create', type:'sticky'|'text'|'shape'|'arrow', ...skeleton fields, ref?: '@a'}, {op:'connect', from:'<id|@ref>', to:'<id|@ref>', label?}, {op:'group', ids:[...]}, {op:'update', id, props}, {op:'delete', id} ] }`. Skeleton rules (Excalidraw-skeleton-inspired): only `type` + content required; positions optional — a `--flow` convenience mode takes `{nodes, edges}` and auto-layouts via the draw engine `diagram()` layout (`apps/studio/draw/layout.ts`), placing the result in empty world space beside the referenced artboard (`--near <artboardId>`). All created strokes get `data-author="ai"` + fresh ids (returned on stdout as a ref→id map). Pipeline: load existing `.annotations.svg` → parse → apply ops via the SAME pure helpers (groups/bindings) → serialize → `sanitizeAnnotationSvg` → enforce 1 MB cap → if `_server.json` shows a live server, `PUT /_api/annotations` (live canvases update via the collab bridge); else write the file directly. Register the verb in `cli/commands/design.mjs` dispatch + the reachability whitelist; the parser/serializer needed here must be importable from the bin context — if `annotations-layer.tsx` can't be imported headlessly (React deps), extract `strokesToSvg`/`svgToStrokes` + the pure helpers into a React-free `apps/studio/annotations-model.ts` FIRST and re-export from the layer (mirror of the DDR-067 single-source rule; this extraction is the task's first commit).
- **Pattern**: `read-annotations.mjs` CLI shape; `draw-build.sh` engine-import pattern (DDR-070); DDR-062 verb dispatch.
- **Gotcha**: the extraction must keep the client bundle byte-equivalent in behavior (round-trip canaries + full annotation test suite green). PUT body is the whole SVG — read-modify-write race with a live editing user is inherent LWW (acceptable: same trade-off the canvas itself has; document in the verb's `--help`). Never bypass the sanitizer.
- **Validate**: `bun test annotate-write annotations-roundtrip` + `node cli/lib/plugin-cli-reachability.test.mjs`-equivalent run + manual: annotate a live canvas and watch it update

#### Task 13: UPDATE plugin docs — the agent contract

- **Do**: Add an "Annotations — AI read/write surface" section to `plugins/design/skills/design/SKILL.md` (+ pointer from `commands/new.md` ingest section and `commands/edit.md`): how to read (`maude design read-annotations [--graph]`), how to write (`maude design annotate`, ops schema, `--flow` mode, provenance rule, untrusted-data framing for read content), one worked example (map a user flow across existing artboards: read artboards → emit nodes/edges → `--flow --near`). Keep `<project>`-agnostic (no repo-specific paths).
- **Pattern**: phase-22 ingest-mode docs (the untrusted-data delimiter block).
- **Gotcha**: plugin markdown must call `maude design annotate` (DDR-062), never a raw bin path — the reachability test enforces it.
- **Validate**: `cli/lib/plugin-cli-reachability.test.mjs` green; `/flow:maintain-docs`-style grep for stale references

### Wave E — hardening + ship

#### Task 14: TESTS + fixtures + bundles + regression sweep

- **Do**: New fixture `figjam-v3-groups-bindings.svg` asserted byte-identical; full-suite `bun test` in `apps/studio`; biome clean; tsc baseline check; rebuild release bundles (invariant 5); `maude design smoke`; `maude design runtime-health`; walk the **Regression Inventory** below (code-verified + agent-browser where reachable; in-canvas interactive items flagged for the user's gate).
- **Validate**: full suite green; smoke 88/88-class pass; bundles committed

---

## Regression Inventory (the no-break gate — verify EVERY row after Wave E)

Existing behaviors that the touched code paths can break:

| # | Behavior | How to verify |
|---|----------|---------------|
| R1 | Legacy `.annotations.svg` round-trip byte-identical (both canaries + new fixture) | bun test |
| R2 | Marquee on empty world: intersection select, shift-additive, click-deselect, no-hit preserves selection | unit + user gate |
| R3 | Hull group-drag of multi-selection; drag-back-to-origin = no-op commit | unit + user gate |
| R4 | Single-stroke select/move/resize (all 8 handles, Shift/Alt modifiers) | existing tests |
| R5 | Sticky/text/anchored-text editors: open, commit, Escape, formatting toolbar | user gate |
| R6 | Media paste/drop (image, URL chip) still wins over strokes-paste when appropriate | unit + user gate |
| R7 | Eraser, highlighter, pen, shape popover, arrowhead + line-type dropdowns | user gate |
| R8 | Undo/redo granularity: every new op = one record; 50-cap; cross-canvas stacks | unit |
| R9 | Collab: PUT → `syncRoomFromAnnotations` → peers update; awareness selection halos | collab bridge test |
| R10 | Sanitizer: script/on*/foreignObject still stripped; new attrs pass; 1 MB cap | unit |
| R11 | Artboard-drag + element-marquee + comment pins unaffected (G5 routing, bare-drag paths) | user gate |
| R12 | `read-annotations.mjs` legacy output shape unchanged (additive keys only) | unit |
| R13 | Ghost previews + cursors per Phase 24 | user gate |
| R14 | `/design:new` ingest mode still reads brief boards | docs/manual |

---

## Validation

1. **Lint**: `pnpm lint` (biome — repo gate)
2. **Types**: `cd apps/studio && bunx tsc --noEmit` — DDR-026 baseline only (api.ts ×2 + runtime-bundle.ts), zero new
3. **Tests**: `cd apps/studio && bun test` (full suite, currently ~1321 — all green + new suites)
4. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → commit `dist/client.bundle.js` + `dist/comment-mount.js` + `dist/styles.css`; `dist/runtime/*` untouched (`check-runtime-bundles` green)
5. **Smoke**: `maude design smoke` (all canvases + specimens styled, no error overlays) + `maude design runtime-health`
6. **Scenario** (web-desktop only per config `platforms`): agent-browser drives the SHELL surfaces (Edit menu entries, tooltips, hint chips); in-canvas gestures are OOPIF-blocked → user interactive gate per the Regression Inventory
7. **A11y**: `flow:a11y-auditor` over the new ctx-toolbar clusters + hint chips (keyboard reach, ARIA on dropdowns, reduced-motion)
8. **Manual (user gate)**: R2–R7, R11, R13 + new-feature checklist: group/ungroup/enter-group, Cmd+D, Alt+drag, copy/paste, z-order keys, align, snap+Cmd-suppress, arrow bind/follow/re-anchor/unbind-on-delete, Cmd+Enter chain, first-use hints fire once; AI loop: `maude design annotate --flow` onto a live canvas updates in real time

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| shell-level annotation entry points (Edit menu, tooltips, hints) | Wave A/C chrome | 🆕 agent-browser script in Wave E |
| in-canvas manipulation gestures | Waves A/B | ⚠️ OOPIF — user interactive gate (established practice, Phase 24 precedent) |
| AI write loop (`annotate` → live canvas update) | Wave D | 🆕 CLI test + one live manual run |

## Acceptance Criteria

- [x] All tasks completed (tidy-up + resize-snapping may defer with a recorded follow-up) — deferred items recorded in the wave-1 log
- [x] Both legacy canaries + new fixture byte-identical green
- [x] Full `apps/studio` suite green (1390/1390); biome clean; tsc baseline only
- [x] Release bundles rebuilt + committed; runtime bundles untouched
- [x] Regression Inventory walked — user gate ran as THREE interactive feedback waves (F: 12 findings, G: 4, H: 5+2) — all addressed + live-verified
- [x] `maude design annotate` round-trips: skeleton ops → sanitized SVG → live canvas update → `read-annotations --graph` reads back nodes+edges
- [x] Plugin docs updated; reachability test green
- [x] DDR recorded for the data-model decisions (groupIds tag-array, embedded bindings, CLI write verb) — DDR-100
- [x] What's New entry (pending version) via `whats-new-entry` skill at `/flow:done`
- [x] Roadmap regenerated (`pnpm --filter @maude/site gen:roadmap`) in the closing commit

---

## Execution log — 2026-06-11 (one session, all waves)

> ✅ Task 1 (groups) · ✅ Task 2 (duplicate) · ✅ Task 3 (copy/paste) · ✅ Task 4 (z-order) · ✅ Task 5 (align/distribute) · ✅ Task 6 (Shift+marquee over artboards) · ✅ Task 7 (connector binding) · ✅ Task 8 (snapping + guides) · ✅ Task 9 (quick-create chain; sticky auto-edit pre-existed) · ✅ Task 10 (hints; tool tooltips pre-existed with shortcuts) · ✅ Task 11 (read-annotations v2 + --graph) · ✅ Task 12 (`maude design annotate` + model extraction) · ✅ Task 13 (plugin docs) · ✅ Task 14 (tests/fixture/bundles/smoke)

- **Model extraction done FIRST** (Task 12's first commit per plan): `annotations-model.ts` (React-free types + serializer + parser + geometry + **sanitizer** — moved from api.ts with re-export). Canaries stayed green throughout.
- **Verify:** apps/studio `bun test` **1369/1369** (was 1321; +48 new across 6 new suites incl. byte-identical figjam-v3 fixture + annotate subprocess E2E); tsc = 3 DDR-026 baseline (0 new); biome clean on all 19 touched files (repo-root `pnpm lint` has pre-existing unrelated errors — video scenes, participants-chrome); CLI suites green from repo root; `npm pack` ships `bin/annotate.{sh,mjs}`.
- **Smoke (DDR-021):** full set **87/87 rendered styled, import-graph clean** against `bun server.ts` from source. PNGs eyeballed for the `ui/` canvases (the only surfaces with `.annotations.svg` data — the complete static-visual surface of this change; annotation manipulation chrome is interaction-gated and invisible in static captures). First smoke run failed 87/87 `open-failed` — root cause: server-up resolved the npm-installed v0.28.1 platform binary (broken `/$bunfs/root` artifact lookup) instead of source; resolved by booting source.
- **Live AI loop verified:** `annotate` create → `via:"server"` (PUT → sanitize → persist → collab broadcast) → `read-annotations` returns the stroke with `author:"ai"` → `annotate` delete → file restored byte-identical.
- **Bundles:** `dist/client.bundle.js` 276 KB + `comment-mount.js` 39 KB + `styles.css` 93 KB rebuilt `--release` (the session's test runs self-heal dist to dev bundles — rebuilt after); `dist/runtime/*` restored from git (test suite regenerates them — re-run `git checkout -- apps/studio/dist/runtime/` before any commit that follows a test run).
- **DDR-100** records the data-model trio (group tag-array · embedded binds · CLI write verb).

**Deferred (recorded, small):** FigJam "Tidy up" grid (stretch goal); resize-handle edge snapping (drag-snap shipped); shell Edit-menu Group/Ungroup items (ctx-toolbar + ⌘G cover it; avoids extra shell surface); Esc-returns-to-group after deep-select (Esc clears — simplification); `update` op in annotate v1 (delete+recreate; DDR-100); What's New entry → `/flow:done` (whats-new-entry skill).

**User interactive gate (OOPIF — agent-browser can't drive the cross-origin canvas iframe; Phase 24 precedent):** R2/R3 marquee + hull drag, R5 editors, R6 media paste vs strokes paste, R7 tools, R11 artboard-drag routing + NEW: group/ungroup ⌘G, deep-select double-click, ⌘D + Alt+drag duplicate, copy/paste, z-order keys, align cluster, snap guides + ⌘ suppress, arrow bind/re-anchor/⌘-free + bind halo, ⌘Enter chain, one-time hints.

## Execution log — Wave F (user-gate feedback, 2026-06-11)

User interactive gate returned 12 findings (with FigJam reference screenshots). All addressed in one follow-up wave, **live-verified via agent-browser driving the canvas page directly on the canvas origin** (the OOPIF constraint only applies to iframe-embedded automation — direct page automation works; this unlocks scripted gesture verification permanently):

1. ✅ **ROOT-CAUSE BUG (marquee-select then can't move together):** `use-annotation-selection.tsx` created `containsRef` as a plain object literal per render — the stable `contains()` closure read the FIRST render's empty selection forever, silently breaking hull-drag, click-keeps-selection, and every contains-based path since Phase 5.1 (STATE's "multi-annotation drag shipped code-verified only" caveat was exactly this). One-line `useRef` fix; hull-drag + on-stroke group drag live-verified both directions.
2. ✅ **Right-click selects + annotation context menu** — capture-phase contextmenu claims strokes, selects (group-expanded, keeps a multi-selection), opens a `.dc-context-menu`-styled menu: Copy/Cut/Paste/Duplicate · z-order ×4 · Group/Ungroup · Delete, sharing the shortcut code paths.
3. ✅ **Edge handles** — n/e/s/w pills (single-axis, Alt symmetric; sticky stays square re-centered); pen keeps corner-scale only.
4. ✅ **Dimension-match quotas** — resizing snaps W/H to a neighbour's dims (6px/zoom), dashed halo on the matched stroke + live `W × H` label; only the dragged axes participate (edge-drag can't re-snap the cross axis — caught + fixed live); ⌘ suppresses.
5. ✅ **Rotation** — `rotation` (deg, bbox-center pivot) on box strokes + standalone text; `data-rot` + presentational transform; rotated render/halo/handles/hit-test (inverse-rotate probe); resize in the rotated local frame; knob BELOW the bottom edge (above collided with the ctx toolbar — caught live), Shift = 15°, magnetic 0/±90/180 within 2°.
6. ✅ **Connector mechanism** — connection dots on a selected bindable shape (offset OUTSIDE the edge — on-edge collided with the new edge handles, caught live); drag-to-connect draws a BOUND curved connector (⌘ keeps free); **auto-routing**: non-pinned binds re-pick the side facing the other end on every recompute (live-verified: moving box2 under box1 re-routed east→west to south→north and back); explicit endpoint re-anchor sets `pinned` (serialized ` p` token); bound curved arrows use EXIT-NORMAL cubics + sleeker heads (legacy unbound bytes frozen — canaries green; figjam-v3 fixture regenerated for the new bound-head geometry).
7. ✅ **Hover "Add text"** on empty rect/ellipse + **Enter opens the editor** on a single selected text-capable stroke.
8. ✅ **Edit-mode TEXT toolbar** — while an inline editor is open the ctx toolbar flips to size/B/I/S/U/align driving the EDITOR via `maude:editor-format` events (stroke mutation mid-edit would clobber the contentEditable); editor echoes state back (+ request/response for the mount race — caught live); fontSize/align carried through commit via extended EditorFmt; outside-click commit ignores toolbar clicks; I-beam verified via computed style (`cursor: text`).
9. ✅ **Section tool** (⇧S) — new `SectionStroke` (label chip + soft region, serialized as inert g/rect/text + `data-label`); interior CLICK-THROUGH (border + chip select); slots at the BACK of z-order; **containment drag** carries strokes whose bbox center sits inside (live-verified incl. a bound arrow re-following); resize via standard handles; label renames via double-click; reader + annotate verb support it (`create.type: "section"`).
10. ✅ **Cute pass** — default shape kind now `rounded`; connector visual language (exit normals + sleek heads) matches the FigJam reference.

**Verify:** apps/studio 1372/1372 (3 expectation updates: regenerated figjam-v3 fixture ×2, tool-list test for section); tsc DDR-026 baseline only; biome clean on every touched file (2 pre-existing context-menu warnings untouched); release bundles rebuilt (`comment-mount.js` +141 B — section in the Tool union); `dist/runtime/*` restored from git after each test run.

**Known small cuts (recorded):** ellipse dimension-match is label-only (snap covers box-shaped strokes); group bbox stays axis-aligned over rotated members; section label chip width is a font-metric estimate; FigJam Tidy-up still deferred from wave E.

## Execution log — Wave G (user-gate feedback round 2, 2026-06-11)

User returned 4 findings (FigJam screenshots #10–#13). All addressed + live-verified via direct canvas-origin agent-browser automation:

1. ✅ **Double context menu on right-click** — root cause: the input-router opens the SHELL canvas menu from a right-button **pointerdown** (`classify` maps button 2 → `context-menu` and `onPointerDown` dispatches it), while the annotation layer only claimed the later `contextmenu` event — so both menus opened. Fix: the annotation layer's ctx-menu effect now also claims right-button pointerdown over a stroke at document capture (fires before the router's host-capture listener) with `stopImmediatePropagation()` **without** `preventDefault()` so the native `contextmenu` event still follows and opens the annotation menu. Live: right-click on a stroke → exactly one menu (annotation), shell "Fit to view" menu gone.
2. ✅ **Text in diamond/triangle** — new `AnchorHost = RectStroke | EllipseStroke | PolygonStroke` in the model; `anchorsById` + every typing site widened; dblclick/Enter/⌘Enter-chain/hover-"Add text" gates include `polygon`; `TextEditor` host generic. The `annotate` CLI now anchors polygon labels too (was: standalone label dropped below the shape). Live: hover triangle → "Add text" ghost; dblclick → editor (I-beam, computed `cursor: text`); committed "ano" renders centered + serialize→parse round-trips `data-anchor-id` byte-identical (new model test).
3. ✅ **Rotate knob → corner hover zones** — the below-bbox knob removed entirely. Four invisible 18×18 `dc-annot-rotate-zone` divs float diagonally outside the corners (screen-constant 13px reach along center→corner, so zoom + rotation both track), custom double-arrow rotate SVG cursor, z-index 5 (corner squares at z 6 win overlaps). Rotation is now **relative to the grab angle** (`rotRef {angle0, rot0}` captured at pointerdown — no jump), Shift 15° + magnetic cardinals kept. `resizeStroke` gained the optional `rotRef` param; covered by 6 new unit tests. Live: CDP drag rotated the rect 46.9° → 38.5° with `data-rot="38.5"` persisted (earlier "dead drag" diagnoses were stale-coordinate automation errors — zones MOVE with the rotated bbox).
4. ✅ **Chrome offset ("nalepené značky")** — resize handles now sit on the HALO (bbox + `HANDLE_PAD` 4 world px) instead of glued to the stroke; `applyResize` shifts the cursor back by the pad (per-corner `padDX/padDY`) so the first move doesn't grow the shape. Context toolbar margin 8 → 28 px so it clears the halo + connection dots (was covering the top dot). Live: handles ~3px off the shape at zoom 0.75, toolbar bottom 28px above the bbox.

**Verify:** apps/studio `bun test` **1380/1380** (+8: 6 rotation-zone units + 2 polygon-anchor model tests; one flaky collab-stress fail on first run, clean on re-run ×2); tsc = DDR-026 baseline only; biome clean on all touched files; release rebuild → `dist/client.bundle.js`/`comment-mount.js` differ from HEAD only by the version string (Wave G ships entirely in source — the canvas bundle is built per-request); `dist/runtime/*` restored from git.

**Session note (parallel-session interference):** the live-verify environment had a foreign worktree session's dev-server entry in `_server.json` and an LWW Yjs overwrite clobbered a first test-write to `Smoke TSX` (two servers serving the same root); verification moved to the untouched `Horizon Landing` canvas. The stale-`dist/comment-mount.js` red herring (dev artifact served by the freshly booted server) cost a debugging loop — the annotation code in fact ships via the per-request canvas bundle, so dist staleness was irrelevant.

## Execution log — Wave H (user-gate feedback round 3, 2026-06-11)

Five findings; all addressed + live-verified (direct canvas-origin automation, synthetic-event fallback for flaky CDP gestures):

1. ✅ **Shape-kind switcher in the ctx toolbar** — new model pair `shapeKindOf` / `convertShapeKind` (pure, tested): converts rect ⇄ rounded ⇄ ellipse ⇄ diamond ⇄ triangle ⇄ triangle-down **preserving the bbox, styling (color/width/fill/dashed), rotation, groups and the ID** — so anchored text and arrow binds ride the conversion. Toolbar grows a 6-button kind cluster (SHAPE_KIND_ICONS, active = uniform kind) for all-shape selections; one undo record via `applyToStrokes`. Live: rect→diamond from the toolbar with the anchored label following.
2. ✅ **Selection frame offset screen-constant** — `HALO_PAD_PX = 6` (model, single source): SelectionHalo + AnnotGroupBbox pads are now `px/zoom` (was 4 world px ≈ 3 px at the user's 0.75 zoom — read as glued), resize-handle positions sit on the same frame, and applyResize pad-corrects by the same `6/zoom`. Live: 5–6 px gap measured at 0.75 zoom.
3. ✅ **One undo record per resize/rotate gesture** — `updateStroke` committed (undo record + PUT) on EVERY pointermove tick; undo walked back pixel by pixel. New store verbs `previewStroke` (local state only — the move-drag's transient pattern) + `commitGesture(before, label)` (single record, no-op when the gesture lands where it started); the resize overlay previews per tick and commits once on pointerup with labels rotate / resize / move endpoint. Live: 5-tick resize undone by ONE ⌘Z to the exact pre-drag size.
4. ✅ **Rotated-object resize drift** — the axis-aligned math anchors the opposite corner in the LOCAL frame, but the rotation pivot (bbox center) moves with w/h, so the rotated image translated on screen. `rotatedAnchorShift` compensates: the anchor's local point is preserved by `bboxResize`, so its world drift = rotating that point around the old vs new center; the difference is added to x/y (translation commutes with center-rotation). Applied to rect-family + image + ellipse (Alt skips — center already fixed). 5 new unit tests; live: 38.5°-rotated rect resized 245×176→300×168 with the NW anchor world-fixed at [714,453].
5. ✅ **Section tool nowhere to be found** — Wave F shipped it ⇧S-only: the palette's hardcoded `DRAW_TOOLS` list never included `'section'`, so no button rendered. Added between sticky and arrow. Live: visible in the palette.

**Verify:** apps/studio `bun test` **1390/1390** (+10: 5 rotated-resize anchor + 5 shape-conversion); tsc = DDR-026 baseline; biome clean; dist diff vs HEAD = version string only (Wave H ships in source); `dist/runtime/*` restored.

**Gotcha (verification methodology):** synthetic `PointerEvent` sequences dispatched in one task read STALE geometry — React flushes async for untrusted events; space the down/move/up with timeouts and read after a flush window. Trusted CDP input flushes per event but the agent-browser CLI occasionally drops a gesture — re-query coordinates fresh and retry before diagnosing code.

**Wave H follow-up (same day):** the Phase-21 rect corner-radius cluster (square/soft/pill) read as "shapes twice" next to the new kind switcher — RETIRED from the toolbar (the kind cluster's square/rounded covers 0/8; `cornerRadius` stays in the model + serialization, existing pill rects keep rendering, just no dedicated control). Live-verified: one shape cluster, 6 kind buttons, 0 corner buttons. 1390/1390 · tsc baseline · biome clean · dist version-string-only.

**Wave H follow-up 2 (same day):** diamond/triangle toolbars lacked the Stroke|Fill toggle + thin/thick — the fill/thickness caps, setters, and uniform-value derivations predated polygons (rect/ellipse only). Widened all five sites to include `polygon`; the polygon toolbar is now IDENTICAL to rect/ellipse (Stroke|Fill, swatches, thin/thick, kind switcher, dash, delete). Live-verified: fill swatch → `fill="#fce6d6"`, Thick → `stroke-width="6"` on a diamond. 1390/1390 · tsc baseline · biome clean · dist version-string-only.

## Retro

- **Live verification unlocked mid-stream.** The plan assumed an OOPIF "user-gate-only" check for in-canvas gestures; the discovery that agent-browser drives the canvas page **directly on the canvas origin** turned 21 user-gate rows into scripted, screenshotted verification — and made the four feedback waves (F/G/H) possible to close in one session. Fold this into `/design` verification guidance: drive `<canvasOrigin>/_canvas-shell.html?...` directly, don't assume the iframe boundary blocks everything.
- **The biggest bug was a one-line stale ref, invisible to tests.** `containsRef` as a per-render object literal silently broke every `contains()` path since Phase 5.1 and shipped "code-verified only." Pure-function unit tests never caught it because it was a React-lifecycle bug. Lesson: a "shipped, code-verified only" caveat in STATE is a real debt marker — the interaction it guards should get live verification before it's called done.
- **Three feedback waves > one big plan.** Waves F (12), G (4), H (5+2) each surfaced things the plan didn't anticipate (rotation affordance ergonomics, "shapes twice" toolbar redundancy, polygon toolbar parity). Cheap, fast iteration against a real user beat trying to spec FigJam parity up front. The plan's "user gate" was the highest-value step.
- **Security review earned its keep at the gate.** The defender passed; the ethical-hacker found a real chained HIGH (Infinity-coord content spoof × forgeable provenance × the AI-loop trifecta) that no round-trip canary or allowlist could catch — it lived in the *numeric parser differential* between the AI reader and the renderer. Two small fixes (finite-clamp + loopback egress allowlist) closed the exploitable legs. Keep running BOTH personas on any AI read/write surface.
- **Environmental flake cost real time twice.** A foreign-worktree `_server.json` (concurrent session) and a `better-sqlite3` ABI mismatch (Node version drift) both presented as "the feature is broken." Check the environment (which server, which Node ABI) before diagnosing code when a whole suite fails uniformly.

> Process change for `/plan`: when a feature has an interactive-only verification surface, budget for ≥2 feedback waves explicitly rather than treating the first user gate as final.
