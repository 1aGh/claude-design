# Feature: desktop ↔ cloud live pairing (presence + edits cross)

**Status:** planned — architecture fork open, needs owner sign-off before code.
**Origin:** RCA `issue-desktop-never-joins-the-cells-collab-rooms.md`. A cell holds
two disjoint Y.Doc worlds; desktop and browsers never meet.

## The constraint that reshapes everything — DDR-209 / Phase 27 D2

`sync/index.ts:238` refuses a sync runtime in workspace mode, by design:

> "Honouring linkedHub inside a cell would dial OUT from the cell to a
> third-party hub carrying the project's canvases, and start a SECOND autocommit
> over the working tree the hub is already committing — the exact duplication
> this phase exists to delete. In a workspace cell the hub owns history and sync."

So the two-worlds split is a DELIBERATE decision: **the hub owns sync + history;
the studio child only serves browser rooms + builds canvases.** This kills the
originally-recommended **B** (studio child dials its own hub) — B reverses
DDR-209 (second autocommit + dial-out). B is OFF THE TABLE.

## The DDR-209-consistent path — C: unify at the HUB

Both desktop and browsers already CAN reach the hub. The desktop connects to the
hub Hocuspocus (per-canvas `documentName`, SQLite-durable, owns
`afterStoreDocument` → disk → autocommit → hourly mirror). Make the BROWSER's
`/_ws/collab/<slug>` in a cell attach to that same hub Hocuspocus document
instead of a separate studio-child room. Then:

- ONE doc per canvas (hub Hocuspocus, durable), desktop + browsers all peers.
- Persistence / autocommit / mirror UNCHANGED (hub owns them — matches DDR-209).
- Presence crosses for free (Hocuspocus awareness).
- The shared-doc single-Y.Doc discipline (DDR-064: origins + echo-guard) is the
  correctness foundation — and DDR-064 confirms it's off only for CAUTION + an
  unfinished cutover checklist, not a known bug.

### Why C is bigger than a flag

In a cell the studio child currently OWNS the collab registry — comments,
annotations, activity, presence, AND the fs:any bridge shipped today all hang off
the studio room. Moving collab-room ownership to the hub means re-homing those
lanes or bridging them. This is the load-bearing part.

## Open architecture decision (needs owner call)

- **C1 — route browser `/_ws/collab` to the hub Hocuspocus in a cell.** Cleanest
  unification, fully DDR-209-consistent. Cost: the studio room's other lanes
  (comments/annotations/activity) must be re-homed onto the hub doc or bridged;
  the fs:any bridge may become redundant (the hub doc → afterStoreDocument is the
  writer). Largest structural change; highest payoff.
- **C2 — keep the studio room, add an in-cell in-process bridge** between the hub
  Hocuspocus doc and the studio room for the same slug (shared-doc discipline
  applied to a co-located pair, no dial-out — so it does NOT trip DDR-209's
  "dial to a third party / second autocommit" rules if the hub stays the sole
  committer). Smaller blast radius; re-uses the studio room as-is. Risk: the
  in-cell bridge is a new coupling between two processes (hub + studio child) —
  needs the echo-guard + a single-committer invariant to stay true.

## Implementation order (once C1 vs C2 is chosen)

1. **Read the full DDR-064 pre-cutover checklist + the shared-doc projector** —
   it is the correctness spec. Confirm which checklist items are cell-relevant
   (slug-collision detect, pinned-room cap, consent notice, provider CVE check).
2. Wire the chosen bridge; keep the hub as the SOLE committer (DDR-209 invariant).
3. Cold-start convergence: reuse DDR-102 divergence resolution for the
   desktop-state ↔ browser-state first-connect reconcile.
4. Re-check the container-write-bridge (shipped today) for double-fire once the
   doc→disk projector is the writer.
5. **Verification bar (no-break-exhaustive-verify):** the `shared-doc-convergence`
   property suite (commutativity / idempotency / round-trip + N-peer randomized
   stress → byte-identical) MUST be green, PLUS a live cross-surface run:
   desktop + browser on one cell, an edit and a cursor cross each way, and a
   reload loses nothing.

## Explicitly NOT doing

- **B** (studio child → its own hub): reverses DDR-209. Rejected.
- Shipping any of this to the fleet before the convergence suite + live run pass.
