# Feature: Bias-free design plugin templates

Validate the docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — this plan refactors load-bearing bootstrap contracts (`design-system` skill ↔ `templates/` ↔ `design-system-completeness-critic`). One missed wire and `/design:setup-ds` breaks for every downstream project.

## Description

Today, `plugins/design/templates/` claims to be a "skeleton" but smuggles a complete visual opinion into every project that runs `/design:setup-ds`:

- A **4 px-base spacing scale** with 8 fixed steps (4/8/12/16/24/32/48/64).
- An **8-step type ladder** with hardcoded font sizes and line-heights (12 → 36 px).
- Specific **cubic-bezier easing curves** (`0.22, 1, 0.36, 1` and `0.65, 0, 0.35, 1`).
- A **1200 px layout max-width**.
- **OKLCH-only** color space (HSL/hex forbidden by the template preamble).
- The **"one-accent rule"** baked in as a hard-stop (`--accent2` is structurally banned).
- An **Apple-flavored 44×44 touch target** minimum (Material says 48 dp).
- **Hardcoded class names** from the original MDCC-DSN/01 system (`.btn`, `.tile`, `.sku`, `.seg`) and the `mdcc` root class in `canvas.tsx.template`.
- 62 inspiration **specimens** with hardcoded radii, opacity values, icon stroke widths, etc. baked into the HTML — even though the README claims they are "reference inventory, NOT a substrate to copy literally".

Result: every new design system inherits a "Linear-ish dark dashboard" prior before discovery has even asked the user what they want. This refactor strips those priors out so the templates are a true layout shell and every visual choice is discovery-driven.

## User Story

As a designer running `/design:setup-ds` for a non-dashboard product (consumer app, print-flavored editorial, brutalist marketing site, 1990s-revival, …), I want the templates to carry zero pre-baked visual choices, so the discovery flow can actually steer the resulting system away from the default "modern SaaS dashboard" aesthetic.

## Problem

Templates encode opinions the discovery flow has not yet collected. The opinions then propagate to the project's `colors_and_type.css`, get reinforced by the completeness-critic's hard-stops, and become invisible defaults nobody questions because they look like "skeleton".

## Solution

Three coordinated changes:

