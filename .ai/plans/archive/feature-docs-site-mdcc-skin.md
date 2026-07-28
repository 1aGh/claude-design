# Feature: Docs Site — MDCC-DSN/01 re-skin

Validate canvas + fumadocs source before implementing. Token names, fumadocs `--fd-*` slots, and Berkeley/JetBrains fallback chain are authoritative — don't paraphrase them.

## Description

Migrate the visual redesign captured in `.design/ui/Docs Site.html` (4 artboards: Landing, Docs Index, Docs Article, Cmd-K) into the live `site/` Next.js + fumadocs-ui application. Re-skin fumadocs primitives by mapping its `--fd-*` design tokens to MDCC-DSN/01 tokens (`.design/system/project/colors_and_type.css`) — **do not replace fumadocs components**. All fumadocs behaviors stay (Orama search, MDX code blocks with copy, callouts, prev/next pager, TOC, sidebar tree, theme toggle). The home route is rewritten from a centered hero to the catalog grid landing.

## User Story

As a visitor landing on `md-claude`'s site I want a marketplace catalog (SKU cards + install snippet) and a docs surface that reads like an industrial catalog, so that the site visually matches the plugin's own design identity instead of fumadocs's default neutral preset.

## Problem

Today `site/` ships fumadocs's default `neutral` preset with Inter and a single centered hero on `/`. There is no marketplace landing, no shared MDCC chrome, no token-mapped re-skin. The redesign — already approved and screenshot-validated as `.design/ui/Docs Site.html` — has no implementation path into production.

## Solution

1. Wire MDCC-DSN/01 tokens into `site/app/global.css` as `--fd-*` overrides (light + dark variants), preserving fumadocs's neutral preset as fallback for tokens we don't define.
2. Swap Inter → JetBrains Mono (Google Fonts via `next/font/google`) as the body+mono face. Keep Berkeley Mono / TX-02 first in the CSS `font-family` chain for users who self-host them, but ship JetBrains as default.
3. Rewrite `app/(home)/page.tsx` as Hero + CatalogGrid + MetaFooter, mirroring artboard DS-01.
4. Re-skin the docs shell (`app/docs/layout.tsx` + page) with MDCC chrome — SKU breadcrumb, numbered h2 rules, page-meta footer — via fumadocs's `DocsLayout` slots + custom MDX components.
5. Customize fumadocs's MDX renderers (`components/mdx.tsx`) for code-block filename strip, iconed callouts (ASCII glyphs, no emoji), inline code, anchor-link `#` hover.
6. Re-skin the Orama search dialog with MDCC tokens — no behavior change.
7. Two-theme support: paper-light default, phosphor-dark via fumadocs's existing theme toggle.

## Metadata

- **GitHub Issue**: (none — driven by canvas `.design/ui/Docs Site.html`)
- **Type**: Enhancement (visual redesign + landing rebuild)
- **Complexity**: High
- **App/Package**: `site/` (Next.js 16, fumadocs-ui 16.8.10, Tailwind v4)
- **Affected Systems**: Marketplace landing page, docs shell, MDX renderers, search dialog, theme tokens, font loading
- **Dependencies**: None new at runtime (`next/font/google` is built in); JetBrains Mono via Google Fonts. No new npm packages.

---

## Context References

### Must-Read Files

- `.design/ui/Docs Site.html` (entire file, 1838 lines) — Why: authoritative visual spec; every class (`.nav`, `.landing-hero`, `.cat-grid`, `.docs-shell`, `.cmdk-*`) maps to a real component.
- `.design/system/project/colors_and_type.css` (1–200) — Why: token authority. Both themes (`:root`/`[data-theme="light"]` + `[data-theme="dark"]`) live here.
- `.design/_history/docs-site/000-envelope.md` — Why: brief, anti-patterns ("Generic SaaS hero", emoji icons in chrome), real content strings to lift verbatim.
- `site/app/layout.tsx` — Why: root layout where Inter is loaded today; font swap lands here.
- `site/app/(home)/page.tsx` — Why: current centered-hero page being replaced.
- `site/app/(home)/layout.tsx` + `site/app/docs/layout.tsx` + `site/lib/layout.shared.tsx` — Why: shared chrome via fumadocs's `HomeLayout` / `DocsLayout` + `baseOptions()`.
- `site/app/docs/[[...slug]]/page.tsx` — Why: docs article page; insertion point for SKU breadcrumb + page-meta footer.
- `site/app/global.css` — Why: where token overrides land; currently imports `fumadocs-ui/css/neutral.css` + `fumadocs-ui/css/preset.css`.
- `site/components/mdx.tsx` — Why: MDX renderer surface for code-block + callout customization.
- `site/content/docs/meta.json` + `site/content/docs/design/meta.json` — Why: sidebar tree source; SKU labels in the redesign mirror these section names exactly.
- `node_modules/fumadocs-ui/dist/css/preset.css` (read-only reference) — Why: enumerates every `--fd-*` token slot we need to override.

