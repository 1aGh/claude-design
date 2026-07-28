---
name: phase-14-design-system-keeper-pattern-priors
status: draft
created: 2026-05-15
decisions:
  - DDR-010-design-system-keeper-agent.md (DDR-009 was claimed by bun-runtime DDR mid-plan; bumped to DDR-010)
---

# Feature: design-system-keeper agent + pattern-priors envelope + token-usage doctrine

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports in `plugins/design/agents/`, `plugins/design/commands/`, and `.design/system/project/`.

## Description

Close the process gaps surfaced in `[../logs/system-reviews/docs-site-design-generation-review.md](../logs/system-reviews/docs-site-design-generation-review.md)` (alignment 7.5/10). Three issues compounded during Docs Site canvas generation: (a) generator reinvented patterns that already existed in `Canvas Viewport.html` / preview-component library, (b) a11y mass-migration drifted brand tokens because no token-usage map was authoritative, (c) density defaulted too generous because no rhythm anchor lived in the envelope.

Ship six interlocking changes that turn these from "process discipline I have to remember" into "spec the orchestrator enforces."

## User Story

As a developer iterating on a project that already has a satisfactory design system + at least one shipped canvas, I want `/design:new` and `/design:edit` to **respect what's already there** — lifting existing patterns by default, drifting tokens only with explicit reason, and surfacing accidental reinvention before the critic panel costs me three iterations to fix.

## Problem

The Docs Site session paid ~2 critic rounds + 1 manual `/design:edit` (≈80–100k tokens of rework) for fixes the orchestrator could have caught upstream:
1. No agent audits "did this canvas lift the patterns its sibling canvases established?"
2. No agent audits "did the token migration respect role conventions (fill vs text)?"
3. The envelope template doesn't list existing canvases as priors — generator defaults to inventing from DS readme + tokens alone.
4. The DS readme describes tokens by name but not by role (when to use `--accent` vs `--accent-active` vs `--accent-hover`).
5. CLAUDE.md doesn't codify "lift existing canvas patterns first" as the design discipline.
6. There's no DDR explaining the rationale or trade-offs of adding this agent — future maintainers will wonder why ds-keeper exists and whether it can be removed.

## Solution

Introduce a **read-only `design-system-keeper` agent** that runs between generation and the critic panel. It performs two checks:

- **Pattern-reinvention scan** — grep existing canvases + preview library for class shapes the new canvas reinvents.
- **Token-usage audit** — cross-check `var(--TOKEN)` usages against a Token Usage Guide table in the DS README.

Severity is warnings (not blockers) unless ≥5 mismatches stack on a single canvas. The orchestrator can override with `--skip-ds-keeper`. The agent does NOT edit; it reports.

Companion changes: envelope template gets a mandatory `## Pattern priors` section; `/design:edit` gets a DS-drift fast-path; CLAUDE.md gets a one-paragraph pattern-lift rule; a DDR captures the decision rationale.

## Metadata

- **GitHub Issue**: n/a (internal retro-driven)
- **Type**: New Capability (agent) + Enhancements (envelope, commands, docs)
- **Complexity**: Medium
- **App/Package**: `plugins/design` (agents + commands + skills) + `.design/system/project` (DS readme) + repo-root CLAUDE.md + `.ai/archive/decisions/`
- **Affected Systems**:
  - `plugins/design/agents/` — new agent file
  - `plugins/design/commands/new.md` + `edit.md` — orchestrator integration
  - `plugins/design/CATEGORIES.md` — new agent listing (if catalog tracks agents)
  - `.design/system/project/README.md` — Token Usage Guide section
  - root `CLAUDE.md` — pattern-lift rule
  - `.ai/archive/decisions/` — DDR-009
- **Dependencies**: no new npm packages. Plain Markdown + Bash recipes.

---

## Context References

### Must-Read Files

