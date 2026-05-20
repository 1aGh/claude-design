# Feature: Marketing demo video v2 — bolder composition, real onboarding, infographic benefit cards

> **v2 (rewritten 2026-05-20 after v1 retro).** The first execution of this
> plan shipped a 48 s Cut A + 26 s Cut B that the user judged "nudné" — too
> static, the inspector demo barely visible, the live-edit too quiet, the
> docs scroll choppy, the install scene shipped a visible npm error, and
> the comments + annotations + Claude TUI surfaces missing entirely.
>
> v2 fixes every flagged scene AND rewrites the storyboard to be more
> marketing — interleaving 4 infographic benefit cards, capturing Claude
> Code TUI showing the real `/design:setup-ds` discovery, and using a
> split-screen composite for HMR. Pace is faster, composition bolder.
>
> v1 artifacts were discarded (per user "uplne zahodit dosavadni zmeny");
> the **lessons** are preserved here, in [DDR-037](../decisions/DDR-037-marketing-video-cut-a-cut-b.md),
> in the [storyboard](../../scripts/video/storyboard.md), and in the
> project-memory file `feedback-marketing-video-production`.
>
> Plan filename keeps the `-30s` suffix from v1 for git continuity; ignore
> the suffix (the actual cuts are ~75 s + ~30 s).

## Description

Produce two MP4s — `site/public/demo.mp4` (Cut A, ~75 s, primary, embedded
on the docs landing) and `site/public/demo-30s.mp4` (Cut B, ~30 s, tight,
GitHub README via release asset) — by composing 15 (Cut A) / 7 (Cut B)
scenes on top of the phase-15.1 infrastructure (nested workspace,
`<TransitionSeries>`, `<TerminalFrame>` / `<BrowserChrome>` wrappers,
`<LowerThird>` captions, golden-frame regression, visual QA workflow).

New v2 surfaces:

1. **Claude Code TUI scene** — VHS captures `claude` boot in the scratch
   dir, slash command typed, Stage 1 first prose prompt visible.
2. **Four infographic benefit cards** — pure-Remotion TSX scenes (no
   captures) interleaved between feature groups: Local Figma · All in one
   place · Human ↔ AI · Your repo, no third party.
3. **Annotations scene** — pen / arrow / label markup on a canvas
   artboard.
4. **Split-screen HMR** — VHS terminal showing a `sed` edit on the left
   half, Playwright capture of the canvas reload on the right half,
   composed via a new `<HmrSplitScene>` component.

The storyboard is the canonical scene script + caption + frame budget;
this plan executes against it.

## User Story

As a **prospective Maude user** landing on the docs site or the GitHub
README, I want a **~75-second visual demo** that makes the canvas-first
+ workflow loop legible *and* communicates the four marketing benefits
(local-only / one-place / human-AI bridge / no-third-party) without
reading a single paragraph.

## Problem

v1 shipped a technically correct cut that didn't sell the product. The
inspector flashed too fast to read; the HMR demo didn't show *what* was
being edited; the install scene's last command leaked a real native-
binding error from the oxc-parser npm-optional-deps bug; the comments
were dropped entirely because canvas-shell auto-zoom propagated from a
prior spec made pins invisible.

The 9-scene 48-second cut was paced like a tech demo, not a marketing
piece. No benefit framing. No "this is local; nothing leaves your repo"
moment. No Claude TUI showing the discovery onboarding that *is* the
distinctive feature. The viewer walked away thinking "neat tool" instead
of "I want this in my project tomorrow."

## Solution

v2 = v1's pipeline + 4 new scenes + 6 re-shoots + a faster cut.

```
v1 (discarded)           v2 (this plan)
─────────────────        ─────────────────────────────────────────
9 scenes / 48 s    ──▶   15 scenes / ~75 s
no benefit cards   ──▶   4 cards interleaved
no Claude TUI      ──▶   VHS captures Stage-1 discovery prompt
no annotations     ──▶   pen/draw scene
HMR plain          ──▶   split-screen composite (terminal | canvas)
npm install bug    ──▶   `bun add -g @1agh/maude` bypasses npm/cli#4828
inspector flashes  ──▶   3 sequential hovers + multi-select
comments dropped   ──▶   zoom-1.0 reset at spec start, composer + reply
docs scroll choppy ──▶   `scrollTo({behavior:'smooth'})` + 3s paint wait
canvas-reveal static ▶   Space+drag pan across all 4 artboards
```

