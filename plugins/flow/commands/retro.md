---
name: system-review
type: command
description: Analyze implementation against plan for process improvements
keywords: [process, meta, review, plan, retrospective, improvement]
argument-hint: [plan-path] [execution-report-path]
---

# System Review

Meta-level analysis: how well did the implementation follow the plan?

## Purpose

**System review is NOT code review.** You're looking for bugs in the **process**, not the code.

## Inputs

- Plan file: $1
- Execution report: $2

Also read:

- `.claude/commands/plan-feature.md` (planning process)
- `.claude/commands/execute.md` (execution process)

## Analysis

### Step 1: Extract planned vs actual

Read the plan and execution report. Compare.

### Step 2: Classify divergences

- **Good ✅**: Plan assumption wrong, better approach found, security fix needed
- **Bad ❌**: Ignored constraints, shortcuts, misunderstood requirements

### Step 3: Identify root causes

For each bad divergence:

- Was the plan unclear?
- Was context missing?
- Was validation missing?

### Step 4: Recommend improvements

- Rules updates (`CLAUDE.md` → **Rules** section)
- Plan command improvements
- Execute command improvements
- New commands to automate repeated manual steps

## Output

Save to: `.ai/logs/system-reviews/<feature-name>-review.md`

Include:

- Overall Alignment Score: \_\_/10
- Divergence analysis (yaml blocks)
- Pattern compliance checklist
- Specific improvement actions with suggested text
- Key learnings

**Be specific. Don't say "plan was unclear" — say "plan didn't specify which auth pattern to use."**
