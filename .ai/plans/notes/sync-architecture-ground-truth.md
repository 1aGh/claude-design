# Sync — ground truth pro redesign (2026-08-16)

> **Účel.** Podklad pro čerstvou `/flow:plan` session, která má znovu promyslet
> sync architekturu. Tři dny intenzivního dogfoodu (alligators + alligators-mirror,
> releasy v0.60.4 → v0.60.7) odhalily a opravily sérii děr — ale každá oprava
> přidala další lane/trigger/reconciler a uživatelský verdikt zní: *„brutálně se
> do toho zamotáváme."* Tenhle dokument je (1) mapa toho, jak to DNES funguje,
> (2) co všechno jsme zkusili a s jakým výsledkem, (3) ověřená fakta o posledním
> zbývajícím selhání, (4) strukturální kritika + otázky pro redesign.
>
> Všechna tvrzení níže jsou z živé diagnózy (git forensics, Worker + container
> logy přes Cloudflare observability, /_asset-probe, manifest endpoint) — u
> každého je uvedeno, čím je doložené. DDR čísla odkazují na
> `.ai/archive/decisions/` a graf (`maude kg search`).

---

## 1. Jak sync DNES funguje — inventura všech drah

Jeden projekt se mezi desktopem a cloudem (cell) synchronizuje přes **sedm
nezávislých mechanismů**, každý s vlastním triggerem, transportem a reconcilerem:

| # | Dráha | Co nese | Transport | Trigger | Kód |
|---|---|---|---|---|---|
| 1 | **Doc lanes (CRDT)** | canvas body (html), css sidecar, meta (shared subset), comments, annotations, syncMeta stamps | Hocuspocus WS, Y.Doc per canvas | live (ms) | `sync/agent.ts` (desktop), `sync/projection.ts` + `migrate-seed.ts` (cell, `MAUDE_SHARED_DOC=1`), `sync/codec.ts` |
| 2 | **Asset push sweep** | vše co pustí classifier (`file-membership.ts`) | HTTP PUT `/assets/<key>` (bucket-class) / `/_asset-file/<rel>` (checkout-class), probe přes POST `/_asset-probe` | boot + fs:any (debounce 1,5 s), **out-of-process child** (DDR-222 — plný sweep destabilizoval Bun vedle dev serveru) | `sync/asset-push.ts`, `asset-sweep.ts`, `asset-push-worker.ts` |
| 3 | **Fast-lane push** (v0.60.7) | JEDEN právě zapsaný soubor | 1× probe + 1× PUT, **in-process** | fs:any, 400 ms settle | `pushOneAsset` v `asset-push.ts`, wiring `sync/index.ts` |
| 4 | **Asset pull** | assets referencované z lokálních `.tsx/.annotations.svg/.css/.meta.json` | GET `/assets/<name>` | po každém 20s remote pollu + (v0.60.7) okamžitě po dopadu reference-nesoucího souboru (`requestFastPull`, 750 ms) | `sync/asset-pull.ts` |
| 5 | **File plane (Plane B)** | manifest-driven replikace: inert-media, companion-text, code-module (owner gate) | GET `/api/files` manifest + `/_project-file/` | 20s poll; **flag-gated `linkedHub.syncFiles`, default OFF** | `sync/file-pull.ts`, `file-membership.ts` (+ hub mirror `file-membership.mjs`) |
| 6 | **Bucket mirror (cell)** | checkout → R2 | S3 PUT | boot sweepAll + `onWritten → sweepNew` na všech třech write doors (od v0.60.6) + 60s retry po failu | `apps/hub/src/asset-lane.mjs` |
| 7 | **Git autocommit + mirror/backup** | celý designRoot (VERSIONED taxonomie DDR-115) | git push / R2 backup generace / rehydrate při bootu cellu | autocommit cadence, cell boot | `sync/autocommit.ts`, `apps/hub/src/rehydrate.mjs`, `mirror-push.mjs`, `design-sync.mjs` (outbound-only PR!) |

