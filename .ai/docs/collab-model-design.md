# Pre-E0 research: collaboration model alignment + UX mental model

> **Čteš před spuštěním E0, nespouštíš samostatně.** Sloučen ze dvou dokumentů vzniklých 2026-06-04: (1) alignment ranní debaty s epicem + feasibility + UX hypothesis verification, (2) UX mentální model pro non-technical users. Oba jsou přímý input pro **E0 Task 4** (psaní DDRů). Po napsání DDRů v E0 je tento soubor archivní kontext.

---

## Část 1 — Alignment: ranní debata ↔ epic

### TL;DR

1. **Ranní debata nezávisle re-derivovala ~80 % epicu.** Local-first + git-backed, git jako distribuční hranice, komentáře jako conflict-free JSON, schovat git za plain verbs, native app s repo/branch switcherem — vše už rozhodnuté v epicu a velká část nasazená.

2. **Jedinou originální premisou debaty je falešná premisa.** Debata odmítá Yjs/CRDT protože "real-time by ztratil historii a local-file model." V Maude Yjs tohle **nedělá** — per DDR-064 je Y.Doc živá vrstva a soubor na disku je git-owned projekce (snapshot při quiescence, DDR-051). Git vlastní každý soubor i commit. "Vyhodit CRDT aby git history žila" řeší problém, který implementace vyřešila jinak.

3. **Live Yjs co-editing je NASAZENÝ a DEFAULT-ON** (loopback) a hub-relayed cross-machine. Odmítnutí = smazání fungujícího, security-hardened subsystému (Phase 8/9/9.1/9.2; DDR-051/052/054/064/078/079).

4. **UX evidence říká: odmítnutí real-time je špatný call pro tool pozicovaný jako "FigJam-like."** Abstract je náhrobek (~$57M, Adobe koupil jen comment layer, VC jádro opuštěné). Penpot je git-friendly SVG a přesto postavil multiplayer. Dvě load-bearing hypotézy debaty (hard "sync-first" gate, edit→save→push beats real-time) jsou přesně ty, co padají.

5. **Záchranný poklad debaty: artboard LOCKING.** Levný, additivní, sedí přesně tam kde epic má gap: un-mergeable TSX code body (gated za DDR-054). Locking jako komplement live presence/comments, ne náhrada.

**Net recommendation:** Zachovat epic's two-layer model (git = distribuce, Yjs = live co-edit). **Adoptovat** artboard locking z debaty, scopovaný na code-body lane. **Odmítnout** hard sync gate + mandatory handshake (změkčit na soft nudge). **Opravit** premise debaty "Yjs ztrácí git historii" v E0 collaboration DDR.

---

### Zdrojové dokumenty (co bylo porovnáno)

| | Epic (`epic-native-collab-app.md`, 2026-06-03) | Ranní debata (MOD handoff, 2026-06-04) |
| --- | --- | --- |
| Collaboration core | **Two-layer:** git = lifecycle/distribuce; **Yjs/hub = live co-edit** (edits + annotations + comments); cursors ephemeral | **edit → save → push**, no streaming; **artboard locking**; comments separate JSON |
| Real-time co-edit | **Zachován** (E5), gated pro peer *kód* za DDR-054 iframe hardening | **Odmítnut záměrně** (YJS/Hypercore/Jetstream jmenovány + zamítnuty) |
| Conflict strategy | Push-reject → "Get latest first"; per-file keep-yours/take-theirs jako edge case | **Pessimistic locking** jako primární mechanismus |
| Sync model | Soft "changes available → Get latest" nudge | **Hard gate:** same branch + same commit + clean tree *před* live collab |
| Transport | Hub (hocuspocus + Yjs) | "Lightweight P2P signaling, small JSON broadcasts" |

---

### Feasibility tabulka

| Požadavek debaty | Stav |
| --- | --- |
| Komentáře jako conflict-free JSON | ✅ **nasazeno** (DDR-055) |
| Lightweight presence broadcasts | ✅ **nasazeno** — awareness channel; lock = jedno pole navíc |
| Agent presence (virtual collaborators) | ✅ **nasazeno** (DDR-078) |
| Live co-edit anotací/komentářů cross-machine | ✅ **nasazeno** přes hub |
| Artboard **locking** | 🟡 levné, net-new — **nejlepší nápad z debaty** |
| Native app + in-UI git | 🟡 plánováno (E1/E2/E3), měsíce práce |
| „Odmítnout Yjs/CRDT" | 🔴 **regrese** — maže fungující subsystém, premise je fakticky chybná |
| „P2P computer-to-computer streaming" | 🔴 **zamítnuto** (DDR-047) |

