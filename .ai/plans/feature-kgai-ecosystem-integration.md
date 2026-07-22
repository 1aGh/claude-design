# Feature: kgai as the Maude ecosystem memory layer (cross-repo, opt-out)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan spans **flow + design plugins + cli + config schema + templates + docs** — it is a cross-cutting concern, hence it lives in root-level `.ai/plans/`.

## Description

Wire [kgai](https://github.com/kgaidev/kgai) — the event-sourced decision knowledge graph (append-only content-addressed log → Kuzu projection, `kg` CLI, Claude Code plugin) — into the flow and design plugins as a **native, capability-gated, opt-out** memory backend. When kgai is present and enabled, flow/design commands read prior decisions from the graph before acting and write new decisions into it after acting, replacing the file-based `.ai/decisions/` + `.ai/state/STATE.md` history layer. When kgai is absent or disabled, everything falls back to today's `.ai/` file behavior — **no regression, nothing to configure downstream**. On top of that: a **cross-repo scoping model** so an entire company (StudyFi: `~/git/*` — marketing, dev, finance, automations…) shares **one graph on S3**, each repo tagging its writes with `repo` + `dept` meta so search can bias to the local scope first; a **migration skill** to import existing flow/design `.ai/decisions/` into kgai; and a **per-user onboarding guide** to set it up in minutes.

The core design mirrors the existing **`orchestration.mode: auto`** pattern (DDR-130): capability-gated, on-by-default when the capability exists, degrades silently when it doesn't. This keeps the flow plugin project-agnostic (memory `feedback-flow-plugin-project-agnostic`) — scopes and store come from per-repo config, never hardcoded.

## User Story

As a **StudyFi team member working across several repos** I want **my Maude agents to automatically record and recall architectural/creative decisions in one company-wide knowledge graph, scoped to my repo and department** so that **decisions stop being re-derived, cross-team knowledge is one query away, and I never hand-wire a sync mechanism** — I just work, and the graph fills itself and syncs over S3.

## Problem

- **Decisions are siloed per repo and per file.** `.ai/decisions/DDR-*.md` is a flat, grep-only store; relationships (supersedes, references, overrides) live in prose, not as traversable edges (proven: `kg query` path DDR-104↔DDR-171 returned nothing until cross-ref edges were extracted — see `scripts/kgai-smoke/`). There is no cross-repo view.
- **`.ai/` is heavy.** It carries decisions, state history, dev-logs, reviews — much of which is a decision/event stream that a graph models better, mixed with a few genuinely narrative MD files (PRD, design-system, plans/guides) that should stay as prose.
- **No company memory.** Marketing can't see why dev chose X; finance decisions are invisible to automations. Sharing today means manual file spelunking.
- **DDR numbering races** on shared `main` (memory `project-ddr-numbering-races-on-shared-main`) — kgai's deterministic `hash(kind+name)` identity + append-only log removes the race entirely.

## Solution

A four-layer integration, each independently shippable:

1. **Config + capability gate** (`knowledgeGraph.mode: auto|on|off`, default `auto`) + soft dependency on the `kg` CLI. A single resolver (`kgai-backend` skill) that every flow/design command consults: "is kgai active here? what's my scope? what's the store?".
2. **Native read/write wiring** at the flow + design lifecycle bookends (plan/execute/done, setup-ds/new/edit) — `kg context` before, `kg ingest` after, `kg sync` at close.
3. **Cross-repo scoping**: every write links its decision to `repo:<name>` + `dept:<name>` elements and stamps scope props; every repo points `store` at the same `s3://company-kg/store`; search biases to the config's `scope.dept` first, opt-in widens to all scopes. (Native `--scope` filter is a **kgai feature request**; until it lands we encode scope as first-class graph elements + Cypher filters, which works on today's kgai.)
4. **Migration + onboarding**: a `/flow:migrate-kgai` skill (productionizes `scripts/kgai-smoke/ddr2kgai.py` — DDR/plan/STATE → `kg ingest` batches with real dates, cross-ref edges, scope tags), plus per-user + company setup guides.

**What kgai replaces vs. what stays MD** — the user's goal is a **full switch**: after migration the local markdown knowledge graph is no longer used; even heavy files (STATE.md, and the decision-catalog parts of CLAUDE.md) shrink to pointers into kgai. Classified from the deep audit (Appendix A): **A** = migrate as decision/event · **B** = keep MD, kgai holds a node+pointer · **C** = keep on disk as referenced asset · **D** = drop (noise).

| `.ai/` artifact | Count | Class | Fate under kgai-active |
| --- | --- | --- | --- |
| `decisions/DDR-*.md` | 182 | **A** | → kgai decisions (one node each, typed supersede/relate/extends edges). Old files kept read-only as archive; never auto-deleted (DDR-044 safety). |
| `decisions/README.md` index | 1 | harvest→D | Densest link source — **harvest its `id→file→date→tags` edges first**, then drop (regenerable from nodes). |
| `state/STATE.md` (2261 ln, 852 KB) | 1 | **A** stream | Explode each `## Execution Progress` block + History row into dated **events** (plan+commit+DDR refs). File shrinks to a thin **pointer-stub** ("history lives in kgai — `kg history`"). |
| `logs/{rca,system-reviews,execution-reports,code-reviews,security-reviews}/*.md` | 116 | **A** | Each is a dated verdict/finding **decision** citing plan+DDR. Migrate as investigation/review events. |
| `plans/*.md` + `plans/archive/*.md` | 135 | **B** | `plan:` node (title/status/frontmatter edges) + on-disk MD. Body too procedural to inline. |
| `docs/*.md` (PRD, collab-model, patterns…), `context/studio-shell-parity.md`, `release-guide.md`, `dev-logs/*` | ~11 | **B** | Narrative docs → node + pointer (heavily back-referenced by DDRs). |
| `scenarios/*/spec.md` + latest run report | ~30 | **B/A** | Spec = `scenario:` node; each run report = a dated verification event. Older runs → C. |
| `scenarios/**/*.png`, `browser/`, `device/scenario-runs/**` (latest run only) | ~700 files, 80 MB | **C** | Evidence referenced by a report/RCA. **Keep newest run per scenario; all older timestamp dirs = D** (bulk noise). |
| `cache/**`, `context/codebase-map.md`, `templates/`, `INDEX.md`, `.ai/README.md`, `reviews/README.md`, `.DS_Store`, `.gitkeep` | ~30 | **D** | Regenerable snapshots / ephemeral cache / scaffold cruft — skip. |
| `workflows.config.json` | 1 | keep | Config, not knowledge — stays on disk (a `config` pointer node only). |
| **`CLAUDE.md`** (root, ~40 KB) | 1 | **slim** | Keep the load-bearing **behavioral invariants** (conventions, "always/never" rules); the parts that merely **catalog decisions** (DDR enumerations, "see DDR-NNN" history) become `kg` pointers. Full gutting is risky — slim, don't delete (Task 13). |

Design-side (`.design/`, Appendix A.2): canvases `ui/*.tsx` + `.meta.json` → `canvas:` nodes; `system/<ds>/` → `ds:` node + `component:` brand/token specimens; everything `_*`-prefixed + `exports/`/`assets/` = **runtime noise, skip** (DDR-115 taxonomy). Design decisions are **net-new to the graph** — today they are recorded nowhere in `.ai/decisions` (Appendix C).

## Metadata

