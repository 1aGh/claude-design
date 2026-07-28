# Feature: Robust video & animation editing — direct manipulation on the video-comp timeline + canvas

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan **extends DDR-148** (the shipped video-comp foundation) — read it and the shipped code first; do not re-derive the Player/seek/export layers, they exist.

> **This plan was hardened by a divergent BUILDER/SHIPPER/BREAKER debate (2026-07-04).** The debate caught a load-bearing defect the first draft missed — clip addressing by document-order index is **already broken on multi-comp canvases** (two tokenizers disagree), which makes destructive ops silently corrupt the *wrong* clip. The resulting direction (user-ratified): **persistence-fix first → a mandatory clip-addressing foundation → lean clip ops → media intake + one-click assemble → z-order + keyframe markers.** Mid-clip split and show/hide are **deferred behind the addressing + semantic gate** (BREAKER's block, honored). See § Debate record.

## Description

DDR-148 shipped the video-comp foundation: a Remotion composition in `<Player>`, the `window.__maude_seek__` bridge, a bottom **Timeline panel** (transport + scrub + volume + read-only rows + drag-the-right-edge-to-retime-duration), the `canvas-edit.ts` source-patch engine, and capture-first MP4/GIF export. What's missing is the **direct-manipulation editing surface** — the difference between "watch/scrub a comp the AI made" and "trim, move, delete, replace, and assemble clips by hand."

This feature adds **basic manual video & animation editing**, keeping the DDR-148 model: **the timeline is a view of the source TSX, and every edit is a source patch on Remotion `<Sequence>`/`<Video>`/`<Audio>`/`<Img>` tags** — no bespoke clip IR (DDR-148 §3). The target use case is explicit: **generate an infographic or video with the AI, then fine-tune the details by hand** (and "throw a pile of clips at the canvas, tell the agent *udělej z toho video*").

Five phases (order + scope ratified after the debate):

- **P1 — Live-edit persistence fix** *(reordered to first — it's a trust-breaking bug in a **shipped** feature, hits **every** canvas, and is nearly free).* Inline text/CSS edits via the inspector today **silently fail and revert on reload**; make them robust, surface failures, survive HMR.
- **P2 — Clip-addressing foundation** *(mandatory, blocks every destructive op).* One AST-based clip enumerator shared by UI + engine (kills the two-tokenizer multi-comp disagreement), a **stable clip identity**, a **content-hash optimistic-concurrency fingerprint**, a **semantic gate** (parse-clean ≠ correct), a **cross-process lock**, and hard `src`/tag validation.
- **P3 — Clip ops (lean) + shortcuts.** Move (`from`), trim, remove, replace — all reusing shipped engine ops over the new addressing — plus Delete key and timeline keyboard shortcuts.
- **P4 — Media intake + assemble.** Drop media on the canvas as a reference chip (mirrors paste-image); drop on the timeline to insert a clip; **one-click "assemble refs → comp"** (the user's verbatim ask).
- **P5 — Ambition adds.** Vertical/z-order clip reorder (reuses `applyMove`); interactive keyframe markers (click-to-seek).

## User Story

As a **designer/founder using Maude** I want **to reliably hand-tweak text and CSS on the canvas, then move/trim/delete/replace/reorder clips on the timeline and assemble dropped clips into a comp** so that **after the AI generates a video or infographic I can do the last-mile manual polish in the same canvas-first loop, without re-prompting blind for every timing or copy change — and without a stray edit ever silently corrupting a different clip.**

## Problem

- **Live inline editing is unreliable** — `editText` refuses mixed/expression children (`<h1>{title}</h1>`, `<p>Hi <b>there</b></p>`) and the shell only `console.warn`s the refusal (`app.jsx:7143,7183`), so the optimistic DOM change reverts on the next HMR reload ("*přepis textu nezůstává perzistentní*"). CSS edits have a related silent-revert class (class-styled + non-inline `style`).
- **Clip addressing is already broken on multi-comp canvases** — the UI parser counts clips within **one comp's body** (`timeline-parse.js:116-131`, `scope = target.body`) while the engine counts `<Sequence>` tags across the **whole file** (`canvas-edit.ts:845,889`). `retimeSequence(index)` already mis-hits on a 2-comp canvas today (recoverable). Destructive ops built on this would be **irreversible wrong-clip corruption**.
- The Timeline is **read-only except one gesture** (right-edge duration drag). No move, delete, replace, reorder; **nothing can be dropped onto it**.
- **Video/audio dropped on the canvas only toasts a snippet** (`uploadAndAnnounceMedia`) — no on-canvas artifact for the "assemble a pile of clips" use case.
- **No editing keyboard shortcuts** — Space is the pan chord (`spaceKeyToPlayOrPause={false}` on the Player), so no play/pause or frame-step.

## Solution

Every capability is a source patch through the existing engine (`apps/studio/canvas-edit.ts`) behind a **main-origin-only** endpoint (`http.ts` + `api.ts`, absent from both canvas allowlists — DDR-054/DDR-088), driven from the Timeline panel / inspector via the shell postMessage bridge (`app.jsx`). The debate's core structural change: **clips are addressed through ONE authoritative AST enumerator, by a stable identity + content-hash fingerprint — never by a regex document-order index.**

What already exists and is **reused, not rebuilt** (SHIPPER):

| Capability | Mechanism | Status |
| --- | --- | --- |
| Move clip (`from`) + trim (`durationInFrames`) | `retimeSequence`/`applyRetimeSequence` (const-preferring) — already patches **both** | shipped; re-address onto P2 foundation |
| Replace media (`src`) | `editAttribute`/`editStringAttr` — replaces any attr on any value shape | shipped; address media element via enumerator |
| Structural move / reorder | `moveElement`/`applyMove` (re-indent + reparse + re-settle) | shipped; drives z-order (P5) |
| Inline text / CSS / attr | `editText`/`editCss`/`editAttr` + `apply-edit` lane | shipped; hardened in P1 |

Genuinely net-new engine work: the **AST clip enumerator + fingerprint + semantic gate + cross-process lock** (P2), `removeSequence` (P3, standalone-only), `insertSequenceIntoComp` (P4). **Deferred behind P2's gate:** `splitSequence`, `toggleSequenceHidden` (BREAKER blocked them as originally specced; "cut" is approximated by two-edge trim in v1).

Load-bearing invariants (some inherited, some added by the debate): **address by stable id through one AST tokenizer** · **content-hash fingerprint refuses a stale/raced target** · **semantic gate after reparse** (parse-clean ≠ correct) · **cross-process lock** (HTTP + `/design:edit` CLI + HMR must not interleave) · atomic write + reparse-before-write · const-preferring rewrites · source-write routes main-origin-only · `src` contained under `assets/` (no `..`) + `escapeAttr` on the insert path · committed client bundle rebuilt `--release` after any `client/` change.

## Metadata

- **Type**: Bug Fix (P1 persistence; P2 latent multi-comp mis-address) + Enhancement (P3–P5 direct manipulation)
- **Complexity**: High
- **App/Package**: `apps/studio` (engine + client + canvas-lib) · minor `plugins/design` (video-comp skill teaches stable-id-friendly shapes)
- **Affected Systems**: source-patch engine (`canvas-edit.ts` — correctness/security-load-bearing), clip-addressing (NEW shared enumerator), main-origin source-write routes (CSRF-gated), Timeline panel + shell bridge, annotations layer (media reference), asset write surface (reused), cross-process write locking (NEW)
- **Dependencies**: none new — Remotion / Player / mediabunny / gifenc / asset route shipped in DDR-148; `oxc-parser` + `magic-string` are already the engine toolchain.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single assistant message.

- `apps/studio/canvas-edit.ts` — Why: the engine. `retimeSequence`/`applyRetimeSequence` + `retimeAttr` (~834–949 — patches `from` AND `durationInFrames`, const-vs-literal); `moveElement`/`applyMove` + `collectElements`/`collectElementsFull` (~513–831 — the AST walk the P2 enumerator extends, plus the re-settle-through-id-churn precedent); `editAttribute`/`editStringAttr` (`src`-replace); `editText`/`applyTextEdit` (the P1 refusal ~391–410); `escapeJsxText`/`escapeAttr` (~997–1017 injection guards — the insert path MUST use these); `withLock` (~150–163 — **in-process only**, the P2 cross-process gap); the `SEQ_TAG_RE` whole-file walk (~845,889 — **the bug**: replace with the comp-scoped AST enumerator).
- `apps/studio/client/panels/timeline-parse.js` — Why: the UI tokenizer (regex, comp-scoped `scope = target.body` ~116-131). **The two-parser disagreement lives here.** P2 makes the UI address clips through the engine's enumerator (or its returned stable ids), not this regex index. Keep it for *labels/positions*, not for *addressing destructive ops*.
- `apps/studio/client/panels/TimelinePanel.jsx` — Why: the timeline UI. `retimeDrag`/`startResize` gesture (~165–193 — cloned for the `from`-move), keyframe bars (~344–355 — P5 click-to-seek), row/track/playhead layout the new gestures + drop target attach to; `data-testid` conventions.
- `apps/studio/video-comp.tsx` — Why: Player mount + `installMaudeSeekBridge` + the `timeline-*` postMessage protocol (seek/play/pause/mute/volume/comps ~243–306); `clickToPlay={false}` + `spaceKeyToPlayOrPause={false}` (~328–334 — the P3 Space-conflict origin).
- `apps/studio/use-canvas-media-drop.tsx` — Why: the drop/paste hook. `classifyMediaPayload` dispatch matrix, `onImage`/`onMedia`/`onLink` callbacks (`onMedia`→`uploadAndAnnounceMedia` toast today ~284–302), `uploadAsset`, `mediaSnippet`. P4 extends it (timeline drop target + on-canvas media reference).
- `apps/studio/api.ts` — Why: wrappers `editCss`/`editText`/`editAttr`/`retimeSequenceOp` (~264–297, ~1637–1849) — the input-validation + engine-adapter layer new ops get siblings in.
- `apps/studio/http.ts` — Why: the route map + `/_api/edit-*` + `/_api/retime-sequence` handlers (~1225–1373); the CSRF `sameOriginWrite` guard for main-origin source-write routes (~142,192-196); `CANVAS_SAFE_API` (new source-write routes stay OUT).
- `apps/studio/server.ts` — Why: `startCanvasServer` `routes` — the second allowlist (DDR-088); new source-write routes absent from it; only asset-write is canvas-reachable.
- `apps/studio/client/app.jsx` — Why: the shell. Timeline state + wiring (`timelinePlaying`/`timelineCompId`/`activeComps`/`timelineFrame` ~6100–6400; the `<TimelinePanel … onRetime={…→ /_api/retime-sequence}>` block ~8380–8440); the inline-edit persistence handlers (`edit-text`/`apply-edit` ~7131–7186 — the P1 silent `console.warn`); the `select`/`layers-tree`/`reorder-request` postMessage lane (~7098–7271 — the active-canvas-only request gate + `pendingReorderRef` re-settle pattern the P2/P3 ops mirror); `applyOptimisticStyle`; the global keydown surface (P3).
- `apps/studio/canvas-lib.tsx` — Why: `AnnotationsLayer` owns the media-drop callbacks (commit/undo sink + `screenToWorld`); `onImage`/`onLink` chip creation is the exact path P4's on-canvas media reference mirrors. `VideoComp` re-export.
- `apps/studio/canvas-pipeline.ts` — Why: where `data-cd-id` is injected (the positional-id precedent P2's stable clip id mirrors; the candidate injection site for a `{/* @mclip id */}` sentinel / `<Sequence name>` normalization).
- `.ai/archive/decisions/DDR-148-*.md` — Why: the foundation; the determinism contract + "no bespoke IR, Remotion vocabulary IS the model" that scopes ops to Remotion tags.
- `.ai/archive/decisions/DDR-103-*.md` + `DDR-104-*.md` — Why: the inline-edit trust boundary + UX model P1 hardens; the `editText` refusal is a DDR-103 choice — P1 changes failure *surfacing*, not the escape rule.
- `.ai/archive/decisions/DDR-088-*.md` + `DDR-054-*.md` + `DDR-138-*.md` — Why: source-write routes main-origin-only + dual-allowlist; untrusted-iframe trust model; the node-move reorder + re-select-through-id-churn precedent.
- `apps/studio/test/timeline-parse.test.ts` + `test/video-comp.test.ts` + `test/canvas-origin-gate.test.ts` — Why: guards to extend (parser cases, seek determinism, `GET → 405`/route-absence per new route).

### Files to Create

- *(new ops/enumerator in existing)* `apps/studio/canvas-edit.ts` — `enumerateClips` (AST, comp-scoped, stable id + content hash), `assertCompSemantics` (semantic gate), `removeSequence`, `insertSequenceIntoComp` (+ pure `apply*`); a cross-process lock helper (or `apps/studio/file-lock.ts`).
- `apps/studio/test/clip-addressing.test.ts` — **the debate's headline guard**: UI-index == engine-clip across nested / `.map()` / multi-comp / commented-tag fixtures; fingerprint refuses a stale/mutated target; semantic gate rejects orphaned/double `<TransitionSeries.Transition>`.
- `apps/studio/test/canvas-edit-clip-ops.test.ts` — remove/insert pure-variant tests + reparse-gate + semantic-gate refusals + `src` traversal rejection + `escapeAttr`-on-insert.
- `apps/studio/test/media-drop-timeline.test.ts` — timeline-drop dispatch + on-canvas media-reference classification.
- *(extend)* `apps/studio/client/panels/timeline-parse.js` — emit per-clip stable id + content hash (from the enumerator) + media `src`; stop being the addressing authority.
- `.ai/archive/decisions/DDR-1xx-timeline-clip-addressing-and-inline-edit-persistence.md` — the decision (Task 0): AST clip addressing + fingerprint + semantic gate as the destructive-op prerequisite; the P1 failure-surfacing change; why split/hide are deferred; the debate record.

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio Intro Video.tsx` | storyboard | — | The repo's own video storyboard authored AS a canvas — reference for a comp-being-edited; ground the clip-row UX in it. |
| `.design/ui/Canvas Viewport.tsx` | active | — | Shell-chrome canvas — mock the new Timeline affordances (drop target, clip context actions, reorder handle) here first. |
| `.design/ui/Maude Video Intro.tsx` | *(modified in tree)* | — | A live comp to dogfood P3/P4 against. |

### Documentation

- [Remotion `<Sequence>`](https://www.remotion.dev/docs/sequence) (`from`/`durationInFrames`/**`name`** — the durable, Prettier-surviving clip label P2 uses for stable identity) + [`<Video>`](https://www.remotion.dev/docs/video) (`startFrom` — only needed if split ships, deferred) + [`<TransitionSeries>`](https://www.remotion.dev/docs/transitions) (alternation the semantic gate asserts).
- [Building a timeline](https://www.remotion.dev/docs/building-a-timeline) — Why: Remotion's `Item {from, durationInFrames, id}` model — confirms move/trim map 1:1 to props and endorses a stable per-item id.
- [oxc-parser](https://oxc.rs/) + [magic-string](https://github.com/Rich-Harris/magic-string) — Why: the AST-enumerate + surgical-rewrite toolchain (already in `canvas-edit.ts`); the enumerator uses the AST, not regex.

### Patterns to Follow

- **New structural op = `applyX` (pure, reparse-gated + semantic-gated) + `X` (disk, cross-process-locked + atomic tmp-rename)** — copy `applyMove`/`moveElement` (~659–831) as the skeleton; add the semantic gate after the reparse gate.
- **Address clips by the AST enumerator's stable id + content hash — never a regex index.** The enumerator walks with the SAME component/jsxIndex bookkeeping as `collectElements` (~513–556), scoped to the target comp body, and skips tags inside comments/strings (regex didn't).
- **Main-origin-only source-write endpoint** — mirror `/_api/retime-sequence` (~1356): CSRF-gated, absent from `CANVAS_SAFE_API` + `startCanvasServer` routes, with a `GET → 405`/absence assertion in `test/canvas-origin-gate.test.ts`.
- **Untrusted-iframe → shell request lane** — a gesture originating inside a canvas iframe REQUESTS via postMessage, honored **only from the ACTIVE canvas window** (copy the `reorder-request` gate ~7251–7271). Timeline gestures live in the shell (main-origin) and call `/_api/*` directly.
- **Re-settle selection through id churn** — insert/remove/reorder reflow ids; mirror `pendingReorderRef` + `movedId`/`semanticId` (~7196–7222, `MoveResult`). With stable clip ids this becomes cheap.
- **On-canvas media reference = annotation chip** — mirror `onImage`/`onLink` in `AnnotationsLayer` (client-side, versioned `.annotations.svg`), NOT a source insert.
- **Client change → rebuild committed bundle** — `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, commit `dist/client.bundle.js` + `dist/styles.css`.

---

## Design Decisions

### Clip-addressing foundation (the debate's core add — mandatory before any destructive op)

The root defect: two tokenizers disagree on "which clip is index N." Fix = **one authoritative AST enumerator** in `canvas-edit.ts`, scoped to a specific comp (by artboard id → comp name, reusing `videoCompUsages`/`collectElementsFull` scoping), returning for each clip `{ stableId, from, durationInFrames, mediaTag, mediaSrc, contentHash }`. The UI's `timeline-parse.js` keeps drawing rows but **addresses ops by the enumerator's `stableId`**, not its own regex position.

- **Stable identity** — prefer, in order: a Remotion `<Sequence name="…">` (durable, human-facing, survives Prettier); a pipeline-injected `{/* @mclip <id> */}` sentinel; else the AST-order-index *within the scoped comp* (computed by the SAME enumerator the engine uses, so UI/engine never disagree even in the degraded case). Not a bespoke IR — the TSX stays the single source (DDR-148 line held); this is the positional-`data-cd-id` precedent made non-positional.
- **Content-hash optimistic-concurrency fingerprint** — every structural op sends the target clip's expected `contentHash`; the engine recomputes from disk and refuses (409-style, actionable) if it changed. Guards a stale UI index AND a concurrent `/design:edit`/HMR edit.
- **Semantic gate (parse-clean ≠ correct)** — after the reparse gate, assert comp invariants: `<TransitionSeries>` strict alternation (no leading/trailing/double `<Transition>` — the BREAKER counter to the first draft's false "reparse catches it" claim), and coverage/monotonicity sanity for move/remove. Refuse on violation.
- **Cross-process lock** — the in-process `withLock` (~150) can't stop the `/design:edit` CLI (`import.meta.main` ~1161) + HMR from interleaving. Structural clip ops take an on-disk advisory lock on the comp file.

### Split / hide are DEFERRED (BREAKER block, honored)

- **Mid-clip split** — the `startFrom` seam math × const-preferring rewrites × TransitionSeries overlap is the highest risk-per-value; v1 approximates "cut" with the shipped two-edge trim. True split is the first fast-follow once the semantic gate proves out.
- **Show/hide via JSX-comment marker** — the byte-identical round-trip promise fights Prettier/HMR reflow and any clip containing `*/`, and a commented `<Sequence>` skews a regex index (moot once addressing is AST-based, but the reflow hazard remains). Deferred; **remove + one-undo covers the need** in v1.

### On-canvas media reference vs. timeline insert vs. assemble (P4)

- **Drop on canvas body** → annotation-layer reference chip (mirrors paste-image), versioned, non-destructive — the "*nahazet klipy → agent z toho udělá video*" artifact.
- **Drop on the Timeline** → `insertSequenceIntoComp` at the drop frame (a clip added; reflows ids → re-settle via the P2 addressing).
- **"Assemble refs → comp" one-click** (BUILDER, the user's verbatim ask) → scaffold a `<VideoComp>` + N `<Sequence><Video>` in drop order, durations probed client-side (`<video>.duration`); a chip the agent must be re-prompted about is not "assemble."

### Space-key conflict (P3)

Space stays the canvas pan chord by default; = play/pause only when ALL of: Timeline open, comp active, focus not in input/`contenteditable`, pointer over / last-focus on the timeline. Frame-step keys (← →, Shift+← →, `,`/`.`) are timeline-scoped the same way. Shell-level handler; the Player keeps `spaceKeyToPlayOrPause={false}`.

### Ops surface (all main-origin-only, CSRF-gated, absent from both canvas allowlists)

| Endpoint | Body | Engine |
| --- | --- | --- |
| `GET /_api/comp-clips` | `{ canvas, artboardId }` | `enumerateClips` (stableId + contentHash) |
| move (`from`) / trim | `/_api/retime-sequence` **(shipped, re-addressed)** `{ canvas, clipId, contentHash, from?, durationInFrames? }` | `retimeSequence` |
| replace media | `/_api/edit-attr` **(shipped)** `{ id, attr:'src', value }` (src contained under `assets/`) | `editAttribute` |
| remove clip | `POST /_api/remove-sequence` `{ canvas, clipId, contentHash }` | `removeSequence` (standalone-only) |
| insert clip | `POST /_api/insert-sequence` `{ canvas, artboardId, from, durationInFrames, media:{tag,src} }` | `insertSequenceIntoComp` |
| z-order reorder | `POST /_api/reorder` **(shipped)** or `reorder-sequence` `{ canvas, clipId, refClipId, position }` | `moveElement` |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| AST clip enumerator + fingerprint + semantic gate | the addressing foundation | `canvas-edit.ts` `collectElements` walk |
| Timeline drop target + drop-frame ghost | no timeline intake today | `TimelinePanel.jsx` track + a pure `clientX→frame` helper |
| Clip context actions (remove/replace/reorder) + `from`-move gesture | clips are click-to-seek only | `TimelinePanel.jsx` `tl-seq-block` + `retimeDrag` |
| On-canvas media-reference chip (video/audio) | video/audio only toasts a snippet today | `AnnotationsLayer` `onImage`/`onLink` |
| "Assemble refs → comp" action | the user's verbatim ask | `insertSequenceIntoComp` × N + scaffold |

---

## The invariants (load-bearing — do not break)

1. **One tokenizer.** Clips are enumerated by the AST enumerator, scoped to the target comp, skipping tags inside comments/strings. UI addresses by its `stableId`. A test asserts UI-index == engine-clip across nested/`.map()`/multi-comp/commented fixtures.
2. **Fingerprint before mutate.** Every structural op refuses if the target clip's on-disk content hash ≠ the one the UI sent (stale index / concurrent edit).
3. **Semantic gate after reparse.** Parse-clean is necessary, not sufficient — assert TransitionSeries alternation + timing sanity; refuse otherwise.
4. **Cross-process lock.** HTTP + CLI + HMR cannot interleave writes to one comp.
5. **Atomic write + reparse-before-write** (inherited) and **const-preferring rewrites** (inherited).
6. **Security:** source-write routes main-origin-only; `src` normalized + contained under `assets/` (reject `..`); the insert path builds JSX through `escapeAttr`, never raw concatenation; tag ∈ {Video,Audio,Img}.

---

## Tasks

Execute in phase order. Each task is atomic and testable.

### Task 0: RECORD the decision DDR

- **Do**: DDR `timeline-clip-addressing-and-inline-edit-persistence`: AST clip addressing + content-hash fingerprint + semantic gate as the destructive-op prerequisite (the multi-comp two-tokenizer defect + fix); the cross-process lock; the P1 failure-surfacing change (DDR-103 escape rule unchanged); why split/hide are deferred; the § Debate record (BUILDER/SHIPPER/BREAKER verdicts + the user's Ambitious ratification).
- **Pattern**: DDR-148 structure; check the decisions dir AND the uncommitted README index diff before numbering (memory `project_ddr_numbering_races_on_shared_main`).
- **Validate**: file exists; linked from this plan.

---

### P1 — Live-edit persistence fix (reordered to first)

### Task 1: SURFACE inline-edit failures + revert the stranded optimistic edit

- **Do**: Replace the silent `console.warn` on `/_api/edit-text` + `apply-edit` failures (`app.jsx:7143,7183`) with a visible, actionable result (toast/inline badge: "Couldn't save — mixed content, edit via chat") AND **revert the optimistic DOM edit on refusal** so the canvas reflects true state instead of a change that vanishes on reload. Add a visible-success signal. Reconcile the optimistic edit against the endpoint `{ok}` — do not rely on HMR to agree.
- **Pattern**: `showCanvasToast`; extend `applyOptimisticStyle` to revert-on-failure.
- **Validate**: live — edit text on `<h1>{title}</h1>` → clear "use chat" signal (no silent snap-back); edit `<button>Save</button>` → persists across reload.

### Task 2: WIDEN inline TEXT edits for common real elements

- **Do**: Beyond single-`JSXText`-child: handle `{'string literal'}` expression children (`<h1>{'Title'}</h1>` → rewrite the literal) and unambiguous static-text-around-a-single-inline-child. For genuinely dynamic content (`{title}`, `{count} items`) keep the refusal but **route to `/design:edit`'s fast path** instead of a dead end. Every new branch goes through `escapeJsxText` (DDR-103 — the load-bearing injection guard).
- **Pattern**: `applyTextEdit` `meaningful`-children analysis; the DDR-103 escape rule stays.
- **Gotcha**: NEVER rewrite a `{identifier}`/interpolated template as literal text (deletes the binding) — refuse-and-route.
- **Validate**: `bun test` (string-literal child rewrite; refuse `{identifier}`; escaping holds); live — edit hero copy → sticks.

### Task 3: MAKE inline CSS edits robust for class-styled + non-inline elements

- **Do**: Verify the `editStyleProp` insert-branch (no existing inline `style`) works for the inspector's common props on class-styled elements and the reconcile doesn't flash-revert. Where refusal is correct (style is a spread/variable) surface it (Task 1) + route to chat. Add a regression test for the frame-driven `style={{ opacity: o, }}` trailing-comma append (the fixed "CSS resets on replay" bug).
- **Pattern**: `editStyleProp` insert-branch; `applyOptimisticStyle` reconcile.
- **Validate**: `bun test` (insert inline style on class-only element; frame-driven-append regression); live — recolor a generated card via inspector → persists across reload AND a Player replay.

---

### P2 — Clip-addressing foundation (mandatory, blocks P3+)

### Task 4: CREATE the AST clip enumerator + `GET /_api/comp-clips`; migrate the SHIPPED retime onto it

- **Do**: `enumerateClips(source, artboardId)` in `canvas-edit.ts`: AST-walk (reuse `collectElements` bookkeeping), scope to the target comp body, list each `<Sequence>`/`<TransitionSeries.Sequence>`/`<Video>`/`<Audio>` clip with `{ stableId (name→sentinel→scoped-AST-index), from, durationInFrames, mediaTag, mediaSrc, contentHash }`, skipping tags inside comments/strings. `GET /_api/comp-clips` returns it. **Re-point the shipped `retimeSequence` from `SEQ_TAG_RE` document-order to this enumerator** (fixes the latent multi-comp retime mis-hit). `timeline-parse.js` addresses ops by `stableId`.
- **Pattern**: `collectElements`/`collectElementsFull` (~513–618); `videoCompUsages` scoping (`timeline-parse.js`); `computeId` (~65) for the degraded scoped index.
- **Gotcha**: `TransitionSeries.Sequence` is a member-expression with no `data-cd-id` — the enumerator assigns the stable id; the content hash is over the clip's source span.
- **Validate**: `bun test test/clip-addressing.test.ts` — **UI-index == engine-clip across nested / `.map()` / multi-comp / commented-tag fixtures** (the headline guard); enumerator ignores commented `<Sequence>`.

### Task 5: ADD the content-hash fingerprint + semantic gate + cross-process lock

- **Do**: Every structural op accepts `{ clipId, contentHash }`; the engine resolves `clipId` via the enumerator, recomputes the hash, and refuses (409, actionable) on mismatch. Add `assertCompSemantics(source, artboardId)` run after the reparse gate: `<TransitionSeries>` strict alternation (no leading/trailing/double `<Transition>`), monotonic/covered timing for move+remove. Add a cross-process on-disk advisory lock for comp-file structural writes (HTTP + CLI + HMR).
- **Pattern**: the `withLock` shape (extend to a lockfile); `applyMove`'s reparse gate (add the semantic gate beside it).
- **Validate**: `bun test` — fingerprint refuses a mutated target; semantic gate rejects an orphaned/double transition; two racing writers serialize (no lost update).

---

### P3 — Clip ops (lean, reuse shipped engine) + shortcuts

### Task 6: ADD clip `from`-move + trim gestures over the new addressing

- **Do**: A **body-drag** on `tl-seq-block` that changes `from` (distinct from the shipped right-edge duration drag) → `/_api/retime-sequence` with `{clipId, contentHash, from}`. Live-preview x during drag, commit on release. Materialize an explicit `from={cursor}` first when the clip is cursor-implicit (else `retimeAttr` has nothing to patch).
- **Pattern**: `retimeDrag`/`startResize` (clone for `from`, clamp `≥0`); `data-testid` `timeline-seq-move-<n>`.
- **Validate**: live — drag a clip body on a **2-comp** canvas → the CORRECT clip's `from` updates; block moves; scrub reflects.

### Task 7: CREATE `removeSequence` + `POST /_api/remove-sequence` (standalone-only) + Delete key

- **Do**: Remove the clip's `<Sequence>…</Sequence>` span (+ line framing, like `moveElement`'s `removeStart`); **refuse-in-`<TransitionSeries>` via the SEMANTIC gate** (Task 5), not a hoped-for reparse catch; refuse removing the only clip. Fingerprint-checked. Delete/Backspace on a selected clip triggers it; one `_history`/Cmd+Z restores. Re-settle selection onto the neighbor.
- **Pattern**: `applyRemove`/`applyMove` span-removal + reparse + **semantic** gate; the undo lane.
- **Validate**: `bun test` (remove standalone; refuse-in-series; refuse last; fingerprint mismatch → 409); live — Delete → correct clip gone, one undo restores.

### Task 8: WIRE replace-media (upload → patch `src`, contained)

- **Do**: Clip "Replace" (file picker or drop onto the clip) → `uploadAsset` → `/_api/edit-attr` `{ id: <media element id from enumerator>, attr:'src', value:'assets/…' }`. Preserve `from`/`durationInFrames`/volume (only `src` changes). Refuse when `src` is prop-built (no resolvable target) → "edit via /design:edit". Normalize + contain `src` under `assets/`.
- **Pattern**: shipped `editAttr`; the Task 11 asset upload.
- **Validate**: live — replace a clip's footage → new video plays, timing unchanged; `bun test` (edit-attr on `src`; `../` traversal rejected).

### Task 9: ADD timeline-scoped keyboard shortcuts

- **Do**: Shell keydown gated on timeline focus/hover + comp active + not-typing: **Space** play/pause, **← →** ±1 frame, **Shift+← →** ±1s, **`,`/`.`** prev/next keyframe (from parsed `keyframes[]`), **Home/End**, **Delete/Backspace** remove selected clip (Task 7). Drive transport via `timeline-seek`/`-play`/`-pause`.
- **Pattern**: existing global keydown handlers; the `timeline-*` protocol (`video-comp.tsx`).
- **Gotcha**: keep `spaceKeyToPlayOrPause={false}` on the Player — the shell owns Space, only in timeline context, never in an input.
- **Validate**: live — Space toggles play only with timeline active (still pans otherwise); arrows step; `.`/`,` land on keyframes; Delete removes the selected clip.

---

### P4 — Media intake + assemble

### Task 10: EXTEND on-canvas media reference (video/audio drop → annotation chip)

- **Do**: Replace `use-canvas-media-drop.tsx`'s `uploadAndAnnounceMedia` toast-only path with an `AnnotationsLayer` media-reference chip (mirror `onImage`/`onLink`): upload → positioned chip at `world` with a poster/first-frame (or ♪ tile for audio) + filename, carrying the `assets/…` path so the agent can enumerate refs. Keep the snippet available (click-to-copy on the chip).
- **Pattern**: `AnnotationsLayer` `onImage`/`onLink` chip + commit/undo sink.
- **Gotcha**: grab the poster async (`<video>` seek-0 + canvas draw), placeholder until ready; audio → ♪ tile. It's a REFERENCE (annotations layer, excluded from capture by `?hide-chrome`), never seeked by the capture spine.
- **Validate**: live — drop 3 mp4s + 1 mp3 on blank canvas → 4 chips; `/design:chat` "make a 15s video from these" sees them.

### Task 11: CREATE `insertSequenceIntoComp` + `POST /_api/insert-sequence` + Timeline drop target

- **Do**: Engine op: locate the target comp body, insert a re-indented `<Sequence from={F} durationInFrames={D}>\n  <Video src="assets/…" />\n</Sequence>` (or `<Audio>`/`<Img>`) at the sequence-list anchor; reparse + semantic gate; return the new clip's `stableId`. Refuse an un-insertable body shape (don't guess). `escapeAttr` on the built JSX; `src` contained. Timeline becomes a drop target (dragover highlight + drop-frame ghost): `uploadAsset` → clientX→frame → insert. `stopPropagation` so a timeline drop doesn't ALSO make a canvas chip. >20 MB warning.
- **Pattern**: `applyMove` skeleton + semantic gate; `classifyMediaPayload` for the payload matrix; `TimelinePanel` `seekAt` clientX→frame; `data-testid` `timeline-dropzone`.
- **Gotcha**: default `durationInFrames` from probed intrinsic duration else `fps*3`; re-settle selection onto the inserted clip via the P2 addressing.
- **Validate**: `bun test test/canvas-edit-clip-ops.test.ts` (insert empty + non-empty; `src` traversal rejected; route absent from both allowlists); live — drag mp4 onto timeline → clip appears at the drop frame + plays.

### Task 12: CREATE "assemble refs → comp" one-click (the verbatim ask)

- **Do**: A "Make video from these" action on the on-canvas reference set: scaffold a `<VideoComp>` (+ `DCArtboard`) and insert N `<Sequence><Video>` in drop order via `insertSequenceIntoComp`, durations from probed intrinsic length (fallback `fps*3`); land the user on the new comp with the Timeline open.
- **Pattern**: Task 11 insert × N; `canvas-create`/scaffold conventions for a new artboard/comp.
- **Gotcha**: keep it a genuine editable comp (frame-driven), not a frozen preview; audio refs → an `<Audio>` bed row.
- **Validate**: live — 4 chips → "assemble" → a playable comp with 4 clips in order, immediately editable (move/trim/delete/replace from P3).

---

### P5 — Ambition adds

### Task 13: ADD vertical / z-order clip reorder (reuse `applyMove`)

- **Do**: Drag a clip row up/down → reorder `<Sequence>` siblings (render/stacking order) via the shipped `moveElement`/`applyMove`, addressed by `stableId`, fingerprint-checked, re-settled through the P2 addressing. (Distinct from horizontal `from`-move.)
- **Pattern**: `applyMove` sibling reorder + reparse + semantic gate + `MoveResult` re-settle.
- **Validate**: live — reorder overlapping clips (footage + lower-third) → stacking changes, timing preserved, one undo.

### Task 14: MAKE keyframe markers interactive (click-to-seek)

- **Do**: The already-parsed + drawn keyframe bars (`timeline-parse.js:53`, `TimelinePanel.jsx:344-355`) become click-to-seek to that keyframe's frame, feeding the `,`/`.` step (Task 9). Read-only on the source (no `interpolate` value editing — that's deferred).
- **Pattern**: the existing `tl-kf` render + `onSeek`.
- **Validate**: live — click a keyframe bar → playhead lands on it; `.`/`,` step between them.

---

### Polish + ship

### Task 15: POLISH — snapping, tooltips, a11y, edge states

- **Do**: Snap clip drags (move/trim/reorder) to second ticks + neighbor edges + playhead (override modifier). Tooltips/readouts per gesture. A11y: clip rows focusable + keyboard-operable, `aria` labels, reduced-motion on ghost/preview. Edge states: drop on a no-comp canvas → offer "make a video-comp" / "assemble"; unsupported type → clear message.
- **Pattern**: `TimelinePanel` tick math; a11y-auditor WCAG bar; `flow:motion-rules` for preview durations.
- **Validate**: `flow:validate-a11y` on the timeline; live — snapping + keyboard-only clip edit.

### Task 16: DOCS + skill + bundle + verification sweep

- **Do**: (a) `plugins/design/skills/video-comp/SKILL.md`: teach **`<Sequence name="…">`** + explicit `from`/`durationInFrames` + standalone sequences, so AI-generated comps are hand-editable AND stable-id-friendly by construction. (b) `whats-new.json` entry via the `whats-new-entry` skill (pending). (c) Rebuild committed client bundle `--release` + commit `dist/client.bundle.js` + `dist/styles.css`. (d) `pnpm --filter @maude/site gen:roadmap` if a plan is archived/added (on a clean tree — see the commit note). (e) Full live sweep per memory `feedback_no_break_exhaustive_verify`.
- **Validate**: quality gates green; live checklist in the execution report.

---

## Validation

Repo quality gates (adapted per `feedback_scope_flow_commands_to_repo_state` — no scenario-runner/.ai/scenarios in this repo):

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (new: `clip-addressing`, `canvas-edit-clip-ops`, `media-drop-timeline`, extended `timeline-parse`/`applyTextEdit`/`editStyleProp` regression + `canvas-origin-gate` route-absence)
3. **Build**: `pnpm --filter @maude/site build`
4. **Parity/tarball/tokens**: `bash scripts/check-version-parity.sh` · `bash scripts/check-tarball-shape.sh` · `pnpm --filter @maude/site sync:tokens:check`
5. **Runtime bundles**: `bash apps/studio/bin/check-runtime-bundles.sh` (unchanged — no new runtime deps)
6. **Client bundle rebuilt `--release`** and committed
7. **Security pass**: `security-auditor` + `ethical-hacker` over the new main-origin routes (absence from both allowlists + `GET→405`; `escapeAttr` on insert; `src` `assets/` containment; cross-process lock)
8. **Live UI verify** (agent-browser): P1–P5 checklist — **multi-comp addressing (delete/move hits the right clip)**, persistence across reload+replay, move/trim/remove/replace/reorder, drop→canvas ref, drop→timeline insert, assemble-refs, keyboard shortcuts
9. **A11y**: timeline keyboard reach + clip operability + reduced-motion
10. **Manual**: an AI-generated **multi-artboard** infographic comp → hand-edit end to end (move, trim, delete one, replace footage, reorder overlap, retype a title, recolor a card, assemble 3 dropped clips into a new comp) → export MP4 → verify every edit landed on the intended clip and playback is correct

---

## Acceptance Criteria

- [x] All tasks completed; DDR recorded (DDR-150)
- [x] **P1**: inline text + CSS edits persist across HMR reload AND Player replay; unsupported cases surface a clear message + route to chat instead of silently reverting
- [x] **P2 (mandatory)**: clips addressed by ONE AST enumerator's stable id; **UI-index == engine-clip proven across nested/`.map()`/multi-comp/commented fixtures**; content-hash fingerprint refuses a stale/raced target; semantic gate rejects orphaned/double transitions; cross-process lock serializes HTTP+CLI+HMR
- [x] **P3**: move (`from`), trim, remove (standalone; refuse-in-series via semantic gate; one-undo), replace — each hits the intended clip on a multi-comp canvas — plus Delete key + timeline shortcuts (Space context-scoped)
- [x] **P4**: media dropped on canvas → reference chip; dropped on timeline → clip inserted; one-click assemble-refs → a playable, immediately-editable comp
- [x] **P5**: vertical/z-order reorder (reuse `applyMove`); keyframe markers click-to-seek
- [x] Every new source-write route main-origin-only, CSRF-gated, absent from both allowlists, `GET→405`; `src` contained; `escapeAttr` on insert (incl. closing the pre-existing `/_api/canvas` CSRF gap)
- [x] No new install/runtime bundle; determinism intact; committed client bundle rebuilt `--release`; quality gates green; live sweep 0 blockers

> **Status: COMPLETE (2026-07-04).** All 16 tasks landed across 21 commits (b511906 DDR → f0b0548 polish), each e2e-verified (engine unit tests + real-server curl + live agent-browser). Full dev-server suite green (1959 pass; the lone full-run failure is pre-existing test-parallelism flakiness — a different test each run, all pass isolated). Deferred by design (BREAKER, ratified): mid-clip split, show/hide, TransitionSeries split, multi-select, interpolate() value editing.

---

## Debate record (BUILDER / SHIPPER / BREAKER — 2026-07-04)

Divergent bookend debate (reduce tier — three parallel report-back seats, grounded in the shipped code). Convergent headline (all three, independent): **document-order clip addressing is already broken on multi-comp canvases** — UI counts one comp body (`timeline-parse.js:116-131`), engine counts the whole file (`canvas-edit.ts:845,889`); destructive ops would silently corrupt the wrong clip; a JSX-comment hide marker compounds it (regex matches the commented tag).

- **BREAKER (verdict: block-as-specced)** — parse-clean ≠ correct; the reparse gate is blind to wrong-clip delete, orphaned `<Transition>` (my first-draft "reparse catches it" was **false**), timing drift; `withLock` is in-process only (CLI/HMR race); `escapeAttr` doesn't stop `assets/../`; insert-by-concatenation bypasses escaping. Required: one AST tokenizer, content-hash fingerprint, semantic gate, cross-process lock, `src` containment. → **P2 is these guardrails, mandatory; split/hide deferred.**
- **SHIPPER (advocate)** — the core loop needs ~zero new ops (`retimeSequence` does move+trim; `editAttribute` does replace); only `removeSequence` (standalone) is unavoidable; **fix persistence first** (shipped trust bug, every canvas, nearly free); defer split/hide/insert. → **P1 reordered to first; P3 is lean/reuse.**
- **BUILDER (advocate)** — address by stable id (`<Sequence name>`/sentinel) fixes the root bug AND unlocks features; pull the user's verbatim **assemble-refs → comp**, **z-order reorder** (reuse `applyMove`), and **keyframe click-to-seek** into v1. → **P4 assemble; P5 reorder + markers.**

**User ratification (2026-07-04): "Ambitious"** — P1 persistence → P2 addressing foundation → P3 lean clip ops + shortcuts → P4 media intake + assemble → P5 z-order + keyframe markers. Mid-clip split and show/hide **deferred** behind the addressing + semantic gate.

## Deferred / Open questions

- **Mid-clip split (`splitSequence`)** — `startFrom` seam × const-preferring × TransitionSeries; first fast-follow once the semantic gate proves out. v1 "cut" = two-edge trim.
- **Show/hide (`toggleSequenceHidden`)** — JSX-comment reversibility fights Prettier/HMR reflow; remove+undo covers v1.
- **`<TransitionSeries>` split**, **multi-select clip ops**, **`interpolate()` value dot-editing** — deferred (interpolate rewriting is the hard one).
- **Stable-id durability** — `<Sequence name>`/sentinel can be dropped by Prettier or an agent edit → the enumerator degrades to scoped-AST-index (still UI/engine-consistent); watch for churn.
- **Intrinsic-duration probe** — insert/assemble default `fps*3` when unknown; client-side `<video>.duration` tightens it.
- **Undo granularity** — confirm each clip op is one `_history`/Cmd+Z step; compound ops (assemble = N inserts) may need coalescing.

---

## Post-plan dogfood addendum (2026-07-05)

A long user dogfood loop after COMPLETE shipped several of the deferred items + a granularity/UX layer, all on `main` (commits `8d3071c`→`61786e9`, each e2e-verified):

- **Multi-comp scoping fix** (`8d3071c`) — the Timeline passed the `<Player>` id, not the resolved `DCArtboard` id, so comp-clips/ops fell back to the wrong comp on a 2-comp canvas (ClipShots showed `ƒ`). `parseCompTimeline` now returns the resolved artboard id, threaded through every op. This was the addressing bug the debate flagged, resurfacing at the client boundary.
- **`<TransitionSeries>` reorder + insert** (`9daee6e`) — the deferred "TransitionSeries split" stays deferred, but reorder-by-**span-swap** (sequences trade places, transitions stay put → alternation preserved) and insert-by-**clone-transition** (append a beat + a transition cloned from an existing one so its presentation import is satisfied) now work. This unblocked the showreel, which is a `<TransitionSeries>`.
- **Right-click clip context menu** (`9daee6e`→`4627a7b`) — reuses the canvas's shared `ContextMenuView` (one component, dark chrome tokens defined on the shell so it matches the canvas menu).
- **Clip layer decomposition** (`fd8fb9e`→`d0556b9`) — a clip that wraps a component (`<ClipShot clip={CLIPS[i]}>` → `<Video>` + `<LowerThird>`) decomposes into per-layer sub-rows (expanded by default), each media layer replaceable on its own; replace moves off the parent onto the sub-layers.
- **Show/hide (`toggleClipHidden`) LANDED** (`61786e9`) — the deferred item, solved the reversibility worry the plan raised: gate the clip's children behind `{false && (…)}` instead of a JSX comment — the tag + time slot stay (TransitionSeries alternation intact), it's Prettier/HMR-stable, and Show strips back to the byte-identical original.

**Still deferred:** mid-clip split, `<TransitionSeries>` split, per-sub-layer independent trim/move (layers share the parent Sequence's timing — would need each wrapped in its own `<Sequence>`), multi-select, `interpolate()` value editing.

## Retro

- **The debate's core finding recurred at a boundary it didn't name.** The BUILDER/SHIPPER/BREAKER debate correctly identified document-order addressing as broken across the two *tokenizers* — but the same class of bug bit again at the *client→engine* boundary (Player id vs artboard id) on a multi-comp canvas. Lesson for `/plan`: when a debate flags "two sources disagree on identity," enumerate *every* producer of that identity, including the UI ids, not just the two parsers.
- **`{false && (…)}` beats JSX comments for reversible hide.** The plan deferred show/hide partly because "JSX-comment reversibility fights Prettier/HMR reflow." A `{false && (children)}` gate sidesteps that entirely (valid JSX, formatter-stable, keeps the node's time slot so series alternation survives) — the deferral was over-cautious; the gate should have been the first idea.
- **Decompose-then-act needs the AST to resolve *through* wrapper components.** The granularity ask ("show video vs title separately") only worked once `collectClipLayers` resolved media through the wrapper component body + its array-fed `clip={CLIPS[i]}` call site. Grounding the layer rows in real resolution (not a shallow child scan) is what made per-layer replace land on the right `src`.
- **Reuse the shell's own components for parity.** The first context menu was hand-rolled and looked nothing like the canvas menu (white vs dark). Reusing the exported `ContextMenuView` + defining the chrome tokens fixed both look and the desktop-webview dismiss behavior in one move — the user's "why didn't you reuse it" was right.
- **Verification ceiling held.** Real-mp4 comps are flaky to render headless (footage decode); the reliable path was an Img-based decomposable comp for the UI checks + server-side `comp-clips` assertions against the real showreel + engine unit tests. Keep an Img fixture for timeline-UI e2e.
