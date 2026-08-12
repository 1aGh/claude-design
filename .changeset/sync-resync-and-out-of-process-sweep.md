---
'@1agh/maude': patch
---

A Resync button in the Sync panel — and an upload that can no longer take Maude
down with it.

Until now the only way to re-check your work against the cloud was to quit and
reopen Maude, and on a big project that upload could crash the app mid-way,
leaving the panel stuck at "92 of 182" forever. Resync now re-checks everything
in one press — every canvas and every file — and the upload runs on its own, so
if it fails it fails alone: Maude keeps working and the panel tells you what
happened instead of going quiet. You can also stop an upload part-way; nothing
is left half-sent.
