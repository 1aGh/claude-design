# Feature: Sync v2 burn-down + the shared-doc epilogue

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Provenance.** Split out of [`feature-sync-journal-file-plane.md`](archive/feature-sync-journal-file-plane.md)
> on 2026-08-18, at that plan's close. Increments 0–4.5 and 6 shipped there; the two
> increments left are the ones whose precondition is **time**, not code — they delete
> working code, and the strangler rule that governed the whole arc says nothing is
> deleted until its replacement has soaked a release. Keeping them in the parent plan
> would have meant either holding a finished arc open indefinitely or breaking the one
> rule that made it safe.

## Description

Two deletions, each gated on a real soak:

- **Increment 5 — burn-down.** The old transfer engines are now dead weight: the
  journal file plane carries everything they carried, in one lane, with one decision
  function. Removing them is worth roughly −900 lines of core sync and, more
  importantly, ends the jurisdiction overlap that produced most of the v0.60.x bug week.
- **Increments 7–8 — the shared-doc epilogue.** `MAUDE_SHARED_DOC` default ON, then
  one release later the deletion of `agent.ts` and the two-doc relay (~800 lines). This
  touches the DOC plane, which the journal arc deliberately left alone.

## Problem

The parent arc replaced seven sync mechanisms with two, but replacing is not the same
as removing: the old lanes are still compiled, still shipped, still running for
flag-off projects, and still able to write the same files the new lane writes. Every
one of them is a second opinion about a file's fate that nobody consults on purpose.

The reason they are still here is sound and temporary. A strangler migration keeps the
old path until the new one has proven itself on real trees, because the failure mode of
deleting too early is silent data loss with no rollback. That proof is a released
version in real use, which is exactly what a plan cannot assert about itself.

## Solution

Delete on evidence, in two waves, each after its replacement has shipped and soaked.

> **Preconditions OVERRIDDEN — user decision, 2026-08-18.** Executed on
> `feat/sync-journal-file-plane` before any release carried Increments
> 4/4.5/6: the branch is a bulk release of several features, so the soak
> window the preconditions describe never existed. Consequences accepted:
> the new lane and the deletion of the old ship in ONE release, so the
> burn-down's rollback is its revert commits (each deletion is one), not a
> flag flip. Two gates survived the override because they bind on
> measurement/order, not on the merge: the poll stays at 20 s (precondition
> 2 was never measured), and Task 3 (Increment 8) is NOT in this bulk —
> deleting `agent.ts` in the same release as the default-ON flip would
> destroy Task 2's config-flip rollback.

## Preconditions (BINDING — this plan does not start until they hold)

1. A release carrying Increments 4/4.5/6 has shipped and soaked at least one release
   cycle in real use — not a green test suite, a released version people ran.
2. The poke-miss counter measured ≈ 0 in that window. It is what decides whether the
   20 s poll may relax to 60 s; without the measurement the poll stays where it is.
3. No open regression attributable to the file plane, the deletion lane, or the mode
   model.

## Metadata

- **Type**: Refactor (deletion)
- **Complexity**: Medium — mechanically simple, gated on evidence rather than effort
- **App/Package**: `apps/studio` (sync/), `apps/hub`
- **Dependencies**: none new; this only removes

---

## Inherited security findings (from the 2026-08-18 close)

The second two-seat review of Increments 4/4.5/6 left these open. They are
recorded here rather than in the closed plan because several of them only
become reachable, or only become worth the change, once the burn-down lands.

Reports: `.ai/logs/security-reviews/sync-v2-inc456-{defender,attacker}.md`.

- **F-1** a tombstone bypasses the receiver's per-class admission gate — a hub
  that may not WRITE code modules can still DELETE them.
- **F-3** no delete breaker at the hub door, where one token fans out to every peer.
- **F-4** the READ half of the file lane judges scope on the lexical path while
  judging class on the real one — the same split the write half was fixed for.
- **F-6** `_trash/` has no retention on either end and is invisible to everything
  that measures the tree. Increment 5 owns the write-behind that would give it
  a durable counterpart.
- **F-7 / F-8 / F-14** `handleDelete` reports success without confirming the
  tombstone appended, may echo a WRITE row's seq, treats "no row" as "already
  deleted", and `x-maude-expect-hash: none` means different things on PUT and DELETE.
- **F-11 / F-12** the re-anchor storm limit has no recovery path (and its comment
  claims one); the poke cooldown covers the poke channel but not the reconnect.
