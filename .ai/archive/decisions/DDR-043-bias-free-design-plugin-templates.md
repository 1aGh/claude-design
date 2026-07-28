# DDR-043 — Bias-free design plugin templates

**Status:** Accepted — 2026-05-25.
**Supersedes:** none.
**Related:** [DDR-033](DDR-033-three-stage-discovery.md) (three-stage discovery — visual decisions are discovery-driven, not template-baked).

## Context

`plugins/design/templates/` claimed to be a "skeleton" but smuggled a complete visual opinion into every project that ran `/design:setup-ds`:

- **4 px-base spacing scale**, 8 fixed steps (4/8/12/16/24/32/48/64), hardcoded in `core/colors_and_type.css.tpl:67-74`.
- **8-step type ladder** with fixed sizes 12 → 36 px and line-heights, `core/colors_and_type.css.tpl:82-89`.
- **Two specific easing curves** (`cubic-bezier(0.22, 1, 0.36, 1)` + `cubic-bezier(0.65, 0, 0.35, 1)`), `core/colors_and_type.css.tpl:96-97`.
- **1200 px layout max-width**, `core/colors_and_type.css.tpl:100`.
- **OKLCH-only** color space, declared as a universal rule in the template preamble.
- **"One-accent rule"** baked in as a structural hard-stop (`--accent2` was banned) — `core/README.philosophy.md.tpl:22-24`, completeness-critic C7.
- **Apple-flavored 44 × 44 touch target** universally enforced (Material says 48 dp).
- **MDCC class names** (`.btn`, `.tile`, `.sku`, `.seg`) and `mdcc` root class hardcoded in `canvas.tsx.template` — a legacy from the rename pre-v0.15.0.
- **`cli/commands/design.mjs` `defaultPayload()`** returning a dark slate (`oklch(16% 0.012 245)`) + indigo accent (`oklch(64% 0.18 264)`) + Inter font + 140/220 ms motion. The `--no-discovery` mode produced a Linear-ish SaaS dashboard regardless of project.
- **62 inspiration specimens** included some hardcoded `#hex` / `rgb()` / `oklch(...)` values outside `_layout.css`, especially in `theme-both/colors-themes-side-by-side.html`, `platform-mobile/ui_kits-mobile-showcase.html`, `universal/logo.html`, and presence specimens.

Net effect: every new design system inherited the "Linear-ish dark dashboard" prior before discovery had even asked the user what they wanted. Non-dashboard products (consumer apps, editorial, brutalist marketing, retro revival) had to fight the templates to land somewhere else.

## Decision

Strip every visual prior from `plugins/design/templates/` so the discovery flow becomes the only place visual choices are made. Three coordinated changes:

1. **Templates become true skeletons.** Every hardcoded numeric / curve / hue value in `core/colors_and_type.css.tpl`, `README.philosophy.md.tpl`, `SKILL.md.tpl`, `canvas.tsx.template` becomes a `{{placeholder}}` fed by the discovery payload. The only hardcoded values that remain are the `prefers-reduced-motion: reduce` 1 ms collapse (a11y, not bias) and the token NAME contract (`--bg-0..4`, `--fg-0..3`, `--accent*`, etc.).

2. **Critic gates become discovery-driven.** `design-system-completeness-critic` C7 (one-accent) and V2 (OKLCH-required) now read `config.accentStrategy` and `config.colorSpace` and gate accordingly. Defaults preserve backwards compatibility: missing fields → `single` + `oklch`.

3. **CLI `--no-discovery` defaults become deliberately neutral.** The `defaultPayload()` in `cli/commands/design.mjs` now emits an achromatic grayscale palette with zero radii, no shadows, system fonts, and a neutral graphite accent. The intent is for the output to **look unfinished** so the designer is nudged toward `/design:setup-ds` instead of shipping the default.

## Decision table

| Dimension | Before | After |
|---|---|---|
| Spacing base + scale | 4 px / 8 fixed | discovery `space_1..space_8` (whole-value placeholders) |
| Type base + ratio | 14 px / implicit 1.16 | discovery `type_xs..type_3xl`, `lh_xs..lh_3xl` (whole-value); agent computes from `type_base_px` × `type_ratio` |
| Easing curves | `0.22, 1, 0.36, 1` etc. | discovery `ease_out_curve`, `ease_in_out_curve` |
| Max layout width | 1200 px | discovery `layout_max_w` |
| Shadows | hardcoded oklch alphas | discovery `shadow_sm/md/lg` (full values) |
| Status hues | fixed OKLCH | discovery `status_success/warn/error/info` (full values) |
| Border offsets | OKLCH `+0.04/+0.08/+0.14` | discovery `border_subtle/default/strong` (full values) + `border_strategy` |
| Accent strategy | one-only (hard-stop) | discovery `accent_strategy` (`single` / `paired` / `chromatic-N`) → config.json → critic gate |
| Color space | OKLCH-only (preamble) | discovery `color_space` (`oklch` / `hsl` / `hex` / `lab`) → config.json → critic gate |
| Touch target | 44 universally | derived from primary platform (iOS=44, Android=48, desktop = N/A) |
| Root class | `mdcc` | discovery `root_class`; default `app` |
| Reduced-motion | 1 ms | KEEP — a11y, not bias |

