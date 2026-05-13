# Release Guide — md-claude

> Walked step-by-step by `/flow:release`. Each `##` heading is a step; bash blocks are candidate commands (the slash command confirms before running each).
>
> **Provider:** changesets · **Scope:** `@1agh/md-claude` · **Tarball name:** `@1agh/md-claude`
>
> **Three manifests ship one version line.** `package.json`, `plugins/design/.claude-plugin/plugin.json`, and `plugins/flow/.claude-plugin/plugin.json` must always match — enforced by `scripts/check-version-parity.sh` locally and by `.github/workflows/version-parity.yml` on every PR.
>
> **What publishes how:**
> - **npm** — `@1agh/md-claude` (CLI + dev-server + ai-skeleton templates). Tag `v*.*.*` triggers `.github/workflows/publish.yml`.
> - **Claude Code marketplace** — the two plugins (`design`, `flow`) reach users through `/plugin marketplace add 1aGh/md-claude`; the marketplace reads `.claude-plugin/marketplace.json` directly from the repo, so they "ship" the moment the tag is pushed to `main`. No separate publish step.

## Pre-flight

- [ ] On `main` with clean working tree (`git status` empty)
- [ ] Latest CI green on `main` (Quality + Version parity)
- [ ] At least one `.changeset/*.md` since the previous tag (otherwise `pnpm version` is a no-op)
- [ ] You have npm publish permission for `@1agh/md-claude` and push access to `main`
- [ ] `NPM_TOKEN` secret is configured in repo settings (one-time; only required for the very first release after rotation)

```bash
git switch main && git pull --ff-only
git status
ls .changeset/*.md 2>/dev/null | grep -v README.md
```

## Author changesets (normally done during feature work, not at release time)

Skip this step if your changesets are already in `.changeset/`. Otherwise, for each user-facing change since the last release:

```bash
pnpm changeset
```

The wizard asks for bump kind (`patch` / `minor` / `major`) and a short summary. It writes `.changeset/<random-slug>.md`. Commit that file as part of the PR that introduced the change — not at release time.

**Bump-kind rule of thumb for this repo:**
- `patch` — bug fixes, doc-only changes, internal refactors, CLI flag tweaks that stay backwards-compatible.
- `minor` — new commands/skills/agents, new `mdcc` subcommands, new config keys with safe defaults.
- `major` — removed/renamed commands or config keys, breaking CLI flag changes, dev-server protocol break.

## Bump versions (consume changesets)

`pnpm version` runs `scripts/changesets-version.sh`, which:
1. Runs `pnpm changeset version` — consumes pending `.changeset/*.md`, bumps `package.json`, regenerates `CHANGELOG.md`.
2. Propagates the new version to both plugin manifests.
3. Runs `scripts/check-version-parity.sh` as a safety net.

```bash
pnpm version
```

After the script finishes:

```bash
git diff --stat                        # review what changed
node -p "require('./package.json').version"   # capture the new X.Y.Z
```

The changeset markdown files in `.changeset/` are deleted automatically. `CHANGELOG.md` now has a new `## X.Y.Z` section at the top.

> **No-changesets shortcut (hotfix path):** if you need to bump without authoring changesets first — e.g. emergency patch — use `scripts/bump-version.sh patch|minor|major|X.Y.Z` instead. It bumps the three manifests without touching `CHANGELOG.md`. The publish workflow's GitHub Release step will fall back to auto-generated notes if the version section is missing from `CHANGELOG.md`.

## Commit the version bump

`.changeset/config.json` sets `"commit": false`, so changesets does **not** auto-commit. Stage everything it touched and create the release commit:

```bash
VER=$(node -p "require('./package.json').version")
git add package.json plugins/*/.claude-plugin/plugin.json CHANGELOG.md .changeset/
git commit -m "chore: release v${VER}"
```

(`chore: release vX.Y.Z` is the established convention — see recent commit history.)

## Tag the release

```bash
VER=$(node -p "require('./package.json').version")
git tag "v${VER}"
```

Don't push yet — verify locally first.

## Local verification before push

```bash
bash scripts/check-version-parity.sh    # asserts all three manifests match
bash scripts/check-tarball-shape.sh     # asserts no workspace metadata or node_modules leak
pnpm test                               # node:test on cli/**/*.test.mjs
pnpm lint                               # biome
```

