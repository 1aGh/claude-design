---
'@1agh/maude': minor
---

**Cloud: desktop and browser can now share live edits and cursors on the same project.**

Until now a Maude Cloud cell held two disconnected worlds — the hub's document store, which the desktop app syncs to, and the browser's own collab rooms, which never crossed the gap. A person editing in their browser and a person editing the same project in the desktop app couldn't see each other's cursors, and an edit made in one surface never reached the other live (both still saved to disk, so nothing was lost — the "live" part just didn't exist).

The cell's own studio process now pairs with its own hub over loopback — never dialing anywhere else — so the browser's editing buffer and the desktop's synced document become the same object. Presence and edits cross both ways; the hub remains the sole committer to the project's git history.

**Gated to a pilot project for now** (`CELL_LIVE_PAIRING`, currently `alligators` only) while the live cross-surface verification run — two real surfaces, cursors both ways, a reload losing nothing, exactly one committer — completes. No behavior changes for desktop, self-hosted hubs, or any other cloud project.
