---
name: feature-4-canvas-editing-figma-parity
status: in-progress
created: 2026-07-15
decisions: []   # record via /flow:record-ddr at execute: (1) selection model — browse/move tool split + boot posture; (2) convert-to-absolute — reversal of the documented non-goal
depends-on: none   # deliberately kind-independent; runs PARALLEL to the artboard-kinds family
planned-via: /flow:plan 2026-07-15 — DDR-130 relay debate; boot-posture fork surfaced to the user, decided 2026-07-15: boot = browse/alive (matches 3/3 seat recommendation)
---

# Feature: Figma-parity manual editing — smart select (browse/move split), layers panel upgrade, convert-to-absolute

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **Parallel track.** This plan is deliberately decoupled from the artboard-kinds family (foundation/print/web): it touches the input router, the transpile/layers pipeline, and a documented interaction non-goal — a categorically different blast radius. A regression here must never gate the print/web ship line. Selection behavior is TOOL-based, never keyed on artboard kind (debate-rejected: kinds coexist on one canvas ⇒ invisible positional mode + hot-path kind lookup).

## Execution status (2026-07-18, `/flow:execute`, branch `main`)

**Shipped + tested (the smart-select interaction model — the user's #1 pain — in full):**
- **T1/DDR** — [DDR-187](../decisions/DDR-187-figma-select-browse-move-split-and-boot-posture.md) recorded (selection model + boot posture + the A-vs-B fork + the promoted pass-through invariant).
- **T2** — browse/move split. New `browse` tool (boot default, pure native pass-through, zero select machinery); `move` → full Figma ladder (bare=top / Shift=add-top / Cmd=deepest / Cmd+Shift=add-deep + bare-hover halo). Files: `input-router.tsx`, `use-tool-mode.tsx`, `canvas-cursors.ts`, `canvas-icons.tsx` (IconBrowse), `tool-palette.tsx`, shell menubar + `tool-set` (app.jsx). Every `tool === 'move'` gate untouched → inert in browse.
- **T3** — dblclick drill (L6) + Enter/Shift+Enter/Tab ladder (L2) already Figma-shaped; hardened both to be browse-passthrough (`onDbl` + `use-keyboard-discipline` bail in browse). Esc=deselect (unchanged).
- **T4** — discoverability: palette leads Browse + Select; one-time first-run "press V" hint (localStorage `maude-browse-hint-seen`); shell browse cursor special-case.
- **T5** — posture tests: `input-router.test.ts` rewritten + browse/leak guards; new `browse-posture.test.tsx` (happy-dom + createRoot, native-fires-in-browse vs claimed-in-move); `use-tool-mode.test.tsx` updated.
- **T7 (partial)** — layers: **synthetic group rows for unstamped wrappers** (the "some elements don't show up / tree is flat" fix) + `layers-synthetic-groups.test.ts` (6 cases); **auto-reveal** of the selected row (expand ancestors + scroll-into-view). Type icons + dimmed-hidden already existed.
- **T8 — convert-to-absolute + DDR-188 ✅** (follow-up session, committed separately). Explicit context-menu "Convert children to absolute position" (Figma "Remove auto layout"), container-gated. Client measures each direct stamped child's frozen border-box in WORLD units (padding-relative) → posts `convert-to-absolute-request`; main-origin `/_api/convert-to-absolute` → `convertChildrenToAbsoluteOp` (api.ts) → `convertToAbsolute`/`applyConvertToAbsolute` (canvas-edit.ts) rewrites each child to `position:absolute` + frozen box + `box-sizing:border-box` and the container to `position:relative` (if static) in ONE MagicString pass → ONE `logUndo` seq (rides the DDR-138 whole-file undo lane via `structuralWrite` → one Cmd+Z reverts). New `setMultipleStyleProps` avoids the duplicate-`style` bug. **Plain, globally-unique children only** — unstamped / repeated (`.map`) / component-instance abort all-or-nothing with a clear toast (client pre-filter + server `resolveUsageId` backstop). Non-goal comments updated to point at DDR-188. New `convert-to-absolute.test.ts` (6 cases). DDR-188 recorded.
- **T9** — What's New entry `figma-smart-select` (expanded to include convert); design docs interaction model + convert section updated.

**Deferred as scoped follow-ups (reasons: blast-radius/risk + session budget; each is genuinely independent and none blocks the shipped core):**
- **T7 remainder** — component-instance colouring (purple ◇; needs the `collectElementsFull` component-map delivered to the shell over a new channel), locked state (needs a `locked` view.json field + canvas-side drag/select enforcement), inline rename (needs a `data-dc-element` attr-write channel). The plan always scoped these as incremental; the missing-layers fix (the concrete bug) landed.
- **T8 "affects N instances" confirm** for genuine component instances (currently a clean abort — Stage-H is a passive badge, no modal primitive exists).

**T6 (desktop e2e) — audited + fixed (live run deferred):** swept every `apps/desktop/e2e/scenarios/*.e2e.ts` — only `canvas-text-editing.e2e.ts` touches canvas CONTENT (its whole suite is dblclick→edit + annotation editing), which the boot=browse posture breaks (`onDbl` bails in browse). Fixed: it presses **V** once after the canvas boots (onEscape returns any draw/text tool → move between phases, so the single press holds); this doubles as the harness's V-select posture coverage. Every other scenario clicks the SIDEBAR (`canvas-row`/`canvas-list`), not canvas content — unaffected. The live `/desktop-e2e` run needs a `cargo` desktop build + WKWebView (not headless-feasible this session per the native-app-verification-ceiling); the audit + fix land now, the green run is the owner close-out.

**Verified:** `bun tsc --noEmit` 8 baseline errors, 0 new. Full `bun test` (apps/studio) 3061 pass / 5 skip / 0 fail. `biome check` 0 errors on every touched file. Client bundle rebuilt release-minified. Live agent-browser / `/design:smoke` are the recommended pre-merge close-out (dev-server boot clobbers `dist/`; modifier-click gestures aren't agent-browser-automatable).

---

## Description

Three universal manual-editing upgrades the user asked for:

1. **Figma smart select** — split today's overloaded `move` tool into **`browse`** (pure native pass-through; the BOOT default — mocks stay alive) and **`move`/V (select tool)** which gains **bare-click select**: plain click = top-level object, Cmd/Ctrl+click = deepest element, double-click = drill one level, Enter/Shift+Enter/Tab ladder, Esc deselect.
2. **Layers panel, incremental Figma-grade** — fix the "some elements don't show up" cause (unstamped-wrapper collapse), add component-instance awareness (purple ◇), locked state, auto-reveal of selection, rename; the full component-depth tree rebuild is explicitly deferred.
3. **Convert to absolute position** — context-menu action that snapshots computed boxes and rewrites a container's children to `position:absolute` (the Figma "Remove auto layout" analogue), deliberately reversing a documented non-goal — with its own DDR and a regression sweep over every consumer that branches on `position`.

## User Story

As a designer, I open a canvas and my mock is alive (buttons click). When I want to edit, I press **V** — from that moment plain click selects like Figma (deep-select on Cmd, drill on double-click), the Layers panel shows every layer with proper icons and purple component instances, and when a generated flex layout fights my manual tweaks I right-click → "Convert to absolute position" and just drag things where I want them.

## Problem

- Selection requires Cmd+click ("už mi přijde zbytečný"); plain click in the (default) move tool is a native pass-through no-op — the Figma muscle-memory gesture does nothing.
- The Layers tree emits only `[data-cd-id]`-stamped elements — unstamped wrappers collapse away (looks like missing layers), it is component-blind (no purple instances), and has no locked state.
- There is no way to flatten a flow layout to absolute positioning; the reposition lane is gated on elements ALREADY being out-of-flow, and the non-goal is enforced by code comments (`contextual-toolbar.tsx:170-178`, `use-element-resize.tsx:21-24`).

## Solution

**Browse/move split (minimal-diff decomposition):** new tool id `browse` = exactly today's move-without-Cmd behavior (pure pass-through), becomes the boot default (`use-tool-mode.tsx:92`). `move` (V) keeps ALL its existing gates (marquee/artboard-marquee/spacing/drag remain `tool === 'move'`, zero rewires) and its bare-click branch flips to select-first using the already-built-but-unused `deep:false` "top mode" ladder (`input-router.tsx:671-679`). Double-click drill-in already exists (`canvas-shell.tsx:2327-2355`) — align it with the Figma ladder. **Boot posture = browse** (user decision 2026-07-15, unanimous seat recommendation): zero regression for existing canvases and every native-input surface (photo editor, video timeline, whiteboard); Figma muscle memory arrives the instant V is pressed. Residual-risk mitigation: visible select-tool affordance in the toolbar + a light "press V to select & edit" first-run hint + What's New entry.

## Metadata

- **Ticket**: — (user-requested, /flow:plan session 2026-07-15)
- **Type**: Enhancement (interaction model) + New Capability (convert)
- **Complexity**: High
- **App/Package**: `apps/studio` (input-router, canvas-shell, canvas-lib, canvas-edit transpile, client app.jsx)
- **Affected Systems**: input routing (hot path), tool mode, layers pipeline (iframe serializer → shell tree), context menu, transpile stamping, desktop e2e scenarios
- **Dependencies**: none (parallel to the kinds family). Coordinates with the web plan's grid editor (convert precedence) and foundation T7 (element-drag guide snapping lands here if sequenced later).

---

## Context References

### Must-Read Files

> Read in parallel during `/flow:execute`.

- `apps/studio/input-router.tsx` (268-283) — the Move-tool click branch: bare = pass-through (:275), Cmd = select `deep:true` (:270-283); (614-680) `resolveHoverTarget` incl. the unused `deep:false` top-mode ladder (:671-679); (143, 243) space-pan (why the peek gesture must NOT be spacebar); (356-365) overlay allowlist (comment pins); (530-547) context-menu trigger.
- `apps/studio/use-tool-mode.tsx` (92) — `initial = 'move'`: where `browse` becomes the boot default.
- `apps/studio/canvas-shell.tsx` (2320-2372) — double-click handler: leaf text-edit vs drill-in (:2327-2355 via `stampedChainToBody` :457-466); (3320-3363) bare-only drag threshold (click-vs-drag disambiguation rides this); (2038-2078) select-by-id + hover sync; (520-548) `serializeArtboardTree` + (:399-413) `LayerNode`; (611-639) MutationObserver re-post; (1289-1808) context-menu registry; (1425-1678) element section (convert entry home); (3333, 3466-3494) the out-of-flow gate on reposition.
- `apps/studio/marquee-overlay.tsx` (154-166) + `apps/studio/artboard-marquee.tsx` (77-85, 127-131) — `tool === 'move'` gates that must stay wired to the select tool unchanged.
- `apps/studio/client/app.jsx` (6541-6670) — `LayerRow` (+ `LAYER_TYPE_ICON` :6478-6489); (7511-7551) tree render; (7637-7644) select-by-id post; (5420-5436, 6021-6045) the position knob (convert's write primitive); (10426-10482) `repositionElement`.
- `apps/studio/canvas-edit.ts` (56-70) — `componentNameOf` + `computeId` (stamping); (1002-1038) `collectElementsFull` (`{id, componentName, isFrameRoot, tag}` — the component-signal source); (1096-1153) edit-scope.
- `apps/studio/contextual-toolbar.tsx` (170-178) + `apps/studio/use-element-resize.tsx` (21-24) — the documented non-goal comments convert-to-absolute reverses (update them!).
- `apps/desktop/e2e/` — scenarios clicking `canvas-frame` content (posture audit, T6).

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Studio.tsx` | (no sidecar status) | Layers-panel visual upgrade (icons, purple instances, lock, reveal) designed here first per DDR-104; user's Figma screenshot (2026-07-15 message) is the reference. |

### Documentation

- [Figma — Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) — Why: the exact ladder (plain=parent/top-level, ⌘=deep, dblclick=one level, Enter/Shift+Enter, Tab siblings, Esc=deselect-not-up).
- [Figma — layers sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar) + [Toggle visibility](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) + [Lock/unlock](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) — Why: row conventions (purple ◇ instances, dimmed hidden, padlock).
- [Figma — Guide to auto layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout) — Why: "Remove auto layout" (`⌥⇧A`) = the convert analogue; "Ignore auto layout" = the per-child variant (out of scope, note only).
- [Webflow — Preview mode](https://help.webflow.com/hc/en-us/articles/40881969908627-Preview-mode) — Why: every prototype-capable tool separates select vs interact by MODE; Maude's browse tool is that mode, inverted (alive by default).

### Patterns to Follow

- Whole-file snapshot undo (Stage-I structural lane) for convert.
- Function-form `disabled`/`hidden` context-menu items (`open-timeline` precedent, `canvas-shell.tsx:1699`).
- `canvas-origin-gate.test.ts` style — the posture regression tests are this plan's equivalent load-bearing gate.

---

## Design Decisions

1. **Boot = browse (alive).** User-decided 2026-07-15 after a surfaced fork; 3/3 seats recommended it. The alternative (boot into select, Figma-literal) is recorded in the DDR with its costs (regresses every native-input surface, needs Interact mode + peek + hint machinery).
2. **No gate rewires.** `browse` carries zero select machinery; every existing `tool === 'move'` gate stays untouched — that's the whole point of the split.
3. **Selection ladder is Figma-exact**: plain click = TOP-level stamped object (via the dormant `deep:false` ladder), NOT the deepest (research correction — deepest is Cmd's job); dblclick = one level per click; Esc = deselect only.
4. **No spacebar peek** (space = pan). If a quick-peek from select proves needed, pick a dedicated non-colliding key during implementation (explicit collision audit vs snap-Alt, measure-Alt-hover, Cmd-suppress-snap).
5. **Layers: incremental, not rebuild.** Component signal comes from the server-side map (`collectElementsFull`) delivered to the shell (no DOM re-stamp) — IF perf demands a `data-dc-component` DOM attr instead, it ships flag-gated (off default) because the transpile pass touches every canvas (the `runtime-health.sh` regression class). Locked state = per-user (view.json), not versioned.
6. **Convert-to-absolute is one-way by design** (undo works via snapshot; there is no "convert back to flow"). Stamped children only; unstamped children abort with a clear message. Shared-component children route through the Stage-H "affects N instances" confirm.

---

## Tasks

### T1: RECORD the selection-model DDR
- **Do**: browse/move split; boot posture decision + the A-vs-B fork and user call; the pass-through invariant's promotion from comment to test; e2e migration note.

### T2: IMPLEMENT the browse/move split
- **Do**: add `browse` tool (palette icon + cursor); `initial='browse'` (`use-tool-mode.tsx:92`); flip the `move` bare-click branch (`input-router.tsx:270-283`) to select-first using `resolveHoverTarget` `deep:false` (:671-679) for plain, `deep:true` for Cmd; keep native pass-through verbatim in `browse`.
- **Gotcha**: bare-click select must ride the existing drag threshold (`canvas-shell.tsx:3320-3363`): move ≥ threshold ⇒ reorder/marquee as today, release-in-place ⇒ select. Empty-world bare click keeps clearing selection (`artboard-marquee.tsx:127-131`).
- **Validate**: bun tests (T5) + agent-browser: boot → click button fires; press V → click selects top; Cmd+click selects deep.

### T3: COMPLETE the selection ladder
- **Do**: align dblclick drill (`canvas-shell.tsx:2327-2355`) with the ladder (one level per click; leaf-text dblclick still enters text edit — Figma-consistent); verify/extend Enter (child) / Shift+Enter (parent) / Tab (siblings) / Esc (deselect) in `use-keyboard-discipline`; keep the right-click "Select layer" ancestor submenu.
- **Gotcha**: dblclick on a leaf inside a not-yet-selected chain: Figma drills first, edits text only when the leaf is reached — match that ordering.
- **Validate**: agent-browser ladder walk on a 4-deep fixture.

### T4: ADD discoverability affordances
- **Do**: visible select-tool affordance (toolbar), "press V to select & edit" one-time first-run hint (localStorage marker, same family as `mdcc-whatsnew-seen`), What's New entry with spotlight step.
- **Validate**: fresh-profile agent-browser run shows the hint exactly once.

### T5: ADD posture regression tests
- **Do**: (a) bare-click in `browse` ⇒ NO selection + native event fires (assert a real click handler runs in the iframe fixture); (b) bare-click in `move` ⇒ selects top-level; (c) Cmd-click ⇒ deepest; (d) select never fires in comment/draw/hand branches; (e) click-vs-drag threshold disambiguation. This converts the `input-router.tsx:275` comment-invariant into an enforced gate (canvas-origin-gate style).
- **Validate**: `pnpm test:dev-server`.

### T6: AUDIT + migrate desktop e2e
- **Do**: sweep `apps/desktop/e2e/` scenarios that click canvas content; make posture explicit (stay in browse for prototype clicks; switch to V where a scenario intends selection). Add one native scenario covering V-select.
- **Validate**: `/desktop-e2e` run green.

### T7: UPGRADE layers panel (incremental)
- **Do**: (a) unstamped-wrapper fix — serializer emits synthetic, non-selectable "group" rows for unstamped containers that have stamped descendants (label from tag/class), so the tree mirrors real nesting instead of hoisting; (b) component awareness — ship `collectElementsFull`'s `{id → componentName, isFrameRoot}` map to the shell (existing `/_index-data`-style or edit-scope channel), render instance rows purple with ◇ (main-component ◆ if detectable); (c) locked state — padlock per row, persisted per-user in view.json, drag/select honor it on canvas; (d) row polish per the user's Figma screenshot: type icons (extend `LAYER_TYPE_ICON`), dimmed hidden rows, auto-reveal + scroll-to selected row, dblclick rename writing `data-dc-element` (label priority already reads it — cheap win).
- **Gotcha**: DEFER the full component-depth tree and any transpile-pass `data-dc-component` stamping (flag-gated future step); MutationObserver debounce (90 ms) must survive the bigger tree — measure on a 300-node canvas.
- **Validate**: bun serializer tests (synthetic rows, lock filtering); agent-browser: nested fixture shows previously-invisible wrappers, purple instance rows, lock blocks canvas drag, rename round-trips to source.

### T8: IMPLEMENT convert-to-absolute + its DDR
- **Do**: context-menu element action "Convert children to absolute position" (container-gated via function-form `hidden`) + artboard-chrome variant "Convert artboard to absolute"; mechanism: snapshot each stamped child's computed box relative to the container → batch `edit-css` writes (`position:absolute; left; top; width; height`) + container `position:relative` (if static), one whole-file snapshot undo record; then UPDATE the non-goal comments (`contextual-toolbar.tsx:170-178`, `use-element-resize.tsx:21-24`) to point at the DDR; regression sweep over `position`-branching consumers (reorder lane, align/distribute, sizing-mode, keyboard nudge, resize left/top) with the fixture converted mid-suite.
- **Gotcha**: (a) Figma "Remove auto layout" freezes computed X/Y — match that fidelity (zero visual delta gate: screenshot before/after diff); (b) shared-component children → Stage-H confirm ("affects N instances"); (c) unstamped children ⇒ abort with message (no partial conversion); (d) grid-placed children: warn that grid-track editing (web plan) stops applying; (e) width/height snapshot uses border-box.
- **Validate**: bun test on the AST batch write; agent-browser: convert a flex hero → pixel-identical screenshot → drag a child freely → undo restores source byte-exact.

### T9: What's New + docs + roadmap regen
- **Do**: `whats-new-entry` (smart select + layers + convert, with tour steps); site docs; `pnpm --filter @maude/site gen:roadmap`.

---

## Validation

1. `pnpm lint` / `pnpm format` / `pnpm test && pnpm test:dev-server` (posture suite T5 is load-bearing) / `pnpm --filter @maude/site build`.
2. Client bundle rebuilt release-minified + committed after every client/styles edit.
3. `/design:smoke` + agent-browser scenario pack (ladder walk, layers fixture, convert zero-visual-delta).
4. `/desktop-e2e` — native posture scenarios green.
5. a11y-auditor on layers panel changes (tree roles, keyboard reach); design-system-guard on new chrome.

## Acceptance Criteria

- [ ] Boot posture = browse verified (existing canvases behave byte-identically; native surfaces unaffected)
- [ ] V-select delivers the full Figma ladder (plain=top, Cmd=deep, dbl=drill, Enter/Shift+Enter/Tab/Esc)
- [ ] Posture invariants enforced by tests, not comments; desktop e2e migrated + green
- [ ] Layers: unstamped wrappers visible, purple instances, lock, reveal, rename — full rebuild explicitly deferred
- [ ] Convert-to-absolute: zero visual delta on conversion, undo byte-exact, non-goal comments updated, own DDR recorded
- [ ] Both DDRs recorded; What's New authored; `/flow:validate` clean
