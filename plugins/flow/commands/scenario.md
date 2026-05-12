---
name: scenario
type: command
description: "Run a cross-platform UI scenario (5 platforms: web-desktop, web-mobile, ios-phone, ios-tablet, android-phone) — screenshot proof + markdown report"
keywords: [scenario, validate, e2e, smoke, cross-platform, agent-browser, agent-device]
argument-hint: "<scenario-name> | new <scenario-name>"
---

# /scenario — cross-platform UI flow runner

**This is the validation backbone.** For every UI feature there must be at least one scenario that verifies it across 5 platforms. Web-only or native-only features use a subset.

Wrapper around the `agent-browser` + `agent-device` skills. Full protocol in `.claude/skills/scenario/SKILL.md`.

## Input

`$ARGUMENTS`:
- `<scenario-name>` — run an existing scenario from `.ai/scenarios/<name>/`
- `new <scenario-name>` — create a new scenario (interactively pilot via agent-browser/agent-device, save runners)
- (empty) — list all scenarios from `.ai/scenarios/` plus their last run status

## Process — existing scenario

1. **Pre-flight:**
   - `agent-browser --version` + `agent-device --version` — verify install
   - `xcrun simctl list devices booted` — find UDIDs of iPhone + iPad sims (if any)
   - `adb devices` — find Android serial (if any)
   - Platforms without a booted sim/AVD are **skipped** with a `result.txt` reason, not a fail of the whole run

2. **Run** per the protocol in the `scenario` skill — web in parallel (sequential between web variants) + native (parallel among themselves).

3. **Generate the report** at `.ai/device/scenario-runs/<name>/<YYYY-MM-DD-HHMM>/report.md` with sections:
   - TL;DR table (per platform: PASS/FAIL/SKIPPED)
   - Counter-delta verification (cross-platform parity signal)
   - Per-step pivot table (rows = platforms, columns = step thumbnails)
   - What surprised us
   - Recommended follow-ups (testIDs to add, etc.)

4. **Next-step suggestion:** _"Scenario `<name>` ran: <X>/<Y> platforms pass. Report: `<path>`. Post to PR?"_

## Process — `new <scenario-name>`

1. Create `.ai/scenarios/<name>/` directory with `runners/` and `README.md`.
2. **README.md** — the user describes:
   - **User flow** — steps 1..N (e.g. "Open Video tab → click first tape → tag at 12s → save clip")
   - **Persona** from the project PRD (who does it)
   - **PRD reference** — which screen brief this covers
   - **Fixtures** — seed data the scenario needs (test team, test video URL, etc.)
   - **Expected end state** — what must be true after the last step (counter delta, navigation state)
3. **Pilot interactively** via agent-browser (web) and agent-device (native) per the skill. `agent-device --save-script` records the native flow automatically.
4. **Save runners** — one bash script per platform in `.ai/scenarios/<name>/runners/`.
5. **Smoke test** — run the freshly written scenario. If it passes 5/5, commit the runners.

## Acceptance criteria for a scenario

A scenario is **production-ready** when:

- [ ] Runners are idempotent (can be run again without cleaning state)
- [ ] Selectors use testIDs or semantic locators (not fragile DOM class chains)
- [ ] The counter-delta section in the report has identical values across platforms (parity)
- [ ] If testIDs are missing → the follow-ups section in the report contains concrete tickets

## Known scenarios

`.ai/scenarios/` — read files directly. `/scenario` (no arguments) prints the list.

## Integration

- **`/plan`** — Acceptance Criteria for a UI task must name at least one scenario.
- **`/execute`** — during the Edit-Verify loop (max 3 iterations) it runs an agent-browser smoke for web after each edit, but a full scenario only in `/verify`.
- **`/verify`** — if the feature has UI touch, runs the relevant scenario (web-desktop + web-mobile minimum, native only if the feature touches RN code).
- **`/validate`** — always full scenario across all 5 platforms.
- **`/done`** — requires a passing scenario report as a gate. The report URL goes into the PR description.
