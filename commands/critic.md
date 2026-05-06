---
description: Spawn design-critic subagent — UX (7 vrstev) + Design System compliance pass na aktivním canvasu, inline review (žádné nested agenty)
---

# /design:critic — UX + DS critique active canvas

Spustí `design-critic` subagenta na aktivní canvas (`_active.json`). Subagent dělá **dvě paralelní review pass IN-LINE** (čte `ux-designer` a `design-system-guard` jako frameworks, bez recurse):

- **UX pass** — 7 vrstev: task → IA → states → interaction → microcopy → cross-platform → a11y
- **DS pass** — token compliance, hard-stops (no glass, no gradient, no pastel, no emoji, lucide stroke 1.5, IBM Plex headings, Inter body, JetBrains Mono nums, …)

Merged report do `.ai/design/_history/<slug>/critique/<NNN>-design-critic.md` (gitignored).

## Postup

Vyvolej skill `design` se vstupem: `critic`.

Skill:
1. Server lifecycle check.
2. Read `.ai/design/_active.json` → canvas path + slug.
3. Pokud nejnovější screenshot pro tenhle canvas chybí, capture full-page přes agent-browser (HTTP server URL).
4. **Spawn `design-critic` subagent** s parametry:
   - `subagent_type: "design-critic"`
   - `description: "Critique active canvas <slug>"`
   - `prompt:` strukturovaný — obsahuje:
     - `html_path` (canvas)
     - `screenshot_path` (latest)
     - `brief_path` (pokud session, jinak null)
     - `matched_component_path` (resolved z manifestu; jinak null)
     - `matched_chat_path` (pokud session, jinak null)
     - `output_path` (`.ai/design/_history/<slug>/critique/<NNN>-design-critic.md`)
     - `iter_n` (counter v history dir)
     - `slug`
5. Subagent zapíše merged report. Vrátí short TL;DR.
6. Skill ho přepošle uživateli + cestu k full reportu.

## Co očekávat v reportu

```markdown
# Design Critic — <slug> iteration NNN

## TL;DR
**Blockers: X** · Suggestions: Y · Parity OK: yes/no

## Blockers (must fix before /design:handoff)
1. **[UX · a11y]** <issue> — <line/element ref>
2. **[DS · tokens]** <issue> — <line/element ref>
…

## Suggestions
…

## Pass A — UX review (7 layers)
…

## Pass B — Design-system compliance
…

## Inputs
- HTML: <path>
- Screenshot: <path>
- ...
```

## Failure modes

- **`_active.json` chybí / null** → fail: "Otevři canvas v browseru first."
- **`ux-designer/SKILL.md` nečitelný** → critic dělá review z paměti frameworku, flagne degradaci v reportu.
- **`design-system-guard.md` AND tokens CSS nečitelný** → fail loud (bez authoritative tokens nelze posuzovat compliance).
- **Screenshot nelze zachytit** → critic běží jen na HTML source, flagne "Visual evidence: HTML source only".

## Doporučení po reportu

- `blockers > 0` → `/design "Address: <top blocker>"` (najprv ten kritický).
- `blockers == 0` → `/design:handoff [--target apps/web|apps/mobile]`.
