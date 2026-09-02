# Feature: Fast inner loop — defer quality gates to /flow:validate

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Implementační příkazy (`/flow:execute`, `/flow:bug-fix`, `/flow:quick` + jejich sdílený inner-loop `/flow:utils-verify`) dnes pouštějí quality gates **během** implementace. V malých repech to nebolí; v monorepu to je katastrofa — evidence z `AI-StudyMate/.ai/logs/execution-reports/wiki-adoption-telemetry.md` (2026-09-01):

- `quality.typecheck` = `pnpm check-types` → turbo fan-out na **37 projektů**, 16m15s, force-killed bez verdiktu — čistá ztráta.
- „Affected tests" idiom `pnpm --filter X test -- <pattern>` filtr **tiše zahodil** — 7× celá suite (74 souborů, ~55 s) místo 1 souboru (1,2 s). ~50× waste na nejčastěji opakovaném příkazu.
- Gates běžely uprostřed implementace, uživatel je ručně killnul („nepouštěj žádný type check ani lint dokud to nedodělas"), a pak běžely znovu při `/flow:done`.
- `/flow:bug-fix` krok 5 pouští **plný** `lint + typecheck + test + build` foreground, ještě před commitem.

Celkem ~25–30 min wall-clock na checky, které nemohly nic říct. Root cause je **config/skill mismatch**: `flow:utils-verify` slibuje „15–60 s, cheap" a pak ukazuje na `quality.*` příkazy, které jsou z podstaty repo-wide. Config nemá žádný scoping mechanismus, tak agent spadne na repo-wide příkazy.

**Cílový kontrakt (direktiva uživatele):** implementace běží co nejrychleji, aby si ji uživatel mohl co nejdřív vyzkoušet; plné gates patří do `/flow:validate` / `/flow:done`, jednou, na konci.

## User Story

As a flow user I want the implementation loop to run only cheap, correctly-scoped checks so that I can try the change immediately, with full gates paid exactly once at validate/done.

## Problem

1. `utils-verify` krok 2 pouští `quality.{format,lint}` repo-wide — v monorepu minuty až desítky minut, v rozporu s vlastním „cheap, 15–60s" kontraktem.
2. `execute` per-task Edit-Verify Loop volá `utils-verify` **2× na task** (po implementaci + po simplifier passu) a simplifier pass sám je duplicitní s `/flow:done` krokem 4 (`code-simplifier` tam běží znovu na celém diffu).
3. `bug-fix` krok 5 je plná validate pipeline inline (lint/typecheck/test/build) — nejhorší offender.
4. „Affected tests" nemá žádný guard proti tiše zahozenému filtru (`vitest run` za holým `--`).
5. Config nemá kam deklarovat scoped varianty gates. Pozor: `quality` je **flat free-form mapa** a `/flow:validate` krok 3.5 pouští **každý nekonvenční klíč jako blocker custom gate** — takže `quality.lintScoped` by se při validate spustil podruhé jako samostatný gate. Scoped varianty MUSÍ žít mimo `quality`.
6. `execute` pre-flight/checkpointy/retro předpokládají plan file; ticket-only práce (bez `/flow:plan`) nechává tyto kroky tiše neaplikovatelné (report, doporučení 6).

## Solution

Nový top-level config blok **`qualityScoped`** (flat mapa `gate → shell command`, zrcadlí jména z `quality`, určená POUZE pro inner loop) + přepsaná postura implementačních příkazů:

- **Inner loop (`utils-verify`, per-task v `execute`, `bug-fix`, `quick`)**: affected tests (s guardem na zahozený filtr) + `qualityScoped.*` gates pokud jsou deklarované. **Nikdy** nepouští repo-wide `quality.lint/typecheck/tests/build`. Chybějící scoped gate = skip s one-line poznámkou „deferred to /flow:validate" — ne fallback na repo-wide příkaz.
- **Outer gate (`validate`, `done`)**: beze změny — plná `quality.*` pipeline běží tam, jednou. `qualityScoped` blok validate ignoruje.
- **`execute`**: simplifier pass vypadne z per-task smyčky (zůstává v `/flow:done` kroku 4, kde už dnes je) → 1 verify na task místo 2. Plus čistý degrade na ticket-only mód.
- **Monorepo trap dokumentován**: changed-only filter (`[origin/main]`), NE dependents-inclusive (`...[origin/main]`) — u shared package vybere dependents-inclusive celé monorepo; dependent breakage je job `/flow:validate`.

## Metadata

- **Type**: Enhancement
- **Complexity**: Medium
- **App/Package**: `plugins/flow` (commands + skills + config schema), root `.ai/workflows.config.json` (dogfood)
- **Affected Systems**: `/flow:utils-verify`, `/flow:execute`, `/flow:bug-fix`, `/flow:quick`, `flow:quality-gates` skill, `config.schema.json`, `/flow:validate` (jen poznámka), `maude doctor` (follow-up only)
- **Dependencies**: žádné nové

---

## Context References

### Must-Read Files

> Při `/flow:execute` načti všechny paralelně v jedné zprávě.

- `plugins/flow/commands/utils-verify.md` — celé; krok 2 je jádro změny, krok 7 + „Idiom" sekce definují kontrakt inner loop
- `plugins/flow/commands/execute.md` (řádky 73–131) — Edit-Verify Loop + simplifier pass (2c/2d); (24–35) pre-flight na plan file
- `plugins/flow/commands/bug-fix.md` (řádky 86–95) — krok 5 „Validate" s plnou pipeline
- `plugins/flow/commands/quick.md` (řádky 83–102) — staged-only gates (už OK, jen sladit wording)
- `plugins/flow/skills/quality-gates/SKILL.md` — celé; tabulka §5 „Which command reads which gate" se mění
- `plugins/flow/commands/validate.md` (řádky 133–144) — krok 3.5 custom-gate loop (důvod, proč scoped klíče nesmí do `quality`)
- `plugins/flow/.claude-plugin/config.schema.json` (řádky ~454–462) — `quality` blok jako vzor pro `qualityScoped`
- `/Users/iagh/git/studyfi/AI-StudyMate/.ai/logs/execution-reports/wiki-adoption-telemetry.md` — evidence + doporučení 1–7 (zdroj této feature; jiné repo, jen číst)

### Files to Create

- žádné nové soubory (vše jsou edity existujících)

### Patterns to Follow

- Config read pattern z `flow:quality-gates` §3 (`jq -r '.quality.X // empty'` + `eval` + warn-skip) — `qualityScoped` čte identicky.
- `<project>` placeholder konvence: žádné Maude-specifika ve flow markdownu; turbo/vitest příklady označit jako *příklady pro monorepa*, ne jako předpoklad.
- Missing gate → **warn + skip, never fabricate** (quality-gates §4) — platí i pro scoped: nikdy neodvozovat filter příkaz za uživatele bez deklarace… s výjimkou file-args formy níže, která je generická.

---

## Design Decisions

1. **`qualityScoped` jako separátní top-level blok, ne klíče uvnitř `quality`.** Důvod: `/flow:validate` krok 3.5 pouští každý nekonvenční `quality.*` klíč jako blocker — `lintScoped` uvnitř `quality` by běžel dvakrát (inner loop + validate). Separátní blok = zero změn ve validate.
2. **Chybějící scoped gate = defer, ne fallback na repo-wide.** Direktiva uživatele je jednoznačná: implementace nesmí čekat na repo-wide check. Jediná povolená náhrada: pokud `quality.format`/`quality.lint` příkaz akceptuje file args, smí utils-verify spustit `<cmd> -- <changed files>` (stejný trik, jaký už dnes dělá `quick` na staged files). `typecheck` scoped náhradu nemá — buď deklarovaný `qualityScoped.typecheck`, nebo defer.
3. **Simplifier ven z per-task smyčky.** Běží už v `/flow:done` kroku 4 na celém diffu s race-guardem — per-task pass je duplicitní a zdvojnásobuje verify runy. DDR-worthy (mění execute kontrakt) → zaznamenat při `/flow:done`.
4. **Filter-sanity guard u affected tests.** Po scoped test runu porovnat počet spuštěných test souborů s očekáváním: pokud run reportuje ~celou suite přesto, že byl předán pattern, filtr byl zahozen — přepnout na exec formu runneru (`pnpm --filter X exec vitest run <pattern>`) a příště používat ji. Generické pravidlo, ne vitest-specifické hardcode.
5. **Changed-only, ne dependents-inclusive.** Do quality-gates skillu zapsat monorepo trap: `--filter='...[base]'` vybere u shared package celé monorepo → inner loop používá changed-only (`[base]`); dependent breakage chytá `/flow:validate`.
6. **`maude doctor --fix` detekce `qualityScoped` je follow-up, ne součást této feature** — doctor dnes detekuje z package.json scriptů; scoped varianty jsou per-monorepo úsudek. Schema validaci dostane zadarmo (Ajv), autofill ne.

---

## Tasks

### Task 1: UPDATE `plugins/flow/.claude-plugin/config.schema.json` — přidat `qualityScoped`

- **Do**: Vedle `quality` přidat top-level `qualityScoped` se stejným shape (`additionalProperties: {type: string, minLength: 1}`). Description: scoped (changed-files/changed-packages-only) varianty gates pro inner loop (`/flow:utils-verify`, per-task `/flow:execute`, `/flow:bug-fix`); běží MÍSTO repo-wide `quality.*` během implementace; `/flow:validate` tento blok ignoruje; klíče zrcadlí `quality` (konvenčně `lint`, `format`, `typecheck`, `tests`); chybějící klíč → inner loop defer-uje na validate. Zmínit monorepo příklad `turbo run lint --filter='[origin/main]'` v description.
- **Pattern**: stávající `quality` blok (řádek ~454).
- **Gotcha**: schema je 2020-12, drž stejný styl descriptions.
- **Validate**: `node -e "JSON.parse(require('fs').readFileSync('plugins/flow/.claude-plugin/config.schema.json','utf8'))"`.

### Task 2: UPDATE `plugins/flow/skills/quality-gates/SKILL.md` — postura + `qualityScoped` + trap

- **Do**:
  - Nová sekce **Inner loop vs outer gate**: implementační příkazy nikdy nepouští repo-wide gate foreground; plná pipeline patří validate/done, jednou. Repo-wide gate spuštěný a killnutý uprostřed = čistá ztráta (evidence: 16m15s check-types, wiki-adoption-telemetry report).
  - Dokumentovat `qualityScoped` (shape, read pattern identický s §3, defer-not-fallback pravidlo, file-args náhrada pro format/lint).
  - Dokumentovat **monorepo fan-out trap**: changed-only `[base]` vs dependents-inclusive `...[base]` (37/37 při dotyku shared package); dependents jsou job validate.
  - Aktualizovat tabulku §5: `utils-verify` → `qualityScoped.{format,lint,typecheck}` (declared-only) + affected tests; `quick` → staged-only file-args forma (beze změny chování); `execute` per-task → přes utils-verify; `bug-fix` → přes utils-verify; `validate`/`done`/release beze změny.
  - Přidat **filter-sanity pravidlo** pro affected tests (Design Decision 4) — sem, protože je sdílí utils-verify i bug-fix.
- **Pattern**: stávající struktura skillu (číslované sekce, tabulka).
- **Gotcha**: skill je „data-shape reference, NOT a runner" — postura je opinion volajících příkazů, ale trap + shape sem patří; formulovat jako kontrakt, který volající příkazy citují.
- **Validate**: ruční re-read; konzistence tabulky s Task 3–6 edity.

### Task 3: UPDATE `plugins/flow/commands/utils-verify.md` — scoped-only inner loop

- **Do**: Přepsat krok 2:
  1. Pro každý gate `format`, `lint`, `typecheck`: číst `qualityScoped.<gate>` → pokud deklarován, spustit (blocker při failu).
  2. Pokud nedeklarován a gate je `format`/`lint`: zkusit file-args formu `quality.<gate>` na changed files (stejně jako `quick` na staged); pokud příkaz file args nepodporuje nebo `quality.<gate>` chybí → **skip s one-line deferred poznámkou** (`→ <gate>: no scoped gate declared — deferred to /flow:validate`).
  3. `typecheck` bez `qualityScoped.typecheck` → vždy defer (žádná generická file-args forma pro tsc project mode).
  4. **Nikdy** nespouštět holé `quality.lint`/`quality.typecheck`/`quality.tests`/`quality.build`.
  - Affected tests: doplnit filter-sanity guard (odkázat na quality-gates skill) + explicitní příklad zahozeného filtru (`test -- <pattern>` vs `exec <runner> run <pattern>`).
  - Report v kroku 5: řádky pro deferred gates, aby nebylo tiché, co se nekontrolovalo.
  - Sekci „Idiom" doplnit: cheap kontrakt je nyní vynucen konstrukčně (scoped-only), ne slibem.
- **Pattern**: stávající `jq // empty` + `eval` bloky.
- **Gotcha**: `<project>`-agnostic — turbo/vitest jen jako označené příklady. Krok 6 (doctor nudge) nechat.
- **Validate**: `node cli/lib/plugin-cli-reachability.test.mjs` beze změny chování (žádné nové bin cesty); ruční konzistence s Task 2.

### Task 4: UPDATE `plugins/flow/commands/execute.md` — 1 verify na task, simplifier ven, ticket-only mód

- **Do**:
  - Krok 2c: verify přes updated `/flow:utils-verify` (zdědí scoped posturu). Doplnit větu, že plné gates běží až ve `/flow:validate` — smyčka nesmí spouštět repo-wide checky.
  - Krok 2d (simplifier): ODSTRANIT z per-task smyčky. Nahradit poznámkou: stylistický polish vlastní `/flow:done` krok 4 (`code-simplifier` na celém diffu, s race-guardem). Odstranit i druhý utils-verify run a pravidla pro revert simplifier diffu (přesouvá se to do done, kde už recheck existuje).
  - Krok 4 „Final Validation" — beze změny (už dnes říká „suggest, don't run"), jen sladit formulaci s novou posturou.
  - Nová podsekce **Ticket-only mode** v Pre-Flight: pokud `$ARGUMENTS` není plan file (neexistující cesta / ticket ID / prázdné), degradovat čistě: kontext z ticketu (tracker MCP / gh) nebo z konverzace, checkpointy do STATE.md (či kg, když aktivní) pod slug odvozený z ticketu, plan-checkbox kroky se přeskočí s one-line poznámkou. Žádný crash na `Read` neexistujícího plánu.
