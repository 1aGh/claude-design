---
name: flow:claude-md-keeper
description: Keep CLAUDE.md fresh as project conventions evolve. Use when /flow:record-retro, /flow:record-ddr, or /flow:done detects a change that should land in CLAUDE.md (new convention emerged, deprecation, build command change, "always do X" rule). Read-only by default; proposes edits, doesn't apply them.
user-invocable: false
---

# claude-md-keeper

Counterpart to `ddr-keeper`. Where `ddr-keeper` watches for architectural decisions that need a DDR, `claude-md-keeper` watches for **conventions** that need to land in `CLAUDE.md` — the auto-loaded prose Claude reads every session.

## What belongs in CLAUDE.md (per Anthropic docs)

> "Add to CLAUDE.md when: Claude makes the same mistake a second time, a code review catches something Claude should have known about this codebase, you type the same correction or clarification into chat that you typed last session, a new teammate would need the same context to be productive."

Concretely:

- **Build / test / lint commands** that aren't obvious from package.json scripts.
- **"Always do X" rules** — naming conventions, file layout, framework idioms, "no inline styles", "use App Router not Pages".
- **Gotchas** — "the `legacy/` directory is a snapshot from 2024-03, don't touch", "RLS context required for /api/* — see middleware/auth.ts".
- **Prohibited patterns** — "don't use `any`", "no synchronous DB calls in handlers".
- **Cross-cutting concerns** — locale handling, error format, logging style.

**What does NOT belong in CLAUDE.md:**

- Structured machine-readable data (use `.ai/workflows.config.json`).
- Task-specific workflows (use a skill).
- Path-scoped rules that only apply to one part of the codebase (use `.claude/rules/<topic>.md` with `paths:` frontmatter).
- One-off project history (use `.ai/decisions/` for DDRs).

## Constraints

- **≤200 lines.** Anthropic's hard guidance — every CLAUDE.md line is in every session's context.
- **Concrete, verifiable instructions.** "Run `pnpm test` before committing" beats "test your changes".
- **No conflicts.** Two rules contradicting each other = Claude picks one arbitrarily.
- **Specific, not generic.** "API handlers live in `src/api/handlers/`" beats "keep files organized".

## When to trigger

This skill is *not* user-invocable. It's read by commands at three points in the loop:

### 1. During `/flow:record-ddr`

When the user records a DDR, ask:

> The decision in DDR-NNN encodes a new convention (`<short summary>`). Should we also add a line to CLAUDE.md so future sessions follow it without re-reading the DDR?
>
> Suggested CLAUDE.md addition (under section `<section>`):
> ```
> - <one-line rule derived from the DDR>
> ```
>
> Add it? [yes / no / edit]

Skip the prompt if the DDR is purely architectural (no behavioral change for future code-writing — e.g. "we chose Postgres over MySQL"). Trigger when the DDR includes a "we always do X" or "we never do Y" clause.

### 2. During `/flow:record-retro`

After analyzing the implementation vs. plan, scan for "Claude made the same mistake N times" patterns. If found:

> During this feature, the agent had to be corrected `N` times on: `<pattern>`. Consider adding a CLAUDE.md rule. Suggested:
>
> ```
> - <one-line rule that would have prevented the corrections>
> ```
>
> Add it? [yes / no / edit]

### 3. During `/flow:done`

After validation passes and before committing, do a final check:

> One-line debrief: did this feature introduce a new convention, build step, or rule that belongs in CLAUDE.md? [list / none]

If the user lists items, propose CLAUDE.md edits; otherwise skip.

## How to edit CLAUDE.md

Always read the current file first. Look for a relevant existing section (e.g. `## Conventions`, `## Build`, `## Testing`). If found → append a bullet. If not found → propose a new section.

Never write more than 5 new lines per session. CLAUDE.md grows in small increments, not in batches.

If the file is approaching 200 lines, suggest moving older, less-active rules to `.claude/rules/<topic>.md` with `paths:` frontmatter (path-scoped — only loads when Claude touches matching files).

## Cross-check with `workflows.config.json`

If a proposed CLAUDE.md addition duplicates something in `workflows.config.json` (e.g. "we use Next.js" when `stack.framework: next.js` already lives in config), prefer the config and skip the CLAUDE.md addition. CLAUDE.md is prose context; config is structured truth.

## When CLAUDE.md is missing

If the file doesn't exist when the skill triggers, don't create it from scratch. Instead:

> CLAUDE.md is missing. Run Anthropic's built-in `/init` first — it'll generate one tailored to your codebase. After that, this skill can help keep it fresh as conventions emerge.

## Related

- `ddr-keeper` — architectural decision capture
- `workflow-state` — STATE.md owner
- Anthropic docs on memory: https://code.claude.com/docs/en/memory
