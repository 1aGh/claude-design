---
name: execute
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

After implementing the task, run `/verify` to confirm correctness. `/verify` automaticky:

1. Spustí static checks (type-check, lint, dotčené testy)
2. Pro UI tasky: spawn agent-browser smoke (web) nebo agent-device smoke (RN)
3. Volitelně spawn `a11y-auditor` + `design-system-guard` subagenty

**Smyčka:**

1. **Verify:** spusť `/verify`.
2. **If pass:** Continue to the next task.
3. **If fail:**
   a. Read error output carefully — identify the **root cause**, not just the symptom.
   b. Apply targeted fix (do NOT make unrelated changes).
   c. Re-run `/verify`.
   d. Repeat up to **3 iterations total** for this task.
4. **If 3 iterations exhausted without success:**
   - **STOP** — do not continue to the next task.
   - Report what failed, what was attempted per iteration, final error output.
   - Recommend manual intervention with specific guidance.
   - Mark this task as `❌ BLOCKED` in the output report.

**Pokud task introduces UI změny, ale dotčený screen nemá scenario v `.ai/scenarios/`:**

- Flagni v output reportu: _"UI task X dotýká screen Y, který nemá scenario coverage. Doporučení: po posledním tasku spustit `/scenario new <name>`."_
- Nezastavuj execute kvůli tomu (scenario je primárně job `/validate`/`/done`), ale upozorni, ať `/done` má co spustit.

#### d. Polish pass (`code-simplifier`)

Po pass `/verify`, před checkpointem, spawn `code-simplifier` subagent přes Task tool **na soubory dotčené v tomto tasku** (ne celý diff sezení).

```
Task tool → subagent_type: code-simplifier
prompt: "Refactor <list of files modified in this task> for clarity.
         Honor CLAUDE.md, dugmate-testing-rules, dugmate-a11y-rules.
         Preserve all behavior. Do NOT touch tests or scenarios."
```

**Po simplifier pass znovu spusť `/verify`** (lehký smoke). Pokud rozbije test/typecheck:

- Iteration counter z Edit-Verify Loop **se NEresetuje** — máš stále max 3.
- Pokud pass selže a máš < 3 iterations použito, pokus se fix; jinak revert simplifier diff (`git checkout -- <files>`) a pokračuj s pre-simplifier verzí.

**Skip simplifier pass když:**

- Task je hot-path performance kód (DDR-flagged, např. `packages/sync` delta sync).
- Task je čistě config/infra (lockfile, GH actions, env).
- Task je < ~30 řádků diff (overhead > value).

#### e. Checkpoint progress

After each task passes verification, record progress in the plan file by checking off the task checkbox:

> `✅ Task N: <title> — completed`

Persist checkpoint state in `.ai/state/STATE.md` under a `## Execution Progress` section (create if missing). On resume, read this file and skip to the first incomplete task.

### 3. Implement Testing Strategy

- Create all test files specified in the plan
- Implement all test cases mentioned
- Follow the testing approach outlined

### 4. Final Validation (suggest, don't run)

Po posledním tasku **nespouštěj** plný `/validate` automaticky — to je drahé (cross-platform scenario, 5–15 min). Místo toho:

- Souhrn co bylo hotovo
- Připomeň: _"Plán dokončen. Spustit /done pro plný `/validate` (incl. cross-platform scenario) → commit → PR?"_

Pokud user řekne ano, `/done` převezme řízení.

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

> **Plán dokončen.** Spustit `/done` (full `/validate` → commit → PR) nebo nejdřív `/scenario new` pro chybějící coverage?

### Tests Added

- Test files created

## Post-Execution Flow

After all validations pass, ask:

> **All validations passed. Ready to commit?** I'll create a conventional commit with a changeset if needed.

If the user confirms, execute the commit workflow (follow `.claude/commands/commit.md` steps).

After the commit succeeds, ask:

> **Committed. Ready to push and create a PR?** I'll rebase onto main, push, and create the PR with the issue linked.

If the user confirms, execute the push workflow (follow `.claude/commands/push.md` steps).

## Notes

- If you encounter issues not addressed in the plan, document them
- If you need to deviate from the plan, explain why
- If tests fail, fix implementation until they pass
- Don't skip validation steps
