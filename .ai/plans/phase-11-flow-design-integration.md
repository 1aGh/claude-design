# Phase 11: Flow ↔ Design integration

> **Created 2026-05-12 by extraction from Phase 3.** Original Phase 3 bundled this work with the `/flow:changeset` command, but they have different timing — the flow⇄design seam is most useful once the canvas + DS structure is mature (post Phase 4-5-6 minimum, ideally after Phase 8 collab is real too). This phase consolidates the seam so flow can read design state confidently.

## Description

Close the gap between flow and design plugins. Flow commands (`/flow:plan`, `/flow:done`) become **aware of `.design/`** — `/flow:plan` automatically detects canvases relevant to a feature and pulls them into plan context; `/flow:done` inventories canvases marked `status: ready-for-handoff` and offers to run `/design:handoff` on each before closing. Updates flow skills (`codebase-intelligence`, `ddr-keeper`) to recognize the design plugin's artifacts.

## User Story

As an indie dev shipping a feature involving UI, I want `/flow:plan dark-mode` to read my `.design/` canvases tagged `dark-mode` and ground the implementation plan in them — so that I never paste canvas paths or screenshots into the plan manually. And I want `/flow:done` to ask "you have 3 canvases ready for handoff, run handoff before close?" so that I don't ship code that diverges from approved designs.

## Problem

- **`/flow:plan` is design-blind.** It generates implementation plans from scratch text + codebase context, but doesn't read `.design/`. A feature with finished mockups makes the AI re-derive them.
- **`/flow:done` doesn't surface ready-to-handoff canvases.** User must remember to run `/design:handoff` manually, or canvases drift from the production code they describe.
- **`codebase-intelligence` skill** doesn't know `.design/` exists. When priming context for a new session, it skips design artifacts entirely.
- **`ddr-keeper` skill** doesn't know to ask "should this DDR reference a canvas?" for UX-affecting decisions.

## Solution

Four wired-up integrations:

**A. `/flow:plan` design-canvas detection.** When user invokes `/flow:plan <feature>`, the orchestrator scans `<designRoot>/**/*.html` (default `.design/`). For each canvas, read `.meta.json` (if present). Match against the feature kebab-name (`dark-mode` matches `dark-mode-toggle.html` or any canvas with `tags: ["dark-mode"]`). For matches: include canvas paths + auto-generated screenshots (Phase 4 thumbnail cache) in the plan's "Context" section. If no slug/tag matches but `.design/` exists, surface the 5 most recently edited canvases as fallback.

**B. `/flow:done` handoff sweep.** Before the commit step, scan `<designRoot>/**/*.meta.json` for `status: ready-for-handoff`. If any: print the list; prompt "Run `/design:handoff` on these N canvases before closing? [Y/n/select]". On Y: dispatch handoff per canvas in sequence; on success, update each meta (`status: handed-off`, `handoffCommit: <sha>`).

**C. `codebase-intelligence` skill awareness.** Skill output (saved to `.ai/context/codebase-map.md`) now includes a "Design artifacts" section: list of canvases per DS, recent activity, declared statuses. Refresh on `/flow:setup-codebase-map`.

**D. `ddr-keeper` skill prompt.** When a DDR is being created for a UX-affecting decision (heuristic: keywords like "UI", "layout", "color", "interaction"), ask "Does this DDR reference a canvas? [path or N]". Recorded as `relatedCanvas:` field in the DDR frontmatter.

## Metadata

- **Type:** New Feature (cross-plugin integration)
- **Complexity:** Medium
- **Depends on:** Phase 4 (canvas v2 + thumbnails), Phase 5 (multi-DS + `.meta.json` schema), Phase 6 (status tracking via comments / resolve)
- **Parallel with:** —
- **Ship target:** Late v1.0 (after the canvas + design features are stable enough that `.meta.json` is reliable) OR early v1.1 alongside hub work — TBD by user priority.
- **Affected files:**
  - `plugins/flow/commands/plan.md` (extend — design-canvas detection step)
  - `plugins/flow/commands/done.md` (extend — handoff sweep step)
  - `plugins/flow/commands/map-codebase.md` (extend — design artifacts section)
  - `plugins/flow/skills/codebase-intelligence/SKILL.md` (extend — design awareness)
  - `plugins/flow/skills/ddr-keeper/SKILL.md` (extend — canvas-reference prompt)
  - `plugins/flow/.claude-plugin/config.schema.json` (extend with `paths.designRoot`, default `.design`)
  - `plugins/flow/templates/ai-skeleton/workflows.config.json` (add `paths.designRoot`)
  - `plugins/design/dev-server/canvas-meta.schema.json` (formalize `status` enum + `handoffCommit` field)

---

## Tasks

### Task 1: Schema — `paths.designRoot` + canvas meta status enum

- **Do:** Extend flow config schema with `paths.designRoot: { type: "string", default: ".design" }`. Extend canvas `.meta.json` schema with `status: ["draft", "in-review", "ready-for-handoff", "handed-off"]` + optional `handoffCommit: string`.
- **Validate:** `ajv` validates both schemas; sample `.meta.json` files round-trip.

