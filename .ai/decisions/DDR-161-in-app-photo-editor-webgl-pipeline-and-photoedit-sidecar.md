# DDR-161: In-app photo editor — pixi.js WebGL pipeline, the `PhotoEdit` sidecar, and the headless edit surface

- **Date:** 2026-07-10
- **Status:** Accepted (partially implemented — feature `photo-editor`: Stages A–C + the parametric CLI landed and verified; Stages D–F [client-side ML background removal, Inspector "Photo" tab, context menus] + desktop parity pending a live-browser verification pass)
- **Tags:** studio, canvas-runtime, photo, pixi, webgl, raster, sidecar, imgly, background-removal, cli, headless, lazy-bundle, security, DDR-024, DDR-070, DDR-088, DDR-115
- **Related:** [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md) (parked pixi.js — this is its first activation), [DDR-070](./DDR-070-svg-generation-geometry-engine.md) (the vector `draw/` engine this is the raster counterpart to; its `sharp`/native-addon exclusion is why background removal is browser-only), [DDR-088](./DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the canvas-media / asset-write surface + dual-allowlist rule the new route joins), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (the untrusted-canvas trust model the route's residual is bounded by), [DDR-104](./DDR-104-css-panel-ux-model.md) (why `filter`/`backdrop-filter` are excluded from the curated CSS panel — this is a *different* write path, not a reopening), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (the runtime-state taxonomy the `.photo.json` sidecar is added to).

## Context

A "photo" in a Studio canvas was inert pixels — a hand-authored `<img src>` in artboard TSX, or an `ImageStroke` dropped/pasted into the annotation SVG layer. No adjustment, filter, duotone, grain, pattern, mask, or background-removal capability existed anywhere (confirmed by exhaustive grep across the client, the Inspector `CssKnobs`, and the vector `draw/` engine). CSS `filter:`/`backdrop-filter` are deliberately excluded from the curated Inspector UI (DDR-104), reachable only through a raw-text escape hatch.

The feature's non-negotiable requirement: every edit must be **scriptable by Claude Code itself, headlessly** — not just clickable by a human — because the primary user is often the agent acting on the user's behalf.

## Decision

A **non-destructive photo pipeline** on `pixi.js` (v8, WebGL), driven by a first-class `PhotoEdit` sidecar, rendered live by a canvas-lib `<PhotoLayer>` compositor, edited through an Inspector "Photo" tab + context-menu entry, and scriptable through a `maude design photo-*` CLI verb family + `/design:photo` command.

### 1. `PhotoEdit` — a content-addressed, non-destructive sidecar (`assets/<sha8>.photo.json`)

Parameters only, never pixels (`apps/studio/photo/schema.ts`): `adjustments` (brightness/contrast/saturation/exposure/hue/sepia/grayscale/invert, normalized with a neutral origin), `duotone`, `grain`, `pattern`, `mask` (preset), `backgroundRemoved` (`{enabled, maskAsset}`). Every field optional/defaultable so an empty sidecar renders as "unedited." The source pixels are never modified; `--reset` restores the untouched photo. **Added to the DDR-115 VERSIONED taxonomy** (dated §3 addendum) with a three-list regression guard — this closes BREAKER's flagged risk (below). The schema module is **dependency-free** (no pixi) so both the server store and the client compositor import it.

### 2. pixi.js activated (supersedes DDR-024's "parked" status *for this use case*)

DDR-024 parked pixi.js for snapshot-to-texture viewport rendering, which never shipped. The photo editor is its first real activation. pixi was already a declared dependency, pre-built into `dist/runtime/pixi-js.js`, and floored in `.min-sizes.json` — so activation was wiring, not a new dependency. The compositor is one `pixi.Application` per edited photo (v8 guidance; no shared global renderer → no cross-photo state bleed), pinned to `preference: 'webgl'` (WKWebView WebGPU is partial), static render (no ticker → reduced-motion safe).

### 3. Two implementation deviations from the plan (both strengthen it — recorded here)

- **Filter graph split into a pure planner + a browser realizer.** The plan specified `buildFilterGraph(edit): PIXI.Filter[]`. But pixi v8 compiles a `GlProgram` in *every filter's constructor*, which calls `document.createElement('canvas')` — so constructing a filter in a headless `bun test` throws `ReferenceError: document is not defined`. The engine is therefore `photo/filters.ts` (a **pure, dependency-free** `planPhotoPipeline(edit) → PhotoPipelineStep[]` — this IS the "assert filter count/order" surface the plan's Task-4 validation wanted, now genuinely runnable) + `photo/pipeline.ts` (the browser-only realizer, keeping the `buildFilterGraph` name). Mirrors how `draw/serialize.ts` produces a browser-free description of a render (DDR-067/070).
- **pixi loaded via a runtime `await import('pixi.js')`, never a static import** — the fix for BUILDER's flagged risk (below), which was a **real bug** in the first cut, not a hypothetical.

