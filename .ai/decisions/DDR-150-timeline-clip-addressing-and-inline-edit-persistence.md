# DDR-150 — Timeline clip addressing (AST id + fingerprint + semantic gate) & inline-edit persistence

**Status:** Accepted — 2026-07-04 (BUILDER/SHIPPER/BREAKER debate → user-ratified "ambitious"; see § Debate record).
**Supersedes:** none. **Extends:** [DDR-148](DDR-148-video-comp-remotion-authoring-capture-export.md) (the shipped video-comp + Timeline + `retimeSequence` foundation this adds direct manipulation to), [DDR-103](DDR-103-phase-12-in-canvas-direct-edit.md) (the in-canvas inline-edit trust boundary — the escape rule is UNCHANGED; only failure-surfacing changes), [DDR-138](DDR-138-reused-component-reorder-and-phase-12.1-followups.md) (the `moveElement` structural-edit + re-select-through-id-churn precedent the clip ops mirror).
**Related:** [DDR-054](DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (source-write routes untrusted-to-canvas → main-origin-only), [DDR-088](DDR-088-canvas-media-vocabulary-and-asset-write-surface.md) (dual allowlist + capped asset write the media-drop reuses), [DDR-104](DDR-104-css-panel-ux-model.md) (the CSS-knob UX the P1 CSS hardening rides).
**Instruments:** `apps/studio/canvas-edit.ts` (the `enumerateClips` AST tokenizer + content-hash fingerprint + `assertCompSemantics` gate + cross-process lock; `removeSequence`/`insertSequenceIntoComp`; the P1 `applyTextEdit` widening), `apps/studio/client/panels/timeline-parse.js` (stops being the addressing authority — labels/positions only), `apps/studio/client/panels/TimelinePanel.jsx` + `apps/studio/client/app.jsx` (clip gestures + the inline-edit failure surfacing), `apps/studio/canvas-shell.tsx` (the optimistic-edit revert channel).

## Context

DDR-148 shipped the video-comp foundation — a Remotion `<Player>`, the `__maude_seek__` bridge, a bottom **Timeline panel** (transport + scrub + read-only rows + drag-the-right-edge-to-retime), the `canvas-edit.ts` source-patch engine, and capture-first export. The user asked for the **direct-manipulation editing layer**: drop media onto the timeline / canvas, move/trim/remove/replace/reorder clips, reliably hand-edit inline text + CSS, and assemble dropped clips into a comp. Use case: **AI generates a video/infographic, user hand-tunes the last mile.**

A divergent BUILDER/SHIPPER/BREAKER debate on the first-draft plan surfaced a **load-bearing defect the solo draft missed** — clip addressing was specced by document-order index, but there are **two tokenizers that disagree**:

- The **UI** parser scopes to **one comp's body** (`timeline-parse.js` — `scope = target.body`, ~116-131).
- The **engine** counts `<Sequence>` tags across the **whole file** (`canvas-edit.ts` `SEQ_TAG_RE` / `applyRetimeSequence`, ~845/889).

On a **multi-comp** canvas (exactly the AI-generated multi-artboard infographic this feature targets) **UI clip index N ≠ engine clip index N.** `retimeSequence` tolerates it today (wrong clip retimed = recoverable). The planned **destructive** ops (remove/split) would make it **irreversible wrong-clip corruption**, and the first draft's proposed hide-via-JSX-comment marker compounds it (a regex index counts the commented `<Sequence>`).

BREAKER's second cut: **parse-clean ≠ correct.** The reparse gate the draft leaned on cannot see a wrong-clip delete, an orphaned/double `<TransitionSeries.Transition>` (valid TSX, invalid Remotion), or timing drift; `withLock` is in-process only (the `/design:edit` CLI + HMR race); `escapeAttr` doesn't stop an `assets/../` traversal; JSX-by-concatenation on insert bypasses escaping.

## Decision

### 1. Clip addressing is a foundation — mandatory before any destructive op

- **One AST tokenizer.** `enumerateClips(source, artboardId)` in `canvas-edit.ts` walks the AST (reusing the `collectElements` component/jsxIndex bookkeeping), **scoped to the target comp body**, listing each clip with `{ stableId, from, durationInFrames, mediaTag, mediaSrc, contentHash }`, **skipping tags inside comments/strings** (the regex didn't). The UI's `timeline-parse.js` keeps drawing rows but **addresses ops by `stableId`**, never its own regex position. The shipped `retimeSequence` migrates onto this too (fixes the latent multi-comp retime mis-hit).
- **Stable identity** — prefer Remotion `<Sequence name="…">` (durable, human-facing, survives Prettier) → a pipeline-injected `{/* @mclip <id> */}` sentinel → else the AST-order index **within the scoped comp**, computed by the SAME enumerator the engine uses (so UI/engine never disagree even degraded). **Not a bespoke IR** (DDR-148's line holds): the TSX stays the single source; this is the positional-`data-cd-id` precedent (`computeId`, canvas-edit.ts ~65) made non-positional.
- **Content-hash optimistic-concurrency fingerprint.** Every structural op carries the target clip's expected `contentHash`; the engine recomputes from disk and refuses (409, actionable) on mismatch — guards a stale UI index AND a concurrent `/design:edit`/HMR write.
- **Semantic gate.** After the reparse gate, `assertCompSemantics` asserts `<TransitionSeries>` strict alternation (no leading/trailing/double `<Transition>`) + timing sanity for move/remove; refuse on violation. Parse-clean is necessary, not sufficient.
- **Cross-process lock.** Structural comp-file writes take an on-disk advisory lock (HTTP + CLI + HMR cannot interleave).
- **Security.** Source-write routes stay main-origin-only (absent from `CANVAS_SAFE_API` + `startCanvasServer` routes); `src` normalized + contained under `assets/` (reject `..`); the insert path builds JSX through `escapeAttr`, never raw concatenation; media tag ∈ {Video, Audio, Img}.

### 2. Mid-clip split & show/hide are DEFERRED behind the addressing + semantic gate

- **Split** — `<Video startFrom>` seam math × const-preferring rewrites × TransitionSeries overlap is the highest risk-per-value; v1 approximates "cut" with the shipped two-edge trim. True split is the first fast-follow once the semantic gate proves out.
- **Show/hide via JSX-comment marker** — the byte-identical round-trip fights Prettier/HMR reflow and any clip containing `*/`; **remove + one-undo covers v1.**

### 3. Inline-edit persistence (P1) — surface failures, widen the editable set; the escape rule is unchanged

Today an inline text/CSS edit that the engine refuses is only `console.warn`ed by the shell (`app.jsx` ~7143), leaving a stranded optimistic DOM change that silently reverts on the next HMR reload ("my text edit vanishes"). Fix:

- **Surface + reconcile** — a visible, actionable result on `{ok:false}` AND revert the optimistic edit immediately (mirroring the existing reorder-reject revert channel, `canvas-shell.tsx` ~2908) rather than hoping HMR agrees.
- **Widen `applyTextEdit`** — a single `{'string literal'}` child (`<h1>{'Title'}</h1>`) is now editable (rewritten via `JSON.stringify` → inert, correctly-escaped quoted string; no markup/entity injection surface because the value never leaves the `{…}`). Genuinely dynamic content (`{title}`, `` {`${n} items`} ``) is still refused — but routed to `/design:edit` instead of a dead end. The DDR-103 escape rule (`escapeJsxText` on the JSXText path) is unchanged; the new path can't inject because it stays a quoted JS string.
- **Robust CSS** — the class-styled insert branch + the frame-driven trailing-comma append (the fixed "CSS resets on replay" double-comma bug) are kept with regression tests.

## Consequences

- **`timeline-parse.js` is demoted** from addressing authority to a labels/positions view; the engine's `enumerateClips` is the single source of truth for "which clip." A test asserts UI-index == engine-clip across nested / `.map()` / multi-comp / commented fixtures.
- **A new "must-move-together" invariant** — the stable-id resolution (parser + engine + pipeline + the AI's own comp rewrites). Mitigated by degrade-to-scoped-AST-index (still UI/engine-consistent) + `<Sequence name>` as the durable human-facing half.
- **Cross-process lock is new surface** — the in-process `withLock` (canvas-edit.ts ~150) was insufficient once a second writer (CLI/HMR) exists.
- **Phasing (user-ratified "ambitious"):** P1 persistence → P2 addressing foundation → P3 lean clip ops (move/trim/remove/replace reuse the shipped engine) + shortcuts → P4 media intake + one-click assemble-refs → P5 z-order reorder + keyframe markers.

## Debate record (BUILDER / SHIPPER / BREAKER — 2026-07-04)

Divergent bookend debate (reduce tier — three parallel report-back seats grounded in the shipped code).

- **BREAKER (block-as-specced)** — the multi-comp two-tokenizer defect → irreversible wrong-clip delete; parse-clean ≠ correct (orphaned transition, timing drift are all parse-clean); `withLock` in-process only; `escapeAttr` misses `assets/../`; insert-by-concatenation bypasses escaping. Required guardrails = **§ Decision 1**.
- **SHIPPER (advocate)** — the core loop needs ~zero new ops (`retimeSequence` already patches `from`+`durationInFrames`; `editAttribute` already replaces `src`); only `removeSequence` (standalone) is unavoidable; **fix persistence first** (shipped trust bug, every canvas, nearly free); defer split/hide/insert.
- **BUILDER (advocate)** — address by stable id (`<Sequence name>`/sentinel) fixes the root bug AND unlocks features; pull the user's verbatim **assemble-refs → comp**, **z-order reorder** (reuse `applyMove`), and **keyframe click-to-seek** into v1.

**User ratification: "ambitious"** — persistence-first, mandatory addressing foundation, lean clip ops, plus assemble-refs + z-order + keyframe markers; mid-clip split & hide deferred behind the gate.

## Revisit when

- **Mid-clip split (`splitSequence`)** — once the semantic gate proves out; `<Video startFrom>` seam is the hard part.
- **Show/hide (`toggleSequenceHidden`)** — if remove+undo proves insufficient; needs a reflow-proof reversibility model.
- **Stable-id durability** — if Prettier/agent edits drop `<Sequence name>`/sentinels often, the degrade-to-scoped-index path is the safety net; watch churn.
- **`<TransitionSeries>` split**, **multi-select clip ops**, **`interpolate()` value dot-editing** — deferred (interpolate rewriting is the hard one).

## Linked

Plan: [`.ai/plans/feature-video-editing-robustness.md`](../plans/feature-video-editing-robustness.md).
