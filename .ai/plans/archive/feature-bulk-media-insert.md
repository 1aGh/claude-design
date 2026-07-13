# Feature: Bulk media insert (reuse AssetPicker as an insert tool) + fix flaky multi-file drag-drop

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — this plan touches the Phase-23 media-intake stack (`use-canvas-media-drop.tsx` + `annotations-layer.tsx`) and the Stage-F AssetPicker (`client/app.jsx`), both already carry a lot of load-bearing history documented inline. Read the comments, not just the code.

## Description

Two related problems in Maude Studio's canvas media intake, both reported live by the user:

1. **Data loss on bulk Finder drag-drop.** Selecting N photos (or any mix of image/video/audio) in Finder and dragging them onto the canvas together sometimes inserts all N, but often silently drops some — 1 shown, sometimes 2, non-deterministically. Applies to every supported media kind, not just images.
2. **No bulk "insert" tool.** The AssetPicker (`Choose media` dialog) already exists and is reused across three purposes today — Insert ▸ Image (into an artboard), Replace… (an artboard `<img>`/`<video>`), and Replace… on an annotation — but every one of them is single-file, single-target. There is no way to pick several photos at once and drop them onto the canvas, and no way to explicitly choose "as an annotation" vs "into the artboard" the way drag-drop implicitly always chooses "annotation."

## User Story

As someone building out a canvas, I want to pick several photos at once (or drag several from Finder) and have all of them reliably land on the canvas — either as artboard content or as free-floating annotations — so that populating a moodboard or a set of screens doesn't mean one-file-at-a-time babysitting.

## Problem

### Bug: concurrent stroke commits clobber each other

`annotations-layer.tsx` keeps its `strokes` array in `useState` and mirrors it into `strokesRef` **during render** (`apps/studio/annotations-layer.tsx:936-937`, `strokesRef.current = strokes`). Every insert path follows the same shape:

```
const before = strokesRef.current;
… commitStrokes(before, [...before, newStroke], label) …
```

`commitStrokes` (`annotations-layer.tsx:1075-1089`) builds an explicit before/after undo record and eventually calls `putStrokes(next)` (`:1039-1057`), which does `setStrokesState(next)` — a **direct** assignment, not a functional updater. `strokesRef.current` only catches up on the *next* render.

The Phase-23 batch-drop path (`use-canvas-media-drop.tsx:343-384`, added specifically to fix an earlier "only the first file lands" bug) fires `onImage`/`onMedia` **synchronously in a loop**, once per dropped file. Each call kicks off its own independent async chain — `Image.onload` decode for images (`createImageFromFile`, `annotations-layer.tsx:1334-1381`), `uploadAsset(file).then(...)` for video/audio (`createMediaReference`, `:1414-1446`) — and each chain independently reads `strokesRef.current` and calls `commitStrokes`/`setStrokesState` when *it* finishes. Decode/upload timing varies per file (size, cache, network), so these completions land in an unpredictable order relative to React's render/commit cycle. When two completions resolve close enough together that `strokesRef.current` hasn't caught up between them, the second one's `before`/`after` snapshot doesn't include the first one's stroke — and the second `setStrokesState(next)` **overwrites** it. This is exactly the "sometimes 1, sometimes 2, sometimes N" symptom: it depends on real-world decode/upload timing, not code path.

The very first optimistic insert in `createImageFromFile` (`:1359`, `setStrokesState([...strokesRef.current, optimistic])`) has the identical bug one step earlier — a raw array literal instead of a functional updater — so even the instant blob-preview can flicker/lose an entry before upload ever finishes.

`structuralWrite` in `client/app.jsx` (`:9590-9621`) already solved an analogous problem for **artboard** structural edits by serializing every write through a ref-held promise chain (`editApplyChainRef`) so concurrent `insertElementShell` calls never race each other server-side. The annotation layer has no equivalent for its client-side state.

### Gap: AssetPicker can't do bulk or "insert as annotation"

