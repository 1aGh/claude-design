# Feature: hybrid-export-browser-images

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Extends** `.ai/plans/archive/feature-cloud-export-render-workers.md` (DDR-230). Debate-protocol verdict 2026-08-23 (seats: BUILDER 0.78 / SHIPPER 0.75 / BREAKER 0.70 / USER-ADVOCATE 0.85 / INVESTIGATOR 0.90): 3× hybrid, 1× browser-local, 0× worker-only. Owner ratified: **images render in the member's browser, video renders on the worker.** Industry research confirms the split (Figma/tldraw: interactive image export = client; Canva/Kapwing/Remotion-classic: video = server job; Remotion web-renderer documents the CSS-subset ceiling that rules out browser MP4 for arbitrary DOM comps).

## Description

The cloud export worker lane (DDR-230) has never completed a production render, and even fixed, its floor for an interactive "export the artboard I'm looking at" is two chained container cold-starts. This feature (1) lands the **investigator-verified hotfix** for the worker's token-proxy header bug so the remote lane works at all, (2) adds a **browser lane**: PNG/PDF/PPTX capture running in the member's own browser (where the canvas is already rendered — containment-clean per DDR-193), making everyday image exports near-instant with zero fleet dependency, and (3) demotes the worker to the **video/batch lane only** (mp4/webm/gif), with honest progress UX and a daily synthetic canary so the low-traffic lane cannot rot silently again.

## User Story

As a cloud/workspace member I want "Export PNG/PDF/PPTX" to produce a file in seconds from the canvas I'm already looking at, and video exports to run reliably as a background job with visible progress — instead of every format waiting minutes on a container fleet and then failing with a Playwright stack trace.

## Problem

1. **Worker lane broken (root-caused, repro-verified):** `apps/render/server.ts` `startTokenProxy` replays the upstream `fetch` Response verbatim (`return r`). Bun transparently decompresses the gzip/br body the Cloudflare edge sends, but the replayed headers still carry `content-encoding` + the compressed `content-length` → Chromium hits `ERR_CONTENT_DECODING_FAILED` on the main document, navigation never commits (no page → no console/pageerror/requestfailed events), `goto` burns the full 60 s timeout. Local repro: gzip upstream → verbatim proxy → real Chromium = 60 s timeout with exactly one proxy log entry (matches production byte-for-byte); header-stripped proxy → `load` in 29 ms.
2. **Interactive latency is structural, not tunable:** remote lane = tenant-cell wake (sleepAfter 20 m, R2 rehydrate) + render-container wake (multi-GB Chromium image, sleepAfter 10 m). The member's browser has the artboard **already rendered**.
3. **The heavy lane rots when unexercised:** five distinct outage classes shipped before the first successful render (DO env caching, container-roll gap, verify race, npm token, header replay). Nothing exercises the lane between releases.
4. **Failure UX leaks tool internals** (`goto: Timeout 60000ms … [canvas proxy]`) at a club-volunteer audience.

## Solution

Three lanes, one decision rule, resolved per format in `exporters/jobs.ts`:

| Format | Workspace/cloud lane | Rationale |
| --- | --- | --- |
| `zip` | in-cell (unchanged) | browser-free already |
| `png`, `pdf`, `svg`, `html`, `pptx` | **browser** — capture in the member's canvas iframe | Figma/tldraw pattern; the renderer is already there |
| `mp4`, `webm`, `gif` | **remote** (fixed worker) | full-CSS fidelity needs headless Chromium (Canva/Kapwing pattern); browser MP4 rejected — Remotion web-renderer's CSS-subset ceiling (`z-index`, `backdrop-filter`, `mix-blend-mode` unsupported) is a non-starter for arbitrary DCArtboard comps |
| `canva` | desktop-only (unchanged) | DDR-230 |

