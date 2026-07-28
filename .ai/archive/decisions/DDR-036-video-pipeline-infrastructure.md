# DDR-036: Video pipeline infrastructure — nested workspace + skills + captioning + goldens

- **Date:** 2026-05-20
- **Status:** Accepted
- **Tags:** video, infrastructure, remotion, captions, whisper, regression-testing, workspace
- **Related:** [DDR-031](./DDR-031-video-pipeline-toolchain-remotion-vhs-playwright.md) (toolchain choice this DDR builds on), [DDR-008](./DDR-008-dev-server-bin-canonical-helper-home.md) (single-source helpers discipline reused), [DDR-009](./DDR-009-bun-runtime-authoritative-for-dev-server.md) (Bun for dev-server, but Remotion stays on Node — workspace boundary explicit), [`.ai/plans/phase-15.1-video-pipeline-infrastructure.md`](../plans/phase-15.1-video-pipeline-infrastructure.md), [`.ai/plans/phase-15.5-marketing-demo-video-30s.md`](../plans/phase-15.5-marketing-demo-video-30s.md), [`scripts/video/README.md`](../../scripts/video/README.md)

## Context

DDR-031 (phase 15) committed to Remotion + VHS + Playwright + ffmpeg as the
video toolchain and proved it with a 13s smoke. That phase intentionally did
NOT solve the longer-term authoring infrastructure: scene scaffolding, brand
captioning, regression testing, dev-loop ergonomics. Phase 15.5 (the actual
marketing video) was about to inherit all that complexity inline — replacing
~600 LOC of bash with ~600 LOC of ad-hoc Remotion scaffolding.

Deep research (2026-05-20 conversation, captured in
[`.ai/plans/phase-15.1-video-pipeline-infrastructure.md`](../plans/phase-15.1-video-pipeline-infrastructure.md)
under "Research lineage") surfaced three pieces of community work that retire
most of that inline scaffolding without adding SaaS lock-in:

1. **Official Remotion Agent Skills** (`npx skills add remotion-dev/skills`):
   1 SKILL.md + 37 rule files (compositions, transitions, captions, audio,
   …) in the open Agent Skills format. Loads on demand into
   `~/.claude/skills/`. MIT.
2. **template-tiktok captioning pipeline** (`Page.tsx` + `SubtitlePage.tsx` +
   `sub.mjs`): build-time Whisper.cpp transcription → `Caption[]` JSON next
   to each input video → declarative `<Sequence>` per page in compositions.
   ~200 LOC, cherry-pickable, no SaaS.
3. **Animation libraries** `remotion-bits` (av/, 339 stars) +
   `remotion-animated` (stefanwittwer, declarative
   `<Animated by={[Fade, Move, Scale]}>` API): retire most hand-rolled
   `spring()` + `interpolate()` ladders in cards.

Two dead-end candidates also surfaced and were rejected:

- `DojoCodingLabs/remotion-superpowers`: a Claude Code prompt-plugin requiring
  5 paid SaaS APIs (TwelveLabs, ElevenLabs, Replicate, Suno via KIE, Pexels).
  Wrong fit for solo OSS no-SaaS posture. Ships zero Remotion code — all
  agent prompts.
- `lhr0909/asciinema-mp4`: a React embedder for asciinema-player. Last commit
  2023-01-30 (3+ years stale), 0 issues / 0 PRs, 8 total commits ever. Dead.
  Fallback: `asciinema/agg` (v1.8.1, May 2026, active) outputs GIF → pipe
  through ffmpeg → MP4. Documented as VHS fallback in the README.

## Decision

Adopt a **standalone nested Remotion workspace** under `scripts/video/final/`
with the following infrastructure decisions:

1. **Nested package** (not pnpm workspace member). Own `package.json`,
   `tsconfig.json`, `pnpm-workspace.yaml` for build-script allowlist, own
   `node_modules`. Root `package.json` keeps only the bash entry points
   (`video:smoke`, `video:render`, `video:studio`) that delegate to the
   nested workspace via `cd scripts/video/final && pnpm run …`. Reason:
   making root a pnpm workspace would touch every existing package and is
   a bigger refactor than this phase should own.
