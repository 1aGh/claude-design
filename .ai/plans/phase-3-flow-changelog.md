# Phase 3: `integrations.changelog` + `/flow:release-changelog` + `/flow:release` (downstream-reusable)

> **Re-scoped 2026-05-12 (v7).** Final naming follows the established `validate` parent/group pattern: the `<verb>` parent lives in `daily`, the `<verb>-<specialization>` members live in the prefix group.
>
> - **`/flow:release`** (`category: daily`) — walks the release runbook (the verb-action "do the release"). Parent.
> - **`/flow:release-changelog`** (`category: release`) — author a changelog entry. Specialized release-time authoring; sibling to future `release-version`, `release-publish`.
>
> Earlier revisions: v5 called the authoring command `/flow:changelog` to mirror the config key; v6 tried `/flow:release-cut` for the parent; v7 settles on `/flow:release` (parent) + `/flow:release-changelog` (member), aligning with `/flow:validate` + `/flow:validate-a11y` etc. Filesystem markers and CLI invocations of the Changesets tool itself (`.changeset/`, `pnpm changeset version`) keep their original names. **Phase 3 ships these final names directly so Phase 13 doesn't rename them.**

## Description

Productize release-note + release-cut hygiene as a reusable flow capability. Add a new `integrations.changelog` block to `.ai/workflows.config.json` (provider + scope + releaseGuide path), implement the `changesets` provider, and surface it through:

1. **`/flow:release-changelog`** — authors a changelog entry interactively (bootstrap Changesets if absent). Provider-specific dispatch.
2. **`/flow:validate`** — adds a changelog-hygiene check (soft warning).
3. **`/flow:done`** — same dispatch at close-out.
4. **`/flow:release`** — **new.** Reads a project-owned runbook (`.ai/release-guide.md`) and walks the user through it step by step with explicit `[run] / [skip] / [abort]` confirmations per shell command. The runbook itself is scaffolded with a provider-appropriate stub during onboard.
5. **`/flow:onboard`** — auto-detects the changelog provider from filesystem markers, asks for confirmation, scaffolds the release-guide stub.
6. **`/flow:execute` + `/flow:quick`** — existing hardcoded references to "changeset" are de-hardcoded and made provider-aware.

Other providers (`git-cliff`, `conventional`, `custom`) are accepted by the schema today but dispatch to a no-op + TODO log line. Each unlocks in its own follow-up PR. The release runbook approach means provider work is **purely documentation** — `/flow:release` doesn't need provider-specific Bash, the user's runbook supplies it.

## User Story

As a maintainer of a downstream repo that installed `flow@md-claude`, I want one config switch (`integrations.changelog.provider`) to tell flow which release-note tool I use, so `/flow:validate` and `/flow:done` remind me when I'm about to merge without a release note — and I want a first-class `/flow:release-changelog` authoring command if my team picked Changesets.

## Problem

- Phase 1 bootstrapped Changesets for `md-claude` itself; downstream repos have to copy the recipe manually.
- `/flow:done` and `/flow:validate` ship no awareness of release hygiene — easy to merge a user-visible change without a changelog entry.
- Hardcoding "changesets" into the config locks teams using `git-cliff`, conventional-changelog, or no tool at all out of the gate.

## Solution

Add **`integrations.changelog`** to the schema as a sibling of `tracker` / `analytics` / `ci` / `design`. Generic commands (`/flow:validate`, `/flow:done`) read `provider` and decide whether to run a check. Provider-specific commands (`/flow:release-changelog`) self-gate on the provider value. Phase 3 ships the `changesets` provider end-to-end; other enum values are wire-only.

## Metadata

