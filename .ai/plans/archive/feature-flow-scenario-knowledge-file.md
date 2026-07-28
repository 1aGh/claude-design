# Feature: flow:scenario repo-owned knowledge file (retire per-repo wrapper skills)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — mirror `release.md` / `release-guide.md` exactly where the mechanism transfers, and don't force a false 1:1 where it doesn't (scenario isn't a linear runbook the way release is).

## Description

`flow:scenario` currently bakes its entire protocol (5-platform matrix, tooling choice, selector strategy, parallelization, skip-cache logic) into the plugin's own `plugins/flow/skills/scenario/SKILL.md`. When a downstream project needs to diverge from that protocol — different test-account/reset strategy, a RAM-constrained host that can't run devices in parallel, app-specific selector conventions, platform gotchas — today's only option is to hand-roll a project-local override skill under `.claude/skills/scenario/`. AI-StudyMate did exactly this (`.claude/skills/scenario/SKILL.md`, 336 lines, `name: scenario-studyfi-deltas`), and their own DDR-021 explicitly frames it as a deliberate minimization forced by the absence of a lighter-weight mechanism — "integrate, don't fork" was the goal, but the *only* integration seam available was "write another skill file."

The flow plugin already has a proven, lighter-weight pattern for exactly this problem: `/flow:release` is a generic, project-agnostic walker; all release-specific knowledge lives in a single repo-owned Markdown file (`.ai/release-guide.md`, path configurable via `integrations.changelog.releaseGuide`) that the walker reads at runtime. Adding a new release provider is a documentation change to that file, never a code change to `release.md`. This plan applies the same shape to scenario: add a `paths.scenarioGuide` config key (default `.ai/scenario-guide.md`), scaffold a generic template for it via `maude init`, and teach `flow:scenario`'s skill/command/agent trio to resolve and apply it — so a repo with special needs writes one Markdown file instead of a whole skill package.

Two secondary findings from researching AI-StudyMate's wrapper feed directly into scope:

1. Of AI-StudyMate's 8 delta sections, four (testID-first / stable-locator authoring, tiered selector reach-order with vision as advisory-only, an infra-error-vs-product-fail exit-code convention, and the step-by-step collaborative scenario-authoring loop) are **generic methodology**, not StudyFi-specific — they were re-derived from scratch because `flow:scenario` doesn't document them, not because they're app-specific. These should be upstreamed into the base protocol so every adopter gets them for free instead of re-inventing them.
2. The rest (sequential-not-parallel device lifecycle, the `agent-qa@` test-account/reset system, their own `bin/scenario` CLI + `_lib/` bash substrate, ~150 lines of Expo/RN/Auth0 platform gotchas) is irreducibly tied to AI-StudyMate's stack and hardware. That's exactly the kind of content a `scenario-guide.md` should hold — it stays out of the generic plugin.

## User Story

As a flow-plugin maintainer (and as any downstream project owner with unusual scenario-testing needs), I want repo-specific scenario knowledge to live in one plain Markdown file that `flow:scenario` reads directly, so that no project ever needs to author a custom `.claude/skills/scenario/` wrapper just to override a few defaults.

## Problem

- No config hook exists for scenario knowledge (`paths` only has `prd`/`designSystem`/`codebaseMap`/`designRoot`; `.ai/scenarios/` itself is hardcoded string-literal in 3 files, which is fine and out of scope — the missing piece is a *knowledge* file, not a directory-path override).
- `flow:scenario`'s SKILL.md, `commands/scenario.md`, and `agents/scenario-runner.md` have no mechanism to read or apply a repo-owned override file.
- The only escape hatch today is a full project-local skill package, which (a) requires `.claude/skills/<name>/SKILL.md` frontmatter/registration ceremony a plain knowledge file doesn't need, (b) isn't discovered or referenced by `scenario.md`/`scenario-runner.md` at all — it only works because a human/agent happens to know to read it, (c) has already needed one manual consolidation in AI-StudyMate (an earlier `scenario-copilot` skill was merged into it) — a signal that this repo is already trying to converge toward fewer wrapper files, not more.
- Genuinely reusable methodology AI-StudyMate had to reinvent (locator strategy, infra-error classification, collaborative authoring) isn't captured anywhere in the shared plugin, so the next project hits the same gaps from zero.

