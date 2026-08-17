# Bill of Lading (leverage)
VERDICT: fixable
EFFORT: L — ≈7 weeks wall-clock across 6 increments / ~4 releases (1.5 wk ledger+poke+heal, 1 wk doručenka, 2 wk v2 engine + security gate, 1.5 wk push unification + deletions, 0.5 wk store demotion, 1 wk shared-doc cutover in parallel) + soak releases between deletions. Net LOC ≈ −1,800: ≈ −3,300 deleted (desktop: asset-push/sweep/worker/pull, fast-lane + poll + bridge wiring, dead autocommit, agent.ts after cutover; hub: assets.mjs PUT/probe branches, asset-lane sweeper coupling, proxy hooks) vs ≈ +1,500 added (ledger module + routes ~550 hub, three-way table + ancestor store + applier rework ~800 desktop, doručenka UI ~250).
PITCH: Git-as-sync was developed to the bolts and loses at exactly the four points that matter (binary history growth on an 8 GB/½-vCPU cell, live events, DDR-054-gated materialization, per-file delivery receipts) — so ship what git secretly is, without the truck: ONE append-only change ledger on the cell ({seq, path, hash, tombstone}) + content-addressed blob transfer over the routes that already exist, a payload-free poke on the already-open Hocuspocus socket that wakes every peer AND every UI from the same event, and one three-way decision table (local/remote/ancestor) that makes "emptiness never beats content" structural. Git stays in the system doing what it is actually good at — history of record, seed, backup, rehydrate — and the doručenka ("is file X delivered everywhere?") becomes a table lookup instead of archaeology across four logs.
FATAL: []
FIXABLE: ["SEV-1 — No local-state enumerator: steady-state discovery is only live fs:any + remote changes?since (inc-4 boot reconcile is explicitly 'no walk, no spawn'). Any .design/ change made while the app is closed — editor edits, Claude Code sessions, git branch switches (routine for this audience) — is never pushed; an offline local DELETE never propagates and the file resurrects via the 'local absent → PULL' row. This breaks the core mirror requirement; Dropbox/Syncthing both boot-scan index-vs-disk. Fix: boot/reconnect lstat-only scan against the ancestor store (size+mtime gate, hash only suspects) — cheap, but it must be added and it retracts the design's 'DDR-222 satisfied by elimination' accounting.", "SEV-1 — Restore-from-backup is the EVERY-WAKE path, not disaster recovery, and the epoch rule makes it noisy: cell disk is ephemeral (server.mjs:319), sleepAfter='20m' (cell-do.mjs:53), backup generations default every 6h (server.mjs:313), and shutdown() flushes only the git commit — no final backup generation (server.mjs:2541-2561). Under §2.1 'new epoch on every restore' + the §2.4 degraded rule, every wake ⇒ {resync:true} for all peers ⇒ full-tree three-way with ancestors voided (mass re-hash on desktop, in-process) and a .sync-conflict copy of its own stale version parked on the user's disk for every file edited in the ≤6h lag window; cloud-originated ledger rows after the last generation rewind (blobs may sit unreferenced in CAS). Fix: SIGTERM-time ledger snapshot to R2 (tiny; checkout can rebuild from ledger+CAS) or clean-shutdown epoch preservation + 'remote==pre-epoch-ancestor ⇒ skip parking' refinement. §2.7's restore walkthrough must be rewritten for this frequency.", "SEV-1 — Increment 1's headline fix doesn't reach the fleet: 'studio child hears the poke on its loopback provider' — that provider exists only under cell pairing (sync/index.ts:403 returns null for unpaired workspace cells; five env preconditions in cell-pairing.ts:105-167), and pairing is a pilot allowlist (wrangler.toml CELL_LIVE_PAIRING=\"alligators\", absent=off documented as fleet default). On every unpaired cell the child has no Hocuspocus connection, the poke never arrives, and the ground-truth §3 watcher-gap bug survives. Fix: hub→child nudge over a non-pairing-gated channel (loopback HTTP to the studio door, or the existing studio-child control plane) — mechanically small, but the 'one event, three subscribers' story must be corrected.", "SEV-1 — Push bypasses the decision table: PUT /api/file carries only the CONTENT hash (integrity), no expected-head precondition — DELETE got prevHash CAS, PUT didn't. §2.3(3) wires fs:any → hash → PUT directly, so concurrent both-side edits inside the poke round-trip resolve as silent last-PUT-wins at the door; no conflict-aside materializes anywhere (the hub door doesn't park), violating the design's own 'both ends SEE it' guarantee exactly in the live-concurrent case. Fix: PUT ifHead=<hash|seq> ⇒ 409 ⇒ pull ⇒ table ⇒ conflict-aside.", "Decision table §2.4 is not total as printed: missing rows for (ancestor present, both moved, all three differ) → conflict-aside (the §2.7 walkthrough asserts it, the table doesn't), (local absent, ancestor present, remote==ancestor) → propagate delete, and (local absent, ancestor present, remote≠ancestor) → edit-beats-delete pull. The 'structural, not vigilance' claim requires the table to be a total function.", "Migration inc 4 breaks new-desktop → old-hub: v1 push lanes are deleted from the desktop while apps/hub is explicitly self-hostable and upgrades on its own cadence — a ≥0.63 desktop against a ≤0.61 self-hosted hub has no push door at all. Old-desktop → new-cell shims last exactly one release, so any desktop that skips a release silently stops pushing. Fix: capability detection via /health (hub advertises ledger) + keep the v1 push client ≥1 cycle longer; define the un-upgraded-peer story in the doručenka.", "Boot repair walk cost on the cell: rehydrate rewrites every mtime, so file-manifest.mjs's (size,mtimeMs) sha cache (lines 106, 207-218 — in-memory Map, also lost at restart) misses 100% ⇒ full re-hash of a ~280MB checkout on ½ vCPU inside the boot path whose port window already failed once at 1.1GiB. The walk must run post-bind (serve stale-until-repaired) or the sha cache must persist in hub.db; the design is silent on ordering.", "Poke emission unspecified at scale: broadcastStateless is per-document and the desktop holds one provider per canvas (79 docs on alligators) — a 500-entry burst without hub-side coalescing is ~40k frames; spec must pin 'one doc per socket + debounce to latest seq'. Peers with zero canvas docs (files-only projects, fresh hubs) have no socket at all ⇒ permanently on the 60s reconcile, a regression vs today's 20s poll in exactly those cases.", "DDR-223 coupling latency regression: deleting REFERENCE_FILE_RE (which lives at sync/index.ts:665, not asset-pull.ts as the deletion list claims) removes referenced-asset prioritization — on fresh link, an annotation's image can queue behind hundreds of seq-ordered entries while the strokes render broken. Amendment: applier prioritizes assets referenced by just-arrived doc-lane changes.", "Conflict filename collision: ~/git runs real Syncthing whose *.sync-conflict-* artifacts are documented in the root CLAUDE.md; Maude emitting the identical pattern makes conflicts unattributable, and the classifier will happily ledger-sync Syncthing's own conflict files. Use a distinct marker (e.g. .maude-conflict-) and consider refusing foreign *.sync-conflict-* from membership.", "Doručenka semantics gap: peer_cursor is per-peer, per-file 'delivered' is derived as cursor ≥ seq — an admission-refused entry with an advanced cursor would lie unless refusal rows are persistent and outrank the cursor (DDR-214 ordering must be stated for the cursor explicitly). Also ledger path/origin strings are hub-authored and rendered in the Sync panel — output-encode (XSS surface), and bind cursor-report identity to the token, never the body.", "Mixed-fleet inc 3 wiring: with v2 pull active but push still v1 (sweep/fast-push), pushes don't update the ancestor store and the table's PUSH verdict has no executor — the plan needs an explicit statement that v1 push acks feed ancestor adoption (or that hash-idempotent echo pulls do), otherwise inc-3 soak data is measuring a hybrid the final system never runs."]

