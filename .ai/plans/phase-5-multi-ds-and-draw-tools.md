# Phase 5: Multi design-systems + draw tools

> **Scope-narrowed 2026-05-12.** Originally this phase bundled layers panel + in-canvas CSS editor + draw tools + multi-DS. Layers panel + in-canvas CSS editor were extracted to **Phase 12** (end-of-roadmap extra feature) — they're substantial UI work and value-add unclear vs. iterating via `/design "<feedback>"` slash command. Multi-DS was reinterpreted (see below) — it's a *generation-time* concern, not a runtime canvas switcher. This phase now ships: draw / annotation tools + multi-DS-as-attachment.

## Description

Two sub-deliverables on top of Phase 4 canvas v2:

**A. Draw / annotation tools** — pen / circle / arrow as SVG overlay layer per canvas, persisted as `.design/<slug>.annotations.svg`. Switchable via toolbar; eraser supported; hideable for presentation mode.

**B. Multi design-system support (revised)** — a project can declare multiple design systems as separate folders under `.design/system/<ds-name>/`. Each DS is a *template / library* used at canvas-generation time. `/design:new --ds=<name> <Canvas-Name> "<brief>"` lets the user select which DS scaffolds the new canvas. Per-canvas `.meta.json` records which DS the canvas belongs to; `design-system-guard` subagent scopes its audit accordingly. **No runtime "switch DS in chrome" toggle** — design-system identity is fixed at scaffold time, not a viewing state.

> **Cross-plan coordination (added 2026-05-13).** `.ai/plans/design-system-init.md` introduces skill `init` (bootstrap workflow) that scaffolds a single-DS project at `.design/system/project/` (literal dirname, rename-resilient). This phase's multi-DS shape (`system/<ds-name>/`) is the **opt-in extension** for projects that need >1 DS — invoked via the `--ds=<name>` flag on `/design:new`. The completeness-critic from `design-system-init` Phase 3 (Check #3) accepts BOTH shapes (default `project/` OR named `<ds-name>/`); it only rejects the D2-divergence pattern where the dirname equals the project slug. When this phase lands, the `design-system-guard` subagent (Task 4) and the new `design-system-completeness-critic` (in `plugins/design/agents/`) are complementary, not overlapping: guard = per-canvas DS audit; completeness = system-level structure audit. Confirm Phase 1B's edit to `plugins/design/skills/design-system/SKILL.md` ("bootstrap branch" section) is preserved when this phase appends its "multi-DS lookup pattern" section.

## User Story

**(A)** As a designer reviewing a canvas, I want to circle a button and write "this needs more padding" directly on the canvas so that screenshots aren't needed for async review.

**(B)** As a developer with three product surfaces in one repo (marketing site, app internals, admin console — different visual languages), I want to keep three design systems in `.design/system/{marketing,app,admin}/` and scaffold new canvases with `/design:new --ds=marketing` so that I never accidentally mix tokens between surfaces.

## Problem

- **(A)** Annotation in the canvas requires a screenshot + external tool (FigJam, Excalidraw, Skitch). Not bad, but a workflow break.
- **(B)** Today `.design/system/` is a single folder. Projects with multiple visual languages (e.g., a SaaS with a marketing site + an internal admin tool) have to choose one DS for the repo or fork. Multi-tenant agencies face the same constraint.

## Solution

### A. Draw tools (unchanged)

Toolbar buttons in canvas chrome: pen, circle, arrow, eraser, color picker. Drawing happens on a transparent SVG layer sized to the canvas world (zoomable with viewport from Phase 4). On stroke complete: PUT to `/api/annotations/<slug>` → server writes `.design/<slug>.annotations.svg`. Annotations toggleable; hideable in presentation mode (Phase 6).

### B. Multi-DS as attachment (revised)

**File system convention:**

```
.design/
├── config.json                    ← declares designSystems[] + default
├── system/                        ← root (renamed from being single-DS)
│   ├── main/                      ← default DS
│   │   ├── colors_and_type.css
│   │   ├── components.html
│   │   └── README.md
│   ├── marketing/                 ← second DS
│   │   ├── colors_and_type.css
│   │   ├── components.html
│   │   └── README.md
│   └── admin-console/             ← third DS
│       └── ...
└── ui/
    ├── home.html                  ← references DS via .meta.json
    ├── home.meta.json             ← { designSystem: "marketing" }
    ├── settings.html
    └── settings.meta.json         ← { designSystem: "admin-console" }
```

