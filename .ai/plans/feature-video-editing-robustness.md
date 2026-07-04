# Feature: Robust video & animation editing — direct manipulation on the video-comp timeline + canvas

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan **extends DDR-148** (the shipped video-comp foundation) — read it and the shipped code first; do not re-derive the Player/seek/export layers, they exist.

## Description

DDR-148 shipped the video-comp foundation: a Remotion composition mounted in `<Player>`, the `window.__maude_seek__` bridge, a bottom **Timeline panel** (transport + scrub + volume + read-only sequence rows + drag-the-right-edge-to-retime-duration), the `canvas-edit.ts` source-patch engine, and capture-first MP4/GIF export. What's missing is the **direct-manipulation editing surface** on top of it — the difference between "watch/scrub a comp the AI made" and "trim, move, cut, hide, replace, and assemble clips by hand."

This feature adds **basic manual video & animation editing**, keeping the DDR-148 model intact: **the timeline is a view of the source TSX, and every edit is a reparse-gated source-patch on Remotion `<Sequence>`/`<Video>`/`<Audio>`/`<Img>` tags** — no bespoke clip IR (DDR-148 §3 settled this). The target use case is explicit in the request: **generate an infographic or video with the AI, then fine-tune the details by hand.**

Four phases (ordering ratified by the user):

- **P1 — Media intake.** (a) Drag/drop/paste **video, image, audio directly onto the Timeline** → insert a real `<Sequence>` + `<Video/Audio/Img>` at the drop frame (source insert). (b) Drop **any media anywhere on the canvas as a reference** — mirroring today's paste-image behavior (annotation-layer chip), so the "throw a pile of clips at the canvas, then tell the agent *udělej z toho video*" flow works.
- **P2 — Timeline clip ops.** Move a clip along the track (`from`), cut/split at the playhead, remove a clip, show/hide a clip, replace a clip's media.
- **P3 — Live canvas element-editing persistence fix.** Inline text/CSS/attr edits via the inspector today **silently fail and revert on reload** for common cases (mixed/expression text, class-styled elements) — make them robust, surface failures, and survive HMR.
- **P4 — Keyboard shortcuts + polish.** Space = play/pause (context-scoped, resolving the pan-chord conflict), ← / → step by frame, Shift+arrows step by second, `.`/`,` step by keyframe, Home/End, Delete removes the selected clip; snap, tooltips, a11y.

## User Story

As a **designer/founder using Maude** I want **to drop clips onto the timeline, then move, trim, cut, hide, replace, and delete them directly — plus reliably tweak text and CSS on the canvas by hand** so that **after the AI generates a video or infographic I can do the last-mile manual polish in the same canvas-first loop, without re-prompting blind for every small timing or copy change.**

## Problem

- The Timeline panel is **read-only except for one gesture** (drag the right edge to change `durationInFrames`). You cannot move a clip, cut it, delete it, hide it, or replace its media.
- **Nothing can be dropped onto the timeline** — `use-canvas-media-drop.tsx` only listens on `document` and routes to the annotations layer / a toast; the timeline is not a drop target.
- **Video/audio dropped on the canvas only toasts a copy-paste snippet** (`uploadAndAnnounceMedia`) — it doesn't land as a visible reference the way a pasted image does, so the "assemble a pile of clips" use case has no on-canvas artifact for the agent to act on.
- **Live inline editing is unreliable** — `editText` refuses mixed/expression children (`<h1>{title}</h1>`, `<p>Hi <b>there</b></p>`) and the shell only `console.warn`s the refusal, so the optimistic DOM change reverts on the next HMR reload ("*přepis textu nezůstává perzistentní*"). CSS edits through the inspector have a related class of silent-revert bugs (the trailing-comma regression is fixed in-tree; class-styled elements and non-inline `style` still refuse).
- **No editing keyboard shortcuts** — Space is deliberately the canvas pan chord (`spaceKeyToPlayOrPause={false}` on the Player), so there's no play/pause or frame-step key.

## Solution

Every new capability is a **new op in the existing source-patch engine** (`apps/studio/canvas-edit.ts`) exposed through a **main-origin-only** endpoint (`apps/studio/http.ts` + `apps/studio/api.ts`, absent from both canvas allowlists — DDR-054/DDR-088), driven from the **Timeline panel** (`TimelinePanel.jsx`) or the **inspector** through the shell's postMessage bridge (`app.jsx`). The `timeline-parse.js` parser is widened to surface the addressing metadata the new ops need (per-clip tag ranges, media `src`, hidden state). The Remotion transport in `video-comp.tsx` is unchanged except for a couple of new inbound messages (step-frame).

| Capability | New engine op (`canvas-edit.ts`) | Addressing | Reuses |
| --- | --- | --- | --- |
| Move clip along track (`from`) | *(none — existing `retimeSequence`)* | seq index | `applyRetimeSequence` already patches `from` |
| Trim clip (`durationInFrames`) | *(shipped)* | seq index | right-edge drag exists |
| Insert clip (drop→timeline) | `insertSequenceIntoComp` | comp name / artboard id + `from` | comp-body locate + reparse gate |
| Cut / split at playhead | `splitSequence` | seq index + frame | duplicate span, set `startFrom` on tail |
| Remove clip | `removeSequence` | seq index | MagicString remove + adjacent-transition fixup + reparse |
| Show / hide clip | `toggleSequenceHidden` | seq index | JSX-comment wrap/unwrap marker + reparse |
| Replace media | *(existing `editAttribute` on `src`)* | media element cd-id | upload asset → patch `src` |
| Drop media → canvas reference | *(client — annotations layer)* | world xy | mirror `onImage`/`onLink` chip |

