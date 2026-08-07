---
'@1agh/maude': patch
---

An AI placeholder slate can now move between the storyline and an overlay layer, just like a real clip.

**Drag it out, drag it back in.** The "move to overlay" and "move to storyline" verbs used to require a clip to carry a real media source, so a not-yet-generated `<AIPlaceholder>` slate — the prompt-carrying stand-in you drop before the AI content exists — was refused every time and stayed stuck wherever it first landed. It now rides the move with its prompt and kind intact, in the storyline or a standalone overlay layer, and back again.