## DESIGN
# Bill of Lading — sync redesign (Angle 3: stand on giants)

**Assignment:** develop `.design/` sync AS git protocol seriously; develop one genuinely different alternative from the prior-art dossier; argue which to actually ship. **Verdict up front:** GitSync (Part I) is buildable and was designed honestly below — but by the time it satisfies DDR-054, the latency bar, and the cell's physical limits, every git-specific mechanism has been bypassed or re-implemented, and what remains is the journal+CAS design (Part II) wearing a packfile costume. **Ship Part II ("Bill of Lading").** Git is not deleted — it is *demoted to the role it already performs well*: history of record (cell autocommit, DDR-198), seed, checkpoint/backup/rehydrate (DDR-199). The giant stays under the ledger, not under the truck.

---

## PART I — GitSync: `.design/` sync as git protocol, developed seriously

### 1.1 Topology and the repo question (the first fork in the road)

The repo already runs git on both sides — but *not the same repo, and not for the same purpose*:

- **Cell:** `/repo` = full clone of the tenant seed URL; hub is the **sole committer** (DDR-198/213 machine-checked condition), append-only, author=human committer=Maude; `git bundle --all` rides in the same backup generation as SQLite (DDR-199).
- **Desktop:** `.design/` lives **inside the USER's own repo** — their commits, their remotes, their branches, their rebases (DDR-119: the user's own git IS the history; desktop `autocommit.ts` is confirmed dead code — `createAutoCommit` is gated behind a condition at `sync/index.ts:486` that can never be non-null past the gate at `:403`).

Three topologies were evaluated:

