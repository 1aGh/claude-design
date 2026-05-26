# Workflow State

> Schema + rules live in `.claude/skills/workflow-state/SKILL.md`.

**Workflow:** feature-delivery — Maude v1.0 roadmap
**Phase:** —
**Status:** done — phase-20-canvas-undo-redo shipped 2026-05-26
**Started:** 2026-05-26
**Updated:** 2026-05-26
**Active task:** —
**Active plan:** —

## History

| Date | Phase | Status | Note |
| ---- | ----- | ------ | ---- |
| 2026-05-26 | canvas-figjam-feel | done | Wave 1+2+3 (T1–T33) + Wave 2.7/3.5/3.6 user-feedback batches. Commit `8654dab` (+2293/-89 across 23 files). Scenario 9/9 PASS web-desktop; design-system-guard / a11y-auditor / security-auditor: 0 blockers each, 11 polish warnings deferred to Wave 3.7. Plan archived. |
| 2026-05-26 | phase-20-canvas-undo-redo | done | T1–T16 complete (T10 Comments deferred per plan as v0.x follow-up). 452/452 bun tests green (+43 new). Release bundle 230 KB → **72.4 KB gz** (under 80 KB budget). DDR-049 written, plan archived. |

## Execution Progress — phase-20-canvas-undo-redo (2026-05-26)

- ✅ T1 — `undo-stack.ts` pure reducer + types + selectors. Ring-cap 50, branch-discard on push. 9 bun tests.
- ✅ T2 — `use-undo-stack.tsx` React Context Provider; ref-as-authoritative-store so async runner sees its own writes synchronously between Cmd+Z key-repeats. SSR-capture pattern + serialized inFlight promise chain. 7 contract tests.
- ✅ T3 — `input-router.tsx` `classify()` extended with `{ kind: 'undo' | 'redo' }`. Cmd+Z / Cmd+Shift+Z / Ctrl+Y / Cmd+Y. Alt-modifier guard (Cmd+Opt+Z stays browser-native). 9 new classify tests.
- ✅ T4 — `RouterCallbacks.onUndo / onRedo` + preventDefault dispatch.
- ✅ T5 — `commands/move-artboards-command.ts` — full-snapshot before/after (matches PATCH `/_api/canvas-meta` shallow-merge shape, see DDR-027). Deep-cloned + label override. `diffLayoutPositions` helper for no-op skip. 11 tests.
- ✅ T6 — `canvas-lib.tsx` `commitArtboardPositions` routes through `undoStack.push(createMoveArtboardsCommand(...))`. `UndoStackProvider` mounted at `DesignCanvas` (one level above `DesignCanvasInner`) so the commit path + the shell tree share one per-iframe context. No-op skip via `diffLayoutPositions`.
- ✅ T7 — Marquee batch drag already routes through `useArtboardDrag` → `dragBus.commitPositions` → T6 path. Single command per gesture (leader + followers in one snapshot pair).
- ✅ T8 — `commands/equal-spacing-command.ts` — label helpers only (`equalSpacingLabel` / `alignLabel`). `DragStateBus.commitPositions` extended with `opts.label`. Distribute + align now read as `Undo: equal-space N artboards` / `Undo: align left N artboards`.
- ✅ T9 — `commands/annotation-strokes-command.ts` + layer wiring. `commitStrokes(prev, next, label?)` helper cancels pending debounce timer THEN pushes command (DDR-049 gotcha). Per-stroke granularity (no coalesce window — matches Figma). All 4 inline `setStrokesState` mutator sites (setStrokes, updateStroke, deleteStrokes, translateStrokes, eraseAt, endStroke, commitText) now route through commitStrokes. 7 tests.
- ⊘ T10 — Comments **deferred per plan recommendation**. Server has `commentsDelete` API but full undo for `commentsPatch` needs CRDT-shaped author/timestamp reconciliation. Follow-up issue.
- ✅ T11 — `undo-hud.tsx` minimal top-right aria-live="polite" toast. 1.2 s auto-dismiss; `pointer-events: none`; `--dur-fast` / `--dur-base` fade tokens; `prefers-reduced-motion` 1 ms collapse.
- ✅ T12 — `canvas-shell.tsx` `<UndoHud />` mounted in `CanvasRouter` render tree; `useInputRouter` callbacks wire `onUndo`/`onRedo` to `undoStack.undo()`/`.redo()`. Provider scope decision (per DDR-049): mounted at `DesignCanvas` (T6) instead of inside CanvasShell — eliminates the postMessage forwarding path the plan considered, since input-router listens on `document` inside the iframe.
- ✅ T13 — External-edit invalidation. `patchCanvasMeta` stamps `window.__maude_last_meta_self_write_at = Date.now()` before fetch. `client/hmr.mjs` forwards `fs:json` events for `*.meta.json` matching `data-canvas-path` into iframes as `CustomEvent('maude:invalidate-undo')`. Provider listens, dampens within 500 ms self-echo window, clears stack with `"Edit history reset (external change)"` label otherwise.
- ✅ T14 — `.ai/decisions/DDR-049-canvas-undo-redo-command-stack.md` written. 7 rules: command-pattern, per-iframe scope, viewport+selection NOT undoable, Phase-8 Y.UndoManager interface freeze, depth-cap 50, external-edit clear (not merge), comments out of v0.
- ✅ T15 — `bun test` 452/452 green (baseline 409 + 43 new). `bunx tsc --noEmit` clean modulo baseline `api.ts`/`runtime-bundle.ts` errors per DDR-026. Release build `bun run build.ts --release` → client.bundle.js 230 KB raw / **72.4 KB gzipped** (under 80 KB plan budget).
- ✅ T16 — `plugins/design/commands/help.md` got a Canvas keyboard shortcuts table (V/H/C/B/R/O/A/E + Esc + Cmd+Z / Cmd+Shift+Z + zoom + Shift+P).

**Files added (9):**
- `plugins/design/dev-server/undo-stack.ts`
- `plugins/design/dev-server/use-undo-stack.tsx`
- `plugins/design/dev-server/undo-hud.tsx`
- `plugins/design/dev-server/commands/move-artboards-command.ts`
- `plugins/design/dev-server/commands/annotation-strokes-command.ts`
- `plugins/design/dev-server/commands/equal-spacing-command.ts`
- `plugins/design/dev-server/test/undo-stack.test.ts`
- `plugins/design/dev-server/test/use-undo-stack.test.tsx`
- `plugins/design/dev-server/test/move-artboards-command.test.ts`
- `plugins/design/dev-server/test/annotation-strokes-command.test.ts`
- `.ai/decisions/DDR-049-canvas-undo-redo-command-stack.md`

**Files modified (6):**
- `plugins/design/dev-server/input-router.tsx` (classify undo/redo, callbacks)
- `plugins/design/dev-server/canvas-lib.tsx` (UndoStackProvider mount, commitArtboardPositions wraps in command, self-echo stamp)
- `plugins/design/dev-server/canvas-shell.tsx` (UndoHud mount, onUndo/onRedo wire, align/distribute label override)
- `plugins/design/dev-server/annotations-layer.tsx` (commitStrokes helper replaces scheduleSave path through 4 mutator surfaces)
- `plugins/design/dev-server/client/hmr.mjs` (fs:json forward to iframes)
- `plugins/design/dev-server/test/input-router.test.ts` (9 new undo/redo classify tests)
- `plugins/design/commands/help.md` (shortcut cheat-sheet)

**Smoke gate (per executor protocol, dev-server diff trigger):** `bash plugins/design/dev-server/bin/smoke.sh --out-dir .design/_history/_smoke/phase-20` — 42/42 OK exit-0. **Caveat:** the script's URL construction hits `/<canvas-path>` directly which returns 404 (the actual canvas route is `/_canvas-shell.html?canvas=...`). Same false-positive shape in the wave-1 baseline (`canvas-figjam-feel-wave-1/ui-canvas_viewport.png`) — pre-existing smoke.sh bug, not a phase-20 regression. Tracked for separate fix.

## Execution Progress — canvas-figjam-feel (Wave 3, 2026-05-26)

