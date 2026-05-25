---
"@1agh/maude": minor
---

`feat(design)`: bias-free design plugin templates

Strip every visual prior from `plugins/design/templates/` so the discovery flow becomes the only place visual choices are made. Previously the templates smuggled a complete "Linear-ish dark dashboard" opinion into every project that ran `/design:setup-ds`: a 4 px spacing scale, an 8-step type ladder, specific easing curves, OKLCH-only color space as a hard rule, a one-accent rule as a structural ban, a 1200 px max-width, 44 × 44 touch targets (Apple-flavored), Inter font, indigo accent, and a dark slate background — none of which the discovery had asked for.

Three coordinated changes (per [DDR-043](.ai/decisions/DDR-043-bias-free-design-plugin-templates.md)):

- **Templates become true skeletons.** Every hardcoded numeric / curve / hue in `core/colors_and_type.css.tpl`, `README.philosophy.md.tpl`, `SKILL.md.tpl`, `canvas.tsx.template` is now a `{{placeholder}}` fed by the discovery payload. The only hardcoded values that remain are the `prefers-reduced-motion: reduce` 1 ms collapse (a11y) and the token NAME contract.
- **Critic gates become discovery-driven.** `design-system-completeness-critic` C7 (one-accent) and V2 (OKLCH-required) now read `config.accentStrategy` and `config.colorSpace` and gate accordingly. Defaults preserve backwards compatibility: missing fields → `single` + `oklch`. Existing downstream projects keep passing without any config change.
- **`maude design init --no-discovery` defaults are deliberately neutral.** The CLI now emits an achromatic grayscale palette with zero radii, no shadows, system fonts, and a graphite accent — so the output looks obviously unfinished and the designer is nudged toward `/design:setup-ds` instead of unconsciously shipping the default aesthetic. Previously this mode produced a polished-looking dark indigo dashboard that designers kept.

Also cleaned the worst bias injections in 7 inspiration specimens (`logo.html`, `ui_kits-mobile-showcase.html`, `colors-themes-side-by-side.html`, `colors-accent.html`, plus NOTES comments on the presence/team-accent demos clarifying that their hardcoded OKLCH values are illustrative only).

No breaking changes — every existing downstream project's `colors_and_type.css` still parses, the critic still passes with the backwards-compat defaults, and the dev-server / canvas runtime are untouched. Run `/design:setup-ds` to take advantage of the wider design space.
