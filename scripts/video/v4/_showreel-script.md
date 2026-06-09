# maude — feature showreel + voiceover script (v5.2)

> **Pivot (2026-06-09).** Not a tutorial — a **showreel**: top features as a
> cinematic sequence that blows people away. Install dropped. Voiceover via
> ElevenLabs. Every beat grounded in a REAL maude capability (verified against
> `plugins/` + `apps/studio/` + `.ai/plans/`).
>
> **v5.1 changes (user):** DS moved to #2 and made richer (world-class
> questionary → moodboard shows the direction → robust full design system);
> added the emotional core — **"you talk to the AI *through* the canvas"**;
> expanded **flow as a second brain** (what it does + why it matters).
> **v5.2 changes (user):** added **multiplayer** (beat 65 — live, peer-to-peer
> via a self-hosted hub, no SaaS); **layered the second brain across 3 screens**
> (memory 92 · continuity 94 · ships 96); reframed handoff as **"to any
> production code"** (not shadcn-only).

## The cut — 15 beats, ≈90 s

Arc: **hook → a real design system, from a conversation → a canvas → it builds →
it judges itself → ✦ you direct it by pointing & drawing ✦ → and you're not alone
(multiplayer) → it does the hard things (vector, motion) → it ships → and it
remembers (a second brain, in three layers).**

| # | beat | feature (the wow) | on screen | grounded in | ~dur |
|---|------|-------------------|-----------|-------------|------|
| 00 | Cold open | the hook | dark void → `maude` resolves, one cursor on the dotted canvas | wordmark + canvas | 4s |
| 10 | The questionary + moodboard | DS discovery built on how the best designers work → a moodboard shows the direction | the Claude TUI asking sharp discovery Qs → a real "1am pinboard" moodboard assembles (type, swatches, mood + reference cards) | `/design:setup-ds` + `.design/_moodboard/*` | 8s |
| 20 | The robust design system | a full, tokenized DS — not a palette, a system | editorial specimens fan in: "Accent. One indigo.", type ladder, spacing, elevation, motion, components | real `system/maude/preview/*` specimens | 7s |
| 30 | The canvas | infinite multi-artboard canvas, in your repo | camera flies across a real canvas full of artboards; WORLD minimap | real `Canvas Viewport.tsx` / Studio | 5s |
| 40 | It draws itself | canvas-first iteration in real TSX | `/design:new` — a screen builds live on your DS: skeleton → hero → tokens → CTA, presence cursor | real Studio chrome + canvas fill | 7s |
| 50 | It critiques itself | critic panel + auto-fix loop | verdict card: signature/a11y/type/restraint scores resolve → "✓ auto-fix · 2 applied" | critic PANEL.md shape (illustrated) | 6s |
| 60 | **✦ You talk to it through the canvas** | the aha — point, comment, draw → it acts | ⌘-cursor lands on an element → chip `Hero.tsx:42`; a comment pin drops on a pixel; a hand-drawn arrow + "make this bigger" → the element changes | real Studio inspector + comments + annotations | 9s |
| 65 | Multiplayer | live, peer-to-peer, no SaaS | two (three) presence cursors move on the same canvas live; an edit by one peer lands for everyone; a `maude hub` invite link / connected-peers card | real `maude hub serve` + bidirectional sync (Phase 9) | 7s |
| 70 | Draw as code | the geometry engine (the moat) | a logo/icon assembles from geometry (splines/grid), crisp at 16px + single-color flatten | real `/design:draw` engine | 6s |
| 80 | Animate once | to-lottie, web + native 1:1 | a mark animates → emits `one .lottie` → same motion on a web frame + a phone frame | real `/design:to-lottie` | 6s |
| 90 | Ship it | handoff to ANY production code | a component drops into a real codebase — Next.js / Vite / Bun / raw TSX (shadcn registry is one path); `+ components/…tsx` lands wired to your tokens | real handoff / export (registry + raw code) | 5s |
| 92 | Second brain · memory | plans + decisions, written down | a PRD-grounded plan checklist forms → a DDR decision record card ("what · why · revisit") | real `/flow:plan` + `.ai/decisions/*` (DDR) | 6s |
| 94 | Second brain · continuity | pause today, resume tomorrow | a HANDOFF card + STATE timeline — session closes, reopens, the agent picks up the exact thread | real `/flow:pause` + `/flow:resume` + `.ai/state` | 5s |
| 96 | Second brain · it ships | validate everywhere → PR | a 5-platform scenario grid (web-desktop/mobile · iOS phone/tablet · Android) goes green → a PR opens | real `/flow:validate` + scenario-runner | 6s |
| 99 | End card | the close | brand lockup + `npm i -g @1agh/maude` + trust line, loop-safe to the void | real `logo.tsx` mark | 4s |

