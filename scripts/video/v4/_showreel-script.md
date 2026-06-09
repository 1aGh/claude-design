# maude — feature showreel + voiceover script (v5.1)

> **Pivot (2026-06-09).** Not a tutorial — a **showreel**: top features as a
> cinematic sequence that blows people away. Install dropped. Voiceover via
> ElevenLabs. Every beat grounded in a REAL maude capability (verified against
> `plugins/` + `apps/studio/` + `.ai/plans/`).
>
> **v5.1 changes (user):** DS moved to #2 and made richer (world-class
> questionary → moodboard shows the direction → robust full design system);
> added the emotional core — **"you talk to the AI *through* the canvas"**;
> expanded **flow as a second brain** (what it does + why it matters).

## The cut — 12 beats, ≈75 s

Arc: **hook → a real design system, from a conversation → a canvas → it builds →
it judges itself → ✦ you direct it by pointing & drawing ✦ → it does the hard
things (vector, motion) → it ships → and it remembers.**

| # | beat | feature (the wow) | on screen | grounded in | ~dur |
|---|------|-------------------|-----------|-------------|------|
| 00 | Cold open | the hook | dark void → `maude` resolves, one cursor on the dotted canvas | wordmark + canvas | 4s |
| 10 | The questionary + moodboard | DS discovery built on how the best designers work → a moodboard shows the direction | the Claude TUI asking sharp discovery Qs → a real "1am pinboard" moodboard assembles (type, swatches, mood + reference cards) | `/design:setup-ds` + `.design/_moodboard/*` | 8s |
| 20 | The robust design system | a full, tokenized DS — not a palette, a system | editorial specimens fan in: "Accent. One indigo.", type ladder, spacing, elevation, motion, components | real `system/maude/preview/*` specimens | 7s |
| 30 | The canvas | infinite multi-artboard canvas, in your repo | camera flies across a real canvas full of artboards; WORLD minimap | real `Canvas Viewport.tsx` / Studio | 5s |
| 40 | It draws itself | canvas-first iteration in real TSX | `/design:new` — a screen builds live on your DS: skeleton → hero → tokens → CTA, presence cursor | real Studio chrome + canvas fill | 7s |
| 50 | It critiques itself | critic panel + auto-fix loop | verdict card: signature/a11y/type/restraint scores resolve → "✓ auto-fix · 2 applied" | critic PANEL.md shape (illustrated) | 6s |
| 60 | **✦ You talk to it through the canvas** | the aha — point, comment, draw → it acts | ⌘-cursor lands on an element → chip `Hero.tsx:42`; a comment pin drops on a pixel; a hand-drawn arrow + "make this bigger" → the element changes | real Studio inspector + comments + annotations | 9s |
| 70 | Draw as code | the geometry engine (the moat) | a logo/icon assembles from geometry (splines/grid), crisp at 16px + single-color flatten | real `/design:draw` engine | 6s |
| 80 | Animate once | to-lottie, web + native 1:1 | a mark animates → emits `one .lottie` → same motion on a web frame + a phone frame | real `/design:to-lottie` | 6s |
| 90 | Ship it | handoff to shadcn registry | export → `registry-item.json` → `+ components/…tsx` lands in a repo | real handoff / export | 5s |
| 95 | A second brain | flow: the `.ai/` workspace | montage: a plan grounded in the PRD → a DDR decision record → pause/resume across sessions → 5-platform scenario ✓ → PR | real flow loop + `.ai/` + `/flow:scenario` | 9s |
| 99 | End card | the close | brand lockup + `npm i -g @1agh/maude` + trust line, loop-safe to the void | real `logo.tsx` mark | 4s |

**Three differentiators carry the film:** the DS-from-a-conversation (10–20),
the talk-through-the-canvas aha (60), and the second-brain (95). The moat trio
(DS · vector · motion) gives the visual crescendo; the aha (60) is the heart.

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
- **70 · Draw as code** — *"Logos, icons, diagrams — drawn by a geometry engine. Never guessed."*
- **80 · Animate once** — *"Animate once. Ship one file — web and native, pixel for pixel."*
- **90 · Handoff** — *"Then hand it off — straight into your repo. Production-ready."*
- **95 · Second brain** — *"And it remembers. Every plan, every decision, every reason — a second brain that lives in your repo. Pause today, pick it up tomorrow. It plans, tests on five platforms, and ships."*
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
Logos, icons, diagrams — drawn by a geometry engine. Never guessed.
Animate once. Ship one file — web and native, pixel for pixel.
Then hand it off — straight into your repo. Production-ready.
And it remembers. Every plan, every decision, every reason — a second brain that lives in your repo. Pause today, pick it up tomorrow. It plans, tests on five platforms, and ships.
maude. No telemetry. No signup. The repo is the source of truth.
```

Word count ≈ 150 → ≈ 60–65 s of speech over a ≈75 s cut.

### Czech variant

```
Každý designový nástroj tě chce dostat pryč z kódu… tenhle ne.
Začíná to jako u nejlepších designérů — správnými otázkami. Udělá rešerši. Pak ti ukáže moodboard: tudy vede cesta.
A potom postaví celý systém. Barvy, písmo, prostor, pohyb, komponenty. Otokenované, konzistentní — tvoje.
Na nekonečném plátně. Celý tvůj produkt, každá obrazovka — přímo v Claude Code.
Popiš obrazovku. Sleduj, jak se postaví sama. Reálné komponenty, reálné tokeny, reálný kód.
Pak ji ohodnotí kritici — přístupnost, typografie, zdrženlivost — a co najdou, opraví.
A teď to hlavní, co všechno mění. Nepíšeš prompty. Ukážeš na design. Hodíš poznámku na pixel. Nakreslíš to. A ono to prostě… pochopí.
Loga, ikony, diagramy — kreslí geometrický engine. Nikdy ne odhadem.
Naanimuj jednou. Pošli jeden soubor — web i nativ, pixel po pixelu.
Pak to předej — rovnou do repa. Production-ready.
A ono si to pamatuje. Každý plán, každé rozhodnutí, každý důvod — druhý mozek, který žije v tvém repu. Dnes pauza, zítra pokračuješ. Naplánuje, otestuje na pěti platformách a nasadí.
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
- **Draw as code (70)** — DDR-070 geometry engine: deterministic SVG (splines / A*
  routing / optical corrections), one source → SVG + JSX, self-verify loop. No
  hallucinated path data.
- **Animate once (80)** — DDR-094 keyframe IR → one `.lottie` rendering 1:1 on web
  + native.
- **Second brain (95)** — the `.ai/` workspace: PRD-grounded plans, DDR decision
  records (institutional memory), pause/resume across sessions, `/flow:validate`
  with a 5-platform scenario runner, ships via PR. Why it matters: context +
  decisions survive, so you (and the AI) never re-litigate or re-discover.

## Notes for the rebuild

- Beats 30/40/60 reuse the faithful **real Studio chrome** component (build once).
- The moat trio (20 DS · 70 vector · 80 motion) gets the music crescendo; the aha
  (60) gets a beat of near-silence before the line lands.
- Music bed under VO; hard cuts on 70/80.
- Drop beat 95 only if a pure-design ≤65 s cut is wanted — but the user explicitly
  wants the second-brain in, so keep it.
