---
name: flow:bug-rca
category: bug
type: command
description: Analyze and document root cause for a GitHub issue
keywords: [bug, root-cause, analysis, investigate, debug, diagnose]
argument-hint: "github-issue-id"
---

# Root Cause Analysis: GitHub Issue #$ARGUMENTS

## Repository Auto-Detection

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
```

## Objective

Investigate GitHub issue #$ARGUMENTS, identify the root cause, and document findings for future implementation.

## Recommended Context

Load before starting RCA:

- **Agent**: `.claude/agents/root-cause-analysis-log.agent.md` — RCA methodology

## Agent Activation

Read `.claude/agents/root-cause-analysis-log.agent.md` if it exists, and apply its investigation framework to all subsequent steps.

## Investigation Process

### 0. Resolve the ticket source

Read `integrations.tracker.provider` from `.ai/workflows.config.json`:

- **`github` or unset** → continue with step 1 (GitHub CLI flow below).
- **Any other provider** (`clickup`, `linear`, `jira`, `notion`, …) → fetch the ticket via the configured MCP tool. Resolve the tool name from `integrations.tracker.mcp` (e.g. `mcp__claude_ai_ClickUp_clickup_get_task` for ClickUp). Pass through `defaults` (list IDs, custom field names) untouched — the MCP server interprets them. Map the fetched ticket's title, description, comments, and status onto the same investigation slots as the GitHub flow.
- **`none`** → ask the user to paste the issue description manually.

The rest of this command treats "issue" generically — whatever source you resolved.

### 1. Fetch GitHub Issue Details

> Skip this section if the tracker provider is not `github`.

```bash
export GODEBUG=x509negativeserial=1
gh issue view $ARGUMENTS --repo "$REPO"
```

Fetch comments:

```bash
gh issue view $ARGUMENTS --repo "$REPO" --comments
```

### 2. Search Codebase

- Search for components mentioned in issue
- Find related functions, classes, or modules
- Check similar implementations
- Look for patterns or recent changes

Use grep/search to find:

- Error messages from issue
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

Save to: `.ai/logs/rca/issue-$ARGUMENTS.md`

```markdown
# RCA: Issue #<number> — <title>

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

> **RCA documented. Ready to implement the fix?** I can run `bug/fix $ARGUMENTS` to start.
