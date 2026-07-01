# Feature: Drag-to-reorder elements — layer panel + in-canvas (Phase 12.1)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan is the **deferred `phase-12.1`** that DDR-103 spun off from Phase 12 ("Layers drag-to-reorder … requires JSX node-move AST surgery + positional-id recompute"). Read DDR-019, DDR-103, DDR-054, and DDR-007 before touching source.

## Description

Let a user reorder / re-place a canvas element by direct manipulation — drag a `LayerRow` in the right-dock **Layers** tree to a new position, **or** drag the rendered element directly on the canvas — and have the move rewrite the underlying `.tsx` source (moving the JSX element node before/after/into a target). Both surfaces reduce to one deterministic source operation (`moveElement`) committed through a single main-origin-only write. Reparenting into a different container is in scope (guarded).

## User Story

As a designer iterating on a canvas, I want to move an element (e.g. drag a `<div>` above another `<div>`, or into a different container) either directly on the canvas or via the Layers panel, so that I can restructure a layout by hand without hand-editing TSX or round-tripping through `/design:edit`.

## Problem

Phase 12 shipped a **browsable, click-to-select** Layers tree and the deterministic `canvas-edit.ts` engine — but that engine only does **attribute/text** edits (`editAttribute`, `editText`) keyed by `data-cd-id`. There is **no** way to move a JSX element node to a new sibling/parent position:

- The only structural-change path today is an **agent full-file rewrite** (`/design:edit` step 5) — expensive (~100 KB context), non-deterministic, and not reachable from a drag gesture.
- `data-cd-id` is **positional** (`Bun.hash(componentName + ":" + preOrderIndex)` — DDR-019), so any move **renumbers every following sibling's id**. A naive re-select by the old id silently selects the *wrong* element after the move.

## Solution

1. **One deterministic source primitive** — add `moveElement(canvasAbsPath, id, refId, position)` to `canvas-edit.ts` using the existing `oxc-parser` + `magic-string` stack (`magic-string` has a native `.move(start, end, index)`). It cuts the moved element's full source span and re-inserts it relative to `refId` (`before` | `after` | `inside-start` | `inside-end`). Guardrails refuse structurally-unsafe moves (into own descendant, into void/self-closing, into expression-only-children containers). Reparenting = the same primitive with a `refId` in a different parent.
2. **One privileged write route** — `POST /_api/reorder` (main-origin only, `sameOriginWrite` CSRF-guarded, absent from `CANVAS_SAFE_API` — DDR-054). Snapshots pre-move via `history.ts`, writes atomically, and returns the moved element's **recomputed** `data-cd-id` (`movedId`) plus its `data-dc-element` handle if present, so the client can re-settle selection.
3. **Two client surfaces, sequenced:**
   - **Milestone A — Layers-panel drag** (same-origin, low risk): pointer-drag reorder in the existing `LayerRow` tree + keyboard reorder (Alt+↑/↓) for a11y. Commit → `/_api/reorder`.
   - **Milestone B — in-canvas drag** (cross-origin, higher risk): grab a selected element in the canvas iframe, flow-aware insertion-line via sibling hit-test + `computeSnap`, drop → canvas posts `dgn:'reorder-request'` → the shell performs the privileged write (mirrors the existing `edit-text` flow exactly).
