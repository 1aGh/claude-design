# Feature: Multi-agent debate layer — bookend debate teams (flow + design)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is plugin-internals work (markdown commands/agents/skills + JSON schema) — NOT a UI feature.** No DS/canvas/a11y/scenario gates apply; validation is the plugin-spec ladder (reachability · parity · `bash -n` · schema validity · fence parity), mirroring the showcase-grounded-canvas-generation plan (archived 2026-06-22).

> **Design provenance.** The methodology below is the converged output of a three-round, four-perspective design debate (architecture · devil's-advocate · Claude-Code-feature · daily-user) plus a second four-perspective panel on team composition (casting · right-sizing · personality-skeptic · outcome-owner). Where this plan asserts a rule (e.g. "cast by stake, not temperament"; "reduce vs relay"; "auto at the bookends"), it is the settled result of that debate, not a fresh opinion. The DDR (Task 1) records the reasoning so it survives.

## Description

Add an **opt-in, capability-gated, auto-at-the-bookends** multi-agent **debate** layer to the flow and design plugins, built on **native Claude Code agent teams** with **no custom orchestration/messaging layer**. It mirrors how a real team produces a decision — several people with *different stakes* argue, the strongest objection survives, and one informed choice reaches the human.

The layer concentrates debate at the **bookends** of the dev/design loop — `brainstorm → plan → execute → validate → done` — because that is exactly where multi-perspective argument pays in the human world: divergent debate at the **start** (what should we build / how) and adversarial debate at the **end** (is this actually safe / done / good). The **middle (`execute`) stays solo.** A third shape, **research**, covers hypothesis work (`/flow:bug-rca`, `ux-research`).

**This plan delivers the eval-gated pilot** + the shared scaffolding the whole layer needs: the always-available **reduce-pass floor** (every user, no experimental flag), the `orchestration.*` config, the **net-new cast** (stake-seats), the **shared debate mechanism** (stakes-gate → blind opening → short-circuit → synthesis, with rotating dissent + retrieval-grounding), and the **first proving ground** — the `/flow:validate-security` adversarial debate — plus the **n=8 security eval** that is the explicit **go/no-go gate** for turning live debate on more broadly. Rolling `mode:auto` on for the remaining bookends is enumerated under **Follow-up phases** and gated on the eval clearing.

## User Story

As a developer (or designer) working a feature through the flow/design loop, I want the **start** and **end** of the loop to convene a small team of agents with genuinely different stakes that argue out the real fork and hand me one well-framed decision (or silently agree and move on) — so that plans are production-grade in one pass and validations catch what a single agreeable reviewer misses — while routine work and the `execute` middle stay fast and solo, and while I (a downstream user who never enabled the experimental teams flag) still get a strictly better multi-perspective pass than today with **zero setup**.

## Problem

`/flow:plan`, `/flow:validate-security`, `/flow:bug-rca`, `/design:critic` today are **single-pass or parallel-panel with zero cross-talk**: critics emit independent verdicts and an orchestrator *sums* them. Maude's 21 agents are almost entirely **critics** — convergent, "absence-of-badness." There is no **divergent** capability (propose competing directions), no **adversarial** capability (a seat whose win-condition is the artifact *failing*), and no **research** capability (compete hypotheses, end on evidence). The exact places this hurts are the loop's bookends. And because critics never *revise a stance after hearing another*, the system can only do set-arithmetic over fixed verdicts — it cannot surface the *conditional* form of a constraint (e.g. "the contrast floor only binds on the text band, so the bold hero can stay").

## Solution

Introduce **bookend debate** as an **additive, primitive-agnostic, capability-gated** layer with a strict **two-tier capability ladder**, auto-engaged at the bookends:

- **DEFAULT tier — `reduce` (every user, flag-off, cheap):** today's parallel panel **+ a reduce-pass** — one consolidator subagent that **reads** the N independent verdicts and **resolves contradictions into one ordered list**. It is read-only over the critics' *outputs*: it never invents a critique, never speaks as a persona, **never routes one agent's words into another agent's input**. This is just good orchestration and ships immediately to everyone with nothing to configure.
- **DEBATE tier — `relay` (native agent teams, flag-on, premium):** when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled, the bookend convenes a **native agent team** whose unique value is **stance revision** — a seat changing its position after hearing another's argument (the one thing `reduce` structurally cannot do). The runtime carries the messages; **we never hand-roll a SendMessage/consensus loop in plugin markdown.**
- **`orchestration.mode: auto`** auto-attempts a bookend debate, **capability-detected**: flag-on → `relay` team; flag-off → `reduce` panel; never nags, never force-enables the flag, **never spends premium tokens the user did not authorize via the env flag.**

Two gates in series keep "always auto" from becoming "always expensive":
1. **Stakes-gate (pre-debate):** is this decision worth contesting? (reversibility × blast-radius × effort). Low-stakes → solo-decide, no debate. The team SIZE scales with cost-of-being-wrong, not topic glamour.
2. **Short-circuit (post-blind-opening):** seats write opening positions **blind** (independent contexts); escalate to a full live debate **only when openings genuinely disagree**. Agreement → collapse to "converged, decided," cost ≈ one reduce-pass.

The decision the team produces is rendered by the **command (lead)**, never inside the team — one batched `AskUserQuestion` per `flow:question-protocol` (the recommended option first), or a "converged — here's the decision, no choice needed" report on short-circuit. Auto-mode fallback picks the recommended option.

## Metadata

- **Type**: New Capability
- **Complexity**: High (cross-cutting: config schema + a shared debate-mechanism skill + 4–5 new agents + command wiring on the security bookend + an eval harness + a DDR; new orchestration concept built on an experimental native feature)
- **App/Package**: `plugins/flow` + `plugins/design` (Maude self-dogfood — flow/design running on their own repo)
- **Affected Systems**: flow config schema, flow + design agents, `/flow:validate-security` (pilot consumer), `/design:critic` consolidation (reduce-pass), `flow:question-protocol` usage, CLAUDE.md flow docs
- **Dependencies**: Native **agent teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, experimental, off-by-default, **cannot be force-enabled by a plugin**) for the `relay` tier — **soft** dependency, capability-probed, with the `reduce` tier as the always-available floor. No new npm/runtime deps. No custom workflow runtime.

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message.**

