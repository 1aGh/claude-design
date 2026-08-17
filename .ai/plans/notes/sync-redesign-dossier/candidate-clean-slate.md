# Ledger (clean-slate)
VERDICT: fixable
EFFORT: XL — ~8–10 focused engineering weeks spread across 6 releases (M1 ≈ 1 wk, M2 ≈ 2, M3 ≈ 2, M4 ≈ 1, M5 ≈ 1, M6 ≈ 1–2, plus soak time between releases; calendar ~2.5–3 months). Net LOC ≈ −1,800 to −2,400: ~3,850 deleted (desktop ~2,650 incl. agent.ts in M6 + dead autocommit.ts; hub/cell ~1,200) vs ~1,600–1,900 new (journal.mjs ~300, ledger decide/apply/outbox/ancestor ~750, control-doc+poke plumbing ~220, doručenka/status ~250, delete guard ~120, index-worker rewrite ~120). M1 alone (1 week) retires the live user-facing bug and the 20 s latency.
PITCH: Every non-CRDT file in .design/ moves through ONE hub-ordered, content-addressed journal: writes append a {seq, path, hash} row, a payload-free poke rides the already-open Hocuspocus socket, and every consumer — peer pull, browser heal, R2 durability, git autocommit, the per-file delivery receipt — is a subscriber of that same event. CRDT docs keep doing the one thing they're uniquely good at (live concurrent editing); sweeps, fast lanes, polls, probes, watcher bridges and both asset lanes collapse into the journal, and "is file X delivered everywhere?" becomes a cursor comparison instead of archaeology across four logs.
FATAL: []
FIXABLE: ["JOURNAL-ONLY TRUTH vs UNINSTRUMENTED CHECKOUT MUTATIONS (mandatory before M2). The design replaces today's walked manifest (apps/hub/src/file-manifest.mjs:141-204) with journal compaction and asserts 'remote state without a journal row cannot exist'. False on the hub itself: repo-checkpoint/admin git restores, any missed child write site, and class flips (deleting ui/foo.tsx silently flips ui/foo.css from canvas-owned to ledger-class with no write event) mutate the checkout with no row. Concretely in the migration: studio-proxy's onAssetWritten hooks are ARG-LESS fire-and-forget (studio-proxy.mjs:295,375,571 — no path/hash), and photo-edit/generate/export child write sites have NO hook at all until M3 — so M2's journal-driven pull silently loses browser-side writes (e.g. assets/<sha8>.photo.json) that today's manifest walk carries for flag-on projects. Consequence chain: checkout ≠ journal → hash-verify on pull fails → row goes loud+stuck forever, or divergence is simply invisible. Fix (in-idiom, cheap): keep a permanent hub-side reconciler — periodic checkout walk diffed against the compaction, appending 'walk-import' rows (the walk machinery already exists in file-manifest.mjs). Without it the design's invariant-1 claim ('unstamped emptiness structurally impossible') is overreach.", "JOURNAL/CAS TAIL DURABILITY ON EPHEMERAL CELLS (mandatory with M4 at latest). Cell disk is ephemeral and restore-from-generation is the NORMAL wake path (rehydrate.mjs:14-19; cell-do.mjs ~186-232), backups run on a 6h interval with NO generation taken on SIGTERM (server.mjs:313, shutdown at 2541-2562 flushes the git commit only). Every sleep (sleepAfter ~20min idle) therefore loses up to 6h of journal tail + checkout. Peers re-push what they hold — but a browser-only upload with no desktop peer online becomes an orphaned CAS object with NO row: bytes durable, permanently invisible (design has no CAS→journal recovery). This REGRESSES v0.60.7, where boot hydrateAssets restores from the bucket independently of generations (server.mjs:2470-2497) and the walked manifest re-lists it. Fix: write-behind the JOURNAL itself to R2 per append (tiny NDJSON tail) and/or take a generation on SIGTERM; replay tail at rehydrate before epoch decisions.", "DELETION TABLE IS INCOMPLETE AND SELF-CONTRADICTORY (mandatory before M4). decideFile has no row for local-absent + ancestor-present + remote-present (the 'I deleted it while the watcher wasn't running' case), and §5 categorically bans inferring deletes from absence in any scan. As written, every delete whose unlink event is missed (app closed, crash, offline session) is resolved by the 'creation; absence ≠ delete, EVER' row → the file RESURRECTS. Worse, this is ROUTINE on cells: every wake restores a ≤6h-old journal, so tombstones in the lost tail resurrect their files on the forced three-way. Fix: adopt the Syncthing rule — ancestor==remote && local absent ⇒ propagate delete, gated by the existing max-delete guard (which already covers the branch-switch hazard the ban was protecting against).", "MIXED-VERSION / SELF-HOSTED-HUB COMPAT MATRIX MISSING. (a) M1 relaxes the 20s poll to 120s unconditionally while pokes only exist on new hubs — desktop 0.61 against a 0.60.x self-hosted hub regresses cloud→desktop latency 20s→120s; needs hub-capability detection. (b) Attaching ctl/<ws>/<branch> to an old hub creates a persisted phantom LEGACY doc: parseDocName is 4-segment ws/-only (doc-namespace.mjs:75-83) and DOCUMENT_NAME_REGEX admits slashes (server.mjs:137), so the name is accepted as a flat canvas, stored in SQLite, listed in admin. (c) M5 deletes old doors and old pull lanes with only a one-release dormancy: not-yet-updated 0.60.x desktops push into deleted doors, and new desktops against old self-hosted hubs (GET /api/journal → 404) can pull nothing once asset-pull/file-pull are gone — keep a manifest-walk fallback and state the support window. (d) Narrow-scoped tokens (scope 'ws/<id>' prefix match, tokens.mjs:283-287) will never match 'ctl/...' → sticky auth-reject per DDR-214; the ctl admission rule must map scopes.", "M1'S CELL-SIDE HEAL IS GATED ON THE LIVE-PAIRING PILOT ALLOWLIST. The 'existing loopback provider' the cell child would consume pokes with exists only for CELL_LIVE_PAIRING tenants (wrangler.toml: currently 'alligators'; cell-pairing.ts refuses otherwise, per DDR-213/DDR-209). 'The container watcher gap dies here, with zero desktop changes' is true for the pilot tenant only; the fleet needs either a ctl-only loopback attach outside the pairing gate or widening the allowlist first.", "DDR-222 REGRESSION RISK: MASS TRANSFER MOVES BACK IN-PROCESS ON AN UN-ROOT-CAUSED SEGFAULT. Today the out-of-process child performs the PUTs too (asset-push-worker.ts runs pushAssets — walk+hash+probe+transfer), because the in-process sweep segfaulted Bun 1.3.3 beside the dev server and 'nobody has a fix for the fault itself, so the boundary is the fix' (DDR-222). The design keeps only walk+hash in the child and drains a potentially 182+-file outbox in-process, citing DDR-225's single-fetch qualification — which covered ONE file per event, not a fresh-link/resync drain. Keep the drain out-of-process above a small threshold until the fault is attributed.", "M6 ROLLBACK CONTRADICTION. M6 both deletes agent.ts + two-doc wiring AND offers 'rollback: env flag back to two-doc for one release' — you cannot flag back into deleted code. Ship the flag-flip in M6 and the deletion one release later (M7), matching the design's own one-release-dormancy rule.", "SECURITY CLAIMS NEED TWO CORRECTIONS. (a) 'Owner gate survives unchanged at BOTH the hub door and receiver apply' — the hub door has NO role gate today: handleCheckoutAssetRoute admits any valid peer token for code-module writes (assets.mjs:595-660; resolveCheckoutFileWrite checks class only, file-manifest.mjs:309-317); the receiver-side gate is the only one (file-pull.ts:197-199, index.ts:528). Adding a door-side role gate is an improvement but is NEW work — schedule it and confirm verifyToken's match exposes role. (b) The F1 mitigation (hub-synced system/** docs read by design agents as authoritative spec → indirect prompt injection; recorded pre-flip gate requires treating synced docs as delimited untrusted DATA — feature-sync-file-plane.md:366-374) is agent-side work the plan never schedules; as recorded, the M2 gate would fail and block the M5 default-ON.", "DORUČENKA CAN LIE GREEN ON POLICY REFUSALS + CURSOR AUTHENTICITY. Policy-refused rows advance the cursor (must, to avoid wedging), so 'at-peer P: cursor(P) ≥ S' reads delivered for files the peer REFUSED — including the designed-in case of non-owner receivers refusing code-modules. Violates DDR-214's 'refusal outranks'. Fix: cursor reports carry a refused-set (or per-row ack bitmap). Also: /api/cursor must key the peer label from the authenticated token (match.label), never the body, or one peer can spoof another's cursor and fake 'everywhere'.", "SIBLING-CSS CLASSIFICATION IS TIME-DEPENDENT ACROSS PLANES (F2/F3 unaddressed). classifyProjectFile's css split depends on hasFile(<same>.tsx) (file-membership.ts:215-218). On fresh link the ledger apply can race plane-A materialization: css classifies companion-text while the tsx is in flight, gets pulled/journaled, then flips canvas-owned — leaving a permanently stale journal row (plane-A writes never journal, so compaction never supersedes it → drop+loud spam on every future fresh link) and a double-transport window on a CRDT-owned lane. The recorded F2/F3 hardening (empty-tree in-group css ⇒ canvas-owned) plus a walk-import class-flip supersede row closes it; the design mentions neither.", "BRANCH SEMANTICS UNDER-SPECIFIED. Journal rows carry branch (DDR-192) but peer_cursors has no branch column, the ancestor store files{} is not branch-keyed, and the hub's single checkout cannot apply PUTs for a non-checked-out branch — undefined whether they are refused, buffered, or misapplied. A desktop branch switch mass-diffs every file against a wrong-branch ancestor. Key the ancestor store per (hub, branch) and define the hub's non-checkout-branch PUT answer (refuse loud).", "HEAD-OF-LINE BLOCKING, BOTH DIRECTIONS. Pull: IO-failure BLOCKS the cursor at that row by design — one permanently failing 100MB fetch (or full disk) stops ALL later files forever; ordering is only needed per-path, so park-and-skip per path with loud status. Push: one serialized outbox means a 100MB video on a slow uplink delays every small edit behind it (~3min at 5Mbps) — a regression vs v0.60.7's fast-lane-beside-sweep; use size-classed queues or bounded parallelism. Also note the 100MB PUT cap sits exactly AT the Cloudflare zone body limit (Free/Pro plans) — a 100MB body 413s at the edge before the hub's own cap fires.", "SMALLER AMENDMENTS: (1) crossing writes (both sides edit the same mutable path within the poke window) produce a spurious, PROPAGATING .conflict file depending on 200-ack vs journal-row arrival order — treat a remote row whose hash equals an in-flight outbox entry as self; (2) epoch re-mint on EVERY restore makes the full three-way a multiple-times-daily event per peer given sleepAfter — acceptable but quantify, and correct the walkthrough's false 'warm restart: journal + checkout intact' claim for cells (disk is ephemeral; warm restarts exist only self-hosted); (3) hostile-hub poke/reset spam drives repeated client full-reconciles — add a client-side reset cooldown; (4) journal table growth in hub.db is unbounded with no compaction story (backups VACUUM INTO it); (5) conflict-aside filenames embed the hostname and propagate into the shared tree (mild privacy leak); (6) desktop ledger-apply should stream-to-disk — today's file-pull buffers whole bodies up to 512MB in memory (file-pull.ts:272)."]

