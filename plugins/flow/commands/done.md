---
description: Close out a feature — /validate gate (incl. cross-platform scenario) → DDR sweep → commit → push → PR → retro → archive
argument-hint: "<optional: path to plan>"
---

# /done — close out a feature

This is the **final gate**. Run it after `/execute` when all tasks pass. It consolidates verification, commit, and push into a single action.

Input: `$ARGUMENTS` — optionally a path to the plan file. If missing, use the one from `.ai/state/STATE.md`.

## Process

### 1. Run `/validate` (hard gate)

`/validate` performs static analysis, tests, build, **cross-platform scenario** (`scenario-runner` subagent across 5 platforms), a11y audit, design consistency, and decision drift check.

If anything in `/validate` fails → stop. Return to `/execute` to fix. After the fix, run `/done` again.

**Key gate:** the scenario report must have `blockers == 0` AND `parity_ok == true` (or a clear DDR explaining intentional divergence).

### 2. Acceptance criteria check

Walk through `## Acceptance Criteria` in the plan, check off or flag each criterion. Key items:

- [ ] All tasks completed
- [ ] `/validate` passes (incl. scenario, a11y, design system)
- [ ] No DDR-worthy decision left unrecorded
- [ ] Scenario report linked in PR description

If a criterion can't be met, **don't skip** — record a blocker in STATE.md and /pause.

### 3. Record decisions (DDR sweep)

Walk through `## Decisions to record` in the plan. For each unrecorded item run `/ddr` (or do it inline). **No decision is lost.** The `ddr-keeper` skill provides a quality gate.

### 4. Code review (`/code-review`)

Run `/code-review` on uncommitted changes. This version sequences:

1. Audit pass — finds correctness / quality / security / convention findings.
2. `code-simplifier` subagent pass — auto-fixes stylistic issues (clarity, nesting, naming).
3. Recheck — re-run static checks + affected tests. If the simplifier broke something, revert.

**Hard gate:**

- Verdict `NEEDS FIXES` (CRITICAL findings) → stop. Return to `/execute` to fix. Re-run `/done` after the fix.
- Verdict `PASS` or `PASS WITH SUGGESTIONS` → continue to commit.

The review report at `.ai/logs/code-reviews/<branch-name>.md` is committed with the feature changes (linked in the PR description).

### 4b. Changelog reminder (soft gate, overridable)

> Same provider-dispatch shape as `/flow:validate` Step 7b. Non-blocking, but at `/done` it's an explicit prompt rather than a passive warning — closing out the feature is the right moment to remember the release note.

Read `integrations.changelog.provider` from `.ai/workflows.config.json`.

```
IF provider === "changesets":
  diff = git diff --name-only $(git merge-base main HEAD)..HEAD -- .changeset/
  IF no new .changeset/*.md on the branch:
    PROMPT: "No changeset detected on this branch. Run /flow:release-changelog before closing? [y/N]"
    IF y → run /flow:release-changelog, then loop back here once authored.
    IF N → record override reason ("user-visible? <reason>") in the PR description under `## Notes`.
ELIF provider IN (git-cliff, conventional, custom):
  PRINT: "[done] changelog: provider `<name>` not yet implemented — author your release note manually."
ELSE (none):
  skip silently
```

The override path is intentional: not every PR ships user-visible change (chore, infra, internal refactor). The reminder exists so the team makes that call **consciously**, not by forgetting.

### 5. Commit

Conventional commit. Format:

```
<type>(<scope>): <imperative summary>

<body: what and why, not how>

Refs: .ai/plans/<x>.plan.md
DDRs: .ai/decisions/DDR-<NNN>.md (if any were created)
Scenario: .ai/device/scenario-runs/<name>/<ts>/report.md
```

- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.
- **Stage specific files**, not `git add -A` (secrets / out-of-scope changes).
- **NEVER** use `--no-verify` or `--amend` unless the user asked for it.

### 6. Push & PR (optional — ask)

_"Publish the branch and open a PR?"_ — if yes:

- `git push -u origin <branch>`
- `gh pr create` with body:

```markdown
## Summary
<2–3 bullets of what changed>

## Cross-platform validation
- Scenario: `<name>`
- Result: <X>/<Y> platforms PASS
- Report: [.ai/device/scenario-runs/<name>/<ts>/report.md](<repo URL>)
- Parity: ✓ identical counter-delta

## Linked
- Plan: .ai/plans/<x>.plan.md
- PRD: <§ parent or path>
- DDRs: <list>

## Test plan
- [ ] Run `/scenario <name>` locally against the checked-out branch
- [ ] Spot-check screenshots in scenario report
- [ ] <any manual edge cases>
```

### 6b. Sync tracker (optional)

Read `integrations.tracker` from `.ai/workflows.config.json`. If `provider` is not `none` and an MCP tool with the matching `mcp` prefix is available:

- Look at the plan front matter or `STATE.md` for a ticket ID (e.g. `tracker: ABC123` or `clickup: 86c7vx11y`).
- Ask the user: _"Mark ticket `<id>` as done in `<provider>` and link this PR?"_
  - If **yes** → call `<mcp>_*_update_task` (or provider equivalent) with the done status from `defaults.doneStatus` and append a comment with the PR URL + commit hash. Generic command — pass `integrations.tracker.defaults` through untouched; the MCP server interprets it.
  - If **no** → skip silently.
- If no ticket ID is recorded but a tracker is configured → ask: _"Create a tracker ticket for this work?"_ (rare on `/done` — usually tickets exist before; offer only if PR has no `Closes #` reference).

If `provider === "none"` or no MCP available → skip this step entirely. The command stays useful without any tracker.

### 6c. CLAUDE.md debrief (optional)

Invoke the `claude-md-keeper` skill with the feature's plan + commit diff as context:

> One-line check: did this feature introduce a new convention, build step, or "always do X" rule that belongs in CLAUDE.md? (Each line in CLAUDE.md is in every future session's context, so be sparing — only rules that will save the next agent from a re-correction.)

If the user lists items, propose CLAUDE.md additions (or moves to `.claude/rules/<topic>.md` for path-scoped rules). Keep file ≤200 lines. Skip silently if no relevant change.

### 7. Retro & archive

- Append a `## Retro` section to the end of the plan. 3–5 bullets: what worked / what didn't / what to change in `/plan` or `/execute` next time. This is the learning loop — the next `/plan` reads it.
- If there were unexpected pivots, parity gaps, blockers, or plan rewrites → consider a standalone DDR ("what we learned about this domain") or a full `/retro`.
- Move the plan to `.ai/plans/archive/<x>.plan.md`.
- STATE.md → phase + status `done`, history row `done | <date> | <one-liner>`. Active task → `—`. Active plan → `—`.

### 8. Report

```
✓ Done: <feature name>
  Validate: ✓ all gates passed
  Scenario: 5/5 platforms PASS — <report path>
  Code review: ✓ <verdict> — .ai/logs/code-reviews/<branch>.md
  Simplifier: <files touched / skipped>
  Commit: <hash> <subject>
  PR: <URL or "—">
  Tracker: <ticket id @ provider, status updated | "—">
  DDRs recorded: <N>
  Plan archived: .ai/plans/archive/<x>.plan.md
  Time in execution: <approx>
```

Suggest: _"Run /status for a project overview, or /retro for a process retrospective?"_
