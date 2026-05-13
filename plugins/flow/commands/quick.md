---
name: quick
type: command
description: Fast-path for trivial changes — skip the full plan cycle, go straight to edit → verify → commit
keywords: [quick, fast, trivial, small, hotfix, one-liner, shortcut]
---

# Quick: Fast-Path for Trivial Changes

## Objective

Skip the full intake → plan → execute cycle for small, obvious changes that don't need a plan. Go straight to edit → verify → commit.

## When to Use

All of the following must be true:

- **≤3 files** changed
- **Single package** (not cross-package)
- **No new patterns** introduced (follows existing conventions)
- **No new dependencies** added

If any criterion fails, redirect:

> This change is too complex for `quick`. Use `plan-feature` instead.

## Guardrails — Hard Limits

**Never** use `quick` for:

- New pages, routes, or API endpoints
- New dependencies (`pnpm add`, `npm install`)
- Cross-package changes in a monorepo
- Database schema changes
- Changes that affect CI/CD configuration
- Security-sensitive changes (auth, permissions, secrets)
- Changes that need a release-note entry (per `integrations.changelog.provider`) — `/flow:quick` skips changelog authoring; route through `/flow:plan` instead, or run `/flow:release-changelog` post-merge.

If the change falls into any of these categories, stop and redirect to `plan-feature`.

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Process

### 1. Confirm Triviality

Before making any changes, verify the criteria:

1. Ask the user to describe the change in one sentence
2. Check: Does it touch ≤3 files?
3. Check: Is it in a single package?
4. Check: Does it add new dependencies?
5. Check: Does it introduce a new pattern?

If any check fails → redirect to `plan-feature`.

### 2. Make the Change

Edit the file(s) directly — no plan file needed.

Follow existing conventions in the codebase:

- Match naming patterns
- Match import style
- Match test patterns (if adding/modifying tests)

### 3. Verify

Run `verify-work` to confirm the change passes quality gates.

Read and follow the steps in `.claude/commands/verify-work.md`.

### 4. Handle Results

**If verify passes:**

Run the commit flow — read and follow `.claude/commands/commit.md`.

**If verify fails:**

Offer two options:

1. **Fix and retry** — apply fix, re-run verify (max 3 attempts)
2. **Escalate** — the change is more complex than expected; redirect to `plan-feature`

## Output

After completion:

```
⚡ Quick change complete.

  Files:  <list of changed files>
  Verify: ✅ passed
  Commit: <commit hash> <commit message>
```