## Solution

Mirror the release-guide.md mechanism for scenario:

1. New config key `paths.scenarioGuide` (default `.ai/scenario-guide.md`), same object as `designRoot`/`prd`/etc.
2. New `ai-skeleton` template `scenario-guide.md`, PROJECT_NAME-templated via `cli/commands/init.mjs`, scaffolded empty/skeletal (no opinionated stack defaults, per the flow plugin's project-agnostic rule) with section headers matching the *reusable shape* found in AI-StudyMate's deltas doc: device/platform lifecycle overrides, test-account & reset strategy, selector-strategy overrides, infra-error classification overrides, platform-specific gotchas log, scenario-authoring notes.
3. `flow:scenario`'s SKILL.md gains one new resolution step at the top of its protocol: read `paths.scenarioGuide` if the file exists, apply its sections as deltas over the defaults below; if absent, proceed unmodified — this is optional enrichment, never a hard requirement (unlike `release.md`, which refuses to run without its guide — scenario has real, sufficient generic defaults on its own).
4. `scenario.md` (command) and `scenario-runner.md` (agent) get the same resolution snippet so the subagent that actually decides platform/lifecycle scope also honors overrides.
5. SKILL.md explicitly states: do not create a `.claude/skills/scenario/` wrapper for this — write deltas into the guide file instead.
6. Upstream the four generic-methodology pieces (testID-first authoring, tiered selector reach-order with vision advisory-only, infra-error-vs-product-fail exit convention, collaborative step-by-step authoring loop) directly into SKILL.md's base protocol, as **advisory defaults a project can still override via the guide file**, not hard requirements.
7. Document (not execute, in this plan) the migration recipe for AI-StudyMate: delete `.claude/skills/scenario/SKILL.md`, move its repo-specific sections into `.ai/scenario-guide.md`, drop the now-redundant generic sections since they'll be upstreamed.

**Explicitly out of scope:** rewriting AI-StudyMate's `bin/scenario` CLI or `_lib/` bash substrate into shared plugin infrastructure — that's real per-repo test-framework code (Expo/RN/Auth0-specific), analogous to how `release-guide.md`'s bash blocks call into repo-specific scripts rather than the plugin reimplementing them. `maude scenario-report` (the existing shared report-generation CLI) already plays that "reusable infrastructure" role and isn't touched here.

## Metadata

- **Ticket**: N/A — user-initiated via `/flow:plan` chat, no tracker configured for this request
- **Type**: Enhancement / architectural refactor
- **Complexity**: High
- **App/Package**: `plugins/flow` (+ `cli/`)
- **Affected Systems**: flow plugin (skill/command/agent trio for scenario), `.claude-plugin/config.schema.json`, `maude init` scaffolding, downstream repos using `flow:scenario` (notably AI-StudyMate, external repo — migration documented but not executed by this plan)
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read every file below in parallel in a single assistant message during `/flow:execute` — independent context loads.

- `plugins/flow/skills/scenario/SKILL.md` (hidden skill, full protocol owner — platform matrix, file layout, selector reach-order, C15/C16/C18 speed levers, report shape, authoring steps) — Why: this is the file gaining the resolution step + the upstreamed methodology sections.
- `plugins/flow/commands/scenario.md` (`/flow:scenario` dispatcher) — Why: needs the same guide-resolution reference as the skill.
- `plugins/flow/agents/scenario-runner.md` (`flow:scenario-runner` subagent — derives platform scope from a hardcoded table, calls `maude scenario-report`) — Why: the actual orchestrator that must honor lifecycle/selector overrides from the guide file.
- `plugins/flow/commands/release.md` (the exact pattern to mirror: `jq -r '.integrations.changelog.releaseGuide // ".ai/release-guide.md"' .ai/workflows.config.json`, refuse-if-absent, generic Markdown walker) — Why: reference implementation.
- `plugins/flow/templates/ai-skeleton/release-guide.md` (36-line skeleton template, `PROJECT_NAME` placeholder + provider-stub substitution) — Why: template shape to mirror for `scenario-guide.md` (minus the provider-stub step — scenario has no equivalent "provider" axis).
- `plugins/flow/.claude-plugin/config.schema.json` — `paths` object (lines ~28-52, `additionalProperties: false`) and `integrations.changelog.releaseGuide` (~line 470) — Why: exact schema shape to extend.
- `cli/commands/init.mjs` — `TEMPLATED` file list + the `CHANGELOG_STUBS` per-provider substitution logic — Why: `scenario-guide.md` needs the same `PROJECT_NAME` substitution (no per-provider stub needed).
- `plugins/flow/templates/ai-skeleton/scenarios/README.md` — Why: existing generic layout/convention doc (directory shape, not knowledge/deltas) that the new guide file must cross-link with, not duplicate.
- `.ai/release-guide.md` (this repo's own dogfood copy, real filled example) — Why: read-only reference for how much repo-specific elaboration a knowledge file can carry.

### External reference (read-only — different repo, not edited by this plan)

- `/Users/iagh/git/AI-StudyMate/.claude/skills/scenario/SKILL.md` — the wrapper this feature obsoletes; source of the 8-section delta taxonomy.
- `/Users/iagh/git/AI-StudyMate/.ai/archive/decisions/DDR-021-scenario-testing-strategy.md` — their own "integrate, don't fork" rationale; corroborates this plan's direction.
- `/Users/iagh/git/AI-StudyMate/.ai/logs/2026-07-03-scenario-harness-gap-analysis.md` — real-world failure modes that motivated their gotchas section; useful sanity-check when writing the generic template's section prompts.

### Documentation

- None external — this is a pure flow-plugin architecture change; no third-party library involved.

### Patterns to Follow

Exact resolution snippet from `release.md` to mirror (adjust key + default path):

```bash
GUIDE=$(jq -r '.paths.scenarioGuide // ".ai/scenario-guide.md"' .ai/workflows.config.json 2>/dev/null || echo ".ai/scenario-guide.md")
```

Unlike `release.md`, do **not** exit 1 when the file is absent — scenario has sufficient generic defaults standalone; the guide is optional enrichment, not a hard prerequisite.

---

## Tasks

Execute in order. Each task is atomic and testable.

### ✅ Task 1: ADD `paths.scenarioGuide` config schema key

- **Do**: In `plugins/flow/.claude-plugin/config.schema.json`, add a `scenarioGuide` property to the `paths` object (alongside `prd`/`designSystem`/`codebaseMap`/`designRoot`): `{ "type": "string", "description": "Repo-owned scenario-testing knowledge/deltas file that flow:scenario reads for overrides (device lifecycle, selector conventions, infra-error classification, platform gotchas). Optional — flow:scenario falls back to its generic protocol when absent. Default: `.ai/scenario-guide.md`.", "default": ".ai/scenario-guide.md" }`.
- **Pattern**: Match `designRoot`'s docstring style (explains what reads it, what happens by default, explicit default value).
- **Gotcha**: `paths` has `additionalProperties: false` — the key must be added inside the existing `properties` block or schema validation rejects any project setting it.
- **Validate**: `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"` exits 0.

### ✅ Task 2: CREATE `plugins/flow/templates/ai-skeleton/scenario-guide.md`

- **Do**: New file, headed `# Scenario Guide — PROJECT_NAME`, with an intro identical in spirit to `release-guide.md`'s ("This file documents ONLY where this project's scenario testing diverges from flow:scenario's generic protocol. An absent or empty file is valid — flow:scenario runs its documented defaults."). Section skeleton (H2 headers, each with 1-2 lines of guiding prose, no filled-in defaults — placeholders only, per the flow plugin's project-agnostic rule): `## Device / platform lifecycle`, `## Test account & reset strategy`, `## Selector strategy overrides`, `## Infra-error classification overrides`, `## Platform-specific gotchas`, `## Scenario-authoring notes`.
- **Pattern**: `plugins/flow/templates/ai-skeleton/release-guide.md` for tone/structure; do NOT bake in any StudyFi-specific example values — this ships to every downstream project.
- **Gotcha**: Must NOT hardcode a "parallel by default" or "sequential by default" opinion in the lifecycle section — just prompt the project to state its own constraint if any.
- **Validate**: Manual read-through; no filled defaults present, every section is a placeholder prompt.

### ✅ Task 3: UPDATE `cli/commands/init.mjs` — template `scenario-guide.md` on scaffold

- **Do**: Add `"scenario-guide.md"` to the `TEMPLATED` array (same `PROJECT_NAME` string-replace treatment as `release-guide.md`). No `CHANGELOG_STUBS`-equivalent transform needed — scenario has no per-provider axis.
- **Pattern**: The existing `release-guide.md` entry in `TEMPLATED`.
- **Validate**: `node cli/bin/maude.mjs init --name TestProj --dry-run` (or a real run against a scratch dir) shows `scenario-guide.md` in the write list with `PROJECT_NAME` → `TestProj` substituted.

### ✅ Task 4: UPDATE `plugins/flow/skills/scenario/SKILL.md` — resolve + apply the guide file

- **Do**: Add a new first step to the protocol: resolve `paths.scenarioGuide` (default `.ai/scenario-guide.md`) via the `jq` pattern from Task's "Patterns to Follow"; if the file exists, read it and apply its sections as deltas over the steps that follow (platform lifecycle, selector order, infra-error classification, gotchas); if absent, continue unmodified. Add an explicit line: "Do not create a project-local `.claude/skills/scenario/` wrapper to hold these deltas — write them into the scenario-guide file instead; this skill reads it directly."
- **Pattern**: `release.md`'s resolution step, adapted to "read and apply as context" rather than "walk and execute" (scenario's protocol isn't a linear runbook of bash blocks the way release is — don't force that shape).
- **Gotcha**: Keep this additive/optional in tone — an absent guide file must not degrade or block any existing caller (`plan`/`execute`/`utils-verify`/`validate`/`done`).
- **Validate**: Manual read-through confirms the new step precedes the platform-matrix section and the wrapper-skill deprecation note is present.