- **Pattern**: stávající struktura kroků; tracker-context blok z `bug-fix.md` pro ticket resolution.
- **Gotcha**: Nezasahovat do kroku 3.5 (design smoke gate — DDR-021, jiná osa, zůstává). Checkpoint konvence (kg-aware) zachovat.
- **Validate**: ruční re-read; grep, že `code-simplifier` v execute.md už nefiguruje jako per-task krok.

### Task 5: UPDATE `plugins/flow/commands/bug-fix.md` — krok 5 z plné pipeline na inner-loop verify

- **Do**: Nahradit blok `<pm> lint / typecheck / test / build` invokací `/flow:utils-verify` (scoped postura) + testy z RCA „Testing Requirements" spuštěné scoped (s filter-sanity guardem). Doplnit větu: plná pipeline běží při `/flow:validate` (nebo `/flow:done`), před merge — Post-Fix Flow prompt rozšířit o „Run /flow:validate before PR?" volbu.
- **Pattern**: utils-verify reference z execute.md kroku 2c.
- **Gotcha**: commit/PR flow (kroky za validate) nechat beze změny.
- **Validate**: ruční re-read.

### Task 6: UPDATE `plugins/flow/commands/quick.md` — sladit wording (chování beze změny)

- **Do**: Krok 3 už je staged-only file-args — jen doplnit: pokud je deklarován `qualityScoped.<gate>`, preferovat ho před file-args heuristikou; a odkázat na quality-gates skill sekci Inner loop vs outer gate.
- **Validate**: ruční re-read.

