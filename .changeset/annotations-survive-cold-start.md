---
'@1agh/maude': patch
---

Drawings and stickers on the canvas stop disappearing after a cloud restart —
and a freshly dropped image now actually arrives on your other machines.

Annotations had no timestamp of their own, so when a machine reconnected, they
followed whichever side won the CANVAS BODY comparison. An annotation edit
doesn't touch the body, so a cloud that restarted with a stale, empty
annotation record — and a newer body — silently replaced your strokes with
that emptiness on every reconnect. The emptiness even looked non-empty to the
guards (it's a 72-byte SVG shell with zero strokes in it), so nothing stopped
it. And because the strokes carried the image references that tell a machine
which pictures to download, a sticker or drag-and-dropped photo lost its
durable record within minutes — the other machine showed a broken-image frame
in the right place, with the right size, forever.

Annotations now carry their own edit time and resolve independently of the
body, with one hard rule: an empty record with no timestamp never overwrites
real strokes — the strokes win and are pushed back up, healing the cloud copy.
A deliberate "delete all annotations" still propagates: it is stamped when it
happens, and a stamped deletion that is provably newer is honored.
