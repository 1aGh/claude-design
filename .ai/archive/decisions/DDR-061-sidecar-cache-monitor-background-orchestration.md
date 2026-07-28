# DDR-061 — Sidecar cache layout + Monitor pattern + background-overlap orchestration (Phase C)

> **Renumbered from DDR-049 → DDR-061 (2026-05-29):** the Phase C plan text reserved "DDR-049", but 049 was already taken (`DDR-049-motion-one-as-canonical-motion-library.md`). 060 was then claimed mid-session by a concurrent session (`DDR-060-tsx-only-format-breaks-html-centric-sync.md`, 2026-05-28) — so next-free is 061. The "always cite next-free, never hardcode a DDR number in a plan" lesson lands a fifth time (see DDR-058 / DDR-059 headers), now compounded by a concurrent-session race for the number itself.

**Status:** Accepted — 2026-05-29. **PR1–3 shipped** (cache layout + library + research/codebase/design-context wiring + `maude cache` CLI + security-review consolidation). **PR4–6 planned** (Monitor pattern, async dev-server boot, background-overlap, skip-if-clean, scenario speed, smoke incremental) — this DDR pre-records their conventions so the later PRs implement against a fixed contract.

**Related:** [DDR-059](DDR-059-orchestration-speed-parallel-lazyload-prep.md) (Phase B — "one call, not many" latency work; Phase C is its sequel), [DDR-058](DDR-058-maude-doctor-deps-config-quality.md) (slash commands call `cli/lib/*` directly — same instinct the cache wiring follows), [DDR-044](DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) (the marketplace-clone-vs-npm-install distinction that determines where the cache lib is reachable from). Plan: `.ai/plans/phase-c-sidecar-monitor-background.md`.

## Context

Phases A (deps) and B (parallel fan-out + lazy-load) removed the cheap latency taxes. The expensive ones remain:

1. **Identical work re-run** across sessions — `ux-research-agent` discovery (6–8 WebSearch + synthesis, 30–90 s), `codebase-intelligence` scans, design-context CSS/lib parsing — with no cross-session cache.
2. **Sync polling** for things that should push (server health, long subagents, screenshot completion).
3. **Synchronous blocking** on independent steps (screenshot while critics prep, dev-server build while config parses).

User is on a max subscription → token cost is irrelevant; the only metric is latency and correctness.

## Decision

### 1. Sidecar cache layout (shipped)

A canonical, project-local cache tree at `<repo>/.ai/cache/`, written/read through one zero-dependency library `cli/lib/cache.mjs`. JSON-only, atomic writes (tempfile + rename), best-effort hit/miss telemetry.

```
.ai/cache/
├── _stats.json                              # hit/miss counters (gitignored)
├── README.md                                # auto-written policy doc (gitignored)
├── research/domain/<slug>--<mode>.json      # COMMITTED — generic per-domain pool
├── research/project/<brief-sha8>--<mode>.json  # gitignored — per-brief layer
├── codebase-intelligence/<files-sha>.json   # COMMITTED — keyed on HEAD+dirtiness SHA
├── design-context/<ds-name>/<tokens-sha>.json  # gitignored — parsed DS vocabulary
├── security/<head-sha>.json                 # gitignored — review reuse, 1 h TTL
└── scenario/<name>/<covers-sha>.json        # gitignored — per-run (PR6)
```

**Library API:** `check(layer, key)`, `write(layer, key, value, meta)`, `getOrCompute({layer, key, ttlMs, maxAgeMs, force, compute})`, plus management surface `list()`, `entries(layer)`, `stats()`, `clear(layer?, key?)`, and a `sha8(input)` key helper. The cache root resolves `opts.cacheDir → $MAUDE_CACHE_DIR → $CLAUDE_PROJECT_DIR/.ai/cache → cwd/.ai/cache`.

