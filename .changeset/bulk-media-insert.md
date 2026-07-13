---
"@1agh/maude": minor
---

Bulk media insert + fixed data loss on multi-file drag-drop.

- The media picker now supports multi-select — pick several photos (or a mix of photos, videos, and audio) in one go instead of one at a time, with a destination toggle (add to the artboard, or add as free-floating annotations on the canvas). The picker defaults sensibly: video and audio always go on the canvas, since only images can drop into an artboard.
- The tool-palette "Insert Image" tool no longer does nothing on a canvas with no artboard yet — it now opens the picker in annotation-only mode.
- Fixed a data-loss bug where dragging several files from Finder onto the canvas at once would sometimes silently drop some of them (1 shown, sometimes 2, sometimes N) — every file in a batch now lands reliably.
- Fixed a follow-up bug where deleting an annotation (Backspace) appeared to do nothing until the canvas was reloaded — the delete was reaching the server correctly but getting silently reverted in the live view.
- Fixed a related edge case where deleting an image annotation while its upload was still in progress could cause it to reappear once the upload finished.