## Metadata

- **Type:** Marketing artifact (content authored on phase-15.1
  infrastructure; second iteration after v1 retro).
- **Complexity:** Large. v2 adds 4 Remotion-only scenes + 3 new capture
  sources + a composite split-screen scene + re-shoots 4 existing
  captures. Realistic compute: 3–5 h in one continuous session.
- **App/Package:** `scripts/video/final/` + `site/` + scratch dir at
  `/tmp/scratch-maude-demo-<date>/`.
- **Dependencies:**
  - **Phase 15 toolchain green** (`pnpm run video:smoke` exits 0).
  - **Phase 15.1 infrastructure** committed and clean (already true).
  - Scratch project: full Maude DS fixture + Recipe Recap canvas + comments
    seed (v1 path; re-create from the storyboard recipe each session).
  - **bun ≥ 1.3** on `$PATH` for the install tape's `bun add -g`.
  - **claude CLI on $PATH** for the TUI capture tape — agent must verify
    via `which claude` before recording.
  - Optional: real CC0 music track in `scripts/video/music/`. v2 still
    ships with synthesized `ambient.aac` looped if no real track lands.

---

## Context References

### Must-Read Files

- `scripts/video/storyboard.md` — **canonical scene script + caption +
  frame budget**. This plan executes against it; deviations require a
  storyboard edit, not a plan-only override.
- `.ai/decisions/DDR-037-marketing-video-cut-a-cut-b.md` — v1 retro
  documenting every production gotcha discovered in the first execution.
  Read this BEFORE shooting Scene 2 (install) — the bun-vs-npm decision
  is captured here.
- `~/.claude/projects/-Volumes-D-git-claude-design/memory/feedback-marketing-video-production.md`
  (project memory) — cross-session lessons that apply beyond this plan.
- `scripts/video/final/src/compositions/Final.tsx` — composition root
  for Cut A. v1 left this at the 13-scene proof-of-concept; v2 rewrites
  it from scratch against the new storyboard.
- `scripts/video/final/src/lib/capture-frames/{TerminalFrame,BrowserChrome}.tsx`
  — wrappers. v1 retrofitted them with `playbackRate` / `startFrom` /
  `endAt`; v2 re-adds those props plus a `splitHalf?: 'left' | 'right'`
  for the HMR composite.
- `scripts/video/tapes/_TEMPLATE.tape` — VHS tape pattern.
- `scripts/video/playwright/playwright.config.ts` — 1280×720, video on.
- `plugins/design/dev-server/bin/server-up.sh` — repo-side helper.
  Scratch needs its own `--port 4400` wrapper.

### Files to Create (v2 — replacing v1's "Files to Create")

**Storyboard + plan:** already-committed (this plan + storyboard.md +
DDR-037 + project memory) — no new docs to write.

**Capture infrastructure:**

- `scripts/video/final/lib/server-up.sh` — scratch dev-server launcher
  (`--root $SCRATCH --port 4400`). v1 authored; v2 re-authors clean.
- `scripts/video/tapes/01-install-init-serve.tape` — install + init +
  serve via `bun add -g @1agh/maude` (not `npm i -g`).
- `scripts/video/tapes/02-claude-tui-discovery.tape` — captures `claude`
  in the scratch dir running `/design:setup-ds project "..."` with
  Stage 1's first prompt visible.
- `scripts/video/tapes/03-hmr-edit.tape` — VHS of an editor edit on
  `Recipe Recap.tsx` (a `sed` or `nvim` modification). Drives the LEFT
  half of the split-screen HMR scene.
- `scripts/video/playwright/04-canvas-reveal.spec.ts` — Space+drag pan
  across the 4 artboards + zoom-out reveal.
- `scripts/video/playwright/05-canvas-hero.spec.ts` — 3 sequential
  Cmd+hovers (1.5 s each) on distinct elements + Cmd+shift+Click
  multi-select on a 4th.
