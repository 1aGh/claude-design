---
"@1agh/maude": minor
---

design hub: linked-mode cold-start no longer empties a non-empty local canvas when the hub has no state for it yet (fresh / never-seeded hub) — the per-canvas sync agent now seeds local UP to the hub instead of writing an empty body over disk. This was silent local data loss: the HTML body was the one `reconcile()` branch missing the empty-doc guard that comments/annotations/meta/css already had, so a first connect to an empty hub truncated every local canvas to 0 bytes.

Admin UI: the invite form can now mint a **hub-wide** (`scope: '*'`) token — required for canvas sync, where peers authorize per-canvas slugs that a label-scoped token never matches — via a "Hub-wide" checkbox (on by default), and the issued-token modal shows the real scope. The connected-peers and active-tokens cards now scroll inside a fixed-height box (sticky header) instead of growing the page unbounded as peers/tokens accumulate.
