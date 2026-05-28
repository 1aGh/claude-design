---
name: flow:validate
category: daily
type: command
description: "Full validation pipeline — static + tests + build + cross-platform scenario (5 platforms) + a11y + design consistency"
keywords: [validate, full, pipeline, scenario, cross-platform, a11y, design-system]
---

# /validate — full pipeline

**This is the main validation gate.** Run it before `/done`, before push, or when reviewing older code. The cross-platform scenario is the backbone — for any multi-platform project (mobile/tablet/web) parity is a core feature.

## Process

Run in this order. **Stop on first hard fail**, accumulate soft warnings.

### 0.5 Config health (blocker)

> Reads the workspace's own config sanity before doing anything else. A schema error (e.g. an invalid `stack.tests` enum or a non-string `quality.<gate>`) silently degrades downstream skills, so it blocks here.

```bash
maude doctor --json | jq -e '.summary.schemaErrors == 0' >/dev/null \
  || { echo "::error::config schema errors in .ai/workflows.config.json — run \`maude doctor --fix\`"; exit 1; }
```

Stack **drift** and missing **quality additions** are warning-only at this step (surface them in the Step 8 report; don't block — `/flow:validate` runs on feature branches and shouldn't force a config edit mid-feature). Never call `maude doctor --fix` from validate — print the fix command and let the user run it.

### 1. Static analysis — `config.quality.{format,lint,typecheck}`

> Reads gates from `.ai/workflows.config.json` → `quality` per the `flow:quality-gates` skill. Each gate is a blocker; a missing gate skips with a warning (never fabricated). `tests` and `build` run in Steps 2–3 below — preserving the overall fail-fast order format → lint → typecheck → tests → build.

`typecheck` and `lint` are pure read-only scans with no dependency on each other.

**In a single assistant message, run these two checks in parallel using two Bash tool calls:**

- typecheck:
  ```bash
  CMD=$(jq -r '.quality.typecheck // empty' .ai/workflows.config.json)
  if [[ -n "$CMD" ]]; then echo "→ typecheck: $CMD"; eval "$CMD" || { echo "::error::typecheck gate failed (\`$CMD\`)"; exit 1; }
  else echo "⚠ quality.typecheck not declared — run \`maude doctor --fix\` (skipping)"; fi
  ```
- lint:
  ```bash
  CMD=$(jq -r '.quality.lint // empty' .ai/workflows.config.json)
  if [[ -n "$CMD" ]]; then echo "→ lint: $CMD"; eval "$CMD" || { echo "::error::lint gate failed (\`$CMD\`) — try \`pnpm biome check --fix\` or \`maude doctor --fix\`"; exit 1; }
  else echo "⚠ quality.lint not declared — run \`maude doctor --fix\` (skipping)"; fi
  ```

