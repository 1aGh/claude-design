# Doručenka (evolutionary)
VERDICT: fixable
EFFORT: L — roughly 6 engineer-weeks of implementation across 7 releases (≈2 months calendar including per-increment dogfood soaks; increments 0–2 ≈ 1.5 weeks, 3 ≈ 1.5 weeks, 4 ≈ 1.5 weeks incl. security gate, 5–6 ≈ 1 week, optional 7 ≈ 0.5 week + soak). Net LOC: ≈ +1,300 added / −2,200 deleted ⇒ ≈ −900 core; ≈ −1,700 including the optional shared-doc epilogue (agent.ts + relay observers). Test surface is the real cost driver: decideFile property matrix, restore-drill e2e, skew-matrix runs against the built artifacts per the green-in-dev trap.
PITCH: One journal, one ledger, one poke: the hub appends every accepted write to a sequenced journal in hub.db and pokes peers over the Hocuspocus sockets they already hold (the unused stateless channel); peers pull by cursor, decide by three-way ancestor instead of wire-mtime, and every file gets a queryable receipt — hub ✓ / durable ✓ / peers ✓ / healed ✓. Two lanes remain (CRDT docs unchanged, one classifier-governed file lane), the bucket demotes to write-behind durability, and ~2,200 lines of sweep/probe/fast-lane/reference-scan heuristics become deletable because they were all hand-built approximations of "journal + cursor + poke".
FATAL: []
FIXABLE: ["SEQ-REWIND / EPOCH LIFECYCLE (top severity): cells rehydrate from a backup generation on EVERY wake (rehydrate.mjs header: 'normal path, not recovery'; disk ephemeral; wrangler.toml sleepAfter ~20m; cell backup interval = 10 min, cell-config.mjs:430; SIGTERM flushes git but uploads no backup generation, server.mjs:2541-2559). Journal rides hub.db, so head rewinds up to 10 min of seqs per wake, then boot-scan/hydrate/re-pushes append NEW rows at reused seq numbers. Design detects rewind only via `since > head`; if appends outrun a peer's cursor before its first post-wake fetch (near-certain with 2+ peers or a hydrate burst), rows land BELOW the cursor and are missed silently forever — the 60 s reconcile is cursor-based and cannot see them, violating the design's own no-silent-divergence invariant in the routine fleet path. §8(b)'s 'self-healing reanchor' claim only covers the benign half of the race. Fix: epoch MUST rotate on every restore (derive from backup generation id + boot nonce), forcing re-anchor per wake — the design's explicit 'epoch survives restore' choice is affirmatively wrong. Optionally add a pre-sleep backup upload to shrink the rewind window.", "FIRST-ANCHOR CONFLICT STORM at increment-4 flag flip: decideFile's 'no ancestor & both differ → park local in _trash/, adopt remote'. On upgrade day, projects where the hub checkout's system/** is stale vs the desktop working tree (the normal state — desktop autocommit is dead code, cell rehydrates from last USER commit, file plane was flag-OFF so system/** never pushed) mass-adopt STALE hub copies and park the user's NEWER DS files. Loud + quarantined, so it meets the letter of the invariant, but it is user-visible 'cloud reverted my design system' at fleet scale — exactly the trust the redesign exists to rebuild. The mass-delete circuit breaker has no conflict-side twin. Fix: first-anchor conflict-storm breaker (>N no-ancestor conflicts in one pass ⇒ hold rows + Sync-panel prompt), and/or a first-anchor tiebreak (e.g. consult git merge-base or offer bulk 'keep local / keep cloud').", "RESERVED `_files` DOC NAME LEAKS INTO v0.60.7 CLIENTS: slugFromDocName accepts underscore in both flat and namespaced shapes (remote-docs.ts:209-214 — COMPONENT = [A-Za-z0-9_-]{1,120}), and the peer-facing GET /api/documents unions LIVE peer connections into the listing (server.mjs listCanvases, 'union persisted docs with currently-active peer docs'). The moment increment 2's cell child attaches to `_files`, every unfixable old desktop lists it, creates a phantom pull target/provider/agent, and the hub's afterStoreDocument → workspace-agent onDocumentStored (workspace-agent.mjs:236-244) warns only for UNPARSEABLE names — `_files` parses and proceeds toward checkout projection if the doc is ever stored. Also collides with a real user canvas literally named _files.tsx, and the DDR-192 resolver makes the room BRANCH-scoped (doc-name.ts buildDocName), so cross-branch desktop↔cell pairs silently never receive pokes. Fix: pick a dotted reserved name (e.g. `maude.files` / `ws/<id>/maude.files`) — passes hub DOCUMENT_NAME_REGEX but fails every old-client slug regex (no dots allowed) — and make it branch-independent.", "CELL-SIDE QUARANTINE DURABILITY IS PARTLY ILLUSORY (weakens §10's own defense): _trash/ is DDR-115 runtime state (file-membership.ts:155) on an EPHEMERAL container disk — a hub-side quarantined loser evaporates at the next sleep cycle; the R2 write-behind mirror OVERWRITES the path's only durable copy with the winner; and media stays out of git per the design's own lane-7 row. So for path-addressed media (system/** photos, fonts), 'worst realized outcome is recoverable substitution' is false on the hub: a CAS-passing wrong push or an inbound tombstone can permanently destroy the prior cloud bytes within one wake cycle. Tombstone→R2 semantics are unspecified entirely. Fix: mirror the loser to a trash-prefixed R2 key (or enable object versioning) before any hub-side overwrite/tombstone apply, and never hard-delete mirror objects on tombstone.", "NEW-DESKTOP ↔ JOURNAL-LESS HUB DEGRADED MODE UNSPECIFIED: migration defends only old-desktop/new-hub skew. A post-inc-3 desktop against a v0.60.7 self-hosted hub (or a fleet cell during the desktop-updates-first window) gets 404 on /api/journal, no pokes, and — critically — no CAS: an old hub ignores the unknown x-maude-expect-hash header, so the §10 'confident overwriter' residual is UNBOUNDED exactly where the ledger is newest. After increment 4 deletes asset-pull/sweep, the fallback surface is gone. Fix: define the mode explicitly — permanent manifest-re-anchor cadence, and either refuse ancestor-based overwrite pushes when the hub can't CAS (fall back to probe+skip-if-present semantics) or version-gate the push half.", "decideFile MATRIX GAPS: (a) remote TOMBSTONE with local ABSENT and ancestor SET matches neither tombstone arm ('local==ancestor' compares a hash; naive else-branch 'keep local, push it back' has nothing to push); (b) pre-increment-6 'local absent, ancestor==remote' has no defined ledger row state (does the puller re-download, i.e. undelete? today's file-pull would); (c) 'delete-held' rows' interaction with a subsequent remote edit to the same path is undefined. The promised property tests must enumerate the full {local×remote×ancestor×tombstone×flag-era} matrix, not just the listed rows.", "RECEIPT HONESTY GAPS in the doručenka: (a) 'u peerů ✓ = every known peer's cursor ≥ seq' — one departed laptop pins every file red forever; needs peer expiry/dismissal policy; (b) the scalar cursor smears one permanently-failing file into 'everything after seq X undelivered' in the hub-side view (per-row truth exists only on the stuck peer); (c) the want-side blind spot: killing the reference-scan removes the only representation of 'referenced by my annotations/tsx but never journaled anywhere' (the DDR-223 coupling) — such a file gets NO receipt row at all, so the panel answers nothing precisely for the broken-glyph case that motivated the feature. Surface referenced-but-unoffered as a local ledger state.", "HOSTILE-HUB ACCUMULATION + INBOUND MASS-TOMBSTONE: journal-driven pull deliberately drops asset-pull's 'only what my own files reference' gate (asset-pull.ts:16-20) — acceptable per the already-planned file-plane flip, but F6 is a PER-PASS byte budget; a hostile hub can journal fresh content-addressed names every pass indefinitely (assets/ is never-GC'd by invariant), and the mass-delete breaker is outbound-only — inbound tombstones can quarantine the whole file-lane tree (recoverable, but on the desktop it floods _trash/ silently at 8 GB-disk/cell scale). Add a cumulative per-hub accumulation quota and an inbound tombstone-storm breaker.", "OPS KNOBS ARE ENV VARS: MAUDE_NO_FILE_EVENTS / MAUDE_FILE_LEDGER / MAUDE_LEGACY_SWEEP are unusable by packaged-.app users (DDR-177: the target user never opens a terminal) and cell-side require a fleet redeploy (env applies at container start; only a tag or workflow_dispatch rolls the fleet per release rules) — rollback latency is a release cycle, not a flag flip. Make desktop knobs config keys (linkedHub.* / settings UI) and document the workflow_dispatch path as the cell rollback runbook.", "LATENCY REGRESSION IN POKE-FAILURE MODE: demoting the 20 s poll to 60 s means silent poke loss (doc unloaded hub-side, WS reconnect races, branch-scoped room mismatch per hole 3) degrades cloud→desktop from today's ≤20 s to ≤60 s. The poke-miss counter observes it only after the fact. Keep 20 s until the miss-rate metric proves ~0 in dogfood — the design's own math says the empty cursor check is one cheap request."]

