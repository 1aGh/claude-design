---
name: scenario
type: command
description: "Spusť cross-platform UI scenario (5 platforem: web-desktop, web-mobile, ios-phone, ios-tablet, android-phone) — screenshot proof + markdown report"
keywords: [scenario, validate, e2e, smoke, cross-platform, agent-browser, agent-device]
argument-hint: "<scenario-name> | new <scenario-name>"
---

# /scenario — cross-platform UI flow runner

**Tohle je Dugmate validation backbone.** Pro každou UI featuru musí existovat alespoň jedno scenario, které ji ověří přes 5 platform. Web-only nebo native-only featury používají subset.

Wrapper kolem `agent-browser` + `agent-device` skills. Plný protokol viz `.claude/skills/scenario/SKILL.md`.

## Vstup

`$ARGUMENTS`:
- `<scenario-name>` — spusť existující scenario z `.ai/scenarios/<name>/`
- `new <scenario-name>` — založ nové scenario (interaktivně pilotuj přes agent-browser/agent-device, ulož runners)
- (prázdné) — vypiš všechny scenarios z `.ai/scenarios/` + jejich poslední run status

## Postup — existující scenario

1. **Pre-flight:**
   - `agent-browser --version` + `agent-device --version` — verify install
   - `xcrun simctl list devices booted` — zjisti UDID iPhone + iPad simu (pokud existují)
   - `adb devices` — zjisti Android serial (pokud existuje)
   - Platforms bez booted simu/AVD se **skipnou** s `result.txt` reason, ne fail celého runu

2. **Spusť** podle protokolu ve `scenario` skill — paralelně web (sequential between web variants) + native (parallel mezi sebou).

3. **Vygeneruj report** v `.ai/device/scenario-runs/<name>/<YYYY-MM-DD-HHMM>/report.md` se sekcemi:
   - TL;DR table (per platform: PASS/FAIL/SKIPPED)
   - Counter-delta verification (cross-platform parity signal)
   - Per-step pivot table (rows = platforms, columns = step thumbnails)
   - What surprised us
   - Recommended follow-ups (testIDs k přidání, atd.)

4. **Návrh kroku:** _"Scenario `<name>` proběhl: <X>/<Y> platform pass. Report: `<path>`. Zveřejnit do PR?"_

## Postup — `new <scenario-name>`

1. Vytvoř `.ai/scenarios/<name>/` adresář s `runners/` a `README.md`.
2. **README.md** — uživatel popíše:
   - **User flow** — kroky 1..N (např. "Otevři Video tab → klikni první tape → tagni 12s → save klip")
   - **Persona** z `.ai/dugmate-prd.md` §2 (kdo to dělá: Coach / Player / Scout / Manager)
   - **PRD reference** — který screen brief z §5 to pokrývá
   - **Fixtures** — seedová data nutná pro scenario (test team, test video URL, atd.)
   - **Expected end state** — co musí být pravda po posledním kroku (counter delta, navigation state)
3. **Pilotuj interaktivně** přes agent-browser (web) a agent-device (native) podle skill. `agent-device --save-script` zaznamená native flow automaticky.
4. **Ulož runners** — jeden bash script per platform v `.ai/scenarios/<name>/runners/`.
5. **Smoke test** — spusť čerstvě napsané scenario. Pokud projde 5/5, commitni runners.

## Acceptance criteria pro scenario

Scenario je **production-ready**, když:

- [ ] Runners jsou idempotentní (lze spustit znovu bez čištění state)
- [ ] Selectors používají testIDs nebo semantic locators (ne fragile DOM class chains)
- [ ] Counter-delta sekce v reportu má identical hodnoty napříč platformami (parity)
- [ ] Pokud chybí testIDs → vyřešená follow-ups sekce v reportu obsahuje konkrétní tickets

## Známé scenarios

`.ai/scenarios/` — čti soubory přímo. `/scenario` (bez argumentů) vypíše seznam.

## Integrace

- **`/plan`** — Acceptance Criteria UI tasku musí jmenovat alespoň jedno scenario.
- **`/execute`** — během Edit-Verify smyčky (max 3 iterace) spustí agent-browser smoke pro web po každém edit, ale plné scenario až v `/verify`.
- **`/verify`** — pokud feature má UI dotek, spustí relevantní scenario (web-desktop + web-mobile minimum, native jen pokud feature dotýká RN kód).
- **`/validate`** — vždy plné scenario napříč všemi 5 platformami.
- **`/done`** — vyžaduje passed scenario report jako gate. Report URL se vepíše do PR description.