K tomu **tři UI-refresh mechanismy**: HMR broadcast (`canvas-hmr` modes css/module/hard/meta + od v0.60.6 `asset` heal), collab live lane (cloud room), a `announceWrite` bridge pro kontejner (jen pro doc-projection zápisy pod cell pairingem).

A **dvě paralelní sync architektury**: desktop = per-canvas agent (`agent.ts`),
cell = shared-doc (`projection.ts` + `migrate-seed.ts` + collab room persistence).
Cold-start konfliktní logika existuje v OBOU (letos 2× zdvojený eraser bug).

## 2. Co jsme zkusili — chronologie nálezů a oprav

### v0.60.4 (2026-08-14) — tombstones, downward assets, file plane (dark)
- Canvas delete propaguje (tombstones); obrázek z browseru se dá stáhnout dolů
  (`asset-pull.ts` vznikl); file plane shipnul **za flagem, default OFF** —
  flip je zaznamenaná security událost (gate F1–F6, plán
  `feature-sync-file-plane.md` § Scope cuts). Changeset text ale chování
  prodával jako živé → mátlo diagnózu.

### Nález A — „annotations eraser" (v0.60.5, DDR-223)
- **Symptom:** obrázky v annotations se nesyncnou; strokes mizí po restartu cloudu.
- **Root cause (git forensics):** cold-start řešil annotations podle BODY
  vítěze a guard `!== ''` nepoznal 72B prázdný wrapper (`strokesToSvg([])`) —
  stale hub wrapper přepsal novější lokální strokes, v OBOU architekturách.
  S strokes zmizely i `assets/<sha8>` reference, které asset-pull skenuje.
- **Fix:** `syncMeta.annotationsEditAt` (per-lane obdoba `bodyEditAt`),
  `decideAnnotationsColdStart` (pure tabulka, `cold-start.ts`), pravidlo
  *unstamped emptiness never beats content*. Známý reziduál: constant-wrapper
  self-echo kolize v UI (`recentSelfSvgsRef`).

### Nález B — sweep spawn v .app (v0.60.5)
- „Executable not found in $PATH" — nikdo nenastavoval `MAUDE_BUN_PATH` pro
  kompilovaný maude-server; fallback `'bun'` na GUI PATH. Fix: compile entry
  `MAUDE_BUN_PATH ||= process.execPath` (BUN_BE_BUN re-entry, DDR-177 postura).

### Nález C — fresh-link mirror test (task alligators-mirror)
- Canvasy dorazily, DS ne → **není bug**, file plane byl flag-OFF. Per-project
  opt-in (`linkedHub.syncFiles: true` v obou složkách) → **„čerstvý resync
  funguje a dotáhne úplně vše"** (parity podmínka flip plánu SPLNĚNA).

### Nález D — čtyři asset díry (v0.60.6, DDR-224)
Worker + container logy (CF observability, dataset `containers` funguje!):
1. **`GET /assets/` byl bucket-only** — soubor, který cell sám servíroval
   browseru z checkoutu, odpovídal peerům 404 (doloženo: POST 201 v 9:32:47,
   GET 404 v 9:44). → checkout-first, bucket fallback.
