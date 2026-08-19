---
'@1agh/maude': patch
---

The cloud stops needing a reload, and it stops needing a schedule.

A file that reached the cloud had already arrived — the bytes were on disk and
the server would happily serve them to anyone who asked. Nothing asked. Inside
the container, the mechanism that is supposed to notice a file appearing does
not fire for the way files actually get written there, so the page showing a
broken frame had no idea the picture it wanted was two directories away. The
only cure was a manual reload, which is why "sync doesn't work" and "sync
finished a minute ago" looked identical from the outside.

The fix is to stop guessing. The hub now keeps an ordered record of every write
it accepts, and the moment it accepts one it says so — over the same connection
your canvases are already using. Peers fetch immediately instead of waiting for
the next 20-second check, and an open cloud tab repairs the broken frame in
place.

What crosses that connection is deliberately almost nothing: a single number
saying the record moved. It never carries a path, a file, or a hash, so a peer
still learns *what* changed only by asking through the same authenticated,
re-validated route it always used. A lost notification therefore costs a few
seconds and never correctness — the periodic check is still underneath, and it
stays at its current cadence until the new path has proven itself in real use.

Hubs that predate this simply don't advertise it, and every peer keeps today's
behaviour against them unchanged. Per project, `linkedHub.fileEvents: false`
opts back out.
