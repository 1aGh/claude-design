# Feature: Canvas boot posture — respond to issue #93 (default tool / preview-edit toggle request)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **DECIDED 2026-08-14 — Option 3, boot=edit.** The owner (who is also the issue's
> reporter) reviewed this plan, DDR-187, and the debate record, and picked
> **Option 3** (first-class preview/edit mode) with **boot always into `edit`**
> (`move`/V armed). Recorded as **DDR-223** (supersedes DDR-187's boot-posture
> half; the browse/move tool split and the pass-through invariant stand). The
> implementation task list is at the bottom (§ Tasks — replaces the original
> "no implementation" placeholder). Options 1/2 below are kept as the decision
> record, not as open questions.

## Description

GitHub issue #93 asks Maude to boot the canvas into the `select` (Move, `V`) tool instead of today's `browse` tool, demote `browse` to a secondary tool, and — as the reporter's own preferred solution — replace the toolbar's discrete tools with a single **preview/edit** mode toggle: preview keeps artboards interactive and allows annotation, edit exposes CSS/property editing.

This is not a fresh design question. It is the exact fork the team already litigated and closed in **DDR-187** (`.ai/archive/decisions/DDR-187-figma-select-browse-move-split-and-boot-posture.md`, 2026-07-18, Accepted), which chose "boot alive (`browse`), press V to select" unanimously (3/3 debate seats) specifically to avoid every freshly opened mock being dead (buttons don't click, links don't follow) until the user finds an edit mode. That decision was then hardened through a real dogfood round (2026-07-19/20) with five follow-up fixes, including a **Cmd+click escape hatch in `browse`** that already answers "I clicked to edit, why do I need to press V first?" without requiring a mode switch.

This plan does not implement anything. It lays out the options for the repo owner, grounded in DDR-187 and the current architecture, so the owner can decide whether to reaffirm, patch, or reopen that decision.

## User Story

As a designer used to Figma, I want clicking an element to select it by default, so that I don't have to remember to press V before I can edit — **without** losing the "my mock is alive and clickable the moment I open it" guarantee that DDR-187 protects.

## Problem

Two related but distinct complaints are bundled in issue #93:

1. **Boot default**: the canvas boots into `browse` (click-through/alive), not `select`. A Figma user's muscle-memory plain click does nothing until they discover `V`.
2. **Toolbar shape**: the reporter's proposed fix is to replace today's flat, 12-tool palette (`browse`, `move`/select, `hand`, `comment`, `pen`, `highlighter`, `shape`, `sticky`, `section`, `arrow`, `text`, `eraser` — `apps/studio/use-tool-mode.tsx`) with a binary preview/edit mode toggle.

Both were already surfaced and decided against in DDR-187's alternative **A** ("Boot into `select` — regresses every native-input surface... All three debate seats rated this the higher-risk path").

## Solution — options for the owner

A divergent debate (builder / shipper / breaker) was run against this report. Builder proposed an ambitious redesign; shipper and breaker both converged on **not touching the boot posture or building a new mode**, citing that DDR-187 already exists, was dogfooded, and that reopening a unanimous, tested decision on the strength of a single issue (not telemetry) sets a bad precedent. The options below are laid out in that order of increasing risk/effort so the owner can pick.

### Option 1 — Do nothing structural; improve discoverability only (shipper/breaker consensus, lowest risk)