- `scripts/video/playwright/06-hmr-reload.spec.ts` — Playwright capture
  of canvas reload (drives the RIGHT half of the split-screen HMR).
- `scripts/video/playwright/07-comments.spec.ts` — fixed: explicit
  keyboard `Meta+0` to reset canvas-shell zoom to 1.0 at start, then
  click empty area, type comment, submit, click old pin, reply,
  resolve.
- `scripts/video/playwright/09-annotations.spec.ts` — pen tool + arrow
  tool + label.
- `scripts/video/playwright/08-docs.spec.ts` — smooth `scrollTo` with
  3-second paint wait at start.

**Captures (outputs of the above):**

- `scripts/video/final/public/scene-02-install.mp4`
- `scripts/video/final/public/scene-03-tui-discovery.mp4`
- `scripts/video/final/public/scene-04-ds-reveal.mp4`
- `scripts/video/final/public/scene-05-canvas-reveal.mp4`
- `scripts/video/final/public/scene-06-canvas-hero.mp4`
- `scripts/video/final/public/scene-07a-hmr-edit.mp4` (VHS)
- `scripts/video/final/public/scene-07b-hmr-reload.mp4` (Playwright)
- `scripts/video/final/public/scene-08-comments.mp4`
- `scripts/video/final/public/scene-09-annotations.mp4`
- `scripts/video/final/public/scene-10-docs.mp4`

**Remotion scenes:**

- `scripts/video/final/src/scenes/05-benefit-card/index.tsx` —
  parameterized `<BenefitCard kind="local-figma"|"all-in-one"|"human-ai"|"your-repo" />`.
- `scripts/video/final/src/scenes/09-hmr-split/index.tsx` —
  `<HmrSplitScene leftSrc="..." rightSrc="..." />` composite.
- `scripts/video/final/src/compositions/Final.tsx` — Cut A (15 scenes,
  ~75 s). Rewritten from scratch against the v2 storyboard.
- `scripts/video/final/src/compositions/Final30.tsx` — Cut B (7 scenes,
  ~30 s).

**Site embed:**

- `site/components/mdcc/demo-video.tsx` — autoplay muted loop +
  prefers-reduced-motion pause.
- `site/public/{demo.mp4, demo-30s.mp4, demo-poster.jpg}`.
- `site/app/(home)/page.tsx` — insert `<DemoVideo />` between hero and
  catalog (v1 location).
- CSS: append to `site/app/global.css`.

**README + npm hygiene:**

- README inline `<video>` pointing at the release-asset URL.
- `scripts/check-publish-size.sh` — tarball + MP4 reject guard.

### Documentation

- VHS docs: https://github.com/charmbracelet/vhs.
- Playwright video: https://playwright.dev/docs/videos.
- Remotion `<TransitionSeries>`: https://www.remotion.dev/docs/transitions.
- Remotion `<OffthreadVideo>` props (incl. `startFrom` semantics —
  **frames at composition fps**, not seconds; v1 wasted one render
  iteration on this):
  https://www.remotion.dev/docs/offthreadvideo.
- npm optional-deps bug context (drives the install-tape decision):
  https://github.com/npm/cli/issues/4828.
- Pixabay Music license: https://pixabay.com/service/license-summary/.

---

## Design Decisions

The full set of carry-over decisions lives in DDR-037. Highlights:

### 1. Install tape uses `bun add -g`, not `npm i -g`

