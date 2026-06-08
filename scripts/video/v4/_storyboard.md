# v4 storyboard — 13 scenes

> Mirror of the visual storyboard canvas `.design/ui/Studio Intro Video.tsx`
> (artboard B). The canvas is the authoritative artifact; this table is the
> Phase B authoring spec. Each scene gets its OWN signature treatment — no
> repeating motif. Durations are rhythm estimates, not fixed commitments
> (≈80 s total draft). Gaps in ids leave room for inserts.

| id | scene | role | ~dur | signature (distinct) | caption (voice-aligned) | intent — viewer must see |
|----|-------|------|------|----------------------|-------------------------|--------------------------|
| 00 | Cold open | hook | 3s | Caret pulses alone on empty dotted void → wordmark types in | "you start with nothing — a dotted canvas and an idea." | wordmark legible · single cursor · zero chrome |
| 05 | Install | hook | 5s | Raw terminal, monospace typing, no window chrome | "two plugins, one CLI." | `npm i -g @1agh/maude` + `maude init` · no red error |
| 10 | Onboarding | proof | 6s | Claude TUI questionary — a prose question, not a form | "onboarding is a slash command." | TUI · `/design:setup-ds` typed · Stage-1 prose prompt |
| 12 | Moodboard | proof | 5s | Reference pool — mood clusters + OKLCH options + type pairings drift in | "research first — a moodboard, not a guess." | mood tiles + colour options + a type pairing |
| 15 | DS reveal | proof | 6s | Spec-sheet — type ladder + colour ramp side by side | "a design system from a paragraph." | at least one specimen clearly readable |
| 20 | /design:new | proof | 10s | Split-screen — TUI streams left, canvas fills live right | "one slash. real canvas, real code." | left TUI streaming · right canvas appearing · presence cursor |
| 25 | Critics | proof | 7s | Verdict score card resolving + auto-fix loop ticking | "critics score it. then it fixes itself." | score numbers + auto-fix tick visible |
| 30 | Canvas reveal | proof | 6s | Wide pan across multi-artboard, edges bleeding off-frame | "multi-artboard. pan, zoom, ship." | 3+ artboards mid-pan · grab affordance |
| 35 | Cmd+Click | proof | 6s | Inspector halo + ⌘ cursor + the exact file-path chip | "cmd+click. the exact file Claude needs." | halo on a distinct element · path chip readable |
| 40 | /design:edit | proof | 9s | Split-screen — edit diff left, same canvas reloads right | "edit. reload. same canvas." | left edit diff · right edit applied in place |
| 45 | Comments + annotations | proof | 7s | Numbered pin anchored to a pixel + a hand-drawn pen arrow & label | "comment on pixels. draw on them. no exports." | a pin + a drawn annotation (arrow + label) |
| 50 | Handoff | payoff | 6s | Export tiles fan out — shadcn / PNG / code → repo | "then hand off — straight into the repo." | shadcn + code tiles legible · arrow to repo |
| 55 | End card | closer | 4s | Brand lockup + install line, loop-safe back to the void | "your repo. yours forever." | `npm i -g @1agh/maude` legible |

## Per-scene gating

Each scene is authored standalone, rendered, frame-grabbed at early/mid/late
(10 / 50 / 90 %), the frames read into context, scored against the intent
line + signature (1–5 each). Sign off at avg ≥ 4.0 with no line < 3 →
`_signoff-<id>.md`. Only signed-off scenes enter the composition.

## Status

- [x] 00 Cold open — signed off (iter 1, avg 4.9) → `_signoff-00.md`
- [x] 05 Install — signed off (iter 0, avg 4.8) → `_signoff-05.md`
- [x] 10 Onboarding — signed off (iter 0, avg 4.9) → `_signoff-10.md`
- [x] 12 Moodboard — signed off (iter 0, avg 4.9) → `_signoff-12.md`
- [x] 15 DS reveal — signed off (iter 0, avg 4.9) → `_signoff-15.md`
- [x] 20 /design:new — signed off (iter 0, avg 5.0) → `_signoff-20.md`
- [x] 25 Critics — signed off (iter 0, avg 5.0) → `_signoff-25.md`
- [x] 30 Canvas reveal — signed off (iter 0, avg 4.9) → `_signoff-30.md`
- [x] 35 Cmd+Click — signed off (iter 0, avg 4.9) → `_signoff-35.md`
- [x] 40 /design:edit — signed off (iter 0, avg 5.0) → `_signoff-40.md`
- [x] 45 Comments + annotations — signed off (iter 0, avg 4.9) → `_signoff-45.md`
- [x] 50 Handoff — signed off (iter 1, avg 5.0) → `_signoff-50.md`
- [x] 55 End card — signed off (iter 0, avg 5.0) → `_signoff-55.md`

**All 13 scenes signed off.** Phase C assembled → `compositions/V4.tsx` (2400f /
80s / 5.5MB). Full-watch gut check logged in `_watch-log.md` (all axes PASS).
`site/public/demo.mp4` NOT swapped — gated on user ship decision + audio bed.