## DESIGN
# Ledger — one journal, one file plane, everything else subscribes

## 0. The boundary: what is a doc, what is a file

A payload rides the **CRDT plane** iff two people editing it concurrently should BOTH win inside one artifact — i.e. it has real merge semantics: character-level text merge (canvas body, sibling css), id-union (comments), keyed LWW map entries (annotations svg + per-lane stamps, meta shared subset). Everything else is a **file**: concurrent edits mean two *versions* of an artifact, and prior art is unanimous (Syncthing, Dropbox, Unison, Mutagen, rclone, CouchDB) that file bytes are never master-master merged — the loser is renamed aside and propagated. So:

- **Plane A (kept)**: per-canvas Y.Docs over Hocuspocus — body/css/meta-subset/comments/annotations + `syncMeta` stamps. Untouched semantically; unified to ONE architecture in the last increment (desktop flips to shared-doc, `agent.ts` dies — finishing the DDR-064 cutover, never reversing it).
- **The Ledger (new, THE file plane)**: every VERSIONED non-canvas-owned file per the DDR-115 taxonomy, membership decided solely by the existing `classifyProjectFile` classifier (`apps/studio/sync/file-membership.ts` + parity-pinned hub mirror): `inert-media`, `companion-text`, `code-module` (owner-gated). `canvas-owned` → plane A only (disjointness enforced at classification, as today). `never` (config.json, all `_*` runtime state) → travels on nothing.

