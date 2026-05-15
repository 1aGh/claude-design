# theme-toggle

**Persona:** Reader toggling between paper-light and phosphor-dark.
**Artboards:** DS-01..DS-03 in both themes (cross-cuts).
**Hypothesis:** fumadocs's existing theme toggle drives `html.dark` and the MDCC `[data-theme="dark"]` variants render identically; no contrast regressions; no flash of unstyled content (FOUC).

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | ✓ |

## Preconditions

- Dev server running.
- Default theme = light (`<html>` lacks `.dark` class on initial load).

## Steps

1. **Initial light.**
   - Navigate to `/`.
   - Capture full-page screenshot (`/_landing-light.png`).
   - Selector check: `getComputedStyle(html).getPropertyValue('--bg-0')` resolves to the paper-cream OKLCH value (`oklch(97.5% 0.008 78)` or close).
2. **Toggle to dark.**
   - Click theme toggle in nav (`[aria-label*="theme" i]` or fumadocs's documented selector).
   - Wait for class transition.
   - Capture full-page screenshot (`/_landing-dark.png`).
   - Selector check: `html` has `dark` class AND `data-theme="dark"` (or only one — record which); `--bg-0` resolves to phosphor-dark OKLCH.
3. **Sample a docs page in dark.**
   - Navigate to `/docs/design/bootstrap`.
   - Capture above-the-fold screenshot.
   - Verify no inline `style=""` rule overrides `color` (paper-only literals would survive theme switch and break contrast).
4. **Toggle back to light.**
   - Click toggle again.
   - Capture above-the-fold screenshot.
   - Verify theme returned to light; no stuck dark-only rules survive.

## Success criteria

- No FOUC: between click and repaint, the page never renders with mismatched bg/fg (e.g. dark bg + light text).
- Persisted theme: refresh after step 2 lands on dark without flash.
- Contrast: every `--fg-*` on its paired `--bg-*` clears WCAG AA 4.5:1 (delegate to `a11y-auditor` for the formal check; this scenario only screenshots for visual sanity).
- 0 console errors during toggle.

## Counter deltas

`localStorage["theme"]` mutates twice (light → dark → light). Both platforms must end with the same value (`"light"` or unset, depending on fumadocs's default).

## Known limitations

- If fumadocs sets only `html.dark` (not `data-theme="dark"`), the `[data-theme="dark"]` CSS selector in `mdcc-tokens.css` won't match. The site's `global.css` mirrors dark rules under both selectors (DDR-011 §"theme bridge"). This scenario validates that fallback.
