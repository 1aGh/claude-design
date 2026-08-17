# Maude sync — final architecture (synthesis)

## 0. End-state accounting

| Question | Answer |
|---|---|
| Peer-facing lanes | **2** — (A) CRDT doc lanes, wire-unchanged; (B) ONE journal-driven file lane |
| Stores of serving truth on the cell | **1** — the checkout. R2 = write-behind durability (CAS + backup generations + journal tail); read only at boot hydrate and disaster restore |
| Reconcilers | **1 primitive** — journal/manifest three-way, invoked at boot, on epoch reset, and on a slow belt timer. Sweep, 20 s poll, and per-lane repair loops die |
| Cold-start appliers | **1 module** (`cold-start-apply.ts`) from Increment 0; one *caller* after the shared-doc epilogue |
| Echo mechanisms | 2 — origin tags (doc lanes) + hash-vs-ancestor equality (file lane). Probe-guard, disk-compare-announce, per-path announce timers, REFERENCE_FILE_RE all die |
| Net LOC | ≈ −900 core; ≈ −1,700 with the shared-doc epilogue (deletion inventory verified by all three breakers) |

## 1. Plane boundary (unchanged principle)

A payload rides the **CRDT plane** iff concurrent edits must both win inside one artifact: body `.tsx` (opaque Y.Text), sibling css, meta shared subset, comments (id-union), annotations (per-lane stamps per DDR-223), syncMeta. Everything else VERSIONED per DDR-115 is a **file** on the journal lane, membership decided solely by `classifyProjectFile` (`file-membership.ts` + parity-pinned hub mirror): inert-media, companion-text, code-module (owner-gated at BOTH the hub door and the receiver). `canvas-owned` → plane A only; `never` (config.json, `_*` runtime) → travels on nothing. File bytes are NEVER master-master merged: conflict = rename-aside + propagate (prior-art unanimity). Empty-tree in-group `.css` classifies canvas-owned by default (F2/F3 hardening).

## 2. Hub file journal (`apps/hub/src/journal.mjs`, table in hub.db)

```sql
file_journal(seq INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT,          -- designRoot-relative; classifier-validated at append; UNTRUSTED at receive
  sha256 TEXT, size INTEGER,
  mtime_ms INTEGER,   -- display only; NEVER an overwrite authority (F4)
  class TEXT,         -- hint; receivers re-classify
  deleted INTEGER DEFAULT 0,
  source TEXT,        -- 'peer-put'|'studio-report'|'walk-import'|'boot-scan'|'hydrate'
  mirrored_at_ms INTEGER, at_ms INTEGER)
journal_meta(epoch TEXT)        -- rotates ONLY on unreconstructible rewind
peer_cursors(label TEXT PK,     -- label bound to the AUTHENTICATED token, never the body
  epoch TEXT, seq INTEGER, healed_seq INTEGER,
  refused TEXT,                 -- persistent refused-path set; OUTRANKS the cursor (DDR-214)
  last_seen INTEGER)
sha_cache(path, size, mtime_ms, sha256)  -- persisted; survives restart/rehydrate
```

- **Append points**: existing `onWritten`/`onAssetWritten` hook sites (server.mjs:702/741/406) made **arg-carrying** ({path}); studio-child writes announce via `POST /api/journal/report` (loopback pairing token; a NUDGE — hub re-stats and re-hashes its own disk, report is never data); boot-scan; hydrate. Same-hash append is a no-op (zero churn from redundant re-uploads).
- **Walk-import reconciler (permanent)**: boot + periodic checkout walk diffed against the compaction, appending `walk-import` rows for any drift (git-level restores, missed hooks, class flips get supersede rows). Runs POST-BIND (serve stale-until-repaired); sha cache in hub.db makes it cheap on rehydrated (all-mtimes-reset) trees. CI grep pins every write-door `rename(` to an adjacent journal append.
- **Durability (the load-bearing amendment)**: every append is ALSO written-behind to R2 as one NDJSON line (`tenants/<id>/journal/tail.ndjson`, rotated at each backup generation, loud + retried). At rehydrate: restore generation → **replay tail** → journal head is reconstructed past the generation → epoch PRESERVED. Epoch rotates only when the tail is missing/corrupt (true rewind) — making cursor invalidation rare instead of per-wake. Best-effort SIGTERM tail flush. Boot assert: head ≥ tail-max or loud epoch rotation.
- **Compaction**: latest-row-per-path view IS the manifest; `GET /api/files` survives as the seq-0 case (+ `{epoch, head}`); shadowed rows pruned, tombstones retained.
- The journal row IS the edit stamp (DDR-223 generalized): remote state without a row cannot flow; a 0-byte file with a row is a stamped deliberate truncation; absence of a row is never a delete.