v1's VHS captured a real `npm i -g @1agh/maude` followed by `maude design
serve --port 4400` — which threw `Cannot find native binding ... oxc-parser`
at the viewer because npm's optional-deps handling drops the platform-
specific native binding on global install (npm/cli#4828). Bun handles
optional deps correctly. v2 tape uses `bun add -g @1agh/maude` and the
demo runs clean.

Separate follow-up: the project itself should either document this OR
ship a postinstall script that pre-resolves the native binding. Out of
scope for this plan but flagged in DDR-037.

### 2. Scratch dir fixture path (carried over from v1)

Genuine `/design:setup-ds` + `/design:new` + `/design:edit` flow against
the scratch dir costs 2.5–4 h of compute. v2 keeps v1's fixture path:
copy this repo's `.design/system/maude/` into scratch as the `project`
DS, hand-author `Recipe Recap.tsx` (4 artboards: hero/scaler/ingredients/
print), seed 2 comments (1 open with reply, 1 resolved). The marketing
video shows the *result* of that flow, not the flow producing it.

**Exception**: the Claude TUI capture (Scene 3) DOES show
`/design:setup-ds` running for real — but only the first ~6 seconds, up
to Stage 1's first prompt rendering. The discovery doesn't complete
inside the video; the viewer sees that the onboarding *exists* and is
genuine, then the next scene cuts to the rendered DS.

### 3. Benefit cards are pure-Remotion TSX, not composited from captures

Four parameterized `<BenefitCard kind="..." />` scenes built with
Berkeley-mono headlines + DS tokens + spring-animated text reveal. No
external captures. Renders deterministically; goldens-friendly.

### 4. HMR is a split-screen composite

Single new `<HmrSplitScene leftSrc rightSrc>` component that lays a VHS
terminal capture (the edit) at 50 % left, a Playwright canvas-reload
capture at 50 % right, with a 1px hairline rule between halves matching
the DS style. Both halves play at full speed; the right half is timed
to start 0.4 s after the left so the viewer sees "edit → then reload."

### 5. Pacing target: ~75 s / 15 scenes for Cut A

v1 was 48 s / 9 scenes ≈ 5.3 s/scene. v2 is 75 s / 15 scenes ≈ 5 s/scene
average, but with **benefit cards intentionally at 2 s each** and
feature scenes at 6–9 s. Faster cut, more density. The 4 cards each
land a different benefit beat between feature groups.

### 6. Cut B unchanged in shape from v1

7 scenes / ~30 s. Drops the Claude TUI, the benefit cards, the
comments, the annotations — keeps the spine: install → canvas → inspect
→ HMR → docs. The split-screen HMR makes Cut B genuinely more
informative than v1's single-canvas HMR.

---

## Tasks

Execute in order. Each task is atomic and testable. Where a task says
"per storyboard," consult `scripts/video/storyboard.md` for the exact
slot / caption / source path; storyboard is the canonical spec.

### Task 0 — GATE: phase 15.1 infrastructure clean (same as v1)

- **Do:** `pnpm run video:smoke` ; `(cd scripts/video/final && pnpm exec tsc --noEmit && pnpm run lint:motion && pnpm run lint:tape && pnpm run goldens:check && pnpm run qa Demo)` all exit 0.
- **Pattern:** Hard gate. Do not start v2 against a broken workspace.
- **Validate:** All commands exit 0.

### Task 1 — VERIFY tool prerequisites

- **Do:** check on `$PATH`: `bun` ≥ 1.3, `vhs`, `ffmpeg`, `claude` CLI,
  `pnpm`. Each missing tool aborts v2 with the install hint per
  DDR-037's "v2 entry prerequisites" table.
- **Pattern:** Pre-flight. v1 didn't check `claude` because no TUI scene
  existed; v2 needs it.
- **Validate:** `command -v <tool>` exits 0 for each.

### Task 2 — BOOTSTRAP scratch project (fixture path, same as v1)

- **Do:**
  1. `SCRATCH=/tmp/scratch-maude-demo-$(date +%Y%m%d)`
  2. `rm -rf "$SCRATCH" && mkdir -p "$SCRATCH/.design"`
  3. `cd "$SCRATCH" && node <repo>/cli/bin/maude.mjs init --name recipe-recap`
  4. Copy this repo's DS as fixture: `cp -r <repo>/.design/system/project "$SCRATCH/.design/system/project"`
  5. Copy `<repo>/.design/{config.json,README.md,INDEX.md}` to `$SCRATCH/.design/`.
  6. Edit `$SCRATCH/.design/config.json` → `name: "recipe-recap"`.
  7. Author `$SCRATCH/.design/ui/Recipe Recap.tsx` per the v1 spec
     (4 artboards — hero/scaler/ingredients/print; recipe = Bramborový
     guláš; Berkeley mono; amber-rust stamps; `data-cd-id` attributes
     on hero-meta, hero-photo, scaler-control, ingredients, print-page).
  8. Author `$SCRATCH/.design/ui/Recipe Recap.meta.json`.
  9. Seed `$SCRATCH/.design/_comments/ui-recipe_recap.tsx.json` with
     two entries: 1 open with reply (selector `[data-cd-id="hero-meta"]`)
     + 1 resolved (selector `[data-cd-id="scaler-inc"]`).
- **Pattern:** Fixture; do not invoke real `/design:setup-ds`. v1 retro
  confirmed visual-equivalence at 5–12 s/scene playback.
- **Validate:** ≥ 6 specimens, canvas + meta exist, comments JSON has
  length 2.

### Task 3 — AUTHOR scratch dev-server wrapper

- **Do:** create `scripts/video/final/lib/server-up.sh` that spawns
  `bun plugins/design/dev-server/server.ts --root $SCRATCH --port 4400`
  and writes `$SCRATCH/.design/_server.json`. Idempotent — re-use if
  alive, respawn if stale.
- **Pattern:** Two-port pattern (DDR-037 §2). Repo on 4399, scratch on
  4400.
- **Validate:** `bash scripts/video/final/lib/server-up.sh` prints port
  4400 on stdout; `curl http://localhost:4400/_health` returns ok.

