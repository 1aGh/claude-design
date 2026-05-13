# Mapping — discovery answer → scaffold file set

> The contract for skill `design-system` (bootstrap mode). Computes which specimens land in `<designRoot>/system/<ds>/preview/` based on the 8 discovery answers + computed `activeFamilies[]`.

## Structural inputs (discovery Round 1)

| Q | Answer | Effect on scaffold |
|---|---|---|
| Q2 audience | `pro tool` | + `audience-pro/*` (when present); promote dense components to Core |
| Q2 audience | `consumer app` | + `audience-consumer/*` (when present); prefer generous spacing |
| Q2 audience | `developer tool` | + `audience-developer/*` (when present); promote `type-mono.html` to Core; `mono` ∈ `activeFamilies` |
| Q3 platforms | `desktop only` | + `platform-desktop/*` (when present) |
| Q3 platforms | `mobile + desktop` | + `platform-desktop/*` + `platform-mobile/*` |
| Q3 platforms | `tablet-first` | + `platform-desktop/*` (renamed conceptually) |
| Q4 theme | `dark default` | tokens emit single `[data-theme="dark"]` block |
| Q4 theme | `light default` | tokens emit single `[data-theme="light"]` block |
| Q4 theme | `both equal` | tokens emit both blocks + `theme-both/*` (when present) |

## Aesthetic inputs (discovery Round 2)

| Q | Answer | Effect on scaffold |
|---|---|---|
| Q5 mood | Linear / Figma / posthog | iconography `lucide`, radii `xs:4 sm:6 md:8`, motion `flip:140ms ease-out` |
| Q5 mood | Stripe / Vercel / Notion | iconography `phosphor` or `heroicons`, radii `md:12`, motion `flip:200ms` |
| Q5 mood | Zed / Raycast / Arc | iconography `lucide thin (1px)`, radii `md:6 pill:full`, motion `flip:120ms` |
| Q6 brand color | "pick for me" | skill picks OKLCH derived from Q5 mood ladder |
| Q6 brand color | explicit hex | skill converts to OKLCH, derives hover (-2L) / active (-4L) / fg |
| Q7 typography | Inter + IBM Plex + JetBrains Mono | default — battle-tested pairs |
| Q7 typography | Geist + Geist Mono | single-family; reduced hierarchy |
| Q7 typography | system + JetBrains Mono | minimal pairing |
| Q8 content tone | direct-terse | copy voice: action verbs only, no marketing puffery |
| Q8 content tone | explanatory-friendly | copy voice: helpful sentence-fragments, second-person |
| Q8 content tone | formal-B2B | copy voice: complete sentences, third-person, no exclamation marks |

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

**Core minimum: 10 files (excluding `.tpl` docs and `_layout.css`).**

## Always-on (Universal — default unless explicitly excluded)

Universal specimens land in `system/<ds>/preview/` for **every** project unless the user explicitly opts out:

- `universal/components-toggles.html`
- `universal/components-dialogs.html`
- `universal/components-tooltips.html`
- `universal/components-tables.html`
- `universal/components-callout.html`
- `universal/empty-state.html.tpl` (substitute project name)

**Universal default: +6 files. Combined with Core: 16 files baseline.**

## Computed `activeFamilies[]`

The skill computes this array based on discovery answers + audience-conditional logic. Used by the completeness-critic to scope checks.

| Family | Included when |
|---|---|
| `accent` | always (every project has one accent) |
| `status` | always unless audience explicitly excludes (rare; minimal scaffolds may skip status/) |
| `presence` | audience = pro tool AND project has multiplayer hint in Q1 brief |
| `mono` | audience = developer tool, OR Q7 typography includes a monospace pairing |

## Typical scaffold sizes (full library; skeleton phase = ~16)

| Project profile (Q2 / Q3 / Q4) | Approx file count |
|---|---|
| Consumer marketing (consumer / desktop / dark) | ~12 |
| Pro-tool SaaS (pro / desktop+mobile / dark) | ~22 |
| Developer CLI dashboard (developer / desktop / dark) | ~14 |
| Consumer mobile (consumer / mobile / light) | ~16 |
| Enterprise admin (pro / desktop / both) | ~20 |

Variance comes from `audience-*` (5–6 files) and `platform-mobile` (5 files) being conditional. In the **skeleton** phase of this library, only Core + Universal are populated; conditional dirs ship empty and are filled in follow-up phases.

## Rules the agent MUST honor

1. **Never copy a specimen verbatim.** Read SPECIMEN comment → understand the demonstration → generate a fresh, project-flavored equivalent.
2. **No placeholder copy in output.** "Lorem Solutions Inc.", "Click here", "Acme Corp." MUST NOT appear in the scaffolded files. Use discovery answers to derive project-specific copy.
3. **Tokens only.** No hardcoded hex / px / rem in scaffolded files (outside the shared `_layout.css` chrome).
4. **Always include the SPECIMEN header** in the scaffolded file (carry it across) so future reads can identify what each specimen demonstrates.
5. **Honor `activeFamilies[]`.** Skip families the project didn't opt into (no presence specimens for solo-author projects; no mono for non-developer audiences unless Q7 chose a mono pairing).
