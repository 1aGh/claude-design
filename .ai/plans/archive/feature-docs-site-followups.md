# Feature: docs-site MDCC-DSN/01 follow-ups

Surfaced during `/flow:done` closeout of `feature-docs-site-mdcc-skin` on 2026-05-15. The parent feature shipped (commits `78d9d8f` + `94b4e77`) with **0 hard-blockers in scenario-runner** but **DS-guard + a11y-auditor both returned BLOCK** with substantive findings. Per `/flow:done` Step 7 decision, those findings are accepted as known issues for v0.12.0 and tracked here for the next iteration.

## Description

Close the gap between the shipped v0.12.0 docs-site and the DS-01..DS-04 canvas spec + WCAG 2.1 AA. Three categories: (1) DS-spec deviations, (2) WCAG fails, (3) code-review polish.

## User Story

As a docs-site visitor I want every page to (a) match the MDCC-DSN/01 canvas spec exactly, (b) be reachable from keyboard / screen-reader / mobile, and (c) follow the project's "no glassmorphism / no foreign brand assets / no Lucide in chrome" hard NOs.

## Problem

Three real visual bugs (numbered h2 missing, cmd-K backdrop blur, BMC stock PNG button), one critical interaction bug (mobile theme toggle 0×0 / unreachable), and a chassis of WCAG fails (no focus rings anywhere, no skip-link element, sub-`4.5:1` contrast on `--fg-3`).

## Solution

Three commits, in this order:

### Commit 1 — DS-spec deviations (visual chrome)

1. **Cmd-K backdrop blur removal.** Override fumadocs's `backdrop-blur-xs` on `[data-fd-search]` overlay in `site/app/global.css`. Replace with flat `oklch(0% 0 0 / 0.5)` (already declared as `--color-fd-overlay`, just needs to be the sole separation layer). Verify against canvas DS-04.
2. **Remove Buy-me-a-coffee PNG button + Lucide Coffee icon.** `site/app/(home)/page.tsx:96-107` `<img>` and `site/lib/layout.shared.tsx:2,23` `Coffee` import. Replace with `<a className="mdcc-cta-ghost">` carrying the BMC URL; if a glyph is needed use a Unicode mark (`▸ ▹ ● ○ · →`) per `.design/system/project/README.md` §"Hard rules" #7. Then `grep -r 'lucide-react' site/` — if zero hits remain, drop `lucide-react` from `site/package.json`.
3. **Numbered h2 counter rule selector audit.** `site/app/global.css:447-471` declares the rule against `[data-fd-page]`, `article.prose`, `.fd-docs-body` — none match the live DOM. Open `/docs/design/bootstrap`, inspect the actual wrapper class/data-attr, fix the selector. Verify against DS-03 — expect `01 · `, `02 · ` decimal-leading-zero prefix on every `h2`.
4. **Lucide SVGs in cmd-K dialog.** `site/app/global.css:534` only scopes the SVG hide to `#nd-sidebar`. Add `[data-fd-search] svg, [data-fd-search-dialog] svg { display: none }` (or scope tighter to result-row icons only if some are deliberately retained per DDR-011 fallback).
5. **4 px callout border violation.** `site/app/global.css:644` `border-left: 4px solid ...` on `.mdcc-callout`. Drop to 1 px and convey type via accent stripe on a `::before` child, or move the colored bar to a 1 px-width `::before` to preserve the hairline contract per `.design/_history/docs-site/000-envelope.md`.
6. **Mobile SKU breadcrumb clip.** `site/app/global.css:424-434` — add `min-width: 0; overflow: hidden; text-overflow: ellipsis` to trailing `.mdcc-sku`, or let the SKU wrap to its own line on `<720px`.

### Commit 2 — WCAG 2.1 AA fixes (a11y)

