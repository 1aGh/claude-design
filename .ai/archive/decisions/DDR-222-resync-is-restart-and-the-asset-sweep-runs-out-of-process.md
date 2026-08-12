# DDR-222 — Resync is `restart()`, and the asset sweep runs in its own process

- **Date**: 2026-08-12
- **Status**: Accepted
- **Scope**: `repo:maude`, `dept:dev`
- **Area**: desktop→cloud sync — the manual resync control and the asset-push
  process boundary
- **Extends**: [DDR-217](DDR-217-cloud-asset-transport-desktop-push.md) (the sweep
  this moves out of process), [DDR-177](DDR-177-desktop-self-contained-runtime-and-bundle-completeness-gate.md)
  (the worker is a new runtime-spawned surface, and pays that tax)
- **Relates to**: [DDR-102](DDR-102-cold-start-divergence-resolution.md)
  (why the button has a cooldown), [DDR-088](DDR-088-canvas-media-vocabulary-and-asset-write-surface.md)
  + [DDR-054](DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (why the routes
  are in neither canvas allowlist), [DDR-045](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md)
  (how the child script is located)
- **Evidence**: `.ai/logs/rca/issue-asset-sweep-head-becomes-get-and-in-process-crash.md`

## Context

Two complaints, one root: *"nějak se to kouslo na 92/182"*, and no way to retry
anything short of quitting the app — which starts the same doomed sweep again.

The sweep crashes Bun 1.3.3 **when it runs alongside the dev server**. That is
not a hypothesis; it is the result of isolating the variable. The identical
sweep, against the same live hub, on the same project:

| | outcome |
| --- | --- |
| standalone script | 182/182, 0 failures |
| inside the dev server | `Segmentation fault at address 0x0` ×3 + a bus error, then the supervisor gave up after 3 restarts |

A crash there does not cost the sweep. It costs the editor: canvases, the
browser UI, the ACP panel, all of it.

## Decisions

### D1 — Resync is `syncControl.restart()`, not a new lifecycle

The mechanism already existed. `createSyncSupervisor.restart(linkedHub?)` stops
the runtime, drops it and boots a fresh one — and `boot()` re-links **every
canvas** and re-fires the asset sweep. It is what `/_api/cloud/attach` and
`detach` have called since Phase 23. Its calls are serialized on one chain, with
a comment naming the exact hazard a hand-rolled version would hit ("two Connects
pressed in quick succession must not interleave a `stop()` with another cycle's
`start()`").

So the button is one thin privileged route over it. `restart()` is called with
**no argument** — only an explicit `null` unlinks, and this route must never be
able to.

*Rejected:* a canvas-only or an asset-only resync. Two controls for one user
intent ("is my work actually up there?"), and the document layer has no cheaper
honest re-check than reconnecting anyway.

*Rejected:* our own single-flight lock. `serialize()` already orders calls. The
route's job is to refuse EARLY (409) so the UI can say "already restarting",
not to serialize — hence `SyncSupervisor.busy()`, which reports the chain and
never becomes it.

### D2 — The asset sweep runs in a child process

`sync/asset-push-worker.ts` runs today's `pushAssets` unchanged; the parent
(`sync/asset-sweep.ts`) spawns it through the same `resolveBunPath()` /
`workerEnv()` the canvas build sandbox uses, so the DDR-177 traps — the compiled
sidecar re-entered with `BUN_BE_BUN=1`, the `NAPI_RS_NATIVE_LIBRARY_PATH` bunfs
path that must not be forwarded — are shared rather than re-derived.

Nobody has a fix for the fault itself. The boundary is the fix: a dead child is
a **reported failed sweep**, and the editor stays up. It is also what makes D1
safe to offer at all — a button that reliably kills the person's dev server on a
large project is not a button.

*Accepted limitation:* isolation makes the crash survivable, not impossible. A
child that faults every time still never finishes; the difference is that the
person is told. If that happens on a large project the next step is chunking the
sweep, not a third process.

*Rejected:* an in-process fallback when the worker script is missing. It would
reintroduce the crash invisibly, on exactly the installs where staging broke.
A missing worker is a reported failure instead — and `check-bundle-completeness`
gained a check so it cannot reach a release.

### D3 — The progress channel is NDJSON on stdout

One tagged JSON object per line (`progress` / `result` / `error`). The parent
strips the tag and forwards the payload into `store.updateAssets` — the call it
already made — so `_sync.json`, the WS fanout and the panel payload are byte-for-
byte what they were.

*Rejected:* buffering until exit (what the canvas sandbox does — right for a
build, but a minutes-long sweep would show nothing until it ended); a second
state file (a consistency problem with `_sync.json` for no gain); a socket (more
machinery than a line of JSON deserves).

The tag is what makes a truncated stream readable: a parent that dies mid-line
can still tell a final answer from a progress tick. Positional ("the last line
is the result") could not.

### D4 — The credential goes in a 0600 file, never in argv

`ps` is world-readable on every platform this ships to. The child re-reads the
file per call rather than caching it, so a silent renewal that rewrites it is
picked up mid-sweep; the parent unlinks it (with its private temp dir) when the
sweep ends.

### D5 — Cancel is scoped to the sweep

Killing a reconnect mid-handshake is not a meaningful gesture; killing a
multi-hundred-megabyte upload is. Safe by construction: uploads are idempotent
and the hub writes temp-then-rename, so no partial asset can exist. `stop()`
kills the child too — and since `restart()` calls `stop()` on every press,
without that each press would leave another sweep running.

### D6 — A cooldown, because a restart re-authenticates every document

Auth fires once per DOCUMENT: 76 canvases is 76 WS auths per press. The valid-
token bucket is 600/min per label (DDR-102), so roughly eight presses inside a
minute pin the very bucket the incident behind this work was about. The control
disables while the cycle runs and for 10 s after — six presses a minute, well
under. The hub's own 429 remains the real backstop; this is politeness, not
security.

### D7 — Both routes are main-origin only

`POST /_api/sync/resync` and `POST /_api/sync/cancel-assets` are in **neither**
`CANVAS_SAFE_API` nor `startCanvasServer`'s `routes` map (DDR-088's two-allowlist
rule), and both carry `sameOriginWrite` + `isTrustedRequestHost`. Reachable from
the untrusted canvas origin (DDR-054), resync would be an amplification
primitive driven by content the person merely opened: one request
re-authenticates every document against their own hub and re-runs a whole-project
upload. Allowlist omission alone proves the wrong property — the main origin is
reachable from any website open while the server runs — so both halves are
asserted, in `canvas-origin-gate.test.ts` and `sync-resync-routes.test.ts`.

### D8 — The per-request abort budgets stay (RCA step 3)

They were suspects: crash reports went `abort_signal(2)` → `abort_signal(79)` in
the change that introduced them. But 79 in-flight budgets across a 182-file
sweep is one per request — that is what a bounded sweep looks like, not a leak —
and the actual fault was isolated elsewhere and fixed (the HTTP/1.1 keep-alive
desync after a peer refuses a PUT before draining its body). Removing them would
trade a suspicion for a certainty: a request with no budget is how a sweep hangs
forever with nothing to report.

## Consequences

- The Sync panel gains one control that means "re-check everything", and the
  asset lane gains a Cancel while a sweep runs.
- A sweep can now END in a way the panel reports: crashed, cancelled, or
  finished. An asset lane frozen at "92 of 182" forever is no longer reachable.
- `sync/asset-push-worker.ts` joins the set of files whose absence from a
  packaged `.app` is silent at boot and fatal in use. Check [6] of
  `check-bundle-completeness.mjs` is what keeps that from shipping.
