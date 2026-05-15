# DDR-010: `design-system-keeper` agent — read-only DS-fidelity audit between generation and the critic panel

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, agents, design-system, critic-panel, retro-driven, token-discipline, pattern-lift
- **Related:** [DDR-006](./DDR-006-plugin-namespace-in-name-frontmatter.md), `plugins/design/agents/design-system-keeper.md`, `plugins/design/agents/design-critic.md`, `plugins/design/agents/design-system-completeness-critic.md`, `plugins/design/commands/{new,edit}.md`, `.design/system/project/README.md` § Token usage guide, `.ai/logs/system-reviews/docs-site-design-generation-review.md`

## Context

The Docs Site canvas generation retro (`.ai/logs/system-reviews/docs-site-design-generation-review.md`, 2026-05-15, alignment 7.5/10) surfaced three divergences that compounded during a single `/design:new` session:

1. **Pattern reinvention.** `Canvas Viewport.html` already shipped a working `.dc-card`, `.fc`, `.ab-sku` family; the generator re-derived parallel `.pcard`, `.land-snippet`, missing `.ab-sku` until the design-critic flagged the gap. The reading was "design from DS tokens" instead of "design from existing canvases first, fall back to tokens for new compositional needs".
2. **Token-usage drift.** `a11y-critic` correctly flagged 12+ `--accent` text-grade usages failing 4.5:1. The fix migrated **every** `--accent` usage to `--accent-active`, including fills + decorative stamps + button backgrounds where contrast was never the issue. Result: brand identity read muted across all four artboards. The DS readme had no token-usage guide spelling out "`--accent` for fills, `--accent-active` for body text only" — so the migration target had to be derived mid-iter, and was wrong on the first try.
3. **Density default too generous.** Generator picked `space-7/8` (32–48 px) for hero/catalog spacing despite the DS being on the controlled-density side (8/12 px chrome cadence). No rhythm anchor in the envelope to dampen.

Total cost of these three: ~2 critic rounds + 1 manual `/design:edit` pass, ~80–100k tokens of rework. Most of it was process drift — the generator did the right thing once feedback arrived, but the orchestrator could have caught all three before the panel cost an iteration.

The retro's action checklist (six items) is what this DDR formalizes. Items 3 (envelope `## Pattern priors`), 4 (DS-drift fast-path in `/design:edit`), 5 (CLAUDE.md pattern-lift rule), and 6 (auto-memory entries) are scoped, mechanical edits — they don't warrant a DDR on their own. **Items 1 (the new agent) + 2 (Token usage guide section) are the load-bearing structural change.** This decision record covers the agent + the system that surrounds it.

## Decision

Add a **read-only `design-system-keeper` agent** at `plugins/design/agents/design-system-keeper.md`, auto-routed by the orchestrator between generation and the critic panel:

- **`/design:new` step 9.5** — runs in parallel with the critic panel after the post-write reality-check screenshots. Always fires unless `--skip-ds-keeper`.
- **`/design:edit` step 7.5** — conditionally fires when the diff ≥ 10 lines OR introduces any new class root (cheap heuristic — avoids spawn cost on micro-edits).
- **`/design:edit` step 8a (DS-drift fast-path)** — when feedback explicitly names DS drift (regex matches "design system", "DS color drift", Czech "jiné barvy než DS"), route a stripped panel `[ds-keeper, design-critic]` capped at 2 iterations. Skips 4–6 critic spawns per iter that would have been deterministic find-and-replace anyway.

**Two passes, both inline in the agent body:**

1. **Pattern-reinvention scan.** Extract every non-trivial CSS class root from the candidate canvas; grep all priors (existing canvases in the same DS + `<ds_root>/preview/components-*.html`); surface matches where head-words align AND ≥ 2 of `{padding, border, background, gap, display}` overlap. Suggestion: lift the prior or comment why a divergence is intentional.
2. **Token-usage audit.** Parse every `var(--TOKEN)` with CSS-property context (text-grade vs fill-grade vs border-grade); cross-check against the DS README's `## Token usage guide` table (added in T1 of this plan); flag mismatches against "Use for" / "Don't use for" columns.

**Severity model — warnings, with stack-promotion to blocker.** Every finding is a warning by default. The agent self-promotes its own verdict to `blocker` only when:
- ≥ 5 token-usage mismatches stack (mass-migration drift signal — exactly what triggered the Docs Site retro), OR
- ≥ 3 pattern-reinventions stack (generator re-deriving from tokens instead of lifting)

These thresholds live as documented constants in the agent body so future maintainers can tune them after observing real-world false-positive rates.

**Tools restricted to `Read, Bash, Glob, Grep`.** No `Write` / `Edit` exposure — the agent is structurally read-only. Report-writing is the only side effect, performed via `Bash` heredoc redirected into the orchestrator-supplied `output_path` (`<designRoot>/_history/<slug>/NNN-ds-keeper.md`).

**Frontmatter — `name: design:design-system-keeper`** per [DDR-006](./DDR-006-plugin-namespace-in-name-frontmatter.md). Without the `design:` prefix, Claude Code registers the bare slug and risks colliding with built-ins or other plugins.

**Companion changes that ship with this DDR:**

