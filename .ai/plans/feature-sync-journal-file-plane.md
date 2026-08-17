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

### Task 2: Increment 1 — hub journal + tail durability, dark (M)

- **Do**: CREATE `apps/hub/src/journal.mjs` per synthesis §2 (schema verbatim). Make the three existing door hook sites (`server.mjs:702/741/406` — verify live line numbers) **arg-carrying** `recordWrite({path})`. ADD `POST /api/journal/report` (loopback nudge; hub re-stats/re-hashes its own disk). ADD **R2 journal-tail write-behind** (one NDJSON line per append, `tenants/<id>/journal/tail.ndjson`, rotated per backup generation, loud + retried) and **replay-before-epoch-decision** in `rehydrate.mjs` + SIGTERM tail flush; epoch rotates ONLY on unreconstructible rewind. ADD permanent **walk-import reconciler** (post-bind, boot + periodic; reuses `file-manifest.mjs` walk; sha cache persisted in hub.db). ADD `GET /api/journal?since=&epoch=` + `peer_cursors`; `/health` advertises `ledger`. ADD CI grep pinning every write-door `rename(` to an adjacent journal append.
- **Pattern**: hub.db table creation mirrors existing tables (see `tokens.mjs`/`users.mjs` migrations); R2 writes mirror `backup.mjs` client usage.
- **Gotcha**: this is the amendment that resolves the #1 cross-candidate hole — cells rehydrate from a ≤6h-old generation on EVERY wake; without tail replay the journal silently rewinds seqs and cursors go stale-forever. The replay MUST run before any epoch decision.
- **Validate**: restore drill — backup → wipe → rehydrate → tail replay → head monotonic, epoch preserved; kill-mid-append test; walk-import catches a hand-planted checkout mutation. Run against the real container image (DDR-198 lesson).
- **Rollback**: routes dark, table inert — zero clients depend on it.

### Task 3: Increment 2 — the poke; the live watcher-gap bug dies fleet-wide (M)

- **Do**: ADD reserved dotted control doc **`maude.files`** (dotted name fails every old-client slug regex — verified `[A-Za-z0-9_-]`; branch-independent; scope-mapped in `onAuthenticate`; admitted read-only; never stored as Y content). Hub: `broadcastStateless({t:'files', head})` coalesced 250 ms. Cell studio child: attach **ctl-only loopback provider OUTSIDE the `CELL_LIVE_PAIRING` gate** (pairing preconditions govern shared-doc content, not a read-only stateless channel — this is what makes the fix fleet-wide, not pilot-only) → poke → synthesize `fs:any` → existing `asset`/`css` HMR heal. Desktop: attach capability-gated; poke triggers existing `pullAssetsOnce`/`pullFilesOnce`. Poll STAYS 20 s + add a poke-miss honesty counter.
- **Pattern**: stateless messages — see existing Hocuspocus usage in `documents.mjs`; peers with zero canvas docs must still hold the ctl connection (files-only projects keep event latency).
- **Gotcha**: ground truth §3's prime suspect confirmed by the hub reader — hub-process atomic tmp+rename writes are invisible to container `fs.watch`. The poke closes it structurally; do NOT also try to fix the watcher.
- **Validate**: LIVE on the fleet: hub-door asset PUT on an UNPAIRED cell heals an open cloud tab without reload (verify via CF observability `containers` dataset); poke-loss test (kill WS mid-poke ⇒ 20 s poll catches up); old-desktop-vs-new-hub regression: no phantom doc from the dotted name.
- **Rollback**: `linkedHub.fileEvents:false` (config key, not env) on either end ⇒ today's poll cadence exactly.

### Task 4: Increment 3 — ledger + three-way engine, behind the existing flag (L)