- **F-13 / B12** `designRel` reaches git as a pathspec, unvalidated. Latent today.
- **B6** a tombstone is honoured under a degraded epoch, using the ancestors the
  degrade just disqualified.
- **B8** the untrusted markers miss the one hub-authored file most likely to be
  read as spec.
- **B11** `settleOwnership` mutates `.gitignore` and the index on a branch that
  matches ordinary repos, without asking in the non-TTY case.
- **B13** `parkedRemote` never expires and is never re-validated against the copy
  it names.
- **B14 / B15** DELETE's precondition is optional and every real session token is
  wildcard-scoped; scope prefix matching does not fit file paths.

**The object-storage widening (B2) is Task 1's, explicitly.** The whole plane
needs the write-behind, not just `assets/` — today `companion-text` and
`code-module` are durable only through the hub's git history, which works but
puts every class in one basket. **Closed by Task 1** (`48d6e801`): the
journal-driven write-behind covers every plane class, `hydrateFiles` is its
restore half.

### From the burn-down's own two-seat review (2026-08-18)

Defender **PASS** (0 crit/0 high — two passes:
`.ai/logs/security-reviews/sync-burn-down-defender.md` +
`sync-v2-inc5-7-defender.md`), attacker **3 findings reassessed as non-blocking
for this diff** (returned inline; verdict in the graph). The two LOW parity
items the defender raised were
fixed at the close (canvas-origin guard mirrored onto the legacy PUT alias;
realpath re-check at the write-behind read site). What remains, forwarded to the
FILE-PLANE worklist rather than the deletion:

- **B8 restated + promoted (companion-text as an injection lane).** The attacker's
  Chain 1: a hostile hub (DDR-054 untrusted) journals a `.md`/`.css` the peer
  never referenced; `file-pull` admits it as `companion-text` (only `code-module`
  is owner-gated), it lands in the design root, and the coding agent / `maude
  design *` helpers later read it as spec — the trifecta, structurally. This is a
  **parent-arc** property (the manifest pull replaced reference-derivation in
  Increment 3; the burn-down only deleted the already-dead `asset-pull.ts`), and
  it is the same concern as inherited **B8**. Fix belongs with the file plane:
  gate/quarantine hub-originated plane-B prose, or mark it untrusted at the agent
  boundary. Not this deletion's to close.
- **A7 consent is a `console.warn` a GUI user never sees (MEDIUM, at the floor —
  the one live item from the close).** The DDR-064 A7 notice fires via
  `noticeSharedDocOnce` → `console.warn`. That was accepted for CELLS (consent by
  configuration — the operator turned pairing on). The default-ON flip makes
  shared-doc the desktop default, and the DDR-177 desktop user is terminal-free,
  so the notice is operationally invisible to exactly the user the cutover newly
  reaches. **Not a data-exposure regression** — the flip changes the doc
  MECHANISM (one Y.Doc vs two), not which hub receives data, and hub trust is
  consented at LINK time (URL + token) under both paths. But the checklist item
  is half-met on desktop. **Fix: a GUI consent surface** (toast/panel) for the
  first shared-doc engagement against a hub — desktop UI work, DDR-064's to own.
  Tracked as a **BINDING follow-up before Increment 8** (the relay deletion),
  since after that there is no two-doc path to fall back to. Attacker report:
  `.ai/logs/security-reviews/sync-v2-inc5-7-attacker.md`.
- **F1 write-behind symlink read (MEDIUM) — CLOSED at the close** (`3fdcc233`):
  `createWriteBehind` now `containedReal`-checks the realpath before reading
  bytes, so a committed `assets/x.png -> /etc/passwd` that ever slipped a journal
  producer is refused rather than mirrored to durable storage. Was the defender's
  L-2 and the attacker's F1; the attacker reviewed the pre-fix HEAD.
- **Default-ON on UPGRADE (attacker creativity finding).** `syncFiles` +
  `propagateDeletes` + `sharedDoc` are all default-ON, so a self-hoster's first
  upgrade enables the whole plane before they read the rollback note. Consider a
  first-upgrade prompt rather than a silent enable — a product decision for the
  file-plane arc, not the burn-down. Related to the A7 item above.
- **Probe `holds()` omits `matchesScope`** (both seats, below floor). An existence
  oracle across token scopes within one checkout — **pre-existing**, and the
  burn-down strictly narrowed it (removed the bucket-read half). Filed, not
  regressed.