- `.design/system/project/README.md` — new `## Token usage guide` section (the audit source for Pass B). Future DSes scaffolded by `/design:setup-ds` should follow the same pattern; the inspiration library should grow a Token-usage-guide template (carry-over, not in this DDR's scope).
- `plugins/design/commands/new.md` — envelope template gets a mandatory `## Pattern priors` section listing existing canvases + preview components with their class roots; step 9.5 spawns ds-keeper.
- `plugins/design/commands/edit.md` — step 7.5 conditional spawn; step 8a DS-drift fast-path routing.
- Root `CLAUDE.md` — one-paragraph "Pattern priors come first" rule under § Design plugin.
- `plugins/design/CATEGORIES.md` — cross-reference note (ds-keeper is NOT a slash command — it's an auto-routed audit agent, parallel to `design-system-completeness-critic`).

## Rejected alternatives

**Option A — Cram both checks into existing `design-critic`.** Rejected: `design-critic` already runs a 7-layer UX walk (Pass A) + DS compliance (Pass B), and its report budget is ~500 words. Adding a third pass for prior-grep + a fourth for token-role audit blurs the agent's scope, doubles its run time, and risks the existing two passes degrading. The `design-critic` is the holistic-review specialist; ds-keeper is the priors-and-roles specialist. Two agents, two scopes — same model executes them, but the report shapes stay clean and the verdict JSON stays parseable.

**Option B — Make ds-keeper blocker (not warning) by default.** Rejected: too aggressive for early iterations. A warning-by-default surface lets the critic panel decide whether the surrounding context warrants a blocker promotion (e.g. a single pattern-reinvention on an exploratory canvas is fine; the same on a marketplace landing is not). The stack-promotion rule (≥ 5 / ≥ 3) catches the high-confidence "mass drift" signal where a deterministic fix is obviously called for. If real-world false-positive rates are low, future iteration can lower the thresholds.

**Option C — Skip the agent entirely; rely on existing critics + better envelope wording.** This was the state before this DDR. The retro proved it doesn't work: critics catch DS-drift 1–2 iterations *after* generation + screenshot + critic spawn, when the cost to course-correct is already 30–50k tokens spent on the wrong direction. The envelope-only path also can't solve mass-migration drift — that's an *artifact-level* mismatch, not a brief-level one, and only an artifact-level audit can surface it before the critic panel chases symptoms.

**Option D — Run as a pre-generation gate (block generation until priors are listed).** Rejected: too disruptive, and the `## Pattern priors` envelope section (T3 of the implementation plan) already covers the pre-generation surface. The agent's value is the *post-generation* audit — checking whether the generator obeyed the envelope's priors directive, not just whether the directive was present.

## Consequences

**Positive:**

- **Cost savings in the typical case.** When a project has ≥ 1 prior canvas, the retro estimated 50–80k tokens saved per session on average (avoiding the 1–2 critic-driven correction rounds that would otherwise chase symptom-level fixes).
- **DS drift caught upstream.** Mass-migration scenarios (the `--accent` → `--accent-active` sweep) get flagged before they ship in the iter-0 output; the user sees one consolidated note instead of N follow-up critic findings.
- **Pattern-lift discipline becomes spec, not memory.** The agent enforces what the CLAUDE.md rule + retro guidance ask for. New contributors don't need to read the retro to behave correctly — the orchestrator routes them through the audit automatically.
- **Auditable.** The report at `_history/<slug>/NNN-ds-keeper.md` makes future retros cheap — every iteration's pattern-reinvention + token-usage state is on disk.

**Negative / tradeoffs:**

- **+1 agent spawn per `/design:new`** (mandatory) and per `/design:edit` (conditional). Estimated added cost: 5–15k tokens per check (read-only, narrow scope, no nested invocations). Net cost in the worst case (no priors, no mismatches) is the spawn overhead with no audit value — accept this as a small tax to prevent the much larger drift-rework cost.
- **Token usage guide must exist per DS.** Pass B degrades to a generic text-vs-fill heuristic when the DS README has no `## Token usage guide` section. Existing single-DS projects (md-claude itself) get the section in this PR; future DSes scaffolded by `/design:setup-ds` need the inspiration library updated to include a template (carry-over).
- **False-positive risk on edge cases.** Pattern-reinvention scan's heuristic (head-word + ≥ 2 CSS-property overlap) will flag legitimate parallel composers occasionally. Severity-as-warning + the suggested-not-required `fix:` field keep the impact low; the stack-promotion threshold prevents single false positives from gating anything.
- **`--skip-ds-keeper` flag adds surface.** Documented in both `commands/new.md` and `commands/edit.md` flag tables. Use is rare (known-experimental canvases, debug runs).

**Neutral:**

- Adds the cross-reference row in `plugins/design/CATEGORIES.md` (ds-keeper is auto-routed, not user-invocable; not a slash command).
- No CLI / package.json changes — the agent ships via the plugin marketplace mechanism alongside the rest of `plugins/design/agents/*-critic.md`.

## Open questions

- **Multi-DS scoping.** Should ds-keeper read `.meta.json.designSystem` to scope priors to the same DS in multi-DS projects? Today's implementation assumes single-DS-per-project (the orchestrator filters `existing_canvases` before passing them in). For multi-DS, the orchestrator's collection recipe (`commands/new.md` step 5a) reads `meta.json.designSystem` and skips canvases with a different DS — the agent itself is DS-agnostic. **Decision: defer multi-DS-aware spawn logic to v0.13** when the first multi-DS project surfaces. Single-DS layout doesn't expose the bug; the orchestrator-side filter is sufficient until then.
- **Threshold tuning.** `≥ 5 token mismatches` and `≥ 3 pattern reinventions` are educated guesses from the Docs Site session. After 5–10 sessions of real use, the metric to watch is the false-positive rate of self-promoted blockers — if a single mass-migration drives the count to 5+ but the migration was intentional, the threshold needs to lift OR the agent needs an `--accept-drift` envelope hint from the user.
- **Token usage guide as a template.** The inspiration library at `plugins/design/templates/design-system-inspiration/` doesn't yet ship a Token-usage-guide template. Adding one is a separate carry-over (tracked under "Inspiration library expansion" in STATE.md from the design-system-init phase).
