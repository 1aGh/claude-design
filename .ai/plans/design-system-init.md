---
name: design-system-init
status: planned
created: 2026-05-13
revised: 2026-05-13
source_retro: .ai/logs/system-reviews/design-system-bootstrap-review.md
related_plans:
  - phase-5-draw-tools.md (was phase-5-multi-ds-and-draw-tools; multi-DS portion merged into this plan as Phase 4)
decisions:
  - NO separate `init` skill. Bootstrap logic merges into existing skill `design-system` (Variant B from brainstorm 2026-05-13) — single skill owns both read-side (load context for canvas iteration) and write-side (bootstrap + add DS) responsibilities, with mode-switching on invocation context
  - Dedicated slash command `/design:setup-ds <name> [brief]` in group `setup-*` (sibling of `setup-docs` + `setup-onboard`) — thin wrapper that invokes skill `design-system` with `mode=bootstrap`. Three internal modes: `first-bootstrap` (no config exists), `additional-ds` (config has ≥1 DS), `re-bootstrap` (target DS exists, requires `--force`)
  - Separate slash command `/design:setup-onboard` in `setup-*` group — project-level environment init (mirrors `/flow:setup-onboard`): dependency pre-flight, install hints, offer `/init` for CLAUDE.md, offer `/flow:setup-onboard` for `.ai/`, initialize skeleton `.design/config.json` (with empty `designSystems: []`). **No DS bootstrap** — `setup-onboard` only prepares the environment; `setup-ds` creates a DS. Auto-invoked transparently by `setup-ds` (or by `/design:edit` / `/design:new` missing-state hooks) when `.design/config.json` doesn't yet exist
  - Slash command `/design` renamed to `/design:edit` (verb-as-action; resolves naming collision with skill `design`); one-version compat stub at `/design`
  - Template skeleton is an **inspiration library**, NOT a substrate. Skill `design-system` (bootstrap mode) reads it as reference and generates project-flavored files based on discovery — typical project gets 10-22 specimens out of ~62 inspiration references, not a fixed 32-file tree
  - Single-DS default dirname `system/project/` (literal, rename-resilient). Multi-DS opt-in uses `system/<name>/`. Completeness-critic accepts either; rejects only the D2-divergence where dirname == project slug
  - `mdcc design init` CLI is a HELPER for non-interactive contexts (CI, scripted setup) — scaffolds Core only with defaults, no content generation. Primary path is skill `design-system` (bootstrap mode) inside Claude Code via `/design:setup-ds` or auto-load on missing target
  - Completeness-critic is ADAPTIVE — reads `config.json` `activeFamilies[]` + `completenessProfile` (`minimal | standard | strict`) and adjusts severity per project
  - Apply full flow-style categorization: `docs.md` → `setup-docs.md`, `category:` frontmatter on all commands, new `plugins/design/CATEGORIES.md`, new `/design:help`, new `/design:setup-ds`
  - Multi-DS support (was Phase 5 Tasks 2-7) merged into this plan as Phase 4 — natural sibling of bootstrap (both touch `system/` shape). `/design:new --ds=<unknown>` fails with hint to `/design:setup-ds` (no fallback prompt — clean separation). Draw tools (was Phase 5 Tasks 1, 8) stay standalone in phase-5-draw-tools.md
  - Docs site sync added as Phase 6 — Fumadocs content + scripts must reflect new commands, skill bootstrap mode, CLI subcommand, and config schema
  - 3-tier "schema vs convention" model: Core (blocker), Conventional (warning), Free-form (no check) — explicit in critic + skill `design-system` docs
  - No backward-compat migration tooling for legacy `.design/` layouts (no production users of the current shape yet)
---

# Plan: Design system bootstrap workflow (skill `design-system` bootstrap mode) + multi-DS + docs sync

## Context

This plan converts the retro at `.ai/logs/system-reviews/design-system-bootstrap-review.md` (R1–R6) into sequenced work, plus folds in the **multi-DS portion of the old Phase 5** (Tasks 2–7) since multi-DS and single-DS bootstrap touch the same `system/` shape and share the same completeness contract. Draw tools (old Phase 5 Tasks 1 + 8) stay as a standalone roadmap item in `phase-5-draw-tools.md`.

**Major reframes vs. the original retro:**

- **Bootstrap merges into existing skill `design-system`** (no separate `init` skill). Skill becomes the single source of truth for everything DS-related: read-side (load context for canvas iteration) AND write-side (bootstrap a first DS, add an additional DS, re-bootstrap with `--force`). Mode-switches internally based on invocation context + project state.
- **Dedicated slash command `/design:setup-ds <name> [brief]`** in group `setup-*` is the discoverable entry point for creating a DS. Thin wrapper → skill `design-system` with `mode=bootstrap`. Skill is also auto-loaded by `/design:edit` / `/design:new` when target is missing (bootstrap-first fallback).
- **Separate slash command `/design:setup-onboard`** in `setup-*` group — project-level environment init (mirrors `/flow:setup-onboard`): dependency pre-flight, install hints, offer `/init` for CLAUDE.md, offer `/flow:setup-onboard` for `.ai/`, initialize skeleton `.design/config.json`. **No DS bootstrap.** Auto-invoked transparently when `.design/config.json` doesn't exist at the start of `setup-ds` (or missing-state hooks). Skill `design-system` bootstrap Pre-Flight is now LIGHT (just hard deps — node ≥ 20, git, write permission); rich onboarding moves to `setup-onboard`.
- **Command `/design` renamed to `/design:edit`.** Resolves the cognitive collision with skill `design`. Verb-as-action aligns with flow's pattern (`/flow:plan`, `/flow:execute`, …).
- **Template is an inspiration library, not a 1:1 substrate.** Skill `design-system` (bootstrap mode) reads `plugins/design/templates/design-system-inspiration/` as REFERENCE — "this is what a good colors-accent specimen looks like" — and generates project-flavored output. Scaffold count is **dynamic** (10-22 specimens), driven by discovery answers via a mapping table.
- **`mdcc design init` is a helper.** Non-interactive Core-only scaffold for CI / scripted setup. Skill `design-system` (bootstrap mode) is the primary, interactive path inside Claude Code.
- **3-tier "schema vs convention" model.** Core (blocker if missing), Conventional (warning), Free-form (no check). Lets the system stay extensible without weakening compliance.
- **Multi-DS folded in.** Phase 4 (new) adds `system/<name>/` support, `--ds=<name>` flag on `/design:new`, per-canvas `.meta.json.designSystem`, and multi-DS-aware completeness rules. `/design:new --ds=<unknown>` fails with hint to `/design:setup-ds` (no fallback prompt).
- **Docs site sync** as Phase 6 — Fumadocs site shipped in v0.7.0 must reflect every rename + new surface.

**Phase ordering:**

1. **Phase 0** — Rename `/design` → `/design:edit` + fix sweep bugs + compat stub. Standalone; unblocks naming clarity for everything downstream.
2. **Phase 1** — Inspiration library + extend skill `design-system` with bootstrap mode (dynamic scaffold logic, 3-mode switch: first-bootstrap / additional-ds / re-bootstrap).
3. **Phase 2** — Flow-style categorization + new `/design:setup-ds` and `/design:setup-onboard` slash commands + missing-state hooks in `/design:edit` and `/design:new` + `mdcc design init` CLI helper.
4. **Phase 3** — Adaptive completeness-critic — auto-runs at end of skill `design-system` bootstrap flow, opt-in via `/design:critic --system-only`.
5. **Phase 4** — Multi-DS support (merged from old Phase 5 Tasks 2–7).
6. **Phase 5** — `CLAUDE.md` additions documenting all of the above.
7. **Phase 6** — Docs site (Fumadocs) sync — sweep `/design` → `/design:edit`, new pages for `init` / bootstrap / categories / `mdcc design init`, schema reference picks up new config fields.

**Reorder check.** Phase 0 first because the rename touches many references downstream. Phase 1 must precede Phase 2 because Phase 2's missing-state hooks call into Phase 1's skill. Phase 3 references Phase 1's contract (lints against it) and Phase 4's multi-DS shape — but Phase 3 should land BEFORE Phase 4 so its 3-tier model is in place when multi-DS adds its dimensions; Phase 3 anticipates multi-DS via Check #3's "accepts either shape" rule, Phase 4 then plugs in. Phase 5 references everything. Phase 6 must land last (docs reference shipped surface).

**Out of scope:** changes to dugmate, aesthetic tweaks to already-shipped md-claude `.design/`, layers panel + in-canvas CSS editor (Phase 12), draw tools (phase-5-draw-tools.md), npm release. Release is a separate cycle after the seven phases land.

---

## Architecture: three entry points, three layers

Before diving into phases, the relationships across CLI / skill / command MUST be unambiguous, because the plan touches all three.

### Entry-point matrix

| Context | Entry point | What runs |
|---|---|---|
| Inside Claude Code, fresh repo, user says `/design:setup-onboard` | slash command | thin command → dependency pre-flight + install hints + multi-select Post-Flight offers + write skeleton `.design/config.json` (no DS yet). Mirrors `/flow:setup-onboard` |
| Inside Claude Code, fresh repo, user says `/design:setup-ds <name> [brief]` | slash command | thin command → detect missing `.design/config.json` → **auto-invoke `/design:setup-onboard` first** (explicit message "running onboard first…") → then skill `design-system` (mode=bootstrap, first-bootstrap) → 8-Q discovery → scaffold → completeness-critic |
| Inside Claude Code, project has DS, user says `/design:setup-ds <new-name> [brief]` | slash command | thin command → skill `design-system` (mode=bootstrap, additional-ds) → reduced 7-Q discovery + Q_purpose + inheritance picker → scaffold `system/<new-name>/` → append to `designSystems[]` |
| Inside Claude Code, fresh repo, user says `/design:edit "..."` | slash command | command → skill `design` → detects missing target → if `.design/config.json` missing, auto-invoke `setup-onboard` first → then auto-load skill `design-system` (bootstrap mode, Q1 prefilled from brief) → completes bootstrap → returns to `edit` flow |
| Inside Claude Code, fresh repo, user says `/design:new "<Name>" "..."` | slash command | command → detects missing target → if `.design/config.json` missing, auto-invoke `setup-onboard` first → then auto-load skill `design-system` (bootstrap mode) → bootstrap completes → returns to `new` flow with freshly-scaffolded tokens |
| Inside Claude Code, re-bootstrap existing DS | `/design:setup-ds <existing-name> --force` | skill `design-system` (mode=bootstrap, re-bootstrap branch) → re-runs discovery → overwrites |
| Outside Claude Code, CLI-only context | `mdcc design init --no-discovery` | CLI scaffolds **Core minimum** (~10 files) with default tokens; user iterates manually via Claude Code afterward |
| Outside Claude Code, scripted (CI) | `mdcc design init --discovery-payload path.json` | CLI scaffolds Core + deterministic content from payload; still no agent content-generation |

### Three-layer responsibilities (no overlap)

