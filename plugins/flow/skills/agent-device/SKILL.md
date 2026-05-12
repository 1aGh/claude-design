---
name: agent-device
description: Native mobile/desktop automation CLI for AI agents. Use when interacting with a native iOS app (Expo/RN) in the simulator, opening native apps, taking accessibility snapshots, tapping by ref or selector, scrolling, typing, capturing screenshots/recordings/traces, reading network/perf evidence, profiling React Native via react-devtools, reloading Metro, sending push notifications. Triggers include "open the app on simulator", "tap on the upload button", "snapshot the home screen", "test the mobile flow", "check RN render perf", "reload Metro", "screenshot the app", "deep link into the app", "verify navigation". Use this for native mobile apps — agent-browser does not work for native iOS/Android apps.
allowed-tools: Bash(agent-device:*), Bash(npx agent-device:*), Bash(xcrun simctl:*)
hidden: true
---

# agent-device — conventions

Fast CLI for native iOS/Android/macOS automation via XCUITest + ADB. **Default for any work on a native mobile app** — `agent-browser` cannot drive native React Native UI.

For full command reference / specialized skills:

```bash
agent-device help workflow         # core loop, command shapes, selectors
agent-device help debugging        # logs, network dump, traces, alerts
agent-device help react-devtools   # RN render profiling, props/state inspection
agent-device help macos            # macOS app automation
agent-device help dogfood          # exploratory testing patterns
```

---

## First-time setup (new machine)

Skip this if `agent-device --version` prints `>=0.14.0`, you have a booted iOS simulator with the app's dev client installed, and `agent-device --platform ios open <bundle-id> && agent-device snapshot -i | head -3` shows app content (not an error). Otherwise, run through it once — first cold setup ~5 min, plus a one-time XCUITest build (~30-60s) on the first snapshot.

### 1. Install Xcode + iOS Simulator

You probably already have these for any iOS RN dev work:

```bash
xcode-select -p                                          # should print Xcode path
xcrun simctl list devices available | grep "iPhone 1[5-7] Pro" | head -5
```

If `xcode-select -p` fails, install Xcode from the App Store and run `xcode-select --install`.

### 2. Install agent-device CLI

```bash
npm install -g agent-device                              # or pnpm add -g agent-device
agent-device --version                                   # need >=0.14.0
```

### 3. Boot a simulator + install the mobile dev client

```bash
# Pick any modern iPhone — iPhone 16 Pro is a reasonable default
xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || true
open -a Simulator                                        # opens the simulator window

# Build & install the Expo dev client (if not already on the sim)
cd <path-to-rn-app>
pnpm dlx expo run:ios --device "iPhone 16 Pro"           # builds + installs + launches
# Subsequent JS-only changes hot-reload via Metro — only re-run on native module changes.
```

Verify the dev client landed:

```bash
xcrun simctl listapps booted | grep -A 2 <bundle-id>
```

### 4. First login to the app

The Simulator window opens the app automatically after `expo run:ios`. In that window, log in with whatever credentials you use. Keychain + AsyncStorage persist the session — you won't need to log in again across `close` / `open` or simulator reboots.

### 5. (Maybe) Apply the Xcode build-location workaround

The first `agent-device snapshot -i` triggers a one-time `xcodebuild` of the XCUITest runner (~30-60s). On most setups it just works. **Skip this step unless** that first snapshot fails with `Failed to locate .xctestrun after build` or `Runner build is missing expected products`.

If it does fail, your Xcode has `IDECustomBuildLocationType=Absolute` set (build outputs go outside the default DerivedData). See section "iOS runner xctestrun gotcha" below for the symlink fix.

### 6. Verify

```bash
agent-device --platform ios open <bundle-id>
agent-device snapshot -i | head -10                      # ~30s on first run, ~1.3s after
```

You should see refs and UI text. If you see only `[application] "<App>"` with no children, the app is on the splash/login — log in once via the Simulator window.

---

## Day-to-day rules

### 1. Target device + bundle id (memorise these)

