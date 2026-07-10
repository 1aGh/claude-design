# Feature: Unified text editing across artboards, canvases, and annotations

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. Every behavioral claim in this plan was **measured in the real WKWebView** via the desktop-e2e harness (see Context) — do not "fix" what the baseline shows already works, and do not trust Chromium (agent-browser) for any caret/hit-test behavior.

## Description

Make every editable text surface in the Maude canvas behave like one predictable WYSIWYG editor — click to place a caret, type, select normally, Enter to confirm, Shift+Enter for a newline — with a **visible blinking caret** and **no overlap/ghosting**, identical whether the user is editing an **artboard element's text**, an **annotation shape's text**, a **sticky note**, a **standalone text-tool annotation**, or a **section title**. Today these are four+ separate editors with divergent behavior and WebKit-specific breakage.

## User Story

As a designer editing text on the Maude canvas, I want to click and type (or select) exactly like I would in any other WYSIWYG tool — see where my caret is, see it blink, see what I'm adding — so that text editing feels smooth, predictable, and bug-free no matter which kind of text I'm touching.

## Problem

Verbatim user report (Czech), across **artboard element text AND annotations**:
1. **Caret doesn't blink anywhere** — only a static line is visible.
2. **Caret look is inconsistent** across artboard / shape / sticky / text-tool / section-title; the **text-tool leaves a ghost** and doesn't edit the original.
3. Keyboard is inconsistent — need **Enter = commit, Shift+Enter = newline everywhere**.
4. **Double-click selects all**, and a subsequent click doesn't place the caret at the click point.
5. **Text tool (T)**: clicking empty space to add new text works; clicking **existing** editable text (artboard OR annotation) to edit it in place **does not**.
6. **Persistence bug**: type into an artboard text, it looks saved, but after ⌘R it vanishes — or shows "element … has dynamic content — edit it via /design:edit."
7. Overarching: the user must **always see where the caret is, where/how they're editing, and what's being added**, with nothing overlapping — unified across every text field.

### What the real-WKWebView baseline already established (measured 2026-07-09)

