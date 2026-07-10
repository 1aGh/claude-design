# Feature: In-app photo editor for Maude Studio

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Add a real photo-editing surface to Maude Studio: magic background removal, basic adjustments (exposure/contrast/saturation/etc.), filters, duotone, grain, pattern overlays, and preset masks. It must work on **both** places a photo can already live in a canvas — an `<img>` authored directly in artboard TSX, and an `ImageStroke` dropped/pasted into the annotation layer — surfaced as a new tab in the right Inspector panel (next to CSS) and reachable from the right-click context menu. Critically, every edit must be scriptable by Claude Code itself, headlessly, via the `maude` CLI / a new `/design:photo` command — not just clickable by a human.

## User Story

As a Studio user (human or Claude Code acting on their behalf), I want to remove a photo's background and tune its look (adjustments, duotone, grain, patterns, masks) directly in the canvas I'm already designing in, so that I don't have to round-trip through an external photo editor — and I want every one of those edits to be drivable from the CLI so an agent can apply them without me clicking sliders.

## Problem

Today a "photo" in a Studio canvas is just inert pixels: a hand-authored `<img src>` in TSX, or an `ImageStroke` in the annotation SVG layer (drag-drop/paste). There is no adjustment, filter, duotone, grain, pattern, mask, or background-removal capability anywhere in the Studio, the Inspector, or `canvas-lib.tsx` — confirmed by exhaustive grep across the client, the Inspector's `CssKnobs`, and the vector `draw/` engine. CSS `filter:`/`backdrop-filter` are explicitly excluded from the curated Inspector UI today (DDR-104), reachable only through a raw-text escape hatch.

## Solution

A new **non-destructive photo pipeline** built on `pixi.js` (already a declared, currently-dormant dependency — DDR-024 parked it for viewport rendering, never for this), driven by a first-class `PhotoEdit` sidecar object (content-addressed next to the source asset), rendered live via a new canvas-lib `<PhotoLayer>` WebGL compositor, edited through a new Inspector "Photo" tab + context-menu entry, and scriptable headlessly through a new `maude design photo-*` CLI verb family + `/design:photo` slash command that mirrors the existing `draw-build.sh`/`draw-proof.sh` pattern. Background removal runs entirely client-side (WASM/WebGPU via `@imgly/background-removal`, never the native-addon Node variant) so it never touches the `bun --compile` single-binary constraint that already ruled out `sharp` (DDR-070).

### How this decision was reached

This plan's architecture was set via a divergent 3-seat debate (BUILDER/SHIPPER/BREAKER) followed by your explicit choice, not by me alone:

- **BUILDER** argued for waking `pixi.js` into a WebGL raster pipeline on a new first-class "photo" object, plus building the headless background-removal CLI harness in v1 — the most ambitious viable option.
- **SHIPPER** and **BREAKER** both argued for staying purely on SVG/CSS filters applied to the existing `ImageStroke` annotation-layer image, with the headless bg-removal harness deferred to a phase 2 (SHIPPER) — a smaller, lower-risk v1.
- **You chose BUILDER's approach** on both forks: the WebGL/pixi.js pipeline on a new photo object, and building the headless bg-removal harness now, not later.
- You additionally clarified mid-plan that editing must cover **both** image contexts (artboard `<img>` AND annotation `ImageStroke`) from v1, with the Inspector tab appearing conditionally per selection type, and a context-menu entry alongside it — this plan's task list reflects that clarification directly (Stage E/F).

The tasks below carry BUILDER's own flagged top risk (WebGL per-iframe bundle fragility — the precedent is the v0.22.0 `motion` bundle breaking in CI) and BREAKER's flagged top risk (a new versioned data-model type needs explicit taxonomy sync) forward as **Stage A / Stage H** mitigation tasks, not as open gaps.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/studio` (dev server + client + canvas-lib), `cli/` (new verbs), `plugins/design/` (new slash command + docs)
- **Affected Systems**: Studio Inspector panel, canvas-shell context menu, annotation-layer context menu, per-iframe runtime bundle (`runtime-bundle.ts`), canvas-origin route allowlists (`http.ts` + `server.ts`), `maude` CLI dispatch, `/design:*` slash commands, DDR-115 runtime-state taxonomy
- **Dependencies (new)**: `pixi.js` (^8, already declared — being activated, not added), `@imgly/background-removal` (browser/WASM variant only — the Node/native variant is explicitly excluded, see Task 11's Gotcha)

---

## Context References

### Must-Read Files

> Read every file below in parallel in a single assistant message during `/flow:execute` — they're independent context loads.

- `apps/studio/client/app.jsx:5518-5981` (`InspectorPanel`) — the three-tab (Inspect/Layers/CSS) panel the new "Photo" tab slots into; tab bar at `:5824-5837`, tab-body branch chain `:5847-5977`, mount site `:8805`.
- `apps/studio/client/app.jsx:4280-5178` (`CssKnobs`) — the pattern to mirror exactly: `commit()`/`post()`/`record()`/`onOptimistic()` helpers (`:4342-4432`), `makeScrub` drag-to-value (`:4461-4517`), provenance dots (`:4547-4578`), section layout (`SECTION_PROPS`, `:4597-4632`). The new `PhotoKnobs` component should reuse these helpers, not reimplement them.
- `.ai/decisions/DDR-104-css-panel-ux-model.md` — why `filter`/`backdrop-filter` are currently excluded from the curated Inspector UI (line 27); this plan is the first curated surface for that CSS family, on a *different* write path (its own route, not `edit-css`), so it doesn't reopen DDR-104's exclusion — record this distinction in the new DDR (Task 27).
- `apps/studio/use-selection-set.tsx:40-73` (`Selection` shape) and `:132` (`postMessage({dgn:'select-set', ...})`) — where to add an `isPhoto`/`photoKind` flag so `InspectorPanel` can conditionally render the Photo tab per the artboard-`<img>` vs. annotation-`ImageStroke` distinction.
- `apps/studio/annotations-model.ts:235-250` (`ImageStroke` type) and `apps/studio/annotations-layer.tsx:4252-4270` (`<image href=... />` render) — the annotation-layer image representation the pixi.js compositor must also target.
- `apps/studio/draw/primitives.ts:448-566` (`fe()`, `filter()`, `grainFilter()`, `pattern()`, `mask()`, `clipPath()`) — the existing SVG filter/effect toolkit; not reused directly (this plan is WebGL-based per the debate outcome) but the API shape (parametric, composable builders) is the right model for `apps/studio/photo/filters.ts`.
- `apps/studio/runtime-bundle.ts:44-113` (`RUNTIME_PACKAGES`) — `'pixi.js'` is already listed (`:55`, comment `:50-54` calls it "reserved for future... DDR-024 deferred path" — that comment is now stale and must be updated); this is where `@imgly/background-removal` gets added for the same lazy per-iframe bundling.
- `apps/studio/http.ts:2139-2147` (`CANVAS_SAFE_API`) and `apps/studio/server.ts:238-252` (`startCanvasServer` `routes` map) — the two allowlists the new `/_api/photo-edit` route must be added to together (CLAUDE.md's documented DDR-088 rollout bug: listing a route in only one 404s it from the canvas iframe, since Bun matches `routes` before `fetch`).
- `apps/studio/http.ts:1783-1817` (`POST /_api/asset` handler) and `apps/studio/api.ts:1227-1357` (`saveAssetFromStream`) — the existing content-addressed binary-write route the background-removal cutout/mask PNG reuses as-is (no changes needed here).
- `apps/studio/test/asset-api.test.ts` and `apps/studio/test/canvas-origin-gate.test.ts` — the test shape to mirror for the new `/_api/photo-edit` route's own test file (Task 23).
- `apps/studio/bin/draw-build.sh` (48 lines, read in full) and `apps/studio/bin/draw-proof.sh` (164 lines, read in full) — the exact CLI-verb + throwaway-proof-canvas + agent-browser-capture pattern the new `photo-bg-remove.sh` verb replicates.
- `cli/commands/design.mjs:28-48` (`BIN_VERBS`), `:89-129` (`runBinDispatch`) — where the two new verbs (`photo-bg-remove`, `photo-adjust`) get registered.
- `plugins/design/commands/draw.md` (147 lines, read in full) — the step structure (`Pre-flight → resolve args → spawn agent/dispatch → verdict/report`) the new `/design:photo` command mirrors.
- `apps/studio/canvas-shell.tsx:894-913` (`registry` / `ContextMenuProvider`) and `:1236-1340` (`fitItem`/`resetItem`/"Copy CSS" `MenuItem` entries) — where the new "Edit Photo…" element-context-menu entry gets added.
- `apps/studio/annotations-layer.tsx:3745-3816` (`AnnotationContextMenu`) — where the annotation-stroke "Edit Photo…" entry gets added.
- `.ai/decisions/DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md` — the canonical VERSIONED/IGNORED taxonomy table (§3) the new `.photo.json` sidecar must be explicitly added to, and the "three lists must agree" invariant (`git/service.ts` `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, root `.gitignore`).
- `.ai/decisions/DDR-070-svg-generation-geometry-engine.md`, `DDR-024-phase-4-canvas-engine-driver-choice.md`, `DDR-054-linked-mode-trust-model-and-task-4-hardening.md`, `DDR-088-canvas-media-vocabulary-and-asset-write-surface.md` — read for the new DDR's "alternatives considered" / "supersedes" references (Task 27).
- `apps/studio/bin/runtime-health.sh` and `apps/studio/.min-sizes.json` (or equivalent floor file referenced by `check-runtime-bundles.sh`) — extend for the two new lazy-bundled packages (Task 24), closing BUILDER's flagged bundle-fragility risk.