2. **`PUT /_asset-file/` neměl mirror hook** („no bucket mirror" by design) →
   soubory checkout-only do příštího bootu. → onWritten → sweepNew.
3. **`sweepNew` selhával TIŠE** (failures v `result.failed`, nikdo nečetl) →
   loud log + 60s retry.
4. **Browser nikdy neretryuje failnutý obrázek** → nový HMR mode `asset`:
   media soubor na disku → shell re-pointne rozbité `<img>`/`<image>`
   (cache-bust, bez reloadu).
- Vedlejší ztráta: restart cellu při v0.60.6 rolloutu (ještě starý kód)
  zahodil checkout-only soubory — poslední výskyt třídy, kterou 2+3 zavírají.

### Nález E — latence (v0.60.7, DDR-225)
- **Symptom:** desktop→cloud minuty (čekání na debounce+spawn+full-walk sweep),
  cloud→desktop ~10–20 s (poll tick).
- **Fix:** fast-lane `pushOneAsset` (1 probe + 1 PUT, in-process — kvalifikuje
  DDR-222: zeď platí pro PLNÝ sweep, ne pro jeden fetch) + `requestFastPull`
  (dopad reference → okamžitý missing-only pull). Sweep/poll zůstávají
  reconcilery.

## 3. Aktuální stav (živě změřeno 2026-08-16 ~9:40)

- **Cloud → desktop: FUNGUJE** (uživatelsky potvrzeno, sekundy až desítky sekund).
- **Desktop → cloud: bajty DORAZÍ** — všechny 4 dnešní testovací assety
  (daf37857, cec9855a, 0e7a437d, 3893e66b) servíruje hub `/assets/` s 200;
  `_sync.json` `pushed: 2, failed: 0`. **Ale uživatel pořád vidí rozbitý
  placeholder v cloud UI.**
- **Prime suspect posledního hopu (nová hypotéza, neověřená):** hub PUT píše
  do checkoutu **v hub procesu**; studio child se o změně nedozví, protože
  v kontejneru rekurzivní `fs.watch` **nevidí atomické tmp+rename zápisy** —
  přesně gap, který `announceWrite` bridge (`sync/index.ts`) zavírá pro
  doc-projection zápisy, ale hub-side asset PUTy ho nemají. Bez fs:any není
  `asset` HMR broadcast → browser tab se nikdy nehealne → vypadá „nesyncnuto"
  do ručního reloadu. (Desktop směr healuje, protože macOS watcher pull-zápisy
  vidí.) **První věc k ověření v nové session.**
- Pozn.: uživatelův desktop byl při posledním testu pravděpodobně ještě na
  0.60.6 (fast-push log `[sync/assets] fast-pushed` se v logu nenašel) — bytes
  tam dotáhl sweep. I tak: transport OK, viditelnost NE.

## 4. Diagnostické nástroje, které se osvědčily

- `maude kg search "<topic>"` — 190+ DDR; sync klastr: DDR-102 (cold-start),
  DDR-115 (runtime-state taxonomie ×4 kopie), DDR-217 (asset push), DDR-222
  (out-of-process sweep), DDR-223/224/225 (tento týden).
- **Cloudflare observability MCP** — dataset `containers` nese stdout cellu,
  `cloudflare-workers` každý request (metoda+URL+status). Timestampy ms epoch.
- `POST /_asset-probe {paths:[…]}` s owner tokenem z `~/.config/maude/hubs.json`
  — presence v checkout∧bucket; `GET /api/files` — manifest checkoutu (ground
  truth co cell má); `GET /assets/<name>` — co cell servíruje.
- Git forensics v projektu (alligators autocommit historie) — dokázal eraser.
- `.design/_sync.json` — poslední sweep/pull stav; `_state/<slug>.ydoc.bin` —
  dekódovatelný Y.Doc cache (bun + yjs applyUpdate).
- POZOR na paralelní `bun test` běhy (kontaminují se porty/store) a na
  Syncthing na portu 8384 (koliduje s `nextPort()` range 4500–8499).

## 5. Strukturální kritika — proč se zamotáváme

1. **Sedm drah, tři reconcilery, žádný jediný zdroj pravdy o doručení.**
   Bajty můžou letět sweep-em, fast-lane-em, file plane-m, gitem, rehydrate-m —
   a žádná komponenta neumí odpovědět „je soubor X doručen všude?". Každý bug
   se diagnostikuje archeologií čtyř logů.
2. **Dvě cold-start implementace** (agent vs shared-doc/migrate-seed) — eraser
   musel být opraven dvakrát; každá budoucí lane-semantika taky.
3. **Push je scheduler-driven, ne event-driven.** Hub neumí říct peerům „mám
   nový soubor" — všechno dolů jede na 20s pollu + heuristických triggrech.
   Live doc lane přitom UŽ nese eventy v ms — jen se nepoužívá pro soubory.
4. **Dva stores na cellu (checkout + bucket) s vlastní konzistencí** — mirror,
   hydrate, „present = oba" sémantika probe, generace backupů. Velká část
   týdenních bugů byla přesně drift těchto dvou.
5. **Viditelnost ≠ doručení.** I když bajty dorazí, UI se musí zvlášť dozvědět
   (HMR heal) — a kontejnerový watcher gap znamená, že celá třída zápisů je
   pro UI neviditelná. „Sync nefunguje" v ústech uživatele znamená „nevidím to".
6. **Flag-gated file plane vs asset lanes = duplicitní jurisdikce.** S flagem ON
   tečou top-level assets DVĚMA drahami (file plane manifest + asset lane);
   fast-push proto potřebuje probe-guard proti echu vlastního pullu.
7. **Čtyři kopie DDR-115 taxonomie** (git/service, gitignore-block, .gitignore,
   file-membership ×2 s tripwire) — každá nová `_*` cesta = 4–5 míst.

## 6. Otázky pro redesign (návrhy směrů, ne rozhodnutí)

- **Jeden transport pro soubory?** Content-addressed manifest sync (à la git
  index / rsync batch) jako JEDINÁ dráha pro ne-CRDT soubory; doc lanes nechat
  jen pro to, co je skutečně kolaborativní (body/annotations/comments).
- **Event-driven notifikace:** hub po každém přijatém zápisu broadcastne
  `{file, hash}` po už-existující WS (sync socket i canvas-hmr socket) — peers
  pullnou hned, UI healne hned. Zabíjí 20s poll, watcher gap i fast-lane
  heuristiky najednou. (DDR-225 to odmítl jen jako scope-cut, ne principiálně.)
- **Jeden store na cellu:** checkout jako jediná serving pravda (od DDR-224 už
  fakticky je), bucket ČISTĚ jako durability snapshot (write-behind, žádná
  serving/probe sémantika).
- **Sjednotit cold-start:** jedna decision tabulka, jedna implementace, obě
  architektury ji volají (dnes: `decideColdStart` + `decideAnnotationsColdStart`
  jsou sdílené, ale APLIKAČNÍ kód je 2×; a proč vlastně ještě existují dvě
  architektury — dá se desktop převést na shared-doc?).
- **Doručenka:** per-soubor stav viditelný v Sync panelu („na hubu ✓ / u peerů
  ✓ / UI healnuto ✓") — polovina týdenní frustrace byla nemožnost říct, KDE
  se to zaseklo.
- **Flag flip `syncFiles`** (task #4): parity podmínka splněna; zbývá security
  gate F1–F6 (`/flow:validate-security` jako hard gate) — redesign by měl
  rozhodnout, jestli file plane v nové podobě vůbec přežívá jako samostatná dráha.

## 7. Co NEROZBÍT (invarianty, které týden potvrdil)

- DDR-102/223 fail-closed postura: **prázdno/stale nikdy tiše nepřepisuje
  obsah**; snapshoty před overwrite; unstamped emptiness never beats content.
- DDR-054 trust model: hub je peerům untrusted; receiver re-validuje každou
  cestu; canvas origin allowlist; žádné presigned URLs.
- DDR-115 taxonomie runtime vs versioned (a její tripwire testy).
- Owner gate na code-module lane; content-addressed názvy pro uploady.
- Idempotence všech push/pull operací (409/skip sémantika) — zachránila
  každý force-move a každý retry tohoto týdne.
- Loud failure logging (v0.60.6 lekce) — žádná dráha nesmí selhávat tiše.
