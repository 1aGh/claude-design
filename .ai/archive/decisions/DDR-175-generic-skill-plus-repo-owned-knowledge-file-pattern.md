# DDR-175: Generic skill + repo-owned knowledge file — the pattern for letting a project override flow-plugin protocol without a wrapper skill

**Status:** Accepted
**Date:** 2026-07-15
**Tags:** flow-plugin, scenario, release, config-schema, extensibility, project-agnostic
**Related canvas:** —

## Context

`/flow:release` has always worked a particular way: the command itself is a generic, project-agnostic Markdown walker (parse `##` headings as steps, ` ```bash ` blocks as candidate commands, confirm-before-run), and every actual release-specific fact — which command bumps the version, how tags are pushed, what "publish" means for this project — lives in one repo-owned file, `.ai/release-guide.md` (path configurable via `integrations.changelog.releaseGuide`). Adding a new release provider is a documentation change to that file, never a code change to `release.md`.

`flow:scenario` never had an equivalent. Its entire protocol — the 5-platform matrix, tooling choice, selector reach-order, parallelization rule, skip-cache logic — is baked directly into the plugin's own `plugins/flow/skills/scenario/SKILL.md`. There was no config hook and no file convention for a project to declare "here's how scenario testing is different for us." When AI-StudyMate needed exactly that (a RAM-constrained host that can't run devices in parallel, its own test-account/reset system, app-specific selector conventions, ~150 lines of Expo/RN/Auth0 platform gotchas), the only escape hatch available was to hand-author a full project-local skill package under `.claude/skills/scenario/SKILL.md`. Their own DDR-021 documents this as a deliberate minimization ("integrate, don't fork") forced by the absence of a lighter mechanism — not a preference for building a wrapper skill, but the only tool available at the time.

That wrapper pattern has real costs the release-guide.md pattern doesn't: it requires `.claude/skills/<name>/SKILL.md` frontmatter/registration ceremony a plain knowledge file doesn't need; nothing in `scenario.md`/`scenario-runner.md` discovers or reads it, so it only works because a human happens to know to point an agent at it; and it has already needed one manual consolidation in that repo (an earlier `scenario-copilot` skill was merged into it) — a sign the wrapper-skill route tends to multiply files rather than converge.

Researching AI-StudyMate's wrapper also surfaced a second finding: of its 8 delta sections, 4 (testID-first/stable-locator authoring, a tiered selector reach-order with vision as an advisory-only last resort, an infra-error-vs-product-fail classification, and a step-by-step collaborative scenario-authoring loop) were **generic methodology re-derived from scratch**, not anything StudyFi-specific — they existed only because `flow:scenario` didn't document them anywhere. The other sections (sequential device lifecycle, their own test-account/reset system, their own CLI + bash substrate, the platform-specific gotchas log) are irreducibly tied to that project's stack and hardware.

## Alternatives considered

- **Option A — leave scenario as-is, let downstream projects keep writing wrapper skills.** Pros: zero plugin change. Cons: every project with unusual needs re-derives the same escape hatch, the generic methodology AI-StudyMate had to reinvent never reaches other adopters, and the wrapper skill is invisible to `scenario.md`/`scenario-runner.md` — it only helps because a human remembers it exists.
- **Option B — literally reuse `release.md`'s mechanical Markdown-walker shape for scenario** (parse headings as steps, execute bash blocks in order). Rejected: scenario isn't a linear runbook the way release is — its "protocol" is a platform matrix, tooling choices, and a report generator, not a sequence of shell commands a human confirms one at a time. Forcing that shape would either under-serve scenario's real needs or turn the guide file into something release's walker was never designed to interpret.
- **Option C (chosen) — adopt the pattern's *spirit*, not its literal mechanics: add `paths.scenarioGuide` (mirroring `integrations.changelog.releaseGuide`), scaffold a generic per-repo knowledge-file template via `maude init`, and teach the skill/command/agent trio to resolve and apply it as optional deltas — while upstreaming the genuinely generic methodology AI-StudyMate reinvented directly into the base protocol, so future adopters get it for free.** Pros: one config key, one file convention, no wrapper-skill ceremony, and the mechanism generalizes to any future flow-plugin skill that needs the same escape hatch. Cons: unlike release's guide, scenario's guide is optional rather than required — that asymmetry has to be documented clearly so it doesn't read as an inconsistency.

## Decision

We pick **Option C** because it's the second time this repo has needed "let a project override generic plugin protocol without a wrapper skill," and the shape that worked for release generalizes cleanly: a `paths.*`/`integrations.*` config key pointing at a repo-owned Markdown file, a generic `ai-skeleton` template for it, and the consuming skill/command/agent resolving it with a `// default` fallback so an absent file is always valid.

Key asymmetry, made explicit rather than left implicit: `release.md` treats its guide as **required** (refuses to run without one — release has no meaningful generic default, every project's release process is genuinely different). `flow:scenario` treats its guide as **optional** (falls back to a documented, sufficient generic protocol — most projects don't need to override anything). Future adopters of this pattern should decide required-vs-optional deliberately, not copy whichever precedent they saw first.

Implementation: `plugins/flow/.claude-plugin/config.schema.json` gained `paths.scenarioGuide` (default `.ai/scenario-guide.md`); `plugins/flow/templates/ai-skeleton/scenario-guide.md` is the new skeleton (6 placeholder sections: device/platform lifecycle, test-account & reset strategy, selector-strategy overrides, infra-error classification overrides, platform-specific gotchas, scenario-authoring notes — zero opinionated defaults, per this plugin's existing project-agnostic rule); `cli/commands/init.mjs`'s `TEMPLATED` list scaffolds it with `PROJECT_NAME` substitution; `plugins/flow/skills/scenario/SKILL.md` gained a resolution step + an explicit "don't build a wrapper skill for this" note, plus the 4 upstreamed generic-methodology pieces; `plugins/flow/commands/scenario.md` and `plugins/flow/agents/scenario-runner.md` each reference the same resolution mechanism, with the agent's version sitting before scope-decision computation since it's the piece that actually has to honor a lifecycle override.

## Consequences

**Positive:**
- No project ever needs to author a `.claude/skills/scenario/` wrapper again — a plain Markdown file, discovered automatically, does the job.
- The 4 generic-methodology pieces AI-StudyMate reinvented (testID-first, tiered selector w/ advisory vision, infra-error classification, collaborative authoring) now ship with the plugin itself.
- The pattern is now named and precedented twice (release, scenario) — the next flow-plugin skill that needs the same escape hatch has an established shape to follow instead of reinventing a third variant.

**Negative / trade-offs:**
- Two now-precedented variants of the same idea (required-guide vs optional-guide) means a future contributor has to actually read this DDR to know which one to copy — it isn't self-evident from the code alone.
- AI-StudyMate's actual migration off its wrapper skill is not automatic — it's a manual follow-up (recipe documented in `.ai/plans/feature-flow-scenario-knowledge-file.md`) executed from that repo, not this one. Until that migration runs, their wrapper skill and the new guide-file mechanism coexist redundantly (harmless, but worth closing out).
- `scenario-runner.md`'s guide-resolution step is the one place where an override has real behavioral teeth (the sequential-vs-parallel device lifecycle) — a future edit to that agent that doesn't preserve the resolution step would silently regress any project relying on the override, with no test to catch it (this repo has no test suite covering flow-plugin markdown content).

## Security review

`security-auditor` (defender) and `ethical-hacker` (attacker) both reviewed this DDR's implementation before commit. Verdict: **0 blockers**, ship. Summary: `.ai/scenario-guide.md` is read into a `Bash`-holding agent's (`scenario-runner`) context the same way CLAUDE.md, `.ai/release-guide.md`, and runner scripts under `.ai/scenarios/<name>/runners/` already are — same repo-write trust boundary, no new capability, no path-traversal risk beyond the pre-existing `paths.*`/`integrations.changelog.releaseGuide` pattern this DDR copies. Two non-blocking notes worth carrying forward as review discipline, not code:

- **A `scenario-guide.md` edit is a "can steer agent Bash" change, not a docs change.** It should get the same PR-review scrutiny as a `.ai/scenarios/<name>/runners/*.sh` script — a "reset strategy" or "gotchas" section is plausible camouflage for an instruction to run something else, precisely because the agent legitimately runs `simctl`/`adb`/`agent-*` shell commands as part of a normal scenario run. This is the same review burden CLAUDE.md and release-guide.md already carry; it doesn't need a new mechanism, just the same care applied consistently.
- **The `infra-error` classification (see the scenario skill's "Infra-error vs product-fail classification") is a legitimized gate-softening channel.** A guide or runner that broadens what counts as "infra-error" quietly neuters the `/flow:validate`/`/flow:done` scenario gate — a reviewer may wave it through as a flake-tolerance tweak. `scenario-runner`'s output JSON contract now carries an explicit `infra_errors` count (separate from `blockers`) so a caller — or a human skimming a run history — can notice a step that flipped `fail` → `infra-error` between runs, rather than that softening happening silently inside the `results` map.

## Revisit when

A third flow-plugin skill needs the same "let a project override generic protocol" escape hatch — at that point, decide explicitly (not by default) whether its guide should be required (release's posture) or optional (scenario's posture), and whether a shared resolution helper (rather than copy-pasted `jq` snippets across 3 files) is worth adding.

## Linked
- Plan: `.ai/plans/feature-flow-scenario-knowledge-file.md`
- PRD: —
- Supersedes: —
