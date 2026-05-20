---
name: flow:init
category: setup
type: command
description: Scaffold the .ai/ workspace, auto-detect project stack, populate workflows.config.json, and ensure CLAUDE.md exists (via /init).
keywords: [init, setup, onboard, project, configure, bootstrap, scaffold, workspace, mdcc, claude.md]
---

# /flow:init — Bootstrap the flow workspace

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
- **Missing** → `> mdcc not on PATH. Run \`npm i -g md-claude\` then re-run /flow:init. Continuing in degraded mode — config-file population in Step 3 will be manual.`

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

# Changelog provider hint — auto-detect from filesystem markers.
# Order matters: most specific marker wins.
CHANGELOG_PROVIDER="none"
[[ -f "$REPO_ROOT/.changeset/config.json" ]] && CHANGELOG_PROVIDER="changesets"
[[ "$CHANGELOG_PROVIDER" == "none" && ( -f "$REPO_ROOT/cliff.toml" || -f "$REPO_ROOT/.git-cliff.toml" ) ]] && CHANGELOG_PROVIDER="git-cliff"
[[ "$CHANGELOG_PROVIDER" == "none" && "$COMMITS" == "conventional" && -f "$REPO_ROOT/CHANGELOG.md" ]] && CHANGELOG_PROVIDER="conventional"
```

## Step 2b: Resolve tech-stack skills

> Runs **after** auto-detect (Step 2) so the detected stack is the input — and **before** we propagate values to `workflows.config.json` (Step 4), so any decisions captured there can lean on real library knowledge.

Invoke `Skill(flow:skill-loader)` with the detected stack as input (framework, language, ORM, CSS approach, plus any non-trivial dependency from `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`). The skill will:

1. Diff each material dependency against skills already loaded in this session.
2. For each gap, fetch the matching skill via the `terminal-skills` MCP (or fall back to WebFetch on official docs).
3. Persist the resolved set in `.ai/state/STATE.md` so future sessions in this repo don't re-resolve.

Onboarding is the one-shot moment to do this thoroughly — every later command (`/flow:plan`, `/flow:execute`) only patches gaps incrementally.

## Step 2c: Test runner recommendation (when detection failed)

> Runs only when `$TESTS == "unknown"` **and** the repo has source files (i.e. not a fresh empty repo). Skip otherwise — `/flow:init` doesn't scaffold runners, only surfaces the gap.

The flow plugin assumes a working test command exists — `/flow:utils-verify`, `/flow:validate`, and the testing-rules iron law all depend on it. When detection turns up nothing, surface a stack-appropriate recommendation **before** Step 3 asks the user, so the question has a real default to pre-fill:

```bash
TESTS_RECOMMENDED=""
TESTS_RUNNER_HINT=""

if [[ "$TESTS" == "unknown" ]]; then
  case "$LANG" in
    typescript|javascript)
      case "$FRAMEWORK" in
        next.js|remix|sveltekit|nuxt|astro) TESTS_RECOMMENDED="vitest"
          TESTS_RUNNER_HINT="vitest (fast, ESM-native, plays well with $FRAMEWORK) — install: $PM add -D vitest @vitest/coverage-v8" ;;
        expo)                                TESTS_RECOMMENDED="jest"
          TESTS_RUNNER_HINT="jest with jest-expo preset — install: $PM add -D jest jest-expo @testing-library/react-native" ;;
        vite)                                TESTS_RECOMMENDED="vitest"
          TESTS_RUNNER_HINT="vitest (native Vite integration) — install: $PM add -D vitest" ;;
        *)                                   TESTS_RECOMMENDED="vitest"
          TESTS_RUNNER_HINT="vitest is the modern default; jest if you need React Native or legacy compatibility" ;;
      esac ;;
    python)   TESTS_RECOMMENDED="pytest"
              TESTS_RUNNER_HINT="pytest with pytest-cov — install: pip install pytest pytest-cov (or add to pyproject.toml)" ;;
    go)       TESTS_RECOMMENDED="go-test"
              TESTS_RUNNER_HINT="built-in: \`go test ./...\` — no install needed; add -coverprofile for coverage" ;;
    rust)     TESTS_RECOMMENDED="cargo-test"
              TESTS_RUNNER_HINT="built-in: \`cargo test\` — no install needed" ;;
    java|kotlin) TESTS_RECOMMENDED="junit"
                 TESTS_RUNNER_HINT="JUnit 5 (Jupiter) — add via $BUILD_TOOL config" ;;
    *)        TESTS_RECOMMENDED="none"
              TESTS_RUNNER_HINT="No stack-specific recommendation — pick a runner that matches your language" ;;
  esac
fi
```

Print a one-line nudge — **never auto-install, never scaffold a config file**:

```
⚠ No test runner detected. flow:utils-verify and flow:validate both assume one exists.
  Recommendation for $LANG/$FRAMEWORK: $TESTS_RUNNER_HINT
  Step 3 will let you confirm or pick a different runner. To skip the gate entirely, answer `none`
  (flow:testing-rules will be effectively inert until a runner is added).
