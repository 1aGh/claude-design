# Mapping — discovery answer → scaffold file set

> The contract for skill `design-system` (bootstrap mode). Computes which specimens land in `<designRoot>/system/<ds>/preview/` based on the 8 discovery answers + computed `activeFamilies[]`.
>
> **Library state (2026-05-13):** 67 reference HTML specimens across 11 category dirs. Earlier copies of this mapping described the conditional dirs as "filled in follow-up phases" — that's no longer true; they're populated and the bootstrap flow MUST honor them.

## Library layout (where to find what)

| Dir | Role | Files | Gate for scaffold |
|---|---|---|---|
| `core/` | Always-on tokens + 10 baseline previews + `_layout.css` chrome | 10 + 6 .tpl | always |
| `universal/` | Always-on cross-cutting components (toggles, dialogs, tooltips, tables, callout, empty-state, logo) | 7 | always (mostly) |
| `foundations/` | Token-foundation specimens beyond core (borders, elevation, focus, grid, iconography, opacity, radii, selection) | 8 | always-on for any non-`minimal` profile |
| `status/` | Status-family specimens (colors-status, components-status, skeletons) | 3 | IF `"status" ∈ activeFamilies` |
| `audience-developer/` | Developer-tool patterns (code-block, diff-view, log-stream, monospace-table, terminal-pane, type-mono) | 6 | IF Q2 audience = `developer tool` |
| `audience-pro/` | Pro-tool patterns (colors-presence, command-palette, keyboard, list, shortcuts-overlay, toast-menu) | 6 | IF Q2 audience = `pro tool` |
| `audience-consumer/` | Consumer patterns (banner, generous empty-state, feature-grid, marketing-card, testimonial) | 5 | IF Q2 audience = `consumer app` |
| `platform-desktop/` | Desktop-only patterns (resize-panels) + `ui_kits-desktop-index.html` catalog + `ui_kits-desktop-showcase.html` full mock | 3 | IF Q3 platforms includes desktop (default) |
| `platform-mobile/` | Mobile-only patterns (bottom-sheet, pull-to-refresh, segmented-control, tab-bar) + `ui_kits-mobile-index.html` catalog + `ui_kits-mobile-showcase.html` full mock | 6 | IF Q3 platforms includes mobile |
| `theme-both/` | Side-by-side dark+light comparison | 1 | IF Q4 theme = `both equal` |
| `patterns/` | Cross-cutting flows (auth, data-density, error-pages, form-layouts, onboarding, pricing) | 6 | opt-in via `config.extensions` or explicit user request — not auto-scaffolded |
| `meta/` | Cross-cutting concerns (accessibility, i18n, presence-multiplayer, tokens-index) | 4 | opt-in / informational |

**Total reference inventory: 67 HTML specimens.** Typical scaffold output: 18–30 files depending on audience + platforms + theme + completenessProfile.

## Always-on (Core)

Every project — regardless of discovery — gets:

- `core/README.philosophy.md.tpl` → `system/<ds>/README.md`
- `core/README.orchestration.md.tpl` → `.design/README.md` (if missing)
- `core/SKILL.md.tpl` → `system/<ds>/SKILL.md`
- `core/INDEX.md.tpl` → `.design/INDEX.md` (if missing)
- `core/config.json.tpl` → `.design/config.json` (if missing or in re-bootstrap)
- `core/colors_and_type.css.tpl` → `system/<ds>/colors_and_type.css`
- `core/preview/_layout.css` → `system/<ds>/preview/_layout.css` (copy as-is)
- `core/preview/colors-{text,surfaces,accent}.html` → 3 token specimens
- `core/preview/type-scale.html` → 1 typography specimen
- `core/preview/spacing-scale.html` → 1 spacing specimen
- `core/preview/motion.html` → 1 motion specimen
- `core/preview/components-{buttons,cards,inputs}.html` → 3 component specimens

**Core minimum: 10 preview specimens (excluding `.tpl` docs and `_layout.css`).**

## Always-on (Foundations layer)

Token-foundation specimens that ship for any non-`minimal` profile:

