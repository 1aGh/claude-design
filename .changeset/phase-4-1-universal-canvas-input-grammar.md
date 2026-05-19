---
"@1agh/md-claude": minor
---

**Design plugin — Phase 4.1: universal canvas input grammar (DDR-026).**

Every TSX canvas now ships with the same infinite-canvas affordances out of the box — no opt-in flag, no two-grammar split. Replaces the Phase-4 Cmd-only inspector overlay selection path.

- **Three canvas tools.** `V` Move (default), `H` Hand, `C` Comment — bottom-left floating ToolPalette + letter-key shortcuts. Scoped to canvas-iframe focus (don't collide with shell shortcuts).
- **Selection grammar.** `Cmd + hover` previews the deepest element under cursor. `Cmd + click` selects (replace). `Cmd + Shift + click` adds to a multi-selection (dashed group bounding box renders around the union). Bare hover / click pass through — native interactions (button presses, link clicks, input focus) still work in Move tool. Selection halos render as `position: fixed` overlays in screen coords, so 2 px stays 2 px regardless of zoom level.
- **Hand tool.** Bare drag pans the world — no Space required. Cursor forced to `grab` across every descendant (overrides element-level `cursor: pointer` declarations on buttons / links).
- **Comment tool.** Hover paints a preview halo on the element under cursor. Click commits that element to the selection set AND opens the shell-side composer for it; the halo persists until Submit / Cancel / Esc. Native interactions on artboard children are fully suppressed via capture-phase `preventDefault + stopImmediatePropagation` — buttons / inputs don't activate while in comment mode.
- **Right-click context menu.** Element / artboard chrome / world contexts. Items include `Add comment`, `Copy CSS`, `Copy data-cd-id`, `Hide`, `Deselect`, `Fit just this artboard`, `Fit to view`, `Reset view`. Full keyboard navigation (Arrow Up/Down / Enter / Esc), shortcut hints right-aligned in monospace.
- **Active-artboard indicator.** Subtle 1 px tinted accent ring on the artboard closest to the viewport center — marks the `/design:edit` context anchor without competing with selection halos.
- **`_active.json#selected` schema widening.** Now accepts `SelectedElement | SelectedElement[] | null`. Writer collapses single-entry arrays to a bare object for back-compat with `/design:edit` and handoff tooling. Reader (`normalizeSelectedRead`) accepts all three shapes.
- **Inspector overlay slimmed to comment-pin renderer.** The legacy Cmd-hover / Cmd-click selection path (`.dgn-insp-hover` / `.dgn-insp-selected` cyan outline) is removed. Only `.dgn-pin*` styles + the `comments-set` / `comment-focus` message handlers remain. Comment pins still render on legacy `.html` mocks and on TSX canvases equally.
- **Shell `.sel-halo` wrap removed.** The pre-Phase-4 2 px accent border that wrapped the entire iframe is gone — element-level halos in canvas-shell are the only selection visual now.

**Decision evolution.** First draft of Phase 4.1 landed an opt-in `inputMode="figjam"` prop on `DesignCanvas`. After live smoke tests the decision flipped to universal grammar (visual-inconsistency feedback: cyan-with-label inspector overlay vs accent-no-label new router) + naming directive (`figjam` removed from public API). The full alternatives history lives in DDR-026.

**No new dependencies.** All new modules are sibling files under `plugins/design/dev-server/`. Tree-shake-on-handoff still works via `canvas-lib-inline.ts` AST walker — drops carry the canvas-shell code as inlined source.

`bun test` 185/185, 0 fail (133 baseline + 52 new tests across `input-router`, `use-tool-mode`, `use-selection-set`). `bunx tsc --noEmit` clean of new errors. Canvas-build smoke against Canvas Viewport / Docs Site / Smoke TSX all return 200 with consistent canvas-shell wiring.
