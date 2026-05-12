---
name: context
type: command
description: Prime agent with codebase understanding for the current project
keywords: [prime, onboard, codebase, understand, explore]
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the current project by analyzing structure, documentation, and key files — scoped to what the user is working on.

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Repository Auto-Detection

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')"
```

## Process

### 1. Read Project Identity (if available)

Check for `PROJECT.md` at the repo root:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_FILE="${REPO_ROOT}/PROJECT.md"
```

If `PROJECT.md` exists, read it first to understand:

- **Identity** — project name, org, repo
- **Stack** — language, framework, build tool, package manager, monorepo status
- **Tracking** — which system (GitHub, ADO, Jira) and project/board IDs
- **Team** — members and board links
- **Constraints** — proxy settings, prohibited packages, branching and commit conventions

> `PROJECT.md` provides machine-readable identity. `CLAUDE.md` (Step 3) provides detailed behavioral rules. They are complementary, not replacements.

If `PROJECT.md` does not exist:

> ⚠️ No PROJECT.md found. Run `onboard` to create one for richer project integration. Continuing with CLAUDE.md and auto-detection.

### 2. Ask: What area are you working on?

If the project is a monorepo (detected from `PROJECT.md` → `monorepo: true`, or from `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json`):

Present a picker using the `ask_user_question` tool listing the apps/packages from the workspace config.

If the project is a single-repo: skip this step — load the whole project.

Wait for the user's response before continuing.

### 3. Read Core Rules (always)

Read `CLAUDE.md` — pay special attention to:

- **Rules** section (hard constraints)
- **Prohibited packages** or legal restrictions
- Any project-specific conventions

### 4. Load Project-Specific Context

Based on the user's selection:

1. Read the selected app/package's `CLAUDE.md` or `README.md` if present
2. Read any rule files in the app directory (`.ai/docs/rules.md`, `docs/rules.md`)
3. Read architecture docs if present
4. Read project structure docs if present

Recent activity:

```bash
git log -10 --oneline -- <selected-path>/
git status -- <selected-path>/
```

Check plans:

```bash
find . -path '*/plans/*.md' -not -path './node_modules/*' 2>/dev/null | head -10
```

### 5. Understand Current State

```bash
git log -10 --oneline
git status
git branch --show-current
```

### 6. Count Asset Inventory

Run filesystem counts to establish the current inventory:

```bash
echo "Commands: $(find .claude/commands -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Agents: $(find .claude/agents -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Skills: $(find .claude/skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
echo "Prompts: $(find .ai/prompts -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
echo "Instructions: $(find .github/instructions -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
```

### 7. Detect Active Domain & Recommend Agent

1. Gather recently touched files:

```bash
git diff --name-only HEAD~3..HEAD 2>/dev/null || echo "No recent changes detected"
git diff --name-only 2>/dev/null
```

2. If an agent routing configuration exists, read it and match touched file patterns against the routing table triggers.
3. Include the result in the **Recommended Agent** section of the Output Report below.

> If `git diff` returns empty (fresh clone or clean tree), output: "No recent changes detected; no agent recommendation."
> The recommendation is advisory — the user may override.

## Output Report

### Project Overview

- Which area was loaded
- Current branch and recent commits

### Key Rules

- List key rules from `CLAUDE.md`

### Current State

- Active branch
- Uncommitted changes
- Open plans

### Capabilities Summary

- **Commands:** {count} available (list top 5 most relevant to chosen area)
- **Agents:** {count} available (list all with one-line descriptions)
- **Skills:** {count} available (list all with one-line descriptions)
- **Prompts:** {count} available (list all with one-line descriptions)

### Recommended Agent

Based on recently touched files:

- **Primary:** `<agent-name>` — <reason>
- **Also relevant:** `<agent-name>` — <reason> (if multiple matches)
- If no trigger matched: "No agent recommendation — proceed without loading an agent."

**Make this summary easy to scan — use bullet points and clear headers.**