### Task 4 — RECORD VHS Scene 2 (install + init + serve via bun)

- **Do:**
  1. Kill any existing process on 4400 before recording.
  2. Author `scripts/video/tapes/01-install-init-serve.tape`:
     ```
     Hide: cd to /tmp/vhs-install-demo, clear.
     Show: `bun add -g @1agh/maude` (10–14 s real install)
           → `maude init --name recipe-recap` (3 s)
           → `maude design serve --port 4400` (3 s — boots cleanly)
     ```
  3. Run: `vhs scripts/video/tapes/01-install-init-serve.tape`.
- **Pattern:** DDR-037 §1 — bun-add bypasses the npm/cli#4828 bug.
- **Validate:** `scene-02-install.mp4` exists; visual frame at 18–21 s
  shows `maude design serve --port 4400` startup output without any
  red `Error` or `Cannot find native binding` text.

### Task 5 — RECORD VHS Scene 3 (Claude TUI /design:setup-ds discovery)

- **Do:**
  1. Author `scripts/video/tapes/02-claude-tui-discovery.tape`:
     ```
     Hide: cd $SCRATCH, clear.
     Show: `claude` (3 s boot)
           → type `/design:setup-ds project "Recipe manager kde nastavis pocet porci a on prepocita ingredience. Pro me a 3 kamarady. Vibe: 80s cookbook, Berkeley-mono everywhere, hard-edges + amber-rust stamp accent."`
           Enter
           → wait 6–8 s for Stage 1 first prompt to render
     ```
  2. **Capture only the first prose prompt**, do NOT answer it. The tape
     terminates after 6 s of Stage 1 visible.
  3. Run: `vhs scripts/video/tapes/02-claude-tui-discovery.tape`.
- **Pattern:** Honest onboarding capture. Discovery does NOT complete
  inside the marketing video.
- **Validate:** `scene-03-tui-discovery.mp4` exists; visual frame shows
  Claude Code TUI with the slash command typed AND Stage 1's first
  prose prompt rendering (or about to render — agent reads end frame).

### Task 6 — RECORD Playwright Scene 4 (DS reveal, 4 specimens)

- **Do:** Per v1's known-good spec — `goto /`, click "DESIGN SYSTEM"
  tree node, click each of `colors-accent` → `type-scale` →
  `components-buttons` → `components-callout` with 1.4 s holds. Initial
  2.5 s hydration wait per DDR-036 Gotcha 2.
- **Pattern:** Tree-nav over direct URLs (DDR-037 §4 — direct URLs leak
  the `_layout.css`).
- **Validate:** `scene-04-ds-reveal.mp4` exists ~7.5 s; mid-frame shows
  any single specimen rendered cleanly inside the dev-server UI chrome.

### Task 7 — RECORD Playwright Scene 5 (canvas reveal + pan)

- **Do:** `goto /`, click "Recipe Recap", wait 2.8 s hydration,
  programmatically `Cmd+0` (or equivalent reset) to ensure zoom = 1.0
  before any input. Then Space+drag pan from hero artboard (left) to
  print artboard (right) over ~2.5 s. Hold 1 s, then Cmd+wheel zoom-out
  over ~1.5 s to reveal all 4 artboards.
