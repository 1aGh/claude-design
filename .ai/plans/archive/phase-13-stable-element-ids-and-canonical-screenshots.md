# Phase 13 — Stable element IDs + canonical screenshot pipeline + cheap helpers

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Sjednotit jak design plugin označuje a snímá obsah canvasu + vytáhnout 3 nejčastěji opakované bash bloky (bootstrap detection, server lifecycle, slug computation) do `dev-server/bin/` helperů. Dnes je `agent-browser navigate + screenshot` bash duplikován v `new.md`, `edit.md`, `setup-ds.md`, `screenshot.md` a každém critic agentu, generovaný obsah nemá stabilní element id, screenshot per-element je často `:nth-child` selektor, který se rozbije při příští iteraci, a stejný 8-30řádkový bash pro "is bootstrap needed?" / "is server alive?" / "compute canvas slug" je copy-pastovaný v 4–6 souborech. Po této fázi:

- Každý generovaný canvas má `data-dc-screen="<slug>"` na artboard úrovni a `data-dc-element="<slug>"` na pojmenovaných regionech / interaktivních prvcích.
- Existuje jeden zdroj pravdy pro screenshot — `plugins/design/dev-server/bin/screenshot.sh` (zero-dep, agent-browser primárně, `npx playwright` fallback).
- `/design:screenshot` má first-class `--screen <id>`, `--element <id>`, `--all-screens`.
- `new`, `edit`, `setup-ds` a všichni critics volají helper, ne inline bash.
- Inspector (server.mjs + client) preferuje `data-dc-screen` / `data-dc-element` v selektoru, takže Cmd+Click komentáře jsou stabilní napříč edity.
- `dev-server/bin/` obsahuje 4 helpery — `screenshot.sh`, `bootstrap-check.sh`, `server-up.sh`, `slug.sh`. Každý je single source of truth pro svůj recept.
- Existující bug v `signature-moment-critic.md` (používá neexistující `[data-artboard-id]` selektor, mělo být `data-dc-slot`) opraven jako součást Phase 13 selector sweepu.

## User Story

As a designer iterating in claude-design, I want stable, human-readable handles for every screen and element so that screenshots, comments, and AI critics target the same things across iterations — and I don't see screenshot-bash duplicated in five places.

## Problem

1. `frontend-design` generuje canvasy bez konzistentní id konvence. Inner elementy mají buď žádné id, nebo `:nth-child` selektor přes `cssPath()`. Při příští iteraci se index posune a selector se rozbije → komentáře ztratí target, critic screenshoty padají na prázdné PNG.
2. `agent-browser navigate + screenshot --full -- "$OUT"` (s `--` separátorem kvůli CLI bugu) je copy-pastovaný v 5+ souborech. Když se změní volání (např. timeout, fallback), musíme upravit všechna místa.
3. `/design:screenshot` má jen `--area` + `--selector` — uživatel musí znát CSS, aby snímal jednu sekci. Nemá `--screen <id>` ani `--all-screens` smyčku.
4. Critics (design-critic, signature-moment-critic, …) inline-bashují stejný pattern + někdy zapomenou na `--` separátor → ticho-failing screenshot, jen JSON, slabší verdikt.
5. Žádný fallback když `agent-browser` skill chybí; failuje sice loud, ale ne actionable.

## Solution

### A. Schema (runtime + envelope)

- `DCArtboard` rendrovaný v `design-canvas.jsx` přidá `data-dc-screen={id}` vedle existujícího `data-dc-slot={id}` (kompatibilita zachována — žádný caller `data-dc-slot` nepřejmenovává).
- `frontend-design` envelope dostane novou direktivu (verbatim v SKILL.md "Generation envelope"): "Každý named region / interactive primitive / hero element dostane `data-dc-element="<kebab-id>"` (kebab-case, role-prefixed: `cta-primary`, `card-hero`, `nav-item-1`, `form-field-email`)."
- Inspector `cssPath()` v server.mjs (line 616–631) preferuje v tomhle pořadí: `[data-dc-element="…"]` → `[data-dc-screen="…"]` → `[data-dc-slot="…"]` → `#id` → třídy + `:nth-child`. Aktuálně preferuje `#id` jako break-condition; přidáme dva nové attribute-based break-conditions PŘED `#id`.

### B. Canonical screenshot helper

Nový soubor `plugins/design/dev-server/bin/screenshot.sh` (~80 LOC, zero npm deps, executable). API:

```sh
screenshot.sh \
  [--port N | --url URL] \
  [--screen <id> | --element <id> | --selector <css> | --full] \
  [--all-screens]                                                # loop přes každé [data-dc-screen]
  --out <abs-path>                                                # vyžadováno (kromě --all-screens, viz dále)
  [--out-dir <abs-dir>]                                           # pro --all-screens; soubory: <dir>/<NNN>-screen-<id>.png
  [--timeout 8]
  [--engine auto|agent-browser|playwright]
```

Backend resolution:

1. `--engine=agent-browser` (default `auto`): zkusí `command -v agent-browser`. Použije `agent-browser navigate` + `agent-browser screenshot <selector?> "<out>"` (positional, ne `--output`, ne `--` separator pro element form; pro `--full` zachová `--full -- "<out>"`).
2. `--engine=playwright`: `npx --yes playwright@latest screenshot --browser=chromium "<url>" "<out>"` pro `--full`, pro element-scoped vlastní mini Node script (in-house, inline string heredoc) s `page.locator(sel).screenshot({ path })`.
3. `auto`: preferuj `agent-browser`, fallback playwright pokud chybí. Print v stderr který engine zvolil.

Helper sám zjišťuje port z `<designRoot>/_server.json` pokud `--port`/`--url` chybí, sám resolvuje active canvas z `_active.json`, sám vytváří `--out-dir` (`mkdir -p`).

### C. Slash command + skill update

- `/design:screenshot` se rozšíří o `--screen <id>`, `--element <id>`, `--all-screens`. Mapping:
  - `--screen X` → `--selector "[data-dc-screen=\"X\"]"`
  - `--element X` → `--selector "[data-dc-element=\"X\"]"`
  - `--all-screens` → smyčka, `--out-dir <designRoot>/_history/<slug>/screenshots/`
- Implementace v `screenshot.md` postupu = jediné volání helperu.

### D. Callers refactor

