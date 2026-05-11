---
name: status
type: command
description: Unified situational awareness — show exactly where you are and what to do next
keywords: [status, where, state, awareness, branch, progress]
---

# Status: Where Am I?

> **PURPOSE:** Single-command snapshot of your entire working state. Run this
> at the start of any session, after switching context, or whenever you lose
> track of where things stand. This is READ-ONLY — it never modifies files,
> branches, or remote state.

## Repository Auto-Detection

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
```

## Step 1: Git State

### 1a. Branch and working tree

```bash
echo "=== Branch ==="
git branch --show-current

echo "=== Ahead/Behind ==="
git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "No upstream tracking"

echo "=== Uncommitted Changes ==="
git status --porcelain

echo "=== Stash Entries ==="
git stash list --format="%gd: %gs" | head -5

echo "=== Recent Commits (this branch) ==="
git log origin/main..HEAD --oneline 2>/dev/null | head -10
```

### 1b. Summarize

- **Branch:** `<name>`
- **Commits ahead of main:** N
- **Uncommitted changes:** N files (list if ≤ 5, count if more)
- **Stash entries:** N

---

## Step 2: Active Story Detection

Extract the issue number from the branch name. Convention: `<name>/<number>-<slug>`.

```bash
BRANCH=$(git branch --show-current)
ISSUE_NUM=$(echo "$BRANCH" | grep -oE '/[0-9]+' | head -1 | tr -d '/')
echo "Detected issue: $ISSUE_NUM"
```

If an issue number is found:

```bash
export GODEBUG=x509negativeserial=1
gh issue view "$ISSUE_NUM" --repo "$REPO" --json number,title,state,labels,assignees --jq '{number, title, state, labels: [.labels[].name], assignees: [.assignees[].login]}'
```

If no issue number detected from branch name:

- Note: "No linked issue detected from branch name."
- Skip to Step 3.

### Display

- **Story:** #NNN — Title
- **State:** Open/Closed
- **Labels:** `label1`, `label2`

---

## Step 3: Plan Progress

Search for a matching plan file. Try multiple strategies:

```bash
# Strategy 1: Match by issue number
find . -path '*/plans/*.md' -not -path './node_modules/*' -exec grep -l "#$ISSUE_NUM" {} \; 2>/dev/null

# Strategy 2: List all plans (user can identify)
find . -path '*/plans/*.md' -not -path './node_modules/*' 2>/dev/null | head -10
```

If a matching plan is found:

1. Read the plan file
2. Parse the `## Tasks` section
3. Count tasks with `[x]` (completed) vs `[ ]` (pending)
4. Identify the **next incomplete task** (first `[ ]` checkbox)

### Display

- **Plan:** `plans/<name>.md`
- **Progress:** X/Y tasks complete (N%)
- **Next task:** Task N — `<task title>`
- **Blocked:** (any noted blockers from the plan)

If no plan found:

- **Plan:** None found

---

## Step 4: PR Status

```bash
export GODEBUG=x509negativeserial=1
gh pr list \
  --head "$(git branch --show-current)" \
  --repo "$REPO" \
  --state open \
  --json number,title,url,reviewDecision,statusCheckRollup,reviews,comments \
  --limit 1
```

If a PR exists:

1. **Review decision:** APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / PENDING
2. **CI status:** Parse `statusCheckRollup` — count passing/failing/pending checks
3. **Unaddressed comments:** Count review comments that haven't been replied to
   (compare comment count vs reply count in threads)
4. **Review requests:** Any pending reviewers?

### Display

- **PR:** #NNN — Title → URL
- **Review:** APPROVED ✅ / CHANGES_REQUESTED 🔴 / PENDING ⏳
- **CI:** N/M checks passing (list failures if any)
- **Comments:** N unaddressed review comments
- **Reviewers:** @reviewer1 (approved), @reviewer2 (pending)

If no PR:

- **PR:** None open for this branch

---