### Task 7: UPDATE `plugins/flow/commands/validate.md` — jednořádková poznámka

- **Do**: Do kroku 3.5 (custom gates) přidat větu: `qualityScoped` je separátní top-level blok pro inner loop — validate ho ignoruje a nikdy nespouští.
- **Gotcha**: nic jiného ve validate neměnit.
- **Validate**: ruční re-read.

### Task 8: UPDATE `plugins/flow/skills/debugging-rules/SKILL.md` — „re-verify the verification"

- **Do**: Přidat pravidlo (report, doporučení 7): když verifikace tvrdí, že premisa designu je špatně, je to samo o sobě claim vyžadující evidenci — nejdřív ověř verifikační dotaz/skript, pak teprve překopávej design.
- **Validate**: ruční re-read.

### Task 9: UPDATE root `.ai/workflows.config.json` — dogfood `qualityScoped`

- **Do**: Přidat `qualityScoped` blok pro tento repo (např. `"tests": "cd apps/studio && bun test test/sync-*.test.ts"` už je scoped by nature — zvolit smysluplné scoped varianty pro `lint`/`typecheck`, např. biome/tsc na changed files; pokud pro některý gate scoped varianta nedává smysl, nedeklarovat — defer je legitimní).
- **Gotcha**: Po editu ověřit `maude doctor` (schema check přes lokální CLI: `node cli/bin/maude.mjs doctor`). Pozor na memory `maude-parallel-test-runs-contaminate` — žádné paralelní bun test laufy.
- **Validate**: `node cli/bin/maude.mjs doctor` → 0 schema errors.