- `AssetPicker` (`client/app.jsx:857-1005`) grid cells are `onClick={() => onPick(a.path)}` — one click picks one asset and closes. Its own upload button creates a bare `<input type=file>` (no `multiple`) and reads `input.files?.[0]`.
- The native-desktop path (`pickMediaFile` → Rust `pick_media_file`, `apps/desktop/src-tauri/src/lib.rs:151-179`) uses Tauri's `.pick_file()` (singular) and returns one `{name, bytes}`.
- `insert-image-request` (posted by the tool-palette Image tool, `tool-palette.tsx:365-382`, and by the canvas-shell context menu, `canvas-shell.tsx:1568`) requires an anchor — `resolveInsertAnchor()` (`tool-palette.tsx:303-317`) returns `null` when the canvas has **no artboard at all**, and the app.jsx handler (`:8832-8858`) no-ops when neither `refId` nor `artboardId` is present. So today, on an empty canvas, "Insert Image" does nothing — there's no "just drop it on the canvas as an annotation" fallback from that entry point (only drag-drop/paste reach the annotation layer).
- `/_api/insert-element`'s `kind` is capped to `div | text | image` (`apps/studio/api.ts:2686-2724`) — there is no server-side way to insert a `<video>`/`<audio>` element into an artboard. Video/audio can only ever become an annotation `MediaRefStroke`. This is an existing, deliberate constraint (Phase-23/DDR-148), not something this plan changes.

## Solution

