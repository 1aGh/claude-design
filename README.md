# md-claude — Claude Code marketplace

A personal marketplace of Claude Code plugins. Two plugins today, plus an `mdcc` CLI for scaffolding and running the bundled dev tooling.

> **📚 Full docs: https://docs.md-claude.dev** (or browse the source under [`site/content/docs/`](./site/content/docs/) until the public URL lands).
> Contributing? See [CONTRIBUTING.md](./CONTRIBUTING.md). Security? See [SECURITY.md](./SECURITY.md).

| Plugin | What it does |
| ------ | ------------ |
| **`design`** | Canvas-first iteration on HTML/JSX mocks under `.design/` — element selection via Cmd+Click, auto-managed dev server, chained UX/DS critique. |
| **`flow`** | Generic agentic workflow loop with a second-brain `.ai/` workspace. `/flow:plan`, `/flow:execute`, `/flow:utils-verify`, `/flow:validate`, `/flow:done`, `/flow:setup-onboard`, `/flow:record-ddr`, `/flow:scenario`, …. Project-agnostic via `<project>` placeholders + per-repo `.ai/workflows.config.json`. |

Plus the **`mdcc`** CLI — `mdcc init` scaffolds a fresh `.ai/` workspace from the flow plugin skeleton; `mdcc design serve` boots the design dev server.

## Quick start

### 1. Add the marketplace inside Claude Code

```
/plugin marketplace add 1aGh/md-claude
```

### 2. Install the plugins you want

```
/plugin install design@md-claude
/plugin install flow@md-claude
```

Then `/reload-plugins` and you should see `/design`, `/design:*`, `/flow:plan`, `/flow:execute`, etc.

### 3. Install the CLI

```sh
# From npm:
npm i -g @1agh/md-claude

# Or directly from GitHub:
npm i -g github:1aGh/md-claude
```

After install you have two bins on `$PATH`:

- `mdcc` — the namespace CLI (`init`, `config`, `design serve`).
- `claude-design-server` — direct alias for the dev server (kept for back-compat).

### 4. Bootstrap a repo

In any project root:

```sh
mdcc init                          # scaffold .ai/ second-brain workspace
```

Then inside Claude Code (with `flow@md-claude` installed):

```
/init                  # Anthropic's built-in — generates CLAUDE.md tailored to your codebase
/flow:setup-onboard    # populates .ai/workflows.config.json with detected stack
/flow:status           # confirm everything wired up
```

`/init` writes the `CLAUDE.md` Claude auto-loads every session (conventions, build commands, gotchas). `/flow:setup-onboard` handles the structured workspace config — they're complementary, not duplicates.

## Runtime requirements

- **Node ≥ 20** — for the dev server and CLI. Zero npm runtime deps.
- **Claude Code** — desktop app, CLI, or IDE extension.
- Optional: **`agent-browser`** for design screenshot evidence.

## What's where

User-facing docs live in two places — the README points you the right way:

- **Reference** (every command, every config key, recipes for Next.js / Expo / monorepo) → [`site/content/docs/`](./site/content/docs/) (served at https://docs.md-claude.dev once Vercel is wired — see [DDR-005](.ai/decisions/DDR-005-docs-site-stack-and-hosting.md)).
- **Quickstart** + **contributor info** → this README.

The docs site auto-generates per-command pages from `plugins/{flow,design}/commands/*.md` frontmatter and a typed schema reference from `plugins/flow/.claude-plugin/config.schema.json`. Adding a new command → docs update on next build.

## Workspaces

The repo is a **pnpm workspace monorepo** with one published npm package (`@1agh/md-claude`). Internal workspaces are `"private": true` and never publish:

| Workspace | Purpose |
| --------- | ------- |
| `.` (root) | The single npm publisher — CLI, dev-server entry, plugin templates that ship to npm. |
| `site/` | Docs site — Fumadocs + Next.js, deployed to Vercel ([DDR-005](.ai/decisions/DDR-005-docs-site-stack-and-hosting.md)). |
| `plugins/design/dev-server/` | Zero-dep Node dev server + browser client. Bundled output (`dist/`) is the only thing in the npm tarball. |
| `plugins/design/hub/` | Reserved for the v1.1 federated hub (Phase 9). |

Common scripts at the root:

```sh
pnpm install          # bootstrap everything
pnpm dev              # boot the design dev server
pnpm dev:site         # docs site dev server
pnpm build            # build every workspace that defines `build`
pnpm lint             # biome over the whole repo
pnpm test             # node --test over cli/**/*.test.mjs
pnpm changeset        # add a changeset for the next release
```

The site workspace's Next.js dependencies are heavy — contributors fixing plugin code can keep working with `pnpm install --filter '!@md-claude/site'` to skip them.

## Updating

In Claude Code, after a new version lands on the marketplace:

```
/plugin marketplace update md-claude
/plugin install design@md-claude
/plugin install flow@md-claude
```

## Releasing

The npm package (`@1agh/md-claude`) and the Claude Code plugins (`design@md-claude`, `flow@md-claude`) share one version. The standard release path is **Changesets**:

```sh
# 1. Each PR with shipped behavior includes a changeset
pnpm changeset

# 2. When ready to release, the maintainer runs:
pnpm version            # = bash scripts/changesets-version.sh
                        #   → consumes .changeset/*.md
                        #   → bumps package.json + CHANGELOG
                        #   → propagates version to plugin manifests
                        #   → re-runs scripts/check-version-parity.sh

git commit -am "chore: release v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which re-runs the parity check, verifies the tag matches `package.json`, builds workspaces, publishes with `--access public --provenance`, and creates a GitHub Release using the CHANGELOG entry for that version.

`scripts/bump-version.sh patch|minor|major|X.Y.Z` remains as a manual fallback for emergency hotfixes outside the Changesets flow.

### One-time setup (project owner)

1. Create an **Automation** token at <https://www.npmjs.com/settings/~/tokens>.
2. GitHub repo → **Settings → Secrets → Actions** → `NPM_TOKEN`.
3. `id-token: write` is already enabled in `publish.yml` for npm provenance.

## Local development (plugin authors)

```
/plugin marketplace add /absolute/path/to/md-claude
/plugin install design@md-claude
/plugin install flow@md-claude
```

Working on plugin internals:

1. **Edit in place** — the local marketplace points at your working tree.
2. **Reload after edits:**
   - Commands / agents / skills → `/plugin marketplace update md-claude` then `/reload-plugins`.
   - Dev server code → kill the running process (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart.
3. **Test in isolation** — open Claude Code from a scratch project (`cd /tmp && claude`) so plugins aren't entangled with this repo's own `.ai/`.
4. **Dogfood** — md-claude itself uses `flow` for plan/execute/done. Once `flow` is installed against this marketplace, you can drive its own development with `/flow:plan`, `/flow:execute`, etc.

## License

MIT — see [LICENSE](./LICENSE).
