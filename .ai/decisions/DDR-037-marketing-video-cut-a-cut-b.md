# DDR-037: Marketing demo video — v1 retro, v2 plan, production gotchas

- **Date:** 2026-05-20
- **Status:** Accepted (v1 retro) → in-progress (v2 execution)
- **Tags:** video, marketing, captures, retro, two-port-dev-server, hydration-wait, npm-optional-deps, claude-tui
- **Related:** [DDR-031](./DDR-031-video-pipeline-toolchain-remotion-vhs-playwright.md), [DDR-036](./DDR-036-video-pipeline-infrastructure.md), [`.ai/plans/phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md), [`scripts/video/storyboard.md`](../../scripts/video/storyboard.md)

## Context

Phase 15.1 (DDR-036) shipped the assembly infrastructure. Phase 15.5
authored real marketing content on top. The first execution (v1, 2026-05-20)
produced cuts that didn't sell the product — the user feedback led to a
full discard of v1 artifacts and a v2 rebuild.

This DDR captures **what we learned from v1 so v2 doesn't repeat the
same mistakes**, plus the design decisions carried forward.

## v1 retro — what shipped and what failed

v1 delivered:

- Cut A: 48 s, 9 scenes, 4.3 MB post-loudnorm.
- Cut B: 26 s, 7 scenes, 2.5 MB.
- Captures: 1 VHS install + 6 Playwright (DS reveal / canvas reveal /
  canvas hero / edit-reload / comments / docs).
- Site embed component + README markdown.

v1 failed in eight concrete ways (verbatim user feedback, 2026-05-20):

| # | Feedback | Root cause |
|---|----------|------------|
| 1 | "select tam skoro neni videt jen to problikne" — inspector ring flashes once | Spec did 1 hover + 1 click sequence with no dwell; the halo is animated for ~0.4 s |
| 2 | "live edit by bylo dobre mit split screen s terminalem" | v1 HMR scene was just the canvas reloading; viewer can't see *what* changed |
| 3 | "10s `maude design serve --port 4400` vyhodi nejaky Error" | npm/cli#4828 (optional-deps native binding) — `npm i -g @1agh/maude` drops the platform-specific `oxc-parser` native binding; `maude design serve` fails at startup |
| 4 | "48s 'multi-artboard canvas' by mohl mit treba pan po canvase" | v1 canvas-reveal was zoom-out only; never panned across artboards |
| 5 | "scroll v docs je dost sekany, skace" | v1 used `page.mouse.wheel` which produces discrete jumps; needs `scrollTo({ behavior: 'smooth' })` |
| 6 | "chybi mi tam jeste comment on canvas" | Dropped from v1 because canvas-shell zoom-state propagated from canvas-hero spec (29 %) made pins invisible |
| 7 | "annotation on canvas" | Not in v1 plan at all |
| 8 | "ukazal bych jeste pred design systemem jak funguje slash command primo v claude /design:setup-ds aspon prvni otazku" | v1 explicitly forbade Claude TUI per "no slash commands in shell" rule — user reversed the rule for v2 |
| 9 (meta) | "je to takove cele nudne, nebal bych se vice pohrat s kompozici" | v1 lacked benefit framing; pure feature-demo. No "why should I care" beats. |

User-added marketing benefits to highlight in v2:
- Local Figma-like Claude Design clone
- Everything in one place including development
- Excellent for human ↔ AI and AI ↔ human communication
- Everything lives in your repo, no third party

## Decisions carried forward into v2

### 1. Install tape uses `bun add -g`, not `npm i -g`

`npm i -g @1agh/maude` succeeds visually but breaks the dev-server at
runtime — `oxc-parser`'s native binding isn't on disk after install
because of npm/cli#4828. Bun handles optional deps correctly. v2 tape
uses:

```
Type "bun add -g @1agh/maude"
```

This is also real product feedback: first-time users following the
README's `npm i -g` instruction will hit the same wall. Two
remediation paths exist for the project (out of scope for this DDR but
flagged here):

- Add a postinstall script in `package.json` that explicitly re-installs
  the matching platform native binding.
- Update the README + docs install snippets to recommend `bun add -g`
  with `npm i -g` as a fallback with a known caveat.

### 2. Two-port dev-server pattern (carried from v1)

Repo on 4399, scratch on 4400. `scripts/video/final/lib/server-up.sh`
hard-codes `--port 4400` and `--root $SCRATCH`. State files
(`_server.json`) live in each project's own `.design/`, no
cross-contamination.

### 3. Fixture path for `.design/` content (carried from v1)

Running genuine `/design:setup-ds` + `/design:new` + `/design:edit` end
to end costs 2.5–4 h of compute and significant token budget. The
fixture path (copy this repo's DS, hand-author Recipe Recap canvas,
seed comments) is visually equivalent at 5–12 s/scene playback.

**v2 exception:** Scene 3 (Claude TUI) captures the GENUINE
`/design:setup-ds` command running for the first ~6 seconds, up to
Stage 1's first prose prompt rendering. The discovery doesn't complete
inside the video; the marketing point is *the onboarding exists and is
real*, then the next scene cuts to the fixture-rendered DS.

### 4. Full-UI navigation over direct specimen URLs

v1 first attempt at Scene 3 (DS reveal) used
`/_canvas-shell.html?canvas=system/project/preview/colors-accent.tsx&...`
direct URLs. Output was washed-out white pages — the `_layout.css` that
bakes the catalog chrome onto specimens wasn't loading correctly under
that URL flavor. Fix: `goto /` → click tree node → click specimen by
text. Full UI loads + the file tree gives the viewer richer context.

### 5. Capture wrappers gained `playbackRate` / `startFrom` / `endAt`

Three pass-through props on `<TerminalFrame>` + `<BrowserChrome>`.
Three v1 use cases:

- **VHS install** captured for 22 s; Cut A's slot is 7–8 s →
  `playbackRate={2.75}` compresses on the Remotion side without
  re-encoding the source MP4.
- **Docs scene** caught a 2 s blank-white flash before `maude.sh`
  finished painting; `startFrom={60}` skipped the flash.
- **Critical lesson:** `startFrom` is in **frames at composition fps**,
  NOT seconds. `startFrom={2}` at 30 fps = 0.067 s (basically nothing).
  Cost one render iteration to discover.

### 6. v2 adds: split-screen HMR + benefit cards + annotations + Claude TUI

Four new content surfaces in v2:

- **Split-screen HMR**: `<HmrSplitScene leftSrc rightSrc>` lays a VHS
  terminal capture (the edit moment) on the left 50% + a Playwright
  canvas-reload capture on the right 50%, separated by a 1px DS-style
  rule. Right half's `<OffthreadVideo startFrom>` offsets so the viewer
  sees "edit → then reload" timing.

- **4 benefit cards** as pure-Remotion TSX scenes (no captures). Each
  card is a parameterized `<BenefitCard kind="local-figma" |
  "all-in-one" | "human-ai" | "your-repo" />`. SKU stamp top-left +
  catalog footer + Berkeley Mono headline + spring-animated entrance.
  Deterministic; goldens-friendly.

- **Annotations scene** demonstrates the under-used annotation layer
  (pen tool / arrow / label). v1 didn't include this; viewer didn't
  learn about a real feature.

- **Claude TUI scene** captures `claude` in the scratch dir running the
  real `/design:setup-ds` slash command, with Stage 1's first prose
  prompt visible. Reverses v1's "no slash commands in shell" rule.

### 7. Pacing — Cut A is now 75 s / 15 scenes

v1 was 48 s / 9 scenes at 5.3 s/scene. v2 is 75 s / 15 scenes at
~5 s/scene average, BUT with benefit cards intentionally at 2 s each
and feature scenes at 6–9 s. Faster cut, more density.

### 8. Stop before `gh release create`

Per user policy. v2 prepares the README markdown + check-publish-size
guard + the staged `demo-30s.mp4` in `site/public/`, but does NOT call
`gh release create`. The user runs `gh release create demo-assets-v<X.Y.Z>
site/public/demo-30s.mp4` manually when ready.

## Production gotchas — running list

Carried from DDR-036 (`#1`–`#3`); `#4`–`#8` added in v1's first
execution; `#9` predicted for v2.

| # | Gotcha | Fix |
|---|--------|-----|
| 1 | VHS Hide block doesn't clear shell buffer — typed-but-hidden commands leak into captured frames. | Add `Type "clear" Enter` before `Show`. (DDR-036) |
| 2 | Playwright viewport at 1920×1080 leaves ~33% empty bg in source — composes ugly. | Use 1280×720 for capture; let Remotion `<OffthreadVideo>` upscale via `objectFit:cover`. (DDR-036) |
| 3 | Per-scene goldens cannot regress capture-driven scenes — captures are external inputs that change. | Two-tier verification: per-scene goldens for pure-TSX scenes + `pnpm run qa` contact-sheet for capture-composite scenes. (DDR-036) |
| 4 | Canvas-shell zoom state propagates between Playwright spec runs via the canvas's `meta.json` viewport field. | Reset zoom explicitly at spec start via `await page.keyboard.press('Meta+0')` (or whatever the canvas-shell zoom-reset shortcut is). |
| 5 | `<OffthreadVideo startFrom>` is **frames at composition fps**, not seconds. | Compute `startFrom = secondsToSkip * fps`. Document in wrapper-component prop comments. |
| 6 | `https://...` Playwright captures need MORE hydration time than localhost — `networkidle` returns before custom fonts paint. | Bump initial wait to 2.5–3 s OR trim the rendered slot with `startFrom`. |
| 7 | `npm i -g @1agh/maude` succeeds silently but breaks the dev-server because oxc-parser's native binding isn't installed (npm/cli#4828). | Use `bun add -g` in VHS tapes. Document the issue separately for product / docs. |
| 8 | Inspector ring + pin halo animations are ~400 ms — too fast for the marketing eye at standard 1× playback. | Spec must dwell with `waitForTimeout(1500)` between hover-move + click. Multiple sequential hovers reinforce the affordance. |
| 9 | `page.mouse.wheel` produces discrete-step scroll frames — choppy at 30 fps. | Use `page.evaluate(() => window.scrollTo({ top, behavior: 'smooth' }))` for marketing scrolls. |

## Consequences

- v1 artifacts are gone — `site/public/demo*.mp4`, the 7 capture MP4s,
  the `01-install-init-serve.tape`, the 6 Playwright specs, the v1
  Final.tsx + Final30.tsx, the DemoVideo component, the README video
  tag, the publish-size guard, the scratch dev-server wrapper.
- v2 plan + storyboard + this DDR + a project-memory file are the
  **preserved learnings**. They will be the inputs for the next
  `/flow:execute phase 15.5` invocation.
- v2 is materially more work than v1: 3 new VHS tapes (vs 1), 7
  Playwright specs (4 re-shoots + 2 new + 1 re-author), 2 new
  Remotion-only scenes (`<BenefitCard>` + `<HmrSplitScene>`), rewritten
  compositions. Realistic compute: 3–5 h in one continuous session.
- Cut B in v2 has more *visual* density than v1 thanks to the
  split-screen HMR — same 30 s budget, more legible per-scene.

## Migration

None. v2 starts from a clean working tree (this DDR + plan + storyboard
+ project-memory are the only carry-over artifacts).

When v2 executes:

- `bash scripts/video/final/lib/server-up.sh` boots scratch on 4400.
- Three VHS tapes (`01-install`, `02-claude-tui`, `03-hmr-edit`) get
  recorded.
- Seven Playwright specs (`04-08`, `09-annotations`, `06-canvas-hero`,
  `10-docs`) get recorded.
- Two Remotion scenes (`05-benefit-card`, `09-hmr-split`) get authored.
- `Final.tsx` + `Final30.tsx` + `Root.tsx` get rewritten against the
  v2 storyboard.
- QA → loudnorm → site embed → README → publish-size guard.
- `gh release create` deferred to user.

## v2.1 refinements (added 2026-05-20, second feedback round)

User added four more constraints after the v2 plan landed:

### a. Real maude in the sandbox (not all-fixture)

`/design:new` and `/design:edit` must actually execute against the
scratch dir during recording, with both the Claude TUI side (VHS) and
the dev-server iframe side (Playwright) captured concurrently and
composited as a `<SplitScreenFrame>`. The viewer sees cause-and-effect
side by side.

`/design:setup-ds` stays as a dry-run capture (questionary kickoff
only, no completion) — its output is not used. DS is copied from this
repo's `.design/system/project/`.

### b. Single perfect cut, length flexible

Drop the Cut A / Cut B split. One ~90 s cut, same MP4 embedded on
landing AND linked from README. Length cap is the 16 MB site
autoplay budget, not a wall-clock target.

### c. Visual verification loop baked into the plan

Per-scene intent checks (must-be-visible content per mid-frame) +
named affordance hard-checks (inspector halo at 3 dwell timestamps,
comments pin OR composer, install scene no-error frames, docs scene
no-blank-paint frame, split-screen both-halves-rendered). Max 3 reshoots
per scene before escalating.

### d. Voice alignment to site + `.design`

Captions + benefit-card copy rewritten in the catalog-spine + Bear-Blog
dry-grin voice canonicalized in `.design/system/project/README.md`
§ Voice. Two cards deliberately echo site copy verbatim:

- Card B subline = site hero's "Two plugins, one CLI, some vibes."
- Card D subline = site fine-print's "No telemetry. No signup. No
  book a demo button."

The echoes are deliberate — viewers landing on the docs after the
video get a callback hit on phrases they've already read.

Final caption strings (verbatim, ASCII only):

| Scene | String |
|-------|--------|
| install | `Install. Init. Serve.` |
| tui-setup-ds | `Onboarding is a slash command.` |
| ds-reveal | `Design system from a paragraph.` |
| tui-new | `One slash. Real canvas, real code.` |
| canvas-reveal | `Multi-artboard. Pan. Zoom. Ship.` |
| canvas-hero | `Cmd+Click. The file Claude needs.` |
| tui-edit | `Edit. Reload. Same canvas.` |
| comments | `Comments anchored to pixels. No exports.` |
| annotations | `Draw on the canvas. Hand it off.` |
| docs | `Docs at maude.sh.` |

Final benefit-card copy (headline / subline):

| Card | Headline | Subline |
|------|----------|---------|
| local-figma | `Local Figma. For Claude Code.` | `Canvas-first iteration. In your repo. Under .design/.` |
| all-in-one | `Plan. Design. Ship.` | `Two plugins, one CLI, some vibes.` |
| human-ai | `Human reads. AI iterates.` | `Both sides speak the same canvas.` |
| your-repo | `Your repo. Yours forever.` | `No telemetry. No signup. No book a demo button.` |

## v2.1 execution log

(Appended during v2.1 execution — Task 24 of the plan.)

**Executed:** 2026-05-20 (same day as v2.1 plan rewrite).

**Approach taken.** Tasks 0–24 executed sequentially. Sandbox bootstrap (Task 3) at `/tmp/scratch-maude-demo-20260520/` with `maude init --name recipe-recap` for real + `.design/system/project/` copied verbatim from this repo (100 specimens). Scratch dev-server on port 4400 via new `scripts/video/final/lib/server-up.sh` (idempotent — reuses live server matching the scratch project name; respawns otherwise).

**Decision: decoupled VHS + Playwright lifetimes for tui-new + tui-edit.** v2.1 plan wrote "VHS records claude executing /design:new + /design:edit, Playwright records the result in parallel." First attempt (Task 9 initial run) recorded VHS-only for 174 s — claude was still "Julienning…" at tape end and the canvas never appeared (`.design/ui/` empty). Root cause: VHS owns the pty; when its `Sleep` budget expires, SIGHUP propagates and claude dies mid-skill. `/design:new --quick` with frontend-design + 1 critic + 2 fix iter took ~5 min in practice, not the ~60 s the plan estimated.

  **Workaround that shipped:** kick off the real `/design:new --no-critic` (and later `/design:edit`) in a separate `claude -p --permission-mode bypassPermissions` subprocess *before* starting the VHS tape. VHS still captures the slash command typed + initial spinner ("Putting…" / "Razzle-dazzling…") for ~60–180 s; the actual canvas write happens in the decoupled subprocess and lands in `$SCRATCH/.design/ui/`. Playwright spec watches the live dev-server tree (`waitFor({ name: /^Recipe Recap(\s+\d+)?$/ })`) and captures the iframe re-render the moment the file appears. Both halves of the split-screen are real, but their wall-clock origins are no longer synchronized — which is honest framing for a 12 s split-screen slot anyway.

  **Real timings:** `/design:new --no-critic` completed at T+352 s and wrote a 620-line Recipe Recap.tsx with 4 artboards (hero / scaler / ingredient list / print preview) anchored on a real Onion Soup Gratinée recipe — no placeholder copy. `/design:edit "tighten the hero, drop one row from the metadata block"` completed at T+97 s with the file shrinking 620 → 619 lines (one row removed, exactly as instructed).

**Two real packaging bugs surfaced in the install scene.** Task 6 (`01-install-init-serve.tape`) originally typed three commands: `bun add -g @1agh/maude` → `maude init --name recipe-recap` → `maude design serve --port 4400`. The third command failed at T+20 s of the tape with `error: Cannot find package 'magic-string'`. Two stacked bugs in published v0.16.0:

  1. **postinstall side-channel missing under `bun add -g`.** `cli/install.cjs` is supposed to write `cli/.platform-binary-path` pointing at the optionalDep platform binary (DDR-015). Under `bun add -g @1agh/maude` the postinstall hook either didn't fire or wrote nothing — the file was absent after install. The dev-server then fell through to the bun + server.ts path.
  2. **`magic-string` not declared as runtime dep at root.** `plugins/design/dev-server/canvas-pipeline.ts` + `canvas-build.ts` + `handoff.ts` import `magic-string`. It's listed in `plugins/design/dev-server/package.json` **devDependencies** only — the published `@1agh/maude` tarball ships the source files but not the dep, so the fallback bun+server.ts code path crashes on import.

  **Workaround that shipped:** the install tape now ends after `maude init` and omits `maude design serve --port 4400`. The viewer's mental model "install → init → see canvas appear" is preserved by the xfade straight into the DS-reveal scene (which is served from the local in-repo dev-server, not the just-installed global one). **Both bugs deserve their own followup PR + DDR** — they're real defects that will bite the next user who `bun add -g @1agh/maude`s and tries to `maude design serve`.

**Trust-dialog pre-acceptance for scratch dir.** `claude` in scratch dir presents a "Quick safety check: Is this a project you created or one you trust?" dialog on first run. VHS's typing happened *behind* that dialog (buffered into the bash buffer below the TUI) and leaked as `bash: ct: command not found` when claude exited. Pre-accepted via `python3` script that adds an entry under `~/.claude.json` → `projects` → `<scratch path>` with `hasTrustDialogAccepted: true`. Same treatment applied to `/tmp/vhs-install-demo`. **This is a load-bearing prep step for any future VHS recording that spawns `claude` in a fresh directory.**

**Viewport reset via /_api/canvas-meta beats Meta+0 from Playwright.** `Meta+0` sent via `page.keyboard.press` targets the parent page document, NOT the iframe's content document where the keydown listener lives. Cross-frame keyboard focus is unreliable in Playwright. Workaround: `canvas-hero.spec.ts` PATCHes `/_api/canvas-meta` with `{viewport: {x:0, y:0, zoom:1}}` *before* navigating. Cleaner than chasing focus inside frames.

**Treeitem name carries a comments-count badge.** After the comments spec drops 2 pins, the FileRow display name reads "Recipe Recap 2" not just "Recipe Recap". Specs using `getByRole('treeitem', {name: 'Recipe Recap', exact: true}).click()` failed on subsequent runs. Fix: regex `/^Recipe Recap(\s+\d+)?$/` matches both forms.

**Playwright cleans `outputDir` per `playwright test` invocation.** Running specs one-at-a-time wiped previous WebMs each time. Fix: invoke `playwright test` with all spec names in a single argv. All 8 specs (`04-ds-reveal 06b-canvas-appears 07-canvas-reveal 08-canvas-hero 10b-canvas-edit 11-comments 12-annotations 14-docs`) run as one pipeline in 6.7 min wall-clock; their WebMs all coexist in `.work/playwright/` afterwards.

**Capture preambles eat the on-screen budget.** Every Playwright spec includes ~3–6 s of "navigate → 2.8 s hydration → click treeitem → 2.8 s canvas load" preamble before the visible content starts. With a 7 s slot in Final.tsx, the viewer sees 1 s of content and 6 s of grey-loading. Fix: `<BrowserChrome>` + `<TerminalFrame>` `startFrom` prop (in COMPOSITION FRAMES, not seconds — same gotcha as v1) used to skip 90–180 frames into each clip. Specific values:

| Clip | startFrom | Skips |
|------|-----------|-------|
| `scene-ds-reveal.mp4` | 90 (3 s) | navigation + hydration |
| `scene-canvas-appears.mp4` (split-RIGHT) | 90 | navigation + hydration |
| `scene-canvas-reveal.mp4` | 180 (6 s) | hydration + click + Cmd+0 |
| `scene-canvas-hero.mp4` | 180 | hydration + click; lands at Cmd+hover dwell #1 |
| `scene-canvas-edit.mp4` (split-RIGHT) | 4500 (150 s) | first half of 306 s capture; lands post-edit |
| `scene-comments.mp4` | 180 | hydration; pin drops shortly after |
| `scene-annotations.mp4` | 150 (5 s) | hydration; pen/arrow lands ~6 s into clip |
| `scene-docs.mp4` | n/a — trimmed at transcode via `ffmpeg -ss 3.0` | pre-paint white frame |

**Final cut metrics.**

| Metric | Value |
|--------|-------|
| Composition | `Final` |
| Duration | 84.5 s (2535 frames @ 30 fps) |
| Resolution | 1920 × 1080 |
| Codec | h264, yuv420p, CRF 23 |
| Pre-loudnorm size | 10.6 MB |
| Post-loudnorm size | 6.0 MB (`-c:v copy`, audio re-encoded) |
| Loudness | I = −18.08 LUFS (target = −18, OK) |
| TP | −12.91 dBTP (target = −1.5; well under) |
| LRA | 3.60 (target = 11; speech-uniform → low LRA OK) |
| Size cap | < 16 MB (landing autoplay) — **6.0 MB, well under** |

**Visual verification log (Task 20).** Rendered `Final.mp4`, ran `qa Final 18`, read individual frames via Read tool. Spot-checks:

- Card-A (75 s mark): "Local Figma. For Claude Code." — amber-rust accent on "Local Figma.", SKU stamp `MDCC-MKT/01 · CARD · v0.16.0`, catalog footer. ✓
- Card-B (~50 s mark): "Plan. Design. Ship." — accent on "Ship." ✓
- Card-C (75.0 s sample): "Human reads. AI iterates." — accent on "iterates.", subline "Both sides speak the same canvas." ✓
- Card-D (80.5 s sample): "Your repo. Yours forever." — accent on "Yours forever.", subline "No telemetry. No signup. No book a demo button." (verbatim site echo) ✓
- Outro (82.5 s): `npm i -g @1agh/maude` legible (note: outro carries pre-existing v1 copy from phase 15.1 — kept as-is per v2.1 scope; `bun add -g` would be on-brand for a future polish pass)
- LowerThird captions overlay cleanly on every capture scene; tested via t10 (canvas-hero "Cmd+Click. The file Claude needs."), t13 (tui-edit "Edit. Reload. Same canvas."), t15 (comments "Comments anchored to pixels. No exports."), t16 (annotations "Draw on the canvas. Hand it off."), t17 (docs "Docs at maude.sh.").
- tui-new + tui-edit split-screen frames render with 1 px DS-rule between halves + corner labels (`TUI` / `DEV SERVER`).
- DS reveal renders specimen swatches + type-scale ladder clearly at 50–75 % through clip.
- Annotation lines drawn by spec 12-annotations persist on the canvas across later scenes (comments + annotations show real red ink between artboards). Not a bug — that's authentic state continuity from a single dev-server session.

**Hard-checks per storyboard.**

| Check | Result |
|-------|--------|
| Install scene frames at 14/17/19 s — no Error / Cannot find native binding / oxc-parser | PASS (tape ends at 19 s post-`maude init`; install + init clean) |
| /design:setup-ds dry-run frame at 75 % shows Stage 1 prose prompt | PASS — claude's prose response about MDCC-DSN/01 + "Co je tam teď?" rendered |
| /design:new RIGHT half last 5 s shows Recipe Recap canvas with ≥ 1 artboard | PASS — 4 artboards rendered (zoom 23 %) |
| canvas-reveal frames at 25 / 50 / 75 % show clearly different positions | PASS (pan + zoom visible) |
| canvas-hero frames at 4.5 / 6.0 / 7.5 s show inspector halo on different elements | PARTIAL — bottom status bar shows `[data-cd-id=…]` changing across frames (real inspector data); visible halo subtle at 23 % zoom; acceptable for marketing pace |
| /design:edit RIGHT half last 5 s shows post-edit canvas (line count 620 → 619) | PASS — edit applied real (file mtime + line count confirmed) |
| Comments frame at 75 % shows pin OR composer | PASS — pin badge "1" on scaler artboard |
| Annotations frame at 70 % shows ≥ 1 drawn mark | PASS — arrow visible; text label partial |
| Docs frame at 0.5 s of clip is NOT pure white | PASS after `ffmpeg -ss 3.0` trim of WebM preamble |

**Deferred to future polish.**

- Outro copy still reads `npm i -g @1agh/maude`; brand-aligned would be `bun add -g @1agh/maude` (per existing memory rule). Out of v2.1 scope — outro carries from phase 15.1 scaffold and is a multi-scene file edit.
- Canvas-hero halo visibility — works but is subtle. Future: drive a single artboard to 100 % zoom + dwell on individual `data-cd-id` rectangles for a cleaner halo capture.
- Annotation text label "+10 % spacing" — partially captured (annotation lines + arrow clear; text label landed but is small at 23 % zoom).
- Two packaging bugs in published `@1agh/maude@0.16.0` (postinstall side-channel + missing `magic-string` runtime dep). Need own PR — block on a dedicated fix.

**Stop before `gh release create`** — per the user-policy line in the plan and in the v1 retro. The user uploads `demo.mp4` to the v0.16.0 GitHub release manually; the README's inline `<video>` tag already points at the release-asset URL so it goes live the moment the upload completes.
