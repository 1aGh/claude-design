---
"@1agh/maude": minor
---

Phase 9 Task 5 — awareness over WSS (cursors/selections/viewport relay through the hub).

In linked mode the dev-server now bridges the collab Room's Awareness to the sync
provider's hub-synced Awareness, so a browser cursor published on one peer reaches
cross-continent peers via Hocuspocus (which relays awareness between document peers
by default — no hub change needed). The bridge uses shared-origin echo prevention
and is owned by the collab registry, which wires it on room creation and re-wires
across room churn while the provider persists.

Awareness is ephemeral and writes no files, so this is a provable no-op in solo
mode (the rendering path is untouched) and does not intersect the comments/annotations
file-ownership question (DDR-054 F14), which remains deferred to the doc-content bridge.

Because linked-mode awareness now arrives from a semi-trusted hub, all foreign
peer state (name/color/cursor/selection/annotations) is sanitized at the single
`useForeignAwareness` read chokepoint before it reaches the cursor/participant
render sinks: the wire color is discarded and re-derived locally, the selection
selector is restricted to the locator grammar (rejecting functional pseudo-classes
that would cause a render-time DoS), display names are control/bidi-stripped and
length-capped, and peer/annotation counts are bounded.
