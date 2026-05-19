# canvas-input-grammar

**Persona:** Designer with infinite-canvas muscle memory opening any TSX canvas.
**Canvases under test:** `.design/ui/Canvas Viewport.tsx`, `.design/ui/Smoke TSX.tsx`, `.design/ui/Docs Site.tsx` (verifies the grammar is universal).
**Hypothesis:** Every TSX canvas mounts the same canvas-shell stack — same halo color (DS accent), same V/H/C tools, same Cmd-modified select grammar, same right-click menu. There's no `inputMode` prop and no opt-out; the legacy inspector overlay does not paint a separate hover/click affordance.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | degraded — pointer hover doesn't fire on touch; tool taps + C-tool drop still work |

## Preconditions

- Dev server running (`bun plugins/design/dev-server/server.ts --root . --port 4399`).
- Default tool is `move` on every canvas open.

## Steps

1. **Open Canvas Viewport.tsx.**
   - Capture full-page screenshot.
   - Assert `.dc-tool-palette` visible bottom-left with three buttons (Move, Hand, Comment).
   - Assert active button = Move; `[aria-pressed="true"]` set there.
   - Assert no orange / accent ring wraps `.dc-canvas` itself; only the active artboard carries a subtle 1 px accent tint (active-artboard indicator).
2. **Bare hover passes through; Cmd+hover paints.**
   - Move pointer over a button inside an artboard with no modifier.
   - Assert: no `.dc-cv-halo--hover` overlay rendered.
   - Hold Cmd. Assert the floating `.dc-cv-halo--hover` overlay appears wrapping the element under cursor (2 px DS accent border, screen-coord positioned).
3. **Cmd+click selects the deepest element (replace).**
   - Cmd+click on a span deep inside the same artboard.
   - Assert `.dc-cv-halo--selected` overlay appears around that span specifically (NOT the artboard root).
   - Assert `_active.json#selected` contains the span's `data-cd-id` (or its CSS path).
   - Move cursor away — halo persists on the selected span (selection ≠ hover).
4. **Cmd+Shift+click adds (multi-select).**
   - Cmd+Shift+click on a second element.
   - Assert two `.dc-cv-halo--selected` overlays render.
   - Assert `.dc-cv-group-bbox` (dashed) appears enclosing both elements' union bounds.
   - Assert `_active.json#selected` is an array of length 2.
5. **Bare click does NOT select.**
   - Click (no modifier) on a button inside an artboard.
   - Assert no new halo renders. The button's native behavior fires (if it had a click handler, that runs).
6. **Switch to Hand tool.**
   - Press H (focused inside canvas iframe).
   - Assert `.dc-tool-palette` Hand button becomes active; cursor becomes `grab` across every descendant (including buttons that declare their own `cursor: pointer`).
   - Drag inside the canvas with no Space held — assert the world pans.
7. **Switch to Comment tool.**
   - Press C.
   - Assert active = Comment; cursor = `crosshair` across every descendant.
   - Hover over an element. Assert `.dc-cv-halo--hover` paints (no Cmd needed in comment mode).
   - Click on the element. Assert the shell-side comment composer opens for that target AND the halo persists as `.dc-cv-halo--selected` on the clicked element.
   - Click Cancel on the composer. Assert the halo clears (composer posts `force-clear`).
8. **Right-click context menu.**
   - Press V to return to Move.
   - Right-click on a button. Assert `.dc-context-menu` shows with items: `Add comment` · `Copy CSS` · `Copy data-cd-id` · `Inspect` (disabled) · `Hide` · `Deselect`.
   - Click `Copy CSS`. Assert clipboard receives the CSS path.
9. **Esc clears.**
   - Press Esc inside canvas. Assert all halos clear; menu (if open) closes; `_active.json#selected` is `null`.
10. **Universal: repeat steps 2–5 on `Docs Site.tsx`.**
    - Same DS accent halo color (NOT cyan).
    - Same tool palette + grammar.
    - No `[outline: 2px solid #00D4E4]` from the legacy inspector overlay.
11. **Universal: repeat step 2 (Cmd+hover) on `Smoke TSX.tsx`.**
    - Same behavior. Single-artboard canvas works identically.

## Success criteria

- 0 console errors throughout.
- Same halo color (DS `--accent`) on every canvas — no cyan, no two-grammar split.
- Active-artboard indicator stays subtle (1 px tinted) and doesn't compete with selection halos.
- `inputMode` prop nowhere in `.design/ui/*.tsx` — `grep -r 'inputMode' .design/` returns zero.
- `dgn-insp-hover` / `dgn-insp-selected` classes never appear in any iframe (inspector overlay no longer paints).

## Counter deltas

- `_active.json#selected.ts` mutates on every Cmd-click. Single-element shape for cardinality 1; array for ≥ 2; null for empty.

## Known limitations

- web-mobile: pointer hover paths don't fire on touch. Comment-tool drop + button taps for V/H/C still work; halo previews are degraded.
- iOS/Android native scenarios: not applicable (canvas runs in browser only).
