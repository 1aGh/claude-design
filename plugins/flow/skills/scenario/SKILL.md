---
name: flow:scenario
description: Run a user-flow scenario (e.g. "review first 3 flashcards") across web-desktop, web-mobile, ios-phone, ios-tablet, android-phone — capture per-step screenshots and produce a markdown report for human review. Triggers when the user asks to "test this flow", "run a scenario", "verify the X journey on all platforms", or wants a side-by-side cross-platform smoke test. Wraps agent-browser (web variants via device emulation) + agent-device (native iOS/Android via XCUITest/UIAutomator).
allowed-tools: Bash(agent-browser:*), Bash(agent-device:*), Bash(xcrun simctl:*), Bash(adb:*)
hidden: true
---

# scenario — cross-platform UI flow runner (MVP)

This is the **minimal** version. It encodes patterns proven on the flashcards-review-first-3 run; it does NOT yet auto-author scenarios from a description. You write per-platform bash for each scenario; the skill provides the layout, the platform matrix, and the report shape.

For full background on tooling: `.claude/skills/agent-browser/SKILL.md`, `.claude/skills/agent-device/SKILL.md`.

---

## Platform matrix

| Platform      | Tool          | Bootstrap                                                             | Status       |
| ------------- | ------------- | --------------------------------------------------------------------- | ------------ |
| web-desktop   | agent-browser | default viewport (1280×800)                                           | proven       |
| web-mobile    | agent-browser | `agent-browser set device "iPhone 16"` (393×852, iOS Safari UA)       | proven       |
| ios-phone     | agent-device  | `agent-device --platform ios --udid <iPhone16ProUDID>`                | proven       |
| ios-tablet    | agent-device  | boot iPad sim: `xcrun simctl boot "iPad Air 11-inch (M3)"` + `--udid` | wire next    |
| android-phone | agent-device  | start AVD: `agent-device boot --platform android --device <AVD-name>` | wire next    |

**Default platform set** for a new scenario: **`web-desktop, web-mobile, ios-phone, ios-tablet, android-phone`** (5 platforms). Web-tablet was intentionally dropped — the web app is responsive and uses the same bottom-tab UX at iPad-Pro viewport as at iPhone-16 viewport, so web-mobile already covers tablet web. Add it back only when a tablet-specific layout exists. Platforms not booted are skipped with a `result.txt` reason — do not fail the whole run.

---

## File layout

Run output lives under `.ai/device/scenario-runs/` (already gitignored as part of the `.ai/device/` artifact tree — see `.gitignore`). Runners themselves can live under `.ai/scenarios/<name>/runners/` if you want to commit them, or stay ephemeral in `/tmp/scenario-runners/` for one-off pilots:

```
.ai/scenarios/<scenario-name>/             # OPTIONAL: committed runners
├── runners/
│   ├── web-desktop.sh
│   ├── mobile.sh                          # web-mobile (device emulation only)
│   ├── ios-phone.sh
│   ├── ios-tablet.sh
│   └── android-phone.sh
└── README.md                              # scenario goal, fixtures, expected end state

.ai/device/scenario-runs/<scenario-name>/  # ALWAYS: gitignored run outputs
└── <YYYY-MM-DD-HHMM>/
    ├── report.md                          # final deliverable for the human
    ├── web-desktop/
    │   ├── step-1-home.png
    │   ├── ...
    │   └── result.txt                     # pass | fail | skipped + reason
    ├── web-mobile/
    ├── ios-phone/
    ├── ios-tablet/
    └── android-phone/
```

The committed `runners/` + `README.md` are optional; for one-shot scenarios just inline the bash via heredoc. **Do NOT** write run outputs to `.ai/scenarios/<name>/runs/`.

---

## Step shape

Each platform script follows this contract:

```bash
#!/usr/bin/env bash
. /tmp/scenario-run.env                    # exports RUN_DIR
DIR="$(pwd)/$RUN_DIR/<platform>"
echo "================== <platform> =================="

# 0. bootstrap (close stale session, set device emulation, boot sim, etc.)
# 1..N. each step:
#   - take screenshot $DIR/step-N-<short-name>.png
#   - perform action (click/press/find/eval)
#   - wait for expected element / text
#   - on failure: write $DIR/result.txt with "fail: <reason>" and exit 1

# Final:
echo "pass" > $DIR/result.txt
```

**Naming**: `step-{N}-{short-descriptor}.png`. N is logical step number, NOT timestamp. `step-6-card-1-front.png` and `step-7-card-1-back.png` for sub-steps within step 6.

---

## Selectors — the right reach order (proven)

For each tap/click target, try these in order until one works:

