# Feature: Resync the whole panel, and survive the sweep

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Two changes that only make sense together:

1. **A Resync control on the Sync panel** that re-runs the *whole* sync — every canvas and every asset — without restarting the app.
2. **The asset sweep moves into its own process**, so a fault in it costs the sweep instead of the editor.

The order matters. Resync over today's in-process sweep would hand the user a button that reliably kills their dev server on a large project: the sweep crashes Bun 1.3.3 *when it runs alongside the dev server*, proven by isolation — the identical sweep against the same live hub completes standalone (182/182, 0 failures) and crash-loops in-process (4 crashes: `Segmentation fault at address 0x0` ×3 plus a bus error, then the supervisor gave up after 3 restarts).

## User Story

As someone whose project is linked to the cloud, I want to press one button and have Maude re-check everything — canvases and assets — so that "is my work actually up there?" has an answer I can act on instead of a relaunch.

## Problem

- **No way to retry anything.** The sync links once at boot. If a canvas was refused or an asset upload died, the only recourse is quitting the app — which starts the same doomed sweep again.
- **The dev server dies mid-sweep.** Not just the sweep: canvases, the browser UI, the ACP panel, all of it, then three restarts and give up.
- **A dead sweep is invisible.** `_sync.json` keeps the last emit forever; nothing ever says "this stopped".

## Solution

**The resync mechanism already exists.** `createSyncSupervisor` (`sync/supervisor.ts:110`) exposes `restart(linkedHub?)`, which stops the runtime, drops it, and boots a fresh one — and `boot()` re-links every canvas *and* fires the asset sweep. It is what `/_api/hub/link` and unlink already call (`cloud/endpoints.ts:371,492`). Its calls are serialized on one chain, with a comment naming the exact hazard a naive implementation would hit: *"Two Connects pressed in quick succession must not interleave a stop() with another cycle's start()."*

So the button is one thin privileged route over `ctx.syncControl.restart()` — not a new lifecycle. Almost all the work in this plan is the *other* half: making the sweep a child process, so that button is safe to press.

- Parent spawns `asset-push-worker.ts` under `resolveBunPath()` with `workerEnv()` — the pattern from `canvas-build-sandbox.ts`, which already solves the packaged-app problem (DDR-177: `BUN_BE_BUN=1` when the "bun" being spawned is the compiled sidecar itself).
- The child runs today's `pushAssets` unchanged and writes **one NDJSON line per progress emit** to stdout.
- The parent maps lines onto `store.updateAssets(p)` — the call it already makes — so `_sync.json`, the WS fanout and the panel payload are untouched.
- A dead child is a **failed sweep**, reported. The dev server lives.

## Metadata

- **Ticket**: manual (RCA step 2 — `.ai/logs/rca/issue-asset-sweep-head-becomes-get-and-in-process-crash.md`)
- **Type**: Enhancement + Refactor
- **Complexity**: Medium (the lifecycle exists; the process boundary and packaging are the real work)
- **App/Package**: `apps/studio`
- **Affected Systems**: sync runtime + supervisor, http routing, studio client (Sync panel), desktop packaging, desktop E2E
- **Dependencies**: none new — the child imports `node:fs`/`node:path` + `Bun.*`, already covered by `helper-deps.mjs`'s import-graph walk

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/sync/supervisor.ts` (lines 110–180) — Why: `restart()` IS the feature's backbone; read the chain-serialization comment before adding any locking of your own.
- `apps/studio/cloud/endpoints.ts` (lines 360–380, 485–495) — Why: the existing callers of `restart()`; mirror their route shape and their handling of the returned outcome.
- `apps/studio/canvas-build-sandbox.ts` (lines 240–300, 380–455) — Why: THE child-process pattern — `resolveBunPath()`, `workerEnv()` (incl. the `BUN_BE_BUN` and `NAPI_RS_NATIVE_LIBRARY_PATH` traps), the `Bun.spawn` shape.
- `apps/studio/sync/index.ts` (~1548 and ~1672) — Why: where the sweep fires today (fire-and-forget inside `start()`), and the handle it returns.
- `apps/studio/sync/connection-state.ts` (~355) — Why: every emit is a synchronous `_sync.json` write + WS broadcast; the parent must not amplify the child's line rate.
- `apps/studio/client/panels/SyncPanel.jsx` (lines 85–200) — Why: the panel that gains the control; existing `data-testid="sync-assets"`.
- `apps/studio/http.ts` (~408 `CANVAS_SAFE_API`, ~2641 `/_api/hub/link`) — Why: the privileged-route pattern, and the allowlist this route must stay OUT of.
- `apps/desktop/scripts/check-bundle-completeness.mjs` — Why: the gate proving the new worker survives packaging.

### Files to Create

- `apps/studio/sync/asset-push-worker.ts` — the child entry.
- `apps/studio/test/sync-asset-push-worker.test.ts` — worker contract tests.

### Design canvases

Scanned `.design/**/*.meta.json` — nothing matches; this is a control on an existing panel, not a new surface. The panel's own CSS (`client/styles/4-components.css`, `sp-*`/`gp-*`) is the visual reference.

### Patterns to Follow

```ts
// supervisor.ts — the whole-sync restart, already serialized. The button is this.
restart: (linkedHub) =>
  serialize(async () => {
    try { await runtime?.stop(); } catch (err) { console.error('[sync] stop before restart failed:', err); }
    runtime = null;
    if (linkedHub) adoptLinkedHub(ctx, linkedHub);
    else if (linkedHub === null) delete ctx.cfg.linkedHub;
    return boot();
  }),
