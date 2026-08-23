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

### Task 1: HOTFIX apps/render token proxy — strip stale encoding headers (ship immediately) ✅ 2026-08-23 (proxy extracted to proxy.ts; fail-first red = ZlibError on verbatim replay, green after strip + accept-encoding: identity; suite wired into render-deploy.yml; v1.0.6 committed + tagged — push briefly blocked on locked 1Password SSH agent)

- **Do**: In `startTokenProxy`, stop replaying the upstream Response verbatim. Rebuild: `const h = new Headers(r.headers); h.delete('content-encoding'); h.delete('content-length'); h.delete('transfer-encoding'); return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });` — and additionally send `accept-encoding: identity` upstream (belt-and-braces; also removes the decompress cost). Keep the `record()` log lines and the 25 s per-request abort.
- **Pattern**: minimal diff; the proxy's read-only/redirect-error/SSRF posture is untouched.
- **Gotcha**: the investigator's residual: production printed no `[page diagnostics]` while every local repro fired `requestfailed` — if the first post-fix production export still hangs, a second fault (edge body-stream stall) may coexist; the proxy log will now show sub-resource lines either way, which localizes it.
- **Validate**: new fail-first test — a local gzip-serving upstream through the proxy must produce a response Chromium/`fetch` can consume (red on `return r`, green on the fix). Then patch release (`scripts/bump-version.sh patch` → tag → render-deploy) and one real cloud export of PNG + MP4. **This task alone closes the "export je rozbitý" incident.**

### Task 2: RECORD DDR + ingest debate bookend ✅ 2026-08-23 (DDR-231 authored + graph-native ingest `maude/DDR-231` with EXTENDS→DDR-230, REFERENCES→`maude/debate-hybrid-export-lanes`; debate bookend ingested with seats as authors + dissent preserved)

- **Do**: `/flow:record-ddr` — hybrid lanes decision (extends DDR-230): images = member browser, video = worker; browser MP4 rejected (Remotion CSS-subset evidence); preserved dissent = SHIPPER's decommission-the-fleet stance + BREAKER's "low-traffic lane rots" (answered by T7 canary). Ingest the resolved bookend into kgai with seats as authors, per debate-protocol §8 (seat strings as inert quotation).
- **Validate**: `kg search "hybrid export"` returns the decision; DDR file present under `.ai/archive/decisions/`.

### Task 3: CREATE in-iframe capture core (canvas runtime) ✅ 2026-08-23 (capture-core.ts extracted from _svg-playwright.mjs serializeOne — shim now delegates via getCaptureCoreBundle + window.__maudeCaptureCore; dom-to-svg added to RUNTIME_PACKAGES + importmap + dist/runtime (111KB, floor 78KB); useExportCaptureBridge in canvas-lib (postMessage protocol export-capture/-progress/-done/-error, lazy import('dom-to-svg'), world/artboard save-restore); lazy-bundle guarantee + capture-core unit tests green; tsc 0; live-Chromium smoke: SVG+PNG+restore OK)

- **Do**: Ship a capture module into the canvas runtime: given artboard id(s) + scale, produce (a) a self-contained SVG via the existing `dom-to-svg` bundle (fonts/styles inlined — tldraw pattern) and (b) a PNG rasterization of that SVG through an offscreen `<canvas>` at the requested deviceScale, honoring `png.ts`'s size guards (16 000 px side / ~600 MB ceiling). Trigger + reply over the `dgn:` postMessage channel with transferable Blobs; multi-artboard = sequential with per-item progress messages.
- **Pattern**: `_browser-bundles.ts` already builds the IIFE; serve it via the canvas runtime bundle set (`/_canvas-runtime/*`), resolved through `paths.ts` (DDR-045).
- **Gotcha**: capture must run in the CANVAS origin — the shell cannot reach the iframe DOM (origin split, DDR-054). Fonts: dom-to-svg output must embed `@font-face` data or the raster silently falls back (fidelity gate T6 catches it). Cross-origin `<img>` (R2 assets) will taint the canvas — assets must be fetched-and-inlined as data URIs before rasterize, same-origin via the canvas asset routes.
- **Validate**: unit-ish test driving the module in the studio test browser harness; a captured PNG of a smoke artboard is nonempty and dimensionally correct at ×1 and ×2.

