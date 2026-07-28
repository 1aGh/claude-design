## DDR-064 — One shared `Y.Doc` per canvas (both providers attach; disk = projection)

- **Status:** Accepted — 2026-05-29
- **Authors:** 1aGh (decision) + Claude (implementation + security re-audit)
- **Phase:** 9.2 (rock-solid shared collaboration doc)
- **Supersedes:** the two-`Y.Doc`-per-canvas + disk-mediated-reconcile model (Phase 8/9 collab room doc ⟂ sync-agent doc); [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) §F14 "doc-content bridge" deferral (this REPLACES the bridge with a single shared doc)
- **Superseded by:** —
- **Amends:** [DDR-051](./DDR-051-collab-persistence-json-canonical-ydoc-bin-cache.md) (binary stays the cache; JSON/SVG/meta become loop-free projections, not a reconcile medium), [DDR-052](./DDR-052-hocuspocus-provider.md) (the provider now attaches to an existing doc), [DDR-060](./DDR-060-tsx-only-format-breaks-html-centric-sync.md) / [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md) (the two-lock body gate is preserved by discovery exclusion under the new path)
- **Related:**
  - `.ai/plans/phase-9.2-shared-collab-doc.md` — the plan (research tracks: Zed, Figma, Yjs/Hocuspocus, local-first)
  - `.ai/logs/security-reviews/phase-9.2-shared-collab-doc.md` — the security re-audit (gitignored; this DDR + the plan are the committed summary)
  - `.ai/plans/phase-10-structured-crdt-html-coediting.md` — char-level body co-edit, builds ON this foundation

## Context

Linked-mode collaboration kept **two** `Y.Doc` instances per canvas — the browser-facing collab room doc and the hub-facing `HocuspocusProvider` doc — reconciled through a **side channel**: room → disk → fs-watch → sync-agent → hub → peer → disk → room, plus a Phase 9.1 in-process wholesale-replace relay and an fs re-seed hook. That is the textbook side-channel-reconciliation anti-pattern the CRDT/local-first literature was written to kill: two divergent replicas merged by copying whole values clobber concurrent edits (last-writer-wins at coarse granularity). Phase 9.1 narrowed the race (observed live 2026-05-29: a peer's stale in-memory doc re-persisted over a hub-pushed change, reverting it on both peers); it could not close it while two docs existed. Rock-solid live multiplayer needs the two docs to be **one**.

## Decision

**Stay on Yjs; converge to ONE shared `Y.Doc` per canvas**, owned by the collab registry, with both network providers + the disk binding attached to that single instance. This is the canonical Yjs pattern (y-websocket-server's `getYDoc(name)` cache + `HocuspocusProvider({ document })`), confirmed across all four research tracks. CRDT merge eliminates the clobber **by construction**; the file becomes a loop-free, debounced **projection** of the doc (Zed's principle), still fully editable by Claude / humans / git, ingested as diffs — never racing the doc.

Shipped behind **`MAUDE_SHARED_DOC` (default OFF)**, opt-in, the inverse of `MAUDE_CANVAS_ORIGIN_SPLIT`'s opt-out parsing. Flag-OFF = the proven two-doc path = byte-for-byte current behavior (verified: 720-test baseline unchanged by stash-and-compare). The flag stays OFF until the live cross-machine cutover + the pre-cutover checklist below close.

### What flips when the flag is ON

- **One doc, both providers** — `registry.getDoc(slug)` returns the room's single cached doc; the `HocuspocusProvider` attaches to it (`document: getDoc(slug)`). Browser edits flow straight into the doc that syncs to the hub — no disk hop, no relay, no reconcile. The room is **pinned** while a provider is attached so the last-browser-leaves `drop` can't destroy the doc under the provider (self-gating — flag-OFF never pins).
- **Relay retired** — the in-process `syncRoomFrom*` wholesale-replace + the `createCollab` fs re-seed are gated off under the flag (kept for flag-OFF). This is what lifts the Phase 9.1 ceiling.
- **Disk = projection** (`sync/projection.ts`, replaces the file-mirror agent under the flag) — doc→file writes html/css/meta (the room keeps comments/annotations doc→file, so no double-write); file→doc imports all five types as a **minimal diff** (reuse the prefix/suffix codecs) tagged `FILE_IMPORT`, never wholesale. Loop-free via an echo-hash drop + an origin filter + a per-path 3-strike circuit breaker.
- **Origin discipline** (`sync/origins.ts`) — frozen `DISK_PROJECTION` / `FILE_IMPORT` / `MIGRATION` sentinels (+ the per-instance HUB / LOCAL_WS origins); every writer tags, every consumer filters its own.
- **Migration** (`sync/migrate-seed.ts`) — the duplication-on-merge trap (dmonad-confirmed: `applyUpdate`-ing two independent docs duplicates Y.Array items) is escaped by a one-time authoritative seed: pick ONE source (hub-wins if the synced doc holds state; adopt local files only when the hub was empty) via clear+rebuild inside `transact(fn, MIGRATION)`. The room's local file-seed is disabled for pinned slugs so it can't re-introduce duplicate items.
- **Body gate preserved** — a `.tsx` body crosses the hub only with the `syncable` opt-in (Lock 1) + the `canvasOrigin` sandbox (Lock 2), enforced by discovery exclusion exactly as before (an opted-out `.tsx` gets no provider/doc). Security re-audited (security-auditor + ethical-hacker): **0 flag-OFF blockers**; two new-code gaps fixed (doc→file size caps; the `__proto__` reviver extended to the meta lane).

### Rejected alternatives

- **B — Figma-style server-authoritative per-property LWW (rip out Yjs).** Too big a rewrite; Yjs already gives merge for free. We **borrow its granularity lesson** (decompose blobs, small conflict blast-radius) inside option A.
- **C — keep two docs, keep patching the bridge.** Phase 9.1 proved the race only narrows, never closes (whack-a-mole: comments fixed → annotations broke).

## Consequences

- The file-sync contract is unchanged for Claude: `/design:edit` writes a whole file; the projection ingests it as a diff (cross-type no-clobber proven — a body write doesn't touch concurrent in-doc comments). True char-level merge of CONCURRENT same-body-region edits is **Phase 10** (opaque Y.Text + prefix/suffix here).
- **Pre-cutover checklist (before `MAUDE_SHARED_DOC` ships ON)**, from the re-audit: gate `.html` bodies like `.tsx` (A1 — pre-existing residual; real projects are TSX-only); cap/sanitize the comments hub→disk lane; detect slug collisions (A4); cap pinned-room count (A6); add a one-time consent notice when `sharedDoc && linkedHub` first engages (A7); verify the `@hocuspocus/provider` version against 2025 advisories.
- Convergence is gated by a property suite (`test/shared-doc-convergence.test.ts`: commutativity / idempotency / round-trip laws + a seeded N-peer randomized-delivery stress → all replicas byte-identical) + the live cross-machine manual run (the no-break-exhaustive-verify bar).
