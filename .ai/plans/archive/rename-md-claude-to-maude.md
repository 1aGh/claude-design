# Feature: Rename `maude` → `Maude` (project-wide brand migration)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. The four key decisions are baked in below — do not re-litigate them mid-execution.

## Description

Přejmenovat projekt z `maude` na **Maude** napříč celým repozitářem, npm publishingem, GitHub repem, dokumentací, i self-dogfooding adresáři (`.ai/`, `.design/`). Cíl: jednotná značka která je marketing-ready a kratší než `maude`. `mdcc` zůstává jako CLI alias 1-2 verze, pak hard-deprecate.

## User Story

As the project maintainer (1aGh / Michal Dovrtěl) chci, aby projekt nesl značku **Maude** všude konzistentně — v npm registry, na GitHubu, v CLI, v docs, v plugin marketplace — aby (a) měl jasnou marketing identitu a (b) uživatelé hláskovali jedno slovo místo `maude` plus `mdcc` plus `claude-design-server`.

## Problem

Současný stav má **3 paralelní jména** pro tu samou věc:
- `maude` — npm scope + GitHub repo + marketplace name
- `mdcc` — CLI binary
- `claude-design-server` — legacy alias bin (před monorepo unifikací)

Plus 7 per-platform sub-packages (`@1agh/maude-darwin-arm64` …), CI workflows pinned to old names, docs/site obsah, `.ai/` self-dogfooding state, a CSS namespace `mdcc-*` v `site/components/mdcc/`. **80+ souborů** drží jedno ze tří jmen. Nelze rebrandnout částečně — buď je celý rename atomic, nebo brand zůstává schizofrenní.

## Solution

