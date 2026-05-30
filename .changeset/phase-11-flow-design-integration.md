---
"@1agh/maude": minor
---

Phase 11 — flow ⇄ design integration. Flow commands are now aware of the design plugin's `.design/` canvas workspace:

- `/flow:plan <feature>` detects canvases matching the feature by tag or slug and grounds the plan in them (new **Design canvases** context section).
- `/flow:done` surfaces canvases marked `ready-for-handoff` and offers a soft handoff sweep before close (`/design:handoff` per canvas, then a follow-up commit stamping `status: handed-off` + `handoffCommit`). Soft-prompt rationale recorded in DDR-066.
- `codebase-intelligence` / `/flow:setup-codebase-map` snapshots now include a **Design artifacts** section (design systems + per-canvas status).
- `ddr-keeper` / `/flow:record-ddr` prompt for a `Related canvas` reference on UI-affecting decisions.
- New `paths.designRoot` config key (default `.design`); canvas `.meta.json` schema formalizes a `status` enum, `handoffCommit`, and `tags`. All integrations skip silently on projects without a design root (no regression).
