---
name: phase-9.2-shared-collab-doc
status: planned
created: 2026-05-29
supersedes:
  - DDR-054 §F14 (doc-content bridge) — the deferred "bridge the two docs" item; this REPLACES the bridge with a single shared doc
relates_to:
  - phase-10-structured-crdt-html-coediting (character-level body co-edit — builds ON this foundation)
  - phase-8-live-collaboration-yjs-lan (the room/Y.Doc collab layer being unified)
decisions_pending:
  - DDR-064 (proposed) — single shared Y.Doc per canvas as the collaboration source of truth (supersedes the two-doc + disk-reconcile model)
---

# Feature: Rock-solid shared collaboration doc — converge the two per-canvas Y.Docs into one

> Validate against existing naming/utils/imports before implementing. This is a **high-complexity, multi-phase architectural refactor** behind a feature flag — execute phase-by-phase with a convergence-verification gate between phases. Do NOT one-shot it.

## Description

Linked-mode collaboration today keeps **two separate `Y.Doc` instances per canvas** in the dev-server and reconciles them through a side channel (disk files + wholesale-replace relays). That side-channel reconciliation is a textbook clobber/race anti-pattern: under live two-peer editing a peer's in-memory doc re-persists stale state over a hub-pushed change, reverting it on the peer **and** round-tripping the revert back to the originator (observed live, 2026-05-29). Phase 9.1 patched the worst races (in-process per-type relay, no-op guards, re-seed-from-disk), and the **file-sync layer is now solid** — but the architecture has a ceiling: rock-solid live multiplayer under concurrent editing needs the two docs to be **one**.

This phase converges them: **one `Y.Doc` per canvas**, with both the browser-facing WebSocket server (the "room") and the hub-facing `HocuspocusProvider` attached to that single doc. Browser edits flow directly into the doc that syncs to the hub — no disk hop, no reconciliation, no wholesale-replace, no race. The on-disk files (comments JSON, annotation SVG, `.meta.json` layout, `.tsx`/`.css` body) become a **loop-free, debounced projection** of the doc — still fully editable by Claude (`/design:edit`), humans, and git, but ingested as diffs into the CRDT rather than racing it.

## User Story

As **two people (or a person + Claude on two machines) collaborating on the same canvas**, I want every change — comments, annotations, artboard moves, body/CSS edits — to converge live on both peers and on disk **without ever clobbering or reverting each other's work**, so that the design tool feels like real multiplayer and Claude always reads consistent files.

## Problem

`plugins/design/dev-server/` keeps two Y.Docs per canvas:

1. **Room doc** (`collab/room.ts` → `createRoom` does `new Y.Doc()`): browser tabs sync to it over the dev-server's local collab WebSocket; persisted to `_comments/<slug>.json` + `<slug>.annotations.svg` + `_state/<slug>.ydoc.bin`.
2. **Sync-agent doc** (`sync/index.ts` → `new HocuspocusProvider({ document: new Y.Doc() })`): connects to the central hub; mirrors the same files to/from the hub via the codec in `sync/agent.ts` + `sync/codec.ts`.

They are reconciled **indirectly** — room → disk → fs-watch → sync-agent → hub → peer's sync-agent → peer's disk → peer's room — plus the Phase 9.1 in-process relay (`sync/index.ts`) and `createCollab`'s fs re-seed hook (`collab/index.ts`). This is the side-channel reconciliation the CRDT/local-first literature was written to kill: two divergent replicas merged by copying whole values clobbers concurrent edits (last-writer-wins at coarse granularity), with no recovery. Phase 9.1 narrowed the race window; it cannot close it while two docs exist.

Secondary problems this unlocks fixing:
- **Artboard layout lives in `.meta.json`** (a side file), not the collab doc — so it can never participate in live multiplayer cleanly.
- **Annotations are one opaque SVG blob** — concurrent draws clobber wholesale (Figma's "make the boundary small" lesson unaddressed).
- **The `.tsx` body** is gated (DDR-054/060 `syncable` opt-in + sandbox) but the gating is bolted onto the file-mirror; a shared doc needs a first-class gating seam.

## Solution

**Stay on Yjs (do not rewrite to a bespoke server-authoritative model). Converge to ONE shared `Y.Doc` per canvas**, owned by the collab registry, with two network providers + one binary-persistence binding attached to it. This is the canonical Yjs pattern, confirmed across all four research tracks (Zed, Figma, Yjs/Hocuspocus, local-first literature — see Documentation).

Use **Figma's granularity lesson** to shape the Y-types so even within one CRDT doc the conflict blast-radius is small (decompose blobs into per-item maps). Use **Zed's principle** that the doc is the live truth and the file is a materialized projection. Use **the Yjs author's explicit migration guidance** to escape the duplication-on-merge trap (one-time authoritative clear-and-rebuild seed; never `applyUpdate` two independent docs together).

Ship behind a **feature flag (`MAUDE_SHARED_DOC`, default OFF)** so the proven two-doc path stays the default (zero regression) until the shared-doc path is shadow-verified and cut over per-canvas. This mirrors the `MAUDE_CANVAS_ORIGIN_SPLIT` rollout discipline + the project's no-break-exhaustive-verify bar.

## Metadata

- **Type**: Refactor / architecture (foundational)
- **Complexity**: High
- **App/Package**: `plugins/design/dev-server` (+ `plugins/design/hub` for binary persistence; `cli/` for `maude design status`)
- **Affected Systems**: collab room, sync runtime + agent + codec, disk projection, hub persistence, untrusted markers, fs-watch, ws bridge
- **Dependencies**: `yjs`, `@hocuspocus/provider`, `@hocuspocus/server` + `@hocuspocus/extension-sqlite` (hub), `y-protocols` (awareness), the local collab WS server in `server.ts`
- **Decision to record**: DDR-064 — "single shared Y.Doc per canvas" (supersedes the two-doc + disk-reconcile model and the DDR-054 §F14 doc-content-bridge deferral)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one message, multiple Read calls) — independent context loads.

