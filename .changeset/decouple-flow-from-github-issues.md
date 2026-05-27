---
"@1agh/maude": patch
---

Flow plugin — decouple from GitHub issues.

The `/flow:bug-rca`, `/flow:bug-fix`, `/flow:status`, `/flow:plan`, `/flow:execute`, `/flow:record-execution` commands and the `debugging-rules` skill are now provider-aware. They honor `integrations.tracker.provider` from `.ai/workflows.config.json` end-to-end — frontmatter, headers, prompts, and example output all speak in terms of "ticket" instead of "GitHub Issue". The GitHub CLI flow (`gh issue view`, `Closes #N`, `REPO=$(gh repo view …)`) is preserved behind explicit `provider === github` guards, so existing GitHub-tracker setups behave identically. ClickUp, Linear, Jira, Notion, Asana, and Shortcut users now have a clean path: set `integrations.tracker.provider` + `integrations.tracker.mcp` and the same flow commands resolve tickets through the MCP server. Schema (`plugins/flow/.claude-plugin/config.schema.json`) and `ai-skeleton` template were already wired for this — only the command/skill text was missing.