- `plugins/flow/.claude-plugin/config.schema.json` (whole file) — Why: add the `orchestration` top-level block. The `security` block (verified at lines 236–259) is the mirror pattern (nested object, `additionalProperties:false`, `enabled`/enum defaults, every key documented). Root is `additionalProperties:false` with `required:["name"]` — add to `properties`, **never** to `required`.
- `plugins/flow/agents/test-coverage.md` (whole file) — Why: the canonical agent-file shape to mirror (frontmatter `name`/`description`/`tools` only; body = role + hard rules + scope + fenced structured Report block).
- `plugins/flow/agents/ethical-hacker.md` + `plugins/flow/agents/security-auditor.md` (whole files) — Why: these ARE the ATTACKER + DEFENDER seats (reused, not re-created). They already read `security.severityFloor`/`scope` from config and carry the adversarial pairing the pilot promotes to a 2-seat debate. The new agents mirror their tool sets and config-reading discipline.
- `plugins/flow/commands/validate-security.md` (whole file) — Why: the **pilot consumer**. The 2-seat debate slots into its existing `security-auditor` + `ethical-hacker` fan-out; everything downstream is untouched.
- `plugins/flow/skills/question-protocol/SKILL.md` (whole file) — Why: the structured-question shape (`source`/`question`/`type`/`options`/`default`/`required`/`context`) the lead renders as the single `AskUserQuestion`. Subagents/teammates NEVER call `AskUserQuestion` — the command does.
- `plugins/design/commands/critic.md` (whole file) — Why: the existing parallel-critic panel + `PANEL.md` consolidation is where the **reduce-pass** lands first (immediate value, flag-off). Confirms today's "sum-of-verdicts" gap the reduce-pass closes.
- `plugins/flow/hooks/hooks.json` — Why: confirms only `SessionStart` is wired today; the `TeammateIdle`/`TaskCreated`/`TaskCompleted` team hooks are a **follow-up** (quality-gate enforcement), NOT this plan — do not touch hooks.json here.
- **Native docs (authoritative for the `relay` tier):** `https://code.claude.com/docs/en/agent-teams` and `https://code.claude.com/docs/en/agents`. Key facts encoded in this plan: teams are experimental + off-by-default + lead-spawned via natural language (no deterministic API); teammates message each other + share a task list; **teammate roles reuse subagent `.md` defs incl. plugin scope** (`tools`+`model` honored, body appended) but **`skills`/`mcpServers` frontmatter are NOT applied to a teammate** (it loads skills/MCP from project+user settings); 3–5 teammates ideal; no nested teams; lead fixed; token cost scales linearly; docs name "research and review" + "scientific debate … disprove each other's theories … consensus" as the #1 use case.
- `CLAUDE.md` → "Plugin command naming" + "Flow plugin: `<project>` placeholder convention" + "Published npm surface" — Why: naming rules for the new agents; the project-agnostic constraint (no Maude-specific values baked into flow); `plugins/flow/**` ships via the **marketplace clone, not npm** (the new agents/skill need NO `package.json` `files` entry).
- `.ai/archive/decisions/DDR-004-flow-command-naming-prefix-convention.md` + `DDR-006-plugin-namespace-in-name-frontmatter.md` — Why: agents declare `name: flow:<slug>`; the group-`<verb>` filename rule is for **commands**, not agents (existing agents use bare slugs: `test-coverage`, `security-auditor`).

### Files to Create

