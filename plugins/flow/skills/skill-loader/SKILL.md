---
name: skill-loader
type: skill
description: 'Resolve expertise gaps for a tech stack by mapping each library/framework to the best available Claude skill — prefer existing built-in skills (auto-loaded plugins) or matching agents, otherwise fetch via the `terminal-skills` MCP. Use when starting work on an unfamiliar library (yjs, drizzle, hono, tRPC, Convex, Effect, etc.), when /flow:init runs, when package.json contains a tech with no matching loaded skill, when a /plan or /execute references a library you have no documented expertise on, or when the user explicitly asks for skills/expertise on a specific technology.'
keywords: [skills, terminal-skills, tech-stack, library, framework, expertise, auto-load, mcp, yjs, dependency, onboarding]
---

# Skill Loader

Ensures the right specialist knowledge is on hand for every important piece of the project's stack. The goal: when Claude touches `yjs`, `drizzle`, `hono`, `effect`, or any other library that materially shapes the codebase, the matching skill is already loaded — pulled from the local catalogue when possible, fetched from the `terminal-skills` MCP server when not.

This skill does **not** invent expertise. It **routes** to expertise — either already-installed Claude skills/agents, or remote skills exposed by the `terminal-skills` MCP server.

**This core doc is intentionally small** — it runs on every `/flow:plan` / `/flow:init`. The detail loads only when there's actually a gap:
- Known library → skill mappings + worked examples → [`_expertise-mapping.md`](./_expertise-mapping.md) (load at Step 2).
- The resolution priority ladder + `terminal-skills` recipe + MCP-vs-WebFetch fallback + troubleshooting → [`_resolution-strategy.md`](./_resolution-strategy.md) (load at Step 3, only when a gap exists).

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

If `terminal-skills` is not connected, fall back to: built-in skill → matching agent → web search via WebFetch / WebSearch as a last resort (full ladder in [`_resolution-strategy.md`](./_resolution-strategy.md)).

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

For each candidate, scan the system-reminder skills list (substring + alias check). **Load [`_expertise-mapping.md`](./_expertise-mapping.md)** for the known library → skill mapping table + worked examples. Skip anything already covered; anything **not** covered is a gap.

### 3. Resolve each gap

**Only if Step 2 found a gap, load [`_resolution-strategy.md`](./_resolution-strategy.md)** and follow its priority ladder (built-in → agent → `terminal-skills` → WebFetch). No gaps → skip this step entirely (the common case on a known stack).

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
