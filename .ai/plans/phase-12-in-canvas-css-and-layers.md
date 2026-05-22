# Phase 12: In-canvas CSS editor + Layers panel

> **End-of-roadmap extra feature.** Created 2026-05-12 by extraction from old Phase 5. The user explicitly tagged this as "extra feature, úplně na konec." Ship target: v1.3+ (no firm date). Pursued only if v1.0/v1.1 user feedback validates that direct manipulation is preferred over `/design "<feedback>"` round-trips.

## Description

Add Figma / Webflow-grade direct manipulation: a **layers panel** (DOM tree of active artboard — collapsible, selectable, drag-to-reorder) and an **in-canvas CSS editor** (right sidebar that surfaces top-edited CSS properties for the selected element and writes changes back to source HTML). Together they let a developer make small tweaks (padding, color, border-radius) without invoking the AI agent.

## User Story

As a developer reviewing a canvas, I want to Cmd+click a button, change its `border-radius` and `padding` in a side panel, and have the source HTML update — so that small tweaks don't require a full `/design "<feedback>"` round-trip with the AI.

## Problem

- Today, ANY canvas change — even nudging a padding value — requires invoking `/design "<feedback>"`. That's a heavyweight context for trivial CSS edits.
- No way to see "what's inside" a canvas without opening the HTML file in the editor. Hard to navigate complex artboards with deep nesting.
- The AI agent for trivial cosmetic tweaks adds latency and cost; humans should be able to nudge values directly.

## Why deferred to end-of-roadmap

1. **Value uncertain.** The current `/design "<feedback>"` workflow may already be good enough for most users. We don't yet know if direct manipulation is the friction point or a luxury.
2. **Complexity high.** A proper inspector + layers panel is ~2 weeks of UI work + a source-rewrite strategy DDR that has long tail (inline style → ugly diffs; new class → complex CSS parsing; "smart" detect-and-modify → most user-friendly but most engineering work).
3. **Scope creep risk.** Once you have an inspector, users immediately want: animations editor, pseudo-class previews, computed-style inspection, breakpoint variant editor. Deferring lets that creep manifest as separate v2.x decisions, not v1.0 scope inflation.
4. **Phase 8 collab maturity matters.** Inspector edits during multi-peer sessions hit the same conflict surface as Phase 10 structured CRDT — if Phase 10 isn't shipped (which is conditional itself), inspector edits across peers garble each other. Better to wait until the conflict story is settled.

## Solution

Three sub-deliverables sharing the Phase 4 canvas v2 substrate:

**A. Layers panel** (collapsible left sidebar) — DOM tree of the active artboard, click to select (syncs with `_active.json.selected`), drag to reorder, hover to highlight, icons for element type (button / heading / form / etc.). Toggle via `L` key.

**B. In-canvas CSS editor** (right sidebar when element selected) — input fields for the most-edited properties (color, background, padding, margin, border-radius, font-size, font-weight, width, height). Live preview via inline style; on commit (blur or Enter), server rewrites the source HTML to apply the change. DDR for "where do we write the change: inline style? class? CSS module?" Toggle via `I` key.

> **Export entry point:** The Inspector Panel toolbar duplicates the Export affordance from [Phase 6.5](./phase-6.5-export.md). Same dialog, same `POST /api/export` endpoint — the panel just calls it with the layers-tree selection pre-filled as scope. No new engine work; Phase 6.5 ships the engine, Phase 12 adds the second caller.

**C. Source-rewrite strategy** (DDR + implementation) — the most consequential decision. Options:
- **Inline `style="..."`** — simple, ugly diffs, no class explosion
- **New utility class with hash name** — clean diffs, requires CSS parsing
- **"Smart" — detect existing class** and modify if the property is the only thing changing — best UX, most engineering work

## Metadata

- **Type:** New Feature
- **Complexity:** High
- **Depends on:** Phase 4 (canvas v2), Phase 5 (multi-DS for class/token scoping)
- **Ideally also depends on:** Phase 10 (structured CRDT) if multi-peer co-editing of inspector ops matters — otherwise edits are single-writer-per-canvas via soft lock from Phase 8.
- **Parallel with:** —
- **Ship target:** v1.3+ (conditional on user feedback)
- **Affected files:**
  - `plugins/design/dev-server/client/panels/LayersPanel.tsx` (new)
  - `plugins/design/dev-server/client/panels/InspectorPanel.tsx` (new)
  - `plugins/design/dev-server/server.mjs` (new endpoint: `POST /api/edit-css`)
  - `plugins/design/dev-server/runtime/source-rewrite/` (new — strategy implementation per DDR)

---

## Tasks

### Task 0: Pre-implementation user-feedback gate

