---
name: verify
type: command
description: "Lehká verifikace dotčených souborů během /execute — type/lint/dotčené testy + agent-browser/agent-device smoke pro UI změny"
keywords: [verify, check, smoke, edit-verify, agent-browser, agent-device]
---

# /verify — fokusovaná kontrola

Použij během `/execute` po každém tasku (Edit-Verify Loop). Pro plný cross-platform sweep před mergem použij `/validate`.

## Postup

1. **Zjisti scope:**
   ```bash
   git diff --name-only             # uncommitted
   git diff --name-only main...HEAD # vůči main
   ```
   Klasifikuj soubory:
   - `.ts/.tsx/.js/.jsx` zdrojové → static checks + browser smoke (pokud UI)
   - `.test.*` → spustit dotčené testy
   - `.css/styles` → static check + visual smoke (agent-browser screenshot)
   - RN soubory (`apps/mobile/`, `apps/native/` apod.) → agent-device smoke
   - Pure backend / config → jen static checks

2. **Static checks (vždy):**
   - Type-check (jen dotčené projekty pokud monorepo)
   - Lint na dotčené soubory
   - Dotčené unit/integration testy

3. **Web UI smoke (pokud diff obsahuje web zdrojáky):**
   ```bash
   # Quick smoke — agent-browser, web-desktop only, < 30s
   agent-browser open http://localhost:4000/<route-relevantní-pro-task>
   agent-browser snapshot -c             # compact snapshot, context-cheap
   agent-browser screenshot .ai/device/verify/$(date +%s)-<task>.png
   ```
   - Smoke ověří: stránka loadne bez crash, klíčové elementy z plánu jsou v snapshot
   - **Není** plné scenario — pro to je `/validate`. Tady catch obvious 500s, missing imports, runtime crashes.

4. **Native smoke (pokud diff obsahuje RN zdrojáky):**
   ```bash
   IPHONE_UDID=$(xcrun simctl list devices booted -j | python3 -c "import json,sys;d=json.load(sys.stdin)['devices'];print(next((dev['udid'] for k,v in d.items() if 'iOS' in k for dev in v if 'iPhone' in dev['name']), ''))")
   agent-device --platform ios open com.dugmate.<bundle> --udid $IPHONE_UDID
   agent-device snapshot -i              # accessibility snapshot
   agent-device screenshot .ai/device/verify/$(date +%s)-ios.png
   ```
   - Smoke = app starts, navigace na dotčený screen funguje, žádný red-screen / crash dialog

5. **Subagenty (volitelné, pro UI tasky doporučené):**
   - `a11y-auditor` — rychlý a11y check dotčených UI souborů
   - `design-system-guard` — soulad s `.ai/dugmate-design-system.md`

6. **Hlášení:**
   ```
   ✓ types: pass
   ✓ lint: pass (3 files)
   ✓ tests: 12/12 pass
   ✓ web-desktop smoke: page loads, key elements present
   ⚠ a11y: 1 warning — Button on screen X chybí accessible name
   ```

7. Pokud něco selže, navrhni fix nebo se vrať do edit-verify smyčky `/execute` (max 3 iterace per task).

## Co /verify NEDĚLÁ

- Cross-platform parity check — to je `/validate` job (spawn `scenario-runner` subagent přes 5 platform).
- Full test suite (jen dotčené testy).
- Build celého projektu — jen tam, kde se přímo dotklo.
- Bundle size / performance regression — to je `/validate`.

## Idiom

`/verify` je **vnitřní smyčka** během práce. Spouštěj často, klidně po každé úpravě. **Levné.** Cca 15–60 s podle scope.

`/validate` je **vnější brána** před mergem. Spouštěj jednou před `/done`. **Drahé** (cross-platform scenario, full pipeline). Cca 5–15 min podle počtu platform.