```

```ts
// canvas-build-sandbox.ts — the spawn shape, including why the env is empty
child = Bun.spawn([bun, workerScript(env), designRoot, canvasAbs], {
  env: workerEnv(env), cwd: designRoot, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
});
```

---

## Design Decisions

### Resync = `restart()`, with NO argument

`restart(undefined)` keeps the configured hub (only an explicit `null` unlinks — read the branch). It re-links every canvas and re-runs the sweep, which is exactly "resync the whole panel". Rejected: a canvas-only or asset-only resync — two controls for one user intent, and the doc layer has no cheaper honest "re-check" than reconnecting anyway.

### Single-flight comes from the supervisor, not from us

Do not add a lock. `serialize()` already chains calls in order; the route's job is to refuse *early* with `409` when a cycle is in flight so the UI can say so, not to serialize.

### A cooldown, because a restart re-authenticates every canvas

76 canvases = 76 WS auths per press (auth fires once per DOCUMENT). The valid-token bucket is 600/min per label (DDR-102), so roughly eight presses in a minute pin the very bucket that incident was about. The button disables itself while running; add a short cooldown after completion so an impatient user cannot lock themselves out of their own sync.

### The progress channel: NDJSON on stdout

One JSON object per line, each an `AssetPushProgress` the panel already consumes. Rejected: buffering until exit (what the canvas sandbox does — fine for a build, but a minutes-long sweep would show nothing until it ended); a second state file (a consistency problem with `_sync.json` for no gain); a socket (more machinery than a line of JSON deserves).

### Cancel is scoped to the sweep

Killing a reconnect mid-handshake is not a meaningful user action; killing an upload is. So Cancel kills the sweep child only. Safe by construction: uploads are idempotent and the hub writes temp-then-rename, so no partial asset can exist.

### The route is privileged — main origin only

`POST /_api/sync/resync` goes in **neither** `CANVAS_SAFE_API` nor `startCanvasServer`'s `routes` map (CLAUDE.md's two-allowlist rule, DDR-088). Canvas content is untrusted (DDR-054) and must not be able to command the desktop to re-push a project.

---

## Tasks

### Task 1: CREATE `apps/studio/sync/asset-push-worker.ts`

- **Do**: argv = `[designRoot, hubUrl, tokenFile]`. Read the credential from a **file**, never argv (argv is world-readable via `ps`). Run `pushAssets`, writing `JSON.stringify(progress) + '\n'` per emit to stdout; last line is the final `AssetPushResult`. Exit 0 on completion, non-zero on a thrown sweep.
- **Gotcha**: stdout carries NOTHING else — one stray `console.log` from an import breaks the parser. Parse defensively anyway and drop unparseable lines.
- **Validate**: `cd apps/studio && bun test test/sync-asset-push-worker.test.ts`

### Task 2: ADD the spawn wrapper in `apps/studio/sync/index.ts`

- **Do**: `runAssetSweep(): { done: Promise<AssetPushResult|null>; cancel(): void }` — spawn via `resolveBunPath()`/`workerEnv()`, stream stdout lines into `store.updateAssets` (guarded on `stopped`, as today), and translate a non-zero exit or signal into a final emit whose `failures` names the crash. Replace the inline `void pushAssets({…})` at ~1548.
- **Gotcha**: `stop()` must kill the child — a sweep outliving its runtime keeps uploading for a project the user just closed, and `restart()` calls `stop()` on every press.
- **Validate**: `cd apps/studio && bun test test/sync-*.test.ts`

### Task 3: ADD the routes

- **Do**: `POST /_api/sync/resync` → `ctx.syncControl.restart()`, returning the `SyncStartOutcome` the existing callers already handle; `409` when a cycle is in flight. `POST /_api/sync/cancel-assets` → the sweep's `cancel()`. Mirror `/_api/hub/link`'s auth and response shape.
- **Gotcha**: add to NEITHER canvas allowlist, and pin that with a `GET → 405` assertion in `test/canvas-origin-gate.test.ts`.
- **Validate**: `cd apps/studio && bun test test/canvas-origin-gate.test.ts test/http-*.test.ts`

### Task 4: ADD the control to the Sync panel

- **Do**: a **Resync** button in the panel HEADER (it re-syncs everything, so it does not belong inside the assets section). While a cycle runs: disabled, labelled with what is happening. While the sweep runs: a **Cancel** next to the assets line. `data-testid="sync-resync"` / `"sync-assets-cancel"`.
- **Gotcha**: hide the control when no hub is linked rather than rendering a button that 400s.
- **Validate**: `cd apps/studio && bun test test/sync-panel-surface.test.ts`

### Task 5: REBUILD the committed client bundle

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` + `dist/styles.css`.
- **Gotcha**: release-minified, never a bare source boot (CLAUDE.md) — what is committed is what ships.
- **Validate**: `git diff --stat apps/studio/dist/`