### Task 2: `/flow:plan` design-canvas detection

- **Do:** In `plan.md`, add a step before "Generate plan": resolve `paths.designRoot`; if exists, walk `**/*.html` + `**/*.meta.json`; build a match heuristic (slug substring match + tag exact match). Include matched canvases in plan "Context" section with path + screenshot inline (using Phase 4 thumbnails). Fallback: 5 most recently edited canvases.
- **Pattern:** Read-only scan — never modify `.design/` from flow.
- **Validate:** Create a canvas `dark-mode-toggle.html` with `tags: ["dark-mode"]`; run `/flow:plan dark-mode`; confirm plan references canvas + thumbnail.

### Task 3: `/flow:done` handoff sweep

- **Do:** In `done.md`, add a step before commit: scan canvas metas for `status: ready-for-handoff`; print sorted list; prompt with three options:
  - `[Y]` Run handoff on all
  - `[N]` Skip handoff, close anyway
  - `[S]` Select subset interactively
  On Y/S: dispatch `/design:handoff` per canvas (sequential, not parallel — handoff may touch shared code). On success per canvas: update `.meta.json.status = "handed-off"`, `.meta.json.handoffCommit = <sha>`, write into a single follow-up commit.
- **Pattern:** Compose existing commands; don't reimplement handoff logic.
- **Validate:** Set a canvas `status: ready-for-handoff`; run `/flow:done`; prompt fires; on Y the handoff runs + meta updates.

### Task 4: `codebase-intelligence` skill — design awareness

- **Do:** Extend `SKILL.md` to read `<designRoot>` during snapshot generation. Output added to `.ai/context/codebase-map.md`:
  ```markdown
  ## Design artifacts

  ### Design systems
  - main: .design/system/main/  (default)
  - marketing: .design/system/marketing/

  ### Canvases (15 total)
  - home.html (DS: marketing, status: handed-off, last edit: 2026-04-12)
  - settings.html (DS: main, status: in-review, last edit: 2026-04-14)
  ...
  ```
- **Validate:** Re-run `/flow:setup-codebase-map`; snapshot includes design section.

### Task 5: `ddr-keeper` canvas-reference prompt

- **Do:** Extend `SKILL.md` heuristic: if DDR being recorded contains keywords (`UI`, `layout`, `color`, `typography`, `interaction`, `spacing`, etc.), ask "This DDR mentions UI concerns. Does it reference a specific canvas? [Type path or N]". Recorded as `relatedCanvas: <path>` frontmatter field. Validation: path must exist; warn if missing.
- **Validate:** Author a DDR mentioning "button color". Skill prompts. Provide a path. DDR frontmatter contains `relatedCanvas`.

### Task 6: DDR for soft vs. hard handoff

- **Do:** Record a DDR explaining why `/flow:done` handoff sweep is offered (not enforced). Reasoning: over-eager auto-handoff burns user context; the design plugin's handoff command itself is an active decision (which `apps/web` target, which DS, etc.); flow can't make that for the user. Soft prompt preserves choice.
- **Validate:** DDR exists in `.ai/decisions/`.

### Task 7: Cross-plugin integration tests

- **Do:** End-to-end scenario harness: create a feature, scaffold matching canvas with `/design:new`, mark canvas `ready-for-handoff`, run `/flow:plan` → confirm context, `/flow:execute` → implementation, `/flow:done` → handoff sweep + changeset gate.
- **Validate:** Full path runs without manual intervention.

---

## Validation

1. **Static:** Schema validation clean; markdown files lint clean.
2. **Functional:** Each task's validate-block green.
3. **Cross-plugin:** End-to-end scenario completes with proper meta updates + commit history.
4. **No regression:** `/flow:plan` on a project without `.design/` still works (gracefully skips design detection).

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `feature-with-canvas-plan` | Canvas tagged `dark-mode` → `/flow:plan dark-mode` → plan references canvas + screenshot inline | 🆕 new |
| `done-handoff-sweep` | 2 canvases `ready-for-handoff` → `/flow:done` prompts → user accepts → handoff runs → metas update | 🆕 new |
| `map-codebase-design-section` | Project with `.design/` → `/flow:setup-codebase-map` → snapshot includes design artifacts | 🆕 new |
| `ddr-with-canvas-reference` | Author UI-related DDR → skill prompts for canvas → DDR records `relatedCanvas` | 🆕 new |

---

## Acceptance criteria

- [ ] `paths.designRoot` documented in config schema + skeleton defaults.
- [ ] Canvas `.meta.json` status enum formalized; `handoffCommit` field defined.
- [ ] `/flow:plan` detects matching canvases by slug/tag; surfaces in plan context.
- [ ] `/flow:done` lists handoff-ready canvases; sequential dispatch on accept; meta updates committed.
- [ ] `codebase-intelligence` snapshot includes Design artifacts section.
- [ ] `ddr-keeper` prompts for canvas reference on UI-related DDRs.
- [ ] DDR recorded for soft-vs-hard handoff prompt decision.
- [ ] No regression: flow works on projects without `.design/`.
- [ ] End-to-end scenario passes.