- `plugins/design/dev-server/collab/room.ts` — `createRoom` (`new Y.Doc()`, awareness, `scheduleFlush`/`flush` → `persistJson`+`persistBinary`, `doc.on('update')` broadcast). The room's doc becomes the single shared doc.
- `plugins/design/dev-server/collab/registry.ts` — `createRegistry`, `get`/`peek`, `wireBridge` (awareness), `syncRoomFromComments`/`syncRoomFromAnnotations` (the wholesale-replace relay path being retired), `attachHubAwareness`.
- `plugins/design/dev-server/collab/persistence.ts` — `Y_TYPES` (`comments`/`annotations`/`presentation`), `createPersistence` (`seed`/`persistJson`/`persistBinary`). The seed + projection logic anchors the disk-projection redesign.
- `plugins/design/dev-server/collab/index.ts` — `createCollab`, `fileForSlug`, the Phase 9.1 fs re-seed hook + `comments` emit (retired/repointed under the flag).
- `plugins/design/dev-server/sync/index.ts` — `createSyncRuntime`, per-canvas `defaultProviderFactory` (`new HocuspocusProvider`), the in-process relay, `attachHubAwareness`, `CanvasDescriptor`. This is where the provider must attach to the room doc instead of a fresh doc.
- `plugins/design/dev-server/sync/agent.ts` — `createCanvasSyncAgent` (`applyFromFs`, `flush`/`writeXIfChanged`, `reconcile`). Becomes the **disk projector** (doc→file) + **diff-importer** (file→doc), not a second-doc mirror.
- `plugins/design/dev-server/sync/codec.ts` — `Y_SYNC_TYPES` (`html`/`meta`/`css`), `applyHtmlToDoc` (prefix/suffix diff), `applyMetaToDoc`/`mergeSharedMetaIntoLocal`, `applyCssToDoc`. The diff codecs are reused for file→doc import.
- `plugins/design/dev-server/server.ts` — wiring: `createCollab`, `createSyncRuntime`, the `/_collab` + `/_ws` WS upgrades (`collabSlug`), `onCommentsChanged`/`onAnnotationsChanged`, `fsWatch`, shutdown.
- `plugins/design/dev-server/ws.ts` (lines ~113-123) — bus→WS forwarding (`comments`, `fs:*`, `selected`); the shell sidebar's only comment feed.
- `plugins/design/dev-server/fs-watch.ts` — `fs:any`/`fs:html`/`fs:css`/`fs:json` emitter (path-based, catches all writes incl. external `/design:edit`).
- `plugins/design/dev-server/collab/awareness-bridge.ts` — the bidirectional awareness relay (stays; presence is already correctly separate).
- `plugins/design/hub/src/server.mjs` (lines ~138, ~280) — `@hocuspocus/extension-sqlite` binary persistence + `onLoadDocument`. The hub already persists `Y.encodeStateAsUpdate` binary — do NOT regress to JSON.
- `.ai/decisions/DDR-051-*` (JSON canonical / `.ydoc.bin` cache), `DDR-052` (Hocuspocus), `DDR-054` (trust model + body gating + §F14), `DDR-060` (TSX sync), `DDR-063` (canvas-origin split).
- `.ai/plans/archive/phase-9.1-tsx-sync-unblock.md` + `.ai/plans/phase-10-structured-crdt-html-coediting.md` — prior art / the body-coedit follow-on.
- `plugins/design/dev-server/test/stress-integration.test.mjs` (in `plugins/design/hub/test/`) — the 5-peer convergence harness to extend.

### Files to Create

