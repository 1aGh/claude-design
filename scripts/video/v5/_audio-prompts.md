# V5 showreel — audio production pack (ElevenLabs)

Everything you paste into ElevenLabs, where to paste it, the settings, and where
to save the files so I can mux them into the cut. Three products, three sections.

**Cut length: 89.4 s** (2682f @ 30fps). Beat timecodes:

| beat | screen | start–end | VO file |
|---|---|---|---|
| 00 | cold open | 0.0–4.0 | `vo-00.mp3` |
| 10 | questionary + moodboard | 4.0–12.0 | `vo-10.mp3` |
| 20 | design system | 12.0–19.0 | `vo-20.mp3` |
| 40 | it draws | 19.0–26.0 | `vo-40.mp3` |
| 50 | critics | 26.0–32.0 | `vo-50.mp3` |
| 60 | talk through canvas (the heart) | 32.0–42.6 | `vo-60.mp3` |
| 65 | multiplayer | 42.6–49.6 | `vo-65.mp3` |
| 70 | draw as code | 49.6–55.6 | `vo-70.mp3` |
| 80 | animate once | 55.6–61.6 | `vo-80.mp3` |
| 90 | handoff | 61.6–67.4 | `vo-90.mp3` |
| 92 | second brain | 67.4–73.4 | `vo-92.mp3` |
| 94 | daily loop | 73.4–78.4 | `vo-94.mp3` |
| 96 | nothing slips | 78.4–85.4 | `vo-96.mp3` |
| 99 | end card | 85.4–89.4 | `vo-99.mp3` |

> Lines may slip ~0.5 s across a cut — that's fine. If a take runs **longer**
> than its window, pick a tighter read or nudge Speed to 1.05. Don't rush the
> heart line (60).

---

## 1 · VOICEOVER — ElevenLabs **Text to Speech**

**Where:** left sidebar → **Text to Speech** (the playground with the big text box).
**Model:** **Eleven v3** (handles the em‑dash pauses + the one soft tag on beat 60).
If a line comes out uneven, switch that one line to **Eleven Multilingual v2** (more
consistent, ignores tags).

**Voice:** open **Voices → Library**, filter **Use case = Narration**, and pick a
**dry, calm, low male** voice. Good defaults to audition (type the beat‑00 line and
compare): **Brian**, **Bill**, **Adam** (US, deep/measured) or **George** (UK, warm).
Pick ONE and use it for all 14 lines. Save it to *My Voices* so the settings stick.

**Settings (gear / Voice Settings):**
- Stability **50** (Natural)
- Similarity **80**
- Style **0** (keep it un‑theatrical; anti‑corporate)
- Speed **0.96**
- Speaker boost **on**

**Direction:** dry, confident, unhurried — a senior designer who doesn't oversell.
Short sentences, hard stops, a small breath at each "—". The line at beat 60 is the
warmest (a knowing half‑smile, not hype).

**Workflow:** paste **one line at a time** (the box content is ONLY the sentence —
never the filename), Generate 2–3 takes, download the best under the filename above
the block. `[brackets]` are v3 delivery hints — they're acted, not spoken; delete if they misbehave.

→ save as `vo-00.mp3`
```
Every design tool pulls you out of your code… [pause] not this one.
```
→ save as `vo-10.mp3`
```
It opens like a real designer would — sharp questions, real research, and a moodboard that commits to a direction.
```
→ save as `vo-20.mp3`
```
Then a whole design system, built for you. Colour, type, space, motion, components — every token, in place.
```
→ save as `vo-40.mp3`
```
Describe a screen. Watch it appear. Real components, real tokens, real code.
```
→ save as `vo-50.mp3`
```
A panel of critics grades it — accessibility, type, restraint — then fixes what it flags.
```
→ save as `vo-60.mp3`
```
[softly] Here's the part that lands: you don't prompt it. [pause] You point. You comment on a pixel. You draw on it. And it understands.
```
→ save as `vo-65.mp3`
```
And you're not the only cursor. Live, peer to peer, through a hub you run — no SaaS, no sign-up.
```
→ save as `vo-70.mp3`
```
Logos, icons, diagrams — drawn by a geometry engine. Computed, never guessed.
```
→ save as `vo-80.mp3`
```
Animate it once. Ship a single file — web and native, frame for frame.
```
→ save as `vo-90.mp3`
```
Then hand it off — into any codebase. Next, Vite, Bun, or raw — wired to your tokens.
```
→ save as `vo-92.mp3`
```
And it remembers everything. Every plan, every decision, the reason behind it. Close the laptop — tomorrow it picks up mid-thought.
```
→ save as `vo-94.mp3`
```
After that, it's a rhythm. Plan. Execute. Done.
```
→ save as `vo-96.mp3`
```
And nothing ships unchecked — security, code review, tests, five platforms — every time. Then it opens the PR.
```
→ save as `vo-99.mp3`
```
maude. No telemetry. No sign-up. Your repo is the source of truth.
```

**Save to:** `scripts/video/final/public/v5/audio/vo/` — names exactly `vo-00.mp3` … `vo-99.mp3` (mp3 or wav both fine).
**Cost:** ~1 credit/char ≈ ~1,200 credits for one full pass; budget ~3–4k with retakes. Cheap.

---

## 2 · MUSIC — ElevenLabs **Music** (Eleven Music v2)

**Where:** left sidebar → **Music**. One instrumental bed under the whole film.
**Length:** set **92 seconds**. **No vocals** (instrumental).

