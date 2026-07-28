---
name: bug-fix
category: bug
type: command
description: Implement fix from RCA document for a ticket
keywords: [bug, fix, implement, ticket, rca, patch]
argument-hint: "ticket-id"
---

# Implement Fix: Ticket $ARGUMENTS

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Prerequisites

- RCA document exists at `logs/rca/issue-$ARGUMENTS.md` (produced by `/flow:bug-rca`). The `issue-` filename prefix is provider-agnostic — `$ARGUMENTS` may be a GitHub number, a ClickUp ID like `CU-abc123`, or any slug.

## Tracker context

Read `integrations.tracker.provider` from `.ai/workflows.config.json`:

- **`github` or unset** → resolve the repo and use the GitHub CLI for live context:
  ```bash
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
  ```
- **Any other provider** → resolve via the MCP tool named in `integrations.tracker.mcp` (e.g. `mcp__claude_ai_ClickUp_clickup_get_task`). Pass `integrations.tracker.defaults` through untouched. Skip the `REPO=…` shell snippet entirely.
- **`none`** → rely on the RCA document only; the human-provided text is the source of truth.

## RCA Document to Reference

Read RCA: `logs/rca/issue-$ARGUMENTS.md`

**Optional — View ticket via GitHub CLI (when provider is `github`):**

```bash
export GODEBUG=x509negativeserial=1
gh issue view $ARGUMENTS --repo "$REPO"
```

For non-GitHub providers, the live ticket view was fetched in the "Tracker context" step above via MCP.

## Implementation Instructions

### 1. Read and Understand RCA

- Read the ENTIRE RCA document thoroughly
- Understand the root cause
- Review the proposed fix strategy
- Note all files to modify

> **Batch the context load:** the RCA document and the live ticket view (GitHub `gh issue view` or the provider MCP fetch from the Tracker-context step) are independent — **fetch them in parallel in a single assistant message**. Once the RCA names its "files to modify", read that whole set in one parallel batch too, rather than one Read at a time.

### 2. Verify Current State

Before making changes:

- Confirm the issue still exists
- Check current state of affected files
- Review any recent changes to those files

### 3. Implement the Fix

Following the "Proposed Fix" section of the RCA:

**For each file to modify:**

- Read the existing file
- Implement the change as described in RCA
- Maintain code style and conventions
- Add comments if the fix is non-obvious

### 4. Add/Update Tests

Following the "Testing Requirements" from RCA:

1. Verify the fix resolves the issue
2. Test edge cases related to the bug
3. Ensure no regression in related functionality

### 5. Validate

```bash
<pm> lint
<pm> typecheck
<pm> test
<pm> build
```

Fix any failures before proceeding.

## Post-Fix Flow

After all validations pass, ask:

> **Fix validated. Ready to commit?**

If confirmed, commit using a conventional `fix:` subject that references the ticket. The reference format depends on `integrations.tracker.provider`:

- `provider === github` → `fix(auth): handle null session — refs #$ARGUMENTS` (GitHub PR will auto-close via `Closes #$ARGUMENTS`).
- Any other provider → `fix(auth): handle null session — refs <provider>-$ARGUMENTS` (e.g. `refs CU-abc123` for ClickUp). Auto-close happens via the "Tracker sync" step below, not via PR body syntax.

After commit, ask:

> **Committed. Ready to push and create a PR?**

If confirmed, `git push -u origin <branch>` and (when a git host with PR support is configured) create the PR with the RCA summary in the body. For GitHub: `gh pr create`. Include `Closes #$ARGUMENTS` in the body **only when `provider === github`** — for other providers, `Closes #N` is GitHub-specific syntax that won't auto-close your ticket.

### Tracker sync (optional)

If `integrations.tracker.provider !== "none"` and the matching MCP tool is available, ask:

> **Mark ticket `$ARGUMENTS` as fixed in `<provider>` and link the PR?**

If yes → call `<integrations.tracker.mcp>_*_update_task` (or provider equivalent) with `defaults.doneStatus` and a comment containing the PR URL and commit hash. Pass `defaults` through untouched.

If `provider === "github"`, the PR's `Closes #$ARGUMENTS` already takes care of the link — no extra step needed.