All four must pass. The CI publish workflow re-runs them, but catching a failure locally avoids a half-published state where the tag exists but npm doesn't.

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
6. Creates a GitHub Release for the tag, extracting notes from the matching `## X.Y.Z` section of `CHANGELOG.md` (falls back to auto-generated notes if the section is empty).

Wait for the publish run to finish and **hard-gate on its conclusion** before moving on. Don't rely on `gh run watch` without a target — it tails whatever run is newest on the current branch, which after a tag push is often a different workflow's run on `main`, not the publish run keyed off the tag.

```bash
VER=$(node -p "require('./package.json').version")
TAG="v${VER}"

# Find the publish.yml run triggered by this exact tag. GitHub Actions takes
# a few seconds to register the run, so retry until it shows up.
for i in 1 2 3 4 5; do
  RUN_ID=$(gh run list --workflow=publish.yml --event=push --limit 20 \
    --json databaseId,headBranch \
    --jq ".[] | select(.headBranch == \"${TAG}\") | .databaseId" | head -1)
  [ -n "$RUN_ID" ] && break
  sleep 3
done

if [ -z "$RUN_ID" ]; then
  echo "error: no publish.yml run found for ${TAG} after 15s" >&2
  exit 1
fi

echo "watching run ${RUN_ID} for ${TAG}"
gh run watch "$RUN_ID" --exit-status   # non-zero exit if the run fails
```

If `gh run watch --exit-status` exits non-zero, **stop here** — the artifact didn't publish. Read the failure:

```bash
gh run view "$RUN_ID" --log-failed
```

Then jump to the "When things break" section at the bottom; do **not** proceed to artifact verification.

Once the run is green, sanity-check the release page:

```bash
gh release view "${TAG}" --web
```

## Verify the published artifact

```bash
VER=$(node -p "require('./package.json').version")
npm view @1agh/md-claude version       # should print $VER
npm view @1agh/md-claude dist-tags     # latest → $VER
```

Smoke-install in a scratch dir to make sure the tarball is functional end-to-end:

```bash
TMP=$(mktemp -d) && cd "$TMP"
npm i -g @1agh/md-claude@latest
mdcc --version                          # should match $VER
mdcc init --name scratch --dry-run      # should list files it would scaffold
cd - && rm -rf "$TMP"
```

## Verify the Claude Code marketplace

The marketplace reads `marketplace.json` directly from the repo at `main`. After your tag is on `main`, end users can update with:

```
/plugin marketplace update md-claude
/reload-plugins
```

To confirm from a scratch project:

```bash
cd /tmp && mkdir -p md-claude-smoke && cd md-claude-smoke && claude
# then inside Claude Code:
#   /plugin marketplace add 1aGh/md-claude
#   /plugin install flow@md-claude
#   /flow:help        — should list the latest commands
```

## Post-release

- [ ] Skim the GitHub Release page — make sure the notes render and link to the right diff range.
- [ ] If anything visible to users changed in the `flow` plugin's command surface, mention `/plugin marketplace update md-claude && /reload-plugins` in the release notes — installed users won't pick up the new commands automatically.
- [ ] If the npm publish failed but the tag was pushed, do **not** delete the tag from GitHub — instead, fix forward with the next patch release. The tag is the audit trail for what was attempted.
- [ ] If a release needs to be unpublished (npm allows it within 72h for non-popular packages), use `npm deprecate @1agh/md-claude@X.Y.Z "<reason>"` first; only `npm unpublish` as a last resort.

## When things break

**Tag pushed but `publish.yml` failed at `npm publish`:**
- Check `NPM_TOKEN` is still valid (`npm whoami` with the token); rotate via npmjs.com if expired.
- Re-run the failed job from the Actions UI; the workflow is idempotent until `npm publish` itself runs.

**Tag pushed, npm published, but GitHub Release wasn't created:**
- Run the release step manually:
  ```bash
  VER=$(node -p "require('./package.json').version")
  gh release create "v${VER}" --title "v${VER}" --notes-file <(awk -v ver="${VER}" '$0 ~ "^## "ver"($| )" {f=1;next} f&&/^## /{exit} f{print}' CHANGELOG.md)
  ```

**Version parity check fails locally on `main` after merge:**
- A PR slipped through that touched one manifest but not the others. Run `scripts/bump-version.sh <current-version>` to re-write all three to the same value, commit, push. (Version-parity is a required status check on PRs, so this should be rare — but the check uses `node:20` which is older than the publish workflow's `node:22`, so check the version-parity workflow log if you see a discrepancy.)