- **Type:** New Feature
- **Complexity:** Low-Medium
- **Depends on:** Phase 1 (Changesets bootstrapped on md-claude — used as the reference implementation)
- **Parallel with:** Phase 2 (docs site)
- **Affected files:**
  - `plugins/flow/.claude-plugin/config.schema.json` — extend `integrations` with `changelog` (incl. `releaseGuide` field)
  - `plugins/flow/templates/ai-skeleton/workflows.config.json` — add default `{"changelog": {"provider": "none"}}`
  - `plugins/flow/templates/ai-skeleton/release-guide.md` — **new** template runbook with provider-appropriate stubs
  - `plugins/flow/commands/release-changelog.md` — **new** authoring command
  - `plugins/flow/commands/release.md` — **new** runbook walker
  - `plugins/flow/commands/validate.md` — append changelog-hygiene step
  - `plugins/flow/commands/done.md` — append changelog-hygiene reminder
  - `plugins/flow/commands/onboard.md` — auto-detect provider, ask Q7, scaffold release guide
  - `plugins/flow/commands/execute.md` — de-hardcode line 179 ("changeset if needed" → provider-aware)
  - `plugins/flow/commands/quick.md` — de-hardcode line 37 (escalation criterion)
  - `plugins/flow/skills/ddr-keeper/SKILL.md` — note "choosing a changelog provider" as DDR-worthy
  - `cli/commands/init.mjs` — add `release-guide.md` to the `TEMPLATED` list so it gets the provider stub baked in on copy
  - `site/content/docs/flow/changelog.mdx` + `release.mdx` — **new** (lands once Phase 2 site exists)

---

## Context References

### Must-read files

- `plugins/flow/.claude-plugin/config.schema.json` (lines 259–315) — Why: existing `integrations.{tracker,analytics,ci,design}` shape is the template to mirror. Each uses `{provider, mcp, defaults}`.
- `plugins/flow/templates/ai-skeleton/workflows.config.json` (lines 61–66) — Why: where the default for the new key lands.
- `plugins/flow/commands/done.md` — Why: where the soft-gate reminder is appended.
- `plugins/flow/commands/validate.md` — Why: same, on the validation side.
- `plugins/flow/commands/onboard.md` (lines 155–207) — Why: auto-detect pattern (commit-convention via filesystem markers + `TRACKER_HINT`) is the template for changelog-provider auto-detection; Step 3 is where the Q7 ask lands.
- `plugins/flow/commands/execute.md:179` — Why: hardcoded "changeset if needed" string needs de-hardcoding.
- `plugins/flow/commands/quick.md:37` — Why: hardcoded escalation criterion needs de-hardcoding.
- `cli/commands/init.mjs` — Why: handles `TEMPLATED` rewrite on copy; `release-guide.md` joins that list so the provider stub is filled in at `mdcc init` time.
- `.changeset/config.json` (in this repo, from Phase 1) — Why: canonical detection target for the changesets provider.

### Patterns to follow

`integrations.tracker` is the closest analogue: an `enum` of providers, an optional `mcp` pointer, and a free-form `defaults` object for provider-specific config. The dispatch happens **inside commands**, not in the schema. Same pattern applies here.

---

## Design Decisions

No UI — plugin-internal. (Section retained per template; nothing to record.)

---

## Tasks

Execute in order. Each task is atomic.

### Task 1: Schema — add `integrations.changelog`

- **Do:** Extend `plugins/flow/.claude-plugin/config.schema.json` by adding a `changelog` sub-object to `integrations.properties`, mirroring `tracker`'s shape plus a `releaseGuide` path field:
  ```json
  "changelog": {
    "type": "object",
    "additionalProperties": false,
    "description": "Release-note / changelog tooling. Used by /flow:validate and /flow:done to remind (soft warning) about missing release notes, by /flow:release-changelog to author entries, and by /flow:release to walk the project-owned release runbook. Phase 3 implements the `changesets` provider; other enum values are accepted but treated as no-op until their providers land.",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["changesets", "git-cliff", "conventional", "custom", "none"],
        "default": "none"
      },
      "scope": {
        "type": "string",
        "description": "Optional package scope for monorepos — e.g. \"@1agh/md-claude\". Passed to provider commands when they need to target a workspace member."
      },
      "releaseGuide": {
        "type": "string",
        "default": ".ai/release-guide.md",
        "description": "Path (repo-relative) to the project-owned release runbook that /flow:release walks step-by-step. The runbook is plain Markdown — H2 sections become steps, ``` ```bash ``` ``` blocks become candidate commands (run only after user confirmation). Scaffolded with a provider-appropriate stub during /flow:onboard."
      },
      "mcp": { "type": "string" },
      "defaults": { "type": "object", "additionalProperties": true }
    }
  }
  ```
