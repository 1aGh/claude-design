# canvas-context-menu

**Persona:** Designer right-clicking inside a FigJam-mode canvas to copy CSS, fit one artboard, paste an artboard, etc.
**Canvas under test:** `.design/ui/Canvas Viewport.tsx`.
**Hypothesis:** Right-click anywhere in the canvas surfaces a context menu whose items depend on the target type (element / artboard-chrome / world), keyboard shortcuts render right-aligned, native browser menu is suppressed, and Esc / outside-click / scroll dismisses.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | degraded — long-press maps to contextmenu on some Android browsers; not iOS. Skip mobile assertions for the menu position; only verify "menu does not break the page". |

## Preconditions

- Dev server running.
- `Canvas Viewport.tsx` open + at least one artboard visible.

## Steps

1. **Right-click on an element (CV-03 heading).**
   - Right-click on the `<h3>` inside the DRAW MODE artboard.
   - Assert no native browser menu shown (`contextmenu` `defaultPrevented`).
   - Assert `.dc-context-menu` appears positioned at or near the cursor.
   - Menu items visible: `Add comment` · `Copy CSS` · `Copy data-cd-id` · `Inspect` (disabled) · `Hide` · `Deselect`.
   - Right-aligned shortcut hints render in monospace (`C`, `⌘⇧C`, `⌘⇧H`, `Esc`).
   - Capture screenshot (`/_menu-element.png`).
   - Click `Add comment`. (issue-90) Assert the in-place composer actually
     opens, anchored near the clicked heading — before the fix, this item
     posted a message to the parent shell but never dispatched the event the
     composer overlay listens on, so nothing visibly happened.
2. **Copy data-cd-id works.**
   - Click `Copy data-cd-id`.
   - Assert clipboard contains the element's `data-cd-id` value.
   - Menu dismisses after click.
3. **Right-click on artboard chrome.**
   - Right-click on the artboard label strip (`.dc-artboard-label`) of CV-05.
   - Assert menu items: `Add comment` · `Fit just this artboard` · `Fit to view` · `Reset view`.
   - (issue-90) `Add comment` anchors a FLOATING pin at the click point (the
     label strip carries no `data-cd-id`) — assert the composer opens instead
     of silently doing nothing.
4. **Right-click on empty world.**
   - Right-click on the blank area between artboards.
   - Assert menu items: `Add comment` · `Fit to view` · `Reset view`.
   - Click `Reset view`.
   - Assert viewport zoom reset to 100% + pan to (0, 0).
   - Capture screenshot (`/_menu-world.png`).
   - (issue-90) Re-open the menu and click `Add comment` instead — assert the
     composer opens anchored at the click point (previously this menu item
     didn't exist at all).
5. **Esc dismiss.**
   - Right-click anywhere to re-open.
   - Press Esc.
   - Assert `.dc-context-menu` removed.
6. **Click-outside dismiss.**
   - Right-click again.
   - Click anywhere outside the menu (any artboard).
   - Assert menu removed.
7. **Scroll dismiss.**
   - Right-click again.
   - Scroll-wheel inside the canvas (which pans the world).
   - Assert menu removed.
8. **Right-click on the ToolPalette (overlay).**
   - Right-click on the `Move` button in `.dc-tool-palette`.
   - Assert `.dc-context-menu` did NOT open (overlay kind = "overlay" → empty menu, dismissed).
9. **Keyboard navigation.**
   - Right-click on an element.
   - Press `↓` repeatedly.
   - Assert focus moves through enabled menu items (skipping `disabled`).
   - Press `↑` to wrap-around backwards.
   - Press `Enter` (or Space) to activate the focused item.

## Success criteria

- 0 console errors.
- Native browser menu never shows in any step.
- Clipboard writes only on `Copy *` items (no leaks on hover).
- `aria-label` on each menu button matches its visible text + shortcut.
- Disabled items (`Inspect`) cannot be clicked or arrow-focused.

## Counter deltas

- Clipboard mutates once on each `Copy *` click; no other side effects.

## Known limitations

- Touch devices: contextmenu via long-press is browser-dependent; web-mobile may not surface the menu at all. Accept; mobile is degraded.
- "Hide" toggles `visibility: hidden` on the target — there's no "Show" undo path yet (Phase 4.2 will add a layer panel). Document as a known gap, not a blocker.
