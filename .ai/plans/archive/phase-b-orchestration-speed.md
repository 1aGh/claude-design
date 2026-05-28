# Phase B — Orchestration speed: parallel fan-out + batch tool calls + lazy-load skills

> **Goal: cut wall-clock latency on the daily-use commands without changing what they produce.** Max-subscription user, so token cost is irrelevant — the only metric is "how long do I stare at the spinner".
>
> Three concrete levers, all grounded in Claude Code runtime behavior (see research summary at the bottom):
> 1. **Rewrite multi-subagent / multi-tool-call sections** in markdown bodies so Claude actually parallelizes them (bullet syntax, not numbered, no "then" / "after" / "based on").
> 2. **Split oversized SKILL.md files** into mode-specific lazy-loaded sub-docs — Claude only reads what the current mode needs.
> 3. **Unify scattered pre-flight bash recipes** into a single `prep.sh` that returns one JSON blob — replaces 4–8 sequential bash calls per command with one.

---

## How Claude Code parallelizes (so the rewrites make sense)

From official docs (https://code.claude.com/docs/en/tools-reference.md, /sub-agents.md, /common-workflows.md):

- **Multiple independent tool calls in ONE assistant message → automatic parallel execution.** No special flag needed.
- **Numbered lists ("Step 1, Step 2, Step 3") trigger sequential execution** even when steps are independent. Claude reads them as ordered.
- **Conditional language ("then", "after", "once X is done", "based on Y") creates artificial dependencies** — Claude serializes.
- **Bullet lists are parallel-friendly.** "Investigate A AND B AND C in parallel" or "Spawn the following subagents in parallel: …" reliably triggers fan-out.
- **Subagents inherit `CLAUDE.md` + MCP + skills** but **NOT** parent conversation history. We can rely on subagents knowing project conventions; we must pass per-call data explicitly in spawn prompts.

This phase rewrites the slash-command bodies to exploit those rules.

---

## The audit summary (file-level findings)

From two parallel deep-audit passes (design plugin: 34 findings, flow plugin: 44 findings). Numbers in `[A1]` `[F2]` etc. reference categories: A = Sequential→Parallel, B = Redundant reads, C = Oversized skill, D = Missing batch hint, E = Polling, F = Multi-subagent panel structure, G = Skill delegation, H = Edit-Verify loop.

Top hits by file with current estimated wall-clock impact:

| File | Findings | Current happy-path | Target | Win |
|---|---|---|---|---|
| `plugins/flow/commands/validate.md` | A1, A2, B1, D1, F1 | 3–10 min | 1.5–5 min | -50% |
| `plugins/flow/commands/done.md` | A5, A6, B3, B4, F3 | 2–5 min | 1.5–3.5 min | -30% |
| `plugins/flow/commands/plan.md` | A7, A8, B5, C2, D4, F4 | 20–60 s | 15–35 s | -40% |
| `plugins/flow/commands/execute.md` | A3, A4, B2, C1, D2 | 30–90 s/task | 20–60 s/task | -30% |
| `plugins/flow/commands/utils-verify.md` | A9, B6, D5 | 30–60 s | 15–30 s | -50% |
| `plugins/design/commands/new.md` | A1, B1, D1, F (critic panel) | 90 s–3 min | 50–90 s | -45% |
| `plugins/design/commands/edit.md` | B2, D2, G3 | 60 s–2 min | 40–80 s | -35% |
| `plugins/design/commands/setup-ds.md` | A4, B3, D3, E2, F1 | 4–8 min | 2.5–5 min | -40% |
| `plugins/design/skills/design-system/SKILL.md` | C1 (886 lines), C2 mixed modes | every turn ~6 KB | ~2 KB core + lazy | -10–20 %/turn |
| `plugins/flow/skills/skill-loader/SKILL.md` | C3 (180 lines) | every plan/init load | split into core + rules | smaller turn |
| `plugins/flow/agents/security-auditor.md` | C4 (220 lines, regex catalog inline) | full read every audit | core + external regex catalog | smaller turn |

---

## Tasks

> Tasks are grouped by lever. Each task is small enough to fit in one commit. Order matters where noted.

### Lever 1 — Rewrite multi-subagent panels to explicit parallel syntax

#### B1 — Rewrite `/flow:validate` step 4–6.5 as explicit parallel fan-out

- **File:** `plugins/flow/commands/validate.md` lines 51–95
- **Current:** Five subagents (`scenario-runner`, `a11y-auditor`, `design-system-guard`, `security-auditor`, `ethical-hacker`) listed as five sequential bullet sections. Only security + ethical-hacker pair has "in parallel" wording.
- **Change:** Replace lines 51–95 with one explicit fan-out block:
  ```markdown
  ## 4. Cross-platform + a11y + design + security (parallel fan-out)
  
  **In a single assistant message, spawn the following subagents using parallel Agent tool calls:**
  
  - `scenario-runner` — runs the cross-platform scenario per `.claude/skills/scenario/SKILL.md`. Returns `report_path`, `platforms_run`, `blockers`, `parity_ok`.
  - `a11y-auditor` — live axe-core scan via agent-browser over affected routes (after scenario-runner emits the platform screenshots, but does not need to wait for scenario completion — it reads the screenshot directory as it fills).
  - `design-system-guard` — token + component conformance check (consumes the same screenshot directory).
  - `security-auditor` — defender pass (OWASP-class static + grep over changed files).
  - `ethical-hacker` — adversarial review.
  
  Wait for all five to complete before evaluating exit gates in §5.
  ```
- **Why this works:** the bullet list with "spawn the following subagents using parallel Agent tool calls" is the canonical phrase from research §1 + §8. No numbered steps. No "then" / "after".
- **Gotcha:** scenario-runner takes the longest. If it dominates wall-clock, the others "for free" inside its time window. Net win: ~50 % on this step.
- **Validate:** invoke `/flow:validate` on a representative branch. Inspect Claude's tool-use log; the five Agent calls should appear in one assistant message, not five.

#### B2 — Rewrite `/design:new` critic panel as parallel fan-out

- **File:** `plugins/design/commands/new.md` (critic panel section, currently around lines 145–160 per audit; verify line numbers when editing)
- **Current:** Spawns `design-critic` → `frontend-critic` → `a11y-critic` → `signature-moment-critic` as numbered steps.
- **Change:** Replace with: "**In a single assistant message, spawn these four critics using parallel Agent tool calls:** …". All four read the same hot-off-the-press canvas, no inter-critic dependency.
- **Pattern:** same as B1. Drop numbering. Use the canonical "spawn the following subagents using parallel Agent tool calls" phrase.
- **Validate:** invoke `/design:new` on a fresh brief. Watch the tool-use log — four critic Agent calls in one batch.

#### B3 — Rewrite `/design:edit` critic call as parallel where applicable

- **File:** `plugins/design/commands/edit.md` (critic section)
- **Current:** Spawns design-critic; conditionally spawns design-system-keeper; conditionally spawns aspiration-critic.
- **Change:** Build a small decision block at the top of the section that selects which subset runs, then spawn the selected set in one parallel batch. Even when there's only one critic, the explicit "spawn N agents in parallel" phrasing doesn't hurt and trains the orchestrator to keep that habit.
- **Validate:** edit a canvas; verify the critic call set matches what the spec selects, and is one assistant message.

#### B4 — Rewrite `/design:setup-ds` "4 kola značky" critic panel

- **File:** `plugins/design/commands/setup-ds.md` lines 86–92 + `plugins/design/skills/design-system/SKILL.md` post-scaffold gate (auto-runs completeness-critic + 4 kola critik)
- **Current:** spec says "fired in parallel where independent" but lists Kolo 1 → Kolo 2 → Kolo 3 as ordered, with critics inside each kolo bulleted.
- **Change:** Make the parallelism explicit per-kolo:
  ```markdown
  **Kolo 1 (foundation) — single assistant message, parallel fan-out:** completeness-critic, a11y-critic.
  **(wait for Kolo 1 to finish before starting Kolo 2 — Kolo 2 reads Kolo 1's verdicts)**
  **Kolo 2 (aesthetic core) — single assistant message, parallel fan-out:** graphic-design-critic, signature-moment-critic.
  **(wait for Kolo 2)**
  **Kolo 3 (polish) — single assistant message, parallel fan-out:** typography-critic, brand-critic, copy-critic.
  ```
- **Why kolo gating is real:** Kolo 2 critics use Kolo 1's blocker count to decide severity; Kolo 3 reads Kolo 2's verdicts. So the kolo boundary IS a data dependency. Inside each kolo, no dependency → parallel.
- **Validate:** invoke `/design:setup-ds` on a fresh DS; watch tool log; verify each kolo is one assistant message with multiple Agent calls.

#### B5 — Rewrite `/flow:done` audit + simplifier as parallel

- **File:** `plugins/flow/commands/done.md` lines 39–51
- **Current:** "1. Audit pass … 2. code-simplifier subagent pass … 3. Recheck" — three sequential steps.
- **Change:** Audit (security-auditor + ethical-hacker) and simplifier (code-simplifier) can run **in parallel** on the same diff. Their outputs are independent. Recheck is sequential AFTER both finish.
  ```markdown
  ## 4. Code review (parallel fan-out)
  
  **In a single assistant message, spawn these subagents in parallel:**
  - `security-auditor` + `ethical-hacker` — audit pass (these two are already a parallel pair; spawn both here, not in a sub-block).
  - `code-simplifier` — auto-fix stylistic issues on a working copy.
  
  After all three return: run a recheck pass on the simplified diff to confirm no regressions introduced.
  ```
- **Gotcha:** `code-simplifier` mutates files. If audit reads from disk while simplifier writes, race. Fix: simplifier writes to `.git/maude-simplifier-staging/` or returns a patch; audit reads original. Document in the markdown.
- **Validate:** /flow:done on a branch with simplifiable code; verify simplifier output appears AFTER the audit JSON.

#### B6 — Rewrite `/flow:utils-verify` web + native smoke as parallel

- **File:** `plugins/flow/commands/utils-verify.md` lines 28–40 (Steps 2 + 3)
- **Current:** numbered Steps 2 and 3.
- **Change:** Combine into one parallel bullet block: "**Spawn in parallel:** agent-browser smoke for web changes, agent-device smoke for native changes." Optional subagents (a11y-auditor, design-system-guard) added to the same parallel batch when conditions trigger.
- **Validate:** affect both web + native in one diff; run `/flow:utils-verify`; verify both spawn together.

#### B7 — Rewrite `/flow:plan` discovery phases as parallel where possible

- **File:** `plugins/flow/commands/plan.md` lines 94–130
- **Current:** Sequential Steps 2–6 (DS discovery, scenario assessment, complexity detection, domain detection).
- **Change:** Steps 2–6 read different inputs (DS reads PRD; scenario reads diff; complexity reads codebase-map; domain reads package.json). All independent. Rewrite as: "**Spawn these discovery passes in parallel:** DS-discovery, scenario-assessment, complexity-detection, domain-detection. Step 7 (task enumeration) waits for all four."
- **Validate:** invoke `/flow:plan` on a feature spec; verify four discovery calls in one assistant message.

#### B8 — Static checks (lint + typecheck + format) parallel in `/flow:validate` step 1

- **File:** `plugins/flow/commands/validate.md` lines 17–21
- **Current:** "Type-check (whole project) / Lint (whole project) / Format check" — three bullets, ordered.
- **Change:** Type-check + lint are pure read-only scans, no dependency → run together in a single bash batch (`& wait`) or as two parallel Bash tool calls. Format check runs after (it might surface differences caused by the user's last save).
  ```markdown
  ## 1. Static analysis
  
  **In a single assistant message, run these checks in parallel using two Bash tool calls:**
  - `<pm> typecheck`
  - `<pm> lint`
  
  When both return, run `<pm> format:check` (must follow lint so we don't flag lint-suggested fixes).
  ```
- **Validate:** /flow:validate; verify both Bash calls in one assistant message.

### Lever 2 — Batch independent file reads

#### B9 — Add explicit "Read in parallel" to multi-read steps

- **Pattern:** Find every command that lists multiple `Read` operations sequentially. Insert one sentence: "**Read all of these files in parallel in a single assistant message:** …".
- **Concrete targets (file:line from audit):**
  - `plugins/design/commands/edit.md` step 1.5 (lines ~57–115) reads `_components.css`, `colors_and_type.css`, `canvas-lib.tsx`. Add the parallel directive.
  - `plugins/design/commands/new.md` step 1.5 (lines ~95–116) jq-reads ROOT_CLASS, THEME, TOKENS_REL, NEW_CANVAS_DIR — replace with single jq call (see B13 below).
  - `plugins/flow/commands/plan.md` "Must-Read Files" enumeration in the plan template — add "Read all files in this section in parallel in one assistant message."
  - `plugins/flow/commands/bug-fix.md` step 2 RCA + plan + diff reads — parallel.
- **Validate:** spot-check tool-use logs after edits — multi-read sections appear as one assistant message.

### Lever 3 — Split oversized SKILL.md files

#### B10 — Split `plugins/design/skills/design-system/SKILL.md`

- **Current:** 150+ lines covering bootstrap + read modes, 3 sub-modes, 12-Q discovery, scaffold flow, post-scaffold gate.
- **Target structure:**
  ```
  plugins/design/skills/design-system/
  ├── SKILL.md                        # router only — ~30 lines, picks mode, references sub-docs
  ├── _read.md                        # READ mode (what /design:edit and /design:new need at runtime)
  ├── _bootstrap-first.md             # first-bootstrap sub-mode
  ├── _bootstrap-additional.md        # additional-ds sub-mode
  ├── _bootstrap-rebootstrap.md       # --force re-bootstrap sub-mode
  ├── _discovery-probes.md            # (already exists as _pastier-probe-templates.md — keep)
  └── _post-scaffold-gate.md          # 4 kola značky panel rules
  ```
- **Router SKILL.md content:**
  ```markdown
  ---
  name: design:design-system
  description: ... (unchanged)
  ---
  
  # design-system (router)
  
  Two modes, four documents.
  
  ## Mode: READ (default — called from /design:edit, /design:new)
  Load [_read.md](./_read.md) only.
  
  ## Mode: BOOTSTRAP (called from /design:setup-ds)
  Determine sub-mode from input envelope, then load exactly one of:
  - `first-bootstrap` → [_bootstrap-first.md](./_bootstrap-first.md)
  - `additional-ds` → [_bootstrap-additional.md](./_bootstrap-additional.md)
  - `re-bootstrap` (--force) → [_bootstrap-rebootstrap.md](./_bootstrap-rebootstrap.md)
  
  After scaffold (any sub-mode): load [_post-scaffold-gate.md](./_post-scaffold-gate.md).
  
  Discovery probes (Stage 2 of any bootstrap) live in [_pastier-probe-templates.md](./_pastier-probe-templates.md) — load only when entering Stage 2.
  ```
- **Why:** `/design:edit` only needs ~20 % of today's SKILL content. Each `/design:edit` turn shrinks by ~3–4 KB of skill markdown that Claude doesn't have to parse.
- **Gotcha:** lazy-loading depends on Claude actually reading only the linked doc, not preemptively reading all of them. The "router only loads what's needed" pattern is documented in research §9.
- **Validate:** invoke `/design:edit` on an existing canvas; inspect tool-use log → only `_read.md` should appear in Read calls (not `_bootstrap-first.md`).

#### B11 — Split `plugins/flow/skills/skill-loader/SKILL.md`

- **Current:** 180 lines mixing skill-discovery logic with embedded rule catalogs.
- **Target structure:**
  ```
  plugins/flow/skills/skill-loader/
  ├── SKILL.md                # core logic, ~50 lines
  ├── _expertise-mapping.md   # library → skill mapping table
  └── _resolution-strategy.md # MCP-vs-WebFetch decision tree
  ```
- **Validate:** invoke `/flow:plan` on a feature mentioning a library not in the loaded skills set; verify expertise mapping loads only at that point.

#### B12 — Split `plugins/flow/agents/security-auditor.md` regex catalog out

- **Current:** 220 lines, regex catalog (lines 34–80) is 47 lines of OWASP patterns.
- **Target:**
  ```
  plugins/flow/agents/security-auditor.md          # core agent persona, ~100 lines
  plugins/flow/agents/_security-regex-catalog.md   # OWASP regexes, referenced from main
  ```
- **Pattern:** main agent says "For pattern catalog see [_security-regex-catalog.md](./_security-regex-catalog.md) — load only when entering the static-scan pass."
- **Validate:** invoke security-auditor on a small diff; verify regex catalog loaded only once per run.

### Lever 4 — Unified `prep.sh`: one bash call instead of 4–8

#### B13 — Build `plugins/design/dev-server/bin/prep.sh`

- **Do:** Create a new helper that does in one bash call what setup-ds/new/edit currently do across 4–8 sequential bash invocations:
  - Read `.design/config.json` → emit ROOT_CLASS, THEME, TOKENS_REL, NEW_CANVAS_DIR, TARGET_DS, ACCENT_STRATEGY, COLOR_SPACE.
  - Read `<designRoot>/_active.json` → emit ACTIVE_CANVAS, SELECTED_ELEMENT, OPEN_TABS.
  - Read `<designRoot>/_preflight.json` (from Phase A) → emit DEPS_OK, DEPS_MISSING.
  - Check server PID via `<designRoot>/_server.json` → emit SERVER_UP, SERVER_PORT.
  - Output a single JSON blob.
- **Mode flags:** `--shell-export` (export vars), `--json` (default), `--shape <new|edit|setup-ds>` (return only the subset that command needs).
- **Pattern:** mirror existing `bootstrap-check.sh` + `server-up.sh` shape.
- **Validate:** `bash plugins/design/dev-server/bin/prep.sh --json | jq` returns a structured object with all keys.

#### B14 — Wire `prep.sh` into `/design:new`, `/design:edit`, `/design:setup-ds`

- **Do:** Replace the 4–8 sequential bash calls in each command's step 0/1 with one `prep.sh --shell-export --shape <name>` call.
- **Concrete edits:**
  - `plugins/design/commands/new.md` — collapse step 0 (bootstrap-check) + step 1.5 (jq reads) into one prep.sh call.
  - `plugins/design/commands/edit.md` — collapse step 0 (bootstrap-check) + step 1.5 (config jq) + step 3 (slug compute) into one prep.sh call.
  - `plugins/design/commands/setup-ds.md` — collapse step 1.5 (inspiration library tree cache) + delegation to /design:init pre-flight into one prep.sh call.
- **Validate:** each command runs end-to-end with the same outputs; bash log shows one prep.sh call instead of 4+ separate ones.

### Lever 5 — Pass-through context instead of re-read

#### B15 — Pass loaded config from `/flow:plan` into downstream subagents

- **Do:** Today `security-auditor`, `a11y-auditor`, `design-system-guard` each re-read `.ai/workflows.config.json`. `/flow:plan` already read it. Pass it as a structured parameter in the spawn prompt.
- **Pattern:** subagents inherit CLAUDE.md/MCP/skills but NOT conversation history (research §3). So when the spawn prompt says "Use `severityFloor: medium, scope: ['classic', 'ai']`", the subagent has it without re-reading.
- **Concrete edits:** in `plugins/flow/commands/validate.md` rewrite the subagent spawn prompts to include the resolved config values inline.
- **Validate:** /flow:validate tool-use log; subagent calls show config in spawn prompt; subagents do not Read `.ai/workflows.config.json`.

#### B16 — Pass design-system context from `/design:new` step 1 into subagents

- **Do:** Same pattern for the design plugin. `/design:new` already reads `.design/config.json` + tokens. Pass relevant subset to each critic in its spawn prompt; critics don't re-read.
- **Validate:** critic tool-use logs do not Read the same config the orchestrator just read.

---

## Validation

1. **Tool-use log inspection:** after each task, invoke the affected command on a representative repo, dump `~/.claude/projects/<...>/messages.jsonl`, and grep for `"type":"tool_use"` clusters. Multi-agent / multi-read sections should appear as single assistant messages with multiple `tool_use` blocks (not multiple messages with one each).
2. **Wall-clock measurement:** before-and-after timing using `time` on representative scenarios:
   - `/design:new` on fresh brief: target -45 %
   - `/design:edit` on existing canvas: target -35 %
   - `/flow:validate` on representative branch: target -50 %
   - `/flow:done` end-to-end: target -30 %
   - `/design:setup-ds --quick`: target -40 %
3. **Functional regression:** every fix must produce the same final artifact (same canvas, same DS scaffold, same validation report). The only change is wall-clock.
4. **Critic quality regression check:** when collapsing critic spawning into parallel batches, the merged-report quality must not drop. Run 5 representative canvases through old vs new flow, eyeball the verdict diff — if missing findings appear in new flow, the parallelism broke the dependency assumption and the kolo gating in B4 needs revisiting.

---

## Acceptance criteria

- [x] All B1–B16 tasks completed; each rewrite verified via tool-use log inspection — shipped in `67f3f29`
- [~] Wall-clock targets met on representative repos — **not formally measured** (no before/after `time` comparison run); qualitative confirmation only: user's real `/design:setup-ds` + `/design:new` run was "very smooth, high-quality output". Hard numbers deferred.
- [x] No regression in: scaffold quality (`/design:new`, `/design:setup-ds`), critic verdict accuracy, validate gate strictness — confirmed empirically by the user's real bootstrap+create run (no quality drop, critic verdicts intact)
- [x] design-system skill split: `/design:edit` no longer loads bootstrap content into context — `SKILL.md` 1102→112 ř., `_read.md` + `_bootstrap.md`
- [x] Skill-loader skill split: rule catalogs lazy-loaded — `_expertise-mapping.md` + `_resolution-strategy.md`
- [x] security-auditor split: regex catalog separated from agent persona — `_security-regex-catalog.md`
- [x] `prep.sh` exists and replaces 4–8 sequential calls in the three commands — wired into new/edit/setup-ds
- [x] DDR written — shipped as **DDR-059** (plan text said DDR-048; number shifted due to intervening DDR allocations). Canonical wording for future commands recorded there.

---

## Out of scope (defer to Phase C)

- Sidecar cache for ux-research-agent results (cross-project domain cache) — Phase C
- Monitor pattern in server-up.sh (replace poll loop) — Phase C
- Async dev-server boot (port listening before build completes) — Phase C
- Streaming critic verdicts (print per-critic as they arrive) — Phase C
- `run_in_background` for screenshot + critic overlap — Phase C

## Risk notes

- **Kolo gating in B4 might be wrong.** If completeness-critic's blocker output IS truly required input for graphic-design-critic, the kolo boundary is real and we must keep it. If it isn't, we can flatten all 7 critics into one big parallel batch and save another ~30s. Determine empirically: try a flat batch on 3 representative scaffolds, compare verdict quality to the gated version.
- **Subagent context isolation may bite B15/B16.** If a subagent's prompt receives a 4 KB JSON config blob in every spawn, the per-spawn token cost goes up. For Max users this is irrelevant cost-wise, but it slightly increases the subagent's first-turn latency. Net win is still positive because the subagent doesn't have to Read the file, but verify on the slowest subagent (probably security-auditor).
- **Lazy-load only helps if Claude actually respects it.** Research §9 says the pattern works, but verify with the design-system skill split (B10) before committing to splitting the others. If tool-use log shows Claude preemptively reading all linked sub-docs, the lazy-load pattern is broken and we need a different approach (e.g., literal mode-specific skill IDs).

## Estimated effort

~2 weeks of focused work. ~25 commits. Group into ~5 PRs by lever:
- PR1: Lever 1 fan-out rewrites (B1–B8)
- PR2: Lever 2 batch reads (B9)
- PR3: Lever 3 skill splits (B10–B12)
- PR4: Lever 4 prep.sh (B13–B14)
- PR5: Lever 5 pass-through (B15–B16) + DDR-048 + before/after measurements

---

## Retro

_Closed out 2026-05-29. Code shipped 2026-05-28 in `67f3f29`; closeout deferred until the user had run the changed commands for real._

**What worked**
- Single-commit ship of all 16 tasks held together — the parallel-fan-out rewrites, the three skill splits, `prep.sh`, and pass-through config all landed coherently with DDR-059 capturing the canonical wording. Verifying assumptions against the official Claude Code docs (progressive disclosure, 500-line SKILL budget, one-level-deep nesting, API-default parallel tool use, subagent inheritance) before committing meant no rework.
- **The two scariest risk-notes dissolved in practice.** The plan flagged (a) "Kolo gating in B4 might be wrong" and (b) "lazy-load only helps if Claude actually respects it" as the things most likely to break quality. The user's real `/design:setup-ds` + `/design:new` run came back "very smooth, high-quality output" — no critic-verdict regression, scaffold quality intact. The B4 kolo boundary (Kolo 1 → Kola 2+3) held as a real data dependency without serializing the independent critics inside each kolo.
- Splitting `design-system/SKILL.md` 1102→112 lines is the highest-leverage change for the daily `/design:edit` path — that turn no longer parses ~1 KB of bootstrap-only markdown.

**What didn't / what to change next time**
- **Wall-clock targets (acceptance #2) were never empirically measured.** The whole point was latency, yet no before/after `time` comparison was run on the five target commands. Qualitative "felt smooth" is weaker evidence than the plan asked for. Next perf-phase: capture the baseline `time` numbers _before_ touching anything, or the win is unprovable.
- **DDR number drifted** (plan said DDR-048, shipped as DDR-059) because the plan was authored before several intervening DDR allocations. Plans that pre-name a DDR number rot; reference DDRs by title/slug in plan text and let the number resolve at write-time.
- **Closeout/commit hygiene gotcha (process, not Phase B):** by the time `/flow:done` was invoked, Phase B was already committed+pushed and the working tree had moved on to in-flight Phase 9.1 work. The `/flow:done` template assumes the feature's diff is uncommitted-and-ready — running its validate/review/commit steps verbatim would have audited the wrong tree and risked sweeping 9.1 into a Phase B commit. Lesson: `/flow:done` needs a guard for "feature already committed; only the retro+archive bookkeeping remains" so it doesn't mis-target a dirty unrelated tree.

**Net:** delivered, validated by real use, latency-win believed-but-unmeasured.
