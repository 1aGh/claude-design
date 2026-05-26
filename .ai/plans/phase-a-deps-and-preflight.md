# Phase A — Plugin dependency manifest + preflight + `maude doctor`

> **Greenfield user safety.** Today a new user can install Maude via the marketplace and run `/design:screenshot` only to fail mid-flow because `agent-browser` is not on PATH. The dev-server itself silently 500s on missing `react` until v0.18.0 self-heal kicks in. There is no canonical "what does Maude need" document. This phase fixes that.
>
> Scope: **user safety, not speed.** Phase B handles orchestration latency. Phase C handles cache/Monitor/background.

---

## Problem (concrete cases this phase fixes)

1. **`agent-browser` silently missing.** `/design:screenshot`, `/design:new` step 9, `/flow:scenario` all hard-require `agent-browser`. Today they fail with whatever cryptic error the binary returns when invoked via Bash. No upfront check, no install hint.
2. **`agent-device` requires Xcode + Android SDK** to actually function. `/flow:scenario` and `/flow:utils-verify` invoke it for native paths. No detection on macOS without iOS sim configured.
3. **`bun` is hard for the dev-server build pipeline.** Per DDR-009 Phase 3.4 the dev-server is migrating to Bun authoritatively. Today the dev-server falls back to Node but the Bun path is the documented one.
4. **MCP servers go undiagnosed.** `AskUserQuestion` falls back to numbered-prose chat, but no one tells the user that fallback engaged because their MCP config is broken. `WebSearch`/`WebFetch` failures during `ux-research-agent` look like "research returned empty" with no remediation.
5. **No `maude doctor`.** Users have no "is my install healthy" command. The CLI ships `init`, `config`, `design serve` — but nothing diagnostic.
6. **Per-command repeated checks.** `/design:init` and `/flow:init` both check `node >=20` and `git` independently. `/design:setup-ds` auto-invokes `/design:init` which re-runs the same checks. Cumulative ~5–15 s wasted on duplicate preflight per session start. (This bleed-over with Phase B is intentional — fixing it once at the manifest level helps both phases.)

---

## Solution shape

Three artifacts plus glue.

### 1. Per-plugin `dependencies.json` (canonical schema)

One file per plugin: `plugins/design/dependencies.json`, `plugins/flow/dependencies.json`. Single source of truth — both `maude doctor` and the preflight script read this file; nothing else duplicates the list.

**Schema (JSON Schema in `plugins/<plugin>/dependencies.schema.json`):**

```jsonc
{
  "$schema": "./dependencies.schema.json",
  "version": "1",
  "plugin": "design",
  "dependencies": [
    {
      "id": "agent-browser",
      "type": "cli",                                  // cli | mcp | node-package | bun-package | system-tool
      "hardness": "hard",                             // hard | soft (soft = graceful degradation possible)
      "check": { "command": "agent-browser --version", "expectExit": 0 },
      "install": {
        "preferred": "npm i -g @anthropic-ai/agent-browser",
        "darwin":    "brew install anthropics/brew/agent-browser",
        "linux":     "npm i -g @anthropic-ai/agent-browser",
        "win32":     "npm i -g @anthropic-ai/agent-browser"
      },
      "autoInstall": true,                            // maude doctor --fix may run install.preferred
      "usedBy": [
        "commands/screenshot.md",
        "commands/new.md",
        "commands/edit.md",
        "agents/design-critic.md",
        "agents/signature-moment-critic.md",
        "dev-server/bin/screenshot.sh"
      ],
      "docsUrl": "https://github.com/anthropics/agent-browser",
      "minVersion": null
    },
    {
      "id": "playwright",
      "type": "cli",
      "hardness": "soft",
      "check": { "command": "npx --no-install playwright --version", "expectExit": 0 },
      "install": { "preferred": "npx playwright install" },
      "autoInstall": false,                           // playwright install pulls 400MB; never auto
      "usedBy": ["dev-server/bin/screenshot.sh (fallback only)"],
      "fallbackFor": "agent-browser",
      "minVersion": null
    },
    {
      "id": "bun",
      "type": "cli",
      "hardness": "hard",
      "check": { "command": "bun --version", "expectExit": 0, "minVersion": "1.3.0" },
      "install": {
        "preferred": "curl -fsSL https://bun.sh/install | bash",
        "darwin":    "brew install oven-sh/bun/bun",
        "linux":     "curl -fsSL https://bun.sh/install | bash",
        "win32":     "powershell -c \"irm bun.sh/install.ps1|iex\""
      },
      "autoInstall": false,                           // touches shell rc, never auto
      "usedBy": ["dev-server/build.ts", "dev-server/server.mjs (Phase 3.4)"],
      "docsUrl": "https://bun.sh"
    },
    {
      "id": "agent-device",
      "type": "cli",
      "hardness": "soft",                             // only required for native scenario paths
      "check": { "command": "agent-device --version", "expectExit": 0 },
      "install": { "preferred": "npm i -g @anthropic-ai/agent-device" },
      "autoInstall": true,
      "extraRequirements": ["xcode (macOS)", "android-sdk (cross-platform)"],
      "usedBy": ["commands/scenario.md (native paths)", "skills/scenario/SKILL.md"]
    },
    {
      "id": "askuserquestion-mcp",
      "type": "mcp",
      "hardness": "soft",
      "check": { "mcp": "AskUserQuestion", "tool": "ask" },
      "fallbackBehavior": "numbered-prose-chat",
      "usedBy": ["commands/setup-ds.md", "commands/new.md", "commands/edit.md"],
      "docsUrl": "..."
    }
    // ... full list emerges from audit (see Task A1)
  ]
}
```

