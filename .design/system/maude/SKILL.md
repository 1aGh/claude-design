---
name: maude-design
description: Read-context for the maude "Unified Pro Studio" design system — dark-first cool-neutral chrome with one indigo accent, a dotted canvas, and one shared panel material. Load before iterating on any maude specimen or canvas.
user-invocable: false
---

# maude — design-system skill (READ pointer)

Authoritative context for any agent iterating on a **maude** specimen or canvas.
Full philosophy + hard rules: [`README.md`](./README.md). Tokens: [`colors_and_type.css`](./colors_and_type.css).

## Load-bearing rules (do not violate)

1. **One accent, one job per surface.** `--accent` (indigo 268) marks the primary action,
   the current selection, OR the active tab — exactly one of those per region. Never a
   decorative fill. See `preview/colors-accent.tsx` for good/wrong.
2. **One material across all chrome.** Panels, toolbars, inspectors, layer trees use the
   classes in `preview/_components.css` (`.panel`, `.toolbar`, `.inspector`, `.tree-row`,
   `.btn`, `.input`, `.seg`, `.field`). Don't re-implement anatomy — lift these.
3. **The dotted canvas is the signature surface.** Use `.canvas` for full-strength canvas
   demonstrations; the body already carries a faint ambient dot-grid.
4. **Mono is first-class.** `--font-mono` (tabular) for part-numbers, coordinates, fields,
   numerics. Part-number eyebrows are `MAUDE/<slug>`.
5. **Hard NOs:** no decorative gradient backdrops · no emoji in chrome (1px stroke SVG
   glyphs only) · chrome must not out-shout the canvas · tokens only (no off-ladder type px).
6. **Dark is default**, light is equal-status. Every value is a token so the theme retints.
7. **Voice:** terse, precise, quietly confident; real domain nouns only (canvas, artboard,
   frame, node, inspector, layers, iterate, agent, hand off) — never Lorem / "Get Started".

## Specimen shape

Bare flowing pages (NOT canvas-lib): `import "../colors_and_type.css"; import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls"; import "./<slug>.css";` then
`<header className="specimen-hd">…</header><main className="specimen">…</main>`.
