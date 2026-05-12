# Integrations — tracker, analytics, CI, design

The `flow` plugin doesn't ship hard-coded provider logic. Instead, `.ai/workflows.config.json` → `integrations.*` carries lightweight pointers, and individual commands decide whether to offer integration actions at runtime.

This document explains the three-layer pattern: **schema → config → DDR**.

## The three layers

### 1. Schema (`plugins/flow/.claude-plugin/config.schema.json`)

Defines the **shape** of every integration:

```json
{
  "provider": "string (enum where it makes sense)",
  "mcp":      "string — MCP tool name prefix",
  "defaults": "free-form object — provider-specific knobs"
}
```

The schema validates the shape only. It does **not** know about ClickUp's list IDs, Linear's project keys, or Jira's custom field schemas — that would couple the plugin to one provider per shape.

### 2. Config (`<repo>/.ai/workflows.config.json`)

Holds the **values** for one repo. Free-form `defaults` is the escape hatch — drop in whatever your tracker requires:

```json
{
  "integrations": {
    "tracker": {
      "provider": "clickup",
      "mcp": "mcp__claude_ai_ClickUp",
      "defaults": {
        "boardListId": "901519382993",
        "openStatuses": ["active", "unstarted"],
        "activeStatus": "in progress",
        "doneStatus": "done",
        "milestoneListId": "901519382993",
        "customFields": {
          "sprintId": "abc123",
          "platformLabel": "def456"
        }
      }
    }
  }
}
```

Generic commands (`/flow:done`, `/flow:bug-rca`, `/flow:bug-fix`) pass `defaults` through to the MCP server untouched. The MCP server understands the provider's shape; the plugin doesn't.

### 3. DDR (`<repo>/.ai/decisions/DDR-NNN-*.md`)

Anything **non-obvious** about your tracker convention belongs in a DDR. Examples:

- *Why* the `Board` list `901519382993` is the source of truth and not the `Sprint` list.
- The custom-field ↔ semantic mapping (`Custom field "Platform" → ios|android|web|api`).
- The status flow contract (`unstarted → active → in progress → in review → done`, plus when "blocked" is used).
- The milestone hierarchy rule (top-level tasks without `parent` = milestones; everything else is a child task).
- Naming conventions for branches that auto-link tickets (e.g. `feat/ABC-123-summary`).

The config holds the **what**; the DDR holds the **why**. New team members read both.

## When to update which layer

| Change | Layer |
| ------ | ----- |
| Switch from ClickUp to Linear | All three — `provider`, `mcp`, `defaults`, plus a new DDR documenting the migration |
| Add a new custom-field mapping | Config `defaults` only |
| Add a new status to the flow | Config + DDR (the DDR records the contract) |
| Change which list is "source of truth" | Config + DDR (this is the kind of decision that needs context for future you) |
| Add a brand-new provider type (e.g. `tracker.priority` becomes a thing) | Schema PR + config update + DDR |

## Commands that read integrations.tracker

Currently:

- `/flow:done` — at step 6b, offers to update the ticket status and link the PR.
- `/flow:bug-rca` — at step 0, fetches issue context from the configured provider (GitHub via `gh`, others via MCP).
- `/flow:bug-fix` — reads tracker context; at post-commit, offers to mark the ticket fixed.

These commands all degrade to no-op when `provider === "none"` or no matching MCP tool is available. The flow loop never depends on a tracker existing.

## Commands that could read other integration slots later

- `analytics` — `/flow:done` could prompt to add a tracking event for a new feature flag; `/flow:validate` could pull recent error rate.
- `ci` — `/flow:validate` could query build status for the branch before declaring done.
- `design` — `/flow:plan` could read a Figma file ID and link the relevant frames.

These are intentionally not wired yet. Wire them when a real use case forces the shape, not before.

## When integrations are NOT enough

Some workflows aren't just integrations — they're **domain workflows** that span multiple commands and their own state model:

- AB testing pipeline (detect → audit → propose → ship → report)
- Daily standup ritual
- Release management
- Incident response

These belong in **separate plugins** in the marketplace (e.g. `ab-testing@md-claude`), not in flow's config. They have their own commands, their own subagents, their own config schemas. Spin one up only when you've felt the pain in 2+ projects.

## Provider hints

These are not endorsements — just the MCP tool prefixes that work as of writing.

| Provider | `mcp` prefix |
| -------- | ------------ |
| ClickUp  | `mcp__claude_ai_ClickUp` |
| GitHub Issues | (use `gh` CLI; no MCP needed) |
| Linear   | `mcp__claude_ai_Linear` |
| Jira     | `mcp__claude_ai_Jira` |
| Notion   | `mcp__claude_ai_Notion` |
| Asana    | `mcp__claude_ai_Asana` |

Verify the exact tool name in your Claude Code session — MCP tool names can drift across MCP server versions.