**Reachability — plugins reach the cache through the `maude` CLI, never a relative path.** Slash commands/agents call `maude cache get <layer> <key> [--ttl-ms N]` (stdout = value on a fresh hit, exit 0; silent + exit 1 on miss/stale) and `maude cache put <layer> <key> [file]`. The `maude` binary is a **declared plugin dependency** (`plugins/*/dependencies.json`, checked by `/design:init` + `/flow:init`) and is therefore on PATH — the one cache entry point reachable from a plugin across every install shape.

> **Correction (2026-05-29, found while live-testing):** an earlier draft of this DDR had plugins `import` the lib via `${CLAUDE_PLUGIN_ROOT}/../../cli/lib/cache.mjs`, on the DDR-044 assumption that "marketplace clones the whole repo so cli/ is a sibling." **That is false.** The marketplace copies each plugin *alone* into `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` (verified: `cache/maude/` contains only `design/` + `flow/`, never the repo's `cli/`) — for github AND directory sources. So `../../cli/lib/cache.mjs` resolves to a non-existent `cache/<marketplace>/cli/...` and the relative-path wiring was a silent no-op in every real install. The relative path was the actual hack; routing through the declared `maude` dependency is the correct decoupling. The CLI's own `maude cache` imports the lib directly (it ships in the npm package's `cli/`).

### 2. Commit-vs-gitignore policy (shipped)

**Commit** `research/domain/` + `codebase-intelligence/` — both are content/SHA-addressed and shareable across collaborators on the same tree (mirrors the `site/lib/roadmap.json` "commit it" decision). **Gitignore** `research/project/`, `design-context/`, `security/`, `scenario/`, `_stats.json`, `README.md` — brief/run/HEAD-specific or local telemetry. Implemented as a negation block in this repo's `.gitignore` and shipped to downstream repos via `plugins/flow/templates/ai-skeleton/gitignore` (renamed to `.ai/.gitignore` on `maude init` — npm strips dotfile `.gitignore` from tarballs, hence the rename hook in `cli/commands/init.mjs`).

### 3. Invalidation policy — correctness > hit-rate (shipped, load-bearing)

A wrong cached payload silently biases everything downstream (a bad domain-research payload would skew every DS bootstrap in that domain). Therefore:

- **Content-addressed layers** (`codebase-intelligence`, `design-context`, `scenario`) embed a SHA of their inputs in the key — a changed input produces a new key → guaranteed miss. The key *is* the invalidation signal. `codebase-intelligence` keys on `hash(HEAD + git status --porcelain)` so uncommitted edits invalidate too; `design-context` keys on `hash(_components.css + colors_and_type.css + canvas-lib.tsx)`.
- **Time-decayed layers** (`research/*`, `security`) carry an explicit TTL: `research/domain` 7 d fresh / 30 d ceiling; `research/project` 30 d / 90 d; `security` a hard 1 h window keyed on HEAD.
- `getOrCompute` **never serves a stale entry speculatively** — only as a fallback when `compute()` throws (and only within `maxAgeMs`).

### 4. Cache wiring (shipped)

- **`ux-research-agent`** — two layers atop the existing caller-provided `cached_payload`: a generic `research/domain` layer (slug+mode key) that lets a same-domain brief skip the 6–8 WebSearch and run only project refinement, and a `research/project` layer (brief-SHA+mode) for cross-session exact reuse.
- **`codebase-intelligence`** — a deterministic freshness gate: `/flow:plan` + `/flow:utils-verify` `check("codebase-intelligence", FILES_SHA)` before rescanning; the cached map reflects the exact tree.
- **design-context** — `/design:edit` + `/design:new` step 1.5 cache a compact DS vocabulary pack (class names + token names + canvas-lib exports), so repeat edits/creates on an unchanged DS skip the ~6 KB CSS + ~58 KB canvas-lib reads.
- **security-review consolidation** — the three independently hand-rolled "reuse if HEAD unchanged within 1 h" windows (`done.md`, `validate.md`, `validate-security.md`) collapse to one `security/<head-sha>` layer (TTL 1 h). `validate-security.md` pre-flight owns the canonical recipe; `done` + `validate` reference it. One window, no per-command drift.

### 5. `maude cache` CLI (shipped)

Two surfaces, one binary:
- **Human:** `maude cache list | stats | inspect <layer> [key] | clear [layer[/key]]` — layers/sizes/last-write, hit-rate per layer, per-entry detail, and wipe.
- **Programmatic (the plugin wiring contract):** `maude cache get <layer> <key> [--ttl-ms N]` (compact-JSON value on a fresh hit / exit 1 on miss-stale, so bash `$(…)` is empty exactly when work is needed) and `maude cache put <layer> <key> [file] [--meta JSON]` (value from file or stdin).

Registered in `cli/bin/maude.mjs` + `maude help`.

### 6. Monitor + background-overlap conventions (planned — PR4–6)

Pre-recorded so later PRs build against a fixed contract:

- **Monitor for push-based waits** (PR4): `server-up.sh` gains a `--monitor` watch mode emitting one line per status change (`BOOTING` / `HEALTH_OK` / `HEALTH_FAIL`); the orchestrator runs it under Monitor and interleaves other work. Same pattern generalizes to scenario sim/AVD boot (PR6 C16).
- **Async dev-server boot** (PR4 C9): listen on the port immediately with `/_health → {ready:false, building:true}`, run build in background, flip to `{ready:true}`. Monitor on `/_health` pushes the flip.
- **`run_in_background` + streaming** (PR5): screenshots fire in background while critic prompts prep; critics write verdicts to `<canvas>/_critic-reports/<critic>.json` as they finish (orchestrator tails via Monitor). **The final consolidated JSON is still written LAST** so the `/design:edit --perfect` auto-fix loop sees the unchanged whole-panel contract.
- **Skip-if-clean** (PR5 C13/C14, PR6 C15): `/flow:validate` skips on an unchanged tree; `/design:new` prompts on an identical brief; per-scenario skip keys on a `covers` manifest hash → the `scenario/` cache layer named in this layout.
- **Monitor minimum version** is Claude Code v2.1.98+ — to be pinned in `package.json` engines / README Prerequisites when PR4 lands.

## Consequences

- **Repo growth.** Committed `research/domain/` + `codebase-intelligence/` grow the repo. Watch size; if `research/domain/` exceeds ~5 MB after 3 months, add `maude cache prune --older-than 60d` (possible DDR-063; DDR-062 is reserved for the Lever 6 plugin→CLI-entrypoint rule).
- **Background work + sandbox modes.** Some sandbox configs disable `run_in_background`; PR4–6 must fall back to sequential, never hard-require background.
- **`maude` must be on PATH** for the plugin wiring to fire. It's a declared dependency (`/design:init` + `/flow:init` check it), so this is already the contract — but if `maude` is absent, `maude cache get` fails, the recipe treats it as a miss, and the command runs uncached (graceful degradation, never an error). The CLI version must be new enough to have `cache get/put` (this PR); an older global `maude` is a silent no-op until upgraded.

## Alternatives considered

- **Global (cross-repo) shared cache.** Out of scope — requires runtime support we don't control (the plan's "Out of scope"). The committed `research/domain/` layer gives cross-collaborator sharing within a repo, and `$MAUDE_CACHE_DIR` lets a power user point several repos at one cache dir manually.
- **Gitignore everything (each machine warms its own).** Rejected for `research/domain` + `codebase-intelligence` specifically — they're expensive AND deterministic on a given tree, so sharing them is pure upside (the roadmap.json precedent).
- **Importing `cli/lib/cache.mjs` from the plugin via a relative path (`node -e`).** Rejected after live-testing proved it unreachable in marketplace installs (see the Reachability correction). `get`/`put` over the `maude` binary is the working contract. The compute step (WebSearch, file reads) stays in the agent, so a `get → (miss) → work → put` shape covers what `getOrCompute` does for JS callers — the CLI doesn't need a compute-callback. `getOrCompute` remains the in-process JS API for `cli/`-side consumers.
- **Shipping a copy of `cache.mjs` inside each plugin tree** (so it's copied with the plugin). Rejected — two copies of the lib across `design` + `flow` is exactly the drift DDR-025 warns about; the single-source `maude` CLI avoids it.