User mental model satisfied: the whole `.design/` folder is mirrored — canvases materialize via plane A's projection, everything else via the ledger, runtime `_*` stays local exactly like Dropbox ignores `.DS_Store`.

**Lanes after: 2** peer-facing sync lanes (CRDT docs + ledger). Git autocommit and the R2 mirror survive but stop being independent lanes with their own reconcilers — they become cell-local *subscribers of the journal* (see §4). **Stores after: 1** store of serving truth on the cell (the checkout); R2 is demoted to a write-behind durability archive (CAS + backup generations) with zero serving/probe semantics. **Cold-start implementations after:** files = 1 pure decision function with 1 apply site; docs = 1 apply site (projection/migrate-seed) after the final increment (2 until then, as today).

## 1. Data structures

### 1.1 The journal (hub-owned, the single ordering authority)

New SQLite table in hub.db (already SQLite via @hocuspocus/extension-sqlite; rides backup generations automatically):

```
sync_journal (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,  -- hub-local monotonic
  branch   TEXT,     -- ledger is scoped per branch, like doc names (DDR-192)
  path     TEXT,     -- designRoot-relative; validated by classifier AT APPEND
  hash     TEXT,     -- sha256 hex of content ('' never occurs; tombstones carry last-known hash)
  size     INTEGER,
  deleted  INTEGER,  -- 0|1 tombstone
  source   TEXT,     -- 'peer:<label>' | 'studio' | 'boot-import' — advisory/debug only
  ts       INTEGER   -- server clock, ADVISORY ONLY (F4: never a trust input)
)
journal_meta ( epoch TEXT )   -- random UUID minted at DB creation AND at every restore
peer_cursors ( label TEXT, epoch TEXT, seq INTEGER, healed_seq INTEGER, last_seen INTEGER )
```