### Task 10: Docs sweep + kg + roadmap

- **Do**:
  - `grep -rn "utils-verify\|quality gate" site/content/docs/` — pokud veřejné docs popisují inner-loop gates, aktualizovat.
  - `pnpm --filter @maude/site gen:roadmap` a přibalit `site/lib/roadmap.json` diff (pravidlo z CLAUDE.md — nový plán v `.ai/plans/`).
  - Při `/flow:done`: DDR na změnu kontraktu (scoped-only inner loop + simplifier přesun) přes `/flow:record-ddr`; What's New entry NE (změna není v UI feedu relevantní pro design-plugin uživatele — flow-only; pokud si to `/flow:done` vyžádá, krátký `improvement` entry je OK).
- **Validate**: `git status site/lib/roadmap.json` ukazuje regen v commitu.

---

## Validation

1. **Schema**: `node -e "JSON.parse(...)"` na config.schema.json + `node cli/bin/maude.mjs doctor` (0 schema errors po Task 9).
2. **Konzistence**: quality-gates tabulka §5 ↔ skutečné chování utils-verify/quick/execute/bug-fix/validate (ruční cross-check, žádný markdown test runner neexistuje — neinventovat).
3. **Reachability test**: `node cli/lib/plugin-cli-reachability.test.mjs` (žádné nové přímé bin invokace v markdownu).
4. **Namespace test**: `node cli/lib/plugin-name-namespace.test.mjs` (frontmatter beze změn, ale levný).
5. **Dogfood smoke**: v scratch projektu (`/tmp/scratch`) s marketplace pointnutým na working tree spustit `/flow:quick` a ověřit, že verify report ukazuje scoped/deferred řádky. (Volitelné — markdown změny jsou čitelné i bez runtime.)
6. **Žádný `bun test` v apps/studio bez `git status apps/studio/dist/` před/po** (CLAUDE.md rebuild pravidlo) — tato feature by se `dist/` neměla dotknout vůbec.