- `foundations/radii.html` → `system/<ds>/preview/radii.html`
- `foundations/elevation.html` → `system/<ds>/preview/elevation.html`
- `foundations/iconography.html` → `system/<ds>/preview/iconography.html` (skill re-curates icon set to project domain at scaffold time — see Rules #8 below)
- `foundations/focus.html` → `system/<ds>/preview/focus.html`
- `foundations/grid.html` → `system/<ds>/preview/grid.html`
- `foundations/borders.html` → `system/<ds>/preview/borders.html`
- `foundations/opacity.html` → `system/<ds>/preview/opacity.html`
- `foundations/selection.html` → `system/<ds>/preview/selection.html`

**Foundations default: +8 files.** Profile `minimal` drops these. Profile `standard`/`strict` includes all eight.

## Always-on (Universal components)

Cross-cutting components every project surfaces:

- `universal/components-toggles.html`
- `universal/components-dialogs.html`
- `universal/components-tooltips.html`
- `universal/components-tables.html`
- `universal/components-callout.html`
- `universal/empty-state.html.tpl` (substitute project name)
- `universal/logo.html` — IF wordmark/logotype claim in README/SKILL.md OR `assets/logos/*.svg` exists. If a claim exists with no asset, the skill ALSO generates a minimal placeholder SVG (see Rule #7).

**Universal components default: +6 to +7 files.**

## Conditional family specimens

Gated by `activeFamilies[]`:

- `status/colors-status.html` → IF `"status" ∈ activeFamilies` (default-on)
- `status/components-status.html` → IF `"status" ∈ activeFamilies`
- `status/skeletons.html` → IF `"status" ∈ activeFamilies`
- `audience-pro/colors-presence.html` → IF `"presence" ∈ activeFamilies` (pro tool + multiplayer)
- `audience-developer/type-mono.html` → IF `"mono" ∈ activeFamilies` (developer audience OR Q7 picked mono pairing)

## Conditional audience specimens

Gated by Q2 (audience):

- **`audience-developer/*`** — IF Q2 = `developer tool`. Includes: type-mono, components-code-block, components-diff-view, components-log-stream, components-monospace-table, components-terminal-pane. **+6 files.**
- **`audience-pro/*`** — IF Q2 = `pro tool`. Includes: colors-presence (if presence active), components-command-palette, components-keyboard, components-list, components-shortcuts-overlay, components-toast-menu. **+5 to +6 files.**
- **`audience-consumer/*`** — IF Q2 = `consumer app`. Includes: components-banner, components-empty-state-generous, components-feature-grid, components-marketing-card, components-testimonial. **+5 files.**

## Conditional platform specimens

Gated by Q3 (platforms):

- **`platform-desktop/*`** — IF Q3 includes desktop. Includes: components-resize-panels (1 file), plus the two ui_kit entries below.
- **`platform-mobile/*`** — IF Q3 includes mobile or tablet. Includes: components-bottom-sheet, components-pull-to-refresh, components-segmented-control, components-tab-bar (4 files), plus the two ui_kit entries below.

## Always-on (ui_kit — the "DS in use" artifacts)

`platform-<platform>/ui_kits-<platform>-{index,showcase}.html` is **not optional**. Every bootstrap produces at least one composition that demonstrates the DS on a realistic product surface. The two entries serve different purposes:

| File | Role |
|---|---|
| `platform-desktop/ui_kits-desktop-index.html` | **Catalog/launcher** — links out to individual platform-desktop specimens. Useful for browsing what desktop-specific patterns the project ships. |
| `platform-desktop/ui_kits-desktop-showcase.html` | **Full product mock** — multi-screen composition (nav + sidebar + main content + status bar) with theme/accent picker. The single highest-leverage "DS in use" artifact in the bootstrap output. |
| `platform-mobile/ui_kits-mobile-index.html` | **Catalog/launcher** for mobile specimens. |
| `platform-mobile/ui_kits-mobile-showcase.html` | **Full product mock** sized to a 375 × 812 artboard. |

Both showcase files use vanilla JS for theme/accent switching and include `EDITMODE-BEGIN`/`EDITMODE-END` markers so agents can edit defaults in-place.

**ui_kit default: +2 files for desktop, +2 more for mobile = +2 to +4 files.**

Hard rule: **never scaffold `ui_kits/<platform>/` as an empty directory.** Either populate at least the showcase (single highest-leverage) or skip the platform entirely. The completeness-critic V12/V13 enforces this.

## Conditional theme

- `theme-both/colors-themes-side-by-side.html` → IF Q4 theme = `both equal`. **+1 file.**

## Opt-in (Patterns + Meta)

These are NOT auto-scaffolded. The user can request specific patterns via `config.extensions[]` or explicit `/design:new` invocations:

- `patterns/patterns-auth.html`, `patterns-data-density.html`, `patterns-error-pages.html`, `patterns-form-layouts.html`, `patterns-onboarding.html`, `patterns-pricing.html` — 6 files
- `meta/accessibility.html`, `i18n.html`, `presence-multiplayer.html`, `tokens-index.html` — 4 files

If the user mentions onboarding or auth flows in Q1, the skill MAY proactively include the matching pattern; otherwise opt-in only.

## Aesthetic inputs (discovery Round 2)

| Q | Answer | Effect on scaffold |
|---|---|---|
| Q5 mood | Linear / Figma / posthog | iconography `lucide`, radii `xs:4 sm:6 md:8`, motion `flip:140ms ease-out` |
| Q5 mood | Stripe / Vercel / Notion | iconography `phosphor` or `heroicons`, radii `md:12`, motion `flip:200ms` |
| Q5 mood | Zed / Raycast / Arc | iconography `lucide thin (1px)`, radii `md:6 pill:full`, motion `flip:120ms` |
| Q6 brand color | "pick for me" | skill picks OKLCH derived from Q5 mood + cue ladder (see SKILL.md "Accent color heuristic") |
| Q6 brand color | explicit hex | skill converts to OKLCH, derives hover (−2L) / active (−4L) / fg |
| Q7 typography | Inter + IBM Plex + JetBrains Mono | default — battle-tested pairs |
| Q7 typography | Geist + Geist Mono | single-family; reduced hierarchy |
| Q7 typography | system + JetBrains Mono | minimal pairing |
| Q8 content tone | direct-terse | copy voice: action verbs only, no marketing puffery |
| Q8 content tone | explanatory-friendly | copy voice: helpful sentence-fragments, second-person |
| Q8 content tone | formal-B2B | copy voice: complete sentences, third-person, no exclamation marks |

## Brand asset minimums (always-on)

When the README/SKILL.md/specimen copy makes a brand claim (`mascot`, `wordmark`, `logotype`, `glyph`, `illustration`, `hedgehog`, `character`), the skill MUST generate at least one minimal SVG to back the claim. The completeness-critic V20 enforces this.

Minimum scaffold:
- If a wordmark is claimed → `assets/logos/wordmark.svg` (a simple typographic SVG using the project label + accent color, ~15 lines of SVG)
- If a mark/glyph is claimed → `assets/logos/mark.svg` OR `assets/glyphs/<name>.svg` (a simple geometric mark in the accent color, ~10 lines of SVG)
- If domain-specific glyphs are claimed (e.g. dugmate's sport balls) → at least 2–3 example SVGs under `assets/glyphs/`

These don't need to be world-class illustrations — the goal is "claim has an artifact". Better placeholders than empty dirs.

## Computed `activeFamilies[]`

The skill computes this array based on discovery answers + audience-conditional logic. Used by the completeness-critic to scope checks.

| Family | Included when |
|---|---|
| `accent` | always (every project has one accent) |
| `status` | always unless audience explicitly excludes (rare; minimal scaffolds may skip status/) |
| `presence` | audience = pro tool AND project has multiplayer hint in Q1 brief |
| `mono` | audience = developer tool, OR Q7 typography includes a monospace pairing |

## Typical scaffold sizes (full-library state)

| Project profile (Q2 / Q3 / Q4) | Approx file count |
|---|---|
| Consumer marketing (consumer / desktop / dark) | ~22 (10 core + 8 foundations + 6 universal + 5 audience-consumer + 2 desktop ui_kit) |
| Pro-tool SaaS (pro / desktop+mobile / dark) | ~30 (10 + 8 + 6 + 6 audience-pro + 4 platform-mobile + 4 ui_kit + 3 status) |
| Developer CLI dashboard (developer / desktop / dark) | ~25 (10 + 8 + 6 + 6 audience-developer + 2 desktop ui_kit + 3 status) |
| Consumer mobile (consumer / mobile / light) | ~24 (10 + 8 + 6 + 5 audience-consumer + 4 platform-mobile + 2 mobile ui_kit) |
| Enterprise admin (pro / desktop / both) | ~28 (10 + 8 + 6 + 6 audience-pro + 2 desktop ui_kit + 3 status + 1 theme-both) |

Variance comes from audience-* (5–6 files), platform-mobile (4–6 files including ui_kit), and conditional families (status, mono, presence).

## Rules the agent MUST honor

1. **Never copy a specimen verbatim.** Read SPECIMEN comment → understand the demonstration → generate a fresh, project-flavored equivalent.
2. **No placeholder copy in output.** "Lorem Solutions Inc.", "Click here", "Acme Corp." MUST NOT appear in the scaffolded files. Use discovery answers to derive project-specific copy.
3. **Tokens only.** No hardcoded hex / px / rem in scaffolded files (outside the shared `_layout.css` chrome).
4. **Always include the SPECIMEN header** in the scaffolded file (carry it across) so future reads can identify what each specimen demonstrates.
5. **Honor `activeFamilies[]`.** Skip families the project didn't opt into (no presence specimens for solo-author projects; no mono for non-developer audiences unless Q7 chose a mono pairing).
6. **Always scaffold at least the platform ui_kit showcase.** The "DS in use" composition is the single most useful artifact for a designer or stakeholder to evaluate the system. Skipping it makes the DS look like a token inventory instead of a product surface. `ui_kits-<platform>-showcase.html` is the canonical filename inside `system/<ds>/preview/`.
7. **Claim → asset receipt.** If discovery answers include mascot / illustration / logotype cues (Q5 mentions a brand with distinctive mascot, or Q1 implies "character"), generate at least one minimal SVG into `assets/glyphs/` or `assets/logos/` to back the claim. Never let scaffolded copy say "hedgehog mascot energy" with an empty assets dir.
8. **Re-curate the iconography family.** `foundations/iconography.html` ships with a generic Lucide-style set (trending, clock, search, filter). The skill MUST replace these with icons relevant to the project's domain at scaffold time: developer tool → terminal/file/branch/commit; consumer → home/search/notification; pro tool → roster/calendar/analytics. Keep the same SPECIMEN header + size scale + stroke conventions.
9. **Scaffold output is flat.** All category dirs in the inspiration library (`foundations/`, `status/`, `audience-*/`, `platform-*/`, `theme-both/`, `patterns/`, `meta/`, `universal/`) flatten into `system/<ds>/preview/<filename>.html` in the scaffold output. The category prefix lives only in the library, not in the project tree.
