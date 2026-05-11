---
name: ai-health
type: command
description: Diagnose health of the AI infrastructure in this project — commands, skills, agents, state, codebase map
keywords: [health, check, diagnose, verify, ai, system, status]
---

# AI Health: System Diagnostic

> Verify, že je `.claude/` + `.ai/` infrastruktura kompletní. Reportuje pass/warn/fail s remediation kroky.

## Process

Spusť každý check v pořadí. Sesbírej výsledky do summary tabulky.

### Check 1: Slash commands

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CMD_DIR="${REPO_ROOT}/.claude/commands"
```

- **Pass:** `$CMD_DIR` existuje a obsahuje ≥ 5 `.md` souborů (minimum: create-prd, plan, execute, done, context)
- **Fail:** Adresář chybí nebo je pod-naplněný

**Remediation:** Restoruj z `ai-loop/` backup nebo z gitu (`git checkout HEAD -- .claude/commands`).

### Check 2: Skills

```bash
SKILLS_DIR="${REPO_ROOT}/.claude/skills"
```

- **Pass:** Adresář existuje a obsahuje ≥ 1 podadresář s `SKILL.md`
- **Warn:** Adresář existuje, ale je prázdný
- **Fail:** Adresář chybí

**Remediation:** Skills jsou auto-loading expertise. Bez nich pojedou commands, ale bez doménového detailu.

### Check 3: Subagents

```bash
AGENTS_DIR="${REPO_ROOT}/.claude/agents"
```

- **Pass:** Adresář existuje s ≥ 1 `.md` souborem
- **Warn:** Adresář prázdný — subagenti pro a11y / design-system / test-coverage chybí

**Remediation:** Subagenti drží robustnost. Restoruj nebo vytvoř.

### Check 4: CLAUDE.md

```bash
CLAUDE_FILE="${REPO_ROOT}/CLAUDE.md"
```

- **Pass:** Soubor existuje a je neprázdný
- **Fail:** Soubor chybí

**Remediation:** `CLAUDE.md` je root-level guidance pro budoucí Claude session. Spusť `/init` pokud chybí.

### Check 5: PRD + Design System

- **Pass:** `.ai/dugmate-prd.md` + `.ai/dugmate-design-system.md` existují a jsou neprázdné
- **Fail:** Jeden nebo oba chybí

**Remediation:** Tyto dva dokumenty jsou source-of-truth pro produkt. Bez nich nelze plánovat.

### Check 6: Codebase Map (warm cache)

```bash
MAP_FILE="${REPO_ROOT}/.ai/context/codebase-map.md"
```

- **Pass:** Soubor existuje a byl updatovaný v posledních 7 dnech
- **Warn:** Soubor existuje, ale starší než 7 dní (potenciálně stale)
- **Fail:** Soubor chybí
- **N/A:** Repo zatím nemá kód (planning phase)

**Remediation:** `/map-codebase` snímek vygeneruje / refreshne.

### Check 7: Workflow State

```bash
STATE_FILE="${REPO_ROOT}/.ai/state/STATE.md"
```

- **Pass:** Soubor existuje (workflow state inicializovaný)
- **Warn:** Soubor chybí — commands poběží, ale `/pause` a `/resume` neuchovají kontext

**Remediation:** `cp .ai/templates/STATE.md .ai/state/STATE.md`

### Check 8: Decisions log

```bash
DDR_DIR="${REPO_ROOT}/.ai/decisions"
```

- **Pass:** Adresář existuje s `README.md` indexem
- **Warn:** Adresář chybí — DDR learning loop není aktivní

**Remediation:** `mkdir -p .ai/decisions` + zkopíruj README.md template.

## Output Report

### AI System Health

| # | Check | Status | Detail |
| - | ----- | ------ | ------ |
| 1 | Commands | ✅/❌ | {count} commands |
| 2 | Skills | ✅/⚠️/❌ | {count} skills |
| 3 | Subagents | ✅/⚠️ | {count} agents |
| 4 | CLAUDE.md | ✅/❌ | Present / Missing |
| 5 | PRD + Design System | ✅/❌ | Both present / Missing |
| 6 | Codebase Map | ✅/⚠️/❌/N/A | Fresh / Stale / Missing / Pre-code |
| 7 | Workflow State | ✅/⚠️ | Initialized / Not initialized |
| 8 | Decisions log | ✅/⚠️ | Active / Not started |

### Summary

- **Healthy:** Všechny checks projdou — AI infrastruktura je plně operační
- **Needs attention:** Warnings — funguje, ale není ideální
- **Needs repair:** Failures — postupuj podle remediation kroků
