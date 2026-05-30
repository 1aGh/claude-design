# DDR-066: `/flow:done` offers handoff as a soft prompt, never auto-runs it

**Status:** Accepted
**Date:** 2026-05-30
**Tags:** flow/design/handoff/cross-plugin/ux

## Context

Phase 11 wires flow ⇄ design. One integration (`/flow:done` step 4c) makes `/flow:done` aware of canvases marked `status: ready-for-handoff` and bridges them to `/design:handoff` before a feature closes — so approved designs ship their production-ready registry drop instead of silently drifting from the code.

The open question: when `/flow:done` finds N ready-for-handoff canvases, should it **automatically** run `/design:handoff` on each (hard gate), or **surface them and let the user choose** (soft prompt)? `/flow:done` already hard-gates on `/validate` (tests/build/scenario) and on code-review CRITICAL findings — so a hard handoff gate would be consistent with how the rest of the command treats "must happen before close."

## Alternatives considered

- **Option A — Hard gate (auto-handoff all ready-for-handoff canvases, block close until they succeed).** Pros: zero drift guaranteed; consistent with the validate/code-review gates. Cons: (1) `/design:handoff` is itself an *active decision* — which `handoffTargets[]` entry, which DS, whether to `--force` past an open critic blocker — that flow can't make for the user; (2) burns user context on every close even when the canvas isn't part of *this* feature (a stale `ready-for-handoff` flag from a month ago would force a handoff mid-unrelated-feature); (3) a handoff failure (open critic blocker) would block an otherwise-shippable feature on a design-side issue.
- **Option B — Soft prompt (list ready-for-handoff canvases, offer `[Y] all / [N] skip / [S] subset`, default to letting the user decide).** Pros: preserves the user's agency over the active decision; never blocks a code feature on a design-side blocker; the `[N]` path keeps `/flow:done` fast when handoff isn't wanted now. Cons: a user can skip and let drift accumulate (mitigated — the prompt re-fires every `/done`, and the canvas stays `ready-for-handoff` until acted on).
- **Option C — No integration (status quo).** Pros: simplest. Cons: the exact gap Phase 11 exists to close — user must remember `/design:handoff` manually; canvases drift from production code.

## Decision

We pick **Option B (soft prompt)** because:

- `/design:handoff` requires choices flow has no basis to make (target, DS, force-past-blocker). A prompt asks; an auto-run guesses. Guessing wrong writes a wrong registry drop into the repo.
- The hard gates flow already enforces (validate, code-review CRITICAL) are *correctness* gates — they protect the codebase from broken code. Handoff is a *workflow convenience*, not a correctness invariant; gating close on it conflates the two.
- A skip costs nothing and re-prompts next time. An over-eager auto-handoff costs context now and can wedge a shippable feature behind a design blocker.

## Consequences

**Positive:**

- `/flow:done` stays fast and predictable; the handoff offer only appears when canvases are actually `ready-for-handoff`, and `[N]` dismisses it in one keystroke.
- The user keeps ownership of the target/DS/force decision that `/design:handoff` genuinely needs.
- No feature is ever blocked from closing by a *design-side* blocker.

**Negative / trade-offs:**

- Drift is possible if a user habitually skips. Mitigation: the prompt re-fires every close and the `ready-for-handoff` status persists until handoff actually runs, so the reminder is sticky, not one-shot.
- Two-step bookkeeping: the registry sidecars ride in the feature commit, then a follow-up commit flips `status → handed-off` + stamps `handoffCommit`. Slightly more commit noise than an in-place amend, but it avoids `--amend` (which `/flow:done` forbids) and the SHA-circularity of stamping a commit with its own hash.

## Revisit when

A team reports recurring handoff drift *because* users skip the prompt (i.e. the soft default is too soft in practice) — at which point a per-project `config` opt-in to a hard gate (e.g. `integrations.design.enforceHandoff: true`) would be the escalation, keeping soft as the default.

## Linked

- Plan: .ai/plans/phase-11-flow-design-integration.md (Task 6)
- Implements: `plugins/flow/commands/done.md` step 4c + 5b
- PRD: —
- Supersedes: —
