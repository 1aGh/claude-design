# {{project_label}} — Design System

> **Philosophy layer.** This file documents the *why* and *what* of the design system. The *how* (tokens, specimens) lives in `colors_and_type.css` and the `preview/` directory.

## Purpose

{{purpose_one_liner}}

## Audience profile

- **Primary user:** {{audience_summary}}
- **Platforms:** {{platforms_summary}}
- **Default theme:** {{theme_default}}
- **Content tone:** {{content_tone}}

## Mood references

{{mood_references_block}}

## Foundations

### Token contract

All visuals reference `var(--*)` tokens declared in `colors_and_type.css`. Adding a new visual concept means **extending the tokens CSS first**, never inventing values inline in a canvas.

{{color_space_block}}

### Accent strategy

{{accent_rules_block}}

### Active token families

{{active_families_block}}

## Hard rules (non-negotiable)

- **Accessibility:** WCAG 2.1 AA contrast at every theme. Focus-visible always rendered. `prefers-reduced-motion: reduce` respected.
- **Touch targets:** {{touch_target_rule}}
- **No off-token values** in canvases. Extend tokens; don't inline.
- **No placeholder copy.** Real product strings only — no "Lorem Solutions Inc.", no "Click here".
- **Type ladder:** {{type_scale_summary}}
- **Motion:** every animation uses a `var(--dur-*)` and `var(--ease-*)` token. No magic numbers.

{{platform_hard_rules}}

## Voice & tone

{{voice_tone_block}}

## Iconography

{{iconography_summary}}

## Hard-stops the completeness-critic enforces

- Core tokens present (`--accent`, `--bg-0..4`, `--fg-0..3`, `--dur-flip`)
- Accent family count matches the declared strategy ({{accent_strategy_summary}})
- Color space matches the declared choice ({{color_space_summary}})
- `system/{{ds_dirname}}/preview/` populated with at least 8 specimens
- `colors_and_type.css` linked from every specimen
- `prefers-reduced-motion: reduce` guard present in tokens CSS

See `plugins/design/agents/design-system-completeness-critic.md` for the full rule set.

## Where things live

- **Tokens:** `colors_and_type.css` (this directory)
- **Specimens:** `preview/` (one HTML file per token family / component class)
- **UI kits:** `ui_kits/<platform>/` (reference compositions for {{platforms_summary}})
- **Brand assets:** `assets/logos/`, `assets/glyphs/`

## How to extend

1. Identify the missing concept (new component, new state, new platform).
2. **Extend `colors_and_type.css`** with any new tokens needed.
3. **Add a specimen** under `preview/` with a SPECIMEN comment header so future agents learn from it.
4. Run `/design:critic --system-only` to confirm completeness.
5. Commit.

Never extend the system by inventing values inline in a canvas — that's how systems decay.
