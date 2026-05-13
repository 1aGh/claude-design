---
name: design-system-init
status: planned
created: 2026-05-13
revised: 2026-05-13
source_retro: .ai/logs/system-reviews/design-system-bootstrap-review.md
decisions:
  - dirname is the literal "project" FOR SINGLE-DS BOOTSTRAPS (default; rename-resilient); multi-DS users override via Phase 5's `/design:new --ds=<name>` which scaffolds `system/<name>/` instead. Completeness-critic accepts either shape.
  - bootstrap is a SKILL named `init`, NOT a slash command (auto-loaded by /design:edit, /design:new, design-system when target missing; user-invocable for power users)
  - command `/design` renamed to `/design:edit` (verb-as-action; resolves naming collision with skill `design`)
  - skill `design` keeps its name (it IS the plugin-wide capability; command `edit` uses it)
  - mdcc subcommand is `mdcc design init` (mirrors `mdcc design serve`), not a flag on `mdcc init`
  - completeness-critic is opt-in (--system-only), not auto-routed; auto-runs at end of skill `init`
  - discovery uses 2 rounds × 4 AskUserQuestion items (8 questions total) to fit AUQ's 4-max constraint
  - placeholder count grew from 12 → 22 after walking dugmate reference
  - apply full flow-style categorization: rename `docs.md` → `setup-docs.md`, add `category:` frontmatter to all commands, new `plugins/design/CATEGORIES.md`, new `/design:help`
  - backwards-compat stub `/design` → `/design:edit` for one minor version (mirrors phase-13 pattern)
  - skill `init` does Pre-Flight dependency awareness (node ≥ 20 + git as hard deps; mdcc / agent-browser / CLAUDE.md / .ai/ as soft deps) — never auto-installs global packages; graceful degradation per /flow:setup-onboard pattern
  - skill `init` does Post-Flight smooth-start prompts (multiSelect AskUserQuestion) offering to start `mdcc design serve`, suggest `/init`, suggest `/flow:setup-onboard`, print `agent-browser` install hint, download fonts (font download deferred to follow-up — Phase 1 just falls back to Google Fonts `@import`)
---

# Plan: `init` skill + design plugin categorization

## Context

This plan converts the retro at `.ai/logs/system-reviews/design-system-bootstrap-review.md` (R1–R6) into sequenced work, **revised after architecture discussion**:

- **Bootstrap is a skill, not a command.** The original plan proposed `/design:design-system-init` as a top-level slash command. Replaced by **skill `init`** at `plugins/design/skills/init/SKILL.md`, auto-loaded by any entry point (`/design:edit`, `/design:new`, skill `design-system`) when `<designRoot>/system/project/` is missing. Surface stays clean; one logic path; user-invocable for power users via `/init` when inside the design plugin namespace.
- **Command `/design` renamed to `/design:edit`.** Resolves the cognitive collision with skill `design`. Verb-as-action aligns with flow's pattern (`/flow:plan`, `/flow:execute`, …).
- **Full flow-style categorization applied.** Mirror of `plugins/flow/CATEGORIES.md` for design plugin's 9 commands. Adds `/design:help` aggregator.
- Skill `design`, `design-system`, `ui-kit` retain their names. New skill: `init`. New plugin file: `plugins/design/CATEGORIES.md`.

**Phase ordering (revised):**

1. **Phase 0** (new) — Rename `/design` → `/design:edit` + sweep references + compat stub. Standalone; unblocks naming clarity for everything else.
2. **Phase 1** — Template skeleton (R2) + new skill `init` (was design-system-init) with discovery + scaffold + missing-state hooks + bootstrap branch in `design-system/SKILL.md` (R3).
3. **Phase 2** — Full flow-style categorization: `docs.md` → `setup-docs.md`, `category:` frontmatter on all commands, new `CATEGORIES.md`, new `help.md`, wire skill `init` into `/design:edit` and `/design:new` missing-state branches, `mdcc design init` CLI subcommand (R1+R4).
4. **Phase 3** — Completeness-critic (R5) — auto-runs at end of skill `init`.
5. **Phase 4** — `CLAUDE.md` additions (R6).

**Reorder check.** Phase 0 first because the command rename touches many references downstream; doing it once at the start avoids re-doing sweeps in Phase 2. Phase 1 must precede Phase 2 because Phase 2's missing-state hooks call into Phase 1's skill `init`. Phase 3 references Phase 1's template structure (it lints against it). Phase 4 references all three.

**Out of scope:** changes to dugmate, aesthetic tweaks to already-shipped md-claude `.design/`, npm release. Release is a separate cycle after the five phases land.

---

## Phase 0 — Rename `/design` → `/design:edit`

### Goal
The daily verb is `/design:edit "<feedback>"` (no more bare `/design`). Skill `design` keeps its name and remains the namespace-wide capability. A one-version compat stub at `/design` prints the redirect.

### Open decisions

| # | Question | Recommended default | Tradeoff |
|---|---|---|---|
| P0-D1 | Verb choice: `edit` vs `iterate` vs `update` vs `tweak` | **`edit`** | Shortest, most-recognized in design/IDE context. Matches the canvas's mental model (editing a file in place). `iterate` is also good but longer. |
| P0-D2 | Compat stub: in design plugin or skip (silent rename)? | **Compat stub** for one minor version (mirrors phase-13) | Some users have muscle memory + scripts referencing `/design`. Stub prints "renamed → /design:edit" and forwards args. Removed in next minor. |
| P0-D3 | Where does `category: daily` get added — only the new file, or backfill all 7 existing files in P0? | **Only `edit.md` in P0**; backfill rest in Phase 2's frontmatter sweep | Keeps P0 surgical. Phase 2 owns "add `category:` to everything". |

### Files to edit / create

- **Rename** `plugins/design/commands/design.md` → `plugins/design/commands/edit.md`:
  - `name: design` → `name: edit`
  - Add `category: daily`
  - Keep description + body mostly intact; update any references inside the body that say `/design "..."` to `/design:edit "..."` (mostly self-references).
- **Create compat stub** `plugins/design/commands/design.md`:
  ```yaml
  ---
  name: design
  category: daily
  description: "Renamed to /design:edit. This stub will be removed in the next minor version. Forwarding your arguments..."
  ---
  Print: "→ /design:edit (renamed). Forwarding..." then delegate to /design:edit with the same args.
  ```
- **Sweep references** across the entire repo:
  - `rg -n '/design\b' --type md` — every occurrence outside the compat stub and outside historical references (retros, changelogs, archived plans) should be updated to `/design:edit`.
  - Likely hit files:
    - `plugins/design/commands/*.md` — cross-references inside other design commands
    - `plugins/design/skills/design/SKILL.md`, `plugins/design/skills/design-system/SKILL.md`, `plugins/design/skills/ui-kit/SKILL.md` — body text
    - `plugins/design/agents/*.md` — 10 critics may reference `/design`
    - `plugins/design/.claude-plugin/plugin.json` — description field
    - `.claude-plugin/marketplace.json` — design plugin description
    - `README.md` at repo root — usage examples
    - `CLAUDE.md` at repo root
    - `site/content/docs/design/*.mdx` — Fumadocs site
    - `.ai/` retros / plans / DDRs that mention the slash form (historical — review case by case)
    - `cli/commands/help.mjs` (if it references `/design`)