**Prompt (paste):**
```
Instrumental cinematic tech score for a product launch film, 92 seconds. Dark, cool, modern and confident — not corporate, not cheesy. Minimal electronic: warm analog synth pads, a soft pulsing arpeggio, deep sub bass, subtle granular textures, light glassy plucks. Tempo around 100 BPM, steady but understated. Structure: a quiet, sparse, mysterious intro (0–12s); a gentle build adding the arpeggio and a soft beat (12–32s); a warm, intimate, almost tender lift around the 32–43s mark (leave space, fewer drums — an emotional beat); the fullest, most uplifting section with shimmering synths and a driving pulse from ~50–67s (the crescendo); then a confident steady groove (67–85s); and a clean, resolved, slightly hopeful outro that fades to near silence (85–92s). Tasteful, spacious, lots of air. No vocals, no risers that scream, no big brass, no orchestral cliché.
```

**Style controls (optional, in the editor) — Exclude styles, paste:**
```
vocals, abrupt ending, cheesy corporate, loud brass, EDM drop
```
If it feels too busy, use the chat box at the bottom: *"make the intro sparser and quieter, leave more space around 35 seconds."*

Generate 1–2 versions, pick the one whose **shape** matches (quiet→build→warm dip at ~35s→crescendo→resolve). I'll fine‑align it.

**Save to:** `scripts/video/final/public/v5/audio/music/bed.mp3`
**Cost:** Music is the **priciest** product — generate sparingly (1–2 tries). Do VO + SFX first; if credits run low, the music can wait.

---

## 3 · SOUND DESIGN — ElevenLabs **Sound Effects**

**Where:** left sidebar → **Sound Effects**. For each: paste the prompt, turn **Duration OFF "Auto"** and set the seconds below, **Prompt influence ≈ 0.4**, Generate, download.

A small **reusable palette** (11 clips) covers the whole film — I'll place + repeat them at the right beats when muxing. Keep them **clean, soft, UI‑grade, not loud**. For each: set the **Duration** shown, paste ONLY the description, download under the filename.

→ `whoosh.mp3` · Duration **2.0s**
```
short clean UI transition whoosh, soft air swish, subtle, no impact boom
```
→ `ui-pop.mp3` · Duration **0.5s**
```
soft minimal UI pop, gentle bubble tap, clean and quiet
```
→ `ui-tick.mp3` · Duration **0.4s**
```
crisp soft UI tick, tiny digital check confirm, subtle
```
→ `scan-sweep.mp3` · Duration **1.6s**
```
smooth rising digital scan shimmer, soft sci-fi reveal sweep, gentle
```
→ `power-on.mp3` · Duration **1.2s**
```
soft electronic power-on hum, gentle device wake, warm boot, subtle
```
→ `success.mp3` · Duration **1.0s**
```
clean positive confirm chime, soft pleasant ding, premium UI success, not cheesy
```
→ `draw-stroke.mp3` · Duration **0.9s**
```
soft pen stroke drawing on paper, quick gentle marker line, subtle
```
→ `connect.mp3` · Duration **0.8s**
```
soft network connect chime, gentle presence join blip, warm digital
```
→ `vortex.mp3` · Duration **1.4s**
```
smooth swirling whoosh, soft particles swirl away, gentle vacuum swish, no impact
```
→ `type-clicks.mp3` · Duration **1.6s**
```
soft mechanical keyboard typing, gentle code typing clicks, light and quick
```
→ `boot-playful.mp3` · Duration **1.2s**
```
cute friendly robot wake-up chirp, soft playful boot beep, charming, subtle
```

**Where each goes (FYI — I'll handle placement):** `whoosh` on the 13 hard cuts ·
`power-on` + cold-open · `ui-pop` chat bubbles + comment pin + chips · `scan-sweep`
moodboard + build scans · `vortex` DS exit · `ui-tick`×cascade + `success` on critics
50 & gate 96 & "updated" 60 · `draw-stroke` + `boot-playful` on the robot (70/80) ·
`connect` multiplayer 65 + second-brain 92 · `type-clicks` handoff code 90.

**Save to:** `scripts/video/final/public/v5/audio/sfx/` — names exactly `whoosh.mp3`, `ui-pop.mp3`, `ui-tick.mp3`, `scan-sweep.mp3`, `power-on.mp3`, `success.mp3`, `draw-stroke.mp3`, `connect.mp3`, `vortex.mp3`, `type-clicks.mp3`, `boot-playful.mp3`.
**Cost:** 40 credits/sec with a set duration → the whole palette ≈ **500–700 credits**. Very cheap; grab 2 variations of any you're unsure about.

---

## When you've saved the files

Tell me. I'll then:
1. Wire VO + SFX as timed `<Audio>` layers inside the Remotion comp (re‑renderable, frame‑aligned to each beat) + the music bed under everything.
2. Duck the music slightly under the VO, balance levels, run **ffmpeg loudnorm** to broadcast loudness.
3. Re‑render V5 **with audio**, send it for a listen, and only then (on your OK) swap `site/public/demo.mp4`.

**Priority order if credits are tight:** VO (essential) → SFX palette (cheap, big lift) → Music (last). Even VO + the 11 SFX alone will carry the film.

Sources: ElevenLabs docs — [Sound Effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects), [Eleven Music](https://elevenlabs.io/docs/overview/capabilities/music), [Text to Speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech).
