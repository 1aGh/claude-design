# DDR-051: Collab persistence — JSON snapshot at quiescence; `.ydoc.bin` is gitignored live state

**Status:** Accepted — 2026-05-26.
**Tags:** collab / phase-8 / persistence / yjs / git-lifecycle
**Related:** [DDR-047](DDR-047-collab-scope-cut-no-lan-mode-hub-admin-ui.md) (Phase 8 = loopback-only foundation, no LAN), [Phase 8 plan](../plans/phase-8-live-collaboration-yjs-lan.md) Task 0 + Task 3 + Task 7.

## Context

Phase 8 puts a Yjs Y.Doc behind every canvas. Two formats are then candidates for "the truth on disk":

1. **`.ydoc.bin` — Yjs binary update log.** What `Y.encodeStateAsUpdate(ydoc)` emits. Round-trips losslessly through `Y.applyUpdate`. **Not human-readable.** Grows monotonically without `Y.encodeStateVector` GC.
2. **The pre-existing JSON snapshots** — Phase 6's `.design/_comments/<slug>.json`, Phase 5's `.design/<slug>.annotations.svg`. Human-readable. Git-diffable. The format every Maude tool, downstream agent, and human-on-PR-review already understands.

Reviewers asked two questions during plan preflight:

- **What does git see?** If the `.ydoc.bin` is the canonical artifact, then every Y.Array mutation is an opaque binary diff in PRs. The Maude review pitch ("see the comment thread in the diff") collapses to "see the comment in the rendered preview", which is a much weaker proposition.
- **What does cold open look like?** First-clone users won't have `.ydoc.bin`. If the runtime requires it, comments don't appear until a synthetic seed step runs. That seed step is a bug magnet — fail to run it once, the user assumes "comments are gone".

A third concern surfaced from the Phase 7 retro learnings: **git lifecycle.** When a user does `git checkout other-branch` mid-session, the in-memory Y.Doc and the on-disk state can diverge. If the runtime debounces JSON writes by 800 ms (the design goal — avoid hot-path churn during typing), an unlucky checkout can land between the last Y.Array mutation and the next flush. The user comes back, the file on disk is the pre-edit JSON, the edit is "lost" from their POV even though Yjs still has it in memory until the iframe reloads.

## Decision

**JSON is the canonical persistence format. `.ydoc.bin` is a cache.**

Three coordinated rules.

### 1. Write-back snapshot at quiescence (debounce 800 ms)

After every accepted Y.Array op the room schedules a debounced write of the JSON projection. 800 ms was picked because:

- Typing a comment never produces > 1 op every 800 ms unless the user pastes a long string (whole-text op = single mutation).
- The next-write delay is bounded — a single character edit forces a write within ≤ 800 ms, well below the next-tick frame budget of any human-noticeable interaction.
- Aligns with Phase 4's existing canvas-meta debounce floor; one less number to remember.

JSON snapshot shape MUST equal what `api.saveCommentsForFile` / `api.saveAnnotations` already produce. Phase 8 does not redesign the on-disk shape — it stays whatever Phase 6 / Phase 5 chose. Yjs sees the same JSON the legacy non-collab code path saw, in the same path.

### 2. `.ydoc.bin` is gitignored, regenerated on cold open

Path: `<designRoot>/_state/<slug>.ydoc.bin`. Added to `.gitignore` by the `.gitkeep` change in this phase. Server load order on canvas open:

```
1. Try .ydoc.bin → apply as Y.Doc update → done.
2. If no .ydoc.bin → read JSON snapshots (comments, annotations, future
   draw ops) → seed Y.Doc transactionally → done.
3. If neither exist → empty Y.Doc → done.
```

This means **a first-clone user always works**. They never have `.ydoc.bin` but they always have the JSON files (or absence of them, which is the same as "no comments yet"). The seed step is the same code path the migration runs.

`.ydoc.bin` exists purely so reconnecting clients get fast catch-up via `Y.encodeStateAsUpdate` — much cheaper than re-deriving Yjs internal structure from JSON every reconnect. It is **not authoritative**. Delete it and nothing breaks; the next request rebuilds from JSON.

### 3. Force-snapshot before git lifecycle events (no-data-loss invariant)

The dev-server already watches `.git/HEAD` (Phase 8 Task 7). On detected branch switch OR pull:

```
1. SYNCHRONOUSLY flush every dirty Y.Doc to its JSON snapshot path
   (bypassing the 800 ms debounce).
2. THEN emit the "Repo state changed — reload?" prompt to connected peers.
3. THEN on peer confirm, drop the in-memory Y.Doc and reload from disk
   (which now reflects whichever branch is currently checked out).
```

