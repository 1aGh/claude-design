---
name: feature-site-roadmap
status: done
created: 2026-05-22
completed: 2026-05-25
decisions: []
---

# Feature: Site `/roadmap` — vertikální timeline napojená na `.ai/`

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Přidat na `site/` (Next.js + Fumadocs) novou route `/roadmap`, která renderuje vertikální paper/phosphor timeline všech fází Maude — minulých (done), aktuální (in-progress), plánovaných (planned) i icebox. Zdroj pravdy je `.ai/state/STATE.md` (history) + `.ai/plans/*.md` (active) + `.ai/plans/archive/*.md` (done) + `.ai/plans/README.md` (ship target a dependency context). Build pipeline `site/scripts/build-roadmap.mjs` čte ty soubory a píše `site/lib/roadmap.json`, který komponenta na `/roadmap` importuje stejně jako landing page importuje `stats.json`.

Auto-update na `/flow:done` se nedělá modifikací plugin-commandu — místo toho se do `CLAUDE.md` (a release-guide jako safety net) napíše krátké pravidlo: kdykoliv agent archivuje plán nebo dopíše řádek do STATE.md History, regeneruje `site/lib/roadmap.json` a zařadí ho do téhož commitu. Agent si toho všimne sám díky tomu, že pravidlo je přímo v CLAUDE.md, který je vždycky v kontextu.

## User Story

Jako Maude maintainer chci na `maude.iagh.cz/roadmap` vidět hezkou timeline všech fází — co je doneseno (s datem), co se právě dělá, co je v plánu, co je icebox — aby návštěvníci sajtu viděli vývoj projektu na jedné stránce a já abych nemusel ručně synchronizovat sajt po každém `/flow:done`.

## Problem

- Roadmap dnes žije jen v `.ai/plans/README.md` (dependency graph + execution table) a v `STATE.md` History tabulce. Není viditelná veřejně.
- Po každém `/flow:done` se archivuje plán + přidává History row, ale sajt nereflektuje. Manuální synchronizace = drift.
- Site už má pattern pro auto-generované datasety (`site/lib/stats.json` via `site/scripts/build-stats.mjs`, commitnuté kvůli Vercel deploy isolation). Tenhle pattern lze rozšířit.

## Solution

1. **Build script** `site/scripts/build-roadmap.mjs` — čte `.ai/plans/*.md`, `.ai/plans/archive/*.md`, `.ai/state/STATE.md` (History tabulku), `.ai/plans/README.md` (Execution order tabulku pro ship target + can-parallelize); produkuje `site/lib/roadmap.json` se strukturou `{ generated, phases: [{id, title, status, shipTarget, dateOrEta, branch?, summary, planPath, archived}] }`.
2. **Route** `site/app/(home)/roadmap/page.tsx` — server component, importuje `roadmap.json`, renderuje vertikální timeline ve stejném paper/phosphor DS jako home page (`.mdcc-*` třídy + `--accent`, hard-edges, monospace SKU labely).
3. **Komponenta** `site/components/mdcc/roadmap-timeline.tsx` — bezstavová prezentace seznamu fází jako vertikální stuha se status glyphem (`[x] / [~] / [ ] / [❄]`), datem, jednořádkovým summary, odkazem na plan (nebo na archive).
4. **Auto-update hook** — žádná modifikace `/flow:done`. Místo toho:
   - Přidat sekci do `CLAUDE.md` ("Site roadmap regen") s pravidlem: kdykoliv editujeme STATE.md History nebo přesouváme plán do `.ai/plans/archive/`, spustit `pnpm --filter @maude/site gen:roadmap` a zařadit `site/lib/roadmap.json` do commitu.
   - Přidat stejnou poznámku do `.ai/release-guide.md` (pokud existuje, jinak skip — release pipeline regen stejně udělá přes `prebuild`).
5. **Pipeline** — `site/package.json` `prebuild` + `predev` rozšířit o `node scripts/build-roadmap.mjs`; přidat `gen:roadmap` script. Roadmap.json se commituje (stejně jako stats.json — Vercel uploaduje jen `site/` a nemůže ji regenerovat ze siblingu `.ai/`).
6. **Nav link** — `site/app/(home)/layout.tsx` (top nav) přidat link na `/roadmap`.