### ✅ Task 5: UPDATE `plugins/flow/skills/scenario/SKILL.md` — upstream generic methodology

- **Do**: Add four new subsections to the base protocol, each framed as an advisory default a project's `scenario-guide.md` can override: (a) prefer stable locators (testID/`data-testid`) over coordinates when authoring new assertions; (b) tiered selector reach-order — stable locator → accessible name/text → vision-based check, with vision always advisory-only (never gates a pass/fail on its own); (c) an infra-error-vs-product-fail exit-code convention (a reserved non-zero exit code the runners can use to signal environment/flake failures that should not count as regressions — do not force a specific numeric value if one isn't already implied elsewhere in this plugin; document the convention and let `scenario-guide.md` bind it to a concrete code per project); (d) the collaborative `new <scenario-name>` authoring loop — announce → act → screenshot → co-design-asserts with the user → stop, one step at a time, rather than generating a full scenario unattended.
- **Pattern**: AI-StudyMate `.claude/skills/scenario/SKILL.md` §0, §3, §4, §7 — read for the *shape* of the methodology, do not copy StudyFi-specific function/tool names (`ab_testid`, `assert_vision`, etc.) into the generic plugin.
- **Gotcha**: These are defaults, not mandates — the flow plugin is project-agnostic (existing memory: never bake opinionated stack values into it). Phrase each as "unless the project's scenario-guide says otherwise."
- **Validate**: Manual read-through; confirm no StudyFi-specific identifier leaked into the generic file.

