# Phase C — Sidecar cache + Monitor + background work

> **Premise:** Phases A (deps) and B (parallel fan-out + lazy-load) are done. We have a baseline. The big remaining bleed-points are:
>
> 1. **Identical work re-run** because we lack a cross-session cache layer (ux-research-agent, codebase-intelligence, design-system context).
> 2. **Sync polling** for things that should be push-notified (server health, long-running subagents, screenshot completion).
> 3. **Synchronous blocking** on work the orchestrator could overlap with other useful work (screenshot capture while critics run, dev-server build while config is parsed).
>
> Each lever in this phase requires more infra than Phase B's text rewrites. Higher reward, higher risk.

---

## Lever 1 — Sidecar cache layer for expensive computations

### Why

`ux-research-agent` discovery mode fires 6–8 WebSearch + WebFetch calls and synthesizes a vision payload. Takes 30–90 s. Currently cached only as `_history/_system/<ds>-<brief-sha8>-domain-research-<mode>.json` — keyed on the FULL brief SHA. Any change to the brief (even cosmetic) invalidates.

Meanwhile, the cache key SHOULD be the **domain slug** (e.g. "finance dashboard", "ecommerce checkout") for the generic reference pool, with a project-specific layer on top. Two users building two finance dashboards in two different repos run the same WebSearch twice today.

