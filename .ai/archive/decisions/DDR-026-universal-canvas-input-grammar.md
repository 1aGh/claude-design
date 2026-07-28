# DDR-026: universal canvas input grammar — one grammar everywhere, inspector overlay deprecated for selection

- **Date:** 2026-05-19 (drafted)
- **Revised:** 2026-05-19 (decision flipped from opt-in `inputMode` to universal default)
- **Status:** Accepted
- **Tags:** design, canvas-lib, dev-server, input-grammar, inspector-overlay, phase-4.1
- **Related:** [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [DDR-024](./DDR-024-phase-4-canvas-engine-driver-choice.md), [DDR-022](./DDR-022-canvas-lib-virtual-module-and-inline-on-handoff.md), [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md), [`.ai/plans/phase-4.1-figjam-canvas-interactions.md`](../plans/phase-4.1-figjam-canvas-interactions.md)

## Context

Phase 4 shipped `useViewportController` (pan / zoom / fit / wheel routing) plus the inspector overlay (`inspect.ts` `INSPECTOR_SCRIPT`) for Cmd-hover / Cmd-click selection. Hotfix passes refined wheel routing to FigJam parity (bare = pan Y, Shift = pan X, Cmd = zoom). What remained bespoke after Phase 4:

1. **Cmd-gated selection** — hovering with no modifier did nothing.
2. **No multi-select** — inspector overlay only ever held a single element.
3. **No tool modes** — comment drop was a chord rather than a tool-state.
4. **No right-click affordances** — no Copy CSS / Fit / Reset / Inspect entry.
5. **Two inconsistent visual languages** — TSX canvases that opted into the new router (the original Phase 4.1 prop-based design) painted with the DS accent; canvases that stayed on the inspector overlay painted with a hard-coded cyan (`#00D4E4`). Same project, two halo colors, two affordance grammars.

The original Phase 4.1 plan landed an opt-in `inputMode` prop on `DesignCanvas` (`"default" | "figjam"`). The two modes were supposed to coexist behind a sentinel + inspector early-return. In practice the coexistence created more confusion than it saved:

- Visual inconsistency (orange vs cyan) was the first user-visible complaint.
- The inspector's `Cmd+click + Shift = comment compose` chord and the new C-tool both lived; the help overlay grew two grammar tables.
- The `inputMode` prop migrated through every canvas as authors caught up; the "default" branch effectively had zero use cases beyond legacy `.html` mocks.
- Naming: the "figjam" identifier on a public prop locked us to a third-party product name on every canvas opening.

## Decision

**There is one canvas input grammar. Every TSX canvas mounted via `DesignCanvas` gets the canvas-shell stack (`CanvasShell` → `SelectionSetProvider` → `ContextMenuProvider` → `CanvasRouter`) automatically. The legacy inspector overlay's hover/click selection path is removed — only its comment-pin rendering survives, because that's still useful for legacy `.html` mocks and as a marker layer.**

Concretely:

1. **`DesignCanvas` has no `inputMode` prop.** The wrapper unconditionally mounts `<ToolProvider>` → `<DesignCanvasInner>` → `<CanvasShell>`. Authors don't opt in; the grammar is the default.
2. **All `figjam-*` naming is replaced.**
   - `figjam-shell.tsx` → `canvas-shell.tsx`
   - `FigJamShell` / `FigJamCore` / `FigJamRouter` → `CanvasShell` / `CanvasCore` / `CanvasRouter`
   - `.dc-fjm-*` CSS classes → `.dc-cv-*` (`cv` = canvas-viewport; avoids clashing with `.dc-canvas` the host)
   - `window.__MDCC_INPUT_MODE__` sentinel deleted entirely — no mode to gate on.
3. **Inspector overlay shrinks to pin-renderer.** `inspect.ts INSPECTOR_SCRIPT` keeps only:
   - `.dgn-pin` style + position-tracking on every animation frame
   - `dgn: 'comments-set'` / `'comment-focus'` postMessage handlers
   - `dgn: 'loaded'` on attach
   No more `.dgn-insp-hover` / `.dgn-insp-selected` painting; no Cmd-hover/click handler; no `comment-shortcut` chord; no `force-clear` consumer.
4. **Shell-side `.sel-halo` overlay deleted.** The 2 px accent wrapping the entire iframe — a pre-Phase-4 shim that became visual noise once element-level halos shipped — is gone. `<SelectionHalo />` component and its CSS reference removed.
5. **Active-artboard indicator stays, but subtle.** Canvas-shell's `HALO_CSS` reduces the Phase-4 accent ring on `[aria-current="true"]` from `0 0 0 2px var(--accent)` to `0 0 0 1px color-mix(in oklab, var(--accent) 40%, transparent)`. This is the visual cue for "the artboard `/design:edit` will scope to" — light enough that selection halos read as the loud signal, present enough that the user knows which artboard is in focus.
6. **Grammar (final):**
   - **Move (V)** — bare hover/click passes through (native interactions work); Cmd+hover paints deepest preview; Cmd+click selects (replace); Cmd+Shift+click adds; right-click → menu.
   - **Hand (H)** — bare drag pans (no Space required); no selection.
   - **Comment (C)** — hover paints; click commits target to selSet + opens shell composer; native interactions on artboard children suppressed by capture-phase router; cursor forced to crosshair via `.dc-canvas[data-active-tool="comment"] *  !important`.
   - **Esc** clears selection + closes menu (canvas-side).
   - **Composer Submit / Cancel / Esc** → shell posts `dgn: 'force-clear'` → canvas-shell listener calls `selSet.clear()`.
7. **Halos render as `position: fixed` overlays** (`.dc-cv-halo--hover` / `.dc-cv-halo--selected` / `.dc-cv-group-bbox`) reading `getBoundingClientRect()` on every rAF tick. Per-element CSS class stamping is NOT used — CSS `zoom` on the world plane would otherwise scale a 2 px outline to subpixel at low zoom.
8. **`_active.json#selected` schema widening stays.** `SelectedElement | SelectedElement[] | null`; writer collapses single-entry arrays to a bare object for back-compat with `/design:edit`.

## Consequences

**Positive.**

- One consistent input grammar across every TSX canvas — including DS specimens, UI mocks, and Phase 5 (draw tools) inheriting the tool framework.
- One visual language for halos (DS accent everywhere) — no cyan-vs-accent split.
- No mode flag for authors to remember; no help overlay branching ("for this kind of canvas use X, for that kind use Y").
- Halos render at consistent thickness regardless of zoom — 42 % zoom no longer makes the outline invisible.
- Comment-pin rendering survives in the slimmed-down inspector overlay, so legacy `.html` mocks (if any remain) still surface comments.

**Negative / accepted trade-offs.**

- The shell still listens for both `dgn: 'select'` (legacy single-element) and `dgn: 'select-set'` (canvas-shell). The first listener path is now dead for TSX canvases — left in place only as a safety net for any external embed that posts the old shape. Can be removed in a follow-up DDR once we audit external users.
- `dgn: 'comment-shortcut'` listener in app.jsx kept as carry-over for any legacy mock that still posts it. Same audit applies.

## Alternatives considered

1. **Keep opt-in `inputMode` prop.** Original Phase 4.1 plan. Rejected after one round of user feedback — visual inconsistency was the dealbreaker, and the "default" path had no use cases beyond not-yet-migrated canvases.

2. **Replace inspector overlay entirely (including pin rendering).** Push the pin layer into canvas-shell too. Considered, deferred — pin rendering is currently independent of the React mount lifecycle (works on legacy `.html` and on TSX equally, can attach before React boots). Coupling it to canvas-shell would need careful staging.

3. **Rename to "figma-style" or "infinite-canvas-grammar".** Both still smell of third-party product naming. "Canvas" is generic and accurate.

## Implementation notes

- `useInputRouter` attaches listeners in capture phase + paired mousedown / click listeners so native interactions (button presses, input focus) are fully suppressed when the router claims an event.
- `resolveHoverTarget(deep=true)` returns the hit element's OWN `data-cd-id` only — no climbing to ancestors. When the hit lacks a stamped id, callers fall back to a CSS-path selector.
- Hover/select overlays are `position: fixed` siblings of `.dc-canvas`. They read element bounds via `getBoundingClientRect()` on every animation frame, so they follow pan/zoom without being scaled by CSS `zoom`.
- Hand-mode bare-drag pan is wired via a new `isPanDragActive: () => boolean` option on `useViewportController`. The predicate reads the live tool state (set by `ToolProvider` which now lives above `DesignCanvasInner`).
- Comment-mode cursor force: `.dc-canvas[data-active-tool="comment"] *  { cursor: crosshair !important }` — overrides element-level `cursor: pointer` on buttons/links.

## Acceptance check

- `bun test`: 185 / 185, 0 fail (133 baseline + 52 new).
- `bunx tsc --noEmit`: only pre-existing `api.ts:592–593` errors; no new errors.
- Every TSX canvas — Canvas Viewport, Smoke TSX, Docs Site, perf-100-artboards, every DS specimen — uses the same grammar without any author-side prop.
- `grep -r 'figjam\|FigJam\|inputMode' plugins/design/dev-server/` returns no live references.
- Inspector overlay's `dgn-insp-*` CSS removed; only `.dgn-pin*` rules remain.
- Shell-side `<SelectionHalo />` + `.sel-halo` removed from the React render tree (CSS file kept for any external consumer; no JS references remain).
