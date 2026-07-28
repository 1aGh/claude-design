# Workflow State

> **kgai-active repo** — working state and history live in the knowledge graph, not this file.
> The `flow:workflow-state` skill reads/writes it via `flow:kgai-backend`.

**Status:** in progress — Maude Cloud arc
**Active plan:** `.ai/plans/cloud-phase-4-selfhost-skill.md` (next)

_Last closed:_ `cloud-phase-3-workspace-agent-s3` (2026-07-28, core complete).
Phases 1 and 2 closed the same day. Decisions: DDR-192, DDR-193 (arc umbrellas),
DDR-194 (phase-2), DDR-195 (phase-3); DDR-148 corrected in place.

**Phases 5-10 are BLOCKED on vendor prerequisites an agent cannot satisfy** —
re-probed live 2026-07-28: Cloudflare account is Free (0 subscriptions),
Containers refuses ("requires the Workers Paid plan"), R2 refuses ("enable R2
through the Dashboard"), 0 zones on the account. Needs a paid plan, R2
enablement, and `cloud.maude.sh` on Cloudflare DNS. See
`.ai/plans/cloud-phase-0b-manual-prep.md`. Phase 4 is local and executable.

Carried forward into later phases:
- Hub doc namespacing is **opt-in** until Phase 3 makes it default-on in workspace mode.
- The collab origin gate refuses-and-resyncs a violating canvas peer rather than
  disconnecting it; revisit before hardening if a false positive is ever observed.

_Older:_ `feature-kgai-ecosystem-integration` (2026-07-28). Two follow-ups need the owner:
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