**(a) Push/pull the user's own repo ↔ cell repo.** Killed immediately: the user's repo contains their *whole codebase*, not just `.design/` — syncing it drags unconsented source code onto Maude infrastructure (scope violation of "mirror the .design folder"), collides with their own origin remote (two upstreams, divergent histories, their rebases vs our append-only), and the cell seed deliberately scrubs credentials from origin (`seed-repo.mjs`) *because* the histories are separate by design (DDR-217's git-pull rejection).

**(b) Hidden second repo over the same working tree.** A bare sync repo (`~/Library/Application Support/maude/sync/<project>.git`) with `GIT_WORK_TREE=<designRoot>`, `core.excludesFile` generated from the DDR-115 taxonomy, tracking VERSIONED paths only. This is the only viable desktop shape. Cost: **two git indexes over one tree** — every sync merge dirties the user's own `git status` (acceptable; any sync does), but index/mtime races between the user's own git operations (branch switch rewriting `.design/`) and the sync repo's merges become a new class of bug that no existing system runs in production. Cell side symmetrical problem: `/repo` is the seed clone of the user's full repo — desktop's sync repo covers only `.design/`, so the cell would need **a second repo too** (sync-scoped), or subtree-split gymnastics on every exchange. Store count on the cell *grows* (checkout + seed-repo + sync-repo + R2).

**(c) Server-side virtual repo.** Hub synthesizes commits/trees on demand from the checkout (no second on-disk repo), speaks smart HTTP outward. This is "implement a git server over a manifest" — i.e., already the journal design with extra steps.

Chosen for evaluation: **(b)**, the least-bad.

### 1.2 Wire protocol and auth

The hub exposes **no git endpoint today** (verified: no `info/refs` / `upload-pack` / `receive-pack` anywhere under `apps/hub/src`). Adding one:

- Cell container has system git (Dockerfile installs it; "autosave IS git", DDR-195 §3) → `git http-backend` via CGI shim, or `git upload-pack --stateless-rpc` spawned per request. Feasible.
- Auth: bearer peer token → readOnly tokens map to upload-pack only; receive-pack requires write scope. Straightforward.
- **Platform wall #1:** smart HTTP `receive-pack` is a **single POST of one pack**. The worker→DO→container splice enforces code-level body caps (100 MB/file today, 2 GiB/process budget) *and* the platform plan's own body limit sits above them. A fresh-link push of a real design project (alligators-class: hundreds of files, 280 MB seed already forced `standard-1`) is one multi-hundred-MB POST that **cannot be split** — the git protocol has no resumable receive-pack. Per-blob PUTs chunk naturally; packs don't. Workaround = push history in artificial slices (fragile, hand-rolled) or sideband the pack to R2 first (now we've left the git protocol).
- **Platform wall #2:** HEAD→GET conversion doesn't bite git (it uses GET/POST), but chunked-encoding POSTs through the splice are exactly the path that has never been exercised; the existing transport scar tissue (`connection: close`, batch-probe instead of HEAD) all came from this proxy chain misbehaving.

### 1.3 Commit / merge model

- Desktop commits on write-quiescence (reuse `autocommit.ts` engine — it finally gets a job); push after commit; on non-fast-forward: fetch, **deterministic tree-merge**, push again.
- The merge driver is custom and file-level, never line-level (DDR-110: prevent-don't-merge for TSX, no merge UI ever): three-way per path against `merge-base`; both-changed ⇒ **conflict-aside** — theirs materializes as `<name>.sync-conflict-<ts>-<host>.<ext>`, committed, so the copy propagates (Syncthing semantics). Binary = always conflict-aside.
- **Fact that kills library reuse:** isomorphic-git's `merge` throws `MergeNotSupportedError` on any real conflict — so the tree-merge is hand-rolled either way: read base/ours/theirs trees, walk, apply *the same decision table the journal design needs*, write tree, commit with two parents. The giant does not carry the load at the exact point the load exists.
- Contention: a user dropping 20 images while cell autocommit lands on its own clock ⇒ repeated non-FF reject → fetch → merge → re-push loops. Each loop is pack negotiation RTTs, not one idempotent PUT.

### 1.4 Materialization under DDR-054 (the quiet disqualifier)

`git checkout` materializes **whatever the pack says** — arbitrary paths, symlinks, `.tsx` outside groups, runtime-state names. The hub is untrusted to peers; the receiver must re-validate every path (§7). So plain checkout is **banned**: the desktop must walk the tree diff and admit each entry through `file-membership.ts` + canvas-path validation + symlink refusal + caps — i.e., **git's working-tree machinery is unusable and we keep only its object store**, feeding the same classifier-gated materializer the journal design uses. DDR-131 is the standing receipt that git's transport/config surface is RCE-rich (`ext::` helpers — a CRITICAL found in *our own* code this June); a sync-owned bare repo with machine-generated config narrows this but the surface class remains.

### 1.5 Events

Git has no server→client channel. Post-receive hook → broadcast over the existing WS — **identical mechanism to the journal's poke**, just triggered by receive-pack. The visibility-gap fix is transport-independent; git contributes nothing here.

### 1.6 Large binaries: plain blobs vs annex-style pointers

- **Plain blobs:** every saved generation of every PNG/MP4 accretes in every clone, every `git bundle`, every backup generation, forever (append-only history is IMMUTABLE per DDR-195/198 — squash/rewrite is off the table). Numbers: a design project with 300 MB media and modest churn (5 revisions of a third of its assets) ⇒ ~800 MB of packs; `repo.bundle` per backup generation crosses the **1.1 GiB boot-restore threshold that already failed the 600 s window on ½ vCPU** (Map B; `portReadyTimeoutMS` is 30 min *because* rehydrate precedes bind). Availability is already a function of project size; plain-blob GitSync makes it a function of project *history*.
- **Annex-style pointers:** pointer files in git, bytes via… a content-addressed HTTP lane with its own presence tracking — **this IS the asset lane we are trying to delete**, re-added with pointer indirection on top. git-annex itself needs a location-tracking branch + special remotes; we'd own all of it.
- Partial clone (`filter=blob:none`) reduces desktop clone cost but the user requirement is a FULL mirror — the blobs come anyway.

### 1.7 Renames, partial checkout

Renames = delete+add at tree level (pack dedups content; fine — same as the journal). Partial checkout: desktop needs full `.design/` (the requirement), so sparse-checkout buys nothing there; the *cell* needing `.design/`-scoped sync inside a full-repo clone is topology (b)'s second-repo problem again.

### 1.8 Engines: isomorphic-git vs system git (verified in-repo)

- The `.app` bundles **no git binary** (checked `apps/desktop/scripts/stage-resources.mjs` / `helper-deps.mjs`; DDR-177's target user has no terminal, and macOS's `/usr/bin/git` shim demands an Xcode CLT install dialog). So the no-git persona rides **isomorphic-git** (bundled, `apps/studio/package.json`).
- DDR-133 (in `git/service.ts` header, verified): iso-git is "genuinely slow on a real-world repo", and `git.statusMatrix`/`listBranches` "can throw on some trees ('No obj for …') and wedge the 10 s Bun.serve idle window" — the exact engine would sit on the hot path of *every save* and assemble 50 MB packs in JS memory inside the editor's process (the DDR-222 wall says mass work never runs beside the editor; pack assembly of a video is exactly that, so the pack build goes out-of-process — resurrecting the sweep-child machinery we're deleting).
- System git when present, iso when not ⇒ **two engines on the sync hot path** = trap #2 (two architectures, every bug fixed twice) rebuilt on purpose.

### 1.9 Do the CRDT doc lanes shrink to presence/cursors only?

**No.** DDR-110 is immutable on this: the live overlay (body text, comments, annotations strokes) is the *product* — ms-latency co-editing with merge semantics git cannot give (git stops at binary; even for text, commit-granularity is not typing-granularity). Binary never enters Yjs (DDR-217). Under either design, doc lanes keep exactly: body `.tsx` (opaque Y.Text), css sibling, meta shared subset, comments, annotations, syncMeta stamps, presence. The file lane (git or journal) carries everything else in the VERSIONED taxonomy, and the classifier keeps the planes disjoint.

### 1.10 GitSync scorecard — where it bleeds

| Hard requirement | GitSync |
|---|---|
| iCloud mental model, full mirror | ✔ (with custom materializer) |
| Fail-closed cold start | ✔ but hand-rolled (iso merge unusable) — same table as journal |
| DDR-054 untrusted hub | ✔ only by **bypassing** `git checkout` entirely |
| Live latency / events | ✘ commit+pack+negotiate per change; WS poke needed anyway |
| 50 MB drop | ✘ pack assembly in-process or new child; single-POST push vs body caps |
| Fresh link of a real project | ✘ one giant unsplittable receive-pack vs platform body caps |
| Cell physics (8 GB disk, 600 s boot) | ✘ unbounded history growth in every bundle/backup/rehydrate |
| Doručenka | ~ commit-granularity (path→last-touching-commit maps, coarser) |
| One engine | ✘ iso + system git forever (DDR-133 fragility receipts) |
| Deletes today's lanes | ~ deletes them but adds: smart-HTTP server, tree-merge driver, pack budgeter, second repos on both sides |

**Conclusion:** adopt git's *shape* (append-only log of tree states + CAS + tombstones-as-commits), reject git's *container* (packs, refs, merge machinery, checkout). That shape, implemented natively over the hub's existing HTTP/WS, is Part II — and it is also exactly where the prior-art dossier says every mature system converged (Dropbox journal+cursor, CouchDB `_changes`+`_revs_diff`, Syncthing index+sequence).

---

## PART II — Bill of Lading (the design to ship)

### 2.0 Shape in one paragraph

The cell keeps ONE append-only **ledger** of designRoot mutations. Every write door appends `{seq, path, hash, size, tombstone?, origin}` after its bytes land; a payload-free **poke** `{seq}` rides the already-open Hocuspocus sockets (desktop peers AND the studio child's loopback provider — one event, three subscribers: peer pull, UI heal, doručenka). Peers hold a **cursor** `(epoch, seq)` and a per-file **ancestor store** (last-synced hash — Dropbox's Synced Tree); on poke or reconcile they pull `GET /api/changes?since=`, run ONE pure three-way table `(localHash, remoteHash, ancestorHash) → push | pull | tombstone-apply | conflict-aside | noop`, move bytes content-addressed with verify-on-receive, and advance the cursor. The checkout is the cell's only serving truth; R2 is pure write-behind durability; git remains history-of-record + backup. Doc lanes (Yjs) are untouched and disjoint by classifier.

### 2.1 Data structures

**Ledger (hub, SQLite table in `hub.db` — deliberately in the SAME backup generation as everything else, DDR-199 mixed-generation lesson):**
```
ledger(seq INTEGER PRIMARY KEY AUTOINCREMENT,
       path TEXT,          -- designRoot-relative, validated at the door, UNTRUSTED at receive
       hash TEXT,          -- sha256 of content; '' for tombstone
       size INTEGER,
       tombstone INTEGER DEFAULT 0,
       class TEXT,         -- classifier verdict at the door (HINT only, receivers re-classify)
       origin TEXT,        -- peerId or 'cell-studio' or 'cell-hub' (echo suppression + attribution)
       stamp INTEGER)      -- hub receive time; NEVER an overwrite authority (F4)
ledger_epoch(epoch TEXT)   -- UUID; new epoch on every restore-from-backup
peer_cursor(peerId TEXT PRIMARY KEY, epoch TEXT, seq INTEGER, updatedAt INTEGER)
child_applied(seq INTEGER) -- studio child's last processed seq (the "UI healed" bit)
```
Compaction: latest-entry-per-path view = the manifest; `GET /api/changes?since=0` ≡ today's `GET /api/files`. Boot: hub walks the checkout (existing `file-manifest.mjs` walk, sha cache by size+mtime) and appends repair entries for any drift between checkout and ledger head-state (crash between rename and append heals here).

**Desktop ancestor store** (per hub, beside the existing `journal.ts` store, same per-hub invalidation discipline; ONE new runtime-state path registered in all four DDR-115 taxonomy lists — with the tripwire test extended):
```
ancestors: path → { hash, seq }   // "the last state both sides agreed on"
cursor: { epoch, seq }
```
Write-ordering invariant (THE load-bearing rule, see §2.10): bytes materialize (tmp+rename) **before** the ancestor row updates; push acknowledges (2xx + ledger seq) **before** the ancestor row updates. Ancestor lag is safe (degenerates to conflict-aside); ancestor lead is the eraser class.

### 2.2 Protocol (all routes bearer-gated peer token, main-origin, in NEITHER canvas allowlist — DDR-088)

- `GET /api/changes?since=<seq>` → `{epoch, head, entries[≤500], more}` — rate-limited (closes the known `/api/files` no-rate-limit gap). `since` beyond head or wrong epoch ⇒ `{resync: true}` — **"no cursor" is structurally distinct from "no changes"** (fail-closed, DDR-102).
- `PUT /api/file/<rel>?hash=<sha256>` — the ONE upload door. Streams to tmp; hub verifies sha256 matches the declared hash (client cannot lie, hub cannot substitute); classifier + anchored path + realpath containment write-to-resolved-parent + binary-extension allowlist for media classes + owner gate for code-module + per-file cap 100 MB + session byte budget (all DDR-217 checks, one door instead of two); rename; ledger append; poke; R2 write-behind enqueue. Idempotent: hash already at head for path ⇒ 200 no-op.
- `DELETE /api/file/<rel>?prevHash=<sha256>` — tombstone with compare-and-set: prevHash ≠ current ⇒ 409 (edit-beats-delete enforced at the door, not just at receivers).
- `GET /api/blob/<sha256>` — CAS read; served checkout-first via ledger reverse index, R2 fallback; receiver re-hashes and refuses mismatch (hub may refuse to serve, can never substitute — DDR-195). No presigned URLs anywhere; $0 R2 egress keeps the proxy affordable.
- `POST /api/cursor {epoch, seq}` — peer acknowledges applied batch (doručenka feed).
- **Poke**: Hocuspocus stateless message (`broadcastStateless` — verified present and unused in this codebase) `{t:'ledger', seq}` on every open document connection of the project; client dedups by seq. No new socket, no new auth, payload-free (a lost/duplicated poke costs latency, never correctness — Dropbox longpoll property). Backstop: reconcile poll demoted 20 s → 60 s.
- Compat (one release): `PUT /assets/<key>`, `PUT /_asset-file/<rel>`, `POST /_asset-probe` become thin shims over the same door/ledger, then die.

### 2.3 Event flow — one bus, watcher gap structurally dead

Every write site announces its own write; **fs.watch is never the inter-process bus** (prior-art rule; Node/inotify caveats are permanent):
1. **Hub-process write** (peer PUT, tombstone): rename → ledger append → poke. The studio child hears the poke on its loopback provider → re-emits `fs:any`-equivalent on the internal bus → existing `canvas-hmr` (`asset`/`css`/`meta` heal modes) → **the exact bug the user sees today (bytes arrive, cloud tab stays broken) dies in increment 1**.
2. **Studio-child write** (browser upload, canvas-edit, projection materialization of doc lanes — the latter are canvas-owned class and ledger-EXEMPT): child POSTs `commit-local` over loopback (pairing token) → hub appends → poke (origin-tagged so the child skips its own echo).
3. **Desktop write** (user/agent edits a file): existing single `fs:any` handler → debounce 400 ms → hash → `PUT /api/file` → ledger → poke → other peers pull. Desktop's own pulls self-announce to its UI (no reliance on FSEvents luck).
Echo suppression collapses to two mechanisms: origin tags on pokes/entries + hash-idempotence (a pulled file's PUT is a no-op by hash). The fast-push probe-guard, `REFERENCE_FILE_RE` heuristic, `announceWrite` bridge, and the sweep's probe-skip all die.

### 2.4 The ONE decision table

Pure module (grown from `cold-start.ts`'s discipline), sole applier on each peer:
```
decide(local, remote, ancestor):
  local==remote                     → noop (adopt ancestor=hash)
  remote==ancestor, local differs   → PUSH local
  local==ancestor, remote differs   → snapshot local to _trash → PULL (fail-closed: park refused ⇒ pull refused)
  local absent, remote tombstone    → noop
  local==ancestor, remote tombstone → quarantine to _trash (never rm), adopt
  local differs,  remote tombstone  → KEEP local + PUSH up (edit beats delete)
  local absent (never had), remote present → PULL (admission-gated)
  no ancestor, both present, differ → KEEP local + park remote copy as <name>.sync-conflict-<ts>-<origin> + push conflict copy up (both ends SEE it — Syncthing move)
  epoch changed                     → ancestors are not overwrite authority: degrade every "PULL over local change" to keep-local + park-remote + push-local-up
```
DDR-223's law is structural here: an empty file is just a hash; it wins only if the loser equals the ancestor — *unstamped emptiness cannot beat content by construction*. Wire mtime/stamp is never an overwrite input (F4). The doc lanes keep their existing `decideColdStart`/`decideAnnotationsColdStart` tables; the companion increment (shared-doc cutover, DDR-064's unfinished half) reduces their appliers to one.

### 2.5 Delivery-state model — the doručenka

Per file: `LOCAL → ON HUB (ledger seq S) → PEER p (cursor ≥ S) → UI HEALED (cell: child_applied ≥ S; desktop: self-announced)`. Sync panel answers "is X delivered everywhere?" as: ledger entry seq vs `min(peer_cursor)` over peers seen in the last 14 days (stale peers labeled, never silently dropped) + child_applied. Failure of any hop is a per-file row in `_sync.json` + panel (the DDR-214 rejected "Connect Run sheet" — its named revisit trigger has fired; refusal still outranks unreachability outranks any count, `synced` remains a positive assertion).

### 2.6 Accounting

- **Lanes after: 2.** (1) CRDT doc lanes — KEPT, unchanged scope. (2) Ledger file lane — one bidirectional transport for everything else VERSIONED. Git+R2 backup = durability record, not a sync lane (no peer ever reads it for sync).
- **Stores on the cell: 1 serving store** (checkout). R2 = write-behind CAS + backup generations (no serving/probe semantics — completes DDR-224's direction); ledger SQLite = metadata, not a file store.
- **Cold-start implementations: 1 per plane, 1 applier each** (file plane: the table above, day one; doc plane: existing tables, single applier after the cutover increment — until then doc-plane stays 2×, honestly counted).
- **Seven lanes mapped:** L1 CRDT → KEPT. L2 sweep → DELETED (boot reconcile = one `changes?since=cursor` diff). L3 fast-push → DELETED (the ledger push IS the fast path). L4 asset-pull → DELETED (reference-scan heuristic dies; DS-asset-substring 404 artifact dies with it). L5 file plane → PROMOTED (classifier becomes THE membership oracle; `file-pull.ts` chassis becomes the applier; flag `linkedHub.syncFiles` becomes the v2-engine switch, F1–F6 gate re-run at flip). L6 bucket mirror → DEMOTED to write-behind CAS by hash. L7 git autocommit/rehydrate → KEPT as record (desktop dead `autocommit.ts` deleted).

### 2.7 Scenario walkthroughs (GitSync contrast in brackets)

**Fresh link.** Tombstones learned first (existing order), doc lanes handshake per existing cold-start. File lane: cursor absent ⇒ `changes?since=0` (= manifest, head H, epoch E). Per entry through the table with empty ancestors: remote-only → admission-gated pull (batched ≤500/pass, F6 aggregate byte budget, loud caps); equal-hash → silent ancestor adoption; both-differ → keep local + park remote copy + push copy up (nothing lost, both ends see it); local-only VERSIONED files → push up. Cursor=(E,H). Doručenka shows N/M delivered live — the 216-file parity case becomes *observable*, not archaeological. [GitSync: clone or fetch-all = one giant pack vs body caps; classifier-gated materializer walks the tree anyway.]

**Offline edits both sides + reconnect.** Doc lanes: existing journal-gated CRDT cold start (unchanged). Files: pull `changes?since=cursor`; per path: only-remote-moved → pull (prior bytes parked); only-local-moved → push; both-moved → conflict-aside, copy propagates; local-deleted-while-remote-edited → remote wins (edit beats delete); remote-tombstone-while-local-edited → local survives + re-pushes. No LWW by wire mtime anywhere. [GitSync: same table inside a hand-rolled tree-merge, plus non-FF push retry loops.]

**Cell container restart mid-transfer.** Mid-PUT: tmp never renamed ⇒ invisible; desktop retries idempotently by hash. Crash between rename and ledger append: boot checkout-walk appends the repair entry. Warm start: `/data` intact, cursors valid, pokes resume. Cold start (rehydrate from generation): checkout + `hub.db` (ledger INSIDE it) restore from the SAME generation ⇒ mutually consistent snapshot; **epoch bumps** ⇒ every peer gets `{resync:true}` ⇒ full three-way in epoch-degraded mode: anything the backup missed is *re-pushed from desktop disk* (local≠restored-remote + epoch rule ⇒ keep-local/park/push-up), and a genuine cloud-side edit made just before the snapshot surfaces as a visible conflict copy instead of silently losing to either side. This structurally retires the "restore = stale peer overwrites" hazard class (DDR-102's founding incident, generalized). [GitSync: restored repo = force-moved history the protocol forbids; reconciling desktop's sync repo against a rewound remote is git's worst case.]

**50 MB video drop (desktop).** `fs:any` → 400 ms settle → sha256 (~0.1 s) → one streaming PUT (cap 100 MB stands; in-process single-file transfer per DDR-225's qualification of the DDR-222 wall — no mass walk, no child spawn) → rename → ledger → poke → cloud child heals `<img>` via existing `asset` HMR mode; other desktops pull on the same poke. Wall-clock ≈ upload time + ~1 s. Failure: loud per-file row, retry from zero (resumable upload deliberately NOT v1; idempotence makes retry safe; R2 multipart is DDR-194's named trigger if ever needed). [GitSync: pack assembly of 50 MB in-process beside the editor (DDR-222 wall) or a new child; then one non-resumable POST.]

**Delete on one side.** Desktop deletes a DS file: fs observation (file gone, ancestor present) → `DELETE /api/file?prevHash=` (CAS precondition; 409 if hub moved ⇒ pull first). Hub: tombstone entry, checkout file removed (blob survives in R2 CAS + git history — recoverable), poke. Peers: local==ancestor ⇒ quarantine to `_trash/` (never rm), adopt; local≠ancestor ⇒ keep + resurrect. Deletion now PROPAGATES (fixing Plane-B's v1 gap) with the branch-switch-mass-delete hazard handled by the same table (mass tombstones only ever quarantine — recoverable) + a loud threshold warning when one batch tombstones >N files. Canvas deletes keep the existing privileged tombstones lane (doc plane). [GitSync: identical semantics, commit-shaped — one of the few places git matched.]

### 2.8 Security posture (point map)

One upload door instead of two (both DDR-217 gate sets merge); ledger `path`/`class`/`stamp` are hints — receivers re-classify via `file-membership` + canvas-path validation, refuse symlinks (lstat on reads), never write outside realpath-contained resolved parents; blob GET re-hashes (substitution impossible); poke is payload-free (hub cannot inject paths through the event channel); changes/cursor routes rate-limited; F6 aggregate pull budget loud; owner gate on code-module unchanged; `restrictImportsTo` unconditional; two-locks coupling untouched (tsx admission still sandbox-coupled); DDR-193 containment untouched (no evaluation moves anywhere); new routes in NEITHER canvas allowlist; credentials stay 0600-file per-machine (consent boundary unchanged); CI kills sync. F1 (hub-synced docs as prompt-injection vector into `.design/system/**`) is unchanged by this redesign and its mitigation (untrusted-data delimiting, `_untrusted/INDEX.json`) rides the flip gate as before.

### 2.9 What the ledger does NOT change

Doc-lane vocabulary and caps (`codec.ts`), auth/renewal discipline, shared-WS provider factory, supervisor restart-by-value, quarantine-never-delete, `_history` snapshots, status spine (it gains per-file rows), DDR-192 doc naming, transport scar tissue (`connection: close`, Retry-After, bounded error snippets — kept inside the new door's client).

### 2.10 The single scariest risk (honest)

**The ancestor store is a third truth, and one write-ordering bug in it rebuilds the eraser inside my own core.** If any code path ever records an ancestor *before* its bytes actually landed (crash between ancestor-write and rename, or a future refactor inverting the order), a remote change then reads as "local unchanged ⇒ pull" and overwrites a real local edit — the DDR-076/102/223 class, reborn in the mechanism that was supposed to end it. Mitigations are real but must hold forever: (1) ordering is enforced in ONE module with a test that kills the process between the two writes and asserts the conservative outcome; (2) every pull parks prior bytes in `_trash/` *unconditionally* — even a wrong decision is recoverable, never destructive; (3) a lost/corrupt ancestor store fails safe (everything degrades to conflict-aside noise, not loss). Secondary risks, named: Hocuspocus stateless is unused code in our stack until increment 1 exercises it under the worker splice (fallback: the 60 s reconcile makes pokes an optimization, never a correctness dependency); and ledger-vs-checkout drift if any future write door forgets to append (countered by the boot walk + a CI grep pinning every `rename(` in write doors to an adjacent `ledger.append`).

---

## PART III — Head-to-head and the ship call

| Criterion | GitSync (b) | Bill of Lading |
|---|---|---|
| Deletes the 7-lane sprawl | yes, but adds smart-HTTP server, tree-merge driver, second repos both sides, pack budgeter | yes; adds one table, three routes, one poke |
| Live events | needs the WS poke anyway | native |
| 50 MB media, cell physics | history accretes into every bundle/rehydrate; boot window regresses | blobs flat in CAS; history stays in git *without* media (status quo) |
| DDR-054 | must bypass checkout; git config/transport RCE surface (DDR-131 receipt) | receiver validation is the design |
| Engines | iso-git (documented slow/throwy) + system git, forever | none new |
| Doručenka | commit-granular | per-file, table lookup |
| Fresh link | one unsplittable pack vs platform body caps | batched, capped, observable |
| What survives of the giant | — | git keeps history-of-record, seed, checkpoint, rehydrate; the ledger is rebuildable from checkout+git on disaster |

**Ship Bill of Lading.** It is the CouchDB/Dropbox/Syncthing convergence point implemented over surfaces Maude already owns, it satisfies every §7 invariant structurally rather than by vigilance, and it keeps git exactly where three DDRs (195/198/199) proved it earns its keep.

## MIGRATION
# Migration from v0.60.7 — strangler increments (sync never breaks)

Ordering principle: **additive first, observable second, replace third, delete one release after replacement soaks** (DDR-198 posture). Each increment is a shippable release; rollback stated per increment. The F1–F6 security gate (`/flow:validate-security`) runs as a HARD gate at increment 3 (the engine flip), and the acceptance bar throughout is file-for-file parity on a REAL project tree (alligators + alligators-mirror), not fixtures.

## Increment 1 — Ledger + poke, shadow mode (v0.61.0) — kills the live bug immediately
**Changes:** hub creates `ledger` table in `hub.db`; every existing write door (`PUT /assets/`, `PUT /_asset-file/`, studio-proxy asset hooks, tombstone route, child `commit-local` for its API writes) appends after rename; `GET /api/changes?since=` added (seq-0 response = today's manifest, shared code with `file-manifest.mjs`); hub broadcasts stateless poke `{t:'ledger', seq}` on open Hocuspocus connections; **studio child subscribes on its existing loopback provider and re-emits the internal fs-event → existing `canvas-hmr` asset/css/meta heal** — the ground-truth §3 prime suspect (hub PUT invisible to child) is dead; desktop subscribes and maps poke → existing `pullRemoteNow()` (no new applier yet — the 20 s poll gains an event trigger).
**Files:** `apps/hub/src/ledger.mjs` (new, ~250), `server.mjs` (door hooks + broadcast, ~80), `studio-child.mjs`/`apps/studio/sync/index.ts` (poke subscribe, ~60), `file-manifest.mjs` (changes endpoint reuse, ~60). Nothing deleted.
**Rollback:** pokes ignored client-side / endpoint dark — v0.60.7 behavior intact (all old lanes still run).

## Increment 2 — Doručenka surface (v0.61.x)
**Changes:** `peer_cursor` + `child_applied` tables; desktop reports cursor after each applied poll; Sync panel + `_sync.json` render per-file rows: on-hub(seq)/per-peer/UI-healed; stale-peer labeling. Pure observability — no transport behavior changes.
**Files:** `ledger.mjs` (+cursor routes ~80), `apps/studio/sync/status.ts`/`presentation.ts` (+rows ~150), client Sync panel (~120).
**Rollback:** hide the panel section; rows are advisory.

## Increment 3 — Desktop file-lane v2 behind the existing flag (v0.62.0) — HARD security gate F1–F6 re-run
**Changes:** generalize `file-pull.ts` into the ledger applier: ancestor store (new runtime-state path added to ALL four DDR-115 taxonomy lists + tripwire test extended), cursor+epoch, the ONE three-way table module (`sync/ledger-table.ts`, pure, unit-tested incl. kill-between-writes ordering test), conflict-aside naming + propagation, tombstone apply via quarantine. `linkedHub.syncFiles: true` now selects the v2 engine; flag default flips ON only after the gate passes + one soak release. Asset-pull (`asset-pull.ts`) is bypassed when v2 active (top-level assets are ledger members). Reconcile poll demoted 20 s → 60 s under v2.
**Files:** `sync/file-pull.ts` (rework ~+400/−150), `sync/ledger-table.ts` (new ~200), `sync/index.ts` (wiring ~100), taxonomy lists ×4.
**Rollback:** flag OFF ⇒ v1 lanes (sweep/fast-push/asset-pull/file-pull) untouched and still running — they were never removed.

## Increment 4 — Push side unification + deletions (v0.62.x → v0.63.0)
**Changes:** desktop `fs:any` → hash → `PUT /api/file/<rel>?hash=` (single door; server merges both DDR-217 gate sets; old doors become shims appending to the ledger — old desktops keep working one release). Delete after one soak release: `asset-sweep.ts`, `asset-push-worker.ts`, most of `asset-push.ts` (keep `putWithRetry` transport lessons inside the new door client), fast-push wiring (`queueFastPush`/chain), `requestFastPull` + `REFERENCE_FILE_RE`, sweep wiring, `announceWrite` bridge + container write bridge special-casing, probe-guard paths, desktop dead `autocommit.ts` + wiring. Boot reconcile = one `changes?since=cursor` diff (no walk, no spawn — DDR-222 wall satisfied by elimination).
**Rollback:** shims keep v1 clients alive; re-enabling v1 lanes is a revert of the deletion commit (they are deleted, not rewritten, so revert is clean).

## Increment 5 — Cell store demotion (v0.63.x)
**Changes:** R2 becomes write-behind CAS keyed by sha256 (dedup; `asset-lane.mjs` sweeper coupling and probe "present=both" semantics deleted; hydrate shrinks to boot restore); `assets.mjs` PUT branches/`streamToFile`/`handleCheckoutAssetRoute`/`handleAssetProbeRoute` deleted (~700); `GET /assets/` stays as read proxy for canvas `img-src 'self'`. Epoch mechanics: rehydrate stamps a new epoch; peers handle `{resync:true}` (already built in inc 3).
**Rollback:** R2 layout is additive (hash keys beside old keys during transition); revert re-enables old sweeper.

## Increment 6 — Shared-doc cutover (companion, separable — can run parallel from inc 2)
**Changes:** desktop flips `MAUDE_SHARED_DOC=1` default (DDR-064's unfinished cutover): delete `agent.ts` + two-doc relay observers + queuedOps agent-origin wiring (~800); `projection.ts` + `migrate-seed.ts` become the single doc-plane applier — first fixing the verified drift (migrate-seed's missing `recover-seed-dup` case + missing default). Cold-start applier count: 1.
**Rollback:** env flag back OFF (both paths coexist until the deletion release, which lands only after soak).

## Verification gates per increment
- inc 1: live cloud-tab heal on a hub-door PUT (the today-bug), observed via CF `containers` dataset; poke loss test (kill WS mid-poke ⇒ 60 s reconcile catches).
- inc 3: real-tree parity 216/216 byte-for-byte (repeat of Plane-B acceptance) + kill-between-writes ordering test + F1–F6 gate.
- inc 4: `check-bundle-completeness --smoke` (no sweep child left behind in the .app), packaged-app gate per DDR-177.
- inc 5: rehydrate drill from a generation with epoch bump ⇒ peer re-push heals the gap (the new scenario-3 property, tested against the real image per DDR-198 "run the image").

**Sequence summary:** v0.61.0 (ledger+poke+heal) → v0.61.x (doručenka) → v0.62.0 (engine v2 behind flag + gate) → v0.63.0 (push unify + delete v1 lanes) → v0.63.x (store demotion) → v0.64 (doc-plane cutover complete). ~4 releases with soak between deletions.