# Feature: Enhanced video editing — iMovie-parity manual timeline + AI placeholder clips

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Grow the shipped video-comp Timeline (DDR-148/DDR-150) into a **genuinely iMovie-simple manual editor** — the priority is manual editing that feels great: a storyline-lane timeline with selection, zoom, magnetic drag-reorder, split/trim/speed/crop/grade/audio/transitions — with the AI layer (prompt-carrying placeholder clips resolved via the DDR-164 BYOK spine) as a secondary phase. Works on existing Remotion comps AND greenfield (empty comp → build a cut by hand).

**Architecture decision (divergent debate, 3 seats, converged):** **TSX-first.** The comp TSX stays the single source of truth (DDR-148/150 invariant holds); every gesture is a named AST op in `canvas-edit.ts`, spoken identically by the TimelinePanel UI and by agents (`/design:edit` → same ops). EDL (`<slug>.edl.json`) stays a one-shot generation artifact — explicitly NOT promoted to a live document (round-trip lossiness would reintroduce the DDR-150 P1 "my edit vanished" bug at document scale). No external editor adopted (designcombo left Remotion + closed timeline SDK; OpenCut mid-rewrite; paid Remotion Timeline conflicts with the headless-primitives-plus-Maude-CSS reuse rule; the expensive part is AST math we already own).

## User Story

As a Maude user I want to quickly cut a video by hand on a timeline that behaves like iMovie (select, drag, split, trim, speed, crop, grade, audio, transitions — with zoom, snapping, and magnetic reordering) so that rough-cutting myself is fast and intuitive, and I can then tell the AI to polish the same document.

## Problem

The Timeline today is playback + coarse ops (retime duration, remove, reorder via ▲▼, hide, replace-media, drop-to-append). Verified UX gaps against the iMovie interaction model (from reading `TimelinePanel.jsx` + `timeline-snap.js`):

1. **No zoom** — all positioning is percent-of-total-width (`pct()`); precise trims on long cuts are impossible. No px-per-frame scale, no scroll-with-zoom.
2. **No selection model** — no "selected clip" state; every op is a hover button or context menu. iMovie's whole grammar is *select → act* (outline, Delete, ⌘B, adjust controls scoped to selection).
3. **Row-per-sequence layout** — reads like After Effects layers, not a film strip. iMovie = one **primary storyline lane** (series beats side by side) + overlay lane above + audio lane below.
4. **Reorder is ▲▼ buttons** — no magnetic drag-to-reorder (series clips refuse body-drag entirely; correct for `from`, but drag should mean *reorder* there).
5. **Drop has no position** — `onDropMedia(file)` takes no index; no insertion caret.
6. **Decorative waveform, no filmstrips** — audio shows a static fake path; video clips are labeled blocks.
7. **No skimming** — no hover-preview without committing the playhead.
8. Missing verbs entirely: split, in-point trim, speed/reverse, crop, grading, per-clip mute/volume, transition insert/edit UI, add/detach audio, overlay-lane authoring, placeholder clips, greenfield start.
9. The 900-frame export cap (30 s) is already violated by real usage (flatmap RCA: 90 s reel) — an editor invites longer cuts.

## Solution

Ship in this order: **guardrails → timeline UX foundation → editing verbs on that foundation → structural ops → greenfield → AI placeholder → agent parity → reverse (stretch)**. Remotion facts grounding the design: `playbackRate` + `trimBefore`/`trimAfter` per media tag; **reverse NOT supported** (derived asset); crop = CSS wrapper; grading = CSS `filter` chain (deterministic in Player and both export paths — no sidecar); 6 bundled transition presentations (7th = gated runtime-bundle change, out of scope).

## UX Blueprint (the iMovie model, adapted)

This section is normative for every UI task below.

**Layout — three-band timeline (replaces row-per-sequence for series comps):**

```
┌─ transport ─ readout ─ zoom slider ──────────────────────── meta ─ × ┐
│ overlay lane   [title]      [logo]                                   │  ← standalone Sequences above the storyline (z-order)
│ STORYLINE      [clip1|clip2|clip3|clip4]  ← series beats side-by-side│  ← the film strip; transitions = ⧓ chips in the seams
│ audio lane     [music ────────────]  [vo ──]                         │  ← <Audio> rows
└─ ruler + playhead + skim ghost ──────────────────────────────────────┘
```

