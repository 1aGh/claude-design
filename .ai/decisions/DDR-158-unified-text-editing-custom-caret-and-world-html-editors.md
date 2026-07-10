# DDR-158: Unified text editing — custom blinking caret + annotation editors as plain HTML in the world div

- **Date:** 2026-07-09
- **Status:** Accepted (implemented — feature `unified-text-editing`)
- **Tags:** studio, canvas-runtime, text-editing, caret, webkit, foreignObject, contenteditable, annotations, persistence, editability
- **Related:** [DDR-103](./DDR-103-inline-text-edit.md) (the artboard inline editor this unifies with), [DDR-150](./DDR-150-element-editing-robustness.md) (edit-revert defense-in-depth this front-gates), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md) (the persisted camera the e2e harness must reset), [DDR-159](./DDR-159-desktop-e2e-substitute-for-wkwebview-canvas-behavior.md) (how this feature is verified). Memory: `reference_foreignobject_under_transform_breaks_carets_and_clicks`.

## Context

Text editing on the Maude canvas was four divergent editors with WebKit-specific breakage, reported verbatim by the user across artboard AND annotation text: no caret blink anywhere (static line), inconsistent caret look, select-all-on-entry with no click-to-place, the Text tool ghosting a new annotation over existing text instead of editing it, and artboard edits that "looked saved" but vanished on ⌘R (or bounced with "element … has dynamic content").

A measured WKWebView baseline (desktop-e2e harness, 2026-07-09) established root causes:

- **Blink:** WebKit freezes the native caret blink when a compositing trigger lands on/near the editable (a prior `translateZ(0)` "fix" *caused* it); blink is temporal, so no automated tool can assert it either way.
- **Hit-testing:** the four annotation editors lived inside SVG `<foreignObject>` under the transformed `.dc-world` — content there mis-hit-tests clicks at most zoom levels (the already-documented MediaRefPlayers lesson), and the `.dc-annot-svg` root's `pointer-events: none` swallowed in-editor clicks entirely, so caret-at-click was structurally impossible.
- **Persistence:** the shell offered inline editing off a DOM-only leaf-text heuristic; `<p>Total: {1 + 1} items</p>` renders as text nodes but is mixed in source, so `applyTextEdit` refuses it after the user already typed — the DDR-150 dead end.

## Decision

**One behavior, two existing mechanisms, plus a shared caret primitive** — the unification is behavioral, not a single component (the artboard edits a live DOM node in place; annotations edit a data model through React; forcing one component would be a worse abstraction).

### 1. Custom CSS-animated caret for ALL surfaces (`apps/studio/text-caret.ts`)

`mountCaret(editable, win) → dispose` hides the native caret (`caret-color: transparent`) and paints a `[data-maude-caret]` span — `position: fixed` in the body, placed from the live selection's client rects (already post-transform viewport coords, so pan/zoom needs no special-casing), blinking via a `maude-caret-blink` keyframe (`prefers-reduced-motion` → static but visible). Positioning is deliberately redundant: synchronous first paint + discrete events (`selectionchange`/`input`/`keyup`/`focus`/`blur`/`scroll`) + a rAF loop for pan/zoom. **rAF alone is not enough — WKWebView pauses rAF for occluded windows (measured), which left the caret mounted-but-invisible.** This makes blink engine-independent, identical everywhere, and harness-assertable (presence + animationName + position) where native blink is unverifiable.

`placeCaretAt(editable, win, point?, fallbackToSelectAll)` is the one entry-placement chain (`caretRangeFromPoint` → `caretPositionFromPoint` → outside-editable guard → select-all fallback) shared by the artboard's `enterEditModeAt` and every annotation editor, so caret-at-click can never diverge per surface. Click entry carries its coords into the editor (`editCaretPoint`); keyboard entry (Enter, fresh-create, ⌘Enter chain) stays select-all — the rename convention. In-editor plain clicks re-place the caret on **pointerup** (not pointerdown — preserves native drag-select and shift-click), which also makes repositioning independent of native hit-testing.

### 2. Annotation editors converted from `<foreignObject>` to plain HTML in the world div

The proven in-repo fix (MediaRefPlayers) applied to the editors: a new `AnnotEditors` portal renders each editor as an absolutely-positioned DIV in `worldRef` — the old foreignObject `x/y/w/h` becomes `left/top/width/height` verbatim because the world div carries the pan/zoom transform. Clicks hit-test correctly *by construction*. Read-render suppression carries over — and gained the missing case: a standalone text being re-edited never suppressed its read `<text>` (the pre-existing double-paint "ghost"); now it does. Section-title 1/zoom counter-scaling is world-unit math and carried over unchanged.

### 3. Text tool click-through is a GEOMETRIC hit-test

With a tool armed, every stroke node renders `pointer-events: none`, so DOM `elementsFromPoint` is structurally blind to strokes (measured — the plan's original DOM approach could not work). `findTextStrokeAt` walks strokes topmost-first by world-coord bbox; precedence is z-order (strokes paint above artboard content), then artboard leaf-text (delegated to canvas-shell via `maude:enter-text-edit`), then empty space = new pending text. A section matches only on its label chip (geometry mirrored from `SectionLabelChip` — sync comment on both sides) so a click inside the region body still drops a new text; anchored text is skipped (its host shape's bbox resolves to the same editor).

### 4. Build-time editability marker gates inline editing

`transpileCanvasSource` stamps `data-cd-editable="text"` during the `data-cd-id` walk via `isInlineEditableText` — an **exact mirror of `applyTextEdit`'s acceptance** (single meaningful child that is a static JSXText or a `{'string literal'}` container, DDR-150 P1). The shell's dblclick and the Text-tool click-through both gate on the marker; refused leaf-looking text gets an honest toast ("This text is dynamic — edit it via chat or /design:edit") instead of a dead-end editor. The `edit-reverted` path (DDR-150) stays as defense-in-depth. The handoff emitter strips the new marker alongside `data-cd-id`. **Keep the two predicates in lockstep** — if `applyTextEdit`'s acceptance changes, the stamp must change with it or the marker starts lying.

The "sibling rewrite" observed in the baseline was run down: `applyTextEdit` is proven clean (unit + real-fixture repro change exactly one line); the observation was native-key spillover committing the neighboring `<p>` itself — an actual edit of a multi-line JSXText collapses its whitespace by design, since DOM textContent has no memory of source line breaks. The e2e now guards disk-level sibling byte-integrity on every commit.

## Rejected

- **Native caret + more CSS tweaking** — blink stays unverifiable and engine-fragile; two rounds already burned (including the `translateZ(0)` incident).
- **A shared React `<TextEditor>` for artboard + annotations** — live-DOM-in-place vs data-model editing makes one component a worse abstraction than shared primitives.
- **Keeping foreignObject + hoping `caretRangeFromPoint` behaves inside it** — the mis-hit-testing is the documented, reproduced failure mode.
- **DOM `elementsFromPoint` for stroke click-through** — impossible while a tool is armed (pointer-events: none).

## Consequences

- Caret look, blink, click-to-place, Enter/Shift+Enter, and hover affordances are identical across all five surfaces; the whole behavior set is regression-guarded by the `canvas-text-editing` WKWebView suite (8 tests — see DDR-159 for the verification model).
- The custom caret is the ONLY caret users see while editing; anything that repositions text mid-edit is tracked by the redundant positioning set. New editors must call `useEditorCaret`/`mountCaret` rather than reinventing placement.
- `data-cd-editable` ships in every built canvas; tools that consume built canvas DOM may rely on it to know what is inline-editable.
