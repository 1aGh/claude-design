---
name: studio-design
description: "Loads the studio design system context — tokens, philosophy, hard-stops — so any agent iterating on a canvas in md-claude respects the system. Auto-invoked by /design:edit and /design:new when the active canvas declares this DS via .meta.json.designSystem (or when this is the single DS)."
user-invocable: false
---

# studio-design — design system context

Loads md-claude's design system into the agent's working memory:

- **Tokens** — `colors_and_type.css` (color, type, spacing, motion, radii; the source of truth)
- **Philosophy** — `README.md` (the *why* — audience, mood, voice, hard rules)
- **Hard-stops** — what the design-system-completeness-critic enforces
- **Active token families** — `accent, status, presence, mono, brand`

## When this skill loads

Auto-loaded when:

- The active canvas's `.meta.json` declares `designSystem: "studio"`
- OR md-claude has a single DS (single-DS layout: `system/studio/`) and the active canvas has no explicit DS declaration

It is **not** auto-invoked on a project with no DS yet — that triggers skill `design-system` in bootstrap mode instead.

## What the agent should remember

- **Two-tier accent.** `--accent` = plasma violet — components only (buttons, links, focus rings, sidebar-active, status accent text). `--brand-amber` = marketing spotlight — docs hero, signature-moment art, brand banner, the mark inset. Never mix. If a button wants amber, it's a signal it should use plasma.
- **All visuals reference `var(--*)` tokens.** No hardcoded hex / px / rem in canvases.
- **Mono is a display surface.** Geist Mono in status bars, file paths, version labels, port numbers, hero metadata. Not body text styled mono.
- **Voice:** warm hacker. Direct, opinionated, occasionally dry. Empty states name what's missing. Marketing copy may have personality; dev-server copy is terse.
- **Iconography:** lucide at 1px stroke, rounded caps. No emoji in dev-server chrome.
- **Theme default:** `dark`. There is no light variant.
- **Platforms:** desktop only (≥ 1280px). Dev-server chrome is mono; docs body is sans.

## Hard rules (verbatim from README.md)

- WCAG 2.1 AA contrast. Focus-visible always rendered (`--ring`). Touch targets ≥ 44×44. `prefers-reduced-motion: reduce` collapses motion to 1ms.
- No off-token colors / radii / spacings.
- No placeholder copy.
- Type ladder: 8 steps + one `--type-display` for hero only.
- Motion: every animation uses `--dur-*` and `--ease-*`. No magic numbers.
- The plasma–amber split is policy: amber inside `components-*.html` is a violation.

## Files of interest

| Path | Role |
|---|---|
| `colors_and_type.css` | Authoritative tokens |
| `README.md` | Philosophy + hard rules |
| `preview/` | Specimens (flat layout; read these to understand what good looks like) |
| `preview/ui_kits-desktop-showcase.html` | THE canonical "DS in use" composition — read first |
| `preview/colors-accent.html` | Plasma accent + amber spotlight policy demonstration |
| `assets/logos/`, `assets/glyphs/` | Brand assets |

## How to extend

If a canvas iteration needs a value not in the system, **extend `colors_and_type.css` first**. Adding a new variant of an existing token (e.g. `--accent-tertiary`) is fine; adding `--accent2` violates the one-family rule and the completeness-critic blocks. Adding `--brand-plum` (a second brand spotlight) is fine in principle — just keep it out of `components-*.html`.
