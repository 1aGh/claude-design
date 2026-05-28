# Release Guide — Maude

> Walked step-by-step by `/flow:release`. Each `##` heading is a step; bash blocks are candidate commands (the slash command confirms before running each).
>
> **Scope:** local prep to trigger the right GitHub Actions. After `git push --follow-tags`, work is handed off to `.github/workflows/build-binaries.yml`, which owns the full release pipeline (create-release → 7-platform matrix → publish-main → populate notes).
>
> **Provider:** changesets · **Package:** `@1agh/maude`
>
> **Ten manifests + seven `optionalDependencies` pins move in lockstep.** `package.json`, both `plugins/*/.claude-plugin/plugin.json` files, and all seven `packages/maude-*/package.json` files must always share the same `version`. The root's `optionalDependencies` map pins each sub-package at the same version. `scripts/bump-version.sh` writes all ten + the pins; `scripts/check-version-parity.sh` enforces. `scripts/changesets-version.sh` delegates to `bump-version.sh`, so the changeset flow gets parity for free.
>
> **What publishes how:**
> - **npm — root `@1agh/maude`** (CLI + dev-server source + ai-skeleton templates). Published by `build-binaries.yml > publish-main` after every per-platform sub-package lands.
> - **npm — `@1agh/maude-<slug>` × 7** (per-platform Bun standalone binaries: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`, `win32-x64`). Published in parallel by `build-binaries.yml > build-binaries` matrix. Pulled in at install time via root's `optionalDependencies`.
> - **GitHub Release** — created empty by `build-binaries.yml > create-release` (so matrix `gh release upload` has a target), then `publish-main` populates the body from `CHANGELOG.md` (auto-generated notes if the section is missing).
> - **Claude Code marketplace** — both plugins (`design`, `flow`) ship via `marketplace.json` read directly from `main`. The moment the release commit is on `main`, end users can `/plugin marketplace update maude`. No separate publish step.

## Pre-flight

- [ ] On `main` with clean working tree (no staged or unstaged changes)
- [ ] Latest `quality.yml` and `version-parity.yml` are **actually green** on `main` (run `gh run list --workflow=quality.yml --branch=main --limit 1` — don't just assume from memory). A red `quality.yml` masks lurkers that the release commit will surface.
- [ ] At least one `.changeset/*.md` since the previous tag (otherwise the bump is a no-op)
- [ ] You have npm publish permission for `@1agh/maude` + all 7 `@1agh/maude-<slug>` packages, and push access to `main`
- [ ] `NPM_TOKEN` repo secret is set (one-time, only after rotation)
- [ ] 1Password is unlocked AND the SSH key is approved for the session (signing failures mid-tag-move leave the repo in a partial state — see "When things break")

```bash
git switch main && git pull --ff-only
git status                                           # working tree clean
gh run list --workflow=quality.yml --branch=main --limit 1
gh run list --workflow=version-parity.yml --branch=main --limit 1
ls .changeset/*.md 2>/dev/null | grep -v README.md   # at least one pending changeset
```

### Config health + quality gates (blocker)

The release walker runs the workspace's own config sanity check, then every declared quality gate — a schema error or a failing gate aborts before the bump (per the `flow:quality-gates` skill, release pre-flight runs **all** gates, no filter):

```bash
# Step 1: config schema must be clean
maude doctor --json | jq -e '.summary.schemaErrors == 0' >/dev/null \
  || { echo "::error::config schema errors — run \`maude doctor --fix\`"; exit 1; }

# Step 2: every declared quality gate (format/lint/typecheck/tests/build, …) in order
for gate in $(jq -r '.quality | keys[]' .ai/workflows.config.json); do
  cmd=$(jq -r ".quality[\"$gate\"]" .ai/workflows.config.json)
  echo "→ $gate: $cmd"
  eval "$cmd" || { echo "::error::release pre-flight: $gate gate failed (\`$cmd\`)"; exit 1; }
done
```

## Author changesets (optional — usually done during feature work)

Skip this step if `.changeset/` already has at least one non-README `.md`. Otherwise, for each user-facing change since the last release:

```bash
pnpm changeset
```

The wizard asks for bump kind and a short summary, writes `.changeset/<slug>.md`. Commit that file as part of the PR that introduced the change — not at release time.

**Bump-kind rule of thumb:**
- `patch` — bug fixes, doc-only changes, internal refactors, CLI flag tweaks that stay backwards-compatible.
- `minor` — new commands/skills/agents, new `maude` subcommands, new config keys with safe defaults.
- `major` — removed/renamed commands or config keys, breaking CLI flag changes, dev-server protocol break.

## Bump

Consume pending changesets and propagate the new version to all ten manifests + the seven `optionalDependencies` pins:

```bash
pnpm run changeset:version
```

> The script: (1) `pnpm changeset version` consumes `.changeset/*.md`, bumps `package.json`, regenerates `CHANGELOG.md`. (2) Delegates to `scripts/bump-version.sh "$NEW"` which writes the new version to every manifest and every `optionalDependencies` pin. (3) Runs `scripts/check-version-parity.sh` as the safety net. Don't use bare `pnpm version` — pnpm 11 reserves that name for its built-in command.

Capture the new version and review the diff:

```bash
git diff --stat
node -p "require('./package.json').version"
```

## Biome reformat sweep

> **Why this step exists:** `scripts/bump-version.sh` writes JSON via `JSON.stringify(j, null, 2)`, which expands small arrays (`"os"`, `"cpu"`, `"libc"`, `"files"`) onto multiple lines. Biome's formatter prefers them inline for the sub-package manifests. Without this step, the release commit lints clean locally but `quality.yml` fails CI on every sub-package. This bites every bump until `bump-version.sh` learns biome's JSON formatter conventions.

```bash
pnpm biome check --fix
pnpm lint                                            # confirm clean
```

After `pnpm run changeset:version`, re-run the `format` + `lint` gates. **If only `format` errors remain**, the bump expanded the sub-package arrays (the `JSON.stringify` mechanism above) — apply the format-fix and re-stage:

```bash
pnpm biome format --write .                          # fix the expanded arrays
```

**Any other gate failure is real debt** that should have been caught upstream by the Pre-flight gate loop — abort the release and triage it outside the release flow. Don't `--fix` your way past a `lint`/`typecheck`/`tests`/`build` failure at release time.

## Pre-push smoke

Always run. `pnpm changeset version` regularly surfaces stale generated artefacts (e.g. `site/lib/stats.json` derived from `package.json.version`) that CI drift checks flag:

```bash
pnpm lint
pnpm test
pnpm --filter @maude/site gen:stats              # refresh derived stats
pnpm --filter @maude/site gen:reference          # refresh derived reference docs
pnpm --filter @maude/site gen:roadmap            # refresh roadmap from .ai/plans + STATE.md
git diff --stat site/                                # capture any drift to commit
```

If the generators produced diffs, stage them with the release commit (next step).

## Commit + annotated tag

Stage everything the bump and the smoke step touched, then commit and tag.

```bash
VER=$(node -p "require('./package.json').version")
git add package.json \
        plugins/design/.claude-plugin/plugin.json \
        plugins/flow/.claude-plugin/plugin.json \
        packages/maude-*/package.json \
        CHANGELOG.md \
        .changeset/ \
        site/lib/stats.json \
        site/lib/roadmap.json \
        site/content/docs/reference/
git status                                           # eyeball — no surprise additions
git commit -m "chore: release v${VER}"
git tag -a "v${VER}" -m "v${VER}"
```

> **Annotated tag (`-a -m`) is required** — `git push --follow-tags` only pushes annotated tags. A lightweight `git tag v${VER}` will silently stay local and `build-binaries.yml` never fires.

> **Hotfix path (no changesets):** if you need to bump without authoring changesets first, use `scripts/bump-version.sh patch|minor|major|X.Y.Z` instead of `pnpm run changeset:version`. It bumps every manifest + pin without touching `CHANGELOG.md`; the release step falls back to auto-generated notes when the `## X.Y.Z` section is missing.

## Push — CI takes over from here

```bash
git push --follow-tags
```

The `v*.*.*` tag triggers `.github/workflows/build-binaries.yml`, which:

1. **`create-release`** — creates an empty GitHub Release (so matrix uploads have a target).
2. **`build-binaries`** (7-platform matrix) — `bun build --compile --target=<platform>` produces a Bun standalone binary; smoke-tests it; `npm publish --access public --provenance` the matching `@1agh/maude-<slug>` sub-package (idempotent — 409 "already published" is treated as success); uploads the binary to the GitHub Release as an asset.
3. **`publish-main`** (after the full matrix succeeds) — installs with `--no-frozen-lockfile` (the lockfile cannot enumerate per-platform sub-packages that don't exist on npm until the matrix publishes them); verifies parity; `pnpm build`; verifies tarball shape; `npm publish` the root tarball (idempotent); populates the GitHub Release body from CHANGELOG.md.

Watch the run:

```bash
gh run list --workflow=build-binaries.yml --limit 1
gh run view --web                                    # or open https://github.com/1aGh/maude/actions
```

After `publish-main` is green:

```bash
gh release view "v$(node -p "require('./package.json').version")"
npm view @1agh/maude version                     # confirm npm sees the new root
```

If the GitHub Release shows `draft: true` (happens when the tag was force-moved during a retry cycle), publish it:

```bash
gh release edit "v$(node -p "require('./package.json').version")" --draft=false
```

## When things break

### Tag pushed, `build-binaries.yml` matrix has 1+ failed cells

The matrix is `fail-fast: false` — other cells continue. Pull the failed job logs:

```bash
gh run view <RUN_ID> --log-failed | tail -100
```

Common failures + recovery:

- **`macos-13` runner queued for 15+ min with no assignment** — capacity issue, runner is being deprecated. Already migrated to `macos-14` cross-compile (`--target=bun-darwin-x64`); shouldn't recur. If it does, swap the matrix entry and force-move the tag (see below).
- **`win32-x64` binary not produced (`maude-windows-x64.exe` vs `maude-win32-x64.exe`)** — slug mismatch between `bun --target` naming and Node's `process.platform`. Already fixed in `build.ts` `platformSlug()`. Should not recur.
- **Alpine container fails "JavaScript Actions in Alpine containers only supported on x64 Linux runners"** — JS actions can't run inside alpine on arm64. Already fixed by cross-compiling musl from regular ubuntu runners. Should not recur.
- **Network flake on `npm publish`** — re-run the failed job from the Actions UI; the matrix step is idempotent (409 conflict treated as success).

### `publish-main` failed after the matrix succeeded

The 7 per-platform sub-packages are already on npm at the new version. Re-run `publish-main` only:

```bash
gh run view <RUN_ID>                                 # find publish-main job ID
gh run rerun <RUN_ID> --failed
```

`publish-main` is idempotent: if the root was already published, the step treats 409 as success and moves on to populate Release notes.

### Tag pushed but `build-binaries.yml` never fired

Means a lightweight tag was pushed instead of annotated. Recover:

```bash
VER=$(node -p "require('./package.json').version")
git tag -d "v${VER}"
git push origin ":refs/tags/v${VER}"                 # delete remote
git tag -a "v${VER}" -m "v${VER}"                    # annotated this time
git push origin "v${VER}"
```

### GitHub Release is stuck in `draft: true`

Happens when the tag was force-moved one or more times during a retry cycle — the original release record gets orphaned. The Release exists with the correct name and tag association but the `draft` flag is still set:

```bash
gh release edit "v$(node -p "require('./package.json').version")" --draft=false
```

### Force-move the tag to retry from a fixed commit

Sometimes a CI bug is found mid-release after some sub-packages already published. Bumping the version just to re-trigger CI is wasteful; force-moving the tag re-triggers `build-binaries.yml` and the idempotent publish steps absorb the already-published sub-packages.

```bash
git push origin main                                  # land the CI fix first
VER=$(node -p "require('./package.json').version")
git tag -d "v${VER}"
git push origin ":refs/tags/v${VER}"                 # delete remote tag
git tag -a "v${VER}" -m "v${VER}"                    # recreate at new HEAD
git push origin "v${VER}"
```

> The GitHub Release record may go into `draft: true` after a force-move — see above for the `gh release edit --draft=false` recovery.

### npm publish succeeded but the release is broken and needs to come down

- Within 72h npm allows `npm unpublish @1agh/maude@X.Y.Z` (non-popular packages only).
- Prefer `npm deprecate @1agh/maude@X.Y.Z "<reason>"` first — keeps the version in the registry as an audit trail and warns installers, without breaking lockfiles that already pinned it.
- If only some of the 7 sub-packages published (partial release), deprecate the published ones with a message pointing at the next patch release.
- **Do not delete the git tag from GitHub** — fix forward with the next patch release. The tag is the audit trail for what was attempted.

### Version parity check fails locally on `main` after merge

A PR slipped through that touched some manifests but not all ten. Re-sync:

```bash
scripts/bump-version.sh "$(node -p "require('./package.json').version")"   # idempotent
pnpm biome check --fix                                                     # reformat sub-package arrays
git diff --stat                                                            # eyeball
git commit -am "chore: re-sync manifests to v$(node -p 'require(\"./package.json\").version')"
git push
```

### 1Password SSH agent refuses signing mid-tag-move

If 1Password locks mid-sequence (commit succeeds, push or tag-push fails), the repo can end up with:
- New commit local but not remote.
- Local tag deleted but remote tag still at old commit.

Recovery: unlock 1Password, then chain the whole sequence with `&&` so a failure stops cleanly mid-way (no partial state). Example for retrying after a failed bun-setup commit:

```bash
git commit -m "<message>" && \
  git push origin main && \
  git tag -d "v${VER}" && \
  git push origin ":refs/tags/v${VER}" && \
  git tag -a "v${VER}" -m "v${VER}" && \
  git push origin "v${VER}"
```

### Vercel deployment failed with `ERR_PNPM_OUTDATED_LOCKFILE`

Same root cause as CI: Vercel defaults to `pnpm install --frozen-lockfile`, incompatible with the `optionalDependencies` bootstrap pattern. Already pinned to `--no-frozen-lockfile` via repo-root `vercel.json`. If Vercel ever loses that override, re-add:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "pnpm install --no-frozen-lockfile"
}
```
