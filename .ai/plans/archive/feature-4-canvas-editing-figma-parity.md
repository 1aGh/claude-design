---
name: feature-4-canvas-editing-figma-parity
status: executed
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

**Follow-up session 2026-07-19 — the deferred remainder COMPLETED (3rd commit):**
- **T7 remainder ✅** — (b) **purple component instances**: new pure `componentMapForCanvas` (canvas-edit.ts; "instance" = the enclosing component is instantiated as JSX in this file — correctly excludes the canvas root component) + read-only `componentMapOp` + GET `/_api/component-map` (edit-scope posture) + shell fetch (throttled on tree changes) + LayerRow ◆/◇ purple rows showing the component name. (c) **locked state**: a third per-user view.json lane `locked: ["<cdId>:<idx>"]` (normalize/save/load/PATCH with REPLACE semantics + `null` clear, bounded shape) + LayerRow padlock + canvas-side enforcement (`lockedKeySet` window-level + `__canvas_meta__.locked` boot seed + `dgn:'locked-set'` live push; `onSelect` + ReorderDrag refuse locked elements; the Layers row stays reachable to unlock). (d) **inline rename**: dblclick a row label → input (select-all on focus, Enter/blur commit, Esc cancel) → sanitized kebab written to `data-dc-element` via the existing `/_api/edit-attr` + undo lane; serializer now ships the raw `dcElement` as the before-value. Live-dogfood correction folded in: engine chrome wrappers (`dc-*`/`dgn-*`) hoist instead of emitting a phantom "dc-artboard-body GROUP" root row.
- **T8b "affects N instances" confirm ✅** — repeated-id children now confirm (`window.confirm`, client-computed count) → `allowShared: true` + per-child `idIndex`; server routes each instance child's write to its own `<Component/>` usage (Stage-H3 model), `.map` children still refuse (same-target detection). 2 new unit cases. See DDR-188 addendum.
- **Live verification ✅ (agent-browser against a source dev-server):** browse boot → REAL click fires (count 0→1, no selection, palette shows Browse pressed); V → bare click claimed (count frozen) + selects the TOP-level object (halo 520px = container, not the 98px button); Esc deselects; layers tree shows lock buttons, CARD-labeled purple instance rows, auto-reveal, and no phantom body group; lock persists to view.json (`locked:["<id>:0"]`), `PATCH locked:null` clears, and a click on a locked element selects nothing; rename round-trips input → `data-dc-element` in source → HMR → new tree label; convert-to-absolute: context-menu entry container-gated, captured request payload carries exact frozen boxes (0/88 = 80px + 8 gap), POST → one-pass rewrite + one undo seq, and the children's on-screen rects are **byte-identical before vs after** (the zero-visual-delta gate). The first-run What's New toast for `figma-smart-select` rendered live. **`/design:smoke`: all 69 canvases rendered styled, exit 0, import-graph clean**; 5 representative PNGs read (light/dark/whiteboard/video-heavy + DS showcase) — palette renders Browse+Select in every UI canvas, specimens correctly chrome-free.

**T6 (desktop e2e) — audited + fixed (live run = owner close-out):** swept every `apps/desktop/e2e/scenarios/*.e2e.ts` — only `canvas-text-editing.e2e.ts` touches canvas CONTENT; fixed to press **V** after boot. Every other scenario clicks the sidebar — unaffected. The live `/desktop-e2e` run needs a `cargo` desktop build + WKWebView (native-app-verification-ceiling).

**Verified (final):** `bun tsc --noEmit` 8 baseline errors, 0 new. Full `bun test` (apps/studio) **3068 pass / 5 skip / 0 fail**. `biome check` 0 errors on every touched file. Client bundle rebuilt release-minified after the live-dogfood round.

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

