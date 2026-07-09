# DDR-153: Background export job queue + menubar notification center

- **Date:** 2026-07-08
- **Status:** Accepted + **implemented**. `apps/studio/exporters/jobs.ts` (queue), `apps/studio/exporters/_runtime.ts` (`spawnShim`), `apps/studio/http.ts` (`/_api/export-jobs*` routes), `apps/studio/ws.ts` (`export:job` broadcast), `apps/studio/client/export-center.jsx` (notification center UI), `apps/studio/bin/_{png,pdf,svg,html,pptx}-playwright.mjs` (progress instrumentation).
- **Tags:** dev-server, exporters, background-jobs, notification-center, runtime-state, taxonomy, DDR-060, DDR-086, DDR-115
- **Related:**
  - [DDR-060](./DDR-060-tsx-only-migration-html-sync-collision.md), [DDR-086](./DDR-086-comment-annotation-collab-write-surfaces.md), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) — prior additions to the runtime-state taxonomy + privileged-route allowlist, the precedent this DDR follows for `_export-jobs/` and `/_api/export-jobs*`.
  - `.ai/plans/archive/feature-background-export-notification-center.md` — the plan this DDR closes out.

## Context

`POST /_api/export` was a single synchronous request: the client `fetch`ed, the server spawned a Playwright shim, rendered, and only then streamed bytes back. Both export dialogs (`ExportDialog` in `app.jsx` and the in-canvas `export-dialog.tsx`) blocked their own UI (`disabled={busy}` / `submitting`) for the full render duration. A multi-minute PDF blocked that dialog from being closed or reused; nothing let a fast PNG start while a slow PDF/video was mid-flight; there was no progress signal at all.

While investigating, a live multi-artboard export (`canvas-as-separate` scope) surfaced a second, more severe bug: each per-artboard capture pinned the artboard's `left`/`top` inline style to `0px` for its screenshot/PDF/etc. crop but never restored it, so every artboard captured earlier in a `--multi` loop stayed stacked at the origin and bled into every subsequent target's clip region — a real user-reported repro (22-artboard canvas, `canvas-as-separate` PDF) didn't complete in 3+ minutes and produced scattered/overlapping page content when it did return. Fixing this required real per-artboard progress data (`current`/`total`), which is also exactly the signal a background notification center needs to show honest progress instead of a fake percentage.

## Decision

### 1. Background job queue, not a request-scoped promise

`apps/studio/exporters/jobs.ts` owns an `ExportJob` record (`id, format, scope, options, status: queued|running|done|failed, progress?, createdAt, startedAt?, finishedAt?, filename?, contentType?, error?`) in an in-memory `Map`. `enqueue()` acquires a slot from a **hand-rolled counting semaphore** (`MAUDE_EXPORT_MAX_CONCURRENT`, default 2 — Chromium launches are heavy; 2 lets a quick PNG start while a slow PDF/video is mid-flight without letting unbounded Chromiums spawn) and returns `{id, result: Promise<ExportResult>}` **immediately**, without awaiting the render.

**No new dependency.** The semaphore mirrors the existing `writeLocator()` per-path mutex style in `http.ts` — this repo's zero-dep-dev-server convention (see CLAUDE.md) ruled out a queue library.

`/_api/export` (existing route) becomes `enqueue()` then `await result` — **byte-for-byte identical external contract**, so `/design:export` (the CLI wrapper) and any other synchronous caller need zero changes. `POST /_api/export-jobs` is the new non-blocking sibling: same body, `202 {jobId}` without awaiting.

### 2. The in-memory Map is the single source of truth for both live state and the persisted ledger

The old `_export-history.json` persistence (`api.ts` `loadExportHistory`/`appendExportHistory`) was a classic read-modify-write: read the file, prepend, write back. Harmless only because exports were serialized by the synchronous model; concurrent job completions would silently drop entries.

The new design **eliminates** the race rather than patching it with a mutex: the ledger is *re-derived* from the live `jobs` Map on every completion (`done`/`failed`, sorted `finishedAt` desc, capped at 20) and the file is overwritten in one shot — there is no read-then-write-back-old-file step at all. The Map is seeded once from disk at construction (the only read of the file) so history survives a restart even though live job state doesn't.