1. `find "<text>" click` (agent-device) or `find role button click --name "<text>"` (agent-browser) — semantic locator
2. Fresh snapshot grep + `@ref` — re-snapshot before EACH press (refs renumber)
3. JSON snapshot rect center (`agent-device snapshot -i --json | jq …`) → `press <x> <y>` in points
4. Web only: `agent-browser eval 'document.querySelectorAll("<stable-class>")[i].click()'`

Selector OR chains for resilience: `'id="x" || label="Y" || text="Z"'` (single argument).

---

## Shareable mobile-UX scenario body

When the web app is responsive — at iPhone-16 viewport the same bottom-tab-bar UX appears that the native iOS/Android apps use — the body of any scenario after the tab-bar tap is **shared** across web-mobile, ios-phone, ios-tablet, and android-phone. Only the tab-bar tap differs per platform:

| Platform      | Tab-bar tap                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| web-mobile    | `agent-browser eval 'document.querySelectorAll("button.flex-1")[1].click()'`                                               |
| ios-phone     | `agent-device --platform ios --udid <iphone-udid> press 200 813` (points, fallback)                                        |
| ios-tablet    | `agent-device --platform ios --udid <ipad-udid> press 384 1180` (points, **re-measure on first run**)                      |
| android-phone | `agent-device --platform android --serial <emulator-serial> find "<TabLabel>" click` (auto-resolves to hittable ancestor)  |

When testIDs are added (see follow-ups below), all four become: `find "<TabLabel>" click`.

---

## Parallelization rule

- **Web variants run sequentially** — they share a single agent-browser daemon / Chrome session. Don't try to run web-desktop and web-mobile in parallel; the second one will steal the daemon.
- **Native variants run in parallel** with web and with each other — each is a separate iOS sim or Android emulator. With `--udid`/`--serial` per-platform there's no contention.
- **Result**: target wallclock = `time(slowest web variant) + time(slowest native variant)`, which is roughly 1× time of native (ios-phone ≈ 60s) when web finishes first.

```bash
# Web sequential (in one bash chain):
( runners/web-desktop.sh && runners/mobile.sh web-mobile "iPhone 16" ) > /tmp/web.log 2>&1 &
WEB_PID=$!

# Natives in parallel:
runners/ios-phone.sh    > /tmp/ios-phone.log    2>&1 &
runners/ios-tablet.sh   > /tmp/ios-tablet.log   2>&1 &
runners/android-phone.sh > /tmp/android-phone.log 2>&1 &

wait $WEB_PID                                                # web chain done
wait                                                          # all natives done
```

---

## Running an existing scenario

```bash
SCENARIO=flashcards-review-first-3
RUN_DIR=".ai/device/scenario-runs/$SCENARIO/$(date +%Y-%m-%d-%H%M)"
mkdir -p "$RUN_DIR"/{web-desktop,web-mobile,ios-phone,ios-tablet,android-phone}
echo "RUN_DIR=$RUN_DIR" > /tmp/scenario-run.env

# Detect simulator UDIDs / Android serial up-front (fail fast if missing)
IPHONE_UDID=$(xcrun simctl list devices booted -j | python3 -c "import json,sys;d=json.load(sys.stdin)['devices'];print(next((dev['udid'] for k,v in d.items() if 'iOS' in k for dev in v if 'iPhone' in dev['name']), ''))")
IPAD_UDID=$(xcrun simctl list devices booted -j   | python3 -c "import json,sys;d=json.load(sys.stdin)['devices'];print(next((dev['udid'] for k,v in d.items() if 'iOS' in k for dev in v if 'iPad'   in dev['name']), ''))")
ANDROID_SERIAL=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')

# Run all platforms (failure of one does not abort others)
( runners/web-desktop.sh && runners/mobile.sh web-mobile "iPhone 16" ) || true &
WEB_PID=$!
[ -n "$IPHONE_UDID" ]   && runners/ios-phone.sh    "$IPHONE_UDID"    || echo "skipped: no iPhone sim booted" > "$RUN_DIR/ios-phone/result.txt" &
[ -n "$IPAD_UDID" ]     && runners/ios-tablet.sh   "$IPAD_UDID"      || echo "skipped: no iPad sim booted"   > "$RUN_DIR/ios-tablet/result.txt" &
[ -n "$ANDROID_SERIAL" ] && runners/android-phone.sh "$ANDROID_SERIAL" || echo "skipped: no AVD running"      > "$RUN_DIR/android-phone/result.txt" &
wait

# Generate report.md from result.txt + screenshots in $RUN_DIR
# (TODO: write a generator; for now author manually following the report shape below)
```

---

## Report shape (deliverable)

`runs/<timestamp>/report.md` is the single thing the human reads. Required sections, in this order:

