# DDR-121 — Live-session canvas propagation via Get latest (no project-level hub doc)

**Status:** accepted
**Date:** 2026-06-19
**Phase:** phase-30 (Native Maude — live multiplayer)
**Related:** DDR-120 (branch-scoped multiplayer — the model this propagation serves), DDR-064 (one Y.Doc + Awareness per canvas — there is no project-level room), DDR-028/phase-28 (the passive "Get latest" remote-probe nudge), DDR-095 (`apps/studio/` paths). Implemented in `apps/studio/api.ts` (`createCanvas`/`deleteCanvas`), `apps/studio/ws.ts`, `apps/studio/client/app.jsx`.

## Context

When a teammate creates (or deletes) a canvas during a session, the other peer should learn about it. The original phase-30 plan said to "broadcast a `canvas-list-update` event over the Yjs awareness channel" so it appears live for online peers.

Discovery showed this is under-specified for the actual architecture:

- Awareness is **per-canvas** (DDR-064). There is **no project-level / session-level room** that crosses the hub. The hub relays per-document Yjs only.
- The shell's event bus (the `/_ws` inspector channel) carries tree/git/comment events but is **loopback-only** — it does not cross machines.

So a *cross-machine* "a canvas was added" signal has no existing transport. Building one would mean a reserved project-level synced document attached to the hub — a new untrusted-input surface.

Under the DDR-120 branch-scoped model, that new transport turns out to be **unnecessary**: a new canvas reaches a peer only when it reaches their branch on disk, which happens through git.

## Decision

**Propagate the canvas list through the two channels that already exist — git for cross-machine, the loopback bus for same-machine — and add no project-level hub document.**

1. **Cross-machine: git "Get latest."** Creating/saving a canvas moves the branch HEAD forward. The peer (on the same branch) learns there is new work through the existing phase-28 passive get-latest nudge; after they Get latest, their tree shows the canvas. The canvas **file** travels via git, branch-scoped — exactly the DDR-120 visibility rule. An offline peer gets it the same way on reconnect. _(Enriching the nudge to name the specific new canvases is a deferred client polish; the nudge itself already fires.)_

2. **Same-machine: an ephemeral `canvas-list-update` bus event.** `api.createCanvas`/`deleteCanvas` emit `canvas-list-update {action:'added'|'removed', rel, slug}`; `ws.ts` broadcasts it to inspector (shell) clients; the `app.jsx` WS handler calls `loadTree()`, which re-reads `/_index-data` (disk = current branch). This makes two tabs/windows on the same dev-server refresh instantly without a reload. The event is **ephemeral** (a bus message, never persisted) and **loopback-only**.

## Consequences

- **No new hub transport, no new untrusted surface.** The riskiest piece of the original plan is removed by the branch-scoped model, not by building more.
- **Honest about the duality.** Online same-branch peers refresh via git Get latest (one tap); same-machine tabs refresh instantly via the bus. Both re-read the **branch-scoped on-disk** list, so the canvas list is always exactly "what's on my branch."
- **No cross-branch leakage.** Because the refresh re-reads disk, a peer never sees a canvas that isn't on their branch — consistent with DDR-120.
- **Tested:** `canvas-create-api.test.ts` boots a real server + inspector WS and asserts `added` on create and `removed` on delete.

## Alternatives considered

- **Reserved project-level synced Y.Doc on the hub** to push the list live cross-machine. Rejected: a new untrusted-input surface + provider lifecycle for a signal the branch-scoped model makes redundant (you only ever see your branch, and that arrives via git).
- **fs-watch → tree refresh for `.tsx`.** Partially viable for same-machine, but `.tsx` writes don't emit `fs:*` tree events today and the create path already knows the exact slug; an explicit semantic `canvas-list-update` event is clearer and avoids broadening the fs-watch surface.
