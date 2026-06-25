---
name: flow:debate-protocol
type: skill
description: "Run a bookend debate among stake-seats and hand the human one decision. Use when a flow/design command convenes a divergent (plan/setup-prd/setup-ds), adversarial (validate-security/critic), or research (bug-rca/ux-research) debate. Owns the capability ladder (native agent-team relay vs read-only reduce-pass), the stakes-gate + blind-opening + short-circuit cost model, rotating dissent, retrieval-grounding, and the one-AskUserQuestion invariant. Reads orchestration.* from .ai/workflows.config.json. See DDR-130."
keywords: [debate, bookend, orchestration, agent-teams, reduce, relay, stakes-gate, short-circuit, dissent, diverge, adversarial, research, seats, stake, voice]
---

# Debate Protocol

Teaches the LEAD (the slash-command orchestrator) how to run a bookend debate among **stake-seats** and return **one** framed decision — without ever building a custom messaging/consensus layer. This skill governs the lead; individual seat behavior lives in the agent `.md` bodies (the `skills` frontmatter is NOT applied to teammates, so seats must be self-contained).

## When to Use This Skill

A flow/design command convening a debate at a loop **bookend**:

- **DIVERGENT** (START — "what's BEST", no artifact yet): `/flow:plan`, `/flow:setup-prd`, `/design:setup-ds`.
- **ADVERSARIAL** (END — "is it actually safe/done/good", artifact exists): `/flow:validate-security`, `/design:critic`.
- **RESEARCH** ("what's TRUE", ends when evidence eliminates hypotheses): `/flow:bug-rca`, `ux-research`.

The middle of the loop (`execute`) stays **solo**. `/flow:quick` gets only the escalate-only tripwire (§Stakes-gate). Never auto-fire a debate on a per-iteration loop (`edit --perfect`, `quick`, `utils-verify`).

## Read the config first

Read `orchestration.*` from `.ai/workflows.config.json` (all knobs; never hardcode thresholds):

