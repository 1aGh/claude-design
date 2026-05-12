---
name: onboard
type: command
description: Scaffold the .ai/ workspace, auto-detect project stack, populate workflows.config.json, and ensure CLAUDE.md exists (via /init).
keywords: [init, setup, onboard, project, configure, bootstrap, scaffold, workspace, mdcc, claude.md]
---

# /flow:onboard — Bootstrap the flow workspace

Sets up everything the `flow` plugin needs to operate on a new (or existing) repo. Does **not** duplicate Claude Code's built-in `/init` — defers to it for `CLAUDE.md`. Owns three things:

1. The `.ai/` second-brain workspace skeleton (scaffolded via `mdcc init`).
2. Populating `.ai/workflows.config.json` with detected stack values.
3. Recommending `/init` for `CLAUDE.md` if missing.

## Pre-Flight A: `mdcc` CLI available?

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if command -v mdcc &>/dev/null; then
  MDCC_AVAILABLE=true
  MDCC_VERSION="$(mdcc --version 2>/dev/null || echo 'unknown')"
else
  MDCC_AVAILABLE=false
fi
```

- **Available** → `> Found mdcc ($MDCC_VERSION). Will scaffold .ai/ in Step 1.`
- **Missing** → `> mdcc not on PATH. Run \`npm i -g md-claude\` then re-run /flow:onboard. Continuing in degraded mode — config-file population in Step 3 will be manual.`

## Pre-Flight B: `CLAUDE.md` exists?

```bash
if [[ -f "$REPO_ROOT/CLAUDE.md" || -f "$REPO_ROOT/.claude/CLAUDE.md" ]]; then
  CLAUDE_MD_EXISTS=true
else
  CLAUDE_MD_EXISTS=false
fi
```

- **Exists** → continue, will note it in Step 4 report.
- **Missing** → at end of flow, prompt the user to run Anthropic's built-in `/init` (it analyzes the codebase and writes a `<200`-line `CLAUDE.md` tailored to the stack). **Don't** try to generate `CLAUDE.md` from here — that's `/init`'s job. We'd just duplicate it badly.

## Step 1: Scaffold `.ai/` via `mdcc init`

> Skip if `MDCC_AVAILABLE=false`. Also skip silently if `.ai/workflows.config.json` already exists (idempotent — assume previous onboard handled it; Step 3 will still propagate fresh detected values).

Detect project name (user can override later):

```bash
PRE_NAME="$(basename "$REPO_ROOT")"
```

Run:

```bash
mdcc init --name "$PRE_NAME"
```

After this:

- `.ai/` has every subfolder (`plans/`, `decisions/`, `reviews/`, `scenarios/`, `logs/`, `context/`, `business/`, `docs/`, `state/`, `templates/`, …).
- `.ai/workflows.config.json` exists with sensible defaults and `name: "$PRE_NAME"`.

## Step 2: Auto-detect the stack

Run detection — collect into shell variables for Step 3.

