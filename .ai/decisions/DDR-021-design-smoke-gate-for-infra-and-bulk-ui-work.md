# DDR-021: `/design:smoke` is the gate for infra changes + bulk multi-canvas operations

- **Date:** 2026-05-19
- **Status:** Accepted
- **Tags:** design, dev-server, smoke, render-gate, validation, flow-execute, phase-3.6
- **Related:** [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md), [DDR-019](./DDR-019-canvas-tsx-format.md), [DDR-020](./DDR-020-single-dev-server-runtime-bun.md), [`.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`](../logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md), [`.ai/logs/system-reviews/design-edit-screenshot-habits-review.md`](../logs/system-reviews/design-edit-screenshot-habits-review.md)

## Context

The design plugin already enforces per-canvas visual verification at three points:

- `/design:edit` step 3.5 — pre-edit context screenshot when selection / multi-surface compare
- `/design:edit` step 7 — post-write reality-check screenshot (mandatory, fires even under `--no-critic`)
- `/design:new` step 9 — per-artboard post-write screenshots (mandatory, fires even under `--no-critic`)
- `/design:setup-ds` step 9 — 3 signature specimen screenshots

Single-target. Each one screenshots the canvas being authored or edited and verifies it actually rendered.

Phase 3.6 and 3.6.1 retros both documented a recurring failure mode that bypasses every one of those gates: **"build green ≠ user-visible green"**. The pattern:

1. A `/flow:execute` phase touches dev-server internals (canvas-build, canvas-lib, http.ts, server.ts) — no `/design:edit` or `/design:new` invocation, so steps 7/9 never fire.
2. OR a bulk multi-canvas operation lands (the Phase 3.6.1 codemod migrating 37 specimens in one Bun script run) — same story; no per-canvas hook fires.
3. `bun test` is green. `bun.build` is clean. The phase marks complete.
4. The user opens a canvas → triple chrome, htmlFor-in-prose, dropped CSS, undefined references, blank iframe. Surface only via human exploration.

Phase 3.6.1's retro Theme 1 quotes the Phase 3.6 retro verbatim — the plan author **knew** the trap, **documented** the trap, and then **didn't gate against it**. That's the root cause: existing per-canvas gates don't cover the work shape that broke. The plan-as-template stayed unchanged.

The per-canvas hooks aren't broken — they work as designed for `/design:edit` / `/design:new` invocations. The gap is **infra changes** and **bulk batch operations**, which are first-class shapes of work in this repo (dev-server refactors, runtime migrations, codemod runs) and have no equivalent gate.

## Decision

**`/design:smoke` is a new slash command that batch-screenshots every canvas under `<designRoot>/ui/*.tsx` + every preview specimen under `<designRoot>/system/*/preview/*.tsx`, flags blank iframes + console errors, and exits non-zero on any failure.**

It is mandatory at phase-end for any `/flow:execute` run whose diff matches any of:

| Trigger | Why |
| --- | --- |
| `plugins/design/dev-server/**` modified | Dev-server change can break the TSX pipeline silently (Phase 3.6.1 B7, dropped CSS injector G2). |
| `<designRoot>/_lib/**` modified | canvas-lib / viewport changes affect every canvas's runtime envelope (Phase 3.6.1 B2). |
| `plugins/design/templates/canvas*.tsx.template` modified | Scaffold-template change affects every future canvas. |
| ≥ 3 `*.tsx` files mutated under `<designRoot>/` outside a `/design:edit` invocation | Bulk migration shape (Phase 3.6.1 codemod = 37 files; the per-canvas hook never fires). |

Triggered automatically by `/flow:execute` at phase-end (new section 3.5; see consequences). Can be invoked manually any time via `/design:smoke`.

### Read-every-screenshot rule

When `/design:smoke` output is > 5 PNGs, the executor MUST `Read` every PNG into context, not sample. The motivating incident is **Phase 3.6.1 retro learning #4** — the agent screenshotted 38 specimens, sampled 3, called it good; the user opened `colors-accent` and the triple-chrome was pre-attentive in 2 seconds. Some visual regressions are catchable by human glance and miss-able by sampling. The compute cost of reading N PNGs is bounded; the cost of shipping a visual regression is unbounded.

### Implementation surface

- `plugins/design/dev-server/bin/smoke.sh` — the helper. Globs `*.tsx` under `<designRoot>/ui/` + `<designRoot>/system/*/preview/`, uses `agent-browser` to open each, polls for mount, captures `--full`, eval-checks `window.console.error` count, writes table to stdout + screenshots to `<designRoot>/_history/_smoke/<timestamp>/<slug>.png`. Single source of truth for the smoke recipe.
- `plugins/design/commands/smoke.md` — slash-command wrapper that calls the helper.
- `plugins/flow/commands/execute.md` — new section 3.5 "UI smoke gate" wires the trigger detection + helper invocation.

