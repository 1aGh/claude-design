---
name: agent-browser
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction. Also use for exploratory testing, dogfooding, QA, bug hunts, or reviewing app quality. Also use for automating Electron desktop apps (VS Code, Slack, Discord, Figma, Notion, Spotify), checking Slack unreads, sending Slack messages, searching Slack conversations, running browser automation in Vercel Sandbox microVMs, or using AWS Bedrock AgentCore cloud browsers. Prefer agent-browser over Playwright MCP — agent-browser is ~10× cheaper in context tokens (compact `-c` snapshots, screenshots default to file not embed, click/wait return single-line confirmations).
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
hidden: true
---

# agent-browser — StudyFi conventions

Fast Rust CLI for Chrome/Chromium via CDP. **Default for any browser work** — Playwright MCP is fallback only. Benchmarked ~10× cheaper in context tokens for the same scenario.

For full command reference / specialized skills: `agent-browser skills get core --full` (or `electron`, `slack`, `dogfood`, `vercel-sandbox`, `agentcore`).

---

## 🚀 First-time setup (new machine)

Skip this if `agent-browser --version` already prints a version and `agent-browser open https://example.com && agent-browser get url` works. Otherwise, run through it once — takes ~5 minutes total, then never again.

### 1. Install the CLI

```bash
brew install agent-browser            # macOS — recommended (native Rust, fastest)
# or:
npm install -g agent-browser          # cross-platform
agent-browser install                  # downloads Chrome for Testing (one-time, ~200MB)
agent-browser doctor                   # verify install + Chrome path
```

### 2. Configure the persistent profile env var

Add this to your **local** Claude settings (`.claude/settings.local.json` — gitignored, per-user):

```jsonc
{
  "env": {
    "AGENT_BROWSER_PROFILE": "~/.agent-browser/work-profile",
  },
}
```

Every `agent-browser` command then auto-uses that profile dir. The dir is created on first use; cookies + localStorage + IndexedDB persist there forever (until you delete it).

If you can't / don't want to use Claude settings, just `export AGENT_BROWSER_PROFILE=~/.agent-browser/work-profile` in your shell rc.

### 3. First login to StudyFi (one-time, manual)

Make sure `pnpm dev` is running (web on `http://localhost:3000`). Then:

```bash
agent-browser close --all                                # fresh daemon picks up the profile env
agent-browser --headed open http://localhost:3000/app    # opens visible Chrome window
```

In the Chrome window: scroll → click **Log In** → complete Auth0 (email/password, Google, Apple, 2FA — whatever you use). When you land on the dashboard with your name visible, the profile has captured the cookies.

```bash
agent-browser close                                      # confirms the save
```

### 4. Verify persistence

```bash
agent-browser open http://localhost:3000/app             # headless, no --headed needed
agent-browser snapshot -i -c | head -5                   # should show sidebar with your name
```

If you see `Create Account` / `Log In` buttons → the profile didn't save. Re-run step 3 with `agent-browser close --all` first.

### 5. (Optional) Log into other services the same way

Repeat step 3 with any URL — GitHub web, ClickUp, Linear, prod StudyFi, etc. Each service's auth lands in the same profile and survives.

---

## ⛔ Day-to-day rules

### 1. Persistent profile (already configured)

