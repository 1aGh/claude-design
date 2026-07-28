# DDR-011: Re-skin fumadocs via `--color-fd-*` overrides; do NOT fork

**Status:** Accepted
**Date:** 2026-05-15
**Tags:** site/docs/fumadocs/design-system/theming/css-tokens/upgrade-burden
**Supersedes:** —
**Superseded by:** —
**Plan:** [.ai/plans/feature-docs-site-mdcc-skin.md](../plans/feature-docs-site-mdcc-skin.md)

## Decision

We re-skin fumadocs-ui (16.8.10) to the MDCC-DSN/01 visual identity by:

1. **Overriding fumadocs's CSS variables** (`--color-fd-background`, `--color-fd-foreground`, `--color-fd-border`, `--color-fd-primary`, `--color-fd-accent`, `--color-fd-popover`, `--color-fd-card`, `--color-fd-ring`, `--color-fd-muted{,-foreground}`, `--color-fd-secondary{,-foreground}`, `--color-fd-accent-foreground`, `--color-fd-overlay`) — mapped to MDCC tokens (`--bg-*`, `--fg-*`, `--accent`, `--accent-tint`, `--border-*`) under `:root`.
2. **Targeting fumadocs's internal class/data-attribute selectors with CSS** (`#nd-sidebar`, `[data-toc]`, `[data-fd-page]`, `[role="dialog"][data-fd-search]`, etc.) for chrome that doesn't fall out of token mapping alone — sidebar headers, active page rule, prev/next pager border, cmd-K palette.
3. **Overriding MDX renderers** via `getMDXComponents({ pre: CodeBlock, Callout })` for the two surfaces that need component-level chrome (filename strip + copy button, iconed ASCII-glyph callouts).
4. **Keeping all fumadocs behavior unchanged** — Orama search, MarkdownCopyButton, ViewOptionsPopover, MDX pipeline, sidebar tree, theme toggle, prev/next, TOC.

We do **not** fork `fumadocs-ui` or shadow-copy any of its components into `site/components/`.

## Context

The redesign captured in `.design/ui/Docs Site.html` (4 artboards: Landing, Docs Index, Docs Article, Cmd-K) needs a production path into `site/`. fumadocs ships a neutral default theme and a single centered hero — neither matches the MDCC industrial-catalog identity.

Three implementation paths were on the table:

| Path | Effort | Upgrade burden | Behavioral risk |
| --- | --- | --- | --- |
| **A.** Override `--color-fd-*` tokens + select CSS + MDX components (this DDR) | Low | Low | Low |
| **B.** Fork fumadocs into a vendored `site/lib/fumadocs/` and edit JSX | High | Very high — every fumadocs upgrade is a manual rebase | Medium (behaviors stay intact in theory; in practice they drift) |
| **C.** Replace fumadocs with a hand-rolled docs surface | Very high | None (we own it) | High — Orama search, MDX shiki pipeline, llms.txt, OG images all need re-implementation |

## Rationale

- **fumadocs is itself a re-skinnable preset.** The neutral.css/preset.css contract is explicit: theme via `--color-fd-*` slots. The fact that fumadocs ships *six* preset themes (aspen, black, catppuccin, dusk, emerald, ocean, purple, ruby, shadcn, solar, vitepress, neutral) is the proof point that re-skinning is the supported extension surface.
- **Behavior is what we'd lose if we forked.** Search, MDX, prev/next, TOC, sidebar tree — all are *fumadocs's actual product*. We pay nothing to keep them; we pay a lot to recreate them.
- **MDX renderer override is fumadocs's documented extension point.** `getMDXComponents` is built for exactly this — replace `pre` for code blocks, replace `Callout`, keep the rest.
- **The DS hard-NOs (no emoji, no shadows, no gradients, no blur, no Lucide in sidebar) are CSS-shaped problems**, not JSX problems. Hiding Lucide icons in the sidebar = one `display: none` rule. No JSX edits needed.

## Trade-offs (the cost we accept)

- **Tight coupling to fumadocs's CSS variable contract.** If fumadocs renames `--color-fd-popover` to `--color-fd-surface-1` in 17.x, our bridge breaks until we re-map. Mitigated by pinning to a known version (`16.8.10`) and treating fumadocs upgrades as a touch-point that runs visual regression.
- **Selector brittleness for chrome that token-maps don't cover** — sidebar active-row CSS targets `[data-active="true"]` on `#nd-sidebar` items, cmd-K targets `[data-fd-search]` / `[role="dialog"]`. These are internal selectors, not public API. Mitigated by: (a) the design-system-guard scenario screenshots catch regressions on every PR, (b) `flow:scenario-runner` re-screenshots after fumadocs upgrades, (c) the entire selector list lives in one file (`site/app/global.css`) so audit is cheap.
- **The MDCC dark-mode bridge needs a specificity workaround.** `mdcc-tokens.css` declares dark tokens under `.mdcc[data-theme="dark"]` (specificity `0,2,0`); fumadocs's theme toggle flips `html.dark` (selector `0,1,1`). We compensate with `html.dark.mdcc` in `site/app/global.css` (`0,2,1`) to win the cascade. Documented inline at the rule.

## Consequences

- **`site/app/mdcc-tokens.css` is a synced copy of `.design/system/project/colors_and_type.css`.** `site/scripts/sync-mdcc-tokens.mjs` keeps the two in lock-step; `pnpm sync:tokens:check` reports drift in CI. The `.design/` file remains authoritative — never edit `mdcc-tokens.css` directly.
- **JetBrains Mono ships by default** via `next/font/google` (variable `--font-mdcc-mono`). Berkeley Mono / TX-02 stay first in the `--font-mono` chain for users who self-host them.
- **The MDX renderer override list is small on purpose** — `pre` and `Callout` only. New renderers (e.g. `<NumberedH2>`, the docs-page `<SkuBreadcrumb>`) live in `site/components/mdcc/` and get composed in the docs page wrapper, not in `getMDXComponents`. CSS counters do `01 ·` numbering without touching MDX.
- **Cmd-K type-specific glyphs are NOT implemented.** fumadocs 16.8.10's Orama dialog doesn't expose a "result type" attribute we can target. We render a uniform `▸` glyph for all results via `[data-result]::before`. Type-specific glyphs (▸ command / ● plugin / ○ skill) require either a fumadocs API surface that doesn't yet exist, or shadow-rendering the dialog ourselves — both are deferred.
- **DDR-005** (Fumadocs + Vercel + accept DS defaults) stands; this DDR refines that decision's "accept DS defaults" into "accept the platform; override the visuals via the supported extension surface."

## What this DDR does NOT decide

- Whether to upgrade fumadocs majors (each upgrade is its own decision driven by behavior need).
- Whether to ship a Tailwind-utility-based wrapper around MDCC tokens (kept open — for now MDCC chrome is hand-rolled CSS).
- Whether to vendor JetBrains Mono (kept on Google Fonts via `next/font` for ergonomics; revisit if a privacy/network constraint emerges).
