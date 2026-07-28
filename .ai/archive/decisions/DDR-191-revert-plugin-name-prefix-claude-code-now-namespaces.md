# DDR-191: Revert the `<plugin>:` prefix baked into plugin `name:` frontmatter — Claude Code now namespaces it itself

- **Date:** 2026-07-28
- **Status:** Accepted
- **Tags:** flow, design, plugin-design, slash-commands, naming, regression, upstream-drift
- **Related:** [DDR-006](./DDR-006-plugin-namespace-in-name-frontmatter.md) (superseded by this DDR), `.ai/logs/rca/issue-plugin-name-prefix-doubling.md`, Claude Code changelog 2.1.216 + 2.1.218, `cli/lib/plugin-name-namespace.test.mjs`

## Context

A user screenshot showed slash-command autocomplete offering `/design:design:new`, `/design:design:edit`, `/design:design:init` — every plugin command doubled its namespace. `/flow:bug-rca` traced it to DDR-006 (2026-05-13).

DDR-006 made `name: <plugin>:<slug>` (e.g. `name: design:new`) mandatory frontmatter across every plugin command, agent, and skill, as a workaround for a Claude Code bug ([issue #22063](https://github.com/anthropics/claude-code/issues/22063)): at the time, setting `name:` at all caused Claude Code to register the **bare slug**, stripping the plugin namespace and colliding with built-ins (`plugins/flow/commands/resume.md` registered as bare `/resume`, colliding with the native resume-conversation command). DDR-006's own "Negative" section flagged the risk explicitly:

> Depends on a Claude Code behavior that may change. If the underlying bug (#22063) gets fixed and Claude Code starts namespacing automatically when `name:` is bare, our explicit prefix will either be redundant (best case) or get double-prefixed (worst case, e.g. `/flow:flow:resume`).

That worst case landed. The Claude Code changelog documents the fix directly:

- **2.1.216**: *"Fixed plugin skills with a `name` frontmatter field losing their plugin prefix in slash-command autocomplete."* — the exact #22063 behavior DDR-006 worked around.
- **2.1.218**: *"Changed agent markdown files to reject agent names containing `:`, which is reserved for plugin namespacing."* — `:` in an agent's `name:` is now explicitly reserved for the runtime, not for us to pre-fill.

Live evidence in the reporting session confirmed it empirically: `plugins/design/agents/a11y-critic.md` declares `name: design:a11y-critic`, and the session's own agent registry (sourced from the currently-installed `maude@1aGh/maude` v0.47.0 plugin) listed it as `design:design:a11y-critic`. A negative control in the same registry — `_draw-design-rules.md`, which has **no** frontmatter at all — registered as `design:_draw-design-rules`, single-prefixed, isolating the runtime as the sole source of the `<plugin>:` prefix. A third-party plugin in the same session (`vercel`) registers its agents single-prefixed (`vercel:ai-architect`) while declaring bare `name:` values, matching the target convention this DDR restores.

## Decision

**Revert DDR-006's core rule.** `name:` frontmatter goes back to the **bare slug** — no `<plugin>:` prefix — across every command, agent, and skill in `plugins/design/` and `plugins/flow/`. The `<plugin>:` prefix is the runtime's job now, not ours.

1. **114 files swept** (bulk mechanical edit, one line each — `name:` is always line 2 of the frontmatter block, verified unique-per-file before the edit): 23 design commands, 20 design agents, 8 design skills, 31 flow commands, 11 flow agents, 21 flow skills. `init.md` keeps DDR-006's bare-verb carve-out unchanged — `name: init` was already exactly `<plugin>:init` minus the prefix, so the generic strip lands it correctly with no special-casing.

2. **`help.md` renderers reversed back.** `plugins/design/commands/help.md` and `plugins/flow/commands/help.md` now render `/<plugin>:<name>` (re-instating what DDR-006 step 2 removed), since `name:` is no longer the fully-qualified form.

3. **`subagent_type:` references normalized to single-prefix form** (`<plugin>:<slug>`) — this is empirically the correct target, not bare: the runtime always adds its own `<plugin>:` prefix on top of whatever `name:` says, so a `subagent_type` caller must supply the same prefix to hit the registry key. Three inconsistent forms existed pre-fix (evidence the doubling was already causing silent breakage):
   - 7 doubled refs in `plugins/design/skills/design-system/_bootstrap.md` (`design:design:signature-moment-critic` → `design:signature-moment-critic`) — stripped one level.
   - 2 bare refs in `plugins/flow/commands/validate-security.md` (`security-auditor`, `ethical-hacker` — both real plugin agents) — prefixed to `flow:security-auditor` / `flow:ethical-hacker`.
   - 2 bare refs in `plugins/design/commands/critic.md` / `plugins/design/skills/design/SKILL.md` (`design-system-completeness-critic`, the `design-critic`/`signature-moment-critic` list) — prefixed.
   - Bare `code-simplifier` in `flow/commands/{execute,review-code}.md` **left untouched** — it is a Claude Code built-in agent, not one of ours (confirmed: no `code-simplifier.md` exists under either plugin's `agents/`).
   - 20 already-correct single-prefixed refs (`design:draw-agent`, `design:reconstruct-critic`, …) — unchanged.

4. **New regression guard**: `cli/lib/plugin-name-namespace.test.mjs`, wired into `npm test` (already in `quality.yml`). Three assertions: no `name:` frontmatter carries a `design:`/`flow:` prefix; no `design:design:`/`flow:flow:` string exists anywhere in plugin markdown; every `subagent_type:` reference to one of our own plugin agents carries exactly one prefix. Verified to fail loudly against a deliberately reintroduced prefix before being left green.

## Verification

- **Non-interactive**, not the live `/plugin marketplace update` + `/reload-plugins` probe DDR-006's own methodology used (and which the RCA proposed as a blocking Step 0) — the changelog evidence above plus the live-session registry observation were strong enough to skip the manual reload round-trip. `claude plugin validate <path>` (the same static-manifest validator Claude Code ships, run via the `claude plugin validate` CLI subcommand) was used to sanity-check frontmatter parses cleanly; it does not itself assert on namespace doubling since that's a registration-time behavior, not a manifest-shape rule.
- `npm test` — all 216 tests pass, including the new 3-test guard and the pre-existing `cli/lib/reconstruct-toolset.test.mjs` (which already asserted the single-prefixed `design:reconstruct-critic` form — that file's `subagent_type` values were already correct pre-fix and needed no change).
- Grep-verified: exactly 114 `name:` lines changed (114 removed, 114 added), each a single-line diff, zero collateral changes to descriptions/prose (pre-verified every match was unique-per-file and on line 2 before the bulk edit ran).

## Consequences

### Positive
- Slash-command autocomplete and the agent registry stop doubling. `/design:new`, `/flow:plan`, `design:a11y-critic` render correctly again.
- `subagent_type` routing bugs latent in `_bootstrap.md` (7 refs) and `validate-security.md` (2 refs) are fixed as a side effect — these were silently broken before this DDR, not merely cosmetic.
- A durable test (`plugin-name-namespace.test.mjs`) exists where DDR-006 only had a one-time manual grep — the next upstream reversal, if any, will fail CI instead of drifting silently (as the `_bootstrap.md` doubling did).

### Negative — the DDR-006 collision risk returns on old Claude Code versions
Reverting re-opens the **original** #22063-era collision for any user still on a Claude Code version predating 2.1.216: `flow:resume` → bare `/resume`, colliding with the native resume-conversation command; similarly `flow:init`/`flow:status` vs. the built-ins. This repo does not currently pin or document a minimum Claude Code version. Accepted as a known gap — the plugins already track current Claude Code closely (this repo's own local-dev workflow assumes a recent CLI), and the alternative (permanently living with a doubled prefix for every user, forever, to protect a shrinking population on a multi-months-stale CLI) is worse. Revisit if this surfaces as a real support burden.

### Still open — cross-surface inconsistency (not fixed here, upstream-owned)
`name:` frontmatter is authoritative for slash-command autocomplete and the agent registry (both now correctly single-prefix bare-slug), but the **Skill-tool listing of commands** keys on filename and the **skill registry** keys on directory name — both ignore `name:` entirely. This didn't matter under DDR-006 (all forms coincidentally rendered the same single prefix), and doesn't matter under this DDR either (same reason, now via the opposite mechanism), but it means `name:` is silently dead weight on two of the four surfaces that read it. Not worth fixing — no observed breakage — but worth knowing if a future surface starts honoring it.

## Migration impact

- **114 plugin files**: `name:` frontmatter stripped to bare slug (mechanical, one line each).
- **2 files**: `help.md` render instructions + table templates reversed to prepend `/<plugin>:`.
- **6 files**: `subagent_type:` references normalized (7 doubled refs in 1 file, 4 bare refs across 3 files).
- **1 new file**: `cli/lib/plugin-name-namespace.test.mjs`.
- **This DDR + DDR-006 superseded-status edit.** `CLAUDE.md` § "Plugin command naming", both `CATEGORIES.md`, and `site/content/docs/design/categories.mdx` updated in the same change.
- **Intentionally NOT touched**: `CHANGELOG.md`, `.ai/plans/archive/**`, `.ai/state/STATE.md` — same reasoning DDR-006 itself used: they record historical state at time of writing, updating them would be revisionist.

## Open questions / followups

- **Minimum Claude Code version.** No mechanism today asserts or documents one. If the pre-2.1.216 collision surfaces as a real complaint, add a version floor (README badge / `plugin.json` engine constraint, if Claude Code ever supports one) rather than re-reverting.
- **A separate, unrelated bug surfaced during this investigation**: `claude plugin validate` reports genuine YAML frontmatter parse failures (metadata silently dropped at runtime) on 11 files — `plugins/design/skills/design-system/SKILL.md`, 4 design agents (`footage-analyst`, `design-system-keeper`, `media-generation-director`, `footage-director`), 5 design commands (`photo`, `video-analyze`, `draw`, `edit`, `reel`), and `plugins/flow/commands/record-retro.md`. Root cause (spot-checked on `edit.md`): an un-quoted `description:` value containing `: ` mid-sentence (e.g. *"Default: after the edit, …"*), which a plain YAML scalar cannot contain without ambiguity. Out of scope for this DDR — file a separate RCA/ticket; it is unrelated to plugin namespacing and was already present before this change.