- **Update** `plugins/design/.claude-plugin/plugin.json` — bump `commands` array; description text.

### Dependencies
None. Phase 0 is the entry point.

### Validation
- `ls plugins/design/commands/` shows both `edit.md` and `design.md` (compat stub).
- `rg -n "/design[^:]" --type md | grep -v compat-stub | grep -v archive` returns only intentional historical mentions.
- Manual: in a scratch repo, `/design "make button bigger"` prints "→ /design:edit (renamed)" and runs the edit flow.
- Manual: `/design:edit "make button bigger"` runs the edit flow directly.

### Risks
- **Reference-sweep miss.** `rg` may not catch references in skill-injection comments or in dev-server-injected HTML. Mitigation: also `rg -n 'design\.md' --type md` and `rg -n "command: design"`.
- **Compat-stub args forwarding.** If stub can't forward `$ARGUMENTS`, the redirect breaks. Mitigation: test with multi-word arg + special chars (`/design "make 'this' bigger"`).
- **Site references in `.mdx`.** Fumadocs site has its own routing — update both the prose AND any frontmatter / nav entries.
- **Future removal.** Schedule compat stub removal in the next minor (e.g. release notes for v0.9.0 say "removed `/design` compat stub").

---

## Phase 1 — Template skeleton + skill `init` (R2 + R3, revised)

### Goal
A copy-pasteable skeleton at `plugins/design/templates/design-system-skeleton/` matches the dugmate reference shape. A new skill at `plugins/design/skills/init/SKILL.md` contains discovery + scaffold logic + auto-load hooks. The `design-system` pointer skill documents the missing-state branch that defers to skill `init`.

### Open decisions

