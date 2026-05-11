---
name: bug/fix
type: command
description: Implement fix from RCA document for GitHub issue
keywords: [bug, fix, implement, github-issue, rca, patch]
argument-hint: "github-issue-id"
---

# Implement Fix: GitHub Issue #$ARGUMENTS

## Repository Auto-Detection

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
```

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Prerequisites

- RCA document exists at `logs/rca/issue-$ARGUMENTS.md`

## RCA Document to Reference

Read RCA: `logs/rca/issue-$ARGUMENTS.md`

**Optional — View GitHub issue for context:**

```bash
export GODEBUG=x509negativeserial=1
gh issue view $ARGUMENTS --repo "$REPO"
```

## Implementation Instructions

### 1. Read and Understand RCA

- Read the ENTIRE RCA document thoroughly
- Understand the root cause
- Review the proposed fix strategy
- Note all files to modify

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

If confirmed, follow `.claude/commands/commit.md` steps.

After commit, ask:

> **Committed. Ready to push and create a PR?**

If confirmed, follow `.claude/commands/push.md` steps.
