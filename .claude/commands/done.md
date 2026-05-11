---
description: Uzavři featuru — /validate gate (incl. cross-platform scenario) → DDR sweep → commit → push → PR → retro → archivace
argument-hint: "<volitelně: cesta k plánu>"
---

# /done — uzavři featuru

Tohle je **finální brána**. Spouští se po `/execute`, když všechny tasky padly. Sjednocuje verification, commit a push do jediné akce.

Vstup: `$ARGUMENTS` — volitelně cesta k plan souboru. Pokud chybí, použij ten z `.ai/state/STATE.md`.

## Postup

### 1. Spusť `/validate` (hard gate)

`/validate` provede statickou analýzu, testy, build, **cross-platform scenario** (`scenario-runner` subagent přes 5 platforem), a11y audit, design konzistenci, decision drift check.

Pokud cokoli z `/validate` selže → zastav. Vrať se do `/execute` opravit. Po fixu znovu `/done`.

**Klíčový gate:** scenario report musí mít `blockers == 0` AND `parity_ok == true` (nebo jasné DDR vysvětlující záměrnou divergenci).

### 2. Acceptance criteria check

Projdi `## Acceptance Criteria` v plánu, každé kritérium odškrtni nebo flagni. Klíčově:

- [ ] Všechny tasky completed
- [ ] `/validate` projde (incl. scenario, a11y, design system)
- [ ] Žádné DDR-worthy rozhodnutí nezůstalo nezapsané
- [ ] Scenario report linkovaný v PR description

Pokud kritérium nelze splnit, **nepřeskakuj** — zapiš blocker do STATE.md a /pause.

### 3. Zaznamenej rozhodnutí (DDR sweep)

Projdi `## Decisions to record` v plánu. Pro každý nezapsaný bod spusť `/ddr` (nebo to udělej inline). **Žádné rozhodnutí se neztratí.** `ddr-keeper` skill poskytuje quality gate.

### 4. Code review (`/code-review`)

Spusť `/code-review` na uncommitted changes. Tahle verze sequence-uje:

1. Audit pass — najde correctness / quality / security / convention findings.
2. `code-simplifier` subagent pass — auto-fixne stylistické issues (clarity, nesting, naming).
3. Recheck — re-run static checks + týkané testy. Pokud simplifier něco rozbil, revert.

**Hard gate:**

- Verdict `NEEDS FIXES` (CRITICAL findings) → zastav. Vrať se do `/execute` opravit. `/done` znovu po fixu.
- Verdict `PASS` nebo `PASS WITH SUGGESTIONS` → pokračuj na commit.

Review report v `.ai/logs/code-reviews/<branch-name>.md` se commit-uje s feature changes (linkovaný v PR description).

### 5. Commit

Conventional commit. Format:

```
<type>(<scope>): <imperativní shrnutí>

<tělo: co a proč, ne jak>

Refs: .ai/plans/<x>.plan.md
DDRs: .ai/decisions/DDR-<NNN>.md (pokud byly vytvořeny)
Scenario: .ai/device/scenario-runs/<name>/<ts>/report.md
```

- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.
- **Stage konkrétní soubory**, ne `git add -A` (tajemství / mimo-scope změny).
- **NIKDY** `--no-verify` ani `--amend`, pokud to user neřekl.

### 6. Push & PR (volitelně — zeptej se)

_"Zveřejnit branch a otevřít PR?"_ — pokud ano:

- `git push -u origin <branch>`
- `gh pr create` s tělem:

```markdown
## Summary
<2–3 bullety co se změnilo>

## Cross-platform validation
- Scenario: `<name>`
- Result: <X>/<Y> platforms PASS
- Report: [.ai/device/scenario-runs/<name>/<ts>/report.md](<repo URL>)
- Parity: ✓ identical counter-delta

## Linked
- Plan: .ai/plans/<x>.plan.md
- PRD: <§ parent nebo cesta>
- DDRs: <seznam>

## Test plan
- [ ] Spustit `/scenario <name>` lokálně proti checked-out branchi
- [ ] Spot-check screenshots in scenario report
- [ ] <případné manual edge cases>
```

### 7. Retro & archivace

- Append `## Retro` odstavec na konec plánu. 3–5 bulletů: co fungovalo / co ne / co změnit v `/plan` nebo `/execute` příště. Tohle je learning loop — příští `/plan` to čte.
- Pokud byly nečekané pivoty, parity gaps, blockery nebo přepsání plánu → zvaž samostatný DDR ("co jsme se naučili o této doméně") nebo full `/retro`.
- Přesuň plán do `.ai/plans/archive/<x>.plan.md`.
- STATE.md → phase + status `done`, history row `done | <date> | <one-liner>`. Active task → `—`. Active plan → `—`.

### 8. Hlášení

```
✓ Done: <feature name>
  Validate: ✓ all gates passed
  Scenario: 5/5 platforms PASS — <report path>
  Code review: ✓ <verdict> — .ai/logs/code-reviews/<branch>.md
  Simplifier: <files touched / skipped> 
  Commit: <hash> <subject>
  PR: <URL nebo "—">
  DDRs recorded: <N>
  Plan archived: .ai/plans/archive/<x>.plan.md
  Time in execution: <approx>
```

Návrh: _"Spustit /status pro přehled stavu projektu, nebo /retro pro process retrospective?"_
