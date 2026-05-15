# cmd-k-search-flow

**Persona:** Returning user who knows their way around — opens cmd-K to jump to a deep docs page.
**Artboard:** DS-04 (`.design/ui/Docs Site.html` `<DcArtboard id="cmd-k">`).
**Hypothesis:** The Orama search dialog renders with MDCC re-skin (1px ink frame, 0 radius, `--bg-1` background, result-row prefix glyphs) and Orama's underlying behavior (typeahead, keyboard nav, Enter to navigate) is unchanged.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | ✓ |

## Preconditions

- Dev server running.
- On any docs page (use `/docs/getting-started`).
- Orama search index built (`pnpm build` or first `pnpm dev` request must complete to populate `/api/search`).

## Steps

1. **Open palette.**
   - Press `Cmd+K` (`Ctrl+K` on web-mobile via on-screen keyboard substitute: dispatch `keydown` event).
   - Capture screenshot of opened dialog.
   - Selector check: `[role="dialog"][data-fd-search]` (or fumadocs's actual data-attribute) exists; backdrop has dim treatment, not blur.
2. **Empty state.**
   - Verify hint footer renders (`⌘K` glyph or ASCII fallback).
   - Result list area is empty but laid out (no layout shift when typing begins).
3. **Type query.**
   - Type `bootstrap` slowly (50ms per keystroke to capture intermediate states).
   - Capture screenshot after 200ms debounce settled.
   - Selector check: at least 1 result row visible; first row prefixed with `▸` or `●` or `○` (MDCC glyph), not a Lucide icon.
4. **Keyboard navigation.**
   - Press `ArrowDown` twice, `Enter`.
   - Validate URL navigates to a `/docs/design/bootstrap`-shaped path (substring match on `bootstrap`).
   - Capture destination screenshot.

## Success criteria

- Dialog opens within 100ms of keydown (compositor-only — no layout reflow >16ms).
- No visible scrollbar inside dialog on either viewport (results overflow with `overflow: auto` only when count > 8).
- 0 console errors during open / type / navigate.
- Destination page loads with intact MDCC chrome.

## Counter deltas

Navigating off `/docs/getting-started` is the only state change; report records `urlPath` before/after on each platform. Parity check: both platforms end on the same final `pathname`.

## Known limitations

- If fumadocs's Orama dialog doesn't expose `result.type` in the DOM, the prefix glyph degrades to a uniform `▸` for all rows (DDR-011 acknowledges this fallback). Do not flag.
