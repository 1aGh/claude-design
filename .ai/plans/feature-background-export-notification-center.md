# Feature: Background export + export notification center (+ multi-artboard export correctness/perf fix)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Today `POST /_api/export` is a single synchronous request: the client `fetch`es, the server spawns a Playwright shim, renders, and only then streams bytes back. Both export dialogs (`ExportDialog` in `app.jsx` and the in-canvas `export-dialog.tsx`) block their own UI (`disabled={busy}` / `submitting`) for the full duration and stay open. A 2-minute PDF blocks that dialog from being closed/reused; a user can't kick off a quick PNG elsewhere while it runs. There is no visibility into progress, and nothing lets N exports run concurrently.

While investigating, live-testing against a real multi-artboard canvas (`/Users/iagh/git/alligators/.design/ui/alligators-moodboard-v3.tsx`, 22 artboards) surfaced a second, more severe bug that the user hit independently: exporting **"canvas → separate"** (`scope=canvas-as-separate`) scrambles artboard content (screenshot evidence: one artboard renders as scattered/overlapping fragments instead of its correct layout), and a `canvas-as-separate` PDF export of that canvas did not complete in 3 minutes (curl reproduction: `exit=28`, client-side timeout, no response). Root cause (confirmed by code read across all 5 multi-target-capable shims): each per-artboard capture pins the artboard's own `left`/`top` inline style to `0px` for the screenshot/PDF/etc. crop, but **never restores the original value** — so every subsequent artboard in the same loop is captured while all previously-processed artboards are still sitting at `(0,0)`, overlapping the current target and bleeding into its clip region. This also very plausibly explains the extreme slowness (an increasingly bloated, overlapping DOM stacked at the origin costs more to paint/print each iteration).

This plan does two coupled things:
1. **Fix the multi-target capture bug** (5 shims) and add real per-target progress reporting to the capture loop that lives inside those shims — both because it's the right fix, and because that same progress data is the raw signal the notification center needs for the *slow-but-working* case ("N of 22 artboards").
2. **Move exports to a background job queue** with a concurrency gate, a `_export-jobs/` result store, a shared WebSocket event, and a menubar notification center (badge + toast + panel) so any export (fast or slow) never blocks the UI, multiple exports can run concurrently, and the user always sees live status.

## User Story

As someone exporting mockups from Maude, I want export to run in the background with visible progress, so a slow PDF/video/many-artboard export never blocks me from immediately kicking off another export elsewhere, and I can trust that "canvas → separate" actually renders every artboard correctly instead of silently scrambling one.

## Problem

- `POST /_api/export` blocks for the full render duration; both dialogs disable their own submit button and stay open for that whole time (`app.jsx:894-961` `doExport`; `export-dialog.tsx:361-415` `submit`).
- No concurrency: nothing stops (or coordinates) N simultaneous `Bun.spawn`-heavy exports; nothing lets a fast PNG start while a slow PDF is mid-flight because the *client* itself is the thing blocking (the dialog won't let you close/reopen it while `busy`/`submitting`).
- No progress signal exists anywhere — not even coarse "N of M" for multi-artboard scope, let alone live status once backgrounded.
- **Confirmed correctness bug**: `_png-playwright.mjs:78-84`, `_pdf-playwright.mjs:86-91`, `_svg-playwright.mjs:74-75` (+ surrounding), `_html-playwright.mjs:66-67`, `_pptx-playwright.mjs:52-53` all do `ab.style.left = '0px'; ab.style.top = '0px';` per artboard in the `multi` loop and never restore it, so `scope=canvas-as-separate` exports (all 5 formats) corrupt every artboard captured after the first whenever artboards visually overlap once stacked at the origin.
- `_export-history.json`'s `appendExportHistory` (`api.ts:2536-2540`) is a classic read-modify-write race — harmless today only because exports are serialized by the synchronous model; concurrent job completions would silently drop entries.
- The in-canvas dialog is cross-origin-bridged through the main shell (`export-dialog.tsx` `bridgeRequest`/`isCrossOriginFramed` + `app.jsx:8183-8224` `runBridgedExport`); any redesign must keep both call sites (main-shell `ExportDialog` and the bridged in-canvas dialog) working identically.

## Solution

### A. Multi-target capture fix + progress instrumentation (prerequisite)

Fix the position-restore bug in all 5 shims (save the artboard's pre-mutation `left`/`top` inline style, restore it right after that artboard's screenshot/pdf/svg/html/pptx capture completes — before moving to the next target). This alone fixes the scatter bug for every multi-target format.

Add a structured, incremental progress signal from inside each shim's multi-loop: after each successful per-artboard capture, write a single line to **stdout**: `MAUDE_PROGRESS {"current":<i>,"total":<n>}` (distinct prefix so it can't collide with a written-file-path line). Extract a shared `spawnShim()` helper (new, in `exporters/_runtime.ts`) that all 6 adapters (`png`, `pdf`, `svg`, `html`, `pptx`, `video`) use instead of their ad-hoc `Bun.spawn(...) + Promise.all([...text()])` — it reads `proc.stdout` incrementally (not buffered via `new Response().text()`), splits `MAUDE_PROGRESS` lines out to an `onProgress` callback, and returns the remaining lines + full stderr text + exit code exactly as today's call sites expect. This is the single place that also wires an `AbortSignal` into `Bun.spawn`'s `signal` option, giving every export a real overall wall-clock backstop (see Task 7) — today a pathological multi-artboard loop (like the one just found) has no ceiling at all.

### B. Background job queue (server)