- ✅ The **artboard editor** (`canvas-shell.tsx`) already places a **collapsed caret at the click point** (`selCollapsed: true`) — NOT select-all — and my earlier caret-color fix **renders the accent caret in WebKit** (`caretColor: oklch(0.68 0.18 268)`). So caret-at-click + caret-color are SOLVED for the artboard; the select-all complaint (#4) is specific to the **annotation editors**.
- ❌ The **annotation editors** (`TextEditor`/`StickyEditor`/`StandaloneTextEditor`/`SectionTitleEditor`) all `selectNodeContents` on mount (select-all) and live inside an SVG `<foreignObject>` under the transformed `.dc-world`.
- 🔑 **Root cause of #2/#4/#5-ghost**: this codebase already documented that `<foreignObject>` content under a transformed ancestor mis-hit-tests clicks "at most zoom levels" and fixed it for the media players by rendering **plain HTML in the world div** (`MediaRefPlayers`, `annotations-layer.tsx:~3546`). The annotation text editors never got that treatment.
- 🔑 **Root cause of #1 blink**: native caret blink can freeze under a transformed/composited ancestor in WebKit; a prior `translateZ(0)` "fix" made it worse (removed). Blink is temporal — **no automated tool can assert it** — so the robust, verifiable answer is a **custom CSS-animated caret** (works identically in every engine; assertable by the presence + `animationName` of the caret element).
- 🔑 **Root cause of #6**: the shell offers inline edit whenever the DOM looks like leaf-text, but `foo {x} bar` renders as ONE text node yet is *mixed* in source, so `applyTextEdit` refuses it. A **build-time editability marker** (`data-cd-editable`) closes this — `transpileCanvasSource` already has the AST when it stamps `data-cd-id`. There is ALSO an unexplained side effect to run down: editing the fixture `<h1>` silently rewrote the neighboring `<p>`'s whitespace.

## Solution

**One behavior, reached by two mechanisms that already exist in the codebase**, plus a shared caret primitive:

1. A **shared custom blinking-caret utility** mounted on *any* `contentEditable` (the artboard's live DOM node AND the annotation editors' divs). Engine-independent (`caret-color: transparent` + a CSS-animated `[data-maude-caret]` element positioned at the live selection rect). This guarantees a visible, identical, blinking caret everywhere and makes blink **verifiable** in the harness.
2. **Convert the four annotation editors from `<foreignObject>` to plain HTML in the world div** (the proven `MediaRefPlayers` pattern) so clicks hit-test correctly → caret-at-click + text-tool click-through + no ghost, by construction.
3. **Caret-at-click on entry** for the annotation editors (mirror the artboard's `caretRangeFromPoint`) instead of select-all.
4. **Text tool** hit-tests annotation strokes (`[data-id]`), not just artboard elements (`[data-cd-id]`), and enters their editor in place.
5. **Build-time `data-cd-editable`** marker so inline edit is only offered where it will actually save (fix #6), + run down the sibling-rewrite side effect.
6. Keyboard (Enter=commit / Shift+Enter=newline) is **already unified in source** (this session) — verify it in WKWebView and keep it.
7. **Every phase is verified in the real WKWebView** via the desktop-e2e harness using synthetic events dispatched inside the same-origin canvas iframe (native WebDriver input does NOT penetrate the iframe — measured). Blink/feel gets a final **user visual confirmation** in their running `pnpm dev:desktop`.

## Metadata

- **Type**: Refactor (cross-cutting, WebKit-correctness)
- **Complexity**: High
- **App/Package**: `apps/studio` (canvas runtime) + `apps/desktop/e2e` (verification harness)
- **Affected Systems**: annotation editing layer, artboard inline-edit, canvas build/stamp pipeline, canvas-edit persistence, text-tool routing, desktop-e2e harness
- **Dependencies**: none new. Reuses `caretRangeFromPoint`/`caretPositionFromPoint`, `createPortal`-into-`worldRef` (MediaRefPlayers), `@wdio/tauri-service@1.1.0` (already pinned).

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `apps/studio/annotations-layer.tsx` — the four annotation editors + their foreignObject wrappers + mount `selectNodeContents`:
  - `TextEditor` (anchored/shape text) `:3649`; `selectNodeContents` `:3697`; keydown `:3760`
  - `StickyEditor` `:3796`; `selectNodeContents` `:3842`
  - `StandaloneTextEditor` (text-tool + section body) `:3904`; `selectNodeContents` `:3973`; commit-on-outside-click `:3974`
  - `SectionTitleEditor` (wraps StandaloneTextEditor, `singleLine`) `:4607`
  - editor render block + read-render suppression (`editingStickyId`/`editingSectionId`/`editingAnchoredTextId`) `:3335`–`:3531`
  - `CARET_FIX_STYLE` (caret-color only now; translateZ removed) `:3639`
  - **`MediaRefPlayers` — the plain-HTML-in-world precedent + WHY** `:~3546` (read the docblock — it is the architectural template for Phase 2)
  - text-tool handler + `findEditableElementAt` (artboard-only today) `:419`, `:1560`
  - stroke SVG nodes carry `data-id={stroke.id}` + `data-tool` (`:4715`, `:4759`, `:5017`) — the hit-test hook for Phase 4
- `apps/studio/canvas-shell.tsx` — the artboard inline editor (the GOOD reference: plain HTML, caret-at-click, Enter=commit): `enterEditModeAt` `:2254`, `caretRangeFromPoint` `:2272`, keydown `onKey` `:2189`, `.dc-text-editing` CSS + unified `caret-color` `:325`, the edit→edit-text postMessage + revert `:2204`–`:2358`
- `apps/studio/canvas-edit.ts` — `applyTextEdit` + the dynamic/mixed rejection (source of the #6 toast) `:464`, `:508`, `:520`, `:525`
- `apps/studio/canvas-build.ts` — `transpileCanvasSource` / pass-1 `data-cd-id` injection (has the AST → can stamp `data-cd-editable`) `:94`
- `apps/studio/client/app.jsx` — the shell side of the edit round-trip (`edit-text` → `/_api/edit-text` → `edit-reverted`) `:8305`–`:8330`
- `apps/studio/inspect.ts` — iframe→shell key forwarder (unrelated but adjacent; already fixed this session for ⌘⇧T)
- `apps/desktop/e2e/scenarios/canvas-text-editing.e2e.ts` — the WKWebView scenario (exists; currently a diagnostic — evolve it into the verification suite)
- `apps/desktop/e2e/helpers/canvas-frame.ts`, `helpers/evidence.ts`, `wdio.conf.ts` (`MAUDE_CANVAS_ORIGIN_SPLIT=0`, `embeddedPort: 4455`)
- `.claude/skills/desktop-e2e/SKILL.md` — harness rules + gotchas (tauri-service 1.1.0 pin; awake-screen; sidecar cleanup)
- DDRs to read: `DDR-054` (canvas-origin trust), `DDR-103` (inline text edit), `DDR-150` (edit-revert / persistence), `DDR-021`/`DDR-068` (smoke), and the memory `reference_foreignobject_under_transform_breaks_carets_and_clicks`.

### Files to Create

- `apps/studio/text-caret.ts` — the shared custom blinking-caret utility (`mountCaret(editable, win) → dispose`), engine-independent, reused by artboard + annotation editors.
- `.ai/scenarios/canvas-text-editing/spec.md` — committed spec for the WKWebView scenario (mirror `app-boots-and-renders-canvas/spec.md`).
- (maybe) `apps/studio/test/text-editability-stamp.test.ts` — unit test that `transpileCanvasSource` stamps `data-cd-editable` correctly for static vs mixed vs expression text.

### Design canvases

Not applicable — this is canvas-runtime engine behavior, not a `.design/` mockup. (The `.design/ui/*.tsx` canvases are the *content* being edited, not the feature surface.)

### Patterns to Follow

- **Plain-HTML-in-world editor** — copy `MediaRefPlayers` exactly: `createPortal(<div style={{position:'absolute', left:x, top:y, width, height, …}}>…</div>, worldRef.current)`. World coords map 1:1 into the div because `.dc-world` carries the pan/zoom transform. `[data-mediaref-player]`-style attr keeps document-capture handlers out.
- **Caret-at-click** — copy `enterEditModeAt` (`canvas-shell.tsx:2254`): `caretRangeFromPoint(x,y)` → `caretPositionFromPoint` fallback → `selectNodeContents` only as last resort.
- **Unified keydown** (already in source) — `if (e.key === 'Enter' && !e.shiftKey) { commit(); }`, Shift+Enter falls through, ⌘/Ctrl+Enter keeps its chain-create.
- **Build-time stamp** — mirror the `data-cd-id` injection walk in `transpileCanvasSource`; reuse the exact "single static JSXText" test from `applyTextEdit` (`meaningful.length === 1 && only.type === 'JSXText'`) so the marker and the engine can never disagree.

---

## Design Decisions

### Custom caret vs native caret (the core call)

- **Chosen: a custom CSS-animated caret for ALL surfaces.** Rationale: native caret blink under the transformed world is (a) unverifiable by any automated tool and (b) demonstrably fragile in WebKit. A custom caret guarantees a visible blink everywhere, makes it **harness-assertable** (element present + `animationName !== 'none'` + positioned at the selection rect), and unifies the caret's look by construction. `caret-color: transparent` hides the native one.
- *Rejected*: native-caret-only + more CSS tweaking — leaves blink unverifiable and engine-fragile (already burned two rounds on this).
- *Rejected*: a shared React `<TextEditor>` component for BOTH artboard and annotations — the artboard edits a **live DOM node in place** while annotations edit a **data model** via React; forcing one component is a worse abstraction than a shared *caret* + shared *behavior helpers*. The unification is behavioral, not a single component.

### foreignObject → plain HTML in world (annotation editors)

- **Chosen: convert.** It is the proven in-repo fix (`MediaRefPlayers`) for the exact bug (clicks miss foreignObject content under transform), and it is what makes caret-at-click + text-tool click-through correct *by construction* rather than by hoping `caretRangeFromPoint` behaves inside a foreignObject.
- Risk: positioning/zoom/read-render-suppression/toolbar/outside-click-commit must be preserved — mitigated by mirroring `MediaRefPlayers` and keeping the existing suppression ids + `dc-annot-ctx` toolbar guard.

### Persistence: build-time `data-cd-editable`

- **Chosen: stamp at transpile.** The AST is already parsed for `data-cd-id`; marking "single static JSXText" elements is cheap and authoritative. The shell then only offers inline edit on `[data-cd-editable]` leaf text → the user never types into a dead end (fix #6). Non-editable text still edits via `/design:edit`/chat (unchanged).
- Also in-scope: reproduce + fix the **sibling-`<p>`-rewrite** side effect observed in the baseline (editing one element must never rewrite another).

### Tokens / cursor

- Caret color: `var(--maude-hud-accent)` (already unified + WebKit-confirmed). Hover affordance: `cursor: text` on editable leaf text (already present for `[data-cd-id]`; extend to annotation editors). No new tokens.

---

## Tasks

Execute in order. Each phase ends with a **real-WKWebView e2e verification** (build the `--debug` test app once per phase that changes canvas-runtime source, then run the scenario). Native WebDriver input can't reach the canvas iframe — **drive via synthetic events dispatched inside the same-origin iframe** (see the diagnostic scenario for the pattern), and clean up stale e2e sidecars (`pkill maude-server --root …/e2e/fixtures`) between runs.

### Phase 0 — Verification backbone (do first) — ✅ DONE 2026-07-09 (suite: 2 passing / 6 phase-TODOs skipped; annotations seed lives at designRoot root `ui-smoke.annotations.svg`, NOT sibling)

**Task 0.1: HARDEN the e2e text-editing scenario.** Evolve `canvas-text-editing.e2e.ts` from a diagnostic into an asserting suite driven by synthetic events (same-origin `iframe.contentDocument` reach from the top frame — robust against the post-build hot-reload that invalidates `switchFrame`). Assert, per the CURRENT baseline: edit-mode entry, `caretColor` = accent, `selCollapsed` on the artboard. Leave TODO assertions (skipped) for the not-yet-built behaviors so the suite documents the target.
- **Gotcha**: pass **iframe-local** coords to synthetic `caretRangeFromPoint`/MouseEvents (the h1's rect inside the iframe, NOT top-viewport) — the diagnostic mixed these up.
- **Validate**: `pnpm test:e2e:desktop:build` (once) → `pnpm exec wdio run ./wdio.conf.ts --spec ./scenarios/canvas-text-editing.e2e.ts` green.

**Task 0.2: ENRICH the fixture** `apps/desktop/e2e/fixtures/project/.design/ui/Smoke.tsx` so the scenario can exercise every surface without native drawing: add `data-testid`s to the editable h1/p; add a **mixed-content** element (`<p>Total: {1 + 1} items</p>`) for the #6 persistence test; add a pre-seeded `Smoke.annotations.svg` with **one sticky + one standalone text stroke** so annotation editing is reachable by dispatching a synthetic dblclick on `[data-id=…]` (no draw gesture needed). Keep the canvas static/deterministic.
- **Gotcha**: the fixture must stay OFFLINE (no git remote) per the harness gotcha; annotations.svg is versioned state, safe to commit.
- **Validate**: scenario can `querySelector` the sticky/text strokes + the mixed `<p>` inside the iframe.

### Phase 1 — Shared custom blinking caret — ✅ DONE 2026-07-09 (rAF-loop positioning supersedes the discrete listener set; e2e asserts caret element + `maude-caret-blink` + position in h1 + native caret transparent; gotcha: kill stale fixture sidecars between e2e runs — a leaked server serves STALE staged sources)

**Task 1.1: CREATE `apps/studio/text-caret.ts`.** `mountCaret(editable: HTMLElement, win: Window): () => void`. Sets `editable.style.caretColor = 'transparent'`; creates a `<span data-maude-caret>` (position:absolute, 1–2px wide, `background: var(--maude-hud-accent)`, `@keyframes maude-caret-blink` steps opacity 1→0→1 ~1s, honoring `prefers-reduced-motion` → no blink but still visible); repositions it on `input`/`keyup`/`selectionchange`/`pointerup`/`scroll` from `win.getSelection().getRangeAt(0).getClientRects()` (or a zero-width range rect); hides when the editable loses focus; returns a disposer that removes the element + restores `caret-color`. Inject the keyframes once (guard by id) like `ensureHaloStyles`.
- **Pattern**: caret element lifecycle mirrors `ensureHaloStyles` + the HUD token injection.
- **Gotcha**: an empty editable has no rect — fall back to the editable's own client rect + padding (reuse the JUMP_SENTINEL trick already in `annotations-layer.tsx` for empty flex-centered boxes).
- **Validate**: unit-render is hard (DOM); rely on Phase-1 e2e.

**Task 1.2: WIRE the shared caret into the artboard editor.** In `canvas-shell.tsx` `enterEditModeAt`, call `mountCaret(stamped, window)`; dispose in `teardown`. Keep the existing `caretRangeFromPoint` placement.
- **Validate (e2e, real WKWebView)**: after synthetic dblclick on the fixture h1, assert `[data-maude-caret]` exists, `animationName` includes `maude-caret-blink`, and it sits within the h1's rect. Screenshot `artboard-custom-caret`.

### Phase 2 — Annotation editors → plain HTML in the world div — ✅ DONE 2026-07-09 (new `AnnotEditors` portal beside the SVG portal; 3 editors converted (section = wrapper); BONUS: standalone-text read-render suppression added — it never existed, the pre-existing double-paint ghost; e2e green at 2 zooms; 230 annotation unit tests pass)

**Task 2.1: REFACTOR the four annotation editors off `<foreignObject>`.** Replace each editor's `<foreignObject x y w h><div>` with an absolutely-positioned `<div style={{position:'absolute', left, top, width, height, …}}>` portaled into `worldRef.current` (mirror `MediaRefPlayers`). Preserve: the existing per-editor styles (`stickyBodyStyle`, section chip box, standalone box), `dc-annot-editor` class, `data-maude-caret`-friendly structure, and a `[data-annot-editor]` attr so document-capture handlers skip it (mirror `[data-mediaref-player]` + `isMediaPlayerTarget`).
- **Pattern**: `MediaRefPlayers` (`annotations-layer.tsx:~3546`) — the worldRef portal + absolute positioning in world coords.
- **Gotcha**: the read-render suppression (`editingStickyId`/`editingSectionId`/`editingAnchoredTextId`, `:3335`) MUST still hide the underlying SVG stroke while its HTML editor is up — verify no double-paint. The edit-toolbar (`.dc-annot-ctx`) and outside-click commit must still fire (they key off `document` pointerdown, unaffected by the host swap).
- **Gotcha**: zoom — the world div carries the transform, so world coords map 1:1; do NOT counter-scale (unlike the old foreignObject which relied on SVG user-space). Section title's existing `1/zoom` counter-scaling must be re-derived for the HTML host.
- **Validate (e2e)**: at zoom 1.0 AND a zoomed-in/out level, synthetic dblclick on the seeded sticky + text strokes enters an editor that is plain HTML (`tagName` DIV, not inside `<foreignObject>` — assert `closest('foreignObject') === null`), positioned over the stroke, no ghost/duplicate. Screenshots per surface + zoom.

### Phase 3 — Caret-at-click for annotation editors — ✅ DONE 2026-07-09 (shared `placeCaretAt` in text-caret.ts, canvas-shell refactored onto it; `useEditorCaret` hook = focus + caret-at-entry-point + mountCaret + pointerup click re-placement; keyboard entry keeps select-all; TWO harness learnings: camera state persists across runs → delete `_canvas-state` + fit + settle before hit-tests, and WKWebView pauses rAF for occluded windows → caret positioning is sync + event-driven + rAF, never rAF-only)

**Task 3.1: REPLACE select-all with caret-at-click on entry.** Thread the entry click coords (from the double-click / text-tool click that opened the editor) into each editor; on mount, place the caret via `caretRangeFromPoint` (fallback chain identical to `enterEditModeAt`) instead of `selectNodeContents`. Add `mountCaret(...)` to each editor. Add an explicit `onPointerDown` that re-places the caret via `caretRangeFromPoint(e.clientX,e.clientY)` so repositioning never depends on flaky native behavior.
- **Gotcha**: entry coords must reach the editor — extend the `setEditingId`/`pendingText` paths to carry a `caretPoint` (or read the last pointer event). Keep ⌘A (select-all) working natively for "replace everything."
- **Validate (e2e)**: synthetic dblclick at a known offset on the sticky/text → `selCollapsed === true` AND `selAnchorOffset` matches the clicked character (± tolerance); a second synthetic click at a different offset moves the caret there. Confirms #4/#6-click.

### Phase 4 — Text tool click-through onto existing text (artboard AND annotations) — ✅ DONE 2026-07-09 (DEVIATION: stroke hit-test is GEOMETRIC (`findTextStrokeAt`, world-bbox walk topmost-first), not elementsFromPoint — armed-tool stroke nodes render pointer-events:none and are invisible to DOM hit-testing (measured); section matches only on its label chip; anchored text skipped (host bbox covers it); e2e green)

**Task 4.1: EXTEND the text-tool click handler** (`annotations-layer.tsx:1560`). Before creating a new standalone text, hit-test via `document.elementsFromPoint`: (a) an artboard `[data-cd-id]` leaf-text (existing `findEditableElementAt` → dispatch `maude:enter-text-edit`), OR (b) an annotation stroke `[data-id]` whose `data-tool` is `text`/`sticky`/`rect`/`ellipse`/`polygon`/`section` → `setEditingId(strokeId)` with the click coords. Only fall through to a NEW standalone text on a genuine empty-space click.
- **Pattern**: `findEditableElementAt` (`:419`) — extend to also match `[data-id]` stroke nodes; strokes already expose `data-id`+`data-tool` (`:4715`,`:4759`,`:5017`).
- **Gotcha**: the layer's own input-capture div sits on top → `elementsFromPoint` (not the event target) is required (already the pattern). Precedence: artboard element vs annotation stroke when overlapping — deepest/topmost wins (document order from `elementsFromPoint`).
- **Validate (e2e)**: with the Text tool armed (dispatch the tool-set), a synthetic click on the seeded sticky enters ITS editor (no new stroke created — assert stroke count unchanged); a click on empty space DOES create a new one. Confirms #5 + kills the ghost (#2).

### Phase 5 — Keyboard unification (verify + lock) — ✅ DONE 2026-07-09 (verified in real WKWebView on all 4 surfaces; fixture gained a seeded section `s_e2esection1`; commits write through to disk → suite snapshots + restores fixture files byte-exact in before/after; live sticky read body is `.dc-sticky-body` class, NOT the persisted `[data-sticky-body]` attr)

**Task 5.1: VERIFY the already-unified keyboard in WKWebView.** (Source already does Enter=commit / Shift+Enter=newline across editors + artboard; ⌘/Ctrl+Enter keeps chain-create.) Add e2e assertions: synthetic `keydown Enter` (no shift) on each editor → commits (contenteditable removed / stroke text updated); `Shift+Enter` → inserts `\n` (text grows a line, editor stays open); section title → Enter commits, no newline.
- **Gotcha**: synthetic `keydown` triggers the app handlers, but native text INSERTION needs `execCommand('insertText')` or a dispatched `beforeinput` — insert via the contentEditable API in the probe, then assert commit behavior.
- **Validate (e2e)**: the three keyboard assertions pass on artboard + sticky + text + section.

### Phase 6 — Persistence (the #6 bug + the sibling-rewrite side effect) — ✅ DONE 2026-07-09 (stamp in pipeline mirrors applyTextEdit incl. the DDR-150 `{'literal'}` case; gate in shell dblclick + text-tool path with hint toast; handoff `stripDataCdId` extended to strip the new marker; Task 6.3 verdict: applyTextEdit is CLEAN — unit + real-fixture repro change exactly 1 line — the baseline's "sibling rewrite" was a native-key spillover committing the `<p>` itself (JSX whitespace-collapse on an actual edit of that element); e2e guards sibling byte-integrity on disk; NOTE: pipeline changes live inside the compiled sidecar → e2e needed a `bun run build.ts --release --target` + sidecar swap, not just the staged-resource cp)

**Task 6.1: STAMP `data-cd-editable` at build time.** In `transpileCanvasSource` (`canvas-build.ts`), during the same AST walk that injects `data-cd-id`, add `data-cd-editable="text"` to elements whose children are exactly one static `JSXText` (reuse `applyTextEdit`'s `meaningful.length===1 && only.type==='JSXText'` test verbatim). 
- **Validate**: unit test (`text-editability-stamp.test.ts`) — static `<h1>Hi</h1>` gets the marker; `<p>Total {n}</p>` and `<p>{title}</p>` do not.

**Task 6.2: GATE inline-edit entry on `data-cd-editable`.** In `canvas-shell.tsx` `onDbl`/`enterEditModeAt`, only enter edit mode when the target carries `data-cd-editable` (replace the DOM-level `isLeafText` heuristic that disagrees with the AST). On a non-editable leaf-text double-click, show a one-line hint ("Edit this text via chat / /design:edit") instead of a dead-end editor.
- **Gotcha**: keep the `edit-reverted` path (`:2345`) as defense-in-depth for anything that still slips through.
- **Validate (e2e)**: synthetic dblclick on the fixture's mixed `<p>` (`Total: {1+1} items`) does NOT enter edit mode (no contenteditable) and surfaces the hint; dblclick on the static h1 DOES; after committing a static edit + reopening the canvas, the new text persists AND no sibling element's text/whitespace changed.

**Task 6.3: RUN DOWN the sibling-rewrite side effect.** Reproduce (baseline showed editing the fixture `<h1>` rewrote the `<p>`'s whitespace) and fix so a text commit only ever rewrites the targeted element's own JSXText span. Likely in `applyTextEdit`'s MagicString overwrite range or the cd-id→source-span mapping.
- **Validate (e2e + unit)**: a `applyTextEdit` unit test asserts sibling spans are byte-identical after an edit; the e2e persistence step asserts the same on-canvas.

### Phase 7 — Visual unification + smoke — ✅ Task 7.1 DONE 2026-07-09 (text-stroke hover I-beam added; caret identical by construction; `/design:smoke` full sweep 58/58 OK, every PNG read per DDR-021; final e2e 8/8) · ⏳ Task 7.2 = USER visual gate (checklist in the execute report — blink/feel in `pnpm dev:desktop`)

**Task 7.1: UNIFY hover + look.** Ensure `cursor: text` on hover for every editable surface (extend the existing `[data-cd-id]:not(:empty):not(:has(>*)):hover` rule to annotation editors); confirm caret color/width read identically. No overlap: the editor host fully covers + suppresses the read-render (verified in Phase 2).
- **Validate**: `/design:smoke` on the studio (design-infra change) + read every PNG (DDR-021); the 5-surface e2e screenshots reviewed side by side.

**Task 7.2: USER visual confirmation of blink/feel.** Blink and "feel" are temporal/subjective — after the harness is green, hand the user a checklist to confirm in their `pnpm dev:desktop`: caret blinks on all 5 surfaces; click-to-place feels right; T-click edits in place; Enter/Shift+Enter; type→persist across ⌘R. This is the acceptance gate the harness cannot fully cover.

---

## Validation

Per the repo (no global lint/typecheck gate for canvas runtime beyond Biome; DDR-026 tsc baseline). Run:

1. **Static**: `pnpm lint` (Biome, exit 0) + `pnpm format`; `bun build` sanity on each edited `.tsx`/`.ts`.
2. **Unit**: `cd apps/studio && bun test` — new `text-editability-stamp.test.ts` + `applyTextEdit` sibling-integrity test + the existing annotation/read-annotations suites stay green.
3. **Real-WKWebView e2e (the primary gate)**: `pnpm test:e2e:desktop:build` then `pnpm exec wdio run ./wdio.conf.ts --spec ./scenarios/canvas-text-editing.e2e.ts` — all phase assertions pass on artboard + shape + sticky + text-tool + section, at ≥2 zoom levels. Clean up stale e2e sidecars between runs; screen must be awake.
4. **Design smoke**: `/design:smoke` (studio is a design-infra change) — read every PNG.
5. **Rebuild committed bundles**: after any `client/**` change, `MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` and commit `dist/client.bundle.js`+`dist/styles.css` (CLAUDE.md rule). (Text-editor changes are canvas-runtime, built per-canvas — but the fixture/e2e touch client-adjacent paths; check.)
6. **Manual / user**: Task 7.2 checklist in the real desktop app.

---

## Scenario Coverage (UI tasks — required)

**Existing:**

| Scenario | Covers | Status |
|----------|--------|--------|
| `app-boots-and-renders-canvas` | native shell + canvas render | ✅ existing (unaffected) |
| `canvas-text-editing` | in-canvas text editing in WKWebView | 🆕 new (this feature — the verification backbone) |

**New to create:** `canvas-text-editing` — flow: open fixture canvas → per surface {enter edit (synthetic dblclick) → caret-at-click → custom-caret present+animated → type → Enter commit / Shift+Enter newline → persist across reopen}; persona: designer; fixtures: enriched `Smoke.tsx` (testids + mixed `<p>`) + seeded `Smoke.annotations.svg` (sticky + text). Note in the spec that native caret *blink* is a user-visual gate (temporal), the harness asserts the custom-caret element + animation as the proxy.

> The cross-platform `scenario-runner` (5 platforms) is **N/A** here — this is native-WKWebView-specific behavior; `agent-browser`/Chromium cannot reproduce it (measured). The desktop-e2e harness IS the cross-platform substitute for this feature. Record this divergence (a DDR) so `/flow:done` doesn't block on the missing 5-platform run.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `/flow:utils-verify`-equivalent passes after each task (Biome + affected `bun test` + the phase's e2e assertion)
- [ ] Real-WKWebView e2e green: on **all five surfaces** (artboard element, shape, sticky, text-tool, section title) — edit engages, custom blinking caret present + animated + positioned, caret-at-click collapses at the clicked offset, Enter commits / Shift+Enter newlines, text-tool edits existing text in place with no ghost, static text persists across ⌘R, mixed/dynamic text is NOT offered a dead-end editor
- [ ] `applyTextEdit` never rewrites a sibling element (unit + e2e)
- [ ] `/design:smoke` clean (every PNG read)
- [ ] Caret/keyboard/cursor behavior is **identical** across all five surfaces (unified)
- [ ] Committed `dist` bundles rebuilt `--release` if any `client/**` changed
- [ ] DDRs recorded: (a) custom-caret + foreignObject→world-HTML decision; (b) desktop-e2e-as-cross-platform-substitute for WKWebView-specific behavior
- [ ] **User visual confirmation** (Task 7.2) obtained in `pnpm dev:desktop`
- [ ] No regression to existing annotation features (group resize, sticky author, sections, arrows, drawing) — re-verify via the annotation suite + smoke

---

## Risks

- **foreignObject→HTML conversion regressing annotation rendering** (positioning, zoom, read-render suppression, toolbar, outside-click commit) — highest risk. Mitigate: mirror `MediaRefPlayers` exactly; convert + verify ONE editor before the other three; per-zoom e2e screenshots; keep the annotation suite green throughout (memory `feedback_no_break_exhaustive_verify`).
- **Custom caret position drift** (multi-line, word-wrap, IME, scroll) — mitigate: reposition on the full event set + a rAF fallback; scope V1 to the short labels these surfaces hold; `prefers-reduced-motion` respected.
- **Harness can't drive native input into the iframe** (measured) — mitigate: synthetic events dispatched inside the same-origin iframe faithfully trigger the app handlers; blink/feel gated on user confirmation (Task 7.2). Don't regress the harness (tauri-service stays 1.1.0).
- **Concurrent session** is actively editing `apps/studio/exporters/*` + video paths — stage only this feature's files; never blanket-add.
- **Build/target-dir contention** with the user's `pnpm dev:desktop` (shares cargo target) — offer a separate `CARGO_TARGET_DIR` if it interferes.

## Retro / Decisions to record

- DDR: "Unified text editing — custom caret + foreignObject→world-HTML" (the two mechanisms + why native-caret/foreignObject were rejected, grounded in the measured WKWebView baseline).
- DDR: "desktop-e2e is the cross-platform verification substitute for WKWebView-specific canvas behavior" (why `scenario-runner`/Chromium is N/A; synthetic-event driving; user-visual gate for temporal blink).
- Note for CLAUDE.md/`desktop-e2e` skill: `@wdio/tauri-service` MUST stay pinned `1.1.0` (1.2.0 reintroduced the broken `installMockSyncOverride` import — re-confirmed 2026-07-09); native WebDriver input does not penetrate the canvas iframe (drive via synthetic events inside the same-origin frame).
