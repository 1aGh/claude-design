# DDR-059 — Orchestration speed pattern: parallel fan-out + lazy-load skill docs + unified `prep.sh`

> **Renumbered from DDR-048 → DDR-059 (2026-05-28):** the Phase B plan text reserved "DDR-048", but 048 was already taken (`DDR-048-dev-server-system-view-no-shell-bias.md`) — in fact every number through 058 is now in use. Next-free at authoring time is 059. The "always cite next-free, never hardcode a DDR number in a plan" lesson (now three times: see DDR-058's header) stands.

**Status:** Accepted — 2026-05-28.
**Related:** [DDR-058](DDR-058-maude-doctor-deps-config-quality.md) (slash commands call libs directly — same "one call, not many" instinct), the dev-server `bin/` helper consolidation (`bootstrap-check.sh` / `server-up.sh` / `slug.sh` precedent that `prep.sh` extends). Plan: `.ai/plans/archive/phase-b-orchestration-speed.md`.

## Context

The daily-use commands (`/flow:validate`, `/flow:done`, `/flow:plan`, `/flow:execute`, `/flow:utils-verify`, `/design:new`, `/design:edit`, `/design:setup-ds`) accreted three wall-clock taxes that don't change *what* they produce, only how long the user stares at the spinner:

1. **Accidental serialization.** Multi-subagent panels and multi-tool steps were written as numbered lists or with conditional language ("then", "after", "based on"). The Claude *API* already runs independent tool_use blocks concurrently once emitted (see Documentation cross-check below) — so the latency tax is not the runtime, it's that prose-ordered instructions bias Claude toward emitting the calls **across several assistant turns** (one per step) instead of **batching them into one turn**. Five validate subagents got spawned one turn after another; critic panels spawned one critic per turn. The fix is phrasing that makes Claude emit the independent calls in a single turn.
2. **Oversized always-on skill docs.** `design-system/SKILL.md` (1102 lines) carried the full ~900-line BOOTSTRAP flow even on a `/design:edit` turn that only needs the ~30-line READ flow. `skill-loader/SKILL.md` (180 lines) and `security-auditor.md` (220 lines, 47-line regex catalog inline) loaded their entire body on every invocation.
3. **Sequential pre-flight bash.** `/design:new` / `/design:edit` / `/design:setup-ds` each ran 4–8 sequential `jq`/read calls in step 0/1 (config fields, `_active.json`, `_preflight.json`, `_server.json`, slug) — a round-trip per call.

User is on a max subscription → token cost is irrelevant; the only metric is latency.

## Decision

Three levers, all grounded in documented Claude Code runtime behavior, applied to the command/skill/agent markdown (no runtime code beyond one new bash helper):

### 1. Parallel fan-out — canonical wording (use this verbatim in future commands)

Independent subagents/tool-calls MUST be expressed so Claude batches them into **one assistant message**. The canonical phrase, reused across every rewrite:

> **In a single assistant message, spawn the following subagents using parallel Agent tool calls:** …

Rules that make it fire:
- **Bullet lists, never numbered**, for the parallel set.
- **No conditional language** ("then" / "after" / "once X is done" / "based on Y") between members — that manufactures a dependency and serializes.
- A real data dependency is expressed as an explicit **"wait for … before …"** boundary *between* batches (e.g. `/flow:validate` waits for all five before evaluating gates; `/design:setup-ds`'s Kolo 1 gates Kola 2+3).
- Applied to: `/flow:validate` (5-agent scenario+a11y+design+security fan-out; typecheck+lint parallel), `/flow:done` (audit + simplifier parallel, recheck after), `/flow:utils-verify` (web+native smoke), `/flow:plan` (discovery passes), `/design:new` + `/design:edit` (critic panel), `/design:setup-ds` (Kolo 1 → Kola 2+3).

### 2. Lazy-load — router + mode-specific sub-docs

A large skill/agent doc splits into a small always-loaded **router** plus sub-docs the router loads **only for the resolved mode**:
- `design-system/SKILL.md` → router (mode-detection + the shared Animation contract + pointers) + `_read.md` (READ flow) + `_bootstrap.md` (the whole BOOTSTRAP flow). A `/design:edit` turn loads `_read.md`, never `_bootstrap.md`.
- `skill-loader/SKILL.md` → lean core + `_expertise-mapping.md` (load at the diff step) + `_resolution-strategy.md` (load only when a gap exists).
- `security-auditor.md` → persona + `_security-regex-catalog.md` (load only on entering the static-scan pass).

**Cross-references that other files depend on stay in the router**, not the sub-doc — e.g. the Animation tooling contract stays in `design-system/SKILL.md` because `commands/new.md` + `commands/edit.md` link to "SKILL.md → Animation tooling contract".

### 3. Unified `prep.sh` — one bash call replaces 4–8

`plugins/design/dev-server/bin/prep.sh` reads `.design/config.json` + `_active.json` + `_preflight.json` + `_server.json` in a single pass and emits one blob (`--json` default / `--shell-export` / `--shape new|edit|setup-ds`). It mirrors the existing `bootstrap-check.sh` / `server-up.sh` shape and ships via npm (under the already-published `plugins/design/dev-server/`).

**Boundaries kept deliberately separate** (prep.sh does NOT absorb them):
- `server-up.sh` still owns server *start* — `prep.sh` only *probes* liveness (PID + `/_health`).
- `bootstrap-check.sh` still owns the DS-presence 0/10/11 exit-code gate — `prep.sh` reports `config_present` + `known_ds` but not that contract.

### 4. Pass-through context to subagents

Subagents inherit CLAUDE.md + MCP + skills but **NOT** parent conversation history. When the orchestrator already resolved config, hand the resolved values inline in the spawn prompt instead of making each subagent re-read the file:
- `/flow:validate` passes `severityFloor` / `includeAi` / `scope` to `security-auditor` + `ethical-hacker`.
- `/design:new` passes `root_class` / `tokens_path` / `components_css` / `ds_root` / `ds_name` / `theme` to the DS-conformance critics.

## Why this is DDR-worthy

It establishes a **reusable pattern with canonical wording** that future commands must follow, and it splits three authoritative spec files — a structure later well-meaning edits could silently re-merge or re-serialize. Pinning the canonical phrase ("In a single assistant message, spawn … using parallel Agent tool calls"), the router/sub-doc rule (shared cross-refs stay in the router), and the `prep.sh` boundary (never absorbs server-start or the DS-presence gate) makes a regression auditable.

## Deviations from the plan text (recorded for honesty)

- **`design-system/SKILL.md` split is 3 files, not the plan's 6.** The plan proposed separate `_bootstrap-{first,additional,rebootstrap}.md`. Those sub-modes are ~20-line adaptations *inside* the bootstrap flow; splitting them adds fragile cross-references for no extra READ-mode win (the goal — `/design:edit` not loading bootstrap content — is met by the single `_bootstrap.md`). The sub-mode adaptations live inside `_bootstrap.md`.
- **`/design:setup-ds` 4-kola gating** follows the *existing* `SKILL.md` model (Kolo 1 first, then Kola 2+3 as one parallel batch) rather than the plan's 3-sequential-kola model. The existing spec is already more parallel and is authoritative; `setup-ds.md` was aligned to it instead of introducing a contradiction. (The plan's own risk note flagged the kolo-gating model as "might be wrong — determine empirically".)
- **`prep.sh` does not fold in `bootstrap-check.sh` or the inspiration-library `ls -R` cache**, contra the plan's B14 wording — those have a distinct exit-code contract / distinct domain, respectively.

## Documentation cross-check (official sources — 2026-05-28)

The three levers were verified against the official Claude docs (`/flow:validate` deep-research pass). Findings:

- **Lazy-load via split SKILL.md — VERIFIED.** Agent Skills load in three tiers: metadata (`name`+`description`, always), SKILL.md body (on trigger), and **bundled/linked files on demand only when referenced** — "Resources consume zero tokens until accessed." (Agent Skills Overview.) Our #1 risk (does Claude defer the linked read or preemptively read all sub-docs?) resolves to **defers**, conditional on the **one-level-deep rule**: *"Avoid deeply nested references… Keep references one level deep from SKILL.md."* (Skill authoring best practices.) Our split is exactly one level (router → `_read.md` / `_bootstrap.md`), so it complies — and this is the doc-grounded reason the plan's proposed 6-file nested sub-mode split was **correctly avoided**.
- **Official SKILL.md budget is ≤ 500 lines.** (Best practices → Token budgets.) Routers comply (112 / 90). **`_bootstrap.md` (~975 lines) exceeds it** — accepted trade-off: it is a single coherent flow loaded *only* in bootstrap mode, and splitting it deeper would violate the more important one-level-deep rule (nested reads risk partial loads). The 500-line budget is a soft perf guideline; the nesting rule is the harder constraint. Revisit only if bootstrap can be cleanly partitioned into independent router-linked (one-level) docs.
- **Parallel execution is the API default.** Independent `tool_use` blocks in one assistant turn run concurrently with no flag. (Parallel tool use.) So our bullet/no-conditional phrasing is **not** an execution switch — it's what biases Claude to emit the independent calls in **one** turn instead of spreading them across turns, plus it marks the real "wait for all N" dependency boundaries. The canonical wording stays; the DDR's framing was corrected (Context §1) to not overclaim the mechanism.
- **Custom subagents DO inherit CLAUDE.md** (only the built-in `Explore` + `Plan` skip it); none inherit parent conversation history. (Subagents docs.) Our inline-config pass-through (Lever 4/5) is the correct primitive — there is no "shared config" subagent channel in the spec.
- **Subagent (agent-file) split is real but costs an explicit read.** An agent's markdown IS its system prompt, loaded wholesale at spawn. Moving the regex catalog out of `security-auditor.md` shrinks that system prompt, but the catalog must be explicitly `Read`/`grep`'d when the static-scan pass begins (one extra tool call, ~sub-second). Our spec already instructs exactly that ("load only when entering the static-scan pass"). Correct as written.

Tips considered and **rejected**: `disable-model-invocation: true` on the routers — does NOT apply here, because `design-system` (READ mode) and `skill-loader` are *designed to auto-trigger* (mode-detection / dependency-gap detection); disabling model invocation would break the very auto-load the split optimizes. Terminology nit ("concurrent" vs "parallel") — not worth churning the established repo phrasing.

Sources: platform.claude.com/docs Agent Skills Overview + Skill authoring best practices (three-tier loading, one-level-deep rule, 500-line budget); platform.claude.com/docs Parallel tool use; code.claude.com/docs Subagents + Skills.

## Validation status

Pattern + structural changes verified by inspection (no test suite for plugin markdown): `prep.sh --json | jq` returns the full structured object against this repo's own `.design`; both shell-export shapes emit the expected vars; the SKILL split preserves the CI sync marker (`SUB-AGENT-PROMPTS.md` still present in the router); no external doc references a moved section; all 15 touched markdown files have balanced code fences and intact frontmatter. **Not measured here:** the per-command wall-clock deltas in the plan's targets (-45 %/-35 %/-50 %/-30 %/-40 %) require live `time` runs on representative repos — left as a follow-up since this repo has no UI surface to exercise the design commands end-to-end.