---

### UX hypotézy — verdikty (research agent, 14+ prior-art zdrojů)

| # | Hypotéza | Verdikt | Proč |
| --- | --- | --- | --- |
| H1 | edit→save→push beats real-time | **Padá** (pro FigJam positioning) | Abstract (~$57M, Adobe koupil jen comment layer). Penpot = git-native SVG, přesto multiplayer. |
| H2 | Lock to prevent > merge to resolve | **Drží, s výhradami** | Správné pro un-mergeable artifacts (Perforce `+l`). Sharp edges: stale locks + granularita. |
| H3 | Hard "sync-first" gate | **Padá — největší riziko** | Figma/Docs mají *zero* pre-collab gate. Devexperts field report popisuje tuhle friction skoro po řádcích. |
| H4 | Git hidden behind plain verbs | **Drží, s výhradami** | Verbs fungují; *concept of divergence* proniká i přes rename. (De Rosso & Jackson; Kactus failure.) |
| H5 | Opt-in collaboration handshake | **Rizikové** | Existuje jen proto aby podpíral H3. Fix H3 = handshake přestane mít smysl. |
| H6 | Comments always flow | **Drží — nejsilnější část** | Append-only = conflict-free. Jediné, co z Abstractu přežilo. |
| H7 | Async = visual pull request | **Drží, s výhradami** | Správný frame pro review; developer-brain leak jako *jediný* frame. Rename: "Send for review." |

---

### Smířený model — tři lanes, tři strategie

| Lane | Co | Strategie | Zdroj |
| --- | --- | --- | --- |
| **1. Distribuce** | Které canvasy existují na disku | **Jen git** — push→pull, no cold-start, no create/delete propagation | Oba souhlasí |
| **2. Live overlay** | Komentáře, anotace, presence, kurzory, selection, viewport | **Yjs (nasazeno)** — live + conflict-free; komentáře/anotace persist, awareness ephemeral + gitignored | Epic (zachováno) |
| **3. Code body** | Canvas TSX (peer-authored kód) | **Artboard LOCK** — jeden editor; broadcast přes awareness; release na commit/lease-expiry. Žádný CRDT merge, žádný merge UI. | **Nápad z debaty**, scopovaný správně |

---

### Konkrétní změny v E0 DDRech (actions pro Task 4)

**A1** — Collaboration DDR zapsat jako **tří-lane model** (ne dva). Explicitně uvést: Yjs v Maude NEztrácí git historii (soubor = git-owned projekce, DDR-064/051) — premise debaty je opravena, ne adoptována.

**A2** — Zapsat: TSX code lane = pessimistic locking (ne CRDT merge). Citovat debatu (§6.5), H2 verdict, Phase 10's "hardest problem / unshipped." Stale-lock UX (lease + visible owner + one-tap takeover) = hard requirement, ne v2 nicety.

**A3** — Down-scope sync gate v E5 + E2 z "hard gate" na soft nudge + auto-checkpoint. Žádná "commit first" zeď. Pairing-session handshake jako affordance, ne gate.

**A4** — Async-review surface přejmenovat: "Send for review" / "Review changes" / before-after visual diff. Nikdy "pull request."

---

## Část 2 — UX mentální model pro non-technical users

### Základní princip

> **Jediná věc, co user musí chápat: lidé. Jsme teď spolu v místnosti, nebo ne? Všechno ostatní — sync, pull, push, merge — je práce appky, ne uživatele.**

Dualitu "jednou live, jednou pull" neučíme. Dualitu **skryjeme** — viditelná proměnná je jen presence (dot spoluhráče svítí nebo šedý), hub je sdílená paměť draftu, catch-up je automatický. Manuální git reconciliation se ukáže jen při offline divergenci, a i tehdy jako *vizuální picker*, nikdy jako git.

> ❌ „Někdy je to live, někdy musíš pullnout."
>
> ✅ „Když jsme spolu v místnosti, je všechno live. Když nejsme, najdeš to, co jsem dodělal, jako vzkaz na stole."

---

### Metaforový stack (4 metafory, každá vlastní job)

| Job | Metafora | Proč funguje |
| --- | --- | --- |
| Celý systém | **Shared room + vzkaz na stole** | Přesně mapuje architekturu: místnost = live (hub); vzkaz = change co najdeš po návratu. Vysvětluje new-canvas case zdarma. |
| Catch-up / „je tam něco nového" | **Unread** (group chat) | Universální fluency; „✦ 3 nové od Anny", dismissible, nikdy blocking. Sociální koncept, ne systémový. |
| Nový / nesdílený objekt | **„Draft — jen ty to vidíš"** | Stav sdílení = vlastnost *objektu*, ne *připojení*. Lidi chápou „tohle je ještě draft" okamžitě. |
| Onboarding one-liner | **Live call vs. voicemail** | „Když jsme oba tady, mluvíme live. Když ne, nechávám vzkaz co najdeš." |

