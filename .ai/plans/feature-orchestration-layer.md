# Feature: Multi-agent orchestration layer — Pilot (`/flow:plan --deep`)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is plugin-internals work (markdown commands/agents + JSON schema + a dynamic-workflow script) — NOT a UI feature.** No DS/canvas/a11y/scenario gates apply; validation is the plugin-spec ladder (reachability · parity · `bash -n` · `node --check` · schema validity · fence parity), mirroring the showcase-grounded-canvas-generation plan (archived 2026-06-22).

## Description

Add an **opt-in, capability-gated** multi-agent orchestration layer to the flow plugin that mirrors how a real team produces a decision: **DIVERGE** (brainstorm several approaches) → **ADJUDICATE** (a judge scores + synthesizes) → **ONE batched a/b/c human decision** → **CONVERGE** (implement) → **GATE** (hold production-ready). Today the diverge + adjudicate steps happen invisibly in the orchestrator's head; this layer makes agents do the larger part and surfaces the user exactly one informed choice.

**This plan delivers only the first pilot** + the shared scaffolding it needs: `/flow:plan --deep` implemented as a dynamic workflow that drafts 2–4 competing technical approaches (via `flow:solution-architect`), fact-checks their cited claims (via `flow:research-verifier`), adjudicates them (via `flow:synthesis-judge`), and collapses the result to a single `AskUserQuestion` (a/b/c + recommended) before the existing plan-writing step runs. The standard single-pass `/flow:plan` is unchanged and remains the default. Broader rollout (teams for `/flow:done` security debate, `/flow:setup-prd` brainstorm, `design:setup-ds` research-verify, adversarial-QA, quality-gate hooks, `/goal` GATE) is enumerated under **Follow-up phases** and explicitly OUT of scope here.

## User Story

As a developer starting a non-trivial feature, I want `/flow:plan --deep` to have several specialist agents independently draft and cross-check competing approaches and then hand me one well-framed a/b/c decision, so that the resulting plan is production-grade in one pass instead of after several rounds of my manual review — while the cheap single-pass `/flow:plan` stays the default for routine work.

## Problem

`/flow:plan` today (verified in `plugins/flow/commands/plan.md`) is **single-pass with zero adversarial verification**: it researches libraries once, commits to one implicit approach, and never drafts or weighs alternatives. Library/gotcha claims in the "Research" step are unverified. The user's only real lever is to reject the whole plan and re-run. Maude's 21 agents are almost entirely **critics** (convergent, "absence-of-badness"); there is no **divergent** (propose competing approaches) or **adjudicative** (judge + synthesize) capability anywhere in the system. The exact place this hurts most is upfront planning.

## Solution

Introduce the diverge→adjudicate pattern as an **additive** mode, primitive-agnostic and capability-gated:

- **Primary path** (when Claude Code dynamic workflows are available): `/flow:plan --deep` runs `plugins/flow/workflows/plan-deep.workflow.mjs` via the `Workflow` tool. The workflow holds the loop (fan-out architects → cross-check claims → judge), keeps intermediate drafts in script variables (off the main context), and returns a structured result.
- **Floor path** (workflows unavailable/disabled): the same pattern degrades to a plain parallel-subagent fan-out the orchestrator runs inline — always available, just less context-efficient.
- **Default path** (no `--deep`, or `orchestration` absent): today's single-pass `/flow:plan`, byte-for-byte unchanged.

The workflow **cannot** take mid-run user input (dynamic-workflow constraint), so it returns the option set and the **`AskUserQuestion` happens in the command, after the workflow returns** — one batched a/b/c per `flow:question-protocol`. The chosen approach feeds the existing "Write the Plan" step; everything downstream of plan-writing is untouched.

New roles are reusable as **both** subagent and (later) agent-team teammate, since none pins `hooks`/`mcpServers`/`permissionMode` (those are ignored for plugin subagents anyway).

## Metadata

