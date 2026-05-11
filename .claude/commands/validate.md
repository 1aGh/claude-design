---
name: validate
type: command
description: "Plný validation pipeline — static + tests + build + cross-platform scenario (5 platforem) + a11y + design konzistence"
keywords: [validate, full, pipeline, scenario, cross-platform, a11y, design-system]
---

# /validate — full pipeline

**Tohle je hlavní validation gate.** Spouští se před `/done`, před push, nebo při review staršího kódu. Cross-platform scenario je páteř — Dugmate je mobile/tablet/web a parita je core feature.

## Postup

Spusť v tomto pořadí. **Stop on first hard fail**, akumuluj soft warnings.

### 1. Statická analýza
- Type-check (celý projekt)
- Lint (celý projekt)
- Format check (Prettier / Biome / gofmt)

### 2. Tests
- Unit + integration: celá suita
- Coverage report (jen reportuj, neblokuj na threshold)

### 3. Build
- Production build pro každý app/package z `.ai/context/codebase-map.md`
- Bundle size delta pokud je tooling (`size-limit`, `bundlewatch`)

### 4. Cross-platform scenario (Dugmate validation backbone)

**Spawn `scenario-runner` subagent** (`.claude/agents/scenario-runner.md`).

- Subagent zjistí, která scenarios jsou relevantní pro diff (čte `.ai/scenarios/` + active plan).
- Pokud feature dotýká UI a **žádné scenario neexistuje** → **HARD FAIL**: blokovat dokud není scenario napsané (`/scenario new <name>`).
- Subagent rozhodne scope (web-only / native-only / all 5 platforem) podle dotčených souborů.
- Spustí scenarios paralelně podle protokolu v `.claude/skills/scenario/SKILL.md`.
- Vrátí JSON s: `report_path`, `platforms_run`, `results`, `blockers`, `parity_ok`, `follow_ups`.

**Gate:**
- `blockers > 0` → `/validate` selhává. Opravit, retry.
- `parity_ok == false` → cross-platform divergence. Vyžaduje DDR (proč je divergence záměrná) **nebo** opravu pro paritu.
- `SKIPPED` platform jen kvůli unbooted sim → warning, ne fail. Ale pokud uživatel měl spustit ios-phone a sim nebyl booted, je to soft fail (měl boot zařídit).

### 5. A11y (pro UI projekty)

**Spawn `a11y-auditor` subagent.** Subagent může používat agent-browser pro live axe-core run nad dotčenými routes (ne jen statickou analýzu). Reportuje WCAG 2.1 AA blockers + warnings podle pravidel v `.claude/skills/dugmate-a11y-rules/SKILL.md`.

### 6. Design konzistence (pro UI projekty)

**Spawn `design-system-guard` subagent.** Subagent porovná dotčené UI proti `.ai/dugmate-design-system.md`:
- Žádný gradient, glass morphism, neumorfismus
- Lucide line ikony (single stroke width)
- Inter pro UI / monospace pro čísla / timecody / IDs / CLI
- Team color jako jediný customizable token
- Žádné pastelové ani youthful barvy
- Dark-first; light mode jako sekundární
- 44×44 mobile tap targets
- prefers-reduced-motion fallback povinný

Subagent **musí používat screenshoty z scenario reportu** jako primární evidence (ne jen grep static analysis), protože scenario poskytuje rendered cross-platform proof.

### 7. Doc / decision drift

- Active plán bez `## Retro` sekce po `/done`? Flagni.
- DDR-worthy rozhodnutí v diff (nová knihovna, nový top-level dir, schema změna) bez DDR? Navrhni `/ddr`.
- Scenario report bez identical counter-delta napříč platformami bez DDR vysvětlujícího proč → blocker.

### 8. Hlášení

```
## /validate — <YYYY-MM-DD HH:MM>
✓ types | ✓ lint | ✓ format
✓ tests: 142/142 (coverage: 78%)
✓ build: 3 apps OK (bundle delta: +2.1 KB on web)
✓ scenario: dugmate-tag-clip 5/5 PASS
   → report: .ai/device/scenario-runs/dugmate-tag-clip/2026-05-04-1830/report.md
   → parity: ✓ identical counter-delta across all 5 platforms
✓ a11y: 0 blockers, 2 warnings (file:line)
✓ design system: 0 violations
✓ DDR drift: 0 (all decisions recorded)
```

Pokud všechno zelené → bezpečně pokračuj na `/done`.

## Co /validate NEDĚLÁ

- Commit / push / PR — to je `/done`.
- Bug fix — pokud něco selže, ven do `/execute` opravit, pak retry `/validate`.
