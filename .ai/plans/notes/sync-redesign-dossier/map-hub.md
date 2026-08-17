All files read against ground-truth doc `/Users/iagh/git/personal/maude/.ai/plans/notes/sync-architecture-ground-truth.md`. Findings below, file:line referenced.

# HUB + CELL SYNC MAP

## 1. The cell's two stores

**Store A — git checkout on container disk** (`/repo`, designRoot `/repo/.design`). **Store B — R2 bucket** (prefix `tenants/<id>/`, exported as `MAUDE_BACKUP_PREFIX` + `MAUDE_TENANT_PREFIX` in `infra/cell/entrypoint.sh:54-69`).

**Checkout writers**
| Path | Code |
|---|---|
| First-boot seed clone (full, never shallow; credential scrubbed from remote) | `apps/hub/src/seed-repo.mjs:51-119` |
| Cold-start restore: newest complete backup generation → SQLite dbs to `/data` + `git clone repo.bundle` to `/repo`; walks generations newest-first on failure; `force:false` | `rehydrate.mjs:96-158` → `backup.mjs:restoreLatest:292` → `repo-checkpoint.mjs:restoreRepo:119` |
| Bucket→checkout asset refill, boot, **top-level `assets/` only**, missing-only, never overwrites, symlink-contained | `asset-lane.mjs:hydrateAssets:251-343` |
| `PUT /assets/<key>` desktop push (bucket-class) → `<designRoot>/assets/<key>`, tmp+rename via `streamToFile` | `assets.mjs:handleAssetPut:392-433`, `streamToFile:347-390` |
| `PUT /_asset-file/<rel>` desktop push (checkout-class, classifier-admitted via `resolveCheckoutFileWrite`) | `assets.mjs:handleCheckoutAssetRoute:579-684`, `file-manifest.mjs:309-317` |
| Hocuspocus `afterStoreDocument` → workspace-agent doc→file projection (body/meta/css/annotations, `atomicWrite` tmp+rename) + autocommit staging | `server.mjs:1079-1086` → `workspace-agent.mjs:onDocumentStored:236-441` |
| **Studio child (separate process, same disk)**: shared-doc projection `projection.ts` doc→file, collab-room persistence (comments/annotations), all studio API writes (`POST /_api/asset` browser upload, `PUT /_api/annotations`, `PATCH /_api/canvas-meta`, canvas-edit) | `apps/studio/sync/projection.ts`, spawned by `studio-child.mjs` with `MAUDE_SHARED_DOC=1`, `MAUDE_SYNC_NO_AUTOCOMMIT=1`, `MAUDE_USE_SYSTEM_GIT=1` (`studio-child.mjs:145-217`) |

**Checkout readers**: studio child static serve + canvas build (what browsers see); `GET /assets/` checkout-FIRST since DDR-224 (`assets.mjs:195-244`); `GET /api/files` manifest walk (`file-manifest.mjs:listProjectFiles:141-204`, sha256 cached by size+mtime); `GET /_project-file/<rel>` (`file-manifest.mjs:386-494`, lstat — never follows a leaf symlink); probe `existsSync` checks; `git bundle` for backup; mirror-push / design-sync outbound.

**Bucket writers**: `sweepAssets`/`sweepNew` checkout→bucket mirror (`asset-lane.mjs:105-159, 367-458` — skip-first HEAD, 512 MB cap, loud failures + one 60 s retry); `runBackup` generations `backups/<ISO>/{hub.db.gz,tokens.db.gz,users.db.gz,repo.bundle,manifest.json}` — manifest written LAST marks completeness (`backup.mjs:212-261`); `pruneOldBackups` keep 14. **Bucket readers**: `GET /assets/` fallback; `headObject` in probe; `hydrateAssets` list+get; `rehydrate` restore.

**Reconcilers between the two**: `hydrateAssets` (bucket→checkout, boot), `sweepAll` (checkout→bucket, boot), `sweepNew` (per-write, via `onWritten`/`onAssetWritten`), backup schedule (checkout+dbs→generation), rehydrate (generation→disk). Probe semantics "present = BOTH stores" for `assets/*` (`assets.mjs:783-824`).

**Checkout lifecycle across restarts** (`entrypoint.sh`): containment assert → if `/data/hub.db` exists = warm start (disk survived, skip rehydrate) else cold start: `rehydrate.mjs` (fatal on any doubt; first boot = empty ok; older-generation fallback with loud loss warning) → hub boots → `seedRepo` (no-op if `.git` exists) → workspace agent indexes canvases → `hydrateAssets` then `sweepAll` (order load-bearing, `server.mjs:2467-2509`). **Durability hole that remains**: cell autocommit stages ONLY doc-projected canvas lanes (`workspace-agent` `auto.note`), so pushed assets are untracked → not in `repo.bundle`; top-level `assets/` survives via bucket mirror, but a NEW `system/**/assets/*` file pushed via `/_asset-file/` is neither committed nor swept (sweep lists only `<designRoot>/assets/` — `assets.mjs:670-672`) — it survives migration only because the desktop's idempotent sweep re-pushes it.