- **Type**: New Capability
- **Complexity**: High (cross-cutting: config schema + 3 new agents + a workflow script + command wiring + a DDR; new orchestration concept)
- **App/Package**: `plugins/flow` (Maude self-dogfood — flow running on its own repo)
- **Affected Systems**: flow config schema, flow agents, flow commands (`plan`), a new `plugins/flow/workflows/` dir, `flow:question-protocol` usage, CLAUDE.md flow docs
- **Dependencies**: Claude Code dynamic workflows (Pro+; `/config` toggle) for the primary path — **soft** dependency, capability-probed with a subagent fallback. No new npm/runtime deps.

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message**.

- `plugins/flow/.claude-plugin/config.schema.json` (whole file) — Why: add the `orchestration` top-level block. Note `additionalProperties: false` at root and the `security` block (lines 236–259) as the mirror pattern (nested object, `enabled` defaults, enums).
- `plugins/flow/commands/plan.md` (whole file, 385 lines) — Why: the command being extended. `--deep` slots in near Step 0 / Scope Check; the existing "Write the Plan" (Step 6) is the join point — deep mode feeds it the chosen approach and leaves it otherwise intact.
- `plugins/flow/agents/test-coverage.md` (whole file) — Why: the canonical agent-file shape to mirror (frontmatter `name`/`description`/`tools` only; body = role + hard rules + scope + structured Report block). No `model`/`skills`/`mcpServers` pins.
- `plugins/flow/agents/ethical-hacker.md` — Why: the precedent for a research/verification agent that holds `WebSearch` in `tools` (research-verifier mirrors its tool set).
- `plugins/flow/skills/question-protocol/SKILL.md` (whole file) — Why: the structured-question shape (`source`/`question`/`type`/`options`/`default`/`required`/`context`) the `synthesis-judge` emits and the command renders as one `AskUserQuestion`.
- `plugins/flow/hooks/hooks.json` — Why: confirms only `SessionStart` is wired today; relevant because quality-gate hooks (`Stop`/`TaskCompleted`) are a **follow-up**, NOT this plan — do not touch hooks.json here.
- `CLAUDE.md` → "Plugin command naming" + "Flow plugin: `<project>` placeholder convention" + "Published npm surface" — Why: naming rules for the new agents, the project-agnostic constraint (no Maude-specific values baked into flow), and the fact that `plugins/flow/**` ships via the **marketplace clone, not npm** (so the new `workflows/` dir needs NO `package.json` `files` entry).
- `.ai/decisions/DDR-004-flow-command-naming-prefix-convention.md` + `DDR-006-plugin-namespace-in-name-frontmatter.md` — Why: agents declare `name: flow:<slug>`; the group-`<verb>` filename rule is for **commands**, not agents (existing agents use bare slugs: `test-coverage`, `security-auditor`).

### Files to Create

- `plugins/flow/agents/solution-architect.md` — divergent role: drafts ONE concrete technical approach for an assigned angle.
- `plugins/flow/agents/research-verifier.md` — due-diligence role: adversarially fact-checks cited library/API/gotcha claims, keep/drop per claim.
- `plugins/flow/agents/synthesis-judge.md` — adjudicator: scores the proposals + verdicts, synthesizes a winner, emits the a/b/c option payload.
- `plugins/flow/workflows/plan-deep.workflow.mjs` — the dynamic-workflow script orchestrating the three phases.
- `.ai/decisions/DDR-<next>-additive-gated-orchestration-layer.md` — the decision record (number = highest in `.ai/decisions/` + 1; DDR-106 is the latest known → expect **DDR-107**, verify before creating).

### Patterns to Follow