- **Pattern:** Match the `tracker` block (lines 264–293) exactly for `mcp` / `defaults`.
- **Validate:** `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"` parses clean.

### Task 2: Skeleton default

- **Do:** Add `"changelog": { "provider": "none" }` to `plugins/flow/templates/ai-skeleton/workflows.config.json` `integrations` block.
- **Validate:** File still valid JSON; `mdcc config get integrations.changelog.provider` (in a scratch `mdcc init` repo) returns `"none"`.

### Task 3: `/flow:release-changelog` command

- **Do:** New file `plugins/flow/commands/release-changelog.md` with frontmatter `name: release-changelog, category: release, description: "Author a changelog entry using the project's configured changelog provider."`. Body steps:
  1. Read `.ai/workflows.config.json` → `integrations.changelog.provider`. If `none` → print "No changelog provider configured. Set `integrations.changelog.provider` in `.ai/workflows.config.json` (e.g. `changesets`)." and exit.
  2. If provider is `changesets`:
     - Detect `.changeset/config.json`. If missing → offer to run `<pm> dlx @changesets/cli init` (auto-detect `pnpm` / `yarn` / `npm` from lockfile). Confirm with user before running.
     - Interactive prompt: bump type (`patch` / `minor` / `major`), summary (multi-line), affected packages (auto-suggest from `package.json` workspaces; default to `integrations.changelog.scope` if set).
     - Write `.changeset/<slug>.md` with valid frontmatter (`"@scope/pkg": <type>`) + body.
  3. If provider in (`git-cliff`, `conventional`, `custom`) → print "Provider `<name>` is not yet implemented in `/flow:release-changelog`. Track in a follow-up PR. For now: author your changelog entry manually using your provider's normal flow." and exit.
- **Pattern:** Other `/flow:*` commands that read config + dispatch on provider (e.g. `/flow:bug-rca` reading `integrations.tracker.provider`) — mirror that shape.
- **Validate:** Run on this repo (provider = `changesets`, .changeset/ exists) → authors a file. Run in a scratch `pnpm init` repo with provider = `changesets` and no `.changeset/` → bootstrap path fires. Run with provider = `none` → exits cleanly.

### Task 4: `/flow:validate` changelog-hygiene step

- **Do:** Append a step to `plugins/flow/commands/validate.md` (after the existing static + scenario gates). Pseudocode:
  ```
  IF integrations.changelog.provider === "changesets":
    diff = git diff --name-only HEAD~1..HEAD -- .changeset/
    IF no new .changeset/*.md added:
      EMIT warning: "⚠️  No changeset since HEAD~1 → run /flow:release-changelog or override"
      MARK validate result as "passed with warnings" (not blocked)
  ELIF provider in (git-cliff, conventional, custom):
    EMIT note: "[validate] changelog: provider `<name>` not yet implemented — skipping (TODO)"
  ELSE (none):
    skip silently
  ```
  Add explicit "this is non-blocking" comment so future maintainers don't promote it to a hard gate without a DDR.
- **Validate:** Make a code change without a changeset, run `/flow:validate` → warning visible, exit status still success. Add a changeset, re-run → no warning.

### Task 5: `/flow:done` changelog reminder

- **Do:** Append the same dispatch logic to `plugins/flow/commands/done.md` at close-out (after validate gate, before commit/push). On provider = `changesets` with no changeset detected: prompt "No changeset detected. Run `/flow:release-changelog` before closing? [y/N]". User can answer N to override — record reason in PR description.
- **Pattern:** Same provider-dispatch shape as Task 4. Factor the detection logic into a single prose block both commands reference (or duplicate — both are .md, no shared code).
- **Validate:** End-to-end on a small change: `/flow:done` without changeset → prompt. Answer y → run /flow:release-changelog → loop back. Answer N → close-out continues, override noted.

### Task 6: DDR-keeper note

- **Do:** Edit `plugins/flow/skills/ddr-keeper/SKILL.md` to add "choosing a changelog provider (e.g. switching from Changesets to git-cliff)" to the list of DDR-worthy decisions.
- **Validate:** File still parses; the prompt list reads naturally.

