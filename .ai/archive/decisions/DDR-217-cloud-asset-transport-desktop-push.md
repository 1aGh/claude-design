# DDR-217 — Cloud asset transport: the desktop PUSHES `assets/` to the cell over the authenticated asset route

**Status:** Accepted — 2026-08-10.
**Related:** [DDR-088](DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (the local asset write surface + cap set this extends to the hub), [DDR-054](DDR-054-self-hostable-hub-trust-model.md) (peers are untrusted — every cap below is the trust mitigation), DDR-064 (the sync lane vocabulary this deliberately does NOT extend), the 2026-08-10 sync RCA (fix 6: grey boxes — the cell's `/assets/` route serves bytes it doesn't have).
**Instruments:** `apps/hub/src/assets.mjs` (PUT branch), `apps/hub/src/server.mjs` (route wiring + sweeper handoff), `apps/studio/sync/asset-push.ts` (the desktop-side sweep), `apps/studio/sync/index.ts` (boot wiring).

## Context

A desktop-linked cloud project renders its cloud copy with grey boxes: the sync lanes are `html`/`css`/`meta`/`syncMeta` only, so `<designRoot>/assets/*` never leaves the desktop. The cell already has the whole SERVING side — a checkout the studio child serves assets from, an asset sweeper that mirrors checkout → bucket (`asset-lane.mjs`), and a peer-token-gated `/assets/` proxy (`assets.mjs`) — but no bytes ever arrive from a desktop peer.

## Options considered

- **(A) git-remote pull** (the plan's provisional recommendation) — the cell pulls the tenant's git remote, assets ride the channel they already live on. **REFUSED by the codebase's own facts**: (1) the cell checkout does NOT track a usable tenant remote — `seedRepo`'s post-clone hygiene rewrites origin to a token-free URL or removes it outright ("the seed never leaves a credential on disk"), so a later pull has nothing to authenticate with; (2) desktop and cell histories are deliberately SEPARATE (the cell owns its history — Cloud Phase 27 D2, and fix 8 of this same RCA formalizes cloud-managed history) — pulling desktop commits into the cell would merge two unrelated histories, the exact duplication D2 exists to delete.
- **(C) cell-side lazy fetch on `/assets/` 404** — inverted connectivity: the bucket doesn't have the bytes either (the sweeper only mirrors what is already in the checkout), and a cell cannot reach a NAT'd desktop. Nothing to fetch FROM.
- **(B1) binary lane over Yjs** — binary blobs in CRDT documents amplify memory on every peer, survive forever in update history, and extend the DDR-064 lane vocabulary for something with no merge semantics (an asset is content-addressed-ish and immutable-ish; there is nothing to merge). Rejected.
- **(B2) — CHOSEN — desktop→hub HTTP push on the existing asset route.** The desktop is the one peer that HAS the bytes and it already holds an authenticated channel to the cell. `PUT /assets/<key>` (same `verifyToken` Bearer gate and the same `ASSET_KEY` shape validation as the existing GET/HEAD proxy) streams into the checkout `<designRoot>/assets/<key>`; the existing `sweepNew()` then mirrors it to the bucket, exactly the path a browser upload already takes (studio child `POST /_api/asset` → checkout → sweepNew). The desktop runs a boot-time sweep: list local `assets/**`, `HEAD /assets/<key>` to skip what the cloud already holds, `PUT` the rest.

## Decision

**(B2).** One new verb on an existing, already-authenticated, already-shape-validated route — no new transport, no new lane vocabulary, and the cell-side flow after the write is byte-for-byte the browser-upload precedent (checkout + bucket mirror; not committed, matching how browser uploads are treated today).

**The prior "the hub never becomes an upload endpoint" note in `assets.mjs` is superseded, not ignored.** Its threat was "an unauthenticated-ish disk-fill surface". The PUT branch is neither unauthenticated nor unbounded:

- **Bearer `verifyToken`** — the same peer-token gate as the GET proxy; an anonymous PUT is 401 (rate-limited like the GET's 401 path).
- **`ASSET_KEY` shape validation** — the same anchored regex as the proxy (no `..`, no leading `/`, bounded charset/depth/length) runs BEFORE any filesystem path is formed; plus a resolved-path containment assert under `<designRoot>/assets/` (defence-in-depth, DDR-054).
- **Streaming write with a hard per-file cap** — request → temp file → rename, never buffered whole (videos run to ~100 MB; `ASSET_MAX_VIDEO_BYTES` is the ceiling, env-overridable like its studio twin). Over-cap aborts the stream and removes the partial.
- **Workspace-gated** — the branch exists only when the hub HAS a checkout (workspace mode); a hub without one keeps today's 405.

## Consequences

- The desktop sweep is boot-time (per sync start) — an asset dropped mid-session reaches the cloud on the next boot/reconnect. Acceptable v1; a watcher hook is a follow-up if it ever bites.
- Assets pushed this way are in the cell's checkout + bucket but NOT committed by the workspace agent — the browser-upload precedent. If asset history matters later, staging `assets/` in the agent is a one-line follow-up (the paths are already inside the design root).
- `HEAD`-before-`PUT` makes the sweep idempotent and cheap (one HEAD per asset per boot; upload only on 404).
- The desktop-side key derivation mirrors the sweeper's `pendingAssets` shape rules; the HUB's validation stays authoritative (each trust boundary validates its own input — client-side filtering is a convenience, never the gate).