### ✅ Task 6: UPDATE `plugins/flow/commands/scenario.md`

- **Do**: Add a short paragraph referencing the new resolution mechanism (point to the skill's step, don't duplicate the full explanation — `scenario.md` is a thin dispatcher, same relationship it has to the rest of the protocol today).
- **Pattern**: How `release.md` briefly states its provider-agnostic-by-design framing without re-explaining the whole walker mechanism inline.
- **Validate**: Manual read-through.

### ✅ Task 7: UPDATE `plugins/flow/agents/scenario-runner.md`

- **Do**: Before the agent computes platform/lifecycle scope from its table, add a step to resolve and read `paths.scenarioGuide` if present, and apply any lifecycle/selector/infra-error overrides it declares.
- **Pattern**: Task 4's resolution step, same snippet.
- **Gotcha**: This is the piece that actually executes scenarios — the sequential-vs-parallel device lifecycle override (AI-StudyMate's RAM-constrained-host case) has to land here, not just in the skill doc, or it's dead documentation.
- **Validate**: Manual read-through confirms the override step precedes platform-scope computation.

### ✅ Task 8: UPDATE `plugins/flow/templates/ai-skeleton/scenarios/README.md` — cross-link

- **Do**: Add one line near the top pointing to `../scenario-guide.md` (or the resolved `paths.scenarioGuide` path) and clarifying the split: this file documents the `.ai/scenarios/` directory *layout* convention; `scenario-guide.md` documents *behavioral deltas* from the generic protocol.
- **Pattern**: Keep this file's existing scope (layout, not protocol) — don't merge the two files into one.
- **Validate**: Manual read-through.

---

## Migration recipe (AI-StudyMate — external repo, not executed by this plan)

Run as a follow-up from a session rooted in `/Users/iagh/git/AI-StudyMate` once the flow-plugin changes above are released:

1. `maude config set paths.scenarioGuide .ai/scenario-guide.md` (or just create the file at the default path — same value).
2. Create `.ai/scenario-guide.md` from `.claude/skills/scenario/SKILL.md`'s §1 (sequential device lifecycle + RAM rationale), §2 (`agent-qa@studyfi.com` reset/fixture system, pointing at the existing `qa-test-user` skill rather than duplicating it), §5 (`bin/scenario` CLI + `_lib/` substrate pointer), and §6 (the ~150-line platform gotchas log) — these are the genuinely repo-specific sections.
3. Drop §0/§3/§4/§7 from the new file entirely — once Task 5 lands, those are upstreamed into `flow:scenario`'s own protocol and no longer need repo-local restating.
4. Delete `.claude/skills/scenario/` (the whole directory — it was pure documentation, no runnable code lived there per the research).
5. Spot-check one existing scenario run (`appbar-avatar`, called out as their reference/cleanest case) end-to-end to confirm `flow:scenario` picks up the new guide file's sequential-lifecycle override correctly.

---

## Validation

This repo has no test suite, lint config, or build step (per root `CLAUDE.md`) — validation here is schema/doc correctness, not a CI pipeline.

1. **Schema validity**: `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"`
2. **Scaffold dry run**: `node cli/bin/maude.mjs init --name TestProj --dry-run` against a scratch directory — confirm `scenario-guide.md` appears in the write plan with `PROJECT_NAME` substituted, and doesn't error against the schema.
3. **Config resolution**: in that scratch dir, `maude config get paths.scenarioGuide` returns `.ai/scenario-guide.md`.
4. **Cross-doc consistency**: grep `plugins/flow/{skills/scenario/SKILL.md,commands/scenario.md,agents/scenario-runner.md}` for the `jq -r '.paths.scenarioGuide` snippet — must match verbatim across all three (copy-paste drift is the main risk in a doc-only change).
5. **No opinionated leakage**: grep the new `scenario-guide.md` template and the upstreamed SKILL.md sections for StudyFi-specific identifiers (`studyfi`, `agent-qa@`, `ab_testid`, `Auth0`, `Expo`) — must return nothing.
6. **Manual**: read all five touched/created flow-plugin files end-to-end once, checking that an absent guide file still leaves every existing caller (`/flow:plan`, `/flow:execute`, `/flow:utils-verify`, `/flow:validate`, `/flow:done`) working exactly as before — this is the regression risk since those commands aren't touched but depend on scenario-runner's behavior.

---

## Acceptance Criteria

- [x] All 8 tasks completed
- [x] `paths.scenarioGuide` schema key added, valid JSON, default `.ai/scenario-guide.md`
- [x] `scenario-guide.md` ai-skeleton template created, scaffolded via `maude init` with `PROJECT_NAME` substitution, zero opinionated defaults baked in
- [x] `flow:scenario` SKILL.md resolves + applies the guide file when present, degrades to today's behavior when absent (no regression for existing adopters with no guide file)
- [x] `scenario-runner` agent resolves + applies the guide file before computing platform/lifecycle scope (not just documented in the skill — actually wired into the orchestrator)
- [x] SKILL.md explicitly states the wrapper-skill pattern is no longer needed
- [x] 4 generic methodology pieces upstreamed as advisory defaults (testID-first, tiered selector w/ vision-advisory-only, infra-error-vs-product-fail exit convention, collaborative authoring loop)
- [x] `scenarios/README.md` (layout doc) cross-linked with the new guide file (behavioral doc) — scopes stay distinct, not merged
- [x] Migration recipe documented for AI-StudyMate (this plan does not execute it — separate repo, separate session)
- [x] DDR recorded for this architecture decision during `/flow:done` (generic-skill + repo-owned-knowledge-file is now used twice — release and scenario — worth capturing as a named pattern before a third adopter reinvents it again)
- [x] Code follows existing flow-plugin conventions (name/category frontmatter unchanged, no new bare-verb files, `<plugin>:<slug>` naming untouched since no new commands are added)

## Retro

- **What worked**: Spawning two parallel Explore agents at planning time (one per repo) surfaced a finding neither a single pass nor a quick skim would have caught — 4 of AI-StudyMate's 8 "repo-specific" delta sections turned out to be generic methodology reinvented from scratch, which became its own upstreaming task (Task 5) rather than being folded silently into the guide-file mechanism (Tasks 1–4/6–8). Treating those as separately scoped tasks made the plan easier to verify task-by-task.
- **What worked**: Deliberately checking whether `paths.scenarioGuide` should mirror `paths.designRoot` (explicit skeleton value) or `integrations.changelog.releaseGuide` (skeleton-absent, runtime-fallback-only) — rather than assuming — caught what looked like a bug (`maude config get` returning `(unset)`) but was actually the correct, precedented behavior. Worth the extra `config get` comparison call before treating it as a defect.
- **What worked**: The full security fan-out (security-auditor + ethical-hacker + code-simplifier) on what looked like a "just documentation" change surfaced two genuinely useful, cheap improvements (the `infra_errors` output field, the DDR's Security review section) that wouldn't have occurred to me unprompted — the gate paid for itself even on a low-risk diff.
- **What to change next time**: The security-auditor agent went idle without ever sending its findings message — had to be explicitly re-prompted via `SendMessage` to retrieve a report it had apparently already finished. Worth treating "idle without a report" as a signal to proactively re-request rather than assuming a message is still in flight.
- **What to change next time**: The AI-StudyMate migration (deleting their wrapper skill, moving repo-specific content into their own `.ai/scenario-guide.md`) is real follow-up work living in a different repo — this plan documented the recipe but didn't (and couldn't, from this session) execute or verify it. A future `/flow:plan` in AI-StudyMate itself should pick this up rather than assuming it happens automatically.
