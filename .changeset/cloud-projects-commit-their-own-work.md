---
'@1agh/maude': patch
---

**Cloud: a project now records every edit it receives, and the browser stops asking you to save work that is already saved.**

The live cross-surface verification run that the previous release gated on has now been done against a real cell — a browser and the desktop app on one project, two accounts, both origins. It found two things that every unit test had passed over, because both live in the seam between the cell's two processes:

**Edits reached the disk and never reached the history.** In a paired cell the studio process and the hub write the same bytes from the same document, and the studio usually gets there first. The hub committed only files it had written itself, so it wrote nothing, committed nothing, and the project's history simply stopped — while the work sat safely on disk, looking fine. The invariant "exactly one committer" was technically satisfied by there being none. The hub now commits what the document carries, regardless of which process put it on disk, and lets git decide whether anything actually changed.

**Annotations were saved to a name nothing looked for.** The hub filed a canvas's drawn annotations next to the canvas; everything that reads them looks for them under the canvas's own slug at the top of the design folder. The result was a stray file in the project's history — and, for a project mirrored to GitHub, in the mirror — while the real one stayed untracked. The two now agree.

**The browser's Changes panel is now History.** A cloud project commits as you work, so a list of "unsaved changes", a Save button and a Publish button described work that was already kept — and the panel's advice to save from your terminal was addressed to people who have no terminal. Where the server owns the history, the panel now shows only what it can honestly offer: what was saved, and when. The desktop app is unchanged; it still owns its own checkout and its own Save and Publish.
