# DDR-002: Release flow via Changesets, with a wrapper preserving plugin parity

- **Date:** 2026-05-12
- **Status:** Accepted
- **Tags:** infra, release, npm, changesets, ci
- **Related:** `.ai/plans/phase-1-contribute-infra-changesets.md` (Tasks 4, 5, 7), `.changeset/config.json`, `scripts/changesets-version.sh`, `.github/workflows/publish.yml`, [DDR-001](DDR-001-monorepo-single-publisher.md)

## Context

Pre-Phase-1 the release flow was `scripts/bump-version.sh patch && git tag && git push`. That script:

- Has zero memory of *what* changed since the last release (no CHANGELOG).
- Is opaque to external contributors — they can't telegraph "my PR should bump minor" without filing an issue first.
- Has no way to coordinate multiple PRs into a single coherent release.

We also have a hard invariant from [DDR-001](DDR-001-monorepo-single-publisher.md): `package.json` and both plugin manifests (`plugins/{design,flow}/.claude-plugin/plugin.json`) must always carry the same version. CI enforces this via `scripts/check-version-parity.sh`.

We want CHANGELOG generation, contributor self-service for bump-type signaling, and a release flow that keeps the parity invariant.

## Decision

Adopt **Changesets** (`@changesets/cli`) as the contributor-facing release authoring tool, wrapped to preserve the parity invariant.

**Per-PR contributor flow** (documented in CONTRIBUTING.md):

```sh
pnpm changeset           # writes .changeset/<random-name>.md
                         #   with bump type (patch|minor|major) + summary
```

PRs that don't change shipped behavior (internal docs, CI, .ai/) skip this — the maintainer can also `pnpm changeset add --empty` if needed.

**Maintainer release flow:**

```sh
pnpm version             # = bash scripts/changesets-version.sh
                         #   1. pnpm changeset version
                         #      → consumes .changeset/*.md
                         #      → bumps package.json
                         #      → writes/updates CHANGELOG.md
                         #   2. read new version from package.json
                         #   3. propagate to plugins/{design,flow}/.claude-plugin/plugin.json
                         #      via inline JSON rewrite (does NOT call bump-version.sh,
                         #      which would re-bump package.json)
                         #   4. scripts/check-version-parity.sh as the safety net

git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
git push --follow-tags
```

The `v*` tag triggers `.github/workflows/publish.yml`, which:

1. Runs the parity check.
2. Verifies the tag matches `package.json`.
3. Builds workspaces (`pnpm build`).
4. Publishes with `--access public --provenance`.
5. Creates a GitHub Release using the CHANGELOG section for the released version.

**`scripts/bump-version.sh` is preserved as a manual fallback** for emergency hotfixes when the Changesets flow is unavailable (e.g. CHANGELOG corruption, cherry-pick releases). Documented as such in README and CONTRIBUTING.

## Consequences

**Good:**

- Auto-generated CHANGELOG from contributor-authored summaries — release notes are written when the change happens, not retroactively.
- Contributors can signal bump intent (patch / minor / major) without maintainer ping-pong.
- Multiple PRs naturally batch into one release (each contributes a `.changeset/*.md`; one `pnpm version` consumes them all).
- The plugin-parity invariant survives — wrapper script is the single integration point.

**Trade-offs:**

- Adds `@changesets/cli` as a dev dep (~MB-scale, dev-only — does not affect end users).
- One more file to remember (`pnpm changeset`) in the contributor flow. Mitigated by PR template checkbox + CONTRIBUTING.md TL;DR.
- The wrapper script has to know the plugin manifest paths (duplicates `bump-version.sh` knowledge). Acceptable — both scripts are tiny and the duplication is intentional (parallel paths must agree on the list).

## Alternatives considered

- **Keep `bump-version.sh` as the only path.** Rejected: doesn't solve the CHANGELOG / contributor-self-service gap.
- **Use `release-please` (Google).** Rejected: assumes Conventional Commits as the source of truth; we want contributor-authored release notes (Changesets format), and release-please's monorepo support is more opinionated than we need given DDR-001.
- **Treat each plugin as a separate publishable package via Changesets `fixed`.** Rejected: per DDR-001, plugins do not publish to npm — they ship via the Claude Code marketplace, with the manifest `version` field used purely for display. A wrapper that propagates the root version is simpler than configuring Changesets to "publish" non-published packages.
