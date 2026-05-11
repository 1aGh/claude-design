---
name: onboard
type: command
description: Auto-detect project stack and interactively populate PROJECT.md
keywords: [init, setup, onboard, project, configure, bootstrap]
---

# Onboard: Bootstrap PROJECT.md & Editor Pointers

Auto-detects your project's stack and structure, asks for what it can't detect, writes a populated `PROJECT.md` to the repo root, and generates editor-specific pointer files for installed AI commands.

## Pre-Flight: Check for AI Commands

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
AI_COMMANDS_DIR="${REPO_ROOT}/.claude/commands"
```

Check if `.claude/commands/` exists:

- **If missing** → Print guidance and continue (pointer generation in Step 6 will be skipped):
  > **Slash commands not found.** Restoruj `.claude/commands/` z gitu nebo z `ai-loop/` backup, pak re-spusť onboard.
- **If present** → Count commands and note the count for later:
  ```bash
  CMD_COUNT="$(find "${AI_COMMANDS_DIR}" -name '*.md' -type f | wc -l | tr -d ' ')"
  ```
  > Found `$CMD_COUNT` commands in `.claude/commands/`. Editor pointers will be generated in Step 6.

> **Graceful degradation:** Steps 1–5 (PROJECT.md generation) always run regardless of whether `.claude/commands/` exists. Steps 6–7 (pointer generation) are conditional on `.claude/commands/` being present.

## Step 1: Check for Existing PROJECT.md

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_FILE="${REPO_ROOT}/PROJECT.md"
```

If `PROJECT.md` already exists:

> **PROJECT.md already exists. Would you like to update it or skip?**

- **Update** → continue to Step 2, pre-fill detected values from the existing file
- **Skip** → exit

## Step 2: Auto-Detect What We Can

Run detection in order and collect results:

### 2a. Identity

```bash
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '')"
ORG="$(echo "$REMOTE_URL" | sed 's|.*github.com[:/]||;s|/.*||')"
REPO_NAME="$(echo "$REMOTE_URL" | sed 's|.*github.com[:/]||;s|\.git$||;s|.*/||')"
```

- **org** ← `$ORG`
- **repo** ← `$REPO_NAME`

### 2b. Package Manager

```bash
if   [[ -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then PM="pnpm"
elif [[ -f "${REPO_ROOT}/yarn.lock" ]];      then PM="yarn"
elif [[ -f "${REPO_ROOT}/package-lock.json" ]]; then PM="npm"
elif [[ -f "${REPO_ROOT}/pom.xml" ]];        then PM="maven"
elif [[ -f "${REPO_ROOT}/build.gradle" ]] || [[ -f "${REPO_ROOT}/build.gradle.kts" ]]; then PM="gradle"
elif [[ -f "${REPO_ROOT}/go.mod" ]];         then PM="go"
elif [[ -f "${REPO_ROOT}/requirements.txt" ]] || [[ -f "${REPO_ROOT}/pyproject.toml" ]]; then PM="pip"
elif [[ -f "${REPO_ROOT}/Cargo.toml" ]];     then PM="cargo"
else PM="unknown"
fi
```

### 2c. Language

```bash
if   [[ -f "${REPO_ROOT}/pom.xml" ]] || [[ -f "${REPO_ROOT}/build.gradle" ]] || [[ -f "${REPO_ROOT}/build.gradle.kts" ]]; then LANG_DETECT="java"
elif [[ -f "${REPO_ROOT}/go.mod" ]];           then LANG_DETECT="go"
elif [[ -f "${REPO_ROOT}/Cargo.toml" ]];      then LANG_DETECT="rust"
elif [[ -f "${REPO_ROOT}/pyproject.toml" ]] || [[ -f "${REPO_ROOT}/requirements.txt" ]]; then LANG_DETECT="python"
elif [[ -f "${REPO_ROOT}/tsconfig.json" ]];   then LANG_DETECT="typescript"
elif [[ -f "${REPO_ROOT}/package.json" ]];    then LANG_DETECT="javascript"
else LANG_DETECT="unknown"
fi
```

### 2d. Monorepo

```bash
if [[ -f "${REPO_ROOT}/pnpm-workspace.yaml" ]] || \
   [[ -f "${REPO_ROOT}/turbo.json" ]] || \
   [[ -f "${REPO_ROOT}/nx.json" ]] || \
   [[ -f "${REPO_ROOT}/lerna.json" ]]; then
  MONOREPO="true"
else
  MONOREPO="false"
fi
```