| Layer | Owns | Does NOT do |
|---|---|---|
| **Slash commands** (`plugins/design/commands/*.md`) | Thin orchestration: parse args, detect lifecycle state, route to skill | Discovery, scaffolding, content generation, completeness checks |
| **Skills** (`plugins/design/skills/*/SKILL.md`) | All decisioning: discovery, mapping table, content generation, completeness invocation, post-flight prompts | Direct shell-side file I/O when CLI is available (delegates to CLI) |
| **CLI** (`mdcc design <serve\|init>`) | Dumb file I/O: copy, substitute, write. Resolves defaults from flags or `--discovery-payload`. Fail-fast on missing path | AskUserQuestion (can't), content generation, anything requiring agent reasoning |

**One pictorial diagram, in prose:**

> User → slash command → skill (decides what to do) → CLI (does the bytes-on-disk work, if available; else skill does it inline)

CLI never calls skills (skills aren't reachable from outside Claude Code). Skills shell out to CLI when they need fast deterministic copy + the binary is on PATH. Slash commands never bypass skills — they're thin wrappers that exist for discoverability.

---

## Phase 0 — Rename `/design` → `/design:edit`

### Goal

Daily verb is `/design:edit "<feedback>"`. Skill `design` keeps its name and remains the namespace-wide capability. A one-version compat stub at `/design` prints "→ /design:edit (renamed)" and forwards args. **Plus fix the bugs introduced by the partial sweep already in the working tree** — see "Fix existing damage" below.

### Open decisions

| # | Question | Default | Tradeoff |
|---|---|---|---|
| P0-D1 | Verb choice: `edit` vs `iterate` vs `update` vs `tweak` | **`edit`** | Shortest, recognized in design/IDE context, matches "editing a file in place" |
| P0-D2 | Compat stub one version, or skip? | **Keep stub one version** | Cheap; some early users have muscle memory. Removed in next minor |

### Fix existing damage (uncommitted)

The current working tree has a botched `sed` sweep. These MUST be corrected before any new work:

| File | Bug | Fix |
|---|---|---|
| `.claude-plugin/marketplace.json:11` | `"source": "./plugins/design:edit"` | Revert to `"source": "./plugins/design"` (directory path, not slash command) |
| `CLAUDE.md:9` | `**plugins/design:edit**` | Revert to `**plugins/design**` (directory bullet) |
| `plugins/design/commands/docs.md` | Identical duplicate of `setup-docs.md` | Delete `docs.md` (rename completes) |

Then proceed with the actual rename.

### Files to edit / create

- **Rename** `plugins/design/commands/design.md` → `plugins/design/commands/edit.md` (already done in WIP; verify content):
  - `name: design` → `name: edit`
  - Add `category: daily`
  - Header `# /design` → `# /design:edit`
  - Self-references inside body: `/design "..."` → `/design:edit "..."`
- **Create compat stub** at `plugins/design/commands/design.md` (currently missing):
  ```yaml
  ---
  name: design
  category: daily
  description: "Renamed to /design:edit. This stub will be removed in the next minor version. Forwarding your arguments..."
  ---
  Print: "→ /design:edit (renamed). Forwarding..." then delegate to /design:edit with the same args.
  ```
- **Sweep references** repo-wide (`rg -nF '/design ' --type md` + `rg -nF '/design"' --type md`):
  - `plugins/design/commands/*.md` cross-references
  - `plugins/design/skills/*/SKILL.md`
  - `plugins/design/agents/*.md` (10 critics)
  - `plugins/design/.claude-plugin/plugin.json` description (already partially done)
  - `.claude-plugin/marketplace.json` description (already partially done — verify after the path-revert fix)
  - `README.md`, `CLAUDE.md` (mind directory paths vs slash commands)
  - `.ai/` plans / DDRs / retros — case by case; historical mentions stay
  - **Phase 6 owns** `site/content/docs/` sweep (not Phase 0)
- **Update** `plugins/design/.claude-plugin/plugin.json` — description text

### Dependencies

None. Phase 0 is the entry point.

### Validation

- `ls plugins/design/commands/` shows `edit.md` (canonical), `design.md` (compat stub), and NO `docs.md` (deleted in favor of `setup-docs.md`)
- `rg -n '"./plugins/design"' .claude-plugin/marketplace.json` finds the path (directory reference intact)
- `rg -n '\*\*plugins/design\*\*' CLAUDE.md` finds the bullet (directory reference intact)
- Manual: `/design "make button bigger"` prints redirect; `/design:edit "make button bigger"` runs

### Risks

- **More sed-sweep damage.** The botched sweep may have hit other dir paths. Run `rg -n 'plugins/design:edit' .` — should return 0.
- **Compat-stub args forwarding.** Test with multi-word arg + special chars (`/design "make 'this' bigger"`).

---

## Phase 1 — Inspiration library + skill `design-system` bootstrap mode (dynamic scaffold)

### Goal

A **reference inspiration library** at `plugins/design/templates/design-system-inspiration/` shows what good specimens look like, organized by decision branch (always-Core vs audience-conditional vs platform-conditional vs theme-conditional). The **existing skill `design-system`** at `plugins/design/skills/design-system/SKILL.md` is extended with a **bootstrap mode** that runs Pre-Flight → Discovery (8 Qs) → Mapping → Dynamic Scaffold → Completeness-Critic → Post-Flight. The skill keeps its read-side responsibility (load context for canvas iteration) and gains write-side responsibility (create / extend / re-bootstrap a DS) — mode-switched on invocation context + project state.

**Three internal bootstrap modes:**

| Mode | Triggered when | Discovery | Output |
|---|---|---|---|
| `first-bootstrap` | No `.design/config.json` exists | Full 8-Q (Q1–Q8) | `system/project/` (default) or `system/<name>/` if `--target-ds=<name>` |
| `additional-ds` | `config.json` exists + `--target-ds=<new-name>` not in `designSystems[]` | Reduced 7-Q (skip Q1, ask Q_purpose instead) + inheritance picker | `system/<name>/` + append to `designSystems[]` |
| `re-bootstrap` | `--target-ds=<name>` exists in `designSystems[]` + `--force` | Full 8-Q with current values pre-filled | overwrite `system/<name>/` |

**Skill mode-detection at invocation:**

```
if invoked_via == "/design:setup-ds":
  mode = bootstrap
  target_ds = $ARG_NAME
elif invoked_via == "/design:edit" and not exists(.design/system/*/):
  mode = bootstrap
  target_ds = "project"
  q1_prefilled_from = $ARGUMENTS
elif invoked_via == "/design:new" and not exists(.design/system/*/):
  mode = bootstrap
  target_ds = "project"
  q1_prefilled_from = $BRIEF
else:
  mode = read  # default — load DS context for active canvas
```

### Open decisions

| # | Question | Default | Tradeoff |
|---|---|---|---|
| P1-D1 | Library lives at `plugins/design/templates/` (new) vs reuse `plugins/flow/templates/` | **New** `plugins/design/templates/` | Flow's template ships `.ai/`, design's ships `.design/` |
| P1-D2 | Library naming: `design-system-skeleton/` (old) vs `design-system-inspiration/` (new) | **`design-system-inspiration/`** | Names the role accurately — these are references, not substrate |
| P1-D3 | `.html.tpl` (with placeholders) vs plain `.html` for reference files | **All `.html` plain** — they're for the agent to READ, not substitute | Agent generates fresh files; placeholders only complicate reading |
| P1-D4 | Placeholder syntax in the few .tpl files (README, SKILL.md, config, colors_and_type.css) | **`{{name}}` double-brace** | Distinct from flow's `PROJECT_NAME` (different namespace); readable |
| P1-D5 | Skill `design-system` `user-invocable: true` or false | **`true`** — already user-invocable; bootstrap mode inherits | Direct skill invocation is rare power-user path; primary entry is `/design:setup-ds` |
| P1-D6 | Default fonts when discovery defaults: Inter+IBM Plex+JetBrains Mono vs Geist | **Inter+IBM Plex+JetBrains** (matches dugmate's v2) | Battle-tested pairs; Geist is single-family which limits hierarchy |
| P1-D7 | Library size — 62 references (full) vs 24 (lean) | **62** (full) — split into Core (10) + Conditional (~52) | More variations for agent to learn from; bytes are cheap, marginal write cost low |
| P1-D8 | Should skill bootstrap mode ask multi-DS Q in Round 1? | **No** — single-DS default; multi-DS via explicit `/design:setup-ds <name>` later | Keeps first-bootstrap clean; multi-DS is a power-user choice, not a default |
| P1-D9 | For `additional-ds` mode: offer inheritance picker (fonts / voice / mood / iconography / motion)? | **Yes — multi-select AskUserQuestion** | Typical pattern is sub-brand reuse; lets user opt-in without forcing it |

### Inspiration library shape

```
plugins/design/templates/design-system-inspiration/
├── _README.md                              # For the agent: "this is a reference inventory, not files to copy as-is"
├── _MAPPING.md                             # Decision tree: discovery answer → which files apply
├── core/                                   # Always referenced (10 files)
│   ├── README.philosophy.md.tpl            # system/project/README.md template (placeholders + structure)
│   ├── README.orchestration.md.tpl         # .design/README.md template
│   ├── SKILL.md.tpl
│   ├── INDEX.md.tpl
│   ├── config.json.tpl
│   ├── colors_and_type.css.tpl             # Token skeleton (CSS structure stays, values vary)
│   └── preview/
│       ├── _layout.css                     # Shared specimen chrome (copy as-is)
│       ├── colors-text.html                # --fg-0..3
│       ├── colors-surfaces.html            # --bg-0..4
│       ├── colors-accent.html              # one-accent rule
│       ├── type-scale.html                 # 8-step ladder
│       ├── spacing-scale.html              # 4-px base
│       ├── motion.html                     # durations + easings + reduced-motion
│       ├── components-buttons.html
│       ├── components-cards.html
│       └── components-inputs.html
├── foundations/                            # Almost always (universal foundations)
│   ├── radii.html
│   ├── elevation.html
│   ├── borders.html                        # NEW — subtle / default / strong / accent / error
│   ├── focus.html                          # NEW — focus ring tokens + contrast samples
│   ├── opacity.html                        # NEW — overlay scale (light/med/heavy/disabled)
│   ├── selection.html                      # NEW — text selection + multi-select state
│   ├── grid.html                           # NEW — layout grid columns + gutters + breakpoints
│   └── iconography.html
├── status/                                 # Almost always
│   ├── colors-status.html                  # live/rec/warn/success/info/offline
│   ├── components-status.html              # badges
│   └── skeletons.html
├── audience-pro/                           # IF audience == "pro tool"
│   ├── components-list.html                # Dense rows + selection + J/K hints
│   ├── components-toast-menu.html
│   ├── components-keyboard.html            # NEW — <kbd> rendering, key combos
│   ├── components-command-palette.html     # NEW — Cmd+K palette
│   ├── components-shortcuts-overlay.html   # NEW — keyboard cheat sheet
│   └── colors-presence.html                # Presence dots (multiplayer pro tools)
├── audience-consumer/                      # IF audience == "consumer app"
│   ├── components-marketing-card.html      # NEW
│   ├── components-testimonial.html         # NEW
│   ├── components-feature-grid.html        # NEW
│   ├── components-empty-state-generous.html# NEW — generous variant of empty state
│   └── components-banner.html              # NEW — page-level info/warn/error banners
├── audience-developer/                     # IF audience == "developer tool"
│   ├── components-terminal-pane.html       # NEW
│   ├── components-log-stream.html          # NEW
│   ├── components-diff-view.html           # NEW
│   ├── components-code-block.html          # NEW — syntax-highlighted code w/ copy button
│   ├── components-monospace-table.html     # NEW
│   └── type-mono.html                      # Promoted from foundations when developer-flavored
├── platform-mobile/                        # IF platforms includes "mobile"
│   ├── components-bottom-sheet.html        # NEW
│   ├── components-pull-to-refresh.html     # NEW
│   ├── components-tab-bar.html             # NEW
│   ├── components-segmented-control.html   # NEW
│   └── ui_kits-mobile-index.html           # NEW — mobile UI kit cover page
├── platform-desktop/                       # IF platforms includes "desktop" or "tablet"
│   ├── ui_kits-desktop-index.html
│   └── components-resize-panels.html       # NEW — split panes
├── theme-both/                             # IF theme == "both equal"
│   └── colors-themes-side-by-side.html     # NEW — dark/light comparison
├── universal/                              # Default-on unless explicitly excluded
│   ├── components-toggles.html             # NEW — switches/checkboxes/radios/segmented
│   ├── components-dialogs.html             # NEW — modal/sheet/alert
│   ├── components-tooltips.html            # NEW — tooltip + popover
│   ├── components-tabs.html                # NEW — horizontal/vertical/scrollable
│   ├── components-tables.html              # NEW — data table with sort + sticky header
│   ├── components-pagination.html          # NEW
│   ├── components-progress.html            # NEW — bar + circular + indeterminate
│   ├── components-avatars.html             # NEW — w/ presence ring + initials
│   ├── components-badges.html              # NEW — count badges + status pills + label tags
│   ├── components-search.html              # NEW — search + suggestions
│   ├── components-callout.html             # NEW — inline note/tip/warning
│   ├── components-accordion.html           # NEW
│   ├── components-stepper.html             # NEW — multi-step wizard
│   ├── components-timeline.html            # NEW — vertical event timeline
│   ├── components-stat-card.html           # NEW — KPI tile w/ delta
│   ├── components-chart-primitives.html    # NEW — bar/line/pie minimal samples
│   ├── components-breadcrumbs.html         # NEW
│   ├── empty-state.html.tpl                # Generic empty state with placeholder copy
│   └── logo.html.tpl                       # Wordmark + dot at 3 sizes (needs project name)
├── patterns/                               # Higher-level than components (cherry-picked)
│   ├── patterns-form-layouts.html          # NEW — single col / two col / inline labels / floating
│   ├── patterns-error-pages.html           # NEW — 404 / 500 / offline / maintenance
│   ├── patterns-onboarding.html            # NEW — welcome screens, tour highlights
│   ├── patterns-auth.html                  # NEW — login / signup / forgot
│   ├── patterns-pricing.html               # NEW
│   └── patterns-data-density.html          # NEW — same data sparse vs compact
└── meta/                                   # Cross-cutting references
    ├── tokens-index.html                   # NEW — visual TOC of all tokens
    ├── accessibility.html                  # NEW — focus order, semantic HTML, ARIA samples
    ├── i18n.html                           # NEW — RTL support, long-text-overflow, pluralization
    └── presence-multiplayer.html           # NEW — Phase 8 collab cursor preview (forward-pointer)
```

**Total: ~60 reference files** (10 Core + 8 Foundations + 3 Status + 6 Pro + 5 Consumer + 6 Developer + 5 Mobile + 2 Desktop + 1 Theme-both + 18 Universal + 6 Patterns + 4 Meta).

Skill `init` cherry-picks **10-22 per project** based on the mapping table (see below).

### Discovery question variants per mode

**`first-bootstrap` (8 Qs):** Q1–Q8 as documented in retro R3.

**`additional-ds` (8 Qs, different shape):**

| # | Question | Notes |
|---|---|---|
| Q_purpose | "What is this DS for, distinct from your existing DS?" | Freetext. Replaces Q1 (project one-liner — already known from existing DS) |
| Q2 audience | Same options as first-bootstrap | Often different (marketing DS = consumer vs admin DS = pro) |
| Q3 platforms | Same options | Often different (marketing = mobile+desktop, admin = desktop only) |
| Q4 theme default | Same options | Often different (marketing = light, admin = dark) |
| Q5 mood references | Same options | Usually different (sub-brand drift) |
| Q6 brand color | Same options | Usually a sub-brand of existing accent |
| Q7 typography | Same options + "Inherit from `<existing-ds>`" Recommended option | Common case is fonts inherit |
| Q8 content tone | Same options + "Inherit from `<existing-ds>`" Recommended option | Common case is voice inherit |

**`additional-ds` inheritance picker (after Q8):**

```
Inherit from <existing-ds> DS? (multi-select)
  [x] Typography (font_display, font_body, font_mono)
  [ ] Voice / content tone
  [ ] Iconography family
  [x] Motion durations
  [ ] None — define fresh
```

Inherited values are pre-baked into the new DS's `colors_and_type.css`; user's discovery answers for inherited fields are ignored.

**`re-bootstrap` (8 Qs, all pre-filled with current values, editable):**

Read `system/<ds>/colors_and_type.css` + `system/<ds>/README.md` to pre-fill answers. User can hit enter on each to keep current; only changed answers cause re-generation of affected files.

### Mapping table: discovery answer → which files to scaffold

| Discovery dimension | Answer | Effect |
|---|---|---|
| Q2 audience | pro tool | + `audience-pro/*` (6 files), promote dense components to Core |
| Q2 audience | consumer app | + `audience-consumer/*` (5 files), prefer generous spacing |
| Q2 audience | developer tool | + `audience-developer/*` (6 files), promote `type-mono.html` to Core |
| Q3 platforms | desktop only | + `platform-desktop/*` (2 files) |
| Q3 platforms | mobile + desktop | + `platform-desktop/*` + `platform-mobile/*` (7 files) |
| Q3 platforms | tablet-first | + `platform-desktop/*` (renamed conceptually, tablet content) |
| Q4 theme | dark default | colors_and_type.css single `[data-theme="dark"]` block |
| Q4 theme | light default | single `[data-theme="light"]` block |
| Q4 theme | both equal | both blocks + `theme-both/colors-themes-side-by-side.html` |
| Q5 mood | Linear/Figma/posthog | Lucide icons, tighter radii (`xs: 4px`, `sm: 6px`), faster motion (`flip: 140ms`) |
| Q5 mood | Stripe/Vercel/Notion | Phosphor or Heroicons, larger radii (`md: 12px`), calmer motion (`flip: 200ms`) |
| Q5 mood | Zed/Raycast/Arc | Lucide thin (1px stroke), aggressive radii (`pill: full`), snappy motion (`flip: 120ms`) |
| Q6 brand color | "pick for me" | Skill picks OKLCH from mood references |
| Q6 brand color | explicit hex | Skill converts to OKLCH, derives hover/active/fg |
| Always (universal) | — | + 4-6 universal components based on audience (toggles, dialogs, tooltips, tables, callouts, avatars, badges) |
| Always (status) | — | + `status/*` (3 files) unless audience explicitly excludes (rare) |
| Always (foundations) | — | + `foundations/{radii,elevation,borders,focus}.html` always; others (opacity, selection, grid) based on audience |

**Typical scaffold sizes:**

| Project type | Approx file count |
|---|---|
| Marketing site (consumer, desktop only, dark) | ~12 specimens |
| Pro-tool SaaS (pro, desktop+mobile, dark) | ~22 specimens |
| Developer CLI dashboard (developer, desktop only, dark) | ~14 specimens |
| Consumer mobile app (consumer, mobile, light) | ~16 specimens |
| Enterprise admin (pro, desktop, both themes) | ~20 specimens |

### Reference file contracts

Each reference file under `design-system-inspiration/` includes a top-of-file HTML comment for the agent:

```html
<!--
SPECIMEN: components-buttons
DEMONSTRATES: --accent, --accent-hover, --accent-active, --accent-fg, --bg-1, --bg-2, --radius-md, --shadow-sm, --dur-flip
COMPOSITION: 4 variants × 5 states grid (primary/secondary/ghost/destructive × idle/hover/active/disabled/loading)
COPY VOICE: action verbs, no marketing puffery ("Save", "Delete", not "Get Started Now!")
WHEN SCAFFOLDED: always (Core)
NOTES: Loading state must use --accent-fg on accent bg; never spinner-only — loading skeleton-or-pulse preferred
-->
```

Skill `init` reads these comments to know what each reference is for and how to generate a project-flavored equivalent.

### `_MAPPING.md` content

A single markdown file that captures the discovery → scaffold table above PLUS the "always include Universal X, Y, Z if audience is A". Lives in the library so the skill prompt body stays tight; the skill body just says "consult `_MAPPING.md`".

### Skill `design-system` SKILL.md body — extended for bootstrap mode

The existing skill file at `plugins/design/skills/design-system/SKILL.md` is **extended** (not replaced). The frontmatter `description:` field is rewritten to cover both responsibilities; a new "## Bootstrap flow" section is added below the existing read-side guidance.

```yaml
---
name: design-system
description: Owns all design-system work. (1) READ mode (default): loads the active canvas's declared DS — tokens, philosophy, hard-stops — so the agent can iterate against the correct context. (2) BOOTSTRAP mode (when invoked via /design:setup-ds, OR auto-loaded by /design:edit /design:new on a missing target): runs dependency pre-flight, asks 8 discovery questions across 2 AskUserQuestion rounds (3 mode-variants: first-bootstrap / additional-ds / re-bootstrap), consults _MAPPING.md to compute the scaffold set, GENERATES project-flavored files using design-system-inspiration as reference, runs design-system-completeness-critic, and offers smooth-start follow-ups.
user-invocable: true
---
```

The SKILL.md body has three top-level sections:

1. **`## Read flow (canvas iteration)`** — existing content describing how to load active DS context. Phase 4 will append a "Multi-DS lookup pattern" sub-section here.
2. **`## Bootstrap flow (create / extend / re-bootstrap a DS)`** — NEW. Contains Pre-Flight / Discovery / Mapping / Scaffold / Post-Flight (full spec below).
3. **`## Mode-detection (which flow to run)`** — NEW. The pseudo-code from "Phase 1 Goal" above, plus tiebreakers (e.g. if both modes plausible, prefer read).

#### Pre-Flight (LIGHT — bootstrap mode only)

Bootstrap-mode Pre-Flight is **minimal** — checks only hard deps + presence of skeleton config. Rich environment onboarding (soft dep hints, install offers, CLAUDE.md / .ai/ recommendations) is the responsibility of `/design:setup-onboard` (see Phase 2D).

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Hard deps (abort on miss)
NODE_OK=false; command -v node &>/dev/null && \
  [[ "$(node -v | sed 's/v//;s/\..*//')" -ge 20 ]] && NODE_OK=true
GIT_OK=false; git -C "$REPO_ROOT" rev-parse &>/dev/null && GIT_OK=true
[[ -w "$REPO_ROOT" ]] || WRITE_OK=false

# Skeleton config check — if missing, auto-invoke setup-onboard first
if [[ ! -f "$REPO_ROOT/.design/config.json" ]]; then
  echo "→ .design/config.json missing. Running /design:setup-onboard first…"
  Skill.invoke("setup-onboard")   # transparent auto-invoke
  # After onboard returns, config.json exists; proceed with bootstrap
fi
```

Hard-stops: missing Node → abort with install hint; missing git → abort with "run `git init` first"; no write permission → abort.

**No Post-Flight prompts here** — those moved to `/design:setup-onboard`. Bootstrap mode just prints "Bootstrap complete. Next: …" at the end of scaffold.

#### Discovery (Round 1 + Round 2 + confirm)

1. **Detect target.** Read `<repo>/.design/config.json` for `designRoot` (default `.design`). Check `<designRoot>/system/project/` exists.
2. **If exists**: refuse unless `--force`. Print "Already bootstrapped. Use `/design:edit "<feedback>"` to iterate."
3. **Round 1 — Identity** (4 Qs via AskUserQuestion):
   - Q1 product one-liner (sketch / reuse from PRD / skip)
   - Q2 audience (pro tool / consumer app / developer tool)
   - Q3 platforms (desktop only / mobile + desktop / tablet-first)
   - Q4 theme default (dark / light / both equal)
4. **Round 2 — Brand + content** (4 Qs):
   - Q5 mood references (Linear+Figma+posthog / Stripe+Vercel+Notion / Zed+Raycast+Arc)
   - Q6 brand color (pick-for-me / I have a hex / cyan|indigo|emerald|amber default)
   - Q7 typography (Inter+Plex+JetBrains / Geist+GeistMono / system+JetBrainsMono)
   - Q8 content tone (direct-terse / explanatory-friendly / formal-B2B)
5. **Confirm.** Echo 2-sentence proposed direction. Wait for explicit yes / corrections. On "no", restart Round 2 only (max 2 retries before "scaffold-with-current and iterate via /design:edit").

#### Mapping → file set

6. **Consult `_MAPPING.md`** in the inspiration library. Compute the file set based on Q2/Q3/Q4 (structural) and bake Q1/Q5/Q6/Q7/Q8 into the content of every generated file. Also compute `activeFamilies[]` (which token families are present — e.g., `["accent","status","presence","mono"]` for a pro tool with multiplayer, `["accent","status"]` for a marketing site).

#### Scaffold (dynamic)

7. **Generate files.** For each file in the computed set:
   - **Core files** (README, SKILL.md, colors_and_type.css, INDEX.md, config.json): substitute placeholders from discovery payload into the `.tpl` files in `core/`. If `MDCC_OK=true`, shell out to `mdcc design init --discovery-payload <path>` for these. Else inline Write.
   - **Specimen files**: read the corresponding reference in the inspiration library, then **GENERATE a fresh project-flavored version** — same layout/composition, project's tokens, project's copy voice. No placeholder copy ("Lorem Solutions Inc.") in the output.
8. **Write** `<designRoot>/config.json` with `extensions: []`, `completenessProfile: "standard"`, and the computed `activeFamilies[]`.
9. **Write** `<designRoot>/system/project/SKILL.md` with `agent: ${project_slug}-design`.
10. **Run completeness-critic** (Phase 3). Exit non-zero only if it returns blockers (rare — the mapping table is designed to pass the standard profile).

#### Post-Flight (slim — bootstrap-specific only)

Bootstrap-mode Post-Flight is **slim** — only DS-specific follow-ups (no environment offers, those belong to `setup-onboard`):

- Optionally: surface a one-shot AskUserQuestion offering `mdcc design serve` if not already running (so the user can browse the freshly-generated specimens)

Everything else (CLAUDE.md, .ai/, agent-browser install hints) was handled during `setup-onboard` BEFORE bootstrap ran. If `setup-onboard` was skipped (user invoked `/design:setup-ds` directly on an already-onboarded project), Post-Flight just prints the next-steps block below.

#### Always-print next steps

```
Bootstrap complete. .design/ scaffolded at <repo>/.design/system/project/.
  <N> specimen pages under preview/ (audience: <Q2>, platforms: <Q3>)
  config.json: 14 fields populated (incl. extensions, completenessProfile, activeFamilies)
  completeness-critic: 0 blockers, <N> warnings

Daily verbs:
  /design:edit "<feedback>"   — iterate on a specimen
  /design:new "<Name>" "..."  — add a new full canvas
  /design:browse              — open the dev server tab
  /design:critic              — run all critics on active canvas
  /design:help                — grouped command index
```

### Mode-detection section in SKILL.md body

```markdown
## Mode-detection (which flow to run)

At every invocation, decide which flow to execute:

- If invoked via `/design:setup-ds <name>` → BOOTSTRAP, target_ds = <name>
- If invoked via `/design:edit "..."` or `/design:new "..."` and no `system/*/` exists → BOOTSTRAP, target_ds = "project", Q1 prefilled from $ARGUMENTS / $BRIEF
- If invoked via `/design:setup-ds <existing-name> --force` → BOOTSTRAP (re-bootstrap), target_ds = <existing-name>
- Otherwise (active canvas exists, system/*/ exists) → READ (default)

When in BOOTSTRAP mode, further classify into sub-modes:
- `first-bootstrap` — `.design/config.json` does not exist
- `additional-ds` — config exists, target_ds is NOT in `designSystems[]`
- `re-bootstrap` — config exists, target_ds IS in `designSystems[]`, `--force` passed (else refuse)
```

(Phase 4 will append a sibling "Multi-DS lookup pattern" subsection inside `## Read flow`.)

### `colors_and_type.css.tpl` token contract

- **OKLCH** for the accent family + status colors (better gamut control than HSL/hex)
- Groups in dugmate order: surfaces → borders → text → accent → status → presence → shadows → radii → spacing → typography → motion → layout
- **One-accent rule** baked in (no `--accent2`)
- Motion tokens: `--dur-flip/panel/route/soft`, `--ease-out/in-out`
- `@media (prefers-reduced-motion: reduce)` guard
- Selector: `:root, .{{root_class}}[data-theme="dark"] { ... }` (or both blocks if Q4 == both equal)

### `config.json.tpl` — full 14 fields (was 11)

```json
{
  "$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/design/dev-server/config.schema.json",
  "name": "{{project_name}}",
  "projectLabel": "{{project_label}}",
  "designRoot": ".design",
  "canvasGroups": [
    { "label": "Design system", "path": "system" },
    { "label": "UI kit", "path": "ui" }
  ],
  "rootClass": "{{root_class}}",
  "themeDefault": "{{theme_default}}",
  "tokensCssRel": "system/project/colors_and_type.css",
  "teamAccentDefault": null,
  "handoffTargets": {{handoff_targets}},
  "newCanvasDir": "ui/project",
  "newComponentDir": "ui/project/components",
  "extensions": [],
  "completenessProfile": "standard",
  "activeFamilies": {{active_families}}
}
```

New fields:
- `extensions: []` — array of `{ label, path }` for user-added directories the docs renderer / critic should track
- `completenessProfile: "standard"` — `minimal | standard | strict`. Tunes Phase 3 critic severity
- `activeFamilies: []` — array of token families present in this project (`"accent" | "status" | "presence" | "mono" | ...`). Computed during scaffold; user can edit. Critic uses this to scope checks

### Phase 1A deliverables (files to create)

All under `plugins/design/templates/design-system-inspiration/` — see "Inspiration library shape" above.

### Phase 1B deliverables (skill `design-system` bootstrap mode)

- **Extend** `plugins/design/skills/design-system/SKILL.md`:
  - Rewrite frontmatter `description:` to cover both READ and BOOTSTRAP responsibilities
  - Add `## Bootstrap flow` section (full Pre-Flight / Discovery / Mapping / Scaffold / Post-Flight spec)
  - Add `## Mode-detection` section
  - Keep existing `## Read flow` content (rename header if needed for symmetry)
- **Delete** any stub `plugins/design/skills/init/` directory if it was created in earlier WIP (it must not exist after Phase 1)
- **Add** `plugins/design/templates` to `package.json` `files` field (otherwise mdcc ships broken)

### Discovery question reference

Already specified in the retro (R3). Confirm 8 questions across 2 Rounds, each with "Recommended" first + Other free-text.

### Dependencies

- **Requires Phase 0** (rename is settled; skill `design-system` bootstrap flow references `/design:edit`)

### Validation

- `cp -R plugins/design/templates/design-system-inspiration /tmp/check` succeeds; every reference file has the SPECIMEN comment header
- `cat plugins/design/templates/design-system-inspiration/_MAPPING.md` documents every discovery → file mapping
- Skill auto-load: in a scratch repo, `/design:edit "make button bigger"` against missing `.design/` triggers skill `design-system` in `first-bootstrap` mode with Q1 prefilled
- Slash command: `/design:setup-ds marketing "marketing site"` in a project with existing `system/project/` triggers `additional-ds` mode with Q_purpose + inheritance picker
- Re-bootstrap: `/design:setup-ds project --force` triggers `re-bootstrap` mode with current values pre-filled
- Scaffold count varies by answers: marketing-site discovery profile → ~12 files; pro-tool discovery → ~22 files; both pass completeness-critic with standard profile
- Read mode still works: with system already present, `/design:edit "..."` does NOT trigger bootstrap; loads DS context for canvas iteration

### Risks

- **Agent under-generates copy.** Without enough guidance, agent writes generic specimens. Mitigation: each SPECIMEN comment includes "COPY VOICE" guidance; mapping table refers to Q1/Q8 for context.
- **Library file count high.** ~60 files in inspiration is a lot of write effort in Phase 1. Mitigation: prioritize Core (10) + Universal (~6 most-used) + one-per-audience-branch first; remaining "rich" specimens can land in a follow-up Phase 1.5 if time-boxed.
- **Skill prompt length.** SKILL.md becomes long (read flow + bootstrap flow + mode detection in one file). Mitigation: factor mapping into `_MAPPING.md`; factor inspiration library into `_README.md` of templates dir; SKILL.md body just orchestrates.
- **Mode-detection ambiguity.** Skill might pick wrong mode if invocation context is unclear. Mitigation: explicit checks in `/design:edit` and `/design:new` command bodies — they pass `mode_hint=bootstrap` when target is missing so skill doesn't have to infer.
- **Read flow regression.** Adding bootstrap logic could break existing read-side behavior. Mitigation: keep `## Read flow` section first in SKILL.md body; bootstrap is opt-in via explicit invocation or missing-target trigger.

---

## Phase 2 — Categorization + `/design:setup-ds` command + missing-state hooks + CLI helper

### Goal

Design plugin command surface follows flow's `<group>-<verb>` convention. New `/design:setup-ds` slash command is the discoverable entry point for creating a DS. `/design:edit` and `/design:new` detect missing target and load skill `design-system` in bootstrap mode. New `mdcc design init` CLI helper for non-interactive contexts.

### Final categorization (11 commands → 2 groups)

| Group | Count | Commands |
|---|---|---|
| **daily** (no prefix) | 8 | `edit`, `new`, `critic`, `browse`, `rollback`, `screenshot`, `handoff`, `help` (new) |
| **setup-*** | 3 | `setup-docs` (was `docs.md`), `setup-ds` (new), `setup-onboard` (new — mirrors `/flow:setup-onboard`) |

Plus one compat stub at `design.md` (Phase 0) — removed in next minor.

### Open decisions

| # | Question | Default | Tradeoff |
|---|---|---|---|
| P2-D1 | `handoff` stays daily or becomes `ship-handoff`? | **Stay daily** — mirrors flow's `release` daily verb | Future `handoff-mobile`, `handoff-web` siblings can live in `handoff-*` group |
| P2-D2 | CLI: `mdcc design init` vs flag on `mdcc init` | **`mdcc design init`** — mirrors `mdcc design serve` | `mdcc init` owns `.ai/`; conflating confuses |
| P2-D3 | CLI shell-out from skill `design-system` (bootstrap) | **Write discovery payload to temp file; pass path** | Avoids shell-escaping JSON-on-argv |
| P2-D4 | `/design:help` auto-generates or hardcodes? | **Auto-generate from frontmatter** — same pattern as `/flow:help` | DRY |
| P2-D5 | CLI scope | **Core scaffold only** — no AskUserQuestion, no content generation, no completeness-critic invocation | CLI is a helper. Interactive bootstrap is skills' job |
| P2-D6 | `/design:setup-ds` accepts brief as positional arg? | **Yes** — `/design:setup-ds <name> "[brief]"` | Brief is optional; if absent, skill asks Q1 (first) or Q_purpose (additional). If present, skips that Q |
| P2-D7 | `/design:new --ds=<unknown>` behavior | **Fail with hint** to `/design:setup-ds` — no fallback prompt | Clean separation: `new` does canvases, `setup-ds` does DS creation |

### Phase 2A — categorization + new `/design:setup-ds` command

- **Delete** `plugins/design/commands/docs.md` (duplicate of `setup-docs.md` from current WIP)
- **Confirm** `setup-docs.md` has `name: setup-docs` + `category: setup` + path-corrected references
- **Create** `plugins/design/commands/setup-ds.md`:
  - Frontmatter: `name: setup-ds`, `category: setup`, `argument-hint: "<name> [\"<brief>\"] [--force]"`
  - Description: "Create a new design system (or re-bootstrap an existing one with --force). Thin wrapper → loads skill `design-system` in bootstrap mode with `target_ds=<name>`. First DS or additional DS — skill auto-detects."
  - Body: parse args; check `.design/config.json` exists — if missing, auto-invoke `setup-onboard` first with explicit message "→ Running /design:setup-onboard first to initialize project…"; then invoke `Skill design-system` with `mode=bootstrap`, `target_ds=$1`, `brief=$2`, `force=$3`
- **Create** `plugins/design/commands/setup-onboard.md`:
  - Frontmatter: `name: setup-onboard`, `category: setup`, `argument-hint: "[--skip-prompts]"`
  - Description: "One-time project-level environment init for the design plugin. Detects missing dependencies (node ≥ 20, git, agent-browser, mdcc), prints install hints for soft deps, offers to run `/init` for CLAUDE.md and `/flow:setup-onboard` for .ai/, and writes a skeleton `.design/config.json`. Does NOT create a design system — use `/design:setup-ds <name>` for that. Mirrors `/flow:setup-onboard`."
  - Body: full Pre-Flight + Post-Flight spec (see Phase 2D below)
- **Add `category:` frontmatter** to all 8 daily commands:
  - `edit.md`, `new.md`, `critic.md`, `browse.md`, `rollback.md`, `screenshot.md`, `handoff.md`, `help.md` (new) → `category: daily`
- **Create** `plugins/design/commands/help.md` — reads frontmatter from sibling command files, prints grouped index (mirror of `plugins/flow/commands/help.md`)
- **Create** `plugins/design/CATEGORIES.md` — section per group with command table, naming convention, rename history (mirror of `plugins/flow/CATEGORIES.md`); document the two `setup-*` entries explicitly
- **Sweep `/design:docs` → `/design:setup-docs`** across repo
- **Update** `plugins/design/.claude-plugin/plugin.json` `commands` description text — include `setup-ds`
- **Update** `.claude-plugin/marketplace.json` design plugin description (after the path-revert from Phase 0)
- **Update** `plugins/design/README.md` — grouped index pointing at `CATEGORIES.md`

### Phase 2B — missing-state hooks

- **Edit** `plugins/design/commands/edit.md` — add to top of body:
  ```markdown
  ## Pre-flight: bootstrap detection

  Before any edit work, check if `<designRoot>/system/project/` (or any `<designRoot>/system/<name>/` from `config.json.designSystems[]`) exists. If NOTHING exists, this is a fresh project:
  1. If `.design/config.json` is also missing, auto-invoke `/design:setup-onboard` first (explicit message: "→ Running /design:setup-onboard to initialize project…").
  2. Then invoke `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$ARGUMENTS`. The skill will detect `first-bootstrap` mode, treat the brief as the answer to discovery Question 1, run Rounds 1–2, confirm direction, and scaffold before returning here.
  3. Once `<designRoot>/system/<...>/` exists, proceed with normal edit-in-place flow.
  ```
- **Edit** `plugins/design/commands/new.md` — analogous pre-flight: if no DS, run onboard (if config missing) → then bootstrap via `Skill design-system` with `mode_hint=bootstrap`, `target_ds=project`, `brief=$BRIEF`. After bootstrap completes, create the requested new canvas using the freshly-scaffolded tokens.
- **No edits to** other commands (`critic`, `browse`, `rollback`, `screenshot`, `handoff`, `setup-docs`) — they assume an existing system; on empty repo, print a one-line hint pointing to `/design:setup-onboard` (or `/design:setup-ds` if config already present).

### Phase 2C — CLI helper

- **Edit** `cli/commands/design.mjs`:
  - Add `init` sub-subcommand alongside `serve`
  - Help: `mdcc design <serve|init> [options]`
  - On `init`:
    - Parse `--name <slug>`, `--force`, `--dry-run`, `--no-discovery`, `--discovery-payload <path>`
    - **Without `--no-discovery` or `--discovery-payload`**: refuse with message "Interactive bootstrap requires Claude Code. Use `/design:setup-ds <name>` there, or pass `--no-discovery` for defaults"
    - **With `--no-discovery`**: scaffold Core only (10 files from `templates/design-system-inspiration/core/`) with Recommended defaults. Print warning: "Core scaffold only. For full bootstrap, use Claude Code's `/design:setup-ds <name> [brief]`"
    - **With `--discovery-payload <path>`**: read JSON, substitute placeholders, scaffold Core + the discovery-derived specimens. This is the path skill `design-system` (bootstrap mode) uses when shelling out
    - Resolve skeleton: `${pluginRoot}/templates/design-system-inspiration/`
    - Call `copyTree` with `{ rename: stripTplSuffix, transform: substitutePlaceholders }`
    - Refuse if `<cwd>/.design/system/project/` exists and no `--force`
- **Edit** `cli/lib/copy-tree.mjs` — add `rename` hook for `.tpl`-stripping (~10 LOC)
- **Edit** `cli/commands/help.mjs` — surface `mdcc design init`
- **Edit** `cli/bin/mdcc.mjs` — route `design init`

### Phase 2D — `/design:setup-onboard` command body

Mirror of `/flow:setup-onboard`. Self-contained markdown command body — no separate skill (the work is straightforward enough to inline). Lives at `plugins/design/commands/setup-onboard.md`.

**Behavior:**

#### Step 1: Dependency pre-flight

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Hard deps (abort on miss)
NODE_OK=false; command -v node &>/dev/null && \
  [[ "$(node -v | sed 's/v//;s/\..*//')" -ge 20 ]] && NODE_OK=true
GIT_OK=false; git -C "$REPO_ROOT" rev-parse &>/dev/null && GIT_OK=true

# Soft deps (warn on miss, never auto-install)
MDCC_OK=false;          command -v mdcc &>/dev/null && MDCC_OK=true
AGENT_BROWSER_OK=false; command -v agent-browser &>/dev/null && AGENT_BROWSER_OK=true
CLAUDE_MD_OK=false
[[ -f "$REPO_ROOT/CLAUDE.md" || -f "$REPO_ROOT/.claude/CLAUDE.md" ]] && CLAUDE_MD_OK=true
AI_WORKSPACE_OK=false
[[ -f "$REPO_ROOT/.ai/workflows.config.json" ]] && AI_WORKSPACE_OK=true
DESIGN_DIR_OK=false
[[ -d "$REPO_ROOT/.design" ]] && DESIGN_DIR_OK=true
DESIGN_CONFIG_OK=false
[[ -f "$REPO_ROOT/.design/config.json" ]] && DESIGN_CONFIG_OK=true
```

Hard-stops: missing Node → abort with install hint; missing git → abort with "run `git init` first".

**Print Pre-flight summary block** (table format):

```
Pre-flight summary
──────────────────
  node          ✓ v22.5.1
  git           ✓ initialized
  mdcc          ✓ v0.7.0                    ← scaffold via CLI available
  agent-browser ✗ missing                    ← needed for screenshot + 5 critics
  CLAUDE.md     ✗ missing                    ← /init recommended
  .ai/          ✗ missing                    ← /flow:setup-onboard recommended
  .design/      ✗ missing                    ← will create skeleton
  config.json   ✗ missing                    ← will create skeleton

Hard deps satisfied. 4 soft items to address.
```

#### Step 2: Write skeleton `.design/config.json` if missing

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/1aGh/md-claude/main/plugins/design/dev-server/config.schema.json",
  "name": "<repo-basename-as-fallback>",
  "designRoot": ".design",
  "canvasGroups": [
    { "label": "Design system", "path": "system" },
    { "label": "UI kit", "path": "ui" }
  ],
  "extensions": [],
  "completenessProfile": "standard",
  "activeFamilies": [],
  "designSystems": [],
  "defaultDesignSystem": null
}
```

DS-specific fields (`rootClass`, `tokensCssRel`, `themeDefault`, `teamAccentDefault`, `handoffTargets`, `newCanvasDir`, `newComponentDir`) are **NOT** set here — they get added when `/design:setup-ds` creates the first DS.

Also `mkdir -p .design/` if absent.

#### Step 3: Post-flight multi-select offers

Single `AskUserQuestion` (multiSelect = true) listing the soft deps that came up missing. User picks none / some / all. Honor `--skip-prompts` flag.

```
What should I help with next? (multi-select; "none" is fine)

  [ ] Print `npm i -g agent-browser` install hint (needed for screenshot + 5 critics)
  [ ] Print `npm i -g @1agh/md-claude` install hint (faster scaffold via CLI helper)
  [ ] Run `/init` to generate CLAUDE.md (recommended — agents need it)
  [ ] Run `/flow:setup-onboard` to scaffold .ai/ workspace (enables /flow:plan to see the design system)
  [ ] None — I'll handle setup myself
```

**Behavior per selection:**

- **agent-browser hint** → print `npm i -g agent-browser` + one-liner on what it unlocks (screenshot, auto-loop, axe-core a11y)
- **mdcc hint** → print `npm i -g @1agh/md-claude` + note about `mdcc design serve` and `mdcc design init`
- **Run /init** → print "Run `/init` now — Anthropic's built-in command analyzes the codebase and writes CLAUDE.md." (cannot programmatically invoke another slash command from inside one)
- **Run /flow:setup-onboard** → print "Run `/flow:setup-onboard` now to scaffold `.ai/` workspace."

#### Step 4: Print next-step summary

```
Onboard complete.
  .design/config.json: skeleton written (no DS yet)
  Hard deps: ✓ all satisfied
  Soft deps surfaced: <list>

Next:
  /design:setup-ds <name> "[brief]"   — create your first design system
  /design:edit "<describe a product>" — bootstrap implicitly via /design:edit
```

#### Behavior matrix

| State | Behavior |
|---|---|
| `.design/config.json` missing, called from terminal | Full Pre-flight + write skeleton + Post-flight prompts |
| `.design/config.json` missing, auto-invoked by `setup-ds` | Same flow, but Post-flight is "thin" (skip multi-select if `--skip-prompts` passed by parent) |
| `.design/config.json` present, called explicitly | Re-run Pre-flight summary + offer Post-flight prompts again ("re-check environment") |
| `.design/config.json` present, auto-invoked by `setup-ds` | No-op — short-circuit immediately ("environment already initialized") |

### Dependencies

- **Requires Phase 0** (canonical `/design:edit` exists)
- **Requires Phase 1** (skill `design-system` bootstrap mode exists; inspiration library exists; `package.json` `files` includes templates)

### Validation

- `ls plugins/design/commands/` shows: `edit.md`, `new.md`, `critic.md`, `browse.md`, `rollback.md`, `screenshot.md`, `handoff.md`, `help.md`, `setup-docs.md`, `setup-ds.md`, `setup-onboard.md` (11 files), plus `design.md` (compat stub)
- `for f in plugins/design/commands/*.md; do grep -q '^category:' "$f" || echo "MISSING: $f"; done` returns empty (or compat stub only)
- `/design:help` prints grouped index matching `CATEGORIES.md` — `setup-*` group has 3 entries (`setup-docs`, `setup-ds`, `setup-onboard`)
- Empty-repo `/design:setup-onboard` writes skeleton `.design/config.json`, prints Pre-flight summary, prompts multi-select offers
- Empty-repo `/design:edit "make a posthog-style system"` auto-invokes `setup-onboard` (because config missing) → then triggers skill `design-system` (bootstrap, first-bootstrap mode) with Q1 prefilled, runs through Round 1 Q2-Q4 + Round 2 Q5-Q8, scaffolds, runs completeness-critic, returns to `/design:edit`
- Already-onboarded repo: `/design:setup-ds marketing "..."` skips onboard (config exists) and goes straight to bootstrap
- `/design:setup-ds marketing "consumer marketing site"` in a project with existing `system/project/` triggers skill `design-system` (bootstrap, additional-ds mode) with Q_purpose prefilled from brief, asks Q2–Q8 + inheritance picker, scaffolds `system/marketing/`, appends to `designSystems[]`
- `/design:setup-ds project --force` triggers `re-bootstrap` with current values pre-filled
- `mdcc design init` (no flags) prints helpful refusal pointing at Claude Code
- `mdcc design init --no-discovery --name acme` produces 10 Core files using Recommended defaults
- Re-running in same dir prints refusal unless `--force`

### Risks

- **`AskUserQuestion` 4-max constraint.** Confirmed — 2 rounds × 4 is the only viable shape
- **Discovery payload temp file leak.** CLI must `unlink` even on error path
- **Sweep miss for `docs` → `setup-docs`.** Hits: cross-refs in other commands, README, marketplace.json, site docs (site sweep is Phase 6's job)
- **CLI scope creep.** Tempting to make CLI do more; resist. Keep it a thin helper

---

## Phase 3 — Adaptive completeness-critic

### Goal

New agent `plugins/design/agents/design-system-completeness-critic.md` validates `<designRoot>/system/<name>/` against a **3-tier rule set** (Core / Conventional / Free-form) calibrated by `config.json.completenessProfile` and `config.json.activeFamilies`. Opt-in via `/design:critic --system-only`; auto-runs at end of skill `design-system` bootstrap flow.

### Open decisions

| # | Question | Default | Tradeoff |
|---|---|---|---|
| P3-D1 | Auto-routed on every `/design:edit`? | **Opt-in + auto at end of skill `design-system` bootstrap flow. NOT every edit.** | Edits don't change structure; wasted spend |
| P3-D2 | Reads what? | **Tree (Glob/Read) + Grep over each `.html` for `<link>` to `tokensCssRel`** | Both <100 LOC of agent prose |
| P3-D3 | Output | **Markdown report + JSON verdict** | Matches existing critics |
| P3-D4 | Severity | **Blocker / Warning / Info** | Matches sibling critics |
| P3-D5 | Multi-DS scope | **Scope to one DS at a time; flag in panel report which DS was checked** | Avoids cross-DS rule confusion |

### 3-tier rules

**Tier 1 — Core (Blocker if missing, regardless of profile):**

| # | Check | Notes |
|---|---|---|
| C1 | `<designRoot>/README.md` exists | Orchestration layer |
| C2 | At least one valid DS dir under `<designRoot>/system/`: either `project/` (single-DS default) OR `<name>/` matching a `config.json.designSystems[]` entry (Phase 4 multi-DS) | Reject if dirname == project slug (D2 divergence) |
| C3 | `system/<ds>/README.md` exists (philosophy layer) | |
| C4 | `system/<ds>/SKILL.md` exists with valid frontmatter (`name`, `description`, `user-invocable`) | |
| C5 | `system/<ds>/colors_and_type.css` exists at `config.json.tokensCssRel` path | |
| C6 | Core vars present in tokens CSS: `--accent`, `--bg-0..4`, `--fg-0..3`, `--dur-flip` (or equivalent motion var) | Mono-font check moved to activeFamilies-gated |
| C7 | Exactly **one** `--accent*` family (no `--accent2`) | One-accent rule |
| C8 | `<designRoot>/system/<ds>/preview/` exists with ≥ N specimens where N depends on `completenessProfile`: minimal=3, standard=8, strict=12 | Was hardcoded "≥15" — now adaptive |

**Tier 2 — Conventional (Warning, gated by `activeFamilies` and `completenessProfile`):**

| # | Check | Profile | Gate |
|---|---|---|---|
| V1 | `<designRoot>/INDEX.md` exists | standard+ | always |
| V2 | OKLCH used for ≥1 color | standard+ | always |
| V3 | Each specimen `<link>`s `tokensCssRel` | standard+ | always (warning per missing) |
| V4 | `system/<ds>/preview/colors-*.html` exists | standard+ | always |
| V5 | `system/<ds>/preview/type-*.html` exists | standard+ | always |
| V6 | `system/<ds>/preview/spacing-scale.html` exists | standard+ | always |
| V7 | `system/<ds>/preview/components-*.html` exists (≥3 component specimens) | standard+ | always |
| V8 | `system/<ds>/preview/motion.html` exists | standard+ | always |
| V9 | `system/<ds>/preview/status-*.html` exists | standard+ | IF `"status" ∈ activeFamilies` |
| V10 | `system/<ds>/preview/colors-presence.html` exists | standard+ | IF `"presence" ∈ activeFamilies` |
| V11 | `system/<ds>/preview/type-mono.html` exists | standard+ | IF `"mono" ∈ activeFamilies` |
| V12 | `system/<ds>/ui_kits/desktop/` populated | standard+ | IF `"desktop" ∈ platforms` |
| V13 | `system/<ds>/ui_kits/mobile/` populated | standard+ | IF `"mobile" ∈ platforms` |
| V14 | `system/<ds>/assets/{logos,glyphs}/` exist | standard+ | always |
| V15 | `config.json` has all required fields | standard+ | always (warning per missing) |
| V16 | README has voice / tone / hard-stops sections | strict only | always |
| V17 | tokens CSS has `@media (prefers-reduced-motion: reduce)` | standard+ | always |
| V18 | tokens CSS has dark + light blocks | standard+ | IF `themeDefault == "both"` |

**Tier 3 — Free-form (no check):**

Anything else under `system/<ds>/` — files in `config.json.extensions[]`, custom dirs (`patterns/`, `voice/`, `meta/`, etc.) — pass silently. The critic ACK's them in the report as "Detected N free-form extensions: …" but doesn't flag.

### Files to create

**Create** `plugins/design/agents/design-system-completeness-critic.md`:
- Frontmatter: `name`, `description` (auto-run from skill `design-system` bootstrap flow + opt-in via `--system-only`), `tools: Read, Bash, Glob, Grep`
- Body: Authority → Inputs → Pre-flight → Tier 1 (8 checks) → Tier 2 (18 checks, gated) → Tier 3 (acknowledged) → Verdict format (matches sibling critics' JSON shape)

### Files to edit

**Edit** `plugins/design/commands/critic.md` — document the new `--system-only` flag that runs only `design-system-completeness-critic`.

### Dependencies

- **Requires Phase 1** (asserts Phase-1 contract — Core files + config fields exist)
- **Skill `design-system` bootstrap flow calls the critic at end** (Phase 1B wires this)

### Validation

- Against dugmate's `.design/` → all Tier 1 pass, 1–2 Tier 2 warnings expected
- Against freshly-scaffolded marketing site (`completenessProfile: standard`, `activeFamilies: ["accent","status"]`) → all blockers pass, ≤3 warnings
- Against freshly-scaffolded pro-tool (`activeFamilies: ["accent","status","presence","mono"]`) → all blockers pass, ≤4 warnings (presence + mono families add checks)
- Against md-claude's *current* `.design/` (D2 divergence) → ≥4 blockers (wrong dirname, no SKILL.md, no orchestration README, one mega specimen)
- Verdict JSON parses; skill `design-system` bootstrap flow exits 0 only when no blockers
- Strict profile catches V16 (voice/tone/hard-stops sections); standard profile doesn't

### Risks

- **False positives for `--opt-out=full` projects.** Already mitigated by `completenessProfile` (minimal profile is the explicit "I know what I'm doing" mode)
- **Path drift.** Read `tokensCssRel` and `designSystems[]` from config; don't hardcode
- **activeFamilies misconfiguration.** User edits config wrongly, critic skips important checks. Mitigation: critic warns if `activeFamilies` is empty (probably misconfigured)

---

## Phase 4 — Multi-DS support (merged from old Phase 5)

### Goal

A project can declare multiple design systems as separate folders under `<designRoot>/system/<name>/`. Each DS is a template/library used at canvas-generation time. `/design:new --ds=<name>` selects which DS scaffolds the new canvas. Per-canvas `.meta.json` records the DS; subagents scope their audit accordingly.

**This is opt-in extension to single-DS default.** Single-DS bootstrap from Phase 1 produces `system/project/`. Multi-DS users add additional DSes via `/design:setup-ds <new-name>` (Phase 2 introduces the command; this phase wires the multi-DS resolution paths).

### Open decisions

| # | Question | Default | Tradeoff |
|---|---|---|---|
| P4-D1 | How do users opt INTO multi-DS? | **`/design:setup-ds <new-name>`** — the dedicated command from Phase 2. Skill `design-system` detects `additional-ds` mode when config exists + target_ds not in `designSystems[]` | Clean separation: `setup-ds` does DS creation, `new` does canvas creation |
| P4-D2 | Multi-DS dirname convention | **kebab-case `<name>`** matching a `designSystems[]` entry in config | Already standard |
| P4-D3 | Default DS resolution | **`config.json.defaultDesignSystem`** (string, names one of the `designSystems[]` entries). Falls back to `project` if single-DS layout | |
| P4-D4 | Per-canvas DS field name | **`designSystem`** (kebab-case slug, matches `designSystems[].name`) | |
| P4-D5 | `/design:new --ds=<unknown>` behavior | **Fail with hint** to `/design:setup-ds <unknown> "[brief]"` — no fallback prompt | Phase 2's P2-D7; reasserted here for the multi-DS context |

### Schema changes

**Edit** `plugins/design/dev-server/config.schema.json` — extend with:

```json
{
  "designSystems": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "path": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["name", "path"]
    },
    "default": []
  },
  "defaultDesignSystem": {
    "type": "string",
    "description": "Name of the DS used when no --ds flag passed. Defaults to 'project' for single-DS layouts."
  }
}
```

**Create** `plugins/design/dev-server/canvas-meta.schema.json` (or extend if exists) — accept `designSystem: string`.

### Files to edit / create

- **Edit** `plugins/design/dev-server/config.schema.json` — add `designSystems[]` + `defaultDesignSystem`
- **Create or edit** `plugins/design/dev-server/canvas-meta.schema.json` — add `designSystem` field
- **Edit** `plugins/design/commands/new.md`:
  - Parse `--ds=<name>` flag
  - If `<name>` doesn't match any `designSystems[]` entry, **fail with hint**:
    ```
    Error: design system "<name>" not found in config.json.designSystems[].
    Available: <list>
    To create: /design:setup-ds <name> "<brief>"
    ```
    (No fallback prompt — clean separation per P4-D5)
  - Pass the resolved DS's tokens + component HTML as context to `frontend-design`
  - Write `.meta.json.designSystem` for the new canvas
- **Edit** `plugins/flow/agents/design-system-guard.md`:
  - Read `<canvas>.meta.json.designSystem`; resolve to DS path; check tokens against THAT DS
  - Fall back to `defaultDesignSystem` if no meta
- **Edit** `plugins/design/skills/design-system/SKILL.md`:
  - Inside the existing `## Read flow` section (Phase 1 created this), add a `### Multi-DS lookup pattern` subsection
  - Document: skill loads canvas's declared DS (`<canvas>.meta.json.designSystem`), not a global active DS
- **Edit** `plugins/design/agents/design-system-completeness-critic.md` (created in Phase 3):
  - On invoke, if `config.json.designSystems[]` is non-empty, run the 3-tier check for EACH DS and produce a per-DS section in the report
  - Optionally `--ds=<name>` flag limits to one DS

### Dependencies

- **Requires Phase 3** (completeness-critic exists and can be extended)
- **Requires Phase 2** (`/design:new` is the canonical command with category)

### Validation

- JSON validates against schema; missing `designSystems[]` falls back to single-DS layout
- Project with 2 DS: `/design:new --ds=marketing HomeScreen "test"` produces canvas referencing marketing tokens; meta declares "marketing"
- Hand-edit canvas meta to switch DS; reload; `design-system-guard` audits against new DS
- Two canvases (A → DS-1, B → DS-2); subagent runs scope correctly per canvas
- `/design:critic --system-only` against multi-DS project produces per-DS sections

### Risks

- **DS name collisions with reserved dirs.** Disallow `system/preview/`, `system/assets/` as DS names (reserve for non-DS dirs)
- **Migration of existing projects.** No migration tooling (P0 confirmed: no production users). New projects start clean; legacy projects can `mv .design/system/foo .design/system/main && update-config`

---

## Phase 5 — CLAUDE.md additions

### Goal

Root `CLAUDE.md` documents the load-bearing rules so future sessions don't repeat divergences.

### Files to edit

**Edit** `/Volumes/D/git/claude-design/CLAUDE.md` — append a "Design system bootstrap" section:

```markdown
## Design system bootstrap (`.design/`)

When the user asks you to scaffold a new design system for ANY project,
do not improvise. The design plugin has TWO setup commands plus skill-driven
bootstrap:

- `/design:setup-onboard` — project-level environment init (deps check,
  install hints, CLAUDE.md / .ai/ offers, writes skeleton `.design/config.json`).
  Mirrors `/flow:setup-onboard`. **Does NOT create a DS.** Auto-invoked
  transparently when other commands hit missing `.design/config.json`.
- `/design:setup-ds <name> "[brief]"` — dedicated command for creating a DS
  (first or additional). Auto-invokes `setup-onboard` first if needed.
- Auto-load skill `design-system` (BOOTSTRAP mode) when `/design:edit "..."`
  or `/design:new "..."` is invoked against `<designRoot>/system/` that
  has no DS.

Seven rules govern the result:

- **Onboard before bootstrap.** `/design:setup-onboard` is the gate: it
  runs dependency pre-flight, surfaces install hints, and writes a
  skeleton `.design/config.json` with empty `designSystems: []`. Only
  after that does `/design:setup-ds` (or auto-load) run DS bootstrap.
  Onboard is auto-invoked transparently when other commands detect a
  missing config.

- **One skill owns DS work.** Skill `design-system` has TWO modes: READ
  (default — load active canvas's DS context for iteration) and BOOTSTRAP
  (create / extend / re-bootstrap). Mode is auto-detected on invocation.
  There is NO separate `init` skill.

- **Three bootstrap sub-modes.** `first-bootstrap` (no config exists),
  `additional-ds` (config exists, new name), `re-bootstrap` (existing
  DS, requires `--force`). Each runs different discovery (full 8-Q vs
  reduced 7-Q + Q_purpose + inheritance picker vs pre-filled 8-Q).

- **Inspiration library, not substrate.** The template at
  `plugins/design/templates/design-system-inspiration/` is a REFERENCE
  inventory. Skill (bootstrap mode) reads it as "this is what a good
  specimen looks like", then GENERATES project-flavored files based on
  discovery answers. Do not naively copy reference files; do not include
  placeholder copy in scaffolded output.

- **Dynamic scaffold count.** A project gets 10–22 specimens out of the
  ~62-reference library, based on `_MAPPING.md`. Marketing sites get
  fewer; pro-tools with multiplayer get more. Use `config.json`'s
  `activeFamilies[]` to know what's in scope.

- **Single-DS default dirname is the literal `project`.** Multi-DS opt-in
  uses `system/<name>/`. Never use `<slug-of-project>/` (D2 divergence).
  Completeness-critic enforces this as a blocker (Tier 1, C2).

- **Three-tier compliance.** Core checks (blocker), Conventional checks
  (warning, gated by `activeFamilies` + `completenessProfile`),
  Free-form (no check). Lets the system stay extensible.

- **Daily verb is `/design:edit`, not `/design`.** The bare `/design` form
  is a one-version compat stub that redirects. Cross-reference future
  docs with `/design:edit` only.

Reference: `/Volumes/D/git/dugmate/.design/system/project/`.
Library: `plugins/design/templates/design-system-inspiration/`.
Skill: `plugins/design/skills/design-system/SKILL.md`.
Completeness-critic: `plugins/design/agents/design-system-completeness-critic.md`.
Slash commands: `plugins/design/commands/{setup-onboard,setup-ds}.md`.
```

### Dependencies

- **Requires Phases 0, 1, 2, 3, 4** — section references all of them

### Validation

- `grep -F "skill \`init\`" CLAUDE.md` finds reference
- `grep -F "literal string \`project\`" CLAUDE.md` finds dirname rule
- `grep -F "/design:edit" CLAUDE.md` confirms canonical verb
- Fresh Claude session reading CLAUDE.md + asked "scaffold a design system" cites the rules

---

## Phase 6 — Docs site (Fumadocs) sync

### Goal

The Fumadocs site shipped in v0.7.0 (Phase 2 of the v1.0 roadmap, archived) must reflect every rename + new surface from this plan: `/design:edit`, `/design:setup-onboard`, `/design:setup-ds`, skill `design-system` bootstrap mode, `mdcc design init`, completeness-critic, multi-DS, new config fields.

### Coverage map

| Surface | Change | Auto vs manual |
|---|---|---|
| `site/content/docs/design/*.mdx` | Sweep `/design` → `/design:edit` everywhere in prose; mind directory paths vs slash commands | manual |
| `site/scripts/build-command-reference.mjs` | Picks `category:` from frontmatter — needs upgrade for grouped output (daily / setup-*) | script upgrade |
| `site/scripts/build-schema-reference.mjs` | Picks up new `extensions[]`, `completenessProfile`, `activeFamilies`, `designSystems[]`, `defaultDesignSystem` from `config.schema.json` | auto (script re-runs on build) |
| `site/content/docs/design/setup-onboard.mdx` (new) | Dedicated page for `/design:setup-onboard` — Pre-flight, soft-dep hints, skeleton config — analog of `/flow:setup-onboard` docs | manual |
| `site/content/docs/design/setup-ds.mdx` (new) | Dedicated page for `/design:setup-ds` slash command + skill `design-system` bootstrap mode — Pre-flight, 3-mode discovery (first / additional / re-bootstrap), Mapping, Scaffold, Post-flight | manual |
| `site/content/docs/design/bootstrap.mdx` (new) | Narrative "how to bootstrap a new design system" — points at `/design:setup-onboard` then `/design:setup-ds` | manual |
| `site/content/docs/design/categories.mdx` (new) | Grouped command index, mirror `plugins/design/CATEGORIES.md` | manual or auto from CATEGORIES.md |
| `site/content/docs/design/multi-ds.mdx` (new) | Multi-DS reference: schema, `--ds=` flag, per-canvas meta, how to add a DS via `/design:setup-ds` | manual |
| `site/content/docs/cli/design.mdx` (new or extend) | New `mdcc design init` subcommand | manual |
| `site/content/docs/reference/critics.mdx` (extend if exists) | New `design-system-completeness-critic` | manual |
| `site/app/(public)/llms.txt/route.ts` | Regenerates from MDX content — picks up new pages | auto |
| `site/app/sitemap.ts` | Add new pages to sitemap | auto if it crawls MDX; else manual |

### Files to edit / create — Phase 6 detail

**Edit (sweeps):**
- All `site/content/docs/design/*.mdx` files — `/design` → `/design:edit` (mind directory references)
- `site/content/docs/design/docs.mdx` (if exists) → rename to `setup-docs.mdx`
- `site/scripts/build-command-reference.mjs` — group by `category:` field; emit two sections

**Create:**
- `site/content/docs/design/setup-onboard.mdx`
- `site/content/docs/design/setup-ds.mdx`
- `site/content/docs/design/bootstrap.mdx`
- `site/content/docs/design/categories.mdx`
- `site/content/docs/design/multi-ds.mdx`
- Possibly `site/content/docs/cli/design-init.mdx` (or inline within `cli/design.mdx`)

### Dependencies

- **Requires Phases 0, 1, 2, 3, 4** — content references shipped surface
- **Should land BEFORE first npm release** after this plan

### Validation

- `pnpm --filter site build` succeeds (or whichever PM the site uses)
- `rg -nF '/design ' site/content/docs/` returns 0 results (all swept)
- New pages render at expected routes
- llms.txt regen includes new content
- Manual: load each new page in dev preview, verify nav links

### Risks

- **MDX parse errors.** Slash commands inside backticks need to be code-fenced properly
- **llms.txt size limit.** If pages add up, may need to trim. Unlikely but flag

---

## Cross-cutting concerns

### Coordination with other plans

| Plan | Status | Coordination |
|---|---|---|
| Phase 5-draw-tools (was full Phase 5) | active | Multi-DS portion now lives in Phase 4 of THIS plan; draw-tools file should be slimmed/renamed in tandem with this plan landing |
| Phase 7 (ACP sidebar) | ❄️ ICEBOX | `phase-7-acp-chat-sidebar.md:32` references bare `/design "<feedback>"` — add a one-line TODO at top of that plan noting the rename. Out of scope for Phase 0 sweep |
| Phase 6 (comments + export) | active v1.0 | Phase 6 will create `/design:export` and `/design:presentation` slash commands. Add a coordination note in that plan's "Affected files" pointing at `plugins/design/CATEGORIES.md` |
| Phase 11 (flow ↔ design integration) | active | References `/design:handoff` and `/design:new` — both survive the rename |
| Phases 4 (canvas v2), 8 (Yjs LAN), 9 (hub), 10 (CRDT HTML coediting), 12 (in-canvas CSS + Layers) | active | No surface impact |
| Phase 13 (flow categorization, archived) | shipped v0.6 | Mirror its conventions in our Phase 2 categorization |

### Version parity

- Phases 0–6 all under same `mdcc` bin. No parity impact
- **Release:** ship as `minor` bump (`0.7.0` → `0.8.0`). Not breaking (compat stub for `/design`); new capability

### npm `files` field

- **MUST add** `plugins/design/templates` in Phase 1
- **MUST NOT add** `plugins/design/agents` or `commands` (those ship via marketplace)

### Marketplace metadata

- `.claude-plugin/marketplace.json` design plugin description — update after Phase 0 path-revert + after Phase 2 categorization adds new commands

### Dev-server routes

- **Phase 4 adds** `GET/PUT /api/designsystems` (list + edit `designSystems[]`) — optional, low priority; can defer
- **No other** route changes from this plan

### Testing

- No test suite per CLAUDE.md. Manual smoke per Acceptance below
- Scratch repos: `/tmp/scratch-empty`, `/tmp/scratch-multi-ds`, `/tmp/scratch-existing`

---

## Sequencing checklist

### Phase 0 — `/design` → `/design:edit`
- [ ] Decide P0-D1, P0-D2
- [ ] Fix bug: revert `marketplace.json:11` path
- [ ] Fix bug: revert `CLAUDE.md:9` directory bullet
- [ ] Fix bug: delete duplicate `plugins/design/commands/docs.md`
- [ ] Verify `edit.md` content (was `design.md` rename); update header + self-refs to `/design:edit`
- [ ] Create compat stub at `plugins/design/commands/design.md`
- [ ] Sweep repo-wide (excluding `site/` — Phase 6's job)
- [ ] Update `plugins/design/.claude-plugin/plugin.json`
- [ ] Manual test: `/design "x"` redirects; `/design:edit "x"` works

### Phase 1 — Inspiration library + skill `design-system` bootstrap mode
- [ ] Decide P1-D1 through P1-D9
- [ ] Extend `cli/lib/copy-tree.mjs` with `.tpl` suffix-strip rename hook
- [ ] Create `_README.md` + `_MAPPING.md` at `plugins/design/templates/design-system-inspiration/`
- [ ] Create `core/` (10 files)
- [ ] Create `foundations/` (8 files)
- [ ] Create `status/` (3 files)
- [ ] Create `audience-pro/` (6 files)
- [ ] Create `audience-consumer/` (5 files)
- [ ] Create `audience-developer/` (6 files)
- [ ] Create `platform-mobile/` (5 files)
- [ ] Create `platform-desktop/` (2 files)
- [ ] Create `theme-both/` (1 file)
- [ ] Create `universal/` (18 files)
- [ ] Create `patterns/` (6 files)
- [ ] Create `meta/` (4 files)
- [ ] **Extend** `plugins/design/skills/design-system/SKILL.md`:
  - Rewrite frontmatter `description:` to cover read + bootstrap responsibilities
  - Add `## Bootstrap flow` section (Pre-Flight / Discovery 3-mode / Mapping / Scaffold / Post-Flight)
  - Add `## Mode-detection` section
  - Preserve existing read-side content (rename header to `## Read flow` for symmetry)
- [ ] **Verify** `plugins/design/skills/init/` does NOT exist (delete if WIP created it)
- [ ] **Edit `package.json` `files` — add `plugins/design/templates`**
- [ ] Validate: cp-R test, mapping consultation in scratch repo, dynamic scaffold count, read-mode regression check

### Phase 2 — categorization + `/design:setup-onboard` + `/design:setup-ds` + hooks + CLI helper
- [ ] Decide P2-D1 through P2-D7
- [ ] Delete `commands/docs.md` (Phase 0 already did if not, verify)
- [ ] Add `category:` frontmatter to all daily commands
- [ ] Create `commands/help.md`
- [ ] **Create `commands/setup-onboard.md`** (full Pre-Flight + skeleton config write + Post-Flight prompts; mirrors `/flow:setup-onboard`)
- [ ] **Create `commands/setup-ds.md`** (thin wrapper → auto-invoke onboard if config missing → skill `design-system` bootstrap)
- [ ] Create `plugins/design/CATEGORIES.md` (document 3 setup-* entries)
- [ ] Edit `commands/edit.md` + `new.md` — pre-flight bootstrap-detection: auto-invoke onboard if config missing, then invoke skill `design-system` with `mode_hint=bootstrap`
- [ ] Edit `cli/commands/design.mjs` — add `init` subcommand (Core only without payload; full set with payload)
- [ ] Edit `cli/commands/help.mjs`, `cli/bin/mdcc.mjs`
- [ ] Update `plugins/design/README.md` + `marketplace.json` description (include `setup-onboard`, `setup-ds`)
- [ ] Manual test: `mdcc design init --no-discovery --name acme` in `/tmp/scratch-empty`
- [ ] Manual test: `/design:setup-onboard` in empty repo writes skeleton config + Post-Flight prompts
- [ ] Manual test: `/design:edit "x"` in empty repo auto-invokes onboard → bootstrap (first-bootstrap mode, Q1 prefilled)
- [ ] Manual test: `/design:setup-ds marketing "..."` in onboarded project skips onboard, runs additional-ds mode
- [ ] Manual test: `/design:help` prints grouped index with `setup-*` group showing 3 entries

### Phase 3 — adaptive completeness-critic
- [ ] Decide P3-D1 through P3-D5
- [ ] Create `plugins/design/agents/design-system-completeness-critic.md` (3-tier rules)
- [ ] Wire auto-run at end of skill `design-system` bootstrap flow
- [ ] Edit `commands/critic.md` — document `--system-only` flag
- [ ] Validate: dugmate pass, fresh scaffold pass per profile, md-claude current fail ≥4

### Phase 4 — multi-DS support
- [ ] Decide P4-D1 through P4-D5
- [ ] Extend `config.schema.json` with `designSystems[]` + `defaultDesignSystem`
- [ ] Create/extend `canvas-meta.schema.json` with `designSystem`
- [ ] Edit `commands/new.md` — parse `--ds=` flag, fail with hint to `/design:setup-ds` on unknown DS (no fallback prompt)
- [ ] Edit `plugins/flow/agents/design-system-guard.md` — scope to canvas DS
- [ ] Edit `plugins/design/skills/design-system/SKILL.md` — add Multi-DS lookup subsection inside existing `## Read flow`
- [ ] Edit `plugins/design/agents/design-system-completeness-critic.md` — multi-DS report sections
- [ ] Validate: 2-DS project scaffolds via `/design:setup-ds`, audits scope correctly per canvas

### Phase 5 — CLAUDE.md
- [ ] Edit `CLAUDE.md` — append "Design system bootstrap" section (5 rules)
- [ ] Confirm references resolve

### Phase 6 — docs site sync
- [ ] Sweep `site/content/docs/design/*.mdx` for `/design` → `/design:edit`
- [ ] Rename or update `site/content/docs/design/docs.mdx` → `setup-docs.mdx`
- [ ] Upgrade `site/scripts/build-command-reference.mjs` for grouped output (3 setup-* entries)
- [ ] Create `site/content/docs/design/setup-onboard.mdx`
- [ ] Create `site/content/docs/design/setup-ds.mdx`
- [ ] Create `site/content/docs/design/bootstrap.mdx`
- [ ] Create `site/content/docs/design/categories.mdx`
- [ ] Create `site/content/docs/design/multi-ds.mdx`
- [ ] Extend `site/content/docs/cli/design.mdx` for `mdcc design init`
- [ ] Site build green; llms.txt regen verified

### Coordination (separate, low priority)
- [ ] Slim `phase-5-multi-ds-and-draw-tools.md` → `phase-5-draw-tools.md` (remove Tasks 2-7; add cross-ref to this plan's Phase 4)
- [ ] Add TODO at top of `phase-7-acp-chat-sidebar.md` re `/design` rename
- [ ] Add coordination note in `phase-6-comments-presentation-export.md` re `category:` frontmatter requirement for new commands

---

## Acceptance

End-to-end smoke after all seven phases:

```bash
cd /tmp && rm -rf scratch && mkdir scratch && cd scratch && git init
mdcc design init --no-discovery --name acme
```

**Expected: Core scaffold** (~10 files):

```
.design/
├── README.md
├── INDEX.md
├── config.json
└── system/project/
    ├── README.md
    ├── SKILL.md
    ├── colors_and_type.css
    ├── assets/{logos,glyphs}/.gitkeep
    └── preview/
        ├── _layout.css
        ├── colors-text.html
        ├── colors-surfaces.html
        ├── colors-accent.html
        ├── type-scale.html
        ├── spacing-scale.html
        ├── motion.html
        ├── components-buttons.html
        ├── components-cards.html
        └── components-inputs.html
```

**Expected stdout:**

```
mdcc design init
  project name: acme
  scaffold target: /tmp/scratch/.design
  mode: --no-discovery (Recommended defaults, Core only)
  10 files created
  config.json: activeFamilies=["accent"], completenessProfile="minimal"
For full bootstrap (with audience-specific specimens), use Claude Code:
  cd /tmp/scratch && claude
  /design:edit "<describe your product>"
```

**Interactive verification (inside Claude Code, scratch repo with no `.design/`):**

```
> /design:edit "make a posthog/zed-style pro-tool system, desktop+mobile, dark"
[detects missing .design/config.json]
[→ Running /design:setup-onboard to initialize project…]
[setup-onboard: Pre-flight summary, soft-dep hints, skeleton config written, multi-select prompts]
[setup-onboard returns]
[skill `design-system` auto-loads in bootstrap / first-bootstrap mode]
[Pre-Flight (light): hard deps ✓]
[Round 1 Q2–Q4 (Q1 pre-answered from brief)]
[Round 2 Q5–Q8]
[Direction echoed: "Pro-tool aesthetic, Linear/posthog/Zed-flavored, dark default, desktop+mobile…"]
[User confirms]
[Mapping computes: Core(10) + Foundations(8) + Status(3) + Audience-pro(6) + Platform-mobile(5) + Platform-desktop(2) + Universal(6) = 22 files]
[Generation: each file written with project-specific tokens + voice]
[completeness-critic: 0 blockers, 1 warning]
[Post-flight: agent-browser install hint, mdcc design serve offer]
[Returns to /design:edit context]
```

**Additional-DS verification (inside Claude Code, project already has `system/project/`):**

```
> /design:setup-ds marketing "consumer-facing marketing site for product launch"
[skill `design-system` invoked in bootstrap / additional-ds mode]
[Pre-Flight summary — existing DS detected at system/project/]
[Round 1 Q2-Q4]
[Round 2 Q5-Q8 + Q_purpose (filled from brief)]
[Inheritance picker: typography ✓, voice ✗, iconography ✗, motion ✓]
[Direction echoed]
[Confirm]
[Mapping computes for marketing flavor: 14 files]
[Generation with inherited typography + motion, fresh accent + voice]
[completeness-critic: 0 blockers]
[config.json updated: designSystems[] += { name: "marketing", path: "system/marketing" }]
[Post-flight: hints]
```

**Verification commands:**

```bash
ls /tmp/scratch/.design/system/                       # → project (literal)
cat /tmp/scratch/.design/config.json | jq '.activeFamilies'   # → ["accent","status","presence","mono"]
cat /tmp/scratch/.design/config.json | jq '.completenessProfile'   # → "standard"
cat /tmp/scratch/.design/config.json | jq '.designSystems | length'   # → 1 (project)
ls /tmp/scratch/.design/system/project/preview/ | wc -l   # → 18-22 (varies)
test -f /tmp/scratch/.design/system/project/SKILL.md && echo OK
ls plugins/design/commands/ | wc -l                  # → 12 (11 + 1 compat stub)
cat plugins/design/CATEGORIES.md | grep -c '^### '   # → 2 (daily, setup-*)
ls plugins/design/skills/                            # → design design-system ui-kit  (NO init)
grep -c '^## Bootstrap flow' plugins/design/skills/design-system/SKILL.md   # → 1
```

All checks must pass for ship.

---

## Specimen inspiration library — full reference inventory

Expanded brainstorm of what specimens an agent might want to draw from. Used by Phase 1 to populate `plugins/design/templates/design-system-inspiration/`. Bold = always-Core. Italic = NEW vs. original retro (R2). Roman = was in original retro.

### Core (~10 always)

- **README.philosophy.md.tpl**, **README.orchestration.md.tpl**, **SKILL.md.tpl**, **INDEX.md.tpl**, **config.json.tpl**, **colors_and_type.css.tpl**
- **preview/_layout.css** (shared specimen chrome)
- **colors-text.html**, **colors-surfaces.html**, **colors-accent.html**
- **type-scale.html**
- **spacing-scale.html**
- **motion.html**
- **components-buttons.html**, **components-cards.html**, **components-inputs.html**

### Foundations (~8 universal foundations)

- radii.html
- elevation.html
- _borders.html_ (subtle / default / strong / accent / error)
- _focus.html_ (focus ring tokens, focus-visible vs focus, contrast)
- _opacity.html_ (overlay scale, disabled)
- _selection.html_ (text selection, multi-select)
- _grid.html_ (columns, gutters, breakpoints)
- iconography.html

### Status / state (~3 almost-always)

- colors-status.html (live/rec/warn/success/info/offline)
- components-status.html (badges)
- skeletons.html

### Audience: pro tool (~6)

- components-list.html (dense rows, J/K hints)
- components-toast-menu.html
- _components-keyboard.html_ (`<kbd>` rendering, key combos)
- _components-command-palette.html_ (Cmd+K)
- _components-shortcuts-overlay.html_ (keyboard cheat sheet)
- colors-presence.html (multiplayer dots)

### Audience: consumer app (~5)

- _components-marketing-card.html_
- _components-testimonial.html_
- _components-feature-grid.html_
- _components-empty-state-generous.html_
- _components-banner.html_ (page-level info/warn/error)

### Audience: developer tool (~6)

- _components-terminal-pane.html_
- _components-log-stream.html_
- _components-diff-view.html_
- _components-code-block.html_ (syntax-highlighted w/ copy button)
- _components-monospace-table.html_
- type-mono.html (promoted from foundations when developer-flavored)

### Platform: mobile (~5)

- _components-bottom-sheet.html_
- _components-pull-to-refresh.html_
- _components-tab-bar.html_
- _components-segmented-control.html_
- _ui_kits-mobile-index.html_ (mobile UI kit cover page)

### Platform: desktop / tablet (~2)

- _ui_kits-desktop-index.html_
- _components-resize-panels.html_ (split panes)

### Theme: both equal (~1)

- _colors-themes-side-by-side.html_ (dark/light comparison)

### Universal (~18, default-on unless excluded)

- _components-toggles.html_ (switches/checkboxes/radios/segmented)
- _components-dialogs.html_ (modal/sheet/alert)
- _components-tooltips.html_ (tooltip + popover)
- _components-tabs.html_ (horizontal/vertical/scrollable)
- _components-tables.html_ (data table w/ sort + sticky header + row selection)
- _components-pagination.html_
- _components-progress.html_ (bar + circular + indeterminate)
- _components-avatars.html_ (w/ presence ring + initials + group)
- _components-badges.html_ (count + status pill + label tag)
- _components-search.html_ (search + suggestions + recent)
- _components-callout.html_ (inline note/tip/warning)
- _components-accordion.html_
- _components-stepper.html_ (multi-step wizard)
- _components-timeline.html_ (vertical event timeline)
- _components-stat-card.html_ (KPI tile w/ delta + trend)
- _components-chart-primitives.html_ (bar/line/pie minimal)
- _components-breadcrumbs.html_
- empty-state.html.tpl, logo.html.tpl (generic with placeholders)

### Patterns (~6, higher level than components)

- _patterns-form-layouts.html_ (single col / two col / inline / floating labels)
- _patterns-error-pages.html_ (404 / 500 / offline / maintenance)
- _patterns-onboarding.html_ (welcome screens, tour highlights)
- _patterns-auth.html_ (login / signup / forgot password)
- _patterns-pricing.html_
- _patterns-data-density.html_ (same data sparse vs compact)

### Meta (~4 cross-cutting)

- _tokens-index.html_ (visual TOC of all tokens)
- _accessibility.html_ (focus order, semantic HTML, ARIA samples)
- _i18n.html_ (RTL, long-text-overflow, pluralization)
- _presence-multiplayer.html_ (Phase 8 forward-pointer)

**Total: ~62 reference files.** Cherry-picked per project: 10–22.

---

## Icebox & extensibility (out of scope for this plan)

Captured here so the plan signals what was considered but deferred. None of these block ship.

| Topic | Brief | When |
|---|---|---|
| Token export to other formats | `mdcc design export --format <tailwind\|figma-variables\|style-dictionary>` | v1.1 candidate |
| `llms.txt` for design system | `system/<ds>/llms.txt` — terse 200-line LLM-consumption summary auto-derived from README + SKILL.md | v1.1 candidate |
| Theme variants beyond dark/light | `themes/<name>.css` — high-contrast, brand variants, holiday | v1.1 candidate |
| Token "frozen" flag | Mark tokens as frozen post-ship; critic blocks changes without explicit DDR | v1.1 candidate |
| Playwright snapshot regression | `system/<ds>/snapshots/` + `mdcc design regress` | Post-v1.0 polish |
| Design system lint | `mdcc design lint` — WCAG contrast on token pairs, unused tokens, duplicate tokens, hardcoded colors in specimens | Post-v1.0 polish |
| Auto-asset pipeline | Drop logo SVG → auto-generate favicon, og-image, app-icon variants | Low priority |
| Public design system site | `mdcc design publish` — static HTML bundle via Vercel from `.design/` | Low priority |
| Stakeholder review mode | `mdcc design review --share` — generates bundle + QR for feedback | Low priority |
| Per-canvas token overrides | Canvas `.meta.json.tokenOverrides: { --accent: "..." }` for promo screens | Low priority |
| Linked Figma | `.meta.json.figmaUrl` — fetch + diff via Figma MCP | Low priority |
| Migration tooling | `mdcc design migrate` for legacy `.design/` layouts | Deferred until production users exist |

---

## Critical Files for Implementation

**Phase 0 (rename + bug fix):**
- `/Volumes/D/git/claude-design/.claude-plugin/marketplace.json` (revert path bug)
- `/Volumes/D/git/claude-design/CLAUDE.md` (revert directory bullet)
- `/Volumes/D/git/claude-design/plugins/design/commands/design.md` (create compat stub)
- `/Volumes/D/git/claude-design/plugins/design/commands/edit.md` (verify rename)
- `/Volumes/D/git/claude-design/plugins/design/commands/docs.md` (delete duplicate)

**Phase 1 (inspiration library + skill `design-system` bootstrap mode):**
- `/Volumes/D/git/claude-design/plugins/design/templates/design-system-inspiration/` (~62 files)
- `/Volumes/D/git/claude-design/plugins/design/skills/design-system/SKILL.md` (extend — add Bootstrap flow + Mode-detection sections)
- **Delete** `/Volumes/D/git/claude-design/plugins/design/skills/init/` if any WIP created it (must not exist)
- `/Volumes/D/git/claude-design/cli/lib/copy-tree.mjs` (`.tpl` rename hook)
- `/Volumes/D/git/claude-design/package.json` (`files` field)

**Phase 2 (categorization + `/design:setup-onboard` + `/design:setup-ds` + CLI):**
- `/Volumes/D/git/claude-design/plugins/design/commands/setup-docs.md` (confirm)
- `/Volumes/D/git/claude-design/plugins/design/commands/setup-onboard.md` (new — mirrors /flow:setup-onboard)
- `/Volumes/D/git/claude-design/plugins/design/commands/setup-ds.md` (new — thin wrapper → onboard-if-needed → skill `design-system` bootstrap)
- `/Volumes/D/git/claude-design/plugins/design/commands/help.md` (new)
- `/Volumes/D/git/claude-design/plugins/design/CATEGORIES.md` (new)
- `/Volumes/D/git/claude-design/plugins/design/commands/{edit,new}.md` (pre-flight hooks invoking skill `design-system` with `mode_hint=bootstrap`)
- `/Volumes/D/git/claude-design/cli/commands/design.mjs` (init subcommand)
- `/Volumes/D/git/claude-design/cli/commands/help.mjs`, `cli/bin/mdcc.mjs`
- `/Volumes/D/git/claude-design/.claude-plugin/marketplace.json`
- `/Volumes/D/git/claude-design/plugins/design/.claude-plugin/plugin.json`

**Phase 3 (completeness-critic):**
- `/Volumes/D/git/claude-design/plugins/design/agents/design-system-completeness-critic.md` (new)
- `/Volumes/D/git/claude-design/plugins/design/commands/critic.md` (extend with `--system-only`)

**Phase 4 (multi-DS):**
- `/Volumes/D/git/claude-design/plugins/design/dev-server/config.schema.json` (extend)
- `/Volumes/D/git/claude-design/plugins/design/dev-server/canvas-meta.schema.json` (extend or new)
- `/Volumes/D/git/claude-design/plugins/design/commands/new.md` (`--ds=` flag; fail-with-hint on unknown DS)
- `/Volumes/D/git/claude-design/plugins/flow/agents/design-system-guard.md` (scope to canvas DS)
- `/Volumes/D/git/claude-design/plugins/design/skills/design-system/SKILL.md` (add Multi-DS lookup subsection inside existing `## Read flow`)
- `/Volumes/D/git/claude-design/plugins/design/agents/design-system-completeness-critic.md` (multi-DS report)

**Phase 5 (CLAUDE.md):**
- `/Volumes/D/git/claude-design/CLAUDE.md`

**Phase 6 (docs site):**
- `/Volumes/D/git/claude-design/site/content/docs/design/*.mdx`
- `/Volumes/D/git/claude-design/site/scripts/build-command-reference.mjs`
- `/Volumes/D/git/claude-design/site/content/docs/design/{setup-onboard,setup-ds,bootstrap,categories,multi-ds}.mdx` (new)
- `/Volumes/D/git/claude-design/site/content/docs/cli/design.mdx`

**Coordination (separate plans):**
- `/Volumes/D/git/claude-design/.ai/plans/phase-5-multi-ds-and-draw-tools.md` → slim to `phase-5-draw-tools.md`
- `/Volumes/D/git/claude-design/.ai/plans/phase-7-acp-chat-sidebar.md` (TODO note)
- `/Volumes/D/git/claude-design/.ai/plans/phase-6-comments-presentation-export.md` (coordination note)
