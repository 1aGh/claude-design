# DDR-223: Preview/Edit mode split — the toolbar gains a binary mode toggle, and the boot posture flips to Edit

**Status:** Accepted
**Date:** 2026-08-14
**Tags:** input-router, tool-mode, canvas, selection, figma-parity, ux, posture, toolbar
**Supersedes:** DDR-187 (boot-posture half only — the browse/move tool split, the select ladder, and the pass-through invariant all stand)

## Context

GitHub issue #93 (maude-report r-5b70f120, 2026-08-14) asks for the canvas to boot
with **select (V) as the default tool** and proposes a **preview/edit mode toggle**
in the toolbar: preview keeps artboards interactive and allows annotation; edit is
where selection and CSS/property editing live.

This directly reverses the boot half of **DDR-187** (2026-07-18), which chose
boot=`browse` ("mock is alive on open") unanimously. Two facts changed the calculus:

1. **The reporter is the product owner** — the same person who confirmed DDR-187's
   boot=browse posture on 2026-07-15. This is not a drive-by issue outvoting a
   dogfooded decision; it is the decision's own author revising it after a month of
   daily use.
2. **The DDR-187 discoverability mitigations were seen and found insufficient.** The
   report screenshot shows the first-run hint ("Your mock is live … Press V")
   visible on screen; the owner had also lived with the Cmd+click-in-browse escape
   hatch since the 2026-07-19 addendum. The friction is not "didn't know about V" —
   it is "editing is the primary activity, and it should not cost a keypress or a
   modifier every time a canvas opens."

The fix-bot's divergent debate (2026-08-14, builder/shipper/breaker) recommended
2-of-3 "do nothing structural" on the single-issue-vs-telemetry argument; the owner
was shown that record plus the regression this reintroduces, and explicitly picked
the mode-toggle build with **boot=edit** (AskUserQuestion, this session).

## Alternatives considered

- **Do nothing structural; louder onboarding (debate consensus).** Rejected by the
  owner: the hint was on screen in the report screenshot. Louder teaching of a
  posture the primary user doesn't want is not a fix.
- **Flip `initial='browse'` → `'move'` and stop (the literal one-liner).** Rejected:
  it delivers select-first but leaves the flat 12-tool palette as the only way back
  to the alive mock, with `browse` demoted to an unlabeled palette button. The
  posture pair deserves a first-class, visible affordance, and "preview keeps
  annotations" (the issue's explicit ask) needs a mode concept, not a tool swap.
- **Remember-last-mode boot (localStorage).** Offered; owner chose **always edit** —
  deterministic posture over adaptive. Revisit only with real demand.
- **Mode-level early-out inside `classify()`** (structural guard so preview can
  never reach the select/marquee gates). Rejected — it re-litigates DDR-187's
  "additive split, zero gate rewires" decomposition. The same guarantee falls out
  of the store invariant below: `move` cannot be armed while `mode='preview'`
  (arming it flips the mode), so every `tool === 'move'` gate stays untouched and
  unreachable in preview *by construction*, exactly as it is in `browse` today.

## Decision

1. **`mode: 'preview' | 'edit'` joins `tool` in the tool store**
   (`use-tool-mode.tsx`). Mode is a thin layer over the existing tool model — the
   DDR-187 tool split is untouched; `browse` remains the pure pass-through tool and
   `move` remains the select tool with the full Figma ladder.
2. **Mode⇄tool invariant, enforced in the store, not the router:** each mode has a
   *resting tool* (`preview`→`browse`, `edit`→`move`). `setMode(m)` arms the resting
   tool. Conversely `setTool('move')` implies `mode='edit'` and `setTool('browse')`
   implies `mode='preview'` — so every existing call site (V keydown, the menubar
   `tool-set` postMessage lane, the Cmd+click-in-browse escape hatch's
   `setTool('move')`) keeps working and now also moves the mode coherently.
   Annotation tools are **mode-neutral**: arming pen/comment/… changes the tool,
   not the mode — preview keeps annotations, per the issue's explicit ask.
3. **"Back to default" flips to the *mode's* resting tool.** The T18 post-commit
   auto-flip and the Esc handler used to hardcode `setTool('move')`; they now call
   `resetTool()` — in edit that is still `move` (byte-identical behavior), in
   preview it returns to `browse` so drawing an annotation never silently exits the
   alive posture.
