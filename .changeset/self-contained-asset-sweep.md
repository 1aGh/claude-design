---
'@1agh/maude': patch
---

The desktop app's asset upload no longer depends on tools installed on your
machine.

Uploading a project's images to the cloud runs in a helper process, and the
packaged app resolved that helper's runtime from the system PATH — which, for
an app launched from the Dock, doesn't include developer tool locations. On a
machine without a separately installed runtime the upload died at start with
"Executable not found in $PATH" and the assets waited for the next launch.
The compiled server now runs the helper through its own bundled runtime, the
same way every other packaged helper already works, so the sweep starts
regardless of what the machine has installed.