| What                | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Bundle id           | `<your.bundle.id>` (typically same on iOS + Android)         |
| URL scheme (deep)   | `<your-scheme>://` (OAuth callback, share links)             |
| Default iOS sim     | iPhone 16 Pro (booted)                                       |
| Default Android AVD | `Pixel_7_API_34` (or any `--device` you have provisioned)    |
| Pin a specific sim  | `--udid <UDID>` on iOS (`xcrun simctl list devices booted`)  |
| Pin Android device  | `--serial <serial>` (`adb devices`)                          |

After the first-time setup, the dev client is installed on the booted simulator and **stays logged in** — keychain + AsyncStorage persist across `close` / `open` and across simulator reboots. Do not log out unless the test specifically requires it.

### 1a. Multi-simulator runs (iOS phone + tablet, parallel scenarios)

When you boot more than one iOS sim simultaneously (typical for the `scenario` skill: iPhone 16 Pro + iPad Air 11" together), commands that default to "the booted sim" become non-deterministic. **Always pass `--udid` explicitly** in this mode, and prefer the named-target form for `xcrun simctl`:

```bash
# Detect both UDIDs in one shot
xcrun simctl list devices booted -j | jq -r '.devices | to_entries[].value[] | "\(.name)\t\(.udid)"'
# iPhone 16 Pro    D718C4B7-C011-462E-8047-A2A6BA53CCFA
# iPad Air 11-inch (M3)    7F2A1B3C-...

IPHONE_UDID=D718C4B7-...
IPAD_UDID=7F2A1B3C-...

# iPhone runner uses its UDID for both the daemon AND screenshots
agent-device --platform ios --udid $IPHONE_UDID open <bundle-id>
xcrun simctl io $IPHONE_UDID screenshot /tmp/iphone.png       # NOT `simctl io booted`
agent-device --platform ios --udid $IPHONE_UDID find "<TabLabel>" click

# iPad runner uses the other UDID, can run concurrently in a separate process
agent-device --platform ios --udid $IPAD_UDID  open <bundle-id> &
xcrun simctl io $IPAD_UDID  screenshot /tmp/ipad.png
```

Same rule for Android — when more than one emulator/device is attached, pass `--serial`:

```bash
adb devices                                                   # list serials
agent-device --platform android --serial emulator-5554 open <bundle-id>
```

Each `--udid` (or `--serial`) target gets its own daemon process — they don't fight each other.

### 2. iOS runner xctestrun gotcha (only if Xcode has a custom build location)

If the user's Xcode has `IDECustomBuildLocationType=Absolute` set, Xcode redirects builds to a custom dir (e.g. an external drive) — overriding the `-derivedDataPath` that agent-device passes to `xcodebuild`. The daemon then can't find the freshly-built `.xctestrun` and snapshot fails with `Failed to locate .xctestrun after build` or `Runner build is missing expected products`.

**Detect the situation**:

```bash
defaults read com.apple.dt.Xcode IDECustomBuildLocationType 2>/dev/null
# "Absolute" → quirk applies; anything else / not set → skip this section
defaults read com.apple.dt.Xcode IDECustomBuildProductsPath 2>/dev/null
# prints the custom build root (e.g. an external-drive path), used by $CUSTOM_BUILD_ROOT below
```

**Fix** — symlink the actual build output into where agent-device expects:

```bash
CUSTOM_BUILD_ROOT="$(defaults read com.apple.dt.Xcode IDECustomBuildProductsPath)"
DERIVED="$HOME/.agent-device/ios-runner/derived"
mkdir -p "$DERIVED"
ln -sfn "$CUSTOM_BUILD_ROOT/Debug-iphonesimulator" "$DERIVED/Debug-iphonesimulator"
cp "$CUSTOM_BUILD_ROOT"/AgentDeviceRunner_*.xctestrun "$DERIVED/" 2>/dev/null || true
```

Trigger a build first if no `.xctestrun` exists yet — running any `agent-device snapshot` once will kick off `xcodebuild` (~30-60s on a clean derived dir). Then re-apply the symlink + copy.

The simpler alternative is to reset the Xcode pref to **"Default"** under Xcode → Settings → Locations, but that may affect other projects.

### 3. Screenshot bug — use simctl directly (this Xcode build)

`agent-device screenshot path.png` errors with `xcrun exited with code 1` on iOS 26.x — agent-device misinterprets simctl's "Detected file type from extension" stderr line as failure, even though simctl wrote the PNG. Workaround:

```bash
xcrun simctl io <UDID> screenshot .ai/device/screenshots/foo.png
```

Or grab the booted device automatically (only when **exactly one** sim is booted — `booted` is ambiguous if you've also booted an iPad for parallel scenario runs; in that case use `<UDID>` explicitly per sim):

```bash
xcrun simctl io booted screenshot .ai/device/screenshots/foo.png
```

**Bash-tool sandbox quirk** — on some setups writing simctl screenshots straight into the project root gets `Operation not permitted` (depends on disk volume / TCC permissions). Workaround — write to `/tmp` first, then `mv` into the standard `.ai/device/screenshots/` location:

```bash
xcrun simctl io booted screenshot /tmp/shot.png
mv /tmp/shot.png .ai/device/screenshots/foo.png
```

If the direct write works for you, skip the `/tmp` hop.

(Watch agent-device releases — the `xcrun exited 1` parsing will likely be patched.)

### 4. All artifacts go to `.ai/device/` (gitignored)

```
.ai/device/
├── screenshots/     # PNG screenshots (use simctl)
├── snapshots/       # AX tree dumps, JSON exports
├── traces/          # agent-device trace start/stop output
└── recordings/      # screen recordings (record start/stop)
```

Naming: `<feature>-<step>-<descriptor>.png`. Same convention as agent-browser.

### 5. Compact snapshots, don't sleep

```bash
agent-device snapshot -i             # interactive refs (always use this for actions)
agent-device snapshot                # read-only state (cheaper)
agent-device snapshot -s "Continue"  # scope to label/identifier (faster + cleaner)
agent-device snapshot -i -d 5        # limit tree depth
agent-device snapshot -i --json      # machine parsing — has `rect` per node for fallback coords
agent-device snapshot --diff         # structural delta vs previous baseline
agent-device wait 'label="Home"' 3000        # wait for selector
agent-device wait text "Streak" 3000         # wait for text
# agent-device wait 2000                     # only as last resort
```

### 6. ALWAYS prefer `find` over `press @ref` for known elements

The `find` command resolves a query against a fresh snapshot, then dispatches the action. **It auto-handles ref staleness, finds nearest hittable ancestor (Android), and works even when AX tree is partial.**

```bash
agent-device find "<Label>" click                  # fuzzy: text/label/value/role/id
agent-device find text "Sign In" click             # explicit text locator
agent-device find label "Email" fill "qa@example.com"
agent-device find value "Search" click
agent-device find role button click                # by role
agent-device find id "submit-btn" click            # by testID/id
```

**Selector OR chains** for resilience across platforms / language / refactors — single argument with `||`:

```bash
agent-device click 'id="tab-subjects" || label="Subjects" || text="Subjects"'
agent-device fill  'id="email-input" || label="Email" || placeholder="Email"' "qa@example.com"
```

This is the right pattern for cross-platform .ad scripts. **Use it instead of `press @ref` whenever a stable text/id/label exists** — refs renumber on every snapshot, OR chains do not.

### 7. Coordinate fallback only when AX gap is real

iOS RN apps sometimes hide tab bars / bottom-sheet content from the AX tree (only the active tab is announced). When `find` reports no match for a clearly-visible target:

```bash
agent-device snapshot -i --json | jq '.data.nodes[] | select(.label | tostring | contains("X"))'
# inspect the node's rect, compute center, then:
agent-device press <x> <y>
agent-device snapshot --diff             # verify state changed
```

Coordinates are **points (not pixels)**. Reference table for a typical device set:

| Device                       | Points (W×H) | Tab-bar Y (measure)                                               |
| ---------------------------- | ------------ | ----------------------------------------------------------------- |
| iPhone 16 Pro                | 402 × 874    | ~813                                                              |
| iPad Air 11-inch (M3)        | 820 × 1180   | ~1100–1180 (re-measure on first run; tab bar floats)              |
| Pixel 7 / Pixel 9 (emulator) | 411 × 914 dp | rarely needed — Android `find` auto-resolves to hittable ancestor |

Document why coords were used — ideally file a "missing testID" follow-up so the next run can use a selector.

### 8. Record + replay for repeatable scenarios

`--save-script` records every action while you explore; on `close`, agent-device writes a `.ad` file you can replay deterministically:

```bash
# Author once
agent-device open <bundle-id> --platform ios --session e2e \
  --save-script .ai/scenarios/<name>/ios.ad
agent-device --session e2e snapshot -i
agent-device --session e2e find "<Label>" click
# ... rest of flow ...
agent-device --session e2e close          # writes the .ad

# Replay later
agent-device replay .ai/scenarios/<name>/ios.ad

# Self-heal stale selectors after UI changes
agent-device replay -u .ai/scenarios/<name>/ios.ad
```

> Note: `agent-device test <dir> --retries N --artifacts-dir <path>` is documented in the upstream CLI but **not yet validated in this codebase**. Stick with `replay` until someone runs a multi-script suite end-to-end. If you do try it, file the result back into this skill.

Use `.ad` files as the canonical scenario format — they survive UI churn (with `replay -u`) and run identically on dev + CI.

---

## The core loop

```bash
agent-device --platform ios open <bundle-id>                      # 1. focus app
agent-device snapshot -i                                          # 2. read AX tree (refs in output)
agent-device find "<Label>" click                                 # 3. PREFER find over press @ref
agent-device fill 'label="Email"' "qa@example.com"                # 4. selector for inputs
xcrun simctl io booted screenshot .ai/device/screenshots/X.png    # 5. capture (workaround)
agent-device snapshot --diff                                      # 6. verify mutation
```

**When you DO use refs**: re-snapshot before each `press @ref` — refs renumber on every snapshot, and the same `@e29` after navigation may point to a completely different element.

---

## Auth state — already persistent

iOS dev client stores session in **keychain + AsyncStorage**. Both survive:

- `agent-device close` + `agent-device open`
- Simulator reboot (`xcrun simctl shutdown booted` + `boot`)
- Most app reinstalls when bundle id stays the same

You don't need `--session-name` or any explicit save command. To verify state, snapshot the home screen and look for a logged-in indicator (greeting / user name).

**To force logout** (e.g. testing onboarding):

```bash
# Path A — through the UI (cleanest)
agent-device --platform ios open <bundle-id>
# navigate to Settings → Logout

# Path B — uninstall + reinstall the app (clears AsyncStorage, but the keychain
# entry survives the uninstall on iOS — you may still land logged in)
xcrun simctl uninstall booted <bundle-id>
# reinstall via `expo run:ios` or by opening the dev-client URL

# Path C — nuclear: erase the entire simulator (wipes keychain too)
xcrun simctl shutdown booted
xcrun simctl erase booted
xcrun simctl boot booted
# rebuild + reinstall the dev client
```

If a "logout" test re-lands logged in, you've hit the iOS keychain-survives-uninstall behavior — go with Path C or Path A.

---

## Recipes

### Quick smoke test of mobile home screen

```bash
agent-device --platform ios open <bundle-id>
agent-device snapshot -i                                # confirm logged in
xcrun simctl io booted screenshot .ai/device/screenshots/smoke-1-home.png
agent-device press 'label="Upload"'                     # tap a known tile
agent-device wait text "<expected modal heading>" 3000
xcrun simctl io booted screenshot .ai/device/screenshots/smoke-2-upload.png
```

### Test deep link (OAuth callback, share link, etc.)

```bash
xcrun simctl openurl booted "<your-scheme>://feed/post/abc123"
agent-device snapshot -i                                # verify routed correctly
```

### Reload Metro after JS change (no rebuild)

```bash
agent-device metro reload                               # in-process JS reload
# or full app relaunch:
agent-device --platform ios open <bundle-id> --relaunch
```

### Capture network during a feature test

```bash
agent-device logs clear --restart
agent-device press 'label="Test"'                       # trigger the buggy interaction
agent-device network dump 50 --include all > .ai/device/snapshots/bug-XYZ-network.txt
```

### Profile RN render perf

```bash
agent-device react-devtools                             # opens RN devtools session
# interact with the slow screen
agent-device perf --json > .ai/device/snapshots/perf-baseline.json
```

See `agent-device help react-devtools` for component-tree inspection, hooks/state reading, render-cause attribution.

### Send a test push notification

If the app's pushes carry a deep-link payload (`data.url`) that the app opens on tap, use a realistic shape so you actually exercise the deep-link router:

```bash
# Notification leading to a feed post
agent-device push <bundle-id> '{
  "aps": {"alert": {"title": "New comment", "body": "Someone replied to your post"}, "sound": "default"},
  "data": {"url": "<your-scheme>://social/post/abc123"}
}'

# Notification leading to a content review screen
agent-device push <bundle-id> '{
  "aps": {"alert": {"title": "Review time", "body": "12 cards waiting"}, "sound": "default"},
  "data": {"url": "<your-scheme>://study/697ccd39d7b8e845fbc165c7/697ccd48d7b8e845fbc165e5"}
}'
```

Tap the notification in the simulator to verify the route handler — common failure mode is the URL scheme being slightly off.

### Android quick start

The same agent-device commands work against Android — pass `--platform android` (and `--serial <emulator-serial>` if more than one device is attached).

```bash
# 1. List available AVDs (one-time)
emulator -list-avds                                          # e.g. Pixel_7_API_34

# 2. Boot it
agent-device boot --platform android --device Pixel_7_API_34
# Or directly: emulator @Pixel_7_API_34 -no-snapshot-load &

adb devices                                                  # verify status: device
ANDROID_SERIAL=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')

# 3. Install the dev build (Expo)
cd <path-to-rn-app>
pnpm dlx expo run:android --device "$ANDROID_SERIAL"         # builds + installs APK + launches

# 4. Drive the app
agent-device --platform android --serial $ANDROID_SERIAL open <bundle-id>
agent-device --platform android --serial $ANDROID_SERIAL snapshot -i | head -10
agent-device --platform android --serial $ANDROID_SERIAL find "<Label>" click
agent-device --platform android --serial $ANDROID_SERIAL fill 'id="email-input" || label="Email"' "qa@example.com"

# 5. Screenshot via adb (parallel to simctl on iOS)
adb -s $ANDROID_SERIAL exec-out screencap -p > .ai/device/screenshots/android-home.png
```

**Android-specific differences from iOS:**

- `find` **auto-resolves to the nearest hittable ancestor** — if a non-clickable `<Text>` matches your selector, agent-device walks up the tree to the closest `Pressable`/`Button`. On iOS you'd have to target the wrapper manually.
- No xctestrun gotcha — Android uses UIAutomator directly, no separate runner build.
- Coordinate fallback rarely needed (the auto-ancestor resolution covers most cases). When you do need it, units are dp (density-independent pixels), not px.
- Push notifications need FCM, not APNs — `agent-device push` shape on Android takes the FCM `data` payload directly without an `aps` wrapper.
- Deep link the dev build: `adb shell am start -W -a android.intent.action.VIEW -d "<your-scheme>://feed/post/abc123"`.

### Record a regression video for a PR

```bash
agent-device record start .ai/device/recordings/PR-1234-flow.mp4
# ... full user flow ...
agent-device record stop
```

---

## Token efficiency cheat-sheet

Indicative numbers measured on a home screen, iPhone 16 Pro, iOS 26.1:

| Action                            | Latency | Output     | ~Tokens  |
| --------------------------------- | ------- | ---------- | -------- |
| `open <bundle>` (warm)            | ~4s     | 1 line     | ~10      |
| `snapshot -i` (cold, first run)   | ~27s    | 1.8 KB     | ~470     |
| `snapshot -i` (warm)              | ~1.3s   | 1.8 KB     | ~470     |
| `screenshot` via simctl           | ~0.3s   | 230 KB PNG | 0 (file) |
| `appstate`                        | ~0.5s   | 3 lines    | ~25      |
| `home`                            | ~0.5s   | 1 line     | ~10      |
| `press @eN` / `press 'label="…"'` | ~0.5s   | 1 line     | ~10      |

**Cold start cost**: first snapshot of the day rebuilds the XCTest runner (~30s). Subsequent snapshots in the same daemon session are sub-second. Avoid `agent-device close --all` mid-task — it kills the daemon and the next snapshot pays the cold cost again.

**Rule of thumb**: a 10-step interaction on warm daemon should be <5k tokens. Snapshot is the heavy item — call it only when you actually need refs, prefer `wait text "…"` / `is visible 'label="…"'` / `get text @ref` for read-only checks.

---

## Snapshot reading guide

```
@e1 [application] "<App>"
@e2 [window]
@e3 [other] "Home  Good evening, ...  ..."             ← composite container, prefer leaf refs
@e7 [other] "Home"                                      ← tab item (tap target)
@e10 [text] "Home"                                      ← label inside item
@e14 [scroll-area] "..." [scrollable]                   ← scroll, then re-snapshot
  [content below scroll-area hidden]                    ← scroll hint, not a ref
```

- **Tap on the smallest meaningful container** (`@e7`, not the parent `@e3`) — otherwise XCUITest may dispatch to wrong child.
- **Composite text on one node** is normal for RN — accessibility labels concatenate descendants. Use `snapshot -s @e3` to expand.
- **`[content below scroll-area hidden]`** = scroll hint. Do `agent-device scroll down 400` then re-snapshot.

---

## Selectors

Use selectors instead of refs when stable identifiers exist (testID, accessibility label):

```bash
agent-device press 'id="upload-button"'                  # testID prop in RN
agent-device press 'label="Upload"'                      # accessibilityLabel
agent-device fill 'id="email-field"' "qa@example.com"
agent-device is visible 'label="Online"'
agent-device get text 'id="streak-count"'
```

Prefer `testID` props on important interactive elements — they survive translations and visual changes. If the target lacks testID, file it as a small follow-up.

---

## Troubleshooting

**`Failed to locate .xctestrun after build`** → custom Xcode build location intercepted derivedDataPath. Apply the symlink fix in section "iOS runner xctestrun gotcha".

**`Runner build is missing expected products`** → symlink path is wrong (must be `~/.agent-device/ios-runner/derived/Debug-iphonesimulator`, not `…/Build/Products/Debug-iphonesimulator`). xctestrun expects `__TESTROOT__/Debug-iphonesimulator/`.

**`xcrun exited with code 1` on screenshot** → known agent-device 0.14.x bug. Use `xcrun simctl io booted screenshot path.png` directly.

**Snapshot returns 0 nodes / blank** → app not in foreground. `agent-device appstate` to verify, `agent-device --platform ios open <bundle-id>` to focus.

**`UNSUPPORTED_OPERATION` on keyboard dismiss** → try a visible "Done" / dismiss control via snapshot, or `back --system` only when system nav is acceptable.

**Slow snapshots after a long idle** → daemon may have been killed by the OS. Run any command to respawn (cold start ~30s).

**Refs are stale after a navigation** → `snapshot -i` again. Refs are NOT stable across navigation/modal/list-update.

---

## When NOT to use agent-device

- Web pages (including the web app at localhost:3000 or your production domain) → `agent-browser`
- Anything in Mobile Safari → `agent-browser -p ios`
- DOM eval, cookies, network intercept on web → `agent-browser`
- Pure shell ops (boot/install/uninstall/launch by url) without UI inspection → `xcrun simctl` directly is fine

For everything that touches **a native mobile app's UI**: agent-device, period.

---

## Reference

```bash
agent-device --version             # check installed version (need ≥0.14.0)
agent-device help                  # full command list and global flags
agent-device help workflow         # version-matched operating guide
agent-device devices --platform ios   # list iOS sims/devices
agent-device apps --platform ios   # list installed apps on default device
xcrun simctl list devices booted   # show currently-running simulators
```