### 2e. Build Tool

```bash
if   [[ -f "${REPO_ROOT}/turbo.json" ]];     then BUILD="turbo"
elif [[ -f "${REPO_ROOT}/nx.json" ]];         then BUILD="nx"
elif [[ -f "${REPO_ROOT}/pom.xml" ]];         then BUILD="maven"
elif [[ -f "${REPO_ROOT}/build.gradle" ]] || [[ -f "${REPO_ROOT}/build.gradle.kts" ]]; then BUILD="gradle"
elif [[ -f "${REPO_ROOT}/Makefile" ]];        then BUILD="make"
else BUILD="none"
fi
```

### 2f. Commit Convention

```bash
if ls "${REPO_ROOT}"/commitlint.config.* 1>/dev/null 2>&1; then
  COMMITS="conventional"
else
  COMMITS="free-form"
fi
```

### 2g. CI System

```bash
if   [[ -d "${REPO_ROOT}/.github/workflows" ]]; then CI_SYSTEM="github-actions"
elif [[ -f "${REPO_ROOT}/azure-pipelines.yml" ]] || [[ -d "${REPO_ROOT}/.azure-pipelines" ]]; then CI_SYSTEM="azure-devops"
elif [[ -f "${REPO_ROOT}/Jenkinsfile" ]];     then CI_SYSTEM="jenkins"
elif [[ -f "${REPO_ROOT}/.gitlab-ci.yml" ]];  then CI_SYSTEM="gitlab-ci"
else CI_SYSTEM="unknown"
fi
```

### 2h. Team Members (GitHub only)

If tracking system is `github` and `gh` is available, attempt to fetch collaborators:

```bash
if [[ "$P_TRACKING" == "github" ]] && command -v gh &>/dev/null; then
  # List repo collaborators (returns logins)
  MEMBERS="$(gh api "repos/${ORG}/${REPO_NAME}/collaborators" --paginate -q '.[].login' 2>/dev/null | paste -sd, - || echo '')"
fi
```

If `$MEMBERS` is non-empty, present the list to the user for confirmation rather than asking them to type it manually.

## Step 3: Ask for What We Can't Detect

Present interactive questions for values that require human input. Use the ask questions tool.

> **RULE: Never write a TODO for shared PROJECT.md fields.** Every shared field must have a real value. If auto-detection fails for any field, add it to the questions below. If the user declines to answer a required question, ask again — do not silently write `TODO`. The only acceptable placeholder for shared fields is `none` when the user explicitly confirms a field does not apply.
>
> **Exception: `## Local Layout` machine-local values.** Paths and other per-machine entries may be left as `TODO` or stored in a separate untracked file (`PROJECT.local.md`). Do not block PROJECT.md generation on unanswered machine-local values.

### Required Questions (must have an answer before writing PROJECT.md)

1. **Project name** (short, kebab-case) — pre-fill with `$REPO_NAME` if detected
2. **One-line description** — what does this project do?
3. **Framework** — e.g., `spring-boot-3`, `next-js-16`, `django-5`, `none`
   > Don't auto-detect framework from language — Spring Boot vs Quarkus vs Micronaut all use Java. Ask.
4. **Tracking system** — `github` | `ado` | `jira` | `none`
5. **Project ID or board number** — required when tracking system is not `none`. Do not skip this.
6. **Team members** — if auto-detected from GitHub (Step 2h), present the list for confirmation. Otherwise ask for a comma-separated list of usernames.
7. **Related repos** — comma-separated list (or `none`)
8. **Proxy constraints** — e.g., `GODEBUG=x509negativeserial=1` (or `none`)
9. **Prohibited packages** — packages, které **nesmí** vstoupit do projektu (or `none`)
10. **Branching model** — `github-flow` | `trunk-based` | `gitflow`

### Catch-All: Any Auto-Detection Failures

After running Step 2, review every field that will appear in PROJECT.md. If **any** auto-detected value is `unknown` or empty, add a question for that field to the list above. The user must confirm or provide every value — no silent gaps.

## Step 4: Write PROJECT.md

Combine detected values and user answers. Write to `$PROJECT_FILE` using the template structure from `.ai/templates/PROJECT.md`.

**Every field must have a real value.** Use `none` only when the user explicitly confirmed a field does not apply. Never write `TODO`.

## Step 5: Report

Print a summary:

### Auto-Detected