7. **Global focus rings.** Add to `site/app/global.css`:
   ```css
   :where(a, button, [role="button"], input, summary, [tabindex]):focus-visible {
     outline: 2px solid var(--accent);
     outline-offset: 2px;
   }
   ```
   This wins over fumadocs's `focus-visible:outline-none` because of selector specificity + cascade order. Verify on cmd-K input, sidebar accordion, TOC links, copy buttons, nav links, catalog cards.
8. **Mobile theme toggle visibility.** Audit fumadocs `HomeLayout` `themeSwitch` slot wiring in `site/lib/layout.shared.tsx`. The toggle is in the DOM at `0×0`/`offsetParent=null` on 375px — likely a `display:none` mobile breakpoint somewhere in the responsive cascade. Add a visible mobile copy of the toggle if fumadocs doesn't surface it by default.
9. **Skip-link element.** `site/app/global.css:147-160` declares `.mdcc-skip-link` but no JSX uses it. Render `<a className="mdcc-skip-link" href="#main-content">Skip to main</a>` as the first child of `<body>` in `site/app/layout.tsx`. Set `id="main-content"` on every `<main>` (currently `app/(home)/page.tsx:66` uses `id="plugins"` — change OR adjust the CSS to use that id).
10. **`--fg-3` on `--bg-0` contrast (2.69:1 light / 2.59:1 dark, fails 4.5:1).** Audit usages: `mdcc-sku-breadcrumb .sep` is `aria-hidden` (OK), `h2:hover::after` anchor "#" is interactive (bump to `--fg-2`). Token reserved for disabled controls is OK to keep at low contrast.
11. **`--border-default` on `--bg-0` for interactive cards (2.15:1, fails 3:1 non-text).** `.mdcc-cat-card` relies on `border: 1px solid var(--border-default)` as sole affordance — promote to `var(--border-strong)` (6.11:1 light, 4.67:1 dark).
12. **BMC `<img>` double-name.** `app/(home)/page.tsx:105` — drop `aria-label` on the `<a>` or set `alt=""` on `<img>`. Likely moot after Commit-1 #2 removes BMC entirely.
13. **Touch targets <24×24.** `.mdcc-code-copy` and `.mdcc-install-copy` need `padding: var(--space-2) var(--space-3)` minimum so the hit box is ≥24×24 even if visual chrome stays tight. WCAG 2.5.8 (AA, 2.2).

### Commit 3 — Code-review polish

14. **`page-meta-footer.tsx` invalid HTML.** `<dt>`/`<dd>` without `<dl>` wrapper. Either wrap in `<dl>` or switch to plain `<div>`/`<span>` pairs.
15. **`build-stats.mjs` brittleness:** misleading comment line 66, `git shortlog -sne main` → `HEAD`, escape `'` in shell paths, fail-loud on no tag (line 39 today-fallback), warn on empty `pageUpdated` (line 81).
16. **Clipboard `.catch()` + `setTimeout` cleanup** in `copy-button.tsx` + `code-block.tsx`.
17. **`page-meta-footer.tsx:16` `rel="noopener noreferrer"`** consistency.
18. **`code-block.tsx:13-14` destructure `data-filename` / `data-language` from props** instead of casting `rest`.

### Token discipline (optional, defer if scope explodes)

19. Add `--type-2xs: 10px` token in `mdcc-tokens.css` and replace 3 hardcoded `10px` font-sizes in `global.css`.
20. Promote `--overlay-scrim: oklch(0% 0 0 / 0.5)` token; reference from `--color-fd-overlay`.
21. Replace `padding: 1px 4px` / `2px var(--space-3)` literals with `var(--space-1)` family.

## Acceptance Criteria

- [ ] Re-run `/flow:scenario docs-site` — all 4 scenarios PASS without "pass-with-findings" qualifier on either viewport.
- [ ] Re-run DS-guard — verdict `PASS` or `PASS WITH FINDINGS` (no blockers).
- [ ] Re-run a11y-auditor with live `agent-browser` + axe-core — verdict `PASS` or `PASS WITH FINDINGS`; specifically Skip Blocks (2.4.1), Focus Visible (2.4.7), and Keyboard (2.1.1) all pass.
- [ ] Mobile theme toggle is reachable from keyboard AND visible from mouse at 375×812.
- [ ] Numbered h2 `01 · `, `02 · ` etc. render on `/docs/design/bootstrap` (verify in DevTools computed `::before content`).
- [ ] No glassmorphism on cmd-K dialog (DevTools `backdrop-filter` = `none`).
- [ ] `lucide-react` dependency removed from `site/package.json` (or justified DDR amendment if kept).

