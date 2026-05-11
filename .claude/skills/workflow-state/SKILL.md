---
name: workflow-state
type: skill
description: "Use when running /plan, /execute, /done, /pause, /resume — anything that mutates `.ai/state/STATE.md` or `.ai/state/HANDOFF.md`. Ensures phase transitions, history rows, and active-task fields stay consistent so cross-session continuity works."
keywords: [state, workflow, phase, handoff, continuity, session]
---

# Workflow State

`.ai/state/STATE.md` is the single source of truth for "what's happening right now." It's read by `/status`, `/resume`, `/done`, and any future agent that joins mid-feature. Keep it accurate.

This skill complements `workflow-orchestration` (which covers the protocol of phases & gates). This skill focuses on the **STATE.md schema and lifecycle**.

## STATE.md schema

```markdown
# Workflow State

**Workflow:** ad-hoc
**Phase:** intake | discovery | design | planning | execution | verification | done | paused | blocked
**Status:** ready | in-progress | paused | blocked | done
**Started:** <YYYY-MM-DD>
**Updated:** <YYYY-MM-DD HH:MM>
**Active task:** <one-liner z plánu nebo "—">
**Active plan:** <.ai/plans/<x>.plan.md nebo "—">

## Decisions

<bullet list — krátké sumáře, plné DDRs žijí v .ai/decisions/>

## Blockers

<bullet list — co stojí v cestě, kdo to musí rozhodnout>

## History

| When | Phase | Note |
| ---- | ----- | ---- |
| <YYYY-MM-DD HH:MM> | <phase> | <one-liner> |
```

## Pravidla

1. **Každá phase change → nový history řádek.** History je append-only — žádný řádek se nepřepisuje, neodstraňuje, ani nemění pořadí.
2. **Updated field updni při každé editaci.** Slouží `/status` a `/resume` k detekci stale state.
3. **Pause path:** Phase → `paused`, Status → `paused`, current `Active task` zachovej (ne smaž). Detail je v `.ai/state/HANDOFF.md`.
4. **Done path:** Phase → `done`, Status → `done`, Active task → `—`, Active plan → `—`. Plán se přesouvá do `.ai/plans/archive/`.
5. **Blocked:** Phase zůstává původní, Status → `blocked`, Blockers sekce dostane bullet s konkrétem.

## HANDOFF.md (jen když paused)

Přechodný soubor. Vzniká v `/pause`, mizí v `/resume`. **Nikdy se necommituje samostatně** — je v `.gitignore`. Pokud se objeví v gitu, je to leak.

Použij `.ai/templates/HANDOFF.md` jako základ. Klíčové sekce:

- Active feature
- Last task (s status)
- Next step (konkrétní příkaz / soubor / řádek)
- Open questions / blockers
- Files touched (uncommitted)
- Recent thinking (1–2 odstavce — trail of thought)

## Anti-patterns

- ❌ Ruční editace History bez phase change.
- ❌ Smazání History řádků kvůli "úklidu" — to je institucionální amnézie.
- ❌ STATE.md committovaný se status `in-progress` na main branch — buď je práce hotová (`done`), nebo je v PR.
- ❌ HANDOFF.md committovaný — je gitignored z důvodu.
- ❌ Více aktivních plánů současně bez explicitního důvodu — když chceš streetovat dvě věci paralelně, použij branche, ne jeden state.

## Integration

| Command | Co dělá s STATE.md |
|---------|---------------------|
| `/plan` | Phase → `planning`, Active plan → `<path>`, history row |
| `/execute` | Phase → `execution`, Active task per task, history row per completed task |
| `/done` | Phase + Status → `done`, plan archived, final history row |
| `/pause` | Status → `paused`, Active task zachován, vytvoří HANDOFF.md |
| `/resume` | Status → `in-progress`, smaže HANDOFF.md, history row |
| `/status` | Read-only — vrátí summary |
| `/ddr` | Append do `## Decisions` (jen sumář, full DDR v `.ai/decisions/`) |
