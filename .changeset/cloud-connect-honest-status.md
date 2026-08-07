---
'@1agh/maude': patch
---

Connecting a cloud project now tells you what is actually happening, and whether it worked.

**The sentence you get after Connect is live, and it is true.** It used to be written once, at the instant the confirm dialog closed, from a value that only meant "the sync runtime started without throwing" — not that a socket had opened, a token had been accepted, or a single byte had moved. It then sat there unchanged through every outcome, including a link that never connected at all. It now moves: *Connecting to alligators… → Syncing with alligators — 40 of 75 → Synced with alligators — all 75. 3 came down from the project on this connect.*

**Every state says what to do next.** A hub that refused your canvases says so and tells you to reconnect, because a rotated credential never fixes itself. A hub that is unreachable says your edits are queued and safe, and that nothing needs doing. A project with nothing syncable tells you to make a canvas.

**The status bar and the connect note can no longer disagree.** They now read the same rule. Previously the status bar keyed off hub *reachability* alone and never looked at the per-canvas counts — so a link where the hub had refused every single canvas still showed a green dot and the word "synced". Meanwhile the note's own hover text told you to go and check that status bar for the real answer.

Three underlying fixes make that possible: the connection monitor no longer starts life claiming to be online; the "synced" count can now fall when the hub goes away, instead of freezing at whatever it last reached; and the list of canvases pulled down from the project now names the ones that actually arrived, rather than the ones it was about to fetch.