Properties:
- **The manifest is the compacted journal**: `GET /api/files` becomes `SELECT latest-per-path WHERE deleted=0` — the existing endpoint survives byte-compatible (`{path, sha256, size, mtimeMs, class}`) plus `{epoch, head}`.
- **The journal row IS the edit stamp.** DDR-223 generalized: remote state without a journal row cannot exist, so "unstamped emptiness" is structurally impossible on the wire. A 0-byte file with a row is a *stamped, deliberate* truncation and is honored; absence of a row is never a delete.
- **Epoch = cursor validity domain** (Syncthing index_id / Dropbox cursor invalidation / CouchDB session check). Restore-from-backup mints a new epoch; any epoch mismatch or client-cursor>head forces the client down the full three-way reconcile path — a cell that "went back in time" can never be silently trusted via a stale cursor.
- Appending a path the hub-side classifier rejects (runtime state, `never`, malformed) is REFUSED loudly at the door — the journal can never carry a runtime-state path (tripwire test).

### 1.2 Peer ancestor store (the Synced Tree)

Per hub, per machine, under the runtime-ignored `_state/` dir (DDR-115: this is per-machine runtime state and must never itself sync): `_state/ledger-<hubId>.json`, atomic tmp+rename, debounced flush:

```
{ epoch, cursor,                       // last journal position FULLY applied
  files: { [rel]: { syncedHash, syncedSeq, size, mtimeMs } },   // ancestor + hash cache
  outbox: [ { rel, hash, size, op: 'put'|'delete', state, attempts } ] }
```

`files[rel].syncedHash` is Dropbox's Synced Tree / Mutagen's ancestor — "the content both sides last agreed on." `(size, mtimeMs)` doubles as the hash cache so reconciles stat-scan and re-hash only dirty files (same trick the hub manifest walk already uses).

### 1.3 The one decision function (files)

Pure, Y-free, unit-tested, ONE apply site (`ledger-apply.ts`), used identically at boot, on poke, and mid-flight:

```
decideFile(local: Hash|absent, remote: Hash|absent-or-tombstone, ancestor: Hash|absent) →
  local == remote                       → adopt        (ancestor := hash; noop on disk)
  ancestor == local  && remote differs  → pull         (remote changed; local didn't)
  ancestor == remote && local differs   → push         (local changed; remote didn't)
  ancestor absent    && one side absent → push|pull    (creation; absence ≠ delete, EVER)
  ancestor == local  && remote absent   → push         (hub regressed/lost it — re-seed up; DDR-076 posture)
  tombstone && local == tombstone.hash  → quarantine   (honored delete → _trash/, never unlink)
  tombstone && local != tombstone.hash  → revive       (edit beats delete; re-push local)
  all three differ (or no ancestor, both present, differing) → conflict-aside
```

`conflict-aside` (Syncthing semantics): the LOCAL copy is first written to `<name>.conflict-<yyyymmdd-hhmm>-<host><ext>` **and that write must land before the canonical path is overwritten** — if the aside-write fails, the pull is REFUSED and the row goes loud+stuck (DDR-102 fail-closed, verbatim). The conflict copy is an ordinary ledger file, so it propagates — both endpoints see both versions; nothing is ever silently lost. Deterministic winner of the canonical path = the hub-journal version (the only total order we have; never wire mtime — F4 dies here). Note: for content-addressed `assets/<sha8>.*` names, same-name-different-content is near-impossible by construction, so conflicts effectively occur only in `system/**` and companion text — small and visible.