### 3. New privileged routes join the existing dual-allowlist, not a new trust tier

`POST /_api/export-jobs`, `GET /_api/export-jobs`, `GET /_api/export-jobs/download` are **MAIN-ORIGIN ONLY** — absent from `CANVAS_SAFE_API` and `startCanvasServer`'s routes map, the same trust boundary `/_api/export` already had (DDR-060's dual-allowlist rule). No new gate design was introduced; the untrusted canvas iframe reaches none of the three (asserted in `canvas-origin-gate.test.ts`).

### 4. `_export-jobs/` joins the runtime-state taxonomy as IGNORED

Finished job bytes are written to `<designRoot>/_export-jobs/<id>/<filename>` so a client that wasn't looking at completion time can still fetch them later. This is per-machine, regenerable, orphaned-on-restart state — the same class as `_history/`, `_smoke/`, `_canvas-state/` (DDR-115's taxonomy). Added to all three lists that must agree (`git/service.ts` `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, root `.gitignore`) in the same change, per DDR-115's own lesson that these three drifting apart is a recurring failure mode.

**Correctness note surfaced by this addition:** `_export-jobs/` sits *under* `designRoot`, and the `project-raw` export scope walks the whole design root. `scope.ts`'s `RAW_EXCLUDES` had to gain `_export-jobs` in the same commit — without it, every completed export's bytes get bundled into the *next* `project-raw` zip (which then contains the previous zip's own prior zips…), causing genuine exponential blowup, confirmed via a timing repro (25 sequential requests: 28ms → 4.7s → timeout). This is the same shape of bug DDR-115 exists to prevent systemically; `RAW_EXCLUDES` should be treated as a fourth list that any new `_`-prefixed runtime directory under `designRoot` must also join.

### 5. Client notification center owns status/progress/completion for BOTH dialogs

Both `ExportDialog.doExport()` (main shell) and the in-canvas `export-dialog.tsx`'s bridged `submit()` now `POST /_api/export-jobs`, get `{jobId}` back, and close immediately — no more `busy`/`submitting`-gated blocking. Neither dialog owns completion anymore; a single `useExportCenter()` hook (hydrated via `GET /_api/export-jobs`, kept live via the `export:job` WS broadcast) drives a menubar badge, a toast, and a panel, structurally a near-exact twin of the existing `whats-new.jsx` pattern. This mirrors DDR-086/DDR-115's precedent of routing a new live-state feed through the existing privileged inspector WS channel (`ctx.bus.on('export:job', …)`, full-snapshot payload per change) rather than inventing a second transport.

**Progress is never fabricated.** Multi-target scopes (`canvas-as-separate`) show real `current`/`total` parsed from a `MAUDE_PROGRESS {"current":N,"total":M}` stdout line each shim emits per artboard (via a new shared `spawnShim()` helper that reads shim stdout incrementally instead of buffering the whole process output). Single-target formats show an indeterminate spinner + elapsed time — there is no finer-grained signal available from a single Chromium call, and showing a fake percentage would be worse than none.

**Completion is finalized once, focus-gated.** Web: the finished job's bytes auto-download via a hidden `<a download>` only if `document.hasFocus()` at receipt time (avoids duplicate downloads across tabs sharing one dev-server). Native (Tauri): **never** auto-pops the OS save dialog — always an explicit "Save…" click, since popping a native file dialog while the user is doing something else would be actively disruptive.

## Alternatives considered

- **SSE / long-poll instead of the existing WS channel** — rejected: this repo already has exactly one privileged live-state channel (`/_ws` inspector feed) carrying `git-status`/`sync:status`/`ai-activity`/etc. in the identical "full snapshot per change" shape; adding a second transport for one more feed would be pure duplication with no benefit.
- **A real job-queue library (bull/bee-queue/etc.)** — rejected: this repo's dev-server is deliberately zero-dependency (see CLAUDE.md, and DDR-071's "the one new dep" framing for SVGO). A 2-slot counting semaphore is ~15 lines and matches the existing `writeLocator()` mutex style.
- **Percentage progress for single-target exports** (interpolating "N seconds elapsed → assume M% done") — rejected as dishonest; an indeterminate spinner communicates the true state (no finer signal exists) without implying a false precision.