Order matters. Without step 1, the prompt can fire while in-flight edits are still buffered, and the user's "reload" choice silently discards them. After step 1, the disk has the latest in-flight Y.Doc projection, the reload then reseeds from the post-checkout JSON, and the lost-edit problem becomes a 3-way-merge problem (which is git's job, not ours).

`fs.watch` on `.git/HEAD` is the trigger, not `fs.watch` on every JSON file — the latter would race with our own debounced writes.

## Rationale

**Why JSON as ground truth (not `.ydoc.bin`)?**

- PR review value depends on the diff being legible. A `[+ comment "fix this button color"]` line in a `.design/_comments/Foo.json` patch is worth more than a `.ydoc.bin` BLOB.
- Downstream Maude tools (`/design:export`, `/design:handoff`, the registry-item emitter) already speak JSON. Replumbing them to read `.ydoc.bin` is gratuitous churn for no user-visible win.
- Phase 9 (hub deploy) will need to copy state machine-to-machine. JSON-over-HTTP is universal; `.ydoc.bin` blobs would force the hub protocol to expose Yjs internals.
- The "comments-as-JSON" format has been on disk since Phase 6; downgrading it to a cache is a one-way trip. Inverting the relationship later (treating `.ydoc.bin` as truth) is the easier migration if Phase 10's structured CRDT HTML editing demands it.

**Why not "JSON as the only format" (drop `.ydoc.bin` entirely)?**

- Y.Doc state is more than the projection. Tombstones, deletion vectors, vector clocks — they're what make merges commutative. JSON-only would force each reconnect to redo conflict resolution by re-reading every author's history (which JSON doesn't store).
- The 800 ms debounce window means a reconnecting peer could miss the latest ops. The `.ydoc.bin` cache covers the window between "client got disconnected" and "next debounce fires". Without it, brief drops produce divergent state.

**Why not `.ydoc.bin` committed (so git sees collab state)?**

- Binary diffs in PRs are noise. Reviewers don't read them; CI bots that auto-summarize PRs choke on them. Treating `.design/_state/*` as gitignored matches every other "runtime cache" directory in the project (`_history`, `node_modules`, `.next`, …).
- Two engineers editing the same canvas on separate branches and both committing `.ydoc.bin` files produces a merge conflict in a binary blob that neither side can resolve by hand. JSON merges are at least diff-readable; binary merges aren't.

**Why force-snapshot at git lifecycle (not just "always-fresh JSON")?**

- The debounce is the whole reason the JSON path is cheap. Removing it (writing on every op) would multiply disk writes by 20–100× during typing. Force-snapshot is the cheap escape valve: pay the full sync cost once when the user is about to leave the current branch context anyway.
- `fs.watch('.git/HEAD')` is a single watcher, not per-canvas — total cost is one syscall per branch switch, which is in the noise.

## Consequences

- **Implementation:** Y.Doc registry maintains a per-canvas `dirty: boolean` flag set on `update` event, cleared by debounced flush. Branch-switch handler iterates the registry and flushes any `dirty: true` rooms synchronously before broadcasting reload.
- **Migration:** none. Existing JSON files become Yjs seed input on first open of any canvas; new mutations debounce-flush back to the same paths.
- **Threat model:** unchanged from DDR-047. Loopback-only WS, no network exposure. `.ydoc.bin` lives next to `.git/` so it inherits the same FS permissions as everything else in `<designRoot>/`.
- **Future:** Phase 9 hub deploy MAY treat JSON-on-hub as canonical and replicate to clients on connect, mirroring Phase 8's local model. Phase 10 (structured CRDT for HTML co-edit) MAY need to invert this if Y.XmlFragment <-> HTML round-trip is too lossy through JSON; revisit then, not now.

## Acceptance test (Phase 8 Task 7 validate row)

After this DDR lands, the smoke test is:

1. Open a canvas in tab A. Drop comment "X". Wait 800 ms. Confirm `<designRoot>/_comments/<slug>.json` contains "X".
2. Without waiting, drop comment "Y". Within the 800 ms debounce window, run `git checkout other-branch && git checkout -`. Confirm the JSON contains BOTH "X" AND "Y" (force-snapshot fired).
3. Delete `<designRoot>/_state/<slug>.ydoc.bin`. Reload the canvas. Confirm "X" and "Y" still render (cold-open seed from JSON).