- `plugins/design/dev-server/collab/shared-doc.ts` — the single-doc owner: creates one `Y.Doc` per slug, attaches the local collab WS + the `HocuspocusProvider` + the disk projector + binary persistence, with origin discipline. (May live inside `registry.ts`/`room.ts` if cleaner — decide at impl time.)
- `plugins/design/dev-server/sync/projection.ts` — loop-free bidirectional file↔doc projection (doc→file debounced + file→doc diff-import, hash-gated + origin-tagged).
- `plugins/design/dev-server/sync/migrate-seed.ts` — one-time authoritative clear-and-rebuild seed (escape the duplication-on-merge trap).
- `plugins/design/dev-server/test/shared-doc-convergence.test.ts` — property-based convergence (commutativity/associativity/idempotency) + round-trip projection laws.
- `plugins/design/dev-server/test/shared-doc-projection.test.ts` — file→doc diff-import loop-free + no-echo + no-clobber-of-concurrent-edit.
- `.ai/decisions/DDR-064-single-shared-collab-doc.md` — record the architecture decision.

### Documentation (research — cite in DDR-064)

**Yjs/Hocuspocus (the directly actionable track):**
- https://github.com/yjs/y-websocket-server/blob/master/src/utils.js — Why: `getYDoc(name)` caches one `WSSharedDoc extends Y.Doc` per room — proves the single-shared-doc wiring (browser WS + `HocuspocusProvider({ document })` on the SAME instance).
- https://www.npmjs.com/package/@hocuspocus/provider — Why: `new HocuspocusProvider({ url, name, document: ydoc })` attaches the hub provider to an existing doc.
- https://discuss.yjs.dev/t/merging-two-different-y-js-documents/2538 — Why: **dmonad (Yjs author) confirms** merging two independent docs DUPLICATES (Y.Text) / overwrites (Y.Map); the fix is clear+rebuild inside `transact`, NOT `applyUpdate`. The crux of the migration.
- https://discuss.yjs.dev/t/determining-whether-a-transaction-is-local/361 — Why: prefer `transaction.local`, use `transaction.origin` for source ID — the echo-loop discipline once one doc has multiple providers + persistence.
- https://tiptap.dev/docs/hocuspocus/guides/persistence — Why: `onLoadDocument`/`onStoreDocument`, store `Uint8Array` binary, explicit *"do not store as JSON and recreate as binary"* (our exact anti-pattern); `debounce`/`maxDebounce`.
- https://docs.yjs.dev/api/document-updates — Why: updates are commutative/associative/idempotent + the `applyUpdate(doc, update, origin)` origin-filter template.
- https://docs.yjs.dev/api/subdocuments — Why: subdoc gating (`autoLoad: false`, per-`guid` sync, "authorization over structure") for the `.tsx` body opt-in; **caveat: provider subdoc support is uneven → fallback to a separate hub document-name `<slug>:body`.**
- https://docs.yjs.dev/getting-started/adding-awareness + https://github.com/yjs/y-protocols — Why: presence is a separate ephemeral CRDT, never in the doc (confirms keeping `awareness-bridge.ts` as-is).

**Figma (granularity + when-not-CRDT):**
- https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ — Why: server-authoritative per-property LWW; per-object/per-property granularity; **comments live OUTSIDE multiplayer (Postgres)**; text is lossy under LWW; presence ephemeral/separate. Informs per-type structure.
- https://www.figma.com/blog/realtime-editing-of-ordered-sequences/ — Why: fractional indexing (base-95 strings) for ordered children + server-assigned unique position on collision — the model for annotation z-order / ordered lists.

**Zed (one-logical-doc + persistence-as-projection):**
- https://zed.dev/blog/crdts — Why: one CRDT logical doc, replicas converge by construction; anchors (stable references survive edits → cursors/comments); tombstones not physical delete; OT-is-a-trap; per-replica undo map.
- https://github.com/zed-industries/zed/blob/main/crates/collab/src/rpc.rs — Why: the server is a **relay**, the host owns initial state — the topology to mirror (dev-server relays; one designated authoritative initial state).

**Local-first / migration / verification:**
- https://martin.kleppmann.com/papers/local-first.pdf — Why: names the side-channel-reconciliation anti-pattern (Dropbox "conflicted copy") and the CRDT fix; our two-doc-via-disk is the named failure.
- https://liveblocks.io/blog/understanding-sync-engines-how-figma-linear-and-google-docs-work — Why: choose conflict granularity by data shape (per-char CRDT only for free text; per-field LWW for positions/metadata); server-authoritative-ordering + CRDT-merge is the pragmatic sweet spot.
- https://liveblocks.io/docs/guides/yjs-best-practices-and-tips — Why: single-Y.Doc guidance + the **"Yjs imported twice → broken sync"** trap (critical when collapsing server+bundled-client docs) + when-not-subdocs.
- https://launchdarkly.com/docs/guides/flags/migrations + https://www.infoq.com/articles/shadow-table-strategy-data-migration/ — Why: dual-write → shadow-compare → per-canvas cutover behind a flag; keep the old path warm one full cycle.
- https://dev.to/priolo/synchronizing-collaborative-text-editing-with-yjs-and-websockets-1dco — Why: `fast-diff → Yjs delta → applyDelta` recipe for ingesting an external full-text file change WITHOUT wholesale replace (the `/design:edit` import path).