- **OIDC browser-auth door** (`handleOidc` + `oidc*.mjs`, landed in `48d6e801` by a
  concurrent session) — out of scope for this audit; needs its own AppSec pass.

## Tasks

### ✅ Task 1: Increment 5 — burn-down (M) — DONE 2026-08-18

> Shipped as four commits (each deletion its own revert): `6b391402` (the
> reference-derived asset pull + the downward fast lane), `74d4a2d3` (the
> out-of-process sweep + worker + fast push; `asset-push.ts` re-headed as THE
> legacy compat client, in-process, lane decided ONCE per boot by the
> capability probe — `decidePushLane`), `48d6e801` (hub: journal-driven
> `createWriteBehind` over `mirrored_at_ms` covering ALL plane classes +
> `hydrateFiles` restore half; legacy PUT routes delegate to the file door;
> `/_asset-probe` reduced to a checkout-only shim; STORE DRIFT warn on
> bucket-fallback serving). Poll kept at 20 s (measurement gate). Core delta:
> **−801 lines** in `apps/studio/sync` + `apps/hub/src` vs the pre-burn-down
> tip (`d846a3f6`); the "negative vs v0.60.7" criterion is unassessable as
> written because this bulk branch also ADDS the whole file plane that
> v0.60.7 predates.
>
> **Deviation, recorded — `announceWrite` STAYS.** The plan lists "the
> `announceWrite` inference bridge" for deletion, but what became dead was
> only its consumption by the fast lanes (deleted). The function itself is
> load-bearing for Sync v2: `cell-write-nudge.ts` stakes its completeness
> argument on `announceWrite` covering doc→file projector writes (the one
> write path that arms no `activity:suppress`), and the cell's HMR heal
> rides the same synthetic `fs:any`. Deleting it would have silenced the
> nudge for every projection write on every cell.

- **Do**: DELETE `asset-pull.ts`, `asset-sweep.ts` + `asset-push-worker.ts` as a transfer
  engine, ~450 lines of `asset-push.ts` (the transport core survives inside the door
  client), the fast-push wiring + `requestFastPull` + `REFERENCE_FILE_RE`, the
  `announceWrite` inference bridge, and the probe route (keeping a checkout-only compat
  shim for the legacy window). Hub `asset-lane.mjs`'s sweeper becomes a ~150-line
  journal-driven write-behind covering ALL file-lane classes, which also closes the
  `system/**/assets/*` durability hole. `assets.mjs` PUT branches delegate to the one
  door. Poll 20 s → 60 s **only if** precondition 2 holds.
- **Keep**: the legacy pull/push client, ≥ 2 releases, for journal-less self-hosted hubs
  (Open decision 4).
- **Validate**: `apps/desktop/scripts/check-bundle-completeness.mjs <built .app> --smoke`
  (no sweep child left behind); new-desktop-vs-old-hub e2e still pushes and pulls
  through the legacy client; store-drift alert — any post-boot bucket-fallback serving
  is an alarm, not a fallback.
- **Rollback**: each deletion is its own revert commit; the cell-side legacy sweep stays
  reachable for one release via the `workflow_dispatch` runbook.

### ✅ Task 2: Increment 7 — shared-doc default ON (M) — DONE 2026-08-18

> Shipped as `b2c0c961`: `sharedDocEnabled()` (one exported parser, default
> ON, explicit `MAUDE_SHARED_DOC=0` = the rollback flip) consumed by both
> `server.ts` and the pairing interlock. Nothing deleted; both doc paths
> coexist. DDR-213 items re-checked on the desktop path (A7 notice, A6
> ceiling, A4 collision exclusion, comments caps).
>

- **Do**: desktop `MAUDE_SHARED_DOC` defaults ON (the DDR-064 cutover), re-verifying the
  desktop-specific items on the DDR-213 checklist. **No deletion in this release** — both
  paths coexist so the flip is a config flip back.
- **Validate**: real-tree link + the full cold-start matrix against the single applier;
  `maude design perf` before and after.
- **Rollback**: config flip.

### Task 3: Increment 8 — delete the two-doc relay (M) — DELIBERATELY NOT IN THE 2026-08-18 BULK

> Task 2's rollback is `MAUDE_SHARED_DOC=0`, which requires `agent.ts` and
> the relay to exist. This deletion starts only one release after the
> default-ON flip soaks — the one internal gate the override left standing.

