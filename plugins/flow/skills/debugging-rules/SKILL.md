---
name: debugging-rules
description: Hard-stops for debugging — root-cause first, evidence before fixes, no symptom patches, 4-phase systematic approach, 3-strike architectural review. Reads `boundaries.*` from `.ai/workflows.config.json` to know which seams to instrument. Use on any bug, test failure, /flow:verify failure, scenario blocker, or unexpected behavior, before proposing fixes. Applies during /flow:execute Edit-Verify Loop, /flow:bug-rca, /flow:bug-fix, and incident response.
user-invocable: false
---

# Debugging Rules

Hard-stop rules for systematic debugging. These are non-negotiable.

This skill reads `boundaries` from `.ai/workflows.config.json`. Each entry is a place to instrument before guessing — every system in `boundaries.realtime`, `boundaries.video`, `boundaries.api`, `boundaries.db`, `boundaries.auth`, `boundaries.telemetry`, `boundaries.payments` is a potential failure seam. Skip the skill with `skills.debuggingRules.enabled: false`.

## Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

**Core principle:** Symptom fixes are failure. Random fixes waste time and create new bugs. Quick patches mask underlying issues.

If you haven't completed Phase 1, you cannot propose fixes.

## When to apply

Use for **any** technical issue:

- `/flow:verify` failures during `/flow:execute` Edit-Verify Loop
- `/flow:validate` failures (typecheck, test, build, scenario, a11y, design-system)
- Scenario report blockers or parity gaps across platforms
- Test failures
- Unexpected behavior in dev / preview / prod
- Performance regressions
- Build failures
- Integration issues across declared boundaries (anything in `boundaries.*`)

**Apply ESPECIALLY when:**

- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- Don't fully understand the issue

**Don't skip when:**

- Issue seems simple — simple bugs have root causes too
- You're in a hurry — rushing guarantees rework
- Iteration counter is at 2 of 3 — systematic is faster than thrashing

## Four phases

You **MUST** complete each phase before proceeding to the next.

### Phase 1 — Root cause investigation

Before attempting any fix:

1. **Read error messages carefully.** Don't skip past errors or warnings — they often contain the exact solution. Read stack traces completely. Note line numbers, file paths, error codes.

2. **Reproduce consistently.** Can you trigger it reliably? Exact steps? Every time? If not reproducible — gather more data, don't guess.

3. **Check recent changes.** `git diff`, recent commits, new dependencies, config changes, env differences. `.ai/state/STATE.md` `Updated` line is a useful timestamp.

4. **Gather evidence at every boundary.** Read `boundaries.*` from the project config. Each declared system is a potential failure seam:

   ```
   For EACH declared boundary:
     - Log what data enters this component
     - Log what data exits this component
     - Verify environment / config / secrets propagation
     - Check state at each layer (request context, RLS, JWT claims, env vars)

   Run once to gather evidence showing WHERE it breaks.
   THEN analyze evidence to identify the failing component.
   THEN investigate that specific component.
   ```

   Cross-platform projects: also check for build/runtime delta between platforms (web bundle vs native build, dev vs prod, EAS channel, deploy preview vs main).

5. **Trace data flow.** When the error is deep in the call stack: where does the bad value originate? What called this with the bad value? Keep tracing up until you find the source. Fix at source, not at symptom.

### Phase 2 — Pattern analysis

Find the pattern before fixing:

1. **Find working examples.** Locate similar working code in the same codebase. What works that's similar to what's broken?
2. **Compare against references.** If implementing a pattern (auth provider, ORM migration, RPC procedure), read the reference completely — don't skim. Understand fully before applying.
3. **Identify differences.** What's different between working and broken? List every difference, however small. Don't assume "that can't matter."
4. **Understand dependencies.** What other components does this need? Settings, config, environment, RLS context, JWT claims, env vars, feature flags?

### Phase 3 — Hypothesis and testing

Scientific method:

1. **Form single hypothesis.** State clearly: "I think X is the root cause because Y." Write it down. Be specific.
2. **Test minimally.** Smallest possible change to test hypothesis. One variable at a time. Don't fix multiple things at once.
3. **Verify before continuing.** Worked? → Phase 4. Didn't work? Form a **new** hypothesis. Don't add more fixes on top.
4. **When you don't know.** Say "I don't understand X." Don't pretend. Ask the user. Research more.