- `mode` — `auto` (relay-if-capable else reduce) · `reduce` (never a live team) · `off` (today's raw sum-of-verdicts, run nothing here).
- `bookends.{diverge,adversarial,research}.enabled` — per-shape opt-out.
- `maxSeats` (2–4 cap) · `escalationCeiling` (escalation-rate warning threshold) · `designTeam.{enabled,minConflicts}`.

Absent config or `mode:off` → run the command's pre-debate behavior unchanged. A downstream repo with the experimental flag off and no config gets `reduce` automatically — nothing to configure.

## The capability ladder — `reduce` vs `relay`

The ONLY thing a live team adds over today's panel is **stance revision** (a seat changing its mind after hearing another). That draws the load-bearing line:

| Tier | When | What it does |
| --- | --- | --- |
| **`reduce`** (default, every user) | flag off / `mode:reduce` / capability absent | parallel subagents emit blind verdicts → ONE consolidator **reads** them and resolves contradictions into one ordered list |
| **`relay`** (premium, native only) | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` detected AND `mode:auto` | a **native agent team** whose seats message each other so a seat can revise after hearing another |

**The one-line test — REDUCE vs RELAY:**

> Does the step only *read finished verdicts* (REDUCE — allowed in markdown), or does it *route one agent's words into another agent's input and iterate* (RELAY)?

**RELAY is allowed ONLY when the native runtime carries the messages.** NEVER hand-roll it: do not feed seat A's verdict back into seat B as a prompt, collect a rebuttal, and loop — that re-implements SendMessage + the shared task list in markdown, badly, with none of the runtime's guarantees. **The moment a critique becomes another critique's prompt in our own code, you have built the team simulator we refuse to build.** Flag off ⇒ REDUCE only. We ship no `.workflow.mjs` and no messaging engine.

**Capability detection** is a soft probe — spawn the native team by describing it in natural language to the team lead (teams have no deterministic API). If teams are unavailable, fall through to `reduce`. **Never nag** the user to enable the flag, and **never spend premium (team) tokens the user didn't authorize** via the env flag.

## The protocol — 7 steps

1. **Stakes-gate.** Classify the decision: reversibility × blast-radius × effort. Below the floor → solo-decide, no debate (a forced stance on a trivial call is theater). Set team SIZE from blast-radius: 2 seats for reversible calls, up to `maxSeats` for irreversible / high-blast. `/flow:quick`: run ONLY this gate; escalate a 2-seat tripwire (BREAKER) only when the change smells load-bearing (auth / data / migration / shared module / public API).
2. **Retrieval-grounding.** Grep the relevant prior DDRs / retros (and, for `relay`, the artifact / diff) into the shared opening prompt so every seat opens already-grounded. (This is where the "historian" lives — it supplies priors, it is not a debater.)
3. **Blind opening positions.** Each seat states its stance **independently** — separate contexts under `relay`; one batched message of parallel subagents under `reduce`. Each emits `{recommendation, confidence, top_risk, verdict}` (a single binary `verdict` is mandatory — it feeds the merge-test).
4. **Short-circuit.** If openings agree and no `top_risk` contradicts another → **stop**: report "converged, decided," cost ≈ one reduce-pass. Escalate to a full debate ONLY on genuine disagreement. Track the **escalation rate**; if it exceeds `orchestration.escalationCeiling`, warn that openings aren't independent enough.
5. **Cross-challenge** (escalated only). `relay`: the native team; seats revise after hearing each other, with **mandatory rotating dissent** — the non-proposer must steel-man against any consensus (structural, not emotional). `reduce`: the consolidator resolves the fixed verdicts (no revision possible).
6. **Lead synthesis.** The command (NOT a seat) preserves real disagreement and collapses real agreement. **Never introduce a recommendation no seat argued.** Emit the `flow:question-protocol` payload (`source`/`question`/`type`/`options`/`default`/`required`/`context`), recommended option first, options ≤ 4.
7. **One `AskUserQuestion`.** Rendered by the **command**, never by a seat — seats/teammates NEVER prompt the user directly (per `flow:question-protocol`). Auto-mode / `AskUserQuestion` unavailable → pick `default`. On short-circuit, render no question — report "converged" + the decision.

## Cast by stake; personality is the voice

A chair is earned ONLY by an **orthogonal failure-mode** no seated chair owns. **Personality is the delivery vehicle (conviction); the stake is the cargo — no cargo, no seat.** The standing seats (stakes) and their default voices are defined in the agent `.md` files: `flow:builder` (naive-junior), `flow:shipper` (minimalist), `flow:breaker` (regression-risk skeptic; carries the maintenance-horizon / Sisyphus lens), `flow:user-advocate` (customer), `flow:investigator` (skeptic), plus reused `ethical-hacker` (ATTACKER) and `security-auditor` (DEFENDER). Devil's advocate is the **rotating dissent role**, not a chair.

**Falsifiable merge-test** (anti-theater): log each seat's binary `verdict` across runs; if two seats agree >~90% of the time, they are one seat in two hats — **merge them**, regardless of how different their prose reads. A forced dissenter that flips ~100% is also theater (a real seat disagrees *selectively*, where its stake bites).

## Per-use-case rosters

| Use case | Shape | Seats (stake → voice) |
| --- | --- | --- |
| `/flow:plan` | DIVERGENT | BUILDER→naive-junior · SHIPPER→minimalist · BREAKER→grump |
| `/flow:setup-prd` | DIVERGENT | USER-ADVOCATE→customer · SHIPPER→minimalist |
| `/design:setup-ds` | DIVERGENT | USER-ADVOCATE→customer · BUILDER→DS-coherence · signature-moment→aspiration |
| `/flow:validate-security` | ADVERSARIAL | ATTACKER (ethical-hacker) · DEFENDER (security-auditor) |
| `/design:critic` | ADVERSARIAL | design-critic + a11y (if interactive) + 1 routed specialist — `reduce` until `designTeam` gate clears |
| `/flow:bug-rca` | RESEARCH | INVESTIGATOR + 1 hypothesis-holder per live hypothesis (cap 3) |
| `ux-research` | RESEARCH | INVESTIGATOR · USER-ADVOCATE |
| `/flow:quick` | tripwire | BREAKER (escalate-only) |

Structural seats are a fixed repertory company (calibration + cost + legibility) reused across decisions; the orchestrator may hire **one** domain-expert guest per decision. Dissent rotates onto the non-proposer each run.

## Anti-patterns

- ❌ Hand-rolling relay in markdown (routing one seat's words into another's input). Flag off ⇒ `reduce` only.
- ❌ A seat (teammate/subagent) calling `AskUserQuestion`. Only the command prompts, once.
- ❌ The lead inventing a recommendation no seat argued.
- ❌ Auto-firing a debate on `execute` / `quick` / `utils-verify` / a per-iteration loop.
- ❌ Nagging the user to enable the experimental flag, or spending team-tier tokens it didn't authorize.
- ❌ Casting by temperament (grumpy vs optimistic) instead of by stake. The voice rides a stake; it never earns a chair alone.
- ❌ Hardcoding seat counts or thresholds. Read them from `orchestration.*`.