**What carries the film:** DS-from-a-conversation (10–20), the
talk-through-the-canvas aha (60), multiplayer (65), and the three-layer
second-brain (92–96). The moat trio (DS · vector · motion) is the visual
crescendo; the aha (60) is the heart.

Pure-design ≤70 s cut = drop 92–96 (keep a one-line second-brain nod). Default =
full ~90 s.

---

## Voiceover script (ElevenLabs)

**Voice direction:** dry, confident, unhurried — a senior designer who doesn't
oversell. Anti-corporate. Lets the visuals breathe; sparse, not wall-to-wall.
Short sentences, hard stops. Slight pause at each em-dash. The line at beat 60
("…it just gets it.") is the warmest — a small, knowing smile, not a hype shout.

**Suggested ElevenLabs settings:** a low/measured voice; Stability ~55,
Similarity ~75, Style ~15 (low exaggeration), Speed ~0.95. Render each line as a
separate clip so timing locks to the cut.

### Per-beat (line + delivery)

- **00 · Cold open** — *"Every design tool wants you to leave your code."* — beat — *"this one doesn't."* _(cold, deadpan; the turn lands on "doesn't")_
- **10 · Questionary + moodboard** — *"It starts the way the best designers do — with the right questions. It researches. Then it shows you a moodboard: here's the direction."*
- **20 · Robust DS** — *"Then it builds the whole system. Color, type, space, motion, components. Tokenized, consistent — yours."*
- **30 · The canvas** — *"On an infinite canvas. Your whole product, every screen — inside Claude Code."*
- **40 · It draws** — *"Describe a screen. Watch it build itself. Real components, real tokens, real code."*
- **50 · Critics** — *"Then critics score it — accessibility, type, restraint — and it fixes what it finds."*
- **60 · ✦ Talk through the canvas** — *"And here's what changes everything. You don't write prompts."* — beat — *"You point at the design. Drop a note on a pixel. Draw on it. And it just… gets it."* _(the heart — warm, unhurried)_
- **65 · Multiplayer** — *"And you're not alone on it. Live cursors, real-time — shared peer to peer, through a hub you host. No SaaS. No signup."*
- **70 · Draw as code** — *"Logos, icons, diagrams — drawn by a geometry engine. Never guessed."*
- **80 · Animate once** — *"Animate once. Ship one file — web and native, pixel for pixel."*
- **90 · Handoff** — *"Then hand it off — into any production codebase. Next, Vite, Bun, or raw code — wired to your tokens."*
- **92 · Second brain · memory** — *"And it remembers. It plans before it builds — and writes down every decision. What, and why."*
- **94 · Second brain · continuity** — *"Stop mid-feature. Come back tomorrow. It picks up exactly where you left off."*
- **96 · Second brain · it ships** — *"It validates across five platforms — then opens the pull request. A second brain that ships."*
- **99 · End card** — *"maude. No telemetry. No signup. The repo is the source of truth."*

### Clean VO block (paste into ElevenLabs, one line per clip)

```
Every design tool wants you to leave your code… this one doesn't.
It starts the way the best designers do — with the right questions. It researches. Then it shows you a moodboard: here's the direction.
Then it builds the whole system. Color, type, space, motion, components. Tokenized, consistent — yours.
On an infinite canvas. Your whole product, every screen, inside Claude Code.
Describe a screen. Watch it build itself. Real components, real tokens, real code.
Then critics score it — accessibility, type, restraint — and it fixes what it finds.
And here's what changes everything. You don't write prompts. You point at the design. Drop a note on a pixel. Draw on it. And it just… gets it.
And you're not alone on it. Live cursors, real-time — shared peer to peer, through a hub you host. No SaaS. No signup.
Logos, icons, diagrams — drawn by a geometry engine. Never guessed.
Animate once. Ship one file — web and native, pixel for pixel.
Then hand it off — into any production codebase. Next, Vite, Bun, or raw code — wired to your tokens.
And it remembers. It plans before it builds — and writes down every decision. What, and why.
Stop mid-feature. Come back tomorrow. It picks up exactly where you left off.
It validates across five platforms — then opens the pull request. A second brain that ships.
maude. No telemetry. No signup. The repo is the source of truth.
```