- `.ai/logs/system-reviews/docs-site-design-generation-review.md` — Why: source-of-truth for the 3 divergences + 6 actions this plan implements
- `plugins/design/agents/design-critic.md` (lines 1-60) — Why: canonical agent file shape (frontmatter contract, Inputs block, Authority section). The new ds-keeper agent must mirror this format
- `plugins/design/agents/design-system-completeness-critic.md` — Why: closest sibling — runs against the DS itself, structural-only checks, similar JSON verdict pattern
- `plugins/design/commands/new.md` (step 5 envelope construction; step 9 reality-check; step 10 auto-critic loop) — Why: integration points for `## Pattern priors` insertion + ds-keeper invocation
- `plugins/design/commands/edit.md` (step 7 post-write screenshot; step 8 auto-critic) — Why: ds-keeper insertion + DS-drift fast-path routing
- `plugins/design/CATEGORIES.md` — Why: confirm whether the catalog tracks agents (if yes, add ds-keeper; if no, skip Task 7)
- `.design/system/project/README.md` (full file, ~270 lines) — Why: append Token Usage Guide after the existing "Tokens — pillar values" section. Match prose voice.
- `.design/ui/Canvas Viewport.html` (lines 1-200 + 3000-3080) — Why: the canonical "existing canvas" the new envelope must list as a prior. ds-keeper's pattern-reinvention scan must grep its class roots.
- `CLAUDE.md` (the "Design plugin" section at ~line 100) — Why: pattern-lift rule goes here, must respect ≤200-line cap

### Files to Create

- `plugins/design/agents/design-system-keeper.md` — the new agent
- `.ai/archive/decisions/DDR-009-design-system-keeper-agent.md` — decision record

### Documentation

- This plan's own retro source: `.ai/logs/system-reviews/docs-site-design-generation-review.md` — every action item below has a numbered match there
- No external docs / library research needed — internal-plugin work only

### Patterns to Follow

**Agent frontmatter shape** (from `design-critic.md`):

```yaml
---
name: design:design-system-keeper
description: <one-line role + when-to-use, matching existing-canvas pattern> 
tools: Read, Bash, Glob, Grep
---
```

**Agent body structure** (mirror `design-critic.md`):

1. One-liner: "You are the design-system-keeper. You're spawned by …"
2. Authority section (read-only; no edits; no nested invocations)
3. Inputs block (the orchestrator-supplied envelope)
4. Two passes inline (Pattern-reinvention scan; Token-usage audit)
5. Final JSON verdict fenced block

**Token Usage Guide table format** (mirror existing "Tokens — pillar values" table style in `.design/system/project/README.md`):

```markdown
## Token usage guide

| Token | Use for | Don't use for |
|---|---|---|
| `--accent` (oklch 56% L) | Brand stamps, decorative borders, large-text CTAs (≥18px or ≥14px bold), filled buttons, h2 numerals, syntax-highlight accents, callout-tip rules | Body-text links (fails 4.5:1) |
| `--accent-active` (44%) | Body-text links, breadcrumb tail, 10px SKU labels, sidebar active-item text | Solid fills (loses brand recognition) |
| ... | ... | ... |
```

**DDR shape** (from existing files in `.ai/archive/decisions/`):

- frontmatter: `id | title | status | date | tags`
- sections: Context / Decision / Consequences / Alternatives considered / Open questions

---

## Design Decisions

> No UI work. Section retained for plan-template completeness; nothing to populate.

---

## Tasks

Execute in order. T1 → T2 → (T3 || T4 || T5 || T7) → T6.

### Task 1: ADD Token Usage Guide section to DS README

- **Do**: Append a new `## Token usage guide` section to `.design/system/project/README.md`, immediately after the existing "Tokens — pillar values" subsection. Include the role-mapping table covering `--accent` family (3 rows: accent, accent-active, accent-hover), `--fg-*` (4 rows: fg-0..fg-3), `--bg-*` (3 rows: bg-0/bg-1/bg-2 — bg-3/bg-4 lumped as "hover/pressed states"), `--border-*` (3 rows). Each row: token | use for | don't use for. End the section with a one-paragraph "Why this table exists" note pointing at the retro file.
- **Pattern**: Match the prose voice of the rest of `README.md` (htmx-grain, direct, "if X then Y"). Mirror the existing "Tokens — pillar values" table indentation + column widths.
- **Gotcha**: The OKLCH lightness values in the table must match the actual token file. Re-verify against `.design/system/project/colors_and_type.css` before writing — DS could have drifted since the retro was authored.
- **Validate**: `grep -n "Token usage guide" .design/system/project/README.md` returns 1 hit; `markdown-link-check` clean if the project has it (else manual scan).

### Task 2: CREATE design-system-keeper agent

