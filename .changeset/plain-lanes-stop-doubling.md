---
"@1agh/maude": patch
---

Fix whole-file duplication in shared-doc sync (issue #114). When several peers seeded the same canvas into one empty document at the same instant, Yjs kept every insert and the lane became the file concatenated with itself — 2×, and up to 5× in the field — so the canvas stopped building (`Multiple exports with the same name "default"`, `"FMT" has already been declared`). The body lane had duplication guards; the `css` lane had none, and was the lane that never came out of a multi-peer cold start clean. The css lane now has its own cold-start table (`decideCssColdStart`) with the same exact-repeat recovery, the same DDR-064 empty-lane guard, and it finally reads the `cssHash` checkpoint the journal has been writing all along; the live seed-duplication repair covers css as well as the body. Related: comment arrays no longer amplify their own duplicates (issue #112) — the cold-start union now dedupes the document against itself, not only against local, which is what turned 2 copies into 4 into 8.

Also fixes relative imports breaking when a canvas is moved between folders: `moveCanvas`/`moveFolder` relocated the file without re-rooting its `../` specifiers, so a canvas dragged one level deeper failed to build with `Could not resolve`.