- **Agent frontmatter** (from `test-coverage.md:1-5`): exactly `name`, `description`, `tools`. Nothing else. Body opens with a one-line role statement, then `## Hard rules` / `## Scope` / `## Report` with a fenced output block.
- **Non-proactive descriptions** — these agents must NOT be auto-delegated by unrelated tasks. Write each `description` to say it is invoked **only** by the deep-plan workflow / orchestrator (avoid "use proactively" / "MUST BE USED" trigger phrases). Contrast with `test-coverage.md` which is intentionally proactive.
- **Structured JSON tail** — every critic/agent in this repo ends its report with a machine-readable fenced JSON verdict the orchestrator parses (see `test-coverage.md:66-81` Report block; design critics emit a final `{...}` verdict). The three new agents follow suit so the workflow's `schema:` option can validate their returns.
- **Workflow script shape** (from the `Workflow` tool contract): `export const meta = {name, description, phases:[...]}` as a **pure literal**, then body using `phase()` / `agent(prompt,{agentType,schema,label,phase})` / `parallel()` / `pipeline()`. `Date.now()`/`Math.random()` are unavailable. Concurrency cap 16, total cap 1000 (we use ≤6). Plain JS, ESM `export`, top-level `await` allowed.
- **Config block** (mirror `security`, schema lines 236–259): nested object, `additionalProperties:false`, `enabled` boolean `default:false`, descriptive `description` on every key.
- **Project-agnostic** — flow is generic. The `orchestration` knob and agents must carry NO Maude-specific values; angles/thresholds are generic defaults a downstream repo inherits.

---

## Design / Architecture Decisions

### The capability ladder (which path runs)

`/flow:plan` resolves the mode in this order:

1. **`--deep` flag present** OR `orchestration.workflows.enabled == true` → attempt deep mode. Otherwise → **standard single-pass** (unchanged; stop here).
2. Deep mode requested → **capability-probe dynamic workflows**: are they enabled (not `disableWorkflows`, plan supports them)? The probe is a soft check — if the `Workflow` tool is usable, take the **Primary path** (run `plan-deep.workflow.mjs`).
3. Workflows unavailable/disabled → **Floor path**: orchestrator spawns `flow:solution-architect` ×N + `flow:research-verifier` as parallel subagents in one message, then `flow:synthesis-judge` as a follow-up subagent. Same agents, same outputs, no workflow runtime.
4. Either deep path then surfaces **one** `AskUserQuestion` and joins the existing "Write the Plan" step.

This is the "additive, off → unchanged" guarantee: with `orchestration` absent and no `--deep`, not one byte of today's behavior changes.

### Why workflows-first, teams-deferred (for the DDR)