## 2. Write doors + post-write behavior; the watcher gap is REAL

| Door | Writer process | After write |
|---|---|---|
| `PUT /assets/<key>` | **hub** | `onWritten` → `sweepNew()` bucket mirror (`server.mjs:702-706`). **No announce to studio child. Nothing else.** |
| `PUT /_asset-file/<rel>` | **hub** | `onWritten` → `sweepNew()` (`server.mjs:741-745`; hook added v0.60.6, DDR-224). **No announce.** |
| `POST /_api/asset` shell door | **studio child** (proxied) | hub fires `onAssetWritten` → `sweepNew()` on 2xx (`studio-proxy.mjs:368-379`); child's own write arms `activity:suppress` → container bridge → `fs:any` → HMR heal |
| `POST /_api/asset` canvas-origin door (iframe drop) | **studio child** | same parity hook (`studio-proxy.mjs:564-575`) |
| Other studio API writes (canvas-edit, annotations, canvas-meta) | **studio child** | container bridge → `fs:any`; no bucket mirror (text lanes ride doc lanes + git) |
| Hocuspocus WS doc update | **hub** (workspace-agent) + **child** (projection, usually wins race) | hub: autocommit staging via `committableLanes` even when disk already identical (`workspace-agent.mjs:398-421`); child: `onWrote` → `announceWrite` |
| `DELETE/POST /api/documents/<name>` | hub | tombstones.db + hub.db row removal (`documents.mjs:155-204`, `tombstones.mjs`) — doc store, not files |

**Gap confirmed — definitively, three stacked facts:**
1. The watcher is Bun recursive `fs.watch` over designRoot in the **studio child** process (`apps/studio/fs-watch.ts:48-56`). The repo records as verified-live that in a container (Linux inotify) it does NOT fire for atomic tmp+rename writes: `hmr-broadcast.ts:224-230` — *"verified live: after a 200 edit-css on a cell, a connected canvas-hmr socket received nothing."* Same statement at `projection.ts:82` and `sync/index.ts:1292-1295`.
2. Both hub asset doors write tmp+rename (`streamToFile:351,383`; `hydrateAssets:327-329`; workspace-agent `atomicWrite:88-93`) — exactly the invisible pattern.
3. The two existing bridges are both **in-child, in-process**: `createContainerWriteBridge` (`hmr-broadcast.ts:242-278`, armed off `activity:suppress` — only studio API writes arm it) and `announceWrite` (`sync/index.ts:1317-1331`, wired only as projection `onWrote` under cell pairing, `sync/index.ts:1955`). **No mechanism crosses the hub→child process boundary.** The hub's only post-write hooks (`onWritten`/`onAssetWritten`) go exclusively to the bucket sweeper. So a desktop-pushed asset lands in the checkout, is served correctly on request, but no `fs:any` ever fires in the child → no `canvas-hmr {mode:'asset'}` heal broadcast (`hmr-broadcast.ts:185-187`) → open browser tabs keep the broken glyph until manual reload. The ground-truth §3 prime suspect is structurally proven.

## 3. How the studio child learns about file changes today

1. **Its own API writes** — direct knowledge; `activity:suppress` → container bridge synthesizes `fs:any` after 250 ms (workspace mode only, `ws.ts:277`).
2. **Doc-lane updates** — child is a peer of its own hub over loopback Hocuspocus (pairing token minted at `server.mjs:381-394`); projection writes files, `onWrote` → `announceWrite` → synthetic `fs:any` (cell pairing only).
3. **Collab room** (comments/annotations/presence) — in-memory Y.Doc via `/_ws/collab/:slug`; UI updates over the socket, not via fs.
4. **`fs.watch`** — nominally covers external writes; effectively dead in the container for every atomic writer (all of them).
5. **Hub-process writes: nothing.** (Workspace-agent doc→file writes are masked because the child projects the same bytes itself; asset PUTs and hydrate restores are the uncovered class.)
6. Pull-based rediscovery on request (canvas list/build reads disk fresh) — visible only after user action.

## 4. Git's role; could git BE the transport?