1. **Discovery extension** — collect every value the templates today hardcode. New round of questions (or extension of existing Q1–Q12) covering: spacing strategy, type-scale curve, easing personality, touch-target rule, accent strategy, color-space preference, max-width, shadow stack, status-color hues.
2. **Template skeletonization** — every hardcoded numeric / curve / hue value in `core/colors_and_type.css.tpl`, `README.philosophy.md.tpl`, `SKILL.md.tpl`, `canvas.tsx.template` becomes a `{{placeholder}}` fed by the discovery payload.
3. **Critic gate de-coupling** — `design-system-completeness-critic` C7 (one-accent), V2 (OKLCH-required), and any other check that today encodes a universal opinion either (a) read the project's discovery-recorded preference from `config.json` and gate accordingly, or (b) move from blocker → soft warning.
4. **Specimens neutralization** — keep the 62 HTML files (they're reference inventory), but strip the hardcoded styling so the visual values come from the consuming project's tokens, not from the specimen.

## Metadata

- **GitHub Issue**: (none — direct user request 2026-05-25)
- **Type**: Refactor
- **Complexity**: High
- **App/Package**: `plugins/design/` (cross-cutting: templates + skill + agent)
- **Affected Systems**: `/design:setup-ds` bootstrap flow, `/design:new`, `/design:edit` (only indirectly, via tokens), `design-system-completeness-critic`, every downstream project's next `/design:setup-ds` run
- **Dependencies**: none new — all internal markdown / CSS / TSX edits

---

## Context References

### Must-Read Files

- `plugins/design/templates/design-system-inspiration/core/colors_and_type.css.tpl` (1-112) — primary biased file; spacing/type/easing/max-w/shadows/status hues all hardcoded.
- `plugins/design/templates/design-system-inspiration/core/README.philosophy.md.tpl` (22-46) — "one-accent rule", "44×44", "OKLCH required" as prose hard rules.
- `plugins/design/templates/design-system-inspiration/core/SKILL.md.tpl` (27-30) — duplicates the same hard rules.
- `plugins/design/templates/canvas.tsx.template` (16, 43, 47) — hardcoded MDCC class names + `className="mdcc"` root.
- `plugins/design/templates/design-system-inspiration/_README.md` — declares the "reference inventory" contract; do not break it.
- `plugins/design/templates/design-system-inspiration/_MAPPING.md` — discovery-answer → specimen mapping; will need new mapping rows for new discovery fields.
- `plugins/design/skills/design-system/SKILL.md` (440-525) — discovery payload + scaffold roster; new placeholders must land here.
- `plugins/design/skills/design-system/_DISCOVERY-v1.md` — current Q1-Q12 discovery script; needs Q13+ for the missing dimensions (or extension of Q5/Q6/Q9).
- `plugins/design/agents/design-system-completeness-critic.md` (39-118) — C7 + V2 are the gates that today encode universal opinions. Decision: which become discovery-gated, which become soft warnings, which stay.
- `plugins/design/agents/ux-research-agent.md` — discovery research subagent; if we add discovery dimensions, this agent's `recommendations[]` shape needs to extend too.
- `plugins/design/dev-server/canvas-lib.tsx` — verify whether DesignCanvas / DCArtboard inject any biased styling that the template change can't fix.

### Files to Create

- `.ai/decisions/DDR-026-bias-free-templates.md` — record why we stripped the priors and what the new contract is.
- *(optional)* `plugins/design/templates/design-system-inspiration/core/_defaults.json.tpl` — sane-default values the discovery flow can offer as a "skip → use safe defaults" escape hatch (so unopinionated does NOT mean "user must answer 30 questions"). Discuss in Task 0.

### Documentation

- `plugins/design/CATEGORIES.md` — for any new template file.
- `CLAUDE.md` § "Design plugin" — note that templates are now bias-free skeletons and the discovery payload schema changed.

### Patterns to Follow

- Placeholder syntax is `{{name}}` double-brace (existing convention — see `_README.md`).
- New placeholders MUST appear in the discovery payload schema in `skills/design-system/SKILL.md` (look at line 455-467 for the `discovery:` block in `_scaffold-roster.yaml`).
- For optional/default-able placeholders, the convention is `{{name|default}}` if and only if the `cli/commands/init.mjs` substitution supports it — otherwise the agent emits a literal value or leaves the variable unset and the CSS uses `var(--name, fallback)`. **Verify** in init.mjs before writing the plan's Task 5; if no default syntax exists today, route defaults through the discovery payload, not the template.

---

## Design Decisions

This refactor has no UI of its own — it's plumbing for downstream UIs. No design-system discovery is needed for the plan itself. The whole *point* is to widen the design space available to downstream DSes.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 0: AUDIT current placeholder substitution mechanism

- **Do**: Read `cli/commands/init.mjs` to confirm: (a) it processes `*.tpl` files, (b) the `{{name}}` substitution mechanism, (c) whether default syntax exists, (d) how it errors on unsubstituted placeholders. Also confirm how `skills/design-system/SKILL.md` invokes it (or if the skill writes templates inline, bypassing the CLI).
- **Pattern**: See `plugins/flow/templates/ai-skeleton/` substitution for analogue.
- **Gotcha**: SKILL.md line 712 says "If `maude` is available on PATH, shell out to `maude design init --discovery-payload <path>`. Else inline Write." — there are TWO substitution paths. Both must support the new placeholders.
- **Validate**: Write a one-line spike — a `.tpl` file with a known new placeholder, run substitution both ways, confirm the value lands. Document the answer in a short note before continuing.

### Task 1: DECIDE discovery dimensions

- **Do**: For each pre-baked value in the current templates, decide: (a) goes to discovery? (b) computed from another answer (e.g., touch-target = function of primary platform)? (c) becomes a "safe default" the user can opt into? Produce a table in the DDR (see Task 14):

  | Dimension | Today | New source | Note |
  |---|---|---|---|
  | Spacing base unit | 4 px | Discovery Q (3-option: 4/8/golden) OR computed from density Q12 | — |
  | Spacing scale steps | 8 fixed | Same as base unit | — |
  | Type scale ratio | minor-third-ish (12→36) | Discovery Q (3-option: 1.125 / 1.200 / 1.333 / "custom") | — |
  | Type scale step count | 8 | Default 7; extend if discovery brief says "editorial" | — |
  | Base font size | 14 px | Discovery Q (3-option: 14 / 15 / 16) | — |
  | Easing curve "ease-out" | `0.22, 1, 0.36, 1` | Discovery Q (4-option: ease-out-quart / ease-out-expo / linear / spring) | — |
  | Layout max-width | 1200 px | Discovery Q (3-option: 1200 / 1440 / fluid) OR derived from Q3 platforms | — |
  | Shadow alphas | 0.20/0.25/0.30 | Discovery Q (3-option: hard / soft / none) | — |
  | Status hues | fixed OKLCH | Compute relative to accent hue (analogous) OR keep convention | — |
  | Border offset strategy | OKLCH `+0.04/+0.08/+0.14` | Discovery Q (option: relative-from-bg / fixed-token / inline-via-fg) | — |
  | Touch target min | 44 px | Compute from Q3 primary platform: iOS=44, Material=48, desktop=N/A | — |
  | Accent strategy | one-only (hard-stop) | Discovery Q (3-option: single / paired / chromatic-N) | — |
  | Color space | OKLCH-only (hard-stop) | Discovery Q (3-option: OKLCH / HSL / hex). Default OKLCH but allow opt-out | — |
- **Pattern**: see Q1-Q12 in `_DISCOVERY-v1.md` for question shape — three rounds of `AskUserQuestion`, options come from the `ux-research-agent` payload.
- **Gotcha**: Adding 10+ new questions is too much. Goal is ≤ 4 new questions; the rest are computed defaults or merged into existing Qs.
- **Validate**: Decision table reviewed (eyes only — not a runnable check).

### Task 2: EXTEND `ux-research-agent.md` to surface new dimensions

- **Do**: For every new discovery dimension that needs an option ladder (probably: type-scale ratio, easing personality, accent strategy, color-space), add a `recommendations[]` entry the agent must emit during `discovery` mode. Reuse the existing `confidence` schema.
- **Pattern**: see `agents/ux-research-agent.md` § "discovery mode output schema".
- **Gotcha**: This agent is shared with `/design:new` ux-patterns mode — don't break the `ux-patterns` payload.
- **Validate**: Spawn the agent in isolation with a sample brief, eyeball the JSON.

### Task 3: EXTEND `skills/design-system/_DISCOVERY-v1.md` with the new questions

- **Do**: Add Q13–Q16 (or fold into Q5/Q6/Q9) per the decision table from Task 1. Each question follows existing pattern: header (≤12 chars), three options from research agent, "Other" auto-injected.
- **Pattern**: existing Q1-Q12 in `_DISCOVERY-v1.md`.
- **Gotcha**: Q9 (signature treatment) and Q12 (density) already overlap with several new dimensions. Prefer extending those over inventing new Qs.
- **Validate**: Walk through the discovery flow mentally — count total questions, confirm ≤16, confirm no duplicates.

### Task 4: EXTEND discovery payload schema in `skills/design-system/SKILL.md`

- **Do**: In the `_scaffold-roster.yaml` template (line 453-470), add fields for every new placeholder. Mirror the naming convention (`spacing_base`, `type_scale_ratio`, `ease_out_curve`, `touch_target_min`, `accent_strategy`, `color_space`, `max_width`, `shadow_strategy`, `status_hue_strategy`).
- **Pattern**: existing `discovery:` block keys at line 455-467.
- **Gotcha**: The roster is read by every sub-agent in batches B + C. Adding fields is safe; removing/renaming is not.
- **Validate**: Visual diff — read the block end-to-end, confirm every new placeholder used in templates (Task 5) has a source here.

### Task 5: REFACTOR `core/colors_and_type.css.tpl` — strip every hardcoded value

- **Do**:
  - Lines 25-27 (borders): replace OKLCH `+0.04/+0.08/+0.14` with `{{border_subtle_strategy}}` / `{{border_default_strategy}}` / `{{border_strong_strategy}}` OR keep computed but make the offsets `{{border_offset_subtle}}` etc.
  - Lines 42-45 (status): replace fixed OKLCH with `{{status_success_oklch}}` / `{{status_warn_oklch}}` / etc.
  - Lines 53-55 (shadows): replace alphas with `{{shadow_sm}}` / `{{shadow_md}}` / `{{shadow_lg}}` (whole values, not just alpha — let the discovery payload deliver the full string).
  - Lines 67-74 (spacing): replace 4/8/12/16/24/32/48/64 with `{{space_1}}..{{space_8}}`.
  - Lines 82-89 (type scale): replace each size + line-height with `{{type_xs}}` / `{{lh_xs}}` etc.
  - Lines 96-97 (easing): `{{ease_out_curve}}` / `{{ease_in_out_curve}}`.
  - Line 100 (max-w): `{{layout_max_w}}`.
  - **Remove** the comment preamble line 12 ("OKLCH for accent + status colors (better gamut control than HSL/hex)") — replace with a neutral "Color space: {{color_space}} per discovery".
  - **Remove** "One accent family only (no --accent2)" from preamble line 12 — only mention if `accent_strategy == single`.
- **Pattern**: every existing `{{var}}` placeholder in the same file.
- **Gotcha**: The completeness-critic C6 grep checks for `--accent`, `--bg-0..4`, `--fg-0..3`, `--dur-*` literals — those token NAMES must remain. Only the VALUES become placeholders.
- **Validate**: After substitution with a sample payload, the rendered file should `grep -E '^\s*--(accent|bg-[0-4]|fg-[0-3]|dur-)\b'` and find them all. No remaining numeric literals outside `var(--…)` references.

### Task 6: REFACTOR `core/README.philosophy.md.tpl`

- **Do**:
  - Line 22-24 "One-accent rule" section: wrap in a conditional or replace with `{{accent_rules_block}}` populated by the discovery scaffold based on `accent_strategy`.
  - Line 36 "Touch targets ≥ 44×44" → `Touch targets ≥ {{touch_target_min}}×{{touch_target_min}}` (computed from primary platform).
  - Line 26-28 "Token contract" — drop "No hardcoded hex / px / rem in canvases" since color-space is now optional — replace with `{{token_contract_block}}`.
  - Line 39 "Type ladder:" — `{{type_scale_summary}}` is already a placeholder; verify Task 4 supplies it.
- **Pattern**: see `{{platform_hard_rules}}` line 42 — same approach (block-level placeholder, content delivered by discovery).
- **Validate**: render with three test payloads (single-accent / paired / chromatic) — confirm prose changes accordingly.

### Task 7: REFACTOR `core/SKILL.md.tpl`

- **Do**:
  - Line 27 "One accent. No `--accent2`." → `{{accent_rules_summary}}`.
  - Line 28 "All visuals reference `var(--*)` tokens. No hardcoded hex / px / rem" → leave the `var(--*)` half (it's a real invariant), but drop the "no hex" if color-space is HSL/hex.
- **Pattern**: same as Task 6.
- **Validate**: same approach.

### Task 8: REFACTOR `canvas.tsx.template`

- **Do**:
  - Line 16 (header comment): remove the literal `.btn`, `.tile`, `.sku`, `.seg` example class names. Replace with a generic "use the DS's component classes — see `system/<ds>/preview/` for the available class shapes".
  - Line 43 `className="mdcc"` → `className="{{root_class}}"`.
  - Line 47 `<h1 className="sku">{{NAME}}</h1>` → `<h1>{{NAME}}</h1>` (no class; the example shouldn't suggest a specific naming convention).
- **Pattern**: `{{root_class}}` already exists in `colors_and_type.css.tpl` line 16 — wire to same source.
- **Validate**: scaffold a fresh canvas, confirm no `mdcc` / `sku` / `tile` text appears unless the project's discovery chose `root_class: mdcc`.

### Task 9: NEUTRALIZE inspiration specimens (the 62 HTML files)

- **Do**: For each HTML file under `templates/design-system-inspiration/{foundations,universal,audience-*,platform-*,status,patterns,meta,theme-both}/`:
  - **Verify** the file uses `var(--…)` for every color / radius / spacing / motion value. Files that today use hardcoded `#hex` / `rgb()` / `px` outside `_layout.css` get fixed.
  - For numeric values that *aren't* token-mapped (icon stroke widths in `foundations/iconography.html` line 3, opacity scale in `foundations/opacity.html` line 3, density numbers in `patterns/data-density.html`), replace with `var(--…)` references to tokens declared in `_layout.css` shared chrome.
  - **Leave** the `_layout.css` shared chrome alone — that's the specimen-frame styling, not the demonstrated design.
- **Pattern**: see existing token usage in `core/preview/_layout.css`.
- **Gotcha**: 62 files. Batch by directory. Use grep to find hardcoded values:
  ```bash
  grep -nE '#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|[0-9]+px[^)]' \
    plugins/design/templates/design-system-inspiration/**/*.html \
    | grep -v '_layout.css'
  ```
- **Validate**: re-run the grep; remaining hits must be in `_layout.css` only.

### Task 10: SOFTEN `design-system-completeness-critic.md` C7 (one-accent rule)

- **Do**: Change C7 from "exactly one `--accent*` family" hard-block to: "read `config.json.accentStrategy`; if `single`, enforce; if `paired` or `chromatic-N`, count families against the declared N and only fail on mismatch". If `accentStrategy` not declared in config → default to `single` (backwards-compatible).
- **Pattern**: see how V9/V10/V11 gate on `activeFamilies` (line 98-100).
- **Gotcha**: `config.json.accentStrategy` is a new field — add it to `cli/commands/init.mjs` schema and `plugins/flow/.claude-plugin/config.schema.json` if applicable (verify whether the design-plugin reuses the flow schema or has its own).
- **Validate**: write a sample `colors_and_type.css` with `--accent` + `--accent2`, write a `config.json` with `accentStrategy: paired`, run the critic, confirm pass.

### Task 11: SOFTEN `design-system-completeness-critic.md` V2 (OKLCH-required)

- **Do**: Change V2 from "OKLCH used for ≥1 color in tokens CSS" → "matches `config.json.colorSpace`; if OKLCH, require ≥1 oklch(); if HSL/hex, require ≥1 of that form; if not declared, default OKLCH (backwards-compatible)".
- **Pattern**: same as Task 10.
- **Validate**: hex-only tokens CSS + `colorSpace: hex` config → pass.

### Task 12: WIRE `config.json` new fields end-to-end

- **Do**: In `cli/commands/init.mjs`, the scaffold flow in `skills/design-system/SKILL.md`, and `templates/design-system-inspiration/core/config.json.tpl`, add `accentStrategy`, `colorSpace`, and any other config field surfaced by Task 10/11. Existing projects without these fields use sensible defaults (OKLCH + single).
- **Pattern**: see how `activeFamilies` is wired today.
- **Validate**: scaffold a new DS end-to-end with `accentStrategy: paired` + `colorSpace: hex`, run completeness critic, expect 0 blockers.

### Task 13: SAFE-DEFAULTS escape hatch (decision point)

- **Do**: Decide whether to offer `--skip-discovery` / `--use-defaults` in `/design:setup-ds` that runs the bootstrap with conservative neutral defaults (so a user who doesn't want 16 questions can opt out). If yes, define those defaults explicitly in the DDR — and pick them deliberately to NOT push toward the previous "Linear-ish" bias. Suggested: spacing 4 px-base, type ratio 1.200, ease-out-quart, accent single, color OKLCH, max-w fluid, touch 44 (mobile-aware).
- **Pattern**: existing flag-handling in `commands/setup-ds.md`.
- **Gotcha**: If user opts in, the defaults essentially recreate today's bias. **That's OK** — bias is now opt-in, not enforced. The point is removing the *invisible* bias.
- **Validate**: `/design:setup-ds my-ds --use-defaults` produces a working DS with no questions.

### Task 14: RECORD DDR-026

- **Do**: Write `.ai/decisions/DDR-026-bias-free-templates.md`. Include the decision table from Task 1, the soft-gate strategy from Tasks 10-11, the safe-default escape hatch from Task 13, and the rationale (user request 2026-05-25 — eliminate invisible visual priors so non-dashboard projects aren't fighting the templates).
- **Pattern**: existing DDRs in `.ai/decisions/`.
- **Validate**: DDR keeper subagent reads cleanly.

### Task 15: UPDATE `CLAUDE.md` "Design plugin" section

- **Do**: Note the new contract — templates are bias-free skeletons, all visual values come from discovery payload + `config.json` declarations, completeness-critic gates are discovery-driven not universal.
- **Pattern**: existing "Design plugin" block at line ~140.
- **Validate**: read the section end-to-end — no contradictions with the refactored behaviour.

### Task 16: BUMP version + RELEASE prep

- **Do**: This is a **minor** bump (new opt-in features, no breaking changes for projects already bootstrapped — those keep working under the backwards-compat defaults). Run `scripts/bump-version.sh minor`.
- **Pattern**: see CLAUDE.md § "Release flow".
- **Validate**: `scripts/check-version-parity.sh` passes.

---

## Validation

There is no test suite for this repo (per CLAUDE.md). Validate by walking the contract end-to-end:

1. **Spike substitution**: pick three radically different sample discovery payloads (e.g. "editorial print" / "brutalist marketing" / "dashboard SaaS"), feed each into the scaffold flow, inspect the rendered `colors_and_type.css` + `README.md`. **Pass** = all three look visually distinct and none of them resembles each other.
2. **Backwards-compat**: copy the current `.design/system/<existing-ds>/` files into a scratch project, run completeness critic with the new code, expect 0 new blockers (existing systems still pass).
3. **Completeness critic** (`/design:critic --system-only`): runs cleanly against each of the three sample scaffolds from step 1.
4. **End-to-end scaffold**: `/design:setup-ds bias-test` in `/tmp/scratch-project/`, walk through the 12–16 questions answering each with a deliberately non-default choice (paired accent, HSL color, type ratio 1.333, …). Confirm the resulting `colors_and_type.css` reflects every choice.
5. **No grep bias**: in the final templates, search for any remaining numeric literal that should be a placeholder:
   ```bash
   grep -nE '(0\.[0-9]+|[0-9]+px|cubic-bezier|oklch\([0-9])' \
     plugins/design/templates/design-system-inspiration/core/*.tpl
   ```
   Expect: only `--space-*: 4px`-style scaffolding lines that the discovery genuinely doesn't override, plus the `prefers-reduced-motion` `1ms` value (which is a hard-stop, not a bias).
6. **Self-scaffold dogfooding**: this repo's own `.design/system/` survives the changes — re-run `/design:critic --system-only` against the existing project DS, expect 0 new blockers.

---

## Scenario Coverage (UI tasks — required)

Not applicable — this refactor has no UI surface of its own. Future `/design:setup-ds` runs in downstream projects ARE the verification path.

---

## Acceptance Criteria

- [ ] All 16 tasks completed.
- [ ] Existing downstream projects (those that ran `/design:setup-ds` on the pre-refactor templates) still pass `/design:critic --system-only` — backwards-compat hold.
- [ ] A fresh `/design:setup-ds` with deliberately non-default answers produces a `colors_and_type.css` that reflects every choice (no leftover Linear-ish priors).
- [ ] `grep` for hardcoded numeric / bezier / oklch literals in `templates/design-system-inspiration/core/*.tpl` returns only declared exceptions (the `1ms` reduced-motion guard + the token NAMES like `--accent`).
- [ ] `templates/design-system-inspiration/{universal,foundations,…}/*.html` specimens use `var(--…)` for all colors / radii / spacings / motion — confirmed by grep.
- [ ] `canvas.tsx.template` has no `.btn`/`.tile`/`.sku`/`.seg`/`mdcc` literal text.
- [ ] `design-system-completeness-critic` C7 + V2 are discovery-gated.
- [ ] DDR-026 written and indexed.
- [ ] CLAUDE.md "Design plugin" section updated.
- [ ] Version bumped (`scripts/bump-version.sh minor`), parity check passes.
- [ ] No DDR-worthy decision left unrecorded.

---

## Retro (2026-05-25)

**What worked**
- Audit-first sequencing (Task 0) caught two facts that would have broken the rest of the plan if missed: (a) the CLI substitution only processes 6 core files + `core/preview/*`, not the 62 inspiration specimens; (b) `defaultPayload()` was itself a major bias source — fixing only the templates would have left `--no-discovery` shipping Linear-ish defaults.
- Backwards-compat-by-default on critic gates (`accentStrategy` defaults to `single`, `colorSpace` defaults to `oklch`) — kept the change zero-risk for downstream projects without sacrificing the new freedom.
- End-to-end scratch scaffold (`/tmp/bias-test/`) was the single most valuable verification step — produced the visual proof that the new defaults look "deliberately unfinished" in practice, not just in intent.

**What didn't work**
- DDR-026 number reservation was stale — DDRs 026–042 had been allocated since the plan was written. Renamed to DDR-043 mid-execution. Future plans should grep `.ai/decisions/` for the next free number at write time, not assume.
- Specimens neutralization (Task 9) was harder to scope cleanly than expected. The line between "bias injection" and "demonstration with hardcoded illustrative values" is judgmental. Settled on: fix clear injections (`#ffffff`, `oklch(8%...)` body bg, theme side-by-side); leave demo OKLCH where it serves the specimen's purpose, with NOTES comments clarifying the values are illustrative.

**What to change next time**
- When a plan touches the discovery payload schema, add a Task 0 that lists every existing payload key — not just the ones being changed. Renames (`bg_0_oklch` → `bg_0`) silently break cached payloads in `_history/_system/*` and the spike caught this only by accident.
- For "discover N dimensions" tasks, default to inferring from existing Qs rather than adding new Qs. The expansion in `ux-research-agent.md` `recommendations[]` carries 8 new structural decisions inferred from `vision-brief.json` — no new user-facing questions were needed.

**Followups (NOT blocking ship)**
- Phase 18.5 candidates: extend Stage 3 to explicitly ASK for `accent_strategy` / `color_space` / `spacing_base` / `type_ratio` when the ux-research-agent's confidence is `< 0.85` on the recommendation. The agent already declares these fields in its output schema; Stage 3 just needs to read them.
- Re-bootstrap of this repo's own dogfooded `.design/system/project/` to take advantage of the new freedom — pure opt-in, no urgency.