### Files to Create

- `site/app/(home)/_components/hero.tsx` — landing hero block (3-line value statement + install snippet + `MDCC-MKT/00` SKU).
- `site/app/(home)/_components/catalog-grid.tsx` — SKU card grid with overlapping 1px borders (`margin: -1px 0 0 -1px` trick).
- `site/app/(home)/_components/meta-footer.tsx` — provenance block (published · source · license · contributors).
- `site/app/(home)/_components/sku-label.tsx` — reusable `<SkuLabel>` chip (used in nav + cards + breadcrumbs).
- `site/app/(home)/_components/install-snippet.tsx` — code block with copy button for `/plugin marketplace add 1aGh/md-claude` + install lines.
- `site/components/mdcc/code-block.tsx` — re-skinned `<pre>`/`<code>` with filename strip + copy + (slot for) language tabs.
- `site/components/mdcc/callout.tsx` — iconed callout (note/warn/danger/tip) with ASCII glyph prefix.
- `site/components/mdcc/sku-breadcrumb.tsx` — breadcrumb with MDCC SKU tail used in docs page header.
- `site/components/mdcc/numbered-h2.tsx` — auto-numbered `01 · …` h2 rule for MDX (or implemented via CSS counters in `global.css`).
- `site/app/(home)/page.module.css` — local CSS that hosts catalog-grid border-overlap trick + landing-specific rules (kept out of global to avoid leaking into docs).
- `.ai/archive/decisions/DDR-010-mdcc-skin-of-fumadocs-vs-fork.md` — record the "re-skin via `--fd-*` overrides, do not fork fumadocs" decision.

### Files to Edit (substantial)

- `site/app/global.css` — add `--fd-*` override block for paper-light + phosphor-dark; import MDCC tokens; CSS for nav, docs shell, cmd-K, code-block, callout.
- `site/app/layout.tsx` — replace Inter with JetBrains Mono via `next/font/google`; expose CSS variable.
- `site/app/(home)/page.tsx` — full rewrite (Hero + CatalogGrid + MetaFooter sections).
- `site/app/(home)/layout.tsx` — pass MDCC nav options (wordmark + SKU + Docs/Plugins/Source links) to `HomeLayout`.
- `site/app/docs/layout.tsx` — pass MDCC nav options + `sidebar` overrides to `DocsLayout`.
- `site/app/docs/[[...slug]]/page.tsx` — wrap title with `<SkuBreadcrumb>`, add page-meta footer below `DocsBody`.
- `site/components/mdx.tsx` — register the new `code-block.tsx`, `callout.tsx` MDCC renderers.
- `site/lib/layout.shared.tsx` — return an MDCC-flavored `BaseLayoutProps` (nav title JSX with wordmark + SKU, links array including Docs/Plugins/Source).

### Documentation

