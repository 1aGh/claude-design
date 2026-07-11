# DDR-161: In-app photo editor — pixi.js WebGL pipeline, the `PhotoEdit` sidecar, and the headless edit surface

- **Date:** 2026-07-10
- **Status:** Accepted (partially implemented — feature `photo-editor`: Stages A–C + the parametric CLI landed and verified; Stages D–F [client-side ML background removal, Inspector "Photo" tab, context menus] + desktop parity pending a live-browser verification pass)
- **Tags:** studio, canvas-runtime, photo, pixi, webgl, raster, sidecar, imgly, background-removal, cli, headless, lazy-bundle, security, DDR-024, DDR-070, DDR-088, DDR-115
- **Related:** [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md) (parked pixi.js — this is its first activation), [DDR-070](./DDR-070-svg-generation-geometry-engine.md) (the vector `draw/` engine this is the raster counterpart to; its `sharp`/native-addon exclusion is why background removal is browser-only), [DDR-088](./DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the canvas-media / asset-write surface + dual-allowlist rule the new route joins), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (the untrusted-canvas trust model the route's residual is bounded by), [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) (the canvas-origin CSP/`connect-src` invariant the 2026-07-11 addendum below narrows with one exception), [DDR-104](./DDR-104-css-panel-ux-model.md) (why `filter`/`backdrop-filter` are excluded from the curated CSS panel — this is a *different* write path, not a reopening), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (the runtime-state taxonomy the `.photo.json` sidecar is added to).

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

## Addendum (2026-07-10) — live-dogfood round 2: the live-preview compositor is a direct src bake, not a floating overlay

The live-verification pass this DDR deferred (§ Consequences) happened across two rounds. Round 1 landed the `<PhotoLayer>` pixi compositor as a `position:fixed` overlay (`PhotoPreviewOverlay`) floating on top of the real photo element — hiding the original via `visibility:hidden` and rendering the composite in a separately-tracked screen-rect div. Round 2's live dogfood found this architecture itself was the root cause of a cluster of bugs, not fixable by patching the overlay further:

- The overlay needed its own z-index (`30`), which drew over the context menu.
- Resize/zoom changes had to re-track the overlay's screen rect via a per-frame rAF loop; the tracking didn't reliably match the real element's box, so the visible photo grew/shrank relative to its own frame on zoom.
- cmd+click and right-click landed on whatever was BEHIND the (now `visibility:hidden`, hence non-hit-testable) original, since the decoy on top was `pointer-events:none` — nothing was clickable.
- The bridge only knew about an edit via a transient `postMessage`, so any canvas remount (Cmd+R, HMR) reset it to nothing until a human reopened the Inspector and nudged a knob.

**Fix:** `PhotoPreviewBridge` (`canvas-lib.tsx`) now bakes the composite to a `data:image/png` URL (`renderPhotoDataUrl`, `photo/pipeline.ts` — an offscreen pixi render at the source's NATIVE resolution) and swaps it directly onto the real `<img>`/`<image>` element's `src`/`href` — restoring the original when the edit goes neutral. Resize, zoom, hit-testing, and stacking become the browser's native `<img>`/`<image>` behavior again; no hand-rolled tracker. Non-destructive still holds: only the live DOM attribute is mutated, never the authored TSX/SVG source, and the on-disk `PhotoEdit` sidecar remains the persisted source of truth (a boot-time + `MutationObserver`-driven rescan re-applies it on every canvas load, closing the "reset to nothing on remount" gap too).

This DOM-swap needed a stable way to re-locate an already-baked element (its `src` is now a `data:` URL, no longer containing the original `assets/<sha8>.<ext>` reference) — solved with a `data-photo-asset` attribute stamped on first touch. A follow-up security fan-out (security-auditor + ethical-hacker) on that mechanism found it was trusted without validating its shape, which — since the canvas iframe is untrusted content (DDR-054) — let an authored canvas plant an unshaped value that rode unbounded into `_active.json`/the WS broadcast (`inspect.ts`'s `enrich()`, which round-trips `photoKind`/`photoAsset` as of this round so the Inspector's Photo tab survives a canvas switch or reconnect). Fixed: `data-photo-asset` is now shape-validated against the `assets/<sha8>.<ext>` regex at every read site (`dom-selection.ts`, `canvas-lib.tsx`) and at the server persist site (`inspect.ts`); the boot-scan also gained a single-attempt-per-asset cache + a 500-element per-pass ceiling (it previously re-fetched every unedited asset on every DOM mutation, forever).

Commits: `fc84db67` (fix), `ebbb579f` (STATE.md).
- **AI/MCP surface:** no new outbound/model leg; the sidecar JSON never feeds a prompt. Trifecta: no change.

## Addendum (2026-07-11, fix-photo-editor-followup-debt) — `connect-src` CSP exception for the model-weight CDN

Resolves the open question in § Security review / Supply chain above ("to be confirmed at Stage D install time"): **not self-hosted.** Grepping the installed `@imgly/background-removal` package directly (rather than assuming from memory) confirmed its model weights (~11-44 MB) fetch from IMG.LY's own default CDN, `https://staticimgly.com`, on first client-side use — there is no bundled/self-hosted alternative today. `onnxruntime-web`'s own bundled JS references no external hostname (its WASM binaries load relative to itself), so this is the ONE external host the feature needs.

This was a **real, previously-undiscovered gap** at the retroactive security fan-out for feature-photo-editor's `/flow:done` close-out (2026-07-10): `cspForCanvasShell` (`apps/studio/http.ts`) locks `connect-src 'self'` — a hard architectural invariant this repo has held since the CSP was built (DDR-054 Task 8 / DDR-060's "9.1-A" origin-segregation fix) — so the interactive "Remove Background" button (which runs inside the canvas-origin shell, not the main studio origin) was silently unable to reach the CDN under the default split-origin mode. The gap was invisible in same-origin dev/test sessions (no CSP enforced there), which is exactly the trap `feature-photo-editor`'s own live-dogfood note above (§ Addendum 2026-07-10) already flagged once for this same feature: same-origin testing masks CSP-shaped bugs.

**Decision:** add a narrow, single-host exception — `connect-src 'self' https://staticimgly.com` — documented inline at the directive's declaration in `cspForCanvasShell`'s doc comment, with an explicit statement that it is the ONLY exception to the `connect-src 'self'` invariant so a future reviewer doesn't read it as precedent for adding further hosts without the same scrutiny (exact hostname, no wildcard subdomain, a DDR record). Self-hosting the model weights (removing the need for this exception entirely) was considered and explicitly deferred as separate, larger follow-up work — it would need either bundling ~40 MB of model weights into the npm/binary distribution (conflicts with the lazy-bundle guarantee this DDR's § Consequences establishes) or standing up a proxy/mirror, neither of which fits this follow-up's scope.

Regression guard: `apps/studio/test/csp-canvas-shell.test.ts` asserts the `connect-src` directive is exactly `connect-src 'self' https://staticimgly.com` — both that the exception is present (against silent reversion) and that no additional host has crept in beside it (against silent scope creep).

- **Security review, updated:** the inference itself is still 100% client-side (pixels never leave the browser, confirmed in the original DDR text above) — only the one-time weight *download* now has a documented, narrow egress path. No change to the AI/MCP surface or trifecta analysis.
