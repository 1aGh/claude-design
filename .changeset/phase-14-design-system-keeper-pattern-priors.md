---
"@1agh/md-claude": minor
---

design plugin: `design-system-keeper` agent + pattern-priors envelope + token-usage doctrine

**New auto-routed audit agent — `design-system-keeper`:**

Read-only agent (`tools: Read, Bash, Glob, Grep`) that runs between canvas generation and the critic panel. Two passes:

- **Pattern-reinvention scan** — greps existing canvases + DS preview library for class shapes the new canvas should have lifted (catches `.pcard` re-deriving an existing `.dc-card`, etc.).
- **Token-usage audit** — cross-checks every `var(--TOKEN)` against the DS README's `## Token usage guide` table to flag role mismatches (e.g. `--accent-active` used as a fill instead of body-text contrast).

Findings are warnings by default; the agent self-promotes its own verdict to blocker when ≥ 5 token-usage mismatches OR ≥ 3 pattern reinventions stack on a single canvas (mass-drift signal).

**New user-visible flag on `/design:new` and `/design:edit`:**

- `--skip-ds-keeper` — opt out of the precheck for known-experimental canvases / debug runs.

**Orchestrator integration:**

- `/design:new` step 9.5 spawns ds-keeper in parallel with the critic panel (always, unless flag).
- `/design:new` step 5/5a/5b — envelope template now carries a mandatory `## Pattern priors` section listing existing canvases (with their class roots) + DS preview components (with one-line role). Generator is instructed to lift before reinventing.
- `/design:edit` step 7.5 — conditional precheck (fires when diff ≥ 10 lines OR new class root introduced; skipped on micro-edits).
- `/design:edit` step 8a — DS-drift fast-path. When user feedback explicitly names DS drift (regex matches "design system" / "DS" / Czech "jiné barvy než DS"), routes a stripped panel `[ds-keeper, design-critic]` capped at 2 iterations. Skips 4–6 critic spawns per iter that would have been deterministic find-and-replace.

**New DS doc convention — `## Token usage guide` section:**

`md-claude`'s own DS at `.design/system/project/README.md` gains a Token usage guide table covering all four token families (accent, fg, bg, border) — for each token: "Use for" / "Don't use for". This is the audit source for ds-keeper's Pass B. Future DSes scaffolded by `/design:setup-ds` should follow the same pattern (inspiration-library template carry-over).

**Pattern-lift discipline codified in CLAUDE.md:**

New paragraph under § Design plugin: "Pattern priors come first — when working under a project DS that has existing canvases or preview components, those files ARE the design spec. Lift before invent."

See [DDR-010](.ai/decisions/DDR-010-design-system-keeper-agent.md) and the [Docs Site retro](.ai/logs/system-reviews/docs-site-design-generation-review.md) for the rationale and the cost-saving math (~50–80k tokens per session in the typical "user has existing canvas to lift from" scenario).
