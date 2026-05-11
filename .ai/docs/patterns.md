---
name: patterns
type: reference
description: Reusable robustness patterns for AI workflow commands
keywords: [patterns, robustness, retry, error-recovery, edit-verify, rollback, graceful-degradation]
---

# Workflow Robustness Patterns

> **Purpose:** Composable error-recovery patterns that any `.claude/commands/*.md` workflow can adopt.
> Each pattern includes a description, when to use it, a Markdown implementation template, and before/after examples.

---

## Pattern 1: Edit-Verify Loop

### Description

After making a change, run validation. If validation fails, analyze the error, attempt a fix, and re-validate. Cap iterations to prevent infinite loops.

### When to Use

- After implementing code changes (build, lint, typecheck)
- After modifying configuration files
- After scaffolding new files from templates

### Template

```markdown
#### Edit-Verify Loop (max 3 iterations)

After completing the change:

1. **Verify:** Run the relevant validation command(s)
2. **If pass:** Continue to the next step
3. **If fail:**
   a. Read the error output carefully
   b. Identify the root cause (not just the symptom)
   c. Apply a targeted fix
   d. Increment the iteration counter
   e. Go back to step 1
4. **If 3 iterations exhausted without success:**
   - Stop attempting fixes
   - Report: what failed, what was tried in each iteration, and the final error output
   - Recommend manual intervention with specific guidance
   - Do NOT continue to the next workflow step
```

### Before / After

**Before (no recovery):**

```markdown
### 3. Build

Run `<pm> build`. If it fails, fix and re-run.
```

**After (structured loop):**

```markdown
### 3. Build (Edit-Verify Loop — max 3 iterations)

1. Run `<pm> build`
2. If it passes, continue to Step 4
3. If it fails:
   - Read the error output
   - Identify and fix the root cause
   - Re-run `<pm> build`
   - Repeat up to 3 times total
4. If build still fails after 3 attempts:
   - Report all 3 errors and fixes attempted
   - Do NOT proceed — recommend manual investigation
```

---

## Pattern 2: Retry with Backoff

### Description

For transient failures (network timeouts, API rate limits, temporary service outages), retry the operation up to 3 times with increasing delays between attempts.

### When to Use

- `gh` CLI calls (GitHub API — rate limits, network issues)
- `curl` requests to external services
- Package publish or registry operations
- Any network-dependent operation

### Template

```markdown
#### Retry with Backoff (max 3 attempts)

Run the command. If it fails with a transient error (network timeout, HTTP 429/5xx, connection refused):

1. **Attempt 1:** Run the command
2. **If transient failure:** Wait 5 seconds, then retry
3. **Attempt 2:** Run the command again
4. **If transient failure:** Wait 15 seconds, then retry
5. **Attempt 3:** Run the command a final time
6. **If still failing:**
   - Report the error and all 3 attempts
   - Check if there is a manual fallback (e.g., print a URL for manual action)
   - Do NOT silently skip the step

**Transient error indicators:**

- Exit code 1 with "timeout", "connection refused", "rate limit", or "503" in stderr
- HTTP status codes: 408, 429, 500, 502, 503, 504

**Non-transient errors (do NOT retry):**

- Authentication failures (401, 403)
- Not found (404)
- Validation errors (422)
- Permission denied
```

### Before / After

**Before (no retry):**

```markdown
gh pr create --repo $REPO --title "feat: ..." --body-file /tmp/ai-workflow-pr.md
```

**After (with retry):**

```markdown
Run `gh pr create`. If it fails:

- **Transient error** (network timeout, 5xx): wait 5s and retry (max 3 attempts with 5s/15s/30s backoff)
- **"PR already exists"**: this is not an error — switch to update mode (Step 3b)
- **Auth failure** (401/403): stop and report — likely a PAT/SAML issue
- **Other error**: report the error and print the manual PR creation URL as fallback:
  `https://github.com/$REPO/pull/new/<branch>`
```

---

## Pattern 3: Graceful Degradation

### Description

When a non-critical tool or service is unavailable, log a warning and continue the workflow rather than blocking. Critical failures still halt the workflow.

### When to Use

- Optional quality checks (a11y, visual snapshots, SonarQube)
- External integrations (Jira comments, review requests)
- Telemetry or analytics reporting
- Screenshot capture

### Template

```markdown
#### Graceful Degradation

Run the optional step. If it fails or the tool is unavailable:

1. **Log a warning:** `[WARN] <step-name> skipped: <reason>`
2. **Record in output report:** Mark the step as "skipped" (not "failed") with the reason
3. **Continue** to the next step — do NOT halt the workflow

**Critical vs. Non-Critical classification:**

- **Critical (MUST succeed):** lint, typecheck, tests, build, git operations
- **Non-critical (degrade gracefully):** a11y audit, visual snapshots, Jira comments, review request, screenshot capture, SonarQube
```

### Before / After

**Before (blocks on failure):**

```markdown
### Step 5: Request Automated Code Review

Request an AI-assisted code review via API.
```

**After (graceful):**

```markdown
### Step 5: Request Automated Code Review (Graceful Degradation)

Request AI-assisted review via API. If the request fails (service not enabled, network error, API change):

