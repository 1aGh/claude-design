---
"@1agh/maude": patch
---

Fix: the file tree now refreshes when a canvas is created on disk from outside the browser.

When the Assistant panel (or the terminal) ran `/design:new`, the new canvas landed on disk but never appeared in the FILES tree until you reloaded the window — because the tree only refreshed for canvases created through the in-app **+** button. Now any canvas written straight to disk (the AI agent's `/design:new`, an agent edit, or a `git checkout` that brings in new canvases) shows up in the tree right away, and removed canvases drop out the same way.
