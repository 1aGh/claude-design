# Contributing to md-claude

Thanks for considering a contribution. md-claude is small and the bar for "ready to merge" is mostly: works on a fresh clone, doesn't surprise existing users, and ships with a [changeset](https://github.com/changesets/changesets) describing the user-visible impact.

This document is intentionally short. If something here is unclear, opening an issue or a doc PR is itself a great first contribution.

## TL;DR

```sh
# 1. Fork + clone
gh repo fork 1aGh/md-claude --clone --remote
cd md-claude

# 2. Install (Node ≥ 20, pnpm ≥ 9)
pnpm install

# 3. Make changes
$EDITOR plugins/flow/commands/onboard.md   # example

# 4. Add a changeset describing the user-visible impact
pnpm changeset

# 5. Run the local checks
pnpm lint
pnpm test
bash scripts/check-version-parity.sh
bash scripts/check-tarball-shape.sh

# 6. Open a PR
gh pr create --fill
```

If those six steps work end-to-end, your PR is ~95% of the way there.

## Repo layout

```
.
├── .claude-plugin/marketplace.json   # entry point Claude Code reads
├── cli/                              # mdcc CLI (published to npm)
├── plugins/
│   ├── design/                       # canvas-first design plugin
│   │   ├── dev-server/               # zero-dep Node dev server (workspace)
│   │   └── hub/                      # reserved for v1.1 federated hub
│   └── flow/                         # agentic workflow plugin
├── site/                             # docs site (workspace, v1.x)
├── scripts/                          # release + repo admin scripts
└── package.json                      # the single npm publisher
```

The repo is a **pnpm workspace monorepo** with a single published npm package (`@1agh/md-claude`). All other workspaces are `"private": true` and never publish — they are dev-time only. See the workspace DDR under `.ai/decisions/` for the rationale.

## Local development loop

The plugins are pure markdown commands/skills/agents plus a zero-dep Node server, so there is no build step for plugin content itself. The fastest iteration loop is:

```
# Tell Claude Code to read this working tree as a marketplace
/plugin marketplace add /absolute/path/to/md-claude
/plugin install design@md-claude
/plugin install flow@md-claude

# After every edit
/plugin marketplace update md-claude
/reload-plugins
```

Test in a **scratch project** (`cd /tmp/scratch && claude`) — not from this repo — so this repo's own `.ai/` workspace doesn't tangle with the plugin you're testing.

For dev-server changes specifically: kill the running server (`lsof -i :<port>` → `kill`) and let the next `/design` invocation auto-restart it.

See the README's [Local development](./README.md#local-development-plugin-authors) section for more.

## Changesets

Every PR that changes shipped behavior — CLI flags, plugin commands, dev-server contracts, anything an installed user could observe — needs a changeset:

```sh
pnpm changeset
# choose patch / minor / major
# write a short, user-facing summary (this lands in the CHANGELOG)
```

PRs that only touch internal docs, the `.ai/` second brain, or repo administration (CI tweaks, contributor docs) do **not** need a changeset.

When in doubt, add one — it costs nothing and improves the changelog.

### How releases happen

Releases are driven by `pnpm changeset` consumed in CI. The version bump is one PR (the "Version Packages" PR opened by the Changesets bot or by `pnpm version` locally), the publish is a separate `v*` git tag that triggers `.github/workflows/publish.yml`. The wrapper `scripts/changesets-version.sh` makes sure both `plugins/design/.claude-plugin/plugin.json` and `plugins/flow/.claude-plugin/plugin.json` move in lockstep with `package.json` (CI parity check enforces this).

`scripts/bump-version.sh` still exists as a manual fallback — use it only for emergency hotfixes when the changesets flow is unavailable.

## Branch naming

```
<type>/<short-slug>
<type>/<issue-number>-<short-slug>
```

Examples: `feat/123-canvas-pan-zoom`, `fix/dev-server-port-collision`, `docs/contributing-cleanup`, `infra/phase-1-contribute-changesets`.

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `infra`, `test`.

## Commit messages

Conventional Commits — short, imperative, scope-tagged:

```
feat(design): pin-to-element edits via Cmd+Click
fix(cli): mdcc init now rewrites $schema for global installs
docs(readme): clarify changeset flow
chore(infra): bootstrap pnpm workspaces (Phase 1 / Task 0)
```

The CHANGELOG is generated from changeset summaries, not commit messages, so the commit subject is for human history — keep it tight.

## Pull requests

Fill out the PR template. The bare minimum:

- **What** — one or two sentences.
- **Why** — the problem being solved or the user-visible improvement.
- **Changeset** — confirm one is included or explain why it isn't.
- **Tests / verification** — how you proved it works (`pnpm test`, manual `/design` run, screenshot, etc.).

PRs squash-merge into `main`. Rebase before requesting review if `main` has moved.

### CI checks

Three checks must be green before merge (configured in branch protection):

1. **Version parity** — `scripts/check-version-parity.sh` confirms all manifests agree.
2. **Quality** — `pnpm lint` (Biome) + `pnpm test` (`node --test` over `cli/**/*.test.mjs`) + a docs link check.
3. **Tarball shape** — `scripts/check-tarball-shape.sh` confirms no workspace `package.json` accidentally ships to npm.

Run them locally before pushing — much faster than a CI round-trip.

## Reporting bugs

Open an issue using the **Bug** template. Include a minimal repro, your Node version, your Claude Code version, and what you expected vs. what happened.

Security issues — see [SECURITY.md](./SECURITY.md). **Do not open public issues for security disclosures.**

## Code of conduct

Participation in this project is governed by the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md). By contributing, you agree to abide by it.

## Questions?

- General questions → [GitHub Discussions](https://github.com/1aGh/md-claude/discussions).
- Bug reports → [Issues](https://github.com/1aGh/md-claude/issues).
- Security → [SECURITY.md](./SECURITY.md).
