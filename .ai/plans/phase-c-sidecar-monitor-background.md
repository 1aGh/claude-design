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

## Validation

1. **Cache hit-rate measurement:** instrument `cli/lib/cache.mjs` with a counter. After a representative work week, `maude cache stats` reports hits/misses per layer. Target: `research/domain` >50 % hit rate after first week; `codebase-intelligence` >70 %.
2. **Monitor effective wait reduction:** in `/design:new` cold-server scenario, total time from invocation to first critic spawn drops by >20 % vs Phase B baseline.
3. **Background overlap measurable:** screenshot capture (~3–5 s) fully hidden inside critic-prep window; total scaffold-to-critic-spawn time within 200 ms of critic-prep time alone.
4. **No quality regression:** caches must not serve stale data. Verify by force-touching a cached input (edit tokens.css) and confirming the next run invalidates correctly.
5. **Manual scenarios** (eyeball UX):
   - Cold-cache `/design:setup-ds` on a new DS in a new repo: full research runs.
   - Warm-cache `/design:setup-ds` on a similar-domain DS in another repo: research SKIPS, jumps to scaffold.
   - `/design:new` while dev-server cold-booting: progress visible, no silent hang.

---

## Acceptance criteria

- [ ] `cli/lib/cache.mjs` exists, schema-validated, tested with concurrent writes
- [ ] `ux-research-agent` caches domain + project layers; cache hit on similar-domain run skips WebSearch
- [ ] `codebase-intelligence` caches keyed on git SHA; second `/flow:plan` on same branch skips rescan
- [ ] design-context cache shaves CSS reads from repeated `/design:edit` calls
- [ ] `maude cache` CLI subcommand works (`list`, `clear`, `inspect`)
- [ ] `server-watch.sh` exists; `/design:new` uses Monitor instead of polling
- [ ] Dev-server boot returns `ready: false` immediately, flips on build complete; no silent hang
- [ ] `run_in_background` screenshot + parallel critic prep wired into `/design:new` and `/design:edit`
- [ ] Critic verdicts stream as files land; orchestrator tails via Monitor
- [ ] a11y-auditor starts on first screenshot, not after scenario-runner completes
- [ ] Skip-if-clean implemented for `/flow:validate` and `/design:new`
- [ ] DDR-049 written: "Cache layout, Monitor pattern, background-overlap orchestration as Phase C of skills optimization"
- [ ] All Phase B wall-clock targets still met (no regression from cache misses or Monitor overhead)

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

~3 weeks of focused work. ~25 commits. Group into ~5 PRs:
- PR1: cache library + research layer (C1, C2, C3, C6)
- PR2: codebase-intelligence + design-context caches (C4, C5)
- PR3: maude cache CLI + DDR (C7 + DDR-049 + README updates)
- PR4: Monitor + async dev-server (C8, C9)
- PR5: background overlap + streaming + skip-if-clean (C10–C14)

## Decisions to record

- DDR-049 (this plan): Cache layout convention + Monitor pattern + background-overlap orchestration.
- Possibly DDR-050 once observed: cache pruning policy / repo size thresholds.
