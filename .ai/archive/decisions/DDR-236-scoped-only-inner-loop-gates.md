# DDR-236: Scoped-only inner-loop gates — repo-wide quality gates run once, at /flow:validate

- **Date:** 2026-09-02
- **Status:** Accepted
- **Tags:** flow, quality-gates, execute, utils-verify, bug-fix, performance, config-schema

## Context

Implementation commands (`/flow:execute` per-task loop, `/flow:bug-fix` step 5, `/flow:quick`) ran quality gates **during** implementation via `/flow:utils-verify`, which pointed at the project's `quality.*` commands. In monorepos those commands are repo-wide by construction, so the skill's "cheap, 15–60 s" promise was unkeepable. Measured evidence (AI-StudyMate `wiki-adoption-telemetry` execution report, 2026-09-01):

- `quality.typecheck` fanned out to 37 turbo projects, ran **16m15s**, and was force-killed **without producing a verdict** — pure loss.
- The "affected tests" idiom `pnpm --filter X test -- <pattern>` silently swallowed the filter (pattern after a bare `--` with a `vitest run` script) — 7 full-suite runs (~55 s each) where 1.2 s scoped runs would do. ~50× waste on the most-repeated command.
- Gates ran mid-implementation, were manually killed by the user, then ran again at `/flow:done`.
- `/flow:bug-fix` step 5 ran the full `lint + typecheck + test + build` pipeline inline, pre-commit.

Roughly 25–30 minutes of wall-clock went to checks that could not have said anything. Root cause: a **config/skill mismatch** — no mechanism existed to declare scoped gate variants, so commands fell back to repo-wide ones.

## Decision

1. **New top-level `qualityScoped` config block** (flat map gate-name → shell command, keys mirror `quality`). It is the ONLY gate source the implementation inner loop runs. It is a **separate top-level block, not keys inside `quality`**, because `/flow:validate` Step 3.5 executes every non-conventional `quality.*` key as a blocking custom gate — scoped keys inside `quality` would run twice.
2. **Defer, never fall back.** A gate with no `qualityScoped` entry is deferred to `/flow:validate` with a visible one-liner. The inner loop never runs a repo-wide `quality.*` command. Sole substitution: `format`/`lint` may run the `quality.*` command constrained to changed files via file args (the pre-existing `/flow:quick` staged-files trick). `typecheck` has no generic file-args form → declared-or-deferred.
3. **The full `quality.*` pipeline runs exactly once, at the outer gate** (`/flow:validate`, reached via `/flow:done`). `qualityScoped` is invisible to validate.
4. **Per-task `code-simplifier` pass removed from `/flow:execute`.** It doubled every task's verify cost and duplicated `/flow:done` Step 4, which already runs the simplifier on the whole feature diff with a race-guard + recheck. One verify per task.
5. **Filter-sanity guard for affected tests** (quality-gates skill §7): a scoped test run reporting ~the full suite means the filter was swallowed — switch to the runner's exec form.
6. **Monorepo scoping uses changed-only `[base]`, never dependents-inclusive `...[base]`** — with a shared package touched, dependents-inclusive selects ~the whole monorepo (measured 37/37). Dependent breakage is `/flow:validate`'s job.
7. **`/flow:execute` gains ticket-only mode** — degrades cleanly when `$ARGUMENTS` is not a plan file (context from tracker/conversation, checkpoints under a ticket-derived slug, plan-file steps skipped with visible notes).

## Alternatives considered

- **`lintScoped`-style keys inside `quality`** — rejected: validate's custom-gate loop would execute them as blockers a second time.
- **Auto-deriving filters (e.g. turbo `--filter`) for the user** — rejected: violates the "never fabricate a command" rule (quality-gates §4); the dependents trap shows the "obvious" derivation is wrong per-repo.
- **Keeping repo-wide gates but backgrounding them** — rejected: a verdict arriving after the task moved on is noise; the outer gate already covers it, once.
- **Per-gate object shape with `scope` fields** — rejected: keeps `quality` v1's flat-string contract intact (own DDR'd shape); two flat maps are simpler than one nested schema.

## Consequences

- Implementation loop is cheap **by construction** regardless of repo size; users can try changes immediately.
- Between-task regressions in *dependent* packages surface at `/flow:validate` instead of mid-loop — accepted trade-off, explicitly documented.
- Projects want a one-time `qualityScoped` declaration; `maude doctor --fix` autofill for it is a follow-up (schema validation works today).
- Evidence trail: AI-StudyMate execution report → plan `.ai/plans/archive/feature-fast-inner-loop-gates.md`.