## Metadata

- **GitHub Issue**: — (none)
- **Type**: New Capability
- **Complexity**: Medium
- **App/Package**: `site/` (workspace `@maude/site`)
- **Affected Systems**: Next.js routing, build pipeline, CLAUDE.md (rules), git workflow on `/flow:done`
- **Dependencies**: žádné nové npm balíky — stejné Next.js + Fumadocs + mdcc styling, čtení z `.ai/` přes `node:fs`

---

## Context References

### Must-Read Files

- `site/scripts/build-stats.mjs` (lines 1–60+) — Why: kanonický pattern pro `git`-aware prebuild data generator; znovu-použít `sh()` helper + cwd-resolution + ISO date output. Roadmap script bude jeho mladší sourozenec.
- `site/app/(home)/page.tsx` (lines 1–80) — Why: jak importovat z `@/lib/<name>.json` a jak používat `.mdcc-*` třídy + `<SkuLabel>` + akcent dot.
- `site/.gitignore` (lines 1–10) — Why: dokumentuje, proč `stats.json` JE committed (Vercel uploaduje jen `site/`); roadmap.json musí dodržet stejný kontrakt.
- `.ai/plans/README.md` (lines 90–110, "Execution order" tabulka) — Why: zdroj pro ship target + can-parallelize per fázi.
- `.ai/state/STATE.md` (sekce `## History`) — Why: zdroj pro done dates + summary řádek per fáze.
- `site/components/mdcc/sku-label.tsx` — Why: jednoduchý vzor mdcc komponenty; následovat pro `roadmap-timeline.tsx`.
- `site/app/global.css` (grep `.mdcc-`) — Why: existující design tokeny + třídy; žádné nové.

### Files to Create

- `site/scripts/build-roadmap.mjs` — parser plans/ + STATE.md History → `lib/roadmap.json`.
- `site/lib/roadmap.json` — auto-generovaný, committed (gitignore výjimka jako stats.json).
- `site/app/(home)/roadmap/page.tsx` — server-rendered route `/roadmap`.
- `site/components/mdcc/roadmap-timeline.tsx` — prezentační komponenta.
- `site/components/mdcc/roadmap-timeline.module.css` — *pokud* potřebuje něco nad rámec existujících `.mdcc-*` tříd; jinak vynechat.

### Files to Modify

- `site/package.json` — `prebuild` + `predev` přidat `node scripts/build-roadmap.mjs`; nový `gen:roadmap` script.
- `site/.gitignore` — rozšířit poznámku u `lib/stats.json` o `lib/roadmap.json` (stejný důvod).
- `site/app/(home)/layout.tsx` — top-nav link na `/roadmap` (pokud má nav; jinak skip — `/roadmap` se objeví organicky).
- `CLAUDE.md` — nová mini-sekce "Site roadmap regen" s pravidlem o regen + commit při archivaci plánu / STATE.md History edit.

### Documentation