- [x] Boot posture = browse verified (existing canvases behave byte-identically; native surfaces unaffected) — live agent-browser proof + smoke 69/69
- [x] V-select delivers the full Figma ladder (plain=top, Cmd=deep, dbl=drill, Enter/Shift+Enter/Tab/Esc) — plain/dbl/Esc live-verified; Cmd=deep covered by classifier + DOM tests (modifier-click not automatable)
- [x] Posture invariants enforced by tests, not comments; desktop e2e migrated (**green run = owner close-out — needs a cargo desktop build**)
- [x] Layers: unstamped wrappers visible, purple instances, lock, reveal, rename — full component-depth tree rebuild explicitly deferred (as planned)
- [x] Convert-to-absolute: zero visual delta on conversion (live-verified byte-identical rects), undo via one whole-file seq (lane-verified; byte-exactness inherited from DDR-138's content-swap), non-goal comments updated, DDR-188 recorded
- [x] Both DDRs recorded; What's New authored; validation run (full suite + biome + tsc + smoke; site build & a11y fan-out = pre-release close-out)

## Retro

**What went well:** The minimal-diff decomposition held perfectly — `browse` carried zero select machinery, so every `tool === 'move'` gate (marquees, reorder, resize/spacing/grid handles) was inert in browse *by construction*, with no rewires and no regressions in a 3068-test suite. The plan's "promote the comment-invariant to a test" instinct paid off immediately (the DOM-level `browse-posture.test.tsx` is the load-bearing gate). Live dogfooding via a source dev-server + agent-browser proved the entire posture contract with REAL browser input (boot-alive click → V-select → top-level halo), and caught one real bug unit tests couldn't: the phantom "dc-artboard-body GROUP" root row (engine chrome must hoist, not group). The zero-visual-delta gate for convert was verifiable live to the pixel (`before === after` rects).

**What was hard / learned:** (1) The tool-cursor system fought the split — browse must NOT force a global `!important` cursor or the mock's affordance cursors die; special-casing it in BOTH the iframe and the shell was easy to miss. (2) `editStyleProp` re-reads the ORIGINAL AST per call, so a naive N× loop duplicates `style` attrs on fresh elements — `setMultipleStyleProps` (single combined insert) was mandatory, and the "exactly one `style={{`" assertion guards it. (3) Driving the cross-origin canvas iframe: modifier-clicks and right-clicks aren't agent-browser gestures; the workaround (open the canvas document directly + capture the `postMessage` payload on `window` since `parent === window`) verified everything except the shell hop — which the DDR-054 CSRF gate correctly refuses to fake, a good sign. (4) Session-spanning execution (core → convert → remainder) with per-slice commits kept the shared-`main` tree safe alongside a concurrent session.

**Follow-ups (owner):** live `/desktop-e2e` green run (needs cargo build); a11y-auditor pass over the new Layers chrome (lock/rename controls) before the next release cut; `pnpm --filter @maude/site build` in the release pre-flight.

## Retro addendum — dogfood rounds 2–6 (2026-07-19/20) + `/flow:done` close-out

The user's own hands-on testing across five follow-up rounds surfaced real defects the plan's live-verification pass (thorough as it was) hadn't hit, plus three explicitly-requested new capabilities. All landed with root-cause fixes, not patches:

**Round 2 (selection posture):** multiselect/drill snapping back to a stale selection (the WS `'selected'` broadcast is ALSO the shell's own echo of its local select, landing hundreds of ms later and overwriting fresher state — fixed with a suppression window keyed on the last local-select timestamp); the camera yanking back to the selection mid-pan (the halo-restore ladder's idempotent re-posts were triggering a reveal on every retry, not just on a real change); Browse Cmd+click added as an escape hatch (reverses this plan's original "no escape hatch" call — direct user steer: "shouldn't require pressing V first"); Layers panel requiring a selection to populate; the dblclick drill ladder unable to descend (two compounding bugs: the dblclick's own synthetic pointerdown re-selected top-level before the drill ran, and leaf-text dblclicks skipped straight to the editor instead of drilling first).

**Round 2 also shipped:** convert-to-absolute's sandbox-safe confirm dialog (`window.confirm` is silently a no-op in the untrusted canvas iframe's sandbox — no `allow-modals` — which is why an early "affects N instances" confirm appeared to do nothing) and Detach Component (clone-the-definition strategy, behavior-preserving for any component).

**Round 3:** hand-AUTHORED `data-cd-id` attributes (vs. pipeline-injected positional hashes) were invisible to the entire edit engine — every AST walker matched only computed ids, and the id-shape regex was 8-hex-only. This wasn't a convert-specific bug; it silently broke ANY edit operation on an authored-id element. Also: component instances broke visually on convert (writing `style` on a `<Component/>` usage assumes prop-forwarding, which most components don't do) — fixed by wrapping the usage in a positioned div instead. Shipped TRUE FLATTEN per explicit request ("zploštit tree") — dissolving invisible layout wrappers rather than just freezing them in place.