- **Do**: Create `plugins/design/agents/design-system-keeper.md` with the frontmatter + 5-section body documented in Context References → Patterns to Follow. Specifically:
  - **Inputs block** documents: `canvas_path`, `ds_root` (= `<DESIGN_ROOT>/system/<ds>`), `existing_canvases` (array of paths in same DS), `preview_components_root`, `token_guide_path` (the README section anchor from Task 1), `output_path`, `iter_n`.
  - **Pass A — Pattern-reinvention scan** spec: extract every unique CSS class root from the candidate canvas (`grep -oE 'className="[a-z][a-z0-9-]+' | sort -u`), then for each non-trivial class (skip generic ones like `btn`, `row`, `col`), grep all `existing_canvases` + all `preview_components_root/*.html` for similar-shaped names. Heuristic: same word-stem, same compositional role. Surface as `pattern-reinvention` warnings: name the existing analog, line range in the prior file, and an "extend instead?" suggestion.
  - **Pass B — Token-usage audit** spec: parse the canvas for all `var(--TOKEN)` occurrences with CSS context (which property, which selector). Cross-check each against Task 1's table: text properties (color, fill on text-tagged spans) require text-grade tokens; background-color / border-color require fill-grade tokens. Flag mismatches.
  - **Severity rules**: every finding is a warning. Promote to blocker only when (a) ≥5 token-usage mismatches stack OR (b) ≥3 pattern-reinventions stack. Document this in the agent body so future maintainers can tune.
  - **JSON verdict** block: `{ agent, iter, blockers, warnings, top_blockers, top_warnings, passed, opt_out_applied }` — same shape as `design-critic.md`'s verdict.
- **Pattern**: `plugins/design/agents/design-critic.md` and `design-system-completeness-critic.md` (the closest siblings). Use their exact heading hierarchy (`## Authority`, `## Inputs`, `## Pass A — …`, `## Verdict`).
- **Gotcha**: The agent's `name:` frontmatter MUST be `design:design-system-keeper` (with the plugin prefix) per DDR-006. Without it, Claude Code registers the bare slug and collides with builtins.
- **Gotcha**: Tools field MUST be `Read, Bash, Glob, Grep` — the agent is read-only. NO `Write` and NO `Edit`. The orchestrator passes `output_path` but the report-writing is done via Bash heredoc to stdout-redirect (no Edit/Write tool exposure).
- **Validate**:
  ```bash
  test -f plugins/design/agents/design-system-keeper.md
  grep -q '^name: design:design-system-keeper$' plugins/design/agents/design-system-keeper.md
  grep -q '^tools: Read, Bash, Glob, Grep$' plugins/design/agents/design-system-keeper.md
  grep -q '"agent": "design-system-keeper"' plugins/design/agents/design-system-keeper.md  # verdict shape
  ```

### Task 3: UPDATE commands/new.md — Pattern priors envelope section + ds-keeper invocation

- **Do**: Two edits to `plugins/design/commands/new.md`:
  - **3a) Envelope template (step 5).** In the `## Build envelope` section, add a mandatory `## Pattern priors` section to the envelope template. Document the bash recipe:
    ```bash
    # Collect priors — pass into envelope verbatim
    PRIOR_CANVASES=$(find "$DESIGN_ROOT/ui" -name "*.html" -not -path "*$ACTIVE*")
    for c in $PRIOR_CANVASES; do
      CLASSES=$(grep -oE 'className="[a-z][a-z0-9-]+' "$c" | sort -u | sed 's/className="//' | tr '\n' ',' | sed 's/,$//')
      META="$(dirname $c)/$(basename $c .html).meta.json"
      SUB=$(jq -r '.subtitle // ""' "$META" 2>/dev/null || echo "")
      echo "- $c ($SUB) — class roots: $CLASSES"
    done
    PRIOR_PREVIEW=$(ls "$DS_ROOT/preview/components-"*.html 2>/dev/null)
    # One-line role per preview file
    ```
    Include hard wording in the envelope instruction: *"for any compositional element (card, panel, snippet, toolbar, sidebar, modal, button, badge), FIRST check if any prior listed above has the same shape. If yes, lift it (same class names, same paddings, same border treatment). Reinventing is the exception — leave a one-line JSX comment when you do it."*
  - **3b) New step 9.5: ds-keeper invocation.** After step 9 (per-artboard reality-check screenshots) and before step 10 (auto-critic loop), insert:
    ```markdown
    ### 9.5. Design-system keeper precheck

    Run the `design-system-keeper` agent over the new canvas before the critic panel fires. Findings are warnings (not blockers) and feed into the panel as additional context; the orchestrator doesn't need to apply fixes immediately, but the critic panel sees them and can promote to its own blockers.

    Skip with `--skip-ds-keeper` if the user has explicitly opted out (rare — primarily for known-experimental canvases).
    ```
    Plus the bash + Agent-invocation snippet matching the pattern used elsewhere in the file for spawning critics.