Roles today: **server-owned history** — hub is sole committer in a cell (child autocommit disabled, `studio-child.mjs:139-160`); `afterStoreDocument` → project → stage named paths → quiescence-batched commit with author=person committer=Maude, flush-on-SIGTERM ordered before server destroy (`server.mjs:2541-2559`). **Seed** — first-boot full clone, per-tenant seed URL from control plane (`cell-config.mjs:fetchTenantConfig`, the customer-#2 isolation fix). **Checkpoint** — `git bundle --all`, verified, shallow refused, rides in the SAME generation as SQLite snapshots (`repo-checkpoint.mjs`, `backup.mjs:239-249`). **Restore** — every cold start (rehydrate). **Outbound only**: mirror-push (append-only, control-plane-minted ~1 h token, never on disk) and design-sync (tmp shallow clone, replace folder, work branch, PR).

Git already provides content addressing, delta, atomicity, and stated deletions (a commit removing a file ≈ a tombstone). **What's missing for git-as-file-sync-transport:**
- **No wire endpoint.** The hub exposes no smart-HTTP/SSH; all git remotes are outbound to GitHub. Desktop never fetches/pushes the cell repo.
- **Two divergent histories.** Desktop's `.design` lives inside the USER's own repo (own commits, own remotes); the cell repo is seed + server commits. Bidirectional git sync between them means merges/conflicts on concurrent edits — the exact problem the CRDT lanes exist to dissolve. Would require a hidden dedicated sync repo or single-writer protocol — at which point it's "content-addressed manifest sync" (§6 of ground truth) with git as one possible implementation.
- **Latency.** Autocommit is quiescence-batched — reconciler cadence, not ms-live; no push notification (git has no server→client event channel; you'd still need the WS broadcast).
- **Binary/asset policy.** Today assets are deliberately kept OUT of generations ("copying 300 MB of media into every snapshot would make the snapshot too expensive" — `repo-checkpoint.mjs:23-26`) and pushed assets are untracked. Git-as-transport means committing all media → bundle/backup/clone growth on a ½ vCPU cell where a 280 MB seed already forced `standard-1` and 1.1 GiB already breaks the 600 s boot window.
- **DDR-054.** `git checkout` materializes arbitrary committed paths including symlinks; a receiver would need the same post-checkout classifier + realpath containment the current lanes apply per file (the hazard is already documented at every receive site).
- **Auth mapping.** Peer tokens carry scope + readOnly per document; git has no per-path ACL without a custom server.

## 5. Existing WebSocket surfaces

| Socket | Endpoints | Auth | Could carry per-file events today? |
|---|---|---|---|
| **Hocuspocus sync socket** | desktop ↔ cell, `wss://<tenant>.cloud.maude.sh/<docName>`, multiplexed `HocuspocusProviderWebsocket` | peer project token in `onAuthenticate` (`server.mjs:444-509`): verifyToken + per-doc scope + protocol-level readOnly + per-label rate bucket | **YES — the natural channel.** Hocuspocus ships a stateless message channel (`broadcastStateless`/`onStateless`); grep shows it is **entirely unused** in this codebase. Zero new auth: the socket is already open desktop↔cell and cell-child↔hub (loopback pairing provider). A hub `broadcast {file, hash}` after each accepted write kills the 20 s poll AND (via the child's own loopback provider) the watcher gap in one move. |
| **canvas-hmr socket** | browser iframe ↔ studio child, path `/_ws` on canvas origin, proxied through worker→DO→hub upgrade splice (`server.mjs:1127-1164` → `studio-proxy.handleCanvasUpgrade`) | render capability token (`?t=` or host-scoped HttpOnly cookie), HMAC render-token (`render-token.mjs`) | Already carries per-file messages (`{type:'canvas-hmr', mode:css\|module\|meta\|asset\|hard, file}` — `hmr-broadcast.ts:34-49`) but is the LAST hop (child bus → browser). The hub process cannot emit onto it; needs a hub→child nudge (loopback HTTP or the stateless lane above). Desktop never connects to it. |
| **collab room socket** | browser iframe ↔ child, `/_ws/collab/:slug` (`ws.ts:84-88`) | render capability, readOnly gated to comment lane | per-canvas Yjs binary; wrong shape for arbitrary files |
| **studio shell WS `/_ws`** (inspector/activity/ACP) | signed-in browser ↔ child via `studioProxy.handleUpgrade` | browser session cookie (`server.mjs:1158-1163`) | shell-side only |
| **child ↔ own hub loopback** | HocuspocusProvider on `127.0.0.1:<port>` | minted pairing token (`mintLoopbackSyncToken`, presence of URL+token IS the switch, loopback-checked both ends `studio-child.mjs:145-163`) | same stateless-lane potential; this is precisely the hub→child bridge that is missing |

## 6. Deletable on hub/cell under a single file plane

Assuming: one manifest-driven plane (keep `file-manifest.mjs` 519 + `file-membership.mjs` 200 as THE plane, add one write door), checkout = single serving truth, bucket = write-behind durability only, event-driven notify over existing sockets.

| Delete | Lines |
|---|---|
| `assets.mjs` PUT branch + `streamToFile` + budget + `handleCheckoutAssetRoute` + `parseCheckoutAssetPath` + `handleAssetProbeRoute` (probe semantics die with the dual-store "present=both" question) | ~700 of 898 (keep GET proxy + `parseAssetPath`/`servable` ~190) |
| `asset-lane.mjs` `createAssetSweeper`/`sweepNew`/probe-coupled sweep logic; `hydrateAssets` shrinks to a boot restore; write-behind queue replaces per-door hooks | ~300 of 458 |
| `server.mjs` route wiring for deleted doors + sweeper plumbing (686-780, parts of 2457-2509, `setAssetSweeper`/`recordAssetSweep`) | ~130 |
| `studio-proxy.mjs` `onAssetWritten` hooks (both doors) | ~40 |
| **Hub/cell total** | **~1,150-1,300** |

(Desktop counterpart, for context: `asset-push.ts` 634 + `asset-sweep.ts` 262 + `asset-push-worker.ts` 84 + `asset-pull.ts` 210 ≈ 1,190 collapse into an extended `file-pull.ts`/push pair → system-wide ≈ 2,300+.) Not deletable: `file-membership.mjs` hub mirror must stay a separate file (frozen-lockfile image cannot import from apps/studio — header of that file); rehydrate/backup/checkpoint/seed/git-runner stay regardless.

## 7. Cloudflare constraints shaping the design (`apps/cells/wrangler.toml` + code)

- **Container**: `standard-1` = ½ vCPU / 4 GiB / 8 GB disk; `max_instances = 5` (hard cost ceiling — ~$53/mo per always-on cell, raising it was tried and reverted); `sleepAfter = '20m'`. Disk is **ephemeral by contract** — warm start possible (`/data/hub.db` check) but migration wipes it whenever the platform likes → rehydrate is the normal path, and anything checkout-only-and-uncommitted dies with the instance.
- **Env applies at container START only** (`wrangler.toml:130-132`) — config/flag changes (e.g. `CELL_LIVE_PAIRING`) need an idle-out or `POST /_cell/restart`; a byte-identical config is a no-op roll; image rollouts require bumping the tag line (`wrangler.toml:46`).
- **DO**: one per tenant (`idFromName`); wakes on request; DO storage holds only tenantId + cached config; a DO can lose its container handle irrecoverably (forced the `MaudeCellB` fresh-namespace migration). `portReadyTimeoutMS: 1_800_000` because **rehydrate runs BEFORE the hub binds** — availability is currently a function of project size (1.1 GiB did not finish in 600 s on ½ vCPU; the noted real fix is bind-first-restore-behind-a-page, `cell-do.mjs:184-200`). A redesign that grows boot-time transfer makes this worse.
- **R2**: per-tenant TEMPORARY credentials minted from the control plane at every container start, scoped `tenants/<id>/`, TTL-bounded; fail-closed if unavailable (`cell-do.mjs:165-176`). $0 egress is load-bearing for the no-presigned-URL proxy model (`assets.mjs:16-18`, DDR-054/DDR-193). No lifecycle expiry allowed on the assets prefix. S3 semantics: no rename/atomic-move; list/head/get/put only.
- **HTTP quirks through worker→DO→container**: **HEAD does not survive the trip** (arrives as GET) — this alone forced the POST batch probe (`assets.mjs:716-737`); `Host` is not the browser's hostname by arrival (forced the `x-maude-canvas-origin` header). WS upgrades DO survive (the upgrade splice works end-to-end). Body caps are code-enforced: 100 MB/file default (`MAX_PUT_BYTES`), 2 GiB/process PUT budget, 512 MB sweep/manifest caps, 768 KB/1000-path probe — plus the platform's own plan body limit above them.
- **Egress posture**: cell dials out only to control plane (token/config mint), R2, GitHub (mirror/design-sync), and its own tunnel; "a cell syncs to itself or to nothing" is double-checked at both ends of the loopback pairing URL.
- **Tunnel mode** (one tenant): DO starts the container and proxies via `MAUDE_TUNNEL_HOST`, health-gated on 530/502/523/521 retries.
- **Observability**: `[observability] enabled, head_sampling_rate 1`; dataset `containers` carries the cell's stdout (the tool that made DDR-224 diagnosable).