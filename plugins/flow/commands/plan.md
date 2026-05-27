---
name: flow:plan
category: daily
type: command
description: "Create a context-rich feature implementation plan grounded in the project PRD and design system"
keywords:
  [plan, feature, design, architecture, specification, blocks, components]
argument-hint: "feature description"
---

# Plan: $ARGUMENTS

> **Output:** Create a plan file and do NOT just display in chat — the file must be created for execution.
>
> **Plan location:** If the feature targets a specific app, create the plan in that app's plans directory (e.g., `apps/<app>/.ai/plans/{feature-name}.md`). Only use the root `plans/` for cross-cutting concerns that span multiple packages.

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Mission

Transform a feature request into a **context-rich implementation plan** that enables one-pass implementation by any AI agent or developer.

**We do NOT write code in this phase.** We research, analyze, and plan.

## Step 0 — Resolve tech-stack skills

> Run **before** scenario assessment so any library named in `$ARGUMENTS` (or implied by the feature) has loaded expertise during research.

Invoke `Skill(flow:skill-loader)` with the feature description as input. The skill will:

1. Diff libraries named in `$ARGUMENTS` (and currently loaded codebase context) against the skills already visible in this session.
2. For any gap, fetch the matching skill via the `terminal-skills` MCP (or fall back to WebFetch on official docs).
3. Record the resolved set in `.ai/state/STATE.md`.

Skip only if **every** library the feature touches is already covered by a loaded built-in skill. When in doubt — invoke it. Cheap.

## Scope Check

If the feature involves a repeatable pattern (e.g., "add docs for all components"), ask:

> **Scope:** Plan for ONE pilot or ALL items?

- **Pilot** — Plan one example; note what remains for full rollout
- **All** — Enumerate EVERY item explicitly. Never use "etc." or "repeat for remaining"

## Scenario Assessment

> Before planning, assess the feature's complexity and domain to select the right depth and context.

### Complexity Detection

Evaluate the feature and classify:

| Signal        | Simple                      | Complex                                        |
| ------------- | --------------------------- | ---------------------------------------------- |
| Files changed | ≤ 3 files, single package   | Multiple files across packages                 |
| New concepts  | Uses existing patterns only | Introduces new patterns, APIs, or data flows   |
| Dependencies  | No new deps                 | New dependencies or cross-package wiring       |
| Risk          | Low — isolated change       | High — affects shared components, build, or CI |

**Simple features** (documentation updates, single-component tweaks, config changes):

- Use a **streamlined plan** — skip architectural analysis, reduce the plan to: Description → Tasks → Validation
- Target: plan should be < 30 lines

**Complex features** (new pages, multi-package changes, architecture changes):

- Use the **full plan template** below with all sections
- Include architecture review and risk assessment

### Domain Detection & Agent Loading

Based on the feature description, labels, and affected files, detect the domain and **auto-load the appropriate agent** for richer context:

1. Check if an `.claude/agents/` directory exists in the project
2. Read available agent files and match to the feature's domain
3. Read the matched agent file to absorb domain-specific conventions

If the domain is ambiguous, ask:

> **Which area does this feature primarily affect?**

### Design System Reference

For any UI feature, the **two source-of-truth documents** are:

1. The project design system document (e.g. `.ai/<project>-design-system.md`) — Look & feel directives: typography, color tokens, iconography, motion, density-per-platform, response-time targets.
2. The project PRD (e.g. `.ai/<project>-prd.md`) — Per-screen briefs and feature scope.

If the feature touches UI, **always** read both files. Also:

