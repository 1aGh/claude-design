# Workflow State

> **kgai-active repo** — working state and history live in the knowledge graph, not this file.
> The `flow:workflow-state` skill reads/writes it via `flow:kgai-backend`.

**Status:** ready
**Active plan:** —

_Last closed:_ `feature-kgai-ecosystem-integration` (2026-07-28) — archived at
`.ai/plans/archive/`. Two follow-ups need the owner, both queryable:
`maude kg query "MATCH (f:Element {kind:'follow-up'}) RETURN f.name, f.props"`.

## Where it went

| Want | Ask the graph |
| --- | --- |
| history / "what happened with X" | `maude kg search "<feature>"` · milestone nodes are linked `PROGRESS_ON` → `plan:` |
| a decision's reasoning | `maude kg context --about "<element>"` (full body is stored) |
| my recent movements | `maude kg query "MATCH (d:Decision) WHERE d.author='$(git config user.name)' RETURN d.title, d.recorded_at ORDER BY d.recorded_at DESC LIMIT 10"` |
| where a paused session left off | `/flow:resume` — reconstructs from the last `session:` paused event |
| conflicts | `maude kg conflicts` |

The pre-migration file (930 KB, 88 progress blocks + 127 history rows) is preserved verbatim at
`.ai/archive/state/STATE-pre-kgai-2026-07-28.md`; all of it is in the graph as dated `milestone:` nodes.