### Design canvases

No canvas under `.design/` matched a "photo"/"photo-editor" tag or filename, and this feature is Studio-shell chrome (not a `.design/ui/*` mockup) — nothing to ground against here. The 5 most recently touched canvases (`Sync Hub Admin`, `Studio`, `Studio Intro Video`, `RepoBranchSwitcher`, `Docs Site`) are unrelated.

### Documentation

- [PixiJS v8 Filters guide](https://pixijs.com/8.x/guides/components/filters) — Why: confirms `ColorMatrixFilter` (built-in, has `.contrast()`/`.saturate()`/`.hue()`/`.sepia()`/`.grayscale()`/`.negative()` convenience methods) and `NoiseFilter` (built-in) cover most of "basic adjustments" + grain without custom shaders; duotone still needs a hand-authored gradient-map `Filter` since duotone is a per-pixel remap, not a linear color-matrix operation.
- [@imgly/background-removal (npm)](https://www.npmjs.com/package/@imgly/background-removal) — Why: browser package, needs `onnxruntime-web` peer (pure WASM/WebGPU, zero native deps) — confirms the client-side-only architecture is viable.
- [@imgly/background-removal-node (npm)](https://www.npmjs.com/package/@imgly/background-removal-node) — Why: confirms the Node/CLI variant depends on `onnxruntime-node` (native addon) — this is the package to explicitly **never** import into any server-side/CLI code path (Task 11 Gotcha).

### Patterns to Follow

`CssKnobs`'s write path is the load-bearing pattern for `PhotoKnobs` (`apps/studio/client/app.jsx`):

```js
// app.jsx:4342-4358 — post() — every knob write goes through this
async function post(prop, value) { /* POST /_api/edit-css, optimistic + undo record */ }
// app.jsx:4362-4371 — onOptimistic() — instant local preview before the round-trip resolves
// app.jsx:4375-4384 — record() — undo-stack integration (Cmd+Z must work on photo edits too)
```

`draw-proof.sh`'s harness-canvas + agent-browser capture pattern is the load-bearing pattern for `photo-bg-remove.sh`:

```bash
# apps/studio/bin/draw-proof.sh:93-114 — generates a throwaway canvas under _draw/<slug>.proof.tsx
# apps/studio/bin/draw-proof.sh:124-140 — screenshots it via screenshot.sh (agent-browser primary)
# apps/studio/bin/draw-proof.sh:164 — last stdout line is the artifact path, for $(...) capture
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --- | --- | --- |
| `ColorPicker` | `apps/studio/client/app.jsx:3881` | Reused as-is for the two duotone color swatches. |
| `makeScrub` / `num()` / `csel()` knob primitives | `apps/studio/client/app.jsx:4461-4517`, `:4724`, `:4673` | Reused for every Photo-tab numeric slider (adjustments, grain, pattern, mask strength) — same drag-to-scrub UX as CSS knobs. |
| Provenance dot + reset | `apps/studio/client/app.jsx:4547-4578`, `:4417-4432` | Reused so photo params show token/override/default state consistently with CSS knobs. |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| --- | --- | --- |
| `InspectorPanel` tab shell | `apps/studio/client/app.jsx:5518-5981` | Extending, not replacing — Photo becomes a 4th conditional tab. |
| Element context-menu registry | `apps/studio/canvas-shell.tsx:894-1340` | New "Edit Photo…" entry follows the existing `fitItem`/`resetItem` shape. |
| `AnnotationContextMenu` | `apps/studio/annotations-layer.tsx:3745-3816` | New "Edit Photo…" entry for `ImageStroke` right-click. |

> No matching block existed for the pixi.js compositor or the `PhotoEdit` data model — building custom (see Custom Components Needed).

### Icons

| Icon | Library | Size | Usage |
| --- | --- | --- | --- |
| `image` | Lucide line (matches existing tab icons `sliders`/`layers`/`code`) | 16 | New "Photo" tab button. |
| `wand-2` or `scissors` | Lucide line | 16 | "Remove Background" action button inside the Photo tab. |

### Tokens

Inspector chrome tokens are unchanged (the panel itself uses existing DS tokens already). No new color/spacing tokens are introduced by this feature — photo *content* colors (duotone swatches, etc.) are user-chosen values, not DS tokens, exactly like `CssKnobs`'s color picker already treats arbitrary color values.

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `<PhotoLayer>` (canvas-lib export) | No raster/WebGL compositor exists anywhere in the codebase. | New — mounts a `pixi.js` `Application` sized to the source image's box. |
| `PhotoKnobs` (Inspector) | No image-adjustment UI exists; `CssKnobs` explicitly excludes `filter`/`backdrop-filter` (DDR-104). | New component, reuses `CssKnobs`'s write/undo helpers. |
| `apps/studio/photo/` module family (`pipeline.ts`, `filters.ts`, `schema.ts`) | No pixel-level image-editing engine exists; `draw/` is vector-only (DDR-070 explicitly scopes it away from photorealism). | New, structurally mirrors `apps/studio/draw/`. |
| `PhotoBgRemoveHarness` (canvas-lib export) | Needed for the headless CLI path — a throwaway mountable component the proof-canvas harness loads. | New, mirrors `DrawProof`'s "renders for the CLI to screenshot/read" role. |

---

## Tasks

Execute in order. Each task is atomic and testable. Tasks are grouped into stages for sequencing clarity — stages themselves are still meant to land as one plan, not separate phased plans.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Stage A — Data model + taxonomy (foundation)

#### ✅ Task 1: CREATE the `PhotoEdit` schema — completed 2026-07-10 (tsc + biome clean)

- **Do**: Define the `PhotoEdit` TypeScript type in a new `apps/studio/photo/schema.ts`: `{ source: string /* assets/<sha8>.<ext> */, adjustments: { brightness, contrast, saturation, exposure, hue, sepia, grayscale, invert }, duotone: { enabled, colorA, colorB, intensity }, grain: { enabled, amount, size }, pattern: { enabled, type, scale, opacity, blend }, mask: { preset: 'none'|'vignette'|'radial-reveal'|'edge-fade', strength }, backgroundRemoved: { enabled, maskAsset } }`. All fields optional/defaultable so an empty sidecar renders as "unedited."
- **Pattern**: Mirror `annotations-model.ts`'s style of a flat, explicit TS interface per stroke type (`ImageStroke`, `:235-250`).
- **Gotcha**: Keep this file dependency-free (no `pixi.js` import) — it's imported by both the server (`photo-store.ts`, Task 8) and the client compositor, and the server bundle must not pull in a WebGL lib.
- **Validate**: `cd apps/studio && bun tsc --noEmit`

#### ✅ Task 2: RECORD the DDR-115 taxonomy addition — completed 2026-07-10 (dated addendum)

- **Do**: Add an explicit row to DDR-115's §3 table (`.ai/decisions/DDR-115-...md`): `assets/**` (including the new `assets/<sha8>.photo.json` sidecar) → **VERSIONED**. This is currently true in practice (assets aren't gitignored) but not explicitly stated in the table — make it explicit before adding a second file type under `assets/`.
- **Gotcha**: This is a doc edit to an *Accepted* DDR — add as a dated addendum note, don't rewrite history.
- **Validate**: Manual read-through; no automated check.

#### ✅ Task 3: ADD a regression guard for the three-list taxonomy invariant — completed 2026-07-10 (photo-taxonomy.test.ts, 4 pass)

- **Do**: Add/extend a test (near `apps/studio/git/service.ts`'s existing `isMaudeRuntimeState` tests, or a new small test file) asserting `assets/<sha8>.photo.json`-shaped paths are classified VERSIONED by `isMaudeRuntimeState`, are **not** matched by any glob in `cli/lib/gitignore-block.mjs`, and are **not** matched by the root `.gitignore`.
- **Pattern**: `.ai/decisions/DDR-115-...md`'s own "all three lists now agree" framing — this test is the automated version of that manual invariant.
- **Validate**: `cd apps/studio && bun test`

### Stage B — WebGL photo-compositing engine

#### ✅ Task 4: CREATE `apps/studio/photo/filters.ts` — completed 2026-07-10 (pure planner split; 9 tests, tsc+biome clean)

- **Do**: Build the pixi.js filter-graph constructor: wrap `PIXI.ColorMatrixFilter`'s built-in methods (`.contrast()`, `.saturate()`, `.hue()`, `.sepia()`, `.grayscale()`, `.negative()`, `.brightness()`) for the Adjustments section; wrap `PIXI.NoiseFilter` for Grain; hand-author a custom `DuotoneFilter` (a small `PIXI.Filter` with a GLSL fragment shader doing luminance → two-color gradient-map lerp, since duotone is a per-pixel remap that `ColorMatrixFilter`'s linear affine transform cannot express); build Pattern via `PIXI.TilingSprite` + blend mode; build the three preset Masks (vignette/radial-reveal/edge-fade) via `PIXI.Graphics`-based alpha masks. Export one `buildFilterGraph(edit: PhotoEdit): PIXI.Filter[]` entry point.
- **Pattern**: `apps/studio/draw/primitives.ts:448-490` (`fe()`/`filter()` generic builders) for the "parametric, composable" API shape — not reused directly (different rendering technology), but same design language.
- **Gotcha**: Order matters — adjustments → duotone → grain → pattern → mask must be a fixed, documented pipeline order (store as a comment in this file) since filters aren't commutative.
- **Validate**: `cd apps/studio && bun test` (unit test the filter-graph builder against a few `PhotoEdit` fixtures, asserting filter count/order, not pixel output).

#### ✅ Task 5: CREATE `apps/studio/photo/pipeline.ts` — completed 2026-07-10 (pixi v8 realizer; pure logic 10 tests; render path browser-verified in Task 6/25)

- **Do**: The `pixi.js` `Application`/texture-load/filter-apply orchestration: given a source image URL + a `PhotoEdit`, load the texture, build a `Sprite`, apply `buildFilterGraph()`'s output, render to the canvas element.
- **Gotcha**: One `PIXI.Application` per edited photo, not a shared global renderer — matches pixi.js v8 guidance and avoids cross-canvas state bleed between multiple edited photos on one artboard.
- **Validate**: `cd apps/studio && bun test`

#### ✅ Task 6: CREATE the `<PhotoLayer>` canvas-lib export — completed 2026-07-10 (lazy-bundle guarantee EMPIRICALLY VERIFIED + regression-tested; visual render pending live screenshot)

- **Do**: Add `<PhotoLayer source={url} edit={PhotoEdit}>` to `canvas-lib.tsx`, mounting `photo/pipeline.ts`'s renderer sized to the source element's rendered box. Gate mounting on the sidecar actually existing / edits being non-default — an unedited photo renders as the plain `<img>`/`<image>` with **zero** pixi.js cost, preserving the lazy-bundle guarantee.
- **Pattern**: `DrawProof`'s export shape (`canvas-lib.tsx:1841-1920`) for how canvas-lib exports a runtime-bundle-dependent component.
- **Gotcha**: Must respect `prefers-reduced-motion` and avoid animating the compositor itself (static render, not a per-frame loop, unless a live preview scrub is in progress).
- **Validate**: `maude design screenshot --root "$REPO"` against a manual test canvas with an edited photo.

#### ✅ Task 7: UPDATE `runtime-bundle.ts` + extend `runtime-health.sh` — completed 2026-07-10 (pixi comment updated; @imgly added to RUNTIME_PACKAGES + pre-built dist/runtime/@imgly_background-removal.js + floor 614000; check-runtime-bundles 24/24 pass)

- **Do**: Update the stale `pixi.js` comment (`runtime-bundle.ts:50-54`, currently says "reserved for future... DDR-024 deferred path") to reflect it's now active. Add `@imgly/background-removal` (Task 11) to `RUNTIME_PACKAGES`. Extend `apps/studio/bin/runtime-health.sh` and its `.min-sizes.json`-style floor file to HEAD-probe/size-check both new bundle entries.
- **Gotcha**: This is the direct mitigation for BUILDER's flagged top risk — the v0.22.0 `motion` bundle shipped broken (13 kB vs. 155 kB+ working) because CI's regen silently produced bad output. Do this task **before** shipping the UI that depends on the bundle, not after.
- **Validate**: `bash apps/studio/bin/runtime-health.sh --restart` against a local server; confirm both new slugs report healthy sizes.

### Stage C — Persistence + API surface

#### ✅ Task 8: CREATE `apps/studio/photo-store.ts` + `/_api/photo-edit` route — completed 2026-07-10 (createPhotoStore(ctx); DDR-088 cap stack: sha8+containment+validatePhotoEdit+64KB cap; GET/PUT)

- **Do**: `photo-store.ts` mirrors `inspect.ts`'s save/schedule pattern: `getPhotoEdit(assetSha8)`, `savePhotoEdit(assetSha8, edit)` reading/writing `assets/<sha8>.photo.json`. Add `GET`/`PUT /_api/photo-edit?asset=<sha8>` in `apps/studio/http.ts`.
- **Pattern**: `DDR-088`'s asset-write cap stack — strict sha8-hex regex (mirror `ASSET_IMAGE_HREF_RE`), JSON-schema validate against `PhotoEdit` (Task 1), size cap (64 KB is generous for parameters), resolved-path containment assert.
- **Gotcha**: This is a **new** write route — walk the DDR-088 threat table (stored-XSS via a crafted field, path traversal via the asset param, oversized-body DoS) explicitly, don't assume "it's just JSON" is automatically safe.
- **Validate**: `cd apps/studio && bun test` (new test, see Task 23).

#### ✅ Task 9: ADD `/_api/photo-edit` to BOTH canvas-origin allowlists — completed 2026-07-10 (CANVAS_SAFE_API + server.ts routes map; dual-allowlist proven by test — canvas-origin GET 200 / DELETE 405 / PUT 200)

- **Do**: Add the route to `CANVAS_SAFE_API` (`http.ts:2139-2147`) AND the `startCanvasServer` `routes` map (`server.ts:238-252`) in the **same commit**.
- **Gotcha**: This is the exact bug class that bit DDR-088's own rollout (Bun matches `routes` before the `fetch` fallthrough — a route in only `CANVAS_SAFE_API` 404s from the canvas iframe). Add a `test/canvas-origin-gate.test.ts`-style assertion (GET→405, POST-from-canvas-origin succeeds) so a future refactor can't silently drop it from one list.
- **Validate**: `cd apps/studio && bun test`

#### ✅ Task 10: WIRE background-removal output through the existing `/_api/asset` route — verified 2026-07-10 (no change needed: PhotoEdit.backgroundRemoved.maskAsset holds the `assets/<sha8>.png` that /_api/asset returns; matte upload reuses that route as-is)

- **Do**: Confirm (don't modify) that the bg-removal cutout/alpha-matte PNG uploads via the existing `POST /_api/asset` exactly like drag-drop images do today, and that its returned `assets/<sha8>.png` path is what gets written into `PhotoEdit.backgroundRemoved.maskAsset`.
- **Validate**: Integration test combining Task 8's route + the existing asset-api test fixtures.

### Stage D — Background removal (client-side ML)

#### ✅ Task 11: ADD `@imgly/background-removal` dependency — completed 2026-07-10 (@imgly/background-removal@1.7.0 + onnxruntime-web@1.21.0, browser variant; NO -node variant pulled; tsc clean; runtime bundle builds+floored. NOTE: publicPath self-hosting of WASM/model + compiled-binary tolerance = browser/release-verification follow-up)

- **Do**: Add `@imgly/background-removal` (browser variant) + its `onnxruntime-web` peer to `apps/studio/package.json`. Configure `publicPath` to self-host the WASM + model-weight assets under the dev-server's own static serving instead of the default IMG.LY CDN (verify the config option during implementation) — both for offline/air-gapped dev parity and so no photo pixel data or model-fetch traffic depends on a third-party host being reachable.
- **Gotcha**: **Never** import `@imgly/background-removal-node` anywhere in `apps/studio/` — it depends on `onnxruntime-node`, a native addon, which is bun-compile-hostile exactly like the `sharp` rejection in DDR-070. This must stay a lint/review-time invariant, not just a one-time choice — worth a one-line comment at the top of any file importing the browser package, similar to how `runtime-bundle.ts` comments its own constraints.
- **Validate**: `cd apps/studio && bun run build` succeeds (confirms the compiled binary build doesn't choke on the new dep); `bun tsc --noEmit`.

#### ✅ Task 12: CREATE the interactive "Remove Background" flow — CODE WIRED 2026-07-10, dogfood gate CLOSED in Round 3/desktop pass (commit `e179aa69`): headless `photo-bg-remove.sh` ran a real ~40 MB model download + real inference end-to-end (Task 18), and the interactive button itself was live-verified with a human eye against the bundled Tauri `.app` in real WKWebView (Task 25) — clicked "redo" on Background Removal, watched the "removing…" state, and confirmed a clean transparent-background cutout in a zoomed screenshot; content-addressed result hash-matched a prior run, confirming deterministic/correct WASM inference. **Deviation, explicitly deferred, not blocking:** `publicPath` self-hosting of the WASM/model weights (offline/air-gap parity) was NOT implemented — the model still fetches from IMG.LY's default host on first use (too large to bundle). Not gated by the Acceptance Criteria list; tracked as a follow-up, not a silent drop.

- **Do**: In the Photo tab's Background section, a button runs `@imgly/background-removal` client-side against the selected photo's source asset, shows a progress/spinner state, and on completion: uploads the resulting matte via `POST /_api/asset` (Task 10), writes `PhotoEdit.backgroundRemoved` via `/_api/photo-edit` (Task 8), and the `<PhotoLayer>` immediately re-composites live. Must be toggle-able (non-destructive — turning it off restores the original).
- **Pattern**: `CssKnobs`'s optimistic-preview-then-commit pattern (`app.jsx:4362-4394`).
- **Validate**: Manual: drop a photo with a clear subject, click Remove Background, confirm live preview + toggle works + undo (Cmd+Z) reverts it.

### Stage E — Inspector UI

#### ✅ Task 13: ADD the conditional "Photo" Inspector tab — DONE + LIVE-VERIFIED 2026-07-10. app.jsx: conditional Photo tab (4th tab on an artboard `<img>`; Photo-ONLY panel for an annotation-image via the new `photoSel` state + `edit-annotation-photo-request` handler, DDR-054-gated). Verified via agent-browser: real ⌘-click on `Smoke TSX`'s `<img>` → tabs `[Inspect, Layers, CSS, Photo]` → Photo tab active.

- **Do**: Extend the `tabBtn` row (`app.jsx:5824-5837`) and tab-body branch chain (`:5847-5977`) with a `photo` tab, shown when the current selection is photo-eligible. Per your clarification: when the selection is an annotation `ImageStroke`, show **only** the Photo tab (no Inspect/Layers/CSS — those don't apply to annotation strokes); when the selection is an artboard `<img>`, show Photo alongside the existing three tabs.
- **Gotcha**: `InspectorPanel`'s current tab set assumes a DOM-element selection; annotation-stroke selection is a different selection model (`AnnotationContextMenu`'s own selection registry, per `canvas-shell.tsx:749`'s comment) — verify `InspectorPanel` can even receive an annotation-stroke selection today, and if not, thread it through (this may be the single largest unknown in this plan; budget extra investigation time here).
- **Validate**: Manual: select an artboard `<img>` → see 4 tabs; select a dropped photo in the annotation layer → see only Photo tab.

#### ✅ Task 14: ADD the `isPhoto`/`photoKind` selection flag — DONE + LIVE-VERIFIED 2026-07-10. `Selection` gains `photoKind?: 'artboard-img'|'annotation-image'` + `photoAsset?` (use-selection-set.tsx) + a shared `photoAssetFromString` helper; set at resolution in `dom-selection.ts` `hoverTargetToSelection` for a content-addressed `<img>`. Verified: the real ⌘-click selection carried `photoAsset`, driving the Photo tab.

- **Do**: Extend the `Selection` shape (`use-selection-set.tsx:40-73`) with a flag distinguishing `'artboard-img' | 'annotation-image' | null`, set at the point of selection resolution in `canvas-shell.tsx`.
- **Validate**: `cd apps/studio && bun test`

#### ✅ Task 15: BUILD + MOUNT `PhotoKnobs` — DONE + LIVE-VERIFIED 2026-07-10. Component (`client/photo-knobs.jsx`) now MOUNTED in `InspectorPanel` with `ColorPicker` injected + `onPhotoEdit` (down-channel), `onPhotoRemoveBackground` (ML), `onPhotoRecordEdit` (shell-side photo-undo stack) wired. Verified via agent-browser: all 6 sections render (Adjustments/Duotone/Grain/Pattern/Mask/Background); driving the Brightness slider → sidecar `assets/eb268f9c.photo.json` = `{adjustments:{brightness:0.6}}` (GET route confirms) + header shows "saved" + live pixi preview composites (image visibly brighter). NOTE: full Cmd+Z on photo edits (shell-side stack exists; global keydown intercept) = remaining polish.

- **Do**: New component mirroring `CssKnobs`'s structure exactly (sections, `makeScrub`, provenance dots, per-row/section reset): **Adjustments** (brightness/contrast/saturation/exposure/hue/sepia/grayscale/invert), **Duotone** (`ColorPicker` × 2 + intensity + enable), **Grain** (amount/size + enable), **Pattern** (type select + scale/opacity + blend-mode select), **Mask** (preset select + strength), **Background** (Remove Background button + before/after toggle). All writes go through `/_api/photo-edit` (Task 8) using the same optimistic/commit/undo-record helpers `CssKnobs` already has (reuse, don't reimplement).
- **Validate**: `maude design screenshot` against a manual canvas exercising every knob; confirm Cmd+Z undoes each.

### Stage F — Context menu

#### ✅ Task 16: ADD "Edit Photo…" to the element context-menu registry — DONE + LIVE-VERIFIED 2026-07-10. New `hidden?:` predicate on `MenuItem` (context-menu.tsx, + render-time filtering so a hidden item leaves no dangling separator); "Edit Photo…" entry in canvas-shell's element registry, gated to content-addressed `<img>`, selects it + posts `{dgn:'open-inspector', tab:'photo'}`. Verified: appears on the `<img>` (after Inspect), absent on a non-image `<button>` (14 items, no "Edit Photo…").

- **Do**: In `canvas-shell.tsx`'s `'element'` registry section (~`:1236-1340`, alongside `fitItem`/`resetItem`/"Copy CSS"), add a conditional `MenuItem` shown only when the target is an `<img>`, that opens the Inspector and switches to the Photo tab — same open+focus wiring the existing "Inspect" entry uses (`app.jsx:7766`).
- **Validate**: Right-click an artboard photo → "Edit Photo…" appears → click → Inspector opens on the Photo tab.

#### ✅ Task 17: ADD "Edit Photo…" to `AnnotationContextMenu` — CODE DONE 2026-07-10, functional gap CLOSED in Round 2 (commit `fc84db67`). `canEditPhoto` prop (gated: exactly one content-addressed `ImageStroke`, tool==='image', not mediaref) + menu item + `edit-photo` action posting `{dgn:'edit-annotation-photo-request', id, asset: href}` upward (mirrors the LIVE-VERIFIED F3 `replace-annotation-media-request` pattern). tsc+biome clean. The UX outcome this entry drives (opening the Photo-only tab for an annotation image) is live-verified via a parallel path — a new `singleSelectedImageId` effect in `annotations-layer.tsx` posts the same `edit-annotation-photo-request` on selection, proven working during the flicker-fix round. **Narrow carry-over, non-blocking:** the literal right-click menu item render was never screenshotted against a real annotation `ImageStroke` (the dogfood canvas only had an artboard `<img>`) — the code path is identical to the already-proven F3 pattern, so risk is low, but a future session should do a one-shot visual confirm.

- **Do**: Same entry, gated on the stroke being an `ImageStroke`, in `annotations-layer.tsx:3745-3816`.
- **Validate**: Right-click a dropped/pasted photo in the annotation layer → "Edit Photo…" appears → click → Inspector opens on the (annotation-only) Photo tab.

### Stage G — CLI / headless drivability

#### ✅ Task 18: CREATE `apps/studio/bin/photo-bg-remove.sh` — completed 2026-07-10, LIVE-VERIFIED end-to-end with a real ~40 MB model download + real inference. The plan's stated cross-origin blocker was stale: `/_api/asset` and `/_api/photo-edit` are BOTH already `CANVAS_SAFE_API` (re-read the routes' own header comments in `http.ts`), so the harness posts directly from the canvas origin — no DOM-attribute/curl round-trip needed. Along the way, found + fixed a real latent bug: `@imgly/background-removal` was in `RUNTIME_PACKAGES` with its runtime bundle built, but `_shell.html`'s importmap never got the matching entry, so canvas-side code importing it 404'd on "Failed to resolve module specifier" (unexercised until this task, the first canvas-side consumer). Fixed + regression-tested (`test/shell-importmap.test.ts`).

- **Do**: Mirror `draw-proof.sh`'s structure exactly: resolve the running server's port from `_server.json`; generate a throwaway harness canvas at `<designRoot>/_photo/<slug>.bgremove.tsx` importing a new canvas-lib `PhotoBgRemoveHarness` export that loads the target asset, runs `@imgly/background-removal` client-side, POSTs the result to `/_api/asset` + `/_api/photo-edit`, and sets a DOM marker (`data-photo-bgremove-status="done" data-photo-bgremove-result="assets/<sha8>.png"`); drive it headlessly via `agent-browser` (research whether its CLI already supports "wait for selector, read attribute" — if not, add a small `_photo-bgremove-playwright.mjs` shim mirroring `_motion-sample-playwright.mjs`); print the resulting asset path as the sole stdout line.
- **Gotcha**: This is the task the whole "build headless bg-removal in v1" decision hinges on — budget real investigation time for the agent-browser attribute-readback primitive before assuming it exists.
- **Validate**: `bash apps/studio/bin/photo-bg-remove.sh --asset assets/<sha8>.png --root "$REPO"` against a running server; confirm it prints a valid new asset path and the harness canvas cleans up (or is gitignored under `_photo/`).

#### ✅ Task 19: CREATE `apps/studio/bin/photo-adjust.sh` — completed 2026-07-10 (thin curl→/_api/photo-edit verb; E2E-VERIFIED live: set/merge/reset + invalid-asset reject against a booted sandbox server)

- **Do**: A thin non-browser verb: validates args, `curl`s (or Bun-fetches) directly to the running server's `/_api/photo-edit` route to write parametric edits (adjustments/duotone/grain/pattern/mask) — no harness canvas, no agent-browser, since there's no ML inference step here.
- **Gotcha**: Document explicitly in this script's header comment why it's simpler than `photo-bg-remove.sh` (no browser round-trip needed) — future maintainers shouldn't "fix" the asymmetry by making this one heavier too.
- **Validate**: `bash apps/studio/bin/photo-adjust.sh --asset assets/<sha8>.png --duotone "#1a1a2e,#e94560" --root "$REPO"` against a running server; confirm the sidecar updates and the live canvas reflects it.

#### ✅ Task 20: REGISTER the new verbs — completed 2026-07-10. Both `photo-adjust` and `photo-bg-remove` registered in `BIN_VERBS` (`cli/commands/design.mjs`); `node cli/bin/maude.mjs design photo-bg-remove --help` resolves; `plugin-cli-reachability.test.mjs` passes.

- **Do**: Add `photo-bg-remove` and `photo-adjust` to `BIN_VERBS` (`cli/commands/design.mjs:28-48`).
- **Gotcha**: While here, fix the three already-stale verb lists CLAUDE.md/`design.mjs`/`help.mjs` flagged during research (missing `chat-open`, `ensure-browser`, `draw-build`, etc.) — small drive-by cleanup, same file being touched anyway.
- **Validate**: `node cli/bin/maude.mjs design photo-adjust --help` (or equivalent) resolves without a 404.

#### ✅ Task 21: CREATE `/design:photo` slash command — completed 2026-07-10 (plugins/design/commands/photo.md + CATEGORIES daily row; parametric path E2E-proven; --remove-bg documented → dispatches to the Stage-D photo-bg-remove verb; passes reachability guard)

- **Do**: New `plugins/design/commands/photo.md`, category `daily`, following `draw.md`'s step structure: pre-flight (`bootstrap-check` → `prep` → `server-up`) → resolve target (`--selector`/`--asset`) → dispatch to `photo-bg-remove` and/or `photo-adjust` per the requested flags (`--remove-bg`, `--adjust key=value`, `--duotone c1,c2`, `--grain n`, `--pattern type`, `--mask preset`) → report. Update `plugins/design/CATEGORIES.md`'s daily table and `/design:help`'s index.
- **Validate**: `/design:photo --remove-bg --asset assets/<sha8>.png` end-to-end in a scratch project.

#### ✅ Task 22: VERIFY `plugins/design/dependencies.json` needs no new entry — verified 2026-07-10 (@imgly is a pure npm/WASM dep bundled like pixi/motion — no external SYSTEM tool to detect; dependencies.json is for tool detection, not npm deps. Model weights fetch at first use = network, not a detectable tool → no entry)

- **Do**: Confirm `@imgly/background-removal` is a pure npm/WASM dependency bundled into the published tarball (like `pixi.js`/`motion` already are) with no externally-installed system tool to detect — so it does **not** need a `dependencies.json` entry (that manifest is for CLI/system-tool detection, not npm deps). Only add an entry if implementation reveals a genuine external-tool need (e.g. a one-time model-weight download step requiring network access at first use).
- **Validate**: N/A — a verification task, not a code change unless the gotcha condition is hit.

### Stage H — Guardrails + parity

#### ✅ Task 23: CREATE `apps/studio/test/photo-edit-api.test.ts` — completed 2026-07-10 (10 pass: sha8 traversal, round-trip, malformed-reject, size-cap 413, method-gate 405, dual-allowlist canvas-origin)

- **Do**: Mirror `asset-api.test.ts`/`canvas-origin-gate.test.ts`: schema validation rejects malformed `PhotoEdit` JSON, size cap enforced, path containment holds against a crafted `asset` param, GET/PUT both work, and the route's presence in both allowlists is asserted.
- **Validate**: `cd apps/studio && bun test`

#### ✅ Task 24: EXTEND runtime-bundle health checks — completed 2026-07-10 (@imgly_background-removal.js floor in .min-sizes.json; check-runtime-bundles.sh gate green 24/24; runtime-health.sh HEAD-probes it via the shared floor manifest)

- **Do**: (If not already fully covered by Task 7) confirm `check-runtime-bundles.sh`'s CI gate has floor entries for the `pixi.js` activation and the new `@imgly/background-removal` bundle.
- **Validate**: CI dry-run / `bash apps/studio/bin/check-runtime-bundles.sh` locally.

#### ✅ Task 25: VERIFY desktop (Tauri/WKWebView) parity — completed 2026-07-10, LIVE-VERIFIED against the real bundled `.app` (rebuilt via `pnpm test:e2e:desktop:build` — the shipped debug bundle was stale, predating even Task 7). Driven with computer-use (real OS-level input reaches the split-origin canvas iframe; native WebDriver pointer events don't). Both pixi WebGL rendering and onnxruntime-web's WASM fallback confirmed correct in the real WKWebView (brightness edit visually + luma-verified; a fresh background-removal pass produced a clean transparent cutout). One methodology false-alarm caught and corrected before reporting: WebKit's `<input type="range">` only supports thumb-drag, not click-to-jump — a stray click (not a drag) silently zeroed a slider value between two verification steps, briefly looking like a rendering bug. Full findings in `.ai/state/STATE.md` Round 3.

- **Do**: Dogfood the bundled `.app` (not `tauri dev`) per the native-app verification-ceiling constraint: confirm `onnxruntime-web`'s WASM fallback runs correctly in WKWebView (WebGPU support there may be partial/absent — the automatic WASM fallback must actually engage and produce a correct result, not silently fail), confirm pixi.js WebGL rendering matches the browser build, and note latency differences.
- **Gotcha**: This is BREAKER's flagged risk (headless proof screenshots captured via Chromium agent-browser may not match what a real WKWebView user sees) — treat any visual/behavioral delta as a finding to document, not silently ignore.
- **Validate**: Manual dogfooding session against `pnpm build:desktop` output.

#### ✅ Task 26: RECORD the architecture DDR — completed 2026-07-10 (DDR-161; captures pixi activation, PhotoEdit sidecar, /_api/photo-edit route, headless-harness pattern, the BUILDER/SHIPPER/BREAKER debate with top risks verbatim as accepted trade-offs, + the 2 implementation deviations & the bundle-fragility bug fix)

- **Do**: Via `/flow:record-ddr`, record the photo-editor architecture decision — pixi.js activation (superseding DDR-024's "parked" status for this specific use case), the new `PhotoEdit` non-destructive object, the new `/_api/photo-edit` route, and the headless-harness pattern extension. Cross-reference DDR-024, DDR-070, DDR-088, DDR-054, DDR-104, DDR-115. Include the debate outcome (BUILDER's approach chosen over SHIPPER/BREAKER's SVG-filter alternative) in the "Alternatives considered" section, quoting their top risks verbatim as accepted trade-offs.
- **Validate**: DDR file exists under `.ai/decisions/`, numbered per the next-available-number check (see `project_ddr_numbering_races_on_shared_main` convention — re-check the decisions dir immediately before numbering).

#### ✅ Task 27: ADD a what's-new entry (at `/flow:done` time) — completed 2026-07-10 (entry `photo-editor` in `apps/studio/whats-new.json`, with a Photo-tab spotlight-tour step; stamped `version: "0.43.0"` at the v0.43.0 release, ahead of this formal `/flow:done` close-out)

- **Do**: Via the `whats-new-entry` skill, append a pending entry to `apps/studio/whats-new.json` describing the Photo tab + magic background removal. Not to be done mid-implementation — flagged here so it isn't forgotten at close-out.
- **Validate**: Entry present with `version: null`, stamped at release per the existing convention.

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `pnpm lint`
2. **Types**: `cd apps/studio && bun tsc --noEmit`
3. **Tests**: `pnpm test && pnpm test:dev-server`
4. **Build**: `pnpm build` (site + packages) and `cd apps/studio && bun run build` (confirms the compiled dev-server binary tolerates the new deps)
5. **Cross-platform scenario** (UI tasks): spawn the `scenario-runner` subagent — see Scenario Coverage below.
6. **Design System Guard**: spawn `design-system-guard` — verifies the new Photo tab doesn't introduce hardcoded colors/gradients outside the DS token set (photo *content* colors like duotone swatches are the documented exception, not a violation).
7. **A11y**: spawn `a11y-auditor` — the new tab, sliders, color pickers, and context-menu entries all need keyboard reach + ARIA labels; the pixi.js canvas itself needs an accessible fallback/label since a `<canvas>` is otherwise a black box to a screen reader.
8. **Manual**:
   - Headless: `bash apps/studio/bin/photo-bg-remove.sh` and `photo-adjust.sh` end-to-end against a running server, without opening a browser tab yourself.
   - Undo/redo (Cmd+Z) across every Photo-tab knob and background removal.
   - Desktop app dogfooding per Task 25.
   - A canvas with **zero** edited photos still loads with **zero** pixi.js/bg-removal bundle cost (verify via network tab / bundle-size probe) — the lazy-bundle guarantee must hold.

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
| --- | --- | --- |
| `app-boots-and-renders-canvas` | Baseline Studio boot + canvas render | ✅ existing (must still pass unmodified) |

**New scenarios to create:**

- `photo-editor-basic-edit` — flow: open a canvas with a dropped photo → right-click → "Edit Photo…" → Inspector Photo tab opens → adjust brightness/duotone → verify live preview → click Remove Background → verify cutout → Cmd+Z undoes it → select a different `<img>` authored directly in an artboard → confirm the same tab + knobs work there too. Persona: designer iterating on a mockup. Fixtures: one canvas with a pasted/dropped photo (annotation `ImageStroke`) and one artboard-authored `<img>`.
- `photo-editor-headless-cli` — flow: with the dev server running, invoke `maude design photo-bg-remove` and `maude design photo-adjust` directly (no browser interaction) and verify the resulting asset + sidecar changes are visible on the next `GET`/screenshot. Persona: Claude Code driving the feature programmatically — this is the scenario that actually proves the plan's core requirement (Claude-Code-drivability), not just the interactive UI.

`/flow:done` runs `scenario-runner` across 5 platforms. Given this is a `web-desktop`-only project (per `.ai/workflows.config.json` `platforms: ["web-desktop"]`), the other 4 platforms are expected to report `skipped`, not `blocked` — confirm parity logic treats that correctly rather than failing the gate.

---

## Acceptance Criteria

- [x] All 27 tasks completed
- [x] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- `/validate` passes overall (run at `/flow:done` close-out, 2026-07-10):
  - [x] Static (types, lint, format) — `bun tsc --noEmit` shows only the pre-existing 8-error DDR-026 baseline; biome clean on changed files
  - [x] Tests (full suite, incl. new `photo-edit-api.test.ts` and the taxonomy regression guard) — 2348 pass / 5 skip / 2 fail (the 2 failures are pre-existing order-dependent flakiness, `canvas-meta-api`/`reorder-api`, confirmed passing in isolation); all photo-specific test files 42/42
  - [x] Build (site + `apps/studio` compiled binary) — `bun run build.ts --release` succeeds, committed `dist/` bundles verified byte-identical after rebuild
  - [x] `scenario-runner`: 0 blockers, parity OK on the in-scope `web-desktop` platform (others `skipped`) — reports linked below
  - [ ] `design-system-guard` subagent: 0 blockers — **NOT MET: 5 blockers found**, see "Known follow-up debt" below. User decision (2026-07-10): ship as-is, track as follow-up rather than block this close-out.
  - [ ] `a11y-auditor` subagent: 0 blockers, including the pixi.js `<canvas>` accessible-fallback requirement — **the canvas fallback itself IS met** (verified: `<PhotoLayer>` has `role="img"`+`aria-label`, though it's actually unused in the shipped bake-in-place path, which preserves the real `<img>`'s own alt text instead — arguably better). **3 other a11y blockers found** (unlabeled `<select>`s, contrast failures, invisible focus indicator), see "Known follow-up debt" below. Same user decision as above.
- [x] Scenario reports for both `photo-editor-basic-edit` and `photo-editor-headless-cli` — no new PR for this close-out (already shipped in v0.43.0), reports linked in STATE.md instead: `.ai/device/scenario-runs/{photo-editor-basic-edit,photo-editor-headless-cli,app-boots-and-renders-canvas}/2026-07-10-2357/report.md`
- [x] The new DDR (Task 26) is recorded, cross-referencing DDR-024/070/088/054/104/115 — DDR-161
- [x] A canvas with no edited photos pays zero pixi.js/bg-removal bundle cost (lazy-bundle guarantee verified, not assumed) — Task 6
- [x] Both image contexts (artboard `<img>` and annotation `ImageStroke`) are editable through the same Photo tab, per your mid-plan clarification
- [x] The context-menu entry is present and functional in both the element registry (`canvas-shell.tsx`) and `AnnotationContextMenu`
- [x] Background removal never imports `@imgly/background-removal-node` or any other native-addon ML runtime anywhere in `apps/studio/` — independently confirmed by both the security-auditor and ethical-hacker passes at close-out
- [x] Code follows project conventions, no regressions — **with the follow-up debt noted below**

## Known follow-up debt (found at `/flow:done` close-out, 2026-07-10 — shipped as-is per user decision, not fixed in this pass)

A full security (defender + attacker) + design-system + a11y fan-out was run against the already-shipped Round 3/4 diff (commit `e179aa69`) since it had not been reviewed before. Findings below; no report `.md` files were written (session convention), so this list is the durable record — a future session should pull it into a `/flow:bug-fix` pass rather than re-deriving from scratch.

**Security (`apps/studio/bin/photo-bg-remove.sh` unless noted) — both security-auditor and ethical-hacker converged independently:**
- **[Chained, HIGH]** `--asset` is validated with a loose `assets/*` glob (not the strict `assets/[0-9a-f]{8}\.[a-z0-9]+` shape `ASSET_REF_RE` enforces everywhere else in this feature — `~line 59/115-117`), then spliced **unescaped** into a generated `.tsx` file (`~line 110`, `printf '  return <PhotoBgRemoveHarness source=%s />;\n' "\"$ASSET\""`). Combined with the harness-file write (`~line 156-168`) having no symlink-safe guard (unlike the precedent already shipped in `sync/atomic-write.ts` for exactly this class, DDR-054 §2c), this chains into attacker-controlled JSX landing in a *real, reviewed* canvas file — invisible to `git diff` since the write happens at runtime in a gitignored dir.
- The script's stdout deliverable (`data-photo-bgremove-result` DOM attribute readback, `~line 155/211-216`) is trusted and printed verbatim with no shape validation before the calling `/design:photo` command reuses it as the next command's trusted asset path.
- `--slug`'s fail-open fallback (`~line 121`) only lowercases on `slug.sh` failure — doesn't strip `/`, so a failure mode (this repo has a documented history of sibling-script resolution breaking in packaged builds, DDR-045) could let a traversal-shaped slug through.
- No concurrency/rate cap on headless invocations (a loop could spawn unbounded browser+WASM processes); harness scratch files (`_photo/*.bgremove.tsx`) are never cleaned up after a run.
- `canvas-lib.tsx`'s `PhotoPreviewBridge` `photo-busy` postMessage handler (new in this diff, reusing the pre-existing unchecked-origin `photo-preview` handler pattern) has no `event.origin` check, and an empty-string `asset` matches every photo element via `findPhotoEl`'s substring fallback — low-impact (only toggles a cosmetic busy-pulse attribute) but worth closing alongside the above.
- **Architectural, needs a deliberate decision, not a quick patch:** `@imgly/background-removal`'s model weights fetch from IMG.LY's default CDN (`staticimgly.com`) by default — this sits directly against the `connect-src 'self'` CSP that's supposed to prevent canvas-origin code reaching any third party (DDR-054 F1 containment). The feature may only function today with the split-origin sandbox weakened. The code's own comment already flags self-hosting the weights behind `/_canvas-runtime/` as a follow-up (see Task 12's note) — this finding raises its priority from "nice to have" to "closes a real containment gap."

**Design-system (`apps/studio/client/photo-knobs.jsx`):**
- Bare unstyled native `<input type="range">` sliders (13 rows) instead of the `makeScrub` bordered-drag pattern every other Inspector numeric control uses.
- "Remove Background" button renders a raw `✦` Unicode character instead of the plan-specified Lucide icon (`STICONS.sparkle` already exists, unused).
- Several hardcoded values off the token ladder: `S.sec.marginBottom:14`, `S.row.margin:'5px 0'`, `S.secHead.letterSpacing:'.06em'` (should be `var(--tracking-wide)`), `S.btn.borderRadius:6`, `S.reset.borderRadius:4`.
- Double padding vs. every other Inspector tab (own root adds `10px 12px` on top of the parent's already-applied `var(--space-4)`).
- Hand-styled `<select>`s and buttons reimplement rather than reuse `.st-cp-nsel`/`.st-btn` (losing hover/focus-ring states, wrong font family).

**A11y:**
- Three `<select>`s (Pattern Type, Pattern Blend, Mask Preset) have no accessible name (no label/aria-label/aria-labelledby).
- Two text elements (asset-path/save-state label, pattern hint) use `--fg-3` on `--bg-1` → ~2.5:1 contrast, fails WCAG 1.4.3 (need 4.5:1).
- Context-menu hover/focus-visible style computes to ~1.05:1 contrast — effectively invisible keyboard focus indicator (shared/pre-existing infra, but blocks the "Edit Photo…" keyboard path specifically).
- `ColorSwatch`/shell `ColorPicker` internal controls use generic hardcoded aria-labels — Duotone's Shadow vs. Highlight swatches are indistinguishable to a screen reader.
- ColorPicker's saturation/value pad + hue bar are keyboard-focusable but not keyboard-operable (no `onKeyDown`) — partial, not full, since the hex input remains a working alternative.
- `data-photo-busy` has no companion `aria-busy`/live-region announcement.
- Annotation `ImageStroke` selection has no keyboard path at all (pre-existing whiteboard limitation, not a regression — but it means keyboard-only users can't reach Photo editing for that content type today).
- Photo tab section titles are plain `<span>`, not real headings — no heading-navigation landmarks.

## Retro

- **What worked:** the multi-round live-dogfood loop (agent-browser same-origin → split-origin → real bundled desktop `.app` via computer-use) caught real, high-value bugs a scripted scenario alone would have missed — the two CSP gaps (unsafe-eval, worker-src blocking texture decode), the importmap/RUNTIME_PACKAGES drift, and the WebKit range-input click-vs-drag false alarm. Treating "verify in the default split-origin mode, not same-origin" as load-bearing (not a nice-to-have) paid off directly.
- **What worked:** deferring the formal `/flow:done` gate until after multiple rounds of functional dogfooding meant the plan's task checklist and STATE.md diverged (checklist said `◐` on Tasks 12/17 while STATE.md's later rounds had already closed the underlying gaps) — the close-out session had to reconcile these by reading STATE.md as ground truth rather than trusting the plan file's own markers. **Next time: update the plan file's task markers in the same commit as the work that closes them**, not just STATE.md, so the two artifacts don't drift.
- **What didn't work:** the Round 3/4 commit (`e179aa69`, the headless CLI + Cmd+Z + desktop parity + busy-reveal bundle) shipped to `main`/v0.43.0 without a security fan-out — Round 2 had one, Round 3/4 didn't, and nobody caught the gap until this `/flow:done` pass ran one retroactively and found a chained HIGH-severity exploit. **Next time: every round that touches a new attack surface (here: a new headless CLI verb crossing the DDR-054 trust boundary) gets its own security pass before merging, not just the round that happened to remember to ask for one.**
- **What didn't work:** rapid iterative dogfooding optimized for "does it work" (functional correctness) over "is it consistent/accessible" — the design-system-guard and a11y-auditor findings (bare native range inputs, unlabeled selects, off-ladder hardcoded spacing) are the kind of thing a `CssKnobs`-mirroring component should have caught by construction, not by a late audit. **Next time: when a component is spec'd as "mirror X exactly," diff against X's actual DOM/CSS output at build time, not just its logical structure.**
- **Process note:** this `/flow:done` session ran concurrently with another active Claude Code session in the same working tree (on the unrelated `feature-ai-media-generation` work) — both the scenario-runner subagent and the close-out session itself detected this independently (via live `_server.json` clobbers and file-mtime changes) and worked around it without incident, but it's worth recording: **multi-session concurrent work on a shared `main` checkout is happening in practice for this project and tooling should assume it, not treat it as an edge case.**
- **Decision:** the design-system/a11y follow-up debt above was consciously deferred (user decision, 2026-07-10) rather than fixed in this session — track it as a `/flow:bug-fix`-sized follow-up, not lost context.