### Task 4: UPDATE lane dispatch + export dialog — `browser` lane ✅ 2026-08-23 (client/export-lane.js = single eligibility rule, unit-tested 10/10; ExportDialog + bridged in-canvas handler route png/svg+active-artboard through captureFromCanvas → direct download, remote lane kept as automatic fallback on capture failure; `none` lane now OFFERS png/svg — note copy updated; server lane dispatch deliberately unchanged (worker stays capable = fallback + API surface); DEVIATIONS: html stays on jobs lane v1; browser captures don't write export-history v1 — a GET-only route, widening deferred to T9 review)

- **Do**: Extend `RenderLane` with `browser`. In workspace mode: `png/pdf/svg/html/pptx` resolve to `browser`; `mp4/webm/gif` stay `remote`; `zip` in-cell; `none` refusals only for video-without-render-service. The dialog drives the browser lane fully client-side (no job POST for the capture itself): progress per artboard, Blob download at the end; failures are local, human-readable, never a stack trace. Job-history entry recorded via the existing export-history route so the notification center stays coherent.
- **Pattern**: the dialog's workspace-aware copy from DDR-230 Track 1; keep the `bus.emit('export:job')` contract for anything that still runs as a cell job.
- **Gotcha**: don't dual-path desktop — `local` lane keeps the playwright spine everywhere a local browser exists; `browser` lane is workspace/cloud only. Assert in `workspace-mode.ts` that a workspace cell still never resolves `local`.
- **Validate**: `export-browser-lane.test.ts` lane-resolution matrix (fail-first for the new lane); manual cloud run: PNG of the visible artboard in ≤5 s warm.

### Task 5: UPDATE multi-artboard assembly — PPTX + PDF in the browser lane ✅ 2026-08-23 (PPTX: cell-assemble variant chosen — assemblePngDeck extracted to bytes-level seam in pptx.ts, new POST /_api/export-assemble (main-origin, CSRF, 256MB/100-img caps, fail-first manifest+containment tests), client captureDeckViaBrowser shared by both dialogs, `none` lane now serves PPTX; DECISION: pptxgenjs NOT bundled into the browser (bundle weight + DDR-176 risk) — composition stays in-cell like zip. DECISION: PDF stays on the remote worker lane — client svg2pdf double-conversion risks the exact raster/fidelity regression pdf.ts history litigated; revisit only with T6 gate evidence)

