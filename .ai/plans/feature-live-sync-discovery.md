# Feature: Live sync discovery — a canvas created anywhere syncs everywhere, without a restart

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The sync runtime enumerates a project **exactly once, at `start()`** — on both ends. A canvas that
comes into existence after that moment never gets a provider, so it never syncs, never gets a
cursor, and (in one direction) never even becomes a hub document. This makes the fix symmetric:
**discovery must become continuous, not a boot-time snapshot**, and the same code runs in the
desktop app and inside the cell, so one mechanism fixes both directions.

## User Story

As someone working on the same project from the Maude desktop app and from
`https://<project>.cloud.maude.sh`, I want a canvas I create on either side to appear, sync, and be
live-collaborative on the other side within a second — with cursors, selection, comments,
annotations, artboards and assets — so that the cloud and my disk are one project rather than two
snapshots that occasionally agree.

## Problem

Reported (2026-08-13, Brno Alligators project):

1. A canvas created in the cloud (`.design/ui/test.tsx`) **never** reaches the desktop.
2. A canvas created on the desktop (`.design/ui/Test2.tsx`) **does** reach the cloud as a file — but
   inside it there is **no live collaboration at all**: no cursors, no incoming edits, nothing until
   a full page reload in the cloud.
3. Pressing **Resync** produced the content-free note `Resync could not start.`

The user's requirement is unambiguous: sync must be complete and immediate in both directions for
canvases, artboards, assets, annotations, comments, cursors and selection.

### Root cause — one mechanism, four symptoms

`apps/studio/sync/index.ts` `start()` builds its canvas set **once**:

- `scanCanvases(ctx)` → what is on local disk right now (line ~560);
- `fetchRemoteDocs()` + `diffRemoteDocs()` + `pullTargets()` → what the hub holds right now
  (lines ~578–646);
- then a `for (const canvas of canvases)` loop opens one provider per canvas (lines ~1357–1503).

After that loop, **nothing adds a canvas to the runtime.** `fs:any` is dispatched only to *existing*
agents/projections (`onRead`, lines ~775–786: "Dispatch to whichever disk handler owns this path").
The asset sweep (`runAssetSweep`, line ~1563) is likewise a single boot-time pass. The only way to
pick anything up is a full `stop()` + `start()` cycle — `SyncSupervisor.restart()`, i.e. the Resync
button or an app relaunch.

The server *already* notices new canvas files: `apps/studio/canvas-list-watch.ts` diffs the on-disk
canvas set on every `fs:any` and emits `canvas-list-update`. **The sync runtime does not subscribe
to it.** That is the missing wire.

