# DDR-003: `/flow:release` walks a user-authored runbook instead of dispatching on provider

- **Date:** 2026-05-12
- **Status:** Accepted
- **Tags:** flow, release, changelog, design-pattern, provider-abstraction
- **Related:** `.ai/plans/phase-3-flow-changelog.md`, `plugins/flow/commands/release.md`, `plugins/flow/commands/release-changelog.md`, `plugins/flow/templates/ai-skeleton/release-guide.md`, [DDR-002](DDR-002-changesets-release-flow.md)

## Context

Phase 3 adds two new flow commands tied to release workflows:

1. `/flow:release-changelog` — authors a per-PR release-note entry. **Provider-dispatched** (changesets-specific bash today; stub for git-cliff / conventional / custom).
2. `/flow:release` — actually cuts the release.

The initial Phase 3 draft (v5/v6) implied `/flow:release` would also be provider-dispatched: changesets → `pnpm changeset version` + `git tag` + `pnpm changeset publish`; git-cliff → `git cliff --bump --tag` + …; etc. That keeps the abstraction symmetric with `/flow:release-changelog`.

But every team's release flow has wrinkles that don't fit a generic provider template: monorepo sub-package releases, manual smoke gates between version-bump and publish, staged rollouts, CI-driven publishes vs. local-driven, custom announcements, dependent-repo bumps. Provider-specific dispatch would either ignore those wrinkles (uselessly generic) or grow into a sprawling option matrix.

We had to pick: lock `/flow:release` to a small number of provider-specific runbooks, or give the user a runbook of their own that the command merely orchestrates.

## Decision

`/flow:release` is **provider-agnostic**. It walks a user-authored Markdown runbook at `integrations.changelog.releaseGuide` (default `.ai/release-guide.md`), parsing `##` headings as steps and ` ```bash ` blocks as candidate commands. Every command is gated behind explicit `[run] / [skip] / [edit] / [abort]` confirmation — **default = skip** so an accidental Enter is safe.

`mdcc init --provider <name>` seeds the runbook with a provider-appropriate starter stub (changesets: `pnpm changeset version`, `git tag`, `pnpm changeset publish`; git-cliff: `git cliff --bump`; conventional: `npm version`; custom/none: TODO placeholders). After scaffolding, the runbook is **the user's file** — edit freely; `/flow:release` always reads disk state, never re-imposes the stub.

This means:

- Provider implementation work for `/flow:release` is **documentation only** (a starter stub in `cli/commands/init.mjs`'s `CHANGELOG_STUBS` dict), not code in `release.md`.
- `/flow:release-changelog` stays provider-dispatched (its job — writing structured changeset/cliff/conventional metadata — has no Markdown-walker equivalent).
- Phase 3 ships the `changesets` stub end-to-end; other providers add their stub in tiny follow-up PRs without ever touching `release.md`.

## Consequences

**Good:**

- Adding a new changelog provider doesn't require code review of `release.md`'s walker logic — just a 4-line entry in `CHANGELOG_STUBS`.
- Teams whose release flow exceeds the generic template (staged rollouts, manual smoke gates, monorepo sub-packages) edit the runbook once and `/flow:release` walks it correctly forever after.
- The "untrusted-but-surfaced" model (we don't sandbox; we also don't fabricate) keeps the walker tiny and the safety boundary obvious — every command is gated, default is skip.
- Same plugin runs identically in a single-package open-source repo, a 12-package monorepo, and a custom in-house release pipeline.

**Trade-offs:**

- The runbook isn't validated. A typo'd `git tag` step prompts the user with a typo'd command; we surface it, the user catches it. No JSON-schema gate.
- The starter stubs in `CHANGELOG_STUBS` will drift from upstream tool changes (e.g. if Changesets renames `pnpm changeset publish`). Acceptable — runbooks are edited freely; the stub is the first version, not the eternal one.
- Symmetry with `/flow:release-changelog` is broken: one dispatches on provider, one doesn't. Documented in `release.md` ("Provider awareness" section) so the asymmetry is intentional, not an oversight.

## Alternatives considered

- **Provider-dispatched `/flow:release` (mirror of `/flow:release-changelog`).** Rejected: forces every team's release wrinkle into either the generic template or an option matrix. The wrinkles are precisely the part teams care most about — that's where surprise is most damaging.
- **YAML/JSON schema for the runbook** (typed `steps[]` with `name`, `cmd`, `confirm` fields). Rejected: adds a parser, a schema, and a JSON-vs-Markdown decision. Markdown + `##` headings + bash fences is already the format people use for runbooks in `README.md` / `RELEASING.md`. Cost-benefit lopsided against the schema.
- **Skip `/flow:release` entirely; let teams keep doing manual releases.** Rejected: misses the value of consistent prompting (`[run]/[skip]/[edit]/[abort]` is the actual differentiation) and recap, both of which catch the "forgot to push the tag" / "forgot the announcement" class of bugs.

## Revisit when

- A second flow command turns out to need the same "walk a user-authored Markdown runbook" pattern (e.g. `/flow:incident-response`, `/flow:rollback`). At that point, extract the parser/walker into a shared helper rather than copying.
- Or: if real-world feedback shows the typo-tolerance is hurting more than helping (e.g. teams repeatedly running broken commands because they didn't read carefully), reconsider adding a lightweight pre-flight `set -n` (`bash -n` syntax check) on each block before prompting.
- Or: if more than ~5 changelog providers ship with starter stubs, the `CHANGELOG_STUBS` dict in `init.mjs` is the right home; if it grows past ~50 lines, split into `cli/lib/changelog-stubs.mjs`.