### Phase 4 — Implementation

Fix the root cause, not the symptom:

1. **Create failing test case.** Simplest possible reproduction. Automated test if framework available; one-off script if not. **MUST exist before fixing.** This is the TDD bridge — see `testing-rules` § Iron Law.

2. **Implement single fix.** Address the root cause. ONE change at a time. No "while I'm here" improvements. No bundled refactoring.

3. **Verify fix.** Test passes? Other tests still pass? Issue actually resolved?

4. **If fix doesn't work — STOP.** Count fixes attempted:
   - **< 3:** Return to Phase 1, re-analyze with new information.
   - **≥ 3:** STOP and question architecture (step 5).
   - Don't attempt fix #4 without architectural discussion.

5. **If 3+ fixes failed — question architecture.**

   Pattern indicating architectural problem:
   - Each fix reveals new shared state / coupling / problem in a different place
   - Fixes require "massive refactoring" to implement
   - Each fix creates new symptoms elsewhere

   STOP and question fundamentals:
   - Is this pattern fundamentally sound?
   - Are we sticking with it through inertia?
   - Should we refactor architecture vs. continue fixing symptoms?
   - **Discuss with user before attempting more fixes.**
   - This is a candidate for a DDR (rebuild-vs-refactor decision).

   This is **not** a failed hypothesis — this is a wrong architecture.

## Integration with the workflow

| Trigger | Action |
|---|---|
| `/flow:verify` fails during `/flow:execute` | Apply Phase 1 before the iteration counter increments. Symptom fixes burn iterations. |
| `/flow:validate` blocker (scenario, a11y, design) | Phase 1 evidence gathering before fix attempt. Cross-platform divergence often points to a config / build / env delta. |
| GitHub issue triage | `/flow:bug-rca` produces an RCA document = Phase 1 + 2 output. `/flow:bug-fix` continues with Phase 4 (failing test → minimal fix). |
| 3+ failed fix attempts | Stop, write a DDR proposing an architectural change. Don't attempt fix #4. |

## Red flags — STOP and follow process

If you catch yourself thinking:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- **"One more fix attempt"** (when already tried 2+)
- **Each fix reveals a new problem in a different place**

**All of these mean: STOP. Return to Phase 1.**

If 3+ fixes failed → question architecture (Phase 4 step 5).

## User signals you're doing it wrong

Watch for these redirections (any language):

- "Is that not happening?" — You assumed without verifying
- "Will it show us…?" — You should have added evidence gathering
- "Stop guessing" — You're proposing fixes without understanding
- "Ultrathink this" / "think harder" — Question fundamentals, not just symptoms
- "We're stuck" / "are we in a loop?" (frustrated) — Your approach isn't working

When you see these: **STOP. Return to Phase 1.**

## Common rationalizations

| Excuse | Reality |
|---|---|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic is **faster** than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem. Question pattern. |

## When investigation reveals "no root cause"

If systematic investigation reveals the issue is truly environmental, timing-dependent, or external (cold start, deploy lag, third-party API outage):

1. You've completed the process — document what you investigated.
2. Implement appropriate handling: retry, timeout, circuit breaker, error boundary.
3. Add monitoring (metric / event / alert) for future investigation.
4. Consider a DDR if the handling is non-trivial.

But: **95% of "no root cause" cases are incomplete investigation.**

## Quick reference

| Phase | Activities | Success criteria |
|---|---|---|
| 1. Root cause | Read errors, reproduce, check changes, gather evidence at boundaries, trace data flow | Understand WHAT and WHY |
| 2. Pattern | Find working examples, compare against references | Identify all differences |
| 3. Hypothesis | Form single theory, test minimally | Confirmed or new hypothesis |
| 4. Implementation | Failing test, single fix, verify | Bug resolved, tests pass |

## Real-world impact

From debugging sessions across many projects:

- Systematic approach: 15–30 minutes to fix
- Random fixes approach: 2–3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: near zero vs common

## Related

- `testing-rules` — TDD iron law (failing test before fix in Phase 4 step 1)
- `/flow:bug-rca` — formal RCA flow for GitHub issues (Phase 1 + 2 codified)
- `/flow:bug-fix` — implementation of the RCA-identified fix (Phase 4)
- `/flow:verify`, `/flow:validate` — gates that surface bugs early
