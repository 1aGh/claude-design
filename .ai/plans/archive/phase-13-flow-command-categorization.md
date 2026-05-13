# Phase 13: Flow command categorization (strict prefix naming, no subfolders)

> **Research finding (2026-05-12):** Subfolder-based slash-command namespacing is **not supported** by Claude Code.
>
> - `.claude/commands/<group>/cmd.md` — [Issue #2422](https://github.com/anthropics/claude-code/issues/2422) closed as "not planned"; [Issue #44678](https://github.com/anthropics/claude-code/issues/44678) is an open feature request (April 2026) with no implementation.
> - Plugin `commands/` — [officially **flat .md files**](https://code.claude.com/docs/en/plugins-reference). Subdirs are interpreted as skill folders (one `SKILL.md` per subdir = one skill named after the subdir), not as group-namespace prefixes.
> - Closest we can get to `/flow:bugs:fix` is `/flow:bug-fix` (single colon, dash separator). Prefix autocomplete (`/flow:bug-`) gives equivalent UX.
>
> Therefore: categorization comes from **strict naming convention + `category:` frontmatter + docs + `/flow:help` aggregator**, not from filesystem layout. This phase formalizes `<group>-<verb>` prefix for **every non-daily command** (10 renames across 8 groups).

## Description

Reshape the 29 `/flow:*` commands (26 existing + 3 Phase 3 additions: `help`, `release-changelog`, `release-cut`) so every command except daily-use ones carries a group prefix. Result:

- **Daily commands** stay terse (`/flow:plan`, `/flow:execute`, `/flow:done`, …).
- **Every other command** uses `<group>-<verb>` (`/flow:bug-fix`, `/flow:setup-onboard`, `/flow:record-ddr`, `/flow:release-changelog`, …).
- **No physical subdirectories** under `plugins/flow/commands/` — research-validated as non-functional.
- **`/flow:help`** aggregates the grouped index from `category:` frontmatter for navigation.
- **`plugins/flow/CATEGORIES.md`** is the canonical group catalog.

## User Story

As a user new to `flow` (or returning), I want every non-daily command to advertise its group through its name, so typing `/flow:bug-` autocompletes only bug commands, `/flow:setup-` only setup commands, etc. — and `/flow:help` gives me the grouped index whenever I forget.

## Problem

- 26 flat `/flow:*` commands today. `/help` lists alphabetically; daily-use mixes with one-shot mixes with specialized. No structural signal.
- Naming is half-applied: `bug-*`, `validate-*`, `maintain-*` already follow prefix; `onboard`, `ddr`, `retro`, `code-review`, `ai-health`, `execution-report`, `context`, `create-prd`, `map-codebase` don't.
- Phase 3 adds `/flow:changelog` and `/flow:release` — flat names that don't signal their relationship.
- No authoritative document declares groups; each new command picks its name ad-hoc; categorization drifts.

## Solution

Treat categorization as a **naming + docs** problem (the filesystem can't enforce it).

1. **Strict prefix convention:** non-daily → `<group>-<verb>`. Daily → terse verb-only.
2. **Per-command frontmatter:** add `category: <group>`. Tooling-readable.
3. **`plugins/flow/CATEGORIES.md`** — canonical group catalog (group name, description, member commands).
4. **`/flow:help`** — reads frontmatter, prints grouped index. Goes in `daily`.
5. **`README.md` + `CLAUDE.md`** — document the convention; point at `CATEGORIES.md`.
6. **Backwards-compat stubs** — for renamed commands, ship `<old-name>.md` for one minor version that just prints "renamed → /flow:<new-name>".

## Metadata

- **Type:** Refactor + new capability (`/flow:help`)
- **Complexity:** Medium (10 renames + frontmatter touches on every command + new aggregator + stubs)
- **Parallel with:** Phase 2 (docs site consumes the grouping)
- **Coordinates with:** Phase 3 (Phase 3 ships `release-changelog` + `release-cut` directly — no rename needed if Phase 3 lands with the final names)
- **Depends on:** none — standalone
- **Affected files:**
  - `plugins/flow/CATEGORIES.md` — **new**, canonical group catalog
  - `plugins/flow/commands/help.md` — **new**, grouped index aggregator
  - `plugins/flow/commands/*.md` — all 26 existing files get `category:` frontmatter; 10 are renamed
  - 10 backwards-compat stubs (one per rename) — see Task 5
  - `plugins/flow/README.md` — grouped index, naming convention
  - `CLAUDE.md` — naming-convention note under Architecture
  - References to old slash names across the repo (docs, other commands, skills, scenarios) — swept and updated
  - `site/content/docs/flow/index.mdx` — Phase 2 carry-over

## Final categorization (29 commands → 8 groups)

| Group | Count | Commands |
|---|---|---|
| **daily** (no prefix) | 11 | `plan`, `execute`, `done`, `status`, `pause`, `resume-task`, `scenario`, `quick`, `validate`, `release`, `help` ◆ |
| **utils-*** | 1 | `utils-verify` ◇ (was `verify`) |
| **setup-*** | 4 | `setup-onboard` ◇ (was `onboard`), `setup-prd` ◇ (was `create-prd`), `setup-codebase-map` ◇ (was `map-codebase`), `setup-context` ◇ (was `context`) |
| **validate-*** | 2 | `validate-a11y`, `validate-visual` |
| **bug-*** | 2 | `bug-rca`, `bug-fix` |
| **record-*** | 3 | `record-ddr` ◇ (was `ddr`), `record-retro` ◇ (was `retro`), `record-execution` ◇ (was `execution-report`) |
| **maintain-*** | 4 | `maintain-clean`, `maintain-docs`, `maintain-ai-health` ◇ (was `ai-health`), `maintain-discover` ◇ (was `discover`) |
| **review-*** | 1 | `review-code` ◇ (was `code-review`) |
| **release-*** (Phase 3) | 1 | `release-changelog` (was `changelog` in Phase 3 draft) — sibling of daily `release` |

**Total:** 11 + 1 + 4 + 2 + 2 + 3 + 4 + 1 + 1 = **29 commands**

- ◆ = new in Phase 13
- ◇ = rename in Phase 13
- Phase 3 commands ship with their final names directly (no separate rename pass)

**Counted: 11 renames in Phase 13** + 2 Phase 3 commands named correctly at birth.

### Parent/group pattern: `validate` and `release`

Two commands sit in `daily` AND act as parents of specialized groups:

- **`/flow:validate`** (daily) = full validation pipeline. **`validate-a11y` / `validate-visual`** = specialized validators called by the parent or directly.
- **`/flow:release`** (daily) = walk the release runbook (the verb-action "do the release"). **`release-changelog`** = specialized release-time authoring (write a changelog entry). Future siblings: `release-version`, `release-publish` may join.

This `<verb>` parent + `<verb>-<specialization>` group is a deliberate pattern. Don't promote `validate-a11y` to daily just because the parent is daily — the suffix tags it as specialized.

### Group definitions (drives `CATEGORIES.md` prose)

- **daily** — Verb-as-complete-action, called in every feature cycle. Terse names. Includes `validate` (parent of `validate-*`).
- **utils-*** — Sub-commands of other commands. Not a primary user action; primarily called from inside `/flow:execute` or similar. Today: only `utils-verify`.
- **setup-*** — One-shot per project or per major chunk. Bootstrapping operations.
- **validate-*** — Specialized validators. Called by `/validate` parent or directly when the user wants only one.
- **bug-*** — Incident workflow (RCA → fix).
- **record-*** — Knowledge capture (decisions, retrospectives, execution reports).
- **maintain-*** — Hygiene: cleanup, docs freshness, AI infrastructure health.
- **review-*** — Pre-commit / pre-PR review.
- **release-*** — Release-time work (authoring changelog entries, cutting releases).

### Why `verify` is `utils-*` but `scenario` / `validate-a11y` stay in their groups

`verify` is **only meaningful inside `/execute`'s Edit-Verify Loop** — it's a light per-task check, not a standalone validation surface (we have `/validate` for that). It's a true internal step.

`scenario`, `validate-a11y`, `validate-visual`, `record-execution` are *also* called by other commands internally (`/done`, `/validate`), but each has **legitimate standalone user value** (spot-checking a flow, running an a11y audit on a single page, generating an ad-hoc report). They live in their domain groups, not in `utils-*`.

### Why `ddr` becomes `record-ddr` (and we accept "Record Design Decision Record" stutter)

DDR is an established acronym in software architecture. Renaming to `record-ddr` is double-redundant. But the user explicitly chose **strict consistency over recognized-acronym exception** — every non-daily command gets a group prefix, no exceptions. The stutter is the cost of zero-exception consistency. Documented as established term in `CATEGORIES.md`.

---

## Context References

### Must-read files

- `plugins/flow/commands/` — all 26 command files. Existing frontmatter pattern (`name`, `description`).
- `plugins/flow/.claude-plugin/plugin.json` — namespace = `flow`.
- `.claude-plugin/marketplace.json` — marketplace entry.
- `.ai/plans/phase-3-flow-changelog.md` — Phase 3 must ship with `release-changelog` + `release-cut` names directly.

### Patterns to follow

Existing prefix-grouped commands already use `<group>-<verb>`:
- `validate-a11y` / `validate-visual` — specialized variant of `validate`.
- `bug-rca` / `bug-fix` — workflow within a group.
- `maintain-clean` / `maintain-docs` — hygiene operations.

The 10 renames extend this pattern to every non-daily command.

### External research

- [Issue #2422](https://github.com/anthropics/claude-code/issues/2422) — subfolder namespacing closed "not planned".
- [Issue #44678](https://github.com/anthropics/claude-code/issues/44678) — open feature request, April 2026.
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) — `commands/` is "flat .md files or SKILL.md in subdirectories" (subdir = one skill, not group).

---

## Tasks

### Task 1: Author `CATEGORIES.md`

- **Do:** Create `plugins/flow/CATEGORIES.md`:
  1. Top: naming convention statement (`<group>-<verb>` for non-daily; daily = terse verb).
  2. One section per group (8 sections): group name, one-line definition, table of commands (name, description from frontmatter, typical trigger).
  3. Footer: rename history table (old → new, reason).
- **Pattern:** Mirror the dense scannable layout of `.ai/plans/README.md`.
- **Validate:** Every command in `plugins/flow/commands/` (post-rename) appears in exactly one group; total = 29.

### Task 2: Rename 11 command files

- **Do:** Eleven `git mv` operations + frontmatter `name:` field update for each. In order:
  1. `verify.md` → `utils-verify.md` ; `name: verify` → `name: utils-verify`
  2. `onboard.md` → `setup-onboard.md` ; `name: onboard` → `name: setup-onboard`
  3. `create-prd.md` → `setup-prd.md` ; `name: create-prd` → `name: setup-prd`
  4. `map-codebase.md` → `setup-codebase-map.md` ; `name: map-codebase` → `name: setup-codebase-map`
  5. `context.md` → `setup-context.md` ; `name: context` → `name: setup-context`
  6. `ddr.md` → `record-ddr.md` ; `name: ddr` → `name: record-ddr`
  7. `retro.md` → `record-retro.md` ; `name: retro` → `name: record-retro`
  8. `execution-report.md` → `record-execution.md` ; `name: execution-report` → `name: record-execution`
  9. `ai-health.md` → `maintain-ai-health.md` ; `name: ai-health` → `name: maintain-ai-health`
  10. `discover.md` → `maintain-discover.md` ; `name: discover` → `name: maintain-discover`
  11. `code-review.md` → `review-code.md` ; `name: code-review` → `name: review-code`
- **Validate:** `ls plugins/flow/commands/` shows the 11 new names; old filenames absent (compat stubs land in Task 5 under the old filenames).

### Task 3: Add `category:` frontmatter to every command

- **Do:** For each of the 28 files (26 existing post-rename + Phase 3's `release-changelog.md`, `release-cut.md` if Phase 3 has already landed — otherwise these get the field at Phase 3 author time), add a `category: <group>` line right after `name:`. Categories per Task 1 table.
- **Pattern:** Frontmatter shape:
  ```yaml
  ---
  name: bug-fix
  category: bug
  description: Implement fix from RCA document for GitHub issue
  ---
  ```
- **Validate:** `for f in plugins/flow/commands/*.md; do grep -q '^category:' "$f" || echo "MISSING: $f"; done` returns empty (excluding compat stubs from Task 5 which don't need `category:`).

### Task 4: Sweep references to old command names

- **Do:** `rg -n '/flow:(verify|onboard|create-prd|map-codebase|context|ddr|retro|execution-report|ai-health|discover|code-review)\b' --type md` — for every hit, replace with the new slash name. Likely hits:
  - Other commands referencing each other (e.g., `done.md` may mention `execution-report`)
  - Plugin `README.md`
  - Skills (`skill-loader`, `workflow-state`, `ddr-keeper`, …) that mention specific slash commands
  - `.ai/` skeleton if it references slash commands
  - PRDs, plans, retros
- **Pattern:** Mechanical find-replace per command; verify each hit by hand (some mentions may be historical and should keep old names).
- **Validate:** Re-run the rg; remaining hits are inside this plan, `CATEGORIES.md` rename history, or commits / changelog entries describing the rename.

### Task 5: Author backwards-compat stubs

- **Do:** Create 11 stub files under the **old** filenames, each just printing a one-line redirect:
  ```yaml
  ---
  name: ddr
  description: "Renamed to /flow:record-ddr. This stub will be removed in the next minor version."
  category: deprecated
  ---

  This command has been renamed. Run `/flow:record-ddr` instead.
  ```
- **Pattern:** Minimal stub — no body, frontmatter only.
- **Removal scheduled:** Next minor version after Phase 13 lands. Track via DDR or changelog entry. Add a TODO comment at the top of each stub file with the removal target version.
- **Validate:** Run `/flow:ddr` → sees stub message redirecting to `/flow:record-ddr`. Run `/flow:record-ddr` → actual command executes.

### Task 6: Author `/flow:help` aggregator command

- **Do:** New file `plugins/flow/commands/help.md`:
  ```yaml
  ---
  name: help
  category: daily
  description: List all flow commands grouped by category.
  ---
  ```
  Body:
  1. Read `category:` frontmatter from all files in `plugins/flow/commands/` (excluding `category: deprecated` stubs).
  2. Group by `category:`. Print group heading + a 2-column table per group: command name | description.
  3. Use group ordering from `CATEGORIES.md`: daily → utils → setup → validate → bug → record → maintain → review → release.
  4. Footer: list of renamed-in-this-version commands with old → new mapping (show for one minor version, then drop alongside compat stub removal).
- **Trade-off:** Reads frontmatter at run-time (no `CATEGORIES.md` drift) but uses `CATEGORIES.md` only for group ordering + group descriptions.
- **Validate:** Run `/flow:help` → 8 group sections appear; counts match (10/1/4/2/2/3/3/1/2 = 29 total minus deprecated stubs).

### Task 7: Update plugin README

- **Do:** Edit `plugins/flow/README.md`:
  - Replace any alphabetical command list with the grouped index, linking to `CATEGORIES.md`.
  - Add a "Type `/flow:help` for the live index" hint.
  - Add a "Naming convention" subsection: `<group>-<verb>` for non-daily; daily commands stay terse.
- **Validate:** Render; daily group appears first; convention statement visible.

### Task 8: Update project CLAUDE.md

- **Do:** Add a `### Flow command naming` sub-section under `## Architecture` documenting the convention (~5 lines + table reference to `CATEGORIES.md`).
- **Pattern:** Match existing `## Architecture` sub-heading style.
- **Validate:** Section present; doesn't break existing structure.

### Task 9: Coordinate with Phase 3 — `release-*` group ships at birth

- **Do:** Ensure Phase 3 plan + implementation uses `release-changelog` and `release-cut` as the final command names (not `changelog` / `release`). This prevents a separate rename pass on Phase 13. Edit `.ai/plans/phase-3-flow-changelog.md` accordingly.
- **Pattern:** If Phase 3 lands first → it ships with the final names directly. If Phase 13 lands first → no `release-*` commands yet; the `CATEGORIES.md` notes them as "coming in Phase 3".
- **Validate:** `rg '/flow:changelog\b|/flow:release-cut\b' .ai/plans/phase-3-flow-changelog.md` returns no matches (those were Phase 3 draft names); only `/flow:release` (daily parent) and `/flow:release-changelog` (release-* member) should be referenced.

### Task 10: (Phase 2 carry-over) Docs-site flow index

- **Do:** When Phase 2 docs-site lands, the flow page reads `CATEGORIES.md` (or live frontmatter via a build-time script) and renders the grouped index.
- **Note:** Out of scope for Phase 13 standalone.
- **Validate:** Phase 2's flow docs page shows the same 8-group breakdown.

---

## Validation

1. **Counts:** `ls plugins/flow/commands/*.md | wc -l` = 40 (29 live commands + 11 compat stubs).
2. **Frontmatter completeness:** every non-stub file has `name`, `category`, `description`.
3. **Group sums (live commands only):** `rg -h '^category: ' plugins/flow/commands/*.md | grep -v deprecated | sort | uniq -c` matches Task 1 table (11/1/4/2/2/3/4/1/1).
4. **No stale references:** `rg '/flow:(verify|onboard|create-prd|map-codebase|context|ddr|retro|execution-report|ai-health|discover|code-review|changelog|release-cut)\b' --type md` outside this plan + rename history is empty.
5. **`/flow:help` smoke:** runs, prints 8 groups, no broken sections.
6. **Stub smoke:** running each old slash name prints the redirect message and exits cleanly.
7. **Phase 3 alignment:** Phase 3 plan uses only `release-changelog` and `release-cut`; no leftover `changelog` / `release` standalone names.

---

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `flow-help-index` | `/flow:help` → 8 groups appear, counts correct, descriptions readable | 🆕 new |
| `flow-rename-stub-redirect` | Run `/flow:ddr` (old name) → stub redirects to `/flow:record-ddr`; run `/flow:record-ddr` → actual command runs | 🆕 new |
| `flow-prefix-autocomplete-ux` | Type `/flow:bug-` → only `bug-rca` + `bug-fix` show; `/flow:setup-` → only setup-* members. (Verify via manual test — autocomplete UX isn't automatable.) | manual |

---

## Open decisions

1. **Compat-stub removal target:** "next minor version" is vague. **Recommendation:** record an explicit DDR with date (e.g., "remove all `category: deprecated` stubs after `v1.1.0` ships, ETA Q3 2026").
2. **`/flow:help` source of truth:** read frontmatter at run-time, or read `CATEGORIES.md`? **Recommendation:** hybrid — frontmatter for command list (no drift), `CATEGORIES.md` for group ordering + group prose.
3. **Strict acronym handling (`ddr` → `record-ddr` stutter):** user explicitly chose strict consistency over established-acronym exception. Locked.

---

## Acceptance criteria

- [ ] `plugins/flow/CATEGORIES.md` exists; lists all 29 live commands across exactly 8 groups.
- [ ] Every `plugins/flow/commands/*.md` (excluding `category: deprecated` stubs) has `name`, `category`, `description` in frontmatter.
- [ ] 11 renames applied via `git mv`; old filenames present only as compat stubs.
- [ ] 11 compat stubs ship with `category: deprecated` and a redirect message; removal scheduled.
- [ ] `/flow:help` lands; prints the grouped index with correct counts per group.
- [ ] Plugin `README.md` + project `CLAUDE.md` document the convention.
- [ ] Phase 3 plan ships with final `release-changelog` and `release-cut` names — no double-rename.
- [ ] No physical subdirectories under `plugins/flow/commands/` (research-validated as non-functional).
- [ ] (Carry-over) Phase 2 docs-site flow page consumes `CATEGORIES.md`.

---

## Confidence

**7/10** — More moving parts than the original v1 (10 renames + 10 stubs + Phase 3 coordination). Mechanically simple per file, but lots of files to touch and many cross-references to sweep. Risk = missing a stale `/flow:<old-name>` reference somewhere in a skill or scenario. Mitigation: Task 4's rg sweep is exhaustive.

---

## Retro

- **Worked:** The strict prefix convention paid for itself instantly — typing `/flow:bug-` or `/flow:setup-` in autocomplete now narrows visibly. The `category:` frontmatter + `/flow:help` aggregator means new commands appear in the index without any catalog edit. `CATEGORIES.md` rename-history table cleanly absorbs the historical references that would otherwise pollute the sweep.
- **Didn't work the first time:** My initial reference sweep used `rg --type md` without `--hidden`, which silently skipped every dot-prefixed directory — `.ai/`, `.github/`, `plugins/flow/.claude-plugin/`. The `/flow:validate` step reported "0 stale refs" but missed 22 user-facing references across 14 files (`.ai/README.md`, `.ai/INDEX.md`, `.ai/docs/PRD.md`, the config schema, the GitHub issue template, etc.). Only the user-triggered triple-audit (three parallel Explore agents) caught this. **Lesson: any future repo-wide sweep MUST use `rg --hidden -uu` or equivalent.**
- **Plan/execute lessons:** The plan said "8 groups" in the section header but the table listed 9 — a typo that propagated for a beat before I noticed. Future plans: assert the count in two places programmatically (e.g. "table below has N rows, verify wc -l").
- **Acronym carve-out tempted us:** Renaming `ddr` to `record-ddr` makes "Record Design Decision Record". The plan locked strict consistency early — without that, we'd have an exception list bikeshed forever. The footnote in `CATEGORIES.md` documents the trade.
- **Audit-first beats verify-first.** The 3× parallel auditor pass found more in 30 seconds than my own `rg` could after two manual sweeps, because each auditor was given an orthogonal scope and no shared context. Worth repeating on any future refactor of this size.