4. **Selection re-settle after id churn** — priority `movedId (recomputed) → data-dc-element (survives the move byte-for-byte) → jsxPath` (DDR-019 fallback). Re-select rides the existing post-HMR `select-by-id` + `request-layers` path.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server + studio client)
- **Affected Systems**: canvas source-edit engine, HTTP write surface, canvas-pipeline id/locator, studio client shell (InspectorPanel + Layers tree), canvas iframe (CanvasShell + input-router), shell↔canvas `dgn:*` bus, history/undo, committed `dist/client.bundle.js`
- **Dependencies**: none new — reuses `oxc-parser ^0.134`, `magic-string ^0.30.21` (both already runtime deps of `apps/studio`)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `apps/studio/canvas-edit.ts` — the deterministic edit engine to extend. Note `editAttribute` (lines 180–203), `findOpening`/AST walk, `applyEdit` via magic-string (339–353), the per-file mutex (150–163), and the `--invoke` CLI (617–638). `moveElement` mirrors this shape.
- `apps/studio/canvas-pipeline.ts` — Pass-1 id injection (218–236) and `computeId(componentName, preOrderIndex)` (~line 66). `moveElement` must reuse `computeId` to derive the post-move `movedId`. **Export `computeId` + the pre-order walk if not already exported.**
- `apps/studio/locator.ts` — `LocatorEntry` schema (25–36), `writeLocator` (109), `canvasSlug` (46). Locator is rewritten on next GET; do not hand-write it from the reorder route.
- `apps/studio/http.ts` — `/_api/edit-css` route (1096–1126), `CANVAS_SAFE_API` allowlist (1477–1488), `sameOriginWrite` guard. Add `/_api/reorder` next to edit-css, NOT in `CANVAS_SAFE_API`, NOT in `startCanvasServer` routes.
- `apps/studio/api.ts` — `editCss` (1245–1296), `editText` (1298–1319), `editAttr` (1321–1375). Add `reorder()` following the same validate→delegate→return shape.
- `apps/studio/history.ts` — `writeSnapshot(file, bytes, reason)` (66–96), `rollback` (133–139). Snapshot `reason: "pre-reorder"` before the write.
- `apps/studio/client/app.jsx` — `panels` array (2430), View-menu toggle handler (2621–2640), `InspectorPanel` (5308–5502), `LayerRow` (5151–5241), Layers tab render (5453–5489), incoming `dgn` handler (6515–6787), outgoing `dgn` posts + `select-by-id`/`request-layers`/`highlight` (5872–6170), parent-origin guards for `apply-style`/`record-edit` (1524, 1559), iframe registration (2774–2795, 7157).
- `apps/studio/canvas-shell.tsx` — the iframe-side provider host + `dgn:*` protocol + origin guards; where the in-canvas drag layer mounts.
- `apps/studio/input-router.tsx` — `DRAG_THRESHOLD_PX` (42), `classify()` (155–287), the `Tool` union. Extend for the in-canvas reorder gesture.
- `apps/studio/use-artboard-drag.tsx` — pure `dragReducer` (down→pending→dragging), `computeFollowers` (204–223), `DRAG_THRESHOLD_PX` (49). Reuse the reducer, not the artboard-specific bits.
- `apps/studio/use-snap-guides.tsx` — `computeSnap(proposed, others, opts)` (139–239) for the sibling insertion snap.
- `apps/studio/marquee-overlay.tsx` — AABB hit-test over `[data-cd-id]` rects (220–224) — the pattern for finding the drop-target sibling in-canvas.
- `apps/studio/dom-selection.ts` — `hoverTargetToSelection` (292), `scopedCdSelector` (124), the `[data-dc-screen] [data-cd-id]` resolution + `[data-dc-element]` preference order.
- `apps/studio/inspect.ts` — `SelectedElement`/`ActiveState` schema (6–53), `_active.json` writes. Re-settle updates `selected.id` via the round-trip, not a direct write.

### Files to Create

