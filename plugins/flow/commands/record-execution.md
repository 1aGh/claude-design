---
name: flow:record-execution
category: record
type: command
description: Generate implementation report for system review
keywords: [report, reflection, implementation, analysis, retrospective]
---

# Execution Report

Review and deeply analyze the implementation you just completed.

## Context

You have just finished implementing a feature. Reflect on what happened.

## Generate Report

Save to: `.ai/logs/execution-reports/<feature-name>.md`

### Meta Information

- Plan file: [path to plan that guided this implementation]
- GitHub Issue: #<number> (if linked)
- Files added: [list with paths]
- Files modified: [list with paths]
- Lines changed: +X -Y

### Validation Results

- Lint: ✓/✗
- Types: ✓/✗
- Tests: ✓/✗ (X passed, Y failed)
- Build: ✓/✗
- A11y: ✓/✗/skipped
- Visual: ✓/✗/skipped

### What Went Well

- [concrete examples]

### Challenges Encountered

- [what was difficult and why]

### Divergences from Plan

For each divergence:

- Planned: [what plan specified]
- Actual: [what was implemented]
- Reason: [why]

### Skipped Items

- [what was skipped and why]

### Recommendations

- Plan improvements
- Execute improvements
- Rules updates