Load-bearing invariants (inherited, do not break): **atomic write + per-file mutex + reparse-before-write** (never write source that doesn't parse); **const-preferring rewrites** so a derived `TOTAL = A + B - XF` moves in lock-step (already in `retimeAttr`); **source-write routes stay main-origin-only**; **the determinism contract** (a dropped `<Video>` is seeked per-frame during capture, never free-running); **committed client bundle rebuilt `--release` after any `client/` change**.

## Metadata

- **Type**: Enhancement (direct-manipulation layer) + Bug Fix (P3 persistence)
- **Complexity**: High
- **App/Package**: `apps/studio` (dev-server engine + client + canvas-lib) · minor `plugins/design` (video-comp skill teaches the parseable shapes; motion-critic unchanged)
- **Affected Systems**: source-patch engine (`canvas-edit.ts` — security/correctness-load-bearing), main-origin source-write route surface (`http.ts`/`api.ts` — CSRF-gated), Timeline panel + shell postMessage bridge, annotations layer (media reference), asset write surface (reused, not widened), keyboard-shortcut layer
- **Dependencies**: none new — Remotion / `@remotion/player` / mediabunny / gifenc / asset route all shipped in DDR-148. `oxc-parser` + `magic-string` (already the engine's toolchain).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `apps/studio/canvas-edit.ts` — Why: the whole source-patch engine. `retimeSequence`/`applyRetimeSequence` + `retimeAttr` (lines ~834–949 — `from` is ALREADY patchable, const-preferring); `moveElement`/`applyMove` (structural move + re-indent + reparse gate — the template every new structural op mirrors, lines ~659–831); `editAttribute` (the `src`-replace path); `editText`/`applyTextEdit` (the P3 refusal at lines ~391–410); atomic write + `withLock` mutex (lines ~150–210); `escapeJsxText`/`escapeAttr` (injection guards). **New ops go here.**
- `apps/studio/client/panels/timeline-parse.js` — Why: the regex parser that produces the timeline rows. `SEQ_TAG_RE`-equivalent tokenization, `videoCompUsages`/`componentBody` (comp scoping), `collectConsts`/`resolveNum` (const resolution), the `<Audio>` row pass. **Must be widened** to emit per-clip source ranges + media `src` + hidden state for the new ops to address clips.
- `apps/studio/client/panels/TimelinePanel.jsx` — Why: the timeline UI. `retimeDrag` right-edge gesture (lines ~165–193), `onRetime` prop wiring, seek/scrub, `data-testid` conventions, the row/track/playhead layout the new gestures + drop target attach to.
- `apps/studio/video-comp.tsx` — Why: the Player mount + `installMaudeSeekBridge` + the full `timeline-*` postMessage protocol (seek/play/pause/mute/volume/comps). `clickToPlay={false}` + `spaceKeyToPlayOrPause={false}` (lines ~328–334 — the P4 Space conflict origin). New step-frame messages ride this.
- `apps/studio/use-canvas-media-drop.tsx` — Why: the drop/paste hook. `classifyMediaPayload` dispatch matrix, `onImage`/`onMedia`/`onLink` callbacks (media → `uploadAndAnnounceMedia` toast today, lines ~284–302), `uploadAsset`, `mediaSnippet`. **P1 extends this** (timeline drop target + on-canvas media reference).
- `apps/studio/api.ts` — Why: the API wrappers `editCss`/`editText`/`editAttr`/`retimeSequenceOp` (lines ~264–297, ~1637–1849) that adapt the engine to the HTTP layer + do input validation. **New ops get sibling wrappers here.**
- `apps/studio/http.ts` — Why: the route map. `/_api/edit-css|edit-text|edit-attr|retime-sequence` handlers (lines ~1225–1373), the CSRF guard for main-origin source-write routes (lines ~142–…), and `CANVAS_SAFE_API` (the allowlist new source-write routes must stay OUT of). **New endpoints go here, main-origin-only.**
- `apps/studio/server.ts` — Why: `startCanvasServer` `routes` map — the second allowlist (DDR-088). New source-write routes are absent from it; only asset-write is canvas-reachable.
- `apps/studio/client/app.jsx` — Why: the shell. Timeline state + wiring (`timelinePlaying`/`timelineCompId`/`activeComps`/`timelineFrame`, ~6100–6400; the `<TimelinePanel … onRetime={…→ /_api/retime-sequence}>` block ~8380–8440); the inline-edit persistence handlers (`edit-text`/`apply-edit`, ~7131–7186 — the P3 silent-`console.warn`); the `select`/`layers-tree`/`reorder-request` postMessage lane (the pattern new clip-edit requests follow); `applyOptimisticStyle`; the media-drop callback wiring; the global keydown surface (P4).
- `apps/studio/canvas-lib.tsx` — Why: `AnnotationsLayer` owns the media-drop callbacks (commit/undo sink + `screenToWorld`); `onImage`/`onLink` chip creation is the exact path P1's on-canvas media reference mirrors. Also the `VideoComp` re-export surface.
- `.ai/decisions/DDR-148-video-comp-remotion-authoring-capture-export.md` — Why: the foundation this extends; the determinism contract + the "no bespoke IR, Remotion vocabulary IS the composition" decision that scopes every clip op to source-patching Remotion tags.
- `.ai/decisions/DDR-103-phase-12-in-canvas-direct-edit.md` + `DDR-104-css-panel-ux-model.md` — Why: the inline-edit trust boundary + UX model P3 hardens; the `editText` mixed/expression refusal is a DDR-103 design choice — P3 changes the *failure surfacing*, not the escape rule.
- `.ai/decisions/DDR-088-canvas-media-vocabulary-and-asset-write-surface.md` + `DDR-054-linked-mode-trust-model-and-task-4-hardening.md` — Why: why source-write routes are main-origin-only; the dual-allowlist rule; the asset route P1's timeline-drop reuses unchanged.
- `.ai/decisions/DDR-138-*` (node-move reorder) — Why: `moveElement`/`reorder` is the structural-edit + re-select-through-id-churn precedent P2's remove/split re-settle logic mirrors.
- `apps/studio/test/timeline-parse.test.ts` + `test/video-comp.test.ts` + `test/canvas-origin-gate.test.ts` — Why: the guards to extend (parser cases, seek determinism, the `GET → 405`/route-absence assertion for every new main-origin route).

### Files to Create

- *(new ops in existing)* `apps/studio/canvas-edit.ts` — `insertSequenceIntoComp`, `splitSequence`, `removeSequence`, `toggleSequenceHidden` (+ pure `apply*` variants).
- `apps/studio/test/canvas-edit-clip-ops.test.ts` — pure-variant unit tests for every new op (insert/split/remove/hide + reparse-gate refusals + const-preserving + TransitionSeries fixup).
- `apps/studio/test/media-drop-timeline.test.ts` — timeline-drop dispatch + on-canvas media-reference classification.
- *(extend)* `apps/studio/client/panels/timeline-parse.js` — per-clip source ranges + `src` + `hidden` in the returned shape.
- *(new, optional)* `apps/studio/client/panels/timeline-drop.js` — pure helper mapping a drop clientX → frame + target row (unit-testable without a DOM), mirroring `timeline-parse.js`'s pure style.
- `.ai/decisions/DDR-1xx-timeline-direct-manipulation-and-inline-edit-persistence.md` — the decision record (Task 0): clip ops as reparse-gated source patches, split/hide reversibility model, the Space-conflict resolution, the P3 failure-surfacing change.

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio Intro Video.tsx` | storyboard | — | The repo's own video storyboard authored AS a canvas — the natural reference for what a comp being edited looks like; ground the clip-row UX in it. |
| `.design/ui/Canvas Viewport.tsx` | active | — | The shell-chrome canvas — mock the new Timeline affordances (drop target, clip context actions, hide-eye) here before building. |
| `.design/ui/Maude Video Intro.tsx` | *(modified in tree)* | — | Currently-dirty video canvas — a live comp to dogfood P1/P2 against. |

### Documentation

- [Remotion `<Sequence>`](https://www.remotion.dev/docs/sequence) (`from` / `durationInFrames`) + [`<Video>`](https://www.remotion.dev/docs/video) (`startFrom` / `endAt` — the trim props split writes) + [`<TransitionSeries>`](https://www.remotion.dev/docs/transitions) — Why: the exact prop vocabulary every clip op patches; `startFrom` is what makes a split's tail continue the source instead of restarting.
- [Building a timeline](https://www.remotion.dev/docs/building-a-timeline) — Why: Remotion's own `Item {from, durationInFrames, id}` data model — the shape our parser already mirrors; confirms move/trim/split map 1:1 to `from`/`durationInFrames`.
- [oxc-parser](https://oxc.rs/) + [magic-string](https://github.com/Rich-Harris/magic-string) — Why: the AST-locate + surgical-rewrite toolchain every new op uses (already in `canvas-edit.ts`).

### Patterns to Follow

- **New structural op = `applyX` (pure, reparse-gated) + `X` (disk, `withLock` + atomic tmp-rename)** — copy the `applyMove`/`moveElement` pair verbatim as the skeleton (`canvas-edit.ts` ~659–831). The reparse gate at the end is non-negotiable — "never write source that doesn't parse."
- **Sequence addressing by document order** — clips are addressed by their tokenization index (as `retimeSequence` does via `SEQ_TAG_RE`), NOT `data-cd-id` (`TransitionSeries.Sequence` is a member-expression with no stable cd-id). Media *elements* inside a clip (`<Video>`/`<Img>`) DO get cd-ids → `editAttribute` addresses them for replace.
- **Main-origin-only source-write endpoint** — mirror `/_api/retime-sequence` (`http.ts` ~1356): CSRF-gated, absent from `CANVAS_SAFE_API` (http.ts) AND `startCanvasServer` routes (server.ts), with a `GET → 405` + route-absence assertion in `test/canvas-origin-gate.test.ts`.
- **Untrusted-iframe → shell request lane** — a Timeline gesture in the shell calls `/_api/*` directly (shell is main-origin). A gesture that originates *inside* a canvas iframe (e.g. a clip context menu rendered in-canvas) must REQUEST via postMessage and be honored **only from the ACTIVE canvas window** — copy the `reorder-request` gate (`app.jsx` ~7251–7271).
- **Re-settle selection through id churn** — a structural edit (insert/remove/split) reflows positional cd-ids; mirror the `pendingReorderRef` + `movedId`/`semanticId` re-select dance (`app.jsx` ~7196–7222, `canvas-edit.ts` `MoveResult`).
- **On-canvas media reference = annotation chip** — mirror `onImage`/`onLink` in `AnnotationsLayer` (client-side, versioned in `.annotations.svg`), NOT a source `<Video>` insert. The AnnotationsLayer commit/undo sink + `screenToWorld` are the integration points.
- **Client change → rebuild committed bundle** — `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` + `dist/styles.css` (CLAUDE.md rule; whatever's committed is what ships).
- **Verbs via `maude design`** (DDR-062) — no new plugin bin verb expected; all editing is UI/endpoint-driven inside the running server.

---

## Design Decisions

### Architecture: clip ops are reparse-gated source patches on Remotion tags (DDR-148 continuation)

No JSON clip sidecar, no bespoke IR. The comp TSX **is** the timeline model; the parser reads it, the ops patch it, HMR re-renders it. This keeps a single source of truth (the file the agent also edits), keeps every edit inspectable/diffable/rollback-able through the existing `_history/<slug>` + undo lanes, and avoids a second model that could drift from the source. Cost: some edits (splitting a `<TransitionSeries.Sequence>`, reordering render/z-order) are hard-to-impossible as clean text patches — **explicitly scoped out of v1** (below), with the reparse gate guaranteeing we refuse rather than corrupt.

### Split / cut model

Split a standalone `<Sequence from={F} durationInFrames={D}>` at playhead frame `P` (`F < P < F+D`) into two: head `<Sequence from={F} durationInFrames={P-F}>`, tail `<Sequence from={P} durationInFrames={F+D-P}>`. When the clip contains a `<Video>`/`<Audio>`, the tail's media gets `startFrom={(existingStartFrom ?? 0) + (P-F)}` so playback continues seamlessly instead of restarting. **v1 splits standalone `<Sequence>` only**; splitting inside `<TransitionSeries>` is deferred (the overlap math + transition placement isn't a clean text patch) — the op refuses with an actionable message.

### Show / hide model

Hide = wrap the clip element in a reversible JSX block comment carrying a marker (`{/* dc-hidden */ }` sentinel) so the parser can render it as a dimmed "hidden" ghost row with an eye-toggle, and unhide restores it byte-for-byte. **v1 scopes hide to explicit-`from` `<Sequence>`** (commenting a cursor-implicit clip would shift siblings' derived timing); refuse otherwise. Alternative considered + rejected: a `display:none` style (a `<Sequence>` is not a DOM node) and a boolean `hidden` prop (requires an authoring convention we can't assume in AI-generated comps).

### On-canvas media reference vs. timeline insert (the two P1 drops are different)

- **Drop on the canvas body** → an **annotation-layer reference chip** (mirrors paste-image), client-side, versioned in `.annotations.svg`. This is the "*nahazet klipy do canvasu a pak říct agentovi ať z toho udělá video*" artifact — the agent sees N referenced assets + their labels and assembles a comp. It does NOT mutate comp source.
- **Drop on the Timeline panel** → a real `insertSequenceIntoComp` source patch (a new `<Sequence>`+`<Video/Audio/Img>` at the drop frame). This is "add this clip to the video."

Resolving which: the drop's target element (timeline panel vs canvas). The Timeline panel becomes its own drop target; `use-canvas-media-drop.tsx`'s `document`-level listener keeps the canvas path.

### Space-key conflict resolution (P4)

Space stays the **canvas pan chord** by default. Space = **play/pause** only when ALL of: the Timeline panel is open, a comp is active, focus is NOT in a text input / `contenteditable`, and the pointer is over the timeline OR the timeline last received focus. Frame-step keys (← →, Shift+← →, `,`/`.`) are timeline-scoped the same way. This is a shell-level keydown handler gated on timeline focus/hover — it never steals Space from the canvas pan gesture or from typing. Documented in the DDR so the precedence is explicit.

### Ops surface (new endpoints — all main-origin-only, CSRF-gated, absent from both canvas allowlists)

| Endpoint | Body | Engine op |
| --- | --- | --- |
| `POST /_api/insert-sequence` | `{ canvas, artboardId, from, durationInFrames, media:{tag,src} }` | `insertSequenceIntoComp` |
| `POST /_api/split-sequence` | `{ canvas, index, frame }` | `splitSequence` |
| `POST /_api/remove-sequence` | `{ canvas, index }` | `removeSequence` |
| `POST /_api/toggle-sequence-hidden` | `{ canvas, index, hidden }` | `toggleSequenceHidden` |
| move (`from`) / trim | `/_api/retime-sequence` **(shipped)** `{ index, from?, durationInFrames? }` | `retimeSequence` |
| replace media | `/_api/edit-attr` **(shipped)** `{ id, attr:'src', value }` | `editAttribute` |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| Timeline drop target + drop-frame ghost | no timeline intake today | `TimelinePanel.jsx` track region + `timeline-drop.js` |
| Clip context actions (split/remove/hide/replace) | clips are click-to-seek only | `TimelinePanel.jsx` `tl-seq-block` |
| Clip body horizontal-move gesture (`from`) | only the right-edge (duration) drags today | `retimeDrag` sibling in `TimelinePanel.jsx` |
| On-canvas media-reference chip (video/audio) | video/audio only toasts a snippet today | `AnnotationsLayer` `onImage`/`onLink` chip |

---

## The invariant (load-bearing constraint — do not break)

**Every structural edit reparses before it writes.** `applyMove`/`applyRetimeSequence` already end with a `parseSync` gate that throws (aborting the write) if the edit would produce invalid source. Every new op (`insert`/`split`/`remove`/`hide`) MUST do the same. This is what lets the op set stay small and the guardrails few — a clever-but-wrong text patch fails loud (refuse + actionable message) instead of corrupting the user's comp. Combined with the atomic tmp-rename write + per-file `withLock` mutex, a concurrent reader/HMR never sees a partial or broken file.

---

## Tasks

Execute in phase order. Each task is atomic and testable.

### Task 0: RECORD the decision DDR

- **Do**: Record DDR `timeline-direct-manipulation-and-inline-edit-persistence`: clip ops as reparse-gated source patches on Remotion tags (DDR-148 continuation); the split (`startFrom` tail) + hide (JSX-comment marker) reversibility models + their v1 scope-outs (`<TransitionSeries>` split, render-order reorder); the two-different-drops model (canvas ref vs timeline insert); the Space-conflict precedence rule; the P3 change (surface inline-edit failures instead of silent `console.warn` — the escape rule from DDR-103 is unchanged, only the UX of failure).
- **Pattern**: DDR-148 structure (decision + scope-out table + revisit-when); check the decisions dir AND the uncommitted README index diff before numbering (memory `project_ddr_numbering_races_on_shared_main`).
- **Validate**: file exists; linked from this plan.

---

### P1 — Media intake

### Task 1: EXTEND `timeline-parse.js` to emit per-clip addressing metadata

- **Do**: Add to each returned sequence: `srcRange` (the `[start,end]` of the clip's `<Sequence>` open→close in source, or the token range), `mediaTag` (`Video`/`Audio`/`Img`/null) + `mediaSrc`, `hidden` (true when the clip is wrapped in the `{/* dc-hidden */}` marker — detect commented `<Sequence>` blocks), and whether the clip is inside a `<TransitionSeries>` (so the UI can disable split/hide with a reason). Keep the parser pure + graceful-degrade (unparseable → today's scrub-only shape).
- **Pattern**: the existing `videoCompUsages`/`componentBody` scoping + the `<Audio>` pass; add a hidden-clip pass over `{/* dc-hidden … */}` blocks.
- **Gotcha**: the parser is regex, not a full AST — the engine ops (which DO use oxc-parser) are authoritative for the actual edit; the parser only needs enough to *address* and *label* clips. Don't try to make the parser exact; make the op refuse when the parser guessed wrong (reparse gate).
- **Validate**: `cd apps/studio && bun test test/timeline-parse.test.ts` (new cases: media src, hidden clip, TransitionSeries membership).

### Task 2: CREATE `insertSequenceIntoComp` + `POST /_api/insert-sequence`

- **Do**: Engine op (`canvas-edit.ts`): locate the target comp's body by `artboardId`→comp name (reuse `videoCompUsages`/`collectElementsFull` logic), find the sequence-list insertion anchor, and `appendLeft` a re-indented `<Sequence from={F} durationInFrames={D}>\n  <Video src="assets/…" />\n</Sequence>` (or `<Audio>`/`<Img>`); reparse-gate; return the new clip's index. `api.ts` wrapper `insertSequenceOp` (validate `from`/`dur` ints, media tag allowlist, `src` under `assets/`). `http.ts` main-origin route.
- **Pattern**: `applyMove` skeleton (locate → MagicString → reparse gate → disk via `withLock`); `retimeSequenceOp` wrapper shape; `/_api/retime-sequence` route + CSRF gate.
- **Gotcha**: default `durationInFrames` from the media's intrinsic duration when known (probe on upload) else a sane default (e.g. `fps * 3`); a comp with no existing `<Sequence>` (bare composition) needs the insert to also establish the sequence-list container — refuse with an actionable message if the body shape isn't insertable, don't guess.
- **Validate**: `bun test test/canvas-edit-clip-ops.test.ts` (insert into empty + non-empty comp; reparse-gate on malformed target); route absent from both allowlists.

### Task 3: ADD the Timeline drop target (drop media → insert clip)

- **Do**: Make the `TimelinePanel` track a drop target (dragover highlight + drop-frame ghost playhead). On drop of a video/audio/image file: `uploadAsset` → compute the drop frame from clientX (`timeline-drop.js` pure helper) → `POST /_api/insert-sequence`. On drop of an existing `assets/…` URL (re-drop), skip the upload. Wire through the shell (the panel lives in the shell = main-origin, can call `/_api/*` directly).
- **Pattern**: `use-canvas-media-drop.tsx` `classifyMediaPayload` for the payload matrix (reuse the pure classifier); `TimelinePanel` `seekAt` clientX→frame math for the drop-frame mapping; `data-testid` `timeline-dropzone`, `timeline-drop-ghost`.
- **Gotcha**: the OS drop event also bubbles to the `document`-level canvas media-drop listener — the timeline handler must `stopPropagation`/`preventDefault` so a timeline drop doesn't ALSO create a canvas reference chip. >20 MB size-warning toast (assets are versioned — DDR-148).
- **Validate**: live (agent-browser): drag an mp4 onto the timeline → `<Sequence><Video></Sequence>` appears in the TSX at the drop frame, a new row renders, the clip plays in the Player. `bun test test/media-drop-timeline.test.ts`.

### Task 4: EXTEND on-canvas media reference (video/audio drop → annotation chip)

- **Do**: Replace `use-canvas-media-drop.tsx`'s `uploadAndAnnounceMedia` toast-only path with an `AnnotationsLayer` media-reference chip (mirror `onImage`/`onLink`): upload → place a positioned chip at `world` showing a poster/first-frame (or a ♪ tile for audio) + filename, stored in the versioned annotations. The chip carries the `assets/…` path so the agent can enumerate referenced clips. Keep the copy-paste snippet available (secondary affordance, e.g. click-to-copy on the chip).
- **Pattern**: `AnnotationsLayer` `onImage` chip creation + commit/undo sink; `onLink` link-chip for the label/positioning model.
- **Gotcha**: a video poster needs one decoded frame — grab it client-side (`<video>` seek to 0 + canvas draw) at chip-create; don't block the drop on it (placeholder → poster when ready). Audio has no frame → a labeled ♪ tile. This is a REFERENCE, not a comp element — it must NOT be seeked by the capture spine (it's on the annotations layer, which capture already excludes via `?hide-chrome`).
- **Validate**: live: drop 3 mp4s + 1 mp3 onto blank canvas → 4 reference chips land; `/design:chat` "make a 15s video from these clips" sees them (chips + their asset paths are in the canvas the agent reads).

---

### P2 — Timeline clip ops

### Task 5: ADD clip horizontal-move (`from`) + Delete + context actions to the Timeline

- **Do**: (a) Add a **body-drag** on `tl-seq-block` that changes `from` (distinct from the shipped right-edge duration drag) → `onRetime(index, { from })` → `/_api/retime-sequence` (engine already patches `from`). Live-preview the block x during drag, commit on release. (b) A per-clip **context affordance** (right-click / kebab) with Split / Remove / Hide / Replace. (c) Selecting a clip row reflects into the shell selection so Delete works (P4).
- **Pattern**: the `retimeDrag` gesture (clone it for `from`, clamp `from ≥ 0`); `data-testid` `timeline-seq-move-<n>`, `timeline-seq-menu-<n>`.
- **Gotcha**: moving `from` on a cursor-implicit sequence (no explicit `from=`) — `retimeAttr` returns false (nothing to patch); the UI should first materialize an explicit `from={cursor}` (insert the attr) then move. Snap to second/keyframe ticks (P4).
- **Validate**: live: drag a clip body → `from` updates in TSX, block moves, Player scrub reflects new timing.

### Task 6: CREATE `splitSequence` + `POST /_api/split-sequence` (cut at playhead)

- **Do**: Engine op: for standalone `<Sequence from={F} dur={D}>` at index, split at frame `P` → head + tail (tail gets `from={P}`, `dur={F+D-P}`, and `startFrom` bumped on its `<Video>/<Audio>` by `P-F`); reparse-gate; return the two resulting indices. Refuse (actionable) inside `<TransitionSeries>` or when `P` is outside `(F, F+D)`. UI: a "Split at playhead" clip action (and the P4 shortcut).
- **Pattern**: `applyMove` skeleton; `retimeAttr`'s const-vs-literal handling for the frame math; Remotion `<Video startFrom>` semantics.
- **Gotcha**: const-preferring — if `dur` is `const A`, the split can't just bump `A` (both halves would reference it); the tail must get literal frames or a new const. Keep it simple: write literals for the split products, leave a `// split` comment. Re-settle selection onto the head clip.
- **Validate**: `bun test` (split a `<Video>` clip → tail `startFrom` correct; refuse in TransitionSeries; refuse out-of-range); live: playhead mid-clip → Split → two rows, seamless playback across the cut.

### Task 7: CREATE `removeSequence` + `POST /_api/remove-sequence`

- **Do**: Engine op: remove the clip's `<Sequence>…</Sequence>` span (+ its line framing, like `moveElement`'s `removeStart`); when the clip is inside a `<TransitionSeries>`, also remove ONE adjacent `<TransitionSeries.Transition>` to keep the series valid; reparse-gate (this catches an invalid TransitionSeries residue → refuse). Return the reflowed clip list. UI: clip "Remove" action + Delete key (P4) with a subtle confirm/undo.
- **Pattern**: `applyRemove`/`moveElement` span-removal + reparse gate; the `_history`/undo lane so a removal is one Cmd+Z.
- **Gotcha**: removing the only clip in a comp → refuse ("delete the comp instead"). Re-settle selection onto the previous/next clip.
- **Validate**: `bun test` (remove standalone; remove-in-TransitionSeries drops one transition; refuse last clip); live: Remove → clip gone, timing reflows, one undo restores it.

### Task 8: CREATE `toggleSequenceHidden` + `POST /_api/toggle-sequence-hidden`

- **Do**: Engine op: wrap an explicit-`from` `<Sequence>` in `{/* dc-hidden */ /* …original… */}` (reversible marker) to hide; unwrap to show; reparse-gate both directions; refuse on cursor-implicit / TransitionSeries clips (would shift timing) with an actionable message. UI: an eye toggle on the clip row; parser (Task 1) renders hidden clips dimmed.
- **Pattern**: MagicString wrap/unwrap around the clip span; the Task 1 parser hidden-pass reads the marker back.
- **Gotcha**: JSX comments inside JSX children are `{/* */}` (expression-container comments), and the *wrapped element* must itself be commented as a block — verify the exact escaping round-trips (hide→show is byte-identical) in a unit test. Don't leave a `{/* */}` that Prettier would reflow oddly.
- **Validate**: `bun test` (hide→show round-trip byte-identical; hidden clip omitted from render; refuse cursor-implicit); live: eye-toggle → clip disappears from Player, row dims, toggle back restores.

### Task 9: WIRE replace-media (upload → patch `src`)

- **Do**: The clip "Replace" action opens a file picker (or accepts a drop onto the clip): `uploadAsset` → `POST /_api/edit-attr` `{ id: <media element cd-id>, attr: 'src', value: 'assets/…' }` (engine's `editAttribute` already does this). The media element's cd-id comes from the pipeline (Video/Img/Audio are plain identifiers → they get one); resolve it via the selection bridge or a targeted parse.
- **Pattern**: existing `editAttr` endpoint; the asset upload from Task 3.
- **Gotcha**: replacing audio `src` should preserve `from`/`durationInFrames`/volume envelope (only `src` changes). If the media element has no resolvable cd-id (e.g. `src` built from a prop), refuse → "edit via /design:edit".
- **Validate**: live: Replace a clip's video → new footage plays, timing/position unchanged; `bun test` (edit-attr on `src`).

---

### P3 — Live canvas element-editing persistence fix

### Task 10: DIAGNOSE + surface inline-edit failures (stop the silent revert)

- **Do**: Replace the silent `console.warn` on `/_api/edit-text` + `apply-edit` failures (`app.jsx` ~7143, ~7183) with a **visible, actionable** result: a toast/inline badge ("Couldn't save this edit — mixed content, edit via chat") AND (critically) **do not leave the optimistic DOM change stranded** — on a refusal, revert the optimistic DOM edit immediately so the canvas reflects the true (unsaved) state instead of showing a change that silently vanishes on the next reload. Add a matching visible-success signal so the user knows an edit stuck.
- **Pattern**: `showCanvasToast`; the `applyOptimisticStyle` optimistic-then-reconcile pattern (extend it to revert-on-failure).
- **Gotcha**: the failure is currently invisible precisely because the write is async + the HMR reload is what "reverts" — the fix is to reconcile the optimistic edit against the endpoint's `{ok}` result, not to hope HMR agrees.
- **Validate**: live: edit text on `<h1>{title}</h1>` → clear "can't inline-edit, use chat" signal (not a silent snap-back); edit a leaf `<button>Save</button>` → persists across reload.

### Task 11: MAKE inline TEXT edits robust for common real elements

- **Do**: Widen the `editText` editable set beyond single-`JSXText`-child. At minimum handle **`{'string literal'}` expression children** (`<h1>{'Title'}</h1>` → rewrite the literal) and **leading/trailing static text around a single inline child** where the target is unambiguous. For genuinely mixed/dynamic content (`{title}`, `{count} items`), keep the refusal but route it to a **one-shot agent-assisted edit** (hand the new text + element to `/design:edit`'s fast path) instead of a dead end. Preserve the `escapeJsxText` injection guard on every new path.
- **Pattern**: `applyTextEdit`'s JSXText handling; extend `meaningful`-children analysis to the string-literal-expression case; the DDR-103 escape rule stays.
- **Gotcha**: NEVER rewrite a `{identifier}` or template with interpolation as literal text (that would delete the binding) — those are the refuse-and-route cases. The security boundary (`escapeJsxText`/`escapeAttr`) is load-bearing — every new branch goes through it (DDR-103).
- **Validate**: `bun test` (new `applyTextEdit` cases: string-literal child rewrite; refuse `{identifier}`; escaping holds); live: edit copy on a real generated hero → sticks.

### Task 12: MAKE inline CSS edits robust for class-styled + non-inline elements

- **Do**: Today `editStyleProp` refuses when there's no inline `style={{}}` object (or it isn't an inline ObjectExpression). For a class-styled element, **inserting an inline `style={{ prop: value }}`** already works (the no-style-attr branch) — verify it does for the inspector's common props and that the reconcile (optimistic paint → source patch → HMR) doesn't flash-revert. Where the refusal is correct (style is a spread/variable), surface it (Task 10) and route to chat. Confirm the trailing-comma guard (already in-tree) covers frame-driven inline styles in comps.
- **Pattern**: `editStyleProp` insert-branch; `applyOptimisticStyle` reconcile.
- **Gotcha**: the "CSS edit resets when I replay the video" bug is fixed in-tree (double-comma guard) — add a regression test so it stays fixed; a comp's frame-driven `style={{ opacity: o, }}` is the exact shape that regressed.
- **Validate**: `bun test` (insert inline style on a class-only element; frame-driven-style append regression); live: change a color via the inspector on a generated card → persists across reload AND across a Player replay.

---

### P4 — Keyboard shortcuts + polish

### Task 13: ADD timeline-scoped keyboard shortcuts

- **Do**: Shell-level keydown handler, **gated on timeline focus/hover + comp active + not-typing** (the Space-conflict rule): **Space** play/pause, **← / →** step 1 frame, **Shift+← / →** step 1s, **`,` / `.`** step to prev/next keyframe (from the parsed `keyframes[]`), **Home/End** jump to start/end, **Delete/Backspace** remove the selected clip (Task 7), **`s`** split at playhead (Task 6). Drive transport via the existing `timeline-seek`/`-play`/`-pause` postMessage; add a `timeline-step` convenience if useful.
- **Pattern**: the existing global keydown handlers in `app.jsx`; the `timeline-*` postMessage protocol in `video-comp.tsx`.
- **Gotcha**: the Player has `spaceKeyToPlayOrPause={false}` deliberately (Space = pan) — do NOT re-enable it on the Player; the shell handler owns Space and only when the timeline context is active + focus isn't in an input/contenteditable. Show the shortcut map in a `?`/tooltip.
- **Validate**: live: Space toggles play only with the timeline active (still pans the canvas otherwise); arrows step frames; `.`/`,` land on keyframes; Delete removes the selected clip.

### Task 14: POLISH — snapping, tooltips, a11y, empty/edge states

- **Do**: Snap clip drags (move/trim/split) to second ticks + neighboring clip edges + the playhead (with an override modifier). Tooltips/readouts for every gesture. A11y: clip rows focusable + operable by keyboard (the P4 shortcuts already give frame-step; add clip focus + menu via keyboard), `aria` labels, reduced-motion on the ghost/preview. Edge states: drop on an empty (no-comp) canvas → offer "make this a video-comp"; drop of an unsupported type → clear message.
- **Pattern**: existing `TimelinePanel` tick math; the a11y-auditor's WCAG bar; `flow:motion-rules` for the drag-preview durations.
- **Validate**: `flow:validate-a11y` on the timeline; live: snapping feels right; keyboard-only clip edit works.

### Task 15: DOCS + skill + bundle + verification sweep

- **Do**: (a) Teach the parseable/edit-friendly shapes in `plugins/design/skills/video-comp/SKILL.md` (explicit `from`/`durationInFrames`, standalone `<Sequence>` for splittable clips, `<Video src startFrom>`), so AI-generated comps are hand-editable by construction. (b) `apps/studio/whats-new.json` entry via the `whats-new-entry` skill (pending). (c) Rebuild the committed client bundle `--release` + commit `dist/client.bundle.js` + `dist/styles.css`. (d) `pnpm --filter @maude/site gen:roadmap` if a plan is archived/added. (e) Full live sweep per the memory `feedback_no_break_exhaustive_verify` (inventory + per-feature verify).
- **Pattern**: `whats-new-entry` skill; the CLAUDE.md bundle-rebuild rule.
- **Validate**: quality gates green; live checklist in the execution report.

---

## Validation

Repo quality gates (adapted per `feedback_scope_flow_commands_to_repo_state` — this repo has no scenario-runner/.ai/scenarios):

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (new: `canvas-edit-clip-ops`, `media-drop-timeline`, extended `timeline-parse` + `applyTextEdit`/`editStyleProp` regression + `canvas-origin-gate` route-absence)
3. **Build**: `pnpm --filter @maude/site build`
4. **Parity/tarball/tokens/site-content**: `bash scripts/check-version-parity.sh` · `bash scripts/check-tarball-shape.sh` · `pnpm --filter @maude/site sync:tokens:check`
5. **Runtime bundles**: `bash apps/studio/bin/check-runtime-bundles.sh` (unchanged — no new runtime deps)
6. **Client bundle rebuilt `--release`** and committed (`dist/client.bundle.js` + `dist/styles.css`)
7. **Security pass**: `security-auditor` + `ethical-hacker` over the new main-origin source-write routes (confirm absence from both canvas allowlists; confirm `escapeJsxText`/`escapeAttr`/`assets/`-containment on insert/replace)
8. **Live UI verify** (agent-browser): the P1–P4 checklist — drop→timeline insert, drop→canvas reference, move/trim/split/remove/hide/replace, inline text+CSS persist across reload AND replay, keyboard shortcuts
9. **A11y**: timeline keyboard reach + clip operability + reduced-motion (`flow:validate-a11y`)
10. **Manual**: an AI-generated 15–20s comp → hand-edit end to end (drop a clip, move it, trim, split, remove one, hide one, replace footage, retype a title, recolor a card) → export MP4 → verify the edits landed and playback is seamless

---

## Acceptance Criteria

- [ ] All tasks completed; DDR recorded
- [ ] **P1**: video/image/audio dropped ON the timeline → `<Sequence>`+`<Video/Audio/Img>` inserted at the drop frame, plays; media dropped on the canvas → reference chip (like paste-image), enumerable by the agent
- [ ] **P2**: a clip can be moved (`from`), trimmed, split at playhead (seamless via `startFrom`), removed (one-undo), hidden/shown (reversible), and have its media replaced — all as reparse-gated source patches that never corrupt the comp
- [ ] **P3**: inline text + CSS edits via the inspector **persist across HMR reload and Player replay**; unsupported cases surface a clear message + route to chat instead of silently reverting
- [ ] **P4**: Space play/pause (context-scoped, never steals the pan chord or typing), frame/second/keyframe stepping, Home/End, Delete-clip, split shortcut
- [ ] Every new source-write route is main-origin-only, CSRF-gated, absent from `CANVAS_SAFE_API` + `startCanvasServer` routes, with a `GET → 405`/absence assertion
- [ ] No new user-side install; no new runtime bundle; determinism contract intact (dropped `<Video>` seeked per-frame in capture)
- [ ] Quality gates green; committed client bundle rebuilt `--release`; live sweep 0 blockers; no DDR-worthy decision unrecorded

---

## Deferred / Open questions

- **Splitting inside `<TransitionSeries>`** — overlap + transition-placement math isn't a clean text patch; v1 refuses. Revisit if users hit it often.
- **Vertical reorder / render-order (z-order) of clips** — reordering `<Sequence>` siblings changes stacking; `moveElement` exists but the timeline UX + semantics need their own slice. v1 = horizontal (`from`) only.
- **Per-keyframe `interpolate()` dot-editing** — still deferred from DDR-148; this plan ships clip-level ops, not keyframe-level.
- **Multi-select clip ops** (move/delete N clips) — v1 is single-clip (mirrors the shell's single-focus model).
- **Promoting a canvas media-reference chip into the comp** ("use these 3 refs as a TransitionSeries") — v1 leaves assembly to the agent; a one-click "assemble refs" is a natural follow-up.
- **Intrinsic-duration probe on upload** — insert defaults to `fps*3` when the media duration is unknown; probing it (client-side `<video>.duration`) tightens the default.
- **Undo granularity** — confirm each clip op is exactly one `_history`/Cmd+Z step (mirrors reorder); a compound op (split = two writes) may need coalescing.
