---
"@1agh/md-claude": minor
---

Add `integrations.changelog` to flow's config schema and ship two new commands:

- `/flow:release-changelog` — provider-dispatched authoring (Changesets implemented end-to-end; `git-cliff`, `conventional`, and `custom` enum values stub to "not yet implemented" until their own follow-ups land).
- `/flow:release` — walks a project-owned Markdown runbook at `integrations.changelog.releaseGuide` (default `.ai/release-guide.md`) step-by-step, never auto-runs, prompts `[run] / [skip] / [edit] / [abort]` per fenced bash block. Provider-agnostic by design — see DDR-003.

Also: `/flow:validate` gains a non-blocking changelog-hygiene warning; `/flow:done` gains an overridable reminder; `/flow:onboard` auto-detects the provider from filesystem markers (`.changeset/config.json`, `cliff.toml`) and scaffolds the runbook; `mdcc init --provider <name>` propagates the choice into both the config file and the runbook stub. `/flow:execute` and `/flow:quick` no longer hardcode "changeset" — both reference `integrations.changelog.provider`.
