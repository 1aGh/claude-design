---
"@1agh/md-claude": minor
---

The `design` plugin gains a bootstrap workflow that takes a project from cold-start to a usable design system in 8 questions. Plus a `<group>-<verb>` command categorization mirroring the flow plugin, an adaptive completeness-critic, and multi-DS support.

**New slash commands**

- **`/design:setup-onboard`** — project-level environment init (deps check, install hints, skeleton `.design/config.json`). Mirrors `/flow:setup-onboard`. Auto-invoked transparently when other commands hit a missing config.
- **`/design:setup-ds <name> "[brief]"`** — dedicated entry point for creating a design system. Thin wrapper that loads skill `design-system` in bootstrap mode. Three internal modes (`first-bootstrap`, `additional-ds`, `re-bootstrap`).
- **`/design:setup-docs`** — was `/design:docs`; moved to the `setup-*` group.
- **`/design:help`** — grouped command index, mirror of `/flow:help`.

**Renamed**

- `/design "<feedback>"` → **`/design:edit "<feedback>"`**. The bare `/design` form is preserved as a one-version compat stub; will be removed in the next minor.
- `/design:docs` → **`/design:setup-docs`**.

**Skill `design-system` — dual-mode**

- **READ mode** (default) — loads the active canvas's declared DS for iteration.
- **BOOTSTRAP mode** — auto-invoked by `/design:setup-ds` and as a fallback by `/design:edit` / `/design:new` against fresh repos. Runs hard-deps pre-flight → 8-question discovery (2 `AskUserQuestion` rounds) → consults `_MAPPING.md` → generates project-flavored files using `plugins/design/templates/design-system-inspiration/` as reference → runs `design-system-completeness-critic` → prints next-step block.

**`mdcc design init`** (new CLI subcommand)

Non-interactive helper for CI / scripted contexts. `--no-discovery` scaffolds Core only with Recommended defaults; `--discovery-payload <path>` reads pre-computed answers for deterministic skill-driven scaffolds. Interactive bootstrap requires Claude Code — the CLI refuses with a hint.

**Adaptive completeness-critic**

New agent `plugins/design/agents/design-system-completeness-critic.md` validates `<designRoot>/system/<ds>/` against a **3-tier rule set**:

- **Core** (blocker regardless of profile) — README + SKILL + tokens presence, one-accent rule, Core vars (`--accent`, `--bg-0..4`, `--fg-0..3`, motion var), minimum specimens (3/8/12 per profile), no D2 divergence (`system/<projectslug>/` is rejected).
- **Conventional** (warning, gated by `activeFamilies[]` + `completenessProfile` `minimal | standard | strict`) — OKLCH usage, per-family specimens (status / presence / mono), `prefers-reduced-motion` guard, theme blocks.
- **Free-form** (no check, acknowledged) — user extensions (`patterns/`, `voice/`, etc.) pass silently.

Auto-runs at the end of the bootstrap flow; opt-in via `/design:critic --system-only [--ds=<name>] [--all-ds]`.

**Multi-DS support**

Projects can now declare multiple design systems under `<designRoot>/system/<name>/`. Each canvas's `.meta.json.designSystem` field names the DS it's built against. The completeness-critic, `flow:design-system-guard`, and the read-side of skill `design-system` all scope to that DS — tokens from one DS never blend into another. `/design:new --ds=<name>` validates the slug against `config.designSystems[]` and fails with a hint to `/design:setup-ds` on unknown DSes (no fallback prompt).

**Schema additions** (`plugins/design/dev-server/config.schema.json`)

- `extensions[]` — user-added subdirs the critic acknowledges but doesn't validate
- `completenessProfile: minimal | standard | strict`
- `activeFamilies[]` — `accent | status | presence | mono`
- `designSystems[]` — multi-DS list with name/path/description
- `defaultDesignSystem` — fallback when canvas meta has no DS field

Plus `canvas-meta.schema.json` gains `designSystem` (kebab-case slug) + `opt_out_scope` (palette/aesthetic/full) fields.

**Inspiration library** (skeleton — full expansion in a follow-up)

New `plugins/design/templates/design-system-inspiration/` ships 24 reference files: `_README` + `_MAPPING` + Core 10 (templates for README, SKILL, INDEX, config, tokens CSS + 9 specimens) + Universal 6 (toggles, dialogs, tooltips, tables, callout, empty-state). Each specimen has a SPECIMEN comment header documenting which tokens it demonstrates and the copy voice it uses. Bootstrap mode reads these as **references**, then generates project-flavored equivalents — never copies verbatim, never with placeholder copy.

**Categorization** (`plugins/design/CATEGORIES.md`)

12 commands grouped into `daily` (8: edit, new, critic, browse, rollback, screenshot, handoff, help) + `setup-*` (3: setup-onboard, setup-ds, setup-docs). Plus the bare `/design` compat stub.

**Site (docs.iagh.cz)**

`/docs/design` is now a section: `index` (overview), `bootstrap` (cold-start narrative), `multi-ds` (multi-DS reference), `categories` (mirror of `CATEGORIES.md`). Plus the auto-generated reference pages regenerate from the renamed source files. The `mdcc design init` subcommand is documented in `/docs/cli`.

**CLAUDE.md**

New "Design system bootstrap" section documenting the 8 load-bearing rules so future sessions don't re-derive them: onboard-before-bootstrap, one-skill-owns-DS-work, three-bootstrap-sub-modes, inspiration-library-not-substrate, dynamic-scaffold-count, single-DS-dirname-is-literal-`project`, three-tier-compliance, daily-verb-is-edit.

Refs: [`.ai/plans/design-system-init.md`](https://github.com/1aGh/md-claude/blob/main/.ai/plans/archive/design-system-init.md).