| # | Question | Recommended default | Tradeoff |
|---|---|---|---|
| P1-D1 | Templates dir: `plugins/design/templates/` (new) vs reuse `plugins/flow/templates/` | **New `plugins/design/templates/`** | Flow's template ships `.ai/`, design's ships `.design/`. Co-locate with consumer plugin. |
| P1-D2 | `.html.tpl` (with placeholders) vs plain `.html` for preview files | **`.html.tpl` only where the file inlines `{{root_class}}` / `{{accent_oklch}}`; plain `.html` for token-driven files (CSS-only consumption)** | Most previews only `<link>` the templated CSS — they don't need substitution. Reduces transform cost. |
| P1-D3 | `.tpl` suffix kept or stripped on copy? | **Stripped** (`README.md.tpl` → `README.md`) | Matches user expectation. Implement in copier transform. |
| P1-D4 | Placeholder syntax: `{{name}}` vs `PROJECT_NAME` vs `{name}` | **Double-brace `{{name}}`** | Distinguishes from flow's `PROJECT_NAME` token (different namespace). Readable. |
| P1-D5 | Skill `init` `user-invocable: true` or false? | **`true`** — power users can type `/init` inside design context to re-bootstrap (with `--force` semantics) | Auto-loading is the primary path; explicit invocation is fallback for "I want to redo this from scratch". |
| P1-D6 | Default fonts when discovery skipped: Inter+IBM Plex+JetBrains Mono vs Geist+Geist Mono | **Inter+IBM Plex+JetBrains** (matches dugmate's v2 shadcn refresh) | Wider browser coverage; pairs that are battle-tested. Geist is great but single-family limits hierarchy. |
| P1-D7 | Skill `init` lives at `plugins/design/skills/init/` — should there be a sibling skill called `bootstrap` to disambiguate? | **No — `init` is fine, namespace-scoped** | `init` inside `plugins/design/` doesn't collide with anything else (flow has no `init` skill). Short verb wins. |

### Files to create — Phase 1A: skeleton tree

All under `plugins/design/templates/design-system-skeleton/`. **The literal string `project` is preserved inside, NOT substituted.**

```
plugins/design/templates/design-system-skeleton/
├── README.md.tpl                                                    # .design/README.md (orchestration)
├── INDEX.md.tpl                                                     # .design/INDEX.md (canvas sitemap)
├── config.json.tpl                                                  # full 11-field config
└── system/
    └── project/
        ├── README.md.tpl                                            # philosophy + changelog + content fundamentals + voice/tone/iconography
        ├── SKILL.md.tpl                                             # agent skill manifest (user-invocable: true)
        ├── colors_and_type.css.tpl                                  # tokens — OKLCH, motion vars, one-accent rule
        ├── assets/
        │   ├── logos/.gitkeep
        │   └── glyphs/.gitkeep
        ├── preview/
        │   ├── _layout.css                                          # shared specimen chrome (plain)
        │   ├── colors-text.html
        │   ├── colors-surfaces.html
        │   ├── colors-accent.html
        │   ├── colors-status.html
        │   ├── colors-presence.html
        │   ├── type-scale.html
        │   ├── type-mono.html
        │   ├── spacing-scale.html
        │   ├── radii.html
        │   ├── elevation.html
        │   ├── motion.html
        │   ├── iconography.html
        │   ├── logo.html.tpl                                        # references {{project_name}} wordmark
        │   ├── components-buttons.html
        │   ├── components-cards.html
        │   ├── components-inputs.html
        │   ├── components-list.html
        │   ├── components-status.html
        │   ├── components-toast-menu.html
        │   ├── skeletons.html
        │   └── empty-state.html.tpl                                 # references {{voice_paragraph}}
        └── ui_kits/
            ├── desktop/
            │   ├── README.md.tpl
            │   └── index.html.tpl                                   # references {{project_name}}, {{root_class}}
            └── mobile/
                ├── README.md.tpl
                └── index.html.tpl
```

### 21 specimen files — topic + tokens demonstrated

| # | File | Tokens demonstrated |
|---|---|---|
| 1 | `colors-text.html` | `--fg-0`..`--fg-3` rows + role description on `--bg-1` |
| 2 | `colors-surfaces.html` | `--bg-0`..`--bg-4` ladder + `--bg-hover/active/selected` overlays |
| 3 | `colors-accent.html` | `--accent`, `--accent-hover/active/fg/tint` — one-accent rule restated |
| 4 | `colors-status.html` | `--status-live/rec/warn/success/info/offline` |
| 5 | `colors-presence.html` | `--presence-1`..`--presence-8` deterministic palette |
| 6 | `type-scale.html` | `--font-heading`, `--font-sans` + 8-step ladder (11/12/13/14/16/20/28/40) |
| 7 | `type-mono.html` | `--font-mono`, `tabular-nums`, timecode + ID + jersey examples |
| 8 | `spacing-scale.html` | `--space-1`..`--space-8` (4-px base) gap ladder |
| 9 | `radii.html` | `--radius-xs/sm/md/lg/xl/pill` chips per step |
| 10 | `elevation.html` | `--shadow-sm/card/pop/modal/accent/live` |
| 11 | `motion.html` | `--dur-flip/panel/route/soft`, `--ease-out/in-out` — each rendered LIVE |
| 12 | `iconography.html` | Lucide-style (1.5px stroke) + `--accent` state icons + emoji rules |
| 13 | `logo.html.tpl` | Wordmark + dot at 3 sizes — substitutes `{{project_name}}` |
| 14 | `components-buttons.html` | Primary/secondary/ghost/destructive × idle/hover/active/disabled/loading |
| 15 | `components-cards.html` | `--radius-lg` + `--shadow-card` + hairline — no drop shadows on inline |
| 16 | `components-inputs.html` | Text input idle/focus/error using `--border`, `--accent`, `--status-warn` |
| 17 | `components-list.html` | Dense rows with hover, `--bg-selected`, zebra option, J/K hint |
| 18 | `components-status.html` | `LIVE`, `REC`, `ON-AIR`, `OFFLINE` mono badges + presence dots |
| 19 | `components-toast-menu.html` | Toast (bottom-right) + popover — `--shadow-pop`, `--dur-panel` enter |
| 20 | `skeletons.html` | Skeleton blocks animated with `--dur-soft` — "loading ≠ spinner" rule |
| 21 | `empty-state.html.tpl` | Glyph + one-verb CTA — copy uses `{{voice_paragraph}}` voice |

### Placeholder list — full 22

| Placeholder | Used in |
|---|---|
| `{{project_name}}` | README, SKILL.md, config, logo, ui_kits |
| `{{project_slug}}` | config `name`, package id |
| `{{root_class}}` | CSS selector, ui_kit body class, config `rootClass` |
| `{{theme_default}}` | `<html data-theme>`, config `themeDefault` |
| `{{accent_oklch}}` | `--accent` token |
| `{{accent_hover_oklch}}` | `--accent-hover` |
| `{{accent_active_oklch}}` | `--accent-active` |
| `{{accent_fg_oklch}}` | text-on-accent contrast pair |
| `{{mood_blurb}}` | README mood |
| `{{voice_paragraph}}` | README content fundamentals + empty-state specimen |
| `{{north_star}}` | README hero, SKILL.md tagline |
| `{{font_display}}` | `--font-heading`, `@import` |
| `{{font_body}}` | `--font-sans`, `@import` |
| `{{font_mono}}` | `--font-mono`, `@import` |
| `{{handoff_targets}}` | config `handoffTargets` (JSON-stringified) |
| `{{project_label}}` | config `projectLabel` |
| `{{tagline}}` | README hero |
| `{{platforms}}` | README platforms table, which `ui_kits/` subdirs scaffold |
| `{{audience}}` | README persona section |
| `{{personas}}` | README persona table (markdown-formatted array) |
| `{{icon_family}}` | iconography section |
| `{{license}}` (optional) | README footer + SKILL.md frontmatter |

`{{logo_svg_url}}` intentionally NOT included — assets are user-supplied post-scaffold.

### `colors_and_type.css.tpl` — token skeleton spec

- **OKLCH** for accent family.
- Groups in dugmate order: surfaces → borders → text → accent → status → presence → shadows → radii → spacing → typography → motion → layout.
- **One-accent rule** baked into namespace — only one `--accent*` family.
- Motion tokens: `--dur-flip/panel/route/soft`, `--ease-out/in-out`.
- `@media (prefers-reduced-motion: reduce)` guard.
- Selector: `:root, .{{root_class}}[data-theme="dark"] { ... }`.

### `README.md.tpl` at `.design/` root — orchestration layer

1. Title: `{{project_label}} Design System`.
2. "Single source of truth" paragraph.
3. Layout tree (auto-stays accurate to skeleton).
4. Provenance: created with skill `init` on date.
5. How to update tokens, how to browse, how to extend.
6. Git tracking note.

### `system/project/README.md.tpl` — philosophy layer

1. Title + `{{tagline}}` + `{{north_star}}`.
2. `What is {{project_name}}?` + `{{audience}}` + personas table.
3. Platform priorities table (`{{platforms}}`).
4. Sources block.
5. Index of folder.
6. **CONTENT FUNDAMENTALS** — voice (`{{voice_paragraph}}`), tone, person, casing, microcopy patterns table.
7. **VISUAL FOUNDATIONS** — mood, materiality, color, typography, spacing, radii, borders, shadows, backgrounds, motion, hover/press/focus, selection, transparency, layout, component personality.
8. **ICONOGRAPHY** — `{{icon_family}}`, state icons, emoji rules, logos.
9. **HARD-STOPS** — 7 falsifiable rules.
10. Changelog stub.

### `system/project/SKILL.md.tpl`

```yaml
---
name: {{project_slug}}-design
description: Use this skill to generate well-branded interfaces for {{project_name}}...
user-invocable: true
---
```

Body follows dugmate's pattern: files-in-this-skill, when-invoked, hard rules.

### `config.json.tpl` — full 11-field

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
  "newComponentDir": "ui/project/components"
}
```

### Files to create — Phase 1B: skill `init`

**Create** `plugins/design/skills/init/SKILL.md`:

```yaml
---
name: init
description: Discovery-driven bootstrap of <designRoot>/system/project/ when a project has no design system yet. Runs dependency pre-flight, asks 8 discovery questions, scaffolds from the design-system-skeleton template, runs completeness-critic, and offers smooth-start follow-ups (mdcc serve, agent-browser install hint, .ai/ workspace, fonts). Auto-loaded when /design:edit, /design:new, or design-system are invoked against a missing target. User-invocable as `init` for explicit re-bootstrap.
user-invocable: true
---
```

Body — **the full happy-path sequence** (Pre-Flight → Discovery → Scaffold → Post-Flight):

#### Pre-Flight: dependency awareness

Detect what's installed BEFORE asking discovery questions. Print one summary table; never auto-install global packages (security + permissions). Use the flow `setup-onboard` graceful-degradation pattern: hard deps abort; soft deps print install command and continue.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Hard deps
NODE_OK=false; command -v node &>/dev/null && \
  [[ "$(node -v | sed 's/v//;s/\..*//')" -ge 20 ]] && NODE_OK=true
GIT_OK=false; git -C "$REPO_ROOT" rev-parse &>/dev/null && GIT_OK=true

# Soft deps
MDCC_OK=false; command -v mdcc &>/dev/null && MDCC_OK=true
MDCC_VERSION="$(mdcc --version 2>/dev/null || echo '—')"
AGENT_BROWSER_OK=false; command -v agent-browser &>/dev/null && AGENT_BROWSER_OK=true
CLAUDE_MD_OK=false
[[ -f "$REPO_ROOT/CLAUDE.md" || -f "$REPO_ROOT/.claude/CLAUDE.md" ]] && CLAUDE_MD_OK=true
AI_WORKSPACE_OK=false
[[ -f "$REPO_ROOT/.ai/workflows.config.json" ]] && AI_WORKSPACE_OK=true
```

**Hard-stop rules:**

- `NODE_OK=false` → abort: "Node.js ≥ 20 required for `mdcc design serve`. Install from nodejs.org and re-run."
- `GIT_OK=false` → abort: "Not in a git repo. Run `git init` first — `.design/` needs version control for snapshot/rollback."

