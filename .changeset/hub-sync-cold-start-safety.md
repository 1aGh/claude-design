---
"@1agh/maude": minor
---

Hub sync — cold-start data safety + honest status (DDR-102)

Booting two checkouts/machines linked to the same hub in any order can no longer lose local canvas work, and linked-mode status stops lying about what's actually syncing. Driven by a production incident where one peer's day of mascot work was silently overwritten by another's stale version, and ~65 of 83 canvases never synced behind a permission-denied storm.

- **Never lose bytes on cold start** — a per-machine content-hash journal tells a clean catch-up apart from genuine divergence. A clean catch-up fast-forwards silently; real divergence snapshots **both** versions to `_history/<slug>/` first, then keeps the newer one (`/design:rollback <canvas>` restores the other). The pre-overwrite snapshot is **fail-closed**: if `_history/` can't be written, the overwrite is refused and local is kept. Comments union-merge by id — never lost in either direction.
- **One WebSocket per peer** — every canvas's provider is multiplexed over a single shared socket instead of one per canvas, so booting a large project no longer floods the hub with a connection burst.
- **Honest status** — `maude design status` and the studio banner now report per-canvas state (synced / pending / auth-rejected) with the rejection reason, conflict winners + snapshot timestamps, and a recovery hint; `lastSyncAt` reflects real sync activity, and the boot summary prints settled counts (`81/83 synced · 2 auth-rejected`), not a premature "all syncing".
- **Smarter auth handling** — the hub sends distinct rejection reasons over the wire (scope / invalid token / rate limit) and splits its rate limit so a legitimate multi-peer boot can't be throttled as if it were brute force (valid tokens 600/min per label via `HUB_CONN_RATE_LIMIT`; invalid attempts 100/min per IP). The peer classifies rejections, aggregates them into one console warning with a reason-correct hint, and stops retrying permanent failures.
- Re-linking a hub on a machine now warns that it replaces the stored token for every project linked to that hub.

Note: the hub image (`ghcr.io/1agh/maude-hub`) must be redeployed to pick up the rate-limit + rejection-reason changes; peer-side data safety applies regardless.
