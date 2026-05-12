# Phase 3: `/flow:changeset` command (downstream-reusable)

> **Scope-narrowed 2026-05-12.** Originally this phase bundled `/flow:changeset` + flow⇄design integration. The flow⇄design seam was extracted to **Phase 11** as standalone work — that piece is more impactful when canvas + collab structure is mature (post Phase 4-8), and bundling it with changesets meant blocking a small command behind a larger architectural decision. This phase now ships only the changesets capability.

## Description

Productize Changesets as a reusable flow capability — any downstream repo can adopt the same release pattern md-claude itself uses (Phase 1). Add `/flow:changeset` to author changesets interactively, and wire `/flow:done` to nag (not block) when one is missing. Extends `.ai/workflows.config.json` schema with `integrations.changesets`.

## User Story

As a maintainer of a downstream repo that installed `flow@md-claude`, I want `/flow:changeset` to author a release note interactively (bootstrap changesets if absent) and `/flow:done` to remind me before close-out — so that releases stay traceable without me re-learning my custom flow per project.

## Problem

- No reusable changesets workflow for downstream repos. Phase 1 bootstrapped it for `md-claude` itself; downstream repos have to copy the recipe manually.
- `/flow:done` ships no awareness of release hygiene (changeset missing? CHANGELOG outdated?).

## Solution

Single deliverable: `/flow:changeset` slash command that detects whether the host repo uses changesets (presence of `.changeset/config.json`); if missing, offers to bootstrap. Interactive prompt for type (`patch`/`minor`/`major`), summary, affected scope. Writes `.changeset/<slug>.md`. Plus `/flow:done` soft-gate.

## Metadata

- **Type:** New Feature
- **Complexity:** Low-Medium (down from "Medium" after flow⇄design extraction)
- **Depends on:** Phase 1 (changesets bootstrapped here first as canonical reference)
- **Parallel with:** Phase 2
- **Affected files:**
  - `plugins/flow/commands/changeset.md` (new)
  - `plugins/flow/commands/done.md` (update — changeset gate only; handoff sweep moves to Phase 11)
  - `plugins/flow/.claude-plugin/config.schema.json` (extend with `integrations.changesets`)
  - `plugins/flow/templates/ai-skeleton/workflows.config.json` (add new keys)
  - `plugins/flow/skills/ddr-keeper/SKILL.md` (note when to DDR a changeset adoption decision)
  - `site/content/docs/flow/changeset.mdx` (new — once Phase 2 lands)

---

## Tasks

### Task 1: Author `/flow:changeset`

- **Do:** Frontmatter `name: changeset, description: "Author a changeset for the current feature; bootstrap changesets if missing."` Body: pre-flight detects `.changeset/config.json`; if missing, offers `npx @changesets/cli init` (or `pnpm dlx`, autodetected). Then interactive: type, summary (multi-line), affected packages (auto-suggest from `package.json` `workspaces`). Writes `.changeset/<slug>.md` with `---` frontmatter `"@scope/pkg": <type>` + body summary.
- **Pattern:** Mirror `gh` CLI prompt UX — question-by-question with sensible defaults.
- **Validate:** Run the command on this repo + on a downstream test repo without changesets. Both produce valid `.changeset/*.md` files.

### Task 2: Schema extension

- **Do:** Extend `config.schema.json` with:
  ```json
  "integrations.changesets": { "enabled": "boolean", "scope": "string" }
  ```
  Update `templates/ai-skeleton/workflows.config.json` defaults.
- **Validate:** `mdcc config set integrations.changesets.enabled true` against the schema; no validation error.

### Task 3: `/flow:done` changeset gate

- **Do:** If `integrations.changesets.enabled` and no new `.changeset/*.md` since the previous commit, prompt: "No changeset detected. Add one with `/flow:changeset` before closing?" Soft warning, not blocking — user can override.
- **Validate:** Make a change, run `/flow:done` without changeset → warning. Add changeset, re-run → no warning.

### Task 4: Docs page

- **Do:** `site/content/docs/flow/changeset.mdx` (or auto-gen from frontmatter) covers: when to use, what gets written, bootstrap behavior, scope semantics.
- **Validate:** Page exists, copy-paste examples work.

---

## Validation

1. **Static:** Markdown command files lint (`markdownlint` if configured) clean.
2. **Smoke:** Run `/flow:changeset` against this repo; run against a fresh `pnpm init` repo (bootstrap path).
3. **Schema parity:** `ajv validate -s plugins/flow/.claude-plugin/config.schema.json -d .ai/workflows.config.json` clean.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `flow-changeset-bootstrap` | Fresh repo without changesets → `/flow:changeset` → bootstrap accepted → first `.changeset/*.md` written | 🆕 new |
| `flow-done-changeset-gate` | Modify code, `/flow:done` without changeset → warning fires → add changeset → no warning | 🆕 new |

---

## Acceptance criteria

- [ ] `/flow:changeset` works on a repo with and without prior changesets setup.
- [ ] `integrations.changesets` documented in schema + skeleton defaults.
- [ ] `/flow:done` warns (does not block) on missing changeset.
- [ ] Docs site has `flow:changeset` page (delivered alongside Phase 2 if both land).
- [ ] Flow⇄design seam (handoff sweep, design-canvas detection in `/flow:plan`) explicitly out of scope — tracked in Phase 11.