- **Pattern:** Free-move demo. New v2 capture — replaces v1's static
  reveal.
- **Validate:** `scene-05-canvas-reveal.mp4` exists ~7 s; mid-frame
  shows the canvas mid-pan (not centered on one artboard).

### Task 8 — RECORD Playwright Scene 6 (canvas-hero — 3 hovers + multi-select)

- **Do:** `goto /` → "Recipe Recap" → 2.8 s wait → `Cmd+0` zoom reset.
  Hold Meta, hover element #1 (e.g. hero title) for 1.5 s, move to
  element #2 (scaler `+` button) for 1.5 s, move to element #3
  (ingredient row) for 1.5 s. Click while Meta held to select. Then
  Cmd+Shift+Click on element #4 (print preview) to multi-select.
- **Pattern:** v1 inspector demo failed because the ring flashed once;
  v2 makes it dwell. Multi-select is the new ending beat.
- **Validate:** Spec passes; `scene-06-canvas-hero.mp4` exists ~9 s;
  mid-frame shows visible inspector halo on an element.

### Task 9 — RECORD VHS Scene 7a (HMR — left half / file edit)

- **Do:** Author `scripts/video/tapes/03-hmr-edit.tape`:
  ```
  Hide: cd $SCRATCH/.design/ui, clear, set $EDITOR=nvim or use sed.
  Show: open `Recipe Recap.tsx` (preview via `bat` or open in nvim)
        → run `sed -i '' 's/Bramborový guláš/Bramborový guláš · v2/' "Recipe Recap.tsx"`
        → display the diff via `git diff --no-color -- "Recipe Recap.tsx" | head -20`
        Sleep 2s.
  ```
- **Pattern:** Visible terminal-side edit affordance. The VIEWER sees
  the file change. Drives the LEFT half of the split-screen.
- **Validate:** `scene-07a-hmr-edit.mp4` exists ~5–6 s; frame at 4 s
  shows the diff output.

### Task 10 — RECORD Playwright Scene 7b (HMR — right half / canvas reload)

- **Do:** `goto /` → "Recipe Recap" → wait 2.8 s hydration → wait 0.6 s
  → programmatically `fs.writeFile($SCRATCH/.design/ui/Recipe Recap.tsx, edited)`
  (the same `· v2` edit) → wait 4.5 s for HMR + iframe re-render → revert.
- **Pattern:** Right half of split-screen. Timed so the file write
  happens ~0.6 s after spec start (matching the VHS left half's edit
  moment).
- **Validate:** `scene-07b-hmr-reload.mp4` exists ~7–8 s; frame at 4 s
  shows the canvas with "Bramborový guláš · v2" visible.

### Task 11 — RECORD Playwright Scene 8 (comments, zoom-reset + composer)

- **Do:** `goto /` → "Recipe Recap" → 2.8 s wait → **`Cmd+0` to reset
  zoom to 1.0** → wait 0.4 s. Hover an empty area → wait 1.5 s for the
  cursor pin halo. Click empty area → wait for composer → type a
  comment (`"Dýchá to víc?"`) → submit → wait 1.5 s → click the
  pre-seeded open pin → thread expands → reply (`"souhlasím"`) →
  submit → wait 2 s.
- **Pattern:** DDR-037 §6 — canvas-shell auto-zoom propagation killed
  v1's comments; explicit reset fixes it.
- **Validate:** `scene-08-comments.mp4` exists ~7 s; mid-frame shows a
  visible pin halo or composer above the canvas.

### Task 12 — RECORD Playwright Scene 9 (annotations)

- **Do:** `goto /` → "Recipe Recap" → 2.8 s wait → `Cmd+0`. Open the
  Tools menubar (top bar) → select Pen. Draw a free-form mark across
  the hero artboard (3-point bezier-like path via 3 `page.mouse.move`
  + click). Switch to Arrow tool → draw arrow from one element to
  another. Switch to text/label → type `"+10% spacing"` → click to drop.
- **Pattern:** New v2 capture. Demonstrates the under-used annotation
  layer.
- **Validate:** `scene-09-annotations.mp4` exists ~5–6 s; mid-frame
  shows at least one drawn mark + label.