## 2. Protocol (all on existing HTTP + existing WS; every route bearer peer-token gated, main-origin only, in NEITHER canvas allowlist)

| Verb | Route | Semantics |
|---|---|---|
| GET | `/api/journal?since=<seq>&epoch=<e>` | `{epoch, head, entries[], truncated}`; cap ~2000 rows, loud truncation; epoch mismatch or since>head → `{reset:true, epoch, head}` → client runs full manifest three-way. Entries are HINTS (DDR-054): receiver re-classifies every path, drops+logs rejects. Per-token rate bucket. |
| GET | `/api/files` | Kept — the compacted journal (cold reconcile + fresh link), + `{epoch, head}`. |
| GET | `/_project-file/<rel>` | Kept as-is (reviewed, no-oracle 404 posture). Client verifies fetched bytes hash to the journal row's hash — mismatch = refuse + loud (hub may refuse, can never substitute). |
| PUT | `/api/file/<rel>` | THE single peer write door (replaces `PUT /assets/<key>` + `PUT /_asset-file/<rel>`). Gate stack = union of today's lessons: scope; `isProjectFileShape` + classifier (flowing class only; code-module → owner gate); per-class extension allowlist (binary backstop against data→code); realpath containment writing to the RESOLVED parent; streaming tmp+rename with 100 MB cap + per-process byte budget; `x-maude-content-sha256` header re-hashed WHILE streaming, mismatch → 400; for `assets/<sha8>.*` the name↔content-hash agreement is verified (content addressing stays the security model). Idempotence: current hash == incoming → 200 `{seq: existing}` with NO new row (echo dies structurally). Optional `If-Match: <ancestorHash>` → 409 if hub moved (client re-decides). Response `{seq, hash}` = the push receipt. Transport scar tissue kept verbatim: `connection: close`, Retry-After honoring, size-scaled timeouts. |
| DELETE | `/api/file/<rel>` | Tombstone door: body carries last-known hash; hub quarantines its checkout copy to `_trash/`, appends `{deleted:1, hash}`. |
| POST | `/api/cursor` (or stateless msg) | Peer reports `{epoch, seq, healedSeq}` after each fully-applied batch → `peer_cursors`. |
| GET | `/api/delivery` | `{head, peers:[{label, cursor, healedSeq, lastSeen}]}` — feeds the doručenka. |

### 2.1 The poke (server push, payload-free — Pattern 4)

After EVERY journal append the hub calls `document.broadcastStateless(JSON.stringify({t:'ledger', head, epoch}))` on a reserved **control doc** `ctl/<workspaceId>/<branch>` (new top-level prefix beside `ws/` in the doc-name grammar + its hub mirror — cannot collide with any canvas slug; admitted read-only in `onAuthenticate` for the same peer tokens; nobody ever writes Y content into it). Verified available: @hocuspocus/server + provider 4.3.0 ship `broadcastStateless`/`sendStateless`/`onStateless` on both installed ends, currently unused. Pokes coalesce 250 ms per control doc. A lost poke costs latency, never correctness — the journal is the truth; a low-frequency reconcile (existing poll demoted to 300 s journal-diff) is the Syncthing-style belt.