### 2. New helper `plugins/<plugin>/dev-server/bin/preflight.sh` (design plugin) + `cli/lib/preflight.mjs` (flow + CLI side)

Both consume the same `dependencies.json`. Output modes:

| Mode | Output | Exit code |
|---|---|---|
| Default (text) | Table with ✓/✗/⚠ per dep + install hint for failing | 0 if all hard pass; 1 if any hard fail |
| `--json` | Machine-readable result for orchestrator | same |
| `--shell-export` | `export DEPS_OK=1 DEPS_MISSING="bun,agent-device"` | same |
| `--quiet` | Only print missing hard deps; silent on success | same |
| `--fix` | Run `install.preferred` for each dep where `autoInstall: true` | 0 on success, 1 on install failure |

The CLI side (`cli/lib/preflight.mjs`) handles `maude doctor`. The dev-server side (`bin/preflight.sh`) handles in-skill checks (one bash call from a slash command).

### 3. New CLI command `maude doctor`

```sh
maude doctor                  # run full preflight across both plugins, print table
maude doctor --plugin design  # scope to one plugin
maude doctor --fix            # attempt auto-install for autoInstall: true deps
maude doctor --json           # machine-readable
```

`maude doctor --fix` is **never invoked silently**. The user has to type the flag. This honors the "auto-install kde to jde" answer without surprise installs on plain `maude doctor`.

### 4. Wire into existing init flows

- `plugins/design/commands/init.md` step 1 (pre-flight): replace inline `command -v` checks with a single `bash $CLAUDE_PLUGIN_ROOT/dev-server/bin/preflight.sh --shell-export`. Source the export, render the same table format the spec already documents.
- `plugins/flow/commands/init.md` step 1: same pattern; the CLI version of preflight lives in `cli/lib/preflight.mjs` and is invoked via `node $CLAUDE_PLUGIN_ROOT/../../cli/lib/preflight.mjs` (or, post-bundling, via `maude doctor --quiet --json`).
- Cross-command short-circuit: write `_preflight.json` to `<designRoot>/` with `{ checked: <iso-ts>, all_hard_pass: true }`. Other commands (`/design:setup-ds`, `/design:new`, `/design:edit`) skip preflight if the file is fresh (`<5 min`).

### 5. SessionStart hook (best-effort warn)

Per research finding §10 — SessionStart hooks **cannot block** session start, but they CAN print a warning that Claude sees as a session note.

Add `plugins/design/hooks.json` + `plugins/flow/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/dev-server/bin/preflight.sh --quiet --warn-only",
        "timeout": 8
      }]
    }]
  }
}
```

Output appears at session start if hard deps are missing. The user (and Claude) immediately know to run `maude doctor --fix` before any /design or /flow command. No mid-flow failure.

---

## Tasks

### A1 — Enumerate canonical dep list

- **Do:** Walk every file under `plugins/design/{commands,agents,skills}/` and `plugins/flow/{commands,agents,skills}/` plus `plugins/design/dev-server/bin/*.sh`. For each dep mentioned (CLI binary, MCP, npm package), record id + hardness + which file referenced it.
- **Source:** the dependency inventory already produced in this planning round — see the audit summary table (9 CLI binaries, 3 MCP servers, 11 npm runtime packages for the design plugin; 2 CLI binaries for flow).
- **Output:** `plugins/design/dependencies.json` + `plugins/flow/dependencies.json`, both validated against the schema.
- **Validate:** `node -e "require('./plugins/design/dependencies.json')"` parses; every `id` is unique; every `usedBy` path exists on disk.

