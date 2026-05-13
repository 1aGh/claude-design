---
name: ddr-keeper
type: skill
description: "Use when designing or implementing a non-trivial decision (library choice, schema, API shape, auth model, performance trade-off, deprecation, rebuild-vs-refactor) — to prompt creating a Design Decision Record. Triggers when user mentions 'decision', 'trade-off', 'should we use X or Y', or when /plan / /execute encounters an architectural pivot."
keywords: [ddr, decision, architecture, trade-off, learning, memory]
---

# DDR Keeper

You are the project's institutional memory. Every non-trivial decision must be captured as a DDR before it leaves working memory, otherwise the next session re-litigates it.

## When to Use This Skill

- During `/plan` when an architectural fork is about to be decided
- During `/execute` when a pivot diverges from the plan
- When the user asks "should we use X or Y" and the answer matters beyond this task
- Before `/done` — sweep `## Decisions to record` in active plan and turn each into a DDR

## When a decision is DDR-worthy

A decision is DDR-worthy if any of:

- Choosing between two or more genuinely viable libraries / frameworks / patterns
- Defining shape of data model, API, auth flow, permission model, schema
- Saying "no" to something the PRD seems to imply
- Performance / DX / cost trade-off where opposite choice is defensible
- Deprecating or replacing an existing approach
- A pivot during `/execute` that diverges from the plan
- Convention for a new pattern that other features will copy
- Choosing a changelog provider (e.g. switching from Changesets to git-cliff) — `integrations.changelog.provider` affects every contributor's release workflow; record the trade-off and the **Revisit when** trigger

## When a decision is NOT DDR-worthy

- Mechanical rename, format, lint fix
- Follows directly from `.ai/<project>-prd.md` or `.ai/<project>-design-system.md`
- Already covered by an existing DDR
- Local refactor with no public-API impact

## Process

1. **Recognize** — when conversation hits a DDR-worthy moment, pause and explicitly say so: _"This is DDR-worthy — let's capture it before we move on."_
2. **Run `/flow:record-ddr <titulek>`** — the slash command handles file naming, numbering, index update.
3. **Insist on quality** — when filling the DDR template, refuse weak content:
   - At least 2 alternatives in `Alternatives considered` (even if one is "do nothing")
   - `Consequences` split into positive and negative (every decision has both)
   - `Revisit when` — a concrete trigger condition for re-evaluation, not "if we have problems"
4. **Cross-link** — back-link DDR from active plan and from commit message that implements it.
5. **Index** — append to `.ai/decisions/README.md`.

## Anti-patterns

- ❌ Writing a DDR after the fact for cosmetic reasons. DDRs capture genuine debate, not rationalization.
- ❌ Listing one alternative ("we'll use X"). If there's no alternative considered, it's a default, not a decision.
- ❌ Vague consequences ("will improve maintainability"). Concrete trade-offs only.
- ❌ Skipping `Revisit when`. Every decision is contingent on context that will change.

## Maintenance

When a previous DDR is contradicted by a new one:

1. Mark the old one `Status: Superseded by DDR-<NNN>`
2. Link forward to the new DDR
3. Never delete superseded DDRs — they're the trail of how we got here

## Integration with other commands

- `/plan` — when generating the plan, populate `## Decisions to record` for any DDR-worthy fork. Don't write the DDR yet — just flag.
- `/execute` — if a pivot from the plan happens, halt and run `/flow:record-ddr` before continuing.
- `/done` — sweep `## Decisions to record`. Every unrecorded item must become a DDR before commit.
- `/flow:record-retro` — after a feature ships, look for repeated decisions that should be promoted to DDR rules.
