# Feature: Decouple flow plugin from GitHub issues (generic issue-tracker abstraction)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The flow plugin treats the issue tracker as **GitHub by default**. Two commands (`/flow:bug-rca`, `/flow:bug-fix`) already read `integrations.tracker.provider` from `.ai/workflows.config.json` and branch on it — but their **frontmatter, headers, argument hints, and helper code (repo auto-detect, `Closes #N` link, "GitHub Issue" template fields)** still hard-code GitHub. The remaining flow commands (`status`, `plan`, `execute`, `record-execution`) and skill `debugging-rules` don't branch at all — they shell `gh issue view`/`gh issue list` and emit "GitHub Issue: #N" template fields unconditionally.

The schema already supports `integrations.tracker.provider ∈ { clickup, linear, github, jira, notion, asana, shortcut, none }` with `mcp` (tool prefix) + `defaults` (free-form pass-through) — see `plugins/flow/.claude-plugin/config.schema.json:325-355`. The `ai-skeleton` template already scaffolds `"tracker": { "provider": "none" }`. This refactor finishes the abstraction so a project with `provider: "clickup"` can use the entire flow plugin without seeing the word "GitHub" leak through.

## User Story

As a team using **ClickUp** (or Linear, Jira, …) as the issue tracker, I want flow commands to honor `integrations.tracker.provider` end-to-end — so my plans, RCAs, status displays, and execute/record steps reference tickets in the tracker I actually use, instead of forcing me to translate to/from GitHub Issue numbers.

## Problem

1. **Frontmatter & headlines hardcode GitHub** in commands that already have provider-switch logic in the body. `description: "Analyze and document root cause for a GitHub issue"`, `argument-hint: "github-issue-id"`, H1 `# Root Cause Analysis: GitHub Issue #$ARGUMENTS` — Claude Code surfaces these in `/flow:help`, autocompletion, and the command preamble. The branching paragraph deeper in the body is invisible to the user choosing the command.
2. **`status.md`, `plan.md`, `execute.md`, `record-execution.md`, `debugging-rules/SKILL.md`** have **zero provider-awareness** — they call `gh issue view`/`gh issue list` directly and write "GitHub Issue: #N" template fields into plans + execution reports.
3. **`CATEGORIES.md` doc** describes commands as GitHub-specific ("Analyze and document root cause for a GitHub issue").
4. **Repository auto-detection** in `bug-rca.md` + `bug-fix.md` shells `gh repo view` even when the tracker is ClickUp — wasted GitHub round-trip + spurious error if user hasn't `gh auth login`'d in a non-GitHub-tracker repo.
5. **`Closes #$ARGUMENTS`** hardcoded in `bug-fix.md`'s PR-body advice — GitHub-only syntax that doesn't auto-close ClickUp tickets.

## Solution

A **single consistent resolution pattern** inlined into every command/skill that touches the tracker:

```
1. Read integrations.tracker.provider from .ai/workflows.config.json
   (treat missing file / missing key as "github" for backwards compat
    — pre-existing repos default to gh CLI flow today).
2. Branch:
   - github  → use `gh issue view/list` (the existing GitHub CLI flow).
   - <mcp-backed provider> → call the MCP tool named in integrations.tracker.mcp
     (e.g. `mcp__claude_ai_ClickUp_clickup_get_task`), passing defaults through.
   - none    → ask the user to paste the ticket text, or rely on the local
     RCA/plan document only.
3. Treat the result as a generic "ticket" — title, description, comments, status —
   regardless of provider.
```

