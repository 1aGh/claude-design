---
'@1agh/maude': minor
---

Your whole design folder syncs now, deletions stick, and the folder has one owner.

Until now a linked project synced its canvases and the pictures that happened
to sit next to them. Everything else — the design system's stylesheets, its
README, the fonts, shared modules — stayed on whichever machine made it. A
teammate opening the project got every canvas and none of the styling those
canvases were written against, which looks less like "sync is behind" and more
like "the project is broken".

That folder now mirrors both ways in full. Which files count is decided by one
rule on each side, and each side asks its own copy rather than trusting the
other's answer. Three things still never travel: the file naming your hub (a
synced one would let a hub rewrite where it lives), your per-machine state like
camera position and local history, and another program's conflict copies.
Executable modules are the one class gated at both ends. Linking asks once
whether a hub may deliver them, defaulting to no, and that answer lives on your
machine where no sign-in response can change it.

Deleting works. Before, a removed file came back on the next pass, because
absence and "I haven't heard about it" are the same thing on the wire until
somebody says otherwise. A deletion is now a statement with a timestamp, sent
with the same precondition an edit carries — so if somebody changed the file
while you were deleting it, their change wins and the file returns. Nothing is
ever unlinked: the losing copy moves to a trash folder on both ends. And when a
batch goes at once — a branch switch, a restore that half-finished — sync
pauses in both directions and the Sync panel says what it was about to do and
to which files; nothing moves until you agree. That pause is a budget, not a
per-check limit: it counts what has already been removed over the last hour and
remembers across a restart, because the thing it guards against adds up.

The folder also has exactly one owner now, where it used to quietly have two.
Committing `.design/` while a hub mirrors it reads as extra safety and is the
reverse: a `git pull` and a sync pass can each undo the other, and which wins
is a matter of timing. So a project is repo-owned or hub-owned. `maude design
adopt` moves it to the hub, `maude design detach` brings it back, and neither
moves a byte on your disk — adopt stops git tracking the folder, detach lets it
see it again, and what to commit stays your call. Projects linked before this
keep working and say so until you choose.

Per project, `linkedHub.syncFiles: false` returns to the old narrow sync and
`linkedHub.propagateDeletes: false` holds every absence.
