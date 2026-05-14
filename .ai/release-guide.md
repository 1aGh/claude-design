# Release Guide — md-claude

> Walked step-by-step by `/flow:release`. Each `##` heading is a step; bash blocks are candidate commands (the slash command confirms before running each).
>
> **Scope:** local prep to trigger the right GitHub Actions. After `git push --follow-tags`, work is done — `.github/workflows/publish.yml` handles parity re-check, build, tarball-shape, `npm publish`, and GitHub Release creation. Don't duplicate that work here.
>
> **Provider:** changesets · **Package:** `@1agh/md-claude`
>
> **Three manifests ship one version line.** `package.json`, `plugins/design/.claude-plugin/plugin.json`, and `plugins/flow/.claude-plugin/plugin.json` must always match. `scripts/changesets-version.sh` propagates and verifies; `quality.yml` + `version-parity.yml` re-check on every PR.
>
> **What publishes how:**
> - **npm** — `@1agh/md-claude` (CLI + dev-server + ai-skeleton templates). Tag `v*.*.*` triggers `publish.yml`.
> - **Claude Code marketplace** — both plugins (`design`, `flow`) ship via `marketplace.json` read directly from `main`. The moment the release commit is on `main`, end users can `/plugin marketplace update md-claude`. No separate publish step.

## Pre-flight

- [ ] On `main` with clean working tree
- [ ] Latest `quality.yml` + `version-parity.yml` green on `main` (the CI that the release relies on has already vetted lint, tests, tarball-shape, parity)
- [ ] At least one `.changeset/*.md` since the previous tag (otherwise the bump is a no-op)
- [ ] You have npm publish permission for `@1agh/md-claude` and push access to `main`
- [ ] `NPM_TOKEN` repo secret is set (one-time, only after rotation)

```bash
git switch main && git pull --ff-only
git status
ls .changeset/*.md 2>/dev/null | grep -v README.md
```

## Author changesets (optional — usually done during feature work)

Skip this step if `.changeset/` already has at least one non-README `.md`. Otherwise, for each user-facing change since the last release:

```bash
pnpm changeset
```

The wizard asks for bump kind and a short summary, writes `.changeset/<slug>.md`. Commit that file as part of the PR that introduced the change — not at release time.

**Bump-kind rule of thumb:**
- `patch` — bug fixes, doc-only changes, internal refactors, CLI flag tweaks that stay backwards-compatible.
- `minor` — new commands/skills/agents, new `mdcc` subcommands, new config keys with safe defaults.
- `major` — removed/renamed commands or config keys, breaking CLI flag changes, dev-server protocol break.

## Bump + commit + tag

Consume pending changesets, propagate to the three manifests, and create the release commit + annotated tag.

```bash
pnpm run changeset:version
```

> The script wraps `pnpm changeset version` (consumes `.changeset/*.md`, bumps `package.json`, regenerates `CHANGELOG.md`), then propagates the new version to both plugin manifests, then runs `scripts/check-version-parity.sh` as a safety net. Don't use bare `pnpm version` — pnpm 11 reserves that name for its built-in command.

Capture the new version and review the diff:

```bash
git diff --stat
node -p "require('./package.json').version"
```

Stage everything the bump touched (`.changeset/config.json` has `"commit": false` so the bump does not auto-commit), then commit and tag.

```bash
VER=$(node -p "require('./package.json').version")
git add package.json plugins/*/.claude-plugin/plugin.json CHANGELOG.md .changeset/
git commit -m "chore: release v${VER}"
git tag -a "v${VER}" -m "v${VER}"
```

> **Annotated tag (`-a -m`) is required** — `git push --follow-tags` only pushes annotated tags. A lightweight `git tag v${VER}` will silently stay local and `publish.yml` never fires.

> **Hotfix path (no changesets):** if you need to bump without authoring changesets first, use `scripts/bump-version.sh patch|minor|major|X.Y.Z` instead. It bumps the three manifests without touching `CHANGELOG.md`; `publish.yml`'s release step falls back to auto-generated notes when the `## X.Y.Z` section is missing.

## Pre-push smoke (optional — skip unless you suspect local env drift from CI)

If CI was green on `main` and the bump script succeeded, you're already verified — the release commit only changes version numbers in 4 files and cannot introduce new lint/test failures.

Run only if you have a reason to distrust the green CI run (uncommitted local changes, node version mismatch, fresh dev environment):

```bash
pnpm lint
pnpm test
```

## Push — CI takes over from here

```bash
git push --follow-tags
```

The `v*.*.*` tag triggers `.github/workflows/publish.yml`, which:
1. Re-runs `check-version-parity.sh`.
2. Verifies `GITHUB_REF_NAME` matches `package.json` version.
3. `pnpm build`.
4. Re-runs `check-tarball-shape.sh`.
5. `npm publish --access public --provenance`.
6. Creates a GitHub Release for the tag, extracting notes from the matching `## X.Y.Z` section of `CHANGELOG.md` (falls back to auto-generated notes if empty).

Watch the run in the GH UI or from the terminal:

```bash
gh run list --workflow=publish.yml --limit 1
gh run view --web                       # or just open https://github.com/1aGh/md-claude/actions
```

If `publish.yml` goes green, the release is live on npm and a GitHub Release is published. You're done.

## When things break

**Tag pushed but `publish.yml` failed at `npm publish`:**
- Check `NPM_TOKEN` is still valid; rotate via npmjs.com if expired.
- Re-run the failed job from the Actions UI; the workflow is idempotent until `npm publish` itself runs.

**Tag pushed, npm published, but GitHub Release wasn't created:**
```bash
VER=$(node -p "require('./package.json').version")
gh release create "v${VER}" --title "v${VER}" --notes-file <(awk -v ver="${VER}" '$0 ~ "^## "ver"($| )" {f=1;next} f&&/^## /{exit} f{print}' CHANGELOG.md)
```

**Tag was created but never pushed (lightweight tag with `--follow-tags`):**
```bash
VER=$(node -p "require('./package.json').version")
git tag -d "v${VER}"
git tag -a "v${VER}" -m "v${VER}"
git push origin "v${VER}"
```

**npm publish succeeded but the release is broken and needs to come down:**
- Within 72h npm allows `npm unpublish @1agh/md-claude@X.Y.Z` (non-popular packages only).
- Prefer `npm deprecate @1agh/md-claude@X.Y.Z "<reason>"` first — keeps the version in the registry as an audit trail and warns installers, without breaking lockfiles that already pinned it.
- **Do not delete the git tag from GitHub** — fix forward with the next patch release. The tag is the audit trail for what was attempted.

**Version parity check fails locally on `main` after merge:**
- A PR slipped through that touched one manifest but not the others. This should be impossible (parity is a required PR check) — but if it happens, run `scripts/bump-version.sh <current-version>` to re-sync all three manifests, commit, push.