- [Next.js 16 app router co-located server components](https://nextjs.org/docs/app) — Why: roadmap page bude pure server component, žádné `"use client"`.
- [Fumadocs UI page-meta-footer](https://fumadocs.dev) — Why: existing pattern (viz `site/components/mdcc/page-meta-footer.tsx`); roadmap může re-use footer pro "Last updated" badge.

### Patterns to Follow

Z `site/scripts/build-stats.mjs`:

```js
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const out = resolve(__dirname, '../lib/stats.json');

const sh = (cmd, fallback = '') => {
  try { return execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return fallback; }
};
```

Z `site/app/(home)/page.tsx`:

```tsx
import stats from '@/lib/stats.json';
// ...
<SkuLabel>MDCC-MKT/00</SkuLabel>
```

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `<SkuLabel>` | `site/components/mdcc/sku-label.tsx` | použít na per-fáze stamp (`MDCC-RDM/06.5` atd.) |
| `<PageMetaFooter>` | `site/components/mdcc/page-meta-footer.tsx` | použít na "Last updated" line v `/roadmap` |

### Existing screens / blocks reused

| Screen / block | Source | Notes |
| -------------- | ------ | ----- |
| Home hero stamp row | `site/app/(home)/page.tsx` lines 70–80 | identický pattern pro `/roadmap` hero |

### Icons

| Icon | Library | Size | Usage |
| ---- | ------- | ---- | ----- |
| `[x] / [~] / [ ] / [❄]` | ASCII glyphy (žádná icon lib) | inline | status marker na začátku každé řádky timeline |

> Záměrně žádný Lucide / SVG — `.mdcc-*` aestetika je ASCII-monospace-first, viz preview, který user vybral.

### Tokens

| Purpose | Token | Třída |
| ------- | ----- | ----- |
| Pozadí stránky | `--background` | `.mdcc-landing` (re-use) |
| Akcent (status badges + "done" tečka) | `--accent` | inline `style={{color:'var(--accent)'}}` |
| Hairline divider mezi fázemi | `--border` | `.mdcc-hairline` (re-use, pokud existuje, jinak nový `border-top` 1px) |
| Monospace pro datum + branch | `--font-mono` | `.mdcc-mono` |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `<RoadmapTimeline phases={...} />` | žádný existující block není seznam fází se status glyphem | none, čistý JSX nad mdcc třídami |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `site/scripts/build-roadmap.mjs`

- **Do**: Zrcadlí strukturu `build-stats.mjs`. Vstupy:
  1. `.ai/plans/*.md` (aktivní) → frontmatter (`name`, `status`, `created`) + H1 titulek + první odstavec.
  2. `.ai/plans/archive/*.md` (done) → H1 titulek + `<filename-bez-přípony>` jako id.
  3. `.ai/state/STATE.md` — parse markdown tabulku v sekci `## History` (sloupce: `Date | Phase | Status | Note`). Spojit s archive files po `id` (slugify Phase header).
  4. `.ai/plans/README.md` — parse tabulku v sekci `## Execution order` (sloupce: `Step | Phase | File | Can parallelize? | Ship | Command`); extrahovat `shipTarget` per `id`.
  5. STATE.md `**Phase:**` + `**Status:**` + `**Active task:**` + `**Branch:**` řádky → aktuální fáze in-progress meta.
- **Výstup**: `site/lib/roadmap.json` s tvarem:

  ```json
  {
    "generated": "2026-05-22T...",
    "currentPhase": { "id": "phase-6.5", "title": "Canvas export", "branch": "feat/phase-6.5-export", "progress": "1/13 · T1 done" },
    "phases": [
      { "id": "phase-1", "title": "Contribute infra + Changesets", "status": "done", "shipTarget": "v1.0", "date": "2026-05-10", "summary": "...", "planPath": ".ai/plans/archive/phase-1-...md" },
      { "id": "phase-6.5", "title": "Canvas export", "status": "in-progress", "shipTarget": "v1.0", "branch": "feat/phase-6.5-export", "planPath": ".ai/plans/phase-6.5-export.md" },
      { "id": "phase-7", "title": "ACP chat sidebar", "status": "icebox", "shipTarget": "v1.1+", "planPath": ".ai/plans/phase-7-acp-chat-sidebar.md" }
      // ...
    ]
  }
  ```
- **Pattern**: `build-stats.mjs` (cwd resolve, `sh()` helper, `writeFile` JSON output).
- **Gotcha**:
  - Frontmatter parsing — některé pláns nemají frontmatter (např. `phase-12-...md` začíná rovnou H1). Fallback: stáhnout titulek z první `# ` řádky, status default `planned`.
  - History tabulka v STATE.md má více kategorií (Phase, ad-hoc fixy jako "Rebrand md-claude → Maude"). Filtrovat pouze řádky, které matchují existující plán-file (po slug normalizaci).
  - Status mapping: archive presence → `done`; STATE.md `**Phase:**` match → `in-progress`; `phase-7` má v plans/README.md ❄️ ICEBOX značku → `icebox`; jinak `planned`.
- **Validate**: `node site/scripts/build-roadmap.mjs && cat site/lib/roadmap.json | head -40` — JSON musí být valid, `currentPhase.id === "phase-6.5"`, `phases.length === <počet souborů v plans/ + plans/archive/ co matchují>`.

### Task 2: CREATE `site/components/mdcc/roadmap-timeline.tsx`

- **Do**: Server component (no `"use client"`), props `{ phases, currentPhase }`. Renderuje:
  - Hero blok stylem `site/app/(home)/page.tsx` (SKU stamp + H1 "Roadmap" + akcent dot).
  - `<ol>` s jednou `<li>` na fázi: status glyph `[x] / [~] / [ ] / [❄]` (mono) → SKU label (`MDCC-RDM/<id>`) → titulek → datum nebo shipTarget → optional one-liner summary → odkaz na plán (`<a href="https://github.com/1aGh/maude/blob/main/<planPath>">`).
- **Pattern**: čistý JSX + existující `.mdcc-*` třídy (`.mdcc-landing`, `.mdcc-hero`, `.mdcc-mono`, `.mdcc-hairline`); pokud daná třída neexistuje, definovat lokální v `roadmap-timeline.module.css` (jen pro grid / spacing, ne pro barvy).
- **Gotcha**: žádné Lucide ikony, žádné gradients, žádný frosted glass — viz [no AI-tell punctuation memory] a paper/phosphor DS. Em-dash → en-dash → ASCII dash kontroly: ŽÁDNÉ em-dashe (`—`) v hardcoded copy v komponentě; používej čárky nebo interpunct (`·`).
- **Validate**: `pnpm --filter @maude/site dev` → otevři `localhost:3000/roadmap`; všechny fáze viditelné, status glyfy konzistentní, žádný 404 na odkazech na `.ai/plans/`.

### Task 3: CREATE `site/app/(home)/roadmap/page.tsx`

- **Do**: Server component, import `roadmap from '@/lib/roadmap.json'` + `RoadmapTimeline`. Export default returns `<RoadmapTimeline phases={roadmap.phases} currentPhase={roadmap.currentPhase} />`. Metadata: `export const metadata = { title: 'Roadmap · Maude', description: 'Past, present, and planned phases of Maude development.' }`.
- **Pattern**: `site/app/(home)/about/page.tsx` (pokud existuje, jinak `(home)/page.tsx` jako vzor).
- **Validate**: `pnpm --filter @maude/site build` PASS + `/roadmap` v generated routes; `grep -c "roadmap" .next/server/app-paths-manifest.json` > 0.

### Task 4: UPDATE `site/package.json` — pipeline scripts

- **Do**:
  - `prebuild` + `predev`: přidat `&& node scripts/build-roadmap.mjs` (na konec za stávající `build-{stats,command-reference,schema-reference}` chain a před `fumadocs-mdx`).
  - Přidat top-level script: `"gen:roadmap": "node scripts/build-roadmap.mjs"`.
- **Pattern**: existující `gen:stats` + `gen:reference`.
- **Validate**: `pnpm --filter @maude/site gen:roadmap` produkuje `site/lib/roadmap.json`; `pnpm --filter @maude/site dev` projde celým `predev` bez erroru.

### Task 5: UPDATE `site/.gitignore` — poznámka pro roadmap.json

- **Do**: Rozšířit komentář u `lib/stats.json` o souběžnou výjimku pro `lib/roadmap.json` — stejný důvod (Vercel uploaduje jen `site/`).
- **Validate**: `git check-ignore site/lib/roadmap.json` exit code 1 (nemělo by být ignored).

### Task 6: UPDATE `site/app/(home)/layout.tsx` — nav link

- **Do**: Pokud má top-nav array linků, přidat `{ href: '/roadmap', label: 'Roadmap' }` mezi existující entries. Pokud layout nav neexistuje (Fumadocs home layout dělá nav přes `source.config.ts`), vynechat tento task a spoléhat na home-page link (Task 7).
- **Pattern**: existující nav link pro `/about` (pokud je).
- **Validate**: `/roadmap` link v rendered HTML home page.

### Task 7: UPDATE `site/app/(home)/page.tsx` — link z katalogu

- **Do**: Pod `CATALOG_SIZE` řádkou nebo v hero meta přidat krátkou stuhu `<a href="/roadmap">See the roadmap →</a>` (nebo ASCII šipku `->`); jen jeden řádek, ladí s SKU-katalog estetikou.
- **Pattern**: jiné `<Link>` použití v page.tsx (`/docs/design` atd.).
- **Validate**: home page render obsahuje odkaz na `/roadmap`; klik funguje.

### Task 8: UPDATE `CLAUDE.md` — site roadmap regen rule

- **Do**: Přidat novou sekci (cca 6 řádků, pod existující "Release flow") s názvem **Site roadmap regen**:

  ```
  ## Site roadmap regen

  `site/lib/roadmap.json` je auto-generovaný z `.ai/plans/*.md` + `.ai/state/STATE.md`. Stejně jako `stats.json` JE committed (Vercel uploaduje jen `site/`).

  **Kdykoliv** editujeme `.ai/state/STATE.md` History tabulku, archivujeme plán do `.ai/plans/archive/`, nebo přidáváme nový plán do `.ai/plans/`, spusť:

  ```
  pnpm --filter @maude/site gen:roadmap
  ```

  a zařaď `site/lib/roadmap.json` do téhož commitu. To je primární auto-update mechanismus pro `/flow:done` — žádný hook v plugin commandu, jen pravidlo, kterého si všimne agent v kontextu.
  ```

- **Pattern**: existující sekce v CLAUDE.md (např. "Release flow", "Plugin command naming").
- **Gotcha**: dodržet bezpatkové AI-tell punctuation — žádné em-dashe v nové sekci, čárky a interpunct OK.
- **Validate**: `grep -c "gen:roadmap" CLAUDE.md` = 1.

### Task 9: UPDATE `.ai/release-guide.md` (jen pokud existuje)

- **Do**: Pokud `.ai/release-guide.md` existuje, přidat jednu odrážku k `/flow:release` runbooku: "Před `git push --follow-tags`: ověř, že `site/lib/roadmap.json` je in-sync — `pnpm --filter @maude/site gen:roadmap && git status site/lib/roadmap.json`. Pokud diff, commit změnu nebo abortuj release a vyřeš drift."
- **Validate**: `grep gen:roadmap .ai/release-guide.md` (pokud soubor existuje).

### Task 10: SMOKE — full pipeline dry run

- **Do**:
  1. Smazat `site/lib/roadmap.json`.
  2. `pnpm --filter @maude/site gen:roadmap` — soubor existuje.
  3. `pnpm --filter @maude/site dev` → otevři `localhost:3000/roadmap` — všechny fáze vidět ve správném pořadí: done s datem nahoře, in-progress (phase-6.5) uprostřed se status `[~]`, planned + icebox dole.
  4. `pnpm --filter @maude/site build` — PASS, `/roadmap` v build outputu.
- **Validate**: viz Task 10 sub-kroky.

---

## Validation

Run these commands to confirm zero regressions:

1. **Generator deterministic**: `node site/scripts/build-roadmap.mjs && node site/scripts/build-roadmap.mjs && git diff site/lib/roadmap.json` — žádný diff mezi dvěma runy.
2. **Lint**: `pnpm --filter @maude/site lint` (Biome).
3. **Types**: `pnpm --filter @maude/site types:check`.
4. **Build**: `pnpm --filter @maude/site build`.
5. **A11y manuálně**: na `/roadmap` projít keyboard Tab — všechny odkazy mají focus indicator; status glyfy mají `aria-label` (např. `[x]` → `aria-label="done"`).
6. **Visual eyeball**: `pnpm --filter @maude/site dev` + screenshot via agent-browser, porovnat s preview, který vybral user (paper/phosphor, monospace, hairlines).

---

## Scenario Coverage (UI tasks)

Existující scénáře:

| Scenario | Covers | Status |
| -------- | ------ | ------ |
| `docs-site` (`.ai/scenarios/docs-site/`) | navigace docs sajtu | ✅ existing, ale netýká se `/roadmap` přímo |

Nový scénář:

- `site-roadmap` — flow:
  1. Open `localhost:3000`
  2. Click "See the roadmap"
  3. Verify URL `/roadmap`
  4. Verify aspoň jedna fáze každého status typu (done, in-progress, planned, icebox) viditelná
  5. Click na link prvního archived plánu → otevře se GitHub plan file
- Persona: anonymous návštěvník landing page.
- Fixtures: žádné — site staví z committed `roadmap.json`.

> **Nepovinné pro v1** — `/roadmap` je static, low-risk. Lze odložit do follow-up plánu pokud chceš ship rychleji.

---

## Acceptance Criteria

- [x] T1–T10 splněny
- [ ] `site/lib/roadmap.json` deterministicky generován, committed
- [ ] `/roadmap` route dostupná, renderuje všechny fáze s korektním statusem
- [ ] CLAUDE.md obsahuje pravidlo o `gen:roadmap` při archivaci plánu / STATE.md edit
- [ ] `pnpm --filter @maude/site build` PASS
- [ ] Žádná AI-tell punctuation (em-dashe) v nové copy
- [ ] Žádné nové npm dependencies
- [ ] Žádná modifikace `plugins/flow/commands/done.md` (auto-update jde čistě přes CLAUDE.md pravidlo, jak user explicitně chtěl)

---

## Decisions to record

Pouze pokud během implementace nastane jeden z těchto:

- **DDR-?**: status taxonomy (`done | in-progress | planned | icebox`) — pokud se ukáže, že potřebujeme víc stavů (např. `blocked`, `paused`), zaznamenat rozšíření.
- **DDR-?**: `roadmap.json` commit-or-gitignore — pokud Vercel uplink změní scope a `roadmap.json` by mohl být regenerován na Vercelu z monorepo siblingu, DDR potvrdí switch na gitignore. Dnes je commit-and-track.

Žádné nové DDR během exekuce nevznikly — status taxonomy + commit-tracked JSON precedent (stats.json) drželi.

---

## Retro

Doneseno v commitu `6188889` (2026-05-23). Closeout (archive + History row + roadmap.json regen) doklepnut 2026-05-25.

**Co fungovalo:**
- Pattern lift z `build-stats.mjs` byl správný — `sh()` helper + `repoRoot` resolve šel přesně tak, jak plán předpokládal. Žádný drift od existující konvence.
- Auto-update bez plugin-command hooku se osvědčil — pravidlo v `CLAUDE.md` ("Site roadmap regen") je v kontextu pokaždé, takže si toho agent všimne přirozeně. Žádná modifikace `plugins/flow/commands/done.md` nepotřebná (user explicitně chtěl).
- `lib/roadmap.json` committed (stejně jako `stats.json`) byla čistá volba — Vercel uploaduje jen `site/` a generator nemá přístup k siblingu `.ai/`.

**Co bylo jinak než plán:**
- Plán psal o 36 fázích / 28 done / 1 in-progress / 6 planned / 1 icebox. Při closeoutu dataset narostl na 41 / 32 / 0 / 8 / 1 (Phase 18 + 19 mezitím shippnuly, žádná aktivní in-progress).
- Status glyph pro icebox je `[*]` v komponentě (ne `[❄]` z plánu) — emoji nezapadalo do paper/phosphor ASCII estetiky.
- T6 nav link skončil v `site/lib/layout.shared.tsx`, ne v `(home)/layout.tsx` — Fumadocs home layout dělá nav přes shared config.

**Lessons:**
- Když user píše "auto-update přes pravidlo v CLAUDE.md, ne přes hook", má pravdu — load-bearing pravidlo v always-loaded souboru je robustnější než command hook, protože nevyžaduje konkrétní entrypoint.
- Generator deterministic check (`run 2×, git diff`) modulo `generated` timestamp byl správný plán pro CI sanity, ale neaktivován — site nemá test suite. Manuálně ověřeno.