- **Pattern**: `commands/new.md` step 10 already shows the parallel-critic-spawn pattern (4 `Agent` invocations). Reuse the same envelope contract.
- **Gotcha**: Step 9.5 must NOT block on agent completion before step 10 starts — they should run **in parallel** with the panel since findings can be merged at the end. Reflect this in the recipe.
- **Validate**:
  ```bash
  grep -q "## Pattern priors" plugins/design/commands/new.md
  grep -q "design-system-keeper" plugins/design/commands/new.md
  grep -q "## 9.5" plugins/design/commands/new.md
  ```

### Task 4: UPDATE commands/edit.md — ds-keeper + DS-drift fast-path

- **Do**: Two edits to `plugins/design/commands/edit.md`:
  - **4a) New step 7.5: ds-keeper invocation.** Same shape as Task 3b but lighter: only fire ds-keeper when the iteration touched ≥10 lines OR introduced any new class root (heuristic — Bash recipe diffs the snapshot against current to detect). Skip on micro-edits to avoid spawn cost on every single-line tweak.
  - **4b) Step 8 routing: DS-drift fast-path.** Insert at the top of step 8 (Auto-critic loop): a regex match on the feedback string against `(barvy|colors?|color\s+drift|DS\s+drift|design system color|jiné barvy)` (Czech + English). If matched: route panel to `[ds-keeper + design-critic]` only (skip signature/frontend/a11y full panel), max 2 iterations. Reasoning: drift fixes are deterministic find-and-replace once ds-keeper surfaces the mismatch — no need for aspiration or correctness reverification beyond design-critic.
  - Update the Auto-critic-loop opt-out flags table to add `--skip-ds-keeper`.
- **Pattern**: existing step 8 panel-resolution logic. The fast-path is a `case` branch above the existing routing.
- **Gotcha**: The DS-drift detection must NOT swallow legitimate aesthetic feedback that happens to mention colors — e.g. "the green here feels off" is a color comment but not a DS-drift complaint. Restrict the regex to feedback that explicitly references "design system" / "DS" / "the system" / Czech `jiné barvy než` patterns. Conservative regex; let it pass-through to default routing on ambiguity.
- **Validate**:
  ```bash
  grep -q "design-system-keeper" plugins/design/commands/edit.md
  grep -q "## 7.5" plugins/design/commands/edit.md
  grep -q "DS-drift fast-path" plugins/design/commands/edit.md
  grep -q "skip-ds-keeper" plugins/design/commands/edit.md
  ```

### Task 5: ADD pattern-lift rule to CLAUDE.md

