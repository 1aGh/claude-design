---
name: flow:bug-rca
category: bug
type: command
description: Analyze and document root cause for a ticket
keywords: [bug, root-cause, analysis, investigate, debug, diagnose, ticket]
argument-hint: "ticket-id"
---

# Root Cause Analysis: Ticket $ARGUMENTS

## Objective

Investigate ticket `$ARGUMENTS`, identify the root cause, and document findings for future implementation. The ticket source is whatever provider is configured in `.ai/workflows.config.json` (`integrations.tracker.provider`) — GitHub, ClickUp, Linear, Jira, Notion, Asana, Shortcut, or `none` (manual paste).

## Recommended Context

Load before starting RCA:

- **Agent**: `.claude/agents/root-cause-analysis-log.agent.md` — RCA methodology

## Agent Activation

Read `.claude/agents/root-cause-analysis-log.agent.md` if it exists, and apply its investigation framework to all subsequent steps.

## Investigation Process

### 0. Resolve the ticket source

Read `integrations.tracker.provider` from `.ai/workflows.config.json`:

- **`github` or unset** → continue with step 1 (GitHub CLI flow below).
- **Any other provider** (`clickup`, `linear`, `jira`, `notion`, `asana`, `shortcut`, …) → fetch the ticket via the configured MCP tool. Resolve the tool name from `integrations.tracker.mcp` (e.g. `mcp__claude_ai_ClickUp_clickup_get_task` for ClickUp). Pass through `defaults` (list IDs, custom field names) untouched — the MCP server interprets them. Map the fetched ticket's title, description, comments, and status onto the same investigation slots as the GitHub flow, then jump to step 2.
- **`none`** → ask the user to paste the ticket description manually, then jump to step 2.

The rest of this command treats "ticket" generically — whatever source you resolved.

### 1. Fetch ticket details (GitHub branch)

> Skip this section if the tracker provider is not `github`.

Resolve the repo (`gh` first, fall back to the `origin` remote URL):

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
```

Fetch the ticket and its comments:

```bash
export GODEBUG=x509negativeserial=1
gh issue view $ARGUMENTS --repo "$REPO"
gh issue view $ARGUMENTS --repo "$REPO" --comments
```

### 2. Search Codebase

- Search for components mentioned in the ticket
- Find related functions, classes, or modules
- Check similar implementations
- Look for patterns or recent changes

Use grep/search to find:

- Error messages from the ticket
- Related function names
- Component identifiers

### 3. Review Recent History

Check recent changes to affected areas:

```bash
git log --oneline -20 -- [relevant-paths]
```

### 4. Investigate Root Cause

**Analyze the code to determine:**

- What is the actual bug or issue?
- Why is it happening?
- What was the original intent?
- Is this a logic error, edge case, or missing validation?
- Are there related issues or symptoms?

### 5. Assess Impact

- What users/systems are affected?
- What's the severity?
- Are there workarounds?

### 6. Propose Fix

- What's the recommended fix?
- What files need to change?
- What tests should be added?
- What's the estimated complexity?

## Output

Save to: `.ai/logs/rca/issue-$ARGUMENTS.md` — the `issue-` filename prefix is provider-agnostic; `$ARGUMENTS` may be a GitHub number (`123`), a ClickUp ID (`CU-abc123`), or any other slug your tracker uses.

```markdown
# RCA: Ticket <id> — <title>

## Summary

<one-paragraph summary>

## Root Cause

<what's broken and why>

## Impact

<who/what is affected, severity>

## Proposed Fix

<approach, files to change, tests needed>

## Testing Requirements

<what tests to add/update>

## Complexity

Low / Medium / High
```

After saving the RCA, ask:

> **RCA documented. Ready to implement the fix?** I can run `/flow:bug-fix $ARGUMENTS` to start.
