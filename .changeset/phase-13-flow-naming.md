---
"@1agh/md-claude": minor
---

Flow plugin command categorization — every non-daily `/flow:*` command now uses a `<group>-<verb>` prefix so autocomplete narrows by group.

**Renamed commands** (old names ship as redirect stubs until v0.6.0):

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

Subdirectory namespacing for slash commands (`commands/bug/fix.md` → `/flow:bug:fix`) is **not supported by Claude Code** ([issue #2422](https://github.com/anthropics/claude-code/issues/2422), [open feature request #44678](https://github.com/anthropics/claude-code/issues/44678)). The strict `<group>-` prefix is the working substitute — typing `/flow:bug-` autocompletes only the bug-* members.
