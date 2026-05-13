---
name: validate
category: daily
type: command
description: "Full validation pipeline — static + tests + build + cross-platform scenario (5 platforms) + a11y + design consistency"
keywords: [validate, full, pipeline, scenario, cross-platform, a11y, design-system]
---

# /validate — full pipeline

**This is the main validation gate.** Run it before `/done`, before push, or when reviewing older code. The cross-platform scenario is the backbone — for any multi-platform project (mobile/tablet/web) parity is a core feature.

## Process

Run in this order. **Stop on first hard fail**, accumulate soft warnings.

### 1. Static analysis
- Type-check (whole project)
- Lint (whole project)
- Format check (Prettier / Biome / gofmt)

### 2. Tests
- Unit + integration: full suite
- Coverage report (just report, don't block on threshold)

### 3. Build
- Production build for each app/package from `.ai/context/codebase-map.md`
- Bundle size delta if tooling is available (`size-limit`, `bundlewatch`)

### 4. Cross-platform scenario (validation backbone)

**Spawn the `scenario-runner` subagent** (`.claude/agents/scenario-runner.md`).

- The subagent figures out which scenarios are relevant to the diff (reads `.ai/scenarios/` + the active plan).
- If the feature touches UI and **no scenario exists** → **HARD FAIL**: block until a scenario is written (`/scenario new <name>`).
- The subagent decides scope (web-only / native-only / all 5 platforms) based on touched files.
- It runs scenarios in parallel per the protocol in `.claude/skills/scenario/SKILL.md`.
- Returns JSON with: `report_path`, `platforms_run`, `results`, `blockers`, `parity_ok`, `follow_ups`.

**Gate:**
- `blockers > 0` → `/validate` fails. Fix, retry.
- `parity_ok == false` → cross-platform divergence. Requires a DDR (why the divergence is intentional) **or** a fix for parity.
- `SKIPPED` platform only because of an unbooted sim → warning, not fail. But if the user should have run ios-phone and the sim wasn't booted, that's a soft fail (they should have booted it).

### 5. A11y (for UI projects)

**Spawn the `a11y-auditor` subagent.** The subagent can use agent-browser for a live axe-core run over affected routes (not just static analysis). Reports WCAG 2.1 AA blockers + warnings per the project a11y rules.

### 6. Design consistency (for UI projects)

**Spawn the `design-system-guard` subagent.** The subagent compares the affected UI against the project design system, enforcing rules such as:
- Allowed effects (gradients, glass, blur)
- Iconography family and stroke width
- Typography roles (UI typeface vs monospace for numbers / timecodes / IDs / CLI)
- Single customizable color token (where applicable)
- Allowed color palette
- Dark/light mode priority
- Mobile tap target sizes (e.g. 44×44)
- prefers-reduced-motion fallback

The subagent **must use screenshots from the scenario report** as primary evidence (not just grep static analysis), because the scenario provides rendered cross-platform proof.

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
✓ build: 3 apps OK (bundle delta: +2.1 KB on web)
✓ scenario: <name> 5/5 PASS
   → report: .ai/device/scenario-runs/<name>/2026-05-04-1830/report.md
   → parity: ✓ identical counter-delta across all 5 platforms
✓ a11y: 0 blockers, 2 warnings (file:line)
✓ design system: 0 violations
✓ DDR drift: 0 (all decisions recorded)
```

If everything is green → safely continue to `/done`.

## What /validate does NOT do

- Commit / push / PR — that's `/done`.
- Bug fix — if something fails, go out to `/execute` to fix, then retry `/validate`.