DDR-187 already ships a first-run hint (`apps/studio/client/app.jsx`, localStorage `maude-browse-hint-seen`: *"Your mock is live — click things to try it. Press V to select & edit like Figma"*) and a **Cmd+click-in-browse escape hatch** (selects the deepest element AND flips the tool to Move — added in the DDR's own 2026-07-19 addendum #3, precisely for "I clicked to edit"). Issue #93's reporter may simply not have discovered either.

- Confirm (e.g. via the reporter, or telemetry on hint-dismiss / V-adoption / Cmd+click-in-browse rates) whether the existing affordances already solve the complaint.
- If the hint is under-noticed, consider a louder one-time affordance (DDR-187 §Consequences already names this as the intended follow-up trigger: *"if telemetry ever shows users stuck in browse, a louder affordance is the follow-up, not a posture change"*).
- **No source changes to `use-tool-mode.tsx` / `input-router.tsx` / boot default.**

### Option 2 — Reopen DDR-187's boot-posture question with fresh evidence (moderate risk)

Only pursue if there's evidence beyond this one issue (support volume, telemetry) that the browse-boot posture is a recurring friction point. Would require:
- A new DDR superseding DDR-187, revisiting the boot-posture fork with current usage data.
- Re-validating the "dead mock on open" cost DDR-187 was written to avoid — that cost hasn't changed.
- Updating `browse-posture.test.tsx`, `input-router.test.ts` ("browse pure pass-through" table), `use-tool-mode.test.tsx` (asserts `data-tool="browse"` on boot).
- Retiring or rewriting the first-run hint copy and `maude-browse-hint-seen` migration.

### Option 3 — Build a first-class preview/edit mode (reporter's actual ask; builder's proposal; highest risk/effort)

Add a `mode: 'preview' | 'edit'` field alongside (not replacing) `tool` in `use-tool-mode.tsx`. `preview` mode = today's `browse` posture (pass-through, alive) plus annotation tools (`comment`, `pen`, `highlighter`, etc.) stay selectable — matching the reporter's explicit "in preview he can still add annotations." `edit` mode boots the full tool palette with `move` (V) as its default and remembers the last-used edit tool. `input-router.tsx`'s `classify()` gains a mode-level early-out so `preview` structurally cannot reach the marquee/resize/drag gates, replacing the current per-tool convention with one enforced gate. Toolbar UI becomes a visible binary switch plus a collapsible tool tray.

This is a genuine UX redesign, not a bug fix:
- Touches `apps/studio/use-tool-mode.tsx`, `apps/studio/input-router.tsx` (851 lines), the toolbar component (`tool-palette.tsx`, 601 lines), `READ_ONLY_TOOL_IDS` filtering (depends on both `browse` and `move` existing today), and `view.json` persistence.
- Requires re-verifying all five DDR-187 dogfood fixes (selection-echo suppression, camera-yank guard, Cmd+click escape hatch, layers-panel-without-selection, dblclick drill ladder) still hold under a mode model — none were designed against a toggle.
- Needs its own DDR, its own design pass (mockups / `/design:new`), and its own debate before implementation — this is a `/flow:plan` follow-up in its own right, not a task list to execute today.

## Metadata

- **Ticket**: #93 — "Change default tool to select, not browse" (GitHub, `1aGh/maude`)
- **Type**: Enhancement / re-litigation of an existing Design Decision Record
- **Complexity**: High (Option 3) / Low (Option 1) — owner must pick the option before a complexity-scoped plan can be written
- **App/Package**: `apps/studio`
- **Affected Systems**: canvas tool state (`use-tool-mode.tsx`), input routing (`input-router.tsx`), toolbar UI, first-run onboarding hint, read-only mode filtering
- **Dependencies**: none new

---

## Context References

### Must-Read Files

- `.ai/archive/decisions/DDR-187-figma-select-browse-move-split-and-boot-posture.md` — Why: the prior, unanimous, dogfooded decision this issue asks to reverse; read in full before deciding.
- `apps/studio/use-tool-mode.tsx` (boot default `initial='browse'`, `DEFAULT_TOOLS` registry, `READ_ONLY_TOOL_IDS`) — Why: where the boot default and tool registry live today.
- `apps/studio/input-router.tsx` (`classify()` dispatch) — Why: where browse/move posture is enforced per-tool; the blast radius for any mode-level change.
- `apps/studio/client/app.jsx` (lines ~373-425, first-run hint, `maude-browse-hint-seen`) — Why: the existing discoverability affordance Option 1 would tune.
- `apps/studio/test/browse-posture.test.tsx`, `apps/studio/test/input-router.test.ts`, `apps/studio/test/use-tool-mode.test.tsx` — Why: the regression fence protecting the current posture; any Option 2/3 work must keep or deliberately rewrite these.

### Design canvases

No `.design/` canvas matched this feature (no existing mockup of a preview/edit toggle exists in the design workspace). Option 3, if chosen, should start with a `/design:new` or `/design:edit` pass before implementation.

---

## Debate Record (informs the decision, does not replace it)

- **Builder** (confidence 0.55, verdict: advocate): proposed Option 3 — a first-class `mode` state, arguing it structurally enforces the alive-invariant instead of leaving it as convention. Explicitly flagged: *"this reopens a unanimous, dogfooded, hardened decision on a bug-report's say-so."*
- **Shipper** (confidence 0.9, verdict: advocate for Option 1): *"Ship nothing structural... At most, bump the existing first-run hint's visibility if telemetry ever shows people stuck."* Notes the Cmd+click escape hatch already answers the reporter's implicit ask.
- **Breaker** (confidence 0.8, verdict: block Options 2/3 absent new evidence): *"Any boot-posture change... re-breaks the exact regression DDR-187 was written to close... on the say of a single bug-report reclassified as a feature request, not the telemetry threshold the DDR itself set as the bar for reopening."*

**Consolidated read**: 2 of 3 seats recommend Option 1. The dissenting seat's own proposal (Option 3) rates its confidence at only 0.55 and names the same risk the other two seats block on. No seat recommends silently flipping the boot default (Option 2 without new evidence) or attempting Option 3 without a dedicated design/DDR pass.

---

## Tasks (Option 3, boot=edit — per DDR-223)

Design constraints carried from DDR-187 (still binding): `classify()` is NOT
touched; every `tool === 'move'` gate stays as-is; the browse pass-through
invariant tests stay verbatim. The mode is a store-level layer, enforced by the
mode⇄tool invariant (arming `move` implies `edit`, arming `browse` implies
`preview`; annotation tools are mode-neutral).

- [ ] **T1 — `use-tool-mode.tsx`: mode state.** `CanvasMode = 'preview' | 'edit'`;
      `MODE_DEFAULT_TOOL` map; context gains `mode`, `setMode` (arms the resting
      tool, clears sticky), `resetTool` (arms the current mode's resting tool);
      `setTool` auto-syncs mode for `move`/`browse`. Boot default flips to
      `initial='move'` + `initialMode='edit'`; read-only boots `preview`/`browse`.
- [ ] **T2 — `canvas-comment-mount.tsx`: pin the specimen posture.**
      `MaybeToolProvider` forwards `initial`/`initialMode`; `buildCanvasTree`
      passes `initial='browse'` so bare DS specimens keep today's alive posture
      and native cursors. (Requires a `dist/comment-mount.js` rebuild.)
- [ ] **T3 — reset-to-mode-default call sites.** `annotations-layer.tsx` T18
      post-commit flip + text-tool flips (5× `setTool('move')`) and the
      `canvas-shell.tsx` Esc handler go through `resetTool()`. The Cmd+click
      escape hatch (`canvas-shell.tsx` ~3211) stays `setTool('move')` — the
      auto-sync makes it a mode flip too, which is the intended semantics.
- [x] **T4 — `tool-palette.tsx`: Preview/Edit/Present segmented toggle** heading
      the palette; icon segments (lucide eye / pencil-ruler / presentation —
      owner steers 2026-08-15, see DDR-223 addenda 1+2), nav group
      `hand/comment` in both modes (the segments are the resting-tool
      affordances); Present = the existing shell-level enter-only state, moved
      in from the palette's right end; draw group in both modes; `+ Element`
      insert edit-only; clicking the active Preview/Edit segment re-arms the
      resting tool. `data-testid="palette-mode-{preview,edit,present}"`.
- [ ] **T5 — `client/app.jsx`: first-run hint** re-keyed to
      `maude-mode-hint-seen`, copy teaches Edit-boot + the Preview toggle;
      read-only branch keeps the alive-mock wording.
- [ ] **T6 — tests.** `use-tool-mode.test.tsx` boot assertions flip to
      edit/`move`; new tests: mode⇄tool invariant, `resetTool` per mode,
      read-only preview boot, active-segment re-arm. `browse-posture.test.tsx`
      + `input-router.test.ts` posture tables unchanged (assert they still pass).
- [ ] **T7 — artifacts.** Rebuild `dist/client.bundle.js` + `dist/comment-mount.js`
      release-minified (`MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`);
      `git status apps/studio/dist/` before/after `bun test` per the CLAUDE.md
      clobber rule. What's New entry (pending, version null). Roadmap regen.

---

## Acceptance Criteria

- [x] Owner has read this plan and DDR-187 and chosen one of Option 1 / 2 / 3 — **Option 3 + boot=edit, 2026-08-14 (DDR-223)**.
- [ ] A fresh (non-read-only) canvas boots in Edit with `move` armed; bare click selects the top-level object (Figma ladder unchanged).
- [ ] The palette shows a Preview/Edit toggle; Preview restores the alive mock (bare clicks pass through) while annotation tools remain usable; drawing in Preview returns to `browse`, never to `move`.
- [ ] V / Cmd+click-in-browse / Esc keep their DDR-187 semantics in Edit and additionally flip the visible mode coherently.
- [ ] Read-only canvases and bare DS specimens boot byte-identical to the DDR-187 posture (preview/`browse`).
- [ ] Browse pass-through invariant tests pass verbatim; suite green; committed bundles rebuilt release-minified.
