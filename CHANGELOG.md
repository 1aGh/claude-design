# @1agh/md-claude

## 0.7.0

### Minor Changes

- 89bf4e6: **flow:** rename `/flow:resume-task` → `/flow:resume`.

  Pairs cleanly with `/flow:pause` (no asymmetric `-task` suffix). The command file is now `plugins/flow/commands/resume.md`.

  **Breaking change for users with muscle memory** — the old slash name no longer resolves. Update any session notes, scripts, or muscle-memory cheat sheets that referenced `/flow:resume-task`. (Note: `flow:resume-task` was only available in v0.6.0 → v0.6.1; older versions used `/flow:resume-work` which was already phantom.)

  Also fixed two pre-existing phantom command references during the sweep:

  - `plugins/flow/commands/pause.md` — replaced bare `resume-work` mentions with `/flow:resume`.
  - `plugins/flow/commands/setup-prd.md` — replaced `pause-work` / `resume-work` with `/flow:pause` / `/flow:resume`.

## 0.6.1

### Patch Changes

- Remove the 11 Phase 13 backwards-compat stubs ahead of schedule.

  The stubs (`verify.md`, `onboard.md`, `create-prd.md`, `map-codebase.md`, `context.md`, `ddr.md`, `retro.md`, `execution-report.md`, `ai-health.md`, `discover.md`, `code-review.md`) shipped in v0.6.0 as a one-minor-version grace window for users typing the pre-rename slash names. The original plan was to remove them in v0.7.0.

  After ~one day on npm with no observed traffic to the old slash names, the stubs were removed early. Anyone still typing `/flow:ddr`, `/flow:onboard`, `/flow:verify`, etc. in v0.6.1+ will see a "command not found" instead of a redirect message; the new names are in `plugins/flow/CATEGORIES.md` (rename history table), DDR-004, and `/flow:help`.

  Decision is recorded in `.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md` under "Compat-stub removal target (actual: v0.6.1)".

## 0.6.0

### Minor Changes

- 09bcb3b: Adopt pnpm workspaces and Changesets for the release flow. Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub PR + issue templates, Dependabot config, quality CI workflow, CODEOWNERS, and Dependabot auto-merge. No runtime change for `mdcc` or the plugins themselves.
- 9f9a8d8: Flow plugin command categorization — every non-daily `/flow:*` command now uses a `<group>-<verb>` prefix so autocomplete narrows by group.

  **Renamed commands** (old names ship as redirect stubs through v0.6.x; removed in v0.7.0):

  - `/flow:verify` → `/flow:utils-verify`
  - `/flow:onboard` → `/flow:setup-onboard`
  - `/flow:create-prd` → `/flow:setup-prd`
  - `/flow:map-codebase` → `/flow:setup-codebase-map`
  - `/flow:context` → `/flow:setup-context`
  - `/flow:ddr` → `/flow:record-ddr`
  - `/flow:retro` → `/flow:record-retro`
  - `/flow:execution-report` → `/flow:record-execution`
  - `/flow:ai-health` → `/flow:maintain-ai-health`
  - `/flow:discover` → `/flow:maintain-discover`
  - `/flow:code-review` → `/flow:review-code`

  **New:** `/flow:help` — auto-generated grouped command index that reads each command's `category:` frontmatter. `plugins/flow/CATEGORIES.md` is the canonical catalog of the 9 groups (`daily`, `utils`, `setup`, `validate`, `bug`, `record`, `maintain`, `review`, `release`). Rationale + research lives in DDR-004.

  Subdirectory namespacing for slash commands (`commands/bug/fix.md` → `/flow:bug:fix`) is **not supported by Claude Code** ([issue #2422](https://github.com/anthropics/claude-code/issues/2422), [open feature request #44678](https://github.com/anthropics/claude-code/issues/44678)). The strict `<group>-` prefix is the working substitute — typing `/flow:bug-` autocompletes only the bug-\* members.

- 453e66e: Add `integrations.changelog` to flow's config schema and ship two new commands:

  - `/flow:release-changelog` — provider-dispatched authoring (Changesets implemented end-to-end; `git-cliff`, `conventional`, and `custom` enum values stub to "not yet implemented" until their own follow-ups land).
  - `/flow:release` — walks a project-owned Markdown runbook at `integrations.changelog.releaseGuide` (default `.ai/release-guide.md`) step-by-step, never auto-runs, prompts `[run] / [skip] / [edit] / [abort]` per fenced bash block. Provider-agnostic by design — see DDR-003.

  Also: `/flow:validate` gains a non-blocking changelog-hygiene warning; `/flow:done` gains an overridable reminder; `/flow:onboard` auto-detects the provider from filesystem markers (`.changeset/config.json`, `cliff.toml`) and scaffolds the runbook; `mdcc init --provider <name>` propagates the choice into both the config file and the runbook stub. `/flow:execute` and `/flow:quick` no longer hardcode "changeset" — both reference `integrations.changelog.provider`.