```bash
# Identity
REMOTE_URL="$(git remote get-url origin 2>/dev/null || echo '')"
ORG="$(echo "$REMOTE_URL" | sed 's|.*github.com[:/]||;s|/.*||')"
REPO_NAME="$(echo "$REMOTE_URL" | sed 's|.*github.com[:/]||;s|\.git$||;s|.*/||')"

# Package manager
if   [[ -f "$REPO_ROOT/pnpm-lock.yaml" ]];    then PM="pnpm"
elif [[ -f "$REPO_ROOT/yarn.lock" ]];          then PM="yarn"
elif [[ -f "$REPO_ROOT/package-lock.json" ]];  then PM="npm"
elif [[ -f "$REPO_ROOT/Cargo.toml" ]];         then PM="cargo"
elif [[ -f "$REPO_ROOT/go.mod" ]];             then PM="go"
elif [[ -f "$REPO_ROOT/pyproject.toml" || -f "$REPO_ROOT/requirements.txt" ]]; then PM="pip"
elif [[ -f "$REPO_ROOT/pom.xml" ]];            then PM="maven"
elif [[ -f "$REPO_ROOT/build.gradle" || -f "$REPO_ROOT/build.gradle.kts" ]]; then PM="gradle"
else PM="unknown"
fi

# Language
if   [[ -f "$REPO_ROOT/tsconfig.json" ]];      then LANG="typescript"
elif [[ -f "$REPO_ROOT/Cargo.toml" ]];         then LANG="rust"
elif [[ -f "$REPO_ROOT/go.mod" ]];             then LANG="go"
elif [[ -f "$REPO_ROOT/pyproject.toml" || -f "$REPO_ROOT/requirements.txt" ]]; then LANG="python"
elif [[ -f "$REPO_ROOT/pom.xml" || -f "$REPO_ROOT/build.gradle" || -f "$REPO_ROOT/build.gradle.kts" ]]; then LANG="java"
elif [[ -f "$REPO_ROOT/package.json" ]];       then LANG="javascript"
else LANG="unknown"
fi

# Framework heuristic
FRAMEWORK="unknown"
[[ -f "$REPO_ROOT/next.config.js" || -f "$REPO_ROOT/next.config.ts" || -f "$REPO_ROOT/next.config.mjs" ]] && FRAMEWORK="next.js"
[[ -f "$REPO_ROOT/vite.config.js" || -f "$REPO_ROOT/vite.config.ts" ]] && FRAMEWORK="vite"
[[ -f "$REPO_ROOT/app.json" || -f "$REPO_ROOT/app.config.js" || -f "$REPO_ROOT/app.config.ts" ]] && FRAMEWORK="expo"
[[ -f "$REPO_ROOT/svelte.config.js" ]] && FRAMEWORK="sveltekit"
[[ -f "$REPO_ROOT/remix.config.js" ]] && FRAMEWORK="remix"
[[ -f "$REPO_ROOT/astro.config.mjs" ]] && FRAMEWORK="astro"
[[ -f "$REPO_ROOT/nuxt.config.ts" || -f "$REPO_ROOT/nuxt.config.js" ]] && FRAMEWORK="nuxt"

# Monorepo + build tool
MONOREPO="false"
BUILD_TOOL="none"
if   [[ -f "$REPO_ROOT/turbo.json" ]];           then MONOREPO="true"; BUILD_TOOL="turbo"
elif [[ -f "$REPO_ROOT/nx.json" ]];              then MONOREPO="true"; BUILD_TOOL="nx"
elif [[ -f "$REPO_ROOT/lerna.json" ]];           then MONOREPO="true"; BUILD_TOOL="lerna"
elif [[ -f "$REPO_ROOT/rush.json" ]];            then MONOREPO="true"; BUILD_TOOL="rush"
elif [[ -f "$REPO_ROOT/pnpm-workspace.yaml" ]];  then MONOREPO="true"
elif [[ -f "$REPO_ROOT/Makefile" ]];             then BUILD_TOOL="make"
elif [[ -f "$REPO_ROOT/BUILD.bazel" || -f "$REPO_ROOT/WORKSPACE" ]]; then BUILD_TOOL="bazel"
fi

# CI
if   [[ -d "$REPO_ROOT/.github/workflows" ]];   then CI="github-actions"
elif [[ -f "$REPO_ROOT/.gitlab-ci.yml" ]];      then CI="gitlab-ci"
elif [[ -f "$REPO_ROOT/Jenkinsfile" ]];         then CI="jenkins"
elif [[ -f "$REPO_ROOT/azure-pipelines.yml" ]]; then CI="azure-devops"
elif [[ -f "$REPO_ROOT/.circleci/config.yml" ]]; then CI="circleci"
elif [[ -f "$REPO_ROOT/bitbucket-pipelines.yml" ]]; then CI="bitbucket"
else CI="unknown"
fi

# Test runner — read from package.json devDependencies if present
TESTS="unknown"
if [[ -f "$REPO_ROOT/package.json" ]]; then
  if   grep -q '"vitest"'      "$REPO_ROOT/package.json"; then TESTS="vitest"
  elif grep -q '"jest"'        "$REPO_ROOT/package.json"; then TESTS="jest"
  elif grep -q '"@playwright/test"' "$REPO_ROOT/package.json"; then TESTS="playwright"
  elif grep -q '"cypress"'     "$REPO_ROOT/package.json"; then TESTS="cypress"
  fi
fi
[[ -f "$REPO_ROOT/go.mod" ]]     && TESTS="go-test"
[[ -f "$REPO_ROOT/Cargo.toml" ]] && TESTS="cargo-test"
[[ -f "$REPO_ROOT/pytest.ini" || -f "$REPO_ROOT/pyproject.toml" ]] && grep -q "pytest" "$REPO_ROOT/pyproject.toml" 2>/dev/null && TESTS="pytest"

# CSS approach
CSS="unknown"
if [[ -f "$REPO_ROOT/package.json" ]]; then
  if   grep -q '"tailwindcss"' "$REPO_ROOT/package.json"; then CSS="tailwind"
  elif grep -q '"styled-components"' "$REPO_ROOT/package.json"; then CSS="styled-components"
  elif grep -q '"@emotion/' "$REPO_ROOT/package.json"; then CSS="emotion"
  elif grep -q '"@vanilla-extract/' "$REPO_ROOT/package.json"; then CSS="vanilla-extract"
  elif [[ -f "$REPO_ROOT/postcss.config.js" || -f "$REPO_ROOT/postcss.config.cjs" ]]; then CSS="css-modules"
  fi
fi

# Router (web framework dependent)
ROUTER="unknown"
case "$FRAMEWORK" in
  next.js)   [[ -d "$REPO_ROOT/app" || -d "$REPO_ROOT/src/app" ]] && ROUTER="next-app" || ROUTER="next-pages" ;;
  remix)     ROUTER="react-router" ;;
  sveltekit) ROUTER="sveltekit-router" ;;
  expo)      ROUTER="expo-router" ;;
esac
[[ "$ROUTER" == "unknown" && -f "$REPO_ROOT/package.json" ]] && grep -q '"@tanstack/router' "$REPO_ROOT/package.json" && ROUTER="tanstack-router"
[[ "$ROUTER" == "unknown" && -f "$REPO_ROOT/package.json" ]] && grep -q '"react-router' "$REPO_ROOT/package.json" && ROUTER="react-router"

# Commit convention
COMMITS="conventional"
ls "$REPO_ROOT"/commitlint.config.* &>/dev/null || COMMITS="free-form"
[[ -f "$REPO_ROOT/.gitmoji-changelogrc" ]] && COMMITS="gitmoji"

# Tracker hint — does this repo have a GitHub remote?
TRACKER_HINT="none"
[[ "$REMOTE_URL" == *github.com* ]] && TRACKER_HINT="github"
```