| Field           | Value     | Source            |
| --------------- | --------- | ----------------- |
| org             | `<value>` | git remote        |
| repo            | `<value>` | git remote        |
| package-manager | `<value>` | lock file         |
| language        | `<value>` | project file      |
| monorepo        | `<value>` | workspace config  |
| build           | `<value>` | build config      |
| commits         | `<value>` | commitlint config |

### User-Provided

| Field           | Value     |
| --------------- | --------- |
| name            | `<value>` |
| description     | `<value>` |
| framework       | `<value>` |
| tracking system | `<value>` |
| ...             | ...       |

> ✅ PROJECT.md written to `<path>`. Shared commands will now auto-configure to this project.

### Editor Pointers Summary

> Include this section only if Step 6 ran (`.claude/commands/` exists).

| Editor   | Location               | Count     |
| -------- | ---------------------- | --------- |
| Copilot  | `.github/prompts/`     | `<count>` |
| Copilot  | `.github/skills/`      | `<count>` |
| Claude   | `.claude/commands/ai/` | `<count>` |
| Windsurf | `.windsurf/workflows/` | `<count>` |
| Index    | `.ai/workflows.md`     | 1         |

## Step 6: Generate Editor Pointers

> **Conditional:** Skip this step entirely if `.claude/commands/` does not exist (see Pre-Flight check). Print: "Skipping pointer generation — no `.claude/commands/` directory found."

### 6a. Scan Commands

Discover all command files in `.claude/commands/`:

```bash
find "${AI_COMMANDS_DIR}" -name '*.md' -type f | sort
```

For each file:

1. Read the YAML frontmatter to extract `name` and `description`
2. Compute the **reference path** — relative to repo root (e.g., `.claude/commands/bug/rca.md`)
3. Compute the **flat name** — replace `/` with `-` in the path relative to commands dir, strip `.md` (e.g., `bug/rca.md` → `bug-rca`)

**Note:** Include the `onboard` command itself in the generated pointers. It is idempotent — re-running it updates PROJECT.md and regenerates pointers with no side effects.

### 6b. Generate Pointer Files

For each discovered command, generate pointer files for all three editors plus Copilot skills. Add a managed header to every file:

```
<!-- Managed by onboard — regenerate with onboard command -->
```

**GitHub Copilot Prompts (`.github/prompts/<flat-name>.prompt.md`):**

```markdown
## <!-- Managed by onboard — regenerate with onboard command -->

mode: agent
description: "<description from command frontmatter>"

---

Read and follow the workflow in `.claude/commands/<path>.md` step by step.
Use the project context from `PROJECT.md` and `CLAUDE.md` if they exist.
```

**GitHub Copilot Skills (`.github/skills/<flat-name>/SKILL.md`):**

```markdown
## <!-- Managed by onboard — regenerate with onboard command -->

name: <flat-name>
description: "<description from command frontmatter>"

---

Read and follow the workflow in `.claude/commands/<path>.md` step by step.
Use the project context from `PROJECT.md` and `CLAUDE.md` if they exist.
```

**Claude Code (`.claude/commands/ai/<flat-name>.md`):**

For Claude Code, flatten subdirectory commands into a single name — `bug/rca.md` becomes `.claude/commands/ai/bug-rca.md`:

```markdown
<!-- Managed by onboard — regenerate with onboard command -->

Read and follow the workflow in .claude/commands/<path>.md step by step.
Use the project context from PROJECT.md and CLAUDE.md if they exist.
```

**Windsurf (`.windsurf/workflows/<flat-name>.md`):**

```markdown
## <!-- Managed by onboard — regenerate with onboard command -->

name: <flat-name>
description: "<description from command frontmatter>"

---

Read and follow the workflow in `.claude/commands/<path>.md` step by step.
Use the project context from `PROJECT.md` and `CLAUDE.md` if they exist.
```

### 6c. Create Directories

Ensure all pointer directories exist before writing:

```bash
mkdir -p "${REPO_ROOT}/.github/prompts"
mkdir -p "${REPO_ROOT}/.github/skills"
mkdir -p "${REPO_ROOT}/.claude/commands/ai"
mkdir -p "${REPO_ROOT}/.windsurf/workflows"
```

### 6d. Report Pointer Generation

After generating all pointers, print a per-editor summary:

```
📝 Editor pointers generated:
  Copilot prompts:  <count> files in .github/prompts/
  Copilot skills:   <count> files in .github/skills/
  Claude Code:      <count> files in .claude/commands/ai/
  Windsurf:         <count> files in .windsurf/workflows/
```

## Step 7: Generate `.ai/workflows.md` Index