**Zakázaný slovník:** `branch`, `merge`, `main`, `commit`, `push`, `pull`, `fetch`, `behind`, `diverged`, `conflict`, `sync` (jako verb co user spouští), `(Conflicted copy)`.

---

### Co user vnímá — jediný state machine

**O spoluhráči (presence):**
- 🟢 **Tady teď** — avatar svítí, v tomto draftu → vidíte se live.
- ⚪ **Pryč** — odešel → najdeš jejich hotové změny; oni najdou tvoje.

**O canvasu (stav sdílení):**
- **Shared** (normální) — všichni v draftu ho mají.
- **Draft · jen ty** (chip) — právě jsi ho vytvořil/změnil, ostatní ho ještě nemají; sdílí se sám za pár vteřin.

To je celá plocha. **2 presence stavy + 2 object stavy.** Žádné módy, žádný git.

---

### Jediná záruka, která to dělá poctivým

> **Konflikt je strukturálně nemožný, dokud jste spolu live.**

Live vrstva drží oba working trees byte-identické → každý „Save version" je pro druhého guaranteed fast-forward. Konflikt vznikne **jen** z práce od sebe. Slíbit uživateli a myslet to vážně:

- **Spolu → nikdy problém.**
- **Od sebe na stejné věci → appka ukáže oba a necháš vybrat (koukáním, ne mergem).**

---

### Scénáře

**1. Happy path — live together**
U1 je v draftu "Redesign". U2 vidí ambient cue: **"Anna je v *Redesign* · Připojit se."** (ambient, ne formální accept-gate). U2 klikne Join → jejich práce se tiše auto-checkpointne → draft se otevře → oba 🟢 **Tady teď**: kurzory, edity, anotace, komentáře live. Kdo klikne „Save version" je jedno — fast-forward záruka to pokryje.

**2. Nový canvas — #1 dreaded confusion — vyřešeno**
U1 vytvoří „Login screen."
- U2 je 🟢 **tady** → canvas se u U2 objeví **live, okamžitě** — místnost = celý draft, ne jeden canvas. Žádný chip, žádný pull.
- U2 je ⚪ **pryč** → U1 vidí chip **„Draft · jen ty"**. Auto-sdílí se (background) za vteřiny; U2 ho po návratu prostě má, flagovaný **✦ nový**.

> Fix: stav sdílení = vlastnost **objektu** ("jen ty to vidíš"), ne **připojení**. Unshared window trvá vteřiny díky background auto-share.

**3. Async catch-up**
U2 otevře Maude. Žádný git prompt. Draft je aktuální + soft dismissible banner **„✦ 3 nové od Anny od té doby co jsi byl tady · Ukázat"** (unread pattern, nikdy "pull").

**4. Not happy path — oba změnili totéž od sebe**
Rare. Vizuální picker, nikdy textový merge:
> „Ty a Anna jste oba změnili *Login screen* od sebe."
> [ 🖼 **Tvoje verze** ] [ 🖼 **Anny verze** ]
> **Nechat moje · Nechat Anny · Nechat obojí** (jako dvě canvasy)

Default-safe = **obojí** → zero data loss. Komentáře/anotace do dialogu nikdy nevstoupí.

---

### Prevence konfliktů (žebřík — prevent > resolve)

1. **Defaultně jeden shared draft.** Osobní drafty pro solo exploraci; kolaborace = setkání v jednom draftu.
2. **Hub jako sdílená paměť.** Online teammates dostávají změny automaticky (jako ✦ unread). Divergence potřebuje offline.
3. **„Draft · jen ty" + background auto-share.** Unshared window trvá vteřiny.
4. **Presence + soft signal.** Na canvasu, co někdo edituje, ostatní vidí **„Anna to edituje"**. Annotate/comment volně; canvas body = soft single-writer s „Take over".
5. **Offline „claim" záznam.** Při editaci bez hubu appka zaznamená; při reconnectu okamžitě flaguje clash.