| # | Symptom | Chain |
|---|---------|-------|
| A | cloud-created canvas never reaches desktop | cell's studio writes the file → the **cell's paired sync runtime** (`sync/cell-pairing.ts`, loopback provider) has no provider for it → no Hocuspocus document is ever created → `GET /api/documents` (which reads the hub's SQLite `documents` table — only docs someone connected to) never lists it → the desktop cannot discover it even on Resync |
| B | desktop-created canvas has no live collab in the cloud | desktop restarts → provider opens → hub doc created → the hub's own `workspace-agent.mjs` writes `.design/ui/Test2.tsx` into the cell checkout → the cell's `canvasListWatch` shows it in the tree → **but the cell's sync runtime still has no provider**, so the browser's collab room is never bridged to the hub doc. Content only ever refreshes from disk, which is why a reload "fixes" it and nothing else does |
| C | assets / annotations added later | `runAssetSweep` is one-shot at start; there is no incremental push and no pull lane at all (assets are served from local disk) |
| D | `Resync could not start.` | `SyncPanel.jsx:130` falls back to that string whenever the response is non-OK **and carries no JSON `detail`** — i.e. every plain-text refusal (`403 cross-origin write rejected`, `403 local request required`) renders as a sentence with no cause. The refusal is real; the message is empty |

Direction asymmetry is fully explained: the desktop restarts often (app launch, Resync), the cell
container does not — so desktop→cloud eventually works and cloud→desktop never does.

## Solution

Make discovery continuous on both ends, reusing the machinery that already exists:

1. **Extract a per-canvas attach seam** from `start()`'s loop body (`attachOne(descriptor)`) plus a
   matching per-slug detach, and expose `adopt()` / `release()` on `SyncRuntime`.
2. **Local discovery** — subscribe the runtime to the `canvas-list-update` bus event
   (`canvas-list-watch.ts`) and attach/release incrementally. This alone fixes symptom **B**
   completely and half of **A** (the cell finally publishes cloud-created canvases to the hub).
3. **Remote discovery** — a capability ladder so the desktop learns about new hub documents without
   a restart: a hub-authored **roster document** (instant, over the socket that is already open),
   degrading to a **periodic `GET /api/documents` poll** against hubs that don't publish one. New
   documents are materialised through the existing `pullTargets` / `admitPullTarget` /
   `relocatePulled` path — no second answer to "where does this canvas go".
4. **Incremental asset lane** — push on `fs:any` under the asset paths, and pull assets referenced by
   an arriving document, so a cloud-added image is on disk instead of a broken link.
5. **Honest refusals** — every `/_api/sync/*` refusal returns JSON with a `detail`; the panel can
   never again print a sentence with no cause.

**Non-goal:** replacing the two-doc model with shared-doc on the desktop (`MAUDE_SHARED_DOC` is off
there; the cell sets it to `1`). Cursors already bridge in both modes via
`registry.attachHubAwareness` — they were missing because there was no provider, not because
awareness is broken. Do not widen this plan into DDR-064's cutover.

## Metadata

- **Type**: Bug Fix (architectural — a missing mechanism, not a wrong line)
- **Complexity**: High
- **App/Package**: `apps/studio` (primary), `apps/hub` (roster route), `apps/desktop` (E2E only)
- **Affected Systems**: sync runtime, sync supervisor, canvas-list watcher, cell pairing, hub
  document listing, asset sweep, Sync panel
- **Dependencies**: none new. Zero-dep constraint holds (`apps/hub` installs frozen — see CLAUDE.md)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `apps/studio/sync/index.ts` (lines 528–760, 1330–1600) — Why: `start()`'s enumeration, the attach
  loop to extract, and `stop()`'s bulk teardown that per-slug release must not break.
- `apps/studio/sync/remote-docs.ts` (whole file, 299 lines) — Why: the hub listing, the diff, and
  `pullTargets` / `resolvePulledTarget` — the containment rules a mid-session pull must reuse
  verbatim, not re-derive.
- `apps/studio/canvas-list-watch.ts` (whole file) — Why: the existing disk-side discovery this plan
  wires into sync. Note its **security tripwire comment** (lines 117–124): `rel`/`slug` on that
  event are attacker-controlled; a new consumer must re-validate.
- `apps/studio/sync/supervisor.ts` (whole file) — Why: `serialize()` is the ordering guarantee an
  incremental attach must live inside; do not add a second lock.
- `apps/studio/sync/cell-pairing.ts` (whole file) — Why: the cell runs the same runtime through a
  loopback provider; every fix lands there for free, and this file states which invariants
  (no dial-out, no second committer, shared-doc on) must survive.
- `apps/studio/sync/asset-sweep.ts` + `apps/studio/sync/asset-push.ts` (headers) — Why: the
  out-of-process sweep protocol an incremental push must not fork.
- `apps/studio/client/panels/SyncPanel.jsx` (lines 95–150) — Why: symptom D lives at line 130.
- `apps/hub/src/documents.mjs` (whole file) — Why: the scope gate a roster doc must satisfy; its
  header states the deliberate "names only, reconciling is the caller's decision" posture.
- `apps/hub/src/server.mjs` (lines 909–1000, 1955–2060) — Why: `onConnect`/`onLoadDocument` hooks and
  the read-only SQLite listing — where a hub-authored roster would be maintained.
- `apps/hub/src/workspace-files.mjs` + `workspace-agent.mjs` — Why: the hub's own doc→file lane. It
  is why a desktop-created canvas *appears* in the cloud while being dead — do not duplicate it.

### Files to Create

- `apps/studio/sync/discovery.ts` — pure diff/decision layer for "what changed in the canvas set"
  (local + remote), no fs, no network, following `remote-docs.ts`'s pure-module house style.
- `apps/studio/sync/roster.ts` — client half of the roster ladder (read roster doc → names; fall back
  to a polled listing), pure except for the injected fetch/provider.
- `apps/hub/src/roster.mjs` — hub-authored roster document (names only, scope-filtered, same gate as
  `documents.mjs`).
- `apps/studio/test/sync-discovery.test.ts`, `sync-attach-incremental.test.ts`,
  `sync-roster.test.ts`, `apps/hub/test/roster.test.mjs`.

### Documentation

- `maude kg search "hub-only documents pulled down"` → decision *"Cloud sync is complete and
  bidirectional — hub-only documents are pulled down, not just reported"* — Why: it establishes that
  materialising a hub-named document as a local file is **already** an accepted trade, so a
  mid-session pull needs no new authorisation argument, only the same containment guard.
- `maude kg search "cloud sync mirrors the local file set"` → the 2026-08-07 RCA — Why: prior
  investigation of exactly this class; read before re-deriving.
- DDR-054 (hub content is untrusted), DDR-064 (shared-doc), DDR-192 §5 (`ws/<workspace>/<branch>/<slug>`
  document naming), DDR-209 (a cell does not dial out) — the four constraints every task must respect.

### Patterns to Follow

`canvas-list-watch.ts` is the house pattern for "watch a set, diff it, emit the delta": a serialized
`chain`, a debounce, `null` as the not-yet-seeded sentinel, no emit on seed. The remote roster watch
should be the same shape so the two are reviewable side by side.

`remote-docs.ts` is the house pattern for a **pure** decision module with injected `join`/`resolve`/
`realpath` — keep `discovery.ts` and `roster.ts` equally free of fs and network so they are
exhaustively testable.

---

## Execution progress (2026-08-13)

| Task | State | Note |
|---|---|---|
| 1 — attach seam | ✅ done | pure extraction, zero test edits (81 pass) |
| 2 — per-slug release | ✅ done | `awarenessDetaches`/`statusDetaches` keyed by slug; `ConnectionMonitor.forgetDoc` added |
| 3 — `adopt()`/`release()` | ✅ done | plus `rescanNow()` / `pullRemoteNow()` seams; `busy()` unaffected |
| 4 — local discovery | ✅ done | `canvas-list-update` → full rescan → adopt/release. **Closes symptom B, and the cell half of A** |
| 5 — hub roster doc | ⬜ deferred | the poll (T6) already closes the symptom on every hub version; roster is the latency upgrade |
| 6 — remote discovery | ✅ done (poll lane) | 20 s `GET /api/documents` poll + `pullRemoteNow()`. **Closes the desktop half of symptom A** |
| 7 — mid-session pull | ✅ done | reuses `pullTargets`/`admitPullTarget`/`relocatePulled`; `strictPullSlugs` keeps the fresh-link relaxation boot-only |
| 8 — asset lane | ✅ done | PUSH half from a concurrent session (`scheduleAssetSweep` on `fs:any`); the RESTORE half is `hydrateAssets()` — see below |
| 9 — honest refusals | 🔶 superseded in part | `syncRefusal()` closes the DESKTOP gates. The reported symptom was the hub refusing the route in a cell **on purpose** — real fix: hide the control (Task 10) |
| 10 — panel surface | ✅ done | Resync is desktop-only; the cloud shell omits it (`cloud` prop from `/_config`) |
| 11 — E2E both directions | ✅ done (in-process) | `sync-two-peer-discovery.test.ts` — two REAL runtimes on one shared hub: create → discover → content arrives → cursors bridge → later edits keep flowing, both directions + concurrent creation. **The live cloud↔desktop pass has NOT run** — the fleet only rolls on a release tag |
| 12 — DDR | ✅ done | recorded in kgai (this repo is kgai-active): `maude/continuous-sync-discovery`, `maude/resync-is-desktop-only`, `maude/cell-asset-hydration`, `maude/gitignore-drift-detection`. What's New entry belongs to `/flow:done` |

Extra, not in the original task list:

- **The empty-project hole.** `start()` returns early when nothing is syncable, before the discovery
  block exists — so linking a fresh project and then making the first canvas was the same bug in its
  emptiest corner. The zero-canvas branch now watches for a first canvas and emits
  `sync:needs-restart`; `server.ts` cycles the supervisor once.
- **The ephemeral cell checkout** (from `.ai/logs/rca/issue-cloud-assets-open-findings.md` §2).
  `createAssetSweeper` mirrored checkout → bucket only, and a cell's checkout does not survive a
  migration — 53–58 of ~95 assets 404 in the checkout and 200 in the bucket after a rollout, three
  times in one afternoon, repaired only by a ~388 MB re-upload from a laptop. `hydrateAssets()`
  (`apps/hub/src/asset-lane.mjs`) adds the reverse direction at cell boot, before the sweep. Never
  overwrites; reported in `/health` as `assetsRestored`.
- **Gitignore drift** (§4's mechanical half). `cli/lib/gitignore-drift.mjs` + `maude doctor`: a rule
  OUTSIDE the `# maude:begin`/`# maude:end` markers is invisible to the block writer, so a stale
  `.design/*.annotations.svg` kept every draw layer out of git forever. Detection only; removal is a
  prompted `--fix`.

Still open from that RCA: §3 (a file 200 at the hub door and 404 at the studio door — needs a
request-level observation from a signed-in cloud session) and the live half of §4 (a local
annotation sidecar with content whose hub doc lane reads empty).

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: REFACTOR `start()`'s attach loop into a reusable per-canvas seam

- **Do**: In `apps/studio/sync/index.ts`, extract the body of `for (const canvas of canvases)`
  (lines ~1357–1503) into `async function attachOne(canvas: CanvasDescriptor): Promise<void>` inside
  the `start()` closure. The loop becomes `for (const c of canvases) await attachOne(c)`. Do not move
  it out of the closure — it legitimately needs `echoGuard`, `journal`, `store`, `mon`, `history`,
  `autoCommit`, `agents`, `projections`, `pinnedSlugs`, `connectCanvas`.
- **Pattern**: keep every existing branch intact (`useSharedDoc` vs agent, the comment/annotation
  relay, the queued-edit counter). This task changes **no behaviour** — it is a pure extraction.
- **Gotcha**: `bootWaits` must NOT collect waits from later incremental attaches — the boot summary
  at line ~1523 would then never settle. Take a `{ boot: boolean }` argument and push to `bootWaits`
  only when `boot`.
- **Validate**: `cd apps/studio && bun test test/sync-runtime.test.ts test/sync-cold-start.test.ts`
  — all green with zero test edits. If a test needed editing, the extraction was not pure.

### Task 2: ADD per-slug release (the teardown half)

- **Do**: `stop()` currently drains bulk arrays (`awarenessDetaches`, `statusDetaches`, `agents`,
  `projections`, `pinnedSlugs`). Introduce a per-slug `attached = new Map<string, AttachedCanvas>()`
  holding that canvas's provider, agent/projection, awareness detach and status detaches; make
  `stop()` iterate it, and add `releaseOne(slug)` that tears down exactly one entry (provider
  destroy → agent/projection stop → awareness detach → unpin → `mon.forgetDoc(slug)`).
- **Gotcha**: the shared WebSocket must survive a single release — only `stop()` destroys it
  (line ~1687: "destroy the shared WebSocket(s) AFTER the providers detached"). Releasing the last
  canvas must not kill the socket the next attach will use.
- **Gotcha**: unpinning a shared-doc room (`registry.unpin`) hands the room back to the
  last-browser-leaves drop — correct on a real delete, wrong on a rename. Rename arrives as
  remove+add; debounce release by one `CANVAS_LIST_DEBOUNCE_MS` window and cancel it if the same slug
  re-appears.
- **Validate**: new `test/sync-attach-incremental.test.ts` — attach 3, release 1, assert the other 2
  still sync and `status().docs.synced` is 2; attach again and assert 3.

### Task 3: ADD `adopt()` / `release()` to the `SyncRuntime` interface

- **Do**: expose `adopt(descriptors: CanvasDescriptor[]): Promise<number>` and
  `release(slugs: string[]): Promise<number>` on `SyncRuntime` (interface at line ~198), delegating to
  Task 1/2. Both are no-ops when `stopped`. Serialize them on the runtime's own chain so an adopt
  cannot interleave with a `stop()`.
- **Gotcha**: `SyncSupervisor.busy()` must stay false during an adopt — it means "a full cycle is in
  flight" and gates the Resync button. An incremental adopt is not a cycle.
- **Validate**: `bun test test/sync-supervisor.test.ts` + a new case asserting `busy()` stays false
  across an `adopt()`.

### Task 4: WIRE local discovery — `canvas-list-update` → `adopt` / `release`

- **Do**: in `start()`, subscribe to `ctx.bus.on('canvas-list-update', …)`. On `added`, re-run the
  admission path for that one path (`scanCanvases`-equivalent gates: syncable, sandbox, `admitCanvases`
  dedupe against the already-attached set) and `attachOne` it. On `removed`, `releaseOne`.
- **Gotcha — SECURITY**: `canvas-list-watch.ts:117–124` marks `rel`/`slug` on that event as
  attacker-controlled (agent-authored / `git checkout`-authored filenames). **Do not** build a
  descriptor from the payload. Use it only as a *nudge*, then recompute the descriptor from
  `scanCanvases`/`findHtmlFiles` exactly as boot does. This is the tripwire that comment was left for.
- **Gotcha**: a create writes `.tsx` then `.meta.json`; attaching between the two would sync a canvas
  whose `.meta.json` says `syncable: false` a moment later. The watcher's 150 ms debounce covers the
  common case — additionally re-check `syncable` at attach time and release if it turns false.
- **Gotcha**: under cell pairing this must still respect DDR-209 — it changes *which* canvases the
  loopback provider covers, never *where* it dials.
- **Validate**: new test — write a `.tsx` + `.meta.json` into a canvas group under a running runtime,
  assert a provider exists for its slug within one debounce window and that the doc reaches the fake
  hub. Then delete it and assert release.

### Task 5: ADD the hub roster document (`apps/hub/src/roster.mjs`)

- **Do**: the hub already knows every document that exists (the SQLite `documents` table backing
  `GET /api/documents`, `server.mjs:1955+`). Publish that set as a **hub-authored, read-only Yjs
  document** named `ws/<workspace>/<branch>/_roster` (`_roster` passes `slugFromDocName`'s
  `[A-Za-z0-9_-]` component charset — verify, and if the leading `_` is refused anywhere, pick a name
  that is not). Maintain it from `onLoadDocument` / document-create, filtered per connection by the
  **same `matchesScope` gate** `documents.mjs` applies.
- **Gotcha**: a peer must never be able to write the roster — a peer-writable roster is a primitive
  for making another peer create files. Refuse peer updates to it in `onAuthenticate`/`beforeHandle`
  (read-only grant), and treat the roster as **names only**, exactly as `documents.mjs` argues.
- **Gotcha**: `apps/hub/Dockerfile` installs frozen (CLAUDE.md) — implement with what is already in
  `bun.lock`. No new dependency.
- **Validate**: `apps/hub/test/roster.test.mjs` — a token scoped to workspace A never sees a
  workspace-B name in the roster; a peer's write to the roster doc is refused.

### Task 6: ADD remote discovery on the peer — roster first, poll as the fallback

- **Do**: `apps/studio/sync/roster.ts` + a watch in `start()`. Open the roster document through the
  same provider factory; on change, diff its names against the attached set and hand the additions to
  the pull path (Task 7). If the roster document does not materialise within a short window (an older
  or third-party hub), fall back to polling `fetchRemoteDocs()` on an interval
  (`REMOTE_POLL_MS = 20_000`, jittered), plus one immediate poll on every reconnect transition from
  `connectionMonitor`.
- **Gotcha**: `fetchRemoteDocs` returns `null` on ANY failure and that must stay non-fatal — its
  header states a peer that cannot get the listing must still sync. The poll inherits that posture.
- **Gotcha**: poll cost is per-peer and per-project. Back off to a slow interval while the window is
  hidden / the app is idle; never poll when `stopped`.
- **Validate**: `test/sync-roster.test.ts` — (a) roster present → a name added to the roster attaches
  without any HTTP call; (b) roster absent → the poll discovers it; (c) hub returns 404/500 → sync
  continues, no throw.

### Task 7: PULL a newly discovered hub document mid-session

- **Do**: route additions from Task 6 through the **existing** boot path: `pullTargets` →
  `admitPullTarget` → `descriptorFor` → `attachOne` → `relocatePulled` once the doc syncs. Extract
  whatever of lines ~639–691 is needed into a function both boot and the incremental path call.
- **Gotcha**: the `freshLink` / `allowUndeclaredGroup` relaxation is **boot-only and one-shot**
  (lines ~606–626 — the comment explains why it closes after the first group). A mid-session pull
  must always run with `allowUndeclaredGroup: false`. Getting this wrong hands a hub an unbounded
  directory-creation primitive.
- **Gotcha**: `writeUntrustedMarkers` must be re-run after each incremental pull (DDR-054 §3 F3) —
  the boot path already learned this lesson (lines ~704–714); an incremental pull that skips it points
  the control at a phantom again.
- **Gotcha**: "hub-only" means "no local descriptor", not "no local file" (lines ~666–686). The
  `admitPullTarget` refusal must apply to the incremental path unchanged — including the
  case-insensitive-filesystem collision it names.
- **Validate**: a fake hub announces a new document mid-session → assert the file lands inside a
  declared canvas group, `_untrusted/INDEX.json` names its real path, and a document whose path
  targets an existing local file is refused (not overwritten).

### Task 8: ADD the incremental asset lane

- **Do**: (push) subscribe to `fs:any` for paths under the asset directories and enqueue a single-file
  push through the existing out-of-process worker protocol (`asset-sweep.ts` / `asset-push-worker.ts`)
  — coalesced, not one child per file. (pull) when a pulled document references assets this machine
  does not have, fetch them from the hub's asset lane into `<designRoot>/assets/` content-addressed.
- **Gotcha**: content-addressed names + the magic-byte sniff + per-category caps in
  `saveAssetFromStream` are the load-bearing trust mitigation for anything arriving from the hub
  (DDR-088/DDR-148). A pull lane MUST go through the same validation as a canvas upload — never a
  raw write of hub-supplied bytes.
- **Gotcha**: the credential handover is a 0600 file, not argv (`asset-sweep.ts` header) — reuse it.
- **Validate**: add an image on side A → assert it exists on side B and that a hub-supplied
  `evil.svg`/mislabelled binary is refused by the same sniff.

### Task 9: FIX the empty Resync refusal (symptom D)

- **Do**: make every refusal branch of `/_api/sync/resync` and `/_api/sync/cancel-assets`
  (`http.ts:2477+`) return `Response.json({ ok: false, reason, detail })` instead of a plain-text
  `403`, and log the refused reason server-side with the request host/origin. Keep the gates
  themselves exactly as they are — this changes the *message*, never the *policy*.
- **Then**: with the real reason visible, confirm which gate fired for the user
  (`sameOriginWrite` vs `isTrustedRequestHost`; note `isTrustedRequestHost` allows workspace mode via
  the `x-maude-role` header, so the cloud path is expected to pass) and fix that separately if it is a
  genuine misgate. Do not guess at it before the message exists.
- **Validate**: `test/sync-resync-routes.test.ts` — every refusal path asserts a JSON body with a
  non-empty `detail`; `SyncPanel.jsx`'s fallback string becomes unreachable in practice.

### Task 10: SURFACE discovery in the Sync panel

- **Do**: the panel's header already reports counts. Add "watching for new canvases" / the last
  discovery time, and render an incremental attach as a row appearing rather than requiring a manual
  Resync. Keep `syncPresentation` (`sync/presentation.ts`) the single place that decides wording.
- **Validate**: `bun test test/sync-presentation.test.ts test/sync-panel-surface.test.ts`.
- **Gotcha**: after editing client surfaces, rebuild the committed bundle release-minified
  (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and commit
  `dist/client.bundle.js` + `dist/styles.css` — CLAUDE.md's rule, and `git status apps/studio/dist/`
  before AND after any `bun test` run in that tree.

### Task 11: PROVE it end to end, both directions

- **Do**: an integration test with a real hub instance (the pattern in
  `test/shared-doc-cell-pairing.test.ts`) covering: peer A creates a canvas → peer B attaches it with
  no restart, in both directions, with awareness (cursor) traffic asserted on the new canvas. Then a
  manual verification against the live Alligators project reproducing the exact reported flow.
- **Validate**: `pnpm test:dev-server`, then the manual cloud↔desktop pass on `test.tsx` / `Test2.tsx`.

### Task 12: RECORD the decision

- **Do**: `/flow:record-ddr` — "Document discovery is continuous, not a boot snapshot": the roster
  ladder, why the peer never writes the roster, why the fresh-link relaxation stays boot-only, and why
  the fix is symmetric (the cell runs the same runtime). Ingest into kgai
  (`repo:maude` / `dept:dev`), and add a What's New entry via the `whats-new-entry` skill at
  `/flow:done` — this is a headline user-visible fix.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format`
3. **Tests**: `pnpm test && pnpm test:dev-server`
4. **Build**: `pnpm --filter @maude/site build`
5. **Bundle discipline**: `git status apps/studio/dist/` clean-or-intentional; runtime bundles
   untouched (`bash scripts/check-runtime-bundles.sh`)
6. **Security**: `/flow:validate-security` — this change lets a hub create files on a peer's disk
   *at any time* rather than only at connect. That is the same authorisation the boot path already
   has, but the review must confirm the containment guards (`resolvePulledTarget`,
   `admitPullTarget`, `allowUndeclaredGroup: false`, `writeUntrustedMarkers`) all hold on the
   incremental path.
7. **Desktop E2E**: the `desktop-e2e` skill — create a canvas in the app while linked, assert it
   appears without a restart.
8. **Manual**: the reported flow on the live Alligators project, both directions, plus cursors,
   selection, comments, annotations and one asset.

---

## Acceptance Criteria

- [ ] A canvas created in the cloud appears and syncs on the desktop with **no restart and no Resync**
- [ ] A canvas created on the desktop is **live-collaborative** in the cloud (cursors + incoming
      edits) with no reload
- [ ] Deleting a canvas releases its provider on the other side
- [ ] An asset added on either side reaches the other, through the same validation as an upload
- [ ] Every `/_api/sync/*` refusal carries a `detail` — `Resync could not start.` is unreachable
- [ ] Task 1 landed with zero test edits (proving the extraction was pure)
- [ ] `/flow:validate` passes, `/flow:validate-security` returns 0 blockers at the configured floor
- [ ] DDR recorded + ingested; What's New entry written pending
