# Design system inspiration library

> **For the agent (skill `design-system`, bootstrap mode):** this directory is a **reference inventory**, NOT a substrate to copy literally. Read each specimen as "this is what a good X looks like, this is which tokens it demonstrates, this is the copy voice it uses" — then **generate a fresh, project-flavored equivalent** during scaffold.

## What this directory is

A library of ~20 (skeleton) → ~62 (full) HTML/markdown specimens that demonstrate **what a complete design system looks like in `.design/system/<ds>/`** for various project types. Each specimen:

- Sits in a directory keyed by **when it applies** (`core/` = always, `audience-pro/` = only pro-tool projects, etc.)
- Has a **SPECIMEN comment header** at the top (`<!-- SPECIMEN: … -->`) listing what tokens it demonstrates, the composition it shows, the copy voice it uses, and when the bootstrap scaffold should include it.
- Uses **placeholder tokens** (`var(--accent)`, `var(--bg-1)`, …) — the agent must replace them with the project's actual computed values during scaffold.

## What this directory is NOT

- **Not a literal substrate.** Do not `cp -R` this tree into a project's `.design/system/<ds>/`. The output should be project-flavored — fresh content using the project's tokens, project's copy voice, and only the specimens that fit the project's audience / platform / theme.
- **Not authoritative source.** The agent regenerates files; this library teaches the SHAPE.
- **Not placeholder copy.** When you scaffold, no "Lorem Solutions Inc." should appear in the output. Replace all placeholder copy with project-flavored content derived from discovery answers (Q1 product one-liner, Q5 mood references, Q8 content tone).

## Directory layout (when fully populated)

```
templates/design-system-inspiration/
├── _README.md             # this file
├── _MAPPING.md            # discovery answer → which files apply (the contract)
├── core/                  # ALWAYS — every project gets these (10 specimens)
│   ├── README.philosophy.md.tpl       # system/<ds>/README.md template
│   ├── README.orchestration.md.tpl    # .design/README.md template
│   ├── SKILL.md.tpl                   # system/<ds>/SKILL.md template
│   ├── INDEX.md.tpl                   # .design/INDEX.md template
│   ├── config.json.tpl                # .design/config.json template
│   ├── colors_and_type.css.tpl        # tokens skeleton
│   └── preview/
│       ├── _layout.css                # shared specimen chrome (copy as-is)
│       ├── colors-text.html
│       ├── colors-surfaces.html
│       ├── colors-accent.html
│       ├── type-scale.html
│       ├── spacing-scale.html
│       ├── motion.html
│       ├── components-buttons.html
│       ├── components-cards.html
│       └── components-inputs.html
├── universal/             # default-on unless explicitly excluded — common components
│   ├── components-toggles.html
│   ├── components-dialogs.html
│   ├── components-tooltips.html
│   ├── components-tables.html
│   ├── components-callout.html
│   └── empty-state.html.tpl
└── (foundations/ status/ audience-*/ platform-*/ theme-*/ patterns/ meta/ — added in follow-up phases)
```

## How the bootstrap-mode agent uses this library

1. **Read `_MAPPING.md`** to know which subdirectories apply to the current project based on discovery answers (Q2 audience, Q3 platforms, Q4 theme, plus universal default-ons).
2. **Read each applicable specimen's SPECIMEN comment header** to learn what tokens / composition / voice it demonstrates.
3. **Generate a fresh equivalent** in the project's `.design/system/<ds>/` using the project's actual tokens (from Q6 brand color, Q7 typography) and project's actual copy voice (from Q1 product one-liner, Q8 content tone).
4. **Never copy a specimen verbatim** — even if the project's profile matches the specimen's intended use case 1:1.

## Editing the library

- Add new specimens by creating an HTML file with a SPECIMEN comment header (see existing files for the format).
- Add new mappings to `_MAPPING.md` so the agent knows when to include the new specimen.
- Keep specimens ≤ ~120 lines each. They're for the agent to READ, not paginate.
- Token usage: only `var(--…)` references, no hardcoded hex / px / rem outside `_layout.css`. The shared chrome can have hardcoded base styles.

## Placeholder syntax (`.tpl` files only)

Templates (`.tpl` extension) use `{{name}}` double-brace placeholders. Distinct from flow's `PROJECT_NAME` namespace. The CLI helper (`mdcc design init`) strips the `.tpl` suffix during scaffold and substitutes placeholders from the discovery payload.

Plain `.html` files have no placeholders — the agent reads them as references and writes fresh files.