**Part A — fix the race** (must land first; Part B's new batched-annotation-insert path reuses the same correctness discipline).

Make every annotation-layer commit path that can be triggered concurrently either (a) use a functional `setState` updater so React itself serializes composition, or (b) go through a single ref-held promise chain whose accumulator — not `strokesRef.current` — is the source of truth for the next link's "before" snapshot. `structuralWrite`'s `editApplyChainRef` is the proven precedent for the second shape.

Scope of the fix is the async-completion-driven, batch-triggerable call sites only: `createImageFromFile`'s optimistic insert + post-upload swap, and `createMediaReference`'s post-upload commit. Synchronous, single-gesture tools (pen/shape/drag/resize, single sticker drop) are not reported as buggy, are inherently one-at-a-time (a human can't click twice in the same tick), and are out of scope — chaining them too would be unjustified surface area for a bug that doesn't reproduce there.

**Part B — generalize AssetPicker into a bulk insert tool.**

Give the picker a `multiple` mode (new prop, opt-in — existing single-pick Replace… purposes are untouched) with checkbox-select grid cells, a multi-file upload input (`input.multiple` on web; a new `pick_media_files` Tauri command on desktop), and — only in multi/insert mode — a destination toggle: **Add to artboard** (default when an artboard anchor is resolvable and every selected asset is an image) vs **Add as annotation** (default/forced otherwise — no artboard on canvas, or the selection includes video/audio). Confirming inserts everything in one action:

- **Artboard destination**: loop `insertElementShell` once per image path — already race-safe today via `editApplyChainRef`, no new server work needed.
- **Annotation destination**: one new batched message (`insert-annotation-media`, paths[]) handled by a new function in `annotations-layer.tsx` that resolves all dimensions up front (`Promise.all` of `Image` probes for the image paths; fixed sizing for video/audio, matching `createMediaReference`) and performs exactly **one** `commitStrokes` call — correct by construction, no chain needed for this new path since there's no per-item async race once all N paths are already resolved.

Also relax the tool-palette/context-menu entry point so "Insert Image" still opens the picker (annotation-only) when `resolveInsertAnchor()` returns `null`, instead of silently no-op'ing.

---

## Metadata

- **Type**: Bug Fix + Enhancement
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server client + a small `apps/desktop/src-tauri` addition)
- **Affected Systems**: canvas annotation layer (client-side state + undo), AssetPicker dialog, tool-palette, canvas-shell context menu, Tauri native file dialog
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read every file/range listed here in parallel in a single assistant message before starting Part A.

- `apps/studio/use-canvas-media-drop.tsx` (whole file, 443 lines) — Why: owns the DOM drag/drop/paste wiring + the existing batch-file-filter dispatch loop (`:343-384`) that fires N concurrent `onImage`/`onMedia` calls; also owns `MediaPayload`/`MediaIntent`/`classifyMediaPayload`, all pure and unit-tested already.
- `apps/studio/annotations-layer.tsx` lines 830-940 (state + `strokesRef` sync), 1039-1089 (`putStrokes`/`commitStrokes`), 1253-1303 (`replace-annotation-media` + `insert-sticker` message handlers — the pattern to mirror for the new `insert-annotation-media` handler), 1330-1465 (`createImageFromFile`, `createLink`, `createMediaReference`, `mediaCallbacks`, the `useCanvasMediaDrop` wiring) — Why: every function this plan touches or mirrors.
- `apps/studio/client/app.jsx` lines 857-1005 (`AssetPicker` component), 8815-8871 (`insert-image-request`/`replace-media-request`/`replace-annotation-media-request` message handlers), 9589-9624 (`structuralWrite` + `editApplyChainRef` — the proven serialization precedent), 9638-9660 (`insertElementShell`), 9668-9686 (`insertGeneratedImage` — pattern for resolving a target artboard without an explicit anchor), 9880-9975 (`assetPickerReq` state + `onAssetPicked`), 11171-11178 (`<AssetPicker>` render call site) — Why: the picker's full request/response lifecycle and the artboard-insert write path this plan reuses as-is.
- `apps/studio/tool-palette.tsx` lines 303-317 (`resolveInsertAnchor`), 358-382 (`insertViaPalette`) — Why: the anchor-resolution no-op this plan needs to relax.
- `apps/studio/canvas-shell.tsx` around line 1568 — Why: the second `insert-image-request` entry point (context menu).
- `apps/studio/api.ts` lines 1544-1580 (`listAssets` — already returns image/video/audio `kind`), 2686-2745 (`insertElementOp` — confirms `kind` is capped to `div|text|image`, no server change needed/possible for video-into-artboard) — Why: server-side ceiling that shapes the destination-toggle constraint (video/audio → annotation only).
- `apps/desktop/src-tauri/src/lib.rs` lines 130-180 (`pick_media_file` command + its `generate_handler!` registration around line 269) — Why: template for the new `pick_media_files` command; see the `build.rs`/capabilities gotcha below.
- `apps/studio/client/styles/3-shell-maude.css` — Why: home of the existing `.st-ap-grid`/`.st-ap-cell`/`.st-asset-picker` rules; new multi-select/toggle/confirm-bar styles land here.
- `apps/studio/test/canvas-media-drop.test.ts` and `apps/studio/test/annotations-layer.test.ts` (`Phase 23 image + link geometry` section, ~line 701) — Why: existing pure-function test patterns to extend.

### Patterns to Follow

**Serialized write chain (the fix for Part A, precedent already in this repo)** — `client/app.jsx:9590-9621`:

```js
const structuralWrite = useCallback((route, body, {...}) => {
  editApplyChainRef.current = editApplyChainRef.current
    .catch(() => {})
    .then(() => fetch(route, {...}).then(...));
}, [...]);
```

The annotation-layer fix needs the same *shape* but must NOT rely on `strokesRef.current` inside each chain link (React's re-render may not have run between two links resolved in the same microtask window — that's the bug). The chain link itself must carry the accumulator forward (seed once from `strokesRef.current` when the chain is idle; every subsequent link's `before` is the *previous link's returned array*, not a fresh read of the ref).

**Batched, single-commit annotation insert (the new path in Part B)** — mirror `insert-sticker`'s handler shape, `annotations-layer.tsx:1277-1303` (viewport-center placement, no cursor position available) combined with the `BATCH_DROP_CASCADE_PX` stagger already defined in `use-canvas-media-drop.tsx:306` (28px offset per item so a batch doesn't stack on one point).

**Resolving a target artboard without an explicit anchor** — `client/app.jsx:9668-9686` (`insertGeneratedImage`): `selectedRef.current?.artboardId ?? canvasActiveArtboard ?? null`, insert `inside-end`.

---

