---
'@1agh/maude': patch
---

Moving a canvas, and opening one made on another machine, stop losing work.

Four defects in the cloud↔desktop sync, all found by driving a real pair by hand
rather than by a test, and each one silent — nothing failed, the work simply
wasn't there.

Moving a canvas into a folder left every other machine showing it at the old
place. A move renames the canvas's files onto its new name, and that included
the document's own CRDT cache — whose last recorded word, written a step
earlier, was "I have moved away." The new document therefore opened already
retired and every peer let go of it. The cache is dropped on a move now (the
canvas is on disk by then), and a document that claims to have moved to where it
already is gets repaired instead of released — which is what heals the projects
that already carry the bad stamp.

A canvas created on a desktop could arrive in the cloud with its body written
twice, which renders as an empty canvas. A cloud workspace has two writers over
one folder — the hub, and the studio it supervises — so the studio kept finding
files it had no record of and offering them to the hub as new, at the moment the
hub's own copy was still in flight. Two rebuilds of the same body do not merge;
they concatenate. The studio now asks the hub what it already holds before
offering anything.

Editing a canvas in the cloud that was created on a desktop looked like it
worked and then quietly reverted, because that canvas had never joined the
cloud's sync set at all. And a canvas whose name contains a space could arrive
twice under two names, colliding with itself until it stopped syncing entirely.

Also: revoking an invitation in the admin console now actually revokes it (the
button called a route the hub does not serve, so the link stayed usable), the
outstanding-invites list no longer counts spent ones, and an invite's expiry
reads as time remaining rather than "just now".