- **Ticket**: — (tracker `github`; create an issue at execute time if desired)
- **Type**: New Capability (cross-cutting)
- **Complexity**: High
- **App/Package**: `plugins/flow`, `plugins/design`, `cli/`, `plugins/flow/.claude-plugin/config.schema.json`, `plugins/flow/templates/ai-skeleton`, **`apps/studio/acp/` + `apps/studio/footage-store.ts`**, **`apps/desktop/` (bundling)**, `docs/`, `site/content/docs/config-schema.mdx` (regen)
- **Affected Systems**: flow + design command lifecycle, config schema, `maude` CLI + preflight/`doctor`/`init`, `.ai/`/`.design/` scaffold + migration, cross-repo S3 sync, **desktop ACP plugin injection + native sidecar bundling (Phase 8)**, **debate-protocol**, **hub trust boundary**, CI gates (config-schema drift, reachability, tarball-shape)
- **8 phases**: 1 Foundation · 2 Flow wiring · 3 Design wiring · 4 Cross-repo scope + trust DDR · 5 Migration · 6 Onboarding · 7 Full switch + hooks · 8 Desktop bundle + ACP inject. Phases 1–7 are terminal-`claude`-complete; Phase 8 (native, codesign) is the desktop track and can follow.
- **Dependencies**: `kg` CLI (kgaidev/kgai, soft dep); an S3 bucket + AWS creds (company, for cross-repo); Kuzu native lib (bundled by kgai's own install.sh)
- **Upstream (kgai) feature requests**: native `--scope`/`--repo` filter on `context`/`search`/`history`; a `scope` field in the decision schema; scope-aware relevance ranking; a first-class `kg import` (our migration skill is the interim). Owner is the maintainer (user's brother) — realistic to land.

> **Upstream status check — kgai v0.1.9 (2026-07-19, re-verified).** Since our v0.1.x/1a8fadd baseline, 11 commits landed and **three directly touch this plan** (all verified locally):
> 1. **`as-of` cliff is FIXED** (commit 95d99fe) — now uses the bulk loader; upstream measured 46k decisions ~50 min → **0.67 s**, and I re-measured @180 on the prebuilt: ~10 s → **908 ms**. → The plan's "never put `as-of` on a hot path" restriction is **relaxed** (Task 6, Open fork #4). My earlier 12-min@20k figure was the pre-fix binary.
> 2. **macOS prebuilds SHIP** (v0.1.9) — `kg-darwin-arm64`/`x86_64` + `libkuzu-darwin-universal.dylib` are published release assets with `@loader_path` rpath done. **Verified**: downloaded + ran with only `DYLD_LIBRARY_PATH`. → **Phase 8 Task 15 simplifies** from "build from Go source" to "download the release sidecar" (exactly the compiled-bun/agent-browser model).
> 3. **Sync perf** (ce3e937) — 29× faster catch-up pull, 4× faster cold clone; **context recall now serves only head decisions** (ff2d97c, the first external issue #1). Eases the cross-repo sync cost + cleans read semantics.
> **Project scoping (the user's ask): STILL no native query-time `--scope` filter** on context/search/history — our element-encoding + Cypher interim stands. BUT a native scoping *direction* has emerged: the **`kgai://org/project` cloud broker** (`internal/remote/cloud.go`) token-scopes all S3 keys to an org/project keyspace. This ISOLATES per-scope rather than unifying — it partially conflicts with this plan's "one graph, scope by tags" assumption. See the new scoping fork (Open fork #7). Maturity: still nascent (3 stars, 0 open issues, daily commits) but now with prebuilt releases + macOS + external engagement.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `plugins/flow/.claude-plugin/config.schema.json` — Why: the `orchestration` block is the exact precedent for a capability-gated `mode: auto` knob; the `integrations.*` blocks show the `provider`/`mcp`/`defaults` shape. The new `knowledgeGraph` block slots at top-level (it's a backend, not an external pointer).
- `plugins/flow/commands/record-ddr.md` — Why: the canonical decision-write path (find next number → write file → append index → CLAUDE.md sweep). This is the primary function to branch on backend.
- `plugins/flow/commands/plan.md`, `done.md`, `status.md`, `resume.md` — Why: the read/write bookends where `kg context`/`kg ingest`/`kg sync` hook in.
- `plugins/flow/skills/debate-protocol/SKILL.md` — Why: reference implementation of a capability-gated, config-read, opt-out skill (`orchestration.mode` → `auto`/`reduce`/`off`). The `kgai-backend` skill mirrors its resolver structure.
- `plugins/flow/dependencies.json` — Why: add the `kg` soft dep here (pattern: `maude`/`agent-browser` soft entries) so `maude doctor` reports it.
- `plugins/design/agents/design-system-keeper.md`, `plugins/design/commands/edit.md` — Why: design-side decision writes (DS/canvas/brand decisions) route through the same backend.
- `scripts/kgai-smoke/ddr2kgai.py` + `scripts/kgai-smoke/README.md` — Why: the **working prototype** of the migration + cross-ref extraction + measured perf baseline. The migration skill productionizes this.
- `.ai/decisions/DDR-130-*.md` (orchestration layer) — Why: the governance/opt-out template to imitate for a capability that spends resources the user didn't explicitly authorize.
- `.ai/decisions/DDR-054-*.md` (untrusted-peer / hub security) — Why: the S3 shared-graph trust boundary reuses this reasoning.
- `apps/studio/footage/schema.ts` + `apps/studio/footage-store.ts` — Why: the **implemented** footage/EDL data model (`FootageAnalysis`, `Edl`) and the content-addressed sidecar write path (`PUT /_api/footage`, `assetSha8`/`edlSlug`). This is the concrete `footage:`/`reel:` vocabulary + the **server-write emit site** (footage-store) where kgai capture must hook — because server writes bypass kgai's edit-tool Stop hook (Task 8).
- `plugins/design/commands/video-analyze.md`, `reel.md` + `plugins/design/skills/footage-keyframes/SKILL.md` — Why: the implemented one-shot analyzer + cut assembler + frame-selection skill; the command boundaries where an explicit `kg ingest` alternatively hooks. `feature-scene-aware-keyframes.md` is the plan of record for the tiered-engine DDR ≈183. Proof-case that the design surface grows — the `kgai-backend` resolver must be open-ended (glossary of kinds), not a hardcoded command list.

### Files to Create

- `plugins/flow/skills/kgai-backend/SKILL.md` — the **resolver + contract**: reads `knowledgeGraph.*` from config, detects `kg` on PATH + store presence, resolves `{active, store, scope:{repo,dept}, mode}`, and exposes the canonical read/write/sync recipes (`kg context`, `kg ingest`, `kg sync`) with scope-tagging baked in. Single source of truth every command calls.
- `plugins/flow/skills/kgai-migrate/SKILL.md` + `plugins/flow/commands/migrate-kgai.md` (`name: flow:migrate-kgai`, category `setup`) — the migration flow.
- `cli/lib/ddr-to-kgai.mjs` — productionized importer (port of `scripts/kgai-smoke/ddr2kgai.py`): `.ai/decisions/*.md` (+ `state/STATE.md` history, `plans/*.md` as elements) → `kg ingest` batches with real dates, cross-ref edges (SUPERSEDES/OVERRIDES/REFERENCES), and scope tags. Reachable via `maude kg import` (DDR-062: plugin markdown calls `maude`, never a raw path).
- `cli/commands/kg.mjs` — thin `maude kg <verb>` dispatcher (`import`, `scope`, `doctor`) that wraps the bundled `kg` binary with resolved env (store, scope) — mirrors `cli/commands/design.mjs`.
- `docs/kgai-onboarding.md` — per-user quick guide (install → creds → `kg init --remote` → first `kg sync`).
- `docs/kgai-company-setup.md` — one-time company setup (S3 bucket, IAM, scope taxonomy).
- `plugins/flow/templates/ai-skeleton/workflows.config.json` — add a **disabled-by-default** `knowledgeGraph` stub (skeleton stays opinion-free per DDR-043 spirit; `maude doctor --fix` / onboarding fills it).

### Documentation

- [kgai README](https://github.com/kgaidev/kgai) — Why: `kg` CLI surface (`init/ingest/context/history/search/as-of/conflicts/sync/rebuild/export`), decision JSON schema (`title/rationale/author/date/refs/supersedes_on/mutations`), `--remote` (git / `s3://` / `kgai://`).
- kgai `docs/ARCHITECTURE.md` — Why: S3 segment sync protocol (pull-on-command via `kg sync`, stateless segment keys, full projection rebuild on sync), conflict-as-branch model.
- `scripts/kgai-smoke/README.md` — Why: **measured** perf baseline on real data: import 175 DDR = 1.7 s; reads flat ~44–56 ms; rebuild (bulk path >1000 events) ~842 ms @20k; **`as-of` is O(n) — 12 min @20k**; storage ~2.6 KB/decision. These numbers gate the sync cadence + "never put `as-of` on a hot path" rule.

### Patterns to Follow

**Capability-gated resolver (from `orchestration.mode: auto`)** — the `kgai-backend` skill reads config, detects capability, and returns a mode; commands never re-implement detection:

```
mode = config.knowledgeGraph.mode ?? "auto"
active = mode == "on"  ? true
       : mode == "off" ? false
       : /* auto */      (kg-on-PATH && (config.knowledgeGraph.store || local .kgai/store exists))
```

**Reach executable logic via `maude` (DDR-062)** — plugin markdown calls `maude kg import` / `maude kg scope`, never `bash .../kg`. The banned-direct-invocation test (`cli/lib/plugin-cli-reachability.test.mjs`) covers new verbs.

**Runtime-state taxonomy (DDR-115)** — `.kgai/store/` is per-machine runtime state → gitignored in all three lists (`apps/studio/git/service.ts` `isMaudeRuntimeState`, `cli/lib/gitignore-block.mjs`, repo `.gitignore`). kgai itself already gitignores it; the flow gitignore block must mirror that.

---

## Design Decisions

No UI. The "design" here is the config schema + skill contracts + the scope data model.

### Config: new top-level `knowledgeGraph` block

```jsonc
"knowledgeGraph": {
  "mode": "auto",                     // auto (default) | on | off  — capability-gated opt-out
  "engine": "kgai",                   // reserved for future engines
  "engineVersion": "v0.1.9",          // PINNED kgai release the CLI + desktop bundle target (Task 0); advance deliberately, never float
  "store": "s3://studyfi-kg/store",   // shared company remote; "" = local-only .kgai/store
  "scope": { "repo": "maude", "dept": "dev" },  // stamped on every write; dept = default search bias
  "capture": {
    "decisions": true,                // route /flow:record-ddr + DDR-worthy writes to kgai
    "state": true,                    // route STATE.md history events to kgai
    "auto": true                      // let kgai's Stop hook nudge decision capture after edits
  }
}
```

- **`additionalProperties: false`**, all fields optional with safe defaults so an absent block ⇒ `auto` (matches orchestration).
- Design plugin reads the **same** block from `workflows.config.json` (flow owns `.ai/`; design already reads it for `designRoot`). Repos that are design-only still carry a minimal `workflows.config.json` for this — documented in onboarding.

### Scope data model (works on today's kgai; no upstream change required)

Every `kg ingest` from a scoped repo appends, in addition to the decision's own mutations:

```jsonc
{ "op": "upsert_element", "kind": "repo",  "name": "maude" }
{ "op": "upsert_element", "kind": "dept",  "name": "dev" }
{ "op": "add_link", "from": "decision:<id>", "to": "repo:maude", "link": "IN_REPO" }
{ "op": "add_link", "from": "decision:<id>", "to": "dept:dev",   "link": "IN_DEPT" }
```

- **Search bias**: `kg context`/`search` results are re-ranked so `dept:<config.scope.dept>` hits sort first; a `--all-scopes` escape widens. Interim implementation = Cypher filter over the `IN_DEPT` edge (the `kgai-backend` skill owns the query); native `--scope` is the upstream ask.
- **One graph, many scopes**: all repos `kg sync` to `s3://studyfi-kg/store`. Deterministic `hash(kind+name)` means `dept:dev` converges to one node across repos — no coordination.

### kgai lifecycle mapping

| Maude touchpoint | kgai action | Notes |
| --- | --- | --- |
| `/flow:plan` (start) | `kg context --about <feature>` (scope-biased) | replaces "grep past DDRs"; feeds the plan's prior-art |
| `/flow:record-ddr` | `kg ingest` (decision + scope + cross-ref links) | replaces file write when active; else classic file |
| `/flow:execute` (after structural change) | `kg ingest` (auto via Stop hook or explicit) | `capture.auto` gates the nudge |
| `/flow:done` (close) | `kg ingest` (closing decision) → `kg sync` (push to S3) | sync cadence at close, not per-edit (rebuild cost — see perf) |
| `/flow:status`, `/flow:resume` | `kg context` / `kg history` | reconstructs state from graph instead of STATE.md |
| `/design:setup-ds`, `/design:new`, `/design:edit` | `kg ingest` DS/canvas/brand decisions (elements `ds:`, `canvas:`) | routes through the same backend + `record-ddr` path |

### Autonomous capture & identity — REUSE kgai natively (audit finding, Appendix D)

The audit changed the design here: **kgai already ships autonomous capture and git-author identity — we do not build them, we reuse them.**

- **Autonomous capture** = kgai's own **`Stop` hook** (`hooks/auto-capture-stop.sh`, registered by the kgai plugin). It parses the turn's transcript, counts edit-tool uses (`Edit/Write/MultiEdit`), and if the turn edited code but did **not** run `kg ingest`, returns `{"decision":"block"}` — forcing the model to record the structural decision (or explicitly record nothing). Loop-safe via `stop_hook_active`; zero added LLM cost. Its companion `knowledge-graph` skill auto-invokes ("WITHOUT WAITING TO BE ASKED") on structural changes. **This fires for design turns too** (they Edit `.tsx`/`.meta.json`). So kgai captures decisions **even when the user runs no flow/design command** — exactly the user's "works autonomously" requirement, already met.
- **What our integration adds is only the mapping layer**: the element/link **vocabulary** (`ds:`/`canvas:`/`edit:`/`plan:`/`repo:`/`dept:` + edge kinds) and the **scope tags**, so the nudge records into the right shape — not the trigger.
- **Git author = automatic.** kgai's `guessActor()` precedence is `KGAI_ACTOR` env → **`git config user.name`** → `$USER` → `"unknown"`, resolved at `kg init` and overridable per-decision. This repo's `user.name = 1aGh`, so decisions self-attribute with **zero wiring** — the user's "write who recorded it" requirement is a no-op we just verify. (Email is never used; inject `KGAI_ACTOR` if we ever want a richer identity string.)
- **The one hook we DO add** (flow/design side): a `SessionStart` `kg sync` **pull** (gated on `active` + `store` set) so each session opens with the company graph fresh — kgai's own SessionStart only installs the engine + inits the local store, it does not pull the shared remote.

### Failure & fallback

- `kg` missing / `mode:off` / store unreachable ⇒ **classic `.ai/` path**, unchanged. The resolver never hard-fails a command.
- `kg sync` failure at `/flow:done` ⇒ warn, keep local writes (append-only log is intact), retry next session. Never block the close.
- Conflicts (two heads on one element) ⇒ surface via `kg conflicts` in `/flow:status` (kgai's own Stop-hook already prints a conflict count).

---

## Tasks

Execute in dependency order. Phased so each phase is independently shippable and verifiable.

### Phase 1 — Foundation (config + capability gate + soft dep)

#### Task 0: UPSTREAM SYNC GATE — always re-verify kgai online before building (standing gate, not one-shot)
> kgai ships daily and its capabilities move under the plan (as of 2026-07-19 v0.1.9 already fixed `as-of`, shipped macOS prebuilds, and drifted scoping toward `kgai://org/project` keyspaces — Open fork #7). Several tasks + forks are **version-sensitive**, so the plan must re-check upstream every time it's picked up, not trust a snapshot.
- **Do**: A repeatable pre-implementation check, run at execute start AND before any rollout widening:
  1. **Fetch latest** — `curl -s https://api.github.com/repos/kgaidev/kgai/releases/latest` (tag + assets) and the commit log since the pinned version.
  2. **Re-scan the capability surface** the plan's assumptions hinge on: is there now a native `--scope`/`--project` flag on `context`/`search`/`history` (Open fork #7 / Task 9)? a first-class `kg import` (Task 11 becomes a thin wrapper if so)? a `scope` field in the decision schema? changes to the Stop hook / `guessActor` (Appendix D)? new prebuilt platforms (Task 15)? Grep the fetched source + README + `commands/kg-*.md`.
  3. **Re-run the harness pinned** — `KGAI_REF=<latest-tag> scripts/kgai-smoke/run.sh` (+ `bigbench.py`) to re-baseline perf on the version we'll target; confirm no regressions vs the recorded numbers.
  4. **Reconcile** — if upstream moved, update the affected tasks/forks (a landed `--scope` collapses fork #7 to B-native; a landed `kg import` trims Task 11; a new `as-of`/sync perf number updates the caveats) and bump the pinned version.
- **Wire it as a runnable gate**: add `maude kg check-upstream` (Task 4) that reports **installed vs latest release + a capability diff** (which plan-relevant flags/commands now exist), and pin the target in `config.knowledgeGraph.engineVersion`. The desktop bundle (Task 15) and CLI both target that pin, so "prepared for the latest infrastructure" is a version we deliberately advance, never drift.
- **Gotcha**: pin, don't float — auto-tracking `latest` would let an upstream change silently alter behavior mid-rollout (and is a supply-chain surface, DDR-054/056 reasoning: the bundled `kg` is third-party). Advancing the pin is a deliberate, harness-verified step.
- **Validate**: `maude kg check-upstream` prints installed=<pin> latest=<tag> + the capability diff; the harness re-baseline is green on the pinned tag; any moved assumption is reflected in the plan before code is written.

#### Task 1: ADD `knowledgeGraph` block to the config schema
- **Do**: Add the top-level `knowledgeGraph` object (shape above) to `plugins/flow/.claude-plugin/config.schema.json` with `additionalProperties:false`, `mode` enum `["auto","on","off"]` default `auto`, and documented defaults. **Regenerate + commit `site/content/docs/config-schema.mdx`** (`pnpm --filter @maude/site gen:reference`) in the same change — it's auto-generated from the schema and CI's drift gate fails otherwise.
- **Pattern**: Mirror the `orchestration` block (capability-gated `mode:auto`, absent-block ⇒ `auto`).
- **Gotcha**: Ajv 2020-12; `config-lint.mjs` must still pass. **Skeleton config ships the block ABSENT** (bias-free-skeleton rule — absent ⇒ `auto` via schema default, exactly like `orchestration`/`quality`). Do **not** seed a stub; `maude doctor --fix` / onboarding fills it. Cross-repo scope values (`repo`/`dept`) interpolate via the existing `workflows.config.json` transform in `init.mjs` if seeded.
- **Validate**: `node cli/bin/maude.mjs doctor` on a repo with and without the block; schema compile via `cli/lib/config-lint.mjs`; `config-schema.mdx` regenerated.

#### Task 2: ADD `kg` soft-dep + the SessionStart sync hook (decoupled from preflight — audit E.2)
- **Do**: Add a `kg` entry to `plugins/flow/dependencies.json` (+ design's) — `type:cli`, `hardness:soft`, check `kg version`, install hint. **This is the ONLY kgai touch in preflight** (data-driven; `preflight.mjs` is pure, 5 s-timeout, no-network, no-mutation — do not put sync there). Add a **separate `SessionStart` entry** to `plugins/flow/hooks/hooks.json` for the `kg sync` **pull**, gated on `mode !== off` + soft-dep present, run **async/best-effort with its own timeout** (never blocks session start). `hooks.json` correctly stays OUT of npm `files` (marketplace-only).
- **Pattern**: existing `maude`/`agent-browser` soft entries; the existing SessionStart preflight hook (add a sibling entry, don't replace).
- **Validate**: `maude doctor` lists `kg` soft/missing with the hint; SessionStart pull runs non-blocking and degrades to local cache on network failure.

#### Task 3: CREATE the `kgai-backend` resolver skill
- **Do**: `plugins/flow/skills/kgai-backend/SKILL.md` — reads `knowledgeGraph.*`, detects `kg` + store, resolves `{active, mode, store, scope}`, and documents the canonical recipes: `kg context` (scope-biased read), `kg ingest` (decision + scope mutations + cross-ref links), `kg sync`. Every command loads this skill instead of re-detecting.
- **Pattern**: `debate-protocol/SKILL.md` resolver structure (config-read → capability-detect → mode).
- **Gotcha**: project-agnostic — scopes/store come from config only, never literals.
- **Validate**: dry-run the recipes against the `scripts/kgai-smoke` store; assert `active=false` when `kg` absent.

#### Task 4: ADD `maude kg` CLI dispatcher (+ `check-upstream`) + gitignore mirror
- **Do**: `cli/commands/kg.mjs` (`maude kg import|scope|doctor|check-upstream`) wrapping the bundled `kg` with resolved env (store/scope), mirroring `cli/commands/design.mjs`. **`check-upstream`** (Task 0's runnable form): fetch the latest kgai release + commit log, diff against `config.knowledgeGraph.engineVersion`, and report a **capability diff** (does upstream now have `--scope`, `kg import`, new prebuilt platforms, changed hooks) so a maintainer sees at a glance whether a plan assumption moved. Network + best-effort (offline ⇒ report "unknown, using pinned"). Add `.kgai/store/` to `cli/lib/gitignore-block.mjs` (+ repo `.gitignore`, + `isMaudeRuntimeState`) per DDR-115.
- **Gotcha**: DDR-062 reachability test — plugin markdown must call `maude kg …`, not a raw binary. Add the new verbs to the reachability allowlist.
- **Validate**: `node cli/bin/maude.mjs kg doctor`; `cli/lib/plugin-cli-reachability.test.mjs` green.

### Phase 2 — Flow native wiring (read/write bookends)

#### Task 5: UPDATE `/flow:record-ddr` to branch on backend
- **Do**: Load `kgai-backend`; if `active`, `kg ingest` the decision (title/rationale/author/date + scope mutations + cross-ref `add_link`s parsed from the decision body) instead of writing `DDR-NNN.md` + index. If inactive, unchanged. Print the resolved element ids.
- **Pattern**: the classic file path stays as the `else` branch verbatim (no regression).
- **Gotcha**: cross-ref extraction = the `ddr-to-kgai.mjs` classifier (SUPERSEDES/OVERRIDES/REFERENCES by keyword proximity).
- **Validate**: run in a kgai-active scratch repo → `kg context --about <title>` returns it; run in an inactive repo → file written as before.

#### Task 6: UPDATE the state/context commands — `/flow:plan`, `/flow:done`, `/flow:status`, `/flow:pause`, `/flow:resume` (audit Appendix B)
- **Do**:
  - `plan` → `kg context` (scope-biased) into prior-art before drafting; `kg ingest` a `plan:` node at write.
  - `done` → closing `kg ingest` (DDR sweep + retro) → **`kg sync` (push)**.
  - **`status`** → today it reads **git + plan-checkboxes, NOT STATE.md** (audit surprise). Add a kgai overlay: **`kg history --actor <me> --limit N`** ("last movements") + **`kg context`** on the active `plan:`/`feature:` ("current working context"). Keep git/PR/tracker as live overlays. This is the user's "flow:state returns last movements + current context."
  - **`pause`** → replace the HANDOFF.md + STATE.md write with a `kg ingest` **`paused` event** (phase/task/blockers/open-decisions as props) + `kg sync`. HANDOFF.md becomes a rendered *projection* of that event (optional, for humans), not the source of truth.
  - **`resume`** → reconstruct from **`kg context`/`kg history`** (last `paused` event for `--actor <me>`) instead of reading HANDOFF.md + STATE.md; emit a `resumed` event.
- **Gotcha**: **sync only at `done`/`pause`**, never per-edit (rebuild grows with log). `status`/`resume` still prefer `kg history`/`context` (flat ~50 ms) as the common path, but **`as-of` is no longer a hazard** — kgai v0.1.9 routes it through the bulk loader (sub-second at tens of thousands of decisions), so a time-travel view in `status`/`resume` is now cheap enough to use deliberately.
- **Identity**: `kg history --actor "$(git config user.name)"` scopes "my movements" to the current user (kgai stamps author automatically — Task validates, doesn't wire).
- **Validate**: `plan → execute → pause → resume → done` in a kgai-active scratch repo; `status` shows kgai-derived last-movements; inactive repo falls back to today's git+plan+STATE behavior unchanged.

#### Task 7: UPDATE `.ai` scaffold + STATE.md stub behavior
- **Do**: When kgai active, `maude init` / `/flow:init` writes a thin `STATE.md` pointer-stub ("history lives in kgai — `kg history`") and keeps PRD/design-system/plans as MD. Old `.ai/decisions/` preserved as archive; never auto-deleted.
- **Validate**: `maude init` in a kgai-active temp repo produces the reduced skeleton; classic init unchanged when inactive.

### Phase 3 — Design native wiring

#### Task 8: ROUTE design decisions through the backend (open-ended by resolver, not a fixed command list)
- **Do**: `/design:setup-ds`, `/design:new`, `/design:edit`, `design-system-keeper` record DS/canvas/brand decisions via the same `record-ddr` backend, adding `ds:<name>`, `canvas:<slug>` elements + `ABOUT`/`REFERENCES` links. Canvas ↔ decision relationships become graph edges (a canvas's design rationale is now queryable — net-new; design records nothing to `.ai/decisions` today, Appendix C). The **element/link vocabulary lives in the `kgai-backend` skill's glossary**, so any design command (present or future) that touches it inherits kgai without bespoke wiring.
- **Forward-compat — the footage family is ALREADY IMPLEMENTED** (`/design:video-analyze`, `/design:reel`, `footage-analyst`, `footage-director`, skill `footage-keyframes`, `maude design smart-frames`, `apps/studio/footage/schema.ts` + `footage-store.ts`; DDR ≈183 tiered-engine). Two things cover it:
  1. **Vocabulary** — add `footage:<sha8>`, `reel:<slug>`, `shot:` to the `kgai-backend` glossary (real schema: `FootageAnalysis{summary,tags,shots[],speech,provenance}`, `Edl{beats[].clip/why,music}`).
  2. **Server-write emit (the key nuance)** — footage/EDL sidecars land via `PUT /_api/footage` (server), NOT a model `Edit/Write`, so **kgai's Stop hook does not catch them**. Add ONE emit site in `apps/studio/footage-store.ts`'s write path → `kg ingest` a `footage:`/`reel:` node. This covers UI + CLI + agent callers at once (same reason the sidecar write is already centralized there). Photo-edit sidecars (DDR-161) have the same server-write property — same fix applies.
- **Pattern**: reuse `kgai-backend` recipes; design elements are just more `kind`s (schema-free model). Content-addressed `assetSha8()`/`edlSlug()` map 1:1 to kgai's `hash(kind:name)`.
- **Validate**: after a `/design:edit`, `kg context --about canvas:<slug>` shows the edit decision (Stop-hook path); after a `/design:video-analyze`, `kg context --about footage:<sha8>` shows the analysis with its `USES`/`FROM` edges (server-emit path) — proving both the model-edit and server-write capture routes work.

### Phase 4 — Cross-repo scoping + company graph

#### Task 9: IMPLEMENT scoping — resolve the model first (Open fork #7: broker keyspaces vs one-graph tags)
- **Decide first**: model **B** (per-scope `kgai://org/project` keyspaces via the cloud broker — recommended: isolation + trust + perf) or **A** (one shared store, `repo:`/`dept:` tag elements). This changes the shape of the task.
- **Do (model B)**: `kgai-backend` maps `config.scope` → a `kgai://<org>/<dept>` remote per repo; each dept is its own graph; cross-team is an explicit upstream cross-project read (file it). Trust boundary = the keyspace (folds into Task 10).
- **Do (model A)**: every ingest appends `repo:`/`dept:` upserts + `IN_REPO`/`IN_DEPT` links from `config.scope`; every read re-ranks/filters to `scope.dept` first with `--all-scopes` widen (Cypher over `IN_DEPT` interim; file native `--scope`).
- **Gotcha**: project-agnostic — StudyFi's `marketing/dev/finance/automations` are **config values in each repo**, never in the plugin.
- **Validate**: two scratch repos (`dept:dev`, `dept:marketing`) syncing to one local store; `kg context` from the dev repo sorts dev hits first, `--all-scopes` reveals marketing.

#### Task 10: RECORD the kgai cross-repo TRUST MODEL — its own DDR, analogous to DDR-054 (audit Appendix E.3 — was under-specified)
- **Do**: A DDR establishing that **a shared company kgai store is an attacker-controlled writer surface, not a benign datastore**. A single S3 store makes every decision node a cross-repo, cross-user propagation vector — structurally the DDR-054 untrusted-peer boundary, but worse: a poisoned node is read as **authoritative context** by `kg sync` into every repo's agent sessions (the DDR-054 F3 / DDR-130 trifecta lane, now company-wide). Rules:
  1. **`kg sync` output is untrusted DATA, never instructions** — quoted as inert context, never executed, never used to build a tool call (the DDR-130 output-handling guard, extended across the persistence boundary). A sync-pull colocated with private-data read + network egress is the trifecta — gate accordingly.
  2. **Hub and kgai are separate trust domains — the hub does NOT write the company graph.** The hub is "untrusted to peers" (DDR-054); hub-origin writes are **disabled or namespace-quarantined** (a distinct scope, not the authoritative graph), never merged in.
  3. **Write authorization**: only a **locally-authenticated CLI** writes to the shared store; hub-origin = no. Creds are per-user IAM; the bucket is IAM-scoped.
- **Validate**: DDR recorded; onboarding + company-setup guides reference it; the `kgai-backend` skill's read recipe treats `kg sync`/`kg context` output as quoted-inert.

#### Task 10b: ADD a `kg ingest` step to the debate bookend (audit Appendix E.4)
- **Do**: In `plugins/flow/skills/debate-protocol/SKILL.md`, at **Step 6→7 close** (after the single `AskUserQuestion` resolves), `kg ingest` the **resolved** decision: chosen direction + preserved dissent (`top_risk`), **seats as authors** (BUILDER/SHIPPER/BREAKER/…), shape (divergent/adversarial/research), confidence. The debate bookend is the best-defined decision site in the system (one framed decision, attributed, dissent preserved).
- **Gotcha**: Step 6 already declares seat output **untrusted DATA** — write seat strings as **inert attributed quotation**, so a poisoned `recommendation`/`top_risk` can't become an executable directive when `kg sync` reads it back later. Ingest only the *resolved* bookend (never per-seat blind openings; never on execute/quick).
- **Validate**: a `/flow:plan` debate in a kgai-active repo records one decision node with the seats as authors + the dissent as a quoted attribute.

### Phase 5 — Migration

#### Task 11: CREATE `/flow:migrate-kgai` (skill + command + `maude kg import`) — context-reconstructing migration (audit Appendix A + link-graph)
- **Do**: Productionize `scripts/kgai-smoke/ddr2kgai.py` → `cli/lib/ddr-to-kgai.mjs` as a **link-reconstructing** importer, run in edge-safe order:
  1. **Harvest edges from the two densest, regenerable sources FIRST** — `decisions/README.md` (id→file→date→tags, canonical order) and `state/STATE.md` (`## Execution Progress` blocks → plan+commit+DDR+date+branch events) — *before* they're dropped, or their ordering/date/tag metadata is lost (audit caution #1).
  2. **Ingest A-class decisions**: 182 DDRs + 116 log verdicts (rca/reviews/execution) as decisions with real dates + author (git `user.name`, automatic).
  3. **Rebuild typed edges** from the exact markers in the **Link-Graph table (Appendix A.3)** — `**Supersedes:**`/`**Related:**`/`**Extends:**`/`**Amends:**` → decision↔decision; `**Plan:**`/inline `plans/*.md` → `decided-in`→`plan:`; `**Related canvas:**` → `canvas:`; rca `.ai/decisions/DDR-…:line` → evidence. **Resolve typed edges first, then add remaining bare `DDR-\d+` body mentions as weak `references` edges, deduped** (audit caution #2 — DDR-054 is name-dropped 111× in plans; don't drown the graph).
  4. **B-class nodes + pointers**: `plan:`/`doc:`/`scenario:` nodes carrying a `path` prop to the on-disk MD (prose stays on disk).
  5. **Stamp scope tags** (`repo:`/`dept:` from config) on every node.
  6. **Design side** (`maude kg import --design`): `canvas:` from `ui/*.meta.json` (title/status/platform/brief/handoffCommit), `canvas —RENDERS→ ds:` from `meta.designSystem`, `ds:` + `component:` brand/token specimens from `system/<ds>/`, `canvas —(via ds)→ brand:` derived. **Footage family (implemented, on disk now):** `assets/<sha8>.footage.json` → `footage:<sha8>` (summary/tags/shots/speech, content-addressed id); `<slug>.edl.json` → `reel:<slug>` with `beats[].clip` → `reel —USES→ footage:<sha8>` edges + `beats[].why` rationale. This repo already has ~10 `.footage.json` + 2 `.edl.json` to migrate. Skip all `_*` runtime + geometry (`artboards[].x/y`).
- **Modes**: `--dry-run` (counts + sample + a rendered subgraph like the artifact viz), `--design`, `--since <date>`, `--scope <dept>`. Keep `.ai/decisions/` + `.design/` intact as archive.
- **Pattern**: the prototype already validated on this repo (180 DDR → 529 elements / 1287 links, incl. the DDR-104→171 supersede chain visualized in the artifact graph).
- **Gotcha**: idempotent guard — deterministic identity converges elements, but re-ingest adds duplicate decision *events*; write an `.ai/.kgai-migrated` marker (migrated commit SHA) and refuse double-import without `--force`.
- **Validate**: `maude kg import --dry-run` on this repo matches prototype counts; live import into a scratch store → `kg query` confirms the typed supersede chain + `kg history area:studio`; design import → `kg context --about canvas:<slug>` shows its DS + brand edges.

### Phase 6 — Onboarding + guides

#### Task 12: WRITE per-user + company guides
- **Do**: `docs/kgai-onboarding.md` (per user: install kgai plugin → configure AWS profile → set `store`+`scope` in `workflows.config.json` → `kg init --remote s3://… ` → first `kg sync` → verify with `kg context`). `docs/kgai-company-setup.md` (one-time: S3 bucket + IAM policy + scope taxonomy `dept ∈ {dev,marketing,finance,automations}`). Cross-link from README + the flow/design help.
- **Validate**: a fresh user on a clean machine can follow onboarding end-to-end in <15 min (dry-run walkthrough in review).

### Phase 7 — Full switch (retire the local markdown graph) + autonomous hooks

#### Task 13: SLIM STATE.md + CLAUDE.md to kgai pointers (the "stop using local MD graph" goal)
- **Do**: Once migration is verified, replace `state/STATE.md` with a thin **pointer-stub** (status line + "history: `kg history`; decisions: `kg context`"). In root `CLAUDE.md`, keep the **behavioral invariants** (conventions, "always/never" rules, build commands) but replace the **decision-catalog prose** (long "see DDR-NNN / DDR-NNN governs…" enumerations) with a single pointer block ("architectural decisions live in kgai — `kg context --about <area>`"). `workflow-state` skill's STATE.md schema becomes a kgai read/write contract.
- **Gotcha**: **slim, never gut.** CLAUDE.md is load-bearing project instruction — only the parts that *duplicate* the decision graph move to pointers; invariants stay. Do it behind the same `active` gate (inactive repos keep full STATE.md/CLAUDE.md).
- **Validate**: a fresh session in the slimmed repo still has every behavioral rule; `kg context` answers every "why is X so" that the removed prose used to.

#### Task 14: WIRE hooks — reuse kgai's `Stop` autonomous capture, add `SessionStart` sync
- **Do**: Confirm the kgai plugin's `Stop` hook + `knowledge-graph` skill are active (they ship autonomous capture — Appendix D; **do not rebuild**). Add to `plugins/flow/hooks/hooks.json` (and design) a **second `SessionStart` entry**: when `active` + `store` set, `kg sync` (pull) so the session opens on the fresh company graph. Keep the existing preflight SessionStart. Ensure `kg init` runs on first use so `guessActor()` captures git `user.name`.
- **Gotcha**: SessionStart timeout budget (existing preflight is 8 s; a network `kg sync` pull can be slow — run it `--warn-only`/backgrounded, never block session start). Sync-pull failure ⇒ work on the local cache, warn.
- **Validate**: edit a `.tsx` in a kgai-active scratch repo **without** running any flow/design command → the kgai Stop hook nudges a decision record (autonomous capture proven); open a second session → `kg sync` pulls a peer's decision.

### Phase 8 — Desktop app: bundle kgai + inject into ACP (autonomous capture in the shipped `.app`) — audit Appendix E.1

> **This phase is load-bearing for the "works autonomously in the app" requirement and was missing.** In the desktop ACP chat panel, autonomous capture is currently **inert**: the ACP session is built with `settingSources:['user']` (DDR-144) and only force-injects the bundled `design` plugin via `plugin-bootstrap.ts`. A terminal-less DDR-177 user never marketplace-installs kgai, so its SessionStart install + Stop capture hooks **never fire**. Fixing this is native work (Rust/Tauri + codesign), so it's its own phase and can ship after the CLI-first phases.

#### Task 15: BUNDLE `kg` + libkuzu as per-platform sidecars (download prebuilt — v0.1.9 ships them)
- **Do**: Ship per-platform `kg` + native `libkuzu` as `externalBin` sidecars — mirror the compiled-bun / agent-browser model. **kgai v0.1.9 now publishes prebuilt release assets** (`kg-darwin-arm64`/`x86_64`, `kg-linux-*`, `libkuzu-darwin-universal.dylib` + linux `.so`) with `@loader_path` rpath already set — **verified: downloads + runs with only `DYLD_LIBRARY_PATH`.** So `apps/desktop/scripts/sync-kg.mjs` **downloads the pinned release asset** (like `sync-sidecar`/`sync-agent-browser` fetch their binaries) — **no Go source build.** Stage in `stage-resources.mjs`; register in `tauri.conf.json` `externalBin`. Pin the kgai release version and track it (the Phase-8 bundling DDR owns the version-tracking policy). Still needs macOS codesign/notarize + JIT/hardened-runtime entitlements on the `kg` binary + libkuzu (unsigned third-party binaries won't pass notarization). `install.sh` is **not** used in-bundle.
- **Gotcha**: extend `apps/desktop/scripts/check-bundle-completeness.mjs --smoke` with (a) a `kg`+libkuzu presence check and (b) a **stripped-PATH `kg` capture round-trip** — today it has zero kg awareness; without the gate this breaks green-in-`tauri dev`, dead-in-`.app` exactly like the DDR-177 helpers.
- **Validate**: `check-bundle-completeness.mjs --smoke` on the built `.app` runs `kg` in a stripped PATH and records a decision.

#### Task 16: INJECT kgai as a first-party ACP plugin + route `maude kg`
- **Do**: Bundle the kgai plugin under `Resources/plugins/kgai`; resolve `KGAI_PLUGIN_DIR` in `apps/studio/paths.ts` (alongside `DESIGN_PLUGIN_DIR`); inject it in `plugin-bootstrap.ts` `computeSessionPlugins()` so its `hooks.json` (Stop capture) loads for the session. **Add `'kgai@…': false` to the hand-maintained `enabledPlugins` suppression literal** in `bridge.ts` (the file flags this drift trap). **Neutralize kgai's SessionStart *install* hook** (binary is pre-staged) and point the Stop hook at the bundled `kg` via env. Route `maude kg <verb>` through the existing `design.mjs` `spawnSync('bash', …)` / `MAUDE_PKG_ROOT` / ephemeral-bun-shim dispatch, resolving the staged `kg` + `DYLD_LIBRARY_PATH`→libkuzu, exporting `KGAI_BIN`/`KGAI_STORE` (these **survive the ACP `env.ts` scrub** — the correct channel, like `MAUDE_DEV_SERVER_ROOT`).
- **Validate**: desktop-e2e — edit a canvas in the ACP panel with **no** flow/design command → the injected kgai Stop hook fires and records a decision (autonomous capture proven in the shipped shell, not just `tauri dev`).

---

## Validation

This repo has **no test suite / lint / build** for plugin markdown (CLAUDE.md). Validation is targeted. **CI gates that this feature trips (audit Appendix E.2) — must be satisfied in the same change:**
- **Site config-schema drift (quality.yml)** — `site/content/docs/config-schema.mdx` is generated from `config.schema.json`; the new `knowledgeGraph` block ⇒ run `pnpm --filter @maude/site gen:reference` and **commit the regenerated mdx**, or CI fails. Same for the `maude kg` command surfacing in command-reference docs.
- **`plugin-cli-reachability.test.mjs`** — every kgai plugin markdown must invoke `maude kg <verb>` (DDR-062), never a raw `bash …/bin/*.sh` or `node cli/lib/kg-*.mjs` without a `command -v maude` fallback. Most likely gate to bite.
- **`check-tarball-shape.sh` / `check-publish-size.sh`** — keep ALL kgai runtime code under `cli/` or `apps/studio/` (auto-ships via `files`); **never under `apps/hub/` or `site/`** (reserved-slot hard-fail) and add no runtime npm dep (zero-dep assertion).
- **`version-parity.yml`** — untouched unless kgai ships a versioned sub-package.
- Add `cli/commands/kg.test.mjs` (runs under `pnpm test`). Roadmap regen + `whats-new.json` entry on `/done` (user-visible feature).

Targeted functional validation:

1. **Schema**: `node cli/bin/maude.mjs doctor` on kgai-active + inactive fixture configs; Ajv compile via `cli/lib/config-lint.mjs`.
2. **CLI**: `node cli/bin/maude.mjs kg doctor` / `kg import --dry-run`; `cli/lib/plugin-cli-reachability.test.mjs` (bun) green.
3. **Backend resolver**: dry-run `kgai-backend` recipes against `scripts/kgai-smoke` store — assert `active` flips correctly by capability/mode.
4. **End-to-end (scratch repos)**: `plan → execute → done` in a kgai-active temp repo; two-scope cross-repo search; migration import + `kg context` spot-check. Reuse `scripts/kgai-smoke/run.sh` scaffolding for an isolated `kg`.
5. **No-regression**: every touched flow/design command runs unchanged in a kgai-**inactive** repo (the `else` branch). This is the load-bearing acceptance gate (memory `feedback-no-break-exhaustive-verify`).
6. **Perf sanity**: confirm sync stays at close only; `as-of` never invoked on a hot path (perf baseline in `scripts/kgai-smoke/README.md`).

---

## Acceptance Criteria

- [ ] **Upstream re-verified at execute start** (Task 0): `maude kg check-upstream` run, pinned `engineVersion` recorded, harness re-baselined on the pinned tag, and any moved assumption (scoping/`--scope`, `kg import`, `as-of`, prebuilts) reconciled into the plan before code.
- [ ] `knowledgeGraph` block in schema (incl. pinned `engineVersion`); absent block ⇒ `auto`; `off` ⇒ classic `.ai/` unchanged.
- [ ] `kg` soft-dep surfaced by `maude doctor`; `maude kg` dispatcher reachable (DDR-062 test green).
- [ ] `kgai-backend` skill is the single resolver; no command re-detects capability.
- [ ] Flow bookends (plan/record-ddr/execute/done/status/resume) read/write kgai when active, files when not — **zero regression in inactive repos** (exhaustive per-command check).
- [ ] Design bookends route DS/canvas/brand decisions to kgai when active; footage/EDL server-write emit records `footage:`/`reel:` nodes.
- [ ] **Desktop (Phase 8, release-gating): autonomous capture proven in the shipped `.app`** — a desktop-e2e edits a canvas in the ACP panel with no flow/design command and the injected kgai Stop hook records a decision; `check-bundle-completeness.mjs --smoke` runs `kg` + a capture round-trip in a stripped PATH; Phase-8 bundling DDR recorded.
- [ ] Cross-repo: two scopes → one store → scope-biased search verified; `--all-scopes` widens.
- [ ] `/flow:migrate-kgai` imports this repo's `.ai/decisions/` into kgai (counts match prototype; cross-ref chain queryable) with `.ai/` kept as archive.
- [ ] Onboarding + company guides exist and are walk-through-verified.
- [ ] DDRs recorded for: the capability-gated backend model, the scope data model, the **cross-repo trust model** (hub-quarantine + `kg sync`-as-untrusted-data), and the **Phase-8 native-bundling** decision; kgai upstream feature-requests filed.
- [ ] `/flow:validate-security` reviewed the shared-graph writer surface before any multi-user rollout; debate bookend ingests seat strings as inert quotation.
- [ ] `pnpm --filter @maude/site gen:roadmap` run + committed with this plan (CLAUDE.md rule for new `.ai/plans/` files).

---

## Open forks (stated, not blocking — decide at execute time)

1. **How hard does `auto` lean on?** Recommendation: `auto` = active only when `kg` present **and** (`store` set or local store exists) — conservative, mirrors orchestration. A first-run repo stays on files until the user opts in via onboarding. Avoids surprising a downstream user with a new S3 dependency.
2. **STATE.md: stub vs. full removal.** Recommendation: keep a thin human-readable pointer-stub (not full removal) — kgai is CLI/agent-facing; a human glancing at `.ai/` still needs a "where did the history go" breadcrumb.
3. **Native `--scope` vs. element-encoding.** Recommendation: ship element-encoding now (works on today's kgai), file the native filter upstream; swap the resolver's read recipe to `--scope` when it lands — no downstream change.
4. **kgai maturity risk.** kgai is young (memory `project-kgai-research-verification`) but **trending up** — v0.1.9 (2026-07-19) shipped macOS prebuilds, fixed the `as-of` cliff, sped sync 29×, and fixed its first external issue; daily commits. Still: 3 stars, one maintainer. Mitigation baked in: opt-in `auto`, `.ai/` fallback + archive always intact, sync-at-close only. The `as-of`-off-hot-paths caveat is **retired** (fixed upstream, verified). Re-run `scripts/kgai-smoke/run.sh` (pin the kgai release) after upstream changes before widening rollout.
5. **Desktop (Phase 8) is COMMITTED scope — sequence it last, but it ships.** (Decided 2026-07-17.) The desktop app is the primary surface for the terminal-less user, so kgai capturing there is not optional — a graph that only fills from terminal sessions would miss most of the team's work. Phase 8 stays *sequenced* after 1–7 (native bundling = codesign/notarize/entitlements/rpath + the new bundle-completeness gate, Appendix E.1 — heavier, and the CLI path is where the model is proven first), but "desktop auto-capture works" is a **release-gating acceptance criterion**, not a deferral. The Phase-1–7-only window (desktop won't auto-capture yet) is an explicit **interim during rollout**, called out so it reads as in-progress, never as an end state. Phase 8 warrants **its own DDR** (bundling a third-party native engine — the brother's `kg` + Kuzu's `libkuzu` — into a signed/notarized `.app`: provenance, licensing (kgai MIT / Kuzu perms), and how the sidecar version tracks upstream; analogous to DDR-126/DDR-177).
6. **Security is now first-class, not an afterthought.** The shared graph is an attacker-controlled writer surface (Task 10 DDR): `kg sync` output is untrusted DATA under the DDR-130 trifecta guard, hub-origin writes are quarantined, debate seat strings ingest as inert quotation. This must be reviewed by `/flow:validate-security` before any multi-user rollout.
7. **Scoping architecture — the plan's biggest open decision, now sharpened by kgai's direction (2026-07-19).** Two models, and kgai is drifting toward the second:
   - **(A) One graph, scope by tags (this plan's assumption):** every repo pushes to one `s3://studyfi-kg/store`; scope = `repo:`/`dept:` elements + edges; `dept`-biased search with `--all-scopes` widen. **Pro:** cross-team query for free (the "pull marketing's decisions from dev" the user wanted). **Con:** one graph = one blast radius (trust), and rebuild/sync cost grows with the WHOLE company log.
   - **(B) Per-scope keyspaces via the `kgai://org/project` cloud broker (kgai-native, emerging):** `kgai://studyfi/dev`, `kgai://studyfi/marketing` — the broker token-scopes S3 keys per org/project, isolating each. **Pro:** smaller per-scope graphs (better perf + trust blast radius = one dept), aligns with the Task-10 trust model (isolation by default). **Con:** **no cross-team query** — isolation is the point; "see another team's decisions" would need a future cross-project read the broker doesn't have yet.
   - **Recommendation:** lean **B for isolation/trust/perf** (each dept its own keyspace via the broker), and file **cross-project read** as the upstream ask that gives back the opt-in cross-team query — rather than A's one-giant-graph, which fights both the trust model and the rebuild-cost curve. Decide at execute; it changes Task 9 (scope tags become keyspace routing) and Task 10 (the broker IS the isolation boundary). Either way the native query-time `--scope` filter is still absent, so within a keyspace the element-encoding interim still applies.

---

## Appendix — deep audit (2026-07-16, 4 parallel readers over the full flow/design/`.ai`/`.design` surface)

### A. Migration inventory (what to migrate vs. noise)

**A.1 `.ai/` — decision-bearing (migrate A) vs. narrative (B) vs. asset (C) vs. noise (D)** — full table in the Solution section. Headlines: **A** = 182 DDRs + 116 log verdicts (rca/system-reviews/execution/code-reviews/security-reviews) + STATE.md event stream. **B** = 135 plans + ~11 docs + scenario specs (node+pointer, prose stays on disk). **C** = ~700 screenshot/evidence files (keep newest run per scenario only). **D** = cache/, codebase-map, templates, INDEX, `.ai/README.md`, `.DS_Store`/`.gitkeep`, and **~500 stale `device/scenario-runs/` timestamp dirs** (biggest noise source — 78 MB).

**A.2 `.design/` — VERSIONED (migrate) vs. RUNTIME (skip), per DDR-115:**
- Migrate: `ui/*.tsx` (+`.meta.json`) → `canvas:<slug>` (props title/status/platform/**brief**/handoffCommit); `system/<ds>/` → `ds:<name>` + `component:` for brand specimens (`preview/logo.*`→BrandMark DDR-141, `iconography.*`→IconFamily) + Tokens (`colors_and_type.css`); project `config.json` → `concept:DesignProject`.
- Skip (runtime noise): everything `_*` (`_canvas-state`/`_chat`/`_comments`/`_draw`/`_history`/`_photo`/`_state`/`_trash`/`_untrusted`/`_server`/`_active`), `exports/`, `assets/` (fetched photos), `.meta.json` `artboards[].x/y` geometry.

### B. Flow wiring map (30 commands audited)

| command | reads `.ai` | writes `.ai` | kgai wiring |
| --- | --- | --- | --- |
| **status** | git + plan checkboxes (**NOT** STATE.md!) | — | **`kg history` + `kg context`** overlay = last movements + current context |
| **pause** | STATE.md, git | HANDOFF.md, STATE.md | **`kg ingest` paused event** + sync; HANDOFF becomes a projection |
| **resume** | HANDOFF.md, STATE.md | STATE.md; deletes HANDOFF | **`kg context`/`kg history`** reconstruct; emit resumed event |
| **plan** | PRD, DS doc, codebase-map, DDRs | plans/, STATE.md | `kg context` (prior art) + `kg ingest` (`plan:`) |
| **execute** | plan, STATE.md | STATE.md progress, plan checkboxes | `kg context` + `kg ingest` (task checkpoints; kgai Stop hook auto-captures) |
| **done** | plan, STATE.md | STATE.md, plans/archive/, logs/* | **`kg ingest`** (DDR sweep + retro) + **`kg sync`** (push) |
| **record-ddr** | decisions/ (next #) | DDR-NNN.md + README index + STATE Decisions | **`kg ingest`** — primary decision write (branch on backend) |
| record-execution / record-retro / bug-rca / review-code / validate-security | plan, git | logs/{execution-reports,system-reviews,rca,code-reviews,security-reviews}/ | `kg ingest` (dated verdict/finding events) |
| setup-prd | conversation | docs/PRD.md, plans/phase-*, STATE init | `kg context` + `kg ingest` |
| setup-codebase-map | repo | context/codebase-map.md | none (regenerable) |
| init | config | whole `.ai/` skeleton | **`kg init`** (bootstrap graph + git-author actor) |
| quick / validate-visual / utils-verify / scenario / release / maintain-* | — | logs/, cache/, scenarios/ | mostly none (ephemeral) |

**Write-site truth-set** (STATE.md owned by `skills/workflow-state`): STATE.md writers = pause/resume/execute/plan/done/setup-prd/record-ddr(+skill-loader). Decisions dir writer = **record-ddr only** (done/execute invoke it). No `.ai/dev-logs` writer exists; logs live under `.ai/logs/`. **No command reads git author today** — kgai supplies it automatically.

### C. Design wiring map (22 commands + 22 agents audited) — mostly NET-NEW graph

Design records decisions **nowhere in `.ai/decisions` today** (no design command writes DDRs or calls `/flow:record-ddr`). kgai adds the missing design decision graph:

| command/agent | produces | `kg ingest` element |
| --- | --- | --- |
| setup-ds (LOCK gate) | DS + vision-brief.json + LOCKed moodboard (not a DDR today) | `ds:<name>` + `direction:<ds>-locked` ← `research:<sha>` |
| new | canvas `.tsx`+`.meta.json` | `canvas:<slug>` —RENDERS→ `ds:` ; —used-brand→ `brand:` |
| edit | in-place mutation + `_history/<slug>/` snapshot | `edit:<slug>-NNN` —mutates→ `canvas:` (verbatim feedback prop) |
| critic panel / draw-critic | per-critic JSON verdicts | `critic-verdict:<slug>-<critic>-<iter>` —evaluates→ canvas/draw |
| design-system-keeper | reinvention/token-drift findings | `keeper-finding` —flags→ canvas; `reused-prior` edges |
| draw + draw-agent | verified SVG mark | `draw:<mark>` —drawn-for→ ds/canvas |
| handoff / rollback / board | registry.json / restore / annotations | `handoff:`/`rollback:`/`board:` events on canvas |
| `/design:video-analyze` + `footage-analyst` (IMPLEMENTED) | per-clip `FootageAnalysis` → `assets/<sha8>.footage.json` (server-written via `PUT /_api/footage`) | `footage:<sha8>` element — props from the real schema: `summary`, `tags[]`, `durationSec`, `keyframes`, provenance `{provider,model}`; `shots[]` (start/end/kind/motion/subject/mood/quality/usable) as child `shot:` nodes or props; `speech` = the audio fold-in. Edge `footage —FROM→ asset:<sha8>`. B-class (sidecar is source of truth). |
| `/design:reel` + `footage-director` (IMPLEMENTED) | EDL cut → `<slug>.edl.json` (title/fps/beats[]/music/audioTracks/captions) | `reel:<slug>` element; the **EDL assembly = a decision** (the "reziser" cut). Each `beats[].clip` → `reel —USES→ footage:<sha8>`; `beats[].why` = per-beat rationale prop. Edge `reel —RENDERS_AS→ canvas:<video-comp>`. |
| skill `footage-keyframes` / tiered engine | the `smart-frames` engine-tier decision | **DDR ≈183** (tiered-engine) = a normal `decision` node — records/migrates like any DDR. |

**Content-addressed identity is a gift here** — `footage-store.ts` `assetSha8()` / `edlSlug()` give stable sha8/slug ids that map 1:1 onto kgai's deterministic `hash(kind:name)`: `footage:<sha8>`, `reel:<slug>` converge with zero coordination across machines/repos.

**Wiring nuance the implementation forces (the real "how to zádrátovat" answer):** the footage/EDL sidecars are **written by the dev-server** (`PUT /_api/footage`, footage-store), NOT by a model `Edit/Write` tool call. kgai's autonomous **Stop hook counts edit-TOOL uses** — so it will **NOT** auto-capture a server-written sidecar (unlike a canvas `.tsx`/`.meta.json` that the model writes directly, which the Stop hook *does* catch). Therefore the footage family needs an **explicit backend call at the command boundary** — two clean options: (a) `/design:video-analyze` / `/design:reel` markdown adds a `maude kg ingest` after the sidecar `PUT` succeeds, or (b) **better/autonomous** — `apps/studio/footage-store.ts`'s write path emits to kgai (server-side), so *any* footage write (UI, CLI, agent) records once, centrally. Recommend (b): one emit site, covers all callers, mirrors how the sidecar itself is already centralized in footage-store.

**Forward-compat — new design skills inherit the backend automatically.** The integration routes **any** design decision through the `kgai-backend` resolver, so a new skill/command needs **no bespoke kgai wiring** for the *decision* path — it's covered when it records a DDR (backend branch) or when the model directly edits a file (Stop hook). The two per-skill tasks are: (1) **vocabulary** — name any new node kind (`footage:`, `reel:`, `shot:`) in the `kgai-backend` glossary; (2) **server-write emit** — if the skill's output lands via a dev-server route rather than a model file-edit (footage/EDL/photo-edit sidecars do), add the one emit site (option b). The wiring map is **open-ended by design** — the resolver is the contract, commands are callers; do not hardcode the command list.

**Canvas↔DS↔DDR link schema (for migration edge-rebuild):**
- canvas → DS = `meta.designSystem` string slug → matches `config.json designSystems[].name` (fallback `"project"`).
- canvas → brand = **derived, not on sidecar**: `system/<meta.designSystem>/preview/logo.*` — rebuild as `canvas —(via ds)→ ds —has-brand→ brand:`.
- DDR → canvas = `**Related canvas:**` `.design/…tsx` path in the DDR body (unidirectional, sparse — 12×).
- canvas → DDR = **absent today**; `meta.ai_context.pinned_decisions[]` is a reserved-but-unwritten slot → greenfield for kgai to backfill.

### A.3 Link-graph reconstruction — exact markers (the migration's edge extractor)

| source | marker / regex | target | edge |
| --- | --- | --- | --- |
| DDR | `^\*\*Supersedes:\*\*\s*DDR-(\d+)` (23×) | DDR | supersedes |
| DDR | `^\*\*Related:\*\*` / `^\*\*Relates:\*\*` → all `DDR-\d+` (58×) | DDR | relates |
| DDR | `^\*\*Extends:\*\*` (10×) / `^\*\*Amends:\*\*` | DDR | extends/amends |
| DDR | `^\*\*Plan:\*\*` + `\.ai/plans/(archive/)?[a-z0-9-]+\.md` (102×) | plan | decided-in |
| DDR | `^\*\*Related canvas:\*\*` + `\.design/[\w /-]+\.tsx` (12×) | canvas | design-artifact |
| DDR | inline `logs/rca/[a-z0-9-]+\.md` (24×) | rca | evidence |
| DDR (body) | bare `DDR-(\d+)` | DDR | **weak references — resolve typed edges FIRST, then dedupe these** |
| README index | `- \[DDR-(\d+): (.+?)\]\((DDR-\d+-[a-z0-9-]+\.md)\) — (\d{4}-\d{2}-\d{2}), (.+)` | DDR | canonical id→file→date→tags |
| STATE.md | `^## Execution Progress — (\S+) \((\d{4}-\d{2}-\d{2}), branch \`(\w+)\`, /(flow:\w+)\)` | plan+commit+cmd | dated event |
| plan frontmatter | `^decisions:\s*\[(.*)\]`, `^depends-on:`, `^absorbs:`, `^planned-via:` | DDR/plan | provenance |
| scenario spec | `\*\*Feature under test:\*\*\s*\`(feature-[a-z0-9-]+)\` \(commit \`([0-9a-f]+)\`, (DDR-\d+))` + `\*\*Canvas under test:\*\*\s*\`(\.design/.+\.tsx)\`` | plan+commit+DDR+canvas | verifies |
| log (any) | `Plan file:\s*\`\.ai/plans/…\``, bare `DDR-\d+`, security `(.+)-attacker\.md`↔`\1-defender\.md` | plan/DDR/review-pair | cites |

**Two migration cautions (load-bearing):** (1) harvest edges from STATE.md + decisions/README.md **before** dropping them — their date/tag/order metadata isn't in DDR bodies; (2) `DDR-\d+` is both typed edges and thousands of loose mentions — typed first, then dedupe loose ones as weak `references`, or the graph drowns (DDR-054 = 111× in plans).

### D. Autonomous capture & identity — already native in kgai (do not rebuild)

kgai registers exactly two hooks: **SessionStart** (`install.sh` — installs engine, inits local store, prints status) and **Stop** (`auto-capture-stop.sh` — the autonomous nudge: edits-without-record → `{"decision":"block"}`, loop-safe, zero LLM cost). The `knowledge-graph` skill auto-invokes on structural change. Author = `guessActor()` = `KGAI_ACTOR` → `git config user.name` → `$USER`. **Our integration reuses all of this**; net-new hook work = one `SessionStart` `kg sync` pull. Flow/design have only a SessionStart→preflight hook today (no Stop/PostToolUse), so the kgai Stop hook is the sole autonomous-capture mechanism and it already covers both plugins' edit turns — **in a terminal `claude` session.** (In the desktop app it does NOT — see E.1.)

### E. Infrastructure wiring beyond flow/design (desktop · CLI · hub · CI · debate)

**E.1 Desktop / ACP — autonomous capture is INERT in the shipped app (biggest missed gap).** The ACP session builds with `settingSources:['user']` (DDR-144) and force-injects only the bundled `design` plugin via `plugin-bootstrap.ts`; a terminal-less DDR-177 user never marketplace-installs kgai, so its SessionStart install + Stop capture hooks **never fire in the desktop chat panel.** Fix (Phase 8): (1) **bundle kgai as a first-party plugin** — stage `Resources/plugins/kgai`, resolve `KGAI_PLUGIN_DIR` in `paths.ts`, inject in `plugin-bootstrap.ts computeSessionPlugins()` (injected plugins DO load their `hooks.json` → Stop capture fires), add `'kgai@…':false` to the hand-maintained `enabledPlugins` suppression literal in `bridge.ts`, and **neutralize kgai's SessionStart install hook** (binary pre-staged). (2) **ship per-platform `kg` + `libkuzu` as `externalBin` sidecars** (`sync-kg.mjs` + `stage-resources.mjs` + `tauri.conf.json`; native dylib → rpath fixup + codesign/notarize/entitlements) — `install.sh` (Go/network) is dead terminal-less. (3) **extend `check-bundle-completeness.mjs --smoke`** with a `kg` presence + stripped-PATH capture round-trip (zero kg awareness today). (4) route `maude kg` through `design.mjs`'s `spawnSync('bash',…)`/`MAUDE_PKG_ROOT`/ephemeral-bun-shim; pass `KGAI_BIN`/`KGAI_STORE` — these **survive the ACP `env.ts` scrub** (like `MAUDE_DEV_SERVER_ROOT`).

**E.2 CLI + npm + CI.** Preflight (`preflight.mjs`) is a pure 5 s dep-checker — kgai gets only a **soft-dep data entry** there; the `kg sync` pull is a **separate SessionStart `hooks.json` entry** (async, non-blocking). `init.mjs` templates the ai-skeleton (`TEMPLATED = workflows.config.json, README.md, INDEX.md, release-guide.md, scenario-guide.md`) + rewrites the `$schema` URL — the `knowledgeGraph` schema propagates automatically; **skeleton block stays absent** (bias-free ⇒ `auto` via default); optional `kg init` = an opt-in `maude init --kg` flag (no-op when TTY/dep absent). npm `files` already ships `config.schema.json` + both `dependencies.json` + all of `cli/`/`apps/studio/` → new schema block, soft-dep, and any new `cli/lib/*.mjs` **auto-ship**; the rule: keep all kgai runtime under `cli/`/`apps/studio/`, **never `apps/hub/`/`site/`** (tarball-shape hard-fail) and add no runtime npm dep. **CI gates tripped:** site config-schema-drift (regen+commit `config-schema.mdx`), `plugin-cli-reachability` (all kgai markdown via `maude kg <verb>`), tarball-shape/publish-size (workspace + zero-dep). Add `cli/commands/kg.test.mjs`.

**E.3 Hub + cross-repo trust — needs its own DDR (Task 10).** A shared company store is the DDR-054 untrusted-peer boundary company-wide: a poisoned decision node is read as authoritative by every repo's `kg sync`. Hub is "untrusted to peers" → **hub-origin writes are disabled or namespace-quarantined**, never merged into the authoritative graph; `kg sync` output is **untrusted DATA under the DDR-130 trifecta guard** (inert quotation, never executed); only locally-authenticated CLI writes; per-user IAM.

**E.4 Debate → kgai (Task 10b).** The debate bookend (`debate-protocol` Step 6→7) is the best-defined ingest site — one resolved decision, attributed, dissent preserved. Ingest the resolved bookend only, seats as authors, seat strings as **inert attributed quotation** (they're declared untrusted DATA in Step 6).