**Soft-degrade summary** (one-block print before Round 1):

```
Pre-flight summary
──────────────────
  node       ✓ v22.5.1
  git        ✓ initialized
  mdcc       ✓ v0.7.0                      ← scaffold via CLI
  agent-browser  ✗ missing                  ← critics will fail; npm i -g agent-browser
  CLAUDE.md  ✗ missing                      ← /init recommended after scaffold
  .ai/       ✗ missing                      ← /flow:setup-onboard recommended after scaffold

Hard deps satisfied. 3 soft deps missing — I'll prompt to fix them at the end.
Press enter to start discovery, or type "skip-prompts" to suppress post-flight offers.
```

If `MDCC_OK=false` → fallback to inline copy via Skill's built-in tools (Read/Write); print: "mdcc not on PATH — using inline copy. Install with `npm i -g @1agh/md-claude` for the faster path and `mdcc design serve`."

#### Discovery (Round 1 + Round 2 + confirm)

1. **Detect target.** Read `<repo>/.design/config.json` for `designRoot` (default `.design`). Check `<designRoot>/system/project/` exists.
2. **If exists**: refuse unless `--force`. Print "Already bootstrapped. Use `/design:edit "<feedback>"` to iterate."
3. **Round 1** via `AskUserQuestion` (4 questions: product one-liner, audience, platforms, theme default).
4. **Round 2** via `AskUserQuestion` (4 questions: mood references, brand color, typography, content tone).
5. **Confirm direction.** Echo 2-sentence proposed direction. Wait for explicit yes / corrections. On "no", restart Round 2 only (max 2 retries before scaffold-with-current).

#### Scaffold

6. **Write discovery payload** to `${TMPDIR}/design-init-${pid}.json` (substitution values for the 22 placeholders).
7. **Scaffold.** Shell out to `mdcc design init --discovery-payload <tmppath>` if `MDCC_OK=true`; else inline-copy `${CLAUDE_PLUGIN_ROOT}/templates/design-system-skeleton/` with substitution via `Read` + `Write`.
8. **Unlink payload** even on error path.
9. **Run completeness-critic** (R5). Exit non-zero if blockers present (rare — the template is designed to pass).

#### Post-Flight: smooth-start prompts

After scaffold succeeds, surface one `AskUserQuestion` (multiSelect = true) listing only the soft deps that came up missing. **The user picks none / some / all.** Honor `skip-prompts` from pre-flight by skipping this entirely.

```
What should I help with next? (multi-select; "none" is fine)

  [ ] Start `mdcc design serve` so I can browse the specimens at localhost:4399
  [ ] Run `/init` to generate CLAUDE.md (recommended — agents need it)
  [ ] Run `/flow:setup-onboard` to scaffold .ai/ workspace (enables /flow:plan to see the design system)
  [ ] Print `npm i -g agent-browser` install hint (needed for screenshot + 5 critics)
  [ ] Download Inter / IBM Plex Sans / JetBrains Mono into .design/system/project/assets/fonts/ for offline rendering
  [ ] None — I'll handle setup myself
```

Behavior per selection:

- **Start mdcc design serve** → `mdcc design serve --port 4399 --root "$REPO_ROOT" &` in background. Read `_server.json`, print actual URL list (one per specimen).
- **Run /init** → just print "Run `/init` now — Anthropic's built-in command analyzes the codebase and writes CLAUDE.md." (Cannot programmatically invoke another slash command from a skill; this is a prompt to the user.)
- **Run /flow:setup-onboard** → same — print invocation prompt.
- **agent-browser hint** → print `npm i -g agent-browser` + a one-liner on what it unlocks (screenshot, design-critic auto-loop, a11y-critic via axe-core).
- **Download fonts** → if `MDCC_OK=true`, run `mdcc design fonts pull "$INTER,$PLEX,$JBM"` (a new sub-subcommand — out of scope for Phase 1; for now just print the curl one-liners). **Defer the implementation to a follow-up; the skill just prints "TODO: not yet implemented, falling back to Google Fonts @import in colors_and_type.css".**

#### Print next steps (always, regardless of selections)

```
Bootstrap complete. .design/ scaffolded at <repo>/.design/system/project/.
  21 specimen pages under preview/
  config.json: 11 fields populated
  completeness-critic: 0 blockers, <N> warnings

Daily verbs:
  /design:edit "<feedback>"   — iterate on a specimen
  /design:new "<Name>" "..."  — add a new full canvas
  /design:browse              — open the dev server tab
  /design:critic              — run all critics on active canvas
  /design:help                — grouped command index
```

### Files to edit — Phase 1B: pointer skill `design-system`

Edit `plugins/design/skills/design-system/SKILL.md` — append:

```markdown
## When the system is missing (bootstrap branch)

If `<designRoot>/system/project/` does not exist, the user is asking you to
*bootstrap* a new design system. **Do not improvise tokens.** Auto-load the
sibling `init` skill (`plugins/design/skills/init/SKILL.md`) — it handles
discovery + scaffold + critique. If the user explicitly invokes
`/design:design-system "<brief>"` against a missing target, treat the brief
as the answer to discovery Question 1 (product one-liner) and start at
Round 1 Question 2.
```

Also clarify the existing layout block: `<designRoot>/system/project/` — dirname is the **literal string `project`**, not a substitution.

### Discovery question shape — full spec

**Round 1 — Identity (4 Qs, each with "Recommended" first + Other free-text).**

1. **Product one-liner.**
   - (a) Recommended: "Sketch a brief now."
   - (b) "Reuse from existing PRD" — read `.ai/<project>-prd.md` if present.
   - (c) "Skip — generic placeholder."
   - Feeds: `{{tagline}}`, `{{north_star}}`, `{{mood_blurb}}`.

2. **Primary audience.**
   - (a) Recommended: "Pro tool — power users, dense UI, keyboard-first."
   - (b) "Consumer app — broad audience, generous spacing, touch-first."
   - (c) "Developer tool — terminal-adjacent, monospace-heavy."
   - Feeds: `{{audience}}`, default `{{theme_default}}`, density.

3. **Platforms.**
   - (a) Recommended: "Desktop web only."
   - (b) "Mobile + Desktop — separate idioms."
   - (c) "Tablet-first."
   - Feeds: `{{platforms}}`, ui_kits subdirs.

4. **Theme default.**
   - (a) Recommended: "Dark by default."
   - (b) "Light by default."
   - (c) "Both equal — pick at runtime."
   - Feeds: `{{theme_default}}`.

**Round 2 — Brand + content (4 Qs).**

5. **Mood references.**
   - (a) Recommended: "Linear + Figma + posthog."
   - (b) "Stripe + Vercel + Notion."
   - (c) "Zed + Raycast + Arc."
   - Feeds: `{{mood_blurb}}`.

6. **Brand color.**
   - (a) Recommended: "Pick for me based on mood references."
   - (b) "I have a hex" (Other).
   - (c) "Cyan / indigo / emerald / amber default."
   - Feeds: `{{accent_oklch}}` + derived.