> **Hard locks:** jen na unmergeable code body; takeover = one-click attributed („Anna odešla před 20 min — převzít?"). Orphaned locks = největší problém každého check-out systému.

---

### Mikrokopie — co říkáme a co nikdy

| Situace | Říkáme | Nikdy neříkáme |
| --- | --- | --- |
| Spoluhráč přítomen | „Anna je tady teď" | „Anin client je připojený" |
| Spoluhráč v jiném draftu | „Anna je v *Redesign* · Připojit se" | „Anna je na branchi redesign · checkout?" |
| Nový nesdílený objekt | „Draft · jen ty to vidíš zatím" | „Uncommitted / unpushed" |
| Přišly změny | „✦ 3 nové od Anny · Ukázat" | „Jsi 3 commity pozadu · Pull" |
| Uložit milník | „Uložit verzi" | „Commit" |
| Samostatná linie práce | „Draft" / „kopie k hraní si" | „Branch" |
| Vložit draft zpět | „Poslat svůj draft do sdílené verze" | „Merge / open a PR" |
| Jít zpět v čase | „Vrátit se k dřívější verzi" | „Reset / checkout SHA" |
| Skutečný konflikt (rare) | „Vy oba jste změnili *Login* od sebe — nechat který?" | „Merge conflict v Login.tsx" |
| Návrat z offline | „Doplňujeme tě…" (pak je draft prostě aktuální) | „Fetching / rebasing" |

---

### 3 věci co se user učí (a nic víc)

1. **Draft je tvoje linie práce.** Otevři ho; ty a kdokoliv jiný v něm se vidíte live.
2. **Když je někdo pryč, najdeš jejich hotovou práci čekající — a oni najdou tvoji.** (Live call vs. voicemail.)
3. **„Uložit verzi" zanechá záložku, ke které se vždy vrátíš.** Volitelné, pro milníky — appka tě chrání automaticky mezi tím.

Pokud user internalizuje jen #2, celá dualita je vyřešená.

---

### Co to mění v epicu / E0 DDRech

1. **V trusted live session se nové canvasy propagují live** — změkčit epicové „no cold-start materialization." Pravidlo platí pro *nedůvěryhodné* contexty (hub-multiplexing — already cut); pro invited session ne. DDR-054 iframe sandbox zůstává (rendering concern, ortogonální k distribution consent).
2. **Hub = „sdílená paměť"** — hydrate-on-open eliminuje user-triggered pull pro online users. Zaznamenat jako catch-up mechanismus v E0 collaboration DDR.
3. **Sync gate → auto-checkpoint + ambient Join** (žádná "commit first" zeď).
4. **Conflict UX = coarse visual picker, „keep both" default** — never textual.
5. **Vocabulary contract** — microcopy tabulka = hard rule pro E2/E4/E5 UI.

---

### Edge-case stress test

| Edge case | Drží? | Co user zažije |
| --- | --- | --- |
| U1 smaže canvas | ✅ | Live → zmizí oběma hned. Pryč → zmizí po návratu s „✦ Anna smazala *Login*" (undo na klik). |
| U2 offline edituje A, U1 online edituje A, reconnect | ✅ (vzácné) | Vizuální picker. Pravidlo *od sebe = vyber koukáním* platí. |
| U2 se připojí uprostřed session | ✅ | Dostane aktuální stav z hubu. Žádné „Draft · jen ty" reziduum. |
| Hub spadne uprostřed live session | ⚠️ | Viz Q5 (open questions). |
| 3+ lidí, smíšená přítomnost | ✅ | Presence per-člověk. Nic nového. |
| Oba kliknou „Save version" naráz (live) | ✅ | Fast-forward záruka → druhý save = no-op. |
| U1 přejmenuje canvas, U2 ho má otevřený | ✅ | Live → teče normálně. Async rename+edit = picker. |
| Delete vs. edit (U1 smazal, U2 od sebe editoval) | ⚠️ | Viz Q6 (open questions). |

---

### Open questions pro E5 design

1. **Auto-share cadence** — hub live průběžně (bez commitů); git commit: Save version + auto-checkpoint na leave/idle. Potvrdit kadenci.
2. **Hub dependency** — offline↔offline (žádný hub) nutně = git push/pull (voicemail). Acceptable degradation?
3. **„Draft" naming** — `draft` vs `version` vs `space`. Research: avoid „branch"; lean = „draft". Potvrdit.
4. **Same-canvas live editing code body** — soft single-writer ("Anna edituje · Take over") nebo volné? Lean: soft single-writer jen na code lane.
5. **Transient hub výpadek ≠ teammate odešel.** Threshold: ≥ 30 s bez signálu = opravdu pryč; < 30 s = transient, přetlumit presence bez odebrání. Potvrdit threshold.
6. **Delete-vs-edit konflikt.** Default-safe = obnovit editovanou verzi s dialogem. Je to vždy správný default?