- **Do**: CREATE `file-ledger.ts` (ancestor store + stat cache + outbox; write-ordering invariant per synthesis §3, enforced in one module) and `decide-file.ts` (synthesis §4 table VERBATIM, incl. deletion + epoch-degraded rows; deletion EMISSION still off). One apply site absorbs `file-pull.ts`'s fetch/verify/quarantine loop. Journal-cursor pulls with fail-closed reanchor. Push half: `fs:any` → classifier → hash → ledger → `PUT` with `ifHead` CAS (409 ⇒ refetch ⇒ re-decide). Size-classed outbox + per-path park-and-skip (no global head-of-line); mass drains above threshold in the existing spawned-child pattern (DDR-222's wall respected). Conflict copies named `.maude-conflict-<ts>-<label>` (NEVER `*.sync-conflict-*` — `~/git` runs real Syncthing; classifier additionally REFUSES foreign `*.sync-conflict-*` from membership). Crossing-write self-detection (remote row hash == in-flight outbox ⇒ self, adopt). Referenced-asset prioritization (front-queue assets cited by just-arrived doc-lane changes — keeps the DDR-223 strokes→bytes latency coupling). Reanchor/poke cooldown (hostile-hub spam). Doručenka per-file rows (refusal outranks cursor; token-bound peer labels; `referenced-but-unoffered` state) in `_sync.json` + Sync panel. `linkedHub.syncFiles:true` now selects THIS engine (opt-in this release). **Old lanes untouched and still running for flag-off projects.**
- **Pattern**: `cold-start.ts` for the pure table + test matrix; `atomic-write.ts` for materialization; existing `_sync.json` writer in `status.ts`.
- **Gotcha 1**: bytes materialize BEFORE ancestor row update; push 2xx `{seq}` BEFORE ancestor adopt — ship the **kill-between-writes crash test in the same task**, not after.
- **Gotcha 2**: mixed-era — v1 push acks must feed ancestor adoption so the hybrid state is defined, not accidental.
- **Gotcha 3**: Sync panel = studio client → rebuild committed bundle release-minified (`cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`) and watch `git status apps/studio/dist/` before/after any `bun test`.
- **Validate**: full `decideFile` property matrix; crash-ordering test; real-tree 216/216 byte parity (Plane-B acceptance repeat); mixed-era test.
- **Rollback**: flag off ⇒ v0.60.7 paths untouched; deleting the ledger file forces a safe re-anchor (never loss).

### Task 5: Increment 4 — F1–F6 hard gate, flag default ON (M)

