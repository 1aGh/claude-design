---
name: flow:migrate-kgai
category: setup
description: Migrate this repo's .ai/decisions/ into the kgai knowledge graph (one-time, idempotent, archive-preserving)
argument-hint: "[--dry-run]"
---

# /flow:migrate-kgai — import existing decisions into kgai

One-time migration of the file-based decision store (`.ai/decisions/DDR-*.md`) into the kgai knowledge graph, so an existing repo keeps its decision history when it switches the backend on. The old files are **kept as a read-only archive — never deleted** (DDR-044 safety).

> Load the **`flow:kgai-backend`** resolver + the **`flow:kgai-migrate`** skill for the full contract. This command is a thin, safe wrapper over `maude kg import` (DDR-062 — plugin markdown reaches the importer via `maude`, never a raw path).

## Process

### 1. Pre-flight

- Confirm kgai is set up: `maude kg doctor`. If `active: false`, the import target is a local `.kgai/store` — run `/flow:init` with `--kg` or `kg init` first, and set `knowledgeGraph.scope` (`repo`/`dept`) in `.ai/workflows.config.json` so the migrated decisions are scope-tagged (model A, DDR-189).
- **Always dry-run first** to see the shape:

  ```bash
  maude kg import --dry-run
  ```

  Prints: source dir, resolved scope, decision + mutation counts, cross-ref count, distinct tags, and a sample decision's first mutations. Nothing is written.

### 2. Import

```bash
maude kg import
```

- Builds one `{decisions:[…]}` batch (each DDR → a `decision:DDR-NNN` element shaping an `area:<primary-tag>`, remaining tags → `topic:` + `TOUCHES`, typed cross-refs first (`SUPERSEDES`/`EXTENDS`/`REFERENCES` from the `**Supersedes:**`/`**Related:**`/`**Extends:**` markers, then bare `DDR-\d+` mentions as weak deduped `references`), plus `repo:`/`dept:` scope tags from `config.knowledgeGraph.scope`).
- Ingests via `kg ingest --file`. Author is stamped automatically from `git config user.name`.
- Writes an `.ai/.kgai-migrated` marker. **Re-running refuses without `--force`** (deterministic identity converges the elements, but a re-ingest would add duplicate decision *events*).

### 3. Verify

```bash
maude kg query "MATCH (e:Element) RETURN count(e)"                 # element count
maude kg context --about "<a known DDR topic>"                     # spot-check a decision
maude kg query "MATCH (a:Element)-[l:LINK]->(b:Element) WHERE l.kind='SUPERSEDES' RETURN a.name, b.name LIMIT 5"
```

> **Cross-ref links live in the generic `LINK` table** with the kind in `l.kind` (only Decision-level log supersession uses the dedicated `SUPERSEDES` rel table) — query `LINK` + `l.kind`, not a `[:SUPERSEDES]` pattern. See the `flow:kgai-backend` skill.

## Scope + flags

- `--dry-run` — counts + sample, no write.
- `--force` — re-ingest past the migrated marker (adds duplicate events — use only after a deliberate reset).
- `--design` — the `.design/` importer (`canvas:`/`ds:`/`footage:`/`reel:`) is a **follow-up, not yet implemented**; the command reports so.

## Notes

- Verified live (2026-07-23): this repo's 188 DDRs → 564 elements, 188 decisions, all scope-tagged, 13 `SUPERSEDES` + 36 `EXTENDS` + 700 `REFERENCES` typed cross-refs in the graph.
- The `.ai/decisions/` archive stays intact. Migration does not slim STATE.md / CLAUDE.md — that's a separate, later step gated on a verified migration (plan Phase 7).
