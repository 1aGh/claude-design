---
'@1agh/maude': patch
---

Cloud: a source edit (Inspector CSS, artboard resize/style, insert/reorder) now updates a collaborator's canvas live, instead of waiting for them to refresh.

Two people on one cloud project share one server. When one made a source edit, the change reached disk and the git history but the other person's canvas sat on the old version until they manually reloaded — annotations crossed live, structural edits didn't. The cause: the studio announces edits to peers through a filesystem watcher, and the container's recursive watch silently misses the atomic file writes the editor makes (it works on a local Mac, which is why this only showed up in the cloud). Verified against a live project: an edit that returned success delivered nothing to a connected peer socket. The fix announces each write directly from the edit path rather than depending on the watcher, so a peer's canvas hot-swaps within a fraction of a second; a no-op or rejected edit announces nothing. Local (non-cloud) behaviour is unchanged.
