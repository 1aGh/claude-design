# Marketing demo video storyboard — v2 (post-feedback rebuild)

> **v1 archived 2026-05-20.** v1 cuts were judged too quiet — feedback listed
> verbatim in the changelog block below. v2 fixes every flagged scene + adds
> a Claude TUI capture (showing the real `/design:setup-ds` discovery
> kicking off), an annotations beat, 4 benefit cards, and a split-screen
> HMR composite. Pace is faster, composition is bolder.

## Changelog (v1 → v2)

| Feedback (v1) | v2 fix |
|---|---|
| inspector ring barely visible — flashes once | Scene "canvas-hero" now does 3 sequential Cmd-hovers (1.5s each) → Cmd+shift+Click multi-select on a 4th element |
| live edit needs split-screen with terminal | New `<HmrSplitScene>` composite — VHS terminal showing `sed` edit on left half, Playwright canvas reload on right half |
| `maude design serve --port 4400` throws an Error at ~10s | Root cause: npm optional-dependencies bug (npm/cli#4828) — oxc-parser native binding missing on global npm install. Fix: switch tape to `bun add -g @1agh/maude` (Bun handles platform-specific optional deps correctly) |
| 48s "multi-artboard canvas" too static — wants pan across canvas | New canvas-reveal spec: Space+drag pan from artboard A → D, then Cmd+wheel zoom-out reveal of the whole 4-up |
| docs scroll choppy / jumps | Use `page.evaluate(() => window.scrollTo({ top: y, behavior: 'smooth' }))` instead of `mouse.wheel`; longer initial paint wait |
| missing: comments on canvas | Re-added — Scene "comments" now resets canvas-shell zoom to 1.0 via keyboard shortcut at spec start, ensures pins paint visibly, drives composer + reply |
| missing: annotations on canvas | New scene — selects the pen tool from the toolbar, draws a couple of marks + an arrow, sticks a label |
| show real `/design:setup-ds` slash command in Claude Code TUI at least the first question | New VHS tape captures `claude` boot in the scratch dir, slash command typed, Stage 1 first prompt visible |
| "nudné" overall — be bolder with composition | 4 benefit-card scenes interleaved between feature groups + faster pace + larger type on cards |

## Why two cuts (unchanged from v1)

- **Cut A — `site/public/demo.mp4`** — primary, embedded on docs landing.
  v2 target ~75 s with held intro/outro tails. Size cap 16 MB.
- **Cut B — `site/public/demo-30s.mp4`** — tight, GitHub README via release
  asset. v2 target ~30 s. Size cap 10 MB.

## Ground rules (v2)

1. **Slash commands now appear** — but only inside the Claude Code TUI
   (terminal app), never as raw shell typing. The Scene 3 VHS captures
   `claude` launching + `/design:setup-ds project "..."` + the first Stage 1
   discovery prompt rendering. This is the **only** place a slash command
   is visually typed; everywhere else the resulting artifacts are what reads.
2. **Two-port pattern unchanged** — scratch on 4400, repo on 4399.
3. **Caption discipline** — ASCII only inside backticks; em-dashes elsewhere
   in this doc are documentation, not video copy.
4. **Frame math** — 30 fps; xfades 12 f (0.4 s) each; minimum scene 24 f.
5. **Capture resolutions** — 1280×720 source upscaled inside chrome wrappers.
6. **Benefit cards** are pure-Remotion TSX scenes (no captures) — large
   typography animated with `remotion-bits` springs. Honors DS tokens.

## Music bed (unchanged)

Stays on synthesized `ambient.aac` from phase 15.1 with `<Audio loop>`.
Real CC0 track curation still deferred to a follow-up.

## Scratch project (unchanged from v1 except where noted)

- Path: `/tmp/scratch-maude-demo-<date>/`
- DS: full Maude DS copied as fixture (100 preview specimens).
- Canvas: `.design/ui/Recipe Recap.tsx` — 4 artboards (hero / scaler /
  ingredients / print). Same as v1.
- Comments: `.design/_comments/ui-recipe_recap.tsx.json` — 2 seeded
  threads (1 open with @mention reply + 1 resolved). Same as v1.
- **v2 new requirement:** Recipe Recap canvas needs ≥1 `data-cd-id`-tagged
  element clearly inside the hero artboard at known coordinates, so the
  Scene "canvas-hero" Cmd+hover sequence can target precise pixel coords.
- **v2 new requirement:** annotations layer must be active. Verify by
  manually opening the Tools menubar → Pen tool while authoring the spec.

---

## Cut A v2 — scene table (~75 s primary)

| # | Scene id | Source | Slot (s) | Slot (frames) | Caption |
|---|----------|--------|---------:|--------------:|---------|
| 1 | `intro` | `IntroScene` (15.1) | 2.5 | 75 | (no LowerThird) |
| 2 | `install` | VHS `01-install-init-serve.tape` (bun-add) | 7.0 | 210 | `Install. Init. Serve.` |
| 3 | `tui-discovery` | VHS `02-claude-tui-discovery.tape` | 6.0 | 180 | `Discovery starts in Claude Code.` |
| 4 | `ds-reveal` | Playwright `03-ds-reveal` (tree nav, 4 specimens) | 7.5 | 225 | `A real design system from one brief.` |
| 5 | `card-A` | Remotion `<BenefitCard kind="local-figma" />` | 2.0 | 60 | (own type) |
| 6 | `canvas-reveal` | Playwright `04-canvas-reveal` (Space+drag pan) | 7.0 | 210 | `Multi-artboard canvas. Real code.` |
| 7 | `canvas-hero` | Playwright `05-canvas-hero` (3 hovers + multi-select) | 9.0 | 270 | `Cmd+Click. Inspect. Multi-select.` |
| 8 | `card-B` | Remotion `<BenefitCard kind="all-in-one" />` | 2.0 | 60 | (own type) |
| 9 | `hmr-split` | Composite (VHS edit + Playwright reload) | 8.0 | 240 | `Edit a file. Canvas reloads in place.` |
| 10 | `comments` | Playwright `07-comments` (zoom-1.0 reset + composer) | 7.0 | 210 | `In-place comments. Anchored.` |
| 11 | `annotations` | Playwright `09-annotations` (pen + arrow + label) | 5.0 | 150 | `Draw. Mark. Hand off.` |
| 12 | `card-C` | Remotion `<BenefitCard kind="human-ai" />` | 2.0 | 60 | (own type) |
| 13 | `docs` | Playwright `08-docs` (smooth scrollBy) | 4.0 | 120 | `Docs at maude.iagh.cz.` |
| 14 | `card-D` | Remotion `<BenefitCard kind="your-repo" />` | 2.0 | 60 | (own type) |
| 15 | `outro` | `OutroScene` (15.1) | 3.0 | 90 | (no LowerThird) |

### Frame budget (Cut A v2)

```
intro          75
xfade          12   (14 xfades × 12f = 168f overlap consumed)
install       210
tui-discovery 180
ds-reveal     225
card-A         60
canvas-reveal 210
canvas-hero   270
card-B         60
hmr-split     240
comments      210
annotations   150
card-C         60
docs          120
card-D         60
outro          90
────────────────────
sum         2220 frames
- 14 xfade × 12 = 168 overlap
= 2052 frames = 68.4 s on-screen.
```

Pad held intro/outro tails → ~72-75 s.

### Caption strings (Cut A v2 — verbatim)

| Scene | String |
|-------|--------|
| install | `Install. Init. Serve.` |
| tui-discovery | `Discovery starts in Claude Code.` |
| ds-reveal | `A real design system from one brief.` |
| canvas-reveal | `Multi-artboard canvas. Real code.` |
| canvas-hero | `Cmd+Click. Inspect. Multi-select.` |
| hmr-split | `Edit a file. Canvas reloads in place.` |
| comments | `In-place comments. Anchored.` |
| annotations | `Draw. Mark. Hand off.` |
| docs | `Docs at maude.iagh.cz.` |

### Benefit cards — copy + design intent

| Card | Headline | Subline | Visual |
|------|----------|---------|--------|
| A `local-figma` | `Local Figma. For Claude Code.` | `Canvas-first. No SaaS. Lives next to your code.` | Stamp + headline in 96-pt Berkeley Mono, amber-rust accent on "Local"/"For Claude Code" |
| B `all-in-one` | `Design and ship from one tree.` | `One repo. One dev-server. One workflow.` | Three-dot interpunct chain animating in left-to-right |
| C `human-ai` | `Human reads. AI iterates.` | `Comments, annotations, snapshots. Both sides speak the same canvas.` | Two-column layout with `human` / `ai` columns + a connecting line |
| D `your-repo` | `Your repo. No third party.` | `Files, comments, history — all under .design/. Yours forever.` | Stamp + headline + a file-tree fragment as supporting glyph |

All benefit cards: paper background, hard-edge 1px rule, SKU stamp top-left
(`MDCC-MKT/0X · CARD · v0.16.0`), catalog footer strip
(`github.com/1aGh/maude · 2 plugins · 1 CLI · zero telemetry`).

---

## Cut B v2 — scene table (~30 s tight)

Drops the Claude TUI scene (needs 6 s context), benefit cards (too dense
for 30s), comments + annotations (need more time to read). Keeps the
canonical **install → canvas → inspect → iterate → docs** arc.

| # | Cut A # | Scene | Slot (s) | Slot (frames) | Caption |
|---|---------|-------|---------:|--------------:|---------|
| 1 | 1 | Intro | 2.0 | 60 | (no LowerThird) |
| 2 | 2 | Install | 4.0 | 120 | `One command to install. One to scaffold.` |
| 3 | 6 | Canvas reveal + pan | 4.5 | 135 | `Multi-artboard canvas. Real code.` |
| 4 | 7 | Cmd+Click + multi-select | 6.5 | 195 | `Cmd+Click. Multi-select.` |
| 5 | 9 | HMR split | 7.0 | 210 | `Edit a file. Canvas reloads.` |
| 6 | 13 | Docs | 2.5 | 75 | `Docs at maude.iagh.cz.` |
| 7 | 15 | Outro | 2.5 | 75 | (no LowerThird) |

### Frame budget (Cut B v2)

```
sum = 60 + 120 + 135 + 195 + 210 + 75 + 75 = 870 frames
- 6 xfade × 12 = 72 overlap
= 798 frames = 26.6 s on-screen.
Held outro tail → ~30 s.
```

---

## v2 capture roster (what gets re-shot vs reused)

| Scene | Capture file | Action |
|-------|--------------|--------|
| install | `scene-02-install.mp4` | RE-SHOOT — switch to `bun add -g`, fix the oxc-parser error |
| tui-discovery | `scene-03-tui-discovery.mp4` (new) | NEW — VHS captures Claude Code TUI |
| ds-reveal | `scene-04-ds-reveal.mp4` (was 03) | reuse from v1; bump filename |
| canvas-reveal | `scene-05-canvas-reveal.mp4` (was 04) | RE-SHOOT with Space+drag pan |
| canvas-hero | `scene-06-canvas-hero.mp4` (was 05) | RE-SHOOT with 3 hovers + multi-select |
| hmr-edit (left half) | `scene-07a-hmr-edit.mp4` (new VHS) | NEW — VHS of sed/vim edit |
| hmr-reload (right half) | `scene-07b-hmr-reload.mp4` (was 06) | reuse |
| comments | `scene-08-comments.mp4` (was 07) | RE-SHOOT — zoom 1.0 reset + composer |
| annotations | `scene-09-annotations.mp4` (new) | NEW |
| docs | `scene-10-docs.mp4` (was 08) | RE-SHOOT — smooth scroll |

Net: 6 re-shoots + 3 new captures + 1 reuse. Total 10 capture sources +
4 Remotion benefit-card scenes + 2 framing scenes (intro/outro) = 16
distinct content sources for Cut A.

---

## Sources of truth (unchanged contract)

- Frame timings: this file is canonical.
- Captions: this file is canonical.
- Scratch path + brief: this file is canonical.
- Benefit-card copy: this file is canonical.
