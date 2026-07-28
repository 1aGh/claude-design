# DDR-030: Security review = a defender + an attacker, not a single auditor

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** flow, security, agents, subagent-architecture, owasp, llm-top-10, ai-safety, prompt-injection, mcp
- **Related:** [`.ai/plans/security-agents-suite.md`](../plans/security-agents-suite.md) (this plan), [DDR-006](./DDR-006-plugin-namespace-in-name-frontmatter.md) (`name:` namespacing), `plugins/flow/skills/security-rules/SKILL.md` (rule catalog)

## Context

Pre-this-plan the flow plugin had **zero** dedicated security subagents. `/flow:review-code` mentioned "security concerns" in one bullet; `/flow:done`'s audit pass referenced "security" as one of four lenses. Meanwhile every other quality dimension already had: a rules skill, a dedicated subagent, a standalone slash-command sibling, and a hook into the parent validator. The shape was proven (`a11y-rules` + `a11y-auditor` + `/flow:validate-a11y` + `/flow:validate` step 5; same for `design-system-guard`, `scenario-runner`, `test-coverage`).

So we needed *one* agent shaped like `a11y-auditor`. Easy decision — except for the AI-era surface.

Downstream projects on this plugin routinely wire Claude Code to Gmail / Slack / web-fetch / shell MCP servers. That stack has its own threat model — prompt injection in tool returns, MCP tool-description poisoning, confused-deputy across MCPs, Simon Willison's trifecta (private data + untrusted content + exfil channel in one agent loop). These do not show up in static grep. They show up in **threat modelling**: enumerate trust boundaries, ask "what could an attacker put here", trace it forward, look for the chain.

That activity is structurally different from "scan the diff for ✘ patterns from a catalog". The defender mindset converges on *known-bad*. The attacker mindset diverges into *unknown-bad*. Asking one agent to do both produces what we always get from one-agent-does-everything: convergent, checklist-shaped output that reads thorough and misses the chain.

## Decision

**Security review in the flow plugin is two subagents, not one.**

1. **`security-auditor`** — the defender. Read-only `Read, Bash, Grep, Glob`. Scope: changed files. Method: regex catalog + secret entropy scan + dependency-surface diff. Output: OWASP-class findings against `security-rules` §A, JSON block + per-branch markdown report. Cited rule numbers; severity-bounded; replaces the prior single-bullet "security concerns" mention with a real audit.
2. **`ethical-hacker`** — the attacker. Read-only `Read, Bash, Grep, Glob, WebSearch`. Scope: the diff + the active plan + (if present) the defender's report. Method: STRIDE-lite trust-boundary enumeration, **mandatory** AI/MCP attack-surface section (the trifecta check is non-optional), chain-finding pass against the defender's medium findings, one "creativity finding" expected per review. Persona prompt is explicit about adversarial framing: *"You score points for findings nobody else thought of."* Output: attacker-narrative report + JSON block, with `exploit_chains` as the headline metric.

Both run **in parallel** from `/flow:validate-security`, `/flow:validate` step 6.5, and `/flow:review-code`. Reports aggregate to `.ai/logs/security-reviews/<branch>-<ts>.md`. Gate: `blockers ≥ security.severityFloor` from `.ai/workflows.config.json` (default `medium`).

A11y- and design-system-style **rules skill** (`security-rules`) underpins both. §A is the OWASP-derived classic-AppSec catalog. §B is the AI-era catalog — prompt injection (direct + indirect), the trifecta, MCP tool poisoning, confused deputy, excessive agency, output handling, secret leakage via context, training contamination, jailbreak resilience. Config switch `security.includeAi` (default `true`) lets backend-only projects skip §B without disabling the defender.

## Why a pair and not one bigger agent

1. **Different cognitive modes don't merge well in one prompt.** "Walk the rule catalog" and "find what nobody thought of" compete inside one context. We tried (mentally) the single-prompt version: the AI/MCP section always degraded into checklist phrasing under the gravity of the §A bullets. Two agents = two prompts = two modes that don't dilute each other.

2. **Independent verification is the point.** The attacker reads the defender's report and tries to chain its mediums into a higher-severity composite. That review-the-reviewer move only works if the two outputs come from different agent loops with different scope and different bias. Same-agent self-review is a worse signal — confirmation bias is structural in a single context.

3. **The runtime cost is irrelevant.** Both agents are read-only, run in parallel, and finish in seconds. There is no operational reason to merge them — and a real cost (the dilution above) to merging them.

4. **The shape matches industry red-team/blue-team convention.** Pentest reports come from teams set up to think attacker-first. Security audits come from teams set up to think compliance-first. Both exist because the work is genuinely different. Mirroring that split in the agent layer was the lower-surprise design.

## Alternatives considered

- **Single `security-auditor` covering both §A and §B.** Rejected — the AI/MCP section needs adversarial framing that does not survive co-existence with rule-catalog prose. Also defeats the chain-review move.
- **Defender only; ask the human to threat-model.** Rejected — the project ships into orgs where the *human* often *is* the model in production (vibe-coding, autonomous loops). Threat-modelling has to be in the agent loop or it doesn't happen.
- **Three agents (defender, AI-attacker, classic-attacker).** Rejected — the AI/MCP and classic-chain passes overlap enough that one attacker agent with both lenses in its prompt produces a stronger composite. Three would be over-fitting.
- **Hook into an external tool (Semgrep, CodeQL, Snyk).** Considered for §A's static-grep work. Rejected for v1 — adds a dependency and a config burden inconsistent with the plugin's zero-dep ethos. Future DDR may revisit: a `security.providers.static` config knob letting projects swap the grep catalog for a real SAST runner, with the LLM-side `ethical-hacker` unchanged. Out of scope for this plan.

## Consequences

- **Plugin surface grows by 4 files** (1 skill, 2 agents, 1 command) + 2 schema keys (`security.*` top-level + `skills.securityRules.enabled`) + 4 doc edits (`validate.md`, `review-code.md`, `done.md`, `CATEGORIES.md`).
- **`/flow:validate` gets slower** by the round-trip of two parallel subagents. On markdown-only / config-only diffs the defender returns near-instantly; on real code diffs the attacker is the latency bottleneck (it reads the plan + diff + defender report).
- **Reports accumulate under `.ai/logs/security-reviews/`** — periodic `/flow:maintain-clean` should sweep older than ~30 days (out of scope for this plan; track as a follow-up if it becomes an issue).
- **Downstream projects get sane defaults** via the updated template `workflows.config.json` — `security.severityFloor: "medium"`, `security.includeAi: true`, `skills.securityRules.enabled: true`. Backend-only services flip `includeAi: false` to skip §B; everyone else gets the AI/MCP pass for free.
- **The attacker's mandatory AI/MCP section means every review touches the trifecta question** — even when the change has no model surface ("N/A — no model/MCP surface touched"). Silent omission is a failure mode the agent prompt explicitly rejects.

## Open questions / future work

- **Static SAST integration** (Semgrep / CodeQL) behind a `security.providers.static` config knob — would extend the defender's catalog without changing the attacker. Noted; not scoped here.
- **`/flow:maintain-clean` sweep policy** for `security-reviews/`. Probably fine to merge into the existing log-cleanup pass; revisit if logs balloon.
- **Live-fire smoke** of `/flow:validate-security` in a scratch project (per the plan's Task 12) is recommended pre-`/done` but was deferred from the autonomous execute. Mentioned in plan retro.