## Acceptance Criteria

- [ ] `qualityScoped` v schema; validate krok 3.5 ho prokazatelně nespouští (separátní blok)
- [ ] `utils-verify` nikdy nespouští repo-wide `quality.*`; chybějící scoped gate = viditelný defer, ne fallback
- [ ] `execute` per-task smyčka = 1 verify run, bez simplifier passu; simplifier zůstává v `/flow:done`
- [ ] `bug-fix` bez inline plné pipeline; plné gates nabídnuty přes `/flow:validate`
- [ ] Filter-sanity guard u affected tests zdokumentován (quality-gates) a citován (utils-verify, bug-fix)
- [ ] Monorepo fan-out trap (`[base]` vs `...[base]`) zdokumentován
- [ ] `execute` degraduje čistě na ticket-only mód
- [ ] Root config má `qualityScoped` a `maude doctor` je zelený
- [ ] roadmap.json regen v commitu; DDR zaznamenán při `/flow:done`
- [ ] Žádné Maude-specifikum natvrdo ve flow pluginu (turbo/vitest jen jako příklady)

---

## Retro

- **Evidence-first plan zaplatil sám sebe** — konkrétní čísla z wiki-adoption-telemetry reportu (16m15s, 50×) udělala design rozhodnutí (defer-not-fallback, `[base]` ne `...[base]`) nespornými; execution byl one-pass, 10/10 tasků na 1. iteraci.
- **Security pár našel reálný HIGH** — neescapovaná jména souborů v `eval "$CMD -- $CHANGED"` + ticket-only mód jako confused deputy (chain = remote ticket → hostile filename → RCE). Obojí opraveno před commitem; lekce: nový bash snippet v plugin markdownu = vstupy vždy quotovat NUL-safe, a každý nový untrusted-text→agent kanál potřebuje human gate hned v návrhu, ne až od auditora.
- **Separátní `qualityScoped` blok (ne klíče v `quality`)** byl klíčový catch už ve fázi plánu — validate krok 3.5 by scoped klíče spouštěl podruhé jako custom gates.
- **Dirty tree jiné session** (kg.mjs, dist/) zkomplikoval repo-wide lint verdikt — postup „ověř, že chyba je mimo můj diff, nemutuj cizí soubory" fungoval; selektivní staging je nutnost.
- **Follow-up:** `maude doctor` lint hodnot `quality*` na shell metaznaky/network volání (F4) + autofill `qualityScoped` v `doctor --fix`.