- **Do**: Run `/flow:validate-security` as a HARD gate over the file plane: F1 = untrusted-DATA delimiting for all file-lane pulls into `system/**` (`_untrusted/INDEX.json` + `.claudeignore` extension — SCHEDULED work, not a citation); F2/F3 = empty-tree css default + config-seed-before-first-pull pinned by tests; F4 structural (wire mtime display-only — Inc 3); F5 regression-tested; F6 + cumulative per-hub accumulation quota. ADD hub-door **owner-role gate on code-module writes** (NEW — today `handleCheckoutAssetRoute` checks class only; receiver-side gate is currently the only one). CONSOLIDATE to single door `PUT /api/file/<rel>` (old doors become byte-identical thin shims). ADD first-anchor conflict-storm breaker (>N no-ancestor conflicts in one pass ⇒ hold + Sync-panel bulk keep-local/keep-cloud — on flip day the hub's `system/**` is stale by construction). Flag default flips ON only after the gate passes + one soak release.
- **Gotcha**: closes pending task #4 (flag-flip cycle) — record the gate verdict via `maude kg record-log`.
- **Validate**: recorded security verdict; flip-day dogfood on a project whose hub `system/**` is stale — the breaker must FIRE, not mass-revert.
- **Rollback**: flag default back off per project (config, no terminal — DDR-177 posture); shims keep every old client alive.

### Task 6: Increment 4.5 — mode model: adopt / detach (M)

- **Do**: Implement the two-mode model (see Product mode model section). **Adopt (A→B)**: link flow gains a mandatory adoption step — fresh-link push of the local `.design/` through the journal plane, then append `.design/` to the repo `.gitignore` + `git rm -r --cached .design` (single confirmed operation; desktop UI dialog per DDR-177 — no terminal; CLI mirror in `maude` for terminal users). Refuse to complete a link without adoption (no hybrid state). Detect Syncthing-managed folders (`.stfolder` in ancestors) and recommend/offer an `.stignore` entry. **Detach (B→A)**: unlink hub + remove the ignore line + prompt "commit `.design/` now" (bytes already local — the mirror is full). **Migration**: existing linked projects (e.g. alligators) get a one-time prompt on first run with the new version — adopt (ignore + untrack) or detach; linger in the old hybrid is allowed only until answered, and the Sync panel shows a persistent "legacy hybrid" badge. RECLASSIFY `design-sync.mjs` as explicit export/handoff (docs + command surface wording; no longer described or wired as a sync lane).
- **Pattern**: `cli/lib/gitignore-block.mjs` for gitignore editing discipline (append/remove idempotently, last-match-wins awareness); hub-workspace link flow for the UI seam.
- **Gotcha 1**: `git rm -r --cached` on a dirty tree — stage ONLY the `.design/` removals + `.gitignore` edit; never `git add -A` (global instructions). Snapshot nothing; the working tree is untouched by design.
- **Gotcha 2**: DDR-115's four ignore-list copies govern what syncs INSIDE `.design/` — this task's repo-level ignore is a FIFTH, different concern (whole-folder, user-repo-side). Do not conflate them; the taxonomy lists stay untouched.
- **Gotcha 3**: fresh clone of a Mode-B repo has NO `.design/` — the link flow must handle "adopt an empty local dir from hub" (fresh-link pull), which is the new-machine onboarding path. Verify it end-to-end.
- **Validate**: adopt on a real repo → `.design/` untracked, ignored, hub has full tree, doručenka all-green; detach → repo commit contains byte-identical tree; new-machine clone → link → full pull parity; migration prompt fires exactly once per legacy project.
- **Rollback**: adopt/detach are explicit user operations with confirmations; migration prompt can be deferred (badge persists); revert = detach.

### Task 7: Increment 5 — burn-down (M)

- **Do**: one release after Inc-4 soaks, DELETE: `asset-pull.ts`, `asset-sweep.ts` + `asset-push-worker.ts` as transfer engine, ~450 lines of `asset-push.ts` (transport core survives in the door client), fast-push wiring + `requestFastPull` + `REFERENCE_FILE_RE`, `announceWrite` inference bridge, probe route (checkout-only compat shim retained for the legacy window). Hub `asset-lane.mjs` sweeper → ~150-line journal-driven write-behind covering ALL file-lane classes (closes the `system/**/assets/*` durability hole). `assets.mjs` PUT branches → delegates. Poll 20 s → 60 s ONLY if the poke-miss counter proved ~0 in dogfood. Legacy pull/push client retained ≥2 releases for journal-less self-hosted hubs.
- **Validate**: `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke` (no sweep child left behind); new-desktop-vs-old-hub e2e still pushes/pulls via legacy client; store-drift alert (post-boot bucket-fallback serving = alarm).
- **Rollback**: deletions are clean revert commits; legacy sweep equivalent kept one release cell-side via `workflow_dispatch` runbook.

### Task 8: Increment 6 — deletion propagation (M)

- **Do**: tombstone emission + the local-absent decision rows (Syncthing rule: delete propagates only when `remote==ancestor`; edit beats delete); `DELETE /api/file/<rel>` with `prevHash` CAS; revive path (remote tombstone + local differs ⇒ keep local + push). `_trash/` quarantine both directions; cell-side losers mirrored to **trash-prefixed R2 key BEFORE** any hub-side overwrite/tombstone (CAS objects never hard-deleted). Outbound mass-delete AND inbound tombstone-storm breakers (>10 files or >25% in one window ⇒ pause + panel, default auto-conservative per Open decision 2). `linkedHub.propagateDeletes` default per Open decision 1.
- **Validate**: branch-switch mass-delete fires the breaker; offline-delete propagates on reconnect; resurrection test (tombstone in lost tail + tail replay ⇒ no resurrect); R2 trash key exists before any cell-side loser is overwritten.
- **Rollback**: flag off ⇒ absence propagates nothing (today's posture); tombstone rows inert to old clients.

### Task 9 (separate follow-up arc per Open decision 7): Increments 7–8 — shared-doc epilogue

- **Do**: (7) desktop `MAUDE_SHARED_DOC` default ON (DDR-064 cutover; re-verify desktop-specific items from the DDR-213 checklist), NO deletion in that release. (8) one release later: DELETE `agent.ts` + two-doc relay observers + agent-origin queuedOps wiring (~800 lines); cold-start callers: 1.
- **Validate**: real-tree link + full cold-start matrix on the single applier; perf smoke (`maude design perf` before/after).
- **Rollback**: (7) config flip back — both paths coexist; (8) revert the deletion commit.

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

- [ ] Task 0 DDRs recorded (architecture + GitSync rejection) and ingested to kg
- [ ] Each increment ships as its own release; **no increment deletes code whose replacement hasn't soaked one release**
- [ ] After Inc 2: a hub-door write heals an open cloud tab on an **unpaired fleet cell** without reload (the ground-truth §3 bug is dead)
- [ ] After Inc 3: `decideFile` property matrix green; kill-between-writes test green; real-tree byte parity; doručenka answers "where is file X" for every VERSIONED file
- [ ] After Inc 4: security gate verdict recorded; `syncFiles` default ON; pending task #4 closed
- [ ] After Inc 4.5: no hybrid state exists — every linked project has `.design/` gitignored (adopt) or is unlinked (detach); legacy hybrids carry the badge until answered; new-machine clone→link→pull parity verified
- [ ] After Inc 5: net LOC of `apps/studio/sync/` + hub sync files is **negative vs v0.60.7 baseline** (target ≈ −900 core); poll relaxed only if poke-miss ≈ 0
- [ ] After Inc 6: delete on one side propagates (per Open decision 1 default) with breakers; quarantine, never unlink
- [ ] Ground-truth §7 invariants verified point-by-point in `/flow:validate` output at every increment
- [ ] Compat matrix (synthesis §10) upheld: old desktop ↔ new hub and new desktop ↔ journal-less hub both keep working through the window
- [ ] `pnpm --filter @maude/site gen:roadmap` regenerated in the same commit as this plan and at each plan-status change