Word count ≈ 185 → ≈ 75–80 s of speech over a ≈90 s cut.

### Czech variant

```
Každý designový nástroj tě chce dostat pryč z kódu… tenhle ne.
Začíná to jako u nejlepších designérů — správnými otázkami. Udělá rešerši. Pak ti ukáže moodboard: tudy vede cesta.
A potom postaví celý systém. Barvy, písmo, prostor, pohyb, komponenty. Otokenované, konzistentní — tvoje.
Na nekonečném plátně. Celý tvůj produkt, každá obrazovka — přímo v Claude Code.
Popiš obrazovku. Sleduj, jak se postaví sama. Reálné komponenty, reálné tokeny, reálný kód.
Pak ji ohodnotí kritici — přístupnost, typografie, zdrženlivost — a co najdou, opraví.
A teď to hlavní, co všechno mění. Nepíšeš prompty. Ukážeš na design. Hodíš poznámku na pixel. Nakreslíš to. A ono to prostě… pochopí.
A nejsi na to sám. Živé kurzory, v reálném čase — sdílené peer to peer, přes hub, který si hostuješ. Žádný SaaS. Žádná registrace.
Loga, ikony, diagramy — kreslí geometrický engine. Nikdy ne odhadem.
Naanimuj jednou. Pošli jeden soubor — web i nativ, pixel po pixelu.
Pak to předej — do jakékoliv produkční codebase. Next, Vite, Bun, nebo čistý kód — napojené na tvoje tokeny.
A ono si to pamatuje. Plánuje, než staví — a zapíše každé rozhodnutí. Co, a proč.
Přeruš uprostřed featury. Vrať se zítra. Naváže přesně tam, kde jsi skončil.
Otestuje to na pěti platformách — a otevře pull request. Druhý mozek, který nasazuje.
maude. Žádná telemetrie. Žádná registrace. Repo je zdroj pravdy.
```

---

## Why these features (verified against the real code)

- **DS from a conversation (10–20)** — `/design:setup-ds` runs a discovery built on
  designer-grade probes + `ux-research-agent` (WebSearch mood/color/type research),
  emits a real moodboard (`.design/_moodboard/`), then scaffolds a full tokenized
  system with a completeness-critic. Unique vs. "AI makes a palette."
- **Talk through the canvas (60)** — the real product surface: Cmd+Click maps a
  pixel to its exact source line (`data-cd-id` + `_locator.json`), pixel-anchored
  comments + FigJam annotations feed the next `/design:edit`. This is the
  emotional core: directing AI by pointing/drawing, not prompting.
- **Multiplayer (65)** — Phase 9 self-hostable hub (`maude hub serve`, Hocuspocus +
  SQLite): real-time presence cursors + bidirectional file sync so a peer's edits
  land on disk (and Claude sees them). Peer-to-peer through a hub YOU host — "live
  collab without SaaS, tunnel mode, or partykit." DDR-051/053.
- **Draw as code (70)** — DDR-070 geometry engine: deterministic SVG (splines / A*
  routing / optical corrections), one source → SVG + JSX, self-verify loop. No
  hallucinated path data.
- **Animate once (80)** — DDR-094 keyframe IR → one `.lottie` rendering 1:1 on web
  + native.
- **Handoff to any production code (90)** — export engine emits a component into a
  real codebase: a shadcn `registry-item.json` (Next/Vite/Bun `shadcn add`) is ONE
  path; raw TSX + tokens + CSS is another. Framework-agnostic, wired to your tokens.
- **Second brain (95)** — the `.ai/` workspace: PRD-grounded plans, DDR decision
  records (institutional memory), pause/resume across sessions, `/flow:validate`
  with a 5-platform scenario runner, ships via PR. Why it matters: context +
  decisions survive, so you (and the AI) never re-litigate or re-discover.

## Notes for the rebuild

- Beats 30/40/60/65 reuse the faithful **real Studio chrome** component (build once).
- The moat trio (20 DS · 70 vector · 80 motion) gets the music crescendo; the aha
  (60) gets a beat of near-silence before the line lands.
- Multiplayer (65): show 2–3 distinctly-coloured presence cursors moving at once +
  a peer edit landing for everyone (the bidirectional-sync proof).
- Second brain (92–96): three short screens, punchy rhythm — memory → continuity →
  ships. Keep each ≤6 s so the layering reads as cadence, not drag.
- Music bed under VO; hard cuts on 70/80.
