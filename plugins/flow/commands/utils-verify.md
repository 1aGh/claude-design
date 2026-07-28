---
name: utils-verify
category: utils
type: command
description: "Light verification of touched files during /flow:execute — type/lint/affected tests + agent-browser/agent-device smoke for UI changes"
keywords: [verify, check, smoke, edit-verify, agent-browser, agent-device]
---

# /flow:utils-verify — focused check

Use during `/execute` after each task (Edit-Verify Loop). For a full cross-platform sweep before merge, use `/validate`.

## Process

1. **Determine scope:**
   ```bash
   git diff --name-only             # uncommitted
   git diff --name-only main...HEAD # vs main
   ```
   Classify files:
   - `.ts/.tsx/.js/.jsx` source → static checks + browser smoke (if UI)
   - `.test.*` → run affected tests
   - `.css/styles` → static check + visual smoke (agent-browser screenshot)
   - RN files (`apps/mobile/`, `apps/native/`, etc.) → agent-device smoke
   - Pure backend / config → static checks only

2. **Static checks (always) — `config.quality.{format,lint}` + affected tests:**

   Run the project's declared `format` + `lint` gates (per the `flow:quality-gates` skill). `typecheck`, the full `tests` suite, and `build` are `/flow:validate`'s job — the inner loop runs only the two fast gates plus *affected* tests.

   ```bash
   for gate in format lint; do
     CMD=$(jq -r ".quality.$gate // empty" .ai/workflows.config.json)
     if [[ -n "$CMD" ]]; then
       echo "→ $gate: $CMD"
       eval "$CMD" || { echo "::error::$gate gate failed (\`$CMD\`)"; exit 1; }
     else
       echo "⚠ quality.$gate not declared — run \`maude doctor --fix\` (skipping)"
     fi
   done
   ```
   - Affected unit/integration tests (only the tests touching changed files — not the full `quality.tests` suite).

3. **UI smoke (parallel — fire only the legs the diff triggers):**

   Web smoke and native smoke are independent. **When the diff contains both web and native sources, run both legs in parallel in a single assistant message** (one Bash call for web, one for native); when only one applies, run just that one. Optional subagents (step 4) join the same parallel batch when their triggers fire.

   - **Web (diff contains web sources):**
     ```bash
     # Quick smoke — agent-browser, web-desktop only, < 30s
     agent-browser open http://localhost:4000/<route-relevant-to-task>
     agent-browser snapshot -c             # compact snapshot, context-cheap
     agent-browser screenshot .ai/device/verify/$(date +%s)-<task>.png
     ```
     - Verifies: page loads without crash, key elements from the plan are in the snapshot.
     - **Not** a full scenario — that's `/validate`. Here we catch obvious 500s, missing imports, runtime crashes.
   - **Native (diff contains RN sources):**
     ```bash
     IPHONE_UDID=$(xcrun simctl list devices booted -j | python3 -c "import json,sys;d=json.load(sys.stdin)['devices'];print(next((dev['udid'] for k,v in d.items() if 'iOS' in k for dev in v if 'iPhone' in dev['name']), ''))")
     agent-device --platform ios open com.<project>.<bundle> --udid $IPHONE_UDID
     agent-device snapshot -i              # accessibility snapshot
     agent-device screenshot .ai/device/verify/$(date +%s)-ios.png
     ```
     - Smoke = app starts, navigation to affected screen works, no red-screen / crash dialog.

4. **Subagents (optional, recommended for UI tasks) — add to the same parallel batch as step 3 when triggered:**
   - `a11y-auditor` — quick a11y check of affected UI files
   - `design-system-guard` — conformance with the project design system

5. **Report:**
   ```
   ✓ types: pass
   ✓ lint: pass (3 files)
   ✓ tests: 12/12 pass
   ✓ web-desktop smoke: page loads, key elements present
   ⚠ a11y: 1 warning — Button on screen X missing accessible name
   ```

6. **Config drift nudge (soft, never blocks):**
   ```bash
   maude doctor --json | jq -e '(.summary.driftCount + .summary.qualityAdditions) == 0' >/dev/null \
     || echo "⚠ config drift / missing quality gates — run \`maude doctor --fix\` when convenient (not blocking)"
   ```
   A nudge only. Gate failures in Step 2 ARE blockers; this is not.

7. If something fails, propose a fix or return to the edit-verify loop in `/execute` (max 3 iterations per task).

## What /flow:utils-verify does NOT do

- Cross-platform parity check — that's a `/validate` job (spawn the `scenario-runner` subagent across 5 platforms).
- Full test suite (only affected tests).
- Build of the whole project — only where directly touched.
- Bundle size / performance regression — that's `/validate`.

## Idiom

`/flow:utils-verify` is the **inner loop** during work. Run often, even after every edit. **Cheap.** Roughly 15–60s depending on scope.

`/validate` is the **outer gate** before merge. Run once before `/done`. **Expensive** (cross-platform scenario, full pipeline). Roughly 5–15 min depending on platform count.