- Search existing code (via `.ai/context/codebase-map.md` if it exists) for components that can be reused. No custom build until the registry is exhausted.
- Designs from Claude Design (https://claude.ai/design/) are an input to the plan — reference URLs in the **Design Decisions** section.

## Planning Process

### 1. Understand the Feature

- Extract the core problem and user value
- Determine type: New Capability / Enhancement / Refactor / Bug Fix
- Assess complexity: Low / Medium / High
- Write user story: `As a [user] I want [goal] so that [benefit]`

### 2. Analyze the Codebase

Use tools to inspect — do NOT assume:

- **Structure:** directory layout, frameworks, language versions
- **Patterns:** naming conventions, error handling, logging, imports
- **Similar code:** find existing implementations to mirror
- **Config:** build tools, package manager, environment setup
- **Tests:** framework, structure, coverage expectations
- **Project rules:** read `CLAUDE.md` → **Rules** section
- **App-specific rules:** if working in a specific app, also read its rules file

### 3. Design System Discovery (mandatory when DS detected)

Before writing any tasks, search the design system for **every UI element** the feature needs. This prevents reinventing components that already exist and ensures the plan uses approved patterns.

#### Component & Block Search

For each UI element mentioned in the feature:

1. **Search existing components:**
   - Grep `.ai/context/codebase-map.md` (if it exists) and `src/components/`, `components/`, `apps/*/components/` for analogous components
   - If found → reference in the plan, include the path
   - If not → custom scaffold task; consult the project design system for invariants

2. **Search existing blocks/screens:**
   - Existing screen layouts in the repo (after `/done` on a previous feature). Check `apps/*/screens/`, `apps/*/pages/`, `apps/*/(routes)/`
   - PRD screen briefs are the reference map of what was planned where

3. **Icons:**
   - Use the project icon system (e.g. Lucide line icons, single stroke width). Domain-specific glyphs must stay in the same family (line, not emoji)
   - Record: exact import names from the icon library in use

4. **Identify tokens & typography:**
   - Map color needs to semantic tokens (e.g. `bg-background`, `text-foreground`, `bg-primary`, `border-border`)
   - Numeric / temporal content → monospace role; UI text → primary UI typeface
   - **No hardcoded colors** (hex/rgb/hsl) in components. Follow the project design system for gradient/blur restrictions.

5. **Density per platform:**
   - Mobile = breathing room, 44×44 tap targets, palm-friendly
   - Tablet = larger tap targets, dense
   - Desktop = command center, dense, keyboard-first (Cmd-K)

#### Record Results

Capture all discovery results in the plan's **Design Decisions** section (see template below). Every component, block, icon, and token choice should be documented before tasks are written.

### 4. Research (if needed)

- Find relevant library docs with specific section anchors
- Check for breaking changes, gotchas, best practices
- Document links with "Why" annotations

### 5. Think Strategically

- How does this fit the existing architecture?
- What could go wrong? (edge cases, race conditions, errors)
- What's the dependency order?
- Are there security or performance implications?
- If using a design system: do the chosen components support all required states (loading, empty, error, disabled)?

### 6. Write the Plan

Create the plan file in the appropriate location (see Output note above) with this structure:

```markdown
# Feature: <name>

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

<What and why>

## User Story

As a <user> I want <goal> so that <benefit>

## Problem

<What's broken or missing>

## Solution

<Proposed approach>

## Metadata

- **Ticket**: <id> — <title> (provider per `integrations.tracker.provider`; omit line if provider is `none`)
- **Type**: [New Capability/Enhancement/Refactor/Bug Fix]
- **Complexity**: [Low/Medium/High]
- **App/Package**: [which workspace member]
- **Affected Systems**: [list]
- **Dependencies**: [list]

---

## Context References

### Must-Read Files

- `path/to/file.ts` (lines X-Y) — Why: [reason]

### Files to Create

- `path/to/new.ts` — [purpose]

### Documentation

- [Link](url#section) — Why: [reason]

### Patterns to Follow

<Actual code examples from the project showing conventions>

---

## Design Decisions

> Populated by Design System Discovery (Step 3). Remove this section if the feature has no UI.

### Components (from registry)

| Component | Source          | Notes        |
| --------- | --------------- | ------------ |
| `<name>`  | `<repo path>`   | [why chosen, how to extend] |

### Existing screens / blocks reused

| Screen / block          | Source                 | Notes                     |
| ----------------------- | ---------------------- | ------------------------- |
| `<name>`                | `<repo path>`          | [using as-is / extending] |

> If nothing existing fits: "No matching block found — building custom (see Custom Components Needed)."

### Icons

| Icon         | Library            | Size  | Usage        |
| ------------ | ------------------ | ----- | ------------ |
| `<Name>`     | Lucide line        | 16/20/24 | [where used] |

### Tokens

| Purpose         | Token          | Tailwind Class                       |
| --------------- | -------------- | ------------------------------------ |
| Page background | `--background` | `bg-background`                      |
| Primary action  | `--primary`    | `bg-primary text-primary-foreground` |

### Custom Components Needed

| Component | Reason                      | Extends                  |
| --------- | --------------------------- | ------------------------ |
| `<name>`  | [not available in registry] | [base component or none] |

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 1: {ACTION} {target}

- **Do**: [specific implementation detail]
- **Pattern**: [reference to existing code]
- **Gotcha**: [known constraint]
- **Validate**: `[command]`

### Task 2: ...

(continue in dependency order)

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint**: `<pm> lint`
2. **Types**: `<pm> typecheck`
3. **Tests**: `<pm> test`
4. **Build**: `<pm> build`
5. **Cross-platform scenario** (UI tasks): spawn the `scenario-runner` subagent. Runs `agent-browser` (web-desktop, web-mobile) + `agent-device` (ios-phone, ios-tablet, android-phone) per `.claude/skills/scenario/SKILL.md`. Requires 0 blockers and parity OK across non-skipped platforms.
6. **Design System Guard**: spawn the `design-system-guard` subagent — verifies conformance with the project design system against scenario screenshots
7. **A11y**: spawn the `a11y-auditor` subagent — live axe-core run via agent-browser over affected routes
8. **Manual**: [specific edge cases or flows the scenario doesn't cover]

---

## Scenario Coverage (UI tasks — required)

> For a UI feature there must be at least one cross-platform scenario in `.ai/scenarios/`. Scenarios are the primary validation backbone.

**Existing scenarios covering affected flows:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `<name>` | <user flow> | ✅ existing / 🆕 new |

**New scenarios to create** (if existing ones are insufficient):

- `<scenario-name>` — flow: <steps 1..N>, persona: <from PRD personas>, fixtures: <what needs to be seeded>

`/done` runs `scenario-runner` across 5 platforms. A scenario missing runners blocks `/done`.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/validate` passes overall:
  - [ ] Static (types, lint, format)
  - [ ] Tests (full suite)
  - [ ] Build
  - [ ] **`scenario-runner`: 0 blockers, parity_ok=true** across 5 platforms (or a DDR explaining intentional divergence)
  - [ ] `design-system-guard` subagent: 0 blockers
  - [ ] `a11y-auditor` subagent: 0 blockers (UI tasks)
- [ ] Scenario report linked in PR description
- [ ] No DDR-worthy decision left unrecorded
- [ ] Code follows project conventions, no regressions
```

## After Creating the Plan

Report:

- Summary of feature and approach
- Path to created plan file
- Key risks
- Confidence score (X/10) for one-pass implementation success

Then ask:

> **Ready to execute this plan?** I can run `execute <plan-path>` now, or you can review the plan first.
