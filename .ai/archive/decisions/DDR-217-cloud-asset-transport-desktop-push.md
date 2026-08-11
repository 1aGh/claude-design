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

## Addendum — 2026-08-11: the DS/brand asset class (checkout, not bucket)

**Status:** the original decision above shipped in 0.58.3 and was INCOMPLETE — it moved the wrong asset class. Fixed in 0.58.4.

**What the first pass missed.** The RCA assumed a project's assets live at `<designRoot>/assets/`. A real DS does not: `alligators` keeps 93 brand assets (logos, signs, fonts, photos) under `<designRoot>/system/<ds>/assets/…`, and its canvases reference them by their **full designRoot path** (`preview/_kit.tsx`: `const A = "/.design/system/alligators/assets"`; `src="/.design/system/alligators/assets/logos/mark-white.svg"`). That path is served **from the checkout by the studio child**, NOT from the bucket `/assets/` proxy. So there are TWO asset classes with TWO serving mechanisms:

| Class | On disk | Referenced as | Served on the cloud from |
| --- | --- | --- | --- |
| Content-addressed uploads | `<designRoot>/assets/<sha8>.<ext>` | `/assets/<sha8>` shortcut | the BUCKET (`/assets/` proxy, `assets.mjs`) |
| **DS / brand assets** | `<designRoot>/system/<ds>/assets/…` | full path `/.design/system/<ds>/assets/…` | the CHECKOUT (studio child static serve) |

The 0.58.3 push swept only class 1 (`<designRoot>/assets/`) and PUT to `/assets/<key>` (bucket). Class 2 never left the desktop, so every DS logo/photo rendered as a grey "Preview:" placeholder in the cloud — the exact bug reported after 0.58.3.

**Decision (0.58.4).** Add the CHECKOUT half. A new hub route `PUT /_asset-file/<designRoot-rel>` (`handleCheckoutAssetRoute`) writes a class-2 asset to the cell's checkout at its **real designRoot-relative path**, so the studio child's existing static serve finds it — **no new GET route, no Worker change** (the Worker forwards by hostname/tenant, and the studio child already serves `/.design/…` from the shared checkout). NO bucket mirror (class 2 is never bucket-served). The desktop sweep now walks EVERY `assets/` directory under designRoot (top-level + `system/*/assets/`) and routes each file by class: top-level → the existing `/assets/<key>` (bucket, unchanged); nested → `/_asset-file/<rel>` (checkout).

**Why a new route and not the existing `/assets/`.** The `/assets/` key space is relative to `<designRoot>/assets/` and refuses `..`, so it structurally cannot address `system/<ds>/assets/…`. And the GET semantics differ (bucket vs checkout). A separate route keeps both key spaces honest.

**Containment (this is a broader write surface than `/assets/`, so it earns extra guards).** DDR-054: a peer can commit a symlink into the checkout. `parseCheckoutAssetPath` requires: relative, no `..`/backslash/control-char, ≤512 chars, ≤8 segments, charset-safe components, SOME component exactly `assets` (never a canvas/config path), final component a whitelisted **binary** extension (image/font/media — NEVER `.tsx`/`.css`/`.json`/`.meta.json`, so it can never overwrite a compiled canvas, a stylesheet, or config.json). The write site then applies BOTH `isContainedReal` (symlink-resolved, inside designRoot) AND a second check that the resolved PARENT still lies under an `assets` directory — closing a symlink that stays inside designRoot but redirects out of the assets semantic (`system/ds/assets/escape -> ../../ui`). **The write itself targets the RESOLVED parent path (`realParent/<basename>`), never the lexical `abs`** — an adversarial review (2026-08-11, F1) found that streaming to the lexical path would let `mkdirSync`/`createWriteStream`/`renameSync` re-traverse the symlink chain at WRITE time, reopening the TOCTOU the realpath check had just closed; resolving the parent once and writing under it removes the lexical symlink from the write path. Same streaming + per-file cap + session budget + per-request temp nonce as the bucket PUT (shared `streamToFile`), and the `HEAD` presence probe (idempotent sweep) is rate-limited too (F4 — no unmetered existence oracle for the weakest role).

**Accepted residual risk (adversarial review 2026-08-11).** (F2) the `assets`-segment check bounds WHERE, not WHAT — a peer authors their own tree and can create an `assets/` dir anywhere; the **binary-extension allowlist is the load-bearing backstop** against a data→code write, and the segment check is defence-in-depth. (F3) `renameSync` has no per-peer ownership gate, so a credentialed member can overwrite a brand asset — accepted, because brand/DS assets are **shared project content every member can already change** (edit the DS via canvases, commit new assets); this is not the per-peer-owned-file case the canvas relocation writer guards. (F5) the per-process 2 GB `putBudget` is shared across the two lanes and only resets on restart — generous, and a bounded self-DoS at worst.

**Consequences / follow-ups.**
- Two `defaultPutBudget` instances (one per route) — the aggregate disk-fill ceiling is per-route, not global. Acceptable (each is 2 GB/process); a shared budget is a one-line follow-up if it matters.
- `.photo.json` sidecars and any non-asset-extension file are no longer pushed (the 0.58.3 pass wastefully pushed `.photo.json` to the bucket) — if cloud photo-EDIT ever needs the sidecar, that is a separate, deliberate lane.
- Class-2 assets land on the checkout but are NOT committed by the workspace agent (same as class 1 — the browser-upload precedent).