- [fumadocs-ui design tokens](https://fumadocs.dev/docs/ui/theme) — Why: enumerates `--fd-*` slots we must override (background, foreground, muted, primary, border, accent, ring, card, popover, etc.).
- [fumadocs `BaseLayoutProps`](https://fumadocs.dev/docs/ui/layouts/home) — Why: nav customization API used in `lib/layout.shared.tsx`.
- [fumadocs MDX components contract](https://fumadocs.dev/docs/ui/mdx) — Why: which renderers `getMDXComponents` accepts, how to override `pre`/`code`/`Callout`.
- [fumadocs search](https://fumadocs.dev/docs/headless/search/orama) — Why: confirm we keep Orama default; styling lives in CSS, not in JS.
- [Next.js `next/font/google`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) — Why: JetBrains Mono loading recipe + CSS variable wiring.

### Patterns to Follow

- **Token aliasing pattern** (lift from canvas, then add fumadocs bridge):
  ```css
  /* site/app/global.css */
  @import "tailwindcss";
  @import "fumadocs-ui/css/neutral.css";   /* keep — provides slots we don't override */
  @import "fumadocs-ui/css/preset.css";
  @import url("./mdcc-tokens.css");        /* MDCC-DSN/01 tokens copied/symlinked from .design */

  :root, html.light {
    --fd-background: var(--bg-0);
    --fd-foreground: var(--fg-0);
    --fd-muted: var(--bg-2);
    --fd-muted-foreground: var(--fg-2);
    --fd-border: var(--border-default);
    --fd-primary: var(--accent);
    --fd-primary-foreground: var(--accent-fg);
    --fd-accent: var(--accent-tint);
    --fd-ring: var(--accent);
    --fd-card: var(--bg-1);
    --fd-popover: var(--bg-1);
    /* …enumerate remaining --fd-* slots from preset.css… */
  }
  html.dark { /* mirror with phosphor-dark tokens */ }
  ```

- **MDCC font load** (replace existing Inter block in `app/layout.tsx`):
  ```ts
  import { JetBrains_Mono } from 'next/font/google';
  const jetbrains = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mdcc-mono',
    weight: ['400', '500', '700'],
  });
  // <html className={`${jetbrains.variable} mdcc`} data-theme="light">
  ```

  Then in `global.css`, the existing `--font-mono` chain (`'Berkeley Mono', 'TX-02', 'JetBrains Mono', …`) is augmented with `var(--font-mdcc-mono)` at the end so Next's self-hosted JetBrains Mono is the guaranteed fallback.

- **SKU label component pattern** (lift from canvas `.nav-brand .sku` rules):
  ```tsx
  // sku-label.tsx
  export function SkuLabel({ children }: { children: React.ReactNode }) {
    return <span className="mdcc-sku">{children}</span>;
  }
  ```
  Styling lives in `global.css` under `.mdcc-sku` — uses `--accent`, `--accent-tint`, `--tracking-sku`, 1px border. Keeps the chip a CSS contract, not a JSX one.

- **Catalog grid overlapping borders** (canvas `.cat-grid`):
  ```css
  .mdcc-cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .mdcc-cat-grid > * { margin: -1px 0 0 -1px; border: 1px solid var(--border-default); }
  ```

---

## Design Decisions

> Populated by Design System Discovery (Step 3). Source: `.design/ui/Docs Site.html` + envelope.

### Components (from existing canvas/repo)

| Component | Source | Notes |
| --- | --- | --- |
| Top nav (wordmark + SKU + links) | canvas `.nav`, `.nav-brand`, `.nav-links` | Map into fumadocs `BaseLayoutProps.nav.title` (JSX) + `links` array; identical chrome across landing + docs |
| Code block (filename strip + copy) | `.design/system/project/preview/components-code-block.html` | Re-implement as MDX `pre` renderer; copy button hooks `navigator.clipboard.writeText` |
| Callout (note/warn/danger/tip) | `.design/system/project/preview/components-callout.html` | Replace fumadocs's default Callout via `getMDXComponents` override; ASCII glyph prefix (`!`, `?`, `▲`, `★`) — no emoji |
| Cmd-K palette | fumadocs's built-in Orama dialog | Re-skin via CSS only: `--fd-popover`, `--fd-border`, result-row prefix glyphs (`▸ ● ○`) injected through CSS pseudo-elements |
| Sidebar tree | fumadocs `DocsLayout` sidebar | Customize via `sidebar.banner`/`sidebar.footer` props + CSS for SKU-style section headers + left-edge rule on active page |
| Right-rail TOC | fumadocs `DocsPage toc` | Default behavior; CSS-only re-skin (accent left rule on active heading, mono type, 1px hairline above) |
| Prev/next pager | fumadocs default | CSS-only re-skin (1px rule above, `--space-7` padding) |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| --- | --- | --- |
| Marketplace landing | none — building custom | Hero + CatalogGrid + MetaFooter sections |
| Docs index | fumadocs's `/docs` default + MDCC chrome | Use `content/docs/index.mdx` as the source page; reskin via `--fd-*` |
| Docs article | fumadocs's `/docs/[...]` page | Wrap with `<SkuBreadcrumb>` + page-meta footer |
| Cmd-K modal | fumadocs Orama default dialog | Pure CSS re-skin; no JS wrapper |

> No matching block existed for the landing — building custom (see *Files to Create*).

### Icons

| Icon | Library | Size | Usage |
| --- | --- | --- | --- |
| Search hint `⌘K` | inline text glyph (no font icon) | 11–13px mono | nav input hint, cmd-K palette hint footer |
| Result prefix `▸` `●` `○` | inline Unicode (CSS `::before`) | 13px | cmd-K result rows (command / plugin / skill) |
| Theme toggle | reuse fumadocs default (already a line icon) | 14px | top nav |
| Callout glyphs `!` `?` `▲` `★` | inline text glyph | 14px | callouts |
| Anchor link `#` | CSS `::after` on h2/h3 hover | 13px | docs heading hover affordance |

> **No emoji** anywhere in chrome — canvas hard NO. Lucide icons stay only where fumadocs already injects them (theme toggle, GitHub button); the rest is text glyphs.

### Tokens

| Purpose | MDCC token | Bridged fumadocs slot | Usage |
| --- | --- | --- | --- |
| Page background | `--bg-0` | `--fd-background` | `<body>`, docs prose body |
| Card background | `--bg-1` | `--fd-card`, `--fd-popover` | catalog card, cmd-K modal |
| Subtle row hover | `--bg-3` | (no fumadocs slot — custom) | sidebar item hover, cmd-K row hover |
| Primary ink | `--fg-0` | `--fd-foreground` | body text |
| Muted text | `--fg-2` | `--fd-muted-foreground` | sub-labels, breadcrumb separators |
| Hairline border | `--border-default` | `--fd-border` | every 1px rule |
| Brand accent (SKU, active page) | `--accent` | `--fd-primary`, `--fd-ring` | SKU chips, active sidebar item left rule |
| Faint accent wash | `--accent-tint` | `--fd-accent` | SKU chip bg, hover wash for primary CTA |
| Code inline bg | `--mono-cell-bg` | (custom: `--fd-code-bg` if present, else override `code` selector) | `<code>` inline |
| Code block hairline | `--mono-rule` | `--fd-border` (scoped) | `<pre>` rule |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `<SkuLabel>` | DS contract; no fumadocs equivalent | n/a (`<span>` + CSS) |
| `<SkuBreadcrumb>` | docs breadcrumb with `MDCC-DSN/01.canvas-new` tail | fumadocs page header (above `DocsTitle`) |
| `<CatalogGrid>` + `<CatalogCard>` | landing-only catalog IA | n/a (CSS grid + cards) |
| `<InstallSnippet>` | hero install block | wraps the new `<CodeBlock>` |
| `<MetaFooter>` | landing meta block | n/a |
| `<NumberedH2>` (or CSS counter) | `01 · …` h2 rule in articles | replaces MDX `h2` renderer (or CSS-only via `counter-reset/increment` on `.prose`) |
| `<PageMetaFooter>` | docs page footer (Edit-on-GitHub + last-updated + page SKU) | rendered inside `DocsPage` below `DocsBody` |
| MDCC `<CodeBlock>` | filename strip + copy button (re-skin of fumadocs's pre) | MDX `pre` renderer |
| MDCC `<Callout>` | ASCII-glyph icons, no Lucide | replaces fumadocs `Callout` in `getMDXComponents` |

---

## Tasks

Execute in order. Each task is atomic and testable. Verify with `pnpm --filter @md-claude/site dev` (or `pnpm dev` from `site/`) and visual diff against the corresponding artboard.

### Task 1: SETUP — copy MDCC tokens into site

- **Do**: Copy (or symlink) `.design/system/project/colors_and_type.css` → `site/app/mdcc-tokens.css`. Document choice in DDR-010. Symlink is brittle on Windows + npm publish; **prefer a copy** with a one-liner script (`scripts/sync-mdcc-tokens.mjs`) that diffs the two files and warns if drift > 0. Add `pnpm sync:tokens` script.
- **Pattern**: same approach already used for `scripts/build-command-reference.mjs`.
- **Gotcha**: Tailwind v4 reads `@theme` blocks; the MDCC token file is `:root`-only — that's fine, but **don't** wrap MDCC tokens in `@theme` or Tailwind will try to generate utilities for them.
- **Validate**: `node scripts/sync-mdcc-tokens.mjs --check` exits 0; `pnpm types:check` passes.

### Task 2: ADD JetBrains Mono via next/font/google

- **Do**: In `site/app/layout.tsx`, replace `Inter` import with `JetBrains_Mono` from `next/font/google`. Expose as `--font-mdcc-mono` variable. Apply `className={`${jetbrains.variable} mdcc`}` and `data-theme="light"` to `<html>`. Remove the Inter import.
- **Pattern**: existing Inter block in `app/layout.tsx` — same shape.
- **Gotcha**: `next/font` requires the CSS variable to be referenced in `global.css` (`font-family: var(--font-mdcc-mono)`); without that the font is loaded but never used. Don't forget `font-feature-settings` for JetBrains Mono (zero with slash is `ss20`).
- **Validate**: `pnpm dev`, open `/`, computed `body` font-family contains `JetBrains_Mono_*` and `data-theme="light"` is on `<html>`.

### Task 3: ADD `--fd-*` token bridge in global.css

- **Do**: Append a block to `site/app/global.css`:
  - `@import "./mdcc-tokens.css";`
  - `:root, html.light { --fd-background: var(--bg-0); …enumerate every --fd-* slot from fumadocs preset.css that we override… }`
  - `html.dark { …mirror with phosphor-dark tokens… }`
  - Update `--font-mono` chain to end with `var(--font-mdcc-mono)`.
- **Pattern**: see *Patterns to Follow* token aliasing.
- **Gotcha**: fumadocs's `neutral.css` is imported BEFORE our override block — cascade order matters. Test that the override actually wins (DevTools → computed → `--fd-background`).
- **Validate**: Open `/docs`, verify body bg is cream (`--bg-0`), border on header is 1px ink hairline, body text is mono.

### Task 4: ADD MDCC chrome to nav (shared layout)

- **Do**: Rewrite `site/lib/layout.shared.tsx` to return JSX nav title (`<span className="mdcc-wm">md-claude</span><SkuLabel>MDCC/00</SkuLabel>`) and `links: [{ text: 'Docs', url: '/docs' }, { text: 'Plugins', url: '/#plugins' }, { text: 'Source', url: githubUrl }]`. Drop the unused `appName` import if redundant.
- **Pattern**: Canvas `.nav-brand`, `.nav-links` (lines ~76–145 of `Docs Site.html`).
- **Gotcha**: fumadocs's `HomeLayout` and `DocsLayout` both consume `BaseLayoutProps` — same `lib/layout.shared.tsx` must work for both surfaces (don't fork).
- **Validate**: Nav identical across `/` and `/docs` (visual diff against artboards DS-01 + DS-02).

### Task 5: BUILD `<SkuLabel>` + base MDCC styles

- **Do**: Create `site/components/mdcc/sku-label.tsx`. Add `.mdcc-sku`, `.mdcc-wm`, `.mdcc-nav-link`, `.mdcc-skip-link` rules in `global.css`. Lift the exact CSS from canvas `Docs Site.html` lines ~76–200 (nav block).
- **Pattern**: Canvas `.nav-brand .sku` and `.nav-links a` definitions.
- **Gotcha**: SKU label needs `text-transform: uppercase` + `letter-spacing: var(--tracking-sku)` — JetBrains Mono on its own is mono but not all-caps.
- **Validate**: SKU chip renders correctly in the nav and matches artboard DS-01 nav strip.

### Task 6: REBUILD `(home)/page.tsx` — Hero + CatalogGrid + MetaFooter

- **Do**: Full rewrite of `site/app/(home)/page.tsx`. Implement as 3 inline sections (no separate component files per user decision):
  - **Hero**: 3-line value statement (exact copy from envelope line 83), `<InstallSnippet>` with 3 lines, `MDCC-MKT/00 · marketplace · v0.12.0` SKU label.
  - **CatalogGrid**: 3 cards — `MDCC-DSN/01 · design · v0.12.0`, `MDCC-FLW/02 · flow · v0.12.0`, `MDCC-CLI/03 · mdcc · v0.12.0`. Descriptions from envelope line 85 (verbatim).
  - **MetaFooter**: 4 columns — published date / source link / license / contributor count.
- **Pattern**: Canvas `Docs Site.html` `<DcArtboard id="landing">` block (find it via grep `landing-hero`).
- **Gotcha**: The `margin: -1px 0 0 -1px` overlap trick on `.mdcc-cat-grid > *` requires that `.mdcc-cat-grid` itself have `overflow: hidden` OR sit inside a 1px-bordered container — otherwise edges of the outermost cards bleed.
- **Validate**: `pnpm dev`, screenshot `/` at 1440×900, visual diff against `.design/_history/docs-site/003-iter3-landing.png`.

### Task 7: BUILD `<CodeBlock>` MDX renderer

- **Do**: Create `site/components/mdcc/code-block.tsx`. Filename strip (reads from `data-filename` attr injected by MDX), copy button (uses `navigator.clipboard`), 1px hairline frame, mono content. Wire into `site/components/mdx.tsx` `getMDXComponents` as `pre: CodeBlock`.
- **Pattern**: `.design/system/project/preview/components-code-block.html`.
- **Gotcha**: fumadocs's MDX pipeline already wraps code in `<pre><code className="language-…">`; the renderer needs to extract the language from `className` and the filename from `data-filename` (set via `rehype-pretty-code` metadata if present, else absent). Don't break the existing fumadocs `MarkdownCopyButton` already used at the page level.
- **Validate**: Open `/docs/getting-started`, inspect a code block — has filename strip + copy button + correct font.

### Task 8: BUILD `<Callout>` MDX renderer

- **Do**: Create `site/components/mdcc/callout.tsx` with `type` prop (`note` | `warn` | `danger` | `tip`). ASCII glyph prefix + 4px left rule in status color. Wire into `getMDXComponents` as `Callout` (overrides fumadocs default).
- **Pattern**: `.design/system/project/preview/components-callout.html`.
- **Gotcha**: Existing MDX files use `<Callout type="warn">…</Callout>` syntax (check `content/docs/design/bootstrap.mdx` or similar). Keep prop API identical to avoid touching every MDX file.
- **Validate**: Grep `Callout` in `content/docs/**` — render those pages, every callout displays with correct ASCII glyph + status color.

### Task 9: BUILD docs shell extras (SKU breadcrumb + numbered h2 + page-meta footer)

- **Do**:
  - Create `site/components/mdcc/sku-breadcrumb.tsx` rendered in `app/docs/[[...slug]]/page.tsx` ABOVE `<DocsTitle>`. Format: `Docs / <section> / <subsection> · <SKU>`.
  - Add CSS counter on `.prose h2` for `01 ·` numbering (CSS-only — avoids touching MDX): `.prose { counter-reset: mdcc-h2; }` + `.prose h2::before { counter-increment: mdcc-h2; content: counter(mdcc-h2, decimal-leading-zero) " · "; }` + horizontal rule via `border-top`.
  - Create `<PageMetaFooter>` rendered below `<DocsBody>` with Edit-on-GitHub link (reuse `gitConfig` + `page.path`), last-updated date (read from frontmatter if available), page SKU.
- **Pattern**: Canvas `Docs Site.html` `<DcArtboard id="docs-article">` block.
- **Gotcha**: fumadocs's `DocsPage` is opinionated — make sure SKU breadcrumb sits in the `breadcrumb` slot (if available) rather than a sibling that would break layout. Verify against fumadocs 16.8.10 source.
- **Validate**: Open `/docs/design/bootstrap`, breadcrumb + numbered h2 + page-meta footer all render. Visual diff against DS-03.

### Task 10: RE-SKIN sidebar tree + right-rail TOC + prev/next pager

- **Do**: Pure CSS in `global.css`:
  - Sidebar: section headers in SKU style (caps + tracking-sku + 11px), active page = `border-left: 1px solid var(--accent)` + `color: var(--accent)`, no emoji icons.
  - TOC: same active-rule pattern, mono type, 1px hairline above the block, sticky.
  - Pager: `border-top: 1px solid var(--border-strong)`, `padding-block: var(--space-7)`, 2-column grid.
- **Pattern**: Canvas DS-02 + DS-03 right-rail and sidebar blocks.
- **Gotcha**: fumadocs ships default sidebar icons via Lucide; need `[data-icon]`/`svg` rules in our overrides to hide them (the canvas DS hard-NO is "no emoji icons in chrome"; Lucide line-icons are technically allowed but the design rejects them in this sidebar specifically).
- **Validate**: `/docs/getting-started` — sidebar, TOC, pager all match DS-02 / DS-03.

### Task 11: RE-SKIN cmd-K palette

- **Do**: Pure CSS — target the Orama dialog selectors fumadocs injects (likely `[role="dialog"]`, `[data-fd-search]` or similar; grep `node_modules/fumadocs-ui` to confirm). Apply MDCC frame (1px ink border, 0 radius, `--bg-1`), input row with `⌘K` hint, result-row prefix glyphs via `::before` (`▸` for command, `●` for plugin, `○` for skill — derive from result `type` if exposed; else uniform glyph).
- **Pattern**: Canvas `Docs Site.html` `<DcArtboard id="cmd-k">` block.
- **Gotcha**: If fumadocs's search doesn't expose result-type metadata, fall back to a single uniform `▸` glyph. Document the limitation in DDR-010 ("cmd-K type-specific glyphs require fumadocs API not present in v16.8.10").
- **Validate**: Press Cmd+K (or `/`), modal frame matches DS-04.

### Task 12: ADD theme toggle parity (paper-light ↔ phosphor-dark)

- **Do**: Verify fumadocs's existing theme toggle drives `html.dark` class. Confirm `mdcc-tokens.css` mirrors all light tokens under `html.dark, .mdcc[data-theme="dark"]`. Test all 4 artboards in both themes.
- **Pattern**: existing `[data-theme="dark"]` block in `.design/system/project/colors_and_type.css`.
- **Gotcha**: fumadocs uses `html.dark` (className), MDCC tokens use `[data-theme="dark"]` (attribute). Either bridge with a small JS effect in a client component that mirrors `html.dark` → `data-theme`, OR duplicate the dark block under both selectors. **Prefer duplication** — zero JS, idempotent.
- **Validate**: Toggle theme on `/` and `/docs/*`, no contrast regressions, screenshot both modes.

### Task 13: REMOVE Inter + tidy unused

- **Do**: Confirm no remaining `Inter` references in `site/`. Remove `font-family: Inter` from any leftover CSS. Audit `lib/shared.ts` `appName` — keep only if still used for metadata; remove from nav title (the nav now uses JSX).
- **Validate**: `grep -r Inter site/` returns 0 hits; `pnpm types:check` + `pnpm lint` pass.

### Task 14: RECORD DDR-010

- **Do**: Write `.ai/archive/decisions/DDR-010-mdcc-skin-of-fumadocs-vs-fork.md`. Decision: re-skin fumadocs via `--fd-*` CSS overrides + selective MDX renderer customization, do NOT fork. Trade-offs: tighter coupling to fumadocs's CSS variable contract vs. minimal maintenance burden + automatic behavior updates.
- **Validate**: DDR registered in `.ai/archive/decisions/README.md` index.

---

## Validation

Run these to confirm zero regressions (from `site/` working dir unless noted):

1. **Types**: `pnpm types:check`
2. **Lint**: `pnpm lint` (biome)
3. **Build**: `pnpm build` — fumadocs MDX must compile + Next must produce no warnings about font/CSS.
4. **Smoke**: `pnpm dev`, manually click through `/`, `/docs`, `/docs/getting-started`, `/docs/design/bootstrap`, `/docs/cli`. Verify cmd-K opens, theme toggles, code-block copy works, callouts render.
5. **Visual diff** (cross-platform, web-desktop + web-mobile only — no native iOS/Android relevance): spawn `flow:scenario-runner` against scripted scenarios:
   - `landing-first-visit` — open `/`, screenshot full page → diff against DS-01.
   - `docs-index` — open `/docs`, screenshot → diff against DS-02.
   - `docs-article-deep-read` — open `/docs/design/bootstrap`, scroll to h2#2, screenshot → diff against DS-03.
   - `cmd-k-search-flow` — open `/`, press `⌘K`, type `new`, screenshot modal → diff against DS-04.
6. **Design System Guard**: spawn `flow:design-system-guard` against the 4 screenshots — must report 0 blockers (no emoji icons, no gradients, no blur shadows, hairlines = 1px, mono everywhere).
7. **A11y**: spawn `flow:a11y-auditor` against `/`, `/docs`, `/docs/design/bootstrap`. Hard stops: paper-light contrast for `--fg-2` on `--bg-0` ≥ 4.5:1; focus rings visible on every interactive; keyboard reach for cmd-K, sidebar, theme toggle, prev/next.
8. **Manual edge cases**:
   - Long sidebar tree at narrow viewport (1280px) — no horizontal overflow.
   - Code block with very long lines — horizontal scroll inside block, not the page.
   - MDX page with no callouts and no code (e.g. `index.mdx`) — still renders.
   - `/docs` with no `slug` (index) — page still loads.

---

## Scenario Coverage (UI tasks — required)

**Existing scenarios covering affected flows:** none (this site has no `.ai/scenarios/` entries yet — pure docs surface that was not previously instrumented).

**New scenarios to create:**

- `docs-site/landing-first-visit` — visit `/` → screenshot above-the-fold catalog → click `design` card → land on `/docs/design`. Persona: first-time visitor. Fixtures: none (static site).
- `docs-site/cmd-k-search-flow` — visit `/docs`, press `⌘K`, type `bootstrap`, press Enter → land on `/docs/design/bootstrap`. Persona: returning user.
- `docs-site/deep-read-prose-flow` — visit `/docs/design/bootstrap`, scroll to bottom, click `Next →` pager → confirm next page loads.
- `docs-site/theme-toggle` — visit `/`, toggle theme, screenshot both → verify no contrast regressions.

Native (iOS/Android) scenarios are **N/A** for this work — site is web-only. Document the skip rationale in the scenario folder's README.

---

## Acceptance Criteria

- [ ] All 14 tasks completed.
- [ ] `/flow:utils-verify` passes after each task touching code (Edit-Verify Loop, max 3 iterations).
- [ ] `/flow:validate` passes overall:
  - [ ] Static (`pnpm types:check`, `pnpm lint`)
  - [ ] Build (`pnpm build`)
  - [ ] `scenario-runner`: 0 blockers across web-desktop + web-mobile (iOS/Android skipped with DDR justification)
  - [ ] `design-system-guard`: 0 blockers
  - [ ] `a11y-auditor`: 0 blockers
- [ ] Visual diff vs. all 4 artboards (`DS-01` … `DS-04`) shows MDCC chrome identity intact: SKU labels, mono everywhere, 1px hairlines, no shadows/gradients/blur, no emoji in chrome, no Lucide icons in sidebar.
- [ ] All fumadocs behaviors preserved: Orama search, MDX code copy, callouts, prev/next, TOC, theme toggle, sidebar tree.
- [ ] DDR-010 written + indexed.
- [ ] No `Inter` references remain; JetBrains Mono shipping default via `next/font/google`.
- [ ] No regressions in existing MDX pages — every page under `content/docs/**` renders.
- [ ] PR description links the 4 visual-diff screenshots.

---

## Confidence + risks

**Risk areas:**

1. **fumadocs `--fd-*` slot coverage** — neutral.css enumerates ~30 slots; if MDCC tokens don't cover one (e.g. `--fd-card-foreground` distinct from `--fd-foreground`), it falls back to neutral default and looks "off-brand". Mitigation: read `node_modules/fumadocs-ui/css/preset.css` in Task 3 and enumerate exhaustively.
2. **Cmd-K selector stability** — re-skinning via CSS targeting fumadocs's internal class names is brittle across minor versions. Mitigation: lock fumadocs-ui to `16.8.10` in `package.json` (already pinned); regression-test on every fumadocs upgrade.
3. **Tailwind v4 + custom CSS interaction** — order of `@import` statements matters; cascade conflicts possible. Mitigation: keep MDCC tokens in a separate file, import LAST, document in DDR-010.
4. **JetBrains Mono fallback chain** — if Google Fonts is blocked at runtime (corporate networks), `next/font` self-hosts so this is OK; but verify the CSS variable resolves even if Google Fonts CDN is hypothetically slow.

**Confidence score**: **7.5/10** for one-pass implementation. The tokens + landing rebuild are mechanical; the fumadocs CSS re-skin (Tasks 9–11) is where surprises live — fumadocs's internal selectors aren't a stable API.

---

## Retro

Closed via `/flow:done` on 2026-05-15. Feature shipped in commits `78d9d8f` (re-skin) + `94b4e77` (TOV + dynamic stats + CI guards). Confidence score in hindsight: realistic for the "happy path" but underestimated chrome-detail surface.

**What worked:**
- The `--color-fd-*` override strategy (DDR-011) held — re-skin via tokens + selective MDX renderer overrides, zero fumadocs fork. Cascade conflicts predicted in Risk #3 didn't materialize because mdcc-tokens.css was imported last.
- `sync-mdcc-tokens.mjs` + CI drift guard caught two would-be silent regressions during iteration. Worth replicating for the next "shared canvas → site" handoff.
- Tone-of-voice second pass (`94b4e77`) was the right call — the first pass had marketing voice that drifted from the canvas envelope. Catching it post-build but pre-`/done` was fine; doing it during initial build would have required a critic pass on raw chrome too early.

**What didn't:**
- Three real DS-spec deviations slipped to `/flow:done`: numbered h2 `::before` counter rule selector didn't match the live DOM (`[data-fd-page]`, `article.prose`, `.fd-docs-body` are all wrong), cmd-K dialog ships `backdrop-blur-xs` from fumadocs and our re-skin didn't neutralize it, mobile theme toggle is `0×0` / unreachable. The commit message acknowledged "visual diff + scenario coverage deferred to `/flow:validate`" — but that deferral let chrome bugs ship.
- A11y was an even bigger gap: no focus rings anywhere (fumadocs strips outlines, we never re-add), skip-link element is undefined despite the CSS being present, `--fg-3` on `--bg-0` fails 4.5:1 in both themes. WCAG 2.4.7 + 2.4.1 + 1.4.3 all unaddressed at ship time.
- Pre-existing CI Quality was red since v0.12.0 (`package.json` tabs vs biome's space convention) — went unnoticed for days because nobody ran `pnpm lint` from root locally. Surfaced only during `/flow:done` static gate.
- The `Buy me a coffee` PNG button + `Lucide.Coffee` icon were obvious envelope hard-NO violations (foreign brand asset, no Lucide in chrome) but slipped because they're "nav chrome" not "feature surface" and didn't get a dedicated critic pass.
- `<dt>`/`<dd>` outside `<dl>` in `page-meta-footer.tsx` — invalid HTML. Would have been caught by a stricter MDX/JSX lint or by axe-core if a11y had run live.

**What to change next time:**
1. **Run DS-guard + a11y BEFORE the first feature commit, not at `/done`.** Both agents found real bugs that would have been 1-line CSS fixes in the same session. At `/done` they became a 18-item follow-up plan. Move both to `/execute` step-7 (or to a new `/flow:utils-verify --ui` checkpoint).
2. **Live agent-browser smoke is non-optional for UI features.** The a11y agent failed to start `agent-browser` (`os error 35`) and had to fall back to static-only. Static caught the major issues but missed runtime focus-ring behavior + axe-core auto-rules. Add a "verify agent-browser works" preflight in `/flow:validate`.
3. **CSS counter-rule selectors must be verified against live DOM, not the spec.** The plan's "Task 9 — CSS counter on `.prose h2`" got copied into `global.css` against `[data-fd-page]`/`article.prose`/`.fd-docs-body`, none of which match fumadocs's actual markup. Lesson: when re-skinning a vendored UI library, always grep `node_modules/<lib>/dist` for the actual rendered class/attribute before writing the selector.
4. **`/done` Step 1 lint gate caught a 3-day-old CI breakage.** That's a workflow win — but it shouldn't have been 3 days. Add a `/flow:status` lint signal that surfaces "CI red on main" so it's noticed before the next `/plan`.
5. **Confidence scores are honest only if the risk list covers the actual failure modes.** Plan listed `--fd-*` slot coverage + cmd-K selector stability as risks; both were fine. Real risks were h2 selector match, BMC asset, focus rings, mobile-theme breakpoint. Future plans: bias the risk list toward "what would a critic pass find" (a11y, DS hard-NOs, mobile parity), not just "what could go wrong in the implementation tactic."

**Follow-up plan:** [`feature-docs-site-followups.md`](feature-docs-site-followups.md) — 21 items across 3 commits (DS-spec / WCAG / code-review polish).

**Artifacts:**
- Scenario aggregate: [`.ai/scenarios/docs-site/2026-05-15-0906-aggregate.md`](../scenarios/docs-site/2026-05-15-0906-aggregate.md)
- Code review log: [`.ai/logs/code-reviews/main-docs-site-mdcc-skin.md`](../logs/code-reviews/main-docs-site-mdcc-skin.md)
- 32 scenario screenshots: `.ai/scenarios/docs-site/<scenario>/2026-05-15-0906/<platform>/*.png`