- **Do**: PPTX: re-host today's in-page half (dom-to-svg + the `pptx.ts` text-positioning fixups) in the iframe; assemble the deck client-side with `pptxgenjs` (it runs in-browser) — or, if bundle size is prohibitive, POST captured SVGs to a new cell assemble route (manifest row: `export` capability; canvas-origin TWO-allowlist rule) where the existing Node assembly runs browser-free. PDF: decide vector vs raster — `page.pdf` vector fidelity is impossible client-side; **recommended**: SVG-per-page → client vector PDF via `svg2pdf.js`, with the T6 gate arbitrating; if vector fidelity fails the gate, PDF falls back to the `remote` lane (worker) rather than shipping raster (raster PDF was explicitly rejected in `pdf.ts` history — do not relitigate silently).
- **Pattern**: `pptx.ts`'s fixup functions become shared code consumed by both hosts (single spine, BUILDER condition).
- **Gotcha**: `pptxgenjs` in-browser writes via Blob — check bundle weight against the canvas runtime budget; new deps must also be mirrored per DDR-176 if they resolve inside `apps/studio`.
- **Validate**: exported deck opens in PowerPoint/Keynote with text positioned correctly (the exact regression `pptx.ts`'s fixups exist for); PDF gate per T6.

### Task 6: ADD fidelity gate — browser lane vs playwright reference ✅ 2026-08-23 (test/export-capture-fidelity.test.ts — same-engine comparison, thresholds from MEASURED baseline: healthy 1.48/1.0, simulated text-drop 5.37/0.974 → gate meanDelta<4 + closeRatio>0.99 catches the drop class; runs in studio suite with repo Chromium)

- **Do**: A ladder test rendering the smoke canvases through BOTH capture paths (desktop playwright PNG = reference; browser-lane PNG = candidate) and diffing (pixelmatch-style threshold; per-canvas allowlist for known deltas). Runs in CI on the studio suite; the browser lane may not ship for a format until its gate is green or its delta is documented + accepted.
- **Pattern**: `/design:smoke` harness + `_smoke/` conventions.
- **Gotcha**: fonts are the classic silent killer (SHIPPER's top_risk) — include a font-heavy smoke canvas.
- **Validate**: gate red when a capture regression is injected (fail-first), green on the shipped set.

### Task 7: ADD daily render canary + honest video-lane UX ✅ 2026-08-23 (render-canary.yml: daily production-posture — health+configured+version-vs-wrangler+401 — a image-render-smoke: shipnutá ghcr image renderuje PNG end-to-end proti lokální fixture, žádný produkční secret; remote.ts lidské hlášky pro unreachable/503; /_api/export-warmup route + dialog ping on-open (fail-first manifest+containment testy); DEVIATIONS: full produkční render-job canary vyžaduje canary-scoped token mint — dokumentováno v hlavičce workflow; staged queued/waking/rendering progress text v notification centru = follow-up)

- **Do**: (a) `.github/workflows/render-canary.yml` — scheduled daily: POST a minimal real render job (tiny public smoke canvas) to `https://render.cloud.maude.sh`, assert artifact bytes + `/_health` version; alert on failure (BREAKER's condition — the lane must be exercised between releases). (b) Video-lane UX: surface `queued / waking service (~1 min) / rendering (n%)` states in the dialog instead of a silent wait; map worker errors to human-readable text, keeping the `[canvas proxy]` trail behind a "details" disclosure. (c) Optional warm-up: fire a `/_health` ping to the render service when the export dialog opens with a video format selected, so the container wake overlaps with the user's option-picking.
- **Gotcha**: canary needs a canvas the render service may fetch without a member session — mint the same short-lived viewer render token the cells mint, from a canary-scoped secret; never a write-capable token.
- **Validate**: canary run green in Actions; kill-switch documented (disable schedule) in the workflow header.

### Task 8: UPDATE docs + self-host — sidecar is video-only now ✅ 2026-08-23 (self-host.mdx + workspace.mdx + self-host skill 5b přepsány: PNG/SVG artboardu + PPTX deck = browser, sidecar jen video/PDF/multi-scope; site build zelený; whats-new entry `instant-exports-in-your-browser` pending + mirror regenerován)

- **Do**: `self-host.mdx` / `workspace.mdx` / self-host skill: image formats export in the member's browser everywhere (no sidecar needed); `--render` sidecar remains for video. Update the in-app What's New pending entry at `/flow:done` (whats-new-entry skill).
- **Validate**: docs build green; `maude hub workspace-up` copy matches.

### Task 9: Security + validation pass ✅ 2026-08-23 (adversarial pass — DEFENDER+ATTACKER seats spawned + self-audit on the exact angles; 2 reachable findings hardened in-diff: (1) tenant TSX shares the canvas window and can FORGE an export-capture-done reply → new sanitizeCapturedItem() forces safe MIME + extension on every downloaded blob (RFD/XSS neutralized), tested; (2) /_api/export-assemble formData() buffered up to Bun's ~108MB before the cap → now requires honest content-length ≤96MB (411/413), tested. postMessage bridge gates e.source both directions; assemble+warmup are main-origin+CSRF+capability-gated, evaluate no tenant TSX (containment intact — SVG-with-script is pre-existing + equal across lanes, not a browser-lane regression). Full validation: 85 touched-area + 904 sync-lane + 23 hub-manifest green; biome check . = 0; tsc 0)

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

---

# Phase 2 — Unify export fidelity across all three lanes + cross-platform automated tests

> Added 2026-08-23 after the first live cloud test on `alligators.cloud.maude.sh` (v1.0.7). Phase 1 shipped the lanes but the browser lane and the worker lane both DIVERGE from the desktop's tuned output. The desktop `local` lane is the fidelity reference ("desktop máme vyladěné"); the goal of Phase 2 is that **all three lanes produce the SAME artifact, and that this is proven by automated tests on BOTH platforms (agent-browser for the web/cloud lanes, desktop-e2e for the native app) — no more manual-only verification.**

## Problem (observed on the live v1.0.7 fleet, evidence attached)

**Browser lane (png/svg/pptx) — confirmed from the downloaded `post-lokace.svg`:**

1. **Artboard chrome leaks into the export.** The captured SVG contains `<g class="dc-artboard-label" aria-label="Artboard Lokace týdne · IG Post · 1:1">` — the editor's artboard title bar. The desktop path loads the shell with `?hide-chrome=1` (a `<style id="canvas-hide-chrome">` block in `_shell.html` that `display:none`s `.dc-artboard-label`, `.dc-mm`, `.dc-participants`, snap guides, comment pins, etc.). The browser lane captures the LIVE canvas DOM directly, so none of that chrome is hidden. **The capture must apply the same hide-chrome suppression before serializing.**
2. **Assets are NOT inlined → broken/blurry images.** Every `<image>` in the SVG kept a REMOTE href (`https://canvas-alligators.cloud.maude.sh/.design/system/alligators/assets/photos-cut/park-action-wide.jpg`), zero `data:` URIs. When the SVG is rasterized via `<img src=blob:svg>`, an SVG-as-image loads NO external resources → broken-image icons + partial/blurry render (see `post-lokace.png`). Root cause (high confidence): the cloud canvas assets require the capability `?t=<token>` (the live `<img>` loaded with it via the iframe URL), but `dom-to-svg`'s `inlineResources` fetches the BARE href without the token → 403/blocked → the `try/catch` in `capture-core.svgForElement` swallows it → href stays remote. On the desktop the assets are loopback and need no token, so `inlineResources` works — which is exactly why desktop is fine and the browser lane is not.
3. **No wait for assets/fonts before capture.** Desktop waits for `load` + `document.fonts.ready` + artboard visible. The browser-lane bridge captures immediately, so even correctly-referenced images can be mid-load ("musí se počkat na obrázky a assety než se to stáhne").
4. **PPTX UX is broken.** "Capturing 10/10" then the modal closes with nothing in the export dialog, then the file auto-downloads later with no feedback. Assets missing there too (same root cause as #2). Needs the same progress/completion UX the desktop notification-center gives.

**Worker lane (pdf/html/mp4) — needs local reproduction to pin exactly:**

5. **PDF + HTML both fail `render service refused the job: invalid render job`.** That string is `server.ts validBody` returning 400. All of format/targets/canvas.origin look valid for `artboard` scope (identical shape to mp4, which navigates), so the reason is not obvious from static reading — **T1 must reproduce the exact rejected job body locally.** Leading hypotheses: (a) `body.targets` resolves to `[]` for these formats in the remote path (validBody rejects empty), or (b) a format/target-shape mismatch specific to the html (zip-producing) / pdf (pdf-lib post-pass) adapters, or (c) `canvas.origin` empty for the non-temporal path. Do NOT guess-fix — repro first.
6. **MP4 fails `goto: Target page, context or browser has been closed`** (was a 60s timeout in Phase 1, now a crash). The worker's Chromium died mid-navigation — likely the ~3GB image + a heavy video comp exceeding the `standard-1` (0.5 vCPU / 4 GiB) container's memory, or a renderer OOM. Needs repro against the render image locally + a resource/robustness fix (frame-step fallback already exists — DDR-157 — verify it triggers in the worker).

**Cross-cutting:** the three lanes have drifted because only the desktop path had real tests. Phase 1's fidelity gate (T6) compares browser-capture vs the playwright reference IN THE SAME ENGINE, so it did NOT catch the token-gated-asset divergence (loopback fixture has no token) or the chrome leak (fixture has no `.dc-artboard-label`). **The fix is end-to-end tests against a realistic cloud-shaped setup on both platforms.**

## Solution

**Single fidelity contract, three hosts.** The desktop `local` lane is the reference. Both other lanes must match it:

- **Browser lane** gains the desktop's pre-capture discipline, in `capture-core` (shared spine, so the fix lands once): (a) suppress chrome (reuse the `_shell.html` `#canvas-hide-chrome` selector list — factor it into a shared const both the shell CSS and the capture consume, so they can't drift), (b) await fonts + every in-artboard `<img>` `.decode()`/`.complete`, (c) inline assets WITHOUT the token problem — for already-loaded same-origin images, draw the live `HTMLImageElement` to a canvas and `toDataURL()` (no fetch, no token, no taint) as the primary path, falling back to `inlineResources` only for what's not a decoded `<img>`. Verify a captured artifact has zero remote `http(s)://` refs.
- **Worker lane** is repro'd and fixed per T1/T6 above; PDF/HTML must actually render, MP4 must survive (or degrade via the frame-step fallback) inside the container's resources.
- **PPTX browser UX** routed through the same notification-center status the desktop uses (progress → done → download), no silent modal close.

**Automated cross-platform tests are the deliverable, not an afterthought:**

- **Web/cloud lanes → `agent-browser`** driving a real dev-server in a workspace-shaped config (token-gated canvas origin) that exercises the browser lane end-to-end and asserts the artifact: no `.dc-artboard-label` text, no remote asset refs, images present (non-broken), correct dimensions.
- **Native app → `desktop-e2e`** (WebdriverIO + `@wdio/tauri-service`, `apps/desktop/e2e/`) driving the real Export dialog in the bundled app and asserting the produced file for every format.
- Both run in CI; a lane may not be called "fixed" until its cross-platform test is green.

## Tasks

### Task 1: REPRODUCE every failure locally — the evidence base before any fix ✅ 2026-08-23

**Findings — two of the six hypotheses in the Problem section were WRONG; the real causes are worse and simpler.**

| # | Hypothesis in the plan | What the reproduction showed |
| --- | --- | --- |
| 1 | chrome leaks (no hide-chrome in the browser lane) | **Confirmed.** `useExportCaptureBridge` never applies suppression; `.dc-artboard-label` is a CHILD of `[data-dc-screen]`, so it serializes. Red test first. |
| 2 | assets not inlined because the cloud `?t=` token isn't on `inlineResources`' fetch | **WRONG — and the truth is bigger.** Reproduced on a plain SAME-ORIGIN localhost fixture with no token at all. dom-to-svg 0.12.2 WRITES image URLs to `xlink:href` and READS them back as `element.href.baseVal` (the SVG2 attribute), which is `''` — so its own `assert(url,'No URL passed')` throws for EVERY image, and it catches and `console.error`s its own failure. **Image inlining has never worked in this lane, on any host, cloud or not.** Desktop PNG looked fine only because it comes from a playwright screenshot, not dom-to-svg. |
| 3 | no wait for assets/fonts | **Confirmed.** Red test with a deliberately stalled image. |
| 4 | PPTX UX (silent modal close, no ledger row) | **Confirmed** in code: `downloadCapturedBlob` → `onClose()`, no status for the in-cell assemble phase, and the browser lane wrote no history entry at all. |
| 5 | pdf/html `invalid render job` — "leading hypotheses: empty targets / origin gap / adapter shape" | **REPRODUCED exactly, none of those.** `POST /_api/export-jobs {format:'pdf', scope:'project-raw'}` → `render service refused the job: invalid render job`. The route validates `isFormat` and `isScope` INDEPENDENTLY, never the pair; `project-raw` resolves to a `file-tree` target; the render service refuses file-tree targets (correctly — it holds no checkout). The scope table lived in the two dialogs and in NEITHER server. |
| 6 | mp4 target-closed = container OOM | **Not reproducible locally** (ample RAM). Left for T5, honestly unverified. |

**Plus one defect nobody had reported, found by running the lane end-to-end:** worker-lane **SVG and PPTX were failing 100%** with `page.addScriptTag: Executing inline script violates the following Content Security Policy directive`. The render worker always loads the canvas from the CANVAS origin, whose strict shell CSP (`script-src 'self' 'sha256-…'`) refuses playwright's inline injection — and `server.ts` ignores `?hide-chrome=1` for CSP selection, so the capture CSP never applied there.

**Harness:** workspace-shaped studio (`MAUDE_WORKSPACE_MODE=1` + `MAUDE_RENDER_URL`) against a real local `maude-render`. All five worker formats now verified end-to-end locally: png ✅ pdf ✅ html ✅ svg ✅ pptx ✅.
- **Do**: Stand up a workspace-shaped dev-server locally (token-gated canvas origin, `MAUDE_RENDER_URL` pointing at a local `maude-render` container built from the release Dockerfile) so all three lanes are exercisable off-cloud. Capture the EXACT rejected job body for pdf/html (`render service refused the job: invalid render job`), the mp4 container crash, and a browser-lane png/svg with the chrome + asset defects. Save the reproductions as fixtures the later tasks assert against.
- **Gotcha**: the desktop `local` lane hides all of this (no validBody, loopback assets) — the repro MUST be the workspace/remote+browser shape, not `npm run start` on this repo.
- **Validate**: each of the 6 problems reproduced locally with a captured artifact/log; hypotheses in the Problem section confirmed or replaced with the real cause.

### Task 2: FIX browser-lane chrome suppression (shared with the shell) ✅ 2026-08-23
Selector list extracted to `exporters/capture-chrome.ts` (single source), applied by `capture-core` in BOTH hosts, and the hidden nodes are now STRIPPED from the output (an empty `<g>` still carried the artboard title as `aria-label`) with dangling `aria-owns` idrefs scrubbed. `test/canvas-hide-chrome.test.ts` gained a two-way drift tripwire against the `_shell.html` block — verified fail-first by deleting one selector.
- **Do**: Factor the `_shell.html` `#canvas-hide-chrome` selector list into a single shared constant; `capture-core` applies it (hide/remove those nodes on a clone, or toggle a class) before `elementToSVG`. Never re-list the selectors in two places (they drifted once already — see the `_shell.html` comment about `.dc-mini-map` vs `.dc-mm`).
- **Validate**: a captured artboard SVG/PNG contains no `.dc-artboard-label` / `.dc-mm` / `.dc-participants` / snap-guide / comment-pin nodes; unit + the T6 fixture extended with a chrome-bearing artboard.

### Task 3: FIX browser-lane asset inlining + load-wait ✅ 2026-08-23
`capture-core` no longer calls dom-to-svg's broken `inlineResources` at all. New `inlineCaptureResources` embeds every `<image>` and every `url()` in the emitted `<style>`: **fetch first** (keeps original bytes + MIME, so a vector logo stays vector), **decoded-`<img>` → canvas → `toDataURL()` as fallback** (no network, so it survives a credentialed or opaque-origin fetch refusal). `waitForCaptureAssets` awaits `document.fonts.ready` + every in-target `<img>` decode, bounded. Both hrefs (`href` + `xlink:href`) are written so no consumer misses the embed.
- **Do**: In `capture-core`: before serialize, `await document.fonts.ready` and await every in-target `<img>` `.decode()` (or `.complete` + a bounded timeout). For inlining, add a canvas→`toDataURL()` path for decoded same-origin `<img>`/`<image>` (no fetch, no token), keeping `inlineResources` as the fallback. Assert the output has zero remote `http(s)` refs.
- **Gotcha**: cross-origin images without CORS taint the canvas → `toDataURL` throws; guard and fall back (and document that a genuinely cross-origin asset stays a remote ref, which the token-gated same-origin case is NOT). Background-image URLs (not just `<img>`) may also need handling — check the DS specimens.
- **Validate**: the `post-lokace` artboard exports with the map photo + logo embedded as `data:` URIs and renders identically to the desktop PNG (pixel-diff under the T6 threshold, now with assets).

### Task 4: FIX worker PDF + HTML (from the T1 repro) ✅ 2026-08-23
Three layers, because the bug needed all three: (a) `exporters/format-scopes.ts` is now the ONE scope table — both dialogs import it, and the three-way duplication (which had already drifted: the in-canvas copy was missing mp4/webm/gif) is gone; (b) `/_api/export` + `/_api/export-jobs` reject an incoherent pair with a sentence naming the remedy; (c) the render service's `validBody` became `rejectReason`, so its 400 names the field instead of one opaque string. Also fixed the CSP defect T1 surfaced: the SVG shim now PREFERS the page's own `__maudeCaptureCore` + importmap `dom-to-svg` and only injects as a fallback — no CSP was relaxed, and the worker now runs literally the same capture code the member's browser runs.
- **Do**: Apply the fix the T1 reproduction points to (validBody rejection root cause). If it's empty targets, fix scope resolution on the remote path; if it's a canvas.origin gap, fix the wiring; if html's zip-shape confuses the worker, handle it. Land a fail-first test with the exact repro'd job body.
- **Validate**: pdf + html export a real file from the workspace lane locally; the render service accepts and returns bytes.

### Task 5: FIX worker MP4 robustness (from the T1 repro) ⚠️ 2026-08-23 — DIAGNOSED, NOT FIXED

**The OOM hypothesis is unproven and probably not the first problem.** Worker-lane video is blocked before it can run out of anything: `_video-playwright.mjs` injects both the render lib and the encode lib with `page.addScriptTag({ content })` — an INLINE script — and the render worker always loads the canvas from the CANVAS origin, whose shell CSP is `script-src 'self' 'sha256-…'`. Measured, not assumed (probe against a page with that exact CSP):

| injection | result |
| --- | --- |
| `addScriptTag({content})` — what the video shim does | **blocked**: "Executing inline script violates the following Content Security Policy directive" |
| `addInitScript({content})` — pre-navigation | works (CDP-level, not CSP-checked) |
| `page.evaluate` | works (CDP-level) |

This is the same wall that made worker-lane **SVG fail 100%**, which T4 fixed by preferring the page's own already-loaded capture core. Video cannot use that trick: the canvas runtime does not ship the encoder (`window.__maudeEnc` exists only because the shim injects it), so the fix has to be a CSP-safe injection instead — `addInitScript` hoisted ahead of `goto` is the candidate, subject to the bundles being classic-script-safe (they are injected as `type: 'module'` today).

**Deliberately not shipped in this pass.** The change is small but unverifiable without a video-comp fixture and a real multi-minute render, and this plan's own T1 rule is repro-first. Shipping an unverified edit to the video path would be exactly the guessing the rule exists to prevent. Next session: build a minimal `<VideoComp>` fixture, reproduce the failure on the worker lane, apply the injection fix, and only THEN revisit whether a `standard-1` container is also too small.
- **Do**: Address the container Chromium crash — ensure the DDR-157 frame-step fallback + render-sized job timeout actually engage in the worker, and that the `standard-1` container has (or is given) the resources a 1080p comp needs, or the comp is capped to what fits. Human-readable failure if it genuinely can't.
- **Validate**: a short real video comp exports mp4 from the workspace lane locally without a target-closed crash.

### Task 6: FIX PPTX browser-lane UX ✅ 2026-08-23
`captureDeckViaBrowser` gained an `onAssemble` phase callback (the status used to sit on "Capturing 10/10…" through the whole in-cell composition), the dialog now ends on an explicit `Saved <name> to your downloads.` instead of closing itself, and browser-lane exports are recorded in the shared ledger — new `POST /_api/export-history` + `recordBrowserExport` on the job queue, with a `deliveredInBrowser` flag so no UI offers a download for bytes the cell never held. Closes the Phase-1 deviation "browser captures don't write export-history".
- **Do**: Route the browser-lane pptx (and png/svg) through the same status surface the desktop uses (progress in the notification center / dialog, explicit completion, then download) instead of closing the modal silently and auto-downloading later.
- **Validate**: exporting a 10-artboard deck shows continuous progress and a clear completion; asset-complete deck.

### Task 7: ADD agent-browser cross-lane e2e (web/cloud) ✅ 2026-08-23
`apps/studio/test/export-e2e-lanes.test.ts` — boots a real workspace-shaped studio, opens the REAL Export dialog in Chromium, clicks Export, catches the download and asserts the BYTES. Browser lane (png/svg/pptx, lane `none` so nothing can silently fall back to the worker) + worker lane (pdf/html against a real spawned `maude-render`). Verified fail-first: with the fixes reverted it fails with `aria-label="Artboard …"` and `xlink:href="http://…/assets/pic.png"` — the exact shape of the user's `post-lokace.svg`. Wired into CI as a **required** job (`export-lanes` in `quality.yml`), ~10 s.

**It immediately earned its keep — two more Phase-1 defects nobody had reported:**
1. `/_api/export-assemble` was missing from the read-only allowlist, so a **viewer could not export a PPTX deck at all**: every artboard captured, then a 403, with the dialog still reading "Capturing 10/10".
2. The single-artboard capture branch in `app.jsx` matched `pptx` too, asked the bridge for a "pptx", and died in `sanitizeCapturedItems` — silently degrading to the worker lane. **The dedicated deck branch was unreachable**, which is why the reported deck arrived minutes later, from the worker, with none of the browser lane's fixes in it.
- **Do**: An `agent-browser` scenario against the workspace-shaped local server that, for each browser-lane format (png/svg/pptx) AND each worker-lane format (pdf/html/mp4 via a local render container), performs the export from the real Export dialog and asserts the artifact: no chrome text, no remote refs, images present, right dimensions/format. Wire into CI.
- **Validate**: the scenario is red against today's code (chrome + assets) and green after T2–T6.

### Task 8: ADD desktop-e2e export coverage (native) ✅ 2026-08-23
`apps/desktop/e2e/scenarios/export-formats.e2e.ts` — exports PNG, SVG and PDF from the bundled `.app` and asserts the produced files. DOM-driven only; the artifact is read back over the sidecar's own HTTP API from inside the webview, which keeps the assertion off the native save panel (no computer-use). New fixture `ui/Export.tsx` + `assets/pic.png` — deliberately separate from `Smoke.tsx` (other scenarios assert its DOM) and deliberately carrying an image, since neither defect is observable on a canvas with no picture in it. The dialog testids (`export-format-<id>`, `export-scope`, `export-submit`, `export-status`, `export-recent`) landed in the same change. **Run and green against a real build** (`tauri build --debug` → 1 passing, 8.2 s).
- **Do**: Extend `apps/desktop/e2e/` (WebdriverIO + `@wdio/tauri-service`) with an export scenario that drives the bundled app's Export dialog for every format and asserts the saved file. Add the `data-testid`s the scenario needs to the export dialog in the same change.
- **Validate**: `pnpm test:e2e:desktop` exports every format from the native app and asserts fidelity; green.

### Task 9: Fidelity reconciliation + regression pin ✅ 2026-08-23
The Phase-1 gate compared two captures in the SAME engine on a fixture with no chrome and no network asset, which is why it was green through both live defects. It now has company: `test/export-capture-hygiene.test.ts` runs against a REAL HTTP origin (the only way #2 reproduces at all) with a chrome-bearing, asset-bearing artboard. The same three invariants — no editor chrome, no remote `http(s)` refs, assets present as `data:` — are now asserted on the delivered artifact in all three lanes: browser (web e2e), worker (web e2e), desktop (native e2e). The `_shell.html` ↔ `capture-chrome.ts` drift tripwire closes the loop on the selector list.
- **Do**: Make the T6 fidelity gate realistic — add a token-gated-asset fixture and a chrome-bearing fixture so it would have caught #1 and #2. Assert all three lanes produce matching artifacts for the same canvas.
- **Validate**: full suite green; the three lanes' outputs match within the fidelity threshold on the shared fixtures.

## Validation
- Every fix is fail-first (repro fixture red → green).
- `agent-browser` (web) + `desktop-e2e` (native) export scenarios green in CI for all formats.
- A live re-test on `alligators.cloud.maude.sh` matches the desktop output: no chrome, assets embedded, pdf/html/mp4 succeed.

## Acceptance Criteria
1. Browser-lane png/svg/pptx export with NO artboard chrome and ALL assets embedded, matching the desktop artifact.
2. Worker-lane pdf/html/mp4 export a real file (no "invalid render job", no target-closed crash) from a cloud workspace.
3. The browser-lane export UX shows progress + completion (no silent modal close).
4. Automated cross-platform tests (agent-browser + desktop-e2e) assert export fidelity on BOTH platforms and gate CI.
5. The T6 fidelity gate is extended so it would have caught the chrome + token-gated-asset divergences.