## Step 2b: Resolve tech-stack skills

> Runs **after** auto-detect (Step 2) so the detected stack is the input — and **before** we propagate values to `workflows.config.json` (Step 4), so any decisions captured there can lean on real library knowledge.

Invoke `Skill(flow:skill-loader)` with the detected stack as input (framework, language, ORM, CSS approach, plus any non-trivial dependency from `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`). The skill will:

1. Diff each material dependency against skills already loaded in this session.
2. For each gap, fetch the matching skill via the `terminal-skills` MCP (or fall back to WebFetch on official docs).
3. Persist the resolved set in `.ai/state/STATE.md` so future sessions in this repo don't re-resolve.

Onboarding is the one-shot moment to do this thoroughly — every later command (`/flow:plan`, `/flow:execute`) only patches gaps incrementally.

## Step 3: Ask only what we can't auto-detect

Ask for these — everything else has a sensible auto-detected or default value:

**Always ask:**

1. **Project name** (kebab-case, pre-filled with `$PRE_NAME`).
2. **Language for plan / DDR prose** (`en` | `cs` | other ISO 639-1). Pre-fill `en`.
3. **Theme target** — `dark` | `light` | `agnostic`. Pre-fill `agnostic`.
4. **Tracker provider** — pre-fill with `$TRACKER_HINT`. Options: `github` | `clickup` | `linear` | `jira` | `notion` | `asana` | `shortcut` | `none`.
5. **Branching model** — `github-flow` | `trunk-based` | `gitflow` | `release-branch`. Can't be reliably auto-detected; pre-fill `github-flow` as the most common.
6. **Prohibited packages / libraries** — comma-separated list, or `none`. Example: `lodash` (we use native ES), `moment` (we use date-fns), `axios` (we use fetch).

**Ask only when detection failed (`unknown`):**

- Framework (only if `$FRAMEWORK="unknown"`)
- Language (only if `$LANG="unknown"`)
- Test runner (only if `$TESTS="unknown"`)
- CSS approach (only if `$CSS="unknown"` and the project ships UI)

For everything else (boundaries, motion ceilings, density map, bilingual, breakpoints, …) — leave defaults. The user tunes later via `mdcc config set` once the project shape clarifies.

## Step 4: Propagate detected + answered values to `workflows.config.json`

> Skip if `MDCC_AVAILABLE=false`.

### 4a. Identity & top-level

```bash
mdcc config set name "$ANSWER_NAME"
mdcc config set language "$ANSWER_LANGUAGE"
mdcc config set theme "$ANSWER_THEME"
mdcc config set integrations.tracker.provider "$ANSWER_TRACKER"
```

### 4b. Stack snapshot

```bash
mdcc config set stack.language       "$LANG"
mdcc config set stack.framework      "$FRAMEWORK"
mdcc config set stack.packageManager "$PM"
mdcc config set stack.buildTool      "$BUILD_TOOL"
mdcc config set stack.monorepo       "$MONOREPO"
mdcc config set stack.ci             "$CI"
mdcc config set stack.tests          "$TESTS"
mdcc config set stack.css            "$CSS"
mdcc config set stack.router         "$ROUTER"
```

> `$MONOREPO` is `"true"`/`"false"` (string). The config setter parses `JSON.parse` so it stores as a boolean.

### 4c. Conventions

```bash
mdcc config set conventions.branchingModel "$ANSWER_BRANCHING"
mdcc config set conventions.commits        "$COMMITS"
mdcc config set conventions.prohibited     '<json-array-from-answer>'   # e.g. '["lodash","moment"]'
```

