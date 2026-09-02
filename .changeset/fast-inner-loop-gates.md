---
"@1agh/maude": minor
---

New `qualityScoped` config block: scoped (changed-files/changed-packages-only) quality-gate variants that the flow implementation inner loop (`/flow:utils-verify`, per-task `/flow:execute`, `/flow:bug-fix`, `/flow:quick`) runs instead of repo-wide `quality.*` commands. Gates without a scoped variant are deferred to `/flow:validate` — the full pipeline runs once, at the outer gate. The per-task `code-simplifier` pass moved out of `/flow:execute` (it stays in `/flow:done`), and `/flow:execute` now degrades cleanly to ticket-only mode when no plan file exists.
