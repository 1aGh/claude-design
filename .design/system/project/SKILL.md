---
name: md-claude-design
description: Per-DS rules for the md-claude design system (MDCC-DSN/01). Industrial-catalogue mood, Paper & Ink palette with one amber-rust accent, Berkeley-forward mono-everywhere typography, hard-edges signature (1px hairlines + part-number SKU framing). Voice = htmx-style irreverent developer over a U.S. Graphics catalog spine. Read first when iterating on any canvas declaring `designSystem: project`.
user-invocable: false
---

# md-claude DS. Terse load-bearing rules

Authoritative source for everything: `system/project/README.md` (philosophy + voice + hard rules). This file is the cheat-sheet agents load before every edit / specimen write. The things that are easy to forget under attention pressure.

## Tokens. Only var(--*) values

Authoritative file: `system/project/colors_and_type.css`. Every chromatic / dimensional value in any specimen MUST be a `var(--...)` reference. No hex outside that file. No `px` outside the token ladder. No `rem` (the system uses `px` consistently for the mono grid).

- Surfaces: `--bg-0` (page) → `--bg-4` (pressed). Same names in both themes.
- Ink: `--fg-0` (primary) → `--fg-3` (disabled).
- Accent: `--accent` / `--accent-hover` / `--accent-active` / `--accent-fg` / `--accent-tint`. **One family.** Never invent `--accent2`.
- Status (always-on): `--status-success` / `--status-warn` / `--status-error` / `--status-info`.
- Mono helpers (always-on for this DS): `--mono-cell-bg` / `--mono-cell-fg` / `--mono-rule`.
- Spacing: `--space-0` (0) → `--space-9` (64px). Base = 4px.
- Type ladder: `--type-xs` (11px) → `--type-3xl` (40px) with matching `--lh-*`.
- Tracking: `--tracking-tight` / `--tracking-normal` / `--tracking-wide` / `--tracking-sku` (0.12em, the catalog SKU letterspacing) / `--tracking-eyebrow` (0.18em).

## Typography. Berkeley everywhere

`--font-display`, `--font-body`, `--font-mono` all resolve to the same Berkeley Mono stack. Do NOT swap to a humanist sans. If the result feels claustrophobic, increase `line-height` or use `--tracking-wide`. Never reach for `Inter`.

H1 = `--type-3xl` mono with `tracking-tight`. H2 = mono ALL CAPS at `--type-xs` with `tracking-sku`, prefixed by a numeric SKU via `data-no` (e.g. `<h2 data-no="01">When to use</h2>`). H3 = mono at `--type-sm` regular case.

## Signature treatment. SKU framing + 1px rules (hard-edges family)

Every specimen wears the chrome from `preview/_layout.css`:
- `.specimen-hd` part-number bar at the top (`MDCC-DSN/01` + breadcrumb + theme toggle)
- `.specimen-meta` 1px-bounded definition list (published / family / accent / density)
- `.specimen h2` is numbered (`data-no="01"`) and underlined with `--rule-strong`
- `.specimen-ft` colophon at the bottom with 1px top border

In specimen content, lean on:
- `.sku` (small catalog-stamp label) for plugin / canvas / part references
- `.tile` (catalog product card with `.tile-hd` / `.tile-bd` / `.tile-ft`) for plugin-like grids
- `.grid` with overlapping 1px borders for swatch / specimen grids

NO drop-shadows. NO border-radius > 4px. NO backdrop-blur. Depth = type weight + bg-shift between `--bg-1` and `--bg-2` + 1px hairlines.

## Iconography. ASCII / Unicode glyphs

Family: `industry-specific`. Use Unicode glyphs inline with mono text first:

```
▸ ▹ ▾ ▴   tree disclosure
● ○       on / off bullets
■ □       checkbox-like markers
→ ← ↑ ↓   directional
✓ ✗       success / error in copy
·         separator dot
─ │ ┌─┐ └─┘ ├ ┤ ┬ ┴ ┼   box-drawing for tree-views and diagrams
```

Custom SVG glyphs live in `assets/glyphs/<name>.svg` at 16×16 with 1px stroke (matched to mono baseline). Domain nouns get their own glyph file: `plugin.svg`, `canvas.svg`, `slash-command.svg`, `file-tree.svg`. New nouns added in any specimen → add the glyph in the same change. `preview/iconography.html` is the index.

