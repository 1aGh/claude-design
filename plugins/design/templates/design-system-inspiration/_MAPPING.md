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
- `core/preview/motion.tsx.tpl` + `motion.css.tpl` + `_motion-readme.md.tpl` → 1 motion specimen (Phase 3.7 / DDR-049 — TSX playground with 8 role tiles via `<MotionDemo>` from `@maude/canvas-lib`; legacy `.html` archived to `.archive/`)
- `core/preview/components-{buttons,cards,inputs}.html` → 3 component specimens

**Core minimum: 10 preview specimens (excluding `.tpl` docs and `_layout.css`).**

## Always-on (Foundations layer)

Token-foundation specimens that ship for any non-`minimal` profile:

- `foundations/radii.html` → `system/<ds>/preview/radii.tsx`
- `foundations/elevation.html` → `system/<ds>/preview/elevation.tsx`
- `foundations/iconography.html` → `system/<ds>/preview/iconography.tsx` (skill re-curates icon set to project domain at scaffold time — see Rules #8 below)
- `foundations/focus.html` → `system/<ds>/preview/focus.tsx`
- `foundations/grid.html` → `system/<ds>/preview/grid.tsx`
- `foundations/borders.html` → `system/<ds>/preview/borders.tsx`
- `foundations/opacity.html` → `system/<ds>/preview/opacity.tsx`
- `foundations/selection.html` → `system/<ds>/preview/selection.tsx`

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

Round 2 answers (Q5 mood, Q6 color, Q7 typography, Q8 voice) are **payload-driven** — the `design:ux-research-agent` discovers domain-relevant options per project. Token values (font families, OKLCH ranges, voice characteristics) come from the chosen payload option, NOT from a hardcoded mapping table.

| Q | Answer source | Effect on scaffold |
|---|---|---|
| Q5 mood | payload `mood_clusters[selected]` | Drives aesthetic decisions in `_layout.css` chrome + `_components.css` defaults. No fixed iconography/radii/motion mapping — those land in their own Q11 / Q9 / motion tokens. |
| Q6 brand color | payload `color_oklch_options[selected]` | OKLCH range from the chosen option becomes `--accent` family. If user picked "I have a hex" → skill converts to OKLCH, derives hover (−2L) / active (−4L) / fg. If user picked "pick-for-me" → skill picks within the Recommended option's OKLCH range, validated against the mood cue ladder in SKILL.md "Accent color heuristic". |
| Q7 typography | payload `typography_pairing_options[selected]` | `display_family`, `body_family`, `mono_family` from the chosen option are written verbatim into `colors_and_type.css` `--font-display / --font-body / --font-mono` tokens. |
| Q8 content tone | payload `voice_tone_options[selected]` | The selected option's `characteristics[]` go into the DS README "Voice" section; the `sample_microcopy` becomes the reference example sub-agents read before writing specimen copy. |

## Pro-designer inputs (discovery Round 3)

Round 3 answers (Q9 signature treatment, Q10 hard-NOs, Q11 iconography, Q12 density) are **payload-driven** — the `design:ux-research-agent` surfaces project-specific options. **This table is NOT a list of valid user-facing answers** (the agent's payload generates those per-project from research). Instead, this is the **vocabulary of scaffold effect families** that every payload option MUST classify itself into via a `family` field. The agent picks options that fit the brief, names them per-project (e.g. `<treatment-id> (anchor: <real-product>)`), and tags each with one of these family IDs so the scaffold knows what CSS / asset behavior to apply.

### Q9 signature treatment — effect families

Every `signature_treatment_options[i]` in the payload MUST set `family` to one of these IDs. The scaffold then applies the corresponding `_layout.css` / token changes regardless of how the option was labeled.

| Family ID | Scaffold effect (what `_layout.css` / tokens do when this family is chosen) |
|---|---|
| `chrome-glow` | Body bg = soft accent halo + faint vignette; `--shadow-glow` halo on signature cards. Subtle, accent-anchored ambient warmth. |
| `body-pattern` | Body bg = repeating pattern (scanlines, dot grid, hatch, noise overlay) at low opacity; `body::before` SVG film/grain; optional `body::after` slow animation gated behind reduced-motion. Heavier, atmospheric. |
| `frosted-blur` | `.specimen` + cards get `backdrop-filter: blur(20px) saturate(140%)` + low-alpha bg; tokens add a frosted-tint variable. Translucent depth. |
| `hard-edges` | Radii collapse to `0/2/4`; shadows removed except focus ring; borders bumped to `--border-strong`; thicker outlines on key elements. Brutalist / no-nonsense. |
| `depth-stretch` | Shadow ladder stretched — `--shadow-md/lg/xl` get longer offsets and softer blurs; cards float higher; hover state lifts more. Soft-floaty depth. |
| `inset-recess` | Tokens add `--shadow-inset-sm/md`; inputs + toggles use inset-shadow surfaces; never inside chrome with text on it (accessibility). Hardware-toggle / recessed feel. |
| `none` | No body-level treatment; `_layout.css` stays minimal; chrome reads flat. The opt-out value. |

The agent may also propose treatments outside this catalog — when it does, it must either map them to the closest family OR flag in `research_quality_notes` that a new family ID is needed (which then becomes a spec-change conversation, not a silent extension).

### Q10 hard NOs — sub-agent guardrails

| Q | Answer source | Effect on scaffold |
|---|---|---|
| Q10 hard NOs | payload `suggested_hard_NOs[]` + `anti_references[]` (user-picked subset, multi-select) | Each picked guardrail surfaced in DS README "Hard rules"; sub-agents read this list and enforce — "no animations" → no `transition` / `@keyframes` outside reduced-motion fallback; "no gradients" → no `linear-gradient` / `radial-gradient` anywhere; "no emoji" → no emoji glyphs in any scaffolded HTML (use stroke SVG glyphs instead). Hard NOs override the Q9 signature treatment when they conflict (e.g. `frosted-blur` + "no gradients" = use solid translucent fill, no gradient backdrop). |

### Q11 iconography — effect families

Every `iconography_vibe_options[i]` in the payload MUST set `family` to one of these IDs.

| Family ID | Scaffold effect (`iconography.html` content + `assets/glyphs/` SVG style) |
|---|---|
| `thin-stroke-geometric` | `iconography.html` scaffolds 12 ASCII-leaning 1px-stroke icons; generated SVG glyphs use 1px stroke + rounded caps; no emoji anywhere. Terminal / IDE heritage. |
| `outline-product` | Default outline icon set at 1.5–2px stroke on a 20–24px grid; balanced product nouns derived from Q1+Q2. The most common "rounded outline" family. |
| `industry-specific` | `iconography.html` curated to project domain (the agent's `domain_nouns` from the payload drives glyph selection); each domain noun gets a custom SVG. |
| `filled-solid` | Filled (not stroked) icons; larger sizes default (24/32). High-contrast presence. |
| `photographic` | Iconography replaced by photographic thumbnails (e.g. ingredient photos as IDs); `assets/glyphs/` remains nominal; thumbnail scaffolding lives in components. |

### Q12 density — effect families

Every `density_options[i]` in the payload MUST set `family` to one of these IDs.

| Family ID | Scaffold effect (`--space-*` defaults + component padding) |
|---|---|
| `dense` | Base `--space-*` shrinks (most padding lands on space-2/3); buttons 7px vertical; tables compact; sidebar 220–248px. Pro-tool / data-heavy. |
| `balanced` | Default `--space-*`; buttons 8px vertical; sidebar 248–280px. Mid-range. |
| `roomy` | Base padding bumps (most lands on space-4/5); buttons 10–12px vertical; sidebar 280–320px; type-scale slightly bumped. Consumer / reading-friendly. |

## Brand asset minimums (always-on)

When the README/SKILL.md/specimen copy makes a brand claim (`mascot`, `wordmark`, `logotype`, `glyph`, `illustration`, `hedgehog`, `character`), the skill MUST generate at least one minimal SVG to back the claim. The completeness-critic V20 enforces this.

Minimum scaffold:
- If a wordmark is claimed → `assets/logos/wordmark.svg` (a simple typographic SVG using the project label + accent color, ~15 lines of SVG)
- If a mark/glyph is claimed → `assets/logos/mark.svg` OR `assets/glyphs/<name>.svg` (a simple geometric mark in the accent color, ~10 lines of SVG)
- If domain-specific glyphs are claimed (e.g. dugmate's sport balls) → at least 2–3 example SVGs under `assets/glyphs/`

These don't need to be world-class illustrations — the goal is "claim has an artifact". Better placeholders than empty dirs.

### Claim → receipt (machine-checkable contract)

The bootstrap flow MUST run a claim scan against the freshly-authored README + SKILL.md BEFORE emitting the scaffold roster. Every match in the left column requires the corresponding row in the roster as a `pending` file. After scaffold, the completeness-critic re-verifies this table and flags any mismatch.

| claim substring | required receiving file(s) in roster | rewrite alternative |
|---|---|---|
| `wordmark`, `logotype` | `universal/logo.html` + `assets/logos/wordmark.svg` | strip the claim from README + SKILL |
| `mark` (when not part of `wordmark`) | `universal/logo.html` + `assets/logos/mark.svg` | strip the claim |
| `glyph`, `terminal-glyph` | `foundations/iconography.html` + ≥ 1 `assets/glyphs/*.svg` | strip the claim from README + SKILL |
| `mascot`, `character` | `assets/logos/mark.svg` OR `assets/illustrations/<name>.svg` (no dedicated specimen template — generate a placeholder SVG) | strip the claim |
| `illustration` | `assets/illustrations/<name>.svg` (no template — placeholder) | strip the claim |
| `hedgehog`, named-creature claims | `assets/logos/mark.svg` or matching illustration | strip the claim |

The bootstrap roster emission step (in SKILL.md → "Pre-scaffold — claim scan + emit `_scaffold-roster.yaml`") consults this table; missing receiving files = the row goes into the roster as `pending`. Studio-2 retro BAD-4 caught the failure mode where `assets/glyphs/` was left empty despite the README claiming terminal glyphs lived there — this table is the structural fix.

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

## Fan-out batching (dependency_closure)

The skill batches scaffold writes by dependency closure so independent files can be written in parallel by sub-agents. Three tiers:

| `dependency_closure` | Meaning | Batch | Authored by |
|---|---|---|---|
| `root` | The dependency root — tokens, `_layout.css`, READMEs, SKILL.md, `config.json`. Nothing else can be written until these exist. | **A** | main agent, serial |
| `tokens-only` | Pure token-and-chrome specimens (colors-*, type-*, spacing-scale, motion, radii, elevation, focus, iconography, borders, grid, opacity, selection). No reference-template reading required to generate — token CSS + Q5/Q9 mood are enough. | **B** | parallel sub-agents (3–4 slices of 3–5 files each) |
| `tokens + chrome + template` | Components and compositions (components-*, empty-state, logo, audience-* specimens, platform-* showcases). Each needs the matching reference template from the inspiration library to understand the demonstration intent. | **C** | parallel sub-agents (3–5 slices of 2–4 files each) |
| `index` | The catalog launcher (`ui_kits-*-index.html`) that links every peer. Written LAST after all peers exist. | **A (post)** | main agent, serial |

| Dir | `dependency_closure` |
|---|---|
| `core/colors_and_type.css.tpl`, `core/SKILL.md.tpl`, `core/README.*.tpl`, `core/config.json.tpl`, `core/preview/_layout.css` | `root` |
| `core/preview/colors-{text,surfaces,accent}.html`, `type-scale.html`, `spacing-scale.html`, `motion.tsx.tpl` + `motion.css.tpl` | `tokens-only` |
| `foundations/*.html` | `tokens-only` |
| `core/preview/components-{buttons,cards,inputs}.html` | `tokens + chrome + template` |
| `universal/*.html`, `universal/empty-state.html.tpl`, `universal/logo.html` | `tokens + chrome + template` |
| `status/*.html` | `tokens + chrome + template` |
| `audience-*/*.html` | `tokens + chrome + template` |
| `platform-*/components-*.html` | `tokens + chrome + template` |
| `platform-*/ui_kits-*-showcase.html` | `tokens + chrome + template` |
| `platform-*/ui_kits-*-index.html` | `index` (written last) |
| `theme-both/*.html` | `tokens-only` |

The skill emits `<designRoot>/_history/_system/000-scaffold-roster.yaml` with one row per file (path / batch / deps / status). Sub-agents update `status: pending → written` as they go. See `SKILL.md` "Pre-scaffold — emit `_scaffold-roster.yaml`".

## Rules the agent MUST honor

1. **Never copy a specimen verbatim.** Read SPECIMEN comment → understand the demonstration → generate a fresh, project-flavored equivalent. **Target 1.5×–6× the reference LOC** for signature specimens (accent, empty-state, ui_kits-showcase, logo). Token-swap-only output is a scaffold regression; the skill's `Creativity rubric` (in SKILL.md "Scaffold (3-batch fan-out)") names the gold-standards and anti-examples.
2. **No placeholder copy in output.** "Lorem Solutions Inc.", "Click here", "Acme Corp." MUST NOT appear in the scaffolded files. Use discovery answers to derive project-specific copy.
3. **Tokens only.** No hardcoded hex / px / rem / em-letter-spacing in scaffolded files (outside the shared `_layout.css` chrome). Typography-critic catches off-ladder px and returns a blocker — see the studio 2026-05-13 re-bootstrap retro.
4. **Always include the SPECIMEN header** in the scaffolded file (carry it across) so future reads can identify what each specimen demonstrates.
5. **Honor `activeFamilies[]`.** Skip families the project didn't opt into (no presence specimens for solo-author projects; no mono for non-developer audiences unless Q7 chose a mono pairing).
6. **Always scaffold at least the platform ui_kit showcase.** The "DS in use" composition is the single most useful artifact for a designer or stakeholder to evaluate the system. Skipping it makes the DS look like a token inventory instead of a product surface. `ui_kits-<platform>-showcase.html` is the canonical filename inside `system/<ds>/preview/`.
7. **Claim → asset receipt.** If discovery answers include mascot / illustration / logotype cues (Q5 mentions a brand with distinctive mascot, or Q1 implies "character"), generate at least one minimal SVG into `assets/glyphs/` or `assets/logos/` to back the claim. Never let scaffolded copy say "hedgehog mascot energy" with an empty assets dir.
8. **Re-curate the iconography family.** `foundations/iconography.html` ships with a generic Lucide-style set (trending, clock, search, filter). The skill MUST replace these with icons relevant to Q11 vibe + project's domain at scaffold time: developer tool → terminal/file/branch/commit; consumer → home/search/notification; pro tool → roster/calendar/analytics. Keep the same SPECIMEN header + size scale + stroke conventions.
9. **Scaffold output is flat.** All category dirs in the inspiration library (`foundations/`, `status/`, `audience-*/`, `platform-*/`, `theme-both/`, `patterns/`, `meta/`, `universal/`) flatten into `system/<ds>/preview/<filename>.html` in the scaffold output. The category prefix lives only in the library, not in the project tree.
10. **Honor the Q10 hard-NO list.** Each NO picked in discovery becomes a guardrail every sub-agent reads before writing. "No animations" → no `transition` / `@keyframes` outside reduced-motion fallback. "No gradients" → no `linear-gradient` / `radial-gradient` in any output. "No emoji in chrome" → SVG glyphs only. Hard NOs override the Q9 signature treatment when they conflict (e.g. `glassmorphism` + `no gradients` = use solid translucent fill, no gradient backdrop).
11. **Honor the Q12 density preference.** `dense pro-tool` collapses default padding by one step; `roomy SaaS` bumps it by one. The default values in `_layout.css` `.specimen` + the `--space-*` usage conventions in components MUST reflect the chosen density.
12. **Reconcile the roster.** After Batch C completes, the main agent reads `_scaffold-roster.yaml`, asserts every row has `status: written`, and rejects the bootstrap as incomplete otherwise — never silently "complete" a bootstrap with pending rows.
