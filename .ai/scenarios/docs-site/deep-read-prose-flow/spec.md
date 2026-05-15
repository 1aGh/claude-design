# deep-read-prose-flow

**Persona:** Reader who lands on a long-form docs page and scrolls to the bottom, then clicks the prev/next pager.
**Artboard:** DS-03 (`.design/ui/Docs Site.html` `<DcArtboard id="docs-article">`).
**Hypothesis:** The article surface renders MDCC chrome end-to-end — SKU breadcrumb above title, CSS-counter h2 numbering, callouts with ASCII glyphs, code blocks with filename strip + copy button, prev/next pager — with all fumadocs behaviors (TOC active-section sync, sidebar tree active rule, theme toggle reach) preserved.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1440×900 | ✓ |
| web-mobile | 375×812 | ✓ |

## Preconditions

- Dev server running.
- Page `/docs/design/bootstrap` reachable (canonical long-form page for this test).

## Steps

1. **Land on article.**
   - Navigate to `/docs/design/bootstrap`.
   - Capture above-the-fold screenshot.
   - Selector check: `.mdcc-sku-breadcrumb` exists, contains `Docs /`, ` · `, and an SKU shape (`MDCC-…/…`).
2. **Numbered h2.**
   - Scroll to the second `h2` on the page.
   - Capture viewport screenshot at that scroll position.
   - Selector check: `::before` content on `.prose h2` resolves to `01 · `, `02 · ` etc. (read via `getComputedStyle(el, '::before').content`).
3. **Callout sanity.**
   - Locate the first `<Callout>` on the page (any `type`).
   - Capture element screenshot.
   - Selector check: 4px left rule in status color (`--status-warn` / `--status-error` / etc.); ASCII glyph prefix (`!` / `?` / `▲` / `★`); no Lucide `<svg>` child.
4. **Code block.**
   - Locate the first `<pre>` rendered by MDCC `<CodeBlock>`.
   - Capture element screenshot.
   - Selector check: filename strip present (or absent gracefully if no `data-filename` attr); copy button reachable via Tab; `font-family` resolves to JetBrains Mono / Berkeley Mono fallback chain.
5. **TOC active-section sync.**
   - Scroll to the middle of the article.
   - Capture right-rail TOC screenshot.
   - Selector check: exactly 1 `[data-toc] a[aria-current="true"]` or `[data-toc] a.is-active`; left rule rendered in `--accent`.
6. **Sidebar active rule.**
   - Capture sidebar screenshot.
   - Selector check: active page item has `border-left: 1px solid var(--accent)` AND no Lucide `<svg>` child (DS hard NO).
7. **Prev/Next pager.**
   - Scroll to bottom.
   - Capture pager screenshot.
   - Click `Next →` link.
   - Validate URL changed; capture destination above-the-fold screenshot.

## Success criteria

- 0 console errors across the full scroll path.
- Numbered h2 rendered for at least the first 3 h2 elements; counter values are sequential (no resets mid-page).
- No emoji anywhere in chrome (regex check on captured DOM).
- Pager click navigates without full-page reload (Next router transition only).

## Counter deltas

`pathname` mutates exactly once (final click). Parity: both platforms must end on the same destination pathname.

## Known limitations

- Web-mobile sidebar is collapsed by default; sidebar active-rule check runs only on web-desktop. The mobile run records `sidebar=collapsed` in the report rather than asserting.