NO emoji in chrome. ✋ in markdown is fine; `🚀` in a button label is a critic warning.

## Density. Balanced docs-page

Base padding lives on `--space-3` / `--space-4` (8 / 12px). Buttons = `padding: var(--space-3) var(--space-5)`. Cards = `padding: var(--space-5)`. Tile-hd = `padding: var(--space-3) var(--space-4)`. Tables = `td { padding: var(--space-2) var(--space-3); }` (compact).

Prose runs to `--layout-prose` (72ch). Layout-max-width = `--layout-max-w` (1240px). Dev-server-canvas surfaces tighten to `auto-fill minmax(220px, 1fr)` tile grids.

## Voice

Bear-Blog school dry-grin on a U.S. Graphics catalog spine. Catalog stamps and hairlines stay; the prose is signed by a person.

**Three highest-leverage rules:**

1. **Load-bearing parenthetical.** Sentence carries the fact, parens carry the warmth. `Booting. (Usually about 800ms.)`
2. **Magic-admitted-as-magic.** Concede emergent behaviour modestly, as a fact. Once per surface. `An agentic loop that ships things eventually.`
3. **Generative stacking, not corrective.** Frame the offer as "X & Y". `Plugins & Vibes.` not `Plugins, not vibes.`

**Cold-start register sample:**

```
hero    · A Claude Code marketplace. Two plugins, one CLI, some vibes.
empty   · Nothing installed yet. Which is fine, you just got here.
error   · Generation failed. Falling back to direct mode. No silent downgrade.
loading · Booting. (Usually about 800ms.)
tooltip · Scaffolds a docs site. (Yes, this one too.)
```

**Smells like try-hard if...**

- the copy contains `—` (em dash) or `–` (en dash) anywhere in prose. Period, comma, or paren. Pick one.
- the copy contains `…` (ellipsis character) or curly quotes (`"` `"` `'` `'`). Use three periods and straight quotes.
- you wrote `we`, `our`, `let's`, or `together`
- you wrote `!` after anything that isn't works / fired / shipped / boots / saved-first-time
- you wrote `I` outside the bio, footer signature, README opener, or a deprecation notice
- the headline shape is "X, not Y" (use generative stacking)
- the headline contains a time-promise ("in N minutes")
- the magic-admitted card fires twice on the same page
- a pun lands more than once per surface
- there's an emoji anywhere in DS chrome

Full doctrine at `system/project/README.md` "Voice" section. Read it when writing copy for a new surface class.

## Hard NOs (critic blockers)

From `README.md` "Hard rules" section. Quick reference:
- Blocker: frosted-blur / glassmorphism (any `backdrop-filter` use)
- Blocker: drop-shadows on chrome (any `box-shadow` outside `--shadow-focus`)
- Blocker: animations beyond hover + reduced-motion-safe tooltip fades
- Blocker: AI-launch gradient (`linear-gradient` on hero / chrome. Gradients are data-viz only)
- Warning: `border-radius` > 4px
- Warning: magic-verbs (`reimagine`, `supercharge`, `unlock`, `effortless`, `magical`)
- Warning: emoji in DS chrome
- Copy blocker: stock-photo hero

## What changes between themes

Light theme (paper) is default; dark theme (phosphor) is equal-status. Switching themes:
- Surfaces invert (cream → phosphor)
- Ink inverts (near-black warm → cream warm)
- Accent shifts L higher in dark (56% → 72%) to maintain readability on dark canvas
- Borders stay 1px hairlines but shift to the appropriate L for visibility
- **Identity does NOT change.** Same SKU framing, same hairlines, same mono. Themes are surfaces; brand is the rest.

If a canvas only renders well in one theme, it's broken. Write it to work in both, or escalate to the user that the canvas is theme-specific (rare).

## Cross-refs

- DS philosophy + voice + rules (long form): `system/project/README.md`
- Tokens: `system/project/colors_and_type.css`
- Chrome: `system/project/preview/_layout.css`
- Component anatomy: `system/project/preview/_components.css`
- Round 0 research payload: `_history/_system/project-df4b0d27-domain-research-discovery.json`
- Scaffold roster: `_history/_system/project-000-scaffold-roster.yaml`