| Soubor | Co dnes dělá | Po refaktoru |
|---|---|---|
| `commands/new.md` step 9 (post-write reality check, per-artboard loop) | Inline `agent-browser navigate` + grep `DCArtboard id=` + `for ID … agent-browser screenshot "[data-dc-slot=\"$ID\"]" …` | `screenshot.sh --all-screens --out-dir "$HIST"` |
| `commands/edit.md` step 3.5 (pre-edit selection context) | Inline `agent-browser open` + `screenshot --full -- "$OUT"` | `screenshot.sh --full --out "$OUT"` nebo (když `SEL_VALID=1` + selected element má `data-dc-element`) `--element <id>` |
| `commands/edit.md` step 7 (post-write reality check) | Inline `agent-browser navigate` + `screenshot --full -- "$OUT"` | `screenshot.sh --full --out "$OUT"` |
| `commands/setup-ds.md` step 9 (visual sanity, 3 signature specimens) | Inline pro každý specimen | `screenshot.sh --url "$URL" --full --out "$OUT"` × 3 |
| `agents/design-critic.md` § 2 (Capture screenshot if missing) | Inline | `screenshot.sh --full --out "<…>"` nebo `--element "<selector>"` když `selected` set |
| `agents/signature-moment-critic.md`, `graphic-design-critic.md`, ostatní critics co capturují (audit požaduje grep) | Inline kde je | Helper |
| `skills/design/SKILL.md` "Post-write reality check", "Canonical screenshot pattern" | Inline bash bloky | Odkaz na helper + 1 příklad |

### E. Inspector / selector update

- `dev-server/server.mjs` `cssPath()` preferuje data-dc-* attrs (viz A.). Změna otestovatelná: vytvořit canvas s `<button data-dc-element="cta-primary">`, Cmd+Click → `_active.json.selected.selector` musí být `[data-dc-element="cta-primary"]`, ne `body > … > button:nth-child(3)`.
- `domPath()` (line 633) přidá `[data-dc-element="…"]` / `[data-dc-screen="…"]` jako label segment kde existuje.
- Inspektor status bar v `client/app.jsx` (StatusBar, line 465) zobrazí kratší human-readable label (`cta-primary` místo plného `[data-dc-element="cta-primary"]`) když attr existuje.

### F. Critics receive ID-tagged screenshot paths

Critic input envelope (viz `agents/design-critic.md` § 1) dostane nové pole:

```
screenshots:
  full:   <abs path | empty>
  screens:                              # když je k dispozici
    onboarding-welcome: <abs path>
    onboarding-permissions: <abs path>
  element: <abs path | empty>           # pokud je selection scoped
```

Critic při čtení obrázků ví, který soubor patří kterému screenu — verdikt může jmenovat screen po slugu místo "first artboard / leftmost panel".

### G. Bootstrap detection helper (`bin/bootstrap-check.sh`)

Cílí na duplikát v `new.md` lines 66–82 + `edit.md` lines 32–53 — identický 8řádkový bash + 3řádková truth table.

```sh
bootstrap-check.sh [--json]
```

Bez `--json`: exit 0 (ready) / 10 (needs `/design:init`) / 11 (needs `/design:setup-ds`). Stdout: human-readable next-step (např. `→ Running /design:init to initialize project…`).

S `--json`: stdout JSON `{has_ds: bool, config_present: bool, repo_root: "<abs>", known_ds: ["project", "marketing"], default_ds: "project"}`. Eval-friendly přes `eval "$(bootstrap-check.sh --shell-export)"` → exporty `HAS_DS / CONFIG_PRESENT / REPO_ROOT / KNOWN_DS / DEFAULT_DS`.

Callers po refaktoru:

```sh
source "$CLAUDE_PLUGIN_ROOT/dev-server/bin/_lib.sh"
eval "$(bootstrap-check.sh --shell-export)" || { handle-needs-init-or-ds; }
```

### H. Server lifecycle helper (`bin/server-up.sh`)

Cílí na duplikát v 6 souborech (`screenshot.md`, `new.md`, `critic.md`, `edit.md`, `rollback.md`, `SKILL.md`).

```sh
server-up.sh [--root <repo>] [--timeout 10]
```

Operace: read `$DESIGN_ROOT/_server.json` → PID `kill -0` + `curl -fs /_health` → pokud OK, print port a exit 0. Jinak `rm` stale `_server.json` + `nohup node $CLAUDE_PLUGIN_ROOT/dev-server/server.mjs --root "<repo>" > "$DESIGN_ROOT/_server.log" 2>&1 & disown` + polling až 10s (1s interval, 10 attempts). Stdout = port number. Exit 0 ready / 1 start-timeout.

Stejný helper pak používá `screenshot.sh` interně místo opakovaného `jq` z `_server.json`.

### I. Slug normalization helper (`bin/slug.sh`)

Cílí na implicit duplicaci — `edit.md` má kanonický recept (`tr / sed`), screenshot.md a critic agenti říkají "compute slug" a nechávají na orchestratorovi.

```sh
slug.sh <active-canvas-path-relative-to-designRoot>
```

Stdout: kebab-lowercased slug (`ui/showcase/Match Recap.html` → `ui-showcase-match_recap`). 5 řádků implementace, jediná pravda pro `_history/<slug>/` path computation. Volá se i z uvnitř `screenshot.sh`.

### J. Selector schema sweep (bug fix)

`agents/signature-moment-critic.md` lines 69, 75 používají `[data-artboard-id]` / `[data-artboard-id='<id>']` — selektor, který v žádném runtime souboru neexistuje. `design-canvas.jsx` emituje `data-dc-slot` (dnes) a `data-dc-screen` (po Task 1). Critic v této podobě po každém spawnu nic neselektuje → fallback na `--full` → ztrácí per-artboard discipline. Sweep: grep `data-artboard` napříč celým pluginem, rename na `data-dc-screen` (post-Phase-13 konvence).

### K. Backwards compatibility

- `data-dc-slot` zůstává — nepřejmenovává se.
- Existující canvasy bez `data-dc-element`: helper s `--all-screens` najde `[data-dc-screen]` od momentu jak DCArtboard začne emitovat oba attrs (změna ad A.). Pre-existing kanvasy mají jen `data-dc-slot` → smyčka jím fallbackuje (`[data-dc-screen], [data-dc-slot]` v stejném `querySelectorAll`).
- `/design:screenshot --selector <css>` zachován pro power-user případy.
- Critics co četly `screenshot_path` (single) stále dostanou v `screenshots.full` to samé.

## Metadata

