---
"@1agh/maude": patch
---

Fix comments duplicating themselves on a linked hub, and refusing to be resolved (issue #112). A comment added to a hub-linked project came back 2, 4, then 8 times, and clicking resolve did nothing. The comments lane wrote to its Y.Array wholesale — `delete(0, len)` + `push(next)` — which is not a replace under concurrency: two writers delete the same items but Yjs keeps both inserts, so the array became the list concatenated with itself, `persistJson` wrote that to `_comments/<slug>.json`, and the duplication became the canvas's truth. Every reconciliation round doubled it, and the cold-start union repair, published through the same wholesale write, re-created what it had just undone — the same defect the `css` lane had in issue #114, one lane later.

The lane now applies an identity-keyed minimal diff, so collapsing a duplicated array is a pure delete (concurrent collapses are idempotent and converge), and dedupe happens on every apply rather than only at cold start — a project already corrupted in the field heals on the next read or write instead of compounding. The room seed no longer concatenates into a document that already holds the hub's copy, and `commentsPatch` / `commentsDelete` act on every entry carrying the id instead of the first one, which is why resolve appeared to do nothing while the overlay kept drawing the other seven pins.