### Patterns to Follow

- **Single shared doc wiring** (target):
  ```ts
  // registry/shared-doc owns ONE Y.Doc per slug; both providers attach to it.
  const ydoc = registry.getDoc(slug)                 // single instance, cached
  // browser tabs already sync to this via the local collab WS server (room)
  const hub = new HocuspocusProvider({ url, name: slug, document: ydoc })
  // disk projector + binary persistence bind to the SAME ydoc, origin-guarded
  ```
- **Origin discipline** (mirror `awareness-bridge.ts`'s `BRIDGE` origin + `sync/agent.ts`'s frozen `origin`): every writer tags its transactions; every consumer filters its own origin. Sentinels: the hub provider instance, the local-WS provider instance, `'disk-projection'`, `'file-import'`, `'migration'`.
- **Diff-into-doc, never wholesale-replace** (extend `applyHtmlToDoc`'s prefix/suffix diff to all file→doc imports; for comments/positions diff field-by-field on the Y.Map/Y.Array).
- **Doc→file projection** is debounced + origin-guarded against its own write (hash the bytes, store `lastWrittenHash`, drop the fs-watch echo) — the basic-memory checksum-gating pattern.

---

## Design Decisions (architecture)

### The single decision (DDR-064)

| Option | Verdict |
| --- | --- |
| **A — One shared Yjs `Y.Doc` per canvas** (both providers attach; disk = projection). | **CHOSEN.** Canonical Yjs pattern; reuses our stack; CRDT merge eliminates clobber by construction; file stays editable via loop-free diff-import. |
| B — Figma-style server-authoritative per-property LWW (rip out Yjs). | Rejected as the model — too big a rewrite; Yjs already gives merge for free. **Borrow its granularity lesson** (decompose blobs) inside option A. |
| C — Keep two docs, keep patching the bridge. | Rejected — Phase 9.1 proved the race only narrows, never closes (whack-a-mole: comments fixed → annotations broke). |

### Per-type Y-type structure (Figma granularity inside one Yjs doc)

| Data | Y-type | Rationale / migration note |
| --- | --- | --- |
| comments | `Y.Array<Y.Map>` keyed by `id` (already `Y_TYPES.comments`) | per-comment map → concurrent field edits merge; **can't move integrated items → reorder via `order` field or delete+reinsert**; merging two arrays duplicates → reseed (Task 8). |
| annotations | **v1:** keep `Y.Map.svg` (`Y_TYPES.annotations`) — one shared doc already kills the cross-machine clobber (LWW on one key, Figma-acceptable). **v2 (polish):** decompose to `Y.Array<Y.Map>` per shape + fractional z-order for concurrent-draw merge. | Phase the decomposition; don't block on it. |
| artboard layout | `Y.Map` keyed by artboard id (`presentation` is defined-but-unused — repurpose) | **Move OUT of `.meta.json` into the doc.** `viewport` (pan/zoom) stays per-user → AWARENESS, never the doc. `syncable` opt-in stays local. |
| `.tsx` body + `.css` | `Y.Text` in a **gated subdoc** OR a **separate hub doc-name `<slug>:body`** attached only when `syncable` opt-in (Lock 1) + sandbox (Lock 2) active | Preserves DDR-054/060 gating as a first-class seam. Verify HocuspocusProvider subdoc support; fallback = separate doc-name. |
| presence (cursor/selection/viewport) | **Awareness** (unchanged, `awareness-bridge.ts`) | Never in the doc; 30s ephemeral; `_active.json` is a persisted projection of awareness for the orchestrator. |

### Disk projection (loop-free bidirectional) — the `/design:edit` contract

- **doc → file** (browser edits converged): debounced; for each type write the human-readable file (comments JSON, annotation SVG, `.meta.json` merge keeping local `viewport`, `.tsx`/`.css`). Compute + store `lastWrittenHash`; tag nothing back into the doc.
- **file → doc** (external edit by `/design:edit`, human, git): fs-watch fires → hash the file; **if == `lastWrittenHash`, drop (our echo)**; else **diff against the doc's current materialization and apply only the delta** as Yjs ops with origin `'file-import'` (reuse `applyHtmlToDoc`'s prefix/suffix diff for text; field-diff for structured). Never wholesale-replace.
- **Serialize** per-canvas (single-flight queue) + **circuit-breaker** (3 strikes → skip until checksum changes) so an unparseable file can't spin the loop.

### Persistence

