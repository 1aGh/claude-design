---
name: feature-3-web-artboards
status: planned
created: 2026-07-15
decisions: []   # record (or fold into the kinds DDR as an addendum): "web-kind authoring contract — flex-first, hug-height, container-query responsive"
depends-on: feature-1-artboard-kinds-foundation.md
absorbs: feature-grid-track-editor.md   # the CSS-grid track editor stub folds in here as the web-kind inspector stage
planned-via: /flow:plan 2026-07-15 — DDR-130 relay debate converged; parallel-able with feature-2-print-artboards.md
---

# Feature: Web artboards — flex-first authoring, breakpoints, reflow, grid track editor

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

`kind="web"` artboards formalize the auto-layout way of working: content is authored **flow-first** (flex/grid, no absolute positioning except deliberate overlays), the artboard behaves like a responsive viewport (width = breakpoint, height hugs content), and editing leans on the already-shipped flex/auto-layout editor plus the CSS-grid track editor absorbed from its stub plan. The key user difference vs digital/print: you don't move elements by coordinates — you reorder, adjust gaps/padding, and test reflow by resizing.

## User Story

As a designer, I want the agent to generate a landing page as a web artboard whose layout actually reflows, duplicate it at tablet/mobile widths with one action, drag the width to test breakpoints, and edit tracks/gaps/padding with the same on-canvas tools I know from Figma/Webflow — so the handoff (`/design:handoff`) is production-grade flex code, not absolutized pixels.

## Problem

- Nothing distinguishes a "web page" artboard from a static mock today; the agent has no contract to author flow-first, so reflow-testing and clean flex handoff are luck, not a property.
- No breakpoint workflow: duplicating a screen at another width is a manual copy-paste-resize.
- The CSS-grid track editor is a parked stub (`feature-grid-track-editor.md`) with no home; grid containers have no on-canvas track editing.

## Solution

A thin plan (foundation makes it thin): the web-kind **authoring contract** (skill rules + generation envelope), **breakpoint presets + duplicate-at-breakpoint**, a **breakpoint band chrome** via the foundation overlay registry, and the **grid track editor** implemented per the absorbed stub's spec. Reflow testing is nearly free: `DCArtboard` without `fixed` already hugs height, and `.dc-artboard-body` is already `container-type: inline-size` — so `@container` rules authored by the agent respond to artboard width out of the box.

## Metadata

