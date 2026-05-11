---
name: plan
type: command
description: "Create a context-rich feature implementation plan grounded in dugmate-prd.md and dugmate-design-system.md"
keywords:
  [plan, feature, design, architecture, specification, dugmate, blocks, components]
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

### Design System Reference (Dugmate)

For any UI feature, the **two source-of-truth documents** are:

1. `.ai/dugmate-design-system.md` — Look & feel: dark-first, team color jako jediný customizable token, Inter pro UI / monospace pro čísla/timecody, Lucide line ikony, žádný gradient/glass/pastel/neumorphism, sub-100ms response, density-per-platform.
2. `.ai/dugmate-prd.md` §5 — Per-screen briefs (Video Player, Playbook Editor, Team Hub, Chat, Player Profile, Onboarding, Live Stream Control Room, Watch Party, Migration Wizard, HUD Editor, Developer Portal).

Pokud feature dotýká UI, **vždy** čti tyto dva soubory. Také:

- Hledej v existujícím kódu (přes `.ai/context/codebase-map.md` pokud existuje) komponenty, které lze znovu použít. Žádný custom build, dokud se nevyčerpá registry.
- Designy z Claude Design (https://claude.ai/design/) jsou vstup do plánu — odkazuj URL v sekci **Design Decisions**.

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
   - Grep `.ai/context/codebase-map.md` (pokud existuje) a `src/components/`, `components/`, `apps/*/components/` pro analogické komponenty
   - Pokud nalezeno → reference v plánu, uveď cestu
   - Pokud ne → custom scaffold task; zkonzultuj `.ai/dugmate-design-system.md` za invarianty

2. **Search existing blocks/screens:**
   - Existující screen layouty v repu (po `/done` na předchozí featuře). Zkontroluj `apps/*/screens/`, `apps/*/pages/`, `apps/*/(routes)/`
   - PRD §5 (screen briefs) je referenční mapa, kde jsme co plánovali

3. **Icons:**
   - Lucide line ikony (single stroke width). Sport-specific glyfy musí být ve stejné rodině (puk, míč, helmet, set marker — line, ne emoji)
   - Záznam: exact import names z používané icon knihovny

4. **Identify tokens & typography:**
   - Mapuj barevné potřeby na semantic tokens (`bg-background`, `text-foreground`, `bg-primary` = team color slot, `border-border`)
   - Numerické / temporální obsahy → monospace role; UI text → Inter
   - **Žádné hardcoded barvy** (hex/rgb/hsl) v komponentách. Žádný gradient. Žádný blur mimo video overlays.

5. **Density per platform:**
   - Mobile = breathing room, 44×44 tap targets, palm-friendly
   - Tablet = sideline tool — větší tap targety, dense
   - Desktop = command center, Linear-like density, keyboard-first (Cmd-K)

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

- **GitHub Issue**: #<number> — <title>
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
| `<name>`  | `<repo path>`   | [why chosen, jak rozšířit] |

### Existing screens / blocks reused

| Screen / block          | Source                 | Notes                     |
| ----------------------- | ---------------------- | ------------------------- |
| `<name>`                | `<repo path>`          | [using as-is / extending] |

> Pokud nic existujícího nesedí: "No matching block found — building custom (viz Custom Components Needed)."

### Icons

| Icon         | Library            | Size  | Usage        |
| ------------ | ------------------ | ----- | ------------ |
| `<Name>`     | Lucide line        | 16/20/24 | [kde použito] |

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
5. **Cross-platform scenario** (UI tasky): spawn `scenario-runner` subagent. Spustí `agent-browser` (web-desktop, web-mobile) + `agent-device` (ios-phone, ios-tablet, android-phone) podle `.claude/skills/scenario/SKILL.md`. Vyžaduje 0 blockers a parity OK napříč non-skipped platformami.
6. **Design System Guard**: spawn `design-system-guard` subagent — ověří soulad s `.ai/dugmate-design-system.md` proti scenario screenshotům
7. **A11y**: spawn `a11y-auditor` subagent — live axe-core run přes agent-browser nad dotčenými routes
8. **Manual**: [specific edge cases nebo flows, které scenario nepokrývá]

---

## Scenario Coverage (UI tasky — povinné)

> Pro UI featuru musí existovat alespoň jedno cross-platform scenario v `.ai/scenarios/`. Scenario je hlavní validation backbone.

**Existující scenarios pokrývající dotčené flows:**

| Scenario | Pokrývá | Status |
|----------|---------|--------|
| `<name>` | <user flow> | ✅ existing / 🆕 new |

**Nová scenarios k vytvoření** (pokud existující nestačí):

- `<scenario-name>` — flow: <kroky 1..N>, persona: <Coach/Player/Scout/Manager z PRD §2>, fixtures: <co potřebujeme seedovat>

`/done` spustí `scenario-runner` přes 5 platforem. Scenario, kterému chybí runners, blokuje `/done`.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/verify` projde po každém tasku (Edit-Verify Loop, max 3 iterace)
- [ ] `/validate` projde celkově:
  - [ ] Static (types, lint, format)
  - [ ] Tests (full suite)
  - [ ] Build
  - [ ] **`scenario-runner`: 0 blockers, parity_ok=true** napříč 5 platformami (nebo DDR vysvětlující záměrnou divergenci)
  - [ ] `design-system-guard` subagent: 0 blockers
  - [ ] `a11y-auditor` subagent: 0 blockers (UI tasky)
- [ ] Scenario report linkovaný v PR description
- [ ] Žádné DDR-worthy rozhodnutí nezůstává nezapsané
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
