# landing-first-visit

**Persona:** Anonymous first-time visitor landing on the marketplace home.
**Artboard:** DS-01 (`.design/ui/Docs Site.html` `<DcArtboard id="landing">`).
**Hypothesis:** The home route renders the MDCC marketplace chrome end-to-end — Hero + InstallSnippet + CatalogGrid + MetaFooter — with zero gradient/blur/emoji and 1px hairline borders throughout.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | ✓ |

Native iOS/Android: N/A (web-only). See `../README.md`.

## Preconditions

- `pnpm --filter @md-claude/site dev` running on `http://localhost:3000` (or any port; pass via `--base-url`).
- Light theme default (`<html data-theme="light" class="mdcc">`).

## Steps

1. **Navigate** to `/`.
   - Capture full-page screenshot.
   - Selector check: `.mdcc-wm` exists, `.mdcc-sku` chip reads `MDCC/00`, nav links are `Docs`, `Plugins`, `Source`.
2. **Above the fold — Hero block.**
   - Capture viewport screenshot at scroll=0.
   - Read text node under `.landing-hero h1` — must contain canvas copy fragments (`Plugins`, `vibes`).
   - Verify `<InstallSnippet>` renders 3 code lines and the copy button (`button[aria-label*="Copy"]`) is reachable.
3. **CatalogGrid section.**
   - Scroll to `#plugins` (or `.mdcc-cat-grid`).
   - Capture section screenshot.
   - Selector check: exactly 3 `.mdcc-cat-card` children, each with an SKU label matching `MDCC-(DSN|FLW|CLI)/0[1-3]`.
4. **MetaFooter.**
   - Scroll to bottom.
   - Capture footer screenshot.
   - Selector check: 4 columns rendered (`published`, `source`, `license`, `contributors`); none contain literal placeholder strings (`{{`, `TODO`, `Lorem`).

## Success criteria

- 0 console errors (network / hydration / a11y).
- 0 emoji in chrome (`/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]/u` matches 0 in captured DOM).
- All hairline borders rendered at 1px (no thicker; visual diff against DS-01 within ±2px tolerance).
- Hero, CatalogGrid, MetaFooter all visible without horizontal overflow at 1440×900 and 375×812.

## Counter deltas (parity)

This scenario does not mutate persistent state — counter-delta parity is trivially `0` on every platform. Report MUST still emit the counter row to keep `scenario-runner`'s pivot table consistent.

## Known limitations

- `next/font/google` JetBrains Mono loads from Google's CDN on first request — record initial font-load latency but do not gate on it (out of scope for visual scenario).
