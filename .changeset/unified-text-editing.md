---
"@1agh/maude": minor
---

Unified text editing across every canvas surface, with inline editing of variable-driven text.

- Every editable text surface — an artboard element's copy, a shape's text, a sticky, a standalone text-tool label, and a section title — now behaves like one predictable WYSIWYG editor: click to place a caret, type or select normally, Enter to confirm, Shift+Enter for a newline, with a visible blinking caret everywhere and no ghosting or overlap.
- The four annotation editors were moved off SVG `<foreignObject>` to plain HTML in the world div (the `MediaRefPlayers` pattern), so clicks hit-test correctly at any zoom — caret-at-click, text-tool click-through onto existing text, and no duplicate/ghost editor, by construction. Entering an annotation editor now places the caret at the clicked character instead of selecting everything.
- A shared, engine-independent custom blinking caret (`caret-color: transparent` + a CSS-animated caret element positioned at the live selection) replaces the native caret, which froze under WebKit's transformed canvas — so the caret blinks identically on all five surfaces.
- Text that comes from a `{variable}` — a `.map()` over a data array, a component prop fed `BEATS[0]`, or a local `const` — is now editable inline: double-click and change the words, and the edit is traced back to the right source string (picked by which rendered instance you edited and verified against the pre-edit text, so it never rewrites the wrong item). Genuinely computed text (`{price.toFixed(2)}`, template strings) still routes to chat / `/design:edit` with a clear reason instead of a dead-end editor. Undo/redo works for these edits and now survives the canvas reload.
- A build-time `data-cd-editable` marker gates inline-edit entry so you're only offered an editor where the change will actually save.