Consumers of the SAME event:
1. **Desktop peer**: provider `onStateless` → `pullJournal(since=cursor)` → apply → local bus `ledger:applied` → (a) HMR heal of desktop tabs (asset re-point / css / module modes chosen from path class), (b) status-store receipt row, (c) echo-guard record so the watcher echo of the materialization never re-pushes. The macOS watcher stops being the delivery mechanism — it remains only for out-of-band writers (user's editor, agent tools).
2. **Cell's studio child**: its existing loopback provider attaches the control doc → same handler → synthetic `fs:any` + `canvas-hmr` heal to browser tabs. **This is the structural kill of the container watcher gap**: the writer (hub door) announces; recursive `fs.watch` is no longer the bus between two processes that both already know about the write. The ground truth §3 prime suspect (hub PUT lands, child never learns, tab shows broken glyph) cannot exist by construction.
3. **R2 write-behind** (hub-internal): journal subscriber uploads `tenants/<id>/cas/<sha256>` (+ retry queue, loud failures) — covers ALL ledger classes, closing the "new `system/**/assets/*` file neither committed nor swept" durability hole.
4. **Git autocommit** (hub-internal): journal subscriber stages the path — desktop-pushed assets finally get committed (today they're untracked and survive only via re-push).

One event, four subscribers, one truth. "Viditelnost ≠ doručení" dissolves because UI-heal and peer-notify are two subscribers of the same append the delivery receipt also reads.

### 2.2 One write door per node

On the cell, the studio child stops writing ledger-class files directly: its asset/API doors proxy bytes over loopback to the hub's `PUT /api/file/` (pairing-token; canvas-owned writes stay child-side on plane A). Every checkout mutation of a ledger file therefore journal-appends — an unjournaled write is structurally impossible, not a convention.

## 3. Client loops (desktop)

- **Up**: the single existing `fs:any` handler → classifier → stat/hash (cache) → `decideFile` → outbox enqueue → serialized in-process drain (one probe-free PUT per file — the journal + ancestor answer presence; DDR-225's qualification: single fetches are fine in-process). On 200, ancestor := hash; when the own-write journal row arrives, hash-equality recognizes it as self and the cursor advances with a disk noop — **echo suppression by hash equality, no timers, no probe-guard**.
- **Down**: poke (or reconnect, or 300 s belt) → journal diff → per row: re-classify path (drop+loud on reject, cursor still advances — a hostile hub cannot wedge the cursor with garbage), fetch, verify hash, tmp+rename materialize, conflict/tombstone rules per §1.3. IO failure BLOCKS the cursor at that row (retry + loud) — policy-refusal skips loudly, IO-failure never skips. Aggregate per-batch byte budget (2 GiB, loud) closes F6.
- **Boot / fresh link / epoch reset**: full three-way over manifest ∪ local tree. The initial full index (the ONE remaining mass-hash pass) runs in the existing spawned-child pattern (DDR-222 wall honored: the child now only walks+hashes+streams NDJSON rows; all decisions and transfers happen in-process per-file). Subsequent reconciles are stat-scans hashing only dirty files.

## 4. Cell stores & lifecycle

- **Checkout = the only serving truth** (DDR-224 completed). Probes die; presence questions are answered by the journal.
- **R2 = write-behind durability**: CAS objects `cas/<sha256>` (never GC'd — extends the assets-never-GC invariant) + backup generations (hub.db incl. journal + repo.bundle, manifest-written-last, unchanged).
- **Cold boot**: rehydrate restores newest complete generation (journal + epoch ride hub.db) → bind → missing-only CAS refill driven by the manifest (all ledger classes, not just top-level assets/). During refill, serving keeps the DDR-224 read-through (checkout-first, CAS-fallback that heals the checkout) as a boot-transitional path only — steady-state serving never touches R2. Restore mints a new epoch → every peer runs the three-way → anything the backup generation missed is re-pushed by the peers that have it (the `ancestor==local && remote absent → push` branch — the mirror heals itself).

## 5. Deletion (the one new user-facing capability)

Deletes propagate ONLY as explicit journal tombstones — never inferred from absence in any scan (the branch-switch mass-delete hazard stays structurally dodged). Desktop unlink events batch in a 2 s window → **max-delete guard**: >25 files or >20 % of the ledger in one window ⇒ hold + Sync-panel confirmation (rclone/Syncthing seatbelt); below it, `DELETE /api/file/` with last-known hash. Receivers apply a tombstone only when local hash == tombstone hash — an old delete can never beat a newer edit (edit revives, re-pushes, panel shows `revived`). Receivers ALWAYS quarantine to `_trash/`, never unlink. Canvas deletion stays on plane A's existing doc-tombstone lane.

## 6. Doručenka (delivery-state model)

Pure derivation, DDR-214-compliant (pessimistic default, refusal outranks unreachability outranks any count, `synced` is a positive assertion):

```
state(file with latest seq S) =
  conflict/stuck   if a loud row exists for it            (outranks everything)
  local-only       if in outbox, not yet acked
  pushing          outbox in flight (bytes %)
  on-hub           own ancestorSeq ≥ S                     (push receipt held)
  at-peer P        cursor(P) ≥ S                           (cursor advances only after fail-closed apply)
  ui-healed at P   healedSeq(P) ≥ S                        (heal emitted to connected tabs — named limitation: emission, not per-tab render ack)
  everywhere       min over known peers of cursor ≥ S ∧ healedSeq ≥ S
```

Surfaced as per-file rows in `_sync.json` + the Sync panel (`{path, state, seq, hash8, reason?}`), extending the existing status store/`sync:status` spine — the exact "na hubu ✓ / u peerů ✓ / UI healnuto ✓" the ground truth demands, answered by table lookup.

## 7. Mapping of today's 7 lanes

| Today | Fate |
|---|---|
| 1 CRDT doc lanes | **Kept** (plane A); single architecture + single cold-start apply site after the final increment |
| 2 Asset push sweep | **Deleted** — outbox drain + one-shot index child |
| 3 Fast-lane push | **Deleted** — the outbox IS per-file; no special case, no probe-guard |
| 4 Asset pull | **Deleted** — journal apply (reference-scanning want derivation dies, incl. its DS-substring 404 artifact) |
| 5 File plane (flag-OFF) | **Promoted** — its classifier, fetch/verify, quarantine posture BECOME the ledger; manifest = compacted journal; F1–F6 gate runs at its activation |
| 6 Cell bucket mirror | **Demoted** to journal subscriber (write-behind CAS; no probe/serving semantics, no independent reconciler) |
| 7 Git autocommit + rehydrate/backup | **Kept** as history/durability; autocommit becomes a journal subscriber (untracked-assets hole closed); dead desktop `autocommit.ts` deleted |

Three reconcilers (sweep, poll, rehydrate) → ONE reconcile primitive (journal/manifest three-way) invoked at boot, on epoch reset, and on a 300 s belt timer; rehydrate stays as the durability restore it always was.

## 8. Scenario walkthroughs

**Fresh link.** Connect WS → control doc attaches → `GET /api/files` (epoch, head) → index child hashes local ledger files once → three-way with empty ancestors: equal ⇒ adopt; local-only ⇒ push; remote-only ⇒ pull; both-present-differing ⇒ conflict-aside (no provenance ⇒ nobody wins in place — fail-closed, data-preserving; rare outside `system/**`). DS logos arrive first-class (no flag, no grey boxes); every arrival pokes → heals. Canvas docs do their existing plane-A handshake untouched. Panel shows per-file receipts going green; `cursor := head` ends the link with a positive assertion, not silence.

**Offline edit both sides + reconnect.** Desktop offline: edits `system/ds/tokens.css`, adds photo A. Cloud meanwhile: edits same tokens.css, drops photo B. Reconnect: journal diff shows tokens.css@seqN(hashR) + photoB; outbox holds tokens.css(hashL) + photoA. Photos: distinct content-addressed names — push A, pull B, zero interaction. tokens.css: all three hashes differ → aside-write `tokens.conflict-…-mbp.css` (must land), pull R to canonical, push the conflict copy; both sides now see both versions; panel: `conflict` with both paths. Nothing lost, nobody silently overwritten.

**Cell container restart mid-transfer (30/60 files pushed).** Every accepted PUT was tmp+rename + journal-append before 200, so nothing half-exists. Warm restart: journal + checkout intact; provider reconnects, poke delivers `{head}`, outbox resumes at 31; a re-PUT of an in-flight file is a hash-equal 200 no-op. Cold restart: rehydrate restores the generation (journal+epoch inside), epoch is re-minted → peers run the three-way → the ≤N files accepted after the last backup are simply re-pushed (`ancestor==local && remote absent → push`). No wedge, no loss, no duplicate.

**50 MB video drop.** Desktop: fs:any → inert-media → streamed hash → outbox → ONE streaming PUT (cap 100 MB, size-scaled timeout, connection:close) → `{seq}` → poke → cell child heals cloud tabs (asset re-point, no reload) within ~1 s of upload completion; other peers pull on the same poke. Panel: `pushing 42 %` → `on-hub` → `everywhere`. Browser-side drop: child proxies to the hub door → same journal path in reverse; desktop pulls on poke instead of on a 20 s tick.

**Delete on one side.** Finder-delete of `system/brand/old-logo.png` → unlink batch → under guard → `DELETE` with last-known hash → hub quarantines + tombstone + poke → peers: hash matches ⇒ quarantine to `_trash/` (never unlink) + receipt; hash differs (someone just edited it) ⇒ keep + re-push ⇒ file revives everywhere, panel says so. Mass delete (branch switch) ⇒ guard pauses propagation and asks.

## 9. Scariest risk (named honestly)

**The ancestor/cursor store is a new stateful component whose bugs invert the design's honesty.** If any code path advances `cursor` or `syncedHash` before the fail-closed apply fully lands, the doručenka *lies green* — the exact DDR-214 sin this design exists to kill — and a lost/corrupted ancestor file downgrades every divergent file to conflict-aside spam on next connect (safe, but a terrible morning). Mitigations that must ship WITH it, not after: ancestor+cursor mutate only in the same flush as materialize-completion; property tests on `decideFile` (it's pure); a crash-harness test that kills the process mid-batch and asserts idempotent convergence on re-run; `_sync.json` keeps raw counters so a lying panel is cross-checkable. Secondary risk, stated: journal-in-hub.db couples file-sync correctness to backup/epoch discipline — the epoch mint on restore is load-bearing and gets its own boot assert + test.

## MIGRATION
# Migration from v0.60.7 — strangler increments, sync never stops working

**M1 (v0.61) — Journal + poke, read side. Fixes the live bug first.**
- Hub: `sync_journal` + epoch in hub.db (`apps/hub/src/journal.mjs`, new ~300); append hooks inside ALL existing write doors (`PUT /assets/`, `PUT /_asset-file/`, studio-proxy parity hooks) — doors otherwise unchanged; `GET /api/journal`; control doc `ctl/<ws>/<branch>` admitted in `onAuthenticate` + doc-namespace grammar (both mirrors + parity test); `broadcastStateless` poke, 250 ms coalesced.
- Cell child: loopback provider attaches control doc → poke → synthetic `fs:any` + existing `asset` HMR heal. **The container watcher gap / "broken glyph until reload" dies here, with zero desktop changes.**
- Desktop: poke → existing `pullRemoteNow()`; 20 s poll relaxed to 120 s.
- Files: `journal.mjs` (new), `server.mjs` (+~60), `doc-namespace.mjs` + `doc-name.ts` (+prefix), `studio-child.mjs`/`sync/index.ts` (+~80).
- Rollback: `MAUDE_LEDGER=0` disables poke emission/consumption; all additions are additive routes/hooks.

**M2 (v0.62) — Ledger pull replaces asset-pull + file-pull.**
- Desktop: ancestor store (`_state/ledger-<hub>.json`), pure `decideFile` (new `ledger-decide.ts`, shares test style with `cold-start.ts`), single apply site (`ledger-apply.ts`) reusing file-pull's fetch/verify/quarantine code; journal-driven pull with hash verification, conflict-aside, F6 batch budget; cursor + honest per-row loud/skip/block semantics.
- **The F1–F6 security gate (`/flow:validate-security` HARD gate) runs here** — this is the file-plane activation event; `linkedHub.syncFiles` becomes "ledger on" (still opt-in this release).
- Deletion NOT yet propagated (parity with today). Old `asset-pull.ts`/`file-pull.ts` kept dormant one release behind the flag.
- Rollback: flag OFF → v0.60.7 pull paths.

**M3 (v0.63) — Outbox replaces sweep + fast-push; doručenka v1.**
- Hub: `PUT /api/file/<rel>` single door (internally the same streaming/validation code as the two old doors, which become thin delegates); `POST /api/cursor` + `GET /api/delivery` + `peer_cursors`.
- Desktop: outbox + serialized drain; sweep child demoted to hash-index-only worker (`asset-push-worker.ts` rewritten ~120); `queueFastPush`/`scheduleAssetSweep`/probe-guard wiring deleted; push receipts + per-file rows in `_sync.json` + Sync panel (status store extension).
- Cell: studio child ledger-writes proxy to the hub door (one write door per node).
- Rollback: env flag restores sweep+fast-push path (kept dormant this release).

**M4 (v0.64) — Deletes + durability subscribers.**
- Explicit tombstones + max-delete guard + revive rule; `DELETE /api/file/`.
- R2 write-behind becomes a journal subscriber covering ALL ledger classes (`asset-lane.mjs` rewrite ~90 net); autocommit subscribes to the journal (pushed assets finally committed); rehydrate's asset refill becomes manifest-driven CAS refill.
- Rollback: tombstone emission behind flag; subscribers are additive.

**M5 (v0.65) — Burn-down.**
- Delete: old PUT doors + `/_asset-probe`, `asset-pull.ts`, `file-pull.ts`, sweep transfer logic, fast-lane wiring, `requestFastPull`/`REFERENCE_FILE_RE`, `announceWrite` synthetic-fs inference (heal now poke-driven), bucket-fallback steady-state serving (read-through kept for boot restore only), desktop `autocommit.ts` (dead code today), 120 s poll → 300 s journal-diff belt.
- `linkedHub.syncFiles` default ON (gate passed in M2, soaked two releases).

**M6 (v0.66) — Doc-plane unification (independent, gated).**
- Desktop flips `MAUDE_SHARED_DOC=1` default ON (DDR-213 already closed the DDR-064 pre-cutover checklist on cells; re-verify the desktop-specific items); delete `agent.ts` + two-doc relay observers + agent-origin queuedOps wiring → ONE cold-start apply site (projection + migrate-seed), erasing the drift class (incl. the live `recover-seed-dup` fall-through asymmetry).
- Rollback: env flag back to two-doc for one release; `cold-start.ts` tables unchanged throughout.

Each increment ships alone, keeps yesterday's lane dormant-but-present for one release, and is reversible by flag. The riskiest user-visible moments (M2 activation, M5 default-ON) sit behind the recorded security gate and a soak.