### Task 7: De-hardcode existing `/flow:execute` + `/flow:quick` mentions

- **Do:**
  - `commands/execute.md:179` — replace `"...with a changeset if needed."` with provider-aware wording: `"...with a changelog entry if your project's `integrations.changelog.provider` calls for one (run `/flow:release-changelog` to author)."`
  - `commands/quick.md:37` — replace the escalation criterion `"Changes that require a changeset"` with `"Changes that need a release-note entry (per `integrations.changelog.provider`) — `/flow:quick` skips changeset authoring; route through `/flow:plan` instead, or run `/flow:release-changelog` post-merge."`
- **Pattern:** Provider name is informational in these strings — neither file needs runtime dispatch.
- **Validate:** Grep `plugins/flow/commands/` for remaining `\bchangeset\b` mentions outside `changelog.md` (where they describe the Changesets tool itself) — only docs/wording context should remain.

### Task 8: Release-guide template + `mdcc init` propagation

- **Do:**
  - Create `plugins/flow/templates/ai-skeleton/release-guide.md` with provider-stub sections. Skeleton structure:
    ```markdown
    # Release Guide — PROJECT_NAME

    > Walked step-by-step by `/flow:release`. Each `##` heading is a step; bash blocks are candidate commands (the slash command asks before running). Edit to match how YOUR project actually releases.

    ## Pre-flight
    - [ ] On `main` with clean working tree
    - [ ] Latest CI green
    - [ ] At least one `.changeset/*.md` (or equivalent) since previous tag

    ## Version bump
    ```bash
    # CHANGELOG_PROVIDER_VERSION_CMD
    ```

    ## Tag & push
    ```bash
    # CHANGELOG_PROVIDER_TAG_CMD
    ```

    ## Publish
    ```bash
    # CHANGELOG_PROVIDER_PUBLISH_CMD
    ```

    ## Post-release
    - [ ] Announce in #releases
    - [ ] Update tracker tickets to `released`
    ```
  - Extend `cli/commands/init.mjs` `TEMPLATED` list to include `release-guide.md`. Add a small substitution dictionary keyed by provider:
    - `changesets` → bump = `pnpm changeset version`, tag = `git tag v$(jq -r .version package.json) && git push --follow-tags`, publish = `pnpm changeset publish` (or "CI handles publish on tag — see `.github/workflows/publish.yml`")
    - `git-cliff` → bump = `git cliff --bump --tag`, tag = `git push --follow-tags`, publish = "(fill in)"
    - `conventional` → bump = `npm version <major|minor|patch>`, tag = `git push --follow-tags`, publish = `npm publish`
    - `custom` / `none` → leave the `# CHANGELOG_PROVIDER_*_CMD` placeholders unmodified with a comment `# TODO: fill in for your project`
  - Pass the selected provider from `mdcc init` (driven by `/flow:onboard` answer in Task 9, or the `--provider` flag if `mdcc init` is invoked standalone) so the right stub lands.
- **Pattern:** Mirror the existing string-replacement in `cli/commands/init.mjs` that handles `PROJECT_NAME` and the schema `$ref` rewrite.
- **Validate:** `mdcc init` against scratch repos with each provider value — open the generated `release-guide.md` and confirm the right stub landed; the `none`/`custom` paths leave clear TODOs.

### Task 9: `/flow:onboard` — auto-detect + ask + scaffold