### A2 — Write the JSON Schema

- **Do:** Create `plugins/<plugin>/dependencies.schema.json` matching the structure in §1. Reference from `dependencies.json` via `$schema`.
- **Gotcha:** keep `check.command` as a string (not array) — it executes via `bash -c`, allowing pipes if needed.
- **Validate:** ajv-cli against both `dependencies.json` files. If ajv-cli isn't available, hand-roll a minimal validator in `cli/lib/validate-deps-schema.mjs` (~30 lines, no deps).

### A3 — Build `preflight.sh` (shell helper for design plugin)

- **Do:** Create `plugins/design/dev-server/bin/preflight.sh`. Read `../dependencies.json` (relative resolution per DDR-045 → use `paths.ts`-style env vars). Loop deps, run `check.command`, collect results. Print mode-specific output.
- **Pattern:** mirror existing helper conventions from `screenshot.sh`, `bootstrap-check.sh`, `server-up.sh` (small, zero npm deps, fast).
- **Gotcha:** the dev-server may run from a compiled bundle (Bun standalone). Use `$CLAUDE_PLUGIN_ROOT` env var (set by Claude Code), not `dirname $0` — same lesson as DDR-045.
- **Validate:** `bash plugins/design/dev-server/bin/preflight.sh --json | jq '.summary'` returns valid JSON.

### A4 — Build `cli/lib/preflight.mjs` (Node-side helper)

- **Do:** Mirror `preflight.sh` in Node — same logic, same output modes — but for the flow plugin and `maude doctor`. Imports from `cli/bin/maude.mjs`.
- **Pattern:** mirror `cli/commands/config.mjs` (zero deps, child_process for the `check.command`).
- **Validate:** `node cli/lib/preflight.mjs --plugin design --json` matches `bash preflight.sh --json` output.

### A5 — Implement `maude doctor` subcommand

- **Do:** Add `cli/commands/doctor.mjs`. Wire into `cli/bin/maude.mjs` command dispatch. Subcommands: bare (default), `--plugin <name>`, `--fix`, `--json`.
- **`--fix` behavior:** for each failing hard dep where `autoInstall: true`, prompt `Install <id> via "<install.preferred>"? [y/N]`. If yes, spawn the install command. Re-check after install. Print final summary.
- **Pattern:** mirror `cli/commands/init.mjs` argv parsing.
- **Validate:** `maude doctor --json` on a machine missing `agent-browser` returns `summary.failures: ["agent-browser"]` and exit code 1.

### A6 — Wire into `/design:init` and `/flow:init`

- **Do:** Edit `plugins/design/commands/init.md` step 1 (pre-flight section, ~line 30): replace the inline `command -v node`, `command -v git`, `command -v maude`, `command -v agent-browser` block with a single `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/preflight.sh" --shell-export | source /dev/stdin`. Then read the exported variables and render the existing table format. Same change in `plugins/flow/commands/init.md` step 1 using `node "$CLAUDE_PLUGIN_ROOT/../../cli/lib/preflight.mjs"`.
- **Gotcha:** `init.md` is read by Claude, not bash — the bash recipe in the markdown is what Claude executes. Keep the markdown human-readable.
- **Validate:** `/design:init` on a clean machine prints the same table it does today, but the dep list is now sourced from `dependencies.json`. Editing `dependencies.json` (e.g. adding `vhs` as a soft dep) shows up in the next `/design:init` run without editing the .md.

### A7 — Cross-command short-circuit (`_preflight.json`)

- **Do:** After successful preflight, `preflight.sh` and `preflight.mjs` write `<designRoot>/_preflight.json` (design) and `.ai/state/_preflight.json` (flow): `{ checked: <iso>, plugin: "design", all_hard_pass: true, soft_warnings: [...] }`. Other commands (`/design:setup-ds`, `/design:new`, `/design:edit`) read this file first; if `Date.now() - checked < 5min` and `all_hard_pass: true`, skip preflight entirely.
- **Gotcha:** the freshness file lives in `<designRoot>/` (gitignored alongside `_server.json`) for design, and `.ai/state/` for flow. Both already gitignored.
- **Validate:** invoke `/design:init`, then immediately `/design:new` — second command should print "preflight cached, skipping" or similar marker.

### A8 — SessionStart hook for session-wide warning

