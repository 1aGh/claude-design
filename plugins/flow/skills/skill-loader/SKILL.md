---
name: flow:skill-loader
type: skill
description: 'Resolve expertise gaps for a tech stack by mapping each library/framework to the best available Claude skill — prefer existing built-in skills (auto-loaded plugins) or matching agents, otherwise fetch via the `terminal-skills` MCP. Use when starting work on an unfamiliar library (yjs, drizzle, hono, tRPC, Convex, Effect, etc.), when /flow:init runs, when package.json contains a tech with no matching loaded skill, when a /plan or /execute references a library you have no documented expertise on, or when the user explicitly asks for skills/expertise on a specific technology.'
keywords: [skills, terminal-skills, tech-stack, library, framework, expertise, auto-load, mcp, yjs, dependency, onboarding]
---

# Skill Loader

Ensures the right specialist knowledge is on hand for every important piece of the project's stack. The goal: when Claude touches `yjs`, `drizzle`, `hono`, `effect`, or any other library that materially shapes the codebase, the matching skill is already loaded — pulled from the local catalogue when possible, fetched from the `terminal-skills` MCP server when not.

This skill does **not** invent expertise. It **routes** to expertise — either already-installed Claude skills/agents, or remote skills exposed by the `terminal-skills` MCP server.

## When to Use This Skill

- A new library is added to `package.json` / `pyproject.toml` / `Cargo.toml` / etc.
- `/flow:init` or `/flow:setup-context` is bootstrapping a new repo.
- A `/flow:plan` or `/flow:execute` step names a library you have no documented expertise on.
- The user says something like _"we'll use yjs for the CRDT layer"_ or _"add drizzle"_.
- You are about to write non-trivial code against an unfamiliar API.
- A code-review surfaces a stack item nobody has reasoned about deeply.

If the relevant skill is already loaded (visible in the system-reminder skills list), STOP — do not refetch. Use what is loaded.

## Prerequisites

- The `terminal-skills` MCP server is connected (tools `mcp__terminal-skills__search_skills`, `mcp__terminal-skills__list_categories`, `mcp__terminal-skills__get_skill` are visible in the deferred tool list).
- A repo (any project Claude is currently working in) so detection has signal to work from.

If `terminal-skills` is not connected, fall back to: built-in skill → matching agent → web search via WebFetch / WebSearch as a last resort.

## Resolution Priority

Always try in this order. Stop at the first that fits.

1. **Built-in / plugin skill already loaded.** Check the system-reminder "skills available" list for a match. Examples: `pixijs-skills:*` for PixiJS, `design:design-system` for design tokens, `frontend-design:frontend-design` for production-grade UI. If a skill with the matching domain is listed, use it — do not pull a duplicate from `terminal-skills`.
2. **Matching subagent.** Inspect available agents. If an agent's description matches the task (e.g. `flow:a11y-auditor` for a11y work, `claude-code-guide` for Claude Code API/SDK), delegate to it instead of asking for a generic skill.
3. **`terminal-skills` MCP catalogue.** Search by library name + role keywords (see Step-by-Step below). Load the best match with `mcp__terminal-skills__get_skill`.
4. **Web docs as fallback.** If nothing in the MCP catalogue matches, use `WebFetch` against the library's official docs URL — never invent API surface.

## Step-by-Step

### 1. Detect the tech stack

Pick signals from the project root (in priority order):

- `package.json` `dependencies` + `devDependencies` keys
- `pyproject.toml` / `requirements.txt` / `uv.lock`
- `Cargo.toml`
- `go.mod`
- `composer.json`
- `Gemfile`
- `.ai/workflows.config.json` → `stack` / `conventions` fields if present
- Recent imports in source files (grep for `^import .* from ['"]([^./]+)`)
- An explicit user mention ("use yjs", "add drizzle")

Build a deduped list of candidate technologies — focus on **material** dependencies (state libs, ORMs, frameworks, CRDT libs, auth, animation engines), not micro-utilities (lodash, classnames, dotenv).

### 2. Diff against loaded skills + agents

For each candidate, scan the system-reminder skills list (substring + alias check). Examples:

| Candidate | Already loaded? Look for                                  |
| --------- | --------------------------------------------------------- |
| `pixi.js` | `pixijs-skills:*`                                         |
| `yjs`     | _(nothing built-in — must fetch)_                          |
| `react`   | `frontend-design:frontend-design` (UI patterns)            |
| `drizzle` | _(nothing built-in — must fetch)_                          |
| `expo`    | `flow:agent-device` (native automation, not framework docs) |

Skip anything already covered. Anything that is **not** covered is a gap.