### Task 13 — RECORD Playwright Scene 10 (docs, smooth scroll)

- **Do:** `goto https://maude.iagh.cz` → wait 3 s for paint → use
  `page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }))`
  with 1.2 s gaps between two scroll steps.
- **Pattern:** DDR-037 §5 — `mouse.wheel` produced choppy frames; the
  evaluate-based smooth scroll renders evenly.
- **Validate:** `scene-10-docs.mp4` exists ~4–5 s; no visible
  blank-flash in the first second (3 s paint wait covers it).

### Task 14 — TRANSCODE all WebMs → MP4s at 30 fps

- **Do:** loop over the 7 Playwright spec outputs; `ffmpeg -c:v libx264
  -pix_fmt yuv420p -r 30 -an`. Output in `scripts/video/final/public/`.
- **Validate:** 10 MP4s total (3 VHS + 7 Playwright) named per the
  storyboard's capture roster.

### Task 15 — BUILD `<BenefitCard>` Remotion scene

- **Do:** new `scripts/video/final/src/scenes/05-benefit-card/index.tsx`
  exporting `BenefitCard({ kind })` with 4 cases per the storyboard's
  Benefit Cards table. Each case:
  - SKU stamp top-left, catalog strip footer (using DS tokens).
  - Headline at 96-pt Berkeley Mono, spring-animated entrance via
    `remotion-bits`.
  - Subline at 24-pt, fades in 0.2 s after headline.
  - Optional decorative element per kind (interpunct chain / file-tree
    fragment / connecting line).
- **Pattern:** Pure-Remotion deterministic — goldens-friendly.
- **Validate:** `pnpm exec tsc --noEmit` clean.

### Task 16 — BUILD `<HmrSplitScene>` composite

- **Do:** new `scripts/video/final/src/scenes/09-hmr-split/index.tsx`
  with two `<AbsoluteFill>` halves sized 50/50, each rendering a
  `<TerminalFrame>` (left) and `<BrowserChrome>` (right). 1px rule
  divides them. Right half's `<OffthreadVideo>` uses `startFrom={18}`
  (0.6 s @ 30 fps) so the edit is visible before the reload begins.
- **Pattern:** Replaces v1's plain HMR scene. Best visual demonstration
  of the loop.
- **Validate:** `pnpm exec tsc --noEmit` clean.

### Task 17 — COMPOSE Final.tsx v2 (Cut A, 15 scenes)

- **Do:** rewrite `scripts/video/final/src/compositions/Final.tsx`
  against the storyboard's Cut A v2 table — 15 sequences with 14 xfades.
  Audio: `<Audio src={staticFile('ambient.aac')} loop volume={0.7} />`.
  Captions per the storyboard caption table.
- **Validate:** `pnpm exec tsc --noEmit` clean; `pnpm run render Final
  out/Final.mp4 --crf=23` succeeds; duration within ± 0.5 s of target.

### Task 18 — COMPOSE Final30.tsx v2 (Cut B, 7 scenes)

- **Do:** rewrite to the storyboard's Cut B v2 table — 7 sequences with
  6 xfades. Reuse Cut A's captures.
- **Validate:** tsc clean; render succeeds; duration ~30 s.

### Task 19 — UPDATE Root.tsx registry

- **Do:** register `Final` + `Final30` with their new `durationInFrames`
  computed from the storyboard.
- **Validate:** `pnpm exec tsc --noEmit` clean.

### Task 20 — VISUAL QA gate (mandatory)

- **Do:** `pnpm run qa Final 18` + `pnpm run qa Final30 12`. Read every
  JPG via the Read tool. Acceptance: no blank-white frames, no error
  text in any capture, every caption legible, transitions smooth, the
  benefit cards animate (compare frames 5 / 30 / 55 of each card slot
  to confirm motion).
- **Pattern:** DDR-036 mandatory step — agent reads ALL frames, no
  sampling.
- **Validate:** Per-scene confirmation in execution report.

### Task 21 — LOUDNORM + copy to site/public

- **Do:** `loudnorm=I=-18:LRA=11:TP=-1.5` on both cuts via
  `-c:v copy`. Extract poster from `demo.mp4` frame 30.
