# Feature: Sync v2 — journal file plane (7 lanes → 2, one reconciler, doručenka)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Provenance.** This plan is the output of an 11-agent workflow (2026-08-16): 4 readers
> (desktop sync, hub+cell, DDR corpus, prior art) → 3 blind architects (clean-slate
> "Ledger", evolutionary "Doručenka", git-as-transport "Bill of Lading") → 3 adversarial
> breakers → 1 synthesis. **All three architects independently converged on the same
> skeleton** — hub-ordered append-only journal, payload-free poke over the already-open
> Hocuspocus stateless channel, per-peer cursor + per-file ancestor store, ONE pure
> three-way decision table, classifier as sole membership oracle, checkout as the cell's
> only serving truth, R2 demoted to write-behind durability, CRDT doc lanes untouched.
> That convergence matches the prior-art endgame (Dropbox journal+cursor, CouchDB
> _changes+checkpoint, Syncthing index+sequence). Winner: **Doručenka (evolutionary)**
> as backbone with 16 binding grafts/amendments from the other two + breaker findings.
> Full material: [`notes/sync-redesign-dossier/`](notes/sync-redesign-dossier/) —
> synthesis, all three candidates with breaker verdicts, and the four maps.
> Ground truth of the pre-redesign state: [`notes/sync-architecture-ground-truth.md`](notes/sync-architecture-ground-truth.md).

## Description

Replace today's seven independent sync mechanisms (CRDT doc lanes, asset push sweep,
fast-lane push, asset pull, flag-gated file plane, cell bucket mirror, git
autocommit/rehydrate) with exactly **two peer-facing lanes**:

- **Plane A (unchanged wire):** CRDT doc lanes for what is genuinely collaborative —
  body `.tsx`, sibling css, meta shared subset, comments, annotations, syncMeta.
- **Plane B (new backbone):** ONE journal-driven file lane for everything else
  VERSIONED per DDR-115. Hub keeps an append-only `file_journal` (hub.db) + epoch +
  per-peer cursors; every accepted write appends a row and broadcasts a payload-free
  **poke** over the existing Hocuspocus stateless channel; desktop keeps a per-hub
  **file ledger** (ancestor store + stat cache) and resolves every file through ONE
  pure three-way `decideFile` table; conflicts are rename-aside, never merged, never
  silently overwritten.

Cell storage collapses to **one store of serving truth** (the checkout); R2 becomes
write-behind durability only (CAS blobs + backup generations + **journal tail
NDJSON** replayed at rehydrate so the epoch survives container restores). The user
gets a **doručenka** — per-file delivery state (`local-only → pushing → on-hub →
durable → at-peer → ui-healed → everywhere`) in `_sync.json` + Sync panel, so "where
is it stuck" is answerable without log archaeology.

Net effect: ~2,200–2,900 lines deleted vs ~1,400 added; three reconcilers → one
primitive; every trap from the ground-truth trap list gets a structural property
instead of vigilance.

## User Story

As a Maude user with a linked cloud project I want the whole `.design/` folder
mirrored both ways like iCloud/Dropbox — reliably, within seconds, with a visible
per-file delivery receipt — so that "it's in the cloud" always means "it's on my
disk" (and vice versa) without me ever debugging sync.

## Problem

Ground truth §5 (verified 2026-08-16): seven lanes, three reconcilers, no single
source of truth about delivery; two cold-start implementations (eraser bug fixed
twice); push is scheduler-driven (20 s polls + debounce heuristics) though a live WS
already exists; two stores on the cell drift (most of the v0.60.4–v0.60.7 bug week);
visibility ≠ delivery (container `fs.watch` misses hub-process atomic writes, so
delivered bytes stay invisible until manual reload); file plane vs asset lanes have
duplicate jurisdiction; the DDR-115 taxonomy lives in 4–5 copies.

## Solution

The synthesized architecture in
[`notes/sync-redesign-dossier/synthesis-final-architecture.md`](notes/sync-redesign-dossier/synthesis-final-architecture.md)
(§§0–10: plane boundary, journal schema, ledger, `decideFile` table, protocol, event
flow, doručenka, deletion + breakers, security delta, compat matrix). Shipped as 9
strangler increments (Tasks below) — sync keeps working at every step; nothing is
deleted until its replacement has soaked one release.

Key invariants preserved (ground truth §7 — verified point-by-point by the breakers):
fail-closed cold-start (unstamped emptiness never beats content — generalized: the
journal row IS the edit stamp); DDR-054 untrusted hub (receiver re-validates paths,
re-hashes bytes, re-classifies; hub data are hints); DDR-115 taxonomy (classifier is
the sole membership oracle); owner gate on code-module (now at door AND receiver);
idempotence (same-hash append is a no-op; CAS on push); loud failures (refused-set
outranks cursor in the doručenka).

## Product mode model (BINDING — user decision 2026-08-16)

Exactly **two ownership modes**, nothing in between. This kills the old
"repo-to-repo P2P multiplayer, synced on git push" variant (superseded — record in
Task 0 DDR) and the current hybrid "linked AND committed" posture:

| | **Mode A — repo-owned** | **Mode B — hub-owned (multiplayer)** |
|---|---|---|
| Source of truth | the user's git repo | the hub (server-owned git history DDR-198 + R2 durability) |
| `.design/` in user's repo | committed (VERSIONED taxonomy) | **gitignored** (`git rm -r --cached` at adopt) |
| Local disk | the working copy itself | full working mirror (offline edits fine; journal plane converges) |
| Collaboration | plain git — commit/push/pull, no Maude involvement | live multiplayer via hub (doc lanes + journal file plane) |
| Hub link | none | required |
| History/forensics | user's git | hub git + journal + R2 tail + `_trash/` quarantine |
| Repo handoff | n/a (already in repo) | explicit export only (`design-sync.mjs` PR / registry-item) — NOT a sync lane |

Transitions are explicit one-shot operations, never a continuous sync: **adopt**
(A→B: fresh-link push of `.design/` to the hub + `.gitignore` append + untrack, with
confirmation, terminal-free per DDR-177) and **detach** (B→A: unlink + remove ignore
+ "commit it yourself" — the mirror is already a full copy). A hub link without the
gitignore does not exist as a state. Consequences absorbed into tasks: Task 6
(Increment 4.5) implements adopt/detach + migration of existing linked projects;
`design-sync.mjs` is reclassified as export/handoff; Syncthing-managed folders get an
`.stignore` recommendation at adopt (Syncthing ignores `.gitignore` — without it a
Mode-B project would ride two lanes).

