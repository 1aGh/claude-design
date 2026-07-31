---
"@1agh/maude": minor
---

**A hosted Maude project now runs as its own isolated cell.** Each project gets its own container, its own hostname, its own operator credential, and its own slice of storage — nothing is shared between projects but the platform itself. A cell wakes on demand, sleeps when idle, and checkpoints itself to object storage.

The durability question is settled: a cell was killed outright with its disks deleted, and a fresh one came back with the documents, the users, the git history and the work intact. The checkout and the documents are always saved together, so a restore can never produce a project whose files and canvases disagree.

`/health` on a hosted project now reports what its workspace actually did at boot — whether it has a checkout, whether storage and a starting project are configured, and how many canvases it holds — because a hosted cell has no console to read.