- **Do:** Survey v1.0/v1.1 users. Sample question: "How often do you wish you could change padding/color directly in the canvas without invoking AI?" Threshold to proceed: ≥30% of active users say "frequently". Otherwise: park indefinitely; document the gate result as a DDR.
- **Validate:** DDR in `.ai/decisions/phase-12-gate.md` records the survey result and the go / no-go decision.

### Task 1: Layers panel UI

- **Do:** Read the active iframe's `document.body`; build a tree via DOM walk; render with `<details>` collapsibles. Click handler dispatches `selected` over WS (same channel `_active.json` uses). Drag to reorder via HTML5 drag-and-drop; on drop, mutate DOM in iframe + push update to server.
- **Pattern:** Mirror Chrome DevTools Elements panel — minimal but recognizable.
- **Validate:** Click a button in the tree → corresponding element highlights in canvas → `_active.json.selected.cssPath` updates. Drag a sibling above → DOM reflects new order + source updates.

### Task 2: Inspector panel (CSS editor)

- **Do:** When element selected, read its computed style; populate inputs for top-10 properties (color, background, padding, margin, border-radius, font-size, font-weight, width, height, display). On change: apply inline style for preview; on commit (blur or Enter): POST to `/api/edit-css { canvasSlug, cssPath, property, value }`. Server applies rewrite strategy from Task 3 DDR.
- **Pattern:** Webflow's right panel. Top 10 properties cover 80% of tweaks; resist scope creep.
- **Validate:** Change padding; reload page; new value persisted.

### Task 3: Source-rewrite strategy DDR

- **Do:** Decide between inline / new class / smart detect. Lean toward **smart detect with inline fallback** for v1.3; document upgrade path. If "smart" is too complex, fall back to inline. The DDR captures cost vs. UX trade-off.
- **Validate:** DDR exists; rewrite strategy implemented matches DDR; sample edits produce expected source diffs.

### Task 4: Phase 10 integration (if shipped)

- **Do:** If Phase 10 structured CRDT is live, inspector edits become Y.XmlElement attribute ops instead of REST POST. Multi-peer co-editing works naturally. If Phase 10 is not shipped (still Phase 8 soft-lock model), inspector edits are single-writer per canvas — Phase 8 AI banner extends to "Peer X is editing inspector".
- **Validate:** Two peers editing same element padding simultaneously: with Phase 10, both apply; without Phase 10, soft lock prevents collision.

### Task 5: Keyboard shortcuts

- **Do:** L = toggle layers, I = toggle inspector, Esc = clear selection. Cmd+/ = show shortcut sheet (extends draw-tool shortcuts from Phase 5).
- **Validate:** Shortcuts work; no conflict with browser, canvas pan/zoom, or draw-tool shortcuts.

### Task 6: Performance budget

- **Do:** Layers panel must render a 500-element canvas in ≤ 100ms (virtualized list if needed). Inspector must apply edits in ≤ 50ms perceived latency.
- **Validate:** Benchmark on a heavy canvas; lat numbers logged.

---

## Validation

1. **Static:** Bundle size delta ≤ 60KB gz (layers + inspector + source-rewrite combined).
2. **Functional:** Manual scenario through all 3 sub-deliverables.
3. **Cross-platform scenario:** `scenario-runner` for `canvas-inspector-edit` + `canvas-layers-reorder` (web-desktop only — touch out of scope).
4. **A11y:** `a11y-auditor` against layers + inspector panels (keyboard-only nav must work).
5. **Multi-peer (if Phase 10 shipped):** scenario `inspector-coedit-padding` from Phase 10.
6. **No regression:** Phase 4-8 still works without panels open.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-inspector-edit` | Cmd+click button → inspector opens → change padding → source HTML updated → reload preserves | 🆕 new |
| `canvas-layers-reorder` | Open layers → drag a div above its sibling → source DOM order matches | 🆕 new |
| `inspector-source-rewrite-strategy` | Edit a CSS prop → source diff matches DDR'd strategy (inline / class / smart) | 🆕 new |

---

## Acceptance criteria

- [ ] Gate decision recorded (Task 0): proceed or park indefinitely.
- [ ] Layers panel toggles via `L`; element clicks sync with `_active.json`.
- [ ] Inspector edits top-10 CSS properties write back to source HTML.
- [ ] Source-rewrite strategy decided + documented in DDR.
- [ ] Multi-peer behavior consistent with active Phase 8 (soft lock) or Phase 10 (CRDT) model.
- [ ] All keyboard shortcuts work and documented in docs site.
- [ ] No regression in canvas v2 perf benchmark.
- [ ] Performance budgets met (layers ≤ 100ms, inspector edit ≤ 50ms).