Same story for:
- **codebase-intelligence** scans (today re-runs on `/flow:plan` even if codebase didn't change)
- **design-system context** load (today every `/design:edit` re-parses `_components.css`, `colors_and_type.css`, `canvas-lib.tsx`)
- **scenario-runner** screenshots (today every `/flow:validate` re-screenshots even if no UI files changed since last validate)

### Solution shape

Define a **canonical sidecar cache directory layout** + a small `cache.mjs` helper. Producers write cache files; consumers check freshness + key match before re-running.

#### Cache layout

```
.ai/cache/                                    # gitignored OR committed — see C1 decision
├── research/
│   ├── domain/<slug>.<sha8>.json             # generic per-domain (shareable across projects)
│   └── project/<repo-sha>/<brief-sha>.json   # per-project layer (refinements on top of domain)
├── codebase-intelligence/
│   └── <files-sha>.json                      # keyed on hash of file mtimes
├── design-context/
│   └── <ds-name>/<tokens-sha>.json
└── scenario/
    └── <scenario-name>/<route-sha>.json
```

#### Cache helper API (`cli/lib/cache.mjs`)

```js
const cache = require('@maude/cache');

// Get-or-compute pattern
const result = await cache.getOrCompute({
  layer: 'research/domain',
  key: domainSlug,
  ttlMs: 7 * 24 * 60 * 60 * 1000,    // 7 days for domain research
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // never reuse older than 30 days
  compute: () => runUxResearchAgent(domainSlug),
});

// Or explicit check
const hit = cache.check('codebase-intelligence', filesSha);
if (hit && hit.ageMs < oneHour) return hit.value;
```

### Tasks

#### C1 — Decide: commit cache or gitignore?

- **Open question:** sidecar caches can be either committed (faster second-run for collaborators, but larger PRs) or gitignored (each user's machine warms its own cache).
- **Recommendation:** **commit** the `research/domain/` and `codebase-intelligence/` layers; **gitignore** `research/project/` (which is brief-specific and changes often) and `scenario/` (which is per-run).
- **Pattern:** mirror `site/lib/roadmap.json` decision — it IS committed because Vercel needs it.
- **Validate:** add `.ai/cache/research/project/` and `.ai/cache/scenario/` to `.gitignore` in the repo template (`plugins/flow/templates/ai-skeleton/.gitignore`).

#### C2 — Build `cli/lib/cache.mjs`

- **Do:** Tiny library (~100 LOC, zero deps). `check(layer, key)`, `write(layer, key, value, meta)`, `getOrCompute(opts)`. Atomic file writes (tempfile + rename). JSON only.
- **Validate:** unit-style assertions: write then check returns the same payload; staleness boundary respected; concurrent writes don't corrupt.

#### C3 — Wire cache into `ux-research-agent`

- **File:** `plugins/design/agents/ux-research-agent.md`
- **Do:** Two cache layers:
  - **Generic domain layer** keyed on a normalized domain slug derived from the brief (e.g. `vision-brief.product_type + ":" + vision-brief.industry`). 7-day TTL. Mood clusters + color OKLCH options + typography pairings + signature treatments — anything domain-independent of the specific project.
  - **Project layer** keyed on full brief SHA. 30-day TTL. Anti-references, project-specific anchors, confidence scoring.
- **Logic:** check generic layer first; if hit and fresh, skip the 6–8 WebSearch calls and use cached anchors. Then run only the project-specific refinement pass.
- **Validate:** invoke `/design:setup-ds` twice on similar briefs (same domain, different project name). Second run should skip the 30–90 s research phase entirely.

#### C4 — Wire cache into `codebase-intelligence`

- **File:** `plugins/flow/skills/codebase-intelligence/SKILL.md`
- **Do:** Hash all source-file mtimes (or last commit SHA). Cache the resulting codebase map keyed on that hash. `/flow:plan` and `/flow:utils-verify` check cache before rescanning.
- **Pattern:** `git ls-files | xargs stat -f %m | sha256sum` (mtime hash) or simpler: `git rev-parse HEAD` (good enough if user committed before /plan).
- **Validate:** invoke `/flow:plan` twice back-to-back on same branch; second run reads cache, no rescan.

#### C5 — Wire cache into design-context load

- **Files:** `plugins/design/commands/edit.md` step 1.5; `plugins/design/commands/new.md` step 1.5
- **Do:** Cache the parsed token + component context per (DS-name, tokens-sha). `/design:edit` checks cache before re-reading `_components.css` etc.
- **Validate:** invoke `/design:edit` twice on the same canvas back-to-back; second run skips the CSS reads.

#### C6 — Cache invalidation policy

- **Do:** Document in `cli/lib/cache.mjs` JSDoc + a brief `.ai/cache/README.md` (gitignored):
  - Domain research: TTL 7 days, max 30 days.
  - Codebase intelligence: invalidates on git commit SHA change.
  - Design context: invalidates on tokens.css mtime change.
  - Scenario: invalidates on UI file mtime change in the routes the scenario covers.
- **Validate:** force-stale a cache entry, verify it gets refreshed.

#### C7 — `maude cache` CLI subcommand

- **Do:** Add `maude cache list | clear | inspect <layer>` to the CLI. `clear` wipes; `list` shows layers + sizes + last-write times; `inspect` pretty-prints one entry.
- **Validate:** `maude cache list` after a few /design and /flow runs shows entries; `maude cache clear research/domain` wipes that layer.

---

## Lever 2 — Monitor pattern for push-based waits

### Why

`plugins/design/dev-server/bin/server-up.sh` polls `/_health` every 100 ms up to 10 s. Polling burns assistant turns; per research §4, Monitor tool pushes each output line back to Claude as it arrives — Claude can react in real-time AND interleave other work while waiting.

Same opportunity for:
- Long-running scenario-runner (today the orchestrator blocks until completion; could interleave reading the scenario spec, prepping the report folder)
- ux-research-agent (if Phase C1 cache misses and it actually runs; can prep the scaffold envelope in parallel)
- Dev-server build (today blocks startup; could log build progress and start critic-prep while building)

### Tasks

#### C8 — Rewrite `server-up.sh` as a Monitor-compatible watch script

- **Do:** New `server-watch.sh` (or extend `server-up.sh` with `--monitor` flag) that emits one line per status change: `BOOTING`, `HEALTH_OK`, `HEALTH_FAIL`. Claude orchestrator uses Monitor with this script: starts the watch, continues with other work, gets a push notification when `HEALTH_OK` line appears.
- **Pattern from research §4:**
  ```sh
  while true; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 0.1 "http://localhost:$PORT/_health" || echo "000")
    if [ "$code" = "200" ]; then echo "HEALTH_OK"; exit 0; fi
    sleep 0.5
  done
  ```
- **Markdown rewrite in `/design:new`, `/design:edit`, `/design:setup-ds`:**
  ```markdown
  ## Step 2 — Dev server up
  
  Start a Monitor watching the dev server health. While it runs, continue with the next steps. When the Monitor reports `HEALTH_OK`, the server is ready for screenshot/inspector calls.
  ```
- **Validate:** invoke `/design:new` with a cold server; assistant log shows Monitor running concurrently with other tool calls (config read, brief parse).

#### C9 — Async dev-server boot

- **File:** `plugins/design/dev-server/server.mjs` (and Bun-migration target per DDR-009)
- **Do:** On boot, start listening on the port immediately with a stub `/_health` route that returns `{ ready: false, building: true, progress: "..." }`. Run `bun install` + `bun run build.ts` in background. When done, flip to `{ ready: true }`. Per research §4, Monitor on `/_health` will push the flip event to Claude.
- **Pattern:** matches the v0.18.0 self-heal pattern documented in CLAUDE.md "Known issues", but with port-listening BEFORE build completes.
- **Validate:** delete `node_modules/`, `client.bundle.js`, `styles.css`. Run `maude design serve`. Within ~200 ms `curl /_health` returns `{ ready: false }`. Within ~10–30 s flips to `{ ready: true }`. Claude doesn't sit silent during the build.

---

## Lever 3 — Background work overlap

### Why

Several commands today block on independent steps that could run concurrently:

- `/design:new` runs scaffold → screenshot → critics. Screenshot and the critic-spawn-prep are independent.
- `/design:edit` runs edit → screenshot → critic. Same.
- `/flow:validate` runs scenario-runner (which screenshots cross-platform) → a11y-auditor (reads same screenshots). Already addressed in Phase B B1 as parallel fan-out, but a11y-auditor still waits for scenario screenshots before it can start. With background + Monitor on the screenshot directory, a11y-auditor can start the moment first screenshot lands.

### Tasks

#### C10 — `run_in_background` for screenshots in `/design:new` post-scaffold

- **File:** `plugins/design/commands/new.md` (step 9 reality check + critic fan-out section)
- **Do:** After scaffold completes, fire `screenshot.sh --all-screens` with `run_in_background: true`. While it runs, prepare critic-spawn prompts (read scaffold meta, build per-critic context). When screenshots finish, spawn critic batch (which uses the screenshots).
- **Pattern:** research §5 — Bash with `run_in_background` continues without waiting. Claude does other work, then either checks `/tasks` or relies on next-turn result delivery.
- **Validate:** scaffold to first critic spawn shrinks by ~5–10 s (screenshot time overlaps with prompt prep).

#### C11 — Stream critic verdicts

- **Files:** `plugins/design/skills/design-system/_post-scaffold-gate.md` (after Phase B B10 split); critic agents.
- **Do:** Each critic writes its verdict to `<canvas>/_critic-reports/<critic-name>.json` AS IT FINISHES (not buffered until panel completes). Orchestrator tails the directory via Monitor; prints "✓ a11y-critic: 0 blockers, 2 warnings" as each lands. Perceived latency drops dramatically even if wall-clock unchanged.
- **Pattern:** Monitor watching `find <canvas>/_critic-reports -mmin -1`.
- **Validate:** during a critic panel run, console shows progressive reports as each critic finishes, not one big block at the end.

#### C12 — a11y-auditor starts on first screenshot, not after scenario-runner completes

- **Files:** `plugins/flow/agents/a11y-auditor.md`; `plugins/flow/commands/validate.md` step 4
- **Do:** Tell a11y-auditor (in its spawn prompt) to Monitor the screenshot directory; start scanning as screenshots land. scenario-runner writes to a known path; a11y-auditor knows the path.
- **Validate:** total wall-clock for `/flow:validate` step 4 ≈ max(scenario-runner, a11y-auditor) instead of scenario-runner + a11y-auditor.

---

## Lever 4 — Conditional skip on no-op runs

### Why

Several commands today re-run expensive subagents even when nothing changed since the last run. Cheapest win: don't run them at all.

### Tasks

#### C13 — `/flow:validate` skip-if-clean

- **File:** `plugins/flow/commands/validate.md`
- **Do:** At step 0, compute "delta since last validate" = `git diff <last-validate-sha>..HEAD`. If empty AND last validate report is fresh (<24 h) AND last validate result was green, print "Last validate passed at <ts> on this exact tree — skipping. Use --force to re-run." and exit 0.
- **Validate:** invoke `/flow:validate` twice on clean HEAD; second invocation short-circuits.

#### C14 — `/design:new` short-circuit on identical brief

- **File:** `plugins/design/commands/new.md`
- **Do:** Hash the input brief; check if `_history/<slug>/` already has a canvas from that brief hash. If yes, ask: "Same brief produced canvas X at <ts>. Re-run anyway?". On no, open X.
- **Validate:** invoke `/design:new` twice with identical brief; second run prompts.

---

## Lever 5 — Cross-platform scenario, batch smoke & review-cache consolidation

### Why

`/flow:scenario` is one of the slowest daily commands (cold ~2–3 min). Three cost centers, none addressed by Levers 1–4:

1. **Cold sim/AVD boot** — an iPad sim or Android AVD cold-boot is 30–60 s, synchronous, and blocks the web variant from even starting.
2. **The cross-platform run itself** — ~60 s wall-clock even warm.
3. **Manual report authoring** — the orchestrator reads every `result.txt` + every `step-*.png` and hand-writes `report.md`. The scenario skill has carried "report generator" as an unimplemented TODO since inception.

Separately, two cross-command duplications are cheap to fold in now that Lever 1 ships a cache library:

- `/design:smoke` re-screenshots **all ~40 canvases** every run — no incremental mode exists (`smoke.sh` has no `--changed`/`since`/`mtime` flag).
- Security-review reuse ("reuse `.ai/logs/security-reviews/<branch>-*.md` if HEAD unchanged within 1 h") is independently reimplemented in three commands (`done.md`, `validate.md`, `validate-security.md`).

> **Orphan note:** C1's cache layout already names `.ai/cache/scenario/<scenario-name>/<route-sha>.json`, but no Lever-1 task ever wires it. C15 closes that orphan.

### 5a — Scenario

#### C15 — `covers` manifest + route-aware scenario skip

- **Files:** `plugins/flow/skills/scenario/SKILL.md`, `plugins/flow/commands/scenario.md`, `plugins/flow/agents/scenario-runner.md`; new artifact `.ai/scenarios/<name>/covers.json` (or `covers:` frontmatter in the scenario README). No `covers` manifest exists today — this is a new declaration.
- **Do:** Each scenario declares the source globs / routes it exercises (e.g. `["app/(video)/**", "components/VideoTape/**"]`). On run, hash those files; key the `scenario/<name>/<covers-sha>.json` cache layer (the orphaned layer from C1) on that hash + last result. If the covered files are unchanged since the last **green** run AND the cached report is fresh, print "Scenario `<name>` last passed green on this exact covered-file set at `<ts>` — skipping. Use `--force` to re-run." and reuse the cached report path.
- **Granularity vs C13:** C13 skips the whole `/flow:validate` only when the *entire* tree is unchanged. C15 skips an individual scenario when *its* covered files are unchanged — fires far more often (most diffs don't touch every scenario's routes).
- **Validate:** run `/flow:scenario <name>`; edit an unrelated file; re-run → skip. Edit a covered file → full run.

#### C16 — Background sim/AVD boot via Monitor

- **Files:** `plugins/flow/commands/scenario.md` pre-flight, `plugins/flow/agents/scenario-runner.md` pre-flight, `plugins/flow/skills/scenario/SKILL.md` "Running an existing scenario".
- **Do:** In pre-flight, fire `xcrun simctl boot <udid>` + AVD start with `run_in_background: true`, and start a Monitor on the booted state (`simctl bootstatus` / `adb wait-for-device`). Immediately run the web variants (web-desktop → web-mobile, ~20–30 s) while sims boot. By the time web finishes, natives are up → run them with no extra wait.
- **Pattern:** generalizes C8/C9's Monitor + async-boot pattern to the scenario path.
- **Fallback:** if `run_in_background` is disabled by sandbox config, fall back to today's synchronous boot (per the Phase C risk note on background work).
- **Validate:** cold scenario (no sim booted). Tool log shows web variants running concurrently with sim boot; total wall-clock ≈ max(web, sim-boot + native) instead of sim-boot + web + native.

#### C17 — Deterministic scenario report generator

- **Files:** new `plugins/design/dev-server/bin/scenario-report.mjs` (published-files home — add to `package.json` `files` if invoked at runtime on end-user machines); wire into `scenario.md` step 3, `scenario-runner.md` "Report", `scenario/SKILL.md` (resolves its long-standing "report generator" TODO).
- **Do:** Script walks `<run>/<platform>/result.txt` + `step-*.png` → emits TL;DR table, counter-delta table, per-step pivot table, and the collapsed path-listing `<details>` block. The LLM authors only the prose sections ("What surprised us", "Recommended follow-ups").
- **Why:** replaces an entire hand-authoring turn with a deterministic pass; output is consistent and faster.
- **Validate:** run a scenario; confirm `report.md` is generated by the script with all required sections, LLM adds only prose.

#### C18 — Enforce web-only scope skip in scenario-runner

- **File:** `plugins/flow/agents/scenario-runner.md` (its scope-decision table documents this but doesn't enforce it).
- **Do:** When the in-scope diff is web-only (combine with C15 `covers` data — no native-covered file changed), **skip native pre-flight entirely** (don't boot or detect sims). Mark native platforms `skipped: web-only change` in the report — not a fail.
- **Validate:** web-only diff → scenario-runner runs only web-desktop + web-mobile, no `simctl`/`adb` calls in the log.

### 5b — Batch smoke

#### C19 — `/design:smoke --changed-only` incremental mode

- **Files:** `plugins/design/dev-server/bin/smoke.sh`, `plugins/design/commands/smoke.md`, `plugins/flow/commands/execute.md` (the phase-end gate caller).
- **Do:** Add `--changed-only`: diff canvas `.tsx` (git or mtime) since the last smoke run recorded under `_history/_smoke/`. Screenshot only changed canvases. **Escalate to the full set** when the diff touches `dev-server/**`, `canvas-lib.tsx`, or the canvas templates (the "everything could break" shapes already enumerated in `smoke.md`'s auto-trigger list). Default to `--changed-only` when invoked from `/flow:execute`; keep full-set for manual and release/CI.
- **Why:** today smoke re-screenshots all ~40 canvases even for a one-canvas change — biggest single win on the smoke path. Pairs with C10's `run_in_background` (fire the batch, read prior report meanwhile).
- **Validate:** edit one canvas; `/design:smoke --changed-only` screenshots only that one. Touch `canvas-lib.tsx` → escalates to full set.

### 5c — Review-cache consolidation

#### C20 — Formalize security-review reuse into the cache library

- **Files:** `cli/lib/cache.mjs` (the C2 library), `plugins/flow/commands/done.md`, `plugins/flow/commands/validate.md`, `plugins/flow/commands/validate-security.md`.
- **Do:** Replace the three independent "reuse if HEAD unchanged within 1 h" reimplementations (`done.md:47`, `validate.md:140`, `validate-security.md:128`) with a single `security/<head-sha>.json` cache entry (TTL 1 h, invalidates on HEAD change). All three callers do `cache.check('security', headSha)` before spawning `security-auditor` + `ethical-hacker`.
- **Why:** one source of truth for "don't re-audit the same tree"; removes drift risk between the three hand-rolled windows. Near-zero risk — the behavior already exists, this just unifies it. Depends on C2, so it can ride PR1 or PR6.
- **Validate:** run `/flow:validate-security`; immediately run `/flow:done` on the same HEAD → second invocation reuses the cached report, no re-spawn.

---

## Lever 6 — Unify plugin → CLI entrypoint (one reachable contract: `maude`)

> **Follow-up PR7** — distinct from the shipped PR1–3 cache work. Builds on the DDR-061 reachability finding + the `maude cache get/put` / `maude preflight` fixes already landed this session.

### Why

A plugin command today reaches executable logic two different ways, and **both** have bitten us:

1. **Relative `cli/lib/*.mjs`** (`$PKG_ROOT/cli/lib/…`) — **broken in every marketplace install**: the marketplace copies each plugin alone into `cache/<marketplace>/<plugin>/<version>/`, so the repo's sibling `cli/` is never present. This crashed `/design:init`'s preflight live (`Cannot find module …/cache/maude/cli/lib/preflight.mjs`). Already fixed for cache (`maude cache get/put`) and preflight (`maude preflight`) this session; guarded by `cli/lib/plugin-cli-reachability.test.mjs`.
2. **`$CLAUDE_PLUGIN_ROOT/dev-server/bin/X.sh`** — depends on `CLAUDE_PLUGIN_ROOT` being set in the bash environment. In a real `/design:init` run this came back **EMPTY**, forcing the orchestrator to `find` the plugin by hand. Fragile by construction.

`maude` is already a declared plugin dependency that the user must keep current — so there is **one robust contract** worth standardizing on: **plugin markdown invokes only the on-PATH `maude` binary; `maude` resolves everything from its own install location.** This lever finishes the migration for the design plugin's shell helpers. (Flow is already clean: preflight goes via `maude preflight`, the rest is inline bash; flow has no `dev-server/bin`.)

The key feasibility fact: **the design dev-server ships INSIDE the maude npm package** (`package.json` `files` includes `plugins/design/dev-server`). So `maude design <verb>` can dispatch to `<pkgRoot>/plugins/design/dev-server/bin/<verb>.sh`, where `pkgRoot` is resolved from the maude binary's own `__dirname` (`cli/bin/maude.mjs` → `PKG_ROOT`) — **never** from `CLAUDE_PLUGIN_ROOT`. The shell scripts stay shell; only the *invocation* changes.

### Inventory — `dev-server/bin/*.sh` → `maude design <verb>`

| Script | Markdown / agent callers | Proposed command | Convert? |
|---|---|---|---|
| `screenshot.sh` | screenshot.md, edit.md, new.md, setup-ds.md, skills/design/SKILL.md, signature-moment-critic.md, design-critic.md | `maude design screenshot` | ✅ |
| `server-up.sh` | new.md, screenshot.md, smoke.md, edit.md, skills/design/SKILL.md | `maude design server-up` | ✅ |
| `prep.sh` | new.md, edit.md, setup-ds.md | `maude design prep` | ✅ |
| `slug.sh` | screenshot.md, edit.md | `maude design slug` | ✅ |
| `bootstrap-check.sh` | new.md, edit.md | `maude design bootstrap-check` | ✅ |
| `runtime-health.sh` | smoke.md, new.md, edit.md | `maude design runtime-health` | ✅ |
| `smoke.sh` | smoke.md | `maude design smoke` | ✅ |
| `canvas-edit.sh` | edit.md | `maude design canvas-edit` | ✅ |
| `handoff.sh` | handoff.md | `maude design handoff` | ✅ |
| `asset-sweep.sh` | skills/design-system/_bootstrap.md | `maude design asset-sweep` | ✅ |
| `visual-sanity.sh` | _bootstrap.md, design-system-completeness-critic.md | `maude design visual-sanity` | ✅ |
| `preflight.sh` | design init.md | (already `maude preflight`) | — done |
| `check-runtime-bundles.sh` | CI / `prepublishOnly` only — no markdown caller | (stays a bin script) | ❌ keep |
| `_*-playwright.mjs` | called internally by `screenshot.sh`/export, not from markdown | (internal shim) | ❌ keep |

Verb names map 1:1 to the script basename for mechanical clarity (no behavior rename in this PR).

### Dispatch mechanism (the load-bearing design)

`cli/commands/design.mjs` gains a generic bin-dispatch for a **whitelisted** verb set. When `maude` execs the bundled script it **sets `CLAUDE_PLUGIN_ROOT` itself** from its own reliable `pkgRoot` — so the scripts (which still resolve their siblings via `$CLAUDE_PLUGIN_ROOT` / `SCRIPT_DIR`) keep working unchanged, but the resolution is now authoritative instead of depending on Claude Code's environment:

```js
const BIN_VERBS = new Set([
  'screenshot', 'server-up', 'prep', 'slug', 'bootstrap-check',
  'runtime-health', 'smoke', 'canvas-edit', 'handoff', 'asset-sweep', 'visual-sanity',
]);

function runBinDispatch(verb, { args, pkgRoot }) {
  if (!BIN_VERBS.has(verb)) { /* unknown → usage, exit 2 */ }
  const pluginRoot = join(pkgRoot, 'plugins', 'design');           // reliable, from maude's own __dirname
  const script = join(pluginRoot, 'dev-server', 'bin', `${verb}.sh`);
  const rest = args.slice(1);                                       // drop the verb token
  const child = spawnSync('bash', [script, ...rest], {
    stdio: 'inherit',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },        // ← authoritative resolution
  });
  process.exit(child.status ?? 1);                                  // pass-through exit code
}
```

The verb whitelist (not arbitrary `<verb>.sh` exec) keeps this from becoming a path-traversal / arbitrary-script-exec surface.

### Tasks

#### C21 — `maude design <verb>` bin-dispatch in `cli/commands/design.mjs`

- **Files:** `cli/commands/design.mjs` (extend `SUBCOMMANDS` + add `runBinDispatch`), `cli/commands/help.mjs` (+ `maude design help` usage), `cli/commands/design.test.mjs` (new/extend).
- **Do:** Implement the dispatch above. Whitelist the 11 verbs. `stdio: 'inherit'` so stdout/stderr/exit-code pass straight through to the markdown caller (preserves `$(maude design slug …)` capture + `eval $(maude design prep --shell-export)` + non-zero gating). Set `CLAUDE_PLUGIN_ROOT` in the child env from `pkgRoot`.
- **Audit:** confirm each bundled `.sh` resolves correctly when launched by absolute path with `CLAUDE_PLUGIN_ROOT` set by maude — they already use `${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}`-style resolution (DDR-045), so no script body change expected; flag any that hard-require an env var maude doesn't set.
- **Gotcha:** `prep.sh --shell-export` / `slug.sh` are consumed via command substitution — dispatch must emit **only** the script's stdout (no maude banner) on those paths. `stdio: 'inherit'` satisfies this (maude writes nothing of its own).
- **Validate:** `maude design slug "Some Canvas Name"` → kebab slug on stdout, exit 0, from any cwd; `maude design prep --shape edit --shell-export` → the same `export …` block the bin emits; unknown verb → exit 2. Marketplace-layout check: run with a `pkgRoot` whose `plugins/design/dev-server/bin/<verb>.sh` exists but `CLAUDE_PLUGIN_ROOT` is unset in the parent env → still resolves (maude sets it).

#### C22 — Rewire design command/skill/agent markdown to `maude design <verb>`

- **Files (≈11):** `commands/{new,edit,screenshot,setup-ds,smoke,handoff}.md`, `skills/design/SKILL.md`, `skills/design-system/_bootstrap.md`, `agents/{signature-moment-critic,design-critic,design-system-completeness-critic}.md`.
- **Do:** Replace every `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/<verb>.sh" <args>` with `maude design <verb> <args>`. Drop now-dead `CLAUDE_PLUGIN_ROOT`-resolution preamble where it existed only to locate the bin. Keep `$CLAUDE_PLUGIN_ROOT` references that point at **non-bin** plugin assets (e.g. `canvas-lib.tsx`, `agents/_ux-research-config.json`) — those are plugin data the markdown legitimately reads, not executable logic. (A follow-up could add `maude design cat <asset>` but it is OUT OF SCOPE here.)
- **Gotcha:** preserve exact arg order + capture idioms (`PORT=$(maude design server-up …)`, `eval "$(maude design prep --shell-export …)"`).
- **Validate:** `grep -rn 'dev-server/bin/' plugins/design/commands plugins/design/skills plugins/design/agents` returns **zero** invocation hits (only comments/inventory references, if any).

#### C23 — Extend the reachability guard to ban `CLAUDE_PLUGIN_ROOT/dev-server/bin` in markdown

- **File:** `cli/lib/plugin-cli-reachability.test.mjs`.
- **Do:** Add a second assertion: no plugin command/skill/agent markdown may contain `$CLAUDE_PLUGIN_ROOT/dev-server/bin/` or `CLAUDE_PLUGIN_ROOT}/dev-server/bin/` as an **invocation** (i.e. preceded by `bash `/`sh `/`exec `). Comments and the plan's inventory table are exempt (scope the grep to `plugins/**/*.md` invocation lines). Keeps the existing `node cli/lib/*.mjs` assertion.
- **Validate:** test passes after C22; temporarily re-introducing a `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/smoke.sh"` in a command makes it fail.

#### C24 — DDR-062 + amend DDR-008

- **Do:** Write **DDR-062** (verified free) — *"Plugins reach ALL executable logic through the on-PATH `maude` CLI; never `$CLAUDE_PLUGIN_ROOT/dev-server/bin` nor a relative `cli/lib`. `maude` resolves bundled helpers from its own package root and sets `CLAUDE_PLUGIN_ROOT` authoritatively for them."* Cross-link DDR-061 (the reachability finding it generalizes) + DDR-045 (real-disk path resolution). **Amend DDR-008** (`dev-server/bin/` as canonical helper home) with a note: the bin scripts remain the canonical home, but are now **maude-internal implementation** invoked via `maude design <verb>`, not called directly from plugin markdown.
- **Validate:** DDR-062 added to `.ai/decisions/README.md` index; DDR-008 carries the amendment note.

#### C25 — Docs: `maude design help`, README, CLAUDE.md

- **Do:** `maude design help` lists the new verbs grouped (lifecycle: serve/init/export/link/…; dev-tooling: screenshot/prep/slug/smoke/…). README "Sidecar cache" sibling note → generalize to "plugins call `maude …` for all executable logic". CLAUDE.md "dev-server helpers" table: add a one-liner that callers now go through `maude design <verb>`.
- **Validate:** `maude design help` renders both groups; CLAUDE.md table updated.

### Risk / rollback

- **Behavior parity is the whole risk.** Each rewired call must produce byte-identical stdout + the same exit code as the old `bash …/bin/X.sh` (capture idioms + gating depend on it). Mitigation: `stdio: 'inherit'` (maude adds nothing); convert + verify **one command end-to-end** (`/design:smoke`, which uses server-up + runtime-health + smoke) before doing the rest. Honors the no-break exhaustive-verify rule: inventory first, per-helper parity check, agent-browser smoke of `/design:new` + `/design:edit` after.
- **Version skew:** `maude design <verb>` runs the bin scripts from **maude's** package copy, not the marketplace plugin's copy. In production both track the same release; document that a stale global `maude` means stale helpers (same caveat as `maude cache get/put`). Rollback is clean: revert C22 (markdown) and the dispatch is dead code — the bin scripts are untouched, so old `$CLAUDE_PLUGIN_ROOT/dev-server/bin` calls would work again.
- **`check-runtime-bundles.sh`** intentionally stays a direct bin script (CI/`prepublishOnly` only, never plugin markdown) — do not route it through maude.

### Acceptance criteria (Lever 6)

- [x] `maude design <verb>` dispatches all 11 whitelisted helpers; stdout/exit-code pass-through verified; unknown verb → exit 2 — _C21; `design.test.mjs` covers slug capture + unknown→2 + help._
- [x] `maude` sets `CLAUDE_PLUGIN_ROOT` from its own `pkgRoot` for the child — helpers resolve with `CLAUDE_PLUGIN_ROOT` UNSET in the parent env — _C21; test scrubs the env var + runs from a temp cwd._
- [x] Zero `dev-server/bin/` **invocations** remain in `plugins/design/{commands,skills,agents}/**/*.md` — _C22; also fixed the cross-plugin-broken flow `execute.md` smoke/server-up calls._
- [x] `cli/lib/plugin-cli-reachability.test.mjs` extended; green; catches a re-introduced bin-path invocation — _C23 (verified the regex matches `bash …` + `$(…)` forms, ignores prose/.mjs)._
- [x] DDR-062 written + indexed; DDR-008 amended — _C24._
- [x] `/design:smoke`, `/design:new`, `/design:edit` verified end-to-end via agent-browser after rewire (no regression) — _2026-05-29: rewire confirmed byte-identical (dispatch test 4/4, reachability guard green, slug/prep/bootstrap-check parity from a clean cwd, `CLAUDE_PLUGIN_ROOT` unset). Live-server smoke (43/43) + single-shot `maude design screenshot --full` (edit/new/critic path) verified. **En route, found + fixed a pre-existing bug the rewire-verification surfaced (NOT a rewire regression):** under the default-on canvas-origin split (phase-9.1) the bare `http://PORT/<rel>` route 404s, so smoke.sh + screenshot.sh were capturing "Not found" pages while reporting OK. Fix: route → `_canvas-shell.html?canvas=<rel>`, absolutize out-dir, fail-loud on missing-PNG / "Not found" / "Forbidden". Re-verified: 43 real distinct PNGs; read all 5 UI canvases + 4 specimens (motion, ui-kits-showcase, colors-accent no-triple-chrome, diff-view 69 markers)._
- [x] Flow plugin `execute.md` rewired (was cross-plugin-broken); `check-runtime-bundles.sh` + `_*-playwright.mjs` untouched (intentionally off the whitelist)

---

## Validation

1. **Cache hit-rate measurement:** instrument `cli/lib/cache.mjs` with a counter. After a representative work week, `maude cache stats` reports hits/misses per layer. Target: `research/domain` >50 % hit rate after first week; `codebase-intelligence` >70 %.
2. **Monitor effective wait reduction:** in `/design:new` cold-server scenario, total time from invocation to first critic spawn drops by >20 % vs Phase B baseline.
3. **Background overlap measurable:** screenshot capture (~3–5 s) fully hidden inside critic-prep window; total scaffold-to-critic-spawn time within 200 ms of critic-prep time alone.
4. **No quality regression:** caches must not serve stale data. Verify by force-touching a cached input (edit tokens.css) and confirming the next run invalidates correctly.
5. **Manual scenarios** (eyeball UX):
   - Cold-cache `/design:setup-ds` on a new DS in a new repo: full research runs.
   - Warm-cache `/design:setup-ds` on a similar-domain DS in another repo: research SKIPS, jumps to scaffold.
   - `/design:new` while dev-server cold-booting: progress visible, no silent hang.
   - Cold `/flow:scenario` (no sim booted): web variants run while sims boot in background; report generated by script, not hand-authored.
   - `/flow:scenario` re-run after an unrelated edit: skips with "last passed green on this exact covered-file set".
   - `/design:smoke --changed-only` after a one-canvas edit: screenshots only that canvas, not all ~40.

---

## Acceptance criteria

- [x] `cli/lib/cache.mjs` exists, schema-validated, tested with concurrent writes — _PR1 (2026-05-29): 17 unit tests + 8 CLI e2e tests; atomic tempfile+rename, path-traversal guard, stale-on-error fallback._
- [x] `ux-research-agent` caches domain + project layers; cache hit on similar-domain run skips WebSearch — _PR1: Step 0.5 two-layer wiring (research/domain 7 d + research/project 30 d)._
- [x] `codebase-intelligence` caches keyed on git SHA; second `/flow:plan` on same branch skips rescan — _PR2: freshness gate keyed on `hash(HEAD + git status --porcelain)`._
- [x] design-context cache shaves CSS reads from repeated `/design:edit` calls — _PR2: DS-vocabulary pack keyed on `hash(_components.css + colors_and_type.css + canvas-lib.tsx)` in edit.md + new.md §1.5._
- [x] `maude cache` CLI subcommand works (`list`, `clear`, `inspect`) — _PR3: + `stats`; registered in bin + help._
- [ ] `server-watch.sh` exists; `/design:new` uses Monitor instead of polling — _PR4 (C8), DEFERRED. Low-risk/standalone (new bash script + markdown, polls existing `/_health`), but deferred 2026-05-29 with C9 because C9 is the real lever and the two are coupled._
- [ ] Dev-server boot returns `ready: false` immediately, flips on build complete; no silent hang — _PR4 (C9), DEFERRED 2026-05-29. **Collision found:** C9 restructures `server.ts` boot ordering (`await bootSelfHeal()` line 35 → listen-first), which is the exact region phase-9.1's canvas-origin two-listener boot (lines 282–287, `startCanvasServer`) owns — and phase-9.1 is PAUSED pending an architecture decision (+ its `canvas-origin-gate.test.ts` is currently failing at setup). Reworking this boot region now would collide with the contested phase-9.1 work. Resume C9 after phase-9.1's canvas-origin decision lands._
- [x] `run_in_background` screenshot + parallel critic prep wired into `/design:new` and `/design:edit` — _PR5/C10._
- [x] Critic verdicts stream as files land; orchestrator tails via Monitor — _PR5/C11 (SKILL.md "Streaming critic verdicts"; PANEL.md still written last as the loop's consolidated source)._
- [x] a11y-auditor starts on first screenshot, not after scenario-runner completes — _PR5/C12 (concurrency section + `scenario_screenshot_dir` passed inline)._
- [x] Skip-if-clean implemented for `/flow:validate` and `/design:new` — _PR5/C13 (`validate` cache layer) + C14 (`brief_sha` short-circuit)._
- [x] Scenario `covers` manifest + route-aware skip wired (C15 fills the orphaned `scenario/` cache layer from C1) — _PR6/C15._
- [x] Sim/AVD boot runs in background via Monitor; cold `/flow:scenario` overlaps the web run with the boot — _PR6/C16._
- [x] Deterministic `scenario-report.mjs` generates `report.md`; LLM authors only the prose sections — _PR6/C17 (`maude scenario-report`)._
- [x] Web-only diff skips native scenario pre-flight (no `simctl`/`adb` calls) — _PR6/C18._
- [x] `/design:smoke --changed-only` screenshots only changed canvases; escalates to full set on dev-server/canvas-lib/template change — _PR6/C19._
- [x] Security-review reuse consolidated into `cache.mjs` (`security/<head-sha>`); done / validate / validate-security share one window — _PR1 (rode with C2): canonical recipe in `validate-security.md` pre-flight; `done.md` + `validate.md` reference it._
- [x] DDR written: "Cache layout, Monitor pattern, background-overlap orchestration as Phase C of skills optimization" — _**DDR-061**, not 049 (049 was already taken by motion-one); PR4–6 conventions pre-recorded._
- [x] All Phase B wall-clock targets still met (no regression from cache misses or Monitor overhead) — _2026-05-29: only new always-on overhead from committed Phase C is the `maude design <verb>` dispatch wrapper, measured ~30–40 ms/call (Node start + spawnSync) vs ~0 ms direct — negligible against multi-second screenshot/build ops. Caches only short-circuit work; Monitor overhead is N/A (PR4 not built). No regression._

---

## Risk notes

- **Cache correctness > cache hit rate.** A wrong cached domain-research payload would silently bias every downstream DS bootstrap in that domain. C6 invalidation policy is load-bearing — get it reviewed before shipping.
- **Monitor is v2.1.98+** (per research §4). Pin minimum Claude Code version in `package.json` `engines` (or `.claude-plugin/plugin.json` if that supports it) and document in README "Prerequisites".
- **Background work + sandbox modes.** Some user sandbox configs may disable `run_in_background`. Test in a restrictive permission mode; if disabled, fall back to sequential. Don't hard-require background.
- **Streaming critic verdicts changes the panel summary contract.** Today panel emits one consolidated JSON. Streaming = N partial JSONs. Make sure downstream consumers (e.g., auto-fix loop in `/design:edit --perfect`) still see the final consolidated form too — write it as the LAST file after streaming completes.
- **Committed domain-research caches grow the repo.** Watch repo size. If after 3 months `.ai/cache/research/domain/` exceeds 5 MB, add a maintenance command `maude cache prune --older-than 60d` and document running it before each release.

---

## Out of scope

- Anything that requires changing Claude Code itself (e.g., a hypothetical plugin-level shared cache across sessions managed by the runtime). Sidecar files are the only mechanism we control.
- Token cost optimization (Max subscription user — not relevant).
- Rewriting subagents to be incremental / resumable. That's another phase.

## Estimated effort

~3.5 weeks of focused work. ~30 commits. Group into ~6 PRs:
- ✅ PR1: cache library + research layer (C1, C2, C3, C6) — C20 rode here (only needs C2). **Shipped 2026-05-29.**
- ✅ PR2: codebase-intelligence + design-context caches (C4, C5). **Shipped 2026-05-29.**
- ✅ PR3: maude cache CLI + DDR (C7 + **DDR-061** + README updates). **Shipped 2026-05-29.**
- ⏳ PR4: Monitor + async dev-server (C8, C9) — _NOT started; deferred (touches dev-server runtime, needs the no-break exhaustive-verify pass). Skipped this session per user scope choice._
- ✅ PR5: background overlap + streaming + skip-if-clean (C10–C14) — **Built 2026-05-29 (uncommitted).** C10 (new.md + edit.md background screenshot + critic-prep overlap), C11 (SKILL.md streaming critic verdicts via Monitor of `critique/`, PANEL.md still written last), C12 (a11y-auditor concurrency section + validate.md `scenario_screenshot_dir`), C13 (validate.md skip-if-clean via `validate` cache layer + step 8b record-green), C14 (new.md step 3.6 identical-brief short-circuit + `brief_sha` in meta).
- ✅ PR6: scenario speed + smoke incremental (C15–C19; C20 already shipped in PR1) — **Built 2026-05-29 (uncommitted).** C15 (`covers.json` contract + route-aware skip via `scenario/<name>/<covers-sha>` cache), C16 (background sim/AVD boot + Monitor), C17 (`plugins/design/dev-server/bin/scenario-report.mjs` + `maude scenario-report` CLI; resolves the SKILL.md TODO), C18 (web-only scope skip enforced in scenario-runner), C19 (`smoke.sh --changed-only` + `.last-smoke.json` baseline + escalation; `/flow:execute` defaults to it).
- ✅ PR7: unify plugin → CLI entrypoint (C21–C25, Lever 6) — **Built 2026-05-29 (uncommitted).** C21 (`maude design <verb>` bin-dispatch in design.mjs, 11-verb whitelist, `design.test.mjs`), C22 (every design + flow markdown invocation rewired to `maude design <verb>`; zero bin invocations remain), C23 (`plugin-cli-reachability.test.mjs` extended — DDR-062 guard), C24 (DDR-062 written + indexed; DDR-008 amended), C25 (`maude design help` + `maude help` + README + CLAUDE.md).

## Decisions to record

- **DDR-061** (this plan; renumbered from the originally-reserved DDR-049/060 — both taken): Cache layout convention + Monitor pattern + background-overlap orchestration. Covers the scenario `covers`-manifest contract, the deterministic report-generator convention, and the unified `security/<head-sha>` review-cache (Lever 5); PR4–6 conventions pre-recorded.
- **DDR-062** (Lever 6 / PR7; verified free at authoring): plugins reach ALL executable logic via the on-PATH `maude` CLI — never `$CLAUDE_PLUGIN_ROOT/dev-server/bin` nor relative `cli/lib`; `maude` resolves bundled helpers from its own package root + sets `CLAUDE_PLUGIN_ROOT` authoritatively. Amends DDR-008.
- Possibly **DDR-063** once observed: cache pruning policy / repo size thresholds.

## Retro — PR5–7 (2026-05-29)

- **What worked:** PR7's "do the unifying sweep LAST" ordering paid off — converting PR5/PR6's new bin invocations in the same C22 pass meant zero rework, and the C23 guard locked it in. Most of Phase C is markdown orchestration, so per-file fence-balance + a focused `grep` for invocation lines was a cheap, high-signal verification.
- **Cross-plugin bug found en route:** `/flow:execute`'s smoke gate called `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/smoke.sh"` — but a flow command's `$CLAUDE_PLUGIN_ROOT` is `plugins/flow`, which has no dev-server. It was broken by construction; the `maude design` rewrite fixed it. Lesson: the DDR-062 contract isn't just marketplace-hygiene — it fixes a live flow→design reach bug.
- **Invocation vs prose distinction matters for the guard:** the C23 regex had to match `bash`/`sh`/`exec`/`$(` forms while exempting backtick prose + the `.mjs` source pointer. Verified against a synthetic fixture before trusting it.
- **`maude scenario-report` is a new top-level CLI command, not a `maude design` verb** — it lives in design's bin (npm-shipped) but is invoked from flow, so it needed its own pkgRoot-resolving subcommand. Worth noting for anyone adding more cross-plugin scripts.
- **Process / what didn't:** the working tree was a 3-workstream tangle on `main` (PR1–3 + PR5–7 + a concurrent session's phase-9.1/sync work). The concurrent session's `git add`+commit cleared my staged index mid-commit; an atomic re-stage+commit was needed. Lesson for `/done`: when a concurrent session shares the tree, stage+commit atomically and don't assume the index survives between tool calls. PR4 (Monitor + async dev-server runtime) was deliberately deferred — it's the only render-path-touching slice and needs the no-break exhaustive-verify pass.
- **Not done in this session:** Lever-6 agent-browser e2e of `/design:smoke` · `/design:new` · `/design:edit` through a live server (parity of the rewired invocations); STATE.md reconciliation + plan archival (contested with the live phase-9.1 narrative); a Phase C changeset.

## Session 2026-05-29b — verify track + tooling fix + PR4 deferred

Ran the Lever-6 verification (the unchecked line-387 gate) and resolved it, then evaluated PR4.

- **Rewire (PR7) verified clean.** `maude design <verb>` byte-identical to the old bin path: dispatch test 4/4, reachability guard green (both assertions), slug/prep/bootstrap-check parity from a clean cwd with `CLAUDE_PLUGIN_ROOT` unset, unknown-verb → exit 2. Dispatch overhead ~30–40 ms/call (negligible) → no Phase B regression (line 428 ✅).
- **Verification surfaced a real, pre-existing bug (not from the rewire) — now FIXED.** The headless screenshot tooling was broken under the **default-on** canvas-origin split: `smoke.sh` + `screenshot.sh` built bare `http://PORT/<rel>` URLs that 404 (canvases now serve only via `/_canvas-shell.html?canvas=<rel>` on the split origins), and smoke's OK-logic fell through to "OK" when the PNG was missing / the page was a "Not found" 404. So `/design:smoke`, `/design:new` step-9, `/design:edit`, and the **critic-panel screenshots** had been capturing 404 pages while reporting green. Three fixes to the two helpers: (1) route → `_canvas-shell.html?canvas=<rel>` (valid split-on + legacy same-origin; it's the server's canonical route — `canvas-origin-gate.test.ts:61` asserts it 200s); (2) absolutize out-dir (agent-browser silently ignores relative screenshot paths); (3) fail loud on missing/empty PNG + "Not found"/"Forbidden" instead of masking as OK. Re-verified end-to-end: 43 real distinct PNGs (relative AND absolute out-dir), read all 5 UI canvases + motion/ui-kits-showcase/colors-accent/diff-view specimens — all render.
- **PR4 evaluated, then DEFERRED (user decision).** C8 (server-watch.sh + Monitor) is low-risk/standalone but coupled to C9. C9 (async boot) restructures `server.ts` boot ordering — the exact region phase-9.1's canvas-origin two-listener boot owns, and phase-9.1 is PAUSED. Doing C9 now collides with contested, paused work. Deferred both; resume after the phase-9.1 canvas-origin decision.
- **Two findings flagged for the phase-9.1 owner (out of Phase C scope):**
  1. **STATE.md is stale** — it repeats "canvas-origin split GATED OFF (default off = zero-regression same-origin)", but `server.ts:282` defaults it **ON** and commit `e720040` ("canvas-origin sandbox on by default") flipped it. The default-on is what broke the screenshot tooling (now fixed) and the "zero-regression same-origin" claim no longer holds for the default path.
  2. **`canvas-origin-gate.test.ts` fails on `main`** at *setup* — its `readCanvasOrigin` polls only 2 s (40×50 ms) for `canvasOrigin` to appear in `_server.json`, too short for a cold sandbox boot; the security assertions never run. Likely a one-line poll-window bump. The actual running server populates `canvasOrigin` fine.
- **Committed:** the tooling fix (`smoke.sh` + `screenshot.sh`) as a focused commit. The plan-checkbox + STATE history-row + roadmap regen were left in the working tree to ride with the concurrent `hub-admin-redesign` session's STATE commit (it already owns STATE.md's Active-task fields) — avoids clobbering its index.