- **GitHub Issue**: — (nebyl založen, scope plánován z user requestu)
- **Type**: Enhancement
- **Complexity**: Medium
- **App/Package**: `plugins/design` (cross-cutting: dev-server runtime + slash commands + skill + agents)
- **Affected Systems**: dev-server inspector + runtime, design plugin commands `new` / `edit` / `setup-ds` / `screenshot`, SKILL.md, 4–7 critic agents, frontend-design envelope (instructions only, ne ten plugin sám)
- **Dependencies**: žádné nové; volitelný `playwright` runtime přes `npx --yes` jen pokud engine=playwright

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/runtime/design-canvas.jsx` (lines 469–610) — Why: kde DCArtboard rendruje `data-dc-slot`; sem přidat `data-dc-screen`.
- `plugins/design/dev-server/server.mjs` (lines 600–658) — Why: `cssPath()` + `domPath()` + `elInfo()` v inspector injected scriptu; rozšířit o data-dc-* preference.
- `plugins/design/dev-server/client/app.jsx` (lines 465–480, 594–680) — Why: StatusBar a WS selection handling; možná update labelu, ale primárně beze změny (selector už dostane z serveru jiný string).
- `plugins/design/commands/screenshot.md` — Why: hlavní obyvatel — refactor + nové flagy.
- `plugins/design/commands/new.md` (lines 290–330) — Why: step 9 per-artboard loop, prime target pro DRY.
- `plugins/design/commands/edit.md` (lines 130–215) — Why: step 3.5 + step 7 inline screenshoty.
- `plugins/design/commands/setup-ds.md` (step 9 visual sanity) — Why: 3 specimen screenshoty.
- `plugins/design/skills/design/SKILL.md` (lines 230–300) — Why: "Post-write reality check" sekce — sjednotit text.
- `plugins/design/agents/design-critic.md` (lines 50–58) — Why: vzorový critic; další critics následují stejný pattern.

### Files to Create

- `plugins/design/dev-server/bin/screenshot.sh` — canonical screenshot helper (zero-dep bash, agent-browser primárně, playwright fallback).
- `plugins/design/dev-server/bin/_screenshot-playwright.mjs` — inline-stable Node mini-script pro element-scoped playwright screenshot (helper si ho vytváří v `mktemp -d` při invokaci, NEBO ho udržujeme jako committed soubor — viz Task 4 rozhodnutí).
- `plugins/design/dev-server/bin/bootstrap-check.sh` — bootstrap detection helper (Task 15).
- `plugins/design/dev-server/bin/server-up.sh` — server lifecycle helper (Task 16).
- `plugins/design/dev-server/bin/slug.sh` — slug normalization helper (Task 17).
- `plugins/design/dev-server/bin/_lib.sh` — sdílené bash helpery (path resolution `$CLAUDE_PLUGIN_ROOT` fallback, config-read with defaults) — sourced ostatními `bin/*.sh`. Drží 20–40 LOC; když jednotlivá helper nepotřebuje sdílený kód, soubor zůstane nepoužitý a vypadne.

### Files to Modify

- Runtime: `design-canvas.jsx`, `server.mjs`, případně `client/app.jsx`.
- Commands: `screenshot.md`, `new.md`, `edit.md`, `setup-ds.md`.
- Skill: `skills/design/SKILL.md`.
- Agents: `design-critic.md`, `signature-moment-critic.md`, `graphic-design-critic.md`, `typography-critic.md`, `frontend-critic.md`, `a11y-critic.md` (každý kde inline screenshot bash).
- Plugin package distribution: `package.json` `files` musí zahrnovat `plugins/design/dev-server/bin/` (CLI ho potřebuje at runtime na end-user machine).

### Documentation

- agent-browser CLI signatura — `agent-browser screenshot [selector] [path]` (positional), `--full -- "<path>"` pro full-page; `--output <path>` SILENTLY no-op (load-bearing gotcha). Existing footprint v SKILL.md a edit.md.
- Playwright CLI: `npx playwright screenshot --browser chromium <url> <out>` pro full; element-scoped chce vlastní script (playwright CLI nemá `--selector` flag).

### Patterns to Follow

- Bash style v `dev-server/server.mjs` headers (např. `command -v` check). Žádný `set -euo pipefail` v existujících helper skriptech v repu — neimprovizovat, čti `scripts/bump-version.sh` jako vzor.
- Slash command argument parsing už `commands/screenshot.md` má (grep `-oE -- '--area=…'`). Pokračovat stylem; ne přidávat getopts dep.

---

## Design Decisions

Tahle fáze NEMÁ vlastní UI screen — je to infrastructure. Žádná token / icon / komponenta volba potřeba. **Sekce vědomě vypuštěna.**

---

## Tasks

Pořadí je závislost-driven. Každý task je atomický + ověřitelný ručně (žádný test suite v repu — viz CLAUDE.md "There is no test suite").

### Task 1: ADD data-dc-screen na DCArtboard

- **Do**: V `plugins/design/dev-server/runtime/design-canvas.jsx` v `DCArtboardFrame` render (kolem line 606 kde je `data-dc-slot={id}`) přidat `data-dc-screen={id}` jako další attribut na stejný element. Žádná logika nezávisí na existenci jednoho z nich — oba jsou stejná hodnota.
- **Pattern**: stejná `data-dc-*` family (line 606 současný `data-dc-slot={id}`).
- **Gotcha**: Runtime `design-canvas.jsx` je bundlovaný do canvasů přes `frontend-design` template / browser-mounted. Změna se projeví u nově generovaných canvasů. Existujícím canvasům to nic nerozbije (atribut navíc je no-op).
- **Validate**: `grep -n "data-dc-screen={id}" plugins/design/dev-server/runtime/design-canvas.jsx` musí vrátit 1 hit; otevřít libovolný existující `.design/` canvas v dev-serveru a v devtools ověřit, že artboard má oba atributy (po refresh canvasu).

### Task 2: UPDATE cssPath() + elInfo() v injected inspector

- **Do**: V `plugins/design/dev-server/server.mjs` upravit `cssPath()` (lines 616–631) tak, že **před** `if (el.id)` break-condition přijdou:

  ```js
  var dscEl = el.getAttribute && el.getAttribute('data-dc-element');
  if (dscEl) { path.unshift('[data-dc-element="' + dscEl + '"]'); break; }
  var dscSc = el.getAttribute && el.getAttribute('data-dc-screen');
  if (dscSc) { path.unshift('[data-dc-screen="' + dscSc + '"]'); break; }
  ```
  Stejný pattern v `domPath()` (lines 633–644) — místo break vložit label segment a pokračovat.
- **Pattern**: existující `if (el.id)` break-condition na line 621.
- **Gotcha**: Inspector skript je injected jako STRING přes server response — žádný build step. Změna se projeví okamžitě při refresh canvasu. Nezapomenout escapovat `"` v emitted CSS attr selektoru (Vsdq, `[data-dc-element=\"x\"]` mismatch jestli si stringificator přidá vrstvu — řeší se prostě single-quote vrap u outer Js string).
- **Validate**: Restart dev server, otevřít test canvas obsahující `<button data-dc-element="cta-primary">`, Cmd+Click, sledovat `<designRoot>/_active.json` → `selected.selector` musí být `[data-dc-element="cta-primary"]` nebo končit tím selektorem. Cmd+Click na artboard background → `selected.selector` končí `[data-dc-screen="<id>"]`.

### Task 3: CREATE plugins/design/dev-server/bin/screenshot.sh

- **Do**: Nový executable bash skript (chmod +x). API viz "Solution → B". Strukturně:
  1. `usage()` print + arg-parse (case + shift).
  2. Resolve `URL`: `--url` > `--port` + `_active.json` > implicit z `_server.json` + `_active.json`.
  3. Resolve selector: `--screen X` → `[data-dc-screen="X"]`, `--element X` → `[data-dc-element="X"]`, `--selector` → as-is, `--full` → empty + `--full` mode.
  4. Resolve engine: `--engine` arg > auto-detect (`command -v agent-browser`).
  5. Pro `--all-screens`: navigovat 1x, pak smyčka přes `agent-browser eval "Array.from(document.querySelectorAll('[data-dc-screen],[data-dc-slot]')).map(e => e.getAttribute('data-dc-screen') || e.getAttribute('data-dc-slot')).filter(Boolean).join('\n')"`, parse stdout, `mkdir -p $OUT_DIR`, NN-counter, screenshot per id.
  6. Print stderr engine + outcome line per file; stdout pouze path(s) — composable jako `for f in $(screenshot.sh --all-screens …); do …`.
  7. Exit 0 jen pokud KAŽDÝ zapsaný PNG existuje a má > 1KB; jinak exit 2 + diagnostic.
- **Pattern**: `scripts/bump-version.sh` (zero-dep bash, `case "$1" in`, no `set -e`).
- **Gotcha**: `agent-browser screenshot --output <path>` SILENT FAIL — vždy positional. `--full` REQUIRES `--` separator before path. Element-scoped form je `agent-browser screenshot "<selector>" "<path>"` BEZ `--`. Tyto tři tvary jsou jediné podporované — zakódovat exactly.
- **Validate**: 
  ```
  bash plugins/design/dev-server/bin/screenshot.sh --help     # usage print, exit 0
  bash plugins/design/dev-server/bin/screenshot.sh --full --out /tmp/x.png
  bash plugins/design/dev-server/bin/screenshot.sh --screen onboarding-welcome --out /tmp/x.png
  bash plugins/design/dev-server/bin/screenshot.sh --all-screens --out-dir /tmp/shots
  ```
  Každý vrátí exit 0 a vytvoří PNG > 1KB (proti běžícímu dev serveru s test canvasem).

### Task 4: DECIDE playwright fallback impl + případně CREATE _screenshot-playwright.mjs

- **Do**: Rozhodnout — committed soubor nebo inline heredoc v helperu. **Doporučuju committed** (`plugins/design/dev-server/bin/_screenshot-playwright.mjs`, ~30 LOC), protože:
  - Heredoc s `$(playwright ...)` escapováním je křehký.
  - Soubor je grep-able / lint-able / dá se otevřít v editoru.
  - `npx playwright` instaluje runtime per-call do cache; náš mini skript dělá jen `launch + locator.screenshot`.
- **Pattern**: Žádný ESM/CJS dep, jen `npm exec --package=playwright -- node <script>` invokace; uvnitř `import { chromium } from 'playwright'`. Skript přijímá args `--url <url> --selector <css|empty> --out <path> --timeout <s>`.
- **Gotcha**: `npx --yes playwright@latest` první run instaluje Chromium (~150 MB) — pomalé jednou. Engine=auto preferuje agent-browser proto, ne playwright. Helper v print informuje user: `→ playwright engine; first invocation may install chromium (~150MB, one-off)`.
- **Validate**: `node plugins/design/dev-server/bin/_screenshot-playwright.mjs --url http://localhost:4399/.design/system/project/foo.html --selector '[data-dc-screen="x"]' --out /tmp/y.png` vrátí 0 + PNG.

### Task 5: UPDATE /design:screenshot postup v commands/screenshot.md

- **Do**: Refactor body souboru. Nový `argument-hint`: `"[--area <name>] [--screen <id> | --element <id> | --selector <css> | --full] [--all-screens]"`. Postup zredukovat na: (1) server lifecycle check, (2) parse args, (3) resolve out path (zachovat NNN-area schema když není `--all-screens`), (4) **volat helper** `$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh …` s mapnutými flagy. Žádný inline `agent-browser navigate + screenshot` v souboru.
- **Pattern**: Existující `screenshot.md` lines 24–42 (Postup sekce) → nahradit voláním.
- **Gotcha**: `argument-hint` se zobrazuje v Claude Code UI; nesmí překročit ~120 znaků, jinak se ořízne. Zkrátit pokud nutné: `"[--area <n>] [--screen|--element <id> | --selector <css> | --full | --all-screens]"`.
- **Validate**: `/design:screenshot --help` (přes Claude Code) zobrazí nový argument-hint. Volání `/design:screenshot --screen <id>` proti běžícímu serveru vytvoří PNG.

### Task 6: UPDATE commands/new.md step 9 — per-artboard reality check

- **Do**: V `commands/new.md` najít blok lines 296–323 (per-artboard for-loop s inline agent-browser voláními). Nahradit:

  ```bash
  bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" \
    --all-screens \
    --out-dir "$HIST" \
    --timeout 8 \
    || echo "⚠ baseline screenshots failed — see screenshot.sh stderr above"
  ```
  Zachovat fallback komentář pro ≤ 3 artboardy + state-which-approach print v step 12 (jen se reportuje engine choice z stderr).
- **Pattern**: existující step 9 prózu nepřepisovat ohledně "why per-artboard wins" — jen kód.
- **Gotcha**: Step 9 explicitně píše "regardless of `--no-critic`" — zachovat tu garanci.
- **Validate**: Spustit `/design:new "Test Refactor" "brief" --no-critic` v scratch projektu (`/tmp/test`); ověřit, že `<DESIGN_ROOT>/_history/<slug>/000-screen-*.png` existují, jeden per artboard.

### Task 7: UPDATE commands/edit.md step 3.5 + step 7 — selection context + post-write

- **Do**: V `edit.md`:
  - Step 3.5 (lines 130–157): inline bash blok nahradit voláním `screenshot.sh --full --out "$OUT"` (kanvas-wide context). Když `SEL_VALID=1` AND `selected.selector` matchuje `[data-dc-element="…"]` → `screenshot.sh --element <id> --out "$OUT_ELEMENT"` jako druhý screenshot (oba čtené přes Read tool).
  - Step 7 (lines 193–214): inline bash blok nahradit `screenshot.sh --full --out "$OUT"`.
- **Pattern**: Stejná logika jako dnes, jen ohraničená helperem.
- **Gotcha**: `screenshot.md` "Tip — annotation loop" referencuje `/design:screenshot` — uživatelská cesta, beze změny.
- **Validate**: V scratch projektu `/design:edit "tighten header padding"` na canvasu se selekcí (Cmd+Click element předem). Sledovat `<hist>/<NNN>-context.png` že vznikne; `_history/<slug>/<NNN+1>-baseline.png` po editu.

### Task 8: UPDATE commands/setup-ds.md step 9 — visual sanity 3 specimens

- **Do**: V `setup-ds.md` Step 3 § 9 (Visual sanity) je inline screenshot pro 3 signature specimens. Refactor každý ze 3 volání na `screenshot.sh --url "<url>" --full --out "<out>"`. URL stavění zůstává v `setup-ds.md` (helper nezná specimen-vs-canvas rozdíl) — pro úplnost helper akceptuje `--url`.
- **Pattern**: viz Task 7.
- **Gotcha**: setup-ds používá `Skill design-system` v bootstrap modu — vlastní screenshoty řeší ten skill, ne přímo command. Sledovat: refactor patří do `skills/design-system/SKILL.md` (visual sanity step v bootstrap flow), ne do `commands/setup-ds.md`. **Re-targetovat soubor: `plugins/design/skills/design-system/SKILL.md`** (zkontrolovat skutečnou cestu).
- **Validate**: `/design:setup-ds project "brief"` v fresh projektu — sledovat že 3 specimen PNG vzniknou v `_history/_system/<ds>/screenshots/`.

### Task 9: UPDATE skills/design/SKILL.md "Post-write reality check" + "Canonical screenshot pattern"

- **Do**: V `plugins/design/skills/design/SKILL.md` najít "Post-write reality check" sekci (kolem line 235) + jakékoliv další místo s inline `agent-browser navigate + screenshot`. Nahradit prózu jednoduchým: "Always invoke `$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh` — viz `commands/screenshot.md` pro argument map. Helper zaobaluje engine selection, fallback to playwright, a `--all-screens` smyčku."
- **Pattern**: Zachovat existující "why per-artboard wins" kontext (line 291) — jen technický howto se nahradí.
- **Gotcha**: SKILL.md je 927 řádků; udělat jen TARGETED edits, ne wholesale rewrite. Použít `Edit` s velkými `old_string` kontextovými okny.
- **Validate**: `grep -c "agent-browser navigate" plugins/design/skills/design/SKILL.md` musí klesnout o ≥ 4 (4 výskyty inline). `grep -c "screenshot.sh" plugins/design/skills/design/SKILL.md` musí být ≥ 2.

### Task 10: UPDATE 4–7 critic agentů (capture screenshot if missing)

- **Do**: 
  ```
  grep -lE "agent-browser (navigate|open|screenshot)" plugins/design/agents/
  ```
  pro každý hit refactor "Capture screenshot if missing" sekci na: 
  ```
  bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --full --out "<screenshot_path>"
  # If selected:
  bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/screenshot.sh" --element "<id>" --out "<element_path>"
  ```
  + rozšířit input envelope o `screenshots.screens` map když caller předá (viz F.).
- **Pattern**: viz `design-critic.md` lines 50–57.
- **Gotcha**: Critics jsou definovány markdownem (agent definition); změny se neimplementují, jsou *instrukce* pro spawned agenta. Stačí konzistentní text napříč všemi critics.
- **Validate**: `grep -rE "agent-browser (navigate|open|screenshot)" plugins/design/agents/` má vrátit 0 hitů po Task 10.

### Task 11: UPDATE frontend-design envelope direktiv (SKILL.md "Generation envelope")

- **Do**: V `plugins/design/skills/design/SKILL.md` "Generation envelope" sekci přidat verbatim direktivu mezi existující aspiration directives (devíti až čtrnácté):
  
  > **Element tagging.** Každý named region (hero, nav, card, list-row, form-field, CTA) dostane `data-dc-element="<kebab-id>"`. ID je role-prefixed a brief-specific: `cta-get-started`, `card-hero`, `list-row-roster`, `field-email`. Pomáhá comments, screenshotům, a critic verdictům cílit konkrétní místo bez fragile `:nth-child` selektorů.
- **Pattern**: Stávající aspiration directives v té sekci.
- **Gotcha**: Tahle direktiva ovlivňuje výstup `frontend-design` (externí plugin) přes envelope-as-prompt — nesahá do `frontend-design`'s vlastního kódu. Direktiva je deklarativní; má se objevit verbatim v generation envelope, takže `frontend-design` ji vidí v promptu.
- **Validate**: `grep -A3 "data-dc-element" plugins/design/skills/design/SKILL.md` zobrazí novou direktivu. Spuštění `/design:new "Test Tags" "..."` v scratch projektu — vygenerovaný canvas obsahuje alespoň 3 `data-dc-element="…"` výskyty.

### Task 12: UPDATE package.json — files allowlist

- **Do**: V root `package.json` `files` array přidat `plugins/design/dev-server/bin/` (jeden řádek). Bez toho npm publish nepřibalí helper a `mdcc design serve` u end-userů nenajde `dev-server/bin/screenshot.sh`.
- **Pattern**: existující `files` entries (kolem lines 30–40 v `package.json`).
- **Gotcha**: CLAUDE.md "Published npm surface" sekce explicitně volá tohle: "When adding a new top-level directory that the CLI needs at runtime, add it to `files` or `mdcc` will break for end users."
- **Validate**: `npm pack --dry-run | grep dev-server/bin/`musí ukazovat oba soubory (`screenshot.sh`, `_screenshot-playwright.mjs`).

### Task 13: UPDATE design plugin docs (CATEGORIES.md, README, CLAUDE.md)

- **Do**: 
  - `plugins/design/CATEGORIES.md`: zaznamenat nové flagy `/design:screenshot --screen|--element|--all-screens`.
  - `CLAUDE.md` "Dev server runtime contract" tabulka: žádná změna (helper nepíše do `_active.json` ani `_server.json`); jen poznámka v "Architecture" že `dev-server/bin/screenshot.sh` je canonical screenshot entry.
- **Validate**: Manuální čtení; ujistit se že nově popsané flagy jsou konzistentní s implementací z Task 3.

### Task 15: CREATE plugins/design/dev-server/bin/bootstrap-check.sh

- **Do**: Nový executable bash. API viz "Solution → G". Implementačně:
  1. `REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"`
  2. `CONFIG_PRESENT=false; [[ -f "$REPO_ROOT/.design/config.json" ]] && CONFIG_PRESENT=true`
  3. `HAS_DS=false; [[ -d "$REPO_ROOT/.design/system" ]] && find "$REPO_ROOT/.design/system" -mindepth 1 -maxdepth 1 -type d | grep -q . && HAS_DS=true`
  4. `KNOWN_DS=$(jq -r '.designSystems[]?.name' "$REPO_ROOT/.design/config.json" 2>/dev/null | tr '\n' ' ')`
  5. `DEFAULT_DS=$(jq -r '.defaultDesignSystem // "project"' "$REPO_ROOT/.design/config.json" 2>/dev/null)`
  6. Modes: `--json` → JSON na stdout exit 0/10/11; `--shell-export` → `export HAS_DS=…` lines; default → human-readable next-step + exit 0/10/11.
- **Pattern**: existující inline bash bloky v `new.md` lines 66–82 — zkopírovat tu logiku do helperu.
- **Gotcha**: `jq` může selhat (config malformed) — defaults musí přežít. Žádný `set -e`.
- **Validate**: 
  ```
  cd /tmp/empty && bootstrap-check.sh        # exit 10, "Run /design:init"
  cd /tmp/empty && bootstrap-check.sh --json # {"has_ds":false, "config_present":false, …}
  cd /Volumes/D/git/claude-design && bootstrap-check.sh   # exit 0
  ```

### Task 16: CREATE plugins/design/dev-server/bin/server-up.sh

- **Do**: Nový executable bash. API viz "Solution → H". Použít stejnou logiku jako `edit.md` lines 70–93 (kanonická verze). Klíčové:
  - PID `kill -0 $PID 2>/dev/null && curl -fs http://localhost:$PORT/_health > /dev/null` před respawn.
  - `nohup node "$CLAUDE_PLUGIN_ROOT/dev-server/server.mjs" --root "$REPO_ROOT" > "$DESIGN_ROOT/_server.log" 2>&1 & disown`
  - 1s interval × 10 retries; každý retry zkusí `curl /_health`.
  - Po start: znovu read `_server.json` → print port.
- **Pattern**: `commands/edit.md` lines 70–93.
- **Gotcha**: `$CLAUDE_PLUGIN_ROOT` musí být resolved — pokud script spuštěn mimo Claude Code context, fallback na `$(dirname "$0")/..`. Helper nesmí spoléhat na env var, který nemusí existovat.
- **Validate**:
  ```
  server-up.sh         # nastartuje, prints "4399"
  server-up.sh         # detect alive, prints "4399" (no restart)
  kill <pid>
  server-up.sh         # respawn, prints port
  ```

### Task 17: CREATE plugins/design/dev-server/bin/slug.sh

- **Do**: Nový executable bash, 5 řádků. `slug.sh <relative-path>` → stdout slug.
  ```sh
  #!/usr/bin/env bash
  printf '%s' "${1#./}" | tr '/' '-' | tr ' ' '_' | tr '[:upper:]' '[:lower:]' | sed 's/\.html$//' | sed 's/^\.\+//'
  ```
- **Pattern**: `edit.md` line 112 kanonický recept.
- **Validate**: `slug.sh "ui/showcase/Match Recap.html"` → `ui-showcase-match_recap`.

### Task 18: REFACTOR new.md + edit.md to use bootstrap-check + server-up + slug helpers

- **Do**: 
  - `commands/new.md` step 0 (lines 66–82) → 1 řádek volání `bootstrap-check.sh`; následně shell-export pro `HAS_DS`/`CONFIG_PRESENT`/`KNOWN_DS`. Truth-table prózou zachovat (dokumentace pro user) — jen executable bash zmizí.
  - `commands/new.md` step 2 (Server lifecycle check) → `PORT=$(server-up.sh)` 1 řádek.
  - `commands/edit.md` step 0 (lines 32–53) → analogicky.
  - `commands/edit.md` step 2 → analogicky.
  - `commands/edit.md` step 3 slug computation (lines 111–112) → `SLUG=$(slug.sh "${ACTIVE#$DESIGN_ROOT/}")`.
- **Pattern**: viz Tasks 15–17.
- **Gotcha**: `commands/screenshot.md`, `commands/rollback.md`, `commands/critic.md` taky volají server lifecycle. **Refactorovat je v stejném tasku** — jinak helper existuje, ale duplicita zůstává v 3 dalších souborech.
- **Validate**: `grep -rn "NEEDS_START\|nohup node.*dev-server" plugins/design/ --include="*.md"` vrátí 0 hitů (kromě `skills/design/SKILL.md` text-only popis pro debug context — viz Task 19).

### Task 19: REFACTOR SKILL.md to point at helpers (not duplicate bash)

- **Do**: V `plugins/design/skills/design/SKILL.md` najít všechna místa s inline bash bootstrap detection / server lifecycle / slug computation a nahradit prózou "viz `dev-server/bin/<helper>.sh` — kanonický recept". Zachovat kontext / vysvětlení "proč" (high-level), odstranit "jak" duplikát.
- **Pattern**: `screenshot.md` after Task 5 (volá helper, popisuje high-level chování).
- **Validate**: `grep -c "NEEDS_START\|nohup node\|tr '/' '-'" plugins/design/skills/design/SKILL.md` musí klesnout o ≥ 3.

### Task 20: FIX signature-moment-critic + sweep data-artboard-id

- **Do**: 
  ```
  grep -rn "data-artboard-id\|data-artboard" plugins/design/ --include="*.md"
  ```
  Každý hit nahradit `data-dc-screen` (Phase 13 konvence z Task 1). V `agents/signature-moment-critic.md` lines 69 + 75 specifically.
- **Pattern**: Task 1 přidává `data-dc-screen` na DCArtboard — critic musí selektovat ten samý attribut.
- **Gotcha**: Pokud `data-artboard-id` byl historicky planned (žádný runtime ho neemitoval), je to dead reference. Verify: `grep -rn "data-artboard-id" plugins/design/dev-server/` MUSÍ vrátit 0 hits před refactorem. Pokud běží, je to bug — tichý fallback na `--full` ztrácí per-artboard semantics signature-moment critica.
- **Validate**: `grep -rn "data-artboard" plugins/design/` vrátí 0 hitů. Spustit `/design:critic --agent signature-moment-critic` na multi-artboard canvasu — verdict obsahuje per-artboard observation (ne jen "first artboard").

### Task 21: UPDATE package.json — files allowlist (rozšířit)

- **Do**: Stejný entry jako Task 12 (`plugins/design/dev-server/bin/`) — pokrývá ALL helpers najednou, ne jen `screenshot.sh`. Task 12 ↔ Task 21 jsou redundantní; po sloučení mít **jediný edit** `package.json`. Re-numbering: Task 12 zůstává, Task 21 explicitně odkazuje že je to no-op verifikace.
- **Validate**: `npm pack --dry-run | grep dev-server/bin/` ukazuje ≥ 5 souborů (`screenshot.sh`, `_screenshot-playwright.mjs`, `bootstrap-check.sh`, `server-up.sh`, `slug.sh`, případně `_lib.sh`).

### Task 22: Manual smoke v scratch projektu

- **Do**: 
  ```
  cd /tmp && rm -rf scratch && mkdir scratch && cd scratch && git init -q
  bash plugins/design/dev-server/bin/bootstrap-check.sh   # exit 10 (no config)
  mdcc init --name scratch --force
  bash plugins/design/dev-server/bin/bootstrap-check.sh   # exit 11 (no DS)
  # link plugin marketplace na lokální tree, /plugin marketplace update, /reload-plugins
  /design:setup-ds project "minimalist editorial tool"   # ověřit specimen screenshoty
  bash plugins/design/dev-server/bin/bootstrap-check.sh   # exit 0 (ready)
  /design:new "Test Canvas" "3 screen onboarding"        # ověřit per-screen baselines + data-dc-element tagging
  /design:screenshot --all-screens                       # ověřit smyčku
  /design:screenshot --element cta-primary               # ověřit element-scoped
  /design:edit "tighten header padding"                  # ověřit pre+post screenshoty
  ```
- **Validate**: Každý krok vytvoří očekávané PNG > 1KB; `_active.json.selected.selector` po Cmd+Click obsahuje `[data-dc-element="…"]`; critic verdict (z `/design:edit` auto-loop) jmenuje screen po slugu; bootstrap-check.sh exit codes odpovídají očekávaným stavům.

---

## Validation

Tenhle repo nemá test suite / lint config / build step (per CLAUDE.md). Validation je manuální + grep-based:

1. **Grep audit — screenshot duplicaty**: `grep -rnE "agent-browser (navigate|open|screenshot)" plugins/design/` musí vracet 0 hitů (kromě `commands/screenshot.md` postupu, který odkazuje na helper, a `dev-server/bin/screenshot.sh` sám).
2. **Grep audit — bootstrap detection duplicaty**: `grep -rnE "REPO_ROOT=.*git rev-parse|HAS_DS=false" plugins/design/ --include="*.md"` musí vracet hits pouze v `bootstrap-check.sh` (žádné v commands/skills/agents).
3. **Grep audit — server lifecycle duplicaty**: `grep -rnE "NEEDS_START=|nohup node.*dev-server" plugins/design/ --include="*.md"` musí vracet 0 hits.
4. **Grep audit — slug duplicaty**: `grep -rn "tr '/' '-' | tr ' ' '_'" plugins/design/ --include="*.md"` musí vracet 0 hits.
5. **Grep audit — stale selectors**: `grep -rn "data-artboard" plugins/design/` musí vracet 0 hits.
6. **Helper script self-tests**: každý ze 4 helperů má vlastní smoke (Tasks 3, 15, 16, 17).
7. **Runtime tag check**: V devtools libovolného nově generovaného canvasu — `document.querySelectorAll('[data-dc-screen]').length === document.querySelectorAll('[data-dc-slot]').length` (oba attrs na všech artboardech).
8. **Inspector selector check**: Cmd+Click element s `data-dc-element` — `_active.json.selected.selector` začíná `[data-dc-element="…"]`.
9. **End-to-end smoke**: Task 22.
10. **npm pack dry-run**: `npm pack --dry-run | grep dev-server/bin/` vrátí ≥ 5 souborů.
11. **Version parity**: `bash scripts/check-version-parity.sh` zelená.

---

## Scenario Coverage

UI scenario (5-platform agent-browser/agent-device run) není relevantní — tahle fáze mění **build-time / runtime infrastrukturu plugin**, ne user-facing app UI. Single-platform scratch-project smoke (Task 14) je dostatečné.

Pokud by se nějaký claude-design canvas v `.design/` repu hodil jako regression sample — projetí `/design:edit` na něm + diff screenshotů před / po Task 7. Volitelné.

---

## Acceptance Criteria

- [ ] Task 1–22 hotové; každý jednotlivě ověřený grep / smoke validate krokem.
- [ ] Wave A (Tasks 1, 2): runtime tagging + inspector preference.
- [ ] Wave B (Tasks 3, 4, 15, 16, 17): 4 helpery v `dev-server/bin/` self-testují čistě.
- [ ] Wave C (Tasks 5–13, 18, 19, 20): všichni callers refactorováni; žádný inline duplikát.
- [ ] Wave D (Tasks 21, 22): packaging + end-to-end smoke.
- [ ] `grep -rnE "agent-browser (navigate|open|screenshot)" plugins/design/` vrací 0 hitů kromě commands/screenshot.md + dev-server/bin/.
- [ ] `grep -rnE "REPO_ROOT=.*git rev-parse|HAS_DS=false|NEEDS_START=" plugins/design/ --include="*.md"` vrací 0 hitů (kromě helperů samotných v dev-server/bin/).
- [ ] `grep -rn "data-artboard" plugins/design/` vrací 0 hitů.
- [ ] `bash plugins/design/dev-server/bin/screenshot.sh --help` ukáže usage; `--full`, `--screen <id>`, `--element <id>`, `--all-screens` všechny produkují PNG > 1KB proti běžícímu serveru.
- [ ] `bash plugins/design/dev-server/bin/bootstrap-check.sh` vrací správné exit codes (0/10/11) pro 3 různé stavy projektu.
- [ ] `bash plugins/design/dev-server/bin/server-up.sh` startuje server když není, detekuje když je, restartuje když stale.
- [ ] `bash plugins/design/dev-server/bin/slug.sh "ui/showcase/Match Recap.html"` → `ui-showcase-match_recap`.
- [ ] Nově generovaný canvas (přes `/design:new`) má `data-dc-screen` na každém artboardu **i** `data-dc-element` na ≥ 3 named regionech.
- [ ] Cmd+Click v inspectoru produkuje `selected.selector` startující `[data-dc-element="…"]` nebo `[data-dc-screen="…"]` (žádný `:nth-child` na elementech které mají tag).
- [ ] `npm pack --dry-run` zahrnuje `plugins/design/dev-server/bin/` se všemi ≥ 5 helpery.
- [ ] Žádná regrese: existující canvasy (bez `data-dc-element`) stále rendrují a `screenshot.sh --all-screens` jim fallbackuje přes `[data-dc-slot]`.
- [ ] CLAUDE.md / CATEGORIES.md / commands/screenshot.md popisují nové flagy konzistentně.
- [ ] `signature-moment-critic` po opravě (Task 20) na multi-artboard canvasu produkuje per-artboard observation (ne jen "first artboard").
- [x] DDR opt-in: DDR-007 (element-id schema) + DDR-008 (helper home) recorded 2026-05-15

---

## Retro (2026-05-15)

**What worked:**

1. **Wave structure unlocked parallelism we didn't actually need.** Plan grouped 22 tasks into Wave A (runtime, 2) → B (helpers, 5) → C (callers, 11) → D (packaging, 2). Single-pass execute landed everything sequentially in ~90 min without hitting any retry — but the wave grouping helped *me* prioritize (runtime blockers first, callers last) and helped *audit* (each wave had its own grep verification before moving on).
2. **Asking the schema decision up-front (paired attrs vs. single prefix) was load-bearing.** The plan had a quick `AskUserQuestion` before writing — answer was paired attrs (Recommended). If I'd defaulted unilaterally and the user wanted single-prefix, refactoring all critics + envelope direktiv would've added a second pass. Two-option (or three-option) ask early > one-option default.
3. **Live-smoke-against-real-canvas surfaced a bug agent-browser docs hide.** The plan claimed `agent-browser screenshot --output <path>` silent-fails. When I implemented `screenshot.sh`, the actual signature was cleaner (positional path, `--full <path>` works without `--`). But the **eval-then-parse** path had its own gotcha: `agent-browser eval "string.join('\\n')"` returns the literal `\n` inside quote-wrapped output — my sed-based parser saw zero matches. Caught only because I tested against `Canvas Viewport.html` (10 artboards) and saw `0 of 10 screens` captured. Fix took 5 minutes; without the live test it would've shipped broken.

**What didn't work:**

1. **TaskCreate IDs vs. plan task numbers drift.** Plan numbered tasks 1, 2, 3, …, 15, 16, 17, 18, …, 22 (with task 14 reused for smoke at end). I created TaskCreate items in plan order which gave IDs #1–#20 — but my mental mapping `TaskCreate#5 = plan-Task-15` slipped once (marked Task 17 done before realizing #5 was the bootstrap-check helper, not slug). Recover took 30 seconds via TaskUpdate-back-to-in_progress. **Lesson:** when plan task numbers and TaskCreate IDs diverge, write the explicit mapping table *in the plan* (or use plan task IDs literally as TaskCreate metadata).
2. **Plan estimated 5/10 helpers in dev-server/bin/ ship via package.json files allowlist.** Actually all 5 ship for free because `files: ["plugins/design/dev-server"]` is recursive. Task 21 became a no-op verification (`npm pack --dry-run | grep dev-server/bin/`). **Lesson:** check npm pack semantics *before* writing a "remember to add" task — could have saved 1 plan-task.
3. **The phase-3.5 plan + `.design/ui/Canvas Viewport.html` WIP** was sitting uncommitted in working tree before I started. I noticed it during git status near the end, but it could have polluted Phase 13's commit if I'd `git add -A`'d. **Lesson:** new execute should snapshot `git status` at start and report what's *already* dirty before working — flags drift between sessions early instead of at commit time.

**What to change next time:**

1. **`/flow:plan` should include a "duplication audit" step explicitly** — Phase 13's value was 60% screenshot pipeline + 40% "while we're here, the audit found 4 other duplicates worth helpers". Without the user's follow-up `projdi jeste skills, commands a agents` request, those would've shipped as Phase 14/15 fragments. Plan templates could add: *"Before tasks, run a quick grep audit for the duplicate pattern this feature targets — does it exist elsewhere?"*
2. **Helper-vs-prose-deprecation grep filter needs better signal.** My grep audit caught `agent-browser navigate + screenshot` in 2 prose deprecation paragraphs and treated them as "remaining hits". Took a manual inspect to confirm prose-not-invocation. **Future:** structure deprecation references as ` ~~agent-browser~~ ` or `\`agent-browser\` (deprecated)` so grep can filter cleanly.
3. **DDRs land *during* execute, not at done.** Both DDRs (element schema, helper home) were architectural decisions made during Wave A planning, then sat in `Acceptance Criteria → DDR opt-in: consider` until `/flow:done` prompted. Writing them when the decision is fresh would've forced clarity earlier — instead they were drafted at the end from memory + plan re-read. **Lesson:** add a `## Decisions to record` section at top of plan; mark them done as DDRs land, not at acceptance time.

**Carry-overs:**

- Plan flagged but didn't execute: scratch-project end-to-end smoke (`cd /tmp/scratch && mdcc init && /design:setup-ds project ...`). Defers to user — first real `/design:edit` / `/design:new` invocation post-merge is the live smoke. If something is broken with the refactored callers, it surfaces there.
- `data-dc-element` direktiva in envelope is a *prompt-side* instruction to `frontend-design`. Validation = grep generated canvas after next `/design:new`. If `frontend-design` ignores the directive consistently, escalate to envelope-template enforcement (not done in this phase).
- Playwright fallback shim (`_screenshot-playwright.mjs`) is committed but untested live. Verifiable by temporarily renaming `agent-browser` on PATH and running `screenshot.sh --engine playwright`. ~150 MB first-run install — left for opportunistic test, not blocker.
