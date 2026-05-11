---
name: design-system
description: Background design-system knowledge — tokens, type, color, radii, shadows, density, layout constants, and reference HTML specimens. Auto-load whenever generating, reviewing, or migrating UI for this repo. Content lives in the project's design root (default `.design/system/`) — this skill is a pointer.
---

# Design system — pointer skill

This skill is a **thin pointer**. The actual design-system content lives under the project's design root, defined in `<repo>/.design/config.json`:

```
<designRoot>/system/
  └── <project>/
      ├── colors_and_type.css       # tokens (authoritative)
      ├── README.md                 # design philosophy, hard-stops, content rules
      ├── preview/                  # browsable specimen pages
      ├── ui_kits/                  # reference component composers (desktop / mobile)
      └── assets/                   # logos, icons, sport/brand glyphs
```

The split: this `SKILL.md` is metadata that Claude Code auto-loads when relevant; the heavy content (tokens, specimens, ui kits, assets) is tracked as project content under `<designRoot>`.

This skill is non-user-invocable. Auto-loads when Claude is doing design work for the project. The user-facing orchestrator is the sibling `design` skill.

## How to use it

When you're generating, reviewing, or migrating UI:

1. **Resolve `designRoot`** from `.design/config.json` (or fall back to `.design`).
2. **Read the tokens CSS** at `<designRoot>/<tokensCssRel>` (config field, default `system/colors_and_type.css`). These are the only legal colors / fonts / radii / shadows.
3. **Read the project README** at `<designRoot>/system/<project>/README.md` (if present) — it contains the project-specific aesthetic, hard-stop rules, and rationale that override anything generic you'd otherwise default to.
4. **Browse specimens** at `<designRoot>/system/<project>/preview/` — concrete examples of legal swatches, typography pairings, density ladders.
5. **Reference UI kits** at `<designRoot>/system/<project>/ui_kits/{desktop,mobile}/` — idiomatic component compositions to learn the project's patterns.

## What you must never do

- **Never invent tokens.** If a color, font, radius, or shadow isn't in the tokens CSS, ask the user before adding it.
- **Never mix tokens between projects.** Each repo has its own design system; don't copy values from another project's tokens you've seen in a different session.
- **Never silently restyle a canvas to a different aesthetic** — token usage is a hard-stop violation that fails `/design:critic`.

## Companion skills

- `design` — user-facing orchestrator (canvas-first iteration loop)
- `ui-kit` — pointer to project-specific reference surfaces / components
- `frontend-design` (external plugin) — generates new canvas files using these tokens

## Cross-links

- Tokens (authoritative): `<designRoot>/<tokensCssRel>`
- Live specimen browse: dev server at `http://localhost:<port>/<designRoot>/system/...`
- Layout rationale: `<designRoot>/README.md` (if present)
- Per-repo config: `.design/config.json`