- **Workflows** fit diverge→adjudicate exactly: deterministic loop, intermediate drafts off-context, resumable, cross-checking is a first-class pattern (mirrors bundled `/deep-research`'s "vote per claim, drop those that fail cross-check"). No experimental flag.
- **Agent teams** are experimental + off-by-default (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) and shine only when the user wants to **watch/steer a live debate** — reserved for `/flow:done` security debate in a follow-up. v1 ships the `orchestration.teams` schema stub only.
- **The a/b/c must be post-workflow.** Dynamic workflows take no mid-run user input; the workflow returns the option set, the command renders the decision. Encode this as a hard invariant.

### Open question to resolve during execute (Risk R1)

Confirm `Workflow({scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/plan-deep.workflow.mjs"})` loads a plugin-shipped script (the marketplace clone places the file on disk, so it should). If plugin-workflow auto-registration also exposes it as a saved command, that's a bonus, not a requirement. **The Floor path (Task-7 subagent fallback) makes R1 non-blocking** — if scriptPath loading fails, deep mode still works via subagents.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE DDR — additive gated orchestration layer

- **Do**: Run `/flow:record-ddr` (or author directly) `.ai/decisions/DDR-<next>-additive-gated-orchestration-layer.md`. Capture: the diverge→adjudicate→1-decision→converge→gate pattern; the capability ladder (single → subagents → workflows → teams); **why additive/opt-in/capability-gated** (teams experimental, high-frequency commands stay subagent-default for cost); workflows-first / teams-deferred rationale; the post-workflow-a/b/c invariant; the follow-up rollout list. Cross-link the showcase-grounded plan as the "markdown plugin-spec, no code gates" validation precedent.
- **Pattern**: Existing DDRs in `.ai/decisions/` (e.g. DDR-061 orchestration-speed, DDR-127 showcase-grounded).
- **Gotcha**: DDR number = `ls .ai/decisions/ | grep -oE 'DDR-[0-9]+' | sort -V | tail -1` + 1. Don't hardcode 107 without checking.
- **Validate**: File exists; cross-links resolve (`grep -o 'DDR-[0-9]*' the new file` → each referenced file exists).

### Task 2: ADD `orchestration` block to flow config schema

- **Do**: In `plugins/flow/.claude-plugin/config.schema.json`, add a top-level `orchestration` property (object, `additionalProperties:false`) with two sub-objects:
  - `workflows`: `{ enabled (bool, default false), deepPlanAngles (int 2–4, default 3, "how many solution-architect angles the deep-plan workflow drafts"), verifyResearch (bool, default true, "run research-verifier to fact-check cited claims before they reach the plan") }`.
  - `teams`: `{ enabled (bool, default false) }` + a `description` noting it is **reserved for follow-up phases (e.g. /flow:done security debate); v1 ships schema only, no consuming command**.
  - Parent `description`: "Opt-in multi-agent orchestration (diverge→adjudicate→decide→converge). Additive: absent or all-false → flow commands use today's single-pass / parallel-subagent behavior unchanged. No hard dependency on experimental Claude Code features."
- **Pattern**: The `security` block (lines 236–259) — same nesting depth, `enabled` default `false`, every key documented.
- **Gotcha**: Root has `additionalProperties:false` — adding the key in `properties` is sufficient; do NOT add it to `required` (opt-in). Keep generic — no Maude-specific defaults.
- **Validate**: `jq . plugins/flow/.claude-plugin/config.schema.json >/dev/null` (valid JSON); `node -e "const Ajv=require('ajv/dist/2020').default; new Ajv({strict:false}).compile(require('./plugins/flow/.claude-plugin/config.schema.json')); console.log('schema compiles')"` (valid JSON Schema 2020-12 — same Ajv `cli/lib/config-lint.mjs` uses).

### Task 3: CREATE `flow:solution-architect` agent

- **Do**: `plugins/flow/agents/solution-architect.md`. Frontmatter: `name: flow:solution-architect`; `tools: Read, Grep, Glob, Bash` (read-only — proposes, never implements; NO Edit/Write); `description` = narrow, non-proactive ("Divergent planning specialist. Invoked ONLY by the deep-plan workflow / orchestrator to draft ONE concrete technical approach for an assigned angle. Not for general use."). Body: given `{feature, codebase_context, angle}` where angle ∈ `mvp-first | robust-first | risk-first`, inspect the codebase read-only and produce ONE concrete approach — architecture sketch, key files to touch/create, task sequencing, the trade-off it optimizes, explicit risks, and **every external/library claim it relies on listed separately** (so the verifier can check them). End with a fenced JSON verdict: `{ angle, summary, key_decisions[], files[], risks[], cited_claims[], est_complexity }`.
- **Pattern**: `test-coverage.md` structure; read-only tool set like the critics.
- **Gotcha**: The angle is an INPUT passed per-invocation, not hardcoded — the same agent runs N times with different angles. Description must not contain proactive trigger phrases (would cause accidental auto-delegation).
- **Validate**: `grep -q '^name: flow:solution-architect' …`; frontmatter has no `model:`/`skills:`/`mcpServers:`; fenced JSON block present.

### Task 4: CREATE `flow:research-verifier` agent

- **Do**: `plugins/flow/agents/research-verifier.md`. Frontmatter: `name: flow:research-verifier`; `tools: Read, Grep, Glob, Bash, WebSearch, WebFetch`; non-proactive `description` ("Due-diligence fact-checker. Invoked ONLY by the deep-plan workflow / orchestrator to adversarially verify cited library/API/gotcha claims. Not for general use."). Body: take a list of `cited_claims` (from the architects), and for EACH claim independently attempt to **verify against authoritative sources** (prefer the `context7` MCP for library docs when available in the session — note it inherits ambient MCP tools; fall back to WebFetch/WebSearch on official docs). Vote per claim: `verified | refuted | unverifiable`, with the source. Mirror `/deep-research`: claims that fail cross-check are flagged so the judge can drop approaches that lean on them. End with fenced JSON: `{ verdicts: [{claim, status, source, note}], summary: {verified, refuted, unverifiable} }`.
- **Pattern**: `ethical-hacker.md` (the existing agent that carries `WebSearch` and does adversarial research).
- **Gotcha**: Plugin subagents IGNORE `mcpServers` frontmatter — do NOT try to pin `context7` there. The agent uses whatever MCP/web tools are ambient in the session; if none are available it returns `unverifiable` (degrades, never blocks). State this in the body.
- **Validate**: `grep -q '^name: flow:research-verifier'`; `tools:` includes `WebSearch, WebFetch`; no `mcpServers:` pin.

### Task 5: CREATE `flow:synthesis-judge` agent

- **Do**: `plugins/flow/agents/synthesis-judge.md`. Frontmatter: `name: flow:synthesis-judge`; `tools: Read, Grep` (reasons over inputs passed in; read-only); non-proactive `description` ("Adjudicator. Invoked ONLY by the deep-plan workflow / orchestrator to score competing approaches and emit one decision payload. Reusable across diverge→adjudicate flows. Not for general use."). Body: given the architect proposals + the research verdicts, **score each approach** on weighted criteria (fit-to-codebase, risk, simplicity, share-of-claims-verified), **discount approaches that depend on refuted claims**, pick a winner, graft the best ideas from runners-up into a synthesized recommendation, and emit a **decision payload in `flow:question-protocol` shape**: 2–4 options (a/b/c…), a `default`/recommended option, and a one-line rationale per option + the synthesized approach. End with fenced JSON: `{ ranked:[{option_label, approach_ref, score, why}], recommended, synthesis, question_payload:{source:"plan-deep", question, type:"choice", options[], default, required:true, context} }`.
- **Pattern**: `question-protocol/SKILL.md` question object shape (`source`/`question`/`type`/`options`/`default`/`required`/`context`).
- **Gotcha**: The judge does NOT call `AskUserQuestion` (subagents can't — it's UI-bound, and per protocol subagents never ask directly). It only **produces the payload**; the command renders it. Keep options ≤4 (AskUserQuestion limit).
- **Validate**: `grep -q '^name: flow:synthesis-judge'`; JSON tail contains `question_payload` with `options` length 2–4.

### Task 6: CREATE the `plan-deep` dynamic-workflow script

- **Do**: `plugins/flow/workflows/plan-deep.workflow.mjs`. Start with `export const meta = { name:'flow-plan-deep', description:'Draft competing technical approaches, cross-check their claims, adjudicate to one decision', phases:[{title:'Diverge'},{title:'Verify'},{title:'Adjudicate'}] }` (pure literal). Body reads `args` (`{feature, codebase_context, angles, verifyResearch}`):
  - **Diverge**: `parallel(angles.map(a => () => agent(architectPrompt(feature, codebase_context, a), {agentType:'flow:solution-architect', phase:'Diverge', label:`arch:${a}`, schema: ARCH_SCHEMA})))` — N approaches concurrently.
  - **Verify** (only if `verifyResearch`): collect the union of `cited_claims` across proposals, then `agent(verifyPrompt(claims), {agentType:'flow:research-verifier', phase:'Verify', schema: VERIFY_SCHEMA})`.
  - **Adjudicate**: `agent(judgePrompt(proposals, verdicts), {agentType:'flow:synthesis-judge', phase:'Adjudicate', schema: JUDGE_SCHEMA})`.
  - `return { proposals, verdicts, decision: judge }`. Define the three JSON schemas inline as object literals.
- **Pattern**: The `Workflow` tool contract examples (review-changes pipeline). Use `parallel()` for the barrier (judge needs all proposals + verdicts together — a genuine barrier).
- **Gotcha**: (a) `meta` must be a pure literal — no computed values. (b) The script takes **no user input** — it returns the decision payload; the a/b/c is rendered by the command (Task 7). (c) `agent()` returns `null` on skip/death → `.filter(Boolean)` proposals before judging. (d) ESM `export` + top-level `await`; injected globals (`agent`/`parallel`/`phase`) are undefined at `node --check` time but syntax-only check passes.
- **Validate**: `node --check plugins/flow/workflows/plan-deep.workflow.mjs` (ESM syntax OK); grep confirms `export const meta` is the first statement and `phases` lists the 3 titles used by `phase()`/`opts.phase`.

### Task 7: WIRE `--deep` into `/flow:plan` + the single a/b/c

- **Do**: Edit `plugins/flow/commands/plan.md`:
  1. `argument-hint`: `"feature description [--deep]"`.
  2. Add a `## Deep mode (optional — `--deep`)` section after **Step 0 / Scope Check**, before Scenario Assessment, specifying the **capability ladder** (Design section above): detect `--deep` or `orchestration.workflows.enabled`; capability-probe workflows; **Primary path** = `Workflow({scriptPath:"${CLAUDE_PLUGIN_ROOT}/workflows/plan-deep.workflow.mjs", args:{feature, codebase_context, angles, verifyResearch}})` where `angles` derives from `orchestration.workflows.deepPlanAngles` (default 3 → `["mvp-first","robust-first","risk-first"]`); **Floor path** = spawn `flow:solution-architect` ×N + `flow:research-verifier` as parallel subagents, then `flow:synthesis-judge`; **Default path** = skip section entirely.
  3. After either deep path returns the `decision.question_payload`, render **one** `AskUserQuestion` (a/b/c + recommended as the first option) per `flow:question-protocol`. Auto-mode fallback (AskUserQuestion unavailable): pick `default`.
  4. Feed the chosen approach + the synthesis + the verified-claims-only research into the existing **"Write the Plan" (Step 6)** as its grounding — do NOT duplicate or fork Step 6.
  5. One-line cost notice when deep runs ("deep mode spawned N architects + verifier + judge").
- **Pattern**: How `plan.md` already invokes `Skill(flow:skill-loader)` at Step 0 and references `flow:question-protocol`; how design commands gate `AskUserQuestion` with an auto-mode default.
- **Gotcha**: The default (no-`--deep`) path must remain literally unchanged — the new section is a guarded branch that no-ops when not triggered. Don't let `--deep` leak into the feature slug used by canvas detection. The `AskUserQuestion` is in the **command**, never inside the workflow.
- **Validate**: `bash -n` on any shell snippet added; `grep -n 'AskUserQuestion' plugins/flow/commands/plan.md` shows it in the deep section only; a dry read confirms the default path is untouched (diff scoped to additions).

### Task 8: DOCS — CLAUDE.md note + CATEGORIES + reachability sanity

- **Do**:
  - Add a short subsection to `CLAUDE.md` (flow architecture area) — "Multi-agent orchestration (opt-in)": the diverge→adjudicate pattern, the `orchestration.*` knob, the three new agents, and that `/flow:plan --deep` is the first consumer; point future work at the **Follow-up phases** in this plan.
  - `plugins/flow/CATEGORIES.md`: `/flow:plan` stays `daily`; `--deep` is a **mode flag, not a new command** → add a one-line note under the plan row, do NOT add a new command row or new group. The three agents are not commands → no CATEGORIES entry (agents aren't catalogued there).
  - Confirm the new `plugins/flow/workflows/` dir needs **no** `package.json` `files` entry (ships via marketplace clone, not npm — per CLAUDE.md "Published npm surface").
- **Pattern**: The "Pattern priors come first" / "Showcase" notes recently added to CLAUDE.md (concise, pointer-style).
- **Gotcha**: Keep CLAUDE.md addition tight (pointer, not spec — the spec is this plan + the DDR). Don't bake Maude-specifics into the flow plugin files themselves.
- **Validate**: `grep -q 'orchestration' CLAUDE.md`; CATEGORIES still lists `plan` once under `daily`.

### Task 9: VALIDATE — plugin-spec gate ladder

- **Do**: Run the full plugin-spec validation (this feature has no code/test/build/UI surface, mirroring the showcase-grounded plan's gate set).
- **Validate**:
  1. `node --test cli/lib/plugin-cli-reachability.test.mjs` — passes (the new command branch uses `Workflow`/Agent tools + `${CLAUDE_PLUGIN_ROOT}/workflows/...`, NOT a banned raw `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"` call).
  2. `jq . plugins/flow/.claude-plugin/config.schema.json >/dev/null` + Ajv compile (Task 2).
  3. `node --check plugins/flow/workflows/plan-deep.workflow.mjs`.
  4. `bash -n` clean on every shell block added to `plan.md`.
  5. Markdown fence parity preserved in `plan.md` (even ``` count).
  6. `scripts/check-version-parity.sh` — green (untouched; no version fields changed — confirm parity is 0-delta).
  7. New agents discoverable: `grep -l '^name: flow:' plugins/flow/agents/{solution-architect,research-verifier,synthesis-judge}.md` → 3 hits.

---

## Validation (summary)

This is a **markdown + JSON-schema + ESM-workflow plugin-spec change** — the generic `lint/typecheck/test/build` + 5-platform scenario + a11y/design gates are **N/A** (no app code, no UI, no untrusted-input/exec surface → security fan-out also N/A). The authoritative gates are Task 9's ladder. The one thing the static gates **cannot** prove is the end-to-end live deep run (workflow loads via scriptPath → 3 agents fire → one a/b/c renders → plan writes); that needs a real dogfood session and is called out as **R1/Acceptance** below.

---

## Acceptance Criteria

- [ ] `orchestration` block added to flow config schema; Ajv compiles it; `additionalProperties:false` honored; not in `required`.
- [ ] Three agent files created with `name: flow:{solution-architect,research-verifier,synthesis-judge}`, read-only tool sets, **non-proactive** descriptions, fenced-JSON tails.
- [ ] `plan-deep.workflow.mjs` created; `node --check` clean; `meta` pure literal with the 3 phases.
- [ ] `/flow:plan --deep` wired with the capability ladder (Primary workflow / Floor subagent / Default unchanged) and exactly **one** post-workflow `AskUserQuestion`.
- [ ] **Default `/flow:plan` (no `--deep`) is byte-for-byte unchanged** (verify the diff is purely additive/guarded).
- [ ] DDR recorded (next number) with cross-links resolving.
- [ ] CLAUDE.md orchestration note + CATEGORIES note added; no new command row/group; no `package.json` `files` change.
- [ ] Task 9 gate ladder green (reachability · schema · `node --check` · `bash -n` · fence parity · version parity).
- [ ] **Live dogfood (R1):** in a real session with dynamic workflows enabled, `/flow:plan --deep "<some feature>"` runs the workflow, surfaces one a/b/c, and writes a plan grounded in the chosen approach. (If workflows unavailable, the Floor subagent path produces the same.) — *the one criterion the static gates can't cover; may be deferred to a user run like the showcase plan's live-dogfood.*
- [ ] No DDR-worthy decision left unrecorded; flow plugin stays project-agnostic (no Maude-specifics baked in).

---

## Follow-up phases (OUT of scope — do NOT build here)

Noted so the rollout is legible; each is its own future plan:

1. **`/flow:done` security debate (agent teams)** — promote the existing `security-auditor` + `ethical-hacker` parallel pair to a steerable team that adversarially challenges each other's "safe" verdicts (the flagship debate use-case). Consumes `orchestration.teams`.
2. **`/flow:setup-prd` brainstorm** — `flow:product-strategist` + `flow:devils-advocate` divergent team to fight single-pass PRD generation (today: 0 research, 0 agents).
3. **`design:setup-ds` research-verify** — wire `flow:research-verifier` (or a design variant) to fact-check `ux-research-agent` recommendations (today: single-pass, unverified).
4. **`flow:adversarial-qa`** — a "try to break it" QA agent for `/flow:scenario` + `/design:smoke` (today: happy-path only).
5. **Quality-gate hooks** — add `Stop`/`SubagentStop`/`TaskCompleted` entries to `plugins/flow/hooks/hooks.json` to hold a quality bar (production-ready GATE), plus optional `/goal` wiring in `/flow:execute`.
6. **`memory` field on critics/verifiers** — cross-session learning for the new agents once they've proven out.
7. **Roster audit** — consolidate the three design-system agents' shared rule-core; evaluate the two a11y agents.

---

## Confidence

**7/10** for one-pass implementation. The markdown/agent/schema/workflow files mirror existing, well-understood patterns (test-coverage agent shape, security config block, the documented Workflow contract). The residual uncertainty is (a) R1 — plugin-shipped workflow loading via `scriptPath` (mitigated to non-blocking by the Floor subagent path), and (b) the end-to-end live deep run, which only a real session proves. Everything static is high-confidence.
