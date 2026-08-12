# Feature: Canvas render performance — smooth pan/zoom on large canvases

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Large canvases (100+ artboardů, husté annotations/whiteboard vrstvy) se při pan/zoom sekají v prohlížeči i v Tauri desktopu tak, že se s nimi skoro nedá pracovat. Toto je třetí vlna práce na render enginu — první dvě (RCA `issue-canvas-pan-zoom-jank-large-moodboard` + 2 addenda) vyřešily paint/raster vrstvu (culling, per-board compositor freeze, settle-skip). Tato vlna útočí na dosud neadresovanou vrstvu: **React reconciliation fanout během gesta** a **škálování na 100+ artboardů / stovky annotation nodů**.

## User Story

As a designer working on a big canvas (onboarding flow se 128 artboardy, FigJam-style retro board se ~130 stickies) I want pan/zoom to stay smooth so that přímá manipulace — hlavní interakce produktu — zůstane použitelná.

## Problem

Reprodukce (user report 2026-08-12):
- `~/git/studyfi/studyfi-design/.design/ui/studyflash-onboard/SPKIE Onboarding Flow.tsx` — **128 DCArtboardů** (žádné filtry/blendy — čistý problém škály) + **164 kB annotations SVG** (~174 `<g>`, 99 path, 462 text/rect/image).
- `~/git/studyfi/studyfi-design/.design/ui/Team Retro.tsx` — FigJam import; celý board žije v annotations vrstvě (`ui-team_retro.annotations.svg`: 112 skupin, 122 textů, 31 obrázků).

Diagnóza (ověřeno v kódu, ne hypotéza):

1. **React re-render fanout během gesta (dominantní, dosud neadresované).** `useViewportController` publikuje viewport do React state každých `PUBLISH_MS = 50 ms` (`canvas-lib.tsx:223`, `:1005-1011`). Každý publish přestaví `ctxValue` WorldContextu (`:1811-1822` — obsahuje `viewport`), takže **každý DCArtboard se re-renderuje ~20×/s po celou dobu gesta** (`:2065` konzumuje celý context; `ctx.viewport` je přitom jen pass-through do drag hooku `:2107`). K tomu se per-publish přepočítává `activeArtboardId` (`:1752-1773`, `find` přes artboards + `postMessage` do parenta) a **celý annotations layer se re-reconciluje per publish** (`annotations-layer.tsx:954-955` čte `controller.viewport`; section-label chrome se škáluje `1/zoom` → mění se každý zoom tick, `:572-583`). Na 128 boardech + 700-node SVG je to hlavní main-thread náklad soutěžící s pointer eventy.
2. **128 permanentních compositor vrstev.** `.dc-artboard { will-change: transform }` (`canvas-lib.tsx:366`) je z RCA addendum 2 správné pro ~20 boardů, ale na 128 boardech riskuje přesně ten „WebKit memory crash cliff", před kterým addendum varuje (lever 3: gesture-scope the promotion). GPU paměť + compositing overhead rostou lineárně s počtem boardů.
3. **Annotations vrstva nemá žádnou z artboard optimalizací.** Strokes SVG je portálované do `.dc-world` (transform aplikuje nativně — dobře), ale nemá culling, nemá vrstvu, `vector-effect="non-scaling-stroke"` + `1/zoom` label chrome nutí repaint při každé změně zoomu.

Co už JE hotové a nesmí se vyhodit (prior-art, `.ai/archive/logs/rca/issue-canvas-pan-zoom-jank-large-moodboard.md` + kg): per-artboard `content-visibility:auto` + `contain-intrinsic-size` (`:2276-2277`), `contain:paint` + `isolation:isolate` (`:364-365`), settle-skip na čistém panu (`:1047-1049`), engine-specifický scale path (Blink CSS `zoom` / WebKit `translate+scale`, `:986-1003`).

Co prior research ZAMÍTL (nezkoušet znovu bez nového důkazu): fidelity-toggle LOD (flickeroval, odstraněn), faithful DOM snapshot během gesta (na WebKitu neexistuje API), spoléhání na GPU akceleraci SVG `url()` filtrů na WebKitu (neexistuje).

## Solution