When both return, run `format` (must follow lint so we don't flag lint-suggested fixes):

```bash
CMD=$(jq -r '.quality.format // empty' .ai/workflows.config.json)
if [[ -n "$CMD" ]]; then echo "→ format: $CMD"; eval "$CMD" || { echo "::error::format gate failed (\`$CMD\`)"; exit 1; }
else echo "⚠ quality.format not declared — run \`maude doctor --fix\` (skipping)"; fi
```

### 2. Tests — `config.quality.tests`

```bash
CMD=$(jq -r '.quality.tests // empty' .ai/workflows.config.json)
if [[ -n "$CMD" ]]; then
  echo "→ tests: $CMD"
  eval "$CMD" || { echo "::error::tests gate failed (\`$CMD\`)"; exit 1; }
else
  echo "⚠ quality.tests not declared — run \`maude doctor --fix\` (skipping)"
fi
```

- Full suite (the `tests` gate command runs unit + integration).
- Coverage report (just report, don't block on threshold).

#### 2a. Coverage-trend warning (opt-in, non-blocking)

> Soft gate. Reads `skills.coverageTrend` from `.ai/workflows.config.json`. Default `enabled: false` — skip silently.

When `skills.coverageTrend.enabled` is `true` **and** the runner emits a parseable coverage summary:

1. Extract the project-level line coverage as a percentage (parse from `vitest --coverage` / `jest --coverage` / `pytest --cov` / `go test -cover` output — the same line the report shows as `coverage: 78%`).
2. Read `.ai/state/coverage-baseline.json` if it exists:
   ```json
   { "coverage": 78.4, "recordedAt": "2026-05-12", "branch": "main" }
   ```
3. Compute `delta = current - baseline.coverage` (negative = drop).
4. **If `-delta > skills.coverageTrend.warnThresholdPp`** (default `1.0` pp) → emit warning in the Step 8 report:
   ```
   ⚠ coverage trend: 78.4% → 76.8% (Δ -1.6 pp, threshold 1.0 pp) — review changed files via the flow:test-coverage subagent (default diff scope)
   ```
   **Never** promote to a blocker — Step 2 is explicit that coverage doesn't block on threshold. If the team wants a hard gate, that requires its own DDR.
5. **If no baseline exists** → record current as the baseline silently. No warning on the first run. Note in the report: `coverage baseline established (<value>%)`.

Baseline refresh is handled by `/flow:done` (only on the `baselineBranch`, default `main`), not here — `/validate` runs on feature branches too and a feature-branch drop is exactly what the warning is for.

### 3. Build — `config.quality.build`

```bash
CMD=$(jq -r '.quality.build // empty' .ai/workflows.config.json)
if [[ -n "$CMD" ]]; then
  echo "→ build: $CMD"
  eval "$CMD" || { echo "::error::build gate failed (\`$CMD\`)"; exit 1; }
else
  echo "⚠ quality.build not declared — run \`maude doctor --fix\` (skipping)"
fi
```

- Production build for each app/package from `.ai/context/codebase-map.md`.
- Bundle size delta if tooling is available (`size-limit`, `bundlewatch`).

### 3.5 Custom quality gates (project-specific CI mirror)

> Any `config.quality.*` gate **beyond** the five conventional ones (`format`, `lint`, `typecheck`, `tests`, `build`) runs here, in declaration order. This is how a project mirrors its full CI surface locally (e.g. version-parity, tarball-shape, generated-content drift) so `/flow:validate` catches what CI would catch — before push. All blocker.

```bash
for gate in $(jq -r '.quality | keys[]' .ai/workflows.config.json); do
  case "$gate" in format|lint|typecheck|tests|build) continue;; esac
  CMD=$(jq -r ".quality[\"$gate\"]" .ai/workflows.config.json)
  echo "→ $gate: $CMD"
  eval "$CMD" || { echo "::error::$gate gate failed (\`$CMD\`)"; exit 1; }
done
```

### 4. Cross-platform + a11y + design + security (parallel fan-out)

> Resolve config **once, here**, and pass the relevant values inline in each spawn prompt. Subagents inherit CLAUDE.md + MCP + skills but NOT this conversation, so handing them the resolved knobs saves each one a re-read of `.ai/workflows.config.json`.

```bash
SEV_FLOOR=$(jq -r '.security.severityFloor // "medium"'        .ai/workflows.config.json)
INCLUDE_AI=$(jq -r '.security.includeAi // true'               .ai/workflows.config.json)
SEC_SCOPE=$(jq -rc '.security.scope // ["classic","ai"]'       .ai/workflows.config.json)
SEC_ENABLED=$(jq -r '.skills.securityRules.enabled // true'    .ai/workflows.config.json)
```

**In a single assistant message, spawn the following subagents using parallel Agent tool calls:**

- `scenario-runner` — runs the cross-platform scenario per `.claude/skills/scenario/SKILL.md`. It picks scope (web-only / native-only / all 5 platforms) from the diff and reads `.ai/scenarios/` + the active plan. Returns JSON: `report_path`, `platforms_run`, `results`, `blockers`, `parity_ok`, `follow_ups`.
- `a11y-auditor` — live axe-core scan via agent-browser over affected routes (reads the scenario screenshot directory as it fills; does not block on scenario completion). Reports WCAG 2.1 AA blockers + warnings.
- `design-system-guard` — token + component conformance against the project design system. Enforces: allowed effects (gradients/glass/blur), iconography family + stroke width, typography roles (UI typeface vs monospace for numbers/timecodes/IDs/CLI), single customizable color token, allowed palette, dark/light priority, mobile tap targets (44×44), prefers-reduced-motion fallback. **Uses scenario screenshots as primary evidence** (not just static grep).
- `security-auditor` — defender pass (OWASP-class static + grep over changed files: injection, secrets, authN/Z, crypto, SSRF, XSS, deserialization, path traversal, supply chain, logging, error handling). **Pass inline in the spawn prompt:** `severityFloor: <SEV_FLOOR>`, `includeAi: <INCLUDE_AI>`, `scope: <SEC_SCOPE>` — do not re-read config.
- `ethical-hacker` — adversarial review: chained exploits + AI/MCP attack surface (prompt injection in tool outputs, confused-deputy across MCP servers, the trifecta = private data + untrusted content + outbound exfil in one agent loop, tool-description injection in newly added MCP servers). **Pass inline:** the same three security knobs.

Skip the `security-auditor` + `ethical-hacker` pair entirely when `SEC_ENABLED == false`; skip only the AI/MCP lens when `INCLUDE_AI == false` (the defender pass still runs). Reuse a fresh security report (`.ai/logs/security-reviews/<branch>-*.md` within the last hour, same HEAD) instead of re-running.

**Wait for all five to complete before evaluating the exit gates in §5.**

### 5. Exit gates

Evaluate after all five subagents return. **Stop on first hard fail**, accumulate soft warnings.

**Scenario:**
- If the feature touches UI and **no scenario exists** → HARD FAIL: block until a scenario is written (`/scenario new <name>`).
- `blockers > 0` → `/validate` fails. Fix, retry.
- `parity_ok == false` → cross-platform divergence. Requires a DDR (why the divergence is intentional) **or** a parity fix.
- `SKIPPED` platform only because of an unbooted sim → warning, not fail. But if the user should have run ios-phone and the sim wasn't booted, that's a soft fail.

**A11y / design (UI projects):** WCAG 2.1 AA blockers and design-system violations are blockers (report file:line in §8).

**Security:** aggregates to `.ai/logs/security-reviews/<branch>-<ts>.md`.
- Any finding at severity ≥ `severityFloor` (default `medium`) → `/flow:validate` fails.
- `ethical-hacker.exploit_chains > 0` is informational by itself, never a blocker — **but** a chain that combines a medium defender finding with a medium attacker finding promotes to high and counts as a blocker.

### 7. Doc / decision drift

- Active plan without a `## Retro` section after `/done`? Flag.
- DDR-worthy decision in the diff (new library, new top-level dir, schema change) without a DDR? Suggest `/flow:record-ddr`.
- Scenario report without identical counter-delta across platforms and no DDR explaining why → blocker.

### 7b. Changelog hygiene (**non-blocking**)

> Soft gate. Emits a warning when a user-visible change ships without a release-note entry. **Never** promotes itself to a hard gate without a DDR — opt-in vs. opt-out is a per-team call, recorded in `integrations.changelog.provider`.

Read provider from `.ai/workflows.config.json` → `integrations.changelog.provider` and dispatch:

```
IF provider === "changesets":
  diff = git diff --name-only HEAD~1..HEAD -- .changeset/
  IF no new .changeset/*.md added since HEAD~1:
    EMIT warning: "⚠️  No changeset since HEAD~1 → run /flow:release-changelog or override"
    MARK validate result as "passed with warnings" (not blocked)
ELIF provider IN (git-cliff, conventional, custom):
  EMIT note: "[validate] changelog: provider `<name>` not yet implemented — skipping (TODO)"
ELSE (none):
  skip silently
```

For multi-commit branches use `git merge-base main HEAD` as the diff base instead of `HEAD~1` so squash/rebase noise doesn't false-positive.

### 8. Report

```
## /validate — <YYYY-MM-DD HH:MM>
✓ types | ✓ lint | ✓ format
✓ tests: 142/142 (coverage: 78%)
   → trend: 78.4% → 78.0% (Δ -0.4 pp, threshold 1.0 pp) — within tolerance
   (omitted when skills.coverageTrend.enabled = false)
✓ build: 3 apps OK (bundle delta: +2.1 KB on web)
✓ scenario: <name> 5/5 PASS
   → report: .ai/device/scenario-runs/<name>/2026-05-04-1830/report.md
   → parity: ✓ identical counter-delta across all 5 platforms
✓ a11y: 0 blockers, 2 warnings (file:line)
✓ design system: 0 violations
✓ DDR drift: 0 (all decisions recorded)
```

Append a non-blocking config-health line (drift + missing quality gates from Step 0.5):

```bash
maude doctor --json | jq -r '
  "→ config: \(.summary.driftCount) stack drift(s), \(.summary.qualityAdditions) quality addition(s)"
  + (if (.summary.driftCount + .summary.qualityAdditions) > 0 then " — run `maude doctor --fix`" else " (clean)" end)'
```

If everything is green → safely continue to `/done`.

## What /validate does NOT do

- Commit / push / PR — that's `/done`.
- Bug fix — if something fails, go out to `/execute` to fix, then retry `/validate`.
