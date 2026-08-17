# Desktop sync map — apps/studio/sync/ (12,177 lines, 36 modules)

Ground truth doc read first (`.ai/plans/notes/sync-architecture-ground-truth.md`); everything below verified against source at the listed paths. Desktop runs the **two-doc agent architecture** (`MAUDE_SHARED_DOC` is opt-in, default OFF — `server.ts:59`); the projection/migrate-seed path runs only under cell pairing (which *requires* `MAUDE_SHARED_DOC=1`, `cell-pairing.ts:162`). Key line refs: `sync/index.ts` = 3,380 lines; `createSyncRuntime` at index.ts:375, `start()` at :931, `stop()` at :2466.

---

## 1. Lanes: trigger → transport → destination → reconciler → failure surface

**Lane 1 — CRDT doc lanes (per canvas)** — `agent.ts` (desktop) / `projection.ts`+`migrate-seed.ts` (shared-doc), `codec.ts`, wired in index.ts `attachCanvas` (:1905)
- Trigger up: `fs:any` bus event → `FsReader` 250 ms quiet window (`fs-mirror.ts`) → `applyFromFs` on whichever agent/projection claims the absolute path. Trigger down: Y.Doc `update` event → 800 ms debounced flush (`DOC_FLUSH_MS`/`PROJECT_FLUSH_MS`).
- Transport: Hocuspocus WS, **one shared WebSocket per hub URL** multiplexing all per-canvas providers (`createDefaultProviderFactory`, index.ts:3188).
- Destination: hub Y.Doc (wire name via `doc-name.ts` DDR-192 namespacing) ↔ 5 disk files (body `.tsx/.html`, sibling `.css`, `.meta.json` shared subset, `_comments/<slug>.json`, `<slug>.annotations.svg`).
- Reconciler: cold-start decision tables at handshake (`handleSynced` → `agent.reconcile()` or `migrateSeed()`+`projection.reconcile()`); live = CRDT merge; journal checkpoints (`journal.ts`).
- Failures: auth rejections classified (`classifyAuthFailure`) → one debounced warn + `_sync.json` per-doc `auth-rejected` rows + Sync panel; reconcile throw → loud console error, doc stays `pending` (`runHandleSynced`, :1634). Conflicts → `store.addConflict` + `_history/` snapshots.