**Zvolený směr (debata BUILDER/SHIPPER/BREAKER, viz § Debate): incremental-dom — udělat DOM pipeline gesture-static.** Cíl: během pan/zoom gesta se nesmí spustit ŽÁDNÝ React render a žádný layout/paint — gesto je čistý compositor transform + imperativní zápisy mimo React. Publish do Reactu se odloží na settle. GPU/canvas rewrite je zamítnut (zabíjí produktový invariant „artboard = živý DOM mock" a je to enginový projekt na měsíce); raster-LOD je zamítnut jako první krok (flicker precedent), ale zůstává jako zadní vrátka, pokud měření po této vlně ukáže, že strop DOMu pořád nestačí.

Vrstvy řešení (v pořadí páky):

- **A. Gesture-static React.** Viewport ven z WorldContextu (konzumenti čtou live viewport imperativně / přes rAF), publish do state jen na settle (ne per 50 ms), `activeArtboardId` přepočet jen na settle, annotations layer odpojit od published viewportu (zoom-invariantní chrome přes CSS custom property `--dc-zoom` zapisovanou ve `writeTransform`).
- **B. Bounded compositor budget.** `will-change: transform` promotion jen pro boardy ve/blízko viewportu (nebo gesture-scoped), ať 128-board canvas nedrží 128 GPU vrstev.
- **C. Annotations vrstva parita.** Culling + paint containment pro strokes; memoizace stroke elementů; label chrome bez per-tick re-renderu.
- **D. Měřitelnost.** Syntetický perf canvas + FPS/frame-time harness (agent-browser CDP / desktop-e2e), aby každý krok měl before/after číslo a budoucí PR neregresovaly.

## Metadata

- **Type**: Enhancement (performance)
- **Complexity**: High
- **App/Package**: `apps/studio` (canvas-lib + annotations-layer + client bundle)
- **Affected Systems**: dev-server canvas runtime (`canvas-lib.tsx`), annotations layer, minimap/zoom HUD, drag/marquee/undo plumbing, desktop (WKWebView) i browser (Blink)
- **Dependencies**: žádné nové npm deps (zero-dep invariant enginu drží)

---

## Context References

### Must-Read Files

> When consuming this section during `/flow:execute`, **read every file listed here in parallel in a single assistant message** (multiple Read tool calls) — they're independent context loads.

- `apps/studio/canvas-lib.tsx` (lines 210–420 ENGINE_CSS; 900–1210 useViewportController + writeTransform + publish/settle timery; 1740–1830 activeArtboardId + ctxValue; 2060–2290 DCArtboard render + contentVisibility) — Why: jádro změny; každý úkol se dotýká těchto bloků.
- `apps/studio/annotations-layer.tsx` (lines 940–1000 viewport konzumace; 560–600 section-label 1/zoom chrome; 2247–2280 renderStrokes/anchorsById memos; 3800–3830 AnnotationsSvg portál) — Why: vrstva C.
- `.ai/archive/logs/rca/issue-canvas-pan-zoom-jank-large-moodboard.md` — Why: prior-art; co už je hotové, co bylo zamítnuto a proč (flicker LOD, snapshot nemožnost, WebKit filter fakta). NEOPAKOVAT zamítnuté cesty.
- `apps/studio/canvas-shell.tsx` (minimap + zoom HUD konzumace `controller.viewport`) — Why: tito konzumenti musí přejít na live-viewport čtení, jinak drží publish frekvenci.
- `apps/studio/test/canvas-origin-gate.test.ts` + `apps/studio/test/annotations-layer.test.ts` — Why: vzor pro bun:test testy v této části stromu.

### Files to Create

- `apps/studio/viewport-store.ts` — mimo-React viewport store (subscribe/get, `useSyncExternalStore` adaptér + rAF čtečka pro minimap/HUD). Malý, zero-dep.
- `apps/studio/test/viewport-store.test.ts` — jednotkové testy store + publish sémantiky (gesture vs settle).
- `apps/studio/test/fixtures/perf-canvas.ts` + `apps/studio/bin/_perf-probe.mjs` / `perf.sh` — fixture generátor a benchmark harness (Task 1 + 11); syntetický perf canvas patří sem, ne do uživatelského designRoot.

### Design canvases

Nejsou potřeba — čistě enginová práce; postižené canvasy žijí v downstream repu `~/git/studyfi/studyfi-design` a slouží jako reprodukce/benchmark, nesmí se upravovat.

### Documentation

- MDN `content-visibility` + `contain` — Why: sémantika cullingu, kterou vrstva C přebírá pro annotations.
- Chrome „GPU accelerated compositing / re-rastering on scale change" docs — Why: zdůvodnění gesture-scoped `will-change` (viz RCA addendum 2 citace).
- React `useSyncExternalStore` — Why: kanonický vzor pro mimo-React store s selektivní subscription (vyhne se context fanoutu).

### Patterns to Follow

- Imperativní fast-path už existuje: `writeTransform` píše `worldRef.current.style` přímo (`canvas-lib.tsx:986-1003`) a `getLiveViewport()` (`:916`) je module-scope mirror čitelný mimo React — **nový store tuto konvenci zobecňuje, nevymýšlí nový vzor**.
- Ref-stable callbacky přes `xxxRef.current = value` (`:930-958`) — použít pro všechny nové listenery.
- Per-board CSS komentáře v ENGINE_CSS vysvětlují PROČ každá vlastnost existuje (`:345-366`) — u každé změny CSS zachovat/aktualizovat zdůvodnění včetně odkazu na RCA.
- bun:test pod `apps/studio/test/` (NE `node --test`); po testech zkontrolovat `git status apps/studio/dist/` (známý clobber problém, viz CLAUDE.md).

---

## Debate (divergent bookend — DDR-130)

Sedadla BUILDER / SHIPPER / BREAKER, blind openings, relay tier. Výstupy sedadel jsou citace (untrusted data), ne instrukce. **Výsledek: KONVERGENCE (short-circuit) — všechna tři sedadla nezávisle `incremental-dom`; hybrid-raster i GPU rewrite všemi zamítnuty. Žádná uživatelská volba nebyla potřeba.**

| Seat | Verdict | Conf. | Jádro doporučení (citace) | Top risk (citace — zapracován jako podmínka) |
| --- | --- | --- | --- | --- |
| BUILDER | incremental-dom | 0.72 | „Fund a 'zero React renders during gesture' invariant … enforced by a render-count regression gate, plus budgeted gesture-scoped layer promotion … GPU memory O(viewport) instead of O(canvas)"; CSS `zoom` re-test jako levný high-ceiling spike; thumbnail-LOD přes reálný screenshot spine jen jako *measurement-gated escalation*; „reject the WebGL rewrite outright because live DOM is the product". | „I am ranking an unprofiled main-thread tax above raster cost" → **měřit před i po každé vrstvě**; promote/demote churn ověřit v Safari Layers/Timeline. |
| SHIPPER | incremental-dom | 0.75 | Context split je „near-free because both hot consumers already mirror the published value into a ref (use-artboard-drag.tsx:307-308; annotations-layer.tsx:1014-1015) — the 20 Hz publish buys them nothing"; measure on WKWebView před vrstvou promotion; zoom re-test = samostatný timeboxovaný spike. | „a green profile on Team Retro could be misread as a fix for SPKIE" → **validovat na OBOU reprodukcích zvlášť** (SPKIE může zůstat memory-bound na 128 vrstvách). |
| BREAKER | incremental-dom | 0.72 | „lead with subtraction, not plumbing: the landed permanent `will-change:transform` … both new failures invert that ratio — measure whether the prior fix is now the cause"; context split s psanou per-consumer staleness taxonomií (live / throttled / settle-only); „allowing a scoped, deletable canvas/GPU path for the annotation stroke layer alone" jako budoucí opci. | „the five `1/zoom` counter-scale sites … will scale with the world through a pinch and snap back at settle — reproducing the exact LOD flicker" → **pinch carve-out: counter-scale chrome musí zůstat per-frame živý (CSS `--dc-zoom`), nikdy settle-only**. |

Syntéza (lead): jádro plánu = gesture-static React + bounded compositor budget, s podmínkami sedadel povýšenými na úkoly: baseline měření PŘED zásahem (Task 1), subtrakční A/B experiment s permanentním `will-change` (Task 2), staleness taxonomie konzumentů (Task 4), per-frame `--dc-zoom` pro counter-scale chrome (Task 6), promotion budget řízený experimentem (Task 8), CSS `zoom` spike (Task 9), render-count regression gate (Task 1 + Acceptance). Thumbnail-LOD a scoped stroke-canvas zůstávají jako dokumentované eskalace, pokud čísla po této vlně nestačí.

---

---

## Execution findings (2026-08-12) — měření změnilo premisu, refaktor POZASTAVEN

Tasks 1, 2 a jádro 11 hotové. **Tasks 3–10 (vlastní refaktor) záměrně nespuštěny** — měření nepotvrdilo premisu na jediném enginu, který jde v této session měřit.

### Co harness naměřil

| Scénář (blink-headless, warm, medián ze 3 passů) | frame p95 | long tasks | artboard renders / gesto |
| --- | --- | --- | --- |
| perf-fixture, 128 boardů | **17,6 ms** | 0 | **6272** |
| perf-fixture, 128 boardů, `will-change:auto` (varianta B) | 17,5 ms | 0 | 6400 |
| Team Retro (reálný canvas) | 17,5 ms | 0 | 47 |
| perf-fixture, **cold / první pass** | 82,4 ms | 16 | 4096 |
| SPKIE 128 boardů (cold, jediný odchycený běh) | 116,7 ms | 16 | — |

Noise floor: spread p95 napříč kept passy = 0,1–0,2 ms.

### Tři závěry

1. **Diagnóza render-fanoutu je POTVRZENÁ co do existence: 6272 React renderů na jedno gesto** (128 boardů × ~49 publishů). Předpověď plánu seděla.
2. **Ale na Blinku to nestojí frame time.** Warm p95 = 17,6 ms = 60 fps i s těmi 6272 rendery. Fanout je prokazatelný ODPAD, ne prokazatelné hrdlo — přesně scénář, před kterým varoval BUILDER („if instrumentation shows scripting is a minority of frame time … Tier 1 buys little").
3. **Varianta B (subtrakce `will-change`) je na Blinku k nerozeznání od kontroly** (17,5 vs 17,6 ms, pod noise floorem). BREAKERova hypotéza se na tomto enginu ani nepotvrdila, ani nevyvrátila — Blink není engine, kde `will-change` rozhoduje.

### AKTUALIZACE (WebKit lane + studio-embedded měření) — bolest REPRODUKOVÁNA

Po zapnutí `safaridriver` přibyla WebKit dráha (`perf.sh --engine safari`, W3C WebDriver, zero-dep) a dva režimy, které rozhodly: `--fit-all` (Cmd+0 před gestem) a `--studio` (měření uvnitř reálného studia přes WebDriver frame-switch, ne na holém `_canvas-shell.html`).

| Měření (128-board fixture, WebKit/Safari, warm medián) | frame p50 | frame p95 |
| --- | --- | --- |
| canvas-shell přímo, výchozí výřez | 14 ms | 15 ms |
| canvas-shell přímo, **fit-all** | 14 ms | 20 ms |
| **uvnitř studia, fit-all** | **29 ms** | **42 ms** |
| uvnitř studia, fit-all, `active-artboard` postMessage VYPNUTÝ | 30 ms | 42 ms |

Reálný SPKIE (WebKit, canvas-shell, bez fit-all): p95 20 ms.

**Tři závěry, které mění zadání:**

1. **Bolest je v embeddingu, ne v canvasu.** Stejný canvas, stejný engine, stejný fit-all: 20 ms mimo studio → **42 ms uvnitř** (spread 1 ms, tedy ne šum). ~24 fps = přesně to „seká". Dosavadní plán mířil celý dovnitř `canvas-lib`; hlavní násobič je ale **studio shell / iframe kompozice**.
2. **`active-artboard` postMessage NENÍ příčina** — s vypnutým je výsledek identický (42 ms, spread 0 ms). Nejsilnější konkrétní podezřelý padl; hypotéza „parent setState per publish" je vyvrácená, ne oslabená.
3. **Fit-all sám o sobě je jen menší faktor** (15 → 20 ms). RCA ho identifikovala správně jako zhoršení, ale není to hlavní pákový bod.

**Co to znamená pro Tasks 3–10:** gesture-static React uvnitř canvasu zůstává legitimní úklid (6272→ renderů je odpad), ale **nemůže vysvětlit ani opravit ten 2× skok, který dělá embedding**. Než se sáhne na sdílenou viewport plumbing, musí se najít, co ve studiu ten násobič způsobuje (kandidáti k proměření, žádný zatím netestovaný: kompozice iframu v layoutu studia, overlay vrstvy nad iframem — komentáře/kurzory/minimapa, `contain`/`will-change` na kontejneru iframu, velikost a device-pixel-ratio iframu ve studiu vs. plná stránka).

### IMPLEMENTACE HOTOVÁ (2026-08-12) — invariant ověřen měřením

Refaktor proveden a ověřen. **Gesto je render-free**; zbylé dva rendery na board jsou start a settle gesta (nevyhnutelné bookendy).

| Scénář (128-board fixture, WebKit/Safari) | artboard renders | annotation renders | frame p95 |
| --- | --- | --- | --- |
| před, canvas-shell | 2560 | 20 | 15 ms |
| **po, canvas-shell** | **256** (−90 %) | **2** | 15 ms |
| před, studio + fit-all | 5504 | 43 | 42 ms |
| **po, studio + fit-all** | **896** (−84 %) | **7** | 42 ms |

256 / 128 boardů = **2 rendery na board** = přesně `isInteracting:true` na začátku a `isInteracting:false` + publish na settle. Zbytek v fit-all variantě (896) padá na fit ANIMACI, která běží před měřeným gestem, ne na gesto samotné.

**Frame time se nezměnil** — na tomto enginu jím React práce nikdy nebyla limitem (viz zjištění výše). Refaktor odstraňuje prokazatelný odpad, nezlepšuje číslo, které nebylo zhoršené touhle příčinou.

### Co se změnilo (a proč jinak, než plán psal)

- **Task 4 (publish na settle) — HOTOVO.** `applyViewport(next, {defer})`: gesture cesty (`panBy`, `zoomAt`) publish odkládají, programové (fit/reset/jumpTo/animateTo) publikují hned. Settle publikuje v interakčním trailing timeru.
- **Task 5 (viewport ven z ctxValue) — ZÁMĚRNĚ NEPROVEDEN.** Cíl byl „context se během gesta nemění"; settle-only publish ho splní beze změny tvaru kontextu, takže odpadá přepisování všech konzumentů (drag, marquee, minimapa, komentáře, undo) a s ním hlavní regresní riziko, na které upozorňoval BREAKER. Menší diff, stejný invariant.
- **Task 6 (`--dc-zoom` + živé chrome) — HOTOVO jinak.** `writeTransform` zapisuje `--dc-zoom` per frame (k dispozici pro CSS), ale pět `1/zoom` míst v annotations (connector dots, selection bbox, section-label chipy) přešlo na `useLiveViewport()` — počítají se stejnou matematikou, jen z živé hodnoty. Tím je uzavřen BREAKerův top-risk: bez toho by chrome při pinchi rostlo se světem a na settle luplo zpět.
- **Živí konzumenti:** minimapa + zoom % přes `useLiveViewport()` (rAF jen během gesta, ~20 Hz, jen tyto dvě malé komponenty). `vpRef` v annotations a `zoomRef` v drag hooku čtou živý viewport (`liveZoom` prop — import canvas-lib do drag hooku by udělal cyklus). Bez toho by drag zahájený do 220 ms po panu dělil deltu předchozím zoomem.
- **Task 8 (bounded promotion) — ZÁMĚRNĚ NEPROVEDEN, na základě měření.** A/B ukázalo, že `will-change: auto` je na Blinku i WebKitu k nerozeznání od kontroly (pod noise floorem). RCA addendum 2 přitom dokládá, že pro filter-heavy moodboardy je promotion load-bearing. Měnit ji tedy znamená riskovat doložený případ kvůli nedoloženému zisku. Zůstává jako otevřená položka **pro WKWebView desktop**, až bude čím měřit.
- **Task 9 (CSS `zoom` spike) — NEPROVEDEN.** Samostatný timeboxovaný spike; nemá vazbu na tuto vlnu a měnil by engine-specifickou cestu, kterou právě nic neukazuje jako problém.

### Sdílený rAF ticker (dodatek k Task 6)

`useLiveViewport` původně startoval vlastní rAF smyčku na instanci. `SectionLabelChip` se renderuje **per sekce**, takže na FigJam boardu by to bylo N nezávislých smyček měřících tutéž jednu hodnotu — násobička rostoucí s obsahem. Přepsáno na jeden modulový ticker se sadou odběratelů (`subscribeLiveViewport`), který běží jen dokud má odběratele a jen během gesta.

### Ověření (finální běh, WebKit/Safari, 128-board fixture)

- canvas-shell + fit-all: p95 21 ms (spread 4 ms) — beze změny proti 20 ms před refaktorem.
- studio + fit-all: pan p95 39 ms / zoom 37 ms — v pásmu předrefaktorových 42 ms.
- artboard renders: **896** (z 5504), annotation renders **7** (ze 43).
- `/design:smoke`: 46/46 canvasů renderuje stylovaně, import-graph lint čistý.
- `bun test test/`: 3853 pass / 0 vlastních fail. (Dva timeouty — `canvas-move-api`, `exporters/jobs` — v izolaci procházejí 28/28; padaly jen pod cizí zátěží, load average na stroji šplhal přes 300 kvůli iOS simulátorům jiné session.)

**Pozor na interpretaci čísel z tohoto stroje:** během měření běžela souběžná session s iOS simulátory a jeden běh vyskočil na p95 70 ms. Proto probe tiskne spread napříč passy — delta menší než spread není výsledek. Render-count je na zátěži nezávislý, a to je metrika, na které stojí tvrzení o invariantu.

### Zbývá otevřené

1. **Studio násobič 2×** (20 → 42 ms) — reprodukovaný, ale NEVYSVĚTLENÝ. Vyvráceno: `active-artboard` postMessage, studio chrome (sidebar/panely/taby skryté → beze změny). Podezření: kompozice cross-origin iframu ve WebKitu (p50/p95/max vycházejí na identických 42 ms, což vypadá spíš na cadence než na zátěž).
2. **WKWebView desktop** — pořád nezměřeno; Safari je nejbližší dostupný proxy, ne desktop shell.

### Poznámky k implementaci (deviace od plánu)

- Fixture generátor je `.mjs`, ne `.ts` — probe běží pod node a importuje ho přímo.
- `dist/client.bundle.js` se pro tuto změnu **nepřestavuje**: `canvas-lib.tsx` se do canvasů kompiluje server-side per-canvas, ne přes studio client bundle (ověřeno — bundle zůstal beze změny a instrumentace přesto měřila).
- Probe si vynutil izolovanou `agent-browser --session` (souběžná session ho odnavigovala uprostřed měření) a **warm-up + medián** (dva identické běhy se lišily o 60 %, viz historie).
- Probe **odmítá zapsat** běh, kde se gesto nepropsalo do world transformu — jinak by v historii seděl věrohodně vypadající, ale falešný baseline.

---

## Tasks

Execute in order. Each task is atomic and testable. Pořadí je výsledkem debaty: **měřit → subtrahovat → přestavět → měřit**.

### ✅ Task 1: CREATE perf fixture + měřicí harness (baseline PŘED zásahem) — DONE

- **Do**: (a) Syntetický fixture canvas generátor `apps/studio/test/fixtures/perf-canvas.ts` — N artboardů (default 128, mřížka, realistický obsah bez filtrů) + M annotation strokes (default 150 stickies), deterministický. (b) Měřicí skript `apps/studio/bin/_perf-probe.mjs` (v Task 11 povýšený na verb `maude design perf`): boot server proti temp projektu, agent-browser/CDP scripted wheel-pan + pinch-zoom, sbírat p50/p95 frame time + longtask count + **React commit count během gesta** (globální counter přes `onRender` profiler hook v dev buildu nebo `__REACT_DEVTOOLS_GLOBAL_HOOK__`). Každý běh se appenduje do `<designRoot>/_smoke/perf/history.jsonl` (schéma viz Task 11) a tiskne delta proti minulému běhu. (c) **Zapsat baseline čísla pro OBĚ reprodukce** (SPKIE 128-board profil, Team Retro stroke profil — SHIPPER risk: zelený Team Retro ≠ opravený SPKIE) + pro fixture, na Blinku i WKWebView (desktop-e2e scénář).
- **Pattern**: `apps/studio/bin/_screenshot-playwright.mjs` (interní shim konvence); desktop přes `desktop-e2e` skill, ne agent-browser.
- **Gotcha**: Čísla headless/CI kolísají — gate je relativní (before/after stejný stroj), ne absolutní CI assert. Do `quality` blok nepřidávat CI-gate; jen dokumentovaný ruční recept.
- **Validate**: `node apps/studio/bin/_perf-probe.mjs --boards 128 --strokes 150` dvakrát po sobě ±20 %.

### ◐ Task 2: EXPERIMENT — subtrakce permanentního `will-change` (BREAKER) — A/B na Blinku hotovo (neprůkazné), C + WKWebView chybí

- **Do**: A/B na 128-board fixture + SPKIE reprodukci, WKWebView primárně: (A) status quo `.dc-artboard { will-change: transform }`; (B) bez něj; (C) jen on-screen boardy (ruční hack přes dev-tools/dočasnou třídu). Změřit frame time + GPU/layer memory (Safari Layers). Výsledek determinuje Task 7 (bounded promotion vs prosté odstranění na filter-free boardech). Prior fix má benefit ~ per-board paint cost a cost ~ board count — oba nové případy ten poměr invertují; NEODSTRAŇOVAT ale pro filter-heavy moodboardy (původní RCA případ musí zůstat rychlý — regrese test na alligators moodboardu nebo filter-heavy fixture variantě).
- **Pattern**: RCA addendum 2 (proč will-change vzniklo) — experiment jeho platnost re-testuje na novém režimu, neruší ji slepě.
- **Validate**: tabulka A/B/C čísel v plánu/retru; rozhodnutí pro Task 7 zapsané.

### ⊘ Task 3: CREATE viewport-store — NEPROVEDEN (settle-only publish splnil invariant bez nového store; `getLiveViewport` + `useLiveViewport` stačí)

- **Do**: Extrahovat `liveViewport` module-mirror do `apps/studio/viewport-store.ts`: `getViewport()`, `subscribe(cb)` (per-write sync notify), `subscribeSettled(cb)` (notify až na settle), `useViewportSettled()` (React hook přes `useSyncExternalStore` — přepíná se jen na settle) a `useViewportRaf(cb)` (rAF čtečka pro plynulé HUD prvky mimo React state). `useViewportController.applyViewport` zapisuje do store místo/vedle `liveViewport`.
- **Pattern**: `getLiveViewport()` (`canvas-lib.tsx:909-917`) — store je jeho zobecnění; zachovat existující export jako thin wrapper (zpětná kompatibilita pro `canvas-rects` čtečku `:2435`).
- **Gotcha**: `liveViewport` musí přežít soft-reload remount (RC3 komentář `:1061`) — store je module-scope, drží to.
- **Validate**: `cd apps/studio && bun test test/viewport-store.test.ts`

### ✅ Task 4: UPDATE useViewportController — publish jen na settle — DONE

- **Do**: (a) Nejdřív sepsat **per-consumer staleness taxonomii** (BREAKER podmínka) — pro KAŽDÉHO konzumenta `controller.viewport` / WorldContext.viewport / annotations vp označit: `live` (per-frame, mimo React — counter-scale chrome, minimap indikátor), `event-time` (imperativní čtení v handleru — drag matematika, hit-testy), `settle-only` (React state — activeArtboardId, persist, annotations sync). Tabulku vložit jako komentář k `useViewportController`. (b) Pak: během gesta NEvolat `setViewportPublished` (zrušit 50ms `schedulePublish` smyčku); publikovat React state jen na settle (`SETTLE_MS`) a na programmatic jump (fit/Cmd+1/animateTo). `isInteracting` state zachovat (2 přechody za gesto, OK).
- **Pattern**: settle už existuje (`scheduleSettle` `:1013-1020`, `onSettle` persistuje viewport) — publish se na něj pověsí. Hot konzumenti už dnes zrcadlí published hodnotu do refů (`use-artboard-drag.tsx:307-308`, `annotations-layer.tsx:1014-1015`) — 20Hz publish jim nic nedává (SHIPPER).
- **Gotcha**: Konzumenti klasifikovaní `live` přecházejí na `useViewportRaf`/přímé style zápisy v Task 6 — Task 4 a 6 musí jít do stejného commitu, jinak minimap/chrome zamrzne během gesta.
- **Validate**: `cd apps/studio && bun test` + probe (Task 1): React commit count během gesta = 0.

### ⊘ Task 5: REFACTOR WorldContext — ZÁMĚRNĚ NEPROVEDEN (viz § Co se změnilo — invariant splněn bez přepisu konzumentů)

- **Do**: Odstranit `viewport` z `WorldContextValue` (`:502-522`, `:1811-1822`). Konzumenti: (a) `useArtboardDrag` (`:2107`) — číst `getViewport()` imperativně v pointer handlerech (drag matematika potřebuje zoom jen v okamžiku eventu = `event-time` v taxonomii); (b) `activeArtboardId` (`:1752-1773`) — přepočet přesunout na settle subscription místo per-publish; (c) overlays (`:3051`, `:3300` minimap/marquee) — Task 6. `ctxValue` pak závisí jen na `rectFor/artboards/reportMeasuredHeight/activeArtboardId/refs` → během gesta se nemění → **DCArtboardy se během pan/zoom nere-renderují vůbec**.
- **Pattern**: refs-only callback konvence (`:930-958`).
- **Gotcha**: `activeArtboardId` je v ctxValue — jeho settle-only přepočet znamená, že `aria-current`/halo se přepne až po dojezdu (žádoucí; dnes to stejně přeskakovalo mid-gestem). `postMessage('active-artboard')` (`:1780`) zůstává na settle.
- **Validate**: `cd apps/studio && bun test` + Profiler: 0 DCArtboard renderů během gesta na 128-board fixture.

### ✅ Task 6: minimap + zoom HUD + annotations chrome na živé čtení (pinch carve-out) — DONE

- **Do**: (a) Minimap viewport-indikátor a zoom % text řídit přes `useViewportRaf` (přímý style/text zápis, žádný setState per tick). (b) `annotations-layer.tsx:954` — root nesmí číst `controller.viewport`; zoom-invariantní geometrie přepnout na CSS: `writeTransform` zapíše `--dc-zoom` custom property na `.dc-world` **v každém frame gesta** a chrome používá `calc(... / var(--dc-zoom))`; hit-test thresholdy už čtou `vpRef` imperativně (zůstává). (c) **BREAKER top-risk carve-out: nejdřív inventarizovat VŠECHNA `1/zoom` counter-scale místa** (section-label chipy `:572-583`, connector doty, multi-select bbox, resize handles…) a každé převést na `--dc-zoom` NEBO doložit, proč smí být settle-only. Settle-only counter-scale = chrome se během pinche škáluje se světem a na settle „lupne" zpět — přesně ten LOD flicker, který už byl jednou odstraněn, a pan-only smoke ho neodhalí. (d) Stroke geometrie se během gesta nemění (portál v `.dc-world` transformuje nativně) → strokes subtree se nesmí re-renderovat; doplnit element-level memo, pokud profiler ukáže opak.
- **Pattern**: `vector-effect="non-scaling-stroke"` už řeší tloušťku čar bez JS (`annotations-layer.tsx:722-724`) — `--dc-zoom` je stejný princip pro rozměry chrome.
- **Gotcha**: WebKit path používá `transform: scale` — `--dc-zoom` se musí zapisovat v OBOU větvích `writeTransform`. Fallback `var(--dc-zoom, 1)` všude. Test musí obsahovat PINCH-ZOOM scénář, ne jen pan.
- **Validate**: `cd apps/studio && bun test test/annotations-layer.test.ts` + vizuálně při pinchi: labels/chipy/doty drží px velikost KONTINUÁLNĚ (žádný snap na settle).

### ⊘ Task 7: annotations memo/culling — NEPROVEDEN (annotation renders už 20→2; profiler neukazuje SVG paint jako hrdlo)

- **Do**: Po Task 4–6 ověřit probe číslem, že strokes subtree se během gesta nere-renderuje. Pokud paint v SVG zůstává bottleneck (Task 1 čísla pro Team Retro): (a) memoizovat stroke komponenty (element-level `React.memo`, `renderStrokes` memo `:2247` už drží pole), (b) `<image>` stickies (31 ks na retro boardu) `decoding="async"` + jedna `contain:paint` vrstva, (c) zvážit cluster-level culling. BREAKER poznámka do budoucna: scoped, smazatelný canvas/GPU renderer JEN pro stroke vrstvu je legitimní eskalace — ne v této vlně.
- **Pattern**: artboard culling blok (`canvas-lib.tsx:2268-2277`) — stejné zdůvodnění, SVG-přizpůsobené.
- **Gotcha**: `pointer-events: none` na stroke kontejneru (`:3812`) — hit-testing je model-based (vlastní geometrie), culling ho nesmí rozbít.
- **Validate**: `bun test test/annotations-layer.test.ts` + Team Retro reprodukce: pan/zoom smooth, stickies bez blank fází.

### ⊘ Task 8: compositor budget — NEPROVEDEN NA ZÁKLADĚ MĚŘENÍ (A/B pod noise floorem; měnit = riskovat doložený moodboard případ)

- **Do**: Podle A/B/C čísel z Task 2: buď (i) filter-free boardy promotion nepotřebují → `will-change` sundat plošně a přidávat jen boardům s deklarovaně drahým paintem, nebo (ii) nahradit plošné `.dc-artboard { will-change: transform }` (`:366`) třídou řízenou IntersectionObserverem (root = host, rootMargin ~1 viewport): boardy v/blízko viewportu `.dc-promoted { will-change: transform }`, vzdálené ne (kryje je `content-visibility`), nebo (iii) gesture-scoped promotion (přidat na gesture-start on-screen boardům, sundat po settle+idle). Cíl: GPU paměť O(viewport), ne O(canvas) — a filter-heavy moodboard (původní RCA případ) NESMÍ regresovat.
- **Pattern**: RCA addendum 2, lever 3 („gesture-scope the board promotion") — tohle je jeho realizace.
- **Gotcha**: IO callback nesmí běžet per-frame během pan (throttle na idle/settle); přepnutí `will-change` = jednorázový re-raster boardu — dělat mimo gesto, ne uprostřed (BUILDER risk: promote/demote churn ověřit v Safari Layers/Timeline). Nesundávat `isolation`/`contain` (drží blend izolaci — RCA).
- **Validate**: Safari Web Inspector Layers: composited vrstvy na 128-board fixture škálují s viewportem (≤ ~30, ne 128); žádný crash/blank na desktop .app; moodboard regrese test zelený.

### ⊘ Task 9: SPIKE CSS `zoom` — ODLOŽEN (samostatný spike, bez vazby na tuto vlnu)

- **Do**: Re-test RCA fix #3: Safari 18+/aktuální WKWebView má spec-compliant `zoom`. Na fixture ověřit: kaskáduje do textu? Relayout jank při pinchi? Pokud je `zoom` dnes na WebKitu composited-fast a crisp, sjednotit obě větve `writeTransform` (`:986-1003`) na `zoom` → odpadá settle crisp re-raster úplně (nejvyšší strop této vlny). Pokud ne, zapsat proč a nechat větve být.
- **Pattern**: existující Blink větev (`:998-1001`) — WebKit by převzal identickou cestu.
- **Gotcha**: `zoom`+`transform` interakce je přesně to, co bylo rozbité (viz `:975-984` komentář + RCA `issue-safari-wkwebview-canvas-zoom`) — spike MUSÍ testovat na reálném WKWebView shellu (desktop-e2e), ne jen Safari.
- **Validate**: spike report v plánu (go/no-go + čísla); go → samostatný task v další iteraci.

### ✅ Task 10: WebKit settle — scale-gated re-raster zachován; settle nyní jeden koalescovaný commit — DONE

- **Do**: Ověřit/zpevnit settle cestu po Task 2: crisp re-raster (`:1047-1049`) zůstává scale-gated; navíc koalescovat settle → publish → activeArtboard přepočet → annotations sync do JEDNÉHO React commitu (ne kaskáda tří setState). Změřit settle spike na 128-board fixture před/po.
- **Pattern**: existující `zoomAtInteractStartRef` gate (`:939-945`).
- **Gotcha**: `onSettle` persistuje viewport na server (`:716` PATCH) — nesmí se ztratit ani zdvojit.
- **Validate**: Profiler: settle = 1 commit; frame-time spike na settle < 100 ms na fixture.

### ✅ Task 11: CREATE benchmark surface — historie + delta HOTOVO; `maude design perf` verb HOTOVO; `/design:smoke --perf` mód CHYBÍ

- **Do**: Uživatel chce benchmark render enginu vidět, ne jen jednorázově naměřit („výsledek smoke testu před a po"). (a) Probe z Task 1 persistuje každý běh do `<designRoot>/_smoke/perf/history.jsonl` — jeden řádek = `{date, maudeVersion, gitSha, engine: blink|webkit-browser|webkit-desktop, canvas, boards, strokes, p50FrameMs, p95FrameMs, longtasks, reactCommitsDuringGesture, compositedLayers?}`. (b) Při běhu probe vytiskne DELTA tabulku proti poslednímu záznamu stejné dvojice (canvas, engine) — „before/after" je tak vidět přímo v terminálu a historie zůstává na disku. (c) Povýšit probe na veřejný verb **`maude design perf`** (bin `perf.sh` + CLI dispatch + DDR-062 whitelist + reachability test) a přidat **`/design:smoke --perf`** mód: po smoke průchodu spustí probe na aktivním/největším canvasu a připojí perf sekci (včetně delta) do smoke reportu. (d) `_smoke/` je už v runtime-state taxonomii (DDR-115) — historie je per-machine, negituje se; POZOR: nový path nevyžaduje změnu tří ignore listů (spadá pod existující `_smoke/`), ověřit.
- **Pattern**: `smoke.sh` + `/design:smoke` command markdown (výstupní report formát); `curl-local.sh` jako vzor nedávno přidaného verbu (bin + dispatch + whitelist).
- **Gotcha**: DDR-062 — plugin markdown smí volat jen `maude design <verb>`; `cli/lib/plugin-cli-reachability.test.mjs` a `cli/lib/figma-codegen-reachability.test.mjs` vzory pro test. Absolutní thresholdy do CI nedávat (nestabilní GPU) — gate zůstává relativní delta na stejném stroji.
- **Validate**: `maude design perf --boards 128 --strokes 150` dvakrát → druhý běh vytiskne delta tabulku; `/design:smoke --perf` v scratch projektu připojí perf sekci; reachability testy zelené.

### ◐ Task 12: dist bundle + docs — bundle NETŘEBA (canvas-lib se kompiluje server-side); RCA addendum 3 + DDR zbývá

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commitnout `dist/client.bundle.js` + `dist/styles.css`. Aktualizovat ENGINE_CSS komentáře + RCA odkazy; přidat addendum 3 do RCA (co tato vlna změnila a proč); `/flow:record-ddr` pro „gesture-static React + bounded compositor budget" (supersede vztah k DDR-… z addendum 2 fixů zapsat do kg).
- **Gotcha**: Committed bundle = co shipne (CLAUDE.md); po `bun test` zkontrolovat `git status apps/studio/dist/`.
- **Validate**: `bash scripts/check-runtime-bundles.sh` + `pnpm test:dev-server`.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (bun:test v `apps/studio`)
3. **Build**: `pnpm --filter @maude/site build` (site negativně nedotčen) + `cd apps/studio && bun run build.ts --release`
4. **Perf before/after**: `maude design perf` na 128-board fixture + obou reprodukcích — cíl: 0 React commitů během gesta, p95 frame time výrazně pod baseline (delta tabulka z `_smoke/perf/history.jsonl`), settle spike < 100 ms
5. **Cross-engine ruční matrix**: Chrome (Blink `zoom` path) + Safari + **Tauri desktop .app** (WKWebView, primární bolest) na obou reprodukčních canvasech ze `~/git/studyfi/studyfi-design`
6. **Regrese interakcí**: drag (leader+followers), marquee, Cmd+click select, Cmd+1/fit, minimap drag, undo/redo, komentáře, whiteboard kreslení + eraser, `/design:smoke` na studyfi-design repu
7. **Desktop e2e**: `desktop-e2e` skill scénář — otevřít velký canvas, pan/zoom, ověřit ne-blank render + responzivní UI

## Scenario Coverage

Enginová práce bez nového UI — cross-platform scenario-runner (ios/android) není relevantní; platformy = 2 engines × 2 shelly (browser/desktop), pokryté validací 5–7. Nový trvalý scénář: `desktop-e2e` „large-canvas-pan" (Task 1c) + benchmark historie `/design:smoke --perf` (Task 11).

---

## Acceptance Criteria

- [ ] Během pan/zoom gesta: **0 React commitů** (Profiler) a 0 layout/recalc z canvas-lib kódu (Performance timeline)
- [ ] 128-board canvas + 150-sticky board: pan i zoom subjektivně plynulé na WKWebView desktopu (primární target) — ověřeno na reálných reprodukčních canvasech
- [ ] Composited layer count škáluje s viewportem, ne s velikostí canvasu
- [ ] Žádná regrese: drag/marquee/minimap/undo/comments/draw/Cmd+click/fit — ruční matrix + existující bun testy zelené
- [ ] Perf čísla before/after zapsaná v `_smoke/perf/history.jsonl` + delta tabulka v retru; `maude design perf` + `/design:smoke --perf` funkční (benchmark viditelný opakovaně, ne jednorázově)
- [ ] RCA addendum 3 + DDR zaznamenán (kg ingest)
- [ ] `dist/` bundle rebuild release-minified a commitnutý; `check-runtime-bundles.sh` zelený
- [ ] Zamítnuté cesty (snapshot LOD, GPU rewrite) zdokumentované s důvodem v DDR — příští „sekání" ticket nezačíná od nuly

---

## Retro

- **Měřit dřív, než se opravuje, se vyplatilo dvakrát — a pokaždé jinak.** Baseline zabránil tomu, aby se refaktor pustil naslepo (na Blinku warm nebyl žádný problém k opravě), a pak právě měření našlo skutečné místo bolesti (studio embedding, 20 → 42 ms), které v plánu nebylo vůbec. Plán mířil celý dovnitř `canvas-lib`; bez harness by se opravovalo tam, kde se nesekalo.
- **Benchmark si vynutil čtyři opravy sám sebe, každou po reálném selhání** — izolovanou browser session (cizí session odnavigovala tab uprostřed měření), warm-up + medián (dva identické běhy se lišily o 60 %), odmítnutí zapsat běh bez pohybu world transformu, a správný směr zoomu ve fit-all. Poučení do `/flow:plan`: u výkonového úkolu patří „jak poznáme, že měříme správně" mezi úkoly, ne mezi předpoklady.
- **Debata (BUILDER/SHIPPER/BREAKER) zaplatila sama za sebe jedním rizikem.** BREAKER předpověděl „pět `1/zoom` counter-scale míst", která settle-only publish rozbije — bylo jich přesně pět a bez toho upozornění by se flicker objevil až u uživatele. BUILDERovo riziko („scripting může být menšina frame time") se navíc naplnilo doslova a zabránilo přehnanému nároku na výsledek.
- **Dva úkoly z plánu byly správně NEudělány.** Task 5 (viewport ven z kontextu) odpadl, protože settle-only publish splní invariant levněji; Task 8 (bounded promotion) padl na měření (A/B pod noise floorem) proti doloženému přínosu pro filter-heavy canvasy. Plán by měl u výkonových úkolů rovnou psát podmínku „udělej jen pokud měření ukáže X" — jinak se dělají všechny.
- **Souběžné session v Syncthing stromu jsou reálný nepřítel měření.** Během práce zmizel a znovu se objevil reprodukční canvas (přejmenování složek jinou session), sdílená agent-browser instance se odnavigovala, a load average vyšplhal přes 300 kvůli cizím iOS simulátorům — dva testy pak spadly na timeout a jeden běh ukázal o 60 % horší čísla. Proto probe tiskne spread a proč se závěry opírají o render-count (na zátěži nezávislý), ne o absolutní ms.
- **Otevřené a poctivě přiznané:** studio násobič 2× je reprodukovaný, ale nevysvětlený (vyvráceno: postMessage, studio chrome), a WKWebView desktop zůstává nezměřený — Safari je nejbližší proxy, ne shell, ve kterém uživatel pracuje.