- Log: `[WARN] Automated review request skipped: <error>`
- Continue to Post-Push — do NOT block the workflow
- The PR is still valid without automated review
```

---

## Pattern 4: Checkpoint & Resume

### Description

For long workflows, save progress markers after each major step so the agent can resume from the last successful checkpoint after an interruption (context window limit, user disconnect, crash).

### When to Use

- `execute.md` with many tasks (5+ implementation steps)
- `day.md` multi-step morning workflow
- `design-sync.md` multi-phase synchronization
- Any workflow that takes > 10 minutes

### Template

````markdown
#### Checkpoint & Resume

After completing each major step, record progress:

1. **Save checkpoint:** Note the completed step number and key outputs in the plan file or a progress log
2. **On resumption:** Check for existing progress:
   - "Last completed step: N. Resuming from step N+1."
   - Verify the checkpoint state is still valid (e.g., branch still exists, files not changed externally)
3. **On conflict:** If the checkpoint state is stale, restart from the beginning of the affected step

**Checkpoint format** (append to the plan file or output):

```text
## Progress
- [x] Step 1: <description> — completed <timestamp>
- [x] Step 2: <description> — completed <timestamp>
- [ ] Step 3: <description> — in progress
```
````

---

## Pattern 5: Rollback

### Description

When a multi-step operation partially fails and the intermediate state is inconsistent, undo completed steps to restore a clean state before reporting failure.

### When to Use

- Multi-file code changes where partial application breaks the build
- Git operations (rebase partially applied, merge conflict mid-way)
- Package publish operations (published A but failed on B in a multi-package release)
- Registry updates that require multiple files to be consistent

### Template

```markdown
#### Rollback on Partial Failure

Before starting a multi-step operation:

1. **Record the clean state:** `git stash` or note the current commit hash
2. **Execute steps sequentially**, tracking which completed successfully
3. **If a step fails and the state is inconsistent:**
   a. Attempt to fix within the edit-verify loop (Pattern 1)
   b. If the fix fails, rollback to the clean state:
   - Git changes: `git checkout -- .` or `git stash pop`
   - File system: delete created files, restore modified files
   - Package registry: note which packages were published (manual rollback)
     c. Report what was rolled back and why
4. **After rollback:** The workspace should be in the same state as before the operation started
```

### Before / After

**Before (partial state left behind):**

```markdown
### Rebase and Push

git rebase origin/main
git push --force-with-lease

# If push fails after rebase... branch is in rebased state with no way back
```

**After (with rollback):**

```markdown
### Rebase and Push (with Rollback)

1. Record pre-rebase state: `PRE_REBASE=$(git rev-parse HEAD)`
2. `git rebase origin/main`
3. If rebase succeeds: `git push --force-with-lease`
4. If push fails (network, rejected):
   - Retry with backoff (Pattern 2)
   - If still failing: the rebased commits are safe locally — report the error and the manual push command
5. If rebase fails (conflicts):
   - `git rebase --abort` to restore pre-rebase state
   - Report conflicting files and ask for manual resolution
```

---

## Composing Patterns

Patterns are designed to compose. Common combinations:

| Scenario                 | Patterns                                  |
| ------------------------ | ----------------------------------------- |
| Code implementation step | Edit-Verify Loop + Checkpoint             |
| External API call        | Retry with Backoff + Graceful Degradation |
| Multi-file refactor      | Rollback + Edit-Verify Loop               |
| Long build pipeline      | Checkpoint + Edit-Verify Loop             |
| Optional integration     | Graceful Degradation (standalone)         |

### Example: Composed Pattern in a Command

```markdown
### Step 3: Build and Publish (Composed)

1. **Checkpoint:** Record current step in progress log
2. **Build** (Edit-Verify Loop — max 3 iterations):
   - Run `<pm> build`
   - If fails: analyze, fix, re-run (up to 3x)
   - If exhausted: rollback any partial changes, report failure
3. **Publish** (Retry with Backoff + Graceful Degradation):
   - Run `<pm> publish`
   - If transient failure: retry 3x with backoff
   - If auth failure: halt and report
   - If optional post-publish hook fails: warn and continue
4. **Checkpoint:** Mark step as complete
```

---

## Quick Reference

| Pattern              | Purpose                            | Max Attempts            | On Exhaustion                         |
| -------------------- | ---------------------------------- | ----------------------- | ------------------------------------- |
| Edit-Verify Loop     | Fix code/config errors iteratively | 3 iterations            | Stop + report + recommend manual fix  |
| Retry with Backoff   | Handle transient external failures | 3 attempts (5s/15s/30s) | Stop + report + offer manual fallback |
| Graceful Degradation | Skip non-critical failures         | 1 attempt               | Warn + continue                       |
| Checkpoint & Resume  | Survive interruptions              | N/A                     | Resume from last checkpoint           |
| Rollback             | Recover from partial failures      | 1 rollback              | Restore clean state + report          |

---

## Pattern 6: Agentic PR Stacking

### Description

AI agents produce large diffs in flow state. Reviews take a day+, so waiting between PRs is not feasible. This pattern keeps you unblocked while producing reviewable, incremental PRs.

### When to Use

- Multi-phase features where each phase builds on the last
- Any agentic session that produces more than ~300 lines of diff
- When reviewers can't turn around same-day

### Approach (in order of preference)

1. **Plan PR boundaries before starting** — use `/ai/plan-feature` to define branch-per-phase, enforce hard stops at phase boundaries.
2. **Checkpoint branch pattern** — after each logical milestone, create a branch + push, then `git checkout -b feat/thing-phase-N` from it. Produces a natural stack without rewriting.
3. **Stacked PRs** — target each PR at the previous feature branch (not `main`). Retarget to `main` after the base merges. Tools like graphite.dev or git-town automate this.
4. **Sandbox delivery** — clone repo to temp dir, work in isolation, fetch branch back. Keeps the main worktree clean during agent iteration. See `.claude/commands/sandbox.md` if adopted.
5. **Post-hoc split with `git rebase -i`** — last resort. Works but is tedious with AI-generated multi-file commits.

### Key Constraint

Don't block on review. Stack PRs and keep working — just be clear about dependencies in PR descriptions (e.g., "Stacked on: #N").