### 4d. Platforms (inferred from framework)

| Framework | Inferred `platforms` |
| --------- | --------------------- |
| `next.js` / `vite` / `remix` / `sveltekit` / `astro` / `nuxt` | `["web-desktop", "web-mobile"]` |
| `expo` | `["ios-phone", "android-phone"]` |
| `expo` + web framework in same repo (monorepo with both signals) | `["web-desktop", "web-mobile", "ios-phone", "android-phone"]` |
| API-only (Spring Boot / Django / Rails / Express alone) | `[]` |
| `unknown` | `["web-desktop"]` (safe default) |

```bash
mdcc config set platforms '<inferred-json-array>'
```

If the framework is `expo`, also try to pluck `bundleIdPrefix` from `app.json` / `app.config.*`:

```bash
# Example: extract "com.acme.app" → "com.acme"
BUNDLE_ID="$(jq -r '.expo.ios.bundleIdentifier // .expo.android.package // empty' "$REPO_ROOT/app.json" 2>/dev/null)"
if [[ -n "$BUNDLE_ID" ]]; then
  PREFIX="$(echo "$BUNDLE_ID" | awk -F. 'NF>=2 {OFS="."; NF--; print}')"
  mdcc config set bundleIdPrefix "$PREFIX"
fi
```

### 4e. What we DON'T touch

- `motion`, `responsive.densityMap`, `responsive.breakpoints`, `boundaries`, `ux`, `skills` — these are intentional choices the user makes after the project starts taking shape. Plugin skills work with defaults until the user tunes them.
- `paths.prd` / `paths.designSystem` — derived from `name` at command-read time; no need to write explicitly.

## Step 5: CLAUDE.md handoff

> If `CLAUDE_MD_EXISTS=true`, skip the prompt and note in the report. If `false`, prompt:

> **No `CLAUDE.md` found. Run `/init` (Anthropic's built-in) — it analyzes the codebase and writes a tailored `<200`-line `CLAUDE.md` with build commands, test instructions, and conventions. After it finishes, re-run `/flow:status` to confirm everything wired together.**
>
> Optional: set `CLAUDE_CODE_NEW_INIT=1` before launching for the interactive multi-phase flow (asks about skills and hooks too).
>
> For path-scoped rules (per file-type guidance like "frontend tests must mock the API"), use `.claude/rules/*.md` with `paths:` frontmatter. See Anthropic's docs on memory.

## Step 6: Report

```
✓ /flow:onboard complete

Workspace
  .ai/ skeleton:               <scaffolded | already present | skipped (no mdcc)>
  .ai/workflows.config.json:   <created | updated | skipped>

Identity
  name:                        $ANSWER_NAME
  language:                    $ANSWER_LANGUAGE
  theme:                       $ANSWER_THEME
  platforms:                   $INFERRED_PLATFORMS
  bundleIdPrefix:              $PREFIX (if applicable)

Stack snapshot
  language:                    $LANG
  framework:                   $FRAMEWORK
  package manager:             $PM
  build tool:                  $BUILD_TOOL
  monorepo:                    $MONOREPO
  CI:                          $CI
  tests:                       $TESTS
  CSS:                         $CSS
  router:                      $ROUTER

Conventions
  branching:                   $ANSWER_BRANCHING
  commits:                     $COMMITS
  prohibited:                  $ANSWER_PROHIBITED (or 'none')

Integrations
  tracker.provider:            $ANSWER_TRACKER
  (configure mcp + defaults via `mdcc config set integrations.tracker.*`)

CLAUDE.md
  status:                      <present at <path> | missing — run /init>

Next steps
  1. <if CLAUDE.md missing> Run /init to generate CLAUDE.md tailored to this stack.
  2. Create .ai/$ANSWER_NAME-prd.md with your product brief.
  3. (Optional) Create .ai/$ANSWER_NAME-design-system.md.
  4. /flow:status — see where you are.
  5. /flow:plan <feature> — start working.
```

## Notes for plugin authors

- The CLAUDE.md handoff is intentional. `/init` is the canonical Anthropic command for generating `CLAUDE.md`, and reimplementing it here would drift. If the Anthropic team adds capabilities to `/init`, we automatically benefit by deferring.
- The split between `CLAUDE.md` (prose, auto-loaded) and `.ai/workflows.config.json` (structured, on-demand) follows Anthropic's guidance: `CLAUDE.md` for facts every session needs; structured machine-readable config for command-specific lookups.
- For project-level rules that don't need to be in every session (e.g. "frontend components must use shadcn/ui"), use `.claude/rules/<topic>.md` with `paths:` frontmatter — Anthropic's path-scoped rules system loads them only when relevant.
- This command is idempotent. Safe to re-run. Each step skips work if it's already done.