## DESIGN
# Doručenka — evolutionary consolidation to two lanes, one ledger

## 0. Headline numbers

| Question | Answer |
|---|---|
| Lanes after | **2** — (A) CRDT doc lane, wire-unchanged; (B) ONE file lane: journal + cursor + classifier |
| Stores of truth on the cell | **1** — the checkout. R2 persists as journal-driven **write-behind durability** (no serving/probe/presence semantics; read only at boot hydrate, boot-window GET fallback, disaster restore) |
| Cold-start implementations | **1 applier module** (`cold-start-apply.ts`), called by both architectures; 1 caller after the optional shared-doc epilogue |
| New primitives | hub **file journal** (SQLite table in hub.db), desktop **file ledger** (ancestor store under `_state/`), **payload-free poke** over the existing Hocuspocus socket (`broadcastStateless` — present in @hocuspocus 4.3.0 on both ends, currently unused) |
| Net LOC | ≈ +1,300 added / −2,200 deleted ⇒ **≈ −900** (core); **≈ −1,700** with the optional architecture-merge epilogue |

Design stance (Angle 2): every new mechanism is the promotion of something already shipped and debugged. The journal is the compaction-inverse of the existing `GET /api/files` manifest; the ledger generalizes the doc lanes' `journal.ts` content-hash idea; the poke is the WS channel Hocuspocus already ships; the write doors, the classifier, the quarantine posture, and the transport scar tissue (`connection: close`, Retry-After, temp+rename, batch-probe lesson) all survive verbatim.