- **Authoritative binary** stays on the hub via `@hocuspocus/extension-sqlite` (`onStoreDocument` debounced; `Y.encodeStateAsUpdate`). Local room keeps `_state/<slug>.ydoc.bin` as its binary cache. **Never JSON→binary** (dmonad's warning = our current bug class). JSON/SVG/meta become projections only.

---

## Tasks

> Execute in order. **Gate between phases on the convergence test suite (Task 12) + a shadow-compare clean run.** Each phase is independently flag-guarded.

### Phase A — Foundation (flag + single-doc ownership)

#### Task 1: ADD feature flag `MAUDE_SHARED_DOC` (default OFF) — ✅ completed 2026-05-29
- **Do**: read in `server.ts` (mirror `MAUDE_CANVAS_ORIGIN_SPLIT` parsing); thread a `sharedDoc: boolean` into `Context`. Default OFF = current two-doc path = zero regression.
- **Validate**: `bun test` (no behavior change when off).
- **Done**: `context.ts` gains optional `sharedDoc?: boolean`; `server.ts` parses `MAUDE_SHARED_DOC` with the OPT-IN regex `/^(1|true|on|yes)$/i` (inverse of CANVAS_ORIGIN_SPLIT's opt-out) and sets `ctx.sharedDoc` right after `createContext()`, before `createCollab`/`createSyncRuntime` read it. Flag is threaded but dormant — nothing reads it until Phase B, so flag-OFF is byte-for-byte current behavior (720 baseline tests unchanged).

#### Task 2: REFACTOR registry to own ONE `Y.Doc` per slug — ✅ completed 2026-05-29
- **Do**: in `collab/registry.ts`/`room.ts`, expose `getDoc(slug)` returning a single cached `Y.Doc` (the room's doc). When the flag is OFF, behavior is unchanged. Pin a single `yjs` import (guard the "imported twice" trap — verify the bundled client + server share one instance).
- **Pattern**: `y-websocket-server`'s `getYDoc` cache.
- **Gotcha**: the room is created lazily on browser connect; the doc must exist independent of a live browser when linked (so the hub provider can attach at serve start).
- **Validate**: `bun test test/collab-*`.
- **Done**: `registry.getDoc(slug): Y.Doc` returns `get(slug).doc` (reuses get-or-create → doc/awareness/persistence/bridge set up once; y-websocket-server `getYDoc` cache pattern). Created independent of a browser conn (verified: `peek` null → `getDoc` → room exists with `size()===0`). Risk 2: single `yjs@13.6.30` in node_modules (no nested copy); new `test/shared-doc-foundation.test.ts` asserts `getDoc(x) instanceof Y.Doc` (test's own yjs import) + caching + identity with `room.doc` (5 tests). NOTE for Phase B: a `getDoc`-created room is NOT auto-dropped by `drop`'s `size()===0` check — Phase B must teach the lifecycle that an attached provider keeps it alive. Nothing calls `getDoc` yet (flag-OFF), so no room leaks in Phase A.

### Phase B — Convergence (the core: one doc, both providers)

#### Task 3: ATTACH `HocuspocusProvider` to the room doc (flag ON) — ✅ completed 2026-05-29
- **Do**: in `sync/index.ts`, when `sharedDoc`, do `new HocuspocusProvider({ url, name: slug, document: registry.getDoc(slug) })` instead of a fresh `Y.Doc`. Remove the in-process relay + the `createCollab` fs re-seed + the `syncRoomFrom*` wholesale path **under the flag** (keep them for flag-OFF).
- **Gotcha**: origin discipline — the hub provider, the local-WS provider, the projector, and the migration each need distinct transaction origins; filter echoes (Task 5).
- **Validate**: two in-process docs (test providers) on one shared doc converge with no relay; `test/sync-runtime.test.ts` extended.
- **Done**: `ProviderFactory` args gained optional `document?: Y.Doc`; `defaultProviderFactory` uses `args.document ?? new Y.Doc()`. `AwarenessRegistry` gained optional `getDoc?`/`pin?`/`unpin?`. `start()` computes `useSharedDoc = !!ctx.sharedDoc && typeof registry.getDoc === 'function'`; per canvas it injects `registry.getDoc(slug)` into the factory + `registry.pin(slug)` (released in `stop()` via `unpin`). The in-process relay (`provComments`/`provAnn` observers) is now gated `!useSharedDoc` — its absence is what RETIRES the wholesale clobber path. `collab/index.ts` reseed gates `syncRoomFrom*` on `!ctx.sharedDoc` (keeps the `comments` bus emit for the sidebar). Registry `drop` skips a `pinned` slug so the last-browser-leaves close can't destroy the doc under a live provider (self-gating — flag-OFF never pins). 5 convergence tests in `sync-runtime.test.ts` (browser→peer no-relay, hub→shared, two-way concurrent merge no-clobber, pin lifecycle, awareness-still-bridged); `relayCalls()===0` asserts the clobber path is gone. **Interim (cleaned in Phase C):** the agent is still created under sharedDoc, so comments/annotations are double-projected (room persist + agent) — harmless by hash/idempotence, but Phase C's single projector replaces it. **Known finding for cutover:** (a) under sharedDoc the room's Awareness and the provider's Awareness sit on the SAME doc → same `doc.clientID` → presence may collide; revisit before live cross-machine cutover. (b) `onLocalUpdate` counts queued edits by `origin===agent.origin`, so browser-origin edits aren't counted under sharedDoc (minor offline-banner inaccuracy, not data). (c) cold-start seed of a divergent local+hub doc is the duplication trap (Risk 1) — flag stays OFF until Phase E migrate-seed.

#### Task 4: KEEP awareness bridge unchanged — ✅ completed 2026-05-29
- **Do**: confirm `attachHubAwareness` still bridges presence on the shared doc; presence stays out of the doc.
- **Validate**: `test/collab-bridge.test.ts`.
- **Done**: `awareness-bridge.ts` untouched. The `attachHubAwareness` call in `sync/index.ts` sits OUTSIDE the `useSharedDoc` branch, so presence bridging is mode-independent. `test/collab-bridge.test.ts` + `collab-awareness-bridge.test.ts` unchanged-green; the new `Task 4 — provider awareness is still bridged on the shared-doc path` test asserts `attachHubAwareness` fires under sharedDoc. ⚠ See Task 3 finding (a): same-doc clientID collision between room + provider Awareness needs resolving before live cutover — tracked, not a Phase-B blocker.

#### Task 5: ADD origin-filter discipline — ✅ completed in Phase C (2026-05-29)
- **Done**: `sync/origins.ts` defines frozen sentinels `DISK_PROJECTION` / `FILE_IMPORT` / `MIGRATION` + `isProjectorOrigin()`, and documents the per-instance `HUB` (provider) / `LOCAL_WS` (RoomConn) origins. `projection.ts` tags every file→doc import `FILE_IMPORT` and its own `doc.on('update')` skips `FILE_IMPORT`/`MIGRATION` (no re-project). The "exactly one disk write per local edit" echo property is covered by the projection loop-freedom tests (echo-hash drop + cross-type no-clobber). `MIGRATION` is consumed by Phase E.

- **Do**: central sentinels (`HUB`, `LOCAL_WS`, `DISK_PROJECTION`, `FILE_IMPORT`, `MIGRATION`); every writer tags, every consumer filters its own. Document in DDR-064.
- **Validate**: echo-loop test — a doc with all bindings attached, one local edit produces exactly one disk write + one hub send, zero re-entry.
- **Re-sequencing rationale (executor, 2026-05-29):** deferred from Phase B into Phase C because its two deliverables only become meaningful once the single projector exists. (1) The validation asserts **exactly one disk write** per local edit — but in the Phase-B interim BOTH the room persist and the agent project comments/annotations (the double-write noted in Task 3), so "one disk write" is ill-defined until Phase C's `projection.ts` is the sole disk owner. (2) The `DISK_PROJECTION` / `FILE_IMPORT` / `MIGRATION` sentinels are consumed by `projection.ts` (Task 6/7) + `migrate-seed.ts` (Task 9) — code that does not exist yet; defining them now would be speculative + untested. Phase B's convergence (the heart) is done + proven WITHOUT needing the new sentinels (the existing `agent.origin` + provider origin suffice for the no-relay convergence). Task 5 lands at the **head of Phase C**, where `projection.ts` is built origin-tagged from the start and the echo-loop test is well-defined. This is consistent with the plan's "gate between phases, do NOT one-shot" discipline.

### Phase C — Disk projection (loop-free file↔doc)

#### Task 6: CREATE `sync/projection.ts` — doc→file (debounced, hash-gated) — ✅ completed 2026-05-29
- **Do**: subscribe `doc.on('update', (u, origin) => { if (origin !== DISK_PROJECTION) scheduleProject() })`; project each type to its file; store `lastWrittenHash` per file. `.meta.json` merge preserves local `viewport`/`syncable` (reuse `mergeSharedMetaIntoLocal`).
- **Validate**: `import(materialize(doc))` is a no-op (round-trip law).
- **Done**: `createDocProjection` reuses the proven `codec.ts` + `echo-guard.ts` (no logic duplication). doc→file projects **html/css/meta only** — the collab room already persists comments/annotations doc→file, so projecting them here too would double-write (the Phase-B interim is thereby resolved: under sharedDoc the agent is REPLACED by the projection, and the room keeps comments/annotations). Debounced (`flushMs`, 0 in tests), hash-gated via `echoGuard.record`, skips `FILE_IMPORT`/`MIGRATION`-origin updates. `reconcile()` is SAFE — never writes an empty doc value over non-empty local (push-local-up adopt is Phase E). `mergeSharedMetaIntoLocal` preserves local viewport/syncable.

#### Task 7: CREATE `sync/projection.ts` — file→doc (diff-import, origin `FILE_IMPORT`) — ✅ completed 2026-05-29
- **Do**: on fs-watch, drop if hash == `lastWrittenHash`; else diff file vs doc materialization, apply delta (reuse `applyHtmlToDoc` prefix/suffix for `.tsx`/`.css`; field-diff for comments/positions). Single-flight queue + 3-strike circuit breaker.
- **Gotcha**: `/design:edit` writes the whole file → must become a minimal delta, not a replace (else clobbers concurrent browser edits).
- **Validate**: external whole-file write + concurrent in-doc edit → both survive (`test/shared-doc-projection.test.ts`).
- **Done**: `applyFromFs(evt)` (same shape as the agent's, so the runtime fs-reader dispatches uniformly) imports all 5 types via the existing `applyXToDoc` diff codecs, tagged `FILE_IMPORT`; drops the echo via `echoGuard.consume`; per-path 3-strike circuit breaker quarantines an unparseable comments/meta file until its checksum changes. 10 tests in `test/shared-doc-projection.test.ts`. **Honest scope note (recorded in the test header):** the diff-import preserves untouched body regions and gives a true CROSS-TYPE no-clobber (a whole-file `/design:edit` body write does NOT touch concurrent in-doc comments — proven), but char-level merge of CONCURRENT edits to the SAME body region is Phase 10 (opaque Y.Text + prefix/suffix here). Browsers edit comments/annotations (separate types) live, so the residual is out of Phase C scope by design.
- **Wiring**: `sync/index.ts` — under `useSharedDoc` the per-canvas handler is a `createDocProjection` (started, in a `projections` map) INSTEAD of the agent; `onceSynced → projection.reconcile()`; the fs-reader `onRead` dispatches to agents-or-projections; `stop()` flushes+stops projections before tearing down providers; `size()` counts both.

### Phase D — Body gating (preserve DDR-054/060)

#### Task 8: body gating — ✅ verified + re-audited 2026-05-29 (separate-channel decoupling deferred, see below)
- **Do**: put `.tsx`/`.css` body in a subdoc (`autoLoad:false`) or separate hub `name: <slug>:body`, attached only when `syncable` opt-in (Lock 1) + `canvasOrigin` set (Lock 2). Comments/annotations/positions stay in the always-synced root doc. Update `untrusted.ts` markers to track the gated channel.
- **Gotcha**: verify HocuspocusProvider subdoc support on our version; fallback to separate doc-name. The body MUST NOT reach the hub unless opted in (security invariant — re-audit).
- **Validate**: opted-out canvas → body never crosses the hub; comments/annotations still sync.
- **Done (gate verified + re-audited; decoupling deferred):** The security invariant is enforced by **discovery exclusion** (`scanCanvases`: `.tsx` body enters the sync set only with `syncable` opt-in + `canvasOrigin` sandbox), and that gate holds **identically** under the shared-doc path — an opted-out `.tsx` gets no provider/doc, so its body is never exposed. Verified by `test/sync-runtime.test.ts` "Phase D — an opted-OUT .tsx body never gets a shared doc/provider" (asserts `runtime.size()`, `registry.peek` null for the opted-out slug, and `_untrusted/INDEX.json` lists only the opted-in canvas). `untrusted.ts` markers track the body-exposing set, mode-independent. **Security re-audit** (`flow:security-auditor` + `flow:ethical-hacker`, DDR-054 step 7) → full report in [`.ai/logs/security-reviews/phase-9.2-shared-collab-doc.md`](../logs/security-reviews/phase-9.2-shared-collab-doc.md). **0 flag-OFF blockers.** Two new-code gaps **FIXED here**: A2 (doc→file `MAX_*_BYTES` caps in `projection.ts` — hub raw-updates bypass the codec import cap) + A3 (`__proto__` reviver added to `codec.ts` `applyMetaToDoc`/`mergeSharedMetaIntoLocal` — was comments-only). Pre-existing / flag-ON-only residuals (A1 `.html` body gate, comments hub→disk cap, A4 slug collision, A6 pin cap, A7 re-consent, provider advisory check) documented in the review as a **pre-cutover checklist** — none block flag-OFF.
- **DEFERRED — separate-body-channel decoupling (comments-sync for opted-out canvases):** the plan offered "subdoc OR separate hub doc-name `<slug>:body`" so comments/annotations could sync for a canvas whose body is gated OUT. NOT implemented because: (1) the security requirement ("body crosses hub only with both locks") is ALREADY met by discovery-exclusion — the separate channel is a *granularity feature*, not a security fix; (2) it would change flag-OFF discovery (admitting all canvases for root-doc comment sync) → regression risk against the zero-regression bar; (3) splitting the body out of the shared root doc into a `<slug>:body` doc is a real re-architecture (codec/projection/room/persistence span two docs) whose true validation needs the live cross-machine security re-audit. Recorded as a scoped follow-up; the current gate is secure.

### Phase E — Migration (escape the duplication trap)

#### Task 9: CREATE `sync/migrate-seed.ts` — one-time authoritative reseed
- **Do**: on first cutover per canvas, pick ONE authoritative source (hub binary if present, else the local files), **clear+rebuild** the shared doc's types item-by-item inside a `transact(fn, MIGRATION)` (NOT `applyUpdate` of two docs). Persist the resulting binary on the hub as canonical; fan out to peers from that single history.
- **Gotcha**: this is THE step that avoids comment/annotation duplication (dmonad-confirmed). Snapshot `_history/<slug>/` + files first (rollback).
- **Validate**: reseed twice → identical state (idempotent); no duplicated comments.

#### Task 10: ADD shadow-compare + per-canvas cutover
- **Do**: with the flag in a "shadow" mode, run both paths, materialize both to canonical bytes, diff, log divergences (no user impact). Flip reads per-canvas once shadow is clean. Keep the two-doc path dead-but-present one full cycle, then delete in a follow-up.
- **Validate**: shadow run over the scratch two-peer setup → zero divergence before cutover.

### Phase F — Verification

#### Task 11: UPDATE `maude design status` + `_sync.json` + untrusted markers for the unified model
- **Do**: status reflects the single doc; markers track the gated body channel.
- **Validate**: `cli` tests.

#### Task 12: CREATE convergence + stress test suite
- **Do**: property-based commutativity/associativity/idempotency on the composed doc + the diff-importer; round-trip laws (`materialize∘import == id` on file, `import∘materialize == noop` on doc); extend `stress-integration.test.mjs` to N browsers + file-importer + hub with randomized delays/reorders → assert all replicas + files byte-identical after quiescence. Deterministic RNG seeds.
- **Validate**: full suite green; multi-peer stress converges.

---

## Validation

1. **Lint/format**: `pnpm --filter ... biome` (or repo biome) on touched files — clean.
2. **Types**: dev-server `tsc` (modulo the DDR-026 baseline).
3. **Tests**: `cd plugins/design/dev-server && bun test` — full suite green incl. new convergence + projection + stress tests; `node --test cli/` green; `pnpm --filter @maude/hub test` green.
4. **Convergence gate (load-bearing)**: property-based laws pass + multi-peer stress converges (replicas + files byte-identical). This is the no-break-exhaustive-verify bar for this refactor.
5. **Shadow-compare**: zero divergence between old/new paths over a real two-peer scratch run before any cutover.
6. **Live cross-machine manual**: the `/private/tmp/maude-scratch` + `maude-scratch-b` + local hub setup — comment/annotation/artboard/body edits on either peer converge live on both + on disk, no revert, under concurrent editing (the exact scenario Phase 9.1 couldn't make rock-solid). Verify via agent-browser per the no-break memory.
7. **Security re-audit**: body never crosses the hub when not opted-in (Lock 1+2 preserved); spawn `ethical-hacker` + `security-auditor` per DDR-054.

---

## Acceptance Criteria

- [ ] DDR-064 recorded (single shared doc supersedes two-doc + §F14 bridge).
- [ ] Flag default OFF = byte-for-byte current behavior (zero regression), verified.
- [ ] With flag ON: one `Y.Doc` per canvas; both providers attached; relays/disk-reconcile deleted under the flag.
- [ ] comments / annotations / artboard-layout converge live on both peers + on disk under CONCURRENT editing with no clobber/revert (the Phase 9.1 ceiling lifted).
- [ ] `.tsx`/`.css` body gated exactly as DDR-054/060 require (security re-audit clean).
- [ ] `/design:edit` (external file write) ingests as a diff into the live doc without clobbering concurrent browser edits; round-trip laws hold.
- [ ] No comment/annotation duplication after migration (the duplication-on-merge trap avoided via authoritative reseed).
- [ ] Convergence property tests + multi-peer stress green; shadow-compare clean before cutover.
- [ ] `/validate` passes; biome clean; no regression in the flag-OFF path.

---

## Risks

1. **Duplication-on-merge** (HIGH) — `applyUpdate`-ing two independent docs duplicates Y.Array items (dmonad-confirmed). **Mitigation:** Task 9 one-time authoritative clear-and-rebuild seed; never binary-merge the two legacy docs.
2. **Yjs imported twice** (HIGH) — server + bundled client holding different `yjs` instances → silent sync failure. **Mitigation:** pin/verify a single instance during Task 2; assert in a test.
3. **HocuspocusProvider subdoc support** (MEDIUM) — uneven across versions. **Mitigation:** Task 8 fallback to a separate hub doc-name for the gated body.
4. **`/design:edit` whole-file write clobbering concurrent browser edits** (MEDIUM) — **Mitigation:** Task 7 diff-import (never replace) + origin/hash gating + round-trip law tests.
5. **Migration data loss** (MEDIUM) — **Mitigation:** snapshot `_history/` + files first; shadow-compare + per-canvas cutover behind the flag; keep old path warm one cycle.
6. **Security regression in body gating** (MEDIUM) — the shared doc must not leak the gated body to the hub. **Mitigation:** Task 8 + a dedicated security re-audit (DDR-054).
7. **Scope creep into full character-level body co-edit** (LOW) — that's phase-10; this phase delivers the shared-doc FOUNDATION + a gated body channel, not necessarily live character-merge on the `.tsx`. Keep them separate.