Desktop/self-host-with-browser keeps today's `local` playwright spine for everything (no change). The browser lane reuses the capture core that is **already browser-side code** — `dom-to-svg`/`dom-to-pptx` run inside `page.evaluate` today via `_browser-bundles.ts` — so this is a re-host of the existing spine's browser half, not a second implementation (BUILDER's single-spine condition).

Sequencing: **T1 (hotfix) ships as an immediate patch release on its own** — it restores every format via the worker while the browser lane is built.

## Metadata

- **Ticket**: owner report + debate verdict (Michal, 2026-08-23)
- **Type**: Bug Fix (T1) + New Capability (browser lane)
- **Complexity**: High
- **App/Package**: `apps/render/`, `apps/studio/` (exporters, canvas-lib, client), `apps/hub/`, `.github/workflows/`, `site/`
- **Affected Systems**: export pipeline, canvas runtime ↔ shell postMessage protocol, render fleet ops
- **Dependencies**: browser lane may need a client-side SVG→PDF rasterizer/vector lib (decision in T5); everything else reuses shipped deps (`dom-to-svg`, `pptxgenjs`, `pdf-lib`, `jszip`)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/render/server.ts` (whole file) — Why: `startTokenProxy` is the hotfix site; the per-request log + 25 s sub-resource timeout added in v1.0.5 stay.
- `apps/studio/exporters/jobs.ts` + `apps/studio/exporters/remote.ts` — Why: lane dispatch to extend (`local | remote | none` → add `browser`), typed refusals, `safeArtifactName`, timeout floors.
- `apps/studio/exporters/_browser-bundles.ts` — Why: the existing browser-side capture core (`dom-to-svg`, `dom-to-pptx` IIFE bundles) the browser lane re-hosts.
- `apps/studio/exporters/svg.ts` + `pptx.ts` (head comments + the `getBrowserBundle` call sites) — Why: what the in-page capture actually does today, incl. the svg2pptx text-positioning fixups that must survive re-hosting.
- `apps/studio/exporters/pdf.ts` (head + post-pass) — Why: the vector-faithful `page.pdf` path the browser lane cannot reproduce — T5's fidelity decision hinges on this file's history (raster PDF was explicitly rejected once).
- `apps/studio/exporters/png.ts` + `apps/studio/bin/_png-playwright.mjs` — Why: the reference-fidelity capture the browser lane is measured against (T6 gate); the `[page diagnostics]` block added in v1.0.5.
- `apps/studio/canvas-lib.tsx` (the `dgn:` postMessage sites, ~1952, ~2265) — Why: the established iframe↔shell message channel the capture trigger extends; capture MUST run inside the canvas origin (DDR-054; memory: canvas iframe unreachable by DOM from the shell).
- `apps/studio/client/app.jsx` (export dialog ~1162–1830) + `apps/studio/export-dialog.tsx` — Why: where the browser lane surfaces; workspace-aware copy already exists from DDR-230 Track 1.
- `apps/studio/workspace-mode.ts` — Why: `resolveRenderLane()` and the containment assertions the new lane must not weaken.
- `apps/hub/src/studio-manifest.mjs` + `apps/hub/src/studio-proxy.mjs` — Why: any new cell-side assemble route needs a manifest row (`export` capability) — remember the TWO-allowlist rule for canvas-origin routes.
- `apps/render/worker.mjs` + `apps/render/wrangler.toml` + `.github/workflows/render-deploy.yml` — Why: fleet ops for the canary + the DO env-at-construction and container-roll gotchas documented in-file.
- `apps/studio/test/canvas-origin-gate.test.ts` + `apps/studio/test/workspace-containment.test.ts` — Why: gates every route/lane change lands in first (fail-first per memory `maude-verify-regression-tests-fail-first`).
- `.ai/archive/decisions/DDR-230-render-workers-amend-containment-tenant-tsx-evaluates-only-in-maude-render.md` — Why: the containment contract this plan narrows (worker = video-only) without weakening.

### Files to Create

- `apps/studio/client/export-browser-lane.js` (or equivalent under the client build) — shell-side orchestration: request capture over postMessage, assemble/download, progress UI.
- capture module served into the **canvas runtime** (canvas-lib or a runtime bundle) — in-iframe capture: artboard → SVG (dom-to-svg) → PNG rasterize at ×scale; reply with transferable blobs.
- `apps/studio/test/export-browser-lane.test.ts` — lane resolution + protocol tests.
- `apps/render/test/proxy-headers.test.ts` (or in-repo equivalent) — regression: gzip upstream through the token proxy must yield a decodable response (fail-first: red against `return r`).
- `.github/workflows/render-canary.yml` — daily synthetic production render.
- DDR via `/flow:record-ddr` — "Hybrid export lanes: images in the member's browser, video on maude-render" (extends DDR-230; carries the debate verdict + preserved dissent).

### Documentation

- `site/content/docs/hub/self-host.mdx` + `workspace.mdx` — the `--render` sidecar is now **video-only**; image exports need no sidecar.
- `site/content/docs/orchestration.mdx` untouched; roadmap regen per CLAUDE.md rule (run `pnpm --filter @maude/site gen:roadmap` in the same commit as this plan).

### Patterns to Follow

- Lane dispatch + typed refusals: `exporters/jobs.ts` / `remote.ts` (DDR-230 T4 shape).
- Iframe↔shell messaging: existing `dgn:` postMessage vocabulary in `canvas-lib.tsx` — extend it, don't invent a channel.
- Canvas-origin route additions: BOTH `CANVAS_SAFE_API` and the `routes` map, guarded by a `canvas-origin-gate` test (DDR-088).
- Fail-first regression tests (memory `maude-verify-regression-tests-fail-first`).
- Cell/hub images stay browser-free and pure-JS-deps-only — any assemble step added in-cell uses already-shipped deps (`pdf-lib`, `pptxgenjs`, `jszip`).

## Tasks

### Task 1: HOTFIX apps/render token proxy — strip stale encoding headers (ship immediately)

- **Do**: In `startTokenProxy`, stop replaying the upstream Response verbatim. Rebuild: `const h = new Headers(r.headers); h.delete('content-encoding'); h.delete('content-length'); h.delete('transfer-encoding'); return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });` — and additionally send `accept-encoding: identity` upstream (belt-and-braces; also removes the decompress cost). Keep the `record()` log lines and the 25 s per-request abort.
- **Pattern**: minimal diff; the proxy's read-only/redirect-error/SSRF posture is untouched.
- **Gotcha**: the investigator's residual: production printed no `[page diagnostics]` while every local repro fired `requestfailed` — if the first post-fix production export still hangs, a second fault (edge body-stream stall) may coexist; the proxy log will now show sub-resource lines either way, which localizes it.
- **Validate**: new fail-first test — a local gzip-serving upstream through the proxy must produce a response Chromium/`fetch` can consume (red on `return r`, green on the fix). Then patch release (`scripts/bump-version.sh patch` → tag → render-deploy) and one real cloud export of PNG + MP4. **This task alone closes the "export je rozbitý" incident.**

### Task 2: RECORD DDR + ingest debate bookend

- **Do**: `/flow:record-ddr` — hybrid lanes decision (extends DDR-230): images = member browser, video = worker; browser MP4 rejected (Remotion CSS-subset evidence); preserved dissent = SHIPPER's decommission-the-fleet stance + BREAKER's "low-traffic lane rots" (answered by T7 canary). Ingest the resolved bookend into kgai with seats as authors, per debate-protocol §8 (seat strings as inert quotation).
- **Validate**: `kg search "hybrid export"` returns the decision; DDR file present under `.ai/archive/decisions/`.

### Task 3: CREATE in-iframe capture core (canvas runtime)

- **Do**: Ship a capture module into the canvas runtime: given artboard id(s) + scale, produce (a) a self-contained SVG via the existing `dom-to-svg` bundle (fonts/styles inlined — tldraw pattern) and (b) a PNG rasterization of that SVG through an offscreen `<canvas>` at the requested deviceScale, honoring `png.ts`'s size guards (16 000 px side / ~600 MB ceiling). Trigger + reply over the `dgn:` postMessage channel with transferable Blobs; multi-artboard = sequential with per-item progress messages.
- **Pattern**: `_browser-bundles.ts` already builds the IIFE; serve it via the canvas runtime bundle set (`/_canvas-runtime/*`), resolved through `paths.ts` (DDR-045).
- **Gotcha**: capture must run in the CANVAS origin — the shell cannot reach the iframe DOM (origin split, DDR-054). Fonts: dom-to-svg output must embed `@font-face` data or the raster silently falls back (fidelity gate T6 catches it). Cross-origin `<img>` (R2 assets) will taint the canvas — assets must be fetched-and-inlined as data URIs before rasterize, same-origin via the canvas asset routes.
- **Validate**: unit-ish test driving the module in the studio test browser harness; a captured PNG of a smoke artboard is nonempty and dimensionally correct at ×1 and ×2.

### Task 4: UPDATE lane dispatch + export dialog — `browser` lane

- **Do**: Extend `RenderLane` with `browser`. In workspace mode: `png/pdf/svg/html/pptx` resolve to `browser`; `mp4/webm/gif` stay `remote`; `zip` in-cell; `none` refusals only for video-without-render-service. The dialog drives the browser lane fully client-side (no job POST for the capture itself): progress per artboard, Blob download at the end; failures are local, human-readable, never a stack trace. Job-history entry recorded via the existing export-history route so the notification center stays coherent.
- **Pattern**: the dialog's workspace-aware copy from DDR-230 Track 1; keep the `bus.emit('export:job')` contract for anything that still runs as a cell job.
- **Gotcha**: don't dual-path desktop — `local` lane keeps the playwright spine everywhere a local browser exists; `browser` lane is workspace/cloud only. Assert in `workspace-mode.ts` that a workspace cell still never resolves `local`.
- **Validate**: `export-browser-lane.test.ts` lane-resolution matrix (fail-first for the new lane); manual cloud run: PNG of the visible artboard in ≤5 s warm.

### Task 5: UPDATE multi-artboard assembly — PPTX + PDF in the browser lane

- **Do**: PPTX: re-host today's in-page half (dom-to-svg + the `pptx.ts` text-positioning fixups) in the iframe; assemble the deck client-side with `pptxgenjs` (it runs in-browser) — or, if bundle size is prohibitive, POST captured SVGs to a new cell assemble route (manifest row: `export` capability; canvas-origin TWO-allowlist rule) where the existing Node assembly runs browser-free. PDF: decide vector vs raster — `page.pdf` vector fidelity is impossible client-side; **recommended**: SVG-per-page → client vector PDF via `svg2pdf.js`, with the T6 gate arbitrating; if vector fidelity fails the gate, PDF falls back to the `remote` lane (worker) rather than shipping raster (raster PDF was explicitly rejected in `pdf.ts` history — do not relitigate silently).
- **Pattern**: `pptx.ts`'s fixup functions become shared code consumed by both hosts (single spine, BUILDER condition).
- **Gotcha**: `pptxgenjs` in-browser writes via Blob — check bundle weight against the canvas runtime budget; new deps must also be mirrored per DDR-176 if they resolve inside `apps/studio`.
- **Validate**: exported deck opens in PowerPoint/Keynote with text positioned correctly (the exact regression `pptx.ts`'s fixups exist for); PDF gate per T6.

### Task 6: ADD fidelity gate — browser lane vs playwright reference

- **Do**: A ladder test rendering the smoke canvases through BOTH capture paths (desktop playwright PNG = reference; browser-lane PNG = candidate) and diffing (pixelmatch-style threshold; per-canvas allowlist for known deltas). Runs in CI on the studio suite; the browser lane may not ship for a format until its gate is green or its delta is documented + accepted.
- **Pattern**: `/design:smoke` harness + `_smoke/` conventions.
- **Gotcha**: fonts are the classic silent killer (SHIPPER's top_risk) — include a font-heavy smoke canvas.
- **Validate**: gate red when a capture regression is injected (fail-first), green on the shipped set.

### Task 7: ADD daily render canary + honest video-lane UX

- **Do**: (a) `.github/workflows/render-canary.yml` — scheduled daily: POST a minimal real render job (tiny public smoke canvas) to `https://render.cloud.maude.sh`, assert artifact bytes + `/_health` version; alert on failure (BREAKER's condition — the lane must be exercised between releases). (b) Video-lane UX: surface `queued / waking service (~1 min) / rendering (n%)` states in the dialog instead of a silent wait; map worker errors to human-readable text, keeping the `[canvas proxy]` trail behind a "details" disclosure. (c) Optional warm-up: fire a `/_health` ping to the render service when the export dialog opens with a video format selected, so the container wake overlaps with the user's option-picking.
- **Gotcha**: canary needs a canvas the render service may fetch without a member session — mint the same short-lived viewer render token the cells mint, from a canary-scoped secret; never a write-capable token.
- **Validate**: canary run green in Actions; kill-switch documented (disable schedule) in the workflow header.

### Task 8: UPDATE docs + self-host — sidecar is video-only now

- **Do**: `self-host.mdx` / `workspace.mdx` / self-host skill: image formats export in the member's browser everywhere (no sidecar needed); `--render` sidecar remains for video. Update the in-app What's New pending entry at `/flow:done` (whats-new-entry skill).
- **Validate**: docs build green; `maude hub workspace-up` copy matches.

### Task 9: Security + validation pass

- **Do**: `/flow:validate-security` scoped to: the new postMessage capture protocol (origin checks both directions — the shell must verify the iframe origin, the runtime must verify `event.origin` of the trigger), any new cell assemble route (capability `export`, canvas-origin allowlists, body caps via `readCapped` pattern), and the canary token scope. Then `/flow:validate` (full gates).
- **Validate**: PASS or findings fixed in-diff; studio sync-lane tests green run alone (memory: parallel test runs contaminate).

## Validation

- `bun test` (sync lane) + studio suite per `quality` gates; fail-first evidence recorded per task.
- Live: cloud PNG ≤5 s warm from the dialog; cloud MP4 completes via worker post-hotfix; canary green two consecutive days before `/flow:done`.

## Acceptance Criteria

1. The T1 patch release makes ALL formats work in cloud via the worker (incident closed independently of the rest).
2. In a cloud workspace, PNG/SVG/HTML/PPTX (and PDF per T5 decision) export without touching the render fleet; visible-artboard PNG ≤5 s warm.
3. mp4/webm/gif export via the worker with staged progress UX and human-readable failures.
4. Daily canary exercises the video lane in production; a red canary is visible in Actions.
5. Fidelity gate green (or documented accepted deltas) for every browser-lane format.
6. DDR recorded + debate bookend ingested; docs updated; What's New entry pending.