**Round 4:** the element-level convert action re-prompted a confirm dialog PER NESTED CONTAINER (up to ~10 in a real layout) — unified into one recursive subtree walk with exactly one confirm, "the rest on the pozadí" (background) per direct request. Found + fixed a companion bug live: the subtree root's auto-height collapsed once its children went absolute (needed its own frozen box size).

**Round 5:** the Photo tab disappeared for a photo selection — a second-order effect of Round 2's OWN posture fix (bare click now selects the top-level container, not the leaf `<img>`) that nothing in the original plan's acceptance criteria could have caught, because the regression didn't exist until the posture model changed. Fixed with a single-descendant-image fallback. Also: the Inspector's kind-switch freeze offer silently never fired — `window.confirm` is ALSO a no-op in the Tauri desktop WKWebView shell (a second, independent instance of the same JS-dialog gap Round 2 found in the canvas sandbox), so every "web → print" switch resized the artboard with zero user-visible confirmation.

**Round 6:** confirming "Switch + freeze" reopened the SAME dialog forever — the canvas's kind-request round-trip fed back into the same ask-flow function that spawned it, so every confirm click armed the next one. Fixed with a direct, non-reentrant write path; the print-size seed was also sequenced to land strictly after any freeze-convert, since it had been resizing the artboard while the (now-closing) dialog was still open.

**Pattern across all six rounds:** every bug was a genuine interaction the plan's live-verification pass legitimately couldn't have caught headless (WS echo timing, iframe-sandbox JS-dialog silence, a second-order regression from an EARLIER fix in the SAME session, a desktop-shell-specific dialog gap). This is the strongest argument yet for "ship the interaction model, then dogfood it live before calling a plan closed" — no amount of synthetic agent-browser scripting reaches the class of bug a real human clicking through the actual gesture surfaces.

**`/flow:done` full gate (this pass, 2026-07-21):** re-ran the complete validation pipeline over the full feature-4 commit range (`396a0cb1..8ab7eb1b`, 9 commits) since none of the 6 dogfood-round commits had gone through a formal `/done` gate — `pnpm lint`/`format`/tests (CLI 195/195, dev-server suite green in isolation — one 3-test flake under full-parallel load, confirmed non-reproducing) / `pnpm --filter @maude/site build` / version-parity / tarball-shape / tokens-sync all green; `/design:smoke` 69/69 canvases styled. A concurrent session's uncommitted WIP (canvas-edit.ts TS-cast unwrapping, print tests) was stashed for the duration and restored untouched afterward — never touched or committed.