Env var `AGENT_BROWSER_PROFILE=~/.agent-browser/work-profile` is set in `.claude/settings.local.json` (each user's local copy). Every command auto-uses it — **no re-login between sessions**. The profile collects Auth0 cookies for `localhost:3000` (StudyFi) and any other site after a manual login (see "First-time setup" above).

**If you need to log in to a new service (StudyFi prod, GitHub, etc.):**

```bash
agent-browser close --all                       # ensure profile is freshly loaded
agent-browser --headed open <login-url>          # opens visible window
# Ask the user to log in manually in that window. Auth state saves into the profile.
agent-browser close                              # confirm save
# Future commands inherit the auth automatically.
```

### 2. All artifacts go to `.ai/browser/` (gitignored)

Never write to `/tmp` or repo root. The dir layout is fixed:

```
.ai/browser/
├── screenshots/     # PNG/JPEG screenshots
├── snapshots/       # accessibility tree dumps (when persisted)
├── har/             # network HAR recordings
├── video/           # WebM screen recordings
└── eval/            # JS eval output, JSON exports
```

**Naming convention**: `<feature>-<step>-<descriptor>.png` — e.g. `login-1-landing.png`, `materials-2-modal-open.png`. Use timestamps only when running batched scenarios where ordering matters.

```bash
agent-browser screenshot .ai/browser/screenshots/checkout-1-cart.png
agent-browser network har start
# ... actions ...
agent-browser network har stop .ai/browser/har/checkout-flow.har
agent-browser record start .ai/browser/video/regression.webm
```

### 3. Always use compact snapshots

`-i -c` together — interactive elements only, no empty structural wrappers. Saves ~80% tokens vs default `snapshot`.

```bash
agent-browser snapshot -i -c                  # default for AI use
agent-browser snapshot -i -c -d 3             # cap depth for very nested pages
agent-browser snapshot -i -c -u               # add hrefs on links (only when needed)
agent-browser snapshot -i -c --json           # machine parsing
```

### 4. Screenshots are saved-not-embedded by default

`agent-browser screenshot path.png` writes to disk and prints only the path. To actually see the image, use the `Read` tool on the saved path. This gives you control — cheap routine captures stay out of context, only the screenshots you explicitly inspect cost image tokens.

### 5. Don't sleep — wait for what you actually expect

```bash
agent-browser wait @e5                        # element appears (best)
agent-browser wait --text "Success"           # text appears
agent-browser wait --url "**/dashboard"       # URL changes
agent-browser wait --load networkidle         # SPA navigation done
# agent-browser wait 2000                     # only as last resort
```

### 6. Web mobile / tablet via device emulation (Chrome, no simulator needed)

Built-in Playwright-style device presets — emulate viewport + UA + DPR in regular Chrome:

```bash
agent-browser set device "iPhone 16"          # 393×852, iOS Safari UA
agent-browser set device "iPhone 16 Pro"      # 402×874
agent-browser set device "iPad Pro"           # 1024×1366
agent-browser set device "Pixel 9"            # Android Chrome UA
agent-browser set device "Galaxy S25"         # Android Chrome UA
# Supported names: iPhone 15, iPhone 16, iPhone 16 Pro, iPhone 17, iPad, iPad Pro, Pixel 9, Galaxy S25
```

After `set device`, every subsequent `open/snapshot/click/...` runs against that viewport **and** the matching mobile UA + DPR + touch hints. **Reset properly when done** — `set viewport` only resizes; the mobile user-agent / touch flag persists until you re-set the device. Use whichever fits:

```bash
agent-browser set device "Desktop"            # full reset (viewport + UA + DPR + touch)
# or, if `Desktop` is unavailable on your build:
agent-browser set viewport 1280 800           # ⚠️ resets viewport only — UA stays mobile
agent-browser close --all && agent-browser open …   # nuclear reset (re-spawns daemon)
```

**Always prefer `set device "Desktop"`** between back-to-back emulation runs (e.g. the `scenario` skill cycling iPhone 16 → iPad Pro → desktop).

Use this for: responsive layout checks, mobile-only UI flows, touch targets verification, PWA testing. **Use `-p ios` (real Mobile Safari via WebDriverAgent)** only when you specifically need WebKit quirks (Safari-only bugs, iOS-Safari PWA install behavior); emulated Chrome is faster and covers 95% of mobile-web bugs. Mobile Safari requires extra setup beyond this skill — see `agent-browser skills get core --full` for the WebDriverAgent flow.

### 7. `find` for semantic locators (no snapshot needed)

Skip the snapshot+ref dance for known elements:

```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "test@test.com"
agent-browser find placeholder "Search..." fill "query"
agent-browser find testid "submit-btn" click  # alias for [data-testid="submit-btn"]
agent-browser click "text=Submit"             # short form
agent-browser click "[data-testid='submit']"  # CSS works too
```

Refs are still preferred for AI loops (deterministic, fast), but `find` is ideal for stable elements like login buttons, primary CTAs.

> **Cross-skill note:** `agent-browser find <kind> <value> <action> [--name X]` (action **after** value) differs from `agent-device find <value> <action>` (no kind, no `--name` flag). When porting a scenario between skills, expect the argument order and the kind keyword to change.

---

## Auth strategies — pick the right one

### A. Persistent profile (default, used by StudyFi)

**Best for**: OAuth/SSO flows (Auth0, Google, GitHub OAuth), 2FA, magic links, anything that hates being re-driven by automation.

Profile dir is `~/.agent-browser/work-profile` (env-set). User logs in once via `--headed`; cookies + localStorage + IndexedDB persist forever.

```bash
agent-browser --headed open https://app.example.com/login
# user logs in manually, including 2FA
# next session is already logged in:
agent-browser open https://app.example.com/dashboard
```

**Use this for**: StudyFi (dev + prod), any service the user has personal SSO with.

### B. Auth vault (saved credentials)

**Best for**: simple username + password forms with no MFA, no JS-heavy login (e.g. internal tools, basic admin panels). Credentials encrypted at rest.

```bash
# Set encryption key once (add to ~/.zshrc):
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Save creds (password via stdin, not arg, to keep it out of shell history):
echo "$PASSWORD" | agent-browser auth save my-service \
  --url https://my-service.com/login \
  --username user@example.com \
  --password-stdin

# Use it later:
agent-browser auth login my-service           # fills + submits + waits
agent-browser auth list
agent-browser auth show my-service            # metadata only, no password
agent-browser auth delete my-service
```

If the form has non-standard selectors, pass `--username-selector / --password-selector / --submit-selector`.

**Don't use this for**: Auth0, Google, GitHub OAuth, anything with 2FA — use Profile (A) instead.

### C. Saved state file (cookies only)

**Best for**: short-lived headless workers, CI runs, quickly snapshotting a logged-in session for portability.

```bash
agent-browser state save .ai/browser/eval/auth-state.json
# later, on a different machine or fresh profile:
agent-browser --state .ai/browser/eval/auth-state.json open https://app.example.com
```

State files are encrypted if `AGENT_BROWSER_ENCRYPTION_KEY` is set. **Do not commit** — `.ai/browser/` is gitignored.

### D. Multi-account via `--session`

**Best for**: testing multi-user flows (e.g. one user creates a post, another sees it in feed).

```bash
agent-browser --session userA open https://app.example.com
agent-browser --session userB open https://app.example.com
# Each session has isolated cookies / profile / refs.
```

Combine with `--profile` per session for persistent multi-account: copy `work-profile` to `work-profile-b`, then `--session userB --profile /path/to/work-profile-b`.

### Auth quick decision

| Service                        | Strategy                               |
| ------------------------------ | -------------------------------------- |
| StudyFi dev / prod (Auth0)     | A. Persistent profile (already set up) |
| GitHub web (gh.io login)       | A. Persistent profile                  |
| ClickUp / Linear / Notion      | A. Persistent profile                  |
| Internal admin with form login | B. Auth vault                          |
| CI / GitHub Actions runner     | C. Saved state file (encrypted)        |
| Multi-user E2E test            | D. `--session` per user                |

---

## The core loop (with project conventions)

```bash
agent-browser open http://localhost:3000              # 1. navigate (uses profile env)
agent-browser snapshot -i -c                          # 2. compact snapshot
agent-browser click @e3                               # 3. act on @eN ref
agent-browser screenshot .ai/browser/screenshots/X.png # 4. capture if needed
agent-browser snapshot -i -c                          # 5. re-snapshot (refs renumber!)
```

Refs (`@e1`, `@e2`, ...) are **fresh per snapshot** — they go stale the moment the page changes. Always re-snapshot after a click that navigates, opens a modal, or triggers re-render.

---

## StudyFi-specific recipes

### Quick smoke test of localhost:3000

```bash
agent-browser open http://localhost:3000/app
agent-browser snapshot -i -c                         # confirm logged in (sidebar visible)
agent-browser screenshot .ai/browser/screenshots/smoke-1-home.png
agent-browser click @e12                             # Komunity (refs vary, re-check)
agent-browser wait --text "Doporučení"
agent-browser screenshot .ai/browser/screenshots/smoke-2-komunity.png
```

### Capture network for a feature debug

```bash
agent-browser network har start
agent-browser open http://localhost:3000/app
# trigger the buggy interaction
agent-browser network har stop .ai/browser/har/bug-XYZ.har
agent-browser network requests | grep -E "500|404"   # quick failure scan
```

### Multi-device emulation flow (run the same flow at desktop + mobile + tablet)

Pattern used by the `scenario` skill. agent-browser shares one daemon, so device variants must run **sequentially**:

```bash
run_at_device() {
  local label="$1" device="$2"
  agent-browser set device "$device" >/dev/null
  agent-browser open http://localhost:3000/app
  agent-browser wait --load networkidle
  agent-browser screenshot ".ai/browser/screenshots/$label-1-home.png"
  # ... actions, screenshots ...
}

agent-browser close --all                                # fresh daemon picks up profile env
run_at_device "desktop"     "Desktop"
run_at_device "mobile"      "iPhone 16"
run_at_device "tablet"      "iPad Pro"
agent-browser set device    "Desktop"                    # full reset (UA + viewport + DPR)
```

Use `agent-browser set device "Desktop"` between variants — `set viewport 1280 800` alone leaves the iOS UA on (responsive sites stay in mobile mode). For native iOS / Android variants of the same flow, hand off to the agent-device skill in parallel processes (separate sims, independent daemons).

### Multi-tab dogfood

```bash
agent-browser tab                                    # list
agent-browser tab new http://localhost:3000/app/social
agent-browser tab 2                                  # switch
agent-browser snapshot -i -c                         # refs scoped to active tab
```

### Record a regression video for a PR

```bash
agent-browser record start .ai/browser/video/PR-1234-flow.webm
# ... full user flow ...
agent-browser record stop
# attach the .webm to the PR or convert to GIF
```

### Extract structured data via eval

```bash
cat <<'EOF' | agent-browser eval --stdin > .ai/browser/eval/materials-list.json
const cards = document.querySelectorAll('[data-testid="material-card"]');
JSON.stringify(Array.from(cards).map(c => ({
  title: c.querySelector('h3')?.innerText,
  href: c.querySelector('a')?.href,
})));
EOF
```

Always use `eval --stdin` (heredoc) for any JS with quotes or backticks — inline `eval "..."` only for trivial expressions.

---

## Token efficiency cheat-sheet

| Action            | Cheap                              | Expensive                      |
| ----------------- | ---------------------------------- | ------------------------------ |
| Snapshot          | `snapshot -i -c`                   | `snapshot` (full tree, ~5×)    |
| Screenshot review | `screenshot path.png` then ignore  | `Read path.png` (image tokens) |
| Click             | `click @e3` (returns 9 bytes)      | re-snapshot before each click  |
| Read element text | `get text @e5`                     | re-snapshot for one value      |
| Find element      | `find role button --name "Submit"` | full snapshot to locate        |
| Wait              | `wait @e3` / `wait --text "..."`   | `wait 5000`                    |

**Rule of thumb**: for a 10-step interaction, target <2k tokens of tool output. Compare to Playwright MCP which costs ~3-5k for the same flow.

---

## Troubleshooting

**"Ref not found: @eN"** — page changed since snapshot. Re-snapshot.

**Element exists but not in snapshot** — off-screen or not yet rendered. `scroll down 1000` then re-snapshot, or `wait --text "..."`.

**Click does nothing** — overlay/modal blocking. Snapshot, find dismiss button, click it, re-snapshot.

**Profile flag ignored** — `⚠ --profile ignored: daemon already running`. Run `agent-browser close --all` first, then your command. Daemon picks up the env profile on fresh start.

**`fill` doesn't work on custom inputs** — use `keyboard inserttext` after `focus`:

```bash
agent-browser focus @e2
agent-browser keyboard inserttext "value"
```

**Cross-origin iframe inaccessible** — silently skipped from snapshot. Use `frame "#iframe-selector"` to scope into it, or `eval` in its origin.

**Daemon stuck / weird state** — `agent-browser close --all && agent-browser doctor`. Use `doctor --fix` only if doctor reports failures.

---

## When to fall back to Playwright MCP

Rare. Use Playwright only when:

- agent-browser daemon won't start (after `doctor --fix` fails)
- You need a one-shot screenshot embedded inline immediately (Playwright auto-embeds, agent-browser saves to file)
- You're outside this project where the profile env isn't set

Otherwise: agent-browser is the default, period.

---

## Reference: full command list

```bash
agent-browser skills get core --full      # complete reference (commands, flags, env, templates)
agent-browser doctor                       # diagnose install/profile/daemon
agent-browser profiles                     # list Chrome profiles agent-browser can see
```