## 1. How each of today's 7 lanes maps

| # | Today | End state |
|---|---|---|
| 1 | CRDT doc lanes (`agent.ts` / `projection.ts`+`migrate-seed.ts`, `codec.ts`) | **KEPT, wire-unchanged.** Internal change only: one cold-start applier (§5). Optional epilogue: desktop flips to shared-doc (the code cells already run in production), `agent.ts` dies |
| 2 | Asset push sweep (`asset-push.ts` walk + `asset-sweep.ts` + `asset-push-worker.ts` child) | **ABSORBED** into the file lane's boot/reconcile pass (ledger-vs-journal diff → K uploads). Child process + NDJSON protocol + token-file plumbing **DELETED** (no more mass walk+probe; DDR-222 pattern preserved in history as the named fallback if the SIGSEGV class reappears) |
| 3 | Fast-lane push (`pushOneAsset`, `queueFastPush`) | **ABSORBED**: same `fs:any` → 400 ms settle, but decision = ledger three-way instead of probe. Probe-guard **DELETED** (ancestor knowledge answers "did I just pull this") |
| 4 | Asset pull (`asset-pull.ts` reference-scan + `requestFastPull`) | **DELETED.** Journal entries replace reference-scanning; `ASSET_NAME_RE` validation moves into journal-entry admission. Kills the DS-asset perpetual-404 overlap artifact structurally |
| 5 | File plane (`file-pull.ts`, flag-OFF) | **PROMOTED to THE file lane.** Pull half survives nearly intact (its local-classify-first / drop-on-disagreement / owner-gate / containment / quarantine loop is the receiver); LWW-by-wire-mtime is replaced by the three-way (F4 dies); a push half and cursor client are added; flag flips ON after the F1–F6 gate |
| 6 | Cell bucket mirror (`asset-lane.mjs` sweepAll/sweepNew) | **DEMOTED** to a journal-driven write-behind queue: consumes journal rows without `mirrored_at_ms`, mirrors ALL file-lane classes (fixes the `system/**/assets/*` durability hole Map B found), loud + retried (DDR-224 posture kept). Probe "present = both stores" semantics die |
| 7 | Git autocommit + backup/rehydrate | **KEPT as pure backup/history — zero sync role.** Cell autocommit unchanged (Plane-A canvas lanes only; media stays out of git per repo-checkpoint reasoning). Desktop `autocommit.ts` **DELETED** (verified dead code — `createAutoCommit` unreachable since the index.ts:403 gate). The journal lives in hub.db, so it rides the SAME backup generation as documents (DDR-199 mixed-generation rule holds for the new state too) |

The three UI-refresh mechanisms collapse into subscribers of one event: HMR heal and peer-notify both hang off the journal append (§4). The two parallel sync architectures remain two *callers* of one cold-start applier until the epilogue.

## 2. Data structures

### 2.1 Hub file journal (new, `apps/hub/src/journal.mjs`, table in hub.db)

```sql
CREATE TABLE IF NOT EXISTS file_journal (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  path     TEXT NOT NULL,        -- designRoot-relative; classifier-shape-valid at append
  sha256   TEXT,                 -- full hash of bytes as accepted; NULL on tombstone
  size     INTEGER,
  mtime_ms INTEGER,              -- display/debug only; NEVER an overwrite authority (F4)
  class    TEXT NOT NULL,        -- classifier verdict at write time; a HINT to receivers
  deleted  INTEGER NOT NULL DEFAULT 0,
  source   TEXT NOT NULL,        -- 'peer-put' | 'studio-report' | 'boot-scan' | 'hydrate'
  mirrored_at_ms INTEGER,        -- write-behind durability ack (hub-side half of the receipt)
  at_ms    INTEGER NOT NULL
);
-- journal meta: epoch = random id minted when the table is first created; survives restore
```

- **Append points = today's write-door hook sites, reused verbatim** (`server.mjs:702/741/406` `onWritten`/`onAssetWritten` — the DDR-224 "every door mirrors" enumeration becomes "every door records"): `PUT /assets/<key>`, `PUT /_asset-file/<rel>`, studio-child writes (via a new loopback `POST /api/journal/report` — a *nudge*, the hub re-stats and re-hashes the file itself; report is never data, per the Syncthing watcher-is-a-hint rule), boot-scan, hydrate.
- **Idempotence at the source:** `recordWrite` no-ops when the latest row for the path already carries the same sha256 — an old desktop's redundant sweep re-upload produces zero journal churn and zero pokes.
- **Compaction:** delete rows shadowed by a newer row for the same path; tombstones retained indefinitely (table is tiny at hundreds of files). The compacted journal IS the manifest — `GET /api/files` survives as the seq-0 / re-anchor view.
- Canvas-owned files (Plane A) are **never journaled** — plane disjointness enforced by the same classifier call at append.

