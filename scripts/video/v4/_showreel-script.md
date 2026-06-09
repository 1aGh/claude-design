# maude — feature showreel + voiceover script (v5)

> **Pivot (2026-06-09).** Not a tutorial ("how to reach a result"). A **showreel**:
> the top features as a cinematic sequence that blows people away. Install dropped.
> Voiceover via ElevenLabs — script below. Every beat is grounded in a REAL maude
> capability (verified against `plugins/` + `apps/studio/` + `.ai/plans/`).

## How the features were chosen

Cross-referenced the real plugin/app files + shipped plans. Kept only the
genuinely impressive, screenshot-worthy, *unique-vs-other-tools* features.
Cut: install/init, onboarding questionary, the step-by-step "get to a result"
framing. The showreel is **feature moments**, escalating.

## The cut — 11 beats, ≈70 s

Arc: **see it → make it → it's smart → it's wired to your code → it does the hard
things → it collaborates → it ships.**

| # | beat | feature (the wow) | on screen | grounded in | ~dur |
|---|------|-------------------|-----------|-------------|------|
| 00 | Cold open | the hook | dark void → `maude` resolves, one cursor on the dotted canvas | wordmark + canvas | 4s |
| 10 | The canvas | infinite multi-artboard canvas, in your repo | camera flies across a real canvas full of artboards; WORLD minimap | real `Canvas Viewport.tsx` / Studio | 6s |
| 20 | It draws itself | canvas-first iteration in real TSX | `/design:new` — a screen builds live: skeleton → hero → tokens → CTA, presence cursor | real Studio chrome + canvas fill | 8s |
| 30 | DS from a sentence | design-system bootstrap | one line of brief → the editorial specimen "Accent. One indigo." + type ladder + palette | real `colors-accent` specimen | 6s |
| 40 | It critiques itself | critic panel + auto-fix loop | verdict card: signature/a11y/type/restraint scores resolve → "✓ auto-fix · 2 applied" | critic PANEL.md shape (illustrated) | 7s |
| 50 | Pixel → code | Cmd+Click inspector | ⌘-cursor lands on an element, halo, chip `button.btn--primary · Hero.tsx:42` | real Studio inspector | 5s |
| 60 | Draw as code | the geometry engine (the moat) | a logo/icon assembles from geometry (splines/grid), crisp at 16px + flatten | real `/design:draw` engine output | 7s |
| 70 | Animate once | to-lottie, web + native 1:1 | a mark animates → emits `one .lottie` → same motion on a web frame + a phone frame | real `/design:to-lottie` | 6s |
| 80 | Critique on pixels | comments + annotations | a numbered pin + thread + a hand-drawn pen arrow on the canvas | real Studio comment pin/thread | 5s |
| 90 | Ship it | handoff to shadcn registry | export → `registry-item.json` → `+ components/…tsx` lands in a repo | real handoff / export | 5s |
| 95 | …and it ships itself | flow loop nod (optional) | quick montage: plan → 5-platform scenario screenshots → green ✓ → PR | real `/flow:scenario` + loop | 5s |
| 99 | End card | the close | brand lockup + `npm i -g @1agh/maude` + trust line, loop-safe to the void | real `logo.tsx` mark | 4s |

Drop beat 95 for a pure-design cut (~65 s). Keep it for "it's not just pretty,
it ships" (~70 s).

---

## Voiceover script (ElevenLabs)

**Voice direction:** dry, confident, unhurried — a senior designer who doesn't
oversell. Anti-corporate. Lets the visuals breathe; sparse, not wall-to-wall.
Lowercase-feel delivery, short sentences, hard stops. Think Linear/Bun launch
narration, not a SaaS explainer. Slight pause at each em-dash.

**Suggested ElevenLabs settings:** a low/measured voice; Stability ~55,
Similarity ~75, Style ~15 (low exaggeration), Speed ~0.95. Render each line as a
separate clip so timing locks to the cut.

### Per-beat (line + delivery)

- **00 · Cold open** — *"Every design tool wants you to leave your code."* — beat — *"this one doesn't."*
  _(cold, deadpan; the turn lands on "doesn't")_
- **10 · The canvas** — *"An infinite canvas. Your whole product — every screen — inside Claude Code."*
- **20 · It draws** — *"Describe a screen. Watch it build itself. Real components, real tokens, real code."*
- **30 · DS from a sentence** — *"A whole design system — from a single sentence."*
- **40 · Critics** — *"Then a panel of critics scores it. Accessibility, type, restraint. And it fixes what it finds."*
- **50 · Pixel → code** — *"Point at any pixel. It knows the exact line of code."*
- **60 · Draw as code** — *"Logos, icons, diagrams — drawn by a geometry engine. Never guessed."*
- **70 · Animate once** — *"Animate once. Ship one file — web and native, pixel for pixel."*
- **80 · Comments** — *"Critique on the pixels. Not in Slack."*
- **90 · Handoff** — *"Then hand it off — straight into your repo. Production-ready."*
- **95 · Ships itself** _(optional)_ — *"And the same agent plans it, tests it on five platforms, and ships it."*
- **99 · End card** — *"maude. No telemetry. No signup. The repo is the source of truth."*

### Clean VO block (paste into ElevenLabs, one line per clip)

```
Every design tool wants you to leave your code… this one doesn't.
An infinite canvas. Your whole product, every screen, inside Claude Code.
Describe a screen. Watch it build itself. Real components, real tokens, real code.
A whole design system — from a single sentence.
Then a panel of critics scores it. Accessibility, type, restraint. And it fixes what it finds.
Point at any pixel. It knows the exact line of code.
Logos, icons, diagrams — drawn by a geometry engine. Never guessed.
Animate once. Ship one file — web and native, pixel for pixel.
Critique on the pixels. Not in Slack.
Then hand it off — straight into your repo. Production-ready.
And the same agent plans it, tests it on five platforms, and ships it.
maude. No telemetry. No signup. The repo is the source of truth.
```

Word count ≈ 95 words → ≈ 40–45 s of speech over a ≈70 s cut (leaves breathing
room between lines — correct for a showreel).

### Czech variant (if you want a CZ cut)

```
Každý designový nástroj tě chce dostat pryč z kódu… tenhle ne.
Nekonečné plátno. Celý tvůj produkt, každá obrazovka, přímo v Claude Code.
Popiš obrazovku. Sleduj, jak se postaví sama. Reálné komponenty, reálné tokeny, reálný kód.
Celý design systém — z jediné věty.
Pak ho ohodnotí panel kritiků. Přístupnost, typografie, zdrženlivost. A co najde, opraví.
Ukaž na libovolný pixel. Ví, který řádek kódu to je.
Loga, ikony, diagramy — kreslí geometrický engine. Nikdy ne odhadem.
Naanimuj jednou. Pošli jeden soubor — web i nativ, pixel po pixelu.
Připomínky na pixelech. Ne ve Slacku.
Pak to předej — rovnou do repa. Production-ready.
A ten samý agent to naplánuje, otestuje na pěti platformách a nasadí.
maude. Žádná telemetrie. Žádná registrace. Repo je zdroj pravdy.
```

---

## Notes for the rebuild

- Beats 10/20/50/80 reuse the faithful **real Studio chrome** component (build once).
- Beats 30/60/70 are the "range" showcase (DS · vector · motion) — the moat trio.
- Music: bed under VO; hits on the hard cuts at 60/70 (the moat trio) for the crescendo.
- Timing: VO line starts ~0.3 s into each beat; cut on the line's last stressed word.