Generalize all GitHub-specific language ("GitHub Issue", "issue number", "gh issue view") to **"ticket"** with the provider name interpolated from config where helpful. Keep `gh pr create` / `Closes #N` only in the GitHub branch (or skip auto-close link entirely for non-GitHub trackers — let `bug-fix.md`'s existing "Tracker sync (optional)" section handle the MCP-side update).

**Out of scope:** `gh pr create` (PR creation is the git host, not the tracker — orthogonal concern, separately configurable via `integrations.ci.provider`). DDR not required — the contract (`integrations.tracker.*`) and the default (`github` fallback) were already decided when the schema landed; this plan is execution.

## Metadata

- **GitHub Issue / Ticket**: none — refactor without external trigger
- **Type**: Refactor
- **Complexity**: Medium (8 files, generic abstraction, no new schema)
- **App/Package**: `plugins/flow/`
- **Affected Systems**:
  - `plugins/flow/commands/{bug-rca,bug-fix,status,plan,execute,record-execution}.md`
  - `plugins/flow/skills/debugging-rules/SKILL.md`
  - `plugins/flow/CATEGORIES.md`
  - `plugins/flow/templates/ai-skeleton/workflows.config.json` (verify stub clarity)
- **Dependencies**: none — schema already supports it, ai-skeleton template already scaffolds the stub.

---

## Context References

### Must-Read Files

- `plugins/flow/.claude-plugin/config.schema.json` (lines 319–404) — Why: the **`integrations.tracker`** contract (`provider`/`mcp`/`defaults`) is already defined; the refactor consumes it, never extends it.
- `plugins/flow/commands/bug-rca.md` (lines 28–46) — Why: the **reference implementation** of the provider switch (step "0. Resolve the ticket source"). Mirror this shape into the other offenders.
- `plugins/flow/commands/bug-fix.md` (lines 27–46, 102–112) — Why: shows both the **resolution paragraph** and the **post-commit "Tracker sync (optional)"** block that calls `<integrations.tracker.mcp>_*_update_task`.
- `plugins/flow/templates/ai-skeleton/workflows.config.json` (lines 67–68) — Why: confirms `"tracker": { "provider": "none" }` is already scaffolded by `/flow:init`.

### Files to Create

None. Pure text refactor.

### Documentation

- `CLAUDE.md` (lines about flow plugin) — Why: ensure no leaked GitHub-only verbiage about flow commands.
- `plugins/flow/CATEGORIES.md` — Why: command catalog displayed by `/flow:help`; descriptions surface in autocomplete.

### Patterns to Follow

**The reference resolution block (from `bug-rca.md:28-46`):**

```markdown
### 0. Resolve the ticket source

Read `integrations.tracker.provider` from `.ai/workflows.config.json`:

- **`github` or unset** → continue with the GitHub CLI flow (`gh issue view …`).
- **Any other provider** (`clickup`, `linear`, `jira`, `notion`, …) → fetch the ticket
  via the configured MCP tool. Resolve the tool name from `integrations.tracker.mcp`
  (e.g. `mcp__claude_ai_ClickUp_clickup_get_task` for ClickUp). Pass through
  `defaults` (list IDs, custom field names) untouched — the MCP server interprets
  them. Map the fetched ticket's title, description, comments, and status onto the
  same investigation slots as the GitHub flow.
- **`none`** → ask the user to paste the ticket description manually.

The rest of this command treats "ticket" generically — whatever source you resolved.
```

**The post-commit sync block (from `bug-fix.md:102-112`):**

```markdown
### Tracker sync (optional)

If `integrations.tracker.provider !== "none"` and the matching MCP tool is
available, ask:

> **Mark ticket `$ARGUMENTS` as fixed in `<provider>` and link the PR?**

If yes → call `<integrations.tracker.mcp>_*_update_task` (or provider equivalent)
with `defaults.doneStatus` and a comment containing the PR URL and commit hash.
Pass `defaults` through untouched.

If `provider === "github"`, the PR's `Closes #$ARGUMENTS` already takes care of
the link — no extra step needed.
```

**Repo auto-detect should be GitHub-only:** move the `REPO=$(gh repo view …)` shell snippet **inside** the `provider === github` branch in `bug-rca.md` + `bug-fix.md`. Calling `gh` when the tracker is ClickUp is wasted work and noisy when `gh auth login` is missing.

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: REFACTOR `bug-rca.md` — finish the abstraction

- **Do**:
  - Frontmatter: `description: "Analyze and document root cause for a ticket"`, `keywords: [bug, root-cause, analysis, investigate, debug, diagnose, ticket]`, `argument-hint: "ticket-id"`.
  - H1: `# Root Cause Analysis: Ticket $ARGUMENTS` (drop the `#` prefix — non-GitHub IDs like `CU-abc123` don't use it).
  - "Objective" line: replace "GitHub issue #$ARGUMENTS" with "ticket `$ARGUMENTS`".
  - Move `REPO=$(gh repo view …)` snippet under "Repository Auto-Detection" **into** step 1 ("Fetch GitHub Issue Details" → rename to "Fetch ticket details (GitHub branch)"), guarded by `provider === github`.
  - Rename step 1 to: `### 1. Fetch ticket details` — keep the GitHub flow under a `> Skip this section if the tracker provider is not 'github'.` callout (already partially there); add a placeholder note for MCP-backed providers ("step 0 already fetched via MCP; jump to step 2").
  - Output filename: keep `.ai/logs/rca/issue-$ARGUMENTS.md` — `$ARGUMENTS` is a slug that works for any ID format (`123`, `CU-abc123`, `LIN-42`). Comment one line noting this is intentional.
- **Pattern**: existing step 0 stays as the reference resolution block.
- **Gotcha**: when `provider === none`, the user pastes raw text; don't drop into shell. The current step-0 says "ask the user to paste the issue description manually" — keep that wording but say "ticket description".
- **Validate**: `grep -n "GitHub" plugins/flow/commands/bug-rca.md` returns zero matches outside the explicit `provider === github` branch.

### Task 2: REFACTOR `bug-fix.md` — finish the abstraction

- **Do**:
  - Frontmatter: `description: "Implement fix from RCA document for a ticket"`, drop `github-issue` keyword (add `ticket`), `argument-hint: "ticket-id"`.
  - H1: `# Implement Fix: Ticket $ARGUMENTS`.
  - Move `REPO=$(gh repo view …)` block **into** the `provider === github` branch (under "Tracker context" or inline at step 4 "Optional — View ticket for context").
  - Rename "Optional — View GitHub issue for context (when provider is `github`)" → "Optional — View ticket via GitHub CLI (when provider is `github`)".
  - Commit message advice: change `fix(auth): handle null session — refs #123` example to a neutral form. Suggested replacement: `fix(auth): handle null session — refs ${TICKET_REF}` and add one line: *"For `provider === github`, `${TICKET_REF}` is `#$ARGUMENTS` (auto-closes via PR). For other providers, use `${provider}-$ARGUMENTS` (e.g. `CU-abc123`) — auto-close happens via the Tracker sync step below."*
  - In the PR-body advice (line currently saying `Closes #$ARGUMENTS`): wrap in a `> If provider === github:` callout. For other providers, point to the existing "Tracker sync (optional)" block.
- **Pattern**: tracker-context block stays as-is (the canonical switch).
- **Gotcha**: don't accidentally remove the GitHub fast-path — many users still use GitHub Issues; the goal is **provider-aware**, not **provider-agnostic-only**.
- **Validate**: `grep -n "GitHub\|#\$ARGUMENTS" plugins/flow/commands/bug-fix.md` — every remaining hit is inside an explicit `provider === github` guard.

### Task 3: REFACTOR `status.md` — add provider switch around tracker queries

- **Do**:
  - Find the two `gh issue …` shell blocks (lines 64–66 single-issue view, lines 201–210 my-open-issues count).
  - Wrap each in the resolution pattern:
    ```markdown
    Read `integrations.tracker.provider`:
    - `github` (or unset) → run the `gh issue …` snippet below.
    - other MCP-backed provider → call `<integrations.tracker.mcp>_*_get_task` /
      `*_filter_tasks` (ClickUp: `mcp__claude_ai_ClickUp_clickup_get_task`
      + `mcp__claude_ai_ClickUp_clickup_filter_tasks`). Pass `defaults` through.
    - `none` → skip the tracker section, display `Story: (no tracker configured)`.
    ```
  - For the "Issue number detection from branch name" section: keep the regex match, but rename "issue" → "ticket" in the display label.
  - For the "My open issues: N total" display: rename to "My open tickets: N total" and gate on `provider !== none`.
- **Pattern**: status.md is already a multi-source dashboard — fits naturally with another switch.
- **Gotcha**: branch-name parsing for ticket IDs varies per provider (`feat/123-foo` vs `feat/CU-abc-foo`). Keep the GitHub-style numeric regex behind the `github` branch; for other providers note: *"Ticket ID extraction from branch names is provider-specific — implement when needed in a follow-up DDR."* Don't over-engineer in this pass.
- **Validate**: `grep -n "gh issue" plugins/flow/commands/status.md` — every hit lives inside an explicit `github`-branch guard.

### Task 4: REFACTOR `plan.md` — generalize the metadata template

- **Do**:
  - Line 198 currently reads: `- **GitHub Issue**: #<number> — <title>`.
  - Replace with: `- **Ticket**: <id> — <title> (from \`integrations.tracker.provider\`; omit line if provider === \`none\`)`.
- **Pattern**: existing markdown template inside the "## Metadata" section.
- **Gotcha**: this is template **content** rendered into every new plan — keep the placeholder readable.
- **Validate**: `grep -n "GitHub Issue\|GitHub issue" plugins/flow/commands/plan.md` returns nothing.

### Task 5: REFACTOR `record-execution.md` — generalize the metadata template

- **Do**:
  - Line 24: `- GitHub Issue: #<number> (if linked)` → `- Ticket: <id> (if linked; from \`integrations.tracker.provider\`)`.
- **Validate**: same grep.

### Task 6: REFACTOR `execute.md` — generalize the plan-metadata read

- **Do**:
  - Line 43: `- Note the GitHub issue number from plan metadata (for commit/PR linking)` → `- Note the ticket ID from plan metadata (for commit/PR linking; format depends on \`integrations.tracker.provider\`)`.
  - Line 215: `> **Committed. Ready to push and create a PR?** I'll rebase onto main, push, and create the PR with the issue linked.` → `… push, and create the PR with the ticket linked (\`Closes #N\` for github; commented PR URL on the tracker side for MCP providers via the bug-fix tracker-sync step).`
- **Validate**: `grep -n "GitHub issue\|GitHub Issue" plugins/flow/commands/execute.md` returns nothing.

### Task 7: REFACTOR `debugging-rules/SKILL.md` — generalize cross-references

- **Do**:
  - Line 137: `| GitHub issue triage | …` → `| Ticket triage | …`.
  - Line 217: `- \`/flow:bug-rca\` — formal RCA flow for GitHub issues (Phase 1 + 2 codified)` → `- \`/flow:bug-rca\` — formal RCA flow for tracker tickets (Phase 1 + 2 codified; provider via \`integrations.tracker\`)`.
- **Pattern**: skill text only — no logic change.
- **Validate**: `grep -n "GitHub" plugins/flow/skills/debugging-rules/SKILL.md` returns nothing.

### Task 8: UPDATE `CATEGORIES.md` — generalize the bug-rca catalog entry

- **Do**:
  - Line 74: `| /flow:bug-rca | Analyze and document root cause for a GitHub issue. | Opening a bug. |` → `| /flow:bug-rca | Analyze and document root cause for a ticket. | Opening a bug. |`.
  - Same row for `/flow:bug-fix` if it carries "GitHub" wording (check).
- **Validate**: `grep -n "GitHub issue\|GitHub Issue" plugins/flow/CATEGORIES.md` returns nothing.

### Task 9: VERIFY `ai-skeleton/workflows.config.json` stub clarity

- **Do**:
  - Confirm `"integrations": { "tracker": { "provider": "none" }, ... }` exists (it does — line 67–68).
  - Add a one-line inline JSON-schema-friendly hint near the stub if it makes the default obvious for new repos, e.g. change the default `"none"` → `"none"` (no change — keep silent default) BUT add a short note in `/flow:init`'s scaffold message: *"Tracker defaults to `none`. Set to `github` / `clickup` / `linear` / … in `.ai/workflows.config.json` to enable ticket integration."*
  - If `/flow:init` doesn't print such a hint, skip the message edit — don't invent new behavior in this pass.
- **Pattern**: template change only if low-risk; otherwise no-op.
- **Validate**: `node cli/bin/maude.mjs init --dry-run` (or read `cli/commands/init.mjs`) shows the stub copied through.

### Task 10: SMOKE — render `/flow:help` output mentally

- **Do**: open `plugins/flow/commands/help.md` (or how help is rendered) and confirm the regenerated `description:` strings read naturally for a ClickUp user.
- **Validate**: no GitHub-specific verbiage in the catalog table for any of the 6 affected commands.

### Task 11: SEARCH for leftover GitHub-issue verbiage across the plugin

- **Do**: `grep -rni -E "github (issue|issues)|gh issue|#\\\$ARGUMENTS" plugins/flow/` — every remaining hit must be inside an explicit `provider === github` branch.
- **Validate**: walk the output line by line; if anything's outside a guard, route back to the matching task above.

---

## Validation

This is a markdown-only refactor in a repo with **no test suite, lint config, or build step** (per `CLAUDE.md`). Validation is:

1. **Grep gates** (from each task's Validate line):
   - `grep -rn "GitHub Issue\|GitHub issue\|GitHub issues" plugins/flow/commands/ plugins/flow/skills/ plugins/flow/CATEGORIES.md` → zero hits **except** inside explicit `provider === github` guards.
   - `grep -rn "gh issue" plugins/flow/commands/` → only inside `github`-branch fenced blocks.
2. **Manual read-through**: open each of the 8 changed files; the H1 / description / argument-hint / examples should read naturally for a hypothetical ClickUp-using project.
3. **Round-trip plan**: pretend `provider === clickup` and read `bug-rca.md` end-to-end — every reference resolves to a generic "ticket" or an MCP call. No naked `gh issue view`. No naked `Closes #N`.
4. **Backwards-compat check**: pretend `provider === github` (or `integrations.tracker` missing entirely — the `bug-rca.md` step-0 says "github or unset"). The whole GitHub flow must still work end-to-end exactly as today.
5. **No CLI / dev-server impact**: nothing under `cli/`, `plugins/design/`, or `scripts/` is touched. Confirm by `git status` showing only `plugins/flow/` + `.ai/plans/` changes.

---

## Acceptance Criteria

- [ ] All 11 tasks completed.
- [ ] `grep -rn "GitHub" plugins/flow/commands/ plugins/flow/skills/debugging-rules/ plugins/flow/CATEGORIES.md` returns hits **only** inside explicit `provider === github` guards.
- [ ] Frontmatter of `bug-rca.md` + `bug-fix.md` no longer names "GitHub" in `description` or `argument-hint`.
- [ ] `status.md`, `plan.md`, `execute.md`, `record-execution.md` honor `integrations.tracker.provider` or print provider-neutral language.
- [ ] `debugging-rules/SKILL.md` cross-refs to `/flow:bug-rca` are provider-neutral.
- [ ] `CATEGORIES.md` catalog entries read naturally for a ClickUp-using project.
- [ ] `ai-skeleton/workflows.config.json` template still scaffolds the `integrations.tracker.provider: "none"` stub (no regression).
- [ ] Backwards-compat verified by mental round-trip with `provider: "github"` / missing key — the GitHub CLI flow works identically to today.
- [ ] No changes outside `plugins/flow/` + this plan file. (`git status` confirms.)
- [ ] No new dependencies; no schema changes; no DDR required (schema contract was decided when `integrations.tracker` landed; this plan executes against it).

---

## Confidence

**8/10** for one-pass implementation. Schema contract is already in place, two of the most complex commands (`bug-rca`, `bug-fix`) already carry the reference pattern. Remaining work is **mechanical text refactor + consistent guard placement**. The single nontrivial judgment call is Task 3 (status.md branch-name regex for non-GitHub ID formats) — explicitly deferred to a follow-up DDR if/when a non-GitHub user reports the gap.

Risks:
- **Subtle backwards-compat regression** — a stray `gh issue view` outside a guard would break ClickUp users; the grep gate in Task 11 + Validation step 1 catches it.
- **PR auto-close UX** — `Closes #N` only works on GitHub; the Task 2 wording must be precise so users don't expect ClickUp auto-close from a GitHub PR body.

---

## Retro

- **What worked**: The schema and ai-skeleton template were already abstracted (`integrations.tracker.provider`/`mcp`/`defaults`) — only command/skill text was missing. Confidence was 8/10 and it played out exactly: 11 tasks, mechanical text edits, grep gates caught nothing in the final sweep.
- **What worked**: `bug-rca.md` + `bug-fix.md` already carried the canonical "0. Resolve the ticket source" switch — copying that shape into `status.md` and the metadata fields was straight pattern-matching, not new design.
- **What didn't**: Did not write the consolidated resolution snippet to a shared fragment — each command repeats the same ~5-line switch verbatim. DRY-wise weak, but commands are read as standalone prompts by Claude Code and inlining keeps each one self-contained. Acceptable trade-off; flag if a 5th tracker concern arrives.
- **What didn't**: Branch-name → ticket-ID extraction in `status.md` Step 2 is still GitHub-numeric regex with a note that non-numeric IDs need a follow-up. Skipped intentionally to keep this pass mechanical; ClickUp users will hit it.
- **For next time**: When a schema-level abstraction has been declared but command text hasn't followed, treat it as **mechanical refactor (medium complexity)** — `/flow:plan` correctly redirected from `/flow:quick`, but the actual work was closer to a quick. Confidence ≥ 8 + no schema change = good signal for tightly-scoped plans.
- **Follow-up**: DDR opportunity if a ClickUp/Linear user reports the branch-name regex gap — likely shape: `integrations.tracker.branchIdPattern` (regex), defaults to `/[0-9]+/` for github.