**Lane 2 — Asset push sweep (desktop→hub, out-of-process)** — `asset-push.ts` `pushAssets`, `asset-sweep.ts` (parent), `asset-push-worker.ts` (child)
- Trigger: boot (after handshakes settle, index.ts:2117) + every `fs:any` matching `isPushableAssetRel` → 1,500 ms debounce (`scheduleAssetSweep`); single-flight with trailing re-run (`assetSweepAgain`).
- Transport: spawned Bun child (DDR-222 — full sweep segfaults Bun in-process), token via 0600 temp file re-read per request, NDJSON progress over stdout. Batch presence probe `POST /_asset-probe` (survives the cloud's HEAD→GET conversion), then per-miss `PUT /assets/<key>` (top-level content-addressed → bucket route) or `PUT /_asset-file/<rel>` (everything else → checkout route), `routeFor` split. Every PUT sends `connection: close` (keep-alive desync lesson). 429 honors Retry-After (≤60 s, 5 min per-sweep budget); one 5xx retry.
- Membership: `listPushableAssets` walk → `classifyProjectFile` (flag OFF: only `inert-media` under some `assets/` dir; flag ON: all three file-plane classes).
- Reconciler: itself — idempotent, probe-first, re-run every boot/change.
- Failures: `AssetPushProgress.failures[]` → `statusStore.updateAssets` → `_sync.json` + Sync panel; a dead child is a reported failed sweep (`emitStopped` with SIGSEGV name), never a dead editor. Never under cellPairing.

**Lane 3 — Fast-lane push (v0.60.7, in-process)** — `pushOneAsset` (asset-push.ts:588), `queueFastPush` (index.ts:667)
- Trigger: same `fs:any` events, per-path 400 ms settle (`FAST_PUSH_DEBOUNCE_MS`), serialized on one promise chain (`fastPushChain`).
- Transport: one `POST /_asset-probe` (the probe-guard against re-uploading a file this peer just pulled) + one PUT, in-process (qualifies DDR-222: the wall is for the full sweep).
- Reconciler: none of its own — **the sweep is its reconciler**; failure = `console.warn "… the sweep will retry"`, exceptions swallowed.

**Lane 4 — Asset pull (every peer, incl. cell)** — `asset-pull.ts`
- Trigger: after every 20 s remote poll tick, and fast: `requestFastPull` 750 ms after any reference-bearing file lands (`REFERENCE_FILE_RE`: `.annotations.svg|tsx|jsx|css|meta.json`), single-flight + again-flag.
- Transport: derive wants LOCALLY (scan own files for `assets/<name>` refs, re-validated against `ASSET_NAME_RE` — hub can never dictate a name), then `GET /assets/<name>` per miss, `.part` tmp+rename write into top-level `assets/`.
- Reconciler: missing-only + idempotent, re-run every poll. Cap 200/pass, named loudly.
- Failures: `failed[]` log lines; 404 is ordinary ("other peer hasn't pushed yet"), retried forever.

**Lane 5 — File plane / Plane B (flag-gated, default OFF)** — `file-pull.ts`, `file-membership.ts`
- Trigger: end of every 20 s poll (`pullFilesOnce`), no-op unless `linkedHub.syncFiles === true` or `MAUDE_SYNC_FILES=1`.
- Transport: `GET /api/files` manifest (sha256+size+mtime+class per entry) → re-classify EVERY entry against local tree/config (hub class is a hint; disagreement = drop) → owner gate on `code-module` (local `hubs.json` role or loopback pairing, `allowCodeModules` index.ts:528) → `GET /_project-file/<rel>` per miss, hash verified against manifest, `.part` rename.
- Reconciler: manifest diff each poll; hash-equal = skip; conflict = LWW by strictly-newer mtime, local loser parked in `_trash/<rel>-conflict-<ts>` (`quarantineFile`), park failure = overwrite refused. Deletion never propagates.
- Failures: `dropped[]` (one warn each), `failed[]`, counts → `statusStore.updateFiles` → `_sync.json`.

**Lanes 6–7 (cell-side, for completeness)** — bucket mirror (`apps/hub/src/asset-lane.mjs`) and git autocommit/mirror/rehydrate are **not desktop code**. Notably: **the desktop-side `autocommit.ts` (396 lines) is dead code in the current runtime** — `createAutoCommit` is invoked only when `workspaceMode && !cellPairing` (index.ts:486), but that exact condition already returned `null` at index.ts:403. `autoCommit` is always null; the writer-wrap, `editorOf`, and stop-flush that depend on it never execute. On a desktop the user's own git is the history (DDR-119).

**Overlap map (same file, 2+ transports):**
- **Top-level `assets/<sha8>.<ext>`**: up via fast-push AND sweep (by design, probe-idempotent); down via asset-pull AND (flag ON) file-plane manifest — 4 desktop transports for one file, plus cell-side bucket mirror. This duplication is why the fast-push needs its probe-guard (§5).
- **DS assets (`system/<ds>/assets/x.png`)**: up via sweep/fast-push checkout route; down ONLY via file plane (flag ON). But `asset-pull`'s `REFERENCE_RE` matches the *substring* `assets/x.png` inside a nested path, so a DS-referenced name also enters lane 4's want-list and is fetched from top-level `GET /assets/x.png` — perpetual retried 404s (or a wrong-file hit on name collision) when the flag is off. An overlap artifact worth noting for the redesign.
- **Canvas sibling `.css`**: CRDT css lane when `<same-name>.tsx` exists (canvas-owned), file plane when it doesn't — decided per-receiver by the `hasFile` disk probe.
- **`.meta.json` in a canvas group**: shared subset via doc lane; whole file excluded from file plane (canvas-owned). `assets/<sha8>.photo.json`/`.audio.json`: file plane only (companion-sidecar suffixes).
- **Canvas body `.tsx`**: doc lane (Plane A) inside groups; `code-module` file plane outside groups (owner-gated). Plane disjointness enforced at classification, tested.
- **Annotations strokes vs their image bytes**: strokes ride lane 1 in ms; bytes ride lanes 2/3/4 — the latency asymmetry that produced most of the week's bug reports.

---

## 2. index.ts wiring

**Gates before anything starts** (createSyncRuntime): workspace-mode-without-pairing → null (:403); CI env → null (DDR-054 §2a); scheme allowlist (`checkUrlScheme`); doc-name resolver throw → null; no token → solo mode. Token is a mutable `let` — silent renewal swaps it in place; every consumer reads `() => token` at call time.

**start() sequence:** `resetPersistedStatus` (a new process must not serve the old one's verdict) → `migrateFlatFallback` quarantine → `scanCanvases`+`admitCanvases` (A4 slug-collision: both excluded; A6 ceiling 500 pinned rooms) → `fetchRemoteListing` (boot pull: tombstones learned FIRST, then `diffRemoteDocs` → `pullTargets` provisional flat targets → filters `tombstoned`/`admitPullTarget`/`admitPulledBody` → ceiling slice) → fresh-link one-shot group learning + config seed → `writeUntrustedMarkers` (re-run on every membership change) → statusStore (writes `_sync.json`, broadcasts `sync:status`) + connectionMonitor → `createFsReader` → `fs:any` subscription → per-canvas `attachCanvas` loop → boot settle (`Promise.allSettled`, 15 s ceiling per doc) → summary log + `startAssetSweep` → continuous discovery + delete lane subscriptions + 20 s remote poll + `scheduleRenewal`.

**Who talks to whom:**
- `ctx.bus 'fs:any'` fans into THREE consumers in one handler (:1265): `reader.notify` (doc lanes), `queueFastPush`+`scheduleAssetSweep` (asset up), `requestFastPull` (asset down). This one handler is the desktop's entire event-driven surface.
- `connectCanvas` (:1784): providerFactory (shared WS) → pre-handshake `stampCanvasPath` (non-pulled only — fix 5, prevents hub memoizing a flat fallback) → setup builds agent OR projection + (two-doc only) per-type relay observers pushing provider-doc comments/annotations into the collab room, skipping agent-origin → `onStatus` feeds monitor + `pollRemoteSoon()` on reconnect → `onAuthFailed` → `handleAuthFailure` (classify; permanent classes destroy provider + 5 min reprobe; invalid-token additionally triggers single-flight renewal) → `onceSynced` → `relocatePulled` (pulled canvases re-target from the doc's carried path) → `handleSynced` (cold-start apply + `connected`).
- `announceWrite` HMR bridge (:1317): **cell pairing only** — passed as `projection.onWrote`. In a container the recursive `fs.watch` misses atomic tmp+rename writes, so a doc→file projection write emits a synthetic `fs:any` after 250 ms (`SYNTHETIC_FS_DELAY_MS`), per-path timer replace so re-flushes collapse to one reload. Ground truth's prime suspect stands confirmed in code: only *projection* writes get this bridge — hub-process asset PUTs write to the checkout with no `onWrote`, no synthetic `fs:any`, hence no `asset` HMR heal in the cloud tab.
- Discovery: `canvas-list-update` bus → `createRescanScheduler` 400 ms → scan diff → `releaseOne`/`attachCanvas` (membership serialized on one promise chain, separate from the supervisor's start/stop chain). Empty-project boot arms a first-canvas watcher that emits `sync:needs-restart` (supervisor owns cycling).
- Delete lane: `canvas-deleted`/`canvas-created` bus (privileged API routes only, never the watcher) → `stateDocumentGone` + local `tombstoned` set; inbound: `applyTombstones` releases then `quarantineCanvas` to `_trash/` — absence before presence in every poll.
- Remote poll chain: `pullRemoteOnce` (docs) → `pullAssetsOnce` → `pullFilesOnce`, sequentially, every 20 s and via `pullRemoteNow()`.

**Every timer/interval constant:**

| Constant | Value | Where |
|---|---|---|
| `DOC_FLUSH_MS` (agent doc→file) | 800 ms | agent.ts:72 |
| `PROJECT_FLUSH_MS` (projection) | 800 ms | projection.ts:50 |
| FsReader quiet window | 250 ms | fs-mirror.ts:23 |
| `ECHO_TTL_MS` | 1,500 ms | echo-guard.ts:25 |
| `ASSET_SWEEP_DEBOUNCE_MS` | 1,500 ms | index.ts:2648 |
| `FAST_PUSH_DEBOUNCE_MS` | 400 ms | index.ts:660 |
| fast-pull debounce | 750 ms | index.ts:2406 |
| `REMOTE_POLL_MS` | 20,000 ms | index.ts:152 |
| `REMOTE_POLL_SOON_MS` (reconnect) | 1,500 ms | index.ts:161 |
| `DISCOVERY_DEBOUNCE_MS` | 400 ms | index.ts:142 |
| `AUTH_WARN_DEBOUNCE_MS` | 2,000 ms | index.ts:121 |
| `AUTH_REPROBE_MS` | 5 min | index.ts:122 |
| `BOOT_SETTLE_TIMEOUT_MS` | 15 s | index.ts:123 |
| `RENEW_MIN_INTERVAL_MS` / cap | 60 s / 3 no-progress renewals | index.ts:126,131 |
| renewal timing | 80% of remaining life, floor 60 s, clamp 2^31−1 | index.ts:1447 |
| `SEED_REPAIR_WINDOW_MS` | 10 s | agent.ts:80 |
| `JOURNAL_FLUSH_MS` | 1,000 ms | journal.ts:29 |
| sweep child token refresh | 30 s | asset-sweep.ts:45 |
| sweep kill grace | 2 s | asset-sweep.ts:34 |
| HEAD / batch-probe / PUT timeouts | 30 s / 60 s / 60 s + bytes@100 kB/s cap 10 min | asset-push.ts:137,142,151 |
| 429 Retry-After default/max; per-sweep budget | 60 s / 60 s; 5 min | asset-push.ts:79–89 |
| asset/file GET timeout | 120 s | asset-pull.ts:43, file-pull.ts:61 |
| listing/manifest fetch timeout | 6 s | remote-docs.ts:70, file-pull.ts:58 |
| progress emit throttle | 200 ms | asset-push.ts:158 |
| connection grace / escalate / flash | 30 s / 24 h / 3 s | connection-state.ts |
| `MAX_PULLS_PER_POLL` (docs) | 25 | index.ts:172 |
| asset / file per-pass caps | 200 / 200 | asset-pull.ts:56, file-pull.ts:69 |
| pinned-room ceiling | 500 (`MAUDE_MAX_PINNED_ROOMS`) | index.ts:2650 |
| HMR broadcast debounce / synthetic fs delay | 50 ms / 250 ms | hmr-broadcast.ts:32,222 |
| autocommit quiescence / ceiling (dead on desktop) | 3 s / 15 s | autocommit.ts:33,43 |

---

## 3. What the Y.Doc carries per canvas (codec.ts)

| Y type | Name | Content | Cap |
|---|---|---|---|
| Y.Text | `html` | body as **opaque text** (deliberately not XmlFragment — round-trip drift would churn forever); applied via common-prefix/suffix minimal diff | 4 MB |
| Y.Text | `css` | sibling stylesheet, wholesale replace | 4 MB |
| Y.Text | `meta` | **canonical-JSON shared subset** of `.meta.json`: keys sorted, minus `META_LOCAL_KEYS` | 1 MB |
| Y.Array | `comments` (Y_TYPES) | comment objects, wholesale LWW replace, proto-pollution reviver on parse | 1 MB |
| Y.Map | `annotations` (Y_TYPES) | key `svg` = whole SVG string | 1 MB |
| Y.Map | `syncMeta` | bookkeeping, **never materialized to disk**: `bodyEditAt` (ms) + `by` (hostname ≤32), `annotationsEditAt` (per-lane stamp, the DDR-223 fix), `seededBy` (Yjs clientID — LWW-elected single de-dup writer), `path` (designRoot-relative location; UNTRUSTED at receive, validated via canvas-path.ts) | — |

Stamps ride in the SAME transaction+origin as the content apply, so peers get one update and origin filtering holds.

**Deliberately NOT in the doc:** binary asset bytes (references only — the entire reason lanes 2–5 exist); `viewport` pan/zoom, `last_modified`, and `syncable` (the security opt-in a hub must never flip — `META_LOCAL_KEYS`); `config.json`; comments/annotations for the *projection's* doc→file direction (room owns those under shared-doc); `_history`/runtime state; any structured HTML model.

---

## 4. Cold-start decision logic

**Pure tables in `cold-start.ts`** (shared, Y-free, unit-testable):
- `decideColdStart` inputs: `{localBody, docBody, journalHash, localMtimeMs, docBodyEditAtMs}` → action ∈ `noop | materialize-hub | seed-local-up | fast-forward-hub | recover-seed-dup | conflict{winner}`. Order: both-empty → local-empty (materialize) → doc-empty (seed up, DDR-064 guard) → identical (noop+checkpoint) → exact-repeat (seed-dup collapse) → journal match (fast-forward, no snapshot) → divergence (newest-wins by `bodyEditAt` vs mtime; unknown/tie → hub, both sides snapshotted first).
- `decideAnnotationsColdStart` inputs: `{local, doc, isEmpty (=isEmptyAnnotationsSvg — recognizes the 72-byte empty wrapper), localMtimeMs, docEditAtMs, bodyWinner}` → winner ∈ local|hub|none. Rule: **unstamped emptiness never beats content**; stamped-newer emptiness is an honored delete-all; both-non-empty unstamped falls back to bodyWinner coupling.
- Plus `unionCommentsById` (union loses nothing) and `isExactRepeat` (F1).

**The two apply sites (the problem):**
1. **`agent.ts reconcile()` (:405–669)** — desktop two-doc. Applies via its own `writer` (disk) / `seedBodyUp` (doc), snapshots through `opts.snapshot`, DDR-102 fail-closed (local snapshot didn't land ⇒ hub-wins is refused, local seeded up), then comments-union, annotations table, css follows bodyWinner, meta merge.
2. **`migrate-seed.ts migrateSeed()` (:112–311)** — shared-doc/cell, invoked from index.ts `handleSynced` when a projection exists. Applies ONLY to the doc (MIGRATION transactions); disk materialization is deferred to `projection.reconcile()` (a *third* participant — its `writeHtmlIfChanged` refuses empty-doc-over-non-empty-local as its own belt).

Same tables, **two divergent application bodies** — and they have already drifted: `migrateSeed`'s switch (:197) handles `noop / materialize-hub / fast-forward-hub / seed-local-up / conflict` but has **no `recover-seed-dup` case and no default** — in shared-doc mode that decision falls through to `result='hub-wins'` and the duplicated body is kept and materialized to disk, while agent.ts:520 handles it. The eraser bug had to be fixed twice (agent.ts:601 block + migrate-seed.ts:261 block) for the same reason; this is a third, currently-live asymmetry. Also duplicated per side: fail-closed snapshot guard, journal checkpointing, annotations stamping-with-file-mtime on adopt, comments union — each exists twice with slightly different surroundings.

---

## 5. Echo / self-write suppression inventory (the multi-lane complexity tax)

1. **`echo-guard.ts`** — sha256 + 1,500 ms TTL, per-path FIFO queue; `record` before every doc→file write (agent + projection share ONE guard instance), `consume` drops the watcher echo. 108 lines.
2. **Origin tags** — agent's frozen `origin` object skipped in its own `onDocUpdate`; `ORIGINS.FILE_IMPORT / MIGRATION / DISK_PROJECTION` skipped in `projection.onDocUpdate` (a path stamp must never re-project a file); two-doc relay observers skip agent-origin transactions; queuedOps counter keys on agent origin.
3. **Fast-push probe-guard** — `pushOneAsset`'s single `_asset-probe` exists chiefly to not re-upload a file the asset-pull just wrote (own-pull echo across two *lanes*, not two processes — a tax paid only because top-level assets travel ≥2 lanes).
4. **`recentSelfSvgsRef`** (`annotations-layer.tsx:1154`) — client-side bounded 64-entry set of own recent SVG serializations; collab observer bails when incoming svg matches any of them (out-of-order echo of any recent self-write). Known residual from DDR-223: the constant 72-byte empty wrapper serializes identically across peers, so a *foreign* delete-all can be swallowed as self-echo. Plus `reconcileCommit`/`reconcileForeignEcho` opBefore-baseline folding for concurrent in-flight commits (:447).
5. **`last*` write caches** (agent lastHtml/lastComments/…; projection lastHtml/lastMeta/lastCss) — redundant-write elision, so no fs event fires at all.
6. **`writeAndAnnounce` disk-compare** (projection.ts:195) — read-before-write so an identical materialization costs no write and no reload announcement.
7. **`announceWrite` per-path timer replace** + HMR broadcaster per-file 50 ms coalescing — dedupes real-watcher + synthetic events into one reload.
8. **Seed de-dup machinery** — `seededBy` LWW election + `seedInfo` 10 s window + `isExactRepeat` + `maybeRepairSeedDuplication` (agent only, see §4): suppression of the CRDT-level echo of two identical concurrent seeds.
9. **`tombstoned` set** — suppresses the resurrection echo of a deleted canvas still present in one more listing.
10. **`pulledSlugs` race pin** — a pulled canvas whose body isn't on disk yet is not read as "removed" by the rescan (released as soon as the file exists — the hole that once kept `syncable:false` bypassed).
11. **Journal hashes** — not echo but self-knowledge: distinguishes fast-forward from divergence, preventing the "own old state treated as foreign edit" class.
12. **Batch probe skip in the sweep** (`known.has(rel)` → skipped) — idempotence as suppression.

Seven distinct mechanisms (1–7) exist *only because* the same content can arrive at the same surface via more than one route; 8–12 are correctness guards that would survive lane-count reduction.

---

## 6. Deletable under ONE manifest-driven file lane + server push events (docs stay CRDT)

Assumption: non-CRDT files sync solely via content-addressed manifest diff (file-pull.ts generalized to bidirectional) and the hub broadcasts `{file, hash}` on its existing WS after every accepted write; body/annotations/comments stay on doc lanes.

| Delete | Lines | Notes |
|---|---|---|
| `asset-pull.ts` entirely | 210 | reference-scanning wants replaced by manifest diff; `ASSET_NAME_RE` validation vocabulary migrates into the manifest lane |
| `asset-push.ts` most of it | ~450 of 634 | walk+probe+routeFor+fast-lane replaced by manifest diff + event-driven single-file upload; **keep** `putWithRetry` incl. `connection: close`, `putTimeoutMs`, `failureReason` (~180 lines of transport lessons) |
| `asset-sweep.ts` + `asset-push-worker.ts` | 346 | the out-of-process boundary exists for the walk-everything+N-probes sweep (DDR-222); a manifest diff is one GET + K uploads — same work class as today's in-process pulls. If the fault reappears, the boundary is re-addable, but its parent/child protocol, token-file plumbing, and kill choreography go |
| index.ts fast-push wiring (`queueFastPush`, timers, chain) | ~55 | replaced by "on fs:any → upload if hash missing from manifest" |
| index.ts sweep wiring (`startAssetSweep`/`scheduleAssetSweep`/cancel/stop paths) | ~90 | |
| index.ts fast-pull block + `requestFastPull` + `REFERENCE_FILE_RE` | ~45 | push events replace the reference-landing heuristic |
| 20 s poll's asset/file chaining + poll-tick shrink | ~40 | poll survives only as slow reconciler against the manifest; `pollRemoteSoon` reconnect path stays |
| `autocommit.ts` + index wiring (`editorOf`, writer wrap, stop-flush) | ~450 | **deletable today regardless of redesign** — unreachable non-null since the workspace-mode gate (see §1) |
| `announceWrite` bridge + `asset` HMR mode special-casing | ~90 (index ~60 + hmr-broadcast ~30) | a push event IS the UI heal signal; kills the container-watcher gap structurally |
| Probe-guard + probe fallback paths (`probePresent` HEAD fallback branches) | ~60 | hash-equality against the manifest is the natural echo suppression |
| If desktop also converts to shared-doc (the §6 ground-truth question): `agent.ts` + two-doc relay observers + queuedOps agent-origin wiring | ~800 | keeps projection (441) + migrate-seed (366) as the single cold-start applier — also erases the §4 drift class |

**Total: ~1,850 lines without the architecture merge; ~2,650 with it** — out of 12,177, i.e. a 15–22% cut, concentrated in exactly the modules with the highest bug density this week (DDR-223/224/225 all landed in the deletable set). What it costs: a hub manifest that covers top-level assets (exists — `/api/files` already lists them when the flag is on) and one WS event type.

---

## 7. Genuinely load-bearing — should survive any redesign

- **`file-membership.ts` classifier** (290) — the positive, default-closed enumeration with receiver-side re-validation and the hub `.mjs` mirror + tripwire test. It *is* the single-manifest lane's membership policy already; the redesign promotes it rather than replaces it.
- **`cold-start.ts` pure tables** (294) — journal-gated fast-forward, unstamped-emptiness-never-beats-content, snapshot-before-overwrite, fail-closed on snapshot failure. Keep the tables; collapse to ONE application site.
- **`journal.ts`** (190) — the "uncommitted changes?" detector; the only thing separating fast-forward from divergence. Per-hub invalidation is right.
- **`echo-guard.ts`** (108) + origin-tag discipline — required by any bidirectional file<->doc mirror, whatever the lane count.
- **`codec.ts` invariants** — byte caps on every apply (DDR-054 §2d), proto-pollution revivers, `META_LOCAL_KEYS` (especially `syncable` staying local), per-lane `syncMeta` stamps in-transaction, path-stamp derived-from-disk-never-echoed rule.
- **DDR-054 receiver posture in the pull lanes** — `admitPulledBody` (sandbox/syncTsx gate), `admitPullTarget` (never onto an existing file), `tombstoned`-before-pull ordering, `MAX_PULLS_PER_POLL` as a security cap, untrusted markers recomputed on every membership change, canvas-path validation, `stateDocumentGone` intent-vs-observation split.
- **Quarantine-never-delete** (`tombstone-apply.ts`, 131) + atomic `.part`/tmp+rename writes everywhere + `_history` snapshots — the recoverability spine.
- **Auth/renewal discipline** (index.ts DDR-102 block) — failure classification, single-flight renewal with rate floor + no-progress cap, honest boot summary, `resetPersistedStatus`. The CRDT lanes keep needing all of it.
- **Shared-WS provider factory** (:3188) — one socket per hub, status seeding, auth fanout.
- **Status spine** (`connection-state.ts` + `status.ts` + `presentation.ts`) — one store writing `_sync.json` + bus broadcast, one pure phase function for every surface. This is the foundation the ground truth's "doručenka" (per-file delivery receipt) should extend, not replace.
- **Transport scar tissue** in asset-push.ts even if the module shrinks: `connection: close` on every refusable PUT, batch-POST probe (HEAD→GET conversion), per-request time budgets, Retry-After honoring, bounded hub-supplied error snippets.
- **`supervisor.ts`** restart-by-value (DDR-149 — disk config can never re-point the socket) and membership serialization; **`discovery.ts`** nudge-not-data rescan; **loud-cap convention** (every truncation names itself).
- The out-of-process pattern of `asset-sweep.ts` (token via 0600 file, NDJSON tagged protocol, dead-child-is-reported-failure) is worth keeping *as a pattern* in the toolbox even if this instance is deleted.

**Cross-cutting facts the redesign should weigh:** the single `fs:any` handler (index.ts:1265) is already the natural place for a one-lane "hash changed → tell the hub" hook; `_sync.json` + `sync:status` is already a single delivery-status channel awaiting per-file rows; and both live latency fixes (fast-push, fast-pull) plus the `asset` HMR mode and `announceWrite` bridge are hand-built approximations of the one missing primitive — a server push event after an accepted write.