**`/design:new` flag:**

```sh
/design:new --ds=marketing HomeScreen "marketing landing for product launch"
```

Without `--ds`, uses `.design/config.json.defaultDesignSystem`. With `--ds=<name>`, uses that DS's tokens + components as scaffolding context for `frontend-design` plugin.

**Per-canvas `.meta.json` declares DS:**

```json
{ "designSystem": "marketing", "tags": [], "status": "ready" }
```

**`design-system-guard` subagent (flow plugin)** reads canvas `.meta.json`, then audits against that DS's tokens — not a global "active DS".

**`design:design-system` skill (background knowledge)** becomes DS-aware — when iterating on a canvas, the skill loads the canvas's declared DS rather than a single global folder.

**Backwards compat:** if a project has the pre-v1.0 layout (single `.design/system/` with files directly in it), `mdcc init` (or first `/design` invocation) migrates: moves files into `.design/system/main/` and seeds `.design/config.json.designSystems: [{ name: "main", path: "system/main", default: true }]`.

## Metadata

- **Type:** New Feature
- **Complexity:** Medium (down from "High" after layers + CSS extraction)
- **Depends on:** Phase 4
- **Parallel with:** Phase 6
- **Affected files:**
  - `plugins/design/dev-server/client/canvas/AnnotationsLayer.tsx` (new — draw layer)
  - `plugins/design/dev-server/server.mjs` (new endpoint: `GET/PUT /api/annotations/<slug>`)
  - `plugins/design/dev-server/config.schema.json` (extend `designSystems[]`, `defaultDesignSystem`)
  - `plugins/design/commands/new.md` (extend `/design:new` with `--ds=<name>` flag + DS context piping)
  - `plugins/design/agents/design-critic.md` (multi-DS awareness — read canvas meta)
  - `plugins/flow/agents/design-system-guard.md` (scope to canvas's DS)
  - `plugins/design/skills/design-system/SKILL.md` (multi-DS pointer logic)
  - `plugins/design/dev-server/canvas-meta.schema.json` (extend `.meta.json` with `designSystem` field)
  - Migration: `.design/system/` → `.design/system/main/` (auto-migration in dev server first-open)

---

## Tasks

### Task 1: Draw tools

- **Do:** Toolbar buttons (pen, circle, arrow, eraser, color picker). Drawing happens on a transparent SVG layer sized to canvas world coords (zoomable with Phase 4 viewport). On stroke complete, PUT to `/api/annotations/<slug>` → `.design/<slug>.annotations.svg`.
- **Pattern:** [tldraw](https://github.com/tldraw/tldraw) is the gold standard but heavy — implement a minimal subset directly with native `<svg>` elements.
- **Validate:** Circle an element; reload; annotations restored. Eraser removes strokes.

### Task 2: Multi-DS schema + config-level support

- **Do:** Extend `config.schema.json` with:
  ```json
  {
    "designSystems": [{ "name": "string", "path": "string", "description": "string" }],
    "defaultDesignSystem": "string"
  }
  ```
  Update `.design/config.json` defaults. Document field semantics in new `.ai/docs/config-schema.md` (created in audit-driven update).
- **Validate:** JSON validates against schema; missing fields fall back to single-DS legacy layout.

### Task 3: `/design:new --ds=<name>` flag

- **Do:** Extend `plugins/design/commands/new.md` orchestrator: parse `--ds=<name>` flag; resolve to the DS's path from `.design/config.json.designSystems[]`; pass that DS's tokens + component HTML as additional context to `frontend-design` plugin invocation; also write `.meta.json.designSystem` for the new canvas.
- **Validate:** Project with two DS → `/design:new --ds=marketing HomeScreen "test"` produces a canvas referencing marketing tokens + meta points at marketing DS.

### Task 4: Per-canvas `.meta.json` DS field

- **Do:** Extend `canvas-meta.schema.json` to accept `designSystem: string` (kebab-case matching a `designSystems[]` entry). When a canvas is created without a meta, agent emits the default. Validate against schema.
- **Validate:** Hand-edit a canvas meta to point at a different DS; reload; `design-system-guard` audits against the new DS.

### Task 5: Update `design-system-guard` subagent

- **Do:** In `plugins/flow/agents/design-system-guard.md`, when invoked against a canvas, read `<canvas>.meta.json.designSystem`; resolve to DS path; check tokens / colors / typography against that DS, not a global "active DS". If no meta or DS missing, fall back to default DS.
- **Validate:** Two DS in project; canvas A uses DS-1, canvas B uses DS-2. Run subagent on each. Audits use correct DS each time.

### Task 6: Update `design:design-system` skill

- **Do:** In `plugins/design/skills/design-system/SKILL.md`, document the multi-DS lookup pattern. The skill is a *pointer* — actual content stays in user's `.design/system/<name>/`. Iteration-time selection: read active canvas → resolve DS from meta → load that DS's spec.
- **Validate:** Skill triggers on canvas iteration; loads correct DS specimen.

### Task 7: Backwards-compat migration

- **Do:** On dev-server boot, detect legacy layout (`.design/system/colors_and_type.css` directly, no `system/main/` subfolder, no `designSystems` array in config). If detected, prompt: "Migrate to multi-DS layout? Existing files become `.design/system/main/`. [Y/n]". On accept: move files, update config, leave a one-time `.design/MIGRATION-LOG.md` noting what happened.
- **Validate:** Pre-v1.0 project opens; migration prompt fires; files migrate cleanly; existing canvases continue to render (their implicit DS becomes "main").

### Task 8: Keyboard shortcuts for draw tools

- **Do:** B = pen, R = circle/rectangle, A = arrow, E = eraser, V = select (clear draw), Esc = exit draw mode. Cmd+/ = show shortcut sheet. (No shortcuts for layers / inspector — those live in Phase 12.)
- **Validate:** All shortcuts work; no conflict with browser defaults or canvas pan/zoom from Phase 4.

---

## Validation

1. **Static:** Bundle size delta ≤ 80KB gz after additions (smaller than original Phase 5 estimate since layers + inspector moved out).
2. **Functional:** Manual scenario through draw tools + multi-DS scaffold.
3. **Cross-platform scenario:** `scenario-runner` for `canvas-annotations` + `canvas-multi-ds-scaffold` (web-desktop).
4. **A11y:** `a11y-auditor` against draw toolbar (keyboard reachable; clear focus indicators).
5. **Design system:** `design-system-guard` self-test — verify subagent scopes correctly against canvas-declared DS.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-annotations` | Pen-circle an element → reload → annotation persists; toggle off for clean view | 🆕 new |
| `canvas-multi-ds-scaffold` | Project with 2 DS → `/design:new --ds=marketing ...` → new canvas uses marketing tokens + meta declares "marketing" | 🆕 new |
| `multi-ds-subagent-scope` | Canvas A (DS-1) + Canvas B (DS-2) → `design-system-guard` audits each → uses correct DS | 🆕 new |
| `multi-ds-migration` | Pre-v1.0 single-DS project → first boot → prompt → migrate → canvases render unchanged | 🆕 new |

---

## Acceptance criteria

- [ ] Draw / annotation tools persist to `.annotations.svg`; eraser works; toggle visible.
- [ ] `designSystems[]` schema + `defaultDesignSystem` field in `config.json`.
- [ ] `/design:new --ds=<name>` flag scaffolds canvas using that DS's tokens.
- [ ] `.meta.json.designSystem` field validated; per-canvas DS scoping works.
- [ ] `design-system-guard` subagent reads canvas meta and scopes audit accordingly.
- [ ] `design:design-system` skill auto-loads correct DS for active canvas.
- [ ] Backwards-compat migration on legacy single-DS layout; canvases continue to render.
- [ ] Layers panel + in-canvas CSS editor explicitly NOT in this phase — tracked in Phase 12.
- [ ] All draw-tool keyboard shortcuts work.
- [ ] No regression in Phase 4 canvas v2 perf benchmark.
