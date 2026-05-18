# Feature: Security review agents (suite) — `security-auditor` + `ethical-hacker`

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports in `plugins/flow/`.

## Description

Add two security review subagents to the `flow` plugin: a **defender** (`security-auditor`) doing OWASP/AppSec checks, and an **attacker** (`ethical-hacker`) doing adversarial threat modeling that explicitly covers modern AI attack surface — prompt injection, MCP tool poisoning, confused-deputy across MCP servers, indirect injection via untrusted content (emails, web pages, file contents). Wire them into `/flow:validate` and `/flow:review-code` so security review is part of the standard gate, not an ad-hoc human step.

## User Story

As a developer running `/flow:validate` before shipping a change, I want automatic security review that catches both classic vulnerabilities (SQL injection, secrets, broken auth) **and** AI-era ones (prompt injection in tool outputs, MCP supply-chain risk, agent confused-deputy) so I don't merge a change that turns a friendly Gmail MCP into an exfiltration channel.

## Problem

Today the flow plugin has zero security agents. `/flow:review-code` mentions "security concerns" in a single bullet (`plugins/flow/commands/review-code.md:84`) and `/flow:done`'s audit pass references "security" as one of four lenses (`plugins/flow/commands/done.md:43`), but there is no:

- Dedicated security subagent (compare: `a11y-auditor`, `design-system-guard`, `scenario-runner`, `test-coverage` all exist).
- Hard-stop rule catalog (compare: `a11y-rules`, `testing-rules`, `motion-rules`, `responsive-rules` skills exist).
- Slash command for standalone security audit (compare: `/flow:validate-a11y`, `/flow:validate-visual` exist).
- Any mention of AI-specific threats (prompt injection, MCP tool poisoning, indirect injection) anywhere in the plugin — yet downstream projects routinely wire Claude Code to Gmail / Slack / web fetch / shell MCPs, all of which carry these risks.

## Solution

Mirror the existing `a11y` pattern (skill + agent + standalone command + parent-validate hook), but with two agents instead of one — a defender and an attacker — and a single shared rules skill covering classic + AI hard-stops. Adversarial creativity is explicitly demanded in the `ethical-hacker` prompt; without that, agents drift to checklist work and miss the chained / out-of-the-box findings the user asked for.

## Metadata

- **GitHub Issue**: none (user request via chat)
- **Type**: New Capability
- **Complexity**: Medium
- **App/Package**: `plugins/flow` (single plugin scope)
- **Affected Systems**: flow agents, skills, commands, config schema, CATEGORIES doc
- **Dependencies**: none (zero-dep, pure markdown additions + small schema diff)

---

## Context References

### Must-Read Files

- `plugins/flow/agents/a11y-auditor.md` (full) — Why: canonical agent shape we're mirroring (frontmatter, tools, hard-stop checklist format, project-specific notes section).
- `plugins/flow/agents/scenario-runner.md` (full) — Why: shows the orchestrator pattern (pre-flight, run protocol, output JSON to caller, anti-patterns).
- `plugins/flow/agents/design-system-guard.md` — Why: read-only audit agent template; closest peer for `security-auditor`.
- `plugins/flow/agents/test-coverage.md` — Why: another read-only audit; check its tools/auth pattern.
- `plugins/flow/skills/a11y-rules/SKILL.md` (full) — Why: rules-skill format (✘/✔ bullets, sections, config-driven enable flag).
- `plugins/flow/skills/testing-rules/SKILL.md` — Why: second example of rules-skill prose, for tone consistency.
- `plugins/flow/commands/validate.md` (lines 21–95) — Why: where we hook into the pipeline (after step 6, before doc-drift step 7).
- `plugins/flow/commands/review-code.md` (lines 70–110) — Why: existing "security" mention to deepen, not duplicate.
- `plugins/flow/commands/validate-a11y.md` — Why: shape of a standalone validator sibling command (`/flow:validate-security` mirrors it).
- `plugins/flow/CATEGORIES.md` (full) — Why: must add new entry under `validate` group; naming convention is strict.
- `plugins/flow/.claude-plugin/config.schema.json` (lines 227–260 — `skills` block; lines 60–95 — top-level `boundaries`) — Why: where new `security` + `skills.securityRules` entries land.
- `plugins/flow/.claude-plugin/plugin.json` — Why: confirm whether new skill/agent/command needs explicit registration (current convention: auto-loaded from `agents/`, `skills/`, `commands/` directories — verify before adding).