- **Validate:** `demo.mp4` < 16 MB, `demo-30s.mp4` < 10 MB, integrated
  loudness within −18 ± 2 LU for both.

### Task 22 — SITE EMBED (DemoVideo component)

- **Do:** author `site/components/mdcc/demo-video.tsx` (autoplay muted
  loop + prefers-reduced-motion pause + iOS playsInline). Insert
  `<DemoVideo />` in `site/app/(home)/page.tsx` between hero and
  catalog. Append `.mdcc-demo-video-wrap` + `.mdcc-demo-video` CSS to
  `site/app/global.css` honoring DS tokens.
- **Validate:** `pnpm --filter @maude/site build` exits 0.

### Task 23 — README embed + npm hygiene

- **Do:** add inline `<video>` tag below README H1 pointing at the
  release-asset URL. Author `scripts/check-publish-size.sh` (rejects
  MP4 / `scripts/video/` paths in the tarball; caps tarball at 2 MB).
- **Stop before `gh release create`** per user policy (DDR-037 §7).
  Print the exact `gh release create demo-assets-v<version>
  site/public/demo-30s.mp4` command and pause.
- **Validate:** `bash scripts/check-publish-size.sh` exits 0.

### Task 24 — APPEND DDR-037 with v2 execution log

- **Do:** add a "v2 execution log" section to DDR-037 listing the
  concrete decisions made during v2 execution + any new gotchas
  discovered.
- **Validate:** DDR-037 cross-links resolve.

---

## Validation

End-to-end happy path:

1. `pnpm run video:smoke` exits 0.
2. `(cd scripts/video/final && pnpm exec tsc --noEmit && pnpm run lint:motion && pnpm run lint:tape && pnpm run goldens:check)` all exit 0.
3. `bash scripts/video/final/lib/server-up.sh` prints port 4400.
4. All 3 VHS tapes render clean (no leaked Hide-block commands, no
   visible error text in install scene).
5. All 7 Playwright specs pass; agent reads at least the mid-frame of
   each capture and confirms scene intent.
6. `pnpm run qa Final 18 && pnpm run qa Final30 12` — agent reads
   every JPG.
7. `demo.mp4` < 16 MB, `demo-30s.mp4` < 10 MB, loudness −18 ± 2 LU.
8. Site builds (`pnpm --filter @maude/site build` exits 0).
9. README renders the `<video>` tag (visually verify on GitHub preview
   AFTER user manually `gh release create`s the asset).
10. `bash scripts/check-publish-size.sh` exits 0.

---

## Acceptance Criteria

- [ ] Tasks 0–24 completed in order.
- [ ] Phase 15.1 gates green (Task 0).
- [ ] All tool prerequisites present (Task 1) — `bun`, `vhs`, `claude`,
      `ffmpeg`, `pnpm`.
- [ ] Scratch project bootstrapped via fixture path.
- [ ] 10 capture MP4s produced (3 VHS + 7 Playwright).
- [ ] Install scene shows no `Error` / `Cannot find native binding`
      text (the v1 regression).
- [ ] Claude TUI scene shows the slash command typed + Stage 1 first
      prompt visible.
- [ ] Canvas-hero shows visible inspector halo on at least 2 distinct
      elements + a multi-select moment.
- [ ] Comments scene shows visible pins + composer after zoom-reset.
- [ ] Annotations scene shows at least one drawn mark + a label.
- [ ] HMR split-screen shows the file edit on left AND canvas reload
      on right within the same 8 s slot.
- [ ] 4 benefit cards render with animated headline + subline + DS
      framing.
- [ ] `pnpm run qa Final` + `pnpm run qa Final30` contact sheets read
      clean end-to-end (agent confirms scene-by-scene).
- [ ] `site/public/demo.mp4` < 16 MB, ~75 s, loudness −18 ± 2 LU.
- [ ] `site/public/demo-30s.mp4` < 10 MB, ~30 s, same loudness.
- [ ] DemoVideo embedded in landing; build green.
- [ ] README `<video>` markdown present (gh release upload deferred to
      user).
- [ ] `scripts/check-publish-size.sh` exits 0; no MP4 in tarball.
- [ ] DDR-037 v2 execution log appended.
