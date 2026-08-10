---
name: kgai-migrate
type: skill
description: "The migration contract for importing an existing file-based decision store (.ai/decisions/DDR-*.md) into the kgai knowledge graph. Use when running /flow:migrate-kgai or `maude kg import`. Owns the element/edge reconstruction rules, the typed-cross-ref-first ordering, scope tagging (model A), idempotency, and archive preservation. The importer itself is cli/lib/ddr-to-kgai.mjs."
keywords: [kgai, migrate, import, ddr, decisions, cross-ref, scope, idempotent, archive]
---

# kgai migration contract

How an existing repo's file-based decision store becomes a knowledge graph, once. The importer is `cli/lib/ddr-to-kgai.mjs`, reached via `maude kg import` (DDR-062). This skill is the contract it implements; `/flow:migrate-kgai` is the guided flow.

## Where the import lands — the store `kg config` resolves

Since kgai v1.5.1 the migration targets **the store the engine resolves via `kg config`** — for a `.kgairc`-enrolled repo that is typically the **shared parent-folder store** (e.g. `../.kgai-shared` next to the sibling repos), NOT a per-repo `.kgai/store`. Check `kg config` → `store_root` before running; if it reports `pending_approval`, the committed `.kgairc` must be human-approved first (`kg trust` — never run by the skill; see `flow:kgai-backend` §2). A repo joining the shared graph should get its **`.kgairc` committed** (identical values to the org's — one trust fingerprint covers all repos) as part of the migration, so every future clone enrolls the same way.

**Merging a legacy per-repo store into the shared one is a shard copy, not a re-import:** `cp <old>/.kgai/store/log/*.ndjson <shared>/log/` — **longest-wins per shard filename** (shards are append-only and per-install, so the longer file strictly contains the shorter) — then `kg rebuild`. Verified: this preserves graph-native decisions (no `.md` behind them) without mutations, which a wipe-and-reimport would lose (trap 2 below).

## The graph shape (few stable elements, many decisions)

kgai's model is "few stable domain elements shaped by many immutable decisions" — so the importer does NOT turn every DDR into an island node. Instead, per DDR:

- one `decision:DDR-NNN` element (so `kg context --about DDR-NNN` resolves), carrying `title`,
- shaping an `area:<primary-tag>` element (the DDR's first tag) via an `ABOUT` link,
- remaining tags → `topic:` elements, `area —TOUCHES→ topic`,
- `repo:`/`dept:` scope tags from `config.knowledgeGraph.scope` + `IN_REPO`/`IN_DEPT` links (model A — DDR-189),
- the **entire source document** as the decision `rationale` (not an excerpt — see below), real `Date` preserved.

## Edge reconstruction — typed markers FIRST, then dedupe bare mentions

`DDR-\d+` is BOTH typed cross-refs and thousands of loose body mentions. Resolve the strong ones first, or the graph drowns (DDR-054 alone is name-dropped 100+×). Order:

1. **Typed markers** (`**Supersedes:**` → `SUPERSEDES`, `**Related:**`/`**Relates:**` → `REFERENCES`, `**Extends:**`/`**Amends:**` → `EXTENDS`), keeping the strongest kind per target (`SUPERSEDES > OVERRIDES > EXTENDS > REFERENCES`).
2. **Bare `DDR-\d+` body mentions** → weak `references`, **skipped if the target already has a typed edge**.

All cross-ref links are `add_link` between two `decision:`-kind elements → they land in kgai's **generic `LINK` table** with the kind in `l.kind` (NOT the dedicated `SUPERSEDES` rel table, which is for Decision-level log supersession). Query them as `MATCH (a:Element)-[l:LINK]->(b:Element) WHERE l.kind='SUPERSEDES'`.

## Safety invariants

- **Archive-preserving.** `.ai/decisions/` is NEVER deleted (DDR-044). Migration is additive.
- **Idempotent.** Writes an `.ai/.kgai-migrated` marker; re-running refuses without `--force`. Deterministic `hash(kind:name)` converges the *elements* on re-ingest, but re-ingest still appends duplicate decision *events* — hence the guard.
- **Dry-run first.** `--dry-run` prints counts + a sample subgraph, writes nothing.
- **Author is automatic** — `git config user.name` via kgai's `guessActor()`.

## Full-body ingest — the graph must stand on its own

Log verdicts (`rca` · `system-review` · `code-review` · `security-review` · `execution-report`) ride the same import unless `--no-logs`.

**Both DDRs and logs are ingested with their FULL body.** An earlier cut stored only a lead paragraph (~3 % of a DDR) — which quietly made the graph an index that could not stand on its own, so every real "why" still required opening the file. The goal is a genuine switch: the graph answers "what did we reject, and why" with no file open. Cost: the committed log is ~5 MB for this corpus (2 MB of DDR prose + 1.1 MB of logs + envelope).

`.ai/logs/**` additionally matters because it is **gitignored** (the repo files it under "AI workflow runtime"), so those files exist only on the machine that produced them while committed docs reference them — the graph is their ONLY inheritable copy. Each log entry also gets `EVIDENCE_FOR` edges to every DDR it cites.

Dates: `**Date:**` when present (34 of 123), else the file's mtime — they're untracked, so git has no creation date either.

## Incremental refresh — `--only`

A DDR written straight to disk (not through `/flow:record-ddr`) leaves the graph stale. Refresh just that one:

```bash
maude kg import --only "DDR-191"          # or several: --only "DDR-006,DDR-191"
```

Bypasses the migration marker, skips the log sweep, doesn't re-stamp the marker. **Re-ingesting an existing DDR is the supported way to refresh a changed file** — deterministic identity converges the element and props merge; it appends one more decision event, which is the honest record of "this was re-recorded."

## Two traps worth knowing

1. **kgai is append-only — there is no `remove_link`.** A wrong edge cannot be retracted; the only way to drop one is to rebuild the store from scratch. Get the classification right before a bulk run.
2. **A clean re-import rebuilds from FILES, so anything recorded graph-native is lost.** Decisions ingested directly (no `.md` behind them) do not survive a wipe-and-reimport — measured: two such records vanished in a rebuild, leaving exactly `DDRs + logs`. If a decision is worth keeping, give it a `.md`; treat graph-native records as ephemeral.

## What in `.ai/` migrates, what is noise, what stays — the full sweep

A migration is only "done" when every folder has been *classified*, not just when the DDRs are in. Audited on this repo (2026-07-28); the same four classes apply anywhere:

| `.ai/` folder | Class | Treatment |
| --- | --- | --- |
| `decisions/**` | **A — migrate** | full body → `decision:` nodes + typed edges. Then `--archive`. |
| `logs/**` (rca · reviews · execution-reports) | **A — migrate** | full body → `rca:`/`*-review:` nodes + `EVIDENCE_FOR` edges. Usually **gitignored**, so the graph becomes their only inheritable copy. Then `--archive`. |
| `state/STATE.md` | **A — migrate (event stream)** | `## Execution Progress` blocks + `\| date \| phase \| note \|` History rows → dated `milestone:` nodes linked `PROGRESS_ON` → `plan:`. 930 KB on this repo → a ~1 KB pointer-stub, original kept under `archive/state/`. Archive only AFTER gating the writers (see below). |
| `docs/**`, `dev-logs/**`, `release-guide.md`, `context/studio-shell-parity.md` | **B — narrative, keep** | prose a human reads start-to-finish. A node + `path` pointer is the most that helps. |
| `plans/**`, `scenarios/**` | **B — keep, owner's call** | procedural / test specs; excluded here deliberately. |
| `device/**` (80 MB!), `browser/**`, `cache/**`, `context/codebase-map.md`, `reviews/README.md`, `INDEX.md`, `README.md` | **D — noise** | per-run screenshots, regenerable snapshots, scaffold cruft. **Never migrate.** `device/` alone was 582 files / 80 MB — the single biggest thing that looks like content and isn't. |
| `templates/**` (the repo's OWN copy) | **A — dead under kgai** | `STATE.md`/`HANDOFF.md` seed files that the graph now replaces → archive. `PROJECT.md` had 0 refs even classically. **Not the same thing as `plugins/flow/templates/ai-skeleton/`** — that scaffold ships to downstream repos and MUST keep its templates for the classic backend. Grep before deleting either. |
| `workflows.config.json` | keep | config, not knowledge. |

**Rule of thumb:** migrate what is *dated and append-only* (decisions, verdicts, progress). Keep what is *narrative and re-read*. Skip what is *regenerable or per-run*.

### "Migrated" ≠ "archivable" — two tests, not one

Ingesting a folder does **not** license moving it. Archive only when BOTH hold:

1. **The graph replaced its function** (you'd query the graph, not open the file), and
2. **Nothing writes it any more.**

| | in the graph | archivable? |
| --- | --- | --- |
| `decisions/`, `logs/` | ✓ | **yes** — write-once, superseded by the graph. Archived. |
| `state/STATE.md` + `templates/` | ✓ (216 milestone events) | **yes, once the writers are gated** — see below |
| `docs/`, `context/`, `dev-logs/` | ✓ (`doc:` nodes, full body) | **no** — LIVE workspace dirs in the plugin contract: `paths.codebaseMap` defaults to `.ai/context/codebase-map.md`, and `/flow:setup-prd`/`/flow:plan`/`/flow:maintain-docs` write real prose into them. The graph makes them searchable; it does not replace them. |

### The trap: test #2 against the ACTIVE behavior, not the classic one

"Nothing writes it any more" must be evaluated for the backend you are ON. `STATE.md` and `templates/` *look* live because `/flow:execute`, `/flow:pause`, `/flow:setup-prd` and `/flow:maintain-ai-health` touch them — but every one of those steps is **classic-path only**. Under an active graph: pause writes a `session:` event, execute checkpoints into the graph, and `STATE.md` is a pointer-stub. So they are dead, and archivable.

They only became *genuinely* dead once those four commands were explicitly gated (`skip when active`). **Gate the writers first, then archive** — archiving while an ungated command still writes the file just resurrects it on the next run, and worse, forks the handoff across two stores (a stale `HANDOFF.md` that `/flow:resume` might trust over the graph).

Under kgai a migrated repo therefore keeps: `plans/`, `scenarios/`, `docs/`, `context/`, `dev-logs/`, a stub `STATE.md`, `workflows.config.json` — and an `archive/` holding everything the graph took over.

## `--archive` — the cleanup half of a migration

```bash
maude kg import --archive
```

Runs **only after a clean ingest** (archiving on a failed one would move the sources out from under a graph that never received them — the one way this migration could lose decisions). Not the default: it rewrites the tree. Preview with `--dry-run --archive`, which prints every planned move and writes nothing.

What it moves:

| From | To | Why |
| --- | --- | --- |
| `.ai/decisions/**` (incl. `README.md`) | `.ai/archive/decisions/` | full body is in the graph; under an active graph `kg search` IS the index, so the README has no job left |
| `.ai/logs/**` | `.ai/archive/logs/` | gitignored — the graph is now their only inheritable copy |
| `.ai/templates/{STATE,HANDOFF,PROJECT}.md` | `.ai/archive/templates/` | seeds for the two files the graph replaced; `PROJECT.md` had zero references even classically |
| `.ai/state/STATE.md` | `.ai/archive/state/STATE-pre-kgai-<date>.md` **+ pointer-stub in place** | the path stays live (flow commands read it), so it is snapshotted, not moved |
| `.ai/state/HANDOFF.md` | `.ai/archive/state/HANDOFF-pre-kgai-<date>.md` | under the graph it never gets refreshed again — a stale handoff `/flow:resume` might trust |

`plans/`, `scenarios/`, `docs/`, `context/`, `dev-logs/`, `business/` stay **live** — narrative or procedural, not an event stream the graph owns.

**Three things it does NOT do, deliberately:**

1. **It never deletes.** Every source is *moved* (DDR-044). An entry already present in the archive is kept alongside, never overwritten.
2. **It does not rewrite in-repo references.** Grep for the old paths afterwards and fix them. Critically: leave the **plugin's own** `.ai/decisions/` mentions alone (`plugins/**`, `site/content/docs/**`, doc canvases) — those describe where DDRs live in *any* repo, and rewriting them exports one repo's archival choice into everyone else's convention.
3. **It does not gate the writers for you.** Archiving while an ungated command still writes `STATE.md` just resurrects it next run — see "Gate the writers first" below. The flow commands ship gated; a *downstream* repo with custom commands needs its own pass.

## Follow-ups (not yet in the importer)

- `--design` — the `.design/` importer (`canvas:` from `ui/*.meta.json`, `ds:` + brand `component:` from `system/<ds>/`, `footage:`/`reel:` from the content-addressed sidecars) is designed but not built. Plans, `.design/` and scenarios are **deliberately out of scope** (owner's call, 2026-07-28).
- `decisions/README.md` + `state/STATE.md` edge-harvest (canonical order / date / tag metadata that isn't in the DDR bodies).