4. **Boot = `edit` (tool `move`) for authoring surfaces** — `ToolProvider`'s
   default flips from `initial='browse'`. Carve-outs that keep today's posture:
   **read-only canvases** (cloud viewers) boot `preview` — a viewer's job is to use
   the live mock; and the **comment-mount layer's own provider instance**
   (bare DS specimens + the ancestor claim-layer) explicitly passes
   `initial='browse'`, so specimens stay alive with native cursors.
5. **The toolbar gains a Preview/Edit segmented toggle** at the head of the palette,
   replacing the `browse` and demoting nothing else: nav group is
   `move/hand/comment` in edit, `hand/comment` in preview; draw tools show in both
   modes; the `+ Element` insert (a JSX write) is edit-only; export/present/stickers
   stay in both. Clicking the *active* segment re-arms the mode's resting tool (the
   "get me out of the pen tool" gesture in preview). Toggle buttons carry
   `data-testid="palette-mode-preview"` / `"palette-mode-edit"` for desktop e2e.
6. **The pass-through invariant remains the load-bearing regression fence.**
   `browse-posture.test.tsx` and the `input-router.test.ts` posture tables are kept
   verbatim (classify() is untouched). New store tests pin the mode⇄tool invariant
   and the boot posture; the boot assertions in `use-tool-mode.test.tsx` flip to
   edit/`move`.
7. **First-run hint re-keyed and rewritten** (`maude-mode-hint-seen`): it now
   teaches the opposite direction — "You're in Edit — click selects. Switch to
   Preview to use the live mock." Every existing user sees the new hint once (the
   old `maude-browse-hint-seen` marker taught a posture that no longer boots).
   Read-only sessions keep the alive-mock wording.

## Consequences

- **A freshly opened mock no longer responds to bare clicks** until the user
  switches to Preview — the exact regression DDR-187 was written to avoid, now
  accepted knowingly by the same decision-maker, with the mitigation that the way
  back is a single always-visible toggle (not a buried tool or a keypress to
  discover).
- Existing muscle memory (V, Cmd+click escape hatch, Esc) behaves identically in
  edit mode; in preview those gestures now also flip the visible mode.
- Read-only viewers and bare DS specimens are byte-identical to the DDR-187
  posture.
- The two-bundle ToolProvider duplication (comment-mount vs canvas-lib) means the
  ancestor provider can rest in `browse` while the inner one boots `move`; the only
  observable artifact is that the boot cursor is the native arrow until the first
  tool interaction (the Kenney move glyph appears from then on). Accepted — Figma's
  select cursor *is* the default arrow.
- If real-world use shows "always edit" is wrong for second-screen/present-style
  usage, the remember-last-mode variant is the designated follow-up (a localStorage
  read in the same `initialMode` seam), not another posture re-litigation.

## Addendum (2026-08-15) — first review round

Owner steer on the toggle's form: **icon segments, not text labels.** The glyphs
are lifted from the tools each mode rests on — `IconBrowse` (pointing hand) for
Preview, `IconMove` (selection arrow) for Edit — so the toggle inherits the
identity of the buttons it replaced. Consequence: the separate **Select (move)
button leaves the edit nav group** — a second identical arrow right next to the
Edit segment would be noise; the Edit segment IS the select affordance (clicking
the active segment re-arms `move`, V and Esc unchanged). Nav group is therefore
`hand/comment` in both modes; the words moved into `aria-label` + `title`.

## Addendum 2 (2026-08-15) — second review round: dedicated glyphs + Present joins the toggle

Two further owner steers, superseding addendum 1's glyph choice:

1. **Dedicated mode glyphs, not tool glyphs** — lucide `eye` (Preview) and
   `pencil-ruler` (Edit), redrawn in the house 24×24/1.75-stroke icon language.
   A mode is a *way of looking at the canvas*, not a recalled tool, so reusing
   the browse/move tool icons conflated the two vocabularies (and the reused
   `IconMove` was the reason addendum 1 had to drop the Select button — the
   duplicate-arrow problem dissolves with a dedicated glyph, but the Select
   button stays dropped: the segment remains the resting-tool affordance).
2. **Presentation becomes the toggle's third segment** (lucide `presentation`;
   the existing `IconPresentation` redrawn to match). It stays a SHELL-level
   state exactly as before — enter-only via `dgn:'present-enter'`, exit via
   Esc/floating pill, NOT a `use-tool-mode` mode — but its entry point moves
   from the palette's right end into the toggle, so all three "ways of looking"
   (Preview / Edit / Present) live in one control. The standalone right-end
   presentation button is removed.
