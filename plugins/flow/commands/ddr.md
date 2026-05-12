---
description: Record a Design Decision Record — an architectural/product decision for the future
argument-hint: "<short decision title>"
---

# /ddr — record a decision

A DDR (Design Decision Record) is a formal record of a non-trivial decision that affects future development. The next instance of Claude Code (and humans) read it to understand **why** something is the way it is.

> Use a DDR for: library / framework choice, data model schema, API shape, authorization model, performance trade-off, rebuild vs. refactor, deprecation. **Don't use** for: obvious decisions, local refactor, bug fix without conceptual impact.

## Process

1. **Find the next number** — `ls .ai/decisions/DDR-*.md 2>/dev/null | tail -1` → +1, padded to 3 digits (DDR-001, DDR-002…).

2. **Ask in one batch** (if the user hasn't supplied everything in `$ARGUMENTS`):
   - What is the problem / opportunity?
   - What alternatives did you consider?
   - Which one did you pick and why?
   - What are the consequences (positive and negative)?
   - Is there a superseding condition (when to revisit)?

3. **Write** to `.ai/decisions/DDR-<NNN>-<kebab-title>.md`:

```markdown
# DDR-<NNN>: <Title>

**Status:** Accepted | Proposed | Superseded by DDR-<NNN>
**Date:** <YYYY-MM-DD>
**Tags:** <e.g. video, playbook, auth, infra, ux>

## Context
What is the problem? What constraints exist? What is blocked until we decide?

## Alternatives considered
- **Option A:** <brief> — pros: …, cons: …
- **Option B:** <brief> — pros: …, cons: …
- **Option C:** <brief> — pros: …, cons: …

## Decision
We pick **<option>** because:
- <reason 1>
- <reason 2>

## Consequences
**Positive:**
- <what we gain>

**Negative / trade-offs:**
- <what we lose or complicate>

## Revisit when
<condition under which to revisit — e.g. "users > 10k", "when v2 broadcast pillar arrives">

## Linked
- Plan: <path or —>
- PRD: <§ or —>
- Supersedes: DDR-<NNN> or —
```

4. **Write the index** — append a line to `.ai/decisions/README.md` (create if missing):
   ```
   - [DDR-<NNN>: <Title>](DDR-<NNN>-<slug>.md) — <YYYY-MM-DD>, <tags>
   ```

5. **CLAUDE.md sweep** — if the decision encodes a behavioral rule for future code (a "we always do X" / "we never do Y" clause), invoke the `claude-md-keeper` skill: propose a one-line addition to CLAUDE.md so future sessions follow the rule without re-reading the DDR. Skip silently if the DDR is purely architectural with no behavioral change (e.g. "we picked Postgres over MySQL" alone is not a CLAUDE.md rule; "we always use Drizzle for queries, never raw SQL" is).

6. **Report** — _"DDR-<NNN> recorded. Link it in the active plan / commit message."_