```

This is intentionally a recommendation, not a scaffold. Test runner choice is opinionated per project (vitest vs jest, pytest vs unittest, …) and per team. The plugin's job here is to make the absence visible, not to pick for them.

Ask for these — everything else has a sensible auto-detected or default value:

**Always ask:**

1. **Project name** (kebab-case, pre-filled with `$PRE_NAME`).
2. **Language for plan / DDR prose** (`en` | `cs` | other ISO 639-1). Pre-fill `en`.
3. **Theme target** — `dark` | `light` | `agnostic`. Pre-fill `agnostic`.
4. **Tracker provider** — pre-fill with `$TRACKER_HINT`. Options: `github` | `clickup` | `linear` | `jira` | `notion` | `asana` | `shortcut` | `none`.
5. **Branching model** — `github-flow` | `trunk-based` | `gitflow` | `release-branch`. Can't be reliably auto-detected; pre-fill `github-flow` as the most common.
6. **Prohibited packages / libraries** — comma-separated list, or `none`. Example: `lodash` (we use native ES), `moment` (we use date-fns), `axios` (we use fetch).
7. **Changelog provider** — pre-fill with `$CHANGELOG_PROVIDER`. Options: `changesets` | `git-cliff` | `conventional` | `custom` | `none`. Auto-detected from `.changeset/config.json` (changesets), `cliff.toml` / `.git-cliff.toml` (git-cliff), or `CHANGELOG.md` + conventional commits (conventional). If the monorepo signals at Step 2 are true (`$MONOREPO == "true"`), also ask for an optional **package scope** (e.g. `@1agh/md-claude`) — passed to `/flow:release-changelog` when authoring entries.

**Ask only when detection failed (`unknown`):**

- Framework (only if `$FRAMEWORK="unknown"`)
- Language (only if `$LANG="unknown"`)
- Test runner (only if `$TESTS="unknown"`) — pre-fill with `$TESTS_RECOMMENDED` from Step 2c, include `$TESTS_RUNNER_HINT` as the question subtitle so the user has install context inline. Accept `none` as a valid answer (records the gap; downstream gates degrade gracefully).
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
mdcc config set integrations.changelog.provider "$ANSWER_CHANGELOG"
mdcc config set integrations.changelog.releaseGuide ".ai/release-guide.md"
[[ -n "$ANSWER_CHANGELOG_SCOPE" ]] && mdcc config set integrations.changelog.scope "$ANSWER_CHANGELOG_SCOPE"
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

### 4f. Scaffold the release runbook

If `$ANSWER_CHANGELOG != "none"` and `.ai/release-guide.md` doesn't already exist, the runbook was already scaffolded by `mdcc init` in Step 1 (when invoked with `--provider`). If Step 1 ran without `--provider` (legacy path), re-emit it now:

```bash
if [[ "$ANSWER_CHANGELOG" != "none" && ! -f "$REPO_ROOT/.ai/release-guide.md" ]]; then
  mdcc init --name "$ANSWER_NAME" --provider "$ANSWER_CHANGELOG" --force
fi
```

If `$ANSWER_CHANGELOG == "none"` and no runbook exists, **skip** — the user can re-run `/flow:init` later (or create the file manually) once they pick a provider. Leave a one-line note in the Step 6 report so the gap is visible.

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
✓ /flow:init complete

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
  tests:                       $TESTS  (recommended on detect-fail: $TESTS_RECOMMENDED)
  CSS:                         $CSS
  router:                      $ROUTER

Conventions
  branching:                   $ANSWER_BRANCHING
  commits:                     $COMMITS
  prohibited:                  $ANSWER_PROHIBITED (or 'none')

Integrations
  tracker.provider:            $ANSWER_TRACKER
  changelog.provider:          $ANSWER_CHANGELOG
  changelog.scope:             $ANSWER_CHANGELOG_SCOPE (if monorepo)
  release-guide:               .ai/release-guide.md <scaffolded | skipped (provider = none)>
  (configure mcp + defaults via `mdcc config set integrations.<key>.*`)

CLAUDE.md
  status:                      <present at <path> | missing — run /init>

Next steps
  1. <if CLAUDE.md missing> Run /init to generate CLAUDE.md tailored to this stack.
  2. <if $ANSWER_TESTS == "none" and repo has source> Install a test runner — recommendation from Step 2c: $TESTS_RUNNER_HINT. Without one, /flow:utils-verify and /flow:validate skip their test gates.
  3. <if repo has source and $TESTS != "none"> (Optional) Spawn the `flow:test-coverage` subagent in `path <critical-dir>` mode — establish a baseline gap report for legacy untested code.
  4. Create .ai/$ANSWER_NAME-prd.md with your product brief.
  5. (Optional) Create .ai/$ANSWER_NAME-design-system.md.
  6. /flow:status — see where you are.
  7. /flow:plan <feature> — start working.
```

## Notes for plugin authors

- The CLAUDE.md handoff is intentional. `/init` is the canonical Anthropic command for generating `CLAUDE.md`, and reimplementing it here would drift. If the Anthropic team adds capabilities to `/init`, we automatically benefit by deferring.
- The split between `CLAUDE.md` (prose, auto-loaded) and `.ai/workflows.config.json` (structured, on-demand) follows Anthropic's guidance: `CLAUDE.md` for facts every session needs; structured machine-readable config for command-specific lookups.
- For project-level rules that don't need to be in every session (e.g. "frontend components must use shadcn/ui"), use `.claude/rules/<topic>.md` with `paths:` frontmatter — Anthropic's path-scoped rules system loads them only when relevant.
- This command is idempotent. Safe to re-run. Each step skips work if it's already done.