## Soft-gate behavior

- **C7 (accent strategy)**: `config.accentStrategy` defaults to `single`. Critic counts `--accent*` families and asserts the count matches the declared strategy. With `single` (the default), behavior is identical to the old hard-stop; `paired` allows 2; `chromatic-N` allows N (1 ≤ N ≤ 12).
- **V2 (color space)**: `config.colorSpace` defaults to `oklch`. Critic checks the tokens CSS contains ≥ 1 reference in the declared color space.

Backwards compatibility: any project that ran `/design:setup-ds` before this DDR still passes its completeness audit — the defaults preserve the previous universal rules.

## Why "deliberately ugly" defaults in `--no-discovery`

Previously the CLI's `--no-discovery` mode produced a project that visually shipped Linear-flavored SaaS aesthetics. Users who wanted a quick start kept those defaults. The defaults then became invisible — designers stopped questioning them because they "looked fine".

Making the defaults look obviously unfinished (gray on gray, square corners, no shadows, system font) restores the prompt: "this is a placeholder, run discovery to produce a real DS". The 30 seconds of friction is worth the elimination of unconscious aesthetic conformity.

## Forward-pointing extensions (NOT in this change)

- **Stage 3 question expansion.** Today the agent infers `accent_strategy`, `color_space`, `spacing_base`, `type_ratio` from the existing Q1–Q12 batch. A future change will add explicit follow-up Qs when the inference confidence is below 0.85 — `ux-research-agent.md` already declares these as `recommendations.*` fields, Stage 3 just needs to read them.
- **Specimens neutralization phase 2.** This DDR neutralized the clear bias injections (hardcoded `#ffffff`, `oklch(8%...)` body bgs, side-by-side theme demos). A follow-up pass through the 62 specimens to remove demonstration-only hardcoded OKLCH cursor colors etc. is welcome but not required — those values are accompanied by NOTES comments explaining they're illustrative.
- **DDR-009 / Bun runtime.** Unaffected. This DDR touches templates + skill + critic + CLI — no dev-server code.

## Files changed

- `plugins/design/templates/design-system-inspiration/core/colors_and_type.css.tpl` — full skeletonization
- `plugins/design/templates/design-system-inspiration/core/README.philosophy.md.tpl` — drop "one-accent rule" + "44 × 44" as universal
- `plugins/design/templates/design-system-inspiration/core/SKILL.md.tpl` — drop universal rules
- `plugins/design/templates/design-system-inspiration/core/config.json.tpl` — add `accentStrategy` + `colorSpace`
- `plugins/design/templates/canvas.tsx.template` — drop `.btn/.tile/.sku/.seg/mdcc` literals
- `plugins/design/templates/design-system-inspiration/universal/logo.html` — `#ffffff` → tokens
- `plugins/design/templates/design-system-inspiration/platform-mobile/ui_kits-mobile-showcase.html` — `oklch(8% ...)` → `var(--bg-0)`
- `plugins/design/templates/design-system-inspiration/theme-both/colors-themes-side-by-side.html` — inline OKLCH → `var(--*)` (themes resolved via cascade)
- `plugins/design/templates/design-system-inspiration/meta/presence-multiplayer.html` + `audience-pro/colors-presence.html` + `platform-desktop/ui_kits-desktop-showcase.html` — NOTES comments explaining demo OKLCH values are illustrative
- `plugins/design/agents/design-system-completeness-critic.md` — soft-gate C7 + V2 via config
- `plugins/design/agents/ux-research-agent.md` — extend `recommendations[]` with structural decisions
- `plugins/design/skills/design-system/SKILL.md` — extend discovery payload with new placeholder fields
- `cli/commands/design.mjs` — neutral defaults + new placeholder keys

## Follow-ups

- [DDR-048](DDR-048-dev-server-system-view-no-shell-bias.md) — extends bias-free into the dev-server runtime: the System view (MDCC-DSN/01) now renders user tokens regardless of naming convention, instead of leaking the Maude chrome theme through hardcoded `--bg-0..4 / --fg-0..3 / --accent*` reads against `document.documentElement`.

## What this DDR does not change

- Token NAMES (`--bg-0`, `--accent`, `--dur-flip`, etc.) — these remain the canonical contract.
- `prefers-reduced-motion: reduce` collapse to 1 ms — a11y invariant.
- The shape of `/design:setup-ds` (Stages 0–3, ux-research-agent in discovery mode) — only payload + scaffolding changed.
- The 62 inspiration specimens stay; only clear bias injections in them were fixed.