## Tasks

Execute in order. Part A (1-5) must land and be verified before Part B's annotation-insert path (which reuses its correctness discipline) is built.

### Part A — Fix concurrent stroke-commit data loss

### Task 1: UPDATE optimistic insert in `createImageFromFile` to a functional setState updater ✅

- **Do**: In `annotations-layer.tsx:1359`, change `setStrokesState([...strokesRef.current, optimistic])` to the functional form `setStrokesState((prev) => [...prev, optimistic])`. React composes queued functional updaters against each other correctly regardless of render timing — this alone fixes the optimistic-preview half of the race.
- **Pattern**: Standard React functional `setState` updater.
- **Gotcha**: Don't touch the *other* uses of `strokesRef.current` in this same function (the `.then()` continuation still needs the chain fix in Task 2 — a functional updater alone doesn't help there because that step also needs an accurate `before` snapshot for the undo record, which `commitStrokes` requires as an explicit argument, not something a bare setState updater can supply).
- **Validate**: `cd apps/studio && bun test` (no behavior change expected in existing tests); manual: drop 1 image, confirm it still appears normally.

### Task 2: ADD a serialized, accumulator-backed commit chain for image final-swap + media-reference commit ✅

- **Do**: Add a ref-held promise chain in `annotations-layer.tsx` (e.g. `mediaCommitChainRef`, module-local `useRef`) that both `createImageFromFile`'s post-upload swap (`:1360-1372`) and `createMediaReference`'s post-upload commit (`:1419-1443`) enqueue onto instead of calling `commitStrokes` directly. Each chain link must: read the *previous link's resulting array* (seeded from `strokesRef.current` only when the chain was idle before this link), compute its own `before`/`after` from that, call `commitStrokes(before, after, label)`, and return `after` so the next queued link starts from it. This is the part that actually fixes the reported bug — Task 1 only fixes the earlier optimistic-preview flicker.
- **Pattern**: `structuralWrite`'s `editApplyChainRef` (`client/app.jsx:9590-9621`) for the *chaining* shape; the accumulator requirement (not just execution order) is the added correctness piece this bug needs.
- **Gotcha**: `createLink` (URL drop) and the pen/shape/drag tools intentionally stay OUTSIDE this chain (see Problem section — single-shot/user-gesture-paced, not reported buggy, adding them would be unjustified surface). Extract the chain-link primitive as a small, framework-free function if it can be cleanly separated from the `useRef` wiring — makes Task 4's unit test possible without a DOM.
- **Validate**: `cd apps/studio && bun test`; proceed to Task 4/5 for real coverage of the fix.

### Task 3: Confirm `createMediaReference` and `createImageFromFile` both route through the Task 2 chain ✅

- **Do**: Sanity pass — both functions' final `commitStrokes` call must go through the new chain, nothing else. `createLink` (`:1385-1407`) is unchanged.
- **Validate**: grep for `commitStrokes(` in `annotations-layer.tsx` inside `createImageFromFile`/`createMediaReference`/the new chain helper — confirm they're the only call sites touched.

### Task 4: ADD a unit test for the chain's no-loss guarantee ✅

- **Do**: In `apps/studio/test/annotations-layer.test.ts` (or a new adjacent test file if the chain primitive from Task 2 is extracted standalone), drive N (e.g. 8) fake async "completions" through the chain helper with randomized/staggered resolution order (`setTimeout`/`Promise.resolve` interleaving designed to land some in the same microtask tick) and assert the final accumulated array contains all N appended items exactly once, regardless of completion order. This isolates the concurrency fix from React/DOM/real image decode timing so it's deterministically testable.
- **Pattern**: existing `describe`/`test` style in `annotations-layer.test.ts` (`bun:test`).
- **Validate**: `cd apps/studio && bun test` — new test passes; re-run a few times locally to confirm it isn't itself flaky (if it can be, the interleaving isn't actually exercising the race — tighten it).

### Task 5: Live-verify the drop-race fix via agent-browser ✅