### Files to Create

- `plugins/flow/skills/security-rules/SKILL.md` — Hard-stop rule catalog: §A Classic AppSec (OWASP-aligned), §B AI-era (prompt injection, MCP threat surface, agent confused-deputy).
- `plugins/flow/agents/security-auditor.md` — Defender subagent. Static + grep-driven scan over changed files. Reports OWASP-class findings.
- `plugins/flow/agents/ethical-hacker.md` — Attacker subagent. Threat-models the feature, chains findings, must include AI/MCP attack surface section. Prompt explicitly demands adversarial creativity, not checklist work.
- `plugins/flow/commands/validate-security.md` — Standalone command: spawn both agents, aggregate to a single report at `.ai/logs/security-reviews/<branch>.md`.

### Files to Update

- `plugins/flow/.claude-plugin/config.schema.json` — Add `skills.securityRules.enabled` (mirrors a11y), add top-level `security` object: `{ severityFloor: "low"|"medium"|"high"|"critical", scope: [string], includeAi: bool }`.
- `plugins/flow/commands/validate.md` — Insert "Step 6.5 Security" between current step 6 (design consistency) and step 7 (doc/decision drift). Hard-fail on `blockers > 0` for severity ≥ floor.
- `plugins/flow/commands/review-code.md` — Replace single-bullet "security concerns" line (line 84) with explicit "spawn `security-auditor` + `ethical-hacker` subagents" step under §3 Review.
- `plugins/flow/commands/done.md` — Audit pass (line 43) mentions security; tighten to reference the new agents.
- `plugins/flow/CATEGORIES.md` — Add `/flow:validate-security` row to the `validate` group table.
- `plugins/flow/commands/help.md` — If help is hand-maintained, add the new command; if auto-generated from frontmatter (verify), no edit needed.
- `plugins/flow/templates/ai-skeleton/.ai/workflows.config.json` (if exists) — Seed default `security` block so downstream `mdcc init` projects get sane defaults.

### Documentation