**Single atomic PR** který přejmenuje VŠE v repozitáři, mergne na main, pak na GitHubu (1) rename repo `1aGh/maude` → `1aGh/maude` (auto-redirect URL'ů přes GitHub), (2) bump verze na **0.15.0**, (3) publish jako nový npm package `@1agh/maude` + 7 sub-packages `@1agh/maude-<platform>`. Starý `@1agh/maude` se `npm unpublish` (musí být ≤72h od posledního publish).

**4 architektonická rozhodnutí (potvrzená uživatelem):**

| Oblast | Rozhodnutí |
| --- | --- |
| CLI binary | `maude` primary + `mdcc` legacy alias (vypisuje deprecation warning, drop v 0.17.x) |
| CSS namespace `mdcc-*` + `site/components/mdcc/` | **Ponecháno jako interní namespace.** Nevyžaduje rename — implementační detail. |
| Backwards compat npm | **Hard cut: `npm unpublish @1agh/maude`** (vyžaduje akci do 72h od release v0.14.0). Pokud propadlo okno, fallback je `npm deprecate` se zprávou "Renamed to @1agh/maude". |
| Rollout | **Single atomic PR** — refactor + bump + publish v jednom cyklu. |

**Sub-rozhodnutí pro budoucí plány (Phase 9 hub, Phase 13 overlay, Phase 15.5 video) — fixovaná teď, aby implementace nezavedla nové `maude` stringy:**

| # | Sub-pattern | Plán kde žije | Rozhodnutí |
| --- | --- | --- | --- |
| a | `mch_<hex>` token prefix | phase-9-self-hosted-hub | **Rename na `mau_<hex>`** (uživatel-facing token brand musí odpovídat) |
| b | `~/.config/mdcc/hubs.json` XDG path | phase-9 | **Keep `~/.config/mdcc/`** — symmetric s decision #2 (interní namespace), reduces churn pro existující contributors. |
| c | `ghcr.io/1agh/md-claude-hub` Docker image | phase-9 | **Rezervovat `ghcr.io/1agh/maude-hub`** — image ještě nepublishe'd, žádná migrace nutná. |
| d | `mdcc-hub.service.template` systemd unit | phase-9 | **Rename na `maude-hub.service.template`** |
| e | `--mdcc-activity` CSS var | phase-13-canvas-activity-overlay | **Keep** per decision #2 (interní `mdcc-*` namespace) |
| f | `maude.sh` domain | phase-15.5-marketing-demo-video-30s | **Použít `maude.sh`** (subdomain pod uživatelovou `iagh.cz`, žádná nová registrace nutná). Redirect z `maude.sh` pokud user vlastní. Viz Phase 8.6. |

## Metadata

- **GitHub Issue**: (žádný, ad-hoc maintainer task)
- **Type**: Refactor (no functional changes, brand-only)
- **Complexity**: **High** — cross-cutting, ~80 souborů, touches npm publishing + GitHub repo + CI + 7 sub-packages
- **App/Package**: Entire monorepo
- **Affected Systems**: npm package, 7 platform binary sub-packages, GitHub repo, marketplace, CLI (bin + commands), dev-server, site docs, .ai/ + .design/ self-dogfooding, CI workflows, release scripts, schema URLs
- **Dependencies**: GitHub repo rename permissions; npm publish access; 72h window pro `npm unpublish` v0.14.0
- **Risk profile**:
  - **HIGH**: existující uživatelé `mdcc` mají `npm i -g @1agh/maude` v setup skriptech → 404 po unpublish. Mitigation: GitHub release notes + README front-page sticky banner.
  - **MEDIUM**: `mdcc init` scaffolduje `.ai/workflows.config.json` s hard-coded GitHub URL pro `$schema` (`cli/commands/init.mjs`). Po repo rename GitHub redirektuje 301, ale staré scaffolded soubory budou navždy mít starou URL. Acceptable.
  - **MEDIUM**: marketplace `name:` change může způsobit, že existující uživatelé co `/plugin marketplace add 1aGh/maude` budou potřebovat re-add jako `1aGh/maude`. GitHub URL redirect by měl resolvovat fetch, ale samotný `name:` v JSON-u se musí update'nout v jejich Claude Code config.
  - **LOW**: `npm unpublish` v0.14.0 musí být do **72h od jejího publishe**. Zkontrolovat `npm view @1agh/maude time` před exekucí. Pokud propadlo, fallback = deprecate.

---

## Context References

### Must-Read Files (decision context)

- `CLAUDE.md` (lines 1-130) — Why: aktuální self-doc kde stojí "md-claude marketplace" a `mdcc` CLI vyjmenovaný; nese architectural invariants co se nesmí porušit při rename
- `docs/MIGRATING-DUGMATE.md` (entire) — Why: prior-art migrace pro plugin users (jiný scope, ale stejný styl externí communication; recipe co bude potřeba re-pointnout)
- `scripts/bump-version.sh` + `scripts/check-version-parity.sh` — Why: musí zůstat funkční po rename všech sub-package paths
- `cli/install.cjs` — Why: postinstall script co resolvuje per-platform binary; **musí najít nový package name**
- `cli/cli-wrapper.cjs` (lines 40-65) — Why: safe-mode fallback path, hardcoded slug
- `.claude-plugin/marketplace.json` — Why: `name: "maude"` se mění; ovlivní existující users co mají marketplace přidaný

### Files to Create

- `cli/bin/maude.mjs` — primary CLI bin entry (přejmenovaný z `mdcc.mjs`)
- `cli/bin/maude.exe` — primary platform-bin placeholder (přejmenovaný z `mdcc.exe`)
- `cli/bin/mdcc.mjs` — **NEW thin shim** který execne `maude.mjs` po vypsání 1 řádky deprecation warning
- `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md` — migration guide pro existující uživatele `@1agh/maude`
- `packages/maude-{darwin-arm64,darwin-x64,linux-x64,linux-arm64,linux-x64-musl,linux-arm64-musl,win32-x64}/` — 7 nových sub-package adresářů (po `git mv` ze starých `md-claude-<slug>/`)

### Files to Delete (after `git mv`)

- `packages/md-claude-*/` — všech 7 adresářů přejmenováno
- `cli/bin/mdcc.exe` (po přesunu obsahu do `maude.exe` a vytvoření shim)

### Documentation

- npm CLI docs: <https://docs.npmjs.com/cli/v10/commands/npm-unpublish> — Why: 72h window rule + scope-package edge cases
- npm CLI docs: <https://docs.npmjs.com/cli/v10/commands/npm-deprecate> — Why: fallback strategy
- GitHub repo rename: <https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository> — Why: confirm auto-redirect behavior pro `git@github-1agh.com:1aGh/maude.git` (custom SSH host alias!)
- Claude Code marketplace: <https://docs.anthropic.com/en/docs/claude-code/plugin-marketplaces> — Why: chování při změně `name:` v marketplace.json (in case existing installs break)

### Patterns to Follow

Sed-based bulk rename (prior art `docs/MIGRATING-DUGMATE.md` nepřejmenovává nic uvnitř Maude — pouze migruje user projects FROM the old bundled .claude/, takže přímý precedent pro IN-REPO mass rename **neexistuje**). Použít konzervativní recipe:

```sh
# Suchý běh — vidět co se změní (bez akce)
git ls-files | xargs grep -l 'md-claude\|mdcc\|claude-design' \
  | grep -vE '\.next/|node_modules|_history|tool-results|\.mailmap|CHANGELOG\.md' \
  | sort -u

# Postupný replace per kategorie (NIKDY ne jeden mass-sed přes vše):
#   1) string `@1agh/maude` → `@1agh/maude`
#   2) string `md-claude-` (sub-package prefix) → `maude-`
#   3) string `1aGh/maude` (GitHub URL) → `1aGh/maude`
#   4) string `mdcc` → `maude` POUZE v human-facing kontextech (NE v `site/components/mdcc/` cestách, NE v CSS class `mdcc-*`, NE v `~/.config/mdcc/` per decision-b)
#   5) string `@maude/` → `@maude/` (workspace-internal scope; orthogonal k @1agh/maude; postihuje site, hub, dev-server, root scripts.dev:site, .github/workflows/quality.yml)
#   6) string `design@maude`, `flow@maude` → `design@maude`, `flow@maude` (marketplace install syntax v docs, plans, README)
#   7) string `mch_` → `mau_` (hub token prefix per decision-a; pouze v phase-9 plánu, jinde se nevyskytuje)
```

**Keep-list (ani jedna z 1-7 se zde NEAPLIKUJE):**
- `site/components/mdcc/**` filenames + `site/app/mdcc-tokens.css` (decision #2)
- CSS class identifiers `.mdcc-*` a CSS variables `--mdcc-*` (decision #2, decision-e)
- `~/.config/mdcc/` XDG path (decision-b)
- `MD_CLAUDE_SKIP_POSTINSTALL` env var (BC alias 1 cyklus, viz Task 3.5)
- `CHANGELOG.md` historic entries (Task 5.3)
- `.ai/archive/decisions/DDR-*.md` historic records (Task 7.3 caveat)
- `.ai/plans/archive/*` archived plans
- `_history/`, `tool-results/`, `.mailmap`

**Lock-step pravidlo:** version parity script už hlídá `package.json` + 2× `plugin.json` + 7× sub-package `package.json`. Jakýkoli rename musí udržet tento invariant.

---

## Tasks

> Execute in this exact order. Phases jsou závislé. Po každé fázi commit + `pnpm run lint` + `bash scripts/check-version-parity.sh`.

### Phase 0 — Pre-flight (no code changes)

#### Task 0.1: VERIFY `npm unpublish` eligibility

- **Do**: Spustit `npm view @1agh/maude time --json` a zjistit kdy byla v0.14.0 publishe'd
- **Validate**: Pokud `<= 72h od now` → unpublish je možný. Pokud `> 72h` → **přepnout strategii na `npm deprecate`** a updatovat Phase 5 níže
- **Gotcha**: npm má strict 72h policy pro scoped packages. Jediná exception je security takedown — nikoli rebrand. Pokud propadlo okno, deprecate je jediná cesta.
- **Output**: zaznamenat eligibility do `.ai/archive/decisions/` jako DDR ("Why we [unpublish|deprecate] @1agh/maude")

#### Task 0.2: VERIFY GitHub repo rename feasibility

- **Do**: Ověřit, že máš admin přístup k `1aGh/maude` na GitHubu (Settings → Rename repository). Note: SSH remote používá custom host `github-1agh.com` (z `.ssh/config`) — po rename bude `git@github-1agh.com:1aGh/maude.git`.
- **Validate**: `git remote get-url origin` ukáže současný URL; po rename GitHubu spustit `git remote set-url origin git@github-1agh.com:1aGh/maude.git`
- **Gotcha**: GitHub udržuje 301 redirect ze starého repo URL po dobu, dokud někdo nevytvoří nový repo se starým názvem. Bezpečné, ale ne navždy.

#### Task 0.3: REGISTER `@1agh/maude` jako available npm name

- **Do**: `npm view @1agh/maude` — musí vrátit `404 Not Found` (= jméno je volné)
- **Validate**: Pokud někdo už package squatnul, je problém. Mitigation: kontaktovat npm support (squat policy) nebo zvolit jiný brand.
- **Gotcha**: scoped names (`@1agh/*`) jsou pod tvou kontrolou, takže `@1agh/maude` by mělo být volné, dokud sám nepublikoval. Stejně ověřit.

---

### Phase 1 — Core package + plugin manifests

#### Task 1.1: UPDATE `package.json`

- **Do**: 
  - `name` → `@1agh/maude`
  - `description` → "Marketplace of Claude Code plugins by Michal Dovrtěl: `design` + `flow`. Ships **`maude`** CLI (with `mdcc` legacy alias) to scaffold workspace, run the design dev server, and manage configs."
  - `bin` map:
    ```json
    {
      "maude": "cli/bin/maude.mjs",
      "mdcc": "cli/bin/mdcc.mjs",
      "maude-safe": "cli/cli-wrapper.cjs",
      "mdcc-safe": "cli/cli-wrapper.cjs",
      "claude-design-server": "plugins/design/dev-server/server.mjs"
    }
    ```
    (oba bin'y dva — `maude` a `mdcc` — pointují na nové implementace; `claude-design-server` zůstává protože je to jiný service alias.)
  - `scripts.mdcc` → přejmenovat na `scripts.maude` + ponechat `scripts.mdcc` (zachová `pnpm run mdcc` muscle memory)
  - `optionalDependencies` → všech 7 přejmenovat z `@1agh/maude-<slug>` na `@1agh/maude-<slug>`
  - `repository.url`, `homepage`, `bugs.url` → `1aGh/maude` → `1aGh/maude`
  - `keywords` → drop `"maude"`, přidat `"maude"` (`mdcc` ponechat pro vyhledatelnost)
- **Pattern**: 1:1 mapping fields, no schema change
- **Gotcha**: pnpm-workspace.yaml používá glob `packages/*` — po rename adresářů (Phase 2) musí pořád matchnout
- **Validate**: `node -p "require('./package.json').name"` → `@1agh/maude`

#### Task 1.2: UPDATE `.claude-plugin/marketplace.json`

- **Do**: `name: "maude"` → `name: "maude"`. Description přejmenovat z "maude" referencí na "Maude". Plugin sources `./plugins/design`, `./plugins/flow` — beze změny (plugin slugs zůstávají `design` + `flow`).
- **Gotcha**: Existující users `/plugin marketplace add 1aGh/maude` budou muset re-pointnout na `1aGh/maude` — to není naše věc tady, ale v migration docs.

#### Task 1.3: UPDATE plugin manifests

- **Do**: 
  - `plugins/design/.claude-plugin/plugin.json` — `keywords[]`: drop `"maude"`, přidat `"maude"`
  - `plugins/flow/.claude-plugin/plugin.json` — žádná Maude reference (zkontroloval jsem grep — jen schema URL `$schema`)
- **Validate**: `bash scripts/check-version-parity.sh` musí passovat (žádný version drift)

---

### Phase 2 — 7 per-platform binary sub-packages

#### Task 2.1: RENAME `packages/md-claude-*/` → `packages/maude-*/`

- **Do**: 7× `git mv`:
  ```sh
  git mv packages/md-claude-darwin-arm64 packages/maude-darwin-arm64
  git mv packages/md-claude-darwin-x64 packages/maude-darwin-x64
  git mv packages/md-claude-linux-x64 packages/maude-linux-x64
  git mv packages/md-claude-linux-arm64 packages/maude-linux-arm64
  git mv packages/md-claude-linux-x64-musl packages/maude-linux-x64-musl
  git mv packages/md-claude-linux-arm64-musl packages/maude-linux-arm64-musl
  git mv packages/md-claude-win32-x64 packages/maude-win32-x64
  ```
- **Pattern**: zachovat alphabetické pořadí (matches `scripts/bump-version.sh` SUBPACKAGE_PATHS array)
- **Validate**: `ls packages/` ukáže 7× `maude-*`

#### Task 2.2: UPDATE každého ze 7 sub-package `package.json`

- **Do**: V každém:
  - `name`: `@1agh/maude-<slug>` → `@1agh/maude-<slug>`
  - `description`: "for @1agh/maude" → "for @1agh/maude"
  - `repository.url`: `1aGh/maude` → `1aGh/maude`
  - `files: ["mdcc", "README.md"]` → `files: ["maude", "README.md"]` (binary uvnitř se přejmenuje v Phase 3)
- **Gotcha**: každý sub-package má `bin: { "mdcc": "mdcc" }` nebo podobné? Zkontrolovat — pokud ano, rename na `maude`

#### Task 2.3: UPDATE každého ze 7 sub-package `README.md`

- **Do**: 1 řádek nadpisu + 1 řádek description: `maude` → `maude`
- **Pattern**: identické pro všech 7 — lze `sed -i '' 's/md-claude/maude/g' packages/maude-*/README.md` (mac sed)

---

### Phase 3 — CLI binary rename (mdcc → maude primary + mdcc shim)

#### Task 3.1: RENAME `cli/bin/mdcc.mjs` → `cli/bin/maude.mjs`

- **Do**: `git mv cli/bin/mdcc.mjs cli/bin/maude.mjs`. Pak edit obsah:
  - Comment header: `// mdcc — Maude CLI.` → `// maude — Maude CLI.`
  - Error message: `mdcc: unknown command "${cmd}"` → `maude: unknown command "${cmd}"` (taky `Run \`maude help\``)
  - Error message: `mdcc: ${err.message}` → `maude: ${err.message}`
- **Pattern**: žádná logic change, jen branding stringů

#### Task 3.2: CREATE nový `cli/bin/mdcc.mjs` jako legacy shim

- **Do**: Vytvořit nový soubor:
  ```js
  #!/usr/bin/env node
  // mdcc — legacy alias for `maude`. Prints deprecation warning, forwards args.
  // Will be removed in v0.17.x. Use `maude` directly.
  process.stderr.write(
    'mdcc: ⚠ `mdcc` is deprecated. Use `maude` instead. This alias will be removed in v0.17.x.\n'
  );
  await import('./maude.mjs');
  ```
- **Pattern**: thin shim — keep zero logic, max forward-compat

#### Task 3.3: RENAME `cli/bin/mdcc.exe` → `cli/bin/maude.exe`

- **Do**: `git mv cli/bin/mdcc.exe cli/bin/maude.exe`. Edit obsah (je to shell script placeholder — DDR-015):
  - `@1agh/maude` → `@1agh/maude` (všechny refs)
  - `mdcc-safe` → `maude-safe` (taky `mdcc-safe` jako fallback alias)
  - Heading echo: `mdcc` → `maude` (s `mdcc` alias note)
- **Gotcha**: tohle není skutečné .exe — je to bash placeholder co se přepíše postinstall hardlinkem. Viz DDR-015.

#### Task 3.4: CREATE `cli/bin/mdcc.exe` jako shim na `maude.exe`

- **Do**: Stejný pattern jako 3.2 — thin shim co prints deprecation + delegates
- **Gotcha**: Windows shells (cmd.exe, PowerShell) musí mít spustitelný entry — držet bash + nechat install.cjs hardlinkovat platform-correct binary

#### Task 3.5: UPDATE `cli/install.cjs`

- **Do**: 
  - Comment header: `Postinstall: resolve the matching @1agh/maude-<slug>` → `@1agh/maude-<slug>`
  - `pkg = \`@1agh/maude-${slug}\`` → `pkg = \`@1agh/maude-${slug}\``
  - `filename = process.platform === 'win32' ? 'mdcc.exe' : 'mdcc'` → `'maude.exe' : 'maude'`
  - Všechny error messages `@1agh/maude` → `@1agh/maude`
  - Path check: `'packages', 'md-claude-darwin-arm64'` → `'packages', 'maude-darwin-arm64'`
  - Log message: `registered ${slug} binary` → keep, ale prefix `maude:` místo `@1agh/maude:`
  - Env var `MD_CLAUDE_SKIP_POSTINSTALL` → přidat alias `MAUDE_SKIP_POSTINSTALL` (oba akceptovat 1 cyklus)
- **Pattern**: mirror Phase 1.1 změn

#### Task 3.6: UPDATE `cli/cli-wrapper.cjs`

- **Do**:
  - Header comment: `mdcc-safe` → `maude-safe` (primary) + zmínit `mdcc-safe` alias
  - `pkg = \`@1agh/maude-${slug}\`` → `@1agh/maude-${slug}`
  - filename: `mdcc.exe' : 'mdcc'` → `'maude.exe' : 'maude'`
  - Error messages: `@1agh/maude` → `@1agh/maude`
- **Validate**: `node cli/cli-wrapper.cjs --version` (po publish) musí vyresolvovat platform binary

#### Task 3.7: UPDATE `cli/commands/help.mjs`

- **Do**:
  - Heading: `mdcc — Maude CLI` → `maude — Maude CLI (legacy alias: mdcc)`
  - Všechny example commands `mdcc init` → `maude init`, atd.
  - GitHub URL: `https://github.com/1aGh/maude` → `https://github.com/1aGh/maude`

#### Task 3.8: UPDATE `cli/commands/version.mjs`

- **Do**: Output line `mdcc ${pkg.version}` → `maude ${pkg.version}` (the `(${pkg.name})` part bude automaticky `@1agh/maude` po Phase 1.1)

#### Task 3.9: UPDATE `cli/commands/config.mjs`

- **Do**: Error message `mdcc config get <dotted.key>` → `maude config get <dotted.key>` (3 výskyty po grep)

#### Task 3.10: UPDATE `cli/commands/design.mjs` + `cli/commands/init.mjs`

- **Do**: Stringové reference `mdcc` → `maude`, `maude` → `maude` v print outputech + comments. `init.mjs` má specifically GitHub URL pro `$schema` rewrite — update to `1aGh/maude`.
- **Gotcha**: `init.mjs` scaffolduje cizí projekty. Po této změně ALL new `.ai/workflows.config.json` v cizích repech budou mít `$schema` pointing to `1aGh/maude`. GitHub redirect zajistí, že staré scaffolded soubory s `1aGh/maude` schemou pořád fungují.

---

### Phase 4 — Release scripts + CI workflows

#### Task 4.1: UPDATE `scripts/bump-version.sh`

- **Do**: `SUBPACKAGE_PATHS` array — 7× `packages/md-claude-<slug>/package.json` → `packages/maude-<slug>/package.json`
- **Validate**: dry-run `bash scripts/bump-version.sh patch` (nepatchovat, jen ověřit, že script najde všechny path'y)

#### Task 4.2: UPDATE `scripts/check-version-parity.sh`

- **Do**: stejný `SUBPACKAGE_PATHS` array
- **Validate**: `bash scripts/check-version-parity.sh` musí passovat (po Phase 1-3)

#### Task 4.3: UPDATE `scripts/check-tarball-shape.sh` + `scripts/install.sh`

- **Do**: Grep + replace `maude` references. `install.sh` pravděpodobně instruuje `npm i -g @1agh/maude` → `@1agh/maude`.

#### Task 4.4: UPDATE `.github/workflows/build-binaries.yml`

- **Do**: Matrix entries `md-claude-<slug>` → `maude-<slug>`. Artifact names. Any hardcoded `@1agh/maude-*` references.
- **Gotcha**: Po rename nesmí workflow zlomit existing release pipeline. Pečlivě zkontrolovat matrix strategy.

#### Task 4.5: UPDATE `.github/workflows/quality.yml` + `version-parity.yml` + `publish.yml`

- **Do**: 
  - `quality.yml`: grep references `maude` (běží lint/test)
  - `version-parity.yml`: žádné Maude reference v shell script (script sám se updatuje v 4.1/4.2)
  - `publish.yml`: package name v `npm publish` calls — likely odvozeno z `package.json` takže by mělo být auto. Ověřit.

#### Task 4.6: UPDATE `.github/ISSUE_TEMPLATE/{bug,feature,config}.yml`

- **Do**: Any "maude" textual references v issue templates

---

### Phase 5 — Documentation (top-level)

#### Task 5.1: REWRITE `README.md` (top-level)

- **Do**: Title heading, install command, all `mdcc` examples → `maude`. Add "Migrating from `maude`" section pointing to `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`. Note: `claude-design-server` alias section může být droppe'd (legacy z pre-Maude éry, neslouží už nikomu).
- **Pattern**: keep tone, just rebrand

#### Task 5.2: REWRITE `CLAUDE.md`

- **Do**: All "md-claude marketplace" → "Maude marketplace". `mdcc` references → "the `maude` CLI (legacy `mdcc` alias still works)". Update `npm i -g @1agh/maude` install line. Keep `mdcc` v CLI examples kde je v code-path comment (DDR-015 atd. uvnitř kódu zachováme historic context).
- **Gotcha**: CLAUDE.md je load-bearing pro budoucí Claude sessions. Po této editaci EVERY future session uvidí Maude jako autoritativní brand.

#### Task 5.3: UPDATE `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`

- **Do**: 
  - `CONTRIBUTING.md`: brand references, install commands
  - `SECURITY.md`: brand references
  - `CHANGELOG.md`: **NEPŘEPISOVAT historii** — pouze přidat nový top entry pro 0.15.0 release s rename notes. Historie zůstává `maude` jak byla.

#### Task 5.4: UPDATE `pnpm-workspace.yaml` + `biome.json` + `.mailmap`

- **Do**:
  - `pnpm-workspace.yaml`: `packages/md-claude-*` glob → `packages/maude-*` (pokud explicit; pokud `packages/*` glob, nemění se)
  - `biome.json`: jakékoli Maude reference (jen comment, ne config) → maude
  - `.mailmap`: ponechat (mapuje email identity, ne project name)

#### Task 5.5: CREATE `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`

- **Do**: Nový migration guide pro existující uživatele:
  ```markdown
  # Migrating from `maude` to `Maude`
  
  This project was renamed from `maude` to `Maude` in v0.15.0.
  
  ## What changed
  - npm package: `@1agh/maude` → `@1agh/maude` (old package unpublished)
  - GitHub repo: `1aGh/maude` → `1aGh/maude` (auto-redirected by GitHub)
  - CLI binary: `mdcc` → `maude` (with `mdcc` legacy alias until v0.17.x)
  - Marketplace name: `maude` → `maude`
  
  ## How to migrate
  
  ### 1. Reinstall CLI
  ```sh
  npm uninstall -g @1agh/maude
  npm install -g @1agh/maude
  ```
  
  ### 2. Update Claude Code marketplace
  ```
  /plugin marketplace remove md-claude
  /plugin marketplace add 1aGh/maude
  ```
  
  ### 3. Existing `mdcc` commands keep working
  Until v0.17.x. They print a deprecation warning. Switch to `maude` at your pace.
  
  ### 4. Existing `.ai/workflows.config.json` `$schema` URLs
  Old URLs (`raw.githubusercontent.com/1aGh/maude/...`) still resolve via GitHub's 301 redirect. New `mdcc init` / `maude init` runs scaffold the new URL.
  ```
- **Validate**: viewable on `npmjs.com/package/@1agh/maude` + `github.com/1aGh/maude`

#### Task 5.6: UPDATE `docs/MIGRATING-DUGMATE.md`

- **Do**: `@1agh/maude` → `@1agh/maude` (1 install command), `flow@maude` → `flow@maude` (marketplace ref), `1aGh/maude` → `1aGh/maude`. Note: tenhle dokument je migration guide pro Dugmate, ne pro md-claude→Maude. Jen update brand references.

---

### Phase 6 — Plugin internals (templates, skills, commands, dev-server)

#### Task 6.1: UPDATE `plugins/design/dev-server/`

- **Do**: Grep všech md-claude/mdcc references a update:
  - `canvas-lib-resolver.ts` — comment refs
  - `canvas-build.ts` — comment refs
  - `canvas-lib.tsx` — comment refs (e.g. import paths in JSDoc)
  - `canvas-lib-inline.ts` — comment refs
  - `build.ts`, `handoff.ts` — comment refs
  - `package.json` (dev-server own) — **`name: "@maude/dev-server"` → `"@maude/dev-server"`** + description
  - `.npmignore` — comment refs
  - `bin/canvas-edit.sh` — comment refs (helper script)
  - All `test/*.ts` — comment refs only, no logic changes
- **Pattern**: pouze stringy v comments + log outputs. Code logic se nemění. Workspace name change (recipe-5) **breaks `pnpm --filter @maude/dev-server …`** — grep + update všechny callers (root `package.json` scripts, `.github/workflows/*.yml`).

#### Task 6.2: UPDATE `plugins/design/dev-server/client/app.jsx`

- **Do**: Comment refs + any user-facing strings (e.g. server banner "md-claude dev server" → "Maude dev server")

#### Task 6.3: UPDATE `plugins/design/templates/`

- **Do**:
  - `canvas.tsx.template` — comment refs
  - `design-system-inspiration/_README.md` — references to Maude project
  - `design-system-inspiration/core/config.json.tpl` — comment refs
  - `design-system-inspiration/audience-developer/*.html` — md-claude/mdcc text content v inspiračních příkladech (specifically `components-code-block.html` and `components-terminal-pane.html`)
- **Gotcha**: tyto templates jsou scaffolded do cizích projektů přes `/design:setup-ds`. Po renamu projektů budou nově generované inspiration files mít `maude` jako brand. **Existující inspiration files v cizích repech NEUPDATUJEME** — to není naše věc.

#### Task 6.4: UPDATE `plugins/design/skills/`

- **Do**:
  - `design/SKILL.md` — mdcc/md-claude refs
  - `design-system/SKILL.md` — mdcc/md-claude refs
  - `ui-kit/SKILL.md` — mdcc/md-claude refs

#### Task 6.5: UPDATE `plugins/design/commands/`

- **Do**: `init.md`, `new.md`, `handoff.md`, `setup-docs.md` — brand refs

#### Task 6.6: UPDATE `plugins/design/hub/README.md`

- **Do**: Brand refs

#### Task 6.7: UPDATE `plugins/flow/`

- **Do**: 
  - `.claude-plugin/config.schema.json` — `$schema` self-reference (pokud má GitHub URL k sobě)
  - `commands/init.md`, `commands/release.md` — brand refs
  - `templates/ai-skeleton/README.md` — brand refs

#### Task 6.8: UPDATE `plugins/design/hub/` (reserved future workspace)

- **Do**:
  - `plugins/design/hub/package.json` — `"name": "@maude/hub"` → `"@maude/hub"`
  - `plugins/design/hub/README.md` — title `# @maude/hub (reserved)` → `# @maude/hub (reserved)` + body refs
- **Gotcha**: workspace ještě není implementovaný (Phase 9). Toto je future-proofing — když Phase 9 přijde, plán a všechny dependent reference (Docker image, Fly app name, systemd unit, token prefix) už budou maude-branded.

---

### Phase 7 — Site (Next.js docs) + self-dogfooding (.design/, .ai/)

#### Task 7.1: UPDATE `site/`

- **Do**: Site má **~70 souborů s brand referencemi** (ne 5 jak zní původní seznam). Postup:
  1. **Workspace name first**: `site/package.json` — `@maude/site` → `@maude/site`. Update všechny callers (`package.json` root `scripts.dev:site`, `.github/workflows/quality.yml` 4× `pnpm --filter @maude/site`, `.ai/release-guide.md` 2×, `README.md`, `site/README.md`, `site/content/docs/reference/index.mdx`).
  2. **Bulk content sweep** (recipe-1 až -6 z "Patterns to Follow"):
     ```sh
     find site/{content,lib,app,components} -type f \
       \( -name '*.tsx' -o -name '*.ts' -o -name '*.mdx' -o -name '*.md' \
          -o -name '*.json' -o -name '*.css' \) \
       -not -path '*/components/mdcc/*' \
       -not -name 'mdcc-tokens.css' \
       | xargs grep -lE 'md-claude|@1agh/maude|1aGh/maude|@md-claude'
     # iterate per-pattern, NIKDY mass-sed (viz "Patterns to Follow")
     ```
  3. **Explicitní wave** (high-traffic): `site/README.md`, `site/app/layout.tsx`, `site/app/(home)/page.tsx`, `site/app/(home)/about/page.tsx`, `site/app/docs/[[...slug]]/page.tsx`, `site/app/global.css`, `site/app/robots.txt/route.ts`, `site/lib/{layout.shared.tsx,shared.ts,stats.json}`, `site/components/mdx.tsx`.
  4. **MDX content**: `site/content/docs/{index,getting-started,cli,config,flow}.mdx`, `site/content/docs/design/{index,bootstrap,categories}.mdx`, `site/content/docs/recipes/{nextjs,monorepo,expo}.mdx`, `site/content/docs/reference/{config-schema,index}.mdx`, `site/content/docs/reference/design/*.mdx` (~15), `site/content/docs/reference/flow/*.mdx` (~25), `site/content/docs/meta.json`.
- **Gotcha**: **Neměnit** `site/components/mdcc/*` filenames, `site/app/mdcc-tokens.css`, CSS class `.mdcc-*`, CSS var `--mdcc-*` (decision #2 + decision-e). Komentáře *uvnitř* těchto souborů, které odkazují na "maude" jako brand, **update'nout** — namespace zůstává jako interní identifier, ale brand reference v dokumentačních komentářích ne.
- **Validate**: 
  - `pnpm --filter @maude/site build` PASS (po name change; `.next/` smazat před rebuild)
  - `pnpm --filter @maude/site sync:tokens:check` PASS
  - `pnpm --filter @maude/site gen:reference && pnpm --filter @maude/site gen:stats` PASS (generators musí najít plugin paths)
  - Final grep: `grep -rE 'md-claude|@1agh/maude' site/ --exclude-dir=node_modules --exclude-dir=.next` vrátí 0 mimo keep-list

#### Task 7.2: UPDATE `.design/` (self-dogfooding)

- **Do**:
  - `.design/config.json` — `name` / branding refs
  - `.design/README.md`, `.design/INDEX.md`
  - `.design/ui/Docs Site.tsx`, `.design/ui/Docs Site.registry.json` — TSX file co modeluje site landing; copy mentions md-claude
  - `.design/ui/Canvas Viewport.tsx`, `.design/ui/Canvas Viewport.meta.json`
  - `.design/ui/Smoke TSX.tsx`, `.meta.json`
  - `.design/system/project/SKILL.md`, `README.md`, `colors_and_type.css`
  - `.design/system/project/preview/*` — všechny `.tsx` + `.meta.json` + `.css` (jen brand stringy, ne tokeny)
  - `.design/system/project/assets/logos/wordmark.svg` — pokud obsahuje text "maude"
- **Pattern**: design canvas files jsou self-dogfooding — jsou to "real" canvases Maude projektu. Brand refs v textech update'nout, vizuální assets (logo) zachovat (logo SVG má vlastní brand mark; pokud má embedded text "maude", regenerovat).
- **Gotcha**: `.design/_history/*` — **NEUPDATOVAT**. Snapshot stack je read-only history.

#### Task 7.3: UPDATE `.ai/` (self-dogfooding)

- **Do**:
  - `.ai/INDEX.md`, `.ai/README.md`, `.ai/release-guide.md` — brand refs
  - `.ai/workflows.config.json` — `name: "maude"` → `name: "maude"`
  - `.ai/docs/PRD.md`, `.ai/docs/config-schema.md`, `.ai/docs/research-*.md` — brand refs
  - `.ai/archive/decisions/DDR-*.md` — **JEN editovat ty, kde brand reference je critically misleading**. DDR jsou historic record — pokud DDR-015 říká "@1agh/maude-<slug>", to je historic fact. Conservative approach: nepřepisovat DDR souborů.
  - `.ai/plans/*.md` — active plans → update. Archived plans → leave alone.
  - `.ai/state/STATE.md` — brand refs
- **Plans s největší koncentrací refs (audit 2026-05-20)** — projít s explicitní pozorností, recipe-4 (`mdcc → maude`) sám nestačí:
  - `.ai/plans/README.md` — má `/plugin install design@maude` + `/plugin install flow@maude` (recipe-6); root branding `# Maude v1.0 → v1.2+`
  - `.ai/plans/phase-9-self-hosted-hub-file-sync.md` — **největší blob (~30 refs)**: 2× `@maude/hub` (workspace, recipe-5), 2× `ghcr.io/1agh/md-claude-hub` (Docker image; per **decision-c** rename na `ghcr.io/1agh/maude-hub`), 4× `mch_<hex>` token prefix (per **decision-a** rename na `mau_`), 2× `~/.config/mdcc/hubs.json` (per **decision-b** KEEP), 1× `mdcc-hub.service.template` (per **decision-d** rename na `maude-hub.service.template`), 1× `md-claude-hub-foo.fly.dev` example URL (rename na `maude-hub-foo.fly.dev`), všechny `mdcc <cmd>` CLI examples (recipe-4)
  - `.ai/plans/phase-13-canvas-activity-overlay.md` — 2× `--mdcc-activity` CSS var (per **decision-e** + decision #2 KEEP, ale doplnit jednořádkový comment vysvětlující že namespace je intentional)
  - `.ai/plans/phase-15-video-pipeline-toolchain.md` — ~10× `mdcc` v CLI examples + tape scripts (recipe-4); 1× root branding "md-claude maintainer" (recipe-1 ekvivalent v textu)
  - `.ai/plans/phase-15.5-marketing-demo-video-30s.md` — ~15× brand stringů včetně **`maude.sh` domain** (per **decision-f** + Task 8.6: rename na `maude.sh` + 301 redirect), wordmark text v IntroCard.tsx, copy "Docs at maude.sh", scene captions, README install line, GitHub URL
  - `.ai/plans/phase-7-acp-chat-sidebar.md`, `.ai/plans/phase-8-live-collaboration-yjs-lan.md`, `.ai/plans/phase-6.5-export.md` — `mdcc <cmd>` CLI examples (recipe-4 stačí)
- **Gotcha**: jako u `.design/_history/`, history-typed files (DDRs, archived plans) **nemusí** být upgrade'd. To je historic context. Drobná inkonzistence acceptable.

---

### Phase 8 — Release + publish (post-merge)

> **Tyto kroky se exekuují AFTER PR merge na main.** Nejsou součástí code change.

#### Task 8.1: Rename GitHub repo

- **Do**: GitHub UI → Settings → Repository name → `maude` → `maude` → Rename. 
- **Post**: Lokálně `git remote set-url origin git@github-1agh.com:1aGh/maude.git`. Test `git fetch`.
- **Gotcha**: Existing PRs / issues zůstanou redirected. CI badges co používají `1aGh/maude/...` URLs zůstanou funkční přes 301.

#### Task 8.2: Bump verze na 0.15.0

- **Do**: `bash scripts/bump-version.sh 0.15.0`
- **Validate**: `bash scripts/check-version-parity.sh`
- **Commit**: `chore: release v0.15.0 — Maude rebrand`

#### Task 8.3: Build a publish

- **Do**: `git tag v0.15.0 && git push --follow-tags`
- **Trigger**: `.github/workflows/publish.yml` automaticky:
  - Re-run parity check
  - Build 7 platform binaries
  - Publish 7× `@1agh/maude-<slug>` sub-packages
  - Publish `@1agh/maude` main package
- **Validate**: `npm view @1agh/maude version` → `0.15.0`

#### Task 8.4: `npm unpublish` old packages (eligibility-gated)

- **Do**: Pokud Phase 0.1 verified eligibility (≤72h od 0.14.0 release):
  ```sh
  npm unpublish @1agh/maude@0.14.0
  npm unpublish @1agh/maude-darwin-arm64@0.14.0
  # ... opakovat pro všech 7 sub-packages + ostatních historic versions, pokud jsou v 72h okně
  ```
  Pokud Phase 0.1 vrátil ineligible:
  ```sh
  npm deprecate '@1agh/maude@*' 'Renamed to @1agh/maude. Run: npm i -g @1agh/maude'
  npm deprecate '@1agh/maude-darwin-arm64@*' 'Renamed to @1agh/maude-darwin-arm64'
  # ... opakovat pro všech 7
  ```
- **Gotcha**: Po `npm unpublish` jméno `@1agh/maude` je permanentně zablokované pro re-publish (npm policy). Tedy nikdy v budoucnu nelze "vzít zpět" rename a publishnout pod starým jménem.

#### Task 8.5: Update GitHub Release notes

- **Do**: V GitHub UI → Releases → v0.15.0 → write release notes pointing k `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md`

#### Task 8.6: Domain setup `maude.sh` (per decision-f)

- **Do**:
  1. **DNS**: u registrátora domény `iagh.cz` přidat `CNAME maude → cname.vercel-dns.com` (nebo A record pokud apex; Vercel docs).
  2. **Vercel**: project → Domains → Add `maude.sh` (primary). Vercel auto-vystaví Let's Encrypt cert do ~minuty.
  3. **Legacy redirect (pokud `maude.sh` existuje a má traffic)**: Vercel project → Domains → ponechat `maude.sh` connected, ale nastavit `vercel.json` redirect:
     ```json
     { "redirects": [{ "source": "/(.*)", "destination": "https://maude.sh/$1", "permanent": true, "has": [{ "type": "host", "value": "maude.sh" }] }] }
     ```
     Pokud `maude.sh` user nevlastní/neexistuje → skip celý step 3.
  4. **Site config**:
     - `site/app/sitemap.ts` + `site/app/robots.txt/route.ts` — canonical host `maude.sh`
     - `site/lib/shared.ts` / `site/lib/layout.shared.tsx` — `siteUrl` / `metadataBase` na `https://maude.sh`
     - `next.config` / `site/next.config.ts` — pokud má `metadataBase` env
  5. **Update content references** napříč repo: `maude.sh` → `maude.sh` (3× v `phase-15.5-marketing-demo-video-30s.md` + případně v `README.md`, `site/content/docs/index.mdx`, `package.json` `homepage`)
- **Gotcha**: 
  - **Subdomain pod `iagh.cz` znamená SEO reset** — Google si bude muset reindexovat, link equity z `maude.sh` se přenáší jen přes 301. Acceptable pro indie/early projekt.
  - Doménový rename **musí proběhnout PŘED Phase 15.5 implementací** (jinak video by se točilo se starým hostem).
  - `iagh.cz` je personal domain — public docs site pod ní signalizuje "indie/maintainer-owned", což může nebo nemusí být brand-aligned. Pokud user chce v budoucnu posunout na dedicated `maude.dev` / `maude.io`, dnešní `maude.sh` zůstane jako redirect.
- **Output**: zaznamenat status (DNS propagated, cert active, redirect OK) do DDR (či přímo do migration docs).

---

## Validation

Po každé Phase commit. Po všech Phases (před merge), spustit kompletní validation pipeline:

1. **Lint**: `pnpm run lint` (biome check)
2. **Tests**: 
   - `pnpm run test` (cli tests)
   - `pnpm run test:dev-server` (bun tests v plugins/design/dev-server/test/)
3. **Build**: `pnpm run build` (-r --if-present)
4. **Version parity**: `bash scripts/check-version-parity.sh` (musí PASS po Phase 1 + 2)
5. **Tarball shape**: `bash scripts/check-tarball-shape.sh` (validuje `files` array vs realita)
6. **Site build**: `pnpm --filter @maude/site build` (po Phase 7)
7. **CLI smoke**:
   - `node cli/bin/maude.mjs --version` → `maude 0.15.0 (@1agh/maude)`
   - `node cli/bin/mdcc.mjs --version` → vypíše deprecation warning + version
   - `node cli/bin/maude.mjs help` → help screen s `maude` examples
   - `node cli/bin/mdcc.mjs help` → warning + help (alias funkční)
8. **Dev-server smoke**: `node plugins/design/dev-server/server.mjs --root /tmp/scratch-with-design` (musí bootnout, ne crash)
9. **Repository link sanity**: Otevřít `package.json` `repository.url` v browseru — má vést na 404 nebo na nový repo (po GitHub rename). Před rename: 200 OK na old URL.

---

## Scenario Coverage (UI tasks — N/A)

Tento rename **NEMÁ UI work** — žádný visual change, žádný uživatelský flow. Cross-platform scenario není potřeba. Kontrola DS Guard a a11y-auditor také nezatlačí (nemění se vykreslené UI).

---

## Acceptance Criteria

- [ ] Všech 8 Phase tasks dokončeno v pořadí
- [ ] `pnpm run lint` PASS
- [ ] `pnpm run test` + `pnpm run test:dev-server` PASS
- [ ] `pnpm run build` PASS
- [ ] `bash scripts/check-version-parity.sh` PASS (po Phase 1-3)
- [ ] `bash scripts/check-tarball-shape.sh` PASS
- [ ] `pnpm --filter @maude/site build` PASS (po Phase 7)
- [ ] CLI smoke test: `maude --version`, `mdcc --version` (s warning), `maude help`, `mdcc help` všechny fungují
- [ ] `docs/MIGRATING-MD-CLAUDE-TO-MAUDE.md` napsaný a linked z README + CHANGELOG
- [ ] Grep ověření: `grep -rE "md-claude|@1agh/maude|@md-claude|design@maude|flow@maude" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=_history --exclude-dir=archive --exclude-dir=.next` vrací 0 výsledků MIMO:
  - `CHANGELOG.md` (historic entries)
  - `docs/MIGRATING-*.md` (migration guides musí mít starý název v explanation)
  - `.ai/archive/decisions/` (historic DDR records)
  - `.ai/plans/archive/` (archived plans)
  - `cli/install.cjs` (akceptuje `MD_CLAUDE_SKIP_POSTINSTALL` env var jako BC alias 1 cyklus)
  - `site/components/mdcc/` filenames + CSS `.mdcc-*` + `--mdcc-*` vars + `site/app/mdcc-tokens.css` (decision #2 + decision-e)
  - `~/.config/mdcc/` XDG path reference v phase-9 plánu (decision-b)
- [ ] Grep ověření per-pattern: 
  - `grep -rE "mch_" .ai/plans/` vrací 0 (decision-a aplikován)
  - `grep -rE "md-claude-hub|maude-hub" .ai/plans/phase-9*` jen `maude-hub` (decision-c + d)
  - `grep -rE "md-claude\.dev" .ai/plans/ site/ README.md` vrací 0 mimo migration explanation (decision-f); všechny canonical URLs ukazují na `maude.sh`
- [ ] Post-merge (Phase 8) tasks proběhly: GitHub repo renamed, npm published `@1agh/maude@0.15.0` + 7 sub-packages, old packages unpublished/deprecated
- [ ] Žádné regression v `version-parity.yml` CI check
- [ ] DDR napsaný: `.ai/archive/decisions/DDR-NNN-rename-md-claude-to-maude.md` zachycující rozhodnutí (1) `maude` primary + `mdcc` alias, (2) keep `mdcc-*` CSS namespace, (3) unpublish vs deprecate decision (per actual eligibility), (4) single atomic PR rollout

---

## Risks & Open Questions

1. **`npm unpublish` 72h window** — Phase 0.1 určí strategii. Pokud propadlo, deprecate. Materiální dopad: po deprecate user `npm i @1agh/maude` dostane warning ale instalace projde — tj. **uživatelé budou pořád stahovat starou verzi** dokud explicitně nepřejdou na `@1agh/maude`. Acceptable, ale brzdí adoption rebrandu.

2. **Marketplace `name:` change** — Není 100% jasné, jak Claude Code reaguje, když existující marketplace install má `name: "maude"` a fetchne update kde `name: "maude"`. Worst case: user musí `/plugin marketplace remove Maude && /plugin marketplace add 1aGh/maude`. Migrating doc to explain.

3. **Custom SSH host alias** — `git@github-1agh.com:1aGh/maude.git` používá `github-1agh.com` (custom Host v `~/.ssh/config`). Po GitHub repo rename SSH funguje (host se nemění, jen path), ale je to user-specific setup co nebudou mít ostatní contributors.

4. **`mdcc` muscle memory** — uživatelé (včetně tebe) mají `mdcc` napsané v skriptech, .zshrc aliasech, docs, blog postech. Legacy alias řeší 90 %, ale finální drop v 0.17.x bude breaking event.

---

## Retro (2026-05-20, /flow:done)

**What worked:**
- Plan's "4 decisions baked in" frontload was a force-multiplier. Zero re-litigation during execution — every "wait, should this stay?" had an answer at the top. Sub-decisions a–f for forward plans (phase 9 hub, phase 13 overlay, phase 15.5 video) prevented re-introducing `md-claude` strings the moment those plans run.
- Phase 0 pre-flight saved a downstream pivot. The npm v0.14.0 publish was 7h old when /execute fired → unpublish remained viable → no scramble to switch to the deprecate fallback Phase 5 / Phase 8.4 had drafted.
- DDR-032 sub-decision 2 (keep `mdcc-*` CSS namespace + `~/.config/mdcc/`) cut the diff by an estimated 20–30 % of low-value churn. The catalog-stamp `MDCC-DSN/01` SKU convention rode along with it — no special-casing needed.
- The recipe-by-recipe sed approach (per-pattern, not one mass sed) caught the regex escape pitfall in `canvas-lib-resolver.ts` / `canvas-lib-inline.ts` / `canvas-build.ts` (escaped `\/` survived a naive pattern). One round of follow-up was enough.

**What didn't:**
- The `@mdcc/canvas-lib` decision flipped mid-execution. Plan said "keep as internal namespace per decision-2"; user override during /done set it to rename → 27 files re-swept, regex constants found late, and the rationale in CLAUDE.md + MIGRATING-* + DDR-032 had to be back-edited from "preserved" to "renamed". The plan should have probed this earlier — virtual specifiers were grouped with CSS namespaces under decision-2 without explicit distinction. Lesson: enumerate every `mdcc-*`/`@mdcc-*`/`mdcc.*` shape during plan capture, decide per-shape, not per-category.
- The first iteration of bulk sed used `for f in $FILES; do ...; done` with unquoted `$FILES`, which exploded on paths with brackets (`site/app/og/docs/[...slug]/route.tsx`). Switched to `find -print0 | while IFS= read -r -d ''` partway through. Lost ~5 min debugging "why didn't it match" when the answer was the bracketed path silently broke iteration.
- One sed expression (`s|: 'mdcc|: 'maude|`) inadvertently used `|` as both delimiter AND in the pattern, producing "bad flag in substitute command" and aborting the whole multi-`-e` chain. Switched to `/` delimiter for that single pattern. Single sed errors should be isolated to one `-e`, not bundled — if one fails, none apply.
- The two-sweep approach in `.ai/` mass-rewrote some history (STATE.md historic entries got `md-claude → Maude` rewrites). Strictly speaking historic; defensibly historic. But the exclusion globs should have been more aggressive — `-not -path '*/state/*'` would have preserved the time-series correctness.

**What to change in /plan or /execute next time:**
- For brand renames spanning >50 files, capture **every distinct shape** of the old brand string up-front — not just `md-claude` and `mdcc`, but also `@mdcc-foo`, `MD_CLAUDE_BAR`, `mch_<hex>`, etc. Each shape gets an explicit "rename / keep / decide-later" verdict in a table. Plan-time decision is 10× cheaper than execute-time pivot.
- Always use `find -print0 | while IFS= read -r -d ''` for bulk file iteration. Make this a `flow:execute` Pattern reference.
- Bundle sed expressions only when delimiters are uniform and patterns don't risk one-failure-aborts-chain. For uneven patterns, use one sed invocation per expression — minor perf hit, much better isolation.
- When a sweep covers state/history-shaped files (STATE.md, *.log), exclude them by path explicitly. Historic correctness matters more than rename completeness for those files.

**Pivots during execution:**
- `@mdcc/canvas-lib` → `@maude/canvas-lib` (user override, mid-/done) — see above.
- Pending changeset files (`@1agh/md-claude` patch/minor entries) — rewritten to `@1agh/maude` so they compose against the renamed package.
- `bun.lock` regenerated after `@md-claude/dev-server` → `@maude/dev-server` workspace rename — required `rm bun.lock && bun install`.
