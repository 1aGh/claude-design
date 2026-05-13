---
name: setup-ds
category: setup
description: Create a new design system (first one, an additional one alongside an existing DS, or re-bootstrap an existing one with --force). Thin wrapper that loads skill `design-system` in bootstrap mode with the given target. Auto-invokes /design:setup-onboard first if .design/config.json is missing.
argument-hint: "<name> [\"<brief>\"] [--force]"
---

# /design:setup-ds — create / extend a design system

Dedicated entry point for **creating a design system** in this project. Three modes the underlying skill auto-detects:

- **first-bootstrap** — `.design/config.json` does not exist (or `designSystems[]` is empty). The agent runs the full 8-question discovery, scaffolds `system/<name>/`, and writes `config.json` with `designSystems: [{ name, path, description }]`.
- **additional-ds** — `config.json` exists and `<name>` is **not** in `designSystems[]`. The agent runs 7 questions + Q_purpose + inheritance picker, then scaffolds `system/<name>/` next to the existing DS.
- **re-bootstrap** — `<name>` already exists in `designSystems[]` AND `--force` was passed. The agent pre-fills 8 questions with the current values and re-generates affected files.

This command **does NOT create a canvas** — use `/design:new` for that. It also does NOT prepare the project environment (deps, CLAUDE.md, .ai/) — that's `/design:setup-onboard`'s job.

## Arguments

- `<name>` — required. Kebab-case slug (`marketing`, `admin`, `consumer-mobile`, …). For the first DS in a single-DS project, the literal value `project` is the conventional default.
- `<brief>` — optional. One-line description used to pre-answer Q1 (first-bootstrap) or Q_purpose (additional-ds). If absent, the skill asks the question interactively.
- `--force` — required for re-bootstrap of an existing DS. Without it, an existing-DS target produces an error pointing at the right verb (`/design:edit` for incremental change, `/design:setup-ds <new-name>` to add a sibling DS).

## Examples

```
/design:setup-ds project "team scouting + match-day pro tool"
/design:setup-ds marketing "consumer-facing marketing site for product launch"
/design:setup-ds admin --force
```

## Process

### Step 1 — Detect environment

Read `<repo>/.design/config.json`. If it doesn't exist:

```
→ .design/config.json missing. Running /design:setup-onboard first to initialize the project…
```

Then auto-invoke `/design:setup-onboard --skip-prompts` so the user isn't double-prompted. After it returns, continue.

If config exists, skip onboard.

### Step 2 — Invoke skill `design-system` in bootstrap mode

Call `Skill design-system` with the input envelope:

```
mode: bootstrap
target_ds: <name>
brief:     <brief or empty>
force:     true|false
```

The skill detects the sub-mode internally (first-bootstrap / additional-ds / re-bootstrap) based on `.design/config.json` state.

### Step 3 — Skill runs its discovery + scaffold

See `plugins/design/skills/design-system/SKILL.md` "Bootstrap flow" for the canonical spec. Briefly:

1. Pre-Flight (light) — node ≥ 20, git, write permission, config exists (else auto-onboard).
2. Discovery — 2 rounds of AskUserQuestion (4 Qs each).
3. Confirm direction — 2-sentence echo; user yes / corrects / retries Round 2.
4. Mapping — consult `_MAPPING.md` to compute file set + `activeFamilies[]`.
5. Scaffold — generate project-flavored files using `design-system-inspiration/` as reference (NOT a literal substrate).
6. Completeness-critic — auto-run; exit non-zero only on blockers.
7. Post-flight — print next-step block.

### Step 4 — Return

The skill prints its "Bootstrap complete" block. This command body has no Post-flight of its own.

## Failure modes

- **`<name>` already exists AND `--force` was NOT passed** → fail with:
  ```
  Error: design system "<name>" already exists at .design/system/<name>/.
  To iterate on it:  /design:edit "<feedback>"
  To replace it:     /design:setup-ds <name> "<new brief>" --force
  To add a sibling:  /design:setup-ds <new-name> "<brief>"
  ```
- **`<name>` is not a valid kebab-case slug** (must match `^[a-z][a-z0-9-]*$`) → fail with the regex hint.
- **`<name>` collides with a reserved dir** (`preview`, `assets`, `ui_kits`) → fail with "reserved name; pick another".
- **Hard-dep missing (node < 20 / no git / no write permission)** → the skill's Pre-Flight aborts with the specific install hint.

## What `/design:setup-ds` does NOT do

- **No canvas creation.** Use `/design:new "<Name>" "<brief>" --ds=<this-name>`.
- **No environment init.** That's `/design:setup-onboard` (auto-invoked here when needed).
- **No incremental edits to an existing DS.** That's `/design:edit "<feedback>"` against a specimen file, or hand-editing `colors_and_type.css` directly.
