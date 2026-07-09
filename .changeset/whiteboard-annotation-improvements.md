---
"@1agh/maude": minor
---

Whiteboard/annotation improvements: bulk resize, sticky authorship, smarter `/design:board`, and a sticker picker.

- Selecting multiple annotation elements together now shows live, draggable corner handles that resize the whole group proportionally about a shared origin, instead of only resizing one element at a time.
- Sticky notes now show who drew them — a name/nickname badge (not an avatar), colored to match that author's live presence cursor.
- `/design:board` now understands generation requests (e.g. "vytvoř mi team sprint retro" / "make me a team sprint retro"), and Maude Desktop's ACP chat can discover the whiteboard skill on its own instead of requiring the skill to be invoked explicitly.
- Fixed shape/text-annotation editing: the caret no longer jumps from the top of the box to center on the first keystroke, a blinking caret is now visible everywhere text is edited, double-clicking places the caret at the click point instead of selecting all text, hovering editable text now shows a text cursor, and the Text tool now edits existing text in place instead of stacking a new annotation on top.
- Newly created shapes and sticky notes auto-focus into text-edit mode immediately, so you can start typing without an extra click.
- Keyboard shortcuts (e.g. `R` for the rectangle tool) no longer fire while actively typing inside a text/shape/sticky editor.
- Added a searchable, FigJam-style sticker picker with four bundled "fun/crazy" sticker packs (with attribution) — not emoji.
- `read-annotations`/`canvas-rects` now tag which section each element belongs to and in what reading order, so board-driven generation (e.g. "make a video from this section") understands section contents as a group.