- `apps/studio/test/canvas-reorder.test.ts` — `bun:test` unit coverage for `moveElement` (sibling reorder, reparent, all 4 positions, every guardrail refusal, whitespace/formatting preservation, `movedId` recompute).
- (Milestone B) `apps/studio/use-element-reorder.tsx` — the in-canvas drag hook (drag state + flow-aware drop-target + insertion-line), if the gesture doesn't fold cleanly into an existing hook.
- `.ai/decisions/DDR-138-jsx-node-move-reorder-and-id-resettle.md` — the decision record (see Task 1).

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Canvas Viewport.tsx` → artboard `CV-07 · INSPECTOR + LAYERS` (lines ~872–1018) | iterated (aspiration 4.4) | inspector, layers, phase-12 | The approved mockup for the Layers tree + inspector + "Source rewrite" strategy chip. Ground the Layers-tree drag affordance, insertion-line, `role="tree"` a11y semantics, disclosure glyphs, hover/selected states, and the breadcrumb path in this. Reorder is the direct-manipulation extension of this surface. |

### Documentation

- `magic-string` `.move(start, end, index)` — moves a character range to before `index`, preserving the rest of the source untouched. This is the core primitive; verify against the installed `^0.30.21` API before use (context7 / node_modules types).
- `oxc-parser` `parseSync` AST — already used in `canvas-edit.ts`; `JSXElement` nodes carry `.start`/`.end` byte offsets and `.loc` for the span math.

### Patterns to Follow

- **Deterministic edit + atomic write + mutex** — copy the exact shape of `editAttribute` in `canvas-edit.ts`: parse with `oxc-parser`, mutate with `magic-string`, write temp-file + `Bun.write` + `fs.rename` under the per-file mutex. Reuse `Bun.*` APIs (DDR-045/runtime-migration rule); tests use `bun:test`.
- **Privileged write route** — mirror `/_api/edit-css` (`http.ts` 1096–1126 → `api.ts` editCss): `sameOriginWrite` guard, JSON body validation, delegate to the engine, return a small JSON delta. Never add the route to `CANVAS_SAFE_API` or the `startCanvasServer` routes map.
- **Canvas requests, shell writes** — the in-canvas gesture follows `edit-text`: the untrusted canvas posts `dgn:'reorder-request'`; the shell (main origin) performs `/_api/reorder`. No new trust surface beyond what `edit-text`/`apply-edit` already opened (DDR-054).
- **Post-HMR re-select** — reuse the existing `select-by-id { id, artboardId, index }` + `request-layers { artboardId }` outgoing messages that already re-settle selection + rebuild the tree after an HMR reload.

---

## Design Decisions

> UI feature; DS = Maude's own `system/project`. The Layers tree, `LayerRow`, `role="tree"`, and inspector chrome already exist — **extend, don't rebuild** (pattern-priors rule; `design-system-keeper`).

### Components (reuse)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `LayerRow` | `app.jsx` 5151–5241 | Add a drag handle + drop-target states (`is-drop-before` / `is-drop-after` / `is-drop-inside`) + `aria-grabbed`; keep chevron/icon/eye/keyboard behavior. |
| `InspectorPanel` Layers tab | `app.jsx` 5453–5489 | Host the insertion-line indicator + drag state; no new panel/dock. |
| `dragReducer` | `use-artboard-drag.tsx` | Pure down→pending→dragging state for both surfaces. |
| `computeSnap` | `use-snap-guides.tsx` | Sibling-edge snap for the in-canvas insertion line. |
| marquee AABB hit-test | `marquee-overlay.tsx` | Find the drop-target sibling under the pointer in-canvas. |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Insertion line / drop indicator | `var(--accent)` | Matches selection halo; 2px line, animate within `motion.micro` (300ms) ceiling, honor `prefers-reduced-motion`. |
| Drop-into container highlight | `var(--accent-tint)` | Subtle fill on the hovered container. |
| Row grabbed / ghost | `var(--bg-2)` / `var(--border-strong)` | Match existing `st-layer` states. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `use-element-reorder.tsx` (Milestone B only) | No existing hook does flow-aware in-canvas element drop-target inference | Composes `dragReducer` + `computeSnap` + marquee hit-test |

---

## Tasks

Execute in order. Milestone A (Tasks 1–6) is independently shippable; Milestone B (Tasks 7–9) builds on it.

### Task 1: RECORD DDR-138 — node-move + id-re-settle + reparent guardrails

- **Do**: Write `.ai/decisions/DDR-138-jsx-node-move-reorder-and-id-resettle.md` capturing: (a) deterministic `magic-string.move` span-move as the reorder primitive (vs agent rewrite); (b) positional-`data-cd-id` churn is accepted, with re-settle priority `movedId → data-dc-element → jsxPath`; (c) reparenting is in scope with the guardrail set; (d) the write stays main-origin-only per DDR-054, canvas-requests-shell-writes.
- **Pattern**: existing DDR files in `.ai/decisions/`; use `/flow:record-ddr`.
- **Gotcha**: DDR-138 is the next free id (DDR-137 is the highest). Cross-link DDR-019, DDR-103, DDR-054, DDR-007.
- **Validate**: file exists, front-matter well-formed.

### Task 2: CREATE `moveElement` in `canvas-edit.ts`

- **Do**: Add `async moveElement(canvasAbsPath, id, refId, position)` where `position ∈ 'before'|'after'|'inside-start'|'inside-end'`. Parse with `oxc-parser`; locate the moved node's full span `[node.start, node.end]` (include the leading indentation/newline so the block moves cleanly); resolve the insertion index from `refId` + position; apply `magicString.move(start, end, insertIndex)`; re-indent the moved block's per-line leading whitespace to the target depth; atomic write under the per-file mutex. After writing, re-parse the new source, run the shared pre-order walk to find the moved node's new pre-order index, and return `{ canvas, movedId: computeId(componentName, newIndex), semanticId: <data-dc-element or null>, delta }`.
- **Pattern**: `editAttribute` (canvas-edit.ts 180–203) for parse/mutate/write/mutex; `computeId` + pre-order walk from `canvas-pipeline.ts` (export them).
- **Gotcha**: `data-cd-id` is injected at *build* time, not present in source — locate nodes by re-deriving pre-order index from source, not by reading `data-cd-id`. Preserve all bytes outside the moved span. `.move()` semantics move to *before* `index`; compute `inside-end` as before the parent's closing tag.
- **Validate**: `cd apps/studio && bun test test/canvas-reorder.test.ts` (added in Task 5).

### Task 3: ADD reorder guardrails to `moveElement`

- **Do**: Refuse (throw `CanvasEditError` with a clear message) when: `id === refId`; `refId` is a descendant of `id` (moving a node into its own subtree); `position` is `inside-*` but the target is self-closing/void or has expression-only children (`{...}` with no JSXText/JSXElement children) where inserting a child would break syntax; the moved node or target cannot be resolved. Never write a corrupt file — validate the post-move source re-parses cleanly before committing (parse the mutated string; on parse error, abort without writing).
- **Pattern**: canvas-edit.ts existing `CanvasEditError` throws (244–253, 322–328) and the leaf-text-only refusals (397–402).
- **Gotcha**: descendant check needs the AST subtree range of `id` — compare byte offsets (`refId.start` within `[id.start, id.end]`).
- **Validate**: guardrail cases in Task 5 tests all throw, no file written.

### Task 4: ADD `POST /_api/reorder` route (`http.ts` + `api.ts`)

- **Do**: In `http.ts`, add the route next to `/_api/edit-css` (main-origin, `sameOriginWrite` guard, NOT in `CANVAS_SAFE_API`, NOT in `startCanvasServer` routes). Body `{ canvas, id, refId, position }`. In `api.ts`, add `reorder()`: resolve abs path, `writeSnapshot(abs, currentBytes, "pre-reorder")` (history.ts), call `moveElement`, return `{ canvas, movedId, semanticId, delta }`. Return `409`/`422` with the `CanvasEditError` message on a guardrail refusal (do not 500).
- **Pattern**: `api.editCss` (api.ts 1245–1296) + the edit-css route wiring.
- **Gotcha**: keep the route out of the canvas-origin allowlist — a `GET`/canvas-origin call must 405/404 (assert in Task 6).
- **Validate**: `curl -X POST localhost:<port>/_api/reorder` from main origin moves a node; from canvas origin it is blocked.

### Task 5: CREATE `test/canvas-reorder.test.ts` (`bun:test`)

- **Do**: Cover sibling reorder (before/after), reparent into another container (inside-start/inside-end), formatting/whitespace preservation (only the moved span + re-indent changes), the `movedId` recompute matches what the pipeline would assign, `data-dc-element` survives verbatim, and every guardrail refusal (self, descendant, void target, expression-only-children) throws without writing.
- **Pattern**: existing `apps/studio/test/*.test.ts` bun-test style.
- **Gotcha**: assert byte-diff is minimal (snapshot the output source), not just "it parses".
- **Validate**: `cd apps/studio && bun test test/canvas-reorder.test.ts` green; add an origin-gate assertion in `test/canvas-origin-gate.test.ts` that `/_api/reorder` 405s from the canvas origin.

### Task 6: ADD Layers-tree drag + keyboard reorder (`app.jsx` InspectorPanel) — Milestone A UI

- **Do**: In `LayerRow` + the Layers tab, add pointer-drag reorder: on drag, show a 2px `var(--accent)` insertion line between rows (before/after) or an `var(--accent-tint)` container highlight (inside), computed from pointer Y vs each row's rect + depth. On drop, call `POST /_api/reorder` with `{ canvas, id: draggedId, refId: targetId, position }`, then after the HMR reload settles re-select via `select-by-id { id: movedId }` (fall back to a `[data-dc-element]`/jsxPath re-select if the id misses) and fire `request-layers`. Add **keyboard reorder** (row focused: Alt+↑/Alt+↓ moves before/after the prev/next sibling; Alt+→ nests into the following sibling) with an `aria-live` announcement — drag is not keyboard-accessible and the tree is `role="tree"` (CV-07 a11y contract).
- **Pattern**: `dragReducer` (use-artboard-drag.tsx); existing `onSelectLayer`/`onHoverLayer`/`select-by-id`/`request-layers` wiring (app.jsx 5872–6170).
- **Gotcha**: same-origin — no `dgn` round-trip needed for the *gesture*; only the `/_api/reorder` fetch + re-select. Re-select by the **new** `movedId`, never the old dragged id (id churn). Debounce nothing — one commit per drop.
- **Validate**: dev-server smoke + `desktop-e2e` scenario (drag a layer row; assert new order + selection lands on the moved element).

### Task 7: EXTEND `input-router` + add in-canvas reorder gesture (CanvasShell) — Milestone B

- **Do**: Add a reorder drag on a selected element in the canvas iframe (modifier-drag on the move tool, or a small drag handle on the selection halo — pick per CV-07/UX; recommend modifier-drag to avoid a new palette tool). While dragging: hit-test sibling/container `[data-cd-id]` rects (marquee AABB pattern), detect the drop parent's flow direction from computed `display`/`flex-direction` (horizontal insertion line for row flow, vertical for column/block), snap the insertion point with `computeSnap`. Render the insertion line as screen-space fixed overlay (cursors-overlay pattern).
- **Pattern**: `input-router.classify` (155–287) + `dragReducer` + `computeSnap` + `marquee-overlay` hit-test; `dom-selection` to resolve `id`/`refId`.
- **Gotcha**: runs in the untrusted iframe — the gesture computes intent only; it must NOT write. Flow direction matters for "above" semantics (column vs row). Honor `prefers-reduced-motion` on the insertion-line animation.
- **Validate**: insertion line tracks pointer + flips orientation with parent flow; drop produces a correct `{ id, refId, position }`.

### Task 8: WIRE `dgn:'reorder-request'` → shell performs `/_api/reorder` — Milestone B

- **Do**: On drop, the canvas posts `dgn:'reorder-request' { id, refId, position, artboardId }`. Add a handler in the shell's incoming `dgn` switch (app.jsx 6515–6787) that performs `POST /_api/reorder` (main origin), then re-settles selection exactly like Task 6 (`select-by-id { movedId }` → fallback → `request-layers`). Register the new message in the protocol table/comment.
- **Pattern**: the existing `edit-text` → `/_api/edit-text` handler (canvas posts, shell writes).
- **Gotcha**: apply the same origin discipline as `edit-text` (accept from the canvas source; the shell issues the CSRF-guarded write). No new parent-only guard needed — this is a canvas→shell request, not a shell→canvas privileged post.
- **Validate**: `desktop-e2e` — drag an element on the canvas above another; assert source reorder + re-selection.

### Task 9: REBUILD committed client bundle + live-verify + whats-new

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` (+ `dist/styles.css` if CSS changed). Run `/design:smoke`. Append a pending "What's New" entry via the `whats-new-entry` skill (drag-to-reorder in Layers + on canvas).
- **Pattern**: the CLAUDE.md rebuild rule (never boot source dev-server without `--release` rebuild afterward — dev build is 3.6 MB vs 250 KB release).
- **Gotcha**: whatever is committed is what ships. Bundle rebuild is mandatory after any `client/` change.
- **Validate**: `bash scripts/... smoke`; bundle size within `dist` norms; `whats-new.json` validates against its schema.

---

## Validation

Run these to confirm zero regressions:

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (includes the new `bun:test` reorder + origin-gate suites)
3. **Build**: `pnpm --filter @maude/site build` (+ the `apps/studio` bundle rebuild in Task 9)
4. **Dev-server smoke**: `/design:smoke` — no blank/unstyled canvases after the client changes
5. **Native shell E2E**: `desktop-e2e` scenario — Layers-tree drag reorder + in-canvas drag reorder both land the move and re-select the moved element (Layers tree lives in the native shell)
6. **Cross-platform scenario** (UI): `scenario-runner` on `web-desktop` (the only configured platform) — reorder via layer panel + via canvas
7. **A11y**: `a11y-auditor` — the Layers tree stays `role="tree"` keyboard-reachable; keyboard reorder (Alt+↑/↓) works and announces via `aria-live`; drop indicators are not the only signal
8. **Design consistency**: `design-system-guard` + `design:critic` (motion-critic for the insertion-line animation — within `motion.micro` 300ms, `prefers-reduced-motion` respected)
9. **Manual**: reparent into a different container; attempt an illegal move (into own descendant / void element) and confirm a clean refusal (no file corruption); undo a reorder via `/design:rollback`; reorder an element that has a `data-dc-element` and confirm selection survives the id churn.

---

## Scenario Coverage (UI — required)

**New scenarios to create:**

- `layers-reorder` — flow: open a canvas → open Inspector → Layers tab → drag a row above a sibling → assert new DOM order + selection on moved element → Alt+↓ keyboard-reorder → undo via rollback. Persona: designer. Fixtures: an existing multi-element UI canvas (e.g. `.design/ui/Onboarding.tsx`).
- `canvas-reorder` — flow: select an element on the canvas → modifier-drag above another element → assert insertion line + drop → source reorder + re-selection. Persona: designer.

`/flow:done` runs `scenario-runner` on `web-desktop`; `desktop-e2e` covers the native shell.

---

## Acceptance Criteria

- [ ] All tasks completed; Milestone A shippable independently of Milestone B
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Static (lint) + `pnpm test && pnpm test:dev-server` (reorder unit + origin-gate)
  - [ ] Build + committed `dist/client.bundle.js` rebuilt `--release`
  - [ ] `scenario-runner` 0 blockers on `web-desktop`
  - [ ] `desktop-e2e`: both reorder scenarios green
  - [ ] `a11y-auditor`: 0 blockers (keyboard reorder + tree semantics)
  - [ ] `design-system-guard` + motion-critic: 0 blockers
- [ ] `moveElement` never writes a corrupt file (post-move re-parse gate); all guardrail refusals throw cleanly
- [ ] Selection re-settles correctly after id churn (`movedId → data-dc-element → jsxPath`)
- [ ] DDR-138 recorded; `phase-12.1` archived + roadmap regen (`pnpm --filter @maude/site gen:roadmap`) committed
- [ ] Pending "What's New" entry appended
- [ ] No regression to Phase 12 click-to-select / CSS / text-edit paths