- **Do**: Append the 12-line block from the retro action #5 under the existing "Design plugin" section of root `CLAUDE.md`. Verbatim text in `[../logs/system-reviews/docs-site-design-generation-review.md](../logs/system-reviews/docs-site-design-generation-review.md)` § "Specific improvement actions" → 5.
- **Pattern**: existing CLAUDE.md "Design plugin" section. Same prose register (direct, "When X, do Y").
- **Gotcha**: Total CLAUDE.md must stay ≤200 lines (per the file's own rules + frontmatter convention). Currently ~150 lines per the retro — 12 lines new = ~162. Safe. If accidentally over 200, move the *oldest* "Design plugin" entry to `.claude/rules/design.md` (create the directory if needed) and link back.
- **Validate**:
  ```bash
  test "$(wc -l < CLAUDE.md)" -le 200
  grep -q "Pattern priors come first" CLAUDE.md
  ```

### Task 6: AUTHOR DDR-009 — design-system-keeper agent

- **Do**: Create `.ai/archive/decisions/DDR-009-design-system-keeper-agent.md` documenting:
  - **Context**: Docs Site retro (link to the review file), 3 divergences quantified, ~80–100k token rework cost.
  - **Decision**: Add read-only ds-keeper agent at `plugins/design/agents/design-system-keeper.md`; auto-route between generation and critic panel; warnings-only severity; opt-out via `--skip-ds-keeper`.
  - **Alternatives considered**:
    - (A) Cram the two checks into existing `design-critic` — rejected: design-critic already does 7-layer UX + DS-compliance, adding two more passes blurs its scope and exceeds its 500-word report budget.
    - (B) Make ds-keeper blocker (not warning) by default — rejected: too aggressive for early iterations; user feedback should drive promotion to blocker if false-positives are rare.
    - (C) Skip entirely + rely on critics — current state; rejected because the retro proved critics catch this 1-2 iterations too late (after generation + screenshot + critic spawn).
  - **Consequences**: +1 agent spawn per `/design:new` (mandatory) and per `/design:edit` (conditional on ≥10 line diff). Estimated added cost: 5–15k tokens per check. Net cost saving: ~50–80k tokens per session in the typical "user has existing canvas they want lifted from" scenario. Adds the new `--skip-ds-keeper` flag surface.
  - **Open questions**: should ds-keeper read the `.meta.json.designSystem` field to scope priors to the same DS in multi-DS projects? (Decision: yes, defer to v0.13 implementation; current single-DS layout doesn't expose the bug.)
- **Pattern**: existing `.ai/archive/decisions/DDR-007-stable-element-id-schema-data-dc-attrs.md` and `DDR-008-dev-server-bin-canonical-helper-home.md` — same frontmatter + section layout.
- **Gotcha**: DDR id must be DDR-009 (next free; verify by `ls .ai/archive/decisions/DDR-*.md | sort | tail -1`).
- **Validate**:
  ```bash
  test -f .ai/archive/decisions/DDR-009-design-system-keeper-agent.md
  grep -q "^id: DDR-009$" .ai/archive/decisions/DDR-009-design-system-keeper-agent.md
  ```

### Task 7: UPDATE plugins/design/CATEGORIES.md — list ds-keeper

- **Do**: Determine whether CATEGORIES.md tracks agents (read first; the file is ~200 lines per Bash inspection). If yes, add a row to the relevant section (likely "Critic panel" or a new "DS keeper" category). If no, add a one-line cross-reference: `Note: read-only audit agents (design-system-keeper, design-system-completeness-critic) live in plugins/design/agents/ but are not user-invocable slash commands — they're auto-routed by /design:new and /design:edit.`
- **Pattern**: existing rows in CATEGORIES.md (single-line tabular descriptions).
- **Gotcha**: ds-keeper is NOT a slash command — `/design:design-system-keeper` should NOT autocomplete. Verify the frontmatter has no `category:` field (only `name:` + `description:` + `tools:`). Cross-check `/design:help` rendering (manual smoke after deploy).
- **Validate**:
  ```bash
  grep -q "design-system-keeper" plugins/design/CATEGORIES.md
  ```

---

## Validation

Run these commands to confirm zero regressions:

1. **Lint** — there's no project-wide lint in this repo (per `CLAUDE.md` — `npm test` is intentionally absent). Skip.
2. **Types** — n/a (no TypeScript in plugin / Markdown files).
3. **Tests** — n/a (no test suite per CLAUDE.md "There is no test suite, lint config, or build step in this repo").
4. **Build** — n/a.
5. **Smoke: agent invocability** — in a scratch project with this plugin installed, run a minimal `/design:new "Smoke" "test canvas"` and verify the ds-keeper agent appears in the iter-1 trace. Then run `/design:edit "the colors are off"` and verify the DS-drift fast-path activates.
6. **Cross-reference scan** — every file touched by this plan references the retro source file (`.ai/logs/system-reviews/docs-site-design-generation-review.md`) at least once so future-me can find the rationale.
7. **Manual** — read the modified `commands/new.md` and `commands/edit.md` end-to-end to confirm step numbering is still monotonic + clean.

---

## Scenario Coverage

> No UI work in this plan. Scenarios n/a. Skipping the cross-platform `scenario-runner` requirement.

---

## Acceptance Criteria

- [x] T1: Token Usage Guide section landed in `.design/system/project/README.md` with all four token families (accent, fg, bg, border) covered — committed in `3d663e6` (user bundled it with the docs-site canvas commit mid-session)
- [x] T2: `plugins/design/agents/design-system-keeper.md` created with correct frontmatter (`name: design:design-system-keeper`, read-only tools) and the two-pass body
- [x] T3: `commands/new.md` step 5 envelope template includes `## Pattern priors` section; step 9.5 invokes ds-keeper in parallel with the panel
- [x] T4: `commands/edit.md` step 7.5 conditionally invokes ds-keeper; step 8a has the DS-drift fast-path routing
- [x] T5: `CLAUDE.md` carries the pattern-lift paragraph under "Design plugin" section; file 127 lines (≤200 limit) — committed in `16af2b6` (user bundled with docs phase 3.4 commit)
- [x] T6: `.ai/archive/decisions/DDR-010-design-system-keeper-agent.md` authored with context + decision + alternatives + consequences (DDR-009 was claimed by `bun-runtime-authoritative` mid-plan; bumped to DDR-010)
- [x] T7: `plugins/design/CATEGORIES.md` references ds-keeper as cross-reference note (auto-routed audit agents section)
- [ ] Smoke run on a scratch canvas confirms ds-keeper fires once and reports at least one finding (pattern-reinvention or token-usage) on a deliberately-drifty input — **NOT YET RUN** (requires fresh project + plugin reload outside this repo; carried into post-merge verification)
- [x] All 6 retro action items in `[../logs/system-reviews/docs-site-design-generation-review.md](../logs/system-reviews/docs-site-design-generation-review.md)` § "Action checklist" tick to `[x]` — done as part of `/flow:done`
- [x] Plan moved to `.ai/plans/archive/` via `/flow:done`

---

## Retro

**What worked**
- Plan was tight and self-validating — each task block carried its own grep recipe in `**Validate**`. Made the Edit-Verify Loop near-instant (1 iter per task across all 7).
- The retro source (`.ai/logs/system-reviews/docs-site-design-generation-review.md`) was already structured as numbered actions, so Plan → Execute → Done was a near-1:1 mapping. No discovery or scope creep mid-execute.
- DS-drift fast-path's regex was conservative on purpose (explicit "design system" / "DS" / Czech "jiné barvy než DS") — avoided the failure mode where every "the green feels off" comment got routed past the full panel. Cost: catches fewer drift cases. Trade-off was correct — false-route into a stripped panel is worse than missing one drift complaint.
- Light review only (no `/flow:review-code` agent spawn) was the right call for markdown-spec changes — agent overhead would have flagged style nits irrelevant to spec correctness.

**What didn't**
- **Plan assumed DDR-009 was free.** Mid-session, user landed `DDR-009-bun-runtime-authoritative-for-dev-server.md` in commit `16af2b6`. Caught at T6 validation, renamed to DDR-010, propagated 3 cross-references (agent + CLAUDE.md + plan frontmatter). Cost: ~2 min. **Lesson:** plan task `### Task 6` already said "verify by `ls .ai/archive/decisions/DDR-*.md | sort | tail -1`" — I skipped the verification step on first write and ran it only in validation. Should have run it before authoring.
- **User bundled T1 + T5 into unrelated commits during my session** (`3d663e6` swept Token usage guide into docs-site canvas; `16af2b6` swept CLAUDE.md pattern-lift into Phase 3.4 docs). Acceptable — both edits landed correctly and the commit messages are honest — but it means the Phase 14 commit in this `/flow:done` only has T2/T3/T4/T6/T7. Anyone reading the git log will need to follow three commits to reconstruct Phase 14's surface area.
- **Plan's validation grep for the DDR (`^id: DDR-009$`) didn't match the repo convention.** Sibling DDRs (007/008) use `# DDR-NNN:` heading-style metadata, not YAML frontmatter `id:` field. The plan author copy-pasted a generic check. Followed actual repo convention; verified via `grep "^# DDR-010:"`.

**What to change in `/flow:plan` or `/flow:execute` next time**
- When a plan creates DDR-NNN files, the plan author MUST run `ls .ai/archive/decisions/DDR-*.md | sort | tail -1` before drafting the plan, and the executor SHOULD re-run it as the first step of the DDR task. (The plan called it out; I skipped it. Both layers should enforce.)
- Plan validation greps should be sourced from the actual repo convention by reading 1–2 sibling files first, not from a template.
- For markdown-only plans, `/flow:done` should default-skip `/validate` (the cross-platform scenario step) per the plan's own "## Validation" n/a flags, rather than requiring the executor to argue around it. A plan-frontmatter field like `validation_profile: docs-only` would automate this.

**Carry-over for follow-up**
- **Smoke run** of `/design:new "Smoke" "..."` against a scratch project to confirm ds-keeper fires + reports at least one finding on a deliberately-drifty canvas. Requires plugin marketplace reload outside this repo.
- **Inspiration library** doesn't yet ship a `Token usage guide` template per DS bootstrap. New DSes scaffolded by `/design:setup-ds` won't get one until the inspiration library is updated (carry-over already tracked under design-system-init phase open items).
- **Threshold tuning.** `≥ 5 token mismatches` and `≥ 3 pattern reinventions` for stack-promotion to blocker are educated guesses. After 5–10 sessions of real use, audit false-positive rate of self-promoted blockers; tune or add an envelope-level `--accept-drift` hint if needed (recorded as open question in DDR-010).