## Metadata

- **Type**: Refactor (architecture consolidation)
- **Complexity**: High — multi-release arc, 9 increments
- **App/Package**: `apps/studio` (sync/), `apps/hub`, `apps/cells` (indirect — image rolls with hub), studio client (Sync panel)
- **Affected Systems**: file sync (all 7 lanes), hub journal + R2 durability, cell rehydrate/backup, HMR heal path, Sync panel UI, security gates F1–F6, release/compat matrix
- **Dependencies**: no new npm deps (journal = hub.db table; poke = existing Hocuspocus `broadcastStateless`; ledger = JSON under `_state/`)

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message** (multiple Read tool calls) — they're independent context loads.

- `.ai/plans/notes/sync-architecture-ground-truth.md` — Why: the verified pre-redesign state, trap list, invariants §7
- `.ai/plans/notes/sync-redesign-dossier/synthesis-final-architecture.md` — Why: THE spec (schema, decision table, protocol, doručenka states, compat matrix)
- `.ai/plans/notes/sync-redesign-dossier/synthesis-phasing.md` — Why: per-increment ship/verify/rollback detail beyond the task list below
- `.ai/plans/notes/sync-redesign-dossier/map-desktop.md` — Why: file:line map of `apps/studio/sync/` (lane wiring, every timer, echo mechanisms, deletion inventory)
- `.ai/plans/notes/sync-redesign-dossier/map-hub.md` — Why: file:line map of hub write doors, hook sites (`server.mjs:702/741/406`), watcher-gap proof, WS surfaces
- `.ai/plans/notes/sync-redesign-dossier/map-ddr-corpus.md` — Why: which standing decisions are IMMUTABLE vs REVISITABLE + the trap list with preventing properties
- `apps/studio/sync/file-membership.ts` + `apps/hub/src/file-membership.mjs` — Why: the classifier that becomes the single membership oracle (byte-identical mirror + tripwire test)
- `apps/studio/sync/cold-start.ts` — Why: `decideColdStart` + `decideAnnotationsColdStart` pure tables — the pattern `decideFile` must follow (pure, total, table-tested)
- `apps/studio/sync/file-pull.ts` — Why: the fetch/verify/quarantine loop Increment 3 absorbs into the single apply site
- `apps/studio/sync/asset-push.ts` + `asset-pull.ts` — Why: what Increments 3/5 replace; transport core of `asset-push.ts` survives in the door client
- `apps/studio/sync/index.ts` — Why: the wiring to touch in Increments 2–3 (`announceWrite` bridge, HMR broadcast, pull triggers); read the lane-wiring sections, not all 3,380 lines
- `apps/hub/src/assets.mjs` + `asset-lane.mjs` — Why: today's write doors + checkout→R2 mirror that becomes journal-driven write-behind
- `apps/hub/src/documents.mjs` — Why: Hocuspocus server — where `maude.files` control doc + `broadcastStateless` + `onAuthenticate` scope-mapping land
- `apps/hub/src/rehydrate.mjs` + `backup.mjs` — Why: generation restore flow that Increment 1 extends with journal-tail replay-before-epoch-decision
- `apps/hub/src/file-manifest.mjs` — Why: walk machinery reused by the permanent walk-import reconciler
- `apps/cells/wrangler.toml` — Why: CF limits that shaped the 95 MB per-file cap and image/tag release coupling
- `.ai/plans/archive/feature-sync-file-plane.md` — Why: Plane B v1 + the F1–F6 security gate definition that Increment 4 executes

### Files to Create

- `apps/hub/src/journal.mjs` — `file_journal` + `journal_meta` + `peer_cursors` + `sha_cache` tables, append API (`recordWrite`), compaction view, `GET /api/journal`, R2 tail write-behind + replay
- `apps/studio/sync/file-ledger.ts` — per-hub ancestor store + stat cache + outbox at `_state/file-ledger/<hubId>.json` (already `never`-class — zero taxonomy churn)
- `apps/studio/sync/decide-file.ts` — the ONE pure total decision function (§4 of the synthesis), property-tested over the full `{local × remote × ancestor × tombstone × epoch}` matrix
- `apps/studio/sync/cold-start-apply.ts` — Increment 0: the single application body both architectures (agent.ts, migrate-seed.ts) import
- `apps/studio/sync/ctl-provider.ts` — ctl-only loopback provider for the cell studio child (outside the CELL_LIVE_PAIRING gate) + desktop `maude.files` attach
- `apps/studio/test/decide-file.test.ts`, `apps/studio/test/ledger-crash-ordering.test.ts` (kill-between-writes harness), `apps/studio/test/journal-protocol.test.ts`
- Hub tests: journal append/replay/epoch drill, walk-import drift catch, poke coalescing

### Patterns to Follow

- **Pure decision tables**: `cold-start.ts` `decideColdStart` — pure function + exhaustive test matrix; `decideFile` follows this exactly (compile-time `never` default on the switch).
- **Loopback-token routes**: `POST /api/journal/report` mirrors the existing studio-child ↔ hub loopback pairing auth (see `studio-child.mjs` / `cell-pairing.ts`); report is a NUDGE — hub re-stats and re-hashes its own disk, never trusts the payload.
- **Streamed writes**: tmp+rename via `atomic-write.ts`; bytes land BEFORE ancestor/cursor updates (enforced in one module; crash-test pinned).
- **Runtime-state taxonomy**: ledger lives under `_state/` (already IGNORED in all 4 DDR-115 lists — verify with `apps/studio/test/sync-file-membership.test.ts`, do NOT add new `_*` paths).
- **Capability gating**: hub advertises `ledger` in `/health` + link handshake; clients never attach ctl or change polling against a hub that doesn't advertise it (compat matrix §10 of the synthesis is BINDING).
- **DDR-062**: any new helper invoked from plugin markdown goes through `maude design <verb>` — not expected in this arc, but the Sync panel is client code (rebuild committed bundle release-minified per CLAUDE.md).

---

## Open decisions (human input — defaults chosen so execution never blocks)

Product trade-offs surfaced by the synthesis. Each has a default the plan proceeds
with; override any of them before or during execution.

> **Resolved 2026-08-16 (user):** the mode model — exactly two ownership modes
> (repo-owned / hub-owned), linked ⇒ `.design/` gitignored, no hybrid, old
> repo-to-repo-P2P variant dead. See "Product mode model" section + Task 6.