- `plugins/flow/agents/builder.md` — divergent stake: **"the most ambitious viable approach."** Default voice: *naive junior* (cracks the premise — "why is this even true?"). Optimizes architecture/ambition. Counters premature convergence.
- `plugins/flow/agents/shipper.md` — divergent stake: **"what survives scope, effort, and the existing system."** Default voice: *minimalist* (scope-cut). Counters gold-plating, reinvention, plans that don't fit the repo.
- `plugins/flow/agents/breaker.md` — divergent/dissent stake: **"what breaks — across the maintenance horizon, not just at merge"** (absorbs the Sisyphus/TCO lens). Default voice: *grump / regression-risk skeptic*. Counters groupthink + deferred breakage. Also the default occupant of the **rotating dissent** role.
- `plugins/flow/agents/user-advocate.md` — stake: **"who lives with this — who is served, confused, or excluded."** Default voice: *customer*. (Distinct from the internal-legibility "naive junior" seat — this is the end-user's experience of the running product.)
- `plugins/flow/agents/investigator.md` — research stake: **"my candidate cause/claim is X — here is the evidence that confirms OR kills it."** Default voice: *skeptic*. Terminates the research debate when evidence **eliminates hypotheses**, not when voices agree.
- `plugins/flow/skills/debate-protocol/SKILL.md` — the **shared mechanism**: stakes-gate → retrieval-grounding (inject relevant DDRs/retros into the opening prompt) → **blind** opening positions → short-circuit → cross-challenge (with mandatory rotating dissent) → lead synthesis → one `AskUserQuestion`. Plus the **capability ladder** (detect flag → `relay` native team vs `reduce` panel) and the **reduce-vs-relay line** (read finished verdicts = allowed; route one agent's words into another's input = forbidden in markdown, only the runtime may relay).
- `.ai/archive/decisions/DDR-130-bookend-debate-layer.md` — the decision record (number = highest in `.ai/archive/decisions/` + 1; latest is **DDR-129** → expect **DDR-130**; verify before creating).

### Patterns to Follow

- **Agent frontmatter** (from `test-coverage.md:1-5`): exactly `name`, `description`, `tools`. Nothing else. Body opens with a one-line stake statement, then `## Hard rules` / `## Scope` / `## Report` with a fenced JSON verdict block.
- **Non-proactive descriptions** — these agents must NOT be auto-delegated by unrelated tasks. Write each `description` to say it is invoked **only** by the debate-protocol skill / bookend orchestrator (avoid "use proactively" / "MUST BE USED" phrases). Contrast `test-coverage.md`, which is intentionally proactive.
- **Structured JSON tail + binary verdict** — every seat ends its report with a fenced JSON verdict the lead parses, and **a single binary `verdict` field** (e.g. `approve|revise|block`) so the merge-test (below) is computable. Mirrors how the design critics emit a final `{...}` verdict the auto-fix loop reads.
- **Cast by stake, voice for conviction** — each agent file's BODY carries the durable, decision-agnostic half: the **stake** (the orthogonal failure it alone catches) + its **default voice** (a named persona handle that elicits a committed, less-hedged stance). The **spawn prompt** carries the volatile half: the specific decision, the shared (DDR-grounded) context, the round, and (in cross-challenge) the other openings. Same split the critics already use (body = framework, prompt = `canvas_path`/`feedback`/`iter_n`).
- **Reuse as teammate roles** — per the agent-teams docs, these `.md` files work BOTH as report-back subagents (`reduce` tier) AND as live teammates (`relay` tier) unchanged. Keep them self-contained: do NOT lean on `skills`/`mcpServers` frontmatter (ignored for teammates) — read what you need via `tools`.
- **Project-agnostic (flow)** — flow runs on arbitrary repos. The stakes, voices, gate thresholds, and `orchestration.*` defaults carry NO Maude-specifics. Design's debate MAY be Maude-flavored (it ships Maude's DS critics); that asymmetry is intended.
- **Config block** (mirror `security`, lines 236–259): nested object, `additionalProperties:false`, documented keys, opt-in defaults.

---

## Design / Architecture Decisions

### The bookend model (where debate fires)

| Loop stage | Shape | Fires? | Why |
| --- | --- | --- | --- |
| brainstorm / plan (`/flow:plan`, `/flow:setup-prd`, `/design:setup-ds`) | **DIVERGENT** ("what's BEST", no artifact yet) | auto | fails by premature convergence — needs seats that pull the option space apart |
| execute (`/flow:execute`, `/flow:quick`) | — | **SOLO** (by rule) | the middle carries out a decision already made; no fork |
| validate / done (`/flow:validate-security`, `/design:critic`) | **ADVERSARIAL** ("is it actually safe/done/good", artifact exists) | auto | fails by motivated blindness — needs a seat whose win-condition is the artifact failing |
| research (`/flow:bug-rca`, `ux-research`) | **RESEARCH** ("what's TRUE") | auto | fails by confirmation — ends when evidence eliminates hypotheses, not when voices agree |
| `/flow:quick` | tripwire | escalate-only | the dangerous change is the one that *looks* trivial; a cheap stakes-gate escalates a 2-seat tripwire only when it smells load-bearing (auth/data/migration/shared module/public API) |

### The two-tier capability ladder (reduce vs relay)

The **only** thing a live team adds over today's panel is **stance revision**. That insight draws the load-bearing line:

- **`reduce` (default, everyone):** a consolidator **reads** the N finished verdict JSONs and dedupes/ranks/resolves contradictions into one ordered list. Read-only over outputs. **Never** invents a critique, speaks as a persona, or feeds one agent's words into another's input.
- **`relay` (flag-on, premium, native only):** the experimental runtime carries messages between teammates so a seat can revise after hearing another. **One-line test:** does the step only *read finished verdicts* (`reduce`, allowed) or *route one agent's words into another agent's input and iterate* (`relay` — allowed ONLY when the native runtime does it, NEVER hand-rolled in markdown)? **The moment a critique becomes another critique's prompt in our own code, we have built the team simulator we refuse to build.**

"Always auto" lives on **both** sides of this line: flag-off → auto `reduce`; flag-on → auto `relay`. Same posture, different mechanism. The plugin never force-enables the flag and never spends premium tokens the user didn't authorize.

### The cast (seats = stakes; personality = voice)