2. **Install official Remotion Agent Skills GLOBALLY** at
   `~/.claude/skills/remotion-best-practices/` via
   `npx skills add remotion-dev/skills -g --agent claude-code`. Not
   vendored — duplicates upstream maintenance and bloats this plugin tree.
3. **Cherry-pick template-tiktok captioning** verbatim into
   `scripts/video/final/src/lib/captioned-clip/` (Page.tsx + SubtitlePage.tsx
   + sub.mjs + whisper-config.mjs). Strip the template-specific
   `'webcam' -> 'subs'` filename rewrite and the multi-language autodetect.
   Default model: `medium.en` (466 MB), Czech fallback: `large-v3` via
   `WHISPER_LANG=cs`. Wrap the two components in a `<CaptionedClip>`
   higher-level component that hides prop drilling.
4. **Build-time captioning**, not render-time. `sub.mjs` walks `public/`,
   transcribes each MP4 once, writes `Caption[]` JSON next to the input.
   Compositions read JSON via `staticFile()`. **The JSON is editable** —
   Whisper mistranscribes our jargon ("Claude" as "cloud", "MCP" as "MCBP",
   "maude" as "mode"); humans patch the JSON, never re-prompt Whisper.
5. **Golden-frame regression testing** via `@remotion/renderer`'s
   `renderStill()` + `selectComposition()` + `pixelmatch` + `pngjs`. Per
   composition: render frame 0 / middle / -1 as PNG, diff against
   committed `__goldens__/*.png`, fail if mismatched pixels > 0.5% per
   frame. Updates via `GOLDEN_UPDATE=1 bun test`. No third-party visual
   regression library — the harness is ~100 LOC.
6. **Scaffolder lives under `flow:`, not `design:`** namespace.
   `/flow:video-new-scene <id> <duration> "<caption>"` generates a scene
   folder + appends a `<Composition>` to Root.tsx + appends a row to
   storyboard.md. Idempotent (refuses overwrite without `--force`).
   Reason: video pipeline is project infrastructure (any maude-using
   project may want demo videos), not a design-system-canvas artifact.
   Mirrors `flow:setup-prd` (generic) vs `design:setup-ds` (DS-specific).
7. **Music curated in-repo**, not API-fetched. Pixabay has no music API;
   Freesound's API has no BPM filter on music. Six to ten CC0 / Pixabay-License
   / FMA-CC0 instrumentals committed to `scripts/video/music/`, listed in
   `MANIFEST.md` with per-track license URL. License URL is mandatory; CI
   check verifies HTTP 200. For ~10 videos/year, curating once beats
   automated search each cut.
8. **CSS motion guard** via grep script (`scripts/check-css-motion.sh`),
   not Biome AST rule. Biome 1.9.4 doesn't have a working `noRestrictedSyntax`
   with arbitrary selectors. The grep approach catches the exact footgun
   the official Remotion skill warns about (CSS `transition:` /
   `animation:` in inline styles produce broken frames at render time).
   Exit-non-zero on violation; runnable as `pnpm run lint:motion`.
9. **NO GitHub Actions CI for video rendering.** User explicitly opted out
   ("nechci zadny github actions") on 2026-05-20. Local M-series renders
   are faster than `ubuntu-latest` runners (~4-6 min for 55s 1080p both
   places). Plan task 10 is permanently SKIP. If a future contributor
   needs CI, the deferred design is documented in phase 15.1 Task 10 with
   the workflow YAML template and apt-deps list.

## Alternatives considered