7. **Typography.**
   - (a) Recommended: "Inter + IBM Plex Sans + JetBrains Mono."
   - (b) "Geist + Geist Mono — single family."
   - (c) "System default + JetBrains Mono."
   - Feeds: `{{font_body/display/mono}}`.

8. **Content tone.**
   - (a) Recommended: "Direct, terse, verbs do the work."
   - (b) "Explanatory, friendly, conversational."
   - (c) "Formal, B2B, no contractions."
   - Feeds: `{{voice_paragraph}}`.

### Dependencies
- **Requires Phase 0** (so the rename has settled and skill `init` can reference `/design:edit` in its print steps).

### Validation
- `cp -R plugins/design/templates/design-system-skeleton /tmp/test-skel` succeeds; every `.tpl` has ≥1 placeholder; lint catches typos.
- Raw render of `colors-text.html` (placeholders unfilled) shows 4 labeled rows.
- Skill auto-load test: in scratch repo, `/design:edit "make button bigger"` against a missing `.design/` triggers skill `init`'s discovery flow.
- Skill explicit invocation: `/init` (no args) starts Round 1 directly.

### Risks
- **Placeholder collision** with flow's `PROJECT_NAME`. Mitigation: distinct namespace; document in `copy-tree.mjs` header.
- **`.tpl` suffix-strip.** `copy-tree.mjs` needs ~10 LOC rename hook. Mitigation: extend once, reuse.
- **npm `files` field.** Currently missing `plugins/design/templates`. **Phase 1 MUST add it** to `package.json`. Without, R4 (Phase 2 CLI) ships broken.
- **Skill auto-load reliability.** If `/design:edit` doesn't auto-load skill `init` reliably on missing-target detection, the bootstrap path silently fails. Mitigation: explicit check at top of `edit.md`'s command body; explicit `Skill` invocation if `init` isn't already loaded.

---

## Phase 2 — Flow-style categorization + missing-state hooks + CLI (R1 + R4)

### Goal
The design plugin's command surface follows flow's `<group>-<verb>` convention. `/design:edit` and `/design:new` detect missing target and load skill `init`. A new `mdcc design init` CLI subcommand provides the non-interactive scaffold path.

### Final categorization (9 commands → 2 groups)

| Group | Count | Commands |
|---|---|---|
| **daily** (no prefix) | 8 | `edit`, `new`, `critic`, `browse`, `rollback`, `screenshot`, `handoff`, `help` (new) |
| **setup-*** | 1 | `setup-docs` (was `docs.md`) |

Total: 9 commands. Plus one compat stub at `design.md` (from Phase 0) — removed in next minor.

### Open decisions