**Review fan-out (security-auditor + ethical-hacker + a11y-auditor + design-system-guard + code-simplifier, parallel, over `396a0cb1..8ab7eb1b`):** 0 CRITICAL findings — verdict PASS WITH SUGGESTIONS, all applied before commit.
- **design-system-guard:** clean — new Layers/dialog CSS correctly reuses the existing token vocabulary (and correctly picked the canvas-side `--maude-hud-*`/`--maude-chrome-*` family for `canvasConfirm`, vs. the shell-side `--bg-*`/`--fg-*` family, since it mounts inside the canvas iframe); the new `--layer-instance` purple token follows this file's own established "undefined-token + hex fallback" convention for one-off semantic colors.
- **a11y-auditor — 2 real gaps, fixed:** (1) layer rename had NO keyboard entry point at all (dblclick-only — WCAG 2.1.1) — added F2 as the conventional rename key, mirroring the dblclick handler's own pre-fill; (2) the new `canvasConfirm()` raw-DOM dialog had no focus trap (Tab could escape to live canvas content behind the backdrop) and never restored focus on close — added a 2-element Tab trap + activeElement capture/restore. A third finding (Text-tool hover affordance is mouse-only) was confirmed PRE-EXISTING (Phase 4 unified-text-editing, untouched by this session) — noted, not fixed here.
- **security-auditor — 2 low-severity, 1 fixed:** `/_api/component-map` (new, auto-fetched by the shell on every canvas/artboard switch with zero user action) had no `MAX_CANVAS_SOURCE` cap before parsing, unlike its sibling structural-write ops — per this repo's own hub-push threat model (DDR-060) a peer could cost a collaborator CPU/memory just by them opening a synced canvas; added the same cap the other ops use. The second (detach's `after.length` uncapped) is informationally bounded by the pre-check on `before` and wasn't independently exploitable — left as-is. Confirmed clean: the `CD_ID_RE`/`LOCKED_KEY_RE` widening (8-hex → `[\w-]{1,64}`, done in round 3) lands nowhere unescaped — every dynamic `querySelector` construction already runs ids through `CSS.escape()`, and every value spliced into generated JSX is numeric + bounds-checked.
- **ethical-hacker — independent attacker-mode re-check:** confirmed all three new routes stay outside both `CANVAS_SAFE_API` and `startCanvasServer`'s allowlist (the untrusted iframe cannot reach them directly); confirmed a duplicate `dissolve` id can't double-free/crash (`MagicString.remove()` on an already-removed range is a silent no-op); found no exploitable path through the component-instance WRAP mechanism or the widened id regex. **CRITICAL, fixed:** the new `freeze-and-set-kind` canvas-side handler (added this feature, `canvas-shell.tsx`) was missing the `e.source === window.parent` origin guard that IS already the established convention on its siblings in the same file (`apply-style`, `record-edit`, etc.). Every open canvas tab shares one `canvasOrigin`, so per WHATWG cross-origin window-proxy semantics any sibling iframe can already reach any other frame's `window` and `postMessage` into it — a hostile/synced canvas could forge this message directly into another open canvas's iframe and drive it into `__maudeConvertArtboard` (an irreversible tree-flatten) followed by a forged `set-artboard-kind-request`, bypassing the shell's own `e.source === activeWin` check entirely (that check validates the wrong hop — it can't see that the *command* which made the active iframe emit the request was itself forged one hop earlier, inside that iframe's own handler). Fixed by adding the same guard used at the other four sites in this file. Scoping note: the same 4 `window.addEventListener('message', ...)` registrations in this file host other branches (`undo`/`redo`/`select-by-id`/etc.) that predate this feature and were not part of its diff; a broader retrofit of the guard across every `dgn` branch is flagged as follow-up work, not done in this pass, to avoid a blind change to unrelated code under time pressure. **MEDIUM, fixed:** `canvasConfirm()` (the sandbox-safe confirm dialog, itself new this feature) had no `event.isTrusted` check on its button clicks/keydown — a same-document hostile script could synthesize click/keyboard events to auto-confirm past the irreversible-convert prompt without real user action. Fixed by gating all three listeners on `isTrusted`.
- **code-simplifier — 2 concrete, applied:** `photoAssetOfSelection`'s two identical asset-regex literals (one flagged, one not) were collapsed to derive the global variant from the single source pattern, closing a drift risk; `api.ts`'s local `ChildBox`/inline `containersSpec` types were replaced with the canonical `ConvertChildBox`/`ConvertContainerSpec` exported from canvas-edit.ts, closing a real (if currently harmless) type-completeness gap — the local type was missing `freezeSize?`, silently masked by object-spread bypassing excess-property checking.

Re-verified after applying all 7 fixes (5 initial + the CRITICAL/MEDIUM security pair): tsc 8 baseline/0 new, focused suite (edit-scope/convert/detach/canvas-meta/component-map) 58/58, biome clean (one pre-existing unrelated warning at canvas-shell.tsx:3189, outside this diff), client bundle rebuilt release-minified.
