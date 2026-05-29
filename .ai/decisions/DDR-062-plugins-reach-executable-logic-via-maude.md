# DDR-062 — Plugins reach ALL executable logic through the on-PATH `maude` CLI

- **Date:** 2026-05-29
- **Status:** Accepted
- **Tags:** design, flow, dev-server, cli, marketplace, npm-distribution, reachability, dispatch, phase-c, lever-6
- **Related:** [DDR-061](DDR-061-sidecar-cache-monitor-background-orchestration.md) (the reachability finding this generalizes — `maude cache get/put` + `maude preflight` already moved off relative `cli/lib`), [DDR-045](DDR-045-real-disk-path-resolution-for-compiled-dev-server.md) (real-disk path resolution — `maude` resolves bundled helpers from its own `__dirname`, never `/$bunfs/root`), [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (the marketplace-clone-vs-npm-install distinction that makes this necessary), [DDR-008](DDR-008-dev-server-bin-canonical-helper-home.md) (amended — the bin scripts remain the canonical home, now invoked via `maude design <verb>`). Plan: `.ai/plans/phase-c-sidecar-monitor-background.md` (Lever 6 / PR7).

## Context

A plugin command reached executable logic two different ways before this change, and **both** bit us in production:

1. **Relative `cli/lib/*.mjs`** (`$PKG_ROOT/cli/lib/…`) — **broken in every marketplace install.** The marketplace copies each plugin alone into `cache/<marketplace>/<plugin>/<version>/`, so the repo's sibling `cli/` is never present. This crashed `/design:init`'s preflight live (`Cannot find module …/cache/maude/cli/lib/preflight.mjs`). DDR-061 fixed cache + preflight by routing through the on-PATH `maude` binary.

2. **`bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/X.sh"`** — depends on `CLAUDE_PLUGIN_ROOT` being set correctly in the bash environment. Two failure modes:
   - In a real `/design:init` run it came back **EMPTY**, forcing the orchestrator to `find` the plugin by hand.
   - In **flow** commands it points at `plugins/flow` — which has **no `dev-server/` at all** — so `/flow:execute`'s phase-end smoke gate (`bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/smoke.sh"`) and the scenario report path were cross-plugin-broken by construction.

`maude` is already a declared plugin dependency the user must keep current. So there is exactly **one robust contract** worth standardizing on.

## Decision

**Plugin markdown invokes only the on-PATH `maude` binary for executable logic. `maude` resolves everything from its own install location and sets `CLAUDE_PLUGIN_ROOT` authoritatively for any child it spawns.**

Concretely:

- The design dev-server's bash helpers are dispatched via **`maude design <verb>`** — a whitelisted verb set (`screenshot`, `server-up`, `prep`, `slug`, `bootstrap-check`, `runtime-health`, `smoke`, `canvas-edit`, `handoff`, `asset-sweep`, `visual-sanity`) in `cli/commands/design.mjs`. `maude` resolves the helper from its OWN `pkgRoot` (`<pkgRoot>/plugins/design/dev-server/bin/<verb>.sh`) — **never** from `CLAUDE_PLUGIN_ROOT` — and execs it with `stdio: 'inherit'` so stdout / stderr / exit-code pass straight through (preserving `$(maude design slug …)` capture, `eval "$(maude design prep --shell-export …)"`, and non-zero gating). It sets `CLAUDE_PLUGIN_ROOT=<pkgRoot>/plugins/design` in the child env so the scripts' own sibling-resolution keeps working unchanged.
- The whitelist (not arbitrary `<verb>.sh` exec) keeps this off the path-traversal / arbitrary-script-exec surface.
- `cli/lib/*` logic the slash-commands need is reached via the matching top-level subcommand (`maude cache get/put`, `maude preflight --plugin <p>`, `maude scenario-report <run-dir>`) — the DDR-061 contract, now the universal rule.
- **Prose mentions** of a helper's path are fine; **invocations** (preceded by `bash`/`sh`/`exec` or inside `$(…)`) are banned in plugin markdown. `cli/lib/plugin-cli-reachability.test.mjs` enforces both halves (the DDR-061 `node cli/lib/*.mjs` ban + this DDR-062 `dev-server/bin/*.sh` invocation ban).

## Rejected alternatives

- **Keep `$CLAUDE_PLUGIN_ROOT/dev-server/bin` invocations, just set the env var harder.** The flow-plugin case has no fix — `plugins/flow` will never contain `dev-server/`. And the marketplace-copies-plugin-alone problem means the design plugin's own copy may not be where `CLAUDE_PLUGIN_ROOT` points either. Routing through `maude` (which ships the dev-server inside its npm package, `package.json` `files`) is the only resolution that holds across all install shapes.
- **A generic `maude design exec <path>`.** Rejected — arbitrary-path exec is a security surface. The whitelist is the guardrail.
- **Symlink the dev-server into each plugin.** Fragile across the marketplace clone + npm tarball + bun-compile binary shapes; `maude`-as-resolver sidesteps it entirely.

## Consequences

- **Version skew:** `maude design <verb>` runs the bin scripts from **maude's** package copy, not the marketplace plugin's copy. In production both track the same release; a stale global `maude` means stale helpers (the same caveat as `maude cache get/put`). Documented in README + CLAUDE.md.
- **Rollback is clean:** revert the markdown rewrite and the dispatch is dead code — the bin scripts are untouched, so old `$CLAUDE_PLUGIN_ROOT/dev-server/bin` calls would work again (where they worked before).
- **`check-runtime-bundles.sh` stays a direct bin script** — it's CI / `prepublishOnly` only, never invoked from plugin markdown, so it is intentionally NOT routed through `maude` and NOT on the whitelist. `_*-playwright.mjs` likewise stays an internal shim called by `screenshot.sh`.

## Future direction

A follow-up could add `maude design cat <asset>` so markdown that reads **non-executable** plugin data (`canvas-lib.tsx`, agent config JSON) also stops depending on `$CLAUDE_PLUGIN_ROOT`. Out of scope here — this DDR covers executable logic only.