- **Do:** Add `plugins/design/hooks.json` + `plugins/flow/hooks.json` as in §5. Hook body is one line: invoke `preflight.sh --quiet --warn-only`. Output is a single line "MISSING HARD DEPS: bun, agent-browser. Run `maude doctor --fix` to install." (or silent on success).
- **Gotcha:** SessionStart hook cannot prompt (research §10). It can only print. Make output very short; long output bloats every session start.
- **Validate:** start a fresh `claude` session in a repo where `agent-browser` is missing → see the warning appear in the session start output.

### A9 — Update package.json `files` so manifests ship via npm

- **Do:** Add `plugins/design/dependencies.json`, `plugins/design/dependencies.schema.json`, `plugins/flow/dependencies.json`, `plugins/flow/dependencies.schema.json` to `package.json` `files` array. Same for `plugins/<plugin>/hooks.json`. Verify the dev-server `bin/preflight.sh` is already covered by the existing `plugins/design/dev-server/` entry; if not, add `plugins/design/dev-server/bin/preflight.sh` explicitly.
- **Pattern:** see CLAUDE.md "Published npm surface" — the `files` list is intentionally minimal; add explicitly.
- **Validate:** `npm pack --dry-run` shows the new files in the tarball.

### A10 — Update CLAUDE.md + README

- **Do:** In `CLAUDE.md`, add a "Dependency manifests" subsection under "Architecture" pointing at the two `dependencies.json` files and `maude doctor`. In `README.md`, add a "Prerequisites" section that says "Run `maude doctor` after installing the plugin to check your machine has the required dependencies."
- **Validate:** grep README + CLAUDE.md for "doctor" — appears at least once each.

### A11 — Backfill DDR

- **Do:** Write `.ai/decisions/DDR-047-plugin-dependency-manifest.md`. Title: "Per-plugin dependencies.json as single source of truth, `maude doctor` as user-facing diagnostic, SessionStart hook for passive warn." Cite the audit findings from this planning round.
- **Pattern:** mirror existing DDRs in `.ai/decisions/`.
- **Validate:** DDR linked from CLAUDE.md.

---

## Validation

1. **Schema validates:** `node cli/lib/validate-deps-schema.mjs` passes for both plugins.
2. **Doctor on clean machine prints actionable table:** spin up a docker container with `node:20-alpine`, `npm i -g @1agh/maude`, run `maude doctor` → table shows `agent-browser ✗ — run npm i -g @anthropic-ai/agent-browser`.
3. **Doctor --fix actually installs:** in the same container, `maude doctor --fix`, accept prompt, re-run `maude doctor` → all hard deps now ✓.
4. **SessionStart hook fires:** in a Claude Code session with the plugin installed and a hard dep missing, the warning appears before the first prompt.
5. **Cross-command short-circuit:** run `/design:init` then `/design:new` back-to-back; second command's bash log shows preflight skipped.
6. **Manual:** the existing happy-path flows (`/design:new`, `/design:edit`, `/design:setup-ds`) still work without regression.

---

## Acceptance criteria

- [ ] Both `dependencies.json` files exist, schema-validated, list every dep surfaced in the audit (~9 CLI + 3 MCP + 11 npm = 23 entries for design; 2 CLI for flow + shared)
- [ ] `maude doctor` works in all four modes (default, `--plugin`, `--fix`, `--json`)
- [ ] `/design:init` and `/flow:init` source from the manifest, no hardcoded `command -v` chain
- [ ] `_preflight.json` cache shortcuts repeated checks within 5 min
- [ ] SessionStart hook prints actionable warning when hard deps missing
- [ ] `package.json` files array updated; `npm pack --dry-run` includes the new files
- [ ] DDR-047 written
- [ ] CLAUDE.md + README mention `maude doctor`
- [ ] Version bumped via `scripts/bump-version.sh minor` (new feature)

---

## Out of scope (defer to Phase B / Phase C)

- Splitting oversized SKILL.md files (Phase B)
- Parallel subagent fan-out rewording (Phase B)
- Sidecar cache for research results (Phase C)
- Monitor pattern in server-up.sh (Phase C)

## Decisions to record

- DDR-047 (this plan): dependency-manifest pattern + `maude doctor`.
- Maybe DDR-048: SessionStart hook policy (warn-only vs blocking) once we observe how often users actually act on the warning.

## Estimated effort

~1 week of focused work. ~15 commits. Single PR per task is overkill; group into 4 PRs: (1) schema + manifests A1+A2; (2) preflight helpers A3+A4; (3) doctor CLI + init wiring A5+A6+A7; (4) hook + docs A8+A9+A10+A11.