> **Conditional:** Skip this step if `.claude/commands/` does not exist.

Generate a browsable index at `${REPO_ROOT}/.ai/workflows.md` from the discovered commands.

### 7a. Category Mapping

Use this static mapping to group commands by category. If a command is not in the map, place it under "Other".

| Category    | Commands                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Daily Flow  | `status`, `day`, `plan-feature`, `execute`, `next`, `context`, `create-prd`, `create-issue`, `onboard`, `map-codebase`, `pause-work`, `resume-work`, `quick` |
| Git         | `pull`, `commit`, `push`, `review`                                                                                                                           |
| Bug Fix     | `bug/rca`, `bug/fix`                                                                                                                                         |
| Validation  | `validate/full`, `validate/code-review`, `validate/code-review-fix`, `validate/a11y`, `validate/visual`, `verify-work`                                       |
| Testing     | `local-verification`                                                                                                                                         |
| Maintenance | `maintain/clean`                                                                                                                                             |

### 7b. Write the Index

Generate `.ai/workflows.md` with this structure:

```markdown
# Available Workflows

> **Index of all available commands.** All commands live in `.claude/commands/`.

## How to Use

All workflow files are plain Markdown in `.claude/commands/`. Any AI agent can read and follow them.

- **Claude Code:** Type `/ai/<name>` (slash commands delegate here)
- **Windsurf:** Use `/<name>` (native workflows in `.windsurf/workflows/` delegate here)
- **GitHub Copilot:** Use `#<name>` prompt shortcut or `/<name>` skill command

## <Category>

| Workflow | File                     | Description                    |
| -------- | ------------------------ | ------------------------------ |
| <name>   | `.claude/commands/<path>.md` | <description from frontmatter> |

...

## Editor Integration

Each editor has thin pointer files that delegate to the canonical `.claude/commands/` sources:

| Editor          | Pointer location       | Naming convention             | Example invocation      |
| --------------- | ---------------------- | ----------------------------- | ----------------------- |
| **Copilot**     | `.github/prompts/`     | Flat with `-` separators      | `#day`, `#commit`       |
| **Copilot**     | `.github/skills/`      | Flat with `-` separators      | `/day`, `/commit`       |
| **Claude Code** | `.claude/commands/ai/` | Mirrors `.claude/commands/` paths | `/ai/day`, `/ai/commit` |
| **Windsurf**    | `.windsurf/workflows/` | Flat with `-` separators      | `/day`, `/commit`       |

> **Rule:** Pointer files must never contain logic. They only say "Follow `.claude/commands/<path>.md` exactly."
```

### 7c. Report

```
📋 Workflow index written to .ai/workflows.md (<count> commands indexed)
```

## Step 8: Customize PR Template

> **Conditional:** Skip if neither `.github/pull_request_template.md` nor `.ai/templates/pull_request_template.md` exists, or if `PROJECT.md` was not written.

If the AI toolkit installed a PR template at `.ai/templates/pull_request_template.md`, copy it to `.github/pull_request_template.md` (if not already present) and personalize it for this project:

### 8a. Read project identity

```bash
ORG="$(grep '^- org:' PROJECT.md | sed 's/- org: //')"
REPO_SLUG="$(grep '^- repo:' PROJECT.md | sed 's/- repo: //')"
```

### 8b. Replace the Checklist heading

If the PR template contains the placeholder comment `<!-- link to your Definition of Done wiki page`:

```bash
perl -pi -e 's/^### Checklist <!-- link to your Definition of Done wiki page.*$/### [Checklist](https:\/\/github.com\/'"$ORG"'\/'"$REPO_SLUG"'\/wiki\/PR-Definition-of-Done)/' \
  "${REPO_ROOT}/.github/pull_request_template.md"