| # | Question | Recommended default | Tradeoff |
|---|---|---|---|
| P2-D1 | Does `handoff` stay daily or become `ship-handoff`? | **Stay daily** — mirrors `release` in flow (daily verb that's also parent of `release-*` group) | Handoff is the design equivalent of release. Daily verb. Future `handoff-mobile`, `handoff-web` siblings can live in a `handoff-*` group if needed. |
| P2-D2 | CLI subcommand: `mdcc design init` vs flag on `mdcc init` | **`mdcc design init`** — mirrors `mdcc design serve` | `mdcc init` owns `.ai/`; conflating confuses. |
| P2-D3 | How does the skill `init` shell out to CLI? | **Write discovery payload to temp file; pass path to CLI; CLI reads + unlinks** | Avoids shell-escaping JSON-on-argv. |
| P2-D4 | `/design:help` auto-generates from `category:` frontmatter or hardcoded? | **Auto-generate** — same pattern as `/flow:help` | DRY. Adding a new command only requires correct frontmatter. |
| P2-D5 | Auto-run `/design:critic` on each specimen at end of scaffold? | **Skip; defer to user via `--critic-all` opt-in flag** | 20 critic invocations = ~3-4M tokens; noisy on first bootstrap. Completeness-critic covers structural pass; per-topic via `/design:edit`. |

### Files to edit / create — Phase 2A: categorization

- **Rename** `plugins/design/commands/docs.md` → `plugins/design/commands/setup-docs.md`:
  - `name: docs` → `name: setup-docs`
  - Add `category: setup`
- **Add `category:` frontmatter** to all 8 remaining commands:
  - `edit.md` — `category: daily`
  - `new.md` — `category: daily`
  - `critic.md` — `category: daily`
  - `browse.md` — `category: daily`
  - `rollback.md` — `category: daily`
  - `screenshot.md` — `category: daily`
  - `handoff.md` — `category: daily`
  - `help.md` (new — see below) — `category: daily`
- **Create** `plugins/design/commands/help.md`:
  - Reads frontmatter from sibling command files, prints grouped index.
  - Mirrors `plugins/flow/commands/help.md` structure exactly.
- **Create** `plugins/design/CATEGORIES.md`:
  - Section per group with command table.
  - Naming convention statement.
  - Reference history table (`docs.md` → `setup-docs.md` rename; `design.md` → `edit.md` rename).
  - Mirror layout of `plugins/flow/CATEGORIES.md` for consistency.
- **Sweep references** to renamed commands: `rg -n '/design:docs\b'` → replace with `/design:setup-docs`.
- **Update** `plugins/design/.claude-plugin/plugin.json` — `commands` array; description.
- **Update** `.claude-plugin/marketplace.json` — design plugin description mentions new commands.
- **Update** `plugins/design/README.md` — grouped index pointing at `CATEGORIES.md`.

### Files to edit — Phase 2B: missing-state hooks

- **Edit** `plugins/design/commands/edit.md` — at the top of the body, add:
  ```markdown
  ## Pre-flight: bootstrap detection

  Before any edit work, check if `<designRoot>/system/project/` exists. If
  it does NOT, this is a fresh project — load skill `init` and treat the
  user's brief (`$ARGUMENTS`) as the answer to discovery Question 1
  (product one-liner). Skill `init` will run Rounds 1–2 (skipping Q1 since
  it's already answered), confirm direction, and scaffold before returning
  here. Once `<designRoot>/system/project/` exists, proceed with normal
  edit-in-place flow.
  ```
- **Edit** `plugins/design/commands/new.md` — analogous pre-flight: if no design system exists, load skill `init` and bootstrap FIRST, then create the requested new canvas using the freshly-scaffolded tokens.
- **No edits to** other commands (`critic`, `browse`, `rollback`, `screenshot`, `handoff`, `setup-docs`) — they assume an existing system; if user invokes against an empty repo, print a one-line hint pointing to skill `init`.

### Files to create / edit — Phase 2C: CLI subcommand

- **Edit** `cli/commands/design.mjs`:
  - Add `init` sub-subcommand alongside `serve`.
  - Help: `mdcc design <serve|init> [options]`.
  - On `init`:
    - Parse `--name <slug>`, `--force`, `--dry-run`, `--no-discovery`, `--discovery-payload <path>`.
    - Substitute placeholders from payload (read JSON from path) or use Recommended defaults if absent.
    - Resolve skeleton: `${pluginRoot}/templates/design-system-skeleton/`.
    - Call `copyTree` with `{ rename: stripTplSuffix, transform: substitutePlaceholders }`.
    - Refuse if `<cwd>/.design/system/project/` exists and no `--force`.
    - Print summary.
- **Edit** `cli/lib/copy-tree.mjs` — add `rename` hook (~10 LOC) for `.tpl`-stripping.
- **Edit** `cli/commands/help.mjs` — surface `mdcc design init`.
- **Edit** `cli/bin/mdcc.mjs` — route `design init`.
- **Edit** `package.json` `files` field — add `plugins/design/templates`. **Critical — without this, the CLI ships broken on npm.**

### Dependencies
- **Requires Phase 0** (compat stub already in place; `/design:edit` is the canonical verb in references).
- **Requires Phase 1** (skill `init` exists; template skeleton exists).

### Validation
- `ls plugins/design/commands/` — 9 files (8 daily + 1 setup), plus 1 compat stub at `design.md`.
- `for f in plugins/design/commands/*.md; do grep -q '^category:' "$f" || echo "MISSING: $f"; done` — empty output (or just the compat stub).
- `/design:help` prints grouped index matching `CATEGORIES.md`.
- Bootstrap from empty repo: `cd /tmp/empty && /design:edit "make a posthog-style system"` triggers skill `init` Round 1 Q2+ (Q1 prefilled from brief), confirms direction, scaffolds, runs completeness-critic, then opens `/design:edit` for further iteration.
- Non-interactive: `mdcc design init --name acme --no-discovery` produces the 32-file tree using Recommended defaults.
- Refuse-without-force: re-running `mdcc design init` in same dir prints refusal.

### Risks
- **`AskUserQuestion` 4-max constraint.** Confirmed — 2 rounds × 4 is the only viable shape.
- **Discovery payload via temp file.** Filesystem-cleanup edge case: CLI must `unlink` even on error path.
- **Version parity.** New subcommand doesn't introduce new bin or new manifest version — `scripts/check-version-parity.sh` keeps passing.
- **Accent contrast.** LLM-picked OKLCH may fail WCAG 4.5:1. Pre-flight check; auto-adjust lightness; flag in bootstrap report.
- **Confirmation UX retry loop.** Max 2 retries before "scaffold with current and iterate via `/design:edit`".
- **Sweep miss for `docs` → `setup-docs`.** Likely hits: cross-refs in other commands, README, marketplace.json, site docs.

---

## Phase 3 — Completeness critic (R5)

### Goal
New agent `plugins/design/agents/design-system-completeness-critic.md` validates `.design/` against 17 patterns. Opt-in via `/design:critic --system-only`; auto-runs at end of skill `init`.

### Open decisions

| # | Question | Recommended default | Tradeoff |
|---|---|---|---|
| P3-D1 | Auto-routed on every `/design:edit`? | **Opt-in + auto-run at end of skill `init`. NOT every edit.** | Edits don't change structure. Wasted spend. |
| P3-D2 | Reads what? | **Tree + open every `.html` to grep for `<link>` to `tokensCssRel`** | Both checks <100 LOC of agent prose. |
| P3-D3 | Output | **Markdown report + JSON verdict** | Matches existing critics. |
| P3-D4 | Severity | **Blocker / Warning / Info** | Matches sibling critics. |

### 17 checks

| # | Check | Severity |
|---|---|---|
| 1 | `<designRoot>/README.md` exists | Blocker |
| 2 | `<designRoot>/INDEX.md` exists | Warning |
| 3 | At least one valid DS dir under `<designRoot>/system/`: either `project/` (default, single-DS bootstrap) OR `<ds-name>/` (Phase 5 multi-DS opt-in). Reject if `<slug-of-project>/` matches the project name — that's the D2-divergence pattern. | Blocker |
| 4 | `system/project/README.md` exists | Blocker |
| 5 | `system/project/SKILL.md` + valid frontmatter | Blocker |
| 6 | `system/project/colors_and_type.css` exists | Blocker |
| 7 | Core vars present (`--accent`, `--bg-0..4`, `--fg-0..3`, `--font-mono`, `--dur-flip`) | Blocker |
| 8 | Exactly **one** `--accent*` family (no `--accent2`) | Blocker |
| 9 | OKLCH used for ≥1 color | Warning |
| 10 | `preview/` has ≥15 `.html` specimens | Blocker |
| 11 | Each specimen `<link>`s `colors_and_type.css` | Warning |
| 12 | `ui_kits/desktop/` populated (≥1 .html + README) | Warning |
| 13 | `ui_kits/mobile/` populated (skip if platforms excludes mobile) | Warning |
| 14 | `assets/{logos,glyphs}/` exist | Info |
| 15 | `config.json` has all 11 fields | Warning per missing |
| 16 | README has voice / tone / hard-stops sections | Warning |
| 17 | tokens CSS has `@media (prefers-reduced-motion: reduce)` | Warning |

### Files to create
**Create** `plugins/design/agents/design-system-completeness-critic.md`:
- Frontmatter: name, description (auto-run from skill `init` + opt-in via `--system-only`), tools: Read, Bash, Glob, Grep.
- Body: Authority → Inputs → Pre-flight → 17 checks → Verdict format.

### Files to edit
**Edit** `plugins/design/commands/critic.md` — document the new `--system-only` flag that runs only `design-system-completeness-critic`.

### Dependencies
- **Requires Phase 1** (asserts Phase-1 contract).
- **Requires Phase 2** (skill `init` calls the critic at the end).

### Validation
- Against dugmate's `.design/` → all blockers pass, 1–2 warnings expected.
- Against freshly-scaffolded `/tmp/scratch-empty/.design/` → all blockers pass.
- Against md-claude's *current* `.design/` (the one I shipped this session) → ≥4 blockers (wrong dirname `md-claude/` not `project/`, no SKILL.md, no orchestration README, one mega specimen).
- Verdict JSON parses; skill `init` exits 0 only when no blockers.

### Risks
- **False positives for `--opt-out=full` projects.** Read optional `completenessProfile` field (`minimal | standard | strict`); adjust severity. Default `standard`.
- **Path drift.** Read `tokensCssRel` from config; don't hardcode.

---

## Phase 4 — CLAUDE.md additions (R6)

### Goal
Root `CLAUDE.md` documents the load-bearing rules so future sessions don't repeat divergences.

### Files to edit
**Edit** `/Volumes/D/git/claude-design/CLAUDE.md` — append:

```markdown
## Design system bootstrap (`.design/`)

When the user asks you to scaffold a new design system for ANY project,
do not improvise. The design plugin handles this via skill `init`
(`plugins/design/skills/init/SKILL.md`), auto-loaded by `/design:edit`,
`/design:new`, and the `design-system` skill when `<designRoot>/system/project/`
is missing. Four rules govern the result:

- **Discover before scaffolding.** Skill `init` asks 8 focused questions
  across 2 `AskUserQuestion` rounds (identity + brand). Echo a 2-sentence
  proposed direction. Wait for explicit confirm before writing any file.

- **System lives at `<designRoot>/system/project/`, not `<slug>/`.** Dirname
  is the *literal string* `project`. Identity goes in `config.json`'s
  `name` / `projectLabel`, NOT the filesystem path. The completeness-critic
  enforces this as a blocker.

- **Specimens split by topic.** At least 15 `.html` pages under `preview/`
  — one per token family + one per component family. Never bundle into a
  single mega-index.

- **Daily verb is `/design:edit`, not `/design`.** The bare `/design` form
  is a one-version compat stub that redirects. Cross-reference future docs
  with `/design:edit` only.

Reference: `/Volumes/D/git/dugmate/.design/system/project/`.
Template: `plugins/design/templates/design-system-skeleton/`.
Skill: `plugins/design/skills/init/SKILL.md`.
Completeness critic: `plugins/design/agents/design-system-completeness-critic.md`.
```

### Dependencies
- **Requires Phase 0, 1, 2, 3** — section references all four; writing earlier creates dead links.

### Validation
- `grep -r "skill \`init\`" CLAUDE.md` finds reference.
- `grep -r "literal string \`project\`" CLAUDE.md` finds dirname rule.
- `grep -r "/design:edit" CLAUDE.md` confirms canonical verb.
- Fresh Claude session reading CLAUDE.md + asked "scaffold a design system" cites the rules.

### Risks
- **Drift on rename.** Add comment in skill `init`'s frontmatter: "renaming requires updating CLAUDE.md".

---

## Cross-cutting concerns

### Alignment with other roadmap plans (`.ai/plans/`)

Audited 2026-05-13 against all 10 active phase plans. Findings:

#### 🔴 Phase 5 (multi-DS) — resolved via hybrid

**Conflict:** Phase 5 designs `.design/system/<ds-name>/` (multiple folders like `marketing/`, `app/`, `admin/`) with `/design:new --ds=<name>` selecting at scaffold time. Our original "literal `project`" decision contradicted this.

**Resolution (revised):** Hybrid convention.
- Single-DS bootstraps (skill `init` default) → `system/project/` (rename-resilient).
- Multi-DS bootstraps (Phase 5 opt-in via `--ds=<name>`) → `system/<name>/`.
- Completeness-critic Check #3 (updated above) accepts either shape; rejects only the D2-divergence pattern (dirname = project slug like `md-claude/`).
- Skill `init` could optionally surface a "single or multi-DS?" question in Round 1, but **defer to Phase 5** — let `init` always default to `project/` and let users opt into multi-DS later via Phase 5's machinery. Keeps `init` simple.

**Action items:**
- Phase 5 should reference our Phase 3 completeness-critic and confirm Check #3's loosened rule. Add a forward-pointer in Phase 5's plan if it lands later.
- Phase 5's `design-system-guard` agent (in `plugins/flow/agents/`) and our `design-system-completeness-critic` (in `plugins/design/agents/`) are complementary, not overlapping: guard = per-canvas DS audit; completeness = system-level structure audit. Document this in both agent files when written.

#### 🟡 Phase 7 (ACP chat sidebar) — ICEBOX, needs sweep when revived

`phase-7-acp-chat-sidebar.md:32` references bare `/design "<feedback>"` as a sidebar quick-action button. Phase 7 is ❄️ ICEBOX (deferred to v1.1+ pending feedback). When/if it de-iceboxes, this single reference needs updating to `/design:edit "<feedback>"` as part of that phase's authoring.

**Action item:** Add a one-line TODO at the top of Phase 7's plan noting the rename so future-us doesn't miss it. **Out of scope for this plan's Phase 0 sweep** since Phase 7 won't actively be edited; would just be a dead update.

#### 🟡 Phase 6 (comments + export) — adds new daily commands

Phase 6 plans to create `/design:export` and `/design:presentation` slash commands. These post-date our Phase 2 categorization, so:

**Action item:** When Phase 6 lands, those two commands MUST be created with `category: daily` frontmatter. Add a one-line note in Phase 6's "Affected files" section pointing at our `plugins/design/CATEGORIES.md` convention. **No edit required to our plan** — just a coordination note for the future author.

#### 🟡 Phase 5 + our Phase 1B both edit `plugins/design/skills/design-system/SKILL.md`

Both plans append a section to this file:
- **Our Phase 1B:** "## When the system is missing (bootstrap branch)" — defers to skill `init`.
- **Phase 5 Task 4:** "## Multi-DS lookup pattern" — documents how skill picks the right DS based on canvas `.meta.json`.

**Coordination:** Sections are non-overlapping and additive. Whoever lands first writes their section; second author appends theirs. Specifically: bootstrap branch should mention that *if multi-DS is set up*, the lookup pattern (other section) applies after bootstrap.

#### 🟢 Phases 4, 8, 9, 10, 11, 12 — clean

- **Phase 4 (canvas v2 engine):** touches dev-server internals, no slash-command surface impact.
- **Phase 8 (Yjs LAN collab):** runtime collaboration, no plugin surface impact.
- **Phase 9 (hub + Hocuspocus):** infra, no surface impact.
- **Phase 10 (CRDT HTML coediting):** runtime, no surface impact.
- **Phase 11 (flow ↔ design integration):** references `/design:handoff` and `/design:new` — both survive our rename (only bare `/design` → `/design:edit`). ✓
- **Phase 12 (in-canvas CSS + Layers):** touches dev-server UI, no slash-command surface impact.

#### 🟢 Phase 13 (flow categorization, archived) — model + reference

Phase 13 is our naming-convention template. Our Phase 2 mirrors its patterns:
- `<group>-<verb>` for non-daily
- `category:` frontmatter
- Compat stub pattern (one-version forward)
- `CATEGORIES.md` aggregator + `/<plugin>:help`

**No edit needed; just confirming the lineage.**

#### Summary table

| Plan | Status | Conflict severity | Action |
|---|---|---|---|
| Phase 5 (multi-DS) | active v1.0 | 🔴 Hard, RESOLVED | Hybrid dirname; critic Check #3 updated in this plan |
| Phase 7 (ACP sidebar) | ICEBOX | 🟡 Soft | Add TODO at top of Phase 7 plan; out-of-scope sweep |
| Phase 6 (comments+export) | active v1.0 | 🟡 Soft (future) | Coordination note for Phase 6 author to set `category: daily` on new commands |
| Phase 1B vs Phase 5 SKILL.md edit | — | 🟡 Coordination | Both append non-overlapping sections; cross-reference |
| Phases 4, 8, 9, 10, 11, 12 | active | 🟢 None | — |
| Phase 13 (archived) | shipped v0.6 | 🟢 Reference | Mirror its conventions |

### Version parity
- Phase 0–4 all under same `mdcc` bin. No parity impact.
- **Release:** ship as `minor` bump (`0.7.0` → `0.8.0`). Not breaking (compat stub for `/design`); new capability.

### npm `files` field
- **MUST add** `plugins/design/templates` in Phase 1.
- **MUST NOT add** `plugins/design/agents` or `commands` (those ship via marketplace).

### Marketplace metadata
- `.claude-plugin/marketplace.json` — update design plugin description with new commands + categorization note.

### Dev-server routes
- **None changed.** Skeleton produces files the existing dev server already serves.

### Testing
- No test suite per CLAUDE.md. Manual smoke per Acceptance below.
- Two scratch repos: `/tmp/scratch-empty`, `/tmp/scratch-existing`.

---

## Sequencing checklist

### Phase 0 — `/design` → `/design:edit`
- [ ] Decide P0-D1 through P0-D3
- [ ] Rename `plugins/design/commands/design.md` → `edit.md`; update `name:`, add `category: daily`
- [ ] Create compat stub at `plugins/design/commands/design.md`
- [ ] Sweep references repo-wide (`rg -n '/design\b'`)
- [ ] Update `plugins/design/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- [ ] Update `site/content/docs/design/*.mdx`
- [ ] Manual test: `/design "x"` redirects; `/design:edit "x"` works

### Phase 1 — template + skill `init`
- [ ] Decide P1-D1 through P1-D7
- [ ] Extend `cli/lib/copy-tree.mjs` with `.tpl` suffix-strip rename hook
- [ ] Create skeleton tree at `plugins/design/templates/design-system-skeleton/` (32 files)
- [ ] Write `colors_and_type.css.tpl` (OKLCH, motion vars, reduced-motion guard)
- [ ] Write 21 specimen files
- [ ] Write `README.md.tpl` (orchestration) + `INDEX.md.tpl` + `system/project/README.md.tpl` (philosophy) + `SKILL.md.tpl`
- [ ] Create skill at `plugins/design/skills/init/SKILL.md` (discovery + scaffold logic; `user-invocable: true`)
- [ ] Edit `plugins/design/skills/design-system/SKILL.md` — append bootstrap branch deferring to skill `init`
- [ ] **Edit `package.json` `files` — add `plugins/design/templates`**
- [ ] Validate: cp-R test, placeholder lint, raw render, skill auto-load in scratch repo

### Phase 2 — categorization + hooks + CLI
- [ ] Decide P2-D1 through P2-D5
- [ ] Rename `commands/docs.md` → `commands/setup-docs.md`; sweep refs
- [ ] Add `category:` frontmatter to all 8 commands + setup-docs + compat stub
- [ ] Create `plugins/design/commands/help.md` (grouped-index aggregator)
- [ ] Create `plugins/design/CATEGORIES.md`
- [ ] Edit `commands/edit.md` — pre-flight bootstrap-detection block
- [ ] Edit `commands/new.md` — pre-flight bootstrap-detection block
- [ ] Edit `cli/commands/design.mjs` — add `init` subcommand
- [ ] Edit `cli/commands/help.mjs`, `cli/bin/mdcc.mjs`
- [ ] Update `plugins/design/README.md` + `.claude-plugin/marketplace.json`
- [ ] Manual test: `mdcc design init --name acme --no-discovery` in `/tmp/scratch-empty`
- [ ] Manual test: `/design:edit "x"` in empty repo triggers skill `init` with Q1 prefilled
- [ ] Manual test: `/design:help` prints grouped index

### Phase 3 — completeness-critic
- [ ] Decide P3-D1 through P3-D4
- [ ] Create `plugins/design/agents/design-system-completeness-critic.md`
- [ ] Wire auto-run at end of skill `init`
- [ ] Edit `commands/critic.md` — document `--system-only` flag
- [ ] Validate: against dugmate (pass), fresh scaffold (pass), md-claude current (fail ≥4)

### Phase 4 — CLAUDE.md
- [ ] Decide P4-D1 (placement)
- [ ] Edit `CLAUDE.md` — append "Design system bootstrap" section
- [ ] Confirm references resolve

---

## Acceptance

End-to-end smoke after all five phases:

```bash
cd /tmp && rm -rf scratch && mkdir scratch && cd scratch
mdcc design init --name acme --no-discovery
```

**Expected tree (32 files):**

```
.design/
├── README.md
├── INDEX.md
├── config.json
└── system/
    └── project/
        ├── README.md
        ├── SKILL.md
        ├── colors_and_type.css
        ├── assets/{logos,glyphs}/.gitkeep
        ├── preview/ (21 .html + _layout.css)
        └── ui_kits/{desktop,mobile}/ (README.md + index.html)
```

**Expected CLI stdout:**

```
mdcc design init
  project name: acme
  scaffold target: /tmp/scratch/.design
  mode: --no-discovery (Recommended defaults)
  32 created
Completeness check: 0 blockers, 1 warning (OKLCH only present in --accent family).
Next steps:
  1. mdcc design serve --root /tmp/scratch
  2. /design:edit "<feedback>"
  3. /design:new "Onboarding" "..."
  4. /design:help                       # grouped command index
```

**Interactive verification (inside Claude Code, scratch repo with no `.design/`):**

```
> /design:edit "make a posthog/zed-style system"
[skill `init` auto-loads; Q1 pre-answered from brief]
[Round 1 Q2-Q4 + Round 2 Q5-Q8]
[direction echoed, user confirms]
[scaffold runs; completeness-critic runs; 0 blockers]
[returns to /design:edit context; user can now say "make the accent more cyan"]
```

**Verification commands:**

```bash
mdcc design serve --root /tmp/scratch &
curl -s http://localhost:4399/api/tree | jq '.system.project.preview | length'   # → 21
cat /tmp/scratch/.design/config.json | jq 'keys | length'                          # → 11
test -f /tmp/scratch/.design/system/project/SKILL.md && echo OK                    # → OK
ls /tmp/scratch/.design/system/                                                    # → project (literal)
ls plugins/design/commands/ | wc -l                                                # → 10 (9 + 1 compat stub)
cat plugins/design/CATEGORIES.md | grep -c '^### '                                 # → 2 (daily, setup)
```

All checks must pass for ship.

---

## Critical Files for Implementation

**Rename / edit (Phase 0):**
- `/Volumes/D/git/claude-design/plugins/design/commands/design.md` → `edit.md` + new compat stub at original path

**Create (Phase 1):**
- `/Volumes/D/git/claude-design/plugins/design/templates/design-system-skeleton/` (32 files)
- `/Volumes/D/git/claude-design/plugins/design/skills/init/SKILL.md`

**Edit (Phase 1):**
- `/Volumes/D/git/claude-design/plugins/design/skills/design-system/SKILL.md`
- `/Volumes/D/git/claude-design/cli/lib/copy-tree.mjs`
- `/Volumes/D/git/claude-design/package.json`

**Rename / create / edit (Phase 2):**
- `/Volumes/D/git/claude-design/plugins/design/commands/docs.md` → `setup-docs.md`
- `/Volumes/D/git/claude-design/plugins/design/commands/help.md` (new)
- `/Volumes/D/git/claude-design/plugins/design/CATEGORIES.md` (new)
- `/Volumes/D/git/claude-design/plugins/design/commands/edit.md`, `new.md` (pre-flight hooks)
- `/Volumes/D/git/claude-design/cli/commands/design.mjs`
- `/Volumes/D/git/claude-design/.claude-plugin/marketplace.json`
- `/Volumes/D/git/claude-design/plugins/design/.claude-plugin/plugin.json`

**Create (Phase 3):**
- `/Volumes/D/git/claude-design/plugins/design/agents/design-system-completeness-critic.md`

**Edit (Phase 4):**
- `/Volumes/D/git/claude-design/CLAUDE.md`
