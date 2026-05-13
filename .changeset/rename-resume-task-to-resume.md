---
"@1agh/md-claude": minor
---

**flow:** rename `/flow:resume-task` → `/flow:resume`.

Pairs cleanly with `/flow:pause` (no asymmetric `-task` suffix). The command file is now `plugins/flow/commands/resume.md`.

**Breaking change for users with muscle memory** — the old slash name no longer resolves. Update any session notes, scripts, or muscle-memory cheat sheets that referenced `/flow:resume-task`. (Note: `flow:resume-task` was only available in v0.6.0 → v0.6.1; older versions used `/flow:resume-work` which was already phantom.)

Also fixed two pre-existing phantom command references during the sweep:
- `plugins/flow/commands/pause.md` — replaced bare `resume-work` mentions with `/flow:resume`.
- `plugins/flow/commands/setup-prd.md` — replaced `pause-work` / `resume-work` with `/flow:pause` / `/flow:resume`.
