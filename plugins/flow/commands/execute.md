---
name: flow:execute
category: daily
type: command
description: Execute an implementation plan
keywords: [implement, plan, build, run, feature]
argument-hint: "[path-to-plan]"
---

# Execute: Implement from Plan

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Plan to Execute

Read the plan file from `$ARGUMENTS`.

## Pre-Flight: Ensure Workflow State

If `.ai/state/STATE.md` does not exist but `.ai/templates/STATE.md` does:

1. `mkdir -p .ai/state`
2. Copy `.ai/templates/STATE.md` → `.ai/state/STATE.md`
3. Populate: **Phase** = plan filename (e.g., `Phase 1`), **Status** = `in-progress`, **Updated** = current date
4. Print: `📋 Auto-initialized workflow state at .ai/state/STATE.md`

If `.ai/state/STATE.md` already exists, update **Status** to `in-progress` and **Active Task** to the plan filename.

## Execution Instructions

### 1. Read and Understand

- Read the ENTIRE plan carefully
- Understand all tasks and their dependencies
- Note the validation commands to run
- Review the testing strategy
- Note the GitHub issue number from plan metadata (for commit/PR linking)

### Agent Activation

1. Read `CLAUDE.md` to determine if a specialized agent applies to this plan's domain.
2. If an `.claude/agents/` directory exists, check for agent files matching the plan's affected packages or domains.
3. If a matching agent is found, read the agent file and apply its rules to all subsequent steps.

> Print which agent was activated, e.g. "🤖 Activated agent: <name>"
> If no agent matches, proceed without an agent.

### 2. Execute Tasks in Order

For EACH task in "Tasks":

**CRITICAL — COMPLETE ALL ITEMS**: If a task says "for each component" or "repeat for [list]", you MUST execute it for EVERY item in that list. Do NOT stop after one example. Do NOT skip items.

#### a. Navigate to the task

- Identify the file and action required
- Read existing related files if modifying

#### b. Implement the task

- Follow the detailed specifications exactly
- Maintain consistency with existing code patterns
- Include proper type hints and documentation

#### c. Edit-Verify Loop (max 3 iterations)

> **Pattern reference:** See `.ai/docs/patterns.md` — Pattern 1: Edit-Verify Loop

After implementing the task, run `/flow:utils-verify` to confirm correctness. `/flow:utils-verify` automatically:

1. Runs static checks (type-check, lint, affected tests)
2. For UI tasks: spawns agent-browser smoke (web) or agent-device smoke (RN)
3. Optionally spawns the `a11y-auditor` + `design-system-guard` subagents

**Loop:**

1. **Verify:** run `/flow:utils-verify`.
2. **If pass:** Continue to the next task.
3. **If fail:**
   a. Read error output carefully — identify the **root cause**, not just the symptom.
   b. Apply targeted fix (do NOT make unrelated changes).
   c. Re-run `/flow:utils-verify`.
   d. Repeat up to **3 iterations total** for this task.
4. **If 3 iterations exhausted without success:**
   - **STOP** — do not continue to the next task.
   - Report what failed, what was attempted per iteration, final error output.
   - Recommend manual intervention with specific guidance.
   - Mark this task as `❌ BLOCKED` in the output report.

**If a task introduces UI changes but the affected screen has no scenario in `.ai/scenarios/`:**

- Flag in the output report: _"UI task X touches screen Y, which has no scenario coverage. Recommendation: after the last task run `/scenario new <name>`."_
- Don't stop execute over this (scenario is primarily a `/validate`/`/done` job), but flag it so `/done` has something to run.

#### d. Polish pass (`code-simplifier`)

After `/flow:utils-verify` passes, before the checkpoint, spawn the `code-simplifier` subagent via the Task tool **on files touched in this task** (not the full session diff).

```
Task tool → subagent_type: code-simplifier
prompt: "Refactor <list of files modified in this task> for clarity.
         Honor CLAUDE.md and project rules.
         Preserve all behavior. Do NOT touch tests or scenarios."
```

**After the simplifier pass run `/flow:utils-verify` again** (light smoke). If it breaks test/typecheck:

- The Edit-Verify Loop iteration counter does **NOT** reset — you still have max 3.
- If the pass fails and you've used < 3 iterations, try to fix; otherwise revert the simplifier diff (`git checkout -- <files>`) and continue with the pre-simplifier version.

**Skip the simplifier pass when:**

- The task is hot-path performance code (DDR-flagged).
- The task is purely config/infra (lockfile, GH actions, env).
- The task is < ~30 lines of diff (overhead > value).

#### e. Checkpoint progress

After each task passes verification, record progress in the plan file by checking off the task checkbox:

> `✅ Task N: <title> — completed`

Persist checkpoint state in `.ai/state/STATE.md` under a `## Execution Progress` section (create if missing). On resume, read this file and skip to the first incomplete task.

### 3. Implement Testing Strategy

- Create all test files specified in the plan
- Implement all test cases mentioned
- Follow the testing approach outlined

### 4. Final Validation (suggest, don't run)

After the last task, **do not** auto-run a full `/validate` — it's expensive (cross-platform scenario, 5–15 min). Instead:

- Summarize what was done
- Prompt: _"Plan complete. Run /done for full `/validate` (incl. cross-platform scenario) → commit → PR?"_

If the user says yes, `/done` takes over.

## Output Report

### Completed Tasks

- List of all tasks completed
- Files created (with paths)
- Files modified (with paths)

### Per-task Verification Results

For each completed task, list:

- ✅ Task N — verify pass (iterations: 1)
- ❌ Task M — BLOCKED after 3 iterations (last error: ...)
- ⚠ Task K — verify pass with warnings (a11y / design-system warnings)

### Scenario coverage check

- UI tasks completed: <N>
- Scenarios available for those tasks: <list>
- **Missing scenarios:** <list — to be created via `/scenario new <name>` before /done>

### Next step

> **Plan complete.** Run `/done` (full `/validate` → commit → PR) or first `/scenario new` for missing coverage?

### Tests Added

- Test files created

## Post-Execution Flow

After all validations pass, ask:

> **All validations passed. Ready to commit?** I'll create a conventional commit with a changelog entry if your project's `integrations.changelog.provider` calls for one (run `/flow:release-changelog` to author).

If the user confirms, execute the commit workflow (follow `.claude/commands/commit.md` steps).

After the commit succeeds, ask:

> **Committed. Ready to push and create a PR?** I'll rebase onto main, push, and create the PR with the issue linked.

If the user confirms, execute the push workflow (follow `.claude/commands/push.md` steps).

## Notes

- If you encounter issues not addressed in the plan, document them
- If you need to deviate from the plan, explain why
- If tests fail, fix implementation until they pass
- Don't skip validation steps
