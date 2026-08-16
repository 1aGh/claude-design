---
'@1agh/maude': patch
---

A dropped picture crosses to your other machines in seconds, not minutes.

Both directions had a scheduler in the way. Uploading FROM the desktop waited
for the full reconciliation sweep — a debounce, a spawned helper process, and
a probe of every asset in the project — before one new file went up, which
read as minutes of a placeholder frame. Downloading TO a machine waited for
the next 20-second polling tick even though the annotation referencing the
picture had already arrived over the live connection.

Both get a fast lane now. A file you add is pushed by itself the moment it
lands on disk (one presence check, one upload — the sweep stays as the
safety net that reconciles everything else). And the moment a canvas or
annotation carrying an image reference arrives, the missing-files check runs
immediately instead of at the next tick. Combined with the in-place heal from
the previous release, the picture appears on the other side seconds after you
drop it.
