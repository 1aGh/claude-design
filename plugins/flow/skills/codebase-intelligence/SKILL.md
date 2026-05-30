---
name: flow:codebase-intelligence
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

### Design artifacts

Present only when the project uses the design plugin (`<designRoot>` exists — resolve from `paths.designRoot`, default `.design`). Captures the canvas workspace so design surfaces aren't invisible to a code-only snapshot:

- **Design systems** — one line per DS (`name`, path, `(default)` marker) from `<designRoot>/config.json`.
- **Canvases** — total count, then one line per canvas: filename, its `designSystem` (or the default), declared `status` (`draft` / `in-review` / `ready-for-handoff` / `handed-off`), and `last_modified`. Canvases marked `ready-for-handoff` are the ones a `/flow:done` will offer to hand off.

Omit the whole section when `<designRoot>` is absent — the snapshot must stay clean for code-only projects.

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

### Design Artifact Scanning

Only when `<designRoot>` (default `.design`, from `paths.designRoot`) exists — **read-only**:

```bash
DESIGN_ROOT=$(jq -r '.paths.designRoot // ".design"' .ai/workflows.config.json 2>/dev/null || echo ".design")
if [ -d "$DESIGN_ROOT" ]; then
  # Design systems (name + default marker)
  jq -r '.defaultDesignSystem as $d | .designSystems[]? | "\(.name)\(if .name==$d then " (default)" else "" end)"' "$DESIGN_ROOT/config.json" 2>/dev/null
  # Canvases: one line per sidecar (format-agnostic — sidecars, not .tsx/.html)
  find "$DESIGN_ROOT" -name '*.meta.json' -not -path '*/_history/*' 2>/dev/null | while IFS= read -r m; do
    jq -r '"\(input_filename | sub(".*/";"") | sub(".meta.json";".tsx")) (DS: \(.designSystem // "default"), status: \(.status // "draft"), last edit: \(.last_modified // "?" | sub("T.*";"")))"' "$m" 2>/dev/null
  done
fi
```

Counts and the default-DS fall-back keep the section honest on sidecars that predate the `status`/`designSystem`/`tags` fields (older canvases simply show `draft` / `default`).

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

## Sidecar cache freshness gate (Phase C / DDR-061)

The date/file-count heuristics above are fuzzy. The sidecar cache adds a **deterministic** freshness signal: key a `codebase-intelligence` cache entry on the repo's content SHA so a consumer can confirm "the map reflects the exact current tree" in one cheap check, and skip rescanning entirely when nothing changed.

Access the cache through the **`maude` CLI** (`maude cache get/put`) — a declared plugin dependency, always on PATH. Don't reach `cli/lib/cache.mjs` by relative path: the marketplace copies each plugin alone, so the repo's `cli/` isn't beside it (DDR-061). The cache root resolves automatically to `$CLAUDE_PROJECT_DIR/.ai/cache`.

**Content key** — committed HEAD plus working-tree dirtiness, so an uncommitted edit invalidates too:

```sh
FILES_SHA=$( { git rev-parse HEAD 2>/dev/null; git status --porcelain 2>/dev/null; } | git hash-object --stdin | cut -c1-12 )
```

**Check before rescanning** (used by `/flow:plan` and `/flow:utils-verify`). `maude cache get` prints the value on a hit (exit 0) and is silent on miss (exit 1):

```sh
MAP_HIT=$(maude cache get codebase-intelligence "$FILES_SHA")
```

If `$MAP_HIT` is non-empty, its `mapPath` (`.ai/context/codebase-map.md`) already reflects this exact tree — **read it, skip the rescan**. If empty, (re)generate the map per the schema above, then record the new key:

```sh
printf '{"mapPath":".ai/context/codebase-map.md","generatedAt":"%s"}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | maude cache put codebase-intelligence "$FILES_SHA"
```

This layer is **committed** (SHA-keyed, shareable across collaborators — see `.gitignore`), so a teammate on the same commit gets the freshness hit without rescanning. Correctness is automatic: the content SHA changes whenever any tracked file changes, so a stale map can never produce a hit.

## Integration

### How Other Commands Consume the Snapshot

Commands that benefit from codebase context should:

1. Compute `FILES_SHA` and run the sidecar-cache check (above). On a hit, the map reflects the current tree — read it and skip any freshness re-analysis.
2. On a miss, check if `.ai/context/codebase-map.md` exists; if it does, read the relevant sections, then refresh it and record the new `FILES_SHA` key.
3. If the map doesn't exist at all, either:
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