- ✅ T25 — Centralized `DRAG_THRESHOLD_PX = 4` + `crossedDragThreshold` helper in `input-router.tsx`; consumers (`use-artboard-drag`, `artboard-marquee`, `annotations-layer`) all import from there. 6 new bun tests cover boundary + diagonal + negative-delta cases.
- ✅ T26 — `marquee-overlay.tsx` (ElementMarqueeOverlay) — drag from empty body padding inside an artboard lassos `[data-cd-id]` elements. Aseprite modifier vocab (bare=replace, Shift=add, Alt=subtract, Shift+Alt=intersect) evaluated at pointerup so user can flip mid-drag. Mounted in CanvasRouter. 12 new tests (modeOf table + applyMarqueeMode set algebra incl. subtract/intersect identity).
- ✅ T27 — `equal-spacing-detector.ts` (pure 3+ rect distributed-spacing check, both axes, configurable tolerance) + `equal-spacing-handles.tsx` (pink-dot #FF24BD overlay with mid-span gap pills, hover-gated within union bbox + 40 px padding, prefers-reduced-motion honored). 10 detector tests.
- ✅ T28 — `use-cursor-modifiers.tsx` tracks Alt/Shift/Meta as `data-mod-*` on the canvas host. CSS rules flip cursor to `copy` on `[data-cd-id]` / `[data-dc-screen]` when Alt+move-tool, `crosshair` on `.dc-artboard-body` when Shift+move-tool. Reads pointermove modifier state too (handles modifier-press-outside-window). 8 reducer tests.
- ✅ T29 — `use-keyboard-discipline.tsx`: Arrow nudge (1 px) + Shift+Arrow (10 px) on selected artboards via `dragBus.commitPositions`; Cmd+A selects all stamped elements in active artboard. Element-level nudge + Cmd+D duplicate deferred — no live transform / duplicate channel yet (documented in file header). 3 nudgeDelta tests.

**Validation so far:** 409/409 bun tests green (pre-Wave-3 baseline + 39 new across T25–T29). `bunx tsc --noEmit` clean modulo the pre-existing `api.ts` + `runtime-bundle.ts` baseline errors per DDR-026.

**Files added (9):**
- `plugins/design/dev-server/marquee-overlay.tsx`
- `plugins/design/dev-server/equal-spacing-detector.ts`
- `plugins/design/dev-server/equal-spacing-handles.tsx`
- `plugins/design/dev-server/use-cursor-modifiers.tsx`
- `plugins/design/dev-server/use-keyboard-discipline.tsx`
- `plugins/design/dev-server/test/marquee-overlay.test.ts`
- `plugins/design/dev-server/test/equal-spacing-detector.test.ts`
- `plugins/design/dev-server/test/use-cursor-modifiers.test.ts`
- `plugins/design/dev-server/test/use-keyboard-discipline.test.ts`

**Files modified (6):**
- `plugins/design/dev-server/input-router.tsx` (+ matching test)
- `plugins/design/dev-server/use-artboard-drag.tsx`
- `plugins/design/dev-server/artboard-marquee.tsx`
- `plugins/design/dev-server/annotations-layer.tsx`
- `plugins/design/dev-server/canvas-shell.tsx` (overlay mounts + hook wiring)

**Completed after resume (T31 → T32 → T33 → T30):**

- ✅ T31 — `data-cv-zoom-lod` attribute on `.dc-canvas` driven by `artboardsCtx?.viewport?.zoom` (settle-cadence, not per-frame). CSS rules in `HALO_CSS` hide ticks + distance pills + active-artboard ring below 0.35 zoom; `font-smooth` sharpening above 4.0.
- ✅ T32 — `onWheel` in `canvas-lib.tsx` clamps `deltaY` to `[−50, 50]` before the exp() zoom-rate in the `ctrlKey || metaKey` branch. Brings trackpad-pinch (small deltas) and mouse-wheel (±100 notch) onto the same perceived-speed curve. Bare two-finger trackpad pan unaffected (no clamp).
- ✅ T33 — `fit()` / `reset()` now route through the existing `animateTo` (200 ms cubic ease-out, honors `prefers-reduced-motion` → instant). New double-click handler in CanvasRouter: dblclick on `[data-dc-screen]` chrome → `controller.jumpTo(rect)` for that artboard; dblclick on empty world → `controller.fit()`. Bails on floating chrome (`.dc-mm`, `.dc-zoom-tb`, `.dc-tool-palette`, `.dc-context-menu`, annotation surfaces, comment surfaces) AND on artboard body content with `data-cd-id` (preserves native dblclick text-select / link behavior).
- ✅ T30 (G_S1 collapse) — `annotations-context-toolbar.tsx` swatch row collapsed: when `caps.fill` is true the toolbar now shows a `Stroke | Fill` segmented toggle + ONE swatch row that switches palette by mode. Cuts ~7 controls. Default mode = `stroke`; toggle hides when caps.fill is false (pen / arrow). Delete moved to right-side overflow via `margin-left: auto` on `.dc-annot-ctx-overflow`.
- ✅ T30 (new ContextualToolbar) — new `contextual-toolbar.tsx` selection-anchored floating chrome for ELEMENT selections (entries with `data-cd-id`). Anchored above the union bbox (flip-below when top < 60 px), same chrome idiom as `MultiArtboardToolbar`. Actions: Copy CSS (selector), Copy ID (data-cd-id), Comment (postMessage `dgn: 'comment-compose'`). Auto-hides when only artboards or only annotations are selected (those have their own toolbars). Mounted in `CanvasRouter` alongside `EqualSpacingHandles` and `MultiArtboardToolbar`.

**Final validation:**
- **409/409 bun tests green** (baseline 370 + 39 new for Wave 3 across T25–T29; T30–T33 verified via typecheck + build smoke since they're DOM-bound).
- `bunx tsc --noEmit` — only pre-existing baseline errors in `api.ts` + `runtime-bundle.ts` per DDR-026.
- `bun run build.ts` — clean (`client.bundle.js` 3.55 MB, `styles.css` 56.7 KB, runtime/* 2.29 MB / 6 files).

**Files added in Wave 3 (10):**
- `plugins/design/dev-server/marquee-overlay.tsx` (T26)
- `plugins/design/dev-server/equal-spacing-detector.ts` (T27)
- `plugins/design/dev-server/equal-spacing-handles.tsx` (T27)
- `plugins/design/dev-server/use-cursor-modifiers.tsx` (T28)
- `plugins/design/dev-server/use-keyboard-discipline.tsx` (T29)
- `plugins/design/dev-server/contextual-toolbar.tsx` (T30)
- `plugins/design/dev-server/test/marquee-overlay.test.ts`
- `plugins/design/dev-server/test/equal-spacing-detector.test.ts`
- `plugins/design/dev-server/test/use-cursor-modifiers.test.ts`
- `plugins/design/dev-server/test/use-keyboard-discipline.test.ts`

**Files modified in Wave 3 (8):**
- `plugins/design/dev-server/input-router.tsx` (+ matching test) — T25 canonical threshold + helper
- `plugins/design/dev-server/use-artboard-drag.tsx` — re-import threshold from input-router
- `plugins/design/dev-server/artboard-marquee.tsx` — re-import threshold
- `plugins/design/dev-server/annotations-layer.tsx` — `crossedDragThreshold` helper + Wave-2 lint sweep
- `plugins/design/dev-server/canvas-shell.tsx` — overlay mounts, hook wiring, LOD effect, dblclick zoom, CSS rules for LOD
- `plugins/design/dev-server/canvas-lib.tsx` — T32 wheel clamp + T33 fit/reset routed through animateTo
- `plugins/design/dev-server/annotations-context-toolbar.tsx` — T30 G_S1 collapse + Delete-to-overflow
- `dist/client.bundle.js` + `dist/styles.css` (rebuild output)

**Deferred from Wave 3 (documented in code):**
- T29 `Cmd+D` duplicate — no live duplicate channel for either artboards or stamped elements yet (would need source-TSX writeback or CSS-transform overlay). Header note in `use-keyboard-discipline.tsx`.
- T29 element-level Arrow nudge — same architectural reason; only artboard nudge ships.
- T30 ContextualToolbar `Duplicate` / `Delete` actions — same reason; v1 ships read-only (Copy CSS / Copy ID / Comment).
- T28 Alt-drag-duplicates affordance — cursor flips to `copy` (preview), but actual drag-duplicate logic isn't wired. Header note in `use-cursor-modifiers.tsx`.

## Execution Progress — canvas-figjam-feel (Wave 3.5 post-review fixes, 2026-05-26)

User-side review of Wave 3 surfaced 7 grievances; all addressed:

- ✅ **G1** — Click-on-empty deselect re-enabled. Reverts Wave-2.7 fix #1: a bare click on empty world (annotations marquee path) now clears annotation selection; bare click on empty world outside any artboard (artboard-marquee path) clears element/artboard selection. Shift-click preserves selection for additive workflows. Esc remains as the secondary deselect gesture.
- ✅ **G2** — Dropped dblclick-on-artboard auto-zoom. T33's artboard zoom-to was too magnetic and conflicted with native dblclick text-select inside chrome. Kept dblclick-on-empty → `controller.fit()` (discoverable "back to overview"); artboard zoom remains reachable via Cmd+1 + zoom HUD.
- ✅ **G3** — ContextualToolbar Comment button now opens the composer. Old code only posted `dgn: 'comment-compose'` to the parent; the actual composer listens on the iframe-level `cm:open-composer` CustomEvent. Toolbar now dispatches that event with cursor coords derived from the selected element's bbox (right edge, vertical midpoint), so the composer lands beside the element rather than at viewport origin.
- ✅ **G4** — Comment composer position. `computeAnchor` in `comments-overlay.tsx` now prefers the cursor click point (composer drops 8 px below the cursor) over the element bottom-left anchor. The element-rect fallback survives for entry points without a cursor.
- ✅ **G5** — Annotation marquee no longer fires during artboard drag. The annotation-layer pointerdown handler now bails when pointerdown lands inside any `[data-dc-screen]` artboard without hitting an actual stroke — the artboard drag / element-marquee already own that gesture, so racing the annotation marquee against them was the source of the visual noise.
- ✅ **G6** — FigJam-style 11-color palette. Replaced the muddy 6-color stroke + 6-color fill palettes with a unified 11-color palette (black / gray / red / orange / yellow / green / teal / blue / purple / pink / white) used in both Stroke and Fill modes. Identical color identity across modes preserves the swatch row when the user flips the mode toggle.
- ✅ **G7** — Align commands. New `alignArtboards(mode)` in `canvas-shell.tsx` covers 6 modes (left / right / center-x / top / bottom / center-y). Enabled at ≥ 2 artboards (alignment well-defined). 6 new icon buttons added to `MultiArtboardToolbar` before the existing 2 distribute buttons, separated by a hairline divider. 6 new menu entries in the artboard-chrome context-menu registry as discoverability backup.

**Validation:**
- 409/409 bun tests still green.
- `bunx tsc --noEmit` clean (only the pre-existing api.ts / runtime-bundle.ts baseline errors).
- `bun run build.ts` clean.

**Files modified in Wave 3.5:**
- `plugins/design/dev-server/annotations-layer.tsx` — G1 + G5
- `plugins/design/dev-server/artboard-marquee.tsx` — G1
- `plugins/design/dev-server/canvas-shell.tsx` — G2 (dblclick scope) + G7 (alignArtboards + MultiArtboardToolbar align buttons + context-menu entries)
- `plugins/design/dev-server/annotations-context-toolbar.tsx` — G6 (palette swap)
- `plugins/design/dev-server/contextual-toolbar.tsx` — G3 (dispatch CustomEvent + bbox-derived anchor)
- `plugins/design/dev-server/comments-overlay.tsx` — G4 (`computeAnchor` cursor-first)

## Execution Progress — canvas-figjam-feel (Wave 3.6 user-feedback batch, 2026-05-26)

User retested after Wave 3.5, found 4 remaining issues:

- ✅ **G2v2** — Dropped `controller.jumpTo` from artboard label button onClick. Single-click on artboard chrome no longer auto-zooms. `fit-one` context-menu entry rewired through new `focusArtboard(id)` callback (looks up rect from artboardsCtx and calls jumpTo directly).
- ✅ **G6v3** — Reverted Thick from 10 → 6 (user feedback: too thick). Thin stays at 3. Thickness controls hidden when swatchMode = 'fill' (already shipped in G6v2).
- ✅ **G3v3 + G7v3 root cause (single shared bug):** the G1 fix re-enabled "click-on-empty clears selection" via the doc-level marquee `pointerup`-without-crossed handlers. But the marquee chrome filters (`shouldIgnoreTarget` in `artboard-marquee.tsx`, `isChromeTarget` in `marquee-overlay.tsx`, `CHROME_SELECTOR` in `annotations-layer.tsx`) didn't list the floating toolbar surfaces. When the user clicked any button on `MultiArtboardToolbar` or `ContextualToolbar` or `EqualSpacingHandles`:
  1. `pointerdown` lands on the button — marquee handlers see it, target NOT recognized as chrome → enter pending state.
  2. User releases without dragging → `pointerup` fires.
  3. `s.crossed === false` → my G1 path runs `selSet.clear()` BEFORE the button's `onClick` (synchronous DOM event order, capture phase doc listener fires first).
  4. Button `onClick` then runs `distributeArtboards()` / `alignArtboards()` / `openComposerForSelection()` — closure reads the just-cleared selection → bails on `< 3` / `!primary` guard.

  **Fix:** added `.dc-multi-artboard-tb, .dc-elem-ctx-tb, .dc-cv-eq-spacing-layer` (plus the previously-missing `.cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, .dc-annot-resize-handle` in annotations-layer) to all three chrome filters. Doc-level marquee bails when pointerdown lands on these surfaces, selection survives the click.

  **Live verified via agent-browser:** before fix — `pointerdown→pointerup→click` on Distribute H button leaves `haloCount: 0` (selection cleared). After fix — `haloCount: 3 → 3` (selection survives), distribute fires, artboard moves. G3 composer also renders at `(571, 79)`.

  **G1 still works:** clicking actual empty world (no artboard, no toolbar) → selSet cleared (`afterSelect: 2 → afterEmptyClick: 0` verified live).

**Bonus structural fix:** extended canvas-build mtime cache invalidation to watch the entire dev-server source tree (not just `_lib/canvas-lib.tsx`). Without this, edits to `canvas-shell.tsx`, `contextual-toolbar.tsx`, etc. don't surface to canvas iframes — the stale-bundle behaviour that masked half of G3/G7 debugging. Recursive `fs.watch` over `DEV_SERVER_ROOT`, filtered to `.tsx` (server-only `.ts` skipped — doesn't bundle into canvas), excluding `test/`, `dist/`, `client/`.

**Validation:**
- 409/409 bun tests green
- `bunx tsc --noEmit` clean (DDR-026 baseline only)
- agent-browser live tests on `localhost:4555` Canvas Viewport: G2v2 (no zoom on label click) + G3 (Comment composer renders) + G7 (selection survives toolbar button click + distribute moves artboards) + G1-regression-check (empty-world click still clears) all pass.

**Files modified in Wave 3.6:**
- `plugins/design/dev-server/canvas-lib.tsx` — G2v2 (label button no longer wires jumpTo)
- `plugins/design/dev-server/canvas-shell.tsx` — G2v2 (focusArtboard callback in registry, fit-one menu rewire)
- `plugins/design/dev-server/annotations-layer.tsx` — G6v3 (thick 10→6) + chrome filter expansion
- `plugins/design/dev-server/annotations-context-toolbar.tsx` — G6v3 (thick 10→6 label + value)
- `plugins/design/dev-server/artboard-marquee.tsx` — chrome filter expansion (toolbar surfaces)
- `plugins/design/dev-server/marquee-overlay.tsx` — chrome filter expansion
- `plugins/design/dev-server/http.ts` — recursive `fs.watch` for dev-server source tree

**Next step:** `/flow:done` (full `/validate` → commit → PR) — or first run the design-critic panel + smoke screenshots so the user-side review pass per plan acceptance criteria is recorded.



**Rebase note (2026-05-26):** User landed 4 commits during pause (`6427f3b` release v0.19.1, `311e0db` phase-d plan, `93e2f02` stats.json, `3a77ee1` biome lint sweep on Wave 2 — touched annotations-context-toolbar etc.). Working tree absorbed cleanly; all Wave 3 mods + new files survived. Stale `UU` index markers on `package.json` / `pnpm-lock.yaml` cleared after first `git status` re-read; no conflict markers present.



## Execution Progress — canvas-figjam-feel (Wave 1)

- ✅ Task 1 — DDR-046: 3-state halo language
- ✅ Task 2 — Refactor HALO_CSS to 3-state language
- ✅ Task 3 — SelectionHalos: append 4 corner ticks (single-vs-multi class swap)
- ✅ Task 4 — SnapGuide.delta + .kind + bun:test (6 fixtures, 359/359 green)
- ✅ Task 5 — `--guide-magenta` token + SnapGuideOverlay color routing (2 px width)
- ✅ Task 6 — DistancePill `Δ{N}` mid-span callout
- ✅ Task 7 — Spawn-fade animation + prefers-reduced-motion
- ✅ Task 8 — Mini-map polish (--bg-0 body, filled viewport, ambient shadow)
- ✅ Task 9 — Drop brutalist shadow on floating chrome (tool-palette, context-menu, export-dialog, annotation chrome)
- ✅ Task 10 — Tool palette active state: 14% tint + 2 px accent underbar
- ✅ Task 11 — Active-artboard ring outside drop-shadow + 120 ms transition
- ✅ Task 12 — BrandWordmark watermark top-left of canvas

## Execution Progress — canvas-figjam-feel (Wave 2, 2026-05-26)

- ✅ Task 13 — Removed BrandWordmark + CSS + empty-state rule (G9)
- ✅ Task 14 — DDR-046 rev 2: dashed = canonical group-container signal; rev-1 "dashed reserved for none" rejected in Alternatives
- ✅ Task 15 — Artboard frame quieted: 22 %-tinted hairline, no box-shadow; active ring → simple 2 px accent (G7)
- ✅ Task 16 — Multi-select chrome: member halo 1.5 px solid full accent + group bbox 1 px dashed + 6×6 corner ticks (G1)
- ✅ Task 17 — Annotation halo parity: SVG single-select gets 2 px solid + 4 px 18 % ring + 4 corner ticks; multi member 1.5 px solid + dashed group bbox via new `AnnotGroupBbox` (G3)
- ✅ Task 18 — `endStroke` auto-selects committed shape + flips tool to Move (unless sticky / eraser) (G2)
- ✅ Task 19 — Sticky-tool lock: `useToolMode` carries `sticky: { tool, locked }` + `toggleSticky` + `clearSticky`; double-click on draw tool toggles; lock badge fades in; Esc clears
- ✅ Task 20 — Stroke weight on rect + ellipse: `supportsThickness` + `caps.thickness` + `setThickness` all broaden to rect/ellipse (G5)
- ✅ Task 21 — Esc-to-cancel-mid-stroke: `cancelStroke` resets `drawing=null`; canvas-shell dispatches `maude:cancel-stroke` event from `onEscape` (G_S5)
- ✅ Task 22 — Per-tool SVG cursors: `--cursor-pen/rect/ellipse/arrow/eraser/comment` data-URI vars with hotspots, replacing `cursor: crosshair !important` blanket (G6)
- ✅ Task 23 — Annotation resize handles: new `use-annotation-resize.tsx` with `AnnotationResizeOverlay`; 4 corner handles for rect/ellipse/pen + 2 endpoint handles for arrow; screen-space fixed divs sibling to canvas (G4)
- ✅ Task 24 — Distribute artboards horizontally / vertically: gated on ≥ 3 selected artboards; menu items in `artboard-chrome` registry + `⌘⌥H` / `⌘⌥V` keybinds; reuses existing `dragBus.commitPositions` persistence channel. (Artboard marquee deferred to Wave 3 / T26 coupling.) (G8)
- ✅ Wave 2.7 (post-user-review batch, 2026-05-26) — three coordinated fixes from second feedback round:
  1. **No auto-clear on empty-space click.** `onSelect` no-target path, annotation-layer empty-world up-click, and `artboard-marquee` threshold-cross all stripped of their `selSet.clear()` / `annotSel.clear()` calls. Marquee with zero hits preserves existing selection. Esc remains the single deselect gesture across elements / artboards / annotations.
  2. **Direct artboard drag, no ghost.** Dropped `.dc-artboard-ghost` rendering + `.dc-dragging` opacity-0.3 fade. The `<article>` now updates its own inline `left/top` to `liveX/liveY` each frame while the drag is in flight; commit-on-settle path unchanged. Removed the `dc-dragging` halo / group-bbox hide guards added in the prior fix — they're unnecessary now that the halo follows the moving article via `getBoundingClientRect`.
  3. **Distribute floating toolbar + drop ⌘⌥H / ⌘⌥V keybinds.** New `MultiArtboardToolbar` mounted in `CanvasRouter`, anchored above the group-bbox top-center (flips below when top < 60 px from viewport edge). Renders when ≥ 2 artboards selected; Distribute H / V buttons enabled at ≥ 3 (math is undefined for 2). Floating chrome ambient shadow per DDR-046 (`0 6px 24px color-mix(--fg-0 10%, transparent)` + 8 px radius). Keybindy odstraněny per user feedback — toolbar je primární surface, kontext-menu zůstává jako discoverability backup.

- ✅ Task 24.6 (follow-up) — **Artboard marquee drag-to-lasso.** New `artboard-marquee.tsx` overlay mounted in `CanvasRouter`. Bare left-button pointerdown on empty world (no `[data-dc-screen]` ancestor, no floating chrome / overlay) in move tool starts a marquee. 4 px drag threshold suppresses click jitter (early portion of T25 Wave 3 logic landed locally to unblock T24). Bare-mode clears `selSet` up-front when threshold crosses (user sees "starting fresh"); Shift-mode preserves the set for add-to-selection. `pointermove` paints `.dc-cv-marquee` div (1 px solid accent + 8 % accent fill per DDR-046 rev 2 — solid not dashed; dashed reserved for persistent group bbox). `pointerup` intersects marquee AABB with every artboard's screen-coord `getBoundingClientRect()`; hits build `Selection` entries with `artboardId` set + `[data-dc-screen="…"]` selector. Shift → `selSet.add(hits)`, bare → `selSet.replace(hits)`. With T24.5 chrome-click selection + this marquee gesture, the distribute commands now have both single-shot (Cmd+Shift+Click) and lasso entry paths.

- ✅ Task 24.5 (follow-up) — **Artboard chrome selection gesture.** Opened `resolveHoverTarget`: clicks on artboard chrome (label, header, article root) OR empty body padding return the `<article>` element with `cdId=null` and `artboardId` populated. `hoverTargetToSelection` falls back to `[data-dc-screen="…"]` selector when there's no `cdId`. Existing SelectionHalos/GroupBbox find the article via that selector and paint around the whole frame (single-select → 2 px solid + 18 % ring + 8×8 corner ticks; multi-member → 1.5 px solid; group bbox → 1 px dashed + 6×6 corner ticks). Active-artboard ring (`aria-current="true"` → 2 px box-shadow on article) stays orthogonal to selection halo — both can fire (active = "where viewport is parked", selected = "what I'm operating on"). Drag suppression from prior patch (`dc-dragging` guard) keeps the halo + group bbox hidden during artboard drag. Multi-artboard distribute (T24) now has a real gesture path: Cmd+Shift+Click on artboard chrome accumulates `selSet` entries with `artboardId` set, and the gate `selectedArtboardCount >= 3` becomes reachable. The previous T24 menu items were UI without a way to enter the precondition — this patch closes that gap.

**Validation:**
- 370/370 bun tests green (no new tests added in Wave 2 — visual / behavioral changes covered by manual confirmation + existing harnesses)
- `bun run build.ts` clean (client.bundle.js 3.55 MB, styles.css 56 KB)
- `bunx tsc --noEmit` — only pre-existing baseline errors in `api.ts` + `runtime-bundle.ts` (per DDR-026 baseline)

**Smoke gate (`/design:smoke`):** skipped — runs as part of the user's pre-Wave-3 review pass per plan pause point ("User confirms all 9 grievances + 3 second-order are visually resolved"). Diff touches dev-server source — render-shape check belongs to the user-driven review loop.

**New file:** `plugins/design/dev-server/use-annotation-resize.tsx` (T23). Files modified: `canvas-shell.tsx`, `canvas-lib.tsx`, `annotations-layer.tsx`, `annotations-context-toolbar.tsx`, `tool-palette.tsx`, `use-tool-mode.tsx`, `dist/client.bundle.js` (rebuild output), `.ai/decisions/DDR-046…md`.

**Pre-existing issue surfaced (Wave 1):** `bin/smoke.sh` hits `/ui/<canvas>.tsx` but server routes are mounted at `/.design/ui/<canvas>.tsx`. Smoke reports OK on 404-rendered "Not found" pages. Not a Wave 2 regression — pre-existing. Recommend fix in a separate task.

**Validation:**
- 359/359 bun tests green (351 baseline + 8 new snap-distance-pill)
- `bun run build.ts` clean
- `bun tsc --noEmit` — only pre-existing api.ts / runtime-bundle.ts errors (per DDR-026 baseline)
- Manual canvas-shell screenshot at `/tmp/canvas-viewport-wave1.png` confirms wordmark + ambient-shadow chrome renders

**Branch:** main (Phase 18 + Phase 19 committed + tagged v0.18.0)

### Phase 15.5 v2.1 — Marketing demo video (previous, done)

Below history preserved for context — moved to archive on next /flow:done.

---

## Execution Progress

### Active plan — phase-15.5-marketing-demo-video-30s.md (v2)

v1 shipped 48s + 26s cuts judged "nudné." v2 prep added benefit cards + Claude TUI + annotations + split-screen HMR. v2.1 refinements (after second feedback round):

1. **Single perfect cut** (no Cut B) — ~90 s, length flexible.
2. **Real maude in sandbox** — `/design:new` + `/design:edit` execute for real with split-screen capture (VHS Claude TUI ‖ Playwright dev-server iframe).
3. **`/design:setup-ds` dry-run only** — questionary kickoff captured, no completion.
4. **DS reused** from this repo's `.design/system/project/`.
5. **Visual verification loop** baked into Task 20 — per-scene intent checks + named affordance hard-checks + max-3 reshoots-per-scene.
6. **Copywriting voice-aligned** to site + `.design/system/project/README.md` § Voice. Captions + benefit cards rewritten. Two cards echo site copy verbatim ("Two plugins, one CLI, some vibes" + "No telemetry. No signup. No book a demo button.").

Preservation set (committed to git):
- `.ai/plans/phase-15.5-marketing-demo-video-30s.md` v2.1 — 24 tasks, single cut, split-screen real-exec.
- `scripts/video/storyboard.md` v2.1 — 16-scene table with intent checks + voice-aligned captions + voice-aligned card copy.
- `.ai/decisions/DDR-037-marketing-video-cut-a-cut-b.md` — v1 retro + v2 + v2.1 sections.
- `~/.claude/projects/-Volumes-D-git-claude-design/memory/feedback-marketing-video-production.md` — 10 cross-session rules.

To execute v2.1: `/flow:execute phase 15.5`.

### Previous plan — phase-15.1-video-pipeline-infrastructure.md (done)

- [x] T0: Gate — phase 15 smoke green
- [x] T1: Install Remotion Agent Skills globally (~/.claude/skills/remotion-best-practices/, 36 rules)
- [x] T2: Create nested scripts/video/final/ workspace (package.json + tsconfig + remotion.config + Root.tsx + lib/tokens + load-font + .npmrc + pnpm-workspace.yaml)
- [x] T3: Remove root-level Remotion devDeps + reroute smoke through nested workspace
- [x] T4: Cherry-pick TikTok captioning (Page.tsx + SubtitlePage.tsx + CaptionedClip.tsx wrapper + sub.mjs + whisper-config.mjs)
- [x] T5: Animation helpers re-export (lib/animated/ → remotion-bits + remotion-animated)
- [x] T6: Golden-frame regression harness (__tests__/frame-regression.test.ts + 6 baseline PNGs)
- [x] T7: CSS motion guard (scripts/check-css-motion.sh — Biome AST rule wasn't viable in 1.9.4, grep replacement)
- [x] T8: /flow:video-new-scene scaffolder (plugins/flow/commands/video-new-scene.md + CATEGORIES.md update)
- [x] T9: scripts/video/music/MANIFEST.md placeholder + curation guidelines (user opted-in placeholder, no curl)
- [SKIP] T10: GH Actions workflow (user explicitly opted out: "nechci zadny github actions")
- [x] T11: Banner injection into phase-15.5 plan referencing 15.1 infra (surgical only — user recently rewrote 15.5 task list, full task swaps deferred)
- [x] T12: scripts/video/README.md extended with Workspace layout + Adding a scene + Captions + Goldens + Music + CSS motion guard sections
- [x] T13: DDR-036 recorded — video pipeline infrastructure

### Previous plan — setup-ds-pastier-framework.md (done, archived)

- [x] T1: Archive current discovery as _DISCOVERY-v1.md
- [x] T2: Rewrite SKILL.md discovery section as 3-stage flow
- [x] T3: Create _pastier-probe-templates.md
- [x] T4: Update ux-research-agent.md (payload + agent prompt)
- [x] T5: Update setup-ds.md brief guidance
- [x] T6: Create DDR-033-three-stage-discovery.md
- [x] T7: Update feedback-design-bootstrap-workflow.md memory
- [x] T8: Update CLAUDE.md entry points
- [x] T9: Smoke test — 3-stage flow trace on 2 fictional briefs
- [x] T10: Rebrand critic panel output as 4 kola značky

## History

| Date | Phase | Status | Note |
| --- | --- | --- | --- |
| 2026-05-25 | feature-site-roadmap — public `/roadmap` timeline | done | Veřejná `/roadmap` route na `maude.iagh.cz` renderuje vertikální paper/phosphor timeline všech fází Maude — Shipped / In progress / Planned / Icebox. Dataset auto-generovaný z `.ai/plans/*.md` + `.ai/plans/archive/*.md` + `.ai/state/STATE.md` History (oba schema tvary `Date\|Phase\|Status\|Note` i starší `When\|Phase\|Note`) + `.ai/plans/README.md` execution-order tabulky přes `site/scripts/build-roadmap.mjs`. Output `site/lib/roadmap.json` committed (stejně jako `stats.json` — Vercel uploaduje jen `site/`). Komponenta `site/components/mdcc/roadmap-timeline.tsx` server-only, ASCII status glyfy `[x]/[~]/[ ]/[*]`, SKU stamp + per-row GitHub plan-file link, `.mdcc-roadmap-*` CSS bez glass/Lucide. Pipeline: `prebuild` + `predev` v `site/package.json` volá `gen:roadmap`. Nav link v `site/lib/layout.shared.tsx`; landing page `see the roadmap ->` link v katalog eyebrow. Auto-update mechanismus = pravidlo v `CLAUDE.md` § "Site roadmap regen" (kdykoliv se mění STATE.md History nebo `.ai/plans/`, spustit `pnpm --filter @maude/site gen:roadmap` a commitnout diff) + safety net v `.ai/release-guide.md`. Žádná modifikace `plugins/flow/commands/done.md` — user explicitně chtěl pravidlo v always-loaded souboru místo plugin-command hooku. Implementace v commitu `6188889` (2026-05-23); closeout (archive + History + roadmap.json regen — dataset 41 fází · 32 done · 8 planned · 1 icebox) 2026-05-25. Žádný nový npm dep, žádné DDR. **Retro lessons**: pattern lift z `build-stats.mjs` šel přesně podle plánu; auto-update přes CLAUDE.md pravidlo se osvědčil — load-bearing pravidlo v always-loaded souboru je robustnější než command hook protože nevyžaduje konkrétní entrypoint; icebox glyph drift `[❄]` → `[*]` (emoji nezapadalo do ASCII estetiky); T6 nav link skončil v `site/lib/layout.shared.tsx` ne v `(home)/layout.tsx` (Fumadocs home layout dělá nav přes shared config). |
| 2026-05-25 | Phase 19 — Dev-server first-boot bootstrap fixes | done | Closed the gap between npm install (`package.json#files` overrides .gitignore, so `dist/` + `node_modules/` ship) and marketplace cache install (`/plugin marketplace add 1aGh/maude` does a `git clone` that honors `.gitignore`, so both arrived empty). System-review source at `.ai/logs/system-reviews/maude-dev-server-bootstrap-review.md` (BAD-1/2/3 all one-line upstream fixes). Seven coordinated changes per DDR-044: (1) **Commit `dist/client.bundle.js` + `dist/styles.css` to git** (~270 KB) via `.gitignore` negation pattern; per-platform `maude-*` binaries (~70-120 MB each) stay ignored — they ship via `optionalDependencies` sub-packages per DDR-015. Mirrors `site/lib/roadmap.json` precedent. (2) **`build.ts:73-74` brittle path fixed** — was `../../../package.json` (resolved to monorepo root in dev, ENOENT'd in marketplace cache), now reads `plugins/design/.claude-plugin/plugin.json` via new `readPluginVersion()` helper with try/catch fallback to `version: 'dev'`. (3) **Boot-time self-heal in `server.ts`** — extracted to `boot-self-heal.ts` for testability. On startup, if `dist/client.bundle.js` or `node_modules/react/package.json` is missing, auto-runs `bun install --production` + `bun run build.ts` before writing `_server.json`. New `MAUDE_NO_AUTOBUILD=1` env flag opts out for read-only-filesystem deployments (server exits 1 with remediation message). React, react-dom, lightningcss, magic-string, oxc-parser moved from devDependencies → dependencies. 6/6 tests covering all branches (skip / install / build / order / opt-out / spawn-failure). (4) **`runtime-bundle.ts` Bun-cache error mapping** — new exported `bunCacheRemediation()` helper detects EISDIR/ENOENT on `~/.bun/install/cache/<pkg>@<version>/…`, strips subpath specifiers to base pkg (`react/jsx-runtime` → `bun pm cache rm react`), emits one-line actionable remediation appended to the original build log. 5/5 tests including case-insensitive match. (5) **`screenshot.sh` TSX rejection** — `file://*.tsx` exits 2 with hint pointing at `--port` (browsers can't compile JSX; dev-server's `_canvas-shell.html?canvas=<rel>` is the only working path). SKILL.md "Visual sanity" step rewritten for TSX-era: requires dev-server boot via `server-up.sh` first, includes degraded-mode warning for when boot fails. (6) **AskUserQuestion fallback documented** — new "Tool-availability check" callout in SKILL.md Discovery section with copy-paste numbered-prose templates for Stage 0 (single Q) and Stage 3 (N Qs in one batch with letter-coded options). setup-ds.md cross-references. (7) **Single-DS name-convention tension resolved** — new `name_source: "user" \| "default"` field on `vision-brief.json`; setup-ds.md warns when `<name>` matches repo basename (suggests `project` for `/design:edit` auto-detection) but honors user's choice; completeness-critic C2 dirname check reads `name_source` and never flags user-supplied names. Legacy briefs predating Phase 19 default to `"user"` (no false positives). Verification: 11/11 new tests + 351/351 dev-server tests pass; build.ts produces 229 KB minified bundle + 43 KB styles; live curl smoke against fresh `/tmp/maude-smoke` project returns 200 on `/_client/client.bundle.js`, `/_client/styles.css`, `/_canvas-runtime/react.js`, `/_canvas-runtime/react-dom_client.js`; opt-out path verified to enumerate both missing artifacts + their remediation commands. CLAUDE.md "Known issues" entry added with v0.18.0 pointer + retro reference. Changeset `phase-19-dev-server-bootstrap-fixes` minor authored. Plan archived. Released as v0.18.0. **Retro lessons** (in archived plan): DDR-034 was taken (jumped to DDR-044) — always grep `.ai/decisions/` for next free number; plan's Task 2(a) recommendation referenced a file that didn't exist (`plugins/design/package.json`) — switched to `plugins/design/.claude-plugin/plugin.json` on the fly; moving more deps than planned (lightningcss + magic-string + oxc-parser, not just react) because `bun install --production` needs them too; extracting `bootSelfHeal` to its own file was critical for testability — never test top-level-await modules by importing the whole server; marketplace-install simulation deserves CI coverage (currently manual). |
| 2026-05-25 | Phase 18 — Bias-free design plugin templates | done | Stripped every visual prior from `plugins/design/templates/` so `/design:setup-ds` no longer ships a "Linear-ish dark dashboard" opinion before discovery asks the user what they want. Three coordinated changes per DDR-043: (1) **Templates skeletonized** — every hardcoded numeric / curve / hue in `core/colors_and_type.css.tpl`, `README.philosophy.md.tpl`, `SKILL.md.tpl`, `canvas.tsx.template` is now a `{{placeholder}}` fed by the discovery payload (69 placeholders in the tokens CSS alone). Only `prefers-reduced-motion: reduce` 1ms collapse + token NAME contract stay hardcoded. (2) **Critic gates discovery-driven** — `design-system-completeness-critic` C7 (one-accent) + V2 (OKLCH-required) now read `config.accentStrategy` (default `single`) + `config.colorSpace` (default `oklch`) and gate accordingly; defaults preserve backwards-compat for downstream projects. (3) **CLI `--no-discovery` neutral** — `cli/commands/design.mjs:defaultPayload()` now emits achromatic grayscale + zero radii + no shadows + system fonts + graphite accent so the output looks "deliberately unfinished" and nudges designers toward `/design:setup-ds` instead of unconsciously shipping defaults. Smoke `/tmp/bias-test` scaffold confirmed 0 unsubstituted `{{...}}` + obviously-placeholder visual output. Also cleaned 7 inspiration specimens (`logo.html` `#ffffff` → tokens, `ui_kits-mobile-showcase.html` hardcoded body bg → `var(--bg-0)`, `colors-themes-side-by-side.html` inline OKLCH → cascade-driven, NOTES comments on presence/team-accent demos). New `accentStrategy` + `colorSpace` fields in `config.schema.json` + `config.json.tpl`; extended `ux-research-agent.md` `recommendations[]` with 8 structural decisions (accent_strategy / color_space / spacing_base / type_ratio / easing_personality / layout_max_w / radii_personality / shadow_strategy) inferred from `vision-brief.json` — no new user-facing questions needed. Updated CLAUDE.md "Design plugin" section with new contract. DDR-043 recorded (originally planned as DDR-026 but that number was already taken — grep `.ai/decisions/` for free number next time). Changeset `bias-free-design-plugin-templates` minor authored. 22 files in commit (3 new — DDR + changeset + plan-now-archived; 19 modified). T16 version bump (0.17.2 → 0.18.0) deferred to user — bumping triggers npm publish workflow. Plan archived with retro: audit-first sequencing (Task 0) caught two facts that would have broken the rest if missed (CLI substitution scope + defaultPayload as a bias source); backwards-compat-by-default on critic gates kept change zero-risk; end-to-end scratch scaffold was the single most valuable verification step. |
| 2026-05-25 | fix-binary-oxc-parser-binding (every v0.17.x binary crashed) | done | Bun 1.3.4 regressed `bun build --compile` NAPI native-binding embedding — every `@1agh/maude-<slug>` binary published since v0.17.0 crashed at `oxc-parser/src-js/bindings.js:575` on startup. 30-min spike bisected 1.3.3 last-good vs 1.3.4 first-bad and verified an env-var-based loader bypass (`NAPI_RS_NATIVE_LIBRARY_PATH` from a `with { type: 'file' }` asset import) works on 1.3.14. Fix is build-layer only: `build.ts:writeCompileEntry(target)` generates two thin files per `--target` (`init-oxc-<slug>.ts` leaf module + `server-<slug>.ts` entry) under `dist/.compile-entries/` and points `bun build --compile` at the generated entry instead of `server.ts`. Init module MUST be a separate file imported BEFORE server.ts — ESM hoists `import` statements above top-level code, so single-file pattern crashes (first generator pass had this bug, caught in T3 first smoke; T5 test asserts `initIdx < serverIdx` so the class is gated). All 7 `@oxc-parser/binding-<slug>` packages added as direct devDeps of `plugins/design/dev-server/` (pnpm otherwise hides them as transitive optionals inside oxc-parser's nested node_modules). Maude-slug→oxc-slug mapping mirrored in `oxcBindingSlug()` + the regression test: Linux gets `-gnu` libc suffix, Windows gets `-msvc` toolchain suffix, others unchanged. Zero edits to `canvas-pipeline.ts` / `canvas-edit.ts` / `canvas-lib-inline.ts` / `handoff.ts` — pipeline files don't know the workaround exists. Verified end-to-end: host binary on Bun 1.3.3 + 1.3.14 starts, `/_health` returns ok, banner prints. Cross-compiled 5 non-host targets (linux-x64 / linux-arm64 / linux-x64-musl / linux-arm64-musl / win32-x64) — all produce binaries with correct executable headers (`file` reports ELF + PE32+). `bun test` 340/340 across 42 files (+6 over 334 baseline). DDR-042 records the spike, options matrix (parser-swap rejected, subprocess rejected, external+ship rejected, version-pin rejected), env-var pattern, ESM hoisting trap, distribution constraint. Upstream Bun issue draft at `.ai/dev-logs/upstream-bun-issue-draft.md` for user to file. Changeset `fix-bun-compile-napi-embedding` patch authored. Plan archived. Retro appended: spike was the right detour (saved 1-2 days of wrong babel migration); first-cut generator put env-var in top-level code (ESM hoisting bug), caught at T3 smoke. |
| 2026-05-20 | Phase 15.5 v2.1 — Marketing demo video (real maude in sandbox, single cut) | done | 24/24 tasks complete. Single perfect cut at `site/public/demo.mp4` — 84.5 s · 1920×1080 · h264 · CRF 23 · 6.0 MB (cap 16 MB) · loudness −18.08 LUFS (target −18). 16 scenes with 15 xfades: intro · install (`bun add -g` real VHS) · `/design:setup-ds` TUI dry-run (real Stage 1 prose rendering) · DS reveal (4 specimens via Playwright tree-nav at localhost:4400) · 4 `<BenefitCard>` (local-figma / all-in-one / human-ai / your-repo — copy lifted verbatim from `site/app/(home)/page.tsx` + `.design/system/project/README.md`) · 2 `<SplitScreenFrame>` composites (tui-new + tui-edit, VHS-TUI on left + Playwright dev-server iframe on right, 1 px DS-rule between halves, TUI/DEV-SERVER corner labels) · canvas-reveal · canvas-hero · comments · annotations · docs (smooth-scroll maude.iagh.cz) · outro. **Real maude in sandbox** — scratch at `/private/tmp/scratch-maude-demo-20260520/`, `maude init --name recipe-recap` ran for real, `.design/system/project/` (100 specimens) copied verbatim from this repo, scratch dev-server on port 4400 via new `scripts/video/final/lib/server-up.sh` wrapper (idempotent — reuses live server if project name matches; respawns otherwise). `/design:new --no-critic "Recipe Recap" "Multi-artboard hero + portion scaler + ingredient list + cookbook print preview"` ran for real (decoupled `claude -p` subprocess, not inside VHS — VHS pty kill would abort the skill mid-execution); completed at T+352 s and wrote a 620-line Recipe Recap.tsx with 4 artboards anchored on a real Onion Soup Gratinée recipe (no placeholder copy). `/design:edit "tighten the hero, drop one row from the metadata block"` completed at T+97 s with the file shrinking 620 → 619 lines (one row removed as instructed). Two real packaging bugs surfaced in published v0.16.0: (a) `bun add -g` doesn't fire the postinstall side-channel writer (so `cli/.platform-binary-path` stays empty); (b) `magic-string` is in `plugins/design/dev-server/package.json` devDependencies only, not in published runtime deps — `maude design serve` crashes on its missing import. Workaround shipped (drop `maude design serve` line from install tape); both bugs deserve dedicated follow-up PR + DDR. New files: `scripts/video/final/lib/server-up.sh` · `scripts/video/final/src/scenes/05-benefit-card/` · `scripts/video/final/src/scenes/06-split-screen/` · 4 VHS tapes · 8 Playwright specs · `scripts/check-publish-size.sh` · `site/components/mdcc/demo-video.tsx` · `site/public/{demo.mp4, demo-poster.jpg}`. Extended `<TerminalFrame>` + `<BrowserChrome>` with `playbackRate`/`startFrom`/`endAt`/`transparentBackdrop` passthroughs. `Final` composition rewritten end-to-end (354 → 2535 frames). Site landing-page embed under `<DemoVideo>` between install snippet and catalog. README inline `<video>` tag pointing at `https://github.com/1aGh/maude/releases/download/v0.16.0/demo.mp4` (live the moment user uploads). `npm pack --dry-run` clean (1.04 MB, no `scripts/video/` or `site/public/` leakage). Visual verification loop (Task 20) read every QA frame + spot-checked all 4 cards + outro + caption overlays. Lint clean on changed files (3 pre-existing warnings in `plugins/design/dev-server/` unrelated to phase). All 293 dev-server `bun test` pass. Site `next build` PASS (53 docs pages prerender). DDR-037 v2.1 execution log appended with 11 production lessons + final cut metrics + per-scene `startFrom` calibration table + 2-bug packaging followup list. Retro appended to plan. Plan archived. **Stopped before `gh release create`** per user policy — user uploads `site/public/demo.mp4` to v0.16.0 GitHub release manually. No changeset authored (override reason: marketing artifact, no published-package surface changed; recorded in /done changelog dispatch). |
| 2026-05-20 | Phase 15.1 — Video pipeline infrastructure | done | Nested Remotion workspace at `scripts/video/final/` (own package.json + tsconfig + remotion.config + pnpm-workspace.yaml for esbuild allowlist). Root devDeps shrunk by ~1500 lockfile lines (Remotion + React out of root). Cherry-picked TikTok captioning components (Page.tsx + SubtitlePage.tsx + CaptionedClip wrapper + sub.mjs Whisper.cpp build-time pipeline + whisper-config.mjs). Animation libs (`remotion-bits` + `remotion-animated`) re-exported through `lib/animated/`. Reusable capture wrappers (`<TerminalFrame>` + `<BrowserChrome>`) in `lib/capture-frames/`. Golden-frame regression harness (`renderStill` + `pixelmatch` + 18 baseline PNGs across 6 compositions × 3 frames). LowerThird caption strip. CSS motion guard (`check-css-motion.sh` — Biome 1.9.4 lacks AST selectors). VHS tape discipline guard (`check-tape-discipline.sh`) + canonical `_TEMPLATE.tape` (1280×720 canvas + Hide+clear+Show pattern). Visual QA helper (`pnpm run qa` → 12 frames + 4×3 contact sheet, agent-readable paths + human-eyeballable PNG). `/flow:video-new-scene` scaffolder command. Music manifest scaffold. Demo (synthetic) + DemoCaptioned (TikTok-style word-by-word with hand-crafted JSON) + Final (real VHS terminal + real Playwright browser + LowerThird + audio + xfades) compositions all rendering clean end-to-end. Real assembly produced final.normalized.mp4 (11.9s, 1920×1080, h264+aac, loudnorm I=-18 LUFS). DDR-036 records all decisions + 3 production gotchas ("Lessons from first real assembly"): VHS Hide doesn't clear shell buffer, Playwright viewport mismatch bakes empty bg, per-scene goldens cannot regress capture-driven scenes (two-tier verification). Visual QA workflow committed as **mandatory before delivery** per render → QA → deliver discipline. Remotion Agent Skills installed globally to `~/.claude/skills/remotion-best-practices/` (36 rule files, MIT). SKIP: GitHub Actions video-render workflow (user opted out: "nechci zadny github actions"). Plan archived. Phase 15.5 inherits infra via banner. |
| 2026-05-20 | Setup-DS — 3-stage discovery (Pastier-inspired) | done | `/design:setup-ds` discovery rewritten from v1 12-Q fixed dotazník to 3-stage Vision → Research → Refinement (DDR-033). Stage 0 single scope picker (market / internal / personal / oss) drives Stage 1 wording + post-scaffold aspiration target. Stage 1 = 11 plain-prose free-text prompts in 3 batches (PŘÍPRAVA 4 · PROSTOR 3 · DUŠE 4), NOT AskUserQuestion — the tool's min-2-options + auto-Other affordance is schema-enforced and can't deliver free-text-with-skip UX (DF-4 / DF-7 deep research). Output = rich `vision-brief.json` (11 fields). Stage 2 = `ux-research-agent` receives the full vision-brief (not a one-liner — single biggest aesthetic-quality lever per DF-9) and returns the existing `discovery` payload plus a new `recommendations` block with `{recommendation, alternatives[], confidence, rationale}` per design decision (palette / typography / signature_treatment / majak_3_codes / density / voice). Pastier's 7 chapters live in 5 input-field-driven probe templates at `_pastier-probe-templates.md` (A. Ulice / B. Zrcadlo+Charakter / C. OST / D. Kmen / E. Confidence). Stage 3 = adaptive 0–N AskUserQuestion picks driven by confidence — `≥ 0.85` SKIP / `0.60–0.85` ASK with pre-pick / `< 0.60` ASK without pre-pick. **Zero hardcoded fallback ladders** — if research fails entirely, flow STOPS (re-run / abort), no degradation. Maják 3-code combination always a Stage 3 Q. Smoke trace (2 fictional briefs) validated rich = 2 Stage-3 Qs, sparse = 6–7 Stage-3 Qs — matches plan dogfood expectations (DF-11). Critic panel reporting block rebranded as "4 kola značky" — Kolo 1 Srozumitelnost (completeness + a11y), Kolo 2 Atraktivita (graphic-design + signature-moment), Kolo 3 Konzistence (typography + brand + copy); Pastier's Frekvence dropped (outside DS surface). No critic-agent code changes. v1 discovery preserved at `plugins/design/skills/design-system/_DISCOVERY-v1.md` for transition window. 11/11 acceptance criteria pass. Files changed: `SKILL.md` rewrite (~280 line diff in Discovery section), `ux-research-agent.md` (Stage 2 procedure + recommendations schema + confidence heuristic), `setup-ds.md` (brief guidance + Step 3 prose), `CLAUDE.md` (entry-points pointer), DDR-033 (full reasoning + 4 alternatives + consequences + migration), `_pastier-probe-templates.md` (191 lines, 5 templates each with 1 example), smoke-trace at `.ai/plans/notes/setup-ds-3stage-smoke-trace.md` (190 lines). User memory `feedback-design-bootstrap-workflow.md` refreshed (26 lines). Changeset `setup-ds-three-stage-discovery` minor authored. No live `/design:setup-ds` run during execution per plan rule. **Retro lessons** (in archived plan): multi-section replacements need sentinel anchors not line numbers; "worked examples" must be the smallest object that illustrates shape, not full payload; validation greps must spell out case flags. Plan archived. |
| 2026-05-20 | Phase 6 — FigJam in-place comments | done | In-place comments UX shipped (composer + pins + thread popover + @mention autocomplete). 6 tasks all green, then live dogfooding surfaced 4 architectural / a11y / interaction bugs that all landed in the same session: thread popover missing close button, SVG-logo with `pointer-events:none` not selectable, Save/Cancel unclickable in comment tool mode (capture-phase input router suppressed them), and selection halo painted over pins because `.dc-world` (will-change: transform) own stacking context made world-portaled overlay lose z-index race with halos at z-index 5 outside. Followed by 2 more polish bugs: comments-panel click did not mirror selection halo, and thread popover did not follow target on pan/zoom. Resolution: full overlay refactor from world-portal → screen-coord `position: fixed` sibling of `.dc-canvas`, mirroring SelectionHalos pattern with rAF + getBoundingClientRect. DDR-034 records the architectural pivot. `isOverlayTarget(t)` helper in input-router (sibling of `isEditableTarget`) lets composer/thread/mention popup own their clicks. `document.elementsFromPoint` fallback in canvas-shell's `onDropComment` handles `pointer-events:none` decorations. Schema extended back-compat (author/thread[]/mentions[] default-fill on read, persist on next write). New HTTP endpoints `POST /_api/comments/<id>/reply` + `GET /_api/git-committers` on Bun runtime only per DDR-009 (no server.mjs mirror; user explicitly clarified at execute start that there are no legacy users). New test file `comments-api.test.ts` (6 tests, +18 assertions) — `bun test` 293/293 (+6 over baseline). tsc clean (modulo 2 pre-existing api.ts:813 errors). Bundle build 3.5 MB client / 56 KB CSS. Biome: 12 design-intentional warnings on new file (combobox listbox/option a11y pattern + custom dialog) suppressed with documented `// biome-ignore` per-rule comments; remaining 4 pre-existing warnings elsewhere unchanged. Deferred: scenario `comment-thread-resolve` not authored (end-to-end flow was validated through live user dogfood instead, which surfaced 6 bugs no scenario would have caught; documented in retro). Changeset `figjam-comments-overlay` minor authored. Plan archived. DDR-034 recorded. |
| 2026-05-20 | Rebrand md-claude → Maude | done | Atomic single-PR rebrand across 248 files (~1100 line diff). Phases 0–7 complete (Phase 0 pre-flight verified npm unpublish window viable; Phase 8 = post-merge maintainer tasks deferred). DDR-032 written with 4 architectural decisions + 6 sub-decisions for future plans (mch_ → mau_ token prefix, ghcr.io/maude-hub Docker image, maude-hub.service systemd unit, maude.iagh.cz domain). Kept-namespace list: `.mdcc-*` CSS classes, `--mdcc-*` CSS vars, `site/components/mdcc/`, `mdcc-tokens.css`, `~/.config/mdcc/`. Mid-/done pivot: `@mdcc/canvas-lib` → `@maude/canvas-lib` (user override; 27 files swept, regex constants in `canvas-lib-resolver.ts` + `canvas-lib-inline.ts` + `canvas-build.ts` re-fixed after escaped-slash sed miss). 7× `git mv packages/md-claude-* → maude-*`. CLI bins: `maude.{mjs,exe}` primary + `mdcc.{mjs,exe}` legacy shim (deprecation warning, drop in v0.17.x). `cli/install.cjs` accepts both `MAUDE_SKIP_POSTINSTALL` and `MD_CLAUDE_SKIP_POSTINSTALL` env vars one cycle. Workspace scopes `@md-claude/*` → `@maude/*` (site / dev-server / hub). All CI workflows + 4 issue templates + tarball-shape + version-parity scripts swept. Site build PASS (~53 docs pages prerender). dev-server `bun test` 287/287 PASS. CLI `node --test` 7/7 PASS. biome lint 0 errors (4 pre-existing warnings carry-over). Version parity 10/10 manifests @ 0.14.0. `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md` created with canvas-import migration section. New `.changeset/rebrand-maude.md` (minor bump, queues 0.15.0). Pending changesets rewritten to `@1agh/maude`. `bun.lock` regenerated. STATE.md history retains pre-rename `md-claude` references in entries from 2026-05-12 through 2026-05-19 (intentional time-series correctness). Phase 8 follow-up TODO documented in conversation: GitHub repo rename, `npm publish @1agh/maude@0.15.0` + 7 sub-packages, `npm unpublish @1agh/md-claude*` within 72h deadline (2026-05-23T00:45Z), GitHub Release notes pointing to migration doc, `maude.iagh.cz` DNS + Vercel wiring (CNAME → `cname.vercel-dns.com`), optional `md-claude.dev` → `maude.iagh.cz` 301 redirect. Plan archived. |
| 2026-05-20 | Phase 15 | done | Video pipeline toolchain installed + smoke-tested. ffmpeg 8.1.1 + vhs 0.11.0 (brew), Remotion 4.0.463 + Playwright 1.60 + react 19.2.6 (devDeps, repo root). `pnpm run video:smoke` exits 0 from clean `.work/` and produces a 13.6 s stitched H.264 1280×720 30 fps proof clip (VHS terminal + Playwright dev-server canvas + Remotion smoke card). Per-tool granular npm scripts (`:terminal`, `:browser`, `:card`) for isolated debugging. `scripts/video/README.md` runbook with troubleshooting matrix covers two non-obvious gotchas absorbed during execution: (a) VHS ignores `Set Framerate` for MP4 output and emits 25 fps regardless — `assemble.sh` normalizes all inputs to 30 fps before `-c copy` concat; (b) Playwright resolves a relative `outputDir` against the config-file dir, not cwd — `playwright.config.ts` now uses absolute path via `import.meta.url`. `phase-15.5-marketing-demo-video-30s.md` refactored: banner + Tasks 2/3/5/6/8/10/14 swapped for Remotion/VHS/Playwright analogues (~50–60% less custom code than the original 600-LOC bash ladder). DDR-031 recorded. `npm pack --dry-run` clean (zero `scripts/video/` matches). `pnpm lint` clean (0 errors on new scope, 4 pre-existing warnings carry-over). Changeset authored (patch). Plan archived. Acceptance criteria all checked. |
| 2026-05-20 | Phase 5.1 | done | FigJam-style annotation overhaul + canvas chrome redesign. Portal-rendered SVG into `.dc-world` (zero-latency pan/zoom — Phase 5's shimmer gone). Ellipse tool (`O`), rect/ellipse fill picker, pen/arrow thin/thick chip. Parallel `AnnotationSelectionProvider` + sticky contextual toolbar (color/fill/thickness/font-size/delete) + drag-select marquee + drag-translate + arrow nudge + Backspace delete. Double-click rect/ellipse → `<foreignObject>` text editor. Single centered bottom canvas toolbar (icon-based, absorbs zoom toolbar + presentation toggle) replaces three legacy chrome pieces; DCZoomToolbar deprecated. Menubar `View → Annotations` + new `Selection` + `Tools` dropdowns wired via existing `dgn:*` postMessage channel. `react-dom` split out as its own runtime bundle so `createPortal` is reachable (was aliased to `/client`). Annotation shortcuts moved into menubar `HelpModal`. 5 new modules: `use-annotation-selection`, `use-annotations-visibility`, `annotations-context-toolbar`, `canvas-icons`, `tool-palette` rebuild. `bun test` 287/287 (+18 over Phase 5 baseline). `bunx tsc --noEmit` clean (2 pre-existing api.ts errors only). DDR-029 recorded — annotation overlay portal architecture. Two follow-up patches landed during validation: (a) `react-dom` bundle missing `createPortal` discovered on first iframe load → fixed by adding `react-dom` as its own RUNTIME_PACKAGES entry; (b) two CSS bugs caught via live agent-browser dogfood — `.dc-tool-palette { overflow: hidden }` clipped the zoom popover (removed); `.dc-annot-svg { width: 100% }` resolved to 0×0 because `.dc-world` has no intrinsic dimensions (hardcoded `200000px`). UX feedback round landed: color/fill/thickness chrome moved from bottom-right to centered above tool palette, Hide+? stripped (help lives in menubar `HelpModal`), context toolbar made sticky via `CHROME_SELECTOR` bail in doc-level pointerdown, drag-select marquee added. Scenario `canvas-annotations-figjam` authored (14-step web-desktop, supersedes Phase 5's gap). Changeset authored. Plan archived. **Followups not blocking ship:** add `annotations-selection-move.test.ts` pure-helper coverage (deferred from Task 12), run formal a11y-auditor pass against new chrome, pilot full scenario end-to-end, consider DDR formalizing "chrome containers must use overflow:visible" rule. |
| 2026-05-20 | Phase 5 | done | Draw / annotation tools shipped. Pen / rect / arrow / eraser via the existing Phase 4.1 tool grammar (B/R/A/E + V/Esc); 6-swatch color picker; debounced 200 ms PUT to new `/_api/annotations` endpoint; world-coord storage rendered with `vector-effect="non-scaling-stroke"`; reload restores; native `<dialog>` help sheet via `Cmd+/`; `Shift+P` presentation toggle. One new module (`annotations-layer.tsx` ~640 LOC), three modified, one new server route. **+30 new tests** → `bun test` 269/269. Biome clean on changed files after a refactor pass: `PALETTE` → tuple, pen loops destructured, hand-rolled `role="dialog"` `<div>` → native `<dialog>` + `::backdrop`. /validate: types clean (2 pre-existing api.ts errors only), biome clean on changed files, scenario authored + smoke-piloted (`canvas-annotations` at localhost:4399 — PUT/GET round-trip + reload-restore + cross-canvas isolation verified end-to-end; eraser + Shift+P / Cmd+/ noted as harness limitations covered by unit tests). Phase 5.1 plan (`.ai/plans/phase-5.1-annotations-figjam.md` — 12 tasks: pan/zoom coexistence, portal-rendered SVG into `.dc-world` for zero-latency transform, annotation selection store, ellipse + text + fill + thickness, contextual toolbar, menubar wiring, canvas chrome redesign) already drafted as the follow-up. Plan archived. Scenario at `.ai/scenarios/canvas-format-tsx/canvas-annotations/spec.md`. Smoke report at `.ai/device/scenario-runs/canvas-annotations/2026-05-19-smoke/report.md`. |
| 2026-05-19 | Phase 4.2 | done | Artboard free-move shipped. Drag the chrome (label + outer border) in Move tool → ghost follows snapped cursor; 40-unit grid + 8-unit sibling snap (world-units per DDR-028); Alt disables snap; multi-select drags as rigid group; 4 px click-vs-drag classifier keeps Phase 4 pan-to-focus intact. Position-only persistence (DDR-027) — JSX is authoritative for size. Four bugs surfaced + fixed during validation + post-merge dogfooding: (1) reader was wholesale-overriding default-grid entries → 0×0 artboards when meta went position-only (fixed by merging defaults + meta); (2) `setPointerCapture` on outer article redirected the synthetic `click` target → pan-to-focus regression (fixed by dropping capture, global window listeners carry the drag); (3) `selectedIds` falling back from `Selection.id` (child cd-id) to `artboardId` silently disabled multi-drag (fixed via `selectionsToArtboardIds` helper + regression test); (4) `artboards` was `useMemo([seeds])` reading meta once at mount → drop committed to server but local state stayed frozen, user had to switch canvases to see the move (fixed by converting to `useState` + optimistic `setArtboards` on commit + `useEffect` re-seed on JSX changes, commit `1bd6acc`). New: `use-snap-guides.tsx`, `use-artboard-drag.tsx`, `SnapGuideOverlay`, `DragStateContext`. New tests: 44 (20 snap + 24 drag/helpers + 1 canvas-meta-api strip + 2 handoff-static-frames Phase-4.2 block). `bun test` 239/239. DDR-027 + DDR-028 recorded. Plan archived. Scenario `canvas-artboard-drag` authored. Commits: `a771d04` (feat), `1bd6acc` (fix: instant DOM update on drop). |
| 2026-05-19 | Phase 4.1 | done | Universal canvas input grammar shipped (DDR-026). Every TSX canvas now mounts `CanvasShell` automatically — Move (V), Hand (H), Comment (C) tools; Cmd+hover preview deep; Cmd+click select replace; Cmd+Shift+click add to multi; right-click context menu with Copy CSS / Fit / Reset etc.; hand-mode bare-drag pan via new `isPanDragActive` on `useViewportController`; capture-phase listeners suppress native button presses / input focus when the router claims an event. Halos render as `position: fixed` overlays in screen coords (zoom-immune at any level). Active-artboard indicator softened to 1px tinted accent. Inspector overlay shrunk to comment-pin renderer (legacy `dgn-insp-*` hover/click classes removed). Shell-side `.sel-halo` wrap removed. Decision flipped mid-execution from opt-in `inputMode="figjam"` prop to universal default (visual inconsistency cyan-vs-accent + naming directive); `figjam-shell.tsx` → `canvas-shell.tsx`, `.dc-fjm-*` → `.dc-cv-*`. New modules: `input-router.tsx`, `use-tool-mode.tsx`, `use-selection-set.tsx`, `context-menu.tsx`, `tool-palette.tsx`, `canvas-shell.tsx` (+ 3 test files = 52 new tests). `bun test`: 185/185, 0 fail. `bunx tsc --noEmit` clean. Canvas-build smoke: Canvas Viewport / Docs Site / Smoke TSX all 200, 0 legacy `figjam` / `dc-fjm-` / `dgn-insp-` refs in bundles. DDR-026 rewritten as universal grammar; scenario `canvas-figjam-grammar` → `canvas-input-grammar`. Archived: `.ai/plans/archive/phase-4.1-figjam-canvas-interactions.md`. |
| 2026-05-19 | Phase 4.0.5 | done | DDR-025 implemented. Canvas-lib relocated `.design/_lib/canvas-lib.tsx` → `plugins/design/dev-server/canvas-lib.tsx` (single source). `canvas-lib-resolver.ts` rewired to `import.meta.dir`; `canvas-build.ts` pre-flight is install-corruption check + once-per-boot legacy-`_lib/` deprecation warning; `http.ts` adds explicit `fs.watch` on the dev-server-internal canvas-lib (synthetic `fs:any` rel-path → existing hard-reload classifier). `design-system/SKILL.md` Round-0 Batch-A step 0 deleted; perf fixture relocated `.design/_lab/perf-100-artboards.tsx` → `plugins/design/dev-server/examples/perf-100-artboards.tsx` + sibling README; template + dogfood + orphan `.design/_lib/design-canvas-viewport.tsx` deleted (`.design/_lib/` + `.design/_lab/` gone). Skill docs (design, ui-kit, design-system), edit/new commands, canvas template, CLAUDE.md "Dev-server runtime contract" all swept; DDR-022 header annotated as partially superseded; DDR-024 references updated with "now at" notes. `bun test` 133/133. Handoff drop sha1 byte-identical (`7de51a51…`, baseline cached at `.ai/logs/phase-4.0.5-handoff-baseline.json`). 4 tests rewritten in `canvas-lib-resolver.test.ts` to match the new contract + new legacy-guard test. Validate scope: plumbing (tests + handoff parity + doc sweep + dev-server boot smoke); cross-platform scenario skipped — no UI surface changed. Changeset authored (patch, `phase-4-0-5-canvas-lib-single-source.md`). Plan retro appended; archived to `.ai/plans/archive/phase-4.0.5-canvas-lib-single-source.md`. Phase 4.1 + 4.2 plans remain `blocked` pending post-4.0.5 rewrite. |
| 2026-05-19 | Phase 4.1 | blocked → 4.0.5 spawned | `/flow:execute` on `phase-4.1-figjam-canvas-interactions.md` halted before any code change. Architectural pushback from user: `.design/_lib/canvas-lib.tsx` + `.design/_lab/perf-100-artboards.tsx` are dev-server engine code wrongly materialized into user-content space; DDR-022's "project-owned canvas-lib" produces unbounded drift across plugin releases (every project copy stale forever); Phase 4.1's new modules (input-router / tool-mode / selection-set / context-menu) would multiply the drift. DDR-025 recorded — canvas-lib relocates to `plugins/design/dev-server/canvas-lib.tsx` (single source), `_lab/` perf fixture moves to `dev-server/examples/`, `design-system/SKILL.md` Round-0 step 0 (canvas-lib scaffold) deleted, one-cycle deprecation log for downstream projects with legacy `_lib/`. Phase 4.0.5 plan drafted as the prerequisite cleanup. Phase 4.1 marked `blocked-on: phase-4.0.5` in its frontmatter with a banner noting why it can't run as-written. No commits this session. |
| 2026-05-19 | Phase 4 | done | Infinite-canvas engine landed: `DesignCanvas` world plane + `useViewportController` + `DCMiniMap` + `DCZoomToolbar` + click-to-focus + `<file>.meta.json` `layout`/`viewport` persistence (PATCH endpoint, 5 new tests). T7 shipped as DOM-driver enhancements with handoff static-frame filter + Pixi.js v8 runtime importmap entry (lazy bundle). Pan/zoom math hardened across 4 user-feedback hotfix passes: wheel input model (pan default, shift=horizontal, ctrl/pinch=zoom), iframe focus on pointerenter, lib HMR cache invalidation, listener stability (no mid-gesture teardown), React-state-vs-imperative-write decoupling, render-order grid (DS-01..DS-N not alphabetical), per-cell sizing for mixed-width artboards, paper-grid bg + DS-token artboard chrome, CSS `zoom` (not `transform: scale`) → text crisp at any zoom level, document-capture listeners for wheel/keys, shift+wheel axis-swap robustness, pan velocity decoupled from zoom. DDR-024 holds the deferred Pixi.js bundle gate. `bun test` 139/139. Commits: `0c4c209`, `db2f896`, `deef639`, `1abbc09`, `95260c2`, `1aeffdb`. Archived: `.ai/plans/archive/phase-4-canvas-v2-rendering-engine.md`. |
| 2026-05-19 | Phase 4 T1–T6 | done | Infinite-canvas engine landed in `canvas-lib.tsx.template` — DesignCanvas world plane (T1), `useViewportController` hook (T2), `DCMiniMap` + `DCZoomToolbar` (T3), per-DCArtboard click-to-focus (T4), `<file>.meta.json` `layout` + `viewport` persistence (T5) via new `/_api/canvas-meta` GET/PATCH endpoint, perf lab `.design/_lab/perf-100-artboards.tsx` + DDR-024 (T6). T0 revert folded into the same change. `bun test` 135/135. Commit `0c4c209`. |
| 2026-05-19 | Phase 4 T0 | folded | Shell-level 2026-05-19 T1 reverted in `app.jsx` (computeFit/computeDefaultGrid/.vp-world/multi-tab openTab/SelectionHalo rect dropped); engine moves to canvas runtime per user direction. Folded into the T1–T6 commit. |
| 2026-05-19 | Sidebar restructure | done | Dev-server FILES panel redesigned: sidecar nesting, per-DS folders, unified section toggles, hidden-files toggle, DS-count pill. Commit `8c58c2c`. Archived: `.ai/plans/archive/client-tree-restructure.md`. Changeset authored. |
| 2026-05-19 | Phase 3.6.1 | done | canvas-lib + HMR + TSX specimens shipped; 38/38 specimen-render scenario PASS; DDR-022 + DDR-023 recorded. Archived: `.ai/plans/archive/phase-3.6.1-canvas-envelope-and-ds-specimens.md`. |

## Phase 3.6.1 close-out (2026-05-19, /flow:done)

- `/flow:validate` ran clean after one type-contract fix (`Inspect.injectInspectorOnly()` declaration) + 30 biome autofixes (1 pre-existing `while ((m = re.exec()))` carry-over).
- New scenario `canvas-format-tsx/specimen-render-and-edit` (web-desktop, walks all 38 specimen TSXs) authored + piloted. First run caught **3 broken specimens** with unescaped `{` / `}` chars in JSX text content (`components-code-block`, `components-diff-view`, `type-mono`). Fixed via `{'{'}` / `{'}'}` escapes + `<pre>{\`...\`}</pre>` template wrap. Re-run: **38/38 PASS**.
- DDR-022 (canvas-lib virtual module + inline-on-handoff) + DDR-023 (no html-to-jsx codemod, specimens are bare TSX) recorded.
- Changeset authored (`@1agh/maude` minor, 0.13.1 → 0.14.0 on next `changeset version`).
- Plan retro appended; plan archived to `.ai/plans/archive/`.
- Commits: `5d9292e` (feat) + this STATE update.

## Phase 3.6.1 visual-regression repair (2026-05-18, post-/validate)

When the user opened the migrated specimens in the dev-server they reported widespread visual breakage. Live screenshot review confirmed three discrete failure modes; all fixed in this session:

1. **Triple-chrome above specimen content.** The migrated specimens were wrapped in `<DesignCanvas><DCSection title="..."><DCArtboard label="..." width={0} height={0}>...</DCArtboard></DCSection></DesignCanvas>`. The DCSection's `<h2>` title strip + DCArtboard's `dc-artboard-label sku` SKU strip both rendered ABOVE the original `<header class="specimen-hd">` — three header rows where the original HTML had one.

2. **`htmlFor` bleeding into prose.** The html-to-jsx codemod's attribute-rename regex (`\s([a-zA-Z-]...)(=...|(?=\s|/>|>))`) matched plain words in text content. The word "for" in sentences like "a library for the marketplace" got rewritten to `htmlFor`. Same risk class would have hit `readonly`, `disabled`, `checked`, `selected`, `hidden`, etc. — every boolean attribute name.

3. **Sibling CSS dropped.** `import "./<slug>.css"` in specimen TSX produced a separate `.css` asset via Bun.build, but `buildCanvasModule()` only took `outputs[0]` (the JS entry-point) and discarded the rest. Specimens with bespoke per-file CSS (`ui_kits-desktop-showcase`, `motion`, `state-system`, `logo`, `iconography`, ...) rendered as unstyled text dumps in the browser.

### Scope correction — user direction

User explicitly stated `html-to-jsx` is unnecessary scaffolding: specimens should be authored as native TSX with no codemod layer at all. Phase 3.6.1's "specimens migration" track is **collapsed to a one-shot manual migration** — going forward, specimens are bare TSX written by hand or by sub-agents during DS bootstrap (per the updated SKILL.md sub-agent prompt). No `migrate-canvases.ts`, no `html-to-jsx.ts`.

### Changes this session

- **DELETED:** `plugins/design/dev-server/html-to-jsx.ts`, `plugins/design/dev-server/test/html-to-jsx.test.ts`, `plugins/design/dev-server/test/migrate-specimens.test.ts`, `scripts/migrate-canvases.ts`. Tests dropped from 149 → 123 (still ahead of Phase 3.6 baseline of 95).
- **canvas-lib.tsx + template** — reverted the `width=0/height=0` auto-flow special case + `bare` DCSection prop. DCArtboard now ONLY renders fixed-px chrome (UI mocks); specimens never wrap themselves in it.
- **Specimens stripped (`.design/system/project/preview/*.tsx`)** — 38 specimens hand-fixed: dropped the `<DesignCanvas><DCSection><DCArtboard>` envelope, replaced with bare `<><header class="specimen-hd">...</header><main class="specimen">...</main></>`. Also globally replaced `htmlFor ` → `for ` in prose text (left `htmlFor=`/`htmlFor={...}` in actual attribute positions). Carried out via a one-shot Bun script (deleted after run).
- **canvas-build.ts** — `buildCanvasModule()` now collects every `kind: "asset"` CSS output from `Bun.build` and prepends a self-installing `<style data-canvas-css="bundled">` injector to the JS bundle. Idempotent per-slug; works under both module + hard HMR reloads.
- **ds-specimen.tsx.template** — rewritten to scaffold bare TSX with `specimen-hd` + `<main class="specimen">` shape. No envelope.
- **design-system/SKILL.md** — sub-agent prompt block flipped: specimens are bare TSX, NO `@maude/canvas-lib` import. UI mock canvases (Docs Site, Canvas Viewport, Smoke TSX) keep the envelope.

### Visual verification (live dev-server, agent-browser)

Started the Bun-based dev-server (`bun plugins/design/dev-server/server.ts`) — note that `bin/server-up.sh` boots the legacy `server.mjs` (zero-dep Node, no TSX pipeline). The Bun server is what wires the canvas-build pipeline + CSS injector.

Captured screenshots of 38 specimens + 3 UI canvases. Sampled and confirmed visually correct:

- ✓ colors-accent · type-scale · components-buttons · components-toggles · iconography · logo · motion · borders · empty-state · components-cards · ui_kits-desktop-showcase — all render with full styling, single specimen-hd, original layout intact.
- ✓ Docs Site (5 stacked artboards at 1440×900) · Canvas Viewport — UI canvas chrome (`dc-canvas` / `dc-section` / `dc-artboard` + label strips) renders correctly via their sibling CSS.
- ✓ Smoke TSX renders functionally (counter + h1 + bare button); intentionally has no chrome styling (it's a foundation smoke fixture).

### Known carry-over

- `bin/server-up.sh` still launches `server.mjs` (legacy Node server, no TSX pipeline). The maude design serve story for the Bun-based server is a separate follow-up — currently you boot it manually via `bun plugins/design/dev-server/server.ts --root . --port 4399`. Not blocking Phase 3.6.1 close-out but worth a Phase 3.6.2 or DDR.
- Tests: 123 pass / 0 fail (down from 149 only because the codemod tests went with the codemod). tsc clean except for the two pre-existing api.ts errors.

## Phase 3.6.1 execution close-out (2026-05-18)

All 14 tasks of the Phase 3.6.1 plan landed in this session — canvas envelope + reusable canvas-lib + HMR + DS specimens all in TSX.

- ✅ Task 1: `plugins/design/templates/canvas-lib.tsx.template` (~290 LOC) — frame envelope (DesignCanvas/DCSection/DCArtboard/DCPostIt) + specimen helpers (SpecimenHeader/SpecimenMeta/TokenChip/ColorSwatch/TypeScaleRow/KbdHint/ThemeToggle) + hooks (useTokens/useTheme/useArtboardBounds). Bootstrapped into `.design/_lib/canvas-lib.tsx`. Parses cleanly via oxc.
- ✅ Task 2: `plugins/design/dev-server/canvas-lib-resolver.ts` (~90 LOC) — `@maude/canvas-lib` virtual module resolver as a Bun.build plugin; `readCanvasLibSource()` for handoff. `canvas-build.ts` wires it in + adds explicit pre-flight check (Bun.build's plugin throws collapse to "Bundle failed", so we surface the missing-lib reason at the top level). `http.ts` threads `designRoot`. 7 new tests.
- ✅ Task 3: `.design/ui/Smoke TSX.tsx` rewritten with canvas-lib envelope + new meta sidecar. Renders 6 locator entries, no console errors.
- ✅ Task 4: `plugins/design/dev-server/html-to-jsx.ts` (~170 LOC) — regex-driven HTML→JSX rewriter: class→className, void elements self-close, boolean attrs `={true}`, style→object, comments→`{/* */}`, SVG kebab→camelCase, rejects inline `on*` handlers + `<script>` as out-of-scope. 15 fixture tests.
- ✅ Task 5: `scripts/migrate-canvases.ts` rewritten with `--target {canvases|specimens}` + `--force`. Canvases mode: prepend `@maude/canvas-lib` import + drop orphan inline primitives. Specimens mode: strip scripts → htmlToJsx → wrap in canvas-lib envelope → emit triplet (`.tsx`/`.css`/`.meta.json`) + archive original. 11 tests.
- ✅ Task 6: Both codemod modes ran end-to-end. Canvases: `Docs Site.tsx` + `Canvas Viewport.tsx` regenerated via `--force` (Smoke TSX already done). Specimens: 37/38 auto-migrated, 1 (`components-toggles.tsx`) hand-migrated for inline `onclick`-based state; archive + MIGRATION_NOTES.md written. All 11 sample canvases (3 UI + 8 specimens) build cleanly with non-trivial locator cardinality.
- ✅ Task 7: `plugins/design/skills/design-system/SKILL.md` — Round 0 (Batch A step 0) scaffolds `_lib/canvas-lib.tsx` idempotently from the template. Roster + prose flipped to `.tsx` extensions (~50 substitutions). Sub-agent prompt template now requires the canvas-lib envelope import block. `_MAPPING.md` destination paths flipped; source-side inspiration library kept as `.html` (the templates don't migrate).
- ✅ Task 8: `plugins/design/dev-server/hmr-broadcast.ts` (~110 LOC) — bridges `fs:any` events to `canvas-hmr` WS messages with 50ms debounce + mode classification (`css`/`module`/`hard`) + coalescing (`hard > module > css` within the window). Wired into `ws.ts`. `_shell.html` injects a small HMR client that opens `/_ws`, swaps `<link>` href on CSS changes (cache-bust `?v=`) and `location.reload()` on TSX/`_lib` changes; reconnects with 750 ms backoff on close. 7 tests.
- ✅ Task 9: `plugins/design/dev-server/canvas-lib-inline.ts` (~180 LOC) — `buildLibMap()` parses canvas-lib via oxc-parser, captures named exports + internal helpers with JSDoc-extended source ranges + dep edges (transitive references). `inlineUsedExports()` strips the `@maude/canvas-lib` import line, BFS-resolves transitive deps, appends bodies after the canvas default export. `handoff.ts` calls it after `stripDataCdId()`; filters `@maude/canvas-lib` out of npm deps. End-to-end verified: `Smoke TSX.registry.json.files[0].content` has zero `@mdcc` references. 14 tests.
- ✅ Task 10: `plugins/design/templates/canvas.tsx.template` rewritten — replaces inline primitive functions with `import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib"`; JSDoc explains the virtual-specifier contract. NEW `plugins/design/templates/ds-specimen.tsx.template` (~55 LOC) — simpler envelope for specimens, auto-flow artboard (`width={0} height={0}`), wraps `SpecimenHeader`.
- ✅ Task 11: `plugins/design/agents/design-system-completeness-critic.md` + `design-system-keeper.md` — specimen-existence checks + narrative refs flipped to `.tsx`.
- ✅ Task 12: `_canvas-shell.html` accepts new `?layout=<rel>` query param (specimens load DS chrome via `_layout.css`). `client/app.jsx`'s `canvasUrl()` detects `system/<ds>/preview/` paths and auto-derives `?layout=` + `?components=` + `?tokens=` from the DS slug. `colors-accent.tsx` end-to-end-loadable with full chrome.
- ✅ Task 13: `plugins/design/commands/edit.md` Step 1.5 extended — for ALL `.tsx` canvases (any css_mode), the orchestrator pre-loads `_lib/canvas-lib.tsx` so the iteration prompt sees the authoring vocabulary (envelope + helpers + hooks) instead of re-inventing equivalents.
- ✅ Task 14: full regression. `bun test` — **149 pass / 0 fail** across 21 test files (+ 54 new tests, up from 95 baseline). `bun tsc --noEmit` — only pre-existing api.ts errors (467/468); no new errors. End-to-end build smoke on 11 canvases/specimens — all clean. /design:handoff on Smoke TSX → registry-item has zero `@maude/canvas-lib` references.

**Files added this session:**

- ADDED: `plugins/design/templates/canvas-lib.tsx.template` + `.design/_lib/canvas-lib.tsx`
- ADDED: `plugins/design/templates/ds-specimen.tsx.template`
- ADDED: `plugins/design/dev-server/canvas-lib-resolver.ts`
- ADDED: `plugins/design/dev-server/canvas-lib-inline.ts`
- ADDED: `plugins/design/dev-server/hmr-broadcast.ts`
- ADDED: `plugins/design/dev-server/html-to-jsx.ts`
- ADDED: `plugins/design/dev-server/test/canvas-lib-resolver.test.ts` (7 tests)
- ADDED: `plugins/design/dev-server/test/canvas-lib-inline.test.ts` (14 tests)
- ADDED: `plugins/design/dev-server/test/hmr-broadcast.test.ts` (7 tests)
- ADDED: `plugins/design/dev-server/test/html-to-jsx.test.ts` (15 tests)
- ADDED: `plugins/design/dev-server/test/migrate-specimens.test.ts` (11 tests)
- ADDED: 37 codemod-migrated specimen TSX/CSS/meta triplets under `.design/system/project/preview/`
- ADDED: `.design/system/project/preview/components-toggles.tsx` (hand-migrated)
- ADDED: `.design/_history/_migration-2026-05-15/MIGRATION_NOTES.md`
- MODIFIED: `plugins/design/dev-server/canvas-build.ts`, `handoff.ts`, `http.ts`, `ws.ts`, `client/app.jsx`
- MODIFIED: `plugins/design/templates/canvas.tsx.template`, `_shell.html`
- MODIFIED: `plugins/design/skills/design-system/SKILL.md`, `plugins/design/templates/design-system-inspiration/_MAPPING.md`
- MODIFIED: `plugins/design/agents/design-system-{completeness-critic,keeper}.md`
- MODIFIED: `plugins/design/commands/edit.md`
- MODIFIED: `scripts/migrate-canvases.ts`
- ARCHIVED: `.design/system/project/preview/*.html` → `.design/_history/_migration-2026-05-15/system/project/preview/`

## Phase 3.6 close-out note (2026-05-18)

Phase 3.6 (canvas TSX format) **shipped** with all 12 tasks marked complete + 95 tests green + handoff CLI end-to-end-verified. Acceptance criteria as written were met. Runtime hygiene gaps surfaced when the user opened the migrated canvases in the dev-server:

- `Docs Site.tsx` + `Canvas Viewport.tsx` white-page at runtime — codemod produced JSX that referenced `<DesignCanvas>`/`<DCSection>`/`<DCArtboard>` but didn't define them (originals relied on babel-runtime window globals). Build + tests pass; runtime fails.
- `Smoke TSX.tsx` lacks the canvas envelope (was a foundation-slice mount fixture, never upgraded).
- DS specimens left as `.html` (Plan Task 9 explicitly skip-listed them) breaks the plug-and-play promise — inspector select + `/design:edit` don't work on specimens.
- HMR was never wired (carries from runtime slice).

3.6 acceptance criteria didn't require "renders without console errors" — only "transpile + build". That gap caused the disconnect. 3.6.1 plan adds that gate + introduces a project-owned `@maude/canvas-lib` shared library (resolved virtually, inlined on handoff) + wires HMR + flips DS specimens to TSX.

Closing 3.6 as **shipped + documented**; 3.6.1 is the follow-up.

## Execution Progress — phase-3.6-canvas-tsx-format (closing slice, 2026-05-18)

Tasks 7–12 of 12 landed in this session — canvas TSX format is feature-complete from the dev-server through to /design:handoff registry-item drop.

- ✅ Task 7: `handoff.ts` + `bin/handoff.sh` + rewritten `/design:handoff` command. Emits `<Slug>.registry.json` per [shadcn registry-item schema](https://ui.shadcn.com/schema/registry-item.json). `stripDataCdId()` AST-removes the pipeline scaffolding from the dropped TSX. `classifyImports()` separates npm specs from `@/components/ui/*` registry deps via `Bun.Transpiler.scanImports()`. React + ReactDOM forced into the dep floor (DDR-012). 14 new tests in `test/handoff.test.ts`.

- ✅ Task 8: `scripts/migrate-canvases.ts` codemod + one-shot run. `Docs Site.html` (1909 LOC, 74 KB) → `Docs Site.tsx` (48 KB) + `Docs Site.css` (30 KB) + meta-injected `css_mode: "inline"` + `data_cd_id_version: 1` + auto-generated JSDoc header (Task 12a baked in). `Canvas Viewport.html` (3076 LOC) → equivalent triplet. Originals archived under `_history/_migration-2026-05-15/ui/`. Both migrated canvases parse cleanly via `canvas-pipeline.ts` (locator counts: 722 + 1070 elements) and round-trip through `canvas-build.ts` (browser-loadable ESM, 156 KB + 244 KB respectively). React.useEffect ⇒ bare `useEffect` import rewrite handled.

- ✅ Task 9: `.html → .tsx` sweep across `plugins/design/commands/*` + `plugins/design/skills/*` (excluding intentional preview-specimen + `_shell.html` references). `new.md` scan recipes now match `\( -name "*.tsx" -o -name "*.html" \)` so the grace-window keeps working. `edit.md` Failure modes accept both extensions. `skills/design/SKILL.md` + `skills/ui-kit/SKILL.md` describe TSX-first canvas layout.

- ✅ Task 10 + 12d: schema additions. `canvas-meta.schema.json` gained `css_mode` enum (`inline | tailwind | modules`), `data_cd_id_version` integer, `ai_context` object (`pinned_decisions[]`, `known_quirks[]`, `why_this_exists`). `config.schema.json.handoffTargets` documents `registry:item` magic-path. `.design/config.json.handoffTargets` populated with the shadcn-registry entry.

- ✅ Task 11: smoke + regression. `test/phase-3.6-smoke.test.ts` exercises the migrated `Docs Site.tsx` + `Canvas Viewport.tsx` end-to-end (transpile → build → emit registry-item, all in one suite). Skips cleanly on fresh checkouts via `existsSync` guard. Real CLI run produces `Docs Site.registry.json`: 57 KB, 3 files (component 45 KB no `data-cd-id`, style 3 KB subset of `_components.css`, theme 2 KB of touched tokens), 30 cssVars surfaced.

- ✅ Task 12: AI-handoff polish.
  - 12a — `canvas-header.ts` JSDoc projector module. Idempotent block-comment overwrite via `applyHeaderToSource()`; surfaces `ai_context.why_this_exists` → `@notes`, `pinned_decisions[]` → `@decision`, `known_quirks[]` → `@quirk`. CLI entry for `/design:edit` to shell out. 8 new tests in `test/canvas-header.test.ts`. JSDoc generation is also baked into Task 8's codemod (every migrated canvas already ships a header).
  - 12b — `_components.css` + token bundling in `handoff.ts`. AST-scan canvas TSX for every `className` literal (covers string concats, template-literal quasis, ternaries via generic-recurse). `filterComponentsCss()` keeps rules whose first class is in the harvested set, including BEM-modifier derivatives (`.btn--ghost` rides along when `btn` is referenced). `filterTokensCss()` plucks only the `var(--*)` references the kept CSS touches. Emitted as `files[1]: registry:style` + `files[2]: registry:theme` + `cssVars.theme`.
  - 12c — `/design:edit` Step 1.5 added. Auto-loads `_components.css` + `colors_and_type.css` into orchestrator context BEFORE dispatching to frontend-design, gated on `css_mode === "inline"` + (style-verb-in-feedback OR `selected.v === 2`). Bounded cost (~6 KB CSS context) vs. the unbounded "Claude re-grep'd mid-edit" round-trip.
  - 12d — `ai_context` schema field (combined with Task 10).

**Phase 3.6 acceptance gates verified this session:**
- `bun test` — **95 pass / 0 fail** across 16 files (up from 83 at session start; +12 new tests).
- `bun tsc --noEmit` — clean for new files; only pre-existing `api.ts(457,25)+(458,24)` errors remain (confirmed unchanged).
- End-to-end CLI run: `bin/handoff.sh "Docs Site.tsx" .design` exits 0, emits valid `<Slug>.registry.json` (schema URL matches, `dependencies` floor present, `files[0].content` has zero `data-cd-id` occurrences).
- Pipeline round-trip on migrated canvases: `Docs Site.tsx` and `Canvas Viewport.tsx` both transpile + build cleanly; locator cardinality non-trivially populated (722 + 1070 entries).

**Deps added this session:** none. (`oxc-parser` + `magic-string` already present from foundation slice; `lightningcss` already in devDeps from Phase 3.4.)

**Files added (Phase 3.6 closing slice):**

- ADDED: `plugins/design/dev-server/handoff.ts` (~480 LOC) — registry-item emitter + CSS bundling
- ADDED: `plugins/design/dev-server/canvas-header.ts` (~130 LOC) — JSDoc projector
- ADDED: `plugins/design/dev-server/bin/handoff.sh` — orchestrator shell-out
- ADDED: `plugins/design/dev-server/test/handoff.test.ts` (14 tests)
- ADDED: `plugins/design/dev-server/test/canvas-header.test.ts` (8 tests)
- ADDED: `plugins/design/dev-server/test/phase-3.6-smoke.test.ts` (4 tests — repo-canvas regression)
- ADDED: `scripts/migrate-canvases.ts` (~330 LOC) — one-shot HTML→TSX codemod
- ADDED: `.design/ui/Docs Site.tsx` + `.css` (migrated)
- ADDED: `.design/ui/Canvas Viewport.tsx` + `.css` (migrated)
- ADDED: `.design/ui/Docs Site.registry.json` (sample handoff emit — gitignored? user picks)
- ADDED: `.design/_history/_migration-2026-05-15/ui/Docs Site.html` (archived)
- ADDED: `.design/_history/_migration-2026-05-15/ui/Canvas Viewport.html` (archived)
- MODIFIED: `plugins/design/dev-server/canvas-meta.schema.json` — `css_mode`, `data_cd_id_version`, `ai_context`
- MODIFIED: `plugins/design/dev-server/config.schema.json` — `handoffTargets[].path` documents `registry:item`
- MODIFIED: `.design/config.json` — `handoffTargets[0]` populated
- MODIFIED: `.design/ui/Docs Site.meta.json` + `Canvas Viewport.meta.json` — `css_mode: "inline"` + `data_cd_id_version: 1`
- MODIFIED: `plugins/design/commands/handoff.md` — rewritten for shadcn registry-item flow
- MODIFIED: `plugins/design/commands/edit.md` — Step 1.5 DS-context auto-load + Failure-modes ext check
- MODIFIED: `plugins/design/commands/new.md` — TSX-first default + tsx|html scan recipes
- MODIFIED: `plugins/design/commands/setup-docs.md` — TSX-aware inventory + tree diagram
- MODIFIED: `plugins/design/skills/design/SKILL.md` — TSX paths in active/comments/new
- MODIFIED: `plugins/design/skills/ui-kit/SKILL.md` — TSX canvas layout + inline frame primitives

**Out-of-scope / carries forward:**

- Performance budget gates from the plan (cold-load < 250 ms, transform < 8 ms p50, HMR < 100 ms, token cost < 30 %) — not measured this session. Bench harness in `test/perf-harness.ts` exists; full sampling against the migrated canvases is a `/done` follow-up.
- HMR — still not wired (carries from runtime slice).
- DDR-017 numbering — the plan calls for DDR-017 but the foundation slice picked DDR-019 (017 + 018 already taken). DDR-019 is the source of truth.
- `Docs Site.registry.json` was emitted as a smoke test; user should decide whether to commit it as an example or gitignore it.

## Execution Progress — phase-3.6-canvas-tsx-format (runtime slice, 2026-05-18)

Tasks 4–6 landed in second session of 2026-05-18 — TSX canvases now browser-loadable end-to-end (page mounts, useState round-trips, inspector reads data-cd-id).

- ✅ Task 4: `inspect.ts` upgraded — `SelectedElement.v: 1 | 2` schema (v=2 when click-target has an ancestor `data-cd-id`; v=1 fallback for legacy .html + shell chrome clicks). INSPECTOR_SCRIPT.elInfo() adds `id` via `closest('[data-cd-id]')`. Server-side `setSelected()` derives canvas slug from path. 3 new tests in `test/active-state.test.ts` (v=2 round-trip, v=1 fallback, slug derivation).

- ✅ Task 5: `canvas-edit.ts` + `bin/canvas-edit.sh` + `/design:edit` Step 3a. AST-aware single-attribute edits via oxc-parser + magic-string. Supports `className` swap/insert, `style.<prop>` swap/insert in inline ObjectExpression, plain string attrs (aria-label, etc.). Per-canvas mutex + atomic-rename write. Refuses to edit `data-cd-id` (pipeline-owned). CLI entry `bun canvas-edit.ts --invoke <canvas> <id> <attr> <value>` for `/design:edit` to shell out. 11 new tests in `test/canvas-edit.test.ts`. `edit.md` Step 3a documents the fast-path triggers (active = .tsx + selected.v=2 + single-element single-attribute feedback) and what it skips (steps 5 + 6 + 3.5 element-focused screenshot).

- ✅ Task 6: TSX canvases browser-loadable end-to-end. Five sub-deliverables:
  - `runtime-bundle.ts` — pre-built React 19 + ReactDOM + jsx-runtime bundles served at `/_canvas-runtime/<pkg>.js`. Per-package sub-bundles + cross-bundle externals (each bundle externalises the others; importmap stitches at browser-level → singleton React preserved). Dynamic export discovery via `await import(pkg)` enumerates ALL keys including `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` (required for ReactDOM to find React's shared internals — without it: `Cannot read properties of undefined (reading 'S')` on first createRoot). **NODE_ENV=production** baked in — the dev React variant trips a Bun.build CJS-rename collision (`Assignment to constant variable` on `import * as React`); production variant is collision-free + smaller. 6 tests in `test/runtime-bundle.test.ts`.
  - `canvas-build.ts` — wraps `canvas-pipeline.ts` (pass-1 data-cd-id injection) with a Bun.build pass that produces browser-loadable ESM. Virtual-loader plugin feeds the with-IDs source to Bun.build (filter uses suffix-match because macOS /tmp → /private/tmp symlinks defeat exact-path matching). React + jsx-runtime + ReactDOM externalised. 5 tests in `test/canvas-build.test.ts`.
  - `http.ts` — new routes `/_canvas-runtime/<slug>.js` (lazy-built, etag-cached, 304-aware) + `/_canvas-shell.html` (serves the static shell template). TSX-canvas route swapped from `transpileCanvasSource` direct → `buildCanvasModule` (the route's `js` body is now browser-loadable, not just parseable). Existing `canvas-route.test.ts` updated for Bun.build's `export { X as default }` form.
  - `plugins/design/templates/_shell.html` — shared canvas mount harness with importmap (`react`/`react-dom`/`react-dom/client`/`react/jsx-runtime`/`react/jsx-dev-runtime` → `/_canvas-runtime/*.js`), async dynamic-import of the canvas TSX, `createRoot(root).render(<Canvas/>)`. Query params `?canvas=<rel>` + `?designRel=<rel>` + optional `?tokens=` / `?components=`.
  - `plugins/design/templates/canvas.tsx.template` — JSDoc header projecting `.meta.json` (@canvas/@ds/@platform/@opt_out/@artboards/@brief/@stack/@history/@handoff) + envelope with DesignCanvas + DCSection + DCArtboard primitives inlined locally (handoff-friendly — no runtime dep on dev-server chrome).
  - `client/app.jsx` — `canvasUrl(p, cfg)` helper switches `.tsx` paths to `/_canvas-shell.html?canvas=…&designRel=…` while keeping `.html` on the legacy direct-load path. App fetches `/_config` once at boot + threads `cfg` into Viewport. Existing build (`bun run build.ts`) refreshed.
  - `/design:new` step 3 + 7 + 8 patched — default target now `.tsx`, validation accepts default-export React component + no `<!doctype>`, write step references the canvas.tsx.template. Legacy `.html` path kept for backwards compat until Task 8 codemod lands.

**Phase 3.6 acceptance gates verified this session:**
- Browser end-to-end: `/_canvas-shell.html?canvas=ui/Smoke%20TSX.tsx` renders `<div>` + `<h1>` + `<button>` with `data-cd-id` attrs in DOM; useState round-trips (clicking the button increments visible count).
- `bun test`: **69 pass / 0 fail** (up from 44 at end of Task 3 session).
- `bun tsc --noEmit`: clean for new files; only pre-existing api.ts(457,25)+(458,24) errors remain (confirmed not introduced this session).

**Deps added this session:** none (React + ReactDOM + @types/* were already in `plugins/design/dev-server/package.json` devDeps from Task 0; no new packages needed for Tasks 4–6).

**Files modified / added (Phase 3.6 runtime slice):**

- ADDED: `plugins/design/dev-server/canvas-build.ts` — Bun.build wrap on pipeline withIds source
- ADDED: `plugins/design/dev-server/canvas-edit.ts` — AST single-attribute editor
- ADDED: `plugins/design/dev-server/runtime-bundle.ts` — React 19 pre-bundles
- ADDED: `plugins/design/dev-server/bin/canvas-edit.sh` — CLI wrapper for /design:edit Step 3a
- ADDED: `plugins/design/dev-server/test/canvas-build.test.ts` (5 tests)
- ADDED: `plugins/design/dev-server/test/canvas-edit.test.ts` (11 tests)
- ADDED: `plugins/design/dev-server/test/runtime-bundle.test.ts` (6 tests)
- ADDED: `plugins/design/templates/_shell.html` — canvas mount harness with importmap
- ADDED: `plugins/design/templates/canvas.tsx.template` — TSX scaffold with JSDoc header
- ADDED: `.design/ui/Smoke TSX.tsx` — smoke fixture used to verify browser-load; safe to keep or delete
- MODIFIED: `plugins/design/dev-server/inspect.ts` — v=2 selection schema + data-cd-id reader
- MODIFIED: `plugins/design/dev-server/http.ts` — buildCanvasModule swap + /_canvas-runtime + /_canvas-shell routes
- MODIFIED: `plugins/design/dev-server/client/app.jsx` — canvasUrl helper + cfg loading + Viewport prop wiring
- MODIFIED: `plugins/design/dev-server/dist/client.bundle.js` + `styles.css` — rebuilt
- MODIFIED: `plugins/design/dev-server/test/active-state.test.ts` — +3 tests (v=2 round-trip, v=1 fallback, slug derivation)
- MODIFIED: `plugins/design/dev-server/test/canvas-route.test.ts` — accept Bun.build's `export { X as default }` form
- MODIFIED: `plugins/design/commands/edit.md` — new Step 3a documenting AST fast-path
- MODIFIED: `plugins/design/commands/new.md` — Step 3 + 7 + 8 default to `.tsx` (legacy `.html` path kept for backwards compat)

**Out-of-scope / carries to next session:**

- Tasks 7–12 unchanged from prior session note: handoff.ts + /design:handoff (shadcn registry-item.json), scripts/migrate-canvases.ts codemod + one-shot migration, sweep of remaining `.html` references in commands + skills, schema updates (canvas-meta.schema.json `css_mode` + `data-cd-id-version`, config.schema.json handoffTargets), e2e regression suite + token-cost measurement, AI-handoff polish (JSDoc header generator, CSS bundling in registry-item, /design:edit Step 1.5 auto-load _components.css for css_mode=inline canvases, `ai_context` meta schema field).
- **Performance budget gates** — not yet measured this session either; per-canvas TSX file size + transform cost + cold-load < 250 ms + HMR + token cost target should be sampled in Task 11 once the codemod produces realistic migrated canvases.
- HMR — not wired yet. `/_bun_hmr` endpoint still TODO (plan says "Bun 1.3's `import.meta.hot` + React Fast Refresh"). Currently a manual page reload is needed after editing a canvas TSX.
- Iframe Cmd+R reload behaviour — the `_canvas-shell.html` doesn't yet bust the canvas-module browser cache when its source changes; next session should add ETag-aware reload or `?v=<etag>` query.
- Dev-mode JSX runtime — Bun.build's collision in the dev React variant means production-mode React is used everywhere. Source-map quality + dev warnings are reduced as a consequence; revisit if/when Bun ships a fix (track via Bun's issue tracker).
- React-DOM bundle size is ~922 KB raw (no minify in dev). Plan target was ~25–35 KB gz total runtime — production minify + gz would close most of the gap. Not addressed this session.

## Execution Progress — phase-3.6-canvas-tsx-format (foundation slice, 2026-05-18)

- ✅ Task 0: DDR-019 written (`.ai/decisions/DDR-019-canvas-tsx-format.md`). Renumbered from plan's "DDR-017" because 017 + 018 were taken by Phase 3.5. DDR-019 reconciles with DDR-007: `data-cd-id` (transpiler-emitted, universal) and `data-dc-element` (author-emitted, semantic) coexist with documented inspector preference order. DDR index updated; 017 + 018 also indexed (were missing from README).
- ✅ Task 1: `plugins/design/dev-server/canvas-pipeline.ts` — two-pass transform via `oxc-parser` (parse) + `magic-string` (byte-range inject) + `Bun.Transpiler` (TSX→JS). ID = `Bun.hash(componentName + ":" + idx).toString(16).slice(0, 8)` — 8 hex chars, no `blake3-wasm` dep added (plan permitted Bun.hash). 15 bun:test cases green; covers determinism, whitespace-stability, sibling-insert contract, robustness (arrow components, JSXMemberExpression, idempotency on re-transpile of post-pass-1 source, malformed source → TranspileError).
- ✅ Task 2: `plugins/design/dev-server/locator.ts` — per-canvas `_locator.json` writer with per-path Promise-mutex + atomic rename. Top-level keyed by canvas slug (POSIX, ext-less, relative to designRoot). 14 bun:test cases green; covers roundtrip, multi-slug isolation, deterministic sorted-key JSON, 20-way concurrent multi-slug writes, 10-way concurrent same-slug last-writer-wins, clearLocatorSlug, malformed-JSON-as-empty.
- ✅ Task 3: `plugins/design/dev-server/http.ts` — TSX-route hooked into the existing fall-through `fetch()`. URL pattern `/.design/ui/<file>.tsx` (matches existing shell `urlOf()` helper that prefixes designRel into the iframe src). 200 + `application/javascript` + ETag (`Bun.hash(post-pass-1 source).toString(16)`); 304 on `If-None-Match` match; 500 + readable body on `TranspileError`; 404 / 403 on missing / traversal. In-memory `(absPath -> { mtimeMs, etag, js })` cache skips re-transpile when source unchanged. Locator is written synchronously before the response. 7 bun:test cases green.

**Deps added (workspace `plugins/design/dev-server/package.json`):**

- `oxc-parser ^0.131.0` (devDependency; ESTree-compatible TSX parser, ~1–3 ms for canvas-scale input)
- `magic-string ^0.30.21` (devDependency; byte-range edits, used by Rollup/Vite in production)
- Skipped `blake3-wasm` per plan permission — `Bun.hash` is 64-bit; sliced to 8 hex chars = 32 bits = ample for ≤300-element canvases.

**Validation status:**

- `bun test` — 44 pass / 0 fail across 10 files (the new 36 expects fold cleanly into the existing 8-file suite).
- `bun tsc --noEmit` — clean for new files. Pre-existing `api.ts(457,25)` error confirmed via stash-then-tsc — not introduced by this session.
- `bun run build.ts` — not re-run; route + pipeline run under bun source-mode. Should be re-built when Task 6 ships the runtime bundle that makes the JS browser-loadable.

**Out-of-scope / carries to next session:**

- **Browser-loadability of the route response.** `Bun.Transpiler.transformSync` output uses internal `jsxDEV_<hash>` symbol names meant for Bun's runtime — not browser-resolvable as-is. Task 6 (`_shell.html` + `/_canvas-runtime/react.bundle.js`) closes this; Tasks 0–3 stop at "valid JS by parse-check" (DDR-019 explicitly notes this — "making it BROWSER-loadable is the _shell.html + react-runtime bundle's job"). Tests verify the JS is re-parseable by `oxc-parser`; nothing more is promised this session.
- Tasks 4–12: inspector contract upgrade (data-cd-id reader in inspect.ts), `/design:edit` AST-aware element edits (canvas-edit.ts + bin/canvas-edit.sh), `_shell.html` + `canvas.tsx.template` + `/design:new` rewrite, `handoff.ts` + `/design:handoff` (shadcn registry-item.json sidecar), `scripts/migrate-canvases.ts` codemod + one-shot migration, sweep of `.html` refs across `plugins/design/commands/*` + skills, schema updates (`canvas-meta.schema.json.css_mode` + `data-cd-id-version`, `config.schema.json.handoffTargets`), e2e regression, AI-handoff polish (JSDoc headers, CSS bundling in registry-item, edit-context CSS auto-load).
- Performance budget gates from the plan (per-canvas TSX < 35 KB, two-pass < 8 ms p50, cold load < 250 ms, etc.) — not yet measured. Most are gated on Task 8 (codemod) producing real-world migrated canvases.

**Files modified / added (Phase 3.6 foundation):**

- ADDED: `plugins/design/dev-server/canvas-pipeline.ts`
- ADDED: `plugins/design/dev-server/locator.ts`
- ADDED: `plugins/design/dev-server/test/canvas-pipeline.test.ts`
- ADDED: `plugins/design/dev-server/test/locator.test.ts`
- ADDED: `plugins/design/dev-server/test/canvas-route.test.ts`
- ADDED: `.ai/decisions/DDR-019-canvas-tsx-format.md`
- MODIFIED: `plugins/design/dev-server/http.ts` — imports canvas-pipeline + locator; new `serveCanvasTsx()` + in-memory cache; dispatched from `fetch()` for `.tsx` under designRoot
- MODIFIED: `plugins/design/dev-server/package.json` — added `oxc-parser` + `magic-string` devDeps (`bun.lock` is gitignored)
- MODIFIED: `.ai/decisions/README.md` — indexed DDR-017, DDR-018, DDR-019

## Execution Progress — phase-3.5-dev-server-ui-ux-refresh (DONE 2026-05-17)

- ✅ Task 1-3 (design stage — CV-08/09/10 mocks; user signed off 2026-05-15)
- ✅ Task 4: index.html → JetBrains Mono fallback (Berkeley primary via token chain), Inter dropped
- ✅ Task 5: 1-tokens.css → project DS bridge (OKLCH paper-light + phosphor-dark + `--u-*` alias layer); zero hex literals remaining in chrome CSS; sibling-token roles audited (`--u-accent` → `--accent`, `--u-accent-bg` → `--accent-tint`, etc.)
- ✅ Task 6: Header + ThemeToggle component (Sun/Moon, localStorage-persisted) wired
- ✅ Task 7: Sidebar + Tree restyled to CV-08 — search "filter…" placeholder, section headers SKU-tracked uppercase, active-row hairline left edge + accent-tint bg (no pill), unread badge on `--accent` chip
- ✅ Task 8: Tabs + StatusBar slots — `StatusBarSlot` helper, slot order: ACTIVE | SELECTED | COMMENTS | LIVE | spacer | THEME; tabs got hairline-underline active treatment; ThemeToggle moved from Header → StatusBar per plan
- ✅ Task 9: SystemView (CV-09) — new live `TokenLadder` (reads `getComputedStyle`, MutationObserver re-reads on theme flip) + 8-step `TypeLadder` + SKU-framed header; CommentsPanel (CV-10) — uppercase mono tab labels with hairline-underline active state, hairline-divided item rows, accent-tint active pin, muted resolved
- ✅ Task 10: live smoke green — boot in <2 s, both themes round-trip via toggle, keyboard focus visible on tree + tabs + buttons (`--shadow-focus` 2 px accent ring); full a11y-auditor sweep deferred to `/flow:validate-a11y` at `/done`
- ✅ Task 11 (2026-05-15): paper-grid 24 px bg on `.viewport` via `--u-border-subtle` linear-gradient — visible behind empty-state, covered by iframe `--u-bg-0` once mounted
- ✅ Task 12 (2026-05-15): `<Wordmark>` empty-state watermark top-left (project + `v{__MDCC_VERSION__}` baked via `build.ts` `define` from `package.json` + `window.location.port`) + `<SelectionHalo>` accent 2 px outline + 4 corner ticks around active iframe when `selected && activePath !== SYSTEM_TAB`
- ✅ Task 13 (2026-05-15): StatusBar ARTBOARDS slot (live `tabs.length`) + ZOOM slot (static `100%`, tooltip "Pan/zoom in Phase 4"); slot order now ACTIVE · SELECTED · COMMENTS · ARTBOARDS · ZOOM · LIVE · spacer · THEME

**Files modified:**

- `plugins/design/dev-server/client/index.html` — fonts swap (T4)
- `plugins/design/dev-server/client/styles/1-tokens.css` — full rewrite (project DS + alias bridge) (T5)
- `plugins/design/dev-server/client/styles/3-shell.css` — sidebar/header/tabs/statusbar refactor; 5 hex literals removed (T6-T8); paper-grid `.viewport`, `.wm`, `.sel-halo`, `.sb-artboards`, `.sb-zoom` (T11-T13)
- `plugins/design/dev-server/client/styles/4-components.css` — system-view + comments panel refactor; 11 hex/rgba literals removed (T9)
- `plugins/design/dev-server/client/app.jsx` — `ThemeToggle`, `TokenLadder`, `TypeLadder`, `StatusBarSlot` components; theme state + localStorage round-trip (T6-T9); `Wordmark`, `SelectionHalo` components + `MDCC_VERSION` define ref; Viewport receives `project` + `selected`; StatusBar gains `tabsCount` + ARTBOARDS/ZOOM slots (T11-T13)
- `plugins/design/dev-server/build.ts` — `__MDCC_VERSION__` define populated from `package.json` at build time (T12)

**Validation status:** `bun run build.ts` green (client 3.4 MB raw / styles 49.7 KB after T11-T13); `bun tsc --noEmit` clean; biome clean; live dev-server boot OK against this repo's `.design/` on port 4421 (smoke: 200 on root/bundle/css, `/_health` OK, version `0.12.0` baked into bundle).

**Carry-over:**

- Modified-dot indicator (plan T7 spec) — no server data flow for "file modified since open", left out; would need fs-watch + diff against the canvas history snapshot.
- "Avatar + author" in comment items (plan T9 spec) — comment data model has no `author` field; deferred to a future schema migration.
- Full `/flow:a11y-auditor` cross-theme sweep — not run; recommended to invoke at `/flow:done`.
- `dev-server-shell-tour` scenario not recorded — recommended via `/flow:scenario new dev-server-shell-tour` before `/done`.
- Smoke against `/Volumes/D/git/dugmate/.design/` (canonical real-world example per plan §Validation step 8) — not run this session.
- DDR candidates per plan acceptance: (a) font hosting strategy (chose option-c JetBrains-Mono-only fallback; Berkeley Mono name kept in chain for users who have it locally), (b) token bridge approach (chose alias-layer + inline DS values rather than cross-`plugins/` `@import`).

**Last archived plan:** `.ai/plans/archive/feature-docs-site-mdcc-skin.md`
**Branch:** `main`

## Loaded skills (skill-loader)

Resolved 2026-05-12 via `/flow:maintain-docs` Step 3b → `flow:skill-loader` → `terminal-skills` MCP.

| Library / tech | Source | Slug | Notes |
| -------------- | ------ | ---- | ----- |
| Yjs | terminal-skills MCP | `yjs` | v1.0 collab backbone (Phase 8 LAN, Phase 9 hub). Covers Y.Doc / shared types / WebsocketProvider / awareness / IndexedDB offline. |
| Playwright | terminal-skills MCP | `playwright-testing` | Planned dev-only dep for visual regression (per PRD §Testing). Covers config, page objects, API mocking, visual snapshots, a11y axe integration. |

Still unresolved (no MCP match, no built-in skill):

- **Fumadocs** — Next.js-based docs site for v1.x. Fallback: WebFetch on https://fumadocs.dev when starting the docs-site phase.
- **Hocuspocus** — Yjs hub framework (Phase 9). The loaded `yjs` skill covers the WebSocket provider patterns; for Hocuspocus-specific server config (`@hocuspocus/server`, extensions, `onAuthenticate`), fallback to WebFetch on https://tiptap.dev/docs/hocuspocus when Phase 9 starts.
- **Next.js** (the framework itself) — no direct terminal-skills hit; closest tangents are `nextra`, `turbopack`, `ai-sdk`. Only needed when Fumadocs phase starts; defer.

Consider `/flow:make-skill-template` for **fumadocs** and **hocuspocus** if their use becomes load-bearing across multiple sessions.

## Decisions

- DDR-001 Monorepo with single npm publisher (Phase 1)
- DDR-002 Release flow via Changesets, with parity-preserving wrapper (Phase 1)
- DDR-003 `/flow:release` walks user-authored runbook instead of dispatching on provider (Phase 3)
- DDR-004 Flow commands use `<group>-<verb>` prefix; compat stubs shipped in v0.6.0, removed in v0.6.1 (Phase 13)
- DDR-005 Docs site stack — Fumadocs + Vercel; accept Fumadocs DS defaults (Phase 2)
- DDR-006 Plugin commands/skills/agents declare `name: <plugin>:<slug>` in frontmatter (ad-hoc, 2026-05-13)
- DDR-007 Stable element-id schema — `data-dc-screen` + `data-dc-element` (Phase 13, 2026-05-15)
- DDR-008 `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers (Phase 13, 2026-05-15)
- DDR-010 `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel (Phase 14, 2026-05-15) [DDR-009 was claimed by the bun-runtime DDR mid-session]
- DDR-011 Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork (feature-docs-site-mdcc-skin, 2026-05-15)
- DDR-012 React 19 everywhere — shell and canvases share a single runtime (Phase 3.4, 2026-05-15)
- DDR-013 Server modular split into seven TypeScript modules on `Bun.serve` (Phase 3.4, 2026-05-15)
- DDR-014 CSS `@layer reset, tokens, layout, shell, components, utilities` + Lightning CSS at build time (Phase 3.4, 2026-05-15)
- DDR-015 Per-platform Bun binary distribution via npm `optionalDependencies` sub-packages with postinstall-hardlink (Phase 3.4 Tasks 12-13, 2026-05-15)
- DDR-016 `plugins/design/dev-server/runtime/` is the canvas-runtime library home — runtime code, not meta-design (Phase 3.4 Task 1 audit, 2026-05-15)
- DDR-017 Dev-server shell = shadcn-style menubar + single-canvas viewport (tabs row killed) — Phase 3.5 mid-session pivot from action-button header after user pushback on "chrome not mocked" exemption (2026-05-17)
- DDR-018 Tree groups via `kind` discriminator (`project | canvas | runtime`) — server scans PROJECT root + RUNTIME gitignored alongside canvases; DS canvas group widens to non-HTML scan (2026-05-17)

## Blockers

- (none)

## History

| When | Phase | Note |
| ---- | ----- | ---- |
| 2026-05-12 | planning | PRD authored at `.ai/docs/PRD.md`; 8 phase plans generated. Start with `/flow:execute .ai/plans/phase-1-contribute-infra-changesets.md`. |
| 2026-05-12 | planning | Phase 1 expanded (Task 0: monorepo + pnpm workspaces; Task 8: GitHub repo via `gh` CLI). Phase 4 updated for esbuild + bundled `dist/server.bundle.mjs` + `dist/client.bundle.js` shipping pattern; `plugins/design/dev-server/package.json` becomes `"private": true` workspace. |
| 2026-05-12 | planning | Runtime research at `.ai/docs/research-runtime.md`. Decision: stay on Node 20+ for v1.0, defer Bun binary distribution to v1.1 (first off the icebox). Phase 4 constrained to runtime-agnostic `node:*` patterns. |
| 2026-05-12 | planning | Collab research at `.ai/docs/research-collab.md` (814 lines). Phase 8 scope cut to "ambient multiplayer" (Yjs + Awareness, no HTML co-editing). New Phase 9 created for v1.1 structured CRDT HTML co-editing (`data-cd-id` identity + Y.XmlFragment + AI diff-to-ops). Phase 0 spike (HTML↔Y.XmlFragment fidelity) is go/no-go gate for Phase 9. |
| 2026-05-12 | planning | Architecture pivot: user wants federated self-hostable hub, not LAN-peer-to-peer. Research overwritten (`.ai/docs/research-collab.md`, 1145 lines, new). **PartyKit rejected** (`partyserver` is CF-Workers-only). **Hocuspocus adopted** (MIT, Node-native, production-tested for TipTap Collab). Phase 9 renumbered → Phase 10 (v1.2 structured CRDT). New Phase 9 = self-hostable hub + bidirectional file sync (`mdcc hub serve|deploy`, `maude design link`). v1.1 ship target. |
| 2026-05-12 | planning | `/flow:maintain-docs` Step 3b → `flow:skill-loader` loaded `yjs` + `playwright-testing` skills from `terminal-skills` MCP. Fumadocs/Hocuspocus/Next.js framework still gaps (no MCP match) — recorded above under "Loaded skills". |
| 2026-05-12 | planning | Audit pass (2 Explore agents): 93% consistency, 16/16 user requirements covered. User decisions: (1) Phase 7 (ACP) → icebox; (2) apply all doc fixes now. Plus 3 scope refinements: (a) Phase 3 split — flow⇄design seam extracted to new Phase 11; (b) Phase 5 multi-DS reinterpretation (DS-as-attachment to `/design:new`, not runtime switcher) + extract layers + in-canvas CSS to new Phase 12 (end-of-roadmap extra feature); (c) Phase 8 file renamed `partykit` → `yjs-lan`. Phase 1 reserves `plugins/design/hub/` workspace. New `.ai/docs/config-schema.md` consolidates evolving config. Phase 9 gains migration section from Phase 8 LAN. |
| 2026-05-12 | Phase 1 | Started `/flow:execute phase-1`. Branch `infra/phase-1-contribute-changesets` cut from `main`. |
| 2026-05-12 | Phase 1 | Tasks 1–9 + DDR-001/002 landed. Local CI smoke green (lint/test/parity/tarball/changeset-status). Awaiting `/flow:done`. |
| 2026-05-12 | done | `/flow:done` — Phase 1 closeout. Plan archived; retro recorded; reverted out-of-scope biome JSX reformat at review gate. Next: Phase 2 (Fumadocs docs site) or Phase 3 (flow ↔ design changeset). |
| 2026-05-12 | Phase 3 | `/flow:execute phase-3` — schema + `/flow:release-changelog` + `/flow:release` + onboard auto-detect + de-hardcode + DDR-003. Worked directly on `main` (no branch cut, user's choice). Docs pages (Task 11) deferred to Phase 2. |
| 2026-05-12 | done | `/flow:done` Phase 3 — DDR-003 written, changeset queued (minor), retro recorded, plan archived. CLAUDE.md debrief skipped (no new convention). Next: Phase 2 (docs site) or any of Phase 4–10. |
| 2026-05-13 | Phase 13 | `/flow:execute` Phase 13 — 11 renames, 11 compat stubs (remove v0.6.0), category: frontmatter on 29 live commands, /flow:help aggregator, CATEGORIES.md catalog, README + plugin README + CLAUDE.md updates, 18-file reference sweep clean. 40 files in commands/ (29 live + 11 stubs). |
| 2026-05-13 | Phase 13 | Post-validate triple audit (3× Explore agents) caught a hidden-dir gap — original `rg` sweep skipped `.ai/`, `.github/`, `plugins/flow/.claude-plugin/`. Patched 22 leftover refs across 14 hidden-path files (`.ai/{README,INDEX}.md`, `.ai/{decisions,reviews,logs,context}/README.md`, `.ai/docs/{PRD,config-schema}.md`, `.ai/plans/{README,phase-11-…}.md`, `.ai/state/STATE.md`, `plugins/flow/.claude-plugin/config.schema.json`, `.github/ISSUE_TEMPLATE/docs.yml`). Final `rg --hidden` sweep clean. |
| 2026-05-13 | done | `/flow:done` Phase 13 — DDR-004 recorded (naming convention + v0.6.0 stub removal target), retro appended, plan archived to `.ai/plans/archive/phase-13-…`. Local commit only (no push, per user). |
| 2026-05-13 | Phase 2 | `/flow:execute phase-2` — scoped to Task 1–2 only (scaffold + core MDX) per user. Hosting choice: Vercel (DDR-005 to record at /flow:done). Tasks 3 (auto-gen command ref), 4 (schema renderer), 5 (search + llms.txt), 6 (deploy), 7 (README dedup) deferred to follow-up execute. |
| 2026-05-13 | Phase 2 | Commit `c81da3b` lands Task 1–2. Continued execute → Task 3–7 in one pass. Auto-gen command reference (37 pages) + schema reference + robots.txt + metadataBase fix + DDR-005 + site-deploy.yml workflow (inert pending Vercel secrets) + README trim 339→164. Build green; lint clean. Awaiting `/flow:done` for retro + archive. |
| 2026-05-13 | done | `/flow:done` Phase 2 — DDR-005 recorded (Fumadocs + Vercel + accept DS defaults), patch changeset authored (`.changeset/phase-2-docs-site.md`), retro appended (what worked / didn't / change-next-time / carry-overs), plan archived to `.ai/plans/archive/phase-2-docs-site-fumadocs.md`. Next: Phase 4–10 from the v1.0 roadmap (Phase 5 dep on Phase 4; Phase 11 dep on Phase 3 + 4; Phase 6/8/9/10 sequential). |
| 2026-05-13 | design-system-init | `/flow:execute` design-system-init.md — scoped to Phase 0–2 skeleton first, then user requested continuation through Phase 6. Commit `e7d7773` (Phase 0–2): rename `/design`→`/design:edit` + compat stub + sweep (22 files), inspiration library skeleton (24 files), skill `design-system` Bootstrap+Mode-detection sections, 3 new commands (setup-onboard/setup-ds/help) + CATEGORIES.md, pre-flight bootstrap hooks in edit/new, `maude design init` CLI subcommand (smoke-tested). Commit `852a25a` (Phase 3–6): `design-system-completeness-critic` agent w/ 3-tier rules + `--system-only` flag, multi-DS canvas wiring (canvas-meta `designSystem` field + `--ds=` flag w/ fail-on-unknown + flow:design-system-guard scoped to canvas DS), CLAUDE.md "Design system bootstrap" section (8 rules), Fumadocs narrative pages (bootstrap.mdx, categories.mdx, multi-ds.mdx, maude design init in cli.mdx). |
| 2026-05-13 | done | `/flow:done` design-system-init — validate green (passed with warnings, no hard fails), changeset authored (minor bump @1agh/maude), `.changeset/{config.json,README.md}` restored from git history (deleted post-v0.7.0), retro appended to plan with 5 "what worked" / 4 "what didn't" / 4 "change next time" bullets + carry-over list, plan archived to `.ai/plans/archive/design-system-init.md`. Open carry-overs: inspirational library expansion (~38 unwritten reference files), multi-DS `--all-ds` critic runtime testing, version bump to v0.8 (separate cycle). Total: 83 files net, ~3,600 insertions across 3 commits on `main` (no branch). |
| 2026-05-13 | ad-hoc | Plugin namespace + `setup-onboard` → `init` rename. No plan file; started from a `/flow:quick` trigger after a user-reported autocomplete collision between `/flow:resume` and the native `/resume`. Discovered Claude Code [#22063](https://github.com/anthropics/claude-code/issues/22063): plugin commands with `name:` frontmatter lose namespace prefix, registering as bare slugs. Workaround: prefix `name:` explicitly with `<plugin>:`. Verified empirically on `resume.md` first (autocomplete showed namespaced `/flow:resume`), then propagated to 77 plugin files (49 flow + 25 design + 3 incidental). Also renamed `/flow:setup-onboard` → `/flow:init` and `/design:setup-onboard` → `/design:init` (bare-verb exception to DDR-004's `<group>-<verb>` rule, mirroring Claude Code built-in `/init`). |
| 2026-05-13 | done | `/flow:done` plugin-namespace + init rename — commit 1 (`444afa5`) namespace fix (74 files), commit 2 follows with rename + cross-refs + DDR-006 + changeset. Total: 108 files net, ~190 insertions across 2 commits on `main`. No plan to archive (ad-hoc trigger). |
| 2026-05-15 | Phase 13 | `/flow:execute` Phase 13 started — stable element IDs (`data-dc-screen`/`data-dc-element`) + canonical screenshot pipeline (`screenshot.sh`) + 3 cheap helpers (`bootstrap-check.sh`, `server-up.sh`, `slug.sh`) + `data-artboard-id` selector bug fix. 22 tasks in 4 waves. |
| 2026-05-15 | Phase 13 | All 22 tasks completed in single execute pass. 14 files modified, 5 new helpers in `dev-server/bin/` (244 lines deleted, 212 added — net ~30 line reduction despite adding ~600 LOC of helpers because callers shrank dramatically). Grep audit clean: 0 inline `agent-browser` invocations, 0 server-lifecycle bash, 0 slug bash, 0 stale `data-artboard` selectors. Live smoke green against `Canvas Viewport.html`. Awaiting `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 13 — validate green with soft warnings → addressed (DDR-007 element schema, DDR-008 bin/ helper home, minor changeset for Phase 13). Retro appended. Plan archived to `.ai/plans/archive/phase-13-stable-element-ids-and-canonical-screenshots.md`. Local commit on `main`, no push (per session). |
| 2026-05-15 | Phase 14 | `/flow:execute` Phase 14 — design-system-keeper agent + pattern priors envelope + token-usage doctrine. 7 tasks: T1 Token usage guide section in DS README, T2 new agent (read-only `Read,Bash,Glob,Grep`), T3 `commands/new.md` envelope `## Pattern priors` + step 9.5 invocation, T4 `commands/edit.md` step 7.5 (conditional) + step 8a DS-drift fast-path + `--skip-ds-keeper` flag, T5 CLAUDE.md pattern-lift rule (127 lines), T6 DDR-010 (DDR-009 collision with bun-runtime DDR caught at validation, renamed), T7 CATEGORIES.md auto-routed-agents cross-reference section. T1 + T5 bundled into user's parallel commits (`3d663e6`, `16af2b6`); remaining 5 files committed by `/flow:done`. |
| 2026-05-15 | done | `/flow:done` Phase 14 — DDR-010 written, retro appended (3 wins / 3 misses / 3 process improvements), action checklist in retro source ticked to `[x]`, plan archived to `.ai/plans/archive/phase-14-design-system-keeper-pattern-priors.md`. Open carry-over: scratch-project smoke run of `/design:new` to verify ds-keeper fires + reports findings on a deliberately-drifty input. |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 — scoped to fundament-only per user: DDR-012 pivot (React 19 unified, supersedes hybrid Preact+React draft), Task 1 audit (runtime/ verdict = canvas-runtime library, not meta-design — DDR-016), Task 2 (Bun toolchain + react/lightningcss devDeps + scripts), DDR-013 (server modular split + TS), DDR-014 (CSS @layer + Lightning CSS). 5 DDRs landed + dev-server/package.json + root engines.bun=>=1.3 + STATE.md updated. Tasks 3-16 deferred to follow-up execute sessions. Parallel to feature-docs-site-mdcc-skin (awaiting-done). |
| 2026-05-15 | Phase 3.4 | `/flow:execute` Phase 3.4 follow-up — Tasks 3-16 implementation pass in one session. Highlights: `build.ts` Bun-driven orchestrator (client + Lightning CSS + per-platform compile + --watch HMR broadcast); React 18 UMD → React 19 esm in `app.jsx` (216 KB raw / 69 KB gz under 80 KB budget); `index.html` rewritten to bundle-loading (no more babel-standalone CDN); `styles.css` split into 6 `@layer` files under `client/styles/`; `server.mjs` (1288 LOC) rewritten as 7 TypeScript modules on `Bun.serve` (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts + mem.ts auxiliary; 1963 total LOC; bun tsc --noEmit clean); native WS handlers (drops handwritten RFC-6455 upgrade); `mem.ts` FinalizationRegistry + heap-watch; `client/hmr.mjs` CSS-only live reload; `client/iframe-lazy.mjs` IntersectionObserver lazy mount + content-visibility wrappers; 7 `bun:test` smoke tests (8 pass) + perf harness; postinstall-hardlink distribution pattern (`cli/install.cjs` writes side-channel file `cli/.platform-binary-path`, `design.mjs` execs binary direct — pragmatic deviation documented in DDR-015 since full bun-CLI port is deferred); 7 sub-package manifests under `packages/maude-<slug>/`; root `package.json` `optionalDependencies` pin all 7; `mdcc-safe` `--ignore-scripts` fallback; `.github/workflows/build-binaries.yml` 7-platform fail-fast matrix with `publish-main needs: build-binaries`; `scripts/check-version-parity.sh` + `bump-version.sh` extended to cover sub-packages + optionalDependencies pin parity; DDR-015 written; Phase 4 + Phase 3.5 plan footers reconciled with the new pipeline. Live smoke: server.ts boots in < 200 ms on this repo, all endpoints return correct JSON, `mdcc-darwin-arm64` standalone binary compiles in ~100 ms (57 MB; under 80 MB budget). |
| 2026-05-15 | done | `/flow:done` feature-docs-site-mdcc-skin — pre-existing CI Quality red since v0.12.0 (package.json tabs vs biome's space convention) surfaced + fixed in separate commit `5c8932c` (chore: biome format drift). Static gates green (types / lint / build / 7 node:test / token sync / stats drift). 4 scenarios written + run via `flow:scenario-runner` (agent-browser 0.27.0, web-desktop+web-mobile): blockers=0, parity_ok=true, but 8 follow-ups including 3 real bugs (numbered h2 ::before counter rule unmatched, mobile theme toggle 0×0/unreachable, cmd-K backdrop blur). `flow:design-system-guard` returned BLOCK (6 blockers: glassmorphism, BMC stock PNG, Lucide Coffee in nav, h2 selector miss, mobile toggle, cmd-K SVGs). `flow:a11y-auditor` returned BLOCK (3 WCAG fails: 2.4.7 focus rings, 2.1.1 mobile toggle, 2.4.1 skip-link). `flow:review-code` PASS WITH SUGGESTIONS (12 items, none release-blocking; `<dt>`/`<dd>` outside `<dl>` in page-meta-footer + build-stats brittleness are strongest patch candidates). Per user closeout decision: accept as known issues, ship + follow-up plan rather than return to /execute. Follow-up plan written at `.ai/plans/feature-docs-site-followups.md` (21 items across 3 commits). Retro appended to docs-site plan. Plan archived. No new commit during /done (feature commits already on main via 78d9d8f + 94b4e77; only format-drift fix 5c8932c added). Carry-overs: implement followups plan; investigate agent-browser daemon stability (a11y agent fell back to static-only due to `os error 35`); decide DDR-011 amendment vs new DDR for "Lucide-in-chrome scope" + "mobile theme toggle strategy". |
| 2026-05-15 | done | `/flow:done` Phase 3.4 — validate gates green (parity / tsc / 8 smoke tests / release build with 66 KB gz bundle / 57 MB binary / live boot OK). Two runtime bugs caught + fixed during user smoke and folded into the same commit: (a) `Bun.build` `format:'iife'` + `minify:true` triggers TDZ in React 19 internals → switched to `format:'esm'` + `<script type="module">` (66 KB gz, even better than IIFE was), (b) `app.jsx` had `useCallback`-declared `startDraftFromSelection` / `startDraftFor` AFTER the `useEffect` that references them via deps — fine under babel-standalone runtime eval, real TDZ under ESM build; moved declarations above. Also fixed minor `inspect.ts` bug: `Bun.write(.keep)` was a misguided "ensure dir exists" — Bun.write creates parent dirs automatically — removed + added artifact to .gitignore. Biome auto-fix landed across 7 TS files (template literals + non-null assertion cleanup); remaining 27 findings are intentional (`any` on bus payloads + WS msg decoder, `let foo` patterns) — same exemption posture as the existing JSX. Changeset queued (minor bump). Pragmatic deviation from plan T12 (full bun-CLI port) documented in DDR-015 — only `maude design serve` hot path execs the native binary today; cold-path subcommands (init/config/version) keep Node dispatcher; tracked as v1.0 follow-up. Single commit on `main`: `61d9e9d`. Plan retro appended + archived to `.ai/plans/archive/phase-3.4-architecture-refactor.md`. Carry-overs: 8h soak test, cross-platform binary smoke beyond darwin-arm64, --smol runtime honor verification, `iframe-lazy.mjs` wiring into `app.jsx` (Phase 4 viewport rewrite), full CLI bun-port (v1.0), `api.ts` / `inspect.ts` LOC split. Eight pre-existing `MM` staged files from prior parallel sessions (biome.json + site/* + dev-server/bin/_screenshot-playwright.mjs) were surgically excluded via `git reset HEAD` + per-file `git add` — index now clean of any non-3.4 content; their working-tree changes ended up matching HEAD so nothing was lost. |
| 2026-05-15 | Phase 3.5 | `/flow:execute` Phase 3.5 — Tasks 4-10 implementation pass after the user-signed-off design stage (CV-08/09/10 in `.design/ui/Canvas Viewport.html`). Token bridge: full rewrite of `client/styles/1-tokens.css` with project DS OKLCH paper-light + phosphor-dark blocks inlined (decided against cross-`plugins/` @import for fragility) + a `--u-*` alias layer with sibling-token roles audited per CLAUDE.md memory; all chrome CSS now passes `grep -E '#[0-9a-f]{3,6}|rgba?\(\s*[0-9]'` zero. Chrome refactor: ghost-button `.actions` row, mono SKU-framed sidebar with hairline section dividers, hairline-underline tabs (no pills), `StatusBarSlot` helper + new slot row (ACTIVE / SELECTED / COMMENTS / LIVE / spacer / THEME); ThemeToggle component shows the destination icon (Sun↔Moon) and persists to `localStorage('mdcc-theme')`. SystemView (CV-09): added live `TokenLadder` reading `getComputedStyle(documentElement)` for 21 named tokens with a `MutationObserver` on `data-theme` to re-read on flip, plus a `TypeLadder` rendering the 8-step ladder at actual size. CommentsPanel (CV-10): tabs row got SKU-tracked mono labels with active-underline + accent counter chip; comment rows are hairline-divided, accent-tint background on active pin with left-edge accent border, muted resolved (kept opacity 1 + `--fg-2`). Validation: `bun run build.ts` green (client 3.4 MB raw / Lightning CSS 47.8 KB) — Lightning CSS produced 47.8 KB minified styles, both themes round-trip via the toggle, `bun tsc --noEmit` clean, focus rings visible via Tab navigation. Live screenshots in `/tmp/phase-3.5-shots/` confirm: dark theme catalog-stamp visual, light paper-cream equivalent, real canvas iframe inside the new shell, system view token grid. Awaiting `/flow:done`. |
| 2026-05-15 | Phase 3.5 | `/flow:plan` addendum (rev 1, then trimmed) — user first wanted "připravte layout, Phase 4 ať jen předělá render engine" → I expanded 3.5 with 6 functional tasks (pan/zoom, MiniMap, ZoomToolbar, layout.json, tab semantics, perf smoke). User then clarified: *"funkcionalita kanvasu patří do Phase 4 ať se to nepřekrývá; teď jen shell UX a UI iterace podle design návrhu."* **Trimmed Phase 3.5 to 3 visual-only tasks: T11 paper-grid bg on `.viewport`, T12 `<Wordmark>` empty-state + `<SelectionHalo>` accent corner-ticks around iframe, T13 StatusBar `ARTBOARDS` (live count) + `ZOOM` (static 100% placeholder with tooltip).** Phase 4 expanded back to 7 tasks covering the whole canvas-functionality block as one coherent rewrite: T1 multi-iframe plane refactor, T2 pan/zoom controller, T3 MiniMap + ZoomToolbar interactive, T4 tab semantics change, T5 layout.json persistence + default-grid migration, T6 perf-prototype DDR, T7 Pixi engine swap + LoD + world coords + perf gate close. Both plans now don't overlap — Phase 3.5 paints around the canvas, Phase 4 owns how the canvas works. |
| 2026-05-17 | Phase 3.5 | `/flow:execute` continuation — Tasks 11-28 implementation pass after user comparison against CV-08 mock revealed gaps. T11-T13 (paper-grid + Wordmark + SelectionHalo + StatusBar slots) landed first. Then mid-session pivot: T14-T17 menubar component (shadcn-style File/Edit/View/Selection/Tools/Help + state stamp) replacing the action-button header, tabs row killed entirely (single-canvas model) — codified as DDR-017. T18 fixed body-grows scrollbar bug (`grid-template-columns: minmax(0, 1fr)`). T19-T20 rewrote sidebar tree to CV-08 spec (tree-panel-hd + sections + pill counter + tp-row.dir/.sel modifiers + files-first ordering). T21-T24 extended `api.ts:buildIndexData` with PROJECT (root `.md`/`.json`) + RUNTIME (gitignored `_*`) groups via new `kind` discriminator (DDR-018), DS canvas group widened to non-HTML scan, dir-wrapper rendering. T25-T28 added sidebar visibility toggle (View > Project Tree, T key), Help modal (Cheatsheet relocated from sidebar, `?`/`F1`), DS section header clickable (replaces dropped promoted button). Post-validate user reported View dropdown invisible — root cause `.mb { overflow: hidden }` clipping the `top: 30px` absolute dropdown; fix moved clip responsibility to `.mb-status` only. 25+ visual comparison screenshots captured during iteration (`/tmp/phase-3.5-audit/`, `/tmp/menubar-bug/`). Awaiting `/flow:done`. |
| 2026-05-17 | done | `/flow:done` Phase 3.5 — validate green (TS clean, build 3.47 MB client / 56.7 KB CSS, biome clean on touched files, dev-server live). DDR-017 + DDR-018 written. Changeset queued (minor). Plan retro appended + archived to `.ai/plans/archive/phase-3.5-dev-server-ui-ux-refresh.md`. Single feat commit on `main`. Carry-overs: `dev-server-shell-tour` scenario unrecorded; full `flow:a11y-auditor` formal run not done (ARIA verified manually + keyboard surface expanded with T/S/?/F1); smoke against `/Volumes/D/git/dugmate/.design/` not run; ★ star + ● modified file row indicators need data backend (favorites list + fs.watch tracking); `SECTION_META.ds` hardcodes `MDCC-DSN/01` pill — should read from project config when Maude dev-server runs in other repos. |

## Execution Progress

### feature-docs-site-mdcc-skin — execute complete (2026-05-15)

- [x] T1: Copy MDCC tokens into site + sync script ✅ (`site/app/mdcc-tokens.css`, `site/scripts/sync-mdcc-tokens.mjs`, `pnpm sync:tokens` + `sync:tokens:check`)
- [x] T2: Swap Inter → JetBrains Mono via next/font/google ✅ (`site/app/layout.tsx` — variable `--font-mdcc-mono`, `maude` class + `data-theme="light"` on `<html>`)
- [x] T3: `--color-fd-*` bridge in `site/app/global.css` ✅ (overrides for 17 fumadocs slots, mapped to MDCC `--bg-*`/`--fg-*`/`--accent`)
- [x] T4: MDCC nav chrome in `lib/layout.shared.tsx` ✅ (JSX nav title + Docs/Plugins/Source links)
- [x] T5: `<SkuLabel>` component + base MDCC CSS (.mdcc-sku, .mdcc-wm, .mdcc-nav-link, .mdcc-skip-link) ✅
- [x] T6: `(home)/page.tsx` rebuilt — Hero + CatalogGrid + MetaFooter inline ✅
- [x] T7: `<CodeBlock>` MDX renderer with filename strip + copy button ✅ (`site/components/mdcc/code-block.tsx`)
- [x] T8: `<Callout>` MDX renderer with ASCII glyphs (`?`, `!`, `▲`, `★`) ✅
- [x] T9: Docs shell extras — `<SkuBreadcrumb>` + CSS-counter h2 numbering + `<PageMetaFooter>` ✅
- [x] T10: Sidebar + TOC + prev/next pager re-skin (pure CSS in global.css) ✅
- [x] T11: Cmd-K palette re-skin (CSS targeting Orama dialog selectors) ✅
- [x] T12: Theme parity — `html.dark.mdcc` selector (specificity 0,2,1) wins over `.mdcc[data-theme="light"]` (0,2,0); mirrors all MDCC dark tokens ✅
- [x] T13: Inter removed; `appName` kept (still used by OG image route) ✅
- [x] T14: DDR-011 written + indexed in `.ai/decisions/README.md` ✅

**Validation:**
- `pnpm types:check` ✅ green
- `pnpm lint` ✅ green on all touched files (12 files clean)
- `pnpm build` ✅ green — 169 static routes prerendered, 0 warnings, Turbopack 3.6s

**Carry-over:**
- Visual diff vs 4 artboards (DS-01..DS-04) NOT yet run — `/flow:validate` step that needs `flow:scenario-runner`. Recommended before `/flow:done`.
- `design-system-guard` + `a11y-auditor` scenario runs pending — both from `/flow:validate`.
- Cmd-K type-specific glyphs documented in DDR-011 as deferred (fumadocs 16.8.10 doesn't expose result-type metadata).

### Phase 13 — Stable element IDs + canonical screenshots + cheap helpers — execute complete (2026-05-15)

- [x] Wave A: runtime + inspector (Tasks 1, 2) — `data-dc-screen` on DCArtboard; inspector `cssPath`/`domPath` prefer data-dc-* attrs ✅
- [x] Wave B: helpers (Tasks 3, 4, 15, 16, 17) — `screenshot.sh` + `_screenshot-playwright.mjs` + `bootstrap-check.sh` + `server-up.sh` + `slug.sh` self-test green ✅
- [x] Wave C: callers refactor (Tasks 5–13, 18, 19, 20) — `screenshot.md` / `new.md` / `edit.md` / `setup-ds` SKILL / design SKILL / 2 critics / CATEGORIES.md / CLAUDE.md; envelope directive 15 (element tagging); `data-artboard-id` selector sweep ✅
- [x] Wave D: packaging + audit (Tasks 21, 22) — npm pack ships all 5 helpers via existing `files: ["plugins/design/dev-server"]` (no edit needed); grep audit zero hits for screenshot/bootstrap/server/slug inline duplicates ✅

Live smoke against repo (`Canvas Viewport.html`, 10 artboards): `screenshot.sh --all-screens` captured 10/10 PNGs (55 KB first); `--full` 5 KB; `--screen idle` 42 KB; `bootstrap-check.sh` 0/10/11 exit codes verified across 3 project states; `server-up.sh` alive-detect + stale-respawn green.

Manual smoke deferred: end-to-end `/design:setup-ds → new → edit` in scratch project (Task 22 plan-step) — recommended pre-`/done`.

### design-system-init — Phase 0–6 complete (this execute)

- [x] Phase 0: rename `/design` → `/design:edit` + compat stub + plugin sweep ✅
- [x] Phase 1A: inspiration library skeleton (24 files at `plugins/design/templates/design-system-inspiration/`) ✅
- [x] Phase 1B: SKILL.md `design-system` extended with Bootstrap flow + Mode-detection; copy-tree rename hook; `package.json` files += templates ✅
- [x] Phase 2A: setup-docs rename, `category:` on all 12 commands, new commands (`help`, `setup-ds`, `setup-onboard`), `CATEGORIES.md` ✅
- [x] Phase 2B: missing-state hooks in `edit.md` + `new.md` (auto-invoke onboard → bootstrap) ✅
- [x] Phase 2C: `maude design init` CLI subcommand (Core scaffold from inspiration library) ✅; schema extended forward-compat (Phase 3/4 fields) ✅
- [x] Phase 3: `design-system-completeness-critic` agent (3-tier rules — Core/Conventional/Free-form, adaptive by `activeFamilies` + `completenessProfile`); `commands/critic.md` += `--system-only` flag + short-circuit; skill bootstrap flow wires the critic at scaffold end ✅
- [x] Phase 4: multi-DS canvas wiring — `canvas-meta.schema.json` += `designSystem` + `opt_out_scope` fields; `commands/new.md` parses `--ds=` flag with validation + fail-with-hint on unknown DS; `flow:design-system-guard` scoped to canvas DS (reads `.meta.json.designSystem`) ✅
- [x] Phase 5: CLAUDE.md "Design system bootstrap" section (8 rules: onboard-before-bootstrap, one-skill-owns-DS, 3-sub-modes, inspiration-not-substrate, dynamic-scaffold-count, literal-project-dirname, 3-tier-compliance, daily-verb-is-edit) ✅
- [x] Phase 6: Fumadocs narrative pages — `design/bootstrap.mdx`, `design/categories.mdx`, `design/multi-ds.mdx`; `design.mdx` → `design/index.mdx` (folder pattern); `cli.mdx` += `maude design init` section ✅

**Open carry-over for follow-up release:**

- Inspiration library is **skeleton only** (Core 10 + Universal 6 = 16 specimens populated). `foundations/` (8), `status/` (3), `audience-*/` (5–6 per branch), `platform-*/` (2–5), `theme-both/` (1), `patterns/` (6), `meta/` (4) — total ~38 additional reference files — are stubs documented in `_MAPPING.md` but not yet authored. Single-DS minimum-viable scaffold works today; richer scaffold awaits next library pass.
- Site `categories.mdx` mentions `--all-ds` for the critic — flag exists in critic.md spec but the actual loop logic in the critic agent's pre-flight is described, not yet runtime-tested against a real multi-DS project (no production multi-DS users yet).
- Version bump (Phases 0–6 ship together as v0.8 minor) — separate cycle.

### Phase 2 — Tasks (Fumadocs docs site)

- [x] Task 1: Scaffold Fumadocs in `site/` ✅ — manual `npm create fumadocs-app` by user, then integrated into pnpm workspace (`@maude/site`), `esbuild`+`sharp` allow-listed, build green
- [x] Task 2: Author core MDX pages ✅ — `index`, `getting-started`, `cli`, `flow`, `design`, `config`, `recipes/{nextjs,expo,monorepo}` + sidebar `meta.json`s; home page updated; `test.mdx` removed
- [x] Task 3: Auto-generate command reference ✅ — `site/scripts/build-command-reference.mjs` walks `plugins/{flow,design}/commands/*.md` and emits 37 per-command MDX pages under `content/docs/reference/{flow,design}/<name>.mdx`. Wired as `prebuild`. Output is gitignored.
- [x] Task 4: Render config schema as typed MDX ✅ — `site/scripts/build-schema-reference.mjs` walks `config.schema.json` recursively, emits `content/docs/reference/config-schema.mdx` with every key, type, default, enum, description.
- [x] Task 5: Search + `llms.txt` polish ✅ — Fumadocs default scaffold ships Orama search + `/llms.txt` + `/llms-full.txt` + `/llms.mdx/docs/*`; added `/robots.txt` + root `metadata` (fixes Next `metadataBase` warning).
- [x] Task 6: Deploy infra ✅ — DDR-005 (`docs-site-stack-and-hosting.md`) + `.github/workflows/site-deploy.yml`. Custom domain: `maude.iagh.cz` (subdomain of team-owned `iagh.cz`). Vercel project `maude` in team `Slant` (slug `iagh`).
- [x] Task 7: README de-dup vs docs site ✅ — root `README.md` trimmed 339 → 164 lines. Flow + design command tables removed (now at `/docs/flow`, `/docs/design:edit`); kept quickstart + workspaces + releasing + local-dev (contributor info).

**Carry-over (out of plan scope):**

- Design plugin commands lack `category:` frontmatter → all 8 show as "uncategorized" in auto-gen reference. Cosmetic; align in a follow-up cleanup pass.
- Recipes (Next.js / Expo / monorepo) are documented but not tested end-to-end against fresh repos per Acceptance criterion 4 — needs a manual smoke run after deploy.


### Phase 13 — Tasks (flow command categorization)

- [x] Task 1: `plugins/flow/CATEGORIES.md` — canonical catalog with 9 groups, naming convention, rename history ✅
- [x] Task 2: 11 `git mv` renames + `name:` field updates ✅
- [x] Task 3: `category:` frontmatter on all 29 live commands; `name:` normalized to match filenames ✅
- [x] Task 4: Reference sweep (18 files updated, 0 stale refs remaining outside plan/CATEGORIES/archive/help.md) ✅
- [x] Task 5: 11 backwards-compat stubs under old filenames (shipped in v0.6.0, removed in v0.6.1) ✅
- [x] Task 6: `/flow:help` aggregator command authored ✅
- [x] Task 7: Root `README.md` regrouped + `plugins/flow/README.md` created with naming convention ✅
- [x] Task 8: `CLAUDE.md` — new "Flow command naming" subsection under Architecture ✅
- [x] Task 9: Phase 3 alignment verified (`release-changelog` + `release` ship at final names) ✅
- [ ] Task 10: Phase 2 docs-site flow page — **carry-over** (out of scope here)

### Phase 3 — Tasks (flow changelog integration + /flow:release)

- [x] Task 1: Schema — `integrations.changelog` (provider/scope/releaseGuide/mcp/defaults) ✅
- [x] Task 2: Skeleton default `{changelog: {provider: none}}` ✅
- [x] Task 3: `/flow:release-changelog` command (changesets impl + stub for others) ✅
- [x] Task 4: `/flow:validate` Step 7b — non-blocking changelog hygiene ✅
- [x] Task 5: `/flow:done` Step 4b — overridable changelog reminder ✅
- [x] Task 6: DDR-keeper SKILL.md — provider-choice is DDR-worthy ✅
- [x] Task 7: De-hardcoded `changeset` in `execute.md:179` + `quick.md:37` ✅ (grep clean)
- [x] Task 8: `release-guide.md` template + `mdcc init --provider` propagation ✅ (smoke-tested 4 providers)
- [x] Task 9: `/flow:setup-onboard` Q7 auto-detect + scaffold ✅
- [x] Task 10: `/flow:release` runbook walker ✅
- [ ] Task 11: Docs pages — **deferred** (Phase 2 site dependency, tracked as carry-over)

### Phase 1 — Tasks

- [x] Task 0: Monorepo + workspace bootstrap ✅ tarball shape clean (42 files), parity OK
- [x] Task 1: CONTRIBUTING + CoC + SECURITY ✅ (CoC links Contributor Covenant 2.1)
- [x] Task 2: PR + issue templates ✅ (PULL_REQUEST_TEMPLATE.md + ISSUE_TEMPLATE/{bug,feature,docs,config}.yml)
- [x] Task 3: Wire Dependabot ✅ (.github/dependabot.yml — npm + actions, weekly, grouped)
- [x] Task 4: Bootstrap Changesets ✅ (config + Phase 1 changeset queued; status reports minor)
- [x] Task 5: Version wrapper preserving parity ✅ (scripts/changesets-version.sh)
- [x] Task 6: Quality CI workflow + argv test ✅ (biome + 7 argv tests passing; dev-server JSX excluded — pre-existing debt)
- [x] Task 7: Update publish workflow ✅ (build → publish → GH Release from CHANGELOG)
- [x] Task 8: GitHub repo via gh CLI ✅ (script + JSON payloads + CODEOWNERS + auto-merge-dependabot workflow). Script not yet **applied** to live repo (gated — needs maintainer to run).
- [x] Task 9: Update README ✅ (Workspaces section, reauthored Releasing, new Repo administration section)
- [x] DDR sweep: DDR-001 + DDR-002 written

### phase-3.4-architecture-refactor — fundament partial (2026-05-15)

> Scope this session: DDR groundwork + Task 1 audit + Task 2 deps. Tasks 3-16 (build pipeline, client migration, server rewrite, CSS @layer files, HMR, lazy iframes, perf harness, postinstall pattern, CI matrix, plan updates) deferred to follow-up `/flow:execute` sessions.

- [x] **DDR-012** — React 19 everywhere ✅ (`.ai/decisions/DDR-012-react-19-unified-runtime.md` — supersedes the hybrid Preact+React assumption; relaxes perf budgets to bundle < 80 KB, RAM < 80 MB, first paint < 350 ms)
- [x] **Task 1** — Audit `runtime/` folder ✅ (verdict: canvas-runtime library injected into user HTML pages via `/_runtime/*`, NOT meta-design. Plan hypothesis re: commit `5864f71` was wrong — actual origin is `b200e59`.) → **DDR-016** landed
- [x] **Task 2** — Bun toolchain deps ✅ (`plugins/design/dev-server/package.json` rewritten — `@types/bun`, `react ^19`, `react-dom ^19`, `@types/react ^19`, `@types/react-dom ^19`, `lightningcss ^1.27` in devDependencies; `build`/`build:watch`/`test`/`typecheck` scripts; root `package.json` `engines.bun = ">=1.3"`. No `pnpm install` / `bun install` run yet — defer to Task 3 session to avoid lockfile drift mid-refactor.) Bun 1.3.3 verified locally.
- [x] **DDR-013** — Server modular split + TypeScript ✅ (`.ai/decisions/DDR-013-server-modular-split-typescript.md` — 7 modules (`server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`) + `mem.ts` auxiliary; ≤ 300 LOC each; Context-object communication; no module-level mutable state)
- [x] **DDR-014** — CSS @layer architecture ✅ (`.ai/decisions/DDR-014-css-layer-architecture.md` — `reset, tokens, layout, shell, components, utilities`; Lightning CSS at build time; DS token import via `1-tokens.css`)
- [x] **DDR-016** — `runtime/` folder verdict ✅ (`.ai/decisions/DDR-016-runtime-folder-purpose.md` — canvas-runtime library; renamed `.jsx` → `.tsx` in Task 7; IIFE bundle registers `window.*` globals for backward-compat with user HTML pages)
- [x] **DDR README + DDR-009 update** ✅ (DDR-README index now lists DDR-012/013/014/016; DDR-009's "Companion DDRs" footer renumbered from the old DDR-010..014 numbering to actual DDR-012..016)
- [x] **Task 3** — `build.ts` Bun-driven orchestrator ✅ (client `Bun.build` IIFE + Lightning CSS + per-platform `bun build --compile` + `--watch` HMR broadcast + `--dry-run` smoke)
- [x] **Task 4** — `app.jsx` UMD React → React 19 esm ✅ (`import { ... } from 'react'` + `createRoot` from `react-dom/client`; release bundle 216 KB raw / 69 KB gz — under 80 KB budget)
- [x] **Task 5** — `index.html` bundle-loading ✅ (no more unpkg babel-standalone / UMD)
- [x] **Task 6** — `client/styles/` 6 `@layer` files + Lightning CSS ✅ (0-reset / 1-tokens / 2-layout / 3-shell / 4-components / 5-utilities; `_index.css` declares layer order; output 25 KB minified)
- [x] **Task 7** — `server.mjs` → 7 TS modules on `Bun.serve` ✅ (server.ts/http.ts/ws.ts/api.ts/inspect.ts/history.ts/fs-watch.ts + context.ts factory base + mem.ts; 1963 LOC total; `bun tsc --noEmit` clean; native WS drops handwritten RFC-6455 upgrade; live boot returns correct JSON on /_health /_config /_index-data /_system-data)
- [x] **Task 8** — `mem.ts` ✅ (FinalizationRegistry + WeakMapById + startHeapWatch with warn/panic thresholds; --smol embedded into `bun build --compile`)
- [x] **Task 9** — `client/hmr.mjs` ✅ (CSS-only path zero-risk reload via `<link>` cache-busting; JSX path full-page reload until react-refresh-runtime is wired in Phase 3.5)
- [x] **Task 10** — `client/iframe-lazy.mjs` ✅ (IntersectionObserver mount + content-visibility wrapper + 30s-idle detach + state stash)
- [x] **Task 11** — perf harness + 7 `bun:test` smokes ✅ (server-lifecycle / ws-handshake / active-state / history-rollback (2 tests) / fs-watch / bundle-smoke / binary-smoke; `bun test` = 8 pass 0 fail in 1.6 s; `test/perf-harness.ts` measures cold start + gz bundle + WS p50/p99)
- [x] **Task 12** — postinstall-hardlink distribution ✅ (pragmatic deviation per DDR-015 — `cli/install.cjs` writes `cli/.platform-binary-path` side channel, `design.mjs` execs binary directly for `maude design serve` hot path; `mdcc.exe` stub + `mdcc-safe` (`cli/cli-wrapper.cjs`) fallback for `--ignore-scripts`; 7 sub-packages under `packages/maude-<slug>/`; root `optionalDependencies` pins all 7; full bun-CLI port deferred to Phase 3.5/3.6)
- [x] **Task 13** — `.github/workflows/build-binaries.yml` ✅ (7-platform fail-fast matrix on v*.*.* tags incl. Alpine musl variants + Windows; `publish-main needs: build-binaries`; npm provenance on every sub-package + main)
- [x] **Task 14** — DDR-015 written ✅ (per-platform binary distribution rationale + alternatives + Claude-Code precedent + pragmatic-partial deviation footer)
- [x] **Task 15** — Phase 4 plan reconciled ✅ (already had Phase 3.4 dependency from prior session; verified no stale references to `runtime-agnostic constraint` or `build.mjs`; relaxed Phase 3.4 budget references to DDR-012 values)
- [x] **Task 16** — Phase 3.5 plan reconciled ✅ (Task 4 note about bundle-loading index.html; Task 5 retargeted to `client/styles/1-tokens.css` `@layer tokens`; Validation section bumped — biome/tsc/build are now actual gates, not "skip")

**Files added (Tasks 3-16):**

- `plugins/design/dev-server/build.ts`, `tsconfig.json`, `context.ts`, `server.ts`, `http.ts`, `ws.ts`, `api.ts`, `inspect.ts`, `history.ts`, `fs-watch.ts`, `mem.ts`
- `plugins/design/dev-server/client/styles/{0-reset,1-tokens,2-layout,3-shell,4-components,5-utilities,_index}.css`
- `plugins/design/dev-server/client/{hmr,iframe-lazy}.mjs`
- `plugins/design/dev-server/test/{_helpers,server-lifecycle,ws-handshake,active-state,history-rollback,fs-watch,bundle-smoke,binary-smoke}.{ts,test.ts}` + `perf-harness.ts`
- `packages/maude-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,win32-x64}/{package.json,README.md}` (7 sub-packages)
- `cli/{install.cjs,cli-wrapper.cjs,bin/mdcc.exe}` (postinstall + safe-mode bin + 500-byte stub)
- `.github/workflows/build-binaries.yml`
- `.ai/decisions/DDR-015-per-platform-binary-distribution.md`

**Files modified (Tasks 3-16):**

- `plugins/design/dev-server/client/{app.jsx,index.html}` (React 19 esm; bundle-loading)
- `plugins/design/dev-server/package.json` (typescript + bun-types added)
- `package.json` (root: `bin.mdcc-safe`, `postinstall`, `optionalDependencies` × 7, `start`/`dev` use `bun run server.ts`, `build:binary` + `test:dev-server` scripts)
- `cli/commands/design.mjs` (side-channel binary path resolution for `maude design serve`)
- `scripts/{check-version-parity.sh,bump-version.sh}` (sub-package + optionalDependencies pin parity)
- `.ai/decisions/README.md` (DDR-015 indexed)
- `.ai/plans/{phase-4-canvas-v2-rendering-engine,phase-3.5-dev-server-ui-ux-refresh}.md` (3.4 alignment notes)

**Verification status this session:** No `bun run build.ts` exists yet (Task 3); no tests run; JSON syntax + Bun 1.3.3 install verified. Edit-Verify Loop is N/A — work is purely additive paper artifacts (DDRs) + a `package.json` rewrite with no runtime callers yet.

**Files modified:**

- `.ai/decisions/DDR-009-bun-runtime-authoritative-for-dev-server.md` — companion-DDRs footer renumbered
- `.ai/decisions/README.md` — index updated for DDR-012/013/014/016
- `.ai/state/STATE.md` — Phase header + Decisions list + History row + this section

**Files created:**

- `.ai/decisions/DDR-012-react-19-unified-runtime.md`
- `.ai/decisions/DDR-013-server-modular-split-typescript.md`
- `.ai/decisions/DDR-014-css-layer-architecture.md`
- `.ai/decisions/DDR-016-runtime-folder-purpose.md`
- `plugins/design/dev-server/package.json` — full rewrite (was 12-line stub)
- `package.json` — root `engines.bun: ">=1.3"` added
