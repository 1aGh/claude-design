---
name: codebase-intelligence
type: skill
description: "Produce and maintain structured codebase context snapshots. Use when an agent needs to understand a codebase quickly or when existing context is stale."
keywords:
  [codebase, map, architecture, context, snapshot, analysis, intelligence]
---

# Codebase Intelligence

Teaches agents how to produce and maintain persistent codebase context snapshots that survive across sessions. Instead of re-discovering the repo from scratch every time, this skill produces a structured `.ai/context/codebase-map.md` that other commands and agents can read instantly.

## When to Use This Skill

- **First session in a repo** — no existing context; need to build understanding fast
- **After major refactors** — directory structure or architecture has changed
- **When planning features in unfamiliar areas** — need project-wide context for impact analysis
- **When context is stale** — existing snapshot is >7 days old or doesn't reflect recent changes
- **When another command references codebase context** — `plan-feature`, `execute`, `verify-work`, `review` all benefit from a cached snapshot

## Snapshot Schema

The output file `.ai/context/codebase-map.md` must contain these sections:

### Identity

| Field   | Description                                               |
| ------- | --------------------------------------------------------- |
| Project | Human-readable project name (from CLAUDE.md or repo name) |
| Repo    | `org/repo` identifier                                     |
| Type    | `monorepo` or `single-repo`                               |

### Stack

| Field           | Description                                          |
| --------------- | ---------------------------------------------------- |
| Language        | Primary language(s) detected                         |
| Framework       | Major frameworks (Next.js, Express, Angular, etc.)   |
| Build tool      | Turborepo, Vite, Webpack, tsc, etc.                  |
| Package manager | pnpm, yarn, or npm (from lock file)                  |
| Runtime         | Node version, Deno, Bun, etc. (from .nvmrc, engines) |

### Architecture

- Annotated directory tree (top 3 levels)
- For monorepos: table of packages/apps with paths and purposes

### Key Files

Table of important files and their roles (entry points, configs, CI, docs, types).

### Conventions

- File naming pattern (kebab-case, camelCase, PascalCase)
- Import style (absolute `@/` vs relative `../`)
- Test pattern (colocated, `__tests__/`, `*.test.ts`)
- Commit style (conventional, freeform, squash)
- Linting (eslint, biome, prettier config)

### Test Surface

- Test runner and its config file
- Whether coverage is configured
- Approximate test file count

### CI/CD

Table of CI workflows, their triggers, and purposes.

### Constraints

Hard rules extracted from `CLAUDE.md`:

- Prohibited packages
- Required conventions
- Branching rules
- Legal restrictions

## Analysis Techniques

### Directory Scanning

```bash
find . -maxdepth 3 -type d \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.next/*' \
  -not -path '*/coverage/*' \
  | sort
```

Annotate directories with their purpose based on naming convention:

- `src/`, `lib/` → source code
- `test/`, `tests/`, `__tests__/` → test files
- `docs/` → documentation
- `scripts/` → build/dev scripts
- `config/` → configuration

### Package.json Parsing

Extract from `package.json`:

- `dependencies` / `devDependencies` → framework detection
- `scripts` → available commands
- `engines` → runtime requirements
- `workspaces` → monorepo packages

### Config File Detection

Check for the presence of:

| Category   | Files to Check                                               |
| ---------- | ------------------------------------------------------------ |
| TypeScript | `tsconfig.json`, `tsconfig.*.json`                           |
| Linting    | `eslint.config.*`, `.eslintrc.*`, `biome.json`               |
| Testing    | `vitest.config.*`, `jest.config.*`, `.mocharc.*`             |
| Bundler    | `vite.config.*`, `next.config.*`, `webpack.config.*`         |
| CI         | `.github/workflows/*.yml`, `.gitlab-ci.yml`                  |
| Formatting | `prettier.config.*`, `.prettierrc*`                          |
| Monorepo   | `turbo.json`, `nx.json`, `lerna.json`, `pnpm-workspace.yaml` |

### Test Runner Detection

Priority order:

1. `vitest.config.*` exists → vitest
2. `jest.config.*` exists → jest
3. Check `devDependencies` in `package.json`
4. Check `scripts.test` in `package.json` for runner name

### CI Workflow Detection

Read `.github/workflows/*.yml` files, extract:

- `name` field
- `on` triggers (push, PR, schedule, dispatch)
- Key `steps` to determine purpose

## Monorepo Handling

### Detection

A project is a monorepo if any of these exist:

- `pnpm-workspace.yaml` (pnpm workspaces)
- `packages` field in root `package.json` (npm/yarn workspaces)
- `turbo.json` (Turborepo)
- `nx.json` (Nx)
- `lerna.json` (Lerna)

### Enumeration

For pnpm workspaces, parse `pnpm-workspace.yaml` to get package globs, then resolve to actual directories:

```bash
# List all packages
find packages/ apps/ -maxdepth 1 -mindepth 1 -type d | sort
```

For each package, read its `package.json` to get:

- Package name
- Version
- Whether it's published (`private: true` means not published)

### Workspace Protocol

Note the use of `workspace:*` for internal dependencies — this affects how builds and installs work.

## Staleness

A snapshot should be refreshed when:

- **File count changed by >20%** — significant structural change
- **Dependencies changed** — major version bumps or new dependencies
- **New app/package added** — monorepo structure changed
- **Snapshot >7 days old** — general staleness threshold
- **CI configuration changed** — workflow modifications

Staleness detection: compare the `Last updated` timestamp in the snapshot header against the current date.

## Integration

### How Other Commands Consume the Snapshot

Commands that benefit from codebase context should:

1. Check if `.ai/context/codebase-map.md` exists
2. If it does, read the relevant sections (don't re-analyze)
3. If it doesn't, either:
   - Suggest running `/flow:setup-codebase-map` first
   - Fall back to ad-hoc analysis (slower but functional)

### Commands That Read the Snapshot

| Command      | Sections Used                               |
| ------------ | ------------------------------------------- |
| plan-feature | Architecture, Stack, Key Files, Constraints |
| execute      | Stack, Conventions, Test Surface            |
| verify-work  | Test Surface, CI/CD                         |
| review       | Constraints, Conventions                    |
| context      | All sections (supplements live analysis)    |
