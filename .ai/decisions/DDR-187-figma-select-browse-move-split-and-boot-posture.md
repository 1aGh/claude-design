# DDR-187: Figma smart-select — browse/move tool split, boot=alive, and the promoted pass-through invariant

**Status:** Accepted
**Date:** 2026-07-18
**Tags:** input-router, tool-mode, canvas, selection, figma-parity, ux, posture

## Context

The canvas's `move` tool was overloaded. Its bare left-click was a **pure native pass-through** (so a mock's buttons/links/inputs stayed alive) and selection fired **only** on Cmd/Ctrl+click, always resolving to the *deepest* element. Two problems:

1. The Figma muscle-memory gesture — a *plain* click selects the object under the cursor — did nothing. The user's words: Cmd+click *"už mi přijde zbytečný"* (now feels pointless).
2. The pass-through-vs-select contract was enforced only by a code comment (`input-router.tsx`), not a test — a silent-regression risk for every native-input surface (photo editor, video timeline, whiteboard, live prototype buttons).

The design fork that needed a human call: **what is the boot posture?** Boot into a Figma-literal *select* tool (plain click selects; you'd need a separate "Interact/Preview" mode + a peek gesture to click a live button), or keep the canvas **alive** by default and arrive at select only when the user asks for it?

## Alternatives considered

**Where does selection live (tool vs. artboard-kind)?**
- **Key selection behavior off the artboard `kind`** (e.g. `web` artboards select-first, others alive) — rejected in the `/flow:plan` debate: kinds coexist on one canvas, so this creates an invisible positional mode and a hot-path kind lookup on every click. Selection must be **TOOL-based**, never kind-keyed.

**Boot posture (the surfaced fork, user-decided 2026-07-15):**
- **A. Boot into `select` (Figma-literal).** Plain click selects from the first frame. Pros: the Figma gesture works instantly with no tool switch. Cons: **regresses every native-input surface** — a freshly opened mock is dead (buttons don't click) until the user finds an "Interact" mode; needs net-new Interact-mode + quick-peek + first-run machinery to undo that regression. All three debate seats rated this the higher-risk path.
- **B. Boot into `browse` (alive), press V for select.** Picked, unanimously (3/3 seats) and confirmed by the user. Zero regression for existing canvases and every native-input surface — they behave byte-identically to today's boot. Figma muscle memory arrives the instant **V** is pressed. Residual discoverability risk (a user may not know to press V) is mitigated with a visible palette affordance + a one-time "press V to select & edit" first-run hint + a What's New entry — cheap, reversible additions, not a structural mode.

**Decomposition — how to split without churning the gate wiring:**
- **Rewire every `tool === 'move'` gate to a new predicate** — rejected: the marquee overlays, in-canvas drag-to-reorder, resize/spacing/grid-track handles, and artboard-drag are ALL gated on `tool === 'move'`; touching them is the blast radius.
- **Additive split: `browse` is a NEW tool carrying ZERO select machinery; `move` KEEPS every existing gate untouched and only its bare-click branch flips** — picked. `browse` returns `no-op` for every pointer event (the router never claims → native events flow), so all the move-gated machinery is inert in `browse` *by construction*, with no rewires. The entire behavioral change is contained to `classify()` + the tool registry + the boot default.

## Decision

1. **New `browse` tool = the boot default.** Pure native pass-through: `classify()` returns `no-op` for every browse pointer event, so the router claims nothing and the mock stays alive (buttons click, links follow, inputs focus). No hover halo, no select — not even a Cmd escape-hatch (unlike the draw tools). The cursor is the system `default` over chrome and native element cursors over the mock (the `* { cursor: … !important }` forcing is special-cased off for browse, both in-iframe and in the shell). `ToolProvider` `initial='browse'`.
2. **`move` becomes the SELECT tool (V), with the full Figma ladder:** bare click = TOP-level object (`deep:false`, replace), Shift = add-top, Cmd/Ctrl = DEEPEST element (`deep:true`, replace), Cmd+Shift = add-deep. Bare hover paints a top-level preview halo. All left clicks in `move` are claimed (native suppressed) — selecting a button doesn't press it. The existing double-click drill-in (Task L6) and Enter/Shift+Enter/Tab keyboard ladder (Task L2) already matched Figma; both are hardened to be inert in `browse` (the mock owns its own dblclicks + keyboard in alive mode). Esc = deselect only (unchanged, router-owned).
3. **No gate rewires.** Every `tool === 'move'` gate (marquee overlays, ReorderDrag, resize/spacing/grid-track/artboard-drag hooks) is untouched and inert in `browse`.
4. **The pass-through invariant is promoted from comment to test.** `browse-posture.test.tsx` (happy-dom + a real `createRoot`) proves a bare click in `browse` fires the native handler and dispatches no select, while `move` claims it and suppresses the native handler; `input-router.test.ts` adds a "browse pure pass-through" table + a "select never leaks into a non-select tool" guard. This is the canvas-origin-gate equivalent for the input posture — the load-bearing regression fence.
5. **No spacebar peek.** Space stays pan. A dedicated peek key was left unbound (the boot=alive posture makes a peek-from-select gesture non-essential); if it's ever needed, pick a non-colliding key with an explicit audit (snap-Alt, measure-Alt-hover, Cmd-suppress-snap).

## Consequences

- Existing canvases behave identically on boot (still alive). The only observable change is the boot tool label and that **V** now yields the Figma select gesture instead of Cmd-only-deep.
- The `RouterAction.select.deep` field's meaning widened: it is now driven by the modifier (`deep = metaOrCtrl`) rather than being hardwired `true`. The shell's `onSelect` already honored `deep`.
- Layers-panel keyboard traversal + inline text-edit are now scoped OUT of `browse` — a lingering selection carried into the alive mode no longer hijacks Enter/Delete/dblclick from the mock.
- Discoverability rests on a first-run hint (localStorage `maude-browse-hint-seen`) + the palette; if telemetry ever shows users stuck in browse, a louder affordance is the follow-up, not a posture change.

## Scope note

The plan (`feature-4-canvas-editing-figma-parity.md`) paired this selection model with an incremental Figma-grade **layers** upgrade and a **convert-to-absolute** context action (its own DDR-188). The first session shipped the selection model in full plus the layers panel's synthetic-group-rows fix + auto-reveal; a follow-up session (2026-07-19) completed the remainder — **component-instance rows** (purple ◆/◇ from a new read-only `/_api/component-map` parse; the "instance" signal is *the enclosing component is instantiated as JSX in this file*, which correctly excludes the top-level canvas component), **locked layers** (a third per-user view.json lane `locked: ["<cdId>:<idx>"]` beside viewport/overlays — REPLACE semantics so unlock works; canvas-side enforcement refuses select/drag on a locked element while the Layers row stays reachable to unlock), and **inline rename** (dblclick a row label → writes `data-dc-element` through the existing `/_api/edit-attr` + undo lane; `layerLabel` already read it as top priority). One live-dogfood correction: engine chrome wrappers (`dc-*`/`dgn-*`) are hoisted, not emitted as synthetic groups — without this every artboard grew a phantom "dc-artboard-body GROUP" root row.

The full posture + layers + convert contract was **verified live** (agent-browser against a source dev-server, 2026-07-19): browse boot → real button click fires; V → bare click claims + selects the top-level object; Esc deselects; lock persists + enforces on canvas; rename round-trips source→HMR→tree; convert produces a zero-visual-delta rewrite; `/design:smoke` 69/69 canvases styled.
