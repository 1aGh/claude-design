---
"@1agh/maude": patch
---

Fix design-system scaffold files never appearing in the file tree — even after a manual reload. The dev-server read `.design/config.json` only once at boot, so when `/design:setup-ds` added the `system` canvas group mid-session, `/_index-data` kept serving the stale boot snapshot. The server now hot-reloads the config when it changes on disk, refreshes the tree over the live `canvas-list-update` push, and tells open shells to refetch `/_config`.