**Governing rule:** *cast by stake to size the room; fill each chair with a named voice for conviction; a voice never earns a chair on its own — only an orthogonal failure-mode does.* **Falsifiable merge-test:** log each seat's binary verdict across N runs; if two seats agree on the verdict >~90% of the time, they are one seat in two hats — **merge them**, regardless of how different their prose reads. A forced dissenter that flips to disagree ~100% is also a red flag (theater).

**Standing seats (stakes):**

| Seat | Failure it alone catches | Default voice | Status |
| --- | --- | --- | --- |
| `flow:builder` | premature convergence / unambitious | naive junior | net-new |
| `flow:shipper` | hidden cost / won't ship cheap | minimalist | net-new |
| `flow:breaker` | breaks (incl. maintenance horizon — absorbs Sisyphus) | grump / regression-risk skeptic | net-new (also default rotating-dissent occupant) |
| `flow:user-advocate` | wrong thing / who's excluded | customer | net-new |
| `flow:investigator` | not true / unverified by evidence | skeptic | net-new |
| ATTACKER = `ethical-hacker` | exploitable by design | zealot | **reuse** |
| DEFENDER = `security-auditor` | control won't hold | grump | **reuse** |
| design critic panel + `signature-moment-critic` | mediocre / WCAG / token-discipline | — | **reuse** |

