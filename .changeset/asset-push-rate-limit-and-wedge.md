---
'@1agh/maude': patch
---

A project's assets now finish uploading to the cloud in one pass.

The authenticated asset write lane was sharing the hub's per-IP admin rate-limit
bucket (5 requests a minute — a brute-force control for unauthenticated
traffic), so a project with a lot of images, fonts and video moved a handful of
files per boot and never caught up. It gets its own generous per-token bucket
now, the desktop paces itself on the hub's `Retry-After` instead of burning the
window, and a refused upload no longer wedges the sweep — a peer that answers
before reading the body used to leave the connection desynchronized, which
could hang the sync and take the dev server with it. A file the hub refuses is
also named with the real reason instead of a bare status code.
