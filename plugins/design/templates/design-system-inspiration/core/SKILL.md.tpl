---
name: {{ds_skill_name}}
description: "Loads the {{project_label}} design system context — tokens, philosophy, hard-stops — so any agent iterating on a canvas under this project respects the system. Auto-invoked by /design:edit and /design:new when the active canvas declares this DS via .meta.json.designSystem (or when this is the single DS)."
user-invocable: false
---

# {{ds_skill_name}} — design system context

Loads the project's design system into the agent's working memory:

- **Tokens** — `colors_and_type.css` (the source of truth for color, type, spacing, motion, radii)
- **Philosophy** — `README.md` (the *why* — audience, mood, voice, hard rules)
- **Hard-stops** — non-negotiable constraints the design-system-completeness-critic enforces
- **Active token families** — `{{active_families_csv}}`

## When this skill loads

This skill is loaded automatically when:

- The active canvas's `.meta.json` declares `designSystem: "{{ds_dirname}}"`
- OR the project has a single DS (single-DS layout: `system/project/`) and the active canvas has no explicit DS declaration

It is **not** auto-invoked by `/design:edit` or `/design:new` on a project with no DS yet — that path triggers skill `design-system` in bootstrap mode instead. See `plugins/design/skills/design-system/SKILL.md` "Mode-detection".

## What the agent should remember

- **Accent strategy:** {{accent_strategy_summary}}. {{accent_rules_summary}}
- **All visuals reference `var(--*)` tokens.** No off-token values in canvases.
- **Color space:** {{color_space_summary}}.
- **Voice:** {{voice_tone_summary}}
- **Iconography:** {{iconography_summary}}
- **Theme default:** `{{theme_default}}`. {{theme_extra}}
- **Platforms:** {{platforms_summary}}

## Hard rules (verbatim from README.md)

{{hard_rules_block}}

## Files of interest

| Path | Role |
|---|---|
| `colors_and_type.css` | Authoritative tokens |
| `README.md` | Philosophy + hard rules |
| `preview/` | Specimens — read these to understand what good looks like |
| `assets/logos/`, `assets/glyphs/` | Brand assets |
| `ui_kits/{{platforms_first}}/` | Reference UI compositions |

## How to extend

If a canvas iteration needs a value not currently in the system, **extend `colors_and_type.css` first**. Adding a new variant of an existing token (e.g. `--accent-tertiary`) is fine. Adding a parallel accent family (e.g. `--accent2`) is only allowed if the project's declared `accentStrategy` in `config.json` permits it (e.g. `paired` or `chromatic-N`) — the completeness-critic enforces the declared strategy.
