# DDR-226 — Sync v2: a hub-ordered journal file plane, one store of serving truth, and the doručenka

- **Date:** 2026-08-17
- **Status:** accepted
- **Scope:** `repo:maude`, `dept:dev`
- **Supersedes:** the seven-lane posture assembled by [DDR-217](./DDR-217-cloud-asset-transport-desktop-push.md) · [DDR-222](./DDR-222-resync-is-restart-and-the-asset-sweep-runs-out-of-process.md) · [DDR-225](./DDR-225-fast-lanes-beside-the-sweep-single-file-push-and-reference-triggered-pull.md) (their transport *shapes*; every cap, validation and idempotence rule they pinned survives verbatim)
- **Extends:** [DDR-224](./DDR-224-the-checkout-serves-assets-first-and-every-write-door-mirrors.md) (completes it: the bucket loses its last serving semantics) · [DDR-102](./DDR-102-cold-start-divergence-resolution.md) · [DDR-223](./DDR-223-annotations-get-a-per-lane-edit-stamp-and-emptiness-never-beats-content.md) (generalized: the journal row IS the edit stamp) · the Plane-B classifier from `feature-sync-file-plane`
- **Fires the revisit trigger of:** [DDR-214](./DDR-214-one-honest-sync-status-rule-for-every-surface.md) — the per-document delivery ledger it deferred ("Connect Run sheet") is now due and ships as the doručenka.

## Context

Three days of dogfood on a real tree (alligators + alligators-mirror, releases
v0.60.4 → v0.60.7) fixed a series of holes and produced one verdict from the
user: *"brutálně se do toho zamotáváme."* The verified pre-redesign state
(`.ai/plans/notes/sync-architecture-ground-truth.md`) is **seven independent
sync mechanisms, three reconcilers, and no component able to answer "is file X
delivered?"**: CRDT doc lanes, asset push sweep, fast-lane push, asset pull,
flag-gated file plane, cell bucket mirror, git autocommit/rehydrate. Push is
scheduler-driven though a live WS is already open; two stores on the cell drift
(most of the v0.60.4–v0.60.7 bug week); hub-process atomic tmp+rename writes are
invisible to the container's `fs.watch`, so delivered bytes stay invisible until
a manual reload; the DDR-115 taxonomy lives in 4–5 copies.

Each lane was the locally-cheapest fix to a real, live-observed failure. The
sprawl is the sum, not any one decision.