## Step 5: Quick Health Check (scoped to changed files)

Only check files that have been modified relative to main. This keeps it fast.

```bash
CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null | grep -E '\.(ts|tsx|js|jsx|mjs|css)$' | head -30)
```

If there are changed files:

### Package Manager Auto-Detection

Detect the project's package manager before running any commands:

```bash
if [[ -f "pnpm-lock.yaml" ]]; then PM="pnpm"
elif [[ -f "yarn.lock" ]]; then PM="yarn"
elif [[ -f "package-lock.json" ]]; then PM="npm"
else PM=""
fi
```

If `PM` is empty (no lock file found), skip the health check steps below.

### 5a. Lint (scoped)

```bash
$PM lint 2>&1 | tail -20
```

### 5b. TypeScript (scoped)

```bash
$PM typecheck 2>&1 | tail -20
```

Report pass/fail for each. Do NOT run full test suite here (too slow for a status check).

### Display

- **Lint:** ✅ Pass / ❌ N errors
- **Types:** ✅ Pass / ❌ N errors

If no changed files:

- **Health:** No code changes to check

---

## Step 6: Sprint Snapshot (1-line)

Only fetch if we were able to connect to GitHub in earlier steps.

```bash
export GODEBUG=x509negativeserial=1
gh issue list \
  --repo "$REPO" \
  --assignee @me \
  --state open \
  --json number,title,labels \
  --limit 20 \
  --jq 'length'
```

### Display

- **My open issues:** N total

---

## Step 7: Recommended Action

Based on ALL of the above, determine the single most important next action.
Use this priority order (first match wins):

| Condition                                                  | Recommendation                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| CI failing on open PR                                      | "🔴 CI is failing. Fix errors before anything else." + show failing check names       |
| PR has CHANGES_REQUESTED with unaddressed comments         | "🔴 PR has N unaddressed review comments. Run the review workflow to triage and fix." |
| Uncommitted changes + lint/type errors                     | "⚠️ You have uncommitted work with errors. Fix lint/type issues, then commit."        |
| Uncommitted changes + clean health                         | "✅ Ready to commit. Run the commit workflow."                                        |
| Plan exists with incomplete tasks + no uncommitted changes | "📝 Plan is N% complete. Run the execute workflow to continue Task N."                |
| All plan tasks complete + no PR                            | "🚀 Implementation complete. Run the push workflow to create PR."                     |
| Open PR, approved, CI green                                | "🎉 PR is approved and CI is green! Merge when ready."                                |
| Open PR, review pending                                    | "⏳ PR is waiting for review. Work on another story or run the next workflow."        |
| No active work (main branch, no changes)                   | "☕ No work in progress. Run the day workflow to pick a story."                       |
| Branch exists but no plan and no PR                        | "📋 Branch has no plan. Run plan-feature or execute if you have one."                 |

---

## Output Format

Present everything as a single, scannable dashboard:

```
╔══════════════════════════════════════════════════════╗
║                    STATUS REPORT                     ║
╠══════════════════════════════════════════════════════╣

🌿 Branch:     feat/123-add-button-variant
   Commits:    3 ahead of main
   Changes:    2 files uncommitted
   Stash:      0 entries

📋 Story:      #123 — Add Button variant for compact mode
   State:      Open · Priority: High · 3pts

📝 Plan:       plans/add-button-variant.md
   Progress:   ████████░░ 5/7 tasks (71%)
   Next:       Task 6 — Add unit tests for compact variant

🔀 PR:         None open

⚠️ Health:
   Lint:       ✅ Pass
   Types:      ❌ 2 errors in src/button.tsx

📊 Sprint:     8 open issues assigned to me

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧭 NEXT ACTION: Fix 2 type errors in src/button.tsx,
   then continue plan Task 6 with the execute workflow.

╚══════════════════════════════════════════════════════╝
```

> **Tip:** Run the status command at the start of every session. It takes ~15 seconds
> and saves minutes of context reconstruction.