New `apps/studio/exporters/jobs.ts` owns:
- `ExportJob` record: `{ id, format, scope, options, status: 'queued'|'running'|'done'|'failed', progress?: {current,total}, message?, createdAt, startedAt?, finishedAt?, filename?, contentType?, error? }`.
- A small hand-rolled semaphore (same style as the `writeLocator` per-path mutex already in `http.ts:395` — no new dependency; matches this repo's zero-dep-dev-server convention) capping concurrent render-heavy jobs at `MAUDE_EXPORT_MAX_CONCURRENT` (default **2** — Playwright/Chromium launches are heavy; 2 lets a quick PNG start while a PDF/video render is mid-flight, matching the user's literal ask, without letting unbounded concurrent Chromiums exhaust the machine). Jobs beyond the cap sit `queued` until a slot frees — still fully non-blocking for the UI, just fairly rate-limited.
- `enqueue()` kicks off `runExport()` (unchanged dispatch/adapter layer, now also receiving `onProgress` + an `AbortSignal`) as soon as a slot is free, updates the in-memory job record on every transition, and emits `ctx.bus.emit('export:job', job)` on every change (queued → running → progress ticks → done/failed) — one WS event type, full-snapshot payload per change, mirroring the existing `git-status`/`sync:status` "push the whole current state" convention (`ws.ts:168-217`) rather than deltas, so a reconnecting client just needs one `GET /_api/export-jobs` resync plus live events from then on.
- On completion, writes the result bytes to `<designRoot>/_export-jobs/<id>/<filename>` (finished jobs' bytes must survive past the single HTTP response that used to carry them — the client may not even be looking at the moment it finishes) and persists a metadata-only ledger by **re-deriving the full array from the live in-memory job map** each time (sort by `finishedAt` desc, cap at 20) and overwriting `_export-history.json` in one shot — this eliminates the existing read-modify-write race entirely (no read-then-write-back-old-file step at all) rather than patching it with a mutex.
- Sweeps `_export-jobs/*` on construction (orphaned dirs from a process that died mid-export — job state is in-memory only and doesn't survive a restart, so anything on disk from a prior run is stale) and evicts a completed job's on-disk bytes once its ledger entry rolls past the cap or after a generous age (24h), whichever first.

`POST /_api/export` (existing route, `http.ts:1827-1895`) becomes a thin wrapper: `enqueue()` then `await` the same job's result — **byte-for-byte identical external contract**, so `/design:export` (the CLI wrapper, which does one blocking `fetch`) and any other synchronous caller keep working unmodified. Two new routes, both **main-origin-only** (privileged, like `/_api/export` today — DDR-060): `POST /_api/export-jobs` (same body, returns `202 {jobId}` immediately without awaiting) and `GET /_api/export-jobs` (list, for hydration + WS-reconnect resync) + `GET /_api/export-jobs/download?id=` (streams the finished job's stored bytes; 404 if missing/expired, 409 if not yet done). No `:param` dynamic-route syntax is used anywhere else in this codebase's `_api` surface — stick to the query-param convention (`/_canvas-state?file=`) rather than introducing Bun's native param routing.

### C. Client notification center

New `apps/studio/client/export-center.jsx`, structurally a near-exact twin of the existing `whats-new.jsx` (`useWhatsNew` → `WhatsNewBadge`/`WhatsNewToast`/`WhatsNewPanel`), but driven by live WS pushes instead of a static feed:
- `useExportCenter()` — holds a `Map<id, ExportJob>` hydrated once via `GET /_api/export-jobs`, upserted on every `export:job` WS message; derives `runningCount`, `queuedCount`, `recentlyDone` for the badge/toast.
- `<ExportBadge>` — menubar icon button next to `.st-whatsnew` (`app.jsx:2818-2828`), reusing the `.st-assistant`'s existing `data-busy` attribute convention (`app.jsx:2805-2816`) for "N running" instead of inventing a new visual language.
- `<ExportToast>` — reuses the `.st-toast` family (`3-shell-maude.css:441-456`) already used by `WhatsNewToast`; on `done` shows a success toast (reuse the `components-toast-menu.tsx` DS spec's `toast--ok`/`toast--sync`/`toast--error` visual language — this DS specimen literally already mocks a "Syncing… 7 of 12 nodes" progress toast, the closest existing precedent for "12 of 22 artboards").
- `<ExportPanel>` — reuses `.help-modal-backdrop` + a list styled like `WhatsNewPanel`'s `.mdcc-wn-list`/`.mdcc-wn-item`, one row per job (format/scope, status pill, progress bar or indeterminate spinner + elapsed time, a manual "Download"/"Save…" action once done).
- **Progress display rule** (honest, not fabricated): multi-target scopes (`canvas-as-separate`) show real `current/total` from the shim; single-target formats (selection/artboard scope — one Playwright call, nothing finer-grained available from Chromium) show an indeterminate spinner + elapsed seconds, never a fake percentage.
- **Completion finalize rule**: web → auto-trigger the blob download (unchanged UX) the moment `done` arrives **only if `document.hasFocus()`** at receipt time (avoids duplicate downloads if multiple tabs share one dev-server); otherwise the panel/toast carries a manual "Download" action. Native (Tauri) → **never** auto-pop the OS save dialog (would interrupt whatever the user's doing elsewhere) — always an explicit "Save…" click, in the toast and the panel row.

Both dialogs change identically: `doExport()` (`app.jsx:894-961`) and `submit()` (`export-dialog.tsx:361-415` via the bridge) now `POST /_api/export-jobs`, get `{jobId}` back near-instantly, and call `onClose()` right away — no more `busy`/`submitting`-gated blocking. `runBridgedExport` (`app.jsx:8183-8224`) becomes a thin bridge to the same `/_api/export-jobs` call; the in-canvas dialog no longer needs to poll or receive the final bytes at all — the trusted main-shell notification center (which already owns the WS connection) is the single place status/progress/completion live, regardless of which dialog created the job.

## Metadata

- **Type**: Enhancement (background job model) + Bug Fix (multi-target capture corruption)
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server + client), touches `plugins/design/commands/export.md` behavior notes only (no contract change)
- **Affected Systems**: export adapters (`exporters/*`), HTTP routes (`http.ts`), WS bus (`ws.ts`, `context.ts`), client shell (`app.jsx`, new `export-center.jsx`, `export-dialog.tsx`), runtime-state taxonomy (3 lists), tests
- **Dependencies**: none new (zero-dep dev-server convention preserved — hand-rolled semaphore + `AbortSignal`/`Bun.spawn` signal option, no queue library)

---

## Context References

### Must-Read Files

> Read every file below in parallel in a single assistant message before starting Task 1.

- `apps/studio/exporters/index.ts` — `Adapter`/`ExportContext`/`runExport` — the signature this plan extends with `onProgress`/`signal`.
- `apps/studio/exporters/_runtime.ts` — `resolveExportRuntime`/`exportShimPath` — where the new `spawnShim()` helper is added.
- `apps/studio/exporters/pdf.ts`, `apps/studio/exporters/png.ts` — the two adapters read in full; both share the identical `for (const t of elementTargets) { … Bun.spawn … }` shape that every other adapter mirrors.
- `apps/studio/exporters/video.ts` — already has a frame/timeout concept (`MAX_FRAMES`); `spawnShim()` should absorb its spawn call too for consistency.
- `apps/studio/exporters/scope.ts` — `resolveScope` — confirms `canvas-as-separate` produces **one** `Target` with `multi:true`, not N targets; the per-artboard loop lives **inside the shim**, not the TS adapter loop. Load-bearing for where progress instrumentation goes.
- `apps/studio/bin/_png-playwright.mjs` (in full) — `captureHandle`, lines 78-84 — the exact position-mutation-without-restore bug + the multi-loop (`if (multi) { … for (let i=0;…) captureHandle(...) }`).
- `apps/studio/bin/_pdf-playwright.mjs` (in full) — same bug at lines 86-91, multi-loop at `for (let i = 0; i < screens.length; i += 1)`.
- `apps/studio/bin/_svg-playwright.mjs` (lines ~70-100), `apps/studio/bin/_html-playwright.mjs` (lines ~60-115), `apps/studio/bin/_pptx-playwright.mjs` (lines ~45-85) — same bug pattern (`el.style.left/top = '0px'` in a per-target loop, no restore); confirm exact loop shape before editing.
- `apps/studio/http.ts:1790-1930` — `/_api/export`, `/_api/export-history` route handlers (exact code to preserve the external contract of).
- `apps/studio/http.ts` — grep `CANVAS_SAFE_API` (~line 2139) and the `startCanvasServer` `routes` map (`server.ts:238`) — the new `/_api/export-jobs*` routes must be absent from **both**, exactly like `/_api/export` today (DDR-060).
- `apps/studio/api.ts:170-185, 395-401, 2516-2540` — current `ExportHistoryEntry` type + `loadExportHistory`/`appendExportHistory` (being moved into `jobs.ts` and rewritten to eliminate the read-modify-write race).
- `apps/studio/ws.ts` (in full) — bus→broadcast wiring convention (`ctx.bus.on('git-status', …)` etc., lines 145-231) — the exact pattern `export:job` mirrors.
- `apps/studio/context.ts:91-153` — `Bus`/`createBus`/`Context` — where `exportJobs` gets threaded in.
- `apps/studio/server.ts` (boot sequence, ~lines 50-110) — where `const exportJobs = createExportJobQueue(ctx)` is constructed and threaded into `createHttp(ctx, api, inspect, aiActivity, exportJobs)`.
- `apps/studio/client/whats-new.jsx` (in full) — the structural template for `export-center.jsx` (hook + badge + toast + panel).
- `apps/studio/client/app.jsx:842-1112` (`ExportDialog`/`doExport`), `apps/studio/client/app.jsx:2790-2843` (menubar `.st-mb-right`, `.st-assistant` `data-busy` pattern, `.st-whatsnew`), `apps/studio/client/app.jsx:6534` (`useWhatsNew` instantiation — mirror site for `useExportCenter`), `apps/studio/client/app.jsx:7126-7224` (WS message handler — add the `export:job` branch here), `apps/studio/client/app.jsx:8165-8241` (`runBridgedExport`/`runBridgedHistory`), `apps/studio/client/app.jsx:8874, 9532-9545, 9582` (mount points for toast/dialog/panel).
- `apps/studio/export-dialog.tsx` (in full) — in-canvas dialog + cross-origin bridge (`bridgeRequest`, `isCrossOriginFramed`, `submit`, lines 360-448).
- `apps/studio/git/service.ts:210-216` (`isMaudeRuntimeState`), `cli/lib/gitignore-block.mjs` (`buildBlock`), root `.gitignore` (`.design/_export-history.json` block) — the 3 lists that must gain `_export-jobs/` together (CLAUDE.md flags this as previously-drifted and load-bearing).
- `apps/studio/test/canvas-origin-gate.test.ts` — existing assertion pattern for `/_api/export` being 403'd from the canvas origin; mirror for the 2 new routes.
- `apps/studio/test/exporters/history.test.ts`, `apps/studio/test/whats-new.test.ts` — test-style templates for the new job-queue tests and the client hook test respectively.
- `apps/studio/test/_helpers.ts` — `bootServer`/`makeSandbox`/`nextPort`/`killProc` used by every exporter test.

### Files to Create

- `apps/studio/exporters/jobs.ts` — job queue, semaphore, history persistence, `_export-jobs/` lifecycle.
- `apps/studio/client/export-center.jsx` — `useExportCenter`, `ExportBadge`, `ExportToast`, `ExportPanel`.
- `apps/studio/test/exporters/jobs.test.ts` — concurrency gate + enqueue/list + history-persistence-under-concurrency tests.
- `apps/studio/test/export-shim-multi-capture.test.ts` (or extend an existing exporter test file if a closer home exists) — regression test proving artboard position is restored after each multi-target capture (the scatter-bug fix).
- `apps/studio/test/export-center.test.tsx` — client hook test mirroring `whats-new.test.ts`.

### Design canvases

No `.design/ui/*` canvas is tagged/named for export (checked `.design/**/*.meta.json` — no match on slug or tags). Closest and most authoritative grounding is a **design-system component specimen**, not a feature mockup:

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/system/maude/preview/components-toast-menu.tsx` | DS specimen (not a feature canvas) | Documents the exact `toast`/`toast--agent`/`toast--ok`/`toast--sync`/`toast--error` visual language + a dropdown/menu anatomy, already including a "Syncing… 7 of 12 nodes" progress toast — the direct precedent for export progress toasts. Ground the new toast/badge/panel visuals here. |

### Patterns to Follow

- Menubar icon button with a live "busy" state: `.st-assistant` (`app.jsx:2804-2816`, CSS in `3-shell-maude.css`) — `data-busy="true"`/`data-unseen="true"` attributes driving `::after` CSS, not inline style.
- Headless-hook + badge + toast + panel trio: `apps/studio/client/whats-new.jsx` end-to-end.
- Bus → WS broadcast wiring: `apps/studio/ws.ts:168-217` (`ctx.bus.on('git-status', payload => broadcast({type:'git-status', payload}))`).
- Client WS dispatch: `apps/studio/client/app.jsx:7137-7217` (`if (m.type === 'sync:status') {...} else if (...)`).
- Per-path in-memory mutex precedent: `writeLocator()` in `http.ts` (~line 395) — the style precedent for `jobs.ts`'s semaphore (hand-rolled, no dependency).
- Cross-origin privileged-route gating: `/_api/export` absent from `CANVAS_SAFE_API` + `startCanvasServer` routes (`server.ts:238`), asserted in `test/canvas-origin-gate.test.ts`.

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Toast | `.st-toast` family, `3-shell-maude.css:441-456` | Reused as-is for "Export ready"/"Export failed". |
| Menubar badge | `.st-assistant` `data-busy` pattern, `app.jsx:2804-2816` | Copy the attribute-driven busy-state convention for the new Exports button. |
| Panel/list shell | `.help-modal-backdrop` + `WhatsNewPanel`'s list structure, `whats-new.jsx:192-265` | Reused for `ExportPanel`. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Determinate progress bar (job row) | No progress-bar component exists anywhere in the client today (only indeterminate spinners: `.cp-spin`/`.ob-spin`/`.rb-spin`, and static count badges) | New, small — a `<div>` with a width-percentage inner bar, tokens only (no new colors) |

### Tokens

Reuse existing tokens only — no new colors/spacing. Status coloring follows the existing `toast--ok`/`toast--error`/`toast--sync` semantic classes (already token-driven per the DS specimen).

---

## Tasks

Execute in order. Each task is atomic and testable.

### Phase A — Multi-target capture fix + progress instrumentation (fixes the reported bug; prerequisite for real progress data)

### Task 1: FIX position-restore bug in `_png-playwright.mjs`  ✅

- **Do**: In `captureHandle` (lines ~62-84), before setting `ab.style.left/top = '0px'`, save the artboard's current `left`/`top` (`el.style.left`, `el.style.top` — or the whole `style.cssText` for the artboard node to be safe against other mutated properties) into a variable. After `page.screenshot(...)` completes for that target, restore the saved values on the same element.
- **Pattern**: The existing zero-then-never-restore code at lines 78-84.
- **Gotcha**: The artboard element handle (`ab`) is resolved via `el.closest('[data-dc-screen]')` inside a `page.evaluate`/`elementHandle.evaluate` — the save/restore must happen in the SAME evaluate call (or paired evaluates against the same handle) so it's the identical DOM node.
- **Validate**: manual — export `canvas-as-separate` PNG against a canvas with 3+ artboards, confirm all artboards' `left`/`top` styles are unchanged after the export completes (inspect via devtools or a quick script).

### Task 2: FIX position-restore bug in `_pdf-playwright.mjs`  ✅

- **Do**: Same save/restore fix in the `for (let i = 0; i < screens.length; i += 1)` loop (lines ~86-91).
- **Pattern**: Task 1.
- **Validate**: re-run the exact repro that failed live — `curl -X POST http://localhost:<port>/_api/export -d '{"format":"pdf","scope":"canvas-as-separate"}'` against a many-artboard canvas; confirm it now completes and every page renders its own artboard's actual content (spot-check 3-4 pages, not just page 1).

### Task 3: FIX position-restore bug in `_svg-playwright.mjs`  ✅

- **Do**: Same fix, adapted to that shim's per-target loop shape (read the file in full first — confirm exact variable names before editing).
- **Validate**: `canvas-as-separate` SVG export, spot-check 3+ files for correct isolated content.

### Task 4: FIX position-restore bug in `_html-playwright.mjs`  ✅

- **Do**: Same fix.
- **Validate**: `canvas-as-separate` HTML export, spot-check.

### Task 5: FIX position-restore bug in `_pptx-playwright.mjs`  ✅

- **Do**: Same fix.
- **Validate**: `canvas-as-separate` PPTX export, open in Keynote/PowerPoint, spot-check 3+ slides.

### Task 6: ADD shared `spawnShim()` helper with incremental stdout progress parsing + abort support  ✅

- **Do**: In `apps/studio/exporters/_runtime.ts`, add `export async function spawnShim(args: string[], opts: { cwd: string; signal?: AbortSignal; onProgress?: (u: {current:number; total:number}) => void }): Promise<{ code: number; stdoutLines: string[]; stderr: string }>`. Internally: `Bun.spawn([resolveExportRuntime(), ...args], { cwd, stdout: 'pipe', stderr: 'pipe', signal: opts.signal })`; read `proc.stdout` incrementally (e.g. via a `TextDecoderStream` + line-splitting async iterator, NOT `new Response(proc.stdout).text()`), and for each line: if it matches `/^MAUDE_PROGRESS (.+)$/`, `JSON.parse` the rest and call `opts.onProgress`; otherwise push to `stdoutLines`. Collect `stderr` in full (unchanged). Await `proc.exited` for `code`.
- **Pattern**: `apps/studio/exporters/pdf.ts:52-64` (`capturePdf`'s current spawn block) is the thing this helper replaces.
- **Gotcha**: `Bun.spawn`'s `signal` option kills the child when the signal aborts — confirm this Bun version (`1.3.3` per `bun --version`) supports it; if not, fall back to `signal?.addEventListener('abort', () => proc.kill())`.
- **Validate**: unit test — spawn a tiny fixture script that prints a `MAUDE_PROGRESS` line then exits, assert `onProgress` fired and the line didn't leak into `stdoutLines`.

### Task 7: THREAD progress + abort-signal through the adapter interface  ✅

- **Do**: In `exporters/index.ts`, extend `Adapter.run` to `run(targets, options, ctx, hooks?: { onProgress?: (u:{current,total}) => void; signal?: AbortSignal }): Promise<ExportResult>`; extend `runExport(args)` to accept and forward an optional `hooks`. Update `pdf.ts`, `png.ts`, `svg.ts`, `html.ts`, `pptx.ts` to (a) use the new `spawnShim()` helper from Task 6 instead of their own spawn block, (b) call `hooks?.onProgress?.({current: i+1, total: elementTargets.length})` after each per-target loop iteration completes (`pdf.ts`'s `for (const t of elementTargets)` at lines 89-92, mirrored in the other 4). Update `video.ts` to also route through `spawnShim()` (no progress line needed there yet — video's own frame-count progress is a follow-up, out of scope here; just gain the abort-signal benefit).
- **Pattern**: `pdf.ts:88-92`, `png.ts:131-134` — the exact loops to instrument.
- **Gotcha**: For `canvas-as-separate` (the case that actually needs granular progress), `elementTargets.length` is **1** at the TS-adapter level (one `Target` with `multi:true` — see `scope.ts:283-291`) — the REAL per-artboard count only exists inside the shim. So the `onProgress` plumbing at the TS-adapter loop level is for the (rarer) case of N separate `Target`s; the meaningful "12 of 22" signal for `canvas-as-separate` comes from the shim's own `MAUDE_PROGRESS` lines via `spawnShim()`'s `onProgress`, NOT from the adapter's outer loop. Both paths funnel into the same `hooks.onProgress` callback.
- **Validate**: `bun test` in `apps/studio` — existing exporter tests must stay green (signature change is additive/optional).

### Phase B — Background job queue (server)

### Task 8: CREATE `apps/studio/exporters/jobs.ts`  ✅

- **Do**: Define `ExportJob` (see Solution B), a hand-rolled semaphore class capping concurrency at `Number(process.env.MAUDE_EXPORT_MAX_CONCURRENT) || 2`, and `createExportJobQueue(bus: Bus, designRoot: string, buildCtx: () => ExportContext-building-inputs)` returning `{ enqueue(args): {id, result: Promise<ExportResult>}, get(id), list() }`. `enqueue` acquires a semaphore slot (queued while waiting), transitions `queued→running`, calls `runExport({..., hooks: {onProgress, signal}})` with an `AbortController` timed at `DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000`, on success writes `result.body` to `<designRoot>/_export-jobs/<id>/<result.filename>` and transitions `running→done`, on failure/abort transitions `→failed` with `error`. Emits `bus.emit('export:job', {...job})` on every transition. Persists the ledger by re-deriving the array from the in-memory `Map` (sorted `finishedAt` desc, capped at 20) and `Bun.write`ing `_export-history.json` in one shot on every `done`/`failed` — no read-modify-write.
- **Pattern**: the per-path mutex precedent at `http.ts:395`; the existing (`api.ts:2516-2540`) history shape being replaced.
- **Gotcha**: sweep any pre-existing `_export-jobs/*` dirs on construction (orphaned from a prior process — job state doesn't survive a restart). Evict a completed job's bytes once its ledger entry rolls past the cap of 20 or after 24h.
- **Validate**: covered by Task 21's test file.

### Task 9: MOVE `ExportHistoryEntry`/history persistence out of `api.ts` into `jobs.ts`  ✅

- **Do**: Remove `loadExportHistory`/`appendExportHistory`/`HISTORY_PATH`/`HISTORY_DEPTH` and the `ExportHistoryEntry` interface from `api.ts` (lines 176-182, 399-401, 2516-2540); re-export `ExportHistoryEntry` (extended with optional `id?`, `status?`, `startedAt?`, `finishedAt?`, `error?` fields — old entries without them must still parse) from `jobs.ts`. Update the one caller (`http.ts`'s `/_api/export-history` handler) to call the job queue's `loadHistory()`/`list()` instead of `api.loadExportHistory()`.
- **Pattern**: existing call site at `http.ts:1819-1825`.
- **Gotcha**: the two client "Recent" mini-lists (`export-dialog.tsx:296-315`, `app.jsx:873-881`) only read `format`/`scope`/`filename`/`at` — adding fields is additive, don't need client changes for back-compat.
- **Validate**: `apps/studio/test/exporters/history.test.ts` stays green (adjust its import path if needed).

### Task 10: WIRE `export:job` bus event into `ws.ts`  ✅

- **Do**: Add `ctx.bus.on('export:job', (job) => broadcast({ type: 'export:job', payload: job }));` alongside the other `ctx.bus.on(...)` lines (`ws.ts:168-217`). Inspector-channel only (privileged — same class of data as `git-status`).
- **Pattern**: `ws.ts:199` (`git-status`) — copy verbatim structure.
- **Validate**: covered by Task 21/manual WS inspection.

### Task 11: THREAD `exportJobs` through `server.ts` boot + `createHttp`  ✅

- **Do**: In `server.ts`, construct `const exportJobs = createExportJobQueue(ctx.bus, ctx.paths.designRoot, ...)` near the other singleton constructions (~lines 57-107); change `createHttp(ctx, api, inspect, aiActivity)` call to `createHttp(ctx, api, inspect, aiActivity, exportJobs)`. Update `createHttp`'s signature in `http.ts:597` to accept the 5th param.
- **Pattern**: existing boot sequence lines 57-108.
- **Validate**: `bun run apps/studio/server.ts --root <sandbox>` boots without error.

### Task 12: UPDATE `http.ts` routes — `/_api/export` back-compat + new job routes  ✅

- **Do**: Rewrite the `/_api/export` handler (lines 1827-1895) to call `exportJobs.enqueue({...})` and `await result` — same validated inputs, same response shape (bytes + headers), remove the now-redundant manual `api.appendExportHistory(...)` call (lines 1867-1880, now handled inside the queue). Add `POST /_api/export-jobs` (same body validation, `202 Response.json({jobId: id})` without awaiting `result`). Add `GET /_api/export-jobs` (`Response.json({jobs: exportJobs.list()})`). Add `GET /_api/export-jobs/download` reading `?id=`, 400 if missing, 404 if job/file not found, 409 if job not yet `done`, else stream the file from `_export-jobs/<id>/` with the stored `contentType`/`filename`.
- **Pattern**: existing `/_api/export` handler for validation style (`isFormat`/`isScope`/`readJson`).
- **Gotcha**: all 3 routes (existing + 2 new) stay **absent** from `CANVAS_SAFE_API` and `startCanvasServer`'s routes map — do not add them there.
- **Validate**: `apps/studio/test/exporters/history.test.ts` (existing sync-contract test) stays green; new tests in Task 21.

### Task 13: UPDATE the 3 runtime-state taxonomy lists for `_export-jobs/`  ✅

- **Do**: Add `_export-jobs` to the directory-pattern group in `apps/studio/git/service.ts`'s `isMaudeRuntimeState` (currently line 214, alongside `_history|_trash|_draw|_smoke|_canvas-state|_state|_chat|_comments|_untrusted`); add `` `${root}/_export-jobs/` `` to `cli/lib/gitignore-block.mjs`'s `buildBlock` lines list; add `.design/_export-jobs/` to the root `.gitignore`.
- **Pattern**: exact 3-list convention documented in this repo's CLAUDE.md ("Runtime-state taxonomy is canonical in DDR-115... drifted once; update all three together").
- **Validate**: `git status` in a sandbox project after an export never shows `_export-jobs/` as untracked.

### Task 14: UPDATE `canvas-origin-gate.test.ts`  ✅

- **Do**: Add assertions that `POST /_api/export-jobs`, `GET /_api/export-jobs`, and `GET /_api/export-jobs/download` all 403 (or equivalent gate) when requested from the canvas origin, mirroring the existing `/_api/export` assertion (~line 65).
- **Pattern**: existing test structure in that file.
- **Validate**: `bun test apps/studio/test/canvas-origin-gate.test.ts`.

### Phase C — Client notification center

### Task 15: CREATE `apps/studio/client/export-center.jsx`  ✅

- **Do**: `useExportCenter()` hook (fetch `/_api/export-jobs` on mount, upsert from WS `export:job` messages passed in as an argument or via a small internal `window`-scoped subscribe — mirror how `useWhatsNew` self-contains its `fetch`, but this hook needs the live WS message, so accept a `wsMessage` prop/param the caller forwards from the existing `/_ws` handler, OR subscribe to a lightweight custom DOM event dispatched by the existing WS handler — pick whichever keeps `app.jsx`'s single WS connection as the only socket, do not open a second one). Export `ExportBadge`, `ExportToast`, `ExportPanel` components per Solution C.
- **Pattern**: `apps/studio/client/whats-new.jsx` end-to-end (hook shape, component shape, panel Escape-key handling).
- **Validate**: Task 25's component test.

### Task 16: ADD styles for the new badge/panel/progress-bar  ✅

- **Do**: Add `.st-exports` menubar button styles (mirror `.st-assistant`'s `data-busy` pattern) and a `.st-export-progress`/`.st-export-progress-bar` determinate bar (tokens only) to `apps/studio/client/styles/3-shell-maude.css` (or `4-components.css`, matching where `.st-whatsnew`/`.mdcc-wn-*` currently live — check both and follow the existing split). Reuse `.st-toast`/`.help-modal-backdrop`/`.mdcc-wn-list` wholesale for the toast/panel shells — no new classes needed there.
- **Pattern**: `3-shell-maude.css:83-87` (`.st-whatsnew[data-unseen]`), `components-toast-menu.tsx` DS spec for visual language.
- **Validate**: visual check via the dev server (light + dark theme).

### Task 17: WIRE the notification center into `app.jsx`  ✅

- **Do**: Instantiate `const exportCenter = useExportCenter(...)` near `useWhatsNew` (`app.jsx:6534`). Add a WS handler branch `else if (m.type === 'export:job' && m.payload) { exportCenter.upsert(m.payload); }` in the WS `message` listener (`app.jsx:7137-7217`, alongside the `sync:status`/`git-status` branches). Render `<ExportBadge center={exportCenter} .../>` in the `.st-mb-right` block (`app.jsx:2818-2828` area, next to `.st-whatsnew`), `<ExportToast center={exportCenter} />` near `WhatsNewToast`'s mount (`app.jsx:8874`), `<ExportPanel center={exportCenter} />` near `WhatsNewPanel`'s mount (`app.jsx:9582`).
- **Pattern**: exact `useWhatsNew`/`WhatsNewToast`/`WhatsNewPanel` wiring already in the file.
- **Validate**: manual — trigger an export, confirm the badge shows a running-count, confirm the toast/panel update live without a page reload.

### Task 18: UPDATE main-shell `ExportDialog.doExport()`  ✅

- **Do**: In `app.jsx:894-961`, replace the `fetch('/_api/export', ...)` + blob/native-save logic with `fetch('/_api/export-jobs', ...)` → on `202 {jobId}`, call `onClose()` immediately (no more `setBusy`/blob handling in this function — that moves to the notification center's completion handler). Keep the `card.handoff` branch (copy-to-clipboard) untouched — that's not a render export.
- **Pattern**: existing `doExport` structure (lines 894-961) — keep validation/options-building (`scale`, `audio`, `artboardId`, `selection`) identical, only the tail (fetch → response handling) changes.
- **Validate**: manual — click Export, confirm the dialog closes immediately regardless of format; confirm the file eventually appears (web: auto-download when focused; native: toast "Save…" button).

### Task 19: UPDATE in-canvas `export-dialog.tsx` submit + `runBridgedExport`  ✅

- **Do**: In `export-dialog.tsx`'s `submit` (lines 361-415), change both the bridged and same-origin-fallback branches to POST `/_api/export-jobs` instead of `/_api/export`, and on getting `{jobId}` back, close the dialog immediately (drop the blob-download logic from this file entirely — the main shell's notification center owns completion now, per the "one place owns status" design). In `app.jsx`'s `runBridgedExport` (lines 8183-8224), change the bridged `fetch` target to `/_api/export-jobs`, reply `{ ok: true, jobId }` immediately instead of waiting for/handling the blob.
- **Pattern**: existing bridge protocol (`bridgeRequest('export-request', 'export-result', ...)`) — message names stay the same, only the payload/behavior changes.
- **Validate**: manual — open the in-canvas dialog (⌘E inside a canvas iframe), submit, confirm it closes immediately and the export completes per the main-shell notification center.

### Task 20: ADD completion finalize handler in the notification center  ✅

- **Do**: In `useExportCenter` (or a small helper it calls), on a job transitioning to `done`: web → if `document.hasFocus()`, fetch `/_api/export-jobs/download?id=`, create a blob URL, click a hidden `<a download>` (mirror the existing logic removed from `doExport` in Task 18), else leave it for manual download. Native → never auto-call `saveExport`; the toast/panel's "Save…" button (on click) fetches the bytes and calls `saveExport(filename, bytes)` (mirror `app.jsx:936-944`).
- **Pattern**: the removed blob/native-save logic from `doExport`/`runBridgedExport` — relocated, not reinvented.
- **Validate**: manual — background-tab web export auto-downloads only when that tab is focused at completion; native export never auto-pops a save dialog.

### Phase D — Tests

### Task 21: ADD `apps/studio/test/exporters/jobs.test.ts`  ✅

- **Do**: Cover: concurrency cap is respected (start 3 render-heavy jobs with `MAUDE_EXPORT_MAX_CONCURRENT=2`, assert the 3rd stays `queued` until one of the first two finishes); `list()` returns a capped, sorted set; history persistence survives many jobs completing in quick succession without dropping entries (the race the current code has); a job's bytes are retrievable via the queue's own accessor after completion and gone after eviction.
- **Pattern**: `apps/studio/test/exporters/history.test.ts`, `apps/studio/test/_helpers.ts` (`bootServer`/`makeSandbox`/`nextPort`/`killProc`).
- **Validate**: `cd apps/studio && bun test test/exporters/jobs.test.ts`.

### Task 22: EXTEND `apps/studio/test/exporters/history.test.ts`  ✅

- **Do**: Add a case asserting old-shape entries (no `id`/`status`) still parse via the moved loader; assert the ledger caps at the new depth (20) instead of 5.
- **Validate**: `cd apps/studio && bun test test/exporters/history.test.ts`.

### Task 23: ADD multi-target position-restore regression test  ✅

- **Do**: New `apps/studio/test/export-shim-multi-capture.test.ts` (or the closest existing exporter-shim test file) — boot a sandbox with a fixture canvas containing 2+ artboards with distinct, easily-assertable content (e.g. distinct background colors/text), run `scope=canvas-as-separate` PNG export, decode both output PNGs (or inspect the shim's post-run DOM state via a debug flag / a lighter assertion: re-query the artboards' `style.left`/`style.top` after the shim process would have run against a live page — the exact assertion depends on what's feasible without a full pixel-diff; at minimum assert each output file's byte content differs meaningfully and neither is empty/corrupted-looking (non-trivial size), and ideally pixel-sample each output against its known distinct background color).
- **Pattern**: `apps/studio/test/exporters/*.test.ts` conventions, `bootServer`/`makeSandbox`.
- **Validate**: `cd apps/studio && bun test test/export-shim-multi-capture.test.ts`; also re-run the live repro against the actual alligators canvas as a final manual sanity check (Task 26).

### Task 24: EXTEND `canvas-origin-gate.test.ts` — done in Task 14 (listed here only to keep phase-D numbering complete; no separate work).

### Task 25: ADD `apps/studio/test/export-center.test.tsx`  ✅

- **Do**: Client hook test mirroring `whats-new.test.ts` — assert `useExportCenter` correctly upserts jobs from a simulated `export:job` payload sequence (queued→running→done), derives `runningCount` correctly, and that the focus-gated auto-download rule only fires when `document.hasFocus()` is true (mock it).
- **Pattern**: `apps/studio/test/whats-new.test.ts`, `apps/studio/test/use-agent-presence.test.tsx` (an existing `.tsx` hook test for a comparable live-update hook).
- **Validate**: `cd apps/studio && bun test test/export-center.test.tsx`.

### Task 26: MANUAL live verification against the real repro  ✅

- **Do**: Point the dev server at `/Users/iagh/git/alligators` (already running on port 4400 per `.design/_server.json`), re-run the exact `canvas-as-separate` PDF export that failed (3+ min, no response) and confirm it now (a) completes, (b) every page shows its own correct artboard (spot-check several, not just the first), (c) the notification center shows live "N of 22" progress while it runs. Separately, kick off a fast PNG export of a single artboard WHILE the PDF is still running and confirm it completes independently without waiting for the PDF.
- **Validate**: this is the direct, literal repro of what the user reported — it must pass before considering the feature done.

---

## Validation

This repo has no PRD/design-system doc or cross-platform scenario-runner setup for `apps/studio` (confirmed: `.ai/maude-prd.md`/`.ai/maude-design-system.md` don't exist, no `.claude/agents/` dir). Validation is grounded in what actually exists here:

1. **Lint**: `pnpm lint` (biome).
2. **Types**: `bun run apps/studio/build.ts` or `tsc --noEmit` if configured — confirm no new type errors from the `Adapter`/`runExport` signature changes.
3. **Tests**: `cd apps/studio && bun test` (full suite — must stay green, especially every existing `test/exporters/*.test.ts` and `test/canvas-origin-gate.test.ts`).
4. **Manual verification** (Task 26): the literal repro against the alligators canvas — this is the acceptance bar the user gave directly.
5. **Concurrency check**: manually confirm a slow export (PDF/video on a multi-artboard canvas) running concurrently with a fast PNG export of a different target — the PNG must finish first, independently.
6. **Both dialogs**: manually verify the main-shell `ExportDialog` (⌘E from menubar) AND the in-canvas bridged dialog (⌘E inside a canvas iframe) both close immediately on submit and both surface completion via the same notification center.
7. **Light + dark theme**: visual check of the new badge/toast/panel/progress-bar in both themes.
8. **a11y basics**: the new panel follows `WhatsNewPanel`'s existing pattern (`role="dialog"`, `aria-modal`, Escape-to-close, focus not trapped elsewhere) — no new a11y surface beyond what's already proven there.

---

## Acceptance Criteria

- [x] All 26 tasks completed
- [x] `/flow:utils-verify`-equivalent (lint + `bun test`) passes after each task group
- [x] The literal user repro passes: `canvas-as-separate` PDF export of the 22-artboard alligators canvas completes, every page is correct, and it's not required to block the UI while it runs
- [x] A quick PNG export completes independently while a slow PDF/video export is still running
- [x] Both export dialogs close immediately on submit; all export status/progress/completion lives in one menubar notification center — main-shell dialog verified live via agent-browser; in-canvas bridged dialog verified by code symmetry + typecheck (both hit the same enqueue-and-close path), not live-clicked
- [x] `/_api/export` (existing route) is byte-for-byte contract-unchanged — `/design:export` CLI wrapper needs zero changes
- [x] The 3 runtime-state taxonomy lists agree on `_export-jobs/` (git/service.ts, gitignore-block.mjs, root .gitignore)
- [x] `/_api/export-jobs`, `/_api/export-jobs` (GET), `/_api/export-jobs/download` all confirmed absent from the canvas-origin allowlist
- [x] No DDR-worthy decision left unrecorded — [DDR-153](../decisions/DDR-153-export-job-queue-and-notification-center.md) recorded
- [x] Code follows project conventions, no regressions