- **Do:** Edit `plugins/flow/commands/onboard.md`:
  1. **Auto-detect** (after line 168, alongside the existing commit-convention detection):
     ```bash
     CHANGELOG_PROVIDER="none"
     [[ -f "$REPO_ROOT/.changeset/config.json" ]] && CHANGELOG_PROVIDER="changesets"
     [[ "$CHANGELOG_PROVIDER" == "none" && ( -f "$REPO_ROOT/cliff.toml" || -f "$REPO_ROOT/.git-cliff.toml" ) ]] && CHANGELOG_PROVIDER="git-cliff"
     [[ "$CHANGELOG_PROVIDER" == "none" && "$COMMITS" == "conventional" && -f "$REPO_ROOT/CHANGELOG.md" ]] && CHANGELOG_PROVIDER="conventional"
     ```
  2. **Ask** (Step 3, add as Q7): `Changelog provider` — pre-fill with `$CHANGELOG_PROVIDER`. Options: `changesets` | `git-cliff` | `conventional` | `custom` | `none`.
  3. **Propagate** (Step 4): write `integrations.changelog.provider` and (if monorepo detected) prompt for `scope`. Set `releaseGuide` to default `.ai/release-guide.md`.
  4. **Scaffold runbook**: if the chosen provider is not `none`, copy `release-guide.md` from skeleton with the right provider stub baked in (Task 8 wiring). If `none` is chosen, skip scaffolding — user can run `/flow:release init` later (out of scope; just leave a clear gap).
- **Pattern:** Follow the existing `TRACKER_HINT` flow (lines 170–172 + Q4) — auto-detect → ask with pre-fill → propagate.
- **Validate:** Run `/flow:onboard` against three scratch repos: (a) has `.changeset/config.json` → pre-fills `changesets`; (b) has `cliff.toml` → pre-fills `git-cliff`; (c) neither + free-form commits → pre-fills `none`. Each path scaffolds (or skips) the runbook correctly.

### Task 10: `/flow:release` — runbook walker