### Task 6: ADD a desktop E2E scenario + verify packaging

- **Do**: DOM-driven scenario (per the `desktop-e2e` skill): open the Sync panel → press Resync → canvases re-report → assets move. Then `node apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke`.
- **Gotcha**: the worker is a NEW runtime-spawned surface — the class DDR-177 exists for. Green in `tauri dev` proves nothing about the packaged `.app`.
- **Validate**: `pnpm test:e2e:desktop:build && pnpm test:e2e:desktop`

### Task 7: REVISIT the in-process safety nets (RCA step 3)

- **Do**: with the sweep isolated and ~95 % smaller after the batch probe, decide with evidence whether the per-request `AbortSignal` budgets still earn their place (crash reports went `abort_signal(2)` → `(79)` when they were added). Keep them if in doubt.
- **Validate**: `cd apps/studio && bun test test/sync-asset-push.test.ts`

### Task 8: RECORD the decision

- **Do**: `/flow:record-ddr` — the process boundary, why NDJSON, why cancel is sweep-scoped, and why resync is `restart()` rather than a new lifecycle.
- **Validate**: `maude kg search "resync"` returns it.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server`
3. **Build**: `pnpm --filter @maude/site build`
4. **Packaging**: `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` against a built `.app`
5. **Desktop E2E**: the new resync scenario
6. **Manual, the one that matters**: `pnpm dev:desktop` against alligators — press Resync with the cloud already complete (must settle in seconds), then with assets missing (must upload them), and kill the sweep child mid-flight: the dev server must stay up and the panel must say the sweep failed.

---

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `desktop-sync-resync` | open Sync panel → Resync → canvases re-link, assets move, panel stays honest | 🆕 new |

---

## Acceptance Criteria

- [x] Resync re-links canvases AND re-runs assets, from one button — `POST /_api/sync/resync` → `syncControl.restart()`
- [x] A second press while running is refused, not queued — `SyncSupervisor.busy()` → 409, plus a 10 s cooldown (DDR-102 arithmetic in DDR-222 D6)
- [x] The sweep runs in a child on boot and on demand — `sync/asset-push-worker.ts` + `sync/asset-sweep.ts`
- [x] Killing that child leaves the dev server serving canvases, and the panel reports a failure — `sync-asset-sweep.test.ts` (signal / error / non-zero exit / missing worker all end in a final emit)
- [x] The route is main-origin only — `canvas-origin-gate.test.ts` (canvas origin) + `sync-resync-routes.test.ts` (cross-site + rebind + method)
- [x] Committed bundle rebuilt release-minified — `dist/client.bundle.js` + `dist/styles.css` carry `sync-resync` / `sp-resync`
- [x] Bundle-completeness gate extended and green — new check [6] in `check-bundle-completeness.mjs`
- [x] DDR recorded — [DDR-222](../archive/decisions/DDR-222-resync-is-restart-and-the-asset-sweep-runs-out-of-process.md), ingested into the graph

## Outcome (2026-08-12)

Shipped as planned, with two deviations worth naming:

- **The spawn wrapper is its own module** (`sync/asset-sweep.ts`), not inline in
  `sync/index.ts` as Task 2 wrote it. It needed its own tests — every way a
  child can die is a case — and a 200-line lifecycle inside a 1800-line file
  would have been untestable.
- **Task 7 kept the abort budgets** rather than removing them (DDR-222 D8): the
  `abort_signal(79)` count is what a bounded sweep looks like, and the real
  fault was the keep-alive desync, already fixed.

`safeName` gained a sibling, `safeDetail` — the panel's new note is a sentence,
and at the 60-character name budget the actionable half was exactly what got
cut.

---

## Risks

- **Restart is not free.** It tears down 76 providers and re-authenticates each document; under shared-doc it also drops pinned rooms (DDR-064). Mitigation: the button disables while running, plus the cooldown above. If it proves heavy in practice, a canvas-only "reconcile without reconnect" is the follow-up — deliberately not in v1, because it is a second mechanism for the same intent.
- **Isolation makes the crash survivable, not impossible.** A child that faults every time still never finishes; the difference is the editor stays up and the panel says so. If that happens on a large project, the next step is chunking the sweep, not a third process.
- **Packaging.** A new runtime-spawned script is exactly the DDR-177 failure class; the completeness gate is not optional.
- **Committed-bundle drift.** Task 5 is easy to forget and ships a UI without its own button.

## Confidence

**8.5/10** — higher than the asset-only version, because the resync half turned out to be an existing, already-serialized mechanism rather than new lifecycle code. The unknown is unchanged: whether a child process alone is enough for a large sweep to survive.