```

This turns the generic template into a project-specific one with a direct link to the wiki DoD page.

### 8c. Report

```
📝 PR template customized with project wiki link → https://github.com/<org>/<repo>/wiki/PR-Definition-of-Done
```

## Step 9: Initialize Workflow State

> **Conditional:** Skip if `.ai/templates/STATE.md` does not exist in the installed toolkit.

Check whether the project has an in-progress workflow that would benefit from state tracking:

### 9a. Detect In-Progress Work

```bash
BRANCH="$(git branch --show-current 2>/dev/null || echo '')"
UNCOMMITTED="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
HAS_PLAN="$(find . -path './.ai/plans/*.md' -not -path '*/archived/*' 2>/dev/null | head -1)"
```

Conditions that suggest in-progress work:

- Current branch is not `main` or `master` **and** has uncommitted changes or recent commits ahead of the base branch
- An active (non-archived) plan exists in `.ai/plans/`

### 9b. Offer State Initialization

If in-progress work is detected and `.ai/state/STATE.md` does **not** already exist:

> **In-progress work detected** (branch: `$BRANCH`, uncommitted files: `$UNCOMMITTED`).
> Would you like to initialize workflow state tracking? This creates `.ai/state/STATE.md` from the toolkit template.
> **[Initialize / Skip]**

- **Initialize** → Copy `.ai/templates/STATE.md` to `.ai/state/STATE.md`. Print:
  ```
  📋 Workflow state initialized at .ai/state/STATE.md — commands like pause-work and resume-work will use this to track progress.
  ```
- **Skip** → Print:
  ```
  ⏭️  Skipping state initialization. You can create .ai/state/STATE.md later when starting a workflow.
  ```

If `.ai/state/STATE.md` already exists, skip silently.

## Step 10: Post-Scaffold Activation

> **Purpose:** In a freshly scaffolded project, the AI system is installed but dormant — no state, context, or codebase map exists. This step detects a fresh project and activates the AI system automatically.

### 10a. Detect Fresh Project

```bash
MAP_FILE="${REPO_ROOT}/.ai/context/codebase-map.md"
```

A project is considered **fresh** if `.ai/context/codebase-map.md` does **not** exist.

- If the file already exists → skip this step entirely (project was previously activated).

### 10b. Create AI Directory Structure

Create the standard AI directories if they don't already exist:

```bash
mkdir -p "${REPO_ROOT}/.ai/state"
mkdir -p "${REPO_ROOT}/.ai/context"
mkdir -p "${REPO_ROOT}/.ai/plans"
mkdir -p "${REPO_ROOT}/.ai/logs"
```

> **Important:** Do not overwrite any directory or file that already exists. Only create what's missing.

### 10c. Generate Initial Codebase Map

Run the equivalent of the `map-codebase` command to produce a warm cache:

1. Read the `map-codebase` command from `.claude/commands/map-codebase.md` (if present)
2. Execute its process steps to generate `.ai/context/codebase-map.md`
3. If `.claude/commands/map-codebase.md` is not present, generate a minimal map using the detection data already collected in Steps 2a–2g

### 10d. Initialize Minimal State

If `.ai/state/STATE.md` does not already exist (Step 9 may have created it):

Copy `.ai/templates/STATE.md` to `.ai/state/STATE.md` and populate:

- **Status:** `ready`
- **Updated:** current date

### 10e. Report Activation

```
🧠 AI system activated for fresh project:
  ✅ .ai/state/      — Workflow state directory created
  ✅ .ai/context/    — Codebase map generated
  ✅ .ai/plans/      — Plans directory created
  ✅ .ai/logs/       — Logs directory created

  Run /status to see your workspace state.
  Run /ai-health to verify the full AI system health.
```

## Step 11: Announce v2 Capabilities

Print a summary of toolkit capabilities available in this installation. Detect what's present and report:

```bash
HAS_WORKFLOWS="$(find .ai/workflows -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
HAS_POLICIES="$(find .ai/policies -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
HAS_SKILLS="$(find .claude/skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
HAS_TEMPLATES="$(find .ai/templates -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
HAS_RULES="$(find .claude/skills -maxdepth 1 -name 'dugmate-*-rules' -type d 2>/dev/null | wc -l | tr -d ' ')"
```

Print the announcement only for capabilities that are present (count > 0):

```
🚀 Toolkit capabilities available:
  Workflows:   <count> multi-phase orchestrations (use plan-feature + execute for guided delivery)
  Policies:    <count> composable quality gates (enforced at phase boundaries in workflows)
  Skills:      <count> task-scoped skill bundles (loaded automatically by commands that need them)
  Templates:   <count> artifact templates (STATE.md, HANDOFF.md, BLUEPRINT.md, CAPABILITY-SPEC.md)
  Archetypes:  <count> specialist domain packs (installable expertise bundles)

  New in v2:
  • map-codebase    — Build a codebase intelligence snapshot (reused by plan-feature and execute)
  • pause-work      — Save progress to HANDOFF.md + STATE.md for cross-session continuity
  • resume-work     — Pick up where you left off using HANDOFF.md + STATE.md
  • verify-work     — Focused verification for the current task (lighter than validate/full)
  • quick           — Fast-path for trivial changes: edit → verify → commit (skip planning)
```