- **Do:** New file `plugins/flow/commands/release.md`, frontmatter `name: release, category: daily, description: "Walk the project's release runbook step by step with explicit confirmation per command."`. Body:
  1. Read `integrations.changelog.releaseGuide` from config (default `.ai/release-guide.md`).
  2. If the file doesn't exist → print "No release guide found at `<path>`. Run `/flow:onboard` to scaffold one, or create the file manually." and exit.
  3. Parse the runbook: each `##` heading = a step. For each step:
     - Print the step name + any prose between the heading and the first fenced block.
     - For each fenced ```` ```bash ```` block under that step, print the command and ask `[run] / [skip] / [edit] / [abort]`. Never auto-run.
     - On `[run]`: execute via Bash tool with the user's confirmation. Stream output. If the command fails, ask whether to retry, skip, or abort the whole run.
     - On `[edit]`: let user provide a replacement command (one-line input), then re-prompt.
     - On `[abort]`: exit cleanly with a "release aborted at step X" summary.
  4. At the end, print a recap of which steps ran / skipped / failed, and a hint: "If this release went smoothly, consider updating the runbook to reflect any manual edits."
- **Pattern:** This is the same shape as a chat-driven runbook — no shared infrastructure with other commands, just disciplined dispatch.
- **Safety:** Never run a command without explicit `[run]` confirmation. Treat the runbook as untrusted in the sense that it's user-authored — but trusted enough that we surface its commands verbatim (no sandboxing).
- **Validate:** Author a 3-step runbook with bash blocks. Run `/flow:release` → walks through, prompts each block, respects skip/abort. Run with a bogus runbook path → graceful error.

### Task 11: Docs pages (deferred until Phase 2 site lands)

- **Do:** `site/content/docs/flow/changelog.mdx` + `site/content/docs/flow/release.mdx` — cover: configuring `integrations.changelog`, bootstrap behavior, scope semantics, provider matrix, runbook authoring, step-by-step execution model.
- **Note:** Ships **after Phase 2** if the site isn't live yet. Track as carry-over.
- **Validate:** Pages render; copy-paste examples work.

---

## Validation

1. **Static:** `node -e "JSON.parse(...)"` on the schema + skeleton config.
2. **Schema parity:** `npx ajv validate -s plugins/flow/.claude-plugin/config.schema.json -d plugins/flow/templates/ai-skeleton/workflows.config.json` clean.
3. **Smoke — provider = changesets:**
   - Run `/flow:release-changelog` on this repo → writes a `.changeset/*.md`.
   - Run on a fresh `pnpm init` scratch repo with provider = `changesets` and no `.changeset/` → bootstrap path fires, file written.
4. **Smoke — provider dispatch:**
   - Set provider = `git-cliff` → `/flow:release-changelog` prints "not yet implemented" and exits 0.
   - Set provider = `none` → `/flow:validate` skips the changelog step silently; `/flow:done` does too.
5. **Soft-gate behaviour:**
   - With provider = `changesets`, make a code change without authoring a changeset → `/flow:validate` exits success with a warning; `/flow:done` prompts but is overridable.
6. **Onboard auto-detect:**
   - Scratch repo with `.changeset/config.json` → `/flow:onboard` pre-fills `changesets` in Q7.
   - Scratch repo with `cliff.toml` → pre-fills `git-cliff`.
   - Scratch repo with neither + non-conventional commits → pre-fills `none`.
7. **Release runbook:**
   - After `mdcc init --provider=changesets`, `.ai/release-guide.md` contains the changesets-specific bash blocks.
   - `/flow:release` parses the runbook, prompts per step, runs only on `[run]`, exits cleanly on `[abort]`.
   - Bogus path in `integrations.changelog.releaseGuide` → graceful error.
8. **De-hardcode check:** `rg -n '\bchangeset\b' plugins/flow/commands/` shows mentions only inside `changelog.md` (where it describes the Changesets tool), `release.md`, `release-guide.md` examples, or provider-name strings — no bare "changeset" leakage in `execute.md` / `quick.md`.

---

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `flow-changelog-bootstrap` | Fresh repo, provider = `changesets`, no `.changeset/` → `/flow:release-changelog` bootstraps and writes first file | 🆕 new |
| `flow-validate-changelog-warn` | Code change, no changeset, provider = `changesets` → `/flow:validate` exits success with warning | 🆕 new |
| `flow-done-changelog-prompt` | Same, `/flow:done` → prompt, user override path + author-then-continue path | 🆕 new |
| `flow-changelog-provider-noop` | Provider in (`git-cliff`, `conventional`) → `/flow:release-changelog` no-ops cleanly, `/flow:validate` emits the "not yet implemented" note | 🆕 new |
| `flow-onboard-provider-autodetect` | `/flow:onboard` against repos with `.changeset/config.json`, `cliff.toml`, and neither → pre-fills Q7 correctly and scaffolds matching `release-guide.md` | 🆕 new |
| `flow-release-runbook-walk` | `/flow:release` reads `.ai/release-guide.md`, walks 3 steps, exercises `[run]` + `[skip]` + `[abort]` per step | 🆕 new |

---

## Acceptance criteria

- [ ] `integrations.changelog.{provider, scope, releaseGuide, mcp, defaults}` lives in the schema, mirroring `tracker`.
- [ ] Skeleton config defaults to `{"changelog": {"provider": "none"}}`.
- [ ] `/flow:release-changelog` works against this repo (changesets, prior init) and a scratch repo (bootstrap path); exits cleanly for `none` and unimplemented providers.
- [ ] `/flow:validate` emits a **non-blocking** warning when provider = `changesets` and no changeset is present.
- [ ] `/flow:done` emits the same warning at close-out, with an override path.
- [ ] `/flow:onboard` auto-detects provider from filesystem markers, asks Q7 with pre-fill, scaffolds `release-guide.md` with the right provider stub.
- [ ] `/flow:release` exists, parses the runbook at `integrations.changelog.releaseGuide`, walks steps with explicit per-command confirmation, never auto-runs.
- [ ] Skeleton `release-guide.md` template exists with provider-specific stubs for `changesets`, `git-cliff`, `conventional`; `custom`/`none` leave clear TODOs.
- [ ] `cli/commands/init.mjs` swaps the provider stub during copy (joins the `TEMPLATED` list).
- [ ] No bare `changeset` strings leak in `execute.md` / `quick.md` — both reference the provider abstraction.
- [ ] DDR-keeper skill flags provider-choice as a DDR-worthy decision.
- [ ] Future providers (`git-cliff`, `conventional`, `custom`) are reachable via config but stub to a clear "not yet implemented" message in `/flow:release-changelog` — no silent failure. `/flow:release` works for **all** providers because the runbook is user-authored.
- [ ] Flow⇄design seam (handoff sweep, design-canvas detection in `/flow:plan`) explicitly out of scope — Phase 11.
- [ ] Docs pages either land in Phase 3 or tracked as carry-over to Phase 2.