The direction was decided by an 11-agent workflow (2026-08-16): four readers
(desktop sync, hub+cell, DDR corpus, prior art) → three **blind** architects
(clean-slate "Ledger", evolutionary "Doručenka", git-as-transport "Bill of
Lading") → three adversarial breakers → one synthesis. Full material:
`.ai/plans/notes/sync-redesign-dossier/`.

**All three architects independently converged on the same skeleton** — and that
skeleton is also the prior-art endgame (Dropbox journal + cursor, CouchDB
`_changes` + checkpoint, Syncthing index + sequence). Convergence meant the
winner was decided by migration quality, not architecture: **Doručenka
(evolutionary) as backbone with 16 binding grafts** from the other two and the
breakers.

## Decisions

### 1. Exactly two peer-facing lanes

- **Plane A (wire unchanged):** CRDT doc lanes for what is genuinely
  collaborative — body `.tsx` (opaque Y.Text), sibling css, meta shared subset,
  comments (id-union), annotations (per-lane stamps), syncMeta.
- **Plane B (new backbone):** ONE journal-driven file lane for everything else
  VERSIONED per DDR-115.

Membership is decided **solely** by `classifyProjectFile` (`file-membership.ts`
+ its byte-identical hub mirror) — the classifier is promoted to the single
membership oracle, not duplicated per lane. File bytes are NEVER master-master
merged: conflict = rename-aside + propagate, the one point of prior-art
unanimity.

### 2. The hub keeps an append-only journal; the row IS the edit stamp

`file_journal(seq, path, sha256, size, mtime_ms, class, deleted, source,
mirrored_at_ms, at_ms)` + `journal_meta(epoch)` + `peer_cursors` +
persisted `sha_cache`, all in hub.db. Every accepted write at every door
appends a row (same-hash append is a no-op). The latest-row-per-path view IS
the manifest.

Generalizing DDR-223: **remote state without a row cannot flow**; a 0-byte file
*with* a row is a stamped deliberate truncation; **absence of a row is never a
delete**. Wire `mtime_ms` is display-only, never overwrite authority (F4 dies by
construction).

A **permanent walk-import reconciler** (boot + periodic, post-bind, reusing
`file-manifest.mjs`) diffs the checkout against the compaction and appends
`walk-import` rows for any drift — git-level restores, a missed hook, a class
flip. A CI grep pins every write-door `rename(` to an adjacent journal append.

### 3. Journal-tail write-behind to R2, replayed before any epoch decision

The load-bearing amendment, and the resolution of the #1 cross-candidate hole:
**cells rehydrate from a ≤6 h-old backup generation on EVERY wake.** A
hub.db-only journal silently rewinds seqs, so cursors go stale-forever
(Doručenka's original "epoch survives restore" was affirmatively wrong), while
rotating the epoch per restore makes full re-anchor + conflict spam a *daily*
event (Ledger/BoL).

Therefore: every append is also written behind to R2 as one NDJSON line
(`tenants/<id>/journal/tail.ndjson`, rotated per backup generation, loud +
retried), best-effort SIGTERM flush, and rehydrate does **restore generation →
replay tail → then and only then decide the epoch**. The epoch rotates ONLY on
an unreconstructible rewind.

### 4. A payload-free poke over the already-open stateless channel

Hocuspocus ships `broadcastStateless`/`onStateless` and this codebase used it
nowhere. A reserved **dotted** control doc `maude.files` (dotted so it fails
every old client's `[A-Za-z0-9_-]` slug regex — no phantom LEGACY documents),
branch-independent, scope-mapped in `onAuthenticate`, admitted read-only, never
stored as Y content, carries `{t:'files', head}` coalesced 250 ms.

The **cell studio child attaches a ctl-only loopback provider OUTSIDE the
`CELL_LIVE_PAIRING` gate** — pairing preconditions govern shared-doc *content*,
not a read-only stateless channel. This is what makes the watcher-gap fix reach
the whole fleet instead of the one pilot tenant, and it kills ground truth §3's
prime suspect structurally. Do NOT also try to fix the container watcher. A lost
poke costs latency, never correctness: the poll survives as reconciler.

### 5. One pure, total decision function

`decideFile(local, remote, ancestor)` — a single pure table in the shape of
`cold-start.ts`'s `decideColdStart`, property-tested over the full
`{local × remote × ancestor × tombstone × epoch}` matrix with a compile-time
`never` default. Desktop keeps a per-hub **file ledger** (`_state/file-ledger/
<hubId>.json` — already `never`-class, zero taxonomy churn): ancestor store +
stat cache + outbox.

**Write-ordering invariant, enforced in ONE module and pinned by a
kill-between-writes crash test:** bytes materialize (tmp+rename, streamed)
BEFORE the ancestor row updates; a push 2xx `{seq}` lands BEFORE ancestor adopt.
Ancestor *lag* degrades to conflict-aside noise; ancestor *lead* is the eraser
class and is structurally prevented. Deleting the ledger is always safe (forces
re-anchor, never loss).

### 6. One store of serving truth on the cell

The checkout serves; R2 becomes **write-behind durability only** — CAS blobs for
ALL file-lane classes (closing the `system/**/assets/*` durability hole), backup
generations, and the journal tail. No serving semantics, no "present = both"
probe semantics. This completes DDR-224 rather than revising it.

### 7. The doručenka — delivery is a first-class, per-file, queryable fact

Per file at seq S: `conflict/stuck` (outranks all) → `local-only` →
`pushing(%)` → `on-hub` (2xx receipt) → `durable` (`mirrored_at_ms`) →
`at-peer P` (cursor(P) ≥ S **AND** path ∉ refused(P)) → `ui-healed`
(honestly scoped: heal event emitted, not per-tab render ack) → `everywhere`.

**Refusal outranks cursor outranks any count** (DDR-214's ordering-is-a-security-
property amendment applied to files). `referenced-but-unoffered` is a
first-class state — the broken-glyph case gets a row instead of silence.
Departed peers are labeled stale after a window and are dismissible, never
silently dropped. Surfaced in `_sync.json` + the Sync panel; raw counters kept
so a lying panel is cross-checkable.

### 8. Deletion propagates as an explicit tombstone, with breakers

Deletes never propagate from a vanished manifest entry — only as a tombstone row
plus the local-absent/ancestor-intact decision row (the Syncthing rule: delete
propagates only when `remote == ancestor`; **edit beats delete**). Three
pause-and-ask breakers: outbound mass-delete, inbound tombstone-storm,
first-anchor conflict-storm. Receivers always quarantine to `_trash/`, never
unlink; the cell mirrors the loser to a trash-prefixed R2 key BEFORE any
hub-side overwrite, and CAS objects are never hard-deleted.

### 9. Security posture: delta only, no relaxation

DDR-054 stands unchanged — the hub is untrusted to peers: receivers re-shape-
validate paths, re-hash bytes, and re-classify locally; hub `class`/name/mtime
are hints. New: an owner-role gate on code-module writes **at the hub door**
(today only the receiver gates), an F6 aggregate per-batch budget plus a
cumulative per-hub accumulation quota, and a client-side reanchor/poke cooldown
against hostile-hub spam. F1 (delimiting hub-synced `system/**` as untrusted
DATA) is SCHEDULED work inside the flip gate, not a citation. Ops knobs are
`linkedHub.*` config keys + settings UI — never env vars, never a terminal
(DDR-177).

### 10. Strangler phasing, compat matrix binding

Nine increments; sync works after every release; **nothing is deleted until its
replacement has soaked one release**. Hub+cell ship together (one image tag);
the only skew axis is desktop↔hub. Old desktop ↔ new hub: doors byte-identical.
New desktop ↔ journal-less hub: capability-gated (`/health` advertises
`ledger`), legacy client retained ≥2 releases, the 20 s poll relaxed only once
the poke-miss counter proves ~0 in dogfood.

Net: ~2,200–2,900 lines deleted vs ~1,400 added; three reconcilers → one
primitive; every trap in the ground-truth trap list gets a structural property
instead of vigilance.

## Alternatives rejected

- **Keep evolving the seven lanes.** Every fix this week added a lane, and the
  duplicate jurisdiction (file plane beside the asset lanes) is what forces the
  fast-push probe-guard against its own echo. The growth was diagnosed as the
  bug in the Plane-B work already.
- **Clean-slate rewrite ("Ledger").** Architecturally equivalent to the winner —
  it converged on the same skeleton — but its migration carries unforced risk:
  in-process drain against the un-root-caused DDR-222 segfault, a rollback
  contradiction (flag pointing into deleted code), and journal-as-only-truth
  without a walk reconciler. Its best parts are grafted in wholesale (tail
  durability, crossing-write self-detection, cooldowns, doručenka granularity,
  hub-door owner gate, permanent walk-import).
- **Git as the transport ("Bill of Lading").** Recorded separately as its own
  DDR so it is never re-litigated — see the GitSync rejection DDR.
- **Fixing the container watcher.** The gap is inotify-vs-atomic-rename; the
  announce-your-own-write property removes the dependency on inference entirely.
  Chasing the watcher would leave the delivery ledger unbuilt.
- **Binary payloads in the CRDT lane.** Rejected on merits in DDR-217 (memory
  amplification, immortal update history, no merge semantics for immutable
  blobs) and not revisited: do not extend the CRDT vocabulary for files.

## Consequences

- `apps/hub/src/journal.mjs`, `apps/studio/sync/file-ledger.ts`,
  `apps/studio/sync/decide-file.ts` and `cold-start-apply.ts` are new load-bearing
  modules; `asset-pull.ts`, `asset-sweep.ts`, `asset-push-worker.ts` and most of
  `asset-push.ts` are scheduled for deletion one release after the replacement
  soaks.
- The acceptance bar for every increment is **file-for-file parity on a real
  tree**, verified against built artifacts and the real container image
  (DDR-198's lesson), not fixtures.
- Pending task #4 (the `syncFiles` flag-flip cycle) is closed by Increment 4's
  hard security gate.