## 3. Desktop file ledger (`apps/studio/sync/file-ledger.ts`, at `_state/file-ledger/<hubId>.json` — already `never`-class, zero taxonomy churn)

Per hub: `{epoch, cursor, rows: {[rel]: {syncedHash, remoteSeq, size, mtimeMs, state, reason?, pushedAt?, pulledAt?, healedAt?}}, outbox}`. `syncedHash` = the ancestor. `(size, mtimeMs)` = stat cache so boot reconcile hashes only dirty files (steady-state ≈ 0). Deleting the ledger is always safe (forces re-anchor, never loss). **Write-ordering invariant, enforced in one module + kill-between-writes crash test**: bytes materialize (tmp+rename, streamed to disk — never whole-body buffering) BEFORE the ancestor row updates; push 2xx `{seq}` lands BEFORE ancestor adopt. Ancestor lag degrades to conflict-aside noise; ancestor lead is the eraser class and is structurally prevented.

## 4. The ONE decision function (pure, total, property-tested over the full {local × remote × ancestor × tombstone × flag-era} matrix)

```
decideFile(local, remote, ancestor):
  local == remote                              → noop (adopt ancestor)
  ancestor==local  && remote differs           → PULL  (sha-verify; park prior bytes; park-fail ⇒ pull REFUSED — DDR-102 fail-closed)
  ancestor==remote && local differs            → PUSH  (with ifHead CAS; 409 ⇒ refetch ⇒ re-decide)
  local absent, remote present, no ancestor    → PULL  (creation)
  local present, remote absent, no ancestor    → PUSH  (creation)
  ancestor==local && remote absent, no tombstone → PUSH (hub regressed — DDR-076 generalized: absence is never authority)
  all three differ (or no ancestor, both present, differ) → CONFLICT-ASIDE:
       park local as <name>.maude-conflict-<ts>-<label><ext> (MUST land first),
       adopt journal version to canonical path, push the conflict copy up (both ends SEE it)
  -- deletion rows (Increment 6; Syncthing rule, NOT 'absence never deletes, EVER'):
  local absent, ancestor present, remote==ancestor → propagate DELETE (gated by mass-delete breaker)
  local absent, ancestor present, remote≠ancestor  → PULL (edit beats delete)
  remote TOMBSTONE, local==tombstone.hash          → quarantine to _trash/ (never unlink)
  remote TOMBSTONE, local absent                   → noop (adopt)
  remote TOMBSTONE, local differs                  → keep local + PUSH (revive; panel says so)
  -- epoch changed (rare after the tail graft):
  ancestors are not overwrite authority: any 'PULL over local change' degrades to
  keep-local + park-remote-copy + push-local-up
```
Crossing writes: a remote row whose hash equals an in-flight outbox entry is self → adopt, no conflict. Wire mtime is display-only everywhere (F4 dead by construction). Unstamped emptiness structurally cannot beat content (empty is just a hash; it wins only via ancestor equality).

## 5. Protocol (all bearer peer-token, main-origin, in NEITHER canvas allowlist — DDR-088 pinned by test)

- `GET /api/journal?since=<seq>&epoch=<e>` → `{epoch, head, entries[≤2000], truncated}`; epoch mismatch / since>head / pre-compaction ⇒ `{reanchor:true}` ("no cursor" ≠ "no changes" — fail-closed). Rate-limited per token (closes the /api/files no-rate-limit gap). Cursor reports carry the refused-set.
- `PUT /api/file/<rel>` — single door (Increment 4; old doors are byte-identical shims until burn-down). Gate stack = union of both DDR-217 sets + owner-role gate for code-module (NEW) + `x-maude-content-sha256` re-hashed while streaming + `ifHead` CAS + per-class extension allowlist + realpath-resolved-parent + 95 MB per-file cap (kept BELOW the CF zone body limit) + session budget + `connection: close` + Retry-After. Hash-equal ⇒ 200 no-op with existing seq. Response `{seq, sha256}` = push receipt.
- `DELETE /api/file/<rel>` with `prevHash` CAS ⇒ 409 if hub moved; hub quarantines checkout copy AND mirrors loser to trash-prefixed R2 key before tombstoning.
- `GET /_project-file/<rel>` / `GET /assets/` kept; receiver re-hashes against the journal row (hub may refuse, can never substitute).
- **Poke**: reserved control doc **`maude.files`** — dotted (fails every old-client slug regex, verified `[A-Za-z0-9_-]` — no phantom LEGACY docs), branch-INDEPENDENT, scope-mapped in `onAuthenticate` for narrow tokens, admitted read-only, never stored as Y content. Hub `broadcastStateless({t:'files', head})`, coalesced 250 ms. Desktop attaches over its existing multiplexed socket; the **cell studio child attaches via a ctl-only loopback provider OUTSIDE the CELL_LIVE_PAIRING gate** (pairing preconditions apply to shared-doc content, not to a read-only stateless channel — this is what makes the watcher-gap fix reach the whole fleet, not just the pilot tenant). A lost poke costs latency, never correctness. Capability detection: hub advertises `ledger` in `/health` + link handshake; clients never attach ctl or relax polling against a hub that doesn't advertise it.

