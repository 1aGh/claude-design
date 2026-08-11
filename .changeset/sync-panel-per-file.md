---
'@1agh/maude': minor
---

New Sync panel: watch your project sync, file by file.

- **Per-file sync state.** The status-bar **hub sync** chip is now a button —
  click it to open a Sync panel listing every canvas with its live state
  (*syncing*, *synced*, or *refused* with the reason), grouped by canvas
  group, with anything that needs attention pinned on top. "Is my work
  actually up there?" finally has a per-file answer instead of one aggregate
  number.

- **Asset upload progress.** The desktop's asset push to the cloud (images,
  fonts, videos) now reports live progress into the same panel — how many are
  pushed, already there, or failed (with the failing paths listed). Failed
  uploads retry on the next launch.

- Under the hood this is pure surfacing: the sync payload gains a bounded
  per-document list and an asset-progress lane (additive — older readers are
  unaffected), the panel speaks the same vocabulary as the chip and the cloud
  rail, and everything hub-supplied renders bounded and text-only.