## Alternatives considered

### A — Add a render-gate row to the plan acceptance-criteria template

Make every plan that touches design infra include "affected canvases render without console errors" as an explicit acceptance bullet.

- **Pros:** Documentation-only; zero code change.
- **Cons:** Phase 3.6.1's plan *already* quoted the Phase 3.6 retro warning about this trap in its Problem table. Documentation didn't change behavior. The plan author wrote acceptance criteria copied from the prior phase's template. Adding a bullet to a template doesn't survive copy-paste; adding a hook that fires automatically does.

### B — Spawn a critic agent for "render verification"

A `render-critic` subagent that opens canvases + screenshots + reports.

- **Pros:** Fits the existing critic-panel pattern.
- **Cons:** Critics are quality-of-design judges; render verification is correctness. Mixing kills both — the panel becomes slower (every edit waits on render proof) and the render check is buried in JSON verdict noise. A dedicated bash helper + slash command is cheaper and more legible.

### C — Make per-task smoke part of `/flow:utils-verify`

Run smoke on every task in the Edit-Verify Loop.

- **Pros:** Earliest possible catch.
- **Cons:** Most tasks don't touch UI. Running a 30s smoke per task balloons execute time. Phase-end is the right granularity — per-task only if the diff matches the trigger set, which is more complexity than the win.

### D — `/design:audit-runtime` (compare canvas-lib exports vs legacy runtime/)

Different problem (Phase 3.6.1 B2 — replacing code without diffing the old surface). Worth doing but doesn't replace smoke; smoke catches the user-visible failure, audit catches the design-time architectural gap. They're complementary, not alternatives. Out of scope for this DDR.

## Consequences

**Positive:**

- Phase 3.6 / 3.6.1 / 3.6.2 / 3.6.x class of regression becomes structurally caught — silent-render-broken work fails at phase-end instead of post-`/validate` user exploration.
- The plan template stays free-form; the gate lives in `/flow:execute` and fires regardless of what the plan author remembered to write. Defense in depth.
- `_history/_smoke/<timestamp>/` becomes a visual changelog of every infra change. Useful for retros and regression diffing.
- "Read every screenshot, not sample" rule generalizes beyond this gate — it's the lesson for any agentic visual review.

**Negative / trade-offs:**

- Adds ~30 s to design-infra phases. Acceptable; the alternative is the 6-hour repair arc Phase 3.6.1 ran post-`/validate`.
- One more helper script + one more slash command + one more flow-command edit. Maintenance surface grows by ~3 files.
- "Read every screenshot" rule pushes images into agent context. For N=40 canvases each ~50 KB, that's ~2 MB of PNG bytes per smoke. Bounded; not a budget issue for `/flow:execute`.
- Smoke as a phase-end hook means task-N can pass while phase-end fails. The Edit-Verify Loop's 3-iteration counter doesn't help at this level; phase-end failure forces a follow-up triage task, which is the right shape (smoke failures are usually integration-shape, not single-task-fix).

**Closed risks:**

- ~~"We'll keep documenting the trap without gating against it"~~ — closed by making the gate live in `/flow:execute`, not in the plan template.

## Compatibility notes

- **Existing `/flow:execute` runs** — section 3.5 fires only when phase diff matches the trigger set. Phases that don't touch design infra are unaffected.
- **Non-design projects using `flow`** — the trigger paths (`plugins/design/dev-server/**`, `<designRoot>/_lib/**`) only exist in this repo. Downstream projects using `flow` see the section but its conditions are never met. Could be made portable via `boundaries.design.*` in `.ai/workflows.config.json`; deferred until a second project actually needs it.
- **`_history/_smoke/`** — new gitignored path under `<designRoot>/_history/`. Add to `.design/.gitignore` (the existing `_history/` pattern already covers it).

## Research source

In-session retro `.ai/logs/system-reviews/phase-3.6.1-canvas-envelope-and-ds-specimens-review.md`:

- Theme 1 ("Build green ≠ user-visible green") — the recurring failure mode this gate addresses.
- Divergence **B1** (no render gate in acceptance criteria) — the documentation-only fix that was already tried and failed.
- Divergence **B2** (canvas-lib lost 800 LOC of viewport) — example of infra change that needed smoke.
- Divergence **B3** (regex bug shipped + 8 specimens corrupted) — example of bulk operation that needed smoke.
- Divergence **G2** (CSS-injection prologue) — example of "Bun.build default behavior didn't work for novel inputs", caught only when user opened specimens.
- Learning #4 ("fastest visual regression catch is the user opening the file") — basis for the "read every screenshot, not sample" rule.

Prior retro `.ai/logs/system-reviews/design-edit-screenshot-habits-review.md` (the studio iter-4 incident) supplies the same lesson at single-canvas granularity — `/design:edit` step 3.5 was the per-canvas fix; `/design:smoke` is its batch counterpart.
