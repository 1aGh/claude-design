# DDR-099: Docs site retargeted from the `project` DS to the `maude` DS ("Studio Docs")

- **Date:** 2026-06-08
- **Status:** Accepted (implemented — `redesign-docs-site-studio-docs.md`, Tasks 1–9 live-verified via axe + agent-browser in both themes)
- **Tags:** site, fumadocs, design-system, tokens, theme-bridge, changelog, roadmap, a11y, dogfooding
- **Related:** [DDR-011](./DDR-011-mdcc-fumadocs-theme-bridge.md) (the `.mdcc` wrapper + fumadocs `.dark` theme bridge this keeps), [DDR-096](./DDR-096-studio-shell-rewritten-in-maude-ds.md) (studio shell → maude; same DS, sibling surface). Plan: [`redesign-docs-site-studio-docs.md`](../plans/redesign-docs-site-studio-docs.md). Canvases: `.design/ui/Studio Docs.tsx` (7 boards) + `.design/ui/Studio Intro Video.tsx` (board A), both maude DS.

## Context

The public docs site (`site/`, Next 16 + Fumadocs 16.9 + Tailwind v4) was themed with the **`project`** DS — warm "stock-paper" light, catalog-stamp **red** accent, hard 0/2/4 radii, mono-everywhere. The product it documents (the canvas browser) had just been rebuilt under the **`maude`** DS (DDR-096): dark-first cool-neutral, ONE indigo accent (hue 268), dotted-canvas backdrop, soft radii, Inter + JetBrains type. The site and the product looked like two different products. Approved `Studio Docs` canvases re-imagine the whole site under maude.

## Decision

Switch the site's **token foundation** to the maude DS and re-skin every surface against the approved canvases — porting finished pixels, not re-deriving design. Five sub-decisions:

### 1. Token bridge — retarget the sync, keep the `.mdcc` wrapper (load-bearing)

`site/app/mdcc-tokens.css` is **generated** from `.design/system/<ds>/colors_and_type.css` by `site/scripts/sync-mdcc-tokens.mjs`. We changed `SRC` from `system/project` → **`system/maude`** (with an optional `--ds=` flag) and added a **selector transform** during sync, because maude scopes tokens differently than the site needs:

| maude scope | → site scope |
| ----------- | ------------ |
| `:root, .maude[data-theme="dark"]` (dark = maude default) | `html.dark.mdcc, html.dark .mdcc` (rides the fumadocs `.dark` toggle — the DDR-011 selector) |
| `.maude[data-theme="light"]` | `:root, .mdcc, .mdcc[data-theme="light"]` (fumadocs default = light) |

We **keep the `.mdcc` wrapper class name** (avoids touching `layout.tsx` + 129 `mdcc-*` rules) and **deleted** the old hardcoded `html.dark.mdcc` project-palette block in `global.css` — the synced file now carries dark. `global.css` keeps only the `--color-fd-*` slot map + a new `.mdcc-canvas` dotted-backdrop helper.

A generated **reconciliation block** (appended by the sync) defines the handful of token NAMES the site's `.mdcc-*` classes consume that maude doesn't (`--mono-cell-*`, `--mono-rule`, `--rule-thin/-strong`, `--space-9`, `--tracking-normal/-sku/-eyebrow`, `--layout-prose`, `--shadow-focus`) and **overrides `--layout-max-w`** (maude = `none`, full-bleed app surface → the docs site wants a centered `1240px`). `--check` compares the **transformed** output, so the `tokens`/`site-content` drift gates stay honest.

### 2. Fonts — Inter / Inter Tight / JetBrains Mono

maude is mono-*first*, not mono-*everywhere*: Inter (body/UI), Inter Tight (display headings), JetBrains Mono (code + numerics). `layout.tsx` loads all three via `next/font/google`; `global.css` binds `--font-body/-display/-mono` to the loader vars (high-specificity rule covering both theme scopes) and switches `body` off the forced Berkeley-Mono stack.

### 3. Theme default — system, both first-class (NOT flipped to dark)

The site **keeps light as the `:root`/fumadocs default** (lower first-paint/SEO risk) and ships dark + light as equal-status themes via the existing toggle, rather than flipping the whole site to dark to match the studio. Both render the full maude palette; users land on system preference.

### 4. Changelog & Roadmap — combined into one `/changelog` timeline

`/roadmap` + `/whats-new` were two thin pages. The canvas (board G) merges them into ONE spine timeline (`changelog-timeline.tsx`, segmented All/Now/Shipped/Next filter + dot legend): **Now** ← roadmap `in-progress` phases (+ current phase), **Shipped** ← `whats-new.json` entries, **Next** ← roadmap `planned` phases. `/whats-new` 308-redirects to `/changelog`; `/roadmap` survives as the full phase archive (linked from the changelog foot, de-nav'd). Both data sources stay generated + read-only.

### 5. New surfaces ported as dependency-free RSCs

`FlowLoop` (board F — the `/flow:*` lifecycle infographic, embedded inline in `flow.mdx` as Figure 1) is a server component with inline thin-stroke icons and `.mdcc-fl-*` CSS ported from the canvas `.sd-*` spec. `IntroVideo` (board A — landing intro-film player) was authored but **not mounted**: the landing keeps the existing `DemoVideo` (`/demo.mp4` loop, maude-reskinned frame) until the 38 s intro film exists (content follow-up); `intro-video.tsx` + its CSS stay for that drop-in. The command-reference generator now emits the source-of-truth section as a `<Callout>`.

### 6. Brand mark + favicon — the spark, per the logo SIGNATURE

`MaudeMark` (`components/mdcc/maude-mark.tsx`) + `app/icon.svg` render the authoritative mark from `.design/system/maude/preview/logo.tsx`: a four-point **spark** star on an indigo **bubble** tile (`border-radius: 24% 24% 0 24%` — bottom-right squared = a message bubble), accent-fg star, in-app accent-tint halo. It replaces the old `project`-DS red-square favicon and adds a real logo to the nav lockup (was wordmark-only). The favicon uses a white star for 16px legibility (halo drops away). NB: the first cut mistakenly used the canvas `BrandMark` caret glyph — corrected to the spark.

## A11y note (resolved during Task 9)

axe (`wcag2a/2aa/21aa`) is clean in **both themes** on landing, docs article, changelog, and command-ref. Two serious findings were fixed: accent-only links (`.mdcc-eyebrow a`, `.mdcc-tl-foot a`) got underlines (WCAG 1.4.1), and the redundant unlabeled fumadocs GitHub **icon** (`baseOptions().githubUrl` → unlabeled `role="img"` svg) was dropped in favour of the existing "Source" text link.

## Consequences

- One `SRC` change in `sync-mdcc-tokens.mjs` flips the entire site palette/type/radius/spacing foundation. Future DS swaps are `--ds=<name>` + re-run.
- The synced `mdcc-tokens.css` is authoritative for dark; never hand-edit it (generated banner enforces).
- Mobile visual parity across the 5 scenario platforms is verified at `/done` (scenario-runner), not in this pass — agent-browser viewport resize was unavailable in the execution session; desktop showed no horizontal overflow and per-component mobile breakpoints are authored.
- The landing keeps `DemoVideo` (the existing `/demo.mp4` loop) in its maude-reskinned frame; `IntroVideo` is authored but unmounted, awaiting the intro film.
