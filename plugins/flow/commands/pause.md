---
name: flow:pause
category: daily
type: command
description: Pause the current workflow, write HANDOFF.md and update STATE.md for session continuity
keywords: [pause, stop, save, session, handoff, continuity, break]
---

# Pause Work: Save Session State

## Objective

Safely pause the current workflow with full context preserved. Writes a handoff artifact and updates workflow state so the next session (or another developer) can pick up exactly where you left off.

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Process

### 1. Capture Current State

Read `.ai/state/STATE.md` if it exists. Extract:

- Current phase
- Active task
- Blockers
- Decisions made

If `STATE.md` does not exist:

> ⚠️ No active workflow state found. Creating a minimal handoff from git state only.

### 2. Capture Git State

```bash
# Current branch
git branch --show-current

# Working tree changes
git status --short

# Diff stats
git diff --stat

# Commits ahead of main
git log origin/main..HEAD --oneline 2>/dev/null || git log main..HEAD --oneline
```

### 3. Write HANDOFF.md

Create the state directory if needed:

```bash
mkdir -p .ai/state
```

Write `.ai/state/HANDOFF.md` using the template from `.ai/templates/HANDOFF.md`, filling in all fields from the gathered context:

- **Project:** from `.ai/workflows.config.json` → `name` (or repo basename as fallback)
- **Branch:** from `git branch --show-current`
- **PR:** from `gh pr view --json url -q .url 2>/dev/null` or "none"
- **Last session:** current timestamp
- **Phase / Active task / Status:** from STATE.md or "no active workflow"
- **Completed Work:** from STATE.md history or recent commits
- **Remaining Work:** from STATE.md or plan file
- **Open Decisions:** from STATE.md decisions section
- **Blockers:** from STATE.md blockers section
- **Files Changed:** from `git diff --name-only HEAD` + `git diff --name-only --staged`
- **Notes for Next Session:** summarize the immediate next action

### 4. Update STATE.md

If `.ai/state/STATE.md` exists:

1. Update **Status** → `paused`
2. Update **Updated** → current timestamp
3. Append a history entry:

```
| <timestamp> | <current-phase> | Paused — <brief reason> |
```

If STATE.md doesn't exist, skip this step (handoff alone is sufficient).

### 5. Print Summary

Output a brief summary to the user:

```
📋 Work paused.

  Branch: <branch>
  Phase:  <phase or "no active workflow">
  Done:   <count> tasks completed
  Left:   <count> tasks remaining
  Files:  <count> modified

  Handoff: .ai/state/HANDOFF.md
  State:   .ai/state/STATE.md

  Resume later with `/flow:resume`.
```

## Output

Two files written:

- `.ai/state/HANDOFF.md` — full context for the next session
- `.ai/state/STATE.md` — updated status (if it existed)

## Notes

- You can share `.ai/state/HANDOFF.md` with another developer for pair handoff
- The handoff includes enough context to resume without reading the full plan
- Run `/flow:resume` to pick up where you left off