1. **TL;DR table** — one row per platform: result (PASS / FAIL / SKIPPED), steps reached, tooling.
2. **Counter-delta verification** — the strongest cross-platform parity signal. One row per platform, columns for each numeric counter that should have moved (e.g. `mastered Δ`, `remaining Δ`). Identical deltas across rows = scenario verified.
3. **Per-step pivot table** — **rows = platforms, columns = step thumbnails** (markdown image embeds). Lets the human eyeball cross-platform parity in one glance instead of scrolling a 10-row table sideways.
4. **What surprised us** — non-obvious findings (UX differences, broken expectations, unexpected counter math, mid-run state changes).
5. **Recommended follow-ups** — prioritized list of codebase changes that would make the scenario more reliable (e.g. missing testIDs).

The wide path-listing (per-step file paths per platform) goes in a collapsed `<details>` block at the end — useful for repro but not the primary content.

```markdown
## Per-step screenshots (pivot)

| Platform      | Step 1 home                        | Step 5 grid                                 | Step 8 final                      |
| ------------- | ---------------------------------- | ------------------------------------------- | --------------------------------- |
| web-desktop   | ![](web-desktop/step-1-home.png)   | ![](web-desktop/step-4-flashcards-grid.png) | ![](web-desktop/step-8-final.png) |
| web-mobile    | ![](web-mobile/step-1-home.png)    | ![](web-mobile/step-5-flashcards-grid.png)  | ![](web-mobile/step-8-final.png)  |
| ios-phone     | ![](ios-phone/step-1-home.png)     | ![](ios-phone/step-5-flashcards.png)        | ![](ios-phone/step-8-final.png)   |
| ios-tablet    | ![](ios-tablet/step-1-home.png)    | ...                                         | ...                               |
| android-phone | ![](android-phone/step-1-home.png) | ...                                         | ...                               |

## Counter delta

| Platform    | `mastered` Δ | `remaining` Δ |
| ----------- | ------------ | ------------- |
| web-desktop | +3           | −3            |
| web-mobile  | +3           | −3            |
| ...         | ...          | ...           |
```

---

## Authoring a new scenario

**For a one-shot pilot** (most cases): inline the bash directly in a Bash tool call. Don't create files just to delete them later.

**For a stable, repeatable scenario**:

1. `mkdir -p .ai/scenarios/<name>/runners`
2. Write `README.md` with the user-flow description, fixtures (subject/chapter/account), expected end state.
3. Adapt existing runners if any — replace selectors per scenario.
4. First run: pilot interactively, screenshot per step, debug. Use `agent-device --save-script` to record native flows automatically:

   ```bash
   agent-device open <bundle-id> --platform ios --udid $UDID --session pilot \
     --save-script .ai/scenarios/<name>/runners/ios-phone.ad
   # … drive scenario interactively …
   agent-device --session pilot close
   # replay later:           agent-device replay .ai/scenarios/<name>/runners/ios-phone.ad
   # self-heal stale sels:   agent-device replay -u <file>
   ```

5. Once stable, commit `runners/` + `README.md`. Subsequent runs are reproducible.

agent-browser has no equivalent record/replay — author web variants as bash directly.

---

## TODO (not yet implemented)

- **Auto-author from prompt** — `/scenario "review first 3 flashcards"` should generate runners. Today: manual.
- **Report generator** — script that walks `runs/<ts>/<platform>/result.txt + step-*.png` and emits `report.md` with the pivot table. Today: manual.
- **iOS-tablet runner** — boot `iPad Air 11-inch (M3)` once, fork `ios-phone` runner with explicit `--udid`. Tab-bar Y likely ~1180 points (re-measure on first run; iPad Air 11" is 820×1180 points).
- **Android-phone runner** — boot AVD (e.g. `Pixel_7_API_34`), use `agent-device --platform android --serial <serial>`. Per the agent-device skill, `find` auto-resolves to nearest hittable ancestor on Android, so coordinate fallbacks should rarely be needed.
- **Per-step `result.txt` schema** — currently only "pass / fail: reason" at platform level. Per-step pass/fail with timing would let the report flag exactly which step diverged.
- **Maestro integration** — `mcp__maestro__*` tools exist; YAML flows might be cleaner than bash for complex scenarios. Worth a spike before scaling.

---

## Codebase blockers (file as tickets to unblock automation)

These would let scenario runs become much simpler — replace coordinate fallbacks and DOM-class hooks with proper selectors:

1. **Mobile tab-bar `testID`** (web + native) — e.g. `tab-home`, `tab-subjects`, `tab-chat`, `tab-community`. Removes the `button.flex-1[1]` and `(200, 813)` / `(384, 1180)` hacks.
2. **List-item `testID`** — e.g. `subject-{id}`, `chapter-{id}`. Removes regex grep over snapshot text (which breaks on i18n + counter prefixes).
3. **Action button `testID`** — e.g. `flashcard-mark-hard`, `-practice`, `-known`. Removes emoji-prefix selectors.