- **Do**: Against a running dev server, open a canvas and dispatch a **synthetic** multi-file `drop` event (construct `File` objects in-page via `new File([...], name, {type})`, build a `DataTransfer`, dispatch on `document`) with a mix of image/video/audio, for a few batch sizes (2, 5, 8) and a few repeated runs each (the bug is probabilistic — one clean run doesn't prove the fix). After each run, GET `/_api/annotations?file=<canvas>` and count `[data-tool="image"]` + `[data-tool="mediaref"]` elements in the returned SVG; assert the count equals the number of files dropped.
- **Pattern**: the video-comp "Assemble dropped clips" flow already does exactly this `/_api/annotations?file=` GET + SVG parse (`client/app.jsx`, the `assemble` handler referenced in Context References) — mirror its parsing.
- **Validate**: 0 lost files across all batch sizes/runs. This is the actual acceptance bar for Part A.

---

### Part B — Bulk "Insert Media" tool (artboard or annotation destination)

### Task 6: UPDATE `AssetPicker` to support a `multiple` selection mode ✅

- **Do**: Add a `multiple` boolean prop to `AssetPicker` (`client/app.jsx:857`). When true: grid cells become toggle-selectable (checkbox overlay, click toggles membership in a local `Set` of selected paths, instead of instantly calling `onPick`); the "Upload…" button's browser `<input>` gains `multiple` and iterates `input.files` (all of them, each uploaded independently via the existing `doUpload`-shaped POST — uploads are independent/idempotent, no ordering concern); newly uploaded assets are added to the selection set once each POST resolves. When `multiple` is false/absent, all existing behavior (single click = instant pick, single-file input) is unchanged — Replace… purposes pass no `multiple` prop and are untouched.
- **Pattern**: existing grid rendering (`:986-1002`) and `openFilePicker`/`doUpload` (`:936-1005`).
- **Gotcha**: don't change the `onPick(path)` single-path callback contract used by `replace-src`/`replace-annotation-media` — add a *separate* `onPickMany(paths, destination)` callback used only when `multiple` is true, wired from a new confirm bar (see Task 7).
- **Validate**: `cd apps/studio && bun test`; manual: open the picker in an existing single-pick call site, confirm no visible change.

### Task 7: ADD a destination toggle + confirm bar to the picker in `multiple` mode ✅

- **Do**: When `multiple` is true, render a footer once ≥1 item is selected: a count ("3 selected"), a two-option toggle **Add to artboard** / **Add as annotation**, and Insert/Cancel buttons. "Add to artboard" is disabled (and destination forced to annotation) when either (a) no artboard anchor was resolvable when the picker opened (passed in as a prop — see Task 9), or (b) the current selection includes any `kind !== 'image'` asset (server can't insert video/audio into an artboard — see `insertElementOp`'s `kind` cap in Context References). On confirm, call `onPickMany(selectedPaths, destination)`.
- **Pattern**: none existing in this file for a multi-state toggle — keep it a plain controlled `useState` local to `AssetPicker`, no new abstraction needed.
- **Validate**: manual — select a mix of image+video, confirm "Add to artboard" is disabled with the reason visible (tooltip/inline note); select images only with an artboard present, confirm it's enabled and defaulted on.

### Task 8: ADD `pick_media_files` Tauri command for native multi-select (desktop) ✅

- **Do**: Add a new Rust command in `apps/desktop/src-tauri/src/lib.rs` alongside `pick_media_file` (`:151-180`), using `.pick_files()` (plural) instead of `.pick_file()`, returning `Vec<PickedMedia>`. Wire it through `generate_handler!` (near `:269`), the relevant `capabilities` allow-list entry, and `build.rs`'s `commands()` list — all three are required or the command hard-panics at runtime (a `cargo check` will NOT catch a missing `build.rs` entry). On the JS side (`client/app.jsx`), branch `isNativeApp()` in the picker's upload handler to call this instead of the single-file `pickMediaFile()` when `multiple` is true.
- **Pattern**: `pick_media_file` itself (`:143-180`), including its `MAUDE_E2E_OPEN_PATH` debug-only override for desktop-e2e — mirror that for the new command too so it stays testable via the existing WebdriverIO harness.
- **Gotcha**: this is the one piece of this plan that can't be verified headlessly (native OS dialog). Sequence it last — the web/browser multi-select path (Tasks 6-7, 9-13) ships a complete, working feature on its own; this task only extends it to desktop and can be deferred as a fast-follow without blocking the rest. Existing single-file native picking is unaffected either way.
- **Validate**: real desktop build (`pnpm --filter @maude/desktop ...` per this repo's desktop dev flow) + manual dogfood — pick 3 files in the native dialog, confirm all 3 upload. No automated coverage possible for the OS dialog itself; the WebdriverIO desktop-e2e harness can drive everything downstream of the `MAUDE_E2E_OPEN_PATH` override if a scenario is added.

### Task 9: UPDATE tool-palette + context-menu entry points to allow an anchor-less "Insert Image" ✅

- **Do**: In `tool-palette.tsx`'s `insertViaPalette('image')` (`:365-382`), when `resolveInsertAnchor()` returns `null`, still post `insert-image-request` but with neither `refId` nor `artboardId` (instead of returning early / no-op). In `client/app.jsx`'s handler (`:8832-8858`), relax `okShape`'s `hasRefId !== hasArtboardId` requirement to also accept `!hasRefId && !hasArtboardId` for this verb, and pass that "no anchor" state through to `openAssetPickerRef.current?.({purpose: 'insert-image', multiple: true, hasArtboardAnchor: false, ...})` so the picker (Task 7) knows to force annotation-only.
- **Pattern**: the existing `okShape` check right above it in the same handler.
- **Gotcha**: this only relaxes the *no-artboard-at-all* case. The context-menu path (`canvas-shell.tsx:1568`) always fires from a right-click on something, so it always has an anchor already — no change needed there beyond passing `multiple: true`/`hasArtboardAnchor: true` through.
- **Validate**: manual — on a brand-new canvas with zero artboards, use the tool-palette Image tool; picker should open (previously: silent no-op).

### Task 10: UPDATE `onAssetPicked` to handle the new bulk purpose ✅

- **Do**: In `client/app.jsx`'s `onAssetPicked` (`:9891-9965`), add handling for `onPickMany(paths, destination)` fired from the picker: when `destination === 'artboard'`, loop `insertElementShell(undefined, 'inside-end', 'image', {artboardId, src: path})` once per path (resolve `artboardId` the same way `insertGeneratedImage` does, `:9668-9686`) — already race-safe via `editApplyChainRef`, no new serialization needed here. When `destination === 'annotation'`, send **one** `postToActiveCanvas({dgn: 'insert-annotation-media', paths})` message (not one per path) so the canvas-side handler (Task 11) can do a single atomic commit.
- **Pattern**: existing `insert-image`/`replace-src`/`replace-annotation-media` branches in the same function.
- **Validate**: `cd apps/studio && bun test`; proceed to Task 13 for live coverage.

### Task 11: ADD the `insert-annotation-media` batched handler in `annotations-layer.tsx` ✅

- **Do**: Add a new function (e.g. `createMediaFromAssetPaths(paths, world)`) and a new `if (m.dgn === 'insert-annotation-media' && Array.isArray(m.paths))` branch in the existing message listener (mirror the `insert-sticker` handler shape, `:1277-1303`, for viewport-center world resolution when there's no cursor position). For each path: resolve its `kind` (image vs video/audio — reuse the same extension classification `listAssets` uses server-side, or thread `kind` through from the picker since it already knows it from `/_api/assets`), probe natural dimensions for images via `Promise.all` of `Image()` loads (fixed `MEDIAREF_DEFAULT_W/H`-style sizing for video/audio, matching `createMediaReference`), stagger positions by `BATCH_DROP_CASCADE_PX` per item (same constant `use-canvas-media-drop.tsx:306` already exports/uses), then build the full `Stroke[]` and call `commitStrokes` **once** for the whole batch.
- **Pattern**: `createImageFromFile`'s dimension-probing (`:1338-1345`) and `createMediaReference`'s stroke shape (`:1414-1446`) — same math, just resolved for N items before one commit instead of N independent commits.
- **Gotcha**: this path does NOT need the Task 2 chain — it's correct by construction (all inputs resolved before the single state write). Don't over-engineer it into using the chain too.
- **Validate**: `cd apps/studio && bun test`; proceed to Task 13.

### Task 12: ADD CSS for multi-select grid state + destination toggle + confirm bar ✅

- **Do**: In `apps/studio/client/styles/3-shell-maude.css`, alongside the existing `.st-ap-*`/`.st-asset-picker` rules, add selected-state styling for grid cells (checkbox/overlay), the destination toggle, and the confirm footer bar. Token-only colors (no hardcoded hex) per this repo's own DS discipline.
- **Validate**: visual check via `/design:screenshot` or a live browser look at the picker in multi mode.

### Task 13: Live-verify bulk insert end-to-end via agent-browser ✅

- **Do**: Against a running dev server: (a) open the picker via the tool-palette Image tool on a canvas WITH an artboard, multi-select 3 images, confirm "Add to artboard" default, insert — assert 3 new `<img>` elements land in the artboard source. (b) Same canvas, select 2 images + 1 video, confirm "Add to artboard" is disabled, switch to "Add as annotation", insert — assert exactly 3 strokes (2 `image` + 1 `mediaref`) via the `/_api/annotations?file=` SVG count (same technique as Task 5). (c) On a canvas with NO artboard, confirm the tool-palette Image tool now opens the picker (Task 9) and only "Add as annotation" is available.
- **Validate**: all three scenarios pass with the correct count and destination each time.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server`
3. **Build**: `pnpm build`
4. **Manual**: Task 5 (drop-race) and Task 13 (bulk-insert) live-browser scenarios above — these are the actual acceptance bar for this plan; static checks alone can't catch a timing race or verify a picker UI flow.
5. **Desktop** (if Task 8 is included in this pass): real `.app` build + manual multi-select dogfood, per this repo's native-verification norms (`apps/desktop` phases are dogfooded, not headlessly verified).

---

## Acceptance Criteria

- [x] Dropping N mixed-kind files (image/video/audio) from Finder always produces exactly N strokes, across repeated runs at N = 2, 5, 8 (Task 5). Live-verified against a real dev server: 9/9 runs (3 batch sizes × 3 repeats) — 0 loss, 50 distinct stroke ids in valid XML. A second, tighter race (idle-reset reading a stale snapshot before React's render caught up) was caught by this same live pass and fixed with an id-based reconciliation in the chain primitive (see media-commit-chain.ts).
- [x] AssetPicker supports multi-select (grid + upload) in `multiple` mode without changing single-pick Replace… behavior (Task 6).
- [x] Picker offers "Add to artboard" / "Add as annotation", correctly disabling artboard when no anchor exists or the selection includes non-image kinds (Task 7). Live-verified (screenshot + DOM state).
- [x] Tool-palette "Insert Image" no longer no-ops on an artboard-less canvas (Task 9). Live-verified — picker now opens, annotation-only.
- [x] Bulk artboard insert and bulk annotation insert both verified live via agent-browser with correct counts (Task 13). All 3 scenarios (with-artboard bulk, mixed-kind forced-annotation, no-artboard) passed.
- [x] `bun test` (apps/studio) passes for every touched file; `bunx tsc --noEmit` and `biome check` show 0 new errors/warnings on touched files. (This repo's package.json has no root `pnpm lint`/`pnpm test:dev-server` scripts as named in this plan's Validation section — see note there.)
- [ ] No DDR-worthy decision left unrecorded — the new commit-chain-with-accumulator pattern and the batched `insert-annotation-media` protocol are worth a short DDR at `/flow:done` time (precedent: DDR-148/150/152 already cover this same media-intake surface). Deferred to `/flow:done`.
- [x] Code follows project conventions, no regressions (biome/tsc clean; existing single-pick behaviors preserved byte-for-byte per Task 6's gotcha).