**Dispositions of the brainstormed archetypes** (recorded so they don't get re-proposed): naive junior → BUILDER voice / conditional internal-legibility seat in build+design contexts only · grump/morous → BREAKER+DEFENDER voice ("regression-risk skeptic", auditable, not a mood) · devil's advocate → **mandatory ROTATING dissent role on the non-proposer**, not a chair · **Sisyphus → BREAKER maintenance-horizon lens** (no decision found where TCO flips a call BREAKER+SHIPPER jointly miss) · **historian → RETRIEVAL STEP** (grep relevant DDRs/retros into the opening prompt; it supplies priors all seats reason from, it never contradicts a verdict — not a debater) · customer → USER-ADVOCATE voice · zealot/minimalist → voices (DEFENDER/BUILDER purist; SHIPPER scope-cut), not chairs. **Net-new standing seats: 5.** Everything else is a voice, the rotating role, a retrieval step, or a reuse.

### Per-use-case roster (the shippable composition)

| Use case | Shape | Seats (stake → voice) | Guest-expert slot |
| --- | --- | --- | --- |
| `/flow:plan` | START | BUILDER→naive-junior · SHIPPER→minimalist · BREAKER→grump | +domain expert if novel subsystem |
| `/flow:setup-prd` | START | USER-ADVOCATE→customer · SHIPPER→minimalist | +customer-segment expert |
| `/design:setup-ds` | START | USER-ADVOCATE→customer · BUILDER→DS-coherence · signature-moment→aspiration | +domain-aesthetic expert |
| `/flow:validate-security` | END | ATTACKER (ethical-hacker)→zealot · DEFENDER (security-auditor)→grump | +threat-domain (auth/crypto) |
| `/design:critic` | END | design-critic always; +a11y if interactive; +1 specialist routed by canvas | router IS the guest |
| `/flow:bug-rca` | RESEARCH | INVESTIGATOR→skeptic + 1 hypothesis-holder per live hypothesis (cap 3) | +subsystem expert |
| `ux-research` | RESEARCH | INVESTIGATOR→skeptic · USER-ADVOCATE→customer | +domain researcher |
| `/flow:quick` | tripwire | BREAKER→grump (escalate-only) | — |

**Repertory + one guest:** the structural seats are a fixed, reused company (calibration + cost + legibility); the orchestrator hires **one** domain-expert guest per decision. Dissent rotates onto the non-proposer each run. `execute` = solo.

### The mechanism (shared across all bookends — the `debate-protocol` skill)

1. **Stakes-gate** — classify reversibility × blast-radius × effort. Below floor → solo-decide, no debate. Sets team size (2 reversible → 4 irreversible/high-blast, cap from the docs' 3–5 ideal).
2. **Retrieval-grounding** — grep the relevant DDRs/retros (and, for `relay`, the artifact/diff) into the shared opening prompt so every seat opens already-grounded (this is where "historian" lives).
3. **Blind opening positions** — each seat writes its stance independently (separate contexts under `relay`; one message-batch of parallel subagents under `reduce`). Each emits `{recommendation, confidence, top_risk, verdict}`.
4. **Short-circuit** — if openings agree and no `top_risk` contradicts another, **stop**: report "converged, decided," cost ≈ one reduce-pass. Escalate to full debate ONLY on genuine disagreement. **The escalation rate must be observable** — if >~50% of bookend runs escalate, the openings aren't independent enough; re-tune.
5. **Cross-challenge** (escalated only) — `relay`: native team, seats revise after hearing each other, with **mandatory dissent** (the non-proposer must steel-man against any consensus). `reduce`: the consolidator resolves the fixed verdicts (no revision).
6. **Lead synthesis** — the command (not a seat) preserves real disagreement and collapses real agreement; **never introduces a recommendation no seat argued**. Emits the `question-protocol` payload.
7. **One `AskUserQuestion`** — rendered by the command (recommended option first); auto-mode → recommended. The team/debate NEVER prompts the user directly.

### "Always auto", honestly (and project-agnostic)

`orchestration.mode` defaults to `auto`. `auto` = fire the bookend's shape iff (capability detected for `relay`, else `reduce`) AND (stakes-gate clears) AND (short-circuit found a fork). **For ~every downstream user the experimental flag is off, so `auto` means exactly today's behavior plus the cheap reduce-pass — nothing to configure, no nag, no premium spend.** `default:true` is therefore honest. Flow seats are domain-free; design seats may be Maude-flavored.

### Eval-first governance (why the rollout is gated)

Live debate is built on an experimental feature and costs linear tokens, so we prove it before turning it on broadly. **The pilot ships the `reduce` floor to everyone immediately** (pure win, no flag), then **proves `relay` on the one bookend with crisp ground truth — security** via an n=8 eval (Task 8). Only if debate measurably beats the panel there do we flip `mode:auto` on for the other bookends (Follow-up). `/design:critic` as a live team is itself gated on a separate measured condition (≥30% conflict-oscillation in the instrumented `/design:edit --perfect` loop AND a reduce-pass demonstrably failing to break it) — until then it is a reduce-pass feature, not a team.

### Why native-only, no custom layer

Agent teams are the blessed native primitive for exactly this ("scientific debate … disprove each other's theories"). A hand-rolled flag-off relay (feeding A's verdict into B as a prompt) would re-implement SendMessage + the shared task list in markdown, badly, with none of the runtime's guarantees — and violate the user's explicit "no custom layer unless strictly necessary." Flag-off ⇒ `reduce` only. The `relay` tier is 100% native teams. We ship **no** `.workflow.mjs` and **no** messaging engine.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE DDR — bookend debate layer

- **Do**: Author `.ai/archive/decisions/DDR-130-bookend-debate-layer.md`. Capture: the bookend model (diverge-start / adversarial-end / research / execute-solo); the **reduce-vs-relay** line and the one-line test; the **two-tier capability ladder** (`auto` on both sides of the flag; plugin can't force the experimental flag; never spend unauthorized premium tokens); **cast by stake, voice for conviction** + the >90%-verdict-agreement merge-test; the archetype dispositions (Sisyphus→BREAKER lens, historian→retrieval step, devil's-advocate→rotating role); the **stakes-gate + short-circuit** two-gate cost model; **eval-first** governance (security n=8 go/no-go; design `/design:critic` gated on measured oscillation); **native-only / no custom layer**. Cross-link the showcase-grounded plan as the "markdown plugin-spec, no code gates" validation precedent.
- **Pattern**: Existing DDRs in `.ai/archive/decisions/` (e.g. DDR-127 showcase-grounded, DDR-061 orchestration-speed).
- **Gotcha**: DDR number = `ls .ai/archive/decisions/ | grep -oE 'DDR-[0-9]+' | sort -V | tail -1` + 1 (latest is **DDR-129**). Verify before writing.
- **Validate**: File exists; `grep -o 'DDR-[0-9]*' the-new-file` → each referenced DDR file exists.

### Task 2: ADD `orchestration` block to flow config schema

- **Do**: In `plugins/flow/.claude-plugin/config.schema.json`, add a top-level `orchestration` property (object, `additionalProperties:false`):
  - `mode`: enum `["auto","reduce","off"]`, default `"auto"` (`auto` = `relay` if the experimental teams flag is detected else `reduce`; `reduce` = always panel+reduce, never a live team; `off` = today's raw single-pass / sum-of-verdicts).
  - `bookends`: object with `diverge` / `adversarial` / `research`, each `{ enabled (bool, default true) }` — per-shape opt-out.
  - `maxSeats`: int 2–4, default 4 (hard cap; stakes-gate picks where in 2–4 to land).
  - `escalationCeiling`: number 0–1, default 0.5 (observability knob: if the measured short-circuit escalation rate exceeds this, the protocol warns that openings aren't independent enough).
  - `designTeam`: `{ enabled (bool, default false), minConflicts (int, default 2) }` — `/design:critic` live-team tier, **off until its measured gate clears** (note this in the `description`).
  - Parent `description`: "Opt-in, capability-gated bookend debate (diverge→adversarial→research). Additive: with the experimental agent-teams flag off (the default for ~all users), `auto`/`reduce` degrade to today's parallel panel + a read-only reduce-pass — nothing to configure, no premium spend. No hard dependency on experimental Claude Code features."
- **Pattern**: The `security` block (lines 236–259).
- **Gotcha**: Root is `additionalProperties:false`, `required:["name"]` — add to `properties`, NOT `required`. Inner sub-objects ALSO need `additionalProperties:false`. No Maude-specific defaults.
- **Validate**: `jq . plugins/flow/.claude-plugin/config.schema.json >/dev/null`; `node -e "const Ajv=require('ajv/dist/2020').default; new Ajv({strict:false}).compile(require('./plugins/flow/.claude-plugin/config.schema.json')); console.log('schema compiles')"`.

### Task 3: CREATE the `flow:debate-protocol` skill (the shared mechanism)

- **Do**: `plugins/flow/skills/debate-protocol/SKILL.md`. Frontmatter per the flow skill convention (`name: flow:debate-protocol`, description, etc.). Body specifies the 7-step mechanism (stakes-gate → retrieval-grounding → blind opening → short-circuit → cross-challenge → lead synthesis → one `AskUserQuestion`), the **capability ladder** (detect `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` → spawn a native team in natural language for `relay`, else run parallel subagents + reduce-pass for `reduce`), the **reduce-vs-relay one-line test** + the explicit prohibition on hand-rolled relay in markdown, the **rotating-dissent** rule, the **merge-test** (>90% verdict agreement → seats are one), and the **post-debate `AskUserQuestion` invariant** (the team never prompts; the command renders one batched decision). Generic — no Maude-specifics; reads `orchestration.*` from config.
- **Pattern**: `plugins/flow/skills/question-protocol/SKILL.md` (the sibling protocol skill) for shape + the `<project>`/config-read convention.
- **Gotcha**: This skill is the single source of truth for the mechanism — bookend commands LOAD it, they don't re-spell it. It must read every knob from `orchestration.*` (never hardcode thresholds). Per the agent-teams docs, `skills` frontmatter is NOT applied to teammates — so this skill governs the LEAD/orchestrator, and seat behavior lives in the agent `.md` bodies (Task 4), not here.
- **Validate**: `grep -q '^name: flow:debate-protocol'`; fence parity even; the reduce-vs-relay test + the rotating-dissent rule + the `AskUserQuestion`-in-command invariant are all present.

### Task 4: CREATE the 5 net-new cast agents

- **Do**: Create `plugins/flow/agents/{builder,shipper,breaker,user-advocate,investigator}.md`. Each: frontmatter `name: flow:<slug>`, read-only `tools` (`Read, Grep, Glob, Bash`; INVESTIGATOR adds `WebSearch, WebFetch` like `ethical-hacker`), **non-proactive** `description` naming the debate-protocol/bookend as the only caller. Body = one-line **stake** + **default voice** + `## Hard rules` (blind opening; emit `{recommendation, confidence, top_risk, verdict}`; never call `AskUserQuestion`; BREAKER additionally scores the maintenance horizon — the absorbed Sisyphus lens) + `## Scope` + `## Report` fenced JSON. Use the stake/voice table in Design above verbatim.
- **Pattern**: `test-coverage.md` shape; `ethical-hacker.md` tool set for INVESTIGATOR; read-only like the critics.
- **Gotcha**: The voice is a prompt-handle for conviction, NOT a temperament that changes the verdict logic — keep the stake auditable (e.g. BREAKER's body says "regression-risk skeptic," not "be grumpy"). Description must carry no proactive trigger phrase. Keep self-contained (no `skills`/`mcpServers` reliance — ignored when run as a teammate). Single binary `verdict` field is mandatory (feeds the merge-test).
- **Validate**: `grep -l '^name: flow:' plugins/flow/agents/{builder,shipper,breaker,user-advocate,investigator}.md` → 5 hits; none has `model:`/`skills:`/`mcpServers:`; each has a fenced JSON tail with a `verdict` key.

### Task 5: SHIP the `reduce`-pass floor into `/design:critic` consolidation

- **Do**: Wire the reduce-pass into the existing `/design:critic` panel consolidation (the `PANEL.md` step in `plugins/design/commands/critic.md`): after the N critics emit verdicts, run **one** consolidator pass (subagent or inline) that READS all verdict JSONs and emits a single reconciled, de-duplicated, conflict-resolved ordered blocker list — replacing today's raw "sum of blockers." This is the always-available DEFAULT tier; it ships to everyone with the experimental flag off and changes the design-edit loop from "serial blocker-chasing" to "one coherent list." Read-only over outputs (the reduce-vs-relay line); it must NOT route one critic's words into another critic's input.
- **Pattern**: The existing `critic.md` consolidation/`PANEL.md` merge; the reduce-vs-relay rule in the `debate-protocol` skill.
- **Gotcha**: This is the one task that delivers value with NO dependency on agent teams — keep it strictly `reduce` (no live cross-talk, no stance revision). Do not gate it on the eval; it's a pure win.
- **Validate**: `bash -n` on any shell added; a dry read confirms the consolidator only reads finished verdicts; fence parity in `critic.md` preserved.

### Task 6: WIRE the `/flow:validate-security` adversarial bookend (the proving ground)

- **Do**: Edit `plugins/flow/commands/validate-security.md` to convene the 2-seat ADVERSARIAL debate via the `debate-protocol` skill: ATTACKER (`ethical-hacker`) proposes the chained exploit → DEFENDER (`security-auditor`) rebuts with the mitigating control → ATTACKER rebuts whether the chain survives the control. Capability ladder applies: flag-on → native 2-seat team (stance revision: does the chain survive?); flag-off → today's parallel pair + reduce-pass. Stakes-gate + short-circuit honored. One `AskUserQuestion`/report rendered by the command; `security.severityFloor`/`scope` still read as today. Default path (mode `off` / no capability) = today's behavior, byte-for-byte.
- **Pattern**: `validate-security.md`'s existing `security-auditor` + `ethical-hacker` fan-out; the `debate-protocol` skill (Task 3).
- **Gotcha**: This is the FIRST and (this plan) ONLY live-debate consumer — it's the eval's subject. Do NOT wire the other bookends here (Follow-up, gated on Task 8). The 2-seat cap is deliberate (a precision duel, not an ensemble).
- **Validate**: `bash -n` on shell snippets; `grep -n 'AskUserQuestion' validate-security.md` shows it command-side only; a dry read confirms mode `off` path is unchanged; reachability test passes.

### Task 7: DOCS — CLAUDE.md + CATEGORIES + reachability

- **Do**:
  - Add a "Multi-agent bookend debate (opt-in)" subsection to `CLAUDE.md` (flow architecture area): the bookend model, the reduce/relay tiers, `orchestration.*`, the 5 net-new seats + the `debate-protocol` skill, that `/flow:validate-security` is the first consumer, and a pointer to the **Follow-up phases** here for the rollout.
  - `plugins/flow/CATEGORIES.md`: no new command rows (debate rides inside existing commands); add a one-line note. Agents aren't catalogued there.
  - Confirm the new `agents/` + `skills/debate-protocol/` need **no** `package.json` `files` entry (marketplace clone, not npm).
- **Pattern**: The concise pointer-style notes recently added to CLAUDE.md ("Pattern priors", "Showcase").
- **Gotcha**: Keep the CLAUDE.md addition tight (pointer, not spec — the spec is this plan + the DDR). No Maude-specifics baked into flow files.
- **Validate**: `grep -q 'bookend debate' CLAUDE.md`; CATEGORIES unchanged structurally.

### Task 8: THE SECURITY EVAL — the go/no-go gate (gates Follow-up rollout)

- **Do**: Build + run the n=8 blind eval that decides whether `relay` debate beats the `reduce` panel. Corpus: 8 past changes touching auth/input/network — **4 with a seeded known-real finding** (from a fixed CVE-class bug or a caught-in-review issue), **4 clean**. Two arms: **B** = current parallel `security-auditor`+`ethical-hacker` → reduce-pass; **C** = same two agents, 2-turn debate (Task 6). Objective 2×2 per case (no human judge): **detection rate** (caught the seeded finding) + **false-positive rate** (blocked a clean case). ~16 runs. **Ship rule:** keep/expand debate ONLY if C raises detection OR cuts false-positives vs B; a tie kills `relay` even for security (fall back to `reduce` everywhere). Record the result + the measured short-circuit **escalation rate** in the DDR.
- **Pattern**: A lightweight harness under `.ai/` (this repo's dogfood workspace), not shipped to npm. Mirrors the showcase plan's "live-dogfood is the one thing static gates can't prove."
- **Gotcha**: Design deliberately gets NO debate-vs-panel eval (no seedable ground truth) — that absence is itself the argument design stays `reduce` until the separate oscillation gate clears. Don't block the Task 5 reduce floor on this eval; only the `relay` rollout is gated.
- **Validate**: Eval harness runs; the 2×2 table is produced; the go/no-go + escalation rate are recorded in DDR-130.

### Task 9: VALIDATE — plugin-spec gate ladder

- **Do**: Run the full plugin-spec validation (no code/test/build/UI surface, mirroring the showcase-grounded plan's gate set).
- **Validate**:
  1. `node --test cli/lib/plugin-cli-reachability.test.mjs` — passes (debate wiring uses Agent/team spawn + the skill, NOT a banned raw `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"`).
  2. `jq . plugins/flow/.claude-plugin/config.schema.json >/dev/null` + Ajv compile (Task 2).
  3. `bash -n` clean on every shell block added to `validate-security.md` / `critic.md`.
  4. Markdown fence parity preserved in every edited `.md`.
  5. `scripts/check-version-parity.sh` — green (no version fields changed).
  6. New agents discoverable: `grep -l '^name: flow:' plugins/flow/agents/{builder,shipper,breaker,user-advocate,investigator}.md` → 5 hits; skill `grep -q '^name: flow:debate-protocol'`.
  7. Agent `name:` ↔ any `agentType`/spawn reference match (a grep assertion — a rename breaks silently otherwise).

---

## Validation (summary)

This is a **markdown + JSON-schema + skill/agent plugin-spec change** — the generic `lint/typecheck/test/build` + 5-platform scenario + a11y/design gates are **N/A** (no app code, no UI). The authoritative static gates are Task 9's ladder. The two things static gates **cannot** prove are (a) a live `relay` bookend end-to-end (team spawns → seats argue → one decision renders) and (b) whether debate is actually *better* — both are covered by **Task 8's eval** + a real dogfood session, and called out under Acceptance/R1 below.

---

## Acceptance Criteria

- [x] `orchestration` block added to flow config schema; Ajv compiles it; `additionalProperties:false` at every level; not in `required`; `mode` default `auto`.
- [x] `flow:debate-protocol` skill created: the 7-step mechanism + capability ladder + **reduce-vs-relay test** + rotating dissent + the **`AskUserQuestion`-in-command** invariant; reads all knobs from `orchestration.*`.
- [x] 5 net-new agents created (`builder`, `shipper`, `breaker`, `user-advocate`, `investigator`) with `name: flow:<slug>`, read-only tools, **non-proactive** descriptions, stake+voice bodies, and a fenced JSON tail with a binary `verdict`.
- [x] **`reduce`-pass floor shipped into `/design:critic`** — one consolidator producing a reconciled blocker list; strictly read-over-outputs (no relay); works with the experimental flag OFF for every user.
- [x] `/flow:validate-security` wired as the 2-seat adversarial bookend via the skill; capability-laddered; one command-side `AskUserQuestion`; **mode `off` / no-capability path byte-for-byte unchanged.**
- [x] **No hand-rolled relay** anywhere — verify no markdown routes one agent's verdict into another agent's input; flag-off ⇒ `reduce` only.
- [x] DDR-130 recorded (cross-links resolve) with the reduce-vs-relay line, the cast rule + archetype dispositions, the two-gate cost model, and eval-first governance.
- [x] CLAUDE.md bookend-debate note + CATEGORIES note added; no new command row/group; no `package.json` `files` change.
- [x] Task 9 gate ladder green (reachability · schema · `bash -n` · fence parity · version parity · agents discoverable · name↔spawn match).
- [ ] **Security eval (R1):** Task 8's n=8 2×2 run; detection + false-positive + escalation rate recorded in DDR-130; go/no-go on the broader `relay` rollout stated. (`reduce` floor ships regardless; only the `relay` expansion is gated.) — *deferred to a dogfood session (measurement, not a file write).*
- [x] Flow plugin stays project-agnostic (stakes/voices/thresholds carry no Maude-specifics); design debate's Maude-flavoring is intentional and isolated to design files.

---

## Follow-up phases (OUT of scope — gated on Task 8's eval)

Noted so the rollout is legible; each is its own future plan, and the live-`relay` ones are **gated on the security eval clearing**:

1. **Flip `mode:auto` on for the START divergent bookends** — `/flow:plan` (BUILDER/SHIPPER/BREAKER), `/flow:setup-prd` (USER-ADVOCATE/SHIPPER), `/design:setup-ds` (USER-ADVOCATE/BUILDER/signature-moment). Plan auto-debates by default (invoking plan IS the stakes-gate; short-circuit collapses the rare trivial plan cheaply).
2. **RESEARCH bookends** — `/flow:bug-rca` (INVESTIGATOR + per-hypothesis holders, cap 3; ends on evidence) and `ux-research` (INVESTIGATOR + USER-ADVOCATE fact-checking recommendations).
3. **`/design:critic` live team** — gated on its OWN measured condition: instrument `/design:edit --perfect`; require ≥30% conflict-driven oscillation AND a reduce-pass demonstrably failing to break a specific oscillation a 2-turn exchange breaks. Until then it stays the Task 5 reduce-pass.
4. **`/flow:quick` tripwire** — the escalate-only BREAKER seat for the false-trivial change (stakes-gate fires it only on load-bearing smell). Amends the "no team on per-iteration commands" guardrail in the bounded, escalate-only form.
5. **Quality-gate team hooks** — `TeammateIdle`/`TaskCreated`/`TaskCompleted` in `plugins/flow/hooks/hooks.json` to enforce the production-ready bar.
6. **Conditional internal-legibility seat** — promote "naive junior" from a BUILDER voice to a standing seat in build+design contexts (its object — the next engineer's experience of the code — is orthogonal to BUILDER's "what's best"); ship only if it passes the >90% merge-test against BUILDER.
7. **Roster audit** — re-run the merge-test on all seats after they've proven out; consolidate any pair that agrees on the verdict >90%.

---

## Confidence

**7/10** for one-pass implementation of the pilot. The schema/agent/skill files mirror existing, well-understood patterns (security config block, `test-coverage`/`ethical-hacker` agent shape, `question-protocol` skill), and the `reduce` floor (Task 5) is a high-confidence pure win with no experimental dependency. Residual uncertainty: (a) the `relay` tier rides an **experimental, off-by-default** native feature with known limits (no in-process resume, slow shutdown, task-status lag) — mitigated by the `reduce` floor making it strictly additive; (b) whether live debate measurably beats the panel — which is exactly what **Task 8's eval exists to answer before any broad rollout.** Everything static is high-confidence; the bet that `relay` is worth turning on broadly is deliberately deferred to evidence.

---

## Retro

- **The methodology was itself produced by the methodology.** This plan's design (bookends, reduce-vs-relay, cast-by-stake) came from three rounds of a 4-perspective debate with genuine cross-challenge and concessions (DIRECTOR folded 4→2 seats; SKEPTIC moved from "rare+explicit" to "auto-at-bookends"; CONTRARIAN conceded Sisyphus). The convergence-through-argument *was* the proof of concept — a single pass would have shipped the first panel's over-conservative "rare + explicit `--debate`."
- **Worked:** scoping the pilot eval-first. Shipping the `reduce` floor to everyone immediately (a pure win, no flag) while gating the expensive `relay` rollout on an n=8 measurement kept the buildable surface additive and inert-by-default — Tasks 1–4 changed zero behavior, so the pause-gate before the shipped-command wiring (5–6) was natural and low-risk.
- **Worked:** the plugin-spec gate ladder (reachability · jq+Ajv · `bash -n` · fence parity · version parity · agents-discoverable) is the right gate for markdown/JSON plugin work — the generic lint/typecheck/test/build/scenario/a11y gates are all N/A and the plan said so up front, so `/validate` didn't waste cycles.
- **Didn't fully land:** Task 8 (the security eval) is a measurement requiring the experimental `relay` tier, not a file write — it can't be "executed" in a static session and is deferred to a real dogfood run. The go/no-go for the broad `mode:auto` rollout therefore stays open; one Acceptance criterion (R1) is intentionally unchecked, mirroring the showcase-grounded plan's deferred live-dogfood.
- **For next `/plan`:** when a plan's core proof is a runtime measurement (an eval, a live debate), make that an explicit *separate* deliverable up front rather than a task in the build sequence — it has a different lifecycle (needs a flag, a corpus, a dogfood session) and shouldn't block the additive artifacts from shipping.