- **Do**: one release after Task 2 soaks, DELETE `agent.ts`, the two-doc relay observers
  and the agent-origin `queuedOps` wiring (~800 lines). Cold-start callers: 1.
- **Validate**: same matrix as Task 2, plus the perf smoke.
- **Rollback**: revert the deletion commit.

---

## Validation

Per increment, same ladder as the parent arc:

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` — check `git status apps/studio/dist/` before AND after
3. **Build**: `pnpm --filter @maude/site build`
4. **Parity/tarball**: `bash scripts/check-version-parity.sh`, `bash scripts/check-tarball-shape.sh`
5. **Real-tree acceptance**: fresh link alligators → alligators-mirror, byte parity of the VERSIONED set
6. **Desktop self-containment**: `check-bundle-completeness.mjs --smoke` + `check-client-boots.mjs` against the built `.app`
7. **Fleet verify**: `.ai/release-guide.md` § "Verify the fleet actually rolled"

## Acceptance Criteria

- [x] ~~Preconditions 1–3 documented as MET~~ — **OVERRIDDEN by user 2026-08-18** (see the Preconditions note); the poke-miss figure remains unmeasured, which is why the poll did not move
- [x] After Task 1: burn-down core delta **−801 lines** (`apps/studio/sync` + `apps/hub/src`, 594+/1395− vs `d846a3f6`); the v0.60.7 comparison is unassessable on this bulk branch (it also ADDS the whole file plane) — recorded honestly rather than claimed
- [x] Poll **kept at 20 s** — relaxation stays measurement-gated
- [x] Legacy pull/push client present (`asset-push.ts` legacy header + `file-pull.ts`), lane-gated by the capability probe; source-pinned by `sync-asset-push.test.ts` (an old-hub LIVE e2e remains a /flow:done item — no journal-less hub exists in-tree to drive)
- [x] After Task 2: both doc paths coexist; nothing deleted (`MAUDE_SHARED_DOC=0` verified as the rollback flip in tests)
- [ ] After Task 3: one cold-start applier, one code path, perf no worse than before — **next release, after the default-ON soak**
- [x] `pnpm --filter @maude/site gen:roadmap` regenerated at each plan-status change

---

## Retro (2026-08-18, Tasks 1–2 closed under override)

- **The strangler pattern paid off even when the soak gate was overridden.** The
  parent arc had already made the old engines dead code — `file-pull.ts`
  superseded reference-derivation, `syncFiles` defaulted ON — so Increment 5 was
  a deletion of already-unreachable paths, not a risky cutover. That's why
  shipping the plane and its deletion in one release stayed safe despite the
  preconditions being waived: the risk the soak guarded against had already been
  retired one arc earlier. The lesson for the next plan: a burn-down's real risk
  lives in whether the replacement is *live and exclusive*, not in the calendar.
- **"One door" is worth more than a per-URL guard.** Consolidating the legacy PUT
  routes onto `handleFileDoor` meant the security review had ONE admission path
  to reason about. The attacker's "you lost the `assets/`-subtree containment"
  finding evaporated under that lens — the door's realpath containment covers it,
  and re-adding the old guard would have reintroduced the divergence. When a
  reviewer flags a "lost guard," check first whether consolidation absorbed it.
- **The lane-decided-once-per-boot pattern (`decidePushLane`) is the cheap way to
  prove mutual exclusion.** Both defenders independently confirmed the plane and
  the legacy client can never both push — because one boolean, set once, gates
  it. A per-call check would have needed a whole invariant argument; a boot-time
  verdict made it a one-line proof. Reach for this shape whenever two lanes must
  never coexist.
- **What the override cost, honestly:** the "negative LOC vs v0.60.7" acceptance
  criterion became unassessable (the bulk branch adds the whole plane v0.60.7
  predates), and three validation items (real-tree byte parity, desktop
  self-containment against a built `.app`, fleet verify) move to the release, not
  the close. `--quick` compounded this — build + cross-platform + a11y were
  skipped. A full `/flow:validate` before merge is mandatory, recorded in STATE.
- **Process nit:** `maude kg record-log` failed with an ENOENT on its temp path
  when recording the security verdicts. Worked around by folding the verdict into
  the plan-close decision. Worth a bug-fix pass on record-log's temp-dir handling.
