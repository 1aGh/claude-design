---
'@1agh/maude': minor
---

One sync lane instead of two, and a cloud project that comes back whole.

The file-plane arc replaced a stack of sync mechanisms with a single lane, but
replacing is not removing — the old asset engines kept running underneath,
each a second opinion about a file's fate that nobody consulted on purpose.
They are gone now. One decision function moves every project file, both
directions; the old push and pull engines survive only as a thin compatibility
client for a self-hosted hub that has not upgraded yet, and even that is chosen
once when you link, never running beside the new lane.

The cloud side gets the durability the old engines never had for everything but
top-level pictures. Before, a hub-hosted project's design system — its
stylesheets, its shared modules, its fonts nested deep in the folder — was safe
only in the project's git history. A cloud instance that restarts pulls its
working copy from the newest backup, so anything added since existed in one
place that instance could not read, and canvases came back framed but unstyled.
Every one of those files is now written through to durable storage as it lands,
tracked by the same record the sync uses, so a restarted project comes back
whole instead of missing its styling. If a file is ever served from the backup
instead of the working copy, that is now a logged alarm rather than a silent
fallback — it means the working copy drifted and wants looking at.

On the desktop, the live editing buffer for each canvas is now the same object
that syncs to the hub by default, rather than a copy reconciled through disk.
Set `MAUDE_SHARED_DOC=0` to return to the previous two-document path.