- Series (`TransitionSeries`/`Series`) beats render **in one horizontal lane, butted together** — sequential in time, so side-by-side is the truthful projection. Non-series comps (or mixed standalone `<Sequence>`s) keep stacked rows above/below the storyline by z/time. Layer expansion (▸) moves into the selected-clip detail, not inline rows.
- **Selection model:** click selects (accent outline, matches canvas selection tokens); Esc deselects; Delete removes (with ripple); ⌘B splits the selected clip at the playhead (or the clip under the playhead when nothing is selected — iMovie behavior); selection drives the clip inspector popover (Speed / Audio / Crop / Grade / Transition tabs). Single-select in v1; multi-select stays deferred (DDR-150).
- **Zoom:** px-per-frame scale. Fit-to-width default; ⌘+/⌘−, pinch-trackpad, and a header slider; zoom keeps the playhead (or selection) centered; horizontal scroll when content > viewport. All block math moves from `%` to `frame × scale` px.
- **Magnetic storyline:** dragging a series clip horizontally = live reorder preview (siblings shuffle, gap follows the drag — maps to the existing reorder op on release). Standalone clips keep free body-drag (`from` edit) with snapping. Delete/trim in the storyline auto-ripples (series: by construction; standalone: via the Phase-0 ripple engine — "magnetic" means no dead gaps unless the user makes one deliberately with a gap tool later).
- **Drop semantics:** drag-over shows an **insertion caret** between storyline clips (index-aware drop → insert at position; past the last clip → append; over the audio lane → audio track; over the overlay lane → overlay). Drop of multiple files inserts in order.
- **Trim UX:** both edges get handles (right = duration, left = in-point via `trimBefore`); live delta tooltip (`+12f / +0.40s`); snapping to ticks/edges/playhead (existing `timeline-snap.js`), Alt overrides; clamped to source bounds when `assets/<sha8>.footage.json` knows the duration.
- **Clip visuals:** video clips render a **filmstrip** (3–7 thumbnails by zoom level) and audio blocks render a **real waveform** (WebAudio `decodeAudioData` → peaks) — both computed client-side, async, cached under `<designRoot>/_canvas-state/` (per-machine runtime state per DDR-115), gracefully falling back to today's blocks.
- **Skimming (stretch):** hovering the ruler/storyline shows a ghost playhead + throttled preview seek (~10 Hz) without committing `frame`; leaves restore the committed playhead. Off by default on WKWebView if jank shows.
- **Feedback:** every op lands as a `shellToast` with undo hint; 409 (contentHash) renders as "Timeline changed — reloaded, try again", auto-refetching comp-clips.
- **Comment markers:** a thin marker strip above the ruler shows timeline comments (💬 pins). Add via context menu ("Comment at playhead…" / "Comment on clip…") or `C`. Anchored to `clipStableId + frame offset` (survives reorder/ripple better than absolute frames; falls back to absolute frame for track-level notes). Click opens the comment thread; comments are **agent-readable context** (see the comments task) so `/design:edit` and the ACP panel know exactly which part of the cut the feedback targets.
- **Default container:** greenfield comps and first-drop scaffolds author a `<TransitionSeries>` storyline — series membership is what makes clips butt magnetically and accept seam transitions. Dropping into an existing storyline inserts a series beat; dropping into the overlay/audio band inserts standalone `<Sequence>`/`<Audio>`.
- **Keyboard map:** Space play/pause · ←/→ frame-step · ⇧←/→ 10 frames · ⌘B split · Delete/Backspace remove · `C` comment at playhead · ⌘Z/⇧⌘Z undo/redo · ⌘+/− zoom · 0 fit · Esc deselect. (JKL shuttle, I/O marks = deliberately omitted, iMovie-style.)
- **Scope fences (iMovie's own omission list):** no keyframing UI, no multicam, max 2 video lanes (storyline + 1 overlay), no speed ramps, no LUT import, no audio EQ/buses.

## Metadata

- **Type**: Enhancement
- **Complexity**: High
- **App/Package**: `apps/studio` (server `canvas-edit.ts`, client `panels/TimelinePanel.jsx`, `canvas-lib.tsx`) + `plugins/design` (skill/command docs) + `cli` (new `media-derive` verb, stretch)
- **Affected Systems**: Timeline panel, AST edit engine, canvas-lib video exports, export spine, BYOK generation spine, undo/redo, desktop-e2e
- **Dependencies**: no new npm deps for core (oxc-parser, Remotion 4.0.486 already bundled); ffmpeg soft-dep only for the reverse stretch

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `apps/studio/client/panels/TimelinePanel.jsx` (whole file, 873 lines) — Why: the UI being restructured; note `%`-based `pct()` math (line 336), `LABEL_GUTTER = 96` (194), move/retime drag state machines (159–331), series body-drag refusal (295–301), context menu (808–869), drop handler without position (338–347)
- `apps/studio/client/panels/timeline-snap.js` — Why: pure snap helpers (targets/threshold) reused by every new gesture
- `apps/studio/client/panels/timeline-parse.js` — Why: client tokenizer must learn to DISPLAY every new prop (draw with regex, address with stableId — DDR-150)
- `apps/studio/canvas-edit.ts` (lines 1466–1660 retime; 2091–2160 ClipInfo/CompClips; 2353–2440 resolveClip/assertCompSemantics; 2444–2900 remove/reorder/hidden/insert; 4378–4394 assertContainedAssetSrc) — Why: the op layer every new verb extends; stableId + contentHash discipline
- `apps/studio/client/app.jsx` (lines 8862–8912 timeline state; 9325–9440 shortcuts; 9478–9565 source/comp-clips fetch + merge; 13254–13592 TimelinePanel render + op handlers; 8235–8352 Photo tab precedent) — Why: wiring pattern for new ops + inspector-tab precedent
- `apps/studio/video-comp.tsx` (30–58 meta/snapshot; 350–439 postMessage protocol; 449–472 Player mount) — Why: transport + registry contract (skim = throttled `timeline-seek`)
- `apps/studio/canvas-lib.tsx` (147–150 VideoComp exports; 551–560 subtreeHasVideoComp; 2548–2644 PhotoLayer precedent) — Why: where `<AIPlaceholder>` lands
- `apps/studio/exporters/video.ts` (45 MAX_FRAMES; 92–96 frame-step no-audio; 137–157 loud degradation; 179–189 resolveFrames) — Why: the export cap task
- `apps/studio/footage/schema.ts` (111–157 FootageAnalysis durationSec — trim clamping source; 179–248 Edl; 294–309 generatedClipAnalysis + AI_GENERATED_TAG) — Why: source-bounds for trim; placeholder vocabulary; EDL stays generation-only
- `apps/studio/photo/schema.ts` (71–116 adjustments vocabulary) — Why: grade parameter vocabulary reused for clip grading — compiled to a JSX `style.filter` string, NOT a sidecar (renderMediaOnWeb renders the component tree, not sidecars)
- `apps/studio/client/photo-knobs.jsx` + `client/inspector-controls.jsx` (drag-to-scrub NumberField) — Why: slider/knob UI patterns for the clip inspector popover
- `apps/studio/generation/` (`jobs.ts`, `registry.ts`) + `apps/studio/client/generate-dialog.jsx` — Why: placeholder "Generate" hand-off
- `plugins/design/skills/video-comp/SKILL.md` (18–50 iron rules; 122–156 literal-blocks + assets contract; 294–314 export constraints) — Why: authoring contract every emitted snippet must honor
- `plugins/design/skills/footage-director/SKILL.md` (52–90 EDL→TSX codegen) — Why: snippet shapes for series clips/transitions
- `.ai/archive/decisions/DDR-150-timeline-clip-addressing-and-inline-edit-persistence.md` — Why: deferrals being (partially) un-deferred; quoted-string insert discipline
- `.ai/logs/rca/issue-video-timeline-flatmap-clips.md` — Why: literal-blocks contract is load-bearing; real 90 s reel (export cap evidence)
- `.ai/archive/decisions/DDR-157-*.md`, `DDR-161-*.md`, `DDR-164-*.md`, `DDR-177-*.md` — Why: export degradation, photo precedent, generation spine, bundle completeness

### Files to Create

- `apps/studio/ripple.ts` (or a clearly-bounded section in `canvas-edit.ts`) — pure ripple engine: `(clips, atIndex, deltaFrames) → from-rewrites`, incl. literal-int and simple `const` arithmetic-expression rewrite; golden-file tests
- `apps/studio/client/panels/timeline-scale.js` — pure zoom/scale helpers (frame↔px, fit, center-preserving zoom) + tests
- `apps/studio/client/panels/timeline-media-cache.js` — filmstrip/waveform extraction + `_canvas-state/` cache
- `apps/studio/test/ripple.test.ts`, `apps/studio/test/clip-ops.test.ts` — golden-file fixtures per op (incl. corruption fixtures: orphaned transition, wrong-half split, `*/` + backtick + `${}` prompt injection)
- `apps/studio/bin/_media-derive.mjs` + `bin/media-derive.sh` (stretch, reverse) — ffmpeg `-vf reverse -af areverse` → `assets/<sha8>.mp4`
- greenfield empty-comp scaffold path via `assembleCompSource`
- `apps/desktop/e2e/` scenario for timeline editing (data-testids in same change)

### Design canvases

No mockup canvas exists for this feature (no naming/tag match). Most-recent video-comp canvases to use as **live test fixtures**: `.design/ui/Alligators Cinematic Cut.tsx`, `Alligators Recruiting Trailer.tsx`, `How to make video.tsx`, `Photo Editor Trailer.tsx`, `Maude Showcase.tsx` — real TransitionSeries cuts with audio; exercise every op against at least one of them. **Optional but recommended:** before Phase 1, run `/design:new` for a "Timeline v2" mock of the three-band layout + clip inspector popover to lock the visual design cheaply before touching the panel.

### Patterns to Follow

- Op pattern: `applyX(source, …) → {source', span}` pure function + route handler with stableId + contentHash 409 (see `applyRetimeSequenceByClip` canvas-edit.ts:1541)
- Gesture pattern: pointer-capture + window listeners attached synchronously in pointerdown (see `beginResize` TimelinePanel.jsx:173–191 — the "attach a frame late = sticks" lesson)
- Snippet emission: literal blocks only, `JSON.stringify` for any user text (DDR-150 P1), `assertContainedAssetSrc` for any src
- UI: plain props + `on*` callbacks panel pattern; styles in `client/styles/3-shell-maude.css`; `data-testid="timeline-<thing>"`
- New routes: main-origin only (NOT in `CANVAS_SAFE_API`, NOT in `server.ts` routes map) — clip ops must never be reachable from the untrusted canvas iframe (DDR-054)

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `TimelinePanel` | `apps/studio/client/panels/TimelinePanel.jsx` | restructure in place (three-band layout) — keep transport, snap, drag state-machine patterns, context menu |
| `NumberField` (drag-to-scrub) | `apps/studio/client/inspector-controls.jsx` | speed/crop/grade numeric knobs |
| PhotoEdit slider stack | `apps/studio/client/photo-knobs.jsx` | lift layout + interaction for the clip Grade tab |
| `ContextMenuView` | shared `context-menu.tsx` | clip menu grows: Split at playhead, Speed ▸, Mute, Detach audio, Crop…, Grade…, Add transition ▸ |
| `timeline-snap.js` helpers | existing | reused by left-trim, drag-reorder ghost, drop caret |
| Generate dialog / jobs | `generate-dialog.jsx` + `/_api/generate-jobs` | placeholder "Generate" hand-off (DDR-164) |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Storyline lane renderer | series beats side-by-side is a new projection | new layout code inside TimelinePanel |
| Clip inspector popover (Speed/Audio/Crop/Grade/Transition tabs) | per-clip parametric editing surface scoped to selection | photo-knobs patterns |
| Transition seam chip + picker | visible ⧓ affordance in storyline seams; choose among 6 presentations + duration | none |
| Filmstrip/waveform renderer | real media visuals in blocks | `timeline-media-cache.js` |
| `<AIPlaceholder>` (canvas-lib) | prompt-carrying slate clip primitive | `AbsoluteFill`; props `prompt`, `kind: 'veo'\|'motion'\|'image'`, `durationInFrames`; DS-tokened look |

### Tokens

Timeline UI uses Maude shell tokens (`1-tokens-maude.css`); selection outline reuses the canvas selection accent token so "selected" means one thing everywhere. AIPlaceholder slate uses semantic tokens (`--bg-0/--fg-0/--accent`).

---

## Tasks

Execute in order. Golden-file tests land BEFORE UI wiring for every op (breaker precondition). UI tasks conform to the **UX Blueprint** above.

### Phase 0 — Guardrails (preconditions, do first)

#### Task 1: UPDATE export cap — surface + raise

- **Do**: Make `MAX_FRAMES` (exporters/video.ts:45) an option with a raised default (e.g. 3600 = 2 min @ 30 fps) + explicit `options.maxFrames`; keep 900 as the *warning* threshold for the heavy/frame-step path. Loud pre-export notice in the export dialog + a Timeline duration badge when comp length exceeds the safe tier. Never silently truncate.
- **Pattern**: DDR-157 loud-degradation stamps (`video.ts:137–157`)
- **Gotcha**: 1080p frame-step died ~frame 190 from memory pressure — keep the 720p recommendation; test a 2700-frame export (the RCA reel length) at 720p before settling the default
- **Validate**: `cd apps/studio && bun test` + manual 90 s comp export (audio path + forced frame-step)

#### Task 2: CREATE ripple subsystem

- **Do**: Pure module: given `CompClips` + clip index + frame delta → downstream `from`/`durationInFrames`/`TOTAL` rewrites. Handles literal ints; simple `const`-arithmetic expressions (house style `from={A + B - 20}`); refuses loudly (structured error → UI message) on expressions it can't rewrite. Series clips need no `from` ripple, but DO need `TOTAL` rewrite.
- **Pattern**: `enumerateClips` tokenization; golden-file fixtures
- **Gotcha**: speed, split, in-point trim, AND magnetic delete all reuse this — build once (breaker precondition)
- **Validate**: `bun test` ripple fixtures green (literal, expression, refusal)

### Phase 1 — Timeline UX foundation (the iMovie feel — before any new verb)

#### Task 3: ADD selection model

- **Do**: `selectedClipId` (stableId) state in app.jsx; click selects (accent outline via canvas selection token), Esc deselects, Delete = remove-with-ripple, click empty track deselects. Selection survives comp-clips refetch by stableId (not index). Keyboard shortcuts route by selection; ⌘B targets selection, else the clip under the playhead.
- **Pattern**: existing timeline state block (app.jsx:8862–8912) + shortcut wiring (9325–9440)
- **Gotcha**: all existing op handlers are index-based today — migrate handler signatures to stableId now, so later ops don't inherit index addressing (DDR-150: never address by row index)
- **Validate**: select → Delete → undo chain; selection stable across an external file edit (HMR refetch)

#### Task 4: ADD timeline zoom + scroll

- **Do**: `timeline-scale.js` pure helpers (frame↔px at `pxPerFrame`, fit-to-width, zoom-around-anchor). Replace `%` positioning with `frame × scale` px on a scaled inner track; horizontal scroll when content > viewport; ruler ticks adapt density (1 s → 10 f → 1 f as you zoom in). Header zoom slider + ⌘+/⌘− + pinch (wheel with ctrlKey) + `0` = fit. Playhead/selection stays anchored during zoom.
- **Pattern**: `pct()`/`LABEL_GUTTER` math being replaced; `snapThresholdFrames` already px-derived — feed it the scaled width
- **Gotcha**: `seekAt`, both drag machines, snap thresholds, block/handle/caret positioning ALL assume `%`-of-total — migrate together, behind one scale helper, or drags will land on wrong frames at zoom ≠ fit
- **Validate**: unit tests for scale math; drag/trim/seek correct at 3 zoom levels; 2700-frame comp scrolls smoothly

#### Task 5: REFACTOR layout to three-band storyline

- **Do**: Series beats render side-by-side in ONE storyline lane (order = play order); standalone Sequences render in an overlay band above (z-order = vertical order); `<Audio>` rows in an audio band below. Transitions render as ⧓ seam chips between storyline clips (read-only this phase). Layer expansion moves to the selected clip's detail (popover section), not inline rows. Non-series comps (no TransitionSeries) keep the stacked-rows fallback.
- **Pattern**: `rowKind`/glyph identity code reused per block; existing series detection (`seq.series`)
- **Gotcha**: this changes most `data-testid` anchors — update desktop-e2e in the same change; keep `timeline-seq-<i>` testids keyed by stableId slug now
- **Validate**: Alligators Cinematic Cut renders as one storyline + audio band; every pre-existing op (retime, remove, reorder, hide, replace) still works from the new layout

#### Task 6: ADD magnetic drag-to-reorder + positional drop

- **Do**: Dragging a storyline clip horizontally = live reorder preview (siblings shuffle around a gap ghost; commit = existing reorder op with the new index). Standalone clips keep free body-drag (`from` edit). Drag-over with files shows an insertion caret between storyline clips → `onDropMedia(file, {index|lane})`; audio files caret into the audio band; multiple files insert in order. Remove ▲▼ buttons from storyline labels (kept in context menu for a11y/keyboard).
- **Pattern**: move-drag state machine (TimelinePanel.jsx:265–314) extended with reorder mode for `seq.series`; `hasFiles` drop plumbing (338–347)
- **Gotcha**: reorder commit is index-pair based today — go through stableId; suppress click-to-seek after a reorder drag (existing `movedRef` pattern). First drop into an empty/greenfield comp scaffolds the `<TransitionSeries>` storyline (Blueprint default-container rule) so later transitions/magnetic behavior work without a convert step
- **Validate**: drag clip 3 before clip 1 → plays in new order; drop 2 files at caret position → inserted in order at that index; e2e scenario

#### Task 7: ADD filmstrip thumbnails + real waveforms

- **Do**: `timeline-media-cache.js`: for video srcs, extract N frames (client `<video>` seek → canvas, N by zoom bucket) → dataURL strips; for audio srcs, WebAudio `decodeAudioData` → peak array → SVG path. Async with today's blocks as instant fallback; cache keyed `<sha8>:<bucket>` in memory + persisted under `<designRoot>/_canvas-state/timeline-media/` (runtime state, DDR-115 ignored-list — verify the three-list rule).
- **Pattern**: PhotoBgRemoveHarness-style client-side media work; `_canvas-state/` camera-file precedent
- **Gotcha**: decode work must never block the scrub (idle-callback / queue, cancel on close); WKWebView memory — cap concurrent decodes, thumbnails ≤ ~160 px wide; assets are same-origin (`assets/…`) so canvas readback is clean
- **Validate**: storyline shows filmstrips within ~1 s on the fixture canvas; audio band shows true peaks; no dropped frames while scrubbing during extraction

#### Task 8: ADD trim-delta feedback + source-bounds clamping

- **Do**: Live tooltip on both trim drags (`+12f / +0.40s`, red at clamp); clamp in-point/duration to source duration when `assets/<sha8>.footage.json` exists (fetch via existing footage route, cached); toast every committed op with the op name; 409 → "Timeline changed — reloaded, try again" + auto-refetch.
- **Pattern**: existing inline `· 240f` readouts (TimelinePanel.jsx:604–606); `shellToast`
- **Validate**: trim past source end clamps visibly; concurrent-edit 409 recovers without manual reload

### Phase 2 — Editing verbs (on the selection + popover foundation)

#### Task 9: ADD clip inspector popover shell

- **Do**: Selection opens (via toolbar button / double-click / context menu "Adjust…") a popover anchored to the clip: tabs **Speed · Audio · Crop · Grade · Transition** (tabs appear per clip kind). Houses the knobs from Tasks 10–14. Draggable, Esc closes, one instance.
- **Pattern**: photo-knobs.jsx panel structure; Inspector tab precedent (app.jsx:8235–8352)
- **Validate**: popover targets follow selection; keyboard reachable (a11y pass)

#### Task 10: ADD speed op (`playbackRate`)

- **Do**: `applySetPlaybackRate(clipId, rate)` — set/remove `playbackRate` on the media child, recompute `durationInFrames` (= source span / rate), ripple. Route `/_api/clip-speed` (main-origin). UI: Speed tab presets (0.25/0.5/1/1.5/2/4) + custom NumberField; storyline chip `2×`.
- **Pattern**: `applyRetimeSequenceByClip` (canvas-edit.ts:1541)
- **Gotcha**: `timeline-parse.js` must display the chip (two-tokenizer rule); no speed ramps (fence)
- **Validate**: golden-file test + preview at 2× + export spot-check

#### Task 11: ADD in-point trim (left-edge)

- **Do**: `applyTrimIn(clipId, deltaFrames)` — rewrite `trimBefore`/`startFrom` + duration + ripple. UI: left-edge handle mirroring the right-edge drag, with Task-8 clamping/tooltip.
- **Pattern**: right-edge trim gesture + snap
- **Gotcha**: `startFrom` (legacy) vs `trimBefore` (4.0.319+) — read both, emit `trimBefore`
- **Validate**: golden-file + drag e2e

#### Task 12: ADD per-clip mute/volume + detach audio

- **Do**: `applyClipAudio(clipId, {muted?, volume?})`. Detach = `muted` video + `<Audio src={same} trimBefore={same}>` in the audio band (same file, two elements, zero preprocessing). UI: mute icon on selected clip / Audio tab slider; "Detach audio" in context menu.
- **Pattern**: `applyInsertClip` audio kind; existing audio rows
- **Gotcha**: Remotion `volume` accepts per-frame functions — v1 emits constants only (fades v2)
- **Validate**: golden-file + preview + mp4 export carries audio

#### Task 13: ADD crop/reposition op

- **Do**: `applyClipFraming(clipId, {scale, x, y} | null)` — idempotent wrapper (`overflow:hidden` + inner transform; fit/fill presets via objectFit). UI: Crop tab NumberFields + presets; (viewer drag-rect = v2 stretch).
- **Pattern**: style-attr editing precedent
- **Gotcha**: wrapper must stay a literal block both tokenizers parse
- **Validate**: golden-file wrap/unwrap round-trip + visual + export

#### Task 14: ADD color grade op

- **Do**: `applyClipGrade(clipId, params | null)` — parametric object (PhotoEdit vocabulary: brightness/contrast/saturation/hue/sepia/grayscale) compiled to ONE CSS `filter` string on the media element; named preset "looks" = parameter bundles. UI: Grade tab with photo-knobs sliders + preset row.
- **Pattern**: `photo/schema.ts` params; `photo-knobs.jsx` UI
- **Gotcha**: **WKWebView filter ceiling** — preview applies on paused frame only (re-apply on pause), stated in the panel. Round-trip: parse existing `filter:` back to params; unrecognized functions → read-only badge.
- **Validate**: golden-file param↔filter round-trip + paused-frame preview + export color spot-check

#### Task 15: ADD transition edit (existing seams)

- **Do**: `applyEditTransition(transitionId, {presentation?, durationInFrames?})` among the 6 bundled presentations; `TOTAL` ripple on duration change. UI: click seam chip → picker popover (presentation grid + duration field).
- **Pattern**: transitions already enumerate (`kind === 'transition'`)
- **Gotcha**: `assertCompSemantics` stays green; NO 7th presentation
- **Validate**: golden-file + preview each presentation

### Phase 3 — Structural ops

#### Task 16: ADD split at playhead

- **Do**: `applySplitClip(clipId, atFrame)` — two literal blocks: first keeps in-point/duration to the cut; second gets `trimBefore = original + atFrame×rate` + remainder; ripple. **Scope fence:** standalone `<Sequence>` + series clips NOT adjacent to a transition; at a transition boundary → structured refusal rendered as "move the clip out of the transition first" (series-overlap split stays deferred per DDR-150). Both halves inherit attrs (name, grade, crop, audio props).
- **Pattern**: `applyInsertClip` + `applyRetimeSequenceByClip` composition
- **Gotcha**: corruption fixtures required (orphaned transition, wrong-half seam, off-by-one at cut frame) BEFORE UI wiring
- **Validate**: fixture suite green; then ⌘B / context menu / toolbar scissors

#### Task 17: ADD transition insert/remove

- **Do**: `applyInsertTransition(betweenClipIds, presentation, frames)` / `applyRemoveTransition(transitionId)` with `TOTAL` ripple. UI: hover seam affordance (+) between storyline clips → picker; remove via seam chip context.
- **Pattern**: `applyRemoveClip` transition-neighbor merge math (~2482)
- **Gotcha**: only between series siblings; standalone pairs → refusal message (convert-to-series = v2)
- **Validate**: golden-file + assertCompSemantics + preview

#### Task 18: ADD audio band authoring

- **Do**: Positional drop of audio (Task 6 caret) → `applyInsertClip` audio kind with `startFrame`/`volume`; audio blocks movable (`from` drag) + trimmable + per-Task-12 volume; trim-to-comp-end snap target ("stretch the song across the whole cut" is one drag). Music longer than the comp trims; shorter music: no loop in v1 (Remotion `loop` prop = v2).
- **Pattern**: existing `<Audio>` rows + LooseMediaInfo
- **Gotcha**: `assertContainedAssetSrc` on every dropped src; audio uses plain `<Sequence from>` (real `from`, drag allowed)
- **Validate**: drop mp3 → move/trim → export carries the bed

#### Task 19: ADD overlay band authoring (titles/graphics)

- **Do**: Surface add/remove/retime/move for overlay-lane standalone Sequences (text/image kinds via existing `applyInsertClip` snippet generators); "+ Title" / "+ Image" toolbar entries; z-order via existing reorder.
- **Gotcha**: cap ONE overlay lane (iMovie fence — 2 video layers total)
- **Validate**: title over storyline in preview + export

### Phase 4 — Greenfield + AI placeholder (secondary to manual editing)

#### Task 20: ADD greenfield empty-comp flow

- **Do**: "New video" entry (canvas browser + `/design:new --video` docs note): scaffold via `assembleCompSource` — minimal literal comp with an empty `<TransitionSeries>` storyline; the whole editor then works drop-first. Dimensions/fps are user-settable in the flow (presets 1920×1080 / 1080×1920 / 1080×1080 + custom fields, e.g. 1440×1024; default 30 fps) — they land in `VideoCompMeta`.
- **Pattern**: `assembleCompSource` (canvas-edit.ts:4406) — already the "udělej z toho video" path
- **Gotcha**: scaffold honors literal-blocks + Timeline-parseability from frame zero
- **Validate**: empty comp → drop 3 clips → split/trim/transition → export

#### Task 21: CREATE `<AIPlaceholder>` canvas-lib primitive

- **Do**: DS-tokened slate (`AbsoluteFill`, prompt text + kind badge + duration), props `{prompt, kind: 'veo'|'motion'|'image', durationInFrames}`. Enumerator learns `kind: 'placeholder'`. Deterministic render, export-safe.
- **Pattern**: `DrawProof`/`PhotoLayer` canvas-lib precedents
- **Gotcha**: prompt is USER TEXT → `JSON.stringify` quoted-string path only; injection fixtures (`*/`, backticks, `${}`)
- **Validate**: injection fixtures + slate renders in Player + exports as slate

#### Task 22: ADD placeholder insert + resolve flow

- **Do**: "+ AI clip" (toolbar/context menu) → `applyInsertClip` placeholder kind with prompt dialog; row shows ✨ + prompt preview; "Generate" → existing `/_api/generate-jobs` (veo→Veo, motion→Veo w/ motion-graphics prompt, image→Nano Banana); on completion → existing replace-media swaps slate → media in place (stableId survives). Reuse generate-dialog/jobs + notification center (DDR-153) — no new generation UI.
- **Pattern**: DDR-164 spine; media-generation-director stays proposer-only
- **Gotcha**: async Veo (1–10 min) — placeholder stays fully editable meanwhile; job→clip binding by stableId + 409 on hash miss
- **Validate**: insert → generate (mock adapter) → in-place swap, identity preserved

#### Task 23: ADD timeline comments (frame-anchored markers + agent context)

- **Do**: Extend the existing canvas comment system (`_comments/` runtime state, DDR-115) with a timeline anchor: `{clipStableId, frameOffset}` (preferred — survives reorder/ripple) or `{frame}` (track-level). UI per Blueprint: marker strip above the ruler, add via context menu / `C`, thread popover on click, resolve/delete. **Agent context is the point:** expose comments for the active comp via the existing comment-read surface + include them in what `/design:edit` and the ACP session read for the canvas (comment → "user wants X at clip `intro`, frame 42–90"), so "predelej cast, ktera mi nevyhovuje" needs no manual frame description.
- **Pattern**: existing comments store + UI (`_comments/`); whiteboard `read-annotations` precedent for agent-readable feedback surfaces
- **Gotcha**: comment text is untrusted user/peer text (DDR-054) — render as text, never into TSX; when a comment's `clipStableId` no longer resolves (clip deleted), degrade to absolute-frame anchor with a "detached" badge, don't drop the comment; `_comments/` stays runtime-ignored (three-list rule untouched)
- **Validate**: comment at playhead → visible pin → survives a reorder → `/design:edit` sees it in context; deleted-clip comment degrades gracefully

### Phase 5 — Agent parity, e2e, docs

#### Task 24: UPDATE agent door + plugin docs

- **Do**: Every op reachable headlessly (routes are the door; `/design:edit` markdown gains the verb vocabulary: "split shot 3 at 2.1s", "speed up clip 2 2×", "mute clip 1", "add fade between 2 and 3", "insert a Veo placeholder: <prompt>", "resolve the timeline comments"). Update `video-comp/SKILL.md` (playbackRate/trimBefore/filter/wrapper/AIPlaceholder vocabulary) + `footage-director/SKILL.md` (codegen may emit placeholder beats). Timeline comments + placeholder prompts are first-class agent inputs (Task 23).
- **Gotcha**: flow/design markdown stays project-agnostic; two-tokenizer doc rule
- **Validate**: `/design:edit "split the second clip at 1s"` end-to-end on a fixture

#### Task 25: ADD e2e + rebuild committed bundles

- **Do**: `data-testid`s for every affordance (`timeline-storyline`, `timeline-clip-<slug>`, `timeline-seam-<i>`, `timeline-split`, `timeline-speed-menu`, `timeline-zoom`, `timeline-placeholder-add`, …); desktop-e2e scenario (select → split → trim → speed → reorder → undo chain); `/design:smoke`; rebuild `dist/client.bundle.js` + `dist/styles.css` release-minified.
- **Gotcha**: `git status apps/studio/dist/` before AND after every `bun test`; `MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`
- **Validate**: `pnpm test:e2e:desktop` green; committed bundle diff is minified

### Phase 6 (stretch, separate release) — Reverse + skimming + viewer crop

#### Task 26: ADD reverse via derived asset

- **Do**: `maude design media-derive --reverse <asset>` → ffmpeg `-vf reverse -af areverse` → content-addressed `assets/<sha8>.mp4`; Speed tab gains "Reverse" (derive with jobs-queue progress, then replace-media). Degrades loudly without ffmpeg (transcribe precedent).
- **Gotcha (ship-blockers)**: two-artifact undo contract documented ("undo restores the clip; the derived asset stays, content-addressed"); deps stage via `helper-deps.mjs`; **`check-bundle-completeness.mjs <app> --smoke` green before release** (DDR-177 — shipped broken twice); memory-bound → cap input duration, refuse loudly
- **Validate**: derive + swap + undo/redo + packaged-app smoke

#### Task 27: ADD skimming + viewer crop handles (stretch)

- **Do**: Hover ghost playhead + throttled preview seek (~10 Hz) with committed-frame restore; drag-rect crop in the viewer writing `applyClipFraming`.
- **Gotcha**: WKWebView seek-storm jank — throttle + rAF coalesce; disable skim automatically if frame latency > threshold
- **Validate**: skim feels instant on fixture; no playhead corruption

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (watch `apps/studio/dist/` before/after)
3. **Build**: `pnpm --filter @maude/site build` + `MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` (committed bundle)
4. **Parity/tarball**: `bash scripts/check-version-parity.sh` + `bash scripts/check-tarball-shape.sh`
5. **Smoke**: `/design:smoke` + `runtime-health`
6. **Desktop e2e**: `pnpm test:e2e:desktop` (timeline scenario)
7. **Manual UX pass (the bar is "feels like iMovie")**: on Alligators Cinematic Cut — select/deselect/Delete, zoom in to 1-frame ticks and trim precisely, drag-reorder 2 clips, split at playhead, 2× a clip, grade a clip on paused frame, detach audio, drop music at a caret position, undo ×10 — in browser AND the packaged `.app` (native-verification ceiling memory); 90 s export both paths
8. **Security pass** (`/flow:validate-security`): new routes main-origin only; prompt injection fixtures; `assertContainedAssetSrc` on every emitted src

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `timeline-manual-cut` (desktop-e2e) | select → split → trim → speed → drag-reorder → undo chain | 🆕 new |
| `timeline-zoom-precision` | zoom to frame ticks → 1-frame trim → verify frames | 🆕 new |
| `timeline-placeholder-resolve` | insert placeholder → generate (mock) → in-place swap | 🆕 new |
| `timeline-greenfield-cut` | new video artboard → drop 2 clips → trim → split+delete half → transition → mute clip 2 → music across cut → placeholder at end → comment → agent reads context | 🆕 new (the user's 13-step scenario, end to end) |
| existing `/design:smoke` | canvas render regressions | ✅ existing |

(This repo is web-desktop only per `workflows.config.json` — no mobile runners.)

## Acceptance Criteria

- [ ] Phases 0–5 completed (Phase 6 may ship separately)
- [ ] **UX bar:** three-band storyline layout; single-click selection with visible outline; Delete/⌘B/Esc work; zoom from fit to 1-frame ticks with correct drags at every level; magnetic drag-to-reorder; positional drop caret; filmstrips + real waveforms; trim tooltips + source clamping; every op toasts + 409 recovers gracefully
- [ ] Export cap: no silent truncation anywhere; 90 s reel exports or warns explicitly
- [ ] Ripple subsystem fixture suite green (literal, expression, refusal) BEFORE any dependent op merged
- [ ] Split corruption fixtures green; transition-boundary refusal renders as guided message
- [ ] Grade: paused-frame preview only on WKWebView; param↔filter round-trip lossless
- [ ] Placeholder: injection fixtures green; stableId survives generate-swap
- [ ] Every op has an agent door (route + `/design:edit` verb) — manual and AI edit through the same API
- [ ] Two-tokenizer parity: `timeline-parse.js` displays every prop `enumerateClips` understands
- [ ] Undo/redo covers every new op; selection + handlers addressed by stableId, never row index
- [ ] Committed bundles rebuilt `--release`; desktop-e2e green; `/design:smoke` green
- [ ] DDR recorded (TSX-first op vocabulary + storyline UX model + AIPlaceholder + export-cap change; extends DDR-148/150/157/164)
- [ ] Remotion licensing note in docs (free ≤3-person orgs; larger companies need their own license — end-user clause)
- [ ] What's New entry via `whats-new-entry` skill at `/flow:done`

## Debate record (reduce pass)

Seats: builder 0.74 / shipper 0.82 / breaker 0.78 (block→grudging-A). Converged **A: TSX-first**. Breaker preconditions adopted as Phase 0 + scope fences (export cap first; ripple as standalone subsystem; series-overlap split stays deferred; grading preview paused-frame; reverse gated on DDR-177 smoke + undo contract; prompt injection fixtures). B (EDL-first) rejected: round-trip lossiness vs hand/agent TSX, re-litigates DDR-148/150 ratified invariant, platform-migration-sized cost. C (adopt editor) rejected: state-store-first editors re-import B's problem; dual-Remotion-instance freeze risk; license/fork rot; the hard part (AST ops) isn't what they sell.

**Rev 3 (user scenario walkthrough):** validated against the 13-step greenfield scenario (new canvas → custom-size video artboard → drop/trim/split/delete/reorder → transition → mute → music bed → placeholder → comment → ACP finish). Added: Task 23 frame-anchored timeline comments as agent context; default-`<TransitionSeries>` container rule (magnetic butting + seam transitions work from the first drop); Backspace alias + `C` shortcut; custom dimensions in greenfield; trim-to-comp-end snap for music; `timeline-greenfield-cut` e2e scenario.

**Rev 2 (user steer):** manual-editing UX promoted to the primary deliverable — added the normative UX Blueprint (three-band storyline, selection model, zoom, magnetic reorder, positional drop, filmstrips/waveforms, feedback + keyboard map, iMovie omission fences) as Phase 1 before any new verb; AI placeholder demoted to Phase 4; skimming + viewer-crop added as Phase 6 stretch. Grounded in a line-level read of `TimelinePanel.jsx` + `timeline-snap.js` (percent-math, no selection, row-per-sequence, ▲▼ reorder, positionless drop confirmed).