## 6. Event flow — one append, four subscribers

write door accepts bytes → journal append → (a) poke → desktop pulls by cursor / cell child synthesizes `fs:any` → existing `canvas-hmr` asset/css/meta heal (the container watcher gap dies structurally; `fs.watch` keeps exactly one job: out-of-band writers, backed by the belt reconcile); (b) R2 write-behind: CAS by sha256 for ALL file-lane classes (closes the `system/**/assets/*` durability hole) + the journal tail line, loud + retried; (c) git autocommit stages the path (desktop-pushed assets finally committed); (d) cursor/receipt bookkeeping. The pull applier front-queues assets referenced by just-arrived doc-lane changes (DDR-223 coupling kept). Push drain: size-classed queues (small files never wait behind a 95 MB video); per-path park-and-skip on IO failure with loud status (no global head-of-line); mass drains (fresh link, resync) above a threshold run in the existing spawned-child pattern — DDR-222's wall is respected, not claimed 'satisfied by elimination'.

## 7. Doručenka (delivery receipt — DDR-214's revisit trigger, fired)

Per file with latest seq S: `conflict/stuck` (outranks all) → `local-only` → `pushing(%)` → `on-hub` (2xx receipt) → `durable` (`mirrored_at_ms`) → `at-peer P` (cursor(P) ≥ S **AND** path ∉ refused(P)) → `ui-healed` (healedSeq ≥ S; honestly scoped as heal-event emitted, not per-tab render ack) → `everywhere`. Refusal outranks cursor outranks any count; `synced` is a positive assertion. Departed peers: labeled stale after a window, dismissible — never silently dropped, never permanently pinning. `referenced-but-unoffered` is a first-class local state (an `assets/<sha8>` name cited by strokes/tsx with no journal row anywhere — the broken-glyph case gets a row instead of silence). Surfaced as per-file rows in `_sync.json` + Sync panel (hub-authored strings output-encoded); raw counters kept so a lying panel is cross-checkable.

## 8. Deletion (Increment 6) & breakers

Deletes propagate only as explicit tombstones + the local-absent/ancestor-intact row — never from a vanished manifest entry. THREE breakers, all pause-and-ask in the Sync panel: outbound mass-delete (>10 files or >25 % in one window), inbound tombstone-storm (same thresholds), first-anchor conflict-storm (>N no-ancestor conflicts in one pass ⇒ bulk keep-local/keep-cloud). Receivers always quarantine, never unlink; cell-side losers mirrored to trash-prefixed R2 first; CAS objects never hard-deleted. Canvas deletes keep the plane-A doc-tombstone lane.

## 9. Security posture (delta)

Everything hub-supplied stays hints + untrusted input: paths re-shape-validated + re-classified locally (drop+loud, cursor advances but the drop lands in the refused-set); bytes re-hashed; owner gate at door AND receiver; `restrictImportsTo` unconditional; two-locks coupling untouched; DDR-193 containment untouched; no presigned URLs; consent boundary stays the 0600 token; CI kills sync. New caps: F6 aggregate per-batch budget + cumulative per-hub accumulation quota + client-side reanchor/poke cooldown. F1 is SCHEDULED work inside the flip gate: hub-synced `system/**` docs delimited as untrusted DATA (`_untrusted/INDEX.json` + `.claudeignore` extension to file-lane pulls) before the default flips. Ops knobs are `linkedHub.*` config keys + settings UI (DDR-177: the target user has no terminal); cell rollback runbook = `workflow_dispatch`.

## 10. Compat matrix (binding)

Old desktop ↔ new hub: doors byte-identical, probe answered checkout-only, new response fields ignored — works through burn-down. New desktop ↔ journal-less hub (self-hosted): capability-gated — no ctl attach, poll stays 20 s, legacy pull/push client retained ≥2 releases beyond fleet burn-down, ancestor-overwrite pushes refused without CAS. The 20 s poll is NOT relaxed until the poke-miss counter proves ~0 in dogfood. Un-upgraded peers appear in the doručenka as such.