- **Ticket**: — (user-requested, /flow:plan session 2026-07-15)
- **Type**: New Capability
- **Complexity**: Medium (High only inside the absorbed grid editor)
- **App/Package**: `apps/studio` (canvas-lib chrome, client inspector/overlays) + `plugins/design` (skill)
- **Affected Systems**: foundation kind/overlay/preset seams, flex editor (Stage M, shipped), context menu, handoff
- **Dependencies**: foundation plan. Parallel-able with the print plan. Coordinates with `feature-4-canvas-editing-figma-parity.md` (convert-to-absolute precedence — see Gotchas).

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `.ai/plans/feature-grid-track-editor.md` — the absorbed spec: track define/drag-resize (Shift = symmetric), per-track units incl. `fr`, cell placement with corner-drag span, Webflow Grid 2.0 as reference model.
- `.ai/plans/archive/feature-element-editing-robustness.md` (Stage M + Stage D/J sections) — the shipped flex editor + resize/spacing lanes the grid editor composes with (fixed-rAF overlay siblings, edit-css commit + undo, INV-1/INV-2).
- `apps/studio/canvas-lib.tsx` (1813-1843) — DCArtboard props: `fixed` absent = HUG (the web reflow enabler); (302-318) `container-type: inline-size` body.
- `apps/studio/client/app.jsx` (4219-4224) — `SCREEN_PRESETS`; add/align web breakpoint presets; (6763-6874) ArtboardKnobs.
- `apps/studio/canvas-shell.tsx` (1289-1808) — context-menu registry (duplicate-at-breakpoint entry); element-editing plan's Stage-I structural insert engine refs for artboard cloning.
- `apps/studio/use-element-resize.tsx` (394-398, 446-447) — artboard resize handles (width-drag reflow testing).
- `plugins/design/commands/new.md` (634-638) — artboard-isolation rules (vw/vh ban) the web contract builds on.
- `plugins/design/commands/handoff.md` + `plugins/design/skills` — handoff metadata seam for kind.

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Studio.tsx` | (no sidecar status) | Inspector additions (Grid section, breakpoint picker) designed here first per DDR-104. |

### Documentation

- [Figma — Guide to auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout) — Why: the Hug/Fill/Fixed + gap/padding vocabulary the shipped flex editor already mirrors; web-kind docs reuse it.
- [Webflow University — Grid 2.0](https://university.webflow.com/videos/grid-2-0) — Why: the absorbed stub's reference interaction model.
- [Framer — breakpoints](https://www.framer.com/blog/responsive-breakpoints/) — Why: breakpoints-bar UX + desktop-first inheritance framing for duplicate-at-breakpoint.
- [Webflow — Flexbox](https://help.webflow.com/hc/en-us/articles/33961260795155-Flexbox) — Why: flex panel completeness check.

### Patterns to Follow

- Foundation overlay registry (breakpoint band = web-kind content).
- Stage-I structural insert + whole-file snapshot undo (artboard duplicate).
- Stage-M flex editor lanes (grid editor = sibling overlay + edit-css commits, same invariants).

---

## Design Decisions

1. **Web artboard = viewport**: width is the breakpoint (px), height hugs (`fixed` omitted). Generation contract: flow layout only (flex/grid/normal flow), absolute positioning only for deliberate overlays (badges, floating CTAs) with a one-line justification comment; responsiveness within the canvas via `@container` queries (body is already a container), NEVER vw/vh (existing ban).
2. **Breakpoint presets** live beside `SCREEN_PRESETS` (mobile 390 / tablet 834 / laptop 1280 / desktop 1440 already exist — add explicit web-breakpoint labels; no mm/physical units here).
3. **Duplicate-at-breakpoint is a copy, not a linked variant.** Desktop-first inheritance à la Framer is explicitly out of scope (would need a variant model + sync semantics — future DDR if demanded). The action clones the artboard at a new width; the agent (or `@container` rules) adapts content.
4. **Grid track editor implements the stub verbatim** (define tracks, gutter drag ±Shift, px/%/fr/auto/min-content/max-content units, cell placement + corner-span) and composes with Stage-D/J overlays. `fr` must round-trip source.
5. **Convert-to-absolute precedence** (coordination with the editing-trio plan): a container that was converted to absolute is no longer a grid/flex editing target — the grid editor and flex editor gate on computed `display`; convert warns when the target hosts grid-placed children.

---

## Tasks

### T1: DEFINE web-kind authoring contract (skill)
- **Do**: skill `design` + `/design:new` envelope: `kind="web"` rules (flow-first, hug height, `@container` responsiveness, absolute-only-with-justification); brief detection (web/landing/stranka/webovka → web kind); `/design:edit` awareness (edits preserve flow discipline; keeper flags gratuitous absolute positioning inside web artboards as drift).
- **Gotcha**: pass briefs verbatim; contract examples live in the skill, not hardcoded in templates (DDR-043 bias rules).
- **Validate**: scratch `/design:new` dry run → flex-first artboard, hug height, container query present.

### T2: ADD breakpoint presets + web chrome
- **Do**: web preset labels in the preset table; breakpoint band chrome (e.g. "≤ 768") via foundation overlay registry for `kind="web"`; kind badge (foundation T3 handles the icon).
- **Validate**: fixture screenshot; `/design:smoke`.

### T3: ADD duplicate-at-breakpoint action
- **Do**: context-menu (artboard-chrome) + ArtboardKnobs action "Duplicate at width…" → structural clone via the Stage-I insert engine with new `width` + suffixed id/label, positioned beside the source (`patchCanvasMeta` grid placement).
- **Pattern**: Stage-I new-artboard insert (`scaffold-design.ts:35-79` shape) + whole-file snapshot undo.
- **Gotcha**: reused-component children clone as usages (Stage-H scope semantics — artboard-local wrappers).
- **Validate**: agent-browser: duplicate desktop → 390px clone reflows (hug height re-measures).

### T4: VERIFY reflow affordance end-to-end
- **Do**: confirm width-only resize handle behavior on web artboards re-measures hug height live; fix any clamp/measure staleness; document "drag width to test reflow" in skill + What's New.
- **Validate**: agent-browser drag E handle across 390→1440 on the T1 fixture; no layout freeze.

### T5: IMPLEMENT the CSS-grid track editor (absorbed stub)
- **Do**: per the stub's five requirements — Inspector Grid section (tracks list + gap reuse), on-canvas gutter drag-resize overlay (new fixed-rAF sibling; Shift = symmetric neighbors), per-track unit picker with `fr` round-trip, cell placement (`grid-column`/`grid-row` + corner-drag span), Stage-H edit-scope + DDR-054 main-origin-write + INV-1 undo / INV-2 no-flicker.
- **Pattern**: Stage-J spacing overlay + Stage-D resize lanes.
- **Gotcha**: handle hit-tests must not collide with resize/spacing handles (gutters between tracks, padding inside, resize on frame); gate all of it on computed `display:grid`.
- **Validate**: bun tests for track-list parsing/serialization; agent-browser scenario: define 3 cols → drag gutter → assign cell span → undo ×3 restores source.

### T6: THREAD kind into handoff
- **Do**: `/design:handoff` registry-item metadata gains the artboard kind; web-kind handoff notes (flex-first code, container queries) in the handoff doc.
- **Validate**: handoff dry run on the fixture → metadata present.

### T7: SUPERSEDE the stub + DDR/docs/What's New
- **Do**: move `feature-grid-track-editor.md` to `archive/` with an "absorbed into feature-3-web-artboards" header note (already annotated at plan time); record the web-contract DDR (or kinds-DDR addendum); `whats-new-entry`; roadmap regen.

---

## Validation

1. `pnpm lint` / `pnpm format` / `pnpm test && pnpm test:dev-server` / `pnpm --filter @maude/site build`; client bundle rebuilt release-minified + committed.
2. `/design:smoke` (chrome + grid overlay must not blank existing canvases).
3. Agent-browser scenario pack: generate web fixture → duplicate at 390 → reflow drag → grid track edit → undo chain. 0 blockers.
4. design-system-guard + a11y-auditor on touched inspector UI.

## Acceptance Criteria

- [ ] T1–T7 complete; web-kind generation provably flow-first (keeper check green on fixture)
- [ ] Duplicate-at-breakpoint + reflow-drag work end-to-end with undo
- [ ] Grid track editor matches the absorbed stub's 5 requirements incl. `fr` round-trip
- [ ] Stub plan archived with absorption note; kind in handoff metadata
- [ ] DDR/addendum recorded; What's New authored; `/flow:validate` clean