### 4. `/_api/photo-edit` — a canvas-safe write route with a load-bearing cap stack

`photo-store.ts` (`createPhotoStore(ctx)`, mirrors `inspect.ts`) reads/writes the sidecar; `GET`/`PUT /_api/photo-edit?asset=<sha8|assets/<sha8>.<ext>>` in `http.ts`, added to **both** canvas-origin allowlists (`CANVAS_SAFE_API` **and** `startCanvasServer`'s `routes` map — the DDR-088 one-list-only-404 bug). Unlike content-addressed `/_api/asset` (write path not attacker-chosen), this route's write path is **derived from an attacker-controllable param**, so the DDR-088 cap stack is the load-bearing mitigation: strict sha8 extraction (hex-only — rejects `..`/`/`/`%2f`/absolute by construction) + containment assert + `validatePhotoEdit` (unknown keys / bad types / out-of-range / non-hex colors / non-relative paths all rejected) + 64 KB cap. `isLoopbackHost` guards DNS-rebinding; **no `sameOriginWrite`** (it would block the legit canvas origin the headless bg-remove harness writes from — matching `/_api/asset`'s model). This is a *different* write path from `edit-css`, so it does **not** reopen DDR-104's curated-panel exclusion.

### 5. Background removal is browser/WASM only (never the native-addon variant)

`@imgly/background-removal` (browser variant, `onnxruntime-web` — pure WASM/WebGPU, zero native deps) runs entirely client-side. The Node variant (`@imgly/background-removal-node` → `onnxruntime-node`, a native addon) is **never** imported anywhere in `apps/studio/` — it is bun-compile-hostile exactly like the `sharp` rejection in DDR-070. The cutout matte reuses the existing `POST /_api/asset` route unchanged; its returned `assets/<sha8>.png` is what `PhotoEdit.backgroundRemoved.maskAsset` stores.

### 6. Headless drivability — the `maude design photo-*` verb family

- `photo-adjust` (**landed, E2E-verified**): a thin non-browser verb — assembles a `PhotoEdit` from flags and PUTs it to `/_api/photo-edit`. Parametric edits are pure JSON, so no harness canvas / agent-browser is warranted.
- `photo-bg-remove` (**pending Stage D**): mirrors `draw-proof.sh` — a throwaway harness canvas runs `@imgly` client-side, POSTs the matte + sidecar, sets a DOM marker; driven headlessly via agent-browser. This is the ONE path that needs a browser round-trip (it has an ML inference step). The asymmetry between the two verbs is intentional and documented in both scripts.

The `/design:photo` command wraps both; the human-clickable equivalent (Inspector Photo tab + "Edit Photo…" context menu) drives the *same* sidecar + route.

## Alternatives considered — the divergent debate (BUILDER vs SHIPPER/BREAKER)

The architecture was set by a divergent 3-seat debate followed by the user's explicit choice, not unilaterally:

- **BUILDER** argued for waking pixi.js into a WebGL raster pipeline on a new first-class photo object, plus building the headless background-removal harness in v1 — the most ambitious viable option.
- **SHIPPER** and **BREAKER** argued for staying on SVG/CSS filters applied to the existing `ImageStroke` annotation image, with the headless bg-removal harness deferred to a phase 2 (SHIPPER) — a smaller, lower-risk v1.
- **The user chose BUILDER's approach** on both forks (WebGL/pixi pipeline on a new object; headless bg-remove now), and additionally required editing to cover **both** image contexts (artboard `<img>` AND annotation `ImageStroke`) from v1.

The two flagged top risks were carried forward as explicit mitigation tasks, **not open gaps** — and both proved real:

- **BUILDER's top risk (verbatim):** *"WebGL per-iframe bundle fragility — the precedent is the v0.22.0 `motion` bundle breaking in CI."* → **Confirmed as a real bug and fixed.** The canvas bundler runs with `splitting: false`; the first `<PhotoLayer>` cut used a dynamic `import('./photo/pipeline.ts')`, which *looks* lazy, but Bun inlined pipeline.ts and **hoisted its static `import "pixi.js"` to eager** — so every unedited canvas would have fetched the ~500 KB pixi runtime, violating the lazy-bundle guarantee. Caught by building a test canvas through the real `buildCanvasModule` and inspecting the output. Fix: pipeline.ts loads pixi via a runtime `await import('pixi.js')` (external stays a lazy runtime import). Locked with `test/photo-canvas-bundle.test.ts` (0 eager pixi imports in an unedited canvas).
- **BREAKER's top risk (verbatim):** *"a new versioned data-model type needs explicit taxonomy sync."* → Closed by adding `assets/**` (incl. `.photo.json`) to the DDR-115 §3 VERSIONED table (dated addendum) with a three-list regression guard (`isMaudeRuntimeState` / `gitignore-block` / root `.gitignore` via `git check-ignore`).

## Consequences

- **Lazy-bundle guarantee holds** (verified): a canvas with zero edited photos pays zero pixi.js/bg-removal cost — the plain `<img>` renders; pixi is reached only through a runtime `import()` when a non-default edit mounts.
- **Full headless drivability for parametric edits** (verified end-to-end): `maude design photo-adjust` sets/merges/resets a sidecar against a live server with no browser.
- **A new canvas-safe write route** joins the DDR-088 family; its cap stack + dual-allowlist are regression-tested (incl. a canvas-origin reachability proof: GET 200 / DELETE 405 / PUT 200).
- **Deferred to a live-verification pass** (this session is headless — no WebGL, no browser, no desktop): the actual pixel render (`<PhotoLayer>`), the client-side ML background removal, the Inspector "Photo" tab (incl. the plan's flagged largest-unknown — threading annotation-`ImageStroke` selection into `InspectorPanel`), the context-menu entries, and WKWebView/desktop parity.

## Security review

- **Route** (defender pass): the write path is param-derived (unlike content-addressed `/_api/asset`), so the cap stack — sha8-hex extraction + containment assert + `validatePhotoEdit` + 64 KB cap — is load-bearing, not optional. Threat table (DDR-088): path-traversal → sha8-hex + containment; stored-XSS via a crafted field → `validatePhotoEdit` (the JSON is only re-read by the schema-typed compositor, never eval'd/HTML-injected); oversized-body DoS → size cap. `isLoopbackHost` DNS-rebind guard on every method.
- **Residual (accepted, DDR-054 baseline):** an already-untrusted canvas can write a **well-formed** sidecar for any sha8 — a low-severity integrity nuisance bounded by `validatePhotoEdit`, the same class as its existing ability to write arbitrary images via `/_api/asset`. No `sameOriginWrite` (would block the legit canvas origin) is a deliberate, bounded choice.
- **Supply chain:** `@imgly/background-removal` browser variant only (pure WASM); the native-addon `-node` variant is a hard exclusion. `publicPath` self-hosts the WASM + model weights (no third-party CDN fetch of pixel data / model traffic) — to be confirmed at Stage D install time.
- **AI/MCP surface:** no new outbound/model leg; the sidecar JSON never feeds a prompt. Trifecta: no change.
