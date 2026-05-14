# DDR-008: `plugins/design/dev-server/bin/` is the canonical home for shared bash helpers

- **Date:** 2026-05-15
- **Status:** Accepted
- **Tags:** design, dev-server, bash, helpers, dry, ci, npm-distribution
- **Related:** [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md), `plugins/design/dev-server/bin/{screenshot,bootstrap-check,server-up,slug}.sh`, `package.json` `files` allowlist, `CLAUDE.md` § Dev-server helpers

## Context

Before Phase 13, the design plugin had a hidden tax: identical bash recipes copy-pasted across slash commands, the orchestrator skill, and several critic agents. Concrete instances counted in the audit:

- **Server lifecycle** (PID + `/_health` check + respawn + poll) — 6 files: `screenshot.md`, `new.md`, `critic.md`, `edit.md`, `rollback.md`, `skills/design/SKILL.md`.
- **Bootstrap detection** (REPO_ROOT + `.design/config.json` + `system/<ds>/` truth table) — 2 files: `new.md`, `edit.md`.
- **Slug normalization** (`tr / sed` recipe) — kanonický v `edit.md`; ostatní místa říkala "compute slug" a nechávala implementaci na orchestrator-readeru.
- **Screenshot CLI** (`agent-browser navigate + screenshot` two-step) — 5+ files including every critic with a "capture if missing" step.

Drift symptoms:

- Server-lifecycle timeouts diverged (10s in `edit.md`, unspecified elsewhere). When a "server start fail" issue surfaced, debugging required reading 6 places to find which one ran.
- `signature-moment-critic.md` referenced `[data-artboard-id]` — a selector that no runtime ever emitted (see [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md)). Silent fallback to `--full` survived for months because the inline bash was opaque.
- `agent-browser screenshot --output <path>` silently no-ops (CLI treats `--output` as positional). The plan flagged this as "the load-bearing gotcha" — five paragraphs of prose warning copy-pasted across files, easy to forget when adding a new caller.

We needed a single source of truth that:

1. Lives next to the runtime it's coupled to (the dev server).
2. Ships to end users via npm (the CLI / slash commands run on user machines, not just in this repo).
3. Doesn't pull in node deps the rest of the plugin avoids (`zero-dep` was the original dev-server contract).
4. Is grep-able and self-documenting — `--help` works, args are explicit, behavior is auditable in one place.

Three placement options considered:

1. **`plugins/design/dev-server/bin/`** — alongside the server it serves. Helpers are dev-server-coupled (URL resolution from `_server.json`, polling `/_health`), so co-location is honest.
2. **`scripts/` at repo root** — alongside `bump-version.sh`, `check-version-parity.sh`. Project-wide convention, but those scripts are *release-time* / *CI* — they run from the repo, not from a user's installed plugin. Putting runtime helpers there blurs that boundary, and `scripts/` isn't shipped via npm.
3. **`cli/lib/`** — alongside the `mdcc` CLI. Closer to "end-user runtime", but the helpers are bash, not Node, and they don't sit on the `mdcc` invocation path. Mixing the two surfaces would force the CLI to either re-implement them in JS or shell out.

## Decision

Adopt **option 1** — `plugins/design/dev-server/bin/` as the canonical home for shared bash helpers:

- **Location:** `plugins/design/dev-server/bin/<name>.sh` (or `_<name>.mjs` for committed Node shims like `_screenshot-playwright.mjs`).
- **API contract:** each helper:
  - Supports `--help` / `-h` with the same format (header comment block printed via `sed -n`).
  - Writes diagnostic to stderr, machine-readable output (paths / port / json) to stdout.
  - Uses exit codes meaningfully: `0` success, `1` missing dependency / runtime fail, `2` bad args, `3` operation failed.
  - Resolves `$CLAUDE_PLUGIN_ROOT` first, falls back to `$(dirname "$0")/..` — works both inside Claude Code and standalone bash.
  - No `set -euo pipefail` (matches `scripts/bump-version.sh` style — defensive checks where they matter, not a hammer).
- **Distribution:** already shipped via npm — `package.json` `files: ["plugins/design/dev-server"]` is recursive, so `bin/` is included automatically. Verified via `npm pack --dry-run | grep dev-server/bin/`.
- **Caller contract:** slash commands / skills / critics invoke via `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/<helper>.sh" …`. Inline bash duplicates are prohibited going forward — `/flow:validate` Step 8a greps for the patterns and warns.
- **Naming:** `<verb>.sh` for the primary entry (`screenshot.sh`, `slug.sh`); `<noun>-<verb>.sh` for compound (`bootstrap-check.sh`, `server-up.sh`). `_` prefix for committed-but-not-directly-invoked shims (`_screenshot-playwright.mjs`).

## Rejected alternatives

**Option 2 (`scripts/`)** rejected because:

- Boundary violation: `scripts/` is release / CI tooling that runs from the repo. Runtime helpers run from end-user machines via the installed plugin.
- Not shipped via npm. `scripts/` would need an explicit `files` entry, AND we'd need to wire `$CLAUDE_PLUGIN_ROOT/../../scripts/<name>.sh` from inside plugin files — fragile across install layouts.

**Option 3 (`cli/lib/`)** rejected because:

- Bash + Node mix on the same surface is harder to maintain than bash-in-bash-home or Node-in-Node-home.
- The CLI calls server.mjs out-of-band (subprocess); helpers don't pass through `mdcc` and shouldn't.
- Forces the CLI surface to advertise helpers as part of its contract, which they aren't — they're plugin internals that happen to be reachable.

## Consequences

**Positive:**

- Single edit point. Changing the server-lifecycle timeout (e.g. 10s → 15s for slow CI sandboxes) requires one file edit, not six.
- Audit by grep: `/flow:validate` Step 8a catches new inline duplicates as drift before they accumulate.
- `--help` on every helper is the contract — new contributors learn the API from the script itself, not the consumer-side prose.
- Playwright fallback is hidden behind the same `screenshot.sh` API. Callers don't need to know which engine ran — engine choice + diagnostic surface in stderr.

**Negative / tradeoffs:**

- Bash is read-once-write-many — debugging a helper bug means tracing through `bash -x` instead of stepping a JS runtime. Mitigation: keep each helper < ~150 LOC; complex logic goes into a committed `.mjs` shim that bash invokes.
- `$CLAUDE_PLUGIN_ROOT` resolution requires every caller to expand it correctly. Falls back to script-relative path when env is unset, but standalone invocations from foreign CWDs must pass `--root` explicitly.
- Helpers only cover the design plugin's seams. Flow plugin has its own slash commands with their own state files; cross-plugin helpers (if needed later) need a different home (likely `plugins/_shared/bin/` or hoisted to `cli/lib/bin/`).

## Future direction

When the helper count grows past ~5–6 inside `dev-server/bin/`, audit whether any of them is generic enough to hoist to a project-wide `_shared/` location. Until then, co-location with the dev-server stays the right tradeoff — these helpers exist because of the server's runtime contract (URLs, ports, state files).