1. **`propagateDeletes` default (Inc 6):** default **OFF for one release** (opt-in with breakers active), flip ON the next release if dogfood is quiet. (Completes the iCloud mental model with one release of caution. Note: the Mode-B decision makes delete propagation the *expected* behavior — a hub-owned mirror that ignores deletes contradicts the model — so the flip to ON is a when, not an if.)
2. **Breaker UX when mass-delete/tombstone-storm/first-anchor-storm fires:** default **auto-proceed conservatively after 10 min** — quarantine everything, propagate nothing, loud panel + `_sync.json` state; headless desktops must not stall forever.
3. **Conflict-copy label** in `.maude-conflict-<ts>-<label>`: default **hostname** (same exposure class as today's `syncMeta.by`).
4. **Legacy client support window** for journal-less self-hosted hubs: default **≥2 releases** after fleet burn-down.
5. **Doručenka stale-peer window:** default **14 days** to auto-label stale (excluded from "everywhere" aggregate), manual dismissal allowed, never silently dropped.
6. **R2 cost posture** (tail + CAS all classes + trash quarantine, no GC): default **accept**; surface per-tenant storage in hub admin tenant stats (cheap, already has `tenant-stats.mjs`).
7. **Shared-doc epilogue (Inc 7–8) in this arc?** default **separate follow-up arc** — start only after Inc 5–6 soak; it deletes ~800 more lines (agent.ts) and erases the last drift class, but touches the doc plane this arc deliberately leaves alone.

---

## Tasks

Execute in order. Each task = one shippable increment (strangler pattern — sync works
after every release; delete only one release after the replacement soaks). Hub+cell
ship together (one image tag); the only skew axis is desktop↔hub, governed by the
compat matrix (synthesis §10). Acceptance bar throughout: **file-for-file parity on a
real tree (alligators + alligators-mirror), verified against built artifacts.**

### ✅ Task 0: RECORD the architecture decision (DDR) + the GitSync rejection (DDR) — DONE 2026-08-17

> Shipped as **DDR-226** (sync v2 architecture), **DDR-227** (git-as-transport
> developed and rejected) and **DDR-228** (two-mode design ownership), all three
> ingested into the graph (`kg search "sync journal file plane"` returns DDR-226
> as the head; `area:sync` `last_ddr` = `maude/DDR-228`).


- **Do**: `/flow:record-ddr` × 2: (a) "Sync v2: hub-ordered journal file plane, one store of serving truth, doručenka" — the synthesis end-state + the 16 grafts; supersedes/extends DDR-217/222/224/225 posture, fires DDR-214's revisit trigger. (b) "git-as-transport for .design sync: developed and rejected" — Bill of Lading Part I grounds (unsplittable receive-pack vs body caps; unbounded binary history vs 8 GB/600 s cell physics; checkout unusable under DDR-054; no event channel). Git STAYS history-of-record/seed/backup/rehydrate. (c) "Two-mode design ownership: repo-owned vs hub-owned, no hybrid" — the Product mode model section above; supersedes the linked+committed posture AND the old repo-to-repo-P2P-on-git-push multiplayer variant; linked ⇒ `.design/` gitignored locally; `design-sync.mjs` reclassified sync→export.
- **Why now**: so the direction is never re-litigated and increments can cite one decision.
- **Validate**: `maude kg context --about "sync journal"` returns the new head decision.

### ✅ Task 1: Increment 0 — groundwork, zero wire change (S) — DONE 2026-08-17

> **Correction to this task as written.** `apps/studio/sync/autocommit.ts` is NOT
> deletable: `apps/hub/src/workspace-agent.mjs` imports `createAutoCommit` from
> it and `apps/hub/Dockerfile` copies the file into the image — that IS DDR-198's
> "one commit engine, never two copies of the rules". What was verified dead is
> the desktop **wiring** (`createAutoCommit` call, `editorOf`, the writer wrap,
> the stop-flush), unreachable because the `workspaceMode && !cellPairing` gate
> at `sync/index.ts:403` already returns null for exactly that condition. The
> wiring is gone (~75 lines) and the module stays, with a comment at the old
> construction site recording why it is not coming back on either side.
>
> Shipped: `sync/cold-start-apply.ts` (one exhaustive applier, compile-time
> `never` default) consumed by BOTH `agent.ts` and `migrate-seed.ts` — which
> fixes the LIVE `recover-seed-dup` fallthrough; `sync/pull-budget.ts` (F6
> aggregate per-pass byte ceiling, 2 GiB) wired into `asset-pull.ts` and
> `file-pull.ts`; `test/cold-start-apply.test.ts` (tripwire + totality +
> regression) and `test/sync-pull-budget.test.ts`.

- **Do**: DELETE desktop `autocommit.ts` + its editorOf/writer-wrap/stop-flush wiring (~450 lines — verified dead by two independent breakers; git history is served by the hub side per DDR-198). CREATE `cold-start-apply.ts` — single application body for the DDR-102/223 tables (exhaustive switch, compile-time `never` default), imported by BOTH `agent.ts` and `migrate-seed.ts`; this **fixes the LIVE `recover-seed-dup` fallthrough in migrate-seed** found by the desktop reader. ADD tripwire test: both callers import the one module. ADD F6 aggregate byte budget to existing pulls.
- **Gotcha**: `autocommit.ts` deletion must also drop its `whats-new`/status mentions; grep for `autocommit` across `sync/index.ts`, `status.ts`, docs.
- **Validate**: existing cold-start suite green through the new module; new fallthrough regression test; real-tree link smoke.
- **Rollback**: git revert — no wire/schema change.

### ✅ Task 2: Increment 1 — hub journal + tail durability, dark (M) — DONE 2026-08-17

> **Deviation, recorded.** The journal lives in its OWN `journal.db`, not in
> `hub.db`. `hub.db` belongs to the Hocuspocus SQLite extension — its schema is
> upstream's to migrate — and `tombstones.mjs` already made and documented this
> call. The consequence the plan's shape was protecting is handled explicitly
> instead: `journal.db` is added to `BACKUP_DATABASES`, so it rides the SAME
> generation as the documents and the checkout (DDR-199). `tombstones.db`
> deliberately stays out of that set; the journal cannot.
>
> **The write-door tripwire earned its keep on day one.** It flagged
> `hydrateAssets` — the bucket→checkout refill at boot — as a checkout write
> door with no journal hook. On a rehydrated cell that is dozens of files
> arriving with no row, which in this protocol reads as "never delivered". Now
> hooked with `source:'hydrate'`.
>
> Shipped: `apps/hub/src/journal.mjs` (schema, `recordWrite` reading the hub's
> OWN disk, compaction-as-manifest, cursors + persistent refused set, epoch,
> `GET /api/journal` failing closed three ways, loopback-only
> `POST /api/journal/report`, R2 tail write-behind + `replayTailFromTarget`,
> permanent `walkImport`); arg-carrying `onWritten({path})` on both asset doors
> bound to one `noteCheckoutWrite`; `scheduleBackups({onGeneration})` → tail
> rotate; replay-before-epoch-decision in `rehydrate.mjs`; SIGTERM tail flush;
> post-bind walk-import + 15-min belt; `/health` `capabilities: ['ledger']`.
> Tests: 4 new files, 48 cases, incl. the full restore drill (backup → wipe →
> restore → replay ⇒ head monotonic, epoch preserved) and the
> crash-between-append-and-flush case (row lost, CONTENT not — walk-import
> re-states it). Hub suite 681/681.


- **Do**: CREATE `apps/hub/src/journal.mjs` per synthesis §2 (schema verbatim). Make the three existing door hook sites (`server.mjs:702/741/406` — verify live line numbers) **arg-carrying** `recordWrite({path})`. ADD `POST /api/journal/report` (loopback nudge; hub re-stats/re-hashes its own disk). ADD **R2 journal-tail write-behind** (one NDJSON line per append, `tenants/<id>/journal/tail.ndjson`, rotated per backup generation, loud + retried) and **replay-before-epoch-decision** in `rehydrate.mjs` + SIGTERM tail flush; epoch rotates ONLY on unreconstructible rewind. ADD permanent **walk-import reconciler** (post-bind, boot + periodic; reuses `file-manifest.mjs` walk; sha cache persisted in hub.db). ADD `GET /api/journal?since=&epoch=` + `peer_cursors`; `/health` advertises `ledger`. ADD CI grep pinning every write-door `rename(` to an adjacent journal append.
- **Pattern**: hub.db table creation mirrors existing tables (see `tokens.mjs`/`users.mjs` migrations); R2 writes mirror `backup.mjs` client usage.
- **Gotcha**: this is the amendment that resolves the #1 cross-candidate hole — cells rehydrate from a ≤6h-old generation on EVERY wake; without tail replay the journal silently rewinds seqs and cursors go stale-forever. The replay MUST run before any epoch decision.
- **Validate**: restore drill — backup → wipe → rehydrate → tail replay → head monotonic, epoch preserved; kill-mid-append test; walk-import catches a hand-planted checkout mutation. Run against the real container image (DDR-198 lesson).
- **Rollback**: routes dark, table inert — zero clients depend on it.

### ✅ Task 3: Increment 2 — the poke; the live watcher-gap bug dies fleet-wide (M) — CODE DONE 2026-08-17 (live fleet drill pending a release)

> Shipped: hub `files-ctl.mjs` (dotted `maude.files` reserved doc, 250 ms
> coalescing `broadcastStateless`, `withoutCtlPersistence` so the control doc
> never reaches the document store), scope-MAPPED + forced-read-only admission
> in `onAuthenticate`, poke fired from the journal's append listener. Studio:
> `sync/ctl-provider.ts` (`resolveCellCtl` — workspace mode + loopback + token,
> and deliberately NOT the pairing gate), `sync/poke.ts` (the wire twin, pinned
> against the hub's parser over an adversarial corpus per DDR-198's twin rule),
> `sync/journal-client.ts` (`fetchJournal` + `hubCapabilities`/`hasLedger` — the
> compat-matrix gate), `sync/ctl-heal.ts` (poke ⇒ journal read ⇒ `fs:any` ⇒ the
> existing `asset`/`css` heal), `sync/cell-file-events.ts` wired in `ws.ts`
> beside `createContainerWriteBridge`. Desktop attaches capability-gated with a
> poke counter; the 20 s poll is untouched. Rollback: `linkedHub.fileEvents:false`
> (config, no terminal) or `MAUDE_FILE_EVENTS=0` cell-side.
>
> **Security change found while wiring it.** `POST /api/journal/report` used to
> answer `{noted, appended}`. `appended` differs for a path that exists and one
> that does not, so the response was an existence oracle over the customer's
> checkout for anyone who reached the route — and "the loopback gate protects
> it" is precisely the assumption a future proxy hop would invalidate. The
> response is now `{noted}` only (a pure function of the request), pinned by a
> test that asserts present and absent paths read identically. Both journal
> routes additionally refuse a canvas-origin request structurally (DDR-088).
>
> **The unit suites were green while the feature was DEAD.** `new Server()`
> returns a `Server`, whose document map lives at `.hocuspocus.documents`;
> `createFilesPoke` read `instance.documents`, got `undefined`, and took the
> "nobody is attached" branch — which is a legitimate everyday state, so every
> poke vanished in silence. The unit test passed throughout because its fake
> instance had the shape the code wished for. Found by the local-cell harness
> below, on its first real run. `documentMap()` now resolves either shape and
> the no-map case is a LOUD error rather than a quiet return; the regression
> test constructs a real `Server` instead of a fake.
>
> **Local verification harness (added with this increment):**
> `scripts/dev/local-cell.mjs` stands up the hub from source in workspace mode
> — a cell minus Cloudflare — over a seeded scratch repo, with a `file://`
> object-storage target so the tail and the restore drill run their real code
> paths. `--no-watch` sets `MAUDE_NO_WATCH=1` on the studio child, which
> reproduces the container watcher gap on any platform: on macOS `fs.watch`
> DOES fire for tmp+rename, so without it a green run proves nothing about
> this fix. `scripts/dev/journal-e2e.mjs` drives that running stack as an
> ordinary peer — **28 checks, all green**, including a real
> `@hocuspocus/provider` attach that receives a real poke 302 ms after a real
> PUT.
>
> **Still owed, and it needs a human at a browser:** the HEAL itself (open a
> canvas under `--no-watch`, PUT an asset it references, the broken frame must
> repair with no reload) and the desktop's end-to-end latency. The fleet drill
> on an unpaired cell via the CF `containers` dataset remains the release-time
> confirmation.


- **Do**: ADD reserved dotted control doc **`maude.files`** (dotted name fails every old-client slug regex — verified `[A-Za-z0-9_-]`; branch-independent; scope-mapped in `onAuthenticate`; admitted read-only; never stored as Y content). Hub: `broadcastStateless({t:'files', head})` coalesced 250 ms. Cell studio child: attach **ctl-only loopback provider OUTSIDE the `CELL_LIVE_PAIRING` gate** (pairing preconditions govern shared-doc content, not a read-only stateless channel — this is what makes the fix fleet-wide, not pilot-only) → poke → synthesize `fs:any` → existing `asset`/`css` HMR heal. Desktop: attach capability-gated; poke triggers existing `pullAssetsOnce`/`pullFilesOnce`. Poll STAYS 20 s + add a poke-miss honesty counter.
- **Pattern**: stateless messages — see existing Hocuspocus usage in `documents.mjs`; peers with zero canvas docs must still hold the ctl connection (files-only projects keep event latency).
- **Gotcha**: ground truth §3's prime suspect confirmed by the hub reader — hub-process atomic tmp+rename writes are invisible to container `fs.watch`. The poke closes it structurally; do NOT also try to fix the watcher.
- **Validate**: LIVE on the fleet: hub-door asset PUT on an UNPAIRED cell heals an open cloud tab without reload (verify via CF observability `containers` dataset); poke-loss test (kill WS mid-poke ⇒ 20 s poll catches up); old-desktop-vs-new-hub regression: no phantom doc from the dotted name.
- **Rollback**: `linkedHub.fileEvents:false` (config key, not env) on either end ⇒ today's poll cadence exactly.

### ✅ Task 4: Increment 3 — ledger + three-way engine, behind the existing flag (L) — DONE 2026-08-17

> **The architecture is now complete enough to run end to end locally.**
> `scripts/dev/local-cell.mjs --no-watch` + `scripts/dev/journal-e2e.mjs` drive
> the whole loop against a real hub, a real studio child and a real
> object-storage target: **41 checks green**, including a fresh peer pulling the
> project down, a local edit travelling up, a converged pass moving nothing, a
> simultaneous edit parking rather than merging, and the doručenka naming the
> file it happened to.
>
> Shipped: `sync/decide-file.ts` (the pure total table — 1024-point property
> matrix, compile-time `never`), `sync/file-ledger.ts` (ancestor store + stat
> cache + outbox under `_state/`, with `adoptAfter` making the write ordering
> structural and a real SIGKILL test pinning it), `sync/file-plane.ts` (ONE
> lane both directions: cursor read → local scan → decide → apply, with
> conflict-aside, referenced-asset priority and the F6 budget),
> `apps/hub/src/file-door.mjs` (`PUT /api/file/<rel>` with `x-maude-expect-hash`
> CAS + the NEW owner-role gate on code-module writes + a `{seq}` receipt),
> `journal.latestFor()` for the CAS lookup, and the doručenka in `_sync.json`.
> Wired into the runtime capability-gated: journal hub ⇒ v2 plane, journal-less
> hub ⇒ the v1 manifest pull, exactly as the compat matrix requires.
>
> **Four real bugs the tests and the harness caught, all worth recording:**
>
> 1. **A delta read is not a manifest.** Feeding "absent from this page" to the
>    table as `remote: null` reads as "the hub lost it" and re-uploads every
>    converged file on every pass — absence-as-authority (DDR-076) rebuilt one
>    layer above the table that forbids it. The ledger now carries the hub's
>    side as a replica; only a full read may retract it.
> 2. **The owner gate was bypassable on the second pass.** Admission ran only
>    for paths the current page carried, so a code module refused once sailed
>    through on the next tick from the remembered remote. Admission belongs to
>    the OFFER, not the notification. Regression-tested.
> 3. **The degraded-epoch rows could never fire.** `isDegraded` was asked AFTER
>    re-anchoring adopted the hub's epoch, so the answer was always "fine".
>    Computed before now.
> 4. **`(size, mtime)` is a poor identity for a file edited moments ago.**
>    `v1`→`v2` is a same-length write; inside the timestamp's resolution the
>    cache hides a real edit. A recently-touched file is now always re-read
>    (rsync's own guard), and the watcher additionally invalidates by path.
>
> **Deferred to Increment 6 by design:** deletion EMISSION. The rows exist in
> the table and are tested; `propagateDeletes` stays off, so a local absence is
> HELD — neither resurrected nor propagated — until the tombstone door and the
> mass-delete breakers ship.

### ✅ Task 4.9: two-sided E2E — what the increments could not prove, and the three defects it found — DONE 2026-08-17

`journal-e2e` proved the TRANSPORT: the journal appends, the poke fires, the
tail survives a restore. It could not prove the PRODUCT — that a person makes a
change on one machine and sees it on the other. `scripts/dev/sync-e2e.mjs`
closes that: a cell and a peer, two agent-browser sessions, and **every
scenario written once and run BOTH WAYS**.

That last constraint is the finding. **Two of the three defects below were
invisible in the direction their author happened to try first**, and one of
them had already shipped through a release with every unit test green.

1. **The nudge had no caller** (`6bd04c57`). Increment 3 shipped
   `POST /api/journal/report` and nothing that calls it, so a write by the
   cell's own studio child waited for the 15-minute walk-import belt: seconds
   one way, up to a quarter of an hour the other. Two write paths also never
   announced at all — the asset writer (content-addressed after the rename, so
   there is no `rel` to arm `activity:suppress` with) and annotations (they
   reach other VIEWERS over the collab room, so nobody noticed they never
   reached the file plane promptly). Belt retuned to 1 min
   (`MAUDE_JOURNAL_WALK_MS`); measured 1.48s end to end after.
2. **A canvas created on a peer arrived with no title** (`b121b120`).
   Cold-start meta was doc→file only; the cloud won a race the desktop lost, so
   the gap was invisible from the winning end. Fixing it exposed the worse one:
   the meta lane is a whole value in a `Y.Text` written delete-all +
   insert-all, and two peers publishing the same value into an empty lane leave
   two identical copies — neither empty nor parseable, so every consumer reads
   "this canvas has no meta". Found nine poisoned documents live. The lane
   heals now.
3. **One deleted canvas wedged the cloud's autocommit permanently**
   (`7c899d04`). `git add -- <path gone and never tracked>` exits 128; the
   batch failed, re-queued ITSELF INCLUDING that path, and failed identically
   forever. Five commits, then twenty-plus identical error lines and thirty
   canvases untracked — while `/health` answered 200 and every file was
   present. Sync looked perfect; only the history was gone. Git is now asked
   which kind of gone it is: tracked ⇒ stage the deletion, untracked ⇒ drop it.

**Two findings recorded, not fixed:**

- **The cloud's git history covers canvases, not the project.** The hub commits
  on `onDocumentStored`; file-plane arrivals — assets, design-system
  css/md/ts — are journalled and never committed
  (`maude/cloud-git-history-covers-canvases-not-the-project`).
- **A canvas moved into a folder ON A PEER never reaches a brand-new machine.**
  It gets a new folder-prefixed slug and a new document while the pre-move one
  lingers, so a fresh machine links fewer canvases than the hub lists. Entangled
  with Increment 6 by construction — with deletion emission off, two documents
  describe one file (`maude/peer-moved-canvas-missing-on-a-fresh-machine`).

Both are `expected-pending` rows with named reasons, so a regression that drops
anything ELSE still fails loudly, and the day those land they turn green on
their own. **Deletion propagation** appears the same way, matching Increment 6's
deferral — a move currently leaves the old path behind on the far side, and the
suite says so rather than hiding it.

### Task 4 (original text): Increment 3 — ledger + three-way engine, behind the existing flag (L)

- **Do**: CREATE `file-ledger.ts` (ancestor store + stat cache + outbox; write-ordering invariant per synthesis §3, enforced in one module) and `decide-file.ts` (synthesis §4 table VERBATIM, incl. deletion + epoch-degraded rows; deletion EMISSION still off). One apply site absorbs `file-pull.ts`'s fetch/verify/quarantine loop. Journal-cursor pulls with fail-closed reanchor. Push half: `fs:any` → classifier → hash → ledger → `PUT` with `ifHead` CAS (409 ⇒ refetch ⇒ re-decide). Size-classed outbox + per-path park-and-skip (no global head-of-line); mass drains above threshold in the existing spawned-child pattern (DDR-222's wall respected). Conflict copies named `.maude-conflict-<ts>-<label>` (NEVER `*.sync-conflict-*` — `~/git` runs real Syncthing; classifier additionally REFUSES foreign `*.sync-conflict-*` from membership). Crossing-write self-detection (remote row hash == in-flight outbox ⇒ self, adopt). Referenced-asset prioritization (front-queue assets cited by just-arrived doc-lane changes — keeps the DDR-223 strokes→bytes latency coupling). Reanchor/poke cooldown (hostile-hub spam). Doručenka per-file rows (refusal outranks cursor; token-bound peer labels; `referenced-but-unoffered` state) in `_sync.json` + Sync panel. `linkedHub.syncFiles:true` now selects THIS engine (opt-in this release). **Old lanes untouched and still running for flag-off projects.**
- **Pattern**: `cold-start.ts` for the pure table + test matrix; `atomic-write.ts` for materialization; existing `_sync.json` writer in `status.ts`.
- **Gotcha 1**: bytes materialize BEFORE ancestor row update; push 2xx `{seq}` BEFORE ancestor adopt — ship the **kill-between-writes crash test in the same task**, not after.
- **Gotcha 2**: mixed-era — v1 push acks must feed ancestor adoption so the hybrid state is defined, not accidental.
- **Gotcha 3**: Sync panel = studio client → rebuild committed bundle release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and watch `git status apps/studio/dist/` before/after any `bun test`.
- **Validate**: full `decideFile` property matrix; crash-ordering test; real-tree 216/216 byte parity (Plane-B acceptance repeat); mixed-era test.
- **Rollback**: flag off ⇒ v0.60.7 paths untouched; deleting the ledger file forces a safe re-anchor (never loss).

### ✅ Task 5: Increment 4 — F1–F6 hard gate, flag default ON (M) — DONE 2026-08-18

> **The gate now has a named worklist.** The two-seat review of Increments 0–3
> ran at the close on 2026-08-18 (`.ai/logs/security-reviews/sync-journal-file-plane-{defender,attacker}.md`,
> 9 + 16 findings, both seats NEEDS FIXES). Everything **live without the flag**
> was fixed before that close — A3 (write-door token scope), A4/F-1 (owner gate
> on the lexical rather than the real path), A10/F-5 (check-then-act CAS), A11
> (`movedTo` as a peer-controlled deletion trigger) — plus A1/A2 (the budget
> charged the hub's claimed size; the body was buffered before the cap ran).
> **What this task inherits, by name:** F-3 receiver-side symlinked-parent
> containment in `materialize`/`parkLocal`; F-4/A7 the poke + reanchor cooldown
> DDR-226 §9 promised and nobody built (**A7's ctl half is NOT flag-gated**);
> A5 `allowCodeModules` as a hub-asserted bit; A6 non-idempotent epoch-degraded
> `parkRemote`; A8 unbounded pre-admission ledger rows; A9 the untrusted-content
> markers the file plane widened without widening; A12 awareness on the ctl doc
> is not read-only (**live**); A13 a missing R2 tail does not rotate the epoch
> (**live**); A14 Syncthing conflict artifacts are plane members; A15 unvalidated
> `head`/`epoch` persisted verbatim; F-6..F-9. The flip cannot precede these.


- **Do**: Run `/flow:validate-security` as a HARD gate over the file plane: F1 = untrusted-DATA delimiting for all file-lane pulls into `system/**` (`_untrusted/INDEX.json` + `.claudeignore` extension — SCHEDULED work, not a citation); F2/F3 = empty-tree css default + config-seed-before-first-pull pinned by tests; F4 structural (wire mtime display-only — Inc 3); F5 regression-tested; F6 + cumulative per-hub accumulation quota. ADD hub-door **owner-role gate on code-module writes** (NEW — today `handleCheckoutAssetRoute` checks class only; receiver-side gate is currently the only one). CONSOLIDATE to single door `PUT /api/file/<rel>` (old doors become byte-identical thin shims). ADD first-anchor conflict-storm breaker (>N no-ancestor conflicts in one pass ⇒ hold + Sync-panel bulk keep-local/keep-cloud — on flip day the hub's `system/**` is stale by construction). Flag default flips ON only after the gate passes + one soak release.
- **Gotcha**: closes pending task #4 (flag-flip cycle) — record the gate verdict via `maude kg record-log`.
- **Validate**: recorded security verdict; flip-day dogfood on a project whose hub `system/**` is stale — the breaker must FIRE, not mass-revert.
- **Rollback**: flag default back off per project (config, no terminal — DDR-177 posture); shims keep every old client alive.

### ✅ Task 6: Increment 4.5 — mode model: adopt / detach (M) — DONE 2026-08-18

- **Do**: Implement the two-mode model (see Product mode model section). **Adopt (A→B)**: link flow gains a mandatory adoption step — fresh-link push of the local `.design/` through the journal plane, then append `.design/` to the repo `.gitignore` + `git rm -r --cached .design` (single confirmed operation; desktop UI dialog per DDR-177 — no terminal; CLI mirror in `maude` for terminal users). Refuse to complete a link without adoption (no hybrid state). Detect Syncthing-managed folders (`.stfolder` in ancestors) and recommend/offer an `.stignore` entry. **Detach (B→A)**: unlink hub + remove the ignore line + prompt "commit `.design/` now" (bytes already local — the mirror is full). **Migration**: existing linked projects (e.g. alligators) get a one-time prompt on first run with the new version — adopt (ignore + untrack) or detach; linger in the old hybrid is allowed only until answered, and the Sync panel shows a persistent "legacy hybrid" badge. RECLASSIFY `design-sync.mjs` as explicit export/handoff (docs + command surface wording; no longer described or wired as a sync lane).
- **Pattern**: `cli/lib/gitignore-block.mjs` for gitignore editing discipline (append/remove idempotently, last-match-wins awareness); hub-workspace link flow for the UI seam.
- **Gotcha 1**: `git rm -r --cached` on a dirty tree — stage ONLY the `.design/` removals + `.gitignore` edit; never `git add -A` (global instructions). Snapshot nothing; the working tree is untouched by design.
- **Gotcha 2**: DDR-115's four ignore-list copies govern what syncs INSIDE `.design/` — this task's repo-level ignore is a FIFTH, different concern (whole-folder, user-repo-side). Do not conflate them; the taxonomy lists stay untouched.
- **Gotcha 3**: fresh clone of a Mode-B repo has NO `.design/` — the link flow must handle "adopt an empty local dir from hub" (fresh-link pull), which is the new-machine onboarding path. Verify it end-to-end.
- **Validate**: adopt on a real repo → `.design/` untracked, ignored, hub has full tree, doručenka all-green; detach → repo commit contains byte-identical tree; new-machine clone → link → full pull parity; migration prompt fires exactly once per legacy project.
- **Rollback**: adopt/detach are explicit user operations with confirmations; migration prompt can be deferred (badge persists); revert = detach.

### ↗ Tasks 7 + 9 — MOVED OUT 2026-08-18

Increment 5 (burn-down) and Increments 7–8 (the shared-doc epilogue) now live in
[`feature-sync-burn-down-and-shared-doc.md`](feature-sync-burn-down-and-shared-doc.md).

They were not dropped and they are not blocked on effort. Both DELETE working code, and
the rule that governed this whole arc — nothing is deleted until its replacement has
soaked a release — makes their precondition **a shipped release**, which is not
something a plan can satisfy from inside itself. Task 7 also gates its poll relaxation
on a MEASURED poke-miss figure, and Task 9 was designated a separate arc by Open
decision 7 from the start, because it touches the doc plane this arc deliberately left
alone.

Keeping them here would have meant either holding a finished arc open indefinitely or
quietly breaking the one rule that made the migration safe.

---

## Validation

Per increment (each is a release-shaped change):

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` — **check `git status apps/studio/dist/` before AND after** (known clobber risk, CLAUDE.md)
3. **Build**: `pnpm --filter @maude/site build` (quality gate parity with `quality.yml`)
4. **Parity/tarball**: `bash scripts/check-version-parity.sh`, `bash scripts/check-tarball-shape.sh`
5. **Real-tree acceptance**: fresh link alligators → alligators-mirror, assert file-for-file byte parity of the VERSIONED set; then the increment-specific live drill from the task's Validate line (restore drill, fleet poke heal, crash-ordering, breaker firing)
6. **Desktop self-containment** (Increments 3+): `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` against the built `.app`
7. **Security**: `/flow:validate-security` — hard gate at Increment 4, advisory before
8. **Fleet verify** (any release touching hub/cells): `.ai/release-guide.md` § "Verify the fleet actually rolled"

## Scenario Coverage

UI surface is the Sync panel doručenka (Increment 3+). Platform scope per config:
web-desktop only.

| Scenario | Covers | Status |
|----------|--------|--------|
| `sync-doruceka-panel` | per-file states local-only→everywhere render; refusal outranks cursor; conflict rows visible | 🆕 new (Inc 3) |
| `sync-breaker-prompt` | mass-delete breaker pause + bulk resolution UX | 🆕 new (Inc 6) |
| live fleet drills (not scenarios) | poke heal on unpaired cell; restore drill; parity link | per-task Validate lines |

## Acceptance Criteria

- [x] Task 0 DDRs recorded (architecture + GitSync rejection) and ingested to kg — DDR-226/227/228
- [x] **No increment deleted code whose replacement hadn't soaked one release** — upheld by moving the two deletion increments to their own plan rather than running them here. NOT met as written: the increments did not each ship as their own release, they landed as one branch (version is still 0.60.7 at close).
- [x] After Inc 2: code done and unit-proven; the **live fleet drill is still pending a release** — the fleet only picks this up on a tag
- [x] After Inc 3: `decideFile` property matrix green; kill-between-writes test green; real-tree byte parity. **Partial:** the doručenka answers "where is file X" in `_sync.json`, but the Sync panel still renders aggregates only — carried as debt, see the Retro
- [x] After Inc 4: security gate verdict recorded in the graph; all 25 findings from the two-seat review closed; `syncFiles` default ON
- [x] After Inc 4.5: adopt/detach implemented with the no-git and fresh-clone cases covered; legacy hybrids carry a persistent notice in `maude design status` until answered. **Partial:** the notice is CLI-only — the desktop dialog (DDR-177's terminal-free path) is not built, and the new-machine clone→link→pull parity is unit-covered rather than run on a real second machine
- [→] After Inc 5: moved to `feature-sync-burn-down-and-shared-doc.md`
- [x] After Inc 6: delete propagates both ways with breakers in both directions; quarantine, never unlink. **Deviation from Open decision 1:** `propagateDeletes` ships ON immediately rather than OFF for one release (user decision 2026-08-18), which makes the breakers the only protection — they are built and tested accordingly
- [x] Ground-truth §7 invariants hold: fail-closed cold-start, DDR-054 untrusted hub (receiver now defends its own root too), DDR-115 taxonomy + its tripwire, owner gate at BOTH ends (and now on the real landing path), idempotence, loud failure
- [x] Compat matrix upheld: a journal-less hub keeps every legacy lane (`journal-client.ts` treats both null and a capability set without `ledger` as "no journal"), and the DELETE door is additive — an old client never calls it
- [x] `pnpm --filter @maude/site gen:roadmap` regenerated at each plan-status change

---

## Retro — Increments 0–3 (closed 2026-08-18; Tasks 5–9 stay open)

- **Blind convergence was worth its cost, and the plan it produced held.** Three
  architects who could not see each other's work landed on the same skeleton, and
  four increments later nothing in §§3–7 needed renegotiating. The expensive part
  of this feature was never the design; it was finding out what the design had not
  been asked about.
- **The increments proved the transport; only the two-sided E2E proved the
  product.** Task 4.9 found three defects with every unit test green, and **two of
  the three were invisible in the direction their author happened to try first** —
  one had already shipped through a release. "Write each scenario once and run it
  both ways" is the reusable rule here, and it belongs in `/flow:plan` for anything
  with two ends, not just sync.
- **A carefully argued invariant is not an enforced one.** Every flag-independent
  security finding at this close had the same shape: a comment reasoning correctly
  about the symlink-resolved path, the untrusted hub, or the crossing write — and
  then a line of code asking the question of the lexical path, the claimed size, or
  a state that could move before the rename. The gap was never the thinking. Worth
  carrying into `/flow:execute`: when a module header explains *why* a value must be
  used, grep for every other place that value is re-derived.
- **The default-OFF flag bought less than it looked like.** Six findings were live
  regardless of `syncFiles`, because the hub-side door, the ctl channel and the move
  protocol are not behind it. A feature flag scopes the lane it gates, not the
  surfaces the lane's supporting code opened — the close should ask "what did this
  branch make reachable" separately from "what did this branch turn on."
- **Test-the-test paid for itself twice.** Two regression tests written for real
  findings passed against the unfixed code — one because the fixture modelled a
  hand-written file rather than a stored document, one because canvases were held
  back for an ordinary reason instead of by the breaker. Both were caught by
  deliberately reverting the fix and re-running. A regression test that has not been
  seen to fail is a comment.
- **Process debt, named:** the `sync-doruceka-panel` scenario in Scenario Coverage
  was never written, and the doručenka's per-file rows reach `_sync.json` but not
  the Sync panel, which still shows aggregates. `maude kg record-log` could not
  attach the two verdict files (it mishandles a `/` in the derived name), so the
  review substance lives in the graph as a decision rather than as an attached log.


---

## Retro addendum — Increments 4, 4.5 and 6 (2026-08-18, same day)

- **The flag was doing more work than the code, and that was invisible until
  somebody counted.** The Increments 0–3 close fixed everything reachable without
  `syncFiles`; this pass found that three more findings filed as flag-gated were not
  behind it either — the ctl channel's awareness, the epoch-rotation gap, the hydrate
  hook. "Behind a flag" is a claim about REACHABILITY, and reachability is a property
  of the whole call graph, not of the module the feature lives in. Worth asking at
  every future flip: *which of these can be reached by code the flag does not gate?*
- **Two of the fixes were one identifier long, and both had shipped.** The hydrate
  journal hook referenced two names from another scope and threw on every call; the
  door's write budget was one process-global counter shared by every token. Neither
  had a test, and neither could have had one without somebody first asking "what does
  this do on the second call, or the thousandth". The suite is excellent at "is this
  right once".
- **A test that guards a breaker has to be seen failing, and one of mine wasn't.**
  The first-anchor and park-memo tests passed against the unfixed code because the
  fixtures never reached the guard — one modelled a move as a hand-written file, one
  let ordinary logic hold the files back. Reverting each fix and re-running is now the
  habit, and it caught a real bug on its own: the delete breaker's fraction rule had no
  floor, so in a project tracking one file, deleting that file was 100% and every
  ordinary delete tripped it.
- **The plan was wrong about F2/F3, and the code was right.** The synthesis said
  empty-tree in-group css should default to canvas-owned; the shipped classifier does
  the opposite, because that default is what lost `brand.css` and `_layout.css` — files
  with no sibling body at all. Following the plan there would have re-introduced the
  RCA it was written after. What the tests pin now is the property that makes the
  shipped choice safe (convergence), not the default itself.
- **`propagateDeletes` shipping ON is a real deviation, taken knowingly.** Open
  decision 1 said OFF for one release. The user chose ON, which removes the soak
  window and leaves the breakers as the only protection — so the breakers were built
  to carry that weight in both directions, with the dangerous shapes (branch switch,
  `git clean`, half-finished restore) as the design cases rather than the edge cases.
- **Working beside a live session cost nothing only because it was noticed first.**
  Another session held uncommitted work in six shared files, including a `server.mjs`
  import of a module git did not know about yet. One edit had already landed there
  before the check; reverting that hunk specifically — not the file — kept their tree
  byte-identical. `git status` before editing a shared file is cheap; `check-import-coherence.sh`
  exists because the alternative cost two tag moves.
- **Debt carried out of this close, named:** the doručenka's per-file rows reach
  `_sync.json` but not the Sync panel; the `sync-doruceka-panel` scenario was never
  written; adopt/detach has no desktop dialog, so DDR-177's terminal-free path is
  CLI-only; the new-machine clone→link→pull parity is unit-covered rather than run on a
  second machine; and no live fleet drill has happened, because the fleet only picks
  this up on a release tag.


---

## Retro addendum 2 — the close's own review (2026-08-18)

- **The justification was the thing that was wrong, not just the code.** This
  release shipped `propagateDeletes` ON because the breakers were said to carry
  the weight the soak window would have carried. The review showed the delete
  breaker was a per-pass rate limit — two deletions per pass were under every
  arm of it, at every project size, forever — and that the recovery story under
  it was one file class wide. When you trade a safety window for a control,
  the control deserves the scrutiny the window would have received, and it did
  not get it because it was mine and it was new.
- **A control nobody can see is not a control.** `deleteHeld`,
  `firstAnchorHeld`, `reanchorHeld` and `resolveFirstAnchor` were declared,
  assigned, and read by NOTHING. Three breakers whose entire output was a
  `console.warn`, on a product whose stated premise is that the user never
  opens a terminal. Worth a grep before claiming a feature exists: *who reads
  this field?*
- **I shipped user-facing copy that was not true.** The changeset and the
  What's New entry both said sync "stops and asks". It stopped; it did not ask,
  because the asking half had no consumer. Product copy asserts behaviour, and
  it should be checked against the code with the same suspicion as a comment.
- **Twice in this arc, a security fix introduced a correctness bug the fixtures
  could not see.** Round one: a test that passed against the unfixed code
  because the fixture never reached the guard. Round two, worse: the F-3
  containment fix resolved the deepest EXISTING ancestor and appended the
  basename, so on a fresh link every nested file flattened to the top level —
  invisible because every fixture pre-created its directories. When a fix
  changes how a path is COMPUTED, the test that matters is the one where
  nothing exists yet.
- **Two reviews, and the second found more than the first.** Not because the
  first was weak, but because the flip changed what "reachable" meant. Review
  after the flag flips, not only before it.