### 2.2 Desktop file ledger (new, `apps/studio/sync/file-ledger.ts`, persisted at `<designRoot>/_state/file-ledger/<hubId>.json` — nests under `_state/`, already IGNORED in every DDR-115 copy; zero taxonomy churn)

```ts
interface FileLedger {
  epoch: string; cursor: number;        // per hub
  rows: Record<string, {
    syncedHash: string;                 // the ancestor: last hash this peer and the hub agreed on
    remoteSeq: number;
    size: number; mtimeMs: number;      // local stat cache → re-hash only changed files
    state: 'synced'|'push-pending'|'pull-pending'|'conflict'|'delete-held'|'failed';
    reason?: string;                    // last failure verbatim (loud-failure invariant)
    pushedAt?: number; pulledAt?: number; healedAt?: number;
  }>;
}
```

This is Dropbox's Synced Tree / Mutagen's ancestor, scoped to Maude. It is runtime state: deleting it is always safe (forces a full re-anchor, never data loss).

### 2.3 The decision function (pure, unit-tested, ONE apply site)

```
decideFile(local: hash|absent, remote: hash|tombstone|absent, ancestor: hash|absent):
  local == remote                          → noop (advance ancestor)
  ancestor==local  && remote moved         → PULL   (sha-verified, .part+rename, quarantine loser if overwrite)
  ancestor==remote && local moved          → PUSH   (with CAS precondition, §3)
  both moved / no ancestor & both differ   → CONFLICT: park local in _trash/<rel>-conflict-<ts>, adopt remote, loud ledger row
  local absent, no tombstone, ancestor==remote → local deletion → push tombstone (increment 6 only, breaker-gated)
  local absent, remote present, no ancestor    → PULL (fresh file)
  remote absent WITHOUT tombstone              → PUSH (hub never had it or lost it — DDR-076 generalized: absence is never authority)
  remote TOMBSTONE at seq>cursor:
      local==ancestor → delete locally INTO _trash/ (quarantine-never-unlink)
      local!=ancestor → edit-beats-delete: keep local, push it back (Syncthing rule)
```

Wire mtime is demoted to display. **F4 is fixed by construction**: a hub-asserted far-future mtime can no longer win an overwrite; only "remote moved while local didn't" (provenance from the local ancestor) can.

## 3. Protocol (routes and wire changes)

| Surface | Change |
|---|---|
| `GET /api/journal?since=<seq>&epoch=<id>` | NEW. Peer-token gated, scope-filtered, rate-limited. Returns `{epoch, head, entries[]}`, or `{reanchor:true, epoch, head}` when `since` predates compaction, epoch mismatches, or `since > head` (restore rewind). `since` doubles as the applied-cursor ack; hub records it per peer label → `GET /api/journal/peers` |
| `GET /api/journal/peers` | NEW. `{peers:[{label, cursor, updatedAt}]}` + per-path `mirrored` — the hub half of the receipt |
| `POST /api/journal/report` | NEW, loopback pairing token only. Studio child announces its own file-lane writes; hub verifies by hashing disk itself |
| `PUT /assets/<key>`, `PUT /_asset-file/<rel>` | KEPT byte-for-byte in admission (shape gates, classifier via `resolveCheckoutFileWrite`, realpath-parent write, caps). Additions: journal append on 2xx; response body gains `{seq, sha256}` (old clients ignore bodies — skew-safe); `/_asset-file/` accepts optional `x-maude-expect-hash` CAS precondition → 409 when the path's journal head hash differs → pusher re-fetches journal and re-decides. Content-addressed `/assets/` keys are immutable so CAS is unnecessary there; the hub records the FULL sha256 of received bytes so pull-side verification is exact even though the key carries only sha8 |
| `GET /_project-file/<rel>`, `GET /assets/<name>` | KEPT. Receiver verifies fetched bytes against the journal's sha256; mismatch = refuse + loud (hub may refuse to serve, can never substitute) |
| `POST /_asset-probe` | Compat shim answering from checkout only, then DELETED after the desktop skew window |
| WS poke | NEW reserved per-project doc `_files` (via the DDR-192 doc-name resolver; one extra pinned room, negligible vs the 500 ceiling). Hub: `server.documents.get(filesDoc)?.broadcastStateless('{"t":"files","head":N}')` after every journal append. Server→peer only; payload-free beyond the head seq — a dropped or duplicated frame costs latency, never correctness. Peers attach one extra provider over the already-multiplexed socket: desktop over its existing hub socket, the cell's studio child over its existing loopback pairing socket. Zero new auth surface; receivers shape-validate `{t, head:number}` and can at most trigger one rate-limited authenticated journal fetch |
| Canvas-origin exposure | NONE. Journal routes join neither `CANVAS_SAFE_API` nor the canvas `routes` map (DDR-088 two-allowlist rule; pinned by the existing gate test) |

## 4. Event flow — one append, three subscribers (the receipt IS the event log)