- [OWASP Top 10 2021](https://owasp.org/Top10/) — Why: canonical classic-AppSec taxonomy the `security-auditor` cites.
- [OWASP LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) — Why: canonical taxonomy for the AI section of `security-rules` and the `ethical-hacker` agent. LLM01 (prompt injection), LLM02 (insecure output handling), LLM05 (supply chain), LLM08 (excessive agency) are the load-bearing ones.
- [Anthropic — Prompt injection guidance](https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) — Why: official mitigation guidance the rules skill should cite.
- [Simon Willison — "Trifecta" of prompt injection danger](https://simonwillison.net/2024/Dec/22/prompt-injection-explained/) — Why: clearest articulation of "access to private data + exposure to untrusted content + ability to exfiltrate" — the heuristic the ethical-hacker should use to score MCP combinations.
- [MITRE ATLAS](https://atlas.mitre.org/) — Why: adversarial ML tactics; cite once for breadth in `ethical-hacker` prompt.

### Patterns to Follow

**Agent frontmatter pattern** (from `plugins/flow/agents/a11y-auditor.md`):
```yaml
---
name: flow:<slug>
description: <one-line, used by Claude Code to auto-route>
tools: Read, Bash, Grep, Glob   # read-only by default; never include Edit/Write for audit agents
---
```

**Skill frontmatter pattern** (from `plugins/flow/skills/a11y-rules/SKILL.md`):
```yaml
---
name: flow:<slug>
description: <hard-stop scope, config keys consumed, when to use>
user-invocable: false   # rules skills are auto-loaded, never typed by the user
---
```

**Rules skill body shape** — every section uses `✘ NEVER` / `✔ DO` bullets. Group by domain (Color Contrast / Image Alt / Keyboard / …). The same shape applies here (Injection / Secrets / AuthN / … for classic; Prompt Injection / Tool Poisoning / Confused Deputy / … for AI).

**Output-to-caller JSON** (from `plugins/flow/agents/scenario-runner.md` lines 65–80):
```
{
  "report_path": ".ai/logs/security-reviews/<branch>-<ts>.md",
  "blockers": <int — count of findings at severity >= floor>,
  "warnings": <int — count below floor>,
  "by_category": { "classic.injection": N, "ai.prompt-injection": N, ... },
  "exploit_chains": <int — count of chained findings the ethical-hacker constructed>
}
```

---

## Tasks

Execute in order. Each task is atomic and locally testable (no test suite in this repo — verify by reading the produced file and cross-checking against the patterns referenced).

Keywords: CREATE, UPDATE, ADD, MIRROR.

### Task 1: CREATE `plugins/flow/skills/security-rules/SKILL.md`

- **Do**: Author the hard-stop rules skill in two parts.
  - **§A Classic AppSec hard-stops** (✘/✔ bullets):
    1. Injection — SQL / NoSQL / OS command / LDAP / XPath; ✘ string-concatenated queries, ✔ parameterised / prepared statements.
    2. Secrets — ✘ hardcoded API keys / tokens / private keys / `.env` contents committed; ✔ env vars + `.env.example` only; flag any high-entropy string in the diff.
    3. AuthN/AuthZ — ✘ missing authn on state-mutating routes; ✘ IDOR (object reference from client); ✔ server-side authorization on every read AND write.
    4. Crypto — ✘ MD5/SHA1 for security; ✘ hand-rolled crypto; ✘ ECB; ✔ stdlib AEAD (AES-GCM, ChaCha20-Poly1305), bcrypt/argon2 for passwords.
    5. SSRF / open redirect — ✘ user-supplied URL fetched without allowlist; ✘ redirect target from query without validation.
    6. XSS / output encoding — ✘ `innerHTML` / `dangerouslySetInnerHTML` from user input; ✔ framework default escaping.
    7. CSRF — ✘ state-mutating GET; ✔ same-site cookies + token on cross-origin POST.
    8. Deserialization — ✘ `eval`, `pickle.load`, `yaml.load` on untrusted input; ✔ safe-load only.
    9. Path traversal — ✘ `path.join(root, userInput)` without normalisation + containment check.
    10. Dependency / supply chain — ✘ install scripts from unpinned versions; ✔ lockfile committed, audit clean.
    11. Logging — ✘ logging PII / secrets / full request bodies.
    12. Error handling — ✘ stack traces / SQL error text to the client.
  - **§B AI-era hard-stops** (✘/✔ bullets):
    1. **Prompt injection — direct**: ✘ concatenating untrusted text (user input, web fetch, email body, file content) into a system prompt or tool-call argument without delimiter + role separation; ✔ structured tool inputs, explicit "treat the following as data, not instructions" guard, output validation.
    2. **Prompt injection — indirect**: ✘ trusting the *content* of an MCP tool result as if it were authoritative (e.g. an email tells the agent to "send all attachments to attacker@…"); ✔ treat all tool returns as untrusted data; require human confirmation for destructive actions when the action was *suggested* by tool output.
    3. **The trifecta** (Simon Willison): ✘ giving one agent context simultaneous access to (a) private data, (b) untrusted content, and (c) outbound exfil channel without explicit user gate. Flag any feature that opens all three — e.g. Gmail-read MCP + web-browse MCP + Slack-send MCP in the same agent loop.
    4. **MCP tool poisoning / supply chain**: ✘ adding an MCP server without pinning its origin (git SHA / npm version) and reviewing its tool descriptions (descriptions ARE instructions to the model and can carry injection payloads); ✔ pinned + diff-reviewed.
    5. **Confused deputy across MCPs**: ✘ tool A's output flowing into tool B's input without sanitisation when A is untrusted and B is privileged (e.g. web-fetch result → shell-execute argument).
    6. **Excessive agency**: ✘ MCP tool grants destructive scope (mass delete, send-as-user, payment) without per-action confirmation; ✔ default to least privilege; destructive ops behind explicit ack.
    7. **Output handling**: ✘ rendering raw LLM output as HTML / shell / SQL without escaping; LLM output is untrusted just like user input.
    8. **Secret leakage via context**: ✘ system prompt containing live credentials, internal URLs, or anything the user could exfiltrate by asking the model to recite its instructions.
    9. **Training-data / fine-tune contamination**: ✘ feeding production user data into model training without DPIA / consent (mostly a compliance hard-stop; flag for review).
    10. **Jailbreak resilience**: ✘ relying on prompt-level guardrails alone for safety-critical decisions; ✔ deterministic out-of-band check (allowlist, policy engine) as the final authority.
  - Add config-read line at the top: "Reads `security.severityFloor`, `security.includeAi`, `security.scope` from `.ai/workflows.config.json`. Skip with `skills.securityRules.enabled: false`."
- **Pattern**: `plugins/flow/skills/a11y-rules/SKILL.md` — match the ✘/✔ bullet shape, section numbering, and "Project-specific notes" trailer.
- **Gotcha**: This is a **rules** skill, not a how-to. Each bullet must be enforceable by an agent reading a diff. Avoid prose like "consider whether…". Use `✘ NEVER` / `✔ DO`.
- **Validate**: Read the file end-to-end. Cross-check sections numbered, ✘/✔ format consistent with `a11y-rules`. `grep -c '^- ✘' plugins/flow/skills/security-rules/SKILL.md` should return ≥ 20.

### Task 2: CREATE `plugins/flow/agents/security-auditor.md`

- **Do**: Author the defender agent.
  - Frontmatter `name: flow:security-auditor`, tools `Read, Bash, Grep, Glob` (read-only).
  - Scope: changed files only (read `git diff --name-only` to enumerate; mirror `a11y-auditor`'s scoping).
  - Authority section: cites `security-rules` skill §A as the hard-stop source.
  - Static-scan protocol:
    1. Enumerate changed files.
    2. For each, grep for the §A patterns (regex catalog inline in the agent prompt).
    3. Secret entropy scan: regex for `[A-Za-z0-9_-]{32,}` in changed files, then per-hit decide (whitelist obvious test fixtures).
    4. Dependency surface: if `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` changed, list new deps and flag any with no recent activity / no maintainers / install scripts.
    5. Per finding, emit: `{ severity: "critical|high|medium|low", category: "classic.<bucket>", file, line, snippet, rule, fix }`.
  - Output JSON-block shape per "Output-to-caller" pattern above. Write the human-readable report to `.ai/logs/security-reviews/<branch>-<ts>-defender.md`.
  - Anti-patterns section: ❌ fixing findings (audit-only), ❌ scanning whole repo (changed files only), ❌ false-positive on test fixtures, ❌ silent skip when `severityFloor` blocks the finding.
- **Pattern**: `plugins/flow/agents/a11y-auditor.md` structure (Authority → Protocol → Hard-stop checklist → Project-specific notes → Output).
- **Gotcha**: Read-only — do **not** include `Edit` / `Write` in `tools:`. The agent reports; the human or `/flow:execute` fixes.
- **Validate**: `head -5 plugins/flow/agents/security-auditor.md` shows correct frontmatter. Tools list does NOT contain `Edit` or `Write`.

### Task 3: CREATE `plugins/flow/agents/ethical-hacker.md`

- **Do**: Author the attacker agent. This one is the differentiator the user asked for — out-of-the-box thinking.
  - Frontmatter `name: flow:ethical-hacker`, tools `Read, Bash, Grep, Glob`, `WebSearch` (the hacker needs to look up CVEs / known-bad patterns).
  - **Persona section** (load-bearing — do not skip): explicit prompt language demanding adversarial creativity. Sample (refine in the file): *"You are an experienced ethical hacker hired to break this change. Checklists are a starting point, not the deliverable. You score points for findings nobody else thought of: chained exploits where each link is mundane but the chain is not; abuse of features the developer believed were 'safe'; AI-era attacks the static scanner cannot see (prompt injection in tool outputs, confused-deputy across MCP servers, the trifecta — private data + untrusted content + exfil channel in one agent loop). If you produce only checklist findings, you have failed."*
  - Threat-modelling protocol (STRIDE-lite, but adapted for AI):
    1. Read the active plan (`.ai/plans/<active>.md`) and the diff. Identify trust boundaries the change crosses.
    2. **For each external input** (user request, HTTP body, file upload, MCP tool result, model output, env var) — enumerate "what could an attacker put here, and what would happen next?".
    3. **For each external output** (HTTP response, DB write, MCP tool call, model prompt, shell command, log line) — enumerate "what could the attacker leak into here, and where does it land?".
    4. **AI/MCP-specific lens** (mandatory, regardless of whether the diff names an MCP server):
       - Does the change introduce any tool/function the model can call? → check description-injection risk (description text reaches the model as instructions).
       - Does the change pipe model output into a downstream system (shell, SQL, HTTP, file path)? → output-handling vector.
       - Does the change combine read-private + read-untrusted + write-outbound in the same agent context? → flag the trifecta.
       - For generic MCP classes the project might use (email, chat, files, web-browse, shell, deploy): enumerate per-class injection vectors. (No project-specific MCP list — per the design decision, the agent uses a generic class-based checklist.)
    5. **Chain-finding pass**: for each pair of medium findings from `security-auditor` (read its report if present), attempt to compose them into a higher-severity chain.
  - Output: human-readable report at `.ai/logs/security-reviews/<branch>-<ts>-attacker.md` with sections:
    1. **Threat model** — trust boundaries the change crosses.
    2. **Findings** — each one in attacker narrative form ("I would do X by Y, resulting in Z"), with severity + recommended mitigation.
    3. **Exploit chains** — at least one chain attempt; explicitly state "no viable chain" if none found (not silent absence).
    4. **AI/MCP attack surface** — mandatory section even if empty (say "no MCP/model surface touched — N/A").
  - JSON output block per "Output-to-caller" pattern; key field `exploit_chains` is the headline metric.
- **Pattern**: Tone is the differentiator. `a11y-auditor` and `security-auditor` are checklist auditors. This agent must read like a pentester's notes. Look at `plugins/flow/skills/debugging-rules/SKILL.md` for the "demand creativity, refuse checklist-only" tone if needed.
- **Gotcha**: WebSearch is included so the agent can look up recent CVEs and prompt-injection technique writeups. Do **not** include shell-exec tools beyond `Bash` (and `Bash` is for `git diff` / `grep`, not for running exploits).
- **Validate**: `grep -i "creative\|chain\|out of the box\|trifecta" plugins/flow/agents/ethical-hacker.md` returns ≥ 4 hits. Frontmatter `name:` = `flow:ethical-hacker`. AI/MCP section header present.

### Task 4: CREATE `plugins/flow/commands/validate-security.md`

- **Do**: Standalone command — slot for the `validate` group (mirrors `/flow:validate-a11y`).
  - Frontmatter: `name: flow:validate-security`, `category: validate`, `description: "Security review — spawns security-auditor + ethical-hacker subagents, aggregates report"`, `keywords: [security, owasp, prompt-injection, mcp, threat-model]`.
  - Body:
    1. Pre-flight: read `.ai/workflows.config.json` → check `skills.securityRules.enabled` (default `true`) and `security.severityFloor` (default `"medium"`).
    2. Determine diff scope: `git diff --name-only` (default) or `--since <ref>` arg.
    3. Spawn `security-auditor` subagent. Capture JSON output.
    4. Spawn `ethical-hacker` subagent. Capture JSON output.
    5. Aggregate to `.ai/logs/security-reviews/<branch>-<ts>.md`: TL;DR table → defender findings → attacker findings → exploit chains → AI/MCP surface.
    6. Exit: `blockers > 0 && severity >= floor` → fail; else → pass with warnings.
- **Pattern**: `plugins/flow/commands/validate-a11y.md` for the standalone shape. `plugins/flow/commands/validate.md` step 5 for the spawn protocol prose.
- **Gotcha**: Both subagents must run even if the defender finds blockers — the attacker's chain-finding sometimes reclassifies a defender medium into a chained critical.
- **Validate**: Frontmatter `name:` = `flow:validate-security`, `category:` = `validate`. Command file under 120 lines.

### Task 5: UPDATE `plugins/flow/.claude-plugin/config.schema.json`

- **Do**: Two additions.
  - Add a top-level `security` object (sibling of `motion`, `responsive`, `ux`):
    ```json
    "security": {
      "type": "object",
      "additionalProperties": false,
      "description": "Security review knobs. security-auditor + ethical-hacker read these.",
      "properties": {
        "severityFloor": {
          "type": "string",
          "enum": ["low", "medium", "high", "critical"],
          "default": "medium",
          "description": "Lowest severity that blocks /flow:validate. Findings below this are warnings."
        },
        "scope": {
          "type": "array",
          "items": { "type": "string", "enum": ["classic", "ai", "supply-chain"] },
          "default": ["classic", "ai", "supply-chain"],
          "description": "Which rule families to evaluate. Drop \"ai\" if the project has no model/MCP surface."
        },
        "includeAi": {
          "type": "boolean",
          "default": true,
          "description": "Shortcut to enable/disable §B AI-era rules in security-rules skill. False also short-circuits ethical-hacker's AI/MCP section."
        }
      }
    }
    ```
  - Add `securityRules` to the existing `skills` block (mirror `a11yRules` exactly).
- **Pattern**: `motion` block (lines 130–155) for top-level object shape; `a11yRules` entry inside `skills` (line 248) for the nested-toggle shape.
- **Gotcha**: `additionalProperties: false` at the root of the schema means **the new top-level `security` key must also be declared at the top-level**. Don't add it in a nested location by mistake. Run `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"` to verify the JSON parses after edit.
- **Validate**: `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"` exits 0. `grep -c '"security"' plugins/flow/.claude-plugin/config.schema.json` ≥ 2 (top-level + nested mention).

### Task 6: UPDATE `plugins/flow/commands/validate.md`

- **Do**: Insert new step **6.5 Security** between current step 6 (Design consistency) and step 7 (Doc/decision drift). Prose mirrors steps 5 and 6:
  > ### 6.5 Security
  >
  > **Spawn the `security-auditor` and `ethical-hacker` subagents in parallel.** The defender catches OWASP-class findings against changed files; the attacker threat-models the change for chained exploits and AI/MCP attack surface (prompt injection in tool outputs, confused deputy across MCP servers, the trifecta). Reports aggregate to `.ai/logs/security-reviews/<branch>-<ts>.md`.
  >
  > **Gate:**
  > - Any finding at severity ≥ `security.severityFloor` (default `medium`) → `/flow:validate` fails.
  > - Skip the AI/MCP lens if `security.includeAi: false` in config (e.g. backend-only services with no model surface).
  > - `ethical-hacker.exploit_chains > 0` is informational, never a blocker by itself — but a chain that combines a medium defender finding with a medium attacker finding can promote to high.
- **Pattern**: Step 5 (A11y) and step 6 (Design consistency) in the same file — match the heading depth, the "Spawn the … subagent" phrasing, and the explicit Gate subsection.
- **Gotcha**: Don't renumber existing step 7 (doc-drift) — instead use the `6.5` decimal slot. The file references "step 7" by number elsewhere? Search before editing: `grep -n "step 7\|### 7" plugins/flow/commands/validate.md` and fix any back-references.
- **Validate**: Step 6.5 present; existing step numbering preserved; `grep -n "security-auditor\|ethical-hacker" plugins/flow/commands/validate.md` returns hits.

### Task 7: UPDATE `plugins/flow/commands/review-code.md`

- **Do**: Replace the lone "Validate security concerns with context" bullet (currently line 84) with an explicit subagent spawn:
  > ### Security
  >
  > Spawn `security-auditor` for an OWASP-class pass over the diff, and `ethical-hacker` for adversarial threat modelling (including AI/MCP attack surface — prompt injection, MCP tool poisoning, confused-deputy chains). Both run in parallel; report aggregates to `.ai/logs/security-reviews/<branch>-<ts>.md`. Block the commit if any finding is at severity ≥ `security.severityFloor` (default `medium`).
- **Pattern**: Existing §3 review sections (Correctness, Code Quality, Security, Testing) in the same file — keep the same section-heading depth.
- **Gotcha**: `/flow:review-code` runs **before** `/flow:done`. Don't double-spawn — if the user just ran `/flow:validate-security`, the report path is cached; reuse it (mention this in the prose: "if a fresh report exists for this HEAD, reuse it").
- **Validate**: `grep -n "security-auditor\|ethical-hacker" plugins/flow/commands/review-code.md` returns ≥ 2 hits.

### Task 8: UPDATE `plugins/flow/commands/done.md`

- **Do**: Tighten the existing line 43 audit-pass mention to reference the new subagents by name. Single-line edit: "Audit pass — finds correctness / quality / security / convention findings" → "Audit pass — `security-auditor` + `ethical-hacker` cover security; defender + attacker reports archive into `.ai/logs/security-reviews/`. `/flow:review-code` reuses them if fresh." (or similar — keep the prose terse.)
- **Pattern**: Surrounding lines in `done.md` for tone.
- **Gotcha**: Don't expand the line into a multi-paragraph block — `done.md` is dense already.
- **Validate**: `grep -n "security-auditor" plugins/flow/commands/done.md` returns one hit.

### Task 9: UPDATE `plugins/flow/CATEGORIES.md`

- **Do**: Add one row to the `validate` group table:
  > | `/flow:validate-security` | OWASP-class + adversarial review of the diff. Spawns `security-auditor` + `ethical-hacker`. | Touching auth, payments, untrusted input, or MCP/model surface. |
- **Pattern**: Existing `/flow:validate-a11y` and `/flow:validate-visual` rows directly above.
- **Gotcha**: `/flow:help` parses this file (or the frontmatter — verify which); a typo in the row breaks rendering.
- **Validate**: `grep "validate-security" plugins/flow/CATEGORIES.md` returns one hit; new row's column alignment matches siblings.

### Task 10: UPDATE plugin manifest if required

- **Do**: Open `plugins/flow/.claude-plugin/plugin.json` and verify the convention. If agents/skills/commands are auto-discovered from the directory layout (current evidence suggests yes — `a11y-auditor` etc. are not enumerated by name), no edit needed. If they are explicitly registered, add entries for the new three (`security-auditor`, `ethical-hacker`, `security-rules`, `validate-security`).
- **Pattern**: Whatever the file already does.
- **Gotcha**: If the manifest lists assets explicitly and we forget to register, the new commands will not be available on a fresh install — silent regression.
- **Validate**: `cat plugins/flow/.claude-plugin/plugin.json | jq .` parses; if assets array exists and we're using it, all 4 new entries present.

### Task 11: (Optional) UPDATE `plugins/flow/templates/ai-skeleton/.ai/workflows.config.json`

- **Do**: If the template file exists (verify with `ls plugins/flow/templates/ai-skeleton/.ai/workflows.config.json`), add the `security` block with the defaults from the schema so downstream `mdcc init` projects get sane defaults out of the box. If the template uses ONLY `name` and pulls everything else from defaults, skip this task — the schema defaults will apply.
- **Pattern**: Existing top-level blocks in the template.
- **Gotcha**: Don't add `securityRules` toggle to template — default `true` is correct; explicit listing is noise. Only add the `security` object if the template explicitly seeds analogous top-level blocks (e.g. `motion`, `responsive`).
- **Validate**: Template still parses; downstream `mdcc init` test in `/tmp/scratch-security-test` shows `security` block (or correct defaults from schema).

### Task 12: Local smoke test

- **Do**: From this repo, simulate a downstream invocation:
  1. `cd /tmp && mkdir -p sec-test && cd sec-test && git init`.
  2. `node /Users/iagh/git/claude-design/cli/bin/mdcc.mjs init --name sec-test`.
  3. Inspect `.ai/workflows.config.json` — `security` block present with defaults, OR `skills.securityRules` default-true.
  4. `cd /Users/iagh/git/claude-design && /plugin marketplace update md-claude` (from inside Claude Code session) → `/reload-plugins` → run `/flow:validate-security` on a synthetic dirty diff to confirm the command resolves and spawns the two subagents.
- **Pattern**: README "Local development" section in this repo.
- **Gotcha**: Smoke test runs in a **scratch** project, not in `claude-design` itself — running flow against its own `.ai/` tangles config (per CLAUDE.md "Working on plugin internals locally").
- **Validate**: `/flow:validate-security` produces a report at `.ai/logs/security-reviews/<branch>-<ts>.md` in the scratch repo, both `security-auditor` and `ethical-hacker` JSON blocks appear in the agent output stream.

---

## Validation

This repo has **no test/lint/build commands** (see CLAUDE.md). Validation is by inspection and one live smoke run.

1. **JSON schema parse** — `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json'))"` exits 0.
2. **Frontmatter sanity** — for each new `.md` file under `plugins/flow/{agents,skills,commands}/`, the first `name:` field equals `flow:<basename-without-ext>`.
3. **No write-tool leakage** — both new agent files have `tools:` lines that do NOT contain `Edit` or `Write`. Audit agents are read-only.
4. **No dead refs** — `grep -rn "security-auditor\|ethical-hacker\|validate-security" plugins/flow/` shows references only in: the new files themselves, `validate.md`, `review-code.md`, `done.md`, `CATEGORIES.md`. No orphan references in `templates/`, `commands/help.md`, or unexpected files.
5. **Live smoke** — Task 12 above (downstream scratch project).
6. **Manual** — read `ethical-hacker.md` end-to-end and confirm tone is adversarial / creativity-demanding, not checklist. If it reads like `security-auditor.md`, rewrite.

---

## Scenario Coverage

Not applicable — this is a plugin-internal addition (markdown + schema). No UI to scenario-test. The "live smoke" in Task 12 is the cross-platform proof.

---

## Acceptance Criteria

- [ ] All 12 tasks completed (Task 11 conditional on template file existing).
- [ ] `security-rules` skill exists with ≥ 20 ✘ rules across §A and §B; §B includes the trifecta and MCP tool poisoning.
- [ ] `security-auditor` agent exists, read-only tools, scoped to changed files, emits JSON to caller.
- [ ] `ethical-hacker` agent exists, persona section demands creativity, mandatory AI/MCP section, exploit-chain pass present.
- [ ] `/flow:validate-security` resolves and spawns both subagents on a smoke run.
- [ ] `/flow:validate` step 6.5 present and gates on `security.severityFloor`.
- [ ] `/flow:review-code` security section names both agents.
- [ ] `config.schema.json` parses; `security` block + `skills.securityRules` toggle present.
- [ ] `CATEGORIES.md` lists `/flow:validate-security` under `validate`.
- [ ] No DDR-worthy decision left unrecorded — this addition touches the plugin's public surface; a one-page DDR ("Why a defender + attacker pair instead of a single auditor") would be reasonable, but is optional given the rationale is captured in the agent file headers.
- [ ] Convention compliance: every new file's `name:` frontmatter is fully-qualified (`flow:<slug>`) per [DDR-006](./.ai/decisions/DDR-006-plugin-namespace-in-name-frontmatter.md).