### 3. Resolve each gap via `terminal-skills`

For each gap:

```
mcp__terminal-skills__search_skills(query: "<lib-name> <role>")
```

Example queries: `"yjs CRDT"`, `"drizzle ORM schema"`, `"hono router middleware"`, `"effect typescript runtime"`.

Inspect results, pick the best match (most specific, highest signal in description), then:

```
mcp__terminal-skills__get_skill(name_or_id)
```

If `search_skills` returns nothing, try `list_categories` to browse — the library might be under a parent topic (e.g. `realtime`, `database`, `state-management`).

### 4. Persist the loaded set

After loading skills for the session, record them so a later session does not redundantly re-resolve:

- If `.ai/state/STATE.md` exists in the project, append a `## Loaded skills (skill-loader)` block listing each resolved tech → skill name.
- If `auto memory` is active, save a **reference** memory: `loaded-skills-for-<project>.md` listing `tech → resolved skill`. Update — do not duplicate.

This is the only side-effect of this skill. Do not write code, do not modify dependencies — this skill is purely a router.

### 5. Confirm and proceed

Surface a one-line summary back to the user:

```
Loaded skills: yjs (terminal-skills/yjs-core), drizzle (terminal-skills/drizzle-orm). Built-in already covered: pixi.js.
```

Then continue with whatever task originally triggered the load.

## Auto-trigger heuristics

This skill should fire automatically (not wait for explicit invocation) when ANY of these conditions hold AND the matching skill is not already loaded:

- A diff/PR adds a new top-level dependency.
- The current prompt names a library that does not appear in the system-reminder skills list.
- `/flow:init` or `/flow:setup-context` is running and is about to write the codebase map.
- A `/flow:plan` step references a library API that you cannot describe from memory with high confidence.

When in doubt, **load before writing code**. The cost of an extra MCP call is much lower than the cost of hallucinated API surface that fails review.

## Examples

### Example A — user asks for yjs work

```
User: "Add a yjs-backed shared document to the canvas inspector."
```

1. Scan loaded skills — no `yjs` match.
2. `search_skills("yjs CRDT")` → pick top-ranked result.
3. `get_skill(<id>)` → yjs API knowledge now loaded.
4. Record in `.ai/state/STATE.md` and proceed with implementation.

### Example B — onboarding to a repo with drizzle + hono

```
/flow:init
```

1. Read `package.json` → detect `drizzle-orm`, `hono`, `zod`.
2. `zod` is small and well-known to base model — skip.
3. `drizzle-orm` → fetch.
4. `hono` → fetch.
5. Write loaded-skills reference memory.

### Example C — built-in already covers it

```
User: "Refactor the particle system to use ParticleContainer."
```

1. Scan loaded skills — `pixijs-skills:pixijs-scene-particle-container` is already present.
2. STOP. Do not call `terminal-skills`. Use the built-in skill directly.

## Anti-patterns

- ❌ Calling `mcp__terminal-skills__get_skill` for a library that already has a loaded built-in skill.
- ❌ Resolving micro-utilities (`lodash`, `dotenv`, `classnames`). They are too small to need a skill.
- ❌ Loading 10 skills "just in case". Load only what the current task touches.
- ❌ Treating this skill's output as code-changing — it only routes/records, never edits source.
- ❌ Inventing API surface when `terminal-skills` returns nothing — fall back to `WebFetch` on official docs.

## Troubleshooting

| Symptom                                              | Resolution                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `terminal-skills` tool unavailable                   | Confirm MCP server connection. Fall back to WebFetch on the library's official docs.                       |
| `search_skills` returns empty                        | Try broader keywords or `list_categories`; if still nothing, fall back to WebFetch.                        |
| Multiple competing matches                           | Prefer the one whose description names the specific API surface you need (e.g. _yjs awareness_ vs _yjs core_). |
| Skill loaded but feels generic                       | Combine with WebFetch on official docs for current version specifics.                                     |
| Same library keeps getting re-resolved every session | Ensure Step 4 wrote the reference memory / STATE.md block. Check it is being read at session start.        |

## References

- `mcp__terminal-skills__search_skills` — keyword search across the MCP catalogue.
- `mcp__terminal-skills__list_categories` — browse by domain when keyword search misses.
- `mcp__terminal-skills__get_skill` — load the chosen skill's content into the session.
- `plugins/flow/skills/codebase-intelligence/` — companion skill that produces the codebase map this skill diffs against.
- `plugins/flow/skills/make-skill-template/` — use when a resolved gap deserves a **permanent** local skill, not a one-off MCP fetch.
