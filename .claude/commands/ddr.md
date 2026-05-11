---
description: Zaznamenej Design Decision Record — architekturní/produktové rozhodnutí pro budoucnost
argument-hint: "<krátký titulek rozhodnutí>"
---

# /ddr — zapiš rozhodnutí

DDR (Design Decision Record) je formální zápis netriviálního rozhodnutí, které ovlivní budoucí vývoj. Příští instance Claude Code (i člověk) ho čte, aby pochopil **proč** je něco tak, jak to je.

> Použij DDR pro: výběr knihovny / framework, schéma datového modelu, tvar API, autorizační model, performance trade-off, rebuild vs. refactor, deprecation. **Nepoužívej** pro: zřejmá rozhodnutí, lokální refaktor, bug fix bez konceptuálního dopadu.

## Postup

1. **Najdi další číslo** — `ls .ai/decisions/DDR-*.md 2>/dev/null | tail -1` → +1, padding na 3 číslice (DDR-001, DDR-002…).

2. **Zeptej se v jednom batchi** (pokud user nedodal vše v `$ARGUMENTS`):
   - Co je problém / příležitost?
   - Jaké jsou alternativy, co jsi zvážil?
   - Které jsi vybral a proč?
   - Jaké to má důsledky (pozitivní i negativní)?
   - Existuje superseding podmínka (kdy tohle přehodnotit)?

3. **Zapiš** do `.ai/decisions/DDR-<NNN>-<kebab-titulek>.md`:

```markdown
# DDR-<NNN>: <Titulek>

**Status:** Accepted | Proposed | Superseded by DDR-<NNN>
**Date:** <YYYY-MM-DD>
**Tags:** <např. video, playbook, auth, infra, ux>

## Context
Co je problém? Jaké constraints existují? Co se nikam nehne, dokud nerozhodnem?

## Alternatives considered
- **Option A:** <stručně> — pro: …, proti: …
- **Option B:** <stručně> — pro: …, proti: …
- **Option C:** <stručně> — pro: …, proti: …

## Decision
Vybíráme **<option>**, protože:
- <důvod 1>
- <důvod 2>

## Consequences
**Pozitivní:**
- <co tím získáme>

**Negativní / trade-offs:**
- <co tím ztratíme nebo komplikujeme>

## Revisit when
<podmínka, za které tohle přehodnotit — např. "počet uživatelů > 10k", "až přijde v2 broadcast pillar">

## Linked
- Plan: <cesta nebo —>
- PRD: <§ nebo —>
- Supersedes: DDR-<NNN> nebo —
```

4. **Zapiš index** — append řádek do `.ai/decisions/README.md` (vytvoř, pokud chybí):
   ```
   - [DDR-<NNN>: <Titulek>](DDR-<NNN>-<slug>.md) — <YYYY-MM-DD>, <tags>
   ```

5. **Hlášení** — _"DDR-<NNN> zapsán. Linkni ho v active plan / commit message."_