## Confidence + risks

**Confidence:** 8.5/10. Findings are well-isolated; fixes are mechanical. Main risk: fumadocs's `themeSwitch` mobile responsiveness (item #8) may require a fumadocs config option we haven't discovered, in which case fallback is to render our own theme button.

**DDR candidates:**
- Mobile theme toggle fix may warrant a `DDR-NNN-mobile-theme-toggle-strategy.md` if we end up shadowing the fumadocs button.
- If `lucide-react` is dropped entirely, document the "no icon library, Unicode marks only" rule in DDR-011 amendment or a fresh DDR.

## References

- Aggregate scenario report: [`.ai/scenarios/docs-site/2026-05-15-0906-aggregate.md`](../scenarios/docs-site/2026-05-15-0906-aggregate.md)
- Code review log: [`.ai/logs/code-reviews/main-docs-site-mdcc-skin.md`](../logs/code-reviews/main-docs-site-mdcc-skin.md)
- Parent feature plan: [`.ai/plans/archive/feature-docs-site-mdcc-skin.md`](archive/feature-docs-site-mdcc-skin.md)
- DDR-011 (re-skin strategy): [`.ai/decisions/DDR-011-mdcc-skin-of-fumadocs-vs-fork.md`](../decisions/DDR-011-mdcc-skin-of-fumadocs-vs-fork.md)
- Canvas spec: `.design/ui/Docs Site.html`
- Envelope: `.design/_history/docs-site/000-envelope.md`

## Retro — 2026-05-15

**Outcome:** items 1-3, 5-7, 9-18 shipped (subsumed into TOV commit `fece8da` alongside voice-register rewrites). Item 4 (Lucide v cmd-K) deferred, regression fix in commit `fb0ae63`. Items 8 (mobile theme toggle), 19-21 (token discipline) deferred with notes. Build/types/lint green throughout.

**What worked:**
- Splitting the plan into 3 commit groups (DS-spec / WCAG / polish) made the diff easy to reason about and trivially mergeable into the TOV pass that ran in parallel.
- Reading fumadocs's compiled JS directly to find that `DocsBody` renders `<div class="prose flex-1">` (not `[data-fd-page]`) caught a silently-dead selector before it shipped.
- Verifying the icon-hide rule with a live dev server (`localhost:3055` + grep on rendered HTML) caught that Sun/Moon/Search SVGs were the only visible affordance of their parent buttons — manual file-only review would have missed this.

**What didn't:**
- Item 4 (`[role="dialog"].bg-fd-popover svg { display: none }`) was reasoned-correct on paper (Radix Popover's dialog role + bg-fd-popover class is exclusive to cmd-K content) but in practice Tailwind v4 class-name escaping + Radix portal context made the rule hit chrome buttons whose parents inherited a dialog role somewhere up the tree. Lesson: when a CSS rule targets fumadocs/Radix internals, verify by **opening the dialog in a browser and watching what disappears**, not by reading source.
- I added a stray `site/package-lock.json` by running `npm install` in a pnpm workspace — caught + reverted, but a `cd site && npm install` muscle-memory is dangerous on a monorepo. Always check `pnpm-workspace.yaml` before reaching for `npm`.

**For next time:**
- When `/flow:execute` runs concurrently with another session editing the same files, the loser-merge case (different files but overlapping intent) needs an explicit conflict-detection step. The TOV pass + my followups landed cleanly in `fece8da` only because the user manually merged them.
- The plan's "items 19-21 optional" was correctly scoped as opt-out — keep that pattern.