| Alternative | Why rejected |
| ----------- | ------------ |
| `DojoCodingLabs/remotion-superpowers` (all-in-one prompt plugin) | 5 paid SaaS APIs (KIE/Suno, TwelveLabs, ElevenLabs, Replicate, Pexels), conflicts with no-SaaS posture, ships zero Remotion code. |
| Embed asciinema-player via `lhr0909/asciinema-mp4` | Dead since Jan 2023 (0 issues, 0 PRs, 8 commits ever). VHS + `asciinema/agg` fallback stay. |
| pnpm workspace (turn root into a workspace root) | Bigger refactor than this phase owns; would touch site/, plugins/design/dev-server/, packages/*. Nested non-workspace package isolates Remotion deps without disturbing the root tree. |
| Vendor Remotion skills into `plugins/design/skills/` | Duplicates upstream-maintained content; misses progressive disclosure (37 rule files load on demand); bloats the design plugin. Global install is one-shot, MIT, refreshes via `npx skills add` re-run. |
| Render-time captioning (Whisper invoked from a composition) | Non-deterministic; bundles Whisper into every render; can't hand-edit transcription errors. Build-time + editable JSON wins. |
| Diff video files for regression (full MP4 comparison) | Encoding noise dominates real diffs. Frame stills with pixelmatch are stable. |
| Scaffolder under `design:` namespace | Video pipeline isn't tied to design-system canvases; living under `flow:` matches `flow:setup-prd` precedent. |
| Pixabay/Freesound API automation for music | Pixabay has no music endpoint; Freesound has no BPM filter on music. Manual curation of 6-10 tracks is cheaper. |
| Biome `noRestrictedSyntax` rule for CSS motion guard | Doesn't exist in Biome 1.9.4 with arbitrary AST selectors. Grep script catches the same footgun in 30 LOC. |
| GH Actions video render workflow | User opted out. Local renders fast enough; CI minutes wasted on a manually triggered job. |

## Consequences

**Positive:**

- Scene authoring loop is `open scene .tsx -> save -> Studio hot-reloads`.
  Single-file edit, zero rebuilds.
- Captions are deterministic AND hand-editable. Re-renders skip the 6-second
  Whisper pass on already-transcribed inputs.
- Golden-frame harness catches DS-token drift the same way unit tests catch
  regressions — no manual "did the demo video still look right?" pass.
- The official Remotion skill's 37 rule files are available to every Claude
  Code agent in this repo on demand. Future video work doesn't re-learn
  the same gotchas.
- The scaffolder makes "add scene N+1" a one-line invocation, not a
  three-file manual edit.
- Music license URLs are committed and CI-checkable.

**Negative / risks:**

- Nested workspace has its own `pnpm-lock.yaml`. Drift between root and
  nested locks is possible. Mitigated by: never sharing deps (root has zero
  Remotion deps after this phase).
- Golden PNGs add ~420 KB to the repo per 6 scenes (~70 KB per PNG, 3 frames
  per scene). Acceptable; grows linearly with scene count.
- First `pnpm run caption` downloads Whisper.cpp source + the `medium.en`
  model (~466 MB into gitignored cache). Slow first run; cached subsequently.
- The grep-based CSS motion guard catches inline-style violations but not
  Tailwind class names like `transition-opacity`. Acceptable — this
  workspace doesn't use Tailwind, and the official Remotion skill also
  warns against Tailwind transitions.
- `pnpm` 11's interactive `approve-builds` for esbuild required a workaround
  (`pnpm-workspace.yaml` with `onlyBuiltDependencies: [esbuild]` +
  `verifyDepsBeforeRun: never`). Brittle if pnpm changes config schema.
- No CI render = a future contributor without an M-series Mac may struggle
  to render the final cut. Documented in README as a known limitation
  with the deferred GH Actions design recoverable from phase 15.1 Task 10.

## Reversibility

**High.** Each piece is independently rip-and-replace:

- Nested workspace: collapse back into root by moving `scripts/video/final/src/`
  to `scripts/video/` and re-adding Remotion to root devDeps.
- Captioning: swap the Whisper.cpp pipeline for any tool that emits the same
  `Caption[]` JSON shape. The components downstream only consume the JSON.
- Goldens: delete `__goldens__/` + `__tests__/frame-regression.test.ts` and
  the harness is gone. No production code depends on it.
- Scaffolder: it's a single markdown file under `plugins/flow/commands/`.
- Music: just files in `scripts/video/music/`.
- CSS motion guard: one bash script.
- Remotion skills: `npx skills remove remotion-best-practices` cleans up.

The CI workflow opt-out is reversible the moment the user wants CI — the
workflow YAML is documented in the phase 15.1 plan, not in this DDR (so
this DDR doesn't grow stale if the workflow lands later).

## Notes

The 13-task phase 15.1 plan executed cleanly with one deviation from the
written plan: the Biome `noRestrictedSyntax` approach was abandoned mid-task
when it turned out Biome 1.9.4 doesn't support arbitrary AST selectors. The
grep-based replacement is documented above and is the long-term solution
(no need to migrate to a future Biome version).

Phase 15.5 inherits this infrastructure via a banner at the top of its plan.
The original phase-15.5 task list was kept intact — those tasks are about
content (scenes, captures, assembly), not infrastructure, and re-litigating
them inline would create a merge conflict with the user's recent rewrite of
phase-15.5 to a "real green-field onboarding" capture flow.

## Lessons from first real assembly (2026-05-20)

After the initial phase 15.1 ship, we did a real end-to-end capture-to-
assembly pass: VHS terminal capture + Playwright browser capture + Remotion
composition with TransitionSeries + audio bed + loudnorm → final.mp4.
Three gotchas surfaced only at the assembled-video stage (not visible in
unit-rendered per-scene goldens). All three are now baked into infrastructure
so future video producers do not re-discover them.

### Gotcha 1: VHS `Hide`/`Show` does not clear the shell buffer

`Hide` and `Show` in VHS toggle **frame capture**, not the terminal's
contents. A typed `cd /tmp/scratch-dir` inside a `Hide…Show` block does not
appear in any captured frame — but the shell has already echoed it into the
terminal buffer, so when `Show` starts capturing, the previously-typed
command is still on screen. Result: the "hidden" setup command leaks into
the very first captured frame.

**Fix (load-bearing):** the `Hide` block must end with `Type "clear" Enter`
before `Show` toggles capture back on. Documented in
`scripts/video/tapes/_TEMPLATE.tape` and enforced by
`scripts/video/final/scripts/check-tape-discipline.sh` (run via
`pnpm run lint:tape`).

### Gotcha 2: Playwright viewport mismatch leaves empty bg baked into source

Capturing at 1920×1080 against an app whose UI has a max-width container
(~1280px) bakes ~33% empty grey into the source video on the right + bottom.
`objectFit: cover` in Remotion can crop around it, but at the cost of
zooming past important UI elements. Better: match the capture viewport to
the app's natural width.

**Fix (load-bearing):** Playwright config in `scripts/video/playwright/`
defaults to 1280×720 viewport. Remotion's `<BrowserChrome>` wrapper
upscales via `objectFit:cover` inside the mock browser frame.
`pnpm run lint:tape` also checks .tape files for 1920×1080 (the related
terminal-side variant of this same gotcha).

### Gotcha 3: Per-scene goldens cannot regress against external captures

The golden-frame harness (`__tests__/frame-regression.test.ts`) compares
rendered stills against committed baselines. This works for synthetic
scenes (cards, animations) where the only inputs are tokens + code. It
**fails for capture-driven scenes** because the source `.mp4` regenerates
every time a tape or spec changes — the rendered frame legitimately differs
between baseline and current, but pixelmatch reads this as a regression.

**Fix:** two-tier verification.
- **Tier A — goldens** (`pnpm run goldens:check`): synthetic compositions
  only (intro, content, outro, smoke). Stable. Run on every commit.
- **Tier B — QA frame grid** (`pnpm run qa`): assembled cuts with external
  captures. Renders, extracts N evenly-spaced JPGs at half resolution,
  builds a 4×3 contact sheet. Agent reads each JPG via Read tool (Claude
  is multimodal); human eyeballs the contact sheet. Documented in
  `scripts/video/README.md` under "Visual QA workflow."

The QA workflow is **mandatory before delivering a final cut** to a human
consumer. The first delivery skipped it; the user immediately spotted the
two Gotcha 1 / Gotcha 2 issues that would have been caught by a 30-second
contact-sheet eyeball. Memory point: render → QA → deliver, never render →
deliver.

### Promoted capture wrappers

The visual chrome around captures (terminal inset frame; browser mock
chrome with traffic lights + URL bar) was inline JSX in scene files during
debug. Promoted to `scripts/video/final/src/lib/capture-frames/`:
`<TerminalFrame src="...">` and `<BrowserChrome src="..." urlBar="...">`.
Adding a new capture scene to the storyboard is now one component
invocation, not a copy-paste of the wrapper layout.
