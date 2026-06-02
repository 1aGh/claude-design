---
"@1agh/maude": minor
---

design hub: **TSX canvas sync now defaults ON** for a linked project (DDR-079, supersedes DDR-072). Linking a hub and running `maude design serve` now syncs all your `.tsx` canvas bodies without a hidden per-project opt-in — fixing the recurring "I linked but my teammate sees nothing / 0 syncable" footgun (and `--adopt` now seeds a hub with no extra flag).

`linkedHub.syncTsx` becomes an **opt-OUT**: set `false` to disable project-wide, or a per-canvas `.meta.json "syncable": false` to exclude one canvas. New `maude design link` flags `--no-sync-tsx` / `--sync-tsx` set it without editing config. `maude design status` shows the effective TSX-sync state and prints a migration advisory when the field is unset (so upgraders learn the default flipped). The dev-server still prints a loud boot banner naming the count + opt-outs against non-loopback hubs.

Unchanged: the Lock-2 sandbox coupling (TSX only syncs when the cross-origin sandbox is active — `MAUDE_CANVAS_ORIGIN_SPLIT=0` still disables both), the per-canvas sidecar precedence, solo-mode (no sync), and the per-machine trust gate for new remote hubs.