```
write door accepts bytes (any door, any process)
  └─ recordWrite → journal row {seq}
       ├─ (a) broadcastStateless {head} ──► desktop: debounced 250 ms → GET /api/journal?since → decideFile per entry
       │                                       → pull bytes (sha-verify, .part+rename) → advance ledger
       │                                       → synthetic fs:any announce → local HMR heal (css/module/meta/asset)
       │                                  ──► cell studio child (loopback provider): bytes already on the shared disk
       │                                       → verify present → synthetic fs:any → canvas-hmr asset/css heal to open tabs
       ├─ (b) write-behind queue ──► R2 mirror → mirrored_at_ms (loud + 60 s retry, DDR-224 posture kept)
       └─ (c) cursor bookkeeping ──► /api/journal/peers (the receipt)
```

- **The container watcher gap becomes structurally irrelevant**: the child no longer learns about hub-process writes from `fs.watch` — it learns from the same journal event that constitutes delivery. `announceWrite` generalizes from "projection writes only" to "every materialization the sync system performs" on both ends; `fs.watch` retains exactly one job — noticing writes by processes *outside* the sync system (user's editor, agent tools) — and stays backed by the slow reconcile because watchers are hints.
- **Echo suppression by construction**: a pulled file's `fs:any` echo hits the push half, which finds `localHash == syncedHash` → no push. The ledger replaces the probe-guard, the `known.has` sweep skip, and the fast-pull heuristics. `echo-guard.ts` survives solely for the doc-lane doc↔file mirror, where it belongs.
- **Reconciler demotion**: the 20 s poll relaxes to a 60 s cursor check (`GET /api/journal?since` returning empty = one cheap request). It also counts "poke misses" — work found by reconcile that an event should have delivered — as an honesty metric, so silent event loss is observable (no-silent-failure invariant).

## 5. Single cold-start implementation (doc lane, change 3)

New `apps/studio/sync/cold-start-apply.ts`: the *application* bodies for `decideColdStart` / `decideAnnotationsColdStart` results — snapshot-before-overwrite, DDR-102 fail-closed refusal when the loser's snapshot didn't land, journal checkpointing, per-lane stamp-in-same-transaction, comments union, css-follows-body, meta merge — extracted once, parameterized by two thin ports (`DocPort`: seed/apply into Y types; `DiskPort`: writer or projection's `write*IfChanged`). One **exhaustive switch with a compile-time `never` default**, so a new action variant refuses to compile until both architectures handle it. `agent.reconcile()` and `migrateSeed()`+`projection.reconcile()` become callers.

Fixes the live drift on day one: migrate-seed's switch currently lacks `recover-seed-dup` and a default — in shared-doc mode that decision falls through to hub-wins and materializes the duplicated body. The pure tables in `cold-start.ts` are untouched (immutable per DDR-102/223); only the twin application bodies collapse.

## 6. Delivery-state model — the doručenka

"Is file X delivered everywhere?" becomes a table lookup:

| Checkmark | Source of truth | Positive assertion (DDR-214: fail-closed, pessimistic default) |
|---|---|---|
| **na hubu ✓** | journal head row for path, sha256 == the hash the pusher sent (returned `{seq, sha256}`) | pusher's ledger row `synced` with that seq |
| **durable ✓** | `mirrored_at_ms` set on that row (R2 write-behind ack) + the row rides hub.db backup generations | |
| **u peerů ✓** | every known peer's cursor ≥ that seq (`/api/journal/peers`); a peer past the seq has terminally applied or loudly conflicted (both visible in ITS ledger) | |
| **UI healnuto ✓** | per-node: the heal subscriber emitted its broadcast after materialization (`healedAt` in ledger / child consumer log). Honest scope: "heal event emitted on that node", not per-browser-tab render confirmation |

Surfaces: `_sync.json` gains a `ledger` summary (counts per state + oldest pending + last failure verbatim); the Sync panel reads it over the existing `sync:status` broadcast; per-file drill-down via a small `GET /_api/sync-file?path=` that joins the local ledger with `/api/journal/peers`. Refusal still outranks unreachability outranks any count (presentation.ts rule reused). This is DDR-214's rejected "Connect Run sheet" ledger, shipped now that its named revisit trigger has fired.

## 7. Security & invariants (delta view)

Everything hub-supplied remains hints + untrusted input: journal paths are re-shape-validated and re-classified locally (drop on disagreement — the shipped `pullFiles` posture, kept verbatim); bytes are re-hashed against the journal sha256; owner gate on `code-module` stays local; no presigned URLs (same authenticated proxy); consent boundary stays the 0600 per-machine token; CI kill unchanged; tombstones can only touch classifier-admitted paths and only quarantine, never unlink. New caps: F6 aggregate per-pass byte budget (loud). The F1–F6 flip gate runs as a hard gate before the flag flips (increment 4): F1 → untrusted-data markers extended to all file-lane pulls; F2/F3 → empty-tree in-group `.css` default + config-seed-before-first-pull ordering pinned by test; F4 → fixed by construction (three-way); F5 → already fixed + regression-tested; F6 → shipped in increment 0.

## 8. Scenario walkthroughs

**Fresh link (rich desktop ↔ empty cell).** Desktop links; no ledger → re-anchor pass: `GET /api/files` (empty) + no tombstones → every local file-lane file is "remote absent, no tombstone" → PUSH all (DDR-076 generalized: emptiness never wins). Each 2xx returns `{seq}` → ledger rows `synced`; journal pokes fan out → cell child heals tabs as bytes land (no reload storm — per-file `asset` heal, DDR-224). Inverse (fresh desktop clone ← rich cell): everything pulls, sha-verified, `.part`+rename, announce → local heal. Both-rich-common-ancestry: hashes mostly equal → noop; genuinely differing files → conflict-aside (local parked in `_trash/`, remote adopted, loud row) — no silent loss, recoverable, user-resolvable from the panel. Canvas bodies ride the doc lane exactly as today.

**Offline edit on both sides + reconnect.** Desktop edits `system/ds/brand.css` offline (L1, ancestor A); cloud user edits the same file via studio (R1, journal seq++). Reconnect → poke or 60 s reconcile → entry R1: local L1≠A and remote R1≠A → CONFLICT: L1 parked as `_trash/system/ds/brand.css-conflict-<ts>`, R1 adopted (sha-verified), ledger row `conflict` + Sync panel row + loud log. Nothing silent, nothing lost, both endpoints see the conflict. If only desktop had edited: ancestor==remote → clean push (CAS precondition passes). Canvas bodies: CRDT merge as today; annotations: per-lane stamps as today (DDR-223 untouched).

**Cell container restart mid-transfer.** (a) Dies mid-PUT: temp file discarded (tmp+rename), no journal row → pusher's ledger row stays `push-pending` with reason → idempotent retry on reconnect. (b) Dies after write but before backup, disk wiped: rehydrate restores an older hub.db generation → journal head rewinds below the desktop's cursor → `reanchor:true` → desktop re-anchors via manifest against its intact ledger: for the lost files, ancestor==local and remote absent without tombstone → RE-PUSH heals the cloud automatically and loudly. The absence-vs-tombstone distinction is what makes "cell lost recent writes" self-healing without ever deleting local content — the exact class that cost files in the v0.60.6 rollout, now structurally closed. Journal + docs + checkout ride one backup generation, so no mixed-generation skew.

**50 MB video drop (desktop).** Drop → `POST /_api/asset` writes `assets/<sha8>.mp4` → `fs:any` → 400 ms settle → hash (~100 ms, stat-cached thereafter) → ledger: remote absent → `PUT /assets/<sha8>.mp4` (streamed; existing budget 60 s + bytes@100 kB/s ≈ 560 s ≤ 10 min cap; `connection: close`; Retry-After honored) → journal seq N, response `{seq}` → ledger `synced` → poke → cell child: bytes already on shared disk → `asset` heal re-points the broken `<video>` in open cloud tabs within ~1–2 s of upload completion; second desktop pulls sha-verified via its own poke. Write-behind mirrors to R2 → `mirrored_at_ms`. Receipt shows all four checks. Mid-stream failure at 30 MB: no row, no poke, `push-pending` + retry. Today's minutes (debounce→spawn→full-walk) become upload-time + seconds.

**Delete on one side (increment 6).** Desktop deletes `system/ds/old-logo.png`: scan sees local absent, ancestor==remote → push tombstone → journal row `{deleted:1}` → poke → cell parks its copy in `_trash/`, child broadcasts heal; git history + `_trash/` + R2 both retain the bytes. Reverse direction symmetric. Edit-beats-delete: a peer whose copy moved past the ancestor keeps it and pushes it back. **Mass-delete circuit breaker**: >10 files or >25 % of ledger'd files vanishing in one scan window ⇒ tombstone pushes pause, rows go `delete-held`, Sync panel asks "87 files vanished locally — propagate deletion, or restore from cloud?" — the branch-switch hazard that made Plane-B v1 refuse deletion propagation entirely is handled by a breaker instead of by giving up the iCloud mental model. Until increment 6 ships, absence propagates nothing (today's posture); canvas deletes keep their shipped doc-tombstone lane throughout.

## 9. The four surgical changes → files (what dies / what stays)

**(1) Event-driven notify** — NEW: `apps/hub/src/journal.mjs`, `_files` doc in doc-name resolver, stateless subscribe in `sync/index.ts` + studio-child consumer. DIES: 20 s poll as primary trigger (demoted to 60 s reconcile), `requestFastPull` + `REFERENCE_FILE_RE`, the `announceWrite` cell-pairing special-case (generalizes), the hub→child invisibility class. STAYS: `pollRemoteSoon` reconnect nudge, HMR broadcaster + `asset` heal mode (becomes the subscriber).

**(2) One serving store** — CHANGED: `asset-lane.mjs` → ~150-line journal-driven write-behind queue (covers all file-lane classes); probe route → checkout-only compat then deleted. DIES: `sweepAssets`/`sweepNew` scheduling, "present = both" semantics, `handleAssetProbeRoute` (eventually). STAYS: checkout-first GET with bucket fallback (boot-window read-repair, monitored so post-boot fallback hits alert as drift), hydrate, backup generations, `streamToFile`, all door admission logic.

**(3) One cold-start applier** — NEW: `cold-start-apply.ts` (mostly moved lines). DIES: the twin application bodies' divergence (incl. the live migrate-seed `recover-seed-dup` fallthrough). STAYS: `cold-start.ts` pure tables, `journal.ts` (doc), snapshots, DDR-102 fail-closed.

**(4) Classifier as sole membership authority** — PROMOTED: `file-membership.ts` (+ hub `.mjs` mirror + tripwire, unchanged — the frozen-lockfile twin stays, honestly noted as retained debt). DIES: duplicate jurisdiction (asset lanes vs file plane), `listPushableAssets` flag-OFF restriction, `asset-pull`'s separate membership vocabulary. STAYS: receiver-side re-classification, owner gate, `never`-class protection of runtime state + `config.json`.

## 10. Scariest risk (named honestly)

**The ledger is a new place to be wrong about who moved.** The three-way's push arm (`ancestor==remote && local moved → PUSH`) overwrites the hub copy; a bug in ancestor bookkeeping — advancing `syncedHash` before a materialization actually verified, or a re-anchor path mis-carrying ancestors across an epoch change — would make the mirror a confident overwriter, recreating the eraser class in the new lane with better logging. Bounded by: (a) CAS precondition on path-addressed PUTs — the hub refuses (409) any push whose expected head hash is stale, so a wrong ancestor degrades into a visible conflict, not a silent win; (b) ancestor advances ONLY after sha-verified rename; (c) `decideFile` is pure and property-tested (including the fresh-link, rewind, and tombstone matrices); (d) every overwrite on either end quarantines the loser first (hub side: git history + R2 + `_trash/`; desktop: `_trash/`), so the worst realized outcome is recoverable substitution plus noise, never local destruction. Residual accepted: a CAS-passing wrong push can still land once per path before anyone notices — recoverable, but it would spend user trust; this is why increments 3–4 carry the longest soak. Secondary named risk: moving boot-reconcile hashing in-process brushes the DDR-222 SIGSEGV wall — mitigated by stat-cache (re-hash only changed files → steady-state boots hash ~0 files), per-file yielding, and the child-process pattern kept on the shelf as the named fallback if the crash class reappears.

## MIGRATION
# Migration from v0.60.7 — strangler increments, each independently shippable

Version-skew ground rules for the whole sequence: hub + cell ship together (same image tag), so the only skew axis is desktop↔hub. Every increment keeps the v0.60.7 desktop working against the new hub (doors unchanged; probe kept as compat; new response fields ignored by old clients; journal append is idempotent so an old desktop's redundant sweep re-uploads produce zero churn/pokes). Every increment keeps sync working end-to-end on its own.

## Increment 0 — cleanup + groundwork (zero behavior change)
- **Changes:** delete desktop `autocommit.ts` + `editorOf`/writer-wrap/stop-flush wiring (verified dead: `createAutoCommit` unreachable past index.ts:403). Extract `cold-start-apply.ts`; `agent.reconcile()` and `migrateSeed()`+`projection.reconcile()` become callers; exhaustive switch with `never` default; fixes the live migrate-seed `recover-seed-dup` fallthrough; add the both-callers-import-one-module drift tripwire test. Add F6 aggregate byte budget (loud) to `pullFiles` + `pullAssets`.
- **Files:** `apps/studio/sync/{autocommit.ts✝, index.ts, agent.ts, migrate-seed.ts, projection.ts, cold-start-apply.ts＋, file-pull.ts, asset-pull.ts}` + tests.
- **Rollback:** git revert; no wire or schema change.

## Increment 1 — hub journal, dark (additive)
- **Changes:** `file_journal` table + epoch in hub.db; `recordWrite()` wired into the existing `onWritten`/`onAssetWritten` hook sites (server.mjs:702/741/406) with same-hash no-op; boot-scan reconcile after seed/hydrate/sweepAll journals disk truth; `GET /api/journal?since&epoch` + peer-cursor recording; PUT doors return `{seq, sha256}`; `POST /api/journal/report` (loopback pairing token; hub re-hashes disk itself). Nothing consumes any of it yet.
- **Files:** `apps/hub/src/{journal.mjs＋, server.mjs, assets.mjs, file-manifest.mjs}`, `apps/studio/studio-child`-side report hook.
- **Rollback:** remove routes/table; zero clients depend on it.

## Increment 2 — the poke; the watcher gap dies (first user-visible win)
- **Changes:** reserved `_files` doc in the doc-name resolver; hub `broadcastStateless({t:'files', head})` after every journal append. Cell studio child attaches a provider to `_files` over its existing loopback socket: on poke → fetch journal since cursor → bytes already on shared disk → synthetic `fs:any` (generalized `announceWrite`) → existing `canvas-hmr` asset/css heal. Desktop attaches too: poke → immediately trigger the EXISTING `pullAssetsOnce`/`pullFilesOnce` instead of waiting for the 20 s tick; poll relaxes to 60 s reconcile + poke-miss counter.
- **Why this order:** it fixes the ground truth's live complaint ("bytes arrive, cloud tab shows a broken glyph until manual reload") with the smallest possible change, before any decision-logic changes.
- **Files:** `apps/studio/sync/{index.ts, doc-name.ts}`, `apps/hub/src/{server.mjs, journal.mjs}`, studio-child wiring, `hmr-broadcast.ts` (consumer unchanged, new producer).
- **Rollback:** `MAUDE_NO_FILE_EVENTS=1` on either end degrades to today's poll cadence; pokes are payload-free so any mixed old/new pairing is harmless.

## Increment 3 — ledger + three-way on desktop (F4 dies; doručenka appears)
- **Changes:** `file-ledger.ts` (ancestor rows, cursor, stat-cache) + pure `decideFile`; `pullFiles` decision upgraded from LWW-wire-mtime to three-way (everything else in its loop — classify-first, drops, containment, quarantine, caps — kept verbatim); journal-cursor-driven pulls with re-anchor on epoch/compaction/rewind; push half: `fs:any` → classifier → hash → ledger → PUT with `x-maude-expect-hash` CAS (hub 409s stale pushes); `queueFastPush` internals swap to the ledger check; probe-guard deleted; per-file rows into `_sync.json` + Sync panel receipt (hub ✓ / durable ✓ / peers ✓ / healed ✓ via `/api/journal/peers` + `mirrored_at_ms`).
- **Files:** `apps/studio/sync/{file-ledger.ts＋, file-lane.ts＋(pull=evolved file-pull.ts, push=transport core of asset-push.ts), index.ts, status.ts, presentation.ts}`, panel UI, `apps/hub/src/assets.mjs` (CAS).
- **Rollback:** `MAUDE_FILE_LEDGER=0` falls back to v0.60.7 decision paths for one release; the ledger file is runtime state — deleting it forces a safe re-anchor.

## Increment 4 — F1–F6 gate, flag flip, the great deletion
- **Changes:** run `/flow:validate-security` as the hard F1–F6 gate (F1: untrusted-data markers extended to file-lane pulls; F2/F3: empty-tree `.css` default + config-seed-before-first-pull pinned by test; F4: structural via inc 3; F5: already fixed; F6: inc 0). Flip `syncFiles` default ON (per-project opt-out stays). Remove the flag-OFF membership restriction — the classifier is the sole oracle. DELETE: `asset-pull.ts`, `asset-sweep.ts`, `asset-push-worker.ts`, sweep/fast-pull/index wiring, `requestFastPull`, probe calls. `asset-push.ts` shrinks to the file-lane transport core (putWithRetry, `connection: close`, budgets, routeFor). Hub: probe route becomes checkout-only compat; bucket sweeper replaced by the journal-driven write-behind queue (all file-lane classes; fixes the `system/**/assets/*` durability hole).
- **Files:** listed deletions + `apps/hub/src/asset-lane.mjs` rewrite (~458→~150), `server.mjs` plumbing.
- **Rollback:** the scariest increment, so: hub keeps every old route live (doors byte-identical, probe compat) — rollback = reinstall the previous desktop build against the SAME hub; ledger/cursor are runtime state old code ignores. Cell-side sweeper rewrite is guarded by keeping `sweepAll` callable behind `MAUDE_LEGACY_SWEEP=1` for one release.

## Increment 5 — receipt polish + restore-drill hardening
- **Changes:** per-file drill-down endpoint + panel; extend the DDR-194 restore drill to assert journal-epoch behavior (backup → wipe → rehydrate → desktop re-anchor re-pushes lost tail, e2e); alert when the GET bucket fallback serves post-boot (store-drift detector); delete the probe route once the desktop fleet is past inc 4.
- **Rollback:** cosmetic/observability — revert freely.

## Increment 6 — delete propagation (iCloud semantics completed)
- **Changes:** journal tombstones; ancestor-gated apply (edit-beats-delete); `_trash/` quarantine both directions; mass-delete circuit breaker (>10 files or >25 % ⇒ pause + Sync-panel prompt); `linkedHub.propagateDeletes` (ships ON with the breaker; OFF restores today's absence-propagates-nothing).
- **Files:** `apps/studio/sync/{file-lane.ts, file-ledger.ts, tombstone-apply.ts(extend)}`, `apps/hub/src/journal.mjs`, panel prompt.
- **Rollback:** flag OFF; tombstone rows are inert to old clients.

## Increment 7 — OPTIONAL epilogue: one architecture
- **Changes:** desktop defaults to `MAUDE_SHARED_DOC=1` (the projection+migrate-seed path cells run in production today); after a release of soak, delete `agent.ts`, the two-doc relay observers, and queuedOps agent-origin wiring (~800 lines). Cold-start callers: 2 → 1.
- **Rollback:** env flip back; `agent.ts` is deleted only one release after the default flip.

**Sequencing rationale:** 0–2 are low-risk and front-load the two live pains (drift-prone twin cold-start, invisible cloud writes); 3 introduces the only genuinely new semantics behind a fallback flag; 4 deletes code only after its replacement has soaked under real dogfood; 6–7 are separable and individually optional. At every point between increments, the system is a strict superset (new primitives dark or additive) or a documented flag away from the previous release's behavior.